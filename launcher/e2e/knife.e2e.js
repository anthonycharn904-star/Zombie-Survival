'use strict';
/* Couteau « Fossoyeur » ZS-1 (jeu 1.9.0), dans la fenêtre du jeu du launcher : module intégré au script
   du jeu (pas de variable globale, pas d'écoute du clavier : V et E passent par le jeu), ancien couteau
   retiré, bras aux couleurs des gants et des manches du jeu ; touché (150 dégâts quand la lame arrive,
   +10 points), élimination (+130, corps-à-corps), raté, élan doux vers le zombie, mur (bloque),
   fenêtre (porte, sans élan), chien, rampant, demi-angle de 60°, zombie verrouillé à l'appui ;
   enchaînement ; vue immobile ; arme baissée puis revenue ; pas de tir pendant le coup ; à terre ;
   nouvelle partie ; son dans le bus des effets du jeu ; rendu par-dessus la vue de l'arme.
     xvfb-run -a node e2e/knife.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-knife-'));
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
    // le module attrape les erreurs des règles du jeu (choisirCible, onHit) et les écrit dans la console
    game.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

    // ------------------------------------------------------- module, partie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(GAME_VERSION === '1.9.0', 'version du jeu inchangée : 1.9.0', GAME_VERSION);
      ok(typeof creerCouteauMelee === 'function' && window.creerCouteauMelee === undefined, 'module du couteau dans le script du jeu, sans variable globale');
      ok(Couteau && Couteau.sceneVue && Couteau.sceneVue !== vmScene && Couteau.rig.parent && !Couteau.rig.visible, 'bras au couteau dans sa propre vue, caché au repos');
      ok(Arms.knife === undefined && typeof knifeStrike === 'undefined' && typeof KNIFE_HOLD === 'undefined' && !('knife' in Sound), 'ancien couteau retiré (modèle, coup, prise, son)');
      ok(KNIFE.damage === 150 && KNIFE.range === 2.1 && KNIFE.cone === 0.5, 'règles : 150 dégâts, 2,1 m, 60° de part et d’autre du regard', KNIFE);
      // couleurs des bras du jeu (gant, manche), converties comme les matières du jeu
      let glove = false, sleeve = 0, tris = 0;
      Couteau.rig.traverse((m) => {
        if (m.geometry) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
        if (m.material === MAT.sleeve) sleeve++;
        const c = m.material && m.material.color;
        if (c && Math.abs(c.r - MAT.glove.color.r) + Math.abs(c.g - MAT.glove.color.g) + Math.abs(c.b - MAT.glove.color.b) < 1e-6) glove = true;
      });
      ok(glove && sleeve === 2, 'bras au couteau : gant à la couleur des gants du jeu, manche et revers dans la matière des manches du jeu (couleur et toile)', { glove, sleeve });
      ok(tris > 20000 && tris < 100000, `bras et couteau : ${Math.round(tris)} triangles (dessinés seulement pendant le coup)`);
      return out;
    })).forEach(report);

    await game.evaluate(() => {
      renderEnabled = false;
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9;
      clearZombies();
      if (__zs.dogs) __zs.dogs(false);
      __zs.step(60);
      // un endroit dégagé (2,6 m de sol plat tout autour) au rez-de-chaussée
      const li = levelIndex(0) >= 0 ? levelIndex(0) : 0;
      const flat = (k) => grid[k] === T.FLOOR && surfK[k] === 1 && stairAt[k] < 0 && Math.abs(surfH0[k] - LVY[li]) < 0.01;
      let spot = null;
      for (let z = 3; z < GH - 3 && !spot; z++) {
        for (let x = 3; x < GW - 3 && !spot; x++) {
          let open = true;
          for (let dz = -3; dz <= 3 && open; dz++) for (let dx = -3; dx <= 3 && open; dx++) if (dx * dx + dz * dz <= 10 && !flat(node(li, x + dx, z + dz))) open = false;
          if (open) spot = { x, z, li };
        }
      }
      window.__S = spot;
      window.__flat = flat;
      window.__press = (c) => { Input.keys[c] = true; Input.down[c] = true; };
      window.__run = (sec, fn) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { update(1 / 60); endFrameInput(); if (fn && fn((i + 1) / 60) === false) break; } };
      // retour au calme : couteau au repos, plus de zombies, joueur au milieu de l'endroit dégagé
      window.__fresh = (x = spot.x + 0.5, z = spot.z + 0.5, yaw = 0) => {
        Couteau.annuler(); KnifeLunge.m = 0; Arms.state = 'idle'; Arms.t = 0;
        clearZombies();
        player.down = false; player.downT = 0;
        placePlayer(x, z, LV[spot.li]); player.yaw = yaw; player.pitch = 0; player.vel.set(0, 0, 0);
        Input.lmb = false; Input.lmbDown = false;
        __run(0.4);
      };
      // un zombie immobile à dist m devant le joueur (ang : écart au regard, en radians)
      window.__zb = (dist, ang = 0, hp = 1000) => {
        const a = player.yaw - ang;
        const fx = -Math.sin(a), fz = -Math.cos(a);
        const x = player.pos.x + fx * dist, z = player.pos.z + fz * dist, gy = player.gy;
        const k = nearestNode(x, z, gy);
        const zb = spawnZombie({ riser: true, x, z, li: spot.li, k, zone: zoneOf[k] }, hp);
        zb.state = 'chase'; zb.t = 0; zb.pos.set(x, gy, z); zb.gy = gy; zb.k = k; zb.speed = 0.0001; zb.speedType = 'walk';
        zb.hp = zb.maxHp = hp; zb.lastX = x; zb.lastZ = z;
        zb.yaw = Math.atan2(player.pos.x - x, player.pos.z - z);
        return zb;
      };
      // un coup (ou plusieurs) : V aux instants donnés ; journal image par image
      window.__knife = (sec, presses = [0], zb = null, each = null) => {
        const log = [];
        let pi = 0;
        const n = Math.round(sec * 60);
        for (let i = 0; i < n; i++) {
          const t = i / 60;
          while (pi < presses.length && presses[pi] <= t + 1e-9) { __press('KeyV'); pi++; }
          if (each) each(t);
          update(1 / 60); endFrameInput(); Input.keys.KeyV = false;
          log.push({ t: (i + 1) / 60, st: Arms.state, occ: Couteau.occupe, res: Couteau.dernierResultat, br: Couteau.debug.branche(), low: Couteau.abaissementArme,
            hp: zb ? zb.hp : null, alive: zb ? zb.alive : null, pts: G.points, px: player.pos.x, pz: player.pos.z,
            rx: camera.rotation.x, ry: camera.rotation.y, rz: camera.rotation.z, fov: camera.fov, rig: Couteau.rig.visible });
        }
        return log;
      };
      window.__hits = (log, hp0) => { const h = []; let prev = hp0; for (const s of log) { if (s.hp < prev - 1e-6) h.push({ t: s.t, dmg: prev - s.hp }); prev = s.hp; } return h; };
      __fresh();
    });
    const spot = await game.evaluate(() => __S);
    report({ ok: !!spot, label: `endroit dégagé pour les essais (case ${spot && spot.x}, ${spot && spot.z})`, extra: spot });

    // ------------------------------------------------ son : contexte et bus du jeu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const bus = Sound.bus();
      ok(bus && bus.ctx && bus.sortie, 'le jeu prête son contexte audio et son bus des effets');
      // (avant le premier son du couteau : c'est là que le module se branche)
      const AC0 = window.AudioContext, WAC0 = window.webkitAudioContext, made = [];
      window.AudioContext = function (...a) { const c = new AC0(...a); made.push(c); return c; };
      window.webkitAudioContext = window.AudioContext;
      const con = AudioNode.prototype.connect, links = [];
      AudioNode.prototype.connect = function (to, ...r) { links.push([this, to]); return con.call(this, to, ...r); };
      let err = null;
      try { for (const n of ['sortie', 'elan', 'impact', 'torsion', 'arrachage', 'secoue', 'rate', 'moulinet', 'rangement']) Couteau.debug.jouer(n); } catch (e) { err = String(e); }
      AudioNode.prototype.connect = con; window.AudioContext = AC0; window.webkitAudioContext = WAC0;
      const toBus = links.filter(([from, to]) => to === bus.sortie);
      ok(!err && made.length === 0, '9 sons du couteau sans nouveau contexte audio', { err, made: made.length });
      ok(toBus.length === 1 && toBus[0][0].gain && Math.abs(toBus[0][0].gain.value - KNIFE.volume) < 1e-6,
        `sons branchés sur le bus des effets du jeu (volume général, son étouffé), niveau ${KNIFE.volume}`, { n: toBus.length });
      return out;
    })).forEach(report);

    // --------------------------------------------- clavier : V et E par le jeu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v' }));
      const direct = Couteau.occupe;
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV', key: 'v' }));
      update(1 / 60); endFrameInput();
      ok(!direct && Couteau.occupe && Arms.state === 'knife', 'V : le module n’écoute pas le clavier, le jeu lance le coup', { direct, occ: Couteau.occupe, st: Arms.state });
      __run(1.2);
      ok(!Couteau.occupe && Arms.state === 'idle' && !Couteau.rig.visible, 'puis couteau rangé, arme en main', { st: Arms.state });
      __press('KeyE'); __run(0.1);
      ok(Couteau.occupe && Arms.state === 'knife', 'E : coup de couteau aussi (comme avant)');
      __run(1.2);
      return out;
    })).forEach(report);

    // ------------------------------------------------------------ touché
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zb = __zb(1.1);
      const p0 = G.points, x0 = player.pos.x, z0 = player.pos.z, shots0 = G.stats.shots || 0;
      Arms.root.updateMatrixWorld(true);
      const v = new THREE.Vector3(), gunY = () => { updateViewmodel(0); Arms.root.updateMatrixWorld(true); return Arms.gun.getWorldPosition(v).project(vmCamera).y; };
      const idleY = gunY();
      let lowY = Infinity;
      const log = __knife(1.2, [0], zb, (t) => {
        // gâchette tenue pendant le coup : pas de tir
        if (t > 0.08 && t < 0.5) { Input.lmb = true; if (t < 0.1) Input.lmbDown = true; } else Input.lmb = false;
        if (Arms.state === 'knife') lowY = Math.min(lowY, gunY());
      });
      Input.lmb = false;
      const hits = __hits(log, 1000);
      ok(hits.length === 1 && hits[0].dmg === 150, `un coup, 150 dégâts (${hits.map((h) => h.dmg).join(', ')})`, hits);
      ok(hits.length && Math.abs(hits[0].t - Couteau.debug.contact.touche) < 0.02, `dégâts quand la lame arrive : ${hits.length ? hits[0].t.toFixed(3) : '?'} s après l'appui (${Couteau.debug.contact.touche} s)`);
      ok(G.points - p0 === 10, `+10 points (zombie touché, pas tué) : ${G.points - p0}`);
      ok(log.some((s) => s.res === 'touche') && log.every((s) => s.br === 'touche'), 'animation « touché » de bout en bout');
      ok(Math.hypot(player.pos.x - x0, player.pos.z - z0) < 0.01, 'zombie à 1,1 m : pas d’élan');
      const dev = Math.max(...log.map((s) => Math.max(Math.abs(s.rx - log[0].rx), Math.abs(s.ry - log[0].ry), Math.abs(s.rz - log[0].rz), Math.abs(s.fov - log[0].fov))));
      ok(dev < 1e-9, 'la vue ne bouge pas (ni secousse, ni champ de vision)', dev);
      const end = log.findIndex((s) => !s.occ);
      ok(end > 0 && log[end].t > 0.8 && log[end].t < 1.0 && log[end + 1].st === 'idle', `coup terminé en ${end > 0 ? log[end].t.toFixed(2) : '?'} s, arme en main à l'image suivante`, end > 0 && [log[end].st, log[end + 1].st]);
      ok(Math.max(...log.map((s) => s.low)) > 0.999 && lowY < -1, `arme baissée hors de la vue pendant le coup (centre de l'arme à y = ${lowY.toFixed(2)}, ${idleY.toFixed(2)} au repos)`, { lowY, idleY });
      __run(0.6);
      ok(Math.abs(gunY() - idleY) < 0.04, 'puis arme revenue à sa place', { now: gunY(), idleY });
      ok((G.stats.shots || 0) === shots0, 'gâchette tenue pendant le coup : pas de tir', G.stats.shots);
      return out;
    })).forEach(report);

    // ----------------------------------------------------- élimination, raté
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zb = __zb(1.1, 0, 150);
      const p0 = G.points, k0 = G.stats.kills, m0 = Life.on ? Life.data.killsMelee : 0;
      __knife(1.0, [0], zb);
      ok(!zb.alive && zb.deathKind === 'knife', 'zombie à 150 PV : tué au couteau', { alive: zb.alive, kind: zb.deathKind });
      ok(G.points - p0 === 130 && G.stats.kills - k0 === 1, `+130 points (élimination au couteau) : ${G.points - p0}`);
      ok(!Life.on || Life.data.killsMelee - m0 === 1, 'compté dans les éliminations au corps-à-corps', Life.on && Life.data.killsMelee - m0);
      // personne devant : raté
      __fresh();
      const p1 = G.points;
      const log = __knife(1.0, [0]);
      ok(log.every((s) => s.br === 'rate') && log.some((s) => s.res === 'rate') && G.points === p1, 'personne devant : animation « raté », pas de points');
      const end = log.findIndex((s) => !s.occ);
      ok(end > 0 && log[end].t > 0.7 && log[end].t < 0.85, `raté terminé en ${end > 0 ? log[end].t.toFixed(2) : '?'} s`);
      return out;
    })).forEach(report);

    // --------------------------------------------- élan doux vers le zombie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zb = __zb(2.0);
      const x0 = player.pos.x, z0 = player.pos.z;
      const log = __knife(1.0, [0], zb);
      let maxStep = 0, px = x0, pz = z0, doneAt = -1;
      for (const s of log) {
        maxStep = Math.max(maxStep, Math.hypot(s.px - px, s.pz - pz)); px = s.px; pz = s.pz;
        if (doneAt < 0 && Math.hypot(s.px - x0, s.pz - z0) > KNIFE.lunge - 0.005) doneAt = s.t;
      }
      const moved = Math.hypot(player.pos.x - x0, player.pos.z - z0);
      const toward = ((player.pos.x - x0) * (zb.pos.x - x0) + (player.pos.z - z0) * (zb.pos.z - z0)) / (moved * Math.hypot(zb.pos.x - x0, zb.pos.z - z0));
      ok(Math.abs(moved - 0.55) < 0.01 && toward > 0.999, `zombie à 2,0 m : élan de ${(moved * 100).toFixed(1)} cm vers lui`, { moved, toward });
      ok(doneAt > 0 && doneAt <= KNIFE.lungeTime + 0.02 && maxStep < 0.08, `élan en ${doneAt.toFixed(2)} s, ${(maxStep * 100).toFixed(1)} cm au plus par image (avant : 55 cm d'un coup)`, { doneAt, maxStep });
      const hits = __hits(log, 1000);
      ok(hits.length === 1 && hits[0].dmg === 150, 'puis touché', hits);
      return out;
    })).forEach(report);

    // ---------------------------------------------------- mur, fenêtre
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const li = __S.li;
      // un mur d'une case entre deux sols : joueur d'un côté, zombie de l'autre, à 2,0 m
      let wall = null;
      for (let z = 2; z < GH - 2 && !wall; z++) {
        for (let x = 2; x < GW - 2 && !wall; x++) {
          if (grid[node(li, x, z)] !== T.WALL) continue;
          for (const [dx, dz] of [[1, 0], [0, 1]]) {
            if ([-2, -1, 1, 2].every((s) => __flat(node(li, x + dx * s, z + dz * s)))) { wall = { x, z, dx, dz }; break; }
          }
        }
      }
      ok(wall, 'un mur entre deux sols sur la carte', wall);
      if (wall) {
        __fresh(wall.x - wall.dx + 0.5, wall.z - wall.dz + 0.5, Math.atan2(-wall.dx, -wall.dz));
        const zb = __zb(2.0);
        const x0 = player.pos.x, z0 = player.pos.z, p0 = G.points;
        const log = __knife(1.0, [0], zb);
        ok(zb.hp === 1000 && G.points === p0 && log.every((s) => s.br === 'rate'), 'zombie derrière un mur, à 2,0 m : raté, pas de dégâts (l’ancien couteau frappait à travers)', { hp: zb.hp });
        ok(Math.hypot(player.pos.x - x0, player.pos.z - z0) < 0.01, 'et pas d’élan vers lui');
      }
      // une fenêtre : joueur dedans, zombie dehors en train d'arracher les planches
      const win = World.windows.find((w) => w.li === li && __flat(node(li, w.x - w.nx, w.z - w.nz)) && __flat(node(li, w.x - 2 * w.nx, w.z - 2 * w.nz)));
      ok(win, 'une fenêtre sur la carte', win && { x: win.x, z: win.z });
      if (win) {
        __fresh(win.x - win.nx + 0.5, win.z - win.nz + 0.5, Math.atan2(-win.nx, -win.nz));
        win.boards = 6;
        const zb = spawnZombie(win, 1000), at = new THREE.Vector3();
        windowSpot(win, Math.max(0, win.queue.indexOf(zb)), at);
        zb.state = 'tear'; zb.t = 0; zb.tearT = zb.tearDur = 99; zb.pos.set(at.x, zb.gy, at.z); zb.hp = zb.maxHp = 1000; zb.speed = 0.0001;
        const d = Math.hypot(zb.pos.x - player.pos.x, zb.pos.z - player.pos.z);
        const x0 = player.pos.x, z0 = player.pos.z, p0 = G.points;
        const log = __knife(1.0, [0], zb);
        const hits = __hits(log, 1000);
        ok(zb.outside && hits.length === 1 && hits[0].dmg === 150 && G.points - p0 === 10, `zombie dehors, derrière la fenêtre à ${d.toFixed(2)} m : touché (+10)`, { outside: zb.outside, hits });
        ok(Math.hypot(player.pos.x - x0, player.pos.z - z0) < 0.01, 'sans élan à travers la fenêtre');
      }
      return out;
    })).forEach(report);

    // ------------------------------------- chien, rampant, angle, verrou
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      // chien
      __fresh();
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      const x = player.pos.x + fx * 1.4, z = player.pos.z + fz * 1.4, k = nearestNode(x, z, player.gy);
      const dg = spawnDog(k, 1000);
      dg.pos.set(x, player.gy, z); dg.k = k; dg.gy = player.gy; dg.yaw = Math.atan2(-fx, -fz) + Math.PI; dg.speed = 0.0001;
      setDog(dg, 'chase'); dg.leapCd = 99;
      const p0 = G.points;
      let hits = __hits(__knife(1.0, [0], dg), 1000);
      ok(hits.length === 1 && hits[0].dmg === 150 && G.points - p0 === 10, 'chien à 1,4 m : touché, 150 dégâts, +10', hits);
      // rampant
      __fresh();
      const zc = __zb(1.5);
      startCrawl(zc);
      hits = __hits(__knife(1.0, [0], zc), 1000);
      ok(zc.crawl && hits.length === 1 && hits[0].dmg === 150, 'rampant à 1,5 m : touché', hits);
      // demi-angle de 60°
      __fresh();
      const z50 = __zb(1.5, 50 * Math.PI / 180);
      hits = __hits(__knife(1.0, [0], z50), 1000);
      ok(hits.length === 1, 'zombie à 50° du regard : touché', hits);
      __fresh();
      const z70 = __zb(1.5, -70 * Math.PI / 180);
      const log70 = __knife(1.0, [0], z70);
      ok(z70.hp === 1000 && log70.every((s) => s.br === 'rate'), 'zombie à 70° du regard : raté', z70.hp);
      // zombie choisi à l'appui, qui recule pendant l'armé : encore touché à 2,5 m, raté à 3,3 m
      for (const [to, want] of [[2.5, true], [3.3, false]]) {
        __fresh();
        const zl = __zb(1.1);
        const log = __knife(1.0, [0], zl, (t) => {
          if (Math.abs(t - 0.1) < 1e-6) { const a = player.yaw; zl.pos.set(player.pos.x - Math.sin(a) * to, zl.gy, player.pos.z - Math.cos(a) * to); zl.k = nearestNode(zl.pos.x, zl.pos.z, zl.gy); }
        });
        const h = __hits(log, 1000);
        if (want) ok(h.length === 1 && log.every((s) => s.br === 'touche'), `zombie visé qui recule à ${to} m pendant l'armé : encore touché (marge de 0,6 m)`, h);
        else ok(!h.length && log[log.length - 1].res === 'rate' && log.some((s) => s.br === 'rate'), `zombie visé qui recule à ${to} m : raté (fondu sur l'estoc dans le vide)`, h);
      }
      return out;
    })).forEach(report);

    // ------------------------------------------------------- enchaînement
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      let zb = __zb(1.1);
      let log = __knife(1.4, [0, 0.4], zb);
      let h = __hits(log, 1000);
      ok(h.length === 1, 'V pendant l’estoc (0,4 s) : ignoré, un seul coup', h);
      __fresh();
      zb = __zb(1.1);
      log = __knife(1.4, [0, 0.7], zb);
      h = __hits(log, 1000);
      ok(h.length === 2 && Math.abs(h[1].t - 0.7 - Couteau.debug.contact.touche) < 0.03, `V pendant le retour en garde (0,7 s) : second coup aussitôt (dégâts à ${h.length > 1 ? h[1].t.toFixed(2) : '?'} s)`, h);
      ok(zb.hp === 700, `deux coups : 300 dégâts (${1000 - zb.hp})`);
      return out;
    })).forEach(report);

    // ----------------------------------------- à terre, nouvelle partie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      let zb = __zb(1.1);
      __knife(0.1, [0], zb);
      player.down = true; player.downT = 4.5;
      __knife(0.4, [], zb);
      ok(!Couteau.occupe && !Couteau.rig.visible && Arms.state !== 'knife' && zb.hp === 1000, 'à terre pendant le coup : couteau rangé, pas de dégâts', { occ: Couteau.occupe, st: Arms.state, hp: zb.hp });
      __knife(0.3, [0], zb);
      ok(!Couteau.occupe && zb.hp === 1000, 'à terre : V ne fait rien');
      player.down = false; player.downT = 0;
      __fresh();
      zb = __zb(2.0);
      __knife(0.1, [0], zb);
      const blood = Couteau.sangSurLame;
      resetArms();
      ok(!Couteau.occupe && !Couteau.rig.visible && KnifeLunge.m === 0 && Arms.state !== 'knife', 'nouvelle partie pendant le coup : couteau au repos, élan arrêté, arme de départ qui monte', { occ: Couteau.occupe, rig: Couteau.rig.visible, m: KnifeLunge.m, st: Arms.state });
      ok(blood > 0.05 && Couteau.sangSurLame === 0, `lame propre à la nouvelle partie (sang avant : ${blood.toFixed(2)})`);
      __run(0.5);
      ok(zb.hp === 1000, 'et pas de coup qui part après');
      return out;
    })).forEach(report);

    // ---------------------------------------------------------------- rendu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zb = __zb(1.1);
      __knife(0.25, [0], zb);          // la lame vient d'entrer : bras et couteau au milieu de la vue
      renderEnabled = true;
      const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const shot = () => { render(); return read(); };
      const a = shot();
      const e1 = gl.getError();
      Couteau.rig.visible = false;
      const b = shot();
      Couteau.rig.visible = true;
      // pixels changés par le bras (même image sinon : le rendu logiciel est déterministe)
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) n++;
      // le bras seul sur un fond magenta, au format de la fenêtre et à d'autres formats d'écran (5:4, 21:9 large)
      const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), asp0 = camera.aspect;
      const cover = (asp) => {
        camera.aspect = asp;
        renderer.setClearColor(0xff00ff, 1); renderer.clear(true, true, true);
        Couteau.rendreVue(renderer);
        const c = read();
        let k = 0;
        for (let i = 0; i < c.length; i += 4) if (!(c[i] === 255 && c[i + 1] === 0 && c[i + 2] === 255)) k++;
        return k / (W * H);
      };
      const c0 = cover(asp0), cov = { '5:4': cover(1.25), '16:9': cover(16 / 9), '2,7:1': cover(2.7) };
      camera.aspect = asp0; renderer.setClearColor(cc, ca);
      __knife(0.4, [], zb); render();
      const e2 = gl.getError();
      renderEnabled = false;
      const progs = renderer.info.programs.filter((p) => p.diagnostics && !p.diagnostics.runnable).length;
      ok(e1 === 0 && e2 === 0 && progs === 0, 'rendu du bras au couteau sans erreur', { e1, e2, progs });
      ok(c0 > 0.03 && n / (W * H) >= c0 * 0.9, `bras au couteau dessiné par-dessus la vue (${W} × ${H}) : il couvre ${(100 * c0).toFixed(1)} % de l'image, ${(100 * n / (W * H)).toFixed(1)} % changés dans l'image du jeu`, { c0, n: n / (W * H) });
      ok(Object.values(cov).every((v) => v > 0.05), `bras au couteau bien dans la vue quel que soit l'écran (${Object.entries(cov).map(([k, v]) => `${k} : ${(100 * v).toFixed(1)} %`).join(', ')})`, cov);
      __run(1);
      return out;
    })).forEach(report);

    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Couteau : module, coups, règles du jeu, son et rendu conformes.');
  process.exit(failures ? 1 : 0);
})();
