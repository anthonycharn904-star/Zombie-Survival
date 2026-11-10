'use strict';
/* « Visionnaire », sixième easter egg secondaire de Bunker 7 (jeu 2.0.7, demande d'Anthony du 10 novembre 2026), dans la
   fenêtre du jeu du launcher : le Momifié (modèle à part, règles d'un zombie normal : PV de la manche, vitesse, dégâts,
   points), une fois par partie, 0,01 % par zombie, gardé par la sauvegarde ; retiré vivant, il ressort ; jamais pendant le
   combat du boss ; tué : portail de sable de 1,80 m, 10 s, au cadavre ; dedans : le désert du Khamsin, sans fin (sol
   partout, brouillard de tempête), Desséchés et Rôdeurs sans fin, hors de la manche, Bunker 7 figé ; la « mort » : réveil à
   la place du portail, comme avant (PV, munitions, points, atouts, Quick Revive et ses relèves, statistiques), lampes et
   ambiance de Bunker 7 rendues, ses zombies à leur place ; nouvelle partie : tout remis à zéro.
     xvfb-run -a node e2e/visionnaire.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-visionnaire-'));
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
    // ------------------------------------------------------------ le Momifié : apparition, règles, rareté
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__vs = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = true; G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
        },
        pas(n) { for (let i = 0; i < n; i++) __zs.step(1, 1 / 60); },
        sortir(hp = 150) { return spawnZombie({ riser: true, x: player.pos.x - Math.sin(player.yaw) * 3, z: player.pos.z - Math.cos(player.yaw) * 3, li: 0, k: player.k, zone: player.zone, layer: 0 }, hp); },
        lampes() { const n = {}; scene.traverseVisible((o) => { if (o.isLight && !o.userData.b7pad) n[o.type] = (n[o.type] || 0) + 1; }); return JSON.stringify(n); },
      };
      Q.partie(); Q.pas(3);
      ok(VS.chance === 0.0001 && !VS.fait && !VS.momie, 'chance : 0,01 % par zombie ; rien au début de la partie');
      // tirage : sans « force », 20 000 zombies sortent en moyenne deux fois le Momifié… mais une seule fois par partie
      const r0 = Math.random; let tirs = 0, sorties = 0;
      try {
        Math.random = () => 0.00005;               // sous 0,01 % : il sort
        const t1 = vsType(BASE_TYPE); const t2 = vsType(BASE_TYPE); tirs = 2;
        sorties = (t1 === VS_TYPE ? 1 : 0) + (t2 === VS_TYPE ? 1 : 0);
        Math.random = () => 0.0002;                // au-dessus : jamais
      } finally { Math.random = r0; }
      ok(sorties === 1 && VS.fait, 'tiré sous 0,01 % : le Momifié, une seule fois par partie', { tirs, sorties });
      VS.fait = false;
      const a0 = B7.actif; B7.actif = true; VS.force = true;
      ok(vsType(BASE_TYPE) === BASE_TYPE && !VS.fait, 'pendant le combat du boss : jamais');
      B7.actif = a0;
      // un vrai Momifié, comme un zombie de la manche
      G.round = 7; G.zombieHp = zombieHpForRound(7);
      const z = Q.sortir(G.zombieHp); window.__m = z;
      ok(z && z.vsMomie && VS.momie === z && zModelOf(z) === 'momifie' && z.type === VS_TYPE && !z.helmetOn,
        'le zombie suivant est le Momifié (son modèle, sans casque)');
      ok(z.hp === zombieHpForRound(7) && z.type.mult.hp === 1 && z.type.mult.speed === 1 && z.type.mult.damage === 1 && z.type.headMult === 2,
        'règles d\'un zombie normal : PV de la manche, vitesse, dégâts, tête ×2', { hp: z.hp });
      ok(VS.compile, 'portail et désert compilés à sa sortie (pas de gel à l\'ouverture)');
      const g = ZVGEO.momifie;
      ok(g && g.torso && g.collar && g.head && g.eyes && ZPARTS.momifie.length === 10 && ZR.models.momifie, 'modèle : bandelettes, collier d\'or, tête, yeux, bras, jambes ; dans la horde');
      // retiré vivant : il ressort au zombie suivant
      recycleZombie(z);
      ok(!VS.momie && VS.relance, 'retiré vivant (bloqué, trop loin) : il ressortira');
      const z2 = Q.sortir(G.zombieHp); window.__m = z2;
      ok(z2.vsMomie && !VS.relance, 'il ressort au zombie suivant');
      // sauvegarde : déjà sorti
      const sv = serializeGame();
      ok(sv && sv.visionnaire === true, 'sauvegarde : le Momifié est déjà sorti');
      Q.l0 = Q.lampes();
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ le portail
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__vs, z = window.__m;
      for (let i = 0; i < 90; i++) Q.pas(1);
      const secrets = []; const sd0 = window.secretDecouvert; window.secretDecouvert = (id) => secrets.push(id);
      const k0 = G.stats.kills, p0 = G.points;
      try { damageZombie(z, z.hp + 10, { kind: 'bullet', dx: 0, dz: 1, head: false }); } finally { window.secretDecouvert = sd0; }
      const P = VS.portail;
      ok(P && Math.hypot(P.x - z.pos.x, P.z - z.pos.z) < 0.6 && P.gy === z.gy && G.stats.kills === k0 + 1 && G.points > p0 && secrets.includes('b7-visionnaire'),
        'tué : il compte comme un zombie, le portail s\'ouvre au cadavre ; secret « b7-visionnaire »', { secrets });
      Q.pas(60);
      ok(VS.haut === 1.8 && P.disque.geometry.parameters.height === 1.8 && P.g.scale.y > 0.99 && P.g.parent === scene, 'portail de sable : 1,80 m du sol, ouvert');
      // à côté : on n'entre pas ; il dure 10 s
      placePlayer(P.x + 1.2, P.z); Q.pas(2);
      ok(!VS.entree && !VS.on, 'à 1,2 m : on n\'entre pas');
      Q.pas(60 * 8);
      ok(VS.portail === P && P.t > 9, 'toujours ouvert à 9 s');
      Q.pas(70);
      ok(!VS.portail && !P.g.parent, 'refermé après 10 s');
      ok(Q.lampes() === Q.l0, 'ni lampe ajoutée');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ le désert
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__vs;
      // une nouvelle partie, un Momifié, Quick Revive bu une fois, des points, des armes ; deux zombies de Bunker 7
      Q.partie(); Q.pas(3);
      __zs.give('thompson', 0); player.perks.add('souffle'); player.souffleUses = 1; G.points = 4321; G.grenades = 3;
      G.round = 4; G.zombieHp = zombieHpForRound(4);
      const b1 = Q.sortir(G.zombieHp), b2 = spawnZombie({ riser: true, x: player.pos.x + 3, z: player.pos.z, li: 0, k: player.k, zone: player.zone, layer: 0 }, G.zombieHp);
      VS.force = true;
      const m = Q.sortir(G.zombieHp);
      Q.pas(90);
      damageZombie(m, m.hp + 10, { kind: 'bullet', dx: 0, dz: 1, head: false });
      Q.pas(40);
      const P = VS.portail;
      Q.avant = { hp: player.hp, perks: [...player.perks].sort().join(), su: player.souffleUses, pts: G.points, gren: G.grenades, slots: JSON.stringify(Arms.slots), cur: Arms.cur,
        round: G.round, killed: G.killed, spawned: G.spawned, kills: G.stats.kills, downs: G.stats.downs, liste: Zombies.list.length, b1: [b1.pos.x, b1.pos.z], fog: scene.fog.density, far: camera.far,
        lampes: Q.lampes(), x: P.x, z: P.z };
      renderEnabled = true; render(); renderEnabled = false;     // Bunker 7 déjà dessiné une fois, comme en jeu
      Q.prog0 = renderer.info.programs.length;
      placePlayer(P.x, P.z); Q.pas(2);
      ok(VS.entree && !VS.on, 'au centre du portail : le voile de sable monte');
      Q.pas(40);
      ok(VS.on && Math.hypot(player.pos.x - VSD.ox, player.pos.z - VSD.oz) < 1 && Math.abs(player.gy - vsSol(player.pos.x, player.pos.z)) < 0.01,
        'dans le désert, loin de la grille de Bunker 7, sur le sable', { x: player.pos.x, gy: player.gy });
      ok(Zombies.list.every((z) => z.vs) && !b1.removed && b1.alive && VS.I.liste.includes(b1), 'les zombies de Bunker 7 sont mis de côté (gardés)');
      Q.dedans = { n: VS.I.liste.length, b1: [b1.pos.x, b1.pos.z] };
      ok(scene.fog.density > 0.01 && camera.far < 200 && Q.lampes() === Q.avant.lampes, 'tempête du Khamsin : brouillard épais ; même nombre de lampes (Bunker 7, à 9 km, n\'est pas dessiné)', { d: scene.fog.density, far: camera.far });
      renderEnabled = true; render(); renderEnabled = false;
      ok(renderer.info.programs.length - Q.prog0 <= 1, 'aucune compilation à l\'entrée (compilé d\'avance)', renderer.info.programs.length - Q.prog0);
      // sans fin : le sol est partout ; on court loin, il y a toujours du sable
      const loin = [[2000, 0], [-5000, 3000], [12000, -7000]].every(([dx, dz]) => Number.isFinite(vsSol(VSD.ox + dx, VSD.oz + dz)));
      ok(loin, 'le désert ne finit pas : du sable partout');
      // attaques sans fin : Desséchés puis Rôdeurs
      Q.pas(60 * 25);
      const vivants = Zombies.list.filter((z) => z.alive);
      const nz = vivants.filter((z) => !z.rodeur).length, nr = vivants.filter((z) => z.rodeur).length;
      ok(nz >= 8 && nr >= 1 && vivants.every((z) => z.vs) && vivants.filter((z) => !z.rodeur).every((z) => z.type.kh),
        'attaqué sans fin : Desséchés de Khamsin et Rôdeurs', { nz, nr });
      const des = vivants.filter((z) => !z.rodeur);
      ok(des.every((z) => z.speed >= VSD.sprint[0] && z.speed <= VSD.sprint[1] && z.an && z.an.gait === ZGAITS.super), 'Desséchés en super-sprint (démarche et vitesse)');
      ok(G.round === Q.avant.round && G.spawned === Q.avant.spawned && G.killed === Q.avant.killed, 'Bunker 7 figé : manche, compteurs');
      // un Desséché tué : rien ne compte
      const d = vivants.find((z) => !z.rodeur && z.state !== 'rise');
      const k0 = G.killed;
      if (d) damageZombie(d, d.hp + 1, { kind: 'bullet', dx: 0, dz: 1, head: true });
      Q.pas(2);
      ok(d && !d.alive && G.killed === k0 && Powerups.list.length === 0, 'un Desséché tué : hors de la manche, aucun bonus');
      // la « mort » (Quick Revive bu) : réveil au portail, comme avant
      G.god = false;
      for (let i = 0; i < 60 * 30 && VS.on; i++) { Q.pas(1); if (i % 30 === 0) playerDamage(25); }
      G.god = true;                                // au réveil, les zombies de Bunker 7 reprennent : on regarde l'instant du retour
      const b1x = [b1.pos.x, b1.pos.z], px = [player.pos.x, player.pos.z];
      Q.pas(100);
      const A = Q.avant;
      ok(!VS.on && !VS.d.root.parent && World.root.visible && Math.hypot(px[0] - A.x, px[1] - A.z) < 0.05,
        '« mort » : réveil à la place exacte du portail', { x: px[0], z: px[1] });
      ok(!player.down && G.state === 'playing' && player.hp === A.hp && [...player.perks].sort().join() === A.perks && player.souffleUses === A.su && G.stats.downs === A.downs,
        'ni relève ni fin de partie : PV, atouts, Quick Revive et ses relèves comme avant', { hp: player.hp, perks: [...player.perks], su: player.souffleUses, downs: G.stats.downs });
      ok(G.points === A.pts && G.grenades === A.gren && JSON.stringify(Arms.slots) === A.slots && Arms.cur === A.cur && G.stats.kills === A.kills,
        'points, grenades, armes et munitions, éliminations : comme avant');
      ok(Zombies.list.length === Q.dedans.n && Zombies.list.includes(b1) && Math.hypot(b1x[0] - Q.dedans.b1[0], b1x[1] - Q.dedans.b1[1]) < 0.01 && Zombies.list.every((z) => !z.vs),
        'les zombies de Bunker 7 reviennent à leur place ; ceux du désert ont disparu', { n: Zombies.list.length, attendu: Q.dedans.n, b1: b1x, avant: Q.dedans.b1 });
      ok(Math.abs(scene.fog.density - A.fog) < 1e-6 && camera.far === A.far && Q.lampes() === A.lampes && KHS.lv === 0 && !(KHS.streaks && KHS.streaks.mesh.visible),
        'ambiance de Bunker 7 rendue : brouillard, distance, lampes ; plus de tempête');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ fin : une seule fois ; remise à zéro
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__vs;
      const r0 = Math.random; let n = 0;
      try { Math.random = () => 0.00001; for (let i = 0; i < 20; i++) if (vsType(BASE_TYPE) === VS_TYPE) n++; } finally { Math.random = r0; }
      ok(n === 0, 'une fois par partie : il ne ressort plus');
      // une partie reprise d'une sauvegarde où il est déjà sorti
      const sv = serializeGame();
      __zs.map('bunker7'); startGame(sv); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      ok(VS.fait, 'partie reprise : il ne ressortira pas');
      Q.partie(); Q.pas(3);
      ok(!VS.fait && !VS.on && !VS.portail && !document.getElementById('vs-voile')?.style.opacity?.match(/^0\.[1-9]|^1/), 'nouvelle partie : remis à zéro');
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
  console.log(failures ? `${failures} échec(s).` : 'Visionnaire : conforme (Momifié, rareté, portail, désert sans fin, réveil comme avant, remise à zéro).');
  process.exit(failures ? 1 : 0);
})();
