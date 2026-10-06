'use strict';
/* Boisson d'atout (jeu 1.6.0 ; fiole d'élixir depuis le jeu 1.8.0), dans la fenêtre du jeu du
   launcher : noms des atouts et du Pack-A-Punch, achat au distributeur, déroulé de l'animation (arme
   baissée, fiole aux couleurs de l'atout tenue en main, bouchon qui saute, goulot à la bouche,
   gorgées, tête en arrière, atout accordé après la dernière gorgée), fiole jetée au sol qui se brise
   au premier choc, éclats et bouts d'étiquette posés là où elle s'est cassée et qui y restent, fiole
   qui se brise contre la machine elle-même (pas contre sa case), joueur à terre pendant la boisson,
   tête jamais renversée au-delà de la verticale, éclats effacés à la partie suivante.
     xvfb-run -a node e2e/perk-drink.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-atouts-'));
const USER = path.join(TMP, 'joueur');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    const res = await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const r2 = (v) => Math.round(v * 100) / 100;
      // ---------------------------------------------------------------- noms
      const want = { cuirasse: 'Mastodonte', mainleste: 'Rechargement rapide', detente: 'Double coup', souffle: 'Quick Revive', endurance: 'Staminup' };
      const names = Object.fromEntries(Object.keys(want).map((k) => [k, PERKS[k] && PERKS[k].name]));
      ok(Object.keys(want).every((k) => names[k] === want[k]) && Object.keys(PERKS).length === 5, 'atouts : Mastodonte, Rechargement rapide, Double coup, Quick Revive, Staminup', names);
      ok(!document.documentElement.outerHTML.includes('Amplificateur'), 'plus aucun « Amplificateur » dans le jeu');

      __zs.start(); __zs.god(true);
      G.roundState = 'pre'; G.roundT = 1e9;
      G.points = 50000;
      const amp = Features.interactables.find((i) => i.kind === 'amp');
      const ap = amp && amp.prompt();
      ok(ap && ap.text === 'Le Glas est muet : il faut du courant' && ap.disabled, 'Le Glas (le Pack-A-Punch) sans courant : muet', ap);
      __zs.power();
      __zs.step(60 * 4, 1 / 60);
      const ap2 = amp && amp.prompt();
      ok(ap2 && ap2.text === 'Appuyez sur F pour faire une offrande' && ap2.cost === 5000, 'Le Glas réveillé par le courant : « faire une offrande », 5 000', ap2);

      // -------------------------------------------------- achat et boisson
      const machine = (id) => {
        const m = Features.perkMachines.find((pm) => pm.id === id);
        const it = Features.interactables.find((i) => i.kind === 'perk' && i.machine === m);
        return { m, it, yaw: Math.atan2(-(m.cell[0] + 0.5 - it.x), -(m.cell[1] + 0.5 - it.z)) };
      };
      const goTo = (id, pitch = -0.08) => {
        const q = machine(id);
        __zs.tp(q.it.x, q.it.z, q.yaw);
        player.pitch = pitch;
        __zs.step(10, 1 / 60);
        return q;
      };
      const hits = [];
      const shatter = window.shatterBottle;
      window.shatterBottle = function (...a) { hits.push({ id: a[0], x: a[1], y: a[2], z: a[3], n: [a[4], a[5], a[6]] }); return shatter.apply(this, a); };
      const at = (T) => { let n = 0; while (Arms.state === 'drink' && Arms.t < T - 1e-6 && n < 2000) { __zs.step(1, Math.min(1 / 60, T - Arms.t)); n++; } };
      const B = Arms.bottle;
      const view = (lx, ly, lz) => { B.updateMatrixWorld(true); return new THREE.Vector3(lx, ly, lz).applyMatrix4(B.matrixWorld); };

      const qr = goTo('souffle');
      const pr = qr.it.prompt();
      ok(pr && pr.text === 'Appuyez sur F pour boire Quick Revive' && pr.cost === 500, 'distributeur : « Appuyez sur F pour boire Quick Revive », 500 points', pr);
      const pts = G.points;
      qr.it.use();
      ok(Arms.state === 'drink' && Arms.drinkId === 'souffle' && G.points === pts - 500, 'achat : 500 points payés, la boisson commence', { st: Arms.state, d: pts - G.points });
      ok(qr.it.prompt() === null, 'pendant la boisson : plus d’invite pour ce distributeur');
      ok(B.userData.label.material.map === TEX.bottleLabel.souffle && B.userData.cap.visible && B.userData.shape.kind === 'flask', 'fiole (ballon) aux couleurs de Quick Revive, bouchon en place');
      at(DRINK.lower + 0.03);
      const hip = Arms.gun.userData.info.hip[1];
      ok(Arms.holder.position.y < hip - 0.45 && B.visible && Arms.grip.visible, 'arme baissée, fiole en main', { y: r2(Arms.holder.position.y), hip });
      at(DRINK.bring);
      const pb = view(0, 0.08, 0);
      ok(B.visible && pb.z < -0.3 && Math.abs(pb.x) < 0.2 && Math.abs(pb.y) < 0.16, 'fiole présentée devant le joueur (étiquette à l’écran)', [r2(pb.x), r2(pb.y), r2(pb.z)]);
      at(DRINK.cap + 0.03);
      ok(Arms.cap.visible && !B.userData.cap.visible, 'bouchon qui saute');
      at(1.3);
      const neck = view(0, BOTTLE.neck, 0);
      const dm = neck.distanceTo(new THREE.Vector3(...DRINK_MOUTH));
      ok(dm < 0.02, 'goulot à la bouche', r2(dm));
      ok(Arms.headTilt > 0.12 && B.userData.liquid.scale.y < BOTTLE.liquidH && !player.perks.has('souffle'), 'gorgées : tête en arrière, le liquide baisse, atout pas encore accordé', { tilt: r2(Arms.headTilt) });
      at(DRINK.grant - 0.02);
      const before = player.perks.has('souffle');
      at(DRINK.grant + 0.02);
      ok(!before && player.perks.has('souffle'), 'atout accordé après la dernière gorgée');
      ok(document.querySelector('#hud .perk[title="Quick Revive"]') || /title="Quick Revive"/.test(HUD.el.perks.innerHTML), 'icône de l’atout : « Quick Revive »', HUD.el.perks.innerHTML);
      at(DRINK.release + 0.02);
      const b0 = FX.bottles[0];
      ok(FX.bottles.length === 1 && !B.visible && b0 && Math.hypot(b0.x - camera.position.x, b0.y - camera.position.y, b0.z - camera.position.z) < 0.7, 'fiole lâchée devant le joueur', b0 && [r2(b0.x), r2(b0.y), r2(b0.z)]);
      let n = 0;
      while (FX.bottles.length && n < 180) { __zs.step(1, 1 / 60); n++; }
      const h = hits[0];
      const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      const side = h ? (h.x - player.pos.x) * rx + (h.z - player.pos.z) * rz : 0;
      ok(hits.length === 1 && h.id === 'souffle' && h.n[1] === 1 && h.y < 0.02, 'fiole brisée au sol, au premier choc', h);
      ok(h && side > 0.3 && Math.hypot(h.x - player.pos.x, h.z - player.pos.z) < 1.6, 'jetée devant à droite, près du joueur', { side: r2(side) });
      at(DRINK.end + 0.1);
      ok(Arms.state === 'idle' && Arms.holder.position.y > hip - 0.05, 'fin : l’arme est revenue', r2(Arms.holder.position.y));
      __zs.step(60, 1 / 60);
      ok(Math.abs(Arms.headTilt) < 0.01, 'tête revenue droite', Arms.headTilt);
      __zs.step(420, 1 / 60);
      const L = FX.glass.list;
      const total = GLASS.perBottle + GLASS.scraps + 2;
      const far = Math.max(...L.map((e) => Math.hypot(e.x - h.x, e.z - h.z)));
      ok(L.length === total && L.every((e) => e.rest), `${total} morceaux posés (verre, étiquette, fond, goulot)`, { n: L.length, rest: L.filter((e) => e.rest).length });
      ok(far < 1 && L.every((e) => e.y > 0 && e.y < 0.05), 'tous au sol, à moins d’un mètre du point où la bouteille s’est cassée', { far: r2(far) });
      ok(L.filter((e) => e.kind === 'scrap').length === GLASS.scraps && L.filter((e) => e.kind === 'chunk').length === 2, 'bouts d’étiquette, fond et goulot');
      const snap = JSON.stringify(L.map((e) => [e.x, e.y, e.z]));
      __zs.step(600, 1 / 60);
      ok(JSON.stringify(FX.glass.list.map((e) => [e.x, e.y, e.z])) === snap, 'les éclats restent où ils sont (10 s plus tard)');

      // ------------------------------- contre la machine, pas contre sa case
      const mq = machine('souffle'), g = mq.m.group;
      const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
      // façade de la machine à hauteur de la fiole lancée (boîte la plus avancée qui couvre l'axe)
      const front = Math.max(...mq.m.boxes.filter((b) => b[1] <= 1.05 && b[4] >= 1.05 && b[0] <= 0 && b[3] >= 0).map((b) => b[5])) * mq.m.s;
      const face = g.position.x * Math.abs(fx) + g.position.z * Math.abs(fz) + front * (fx + fz);
      hits.length = 0;
      const sx = mq.it.x, sz = mq.it.z;
      throwBottle('souffle', sx, 1.1, sz, -fx * 4, 0.6, -fz * 4);
      n = 0;
      while (FX.bottles.length && n < 120) { __zs.step(1, 1 / 60); n++; }
      const hm = hits[0];
      const along = hm ? hm.x * Math.abs(fx) + hm.z * Math.abs(fz) : NaN;
      ok(hm && Math.abs(along - face) < 0.05 && Math.abs(hm.n[0] - fx) < 1e-6 && Math.abs(hm.n[2] - fz) < 1e-6, 'lancée contre le distributeur : brisée sur sa façade (pas devant sa case)', { along: r2(along), face: r2(face), n: hm && hm.n });
      __zs.step(480, 1 / 60);
      const inside = FX.glass.list.filter((e) => inMachine(mq.m, e.x, e.y, e.z, -0.01)).length;
      ok(inside === 0, 'aucun éclat dans la machine', inside);

      // ----------------------------------------- à terre pendant la boisson
      const qe = goTo('endurance');
      hits.length = 0;
      qe.it.use();
      at(1.2);
      goDown();
      n = 0;
      while ((Arms.state === 'drink' || FX.bottles.length) && n < 400) { __zs.step(1, 1 / 60); n++; }
      ok(player.down && hits.length === 1 && hits[0].id === 'endurance' && !player.perks.has('endurance'), 'à terre pendant la boisson : la gourde tombe et se brise, Staminup n’est pas accordé', { down: player.down, hits: hits.length });
      ok(Arms.state === 'idle', 'à terre : la boisson s’arrête');
      __zs.step(360, 1 / 60);
      ok(!player.down, 'relevé par Quick Revive');

      // -------------------------------- tête en arrière, jamais à l’envers
      const qd = goTo('detente', 1.5);
      qd.it.use();
      let maxPitch = -9;
      n = 0;
      while (Arms.state === 'drink' && n < 400) { __zs.step(1, 1 / 60); maxPitch = Math.max(maxPitch, camera.rotation.x); n++; }
      ok(player.perks.has('detente') && maxPitch <= 1.531, 'en regardant en l’air : la tête ne passe pas la verticale', r2(maxPitch));

      // --------------------------------------------------- partie suivante
      window.shatterBottle = shatter;
      startGame(null);
      ok(FX.glass.list.length === 0 && FX.bottles.length === 0, 'nouvelle partie : plus d’éclats');
      return out;
    });
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
  console.log(failures ? `${failures} échec(s).` : 'Atouts : boisson, fiole et éclats conformes.');
  process.exit(failures ? 1 : 0);
})();
