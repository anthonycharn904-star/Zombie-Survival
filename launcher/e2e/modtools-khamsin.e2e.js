'use strict';
/* Essai de bout en bout : Khamsin (monde ouvert, jeu 2.0.0) dans les Mod Tools du launcher 1.3.0.
   Copie temporaire du launcher avec une clé de test, dossier de données jetable.

     xvfb-run -a node e2e/modtools-khamsin.e2e.js

   Vérifie : Khamsin dans la liste des cartes ; ouverture (monde du jeu, plan en relief, outils des
   cartes ouvertes) ; carte intacte sans modification (fichier identique à la carte intégrée) ; arme
   au mur posée au clic dans le plan (recalée sur la face visible du mur) ; atout posé au clic en 3D
   contre le mur du café ; véhicule glissé dans le plan (l'objet 3D suit) puis annulé ; objet de la
   bibliothèque posé (ses cases arrêtent le joueur) ; rotation, suppression, annuler ; règles
   (tempêtes) ; problèmes (un élément dans l'eau) ; enregistrement dans l'atelier (format des cartes
   ouvertes) et liste de publication ; partie de test (F5) avec les modifications, puis retour ;
   copie de Khamsin ; retour à Bunker 7 ; publication : paquet avec maps/khamsin.json, que le jeu
   charge à la place de la carte intégrée. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { _electron: electron, chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-kh-'));
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
async function closeAll(app) {
  await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) w.allowClose = true; }).catch(() => {});
  await app.close().catch(() => {});
}

async function run(userData) {
  const args = [APP];
  if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
  const app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: userData }, timeout: 60000 });
  try {
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => document.getElementById('status-title').textContent !== 'Ouverture du bunker…', null, { timeout: 60000 });
    const [mt] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-modtools')]);
    const errs = [];
    mt.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    mt.on('console', (m) => { if (m.type() === 'error') errs.push(`console.error: ${m.text().slice(0, 300)}`); });
    await mt.waitForFunction(() => document.documentElement.dataset.modtools === 'ready', null, { timeout: 120000 });
    const planAt = (x, z) => mt.evaluate(([wx, wz]) => { const r = MT.plan.canvas.getBoundingClientRect(), [sx, sy] = MT.plan.toScreen(wx, wz); return [r.left + sx, r.top + sy]; }, [x, z]);
    const until = (fn, arg, ms = 60000) => mt.waitForFunction(fn, arg, { timeout: ms });
    const rebuilt = () => until(() => !MT.v3.rebuildAt && !MT.v3.owElDirty && !MT.v3.propsDirty && !MT.v3.worldDirty, null);

    // 1. Khamsin dans la liste, ouverture : monde du jeu, outils des cartes ouvertes
    const list = await mt.evaluate(() => ({ ow: MT.ow.ok(), all: MT.gameMaps().list.join(), pub: MT.state.publish.maps.join(), api: ZS.editorApi }));
    ok(list.ow && list.api >= 4 && list.all === 'bunker7,khamsin,ombre' && list.pub === 'bunker7,khamsin,ombre', `Khamsin parmi les cartes du jeu et de la publication (puis Ombre éternelle) ${JSON.stringify(list)}`);
    const t0 = Date.now();
    await mt.evaluate(() => { MT.openGameMap('khamsin'); MT.ui.setView('split'); });
    await until(() => MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 120000);
    const open = await mt.evaluate(() => ({
      tools: MT.tools.available().map((t) => t.id).join(), cls: document.body.classList.contains('mt-open'), levels: document.getElementById('mt-levels').hidden,
      on: ZS.ow.on, editor: ZS.CUR.editor, issues: MT.state.issues.errors.length + MT.state.issues.warnings.length, st: document.getElementById('st-map').textContent,
      same: JSON.stringify(MT.ow.exportObject(MT.util.deep(MT.state.map)).wallbuys) === JSON.stringify(ZS.openSerialize(ZS.MAPS_ALL.byId.khamsin).wallbuys),
      far: MT.v3.cam.far,
    }));
    ok(open.tools === 'select,props,elements,terrain,ground,roads,buildings' && open.cls && open.levels && open.on && open.editor && open.issues === 0 && /4 × 3 km · 0 objet · 35 éléments/.test(open.st) && open.same && open.far > 3000,
      `Khamsin ouverte dans les Mod Tools (${((Date.now() - t0) / 1000).toFixed(0)} s) : monde du jeu, 35 éléments, aucun problème ${JSON.stringify(open)}`);
    const rt = await mt.evaluate(() => {
      const a = JSON.stringify({ ...ZS.openSerialize(ZS.MAPS_ALL.byId.khamsin), updated: '' });
      const b = JSON.stringify({ ...ZS.openSerialize(ZS.openNormalize(JSON.parse(JSON.stringify(ZS.openSerialize(MT.state.map))))), updated: '' });
      return a === b;
    });
    ok(rt, 'sans modification, la carte relue est identique à la carte intégrée');

    // 2. arme au mur : outil Éléments, clic dans le plan entre deux panneaux de la tente-réfectoire
    await mt.evaluate(() => { MT.setTool('elements'); MT.state.opts.ow.kind = 'wallbuy'; MT.state.opts.ow.weapon = 'thompson'; MT.emit('tool-opts'); MT.plan.centerOn(2306, 1961, false); MT.plan.cam.zoom = 14; MT.plan.need = true; });
    await mt.waitForTimeout(400);
    let p = await planAt(2302.5, 1960.2);
    await mt.mouse.move(p[0], p[1]);
    await mt.waitForTimeout(300);
    const ghost = await mt.evaluate(() => MT.preview.ow);
    await mt.mouse.down(); await mt.mouse.up();
    await rebuilt();
    const wb = await mt.evaluate(() => {
      const m = MT.state.map, w = m.wallbuys[m.wallbuys.length - 1];
      return { n: m.wallbuys.length, w, sel: MT.state.sel, inter: ZS.Features.interactables.filter((q) => q.kind === 'wallbuy').length, mesh: ZS.ow.objs.wallbuy.length, issues: MT.state.issues.errors.length };
    });
    ok(ghost && ghost.ok && wb.n === 13 && wb.w.w === 'thompson' && wb.w.nz === 1 && Math.abs(wb.w.z - 1958.08) < 0.05 && wb.inter === 13 && wb.mesh === 13 && wb.sel.kind === 'wallbuy' && wb.issues === 0,
      `arme au mur posée au clic : sur la toile de la tente (face visible, entre deux panneaux), achetable en partie ${JSON.stringify(wb.w)}`);

    // 3. atout posé en 3D : clic sur le mur nord du café (relais Km 47)
    await mt.evaluate(() => {
      MT.state.opts.ow.kind = 'perk'; MT.state.opts.ow.perk = 'cuirasse'; MT.emit('tool-opts');
      MT.v3.cam.position.set(1402, 18.7, 2583.5); MT.v3.yaw = 0; MT.v3.pitch = -0.1; MT.v3.int.applyCamera(); MT.emit('camera3d');
    });
    await mt.waitForTimeout(1500);
    p = await mt.evaluate(() => { const vp = document.getElementById('mt-3d-pane').getBoundingClientRect(); return [vp.left + vp.width / 2, vp.top + vp.height / 2]; });
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(400);
    await mt.mouse.down(); await mt.mouse.up();
    await rebuilt();
    const pk = await mt.evaluate(() => { const m = MT.state.map, e = m.perks[m.perks.length - 1]; return { n: m.perks.length, e, machines: ZS.Features.perkMachines.length, warn: MT.state.issues.warnings.map((w) => w.msg).join(' | ') }; });
    ok(pk.n === 6 && pk.e.p === 'cuirasse' && pk.e.face.join() === '0,1' && Math.abs(pk.e.z - 2581.05) < 0.2 && pk.machines === 6 && /Mastodonte : 2 machines/.test(pk.warn),
      `atout posé au clic en 3D, dos au mur du café ; conseil : deux Mastodonte ${JSON.stringify(pk.e)}`);

    // 4. véhicule glissé dans le plan (le 4×4 suit en 3D), puis annulé
    await mt.evaluate(() => { MT.setTool('select'); MT.select(null); MT.plan.centerOn(2392, 2052, false); MT.plan.cam.zoom = 8; MT.plan.need = true; });
    await mt.waitForTimeout(300);
    const v0 = await mt.evaluate(() => ({ ...MT.state.map.vehicles[0] }));
    const a = await planAt(v0.x, v0.z), b = await planAt(v0.x - 6, v0.z + 5);
    await mt.mouse.move(a[0], a[1]); await mt.mouse.down();
    for (let k = 1; k <= 8; k++) { await mt.mouse.move(a[0] + ((b[0] - a[0]) * k) / 8, a[1] + ((b[1] - a[1]) * k) / 8); await mt.waitForTimeout(40); }
    const mid = await mt.evaluate(() => ({ data: [MT.state.map.vehicles[0].x, MT.state.map.vehicles[0].z], obj: [ZS.ow.vehicles[0].x, ZS.ow.vehicles[0].z] }));
    await mt.mouse.up();
    await rebuilt();
    const moved = await mt.evaluate(() => ({ v: MT.state.map.vehicles[0], label: MT.state.undo[MT.state.undo.length - 1].label }));
    await mt.evaluate(() => MT.undo());
    await rebuilt();
    const back = await mt.evaluate(() => ({ v: MT.state.map.vehicles[0], obj: [ZS.ow.vehicles[0].x, ZS.ow.vehicles[0].z] }));
    ok(Math.abs(mid.data[0] - (v0.x - 6)) < 0.6 && Math.abs(mid.data[1] - (v0.z + 5)) < 0.6 && mid.obj.join() === mid.data.join() && moved.label === 'Déplacer'
      && back.v.x === v0.x && back.v.z === v0.z && back.obj.join() === `${v0.x},${v0.z}`, `véhicule glissé dans le plan (le 4×4 suit en 3D), puis annulé ${JSON.stringify({ mid, back: back.obj })}`);

    // 5. objet de la bibliothèque : posé dans le plan, ses cases arrêtent le joueur
    await mt.evaluate(() => { MT.setTool('props'); MT.state.opts.props.model = 'crate_medium'; MT.state.opts.props.snap = 0.25; MT.emit('tool-opts'); MT.plan.centerOn(2335, 1975, false); MT.plan.cam.zoom = 14; MT.plan.need = true; });
    await mt.waitForTimeout(300);
    p = await planAt(2336.3, 1975.4);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(250);
    await mt.mouse.down(); await mt.mouse.up();
    await rebuilt();
    const pr = await mt.evaluate(() => {
      const m = MT.state.map, q = m.props[m.props.length - 1];
      const up = (x, z) => Math.round((ZS.ow.height(x, z) - ZS.ow.ground(x, z)) * 100) / 100;
      return { q, groups: ZS.ow.props.children.length, here: up(q.x, q.z), beside: up(q.x + 4, q.z) };
    });
    ok(pr.q.m === 'crate_medium' && pr.q.x === 2336.25 && pr.q.z === 1975.5 && pr.groups === 1 && pr.here > 0.8 && pr.beside === 0, `objet posé au clic (grille de 25 cm) : une caisse pleine de 90 cm (on ne l’enjambe pas) ${JSON.stringify(pr)}`);

    // 6. rotation, suppression, annuler ; règles (tempêtes) ; problème (véhicule dans le Nil)
    const rd = await mt.evaluate(() => {
      MT.setTool('select');
      MT.select({ kind: 'vehicle', i: 2 }); const y0 = MT.state.map.vehicles[2].yaw; MT.tools.rotate(1, false); const y1 = MT.state.map.vehicles[2].yaw;
      MT.select({ kind: 'box', i: 3 }); const f0 = MT.state.map.boxes[3].face.join(); MT.tools.rotate(1, false); const f1 = MT.state.map.boxes[3].face.join();
      MT.select({ kind: 'fuel', i: 2 }); MT.deleteSelection(); const nf = MT.state.map.fuel.length;
      MT.undo(); MT.undo(); MT.undo();
      return { y0, y1, f0, f1, nf, back: [MT.state.map.vehicles[2].yaw, MT.state.map.boxes[3].face.join(), MT.state.map.fuel.length] };
    });
    ok(Math.abs(rd.y1 - rd.y0 - Math.PI / 12) < 1e-3 && rd.f0 !== rd.f1 && rd.nf === 2 && rd.back[0] === rd.y0 && rd.back[1] === rd.f0 && rd.back[2] === 3, `R tourne (véhicule +15°, boîte d’un quart de tour), Suppr retire, Ctrl+Z remet ${JSON.stringify(rd)}`);
    await mt.evaluate(() => MT.ui.setTab('map'));
    await mt.waitForTimeout(300);
    const st = await mt.evaluate(() => {
      const sel = [...document.querySelectorAll('#mt-panel select')].find((s) => [...s.options].some((o) => /Toutes les 3 manches/.test(o.textContent)));
      if (sel) { sel.value = '6'; sel.dispatchEvent(new Event('change')); }
      return MT.state.map.rules.storms;
    });
    ok(st === 6, 'règles : une tempête toutes les 6 manches (onglet Carte)');
    const issue = await mt.evaluate(async () => {
      MT.edit('Véhicule', (m) => { m.vehicles.push({ type: 'buggy', x: 3900, z: 1500, yaw: 0 }); }, 'ow-el');
      await new Promise((r) => setTimeout(r, 600));
      MT.validateNow();
      const e = MT.state.issues.errors.map((x) => x.msg);
      MT.undo();
      MT.validateNow();
      return { e, after: MT.state.issues.errors.length };
    });
    ok(issue.e.some((m) => /Buggy des sables : dans l’eau/.test(m)) && issue.after === 0, `problèmes : un véhicule dans le Nil est une erreur ${JSON.stringify(issue.e)}`);
    await rebuilt();

    // 7. enregistrement dans l'atelier : format des cartes ouvertes ; liste de publication
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    const saved = await mt.evaluate(async () => ({ ok: await window.__save, dirty: MT.isDirty(), src: MT.state.source }));
    const file = path.join(userData, 'modtools', 'maps', 'khamsin.json');
    const fo = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    ok(saved.ok && !saved.dirty && fo.open === true && fo.base === 'khamsin' && !fo.grid && fo.wallbuys.length === 13 && fo.perks.length === 6 && fo.props.length === 1 && fo.rules.storms === 6 && !('thumb' in fo),
      `enregistrée dans l’atelier : carte ouverte (base khamsin, sans grille ni vignette), 13 armes, 6 atouts, 1 objet ${JSON.stringify({ saved, keys: Object.keys(fo).join() })}`);
    await mt.evaluate(() => MT.savePublishSet(['bunker7', 'khamsin']));
    const pubSet = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'publish.json'), 'utf8'));
    ok(pubSet.maps.join() === 'bunker7,khamsin' && pubSet.editor === 4, 'liste de publication (Mod Tools 1.3.1) : editor 4');

    // 8. partie de test (F5) : les modifications sont dans la partie ; retour
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 90000);
    const play = await mt.evaluate(() => ({ map: ZS.G.mapId, on: ZS.ow.on, editor: ZS.CUR.editor, wb: ZS.Features.interactables.filter((q) => q.kind === 'wallbuy').length, perks: ZS.Features.perkMachines.length }));
    ok(play.map === 'khamsin' && play.on && !play.editor && play.wb === 13 && play.perks === 6, `partie de test sur Khamsin modifiée (13 armes au mur, 6 atouts) ${JSON.stringify(play)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    await mt.click('#btn-quit');
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden && MT.v3.owLoaded && !MT.v3.worldDirty, null, 90000);
    const after = await mt.evaluate(() => ({ editor: ZS.CUR.editor, n: MT.state.map.wallbuys.length, objs: ZS.ow.objs.wallbuy.length, props: ZS.ow.props.children.length, dirty: MT.isDirty() }));
    ok(after.editor && after.n === 13 && after.objs === 13 && after.props === 1 && !after.dirty, `retour aux Mod Tools : monde de l’éditeur rechargé, carte intacte ${JSON.stringify(after)}`);

    // 9. copie de Khamsin (nouvelle carte), puis Bunker 7 (moteur de grille)
    await mt.evaluate(() => { const m = MT.copyOfMap(MT.gameMaps().byId.khamsin); m.id = MT.uniqueId('khamsin'); m.name = 'Khamsin bis'; MT.openMap(m, { id: m.id, source: 'new' }); });
    await until(() => MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !MT.v3.worldDirty, null, 60000);
    const cp = await mt.evaluate(() => ({ id: MT.state.id, n: MT.ow.count(), props: MT.state.map.props.length }));
    ok(cp.id === 'khamsin-2' && cp.n === 35 && cp.props === 0, `copie de Khamsin (carte du jeu, pas celle de l’atelier) ${JSON.stringify(cp)}`);
    await mt.evaluate(() => MT.openGameMap('bunker7'));
    await mt.waitForTimeout(1500);
    const b7 = await mt.evaluate(() => ({ tools: MT.tools.available().map((t) => t.id).join(), cls: document.body.classList.contains('mt-open'), owOn: ZS.ow.on, far: MT.v3.cam.far, grid: !!MT.state.map.grid }));
    ok(b7.tools === 'select,build,paint,props,elements,stairs' && !b7.cls && !b7.owOn && b7.far === 700 && b7.grid, `retour à Bunker 7 : outils et moteur de grille ${JSON.stringify(b7)}`);
    ok(!errs.length, `aucune erreur dans la console des Mod Tools ${errs.slice(0, 3).join(' | ')}`);

    // 10. publication : maps/khamsin.json dans le paquet ; le jeu la charge à la place de la carte intégrée
    const [pub] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), mt.evaluate(() => MT.api.openPublisher())]);
    await pub.waitForFunction(() => document.querySelectorAll('#maps-list li').length === 2, null, { timeout: 30000 });
    const res = await pub.evaluate((outDir) => window.pub.create({ gameSource: 'installed', version: '9.9.9', notes: 'essai', outDir, repo: '' }), path.join(TMP, 'publications'));
    const { extractZip } = require('../src/main/updater');
    const x = path.join(TMP, 'paquet');
    await extractZip(path.join(res.dir, `zombie-survival-${res.version}.zip`), x);
    const index = JSON.parse(fs.readFileSync(path.join(x, 'maps', 'index.json'), 'utf8'));
    ok(index.maps.join() === 'bunker7,khamsin' && index.files.join() === 'khamsin' && index.editor === 4 && fs.existsSync(path.join(x, 'maps', 'khamsin.json')), `paquet publié : maps/khamsin.json, liste editor 4 (la liste retire Ombre éternelle : le jeu la suit) ${JSON.stringify(index)}`);
    await closeAll(app);
    // le paquet dans un navigateur : Khamsin vient du fichier (13 armes au mur, une tempête toutes les 6 manches)
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
    const server = http.createServer((req, rs) => {
      const f = path.join(x, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!f.startsWith(x) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); rs.end(); return; }
      rs.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rs);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    try {
      const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
      await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 180000 });
      const g = await page.evaluate(() => { const m = ZS.MAPS_ALL.byId.khamsin; return { list: ZS.MAPS_ALL.list.join(), src: m.source, wb: m.wallbuys.length, perks: m.perks.length, props: m.props.length, storms: m.rules.storms, thumb: !!m.thumb }; });
      ok(g.list === 'bunker7,khamsin' && g.src === 'package' && g.wb === 13 && g.perks === 6 && g.props === 1 && g.storms === 6 && g.thumb, `jeu publié : Khamsin vient du fichier des Mod Tools ${JSON.stringify(g)}`);
    } finally { await browser.close(); server.close(); }
  } finally { await closeAll(app); }
}

(async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  makeApp(publicKey.export({ type: 'spki', format: 'pem' }));
  const userData = path.join(TMP, 'auteur');
  fs.mkdirSync(path.join(userData, 'publisher'), { recursive: true });
  fs.writeFileSync(path.join(userData, 'publisher', 'signing-key.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  try {
    await run(userData);
  } catch (e) {
    failures++;
    console.error('ÉCHEC', e);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s)` : 'Khamsin dans les Mod Tools : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
