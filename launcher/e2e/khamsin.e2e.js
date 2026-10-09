'use strict';
/* Khamsin (jeu 2.0.0), deuxième carte du menu « Jouer », dans la fenêtre du jeu du launcher : catalogue
   (Bunker 7 puis Khamsin ; absente des Mod Tools), sélection et chargement par l'écran « Jouer », monde
   ouvert de 4 × 3 km (sept lieux, relief, mini-carte, boussole), consignes du menu, éléments (arme au
   mur, atout, boîte mystère, jerricans, disjoncteurs et courant), véhicules (achat, conduite, vue,
   pas de tir au volant, sortie), Desséchés (points de vie, allures, types selon le lieu, yeux), Rôdeur
   (prise, couteau), tempêtes, sanctuaire (porte, escalier, autel aux paliers du Glas), draisine,
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
      ok(GAME_VERSION === '2.0.0' && ZS.version === v, `jeu 2.0.0 dans le launcher (paquet ${v})`, { GAME_VERSION, v });
      ok(MAPS.list.length === 3 && MAPS.list[0] === 'bunker7' && MAPS.list[1] === 'khamsin' && MAPS.list[2] === 'ombre', 'catalogue : Bunker 7, puis Khamsin (deuxième carte), puis Ombre éternelle', MAPS.list);
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
      ok(OW.W === 4000 && OW.D === 3000, 'zone jouable : 4 × 3 km', [OW.W, OW.D]);
      const names = KH.locs.map((L) => L.name);
      ok(names.length === 7 && names.join('|') === 'Camp de fouilles|Plateau des pyramides|Relais Km 47|Oasis de Sekhet|Centrale du Nil|Nécropole des falaises|Aérodrome', 'sept lieux de la planche', names);
      let lo = 1e9, hi = -1e9;
      for (let x = 50; x < 4000; x += 100) for (let z = 50; z < 3000; z += 100) { const h = owH(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      ok(hi - lo > 30, `relief : ${Math.round(lo)} à ${Math.round(hi)} m (dunes, falaises, vallée du Nil)`, { lo, hi });
      const sp = KH.spawn.pos, dy = Math.abs(player.gy - owGroundAt(0, player.pos.x, player.pos.z));
      ok(Math.hypot(player.pos.x - sp[0], player.pos.z - sp[1]) < 2 && dy < 0.05, 'départ au camp de fouilles, les pieds sur le sol', { x: player.pos.x, z: player.pos.z, dy });
      ok(G.points === 500 && curSlot() && curSlot().id === 'm1911', 'départ : 500 points et M1911', { points: G.points, w: curSlot() && curSlot().id });
      __zs.step(30);
      ok(OWH.map && OWH.map.isConnected && !OWH.map.hidden && OWH.comp && OWH.comp.isConnected, 'HUD : mini-carte et boussole');
      ok(VEH.list.map((V) => V.type).join(',') === 'jeep,jeep,jeep,buggy,truck', 'véhicules : trois 4×4, le buggy, le camion blindé', VEH.list.map((V) => V.type));
      ok(Features.perkMachines.length === 5 && KHF.breakers.length === 3 && Features.box.locs.length === 7, 'cinq atouts, trois disjoncteurs, sept emplacements de la boîte', { perks: Features.perkMachines.length, breakers: KHF.breakers.length, box: Features.box.locs.length });
      return out;
    })).forEach(report);
    // une image du désert (shaders compilés sans erreur)
    const draw = await game.evaluate(() => {
      __play();
      __zs.tp(2290, 1860, 0.6); player.pitch = 0; __zs.step(4);
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
      __zs.tp(2310, 1961, 0); __zs.step(3);
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
      out.truck0 = Features.interactables.find((q) => q.veh && q.veh.type === 'truck').prompt();
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
      out.truck = Features.interactables.find((q) => q.veh && q.veh.type === 'truck').prompt().text;
      return out;
    });
    ok(f.mp40 && /MP40/i.test(f.wallPrompt || ''), 'arme au mur (craie) : MP40 achetée', f);
    ok(f.souffle && f.locked.length === 4 && !f.locked.includes('0'), 'atouts : Souffle sans courant ; les quatre autres attendent le courant', f);
    ok(f.boxPaid === 950 && (f.boxState === 'offer' || f.boxState === 'idle'), 'boîte mystère : 950 points, arme proposée', f);
    ok(/plein|jerrican/i.test(f.fuelPrompt) && f.fuel === f.fuelMax, 'jerricans : plein du 4×4 le plus proche', f);
    ok(f.truck0 && f.truck0.disabled && !f.power0 && !f.door0, 'sans courant : camion blindé arrêté, sanctuaire scellé', f);
    ok(f.steps === '001' && f.power && f.lit && f.door && /Conduire le camion/.test(f.truck), 'trois disjoncteurs (F maintenue) : courant, atouts allumés, porte du sanctuaire, camion', f);

    // ------------------------------------------------------- véhicules
    const v = await game.evaluate(() => {
      __play();
      const out = {};
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const Bg = VEH.list[3], ib = Features.interactables.find((q) => q.veh === Bg);
      __zs.tp(Bg.x + 3, Bg.z, 1.57); __zs.step(2);
      const pb = ib.prompt(); out.buggy = pb && { text: pb.text, cost: pb.cost };
      const pts0 = G.points; ib.use(); __zs.step(2); out.buggyPaid = pts0 - G.points; out.buggyBought = Bg.bought;
      if (VEH.drive) { Input.down.KeyF = true; __zs.step(2); }
      const V = VEH.list[2], it = Features.interactables.find((q) => q.veh === V);
      V.yaw = -Math.PI / 2; V.v = 0; V.fuel = V.T.fuel; vehPose(V, 0, true);
      __zs.tp(V.x + 3, V.z, 1.57); __zs.step(2);
      out.prompt = it.prompt() && it.prompt().text;
      it.use(); __zs.step(2);
      out.driving = !!VEH.drive && owDriving();
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
    ok(v.buggy && v.buggy.cost === 1500 && /Acheter le buggy/.test(v.buggy.text) && v.buggyPaid === 1500 && v.buggyBought, 'buggy des sables : acheté 1 500 points', v);
    ok(v.driving && /Conduire le 4×4/.test(v.prompt || ''), '4×4 : F pour conduire', v);
    ok(v.kmh > 20 && v.moved > 25 && v.burnt && v.hud, `conduite : ${v.kmh} km/h, ${v.moved} m en 4 s, carburant consommé, compteur affiché`, v);
    ok(v.fired === 0 && v.firedOnFoot > 0, 'au volant, on ne tire pas (à pied, si)', v);
    ok(v.view[0] !== v.view[1] && v.stopped, 'C : vue du conducteur ; Espace : frein à main', v);
    ok(v.out && v.dist < 6 && v.ground, 'F : on descend à côté du véhicule, sur le sol', v);

    // ------------------------------------------------------- Desséchés
    const z = await game.evaluate(() => {
      __play();
      const out = {};
      out.hp = [1, 2, 10, 11].map((n) => khHp(n));
      const mix = (r) => { const c = { walk: 0, jog: 0, run: 0 }; for (let i = 0; i < 600; i++) c[rollSpeedType(r)]++; return c; };
      out.r5 = mix(5); out.r6 = mix(6);
      const ty = (zi) => { const c = {}; for (let i = 0; i < 600; i++) { const t = zoneZombieType(zi).id; c[t] = (c[t] || 0) + 1; } return c; };
      out.camp = ty(0); out.oasis = ty(3);
      __zs.tp(2350, 1992, 2.45); __zs.step(5);
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

    // ------------------------------------------------------- tempêtes ; Rôdeur : prise, couteau
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
      // couteau (V), face au Rôdeur
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
    ok(r.freed && r.state === 'stun' && r.dead, 'couteau (V) : le Rôdeur lâche prise, étourdi ; il meurt sous les balles', r);

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

    // ------------------------------------------------------- draisine (nécropole → sanctuaire)
    const t = await game.evaluate(() => {
      __play();
      const out = {};
      const st = (sec) => { for (let i = 0; i < sec * 30; i++) __zs.step(1, 1 / 30); };
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const E = KHT.endF;
      __zs.tp(E.x, E.z + 1.2, 0); st(0.2);
      const it = Features.interactables.find((i) => i.kind === 'portal' && Math.hypot(i.x - E.x, i.z - (E.z + 0.4)) < 0.1);
      out.prompt = it.prompt() && it.prompt().text;
      it.use(); st(3);
      out.riding = !!KHT.ride; out.view = KHSAN.view;
      st(8);
      out.arrived = { riding: !!KHT.ride, layer: player.layer, view: KHSAN.view, d: +Math.hypot(player.pos.x - KHT.endB.x, player.pos.z - KHT.endB.z).toFixed(1) };
      const F = KHSAN.stairFoot; __zs.tp(F.x, F.z - 0.5, Math.PI, -1); __zs.step(3);
      Features.interactables.find((i) => i.kind === 'portal' && i.y < 0).use(); __zs.step(60 * 1.2);
      return out;
    });
    ok(t.riding && t.view === 'tunnel' && !t.arrived.riding && t.arrived.layer === 1 && t.arrived.view === 'under' && t.arrived.d < 2, 'draisine : la galerie mène de la nécropole au sanctuaire', t);

    // ------------------------------------------------------- sauvegarde de la partie (rechargement à chaud)
    const sv = await game.evaluate(() => {
      __play();
      KHQ.have.fuel = true; KHQ.placed.battery = true; KHQ.frags[1] = true; KHQ.charge = 0.5;
      const V = VEH.list[1]; V.x += 30; V.z += 10; V.fuel = 7;
      const want = [Math.round(V.x), Math.round(V.z)];
      const save = JSON.parse(JSON.stringify(serializeGame()));
      quitToMenu();
      const cleared = !KHQ.have.fuel;
      startGame(save);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true); G.roundState = 'pre'; G.roundT = 1e9; __zs.step(5);
      const W = VEH.list[1];
      return { cleared, map: save.map, have: KHQ.have.fuel, placed: KHQ.placed.battery, frag: KHQ.frags[1], charge: KHQ.charge, veh: [Math.round(W.x), Math.round(W.z), W.fuel], want, power: G.power, door: OW.doors[KHSAN.door.i].open };
    });
    ok(sv.map === 'khamsin' && sv.cleared && sv.have && sv.placed && sv.frag && sv.charge === 0.5 && sv.veh[0] === sv.want[0] && sv.veh[1] === sv.want[1] && sv.veh[2] === 7 && sv.power && sv.door,
      'sauvegarde : pièces, fragment, charge, véhicules, courant et porte retrouvés', sv);

    // ------------------------------------------------------- quête : trois pièces, avion, Gardien, évasion
    const q1 = await game.evaluate(() => {
      __play();
      const out = {}, st = (sec) => { for (let i = 0; i < sec * 30; i++) __zs.step(1, 1 / 30); };
      const hold = (it, sec) => { Input.keys.KeyF = true; for (let i = 0; i < sec * 30; i++) { it.useHold(1 / 30); __zs.step(1, 1 / 30); } Input.keys.KeyF = false; };
      khQuestReset(); G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const Q = Features.interactables.filter((i) => i.kind === 'quest');
      const near = (x, zz) => Q.reduce((b, i) => (Math.hypot(i.x - x, i.z - zz) < Math.hypot(b.x - x, b.z - zz) ? i : b));
      const T = KH.places.C.fuelTank;
      __zs.tp(T.x, T.z - 1.6, 0); st(0.2);
      const iFuel = near(T.x, T.z - 1.3);
      out.fuelPrompt = iFuel.prompt().text;
      hold(iFuel, 4.3);
      out.fuel = KHQ.have.fuel;
      const B = KH.places.E.battery, iBat = near(B.x, B.z - 0.9);
      st(46);
      __zs.tp(B.x, B.z - 1.2, 0); st(0.2);
      out.batPrompt = iBat.prompt().text;
      iBat.use(); out.battery = KHQ.have.battery;
      __zs.tp(KH.oasis.x + 110, KH.oasis.z, 1.57); st(1);
      out.pilot = !!KHQ.pilot && KHQ.pilot.model === 'kh_pilote';
      if (KHQ.pilot) { damageZombie(KHQ.pilot, 1e7, { kind: 'bullet', dx: 1, dz: 0 }); st(0.3); }
      out.keyDropped = !!KHQ.key;
      if (KHQ.key) { const k = KHQ.key.g.position; __zs.tp(k.x, k.z + 1, 0); st(0.1); KHQ.key.it.use(); }
      out.key = KHQ.have.key;
      const A = KH.places.G.plane;
      for (const [x, zz] of [[A.x + 2, A.z + 2.9], [A.x - 10.5, A.z], [A.x - 5.4, A.z - 2.4]]) { __zs.tp(x, zz + (zz > A.z ? 0.8 : -0.8), 0); st(0.1); hold(near(x, zz), 1.7); }
      out.ready = KHQ.ready;
      out.objectives = khObjectives().map((l) => l[1]).join(' | ');
      return out;
    });
    ok(q1.fuel && q1.battery && q1.pilot && q1.keyDropped && q1.key, 'quête : carburant (relais), batterie chargée (centrale), clé sur le pilote (oasis)', q1);
    ok(q1.ready, 'quête : les trois pièces posées, l’avion est prêt', q1);
    const q2 = await game.evaluate(() => {
      __play();
      const out = {}, st = (sec) => { for (let i = 0; i < sec * 30; i++) __zs.step(1, 1 / 30); };
      // fragments du Sceptre : les tombes brillent pendant les tempêtes
      khStormStart(); st(1);
      const Q = Features.interactables.filter((i) => i.kind === 'quest');
      for (const ti of [0, 2, 4]) {
        const T = KH.places.F.tombs[ti], cx = (T.x0 + T.x1) / 2;
        __zs.tp(cx, T.z0 + 3.6, 0); st(0.2);
        const it = Q.reduce((b, i) => (Math.hypot(i.x - cx, i.z - (T.z0 + 3.3)) < Math.hypot(b.x - cx, b.z - (T.z0 + 3.3)) ? i : b));
        it.use();
      }
      out.sceptre = KHQ.sceptre;
      khStormReset(); KHG.lastCross = KHS.n;
      // le Gardien, au sanctuaire
      const K = KHSAN.kiosk;
      __zs.tp(K.x, K.z + 0.5, 0); st(0.2);
      Features.interactables.find((i) => i.kind === 'portal' && i.y > 0 && Math.hypot(i.x - K.x, i.z - K.z) < 3).use(); st(1.2);
      const A = KHSAN.altar;
      __zs.tp(A.x, A.z - 2.6, Math.PI, -1); st(0.2);
      const wake = Features.interactables.find((i) => i.kind === 'quest' && Math.hypot(i.x - A.x, i.z - (A.z - 1.9)) < 0.1);
      out.wakePrompt = wake.prompt().text;
      Input.keys.KeyF = true; for (let i = 0; i < 3.2 * 30; i++) { wake.useHold(1 / 30); __zs.step(1, 1 / 30); } Input.keys.KeyF = false;
      const e = KHG.e;
      out.spawned = !!e && e.boss;
      st(5);
      out.bar = !!document.querySelector('.kh-boss') && !document.querySelector('.kh-boss').hidden;
      const hp0 = e.hp; damageZombie(e, 1000, { kind: 'bullet', dx: 0, dz: -1 }); out.chip = Math.round(hp0 - e.hp);
      __zs.tp(A.x, 1229, Math.PI, -1); e.slamT = 0; let seen = 0;
      for (let i = 0; i < 30 * 8 && !seen; i++) { __zs.step(1, 1 / 30); if (e.window > 0) seen = 1; }
      out.window = !!seen;
      const hp1 = e.hp; damageZombie(e, 1000, { kind: 'bullet', dx: 0, dz: -1 }); out.full = Math.round(hp1 - e.hp);
      for (let i = 0; i < 80 && e.alive; i++) {
        e.window = 3; if (e.gstate === 'roar' || e.gstate === 'rise' || e.gstate === 'whirl') { st(0.5); continue; }
        damageZombie(e, e.maxHp * 0.06, { kind: 'bullet', dx: 0, dz: -1 }); st(0.2);
      }
      out.dead = !e.alive && KHG.dead; out.calm = Math.round(KHS.calmT);
      st(4);
      return out;
    });
    ok(q2.sceptre, 'Sceptre : trois fragments ramassés dans les tombes pendant la tempête', q2);
    ok(q2.spawned && q2.bar && q2.window && q2.full > q2.chip * 1.5, 'Gardien : réveillé à l’autel (barre de vie) ; touché à pleine force seulement pendant ses fenêtres de tir', q2);
    ok(q2.dead && q2.calm > 200, `Gardien abattu : la tempête se calme (${q2.calm} s)`, q2);
    const q3 = await game.evaluate(() => {
      __play();
      const out = {}, st = (sec) => { for (let i = 0; i < sec * 30; i++) __zs.step(1, 1 / 30); };
      const F = KHSAN.stairFoot; __zs.tp(F.x, F.z - 0.5, Math.PI, -1); st(0.1);
      Features.interactables.find((i) => i.kind === 'portal' && i.y < 0 && Math.hypot(i.x - F.x, i.z - F.z) < 3).use(); st(1.2);
      const A = KH.places.G.plane;
      __zs.tp(A.x - 5.4, A.z - 3.2, 0); st(0.2);
      const it = Features.interactables.find((i) => i.kind === 'quest' && Math.hypot(i.x - (A.x - 5.4), i.z - (A.z - 2.4)) < 0.1);
      out.escPrompt = it.prompt().text;
      Input.keys.KeyF = true; for (let i = 0; i < 1.2 * 30; i++) { it.useHold(1 / 30); __zs.step(1, 1 / 30); } Input.keys.KeyF = false;
      out.escape = !!KHQ.escape;
      st(61);
      out.endPrompt = it.prompt().text;
      Input.keys.KeyF = true; for (let i = 0; i < 1 * 30; i++) { it.useHold(1 / 30); __zs.step(1, 1 / 30); } Input.keys.KeyF = false;
      out.won = KHQ.won;
      st(10);
      out.state = G.state;
      out.title = document.getElementById('go-title').textContent;
      out.rounds = document.getElementById('go-rounds').textContent;
      return out;
    });
    ok(q3.escape && q3.won, 'évasion : 60 s de démarrage, puis décollage', q3);
    ok(q3.state === 'gameover' && q3.title === 'Évasion réussie' && /quitté le Khamsin/.test(q3.rounds), 'victoire : « Évasion réussie »', q3);
    await game.waitForFunction(() => !document.getElementById('gameover').hidden, null, { timeout: 30000 });
    await game.click('#btn-go-menu');
    await game.waitForFunction(() => ZS.G.state === 'menu' && !document.getElementById('menu').hidden);

    // ------------------------------------------------------- menu de Khamsin : consignes
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const txt = (id) => document.getElementById(id).textContent;
      ok(/Khamsin/.test(txt('menu-eyebrow')) && /trois pièces de l’avion/.test(txt('menu-lead')), 'menu : rapport d’incident et consigne de Khamsin', [txt('menu-eyebrow'), txt('menu-lead')]);
      ok(!vis('tip-planks') && vis('tip-box') && /voyage de lieu en lieu/.test(txt('tip-box')) && vis('tip-power') && /centrale du Nil/.test(txt('tip-power')) && vis('tip-veh') && vis('tip-storm'),
        'consignes de Khamsin : pas de planches ; boîte qui voyage, centrale du Nil, véhicules, tempêtes', ['tip-planks', 'tip-box', 'tip-power', 'tip-veh', 'tip-storm'].map((id) => (vis(id) ? '' : '[caché] ') + txt(id).slice(0, 40)));
      return out;
    })).forEach(report);

    // ------------------------------------------------------- écran « Modèles » : Desséchés, pilote, Rôdeur, Gardien
    await game.click('#btn-models');
    await game.waitForFunction(() => !document.getElementById('models').hidden);
    const md = await game.evaluate(() => {
      const out = {};
      for (const id of ['kh_arch', 'kh_ouvrier', 'kh_villageois', 'kh_pilote', 'kh_rodeur', 'kh_gardien']) {
        const listed = !!document.querySelector(`#md-tabs [data-id="${id}"]`);
        selectSpecimen(id);
        for (let i = 0; i < 12; i++) renderModels(1 / 30);
        const p = __zs.modelProbe();
        out[id] = { listed, name: document.getElementById('md-plate-name').textContent, drawn: p ? +p.changed.toFixed(3) : null };
      }
      return out;
    });
    const mdOk = Object.values(md).every((m) => m.listed && m.name && m.drawn > 0.005);
    ok(mdOk, 'Modèles : fiches et modèles 3D des trois Desséchés, du pilote, du Rôdeur et du Gardien', md);
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
