'use strict';
/* Camion des abords de Bunker 7, deuxième easter egg secondaire (jeu 2.0.7, demande d'Anthony du 9 novembre 2026), dans
   la fenêtre du jeu du launcher : camion 3D à la place du modèle simple (abords seulement), derrière la Salle des
   machines, touché depuis sa fenêtre nord ; balles (3 chargeurs de Thompson au palier I), explosifs triples (grenades,
   roquettes, Désintégrateur, balles de la M1911 Ardente) ; roquette qui éclate sur lui, grenade qui rebondit ; fumée à
   50 %, flammes à 25 % ; destruction : bâche arrachée, épave noircie qui brûle 30 s puis fume, « Atout gratuit » et
   « Munitions max » près du joueur ; une fois par partie ; rien pendant le combat du boss ni hors de Bunker 7 ; ni
   lampe ni secousse ; programmes de rendu déjà compilés ; nouvelle partie : camion neuf ; rendu sans erreur.
     xvfb-run -a node e2e/camion.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-camion-'));
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
    // ------------------------------------------------------------ modèle, place, fenêtre
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__cam = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = true; G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
          player.gy = 0; placePlayer(25.5, 4.2);   // Salle des machines, 1,2 m derrière la fenêtre nord (25, 3)
        },
        pas(n) { for (let i = 0; i < n; i++) __zs.step(1, 1 / 60); },
        centre() { return new THREE.Vector3(0, 1.5, 0).applyMatrix4(CAM.mat); },
        tir(c) {
          G.stats.shots++;
          c = c || Q.centre();
          const s = Arms.slots[Arms.cur], ex = player.pos.x, ey = player.gy + PLAYER_EYE, ez = player.pos.z;
          let dx = c.x - ex, dy = c.y - ey, dz = c.z - ez; const L = Math.hypot(dx, dy, dz);
          hitscan(s, ex, ey, ez, dx / L, dy / L, dz / L, { x: ex, y: ey, z: ez });
        },
        // état des lampes : nombre de lampes affichées de chaque sorte (lampes éteintes de HC-boss-lampes.js comprises)
        lampes() { const n = {}; scene.traverseVisible((o) => { if (o.isLight) n[o.type] = (n[o.type] || 0) + 1; }); return JSON.stringify(n); },
        liens: 0,
      };
      const gl = renderer.getContext(), lp0 = gl.linkProgram.bind(gl);
      gl.linkProgram = (p) => { Q.liens++; return lp0(p); };
      Q.partie(); Q.pas(3);
      const lib = modelParts('truck_wreck');
      ok(CAM.camions.length >= 1 && CAM.cible && CAM.racine && CAM.racine.parent === OUTSKIRTS.group && lib && lib.parts.length > 8,
        `camion 3D dans les abords (${CAM.camions.length} camion(s)) ; le modèle simple reste dans la bibliothèque des Mod Tools`);
      const zm = LAYOUT.zones.findIndex((z) => z.name === 'Salle des machines'), c = Q.centre();
      const fen = World.windows.filter((w) => w.zone === zm).filter((w) => {
        const ex = w.x + 0.5 - w.nx * 1.0, ez = w.z + 0.5 - w.nz * 1.0, ey = PLAYER_EYE;
        let dx = c.x - ex, dy = c.y - ey, dz = c.z - ez; const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
        raycast(ex, ey, ez, dx, dy, dz, 140);
        const t = camRayon(ex, ey, ez, dx, dy, dz, 140);
        return t > 0 && (!RAY.hit || RAY.t > t);
      });
      ok(fen.length >= 1 && camActif(), `derrière la Salle des machines : touché depuis ${fen.length} fenêtre(s) (à ${Math.hypot(c.x - 25.5, c.z - 3.5).toFixed(0)} m)`);
      let n = 0; CAM.racine.traverse((o) => { if (o.isMesh) n++; });
      ok(n >= 6 && CAM.bache.visible && CAM.vitres.visible && CAM.etat === 'neuf', `camion neuf : ${n} maillages (carrosserie, bâche, vitres)`);
      Q.l0 = Q.lampes();
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ dégâts
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__cam;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      activatePower(); __zs.openAll(); Q.pas(30);
      __zs.give('thompson', 1); Q.pas(40);
      const c = Q.centre(), s = Arms.slots[Arms.cur];
      let d0 = CAM.degats; Q.tir(); const balle = CAM.degats - d0;
      const chargeurs = CAM.pv / (balle * wstat(s, 'mag'));
      ok(balle > 0 && Math.abs(chargeurs - 3) < 0.15, `Thompson au palier I : ${balle.toFixed(0)} par balle, ${chargeurs.toFixed(2)} chargeurs pour le détruire`);
      camRemettre();
      Q.tir({ x: c.x + 6, y: c.y, z: c.z }); ok(CAM.degats === 0, 'tir à côté : rien');
      // grenades (manche 10) au pied du camion
      let g = 0; while (!CAM.fait && g < 10) { explode(c.x + 1.2, 0.2, c.z, 4.5, 300 + 10 * 90, { src: 'grenade' }); g++; }
      ok(CAM.fait && g === 4, `grenades (manche 10) au pied du camion : détruit en ${g}`);
      camRemettre();
      // roquette tirée de la fenêtre : elle éclate sur le camion
      __zs.give('panzer', 0); Q.pas(40);
      const ex = player.pos.x, ey = PLAYER_EYE, ez = player.pos.z; let dx = c.x - ex, dy = c.y - ey, dz = c.z - ez; const L = Math.hypot(dx, dy, dz);
      fireProjectile(WEAPONS.panzer.proj, ex, ey, ez, dx / L, dy / L, dz / L, Arms.slots[Arms.cur]);
      Q.pas(60);
      const roq = CAM.degats;
      fireProjectile(WEAPONS.panzer.proj, ex, ey, ez, dx / L, dy / L, dz / L, Arms.slots[Arms.cur]);
      Q.pas(60);
      ok(roq >= CAM.pv * 0.5 && CAM.fait, `roquettes : elles éclatent sur le camion (${roq.toFixed(0)} chacune), détruit en 2`);
      camRemettre();
      // Désintégrateur
      let r = 0; while (!CAM.fait && r < 6) { fireProjectile(WEAPONS.raygun.proj, ex, ey, ez, dx / L, dy / L, dz / L, null); Q.pas(40); r++; }
      ok(CAM.fait && r === 3, `Désintégrateur : détruit en ${r} tirs`);
      camRemettre();
      // grenade lancée contre le camion : elle rebondit (ne le traverse pas)
      const g0 = new THREE.Vector3(0, 1.0, 4.5).applyMatrix4(CAM.mat), g1 = Q.centre();
      const gr = { x: g0.x, y: g0.y, z: g0.z, vx: (g1.x - g0.x) * 3, vy: 0, vz: (g1.z - g0.z) * 3 };
      for (let i = 0; i < 40; i++) { gr.x += gr.vx / 60; gr.z += gr.vz / 60; camGrenade(gr); }
      const loc = new THREE.Vector3(gr.x, gr.y, gr.z).applyMatrix4(CAM.inv);
      ok(loc.z > 3.6, 'grenade lancée contre le camion : elle rebondit sur l’avant', { z: loc.z });
      // Onde de choc de l'intérieur, face au mur (pas à la fenêtre) : rien ; par la fenêtre : il encaisse
      const bl = wstat({ id: 'blaster', tier: 0 }, 'blast'), cc = Q.centre();
      const souffle = (x, z) => { const ey = PLAYER_EYE; _fwd.set(cc.x - x, cc.y - ey, cc.z - z).normalize(); const d0 = CAM.degats; camSouffle(x, ey, z, { range: 14, cone: bl.cone }); return CAM.degats - d0; };
      const mur = souffle(29.5, 4.2), fenetre = souffle(25.5, 3.9);
      camRemettre();
      ok(mur === 0 && fenetre > 0, `Onde de choc : rien à travers le mur, ${fenetre.toFixed(0)} par la fenêtre`, { mur, fenetre });
      // pendant le combat du boss, hors de Bunker 7 : rien
      const a0 = B7.actif; B7.actif = true; Q.tir(); B7.actif = a0;
      const m0 = G.mapId; G.mapId = 'autre'; const ailleurs = !camActif(); G.mapId = m0;
      ok(CAM.degats === 0 && ailleurs, 'pendant le combat du boss et hors de Bunker 7 : rien');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ qualité « basse » : même camion, même place
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__cam, q0 = settings.quality, avant = [CAM.cible.x, CAM.cible.z];
      try {
        settings.quality = 'low'; Q.partie(); Q.pas(3);
        const c = Q.centre();
        ok(CAM.cible && Math.hypot(CAM.cible.x - avant[0], CAM.cible.z - avant[1]) < 0.01 && camActif() && Math.hypot(c.x - 25.5, c.z - 3.5) < 16,
          `qualité « basse » : le camion à la même place (${CAM.cible.ajoute ? 'posé par l’easter egg' : 'celui des abords'})`);
      } finally { settings.quality = q0; Q.partie(); Q.pas(3); }
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ fumée, flammes, destruction, récompense
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__cam;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      clearPowerups(); camRemettre();
      __zs.give('thompson', 2); Q.pas(40);
      for (let i = 0; i < 3; i++) { renderEnabled = true; render(); renderEnabled = false; Q.pas(1); }   // le monde déjà dessiné
      const liens0 = Q.liens;
      CAM.degats = CAM.pv * 0.495; Q.tir(); Q.pas(90);
      const fume = CAM.etat === 'fume' && CAM.sprites.L.some((p) => p.life > 0 && !p.add);
      CAM.degats = CAM.pv * 0.745; Q.tir(); Q.pas(60);
      renderEnabled = true; render(); renderEnabled = false;
      const flammes = CAM.etat === 'flammes' && CAM.sprites.L.some((p) => p.life > 0 && p.add) && CAM.sprites.lueur.visible;
      ok(fume && flammes, 'à 50 % il fume, à 25 % des flammes sortent du capot');
      const secrets = []; const sd0 = window.secretDecouvert; window.secretDecouvert = (id) => secrets.push(id);
      let shake = 0;
      try {
        CAM.degats = CAM.pv - 10; Q.tir();
        for (let i = 0; i < 60; i++) { __zs.step(1, 1 / 60); shake = Math.max(shake, FX.shake); if (i % 10 === 0) { renderEnabled = true; render(); renderEnabled = false; } }
      } finally { window.secretDecouvert = sd0; }
      const b = Powerups.list.map((p) => ({ type: p.type, x: p.x, z: p.z, life: p.life }));
      const z0 = zoneAt(player.pos.x, player.pos.z, player.gy);
      ok(CAM.fait && CAM.etat === 'detruit' && !CAM.bache.visible && !CAM.vitres.visible && secrets.includes('b7-camion'), 'détruit : explosion, bâche arrachée, vitres brisées ; secret « b7-camion »');
      const noir = CAM.couleurs.every(([a]) => { let m = 0; for (let i = 0; i < a.array.length; i++) m = Math.max(m, a.array[i]); return m < 0.12; });
      ok(noir, 'épave noircie (couleurs des sommets)');
      ok(b.length === 2 && b.some((p) => p.type === 'freeperk') && b.some((p) => p.type === 'ammo') && b.every((p) => zoneAt(p.x, p.z, player.gy) === z0 && p.life <= CAM.vie),
        '« Atout gratuit » et « Munitions max » au sol, près du joueur, dans sa salle', b);
      ok(shake === 0 && Q.lampes() === Q.l0 && Q.liens - liens0 <= 1, `ni secousse ni lampe ajoutée ; ${Q.liens - liens0} programme de rendu compilé`);
      const d1 = CAM.degats; Q.tir(); clearPowerups(); Q.pas(2);
      ok(CAM.degats === d1 && Powerups.list.length === 0, 'tirs sur l’épave : rien (une fois par partie)');
      Q.pas(60 * 10);
      const brule = CAM.sprites.lueur.visible;
      Q.pas(60 * 21);
      ok(brule && !CAM.sprites.lueur.visible && CAM.sprites.L.some((p) => p.life > 0 && !p.add), 'l’épave brûle 30 s, puis fume');
      renderEnabled = true; render(); renderEnabled = false;
      Q.partie(); Q.pas(3);
      const neuf = CAM.couleurs.every(([a, o]) => a.array[0] === o[0] && a.array[a.array.length - 1] === o[o.length - 1]);
      ok(CAM.etat === 'neuf' && !CAM.fait && CAM.degats === 0 && CAM.bache.visible && CAM.vitres.visible && neuf && camActif(), 'nouvelle partie : camion neuf');
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
  console.log(failures ? `${failures} échec(s).` : 'Camion des abords : conforme (modèle, fenêtre, armes, fumée et feu, destruction, récompense, remise à zéro).');
  process.exit(failures ? 1 : 0);
})();
