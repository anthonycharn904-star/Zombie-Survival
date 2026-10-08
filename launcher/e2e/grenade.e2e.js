'use strict';
/* Grenade Mk 2 et lancer animé (jeu 1.9.0), dans la fenêtre du jeu du launcher : modèle (corps
   quadrillé de 40 plots, 58 × 114 mm, fusée, cuillère, goupille, anneau), torse et grenades
   accrochées selon le nombre restant ; G : arme baissée, tête baissée vers le torse, grenade prise
   puis décrochée, présentée, anneau tiré par l'index gauche (goupille sortie), bras armé, lancer
   (grenade lâchée, cuillère qui saute, goupille qui tombe, explosion 2,3 s après le lâcher) ; G
   tenue : grenade prête sans limite de temps ; R : annulation avec ou sans goupille à remettre,
   grenade raccrochée à sa place, aucune grenade perdue ; à terre ; sons ; rendu.
     xvfb-run -a node e2e/grenade.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-grenade-'));
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

    // ----------------------------------------------------------------- modèle
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      ok(GAME_VERSION === '1.9.0', 'version du jeu inchangée : 1.9.0', GAME_VERSION);
      const n = buildNade('hi'), P = n.userData.parts;
      ok(['body', 'fuze', 'lever', 'pin', 'ring'].every((k) => P[k]), 'grenade : corps, fusée, cuillère, goupille et anneau');
      const b = new THREE.Box3().setFromObject(P.body), all = new THREE.Box3().setFromObject(n);
      const dia = (b.max.x - b.min.x) * 1000, h = (b.max.y - b.min.y) * 1000;
      const top = (new THREE.Box3().setFromObject(P.fuze).union(new THREE.Box3().setFromObject(P.lever)).max.y - b.min.y) * 1000;
      ok(Math.abs(dia - 58) < 2 && h > 88 && h < 95 && top > 109 && top < 116, `dimensions de la Mk 2 : diamètre ${dia.toFixed(1)} mm (58), corps et col ${h.toFixed(1)} mm (89 sans le col), ${top.toFixed(1)} mm avec la fusée (110 à 114 selon les sources)`);
      // plots : rayon le long d'un anneau à mi-hauteur (8 creux) et d'un méridien (5 plots entre 6 gorges)
      const pos = P.body.geometry.attributes.position, ring = [], mer = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r = Math.hypot(x, z), a = Math.atan2(x, z);
        if (Math.abs(y - (42.9 - NADE_Y0) * NADE_MM) < 0.0004) ring.push([a, r]);
        if (Math.abs(a) < 0.004 && y > (4 - NADE_Y0) * NADE_MM && y < (82 - NADE_Y0) * NADE_MM) mer.push([y, r - nadeR(y / NADE_MM + NADE_Y0) * NADE_MM]);
      }
      ring.sort((p, q) => p[0] - q[0]); mer.sort((p, q) => p[0] - q[0]);
      const dips = (arr, th) => { let n = 0, inDip = false; for (const [, v] of arr) { if (v < th && !inDip) { n++; inDip = true; } else if (v >= th) inDip = false; } return n; };
      const rmax = Math.max(...ring.map((p) => p[1]));
      const nCols = dips(ring, rmax - 0.002), nRows = dips(mer, -0.002);
      ok(nCols === 8 && nRows === 6, `corps quadrillé : ${nCols} gorges sur le tour, ${nRows} gorges le long du corps (5 rangées de 8 plots = 40)`, { nCols, nRows });
      const G = nadeGeometries(), tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
      ok(tri(G.body.hi) < 20000 && tri(G.body.mid) < 8000 && tri(G.body.lo) < 3000, `triangles : ${tri(G.body.hi)} en main, ${tri(G.body.mid)} sur le torse, ${tri(G.body.lo)} lancée`);
      // goupille : enfoncée, la cuillère tenue ; anneau du côté opposé à la paume
      nadeSetPin(n, 0, 0, NADE_RING.rest); n.updateMatrixWorld(true);
      const ringC = P.ring.getWorldPosition(new THREE.Vector3());
      const g = nadeGripR();
      ok(ringC.x < -0.012 && g.p.x > 0.02, `prise : paume du côté droit (poignet x = ${(g.p.x * 1000).toFixed(0)} mm), anneau du côté gauche (x = ${(ringC.x * 1000).toFixed(0)} mm)`);
      // pouce de la main droite en travers de la cuillère
      const hand = buildHand(false);
      hand.wrist.position.copy(g.p); hand.wrist.quaternion.copy(g.q); setHandPose(hand, g.pose); hand.wrist.updateMatrixWorld(true);
      const lever = new THREE.Box3().setFromObject(P.lever);
      const th = hand.thumb[1].getWorldPosition(new THREE.Vector3());
      const dLever = Math.max(0, th.z - lever.max.z);
      ok(th.y > -0.01 && th.y < 0.045 && Math.abs(th.x) < 0.02 && dLever < 0.016, `pouce droit sur la cuillère (articulation du milieu : ${(th.x * 1000).toFixed(0)}, ${(th.y * 1000).toFixed(0)}, ${(th.z * 1000).toFixed(0)} mm)`, th.toArray());
      ok(g.fit.miss.length === 0, 'doigts de la main droite fermés sur la grenade', g.fit.miss);
      return out;
    })).forEach(report);

    // --------------------------------------------------------------- partie
    await game.evaluate(() => {
      renderEnabled = false;
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9;
      clearZombies();
      if (__zs.dogs) __zs.dogs(false);
      __zs.step(60);
      window.__press = (c) => { Input.keys[c] = true; Input.down[c] = true; };
      window.__up = (c) => { Input.keys[c] = false; };
      window.__run = (sec, fn) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { update(1 / 60); endFrameInput(); if (fn && fn(i / 60) === false) break; } };
      window.__fresh = (n = 4) => {
        nadeReset(); Arms.state = 'idle'; G.grenades = n; player.pitch = 0; player.down = false;
        for (const g of FX.grenades) scene.remove(g.m);
        FX.grenades.length = 0; NadeBits.clear(); __run(0.1);
      };
    });

    // lancer bref (G tapée) : déroulé complet
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh(4);
      const T = NADE_T.draw, W = NADE_T.throw, log = [];
      let tRelease = -1, tExplode = -1, minTilt = 0, chestSeen = false, slotHidden = false, maxS = 0, pinFreeAt = -1, ringOnFinger = Infinity, rightOnNade = 0, gunDown = 0, fired = 0;
      const shots0 = G.stats.shots || 0;
      __press('KeyG');
      let t = 0;
      __run(4.2, (dt) => {
        t += 1 / 60;
        if (t > 0.1) __up('KeyG');
        if (t > 0.3 && t < 0.4) { Input.lmb = true; Input.lmbDown = true; } else Input.lmb = false;
        const nd = Arms.nd;
        minTilt = Math.min(minTilt, Arms.headTilt);
        if (Nade.chest.visible) chestSeen = true;
        if (nd && nd.inHand && Nade.chest.visible && !Nade.chest.userData.nades[nd.slot].visible && Nade.hand.visible) slotHidden = true;
        if (nd) { maxS = Math.max(maxS, nd.s); if (nd.pinFree && pinFreeAt < 0) pinFreeAt = t; }
        if (nd && Arms.state === 'nade') gunDown = Math.max(gunDown, nadeGunDown(nd));
        // index gauche dans l'anneau pendant la traction
        if (nd && nd.phase === 'draw' && nd.t > T.pull[0] + 0.02 && nd.t < T.pull[1]) {
          Arms.root.updateMatrixWorld(true);
          const pip = Arms.armL.hand.fingers[0][1].getWorldPosition(new THREE.Vector3());
          const rc = Nade.hand.userData.parts.ring.getWorldPosition(new THREE.Vector3());
          ringOnFinger = Math.min(ringOnFinger, pip.distanceTo(rc));
        }
        // main droite autour de la grenade (présentée)
        if (nd && nd.phase === 'draw' && nd.t > T.present && nd.t < T.cock[0]) {
          Arms.root.updateMatrixWorld(true);
          const w = Arms.armR.hand.wrist.getWorldPosition(new THREE.Vector3());
          rightOnNade = Math.max(rightOnNade, w.distanceTo(Nade.hand.position));
        }
        if (tRelease < 0 && FX.grenades.length) tRelease = t;
        if (tRelease > 0 && tExplode < 0 && !FX.grenades.length) tExplode = t;
        if (Arms.state === 'nade') log.push(nd && nd.phase);
      });
      Input.lmb = false;
      const expect = T.cock[1] + W.release;
      ok(Math.abs(tRelease - expect) < 0.05, `G tapée : grenade lâchée ${tRelease.toFixed(2)} s après l'appui (prise, goupille, bras armé : ${expect.toFixed(2)} s)`);
      ok(G.grenades === 3, 'une grenade en moins, au lâcher', G.grenades);
      ok(tExplode > 0 && Math.abs(tExplode - tRelease - NADE_FUSE) < 0.06, `explosion ${(tExplode - tRelease).toFixed(2)} s après le lâcher (cuillère partie : ${NADE_FUSE} s)`);
      ok(minTilt < -0.6 && minTilt > -0.75, `tête baissée vers le torse : ${(minTilt * 57.3).toFixed(0)}° (regard à 40° sous l'horizontale)`);
      ok(Math.abs(Arms.headTilt) < 0.01 && Arms.state === 'idle', 'puis tête relevée et arme en main', { tilt: Arms.headTilt, st: Arms.state });
      ok(chestSeen && slotHidden, 'torse visible, la grenade prise quitte sa place sur la poche');
      ok(gunDown > 0.99, 'arme baissée hors de la vue pendant le geste');
      ok(maxS >= NADE_OUT && pinFreeAt > 0, `goupille tirée : course ${(maxS * 1000).toFixed(0)} mm (libre au-delà de ${(NADE_OUT * 1000).toFixed(0)} mm)`);
      ok(ringOnFinger < 0.03, `index gauche dans l'anneau pendant la traction (articulation à ${(ringOnFinger * 1000).toFixed(0)} mm du centre de l'anneau)`);
      ok(rightOnNade > 0 && rightOnNade < 0.09, `main droite sur la grenade (poignet à ${(rightOnNade * 1000).toFixed(0)} mm de son centre)`);
      ok((G.stats.shots || 0) === shots0, 'pas de tir pendant le geste', G.stats.shots);
      const bits = NadeBits.list.map((b) => b.type).sort().join(' ');
      ok(bits === 'lever pin', 'cuillère sautée et goupille tombée au sol', bits);
      ok(NadeBits.list.every((b) => b.rest), 'cuillère et goupille posées à plat', NadeBits.list.map((b) => b.rest));
      ok(['draw', 'throw'].every((p) => log.includes(p)) && !log.includes('hold'), 'phases : tirer puis lancer (pas de tenue)', [...new Set(log)]);
      return out;
    })).forEach(report);

    // G tenue : grenade prête sans lâcher ; lâcher G → lancer
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh(2);
      __press('KeyG');
      __run(3.5);
      const holding = Arms.nd && Arms.nd.phase === 'hold' && Arms.nd.pinFree && !FX.grenades.length && G.grenades === 2;
      ok(holding, 'G tenue 3,5 s : grenade prête, goupille sortie, cuillère tenue (rien ne part)', { ph: Arms.nd && Arms.nd.phase, n: FX.grenades.length });
      __up('KeyG');
      let t = 0, rel = -1;
      __run(1, () => { t += 1 / 60; if (rel < 0 && FX.grenades.length) rel = t; });
      ok(rel > 0 && Math.abs(rel - NADE_T.throw.release) < 0.05 && G.grenades === 1, `G relâchée : lancer ${rel.toFixed(2)} s après`, { rel, n: G.grenades });
      return out;
    })).forEach(report);

    // R pendant la tenue : goupille remise, grenade raccrochée
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh(3);
      __press('KeyG'); __run(1.6);
      const slot = Arms.nd.slot;
      __press('KeyR');
      let t = 0, sMax = 0, sEnd = -1, repinned = -1, minTilt = 0, handBack = -1;
      const seq = [];
      __run(3, () => {
        t += 1 / 60;
        const nd = Arms.nd;
        if (nd) {
          seq.push(nd.phase);
          sMax = Math.max(sMax, nd.s);
          if (repinned < 0 && nd.s < 0.0005 && nd.phase === 'cancel') repinned = t;
          if (!nd.inHand && handBack < 0 && repinned > 0) handBack = t;
        }
        minTilt = Math.min(minTilt, Arms.headTilt);
      });
      ok(repinned > 0.4 && repinned < 0.7, `R : goupille renfoncée ${repinned.toFixed(2)} s après (index gauche, cuillère toujours tenue)`);
      ok(handBack > repinned && minTilt < -0.6, `puis grenade raccrochée à sa poche, tête baissée (${handBack.toFixed(2)} s)`);
      ok(Arms.state === 'idle' && !Arms.nd && G.grenades === 3 && !FX.grenades.length, 'annulation : aucune grenade perdue ni lancée, arme en main', { st: Arms.state, n: G.grenades });
      ok(NadeBits.list.length === 0, 'rien n’est tombé (cuillère et goupille restées sur la grenade)', NadeBits.list.length);
      // la grenade est revenue à sa place : elle se voit sur le torse au tirer suivant
      __press('KeyG'); __run(0.25);
      const vis = Nade.chest.userData.nades.map((g) => g.visible);
      ok(vis.filter(Boolean).length === 3 && vis[slot], 'au tirer suivant, la grenade est de nouveau sur sa poche', vis);
      __up('KeyG'); __press('KeyR'); __run(1.2);
      return out;
    })).forEach(report);

    // R avant la prise, R avant la goupille, R pendant la traction
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const cancelAt = (at) => {
        __fresh(4);
        __press('KeyG'); __run(at); __up('KeyG');
        const before = { s: Arms.nd.s, inHand: Arms.nd.inHand, pinOut: Arms.nd.pinOut };
        __press('KeyR');
        let ended = -1, t = 0;
        __run(3, () => { t += 1 / 60; if (ended < 0 && Arms.state === 'idle') ended = t; });
        return { before, ended, n: G.grenades, flying: FX.grenades.length, st: Arms.state };
      };
      const a = cancelAt(0.2);
      ok(!a.before.inHand && a.ended > 0 && a.ended < 0.9 && a.n === 4 && !a.flying, `R avant la prise : la main revient à l'arme (${a.ended.toFixed(2)} s)`, a);
      const b = cancelAt(0.6);
      ok(b.before.inHand && !b.before.pinOut && b.ended > 0 && b.ended < 1.0 && b.n === 4 && !b.flying, `R grenade en main, goupille en place : raccrochée sans regoupiller (${b.ended.toFixed(2)} s)`, b);
      const c = cancelAt(0.92);
      ok(c.before.pinOut && c.ended > 0.9 && c.n === 4 && !c.flying, `R pendant la traction : goupille renfoncée puis grenade raccrochée (${c.ended.toFixed(2)} s)`, c);
      // G sans grenade : rien
      __fresh(0);
      __press('KeyG'); __run(0.5);
      ok(Arms.state !== 'nade', 'G sans grenade : rien ne se passe', Arms.state);
      return out;
    })).forEach(report);

    // à terre pendant le geste
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      __fresh(4);
      __press('KeyG'); __run(1.5);
      player.down = true; player.downT = 4.5;
      __run(0.05);
      ok(FX.grenades.length === 1 && G.grenades === 3 && Arms.state !== 'nade', 'à terre, goupille sortie : la grenade tombe aux pieds, cuillère lâchée', { n: FX.grenades.length, g: G.grenades, st: Arms.state });
      const g = FX.grenades[0];
      ok(g && Math.hypot(g.vx, g.vz) < 3, 'elle tombe (pas lancée)', g && [g.vx, g.vz]);
      player.down = false; player.downT = 0; __up('KeyG');
      __fresh(4);
      __press('KeyG'); __run(0.5);
      player.down = true; player.downT = 4.5; __run(0.05);
      ok(!FX.grenades.length && G.grenades === 4, 'à terre, goupille en place : rien ne tombe', { n: FX.grenades.length, g: G.grenades });
      player.down = false; player.downT = 0; __up('KeyG'); __fresh(4);
      // sauvegarde pendant le geste : nombre de grenades d'avant le lâcher
      __press('KeyG'); __run(1.0);
      const s = serializeGame();
      ok(s && s.grenades === 4, 'sauvegarde pendant le geste : 4 grenades (aucune lâchée)', s && s.grenades);
      __up('KeyG'); __press('KeyR'); __run(2);
      return out;
    })).forEach(report);

    // sons et rendu
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      let err = null;
      try { for (const k of ['draw', 'grab', 'unhook', 'twist', 'pull', 'whoosh', 'spoon', 'cancel', 'insert', 'seat', 'hookBack', 'tink']) Sound.nade(k, k === 'spoon' || k === 'tink' ? { x: player.pos.x + 1, y: 0, z: player.pos.z } : null); } catch (e) { err = String(e); }
      ok(typeof Sound.nade === 'function' && !err, '12 sons de la grenade (sangle, goupille, cuillère, lancer, regoupillage, pièces au sol)', err);
      __fresh(4);
      __press('KeyG'); __run(0.3);
      renderEnabled = true;
      const gl = renderer.getContext();
      render();
      const e1 = gl.getError();
      __run(0.5); render();
      renderEnabled = false;
      const progs = renderer.info.programs.filter((p) => p.diagnostics && !p.diagnostics.runnable).length;
      ok(e1 === 0 && progs === 0, 'rendu du torse et de la grenade en main sans erreur', { e1, progs });
      __up('KeyG'); __press('KeyR'); __run(2);
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
  console.log(failures ? `${failures} échec(s).` : 'Grenade : modèle, lancer, annulations et sons conformes.');
  process.exit(failures ? 1 : 0);
})();
