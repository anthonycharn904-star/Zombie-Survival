'use strict';
/* Essai de bout en bout du jeu dans la fenêtre du launcher : menu, sélection de la carte,
   statistiques enregistrées à la fermeture de la fenêtre et retrouvées à l'ouverture suivante,
   écran « Modèles » (fiche du Fantassin, modèle 3D dessiné, animations), règles du Fantassin
   (casque qui encaisse le premier tir à la tête, tête ×2, points de vie et dégâts).
     xvfb-run -a node e2e/game-menu.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-jeu-'));
const USER = path.join(TMP, 'joueur');
let failures = 0;
const ok = (cond, label, extra) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`); if (!cond) failures++; };

async function openGame() {
  const args = [ROOT];
  if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader');
  const app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
  const launcher = await app.firstWindow({ timeout: 30000 });
  await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
  const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
  await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
  return { app, game };
}

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  try {
    let { app, game } = await openGame();
    ok(await game.evaluate((v) => document.getElementById('btn-stats').textContent === 'Statistiques' && ZS.version === v, GAME), `jeu ${GAME} dans le launcher : bouton Statistiques`);
    await game.click('#btn-play');
    await game.waitForFunction(() => !document.getElementById('mapsel').hidden);
    ok(await game.evaluate(() => document.querySelectorAll('#ms-grid .ms-card').length >= 1), 'Jouer ouvre la sélection de la carte');
    await game.click('#btn-ms-play');
    await game.waitForFunction(() => ZS.G.state === 'playing', null, { timeout: 30000 });
    // quelques secondes de jeu et une élimination
    await game.evaluate(() => {
      __zs.step(180);
      const sp = pickSpawnPoint();
      const z = sp && spawnZombie(sp, 100);
      if (z) killZombie(z, { kind: 'knife', dx: 0, dz: 1 });
    });
    // le Fantassin : le casque encaisse le premier tir à la tête, le second compte double
    const rules = await game.evaluate(() => {
      const sp = pickSpawnPoint(), z = spawnZombie(sp, zombieHpForRound(1));
      if (z.win) leaveWindow(z);
      z.state = 'chase'; z.outside = false;
      const p = player.pos;
      z.pos.set(p.x + 0.0001, 0, p.z - 3); z.yaw = 0; animateZombie(z, 0);
      const head = zombieHead(z, new THREE.Vector3()), o = new THREE.Vector3(p.x, head.y, p.z), d = head.clone().sub(o).normalize();
      const slot = curSlot(), dmg = wstat(slot, 'dmg'), hp0 = z.hp, helmet0 = z.helmetOn;
      hitscan(slot, o.x, o.y, o.z, d.x, d.y, d.z, o);
      const hp1 = z.hp, helmet1 = z.helmetOn, loose = FX.helmets.some((h) => h.life > 0);
      hitscan(slot, o.x, o.y, o.z, d.x, d.y, d.z, o);
      const hp2 = z.hp;
      removeZombie(z);
      return { hp0, helmet0, hp1, helmet1, loose, hp2, dmg, hit: RULES.zombieHit, r10: zombieHpForRound(10), trot: speedMixForRound(4)[1] > 0 && speedMixForRound(3)[1] === 0, sprint: speedMixForRound(8)[2] > 0 && speedMixForRound(7)[2] === 0 };
    });
    ok(rules.hp0 === 100 && rules.helmet0 && rules.hp1 === 100 && !rules.helmet1 && rules.loose, 'Fantassin : le casque encaisse le premier tir à la tête puis tombe', rules);
    ok(rules.hp2 === 100 - rules.dmg * 2 && rules.hit === 30 && rules.r10 === 550 && rules.trot && rules.sprint, 'Fantassin : tête ×2, 30 dégâts, 550 PV à la manche 10, trot dès la 4, sprint dès la 8', rules);
    const live = await game.evaluate(() => ({ games: Life.data.games, kills: Life.data.kills, melee: Life.data.killsMelee, time: Life.data.time }));
    ok(live.games === 1 && live.kills === 1 && live.melee === 1 && live.time >= 2.9, 'compteurs pendant la partie', live);
    // fermeture de la fenêtre du jeu en pleine partie (sans pause)
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().startsWith('zsgame://game')); if (w) w.close(); });
    await new Promise((r) => setTimeout(r, 1500));
    await app.close().catch(() => {});
    ({ app, game } = await openGame());
    const back = await game.evaluate(() => ({ games: Life.data.games, kills: Life.data.kills, melee: Life.data.killsMelee, time: Life.data.time }));
    ok(back.games === 1 && back.kills === 1 && back.melee === 1 && back.time >= 2.9, 'fenêtre fermée en pleine partie : statistiques retrouvées', back);
    await game.click('#btn-stats');
    await game.waitForFunction(() => !document.getElementById('stats').hidden);
    const row = await game.evaluate(() => [...document.querySelectorAll('#stats-report .ledger > div')].find((d) => d.querySelector('dt').firstChild.textContent === 'Zombies tués au corps-à-corps').querySelector('dd').textContent);
    ok(/1$/.test(row), 'écran Statistiques : corps-à-corps = 1', row);
    // écran Modèles : fiche du zombie, modèle dessiné, animations, retour par Échap
    await game.click('#btn-stats-back');
    await game.click('#btn-models');
    await game.waitForFunction(() => !document.getElementById('models').hidden);
    await new Promise((r) => setTimeout(r, 800));
    const md = await game.evaluate(() => ({
      tabs: document.querySelectorAll('#md-tabs .md-tab').length, types: ZOMBIE_TYPES.length,
      name: document.querySelector('#md-sheet .md-name').textContent,
      kills: document.querySelector('#md-sheet .md-kills b').textContent,
      tag: document.querySelector('#md-sheet .md-tagline').textContent,
      bars: document.querySelectorAll('#md-sheet .md-bar').length, cards: document.querySelectorAll('#md-sheet .md-card').length,
      chips: [...document.querySelectorAll('#md-anims .md-chip')].map((b) => b.textContent),
      probe: __zs.modelProbe(),
    }));
    ok(md.tabs === md.types && md.name === 'Le Fantassin' && md.kills === '1' && /Zombie standard/.test(md.tag) && md.bars === 3 && md.cards === 2, 'écran Modèles : fiche du Fantassin (en-tête, jauges, capacité, faiblesse) et ses éliminations', { tabs: md.tabs, name: md.name, kills: md.kills, tag: md.tag });
    ok(['Repos', 'Marche', 'Trot', 'Sprint', 'Attaque', 'Sortie de terre', 'Autre apparence', 'Tir dans le casque'].every((t) => md.chips.includes(t)), 'écran Modèles : animations proposées', md.chips);
    ok(md.probe && md.probe.changed > 0.03 && md.probe.w > 100, 'écran Modèles : modèle 3D dessiné', md.probe);
    await game.click('#md-anims [data-anim="attack"]');
    await new Promise((r) => setTimeout(r, 400));
    const atk = await game.evaluate(() => ({ anim: Models.anim, pressed: document.querySelector('#md-anims [data-anim="attack"]').getAttribute('aria-pressed'), probe: __zs.modelProbe() }));
    ok(atk.anim === 'attack' && atk.pressed === 'true' && atk.probe.changed > 0.03, 'écran Modèles : animation Attaque', atk);
    await game.keyboard.press('Escape');
    await game.waitForFunction(() => !document.getElementById('menu').hidden);
    ok(await game.evaluate(() => !Models.open && document.getElementById('models').hidden), 'écran Modèles : Échap ramène au menu et arrête l’aperçu');
    await app.close().catch(() => {});
  } catch (e) {
    failures++;
    console.error('ÉCHEC', e);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s)` : 'Essai du jeu dans le launcher réussi.');
  process.exit(failures ? 1 : 0);
})();
