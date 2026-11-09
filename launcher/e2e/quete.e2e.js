'use strict';
/* Easter egg principal de Bunker 7 (jeu 2.0.7, demande d'Anthony du 9 novembre 2026), dans la fenêtre du jeu du
   launcher : toit de la Salle d'arrivée prêt (brèche cachée) ; tir sur le disjoncteur seulement courant rétabli, toutes
   les portes ouvertes, arme non explosive au palier II ou III du Glas (de face, hors combat du boss) ; électrification
   (champ qui blesse sans secousse, sans cercle au sol) ; coupure (noir presque total, machines à atouts sans courant,
   atouts du joueur gardés, Glas tu, manches figées, disjoncteur bloqué) ; quatre lockdowns dans l'ordre (salle qui
   appelle, départ à l'entrée, barrières aux portes qui n'arrêtent que le joueur et le blessent, vague sans fin dans la
   salle, chiens, lampes rouges, chrono, une musique par salle, 1 min, « Munitions max », zombies restants qui
   poursuivent, morts hors manche) ; disjoncteur à rallumer ; foudre (toit détruit, gravats, ciel) ; le Septième
   invulnérable et passif ; à l'approche, l'absorption et la téléportation ensemble (le Septième visible jusqu'à la
   salle), puis le combat ; « Rejouer » en plein lockdown ; code du boss refusé pendant la quête ; Glas à la coupure ;
   remise à zéro ; ni secousse ; compilations des matières hors des moments de jeu ; rendu sans erreur.
     xvfb-run -a node e2e/quete.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-quete-'));
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
    if (process.platform === 'linux') game.setDefaultTimeout(600000);   // rendu logiciel ; quatre lockdowns d'une minute
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    const res = [];
    const report = (r) => res.push(r);
    // ------------------------------------------------------------ toit prêt ; conditions du tir sur le disjoncteur
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__qp = {
        partie() {
          __zs.map('bunker7'); __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = true; G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
          player.gy = 0; placePlayer(34.2, 11.2);   // Salle des machines, face au disjoncteur (40, 10)
        },
        pas(n) { for (let i = 0; i < n; i++) { __zs.step(1, 1 / 60); if (G.god) player.hp = player.maxHp; } },
        // un tir depuis les yeux du joueur vers la plaque du disjoncteur (ou un point donné)
        tir(c) {
          G.stats.shots++;
          c = c || qpCentre();
          const s = Arms.slots[Arms.cur], ex = player.pos.x, ey = player.gy + PLAYER_EYE, ez = player.pos.z;
          let dx = c.x - ex, dy = c.y - ey, dz = c.z - ez; const L = Math.hypot(dx, dy, dz);
          hitscan(s, ex, ey, ez, dx / L, dy / L, dz / L, { x: ex, y: ey, z: ez });
        },
        // état des lampes : nombre de lampes affichées de chaque sorte (lampes éteintes de HC-boss-lampes.js comprises)
        lampes() { const n = {}; scene.traverseVisible((o) => { if (o.isLight) n[o.type] = (n[o.type] || 0) + 1; }); return JSON.stringify(n); },
        lampesFx() { let n = 0; if (typeof B7V === 'object' && B7V.fxBunker) B7V.fxBunker.traverse((o) => { if (o.isLight) n++; }); return n; },
        secrets: [],
        centres: { 'Salle des machines': [30, 7], 'Entrepôt': [40.5, 20], "Salle d'arrivée": [24.5, 20], 'Infirmerie': [9.5, 19.5] },
      };
      window.secretDecouvert = (id) => Q.secrets.push(id);   // écran « Secrets » de l'Interface (simulé)
      Q.liens = 0; Q.rendre = () => { renderEnabled = true; render(); renderEnabled = false; };
      { const gl = renderer.getContext(), lp0 = gl.linkProgram.bind(gl); gl.linkProgram = (p) => { Q.liens++; return lp0(p); }; }
      Q.partie(); Q.pas(3);
      const b = QP.breche, cases = [];
      for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) cases.push(ceilOn[z * GW + x]);
      ok(QP.toit && QP.toit.parent && QP.toit.visible && QP.bord && !QP.bord.visible && QP.gravats && !QP.gravats.visible && QP.chutes.length === 14 && cases.every((v) => v),
        'toit de la Salle d’arrivée : brèche construite à part, plafond entier, bord et gravats cachés');
      ok(QP.etape === 'attente' && !QP.coupe && !QP.manches && Features.power && !G.power, 'quête en attente, courant coupé au départ');
      Q.l0 = Q.lampes();
      // sans courant : la plaque n'arrête rien
      __zs.give('thompson', 2); Q.pas(40);
      Q.tir(); Q.pas(2);
      ok(QP.etape === 'attente' && QP.dernier === -1, 'sans courant : le tir sur le disjoncteur ne fait rien');
      activatePower(); Q.pas(100);
      // courant rétabli, portes fermées : la plaque arrête la balle (étincelles), rien d'autre
      Q.tir(); Q.pas(2);
      ok(QP.etape === 'attente' && QP.dernier === G.stats.shots && Object.values(World.doors).some((d) => !d.opened), 'portes pas toutes ouvertes : la plaque est touchée, le disjoncteur ne réagit pas');
      __zs.openAll(); Q.pas(5);
      __zs.give('thompson', 1); Q.pas(40);
      Q.tir(); Q.pas(2);
      ok(QP.etape === 'attente', 'arme au palier I du Glas : rien');
      __zs.give('thompson', 0); Q.pas(40);
      Q.tir(); Q.pas(2);
      ok(QP.etape === 'attente', 'arme sans amélioration : rien');
      __zs.give('m1911', 2); Q.pas(40);
      Q.tir(); Q.pas(2);
      ok(QP.etape === 'attente' && wstat(Arms.slots[Arms.cur], 'explosive'), 'arme explosive au palier II (M1911 Ardente) : rien');
      __zs.give('thompson', 2); Q.pas(40);
      const c = qpCentre();
      ok(qpRayon(Arms.slots[Arms.cur], c.x + 1.5, c.y, c.z, -1, 0, 0, 10) < 0 && qpRayon(Arms.slots[Arms.cur], c.x - 3, c.y, c.z, 1, 0, 0, 10) > 0, 'plaque touchée de face seulement');
      const a0 = B7.actif; B7.actif = true;
      try { Q.tir(); Q.pas(1); } finally { B7.actif = a0; }
      ok(QP.etape === 'attente', 'pendant le combat du boss : rien');
      const m0 = G.mapId; G.mapId = 'autre';
      const ailleurs = qpRayon(Arms.slots[Arms.cur], c.x - 3, c.y, c.z, 1, 0, 0, 10) < 0; G.mapId = m0;
      ok(ailleurs, 'hors de Bunker 7 : rien');
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ électrification, champ, coupure
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__qp;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      // atouts du joueur : Quick Revive (sans courant), Mastodonte, Endurance
      for (const id of ['souffle', 'cuirasse', 'endurance']) player.perks.add(id);
      player.maxHp = RULES.cuirasseHp; player.hp = player.maxHp; HUD.perks();
      // une manche en cours (figée par la coupure)
      G.round = 6; G.roundState = 'active'; G.total = 30; G.spawned = 8; G.killed = 3; G.spawnT = 1e9;
      Q.tir(); Q.pas(1);
      ok(QP.etape === 'electrifie' && QP.fx && QP.fx.g.visible, 'arme non explosive au palier II, toutes les portes ouvertes : le disjoncteur s’électrifie (arcs, halo, champ)');
      const inter = Features.interactables.find((q) => q.kind === 'power');
      // champ : le joueur dans l'anneau est blessé, sans secousse ni à-coup de la vue
      const fc = qpChampCentre();
      G.god = false; player.hp = player.maxHp;
      placePlayer(fc.x, fc.z);
      let shake = 0, punch = 0;
      const hp0 = player.hp;
      for (let i = 0; i < 70; i++) { __zs.step(1, 1 / 60); shake = Math.max(shake, FX.shake); punch = Math.max(punch, player.punch); }
      const pris = hp0 - player.hp;
      player.hp = player.maxHp;
      placePlayer(34.2, 11.2);
      const hp1 = player.hp;
      for (let i = 0; i < 70; i++) __zs.step(1, 1 / 60);
      const loin = hp1 - player.hp;
      G.god = true; player.hp = player.maxHp;
      ok(pris >= QP.champDegats * player.maxHp * 2 - 1 && loin === 0 && shake === 0 && punch === 0,
        `champ électrique : ${pris.toFixed(0)} PV perdus en 1,2 s dans l'anneau, rien en dehors, ni secousse ni à-coup`, { pris, loin, shake, punch });
      ok(inter.prompt() === null, 'disjoncteur électrifié : pas d’interaction');
      const mancheAvant = [G.round, G.spawned, G.killed, G.roundState].join();
      for (let i = 0; i < 60 * (QP.elec + 0.2) && QP.etape === 'electrifie'; i++) Q.pas(1);
      ok(QP.etape === 'coupure' && !G.power && QP.coupe && QP.manches && !QP.fx.g.visible, `au bout de ${QP.elec} s : court-circuit, courant coupé`);
      Q.pas(70);
      const machines = Features.perkMachines.filter((m) => PERKS[m.id] && PERKS[m.id].power && m.active);
      ok(['souffle', 'cuirasse', 'endurance'].every((id) => player.perks.has(id)) && player.maxHp === RULES.cuirasseHp && machines.every((m) => !m.lit),
        'machines à atouts sans courant ; les atouts du joueur restent (Mastodonte : 250 PV)');
      const icones = document.querySelectorAll('#perks .perk');
      const grises = [...icones].filter((e) => /grayscale/.test(e.getAttribute('style') || '')).length;
      ok(icones.length === 3 && grises === 0 && !QP.fx.anneau, `icônes des ${icones.length} atouts normales ; pas de cercle au sol sous le disjoncteur`);
      ok(!Features.amp || Features.amp.state === 'mute', 'Le Glas se tait');
      ok(inter.prompt() === null && machines.length > 0, 'disjoncteur et machines sans courant ; pas de rallumage pendant la coupure');
      const ref = World.lights.map((l) => l.light.intensity);
      ok(QP.k <= QP.noir + 1e-6 && HEMI.intensity <= CUR.map.ambiance.hemi * (QP.noir + 0.01), `noir presque total (lampes et ambiance × ${QP.noir})`, { k: QP.k, hemi: HEMI.intensity });
      Q.pas(60 * 3);
      ok(QP.etape === 'lockdowns' && QP.ld && QP.ld.i === 0, 'premier lockdown : la Salle des machines');
      ok(QP.compile && B7A.compile && QP.compileN > 0, `au court-circuit, dans le noir : le Septième, ses effets et la salle du boss compilés d'avance (${QP.compileN} programmes)`);
      ok([G.round, G.spawned, G.killed, G.roundState].join() === mancheAvant && QP.manches, 'manche figée pendant la coupure', mancheAvant);
      ok(Q.lampes() === Q.l0 && ref.length === World.lights.length, `état des lampes inchangé (${Q.l0})`);
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ quatre lockdowns
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__qp;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      const ordre = [], R = [];
      let shake = 0, finAmmo = null;
      const fin0 = window.qpLdFin;
      window.qpLdFin = function () { const n0 = Powerups.list.length, r = fin0.apply(this, arguments); finAmmo = Powerups.list.slice(n0).filter((p) => p.type === 'ammo' && p.life === 30).length; return r; };
      try {
      for (let i = 0; i < 4; i++) {
        finAmmo = null;
        const nom = QP.salles[i], [cx, cz] = Q.centres[nom], L = QP.ld;
        const r = { nom, i: L && L.i };
        if (L.phase === 'appel') {
          Q.pas(30);
          r.attend = QP.ld.phase === 'appel';       // la salle appelle tant que le joueur n'y est pas
          placePlayer(cx, cz); Q.pas(3);
        }
        r.actif = QP.ld.phase === 'actif' && zoneAt(player.pos.x, player.pos.z, player.gy) === QP.ld.zone;
        ordre.push(nom);
        const portes = QP.ld.portes;
        const rids = QP.ld.rideaux;
        r.fermees = portes.length > 0 && rids.length === portes.length && rids.every((x) => x.g.visible && x.g.parent === scene) && portes.every((d) => d.cells.every((c) => doorOpen[c] === 1));
        r.musique = QP.mus && QP.mus.def.nom;
        // tir à travers une porte : la balle passe (le champ n'arrête que le joueur)
        const d0 = portes[0], ex = player.pos.x, ez = player.pos.z; let dx = d0.cx - ex, dz = d0.cz - ez; const Ld = Math.hypot(dx, dz);
        raycast(ex, PLAYER_EYE, ez, dx / Ld, 0, dz / Ld, Ld + 0.6);
        r.tirPasse = !RAY.hit;
        // le joueur fonce dans le champ (touche Z/W tenue) : arrêté du côté de la salle, blessé, sans secousse
        const rid = rids[0], mil = rid.alongX ? (rid.x0 + rid.x1) / 2 : (rid.z0 + rid.z1) / 2;
        G.god = false; player.hp = player.maxHp;
        if (rid.alongX) placePlayer(mil, rid.plan + rid.sens * 1.2); else placePlayer(rid.plan + rid.sens * 1.2, mil);
        const tx = rid.alongX ? mil : rid.plan - rid.sens * 3, tz = rid.alongX ? rid.plan - rid.sens * 3 : mil;
        player.yaw = Math.atan2(player.pos.x - tx, player.pos.z - tz); player.pitch = 0;
        const hp0 = player.hp;
        Input.keys.KeyW = true;
        try { for (let t = 0; t < 90; t++) { __zs.step(1, 1 / 60); shake = Math.max(shake, FX.shake); } } finally { Input.keys.KeyW = false; }
        const c1 = rid.alongX ? player.pos.z : player.pos.x;
        r.ecart = +((c1 - rid.plan) * rid.sens).toFixed(2);
        r.arrete = r.ecart >= player.radius - 0.02 && r.ecart < 0.6 && zoneAt(player.pos.x, player.pos.z, player.gy) === QP.ld.zone;
        r.champ = hp0 - player.hp > 0;
        player.hp = player.maxHp;
        if (rid.alongX) placePlayer(mil, rid.plan + rid.sens * 1.6); else placePlayer(rid.plan + rid.sens * 1.6, mil);
        for (let t = 0; t < 40; t++) __zs.step(1, 1 / 60);
        r.champ = r.champ && player.hp === player.maxHp;   // à 1,6 m : rien
        G.god = true; player.hp = player.maxHp;
        placePlayer(cx, cz);
        const anciens = new Set(Zombies.list.filter((z) => z.alive && z.qp));
        let maxZ = 0, chiens = 0, hors = 0, rouge = false, chrono = null, pts = 0, tuesManche = G.killed;
        for (let t = 0; t < 60 * 61 && QP.ld && QP.ld.phase === 'actif'; t++) {
          __zs.step(1, 1 / 60); player.hp = player.maxHp;
          if (t % 30 === 0) {
            const q = Zombies.list.filter((z) => z.alive && z.qp && !anciens.has(z));
            maxZ = Math.max(maxZ, q.length); chiens = Math.max(chiens, q.filter((z) => z.dog).length);
            for (const z of q) if (!z.outside && z.k >= 0 && zoneOf[z.k] >= 0 && zoneOf[z.k] !== QP.ld.zone) hors++;
            if (t === 600) { const j = World.lights.findIndex((l, k) => QP.lampesZ[k] === QP.ld.zone); rouge = j >= 0 && World.lights[j].light.color.getHex() === new THREE.Color(0xff1a10).getHex(); }
            if (t === 900) { const ch = document.getElementById('qp-chrono'); chrono = ch && ch.style.display !== 'none' ? ch.textContent : null; }
            if (t === 1200) {                        // un zombie du lockdown tué : ses points, hors manche
              const z = q.find((x) => !x.dog && !x.outside);
              if (z) { const p0 = G.points; damageZombie(z, z.hp + 1, { kind: 'bullet', dx: 1, dz: 0 }); pts = G.points - p0; }
            }
          }
        }
        r.maxVivants = maxZ; r.chiens = chiens; r.hors = hors; r.rouge = rouge; r.chrono = chrono; r.points = pts; r.mancheIntacte = G.killed === tuesManche;
        r.finAmmo = finAmmo;
        r.fin = QP.ld && QP.ld.phase === 'pause' && portes.every((d) => d.cells.every((c) => doorOpen[c])) && QP.ld.rideaux.every((x) => !x.g.parent) && finAmmo === 1
          && !(document.getElementById('qp-chrono') && document.getElementById('qp-chrono').style.display !== 'none');
        Q.pas(60 * 2);
        const restants = Zombies.list.filter((z) => z.alive && z.qp);
        r.restants = restants.length;
        // le lockdown fini, les restants poursuivent ; tués, ils rapportent leurs points
        r.poursuivent = restants.filter((z) => !z.dog && !z.outside).every((z) => z.state !== 'dead');
        const p1 = G.points;
        for (const z of restants) damageZombie(z, z.hp + 1, { kind: 'bullet', dx: 1, dz: 0 });
        r.pointsApres = G.points - p1;
        clearPowerups();
        Q.pas(60 * 2.2);
        R.push(r);
      }
      } finally { window.qpLdFin = fin0; }
      for (const r of R) {
        ok(r.actif && (r.i === 0 || r.attend) && r.fermees && r.tirPasse && r.arrete && r.champ,
          `${r.nom} : ${r.i === 0 ? 'lockdown dès la coupure (le joueur y est)' : 'la salle appelle, le lockdown part à l’entrée'} ; barrières aux portes : le joueur qui fonce dedans est arrêté (à ${r.ecart} m) et blessé (rien à 1,6 m) ; balles et zombies passent`, r);
        ok(r.maxVivants >= 8 && r.hors === 0 && r.chiens >= 1 && r.chiens <= QP.chiensMax && r.rouge && /VERROUILLAGE/.test(r.chrono || ''),
          `${r.nom} : vague dans la salle (${r.maxVivants} vivants au plus, ${r.chiens} chiens), lampes rouges, chrono « ${r.chrono} »`, r);
        ok(r.points > 0 && r.mancheIntacte && r.fin, `${r.nom} : un zombie tué rapporte ${r.points} points (hors manche) ; au bout d’une minute, portes rouvertes et « Munitions max »`, r);
        ok(r.restants > 0 && r.poursuivent && r.pointsApres > 0, `${r.nom} : ${r.restants} zombies restants poursuivent le joueur ; tués, ${r.pointsApres} points`, r);
      }
      ok(ordre.join() === 'Salle des machines,Entrepôt,Salle d\'arrivée,Infirmerie', 'ordre fixe : Machines, Entrepôt, Arrivée, Infirmerie', ordre);
      const mus = R.map((r) => r.musique);
      ok(mus.every(Boolean) && new Set(mus).size === 4 && !QP.mus, `une musique par lockdown (${mus.join(', ')}), arrêtée à la fin`, mus);
      ok(QP.etape === 'eteint' && QP.coupe && QP.manches && !G.power && QP.k <= QP.noir + 1e-6, 'après le dernier : disjoncteur éteint, toujours dans le noir, atouts suspendus');
      const inter = Features.interactables.find((q) => q.kind === 'power');
      ok(inter.prompt() && /rétablir le courant/.test(inter.prompt().text), 'le disjoncteur se rallume à la main');
      ok(shake === 0 && Q.lampes() === Q.l0, 'champs des portes sans secousse ; aucune lampe ajoutée pendant les lockdowns', { shake, lampes: Q.lampes(), l0: Q.l0 });
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ rallumage, foudre, le Septième
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__qp;
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      clearZombies(); clearPowerups();
      const inter = Features.interactables.find((q) => q.kind === 'power');
      placePlayer(37.5, 10.5); Q.pas(2);
      Q.rendre(); Q.pas(2); Q.rendre();
      const liens0 = Q.liens;
      inter.use(); Q.pas(1);
      ok(G.power && QP.etape === 'rallume' && !QP.coupe && player.perks.has('endurance') && player.maxHp === RULES.cuirasseHp, 'rallumage : courant rétabli, machines rallumées');
      placePlayer(24.5, 26); Q.pas(2);
      let shake = 0;
      for (let i = 0; i < 600 && !QP.frappe; i++) { Q.pas(1); shake = Math.max(shake, FX.shake); }
      Q.pas(2); Q.rendre(); Q.pas(2); Q.rendre();
      const liensFoudre = Q.liens - liens0;
      const b = QP.breche;
      let ciel = true; for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) if (ceilOn[z * GW + x]) ciel = false;
      ok(QP.etape === 'eclair' && QP.frappe && !QP.toit.visible && QP.bord.visible && QP.gravats.visible && ciel && QP.eclairM && QP.eclairM.visible,
        'la foudre frappe la Salle d’arrivée : toit détruit (bord cassé, gravats), ciel visible, tirs vers le ciel');
      ok(QP.sept && B7V.modele.object.parent === scene && B7V.fxBunker.parent === scene && B7.etat === 'inactif', 'le Septième apparaît sous la brèche (combat pas encore commencé)');
      ok(Q.lampesFx() === 3 && QP.fxLampes && QP.fxLampes.length === 3 && QP.fxLampes.every((o) => !o.visible) && Q.lampes() === Q.l0,
        `lampes après la foudre : même état qu'au départ (${Q.lampes()}) ; les 3 lampes de la couche d'effets du boss cachées pendant la quête`);
      for (let i = 0; i < 60 * 5; i++) { Q.pas(1); shake = Math.max(shake, FX.shake); }
      Q.pas(60 * 4);
      ok(QP.etape === 'septieme' && QP.sept.phase === 'attente' && QP.k === 1 && G.power, 'puis il attend, passif (lumière revenue)');
      ok(QP.chutes.every((c) => c.pose) && QP.chutes.every((c) => Math.abs(c.m.position.y - (QP.brecheE + c.m.scale.y / 2)) < 0.01), 'les dalles tombées reposent au sol');
      // invulnérable : un tir sur lui ne fait rien
      const S = QP.sept, p0 = G.points;
      Q.tir({ x: S.x, y: S.vue.position.y + 1.2, z: S.z }); Q.pas(2);
      ok(B7.etat === 'inactif' && QP.sept.phase === 'attente' && G.points === p0 && S.vue.vulnerable === false, 'un tir sur le Septième : rien (invulnérable, passif)');
      // loin : il attend ; tout près, la cinématique
      placePlayer(24.5, 27.5); Q.pas(30);
      ok(QP.sept.phase === 'attente', 'à distance : il attend');
      placePlayer(24.8, 24.3); Q.pas(3);
      ok(QP.sept.phase === 'cine' && B7.cine && B7.bloque && B7.invul && QP.sept.vue.action.id === 'rituel_ames', 'à l’approche : cinématique (joueur bloqué, invulnérable), absorption de l’âme');
      // absorption et téléportation en même temps : le combat démarre pendant la capture, le Septième reste visible
      let demarre = null, visible = true, captureMax = 0, aspMax = 0, noirAvant = 0, ecran = null;
      const lire = () => { let u = null; B7V.fx.rendreEcran({ autoClear: true, render(sc) { if (qpTransfert()) qpEcranTeleport(sc); const U = sc.children[0].material.uniforms; u = { c: U.uA.value.z, a: U.uA.value.w, n: U.uB.value.x }; } }); return u; };
      for (let i = 0; i < 60 * 10 && B7.lieu !== 'salle'; i++) {
        __zs.step(1, 1 / 60); shake = Math.max(shake, FX.shake);
        if (QP.etape === 'combat' && demarre === null) demarre = { ct: QP.sept.ct, etape: QP.sept.vue.action.etape };
        if (QP.etape === 'combat' && B7.lieu === 'bunker') {
          visible = visible && B7V.modele.object.parent === scene && qpTransfert() && QP.sept.vue.action.id === 'rituel_ames';
          ecran = lire(); if (ecran) { captureMax = Math.max(captureMax, ecran.c); aspMax = Math.max(aspMax, ecran.a); noirAvant = Math.max(noirAvant, ecran.n); }
        }
      }
      const liens1 = Q.liens; Q.pas(1); Q.rendre(); Q.pas(1); Q.rendre();
      const liensSalle = Q.liens - liens1;
      ok(liensFoudre <= 3 && liensSalle <= 3, `pas de gel : ${liensFoudre} programme(s) compilé(s) au rallumage et à la foudre, ${liensSalle} à l'arrivée dans la salle du boss (avant : ≈ 100 et 120)`, { liensFoudre, liensSalle });
      const R = QP_RITUEL, fin = R.elevation + R.incantation + R.capture;
      ok(demarre && demarre.etape === 'capture' && Math.abs(demarre.ct - (fin - BOSS_B7_CONFIG.introduction.fondu)) < 0.05,
        `le combat démarre pendant la capture (${demarre && demarre.ct.toFixed(2)} s), pour que la téléportation tombe à la fin de l'absorption (${fin.toFixed(1)} s)`, demarre);
      ok(visible && captureMax > 0.9 && aspMax > 0.9 && noirAvant > 0.9,
        `jusqu'à la téléportation : le Septième visible et qui absorbe, capture (${captureMax.toFixed(2)}), aspiration (${aspMax.toFixed(2)}) et noir (${noirAvant.toFixed(2)}) ensemble`);
      ok(B7.lieu === 'salle' && QP.sept === null && B7.etat === 'introduction' && Q.secrets.includes('b7-quete'), 'téléporté dans la salle du boss : l’introduction du paquet reprend le Septième ; secret « b7-quete » découvert', { lieu: B7.lieu, etat: B7.etat, secrets: Q.secrets });
      for (let i = 0; i < 60 * 12 && B7.etat === 'introduction'; i++) Q.pas(1);
      ok(B7.etat === 'phase1' && !B7.bloque && QP.etape === 'fini', 'puis le combat commence (phase 1), commandes rendues', { etat: B7.etat, etape: QP.etape });
      ok(shake === 0, 'aucune secousse, de la foudre à la téléportation');
      renderEnabled = true; render(); renderEnabled = false;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ remise à zéro
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__qp;
      Q.partie(); Q.pas(5);
      const b = QP.breche;
      let plafond = true; for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) if (!ceilOn[z * GW + x]) plafond = false;
      ok(QP.etape === 'attente' && !QP.coupe && !QP.manches && QP.ld === null && QP.sept === null && QP.k === 1, 'nouvelle partie : quête remise en attente');
      ok(QP.toit.visible && !QP.bord.visible && !QP.gravats.visible && plafond && QP.chutes.every((c) => !c.m.visible), 'toit refait, plafond rendu');
      ok(!B7V.modele.object.parent && !(document.getElementById('qp-chrono') && document.getElementById('qp-chrono').style.display !== 'none'), 'le Septième retiré, chrono caché');
      Q.rendre();                                // lampes éteintes de HC-boss-lampes.js ajustées avant chaque rendu
      ok(Q.lampes() === Q.l0, `état des lampes : ${Q.lampes()} (comme au départ)`);
      renderEnabled = true; render(); renderEnabled = false;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ code du boss, Glas, « Rejouer » en plein lockdown
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const Q = window.__qp;
      Q.partie(); Q.pas(3);
      activatePower(); Q.pas(200); __zs.openAll(); Q.pas(5);
      // un code fictif à la place de celui du boss (son empreinte remise après l'essai ; le vrai code n'est jamais cherché)
      const emp0 = B7A.empreinte, code = 'essai-fictif';
      B7A.empreinte = b7CodeEmpreinte(code);
      const avant = b7CodeDigipass(code);
      // Glas : une arme reforgée attend sous la cloche, le joueur a deux armes en main
      __zs.give('mp40', 0); Q.pas(40); __zs.give('thompson', 2); Q.pas(40);
      const amp = Features.amp;
      const armes = Arms.slots.map((x) => x && x.id).join();
      Q.tir(); Q.pas(1);
      const pendant = QP.etape === 'electrifie' && b7CodeDigipass(code);
      for (let i = 0; i < 60 * QP.elec && QP.t < QP.elec - 0.5; i++) Q.pas(1);
      // juste avant le court-circuit, une arme reforgée attend sous la cloche (avant, la règle du Glas s'applique)
      amp.state = 'ready'; amp.t = 0; amp.weapon = { id: 'kar98k', from: 0 }; amp.tier = 2; glasShow(amp, 'kar98k', 2);
      for (let i = 0; i < 60 * 4 && QP.etape !== 'lockdowns'; i++) Q.pas(1);
      Q.pas(60 * 2);
      const enLd = QP.etape === 'lockdowns' && b7CodeDigipass(code);
      B7A.empreinte = emp0;
      ok(avant === 'boss' && pendant === null && enLd === null, 'code du boss au digi pass : accepté avant la quête, refusé pendant l’électrification et les lockdowns', { avant, pendant, enLd });
      ok(amp.state === 'ready' && amp.weapon && amp.weapon.id === 'kar98k' && Arms.slots.map((x) => x && x.id).join() === armes && amp.t < 0.1,
        'coupure avec deux armes en main : l’arme du Glas attend sous la cloche (rien n’est remplacé de force, elle n’est pas perdue)', { st: amp.state, armes: Arms.slots.map((x) => x && x.id) });
      Arms.slots[0] = null; if (amp.weapon) glasTake(amp); Q.pas(3);
      ok(Arms.slots.some((x) => x && x.id === 'kar98k' && x.tier === 2) && amp.state === 'mute' && !QP.glasAttente, 'reprise (F) : l’arme au palier II rendue, puis Le Glas se tait');
      // « Rejouer » en plein lockdown (startGame sans repasser par le menu)
      const L = QP.ld, portes = L ? L.portes : [], rid = L && L.rideaux ? L.rideaux.slice() : [];
      const actif = !!L && L.phase === 'actif' && rid.length > 0 && rid.every((r) => r.g.parent === scene) && !!QP.mus;
      startGame(null); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } G.god = true; Q.pas(3);
      ok(actif && QP.etape === 'attente' && !QP.mus && !G.power && portes.every((d) => !d.opened && d.cells.every((c) => !doorOpen[c])) && rid.length > 0 && rid.every((r) => !r.g.parent),
        '« Rejouer » en plein lockdown : quête remise, portes de la salle fermées et payantes (pas traversables), champs retirés', { actif, n: portes.length, ouvertes: portes.filter((d) => d.cells.some((c) => doorOpen[c])).length });
      ok(World.lights.every((l) => !l.qpPortee && l.light.color.getHex() === new THREE.Color(l.color).getHex()) && Q.lampes() === Q.l0, 'lampes rendues (portée, couleur) et nombre d’origine');
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
  console.log(failures ? `${failures} échec(s).` : 'Quête principale de Bunker 7 : conforme (disjoncteur, coupure, lockdowns, foudre, Septième, transfert vers le combat, remise à zéro).');
  process.exit(failures ? 1 : 0);
})();
