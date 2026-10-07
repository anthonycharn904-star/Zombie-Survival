'use strict';
/* Élixirs (jeu 1.8.0) : les cinq machines d'atouts de la planche d'Anthony dans la fenêtre du jeu du
   launcher. Couleurs de la planche (noms inchangés), gabarits, place sur Bunker 7, cases fermées,
   point d'achat, lumières (deux réservées aux machines), éteintes sans courant puis réveillées,
   animation de consommation de chaque machine (fiole qui part et revient à 2,6 s, déroulés des
   planches 07 à 11, sons), fiole et gourde dans la main, éclats posés sur les marches, retrait de
   Quick Revive, avertissements des Mod Tools, machine réduite sous un plafond bas, pas d'erreur.
     xvfb-run -a node e2e/elixirs.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-elixirs-'));
const USER = path.join(TMP, 'joueur');

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

    // ------------------------------------------------- couleurs et gabarits de la planche
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const glow = { souffle: '#a8f0e4', cuirasse: '#ff6a4d', endurance: '#a8ee7e', mainleste: '#b4a6ff', detente: '#ffb061' };
      ok(Object.keys(glow).every((id) => PERKS[id].glow === glow[id]), 'couleurs de la planche : turquoise, rouge, vert, violet, orange', Object.keys(glow).map((id) => PERKS[id].glow));
      const names = { cuirasse: 'Mastodonte', mainleste: 'Rechargement rapide', detente: 'Double coup', souffle: 'Quick Revive', endurance: 'Staminup' };
      ok(Object.keys(names).every((id) => PERKS[id].name === names[id]), 'noms des atouts inchangés');
      const E = ELIXIRS, g = (id) => [E[id].h, E[id].w, E[id].d, E[id].vialY].join(' ');
      ok(g('souffle') === '3.4 1.3 1.3 0.75' && g('cuirasse') === '2.8 1.2 0.8 1.05' && g('endurance') === '2.5 1.9 1 1' && g('mainleste') === '2.4 1.7 0.9 0.9' && g('detente') === '2.7 1.3 0.8 1.1',
        'gabarits de la planche : Lazare 3,4 m, Cuirasse 2,8, Pèlerin 2,5 × 1,9, Vif-Argent 2,4 × 1,7, Toccata 2,7');
      ok(E.souffle.key === 'lazare' && E.cuirasse.key === 'cuirasse' && E.endurance.key === 'pelerin' && E.mainleste.key === 'vifargent' && E.detente.key === 'toccata',
        'une machine par atout : Lazare, Cuirasse, Pèlerin, Vif-Argent, Toccata');
      ok(E.souffle.motto === 'VENI · FORAS' && E.cuirasse.motto === 'NON CEDAM' && E.endurance.motto === 'ULTREIA' && E.mainleste.motto === 'SOLVE ET COAGULA' && E.detente.motto === 'PRESTO', 'devises gravées de la planche');
      return out;
    })).forEach(report);

    // ------------------------------------------------- Bunker 7 : place, gabarit mesuré, cases, lumières
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      window.__realUpdate = update;
      window.update = function (dt) { if (!window.__hold) window.__realUpdate(dt); };
      window.__hold = true;
      window.__run = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { __realUpdate(1 / 60); endFrameInput(); } };
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9;
      __run(0.3);
      const M = Features.perkMachines, byId = Object.fromEntries(M.map((m) => [m.id, m]));
      ok(M.length === 5 && M.every((m) => m.key === ELIXIRS[m.id].key && m.s === 1), 'Bunker 7 : cinq machines de la planche, taille réelle', M.map((m) => [m.id, m.key, m.s]));
      const pl = BUNKER7.perks.every((p) => { const m = byId[p.p]; return m.cell[0] === p.cell[0] && m.cell[1] === p.cell[1] && Math.abs(m.group.rotation.y - Math.atan2(p.face[0], p.face[1])) < 1e-6; });
      ok(pl, 'chaque machine sur la case de l’ancien distributeur, tournée vers la pièce');
      // gabarit mesuré (pièces opaques), repère de la machine : largeur le long du mur, profondeur depuis le mur
      const dims = {};
      for (const m of M) {
        const box = new THREE.Box3(), inv = new THREE.Matrix4().copy(m.group.matrixWorld).invert();
        m.group.updateMatrixWorld(true);
        m.group.traverseVisible((o) => {
          if (!o.isMesh || o.isInstancedMesh || (o.material.transparent && o.material.blending === THREE.AdditiveBlending) || o === m.parts.ring) return;
          const b = new THREE.Box3().setFromObject(o);
          for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
        });
        const sz = box.getSize(new THREE.Vector3());
        dims[m.id] = [sz.x, sz.y, box.max.z].map((v) => Math.round(v * 100) / 100);
      }
      const fits = Object.entries(dims).every(([id, [w, h, d]]) => { const E = ELIXIRS[id]; return Math.abs(h - E.h) < 0.12 && Math.abs(w - E.w) < 0.2 && Math.abs(d - E.d) < 0.2; });
      ok(fits, 'gabarits mesurés : hauteur à 12 cm près, largeur et profondeur à 20 cm près', dims);
      ok(dims.souffle[1] < WALL_H, 'Lazare (3,4 m) tient sous le plafond de 3,5 m', dims.souffle);
      // cases fermées : celle de la machine (jusqu'à sa hauteur), les voisines quand elle déborde de 0,3 m
      const k = (m, x, z) => node(m.li, x, z);
      const pel = byId.endurance, vif = byId.mainleste, laz = byId.souffle;
      ok(grid[k(laz, 17, 14)] === T.PROP && Math.abs(solidTop[k(laz, 17, 14)] - 3.4) < 1e-6 && grid[k(laz, 18, 14)] === T.FLOOR && grid[k(laz, 17, 13)] === T.FLOOR,
        'Lazare : sa case fermée jusqu’à 3,4 m ; marches qui débordent de 0,3 m, cases voisines libres');
      ok(pel.side.length === 2 && pel.side.every(([x, z]) => grid[k(pel, x, z)] === T.PROP && Math.abs(solidTop[k(pel, x, z)] - 0.7) < 1e-6), 'Pèlerin (1,9 m) : les deux cases voisines fermées sous le bassin (0,7 m)', pel.side);
      ok(vif.side.length === 2 && Math.abs(solidTop[k(vif, vif.side[0][0], vif.side[0][1])] - 1.75) < 1e-6 && Math.abs(solidTop[k(vif, vif.side[1][0], vif.side[1][1])] - 0.6) < 1e-6,
        'Vif-Argent (1,7 m) : condenseur à droite (1,75 m), soufflet à gauche (0,6 m)', vif.side);
      // point d'achat : devant la machine
      const its = Features.interactables.filter((i) => i.kind === 'perk');
      const front = its.every((it) => { const m = it.machine, g = m.group, d = Math.hypot(it.x - g.position.x, it.z - g.position.z); return Math.abs(d - (ELIXIRS[m.id].d + 0.5)) < 1e-6; });
      ok(its.length === 5 && front, 'point d’achat à 0,5 m devant chaque machine');
      // lumières : deux réservées aux machines, 16 lumières ponctuelles en tout sur Bunker 7
      let lights = 0; scene.traverse((o) => { if (o.isPointLight) lights++; });
      ok(ElixirLights.lights.length === 2 && lights === 16, 'deux lumières pour les cinq machines (16 lumières ponctuelles sur Bunker 7)', { pool: ElixirLights.lights.length, lights });
      // sans courant : Quick Revive allumée (pas besoin de courant), les autres éteintes
      ok(laz.lit && laz.litK === 1 && laz.lightI > 1 && M.filter((m) => m.id !== 'souffle').every((m) => !m.lit && m.litK === 0 && m.lightI === 0), 'sans courant : Lazare (Quick Revive) allumée, les quatre autres éteintes');
      ok(!pel.parts.stream.visible && !vif.parts.flames[0].visible && byId.cuirasse.parts.flame.visible === false, 'éteintes : la source est tarie, pas de flamme dans le four ni au col de l’armure');
      const items = byId.detente;
      const pr = Features.interactables.find((i) => i.machine === items).prompt();
      ok(pr && pr.text === "Il faut d'abord rétablir le courant" && pr.disabled, 'Toccata sans courant : « Il faut d’abord rétablir le courant »', pr);
      __zs.power();
      __run(1.3);
      const first = byId.mainleste.litK, later = byId.cuirasse.litK;
      __run(3);
      ok(M.every((m) => m.lit && m.litK === 1 && m.lightI > 0.3) && first > 0 && first < 1 && later === 0, 'courant rétabli : les machines s’éveillent l’une après l’autre (en 0,8 s chacune)', { first, later, k: M.map((m) => m.litK) });
      ok(pel.parts.stream.visible && vif.parts.flames.every((f) => f.visible) && byId.cuirasse.parts.flame.visible, 'allumées : la source coule, flammes froides, lueur du col');
      // couleurs dans le HUD : icône de la teinte foncée, halo de la lueur
      player.perks.add('endurance'); HUD.perks();
      const ic = document.querySelector('#perks .perk');
      ok(ic && ic.style.getPropertyValue('--perk') === PERKS.endurance.color && ic.style.getPropertyValue('--perk-glow') === PERKS.endurance.glow, 'HUD : icône de Staminup verte (couleur de Pèlerin)', ic && ic.getAttribute('style'));
      player.perks.clear(); HUD.perks();
      return out;
    })).forEach(report);

    // ------------------------------------------------- animations de consommation (planches 07 à 11)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const calls = {};
      for (const k of ['elixir', 'elixirClang', 'elixirKnock', 'elixirFelt', 'elixirBellows', 'elixirTick', 'elixirShot']) {
        const f = Sound[k];
        Sound[k] = (...a) => { (calls[k] = calls[k] || []).push(a[0]); return f(...a); };
      }
      G.cheat = true;
      const byId = Object.fromEntries(Features.perkMachines.map((m) => [m.id, m]));
      const buy = (id) => {
        const m = byId[id], it = Features.interactables.find((i) => i.machine === m), g = m.group;
        __zs.tp(it.x, it.z, Math.atan2(-(g.position.x - it.x), -(g.position.z - it.z)));
        player.perks.clear();
        __run(0.2);
        Arms.state = 'idle';
        it.use();
        return m;
      };
      const at = (m, T) => { let n = 0; while (m.act >= 0 && m.act < T - 1e-6 && n < 400) { __realUpdate(Math.min(1 / 60, T - m.act)); endFrameInput(); n++; } };
      // Lazare : « L'âme est rappelée »
      let m = buy('souffle'); const L = m.parts;
      ok(m.act === 0 && calls.elixir && calls.elixir.slice(-1)[0] === 'lazare', 'Lazare : l’achat lance l’animation et son son');
      at(m, 0.1);
      const gone = !m.vial.visible;
      at(m, 0.3);
      const lFirst = L.letters[0].material.opacity, lLast = L.letters[L.letters.length - 1].material.opacity;
      at(m, 0.62);
      const lAll = L.letters.every((l) => l.material.opacity > 0.9);
      ok(gone && lFirst > lLast + 0.2 && lAll, 'Lazare : la fiole s’efface ; la lueur passe sur VENI · FORAS lettre après lettre', { lFirst, lLast });
      ok(L.ring.visible && L.beam.visible && m.medal.emissiveIntensity > 1, 'Lazare : onde turquoise au pied, faisceau, médaillon allumé (0,6 s)');
      at(m, 0.8); const y1 = L.spirit.position.y;
      at(m, 1.2); const y2 = L.spirit.position.y;
      ok(L.spirit.visible && y2 > y1 && Math.abs(L.beam.scale.y - (WALL_H - 2.47)) < 0.05 && L.splash.visible, 'Lazare : l’âme monte le long du faisceau, qui touche le plafond', { y1, y2, beam: L.beam.scale.y });
      at(m, 1.4);
      ok(!L.spirit.visible && FX.motes.active && L.wisps.every((w) => w.visible), 'Lazare : l’âme éclate en particules, trois feux follets autour du fût');
      at(m, 2.55); const before = m.vial.visible;
      at(m, 2.8);
      ok(!before && m.vial.visible && m.vial.scale.x > 0.99, 'Lazare : la fiole réapparaît dans la niche à 2,6 s');
      __run(0.6);
      ok(m.act < 0 && !L.beam.visible, 'Lazare : fin de l’animation');
      // Cuirasse : « Le cœur s'emballe »
      m = buy('cuirasse'); const C = m.parts;
      at(m, 0.05); const beat = m.lightI;
      at(m, 0.22); const between = m.lightI;
      at(m, 0.4); const ring = C.ring.visible;
      at(m, 0.55); const h0 = C.halberds.map((h) => h.pivot.position.clone());
      at(m, 0.7); const h1 = C.halberds.map((h) => h.pivot.position.clone());
      ok(beat > between * 1.6 && ring, 'Cuirasse : double battement du cœur (lumière ×6), onde rouge au pied du socle', { beat, between });
      ok(h0[0].distanceTo(h1[0]) > 0.02 && h0[1].distanceTo(h1[1]) > 0.02, 'Cuirasse : les hallebardes pilonnent, en alternance');
      at(m, 1.0);
      ok(C.flame.scale.y > 2.6 && FX.embers.active, 'Cuirasse : colonne de feu (cône ×2,8) et braises', C.flame.scale.y);
      at(m, 2.7);
      ok(m.vial.visible && (calls.elixirClang || []).length === 8, 'Cuirasse : huit coups de hallebarde, la fiole se matérialise à 2,6 s', (calls.elixirClang || []).length);
      __run(0.6);
      // Pèlerin : « En route ! »
      m = buy('endurance'); const P = m.parts;
      at(m, 0.6);
      ok(P.stream.scale.x > 2.9 && P.ripples.some((r) => r.visible) && P.shellMat.opacity > 0.5, 'Pèlerin : la source jaillit (filet ×3), le bassin ondule, la coquille s’illumine', P.stream.scale.x);
      at(m, 0.85); const lift = P.staff.position.y - P.staffRest.y;
      at(m, 1.5); const hatUp = P.hat.position.y - P.hatRest.y;
      ok(lift > 0.02 && hatUp > 0.1 && (calls.elixirKnock || []).length === 2, 'Pèlerin : le bourdon frappe deux fois, le chapeau saute', { lift, hatUp });
      at(m, 2.0);
      ok(Math.abs(P.hat.position.y - P.hatRest.y) < 0.03 && (calls.elixirFelt || []).length >= 1, 'Pèlerin : le chapeau retombe sur le pommeau');
      at(m, 2.7);
      ok(m.vial.visible && m.vial.userData.shape.kind === 'gourd', 'Pèlerin : une nouvelle gourde apparaît');
      __run(0.6);
      // Vif-Argent : « Mains vives »
      m = buy('mainleste'); const V = m.parts;
      at(m, 0.4); const sq = V.bellows.scale.y;
      at(m, 0.75); const needle = V.needle.rotation.z;
      ok(Math.abs(sq - 0.55) < 0.03 && Math.abs(needle - (2.2 - (80 * Math.PI) / 180)) < 0.25, 'Vif-Argent : le soufflet pompe (×0,55), l’aiguille du manomètre bondit à 80°', { sq, needle });
      at(m, 0.9); const coil = V.coilMat.emissiveIntensity;
      at(m, 1.9); const fill = m.vial.visible && m.vial.userData.liquid.scale.y < m.vial.userData.shape.liquidH * 0.5;
      at(m, 2.1);
      const turns = (V.mercury.rotation.y - m.spin0) / (2 * Math.PI);
      ok(coil > 1 && Math.abs(turns - 3) < 0.01 && V.symMat.emissiveIntensity > 1 && fill, 'Vif-Argent : étincelle dans le serpentin, globe qui fait trois tours, symbole allumé, fiole qui se remplit', { coil, turns });
      at(m, 2.7);
      ok(m.vial.userData.liquid.scale.y === m.vial.userData.shape.liquidH && (calls.elixirBellows || []).length === 3 && (calls.elixirTick || []).length === 1, 'Vif-Argent : fiole pleine, trois souffles de forge, cliquetis d’aiguille');
      __run(0.6);
      // Toccata : « Feu à volonté »
      m = buy('detente'); const O = m.parts;
      at(m, 0.55); const flash = O.flashes[0].visible;
      at(m, 1.0);
      const pressed = (() => { const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(); let n = 0; for (let i = 0; i < O.keyRest.length; i++) { O.keys.getMatrixAt(i, mtx); mtx.decompose(p, q, s); if (Math.abs(new THREE.Euler().setFromQuaternion(q).x) > 0.02) n++; } return n; })();
      ok(flash && pressed > 0, 'Toccata : les trompettes tirent, une toccata se joue (touches enfoncées en vague)', pressed);
      at(m, 1.6);
      ok(FX.rumbleT > 0 && FX.rumbleA === 0.01, 'Toccata : le buffet tremble (secousse de caméra de 1 cm)');
      at(m, 2.12);
      ok(m.medal.emissiveIntensity > 2, 'Toccata : le médaillon s’embrase', m.medal.emissiveIntensity);
      at(m, 2.7);
      ok(m.vial.visible && (calls.elixirShot || []).length === 14, 'Toccata : quatorze tirs (sept de gauche à droite, sept au retour), nouvelle fiole', (calls.elixirShot || []).length);
      __run(0.6);
      ok(Features.perkMachines.every((mm) => mm.act < 0 && mm.vial.visible), 'toutes les animations terminées, fioles en place');
      return out;
    })).forEach(report);

    // ------------------------------------------------- fiole et gourde dans la main, éclats sur les marches
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const byId = Object.fromEntries(Features.perkMachines.map((m) => [m.id, m]));
      const it = Features.interactables.find((i) => i.machine === byId.endurance);
      __zs.tp(it.x, it.z, 0); player.perks.clear(); Arms.state = 'idle';
      it.use();
      __run(0.5);
      const B = Arms.bottle;
      ok(B.visible && B.userData.shape.kind === 'gourd' && B.userData.cord.visible && B.userData.label.material.map === TEX.bottleLabel.endurance, 'Staminup : la gourde de Pèlerin dans la main (cordon, étiquette)');
      __run(2.6);
      // fiole lancée sur les marches de Lazare : les éclats se posent sur la marche
      const laz = byId.souffle, g = laz.group, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
      FX.glass.list.length = 0;
      const x = g.position.x + fx * 1.2 + fz * 0.3, z = g.position.z + fz * 1.2 - fx * 0.3;
      throwBottle('souffle', x, 0.9, z, 0, -1, 0);
      __run(8);
      const on = FX.glass.list.filter((e) => machineAt(e.x, e.z, e.y) === laz);
      ok(on.length > 0 && on.every((e) => !inMachine(laz, e.x, e.y, e.z, -0.01)), 'éclats tombés sur les marches de Lazare : posés dessus, pas dedans', { n: on.length });
      return out;
    })).forEach(report);

    // ------------------------------------------------- Quick Revive retirée : Lazare s'enfonce
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const laz = Features.perkMachines.find((m) => m.id === 'souffle'), k = node(laz.li, 17, 14);
      Features.retireSouffle();
      __run(1.2);
      const mid = laz.group.position.y;
      __run(1.6);
      ok(laz.deep && mid < -0.5 && !laz.group.visible && grid[k] === T.FLOOR, 'Quick Revive retirée : Lazare s’enfonce tout entier dans le sol, sa case se rouvre', { mid });
      resetFeatures();
      ok(laz.group.visible && laz.group.position.y === laz.E && grid[k] === T.PROP && laz.vial.visible, 'nouvelle partie : Lazare revient, case fermée');
      return out;
    })).forEach(report);

    // ------------------------------------------------- Mod Tools : avertissements ; plafond bas
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const v0 = validateMap(normalizeMap(BUNKER7));
      ok(!v0.warnings.some((p) => /distributeur/i.test(p.msg)), 'Bunker 7 : aucun avertissement sur les distributeurs', v0.warnings.map((p) => p.msg));
      const a = JSON.parse(JSON.stringify(BUNKER7)); a.id = 'pelerin-coin';
      a.perks = a.perks.map((p) => (p.p === 'endurance' ? { p: 'endurance', cell: [39, 4], face: [-1, 0] } : p));
      const va = validateMap(normalizeMap(a));
      ok(va.warnings.some((p) => /Staminup \(Pèlerin, 1,9 m de large\) a besoin de sol libre de chaque côté/.test(p.msg)), 'Mod Tools : Pèlerin dans un coin → « a besoin de sol libre de chaque côté »', va.warnings.map((p) => p.msg));
      const b = JSON.parse(JSON.stringify(BUNKER7)); b.id = 'lazare-bas'; b.ambiance.wallHeight = 3.0;
      const vb = validateMap(normalizeMap(b));
      ok(vb.warnings.some((p) => /Quick Revive \(Lazare, 3,4 m de haut\) sera réduit \(×0,87\)/.test(p.msg)), 'Mod Tools : murs de 3 m → « Lazare sera réduit (×0,87) »', vb.warnings.map((p) => p.msg));
      window.update = window.__realUpdate; window.__hold = false;
      clearZombies();
      G.state = 'menu';
      loadMap(normalizeMap(b));
      const laz = Features.perkMachines.find((m) => m.id === 'souffle');
      laz.group.updateMatrixWorld(true);
      const box = new THREE.Box3();
      laz.group.traverseVisible((o) => { if (o.isMesh && !(o.material.transparent && o.material.blending === THREE.AdditiveBlending)) box.expandByObject(o); });
      ok(Math.abs(laz.s - (3.0 - 0.04) / 3.4) < 1e-9 && box.max.y < 3.0, `murs de 3 m : Lazare réduit, ${box.max.y.toFixed(2).replace('.', ',')} m de haut`, { s: laz.s, top: box.max.y });
      loadMap(MAPS.byId.bunker7 || normalizeMap(BUNKER7));
      ok(Features.perkMachines.every((m) => m.s === 1), 'retour à Bunker 7 : taille réelle');
      return out;
    })).forEach(report);

    // ------------------------------------------------- rendu : chaque machine vue de face, programmes compilés
    const diag = await game.evaluate(() => {
      __zs.start();
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.power();
      for (let i = 0; i < 240; i++) { update(1 / 60); endFrameInput(); }
      renderEnabled = true;
      for (const m of Features.perkMachines) {
        const g = m.group, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y), d = ELIXIRS[m.id].d;
        camera.position.set(g.position.x + fx * (d + 2.5), 1.6, g.position.z + fz * (d + 2.5));
        camera.lookAt(g.position.x, 1.4, g.position.z);
        camera.updateMatrixWorld(true);
        renderer.render(scene, camera);
      }
      showScreen('menu');
      return { programs: renderer.info.programs.length, bad: renderer.info.programs.filter((p) => p.diagnostics && !p.diagnostics.runnable).map((p) => p.name) };
    });
    report({ ok: diag.bad.length === 0, label: `rendu : les cinq machines vues de face, ${diag.programs} programmes compilés, aucun en erreur`, extra: diag });
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Élixirs : machines, animations et fioles conformes à la planche.');
  process.exit(failures ? 1 : 0);
})();
