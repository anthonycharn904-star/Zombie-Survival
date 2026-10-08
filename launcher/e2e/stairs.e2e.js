'use strict';
/* Essai de bout en bout des étages, dans la fenêtre du jeu du launcher (jeu 1.4.0 ou plus récent).
   Carte d'essai : sous-sol, rez-de-chaussée, étage ; cinq escaliers (droit en bois sur 2 cases,
   quart tournant en pierre, demi-tour en béton, colimaçon en métal, droit en brique depuis la cave).
   Vérifie : un zombie monte et descend chaque escalier jusqu'au joueur, et traverse plusieurs
   niveaux d'affilée ; le joueur monte et descend chaque escalier aux touches ; les tirs s'arrêtent
   sur les dalles sauf à travers une trémie ; une explosion ne traverse pas un plancher ; dans une
   partie simulée, les zombies de chaque fenêtre et de chaque apparition rejoignent le joueur.
     xvfb-run -a node e2e/stairs.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-etages-'));
const USER = path.join(TMP, 'joueur');
let failures = 0;
const ok = (cond, label, extra) => { console.log(`${cond ? 'ok    ' : 'ÉCHEC '} ${label}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`); if (!cond) failures++; };

/* ------------------------------------------------------ carte d'essai -- */
function testMap() {
  const W = 42, H = 32;
  const blank = () => Array.from({ length: H }, () => Array(W).fill(' '));
  const rect = (g, x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z][x] = (x === x0 || x === x1 || z === z0 || z === z1) ? '#' : '.'; };
  const g0 = blank(), g1 = blank(), gm = blank();
  rect(g0, 2, 2, 39, 29); rect(g1, 2, 2, 39, 29); rect(gm, 2, 2, 21, 16);
  for (const [x, z] of [[2, 15], [39, 15], [20, 29], [30, 2], [2, 24]]) g0[z][x] = 'W';
  for (let z = 3; z <= 28; z++) g1[z][24] = '#';
  g1[15][24] = 'D';
  for (let z = 0; z <= 1; z++) for (let x = 10; x <= 20; x++) g1[z][x] = 'o';
  g1[2][15] = 'W';
  g0[25][33] = 'x'; g0[25][34] = 'x'; g0[18][28] = 'm'; g0[18][29] = 'm';
  const rows = (g) => g.map((r) => r.join(''));
  return {
    format: 2, id: 'etages-essai', name: 'Étages (essai)', seed: 11,
    grid: rows(g0), floors: [{ lv: -1, grid: rows(gm) }, { lv: 1, grid: rows(g1) }],
    zones: [{ name: 'Hall', seed: [20, 15] }, { name: 'Étage ouest', seed: [10, 15], lv: 1 }, { name: 'Étage est', seed: [30, 20], lv: 1 }, { name: 'Cave', seed: [15, 10], lv: -1 }],
    spawn: { pos: [20.5, 15.5], yaw: 0 },
    stairs: [
      { x: 6, z: 20, dir: [1, 0], shape: 'straight', w: 2, n: 6, mat: 'wood' },
      { x: 30, z: 10, dir: [0, 1], shape: 'l', w: 1, n: 4, n2: 4, turn: 1, mat: 'stone' },
      { x: 12, z: 5, dir: [0, 1], shape: 'u', w: 1, n: 4, n2: 4, turn: 1, mat: 'concrete' },
      { x: 20, z: 24, dir: [1, 0], shape: 'spiral', turn: 1, mat: 'metal' },
      { x: 8, z: 12, dir: [0, -1], shape: 'straight', w: 1, n: 6, mat: 'brick', lv: -1 },
    ],
    risers: [[15, 10, -1], [32, 25, 1]],
    wallbuys: [{ w: 'mp40', cell: [24, 10], n: [-1, 0], lv: 1 }],
    boxes: [{ cells: [[18, 18], [19, 18]], face: [0, -1] }],
    lights: [
      { pos: [10, 3.2, 15], color: '#ffc78f' }, { pos: [30, 3.2, 15], color: '#ffc78f' }, { pos: [20, 3.2, 25], color: '#ffc78f' },
      { pos: [12, 3.2, 12], color: '#9fd0ff', lv: 1 }, { pos: [30, 3.2, 20], color: '#9fd0ff', lv: 1 }, { pos: [12, 3.2, 9], color: '#ff9a7a', lv: -1 },
    ],
    rules: { startPoints: 5000 },
  };
}

