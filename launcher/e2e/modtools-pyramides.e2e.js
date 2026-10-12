'use strict';
/* Essai de bout en bout : intérieur des pyramides de Khamsin (jeu 2.0.3, interface 8) dans les Mod Tools
   du launcher 1.3.2, puis en partie de test. Copie temporaire du launcher avec une clé de test, dossier
   jetable.

     xvfb-run -a node e2e/modtools-pyramides.e2e.js

   Khamsin : les trois intérieurs sont des pièces du décor (« Intérieur de Khéops » et ses salles,
   portail, herse, sarcophage…) ; la face nord est échancrée derrière chaque portail (refermée quand le
   portail est retiré, rouverte quand il revient) ; la herse de Khéops a un prix (2 500 d'origine) réglé
   à 3 000 dans l'inspecteur, remis, réglé de nouveau ; la vue 3D vise le sarcophage dans la chambre du
   Roi ; trois armes et un emplacement de la boîte dedans, sans erreur ; une carte de Khamsin d'avant
   (12 armes, 7 emplacements) les reçoit une fois. Partie de test : la herse coûte 3 000, refusée sans
   les points, levée avec ; on entre (nom de la pyramide, lumière de l'intérieur, pas de tempête), on
   monte jusqu'à la chambre du Roi ; les zombies sortent du sable des salles ; la boîte ne part pas
   derrière une herse fermée ; la sauvegarde garde la herse levée. Enregistrée dans l'atelier. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-pyr-'));
const APP = path.join(TMP, 'app');
let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}`); if (!cond) failures++; };
const KHEOPS = 'B.pyramide@2120,1240', DOOR = 'B.herse@2127.5,1138.5', PORTAL_M = 'B.portail@1750.5,1572';

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
    const panelText = () => mt.evaluate(() => document.getElementById('mt-panel').textContent);
    const clickBtn = (re) => mt.evaluate((src) => { const b = [...document.querySelectorAll('#mt-panel button')].find((x) => new RegExp(src).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const render = async () => { await mt.evaluate(() => MT.ui.renderPanel()); await mt.waitForTimeout(80); };
    const idx = (id) => mt.evaluate((id) => { const d = ZS.ow.placeItems().find((q) => q.id === id); return d ? d.i : -1; }, id);
    const shot = async (name) => { if (!process.env.SHOTS) return; await mt.waitForTimeout(600); await mt.screenshot({ path: path.join(process.env.SHOTS, `${name}.png`), timeout: 240000 }).catch((e) => console.log('capture impossible', name, e.message)); };
    const notches = () => mt.evaluate(() => (OW.pyrMeshes || []).map((m) => m.userData.notch));
    /* le nœud visé au centre de la vue 3D, caméra en (cx, cy, cz) vers (tx, ty, tz) */
    const aim = (cx, cy, cz, tx, ty, tz) => mt.evaluate(([cx, cy, cz, tx, ty, tz]) => {
      MT.v3.cam.position.set(cx, cy, cz);
      MT.v3.lookAtPoint(tx, ty, tz);
      const r = MT.v3.canvas.getBoundingClientRect();
      const p = MT.ow.v3.pick({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      const hit = MT.ow.hitTest(p), D = ZS.ow.placeItems();
      return hit && hit.kind === 'place' ? { i: hit.i, name: D[hit.i].name, surf: !!D[hit.i].surf, parent: D[hit.i].parent, pname: D[hit.i].parent >= 0 ? D[D[hit.i].parent].name : '' } : { none: true, hit };
    }, [cx, cy, cz, tx, ty, tz]);

    /* ================================================== Mod Tools : Khamsin */
    await mt.evaluate(() => MT.openGameMap('khamsin'));
    await until(() => MT.state.map && MT.state.map.base === 'khamsin' && MT.v3.owLoaded && !document.getElementById('mt-ow-loading') && !!MT.ow.plan.base, null, 180000);
    await rebuilt();
    // 1. pièces du décor : trois intérieurs, leurs portails et herses (prix d'origine), faces échancrées
    const k1 = await mt.evaluate(() => {
      const D = ZS.ow.placeItems(), P = D.filter((d) => /^Intérieur de /.test(d.name) && !d.surf);
      const kidsOf = (d) => d.kids.map((k) => D[k]).filter((q) => !q.surf);
      const doors = D.filter((d) => d.door).map((d) => ({ id: d.id, name: d.name, cost: d.door.cost, logic: !!d.logic }));
      const K = D.find((d) => d.id === 'B.pyramide@2120,1240');
      return {
        api: ZS.editorApi, n: P.length, names: P.map((d) => d.name).join('|'), doors,
        kheops: K && { surfs: K.kids.filter((k) => D[k].surf).map((k) => D[k].name).filter((t) => /Chambre du Roi|Grande Galerie/.test(t)), pieces: kidsOf(K).map((q) => q.name) },
        wb: MT.state.map.wallbuys.slice(-3).map((w) => w.w).join(), boxes: MT.state.map.boxes.length, adds: (MT.state.map.adds || []).join(),
      };
    });
    ok(k1.api >= 8 && k1.n === 3 && k1.names === 'Intérieur de Khéops|Intérieur de Khéphren|Intérieur de Mykérinos'
      && k1.doors.length === 3 && k1.doors.map((d) => d.cost).join() === '2500,2000,1500' && k1.doors.every((d) => d.logic)
      && k1.kheops.surfs.includes('Chambre du Roi · sol') && k1.kheops.surfs.includes('Grande Galerie · plafond') && k1.kheops.pieces.includes('Portail de Khéops') && k1.kheops.pieces.includes('Sarcophage de Khéops'),
    `interface 8 : trois intérieurs de pyramide dans le décor (salles en surfaces, portail, herse, sarcophage…), trois herses à 2 500 / 2 000 / 1 500 points ${JSON.stringify(k1).slice(0, 400)}`);
    ok(k1.wb === 'fg42,mg42,ppsh' && k1.boxes === 8 && k1.adds === 'pyramides', `éléments des pyramides dans la carte : FG42, MG42, PPSh-41 au mur, 8e emplacement de la boîte (chambre du Roi) ${JSON.stringify({ wb: k1.wb, boxes: k1.boxes, adds: k1.adds })}`);
    const n1 = await notches();
    ok(n1.length === 3 && n1.every((s) => s && s.length > 3), `faces nord échancrées derrière les trois portails ${JSON.stringify(n1)}`);
    // 2. portail de Mykérinos retiré : la face se referme ; remis : échancrée de nouveau
    const pm = await idx(PORTAL_M);
    await mt.evaluate((i) => MT.ow.remove('place', i), pm);
    await rebuilt();
    const n2 = await notches();
    await mt.evaluate((i) => MT.ow.placeUnhide(i), pm);
    await rebuilt();
    const n3 = await notches();
    ok(pm >= 0 && n2[2] === '' && n2[0] === n1[0] && n3[2] === n1[2], `portail retiré : la face de Mykérinos se referme ; remis : l’échancrure revient ${JSON.stringify({ n2, n3 })}`);
    // 3. herse de Khéops : prix réglé dans l'inspecteur (3 000), remis à l'origine, réglé de nouveau
    const di = await idx(DOOR);
    await mt.evaluate((i) => { MT.ui.setTab('sel'); MT.select({ kind: 'place', i }); }, di);
    await render();
    const t3 = await panelText();
    const setPrice = (v) => mt.evaluate((v) => {
      const sec = [...document.querySelectorAll('#mt-panel section.p-sec')].find((s) => /Porte payante/.test(s.querySelector('h3').textContent));
      const inp = sec && sec.querySelector('input.f-num');
      if (!inp) return null;
      const before = inp.value;
      inp.value = String(v); inp.dispatchEvent(new Event('change'));
      return before;
    }, v);
    const before = await setPrice(3000);
    await rebuilt(); await render();
    const e3 = await mt.evaluate((id) => (MT.state.map.placeEdits || {})[id] || null, DOOR);
    const list3 = await mt.evaluate(() => (document.getElementById('mt-panel').textContent.match(/prix/g) || []).length);
    ok(/Porte payante/.test(t3) && /Herse de Khéops/.test(t3) && before === '2500' && e3 && e3.cost === 3000 && Object.keys(e3).length === 1,
      `herse de Khéops sélectionnée : « Porte payante », prix 2 500 → 3 000 (la retouche ne porte que le prix) ${JSON.stringify({ before, e3, list3 })}`);
    const back = await clickBtn('Prix d’origine');
    await rebuilt(); await render();
    const e3b = await mt.evaluate((id) => (MT.state.map.placeEdits || {})[id] || null, DOOR);
    await setPrice(3000);
    await rebuilt(); await render();
    const e3c = await mt.evaluate((id) => (MT.state.map.placeEdits || {})[id] || null, DOOR);
    ok(back && e3b === null && e3c && e3c.cost === 3000, `« Prix d’origine » retire la retouche ; réglé de nouveau à 3 000 ${JSON.stringify({ e3b, e3c })}`);
    await shot('1-herse-prix');
    // 4. vue 3D : dans la chambre du Roi, le sarcophage se vise
    const y0 = await mt.evaluate(() => KH.pyramids[0].y0);
    const a4 = await aim(2116, y0 + 33.2, 1251, 2113, y0 + 31.8, 1249.9);
    ok(a4.name === 'Sarcophage de Khéops' || a4.pname === 'Sarcophage de Khéops', `vue 3D dans la chambre du Roi : le sarcophage se vise ${JSON.stringify(a4)}`);
    // 5. vérification : armes et boîte des pyramides sans erreur ; une carte d'avant reçoit leurs éléments une fois
    const v5 = await mt.evaluate(() => {
      MT.validateNow();
      const old = JSON.parse(JSON.stringify(ZS.openSerialize(MT.state.map)));
      delete old.adds; old.wallbuys = old.wallbuys.slice(0, 12); old.boxes = old.boxes.slice(0, 7);
      const m = ZS.openNormalize(old), again = ZS.openNormalize(JSON.parse(JSON.stringify(ZS.openSerialize(m))));
      const cut = JSON.parse(JSON.stringify(ZS.openSerialize(m))); cut.wallbuys = cut.wallbuys.slice(0, 13);
      return { e: MT.state.issues.errors.map((x) => x.msg), w: MT.state.issues.warnings.map((x) => x.msg).filter((t) => /au mur|sol devant|boîte/.test(t)), old: [m.wallbuys.length, m.boxes.length, (m.adds || []).join()], again: again.wallbuys.length, cut: ZS.openNormalize(cut).wallbuys.length };
    });
    ok(!v5.e.length && !v5.w.length && v5.old.join() === '15,8,pyramides' && v5.again === 15 && v5.cut === 13,
      `vérification sans erreur ; une carte de Khamsin d’avant (12 armes, 7 emplacements) reçoit une fois les armes et la boîte des pyramides, retirées ensuite elles ne reviennent pas ${JSON.stringify(v5)}`);

    /* ================================================== partie de test */
    await mt.evaluate(() => MT.select(null));
    await mt.keyboard.press('F5');
    await until(() => ZS.G.state === 'playing', null, 180000);
    await mt.waitForTimeout(1500);
    const g6 = await mt.evaluate(() => {
      G.roundState = 'pre'; G.roundT = 1e9; G.god = true;
      const D = KHPY.doors[0];
      __zs.tp(2127.5, 1134, Math.PI); __zs.step(5);
      const it = Features.interactables.find((q) => q.kind === 'door' && Math.hypot(q.x - 2127.5, q.z - 1136.6) < 0.5);
      const p0 = it && it.prompt();
      const lockedBefore = Features.box.locs.map((L) => !!(L.locked && L.locked())).join();
      G.points = 2900; it.use();
      const refused = { points: G.points, opening: D.opening };
      G.points = 3500; it.use();
      const bought = { points: G.points, opening: D.opening };
      __zs.step(60 * 2.6);
      return { p0, refused, bought, open: OW.doors[D.i].open, lifted: D.slab.position.y - D.rest.y, after: it.prompt(), lockedBefore, locked: Features.box.locs.map((L) => !!(L.locked && L.locked())).join() };
    });
    ok(g6.p0 && g6.p0.cost === 3000 && /pyramide de Khéops/.test(g6.p0.text) && g6.refused.points === 2900 && !g6.refused.opening && g6.bought.points === 500 && g6.bought.opening && g6.open && g6.lifted > 4 && g6.after === null,
      `partie de test : la herse de Khéops coûte 3 000 (prix de la carte), refusée à 2 900 points, levée à 3 500 ; on passe ${JSON.stringify(g6)}`);
    ok(g6.lockedBefore === 'false,false,false,false,false,false,false,true' && g6.locked === 'false,false,false,false,false,false,false,false', `la boîte mystère ne part pas dans la chambre du Roi tant que la herse est fermée ; levée, la chambre s’ouvre à la boîte ${JSON.stringify([g6.lockedBefore, g6.locked])}`);
    // 7. dedans : nom de la pyramide, lumière de l'intérieur, à l'abri de la tempête ; jusqu'à la chambre du Roi
    const g7 = await mt.evaluate(() => {
      const pts = [[2127.5, 1160], [2127.5, 1166], [2127.5, 1199], [2128, 1203], [2128, 1236], [2128, 1243], [2120, 1250]];
      let t = 0, wi = 0;
      const zones = [];
      const z0 = HUD.zone;
      HUD.zone = (n) => { zones.push(n); return z0.call(HUD, n); };
      Input.keys.KeyW = true;
      while (wi < pts.length && t < 60) {
        const [x, z] = pts[wi], dx = x - player.pos.x, dz = z - player.pos.z;
        if (Math.hypot(dx, dz) < 0.8) { wi++; continue; }
        player.yaw = Math.atan2(-dx, -dz);
        __zs.step(2, 1 / 30); t += 2 / 30;
      }
      Input.keys.KeyW = false;
      HUD.zone = z0;
      KHS.lv = 3;                                         // une tempête dehors : dedans, le niveau ressenti retombe
      __zs.step(60);
      return { wi, n: pts.length, t: Math.round(t), gy: Math.round(player.gy * 100) / 100, want: Math.round((KH.pyramids[0].y0 + 31.3) * 100) / 100, zones, view: KHPY.view, hemi: HEMI.intensity, dark: owDarkness(), storm: Math.round(KHS.lv * 100) / 100 };
    });
    ok(g7.wi === g7.n && Math.abs(g7.gy - g7.want) < 0.05 && g7.zones.includes('Pyramide de Khéops') && g7.view > 0.95 && g7.hemi < 0.4 && g7.dark > 0.99 && g7.storm < 0.5,
      `dedans : le nom « Pyramide de Khéops », la lumière de l’intérieur (ciel éteint, lampes du chantier), à l’abri de la tempête ; on monte jusqu’à la chambre du Roi ${JSON.stringify(g7)}`);
    // 8. les zombies sortent du sable des salles ; la sauvegarde garde la herse levée
    const g8 = await mt.evaluate(() => {
      owComputeFlow();
      const sand = KHPY.items[0].sand, sp = [];
      for (let i = 0; i < 10; i++) { const s = owPickSpawn(); if (s) sp.push(s); }
      const onSand = sp.filter((s) => sand.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < 1.2 && Math.abs(q.y - s.y) < 0.9)).length;
      const zb = sp[0] && spawnZombie(sp[0], 100);
      if (zb) for (let i = 0; i < 40; i++) __zs.step(3, 1 / 30);
      return { n: sp.length, onSand, alive: !!(zb && zb.alive), state: zb && zb.state, save: khSerialize().pyr.join() };
    });
    ok(g8.n === 10 && g8.onSand === 10 && g8.alive && g8.save === 'true,false,false', `les zombies sortent du sable des salles autour du joueur ; sauvegarde : herse de Khéops levée ${JSON.stringify(g8)}`);
    await mt.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await mt.waitForTimeout(400);
    if (await mt.evaluate(() => ZS.G.state === 'playing')) await mt.keyboard.press('Escape');
    await until(() => ZS.G.state === 'paused', null, 10000);
    await mt.evaluate(() => document.getElementById('btn-quit').click());
    await until(() => ZS.G.state === 'editor' && !document.getElementById('mt').hidden && MT.v3.owLoaded && !MT.v3.worldDirty, null, 120000);
    await rebuilt();
    // 9. enregistrée dans l'atelier : le prix de la herse, les éléments des pyramides notés
    await mt.evaluate(() => { window.__save = MT.ui.save(); });
    await until(() => /carte du jeu/.test(document.getElementById('mt-modal').textContent), null, 10000);
    await mt.evaluate(() => [...document.querySelectorAll('#mt-modal button')].find((x) => /Enregistrer dans/.test(x.textContent)).click());
    const saved = await mt.evaluate(async () => ({ ok: await window.__save, dirty: MT.isDirty() }));
    const file = path.join(userData, 'modtools', 'maps', 'khamsin.json');
    const fo = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    ok(saved.ok && !saved.dirty && fo.base === 'khamsin' && fo.placeEdits && fo.placeEdits[DOOR] && fo.placeEdits[DOOR].cost === 3000 && (fo.adds || []).join() === 'pyramides' && fo.wallbuys.length === 15 && fo.boxes.length === 8,
      `enregistrée dans l’atelier : herse de Khéops à 3 000, éléments des pyramides notés (adds), 15 armes, 8 emplacements ${JSON.stringify({ saved, door: fo.placeEdits && fo.placeEdits[DOOR], adds: fo.adds })}`);
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
  console.log(failures ? `${failures} échec(s)` : 'Intérieur des pyramides (Mod Tools et partie de test) : tout est bon.');
  process.exit(failures ? 1 : 0);
})();
