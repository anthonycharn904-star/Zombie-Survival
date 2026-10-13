'use strict';
/* Khépesh (jeu 2.0.4 refait, construction 1), dans la fenêtre du jeu du launcher : arme de corps-à-corps
   du désert de Khamsin, faite d'après le fichier khepesh-melee.js d'Anthony (module intégré au script du
   jeu, sans variable globale ni écoute du clavier ; reflets du bronze du fichier calculés d'avance ;
   bras aux couleurs des gants et des manches du jeu). Touché quand la lame arrive (0,3 s) : jusqu'à
   3 zombies, 150, 113 et 75 dégâts, +10 par touche ; saignement (la moitié des dégâts en 4 s, sans
   points ; mort au corps-à-corps, +130) ; raté (personne, trop loin, hors de l'arc), mur ; Rôdeur qui
   agrippe : il lâche prise ; enchaînement ; vue immobile ; arme baissée puis revenue ; pas de tir
   pendant le coup ; à terre ; au volant ; nouvelle partie et retour au menu (sang effacé) ; son dans le
   bus des effets du jeu ; rendu par-dessus la vue de l'arme ; le couteau sur Bunker 7.
     xvfb-run -a node e2e/khepesh.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-khepesh-'));
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
    if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 180000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    // le module attrape les erreurs des règles du jeu (choisirCible, onHit, onSaignement) et les écrit dans la console
    game.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

    // ------------------------------------------------- jeu, module, menu de Bunker 7
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(GAME_VERSION === '2.0.4' && GAME_BUILD === 1 && ZS.build === 1, 'jeu 2.0.4, construction 1 (le launcher remplace la construction 0 installée)', { GAME_VERSION, GAME_BUILD, b: ZS.build });
      ok(typeof creerKhepesh === 'function' && window.creerKhepesh === undefined, 'module du khépesh dans le script du jeu, sans variable globale');
      ok(Khepesh === null && CUR.map && CUR.map.id === 'bunker7' && meleeName() === 'Couteau' && $('key-melee').textContent === 'Couteau',
        'au menu sur Bunker 7 : « V ou E : Couteau », pas de khépesh', { map: CUR.map && CUR.map.id, key: $('key-melee').textContent });
      ok(KHEPESH.damage === 150 && KHEPESH.range === 2.4 && KHEPESH.cone === 62 && KHEPESH.max === 3 && KHEPESH.factors.join() === '1,0.75,0.5'
        && KHEPESH.bleed.part === 0.5 && KHEPESH.bleed.duree === 4 && KHEPESH.bleed.pas === 0.5, 'réglages du fichier : 150 dégâts, 2,4 m, ±62°, 3 zombies (100, 75, 50 %), saignement 50 % en 4 s', KHEPESH);
      return out;
    })).forEach(report);

    // ------------------------------------------------- « Jouer » : Khamsin
    await game.click('#btn-play');
    await game.waitForFunction(() => !document.getElementById('mapsel').hidden);
    await game.click('#ms-grid .ms-card[data-id="khamsin"]');
    const t0 = Date.now();
    await game.click('#btn-ms-play');
    await game.waitForFunction(() => ZS.G.state === 'playing' && ZS.G.mapId === 'khamsin', null, { timeout: 300000 });
    console.log(`       (chargement de Khamsin et première image : ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

    await game.evaluate(async () => {
      renderEnabled = false;
      __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9;
      clearZombies();
      await new Promise((r) => { const w = () => (KHEPESH.envReady ? r() : setTimeout(w, 20)); w(); });
      window.__run = (sec, fn) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { update(1 / 60); endFrameInput(); if (fn && fn((i + 1) / 60) === false) break; } };
      window.__press = (c) => { Input.keys[c] = true; Input.down[c] = true; };
      window.__S = { x: 2150, z: 1470 };   // sable ouvert, à l'est du plateau des pyramides
      window.__fresh = (x = __S.x, z = __S.z, yaw = 0) => {
        if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        if (Khepesh) Khepesh.annuler(); Arms.state = 'idle'; Arms.t = 0;
        clearZombies();
        player.down = false; player.downT = 0; player.grabT = 0; player.grabbedBy = null;
        __zs.tp(x, z, yaw); player.pitch = 0; player.vel.set(0, 0, 0);
        Input.lmb = false; Input.lmbDown = false;
        __run(0.4);
      };
      // un zombie immobile à dist m devant le joueur (ang : écart au regard, en radians)
      window.__zb = (dist, ang = 0, hp = 1000) => {
        const a = player.yaw - ang, fx = -Math.sin(a), fz = -Math.cos(a);
        const x = player.pos.x + fx * dist, z = player.pos.z + fz * dist, gy = owGroundAt(0, x, z);
        const zb = spawnZombie({ riser: true, x, z, y: gy, li: 0, k: owLocate(x, z, gy), layer: 0, zone: 0 }, hp);
        zb.state = 'chase'; zb.t = 0; zb.pos.set(x, gy, z); zb.gy = gy; zb.speed = 0.0001; zb.speedType = 'walk';
        zb.hp = zb.maxHp = hp; zb.lastX = x; zb.lastZ = z;
        zb.yaw = Math.atan2(player.pos.x - x, player.pos.z - z);
        return zb;
      };
      // un coup (ou plusieurs) : V aux instants donnés ; journal image par image
      window.__kh = (sec, presses = [0], zbs = [], each = null) => {
        const log = [];
        let pi = 0;
        const n = Math.round(sec * 60);
        for (let i = 0; i < n; i++) {
          const t = i / 60;
          while (pi < presses.length && presses[pi] <= t + 1e-9) { __press('KeyV'); pi++; }
          if (each) each(t);
          update(1 / 60); endFrameInput(); Input.keys.KeyV = false;
          log.push({ t: (i + 1) / 60, st: Arms.state, occ: Khepesh.occupe, res: Khepesh.dernierResultat, br: Khepesh.debug.branche(), low: Khepesh.abaissementArme,
            hp: zbs.map((z) => z.hp), alive: zbs.map((z) => z.alive), pts: G.points,
            rx: camera.rotation.x, ry: camera.rotation.y, rz: camera.rotation.z, fov: camera.fov, rig: Khepesh.rig.visible });
        }
        return log;
      };
      // baisses de PV d'un zombie (indice i) au fil du journal
      window.__hits = (log, i, hp0) => { const h = []; let prev = hp0; for (const s of log) { if (s.hp[i] < prev - 1e-6) h.push({ t: +s.t.toFixed(3), dmg: +(prev - s.hp[i]).toFixed(2) }); prev = s.hp[i]; } return h; };
      // gouttes et flaques de sang du khépesh dans la scène
      window.__blood = () => {
        let P = null, F = null;
        scene.traverse((o) => { if (o.isPoints && o.geometry.attributes.aAlpha && o.geometry.attributes.position.count === 1400) P = o; if (o.isInstancedMesh && o.count === 180) F = o; });
        if (!P || !F) return null;
        let drops = 0, pools = 0;
        const a = P.geometry.attributes.aAlpha.array, m = F.instanceMatrix.array;
        for (let i = 0; i < a.length; i++) if (a[i] > 0) drops++;
        for (let i = 0; i < 180; i++) if (Math.abs(m[i * 16]) > 1e-6) pools++;
        return { drops, pools };
      };
      __fresh();
    });

    // ------------------------------------------------- module en partie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(Khepesh && khepeshOn() && meleeName() === 'Khépesh' && meleeCur() === Khepesh && $('key-melee').textContent === 'Khépesh',
        `Khamsin : khépesh fait au chargement (${KHEPESH.buildMs} ms), menu « V ou E : Khépesh »`, { key: $('key-melee').textContent, ms: KHEPESH.buildMs });
      ok(Khepesh.sceneVue && Khepesh.sceneVue !== vmScene && Khepesh.sceneVue !== Couteau.sceneVue && Khepesh.rig.parent && !Khepesh.rig.visible, 'bras au khépesh dans sa propre vue, caché au repos');
      // reflets du bronze : la salle aux torches du fichier, préfiltrée d'avance (cubeUV, comme PMREMGenerator)
      const env = KHEPESH.env;
      let bronze = null, glove = false, sleeve = 0, tris = 0;
      Khepesh.rig.traverse((m) => {
        if (m.geometry) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
        if (m.material === MAT.sleeve) sleeve++;
        if (m.material && m.material.metalness === 1 && m.material.roughnessMap) bronze = m.material;
        const c = m.material && m.material.color;
        if (c && Math.abs(c.r - MAT.glove.color.r) + Math.abs(c.g - MAT.glove.color.g) + Math.abs(c.b - MAT.glove.color.b) < 1e-6) glove = true;
      });
      ok(env && env.mapping === THREE.CubeUVReflectionMapping && env.encoding === THREE.sRGBEncoding && env.image && env.image.width === 768 && KHEPESH.envReady
        && bronze && bronze.envMap === env, 'reflets du bronze : salle aux torches du fichier préfiltrée d’avance (768 × 768, cubeUV, sRGB)', env && { w: env.image && env.image.width, m: env.mapping });
      // couleur du bronze du fichier (0xc98f52), convertie comme les matières du jeu
      const want = new THREE.Color(0xc98f52).convertSRGBToLinear();
      ok(bronze && Math.abs(bronze.color.r - want.r) + Math.abs(bronze.color.g - want.g) + Math.abs(bronze.color.b - want.b) < 1e-6, 'bronze du fichier (0xc98f52), converti en linéaire comme le jeu');
      ok(glove && sleeve === 2, 'bras : gant à la couleur des gants du jeu, manche et revers dans la matière des manches du jeu', { glove, sleeve });
      ok(tris > 30000 && tris < 120000, `bras et khépesh : ${Math.round(tris)} triangles (dessinés seulement pendant le coup)`);
      ok(Math.abs(Khepesh.debug.contact.touche - 0.3) < 1e-9 && Math.abs(Khepesh.debug.duree.touche - 1.06) < 1e-9 && Math.abs(Khepesh.debug.duree.rate - 1.14) < 1e-9,
        'animations du fichier : la lame arrive à 0,3 s ; touché 1,06 s, raté 1,14 s', { c: Khepesh.debug.contact, d: Khepesh.debug.duree });
      return out;
    })).forEach(report);

    // ------------------------------------------------ son : contexte et bus du jeu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const bus = Sound.bus();
      ok(bus && bus.ctx && bus.sortie, 'le jeu prête son contexte audio et son bus des effets');
      const AC0 = window.AudioContext, WAC0 = window.webkitAudioContext, made = [];
      window.AudioContext = function (...a) { const c = new AC0(...a); made.push(c); return c; };
      window.webkitAudioContext = window.AudioContext;
      const con = AudioNode.prototype.connect, links = [];
      AudioNode.prototype.connect = function (to, ...r) { links.push([this, to]); return con.call(this, to, ...r); };
      let err = null;
      try { for (const n of ['sortie', 'elan', 'impact', 'impact2', 'crochet', 'arrachage', 'secoue', 'rate', 'moulinet', 'rangement']) Khepesh.debug.jouer(n); } catch (e) { err = String(e); }
      AudioNode.prototype.connect = con; window.AudioContext = AC0; window.webkitAudioContext = WAC0;
      const toBus = links.filter(([from, to]) => to === bus.sortie);
      ok(!err && made.length === 0, '10 sons du khépesh sans nouveau contexte audio', { err, made: made.length });
      ok(toBus.length === 1 && toBus[0][0].gain && Math.abs(toBus[0][0].gain.value - KHEPESH.volume) < 1e-6,
        `sons branchés sur le bus des effets du jeu (volume général, son étouffé), niveau ${KHEPESH.volume}`, { n: toBus.length });
      return out;
    })).forEach(report);

    // ------------------------------------------------ clavier : V et E par le jeu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v' }));
      const direct = Khepesh.occupe;
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV', key: 'v' }));
      update(1 / 60); endFrameInput();
      ok(!direct && Khepesh.occupe && !Couteau.occupe && Arms.state === 'knife', 'V : le module n’écoute pas le clavier, le jeu lance le coup de khépesh (pas le couteau)', { direct, occ: Khepesh.occupe, st: Arms.state });
      __run(1.3);
      ok(!Khepesh.occupe && Arms.state === 'idle' && !Khepesh.rig.visible, 'puis khépesh rangé, arme en main', { st: Arms.state });
      __press('KeyE'); __run(0.1);
      ok(Khepesh.occupe && Arms.state === 'knife', 'E : coup de khépesh aussi');
      __run(1.3);
      return out;
    })).forEach(report);

    // ------------------------------------------------------------ touché
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zb = __zb(1.3);
      const p0 = G.points, shots0 = G.stats.shots || 0;
      const v = new THREE.Vector3(), gunY = () => { updateViewmodel(0); Arms.root.updateMatrixWorld(true); return Arms.gun.getWorldPosition(v).project(vmCamera).y; };
      const idleY = gunY();
      let lowY = Infinity;
      const log = __kh(1.3, [0], [zb], (t) => {
        if (t > 0.08 && t < 0.5) { Input.lmb = true; if (t < 0.1) Input.lmbDown = true; } else Input.lmb = false;
        if (Arms.state === 'knife') lowY = Math.min(lowY, gunY());
      });
      Input.lmb = false;
      const hits = __hits(log, 0, 1000);
      ok(hits.length && hits[0].dmg === 150, `150 dégâts au coup (${hits.map((h) => h.dmg).join(', ')})`, hits);
      ok(hits.length && Math.abs(hits[0].t - Khepesh.debug.contact.touche) < 0.02, `dégâts quand la lame arrive : ${hits.length ? hits[0].t.toFixed(3) : '?'} s après l'appui (${Khepesh.debug.contact.touche} s)`);
      ok(G.points - p0 === 10, `+10 points (zombie touché, pas tué) : ${G.points - p0}`);
      ok(log.some((s) => s.res === 'touche') && log.slice(20).every((s) => s.br === 'touche'), 'animation « touché » (morsure, crochet, arrachage, secoué, garde)');
      const dev = Math.max(...log.map((s) => Math.max(Math.abs(s.rx - log[0].rx), Math.abs(s.ry - log[0].ry), Math.abs(s.rz - log[0].rz), Math.abs(s.fov - log[0].fov))));
      ok(dev < 1e-9, 'la vue ne bouge pas (ni secousse, ni coup de zoom)', dev);
      const end = log.findIndex((s) => !s.occ);
      // 1,06 s d'animation, plus l'arrêt sur l'impact (0,09 s où seule l'animation ralentit)
      ok(end > 0 && log[end].t > 1.12 && log[end].t < 1.22 && log[end + 1].st === 'idle', `coup terminé en ${end > 0 ? log[end].t.toFixed(2) : '?'} s (1,06 s et l'arrêt sur l'impact), arme en main à l'image suivante`, end > 0 && [log[end].t, log[end].st, log[end + 1].st]);
      ok(Math.max(...log.map((s) => s.low)) > 0.999 && lowY < -1, `arme baissée hors de la vue pendant le coup (centre de l'arme à y = ${lowY.toFixed(2)}, ${idleY.toFixed(2)} au repos)`, { lowY, idleY });
      __run(0.6);
      ok(Math.abs(gunY() - idleY) < 0.04, 'puis arme revenue à sa place', { now: gunY(), idleY });
      ok((G.stats.shots || 0) === shots0, 'gâchette tenue pendant le coup : pas de tir', G.stats.shots);
      ok(Math.abs(Khepesh.sangSurLame - 0.25) < 0.01, `sang sur la lame : 0,4 au coup, 0,15 secoués (${Khepesh.sangSurLame.toFixed(2)})`);
      return out;
    })).forEach(report);

    // ------------------------------------------- trois zombies, saignement
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zs = [__zb(1.3, 0), __zb(1.75, 0.45), __zb(2.1, -0.4), __zb(2.3, 0.1)];
      const p0 = G.points;
      const log = __kh(0.45, [0], zs);
      const first = zs.map((z, i) => __hits(log, i, 1000).map((h) => h.dmg)[0] || 0);
      ok(first.slice(0, 3).join() === '150,113,75' && zs[3].hp === 1000, `trois zombies dans l'arc, du plus proche au plus loin : ${first.slice(0, 3).join(', ')} dégâts ; le quatrième rien`, first);
      ok(G.points - p0 === 30, `+10 par zombie touché : ${G.points - p0}`);
      // saignement : la moitié des dégâts du coup en 4 s, par tranches, sans points
      const hp1 = zs.map((z) => z.hp), p1 = G.points, ticks = [];
      __run(4.6, () => { if (zs[0].hp < (ticks.length ? ticks[ticks.length - 1] : hp1[0]) - 1e-6) ticks.push(zs[0].hp); });
      const bled = zs.map((z, i) => +(hp1[i] - z.hp).toFixed(2));
      ok(bled.slice(0, 3).join() === '75,57,38' && bled[3] === 0, `saignement : 75, 57 et 38 PV de plus en 4 s (moitié du coup) : ${bled.join(', ')}`, bled);
      ok(ticks.length >= 7 && ticks.length <= 9, `par tranches de 0,5 s (${ticks.length} pour le premier)`, ticks);
      ok(G.points === p1 && Khepesh.saignements === 0, 'pas de points pour le saignement ; plus de saignement au bout de 4 s', { pts: G.points - p1, n: Khepesh.saignements });
      const b = __blood();
      ok(b && b.pools > 10, `flaques au sol (${b && b.pools}) sous les zombies et le long des gerbes`, b);
      // zombie à 200 PV : le coup (150) ne le tue pas, le saignement l'achève : élimination au corps-à-corps
      __fresh();
      const zk = __zb(1.3, 0, 200);
      const p2 = G.points, k2 = G.stats.kills, m2 = Life.on ? Life.data.killsMelee : 0;
      __kh(0.45, [0], [zk]);
      const after = zk.hp;
      __run(4.6);
      ok(after === 50 && !zk.alive && zk.deathKind === 'knife', `zombie à 200 PV : 50 après le coup, achevé par le saignement (${zk.deathKind})`, { after, alive: zk.alive });
      ok(G.points - p2 === 140 && G.stats.kills - k2 === 1 && (!Life.on || Life.data.killsMelee - m2 === 1), `+10 puis +130 : élimination au corps-à-corps (${G.points - p2})`, { pts: G.points - p2 });
      // Gardien : pas de PV perdus par saignement (ses fenêtres de tir décident)
      const g = { boss: true, alive: true, removed: false, hp: 500 };
      ok(khepeshBleed(g, 20) === false && g.hp === 500, 'Gardien : le saignement ne lui retire pas de PV');
      return out;
    })).forEach(report);

    // ------------------------------------------------------- raté, élimination
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      // personne devant
      __fresh();
      const p0 = G.points;
      let log = __kh(1.3, [0]);
      ok(log.slice(20).every((s) => s.br === 'rate') && log.some((s) => s.res === 'rate') && G.points === p0, 'personne devant : animation « raté » (élan, bras emporté, revers), pas de points');
      const end = log.findIndex((s) => !s.occ);
      ok(end > 0 && log[end].t > 1.1 && log[end].t < 1.2, `raté terminé en ${end > 0 ? log[end].t.toFixed(2) : '?'} s`);
      // trop loin, hors de l'arc, dans l'arc
      for (const [d, a, want, label] of [[2.95, 0, false, 'à 2,95 m : trop loin, raté'], [1.4, Math.PI / 2, false, 'à 90° du regard : raté'], [1.4, 57 * Math.PI / 180, true, 'à 57° du regard : touché']]) {
        __fresh();
        const z = __zb(d, a);
        log = __kh(0.5, [0], [z]);
        ok((z.hp < 1000) === want && log[log.length - 1].res === (want ? 'touche' : 'rate'), `zombie ${label}`, { hp: z.hp });
      }
      // mort instantanée : le coup tue
      __fresh();
      G.timers.insta = 20;
      const zi = __zb(1.3, 0, 5000), p1 = G.points;
      __kh(0.45, [0], [zi]);
      G.timers.insta = 0;
      ok(!zi.alive && zi.deathKind === 'knife' && G.points - p1 === 130, 'mort instantanée : tué au premier coup (+130)', { alive: zi.alive, pts: G.points - p1 });
      return out;
    })).forEach(report);

    // ------------------------------------------------------------- mur
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      // deux cases de sol à 1,6 m l'une de l'autre, même hauteur, séparées par un mur (camp de fouilles, relais, oasis)
      let pair = null;
      const eye = 1.6;
      for (const L of KH.locs) {
        for (let dz = -40; dz <= 40 && !pair; dz += 1) {
          for (let dx = -40; dx <= 40 && !pair; dx += 1) {
            const x = Math.floor(L.x + dx) + 0.5, z = Math.floor(L.z + dz) + 0.5;
            if (!owWalkCell(0, Math.floor(x), Math.floor(z))) continue;
            const gy = owGroundAt(0, x, z);
            for (const [ux, uz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
              const x2 = x + ux * 1.6, z2 = z + uz * 1.6;
              if (!owWalkCell(0, Math.floor(x2), Math.floor(z2))) continue;
              const gy2 = owGroundAt(0, x2, z2);
              if (Math.abs(gy2 - gy) > 0.05) continue;
              if (sightClear(x, gy + eye, z, x2, gy2 + 1.3, z2)) continue;
              pair = { x, z, x2, z2, yaw: Math.atan2(-ux, -uz), loc: L.name }; break;
            }
          }
        }
        if (pair) break;
      }
      ok(pair, 'un mur entre deux sols à 1,6 m', pair);
      if (pair) {
        __fresh(pair.x, pair.z, pair.yaw);
        const z = __zb(1.6, 0);
        const p0 = G.points;
        const log = __kh(1.3, [0], [z]);
        ok(z.hp === 1000 && G.points === p0 && log.slice(20).every((s) => s.br === 'rate'), `zombie derrière un mur à 1,6 m (${pair.loc}) : raté, pas de dégâts`, { hp: z.hp });
      }
      return out;
    })).forEach(report);

    // ---------------------------------------------- Rôdeur qui agrippe
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const hints = [], h0 = HUD.hint;
      HUD.hint = (t, d) => { hints.push(t); return h0.call(HUD, t, d); };
      // au cœur d'une tempête (niveau > 1,4 : les Rôdeurs sortent ; sans elle, ils replongent)
      khOnRound(4);
      for (let w = 0; w < 30 * 200 && !(KHS.on && KHS.lv > 1.6); w++) __zs.step(1, 1 / 30);
      __zs.tp(__S.x, __S.z, 0); player.pitch = 0;
      clearZombies(); KHR.t = 1e9;
      const lv = KHS.lv;
      const zr = khSpawnRodeur(player.pos.x + 6, player.pos.z + 0.5);
      let grabbed = false;
      for (let i = 0; i < 60 * 8 && !grabbed; i++) { update(1 / 60); endFrameInput(); if (player.grabT > 0) grabbed = true; }
      player.yaw = Math.atan2(-(zr.pos.x - player.pos.x), -(zr.pos.z - player.pos.z)); player.pitch = -0.2;
      const hp0 = zr.hp;
      __press('KeyV');
      let freed = false, state = null, tf = 0;
      for (let i = 0; i < 60 && !freed; i++) { update(1 / 60); endFrameInput(); Input.keys.KeyV = false; if (!(player.grabT > 0)) { freed = true; state = zr.rstate; tf = (i + 1) / 60; } }
      HUD.hint = h0;
      ok(grabbed && freed && state === 'stun' && Math.abs(tf - 0.3) < 0.03 && hp0 - zr.hp === 150,
        `Rôdeur qui agrippe : le khépesh le fait lâcher prise quand la lame arrive (${tf.toFixed(2)} s), étourdi, 150 dégâts`, { grabbed, freed, state, tf, dmg: hp0 - zr.hp });
      ok(hints.includes('Agrippé ! Khépesh (V) pour vous libérer') && hints.includes('Libéré !'), 'message : « Agrippé ! Khépesh (V) pour vous libérer »', hints);
      __run(1.2);
      khStormReset(); clearZombies(); khEnemiesReset(); KHR.t = 1e9;
      ok(lv > 1.4 && !KHS.on, `(tempête au niveau ${lv.toFixed(2)} pendant l'essai, puis retombée)`);
      return out;
    })).forEach(report);

    // ------------------------------------------------------- enchaînement
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      let zb = __zb(1.3, 0, 5000);
      let log = __kh(1.9, [0, 0.15], [zb]);
      let h = __hits(log, 0, 5000).filter((x) => x.dmg >= 150);
      ok(h.length === 1, 'V pendant l’armé (0,15 s, avant l’impact) : ignoré, un seul coup', h);
      __fresh();
      zb = __zb(1.3, 0, 5000);
      log = __kh(1.9, [0, 0.4], [zb]);
      h = __hits(log, 0, 5000).filter((x) => x.dmg >= 150);
      // retour en garde : 0,66 s d'animation, plus l'arrêt sur l'impact (0,09 s) ; la lame arrive 0,3 s après
      ok(h.length === 2 && Math.abs(h[1].t - 1.05) < 0.04, `V après l'impact (0,4 s) : gardé, second coup dès le retour en garde (dégâts à ${h.length > 1 ? h[1].t.toFixed(2) : '?'} s)`, h);
      return out;
    })).forEach(report);

    // ------------------------------------- à terre, au volant, nouvelle partie
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      let zb = __zb(1.3);
      __kh(0.1, [0], [zb]);
      player.down = true; player.downT = 4.5;
      __kh(0.5, [], [zb]);
      ok(!Khepesh.occupe && !Khepesh.rig.visible && Arms.state !== 'knife' && zb.hp === 1000, 'à terre pendant le coup : khépesh rangé, pas de dégâts', { occ: Khepesh.occupe, st: Arms.state, hp: zb.hp });
      __kh(0.4, [0], [zb]);
      ok(!Khepesh.occupe && zb.hp === 1000, 'à terre : V ne fait rien');
      player.down = false; player.downT = 0;
      // au volant
      __fresh();
      const V = VEH.list[0];
      __kh(0.1, [0]);
      vehEnter(V);
      const inCar = !Khepesh.occupe && !Khepesh.rig.visible;
      vehExit(true);
      ok(inCar, 'monter dans un véhicule pendant le coup : khépesh rangé');
      // nouvelle partie pendant le coup : rangé, lame propre, sang effacé
      __fresh();
      zb = __zb(1.3);
      __kh(1.0, [0], [zb]);
      __kh(0.1, [0], [zb]);
      const blood = Khepesh.sangSurLame, b0 = __blood();
      resetArms();
      const b1 = __blood();
      ok(!Khepesh.occupe && !Khepesh.rig.visible && Arms.state !== 'knife', 'nouvelle partie pendant le coup : khépesh au repos, arme de départ qui monte', { occ: Khepesh.occupe, st: Arms.state });
      ok(blood > 0.05 && Khepesh.sangSurLame === 0 && Khepesh.saignements === 0 && b0.drops + b0.pools > 0 && b1.drops === 0 && b1.pools === 0,
        `lame propre, gouttes et flaques effacées (avant : lame ${blood.toFixed(2)}, ${b0.drops} gouttes, ${b0.pools} flaques)`, { b0, b1 });
      const hp = zb.hp;
      __run(0.6);
      ok(zb.hp === hp, 'et pas de coup qui part après');
      return out;
    })).forEach(report);

    // ---------------------------------------------------------------- rendu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zb = __zb(1.3);
      __kh(0.28, [0], [zb]);          // la lame arrive : bras et khépesh au milieu de la vue
      renderEnabled = true;
      const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const shot = () => { render(); return read(); };
      const a = shot();
      const e1 = gl.getError();
      Khepesh.rig.visible = false;
      const b = shot();
      Khepesh.rig.visible = true;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) n++;
      const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), asp0 = camera.aspect;
      const cover = (asp) => {
        camera.aspect = asp;
        renderer.setClearColor(0xff00ff, 1); renderer.clear(true, true, true);
        Khepesh.rendreVue(renderer);
        const c = read();
        let k = 0;
        // (même seuil que la comparaison : la traînée de la lame, très légère, ne compte pas)
        for (let i = 0; i < c.length; i += 4) if (255 - c[i] + c[i + 1] + 255 - c[i + 2] > 3) k++;
        return k / (W * H);
      };
      const c0 = cover(asp0), cov = { '5:4': cover(1.25), '16:9': cover(16 / 9), '2,7:1': cover(2.7) };
      camera.aspect = asp0; renderer.setClearColor(cc, ca);
      __kh(0.4, [], [zb]); render();
      const e2 = gl.getError();
      renderEnabled = false;
      const progs = renderer.info.programs.filter((p) => p.diagnostics && !p.diagnostics.runnable).length;
      ok(e1 === 0 && e2 === 0 && progs === 0, 'rendu du bras au khépesh sans erreur', { e1, e2, progs });
      ok(c0 > 0.02 && n / (W * H) >= c0 * 0.9, `bras au khépesh dessiné par-dessus la vue (${W} × ${H}) : il couvre ${(100 * c0).toFixed(1)} % de l'image, ${(100 * n / (W * H)).toFixed(1)} % changés dans l'image du jeu`, { c0, n: n / (W * H) });
      ok(Object.values(cov).every((v) => v > 0.02), `bras au khépesh dans la vue quel que soit l'écran (${Object.entries(cov).map(([k, v]) => `${k} : ${(100 * v).toFixed(1)} %`).join(', ')})`, cov);
      __run(1);
      return out;
    })).forEach(report);

    // ------------------------------------------- retour au menu, Bunker 7 : le couteau
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh();
      const zb = __zb(1.3);
      __kh(1.0, [0], [zb]);
      const b0 = __blood();
      quitToMenu();
      const b1 = __blood();
      ok(b0.drops + b0.pools > 0 && b1.drops === 0 && b1.pools === 0 && G.state === 'menu', `retour au menu : sang du khépesh effacé (${b0.drops} gouttes, ${b0.pools} flaques avant)`, { b0, b1 });
      __zs.map('bunker7');
      ok($('key-melee').textContent === 'Couteau' && meleeName() === 'Couteau' && !khepeshOn() && meleeCur() === Couteau, 'Bunker 7 : « V ou E : Couteau »', { key: $('key-melee').textContent });
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      __run(0.4);
      __press('KeyV'); update(1 / 60); endFrameInput(); Input.keys.KeyV = false;
      ok(Couteau.occupe && !Khepesh.occupe && !Khepesh.rig.visible && Arms.state === 'knife', 'Bunker 7 : V, coup de couteau (pas de khépesh)', { k: Couteau.occupe, kh: Khepesh.occupe });
      __run(1.2);
      ok(Arms.state === 'idle', 'puis arme en main');
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
  console.log(failures ? `${failures} échec(s).` : 'Khépesh : module du fichier, coups, saignement, règles du jeu, son et rendu conformes ; le couteau ailleurs.');
  process.exit(failures ? 1 : 0);
})();
