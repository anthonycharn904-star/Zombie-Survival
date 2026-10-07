'use strict';
/* Essai de bout en bout du launcher dans Electron : mode auteur et Mod Tools.
   Ne touche à aucune vraie clé : l'essai fabrique une copie temporaire du launcher
   configurée avec une clé de test, et deux dossiers de données jetables.

     npm run test:e2e            (Windows, macOS, ou Linux avec écran)
     xvfb-run -a npm run test:e2e   (Linux sans écran)

   Vérifie : bouton Mod Tools visible seulement avec la clé de l'auteur, ouverture
   de l'éditeur, armes murales (les 16 armes, spéciales comprises), enregistrement
   d'une carte et d'une image dans l'atelier, liste de
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
  if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
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

/* Étages et escaliers : pose à la souris sur le plan, étage d'arrivée créé avec sa trémie,
   changement de niveau au clavier, sous-sol, inspecteur, coupe de la vue 3D, annuler/rétablir,
   fichier enregistré, partie de test sur plusieurs niveaux et retour. */
async function floors(mt, userData) {
  // salle de blankMap(36, 26) : intérieur x 13..23, z 9..17
  await mt.evaluate(() => {
    MT.openMap(ZS.blankMap(36, 26, 'Étages E2E'), { id: 'etages-e2e', source: 'new' });
    MT.ui.setView('split');
  });
  await mt.waitForTimeout(300);
  await mt.evaluate(() => MT.plan.fit());
  const clickCell = async (x, z, button = 'left') => {
    const [px, py] = await mt.evaluate(([cx, cz]) => {
      const r = MT.plan.canvas.getBoundingClientRect();
      const [sx, sy] = MT.plan.toScreen(cx + 0.5, cz + 0.5);
      return [r.left + sx, r.top + sy];
    }, [x, z]);
    await mt.mouse.move(px, py);
    await mt.mouse.down({ button });
    await mt.mouse.up({ button });
    await mt.waitForTimeout(150);
  };
  ok(await mt.evaluate(() => !!document.querySelector('.mt-tool[data-tool="stairs"]') && !document.getElementById('mt-levels').hidden), 'étages : outil Escaliers et sélecteur de niveau présents');
  await mt.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await mt.keyboard.press('KeyK');
  const panel = await mt.evaluate(() => ({ tool: MT.state.tool, mats: document.querySelectorAll('#mt-panel .stair-mat').length, n: Object.keys(ZS.STAIR_MATS).length }));
  ok(panel.tool === 'stairs' && panel.mats === panel.n && panel.n >= 8, `étages : touche K → outil Escaliers, ${panel.mats} matériaux proposés`);
  // 1. escalier droit en bois, montée vers l'est, posé au clic
  await mt.evaluate(() => Object.assign(MT.state.opts.stairs, { shape: 'straight', mat: 'wood', w: 1, n: 5, dir: [1, 0] }));
  await clickCell(14, 10);
  const a = await mt.evaluate(() => {
    const m = MT.state.map, st = (m.stairs || [])[0], g1 = MT.gridOf(1);
    return { n: (m.stairs || []).length, at: st ? [st.x, st.z, st.mat, st.lv | 0] : null, levels: MT.levels().join(), open: g1 ? [15, 16, 17, 18].map((x) => g1[10][x]).join('') : null, first: g1 ? g1[10][14] : null, exit: g1 ? g1[10][19] : null, level: MT.state.level };
  });
  ok(a.n === 1 && a.at.join() === '14,10,wood,0' && a.levels === '0,1' && a.open === '    ' && a.first === '.' && a.exit === '.' && a.level === 0, `étages : escalier en bois posé au clic, étage 1 ajouté avec sa trémie ${JSON.stringify(a)}`);
  // 2. Ctrl+↑ : étage 1, puis escalier hélicoïdal en métal (crée l'étage 2)
  await mt.keyboard.press('Control+ArrowUp');
  ok(await mt.evaluate(() => MT.state.level === 1 && document.querySelector('.mt-level-sel').value === '1'), 'étages : Ctrl+↑ affiche l’étage 1');
  await mt.evaluate(() => Object.assign(MT.state.opts.stairs, { shape: 'spiral', mat: 'metal', dir: [0, 1], turn: 1 }));
  await clickCell(22, 12);
  const b = await mt.evaluate(() => {
    const m = MT.state.map, st = m.stairs[1], g2 = MT.gridOf(2);
    return { n: m.stairs.length, st: st ? [st.x, st.z, st.shape, st.mat, st.lv | 0] : null, levels: MT.levels().join(), core: g2 ? g2[13][21] : null, arrive: g2 ? g2[12][22] : null };
  });
  ok(b.n === 2 && b.st.join() === '22,12,spiral,metal,1' && b.levels === '0,1,2' && b.core === ' ' && b.arrive === '.', `étages : hélicoïdal en métal posé à l’étage 1, étage 2 ajouté ${JSON.stringify(b)}`);
  // 3. pose refusée sur la trémie d'un escalier du dessous
  await mt.evaluate(() => Object.assign(MT.state.opts.stairs, { shape: 'straight', mat: 'stone', dir: [0, 1], n: 3 }));
  await clickCell(16, 10);
  ok(await mt.evaluate(() => MT.state.map.stairs.length === 2), 'étages : pas d’escalier sur une trémie');
  // 4. sous-sol et escalier en briques qui remonte au rez-de-chaussée
  await mt.evaluate(() => MT.addLevel(-1));
  await mt.evaluate(() => Object.assign(MT.state.opts.stairs, { shape: 'straight', mat: 'brick', w: 1, n: 6, dir: [0, -1] }));
  await clickCell(20, 16);
  const c = await mt.evaluate(() => {
    const m = MT.state.map, st = m.stairs[2], g0 = MT.gridOf(0);
    return { level: MT.state.level, levels: MT.levels().join(), st: st ? [st.x, st.z, st.mat, st.lv] : null, hole: [11, 12, 13, 14].map((z) => g0[z][20]).join(''), exit: g0[10][20], sel: document.querySelector('.mt-level-sel').value };
  });
  ok(c.level === -1 && c.levels === '-1,0,1,2' && c.st && c.st.join() === '20,16,brick,-1' && c.hole === '    ' && c.exit === '.' && c.sel === '-1', `étages : sous-sol ajouté, escalier en briques jusqu’au rez-de-chaussée ${JSON.stringify(c)}`);
  // 4b. clic droit avec l'outil Escaliers : l'escalier part (Ctrl+Z le remet) ; un niveau du milieu ne se supprime pas
  await clickCell(20, 16, 'right');
  const rr = await mt.evaluate(() => ({ n: MT.state.map.stairs.length, hole: MT.gridOf(0)[12][20] }));
  await mt.keyboard.press('Control+KeyZ');
  const back = await mt.evaluate(() => ({ n: MT.state.map.stairs.length, hole: MT.gridOf(0)[12][20], mid: MT.removeLevel(1), levels: MT.levels().join() }));
  ok(rr.n === 2 && rr.hole === '.' && back.n === 3 && back.hole === ' ' && back.mid === false && back.levels === '-1,0,1,2', `étages : clic droit retire l’escalier et referme la trémie, Ctrl+Z le remet, étage du milieu protégé ${JSON.stringify({ rr, back })}`);
  // 5. annuler / rétablir : la trémie suit
  const u = await mt.evaluate(() => {
    MT.undo();
    const undone = MT.state.map.stairs.length === 2 && MT.gridOf(0)[12][20] === '.';
    MT.redo();
    return { undone, redone: MT.state.map.stairs.length === 3 && MT.gridOf(0)[12][20] === ' ' };
  });
  ok(u.undone && u.redone, `étages : annuler et rétablir l’escalier referment et rouvrent la trémie ${JSON.stringify(u)}`);
  // 6. inspecteur : changer le matériau de l'escalier en bois
  await mt.evaluate(() => { MT.setLevel(0); MT.setTool('select'); MT.select({ kind: 'stair', i: 0 }); MT.ui.setTab('sel'); });
  await mt.waitForTimeout(200);
  await mt.evaluate(() => { const name = ZS.STAIR_MATS.stone.name; const btn = [...document.querySelectorAll('#mt-panel .stair-mat')].find((x) => x.title.startsWith(name)); if (btn) btn.click(); });
  ok(await mt.evaluate(() => MT.state.map.stairs[0].mat === 'stone'), 'étages : l’inspecteur change le matériau (bois → pierre)');
  // 7. vue 3D en coupe : au rez-de-chaussée, les étages sont cachés
  const cut = await mt.waitForFunction(() => {
    const root = ZS.World.root;
    if (!root || MT.state.level !== 0) return null;
    let above = 0, aboveShown = 0, here = 0;
    root.traverse((o) => { if (!o.userData || o.userData.lv === undefined) return; if (o.userData.lv > 0) { above++; if (o.visible) aboveShown++; } else if (o.visible) here++; });
    return above > 0 && !aboveShown && here > 0 ? { above, here } : null;
  }, null, { timeout: 30000 }).then((h) => h.jsonValue(), () => null);
  ok(!!cut, `étages : vue 3D coupée au niveau affiché ${JSON.stringify(cut)}`);
  // 8. fichier enregistré au format 2
  ok(await mt.evaluate(() => MT.ui.save()), 'étages : carte enregistrée');
  const file = path.join(userData, 'modtools', 'maps', 'etages-e2e.json');
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { saved = null; }
  ok(!!saved && saved.format === 2 && saved.floors.map((f) => f.lv).join() === '-1,1,2' && saved.stairs.map((s) => s.mat).join() === 'stone,metal,brick', `étages : fichier au format 2 avec niveaux et escaliers ${saved ? JSON.stringify({ format: saved.format, floors: saved.floors.map((f) => f.lv), stairs: saved.stairs.map((s) => s.mat) }) : ''}`);
  // 9. partie de test sur quatre niveaux, puis retour
  await mt.keyboard.press('F5');
  await mt.waitForFunction(() => ZS.G.state === 'playing', null, { timeout: 30000 });
  ok(await mt.evaluate(() => ZS.LV.join() === '-1,0,1,2'), 'étages : partie de test sur quatre niveaux');
  await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await mt.waitForTimeout(400);
  if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
  await mt.waitForFunction(() => ZS.G.state === 'paused', null, { timeout: 10000 });
  await mt.click('#btn-quit');
  await mt.waitForFunction(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden, null, { timeout: 20000 });
  ok(await mt.evaluate(() => MT.state.map.stairs.length === 3 && MT.levels().length === 4), 'étages : retour aux Mod Tools, carte intacte');
}

