'use strict';
/* Caisses toxiques de Bunker 7, quatrième easter egg secondaire (jeu 2.0.7, demande d'Anthony du 9 novembre 2026), dans
   la fenêtre du jeu du launcher : petites caisses posées sur les grandes, un maillage chacune (le reste du monde
   inchangé) ; une caisse au logo toxique par salle, tirée au hasard à chaque partie ; balles (3 de M1911), couteau,
   explosion ; une caisse sans logo ne casse pas ; casse : planches, nuage vert qui blesse faiblement le joueur sans
   secousse, zombies et chiens qui y passent toxiques (irradiation du combat du boss) 1 minute ; les quatre : « Atout
   gratuit » et « Munitions max » ; une fois par partie ; rien pendant le combat du boss ; ni lampe ajoutée ; nouvelle
   partie : caisses entières ; rendu sans erreur.
     xvfb-run -a node e2e/caisses.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-caisses-'));
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
    // ------------------------------------------------------------ caisses, tirage, coups
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__cx = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = true; G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies(); player.gy = 0;
        },
        pas(n) { for (let i = 0; i < n; i++) __zs.step(1, 1 / 60); },
        pres(c, d = 1.6, diag = false) {          // le joueur à d m de la caisse (en diagonale si diag), sur une case praticable, tourné vers elle
          const k0 = c.k % GN, cx = (k0 % GW) + 0.5, cz = ((k0 / GW) | 0) + 0.5;
          for (let a = 0; a < 24; a++) { const dd = diag && a >= 4 && a < 8 ? d + 0.4 : d, dg = diag && a < 8, an = dg ? Math.PI / 4 + (a % 4) * Math.PI / 2 : a * TAU / 16, x = (dg ? cx : c.x) + Math.cos(an) * dd, z = (dg ? cz : c.z) + Math.sin(an) * dd; if (locateNode(x, z, 0, true) >= 0 && sightClear(x, PLAYER_EYE, z, c.x, c.y + 0.36, c.z)) { placePlayer(x, z); break; } }
          player.yaw = Math.atan2(player.pos.x - c.x, player.pos.z - c.z);
        },
        tir(c, off = [0, 0, 0]) {
          G.stats.shots++;
          const s = Arms.slots[Arms.cur], ex = player.pos.x, ey = player.gy + PLAYER_EYE, ez = player.pos.z;
          let dx = c.x + off[0] - ex, dy = c.y + off[1] - ey, dz = c.z + off[2] - ez; const L = Math.hypot(dx, dy, dz);
          hitscan(s, ex, ey, ez, dx / L, dy / L, dz / L, { x: ex, y: ey, z: ez });
        },
        lampes() { const n = {}; scene.traverseVisible((o) => { if (o.isLight) n[o.type] = (n[o.type] || 0) + 1; }); return JSON.stringify(n); },
      };
      Q.partie(); Q.pas(3);
      const par = CX.salles.map((nom) => { const zi = LAYOUT.zones.findIndex((z) => z.name === nom); return CX.liste.filter((c) => c.zone === zi).length; });
      ok(CX.liste.length >= 4 && CX.liste.every((c) => c.mesh && c.mesh.parent && Math.abs(solidTop[c.k] - 1.6) < 1e-3),
        `${CX.liste.length} petites caisses sur les grandes, un maillage chacune (par salle : ${CX.salles.map((n, i) => `${n} ${par[i]}`).join(', ')})`);
      const parChoix = CX.salles.map((nom) => { const zi = LAYOUT.zones.findIndex((z) => z.name === nom); return CX.choisies.filter((c) => c.zone === zi).length; });
      ok(CX.choisies.length === 4 && parChoix.every((n, i) => n <= 2 && (par[i] === 0 || n >= 1)) && CX.choisies.every((c) => c.mesh.material === CX.mat) && CX.liste.filter((c) => c.mesh.material === CX.mat).length === 4,
        `quatre caisses au logo toxique, 1 ou 2 par salle qui a des caisses (${parChoix.join(', ')})`);
      const tirages = new Set([CX.choisies.map((c) => CX.liste.indexOf(c)).join()]);
      for (let i = 0; i < 6; i++) { Q.partie(); tirages.add(CX.choisies.map((c) => CX.liste.indexOf(c)).join()); }
      ok(tirages.size > 1, `au hasard à chaque partie (${tirages.size} tirages différents en 7 parties)`);
      Q.l0 = Q.lampes();
      // une caisse sans logo : rien
      const sans = CX.liste.find((c) => !c.toxique);
      __zs.give('m1911', 0); Q.pas(40);
      if (sans) { Q.pres(sans); Q.tir(sans); }
      ok(!sans || (sans.mesh.visible && !sans.cassee), 'tir sur une petite caisse sans logo : rien');
      // balles : 3 de M1911
      const c0 = CX.choisies[0];
      Q.pres(c0); let n = 0; while (!c0.cassee && n < 6) { Q.tir(c0); n++; }
      ok(c0.cassee && n === 3 && !c0.mesh.visible && Math.abs(solidTop[c0.k] - 0.95) < 1e-3 && CX.nuages.length === 1, `M1911 : la caisse casse en ${n} balles ; il reste la grande caisse ; un nuage`);
      // les planches de la caisse : elles tombent et restent (sur la grande caisse ou au sol)
      Q.pas(60 * 3);
      const pl = CX.eclats, E0 = LVY[c0.li];
      ok(pl.length >= 10 && pl.every((e) => e.pose && e.m.visible && e.m.parent && e.m.position.y >= E0 && e.m.position.y <= E0 + 1.0),
        `${pl.length} planches et éclats posés (sur la grande caisse ou au sol), qui restent`, pl.map((e) => +e.m.position.y.toFixed(2)));
      // le nuage : faibles dégâts au joueur, sans secousse
      const nu = CX.nuages[0];
      G.god = false; player.hp = player.maxHp; placePlayer(nu.x + 0.4, nu.z + 0.3);
      let sh = 0; const hp0 = player.hp;
      for (let i = 0; i < 120; i++) { Q.pas(1); sh = Math.max(sh, FX.shake); }
      const perdu = hp0 - player.hp; G.god = true; player.hp = player.maxHp;
      ok(perdu > 0 && perdu <= 0.1 * player.maxHp && sh === 0, `dans le nuage : ${perdu.toFixed(0)} PV en 2 s, sans secousse`);
      ok(CX.pool && CX.pool.L.some((p) => p.life > 0 && !p.add), 'fumée verte');
      // un zombie et un chien qui passent dans le nuage : toxiques (irradiation du combat), 1 minute
      placePlayer(nu.x + 6, nu.z); 
      const z = spawnZombie({ riser: true, x: nu.x, z: nu.z, li: 0, k: nodeUnder(nu.x, nu.z, 0), layer: 0, zone: zoneOf[nodeUnder(nu.x, nu.z, 0)], y: 0 }, 300);
      __zs.openAll(); Q.pas(2);                  // toutes les salles ouvertes : le chien a où apparaître
      const kd = pickDogSpawn(), d = kd >= 0 ? spawnDog(kd, 300) : null;
      if (d) { d.pos.x = nu.x + 0.3; d.pos.z = nu.z - 0.3; d.k = nodeUnder(d.pos.x, d.pos.z, 0); }
      Q.pas(20);
      const toxZ = z && CX.toxiques.has(z) && B7E.irr.has(z), toxD = !!d && CX.toxiques.has(d) && B7E.irr.has(d);
      const lueur = B7E.irrPts && B7E.irrPts.parent === scene && B7E.irrPts.visible;
      ok(toxZ && toxD && lueur, 'un zombie et un chien dans le nuage deviennent toxiques (teinte, lueur verte dans Bunker 7, aura du combat du boss)', { toxZ, toxD, lueur });
      return out;
    })).forEach(report);
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__cx;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      const z = [...CX.toxiques.keys()][0];
      Q.pas(60 * 92);                            // repasser dans le nuage (30 s) relance la minute : 30 + 60 s au plus
      ok(z && !CX.toxiques.has(z) && !B7E.irr.has(z) && CX.nuages.length === 0 && B7E.irrPts.parent === B7E.gS, 'une minute après leur dernier passage dans le nuage, plus toxiques (lueurs rendues à leur groupe) ; le nuage s’est dissipé');
      clearZombies();
      // couteau, en diagonale : sans zombie, la lame arrive dans le vide (onMiss du module, sans sang) et casse la caisse
      const c1 = CX.choisies[1];
      Q.pres(c1, 1.25, true); Q.pas(2);
      const cassees0 = CX.choisies.filter((c) => c.cassee).length;
      const cible = knifeChoose('contact', null);
      if (!cible) cxCouteauVide();
      const parCouteau = CX.choisies.filter((c) => c.cassee).length === cassees0 + 1;   // la caisse visée, ou une voisine plus proche dans l'axe
      const k1 = c1.k % GN, dd = Math.hypot(c1.x - player.pos.x, c1.z - player.pos.z);
      ok(!cible && parCouteau, 'couteau (en diagonale) : pas de cible de chair, la caisse devant le joueur casse d’un coup',
        { cible: !!cible, d: +dd.toFixed(2), cone: +(((c1.x - player.pos.x) * -Math.sin(player.yaw) + (c1.z - player.pos.z) * -Math.cos(player.yaw)) / dd).toFixed(2), vue: cxVue(c1, camera.position.x, camera.position.y, camera.position.z), case: [(k1 % GW), (k1 / GW) | 0], joueur: [+player.pos.x.toFixed(2), +player.pos.z.toFixed(2)], cam: +camera.position.y.toFixed(2) });
      // explosion
      const c2 = CX.choisies.find((c) => !c.cassee);
      Q.pres(c2, 1.3, true); Q.pas(1);
      explode(player.pos.x, 0.15, player.pos.z, 1.7, 500, { src: 'grenade' });   // une grenade au sol, en diagonale, à 1,3 m (petit rayon)
      ok(c2.cassee, 'grenade au sol, en diagonale : la caisse casse');
      // pendant le combat du boss : rien
      const c3 = CX.choisies.find((c) => !c.cassee);
      Q.pres(c3); __zs.give('thompson', 2); Q.pas(40);
      const a0 = B7.actif; B7.actif = true; Q.tir(c3); Q.tir(c3); B7.actif = a0;
      ok(!c3.cassee && c3.pv === CX.pv, 'pendant le combat du boss : rien');
      // la dernière : la récompense
      const secrets = []; const sd0 = window.secretDecouvert; window.secretDecouvert = (id) => secrets.push(id);
      clearPowerups();
      let sh = 0;
      try {
        for (const c of CX.choisies) { if (c.cassee) continue; Q.pres(c); Q.pas(1); for (let i = 0; i < 4 && !c.cassee; i++) Q.tir(c); }
        for (let i = 0; i < 30; i++) { Q.pas(1); sh = Math.max(sh, FX.shake); }
      } finally { window.secretDecouvert = sd0; }
      const b = Powerups.list.map((p) => p.type), z0 = zoneAt(player.pos.x, player.pos.z, player.gy);
      ok(c3.cassee && CX.fait && secrets.includes('b7-caisses') && b.includes('freeperk') && b.includes('ammo') && Powerups.list.every((p) => zoneAt(p.x, p.z, player.gy) === z0),
        'les quatre cassées : « Atout gratuit » et « Munitions max » près du joueur ; secret « b7-caisses »', b);
      ok(sh === 0 && Q.lampes() === Q.l0, 'ni secousse ni lampe ajoutée');
      renderEnabled = true; render(); renderEnabled = false;
      Q.partie(); Q.pas(3);
      ok(!CX.fait && CX.eclats.length === 0 && CX.debris.children.length === 0 && CX.liste.every((c) => !c.cassee && c.mesh.visible && Math.abs(solidTop[c.k] - 1.6) < 1e-3) && CX.choisies.length === 4 && CX.nuages.length === 0 && CX.toxiques.size === 0,
        'nouvelle partie : caisses entières, quatre nouveaux logos, plus de planches, de nuage ni de zombie toxique');
      renderEnabled = true; render(); renderEnabled = false;
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
  console.log(failures ? `${failures} échec(s).` : 'Caisses toxiques : conforme (tirage, balles, couteau, explosion, nuage, zombies toxiques, récompense, remise à zéro).');
  process.exit(failures ? 1 : 0);
})();
