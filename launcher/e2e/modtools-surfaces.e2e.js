'use strict';
/* Essai de bout en bout : surfaces du décor des lieux de la base (jeu 2.0.3, interface 7) dans les
   Mod Tools du launcher 1.3.2. Copie temporaire du launcher avec une clé de test, dossier jetable.

     xvfb-run -a node e2e/modtools-surfaces.e2e.js

   Khamsin : « Un clic choisit : Surface » ; un pan d'une tente de couchage visé en 3D se sélectionne
   seul (la ligne « Tente de couchage › Pan ouest ») ; sa texture changée par la bibliothèque, teintée ;
   une image importée sur le toit ; le pan glissé dans le plan (ses cases suivent), retiré puis remis
   depuis « Ce qu'elle porte » ; « Construction » : une table de la tente-réfectoire choisit la tente ;
   une caisse remplacée par un objet de la bibliothèque. Enregistrée (matières, image embarquée),
   partie de test (les matières dans les maillages du jeu). Ombre éternelle : un mur du moyeu visé en
   3D (« Base Séléné › Moyeu › Paroi nord-est (dehors) », l'air de la base suit) ; la base entière
   déplacée de 40 m (« Construction ») : le départ, les armes et l'atout posés dedans suivent ; partie de
   test : le joueur part dans la base, à l'air. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-surf-'));
const APP = path.join(TMP, 'app');
let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}`); if (!cond) failures++; };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
const TENT2 = 'A.tente@2265,2002.5', MESS = 'A.tente@2305,1962.5', CRATE = 'A.caisse@2290.5,1944';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
    const until = (fn, arg, ms = 60000) => mt.waitForFunction(fn, arg, { timeout: ms });
    const rebuilt = async () => { await mt.waitForTimeout(120); await until(() => !MT.v3.rebuildAt && !MT.v3.owElDirty && !MT.v3.propsDirty && !MT.v3.worldDirty, null); };
    const planAt = (x, z) => mt.evaluate(([wx, wz]) => { const r = MT.plan.canvas.getBoundingClientRect(), [sx, sy] = MT.plan.toScreen(wx, wz); return [r.left + sx, r.top + sy]; }, [x, z]);
    const view = async (x, z, zoom) => { await mt.evaluate(([x, z, zoom]) => { MT.plan.centerOn(x, z, false); MT.plan.cam.zoom = zoom; MT.plan.need = true; }, [x, z, zoom]); await mt.waitForTimeout(400); };
    const click = async (x, z) => { const p = await planAt(x, z); await mt.mouse.move(p[0], p[1]); await mt.waitForTimeout(250); await mt.mouse.down(); await mt.mouse.up(); await mt.waitForTimeout(150); };
    const drag = async (x0, z0, x1, z1) => {
      const a = await planAt(x0, z0), b = await planAt(x1, z1);
      await mt.mouse.move(a[0], a[1]); await mt.waitForTimeout(250); await mt.mouse.down();
      for (let k = 1; k <= 10; k++) { await mt.mouse.move(a[0] + ((b[0] - a[0]) * k) / 10, a[1] + ((b[1] - a[1]) * k) / 10); await mt.waitForTimeout(40); }
      await mt.mouse.up(); await mt.waitForTimeout(150);
    };
    const panelText = () => mt.evaluate(() => document.getElementById('mt-panel').textContent);
    const clickBtn = (re, title = false) => mt.evaluate(([src, t]) => { const b = [...document.querySelectorAll('#mt-panel button')].find((x) => new RegExp(src).test(t ? x.title || '' : x.textContent)); if (b) b.click(); return !!b; }, [re, title]);
    const render = async () => { await mt.evaluate(() => MT.ui.renderPanel()); await mt.waitForTimeout(80); };
    const shot = async (name) => { if (!process.env.SHOTS) return; await mt.waitForTimeout(600); await mt.screenshot({ path: path.join(process.env.SHOTS, `${name}.png`), timeout: 240000 }).catch((e) => console.log('capture impossible', name, e.message)); };
    const node = (id) => mt.evaluate((id) => { const d = ZS.ow.placeItems().find((q) => q.id === id); return d ? { i: d.i, name: d.name, parent: d.parent, kids: d.kids.length } : null; }, id);
    /* le nœud visé au centre de la vue 3D, caméra en (cx, cy, cz) vers (tx, ty, tz) */
    const aim = (cx, cy, cz, tx, ty, tz) => mt.evaluate(([cx, cy, cz, tx, ty, tz]) => {
      MT.v3.cam.position.set(cx, cy, cz);
      MT.v3.lookAtPoint(tx, ty, tz);
      const r = MT.v3.canvas.getBoundingClientRect();
      const p = MT.ow.v3.pick({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      const hit = MT.ow.hitTest(p), D = ZS.ow.placeItems();
      return hit && hit.kind === 'place' ? { i: hit.i, name: D[hit.i].name, surf: !!D[hit.i].surf, parent: D[hit.i].parent } : { none: true, hit };
    }, [cx, cy, cz, tx, ty, tz]);
    /* choisir dans la bibliothèque (fenêtre ouverte par un bouton du panneau) la vignette id */
    const pickTile = async (id) => {
      await until(() => !document.getElementById('mt-modal').hidden && document.querySelectorAll('#mt-modal .lib-tile').length > 0, null, 10000);
      return mt.evaluate((id) => { const t = document.querySelector(`#mt-modal .lib-tile[data-id="${id}"]`); if (t) t.click(); return !!t; }, id);
    };
    const kindsAt = (x0, z0, x1, z1) => mt.evaluate(([x0, z0, x1, z1]) => {
      const out = {}, D = ZS.ow.placeItems();
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { const q = ZS.ow.placeAt(x + 0.5, z + 0.5); const k = q >= 0 ? D[q].name : '-'; out[k] = (out[k] || 0) + 1; }
      return out;
    }, [x0, z0, x1, z1]);

    /* ================================================== Khamsin */
    await mt.evaluate(() => MT.openGameMap('khamsin'));
    await until(() => MT.state.map && MT.state.map.base === 'khamsin' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 180000);
    await rebuilt();
    const k0 = await mt.evaluate(() => ({ api: ZS.editorApi, ok: MT.ow.surfOk(), level: MT.ow.placeLevel(), n: ZS.ow.placeCount }));
    ok(k0.api >= 7 && k0.ok && k0.level === 'piece' && k0.n.items === 164 && k0.n.prims === 873, `moteur à l’interface 7 : 164 pièces et 873 surfaces ; un clic choisit d’abord une pièce ${JSON.stringify(k0)}`);
    // 1. « Un clic choisit : Surface » (outil Sélection) ; la 3D vise le pan ouest de la tente de couchage
    await mt.evaluate(() => { MT.setTool('select'); MT.select(null); MT.ui.setView('split'); MT.ui.setTab('tool'); });
    await render();
    const segOk = await mt.evaluate(() => { const b = [...document.querySelectorAll('#mt-panel .ow-level button')].find((x) => x.textContent === 'Surface'); if (b) b.click(); return !!b; });
    const t2 = await node(TENT2);
    const gy = await mt.evaluate(() => ZS.ow.ground(2258, 2002.5));
    const a1 = await aim(2253, gy + 1.6, 2002.5, 2262.03, gy + 0.9, 2002.5);
    ok(segOk && a1.surf && a1.name === 'Pan ouest' && a1.parent === t2.i, `« Un clic choisit : Surface » ; en 3D, le pan ouest de la tente de couchage se vise seul ${JSON.stringify(a1)}`);
    await mt.evaluate((i) => { MT.select({ kind: 'place', i }); MT.ui.setTab('sel'); }, a1.i);
    await render();
    const p1 = await panelText();
    ok(/Tente de couchage\s*›\s*Pan ouest/.test(p1) && /Matières/.test(p1) && /Toile/.test(p1) && /Remplacer par un objet/.test(p1) && /surface de « Tente de couchage »/.test(p1),
      `inspecteur de la surface : « Tente de couchage › Pan ouest », matières, « Remplacer par un objet… » (${p1.slice(0, 160)})`);
    await mt.evaluate(() => MT.ow.ui.focusSel());
    await shot('1-pan-selectionne');
    // 2. sa texture : de la bibliothèque (tôle peinte) ; teinte bleue
    const sid = await mt.evaluate((i) => ZS.ow.placeItems()[i].id, a1.i);
    await mt.evaluate(() => { MT.ui.lib.tex.cat = 'all'; MT.ui.lib.tex.q = ''; });
    const texBtn = await clickBtn('^Texture…$');
    const picked = await pickTile('kh_sheet_red');
    await rebuilt();
    await render();
    const colOk = await mt.evaluate(() => { const i = document.querySelector('#mt-panel .ow-mat input[type=color]'); if (!i) return false; i.value = '#3366cc'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); return true; });
    await rebuilt();
    const m2 = await mt.evaluate(([sid, ti]) => {
      const e = MT.state.map.placeEdits[sid], g = ZS.ow.placeObj(ti), tex = g ? g.children.filter((o) => o.isMesh).map((o) => o.userData.tex) : [];
      return { e, tex };
    }, [sid, t2.i]);
    ok(texBtn && picked && colOk && m2.e && m2.e.m && m2.e.m.kh_canvas && m2.e.m.kh_canvas.t === 'kh_sheet_red' && m2.e.m.kh_canvas.c === 0x3366cc && m2.tex.includes('kh_sheet_red') && m2.tex.includes('kh_canvas'),
      `matière du pan : tôle peinte (bibliothèque), teinte bleue ; les autres surfaces de la tente gardent leur toile ${JSON.stringify(m2)}`);
    // 3. une image importée (bibliothèque de l'auteur) sur le toit, depuis « Mes images »
    await mt.evaluate((png) => MT.addToLibrary('u_e2e_toile', { name: 'Toile rayée (essai)', data: png, size: [2, 2] }, false), PNG);
    const roof = await mt.evaluate((ti) => { const D = ZS.ow.placeItems(); return D[ti].kids.find((k) => D[k].name === 'Toile du toit'); }, t2.i);
    await mt.evaluate((i) => { MT.select({ kind: 'place', i }); MT.ui.lib.tex.cat = 'import'; MT.ui.lib.tex.q = ''; }, roof);
    await render();
    await clickBtn('^Texture…$');
    const picked2 = await pickTile('u_e2e_toile');
    await rebuilt();
    const m3 = await mt.evaluate(([roof, ti]) => { const D = ZS.ow.placeItems(), g = ZS.ow.placeObj(ti); return { e: MT.state.map.placeEdits[D[roof].id], tex: g.children.filter((o) => o.isMesh).map((o) => o.userData.tex) }; }, [roof, t2.i]);
    ok(picked2 && m3.e && m3.e.m.kh_canvas.t === 'u_e2e_toile' && m3.tex.includes('u_e2e_toile'), `image importée sur la toile du toit (« Mes images ») ${JSON.stringify(m3)}`);
    await shot('2-matieres');
    // 4. le pan ouest glissé de 3 m vers l'ouest dans le plan : ses cases (le mur) suivent
    await view(2263, 2002.5, 14);
    const c0 = await kindsAt(2262, 2000, 2263, 2005), n0 = await kindsAt(2259, 2000, 2260, 2005);
    await drag(2262.06, 2002.5, 2259.06, 2002.5);
    await rebuilt();
    const c1 = await kindsAt(2262, 2000, 2263, 2005), n1 = await kindsAt(2259, 2000, 2260, 2005);
    const st4 = await mt.evaluate(([i, sid]) => ({ st: ZS.ow.placeState(MT.state.map)[i], e: MT.state.map.placeEdits[sid], sel: MT.state.sel }), [a1.i, sid]);
    ok(st4.sel && st4.sel.i === a1.i && st4.e && st4.e.m && st4.e.x !== undefined && (c0['Pan ouest'] || 0) >= 4 && !n0['Pan ouest'] && !c1['Pan ouest'] && (n1['Pan ouest'] || 0) >= 4 && near(st4.st.x, (await mt.evaluate((i) => ZS.ow.placeItems()[i].x, a1.i)) - 3, 0.3),
      `pan glissé de 3 m dans le plan (il garde ses matières) : ses cases le suivent ${JSON.stringify({ c0, n0, c1, n1, x: st4.st.x, sel: st4.sel, e: st4.e })}`);
    await shot('3-pan-deplace');
    // 5. retiré (Suppr), puis remis depuis « Ce qu'elle porte » de la tente
    await mt.evaluate(() => MT.deleteSelection());
    await rebuilt();
    const c2 = await kindsAt(2258, 2000, 2264, 2005);   // (le pan est à x 2259)
    await mt.evaluate((ti) => { MT.ui.setTab('sel'); MT.select({ kind: 'place', i: ti }); }, t2.i);
    await render();
    const p5 = await panelText();
    const kidOk = await mt.evaluate(() => { const b = [...document.querySelectorAll('#mt-panel .ow-kid.gone')].find((x) => /Pan ouest/.test(x.textContent)); if (b) b.click(); return !!b; });
    await render();
    const p5b = await panelText();
    const backOk = await clickBtn('^Remettre$');
    await rebuilt();
    const c3 = await kindsAt(2258, 2000, 2264, 2005);   // remis : à sa place retouchée (x 2259)
    ok(!c2['Pan ouest'] && /Ce qu’elle porte/.test(p5) && /retirée/.test(p5) && kidOk && /Surface retirée/.test(p5b) && backOk && (c3['Pan ouest'] || 0) >= 4,
      `pan retiré (ses cases avec lui), listé « retirée » dans « Ce qu’elle porte », remis d’un clic ${JSON.stringify({ c2, c3 })}`);
    // 6. « Construction » : une table de la tente-réfectoire choisit la tente entière ; « Pièce » : la table
    const mess = await node(MESS);
    await mt.evaluate(() => { MT.state.opts.ow.placeLevel = 'construction'; MT.select(null); });
    await view(2305, 1962.5, 10);
    const tb = await mt.evaluate(() => { const D = ZS.ow.placeItems(); const t = D.find((d) => d.kind === 'table' && d.parent >= 0 && D[d.parent].id === 'A.tente@2305,1962.5'); const st = ZS.ow.placeState(MT.state.map)[t.i]; return { i: t.i, x: st.x, z: st.z }; });
    await click(tb.x, tb.z);
    const s6 = await mt.evaluate(() => MT.state.sel);
    await mt.evaluate(() => { MT.state.opts.ow.placeLevel = 'piece'; MT.select(null); });
    await click(tb.x, tb.z);
    const s6b = await mt.evaluate(() => MT.state.sel);
    ok(s6 && s6.i === mess.i && s6b && s6b.i === tb.i, `« Construction » : un clic sur une table choisit la tente-réfectoire ; « Pièce » : la table ${JSON.stringify({ s6, s6b, mess: mess.i, table: tb.i })}`);
    // 7. une caisse remplacée par un objet de la bibliothèque (même place, même encombrement)
    const cr = await node(CRATE);
    await mt.evaluate((i) => { MT.select({ kind: 'place', i }); MT.ui.setTab('sel'); MT.ui.lib.model.cat = 'all'; MT.ui.lib.model.q = ''; }, cr.i);
    await render();
    const st7 = await mt.evaluate((i) => ZS.ow.placeState(MT.state.map)[i], cr.i);
    const np0 = await mt.evaluate(() => MT.state.map.props.length);
    await clickBtn('^Remplacer par un objet…$');
    const picked3 = await pickTile('barrel_rust');
    await rebuilt();
    const r7 = await mt.evaluate(([i, id]) => { const m = MT.state.map, p = m.props[m.props.length - 1], st = ZS.ow.placeState(m)[i]; return { n: m.props.length, p, hidden: st.hidden, e: m.placeEdits[id], sel: MT.state.sel, box: MT.modelDims('barrel_rust') }; }, [cr.i, CRATE]);
    const cx = st7.foot.reduce((a, q) => a + q[0], 0) / 4, cz = st7.foot.reduce((a, q) => a + q[1], 0) / 4;
    ok(picked3 && r7.n === np0 + 1 && r7.p.m === 'barrel_rust' && r7.hidden && r7.e.hide && r7.sel && r7.sel.kind === 'prop' && near(r7.p.x, cx, 0.4) && near(r7.p.z, cz, 0.4),
      `caisse remplacée par un fût de la bibliothèque, à sa place et à son encombrement ; la caisse est retirée, le fût sélectionné ${JSON.stringify({ p: r7.p, at: [cx, cz] })}`);
    // 8. enregistrée : matières, image embarquée, caisse retirée, fût posé
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    await mt.evaluate(async () => window.__save);
    const fk = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'maps', 'khamsin.json'), 'utf8'));
    const fe = fk.placeEdits || {}, ct = (fk.custom && fk.custom.textures) || {};
    ok(fe[sid] && fe[sid].m.kh_canvas.t === 'kh_sheet_red' && fe[sid].m.kh_canvas.c === 0x3366cc && ct.u_e2e_toile && /^data:image\/png/.test(ct.u_e2e_toile.data) && fe[CRATE] && fe[CRATE].hide && fk.props.some((p) => p.m === 'barrel_rust'),
      `Khamsin enregistrée : matières du pan, image du toit embarquée (custom.textures), caisse retirée, fût posé ${JSON.stringify({ pan: fe[sid], tex: Object.keys(ct) })}`);
    // 9. partie de test : les matières dans les maillages du jeu
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 120000);
    const g9 = await mt.evaluate(() => {
      const L = World.root.children.find((c) => c.name === 'lieux'), tex = L ? L.children.filter((o) => o.isMesh).map((o) => o.userData.tex) : [];
      return { red: tex.includes('kh_sheet_red'), img: tex.includes('u_e2e_toile'), editor: ZS.CUR.editor };
    });
    ok(g9.red && g9.img && !g9.editor, `partie de test : la tôle peinte et l’image importée sont dans les maillages du jeu ${JSON.stringify(g9)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    await mt.evaluate(() => document.getElementById('btn-quit').click());
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden && MT.v3.owLoaded && !MT.v3.worldDirty, null, 120000);
    await rebuilt();

    /* ================================================== Ombre éternelle */
    await mt.evaluate(() => MT.openGameMap('ombre'));
    await until(() => MT.state.map && MT.state.map.base === 'ombre' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 240000);
    await rebuilt();
    // 10. un mur du moyeu visé en 3D (« Surface ») : la ligne « Base Séléné › Moyeu › Paroi nord-est (dehors) »
    await mt.evaluate(() => { MT.state.opts.ow.placeLevel = 'surface'; MT.setTool('select'); MT.select(null); });
    const hub = await mt.evaluate(() => { const d = ZS.ow.placeItems().find((q) => q.kind === 'moyeu'); return { i: d.i, x: d.x, y: d.y, z: d.z }; });
    const k = Math.SQRT1_2;
    const a10 = await aim(hub.x + k * 16, hub.y + 2, hub.z - k * 16, hub.x + k * 6.6, hub.y + 2, hub.z - k * 6.6);
    await mt.evaluate((i) => { if (i >= 0) { MT.select({ kind: 'place', i }); MT.ui.setTab('sel'); } }, a10.i === undefined ? -1 : a10.i);
    await render();
    const p10 = await panelText();
    ok(a10.surf && /^Paroi nord-est \(dehors/.test(a10.name) && a10.parent === hub.i && /Base Séléné›Moyeu \(coupole, baie, console\)›Paroi nord-est/.test(p10.replace(/\s+›\s+|›/g, '›').replace(/\s+/g, ' ').replace(/ ›/g, '›')) && /L’air respirable du moyeu le suit/.test(p10),
      `Ombre éternelle : un mur du moyeu visé en 3D se sélectionne seul (« Base Séléné › Moyeu › Paroi nord-est (dehors) », l’air du moyeu le suit) ${JSON.stringify(a10)}`);
    await mt.evaluate(() => MT.ow.ui.focusSel());
    await shot('4-paroi-moyeu');
    // 11. « Construction » : la base entière déplacée de 40 m vers l'est ; ce qui est posé dedans suit
    await mt.evaluate(() => { MT.state.opts.ow.placeLevel = 'construction'; });
    const a11 = await aim(hub.x + k * 16, hub.y + 2, hub.z - k * 16, hub.x + k * 6.6, hub.y + 2, hub.z - k * 6.6);
    const before = await mt.evaluate(() => { const m = MT.state.map; return { spawn: m.spawn.pos.slice(), wb: m.wallbuys.map((w) => [w.x, w.z]), perks: m.perks.map((p) => [p.x, p.z]) }; });
    await mt.evaluate((i) => { MT.select({ kind: 'place', i }); MT.ui.setTab('sel'); }, a11.i);
    await render();
    const p11 = await panelText();
    await mt.evaluate(() => { const i = [...document.querySelectorAll('#mt-panel .f-row')].find((r) => r.querySelector('.f-label') && r.querySelector('.f-label').textContent === 'Position').querySelector('input'); i.value = String(parseFloat(i.value) + 40); i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
    await rebuilt();
    const after = await mt.evaluate(() => { const m = MT.state.map; return { spawn: m.spawn.pos.slice(), wb: m.wallbuys.map((w) => [w.x, w.z]), perks: m.perks.map((p) => [p.x, p.z]), edits: m.placeEdits }; });
    const inBase = (p) => Math.hypot(p[0] - hub.x, p[1] - hub.z) < 26;
    const moved = (A, B) => A.map((p, j) => (inBase(p) ? near(B[j][0], p[0] + 40, 0.05) && near(B[j][1], p[1], 0.05) : near(B[j][0], p[0], 1e-6) && near(B[j][1], p[1], 1e-6)));
    const mw = moved(before.wb, after.wb), mp = moved(before.perks, after.perks);
    const nIn = before.wb.filter(inBase).length + before.perks.filter(inBase).length;
    const v11 = await mt.evaluate(() => { MT.validateNow(); return { e: MT.state.issues.errors.map((x) => x.msg), w: MT.state.issues.warnings.map((x) => x.msg).filter((t) => /au mur|sol devant/.test(t)) }; });
    ok(a11.name === 'Base Séléné' && !a11.surf && /Dans la partie/.test(p11) && near(after.spawn[0], before.spawn[0] + 40, 0.05) && mw.every(Boolean) && mp.every(Boolean) && nIn >= 5 && !v11.e.length && !v11.w.length,
      `« Construction » : la base Séléné entière déplacée de 40 m ; le départ, les ${nIn} armes et atouts posés dedans suivent, les autres restent ; vérification sans erreur ${JSON.stringify({ spawn: [before.spawn, after.spawn], v11 })}`);
    await mt.evaluate(() => MT.ow.ui.focusSel());
    await shot('5-base-deplacee');
    // 12. partie de test : le joueur part dans la base déplacée, à l'air ; plus d'air à l'ancienne place
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 180000);
    await mt.waitForTimeout(1500);
    const g12 = await mt.evaluate(([hx, hz]) => ({ inside: luInsideAt(player.pos.x, player.gy + 1, player.pos.z), x: player.pos.x, old: luInsideAt(hx, LUPL.base.y + 1, hz), fresh: luInsideAt(hx + 40, player.gy + 1, hz) }), [hub.x, hub.z]);
    ok(g12.inside && !g12.old && g12.fresh && near(g12.x, after.spawn[0], 1.5), `partie de test : le joueur part dans la base déplacée, à l’air ; l’ancienne place n’a plus d’air ${JSON.stringify(g12)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    await mt.evaluate(() => document.getElementById('btn-quit').click());
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden && MT.v3.owLoaded && !MT.v3.worldDirty, null, 120000);
    await rebuilt();
    ok(!errs.length, `aucune erreur dans la console des Mod Tools ${errs.slice(0, 3).join(' | ')}`);
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
  console.log(failures ? `${failures} échec(s)` : 'Surfaces du décor dans les Mod Tools : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
