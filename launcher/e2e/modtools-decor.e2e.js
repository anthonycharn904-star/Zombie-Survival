'use strict';
/* Essai de bout en bout : décor des lieux de la base retouchable (jeu 2.0.3, interfaces 6 et 7) dans
   les Mod Tools du launcher 1.3.2. Copie temporaire du launcher avec une clé de test, dossier jetable.
   (Les surfaces, les matières et les constructions entières : e2e/modtools-surfaces.e2e.js.)

     xvfb-run -a node e2e/modtools-decor.e2e.js

   Khamsin : la petite tente de couchage du camp se sélectionne d'un clic (plan, puis vue 3D),
   se glisse dans le plan (ses murs suivent : cases), tourne (R, Maj+R), change de taille, se
   retire (Suppr) puis revient (liste « Décor de la base »), annuler et rétablir ; la tente-réfectoire
   emporte ses tables et les armes posées dedans ; la cuve d'aviation (quête) se déplace, la quête
   suit (interface 7 : plus de pièce fixe) ; l'outil Éléments pose une arme dans une tente sans la
   sélectionner ; enregistrée (placeEdits), partie de test (les murs déplacés arrêtent le joueur),
   publiée : le jeu publié charge le décor retouché. Ombre éternelle : un mât solaire déplacé, un
   lampadaire retiré. Une case appartient à une surface : on remonte à sa pièce (pieceOf). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { _electron: electron, chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-decor-'));
const APP = path.join(TMP, 'app');
let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}`); if (!cond) failures++; };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
const TENT = 'A.tente@2265,1992.5', TENT2 = 'A.tente@2265,2002.5', MESS = 'A.tente@2305,1962.5', TANK = 'C.cuve@1419,2601';

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
    const setField = (label, value, sec = null) => mt.evaluate(([label, value, sec]) => {
      const secs = [...document.querySelectorAll('#mt-panel .p-sec')].filter((s) => !sec || (s.querySelector('h3') && s.querySelector('h3').textContent === sec));
      for (const s of secs) {
        const row = [...s.querySelectorAll('.f-row')].find((r) => r.querySelector('.f-label') && r.querySelector('.f-label').textContent === label);
        const i = row && row.querySelector('input, select');
        if (!i) continue;
        i.value = String(value);
        i.dispatchEvent(new Event('input'));
        i.dispatchEvent(new Event('change'));
        return true;
      }
      return false;
    }, [label, value, sec]);
    const panelText = () => mt.evaluate(() => document.getElementById('mt-panel').textContent);
    const clickBtn = (re, title = false) => mt.evaluate(([src, t]) => { const b = [...document.querySelectorAll('#mt-panel button')].find((x) => new RegExp(src).test(t ? x.title || '' : x.textContent)); if (b) b.click(); return !!b; }, [re, title]);
    const render = async () => { await mt.evaluate(() => MT.ui.renderPanel()); await mt.waitForTimeout(80); };
    /* captures d'écran (SHOTS=dossier) : pour regarder l'interface */
    const shot = async (name) => { if (!process.env.SHOTS) return; await mt.waitForTimeout(600); await mt.screenshot({ path: path.join(process.env.SHOTS, `${name}.png`), timeout: 240000 }).catch((e) => console.log('capture impossible', name, e.message)); };
    const idx = (id) => mt.evaluate((id) => (ZS.ow.placeItems().find((d) => d.id === id) || { i: -1 }).i, id);
    const state = (id) => mt.evaluate((id) => {
      const d = ZS.ow.placeItems().find((q) => q.id === id), st = ZS.ow.placeState(MT.state.map)[d.i], g = ZS.ow.placeObj(d.i);
      return { i: d.i, x: st.x, z: st.z, r: st.r, s: st.s, hidden: st.hidden, edit: (MT.state.map.placeEdits || {})[id] || null, visible: !!(g && g.visible), sel: MT.state.sel };
    }, id);
    /* cases au sol d'une zone : { genre: nombre } (0 terrain, 1 sol, 2 plein…) ; pièce propriétaire du centre */
    const cells = (x0, z0, x1, z1) => mt.evaluate(([x0, z0, x1, z1]) => {
      const k = {}, D = ZS.ow.placeItems();
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { let q = ZS.ow.placeAt(x + 0.5, z + 0.5); if (q >= 0 && D[q].surf) q = D[q].parent; const key = q >= 0 ? `p${q}` : 'libre'; k[key] = (k[key] || 0) + 1; }
      return k;
    }, [x0, z0, x1, z1]);

    /* ================================================== Khamsin */
    await mt.evaluate(() => MT.openGameMap('khamsin'));
    await until(() => MT.state.map && MT.state.map.base === 'khamsin' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 180000);
    await rebuilt();
    const k0 = await mt.evaluate(() => {
      const D = ZS.ow.placeItems(), P = D.filter((d) => !d.surf);
      return { api: ZS.editorApi, ok: MT.ow.placeOk() && MT.ow.surfOk(), n: P.length, surf: D.length - P.length, locked: D.filter((d) => d.locked).length, kids: P.filter((d) => d.parent >= 0).length, groups: ZS.ow.placeRoot ? ZS.ow.placeRoot.children.length : 0, edits: Object.keys(MT.state.map.placeEdits || {}).length, level: MT.ow.placeLevel() };
    });
    ok(k0.api >= 8 && k0.ok && k0.n === 204 && k0.surf === 1167 && k0.locked === 0 && k0.kids === 63 && k0.groups === 204 && k0.edits === 0 && k0.level === 'piece',
      `Khamsin : 204 pièces de décor (pyramides comprises ; aucune fixe, 63 posées dans une autre, 1 167 surfaces), un groupe chacune dans la vue 3D ; un clic choisit une pièce ${JSON.stringify(k0)}`);
    const ti = await idx(TENT);
    // 1. un clic dans le plan sur la petite tente : elle est sélectionnée, l'inspecteur la montre
    await mt.evaluate(() => { MT.setTool('select'); MT.ui.setView('split'); MT.ui.setTab('sel'); });
    await view(2265, 1992.5, 12);
    await click(2264.6, 1992.3);
    const s1 = await mt.evaluate(() => MT.state.sel);
    const t1 = await panelText();
    ok(s1 && s1.kind === 'place' && s1.i === ti && /Tente de couchage/.test(t1) && /Camp de fouilles/.test(t1) && /Rétablir l’origine/.test(t1),
      `clic sur la petite tente (plan) : sélectionnée, inspecteur « Tente de couchage · Camp de fouilles » ${JSON.stringify(s1)}`);
    await mt.evaluate(() => MT.ow.ui.focusSel());
    await shot('1-tente-selectionnee');
    // 2. glissée de 20 m vers l'est : ses murs et son sol suivent (cases)
    const before = await cells(2262, 1990, 2268, 1995);
    await drag(2264.6, 1992.3, 2284.6, 1992.3);
    await rebuilt();
    const st2 = await state(TENT);
    const oldC = await cells(2262, 1990, 2268, 1995), newC = await cells(2282, 1990, 2288, 1995);
    ok(st2.edit && near(st2.edit.x, 2285, 0.3) && near(st2.edit.z, 1992.5, 0.3) && near(st2.x, 2285, 0.3) && before[`p${ti}`] >= 25 && !oldC[`p${ti}`] && newC[`p${ti}`] >= 25,
      `tente glissée de 20 m : retouche x ${st2.edit && st2.edit.x}, ses cases quittent l’ancienne place et occupent la nouvelle ${JSON.stringify({ before, oldC, newC })}`);
    // 3. tournée (R : +15°, Maj+R : +90°), agrandie ×1,5 (inspecteur, section Taille)
    await mt.evaluate(() => MT.ow.rotate(1));
    await rebuilt();
    await mt.evaluate(() => MT.ow.rotate(1, true));
    await rebuilt();
    const st3 = await state(TENT);
    await render();
    const okSize = await setField('Échelle', 1.5, 'Taille');
    await rebuilt();
    const st4 = await state(TENT);
    ok(near(st3.edit.r, (105 * Math.PI) / 180, 1e-3) && near(st3.r, (105 * Math.PI) / 180, 1e-3) && okSize && st4.edit.s === 1.5 && near(st4.s[0], 1.5, 1e-3) && near(st4.s[1], 1.5, 1e-3),
      `tournée de 105° (R puis Maj+R), agrandie ×1,5 dans l’inspecteur ${JSON.stringify({ r: st3.edit.r, s: st4.edit.s })}`);
    await mt.evaluate(() => MT.ow.ui.focusSel());
    await shot('2-tente-deplacee-tournee-agrandie');
    // 4. retirée (Suppr) : groupe caché, plus de cases, plus sélectionnable ; remise depuis la liste
    await mt.evaluate(() => MT.deleteSelection());
    await rebuilt();
    const st5 = await state(TENT);
    const gone5 = await cells(2276, 1984, 2294, 2001);
    await render();
    const t5 = await panelText();
    await shot('3-tente-retiree');
    ok(st5.edit.hide === true && st5.hidden && !st5.visible && !gone5[`p${ti}`] && !st5.sel && /Décor de la base/.test(t5) && /retirée/.test(t5),
      `Suppr : tente retirée (groupe caché, aucune case), listée « retirée » dans Décor de la base ${JSON.stringify({ edit: st5.edit, cells: gone5 })}`);
    await mt.evaluate(() => MT.undo());
    await rebuilt();
    const st6 = await state(TENT);
    await mt.evaluate(() => MT.redo());
    await rebuilt();
    const st7 = await state(TENT);
    ok(!st6.edit.hide && st6.visible && st6.edit.s === 1.5 && st7.edit.hide === true && !st7.visible, `annuler : la tente revient (×1,5, tournée) ; rétablir : retirée de nouveau ${JSON.stringify({ u: st6.edit, r: st7.edit })}`);
    await mt.evaluate(() => MT.ui.setTab('tool'));
    await mt.evaluate(() => { MT.setTool('select'); MT.select(null); MT.ui.setTab('tool'); });
    await render();
    const okBack = await clickBtn('^Remettre', true);
    await rebuilt();
    const st8a = await state(TENT);
    ok(okBack && st8a.edit && !st8a.edit.hide && st8a.edit.s === 1.5 && st8a.visible && near(st8a.x, 2285, 0.3), `liste du décor : « Remettre » rend la tente avec ses retouches (déplacée, tournée, ×1,5) ${JSON.stringify(st8a.edit)}`);
    await render();
    const okOrig = await clickBtn('^Rétablir l’origine', true);
    await rebuilt();
    const st8 = await state(TENT);
    const back = await cells(2262, 1990, 2268, 1995);
    ok(okOrig && !st8.edit && st8.visible && near(st8.x, 2265, 1e-3) && back[`p${ti}`] === before[`p${ti}`], `liste du décor : « Rétablir l’origine » la rend à sa place d’origine (cases comprises) ${JSON.stringify({ edit: st8.edit, back })}`);
    // 5. vue 3D : un clic sur l'autre tente de couchage la sélectionne
    const ti2 = await idx(TENT2);
    const p3 = await mt.evaluate(() => {
      // caméra à l'ouest de la tente, vers son mur ouest (fermé)
      const y = ZS.ow.ground(2258, 2002.5);
      MT.v3.cam.position.set(2253, y + 1.6, 2002.5);
      MT.v3.lookAtPoint(2262.03, y + 0.9, 2002.5);
      const r = MT.v3.canvas.getBoundingClientRect();
      const p = MT.ow.v3.pick({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      return { p: p && { el: p.el, view: p.view }, hit: MT.ow.hitTest(p) };
    });
    ok(p3.hit && p3.hit.kind === 'place' && p3.hit.i === ti2, `vue 3D : viser l’autre tente de couchage la sélectionne ${JSON.stringify(p3)}`);
    await mt.evaluate((i) => { MT.select({ kind: 'place', i }); MT.ui.setTab('sel'); }, ti2);
    await shot('4-vue-3d-tente');
    // 6. la tente-réfectoire emporte ses tables (déplacée de +10 m par l'inspecteur)
    const mi = await idx(MESS);
    const D0 = await mt.evaluate(() => ZS.ow.placeItems().map((d) => !!d.surf));
    const tables0 = await mt.evaluate(([mi, D0]) => ZS.ow.placeItems()[mi].kids.filter((k) => !D0[k]).map((k) => { const s = ZS.ow.placeState(MT.state.map)[k]; return [s.x, s.z]; }), [mi, D0]);
    const wb0 = await mt.evaluate(() => MT.state.map.wallbuys.map((w) => [w.x, w.z]));
    await mt.evaluate((mi) => { MT.select({ kind: 'place', i: mi }); MT.ui.setTab('sel'); }, mi);
    await render();
    const messText = await panelText();
    await mt.evaluate(() => { const i = [...document.querySelectorAll('#mt-panel .f-row')].find((r) => r.querySelector('.f-label') && r.querySelector('.f-label').textContent === 'Position').querySelector('input'); i.value = '2315'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
    await rebuilt();
    const tables1 = await mt.evaluate(([mi, D0]) => ZS.ow.placeItems()[mi].kids.filter((k) => !D0[k]).map((k) => { const s = ZS.ow.placeState(MT.state.map)[k]; return [s.x, s.z]; }), [mi, D0]);
    ok(/4 pièces posées dedans/.test(messText) && tables1.length === 4 && tables1.every((p, k) => near(p[0], tables0[k][0] + 10, 0.01) && near(p[1], tables0[k][1], 0.01)),
      `tente-réfectoire déplacée de 10 m : ses tables et sa lampe suivent ${JSON.stringify({ tables0, tables1 })}`);
    // les trois armes au fond de la tente (x 2300, 2305, 2310) la suivent : aucune ne reste sans mur
    const wb1 = await mt.evaluate(() => MT.state.map.wallbuys.map((w) => [w.x, w.z]));
    const movedW = wb1.filter((p, k) => near(p[0], wb0[k][0] + 10, 0.01) && near(p[1], wb0[k][1], 0.01)).length;
    const wv = await mt.evaluate(() => { MT.validateNow(); return MT.state.issues.warnings.map((w) => w.msg).filter((t) => /au mur/.test(t)).length; });
    ok(movedW === 3 && wv === 0, `les trois armes posées dans la tente-réfectoire la suivent (+10 m) ; la vérification ne signale aucune arme sans mur (${movedW} déplacées, ${wv} alerte(s))`);
    // 7. plus de pièce fixe (interface 7) : la cuve d'aviation (quête) se tourne et se déplace ; la quête suit
    const ci = await idx(TANK);
    await view(1419, 2601, 8);
    await click(1419, 2601);
    const cs = await mt.evaluate(() => MT.state.sel);
    await render();
    const ct = await panelText();
    const cm = await mt.evaluate((ci) => { MT.ow.rotate(1); MT.begin('Déplacer'); const r = MT.ow.moveTo({ kind: 'place', i: ci }, 1430, 2601); MT.commit(); return { r, e: (MT.state.map.placeEdits || {})['C.cuve@1419,2601'] || null }; }, ci);
    await rebuilt();
    await shot('5-cuve-deplacee');
    const cv = await mt.evaluate(() => { MT.validateNow(); return MT.state.issues.errors.map((w) => w.msg); });
    ok(cs && cs.kind === 'place' && cs.i === ci && !/Pièce fixe/.test(ct) && /Dans la partie/.test(ct) && /vanne et le fût de la quête suivent la cuve/.test(ct) && cm.r.ok && cm.e && near(cm.e.x, 1430, 0.01) && cm.e.r > 0 && !cv.length,
      `cuve d’aviation (quête) : sélectionnée, plus fixe (« Dans la partie : … suivent la cuve »), tournée et déplacée, sans erreur à la vérification ${JSON.stringify({ e: cm.e, cv })}`);
    await mt.evaluate(() => { MT.undo(); MT.undo(); });
    await rebuilt();
    // 8. outil Éléments : une arme posée sur le mur d'une tente, sans sélectionner la tente
    await mt.evaluate(() => { MT.setTool('elements'); Object.assign(MT.state.opts.ow, { kind: 'wallbuy', weapon: 'thompson' }); });
    await view(2265, 1982.5, 12);
    const nwb = await mt.evaluate(() => MT.state.map.wallbuys.length);
    await click(2262.9, 1982.6);
    await rebuilt();
    const wb = await mt.evaluate(() => ({ n: MT.state.map.wallbuys.length, sel: MT.state.sel, w: MT.state.map.wallbuys[MT.state.map.wallbuys.length - 1] }));
    ok(wb.n === nwb + 1 && wb.sel && wb.sel.kind === 'wallbuy' && wb.w.w === 'thompson', `outil Éléments : clic dans une tente, une arme se pose sur son mur (la tente n’est pas sélectionnée) ${JSON.stringify(wb)}`);
    await mt.evaluate(() => MT.undo());
    await rebuilt();
    // 9. la petite tente de nouveau déplacée et tournée, pour la suite (enregistrée, partie de test, publiée)
    await mt.evaluate(([ti]) => { MT.setTool('select'); MT.select({ kind: 'place', i: ti }); }, [ti]);
    await mt.evaluate((ti) => { MT.begin('Déplacer'); MT.ow.moveTo({ kind: 'place', i: ti }, 2290, 1992.5); MT.commit(); }, ti);
    await mt.evaluate(() => MT.ow.rotate(1, true));
    await rebuilt();
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    await mt.evaluate(async () => window.__save);
    const fk = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'maps', 'khamsin.json'), 'utf8'));
    const fe = fk.placeEdits || {};
    ok(fe[TENT] && near(fe[TENT].x, 2290) && near(fe[TENT].r, Math.PI / 2, 1e-3) && fe[MESS] && near(fe[MESS].x, 2315) && !fe[TANK],
      `Khamsin enregistrée : placeEdits (petite tente à x 2290, tournée d’un quart ; tente-réfectoire à x 2315) ${JSON.stringify(fe)}`);
    // 10. partie de test : la tente est à sa nouvelle place (ses murs arrêtent le joueur)
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 120000);
    const g10 = await mt.evaluate(() => {
      const D = ZS.ow.placeItems(), d = D.find((q) => q.id === 'A.tente@2265,1992.5');
      const pieceOf = (k) => (k >= 0 && D[k].surf ? D[k].parent : k);
      return { n: D.filter((q) => !q.surf).length, own: pieceOf(ZS.ow.placeAt(2290, 1992.5 - 2.5 + 0.5)), old: ZS.ow.placeAt(2262.5, 1992.5), i: d && d.i, wall: ZS.ow.height(2287.6, 1995.4) - ZS.ow.ground(2287.6, 1995.4) };
    });
    ok(g10.n === 204 && g10.own === g10.i && g10.old === -1, `partie de test : la tente retouchée est à sa nouvelle place, plus rien à l’ancienne ${JSON.stringify(g10)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    // (clic par le script : avec le rendu logiciel de l'essai, le retour peut dépasser 30 s)
    await mt.evaluate(() => document.getElementById('btn-quit').click());
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden && MT.v3.owLoaded && !MT.v3.worldDirty, null, 120000);
    await rebuilt();
    const back10 = await mt.evaluate(() => ({ editor: ZS.CUR.editor, groups: ZS.ow.placeRoot ? ZS.ow.placeRoot.children.length : 0, hidden: ZS.ow.placeRoot ? ZS.ow.placeRoot.children.filter((g) => !g.visible).length : -1, dirty: MT.isDirty() }));
    ok(back10.editor && back10.groups === 204 && back10.hidden === 0 && !back10.dirty, `retour aux Mod Tools : décor de l’éditeur rechargé avec les retouches ${JSON.stringify(back10)}`);

    /* ================================================== Ombre éternelle */
    await mt.evaluate(() => MT.openGameMap('ombre'));
    await until(() => MT.state.map && MT.state.map.base === 'ombre' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 240000);
    await rebuilt();
    const o1 = await mt.evaluate(() => {
      const D = ZS.ow.placeItems(), mast = D.find((d) => d.kind === 'mat'), lamp = D.find((d) => d.kind === 'lampadaire'), base = D.find((d) => d.kind === 'base');
      return { n: D.filter((d) => !d.surf).length, mast: mast && mast.i, mx: mast && mast.x, mz: mast && mast.z, lamp: lamp && lamp.i, base: !!base && !base.locked && base.kids.filter((k) => !D[k].surf).length === 5, lamps: null };
    });
    await mt.evaluate(([i, x, z]) => { MT.setTool('select'); MT.select({ kind: 'place', i }); MT.begin('Déplacer'); MT.ow.moveTo({ kind: 'place', i }, x + 25, z); MT.commit(); }, [o1.mast, o1.mx, o1.mz]);
    await rebuilt();
    await mt.evaluate((i) => MT.ow.remove('place', i), o1.lamp);
    await rebuilt();
    const o2 = await mt.evaluate(([mi, li, x, z]) => { const D = ZS.ow.placeItems(), pieceOf = (k) => (k >= 0 && D[k].surf ? D[k].parent : k); return { at: pieceOf(ZS.ow.placeAt(x + 25, z)), old: ZS.ow.placeAt(x, z), lampHidden: ZS.ow.placeState(MT.state.map)[li].hidden, e: MT.state.map.placeEdits }; }, [o1.mast, o1.lamp, o1.mx, o1.mz]);
    ok(o1.n === 79 && o1.base && o2.at === o1.mast && o2.old === -1 && o2.lampHidden, `Ombre éternelle : 79 pièces (la base : un moyeu et quatre modules, plus fixe) ; mât solaire déplacé de 25 m (ses cases suivent), lampadaire retiré ${JSON.stringify({ o1, o2: { at: o2.at, old: o2.old } })}`);
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    await mt.evaluate(async () => window.__save);
    ok(!errs.length, `aucune erreur dans la console des Mod Tools ${errs.slice(0, 3).join(' | ')}`);

    /* ================================================ publication, jeu publié */
    const [pub] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), mt.evaluate(() => MT.api.openPublisher())]);
    await pub.waitForFunction(() => document.querySelectorAll('#maps-list li').length >= 2, null, { timeout: 30000 });
    const res = await pub.evaluate((outDir) => window.pub.create({ gameSource: 'installed', version: '9.9.9', notes: 'essai', outDir, repo: '' }), path.join(TMP, 'publications'));
    const { extractZip } = require('../src/main/updater');
    const x = path.join(TMP, 'paquet');
    await extractZip(path.join(res.dir, `zombie-survival-${res.version}.zip`), x);
    const index = JSON.parse(fs.readFileSync(path.join(x, 'maps', 'index.json'), 'utf8'));
    ok(index.files.includes('khamsin') && index.files.includes('ombre'), `paquet publié : maps/khamsin.json et maps/ombre.json ${JSON.stringify(index)}`);
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
      await page.evaluate(() => { window.frame = function () {}; renderEnabled = false; __zs.map('khamsin'); });
      await page.waitForFunction(() => ZS.ow.on && ZS.G.mapId === 'khamsin', null, { timeout: 180000 });
      const g1 = await page.evaluate(() => {
        const m = ZS.MAPS_ALL.byId.khamsin, D = ZS.ow.placeItems(), d = D.find((q) => q.id === 'A.tente@2265,1992.5'), st = ZS.ow.placeState(m)[d.i];
        const at = ZS.ow.placeAt(2290, 1990.5);
        return { src: m.source, n: Object.keys(m.placeEdits || {}).length, x: st.x, at: at >= 0 && D[at].surf ? D[at].parent : at, i: d.i, old: ZS.ow.placeAt(2262.5, 1992.5) };
      });
      ok(g1.src === 'package' && g1.n === 2 && near(g1.x, 2290) && g1.at === g1.i && g1.old === -1 && !perr.length, `jeu publié : Khamsin charge la petite tente déplacée (et la tente-réfectoire) ${JSON.stringify(g1)} ${perr.slice(0, 2).join(' | ')}`);
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
  console.log(failures ? `${failures} échec(s)` : 'Décor des lieux dans les Mod Tools : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