async function openGame() {
  const args = [ROOT];
  if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
  const app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
  const launcher = await app.firstWindow({ timeout: 30000 });
  await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
  const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
  if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
  await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
  return { app, game };
}

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app = null;
  try {
    const o = await openGame();
    app = o.app;
    const game = o.game;
    const errors = [];
    game.on('pageerror', (e) => errors.push(e.message));
    const load = await game.evaluate((raw) => {
      if ((ZS.editorApi || 1) < 2) return { old: true };
      const issues = __zs.load(raw);
      __zs.start();
      __zs.god(true);
      return { levels: Array.from(LV), stairs: World.stairs.length, errors: (issues && issues.errors) || [] };
    }, testMap());
    if (load.old) { ok(false, 'ce jeu ne connaît pas les étages (jeu 1.4.0 ou plus récent)'); return; }
    ok(load.levels.join() === '-1,0,1' && load.stairs === 5 && !load.errors.length, 'carte d’essai : trois niveaux, cinq escaliers', load);

    // 1. un zombie poursuit le joueur dans chaque escalier, dans les deux sens, puis sur plusieurs niveaux
    const chase = await game.evaluate(() => {
      const quiet = () => { G.roundState = 'pre'; G.roundT = 1e9; };
      const center = (c) => [c[0] + 0.5, c[1] + 0.5];
      const out = [];
      const addZombie = (x, z, li) => {
        const k = nearestNode(x, z, LVY[li]);
        const zb = spawnZombie({ riser: true, x, z, zone: zoneOf[k], li, k }, 1e6);
        zb.state = 'chase'; zb.t = 0; zb.pos.y = zb.gy; zb.speed = 2.6; zb.speedType = 'jog';
        return zb;
      };
      const run = (label, from, fromLi, to, toLi, maxSteps = 900) => {
        clearZombies(); quiet();
        placePlayer(to[0], to[1], LV[toLi]);
        const zb = addZombie(from[0], from[1], fromLi);
        Zombies.flowT = 0;
        let maxDgy = 0, badNode = 0, steps = 0, reached = false, prevGy = zb.gy;
        for (; steps < maxSteps; steps++) {
          __zs.step(1, 0.05);
          if (zb.removed) break;
          maxDgy = Math.max(maxDgy, Math.abs(zb.gy - prevGy)); prevGy = zb.gy;
          if (zb.k < 0 || !walkNode(zb.k) || Math.abs(surfY(zb.k, zb.pos.x, zb.pos.z) - zb.gy) > 1e-3) badNode++;
          if (zb.state === 'attack') { reached = true; break; }
        }
        out.push({ label, reached, s: +(steps * 0.05).toFixed(1), maxDgy: +maxDgy.toFixed(3), badNode, removed: !!zb.removed });
      };
      World.stairs.forEach((st, i) => {
        const bot = center(st.plan.entries[0]), top = center(st.plan.exits[0]);
        const name = `${'ABCDE'[i]} (${st.s.shape}, ${st.s.mat})`;
        run(`${name} monte`, bot, st.li, top, st.liUp);
        run(`${name} descend`, top, st.liUp, bot, st.li);
      });
      run('cave → étage est (deux escaliers)', [15.5, 10.5], 0, [33.5, 22.5], 2, 2400);
      run('étage ouest → cave (deux escaliers)', [6.5, 25.5], 2, [17.5, 12.5], 0, 2400);
      clearZombies();
      return out;
    });
    for (const r of chase) ok(r.reached && !r.removed && r.badNode === 0 && r.maxDgy < 0.35, `zombie : ${r.label} en ${r.s} s`, r.reached && !r.badNode ? undefined : r);

    // 2. le joueur monte et descend chaque escalier aux touches
    const walk = await game.evaluate(() => {
      const out = [];
      const dist = (target) => {
        const D = new Float32Array(GN * NL).fill(1e9), q = [target];
        D[target] = 0;
        while (q.length) { const i = q.shift(); for (let d = 0; d < 4; d++) { const j = passD(i, d); if (j >= 0 && D[j] > D[i] + 1) { D[j] = D[i] + 1; q.push(j); } } }
        return D;
      };
      const go = (label, from, fromLv, to, toLv) => {
        G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
        placePlayer(from[0], from[1], fromLv);
        const target = nearestNode(to[0], to[1], LVY[levelIndex(toLv)]), D = dist(target);
        let steps = 0, maxDgy = 0, prev = player.gy;
        Input.keys.KeyW = true;
        for (; steps < 800; steps++) {
          let best = D[player.k], bj = -1;
          for (let d = 0; d < 4; d++) { const j = passD(player.k, d); if (j >= 0 && D[j] < best) { best = D[j]; bj = j; } }
          const tx = bj >= 0 ? nodeCX(bj) : to[0], tz = bj >= 0 ? nodeCZ(bj) : to[1];
          player.yaw = Math.atan2(-(tx - player.pos.x), -(tz - player.pos.z)); player.pitch = 0;
          __zs.step(1, 0.05);
          maxDgy = Math.max(maxDgy, Math.abs(player.gy - prev)); prev = player.gy;
          if (player.k === target || (Math.hypot(player.pos.x - to[0], player.pos.z - to[1]) < 0.3 && levelOfNode(player.k) === levelOfNode(target))) break;
        }
        Input.keys.KeyW = false;
        out.push({ label, ok: levelOfNode(player.k) === levelOfNode(target) && Math.hypot(player.pos.x - to[0], player.pos.z - to[1]) < 1.2, s: +(steps * 0.05).toFixed(1), gy: +player.gy.toFixed(2), maxDgy: +maxDgy.toFixed(3) });
      };
      const c = (p) => [p[0] + 0.5, p[1] + 0.5];
      World.stairs.forEach((st, i) => {
        const bot = c(st.plan.entries[0]), top = c(st.plan.exits[0]);
        go(`${'ABCDE'[i]} (${st.s.shape}) monte`, bot, LV[st.li], top, LV[st.liUp]);
        go(`${'ABCDE'[i]} (${st.s.shape}) descend`, top, LV[st.liUp], bot, LV[st.li]);
      });
      return out;
    });
    for (const w of walk) ok(w.ok && w.maxDgy <= 0.35, `joueur : ${w.label} en ${w.s} s, sol à ${w.gy} m`, w.ok ? undefined : w);

    // 3. tirs et explosions
    const hits = await game.evaluate(() => {
      const res = [];
      const ray = (label, o, d, y, tol = 0.02) => {
        const L = Math.hypot(d[0], d[1], d[2]);
        raycast(o[0], o[1], o[2], d[0] / L, d[1] / L, d[2] / L, 60);
        res.push({ label, ok: RAY.hit && Math.abs(RAY.y - y) < tol, y: +RAY.y.toFixed(3) });
      };
      ray('tir vers le haut : plafond du rez-de-chaussée', [30.5, 1.6, 22.5], [0, 1, 0], WALL_H);
      ray('tir vers le bas : sol de l’étage', [30.5, LVY[2] + 1.6, 22.5], [0, -1, 0], LVY[2]);
      ray('tir à travers la trémie : plafond de l’étage', [10.5, LVY[1] + 2.9, 20.5], [0, 1, 0], LVY[2] + WALL_H);
      ray('tir vers le bas : marche de l’escalier', [9.5, LVY[1] + 3.2, 20.5], [0, -1, 0], surfY(node(1, 9, 20), 9.5, 20.5));
      G.roundState = 'pre'; G.roundT = 1e9; clearZombies();
      placePlayer(5.5, 5.5, 0);
      const mk = (x, z, li) => { const k = nearestNode(x, z, LVY[li]); const zb = spawnZombie({ riser: true, x, z, zone: zoneOf[k], li, k }, 500); zb.state = 'chase'; zb.pos.y = zb.gy; return zb; };
      const above = mk(30.5, 22.5, 2), side = mk(32.5, 22.5, 1), below = mk(15.5, 10.5, 0);
      explode(30.5, 0.3, 22.5, 4.5, 400, { src: 'grenade' });
      explode(15.5, LVY[1] + 0.3, 10.5, 4.5, 400, { src: 'grenade' });
      res.push({ label: 'explosion : le zombie de l’étage au-dessus est épargné', ok: above.hp === above.maxHp });
      res.push({ label: 'explosion : le zombie du même sol est touché', ok: side.hp < side.maxHp || !side.alive });
      res.push({ label: 'explosion : le zombie de la cave en dessous est épargné', ok: below.hp === below.maxHp });
      clearZombies();
      return res;
    });
    for (const h of hits) ok(h.ok, h.label, h.ok ? undefined : h);

    // 4. partie simulée (150 s) : les zombies de chaque fenêtre et de chaque apparition arrivent
    const soak = await game.evaluate(() => {
      __zs.dogs(false);                 // manches de chiens à part (dogs.e2e.js) : ici, les zombies des fenêtres
      G.roundState = 'pre'; G.roundT = 0;
      placePlayer(20.5, 22.5, 0);
      const origin = new Map(), reached = new Map(), spawned = new Map();
      let recycled = 0;
      const orig = window.spawnZombie, origRecycle = window.recycleZombie;
      window.spawnZombie = function (sp, hp) {
        const z = orig(sp, hp);
        if (z) { const o = sp.riser ? `apparition (niveau ${LV[sp.li]})` : `fenêtre (niveau ${LV[sp.li]})`; origin.set(z, o); spawned.set(o, (spawned.get(o) || 0) + 1); }
        return z;
      };
      window.recycleZombie = function (z) { recycled++; return origRecycle(z); };
      const run = (steps, until) => {
        for (let i = 0; i < steps && !(until && until()); i++) {
          __zs.step(1, 0.05);
          for (const z of Zombies.list) {
            if (z.alive && z.state === 'attack' && !z.__counted) {
              z.__counted = true;
              const o = origin.get(z) || '?';
              reached.set(o, (reached.get(o) || 0) + 1);
              killZombie(z, { kind: 'knife', dx: 0, dz: 1 });
            }
          }
        }
      };
      const forced = [];
      try {
        run(3000);
        // une sorte d'apparition (pièce ouverte) que le tirage au sort n'a pas choisie pendant la partie :
        // un zombie y est placé exprès, il doit lui aussi atteindre le joueur (l'essai ne dépend pas du hasard)
        const kinds = new Map();
        for (const sp of [...World.windows, ...World.risers]) {
          const o = sp.riser ? `apparition (niveau ${LV[sp.li]})` : `fenêtre (niveau ${LV[sp.li]})`;
          if (G.activeZones.has(sp.zone) && !kinds.has(o)) kinds.set(o, sp);
        }
        for (const [o, sp] of kinds) {
          if (spawned.has(o)) continue;
          const z = window.spawnZombie(sp, 100);
          if (!z) continue;
          forced.push(o);
          run(1600, () => z.__counted || !z.alive);
        }
        // une sorte dont les zombies sont sortis tard (fin de partie) : encore jusqu'à 2 min pour arriver
        run(2400, () => [...spawned.keys()].every((o) => reached.has(o)));
      } finally { window.spawnZombie = orig; window.recycleZombie = origRecycle; }
      return { spawned: Object.fromEntries(spawned), reached: Object.fromEntries(reached), forced, recycled, round: G.round };
    });
    const kinds = Object.keys(soak.spawned);
    ok(kinds.length >= 3 && kinds.every((k) => (soak.reached[k] || 0) > 0) && soak.recycled === 0, 'partie simulée : chaque sorte d’apparition atteint le joueur, aucun zombie bloqué', soak);
    ok(!errors.length, 'aucune erreur JavaScript dans le jeu', errors.slice(0, 3));
  } catch (e) {
    failures++;
    console.error('ÉCHEC', e);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s)` : 'Étages et escaliers : tous les essais sont passés.');
  process.exit(failures ? 1 : 0);
})();
