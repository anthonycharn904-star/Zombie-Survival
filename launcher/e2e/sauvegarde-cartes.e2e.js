'use strict';
/* Sauvegarder et quitter (jeu 2.0.7) sur les cartes ouvertes, dans la fenêtre du jeu du launcher : Khamsin (place du
   joueur sur le terrain, véhicule déplacé, zombies vivants et leur type), Ombre éternelle (oxygène, zombies de la Lune),
   Marécages Maudits quand le jeu les contient (refus : nage, Mère-Vase qui attaque, son combat, manche des Stryges ;
   barque déplacée, menace). Chaque carte : sauvegarde depuis la pause, reprise par « Continuer la partie ».
     xvfb-run -a node e2e/sauvegarde-cartes.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-sauvegarde-cartes-'));
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
    if (process.platform === 'linux') game.setDefaultTimeout(300000);   // rendu logiciel : cartes ouvertes lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    const res = [];
    const report = (r) => res.push(r);
    // ------------------------------------------------ Khamsin
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const step = (n) => __zs.step(n, 1 / 60);
      for (const k of Object.keys(localStorage)) if (k.startsWith('zs.partie.')) localStorage.removeItem(k);
      SAUVE.mode = 'manche';
      if (!__zs.map('khamsin')) { ok(false, 'Khamsin introuvable'); return out; }
      __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      step(30);
      G.round = 3; G.roundState = 'active'; G.dogRound = false; G.total = 12; G.spawned = 5; G.killed = 2; G.spawnT = 3; G.points = 2468;
      const zs = [];
      for (let i = 0; i < 6 && zs.length < 3; i++) { const sp = pickSpawnPoint(); const z = sp && spawnZombie(sp, G.zombieHp || 150); if (z) zs.push(z); }
      step(20);
      for (const z of zs) if (Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z) < SAUVE.distance + 1) { z.alive = false; removeZombie(z); }
      const vivants = Zombies.list.filter((z) => z.alive && !z.dog);
      const V = VEH.list[0];
      if (V) { V.x += 4; V.z += 3; V.yaw += 0.5; vehPose(V, 0, true); }
      player.lastHit = -99;
      const p = ZSPartie.peutSauvegarder();
      ok(p.ok, `Khamsin : sauvegarde permise (${vivants.length} zombies vivants, loin)`, p.raison);
      localStorage.setItem('zs.essai.kh', JSON.stringify({
        x: player.pos.x, z: player.pos.z, gy: player.gy, types: vivants.map((z) => z.type.id).sort(), hp: vivants.map((z) => Math.round(z.hp)).sort((a, b) => a - b),
        v: V ? { x: V.x, z: V.z, yaw: V.yaw } : null,
      }));
      pauseGame();
      return ZSPartie.sauvegarderEtQuitter().then((r) => {
        ok(r.ok, `Khamsin : sauvegardée (${r.octets} octets)`, r);
        return ZSPartie.continuer('khamsin');
      }).then(() => {
        const a = JSON.parse(localStorage.getItem('zs.essai.kh')); localStorage.removeItem('zs.essai.kh');
        const vivants = Zombies.list.filter((z) => z.alive && !z.dog);
        ok(G.state === 'paused' && G.mapId === 'khamsin' && OW.on && G.round === 3 && G.points === 2468, 'Khamsin : reprise en pause, manche 3, points');
        ok(Math.hypot(player.pos.x - a.x, player.pos.z - a.z) < 0.05 && Math.abs(player.gy - a.gy) < 0.5, `Khamsin : joueur à sa place sur le terrain (écart ${Math.hypot(player.pos.x - a.x, player.pos.z - a.z).toFixed(2)} m)`);
        ok(JSON.stringify(vivants.map((z) => z.type.id).sort()) === JSON.stringify(a.types) && JSON.stringify(vivants.map((z) => Math.round(z.hp)).sort((x, y) => x - y)) === JSON.stringify(a.hp),
          `Khamsin : zombies recréés avec leur type et leur santé (${vivants.map((z) => z.type.id).join(', ')})`, { avant: a.types, apres: vivants.map((z) => z.type.id) });
        ok(vivants.every((z) => Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z) >= SAUVE.ecart), 'Khamsin : aucun zombie recréé près du joueur');
        const V = VEH.list[0];
        ok(!a.v || (V && Math.hypot(V.x - a.v.x, V.z - a.v.z) < 0.05 && Math.abs(V.yaw - a.v.yaw) < 0.01), 'Khamsin : véhicule à sa place');
        resumeGame(); step(60);
        ok(G.state === 'playing', 'Khamsin : la partie reprend');
        quitToMenu();
        return out;
      });
    })).forEach(report);
    // ------------------------------------------------ Ombre éternelle (Lune)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const step = (n) => __zs.step(n, 1 / 60);
      if (!__zs.map('ombre')) { ok(false, 'Ombre éternelle introuvable'); return out; }
      __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      step(30);
      G.round = 2; G.roundState = 'active'; G.dogRound = false; G.total = 10; G.spawned = 4; G.killed = 1; G.spawnT = 3; G.points = 1357;
      const zs = [];
      for (let i = 0; i < 6 && zs.length < 2; i++) { const sp = pickSpawnPoint(); const z = sp && spawnZombie(sp, G.zombieHp || 150); if (z) zs.push(z); }
      step(20);
      for (const z of zs) if (Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z) < SAUVE.distance + 1) { z.alive = false; removeZombie(z); }
      LUO.o2 = 123; player.lastHit = -99;
      const vivants = Zombies.list.filter((z) => z.alive && !z.dog);
      const p = ZSPartie.peutSauvegarder();
      ok(p.ok, `Lune : sauvegarde permise (${vivants.length} zombies vivants)`, p.raison);
      localStorage.setItem('zs.essai.lu', JSON.stringify({ x: player.pos.x, z: player.pos.z, types: vivants.map((z) => z.type.id).sort() }));
      pauseGame();
      return ZSPartie.sauvegarderEtQuitter().then((r) => {
        ok(r.ok, 'Lune : sauvegardée', r);
        return ZSPartie.continuer('ombre');
      }).then(() => {
        const a = JSON.parse(localStorage.getItem('zs.essai.lu')); localStorage.removeItem('zs.essai.lu');
        const vivants = Zombies.list.filter((z) => z.alive && !z.dog);
        ok(G.state === 'paused' && G.mapId === 'ombre' && OW.worldId === 'lune' && G.round === 2 && G.points === 1357, 'Lune : reprise en pause, manche 2, points');
        ok(Math.abs(LUO.o2 - 123) <= 1, `Lune : oxygène ${Math.round(LUO.o2)} (123 sauvegardé)`);
        ok(Math.hypot(player.pos.x - a.x, player.pos.z - a.z) < 0.05, 'Lune : joueur à sa place');
        ok(JSON.stringify(vivants.map((z) => z.type.id).sort()) === JSON.stringify(a.types), `Lune : zombies recréés avec leur type (${vivants.map((z) => z.type.id).join(', ') || 'aucun'})`, { avant: a.types });
        resumeGame(); step(60);
        ok(G.state === 'playing', 'Lune : la partie reprend');
        quitToMenu();
        return out;
      });
    })).forEach(report);
    // ------------------------------------------------ Marécages Maudits (quand le jeu les contient)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const step = (n) => __zs.step(n, 1 / 60);
      if (!MAPS.byId.marais) return out;                       // jeu sans la carte (branche des Marécages pas encore fusionnée)
      if (!__zs.map('marais')) { ok(false, 'Marécages introuvables'); return out; }
      __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      step(30);
      clearZombies(); player.lastHit = -99;
      G.round = 2; G.roundState = 'active'; G.dogRound = false; G.total = 8; G.spawned = 3; G.killed = 3; G.spawnT = 3; G.points = 4242;
      ok(ZSPartie.peutSauvegarder().ok, 'Marécages : sauvegarde permise au calme', ZSPartie.peutSauvegarder().raison);
      MA_SWIM.on = true;
      ok(/nagez/.test(ZSPartie.peutSauvegarder().raison || ''), 'Marécages : refus en nageant');
      MA_SWIM.on = false;
      const st = MAB.state, on = MAB.on; MAB.on = true; MAB.state = 'chasse';
      ok(/Mère-Vase attaque/.test(ZSPartie.peutSauvegarder().raison || ''), 'Marécages : refus quand la Mère-Vase chasse');
      MAB.state = st; MAB.on = on;
      MA_BOSS.on = true;
      ok(/boss/.test(ZSPartie.peutSauvegarder().raison || ''), 'Marécages : refus pendant le combat de la Mère-Vase');
      MA_BOSS.on = false;
      G.dogRound = true;
      ok(/spéciale/.test(ZSPartie.peutSauvegarder().raison || ''), 'Marécages : refus pendant la manche des Stryges');
      G.dogRound = false;
      const B = VEH.list.find((v) => v.T && v.T.boat);
      if (B) { B.x += 3; B.z += 2; vehPose(B, 0, true); }
      MAM.attn = 23;
      localStorage.setItem('zs.essai.ma', JSON.stringify({ x: player.pos.x, z: player.pos.z, b: B ? { x: B.x, z: B.z } : null }));
      pauseGame();
      return ZSPartie.sauvegarderEtQuitter().then((r) => {
        ok(r.ok, 'Marécages : sauvegardée', r);
        return ZSPartie.continuer('marais');
      }).then(() => {
        const a = JSON.parse(localStorage.getItem('zs.essai.ma')); localStorage.removeItem('zs.essai.ma');
        ok(G.state === 'paused' && G.mapId === 'marais' && G.round === 2 && G.points === 4242, 'Marécages : reprise en pause, manche 2, points');
        ok(Math.hypot(player.pos.x - a.x, player.pos.z - a.z) < 0.05, 'Marécages : joueur à sa place');
        const B = VEH.list.find((v) => v.T && v.T.boat);
        ok(!a.b || (B && Math.hypot(B.x - a.b.x, B.z - a.b.z) < 0.05), 'Marécages : barque à sa place');
        ok(Math.round(MAM.attn) === 23, `Marécages : menace de la Mère-Vase (${Math.round(MAM.attn)})`);
        resumeGame(); step(60);
        ok(G.state === 'playing', 'Marécages : la partie reprend');
        quitToMenu();
        renderEnabled = true; render(); renderEnabled = false;
        return out;
      });
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
  console.log(failures ? `${failures} échec(s).` : 'Sauvegarder et quitter sur les cartes ouvertes : conforme (Khamsin, Lune, Marécages s’ils sont là).');
  process.exit(failures ? 1 : 0);
})();
