'use strict';
/* Essai de bout en bout : Mod Tools 1.3.0, cartes ouvertes niveau 2 (relief, sol, routes, bâtiments,
   lieux nommés) sur une nouvelle carte « Désert vierge ». Copie temporaire du launcher avec une clé
   de test, dossier de données jetable.

     xvfb-run -a node e2e/modtools-desert.e2e.js

   Vérifie : nouvelle carte « Désert vierge » (le désert de Khamsin sans ses lieux) ; relief monté au
   pinceau dans le plan, annuler, rétablir, Échap pendant un coup ; route d'origine protégée ; sol
   peint ; route tracée point par point puis un point glissé ; bâtiment posé (refusé sur une route
   d'origine), tourné, glissé, supprimé puis remis ; lieu nommé posé et renommé ; arme au mur et
   emplacement de la boîte contre le bâtiment ; enregistrement (blocs de relief et de sol, routes,
   bâtiments, lieux) ; partie de test (F5) avec le terrain modifié ; Khamsin intacte à côté ;
   carte relue depuis l'atelier ; publication : paquet avec maps/<id>.json, que le jeu publié
   charge (base désert, relief, bâtiment, lieu). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { _electron: electron, chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-ds-'));
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
    const ground = (x, z) => mt.evaluate(([x, z]) => ZS.ow.ground(x, z), [x, z]);
    const lastLabel = () => mt.evaluate(() => (MT.state.undo.length ? MT.state.undo[MT.state.undo.length - 1].label : null));

    // 1. nouvelle carte « Désert vierge »
    await mt.evaluate(() => { window.__nm = MT.ui.newMap(); });
    await until(() => !!document.querySelector('#mt-modal select'), null, 10000);
    const src = await mt.evaluate(() => [...document.querySelector('#mt-modal select').options].map((o) => o.value));
    await mt.evaluate(() => { const s = document.querySelector('#mt-modal select'); s.value = 'desert'; s.dispatchEvent(new Event('change')); document.querySelector('#mt-modal input[type=text]').value = 'Mon désert'; });
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((b) => /Créer/.test(b.textContent)).click());
    await until(() => MT.state.map && MT.state.map.base === 'desert' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !MT.v3.worldDirty && !!MT.ow.plan.base, null, 180000);
    await mt.evaluate(() => MT.ui.setView('split'));
    const d0 = await mt.evaluate(() => ({
      id: MT.state.id, src: MT.state.source, tools: MT.tools.available().map((t) => t.id).join(), base: ZS.ow.baseId, named: ZS.ow.namedLocs().length,
      inter: ZS.Features.interactables.length, warn: MT.state.issues.warnings.length, err: MT.state.issues.errors.length, where: MT.ow.where(2350, 1992),
    }));
    ok(src.includes('desert') && d0.id === 'mon-desert' && d0.src === 'new' && d0.tools === 'select,props,elements,terrain,ground,roads,buildings' && d0.base === 'desert' && d0.named === 0 && d0.inter === 0 && d0.err === 0 && d0.warn === 3 && d0.where === '',
      `nouvelle carte « Désert vierge » : le désert sans les lieux de Khamsin, outils du niveau 2 ${JSON.stringify(d0)}`);

    // 2. relief : monter une butte au pinceau (tenu, puis glissé) ; annuler, rétablir
    const HX = 2230, HZ = 2150;
    await mt.evaluate(() => { MT.setTool('terrain'); Object.assign(MT.state.opts.ow.brush, { op: 'raise', size: 24, strength: 0.5 }); MT.emit('tool-opts'); });
    await view(HX, HZ, 3);
    const h0 = await ground(HX, HZ);
    let p = await planAt(HX, HZ);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(300);
    const brush = await mt.evaluate(() => MT.preview.brush);
    await mt.mouse.down(); await mt.waitForTimeout(900);
    for (let k = 1; k <= 4; k++) { await mt.mouse.move(p[0] + k * 8, p[1]); await mt.waitForTimeout(100); }
    await mt.mouse.up();
    await rebuilt();
    const h1 = await ground(HX, HZ);
    const hb = await mt.evaluate(() => ({ blocks: MT.state.map.terrain ? Object.keys(MT.state.map.terrain.d).length : 0, dirty: MT.isDirty() }));
    const l1 = await lastLabel();
    ok(brush && brush.r === 24 && h1 - h0 > 1 && hb.blocks >= 1 && hb.dirty && l1 === 'Relief : monter', `relief monté au pinceau dans le plan (+${(h1 - h0).toFixed(1)} m, ${hb.blocks} bloc)`);
    await mt.evaluate(() => MT.undo()); await rebuilt();
    const hu = await ground(HX, HZ);
    await mt.evaluate(() => MT.redo()); await rebuilt();
    const hr = await ground(HX, HZ);
    ok(Math.abs(hu - h0) < 0.02 && Math.abs(hr - h1) < 0.02, `annuler : terrain d’origine ; rétablir : la butte revient ${JSON.stringify({ h0, hu, h1, hr })}`);
    // Échap pendant un coup : rien ne reste
    const E = await mt.evaluate(() => { const x = 2150, z = 2090, c = MT.plan.canvas.getBoundingClientRect(), [sx, sy] = MT.plan.toScreen(x, z); return { x, z, prot: ZS.ow.protectAt(x, z), pt: [c.left + sx, c.top + sy] }; });
    const e0 = await ground(E.x, E.z);
    await mt.mouse.move(E.pt[0], E.pt[1]); await mt.mouse.down(); await mt.waitForTimeout(700);
    const e1 = await ground(E.x, E.z);
    await mt.keyboard.press('Escape'); await mt.mouse.up(); await mt.waitForTimeout(600);
    const e2 = await ground(E.x, E.z);
    const nUndo = await mt.evaluate(() => MT.state.undo.length);
    ok(E.prot > 0.99 && e1 > e0 + 0.1 && Math.abs(e2 - e0) < 0.01 && nUndo === 1, `Échap pendant un coup de pinceau : le terrain revient, rien dans l’historique ${JSON.stringify({ e0, e1, e2, nUndo })}`);

    // 3. route d'origine protégée : le relief ne bouge pas sous elle
    const R47 = await mt.evaluate(() => { const r = ZS.ow.roads().find((q) => q.id === 'r47'), [x, z] = r.pts[Math.floor(r.pts.length / 2)]; return { x, z, p: ZS.ow.protectAt(x, z) }; });
    await view(R47.x, R47.z, 3);
    const r0 = await ground(R47.x, R47.z);
    p = await planAt(R47.x, R47.z);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(200);
    await mt.mouse.down(); await mt.waitForTimeout(700); await mt.mouse.up();
    await rebuilt();
    const r1 = await ground(R47.x, R47.z);
    ok(R47.p === 0 && Math.abs(r1 - r0) < 0.005, `route d’origine protégée : pas de relief sous elle ${JSON.stringify({ r0, r1 })}`);
    await mt.evaluate(() => MT.undo()); await rebuilt();

    // 4. sol peint (herbe d'oasis)
    await mt.evaluate(() => { MT.setTool('ground'); Object.assign(MT.state.opts.ow.paint, { bio: 'OASIS', size: 14 }); MT.emit('tool-opts'); });
    await view(2290, 2120, 3);
    p = await planAt(2290, 2120);
    await mt.mouse.move(p[0], p[1]); await mt.mouse.down();
    for (let k = 1; k <= 5; k++) { await mt.mouse.move(p[0] + k * 12, p[1] + k * 4); await mt.waitForTimeout(80); }
    await mt.mouse.up();
    await rebuilt();
    const pa = await mt.evaluate(() => ({ bio: OW.bio[owPointIndex(2290, 2120)], oasis: OWB.OASIS, blocks: MT.state.map.ground ? Object.keys(MT.state.map.ground.d).length : 0, label: MT.state.undo[MT.state.undo.length - 1].label }));
    ok(pa.bio === pa.oasis && pa.blocks >= 1 && pa.label === 'Peindre le sol', `sol peint au pinceau (herbe d’oasis) ${JSON.stringify(pa)}`);

    // 5. route tracée point par point (Entrée pour finir), puis un point glissé
    await mt.evaluate(() => { MT.setTool('roads'); Object.assign(MT.state.opts.ow.road, { kind: 'road', w: 8 }); MT.emit('tool-opts'); });
    await view(2245, 2245, 3);
    for (const [x, z] of [[2180, 2230], [2240, 2260], [2310, 2245]]) {
      p = await planAt(x, z);
      await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(120); await mt.mouse.down(); await mt.mouse.up(); await mt.waitForTimeout(120);
    }
    await mt.keyboard.press('Enter');
    await rebuilt();
    const rd = await mt.evaluate(() => ({ roads: MT.state.map.roads, sel: MT.state.sel, bio: OW.bio[owPointIndex(2240, 2260)], road: OWB.ROAD, label: MT.state.undo[MT.state.undo.length - 1].label, meshes: (ZS.World.root.children.find((o) => o.name === 'routes ajoutées') || { children: [] }).children.length }));
    ok(rd.roads.length === 1 && rd.roads[0].pts.length === 3 && rd.roads[0].kind === 'road' && rd.sel.kind === 'road' && rd.bio === rd.road && rd.label === 'Tracer : route' && rd.meshes > 0,
      `route tracée en trois clics : chaussée posée sur le terrain, en 3D ${JSON.stringify({ pts: rd.roads[0].pts, meshes: rd.meshes })}`);
    await mt.evaluate(() => { MT.setTool('select'); MT.select({ kind: 'road', i: 0 }); });
    await mt.waitForTimeout(300);
    const a = await planAt(2240, 2260), b = await planAt(2240, 2285);
    await mt.mouse.move(a[0], a[1]); await mt.mouse.down();
    for (let k = 1; k <= 5; k++) { await mt.mouse.move(a[0] + ((b[0] - a[0]) * k) / 5, a[1] + ((b[1] - a[1]) * k) / 5); await mt.waitForTimeout(60); }
    await mt.mouse.up();
    await rebuilt();
    const rm = await mt.evaluate(() => ({ pt: MT.state.map.roads[0].pts[1], label: MT.state.undo[MT.state.undo.length - 1].label, now: OW.bio[owPointIndex(2240, 2284)], was: OW.bio[owPointIndex(2240, 2259)], road: OWB.ROAD }));
    ok(Math.abs(rm.pt[1] - 2285) < 1 && rm.label === 'Déplacer un point de la route' && rm.now === rm.road && rm.was !== rm.road, `point de la route glissé : la chaussée suit ${JSON.stringify(rm)}`);

    // 6. bâtiment : refusé sur une route d'origine ; posé, tourné, glissé, supprimé puis remis
    await mt.evaluate(() => { MT.select(null); MT.setTool('buildings'); Object.assign(MT.state.opts.ow.bld, { type: 'maison', rot: 0 }); MT.emit('tool-opts'); });
    await view(2250, 2185, 6);
    p = await planAt(2250, 2186);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(300);
    const onRoad = await mt.evaluate(() => MT.preview.bld);
    await view(2290, 2128, 6);
    p = await planAt(2290, 2128);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(300);
    const free = await mt.evaluate(() => MT.preview.bld);
    await mt.keyboard.press('KeyR');
    await mt.mouse.down(); await mt.mouse.up();
    await rebuilt();
    const bd = await mt.evaluate(() => {
      const b = MT.state.map.buildings[0], R = ZS.ow.bldRect(b);
      let solid = 0;
      for (let z = R.z0; z < R.z1; z++) for (let x = R.x0; x < R.x1; x++) if (ZS.ow.height(x + 0.5, z + 0.5) - b.y > 2) solid++;
      return { b, n: MT.state.map.buildings.length, objs: ZS.ow.objs.building.length, solid, sel: MT.state.sel, label: MT.state.undo[MT.state.undo.length - 1].label };
    });
    ok(onRoad && !onRoad.ok && /route d’origine/.test(onRoad.why) && free && free.ok && bd.n === 1 && bd.b.type === 'maison' && bd.b.rot === 1 && bd.objs === 1 && bd.solid > 0 && bd.sel.kind === 'building' && bd.label === 'Poser : maison en pisé',
      `bâtiment : refusé sur une route d’origine, posé ailleurs (R : quart de tour), murs pleins ${JSON.stringify({ why: onRoad && onRoad.why, b: bd.b, solid: bd.solid })}`);
    await mt.evaluate(() => MT.setTool('select'));
    const ba = await planAt(bd.b.x, bd.b.z), bb = await planAt(bd.b.x + 14, bd.b.z);
    await mt.mouse.move(ba[0], ba[1]); await mt.mouse.down();
    for (let k = 1; k <= 6; k++) { await mt.mouse.move(ba[0] + ((bb[0] - ba[0]) * k) / 6, ba[1] + ((bb[1] - ba[1]) * k) / 6); await mt.waitForTimeout(60); }
    await mt.mouse.up();
    await rebuilt();
    const bm = await mt.evaluate(() => ({ b: MT.state.map.buildings[0], label: MT.state.undo[MT.state.undo.length - 1].label, objs: ZS.ow.objs.building.length }));
    await mt.evaluate(() => { MT.select({ kind: 'building', i: 0 }); MT.deleteSelection(); });
    await rebuilt();
    const bdel = await mt.evaluate(() => ({ n: MT.state.map.buildings.length, objs: (ZS.ow.objs.building || []).length }));
    await mt.evaluate(() => MT.undo());
    await rebuilt();
    const bback = await mt.evaluate(() => ({ n: MT.state.map.buildings.length, objs: ZS.ow.objs.building.length, x: MT.state.map.buildings[0].x }));
    ok(bm.b.x === bd.b.x + 14 && bm.label === 'Déplacer' && bm.objs === 1 && bdel.n === 0 && bdel.objs === 0 && bback.n === 1 && bback.objs === 1 && bback.x === bm.b.x,
      `bâtiment glissé de 14 m (le terrain suit), supprimé (Suppr), remis (Ctrl+Z) ${JSON.stringify({ moved: bm.b, bdel, bback })}`);

    // 7. lieu nommé : posé (outil Éléments), renommé dans l'inspecteur
    await mt.evaluate(() => { MT.select(null); MT.setTool('elements'); MT.state.opts.ow.kind = 'loc'; MT.emit('tool-opts'); });
    await view(2260, 2200, 1.5);
    p = await planAt(2260, 2200);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(200); await mt.mouse.down(); await mt.mouse.up();
    await mt.waitForTimeout(400);
    await mt.evaluate(() => MT.ui.setTab('sel'));
    await mt.waitForTimeout(300);
    await mt.evaluate(() => { const i = document.querySelector('#mt-panel input[type=text]'); i.value = 'Village des potiers'; i.dispatchEvent(new Event('change')); });
    await mt.waitForTimeout(300);
    const lc = await mt.evaluate(() => ({ locs: MT.state.map.locs, where: MT.ow.where(2262, 2205) }));
    ok(lc.locs.length === 1 && lc.locs[0].name === 'Village des potiers' && lc.locs[0].r === 120 && lc.where === 'Village des potiers', `lieu nommé posé et renommé ${JSON.stringify(lc)}`);

    // 8. arme au mur et emplacement de la boîte contre le bâtiment
    const R = await mt.evaluate(() => ZS.ow.bldRect(MT.state.map.buildings[0]));
    await mt.evaluate(() => { MT.select(null); MT.setTool('elements'); MT.state.opts.ow.kind = 'wallbuy'; MT.state.opts.ow.weapon = 'thompson'; MT.emit('tool-opts'); });
    await view(R.x1, (R.z0 + R.z1) / 2, 14);
    p = await planAt(R.x1 + 0.6, (R.z0 + R.z1) / 2);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(300); await mt.mouse.down(); await mt.mouse.up();
    await rebuilt();
    await mt.evaluate(() => { MT.state.opts.ow.kind = 'box'; MT.emit('tool-opts'); });
    p = await planAt(R.x1 + 2.5, R.z0 + 1);
    await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(300); await mt.mouse.down(); await mt.mouse.up();
    await rebuilt();
    await mt.evaluate(() => MT.validateNow());
    const el = await mt.evaluate(() => ({ wb: MT.state.map.wallbuys, boxes: MT.state.map.boxes.length, err: MT.state.issues.errors.map((e) => e.msg), warn: MT.state.issues.warnings.length, inter: ZS.Features.interactables.filter((q) => q.kind === 'wallbuy').length }));
    ok(el.wb.length === 1 && el.wb[0].nx === 1 && Math.abs(el.wb[0].x - R.x1) < 0.2 && el.boxes === 1 && el.err.length === 0 && el.warn === 2 && el.inter === 1,
      `arme au mur sur la façade du bâtiment, emplacement de la boîte devant, aucun problème bloquant ${JSON.stringify({ wb: el.wb[0], err: el.err, warn: el.warn })}`);

    // 9. enregistrement : blocs de relief et de sol, route, bâtiment, lieu ; liste de publication
    const saved = await mt.evaluate(async () => ({ ok: await MT.ui.save(), dirty: MT.isDirty(), id: MT.state.id, src: MT.state.source }));
    const file = path.join(userData, 'modtools', 'maps', 'mon-desert.json');
    const fo = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    ok(saved.ok && !saved.dirty && saved.src === 'workspace' && fo.open === true && fo.base === 'desert' && fo.terrain && Object.keys(fo.terrain.d).length >= 1 && fo.ground && Object.keys(fo.ground.d).length >= 1
      && fo.roads.length === 1 && fo.buildings.length === 1 && fo.locs[0].name === 'Village des potiers' && fo.wallbuys.length === 1 && fo.boxes.length === 1 && !('thumb' in fo),
      `enregistrée dans l’atelier (${fs.existsSync(file) ? fs.statSync(file).size : 0} octets) : base désert, blocs de relief et de sol, route, bâtiment, lieu ${JSON.stringify({ saved, keys: Object.keys(fo).join() })}`);
    await mt.evaluate(() => MT.savePublishSet(['bunker7', 'khamsin', 'mon-desert']));
    const pubSet = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'publish.json'), 'utf8'));
    ok(pubSet.maps.join() === 'bunker7,khamsin,mon-desert' && pubSet.editor === 4, 'liste de publication : la nouvelle carte après Khamsin');

    // 10. partie de test (F5) : le terrain modifié est dans la partie ; retour
    await mt.evaluate(() => { MT.select(null); MT.setTool('select'); });
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 120000);
    const play = await mt.evaluate(([x, z]) => ({ map: ZS.G.mapId, base: ZS.ow.baseId, editor: ZS.CUR.editor, g: ZS.ow.ground(x, z), wb: ZS.Features.interactables.filter((q) => q.kind === 'wallbuy').length, bld: ZS.ow.objs.building.length, locs: ZS.ow.namedLocs().map((l) => l.name).join() }), [HX, HZ]);
    ok(play.map === 'mon-desert' && play.base === 'desert' && !play.editor && Math.abs(play.g - hr) < 0.02 && play.wb === 1 && play.bld === 1 && play.locs === 'Village des potiers',
      `partie de test : butte, bâtiment, arme au mur et lieu nommé dans la partie ${JSON.stringify(play)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    await mt.click('#btn-quit');
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden && MT.v3.owLoaded && !MT.v3.worldDirty, null, 120000);
    const back = await mt.evaluate(([x, z]) => ({ editor: ZS.CUR.editor, g: ZS.ow.ground(x, z), b: ZS.ow.objs.building.length, dirty: MT.isDirty() }), [HX, HZ]);
    ok(back.editor && Math.abs(back.g - hr) < 0.02 && back.b === 1 && !back.dirty, `retour aux Mod Tools : carte intacte ${JSON.stringify(back)}`);

    // 11. Khamsin à côté : ses lieux, son terrain ; puis la carte relue depuis l'atelier
    await mt.evaluate(() => MT.openGameMap('khamsin'));
    await until(() => MT.state.map.id === 'khamsin' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !MT.v3.worldDirty, null, 120000);
    const kh = await mt.evaluate(([x, z]) => ({ base: ZS.ow.baseId, named: ZS.ow.namedLocs().length, g: ZS.ow.ground(x, z), inter: ZS.Features.interactables.length, where: MT.ow.where(2350, 1992) }), [HX, HZ]);
    ok(kh.base === 'khamsin' && kh.named === 7 && Math.abs(kh.g - h0) < 0.02 && kh.inter > 30 && kh.where === 'Camp de fouilles', `Khamsin intacte : sept lieux, terrain d’origine ${JSON.stringify(kh)}`);
    await mt.evaluate(() => MT.openWorkspaceMap('mon-desert'));
    await until(() => MT.state.id === 'mon-desert' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !MT.v3.worldDirty, null, 120000);
    await rebuilt();
    const re = await mt.evaluate(([x, z]) => ({ base: ZS.ow.baseId, g: ZS.ow.ground(x, z), b: ZS.ow.objs.building.length, roads: MT.state.map.roads.length, dirty: MT.isDirty(), bio: OW.bio[owPointIndex(2290, 2120)] === OWB.OASIS }), [HX, HZ]);
    ok(re.base === 'desert' && Math.abs(re.g - hr) < 0.02 && re.b === 1 && re.roads === 1 && !re.dirty && re.bio, `carte relue depuis l’atelier : même terrain, même sol ${JSON.stringify(re)}`);
    ok(!errs.length, `aucune erreur dans la console des Mod Tools ${errs.slice(0, 3).join(' | ')}`);

    // 12. publication : maps/mon-desert.json dans le paquet ; le jeu publié la charge
    const [pub] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), mt.evaluate(() => MT.api.openPublisher())]);
    await pub.waitForFunction(() => document.querySelectorAll('#maps-list li').length === 3, null, { timeout: 30000 });
    const res = await pub.evaluate((outDir) => window.pub.create({ gameSource: 'installed', version: '9.9.9', notes: 'essai', outDir, repo: '' }), path.join(TMP, 'publications'));
    const { extractZip } = require('../src/main/updater');
    const x = path.join(TMP, 'paquet');
    await extractZip(path.join(res.dir, `zombie-survival-${res.version}.zip`), x);
    const index = JSON.parse(fs.readFileSync(path.join(x, 'maps', 'index.json'), 'utf8'));
    ok(index.maps.join() === 'bunker7,khamsin,mon-desert' && index.files.join() === 'mon-desert' && index.editor === 4 && fs.existsSync(path.join(x, 'maps', 'mon-desert.json')), `paquet publié : maps/mon-desert.json ${JSON.stringify(index)}`);
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
      const g = await page.evaluate(() => { const m = ZS.MAPS_ALL.byId['mon-desert']; return { list: ZS.MAPS_ALL.list.join(), src: m && m.source, base: m && m.base, thumb: !!(m && m.thumb), card: [...document.querySelectorAll('[data-map]')].some((e) => e.dataset.map === 'mon-desert') }; });
      ok(g.list === 'bunker7,khamsin,mon-desert' && g.src === 'package' && g.base === 'desert' && g.thumb, `jeu publié : la carte est au menu (base désert, vignette) ${JSON.stringify(g)}`);
      await page.evaluate(() => { window.frame = function () {}; renderEnabled = false; __zs.map('mon-desert'); __zs.start(); });
      await page.waitForFunction(() => ZS.G.state === 'playing' || ZS.G.state === 'paused', null, { timeout: 180000 });
      const pl = await page.evaluate(([x, z]) => ({ map: ZS.G.mapId, base: ZS.ow.baseId, g: ZS.ow.ground(x, z), bld: ZS.ow.objs.building.length, wb: ZS.Features.interactables.filter((q) => q.kind === 'wallbuy').length, locs: OW.locsShown.map((l) => l.name).join() }), [HX, HZ]);
      ok(pl.map === 'mon-desert' && pl.base === 'desert' && Math.abs(pl.g - hr) < 0.02 && pl.bld === 1 && pl.wb === 1 && pl.locs === 'Village des potiers' && !perr.length,
        `jeu publié : partie sur la carte (butte, bâtiment, arme au mur, lieu nommé) ${JSON.stringify(pl)} ${perr.slice(0, 2).join(' | ')}`);
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
  console.log(failures ? `${failures} échec(s)` : 'Désert vierge et niveau 2 dans les Mod Tools : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
