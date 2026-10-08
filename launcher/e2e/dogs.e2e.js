'use strict';
/* Manches de chiens (Le Molosse, fiche N°03), dans la fenêtre du jeu du launcher : tirage (1 ou 2
   manches de chiens par tranche de 10, jamais aux manches 1 et 2, au moins 3 manches d'écart), nombre
   de chiens (6 à la première, puis +2) et PV qui suivent la manche ; apparition dans un éclair, dans
   les pièces ouvertes seulement, par meutes ; morsure, bond annoncé par un grognement (un pas de côté
   et il rate), explosion à la mort (2 m), munitions max lâchées par le dernier ; tirs (tête), sons,
   sauvegarde, relevés, Le Glas ; fiche et animations de l'écran Modèles.
     xvfb-run -a node e2e/dogs.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-chiens-'));
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

    // ------------------------------------------------------- règles et tirage
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(ZOMBIE_TYPES.map((t) => t.id).join(' ') === 'fantassin lacere savant sentinelle' && !ZOMBIE_TYPE_BY_ID.molosse,
        'les types de pièce (cartes, Mod Tools) restent les quatre zombies : le chien n’en fait pas partie');
      const d = DOG_TYPE;
      ok(SPECIMEN_TYPES.length === 5 && SPECIMEN_TYPES[4] === d && d.num === '03' && d.name === 'Le Molosse' && d.cls === 'Meute' && d.tag === 'Manche spéciale'
        && d.mult.hp === 0.5 && d.mult.speed === 2 && d.mult.damage === 0.7, 'fiche N°03 : Meute, manche spéciale, PV ×0,5, vitesse ×2, dégâts ×0,7', d);
      // tirage sur 3 000 parties de 100 manches
      const bad = [], perBlock = { 0: 0, 1: 0, 2: 0, 3: 0 }, seenIn1 = new Set();
      const G0 = G.dogs;
      for (let g = 0; g < 3000; g++) {
        G.dogs = freshDogs();
        ensureDogPlan(100);
        const p = G.dogs.plan.slice().sort((a, b) => a - b);
        for (let b = 0; b < 10; b++) {
          const n = p.filter((r) => r > b * 10 && r <= b * 10 + 10).length;
          perBlock[Math.min(n, 3)]++;
          if (n < 1 || n > 2) bad.push(['tranche', g, b, n]);
        }
        p.forEach((r, i) => { if (r < 3) bad.push(['tôt', r]); if (i && r - p[i - 1] < 3) bad.push(['écart', p[i - 1], r]); if (r <= 10) seenIn1.add(r); });
      }
      G.dogs = G0;
      const blocks = 30000;
      ok(bad.length === 0, '3 000 parties : 1 ou 2 manches de chiens dans chaque tranche de 10, jamais aux manches 1 et 2, toujours 3 manches d’écart au moins (d’une tranche à l’autre aussi)', bad.slice(0, 5));
      ok(perBlock[1] / blocks > 0.3 && perBlock[2] / blocks > 0.3, `une manche de chiens ${Math.round(perBlock[1] / blocks * 100)} % du temps, deux ${Math.round(perBlock[2] / blocks * 100)} %`, perBlock);
      ok([3, 4, 5, 6, 7, 8, 9, 10].every((r) => seenIn1.has(r)), 'manches 1 à 10 : chacune des manches 3 à 10 peut être tirée', [...seenIn1].sort((a, b) => a - b));
      ok(dogsForRound(0) === 6 && dogsForRound(1) === 8 && dogsForRound(2) === 10 && dogsForRound(9) === 24 && dogsForRound(30) === 24, 'chiens : 6 à la première manche de chiens, 8, 10… 24 au plus');
      ok([3, 5, 10, 20, 30].every((r) => dogHpForRound(r) === Math.round(zombieHpForRound(r) / 2)) && dogHpForRound(20) > dogHpForRound(10) && dogHpForRound(10) > dogHpForRound(3),
        `PV : la moitié d’un zombie de la même manche (${[3, 10, 20].map(dogHpForRound).join(', ')} aux manches 3, 10, 20)`);
      return out;
    })).forEach(report);

    // ----------------------------------------------------------- en partie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      renderEnabled = false;
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundT = 1e9;
      const startZones = new Set(G.activeZones);
      // portes fermées : les chiens n'apparaissent que dans la pièce de départ
      __zs.dogs(5);
      __zs.step(12, 1 / 60);
      ok(G.round === 5 && G.dogRound && G.total === 6 && G.zombieHp === dogHpForRound(5), 'manche 5 forcée en manche de chiens : 6 chiens, PV de la manche', { round: G.round, total: G.total, hp: G.zombieHp });
      const banner = document.getElementById('banner');
      ok(document.getElementById('banner-title').textContent === 'La meute' && banner.classList.contains('dogs') && document.getElementById('round').classList.contains('dogs'),
        'bandeau « La meute · Manche spéciale » et compteur de manche ambre', { title: document.getElementById('banner-title').textContent, cls: banner.className });
      let maxAlive = 0, zombies = 0;
      const where = [];
      for (let i = 0; i < 60 * 12; i++) {
        __zs.step(1, 1 / 60);
        let a = 0;
        for (const z of Zombies.list) {
          if (!z.dog) zombies++;
          else if (z.alive) { a++; if (!where.includes(z.id)) { where.push(z.id); where.push(zoneOf[z.k]); } }
        }
        maxAlive = Math.max(maxAlive, a);
      }
      const zonesSeen = where.filter((v, i) => i % 2 === 1);
      ok(G.spawned >= 4 && G.spawned <= 6 && maxAlive <= DOGS.alive && zombies === 0, `une première meute de ${G.spawned} chiens, aucun zombie`, { spawned: G.spawned, maxAlive, zombies });
      ok(zonesSeen.length > 0 && zonesSeen.every((zi) => startZones.has(zi)), 'portes fermées : les chiens tombent dans la pièce de départ seulement', { zonesSeen, start: [...startZones] });
      // portes ouvertes : des chiens partout où l'on peut aller, jamais au-delà
      clearZombies();
      __zs.openAll();
      const spots = [];
      for (let i = 0; i < 40; i++) { const k = pickDogSpawn(); if (k >= 0) spots.push(k); }
      ok(spots.length === 40 && spots.every((k) => walkNode(k) && G.activeZones.has(zoneOf[k]) && flow[k] >= 4 && flow[k] < 1e8)
        && spots.filter((k) => flow[k] >= DOGS.spawnDist[0] && flow[k] <= DOGS.spawnDist[1]).length >= 36,
        'éclairs : sur le sol des pièces ouvertes, presque toujours à 6 à 16 cases de marche du joueur', spots.slice(0, 6).map((k) => [zoneOf[k], flow[k]]));
      return out;
    })).forEach(report);

    // ------------------------------------------- morsure, bond, explosion
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      clearZombies();
      G.roundState = 'pre'; G.roundT = 1e9; G.dogRound = false;
      __zs.god(false);
      // une ligne droite dégagée depuis le joueur
      const p = player.pos;
      let best = 0, bestT = 0;
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        let t = 0;
        while (t < 12 && losClear(player.k, p.x, p.z, p.x + Math.sin(a) * (t + 0.5), p.z + Math.cos(a) * (t + 0.5), 0.6)) t += 0.5;
        if (t > bestT) { bestT = t; best = a; }
      }
      const fx = Math.sin(best), fz = Math.cos(best), sx = fz, sz = -fx;
      const put = (dist, state = 'chase') => {
        const x = p.x + fx * dist, z = p.z + fz * dist, k = nearestNode(x, z, player.gy);
        const dg = spawnDog(k, 1e6);
        dg.pos.set(x, player.gy, z); dg.k = k; dg.gy = player.gy; dg.yaw = Math.atan2(-fx, -fz);
        setDog(dg, state);
        return dg;
      };
      const heal = () => { player.hp = player.maxHp = 1000; player.down = false; };
      // morsure au contact : 21 dégâts (30 × 0,7)
      heal();
      let dg = put(1.0, 'bite');
      dg.leapCd = 99;
      let hp0 = player.hp;
      for (let i = 0; i < 40; i++) __zs.step(1, 1 / 60);
      ok(Math.abs(hp0 - player.hp - 21) < 1e-6, `morsure : ${hp0 - player.hp} dégâts (30 × 0,7)`, { lost: hp0 - player.hp });
      // bond : grognement, puis il vise l'endroit où vous étiez
      clearZombies(); heal();
      dg = put(Math.min(4.5, bestT - 1));
      dg.leapCd = 0;
      const calls = [];
      const realGrowl = Sound.dogGrowl;
      Sound.dogGrowl = (pos) => { calls.push('grognement'); realGrowl(pos); };
      DOGS.bound.chance = 1;
      hp0 = player.hp;
      let launched = false;
      for (let i = 0; i < 120 && !(launched && dg.dstate !== 'bound'); i++) { __zs.step(1, 1 / 60); if (dg.dstate === 'bound') launched = true; }
      ok(calls[0] === 'grognement' && launched && Math.abs(hp0 - player.hp - 21) < 1e-6, 'bond : annoncé par un grognement, il vous mord en vol (21)', { calls, launched, lost: hp0 - player.hp });
      // un pas de côté pendant le ramassé : il bondit là où vous étiez et vous rate
      clearZombies(); heal();
      placePlayer(p.x, p.z);
      dg = put(Math.min(4.5, bestT - 1));
      dg.leapCd = 0;
      hp0 = player.hp;
      let side = false, missLaunched = false;
      for (let i = 0; i < 150; i++) {
        __zs.step(1, 1 / 60);
        if (dg.dstate === 'windup' && dg.st > DOGS.bound.windup - 0.05 && !side) {
          side = true;
        }
        if (dg.dstate === 'bound') {
          missLaunched = true;
          if (side && !dg.__moved) { dg.__moved = true; player.pos.x += sx * 1.6; player.pos.z += sz * 1.6; settleBody(player, player.radius); }
        }
        if (missLaunched && dg.dstate !== 'bound') break;
      }
      ok(missLaunched && player.hp === hp0, 'un pas de côté au départ du bond : il vous rate', { missLaunched, lost: hp0 - player.hp, state: dg.dstate });
      Sound.dogGrowl = realGrowl;
      DOGS.bound.chance = 0.55;
      // explosion à la mort : jusqu'à 30 au contact, plus rien à 2 m, rien avec la Bombe
      const boom = (dist, kind) => {
        clearZombies(); heal(); placePlayer(p.x, p.z);
        const d0 = put(dist, 'chase');
        d0.leapCd = 99;
        animateDog(d0, 0);
        const h0 = player.hp;
        killZombie(d0, { kind, dx: fx, dz: fz, force: 0.5 });
        return h0 - player.hp;
      };
      const near = boom(0.9, 'bullet'), far = boom(3.2, 'bullet'), nuke = boom(0.9, 'nuke');
      ok(near > 8 && near < 25 && far === 0 && nuke === 0, `explosion : ${near.toFixed(1)} dégâts à 0,9 m, rien à 3,2 m, rien avec la Bombe`, { near, far, nuke });
      __zs.god(true);
      return out;
    })).forEach(report);

    // ------------------------------------------ fin de manche, récompense
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      clearZombies();
      for (const pu of Powerups.list) scene.remove(pu.m);
      Powerups.list.length = 0;
      G.dogs.n = 0;
      // bonus créés pendant la manche (le joueur ramasse aussitôt ceux qui tombent à ses pieds)
      const drops = [], realDrop = window.spawnPowerup;
      window.spawnPowerup = (type, x, z, gy) => { drops.push({ type, x, z }); return realDrop(type, x, z, gy); };
      __zs.dogs(G.round + 1);
      __zs.step(12, 1 / 60);
      const r0 = G.round, pts0 = G.points, k0 = Life.data.types.molosse || 0, kills0 = G.stats.kills;
      const seen = [];
      let guard = 0, last = null;
      while (G.roundState === 'active' && guard++ < 6000) {
        const z = Zombies.list.find((q) => q.dog && q.alive);
        if (z) {
          if (G.killed + 1 >= G.total) last = { x: z.pos.x, z: z.pos.z };
          else seen.push(drops.length);
          damageZombie(z, 1e9, { kind: 'bullet', dx: 0, dz: 1, force: 0.5 });
        }
        __zs.step(1, 1 / 60);
      }
      window.spawnPowerup = realDrop;
      ok(G.roundState === 'intermission' && G.killed === 6, 'les 6 chiens tués : la manche se termine', { state: G.roundState, killed: G.killed });
      ok(seen.every((n) => n === 0) && drops.length === 1 && drops[0].type === 'ammo' && last && Math.hypot(drops[0].x - last.x, drops[0].z - last.z) < 0.01,
        'aucun bonus au hasard ; munitions max lâchées par le dernier chien, là où il meurt', { seen, drops });
      ok(G.stats.kills - kills0 === 6 && (Life.data.types.molosse || 0) - k0 === 6 && G.points - pts0 === 6 * (RULES.pointsKill + RULES.pointsHit * 0),
        'points (+50 par chien) et relevés (éliminations de Molosses comptées à part)', { kills: G.stats.kills - kills0, molosse: (Life.data.types.molosse || 0) - k0, pts: G.points - pts0 });
      ok(G.dogs.n === 1 && !G.dogRound && !document.getElementById('round').classList.contains('dogs'), 'après la manche : une manche de chiens de plus au compteur, compteur de manche rouge');
      __zs.dogs(r0 + 3);
      __zs.step(12, 1 / 60);
      ok(G.dogRound && G.total === 8, 'manche de chiens suivante : 8 chiens', { total: G.total });
      // sauvegarde : la manche de chiens reprend telle quelle
      G.state = 'playing';
      const save = serializeGame();
      ok(save.dogs && save.dogs.plan.includes(G.round) && save.dogs.n === 1, 'sauvegarde : plan des manches de chiens et compteur', save.dogs);
      startGame(save);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true);
      G.roundT = 0.05;
      __zs.step(30, 1 / 60);
      ok(G.round === r0 + 3 && G.dogRound && G.total === 8, 'partie reprise : la même manche de chiens, 8 chiens', { round: G.round, dog: G.dogRound, total: G.total });
      const old = Object.assign({}, save, { dogs: undefined, round: 14 });
      startGame(old);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true);
      ok(G.dogs.n === 0 && G.dogs.plan.length === 0 && G.dogs.from === 14, 'sauvegarde d’avant les chiens : tirage à partir de la manche reprise');
      ensureDogPlan(30);
      ok(G.dogs.plan.every((r) => r >= 14) && G.dogs.plan.filter((r) => r > 20 && r <= 30).length >= 1, 'puis 1 ou 2 manches de chiens par tranche, comme d’habitude', G.dogs.plan);
      return out;
    })).forEach(report);

    // ------------------------------------------------- tirs, Glas, sons
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      clearZombies();
      G.roundState = 'pre'; G.roundT = 1e9; G.dogRound = false;
      __zs.openAll();
      const k = pickDogSpawn();
      const dg = spawnDog(k, 1000);
      setDog(dg, 'chase'); dg.st = 0;
      dg.yaw = 0;
      animateDog(dg, 0);
      const head = new THREE.Vector3(0, 0, 0.2).applyMatrix4(dg.rig.head.matrixWorld), body = new THREE.Vector3(0, -0.1, 0.1).applyMatrix4(dg.rig.chest.matrixWorld);
      const ray = (o, t) => { const d = t.clone().sub(o).normalize(); return { t: rayHitDog(dg, o.x, o.y, o.z, d.x, d.y, d.z, 0), head: _hitHead, leg: _hitLeg, arm: _hitArm }; };
      const front = ray(head.clone().add(new THREE.Vector3(0, 0.1, 5)), head);
      const flank = ray(body.clone().add(new THREE.Vector3(5, 0, 0)), body);
      const over = ray(body.clone().add(new THREE.Vector3(5, 0.6, 0)), body.clone().add(new THREE.Vector3(0, 0.6, 0)));
      ok(front.t > 0 && front.head && flank.t > 0 && !flank.head && !flank.leg && !flank.arm && over.t < 0, 'tirs : la tête de face, le flanc de côté (ni jambe ni bras), rien au-dessus du dos', { front, flank, over });
      const pts = G.points;
      damageZombie(dg, 10, { kind: 'bullet', dx: -1, dz: 0, force: 0.5 });
      ok(dg.alive && dg.flinch > 0.2 && G.points === pts + RULES.pointsHit && !dg.crawl && dg.gib === 0, 'touché : il sursaute (+10), ne rampe pas, rien ne s’arrache');
      killZombie(dg, { kind: 'bullet', head: true, dx: -1, dz: 0 });
      ok(G.points === pts + RULES.pointsHit + RULES.pointsHead && !dg.alive, 'tir à la tête mortel : +100');
      __zs.step(2, 1 / 60);
      ok(!Zombies.list.includes(dg) && ZR.free.includes(dg.slot), 'il disparaît dans son explosion (emplacement de rendu libéré)');
      // Le Glas : l'appel des morts laisse les chiens tels quels, l'onde les renverse un moment
      const d2 = spawnDog(pickDogSpawn(), 1000);
      setDog(d2, 'chase');
      const amp = { cx: d2.pos.x, cz: d2.pos.z, E: d2.gy, called: [] };
      const sp = d2.speed;
      glasCall(amp);
      ok(!d2.called && d2.speed === sp && amp.called.length === 0, 'Le Glas : l’appel des morts ne touche pas les chiens (ils courent déjà)');
      glasKnockdown(d2.pos.x, d2.pos.z, 3, 1.2, levelAtY(d2.gy + 0.1));
      __zs.step(6, 1 / 60);
      const stunned = d2.dstate === 'stun';
      __zs.step(120, 1 / 60);
      ok(stunned && d2.alive && d2.dstate !== 'stun', 'Le Glas : l’onde le renverse, il se relève', { stunned, state: d2.dstate });
      G.timers.insta = 5;
      damageZombie(d2, 1, { kind: 'bullet', dx: 1, dz: 0 });
      ok(!d2.alive, 'Mort instantanée : un tir suffit');
      G.timers.insta = 0;
      // sons : tous synthétisés, sans erreur
      Sound.init();
      const names = ['dogGrowl', 'dogSnarl', 'dogBark', 'dogSnap', 'dogBite', 'dogYelp', 'dogHowl', 'dogSpawn', 'dogExplode', 'dogPaws', 'dogRound', 'dogRoundEnd'];
      const broken = [];
      for (const n of names) { try { Sound[n](n.startsWith('dogRound') ? undefined : player.pos); } catch (e) { broken.push(`${n}: ${e.message}`); } }
      ok(names.every((n) => typeof Sound[n] === 'function') && broken.length === 0, `sons des chiens : ${names.length} sons synthétisés (apparition, grognement, aboiement, morsure, jappement, explosion…)`, broken);
      return out;
    })).forEach(report);

    // ---------------------------------------------------------- écran Modèles
    await game.evaluate(() => { quitToMenu(); });
    await game.waitForFunction(() => !document.getElementById('menu').hidden, null, { timeout: 30000 });
    await game.click('#btn-models');
    await game.waitForFunction(() => !document.getElementById('models').hidden);
    await game.click('#md-tabs [data-id="molosse"]');
    await new Promise((r) => setTimeout(r, 1200));
    const md = await game.evaluate(() => ({
      tabs: [...document.querySelectorAll('#md-tabs .md-tab')].map((b) => b.textContent),
      name: document.querySelector('#md-sheet .md-name').textContent, tag: document.querySelector('#md-sheet .md-tagline').textContent,
      text: document.getElementById('md-sheet').textContent, chips: [...document.querySelectorAll('#md-anims .md-chip')].map((b) => b.textContent),
      bars: [...document.querySelectorAll('#md-sheet .md-bar b')].map((b) => b.textContent),
      probe: __zs.modelProbe(), meshes: Models.spec.root.children.filter((m) => m.isInstancedMesh && m.count === m.userData.mul).length, parts: ZPARTS.molosse.length,
    }));
    report({ ok: md.tabs.length === 5 && md.tabs[4] === 'N°03Le Molosse', label: 'écran Modèles : cinquième onglet « N°03 Le Molosse »', extra: md.tabs });
    report({ ok: md.name === 'Le Molosse' && /N°03.*Meute.*Manche spéciale/.test(md.tag) && md.bars.join(' ') === '×0,5 ×2,0 ×0,7'
      && ['Chasse en meute de 4 à 6', 'bondit sur 5 m', 'un pas de côté et il te rate', '1 ou 2 par tranche de 10', 'Munitions max', 'pièces ouvertes'].every((t) => md.text.includes(t)),
      label: 'fiche du Molosse : en-tête, jauges, capacité et faiblesse de la planche, règles des manches de chiens', extra: { name: md.name, tag: md.tag, bars: md.bars } });
    report({ ok: ['Repos', 'Galop', 'Bond', 'Morsure', 'Apparition', 'Mort', 'Autre apparence', 'Tir dans le flanc'].every((t) => md.chips.includes(t)) && !md.chips.includes('Tir au bras'),
      label: 'fiche du Molosse : ses animations (galop, bond, morsure, apparition, mort) ; pas de « Tir au bras »', extra: md.chips });
    report({ ok: md.probe && md.probe.changed > 0.03 && md.meshes === md.parts, label: 'fiche du Molosse : modèle 3D dessiné (toutes ses pièces)', extra: { probe: md.probe, meshes: md.meshes, parts: md.parts } });
    for (const anim of ['gallop', 'bound', 'bite', 'spawn', 'death']) {
      await game.click(`#md-anims [data-anim="${anim}"]`);
      await new Promise((r) => setTimeout(r, 700));
      const st = await game.evaluate(() => ({ anim: Models.anim, probe: __zs.modelProbe() }));
      report({ ok: st.anim === anim && st.probe && st.probe.changed > 0.02, label: `écran Modèles : animation ${anim}`, extra: st });
    }
    await game.keyboard.press('Escape');
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Manches de chiens : règles, Molosse, sons et fiche conformes.');
  process.exit(failures ? 1 : 0);
})();
