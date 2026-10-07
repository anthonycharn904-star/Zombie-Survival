'use strict';
/* Armes et rechargements (jeu 1.9.0) dans la fenêtre du jeu du launcher : modèles aux dimensions
   réelles (pièces mobiles, paliers du Glas, dessins à la craie, présentoirs), mains articulées
   ajustées sur chaque arme (paume, doigts et pouce contre l'arme, sans la traverser ; pouce posé
   sur l'arme ou les doigts ; poignet dans l'axe de l'avant-bras ; pistolets tenus d'une main, la
   gauche ne venant que recharger), visée alignée sur les organes de visée, rechargement de chaque arme (tactique et à vide, durées,
   munitions ajoutées au bon moment, pièces revenues en place), coup par coup interrompu par un tir,
   réarmement de la culasse à levier et de la pompe, atout Rechargement rapide, interruption par un
   changement d'arme, pas d'erreur.
     xvfb-run -a node e2e/weapons.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-weapons-'));
const USER = path.join(TMP, 'joueur');
const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  const report = (r) => {
    if (!r.ok) failures++;
    console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
  };
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 180000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    game.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

    // ------------------------------------------------------------------ modèles
    (await game.evaluate((v) => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(ZS.version === v && GAME_VERSION === '1.9.0', `jeu ${v}`, ZS.version);
      const REAL = { m1911: 0.216, kar98k: 1.11, g43: 1.13, mp40: 0.833, thompson: 0.851, trench: 1.0, dbarrel: 1.1, stg44: 0.94, bar: 1.214, ppsh: 0.843, type100: 0.89, fg42: 0.975, mg42: 1.22, panzer: 1.64 };
      const ids = Object.keys(WEAPONS);
      ok(ids.length === 16 && ids.every((id) => GUN_MODELS[id] && RELOADS[id]), '16 armes : un modèle et un rechargement chacune', ids);
      const len = {}, tris = {}, bad = [];
      for (const id of ids) {
        const g = buildGun(id, 0);
        const s = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
        len[id] = +s.z.toFixed(3);
        let n = 0, meshes = 0;
        g.traverse((o) => { if (o.isMesh) { meshes++; n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
        tris[id] = Math.round(n);
        if (meshes > 60) bad.push([id, 'maillages', meshes]);
        const ud = g.userData, P = ud.parts, I = ud.info;
        if (!(I.sight > 0 && I.eye > 0 && I.hip && I.lh && I.rk && I.lk && ud.anchors.gripR)) bad.push([id, 'données de prise et de visée']);
        for (const t of [1, 2, 3]) { const gt = buildGun(id, t); if (Object.keys(gt.userData.parts).join() !== Object.keys(P).join()) bad.push([id, 'pièces du palier', t]); }
        if (!chalkTexture(id) || !chalkTexture(id).image) bad.push([id, 'craie']);
      }
      ok(Object.entries(REAL).every(([id, L]) => Math.abs(len[id] - L) / L < 0.06), 'longueurs réelles à 6 % près (M1911 216 mm … Panzerschreck 1,64 m)', len);
      ok(Object.values(tris).every((n) => n > 3000 && n < 30000), 'modèles détaillés mais légers (3 000 à 30 000 triangles)', tris);
      ok(!bad.length, 'pièces mobiles, données de prise et de visée, paliers du Glas, dessins à la craie', bad);
      const need = { m1911: ['slide', 'hammer', 'mag'], kar98k: ['bolt', 'clip', 'rounds', 'round'], trench: ['pump', 'hammer', 'shell'], dbarrel: ['barrels', 'shells', 'load', 'lever'],
        mg42: ['cover', 'bolt', 'mag'], panzer: ['rocket'], raygun: ['mag'], blaster: ['mag', 'crank'] };
      const miss = Object.entries(need).filter(([id, ps]) => { const P = buildGun(id, 0).userData.parts; return !ps.every((p) => P[p]); });
      ok(!miss.length, 'pièces des mécanismes : glissière, culasse et lame-chargeur, pompe, canons basculants, capot, roquette, cellule, manivelle', miss);
      // mains articulées
      const h = buildHand(false);
      ok(h.fingers.length === 4 && h.fingers.every((f) => f.length === 3) && h.thumb.length === 3, 'main articulée : quatre doigts à trois phalanges et un pouce');
      // prises ajustées sur chaque arme : paume, doigts et pouce posés contre l'arme sans la traverser
      // (cœur de chaque phalange ; l'index droit sur la détente peut frôler l'avant d'un pontet étroit),
      // calcul assez court pour se faire pendant le menu
      const pen = [], slow = {}, nofit = [], air = [], one = [];
      let maxMs = 0;
      for (const id of ids) {
        HOLD_CACHE.delete(id);
        const g = buildGun(id, 0); g.updateMatrixWorld(true);
        const t0 = performance.now(), H = gunHold(g), ms = performance.now() - t0;
        if (ms > 150) slow[id] = Math.round(ms);
        maxMs = Math.max(maxMs, Math.round(ms));
        if (!H.fit || H.fit.miss.length) nofit.push([id, H.fit && H.fit.miss]);
        const T = new Float32Array(gunTris(g));
        if (!!g.userData.info.one !== !!H.L.free || (['m1911', 'raygun'].includes(id) !== !!H.L.free)) one.push(id);
        for (const side of ['R', 'L']) {
          if (H[side].free) continue;                    // pistolet : main gauche hors champ au repos
          const hand = buildHand(side === 'L');
          hand.wrist.position.copy(H[side].p); hand.wrist.quaternion.copy(H[side].q); setHandPose(hand, H[side].pose); hand.wrist.updateMatrixWorld(true);
          const c = hand.body.localToWorld(new THREE.Vector3(0, -0.01, -0.06)), TN = trisNear(T, c, 0.15), G = triGrid(TN, c, 0.16);
          if (palmHit(G, hand)) pen.push([id, side, 'paume']);
          hand.fingers.forEach((bs, i) => bs.forEach((b, j) => { if (!(side === 'R' && i === 0) && phalanxHit(G, b, HAND.fingers[i].L[j], HAND.fingers[i].r[j] * 0.35, j === 2)) pen.push([id, side, `doigt ${i}.${j}`]); }));
          hand.thumb.forEach((b, j) => { if (phalanxHit(G, b, HAND.thumb.L[j], HAND.thumb.r[j] * 0.35, j === 2)) pen.push([id, side, `pouce ${j}`]); });
          // pouce posé : au moins deux phalanges à moins de 4 mm de l'arme ou des doigts de la même main
          const TF = []; for (const f of hand.fingers) objTris(f[0], TF);
          const TT = new Float32Array(TN.length + TF.length); TT.set(TN); TT.set(TF, TN.length);
          const GT = triGrid(TT, c, 0.16);
          let near = 0; hand.thumb.forEach((b, j) => { if (phalanxHit(GT, b, HAND.thumb.L[j], HAND.thumb.r[j] + 0.004, j === 2)) near++; });
          if (near < 2) air.push([id, side, near]);
        }
      }
      ok(!pen.length, 'mains ajustées sur chaque arme : paume, doigts et pouce sans traverser l’arme', pen);
      ok(!air.length, 'chaque pouce posé sur l’arme ou enroulé sur les doigts (pas de pouce en l’air)', air);
      ok(!one.length, 'M1911 et Désintégrateur tenus d’une main (main gauche hors champ au repos), les autres à deux mains', one);
      ok(!nofit.length, 'chaque doigt et chaque pouce trouve sa place contre l’arme (index sur la détente)', nofit);
      ok(!Object.keys(slow).length, `ajustement des mains en moins de 150 ms par arme (calculé pendant le menu ; le plus long : ${maxMs} ms)`, slow);
      return out;
    }, GAME)).forEach(report);

    // ------------------------------------------------------- en partie : visée et rechargements
    const res = await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      renderEnabled = false;
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9;
      clearZombies();
      const ids = Object.keys(WEAPONS);
      const step = (n) => __zs.step(n, 1 / 60);
      // pièces au repos : à leur place (culasse ou glissière en position « à vide » si le chargeur est vide), pièces de rechange cachées
      const restOk = (g) => {
        const s = curSlot(), E = (s.mag === 0 && RELOADS[s.id].empty) || {};
        return Object.entries(g.userData.parts).every(([n, p]) => {
          const want = p.userData.rest.clone();
          if (E[n] && E[n].p) want.add(new THREE.Vector3(...E[n].p));
          return p.position.distanceTo(want) < 1e-4 && p.quaternion.angleTo(p.userData.restQ) < 1e-4 && p.visible === !p.userData.spare;
        });
      };
      // visée : la ligne de mire passe au centre de la vue
      const off = [];
      for (const id of ids) {
        if (id === 'panzer') continue;
        __zs.give(id, 0); step(40);
        Input.rmb = true; step(45);
        const g = Arms.gun, I = g.userData.info;
        g.updateMatrixWorld(true);
        const p = new THREE.Vector3(I.sightX, I.sight, I.muzzle[2]).applyMatrix4(g.matrixWorld).project(vmCamera);
        if (Math.abs(p.x) > 0.03 || Math.abs(p.y) > 0.03) off.push([id, +p.x.toFixed(3), +p.y.toFixed(3)]);
        Input.rmb = false; step(30);
      }
      ok(!off.length, 'visée : le guidon de chaque arme au centre de l’écran', off);
      // poignets : l'avant-bras arrive dans l'axe de la main (pas de main pliée comme un coude au bout de la manche)
      const bent = {};
      for (const id of ids) {
        __zs.give(id, 0); step(40);
        for (const arm of [Arms.armR, Arms.armL]) {
          if (!arm.root.visible) continue;
          const w = arm.hand.wrist, fa = w.position.clone().sub(arm.elbow.position).normalize();
          const a = Math.round(fa.angleTo(new THREE.Vector3(0, 0, -1).applyQuaternion(w.quaternion)) * 180 / Math.PI);
          if (a > 70) bent[`${id}${arm.left ? 'G' : 'D'}`] = a;
        }
      }
      ok(!Object.keys(bent).length, 'poignets dans l’axe de l’avant-bras (moins de 70° de pli à la hanche, chaque arme)', bent);
      // rechargements : tactique et à vide, durée, munitions, pièces revenues en place
      const durs = {}, fails = [];
      for (const id of ids) {
        for (const empty of [false, true]) {
          __zs.give(id, 0); step(40);
          const s = curSlot(), cap = wstat(s, 'mag');
          if (!empty && cap < 2) continue;
          s.mag = empty ? 0 : Math.max(1, Math.floor(cap / 2)); s.res = 999; step(5);
          startReload();
          if (Arms.state !== 'reload' || !Arms.rl) { fails.push([id, empty, 'pas de clip']); continue; }
          const t0 = G.time, magAtStart = s.mag, oneByOne = !!Arms.rl.c.seg;
          let filledAt = -1, n = 0, seen = null;
          const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
          while (Arms.state === 'reload' && n < 900) {
            step(1); n++;
            if (filledAt < 0 && s.mag > magAtStart) { filledAt = G.time - t0; const m = Arms.gun.userData.parts.mag; seen = m ? shown(m) : true; }
          }
          const dur = +(G.time - t0).toFixed(2);
          durs[`${id}${empty ? '·vide' : ''}`] = dur;
          if (s.mag !== cap) fails.push([id, empty, 'chargeur', s.mag, cap]);
          if (Arms.rl) fails.push([id, empty, 'clip resté']);
          if (!restOk(Arms.gun)) fails.push([id, empty, 'pièces pas en place']);
          if (filledAt < 0.25 * dur && !oneByOne) fails.push([id, empty, 'munitions trop tôt', filledAt]);
          if (seen === false) fails.push([id, empty, 'chargeur neuf invisible quand il s’engage']);
        }
      }
      const exp = (id, e) => WEAPONS[id].reload + (e ? (RELOADS[id].cfg ? RELOADS[id].cfg.extra ?? 0.5 : 0) : 0);
      const box = ['mp40', 'thompson', 'stg44', 'bar', 'g43', 'ppsh', 'type100', 'fg42', 'm1911'];
      const off2 = box.flatMap((id) => [[id, durs[id], exp(id, false)], [id, durs[`${id}·vide`], exp(id, true)]]).filter(([, d, e]) => Math.abs(d - e) > 0.08);
      ok(!fails.length, 'chaque arme se recharge (tactique et à vide) : chargeur neuf visible, chargeur plein, pièces revenues en place', fails);
      ok(!off2.length, 'durées comme Call of Duty 4 : tactique à la durée de l’arme, à vide un peu plus long (réarmer)', { off2, durs });
      // atout Rechargement rapide (mainleste) : deux fois plus vite
      __zs.give('mp40', 0); step(40);
      player.perks.add('mainleste');
      let s = curSlot(); s.mag = 3; s.res = 999; startReload();
      let t0 = G.time, n = 0;
      while (Arms.state === 'reload' && n < 600) { step(1); n++; }
      player.perks.delete('mainleste');
      ok(Math.abs(G.time - t0 - WEAPONS.mp40.reload / 2) < 0.06 && s.mag === 32, 'atout Rechargement rapide : deux fois plus vite', +(G.time - t0).toFixed(2));
      // coup par coup interrompu par un tir (Trench)
      __zs.give('trench', 0); step(40);
      s = curSlot(); s.mag = 1; s.res = 99; startReload();
      n = 0;
      while (s.mag < 2 && n < 300) { step(1); n++; }
      Input.lmbDown = true; step(1); Input.lmbDown = false;
      const atStop = s.mag;
      n = 0;
      while (Arms.state === 'reload' && n < 300) { step(1); n++; }
      ok(Arms.state === 'idle' && s.mag >= 2 && s.mag <= atStop + 1 && s.mag < wstat(s, 'mag') && restOk(Arms.gun), 'Trench : un tir arrête le chargement après la cartouche en cours', { mag: s.mag, atStop });
      // réarmements : culasse à levier (Kar98k) et pompe (Trench), finis avant le tir suivant
      const cyc = {};
      for (const id of ['kar98k', 'trench']) {
        __zs.give(id, 0); step(40);
        s = curSlot(); s.mag = 3;
        fireWeapon(s);
        const had = !!Arms.cyc;
        n = 0;
        while (Arms.cyc && n < 200) { step(1); n++; }
        cyc[id] = { had, done: !Arms.cyc && G.time <= Arms.nextFire + 0.02, rest: restOk(Arms.gun) };
      }
      ok(Object.values(cyc).every((c) => c.had && c.done && c.rest), 'Kar98k : levier manœuvré à chaque tir ; Trench : coup de pompe ; fini avant le tir suivant', cyc);
      // Kar98k : lame-chargeur à vide, cartouche par cartouche sinon
      __zs.give('kar98k', 0); step(40);
      s = curSlot(); s.mag = 0; s.res = 50; startReload();
      const segE = Arms.rl.c.seg.map((g) => g.name).join();
      while (Arms.state === 'reload') step(1);
      s.mag = 2; startReload();
      const segT = Arms.rl.c.seg.map((g) => g.name).join();
      while (Arms.state === 'reload') step(1);
      ok(segE === 'start,clip,end' && segT === 'start,one,one,one,end' && s.mag === 5, 'Kar98k : lame-chargeur à vide, trois cartouches une à une sinon', { segE, segT, mag: s.mag });
      // changement d'arme pendant le rechargement : pas de munitions, pièces remises
      __zs.give('thompson', 0); step(40);
      __zs.give('mp40', 0); step(40);
      s = curSlot(); s.mag = 0; s.res = 99; startReload();
      step(30);
      requestSwap(1 - Arms.cur);
      step(60);
      requestSwap(1 - Arms.cur);
      step(60);
      ok(s.mag === 0 && Arms.state === 'idle' && !Arms.rl && restOk(Arms.gun), 'rechargement interrompu par un changement d’arme : chargeur toujours vide, arme remise en état', { mag: s.mag, st: Arms.state });
      // main gauche sur le chargeur pendant l'insertion (MP40)
      s.mag = 5; startReload();
      const T = Arms.rl.c.ev.find((e) => e[1] === 'ammo')[0];
      n = 0;
      while (Arms.rl && Arms.rl.t < T - 0.02 && n < 400) { step(1); n++; }
      const mag = Arms.gun.userData.parts.mag;
      mag.updateMatrixWorld(true);
      const d = Arms.armL.hand.wrist.position.distanceTo(new THREE.Vector3().setFromMatrixPosition(mag.matrixWorld));
      ok(d < 0.2 && Arms.armL.root.visible, 'la main gauche tient le chargeur quand il s’engage', +d.toFixed(3));
      while (Arms.state === 'reload') step(1);
      // pistolets d'une main : la main gauche, hors champ au repos, vient engager le chargeur (ou la cellule) puis repart
      const pist = {};
      for (const id of ['m1911', 'raygun']) {
        __zs.give(id, 0); step(40);
        const idle = Arms.armL.root.visible;
        s = curSlot(); s.mag = 1; s.res = 99; startReload();
        const TA = Arms.rl.c.ev.find((e) => e[1] === 'ammo')[0];
        n = 0;
        while (Arms.rl && Arms.rl.t < TA - 0.02 && n < 400) { step(1); n++; }
        const m = Arms.gun.userData.parts.mag; m.updateMatrixWorld(true);
        const dm = Arms.armL.hand.wrist.position.distanceTo(new THREE.Vector3().setFromMatrixPosition(m.matrixWorld)), seen = Arms.armL.root.visible;
        while (Arms.state === 'reload') step(1);
        step(10);
        pist[id] = { idle, seen, d: +dm.toFixed(3), after: Arms.armL.root.visible };
      }
      ok(Object.values(pist).every((p) => !p.idle && p.seen && p.d < 0.2 && !p.after), 'M1911 et Désintégrateur : main gauche absente au repos, elle engage le chargeur (la cellule) puis repart', pist);
      // présentoirs : boîte mystère et Glas
      const sizes = {};
      for (const id of ids) {
        boxShow(id);
        const b = new THREE.Box3().setFromObject(Features.box.display).getSize(new THREE.Vector3());
        sizes[id] = +Math.max(b.x, b.y, b.z).toFixed(2);
      }
      boxShow(null);
      ok(Object.values(sizes).every((x) => x <= 1.0), 'boîte mystère : chaque arme tient dans la boîte', sizes);
      return out;
    });
    res.forEach(report);
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Armes : modèles, mains, visée et rechargements conformes.');
  process.exit(failures ? 1 : 0);
})();
