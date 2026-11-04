'use strict';
/* Débris payants (jeu 2.0.7, demande d'Anthony du 4 novembre 2026), dans la fenêtre du jeu du launcher, sur Bunker 7 :
   amas de pierres et de rochers (3 mailles par passage, plus de caisses ni de planches) ; achat : la charge se colle à
   l'amas du côté du joueur, bipe de plus en plus vite, saute 2,8 s après l'achat ; le passage s'ouvre alors (cases,
   zones), les rochers volent puis disparaissent, des traces de brûlure restent au sol et sur les murs ; ni dégâts ni
   secousse, aucune lampe ajoutée ; plus d'achat pendant la mèche ; sauvegarde pendant la mèche ; nouvelle partie,
   partie restaurée, ouverture sans charge (phase 5 du boss), ouverture pendant la mèche ; rendu sans erreur.
     xvfb-run -a node e2e/debris.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-debris-'));
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
    const res = [];
    const report = (r) => res.push(r);
    // ------------------------------------------------------------ construction : l'amas, la charge, les traces
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__debt = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = false; player.maxHp = player.hp = 1e6;
          G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
          G.points = 20000;
        },
        portes: () => Object.values(World.doors).filter((d) => d.type === 'debris'),
        borne: (d) => Features.interactables.find((q) => q.kind === 'door' && q.x === d.cx && q.z === d.cz),
        // côté du passage où le joueur se tient (case de sol) ; le joueur à 1,5 m de l'amas (sans régler son regard)
        devant(d) {
          const D = d.deb;
          let s = 1;
          for (const c of [1, -1]) { const p = debMonde(D, 0, 0, c * 1.5); if (grid[d.li * GN + Math.floor(p.z) * GW + Math.floor(p.x)] === T.FLOOR) { s = c; break; } }
          const p = debMonde(D, 0, 0, s * 1.5);
          player.gy = d.E; placePlayer(p.x, p.z); player.vel.set(0, 0, 0);   // téléportation du jeu
          return s;
        },
        lampes() { let n = 0; scene.traverse((o) => { if (o.isLight) n++; }); return n; },
        vis: (l) => l.filter((m) => m.visible).length,
        pas(n) { for (let i = 0; i < n; i++) { player.hp = player.maxHp; __zs.step(1, 1 / 60); } },
      };
      Q.partie();
      const P = Q.portes();
      ok(P.length === 2 && P.every((d) => d.deb && d.pieces.length === 3 && d.pieces.every((p) => p.m.geometry.attributes.position.count > 3000)),
        `Bunker 7 : ${P.length} passages bouchés, chacun un amas de rochers en 3 mailles (${P.map((d) => d.pieces.reduce((s, p) => s + p.m.geometry.attributes.position.count / 3, 0)).join(' et ')} triangles)`);
      ok(P.every((d) => !d.group.children.some((m) => m.material === MAT.crate || m.material === MAT.board || m.material === MAT.sandbag)), 'plus de caisses, de planches ni de sacs');
      for (const d of P) d.deb.cadre.updateMatrixWorld(true);
      const tailles = P.map((d) => {                // repère du passage : x le long de l'ouverture, y vers le haut
        const b = new THREE.Box3();
        for (const p of d.pieces) { p.m.geometry.computeBoundingBox(); b.union(p.m.geometry.boundingBox); }
        const w = new THREE.Box3(); for (const p of d.pieces) w.expandByObject(p.m);   // dans le monde : sur les cases du passage
        const c = d.cells.every((k) => w.containsPoint(new THREE.Vector3((k % GW) + 0.5, d.E + 1, ((k / GW) | 0) + 0.5)));
        return { l: +(b.max.x - b.min.x).toFixed(2), h: +b.max.y.toFixed(2), w: d.deb.width, c };
      });
      ok(tailles.every((t) => t.l >= t.w && t.h >= 2.4 && t.c), `l'amas bouche le passage (largeur, hauteur : ${tailles.map((t) => `${t.l} m, ${t.h} m`).join(' ; ')})`, tailles);
      ok(P.every((d) => d.cells.every((c) => !doorOpen[c]) && !d.opened && !d.charge), 'passages fermés (cases bloquées)');
      // aucun jour : des rayons droits à travers le passage, tous les 4 cm, du sol au linteau, butent sur l'amas
      const jours = P.map((d) => {
        const D = d.deb, ray = new THREE.Raycaster(), dir = debMonde(D, 0, 0, -1).sub(debMonde(D, 0, 0, 0)).normalize(), tas = d.pieces.map((p) => p.m);
        let n = 0, passe = 0;
        for (let u = -D.width / 2 + 0.04; u <= D.width / 2 - 0.04; u += 0.04) for (let y = 0.05; y < DOOR_H - 0.01; y += 0.04) {
          ray.set(debMonde(D, u, y, D.prof / 2 + 1), dir); ray.far = D.prof + 2; n++;
          if (!ray.intersectObjects(tas, false).length) passe++;
        }
        return { n, passe };
      });
      ok(jours.every((j) => j.passe === 0), `aucun jour dans l'amas (${jours.map((j) => `${j.n} rayons`).join(', ')} : ${jours.map((j) => j.passe).join(' et ')} passent)`, jours);
      ok(P.every((d) => d.verb === 'faire sauter les débris') && P.map((d) => d.cost).join() === '1000,1250', 'achat : « faire sauter les débris », prix de la carte (1 000 et 1 250)');
      ok(P.every((d) => !d.deb.bombe.visible && Q.vis(d.deb.traces) === 0 && Q.vis(d.deb.eclats.map((e) => e.m)) === 0), 'charge, éclats et traces cachés avant l’achat');
      ok(P.every((d) => d.deb.traces.length >= 6 && d.deb.traces.every((m) => m.material === DEB.mats.trace || m.material === DEB.mats.traceBord)), `traces de suie (${P.map((d) => d.deb.traces.length).join(' et ')} par passage)`);
      const lin = new THREE.Color(0xe2ded6).convertSRGBToLinear();
      ok(P.every((d) => d.pieces.every((p) => _linDone.has(p.m.material))) && DEB.mats.roches.every((m) => _linDone.has(m)) && Math.abs(DEB.mats.roches[0].color.r - lin.r) < 1e-6,
        'couleurs converties une fois avec le monde (linearizeTree)', [DEB.mats.roches[0].color.r, lin.r]);
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ achat, charge, mèche, explosion
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__debt, d = Q.portes()[0], D = d.deb, it = Q.borne(d);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      const s = Q.devant(d);
      Q.pas(2);
      const p0 = G.points, l0 = Q.lampes(), pr0 = it.prompt();
      ok(pr0 && pr0.text === 'Appuyez sur F pour faire sauter les débris' && pr0.cost === 1000, `texte d'achat : « ${pr0 && pr0.text} »`);
      it.use();
      ok(G.points === p0 - 1000 && d.charge && !d.opened && D.bombe.visible && D.s === s, `achat : −1 000 points, charge posée du côté du joueur (${s > 0 ? '+' : '−'}), passage encore fermé`);
      ok(it.prompt() === null, 'pendant la mèche : plus de texte d’achat');
      it.use();
      ok(G.points === p0 - 1000, 'pendant la mèche : un second achat ne dépense rien');
      const svm = serializeGame();
      ok(svm.doors.includes(d.id) && svm.stats.doors === G.stats.doors + 1, 'sauvegarde pendant la mèche : le passage compte comme ouvert (points dépensés, statistique comprise)');
      // bips et diode ; plus rapprochés vers la fin
      const bips = [], k0 = Sound.keypad;
      Sound.keypad = function (t) { bips.push({ t: D.t, k: t }); return k0.apply(this, arguments); };
      let led = 0, tOuv = null, hp0 = player.hp, shake = 0, maxI = 0, l1 = 0, colle = null;
      try {
        for (let i = 0; i < 60 * 3.4 && !d.opened; i++) {
          Q.pas(1);
          if (D.led.visible) led++;
          shake = Math.max(shake, FX.shake);
          if (D.t > DEB.pose && colle == null) { D.bombe.updateMatrixWorld(true); colle = D.bombe.getWorldPosition(new THREE.Vector3()); }
          if (d.opened) { tOuv = D.t; maxI = FX.boomLight.intensity; l1 = Q.lampes(); }
        }
      } finally { Sound.keypad = k0; }
      const ec = bips.filter((b) => b.k === 'key').map((b) => b.t), iv = ec.slice(1).map((t, i) => t - ec[i]);
      ok(bips.length && bips[0].k === 'ok' && ec.length >= 8 && iv[0] > 0.3 && iv[iv.length - 1] < 0.15 && led > 0,
        `charge armée (double bip), puis ${ec.length} bips de plus en plus rapprochés (${iv[0].toFixed(2)} s → ${iv[iv.length - 1].toFixed(2)} s), diode qui clignote`, { iv });
      // charge collée : son dos (v = D.vc) contre le rocher le plus avancé sous elle (rayons tous les 2 cm sur son empreinte)
      const ray = new THREE.Raycaster(), dir = debMonde(D, 0, 0, -s).sub(debMonde(D, 0, 0, 0)).normalize();
      let vmax = -1;
      for (let du = -0.14; du <= 0.141; du += 0.02) for (let y = 1.04; y <= 1.2; y += 0.02) {
        ray.set(debMonde(D, D.u + du, y, s * (D.o + 1.5)), dir); ray.far = D.o + 1.5;
        const h = ray.intersectObjects(d.pieces.map((p) => p.m), false)[0];
        if (h) vmax = Math.max(vmax, D.o + 1.5 - h.distance);
      }
      D.cadre.updateMatrixWorld(true);
      const dos = colle && s * D.cadre.worldToLocal(colle.clone()).z;   // v du dos de la charge (repère du passage)
      ok(colle && vmax > 0 && dos - vmax > -0.04 && dos - vmax < 0.015 && colle.y - d.E > 0.9 && colle.y - d.E < 1.4,
        `charge collée à l'amas (dos à ${dos && (100 * (dos - vmax)).toFixed(1)} cm du rocher le plus avancé, ${colle && (colle.y - d.E).toFixed(2)} m de haut)`, { dos, vmax });
      ok(tOuv != null && Math.abs(tOuv - (DEB.pose + DEB.meche)) < 0.05, `explosion ${tOuv && tOuv.toFixed(2)} s après l'achat`);
      ok(d.opened && !d.charge && d.cells.every((c) => doorOpen[c] === 1) && [...d.zones].every((z) => z < 0 || G.activeZones.has(z)), 'passage ouvert (cases franchissables, zones activées)');
      ok(d.pieces.every((p) => !p.m.visible) && !D.bombe.visible && Q.vis(D.eclats.map((e) => e.m)) === DEB.eclats && Q.vis(D.traces) === D.traces.length,
        `l'amas et la charge disparaissent, ${DEB.eclats} rochers volent, les traces apparaissent`);
      ok(maxI > 5 && l1 === l0 && Q.lampes() === l0, `éclair de l'explosion sans lampe ajoutée (${l0} lampes avant, ${l1} pendant)`);
      // regard sur le passage (suie au sol et aux murs dans le champ), une image, puis le programme de chaque matière
      const cc = debMonde(D, 0, 0.6, 0);
      player.yaw = Math.atan2(player.pos.x - cc.x, player.pos.z - cc.z); player.pitch = -0.35; Q.pas(1);
      player.yaw = Math.atan2(player.pos.x - cc.x, player.pos.z - cc.z); player.pitch = -0.35;
      updateCamera && updateCamera(0);
      renderEnabled = true; render(); renderEnabled = false;
      const prog = (m) => { const p = renderer.properties.get(m); return p && p.currentProgram; };   // three r128 : programme de la matière
      ok(prog(DEB.mats.trace) && prog(DEB.mats.trace) === prog(DEB.mats.roches[0]) && prog(DEB.mats.traceBord) === prog(DEB.mats.roches[0]),
        'suie dessinée avec le programme des rochers, déjà compilé (pas de compilation à l’explosion)', [!!prog(DEB.mats.trace), !!prog(DEB.mats.traceBord), !!prog(DEB.mats.roches[0])]);
      ok(player.hp === hp0 && shake === 0, 'ni dégâts au joueur ni secousse de caméra');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ après : rochers retombés, traces au sol et aux murs
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__debt, d = Q.portes()[0], D = d.deb;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      let haut = 0;
      for (let i = 0; i < 170; i++) { Q.pas(1); for (const e of D.eclats) if (e.m.visible) haut = Math.max(haut, e.m.position.y - d.E); }
      ok(haut > 0.5 && haut < WALL_H && Q.vis(D.eclats.map((e) => e.m)) === 0, `rochers sous le plafond (${haut.toFixed(2)} m au plus haut, plafond à ${WALL_H} m), retombés puis disparus (2,4 s)`, haut);
      ok(Q.vis(D.traces) === D.traces.length, 'traces toujours là');
      // traces des murs : chacune contre une case de mur ; traces du sol : sur une case de sol
      const w = new THREE.Vector3(), mauvaises = [];
      for (const m of D.traces) {
        m.getWorldPosition(w);
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
        const sol = Math.abs(n.y) > 0.9;
        const q = sol ? w.clone() : w.clone().addScaledVector(n, -0.05);
        const k = d.li * GN + Math.floor(q.z) * GW + Math.floor(q.x), t = grid[k];
        if (sol ? (n.y > 0 ? t === T.WALL || t === T.VOID : false) : (t !== T.WALL && t !== T.DOOR)) mauvaises.push({ x: +w.x.toFixed(2), y: +(w.y - d.E).toFixed(2), z: +w.z.toFixed(2), t, sol });
      }
      ok(mauvaises.length === 0, `traces posées sur le sol et contre les murs, jamais dans le vide (${D.traces.length} traces)`, mauvaises);
      const z = (n) => D.traces.filter((m) => { m.getWorldPosition(w); return n(w.y - d.E); }).length;
      ok(z((y) => y < 0.05) >= 2 && z((y) => y > 0.3) >= 4, `au sol (${z((y) => y < 0.05)}) et sur les murs (${z((y) => y > 0.3)})`);
      renderEnabled = true; render(); renderEnabled = false;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ nouvelle partie, partie restaurée, ouvertures sans charge
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__debt;
      const sv = serializeGame();
      Q.partie();
      const [a, b] = Q.portes();
      ok(!a.opened && !a.charge && a.pieces.every((p) => p.m.visible) && !a.deb.bombe.visible && Q.vis(a.deb.traces) === 0 && Q.vis(a.deb.eclats.map((e) => e.m)) === 0,
        'nouvelle partie : amas remis, plus de charge, d’éclat ni de trace');
      // partie restaurée : passage ouvert, traces, sans explosion
      const boom0 = FX.boomT;
      startGame(sv); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
      Q.pas(1);
      const [a2] = Q.portes();
      ok(a2.opened && a2.pieces.every((p) => !p.m.visible) && Q.vis(a2.deb.traces) === a2.deb.traces.length && Q.vis(a2.deb.eclats.map((e) => e.m)) === 0 && FX.boomT <= boom0 + 1e-9,
        'partie restaurée : passage ouvert, traces en place, sans explosion');
      // ouverture sans charge (phase 5 du boss, __zs.openAll) : l'explosion seule
      Q.partie();
      const [, b3] = Q.portes();
      openDoor(b3);
      ok(b3.opened && b3.pieces.every((p) => !p.m.visible) && Q.vis(b3.deb.eclats.map((e) => e.m)) === DEB.eclats && Q.vis(b3.deb.traces) === b3.deb.traces.length && !b3.deb.bombe.visible,
        'ouverture sans charge (openDoor, comme __zs.openAll) : l’amas saute quand même, traces');
      // ouverture pendant la mèche : la charge disparaît, pas de seconde explosion
      const [a4] = Q.portes();
      Q.devant(a4); Q.borne(a4).use(); Q.pas(30);
      const st0 = G.stats.doors, autres = Object.values(World.doors).filter((x) => !x.opened && x !== a4).length;
      b7OuvrirPortes();                           // phase 5 du boss pendant la mèche
      const v0 = a4.deb.vol, st1 = G.stats.doors;
      Q.pas(200);
      ok(a4.opened && !a4.charge && !a4.deb.bombe.visible && v0 > 2 && Q.vis(a4.deb.eclats.map((e) => e.m)) === 0 && Object.values(World.doors).every((x) => x.opened),
        'phase 5 du boss pendant la mèche : toutes les portes ouvertes, la charge disparaît, une seule explosion');
      ok(autres >= 1 && st1 === st0 + 1, `phase 5 : le passage payé compte (${st0} → ${st1}), les ${autres} portes offertes non`, { st0, st1, autres });
      ok(b && b.deb, 'second passage présent');
      renderEnabled = true; render(); renderEnabled = false;
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
  console.log(failures ? `${failures} échec(s).` : 'Débris : conformes (amas, charge, mèche, explosion, traces, remise à zéro, partie restaurée).');
  process.exit(failures ? 1 : 0);
})();
