'use strict';
/* Essai de bout en bout : outils façon Radiant (jeu 2.0.5, interface 9 ; launcher 1.3.3). Copie
   temporaire du launcher avec une clé de test, dossier de données jetable.

     xvfb-run -a node e2e/modtools-biblio.e2e.js

   Moteur : bibliothèques de milliers de textures et de modèles (métadonnées des filtres, vignettes
   sans cache, textures lumineuses). Bunker 7 (grille) : navigateur de textures (filtres surface,
   famille, teinte, état ; recherche ; « Peindre avec » puis un clic dans le plan), texture lumineuse
   sur un mur (matériau émissif), navigateur de modèles (catégorie, état ; « Poser » puis un clic),
   gizmo sur l'objet posé (flèche X, flèche Y, anneau, taille ; annuler), vue XY (style, pas de la
   grille), bibliothèque latérale par paquets ; fichier enregistré puis rouvert ; partie de test (F5).
   Khamsin (ouverte) : texture de la bibliothèque appliquée à une pièce du décor, gizmo (flèche X),
   vue XY ; enregistrée. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-bib-'));
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
    await mt.setViewportSize({ width: 1280, height: 760 }).catch(() => {});
    await mt.waitForFunction(() => document.documentElement.dataset.modtools === 'ready', null, { timeout: 120000 });
    // rendu logiciel sous xvfb : une image toutes les quelques secondes ; on interroge la page à intervalles (pas à chaque image)
    const until = (fn, arg, ms = 60000) => mt.waitForFunction(fn, arg, { timeout: ms, polling: 250 });
    const rebuilt = async () => { await mt.waitForTimeout(120); await until(() => !MT.v3.rebuildAt && !MT.v3.owElDirty && !MT.v3.propsDirty && !MT.v3.worldDirty, null, 240000); };
    const planAt = (x, z) => mt.evaluate(([wx, wz]) => { const r = MT.plan.canvas.getBoundingClientRect(), [sx, sy] = MT.plan.toScreen(wx, wz); return [r.left + sx, r.top + sy]; }, [x, z]);
    const view = async (x, z, zoom) => { await mt.evaluate(([x, z, zoom]) => { MT.plan.centerOn(x, z, false); MT.plan.cam.zoom = zoom; MT.plan.need = true; }, [x, z, zoom]); await mt.waitForTimeout(400); };
    const click = async (x, z) => { const p = await planAt(x, z); await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(250); await mt.mouse.down(); await mt.mouse.up(); await mt.waitForTimeout(250); };
    // images du moteur (rendu logiciel sous xvfb : parfois une seule toutes les 2 à 6 s) : on attend qu'elles passent
    const frames = (n = 2) => mt.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    // gizmo : positions écran des poignées, glisser à la souris
    const gz = () => mt.evaluate(() => {
      const G = MT.gizmo, r = MT.v3.canvas.getBoundingClientRect();
      const f = (v) => { const p = v.clone().project(MT.v3.cam); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
      const P = G.root.position.clone(), s = G.root.scale.x, V = THREE.Vector3;
      return { vis: G.root.visible, c: f(P), x: f(P.clone().add(new V(0.8 * s, 0, 0))), y: f(P.clone().add(new V(0, 0.8 * s, 0))), sy: f(P.clone().add(new V(0, 0.98 * s, 0))),
        ring: [f(P.clone().add(new V(0.92 * s, 0, 0))), f(P.clone().add(new V(0, 0, 0.92 * s)))], handles: Object.values(G.handles).filter((h) => h.group.visible).map((h) => h.id) };
    });
    const drag = async (a, b, steps = 6) => {
      await mt.mouse.move(a[0], a[1]); await mt.waitForTimeout(600); await mt.mouse.down();
      for (let k = 1; k <= steps; k++) { await mt.mouse.move(a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps); await mt.waitForTimeout(60); }
      await mt.waitForTimeout(300); await mt.mouse.up();
      // le monde et le cadre de la sélection sont refaits à l'image suivante : flèches à leur nouvelle place
      await rebuilt(); await frames(2);
    };
    const along = (g, k, px) => { const d = [g[k][0] - g.c[0], g[k][1] - g.c[1]], n = Math.hypot(...d) || 1; return [g[k][0] + (d[0] / n) * px, g[k][1] + (d[1] / n) * px]; };
    // la poignée attendue est-elle sous le point ? sinon (image pas encore dessinée) on mesure à nouveau
    const aim = async (id, pick) => {
      let g = null, at = null;
      for (let k = 0; k < 24; k++) {
        g = await gz();
        at = await mt.evaluate(([x, y]) => MT.gizmo.handleAt(x, y), pick(g));
        if (at === id) return g;
        await mt.waitForTimeout(500);
      }
      console.log(`  (poignée ${id} attendue, ${at} sous le point ${JSON.stringify(pick(g).map(Math.round))})`);
      return g;
    };

    /* ======================================================= moteur 2.0.5 */
    await mt.evaluate(() => { MT.openGameMap('bunker7'); MT.ui.setView('split'); });
    await until(() => MT.state.map && MT.state.map.id === 'bunker7', null);
    await rebuilt();
    const eng = await mt.evaluate(() => {
      const st = ZS.libStats, T = Object.values(ZS.TEXLIB), M = Object.values(ZS.MODELS);
      const gx = T.filter((d) => d.src === 'gen'), gm = M.filter((d) => d.src === 'gen');
      const ids = new Set(); let dup = 0;
      for (const d of T) { if (ids.has(d.id)) dup++; ids.add(d.id); }
      const c = ZS.textureThumbRaw('gx_br_std_rouge', 64);
      return {
        v: ZS.version, api: ZS.editorApi, st, dup, facets: Object.keys(ZS.LIB_FACETS || {}).length,
        meta: gx.every((d) => d.fam && d.famName && d.surf && d.state && Array.isArray(d.use) && /^gx_[a-z0-9_]+$/.test(d.id)),
        mmeta: gm.every((d) => d.fam && d.famName && d.state && /^gm_[a-z0-9_]+$/.test(d.id) && ZS.MODEL_CATS.some((k) => k[0] === d.cat)),
        glow: T.filter((d) => d.glow).length, thumb: c && c.width === 64, legacy: ['bunker_wall', 'kh_pyrstone', 'lu_glass', 'concrete'].every((id) => ZS.TEXLIB[id] && ZS.TEXLIB[id].state),
      };
    });
    ok(eng.v === '2.0.5' && eng.api >= 9, `jeu 2.0.5, interface 9 des Mod Tools ${JSON.stringify({ v: eng.v, api: eng.api })}`);
    ok(eng.st.gen >= 4000 && eng.st.textures >= 4170 && eng.st.genModels >= 5000 && eng.st.models >= 5200 && eng.dup === 0 && eng.facets >= 8,
      `bibliothèques : ${eng.st.textures} textures (${eng.st.gen} générées, ${eng.st.families} familles), ${eng.st.models} modèles (${eng.st.genModels} générés, ${eng.st.modelFamilies} familles), enregistrées en ${eng.st.ms} ms`);
    ok(eng.meta && eng.mmeta && eng.legacy && eng.thumb && eng.glow >= 30, `métadonnées (famille, surface, état, usages), identifiants stables gx_/gm_, textures lumineuses (${eng.glow}), vignette sans cache ${JSON.stringify({ meta: eng.meta, mmeta: eng.mmeta, legacy: eng.legacy })}`);

    /* ================================================ navigateur de textures */
    await mt.click('#mt-br-tex');
    await until(() => MT.browser.isOpen('tex') && MT.browser.win.tex.pool.size > 0, null);
    await mt.waitForTimeout(4000);
    const b1 = await mt.evaluate(() => {
      const W = MT.browser.win.tex, st = MT.browser.state.tex;
      const all = W.list.length, made = MT.thumbs.made + MT.thumbs.hits;
      st.f.surf = 'brique'; W.drawFilters(); MT.browser.refresh('tex');
      const fams = [...W.el.querySelectorAll('.br-filters select')][3].options.length - 1;
      st.f.hue = 'rouge'; st.f.state = 'mousse'; MT.browser.refresh('tex');
      const L = W.list, okF = L.length > 0 && L.every((d) => MT.browser.texMeta(d).surf === 'brique' && d.hue === 'rouge' && d.state === 'mousse');
      const n1 = L.length;
      for (const k of Object.keys(st.f)) st.f[k] = '';
      st.q = 'carreaux ciment rosaces'; W.drawFilters(); MT.browser.refresh('tex');
      const q = W.list.map((d) => d.id);
      st.q = ''; MT.browser.refresh('tex');
      return { all, made, fams, n1, okF, q: q.length, qok: q.every((id) => id.startsWith('gx_cc_rosace')) };
    });
    ok(b1.all >= 4170 && b1.made > 0, `navigateur de textures : ${b1.all} textures, vignettes faites à la demande (${b1.made})`);
    ok(b1.fams >= 6 && b1.okF && b1.n1 >= 3, `filtres : surface « brique » (${b1.fams} familles), teinte rouge, état moussu → ${b1.n1} textures`);
    ok(b1.q === 12 && b1.qok, `recherche « carreaux ciment rosaces » : les 12 carreaux de ciment à rosaces ${JSON.stringify(b1)}`);
    // « Peindre avec » : une texture générée sur une case du sol (clic dans le plan)
    const PAINT = 'gx_hb_chene';
    await mt.evaluate((id) => { const st = MT.browser.state.tex; st.q = 'bâtons rompus chêne'; MT.browser.refresh('tex'); }, PAINT);
    await until((id) => MT.browser.win.tex.list.some((d) => d.id === id), PAINT);
    await mt.evaluate((id) => { const W = MT.browser.win.tex, i = W.list.findIndex((d) => d.id === id); [...W.pool.values()].find((t) => t.dataset.id === id).click(); }, PAINT);
    await mt.waitForTimeout(300);
    const foot = await mt.evaluate(() => MT.browser.win.tex.foot.textContent);
    await mt.evaluate(() => [...MT.browser.win.tex.foot.querySelectorAll('button')].find((b) => /Peindre avec/.test(b.textContent)).click());
    await mt.evaluate(() => { MT.browser.close('tex'); Object.assign(MT.state.opts.paint, { layer: 'floor', shape: 'brush', size: 1 }); });
    await view(31.5, 17.5, 30);
    await click(31.5, 17.5);
    await rebuilt();
    const p1 = await mt.evaluate(() => ({ tool: MT.state.tool, tex: MT.state.opts.paint.tex, cell: MT.cellTexture(31, 17, 'floor'), undo: MT.state.undo.slice(-1).map((u) => u.label)[0] }));
    ok(/Bâtons rompus/.test(foot) && p1.tool === 'paint' && p1.tex === PAINT && p1.cell === PAINT, `« Peindre avec » puis un clic : case du sol en bâtons rompus de chêne ${JSON.stringify(p1)}`);
    // texture lumineuse sur un mur : matériau émissif (le calque « murs » se peint sur la case d'où l'on voit le mur)
    const glow = await mt.evaluate(() => {
      const m = MT.state.map, g = m.grid;
      let cell = null;
      for (let z = 1; z < m.h - 1 && !cell; z++) for (let x = 1; x < m.w - 1 && !cell; x++) if (g[z][x] === '#' && g[z][x + 1] === '.' && MT.zoneIndexAt(x + 1, z) >= 0) cell = [x + 1, z];
      MT.edit('Peindre (murs)', () => MT.paintCells('wall', [cell], 'gx_neo_bleu') || false, 'layers');
      return cell;
    });
    await rebuilt();
    await mt.waitForTimeout(800);
    const gm = await mt.evaluate(() => { const m = levelMaterial('gx_neo_bleu'); return { e: !!m.emissiveMap, k: m.emissiveIntensity, used: (() => { let n = 0; ZS.World.root.traverse((o) => { if (o.isMesh && o.material === m) n++; }); return n; })() }; });
    ok(glow && gm.e && gm.k > 1 && gm.used > 0, `néons bleus sur un mur : matériau à lumière propre (carte émissive, intensité ${gm.k}) ${JSON.stringify({ glow, gm })}`);

    /* ================================================== navigateur de modèles */
    const MODEL = 'gm_tab_6p_droit_chene_g';
    await mt.click('#mt-br-model');
    await until(() => MT.browser.isOpen('model') && MT.browser.win.model.pool.size > 0, null);
    const b2 = await mt.evaluate((id) => {
      const W = MT.browser.win.model, st = MT.browser.state.model, all = W.list.length;
      st.f.cat = 'vehicule'; st.f.state = 'brule'; W.drawFilters(); MT.browser.refresh('model');
      const veh = W.list.length, vok = W.list.every((d) => d.cat === 'vehicule' && d.state === 'brule');
      const fams = [...W.el.querySelectorAll('.br-filters select')][1].options.length - 1;
      for (const k of Object.keys(st.f)) st.f[k] = '';
      st.q = 'table 6 places chêne ensanglantée'; W.drawFilters(); MT.browser.refresh('model');
      const found = W.list.some((d) => d.id === id);
      return { all, veh, vok, fams, found };
    }, MODEL);
    ok(b2.all >= 5200 && b2.veh >= 50 && b2.vok && b2.fams >= 4 && b2.found, `navigateur de modèles : ${b2.all} modèles ; véhicules brûlés : ${b2.veh} (${b2.fams} familles) ; recherche ${JSON.stringify(b2)}`);
    await mt.waitForTimeout(1500);
    await mt.evaluate((id) => { const W = MT.browser.win.model; [...W.pool.values()].find((t) => t.dataset.id === id).click(); }, MODEL);
    await mt.waitForTimeout(300);
    await mt.evaluate(() => [...MT.browser.win.model.foot.querySelectorAll('button')].find((b) => /^Poser/.test(b.textContent)).click());
    await mt.evaluate(() => { MT.browser.close('model'); Object.assign(MT.state.opts.props, { snap: 0.5, rot: 0, randomRot: false, randomScale: 0 }); });
    await view(29.5, 16.5, 30);
    await click(29.5, 16.5);
    await rebuilt();
    const pm = await mt.evaluate(() => { const m = MT.state.map, pr = m.props[m.props.length - 1]; return { m: pr.m, x: pr.x, z: pr.z, n: m.props.length, thumbs: MT.thumbs.made }; });
    ok(pm.m === MODEL && Math.abs(pm.x - 29.5) < 0.6 && Math.abs(pm.z - 16.5) < 0.6, `« Poser » puis un clic : table 6 places en chêne ensanglantée posée ${JSON.stringify(pm)}`);

    /* ======================================================== gizmo (3D) */
    const pi = pm.n - 1;
    await mt.evaluate(() => MT.setTool('select'));
    await until(() => !MT.thumbs.queue || MT.thumbs.queue() === 0, null, 240000);
    await mt.evaluate((i) => { MT.setTool('select'); MT.gizmo.setShow(true); MT.gizmo.setMode('move'); MT.select({ kind: 'prop', list: [i] }); const pr = MT.state.map.props[i]; MT.v3.cam.position.set(pr.x + 3.5, 3.2, pr.z + 4.5); MT.v3.lookAtPoint(pr.x, 0.6, pr.z); }, pi);
    await rebuilt(); await frames(3);
    let g = await gz();
    ok(g.vis && ['x', 'y', 'z', 'xz', 'c'].every((k) => g.handles.includes(k)), `gizmo affiché sur l’objet sélectionné (flèches, plans) ${JSON.stringify(g.handles)}`);
    const q0 = await mt.evaluate((i) => ({ ...MT.state.map.props[i] }), pi);
    g = await aim('x', (q) => q.x);
    await drag(g.x, along(g, 'x', 110));
    const q1 = await mt.evaluate((i) => ({ ...MT.state.map.props[i], undo: MT.state.undo.slice(-1)[0].label }), pi);
    ok(q1.x > q0.x + 0.4 && Math.abs(q1.z - q0.z) < 0.01 && q1.undo === 'Déplacer', `flèche X : l’objet glisse le long de X (${q0.x} → ${q1.x}), un seul geste annulable`);
    g = await aim('y', (q) => q.y);
    await drag(g.y, [g.y[0], g.y[1] - 70]);
    const q2 = await mt.evaluate((i) => ({ ...MT.state.map.props[i] }), pi);
    ok((q2.y || 0) > 0.2 && q2.x === q1.x, `flèche Y : l’objet monte (y ${q2.y || 0})`);
    await mt.evaluate(() => MT.gizmo.setMode('rotate'));
    await until(() => MT.gizmo.handles.ry.group.visible && !MT.gizmo.handles.x.group.visible, null, 30000); await frames(2);
    g = await aim('ry', (q) => q.ring[0]);
    await drag(g.ring[0], g.ring[1], 8);
    const q3 = await mt.evaluate((i) => ({ ...MT.state.map.props[i] }), pi);
    ok(Math.abs((q3.r || 0) - (q0.r || 0)) > 0.5, `anneau : l’objet tourne (${q0.r || 0} → ${q3.r})`);
    await mt.evaluate(() => MT.gizmo.setMode('scale'));
    await until(() => MT.gizmo.handles.sy.group.visible && !MT.gizmo.handles.ry.group.visible, null, 30000); await frames(2);
    g = await aim('sy', (q) => q.sy);
    await drag(g.sy, [g.sy[0], g.sy[1] - 50]);
    const q4 = await mt.evaluate((i) => ({ ...MT.state.map.props[i], undo: MT.state.undo.slice(-4).map((u) => u.label) }), pi);
    ok(Array.isArray(q4.s) && q4.s[1] > 1.05 && q4.s[0] === 1 && q4.undo.join() === 'Déplacer,Déplacer,Tourner,Taille', `taille (axe Y) : ${JSON.stringify(q4.s)} ; gestes ${q4.undo.join(', ')}`);
    const q5 = await mt.evaluate((i) => { MT.undo(); MT.undo(); MT.undo(); MT.undo(); const pr = MT.state.map.props[i] || { x: null }; return { x: pr.x, y: pr.y || 0, r: pr.r || 0, s: pr.s }; }, pi);
    ok(q5.x === q0.x && q5.y === (q0.y || 0) && q5.r === (q0.r || 0) && !q5.s, `quatre annulations : l’objet revient à sa place ${JSON.stringify(q5)}`);
    await mt.evaluate(() => MT.gizmo.setMode('move'));

    /* ============================================================ vue XY */
    const xy = await mt.evaluate(() => {
      MT.plan.setStyle('xy'); MT.plan.need = true;
      const s0 = MT.state.opts.props.snap; MT.gridStep(1); const s1 = MT.state.opts.props.snap; MT.gridStep(-1);
      return { style: MT.plan.style, s0, s1, bar: !!document.getElementById('mt-grid-step'), title: (document.getElementById('mt-plan-title') || {}).textContent || '' };
    });
    await mt.waitForTimeout(1500);
    ok(xy.style === 'xy' && xy.s1 > xy.s0 && xy.bar, `vue XY (dessus, grille et règles) ; pas de la grille ] / [ : ${xy.s0} → ${xy.s1} m ${JSON.stringify(xy)}`);

    /* ===================================================== bibliothèque latérale */
    await mt.evaluate(() => { MT.setTool('props'); MT.ui.setTab('tool'); MT.ui.renderPanel(); });
    await mt.waitForTimeout(800);
    const sl1 = await mt.evaluate(() => ({ tiles: document.querySelectorAll('#mt-panel .lib-tile').length, more: !!document.querySelector('#mt-panel .lib-more') }));
    await mt.evaluate(() => [...document.querySelectorAll('#mt-panel .lib-more button')][0].click());
    await mt.waitForTimeout(800);
    const sl2 = await mt.evaluate(() => document.querySelectorAll('#mt-panel .lib-tile').length);
    ok(sl1.tiles === 240 && sl1.more && sl2 === 480, `bibliothèque latérale des objets : 240 vignettes, puis 480 (« Afficher 240 de plus ») ${JSON.stringify({ sl1, sl2 })}`);

    /* =============================================== enregistrée, rouverte, jouée */
    await mt.evaluate(() => { MT.setTool('select'); window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 30000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    const sv = await mt.evaluate(async () => ({ ok: await window.__save, dirty: MT.isDirty() }));
    const fb = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'maps', 'bunker7.json'), 'utf8'));
    const fileOk = fb.props.some((p) => p.m === MODEL) && JSON.stringify(fb).includes(PAINT) && JSON.stringify(fb).includes('gx_neo_bleu');
    ok(sv.ok && !sv.dirty && fileOk, 'fichier enregistré : objet gm_ et textures gx_ (identifiants stables)');
    await mt.evaluate(() => MT.openWorkspaceMap('bunker7'));
    await until(() => MT.state.map && MT.state.source === 'workspace', null);
    await rebuilt();
    const ro = await mt.evaluate((id) => ({ prop: MT.state.map.props.some((p) => p.m === id), cell: MT.cellTexture(31, 17, 'floor') }), MODEL);
    ok(ro.prop && ro.cell === PAINT, `carte rouverte : objet et texture relus ${JSON.stringify(ro)}`);
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 120000);
    const play = await mt.evaluate((id) => {
      const i = ZS.CUR.map.props.findIndex((p) => p.m === id), m = levelMaterial('gx_neo_bleu');
      // en partie, les objets sont fondus par matière : la table est dans la boîte des objets de la carte
      const p = ZS.CUR.map.props[i] || { x: -999, z: -999 }, b = new THREE.Box3().setFromObject(ZS.World.props);
      return { map: ZS.G.mapId, prop: i >= 0 && !b.isEmpty() && b.containsPoint(new THREE.Vector3(p.x, 0.4, p.z)), glow: !!m.emissiveMap, issues: ZS.validateMap(ZS.CUR.map).errors.length };
    }, MODEL);
    ok(play.map === 'bunker7' && play.prop && play.glow && play.issues === 0, `partie de test : la table et les néons dans le jeu ${JSON.stringify(play)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 30000);
    await mt.evaluate(() => document.getElementById('btn-quit').click());
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden, null, 120000);
    await rebuilt();

    /* =============================================================== Khamsin */
    await mt.evaluate(() => { MT.plan.setStyle('plan'); MT.openGameMap('khamsin'); });
    await until(() => MT.state.map && MT.state.map.base === 'khamsin' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 180000);
    await rebuilt();
    const TENT = 'A.tente@2265,2002.5';
    const n = await mt.evaluate((id) => {
      const D = ZS.ow.placeItems().find((q) => q.id === id), v = MT.ow.placeView(D.i);
      MT.ui.setView('split'); MT.setTool('select'); MT.gizmo.setMode('move'); MT.select({ kind: 'place', i: D.i });
      const y = ZS.ow.ground(v.x, v.z); MT.v3.cam.position.set(v.x + 5.4, y + 5, v.z + 7.2); MT.v3.lookAtPoint(v.x, y + 1, v.z);
      return { i: D.i, x: v.x, z: v.z };
    }, TENT);
    const tx = await mt.evaluate(() => { const ok1 = MT.browser.applyTex('gx_ti_toile_kaki'); return ok1; });
    await rebuilt(); await frames(3);
    const te = await mt.evaluate((i) => { const e = MT.ow.placeView(i).edit || {}; return { m: e.m, undo: MT.state.undo.slice(-1)[0].label }; }, n.i);
    ok(tx && te.m && Object.values(te.m).some((q) => q.t === 'gx_ti_toile_kaki'), `Khamsin : toile kaki de la bibliothèque appliquée à la tente (un geste) ${JSON.stringify(te)}`);
    g = await aim('x', (q) => q.x);
    await drag(g.x, along(g, 'x', 100));
    const tv = await mt.evaluate((i) => { const v = MT.ow.placeView(i); return { x: v.x, edit: v.edit && v.edit.x, undo: MT.state.undo.slice(-1)[0].label }; }, n.i);
    ok(tv.x > n.x + 0.4 && tv.undo === 'Déplacer', `Khamsin : gizmo, la tente glisse le long de X (${n.x} → ${tv.x})`);
    await mt.evaluate(() => { MT.plan.setStyle('xy'); MT.plan.need = true; });
    await mt.waitForTimeout(2500);
    await mt.evaluate(() => { MT.plan.setStyle('plan'); window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 30000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    const ks = await mt.evaluate(async () => ({ ok: await window.__save, dirty: MT.isDirty() }));
    const kf = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'maps', 'khamsin.json'), 'utf8'));
    ok(ks.ok && !ks.dirty && JSON.stringify(kf.placeEdits).includes('gx_ti_toile_kaki'), 'Khamsin enregistrée : texture générée dans le décor des lieux');
    ok(!errs.length, `aucune erreur dans la page ${errs.slice(0, 3).join(' | ')}`);
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
  console.log(failures ? `${failures} échec(s)` : 'Bibliothèques, gizmo et vue XY dans les Mod Tools : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
