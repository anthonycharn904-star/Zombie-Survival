'use strict';
/* Les Marécages Maudits (jeu 2.0.7), quatrième carte du menu « Jouer », dans la fenêtre du jeu du launcher :
   catalogue (carte ouverte, « en développement », absente des Mod Tools de grille, base « Marais vierge »), rien
   d'installé au chargement du jeu (diagnostic, console.error), sélection et chargement par l'écran « Jouer », monde
   de 1 × 1 km (cinq îles, la Fosse), départ au Bourg noyé, éléments (9 armes au mur, 5 atouts, boîte à 4
   emplacements, 3 disjoncteurs, 2 jerricans, Le Glas, 11 barques), peau de la Mère-Vase calculée par morceaux en
   partie, rendu, confort (aucune secousse par défaut,
   flashs limités), patauger puis nager (sans arme), barque (monter, gaz, menace de la Mère-Vase, Noyés qui sortent
   de l'eau, descendre), la Mère-Vase (interface ZS.marais, pas de combat sans déclencheur), manche des Stryges
   (bandeau, compteur rouge, nuée, munitions max de la dernière), pluie et orage, foudre, F8 sans effet pour un
   joueur, consignes du menu, écran « Modèles » (Noyé, Stryge) ; retour au Bunker 7.
     xvfb-run -a node e2e/marecages.e2e.js   (Linux sans écran)
   Décisions d'Anthony suivies (1er et 2 novembre 2026) : secousses coupées par défaut, flashs limités, F8 seulement
   en diagnostic, console.error jamais remplacé. Les blocs « game.evaluate » se rejouent aussi dans la page du jeu
   (engine/tools/e2e-page.js) : chacun recharge le marais s'il n'est pas là (sans effet ici). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-marecages-'));
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

    // ------------------------------------------------------- catalogue, rien d'installé au chargement du jeu
    (await game.evaluate((v) => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(ZS.version === v && typeof MARAIS === 'object', `jeu du launcher (paquet ${v}) avec les Marécages Maudits`, { v, version: ZS.version });
      ok(MAPS.list.join() === 'bunker7,khamsin,ombre,marais', 'catalogue : Bunker 7, Khamsin, Ombre éternelle, puis les Marécages Maudits (quatrième carte)', MAPS.list);
      const M = MAPS.byId.marais;
      ok(M && M.open && M.base === 'marais' && M.name === 'Les Marécages Maudits' && M.dev === true && /^data:image\/jpeg/.test(M.thumb || ''),
        'Marécages : carte ouverte (base marais), publiée « en développement », vignette du plan', M && { open: M.open, base: M.base, name: M.name, dev: M.dev, thumb: (M.thumb || '').slice(0, 22) });
      ok(!ZS.MAPS.list.includes('marais') && !ZS.MAPS.byId.marais && ZS.MAPS_ALL.byId.marais === M, 'Mod Tools : absente du catalogue des cartes de grille, présente dans le catalogue complet', ZS.MAPS.list);
      ok(ZS.ow.worldOf('marais') === 'marais' && ZS.ow.worldOf('marais_vierge') === 'marais' && OW_BASES.marais_vierge && OW_BASES.marais_vierge.name === 'Marais vierge' && !OW_BASES.marais_vierge.places,
        'Mod Tools : monde « marais » de ses deux bases, dont « Marais vierge » (sans les lieux)', { m: ZS.ow.worldOf('marais'), v: ZS.ow.worldOf('marais_vierge') });
      ok(ZS.marais && ZS.marais.version === 1 && typeof ZS.marais.appelle === 'function' && ZS.marais.meteo && typeof ZS.marais.meteo.pluie === 'function', 'interface ZS.marais (version 1) : Mère-Vase, météo', ZS.marais && Object.keys(ZS.marais));
      // décisions d'Anthony du 1er novembre 2026 : rien ne s'installe au chargement, console.error jamais remplacé, F8 muet
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8', bubbles: true }));
      ok(!MA_DIAG.installed && !MA_DIAG.on && !MA_DIAG.el && !render.__diag && /\[native code\]/.test(Function.prototype.toString.call(console.error)),
        'diagnostic : rien d’installé au chargement du jeu, F8 sans effet au menu, console.error d’origine', { installed: MA_DIAG.installed, on: MA_DIAG.on });
      ok(!settings.shake && (settings.flashes === undefined || settings.flashes === 'limited'), 'confort par défaut : pas de secousses, flashs limités', { shake: settings.shake, flashes: settings.flashes });
      return out;
    }, GAME)).forEach(report);

    // ------------------------------------------------------- « Jouer » : les Marécages Maudits, quatrième carte
    await game.click('#btn-play');
    await game.waitForFunction(() => !document.getElementById('mapsel').hidden);
    const cards = await game.evaluate(() => [...document.querySelectorAll('#ms-grid .ms-card')].map((c) => ({
      id: c.dataset.id, name: c.querySelector('.ms-name').textContent, img: !!c.querySelector('.ms-photo img'),
      dev: (c.querySelector('.ms-dev') || { textContent: '' }).textContent, desc: (c.querySelector('.ms-desc') || { textContent: '' }).textContent.slice(0, 60),
    })));
    const mc = cards[3] || {};
    ok(cards.length === 4 && mc.id === 'marais' && mc.name === 'Les Marécages Maudits' && mc.img && mc.dev === 'En développement' && /cinq îles/.test(mc.desc)
      && cards.slice(0, 3).every((c) => !c.dev), 'Jouer : les Marécages Maudits, quatrième carte, tampon « En développement » (elle seule)', cards);
    await game.click('#ms-grid .ms-card[data-id="marais"]');
    ok(await game.evaluate(() => MapSel.sel === 'marais' && document.querySelector('#ms-grid .ms-card[data-id="marais"]').getAttribute('aria-selected') === 'true'), 'Jouer : les Marécages Maudits choisis');
    const t0 = Date.now();
    await game.click('#btn-ms-play');
    await game.waitForFunction(() => ZS.G.state === 'playing' && ZS.G.mapId === 'marais', null, { timeout: 300000 });
    console.log(`       (chargement du marais et première image : ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

    // ------------------------------------------------------- monde, départ, éléments
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      renderEnabled = false;
      // la souris libérée (fenêtre de test) met le jeu en pause entre deux évaluations : on reprend ; hors du
      // launcher (e2e-page.js), le marais est chargé ici
      window.__play = () => {
        if (G.mapId !== 'marais' || !OW.on) { __zs.map('marais'); __zs.start(); }
        if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        __zs.god(true); renderEnabled = false;
      };
      window.__calme = () => { G.roundState = 'pre'; G.roundT = 1e9; G.dogRound = false; clearZombies(); ZS.marais.calme(); MAM.attn = 0; };
      __play();
      const P = player, M = MAPS.byId.marais;
      ok(OW.on && OW.worldId === 'marais' && OW.baseId === 'marais' && CUR.map === M, 'Marécages chargés par le moteur du monde ouvert (troisième monde : marais)', { w: OW.worldId, b: OW.baseId });
      ok(OW.W === 1000 && OW.D === 1000, 'zone jouable : 1 × 1 km', [OW.W, OW.D]);
      const names = MA.locs.map((L) => L.name);
      ok(['Le Bourg noyé', 'La Futaie', 'Station Héron', 'L’Enlisée', 'Îlot des Pierres', 'La Fosse'].every((n) => names.includes(n)), 'lieux : cinq îles et la Fosse', names);
      ok(maDepth(MA.fosse.x, MA.fosse.z) > 12 && maDepth(MA.islands[0].x, MA.islands[0].z) < 0, 'la Fosse : plus de 12 m d’eau ; le Bourg noyé hors de l’eau', { fosse: +maDepth(MA.fosse.x, MA.fosse.z).toFixed(1), bourg: +maDepth(MA.islands[0].x, MA.islands[0].z).toFixed(1) });
      const sp = M.spawn.pos;
      ok(Math.hypot(P.pos.x - sp[0], P.pos.z - sp[1]) < 2 && maDepth(P.pos.x, P.pos.z) <= 0 && !MA_SWIM.on && !VEH.drive, 'départ au Bourg noyé, au sec', { x: P.pos.x, z: P.pos.z });
      ok(G.points === 500 && curSlot() && curSlot().id === 'm1911' && !G.power, 'départ : 500 points, M1911, courant coupé', { points: G.points, w: curSlot() && curSlot().id, power: G.power });
      ok(OWH.map && OWH.map.isConnected && !OWH.map.hidden && OWH.comp && OWH.comp.isConnected, 'HUD : mini-carte et boussole');
      const I = Features.interactables, n = (k) => I.filter((q) => q.kind === k).length;
      const perks = Features.perkMachines.map((m) => m.id).sort().join();
      ok(n('wallbuy') === 9 && perks === 'cuirasse,detente,endurance,mainleste,souffle' && Features.box.locs.length === 4 && KHF.breakers.length === 3 && KHF.fuel.length === 2 && Features.amp,
        'éléments : 9 armes au mur, les 5 atouts, 4 emplacements de la boîte, 3 disjoncteurs, 2 jerricans, Le Glas', { wb: n('wallbuy'), perks, box: Features.box.locs.length, br: KHF.breakers.length, fuel: KHF.fuel.length, glas: !!Features.amp });
      const B = VEH.list.filter((V) => V.T && V.T.boat);
      ok(VEH.list.length === 11 && B.length === 11 && B.every((V) => maDepth(V.x, V.z) > MA.boatDraft && !V.capsized), 'onze barques à flot aux pontons, et aucun autre véhicule', { veh: VEH.list.length, barques: B.length });
      ok(MAB.on && MAB.state === 'dormant' && ZS.marais.menace === 0 && !MA_BOSS.on, 'la Mère-Vase dort sous l’eau ; pas de combat de boss (sans déclencheur)', { state: MAB.state, menace: ZS.marais.menace, boss: MA_BOSS.on });
      return out;
    })).forEach(report);
    // ------------------------------------------------------- la peau de la Mère-Vase, calculée par morceaux en partie (13 novembre 2026)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play();
      const W = { high: 2048, medium: 1024, low: 512 }[MA_PEAU.q], sk = () => MAB.mv.materials.skin;
      if (!MA_PEAU.pret) ok(MA_PEAU.gen && sk().map.image.width === 4, 'au chargement : la Mère-Vase est là, avec sa peau provisoire ; la vraie se calcule en partie', { q: MA_PEAU.q, w: sk().map.image.width });
      else ok(true, 'la peau de la Mère-Vase est déjà calculée (session commencée avant)');
      G.roundState = 'pre'; G.roundT = 1e9;
      let n = 0;
      while (!MA_PEAU.pret && n < 60 * 600) { __zs.step(1, 1 / 60); n++; }
      const t = [sk().map, sk().normalMap, sk().roughnessMap, sk().emissiveMap];
      ok(MA_PEAU.pret && t.every((x) => x.image.width === W && x.image.height === W / 2) && MAB.mv.materials.textures.slice(0, 4).every((x, i) => x === t[i]),
        `peau de la Mère-Vase calculée en partie (${MA_PEAU.n} morceaux, ${(MA_PEAU.calc / 1000).toFixed(1)} s de calcul, ${n} images) : ses quatre textures de ${W} × ${W / 2} en place`, { q: MA_PEAU.q, n, w: t.map((x) => x.image.width) });
      return out;
    })).forEach(report);
    // une image du Bourg noyé (shaders compilés sans erreur)
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
    ok(draw.calls > 30 && draw.tris > 50000 && draw.glError === 0, `rendu au Bourg noyé : ${draw.calls} appels de dessin, ${Math.round(draw.tris / 1000)} k triangles`, draw);

    // ------------------------------------------------------- confort : secousses coupées par défaut (Anthony, 1er et 2 novembre)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play();
      FX.shake = 0; maSecousse(1);
      const a = FX.shake;
      ok(a === 0 && !maSecousseVue() && maBalance() === 0, 'aucune secousse du marais ni du jeu de base par défaut, aucun balancement', { shake: a, vue: maSecousseVue(), bal: maBalance() });
      settings.shake = true; maSecousse(0.5);
      const b = FX.shake;
      ok(b > 0 && maSecousseVue() && maBalance() > 0, 'settings.shake = true : les secousses reviennent', { shake: b, vue: maSecousseVue(), bal: maBalance() });
      settings.shake = undefined; FX.shake = 0;
      return out;
    })).forEach(report);

    // ------------------------------------------------------- patauger, puis nager (sans arme)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play(); __calme();
      const P = player, I0 = MA.islands[0];
      // depuis le Bourg noyé, vers la Fosse : le dernier pas où l'on a pied (moins de 0,9 m d'eau), puis l'eau profonde
      const dx = MA.fosse.x - I0.x, dz = MA.fosse.z - I0.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      let wade = null;
      const profil = [];
      for (let d = 20; d < L && !wade; d += 0.5) {
        const x = I0.x + ux * d, z = I0.z + uz * d, dep = maDepth(x, z), walk = owWalkCell(0, Math.floor(x), Math.floor(z));
        if (d % 4 === 0) profil.push([d, +dep.toFixed(2), walk ? 1 : 0]);
        // devant (à 1 à 4 m) : de l'eau où l'on n'a plus pied (la marche s'y arrête)
        if (dep > 0.15 && dep < 0.6 && walk && [1, 2, 3, 4].some((e) => maDepth(x + ux * e, z + uz * e) > 0.8 && !owWalkCell(0, Math.floor(x + ux * e), Math.floor(z + uz * e)))) wade = [x, z];
      }
      if (!wade) { ok(false, 'un haut-fond devant l’eau profonde, entre le Bourg et la Fosse', profil); return out; }
      const yaw = Math.atan2(-ux, -uz);
      __zs.tp(wade[0], wade[1], yaw); __zs.step(10);
      const pied = { swim: MA_SWIM.on, dep: +maDepth(P.pos.x, P.pos.z).toFixed(2), arme: Arms.root.visible };
      ok(!pied.swim && pied.dep > 0 && pied.dep < MA.wade && pied.arme, 'dans moins de 0,9 m d’eau : on patauge, l’arme en main', pied);
      Input.keys.KeyW = true;
      let t = 0;
      for (let i = 0; i < 6 * 60 && !MA_SWIM.on; i++) { __zs.step(1, 1 / 60); t += 1 / 60; }
      __zs.step(10);                                      // la caméra du nageur (maSwimStep) à l'image suivante
      const nage = { swim: MA_SWIM.on, why: MA_SWIM.why, t: +t.toFixed(2), arme: Arms.root.visible, oeil: +(camera.position.y - MA.water).toFixed(2), onWater: maPlayerOnWater() };
      ok(nage.swim && nage.why === 'plonge' && !nage.arme && nage.onWater && nage.oeil > 0 && nage.oeil < 0.4, 'on avance vers le large : on nage, sans arme, les yeux au ras de l’eau', nage);
      const x0 = P.pos.x, z0 = P.pos.z;
      for (let i = 0; i < 2 * 60; i++) __zs.step(1, 1 / 60);
      const v = Math.hypot(P.pos.x - x0, P.pos.z - z0) / 2;
      ok(MA_SWIM.on && v > 0.8 && v < 2.2, `à la nage : lentement (${v.toFixed(2)} m/s)`, { v });
      ok(ZS.marais.menace > 0, `la Mère-Vase entend le nageur (menace ${ZS.marais.menace.toFixed(1)})`);
      // demi-tour : on reprend pied sur le haut-fond
      P.yaw += Math.PI;
      for (let i = 0; i < 12 * 60 && MA_SWIM.on; i++) __zs.step(1, 1 / 60);
      Input.keys.KeyW = false;
      __zs.step(5);
      ok(!MA_SWIM.on && Arms.root.visible && maDepth(P.pos.x, P.pos.z) < MA.wade, 'demi-tour : on reprend pied, l’arme revient', { swim: MA_SWIM.on, dep: +maDepth(P.pos.x, P.pos.z).toFixed(2) });
      __calme();
      return out;
    })).forEach(report);

    // ------------------------------------------------------- barque : monter, gaz, Noyés, descendre au ponton
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play(); __calme();
      const P = player;
      // la barque la plus proche du départ (ponton sud du Bourg)
      const sp = MAPS.byId.marais.spawn.pos;
      const V = VEH.list.filter((q) => q.T.boat).sort((a, b) => Math.hypot(a.x - sp[0], a.z - sp[1]) - Math.hypot(b.x - sp[0], b.z - sp[1]))[0];
      const [fx, fz] = vehFwd(V.yaw);
      __zs.tp(V.x + fz * 2, V.z - fx * 2); __zs.step(5);
      vehEnter(V); __zs.step(40);
      ok(VEH.drive === V && maPlayerOnWater() && Arms.root.visible && VEH.view === 1, 'monter dans la barque : au barreur, vue embarquée, on garde l’arme', { drive: VEH.drive === V, view: VEH.view });
      // la manche 1 commence : sur l'eau, les Noyés viennent (4 à 7 s sur l'eau avant le premier groupe)
      G.round = 1; G.roundState = 'active'; G.total = 0; G.spawned = 0; G.killed = 0; G.roundT = 1e9;
      const x0 = V.x, z0 = V.z, m0 = ZS.marais.menace;
      Input.keys.KeyW = true;
      for (let i = 0; i < 4 * 60; i++) __zs.step(1, 1 / 60);
      Input.keys.KeyW = false;
      const route = Math.hypot(V.x - x0, V.z - z0);
      ok(route > 6 && V.motor, `gaz : la barque avance au moteur (${route.toFixed(1)} m en 4 s)`, { route, motor: V.motor, v: V.v });
      ok(ZS.marais.menace > m0, `le moteur attire la Mère-Vase (menace ${m0.toFixed(1)} → ${ZS.marais.menace.toFixed(1)})`);
      for (let i = 0; i < 8 * 60 && !MA_NOYES.spawned; i++) __zs.step(1, 1 / 60);
      const noyes = Zombies.list.filter((z) => z.noye && z.alive);
      ok(MA_NOYES.spawned > 0 && noyes.length > 0 && noyes.every((z) => maDepth(z.hx, z.hz) > 1), `les Noyés sortent de l’eau profonde autour de la barque (${noyes.length})`, { spawned: MA_NOYES.spawned });
      const pts = G.points, k0 = MA_NOYES.killed;
      for (const z of noyes) damageZombie(z, 1e6, { kind: 'bullet', dx: 0, dz: 1 });
      __zs.step(5);
      ok(MA_NOYES.killed - k0 === noyes.length && G.points > pts && noyes.every((z) => !z.alive), 'Noyés abattus : comptés, points du jeu', { tues: MA_NOYES.killed - k0, points: G.points - pts });
      // retour au ponton, moteur coupé, et descente
      __calme();
      V.v = 0; V.thr = 0; V.x = x0; V.z = z0; vehPose(V, 0, true); __zs.step(10);
      vehExit();
      __zs.step(10);
      ok(!VEH.drive && !MA_SWIM.on && !maPlayerOnWater() && Arms.root.visible && (maOnFloor(P.pos.x, P.pos.z) || maDepth(P.pos.x, P.pos.z) < MA.wade), 'descendre au ponton : à pied, sur les planches', { drive: !!VEH.drive, swim: MA_SWIM.on, ponton: !!maOnFloor(P.pos.x, P.pos.z), dep: +maDepth(P.pos.x, P.pos.z).toFixed(2) });
      return out;
    })).forEach(report);

    // ------------------------------------------------------- la Mère-Vase (ZS.marais) : l'appeler, la calmer
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play(); __calme();
      ZS.marais.appelle();
      ok(ZS.marais.menace === 85, 'ZS.marais.appelle() : menace à 85', ZS.marais.menace);
      __zs.step(60);
      const b = ZS.marais.bete;
      ok(typeof b.state === 'string' && Number.isFinite(b.x) && Number.isFinite(b.z) && ZS.marais.niveau >= 0, `ZS.marais.bete : état « ${b.state} », position`, b);
      ZS.marais.calme(); __zs.step(30);
      ok(ZS.marais.menace < 5 && !MA_BOSS.on, 'ZS.marais.calme() : elle s’éloigne ; toujours pas de combat de boss', { menace: ZS.marais.menace, state: MAB.state });
      ok(Math.abs(ZS.marais.profondeur(MA.fosse.x, MA.fosse.z) - maDepth(MA.fosse.x, MA.fosse.z)) < 1e-6 && ZS.marais.eau === MA.water && ZS.marais.islands.length === 5, 'ZS.marais : profondeur, niveau de l’eau, îles');
      __calme();
      return out;
    })).forEach(report);

    // ------------------------------------------------------- manche des Stryges (à la place de celle des chiens)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play(); __calme();
      const r0 = MA_STRYGES.rounds, n0 = G.dogs.n, s0 = MA_STRYGES.spawned;
      __zs.dogs(5);
      __zs.step(12, 1 / 60);
      ok(G.round === 5 && G.dogRound && G.total === 6 && MA_STRYGES.rounds === r0 + 1, 'manche 5 forcée en manche spéciale : 6 Stryges', { round: G.round, dog: G.dogRound, total: G.total });
      const banner = document.getElementById('banner-title').textContent, round = document.getElementById('round').classList;
      ok(banner === 'Les Stryges' && round.contains('stryges'), 'bandeau « Les Stryges · Manche spéciale », compteur de manche rouge', { banner, cls: round.value });
      let vues = 0;
      for (let i = 0; i < 25 * 60 && MA_STRYGES.spawned === s0; i++) __zs.step(1, 1 / 60);
      for (let i = 0; i < 20 * 60; i++) {
        __zs.step(1, 1 / 60);
        vues = Math.max(vues, Zombies.list.filter((z) => z.stryge && z.alive).length);
        if (G.spawned >= G.total) break;
      }
      const S = Zombies.list.filter((z) => z.stryge && z.alive);
      ok(vues > 0 && S.every((z) => z.root.y > maStrygeFloor(z.root.x, z.root.z, 1) + 0.5 || z.ss === 'emerge' || z.ss === 'prowl' || z.ss === 'crawl'), `les Stryges arrivent dans le ciel du marais (${vues} à la fois)`, S.map((z) => [z.ss, +z.root.y.toFixed(1)]));
      // toutes abattues (les règles du jeu : damageZombie), la dernière lâche des munitions max
      const ammo0 = Powerups.list.filter((p) => p.type === 'ammo').length;
      for (let k = 0; k < 40 && G.killed < G.total; k++) {
        if (G.spawned < G.total) for (let i = 0; i < 3 * 60 && Zombies.list.filter((z) => z.stryge && z.alive).length === 0; i++) __zs.step(1, 1 / 60);
        for (const z of Zombies.list.filter((q) => q.stryge && q.alive)) { z.ss = 'circle'; damageZombie(z, 1e6, { kind: 'bullet', head: true, dx: 0, dz: 1 }); }
        __zs.step(30);
      }
      for (let i = 0; i < 6 * 60 && G.dogRound; i++) __zs.step(1, 1 / 60);
      const ammo = Powerups.list.filter((p) => p.type === 'ammo').length;
      ok(G.killed >= G.total && !G.dogRound && G.dogs.n === n0 + 1 && MA_STRYGES.killed >= 6, 'manche des Stryges finie : toutes comptées, une manche spéciale de plus', { killed: G.killed, total: G.total, dog: G.dogRound, n: G.dogs.n, st: MA_STRYGES.killed });
      ok(ammo > ammo0, 'la dernière Stryge lâche des munitions max', { avant: ammo0, apres: ammo });
      __calme(); clearPowerups();
      return out;
    })).forEach(report);

    // ------------------------------------------------------- pluie, orage, foudre
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play(); __calme();
      const W = ZS.marais.meteo;
      W.pluie(true);
      for (let i = 0; i < 8 * 60; i++) __zs.step(1, 1 / 60);
      const e = W.etat;
      ok(e.episode === 'averse' && e.intensite > 0.1 && e.couvert > 0.8, `averse : il pleut (intensité ${e.intensite.toFixed(2)})`, e);
      const P = player, n0 = MA_OR.strikes.length;
      let S = null, r = null;
      for (const d of [30, 34, 26, 38, 22]) { r = W.eclair(P.pos.x + d, P.pos.z, { at: 1 }); if (r && MA_OR.strikes.length > n0) { S = MA_OR.strikes[MA_OR.strikes.length - 1]; break; } }
      const avant = S && { warn: !!S.warn, hit: !!S.hit };
      for (let i = 0; i < 90; i++) __zs.step(1, 1 / 60);
      ok(S && !avant.hit && S.hit, `la foudre tombe à ${r ? Math.round(Math.hypot(r.x - P.pos.x, r.z - P.pos.z)) : '?'} m (${r && r.surface}), une seconde après l’appel`, { r, avant, hit: S && S.hit });
      W.sec();
      for (let i = 0; i < 2 * 60; i++) __zs.step(1, 1 / 60);
      ok(W.etat.episode === 'sec', 'le temps sec revient', W.etat);
      return out;
    })).forEach(report);

    // ------------------------------------------------------- F8 : rien pour un joueur (diagnostic non activé)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play(); __calme();
      const attn = ZS.marais.menace;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8', shiftKey: true, bubbles: true }));
      __zs.step(2);
      ok(!MA_DIAG.on && !MA_DIAG.el && !MA_DIAG.installed && ZS.marais.menace === attn && /\[native code\]/.test(Function.prototype.toString.call(console.error)),
        'F8 et Maj+F8 sans effet dans une partie (diagnostic non activé), console.error d’origine', { on: MA_DIAG.on, installed: MA_DIAG.installed, menace: ZS.marais.menace });
      return out;
    })).forEach(report);

    // ------------------------------------------------------- consignes du menu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __play();
      quitToMenu();
      const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
      const t = (id) => (document.getElementById(id) || { textContent: '' }).textContent;
      ok(G.mapId === 'marais' && t('menu-eyebrow') === MARAIS.eyebrow && t('menu-lead') === MARAIS.lead, 'menu : rapport d’incident et consigne des Marécages Maudits', { eyebrow: t('menu-eyebrow'), lead: t('menu-lead') });
      ok(vis('tip-swamp') && vis('tip-beast') && !vis('tip-moon') && !vis('tip-o2') && !vis('tip-planks'), 'consignes du marais : barques et nage, la menace ; ni Lune, ni planches', { swamp: t('tip-swamp'), beast: t('tip-beast') });
      return out;
    })).forEach(report);

    // ------------------------------------------------------- écran Modèles : le Noyé et la Stryge
    await game.click('#btn-models');
    await game.waitForFunction(() => !document.getElementById('models').hidden);
    const md = await game.evaluate(() => {
      const out = {};
      for (const id of ['ma_noye', 'ma_stryge']) {
        const tab = document.querySelector(`#md-tabs [data-id="${id}"]`);
        selectSpecimen(id);
        for (let i = 0; i < 12; i++) renderModels(1 / 30);
        const p = __zs.modelProbe();
        out[id] = { listed: !!tab, tab: tab && tab.textContent, name: document.getElementById('md-plate-name').textContent, drawn: p ? +p.changed.toFixed(3) : null };
      }
      return out;
    });
    ok(Object.values(md).every((m) => m.listed && m.name && m.drawn > 0.005) && /M-01/.test(md.ma_noye.tab) && /07/.test(md.ma_stryge.tab), 'Modèles : fiches et modèles 3D du Noyé (M-01) et de la Stryge (N°07)', md);
    await game.evaluate(() => showScreen('menu'));

    // ------------------------------------------------------- retour au Bunker 7
    await game.click('#btn-play');
    await game.waitForFunction(() => !document.getElementById('mapsel').hidden);
    await game.click('#ms-grid .ms-card[data-id="bunker7"]');
    await game.click('#btn-ms-play');
    await game.waitForFunction(() => ZS.G.state === 'playing' && ZS.G.mapId === 'bunker7', null, { timeout: 300000 });
    const b7 = await game.evaluate(() => {
      if (G.mapId !== 'bunker7') { __zs.map('bunker7'); __zs.start(); }   // hors du launcher (e2e-page.js) ; sans effet ici
      renderEnabled = false;
      __zs.god(true);
      if (__zs.dogs) __zs.dogs(false);
      __zs.round(1); __zs.step(30);
      const hp = G.zombieHp;
      __zs.step(60 * 12);
      const zs = Zombies.list.filter((q) => q.alive);
      const out = { owOn: OW.on, world: OW.worldId || null, hp, alive: zs.length, types: [...new Set(zs.map((q) => q.type.id))], swim: MA_SWIM.on, drive: !!VEH.drive, veh: VEH.list.length,
        vue: maSecousseVue(), bal: maBalance(), onWater: maPlayerOnWater(), strygeRound: maStrygeRoundOn(), arms: Arms.root.visible, grid: grid.length > 64 };
      quitToMenu();
      const vis = (id) => !document.getElementById(id).hidden;
      out.tips = { planks: vis('tip-planks'), swamp: vis('tip-swamp'), beast: vis('tip-beast'), box: document.getElementById('tip-box').textContent };
      return out;
    });
    ok(!b7.owOn && b7.grid && !b7.swim && !b7.drive && b7.vue === 1 && !b7.onWater && !b7.strygeRound && b7.arms,
      'Bunker 7 après le marais : moteur de grille, ni nage ni barque, secousses du jeu de base rendues (hors du marais)', b7);   // (VEH.list garde les barques jusqu'au prochain monde ouvert, comme les jeeps de Khamsin : rien ne les fait tourner)
    ok(b7.hp === 100 && b7.alive > 0 && b7.types.every((id) => !/^ma_|^kh_|^lu_/.test(id)), 'Bunker 7 : zombies d’origine (100 PV à la manche 1)', b7);
    ok(b7.tips.planks && !b7.tips.swamp && !b7.tips.beast && b7.tips.box === 'La boîte mystère donne une arme au hasard pour 950 points.', 'Bunker 7 : consignes d’origine', b7.tips);

    ok(errors.length === 0, 'aucune erreur dans la page du jeu', errors.slice(0, 6));
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  exception : ${e && e.stack ? e.stack : e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} échec(s)` : '\nLes Marécages Maudits : tout est bon');
  process.exit(failures ? 1 : 0);
})();
