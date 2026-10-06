'use strict';
/* Animations des zombies (jeu 1.9.0) dans la fenêtre du jeu du launcher : squelette à bassin,
   démarches World at War / Black Ops 1 puis Black Ops 3 selon la manche, pieds posés au sol et
   retenus pendant l'appui, réactions aux coups, morts (début animé puis corps physique sans saut,
   corps au sol, sur l'appui d'une fenêtre, retirés), rampants après une explosion, trébuchements et
   chutes des sprinteurs, bras arrachés par les tirs, écran Modèles (nouvelles animations), pas
   d'erreur.
     xvfb-run -a node e2e/zombie-anims.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-anims-'));
const USER = path.join(TMP, 'joueur');
const GAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'game', 'game.json'), 'utf8')).version;

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  const report = (r) => {
    if (!r.ok) failures++;
    console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
  };
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 180000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    game.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

    // ------------------------------------------------- squelette, démarches, choix selon la manche
    (await game.evaluate((v) => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(ZS.version === v && GAME_VERSION === '1.9.0', `jeu ${v}`, ZS.version);
      const r = makeRig();
      ok(r.pelvis && r.hips.parent === r.pelvis && r.hipL.parent === r.pelvis && r.hipR.parent === r.pelvis && r.pelvis.parent === r.body,
        'squelette : bassin qui porte le buste et les jambes (le buste se penche sans elles)');
      const ids = Object.keys(ZGAITS), by = (t) => ids.filter((id) => ZGAITS[id].type === t);
      ok(by('walk').join() === 'fantassin,titubant,bras,boiteux' && by('jog').join() === 'coureur,griffu' && by('run').join() === 'sprinteur,super,frenetique',
        'démarches : 4 marches, 2 trots, 3 sprints', ids);
      ok(['super', 'frenetique', 'griffu'].every((id) => ZGAITS[id].era !== 'waw') && ['fantassin', 'titubant', 'bras', 'boiteux', 'coureur', 'sprinteur'].every((id) => ZGAITS[id].era === 'waw'),
        'World at War / Black Ops 1 (marche, trot, sprint) et Black Ops 3 (super-sprinteur, sprint frénétique)');
      const count = (type, round) => { const c = {}; for (let i = 0; i < 2000; i++) { const g = zPickGait(type, round); c[g.id] = (c[g.id] || 0) + 1; } return c; };
      const r5 = count('run', 5), r25 = count('run', 25);
      ok(!r5.super && r5.sprinteur > 1400 && r25.super > 600 && r25.frenetique > 500 && r25.sprinteur < 700,
        'manche 5 : sprinteurs World at War (pas de super-sprinteur) ; manche 25 : surtout Black Ops 3', { r5, r25 });
      ok(Object.values(ZGAITS).every((g) => g.stride > 0.6 && g.stride < 4), 'foulée de chaque démarche mesurée sur ses courbes', Object.fromEntries(ids.map((id) => [id, +ZGAITS[id].stride.toFixed(2)])));
      return out;
    }, GAME)).forEach(report);

    // ------------------------------------------------- en partie : pieds, réactions, morts
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      window.__realUpdate = update;
      window.update = function (dt) { if (!window.__hold) window.__realUpdate(dt); };
      window.__hold = true;
      renderEnabled = false;
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9;
      __zs.openAll();
      clearZombies();
      const p = player.pos;
      let best = 0, bestT = 0;
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; raycast(p.x, player.gy + 1.2, p.z, -Math.sin(a), 0, -Math.cos(a), 30); if (RAY.t > bestT) { bestT = RAY.t; best = a; } }
      const fx = -Math.sin(best), fz = -Math.cos(best);
      const put = (d, type = 'walk', s = 0) => {
        const w = World.windows.find((ww) => !LAYOUT.zones[ww.zone].zombie) || World.windows[0];
        const z = spawnZombie(w, 1e6);
        leaveWindow(z);
        z.outside = false; z.state = 'chase'; z.t = 0;
        z.pos.set(p.x + fx * d - fz * s, player.gy, p.z + fz * d + fx * s); z.gy = player.gy; z.yaw = Math.atan2(-fx, -fz);
        z.k = nearestNode(z.pos.x, z.pos.z, player.gy);
        z.speedType = type; z.speed = SPEEDS[type][1];
        animateZombie(z, 0);
        return z;
      };
      const v = new THREE.Vector3();
      // pieds au sol et retenus pendant l'appui (marcheurs et sprinteur qui avancent vers le joueur)
      for (const [type, id] of [['walk', 'fantassin'], ['walk', 'titubant'], ['walk', 'bras'], ['walk', 'boiteux'], ['run', 'sprinteur']]) {
        clearZombies();
        const z = put(Math.min(bestT - 1, 10), type);
        z.an.gait = ZGAITS[id]; z.an.gaitFor = type;
        let low = 9, high = -9, held = 0, drift = 0, midD = 0, midH = 0, frames = 0;
        const prev = [null, null], st = ZGAITS[id].stance;
        for (let f = 0; f < 150; f++) {
          z.speed = ZGAIT_REF[type]; z.losT = 0;
          updateZombie(z, 1 / 60);
          if (z.state !== 'chase' || f < 30) { prev[0] = prev[1] = null; continue; }
          frames++;
          const m = zFootMin(z) - z.pos.y;
          low = Math.min(low, m); high = Math.max(high, m);
          [z.rig.knL, z.rig.knR].forEach((kn, s) => {
            const L = z.an.lock[s], ph = s ? (z.an.u + 0.5) % 1 : z.an.u;
            v.set(0, -0.4, 0).applyMatrix4(kn.matrixWorld);
            if (L.on && prev[s]) {
              const d = Math.hypot(v.x - prev[s].x, v.z - prev[s].z);
              drift += d; held += 1 / 60;
              if (ph > st * 0.15 && ph < st * 0.72) { midD += d; midH += 1 / 60; }
            }
            prev[s] = L.on ? v.clone() : null;
          });
        }
        const speed = held > 0 ? drift / held : 9, mid = midH > 0 ? midD / midH : 9, ref = ZGAIT_REF[type];
        // à la marche, un pied touche toujours le sol ; au sprint, les deux le quittent entre deux appuis
        // (phase de vol). Cheville retenue : moins de 12 % de la vitesse au milieu de l'appui, moins de
        // 35 % en comptant la pose et le lever du pied (fondus)
        ok(frames > 60 && low > -0.03 && high < (type === 'run' ? 0.1 : 0.01) && held > 0.5 && mid < ref * 0.12 && speed < ref * 0.35,
          `${type === 'walk' ? 'marche' : 'sprint'} (${id}) : pieds au sol (${(low * 100).toFixed(1)} à ${(high * 100).toFixed(1)} cm${type === 'run' ? ', phase de vol comprise' : ''}), cheville retenue pendant l’appui (${(mid * 100).toFixed(0)} cm/s ; ${(speed * 100).toFixed(0)} cm/s pose et lever compris, pour ${ref} m/s)`,
          { frames, low, high, held, mid, speed });
      }
      // réaction à un tir dans le buste : le buste encaisse puis revient
      clearZombies();
      const zr = put(3);
      for (let i = 0; i < 20; i++) updateZombie(zr, 1 / 60);
      zr.speed = 0;
      const before = zr.an.sx[ZSPR_I.tRX];
      damageZombie(zr, 10, { kind: 'bullet', dx: fx, dz: fz, force: 0.5, hx: zr.pos.x, hy: zr.pos.y + 1.2, hz: zr.pos.z });
      let peak = 0;
      for (let i = 0; i < 12; i++) { updateZombie(zr, 1 / 60); peak = Math.min(peak, zr.an.sx[ZSPR_I.tRX]); }
      for (let i = 0; i < 90; i++) updateZombie(zr, 1 / 60);
      ok(before === 0 && peak < -0.04 && Math.abs(zr.an.sx[ZSPR_I.tRX]) < 0.01, `tir de face dans le buste : il part en arrière (${peak.toFixed(2)} rad) puis se reprend`, { peak, after: zr.an.sx[ZSPR_I.tRX] });
      // morts : début animé puis corps physique sans saut
      const pts = (z) => RD_SRC.map(([b, x, y, zz]) => new THREE.Vector3(x, y, zz).applyMatrix4(z.rig[b].matrixWorld));
      let worst = 0, worstStyle = '';
      const styles = ['head', 'back', 'spin', 'front', 'leg', 'stagger', 'knife', 'nuke', 'glas'];
      const seen = new Set();
      for (const st of styles) {
        clearZombies();
        const z = put(3, st === 'stagger' ? 'run' : 'walk');
        for (let i = 0; i < 20; i++) updateZombie(z, 1 / 60);
        z.alive = false; z.state = 'dead'; z.t = 0; z.deathKind = { knife: 'knife', nuke: 'nuke', glas: 'glas' }[st] || 'bullet';
        zDeathSetup(z, { kind: z.deathKind, head: st === 'head', leg: st === 'leg', dx: fx, dz: fz, force: 0.5 }, 'chase', st);
        seen.add(z.deathStyle);
        let prev = null, guard = 0;
        while (!z.rd && guard++ < 200) { prev = pts(z); updateZombie(z, 1 / 60); }
        const after = pts(z);
        for (let i = 0; i < after.length; i++) { const d = after[i].distanceTo(prev[i]); if (d > worst) { worst = d; worstStyle = st; } }
      }
      ok(seen.size === styles.length && worst < 0.12, `9 débuts de mort (tête, à la renverse, pivot, en avant, jambe, élan, couteau, Bombe, Minuit) puis corps physique : écart max d’une image ${(worst * 100).toFixed(1)} cm (${worstStyle})`, { worst, seen: [...seen] });
      // morts réelles (killZombie) : corps posés, endormis, puis retirés
      clearZombies();
      const kinds = [['bullet', { head: true }], ['bullet', {}], ['bullet', { leg: true }], ['knife', {}], ['explosive', { force: 6 }], ['blast', { force: 14 }], ['nuke', {}], ['glas', {}]];
      const zs = kinds.map(([kind, extra], i) => {
        const z = put(2.5 + Math.floor(i / 4) * 1.5, 'walk', ((i % 4) - 1.5) * 0.9);
        for (let k = 0; k < 10; k++) updateZombie(z, 1 / 60);
        z.__d = { x: z.pos.x, z: z.pos.z, kind };
        killZombie(z, Object.assign({ kind, dx: fx, dz: fz }, extra));
        return z;
      });
      for (let i = 0; i < 150; i++) updateZombies(1 / 60);
      const bad = [];
      for (const z of zs) {
        if (!z.rd) { bad.push(['sans corps physique', z.__d.kind]); continue; }
        for (let i = 0; i < RD.N; i++) {
          const x = z.rd.p[i * 3], y = z.rd.p[i * 3 + 1], zz = z.rd.p[i * 3 + 2];
          if (!Number.isFinite(x + y + zz)) { bad.push(['NaN', z.__d.kind]); break; }
          const fl = rdFloor(x, zz, y + 0.3);
          if (y < fl + RD_RAD[i] - 0.06) bad.push(['sous le sol', z.__d.kind, i]);
          if (z.rd.asleep && y > fl + 1.0) bad.push(['en l’air', z.__d.kind, i]);
        }
      }
      // après 2,5 s : au plus un corps sur 8 bouge encore (un genou qui retombe, un corps projeté qui finit
      // de glisser), lentement ; après 3,5 s, tous sont posés (un corps qui s'agite ne se pose pas)
      const moving = zs.filter((z) => z.rd && !z.rd.asleep).map((z) => [z.__d.kind, +(z.rd.vlast / RD.h).toFixed(2)]).filter(([, v]) => v >= 0.5);
      for (let i = 0; i < 60; i++) updateZombies(1 / 60);
      const late = zs.filter((z) => z.rd && !z.rd.asleep).map((z) => [z.__d.kind, +(z.rd.vlast / RD.h).toFixed(2)]).filter(([, v]) => v >= 0.3);
      ok(bad.length === 0 && moving.length <= 1 && moving.every(([, v]) => v < 2) && late.length === 0,
        `morts par balle, couteau, explosion, Onde de choc, Bombe, Minuit : corps au sol ; ${8 - moving.length} sur 8 immobiles ou presque après 2,5 s, tous après 3,5 s`, { bad: bad.slice(0, 5), moving, late });
      for (let i = 0; i < 60 * 3.2; i++) updateZombies(1 / 60);
      ok(zs.every((z) => z.removed), 'corps enfoncés dans le sol puis retirés (vers 6,2 s)');
      // tirs dans la tête, de face, en terrain dégagé (12 fois) : il tombe à la renverse sans roulade
      // arrière (le buste ne bascule pas par-dessus les épaules) et reste près de l'endroit de sa mort
      const flips = [];
      let far = 0;
      for (let rep = 0; rep < 12; rep++) {
        clearZombies();
        const z = put(3, 'walk');
        for (let i = 0; i < 30; i++) updateZombie(z, 1 / 60);
        const sx = z.pos.x, sz = z.pos.z;
        killZombie(z, { kind: 'bullet', head: true, dx: fx, dz: fz });
        let ang = null, turn = 0, maxTurn = 0;
        for (let i = 0; i < 150; i++) {
          updateZombie(z, 1 / 60);
          if (!z.rd) continue;
          // angle du buste (bassin → cou) dans le plan vertical du tir, déroulé et cumulé
          const R = z.rd.p, a = Math.atan2((R[3] - R[0]) * fx + (R[5] - R[2]) * fz, R[4] - R[1]);
          if (ang !== null) { let d = a - ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turn += d; maxTurn = Math.max(maxTurn, Math.abs(turn)); }
          ang = a;
        }
        if (maxTurn > 3.5) flips.push(rep);
        far = Math.max(far, Math.hypot(z.rd.p[0] - sx, z.rd.p[2] - sz));
      }
      ok(flips.length === 0 && far < 1.2, `12 tirs dans la tête de face : aucune roulade arrière, bassin à ${far.toFixed(2)} m au plus de l’endroit de la mort`, { flips, far });
      // tué au début de l'enjambement (trois fois) : le corps reste en travers de l'appui, sans point
      // dans le mur, et s'y pose (un point qui repasse le bord de l'appui ne doit pas y remonter d'un
      // coup : le corps s'agiterait jusqu'à 4 s)
      const w = World.windows.find((ww) => LV[ww.li] === 0) || World.windows[0], E = LVY[w.li];
      const sill = [];
      for (let rep = 0; rep < 3; rep++) {
        clearZombies();
        while (w.boards > 0) Features.tearBoard(w);
        const zc = spawnZombie(w, 1e6);
        zc.state = 'climb'; zc.t = 0; zc.pos.y = E; zc.gy = E;
        windowSpot(w, 0, _fd); zc.pos.x = _fd.x; zc.pos.z = _fd.z; zc.yaw = Math.atan2(-w.nx, -w.nz); zc.climbFrom = zc.pos.clone();
        for (let i = 0; i < 18; i++) updateZombie(zc, 1 / 60);
        killZombie(zc, { kind: 'bullet', dx: -w.nx * 0.3, dz: -w.nz * 0.3 });
        for (let i = 0; i < 210; i++) updateZombie(zc, 1 / 60);
        let onSill = 0, inWall = 0;
        for (let i = 0; i < RD.N; i++) {
          const x = zc.rd.p[i * 3], y = zc.rd.p[i * 3 + 1], zz = zc.rd.p[i * 3 + 2], k = node(w.li, Math.floor(x), Math.floor(zz));
          if (grid[k] === T.WINDOW && Math.abs(y - (E + WIN_LO + RD_RAD[i])) < 0.08) onSill++;
          if ((grid[k] === T.WALL || (grid[k] === T.WINDOW && y < E + WIN_LO - 0.15))) inWall++;
        }
        sill.push({ onSill, inWall, v: +(zc.rd.vlast / RD.h).toFixed(2), asleep: zc.rd.asleep });
      }
      ok(sill.every((s) => s.onSill >= 6 && s.inWall === 0 && (s.asleep || s.v < 0.5)),
        `tué en enjambant la fenêtre (3 fois) : corps en travers de l’appui (${sill.map((s) => s.onSill).join(', ')} points sur 16), aucun dans le mur, posé après 3,5 s`, sill);
      // explosion au ras du sol : des survivants rampent
      clearZombies();
      let crawl = 0;
      for (let i = 0; i < 20; i++) {
        const z = put(3);
        explode(z.pos.x + fx * 0.8, player.gy + 0.2, z.pos.z + fz * 0.8, 2.5, 10, {});
        if (z.crawl && z.alive) crawl++;
        removeZombie(z);
      }
      ok(crawl >= 5 && crawl <= 18, `grenade au sol à 0,8 m (souffle, 10 dégâts) : ${crawl} survivants sur 20 continuent en rampant (jambes arrachées)`, { crawl });
      const zk = put(3);
      zk.hp = 1e6; startCrawl(zk);
      for (let i = 0; i < 40; i++) updateZombie(zk, 1 / 60);
      const vis = (q, side = 0) => { const e = new THREE.Matrix4(); q.m.getMatrixAt(q.pair ? zk.slot * 2 + side : zk.slot, e); return Math.abs(e.determinant()) > 1e-9; };
      flushZombieMatrices();
      const parts = ZR.models[zModelOf(zk)];
      ok(parts.filter((q) => q.def.legs).every((q) => !vis(q)) && parts.filter((q) => q.def.stump === true).every((q) => vis(q)), `Fantassin rampant : tibias cachés, moignons aux genoux (${zModelOf(zk)})`);
      // tirs dans les jambes : trébuchement ; chute des sprinteurs, puis relevé
      let st = 0, trips = 0;
      for (let i = 0; i < 20; i++) {
        clearZombies();
        const z = put(6, 'run');
        for (let k = 0; k < 30; k++) updateZombie(z, 1 / 60);
        const y = z.pos.y + 0.4, o = new THREE.Vector3(p.x, y, p.z), d = new THREE.Vector3(z.pos.x, y, z.pos.z).sub(o).normalize();
        hitscan(curSlot(), o.x, o.y, o.z, d.x, d.y, d.z, o);
        if (z.stumbleT > 0) st++;
        if (z.knockKind === 'trip' && z.knockT > 0) trips++;
      }
      ok(st + trips >= 18 && trips >= 2, `20 tirs dans les jambes d’un sprinteur : ${st} trébuchements, ${trips} chutes face contre terre`, { st, trips });
      clearZombies();
      const zt = put(6, 'run');
      for (let k = 0; k < 30; k++) updateZombie(zt, 1 / 60);
      const x0 = zt.pos.x, z0 = zt.pos.z;
      zTrip(zt);
      let down = false;
      for (let k = 0; k < 110; k++) { updateZombie(zt, 1 / 60); if (zt.knockK > 0.9) down = true; }
      const moved = Math.hypot(zt.pos.x - x0, zt.pos.z - z0);
      ok(down && zt.knockT === 0 && zt.knockK === 0 && !zt.knockShift && zt.alive && moved > 0.6, `sprinteur tombé : à terre, puis relevé là où il gît (${moved.toFixed(2)} m plus loin)`, { down, moved });
      // bras arraché par un tir au coude (Kar98k) : moignon, bras qui vole, frappe de l'autre bras
      clearZombies();
      __zs.give('kar98k', 0);
      const za = put(3);
      za.an.gait = ZGAITS.bras; za.an.gaitFor = 'walk';    // bras tendus : le coude est devant le corps
      for (let k = 0; k < 10; k++) updateZombie(za, 1 / 60);
      za.speed = 0;
      const kar = curSlot() && curSlot().id === 'kar98k';
      for (let i = 0; i < 60 && !za.gib; i++) {
        const e = new THREE.Vector3().setFromMatrixPosition(za.rig.elL.matrixWorld);
        const o = new THREE.Vector3(p.x, e.y, p.z), d = e.clone().sub(o).normalize();
        hitscan(curSlot(), o.x, o.y, o.z, d.x, d.y, d.z, o);
        updateZombie(za, 1 / 60);
      }
      const side = za.gib === 1 ? 0 : 1, sb = za.gib === 1 ? 'L' : 'R';
      updateZombie(za, 1 / 60);
      flushZombieMatrices();
      const pa = ZR.models[zModelOf(za)];
      const drawn = (q) => { const e = new THREE.Matrix4(); q.m.getMatrixAt(q.pair ? za.slot * 2 + side : za.slot, e); return Math.abs(e.determinant()) > 1e-9; };
      const stump = pa.filter((q) => q.def.stump === 'arm').every(drawn);
      const gone = pa.filter((q) => !q.def.stump && ['sh', 'el', 'sh' + sb, 'el' + sb].includes(q.def.bone)).every((q) => !drawn(q));
      ok(kar && za.gib && stump && gone && FX.limbs.some((L) => L.life > 0), `tir au coude (Kar98k) : bras arraché, moignon à l’épaule, le bras vole`, { kar, gib: za.gib, stump, gone });
      const atks = new Set();
      for (let i = 0; i < 30; i++) { za.state = 'attack'; za.t = 0; za.an.lastState = ''; updateZombie(za, 1 / 60); atks.add(za.an.atk); za.state = 'chase'; }
      const forbidden = za.gib === 1 ? ['swipeL', 'double', 'lunge'] : ['swipeR', 'double', 'lunge'];
      ok(![...atks].some((a) => forbidden.includes(a)), `il frappe de l’autre bras ou mord : ${[...atks].join(', ')}`);
      clearZombies(); clearFX();
      return out;
    })).forEach(report);

    // ------------------------------------------------- écran Modèles : nouvelles animations
    await game.evaluate(() => { window.__hold = false; quitToMenu(); });
    await game.waitForFunction(() => !document.getElementById('menu').hidden, null, { timeout: 60000 });
    await game.click('#btn-models', { timeout: 120000 });
    await game.waitForFunction(() => !document.getElementById('models').hidden, null, { timeout: 120000 });
    const md = await game.evaluate(() => {
      const chips = [...document.querySelectorAll('#md-anims .md-chip')].map((b) => b.textContent);
      return { chips };
    });
    report({ ok: ['Repos', 'Marche', 'Trot', 'Sprint', 'Sprint nerveux', 'Rampe', 'Attaque', 'Barricade', 'Fenêtre', 'Sortie de terre', 'Trébuche', 'Mort', 'Autre apparence', 'Tir dans le casque', 'Tir au bras'].every((t) => md.chips.includes(t)),
      label: 'écran Modèles : animations Sprint nerveux, Rampe, Fenêtre, Trébuche, Mort et bouton Tir au bras', extra: md.chips });
    const demo = await game.evaluate(() => {
      const M = Models, res = {};
      const run = (anim, sec) => { setModelAnim(anim); M.at = 0; const dt = 1 / 60; for (let i = 0; i < Math.round(sec * 60); i++) { M.at += dt; if (M.sill) { M.sill.visible = M.anim === 'climb'; } M.spec.pose(M.anim, M.at, dt, M.yaw); } };
      run('climb', 0.55);
      res.climb = { sill: M.sill.visible, y: +M.spec.center().y.toFixed(2) };
      run('death', 2.2);
      res.death = { y: +M.spec.center().y.toFixed(2) };
      run('stumble', 1.4);
      res.stumble = { y: +M.spec.center().y.toFixed(2) };
      run('frenzy', 0.5);
      res.frenzy = M.anim;
      run('walk', 0.3);
      res.arm = M.spec.armShot();
      const left = [...document.querySelectorAll('#md-anims .md-chip')].find((b) => b.dataset.action === 'arm');
      res.armChip = !!left;
      return res;
    });
    report({ ok: demo.climb.sill && demo.climb.y > 1.3 && demo.death.y < 0.45 && demo.stumble.y < 0.45 && demo.arm && demo.armChip,
      label: `démonstrations : il enjambe l’appui (bassin à ${demo.climb.y} m), meurt et tombe au sol, trébuche et tombe, perd un bras`, extra: demo });
    await game.keyboard.press('Escape');
    await game.waitForFunction(() => !document.getElementById('menu').hidden);
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Animations des zombies : démarches, pieds, réactions, morts, rampants, chutes, bras arrachés et écran Modèles conformes.');
  process.exit(failures ? 1 : 0);
})();
