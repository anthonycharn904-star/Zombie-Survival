'use strict';
/* Anthony, le personnage jouable (jeu 2.0.6), dans la fenêtre du jeu du launcher : son modèle chargé
   (fichiers d'Anthony insérés tels quels : tête « cuite », nombres de triangles, d'appels et d'os de son
   INTEGRATION.md), couleurs converties une seule fois (hors de World.root, matières marquées), ses bras FPS
   posés sur nos articulations pour les 16 armes (la préhension décide), nos bras calculés mais plus
   dessinés, un bras caché avec le nôtre ; son corps caché au menu et à terre, montré en partie, yeux à la
   hauteur de la caméra debout et accroupi, pieds au sol ; vue FPS : effacement près de la caméra pour
   elle seule, bras du corps repliés pour elle seule, ombre du corps entier ; rendu sans erreur. Vue TPS (T) :
   caméra derrière l'épaule, fixe pendant la visée, arme dans sa main, traçantes au canon, réticule sur le
   point visé, caméra rapprochée contre un mur ; au volant de la jeep (Khamsin) : montée, pose assise (hanches,
   pieds, mains sur le volant à 10 h 10 qui suivent sa rotation), caméra du conducteur à ses yeux, vue de
   poursuite par T, descente.
     xvfb-run -a node e2e/personnage.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-perso-'));
const USER = path.join(TMP, 'joueur');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    const res = await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const near = (a, b, d) => Math.abs(a - b) <= d;
      // ------------------------------------------------------------ le modèle
      const H = PERSO.hero, A = PERSO.arms;
      ok(typeof createSurvivor === 'function' && typeof createSurvivorArms === 'function' && typeof Survivant.createEnvironment === 'function' && PERSO.on && !PERSO.err,
        'modèle d’Anthony chargé (createSurvivor, createSurvivorArms, Survivant.createEnvironment)', PERSO.err);
      const hs = H && H.stats, as = A && A.stats;
      ok(hs && near(hs.triangles, 106600, 600) && hs.drawCalls === 14 && hs.bones === 32 && H.headVersion === 'cuite' && H.object.name === 'Anthony',
        `corps : ${hs && hs.triangles} triangles, ${hs && hs.drawCalls} appels, ${hs && hs.bones} os, tête « cuite », nommé Anthony`, { hs, tete: H && H.headVersion });
      ok(as && near(as.triangles, 19600, 300) && as.drawCalls === 3 && as.bones === 37, `bras FPS : ${as && as.triangles} triangles, ${as && as.drawCalls} appels, ${as && as.bones} os`, as);
      const lin = (o) => Object.keys(o.materials).every((k) => _linDone.has(o.materials[k]));
      let inWorld = false; for (let o = H.object; o; o = o.parent) if (o === World.root) inWorld = true;
      ok(lin(H) && lin(A) && !inWorld && H.object.parent === scene && A.object.parent === Arms.root,
        'couleurs converties une seule fois : corps hors de World.root, matières marquées pour linearize', { inWorld });
      ok(near(H.object.scale.x, PLAYER_EYE / 1.667, 1e-6), `taille : 1,75 m (×${H.object.scale.x.toFixed(4)})`);
      persoBeforeRender();
      ok(!H.object.visible, 'au menu : corps caché');

      // ------------------------------------------------- ses bras sur la préhension
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
      const V = () => new THREE.Vector3(), B = A.bones;
      const F = ['index', 'middle', 'ring', 'pinky'];
      // base du pouce (thumb1) : à sa place sur sa main (PERSO.pouceBase 'sien', jeu 2.0.6 : elle ne traverse plus la
      // fiole), à 10 mm de la nôtre ; contrôlée à part
      const sien = PERSO.pouceBase === 'sien';
      let maxBase = 0;
      const gap = (arm, S) => {
        let m = B['hand' + S].getWorldPosition(V()).distanceTo(arm.hand.wrist.getWorldPosition(V()));
        arm.hand.fingers.forEach((segs, i) => segs.forEach((g, j) => { m = Math.max(m, B[F[i] + (j + 1) + S].getWorldPosition(V()).distanceTo(g.getWorldPosition(V()))); }));
        arm.hand.thumb.forEach((g, j) => {
          const d = B['thumb' + (j + 1) + S].getWorldPosition(V()).distanceTo(g.getWorldPosition(V()));
          if (j === 0 && sien) maxBase = Math.max(maxBase, d); else m = Math.max(m, d);
        });
        return m;
      };
      const ids = Object.keys(WEAPONS), worst = {}, hidden = [];
      let maxGap = 0;
      for (const id of ids) {
        __zs.give(id, 0); Input.rmb = false; Input.lmb = false; __zs.step(90, 1 / 60);
        Arms.root.updateMatrixWorld(true);
        for (const [S, arm] of [['R', Arms.armR], ['L', Arms.armL]]) {
          if (!arm.root.visible) { if (B['arm' + S].scale.x < 1e-3) hidden.push(id + S); continue; }
          const g = gap(arm, S) * 1000; worst[id + S] = +g.toFixed(3); maxGap = Math.max(maxGap, g);
        }
      }
      ok(Object.keys(worst).length >= 26 && maxGap < 0.5 && maxBase * 1000 < 12, `16 armes : ses os de la main sur nos articulations (écart au plus ${maxGap.toFixed(3)} mm ; base de son pouce à sa place, à ${(maxBase * 1000).toFixed(1)} mm de la nôtre)`, worst);
      const leftHidden = ids.filter((id) => !hidden.includes(id + 'L') && worst[id + 'L'] === undefined);
      ok(hidden.length >= 1 && leftHidden.length === 0, `un bras caché avec le nôtre (${hidden.join(', ')})`, { hidden, leftHidden });
      let layers = true; for (const a of [Arms.armR, Arms.armL]) a.root.traverse((o) => { if (o.isMesh && o.layers.mask !== 2) layers = false; });
      ok(layers && A.object.visible, 'nos bras : calculés, plus dessinés (calque 1) ; les siens dessinés');

      // --------------------------------------------------------------- son corps
      __zs.give('stg44', 0); __zs.step(60, 1 / 60);
      persoBeforeRender();
      const foot = () => Math.min(H.bones.footL.getWorldPosition(V()).y, H.bones.footR.getWorldPosition(V()).y) - (player.gy + player.y);
      ok(H.object.visible && near(PERSO.eyeY, PLAYER_EYE, 0.03) && foot() > 0 && foot() < 0.15,
        `en partie : corps montré, yeux à ${PERSO.eyeY.toFixed(3)} m (caméra ${PLAYER_EYE}), chevilles à ${foot().toFixed(3)} m du sol`);
      Input.keys.KeyC = true; __zs.step(90, 1 / 60);
      const cam = camera.position.y - (player.gy + player.y), ce = PERSO.eyeY, cf = foot(), cd = PERSO.drop, cl = PERSO.lift;
      Input.keys.KeyC = false; __zs.step(90, 1 / 60);
      ok(near(ce, cam, 0.03) && cf > 0 && cf < 0.1 && cd > 0, `accroupi : yeux à ${ce.toFixed(3)} m, caméra à ${cam.toFixed(3)} m, hanches baissées de ${cd.toFixed(3)} m, chevilles à ${cf.toFixed(3)} m du sol (pieds reposés de ${cl.toFixed(3)} m)`, { ce, cam, cf, cd, cl });
      player.down = true; player.downT = 4.5; __zs.step(2, 1 / 60); persoBeforeRender();     // à terre, comme goDown
      const downHidden = !H.object.visible && player.down;
      revivePlayer(); __zs.step(2, 1 / 60); persoBeforeRender();
      ok(downHidden && H.object.visible, 'à terre : corps caché ; relevé : montré');
      const casters = ['veste', 'jean', 'tshirt', 'cuir', 'skin'].filter((k) => H.meshes[k] && H.meshes[k].castShadow);
      ok(casters.length === 5, 'son ombre : veste, jean, t-shirt, cuir et peau projettent leur ombre', Object.keys(H.meshes).map((k) => k + (H.meshes[k].castShadow ? '+' : '-')));

      // ----------------------------------------------- vue FPS : rendu, effacement, bras repliés
      player.pitch = -1.3; __zs.step(2, 1 / 60);
      const gl = renderer.getContext(); gl.getError();
      const mesh = H.meshes[Object.keys(H.meshes)[0]];
      let cutSeen = 0, foldSeen = false;
      const before = mesh.onBeforeRender;
      mesh.onBeforeRender = function (r, sc, cam) {
        before.apply(this, arguments);
        if (cam !== camera) return;
        cutSeen = PERSO.cutU.value;
        const e = H.skeleton.boneMatrices, i = H.skeleton.bones.indexOf(H.bones.armL) * 16;
        foldSeen = Math.hypot(e[i], e[i + 1], e[i + 2]) < 1e-2;
      };
      renderEnabled = true; render(); renderEnabled = false;
      mesh.onBeforeRender = before;
      const e1 = gl.getError(), bad = renderer.info.programs.filter((p) => p.diagnostics && !p.diagnostics.runnable).length;
      ok(e1 === 0 && bad === 0, 'rendu de la vue FPS avec le corps et ses bras sans erreur', { e1, bad });
      ok(cutSeen === PERSO.fps.efface && foldSeen && H.bones.armL.scale.x === 1 && PERSO.cutU.value === 0 || (cutSeen === PERSO.fps.efface && foldSeen && H.bones.armL.scale.x === 1),
        `vue FPS, pour la caméra : effacement à ${cutSeen} m, bras du corps repliés (les os reprennent leur taille aussitôt)`, { cutSeen, foldSeen, s: H.bones.armL.scale.x });
      // une autre caméra (vue TPS, essais) voit le corps entier, sans effacement
      const other = new THREE.PerspectiveCamera(40, 1, 0.05, 50); other.position.set(player.pos.x + 3, 1.2, player.pos.z); other.lookAt(player.pos.x, 1, player.pos.z);
      let cutOther = -1; mesh.onBeforeRender = function (r, sc, cam) { before.apply(this, arguments); if (cam === other) cutOther = PERSO.cutU.value; };
      renderer.render(scene, other); mesh.onBeforeRender = before;
      ok(cutOther === 0, 'une autre caméra voit le corps entier (pas d’effacement)', cutOther);
      player.pitch = 0; __zs.step(2, 1 / 60);
      // fin de partie : caché
      G.state = 'gameover'; persoBeforeRender();
      ok(!H.object.visible, 'fin de partie : corps caché');
      G.state = 'playing';
      return out;
    });

    const report = (r) => res.push(r);
    // ------------------------------------------------------------------ vue TPS (touche T)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const V = () => new THREE.Vector3(), H = PERSO.hero, step = (n) => __zs.step(n, 1 / 60);
      const draw = () => { renderEnabled = true; render(); renderEnabled = false; };
      __zs.give('stg44', 0); Input.rmb = false; step(60);
      Input.down.KeyT = true; step(1); Input.down.KeyT = false; step(20); draw();
      const C = persoCamera(), g = PERSO.av.g, eye = camera.position.clone();
      const back = C.position.clone().sub(eye).applyQuaternion(camera.quaternion.clone().invert());
      ok(PERSO.vue === 'tps' && persoTps() && C !== camera && C.quaternion.angleTo(camera.quaternion) < 1e-6 && back.z > 2 && back.x > 0.3,
        `T : vue TPS, caméra derrière l’épaule droite (${back.z.toFixed(2)} m derrière, ${back.x.toFixed(2)} m à droite), parallèle au regard`, back);
      Input.rmb = true; step(40); draw();
      const C2 = persoCamera(), back2 = C2.position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
      Input.rmb = false; step(30);
      ok(Math.abs(back2.z - back.z) < 0.02 && Math.abs(back2.x - back.x) < 0.02 && Math.abs(C2.fov - C.fov) < 0.01, 'visée en vue TPS : la caméra ne bouge pas, pas de zoom', { back2, fov: [C.fov, C2.fov] });
      let inHand = false; for (let o = g && g.wrap; o; o = o.parent) if (o === H.anchors.rightHand) inHand = true;
      ok(g && inHand && g.wrap.visible && H.object.visible, 'vue TPS : corps montré, l’arme du joueur dans sa main droite', { key: PERSO.av.gunKey });
      const mw = muzzleWorld().clone(), m0 = g.muzzle.getWorldPosition(V());
      ok(mw.distanceTo(m0) < 1e-6, 'vue TPS : traçantes et projectiles partent du canon de son arme');
      const el = HUD.el.crosshair;
      ok(el.style.left !== '' && el.style.top !== '', `réticule sur le point visé (${el.style.left}, ${el.style.top})`);
      // dos à un mur : la caméra se rapproche sans le traverser
      let wall = null;
      for (let a = 0; a < 64 && !wall; a++) {
        const yaw = (a / 64) * Math.PI * 2, bx = Math.sin(yaw), bz = Math.cos(yaw);
        raycast(camera.position.x, camera.position.y, camera.position.z, bx, 0, bz, 3);
        if (RAY.hit && RAY.t > 0.6 && RAY.t < 1.4) wall = { yaw, t: RAY.t };
      }
      if (!wall) {   // aucun mur assez près : on recule vers le mur le plus proche
        let best = null;
        for (let a = 0; a < 64; a++) { const yaw = (a / 64) * Math.PI * 2; raycast(camera.position.x, camera.position.y, camera.position.z, Math.sin(yaw), 0, Math.cos(yaw), 30); if (RAY.hit && (!best || RAY.t < best.t)) best = { yaw, t: RAY.t }; }
        if (best) { const k = (best.t - 1.0) / best.t; __zs.tp(player.pos.x + Math.sin(best.yaw) * (best.t - 1.0), player.pos.z + Math.cos(best.yaw) * (best.t - 1.0), best.yaw); step(2); wall = { yaw: best.yaw, t: 1.0 }; }
      }
      if (wall) { player.yaw = wall.yaw; player.pitch = 0; step(3); draw(); draw(); }
      const d = PERSO.tps.d, C3 = persoCamera();
      raycast(camera.position.x, camera.position.y, camera.position.z, ...C3.position.clone().sub(camera.position).normalize().toArray(), C3.position.distanceTo(camera.position));
      ok(wall && d < 1.5 && !RAY.hit, `dos à un mur : caméra rapprochée à ${d.toFixed(2)} m, sans le traverser`, { wall, d });
      Input.down.KeyT = true; step(1); Input.down.KeyT = false; step(5); draw();
      ok(PERSO.vue === 'fps' && !persoTps() && persoCamera() === camera && el.style.left === '', 'T : retour en vue FPS (caméra du jeu, réticule au centre)');
      return out;
    })).forEach(report);

    // ------------------------------------------- rechargement du corps (vue TPS, coop : section 18)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const V = () => new THREE.Vector3(), H = PERSO.hero, B = H.bones, step = (n) => __zs.step(n, 1 / 60);
      PERSO.vue = 'tps';
      // un rechargement suivi dans le repère de son corps : arme, main gauche, écart des mains à leurs cibles, poche
      const suivre = (id, vide) => {
        __zs.give(id, 0); Input.rmb = false; Input.lmb = false; step(40);
        const s = curSlot(); s.mag = vide ? 0 : 1; s.res = 99; step(60);    // l'arme bien en main (fin du changement d'arme)
        const o = H.object, loc = (v) => v.applyMatrix4(new THREE.Matrix4().copy(o.matrixWorld).invert());
        o.updateMatrixWorld(true);
        const g0 = loc(PERSO.av.g.gun.getWorldPosition(V())), l0 = loc(B.handL.getWorldPosition(V()));
        const poche = new THREE.Vector3().fromArray(PERSO_RL.poche);
        startReload();
        const r = { arme: 0, main: 0, poche: 9, ecart: 0, lache: (PERSO.av.lache || []).length, n: 0 };
        while (Arms.state === 'reload' && r.n < 900) {
          step(1); r.n++; o.updateMatrixWorld(true);
          r.arme = Math.max(r.arme, loc(PERSO.av.g.gun.getWorldPosition(V())).distanceTo(g0) * PERSO.taille);
          const l = loc(B.handL.getWorldPosition(V()));
          r.main = Math.max(r.main, l.distanceTo(l0) * PERSO.taille); r.poche = Math.min(r.poche, l.distanceTo(poche) * PERSO.taille);
          if ((PERSO.av.rlW || 0) >= 0.95 && PERSO.av.rlEcart) r.ecart = Math.max(r.ecart, PERSO.av.rlEcart.R, PERSO.av.rlEcart.L);
        }
        r.lache = (PERSO.av.lache || []).length - r.lache;
        step(30); o.updateMatrixWorld(true);
        r.fin = loc(PERSO.av.g.gun.getWorldPosition(V())).distanceTo(g0) * PERSO.taille;
        r.wrap = PERSO.av.g.wrap.position.length();
        return r;
      };
      const R = {};
      for (const [id, vide] of [['stg44', true], ['m1911', true], ['trench', false], ['kar98k', true], ['panzer', true]]) R[id] = suivre(id, vide);
      const a = R.stg44, p = R.m1911;
      ok(a.arme > 0.12 && a.main > 0.3 && a.poche < 0.12 && a.lache >= 1,
        `STG-44 à vide : l’arme sort de sa garde basse (${(a.arme * 100).toFixed(0)} cm), la main gauche va à ses porte-chargeurs (à ${(a.poche * 100).toFixed(0)} cm) et revient, le chargeur vide tombe au sol`, a);
      ok(p.main > 0.25 && p.poche < 0.12, `M1911 (tenu d’une main) : la main gauche va aussi à la poche et au chargeur (${(p.main * 100).toFixed(0)} cm)`, p);
      const pire = Object.entries(R).reduce((m, [k, v]) => (v.ecart > m[1] ? [k, v.ecart] : m), ['', 0]);
      ok(pire[1] < 0.04, `5 armes : ses mains atteignent leurs cibles pendant le geste (au plus ${(pire[1] * 100).toFixed(1)} cm, ${pire[0]})`, Object.fromEntries(Object.entries(R).map(([k, v]) => [k, +(v.ecart * 100).toFixed(1)])));
      const fin = Object.values(R).every((v) => v.fin < 0.02 && v.wrap < 1e-4);   // sa respiration : 1 cm
      ok(fin && (PERSO.av.rlW || 0) === 0, 'fin du rechargement : l’arme revient dans sa garde basse', Object.fromEntries(Object.entries(R).map(([k, v]) => [k, +(v.fin * 100).toFixed(1)])));
      // réarmement entre deux tirs (levier du Kar98k) : la main droite quitte la poignée, l’arme reste où il la tient
      __zs.give('kar98k', 0); step(40);
      const s = curSlot(); s.mag = 5; step(60);
      const o = H.object, d0 = B.handR.getWorldPosition(V()).sub(o.position);
      Input.lmb = true; Input.lmbDown = true; step(1); Input.lmbDown = false; Input.lmb = false;   // un coup (arme à un coup)
      let main = 0, cyc = false;
      for (let i = 0; i < 70; i++) { step(1); if (Arms.cyc) cyc = true; main = Math.max(main, B.handR.getWorldPosition(V()).sub(o.position).distanceTo(d0)); }
      ok(cyc && main > 0.1, `réarmement du Kar98k en vue TPS : sa main droite actionne le levier (${(main * 100).toFixed(0)} cm)`, { cyc, main });
      PERSO.vue = 'fps';
      return out;
    })).forEach(report);

    // -------------------------------------------------------- au volant de la jeep (Khamsin)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const V = () => new THREE.Vector3(), H = PERSO.hero, B = H.bones, step = (n) => __zs.step(n, 1 / 60);
      const draw = () => { renderEnabled = true; render(); renderEnabled = false; };
      __zs.map('khamsin'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true); G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies(); step(5);
      __zs.give('stg44', 0); step(20);
      const Vh = VEH.list.filter((v) => v.jeep).sort((a, b) => Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(b.x - player.pos.x, b.z - player.pos.z))[0];
      __zs.tp(Vh.x + 2, Vh.z, Vh.yaw); step(30);
      Vh.bought = true; vehEnter(Vh); step(2);
      const trans = !!PERSO.av.trans;
      step(60); draw();
      const J = Vh.jeep, loc = (o) => J.body.worldToLocal(o.getWorldPosition(V()));
      const hip = loc(B.thighL), aL = loc(B.footL), aR = loc(B.footR), hL = loc(H.anchors.leftHand), hR = loc(H.anchors.rightHand), w = loc(J.steeringWheel);
      ok(trans && H.object.visible && PERSO.av.gunKey === '', 'au volant : il monte (0,55 s), assis et montré, sans arme en main', { trans });
      ok(Math.abs(hip.y - 0.82) < 0.03 && hip.z < -0.2 && Math.abs(aL.y - 0.645) < 0.02 && Math.abs(aR.y - 0.645) < 0.02 && aL.z > 0.2,
        `assis : hanches sur le coussin (${hip.y.toFixed(2)} m), pieds à plat au plancher (${aL.y.toFixed(3)} m)`, { hip, aL, aR });
      const rim = (p) => Math.abs(p.clone().sub(w).length() - 0.19);
      ok(rim(hL) < 0.02 && rim(hR) < 0.02 && hL.x > w.x && hR.x < w.x && hL.y > w.y && hR.y > w.y,
        `mains sur le volant, à 10 h 10 (à ${(rim(hL) * 1000).toFixed(0)} et ${(rim(hR) * 1000).toFixed(0)} mm de la jante)`, { hL, hR, w });
      const e = persoEye(PERSO.av);
      ok(VEH.view === 1 && camera.position.distanceTo(e) < 0.03, `vue du conducteur : la caméra est à ses yeux (${(camera.position.distanceTo(e) * 100).toFixed(1)} cm)`);
      Input.keys.KeyD = true; step(50);
      const hR2 = loc(H.anchors.rightHand), rot = J.steeringWheel.rotation.z; Input.keys.KeyD = false; step(60);
      ok(Math.abs(rot) > 0.3 && hR2.distanceTo(hR) > 0.03 && rim(hR2) < 0.02, `volant tourné (${rot.toFixed(2)} rad) : les mains le suivent sur la jante`);
      Input.down.KeyT = true; step(1); Input.down.KeyT = false; step(10); draw();
      ok(VEH.view === 0 && H.object.visible, 'T au volant : vue de poursuite, le conducteur vu de l’extérieur');
      Input.down.KeyT = true; step(1); Input.down.KeyT = false; step(5);
      PERSO.vue = 'tps'; vehExit(false); step(2);
      const exitT = !!PERSO.av.trans; step(60); draw();
      ok(!VEH.drive && exitT && H.object.visible && PERSO.av.gunKey === 'stg44:0', 'descente en vue TPS (0,55 s), puis debout, l’arme en main');
      PERSO.vue = 'fps'; step(2);
      return out;
    })).forEach(report);
    for (const r of res) {
      if (!r.ok) failures++;
      console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
    }
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Personnage : Anthony conforme (bras sur la préhension, corps en vue FPS et TPS, au volant).');
  process.exit(failures ? 1 : 0);
})();
