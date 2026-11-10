'use strict';
/* Têtes de zombie au béret de Bunker 7, cinquième easter egg secondaire (jeu 2.0.7, demande d'Anthony du 9 novembre 2026),
   dans la fenêtre du jeu du launcher : le modèle d'Anthony (TETE_BERET_GLB) chargé, trois têtes posées (toit du wagon de la
   gare face à l'horloge, socle de Quick Revive, cadre de l'ouverture au-dessus du Glas), couleurs justes, légèrement
   lumineuses ; chacune touchée par une balle depuis l'intérieur du bunker (le wagon par la fenêtre sud de la Salle
   d'arrivée) : son, elle disparaît ; à côté, rien ; les trois : « Atout gratuit » et « Munitions max » près du joueur ;
   une fois par partie ; rien pendant le combat du boss ; ni lampe ajoutée ; nouvelle partie : trois têtes neuves.
     xvfb-run -a node e2e/tetes.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-tetes-'));
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
    // une partie sur Bunker 7 : le modèle se décode (GLTFLoader, asynchrone) avant le bloc suivant
    await game.evaluate(() => {
      __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
    });
    await game.waitForFunction(() => typeof TB === 'object' && TB.tetes.length === 3, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    const res = [];
    const report = (r) => res.push(r);
    // ------------------------------------------------------------ têtes, tirs, récompense
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__tb = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = true; G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies(); player.gy = 0;
        },
        pas(n) { for (let i = 0; i < n; i++) __zs.step(1, 1 / 60); },
        tir(t, off = [0, 0, 0]) {
          G.stats.shots++;
          const s = Arms.slots[Arms.cur], ex = player.pos.x, ey = player.gy + PLAYER_EYE, ez = player.pos.z;
          let dx = t.cx + off[0] - ex, dy = t.cy + off[1] - ey, dz = t.cz + off[2] - ez; const L = Math.hypot(dx, dy, dz);
          hitscan(s, ex, ey, ez, dx / L, dy / L, dz / L, { x: ex, y: ey, z: ez });
        },
        lampes() { const n = {}; scene.traverseVisible((o) => { if (o.isLight) n[o.type] = (n[o.type] || 0) + 1; }); return JSON.stringify(n); },
      };
      Q.partie(); Q.pas(3);
      const noms = TB.tetes.map((t) => t.nom).join();
      ok(TB.tetes.length === 3 && noms === 'wagon,quick-revive,glas' && TB.tetes.every((t) => t.g.visible && t.g.parent === TB.groupe) && TB.groupe.parent === World.root,
        `trois têtes posées (${noms}) avec le monde`);
      const st = World.outskirts.buildings.find((b) => b.id === 'ruin_station'), w = TB.tetes[0];
      ok(Math.hypot(w.cx - HORL.cx, w.cz - HORL.cz) < 7 && w.cy > 3.5, `la première sur le toit du wagon, face à l'horloge (à ${Math.hypot(w.cx - HORL.cx, w.cz - HORL.cz).toFixed(1)} m d'elle)`);
      // couleurs : celles du fichier (pas de blanc saturé), béret rouge sombre
      const C = TB.geo.attributes.color.array; let maxi = 0; for (let i = 0; i < C.length; i++) maxi = Math.max(maxi, C[i]);
      // la couleur la plus claire du fichier (reflet des yeux, 225 sur 255, en sRGB) : 0,753 une fois convertie (0,88 sans)
      ok(Math.abs(maxi - 0.753) < 0.02 && TB.mat.vertexColors && TB.mat.emissive.getHex() !== 0, `couleurs des sommets du modèle, converties une fois (la plus claire : ${maxi.toFixed(3)}), un peu d'émission`);
      Q.l0 = Q.lampes();
      __zs.give('thompson', 0); Q.pas(40);
      // à côté : rien ; pendant le combat du boss : rien
      placePlayer(25.5, 26.2); Q.pas(2);
      Q.tir(w, [0.8, 0, 0]);
      const a0 = B7.actif; B7.actif = true; Q.tir(w); B7.actif = a0;
      ok(!w.touchee && w.g.visible, 'tir à 80 cm de la tête, et pendant le combat du boss : rien');
      // le wagon, par la fenêtre sud de la Salle d'arrivée
      const sons = []; const s0 = window.tbSon; window.tbSon = function (t, n) { sons.push(n); return s0.apply(this, arguments); };
      const secrets = []; const sd0 = window.secretDecouvert; window.secretDecouvert = (id) => secrets.push(id);
      clearPowerups();
      let sh = 0;
      try {
        Q.tir(w); Q.pas(2);
        ok(w.touchee && !w.g.visible && sons.join() === '1', `la tête du wagon, de la fenêtre sud de la Salle d'arrivée (${Math.hypot(w.cx - player.pos.x, w.cz - player.pos.z).toFixed(0)} m) : un petit son, elle disparaît`);
        Q.tir(w); ok(sons.length === 1, 'retouchée : rien');
        // Quick Revive (dans la case pleine de la machine) et le Glas
        const qr = TB.tetes[1], gl = TB.tetes[2];
        activatePower(); __zs.openAll(); Q.pas(30);
        // à travers un mur : rien (depuis l'Infirmerie, de l'autre côté du mur de la machine ; depuis l'est des Machines, sous le plafond)
        placePlayer(qr.cx - 2.6, qr.cz); Q.pas(2); Q.tir(qr);
        placePlayer(gl.cx + 5, gl.cz + 1.5); Q.pas(2); Q.tir(gl);
        ok(!qr.touchee && !gl.touchee && sons.length === 1, 'à travers un mur, ou sous le plafond : rien');
        // la machine de Quick Revive retirée (troisième relève, en solo) : la tête tombe au sol et reste à tirer
        qr.m.sinkT = 0; Q.pas(60 * 3);
        ok(qr.tombee && Math.abs(qr.g.position.y - qr.sol) < 0.01 && qr.g.visible, 'machine de Quick Revive retirée : sa tête tombe au sol et reste là', { y: qr.g.position.y, sol: qr.sol });
        placePlayer(qr.cx + 3, qr.cz - 1); Q.pas(2); Q.tir(qr);
        placePlayer(gl.cx - 6, gl.cz + 1.5); Q.pas(2); Q.tir(gl);
        for (let i = 0; i < 30; i++) { Q.pas(1); sh = Math.max(sh, FX.shake); }
        ok(qr.touchee && gl.touchee && sons.join() === '1,2,3', 'la tête de Quick Revive (tombée) et celle du Glas : un son à chaque tête (1, 2, 3)');
      } finally { window.tbSon = s0; window.secretDecouvert = sd0; }
      const b = Powerups.list.map((p) => p.type), z0 = zoneAt(player.pos.x, player.pos.z, player.gy);
      ok(TB.fait && secrets.includes('b7-tetes') && b.includes('freeperk') && b.includes('ammo') && Powerups.list.every((p) => zoneAt(p.x, p.z, player.gy) === z0),
        'les trois : « Atout gratuit » et « Munitions max » près du joueur ; secret « b7-tetes »', b);
      ok(sh === 0 && Q.lampes() === Q.l0, 'ni secousse ni lampe ajoutée');
      renderEnabled = true; render(); renderEnabled = false;
      Q.partie(); Q.pas(3);
      ok(!TB.fait && TB.tetes.length === 3 && TB.tetes.every((t) => !t.touchee && t.g.visible), 'nouvelle partie : trois têtes neuves');
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
  console.log(failures ? `${failures} échec(s).` : 'Têtes au béret : conforme (modèle, places, tirs, son, récompense, remise à zéro).');
  process.exit(failures ? 1 : 0);
})();
