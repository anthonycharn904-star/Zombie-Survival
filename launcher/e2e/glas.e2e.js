'use strict';
/* Le Glas (jeu 1.8.0), la machine d'amélioration des armes qui remplace l'ancien Pack-A-Punch, dans
   la fenêtre du jeu du launcher : à l'endroit exact de l'ancienne machine sur Bunker 7, plafond ouvert
   au-dessus du beffroi, gabarit de la planche (cloche de 1,6 m au profil donné, 5,6 m de haut, 4,7 m
   d'emprise), cases fermées ; muette sans courant, réveillée par le courant ; offrande, chute, un à
   trois coups payés (F maintenue), relève, reprise ou perte au bout de 10 s ; paliers Tocsin,
   Bourdon, Glas (dégâts ×2, ×2,5, ×3, chargeur +50 %) ; onde de choc du premier coup, appel des
   morts, Résonance, Minuit, douzième coup ; secousse, sauvegarde, finitions des armes, mod de munition
   dans le HUD (à gauche des munitions, nom de l'arme immobile), avertissements des Mod Tools, pas d'erreur.
     xvfb-run -a node e2e/glas.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-glas-'));
const USER = path.join(TMP, 'joueur');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  const report = (r) => {
    if (!r.ok) failures++;
    console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
  };
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
    game.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

    // ------------------------------------------------- règles et paliers
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = GLAS.tiers;
      ok(T[1].cost === 5000 && T[2].cost === 10000 && T[3].cost === 20000 && T[1].dmg === 2 && T[2].dmg === 2.5 && T[3].dmg === 3 && GLAS.magMult === 1.5,
        'paliers de la planche : Tocsin 5 000 (×2), Bourdon +10 000 (×2,5), Glas +20 000 (×3), chargeur +50 %');
      const s = [1, 2, 3].map((t) => tierStats('mp40', t));
      ok(s[0].dmg === 110 && s[1].dmg === 137.5 && s[2].dmg === 165 && s.every((x) => x.mag === 48 && x.res === 384 && x.rpm === 620),
        'MP40 : dégâts 110 / 137,5 / 165, chargeur 48 (32 + 50 %), réserve et cadence de l’ancienne amélioration', s.map((x) => [x.dmg, x.mag, x.res, x.rpm]));
      ok(s.map((x) => x.name).join(' | ') === 'MP40 Brûleur | MP40 Brûleur · Bourdon | MP40 Brûleur · Glas', 'noms : MP40 Brûleur, · Bourdon, · Glas', s.map((x) => x.name));
      ok(tierStats('m1911', 1).explosive.dmg === 1100 && tierStats('m1911', 3).explosive.dmg === 1650 && tierStats('panzer', 2).proj.dmg === 8750 && tierStats('raygun', 3).proj.direct === 5250,
        'éclats et projectiles : la valeur de l’ancienne amélioration au palier I, puis ×2,5 / ×3');
      ok(tierStats('mp40', 0) === WEAPONS.mp40 && wstat({ id: 'kar98k', tier: 0 }, 'dmg') === 260, 'palier 0 : l’arme de base, inchangée');
      return out;
    })).forEach(report);

    // ------------------------------------------------- Bunker 7 : emplacement, plafond, gabarit
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      // la boucle du jeu ne fait plus avancer la partie : seuls ces essais la font avancer
      window.__realUpdate = update;
      window.update = function (dt) { if (!window.__hold) window.__realUpdate(dt); };
      window.__hold = true;
      Input.fallback = true;
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9;
      const a = Features.amp;
      ok(a && JSON.stringify(BUNKER7.amp) === JSON.stringify({ cells: [[25, 7], [26, 7]], face: [0, 1] }) && a.cx === 26 && a.cz === 7.5 && a.group.rotation.y === 0 && a.s === 1,
        'Bunker 7 : Le Glas à l’endroit exact de l’ancien Pack-A-Punch (cases 25-26 × 7, tourné vers le sud), en taille réelle', a && [a.cx, a.cz, a.group.rotation.y, a.s]);
      const rows = [];
      for (let z = 5; z <= 9; z++) { let r = ''; for (let x = 22; x <= 29; x++) { const k = node(0, x, z); r += ceilOn[k] ? '#' : grid[k] === T.PROP ? 'o' : '?'; } rows.push(r); }
      ok(rows.join('/') === '########/#oooooo#/#oooooo#/#oooooo#/########' && JSON.stringify(CUR.glasOpen) === '[23,6,29,9]',
        'plafond ouvert sur les 6 × 3 cases du beffroi (et fermées aux déplacements), le reste de la salle couvert', rows);
      ok(a.open && a.roof.visible, 'au dernier niveau : le toit et la girouette dépassent par l’ouverture', { open: a.open, roof: a.roof.visible });
      const props = [];
      for (let z = 6; z <= 8; z++) for (let x = 23; x <= 28; x++) props.push(grid[node(0, x, z)] === T.PROP && Math.abs(solidTop[node(0, x, z)] - 0.95) < 1e-6);
      ok(props.every(Boolean) && props.length === 18, '18 cases fermées (hauteur 0,95 m : on tire par-dessus le socle)');
      const it = Features.interactables.find((i) => i.kind === 'amp');
      ok(it && Math.abs(it.x - 26) < 1e-6 && Math.abs(it.z - 9.45) < 1e-6 && walkNode(node(0, Math.floor(it.x), Math.floor(it.z))) && it.hold,
        'le joueur se tient devant le socle, sur le sol (F maintenue possible)', it && [it.x, it.z]);
      // gabarit
      const GG = GLAS_R.G;
      ok(GG.outer.parameters.segments === 48 && JSON.stringify(GG.outer.parameters.points.map((p) => [p.x, p.y])) === JSON.stringify(GLAS_PROFILE)
        && JSON.stringify(GLAS_PROFILE) === JSON.stringify([[0.81, 0], [0.80, 0.03], [0.77, 0.11], [0.71, 0.22], [0.64, 0.35], [0.59, 0.55], [0.56, 0.80], [0.55, 1.03], [0.53, 1.14], [0.45, 1.21], [0.37, 1.25], [0, 1.25]]),
        'cloche : LatheGeometry du profil de la planche, 48 segments (Ø 1,6 m, 1,25 m de haut)');
      a.group.updateMatrixWorld(true);
      const bb = new THREE.Box3();                 // la machine elle-même (pas les lueurs ni les cercles au sol)
      a.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.material.transparent) bb.expandByObject(o); });
      const h = bb.max.y, w = bb.max.x - bb.min.x;
      ok(Math.abs(h - 5.6) < 0.12 && Math.abs(w - 4.7) < 0.15, `gabarit : ${h.toFixed(2).replace('.', ',')} m de haut avec la girouette, ${w.toFixed(2).replace('.', ',')} m d’emprise (planche : 5,6 m, 4,7 m)`, { h, w });
      ok(Math.abs(a.bell.position.y - GLAS.lipUp) < 1e-6 && GLAS.lipDown > 0.9 && GLAS.lipDown < 0.92, 'cloche levée au repos ; posée, sa lèvre est sur la dalle du socle (0,9 m)');
      const lights = [];
      a.group.traverse((o) => { if (o.isLight) lights.push(o); });
      ok(lights.length === 3 && lights.every((l) => l.visible), '3 lumières (bouche, bougies, clair de lune), jamais masquées (pas de recompilation)', lights.length);
      return out;
    })).forEach(report);

    // ------------------------------------------------- muette, puis réveillée par le courant
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec, holdF = false) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { Input.keys.KeyF = holdF; __realUpdate(1 / 60); endFrameInput(); } Input.keys.KeyF = false; };
      const a = Features.amp, it = Features.interactables.find((i) => i.kind === 'amp');
      __zs.tp(it.x, it.z, 0);
      run(0.2);
      const p0 = it.prompt();
      ok(a.state === 'mute' && p0.text === 'Le Glas est muet : il faut du courant' && p0.disabled, 'sans courant : muette, « Le Glas est muet : il faut du courant »', p0);
      ok(a.flameMat.opacity === 0 && a.mouthLight.intensity === 0 && a.slotGlow.material.opacity === 0 && GLAS_R.M.crackGlow.opacity === 0, 'muette : ni lueur, ni bougie, ni fente allumée');
      __zs.power();
      run(1.3);
      ok(a.state === 'wake', 'courant rétabli : la cloche s’éveille (un coup)', a.state);
      run(2.7);
      ok(a.state === 'rest' && a.flameMat.opacity === 1 && a.flames.every((f) => f.visible) && a.mouthLight.intensity > 0.3 && a.slotGlow.material.opacity > 0.3 && GLAS_R.M.crackGlow.opacity > 0.1,
        'repos : bougies allumées, fente allumée, fêlure qui pulse, cône doré sur le berceau', { st: a.state, mouth: a.mouthLight.intensity, crack: GLAS_R.M.crackGlow.opacity });
      ok(G.glasTolls === 0, 'le coup du réveil ne compte pas parmi les coups du rituel', G.glasTolls);
      return out;
    })).forEach(report);

    // ------------------------------------------------- un coup (offrande, F relâchée aussitôt)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec, holdF = false) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { Input.keys.KeyF = holdF; __realUpdate(1 / 60); endFrameInput(); } Input.keys.KeyF = false; };
      const press = () => { Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput(); Input.keys.KeyF = false; };
      const a = Features.amp, it = Features.interactables.find((i) => i.kind === 'amp');
      G.points = 6000;
      __zs.give('mp40', 0);
      run(0.6);
      const p = it.prompt();
      ok(p.text === 'Appuyez sur F pour faire une offrande' && p.cost === 5000 && p.sub === 'MP40 · Coup I : Tocsin (dégâts ×2, chargeur +50 %)', 'invite : « Faire une offrande », 5 000 (le premier coup)', p);
      press();
      ok(a.state === 'ritual' && G.points === 1000 && !Arms.slots.some((s) => s && s.id === 'mp40') && a.display && a.display.visible && a.weapon.id === 'mp40',
        'offrande : 5 000 payés au tronc, l’arme quitte les mains et se couche sur le berceau', { st: a.state, pts: G.points });
      run(0.4);
      const lipMid = a.bell.position.y;
      run(0.45);
      ok(lipMid < GLAS.lipUp - 0.2 && lipMid > GLAS.lipDown && a.landed && a.tier === 1 && G.glasTolls === 1 && Math.abs(a.bell.position.y - GLAS.lipDown) < 0.04,
        'chute (0,8 s) puis coup I : la cloche se pose sur le socle, palier I (Tocsin)', { lipMid, tier: a.tier, tolls: G.glasTolls });
      run(0.9);
      ok(a.state === 'raise' && G.points === 1000, 'F relâchée : pas de coup II, la cloche se relève sans attendre', { st: a.state, pts: G.points });
      run(0.9);
      const p2 = it.prompt();
      ok(a.state === 'ready' && p2.text === 'Appuyez sur F pour reprendre MP40 Brûleur' && a.halo.material.opacity > 0.2, 'relève (0,8 s) : l’arme flotte, auréolée ; « reprendre MP40 Brûleur »', p2);
      press();
      const s = curSlot();
      ok(s && s.id === 'mp40' && s.tier === 1 && s.up && wstat(s, 'dmg') === 110 && s.mag === 48 && s.res === 384 && a.state === 'rest' && !a.weapon,
        'reprise : MP40 Brûleur, palier I, dégâts 110, chargeur 48 plein', s);
      HUD.weapon();
      ok(document.getElementById('w-name').classList.contains('up') && document.getElementById('w-name').textContent === 'MP40 Brûleur', 'interface : nom doré de l’arme reforgée');
      return out;
    })).forEach(report);

    // ------------------------------------------------- trois coups (F maintenue), invites, secousse
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec, holdF = false) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { Input.keys.KeyF = holdF; __realUpdate(1 / 60); endFrameInput(); } Input.keys.KeyF = false; };
      const a = Features.amp, it = Features.interactables.find((i) => i.kind === 'amp');
      __zs.give('stg44', 0);
      run(0.5);
      G.points = 40000;
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput();
      run(0.3, true);
      Input.keys.KeyF = true;
      const pr = it.prompt();
      Input.keys.KeyF = false;
      ok(pr.text === 'Maintenez F · Coup II' && pr.cost === 10000 && pr.hold === true, 'pendant la chute : « Maintenez F · Coup II », 10 000 (prix du prochain coup), touche pleine', pr);
      HUD.prompt(pr);
      ok(document.getElementById('prompt').classList.contains('hold') && document.querySelector('#prompt kbd').textContent === 'F', 'invite : la touche F est pleine quand elle est maintenue');
      run(0.45, true);
      for (let i = 0; i < 20 && a.tier < 1; i++) { Input.keys.KeyF = true; __realUpdate(1 / 60); endFrameInput(); }
      ok(a.tier === 1 && Math.abs(FX.joltT - 0.15) < 1e-9 && FX.joltA > 0.01, 'coup I : secousse de 0,15 s', { tier: a.tier, jolt: FX.joltT });
      run(0.1, true);
      const j1 = FX.joltA;
      run(1.5, true);
      const j2 = FX.joltA;
      ok(a.tier === 2 && G.points === 25000, 'F maintenue : coup II à 2,3 s, 10 000 payés', { tier: a.tier, pts: G.points });
      run(1.5, true);
      const j3 = FX.joltA;
      const pr3 = it.prompt();
      ok(a.tier === 3 && G.points === 5000 && pr3.text === 'Le Glas sonne…' && pr3.disabled, 'coup III à 3,8 s, 20 000 payés ; plus de coup possible', { tier: a.tier, pts: G.points, pr3 });
      ok(j1 < j2 && j2 < j3, 'secousse plus ample de palier en palier', [j1, j2, j3]);
      run(1.6, true);
      ok(a.state === 'raise', 'relève 1,5 s après le dernier coup', a.state);
      run(1.0);
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput(); Input.keys.KeyF = false;
      const s = curSlot();
      ok(s && s.id === 'stg44' && s.tier === 3 && wstat(s, 'dmg') === 240 && wstat(s, 'name') === 'STG-44 Tempête · Glas' && G.glasTolls === 4, 'STG-44 Tempête · Glas : dégâts 240 (80 × 3)', s && [s.tier, wstat(s, 'dmg'), wstat(s, 'name')]);
      // une arme au palier III : la cloche la refuse
      const p4 = it.prompt(), pts = G.points;
      glasOffer(a);
      ok(p4.text === 'La cloche refuse cette arme : elle est au palier III' && p4.disabled && a.state === 'rest' && G.points === pts, 'palier III : « La cloche refuse cette arme »', p4);
      return out;
    })).forEach(report);

    // ------------------------------------------------- reprise d'un palier, points qui manquent, arme perdue
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec, holdF = false) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { Input.keys.KeyF = holdF; __realUpdate(1 / 60); endFrameInput(); } Input.keys.KeyF = false; };
      const press = () => { Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput(); Input.keys.KeyF = false; };
      const a = Features.amp, it = Features.interactables.find((i) => i.kind === 'amp');
      // MP40 au palier I : l'offrande paie le coup II
      __zs.give('mp40', 1);
      run(0.5);
      G.points = 12000;
      const p = it.prompt();
      ok(p.cost === 10000 && /Coup II : Bourdon/.test(p.sub), 'arme au palier I : l’offrande paie le coup II (10 000)', p);
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput();
      run(2.0, true);                // coup II posé, F maintenue mais 2 000 points : pas de coup III
      ok(a.tier === 2 && G.points === 2000, 'premier coup : palier II', { tier: a.tier, pts: G.points });
      run(1.0, true);
      ok(a.state === 'raise' && a.tier === 2 && G.points === 2000, 'pas assez de points pour le coup III : le rituel s’arrête', { st: a.state, pts: G.points });
      run(1.0);
      ok(a.state === 'ready', 'arme prête', a.state);
      run(10.1);
      ok(a.state === 'rest' && !a.weapon && !Arms.slots.some((s) => s && s.id === 'mp40') && !document.getElementById('hint').hidden && document.getElementById('hint').textContent === 'La cloche a gardé MP40 Brûleur · Bourdon',
        'non reprise en 10 s : « La cloche a gardé MP40 Brûleur · Bourdon », l’arme est perdue', document.getElementById('hint').textContent);
      return out;
    })).forEach(report);

    // ------------------------------------------------- zombies : onde de choc, appel des morts, Résonance, Minuit
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec, holdF = false) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { Input.keys.KeyF = holdF; __realUpdate(1 / 60); endFrameInput(); } Input.keys.KeyF = false; };
      const a = Features.amp;
      const spawn = (x, z, speed = 0.5) => {
        const k = node(0, Math.floor(x), Math.floor(z));
        const zb = spawnZombie({ riser: true, x, z, li: 0, k, zone: zoneOf[k] }, 1e6);
        zb.state = 'chase'; zb.t = 0; zb.pos.y = zb.gy; zb.k = k; zb.speed = speed; zb.speedType = 'walk';
        return zb;
      };
      clearZombies();
      const near = spawn(23.2, 10.6), near2 = spawn(29.6, 10.2), mid = spawn(33.5, 9.5), far = spawn(40.5, 22.5);
      run(0.1);
      G.points = 50000;
      __zs.give('thompson', 0);
      run(0.5);
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput();
      run(0.9, true);
      ok(near.knockT > 1 && near2.knockT > 1 && mid.knockT === 0, 'coup I : les zombies à moins de 5 m sont renversés 1,5 s, pas les autres', [near.knockT, near2.knockT, mid.knockT]);
      ok(near.called && mid.called && far.called && far.speedType === 'run' && far.speed >= SPEEDS.run[0] * 0.99, 'appel des morts : à moins de 30 m, ils courent vers la cloche', { far: [far.speedType, far.speed] });
      run(0.3, true);
      ok(near.knockK > 0.9, 'renversé : il est à terre (pose couchée)', near.knockK);
      const lie = rayHitZombie(near, near.pos.x, 1.6, near.pos.z + 4, 0, 0, -1, 0);
      ok(lie < 0, 'à terre : un tir à hauteur de poitrine passe au-dessus de lui', lie);
      run(1.5);
      ok(near.knockT === 0 && near.knockK === 0, 'il se relève au bout de 1,5 s', near.knockT);
      run(1.5);
      ok(a.state === 'raise' || a.state === 'ready', 'relève', a.state);
      ok(!far.called && far.speedType === 'walk' && far.speed === 0.5, 'fin du rituel : les zombies appelés reprennent leur allure', { t: far.speedType, s: far.speed });
      run(1.0);
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput(); Input.keys.KeyF = false;
      // Résonance (palier II et plus) : chaque élimination fait chanceler ceux à 3 m
      clearZombies();
      __zs.give('bar', 2);
      const A = spawn(30, 10.4), B = spawn(31.6, 10.6), C = spawn(35.5, 10.4);
      run(0.05);
      damageZombie(A, 1e9, { kind: 'bullet', dx: 1, dz: 0, slot: curSlot() });
      ok(B.reelT > 0.5 && B.stagger > 0.5 && C.reelT === 0, 'Résonance : une élimination fait chanceler les zombies à 3 m (pas plus loin)', [B.reelT, B.stagger, C.reelT]);
      // Minuit (palier III) : toutes les 12 éliminations, tout est renversé à 6 m du joueur
      clearZombies();
      __zs.give('ppsh', 3);
      const s3 = curSlot();
      const N = spawn(26.5, 10.9), F = spawn(36.5, 10.4);
      for (let i = 0; i < 11; i++) { const d = spawn(44 + (i % 3), 15 + i); damageZombie(d, 1e9, { kind: 'bullet', dx: 1, dz: 0, slot: s3 }); }
      ok(N.knockT === 0, '11 éliminations : pas encore minuit', N.knockT);
      const d12 = spawn(44, 26); damageZombie(d12, 1e9, { kind: 'bullet', dx: 1, dz: 0, slot: s3 });
      ok(N.knockT > 1 && F.knockT === 0 && s3.kills === 12, 'la 12e élimination sonne minuit : renversés à 6 m du joueur, pas au-delà', [N.knockT, F.knockT, s3.kills]);
      return out;
    })).forEach(report);

    // ------------------------------------------------- le douzième coup de la partie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec, holdF = false) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { Input.keys.KeyF = holdF; __realUpdate(1 / 60); endFrameInput(); } Input.keys.KeyF = false; };
      const a = Features.amp, it = Features.interactables.find((i) => i.kind === 'amp');
      const spawn = (x, z) => {
        const k = node(0, Math.floor(x), Math.floor(z));
        const zb = spawnZombie({ riser: true, x, z, li: 0, k, zone: zoneOf[k] }, 1e6);
        zb.state = 'chase'; zb.t = 0; zb.pos.y = zb.gy; zb.k = k; zb.speed = 0.01;
        return zb;
      };
      clearZombies();
      __zs.tp(it.x, it.z, -Math.PI / 2);          // regard vers l'est
      const seen = spawn(33.5, 9.6), behind = spawn(19.5, 9.6), walled = spawn(34.5, 14.5);
      run(0.1);
      G.glasTolls = 11; G.glasMidnight = false;
      G.points = 50000;
      __zs.give('g43', 0);
      run(0.5);
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput();
      run(0.9);
      ok(G.glasTolls === 12 && G.glasMidnight, '12e coup de la partie : la cloche sonne minuit', G.glasTolls);
      run(0.6);
      ok(!seen.alive && behind.alive && walled.alive && !document.getElementById('banner').hidden && document.getElementById('banner-title').textContent === 'Minuit',
        'minuit : les zombies à l’écran s’effondrent (pas ceux derrière le joueur ni derrière un mur)', { seen: seen.alive, behind: behind.alive, walled: walled.alive });
      run(4);
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput(); Input.keys.KeyF = false;
      const again = spawn(33.5, 9.8);
      const s = curSlot();
      G.points = 50000;
      run(0.2);
      Input.keys.KeyF = true; Input.down.KeyF = true; __realUpdate(1 / 60); endFrameInput();
      run(1.5);
      ok(G.glasTolls === 13 && again.alive, 'une fois par partie : le 13e coup ne recommence pas', { tolls: G.glasTolls, alive: again.alive, s: s && s.id });
      run(4);
      return out;
    })).forEach(report);

    // ------------------------------------------------- interface : mod de munition à gauche des munitions
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { __realUpdate(1 / 60); endFrameInput(); } };
      const $id = (id) => document.getElementById(id);
      const box = (o) => { const b = o.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const textBox = (el) => { const g = document.createRange(); g.selectNodeContents(el); return box(g); };
      const same = (a, b) => ['l', 't', 'r', 'b'].every((k) => Math.abs(a[k] - b[k]) < 0.5);
      const mod = $id('w-mod'), nameEl = $id('w-name');
      const view = (tier) => {
        __zs.give('mp40', tier); run(0.1); HUD.weapon();
        const b = mod.querySelector('b');
        return { name: nameEl.textContent, up: nameEl.classList.contains('up'), hidden: mod.hidden, text: mod.textContent.replace(/ /g, ' '),
          bold: b ? b.textContent : null, nameBox: textBox(nameEl) };
      };
      ok(!$id('hud').hidden, 'HUD affiché');
      const v = [0, 1, 2, 3].map(view);
      ok(v[0].hidden && v[0].name === 'MP40' && !v[0].up, 'arme de base : pas de ligne de mod de munition', v[0]);
      ok(v[1].hidden && v[1].name === 'MP40 Brûleur' && v[1].up, 'palier I (Tocsin) : nom doré, pas de mod de munition', v[1]);
      ok(!v[2].hidden && v[2].text === 'Mod de munition : Résonance' && v[2].bold === 'Résonance' && v[2].name === 'MP40 Brûleur',
        'palier II : « Mod de munition : Résonance », le nom reste « MP40 Brûleur »', v[2]);
      ok(!v[3].hidden && v[3].text === 'Mod de munition : Minuit' && v[3].bold === 'Minuit' && v[3].name === 'MP40 Brûleur',
        'palier III : « Mod de munition : Minuit », le nom reste « MP40 Brûleur »', v[3]);
      ok(same(v[1].nameBox, v[2].nameBox) && same(v[1].nameBox, v[3].nameBox), 'le nom de l’arme ne bouge pas d’un palier à l’autre', v.map((x) => x.nameBox));
      const modB = box(mod), magB = box($id('w-mag')), ammoB = box($id('w-ammo')), nameB = textBox(nameEl);
      ok(modB.r < magB.l && magB.l - modB.r > 12 && magB.l - modB.r < 30 && modB.t >= nameB.b - 0.5 && modB.b <= ammoB.b + 0.5 && Math.abs(modB.b - magB.b) < 6,
        'place : à gauche du chargeur (20 px), sur la ligne des munitions, sous le nom', { modB, magB, nameB });
      mod.hidden = true;
      const nameWithout = textBox(nameEl);
      mod.hidden = false;
      ok(same(nameWithout, nameB), 'la ligne du mod ne déplace pas le nom', { nameWithout, nameB });
      const s = curSlot(), keep = [s.mag, s.res];
      s.mag = 3; s.res = 7; HUD.weapon();
      const modLow = box(mod);
      s.mag = keep[0]; s.res = keep[1]; HUD.weapon();
      ok(same(modLow, modB), 'le mod ne bouge pas quand le compte baisse (48 → 3, 384 → 7)', { modLow, modB });
      ok(wstat(s, 'name') === 'MP40 Brûleur · Glas', 'invites (munitions, cloche) : nom complet avec le palier', wstat(s, 'name'));
      Arms.slots = [null, null]; Arms.cur = 0; HUD.weapon();
      ok(mod.hidden && nameEl.textContent === 'Mains nues', 'mains nues : pas de mod de munition');
      return out;
    })).forEach(report);

    // ------------------------------------------------- sauvegarde, finitions, Mod Tools
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const run = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { __realUpdate(1 / 60); endFrameInput(); } };
      Arms.slots = [null, null]; Arms.cur = 0;
      __zs.give('mp40', 2);
      const save = serializeGame();
      ok(save.slots.some((x) => x && x.id === 'mp40' && x.tier === 2) && save.glas.tolls === G.glasTolls && save.glas.midnight === true, 'sauvegarde : palier de chaque arme, coups sonnés, minuit déjà sonné', save.glas);
      Arms.slots = [null, null];
      restoreSave(save);
      const s = Arms.slots.find((x) => x && x.id === 'mp40');
      ok(s && s.tier === 2 && wstat(s, 'name') === 'MP40 Brûleur · Bourdon' && G.glasMidnight, 'reprise de la sauvegarde : MP40 Brûleur · Bourdon', s);
      Arms.cur = Arms.slots.indexOf(s); HUD.weapon();
      ok(document.getElementById('w-mod').textContent.replace(/ /g, ' ') === 'Mod de munition : Résonance' && document.getElementById('w-name').textContent === 'MP40 Brûleur',
        'reprise : le HUD montre « Mod de munition : Résonance »', document.getElementById('w-mod').textContent);
      restoreSave(Object.assign({}, save, { slots: [{ id: 'thompson', up: true, mag: 50, res: 300 }, null], glas: undefined }));
      const o = Arms.slots[0];
      ok(o && o.tier === 1 && o.mag === 45 && wstat(o, 'name') === 'Thompson Chicago Rouge' && G.glasTolls === 0, 'ancienne sauvegarde (Pack-A-Punch) : l’arme améliorée vaut le palier I', o);
      // finitions
      const M = GLAS_R.M, mats = (g) => { const set = new Set(); g.traverse((m) => { if (m.material) { set.add(m.material); if (m.material.userData.from) set.add(m.material.userData.from); } }); return set; };
      const g1 = mats(buildGun('stg44', 1)), g2 = mats(buildGun('stg44', 2)), g3 = mats(buildGun('stg44', 3)), g0 = mats(buildGun('stg44', 0));
      ok(g1.has(M.gun1) && g1.has(M.gunBand) && !g1.has(M.voco), 'Tocsin : airain poli, cerclages gravés');
      ok(g2.has(M.gun2) && g2.has(M.voco) && !g2.has(M.gunBand), 'Bourdon : patine vert-de-gris, plaque VOCO allumée');
      ok(g3.has(M.gun3) && g3.has(M.voco) && g3.has(M.gunIron) && M.gun3.emissiveIntensity > 0.5, 'Glas : airain noirci aux fêlures d’or, agrafes de fer');
      ok(!g0.has(M.gun1) && !g0.has(M.gun2) && !g0.has(M.gun3) && g0.has(gunBaseMats().blue), 'arme de base : finition d’origine (acier bleui)');
      // la boîte mystère ne donne pas l'arme posée sur le berceau
      const a = Features.amp;
      a.weapon = { id: 'ppsh', from: 0 }; a.state = 'ready';
      const picks = new Set();
      for (let i = 0; i < 400; i++) picks.add(pickBoxWeapon());
      ok(!picks.has('ppsh'), 'boîte mystère : jamais l’arme posée sur le berceau');
      resetFeatures();
      ok(a.state === 'mute' && !a.weapon && Math.abs(a.bell.position.y - GLAS.lipUp) < 1e-6, 'nouvelle partie : la cloche redevient muette, levée, sans arme');
      // Mod Tools : avertissements
      const v7 = validateMap(normalizeMap(BUNKER7));
      ok(![...v7.errors, ...v7.warnings].some((p) => /Glas/.test(p.msg)), 'Bunker 7 : aucun avertissement sur Le Glas');
      const near = JSON.parse(JSON.stringify(BUNKER7)); near.id = 'glas-mur'; near.amp = { cells: [[13, 5], [14, 5]], face: [0, 1] };
      const vn = validateMap(normalizeMap(near));
      ok(vn.warnings.some((p) => /Le Glas\) a besoin de 6 × 3 m de sol libre/.test(p.msg)), 'Mod Tools : Le Glas contre un mur → « a besoin de 6 × 3 m de sol libre »', vn.warnings.map((p) => p.msg));
      const up = JSON.parse(JSON.stringify(BUNKER7)); up.id = 'glas-etage'; up.floors = [{ lv: 1, grid: BUNKER7.grid }];
      const vu = validateMap(normalizeMap(up));
      ok(vu.warnings.some((p) => /sous un étage : son beffroi de 5,6 m sera réduit/.test(p.msg)), 'Mod Tools : sous un étage → « son beffroi de 5,6 m sera réduit »', vu.warnings.map((p) => p.msg));
      return out;
    })).forEach(report);

    // ------------------------------------------------- sous un étage : machine réduite, plafond fermé
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      window.update = window.__realUpdate; window.__hold = false;
      clearZombies();
      G.state = 'menu';
      const up = JSON.parse(JSON.stringify(BUNKER7)); up.id = 'glas-etage'; up.floors = [{ lv: 1, grid: BUNKER7.grid }];
      loadMap(normalizeMap(up));
      const a = Features.amp;
      const k = node(levelIndex(0), 26, 7);
      ok(a && !a.open && a.s < 0.75 && a.s > 0.7 && !a.roof.visible && ceilOn[k] === 1 && CUR.glasOpen === null, 'sous un étage : plafond fermé, beffroi réduit (×0,73) pour tenir sous 3,5 m', a && { s: a.s, open: a.open });
      a.group.updateMatrixWorld(true);
      const box = new THREE.Box3();
      a.group.traverseVisible((o) => { if (o.isMesh && !o.isInstancedMesh && !o.material.transparent) box.expandByObject(o); });
      const top = box.max.y;
      ok(top < WALL_H, `machine réduite : ${top.toFixed(2).replace('.', ',')} m de haut, sous le plafond de 3,5 m`, top);
      loadMap(MAPS.byId.bunker7 || normalizeMap(BUNKER7));
      ok(Features.amp && Features.amp.open && Features.amp.s === 1, 'retour à Bunker 7 : taille réelle, plafond ouvert');
      return out;
    })).forEach(report);

    // ------------------------------------------------- rendu (programmes compilés)
    const diag = await game.evaluate(() => {
      showScreen('menu');
      renderEnabled = true;
      render();
      return { programs: renderer.info.programs.length, bad: renderer.info.programs.filter((p) => p.diagnostics && !p.diagnostics.runnable).map((p) => p.name) };
    });
    report({ ok: diag.bad.length === 0, label: `rendu : ${diag.programs} programmes de matières compilés, aucun en erreur`, extra: diag });
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Le Glas : machine, rituel, paliers et effets conformes à la planche.');
  process.exit(failures ? 1 : 0);
})();
