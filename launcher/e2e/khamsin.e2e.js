'use strict';
/* Khamsin (jeu 2.0.0), deuxième carte du menu « Jouer », dans la fenêtre du jeu du launcher : catalogue
   (Bunker 7 puis Khamsin ; absente des Mod Tools), sélection et chargement par l'écran « Jouer », monde
   ouvert de 4 × 3 km (sept lieux, relief, mini-carte, boussole), consignes du menu, éléments (arme au
   mur, atout, boîte mystère, jerricans, disjoncteurs et courant), véhicules (achat, conduite, vue,
   pas de tir au volant, sortie), Desséchés (points de vie, allures, types selon le lieu, yeux), Rôdeur
   (prise, khépesh depuis le jeu 2.0.4), tempêtes, sanctuaire (porte, escalier, autel aux paliers du Glas), draisine,
   sauvegarde, quête et évasion (trois pièces, Gardien, décollage, victoire), écran « Modèles » ;
   retour au Bunker 7 (moteur de grille, Fantassins, consignes d'origine).
     xvfb-run -a node e2e/khamsin.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-khamsin-'));
const USER = path.join(TMP, 'joueur');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  const report = (r) => {
    if (!r.ok) failures++;
    console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
  };
  const ok = (cond, label, extra) => report({ ok: !!cond, label, extra });
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(300000);   // rendu logiciel : la première image du désert est lente
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 180000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    game.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

    // ------------------------------------------------------- catalogue des cartes, Mod Tools
    (await game.evaluate((v) => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(GAME_VERSION === '2.0.7' && ZS.version === v, `jeu 2.0.7 dans le launcher (paquet ${v})`, { GAME_VERSION, v });
      // jeu 2.0.7 : les Marécages Maudits, quand le jeu les contient (MARAIS), viennent en quatrième
      const marais = typeof MARAIS === 'object' ? ['marais'] : [];
      ok(MAPS.list.join() === ['bunker7', 'khamsin', 'ombre', ...marais].join(), 'catalogue : Bunker 7, puis Khamsin (deuxième carte), puis Ombre éternelle', MAPS.list);
      const K = MAPS.byId.khamsin;
      ok(K && K.open && K.name === 'Khamsin' && /^data:image\/jpeg/.test(K.thumb || '') && K.altar === true, 'Khamsin : carte ouverte, vignette tirée de son plan, autel du sanctuaire', K && { open: K.open, name: K.name, thumb: (K.thumb || '').slice(0, 22) });
      ok(!ZS.MAPS.list.includes('khamsin') && ZS.MAPS.list.includes('bunker7') && !ZS.MAPS.byId.khamsin, 'Mod Tools : Khamsin absente du catalogue éditable', ZS.MAPS.list);
      ok(!ZS.ZOMBIE_TYPES.some((t) => /^kh_/.test(t.id)), 'Mod Tools : les Desséchés ne sont pas des types de pièce', ZS.ZOMBIE_TYPES.map((t) => t.id));
      return out;
    }, GAME)).forEach(report);

    // ------------------------------------------------------- « Jouer » : Khamsin, deuxième carte
    await game.click('#btn-play');
    await game.waitForFunction(() => !document.getElementById('mapsel').hidden);
    const cards = await game.evaluate(() => [...document.querySelectorAll('#ms-grid .ms-card')].map((c) => ({
      id: c.dataset.id, name: c.querySelector('.ms-name').textContent, img: !!c.querySelector('.ms-photo img'), desc: (c.querySelector('.ms-desc') || { textContent: '' }).textContent.slice(0, 40),
    })));
    ok(cards.length === 3 && cards[0].id === 'bunker7' && cards[1].id === 'khamsin' && cards[1].name === 'Khamsin' && cards[1].img && /Désert égyptien/.test(cards[1].desc),
      'Jouer : Khamsin, deuxième carte sélectionnable (nom, vignette, description)', cards);
    await game.click('#ms-grid .ms-card[data-id="khamsin"]');
    ok(await game.evaluate(() => MapSel.sel === 'khamsin' && document.querySelector('#ms-grid .ms-card[data-id="khamsin"]').getAttribute('aria-selected') === 'true'), 'Jouer : Khamsin choisie');
    const t0 = Date.now();
    await game.click('#btn-ms-play');
    await game.waitForFunction(() => ZS.G.state === 'playing' && ZS.G.mapId === 'khamsin', null, { timeout: 300000 });
    console.log(`       (chargement de Khamsin et première image : ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

    // ------------------------------------------------------- monde ouvert
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      renderEnabled = false;
      // la souris libérée (fenêtre de test) met le jeu en pause entre deux évaluations : on reprend
      window.__play = () => { if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } __zs.god(true); };
      __play(); G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      ok(OW.on && G.mapId === 'khamsin' && CUR.map === MAPS.byId.khamsin, 'Khamsin chargée par le moteur du monde ouvert');
      ok(OW.W === 4000 && OW.D === 3000, 'monde : 4 × 3 km (le désert entier reste en décor)', [OW.W, OW.D]);
      const names = KH.locs.map((L) => L.name);
      ok(names.length === 7 && names.join('|') === 'Camp de fouilles|Plateau des pyramides|Relais Km 47|Oasis de Sekhet|Centrale du Nil|Nécropole des falaises|Aérodrome', 'sept lieux de la planche', names);
      let lo = 1e9, hi = -1e9;
      for (let x = 50; x < 4000; x += 100) for (let z = 50; z < 3000; z += 100) { const h = owH(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      ok(hi - lo > 30, `relief : ${Math.round(lo)} à ${Math.round(hi)} m (dunes, falaises, vallée du Nil)`, { lo, hi });
      // jeu 2.0.6 : départ au camp du plateau, dans la zone jouable
      const sp = CUR.map.spawn.pos, dy = Math.abs(player.gy - owGroundAt(0, player.pos.x, player.pos.z)), zd = zoneDist(player.pos.x, player.pos.z);
      ok(Math.hypot(player.pos.x - sp[0], player.pos.z - sp[1]) < 2 && dy < 0.05 && zd < -40, 'départ au camp du plateau, dans la zone jouable, les pieds sur le sol', { x: player.pos.x, z: player.pos.z, dy, zd });
      ok(G.points === 500 && curSlot() && curSlot().id === 'm1911', 'départ : 500 points et M1911', { points: G.points, w: curSlot() && curSlot().id });
      __zs.step(30);
      ok(OWH.map && OWH.map.isConnected && !OWH.map.hidden && OWH.comp && OWH.comp.isConnected, 'HUD : mini-carte et boussole');
      ok(VEH.list.map((V) => V.type).join(',') === 'jeep,jeep,jeep', 'véhicules : les trois jeeps (ni buggy ni camion blindé depuis le jeu 2.0.6)', VEH.list.map((V) => V.type));
      ok(Features.perkMachines.length === 5 && KHF.breakers.length === 3 && Features.box.locs.length === 8, 'cinq atouts, trois disjoncteurs, huit emplacements de la boîte (le dernier dans la chambre du Roi)', { perks: Features.perkMachines.length, breakers: KHF.breakers.length, box: Features.box.locs.length });
      return out;
    })).forEach(report);
    // une image du désert (shaders compilés sans erreur)
    const draw = await game.evaluate(() => {
      __play();
      __zs.tp(CUR.map.spawn.pos[0], CUR.map.spawn.pos[1], CUR.map.spawn.yaw); player.pitch = 0; __zs.step(4);
      owUpdateTerrainLod(true); owUpdateRoads();
      renderer.info.autoReset = false; renderer.info.reset();
      renderEnabled = true; render(); renderEnabled = false;
      const r = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      renderer.info.autoReset = true;
      const gl = renderer.getContext();
      r.glError = gl.getError();
      return r;
    });
    ok(draw.calls > 50 && draw.tris > 100000 && draw.glError === 0, `rendu au plateau des pyramides : ${draw.calls} appels de dessin, ${Math.round(draw.tris / 1000)} k triangles`, draw);

    // ------------------------------------------------------- éléments : arme au mur, atout, boîte, jerricans, courant
    const f = await game.evaluate(() => {
      __play();
      const out = {};
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const near = (kind, pred) => Features.interactables.filter((q) => q.kind === kind && (!pred || pred(q))).sort((a, b) => Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(b.x - player.pos.x, b.z - player.pos.z))[0];
      __zs.points(50000);
      const W = CUR.map.wallbuys.find((w) => w.w === 'mp40');
      __zs.tp(W.x + W.nx * 0.9, W.z + W.nz * 0.9, Math.atan2(W.nx, W.nz)); __zs.step(3);
      let it = near('wallbuy');
      out.wallPrompt = it.prompt() && it.prompt().text; it.use(); __zs.step(60);
      out.mp40 = Arms.slots.some((s) => s && s.id === 'mp40');
      it = near('perk', (q) => q.machine.id === 'souffle');
      __zs.tp(it.x, it.z, 0); __zs.step(3);
      out.perkPrompt = it.prompt() && it.prompt().text; it.use(); __zs.step(60 * 5);
      out.souffle = player.perks.has('souffle');
      out.locked = Features.perkMachines.filter((m) => PERKS[m.id].power).map((m) => near('perk', (q) => q.machine === m)).map((q) => { const p = q.prompt(); return p && p.disabled ? 1 : 0; }).join('');
      const bx = Features.box;
      __zs.tp(bx.inter.x, bx.inter.z, 0); __zs.step(3);
      const pts0 = G.points;
      out.boxPrompt = bx.inter.prompt() && bx.inter.prompt().text; bx.inter.use(); __zs.step(60 * 4.6);
      out.boxPaid = pts0 - G.points; out.boxState = bx.state;
      if (bx.state === 'offer') { bx.inter.use(); __zs.step(30); }
      const V = VEH.list[0], fu = KHF.fuel[0];
      V.x = fu.x + 6; V.z = fu.z + 2; V.yaw = 0; V.fuel = 300; vehPose(V, 0, true);
      __zs.tp(fu.x + 0.2, fu.z - 1.2, 0); __zs.step(3);
      it = near('fuel'); out.fuelPrompt = it.prompt().text; it.use(); out.fuel = Math.round(V.fuel); out.fuelMax = V.T.fuel;
      const D = KHSAN.door;
      out.door0 = OW.doors[D.i].open;
      out.power0 = G.power;
      const B0 = KHF.breakers[0];
      __zs.tp(B0.x + B0.nx * 1.4, B0.z + B0.nz * 1.4, Math.atan2(B0.nx, B0.nz)); __zs.step(3);
      const done = [];
      for (const B of KHF.breakers) {
        const q = Features.interactables.find((x) => x.kind === 'breaker' && Math.hypot(x.x - (B.x + B.nx * 0.9), x.z - (B.z + B.nz * 0.9)) < 0.01);
        out.breakerPrompt = out.breakerPrompt || (q.prompt() && q.prompt().text);
        for (let i = 0; i < 300; i++) q.useHold(1 / 60);
        done.push(G.power ? 1 : 0);
      }
      out.steps = done.join('');
      __zs.step(60 * 4);
      out.power = G.power;
      out.lit = Features.perkMachines.every((m) => m.lit);
      out.door = OW.doors[D.i].open;
      return out;
    });
    ok(f.mp40 && /MP40/i.test(f.wallPrompt || ''), 'arme au mur (craie) : MP40 achetée', f);
    ok(f.souffle && f.locked.length === 4 && !f.locked.includes('0'), 'atouts : Souffle sans courant ; les quatre autres attendent le courant', f);
    ok(f.boxPaid === 950 && (f.boxState === 'offer' || f.boxState === 'idle'), 'boîte mystère : 950 points, arme proposée', f);
    ok(/plein|jerrican/i.test(f.fuelPrompt) && f.fuel === f.fuelMax, 'jerricans : plein du 4×4 le plus proche', f);
    ok(!f.power0 && !f.door0, 'sans courant : sanctuaire scellé', f);
    ok(f.steps === '001' && f.power && f.lit && f.door, 'trois disjoncteurs (F maintenue, hangar du plateau) : courant, atouts allumés, porte du sanctuaire', f);

    // ------------------------------------------------------- véhicules
    const v = await game.evaluate(() => {
      __play();
      const out = {};
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      out.types = VEH.list.map((V) => V.type).join(',');
      if (VEH.drive) { Input.down.KeyF = true; __zs.step(2); }
      const V = VEH.list[2], it = Features.interactables.find((q) => q.veh === V);
      V.yaw = -Math.PI / 2; V.v = 0; V.fuel = V.T.fuel; vehPose(V, 0, true);
      __zs.tp(V.x + 3, V.z, 1.57); __zs.step(2);
      out.prompt = it.prompt() && it.prompt().text;
      it.use(); __zs.step(2);
      out.driving = !!VEH.drive && owDriving();
      // jeu 2.0.6 : la jeep démarre d'abord (démarreur de 0,9 à 1,6 s)
      let crank = 0;
      while (V.mech.state.engine !== 'running' && crank < 150) { __zs.step(1); crank++; }
      out.start = +(crank / 60).toFixed(2);
      const x0 = V.x, z0 = V.z, f0 = V.fuel;
      Input.keys.KeyW = true; let vmax = 0;
      for (let i = 0; i < 60 * 4; i++) { __zs.step(1); vmax = Math.max(vmax, Math.abs(V.v)); }
      Input.keys.KeyW = false;
      out.kmh = Math.round(vmax * 3.6); out.moved = Math.round(Math.hypot(V.x - x0, V.z - z0)); out.burnt = f0 - V.fuel > 0;
      out.hud = !OWH.drive.hidden && document.getElementById('hud').classList.contains('ow-driving');
      // au volant, on ne tire pas
      const s = curSlot(), mag0 = s.mag;
      Input.lmb = true; Input.lmbDown = true; __zs.step(30); Input.lmb = false; Input.lmbDown = false; __zs.step(2);
      out.fired = mag0 - s.mag;
      const view0 = VEH.view; Input.down.KeyC = true; __zs.step(2); out.view = [view0, VEH.view];
      Input.down.KeyC = true; __zs.step(2);
      Input.keys.Space = true; __zs.step(120); Input.keys.Space = false;
      out.stopped = Math.abs(V.v) < 0.5;
      Input.down.KeyF = true; __zs.step(3);
      out.out = !VEH.drive && !owDriving(); out.dist = +Math.hypot(player.pos.x - V.x, player.pos.z - V.z).toFixed(1);
      out.ground = Math.abs(player.gy - owGroundAt(0, player.pos.x, player.pos.z)) < 0.1;
      // à pied, l'arme tire de nouveau
      const s2 = curSlot(), m2 = s2.mag;
      Input.lmb = true; Input.lmbDown = true; __zs.step(30); Input.lmb = false; Input.lmbDown = false; __zs.step(2);
      out.firedOnFoot = m2 - s2.mag;
      return out;
    });
    ok(v.types === 'jeep,jeep,jeep' && !Object.prototype.hasOwnProperty.call(v, 'buggy'), 'ni buggy ni camion blindé : leurs types restent dans les Mod Tools', v);
    ok(v.driving && /Conduire le 4×4/.test(v.prompt || ''), '4×4 : F pour conduire', v);
    ok(v.start < 2 && v.kmh > 20 && v.moved > 15 && v.burnt && v.hud, `conduite : moteur en marche en ${v.start} s, puis ${v.kmh} km/h, ${v.moved} m en 4 s, carburant consommé, compteur affiché`, v);
    ok(v.fired === 0 && v.firedOnFoot > 0, 'au volant, on ne tire pas (à pied, si)', v);
    ok(v.view[0] !== v.view[1] && v.stopped, 'C : vue du conducteur ; Espace : frein à main', v);
    ok(v.out && v.dist < 6 && v.ground, 'F : on descend à côté du véhicule, sur le sol', v);

    // ------------------------------------------------------- jeep d'archéologie (jeu 2.0.6) : critères de son INTEGRATION.md
    const jp = await game.evaluate(async () => {
      __play();
      const out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms)), step = (n = 1) => __zs.step(n, 1 / 60);
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      if (VEH.drive) { Input.down.KeyF = true; step(2); }
      // jeu 2.0.6 : la piste de l'aérodrome est hors de la zone jouable ; la zone est suspendue le temps de cet essai
      const zoneC = ZONE.circles; ZONE.circles = [];
      out.types = [typeof createArcheoJeep, typeof createJeepDrive, typeof createJeepAudio].join();
      out.jeeps = VEH.list.filter((V) => V.type === 'jeep').map((V) => (V.jeep && V.mech ? 1 : 0)).join('');
      const V = VEH.list[0], save = { x: V.x, z: V.z, yaw: V.yaw, fuel: V.fuel };
      // piste de l'aérodrome : droite et plate
      const pts = [];
      for (let x = 2; x < OW.W; x += 6) for (let z = 2; z < OW.D; z += 6) if (owBioAt(x, z) === OWB.RUNWAY) pts.push([x, z]);
      let mx = 0, mz = 0; for (const [x, z] of pts) { mx += x; mz += z; } mx /= pts.length; mz /= pts.length;
      let sxx = 0, sxz = 0, szz = 0; for (const [x, z] of pts) { sxx += (x - mx) ** 2; sxz += (x - mx) * (z - mz); szz += (z - mz) ** 2; }
      const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang);
      let lo = 1e9; for (const [x, z] of pts) lo = Math.min(lo, (x - mx) * ux + (z - mz) * uz);
      const P0 = [mx + ux * (lo + 25), mz + uz * (lo + 25)], yaw = Math.atan2(-ux, -uz);
      V.x = P0[0]; V.z = P0[1]; V.yaw = yaw; V.v = 0; V.fuel = V.T.fuel; vehPose(V, 0, true);
      __zs.tp(V.x + 3 * Math.cos(yaw), V.z - 3 * Math.sin(yaw), yaw); step(2);
      // durée du démarreur sur l'horloge du jeu : pendant les attentes, la boucle du jeu avance aussi la jeep
      const g0 = G.time;
      Features.interactables.find((q) => q.veh === V).use();
      while (V.mech.state.engine !== 'running' && G.time - g0 < 3) { step(1); await wait(16); }
      out.start = +(G.time - g0).toFixed(2);
      let t = 0;
      for (let i = 0; i < 30; i++) { step(1); await wait(16); }
      out.mode = V.jsnd && V.jsnd.mode;
      // gaz à fond : passages de rapports
      Input.keys.KeyW = true;
      const ev = {}; let sh0 = false; t = 0;
      for (let i = 0; i < 60 * 10; i++) {
        step(1); t += 1 / 60;
        const s = V.mech.state;
        if (s.shifting && !sh0) ev[`g${s.gear + 1}`] = [+t.toFixed(2), +s.speedKmh.toFixed(1)];
        sh0 = s.shifting;
      }
      Input.keys.KeyW = false;
      out.shifts = ev;
      // frein maintenu à l'arrêt : marche arrière
      Input.keys.KeyS = true;
      let tStop = null; t = 0; out.rev = null; out.back = null;
      for (let i = 0; i < 60 * 10 && out.back === null; i++) {
        step(1); t += 1 / 60;
        if (tStop === null && Math.abs(V.v) < 0.05) tStop = t;
        if (tStop !== null && out.rev === null && V.mech.state.gear === -1) out.rev = +(t - tStop).toFixed(2);
        if (out.rev !== null && V.v < -0.3) { out.back = +(t - tStop).toFixed(2); OWH.t = 0; owUpdateHud(0); out.hudAR = OWH.dName.textContent; }   // compteur rafraîchi 20 fois par seconde : forcé ici
      }
      Input.keys.KeyS = false;
      Input.keys.Space = true; step(150); Input.keys.Space = false;
      out.hand = +Math.abs(V.v).toFixed(3);
      // descente : à 1,3 m à gauche, moteur coupé
      Input.down.KeyF = true; step(2);
      const [fx, fz] = vehFwd(V.yaw), rx = -fz, rz = fx;
      out.exit = [+((player.pos.x - V.x) * fx + (player.pos.z - V.z) * fz).toFixed(2), +((player.pos.x - V.x) * rx + (player.pos.z - V.z) * rz).toFixed(2)];
      out.off = V.mech.state.engine;
      for (let i = 0; i < 120; i++) step(1);
      out.released = !V.jsnd;
      // le son baisse avec la distance (moteur relancé au ralenti, sans conducteur)
      const bus = Sound.bus(), an = bus.ctx.createAnalyser(); an.fftSize = 4096; bus.sortie.connect(an);
      const buf = new Float32Array(an.fftSize);
      const rms = async () => { let s = 0; for (let i = 0; i < 6; i++) { await wait(60); an.getFloatTimeDomainData(buf); let a = 0; for (const x of buf) a += x * x; s += Math.sqrt(a / buf.length); } return 20 * Math.log10(s / 6 + 1e-9); };
      V.mech.startEngine(); jeepSoundOn(V);
      for (let i = 0; i < 150; i++) { step(1); await wait(10); }
      const db = [];
      for (const d of [2, 20]) {
        __zs.tp(V.x + rx * -(d + 0.8), V.z + rz * -(d + 0.8), V.yaw); step(1);
        scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); await wait(120);
        step(1); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); await wait(500);
        db.push(+(await rms()).toFixed(1));
      }
      bus.sortie.disconnect(an);
      out.db = db; out.ctx = bus.ctx.state;
      V.mech.stopEngine(); for (let i = 0; i < 120; i++) step(1);
      // zombies devant le pare-chocs
      const zr = [];
      for (const sp of [3, 5, 9]) {
        clearZombies(); V.x = P0[0]; V.z = P0[1]; V.yaw = yaw; vehPose(V, 0, true); vehEnter(V); step(1);
        const [ax, az] = vehFwd(V.yaw), x = V.x + ax * 2, z = V.z + az * 2, gy = owGroundAt(0, x, z);
        const zb = spawnZombie({ riser: true, x, z, y: gy, li: 0, k: owLocate(x, z, gy), layer: 0, zone: 0 }, 1000);
        zb.state = 'chase'; zb.t = 0; zb.pos.set(x, gy, z); zb.gy = gy; zb.speed = 0.0001; zb.hp = zb.maxHp = 1000;
        V.v = sp; V.mech.state.speed = sp;
        Input.keys.KeyW = true; step(1); Input.keys.KeyW = false;
        zr.push([sp, Math.max(0, Math.round(zb.hp)), zb.alive ? 1 : 0, +(V.v / sp).toFixed(2)]);
        V.v = 0; V.mech.state.speed = 0; vehExit(true); step(2);
      }
      clearZombies();
      out.zombies = zr;
      // coût : draw calls et triangles (passe principale, sans les ombres)
      V.x = P0[0]; V.z = P0[1]; V.yaw = yaw; vehPose(V, 0, true);
      camera.position.set(V.x + 5, V.y + 2.2, V.z + 5); camera.lookAt(V.x, V.y + 0.8, V.z); camera.updateMatrixWorld(true);
      const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
      const meas = () => { renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera); renderer.info.autoReset = true; return [renderer.info.render.calls, renderer.info.render.triangles]; };
      const a1 = meas(); V.jeep.object.visible = false; const a0 = meas(); V.jeep.object.visible = true;
      renderer.shadowMap.autoUpdate = au;
      out.cost = [a1[0] - a0[0], a1[1] - a0[1], V.jeep.stats.triangles, V.extraTris];
      // descente jamais coincée : 100 places tirées au sort près des murs et des objets
      let seed = 7, n = 0, stuck = 0, refused = 0;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const C = Features.interactables.filter((q) => Number.isFinite(q.x) && q.veh !== V).map((q) => [q.x, q.z]);
      for (let i = 0; i < 20000 && n < 100; i++) {
        const c = C[Math.floor(rnd() * C.length)], a = rnd() * 6.283, d = 0.5 + rnd() * 5, x = c[0] + Math.cos(a) * d, z = c[1] + Math.sin(a) * d, yw = rnd() * 6.283;
        const g = owGroundAt(0, x, z);
        if (!Number.isFinite(g)) continue;
        V.y = g; if (vehBlocked(V, x, z, yw)) continue;
        V.x = x; V.z = z; V.yaw = yw; V.v = 0; vehPose(V, 0, true); n++;
        vehEnter(V); V.v = 0; vehExit(false);
        if (VEH.drive === V) { refused++; vehExit(true); }
        const px = player.pos.x, pz = player.pos.z, p0 = player.pos.clone();
        const inBox = VEH.list.some((W) => vehInside(W, px, pz, 0.3));
        owSettle(player, 0.3);
        if (inBox || player.pos.distanceTo(p0) > 0.005) stuck++;
      }
      out.sweep = [n, stuck, refused];
      V.x = save.x; V.z = save.z; V.yaw = save.yaw; V.fuel = save.fuel; V.v = 0; vehPose(V, 0, true);
      ZONE.circles = zoneC;
      return out;
    });
    ok(jp.types === 'function,function,function' && jp.jeeps === '111', 'jeep : fichiers d’Anthony chargés (createArcheoJeep, createJeepDrive, createJeepAudio), les trois 4×4 sur son modèle', jp);
    ok(jp.start > 0.8 && jp.start < 2 && jp.mode === 'worklet', `jeep : démarreur, puis moteur en marche en ${jp.start} s ; son en AudioWorklet`, jp);
    ok(jp.shifts.g2 && jp.shifts.g3 && Math.abs(jp.shifts.g2[1] - 31) < 3 && Math.abs(jp.shifts.g2[0] - 3) < 0.8 && Math.abs(jp.shifts.g3[1] - 53) < 4 && Math.abs(jp.shifts.g3[0] - 7) < 1.2,
      `jeep : gaz à fond sur la piste, 2e à ${jp.shifts.g2 && jp.shifts.g2[1]} km/h (${jp.shifts.g2 && jp.shifts.g2[0]} s), 3e à ${jp.shifts.g3 && jp.shifts.g3[1]} km/h (${jp.shifts.g3 && jp.shifts.g3[0]} s)`, jp);
    ok(jp.rev !== null && jp.rev < 0.8 && jp.back !== null && /· AR ·/.test(jp.hudAR || ''), `jeep : frein maintenu à l’arrêt, marche arrière en ${jp.rev} s, elle recule ; compteur « AR »`, jp);
    ok(jp.hand < 0.05, 'jeep : Espace (frein à main) l’arrête', jp);
    ok(Math.abs(jp.exit[0] + 0.35) < 0.05 && Math.abs(jp.exit[1] + 1.3) < 0.05 && jp.off === 'off' && jp.released, 'jeep : on descend à 1,3 m à gauche, moteur coupé ; son rendu quand il se tait', jp);
    ok(jp.db[0] > jp.db[1] + 5, `jeep : le son baisse avec la distance (${jp.db[0]} dB à 2 m, ${jp.db[1]} dB à 20 m)`, jp);
    ok(jp.zombies[0][1] === 1000 && jp.zombies[0][2] === 1 && Math.abs(jp.zombies[1][1] - 375) < 15 && jp.zombies[1][2] === 1 && jp.zombies[2][2] === 0 && Math.abs(jp.zombies[2][3] - 0.85) < 0.03,
      'jeep : zombie au pare-chocs, rien à 3 m/s, dégâts proportionnels à 5 m/s, mort à 9 m/s ; la jeep perd 15 % de sa vitesse', jp);
    ok(jp.cost[0] === 31 && Math.abs(jp.cost[2] - 15600) < 200 && jp.cost[3] > 0 && jp.cost[1] === jp.cost[2] + jp.cost[3], `jeep : ${jp.cost[0]} draw calls, ${jp.cost[1]} triangles (${jp.cost[2]} du fichier, ${jp.cost[3]} des passages de roue avant)`, jp);
    ok(jp.sweep[0] === 100 && jp.sweep[1] === 0, `jeep : descente jamais coincée (100 places près des murs et des objets, ${jp.sweep[2]} descentes forcées)`, jp);

    // ------------------------------------------------------- Desséchés
    const z = await game.evaluate(() => {
      __play();
      const out = {};
      out.hp = [1, 2, 10, 11].map((n) => khHp(n));
      const mix = (r) => { const c = { walk: 0, jog: 0, run: 0 }; for (let i = 0; i < 600; i++) c[rollSpeedType(r)]++; return c; };
      out.r5 = mix(5); out.r6 = mix(6);
      const ty = (zi) => { const c = {}; for (let i = 0; i < 600; i++) { const t = zoneZombieType(zi).id; c[t] = (c[t] || 0) + 1; } return c; };
      out.camp = ty(0); out.oasis = ty(3);
      __zs.tp(CUR.map.spawn.pos[0], CUR.map.spawn.pos[1], CUR.map.spawn.yaw); __zs.step(5);
      __zs.round(1); __zs.step(5);
      out.zombieHp = G.zombieHp;
      __zs.step(60 * 10);
      const zs = Zombies.list.filter((q) => q.alive);
      out.alive = zs.length;
      out.types = [...new Set(zs.map((q) => q.type.id))];
      out.eyes = [...new Set(zs.map((q) => q.look.eyes))].every((e) => e === KH_EYE_LIN);
      out.onGround = zs.every((q) => Math.abs(q.gy - owGroundAt(q.layer || 0, q.pos.x, q.pos.z)) < 0.1);
      out.rodeurs = zs.filter((q) => q.rodeur).length;
      clearZombies(); G.roundState = 'pre'; G.roundT = 1e9;
      return out;
    });
    ok(z.hp.join(',') === '150,250,1050,1155', 'Desséchés : 150 PV, +100 par manche jusqu’à la 10, puis ×1,1', z.hp);
    ok(z.r5.jog === 0 && z.r5.run === 0 && z.r6.run > 0, 'Desséchés : ils marchent, puis courent dès la manche 6', { r5: z.r5, r6: z.r6 });
    ok(z.camp.kh_arch > z.camp.kh_villageois && z.oasis.kh_villageois > z.oasis.kh_arch, 'types selon le lieu : archéologues au camp, villageois à l’oasis', { camp: z.camp, oasis: z.oasis });
    ok(z.zombieHp === 150 && z.alive > 0 && z.types.every((t) => /^kh_(arch|ouvrier|villageois)$/.test(t)) && z.eyes && z.onGround && z.rodeurs === 0,
      `manche 1 : ${z.alive} Desséchés debout (yeux turquoise), aucun Rôdeur hors tempête`, z);

    // ------------------------------------------------------- tempêtes ; Rôdeur : prise, khépesh (V)
    const r = await game.evaluate(() => {
      __play();
      const out = {};
      const st = (sec) => { for (let i = 0; i < sec * 30; i++) __zs.step(1, 1 / 30); };
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      __zs.tp(2150, 1470, 0.9); st(0.2);
      // une tempête toutes les quatre manches : alerte (60 s), puis le mur de sable arrive
      khOnRound(3); out.round3 = KHS.on;
      khOnRound(4); out.round4 = KHS.on;
      st(90);
      out.phase = KHS.on ? KHS_PHASES[KHS.i][0] : 'calme'; out.lv = +KHS.lv.toFixed(2);
      // au cœur de la tempête (niveau > 1,4 : les Rôdeurs sortent), un Rôdeur sort du sable à 6 m : il charge et agrippe
      let wait = 0;
      for (; wait < 30 * 60 && KHS.lv <= 1.6; wait++) __zs.step(1, 1 / 30);
      out.lvRodeur = +KHS.lv.toFixed(2); out.wait = Math.round(wait / 30);
      clearZombies(); KHR.t = 1e9;
      const zr = khSpawnRodeur(player.pos.x + 6, player.pos.z + 0.5);
      out.spawned = !!zr; out.hp = zr && zr.maxHp;
      let grabbed = false;
      for (let i = 0; i < 30 * 6 && !grabbed; i++) { __zs.step(1, 1 / 30); if (player.grabT > 0) grabbed = true; }
      out.grabbed = grabbed;
      const p0 = player.pos.clone();
      Input.keys.KeyW = true; st(0.5); Input.keys.KeyW = false;
      out.held = +Math.hypot(player.pos.x - p0.x, player.pos.z - p0.z).toFixed(2);
      // khépesh (V, l'arme de corps-à-corps du désert depuis le jeu 2.0.4), face au Rôdeur
      player.yaw = Math.atan2(-(zr.pos.x - player.pos.x), -(zr.pos.z - player.pos.z)); player.pitch = -0.2;
      Input.keys.KeyV = true; Input.down.KeyV = true; __zs.step(1); Input.keys.KeyV = false;
      let freed = false, state = null;
      for (let i = 0; i < 60 && !freed; i++) { __zs.step(1); if (!(player.grabT > 0)) { freed = true; state = zr.rstate; } }
      out.freed = freed; out.state = state;
      damageZombie(zr, 1e6, { kind: 'bullet', dx: 1, dz: 0, head: true }); __zs.step(2);
      out.dead = !zr.alive;
      khStormReset(); clearZombies(); khEnemiesReset(); KHR.t = 1e9;
      out.reset = !KHS.on;
      return out;
    });
    ok(!r.round3 && r.round4 && r.phase !== 'calme' && r.lv > 0 && r.reset, `tempête à la manche 4 (pas à la 3) ; au bout de 90 s : ${r.phase}, niveau ${r.lv}`, r);
    ok(r.spawned && r.grabbed && r.held < 0.2, 'Rôdeur (en tempête) : il charge et agrippe ; on ne bouge plus', r);
    ok(r.freed && r.state === 'stun' && r.dead, 'khépesh (V) : le Rôdeur lâche prise, étourdi ; il meurt sous les balles', r);

    // ------------------------------------------------------- sanctuaire, autel (paliers du Glas)
    const s = await game.evaluate(() => {
      __play();
      const out = {};
      const st = (sec) => { for (let i = 0; i < sec * 30; i++) __zs.step(1, 1 / 30); };
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      __zs.tp(2190, 1405, 0); st(0.3);
      Input.keys.KeyW = true; __zs.step(60 * 1.2); Input.keys.KeyW = false; __zs.step(5);
      const down = Features.interactables.find((i) => i.kind === 'portal' && i.y > 0);
      out.downPrompt = down.prompt() && down.prompt().text;
      down.use(); __zs.step(60 * 1.2);
      out.under = { layer: player.layer, view: KHSAN.view, gy: +player.gy.toFixed(2), terrain: OWTER.group.visible };
      const amp = Features.amp;
      __zs.points(50000);
      const id0 = curSlot().id;
      __zs.tp(2120, 1243, Math.PI, -1); __zs.step(5);
      const ia = Features.interactables.find((i) => i.kind === 'amp');
      out.altarPrompt = ia.prompt() && ia.prompt().text;
      Input.keys.KeyF = true; Input.down.KeyF = true;
      glasOffer(amp);
      let maxTier = 0;
      for (let i = 0; i < 60 * 4.2; i++) { amp.holdT = G.time; __zs.step(1); maxTier = Math.max(maxTier, amp.tier); }
      Input.keys.KeyF = false; Input.down.KeyF = false;
      __zs.step(60 * 4);
      out.ritual = { state: amp.state, maxTier };
      if (amp.state === 'ready') glasTake(amp);
      __zs.step(10);
      out.after = { id: curSlot().id, tier: curSlot().tier, same: curSlot().id === id0 };
      const F = KHSAN.stairFoot; __zs.tp(F.x, F.z - 0.5, Math.PI, -1); __zs.step(3);
      const up = Features.interactables.find((i) => i.kind === 'portal' && i.y < 0);
      up.use(); __zs.step(60 * 1.2);
      out.up = { layer: player.layer, view: KHSAN.view, terrain: OWTER.group.visible };
      out.glasSource = MOD_SOURCES.glas.has(CUR.map);
      return out;
    });
    ok(s.under.layer === 1 && s.under.view === 'under' && !s.under.terrain && s.under.gy < -5, 'kiosque : l’escalier descend au sanctuaire (sous le plateau)', s);
    ok(s.ritual.maxTier >= 1 && s.after.same && s.after.tier >= 1 && s.glasSource, `autel du sanctuaire : rituel du Glas (palier ${s.after.tier})`, s);
    ok(s.up.layer === 0 && s.up.view === 'surface' && s.up.terrain, 'remontée au plateau par l’escalier', s.up);

    // ------------------------------------------------------- quête, Gardien et draisine retirés (jeu 2.0.6)
    const nq = await game.evaluate(() => {
      __play();
      const out = {}, st = (sec) => { for (let i = 0; i < sec * 30; i++) __zs.step(1, 1 / 30); };
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      out.quest = Features.interactables.filter((i) => i.kind === 'quest').length;
      out.items = KHQ.items; out.hud = !KHQ.hud || KHQ.hud.hidden; out.pilot = !KHQ.pilot;
      out.draisine = Features.interactables.filter((i) => i.prompt && /draisine/.test((i.prompt() || {}).text || '')).length + (KHT.group ? 1 : 0);
      // un pic de Khamsin (alerte 60 s, tempête 90 s, Khamsin) : le Gardien ne traverse plus
      __zs.tp(CUR.map.spawn.pos[0], CUR.map.spawn.pos[1], 0); st(0.2);
      khStormStart(); st(60 + 90 + 15);
      out.phase = KHS.on ? KHS_PHASES[KHS.i][0] : 'calme';
      out.gardien = !!(KHG.e && !KHG.e.removed) || Zombies.list.some((z) => z.alive && z.boss);
      khStormReset(); clearZombies(); khEnemiesReset(); KHR.t = 1e9;
      out.fiches = SPECIMEN_TYPES.filter((t) => t.boss || t.pilot).length;
      return out;
    });
    ok(nq.quest === 0 && nq.items === null && nq.hud && nq.pilot, 'quête retirée : ni pièces de l’avion, ni pilote, ni objectifs à l’écran', nq);
    ok(nq.draisine === 0, 'draisine retirée (elle menait à la nécropole, dans la tempête)', nq);
    ok(nq.phase === 'khamsin' && !nq.gardien && nq.fiches === 0, 'Gardien retiré : il ne traverse plus au pic de Khamsin ; ni lui ni le pilote dans l’écran Modèles', nq);

    // ------------------------------------------------------- sauvegarde de la partie (rechargement à chaud)
    const sv = await game.evaluate(() => {
      __play();
      const V = VEH.list[1]; V.x += 30; V.z += 10; V.fuel = 7;
      const want = [Math.round(V.x), Math.round(V.z)];
      const save = JSON.parse(JSON.stringify(serializeGame()));
      quitToMenu();
      const cleared = Math.round(VEH.list[1].x) !== want[0];
      startGame(save);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true); G.roundState = 'pre'; G.roundT = 1e9; __zs.step(5);
      const W = VEH.list[1];
      return { cleared, map: save.map, veh: [Math.round(W.x), Math.round(W.z), W.fuel], want, power: G.power, door: OW.doors[KHSAN.door.i].open };
    });
    ok(sv.map === 'khamsin' && sv.cleared && sv.veh[0] === sv.want[0] && sv.veh[1] === sv.want[1] && sv.veh[2] === 7 && sv.power && sv.door,
      'sauvegarde : véhicules, courant et porte du sanctuaire retrouvés', sv);

    // ------------------------------------------------------- zone jouable et tempête permanente (jeu 2.0.6)
    const zj = await game.evaluate(() => {
      __play();
      const out = {}, step = (n = 1) => __zs.step(n, 1 / 60);
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
      if (VEH.drive) { Input.down.KeyF = true; step(2); }
      const M = CUR.map;
      out.cercles = ZONE.circles.length;
      out.dehors = [...M.wallbuys, ...M.perks, ...M.boxes, ...M.fuel, ...M.breakers, ...M.vehicles].filter((e) => zoneDist(e.x, e.z) > 0).length;
      out.lieux = (OW.locsShown || []).map((L) => L.name).join(' | ');
      out.rideau = !!ZONE.curtain && !!ZONE.curtain.parent;
      // la piste du camp (ab) descend du plateau : on y passe le bord
      const T = KH.roads.find((r) => r.id === 'ab'), pts = ((T.line && T.line.pts) || T.pts).slice().reverse();
      const along = [];
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L; s += 2) along.push([a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L]); }
      const idx = (d) => { let i = 0; while (i < along.length - 1 && zoneDist(along[i][0], along[i][1]) < d) i++; return i; };
      const tpAt = (i, back) => { const p = along[i], q = along[Math.min(along.length - 1, i + 3)], y = Math.atan2(-(q[0] - p[0]), -(q[1] - p[1])); __zs.tp(p[0], p[1], back ? y + Math.PI : y); };
      // apparitions : le joueur 20 m avant le bord, puis 30 et 90 m dehors
      const sp = { dedans: 0, dehors: 0 };
      for (const d of [-20, 30, 90]) { tpAt(idx(d)); step(1); for (let k = 0; k < 60; k++) { const q = owPickSpawn(); if (q) { if (zoneDist(q.x, q.z) > -4) sp.dehors++; else sp.dedans++; } } }
      out.apparitions = sp;
      // un zombie près du bord, le joueur 60 m dehors : il reste dedans ; le champ de flux ne passe pas dehors
      tpAt(idx(-12)); step(2);
      const p0 = player.pos.clone(), gy0 = owGroundAt(0, p0.x, p0.z);
      const zb = spawnZombie({ riser: true, x: p0.x, z: p0.z, y: gy0, li: 0, k: owLocate(p0.x, p0.z, gy0), layer: 0, zone: 0 }, 500);
      zb.state = 'chase'; zb.t = 0;
      OWNAV.ready = false; owComputeFlow();
      let flux = 0;
      for (let j = 0; j < OWNAV.N; j++) for (let i = 0; i < OWNAV.N; i++) if (OWNAV.walk[j * OWNAV.N + i] && zoneDist(OWNAV.x0 + i + 0.5, OWNAV.z0 + j + 0.5) > 0.5) flux++;
      out.flux = flux;
      tpAt(idx(60)); let zmax = -1e9;
      for (let k = 0; k < 60 * 8; k++) { step(1); if (zb.alive) zmax = Math.max(zmax, zoneDist(zb.pos.x, zb.pos.z)); }
      out.zmax = +zmax.toFixed(2);
      clearZombies();
      // niveaux de la tempête : 20 m avant le bord, puis 30 m dehors
      const lv = (d) => { tpAt(idx(d)); for (let k = 0; k < 150; k++) step(1); return { lv: +KHS.lv.toFixed(2), vis: Math.round(Math.sqrt(3) / scene.fog.density), carte: OW.mapMode, bandeau: !OWH.storm.hidden ? OWH.storm.textContent : '' }; };
      out.avant = lv(-20); out.dehors30 = lv(30);
      tpAt(idx(-150)); for (let k = 0; k < 240; k++) step(1);
      // à pied, sans dieu : 3 s dehors, puis demi-tour
      const walk = (turn, max = 40) => {
        __zs.god(false); player.hp = player.maxHp; ZONE.expo = 0; ZONE.killed = false;
        let f = idx(-45), t = 0, out0 = null, back = false, min = player.hp;
        tpAt(f); step(2);
        while (t < max && G.state === 'playing') {
          const d = zoneDist(player.pos.x, player.pos.z);
          if (d > 0 && out0 === null) out0 = t;
          if (turn !== undefined && out0 !== null && t - out0 >= turn) back = true;
          f = Math.max(0, Math.min(along.length - 1, f + ((back ? -1 : 1) * 5) / 60 / 2));
          const p = along[Math.floor(f)]; player.pos.x = p[0]; player.pos.z = p[1]; player.k = -1; player.gy = NaN;
          step(1); t += 1 / 60; min = Math.min(min, player.hp);
          if (back && d < -45) break;
        }
        return { mort: G.state === 'gameover', dehors: out0 === null ? 0 : +(t - out0).toFixed(1), min: Math.round(min), max: player.maxHp, titre: document.getElementById('go-title').textContent };
      };
      out.retour = walk(3);
      step(60 * 5);
      out.retour.pvApres = Math.round(player.hp); out.retour.out = ZONE.out; out.retour.expo = +ZONE.expo.toFixed(2);
      __zs.god(true);
      // manche de tempête pendant qu'on est au camp : ses phases, sans les dégâts de la zone
      __zs.tp(M.spawn.pos[0], M.spawn.pos[1], 0); step(2);
      khStormStart(); for (let k = 0; k < 30 * 175; k++) __zs.step(1, 1 / 30);
      out.manche = { phase: KHS.on ? KHS_PHASES[KHS.i][0] : 'calme', out: ZONE.out, expo: ZONE.expo };
      khStormReset(); clearZombies(); khEnemiesReset(); KHR.t = 1e9;
      // Mastodonte et second souffle, on continue tout droit : la mort, sans réanimation
      player.perks.add('cuirasse'); player.perks.add('souffle'); player.souffleUses = 0; player.maxHp = RULES.playerHp * 2.5;
      out.mort = walk(undefined, 60);
      return out;
    });
    ok(zj.cercles === 6 && zj.dehors === 0 && zj.lieux === 'Plateau des pyramides' && zj.rideau, 'zone jouable : six cercles « Zone jouable » (le plateau) ; tous les éléments dedans ; seul le plateau à l’écran ; rideau de poussière', zj);
    ok(zj.apparitions.dedans > 0 && zj.apparitions.dehors === 0, `apparitions des zombies : jamais hors de la zone (${zj.apparitions.dedans} dedans)`, zj.apparitions);
    ok(zj.zmax <= 0.05 && zj.flux === 0, `le joueur dehors, un zombie reste dans la zone (au plus ${zj.zmax} m dehors) ; leur champ de flux ne passe pas dehors`, zj);
    ok(zj.avant.lv > 0.2 && zj.avant.lv < 1 && zj.dehors30.lv >= 2 && zj.dehors30.vis < 160 && zj.dehors30.carte === 'off' && zj.dehors30.bandeau === 'Tempête mortelle · faites demi-tour',
      `tempête permanente : vent avant le bord (niveau ${zj.avant.lv}) ; 30 m dehors : niveau ${zj.dehors30.lv}, ${zj.dehors30.vis} m de visibilité, mini-carte coupée, bandeau`, zj);
    ok(!zj.retour.mort && zj.retour.min > 0 && zj.retour.min < zj.retour.max && zj.retour.pvApres === zj.retour.max && !zj.retour.out && zj.retour.expo === 0,
      `demi-tour après 3 s dehors : on survit (${zj.retour.min} PV au plus bas) ; dedans, plus de dégâts, la vie remonte`, zj.retour);
    ok(zj.manche.phase === 'khamsin' && !zj.manche.out && zj.manche.expo === 0, 'manche de tempête au camp : ses phases (Khamsin), sans les dégâts de la zone', zj.manche);
    ok(zj.mort.mort && zj.mort.titre === 'Emporté par le Khamsin' && zj.mort.dehors > 5 && zj.mort.dehors < 16,
      `Mastodonte et second souffle, on continue : mort dans la tempête après ${zj.mort.dehors} s dehors, sans réanimation`, zj.mort);
    await game.waitForFunction(() => !document.getElementById('gameover').hidden, null, { timeout: 30000 });
    await game.click('#btn-go-menu');
    await game.waitForFunction(() => ZS.G.state === 'menu' && !document.getElementById('menu').hidden);

    // ------------------------------------------------------- menu de Khamsin : consignes
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const txt = (id) => document.getElementById(id).textContent;
      ok(/Khamsin/.test(txt('menu-eyebrow')) && /plateau des pyramides/.test(txt('menu-eyebrow')) && /la tempête tue/.test(txt('menu-lead')), 'menu : rapport d’incident et consigne de Khamsin (le plateau, la tempête)', [txt('menu-eyebrow'), txt('menu-lead')]);
      ok(!vis('tip-planks') && vis('tip-box') && /voyage de lieu en lieu/.test(txt('tip-box')) && vis('tip-power') && /hangar du plateau/.test(txt('tip-power')) && vis('tip-veh') && vis('tip-storm'),
        'consignes de Khamsin : pas de planches ; boîte qui voyage, disjoncteurs du hangar, véhicules, tempêtes', ['tip-planks', 'tip-box', 'tip-power', 'tip-veh', 'tip-storm'].map((id) => (vis(id) ? '' : '[caché] ') + txt(id).slice(0, 40)));
      return out;
    })).forEach(report);

    // ------------------------------------------------------- écran « Modèles » : Desséchés et Rôdeur (jeu 2.0.6 : ni pilote, ni Gardien)
    await game.click('#btn-models');
    await game.waitForFunction(() => !document.getElementById('models').hidden);
    const md = await game.evaluate(() => {
      const out = {};
      for (const id of ['kh_pilote', 'kh_gardien']) out[id] = { listed: !!document.querySelector(`#md-tabs [data-id="${id}"]`) };
      for (const id of ['kh_arch', 'kh_ouvrier', 'kh_villageois', 'kh_rodeur']) {
        const listed = !!document.querySelector(`#md-tabs [data-id="${id}"]`);
        selectSpecimen(id);
        for (let i = 0; i < 12; i++) renderModels(1 / 30);
        const p = __zs.modelProbe();
        out[id] = { listed, name: document.getElementById('md-plate-name').textContent, drawn: p ? +p.changed.toFixed(3) : null };
      }
      return out;
    });
    const mdOk = ['kh_arch', 'kh_ouvrier', 'kh_villageois', 'kh_rodeur'].every((id) => md[id].listed && md[id].name && md[id].drawn > 0.005) && !md.kh_pilote.listed && !md.kh_gardien.listed;
    ok(mdOk, 'Modèles : fiches et modèles 3D des trois Desséchés et du Rôdeur ; ni pilote ni Gardien', md);
    await game.evaluate(() => showScreen('menu'));

    // ------------------------------------------------------- retour au Bunker 7
    await game.click('#btn-play');
    await game.waitForFunction(() => !document.getElementById('mapsel').hidden);
    await game.click('#ms-grid .ms-card[data-id="bunker7"]');
    await game.click('#btn-ms-play');
    await game.waitForFunction(() => ZS.G.state === 'playing' && ZS.G.mapId === 'bunker7', null, { timeout: 300000 });
    const b7 = await game.evaluate(() => {
      renderEnabled = false;
      __zs.god(true);
      if (__zs.dogs) __zs.dogs(false);
      __zs.round(1); __zs.step(30);
      const hp = G.zombieHp;
      __zs.step(60 * 12);
      const zs = Zombies.list.filter((q) => q.alive);
      const out = { owOn: OW.on, hp, alive: zs.length, types: [...new Set(zs.map((q) => q.type.id))], khEyes: !!(KHE.pts && KHE.pts.visible), hud: !!(OWH.map && OWH.map.isConnected && !OWH.map.hidden), grid: grid.length > 64 };
      quitToMenu();
      const vis = (id) => !document.getElementById(id).hidden;
      out.tips = { planks: vis('tip-planks'), veh: vis('tip-veh'), storm: vis('tip-storm'), box: document.getElementById('tip-box').textContent, power: document.getElementById('tip-power').textContent };
      return out;
    });
    ok(!b7.owOn && b7.grid && !b7.hud && !b7.khEyes, 'Bunker 7 après Khamsin : moteur de grille, ni mini-carte ni yeux du désert', b7);
    ok(b7.hp === 100 && b7.alive > 0 && b7.types.every((id) => !/^kh_/.test(id)), 'Bunker 7 : zombies d’origine (100 PV à la manche 1)', b7);
    ok(b7.tips.planks && !b7.tips.veh && !b7.tips.storm && b7.tips.box === 'La boîte mystère donne une arme au hasard pour 950 points.' && /salle des machines/.test(b7.tips.power),
      'Bunker 7 : consignes d’origine', b7.tips);

    ok(errors.length === 0, 'aucune erreur dans la page du jeu', errors.slice(0, 6));
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  exception : ${e && e.stack ? e.stack : e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} échec(s)` : '\nKhamsin : tout est bon');
  process.exit(failures ? 1 : 0);
})();
