'use strict';
/* Règles du rang dans le jeu du launcher : XP de chaque sorte d'élimination (vraies
   éliminations par killZombie), Bombe (50 XP par manche), nombre d'éliminations par niveau,
   prestige n fois plus long, plafond du niveau 55, prestige, pas d'XP en partie de test ni
   après le digi pass, sauvegarde zs.rank (données abîmées bornées), partie rechargée en cours
   de jeu, écran de fin de partie, écriture des grands nombres.
   Les valeurs attendues suivent RANK_RULES (section 01 du jeu) : à mettre à jour avec elles.
     xvfb-run -a node e2e/rank.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-rang-'));
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
      const R = __zs.Rank;
      ok(R.data.p === 0 && R.data.lv === 1 && R.data.xp === 0, 'départ : niveau 1, sans prestige', R.data);
      ok(xpNeed(1, 0) === 500 && xpNeed(2, 0) === 1000 && xpNeed(3, 0) === 2000 && xpNeed(4, 1) === 4000 && xpNeed(2, 2) === 2000 && xpNeed(1, 3) === 1500, 'besoins : 500, 1 000, 2 000… × numéro du prestige');
      __zs.start(); __zs.god(true);
      G.roundState = 'pre'; G.roundT = 1e9;
      // éliminations réelles (killZombie) de chaque sorte
      const killWith = (info) => {
        const z = spawnZombie(pickSpawnPoint(), 100);
        if (z.win) leaveWindow(z);
        z.state = 'chase'; z.outside = false;
        killZombie(z, Object.assign({ dx: 0, dz: 1 }, info));
        removeZombie(z);
      };
      const xpOf = (info) => { const before = R.data.total; killWith(info); return +(R.data.total - before).toFixed(6); };
      ok(xpOf({ kind: 'bullet' }) === 5.5, 'élimination normale : 1,1 % de 500 = 5,5 XP');
      ok(xpOf({ kind: 'bullet', head: true }) === 7.5, 'tir dans la tête : 1,5 % = 7,5 XP');
      ok(xpOf({ kind: 'explosive', src: 'grenade' }) === 6, 'grenade : 1,2 % = 6 XP');
      ok(xpOf({ kind: 'explosive', src: 'rocket' }) === 6, 'Panzerschreck : 1,2 %');
      ok(xpOf({ kind: 'explosive', src: 'rounds' }) === 6, 'munitions explosives : 1,2 %');
      ok(xpOf({ kind: 'knife' }) === 10, 'couteau : 2 % = 10 XP');
      ok(xpOf({ kind: 'explosive', src: 'plasma' }) === 5.5, 'Désintégrateur : élimination normale');
      ok(xpOf({ kind: 'blast' }) === 5.5, 'Onde de choc : élimination normale');
      ok(xpOf({ kind: 'nuke' }) === 0, 'zombie tué par la Bombe : rien en plus');
      // nombre d'éliminations par niveau
      const killsToLevel = (lv, p, info) => {
        __zs.rank(lv, p);
        let n = 0;
        while (R.data.lv === lv && n < 1000) { killWith(info); n++; }
        return n;
      };
      let n = killsToLevel(1, 0, { kind: 'bullet' });
      ok(n === 91, `niveau 1 → 2 : 91 éliminations normales (${n})`);
      n = killsToLevel(30, 0, { kind: 'knife' });
      ok(n === 50, `niveau 30 → 31 : 50 éliminations au couteau, comme au niveau 1 (${n})`);
      n = killsToLevel(10, 2, { kind: 'bullet', head: true });
      ok(n === 134, `prestige 2 : deux fois plus long (134 tirs dans la tête au lieu de 67) (${n})`);
      // Bombe : 50 XP par manche
      __zs.rank(1, 0);
      const t0 = R.data.total;
      G.round = 10; applyPowerup('nuke');
      ok(R.data.total - t0 === 500 && R.data.lv === 2 && R.data.xp === 0, 'Bombe à la manche 10 : 500 XP (niveau 2)', R.data);
      __zs.rank(1, 0);
      G.round = 20; applyPowerup('nuke');
      ok(R.data.lv === 2 && R.data.xp === 500, 'Bombe à la manche 20 : 1 000 XP → niveau 2 et la moitié du niveau 2', R.data);
      // plafond et prestige
      __zs.rank(54, 4);
      R.gain(xpNeed(54, 4) * 3);
      ok(R.data.lv === 55 && R.data.xp === 0 && R.canPrestige(), 'niveau 55 : plafond, prestige disponible', R.data);
      const tot = R.data.total;
      killWith({ kind: 'bullet' });
      ok(R.data.total === tot, 'au niveau 55, l’XP ne s’accumule plus');
      ok(R.prestige() && R.data.p === 5 && R.data.lv === 1 && R.data.xp === 0, 'prestige : 5e prestige, niveau 1', R.data);
      __zs.rank(55, 20);
      ok(!R.canPrestige() && !R.prestige(), 'prestige 20 au niveau 55 : plus de prestige');
      // pas d'XP après le digi pass ni en partie de test
      __zs.rank(5, 0);
      G.cheat = true;
      const t1 = R.data.total;
      killWith({ kind: 'bullet' }); applyPowerup('nuke');
      ok(R.data.total === t1 && R.off === 'digi pass', 'digi pass : pas d’XP');
      G.cheat = false;
      G.editorSession = true;
      killWith({ kind: 'bullet' });
      ok(R.data.total === t1 && R.off === 'partie de test', 'partie de test des Mod Tools : pas d’XP');
      G.editorSession = false;
      // sauvegarde
      __zs.rank(17, 3); R.gain(1234.5); R.save();
      const saved = JSON.parse(localStorage.getItem('zs.rank'));
      ok(saved.lv === 17 && saved.p === 3 && saved.xp === 1234.5, 'sauvegardé dans zs.rank', saved);
      localStorage.setItem('zs.rank', JSON.stringify({ p: 99, lv: -4, xp: 'abc', total: -1 }));
      R.load();
      ok(R.data.p === 20 && R.data.lv === 1 && R.data.xp === 0 && R.data.total === 0, 'données abîmées : valeurs bornées', R.data);
      localStorage.setItem('zs.rank', '{pas du json');
      R.load();
      ok(R.data.p === 0 && R.data.lv === 1, 'fichier illisible : départ', R.data);
      // partie rechargée en cours de jeu (mise à jour à chaud) : grade de départ repris s'il est cohérent
      __zs.rank(3, 0);
      G.state = 'playing'; G.rankStart = { p: 0, lv: 2 };
      startGame(serializeGame());
      ok(G.rankStart.p === 0 && G.rankStart.lv === 2, 'partie rechargée : grade de départ repris', G.rankStart);
      G.state = 'playing'; G.rankStart = { p: 1, lv: 9 };
      startGame(serializeGame());
      ok(G.rankStart.p === 0 && G.rankStart.lv === 3, 'partie rechargée après un prestige : grade actuel', G.rankStart);
      // écran de fin de partie : XP gagnée et niveaux
      __zs.rank(3, 0);
      G.stats.xp = 0; G.rankStart = { p: 0, lv: 3 };
      R.gain(xpNeed(3, 0) + 10);
      gameOver();
      const go = document.getElementById('go-stats').textContent.replace(/[  ]/g, ' ');
      ok(/XP gagnée\+2 ?010/.test(go) && /Niveau3 → 4/.test(go), 'écran de fin : XP gagnée et niveaux', go);
      // grands nombres
      ok(fmtXp(500) === '500' && fmtXp(262144000) === '262,1 M' && /× 10¹⁸$/.test(fmtXp(xpNeed(54, 1))), 'nombres : 500, 262,1 M, … × 10¹⁸', [fmtXp(262144000), fmtXp(xpNeed(54, 1))]);
      return out;
    });
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
  console.log(failures ? `${failures} échec(s).` : 'Rang : toutes les règles sont respectées.');
  process.exit(failures ? 1 : 0);
})();