async function author(userData) {
  const { app, launcher } = await launch(userData);
  try {
    ok(!(await launcher.evaluate(() => document.getElementById('btn-modtools').hidden)), 'auteur : bouton Mod Tools visible');
    const [mt] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-modtools')]);
    await mt.waitForLoadState('domcontentloaded');
    // erreurs JavaScript de la page des Mod Tools (le dessin du plan ou de la 3D qui casse ne se voit pas autrement)
    const mtErrors = [];
    mt.on('pageerror', (e) => mtErrors.push(`pageerror: ${e.message}`));
    mt.on('console', (m) => { if (m.type() === 'error') mtErrors.push(`console.error: ${m.text().slice(0, 300)}`); });
    await mt.waitForFunction(() => document.documentElement.dataset.modtools === 'ready', null, { timeout: 120000 });
    ok(await mt.evaluate(() => ZS.G.state === 'editor' && !!MT.state.map), 'Mod Tools ouverts sur une carte');
    // digi pass de Bunker 7 : il suit l'agrandissement de la carte et part avec son mur
    const dp = await mt.evaluate(() => {
      MT.openMap(ZS.normalizeMap(JSON.parse(JSON.stringify(ZS.BUNKER7))), { id: 'bunker7', source: 'game' });
      const c0 = MT.state.map.digipass && MT.state.map.digipass.cell.slice();
      MT.resizeMap(MT.state.map.w + 4, MT.state.map.h + 2, 1, 1);
      const c1 = MT.state.map.digipass && MT.state.map.digipass.cell.slice();
      MT.edit('Mur', () => MT.setTiles([c1], '.'), 'grid');
      const gone = MT.state.map.digipass === null;
      MT.undo(); MT.undo();
      const back = MT.state.map.digipass;
      return { c0, c1, gone, back: !!back && back.cell.join() === c0.join() && MT.state.map.w === ZS.BUNKER7.grid[0].length };
    });
    ok(!!dp.c0 && !!dp.c1 && dp.c1[0] === dp.c0[0] + 2 && dp.c1[1] === dp.c0[1] + 1 && dp.gone && dp.back, `Mod Tools : le digi pass suit l’agrandissement et part avec son mur ${JSON.stringify(dp)}`);
    // zombies par pièce (jeu 1.8.0) : l'inspecteur d'une pièce choisit son type de zombie
    const zt = await mt.evaluate(async () => {
      MT.openMap(ZS.normalizeMap(JSON.parse(JSON.stringify(ZS.BUNKER7))), { id: 'bunker7', source: 'game' });
      const i = MT.state.map.zones.findIndex((z) => z.name === 'Infirmerie');
      MT.setTool('select'); MT.select({ kind: 'zone', i }); MT.ui.setTab('sel');
      await new Promise((r) => setTimeout(r, 250));
      const sel = document.querySelector('#mt-panel select[data-field="zombie"]');
      const before = sel && sel.value, options = sel ? [...sel.options].map((o) => o.value).join() : null;
      if (sel) { sel.value = 'lacere'; sel.dispatchEvent(new Event('change')); }
      const after = MT.state.map.zones[i].zombie, out = ZS.serializeMap(MT.state.map).zones[i].zombie;
      MT.undo();
      return { before, options, after, out, undone: MT.state.map.zones[i].zombie };
    });
    ok(zt.before === 'savant' && zt.options === 'fantassin,lacere,savant,sentinelle' && zt.after === 'lacere' && zt.out === 'lacere' && zt.undone === 'savant', `Mod Tools : type de zombie d’une pièce (Infirmerie : Savant → Lacéré, enregistré, annulable) ${JSON.stringify(zt)}`);
    // armes murales : les 16 armes du jeu, spéciales comprises, se posent au mur (Éléments de jeu
    // → Arme murale, liste « Arme », clic sur un mur), chacune avec son prix habituel (jeu 1.8.0)
    await mt.evaluate(() => { MT.openMap(ZS.blankMap(36, 26, 'Armes E2E'), { id: 'armes-e2e', source: 'new' }); MT.ui.setView('split'); });
    await mt.waitForTimeout(300);
    await mt.evaluate(() => MT.plan.fit());
    await mt.click('.mt-tool[data-tool="elements"]');
    await mt.evaluate(() => [...document.querySelectorAll('.kind-btn')].find((b) => /Arme murale/.test(b.textContent)).click());
    await mt.waitForTimeout(200);
    const wl = await mt.evaluate(() => {
      const s = document.querySelector('#mt-panel select');
      const options = s ? [...s.options].map((o) => o.value) : [];
      if (s) { s.value = 'raygun'; s.dispatchEvent(new Event('change')); }
      const r = MT.plan.canvas.getBoundingClientRect(), [sx, sy] = MT.plan.toScreen(14.5, 8.5);
      return { options, count: Object.keys(ZS.WEAPONS).length, px: r.left + sx, py: r.top + sy, labels: s ? [...s.options].map((o) => o.textContent) : [] };
    });
    await mt.mouse.move(wl.px, wl.py); await mt.mouse.down(); await mt.mouse.up();
    await mt.waitForTimeout(150);
    const wb = await mt.evaluate(() => {
      const w = MT.state.map.wallbuys.find((x) => x.w === 'raygun');
      return w && { cell: w.cell.join(), n: w.n.join(), price: ZS.wallbuyPrice(w), saved: ZS.serializeMap(MT.state.map).wallbuys.some((x) => x.w === 'raygun') };
    });
    const special = ['ppsh', 'type100', 'fg42', 'mg42', 'panzer', 'raygun', 'blaster'];
    ok(wl.options.length === wl.count && wl.options.length === 16 && special.every((id) => wl.options.includes(id))
      && wl.labels.includes('Désintégrateur — 10000 pts') && wl.labels.includes('Onde de choc — 10000 pts')
      && !!wb && wb.cell === '14,8' && wb.n === '0,1' && wb.price === 10000 && wb.saved,
      `Mod Tools : les 16 armes au mur, spéciales comprises (Désintégrateur posé par clic, 10 000 pts) ${JSON.stringify({ n: wl.options.length, wb })}`);
    await floors(mt, userData);
    ok(!mtErrors.length, `étages : aucune erreur dans la console des Mod Tools ${mtErrors.slice(0, 3).join(' | ')}`);
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
    ok(!mtErrors.length, `Mod Tools : aucune erreur dans la console ${mtErrors.slice(0, 3).join(' | ')}`);
    // fermeture avec des modifications : la page demande
    await mt.evaluate(() => { MT.edit('Nom', (m) => { m.name = 'Carte E2E bis'; }, 'settings'); });
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().startsWith('zsgame://editor')); if (w) w.close(); });
    const asked = await mt.waitForFunction(() => /Enregistrer les modifications/.test(document.getElementById('mt-modal').textContent), null, { timeout: 5000 }).then(() => true, () => false);
    const why = asked ? '' : JSON.stringify(await mt.evaluate(() => ({ dirty: MT.isDirty(), modal: MT.ui.modalOpen, text: (document.getElementById('mt-modal') || {}).textContent, state: ZS.G.state })));
    ok(asked, `fermeture : demande d’enregistrement ${why}`);
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
