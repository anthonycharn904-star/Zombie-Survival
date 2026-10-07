'use strict';
/* Abords de Bunker 7 (jeu 1.7.0), dans la fenêtre du jeu du launcher : bâtiments en ruine tous
   différents, arbres sombres, lianes et débris autour de la carte ; rien dans la carte ni dans les
   cours des zombies, couloir de vue dégagé devant chaque fenêtre et une façade au bout ; même
   résultat à chaque construction ; la Bunker 7 publiée (sans abords) les reprend ; "outskirts": null
   les retire ; format de carte ; bibliothèque des Mod Tools (bâtiments, arbres à petite emprise) ;
   temps de construction et cache ; reconstruction différée dans les Mod Tools ; brume épaissie
   du jeu 1.8.0 (masque, bancs et volutes, dérive, discrétion dans les Mod Tools, shaders).
     xvfb-run -a node e2e/outskirts.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-abords-'));
const USER = path.join(TMP, 'joueur');
const PUBLISHED_B7 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'bunker7-publiee-1.5.0.json'), 'utf8'));

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 180000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    game.on('console', (m) => { if (m.type() === 'error' && /WebGLProgram|shader/i.test(m.text())) errors.push(m.text().slice(0, 400)); });
    const res = await game.evaluate((published) => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const r2 = (v) => Math.round(v * 100) / 100;
      renderEnabled = false;
      // ------------------------------------------------------ format de carte
      const nb = normalizeMap(BUNKER7);
      ok(nb.outskirts && nb.outskirts.seed === 7 && nb.outskirts.density === 1, 'Bunker 7 intégrée : abords (graine 7, densité 1)', nb.outskirts);
      const ser = serializeMap(nb);
      ok(ser.outskirts && ser.outskirts.seed === 7 && JSON.stringify(normalizeMap(ser).outskirts) === JSON.stringify(nb.outskirts), 'abords écrits et relus à l’identique');
      ok(published.outskirts === undefined && normalizeMap(published).outskirts && normalizeMap(published).outskirts.seed === 7, 'Bunker 7 publiée (sans abords) : elle reprend ceux de la carte intégrée');
      const off = normalizeMap({ ...published, outskirts: null });
      ok(off.outskirts === false && serializeMap(off).outskirts === null && normalizeMap(serializeMap(off)).outskirts === false, '"outskirts": null les retire, et le reste après enregistrement');
      ok(normalizeMap({ ...BUNKER7, id: 'autre', outskirts: undefined }).outskirts === null, 'autre carte sans le champ : pas d’abords');
      ok(normalizeMap({ ...BUNKER7, outskirts: { seed: -5, density: 9 } }).outskirts.density === 2, 'densité bornée (0,2 à 2)');
      // ------------------------------------------------------ bibliothèque
      const ruins = Object.values(MODELS).filter((m) => m.cat === 'ruines');
      ok(MODEL_CATS.some((c) => c[0] === 'ruines') && ruins.length === OUTSKIRT_BUILDINGS.length && ruins.length >= 20, `bibliothèque : catégorie « Bâtiments en ruine », ${ruins.length} bâtiments`);
      const sigs = ruins.map((m) => { const p = modelParts(m.id); const b = p.box; return `${p.parts.length}:${r2(b.max.x - b.min.x)}:${r2(b.max.y - b.min.y)}:${r2(b.max.z - b.min.z)}`; });
      ok(new Set(sigs).size === ruins.length && ruins.every((m) => modelParts(m.id).parts.length >= 15), 'chaque bâtiment a son propre plan (pièces et dimensions toutes différentes)');
      const trees = ['tree_willow', 'tree_oak_moss', 'tree_spruce_dark', 'tree_twisted', 'tree_birch_dead', 'tree_strangled'];
      ok(trees.every((id) => MODELS[id] && MODELS[id].cat === 'nature') && ['fern', 'vines_hanging', 'ivy_wall'].every((id) => MODELS[id]), 'arbres sombres, fougères, lianes et lierre dans la bibliothèque');
      const foot = propFootprint({ m: 'tree_oak_moss', x: 10.5, z: 10.5, r: 0, s: 1 }, modelParts('tree_oak_moss'));
      ok(foot.length <= 4, 'un arbre posé dans une carte ne bloque que son tronc (emprise de collision réduite)', foot.length);
      // ------------------------------------------------------ construction
      disposeOutskirts();
      let t0 = performance.now();
      buildWorld(normalizeMap(BUNKER7));
      const cold = performance.now() - t0;
      const A = World.outskirts;
      ok(A && A.buildings.length === OUTSKIRT_BUILDINGS.length && new Set(A.buildings.map((b) => b.id)).size === A.buildings.length, `tous les bâtiments sont posés, chacun une fois (${A && A.buildings.length})`, A && A.buildings.map((b) => b.id));
      ok(A.trees.length >= 90 && new Set(A.trees.map((t) => t.sp)).size >= 5 && A.props >= 150 && A.lianas >= 5, `extérieur rempli : ${A.trees.length} arbres (${new Set(A.trees.map((t) => t.sp)).size} essences), ${A.props} objets, ${A.lianas} lianes`);
      // rien dans la carte ni dans les cours ; couloirs de vue dégagés
      const solidAt = (x, z) => { const cx = Math.floor(x), cz = Math.floor(z); if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) return null; for (let li = 0; li < NL; li++) { const t = grid[li * GN + cz * GW + cx]; if (t !== T.VOID) return t; } return null; };
      let bad = [];
      for (const b of A.buildings) {
        const c = Math.cos(b.r), s = Math.sin(b.r);
        for (let u = -1; u <= 1.001; u += 0.1) for (let v = -1; v <= 1.001; v += 0.1) {
          const lx = u * b.hw, lz = v * b.hd, x = b.fx + lx * c + lz * s, z = b.fz - lx * s + lz * c;
          for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (solidAt(x + dx * 1.1, z + dz * 1.1) !== null) { bad.push(b.id); break; }
        }
      }
      ok(bad.length === 0, 'aucun bâtiment sur la carte ni à moins d’un mètre', [...new Set(bad)]);
      bad = A.trees.filter((t) => [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].some(([dx, dz]) => solidAt(t.x + dx, t.z + dz) !== null));
      ok(bad.length === 0, 'aucun arbre sur la carte ni dans les cours des zombies', bad.length);
      const yardNear = (x, z, d) => { for (let a = -d; a <= d; a += 0.5) for (let b = -d; b <= d; b += 0.5) if (Math.hypot(a, b) <= d && solidAt(x + a, z + b) === T.YARD) return true; return false; };
      bad = A.trees.filter((t) => yardNear(t.x, t.z, 2));
      ok(bad.length === 0, 'arbres à plus de 2 m des cours', bad.length);
      const inRect = (b, x, z) => { const c = Math.cos(b.r), s = Math.sin(b.r), dx = x - b.fx, dz = z - b.fz; return Math.abs(dx * c - dz * s) <= b.hw && Math.abs(dx * s + dz * c) <= b.hd; };
      let blocked = 0, vistas = 0;
      for (const w of World.windows) {
        const x0 = w.x + 0.5, z0 = w.z + 0.5;
        for (let t = 1; t <= 11; t += 0.5) {
          const x = x0 + w.nx * t, z = z0 + w.nz * t;
          if (A.buildings.some((b) => inRect(b, x, z)) || A.trees.some((tr) => Math.hypot(tr.x - x, tr.z - z) < 0.8)) { blocked++; break; }
        }
        for (let t = 11; t <= 30; t += 0.5) { if (A.buildings.some((b) => inRect(b, x0 + w.nx * t, z0 + w.nz * t))) { vistas++; break; } }
      }
      ok(blocked === 0, 'devant chaque fenêtre : 11 m sans bâtiment ni arbre', blocked);
      ok(vistas >= Math.ceil(World.windows.length * 0.7), `une façade au bout de la vue (entre 11 et 30 m) pour ${vistas} fenêtres sur ${World.windows.length}`);
      // même résultat à chaque fois ; cache
      const json = JSON.stringify({ b: A.buildings, t: A.trees, p: A.props, l: A.lianas });
      disposeOutskirts();
      buildWorld(normalizeMap(BUNKER7));
      ok(JSON.stringify({ b: World.outskirts.buildings, t: World.outskirts.trees, p: World.outskirts.props, l: World.outskirts.lianas }) === json, 'même graine, même carte : mêmes abords');
      t0 = performance.now();
      buildWorld(normalizeMap(BUNKER7));
      const cached = performance.now() - t0;
      ok(cold < 8000 && cached < 1500, `construction : ${Math.round(cold)} ms la première fois, ${Math.round(cached)} ms ensuite (cache)`, { cold: Math.round(cold), cached: Math.round(cached) });
      buildWorld(normalizeMap(published));
      ok(World.outskirts && JSON.stringify(World.outskirts.buildings) === JSON.stringify(A.buildings), 'Bunker 7 publiée : les mêmes abords que la carte intégrée');
      buildWorld(off);
      ok(World.outskirts === null && World.root.getObjectByName('abords') === undefined, '"outskirts": null : pas d’abords');
      // la partie : rien de changé dans la carte (fenêtres, zombies)
      buildWorld(normalizeMap(BUNKER7));
      let tris = 0, meshes = 0;
      World.root.getObjectByName('abords').traverse((m) => { if (m.isMesh) { meshes++; tris += m.geometry.attributes.position.count / 3; } });
      ok(tris < 450000 && meshes < 400, `géométrie : ${Math.round(tris / 1000)} k triangles, ${meshes} maillages (fusionnés par matière et par secteur)`);
      // ------------------------------------------------------ brume (épaissie dans le jeu 1.8.0)
      const M = OUTSKIRTS.mask, MT = OUTSKIRTS.maskT;
      const mk = (x, z, ch) => {
        const NXm = M.image.width, NZm = M.image.height, i = Math.floor((x - MT.x) * MT.z * NXm), j = Math.floor((z - MT.y) * MT.w * NZm);
        return i < 0 || j < 0 || i >= NXm || j >= NZm ? 1 : M.image.data[(j * NXm + i) * 4 + ch] / 255;
      };
      ok(M && OUT_FOG.mask.value === M && M.image.width * M.image.height > 10000, `brume : masque de ${M.image.width} × ${M.image.height} calculé avec les abords et branché sur la brume`);
      let inMap = 0, cells = 0, under = 0, approach = 0, far = 0, guard = 0;
      for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
        const t = solidAt(x + 0.5, z + 0.5);
        if (t === null) continue;
        cells++;
        if (mk(x + 0.5, z + 0.5, 0) > 0.02) inMap++;
        if (t !== T.YARD && mk(x + 0.5, z + 0.5, 1) > 0.02) under++;
      }
      for (const w of World.windows) {
        for (const s of [1, 2, 3]) if (mk(w.x + 0.5 + w.nx * s, w.z + 0.5 + w.nz * s, 0) > 0.02) approach++;
        if (mk(w.x + 0.5 + w.nx * 12, w.z + 0.5 + w.nz * 12, 0) > 0.98) far++;
        if (mk(w.x + 0.5 + w.nx * 2.5, w.z + 0.5 + w.nz * 2.5, 1) > 0.98) guard++;
      }
      ok(inMap === 0 && approach === 0, `brume : rien dans la carte (${cells} cases), ses cours ni devant les fenêtres où sortent les zombies`, { inMap, approach });
      ok(far === World.windows.length, `brume : pleine à 12 m de chaque fenêtre (${far} sur ${World.windows.length})`);
      ok(under === 0 && guard === World.windows.length, 'brume : les sprites de brume sont effacés sous les bâtiments de la carte (jamais de brume dans une pièce), pas dans les cours', { under, guard });
      const mist = OUTSKIRTS.mist, groundWins = World.windows.filter((w) => LV[w.li] === 0);
      const wisps = mist.filter((s) => solidAt(s.x, s.z) === T.YARD);
      const misplaced = mist.filter((s) => { const t = solidAt(s.x, s.z); return t !== null && t !== T.YARD; });
      ok(World.outskirts.mist === mist.length && mist.length >= 80 && misplaced.length === 0, `brume : ${mist.length} bancs et voiles de brume, aucun dans la carte`, misplaced.length);
      ok(wisps.length === 2 * groundWins.length && groundWins.every((w) => wisps.filter((s) => Math.hypot(s.x - w.x - 0.5, s.z - w.z - 0.5) < 3.6).length >= 2),
        `brume : deux volutes au ras du sol dans la cour de chaque fenêtre (${wisps.length})`);
      animateOutskirts(1000);
      const p0 = mist.map((s) => s.sp.position.clone());
      animateOutskirts(31000);
      const moved = mist.filter((s, i) => s.sp.position.distanceTo(p0[i]) > 0.05).length;
      ok(OUT_FOG.time.value === 31 && moved > mist.length * 0.8, `brume : elle dérive avec le temps (${moved} bancs déplacés en 30 s, plaques au sol animées)`);
      const fog0 = scene.fog.density;
      scene.fog.density = 0.012;
      animateOutskirts(31000);
      const faded = OUTSKIRTS.mistMats.map((mm) => mm.mat.opacity / mm.base);
      scene.fog.density = fog0;
      animateOutskirts(31000);
      const full = OUTSKIRTS.mistMats.map((mm) => mm.mat.opacity / mm.base);
      // même instant : seul le rapport des densités (0,012 / 0,05 = 0,24) les sépare ; le banc « respire » entre 68 et 100 %
      ok(fog0 === 0.05 && faded.every((v, i) => Math.abs(v / full[i] - 0.24) < 0.005) && full.every((v) => v >= 0.67 && v <= 1),
        'brume : plus discrète quand le brouillard de la carte est allégé (Mod Tools, bouton Brouillard : 24 %)', { fog0, faded, full });
      // les shaders de la brume compilent (maillages et sprites)
      const w0 = World.windows[0];
      camera.position.set(w0.x + 0.5 - w0.nx * 0.9, 1.62, w0.z + 0.5 - w0.nz * 0.9);
      camera.lookAt(w0.x + 0.5 + w0.nx * 10, 1.45, w0.z + 0.5 + w0.nz * 10);
      camera.updateMatrixWorld(true);
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      const progs = renderer.info.programs.filter((p) => /abords2(-sprite)?$/.test(p.cacheKey));
      ok(progs.some((p) => p.cacheKey.endsWith('abords2')) && progs.some((p) => p.cacheKey.endsWith('abords2-sprite')) && progs.every((p) => !p.diagnostics || p.diagnostics.runnable !== false),
        `brume : ${progs.length} programmes de rendu compilés sans erreur`, progs.map((p) => p.diagnostics || null));
      ok(OUT_FOG.camW.value.elements[12] === camera.matrixWorld.elements[12] && OUT_FOG.camW.value.elements[14] === camera.matrixWorld.elements[14], 'brume : la caméra du rendu est transmise au shader');
      return out;
    }, PUBLISHED_B7);
    // Mod Tools : quand le contour change pendant l'édition, les abords disparaissent et reviennent
    // 1,2 s après la dernière modification (pas de reconstruction d'une seconde à chaque coup de pinceau)
    res.push(...await game.evaluate(async () => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const raw = serializeMap(normalizeMap(BUNKER7));
      buildWorld(normalizeMap(raw), { editor: true });
      const before = !!World.root.getObjectByName('abords');
      const edits = [];
      for (let i = 0; i < 3; i++) {
        const r2 = JSON.parse(JSON.stringify(raw));
        r2.grid[0] = '#'.repeat(i + 1) + r2.grid[0].slice(i + 1);   // des murs dans le vide : le contour change
        const t0 = performance.now();
        buildWorld(normalizeMap(r2), { editor: true });
        edits.push({ ms: Math.round(performance.now() - t0), shown: !!World.root.getObjectByName('abords') });
        await new Promise((r) => setTimeout(r, 300));
      }
      await new Promise((r) => setTimeout(r, 1500));
      const back = World.root.getObjectByName('abords');
      ok(before && edits.every((e) => !e.shown) && back && World.outskirts && World.outskirts.buildings.length === OUTSKIRT_BUILDINGS.length,
        `Mod Tools : contour modifié trois fois (${edits.map((e) => e.ms).join(', ')} ms), abords refaits 1,2 s après la dernière modification`, { before, edits, back: !!back });
      buildWorld(normalizeMap(BUNKER7));
      return out;
    }));
    for (const r of res) {
      if (!r.ok) failures++;
      console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
    }
    // une vraie partie démarre et tourne avec les abords
    const play = await game.evaluate(() => {
      renderEnabled = true;
      __zs.start(); __zs.god(true);
      __zs.step(240, 1 / 60);
      return { state: G.state, out: !!World.root.getObjectByName('abords'), zombies: Zombies.list.length };
    });
    const okPlay = play.state === 'playing' && play.out;
    if (!okPlay) failures++;
    console.log(`${okPlay ? 'ok    ' : 'ÉCHEC '} partie lancée sur Bunker 7 avec ses abords${okPlay ? '' : ` → ${JSON.stringify(play)}`}`);
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Abords : bâtiments, arbres, débris et brume conformes.');
  process.exit(failures ? 1 : 0);
})();
