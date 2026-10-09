'use strict';
/* Essai de bout en bout : Ombre éternelle (la Lune, jeu 2.0.0, interface 4) dans les Mod Tools du
   launcher 1.3.1. Copie temporaire du launcher avec une clé de test, dossier de données jetable.

     xvfb-run -a node e2e/modtools-ombre.e2e.js

   Vérifie : Ombre éternelle dans la liste des cartes ; ouverture (monde de la Lune, plan carré en
   relief, outils sans routes, genres d'éléments de la Lune) ; carte relue identique à la carte
   intégrée ; poste d'oxygène posé au clic dans le plan (achetable en partie) ; Le Glas déplacé (une
   seule cloche) puis annulé ; relief monté au pinceau hors de la fosse, la fosse protégée ; sol
   peint (éjectas clairs, palette de la Lune) ; module habitable posé (catalogue lunaire), refusé dans
   la fosse ; arme au mur contre le module ; règles sans tempêtes ; enregistrement (format des cartes
   ouvertes, oxygène et cloche) ; liste de publication editor 4 ; partie de test (F5) sur la Lune,
   puis retour ; nouvelle carte « Lune vierge » ; Khamsin rouverte (le désert, ses outils) ;
   publication : paquet avec maps/ombre.json, que le jeu charge à la place de la carte intégrée. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { _electron: electron, chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-lu-'));
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
    await mt.setViewportSize({ width: 1600, height: 900 }).catch(() => {});
    await mt.waitForFunction(() => document.documentElement.dataset.modtools === 'ready', null, { timeout: 120000 });
    const planAt = (x, z) => mt.evaluate(([wx, wz]) => { const r = MT.plan.canvas.getBoundingClientRect(), [sx, sy] = MT.plan.toScreen(wx, wz); return [r.left + sx, r.top + sy]; }, [x, z]);
    const until = (fn, arg, ms = 60000) => mt.waitForFunction(fn, arg, { timeout: ms });
    const rebuilt = () => until(() => !MT.v3.rebuildAt && !MT.v3.owElDirty && !MT.v3.propsDirty && !MT.v3.worldDirty, null);
    const view = async (x, z, zoom) => { await mt.evaluate(([x, z, zoom]) => { MT.plan.centerOn(x, z, false); MT.plan.cam.zoom = zoom; MT.plan.need = true; }, [x, z, zoom]); await mt.waitForTimeout(500); };
    const click = async (x, z) => { const p = await planAt(x, z); await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(250); await mt.mouse.down(); await mt.mouse.up(); };
    const ground = (x, z) => mt.evaluate(([x, z]) => ZS.ow.ground(x, z), [x, z]);

    // 1. Ombre éternelle dans la liste ; ouverture : la Lune, outils et genres d'éléments de la Lune
    const list = await mt.evaluate(() => ({ moon: MT.ow.okMoon(), all: MT.gameMaps().list.join(), pub: MT.state.publish.maps.join(), api: ZS.editorApi }));
    ok(list.moon && list.api >= 4 && list.all === 'bunker7,khamsin,ombre' && list.pub === 'bunker7,khamsin,ombre', `Ombre éternelle parmi les cartes du jeu et de la publication ${JSON.stringify(list)}`);
    const t0 = Date.now();
    await mt.evaluate(() => { MT.openGameMap('ombre'); MT.ui.setView('split'); });
    await until(() => MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 180000);
    const open = await mt.evaluate(() => ({
      tools: MT.tools.available().map((t) => t.id).join(), kinds: MT.ow.KIND_KEYS.join(), world: MT.ow.world(), w: ZS.ow.worldId, base: ZS.ow.baseId,
      on: ZS.ow.on, editor: ZS.CUR.editor, issues: MT.state.issues.errors.length + MT.state.issues.warnings.length, st: document.getElementById('st-map').textContent,
      plan: [MT.ow.plan.base.width, MT.ow.plan.base.height], far: MT.v3.cam.far, glas: !!ZS.ow.objs.glas && ZS.ow.objs.glas.length, oxy: ZS.ow.objs.oxy.length,
      bld: Object.keys(ZS.ow.BUILDINGS).every((id) => /^lu_/.test(id)), paints: ZS.ow.PAINTS.map((p) => p.id).join(), paintName: MT.ow.terrain.PAINT.EJECTA && MT.ow.terrain.PAINT.EJECTA[0],
      locs: MT.ow.baseLocs().length, overlay: document.getElementById('mt-ow-loading'),
    }));
    ok(open.tools === 'select,props,elements,terrain,ground,buildings' && open.kinds === 'spawn,wallbuy,perk,box,breaker,oxy,glas,loc' && open.world === 'lune' && open.w === 'lune' && open.base === 'ombre'
      && open.on && open.editor && open.issues === 0 && /1,4 × 1,4 km · 0 objet · 33 éléments/.test(open.st) && open.plan[0] === open.plan[1] && open.far > 8000 && open.glas === 1 && open.oxy === 6
      && open.bld && open.paints === 'SAND,DARKSOIL,EJECTA,ROCK,PAD,BENCH,ICE' && open.paintName === 'Éjectas clairs' && open.locs >= 8,
      `Ombre éternelle ouverte (${((Date.now() - t0) / 1000).toFixed(0)} s) : la Lune, plan carré, pas de routes, oxygène et Le Glas, 33 éléments, aucun problème ${JSON.stringify(open)}`);
    const rt = await mt.evaluate(() => {
      const a = JSON.stringify({ ...ZS.openSerialize(ZS.MAPS_ALL.byId.ombre), updated: '' });
      const b = JSON.stringify({ ...ZS.openSerialize(ZS.openNormalize(JSON.parse(JSON.stringify(ZS.openSerialize(MT.state.map))))), updated: '' });
      const o = ZS.openSerialize(MT.state.map);
      return { same: a === b, oxy: o.oxy.length, glas: !!o.glas, base: o.base };
    });
    ok(rt.same && rt.oxy === 6 && rt.glas && rt.base === 'ombre', `sans modification, la carte relue est identique à la carte intégrée (6 postes d’oxygène, Le Glas) ${JSON.stringify(rt)}`);

    // 2. poste d'oxygène posé au clic dans le plan, sur le régolithe (sans mur : face choisie)
    await mt.evaluate(() => { MT.setTool('elements'); MT.state.opts.ow.kind = 'oxy'; MT.state.opts.ow.face = [0, 1]; MT.emit('tool-opts'); });
    await view(920, 760, 12);
    await click(920, 760);
    await rebuilt();
    const ox = await mt.evaluate(() => {
      const m = MT.state.map, e = m.oxy[m.oxy.length - 1];
      return { n: m.oxy.length, e, sel: MT.state.sel, inter: ZS.Features.interactables.filter((q) => q.kind === 'oxy').length, objs: ZS.ow.objs.oxy.length, label: MT.state.undo[MT.state.undo.length - 1].label };
    });
    ok(ox.n === 7 && Math.abs(ox.e.x - 920) < 0.5 && Math.abs(ox.e.z - 760) < 0.5 && ox.e.face.join() === '0,1' && ox.inter === 7 && ox.objs === 7 && ox.sel.kind === 'oxy' && /oxygène/.test(ox.label),
      `poste d’oxygène posé au clic (7 sur la carte, achetable en partie) ${JSON.stringify(ox.e)}`);

    // 3. Le Glas : un clic ailleurs le déplace (une seule cloche) ; annuler le remet
    const g0 = await mt.evaluate(() => ({ ...MT.state.map.glas }));
    await mt.evaluate(() => { MT.state.opts.ow.kind = 'glas'; MT.emit('tool-opts'); });
    await view(950, 800, 6);
    await click(950, 800);
    await rebuilt();
    const g1 = await mt.evaluate(() => ({ g: MT.state.map.glas, amp: ZS.Features.amp && [Math.round(ZS.Features.amp.cx), Math.round(ZS.Features.amp.cz)], label: MT.state.undo[MT.state.undo.length - 1].label, n: ZS.ow.objs.glas.length }));
    await mt.evaluate(() => MT.undo());
    await rebuilt();
    const g2 = await mt.evaluate(() => ({ g: MT.state.map.glas, amp: ZS.Features.amp && [Math.round(ZS.Features.amp.cx), Math.round(ZS.Features.amp.cz)] }));
    ok(g0.x === 668 && Math.abs(g1.g.x - 950) < 0.5 && g1.amp.join() === '950,800' && g1.n === 1 && /Le Glas/.test(g1.label) && g2.g.x === 668 && g2.amp.join() === '668,1022',
      `Le Glas déplacé au clic (une seule cloche), puis remis au fond de la fosse ${JSON.stringify({ g1: g1.amp, g2: g2.amp })}`);

    // 4. relief : une butte hors de la fosse ; la fosse ne bouge pas
    await mt.evaluate(() => { MT.setTool('terrain'); Object.assign(MT.state.opts.ow.brush, { op: 'raise', size: 24, strength: 0.5 }); MT.emit('tool-opts'); });
    const HX = 1150, HZ = 1250;
    await view(HX, HZ, 3);
    const h0 = await ground(HX, HZ);
    let p = await planAt(HX, HZ);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(300);
    await mt.mouse.down(); await mt.waitForTimeout(900);
    for (let k = 1; k <= 4; k++) { await mt.mouse.move(p[0] + k * 8, p[1]); await mt.waitForTimeout(100); }
    await mt.mouse.up();
    await rebuilt();
    const h1 = await ground(HX, HZ);
    const blocks = await mt.evaluate(() => (MT.state.map.terrain ? Object.keys(MT.state.map.terrain.d).length : 0));
    const PX = 680, PZ = 1007;
    await view(PX, PZ, 3);
    const pit0 = await ground(PX, PZ), prot = await mt.evaluate(([x, z]) => ZS.ow.protectAt(x, z), [PX, PZ]);
    p = await planAt(PX, PZ);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(200);
    await mt.mouse.down(); await mt.waitForTimeout(700); await mt.mouse.up();
    await rebuilt();
    const pit1 = await ground(PX, PZ);
    await mt.evaluate(() => MT.undo()); await rebuilt();
    ok(h1 - h0 > 1 && blocks >= 1 && prot === 0 && Math.abs(pit1 - pit0) < 0.005 && Math.abs(pit0 + 79.7) < 1,
      `relief monté au pinceau hors de la fosse (+${(h1 - h0).toFixed(1)} m) ; le fond de la fosse protégé ${JSON.stringify({ pit0, pit1, prot })}`);

    // 5. sol peint : éjectas clairs (palette de la Lune)
    await mt.evaluate(() => { MT.setTool('ground'); Object.assign(MT.state.opts.ow.paint, { bio: 'EJECTA', size: 14 }); MT.emit('tool-opts'); });
    await view(1100, 1300, 3);
    p = await planAt(1100, 1300);
    await mt.mouse.move(p[0], p[1]); await mt.mouse.down();
    for (let k = 1; k <= 5; k++) { await mt.mouse.move(p[0] + k * 12, p[1] + k * 4); await mt.waitForTimeout(80); }
    await mt.mouse.up();
    await rebuilt();
    const pa = await mt.evaluate(() => ({ bio: OW.bio[owPointIndex(1100, 1300)], ej: OWB.EJECTA, blocks: MT.state.map.ground ? Object.keys(MT.state.map.ground.d).length : 0, label: MT.state.undo[MT.state.undo.length - 1].label }));
    ok(pa.bio === pa.ej && pa.blocks >= 1 && pa.label === 'Peindre le sol', `sol peint au pinceau (éjectas clairs) ${JSON.stringify(pa)}`);

    // 6. bâtiment lunaire : module habitable posé ; refusé dans la fosse ; arme au mur contre lui
    await mt.evaluate(() => { MT.setTool('buildings'); Object.assign(MT.state.opts.ow.bld, { type: 'lu_module', rot: 0 }); MT.emit('tool-opts'); });
    await view(1150, 700, 6);
    await click(1150, 700);
    await rebuilt();
    const bd = await mt.evaluate(() => ({ b: MT.state.map.buildings, objs: ZS.ow.objs.building.length, h: ZS.ow.height(1150, 700) - ZS.ow.ground(1150, 700), wall: ZS.ow.height(1150, 698.5) - ZS.ow.ground(1150, 697) }));
    const pit = await mt.evaluate(() => ZS.ow.buildingPlace('lu_module', 700, 1000, 0));
    ok(bd.b.length === 1 && bd.b[0].type === 'lu_module' && bd.objs === 1 && bd.wall > 3 && !pit.ok && /fosse/.test(pit.why), `module habitable posé (murs pleins), refusé dans la fosse ${JSON.stringify({ b: bd.b[0], wall: bd.wall, why: pit.why })}`);
    await mt.evaluate(() => { MT.setTool('elements'); MT.state.opts.ow.kind = 'wallbuy'; MT.state.opts.ow.weapon = 'stg44'; MT.emit('tool-opts'); });
    await view(1150, 703, 14);
    await click(1150, 703.4);
    await rebuilt();
    const wb = await mt.evaluate(() => { const m = MT.state.map, w = m.wallbuys[m.wallbuys.length - 1]; return { n: m.wallbuys.length, w, inter: ZS.Features.interactables.filter((q) => q.kind === 'wallbuy').length }; });
    ok(wb.n === 13 && wb.w.w === 'stg44' && wb.w.nz === 1 && Math.abs(wb.w.z - 703) < 0.2 && wb.inter === 13, `arme au mur contre le module (face sud) ${JSON.stringify(wb.w)}`);

    // 7. règles : pas de tempêtes sur la Lune ; panneau de la carte
    await mt.evaluate(() => MT.ui.setTab('map'));
    await mt.waitForTimeout(300);
    const rules = await mt.evaluate(() => ({
      storms: [...document.querySelectorAll('#mt-panel select')].some((s) => [...s.options].some((o) => /Toutes les 3 manches/.test(o.textContent))),
      text: document.getElementById('mt-panel').textContent,
    }));
    ok(!rules.storms && /1\/6 g/.test(rules.text) && /Ombre éternelle/.test(rules.text), 'onglet Carte : pas de tempêtes de sable ; la Lune décrite (1/6 g, sans air)');

    // 8. enregistrement dans l'atelier ; liste de publication (editor 4)
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    const saved = await mt.evaluate(async () => ({ ok: await window.__save, dirty: MT.isDirty() }));
    const file = path.join(userData, 'modtools', 'maps', 'ombre.json');
    const fo = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    ok(saved.ok && !saved.dirty && fo.open === true && fo.base === 'ombre' && !fo.grid && fo.oxy.length === 7 && fo.glas && fo.glas.x === 668 && fo.wallbuys.length === 13 && fo.buildings.length === 1 && !!fo.terrain && !!fo.ground && !('thumb' in fo) && !('vehicles' in fo && fo.vehicles.length),
      `enregistrée dans l’atelier : carte ouverte (base ombre), 7 postes d’oxygène, Le Glas, module, relief et sol ${JSON.stringify({ saved, keys: Object.keys(fo).join() })}`);
    await mt.evaluate(() => MT.savePublishSet(['bunker7', 'khamsin', 'ombre']));
    const pubSet = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'publish.json'), 'utf8'));
    ok(pubSet.maps.join() === 'bunker7,khamsin,ombre' && pubSet.editor === 4, 'liste de publication (Mod Tools 1.3.1) : editor 4');

    // 9. partie de test (F5) sur la Lune : 1/6 g, oxygène, poste ajouté ; retour
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 120000);
    const play = await mt.evaluate(() => ({
      map: ZS.G.mapId, on: ZS.ow.on, editor: ZS.CUR.editor, moon: GRAV.moon, g: Math.round(GRAV.feel * 100) / 100, oxy: ZS.Features.interactables.filter((q) => q.kind === 'oxy').length,
      o2: !LUO.el.hidden, wb: ZS.Features.interactables.filter((q) => q.kind === 'wallbuy').length, glas: !!ZS.Features.amp && ZS.Features.amp.lune,
    }));
    ok(play.map === 'ombre' && play.on && !play.editor && play.moon && play.g === 1.62 && play.oxy === 7 && play.o2 && play.wb === 13 && play.glas,
      `partie de test sur la Lune modifiée (1,62 m/s², jauge d’oxygène, 7 postes, 13 armes, Le Glas) ${JSON.stringify(play)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    await mt.click('#btn-quit');
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden && MT.v3.owLoaded && !MT.v3.worldDirty, null, 120000);
    const after = await mt.evaluate(() => ({ editor: ZS.CUR.editor, n: MT.state.map.oxy.length, objs: ZS.ow.objs.oxy.length, dirty: MT.isDirty(), o2: !LUO.el || LUO.el.hidden }));
    ok(after.editor && after.n === 7 && after.objs === 7 && !after.dirty && after.o2, `retour aux Mod Tools : la Lune de l’éditeur rechargée, carte intacte, pas de jauge ${JSON.stringify(after)}`);

    // 10. nouvelle carte « Lune vierge »
    await mt.evaluate(() => { window.__nm = MT.ui.newMap(); });
    await until(() => !!document.querySelector('#mt-modal select'), null, 10000);
    const src = await mt.evaluate(() => [...document.querySelector('#mt-modal select').options].map((o) => o.value));
    await mt.evaluate(() => { const s = document.querySelector('#mt-modal select'); s.value = 'lune'; s.dispatchEvent(new Event('change')); document.querySelector('#mt-modal input[type=text]').value = 'Ma lune'; });
    const note = await mt.evaluate(() => document.querySelector('#mt-modal .p-note').textContent);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((b) => /Créer/.test(b.textContent)).click());
    await until(() => MT.state.map && MT.state.map.base === 'lune' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !MT.v3.worldDirty && !!MT.ow.plan.base, null, 180000);
    const nl = await mt.evaluate(() => ({ id: MT.state.id, base: ZS.ow.baseId, world: ZS.ow.worldId, n: MT.ow.count(), named: ZS.ow.namedLocs().length, warn: MT.state.issues.warnings.map((w) => w.msg).join(' | '), err: MT.state.issues.errors.length, places: !!ZS.ow.BASES.lune.places, thumb: /^data:image\/jpeg/.test(MT.state.map.thumb || '') }));
    ok(src.includes('lune') && /1,4 × 1,4 km/.test(note) && nl.id === 'ma-lune' && nl.base === 'lune' && nl.world === 'lune' && nl.n === 0 && nl.named === 0 && nl.err === 0 && !nl.places && nl.thumb && /poste d’oxygène/.test(nl.warn),
      `nouvelle carte « Lune vierge » : la Lune sans les lieux, conseil pour l’oxygène ${JSON.stringify(nl)}`);

    // 11. Khamsin rouverte : le désert, ses outils et ses genres d'éléments
    await mt.evaluate(() => MT.openGameMap('khamsin'));
    await until(() => MT.state.map && MT.state.map.base === 'khamsin' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !MT.v3.worldDirty, null, 180000);
    const kh = await mt.evaluate(() => ({ world: ZS.ow.worldId, tools: MT.tools.available().map((t) => t.id).join(), kinds: MT.ow.KIND_KEYS.join(), moon: GRAV.moon, far: MT.v3.cam.far, bld: Object.keys(ZS.ow.BUILDINGS).some((id) => /^lu_/.test(id)), issues: MT.state.issues.errors.length }));
    ok(kh.world === 'khamsin' && kh.tools === 'select,props,elements,terrain,ground,roads,buildings' && kh.kinds === 'spawn,wallbuy,perk,box,vehicle,fuel,breaker,loc' && !kh.moon && !kh.bld && kh.issues === 0,
      `Khamsin rouverte : le désert, ses outils (routes) et ses éléments (véhicules) ${JSON.stringify(kh)}`);
    ok(!errs.length, `aucune erreur dans la console des Mod Tools ${errs.slice(0, 3).join(' | ')}`);

    // 12. publication : maps/ombre.json dans le paquet ; le jeu la charge à la place de la carte intégrée
    const [pub] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), mt.evaluate(() => MT.api.openPublisher())]);
    await pub.waitForFunction(() => document.querySelectorAll('#maps-list li').length === 3, null, { timeout: 30000 });
    const res = await pub.evaluate((outDir) => window.pub.create({ gameSource: 'installed', version: '9.9.9', notes: 'essai', outDir, repo: '' }), path.join(TMP, 'publications'));
    const { extractZip } = require('../src/main/updater');
    const x = path.join(TMP, 'paquet');
    await extractZip(path.join(res.dir, `zombie-survival-${res.version}.zip`), x);
    const index = JSON.parse(fs.readFileSync(path.join(x, 'maps', 'index.json'), 'utf8'));
    ok(index.maps.join() === 'bunker7,khamsin,ombre' && index.files.join() === 'ombre' && index.editor === 4 && fs.existsSync(path.join(x, 'maps', 'ombre.json')), `paquet publié : maps/ombre.json, liste editor 4 ${JSON.stringify(index)}`);
    await closeAll(app);
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
      const perr = [];
      page.on('pageerror', (e) => perr.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
      await page.waitForFunction(() => window.ZS && ZS.G.state === 'menu', null, { timeout: 180000 });
      const g = await page.evaluate(() => { const m = ZS.MAPS_ALL.byId.ombre; return { list: ZS.MAPS_ALL.list.join(), src: m.source, oxy: m.oxy.length, glas: !!m.glas, bld: m.buildings.length, wb: m.wallbuys.length, thumb: /^data:image\/jpeg/.test(m.thumb || '') }; });
      ok(g.list === 'bunker7,khamsin,ombre' && g.src === 'package' && g.oxy === 7 && g.glas && g.bld === 1 && g.wb === 13 && g.thumb, `jeu publié : Ombre éternelle vient du fichier des Mod Tools ${JSON.stringify(g)}`);
      await page.evaluate(() => { window.frame = function () {}; renderEnabled = false; __zs.map('ombre'); __zs.start(); });
      await page.waitForFunction(() => ZS.G.state === 'playing' || ZS.G.state === 'paused', null, { timeout: 180000 });
      const pl = await page.evaluate(([x, z]) => ({ map: ZS.G.mapId, base: ZS.ow.baseId, h: ZS.ow.ground(x, z), bld: ZS.ow.objs.building.length, oxy: ZS.Features.interactables.filter((q) => q.kind === 'oxy').length, moon: GRAV.moon }), [HX, HZ]);
      ok(pl.map === 'ombre' && pl.base === 'ombre' && Math.abs(pl.h - h1) < 0.05 && pl.bld === 1 && pl.oxy === 7 && pl.moon && !perr.length,
        `jeu publié : partie sur la Lune modifiée (butte, module, 7 postes d’oxygène) ${JSON.stringify(pl)} ${perr.slice(0, 2).join(' | ')}`);
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
  console.log(failures ? `${failures} échec(s)` : 'Ombre éternelle (la Lune) dans les Mod Tools : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
