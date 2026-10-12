'use strict';
/* Essai de bout en bout : tailles réglables (jeu 2.0.3, interface 5) dans les Mod Tools du
   launcher 1.3.2. Copie temporaire du launcher avec une clé de test, dossier de données jetable.

     xvfb-run -a node e2e/modtools-sizes.e2e.js

   Bunker 7 (carte à grille) : caisse posée à la taille choisie (outil Objets, cotes en mètres) ;
   inspecteur : cotes avec et sans proportions, taille d'origine, annuler ; texture du sol à 4 m sur
   toute la carte (coordonnées de texture divisées par deux) ; variante « Sol fin » (0,5 m) créée,
   peinte, rangée dans la carte ; éléments agrandis (distributeur réduit sous le plafond, boîte,
   Pack-A-Punch, interrupteur, arme au mur) ; fichier enregistré puis rouvert ; partie de test (F5).
   Khamsin (carte ouverte) : maison posée à 12 × 8 m, murs de 4 m ; cotes changées dans
   l'inspecteur, tournée (cotes gardées), autre modèle (cotes du catalogue) puis annulé ; atout,
   boîte, disjoncteur agrandis ; caisse étirée en hauteur ; enregistrée. Publication : le jeu
   publié charge les deux cartes avec leurs tailles. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { _electron: electron, chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-tz-'));
const APP = path.join(TMP, 'app');
let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}`); if (!cond) failures++; };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;

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
    /* Champ du panneau (libellé, titre de la section) : valeur écrite puis validée. */
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
    const clickBtn = (re) => mt.evaluate((src) => { const b = [...document.querySelectorAll('#mt-panel button, #mt-modal button')].find((x) => new RegExp(src).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const render = async () => { await mt.evaluate(() => MT.ui.renderPanel()); await mt.waitForTimeout(80); };

    /* ================================================== Bunker 7 (grille) */
    await mt.evaluate(() => { MT.openGameMap('bunker7'); MT.ui.setView('split'); });
    await until(() => MT.state.map && MT.state.map.id === 'bunker7', null);
    await rebuilt();
    const api = await mt.evaluate(() => ({ api: ZS.editorApi, v: ZS.version, sizes: MT.sizesOk(), tex: MT.texOk(), rules: ZS.SIZE_RULES }));
    ok(api.api >= 5 && api.sizes && api.tex && api.rules.prop.join() === '0.02,50' && api.rules.elem.join() === '0.4,3', `moteur 2.0.3, interface 5 ou plus (6 : décor des lieux) : tailles disponibles ${JSON.stringify(api)}`);
    // coordonnées de texture du sol (maillages du niveau avec le matériau de bunker_floor)
    const uvSpan = () => mt.evaluate(() => {
      const mat = levelMaterial('bunker_floor');
      let u0 = Infinity, u1 = -Infinity, n = 0;
      ZS.World.root.traverse((o) => { if (o.isMesh && o.material === mat && o.geometry.attributes.uv) { const a = o.geometry.attributes.uv; for (let i = 0; i < a.count; i++) { const u = a.getX(i); if (u < u0) u0 = u; if (u > u1) u1 = u; } n += a.count; } });
      return { du: Math.round((u1 - u0) * 1000) / 1000, n };
    });
    const uv0 = await uvSpan();

    // A1. outil Objets : caisse posée deux fois plus large (cotes en mètres, sans les proportions)
    await mt.evaluate(() => { MT.setTool('props'); Object.assign(MT.state.opts.props, { model: 'crate_large', snap: 0.5, rot: 0, randomRot: false, randomScale: 0 }); MT.ui.sizeLock = false; MT.ui.setTab('tool'); });
    await render();
    const toolDims = await mt.evaluate(() => MT.modelDims('crate_large').map((v) => Math.round(v * 1000) / 1000));
    ok(await setField('Largeur', toolDims[0] * 2, 'Taille à la pose'), 'outil Objets : champ « Largeur » de la taille à la pose');
    const ts = await mt.evaluate(() => MT.toolScale());
    ok(ts.join() === '2,1,1', `outil Objets : facteurs de pose [2, 1, 1] (largeur doublée, le reste inchangé) ${JSON.stringify({ ts, toolDims })}`);
    await view(29.5, 16.5, 30);
    await click(29.5, 16.5);
    await rebuilt();
    const pa = await mt.evaluate(() => {
      const m = MT.state.map, i = m.props.length - 1, pr = m.props[i], c = MT.propCorners(pr);
      const xs = c.map((p) => p[0]), zs = c.map((p) => p[1]);
      const g = ZS.World.props.children.find((q) => q.userData.prop === i);
      return { n: m.props.length, pr, w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), scale: g ? g.scale.toArray().map((v) => Math.round(v * 1000) / 1000) : null, ghost: MT.preview.ghost && MT.preview.ghost.s };
    });
    ok(pa.pr.m === 'crate_large' && JSON.stringify(pa.pr.s) === '[2,1,1]' && near(pa.w, toolDims[0] * 2) && near(pa.d, toolDims[2]) && pa.scale && pa.scale.join() === '2,1,1',
      `caisse posée à 2,46 × 1 × 1,23 m (plan et vue 3D) ${JSON.stringify(pa)}`);

    // A2. inspecteur : hauteur 3 m avec les proportions (×3 partout), taille d'origine, annuler
    const pi = pa.n - 1;
    await mt.evaluate((i) => { MT.setTool('select'); MT.select({ kind: 'prop', list: [i] }); MT.ui.setTab('sel'); MT.ui.sizeLock = true; }, pi);
    await render();
    ok(await setField('Hauteur', toolDims[1] * 3, 'Taille'), 'inspecteur : champ « Hauteur » de la section Taille');
    await rebuilt();
    const pb = await mt.evaluate((i) => { const pr = MT.state.map.props[i], g = ZS.World.props.children.find((q) => q.userData.prop === i); return { s: pr.s, scale: g ? g.scale.toArray().map((v) => Math.round(v * 1000) / 1000) : null, label: MT.state.undo[MT.state.undo.length - 1].label }; }, pi);
    ok(JSON.stringify(pb.s) === '[6,3,3]' && pb.scale.join() === '6,3,3' && pb.label === 'Taille', `proportions gardées : hauteur ×3, les trois cotes suivent ([6, 3, 3]) ${JSON.stringify(pb)}`);
    await mt.evaluate(() => { MT.ui.sizeLock = false; });
    await render();
    await setField('Profondeur', toolDims[2], 'Taille');
    const pc = await mt.evaluate((i) => MT.state.map.props[i].s, pi);
    await render();
    ok(await clickBtn('Taille d’origine'), 'inspecteur : bouton « Taille d’origine »');
    await rebuilt();
    const pd = await mt.evaluate((i) => ({ s: MT.state.map.props[i].s === undefined ? 'absent' : MT.state.map.props[i].s, ser: JSON.stringify(ZS.serializeMap(MT.state.map).props[i]) }), pi);
    await mt.evaluate(() => MT.undo());
    await rebuilt();
    const pe = await mt.evaluate((i) => MT.state.map.props[i].s, pi);
    ok(JSON.stringify(pc) === '[6,3,1]' && pd.s === 'absent' && !/"s"/.test(pd.ser) && JSON.stringify(pe) === '[6,3,1]',
      `sans les proportions : profondeur seule (${JSON.stringify(pc)}) ; taille d’origine (« s » retiré du fichier) ; annuler la remet ${JSON.stringify({ pd, pe })}`);

    // A3. texture du sol : 4 m sur toute la carte
    await mt.evaluate(() => { MT.setTool('paint'); Object.assign(MT.state.opts.paint, { layer: 'floor', tex: 'bunker_floor', shape: 'brush', size: 1 }); MT.ui.setTab('tool'); MT.ui.sizeLock = true; });
    await render();
    const tx0 = await panelText();
    ok(await setField('Largeur', 4, 'Texture'), 'outil Peinture : taille de la texture sur cette carte');
    await rebuilt();
    const uv1 = await uvSpan();
    const t1 = await mt.evaluate(() => ({ ts: MT.state.map.texSizes, dims: ZS.texDims('bunker_floor'), label: MT.state.undo[MT.state.undo.length - 1].label, txt: MT.ui.tab === 'tool' ? document.getElementById('mt-panel').textContent : '' }));
    ok(/Taille sur cette carte/.test(tx0) && JSON.stringify(t1.ts) === '{"bunker_floor":[4,4]}' && t1.dims.join() === '4,4' && near(uv1.du * 2, uv0.du, 0.05) && uv1.n === uv0.n && /Taille de la texture/.test(t1.label) && /réglée sur cette carte/.test(t1.txt),
      `sol à 4 × 4 m sur toute la carte : coordonnées de texture divisées par deux (${uv0.du} → ${uv1.du}) ${JSON.stringify({ ts: t1.ts, label: t1.label })}`);

    // A4. variante « Sol fin » (0,5 m), peinte sur une case
    await mt.evaluate(() => MT.ui.variantDialog('bunker_floor'));
    await until(() => !!document.querySelector('#mt-modal input[type=text]'), null, 10000);
    await mt.evaluate(() => {
      const rows = [...document.querySelectorAll('#mt-modal .f-row')], put = (label, v) => { const i = rows.find((r) => r.querySelector('.f-label').textContent === label).querySelector('input'); i.value = String(v); i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); };
      put('Nom', 'Sol fin'); put('Largeur', 0.5); put('Hauteur', 0.5);
      [...document.querySelectorAll('#mt-modal button')].find((b) => /Créer/.test(b.textContent)).click();
    });
    await rebuilt();
    const va = await mt.evaluate(() => {
      const id = MT.state.opts.paint.tex, d = ZS.TEXLIB[id];
      return { id, v: MT.state.map.custom.textures[id], lib: d ? [d.cat, d.variant, d.size.join(), d.name] : null, chip: [...document.querySelectorAll('#mt-panel .lib-cats button')].some((b) => /Variantes/.test(b.textContent)), variants: MT.variants() };
    });
    ok(va.id === 'u_v_sol-fin' && JSON.stringify(va.v) === '{"name":"Sol fin","base":"bunker_floor","size":[0.5,0.5]}' && va.lib && va.lib.join('|') === 'variant|bunker_floor|0.5,0.5|Sol fin' && va.chip && va.variants.join() === 'u_v_sol-fin',
      `variante créée : même image, 0,5 × 0,5 m, rangée dans la carte, onglet « Variantes (carte) » ${JSON.stringify(va)}`);
    await view(31.5, 17.5, 30);
    await click(31.5, 17.5);
    await rebuilt();
    const vp = await mt.evaluate(() => ({ cell: MT.cellTexture(31, 17, 'floor'), used: [...MT.usedTextures()].includes('u_v_sol-fin'), same: levelMaterial('u_v_sol-fin') === levelMaterial('bunker_floor') }));
    ok(vp.cell === 'u_v_sol-fin' && vp.used && vp.same, `variante peinte sur une case du sol (même matériau que sa base) ${JSON.stringify(vp)}`);
    // la bibliothèque de l'auteur ne la garde pas (elle est propre à la carte)
    const lib = await mt.evaluate(() => Object.keys(MT.state.library));
    ok(!lib.includes('u_v_sol-fin'), 'la variante n’entre pas dans la bibliothèque d’images de l’auteur');

    // A5. éléments agrandis
    const sizeEl = async (sel, k) => { await mt.evaluate((s) => { MT.setTool('select'); MT.select(s); MT.ui.setTab('sel'); }, sel); await render(); const r = await setField('Taille', k, 'Réglages'); await rebuilt(); return r; };
    const pe0 = await mt.evaluate(() => MT.state.map.perks.findIndex((p) => p.p === 'endurance'));
    ok(await sizeEl({ kind: 'perk', i: pe0 }, 1.5), 'inspecteur du distributeur : réglage « Taille »');
    const el1 = await mt.evaluate((i) => {
      MT.validateNow();
      const pm = ZS.Features.perkMachines.find((q) => q.id === 'endurance');
      return { k: MT.state.map.perks[i].k, s: pm && Math.round(pm.s * 1000) / 1000, front: pm && pm.front.length, txt: document.getElementById('mt-panel').textContent.match(/Réduit à ×[0-9,]+/), warn: MT.state.issues.warnings.map((w) => w.msg).find((w) => /au lieu de ×1,5/.test(w)) || null };
    }, pe0);
    ok(el1.k === 1.5 && el1.s === 1.384 && el1.front === 0 && el1.txt && el1.txt[0] === 'Réduit à ×1,38' && !!el1.warn, `distributeur ×1,5 : réduit à ×1,38 sous les murs de 3,5 m (il n’avance que de 0,38 m : pas de case fermée devant), signalé ${JSON.stringify(el1)}`);
    await sizeEl({ kind: 'box', i: 0 }, 1.5);
    await sizeEl({ kind: 'amp' }, 1.3);
    await sizeEl({ kind: 'power' }, 2);
    await sizeEl({ kind: 'wallbuy', i: 0 }, 1.5);
    await sizeEl({ kind: 'sign', i: 0 }, 2);
    const el2 = await mt.evaluate(() => {
      MT.validateNow();
      const m = MT.state.map, B = ZS.Features.box, L = B.locs[0];
      let sign = false;
      ZS.World.root.traverse((o) => { if (o.isMesh && Math.abs(o.scale.x - 3.4) < 1e-6 && Math.abs(o.scale.y - 0.84) < 1e-6) sign = true; });
      return { box: m.boxes[0].k, loc: L.k, amp: m.amp.k, ampS: ZS.Features.amp && Math.round(ZS.Features.amp.s * 100) / 100, power: m.power.k, wb: m.wallbuys[0].k, sign: m.signs[0].k, signMesh: sign, errors: MT.state.issues.errors.length };
    });
    ok(el2.box === 1.5 && el2.loc === 1.5 && el2.amp === 1.3 && el2.ampS === 1.3 && el2.power === 2 && el2.wb === 1.5 && el2.sign === 2 && el2.signMesh && el2.errors === 0,
      `boîte ×1,5, Pack-A-Punch ×1,3, interrupteur ×2, arme au mur ×1,5, panneau ×2 (3,4 × 0,84 m) ; aucune erreur ${JSON.stringify(el2)}`);

    // A6. enregistrée dans l'atelier ; rouverte
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    const sv = await mt.evaluate(async () => ({ ok: await window.__save, dirty: MT.isDirty() }));
    const fb = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'maps', 'bunker7.json'), 'utf8'));
    const fp = fb.props[fb.props.length - 1];
    ok(sv.ok && !sv.dirty && JSON.stringify(fb.texSizes) === '{"bunker_floor":[4,4]}' && JSON.stringify(fb.custom.textures['u_v_sol-fin']) === '{"name":"Sol fin","base":"bunker_floor","size":[0.5,0.5]}'
      && JSON.stringify(fp.s) === '[6,3,1]' && fb.perks.find((p) => p.p === 'endurance').k === 1.5 && fb.boxes[0].k === 1.5 && fb.amp.k === 1.3 && fb.power.k === 2 && fb.wallbuys[0].k === 1.5 && fb.signs[0].k === 2,
      `fichier enregistré : texSizes, variante (sans image), cotes de la caisse, tailles des éléments ${JSON.stringify({ texSizes: fb.texSizes, v: fb.custom.textures, s: fp.s })}`);
    await mt.evaluate(() => MT.openWorkspaceMap('bunker7'));
    await until(() => MT.state.map && MT.state.source === 'workspace', null);
    await rebuilt();
    const ro = await mt.evaluate(() => ({ v: !!ZS.TEXLIB['u_v_sol-fin'] && ZS.TEXLIB['u_v_sol-fin'].variant, ts: MT.state.map.texSizes.bunker_floor, dims: ZS.texDims('bunker_floor'), cell: MT.cellTexture(31, 17, 'floor'), s: MT.state.map.props[MT.state.map.props.length - 1].s, k: MT.state.map.amp.k }));
    ok(ro.v === 'bunker_floor' && ro.ts.join() === '4,4' && ro.dims.join() === '4,4' && ro.cell === 'u_v_sol-fin' && JSON.stringify(ro.s) === '[6,3,1]' && ro.k === 1.3, `carte rouverte depuis l’atelier : variante et tailles relues ${JSON.stringify(ro)}`);

    // A7. partie de test (F5) : le jeu à ces tailles ; retour
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 120000);
    const play = await mt.evaluate(() => {
      const pm = ZS.Features.perkMachines.find((q) => q.id === 'endurance'), L = ZS.Features.box.locs[0];
      return { map: ZS.G.mapId, dims: ZS.texDims('bunker_floor'), v: ZS.TEXLIB['u_v_sol-fin'] && ZS.TEXLIB['u_v_sol-fin'].size.join(), perk: pm && Math.round(pm.s * 1000) / 1000, box: L.k, amp: ZS.Features.amp && ZS.Features.amp.s };
    });
    ok(play.map === 'bunker7' && play.dims.join() === '4,4' && play.v === '0.5,0.5' && play.perk === 1.384 && play.box === 1.5 && near(play.amp, 1.3), `partie de test : textures et éléments à la taille choisie ${JSON.stringify(play)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    // (clic par le script : avec le rendu logiciel de l'essai, le retour peut dépasser 30 s)
    await mt.evaluate(() => document.getElementById('btn-quit').click());
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden, null, 120000);
    await rebuilt();

    /* ================================================ Khamsin (ouverte) */
    await mt.evaluate(() => MT.openGameMap('khamsin'));
    await until(() => MT.state.map && MT.state.map.base === 'khamsin' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 180000);
    await rebuilt();
    const gone = await mt.evaluate(() => !ZS.TEXLIB['u_v_sol-fin'] && !MT.texOk());
    ok(gone, 'carte ouverte : la variante de Bunker 7 sort de la bibliothèque, pas de taille de texture (cartes à grille)');
    // B1. maison posée à 12 × 8 m, murs de 4 m
    await mt.evaluate(() => { MT.setTool('buildings'); Object.assign(MT.state.opts.ow.bld, { type: 'maison', rot: 0, dims: null }); MT.ui.setTab('tool'); });
    await render();
    await setField('Largeur', 12, 'Cotes à la pose');
    await render();
    await setField('Profondeur', 8, 'Cotes à la pose');
    await render();
    await setField('Hauteur des murs', 4, 'Cotes à la pose');
    const dims = await mt.evaluate(() => MT.state.opts.ow.bld.dims);
    const spot = await mt.evaluate(() => {
      const sp = MT.state.map.spawn.pos;
      for (let ring = 30; ring < 400; ring += 10) for (let a = 0; a < 16; a++) {
        const x = Math.round(sp[0] + Math.cos((a / 16) * Math.PI * 2) * ring), z = Math.round(sp[1] + Math.sin((a / 16) * Math.PI * 2) * ring);
        const r = ZS.ow.buildingPlace('maison', x, z, 0, { w: 14, d: 10 });   // de la marge pour la suite
        if (r.ok) return [r.b.x, r.b.z];
      }
      return null;
    });
    ok(JSON.stringify(dims) === '{"w":12,"d":8,"h":4}' && !!spot, `outil Bâtiments : cotes à la pose 12 × 8 m, murs de 4 m ${JSON.stringify({ dims, spot })}`);
    await view(spot[0], spot[1], 6);
    await click(spot[0], spot[1]);
    await rebuilt();
    const b1 = await mt.evaluate(() => {
      const m = MT.state.map, b = m.buildings[m.buildings.length - 1], R = ZS.ow.bldRect(b);
      const y = b.y, wall = ZS.ow.height((R.x0 + R.x1) / 2, R.z0 + 0.3) - y;
      return { n: m.buildings.length, b, R: [R.w, R.d], wall: Math.round(wall * 100) / 100, objs: ZS.ow.objs.building.length, errors: MT.state.issues.errors.length };
    });
    ok(b1.n === 1 && b1.b.w === 12 && b1.b.d === 8 && b1.b.h === 4 && b1.R.join() === '12,8' && b1.wall >= 3.9 && b1.objs === 1 && b1.errors === 0, `maison posée à 12 × 8 m, murs pleins de 4 m ${JSON.stringify(b1)}`);
    // B2. inspecteur : largeur 10 m ; tournée : cotes gardées ; autre modèle : cotes du catalogue (annulé)
    const bi = b1.n - 1;
    await mt.evaluate((i) => { MT.setTool('select'); MT.select({ kind: 'building', i }); MT.ui.setTab('sel'); }, bi);
    await render();
    ok(await setField('Largeur', 10, 'Cotes'), 'inspecteur du bâtiment : section Cotes');
    await rebuilt();
    const b2 = await mt.evaluate((i) => { const b = MT.state.map.buildings[i], R = ZS.ow.bldRect(b); return { w: b.w, d: b.d, h: b.h, R: [R.w, R.d] }; }, bi);
    await mt.evaluate(() => MT.ow.rotate(1));
    await rebuilt();
    const b3 = await mt.evaluate((i) => { const b = MT.state.map.buildings[i], R = ZS.ow.bldRect(b); return { rot: b.rot, w: b.w, d: b.d, h: b.h, R: [R.w, R.d] }; }, bi);
    ok(b2.w === 10 && b2.d === 8 && b2.h === 4 && b2.R.join() === '10,8' && b3.rot === 1 && b3.w === 10 && b3.d === 8 && b3.h === 4 && b3.R.join() === '8,10',
      `largeur changée (10 × 8 m) ; tournée d’un quart de tour, cotes gardées (emprise 8 × 10 m) ${JSON.stringify({ b2, b3 })}`);
    await render();
    await setField('Modèle', 'maison_blanche', 'Réglages');
    await rebuilt();
    const b4 = await mt.evaluate((i) => { const b = MT.state.map.buildings[i]; return { type: b.type, w: b.w, d: b.d, h: b.h }; }, bi);
    await mt.evaluate(() => MT.undo());
    await rebuilt();
    const b5 = await mt.evaluate((i) => { const b = MT.state.map.buildings[i]; return { type: b.type, w: b.w, d: b.d, h: b.h }; }, bi);
    ok(b4.type === 'maison_blanche' && b4.w === undefined && b4.d === undefined && b4.h === undefined && b5.type === 'maison' && b5.w === 10 && b5.h === 4, `autre modèle : cotes du catalogue ; annuler rend la maison 10 × 8 m ${JSON.stringify({ b4, b5 })}`);
    // B3. éléments agrandis
    await sizeEl({ kind: 'perk', i: 0 }, 1.6);
    await sizeEl({ kind: 'box', i: 0 }, 1.5);
    await sizeEl({ kind: 'breaker', i: 0 }, 1.4);
    await sizeEl({ kind: 'fuel', i: 0 }, 1.5);
    const ow1 = await mt.evaluate(() => {
      MT.validateNow();
      const m = MT.state.map, B = ZS.ow.box, L = B && B.locs[0], f = ZS.ow.objs.fuel[0];
      let fuelH = 0;
      if (f) { const bb = new THREE.Box3().setFromObject(f); fuelH = Math.round((bb.max.y - bb.min.y) * 100) / 100; }
      return { perk: m.perks[0].k, s: ZS.Features.perkMachines[0] && Math.round(ZS.Features.perkMachines[0].s * 1000) / 1000, box: m.boxes[0].k, loc: L && L.k, br: m.breakers[0].k, brScale: ZS.ow.objs.breaker[0] && Math.round(ZS.ow.objs.breaker[0].scale.x * 100) / 100, fuel: m.fuel[0].k, fuelH, errors: MT.state.issues.errors.length };
    });
    ok(ow1.perk === 1.6 && ow1.s > 0.8 && ow1.box === 1.5 && ow1.loc === 1.5 && ow1.br === 1.4 && ow1.brScale === 1.4 && ow1.fuel === 1.5 && near(ow1.fuelH, 0.94 * 1.5, 0.03) && ow1.errors === 0,
      `Khamsin : atout ×1,6, boîte ×1,5, disjoncteur ×1,4, jerricans ×1,5 (pile de 1,41 m) ${JSON.stringify(ow1)}`);
    // B4. caisse étirée en hauteur (outil Objets, carte ouverte)
    await mt.evaluate(() => { MT.setTool('props'); Object.assign(MT.state.opts.props, { model: 'crate_large', snap: 0.5, size: [1, 2, 1] }); MT.ui.setTab('tool'); });
    const sp2 = await mt.evaluate(() => { const s = MT.state.map.spawn.pos; return [Math.round(s[0]) + 3.5, Math.round(s[1]) + 3.5]; });
    await view(sp2[0], sp2[1], 14);
    await click(sp2[0], sp2[1]);
    await rebuilt();
    const op = await mt.evaluate(() => { const m = MT.state.map, i = m.props.length - 1, pr = m.props[i], g = ZS.ow.props && ZS.ow.props.children.find((q) => q.userData.prop === i); return { pr, scale: g ? g.scale.toArray().map((v) => Math.round(v * 1000) / 1000) : null }; });
    ok(op.pr && JSON.stringify(op.pr.s) === '[1,2,1]' && op.scale && op.scale.join() === '1,2,1', `Khamsin : caisse posée deux fois plus haute ${JSON.stringify(op)}`);
    // B5. enregistrée
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    await mt.evaluate(async () => window.__save);
    const fk = JSON.parse(fs.readFileSync(path.join(userData, 'modtools', 'maps', 'khamsin.json'), 'utf8'));
    const kb = fk.buildings[fk.buildings.length - 1];
    ok(kb.type === 'maison' && kb.w === 10 && kb.d === 8 && kb.h === 4 && kb.rot === 1 && fk.perks[0].k === 1.6 && fk.boxes[0].k === 1.5 && fk.breakers[0].k === 1.4 && fk.fuel[0].k === 1.5 && JSON.stringify(fk.props[fk.props.length - 1].s) === '[1,2,1]',
      `Khamsin enregistrée : cotes de la maison, tailles des éléments, caisse étirée ${JSON.stringify(kb)}`);
    ok(!errs.length, `aucune erreur dans la console des Mod Tools ${errs.slice(0, 3).join(' | ')}`);

    /* ================================================ publication, jeu publié */
    const [pub] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), mt.evaluate(() => MT.api.openPublisher())]);
    await pub.waitForFunction(() => document.querySelectorAll('#maps-list li').length === 3, null, { timeout: 30000 });
    const res = await pub.evaluate((outDir) => window.pub.create({ gameSource: 'installed', version: '9.9.9', notes: 'essai', outDir, repo: '' }), path.join(TMP, 'publications'));
    const { extractZip } = require('../src/main/updater');
    const x = path.join(TMP, 'paquet');
    await extractZip(path.join(res.dir, `zombie-survival-${res.version}.zip`), x);
    const index = JSON.parse(fs.readFileSync(path.join(x, 'maps', 'index.json'), 'utf8'));
    ok(index.files.join() === 'bunker7,khamsin' && fs.existsSync(path.join(x, 'maps', 'bunker7.json')), `paquet publié : maps/bunker7.json et maps/khamsin.json ${JSON.stringify(index)}`);
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
      await page.evaluate(() => { window.frame = function () {}; renderEnabled = false; __zs.map('bunker7'); });
      const g1 = await page.evaluate(() => {
        const pm = ZS.Features.perkMachines.find((q) => q.id === 'endurance');
        return { src: ZS.MAPS_ALL.byId.bunker7.source, dims: ZS.texDims('bunker_floor'), v: ZS.TEXLIB['u_v_sol-fin'] && ZS.TEXLIB['u_v_sol-fin'].variant, perk: pm && Math.round(pm.s * 1000) / 1000, box: ZS.Features.box.locs[0].k, amp: ZS.Features.amp && ZS.Features.amp.s, valid: ZS.validateMap(ZS.MAPS_ALL.byId.bunker7).errors.length };
      });
      ok(g1.src === 'package' && g1.dims.join() === '4,4' && g1.v === 'bunker_floor' && g1.perk === 1.384 && g1.box === 1.5 && near(g1.amp, 1.3) && g1.valid === 0, `jeu publié : Bunker 7 du fichier des Mod Tools, à ses tailles ${JSON.stringify(g1)}`);
      await page.evaluate(() => { __zs.map('khamsin'); });
      await page.waitForFunction(() => ZS.ow.on && ZS.G.mapId === 'khamsin', null, { timeout: 180000 });
      const g2 = await page.evaluate(() => {
        const m = ZS.MAPS_ALL.byId.khamsin, b = m.buildings[m.buildings.length - 1], R = ZS.ow.bldRect(b);
        return { src: m.source, b: [b.type, b.w, b.d, b.h, b.rot], R: [R.w, R.d], objs: ZS.ow.objs.building.length, perk: ZS.Features.perkMachines[0] && Math.round(ZS.Features.perkMachines[0].s * 1000) / 1000, br: ZS.ow.objs.breaker[0] && Math.round(ZS.ow.objs.breaker[0].scale.x * 100) / 100 };
      });
      ok(g2.src === 'package' && g2.b.join() === 'maison,10,8,4,1' && g2.R.join() === '8,10' && g2.objs === 1 && g2.perk > 0.8 && g2.br === 1.4 && !perr.length, `jeu publié : Khamsin avec la maison de 10 × 8 m et les éléments agrandis ${JSON.stringify(g2)} ${perr.slice(0, 2).join(' | ')}`);
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
  console.log(failures ? `${failures} échec(s)` : 'Tailles réglables dans les Mod Tools : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
