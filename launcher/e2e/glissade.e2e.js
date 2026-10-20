'use strict';
/* Glissade, annulation de glissade et sprint tactique (jeu 2.0.6), dans la fenêtre du jeu du launcher : paquet
   d'Anthony chargé (mouvement-cod.js, mouvement-effets.js, nouveau survivant.js) ; glissade depuis le sprint
   (0,65 s, pointe 1,55 × la marche du jeu, environ 3,6 m avec le STG-44, accroupi à la fin), mêmes durée et
   distance à 30 et 144 images par seconde ; annulation par Espace, C et Maj (élan gardé) ; C en marchant :
   accroupi, sans glissade ; yeux à ceux de son corps, pieds au sol ; tir permis après 0,33 s (un clic pendant le
   délai part à la fin) ; sprint tactique au double appui sur Maj (× 1,233 le sprint du jeu, 4 s), ramené au
   sprint par le tir ; un mur arrête la glissade ; aucun enchaînement ne dépasse la pointe ; pas de glissade sur
   la Lune ni à terre ; poussière ; Khamsin : sable, plus loin en descente qu’en montée ; partie de test des Mod Tools
   (bouton Test) ; rendu sans erreur.
     xvfb-run -a node e2e/glissade.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-glissade-'));
const USER = path.join(TMP, 'joueur');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    const res = [];
    const report = (r) => res.push(r);
    // ------------------------------------------------------------ Bunker 7 : glissade, annulations, sprint tactique
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const near = (a, b, d) => Math.abs(a - b) <= d;
      ok(typeof MouvementCoD === 'object' && MouvementCoD.version === '1.0.0' && typeof MouvementEffets === 'object' && typeof glStep === 'function' && GLISSADE.on,
        'paquet chargé : contrôleur (mouvement-cod.js 1.0.0) et effets (mouvement-effets.js)');
      const dl = [...document.querySelectorAll('dt')].map((d) => d.textContent + ' ' + (d.nextElementSibling ? d.nextElementSibling.textContent : ''));
      ok(dl.some((t) => /C en sprint/.test(t) && /Glissade/.test(t)) && dl.some((t) => /Maj/.test(t) && /sprint tactique/.test(t)), 'commandes : glissade et sprint tactique décrites', dl);
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
      __zs.give('stg44', 0); __zs.step(30);
      ok(PERSO.hero && PERSO.hero.poses && PERSO.hero.poses.slide && PERSO.hero.poses.slideHip, 'son corps : le nouveau survivant.js (poses de glissade)');
      const p = player, KEYS = ['KeyW', 'ShiftLeft', 'KeyC', 'Space'];
      const K = (c, v) => { Input.keys[c] = v; if (v) Input.down[c] = true; };
      const clear = () => { for (const k of KEYS) Input.keys[k] = false; Input.lmb = false; };
      const sp = () => Math.hypot(p.vel.x, p.vel.z);
      const S0 = { x: p.pos.x, z: p.pos.z };
      const ray = (yaw) => { raycast(p.pos.x, p.gy + 0.6, p.pos.z, -Math.sin(yaw), 0, -Math.cos(yaw), 60); return RAY.hit ? RAY.t : 60; };
      let best = null;
      for (let a = 0; a < 360; a += 5) { const y = a * Math.PI / 180, d = ray(y); if (!best || d > best.d) best = { y, d }; }
      const reset = (dt = 1 / 60) => { clear(); __zs.tp(S0.x, S0.z, best.y); p.vel.set(0, 0, 0); glReset(); p.crouch = 0; p.stamina = 1; __zs.step(20, dt); };
      const run = (o = {}) => {
        const dt = o.dt || 1 / 60;
        reset(dt);
        for (let i = 0; i < Math.round(0.9 / dt); i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1, dt); }
        const r = { avant: GL.out.state, rows: [] }, t0 = G.time, m0 = curSlot().mag;
        K('KeyC', true);
        if (o.feu) { Input.lmb = true; Input.lmbDown = true; }
        let done = false;
        for (let i = 0; i < Math.round(1.4 / dt); i++) {
          const t = G.time - t0;
          if (o.cancel && !done && t >= 0.3) {
            done = true;
            if (o.cancel === 'jump') K('Space', true);
            if (o.cancel === 'crouch') { Input.keys.KeyC = false; __zs.step(1, dt); K('KeyC', true); }
            if (o.cancel === 'sprint') { Input.keys.ShiftLeft = false; __zs.step(1, dt); K('ShiftLeft', true); }
          }
          if (o.lacheC && t > o.lacheC) Input.keys.KeyC = false;
          if (o.feu && !o.tenu) Input.lmb = false;
          __zs.step(1, dt);
          if (o.feu && r.tir === undefined && curSlot().mag < m0) r.tir = G.time - t0;
          const B = PERSO.hero.bones, e = persoEye(PERSO.av), s = PERSO.taille;
          const sole = Math.min(...['L', 'R'].map((S) => Math.min(B['foot' + S].getWorldPosition(new THREE.Vector3()).y - PERSO.ankle * s, B['toes' + S].getWorldPosition(new THREE.Vector3()).y - 0.015))) - p.gy;
          r.rows.push({ t, st: GL.out.state, v: sp(), oeil: camera.position.y - p.gy - p.y, corps: e.y - p.gy, w: PERSO.hero.state.slide, sole });
        }
        Input.lmb = false;
        const f = GL.mesure && GL.mesure.fin;
        r.fin = f ? { duree: f.t - GL.mesure.t0, dist: f.dist, by: f.by, sortie: f.exitSpeed, pointe: GL.mesure.vmax } : null;
        r.apres = { st: GL.out.state, stance: GL.out.stance, crouch: p.crouch, v: sp() };
        return r;
      };
      const c = () => GL.move.config;
      const plat = run({});
      const walk = c().walkSpeed, f = plat.fin;
      ok(plat.avant === 'sprint' && f && f.by === 'time' && near(f.duree, 0.65, 0.03) && f.dist > 3.3 && f.dist < 4.2 && near(f.pointe, 1.55 * walk, 0.05) && plat.apres.stance === 'crouch',
        `glissade depuis le sprint : ${f && f.duree.toFixed(3)} s, ${f && f.dist.toFixed(2)} m, pointe ${f && f.pointe.toFixed(2)} m/s (1,55 × ${walk.toFixed(2)}), accroupi à la fin`, f);
      const ss = plat.rows.filter((x) => x.st === 'slide' && x.t > 0.3 && x.t < 0.6);
      const ecart = Math.max(...ss.map((x) => Math.abs(x.oeil - x.corps)));
      ok(near(Math.min(...plat.rows.map((x) => x.oeil)), GLISSADE.oeil, 0.02) && ecart < 0.04,
        `yeux en glissade à ${GLISSADE.oeil} m, ceux de son corps (écart ${(ecart * 100).toFixed(1)} cm)`);
      const sous = Math.min(...plat.rows.filter((x) => x.w > 0.01).map((x) => x.sole));
      ok(sous > -0.02, `pieds au sol pendant la glissade et ses transitions (le plus bas : ${(sous * 100).toFixed(1)} cm)`);
      const r30 = run({ dt: 1 / 30 }), r144 = run({ dt: 1 / 144 });
      ok(r30.fin && r144.fin && Math.abs(r30.fin.dist - r144.fin.dist) < 0.15 && Math.abs(r30.fin.duree - r144.fin.duree) < 0.04,
        `mêmes durée et distance à 30 et 144 images/s (${r30.fin && r30.fin.dist.toFixed(2)} et ${r144.fin && r144.fin.dist.toFixed(2)} m)`);
      const lc = run({ lacheC: 0.15 });
      ok(lc.apres.stance === 'stand' && lc.apres.st === 'sprint', 'C lâché pendant la glissade : il se relève à la fin et repart en sprint', lc.apres);
      for (const by of ['jump', 'crouch', 'sprint']) {
        const a = run({ cancel: by, lacheC: by === 'crouch' ? 0.1 : 0 });
        ok(a.fin && a.fin.by === by && a.fin.duree < 0.36 && a.fin.sortie > 0.85 * c().sprintSpeed && a.apres.stance === 'stand',
          `annulation par ${{ jump: 'Espace', crouch: 'C', sprint: 'Maj' }[by]} à 0,3 s : relevé, élan gardé (${a.fin && a.fin.sortie.toFixed(2)} m/s)`, a.fin);
      }
      reset();
      for (let i = 0; i < 40; i++) { Input.keys.KeyW = true; __zs.step(1); }
      K('KeyC', true); const sts = new Set();
      for (let i = 0; i < 40; i++) { Input.keys.KeyW = true; __zs.step(1); sts.add(GL.out.state); }
      ok(sts.size === 1 && sts.has('crouch') && near(p.crouch, 1, 0.02), 'C en marchant : accroupi, sans glissade', [...sts]);
      const feu = run({ feu: true, tenu: true });
      ok(feu.tir !== undefined && feu.tir >= 0.33 - 1e-3 && feu.tir < 0.36, `tir permis 0,33 s après le début de la glissade (premier coup à ${feu.tir && feu.tir.toFixed(3)} s)`);
      __zs.give('m1911', 0); __zs.step(30);
      const clic = run({ feu: true });
      ok(clic.tir !== undefined && clic.tir >= 0.33 - 1e-3 && clic.tir < 0.36, `pistolet : le clic fait au début de la glissade part à 0,33 s (${clic.tir && clic.tir.toFixed(3)} s)`);
      __zs.give('stg44', 0); __zs.step(30);
      // sprint tactique : double appui sur Maj
      reset();
      K('ShiftLeft', true); for (let i = 0; i < 12; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); }
      Input.keys.ShiftLeft = false; __zs.step(2); K('ShiftLeft', true);
      const t0 = G.time; let fin = null, vt = 0;
      for (let i = 0; i < 300 && fin === null; i++) {
        Input.keys.KeyW = true; Input.keys.ShiftLeft = true; if (i % 80 === 0) __zs.tp(S0.x, S0.z, best.y);
        __zs.step(1); if (GL.out.state === 'tacSprint') vt = Math.max(vt, sp()); else if (G.time - t0 > 0.2) fin = G.time - t0;
      }
      ok(fin !== null && near(fin, 4.0, 0.1) && near(vt, c().sprintSpeed * GLISSADE.tac, 0.05),
        `sprint tactique au double appui sur Maj : ${vt.toFixed(2)} m/s (× ${GLISSADE.tac.toFixed(3)} le sprint) pendant ${fin && fin.toFixed(2)} s`);
      reset();
      K('ShiftLeft', true); for (let i = 0; i < 12; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); }
      Input.keys.ShiftLeft = false; __zs.step(2); K('ShiftLeft', true);
      for (let i = 0; i < 30; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); }
      const avant = GL.out.state, m0 = curSlot().mag, t1 = G.time; let tir = null;
      Input.lmb = true; Input.lmbDown = true;
      for (let i = 0; i < 40; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); if (tir === null && curSlot().mag < m0) tir = G.time - t1; }
      Input.lmb = false;
      ok(avant === 'tacSprint' && GL.out.state === 'sprint' && tir !== null && tir < 0.25, `sprint tactique : le tir le ramène au sprint, le coup part à ${tir && tir.toFixed(2)} s`);
      // mur, enchaînements, Lune, à terre
      reset();
      let rem = ray(best.y);
      for (let i = 0; i < 600 && rem > 2; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); rem = ray(best.y); }
      K('KeyC', true); let minRem = rem;
      for (let i = 0; i < 70; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); minRem = Math.min(minRem, ray(best.y)); }
      const fm = GL.mesure && GL.mesure.fin;
      ok(fm && fm.by === 'obstacle' && minRem > p.radius, `mur de face : la glissade s'arrête (${fm && (fm.t - GL.mesure.t0).toFixed(2)} s), le joueur reste à ${minRem.toFixed(2)} m`);
      reset(); let vm = 0;
      for (let i = 0; i < 240; i++) {
        Input.keys.KeyW = true; Input.keys.ShiftLeft = true;
        if (i > 50 && i % 14 === 0) K('KeyC', true);
        if (i > 50 && i % 14 === 7) { Input.keys.ShiftLeft = false; __zs.step(1); K('ShiftLeft', true); }
        if (i % 60 === 0) __zs.tp(S0.x, S0.z, best.y);
        __zs.step(1); vm = Math.max(vm, sp());
      }
      ok(vm <= c().slidePeakSpeed + 0.01, `glissades et annulations enchaînées : jamais plus vite que la pointe (${vm.toFixed(2)} m/s)`);
      ok(GL.dust && GL.dust.object && GL.dust.object.parent === scene && GL.surface === 'beton', 'poussière de la glissade (béton à Bunker 7)', GL.surface);
      const gm = GRAV.moon; GRAV.moon = true; const nul = glStep(1 / 60, 1, 0, 1, false, true); GRAV.moon = gm;
      reset(); p.down = true; const nul2 = glStep(1 / 60, 1, 0, 1, false, true); p.down = false;
      ok(nul === null && nul2 === null && !GL.actif, 'pas de glissade sur la Lune ni à terre (déplacements du jeu)');
      clear(); renderEnabled = true; render(); renderEnabled = false;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Khamsin : sable et pente
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __zs.map('khamsin'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true); G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies(); __zs.step(5);
      __zs.give('stg44', 0); __zs.step(30);
      const p = player, K = (c, v) => { Input.keys[c] = v; if (v) Input.down[c] = true; };
      const clear = () => { for (const k of ['KeyW', 'ShiftLeft', 'KeyC', 'Space']) Input.keys[k] = false; };
      const X0 = p.pos.x, Z0 = p.pos.z;
      let pente = null;
      for (let r = 0; r <= 420 && !pente; r += 8) for (let a = 0; a < 360 && !pente; a += 10) {
        const x = X0 + r * Math.cos(a * Math.PI / 180), z = Z0 + r * Math.sin(a * Math.PI / 180);
        if ((zoneOn() && zoneDist(x, z) > -3) || !owWalkCell(0, Math.floor(x), Math.floor(z))) continue;
        for (let b = 0; b < 360; b += 30) {
          const yw = b * Math.PI / 180, dx = -Math.sin(yw), dz = -Math.cos(yw), h = [0, 1.5, 3, 4.5, 6].map((d) => owGroundAt(0, x + dx * d, z + dz * d));
          if (h.some((v) => !Number.isFinite(v))) continue;
          const s = (h[4] - h[0]) / 6, reg = Math.max(...h.map((v, i) => Math.abs(v - (h[0] + s * i * 1.5))));
          if (s < -0.1 && s > -0.45 && reg < 0.12 && [1.5, 3, 4.5, 6].every((d) => owWalkCell(0, Math.floor(x + dx * d), Math.floor(z + dz * d)))) { pente = { x, z, yaw: yw, s }; break; }
        }
      }
      const slide = (sens) => {
        clear(); const yaw = sens < 0 ? pente.yaw + Math.PI : pente.yaw, dx = -Math.sin(yaw), dz = -Math.cos(yaw);
        __zs.tp(pente.x - dx * (sens < 0 ? 10 : 4), pente.z - dz * (sens < 0 ? 10 : 4), yaw); p.vel.set(0, 0, 0); glReset(); p.stamina = 1; __zs.step(10);
        K('ShiftLeft', true); for (let i = 0; i < 40; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); }
        K('KeyC', true); for (let i = 0; i < 50; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); }
        return GL.mesure && GL.mesure.fin;
      };
      ok(pente, 'Khamsin : une pente dans la zone jouable', pente);
      if (pente) {
        const d = slide(1), m = slide(-1);
        ok(d && m && d.exitSpeed > m.exitSpeed + 0.5 && d.dist > m.dist + 0.1,
          `pente de ${(Math.abs(pente.s) * 100).toFixed(0)} % : plus loin et plus vite en descente (${d && d.dist.toFixed(2)} m, ${d && d.exitSpeed.toFixed(2)} m/s) qu'en montée (${m && m.dist.toFixed(2)} m, ${m && m.exitSpeed.toFixed(2)} m/s)`);
      }
      ok(GL.surface === 'sable', 'Khamsin : poussière et frottement du sable', GL.surface);
      clear(); renderEnabled = true; render(); renderEnabled = false;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Mod Tools : partie de test (bouton Test)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ZS.playTest(MAPS.byId.bunker7); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true); G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies(); __zs.give('stg44', 0); __zs.step(30);
      const p = player, K = (c, v) => { Input.keys[c] = v; if (v) Input.down[c] = true; };
      let best = null;
      for (let a = 0; a < 360; a += 5) { const y = a * Math.PI / 180; raycast(p.pos.x, p.gy + 0.6, p.pos.z, -Math.sin(y), 0, -Math.cos(y), 60); const d = RAY.hit ? RAY.t : 60; if (!best || d > best.d) best = { y, d }; }
      p.yaw = best.y; glReset(); __zs.step(5);
      K('ShiftLeft', true); for (let i = 0; i < 54; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); }
      K('KeyC', true); for (let i = 0; i < 50; i++) { Input.keys.KeyW = true; Input.keys.ShiftLeft = true; __zs.step(1); }
      for (const k of ['KeyW', 'ShiftLeft', 'KeyC']) Input.keys[k] = false;
      const f = GL.mesure && GL.mesure.fin;
      ok(G.editorSession && f && f.by === 'time' && Math.abs(f.t - GL.mesure.t0 - 0.65) < 0.03, 'Mod Tools, partie de test (bouton Test) : la glissade fonctionne', f);
      ZS.stopTest();
      return out;
    })).forEach(report);
    for (const r of res) {
      if (!r.ok) failures++;
      console.log(`${r.ok ? 'ok    ' : 'ÉCHEC '} ${r.label}${r.ok || r.extra === undefined ? '' : ` → ${JSON.stringify(r.extra)}`}`);
    }
    if (errors.length) { failures++; console.log(`ÉCHEC  erreurs JavaScript dans le jeu → ${JSON.stringify(errors.slice(0, 5))}`); }
  } catch (e) {
    failures++;
    console.log(`ÉCHEC  ${e && e.stack || e}`);
  } finally {
    if (app) await app.close().catch(() => {});
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} échec(s).` : 'Glissade : conforme (glissade, annulations, sprint tactique, tir, mur, pente, sable).');
  process.exit(failures ? 1 : 0);
})();
