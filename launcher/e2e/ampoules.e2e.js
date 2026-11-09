'use strict';
/* Ampoules des lampes de Bunker 7, troisième easter egg secondaire (jeu 2.0.7, demande d'Anthony du 9 novembre 2026),
   dans la fenêtre du jeu du launcher : une ampoule touchée (par en dessous) scintille, compte une fois ; à côté, rien ;
   pendant les lockdowns de la quête et le combat du boss, rien ; toutes touchées : les lampes scintillent ensemble,
   « Atout gratuit » et « Munitions max » près du joueur ; une fois par partie ; au plus 3 baisses par seconde ; ni
   secousse ni lampe ajoutée ; nouvelle partie : compte à zéro ; rendu sans erreur.
     xvfb-run -a node e2e/ampoules.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-ampoules-'));
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
    // ------------------------------------------------------------ ampoules, tirs, scintillement
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__amp = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = true; G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies(); player.gy = 0;
        },
        pas(n) { for (let i = 0; i < n; i++) __zs.step(1, 1 / 60); },
        // le joueur à d m sous l'ampoule i (case praticable), tir vers son centre (+ décalage)
        tir(i, off = [0, 0, 0]) {
          const S = AMP.spheres[i], c = S.c;
          for (const [ax, az] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4], [1, 1], [-1, -1]]) { if (locateNode(c.x + ax, c.z + az, 0, true) >= 0) { placePlayer(c.x + ax, c.z + az); break; } }
          G.stats.shots++;
          const s = Arms.slots[Arms.cur], ex = player.pos.x, ey = player.gy + PLAYER_EYE, ez = player.pos.z;
          let dx = c.x + off[0] - ex, dy = c.y + off[1] - ey, dz = c.z + off[2] - ez; const L = Math.hypot(dx, dy, dz);
          hitscan(s, ex, ey, ez, dx / L, dy / L, dz / L, { x: ex, y: ey, z: ez });
        },
        lampes() { const n = {}; scene.traverseVisible((o) => { if (o.isLight) n[o.type] = (n[o.type] || 0) + 1; }); return JSON.stringify(n); },
      };
      Q.partie(); Q.pas(3); ampEtat();
      ok(World.lights.length === 6 && AMP.spheres.every(Boolean) && ampActif(), `${World.lights.length} lampes, chacune son ampoule ; easter egg actif`);
      Q.l0 = Q.lampes();
      // à côté (30 cm) : rien
      Q.tir(0, [0.3, 0, 0]); ok(AMP.touchees.every((v) => !v), 'tir à 30 cm de l’ampoule : rien');
      // pendant les lockdowns et le combat du boss : rien
      const e0 = QP.etape; QP.etape = 'lockdowns'; Q.tir(0); QP.etape = e0;
      const a0 = B7.actif; B7.actif = true; Q.tir(0); B7.actif = a0;
      ok(AMP.touchees.every((v) => !v), 'pendant les lockdowns de la quête et le combat du boss : rien');
      // une ampoule touchée : elle scintille (intensité de sa lampe), et compte une fois
      let shake = 0;
      Q.tir(0); Q.pas(1);
      const base = World.lights[0].base;
      let mini = Infinity, maxi = 0, baisses = 0, bas = false;
      for (let i = 0; i < 60; i++) { Q.pas(1); shake = Math.max(shake, FX.shake); const k = World.lights[0].light.intensity / base; mini = Math.min(mini, k); maxi = Math.max(maxi, k); if (k < 0.5 && !bas) { baisses++; bas = true; } if (k > 0.8) bas = false; }
      ok(AMP.touchees[0] && mini < 0.4 && maxi > 0.8 && baisses <= 3, `ampoule touchée : sa lampe scintille (${baisses} baisse(s) en 1 s, de ${mini.toFixed(2)} à ${maxi.toFixed(2)})`);
      Q.pas(60 * 3);
      let apres = 0; for (let i = 0; i < 20; i++) { Q.pas(1); apres = Math.max(apres, World.lights[0].light.intensity / base); }
      ok(apres > 0.85, 'puis elle reprend sa lumière');
      Q.tir(0); ok(AMP.touchees.filter(Boolean).length === 1 && !AMP.fait, 'retouchée : elle ne compte pas deux fois');
      // les autres
      const secrets = []; const sd0 = window.secretDecouvert; window.secretDecouvert = (id) => secrets.push(id);
      clearPowerups();
      try { for (let i = 1; i < 6; i++) { Q.tir(i); Q.pas(2); } } finally { window.secretDecouvert = sd0; }
      const b = Powerups.list.map((p) => p.type), z0 = zoneAt(player.pos.x, player.pos.z, player.gy);
      ok(AMP.fait && secrets.includes('b7-ampoules') && b.includes('freeperk') && b.includes('ammo') && Powerups.list.every((p) => zoneAt(p.x, p.z, player.gy) === z0),
        'toutes touchées : « Atout gratuit » et « Munitions max » près du joueur ; secret « b7-ampoules »', b);
      // toutes ensemble, en même temps : au plus 3 baisses par seconde pour la pièce entière (règle des flashs)
      const minis = World.lights.map(() => Infinity), bas6 = World.lights.map(() => false);
      let creux = 0, dansCreux = false;
      for (let i = 0; i < 60; i++) {
        Q.pas(1);
        let un = false;
        World.lights.forEach((l, k) => { const r = l.light.intensity / l.base; minis[k] = Math.min(minis[k], r); if (r < 0.5) un = true; });
        if (un && !dansCreux) creux++;
        dansCreux = un;
      }
      const tous = minis.filter((m) => m < 0.5).length;
      ok(tous === 6 && AMP.finT > 0 && creux <= 3, `les lampes scintillent ensemble (${tous} sur 6), ${creux} baisse(s) en 1 s pour toutes`);
      for (let i = 0; i < 60 * 5; i++) { Q.pas(1); shake = Math.max(shake, FX.shake); }
      ok(shake === 0 && Q.lampes() === Q.l0, 'ni secousse ni lampe ajoutée');
      clearPowerups(); Q.tir(2); Q.pas(2);
      ok(Powerups.list.length === 0 && !ampActif(), 'une fois par partie');
      renderEnabled = true; render(); renderEnabled = false;
      Q.partie(); Q.pas(3); ampEtat();
      ok(!AMP.fait && AMP.touchees.every((v) => !v) && ampActif(), 'nouvelle partie : compte à zéro');
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
  console.log(failures ? `${failures} échec(s).` : 'Ampoules : conforme (tirs, scintillement, lockdowns et boss, récompense, remise à zéro).');
  process.exit(failures ? 1 : 0);
})();
