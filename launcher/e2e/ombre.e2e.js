'use strict';
/* Ombre éternelle (jeu 2.0.0, la Lune), troisième carte du menu « Jouer », dans la fenêtre du jeu du
   launcher : catalogue (absente des Mod Tools de grille), sélection et chargement par l'écran
   « Jouer », monde de 1,4 × 1,4 km (lieux de la planche, fosse), départ dans la base, rendu, dépôt
   d'oxygène qui saute à la manche 1, pesanteur 1/6 g (saut, chute du pont), oxygène (4 min dehors,
   recharge dans la base, poste à 250 points, suffocation), son (dehors, rien du monde), éléments
   (armes, atouts, boîte, deux disjoncteurs et courant), zombies lunaires (bonds, échelle de la tour),
   Le Glas, quête de l'atterrisseur (centrale inertielle, vanne, cuve de LOX, réparation, décollage,
   victoire), consignes du menu, écran « Modèles » ; retour au Bunker 7 (pesanteur, son, consignes).
     xvfb-run -a node e2e/ombre.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-ombre-'));
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
    if (process.platform === 'linux') game.setDefaultTimeout(300000);   // rendu logiciel : la première image est lente
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 180000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    game.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

    // ------------------------------------------------------- catalogue des cartes, Mod Tools
    (await game.evaluate((v) => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(GAME_VERSION === '2.0.0' && ZS.version === v, `jeu 2.0.0 dans le launcher (paquet ${v})`, { GAME_VERSION, v });
      ok(MAPS.list.join() === 'bunker7,khamsin,ombre', 'catalogue : Bunker 7, Khamsin, puis Ombre éternelle (troisième carte)', MAPS.list);
      const M = MAPS.byId.ombre;
      ok(M && M.open && M.base === 'ombre' && M.name === 'Ombre éternelle' && /^data:image\/jpeg/.test(M.thumb || ''), 'Ombre éternelle : carte ouverte (base ombre), vignette du plan en relief', M && { open: M.open, base: M.base, name: M.name, thumb: (M.thumb || '').slice(0, 22) });
      ok(!ZS.MAPS.list.includes('ombre') && !ZS.MAPS.byId.ombre && ZS.MAPS_ALL.byId.ombre === M, 'Mod Tools : absente du catalogue des cartes de grille, présente dans le catalogue complet', ZS.MAPS.list);
      ok(!ZS.ZOMBIE_TYPES.some((t) => /^lu_/.test(t.id)), 'Mod Tools : les zombies lunaires ne sont pas des types de pièce', ZS.ZOMBIE_TYPES.map((t) => t.id));
      ok(ZS.editorApi === 4 && ZS.ow.ALL_BUILDINGS.lu_module && ZS.ow.worldOf('ombre') === 'lune' && ZS.ow.worldOf('lune') === 'lune' && ZS.ow.worldOf('khamsin') === 'khamsin', 'interface des Mod Tools 4 : bâtiments lunaires, mondes des bases', ZS.editorApi);
      return out;
    }, GAME)).forEach(report);

    // ------------------------------------------------------- « Jouer » : Ombre éternelle, troisième carte
    await game.click('#btn-play');
    await game.waitForFunction(() => !document.getElementById('mapsel').hidden);
    const cards = await game.evaluate(() => [...document.querySelectorAll('#ms-grid .ms-card')].map((c) => ({
      id: c.dataset.id, name: c.querySelector('.ms-name').textContent, img: !!c.querySelector('.ms-photo img'), desc: (c.querySelector('.ms-desc') || { textContent: '' }).textContent.slice(0, 60),
    })));
    ok(cards.length === 3 && cards[2].id === 'ombre' && cards[2].name === 'Ombre éternelle' && cards[2].img && /Lune/.test(cards[2].desc),
      'Jouer : Ombre éternelle, troisième carte sélectionnable (nom, vignette, description)', cards);
    await game.click('#ms-grid .ms-card[data-id="ombre"]');
    ok(await game.evaluate(() => MapSel.sel === 'ombre' && document.querySelector('#ms-grid .ms-card[data-id="ombre"]').getAttribute('aria-selected') === 'true'), 'Jouer : Ombre éternelle choisie');
    const t0 = Date.now();
    await game.click('#btn-ms-play');
    await game.waitForFunction(() => ZS.G.state === 'playing' && ZS.G.mapId === 'ombre', null, { timeout: 300000 });
    console.log(`       (chargement de la Lune et première image : ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

    // ------------------------------------------------------- monde, départ, éléments
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      renderEnabled = false;
      // la souris libérée (fenêtre de test) met le jeu en pause entre deux évaluations : on reprend
      window.__play = () => { if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } __zs.god(true); };
      __play();
      const P = player;
      ok(OW.on && OW.worldId === 'lune' && OW.baseId === 'ombre' && CUR.map === MAPS.byId.ombre, 'Ombre éternelle chargée par le moteur du monde ouvert (monde de la Lune)', { w: OW.worldId, b: OW.baseId });
      ok(OW.W === 1400 && OW.D === 1400, 'zone jouable : 1,4 × 1,4 km', [OW.W, OW.D]);
      const names = LU.locs.map((L) => L.name);
      ok(names.length >= 8 && ['Base Séléné', 'La Fosse', 'Pont suspendu', 'Tour relais', 'Crête solaire', 'Plateau d’extraction', 'Dépôt d’oxygène'].every((n) => names.includes(n)), 'lieux de la planche', names);
      ok(Math.abs(owH(LU.pit.x, LU.pit.z) - owH(LU.pit.x + 260, LU.pit.z)) > 60, 'la fosse : plus de 60 m sous le régolithe', { fond: owH(LU.pit.x, LU.pit.z), bord: owH(LU.pit.x + 260, LU.pit.z) });
      ok(GRAV.moon && GRAV.feel === 1.62 && GRAV.jump === 3.13 && Math.abs(GRAV.k - 1.62 / 9.81) < 1e-6, 'pesanteur 1/6 g : 1,62 m/s², impulsion de saut de la Terre', { ...GRAV });
      const sp = MAPS.byId.ombre.spawn.pos;
      ok(Math.hypot(P.pos.x - sp[0], P.pos.z - sp[1]) < 2 && LU.inside, 'départ dans la base Séléné (air respirable)', { x: P.pos.x, z: P.pos.z, inside: LU.inside });
      ok(G.points === 500 && curSlot() && curSlot().id === 'm1911', 'départ : 500 points et M1911', { points: G.points, w: curSlot() && curSlot().id });
      ok(LUO.el && !LUO.el.hidden && LUO.o2 === 240 && /4:00/.test(LUO.txt.textContent), 'HUD : jauge d’oxygène pleine (4:00)', LUO.el && LUO.txt.textContent);
      ok(OWH.map && OWH.map.isConnected && !OWH.map.hidden && OWH.comp && OWH.comp.isConnected, 'HUD : mini-carte et boussole');
      ok(VEH.list.length === 0 && KHS.every === 0, 'ni véhicules ni tempêtes sur la Lune', { veh: VEH.list.length, storms: KHS.every });
      const I = Features.interactables, n = (k) => I.filter((q) => q.kind === k).length;
      ok(n('wallbuy') === 12 && Features.perkMachines.length === 5 && Features.box.locs.length === 7 && n('breaker') === 2 && n('oxy') === 6 && Features.amp && Features.amp.lune,
        'éléments : 12 armes au mur, 5 atouts, 7 emplacements de la boîte, 2 disjoncteurs, 6 postes d’oxygène, Le Glas', { wb: n('wallbuy'), perks: Features.perkMachines.length, box: Features.box.locs.length, br: n('breaker'), oxy: n('oxy') });
      return out;
    })).forEach(report);
    // une image de la Lune (shaders compilés sans erreur), du moyeu vers la baie
    const draw = await game.evaluate(() => {
      __play();
      __zs.step(2);
      owUpdateTerrainLod(true);
      renderer.info.autoReset = false; renderer.info.reset();
      renderEnabled = true; render(); renderEnabled = false;
      const r = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      renderer.info.autoReset = true;
      r.glError = renderer.getContext().getError();
      return r;
    });
    ok(draw.calls > 30 && draw.tris > 50000 && draw.glError === 0, `rendu dans la base : ${draw.calls} appels de dessin, ${Math.round(draw.tris / 1000)} k triangles`, draw);

    // ------------------------------------------------------- manche 1 : le dépôt saute sous les yeux du joueur
    const boom = await game.evaluate(() => {
      __play();
      const out = { done0: LUA.done };
      let at = -1;
      const t0 = G.time;
      for (let i = 0; i < 10 * 60; i++) { __zs.step(1, 1 / 60); if (LUA.done && at < 0) at = G.time - t0; }
      out.at = +at.toFixed(1); out.done = LUA.done; out.round = G.round; out.debris = LUA.items.length;
      out.lox = !!(LUQ.items.lox && LUQ.items.lox.visible);
      return out;
    });
    ok(!boom.done0 && boom.done && boom.at > 2 && boom.at < 9 && boom.round === 1 && boom.debris > 0 && boom.lox, `dépôt d’oxygène : explosion à ${boom.at} s de la manche 1, débris, cuve de LOX en orbite`, boom);

    // ------------------------------------------------------- 1/6 g : saut, son, oxygène
    const life = await game.evaluate(() => {
      __play();
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const P = player, out = {};
      // saut sur le régolithe, au nord de la base
      __zs.tp(893, 800); __zs.step(30);
      const g0 = P.gy;
      Input.down.Space = true; __zs.step(1); Input.down.Space = false;
      let top = 0, air = 0;
      for (let i = 0; i < 8 * 60; i++) { __zs.step(1, 1 / 60); if (!P.grounded) { air += 1 / 60; top = Math.max(top, P.gy + P.y - g0); } else if (air > 0.2) break; }
      out.jump = { h: +top.toFixed(2), t: +air.toFixed(2) };
      // dehors : aucun son du monde, la combinaison étouffe le reste ; l'oxygène baisse
      out.outside = { inside: LU.inside, hears: luHears({ x: P.pos.x + 3, z: P.pos.z }), muffled: LUO.muffled };
      LUO.o2 = 240; __zs.step(10 * 60, 1 / 60);
      out.o2out = +LUO.o2.toFixed(1);
      // dans la base : on entend la base, l'air recharge (30 s d'oxygène par seconde)
      LUO.o2 = 100; __zs.tp(893, 861); __zs.step(3 * 60, 1 / 60);
      out.inside = { inside: LU.inside, hears: luHears({ x: P.pos.x + 2, z: P.pos.z }), muffled: LUO.muffled, o2: +LUO.o2.toFixed(1), cls: LUO.el.className };
      // poste d'oxygène : une bouteille neuve pour 250 points
      const oxy = Features.interactables.filter((q) => q.kind === 'oxy').sort((a, b) => Math.hypot(a.x - 893, a.z - 800) - Math.hypot(b.x - 893, b.z - 800))[0];
      __zs.tp(oxy.x, oxy.z); __zs.step(2, 1 / 60);
      LUO.o2 = 30; G.points = 1000;
      out.oxyPrompt = oxy.prompt() && oxy.prompt().text; oxy.use();
      out.oxy = { o2: +LUO.o2.toFixed(1), paid: 1000 - G.points };
      // sans oxygène : la vie s'en va (sans le mode dieu)
      __zs.tp(893, 800); __zs.step(2, 1 / 60);
      G.god = false; P.hp = P.maxHp; LUO.o2 = 2;
      __zs.step(6 * 60, 1 / 60);
      out.choke = { o2: LUO.o2, hp: +P.hp.toFixed(1), max: P.maxHp, crit: LUO.el.classList.contains('crit') };
      P.hp = P.maxHp; LUO.o2 = LUO.max; __zs.god(true);
      // chute du pont (56 m) : mortelle (Souffle donné pour l'essai : à terre au lieu de la fin de partie)
      G.god = false; P.perks.add('souffle'); P.souffleUses = 0;
      __zs.tp(680, 975.5); P.gy = -24; P.y = 0; P.grounded = true; settleBody(P, 0.3); P.pos.y = P.gy;
      out.bridge = { gy: +P.gy.toFixed(2), layer: P.layer };
      P.pos.z = 978.6; P.grounded = true; settleBody(P, 0.3);
      let fall = 0; for (let i = 0; i < 14 * 60; i++) { __zs.step(1, 1 / 60); fall += 1 / 60; if (P.grounded && fall > 0.3) break; }
      out.fall = { t: +fall.toFixed(2), gy: +P.gy.toFixed(1), down: !!P.down, state: G.state };
      __zs.step(5 * 60, 1 / 60);                                       // relevé (Souffle)
      out.revived = !P.down && G.state === 'playing';
      __zs.god(true);
      return out;
    });
    ok(life.jump.h > 2.7 && life.jump.h < 3.3 && life.jump.t > 3.5 && life.jump.t < 4.3, `saut à 1/6 g : ${life.jump.h} m de haut, ${life.jump.t} s en l’air`, life.jump);
    ok(!life.outside.inside && !life.outside.hears && life.outside.muffled && life.o2out > 228 && life.o2out < 232, 'dehors : aucun son du monde, combinaison étouffée, 10 s d’oxygène consommées', { ...life.outside, o2: life.o2out });
    ok(life.inside.inside && life.inside.hears && life.inside.muffled === false && life.inside.o2 > 170 && / in/.test(` ${life.inside.cls}`), 'dans la base : sons de la base, l’air recharge la bouteille', life.inside);
    ok(/bouteille/i.test(life.oxyPrompt || '') && life.oxy.o2 === 240 && life.oxy.paid === 250, 'poste d’oxygène : bouteille neuve (4 min) pour 250 points', { prompt: life.oxyPrompt, ...life.oxy });
    ok(life.choke.o2 === 0 && life.choke.hp < life.choke.max * 0.8 && life.choke.crit, 'sans oxygène : la vie baisse, jauge en alerte', life.choke);
    ok(life.bridge.layer === 1 && life.fall.down && life.fall.gy < -70 && life.fall.t > 6 && life.fall.state === 'playing' && life.revived, `chute du pont jusqu’au fond (${life.fall.t} s) : mortelle (à terre avec Souffle, puis relevé)`, life);

    // ------------------------------------------------------- courant, atouts, boîte, arme au mur
    const f = await game.evaluate(() => {
      __play();
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const out = {};
      const near = (kind, pred) => Features.interactables.filter((q) => q.kind === kind && (!pred || pred(q))).sort((a, b) => Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(b.x - player.pos.x, b.z - player.pos.z))[0];
      __zs.points(50000);
      __zs.tp(878, 860.5, 0); __zs.step(3);
      let it = near('wallbuy');
      out.wallPrompt = it.prompt() && it.prompt().text; it.use(); __zs.step(60);
      out.bought = Arms.slots.filter(Boolean).map((s) => s.id);
      out.power0 = G.power;
      out.locked = Features.perkMachines.filter((m) => PERKS[m.id].power).map((m) => near('perk', (q) => q.machine === m)).map((q) => { const p = q.prompt(); return p && p.disabled ? 1 : 0; }).join('');
      const bx = Features.box;
      __zs.tp(bx.inter.x, bx.inter.z, 0); __zs.step(3);
      const pts0 = G.points;
      out.boxPrompt = bx.inter.prompt() && bx.inter.prompt().text; bx.inter.use(); __zs.step(60 * 4.6);
      out.boxPaid = pts0 - G.points; out.boxState = bx.state;
      if (bx.state === 'offer') { bx.inter.use(); __zs.step(30); }
      const brs = Features.interactables.filter((q) => q.kind === 'breaker');
      __zs.tp(brs[0].x + 0.4, brs[0].z, 0); __zs.step(3);
      out.breakerPrompt = brs[0].prompt() && brs[0].prompt().text;
      const done = [];
      for (const q of brs) { for (let i = 0; i < 300; i++) q.useHold(1 / 60); done.push(G.power ? 1 : 0); }
      out.steps = done.join('');
      __zs.step(60 * 4);
      out.power = G.power;
      out.lit = Features.perkMachines.every((m) => m.lit);
      return out;
    });
    ok(f.bought.length === 2 && /\d/.test(f.wallPrompt || ''), 'arme au mur de la base achetée', f);
    ok(!f.power0 && f.locked.length >= 3 && !f.locked.includes('0'), 'sans courant : les atouts électriques attendent', f);
    ok(f.boxPaid === 950 && (f.boxState === 'offer' || f.boxState === 'idle'), 'boîte mystère (caisse de ravitaillement) : 950 points, arme proposée', f);
    ok(f.steps === '01' && f.power && f.lit, 'deux disjoncteurs à la crête solaire (F maintenue) : courant, atouts allumés', f);

    // ------------------------------------------------------- zombies lunaires : bonds, attaque, échelle de la tour
    const z = await game.evaluate(() => {
      __play();
      const P = player, out = {};
      clearZombies();
      __zs.tp(893, 800);
      G.round = 4; G.roundState = 'active'; G.total = 999; G.spawned = 0; G.spawnDelay = 1.2; G.zombieHp = 150;
      const hop = new Set(), att = new Set(), types = new Set();
      for (let i = 0; i < 35 * 60; i++) {
        __zs.step(1, 1 / 60);
        for (const q of Zombies.list) if (q.alive) { types.add(q.type.id); if (q.luAir) hop.add(q.id); if (q.state === 'attack') att.add(q.id); }
      }
      out.plain = { spawned: G.spawned, hop: hop.size, attackers: att.size, types: [...types] };
      // sur la tour (ascenseur) : ils montent à l'échelle
      clearZombies();
      const T = LUPL.tower;
      __zs.tp(T.x, T.z + 6.2); __zs.step(2);
      Features.interactables.find((q) => q.kind === 'lift' && q.y === T.y0).use();
      __zs.step(13 * 60, 1 / 60);
      out.top = luOnTower();
      G.round = 5; G.roundState = 'active'; G.total = 999; G.spawned = 0; G.spawnDelay = 1; G.zombieHp = 150;
      const up = new Set(), climb = new Set();
      for (let i = 0; i < 60 * 60; i++) {
        __zs.step(1, 1 / 60);
        for (const q of Zombies.list) { if (!q.alive) continue; if (q.luClimb) climb.add(q.id); if (!q.luClimb && q.gy > T.top - 1) up.add(q.id); }
      }
      out.tower = { climbed: climb.size, reachedTop: up.size };
      clearZombies(); G.roundState = 'pre'; G.roundT = 1e9;
      Features.interactables.find((q) => q.kind === 'lift' && q.y === T.top).use();
      __zs.step(13 * 60, 1 / 60);
      out.down = !luOnTower();
      return out;
    });
    ok(z.plain.spawned > 5 && z.plain.hop > 3 && z.plain.attackers > 0 && z.plain.types.length && z.plain.types.every((id) => /^lu_/.test(id)), 'zombies lunaires : ils arrivent par bonds et attaquent (Astronaute, Mineur)', z.plain);
    ok(z.top && z.tower.climbed > 0 && z.tower.reachedTop > 0 && z.down, 'tour relais : ascenseur ; les zombies montent à l’échelle', z.tower);

    // ------------------------------------------------------- Le Glas, au fond de la fosse
    const glas = await game.evaluate(() => {
      __play();
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const amp = Features.amp, it = Features.interactables.find((q) => q.kind === 'amp'), out = {};
      __zs.tp(it.x, it.z); __zs.step(30, 1 / 60);
      for (let i = 0; i < 10 * 60 && amp.state !== 'rest'; i++) __zs.step(1, 1 / 60);
      G.points = 50000;
      const s0 = curSlot(); out.w = s0 && [s0.id, s0.tier || 0];
      const press = () => { Input.keys.KeyF = true; Input.down.KeyF = true; __zs.step(1, 1 / 60); Input.keys.KeyF = false; __zs.step(1, 1 / 60); };
      out.prompt = it.prompt() && it.prompt().text;
      press(); __zs.step(30, 1 / 60);
      for (let i = 0; i < 20 * 60; i++) { __zs.step(1, 1 / 60); if (amp.state === 'ready' || amp.state === 'done') break; }
      out.state = amp.state;
      press(); __zs.step(30, 1 / 60);
      const s1 = curSlot(); out.after = s1 && [s1.id, s1.tier || 0];
      out.paid = 50000 - G.points;
      return out;
    });
    ok(glas.paid === 5000 && glas.after && glas.after[1] > (glas.w ? glas.w[1] : 0), 'Le Glas : 5 000 points, l’arme reforgée au premier palier', glas);

    // ------------------------------------------------------- quête : centrale, vanne, LOX, atterrisseur, décollage
    const q = await game.evaluate(() => {
      __play();
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      const P = player, out = {}, I = Features.interactables, T = LUPL.tower;
      // centrale inertielle (haut de la tour)
      __zs.tp(T.x, T.z + 6.2); __zs.step(2);
      I.find((it) => it.kind === 'lift' && it.y === T.y0).use(); __zs.step(13 * 60, 1 / 60);
      const nav = LUQ.items.nav;
      __zs.tp(nav.position.x - 1, nav.position.z); P.gy = T.top; settleBody(P, 0.3);
      I.find((it) => it.kind === 'quest' && Math.abs(it.x - nav.position.x) < 0.1).use();
      out.nav = LUQ.have.nav;
      I.find((it) => it.kind === 'lift' && it.y === T.top).use(); __zs.step(13 * 60, 1 / 60);
      // vanne
      const v = LUQ.items.valve;
      __zs.tp(v.position.x, v.position.z + 1.2); __zs.step(2);
      I.find((it) => it.kind === 'quest' && Math.abs(it.x - v.position.x) < 0.1).use();
      out.valve = LUQ.have.valve;
      // cuve de LOX en orbite : trois tirs depuis le pont, elle retombe
      const X = LUQ.lox;
      __zs.tp(700, 975.5); P.gy = -24; settleBody(P, 0.3); P.pos.y = P.gy;
      for (let k = 0; k < 3; k++) {
        const o = { x: P.pos.x, y: P.gy + 1.6, z: P.pos.z }, p = X.g.position;
        const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, L = Math.hypot(dx, dy, dz);
        luLoxRay(o.x, o.y, o.z, dx / L, dy / L, dz / L, 500);
        __zs.step(10, 1 / 60);
      }
      out.free = X.free;
      let t = 0; while (!X.landed && t < 60) { __zs.step(30, 1 / 60); t += 0.5; }
      out.landed = X.landed;
      __zs.tp(X.g.position.x + 1, X.g.position.z); __zs.step(2);
      const qL = I.find((it) => it.kind === 'quest' && Object.getOwnPropertyDescriptor(it, 'x').get);
      qL.use(); out.lox = LUQ.have.lox;
      // atterrisseur : trois pièces posées (F maintenue), le compte à rebours, le décollage
      const L = LUPL.lander, qA = I.find((it) => it.kind === 'quest' && it.hold && Math.abs(it.x - L.x) < 0.1);
      __zs.tp(qA.x, qA.z); __zs.step(2);
      out.prompt0 = qA.prompt() && qA.prompt().text;
      for (let i = 0; i < 3; i++) for (let k = 0; k < 100; k++) qA.useHold(1 / 60);
      out.placed = Object.values(LUQ.placed).filter(Boolean).length;
      for (let k = 0; k < 70; k++) qA.useHold(1 / 60);
      out.seq = !!LUQ.seq;
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      __zs.step(46 * 60, 1 / 60);
      out.prompt2 = qA.prompt() && qA.prompt().text;
      for (let k = 0; k < 40; k++) qA.useHold(1 / 60);
      out.won = LUQ.won;
      for (let k = 0; k < 9 * 60; k++) { if (G.state === 'playing') update(1 / 60); endFrameInput(); }
      out.state = G.state; out.title = $('go-title').textContent; out.rounds = $('go-rounds').textContent;
      return out;
    });
    ok(q.nav && q.valve, 'quête : centrale inertielle (haut de la tour), vanne', q);
    ok(q.free && q.landed && q.lox, 'quête : la cuve de LOX abattue en orbite (trois tirs), retombée, ramassée', q);
    ok(q.placed === 3 && q.seq && q.won, 'atterrisseur : trois pièces posées, compte à rebours, décollage', q);
    ok(q.state === 'gameover' && q.title === 'Évasion réussie' && /quitté la Lune/.test(q.rounds), 'victoire : « Évasion réussie »', q);
    await game.waitForFunction(() => !document.getElementById('gameover').hidden, null, { timeout: 30000 });
    await game.click('#btn-go-menu');
    await game.waitForFunction(() => ZS.G.state === 'menu' && !document.getElementById('menu').hidden);

    // ------------------------------------------------------- menu de la Lune : consignes
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const vis = (id) => !document.getElementById(id).hidden;
      const txt = (id) => document.getElementById(id).textContent;
      ok(/Ombre éternelle/.test(txt('menu-eyebrow')) && /atterrisseur/.test(txt('menu-lead')), 'menu : rapport d’incident et consigne d’Ombre éternelle', [txt('menu-eyebrow'), txt('menu-lead')]);
      ok(!vis('tip-planks') && !vis('tip-veh') && !vis('tip-storm') && /caisse de ravitaillement/.test(txt('tip-box')) && /crête solaire/.test(txt('tip-power')) && vis('tip-moon') && /1\/6 g/.test(txt('tip-moon')) && vis('tip-o2') && /4 min/.test(txt('tip-o2')),
        'consignes de la Lune : caisse de ravitaillement, crête solaire, 1/6 g, oxygène ; ni planches, ni véhicules, ni tempêtes', ['tip-planks', 'tip-box', 'tip-power', 'tip-veh', 'tip-storm', 'tip-moon', 'tip-o2'].map((id) => (vis(id) ? '' : '[caché] ') + txt(id).slice(0, 40)));
      return out;
    })).forEach(report);

    // ------------------------------------------------------- écran « Modèles » : l'Astronaute, le Mineur
    await game.click('#btn-models');
    await game.waitForFunction(() => !document.getElementById('models').hidden);
    const md = await game.evaluate(() => {
      const out = {};
      for (const id of ['lu_astro', 'lu_mineur']) {
        const tab = document.querySelector(`#md-tabs [data-id="${id}"]`);
        selectSpecimen(id);
        for (let i = 0; i < 12; i++) renderModels(1 / 30);
        const p = __zs.modelProbe();
        out[id] = { listed: !!tab, tab: tab && tab.textContent, name: document.getElementById('md-plate-name').textContent, drawn: p ? +p.changed.toFixed(3) : null };
      }
      return out;
    });
    ok(Object.values(md).every((m) => m.listed && m.name && m.drawn > 0.005) && /L-01/.test(md.lu_astro.tab) && /L-02/.test(md.lu_mineur.tab), 'Modèles : fiches et modèles 3D de l’Astronaute (L-01) et du Mineur (L-02)', md);
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
      const out = { owOn: OW.on, hp, alive: zs.length, types: [...new Set(zs.map((q) => q.type.id))], grav: { ...GRAV }, o2: !!LUO.el && !LUO.el.hidden, hud: !!(OWH.map && OWH.map.isConnected && !OWH.map.hidden), grid: grid.length > 64, hears: GRAV.moon ? luHears({ x: player.pos.x, z: player.pos.z }) : true, muffled: LUO.muffled };
      quitToMenu();
      const vis = (id) => !document.getElementById(id).hidden;
      out.tips = { planks: vis('tip-planks'), moon: vis('tip-moon'), o2: vis('tip-o2'), box: document.getElementById('tip-box').textContent, power: document.getElementById('tip-power').textContent };
      return out;
    });
    ok(!b7.owOn && b7.grid && !b7.hud && !b7.o2 && !b7.grav.moon && b7.grav.k === 1 && b7.grav.jump === 4.7 && b7.hears && b7.muffled === null, 'Bunker 7 après la Lune : moteur de grille, pesanteur et son de la Terre, ni jauge d’oxygène ni mini-carte', b7);
    ok(b7.hp === 100 && b7.alive > 0 && b7.types.every((id) => !/^lu_|^kh_/.test(id)), 'Bunker 7 : zombies d’origine (100 PV à la manche 1)', b7);
    ok(b7.tips.planks && !b7.tips.moon && !b7.tips.o2 && b7.tips.box === 'La boîte mystère donne une arme au hasard pour 950 points.' && /salle des machines/.test(b7.tips.power),
      'Bunker 7 : consignes d’origine', b7.tips);

    ok(errors.length === 0, 'aucune erreur dans la page du jeu', errors.slice(0, 6));
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  exception : ${e && e.stack ? e.stack : e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} échec(s)` : '\nOmbre éternelle : tout est bon');
  process.exit(failures ? 1 : 0);
})();
