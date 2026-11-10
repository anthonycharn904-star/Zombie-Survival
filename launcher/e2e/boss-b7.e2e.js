'use strict';
/* Boss de Bunker 7, « Le Dernier Pacte » (jeu 2.0.7), dans la fenêtre du jeu du launcher : les critères de validation du
   brief d'Anthony (boss-bunker7/le-dernier-pacte/INTEGRATION.md, §9), vérifiés dans le jeu. Le code du boss n'est jamais
   écrit : comme pour le digi pass (game-menu.e2e.js), l'essai le retrouve par les 10 000 essais possibles, le tape au
   clavier du digi pass et ne le montre jamais. Critère 1 : la logique du jeu livré est celle du paquet, et ses 94 tests
   passent (côté Node, si le paquet est présent). Blocs : chargement et déclenchement (critères 1, 2, 3) ; phase 1, armes et
   calibrage (4, 13, 19, 20, 44, 45, 46) ; répit, absence, phase 3, rituel, faiblesse, chiens (5, 7, 8, 14, 15, 17, 20, 30,
   31) ; phase 2 et mini-boss (6, 21 à 29, 35 à 41, 46) ; phase 5 (3, 9, 13, 18, 32, 34, 42, 43) ; fin du combat (2, 3, 10,
   16, 47, 48) ; retour dans Bunker 7 après une victoire en phase 5 (ambiance normale, armes au sol, nouvelle partie) ;
   robustesse (11) ; panneau de test, sons décodés et performances (12) ; changement de carte en plein combat (11). Retours
   d'Anthony du 2 novembre 2026 : dalles lancées visibles, barre vidée vers la droite, bonus de la victoire (5 min, en rouge),
   bords de l'écran après une mort, Bunker 7 après la victoire.
     xvfb-run -a node e2e/boss-b7.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-boss-b7-'));
const USER = path.join(TMP, 'joueur');
const PAQUET = path.join(ROOT, '..', 'boss-bunker7', 'le-dernier-pacte');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  try {
    const res = [];
    const report = (r) => res.push(r);
    // ------------------------------------------------------------ Critère 1 (Node) : logique du jeu livré et ses 94 tests
    if (fs.existsSync(path.join(PAQUET, 'src', 'logique.js'))) {
      const jeu = fs.readFileSync(path.join(ROOT, 'game', 'index.html'), 'utf8');
      report({ ok: jeu.includes(fs.readFileSync(path.join(PAQUET, 'src', 'logique.js'), 'utf8')), label: 'critère 1 : la logique du jeu livré est celle du paquet, octet pour octet' });
      const t = spawnSync(process.execPath, ['tests/test-logique.js'], { cwd: PAQUET, encoding: 'utf8', timeout: 600000 });
      report({ ok: t.status === 0 && /94 ok, 0 échec\(s\) sur 94 tests/.test(t.stdout || ''), label: 'critère 1 : 94 tests de la logique sur 94 (dans le paquet)', extra: (t.stdout || String(t.error)).trim().split('\n').slice(-2).join(' ') });
    } else console.log('(critère 1 : paquet boss-bunker7 absent, vérifié seulement par build.py)');
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    const launcher = await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [game] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') game.setDefaultTimeout(600000);   // rendu logiciel : images lentes, combat long
    await game.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    const errors = [];
    game.on('pageerror', (e) => errors.push(String(e)));
    // ------------------------------------------------------------ Chargement, digi pass, salle secrète (critères 1, 2, 3)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      // outils communs aux blocs suivants (la page reste la même)
      const T = window.__b7t = {
        plein: true,
        pas(n) { for (let i = 0; i < n; i++) { if (T.plein) player.hp = player.maxHp; __zs.step(1); } },
        C: () => B7.combat,
        e: () => B7.combat.etat(),
        O: () => BOSS_B7_ARENE.salle.origine,
        ici(x, z, lacet) { const O = T.O(); B7.jeu.teleporter('j1', { x: O.x + x, y: 0, z: O.z + z }, lacet || 0, 'salle'); },
        bunker(x, z, lacet) { B7.jeu.teleporter('j1', { x, y: 0, z }, lacet == null ? Math.PI : lacet, 'bunker'); },
        partie() {
          __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
          G.god = false; player.maxHp = player.hp = 1e6; T.plein = true;
          T.ev.length = 0; T.branche();
        },
        ev: [],
        branche() {                              // une écoute par combat (le combat est créé une fois)
          const C = B7.combat;
          if (!C || C.__b7t) return;
          C.__b7t = true;
          for (const t of ['etat', 'joueurTouche', 'teleport', 'bonus', 'crochet', 'intangible', 'frappe', 'critique', 'pique', 'piqueImpact', 'ailes',
            'murs', 'miniBoss', 'infection', 'bras', 'petitDemembre', 'chien', 'meute', 'protection', 'bloc', 'blocImpact', 'capture', 'palier',
            'recompense', 'fin', 'invocation', 'zone', 'action', 'tube', 'pilier', 'lames', 'interaction', 'message', 'immunise', 'zombiesCendres', 'absorption']) {
            C.on(t, (d) => T.ev.push({ t: G.time, type: t, d: JSON.parse(JSON.stringify(d || {})) }));
          }
        },
        evs: (type, f) => T.ev.filter((q) => q.type === type && (!f || f(q.d))),
        mb: () => (B7.combat.etat().miniBoss || []).find((m) => m.etat === 'actif'),
        mbq() { const m = T.mb(); return { m, q: m ? B7E.Z.obtenir(m.id) : null, z: m ? B7E.ents.get(m.id) : null }; },
        blesserMB(frac) { const { q, z } = T.mbq(); if (z && q) damageZombie(z, frac * q.pvMax, { kind: 'bullet', dx: 0, dz: 1 }); },
        rage() { const { q } = T.mbq(); for (let k = 0; q && k < 60 && q.pv / q.pvMax >= 0.495; k++) { T.blesserMB(0.02); if (!B7V.touche) break; } },
        tuerMB() { const { z } = T.mbq(); if (z) damageZombie(z, 1e9, { kind: 'bullet', dx: 0, dz: 1 }); },
        taper(code) {                            // au clavier du digi pass (le joueur devant lui) ; état du clavier ensuite
          const dp = Features.digipass;
          T.bunker(dp.x + LAYOUT.digipass.n[0] * 1.2, dp.z + LAYOUT.digipass.n[1] * 1.2, null);
          openKeypad(); T.pas(2);
          for (const d of code) { Input.down['Digit' + d] = true; T.pas(3); }
          T.pas(Math.ceil(60 * 0.4));
          return { etat: Keypad.state, message: document.getElementById('kp-msg').textContent, verdict: Keypad.b7 || null };
        },
        // un code à 4 chiffres d'après son empreinte (jamais renvoyé ni affiché)
        code: (f) => { for (let i = 0; i < 1e4; i++) { const c = String(i).padStart(4, '0'); if (f(c)) return c; } return null; },
        image() { renderEnabled = true; render(); renderEnabled = false; },
        dist: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
      };
      ok(typeof BossB7Logique === 'object' && BossB7Logique.version === '1.5.0' && typeof BossB7Modele === 'object' && typeof BossB7Fx === 'object' && typeof BossB7Audio === 'object'
        && typeof BossB7Hud === 'object' && typeof ProtoB7Monde === 'object' && typeof ProtoB7Zombies === 'object' && BOSS_B7_CONFIG.valider().length === 0,
        'paquet du boss chargé : logique 1.5.0, modèle, effets, sons, interface, salle et mini-boss ; config valide');
      T.partie();
      ok(B7.on && !!B7.combat && !!B7V.modele && !!B7E.Z && !!B7S.monde && B7S.actif && B7.etat === 'inactif',
        'Bunker 7 : combat, rendu, ennemis et salle créés au chargement de la carte', { err: B7.err, rendu: B7V.err, ennemis: B7E.err, salle: B7S.err });
      ok(Object.keys(BOSS_B7_SONS.donnees).length === 133 && !!B7.audio, 'sons du boss embarqués (133), décodage lancé sur le contexte du jeu (fin contrôlée au bloc 8)', Object.keys(BOSS_B7_SONS.donnees).length);
      // la salle n'est jamais dans la scène tant que le joueur est dans Bunker 7, et aucun chemin n'y mène (critère 3)
      T.pas(30); T.image();
      const S0 = LAYOUT.spawn.pos;
      ok(!B7S.racine.parent && World.root.visible && b7Chemin({ x: S0[0], y: 0, z: S0[1] }, { x: T.O().x, y: 0, z: T.O().z }) === null,
        'critère 3 : salle secrète invisible depuis Bunker 7 (absente de la scène), aucun chemin à pied n’y mène');
      // un mauvais code ; le code du boss (critère 2) : le combat démarre, une fois par partie
      const faux = T.code((c) => digipassHash(c) !== DIGIPASS_HASH && b7CodeEmpreinte(c) !== B7_CODE_EMPREINTE);
      const f = T.taper(faux); T.pas(60);
      ok(f.etat === 'error' && f.message === 'Code erroné' && B7.etat === 'inactif' && !B7.actif, 'critère 2 : un mauvais code est refusé, pas de combat', f);
      const t = T.taper(T.code((c) => b7CodeEmpreinte(c) === B7_CODE_EMPREINTE));
      ok(t.verdict === 'boss' && t.message === 'Code accepté', 'critère 2 : le code du boss est accepté au digi pass', { etat: t.etat, message: t.message, verdict: t.verdict });
      T.pas(60 * 1);
      ok(B7.etat === 'introduction' && B7.actif && B7.manches, 'critère 2 : le combat démarre (introduction), les manches sont suspendues', { etat: B7.etat });
      T.pas(Math.ceil(60 * (BOSS_B7_CONFIG.introduction.fondu + 0.5)));
      T.image();
      const A0 = BOSS_B7_ARENE.salle.arriveeJoueurs[0], O = T.O();
      ok(B7.lieu === 'salle' && Math.hypot(player.pos.x - (O.x + A0.x), player.pos.z - (O.z + A0.z)) < 0.3 && B7S.racine.parent === scene && !World.root.visible,
        'critère 3 : après le fondu, le joueur est dans la salle secrète (Bunker 7 caché)', { lieu: B7.lieu });
      ok(B7A.compile && B7A.programmes > 0, `matières du combat compilées d'un coup à l'entrée (${B7A.programmes} programmes, ${B7A.ms} ms)`, { ms: B7A.ms, n: B7A.programmes });
      T.pas(60 * 8);
      ok(B7.etat === 'phase1', 'introduction terminée : phase 1', B7.etat);
      const encore = T.code((c) => b7CodeEmpreinte(c) === B7_CODE_EMPREINTE);
      ok(b7CodeDigipass(encore) === null, 'critère 2 : pendant le combat, le code du boss ne sert pas');
      // seul le verrou « une fois par partie » peut le refuser ici : combat arrêté, code retapé au clavier
      T.C().allerA('inactif'); T.pas(2);
      const r2 = T.taper(encore); T.pas(60);
      ok(B7A.codes.boss && r2.etat === 'error' && r2.message === 'Code erroné' && !r2.verdict && B7.etat === 'inactif',
        'critère 2 : une fois par partie : le code du boss retapé, « Code erroné », pas de combat', { etat: r2.etat, message: r2.message, combat: B7.etat });
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Phase 1 : armes, calibrage, sorts, zombies (4, 13, 19, 20, 44, 45, 46)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C(), cfg = C.config, near = (a, b, d) => Math.abs(a - b) <= d;
      T.partie();
      C.demarrer(); T.pas(60 * 9);
      C.allerA('phase1'); T.ici(0, -6, Math.PI); T.pas(60);
      // critère 45 : la Thompson au palier I du Glas tire 110 × 760 / 60 = 1 393 par seconde ; la phase 1 en demande 27 s
      const th = { id: 'thompson', tier: 1, up: true }, dps = wstat(th, 'dmg') * wstat(th, 'rpm') / 60, e1 = T.e();
      ok(near(cfg.dpsReference, 1393, 0) && near(dps, 1393, 1) && near(e1.barre.max / dps, 27, 0.05), `critère 45 : calibrage (Thompson, palier I : ${dps.toFixed(1)} dégâts/s ; phase 1 : ${(e1.barre.max / dps).toFixed(1)} s de tir)`,
        { dmg: wstat(th, 'dmg'), rpm: wstat(th, 'rpm'), pv: e1.barre.max });
      // … et dans le jeu, où un tir part au plus une fois par image : 5 s de tir continu (chargeur toujours plein)
      __zs.give('thompson', 1); T.pas(60);
      const sT = curSlot(), tirs0 = G.stats.shots;
      for (let i = 0; i < 300; i++) { sT.mag = wstat(sT, 'mag'); Input.lmb = true; T.pas(1); }
      Input.lmb = false; T.pas(2);
      const cad = (G.stats.shots - tirs0) / 5, dpsJeu = cad * wstat(sT, 'dmg'), duree = e1.barre.max / dpsJeu;
      ok(sT.id === 'thompson' && sT.tier === 1 && near(duree, 27, 2), `critère 45 : Thompson au palier I tirée 5 s dans le jeu (60 images/s) : ${cad.toFixed(2)} balles/s, ${dpsJeu.toFixed(0)} dégâts/s ; phase 1 en ${duree.toFixed(1)} s de tir`,
        { cad, dpsJeu, duree });
      // critère 44 : chaque catégorie d'arme ; tête × 1,5 exactement ; bouclier quand il est protégé
      const degats = [];
      C.on('degats', (d) => degats.push({ montant: d.montant, zone: d.zone, m: d.multiplicateur }));
      for (const z of Zombies.list) if (z.alive && z.b7) damageZombie(z, 1e6, { kind: 'bullet', dx: 0, dz: 1 });
      const s = curSlot(), M = B7V.modele, tir = (zone) => {
        const h = M.hitboxes().find((q) => q.zone === zone), o = { x: h.centre.x - 3, y: h.centre.y, z: h.centre.z - 3 }, l = Math.hypot(3, 3);
        degats.length = 0; B7V.touche = false;
        hitscan(s, o.x, o.y, o.z, 3 / l, 0, 3 / l, o);
        return degats[0] || null;
      };
      let corps = null, tete = null;
      for (let k = 0; k < 10 && !(corps && tete); k++) { corps = corps || tir('corps'); tete = tete || tir('tete'); if (!(corps && tete)) T.pas(20); }
      ok(corps && tete && near(tete.montant / corps.montant, 1.5, 1e-6), 'critère 44 : balle au corps et à la tête, tête × 1,5 exactement', { corps, tete });
      degats.length = 0;
      const pb = T.e().boss.position;
      explode(pb.x + 1, 1, pb.z, 3, 600, { color: 0xff7a30, src: 'essai' });
      const ex = degats.length;
      damageZombie(B7V.ent, 150, { kind: 'knife', dx: 1, dz: 0, force: 1.2 });
      const kn = degats.length - ex;
      ok(ex === 1 && kn === 1, 'critère 44 : une explosion (grenade, projectile) et un coup de couteau blessent le Septième, une fois chacun', { ex, kn });
      // critère 46 : ni Bombe, ni onde du Glas, ni Mort instantanée, ni arme merveille ne le tuent d'un coup
      degats.length = 0;
      damageZombie(B7V.ent, 1e9, { kind: 'nuke' }); damageZombie(B7V.ent, 1e9, { kind: 'glas' });
      const rien = degats.length;
      G.timers.insta = 10; const c2 = tir('corps'); G.timers.insta = 0;
      degats.length = 0;
      player.pos.set(pb.x - 3, 0, pb.z - 3); camera.position.set(pb.x - 3, 1.6, pb.z - 3); _fwd.set(1, 0, 1).normalize();
      blastCone({ id: 'blaster', up: false });
      const bl = degats.map((q) => q.montant / (q.m || 1));
      ok(rien === 0 && c2 && corps && near(c2.montant, corps.montant, 1e-6) && bl.length === 1 && near(bl[0], cfg.dpsReference, 1) && T.e().barre.valeur > 0,
        'critère 46 : Bombe et onde du Glas sans effet, Mort instantanée sans effet (dégâts normaux), Onde de choc : 1 393 (jamais d’un coup)', { rien, insta: c2, corps, blast: bl });
      // la Bombe ramassée (son vrai chemin : les zombies s'effondrent en quelques images) : le Septième reste debout
      const vB = T.e().barre.valeur;
      applyPowerup('nuke'); T.pas(60 * 2);
      ok(B7V.ent && Zombies.list.includes(B7V.ent) && B7V.ent.alive && T.e().barre.valeur === vB, 'critère 46 : Bombe ramassée : le Septième reste debout, aucun dégât', { avant: vB, apres: T.e().barre.valeur });
      // critères 4 et 13 : sorts au sol ; les zombies du combat sortent de terre, puis courent au plus vite sur le joueur
      T.ici(0, -6, Math.PI);
      const n0 = T.evs('invocation').length, z0 = T.evs('zone').length;
      let vus = 0, leves = 0;
      for (let i = 0; i < 60 * 12; i++) {
        T.pas(1);
        const inv = T.evs('invocation');
        for (; n0 + vus < inv.length; vus++) { const z = b7Zombie(inv[n0 + vus].d.zombieId); if (z && z.state === 'rise') leves++; }
      }
      ok(T.evs('zone').length > z0 && vus > 0 && leves === vus, `critère 4 : ${T.evs('zone').length - z0} sorts au sol, ${vus} zombies invoqués, tous sortis de terre`, { zones: T.evs('zone').length - z0, vus, leves });
      const zs = Zombies.list.filter((z) => z.alive && z.b7 && !z.dog && z.state !== 'rise');
      ok(zs.length > 0 && zs.every((z) => near(z.speed, SPEEDS.run[1] * z.type.mult.speed, 1e-6) && ['chase', 'attack'].includes(z.state)),
        `critère 13 : ${zs.length} zombies du combat, à la course la plus rapide du jeu, sur le joueur`, zs.map((z) => [z.speed, z.state]));
      // critère 19 : sous 50 % des PV de la phase 1 : chaque sort est doublé, les deux sous le joueur à 1–2 s d'écart ; meute (critère 20)
      const tMoitie = G.time;
      C.forcer('pvSegment', 0.45 * T.e().barre.max); T.pas(60 * 14);
      const zs2 = T.evs('zone', (d) => T.dist(d.position, player.pos) < 2.5).filter((q) => q.t >= tMoitie);
      const paire = zs2.some((a, i) => zs2.slice(i + 1).some((b) => b.t - a.t >= 0.9 && b.t - a.t <= 2.1));
      ok(T.e().secondeMoitie === true && paire && T.evs('meute', (d) => d.etat === 'dechainee').length === 1,
        `critères 19 et 20 : seconde moitié de la phase 1 : sorts doublés (${zs2.length} sorts sous le joueur, deux à 1–2 s d'écart), meute lâchée`, zs2.map((q) => +(q.t - tMoitie).toFixed(2)));
      const ch = Zombies.list.filter((z) => z.alive && z.dog && z.b7);
      ok(ch.length === cfg.chiens.max, `critère 20 : ${ch.length} chiens sortis de failles`, ch.length);
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Répit, absence, phase 3, rituel, faiblesse (5, 7, 8, 14, 15, 17, 20, 30, 31)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C(), cfg = C.config, near = (a, b, d) => Math.abs(a - b) <= d;
      const chiens = () => Zombies.list.filter((z) => z.alive && z.dog && z.b7).length;
      const duree = (etat) => {                            // de l'entrée dans un état au suivant (heure du jeu)
        const a = T.evs('etat', (d) => d.vers === etat).pop(), b = a && T.ev.find((q) => q.type === 'etat' && q.t > a.t);
        return a && b ? +(b.t - a.t).toFixed(3) : null;
      };
      T.partie(); G.god = true;
      C.demarrer(); T.pas(60 * 9);
      // critère 5 : répit 15,0 s et absence 30,0 s ; critère 20 : les chiens restent
      C.allerA('repit'); T.pas(60 * 3);
      const chRepit = chiens();
      T.pas(60 * 13);
      C.allerA('absence'); T.pas(60 * 3);
      const chAbsence = chiens();
      T.pas(60 * 28.5);
      ok(near(duree('repit'), 15, 0.02) && near(duree('absence'), 30, 0.02), `critère 5 : répit ${duree('repit')} s, absence ${duree('absence')} s`);
      // critère 15 : en phase 3, les apparitions reprennent 5 s après le début ; critère 7 : blocs à 25 % au moins, même avec Mastodonte
      C.allerA('phase3'); T.ici(0, -6, Math.PI);
      const t3 = G.time, avant = new Set(Zombies.list.filter((z) => z.alive && z.b7).map((z) => z.id));
      let premier = null;
      grantPerk('cuirasse'); T.pas(30);
      const mh = player.maxHp, inf = B7.jeu.infligerDegats, coups = [];
      B7.jeu.infligerDegats = (id, f, o) => { const h0 = player.hp; const v = inf(id, f, o); if (o && o.source === 'bloc') coups.push({ f, ign: !!o.ignorerReductions, perte: +((h0 - player.hp) / player.maxHp).toFixed(3) }); return v; };
      G.god = false;
      // retour d'Anthony du 2 novembre 2026 (défaut 1) : dalles détachées (arrachée, en lévitation, en vol) là où la logique les place
      const wd = new THREE.Vector3(), dalles = { n: 0, ecart: 0, cachees: 0 };
      for (let i = 0; i < 60 * 20; i++) {
        T.pas(1);
        if (premier == null && Zombies.list.some((z) => z.alive && z.b7 && !z.dog && !avant.has(z.id))) premier = +(G.time - t3).toFixed(2);
        for (const b of B7.e ? B7.e.blocs : []) if (b.position && ['arrache', 'levitation', 'vol'].includes(b.etat)) {
          const g = B7S.monde.dalle(b.id); g.getWorldPosition(wd);
          dalles.n++; if (!g.visible) dalles.cachees++;
          dalles.ecart = Math.max(dalles.ecart, Math.hypot(wd.x - b.position.x, wd.y - b.position.y, wd.z - b.position.z));
        }
      }
      B7.jeu.infligerDegats = inf; G.god = true;
      const chPhase3 = chiens(), A3 = cfg.phase3.apparitions;
      const n3 = Zombies.list.filter((z) => z.alive && z.b7 && !z.dog && !avant.has(z.id));
      ok(premier != null && near(premier, A3.delai + A3.intervalle, 0.15) && n3.length > 0 && n3.every((z) => ['rise', 'chase', 'attack'].includes(z.state)),
        `critère 15 : phase 3 : les apparitions reprennent à ${A3.delai} s, premier zombie sorti à ${premier} s (un intervalle de ${A3.intervalle} s), tous sur le joueur`, { premier, etats: n3.map((z) => z.state) });
      ok(mh > 100 && coups.length > 0 && coups.every((q) => q.f >= 0.25 && q.ign && q.perte >= 0.25 - 1e-3), `critère 7 : ${coups.length} blocs reçus avec Mastodonte (${mh} PV), chacun ≥ 25 % des PV max, sans réduction`, coups);
      T.pas(60 * 16);
      ok(T.evs('bloc', (d) => d.etat === 'reconstruit').length > 0, 'critère 7 : les murs arrachés se reforment');
      ok(dalles.n > 0 && dalles.ecart < 0.01 && !dalles.cachees,
        `phase 3 : dalles arrachées, en lévitation et en vol visibles là où la logique les place (${dalles.n} mesures, écart ${dalles.ecart.toFixed(3)} m)`, dalles);
      // décision d'Anthony du 2 novembre 2026 : une dalle détachée arrête les tirs, exactement comme dans la démo ; seul le rayon
      // de la caméra TPS la traverse (vertige). Matrices de la dalle mises à jour le temps de la mesure (le rendu le fait en jeu),
      // puis remises : les contrôles suivants voient les dalles comme avant
      let tirDalle = null, cachees = 0;
      for (let i = 0; i < 60 * 12 && !tirDalle; i++) {
        T.pas(1);
        const b = (T.e().blocs || []).find((q) => q.etat === 'levitation');
        if (!b) continue;
        const g = B7S.monde.dalle(b.id), avantM = [];
        g.traverse((o) => avantM.push([o, o.matrixWorld.clone()]));
        g.updateMatrixWorld(true); g.getWorldPosition(wd);
        const oy = player.gy + PLAYER_EYE, dx = wd.x - player.pos.x, dy = wd.y - oy, dz = wd.z - player.pos.z, L = Math.hypot(dx, dy, dz);
        const rayon = (cam) => { B7S.cameraTps = cam; b7SalleRayon(player.pos.x, oy, player.pos.z, dx / L, dy / L, dz / L, L + 1); B7S.cameraTps = false; return RAY.hit ? RAY.t : Infinity; };
        const tTir = rayon(false), tCam = rayon(true);
        for (const [o, m] of avantM) o.matrixWorld.copy(m);
        // les deux rayons ne diffèrent que par les dalles détachées : celui de la caméra arrêté avant le centre de la dalle, c'est
        // qu'autre chose la cache (pilier, cuve…) : image suivante (la dalle bouge) ou dalle suivante
        if (tCam < L) { cachees++; continue; }
        tirDalle = { distance: +L.toFixed(2), tir: tTir < L, camera: tCam < L, cachees };
      }
      ok(tirDalle && tirDalle.tir && !tirDalle.camera, 'phase 3 : une dalle en lévitation arrête un tir du jeu (comme dans la démo), pas le rayon de la caméra TPS', tirDalle);
      // H1 : persoTpsCam lance son rayon avec le drapeau des dalles détachées, puis le retire (vertige : pas de coup de zoom)
      const rayon0 = window.b7SalleRayon; let pendant = null;
      window.b7SalleRayon = function () { pendant = B7S.cameraTps; return rayon0.apply(this, arguments); };
      try { persoTpsCam(); } finally { window.b7SalleRayon = rayon0; }
      ok(pendant === true && B7S.cameraTps === false, 'caméra TPS : persoTpsCam lance son rayon avec B7S.cameraTps, puis le remet à faux', { pendant, apres: B7S.cameraTps });
      // critère 30 : sous 50 % : salves de 4 blocs lancés en moins d'une demi-seconde
      C.forcer('pvSegment', 0.49 * T.e().barre.max);
      // retour d'Anthony du 2 novembre 2026 (défaut 3) : la barre du Septième se vide vers la droite (transitions coupées le
      // temps de la mesure : le rouge du segment courant reste collé à son bord droit)
      const sansTr = document.createElement('style'); sansTr.textContent = '.b7h *{transition:none!important}'; document.head.appendChild(sansTr);
      T.pas(2);
      const segB = [...document.querySelectorAll('.b7h-barre .b7h-seg')][T.e().barre.segment];
      const rsB = segB && segB.getBoundingClientRect(), riB = segB && segB.querySelector('i').getBoundingClientRect();
      sansTr.remove();
      ok(segB && getComputedStyle(segB).transform === 'matrix(-1, 0, 0, 1, 0, 0)' && Math.abs(riB.right - rsB.right) < 1.5 && riB.left > rsB.left + 1,
        'barre de vie du Septième vidée vers la droite : à 49 % des PV de la phase 3, le rouge reste collé au bord droit du segment', { segment: rsB && [rsB.left, rsB.right], rouge: riB && [riB.left, riB.right] });
      let salve = null;
      for (let i = 0; i < 60 * 12 && !salve; i++) { T.pas(1); const a = T.e().boss.action; if (a && a.donnees && a.donnees.salve) salve = a.donnees.blocs.slice(); }
      T.pas(60 * 3);
      const vols = salve ? salve.map((id) => (T.evs('bloc', (d) => d.id === id && d.etat === 'vol').pop() || {}).t).filter((t) => t != null) : [];
      ok(salve && salve.length === 4 && vols.length === 4 && Math.max(...vols) - Math.min(...vols) < 0.5,
        `critère 30 : salve de ${salve && salve.length} blocs, lancés en ${vols.length ? (Math.max(...vols) - Math.min(...vols)).toFixed(2) : '?'} s`, { salve, vols });
      // critère 14 : un pilier détruit par 3 blocs : effondrement, la vue passe au-dessus du moignon, la place autour reste libre
      const P0 = BOSS_B7_ARENE.salle.piliers[0], O = T.O(), y = 2.6;
      const vue = () => sightClear(O.x + P0.x - 3, y, O.z + P0.z, O.x + P0.x + 3, y, O.z + P0.z);
      const vAvant = vue();
      C.forcer('pilier', { id: P0.id, coups: cfg.phase3.piliers.coupsDestruction }); T.pas(90);
      const st = B7S.monde.etatPiliers().find((p) => p.id === P0.id);
      const autour = [0, 1, 2, 3, 4, 5, 6, 7].every((k) => b7PositionValide({ x: O.x + P0.x + Math.sin(k * Math.PI / 4) * 1.6, y: 0, z: O.z + P0.z + Math.cos(k * Math.PI / 4) * 1.6 }, 'salle'));
      ok(!vAvant && st.etat === 'detruit' && vue() && autour,
        'critère 14 : pilier détruit au 3e bloc (effondrement), vue dégagée au-dessus des gravats, place libre autour', { etat: st.etat, collision: st.collision, autour });
      // critère 8 et 17 : rituel : jusqu'à 22 zombies ; capture en 30 s, cercle tenu (moins de 6 zombies dedans)
      C.allerA('rituel'); T.ici(0, -12, Math.PI);
      let maxZ = 0;
      for (let i = 0; i < 60 * 26; i++) { T.pas(1); maxZ = Math.max(maxZ, Zombies.list.filter((z) => z.alive && z.b7 && !z.dog).length); }
      const chRituel = chiens();
      for (const z of Zombies.list) if (z.alive && z.b7 && !z.dog) damageZombie(z, 1e6, { kind: 'bullet', dx: 0, dz: 1 });
      T.ici(0, 0, Math.PI);
      const R = cfg.phase4.rayon, t0 = G.time;
      let debut = null, fin = null;
      for (let i = 0; i < 60 * 40 && fin == null; i++) {
        for (const z of Zombies.list) if (z.alive && z.b7 && !z.dog && Math.hypot(z.pos.x - O.x, z.pos.z - O.z) < R + 1) damageZombie(z, 1e6, { kind: 'bullet', dx: 0, dz: 1 });
        T.pas(1);
        const c = T.e().capture;
        if (debut == null && c && c.progression > 0) debut = G.time;
        if (T.evs('capture', (d) => d.etat === 'termine').length) fin = G.time;
      }
      ok(maxZ === cfg.phase4.apparitions.max, `critère 17 : rituel : jusqu'à ${maxZ} zombies du combat en même temps (solo : ${cfg.phase4.apparitions.max})`, maxZ);
      ok(debut != null && fin != null && near(fin - debut, 30, 0.3), `critère 8 : capture du cercle en ${debut != null && fin != null ? (fin - debut).toFixed(2) : '?'} s`, { debut: debut && debut - t0, fin: fin && fin - t0 });
      // critère 31 : faiblesse : des zombies apparaissent pendant que le Septième est à terre
      for (let i = 0; i < 60 * 12 && B7.etat !== 'faiblesse'; i++) T.pas(1);
      const nf = new Set(Zombies.list.filter((z) => z.alive && z.b7).map((z) => z.id));
      T.pas(60 * 5);
      const nouveaux = Zombies.list.filter((z) => z.alive && z.b7 && !z.dog && !nf.has(z.id)).length, chFaiblesse = chiens();
      ok(B7.etat === 'faiblesse' && nouveaux > 0, `critère 31 : faiblesse : ${nouveaux} zombies apparus pendant que le Septième est à terre`, { etat: B7.etat, nouveaux });
      ok([chRepit, chAbsence, chPhase3, chRituel, chFaiblesse].every((n) => n === cfg.chiens.max), 'critère 20 : les chiens restent au répit, à l’absence, en phase 3, au rituel et à la faiblesse',
        { chRepit, chAbsence, chPhase3, chRituel, chFaiblesse });
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Phase 2 : âmes, ailes, piqué, mini-boss (6, 21 à 29, 35 à 41, 46)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C(), cfg = C.config, MB = cfg.miniBoss, near = (a, b, d) => Math.abs(a - b) <= d;
      const barres = () => [...HUD.el.hud.querySelectorAll('.b7h-mb')].map((b) => ({ nom: b.querySelector('.n').textContent, statut: b.querySelector('.s').textContent, couleur: b.style.getPropertyValue('--c').trim().toLowerCase() }));
      const cap = [];                                       // dégâts des capacités des mini-boss (source, fraction)
      if (!B7E.Z.__b7t) { B7E.Z.__b7t = true; B7E.Z.brancherDegats((m, id, f, src) => { cap.push({ src, f: +f.toFixed(4), t: G.time }); window.__b7cap = cap; }); }
      const capa = () => window.__b7cap || cap;
      const O = T.O(), coteLibre = (a, b, k) => {          // point à k m de la droite a → b, d'un côté ou de l'autre, valide dans la salle
        const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
        for (const s of [1, -1]) { const p = { x: b.x - dz / l * k * s, y: 0, z: b.z + dx / l * k * s }; if (b7PositionValide(p, 'salle')) return p; }
        return null;
      };
      T.partie(); G.god = true;
      C.demarrer(); T.pas(60 * 9);
      C.allerA('phase2'); T.ici(0, -4, Math.PI); T.pas(30);
      // critères 21 et 27 : 3 cuves intactes au début de la phase 2
      ok(T.e().tubes.length === 3 && T.e().tubes.every((t) => t.etat === 'intact'), 'critères 21 et 27 : 3 cuves intactes au début de la phase 2', T.e().tubes);
      // critère 6 : 9 âmes : pas d'ailes ; 10 âmes : ailes ; piqué annoncé (visée, verrouillage) et esquivé d'un pas de côté ; ailes perdues
      C.forcer('ames', 9); T.pas(20);
      const sansAiles = !T.evs('ailes').length;
      for (let i = 0; i < 60 * 5 && !T.evs('ailes').length; i++) { if (!T.e().boss.action) C.forcer('ames', 10); T.pas(1); }
      let esquive = null;
      for (let i = 0; i < 60 * 20 && !T.evs('ailes', (d) => d.etat === 'absentes').length; i++) {
        T.pas(1);
        const v = T.evs('pique', (d) => d.etape === 'verrouille')[0];
        if (v && !esquive) { esquive = coteLibre(T.e().boss.position, v.d.arrivee, 2.6) || { x: player.pos.x, z: player.pos.z }; B7.jeu.teleporter('j1', { x: esquive.x, y: 0, z: esquive.z }, Math.PI, 'salle'); }
      }
      const et1 = T.evs('pique').map((q) => q.d.etape), tImp = (T.evs('piqueImpact')[0] || {}).t, tAbs = (T.evs('ailes', (d) => d.etat === 'absentes')[0] || {}).t;
      ok(sansAiles && T.evs('ailes', (d) => d.etat === 'deployees').length > 0 && ['montee', 'visee', 'verrouille', 'charge'].every((s) => et1.includes(s)) && tImp != null && tAbs > tImp
        && !T.evs('joueurTouche', (d) => d.source === 'pique').length,
        'critère 6 : 9 âmes : pas d’ailes ; 10 : ailes, piqué annoncé (visée, verrouillage), esquivé d’un pas de côté, ailes perdues après l’impact', { etapes: [...new Set(et1)], esquive: !!esquive });
      // 2e piqué, joueur immobile : touché ; ailes de nouveau perdues
      T.ici(0, 0, Math.PI); T.pas(90);
      const k2 = T.ev.length, apres = () => T.ev.slice(k2);
      for (let i = 0; i < 60 * 25 && !apres().some((q) => q.type === 'ailes' && q.d.etat === 'absentes'); i++) { if (!T.e().boss.action && T.e().boss.ailes === 'absentes') C.forcer('ames', 10); T.pas(1); }
      ok(apres().some((q) => q.type === 'joueurTouche' && q.d.source === 'pique') && apres().some((q) => q.type === 'ailes' && q.d.etat === 'absentes'),
        'critère 6 : 2e piqué sur un joueur immobile : touché ; ailes de nouveau perdues', [...new Set(apres().filter((q) => q.type === 'pique').map((q) => q.d.etape))]);
      // critère 22 : à 75 % même un très gros coup s'arrête au seuil ; le Septième protégé siphonne la cuve du Survolté
      const bmax = T.e().barre.max;
      C.forcer('pvSegment', 0.8 * bmax); T.pas(2);
      const hb = B7V.modele.hitboxes()[1], r0 = C.toucherBoss({ joueur: B7.id, degats: 1e9, zone: 'corps', position: hb.centre, type: 'balle' });
      T.pas(2);
      ok(near(T.e().barre.valeur, MB.seuils[0] * bmax, 2) && T.e().boss.protege, `critère 22 : un coup de 1e9 s'arrête à 75 % (${(T.e().barre.valeur / bmax * 100).toFixed(1)} %), Septième protégé`, { r0, v: T.e().barre.valeur });
      T.pas(60 * 6);
      let { m, q } = T.mbq();
      const tube1 = T.evs('tube', (d) => d.miniBoss === 'survolte').map((x) => x.d.etat);
      ok(m && m.type === 'survolte' && ['siphon', 'fissure', 'eclate'].every((s) => tube1.includes(s)) && T.e().tubes.find((t) => t.miniBoss === 'survolte').etat === 'eclate',
        'critère 22 : la cuve du Survolté est siphonnée, se fissure, éclate ; il en sort', { type: m && m.type, tube: tube1 });
      if (!q) { ok(false, 'phase 2 : Le Survolté absent, suite du bloc abandonnée'); return out; }
      // critère 23 : protégé tant qu'il vit : tirs refusés ; le Septième continue d'attaquer ; critère 46 : la Bombe ne le tue pas
      const r1 = C.toucherBoss({ joueur: B7.id, degats: 500, zone: 'corps', position: B7V.modele.hitboxes()[1].centre, type: 'balle' });
      const prot = T.e().boss.protege, a0 = T.ev.length;
      const pvB = q.pv; applyPowerup('nuke');
      T.pas(60 * 6);
      const attaques = T.ev.slice(a0).filter((x) => x.type === 'action' && x.d.id !== 'siphon').map((x) => x.d.id);
      ok(r1 && !r1.applique && r1.raison === 'invulnerable' && prot && attaques.length > 0, 'critère 23 : tant que le mini-boss vit, le Septième est protégé (tir refusé) et continue d’attaquer', { r1, attaques: [...new Set(attaques)] });
      ok(q.pv === pvB && T.mb() && T.mb().id === m.id, 'critère 46 : Bombe ramassée : Le Survolté reste debout, aucun dégât', { avant: pvB, apres: q.pv });
      // critères 25, 29 : Survolté : 5,4 m/s ; décharges à 8 m au plus : 15 %, vision brouillée, étourdi 1 s
      ok(near(q.vitesseMax, 5.4, 1e-6) && MB.survolte.decharge.portee === 8, `critère 29 : Le Survolté à ${q.vitesseMax} m/s, décharges à 8 m`);
      T.ici(0, -4, Math.PI); capa().length = 0;
      let flou = 0, etourdi = 0, fige = false;
      for (let i = 0; i < 60 * 10; i++) { T.pas(1); flou = Math.max(flou, B7J.flouT); etourdi = Math.max(etourdi, B7J.etourdiT); if (B7J.etourdiT > 0.5) fige = fige || (b7Fige() && !b7Touche('KeyW') && !b7Touche('Space')); }
      const dech = capa().filter((c) => c.src === 'decharge');
      ok(dech.length > 0 && dech.every((c) => near(c.f, 0.15, 1e-4)) && near(flou, 1, 0.02) && near(etourdi, 1, 0.02) && fige,
        `critères 25 et 29 : ${dech.length} décharges à 15 %, vision brouillée ${flou.toFixed(2)} s, étourdi ${etourdi.toFixed(2)} s (ni déplacement ni saut)`, dech);
      // critère 26 : sa barre, à son nom et à sa couleur, sous celle du Septième
      const b1 = barres();
      ok(b1.length === 1 && /survolt/i.test(b1[0].nom) && b1[0].couleur === MB.survolte.couleur.toLowerCase() && b1[0].statut === 'Mini-boss', 'critère 26 : barre du Survolté, à son nom et à sa couleur', b1);
      // critère 35 : rage à la moitié de ses PV : immobile, invulnérable (« Invulnérable »), murs électrifiés 2,5 s plus tard
      T.rage(); T.pas(30);
      const pos = { x: q.position.x, z: q.position.z }, inv = T.mb() && T.mb().invulnerable, bInv = barres()[0], pvR = q.pv;
      // demande d'Anthony du 2 novembre 2026 : la barre du mini-boss se vide vers la droite, comme celle du Septième (transitions
      // coupées le temps de la mesure)
      const sansTrMB = document.createElement('style'); sansTrMB.textContent = '.b7h *{transition:none!important}'; document.head.appendChild(sansTrMB);
      const spMB = document.querySelector('.b7h-mb:not(.mort) .b span'), rsMB = spMB && spMB.getBoundingClientRect(), riMB = spMB && spMB.querySelector('i').getBoundingClientRect();
      sansTrMB.remove();
      ok(spMB && getComputedStyle(spMB).transform === 'matrix(-1, 0, 0, 1, 0, 0)' && Math.abs(riMB.right - rsMB.right) < 1.5 && riMB.left > rsMB.left + 1,
        `barre du mini-boss vidée vers la droite : à ${Math.round(pvR / q.pvMax * 100)} % de ses PV, son remplissage reste collé au bord droit`, { cadre: rsMB && [rsMB.left, rsMB.right], rempli: riMB && [riMB.left, riMB.right] });
      T.blesserMB(0.05);
      const pvR2 = q.pv;
      T.pas(60);
      const bouge = Math.hypot(q.position.x - pos.x, q.position.z - pos.z), tRage = (T.evs('miniBoss', (d) => d.etat === 'rage').pop() || {}).t;
      T.pas(60 * 2);
      const tMurs = (T.evs('murs', (d) => d.etat === 'electrifies').pop() || {}).t;
      ok(inv && bInv && bInv.statut === 'Invulnérable' && pvR2 === pvR && bouge < 0.05 && tRage && tMurs && near(tMurs - tRage, 2.5, 0.1),
        `critère 35 : surcharge : immobile, « Invulnérable » (un tir ne lui ôte rien), murs électrifiés ${tRage && tMurs ? (tMurs - tRage).toFixed(2) : '?'} s plus tard`, { inv, bInv, bouge, pv: [pvR, pvR2] });
      // critère 36 : près d'un mur : 12 %/s (un tic de 3 % toutes les 0,25 s) ; au centre : rien ; à sa mort, les murs s'éteignent en 1 s
      const logique = [], inf = B7.jeu.infligerDegats;
      B7.jeu.infligerDegats = (id, f, o) => { logique.push({ f: +f.toFixed(4), src: o && o.source }); return inf(id, f, o); };
      T.ici(-13.4, 0, Math.PI / 2); T.pas(60 * 1.5);
      const prochesMur = logique.filter((x) => x.src === 'murs');
      logique.length = 0; T.ici(0, 0, Math.PI); T.pas(60);
      const auCentre = logique.filter((x) => x.src === 'murs').length;
      B7.jeu.infligerDegats = inf;
      ok(prochesMur.length >= 5 && prochesMur.length <= 7 && prochesMur.every((x) => near(x.f, 0.03, 1e-4)) && auCentre === 0,
        `critère 36 : ${prochesMur.length} tics à 3 % en 1,5 s près du mur (12 %/s), rien au centre`, { proches: prochesMur.length, auCentre });
      // mort du Survolté : murs éteints en 1 s ; « Abattu », puis la barre disparaît 3 s après sa mort ; Munitions max au sol (critère 41)
      T.tuerMB();
      let vuAbattu = false, tSans = null;
      for (let i = 0; i < 60 * 5 && tSans == null; i++) { T.pas(1); const b = barres(); if (b[0] && b[0].statut === 'Abattu') vuAbattu = true; if (!b.length) tSans = G.time; }
      const tMort = (T.evs('miniBoss', (d) => d.etat === 'mort').pop() || {}).t, ext = T.evs('murs', (d) => d.etat === 'extinction').pop(), et2 = T.evs('murs', (d) => d.etat === 'eteints').pop();
      ok(ext && et2 && near(et2.t - ext.t, 1, 0.05), `critère 36 : murs éteints ${ext && et2 ? (et2.t - ext.t).toFixed(2) : '?'} s après sa mort`);
      const bo1 = T.evs('bonus', (d) => d.source === 'miniBoss' && d.miniBoss === 'survolte');
      ok(vuAbattu && tMort && tSans && near(tSans - tMort, 3, 0.1) && bo1.length === 1 && bo1[0].d.mode === 'depose',
        `critères 26 et 41 : « Abattu », barre retirée ${tMort && tSans ? (tSans - tMort).toFixed(2) : '?'} s après sa mort ; Munitions max posé au sol`, { vuAbattu, bonus: bo1.map((x) => x.d) });
      // critère 23 : de nouveau vulnérable, ses PV repartent du seuil (exactement le seuil moins le coup)
      const r2 = C.toucherBoss({ joueur: B7.id, degats: 100, zone: 'corps', position: B7V.modele.hitboxes()[1].centre, type: 'balle' });
      ok(r2 && r2.applique && near(T.e().barre.valeur, MB.seuils[0] * bmax - r2.montant, 1), 'critère 23 : le mini-boss mort, le Septième reprend des dégâts depuis le seuil', r2);
      // critères 24 et 28 : L'Irradié (2e seuil) : 4,4 m/s, aura de 6 m, boules et zones ; puis l'infection (critère 37)
      C.forcer('pvSegment', 0.49 * bmax); T.ici(0, 0, Math.PI); T.pas(60 * 7);
      ({ m, q } = T.mbq());
      if (!q || m.type !== 'irradie') { ok(false, 'phase 2 : L’Irradié absent, suite du bloc abandonnée', m && m.type); return out; }
      capa().length = 0; T.pas(60 * 8);
      const boules = capa().filter((c) => c.src === 'boule').length, aura = capa().filter((c) => c.src === 'aura').length, zones = B7E.Z.zones().length;
      ok(near(q.vitesseMax, 4.4, 1e-6) && MB.irradie.aura.rayon === 6 && aura > 0 && boules > 0 && zones > 0,
        `critères 24 et 28 : L'Irradié (${q.vitesseMax} m/s), aura de 6 m, ${boules} boules, ${zones} zones`, { aura, boules, zones });
      // zombies du jeu déjà dans la salle (le Septième en absorbe parfois un avant l'infection : trois, à des places différentes)
      const idsA = [[-3, 3], [3, -3], [-4, -2]].map(([dx, dz]) => b7Apparition({ position: { x: O.x + dx, y: 0, z: O.z + dz }, lieu: 'salle', effet: 'emergence', source: 'boss', vitesse: 'sprint', agressif: true, pv: 500 }));
      T.pas(30);
      T.rage();                                           // cri (1,2 s), puis l'infection : lue à l'image où elle commence
      for (let i = 0; i < 60 * 3 && !T.evs('infection', (d) => d.etat === 'debut').length; i++) T.pas(1);
      const evI = T.evs('infection', (d) => d.etat === 'debut')[0], irr0 = B7E.irr.size, irrZ = [...B7E.irr].filter((z) => !z.dog).length;
      const zA = idsA.map((id) => (id != null ? b7Zombie(id) : null)).find((z) => z && B7E.irr.has(z)) || null;
      const presentIrr = !!evI && irr0 === evI.d.nombre && irrZ > 0;
      T.pas(60);
      const idn = b7Apparition({ position: { x: O.x + 3, y: 0, z: O.z + 3 }, lieu: 'salle', effet: 'emergence', source: 'boss', vitesse: 'sprint', agressif: true, pv: 500 });
      const zn = idn != null ? b7Zombie(idn) : null;      // comme un zombie que la logique fait apparaître
      T.pas(30);
      ok(presentIrr && zn && B7E.irr.has(zn) && B7E.irrPts.visible, `critère 37 : infection : les ${irr0} zombies et chiens de la salle irradiés (dont ${irrZ} zombies) ; un zombie apparu ensuite l’est aussi`,
        { infectes: evI && evI.d.nombre, irr0, irrZ, absorbes: T.evs('absorption').length });
      T.tuerMB(); T.pas(60);                              // la flaque s'étale 0,9 s après sa mort (animation du module)
      const flaques = B7E.Z.flaques();
      T.pas(60 * 2);
      ok(flaques.length > 0 && near(flaques[0].restant, 5 - 0.1, 0.1) && B7E.Z.zones().length === 0,
        `critères 25 et 28 : à sa mort : flaque toxique (${flaques.length ? flaques[0].restant.toFixed(2) : '?'} s restantes sur 5), zones éteintes`, { flaques });
      ok(B7E.irr.size === 0 && (!zA || !zA.alive || !B7E.irr.has(zA)), 'critère 37 : à sa mort, les zombies et chiens irradiés redeviennent normaux', { irr: B7E.irr.size });
      // critères 27, 38 à 40 : Le Démembré (3e seuil) : cuve géante, barre dorée, deux fois plus grand ; fléau à 6 m ; bras arraché et petits ; charge
      C.forcer('pvSegment', 0.24 * bmax); T.ici(0, -4, 0); T.pas(60 * 7);
      ({ m, q } = T.mbq());
      if (!q || m.type !== 'demembre') { ok(false, 'phase 2 : Le Démembré absent, suite du bloc abandonnée', m && m.type); return out; }
      const b3 = barres();
      ok(b3.length === 1 && b3[0].couleur === MB.demembre.couleur.toLowerCase() && MB.demembre.fleau.portee === 6 && near(MB.demembre.echelle, 2, 0) && q.scale > 1.9,
        `critères 27 et 38 : Le Démembré géant (échelle ${q.scale.toFixed(2)}), barre dorée, fléau à 6 m`, b3);
      capa().length = 0;
      for (let i = 0; i < 60 * 8 && !capa().some((c) => c.src === 'fleau'); i++) { T.ici(q.position.x - O.x, q.position.z - O.z - 5, 0); T.pas(1); }
      ok(capa().some((c) => c.src === 'fleau' && near(c.f, 0.30, 1e-4)), 'critère 27 : le fléau frappe (30 %) à 5 m', capa().slice(0, 3));
      T.ici(0, -8, 0); T.rage();
      let maxPetits = 0, modPetits = 0;
      for (let i = 0; i < 60 * 25; i++) { T.pas(1); maxPetits = Math.max(maxPetits, (T.e().petits || []).length); modPetits = Math.max(modPetits, [...B7E.ents.keys()].filter((id) => { const x = B7E.Z.obtenir(id); return x && x.type === 'demembre_petit' && x.pv > 0; }).length); }
      const bras = T.evs('bras').map((x) => x.d.etat);
      ok(['arrache', 'lance', 'pose'].every((s) => bras.includes(s)) && maxPetits === 6 && modPetits === 6, `critère 39 : bras arraché, lancé, posé ; jusqu'à ${maxPetits} petits Démembrés (au plus 6 ; ${modPetits} dans la salle)`, { bras, maxPetits, modPetits });
      // critère 40 : sans bras, il charge : 35 % et projeté ; contre un mur : 10 % en plus ; lui contre un mur : étourdi
      T.ici(-11.5, 0, -Math.PI / 2); q.position.set(O.x - 2.5, 0, O.z); capa().length = 0;
      let modes = new Set(), proj = 0, av = 0;
      for (let i = 0; i < 60 * 14 && !(capa().some((c) => c.src === 'impactMur') && modes.has('etourdi')); i++) {
        T.pas(1); modes.add(q.mode); if (B7J.projT > av + 1e-6) proj++; av = B7J.projT;
        if (!proj && i % 60 === 59) T.ici(-11.5, 0, -Math.PI / 2);
      }
      ok(capa().some((c) => c.src === 'charge' && near(c.f, 0.35, 1e-4)) && proj > 0 && capa().some((c) => c.src === 'impactMur' && near(c.f, 0.10, 1e-4)) && modes.has('etourdi'),
        'critère 40 : charge : 35 % et projeté ; contre le mur : 10 % en plus ; Le Démembré étourdi contre un mur', { modes: [...modes], proj, src: [...new Set(capa().map((c) => c.src))] });
      T.ici(0, 0, 0); T.tuerMB(); T.pas(60 * 2.5);
      const bm = T.evs('bonus', (d) => d.source === 'miniBoss');
      ok((T.e().petits || []).length === 0 && ![...B7E.ents.keys()].some((id) => { const x = B7E.Z.obtenir(id); return x && x.type === 'demembre_petit' && x.pv > 0; }) && T.evs('bras', (d) => d.etat === 'fletri').length > 0
        && ['survolte', 'irradie', 'demembre'].every((t) => bm.filter((x) => x.d.miniBoss === t && x.d.mode === 'depose').length === 1),
        'critères 39 et 41 : à sa mort, les petits s’effondrent, le bras se flétrit ; un Munitions max au sol par mini-boss', bm.map((x) => x.d.miniBoss));
      // critère 24 : puis la phase 2 se termine normalement
      for (let k = 0; k < 400 && B7.etat === 'phase2'; k++) { C.toucherBoss({ joueur: B7.id, degats: 2000, zone: 'corps', position: B7V.modele.hitboxes()[1].centre, type: 'balle' }); T.pas(3); }
      ok(B7.etat !== 'phase2' && T.evs('etat', (d) => d.vers === 'transition23').length > 0, 'critère 24 : les 3 mini-boss abattus, la phase 2 se termine normalement', B7.etat);
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Phase 5 dans Bunker 7 (3, 9, 13, 18, 32, 34, 42, 43)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C(), cfg = C.config, P5 = cfg.phase5, SP = P5.paliers.seuils, near = (a, b, d) => Math.abs(a - b) <= d;
      const hb = () => B7V.modele.hitboxes()[1].centre;
      T.partie(); G.god = true;
      C.demarrer(); T.pas(60 * 9);
      C.allerA('phase5'); T.pas(30); T.image();
      const A = BOSS_B7_ARENE.bunker7.arriveeJoueurs[0];
      ok(B7.lieu === 'bunker' && Math.hypot(player.pos.x - A.x, player.pos.z - A.z) < 0.5 && Object.values(World.doors).every((d) => d.opened) && !B7S.racine.parent && World.root.visible,
        'phase 5 : réveil dans la Salle d’arrivée de Bunker 7, toutes les portes ouvertes, la salle secrète hors de la scène');
      // critère 9 : la traque suit la navigation de Bunker 7 (jamais dans un mur), le joueur dans une autre pièce (le point des
      // zombies de Bunker 7 le plus loin du Septième) ; critère 13
      const loin = BOSS_B7_ARENE.bunker7.apparitionsZombies.slice().sort((a, b) => T.dist(b, T.e().boss.position) - T.dist(a, T.e().boss.position))[0];
      T.bunker(loin.x, loin.z, Math.PI);
      // zombies du combat sortis de terre dans Bunker 7 pendant la traque : chacun annoncé par l'évènement « invocation », où les
      // effets et les sons du paquet jouent l'émergence (fissures, lueur, son), à 8 m au moins du joueur
      const inv0 = T.evs('invocation').length, avant5 = new Set(Zombies.list.map((z) => z.id));
      let n = 0, dansMur = 0, parcours = 0, prev = null;
      for (let i = 0; i < 60 * 20; i++) {
        T.pas(1);
        const b = T.e().boss;
        if (!(b.present && b.visible && !b.intangible)) { prev = null; continue; }
        n++; if (locateNode(b.position.x, b.position.z, 0, true) < 0) dansMur++;
        if (prev) parcours += Math.hypot(b.position.x - prev.x, b.position.z - prev.z);
        prev = { x: b.position.x, z: b.position.z };
      }
      ok(n > 0 && dansMur === 0 && parcours > 5, `critère 9 : traque : ${n} positions sur ${parcours.toFixed(0)} m, aucune dans un mur`, { n, dansMur, parcours });
      const sortis = Zombies.list.filter((z) => z.b7 && !z.dog && z.b7.lieu === 'bunker' && !avant5.has(z.id));
      const invB = T.evs('invocation').slice(inv0).filter((q) => b7LieuDe(q.d.position) === 'bunker');
      const dists = invB.map((q) => Math.hypot(q.d.position.x - player.pos.x, q.d.position.z - player.pos.z));
      ok(sortis.length > 0 && invB.length >= sortis.length && dists.every((d) => d >= 7.9),
        `phase 5 : ${sortis.length} zombies du combat sortis de terre dans Bunker 7, chacun avec l’émergence du paquet (évènement « invocation »), à ${dists.length ? Math.min(...dists).toFixed(1) : '?'} m au moins du joueur`,
        { sortis: sortis.length, invocations: invB.length, distances: dists.map((d) => +d.toFixed(1)) });
      // même joueur à terre (la logique ne compte que les joueurs debout) : points de sortie à 8 m au moins de lui
      const P0z = BOSS_B7_ARENE.bunker7.apparitionsZombies[0], svp = player.pos.clone();
      player.pos.set(P0z.x + 1, player.pos.y, P0z.z);
      const pz = b7PointsBunker('zombies');
      player.pos.copy(svp);
      ok(pz && pz.length === 7 && pz.every((p) => Math.hypot(p.x - P0z.x - 1, p.z - P0z.z) >= 8), 'phase 5 : points de sortie des zombies à 8 m au moins du joueur, debout ou à terre', pz && pz.length);
      // les 24 points de Bunker 7 (arene.bunker7) : valides et atteignables depuis le réveil (portes ouvertes)
      const A5 = BOSS_B7_ARENE.bunker7, ev5 = A5.arriveeJoueurs[0];
      const tous5 = [...A5.arriveeJoueurs, ...A5.apparitionsBoss, ...A5.retourJoueurs, ...A5.apparitionsZombies];
      const mauvais5 = tous5.filter((q) => !b7PositionValide({ x: q.x, y: 0, z: q.z }, 'bunker')
        || (Math.hypot(q.x - ev5.x, q.z - ev5.z) > 1 && b7Chemin({ x: ev5.x, y: 0, z: ev5.z }, { x: q.x, y: 0, z: q.z }) === null));
      ok(tous5.length === 24 && mauvais5.length === 0, `les ${tous5.length} points de Bunker 7 sont valides et atteignables depuis le réveil`, mauvais5);
      const z5 = Zombies.list.filter((z) => z.alive && z.b7 && !z.dog && z.state !== 'rise');
      ok(z5.length > 0 && z5.every((z) => ['chase', 'attack'].includes(z.state) && near(z.speed, SPEEDS.run[1] * z.type.mult.speed, 1e-6)), `critère 13 : ${z5.length} zombies de la phase 5, au plus vite sur le joueur`, z5.map((z) => z.state));
      // critère 32 : palier 0, lames bleues : un coup = 50 % des PV max (perte mesurée)
      const perte = [], inf = B7.jeu.infligerDegats;
      B7.jeu.infligerDegats = (id, f, o) => { const h0 = player.hp; const v = inf(id, f, o); if (o && o.source === 'frappe') perte.push(+((h0 - player.hp) / player.maxHp).toFixed(4)); return v; };
      G.god = false;
      for (let i = 0; i < 60 * 30 && !perte.length; i++) T.pas(1);
      B7.jeu.infligerDegats = inf;
      ok(T.e().boss.couleurLames === 'bleu' && perte.length > 0 && near(perte[0], P5.paliers.bleu.degats, 1e-3) && near(P5.paliers.bleu.degats, 0.5, 0), `critère 32 : lames bleues, un coup = ${perte.length ? perte[0] * 100 : '?'} % des PV max`, perte);
      // palier 1, lames rouges : le coup laisse à 1 % exactement
      C.forcer('jauge', SP[0] + 0.02); T.pas(10);
      const crit = [], bc = B7.jeu.blessureCritique;
      B7.jeu.blessureCritique = (id, fr) => { const v = bc(id, fr); crit.push(+(player.hp / player.maxHp).toFixed(5)); return v; };
      for (let i = 0; i < 60 * 40 && !crit.length; i++) T.pas(1);
      B7.jeu.blessureCritique = bc;
      ok(T.e().boss.couleurLames === 'rouge' && crit.length > 0 && near(crit[0], 0.01, 1e-6), `critère 32 : lames rouges, le coup laisse ${crit.length ? (crit[0] * 100).toFixed(2) : '?'} %`, crit);
      G.god = true; T.pas(60 * 12);
      // critère 18 : criblé (≈ 18 balles en 3 s), il se téléporte ailleurs dans Bunker 7, cercles rituels
      const tp0 = T.evs('teleport', (d) => d.raison === 'degats').length;
      for (let i = 0; i < 60 * 30 && T.evs('teleport', (d) => d.raison === 'degats').length === tp0; i++) {
        const b = T.e().boss;
        if (b.present && b.visible && b.vulnerable) C.toucherBoss({ joueur: B7.id, degats: P5.teleportDegats.seuil / 10, zone: 'corps', position: hb(), type: 'balle' });
        T.pas(10);
      }
      const tp = T.evs('teleport', (d) => d.raison === 'degats' && d.sens === 'arrivee').pop(), dtp = tp && Math.hypot(tp.d.position.x - player.pos.x, tp.d.position.z - player.pos.z);
      ok(tp && tp.d.lieu === 'bunker' && dtp >= P5.teleportDegats.distanceMin - 0.5 && dtp <= P5.teleportDegats.distanceMax + 0.5, `critère 18 : téléportation sur dégâts à ${dtp ? dtp.toFixed(1) : '?'} m du tireur`, tp && tp.d);
      // critères 42 et 43 : palier 2 : aucune illusion ; loin de tout joueur, il s'efface, intangible (les balles le traversent), traverse les murs, resurgit
      C.forcer('jauge', SP[1] + 0.02); T.pas(10);
      T.bunker(44.5, 15.5, 0);
      let vuInv = false, rayon = null, abs = null, illusions = 0, ecoute = false, dgInv = 0;
      C.on('degats', () => { if (ecoute) dgInv++; });
      for (let i = 0; i < 60 * 40 && !T.evs('intangible', (d) => d.etat === 'fin').length; i++) {
        T.pas(1);
        const b = T.e().boss;
        illusions = Math.max(illusions, (T.e().illusions || []).length);
        if (b.intangible && !vuInv) {
          vuInv = !b.visible;
          const c = hb(), o = { x: c.x - 2, y: c.y, z: c.z };
          rayon = B7V.ent ? b7BossRayon(B7V.ent, o.x, o.y, o.z, 1, 0, 0, 0) : 'hors de la liste';
          ecoute = true; hitscan(curSlot(), o.x, o.y, o.z, 1, 0, 0, o); ecoute = false;       // une vraie balle, droit sur lui
          abs = C.toucherBoss({ joueur: B7.id, degats: 100, zone: 'corps', position: c, type: 'balle' });
        }
      }
      const traverse = T.evs('intangible', (d) => d.etat === 'traversee').length;
      ok(T.e().boss.palier === 2 && illusions === 0, 'critère 42 : palier 2 de la jauge : aucune illusion (la logique 1.5 n’en a plus)', { palier: T.e().boss.palier });
      ok(vuInv && (rayon === -1 || rayon === 'hors de la liste') && dgInv === 0 && abs && abs.raison === 'absent' && traverse > 0 && T.evs('intangible', (d) => d.etat === 'fin').length > 0,
        `critère 43 : intangible et invisible (une balle tirée sur lui passe au travers), ${traverse} murs traversés, puis il resurgit`, { vuInv, rayon, dgInv, abs, traverse });
      // critère 34 : palier 3 : crochet ; accroché, ramené devant lui sans commandes, puis il frappe. Le crochet part vers un
      // joueur à 4–22 m en vue, le Septième présent et vulnérable : l'essai s'y tient (à 8 m environ, en vue) jusqu'au lancer
      const enVue = (b) => { const d = Math.hypot(player.pos.x - b.position.x, player.pos.z - b.position.z); return d >= 6 && d <= 12 && sightClear(b.position.x, 1.6, b.position.z, player.pos.x, 1.6, player.pos.z); };
      const placerEnVue = (b) => {
        for (const d of [8, 10, 6, 12]) for (let k = 0; k < 16; k++) {
          const x = b.position.x + Math.sin(k * Math.PI / 8) * d, z = b.position.z + Math.cos(k * Math.PI / 8) * d;
          if (b7PositionValide({ x, y: 0, z }, 'bunker') && sightClear(b.position.x, 1.6, b.position.z, x, 1.6, z)) { T.bunker(x, z, null); return true; }
        }
        return false;
      };
      C.forcer('jauge', SP[2] + 0.02); T.pas(10);
      let bloque = false;
      for (let i = 0; i < 60 * 60 && !T.evs('crochet', (d) => d.etat === 'arrivee').length; i++) {
        const b = T.e().boss;
        if (!T.evs('crochet', (d) => d.etat === 'lancer').length && i % 10 === 0 && b.present && b.visible && !enVue(b)) placerEnVue(b);
        T.pas(1);
        if (T.evs('crochet', (d) => d.etat === 'accroche').length && !T.evs('crochet', (d) => d.etat === 'arrivee').length) bloque = bloque || B7.bloque;
      }
      const tArr = (T.evs('crochet', (d) => d.etat === 'arrivee')[0] || {}).t;
      for (let i = 0; i < 60 * 4 && !T.evs('frappe', (d) => d.joueur === B7.id).some((x) => x.t >= tArr); i++) T.pas(1);
      const frappe = tArr != null && T.evs('frappe', (d) => d.joueur === B7.id).some((x) => x.t >= tArr);
      T.pas(60);
      const cr = T.evs('crochet').map((x) => x.d.etat);
      ok(T.e().boss.palier === 3 && cr.includes('lancer') && cr.includes('accroche') && cr.includes('arrivee') && bloque && frappe && !B7.bloque,
        'critère 34 : crochet lancé, joueur accroché et ramené sans commandes, puis il frappe ; commandes rendues', { cr, bloque, frappe });
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Fin du combat, bonus, récompenses (2, 3, 10, 16, 47, 48)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C(), cfg = C.config;
      // lâcher de bonus au hasard forcé dans Bunker 7 (seuil atteint), loin du joueur : nombre de bonus posés
      const lacher = () => {
        const sv = [Powerups.acc, Powerups.threshold, Powerups.drops], n0 = Powerups.list.length;
        const p = BOSS_B7_ARENE.bunker7.apparitionsZombies.slice().sort((a, b) => T.dist(b, player.pos) - T.dist(a, player.pos))[0];
        Powerups.acc = Powerups.threshold; Powerups.drops = 0;
        maybeDropPowerup(p.x, p.z, 0);
        const n = Powerups.list.length - n0;
        [Powerups.acc, Powerups.threshold, Powerups.drops] = sv;
        return n;
      };
      T.partie(); G.god = true;
      // Bunker 7 modifié dans les Mod Tools, sans place pour la salle (B7S.actif faux) : le code du boss ne sert pas
      const salleS = B7S.actif;
      B7S.actif = false;
      const sansSalle = b7CodeDigipass(T.code((c) => b7CodeEmpreinte(c) === B7_CODE_EMPREINTE)) === null && !b7AccesBoss();
      B7S.actif = salleS;
      ok(sansSalle, 'Bunker 7 sans salle (carte modifiée) : le code du boss ne sert pas, pas de combat');
      C.demarrer(); T.pas(60 * 9);
      C.allerA('phase1'); T.ici(0, -6, Math.PI); T.pas(30);
      // critère 47 : aucun bonus au hasard pendant le combat (même un lâcher forcé est refusé)
      const pu0 = Powerups.list.length;
      for (let i = 0; i < 40; i++) { T.pas(15); for (const z of Zombies.list) if (z.alive && z.b7 && !z.dog) damageZombie(z, 1e6, { kind: 'bullet', dx: 0, dz: 1 }); }
      const force = lacher();
      ok(Powerups.list.length === pu0 && force === 0, 'critère 47 : aucun bonus au hasard pendant le combat (lâcher forcé refusé)', { avant: pu0, apres: Powerups.list.length, force });
      // critère 16 : fin de phase : un vrai « Munitions max » du jeu au sol ; ramassé : réserves et grenades pleines (règle du jeu) ; annoncé
      const dits = [], say = Sound.say;
      Sound.say = (t) => { dits.push(t); return say.call(Sound, t); };
      // jeu 2.0.7 : la voix enregistrée de l'annonceur (section 27) remplace la synthèse vocale : l'annonce compte aussi
      const annB = window.annonceBonus;
      window.annonceBonus = (t) => { dits.push(POWERUPS[t] && POWERUPS[t].say); return annB(t); };
      C.forcer('pvSegment', 1); T.pas(2);
      for (let k = 0; k < 60 && B7.etat === 'phase1'; k++) { const b = T.e().boss; if (b.present && b.visible) C.toucherBoss({ joueur: B7.id, degats: 50, zone: 'corps', position: B7V.modele.hitboxes()[1].centre, type: 'balle' }); T.pas(5); }
      T.pas(60 * 2);
      const bo = T.evs('bonus', (d) => d.source === 'phase').pop(), pu = bo && Powerups.list.find((p) => p.type === 'ammo' && Math.hypot(p.x - bo.d.position.x, p.z - bo.d.position.z) < 0.5);
      for (const q of Arms.slots) if (q) { q.mag = 1; q.res = 0; }
      G.grenades = 0;
      if (pu) { B7.jeu.teleporter('j1', { x: pu.x, y: 0, z: pu.z }, null, 'salle'); T.pas(10); }
      Sound.say = say; window.annonceBonus = annB;
      ok(B7.etat === 'repit' && bo && bo.d.type === 'munitions-max' && bo.d.mode === 'depose' && bo.d.phase === 1 && pu && !Powerups.list.includes(pu)
        && Arms.slots.every((q) => !q || q.res === wstat(q, 'res')) && G.grenades === RULES.maxGrenades && dits.includes(POWERUPS.ammo.say),
        'critère 16 : fin de la phase 1 : « Munitions max » du jeu au sol, ramassé : réserves et grenades pleines, annoncé', { etat: B7.etat, bonus: bo && bo.d, dits, grenades: G.grenades });
      // critères 10 et 48 : rituel achevé (F maintenue), message, récompenses une fois, retour dans Bunker 7, manches reprises
      C.allerA('conclusion'); T.pas(30);
      const atouts0 = player.perks.size, minuteurs = { insta: 0, double: 0 };
      const notes = () => { minuteurs.insta = Math.max(minuteurs.insta, G.timers.insta || 0); minuteurs.double = Math.max(minuteurs.double, G.timers.double || 0); };
      for (let t = 0; t < 60 * 40 && B7.etat !== 'termine'; t++) {
        const e = B7.e; if (e && e.interaction) { const p = e.boss.position; B7.jeu.teleporter('j1', { x: p.x + 1.2, y: 0, z: p.z }, null, B7.lieu); }
        Input.keys.KeyF = true; T.pas(1); notes();
      }
      Input.keys.KeyF = false;
      for (let i = 0; i < 60 * 2; i++) { T.pas(1); notes(); }
      const R = BOSS_B7_ARENE.bunker7.retourJoueurs.map((p) => Math.hypot(player.pos.x - p.x, player.pos.z - p.z));
      T.image();
      ok(B7.etat === 'termine' && B7.lieu === 'bunker' && Math.min(...R) < 1 && !B7.manches && B7.drapeaux[cfg.general.drapeauTermine] === true
        && T.evs('interaction', (d) => d.etat === 'terminee' && d.joueur === B7.id).length === 1 && T.evs('message').length === 1 && !B7S.racine.parent && World.root.visible,
        'critères 10 et 3 : rituel achevé par le joueur (F), message final, retour dans Bunker 7 (point de retour, salle hors de la scène), manches reprises, drapeau posé', { etat: B7.etat, lieu: B7.lieu });
      const rc = T.evs('recompense').map((q) => q.d), bonusDonnes = rc.filter((d) => d.type === 'bonus' && d.donne).map((d) => d.id);
      const armes = B7.recompenses.map((q) => q.id + ':' + q.tier).sort(), atouts = b7ListeAtouts();
      ok(armes.join() === ['blaster:3', 'raygun:3'].join() && atouts.every((p) => player.perks.has(p)) && player.perks.size > atouts0
        && bonusDonnes.join() === cfg.conclusion.recompenses.bonus.join() && minuteurs.insta > 0 && minuteurs.double > 0,
        `critère 48 : armes merveilles au palier III (${armes.join(', ')}) au sol, tous les atouts (${atouts.join(', ')}), les ${bonusDonnes.length} bonus du jeu`, { armes, bonus: bonusDonnes, minuteurs });
      // demande d'Anthony du 2 novembre 2026 (défaut 4) : bonus de la victoire pour 5 min, en rouge ; un bonus ramassé ne les
      // raccourcit pas ; leur durée finie, un bonus ramassé entre-temps continue, en vert
      const pa = HUD.el['pu-active'], coul = (id) => { const q = pa.querySelector('.pu.' + id); return q ? getComputedStyle(q).color : null; };
      const ROUGE = 'rgb(226, 49, 58)', VERT = 'rgb(141, 255, 116)', vic = { reste: { insta: G.timers.insta, double: G.timers.double }, couleurs: [coul('insta'), coul('double')] };
      const av = G.timers.insta, avD = G.timers.double; applyPowerup('insta'); applyPowerup('double'); T.pas(1);
      ok(minuteurs.insta > 299 && minuteurs.double > 299 && vic.reste.insta > 270 && vic.reste.double > 270 && vic.couleurs.every((c) => c === ROUGE)
        && G.timers.insta > av - 0.1 && G.timers.insta < av && G.timers.double > avD - 0.1 && G.timers.double < avD,
        'bonus de la victoire : Mort instantanée et Double points pour 5 min, en rouge ; un bonus ramassé ne les raccourcit pas', { minuteurs, vic, ramasse: [av, G.timers.insta, avD, G.timers.double] });
      B7.victoireJusqua.insta = G.time + 1; G.timers.insta = 1; applyPowerup('insta'); T.pas(90);
      ok(G.timers.insta > 28 && G.timers.insta < 29 && coul('insta') === VERT && coul('double') === ROUGE,
        'bonus de la victoire : sa durée finie, la Mort instantanée ramassée entre-temps continue (30 s), en vert', { insta: G.timers.insta, couleurs: [coul('insta'), coul('double')] });
      // armes ramassées : l'emplacement 1, puis le 2, au palier III
      for (const r of B7.recompenses.slice()) { B7.jeu.teleporter(B7.id, { x: r.x, y: 0, z: r.z }, null, 'bunker'); T.pas(40); }
      ok(!B7.recompenses.length && ['raygun', 'blaster'].every((id) => Arms.slots.some((s) => s && s.id === id && s.tier === 3)), 'critère 48 : les deux armes merveilles ramassées, au palier III', Arms.slots.map((s) => s && `${s.id}:${s.tier}`));
      // critère 2 et 48 : une seule fois : après la victoire, le drapeau refuse le code du boss et le combat
      const nrc = T.evs('recompense').length, code = T.code((c) => b7CodeEmpreinte(c) === B7_CODE_EMPREINTE);
      C.allerA('inactif'); T.pas(2);
      const dem = C.demarrer();
      T.pas(60 * 3);
      ok(B7.drapeaux[cfg.general.drapeauTermine] === true && b7CodeDigipass(code) === null && dem === false && B7.etat === 'inactif' && T.evs('recompense').length === nrc,
        'critères 2 et 48 : une seule fois : après la victoire, ni le code du boss ni un nouveau combat, aucune récompense de plus', { dem, etat: B7.etat });
      // critère 47 : hors combat, le même lâcher forcé pose bien un bonus (le refus venait du combat)
      ok(lacher() === 1, 'critère 47 : hors combat, le même lâcher forcé pose un bonus');
      // critère 10 : les manches reprennent
      T.pas(60 * 15);
      ok(!B7.manches && Zombies.list.some((z) => z.alive && !z.b7 && !z.boss), 'critère 10 : les manches reprennent (zombies de la manche)', { manche: G.round });
      T.partie(); T.pas(2); applyPowerup('double'); T.pas(1);
      ok(G.timers.insta === 0 && G.timers.double > 29.9 && G.timers.double <= 30 && !pa.classList.contains('b7-insta') && !pa.classList.contains('b7-double') && coul('double') === VERT,
        'bonus de la victoire : nouvelle partie : finis ; un bonus ramassé dure 30 s, en vert', { minuteurs: { ...G.timers }, classes: pa.className });
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Retour dans Bunker 7 après la victoire : ambiance normale
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C(), a = CUR.map.ambiance, c0 = new THREE.Color(parseColor(a.fog, 0x05070b)).convertSRGBToLinear();
      // retour d'Anthony du 2 novembre 2026 (défaut 5) : après la victoire, Bunker 7 restait dans l'obscurité de la phase 5.
      // L'échange d'ambiance de la salle se fait au rendu (b7SalleAvantRendu) ; __zs.step ne dessine pas : on l'appelle à chaque pas
      const pas = (n) => { for (let i = 0; i < n; i++) { T.pas(1); b7SalleAvantRendu(); } };
      const brume = () => ({ densite: +scene.fog.density.toFixed(4), couleur: '#' + scene.fog.color.clone().convertLinearToSRGB().getHexString() });
      const normale = () => Math.abs(scene.fog.density - a.fogDensity) < 1e-6
        && Math.abs(scene.fog.color.r - c0.r) + Math.abs(scene.fog.color.g - c0.g) + Math.abs(scene.fog.color.b - c0.b) < 1e-6
        && Math.abs(renderer.toneMappingExposure - a.exposure) < 1e-6 && !!HEMI && HEMI.visible && Math.abs(HEMI.intensity - a.hemi) < 1e-6
        && B7V.kBunker === 1 && B7V.fx.facteurLumiere('bunker') === 1 && !B7V.fx.stats().ecran && !B7S.dans && World.root.visible;
      T.partie(); G.god = true;
      const avant = brume();
      C.demarrer(); pas(60 * 9);
      C.allerA('phase5'); pas(60 * 3);
      const p5 = brume();
      ok(B7.lieu === 'bunker' && p5.densite > 0.1 && B7V.kBunker < 1, 'phase 5 : Bunker 7 dans l’obscurité du combat (brume épaissie, lampes baissées)', { avant, p5, k: B7V.kBunker });
      C.allerA('defaite');
      for (let t = 0; t < 60 * 60 && B7.etat !== 'termine'; t++) {
        const e = B7.e; if (e && e.interaction) { const p = e.boss.position; B7.jeu.teleporter('j1', { x: p.x + 1.2, y: 0, z: p.z }, null, B7.lieu); }
        Input.keys.KeyF = true; pas(1);
      }
      Input.keys.KeyF = false; pas(60 * 2);
      ok(B7.etat === 'termine' && B7.lieu === 'bunker' && normale(), 'de retour dans Bunker 7 après la victoire (défaite en phase 5) : ambiance normale (brume, exposition, hémisphère, lampes, voile)',
        { etat: B7.etat, brume: brume(), carte: a.fogDensity, k: B7V.kBunker, expo: renderer.toneMappingExposure });
      // défaut relevé le 2 novembre 2026 : combat fini, le cadavre du Septième prenait une place de zombie (23 au lieu de 24)
      ok(!Zombies.list.some((z) => z.b7boss && z.alive) && !B7V.ent && !B7V.fxBunker.parent && !B7V.fxSalle.parent && !B7V.modele.object.parent,
        'combat fini : le Septième ne prend plus de place de zombie, ses effets ont quitté la scène', { vivants: Zombies.list.filter((z) => z.b7boss && z.alive).length });
      ok(B7.recompenses.length === 2 && B7.recompenses.every((r) => b7LieuDe({ x: r.x, y: r.gy, z: r.z }) === 'bunker') && B7.drapeaux[C.config.general.drapeauTermine] === true,
        'victoire après la phase 5 : armes merveilles au sol dans Bunker 7, drapeau posé', B7.recompenses.map((r) => r.id));
      T.partie(); pas(2);
      ok(normale(), 'nouvelle partie sur Bunker 7 (carte non rechargée) : ambiance normale', brume());
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Robustesse (11)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C();
      // tir pendant une scène : sans effet ; la scène va à son terme ; hors scène, le même clic tire
      T.partie(); G.god = true;
      C.demarrer(); T.pas(60 * 2);
      const s = curSlot(), m0 = s.mag;
      for (let i = 0; i < 60; i++) { Input.lmb = true; Input.lmbDown = i % 6 === 0; T.pas(1); }
      Input.lmb = false;
      const pendant = B7.cine && s.mag === m0;
      T.pas(60 * 8);
      const m1 = s.mag; Input.lmb = true; Input.lmbDown = true; T.pas(1); Input.lmb = false; T.pas(1);
      ok(pendant && B7.etat === 'phase1' && !B7.cine && s.mag === m1 - 1, 'critère 11 : 10 clics pendant l’introduction : aucun coup ; la scène va à son terme ; hors scène, le même clic tire', { pendant, etat: B7.etat, mag: [m0, m1, s.mag] });
      // mort du joueur à chaque phase : la fin de partie habituelle, sans blocage ; la musique du combat s'arrête
      const res = {};
      for (const ph of ['phase1', 'phase2', 'phase3', 'rituel', 'phase5']) {
        T.partie(); const dem = C.demarrer(); T.pas(60 * 9);
        C.allerA(ph); T.pas(30);
        for (let i = 0; i < 600 && (B7.invul || B7.bloque); i++) T.pas(1);
        const libre = !B7.invul && !B7.bloque;
        T.plein = false; player.perks.delete('souffle'); G.god = false;
        playerDamage(1e9); T.pas(60 * 2);
        res[ph] = { fin: G.state, dem, libre, musique: B7.audio ? B7.audio.musiqueEnCours : null };
        T.plein = true;
      }
      ok(Object.values(res).every((r) => r.fin === 'gameover' && r.dem && r.libre), 'critère 11 : mort du joueur en phases 1, 2, 3, rituel et 5 : fin de partie habituelle, sans blocage', res);
      ok(Object.values(res).every((r) => !r.musique), 'critère 11 : à la fin de partie, la musique du combat s’arrête', res);
      // mort pendant une image du jeu (coup reçu dans update, comme un zombie au contact) : la fin de partie coupe les sons du
      // combat, et la suite de l'image ne les relance pas
      T.partie(); C.demarrer(); T.pas(60 * 9);
      C.allerA('phase1'); T.pas(60);
      T.plein = false; player.perks.delete('souffle'); G.god = false;
      const ur = window.updateRounds;
      window.updateRounds = function (dt) { window.updateRounds = ur; playerDamage(1e9); return ur(dt); };
      T.pas(1);
      window.updateRounds = ur;
      const sonsFin = B7.audio ? B7.audio.stats() : null;
      T.plein = true;
      ok(G.state === 'gameover' && sonsFin && !sonsFin.musique && sonsFin.nommes.length === 0, 'critère 11 : mort pendant une image du jeu : sons du combat coupés, aucun relancé', sonsFin && { musique: sonsFin.musique, nommes: sonsFin.nommes });
      // retour d'Anthony du 2 novembre 2026 (défaut 2) : mort pendant le combat, puis « Rejouer » : ni voile rouge des blessures
      // du jeu (#dmg), ni « État critique » du boss
      const voileMort = +HUD.el.dmg.style.opacity;
      document.getElementById('btn-again').click(); T.pas(60);
      ok(voileMort > 0.8 && HUD.el.dmg.style.opacity === '0' && !HUD.el.hud.querySelector('.b7h-critique.on') && G.state === 'playing',
        'critère 11 : mort pendant le combat, puis « Rejouer » : les bords de l’écran ne restent pas rouges', { voileMort, apres: HUD.el.dmg.style.opacity });
      // interface du boss : rien ne reste figé après une remise à zéro (marque de touche, « Immunisé », « Étourdi », récompenses, message)
      T.partie(); C.demarrer(); T.pas(60 * 9);
      C.allerA('phase1'); T.pas(30);
      for (let k = 0; k < 20; k++) { const r = C.toucherBoss({ joueur: B7.id, degats: 50, zone: 'corps', position: B7V.modele.hitboxes()[1].centre, type: 'balle' }); if (r && r.applique) break; T.pas(10); }
      b7Etourdir(1); T.pas(2);
      const hq = (sel) => HUD.el.hud.querySelector(sel);
      const hudAvant = { marque: hq('.b7h-marque').style.opacity, etourdi: hq('.b7h-alerte').classList.contains('on') };
      quitToMenu(); T.partie(); T.pas(2);
      const hudApres = { marque: hq('.b7h-marque').style.opacity, immun: hq('.b7h-immun').style.opacity, etourdi: hq('.b7h-alerte').classList.contains('on'),
        recomp: hq('.b7h-recomp').classList.contains('on'), message: hq('.b7h-message').classList.contains('on') };
      ok(hudAvant.marque === '1' && hudAvant.etourdi && hudApres.marque === '0' && hudApres.immun === '0' && !hudApres.etourdi && !hudApres.recomp && !hudApres.message,
        'critère 11 : après une remise à zéro, rien ne reste figé dans l’interface du boss', { hudAvant, hudApres });
      // à terre avec Quick Revive en phase 3 : relevé seul, le combat continue
      T.partie(); C.demarrer(); T.pas(60 * 9);
      C.allerA('phase3'); T.pas(30);
      grantPerk('souffle'); T.pas(30);
      T.plein = false; G.god = false;
      playerDamage(1e9);
      const aTerre = !!player.down;
      G.god = true; T.pas(60 * 6); T.plein = true;
      ok(aTerre && !player.down && G.state === 'playing' && B7.etat === 'phase3' && !T.evs('etat', (d) => d.vers === 'echec').length,
        'critère 11 : à terre (Quick Revive) en phase 3 : relevé, le combat continue', { aTerre, down: player.down, etat: B7.etat });
      // quitter au menu en pleine phase 5 : rien du combat ne reste au menu ; une nouvelle partie le relance
      T.partie(); C.demarrer(); T.pas(60 * 9);
      C.allerA('phase5'); T.pas(60 * 3);
      pauseGame(); quitToMenu(); menuCamera(1 / 60);
      let voile = 0; const re = B7V.fx.rendreEcran;
      B7V.fx.rendreEcran = function () { voile++; return re.apply(this, arguments); };
      T.image(); B7V.fx.rendreEcran = re;
      const menu = { etat: G.state, musique: B7.audio ? B7.audio.musiqueEnCours : null, septieme: !!B7V.modele.object.parent, effets: !!(B7V.fxBunker.parent || B7V.fxSalle.parent),
        salle: !!B7S.racine.parent, voile, lumiere: HEMI && CUR.map ? +(HEMI.intensity / CUR.map.ambiance.hemi).toFixed(3) : 1 };
      ok(menu.etat === 'menu' && !menu.musique && !menu.septieme && !menu.effets && !menu.salle && !menu.voile && menu.lumiere === 1,
        'critère 11 : quitter au menu en phase 5 : ni musique, ni Septième, ni effets, ni voile, lumière rendue', menu);
      T.partie();
      ok(B7.etat === 'inactif' && !B7.manches && !B7.bloque && !Zombies.list.some((z) => z.alive && z.b7) && C.demarrer() === true,
        'critère 11 : puis nouvelle partie : rien ne reste, le combat repart', { etat: B7.etat });
      // fenêtre en arrière-plan (onglet, autre application) : la pause habituelle du jeu ; le combat s'arrête avec lui et reprend où il était
      T.partie(); C.demarrer(); T.pas(60 * 9);
      C.allerA('phase1'); T.pas(30);
      const t0 = T.e().temps, verrou = Input.locked;
      Input.locked = false;                               // une fenêtre qui perd le focus libère la souris verrouillée
      window.dispatchEvent(new Event('blur'));
      const pause = G.state;
      T.pas(120);
      const fige = T.e().temps === t0;
      resumeGame(); Input.locked = verrou; T.pas(120);
      ok(pause === 'paused' && fige && G.state === 'playing' && B7.etat === 'phase1' && Math.abs(T.e().temps - t0 - 2) < 0.05,
        'critère 11 : fenêtre en arrière-plan : pause du jeu, combat figé, puis repris où il était', { pause, fige, etat: B7.etat, dt: T.e().temps - t0 });
      // une partie reprend normalement ensuite
      T.partie(); C.demarrer(); T.pas(60 * 9);
      ok(B7.etat === 'phase1' && B7.lieu === 'salle', 'critère 11 : une nouvelle partie relance le combat normalement', B7.etat);
      G.god = true;
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Panneau de test (Mod Tools) et performances (12)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t;
      // panneau de test : seulement dans une partie de test des Mod Tools (F8)
      T.partie();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8' }));
      const refuse = !B7P.ouvert;
      ZS.playTest(MAPS.byId.bunker7); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      __zs.god(true); T.branche();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8' }));
      const ouvert = B7P.ouvert;
      document.querySelector('#b7p [data-d="etat:phase2"]').click(); T.pas(60);
      ok(refuse && ouvert && B7.etat === 'phase2', 'panneau de test : refusé en partie normale ; F8 dans une partie de test des Mod Tools ; aller à la phase 2', { refuse, ouvert, etat: B7.etat });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F8', key: 'F8' }));
      ZS.stopTest();
      ok(B7.sonsPrets && B7.sonsCharges && B7.sonsCharges.charges === 133 && B7.sonsCharges.total === 133, 'sons du boss : les 133 décodés', B7.sonsCharges);
      // critère 12 : le modèle du Septième, déclaré par le module et dessiné par le moteur du jeu (avec et sans lui)
      const st = B7V.modele.stats;
      T.partie(); G.god = true;
      const C = T.C(); C.demarrer(); T.pas(60 * 9);
      T.ici(0, -6, Math.PI); T.pas(2);
      const M = B7V.modele.object, ri = renderer.info, c = B7V.modele.hitboxes()[1].centre;
      b7SalleAvantRendu();
      const q0 = camera.quaternion.clone(); camera.lookAt(c.x, c.y, c.z); camera.updateMatrixWorld();
      ri.autoReset = false;
      const passe = () => { ri.reset(); renderer.render(scene, camera); return { c: ri.render.calls, t: ri.render.triangles }; };
      const avec = passe(); M.visible = false; const sans = passe(); M.visible = true;
      ri.autoReset = true; camera.quaternion.copy(q0); camera.updateMatrixWorld();
      const dm = { appels: avec.c - sans.c, triangles: avec.t - sans.t };
      ok(Math.abs(st.triangles - 56000) < 6000 && st.appelsDessin > 0 && st.appelsDessin <= 39 && M.parent === scene
        && dm.appels > 0 && dm.appels <= st.appelsDessin && dm.triangles > 0.5 * st.triangles && dm.triangles <= st.triangles,
        `critère 12 : modèle du Septième : ${st.triangles} triangles et ${st.appelsDessin} appels de dessin en tout ; dessiné par le jeu en phase 1 (sans ailes ni lames) : ${dm.triangles} triangles, ${dm.appels} appels`, { st, dm });
      // critère 12 : 22 zombies au sprint en phase 4 (rituel) : coût de calcul par image (sans le rendu)
      C.allerA('rituel'); T.ici(0, -12, Math.PI);
      const max = C.config.phase4.apparitions.max;
      for (let i = 0; i < 60 * 40 && Zombies.list.filter((z) => z.alive && z.b7 && !z.dog).length < max; i++) T.pas(1);
      const zs = Zombies.list.filter((z) => z.alive && z.b7 && !z.dog);
      let pire = 0;
      const t0 = performance.now();
      for (let i = 0; i < 300; i++) { const a = performance.now(); update(1 / 60); endFrameInput(); b7SalleAvantRendu(); pire = Math.max(pire, performance.now() - a); }
      const ms = (performance.now() - t0) / 300;
      ok(zs.length >= max && zs.every((z) => Math.abs(z.speed - SPEEDS.run[1] * z.type.mult.speed) < 1e-6) && ms < 16,
        `critère 12 : rituel, ${zs.length} zombies au sprint : ${ms.toFixed(2)} ms de calcul par image en moyenne, ${pire.toFixed(1)} ms au pire (sans le rendu)`, { nz: zs.length, ms, pire });
      return out;
    })).forEach(report);
    // ------------------------------------------------------------ Changement de carte en plein combat (11)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const T = window.__b7t, C = T.C();
      T.partie(); G.god = true;
      C.demarrer(); T.pas(60 * 9);
      // une autre carte (Khamsin, monde ouvert) : la salle quitte le monde, les sons du boss sont libérés, rien du combat ne tourne
      __zs.map('khamsin'); T.partie(); G.god = true; T.pas(30); T.image();
      const kh = { carte: G.mapId, salle: B7S.actif, scene: !!B7S.racine.parent, audio: !!B7.audio, septieme: !!B7V.modele.object.parent, actif: B7.actif };
      // retour sur Bunker 7 : la salle revient dans la grille, le combat repart de zéro
      __zs.map('bunker7'); T.partie(); G.god = true; T.pas(30);
      const b7 = { salle: B7S.actif, etat: B7.etat, dem: C.demarrer() };
      T.pas(60 * 9);
      ok(kh.carte === 'khamsin' && !kh.salle && !kh.scene && !kh.audio && !kh.septieme && !kh.actif && b7.salle && b7.etat === 'inactif' && b7.dem && B7.etat === 'phase1' && B7.lieu === 'salle',
        'critère 11 : changement de carte en plein combat : sur Khamsin, ni salle, ni sons, ni Septième ; de retour sur Bunker 7, la salle et le combat repartent', { kh, b7, etat: B7.etat });
      G.god = true;
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
  console.log(failures ? `${failures} échec(s).` : 'Boss de Bunker 7 : conforme aux critères du brief.');
  process.exit(failures ? 1 : 0);
})();
