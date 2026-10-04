'use strict';
/* Essai de bout en bout du launcher dans Electron : mode auteur et Mod Tools.
   Ne touche à aucune vraie clé : l'essai fabrique une copie temporaire du launcher
   configurée avec une clé de test, et deux dossiers de données jetables.

     npm run test:e2e            (Windows, macOS, ou Linux avec écran)
     xvfb-run -a npm run test:e2e   (Linux sans écran)

   Vérifie : bouton Mod Tools visible seulement avec la clé de l'auteur, ouverture
   de l'éditeur, enregistrement d'une carte et d'une image dans l'atelier, liste de
   publication, partie de test et retour, partie de test d'une carte avec une erreur,
   demande d'enregistrement à la fermeture,
   publication du jeu installé avec les cartes de l'atelier. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-'));
const APP = path.join(TMP, 'app');
let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}`); if (!cond) failures++; };

function makeApp(publicPem) {
  fs.mkdirSync(path.join(APP, 'config'), { recursive: true });
  for (const d of ['src', 'gamelibs', 'game']) fs.cpSync(path.join(ROOT, d), path.join(APP, d), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(APP, 'package.json'));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(APP, 'node_modules'), 'junction');
  fs.writeFileSync(path.join(APP, 'config', 'default.json'), JSON.stringify({ updateUrl: 'file:///zs-e2e-introuvable/latest.json', publicKey: publicPem }, null, 2));
}
async function launch(userData) {
  const args = [APP];
  if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader');
  const app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: userData }, timeout: 60000 });
  const launcher = await app.firstWindow({ timeout: 30000 });
  await launcher.waitForLoadState('domcontentloaded');
  await launcher.waitForFunction(() => document.getElementById('status-title').textContent !== 'Ouverture du bunker…', null, { timeout: 60000 });
  return { app, launcher };
}
async function closeAll(app) {
  await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) w.allowClose = true; }).catch(() => {});
  await app.close().catch(() => {});
}

async function player(userData) {
  const { app, launcher } = await launch(userData);
  try {
    ok(await launcher.evaluate(() => document.getElementById('btn-modtools').hidden), 'joueur : pas de bouton Mod Tools');
    const r = await launcher.evaluate(() => window.zs.openModtools().then(() => 'ouvert', (e) => e.message));
    ok(/réservés à l'auteur/.test(r), 'joueur : ouverture des Mod Tools refusée');
  } finally { await closeAll(app); }
}

async function author(userData) {
  const { app, launcher } = await launch(userData);
  try {
    ok(!(await launcher.evaluate(() => document.getElementById('btn-modtools').hidden)), 'auteur : bouton Mod Tools visible');
    const [mt] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-modtools')]);
    await mt.waitForLoadState('domcontentloaded');
    await mt.waitForFunction(() => document.documentElement.dataset.modtools === 'ready', null, { timeout: 120000 });
    ok(await mt.evaluate(() => ZS.G.state === 'editor' && !!MT.state.map), 'Mod Tools ouverts sur une carte');
    // carte enregistrée dans l'atelier, image importée, liste de publication
    const r = await mt.evaluate(async () => {
      MT.openMap(ZS.blankMap(36, 26, 'Carte E2E'), { id: 'carte-e2e', source: 'new' });
      MT.edit('Lumière', (m) => { m.lights.push({ pos: [10.5, 3.1, 10.5], color: 0xff8040, intensity: 2, range: 10, flicker: 0, fixture: 'bulb' }); }, 'lights');
      const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').fillRect(0, 0, 8, 8);
      await MT.addToLibrary('u_e2e', { name: 'Damier', data: c.toDataURL('image/png'), size: [1, 1], rough: 0.8, fit: false });
      MT.paintCells('floor', [[18, 12]], 'u_e2e');
      const saved = await MT.ui.save();
      await MT.savePublishSet(['bunker7', 'carte-e2e']);
      return { saved, dirty: MT.isDirty() };
    });
    ok(r.saved && !r.dirty, 'carte enregistrée');
    const ws = path.join(userData, 'modtools');
    const mapFile = path.join(ws, 'maps', 'carte-e2e.json');
    ok(fs.existsSync(mapFile) && /u_e2e/.test(fs.readFileSync(mapFile, 'utf8')), 'fichier de carte avec son image embarquée');
    ok(fs.existsSync(path.join(ws, 'textures', 'u_e2e.json')), 'image gardée dans la bibliothèque de l’atelier');
    ok(JSON.parse(fs.readFileSync(path.join(ws, 'publish.json'), 'utf8')).maps.join() === 'bunker7,carte-e2e', 'liste de publication enregistrée');
    // partie de test puis retour
    await mt.keyboard.press('F5');
    await mt.waitForFunction(() => ZS.G.state === 'playing', null, { timeout: 30000 });
    ok(true, 'partie de test lancée');
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await mt.waitForFunction(() => ZS.G.state === 'paused', null, { timeout: 10000 });
    await mt.click('#btn-quit');
    await mt.waitForFunction(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden, null, { timeout: 20000 });
    ok(true, 'retour aux Mod Tools après la partie de test');
    // carte avec une erreur : la partie de test se lance quand même, l'erreur reste affichée
    await mt.evaluate(() => {
      const m = ZS.blankMap(30, 20, 'Erreur E2E');
      m.grid = m.grid.map((r) => (typeof r === 'string' ? r.replace(/W/g, '#') : r.map((c) => (c === 'W' ? '#' : c))));
      m.risers = [];
      MT.openMap(ZS.normalizeMap(m), { id: 'erreur-e2e', source: 'new' });
    });
    await mt.keyboard.press('F5');
    await mt.waitForFunction(() => ZS.G.state === 'playing' && !!document.querySelector('.mt-testbar'), null, { timeout: 30000 });
    ok(/Aucune fenêtre ni apparition/.test(await mt.evaluate(() => document.querySelector('.mt-testbar').textContent)), 'carte avec une erreur : partie de test lancée, erreur affichée');
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await mt.waitForFunction(() => ZS.G.state === 'paused', null, { timeout: 10000 });
    await mt.click('#btn-quit');
    await mt.waitForFunction(() => ZS.G.state === 'editor' && !document.querySelector('.mt-testbar'), null, { timeout: 20000 });
    // fermeture avec des modifications : la page demande
    await mt.evaluate(() => { MT.edit('Nom', (m) => { m.name = 'Carte E2E bis'; }, 'settings'); });
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().startsWith('zsgame://editor')); if (w) w.close(); });
    await mt.waitForTimeout(600);
    ok(await mt.evaluate(() => /Enregistrer les modifications/.test(document.getElementById('mt-modal').textContent)), 'fermeture : demande d’enregistrement');
    // publication : jeu installé + cartes de l'atelier
    const [pub] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), mt.evaluate(() => MT.api.openPublisher())]);
    await pub.waitForFunction(() => document.querySelectorAll('#maps-list li').length === 2, null, { timeout: 30000 });
    ok(true, 'outil de publication : deux cartes listées');
    const out = path.join(TMP, 'publications');
    const res = await pub.evaluate((outDir) => window.pub.create({ gameSource: 'installed', version: '9.9.9', notes: 'essai', outDir, repo: '' }), out);
    const { extractZip } = require('../src/main/updater');
    const x = path.join(TMP, 'paquet');
    await extractZip(path.join(res.dir, `zombie-survival-${res.version}.zip`), x);
    const index = JSON.parse(fs.readFileSync(path.join(x, 'maps', 'index.json'), 'utf8'));
    ok(index.maps.join() === 'bunker7,carte-e2e' && fs.existsSync(path.join(x, 'maps', 'carte-e2e.json')), 'paquet publié avec les cartes');
    ok(/const GAME_VERSION = '9\.9\.9'/.test(fs.readFileSync(path.join(x, 'index.html'), 'utf8')), 'paquet publié : version du jeu réécrite');
  } finally { await closeAll(app); }
}

(async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  makeApp(publicKey.export({ type: 'spki', format: 'pem' }));
  const authorData = path.join(TMP, 'auteur'), playerData = path.join(TMP, 'joueur');
  fs.mkdirSync(path.join(authorData, 'publisher'), { recursive: true });
  fs.writeFileSync(path.join(authorData, 'publisher', 'signing-key.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.mkdirSync(playerData, { recursive: true });
  try {
    await player(playerData);
    await author(authorData);
  } catch (e) {
    failures++;
    console.error('ÉCHEC', e);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s)` : 'Tous les essais de bout en bout sont passés.');
  process.exit(failures ? 1 : 0);
})();
