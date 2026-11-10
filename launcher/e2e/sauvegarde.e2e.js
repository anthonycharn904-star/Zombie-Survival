'use strict';
/* Sauvegarder et quitter (jeu 2.0.7), dans la fenêtre du jeu du launcher, sur Bunker 7.
   Mode « manche » : manche 5 en cours, armes, atouts, porte ouverte, courant, bonus, planches, zombies vivants ;
   refus en plein combat (coup reçu, zombie proche), pendant une manche spéciale, à terre ; sauvegarde depuis la pause,
   fermeture de la fenêtre du jeu, reprise depuis « Continuer la partie » : tout revient, santé pleine, aucun zombie
   recréé près du joueur, la partie attend en pause, la sauvegarde est consommée, aucune partie de plus comptée.
   Mode « entre » : refus pendant la manche ; sauvegarde entre deux manches, reprise au début de la suivante.
   Fiabilité : principale abîmée → copie ; les deux abîmées → message, rien d'effacé ; version plus récente refusée ;
   remplacement par une nouvelle partie après confirmation (Échap annule) ; quitter sans sauvegarder après
   confirmation ; fin de partie : sauvegardes effacées ; plusieurs cartes ; coût de la sauvegarde ; partie de test des
   Mod Tools : pas de sauvegarde, retour sans confirmation.
   Secours : fin de manche, porte ouverte, 90 s, minuteur, refus en plein combat, effacée à terre, à jour à la fermeture au
   calme et effacée en plein combat ; plantage du moteur de rendu, puis « Reprendre la partie interrompue ».
   Fermeture de la fenêtre pendant une partie : retenue par le launcher, « Quitter le jeu ? » (sauvegarder, quitter sans
   sauvegarder, annuler).
     xvfb-run -a node e2e/sauvegarde.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-sauvegarde-'));
const USER = path.join(TMP, 'joueur');

(async () => {
  fs.mkdirSync(USER, { recursive: true });
  let app, failures = 0;
  const errors = [];
  const res = [];
  const report = (r) => res.push(r);
  const ouvrirJeu = async () => {
    const launcher = app.windows().find((w) => w.url().includes('launcher')) || await app.firstWindow({ timeout: 30000 });
    await launcher.waitForFunction(() => !document.getElementById('btn-main').disabled, null, { timeout: 120000 });
    const [g] = await Promise.all([app.waitForEvent('window', { timeout: 60000 }), launcher.click('#btn-main')]);
    if (process.platform === 'linux') g.setDefaultTimeout(180000);   // rendu logiciel : images lentes
    await g.waitForFunction(() => window.ZS && ZS.G.state === 'menu' && !document.getElementById('menu').hidden, null, { timeout: 120000 });
    g.on('pageerror', (e) => errors.push(String(e)));
    return g;
  };
  try {
    const args = [ROOT];
    if (process.platform === 'linux') args.push('--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-watchdog');
    app = await electron.launch({ executablePath: EXE, args, env: { ...process.env, ZS_USER_DATA: USER }, timeout: 60000 });
    let game = await ouvrirJeu();
    // ------------------------------------------------ mode « manche » : préparation, refus, sauvegarde
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const step = (n) => __zs.step(n, 1 / 60);
      const B = (type, copie) => sauveStock.brut('bunker7', type, copie);    // texte enregistré (fichier ou navigateur)
      for (const k of Object.keys(localStorage)) if (k.startsWith('zs.partie.')) localStorage.removeItem(k);
      ['manuelle', 'secours'].forEach((t) => sauveStock.effacer('bunker7', t));
      SAUVE.mode = 'manche';
      __zs.start();
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      step(2);
      // une partie avancée : manche 5 en cours, points, armes, atouts, porte, courant, bonus, planches
      G.round = 5; G.roundState = 'active'; G.dogRound = false; G.total = 14; G.spawned = 6; G.killed = 2; G.spawnT = 3; G.zombieHp = 300;
      G.points = 12345; G.grenades = 3;
      Arms.slots = [{ id: 'thompson', tier: 1, up: true, mag: 17, res: 120, kills: 33 }, { id: 'kar98k', tier: 0, up: false, mag: 3, res: 40, kills: 5 }];
      Arms.cur = 1; refreshGunModel();
      player.perks.add('cuirasse'); player.perks.add('mainleste'); player.maxHp = RULES.cuirasseHp; player.hp = 140;
      if (typeof HORL === 'object') { HORL.cran = 7; HORL.fait = false; horlPoser(HORL.cran * Math.PI / 6); }   // horloge de la gare (chantier Bunker 7), si elle est dans le jeu
      const [porteId, porte] = Object.entries(World.doors)[0] || [];
      if (porte) openDoor(porte);
      powerOnQuiet(); G.power = true;
      G.timers.double = 17.5;
      Powerups.acc = 777;
      if (World.windows[0]) { const w = World.windows[0]; w.planks[0].state = 'gone'; w.planks[0].m.visible = false; w.planks[1].state = 'gone'; w.planks[1].m.visible = false; w.boards = 4; }
      // quatre zombies vivants, loin du joueur : par les fenêtres et les points d'apparition les plus éloignés
      const loin = [...World.windows, ...World.risers].filter((r) => G.activeZones.has(r.zone)).sort((a, b) => Math.hypot(b.x - player.pos.x, b.z - player.pos.z) - Math.hypot(a.x - player.pos.x, a.z - player.pos.z));
      const zs = [];
      for (let i = 0; i < 4 && i < loin.length; i++) { const z = spawnZombie(loin[i], G.zombieHp); if (z) { z.hp = 100 + i * 40; zs.push(z); } }
      step(30);
      ok(zs.length === 4 && zs.every((z) => z.alive), `quatre zombies vivants (${zs.length})`);
      if (zs.length < 1) return out;
      // refus en plein combat, manche spéciale, à terre
      player.lastHit = G.time;
      ok(/touché/.test(ZSPartie.peutSauvegarder().raison || ''), `refus juste après un coup : « ${ZSPartie.peutSauvegarder().raison} »`);
      player.lastHit = -99;
      const z0 = zs[0], px = z0.pos.x, pz = z0.pos.z;
      z0.pos.set(player.pos.x + 2, z0.pos.y, player.pos.z);
      ok(/trop près/.test(ZSPartie.peutSauvegarder().raison || ''), `refus avec un zombie à 2 m : « ${ZSPartie.peutSauvegarder().raison} »`);
      z0.pos.set(px, z0.pos.y, pz);
      G.dogRound = true;
      ok(/spéciale/.test(ZSPartie.peutSauvegarder().raison || ''), 'refus pendant une manche de chiens');
      G.dogRound = false;
      player.down = true;
      ok(/terre/.test(ZSPartie.peutSauvegarder().raison || ''), 'refus à terre');
      player.down = false;
      const p = ZSPartie.peutSauvegarder();
      ok(p.ok, 'permis : à l’abri, sans zombie proche', p.raison);
      // pause : bouton et raison
      pauseGame();
      const b = document.getElementById('btn-save-quit');
      ok(b && !b.disabled && document.getElementById('pause-save-why').hidden, 'pause : « Sauvegarder et quitter » disponible');
      const t0 = performance.now(), env = sauveCapter('manuelle'), dur = performance.now() - t0, taille = JSON.stringify(env).length;
      ok(dur < 50 && taille < 64000, `capture : ${dur.toFixed(1)} ms, ${(taille / 1024).toFixed(1)} Ko`);
      // gardé dans le stockage : la fenêtre du jeu est fermée puis rouverte avant la reprise
      localStorage.setItem('zs.essai.attendu', JSON.stringify({
        x: player.pos.x, z: player.pos.z, yaw: player.yaw, points: G.points, porte: porteId || null, zhp: zs.map((z) => z.hp).sort((a, c) => a - c),
        games: Life.data.games, best: store.get('zs.best.bunker7', 0), double: G.timers.double, acc: Powerups.acc,
        horloge: typeof HORL === 'object' ? HORL.cran : null,
      }));
      return ZSPartie.sauvegarderEtQuitter().then((r) => B('manuelle').then((txt) => {
        ok(r.ok && G.state === 'menu' && txt, `sauvegardée et retour au menu (${r.octets} octets, stockage : ${sauveStock.nom})`, r);
        const msg = document.getElementById('menu-save-done');
        ok(!msg.hidden && /manche 5/.test(msg.textContent), `confirmation : « ${msg.textContent} »`);
        return new Promise((fin) => setTimeout(fin, 60));
      })).then(() => {
        const c = document.getElementById('btn-resume-save');
        ok(!c.hidden && /Continuer la partie/.test(c.textContent) && /Bunker 7, manche 5/.test(c.textContent), `menu : « ${c.textContent} »`);
        return out;
      });
    })).forEach(report);
    // fermeture complète de la fenêtre du jeu, puis réouverture depuis le launcher (méthode E2 seulement)
    await game.close();
    game = await ouvrirJeu();
    // ------------------------------------------------ mode « manche » : reprise
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const att = JSON.parse(localStorage.getItem('zs.essai.attendu') || '{}');
      localStorage.removeItem('zs.essai.attendu');
      return new Promise((fin) => setTimeout(fin, 60)).then(() => {
        window.__lock0 = lastLockAttempt;
        document.getElementById('btn-resume-save').click();
        const t0 = performance.now();
        return new Promise((fin) => { const t = setInterval(() => { if (G.state === 'paused' || (SAUVE.derniere && !SAUVE.derniere.ok) || performance.now() - t0 > 60000) { clearInterval(t); fin(); } }, 100); });
      }).then(() => {
        ok(SAUVE.derniere && SAUVE.derniere.ok && G.state === 'paused' && document.getElementById('pause-title').textContent === 'Partie reprise', 'reprise : la partie attend en pause (« Partie reprise »)', SAUVE.derniere);
        // souris : la reprise ne la demande pas (elle était accordée pendant la pause : curseur caché, pause sans fin, bug
        // du 4 novembre 2026) ; accordée hors du jeu, elle est rendue aussitôt
        ok(lastLockAttempt === window.__lock0, 'reprise : la souris verrouillée n’est pas demandée (le bouton Reprendre la demandera)');
        {
          const d = Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement'), x0 = document.exitPointerLock;
          let rendue = 0;
          Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => renderer.domElement });
          document.exitPointerLock = () => { rendue++; };
          try { document.dispatchEvent(new Event('pointerlockchange')); } finally { delete document.pointerLockElement; document.exitPointerLock = x0; }
          ok(rendue === 1 && G.state === 'paused' && d, 'souris verrouillée accordée pendant la pause : rendue aussitôt, la pause reste', { rendue });
          Input.locked = false;
        }
        if (att.horloge != null) ok(HORL.cran === att.horloge && !HORL.fait && Math.abs(HORL.angle - att.horloge * Math.PI / 6) < 1e-6, `horloge de la gare : l’aiguille reprend sur ${HORL.cran} (easter egg pas encore fait)`, { cran: HORL.cran, fait: HORL.fait });
        ok(G.mapId === 'bunker7' && G.round === 5 && G.roundState === 'active' && G.total === 14 && G.killed === 2 && G.spawned === 6, `manche 5 en cours : ${G.killed} tués, ${G.spawned} apparus sur ${G.total}`);
        ok(G.points === 12345 && G.grenades === 3, `points ${G.points}, grenades ${G.grenades}`);
        const s = Arms.slots;
        ok(s[0] && s[0].id === 'thompson' && s[0].tier === 1 && s[0].mag === 17 && s[0].res === 120 && s[1] && s[1].id === 'kar98k' && s[1].mag === 3 && Arms.cur === 1, 'armes, palier, chargeurs, réserves, arme en main');
        ok(player.perks.has('cuirasse') && player.perks.has('mainleste') && player.maxHp === RULES.cuirasseHp && player.hp === player.maxHp, `atouts ; santé pleine (${player.hp}/${player.maxHp})`);
        const porte = World.doors[att.porte];
        ok((!att.porte || (porte && porte.opened)) && G.power, 'porte ouverte, courant');
        ok(Math.abs(G.timers.double - att.double) < 0.02 && att.double > 15 && Powerups.acc === att.acc, `Points doubles : ${G.timers.double.toFixed(2)} s restantes (${att.double.toFixed(2)} à la sauvegarde) ; rythme des bonus (${Powerups.acc})`, { double: G.timers.double, acc: Powerups.acc, att });
        ok(!World.windows[0] || (World.windows[0].boards === 4 && World.windows[0].planks[0].state === 'gone'), 'planches de la fenêtre');
        ok(Math.hypot(player.pos.x - att.x, player.pos.z - att.z) < 0.05 && Math.abs(player.yaw - att.yaw) < 0.001, 'joueur à sa place, même regard');
        const vivants = Zombies.list.filter((z) => z.alive && !z.dog);
        const hp = vivants.map((z) => z.hp).sort((a, c) => a - c);
        ok(vivants.length === 4 && JSON.stringify(hp) === JSON.stringify(att.zhp), `zombies recréés : ${vivants.length}, santé ${hp.join(', ')}`);
        const proche = Math.min(...vivants.map((z) => Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z)));
        ok(proche >= SAUVE.ecart, `aucun zombie recréé près du joueur (le plus proche à ${proche.toFixed(1)} m)`);
        window.__consommee = sauveStock.brut('bunker7', 'manuelle');
        ok(Life.data.games === att.games && store.get('zs.best.bunker7', 0) === att.best, 'aucune partie de plus, record intact');
        resumeGame(); __zs.step(120, 1 / 60);
        ok(G.state === 'playing' && Zombies.list.filter((z) => z.alive).length >= 4, 'la partie reprend');
        quitToMenu();
        return window.__consommee.then((txt) => { ok(txt === null, 'sauvegarde consommée'); return out; });
      });
    })).forEach(report);
    // ------------------------------------------------ mode « entre » et fiabilité
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const step = (n) => __zs.step(n, 1 / 60);
      const B = (copie) => sauveStock.brut('bunker7', 'manuelle', copie);
      const ecrireB = (txt, copie) => sauveStock.brut('bunker7', 'manuelle', copie, txt);
      const attendre = (cond) => { const t0 = performance.now(); return new Promise((fin) => { const t = setInterval(() => { if (cond() || performance.now() - t0 > 60000) { clearInterval(t); fin(); } }, 100); }); };
      SAUVE.mode = 'entre';
      __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      G.roundState = 'active'; G.round = 3; clearZombies();
      ok(/entre deux manches/.test(ZSPartie.peutSauvegarder().raison || ''), 'mode « entre » : refus pendant la manche');
      G.roundState = 'intermission'; G.roundT = 6; G.points = 900;
      ok(ZSPartie.peutSauvegarder().ok, 'mode « entre » : permis entre deux manches');
      pauseGame();
      return ZSPartie.sauvegarderEtQuitter().then((r) => {
        ok(r.ok && r.apercu.manche === 4, `entre deux manches : sauvegardée (reprise à la manche ${r.apercu && r.apercu.manche})`);
        return ZSPartie.continuer('bunker7');
      }).then(() => {
        ok(G.state === 'paused' && G.round === 3 && G.roundState === 'pre' && G.points === 900, 'reprise : avant la manche 4');
        resumeGame(); step(200);
        ok(G.round === 4 && G.roundState === 'active', 'la manche 4 commence');
        SAUVE.mode = 'manche';
        // fiabilité : deux sauvegardes (la première devient la copie), principale abîmée
        G.dogRound = false;                                         // la manche 4 peut être tirée en manche de chiens
        G.roundState = 'intermission'; G.roundT = 6; clearZombies(); G.points = 1111; pauseGame();
        return ZSPartie.sauvegarderEtQuitter();
      }).then((r1) => {
        ok(r1.ok, 'première sauvegarde (1111 points) écrite', r1);
        __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        G.roundState = 'intermission'; G.roundT = 6; clearZombies(); G.points = 2222; pauseGame();
        return ZSPartie.sauvegarderEtQuitter();
      }).then(() => Promise.all([B(), B(true)])).then(([txt, bak]) => {
        ok(bak && JSON.parse(bak).apercu.points === 1111, 'copie précédente gardée (.bak)');
        return ecrireB(txt.split('"points":2222').join('"points":9999'));
      }).then(() => ZSPartie.continuer('bunker7')).then(() => {
        ok(SAUVE.derniere.ok && SAUVE.derniere.source === 'copie' && G.points === 1111, `principale abîmée : la copie sert (${SAUVE.derniere.avertissement})`);
        quitToMenu();
        // les deux abîmées : message, rien d'effacé
        return Promise.all([ecrireB('{"abîmée": true'), ecrireB('x', true)]);
      }).then(() => ZSPartie.continuer('bunker7')).then(() => Promise.all([B(), B(true)])).then(([txt, bak]) => {
        const msg = document.getElementById('menu-save-done');
        ok(!SAUVE.derniere.ok && G.state === 'menu' && !msg.hidden && txt && bak, `les deux abîmées : « ${msg.textContent} », rien d’effacé`);
        // version plus récente : refusée, gardée
        __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        G.roundState = 'intermission'; clearZombies(); pauseGame();
        return ZSPartie.sauvegarderEtQuitter();
      }).then(() => B()).then((txt) => {
        const env = JSON.parse(txt); env.jeu.version = '9.9.9';
        return ecrireB(JSON.stringify(env));
      }).then(() => ZSPartie.continuer('bunker7')).then(() => B()).then((txt) => {
        ok(!SAUVE.derniere.ok && /plus récent/.test(SAUVE.derniere.erreur) && txt, `version plus récente : « ${SAUVE.derniere.erreur} »`);
        const env = JSON.parse(txt); env.jeu.version = GAME_VERSION;
        return ecrireB(JSON.stringify(env)).then(() => sauveStock.liste());
      }).then(() => {
        // remplacement : la sélection propose Continuer ou Nouvelle partie ; Échap annule
        MapSel.sel = 'bunker7'; showScreen('mapsel'); playSelectedMap();
        const conf = document.getElementById('confirm');
        ok(!conf.hidden && /Nouvelle partie/.test(document.getElementById('btn-confirm-alt').textContent), 'nouvelle partie sur une carte sauvegardée : confirmation (Continuer, Nouvelle partie, Annuler)');
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
        ok(conf.hidden && !document.getElementById('mapsel').hidden && SAUVE.index.has('bunker7.manuelle'), 'Échap : retour à la sélection, sauvegarde gardée');
        playSelectedMap(); document.getElementById('btn-confirm-alt').click();
        return attendre(() => G.state === 'playing').then(() => new Promise((fin) => setTimeout(fin, 200))).then(() => B());
      }).then((txt) => {
        ok(txt === null, 'nouvelle partie confirmée : ancienne sauvegarde remplacée');
        // quitter sans sauvegarder : confirmation ; Échap revient à la pause
        pauseGame(); document.getElementById('btn-quit').click();
        const conf = document.getElementById('confirm');
        ok(!conf.hidden && /sans sauvegarder/.test(document.getElementById('confirm-title').textContent), 'quitter au menu : « Quitter sans sauvegarder ? »');
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
        ok(conf.hidden && G.state === 'paused' && !document.getElementById('pause').hidden, 'Échap : retour à la pause, la partie ne reprend pas');
        document.getElementById('btn-quit').click(); document.getElementById('btn-confirm-yes').click();
        ok(G.state === 'menu', 'quitter sans sauvegarder confirmé : menu');
        // fin de partie : la sauvegarde de la carte est effacée ; celle d'une autre carte reste
        __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        G.roundState = 'intermission'; clearZombies(); pauseGame();
        return ZSPartie.sauvegarderEtQuitter();
      }).then(() => B()).then((txt) => {
        const autre = JSON.parse(txt); autre.carte.id = 'ombre'; autre.apercu.carte = 'ombre'; autre.apercu.nom = 'Ombre éternelle';
        return sauveStock.brut('ombre', 'manuelle', false, JSON.stringify(autre));
      }).then(() => ZSPartie.etat()).then((l) => {
        ok(l.filter((x) => x.type === 'manuelle').length === 2, `deux cartes sauvegardées : ${l.map((x) => x.carte).join(', ')}`);
        __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        G.roundState = 'intermission'; clearZombies(); pauseGame();
        return ZSPartie.sauvegarderEtQuitter();
      }).then(() => {
        __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        G.state = 'playing'; gameOver();
        return new Promise((fin) => setTimeout(fin, 200)).then(() => Promise.all([B(), sauveStock.brut('ombre', 'manuelle')]));
      }).then(([txt, ombre]) => {
        ok(txt === null && ombre, 'fin de partie : sauvegarde de la carte effacée, celle d’Ombre éternelle gardée');
        sauveStock.effacer('ombre', 'manuelle');
        // partie de test des Mod Tools : jamais sauvegardée ; « Quitter au menu » sans confirmation (retour à l'éditeur)
        ZS.playTest(MAPS.byId.bunker7); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
        const refusMT = ZSPartie.peutSauvegarder().raison || '';
        pauseGame();
        const cache = document.getElementById('btn-save-quit').hidden;
        document.getElementById('btn-quit').click();
        ok(/Mod Tools/.test(refusMT) && cache && document.getElementById('confirm').hidden && G.state !== 'paused', `partie de test des Mod Tools : pas de sauvegarde (« ${refusMT} »), « Quitter au menu » sans confirmation`);
        ZS.stopTest();
        G.editorSession = false; G.state = 'menu'; showScreen('menu');   // la fenêtre du jeu revient hors des Mod Tools
        showScreen('menu'); G.state = 'menu';
        renderEnabled = true; render(); renderEnabled = false;
        return out;
      });
    })).forEach(report);
    // ------------------------------------------------ secours : fin de manche, moment important, intervalle, à terre, fermeture
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const S = () => sauveStock.brut('bunker7', 'secours');
      const pause = (ms) => new Promise((fin) => setTimeout(fin, ms));
      ['manuelle', 'secours'].forEach((t) => sauveStock.effacer('bunker7', t));
      SAUVE.mode = 'manche';
      __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      clearZombies(); G.round = 2; G.roundState = 'active'; G.dogRound = false; G.total = 5; G.spawned = 5; G.killed = 5; G.spawnT = 1e9;
      endRound(); G.roundT = 1e9;                                  // la pause entre deux manches dure le temps de l'essai
      return Promise.resolve(sauveSecoursTick()).then((d) => S().then((txt) => [d || SAUVE.secours.derniere, txt])).then(([d, txt]) => {
        ok(d && d.ok && d.raison === 'manche' && txt, 'fin de manche : secours écrite', d);
        ok(sauveSecoursTick() === null, 'une seule secours par fin de manche');
        const porte = Object.values(World.doors).find((x) => !x.opened);
        if (porte) openDoor(porte);
        ok(!porte || SAUVE.secours.attente === 'doors', 'porte ouverte : secours demandée');
        return sauveSecoursTick();
      }).then((d) => {
        ok(d && d.ok && d.raison === 'doors', 'porte ouverte : secours écrite', d);
        SAUVE.secours.t = G.time - 91;
        return sauveSecoursTick();
      }).then((d) => {
        ok(d && d.ok && d.raison === 'periodique', 'au bout de 90 s : secours écrite', d);
        player.lastHit = G.time; SAUVE.secours.attente = 'essai';
        ok(sauveSecoursTick() === null && SAUVE.secours.attente === 'essai', 'en plein combat : la secours attend');
        player.lastHit = -99; SAUVE.secours.attente = null;
        if (G.state !== 'playing') { showScreen(null); G.state = 'playing'; }
        const avant = SAUVE.secours.derniere && SAUVE.secours.derniere.cree;
        clearZombies(); SAUVE.secours.t = G.time - 91;
        return avant;
      }).then((avant) => new Promise((fin) => {      // minuteur d'1 s : en rendu logiciel, une image bloque parfois plus de 2 s
        const t0 = performance.now();
        const t = setInterval(() => {
          clearZombies(); player.lastHit = -99;           // la partie continue : rien ne doit l'empêcher d'être calme (refus en plein combat)
          const c = SAUVE.secours.derniere && SAUVE.secours.derniere.cree;
          if ((c && c !== avant) || performance.now() - t0 > 12000) { clearInterval(t); fin(); }
        }, 200);
      }).then(() => {
        const ap = SAUVE.secours.derniere && SAUVE.secours.derniere.cree;
        ok(ap && ap !== avant && SAUVE.secours.derniere.raison === 'periodique', 'minuteur : secours réécrite toute seule', { avant, ap, etat: G.state, refus: sauveRefus() });
        player.perks.add('souffle'); goDown();
        return pause(200).then(() => S());
      })).then((txt) => {
        ok(txt === null, 'à terre : secours effacée');
        revivePlayer(); player.lastHit = -99;
        window.dispatchEvent(new Event('pagehide'));
        return pause(300).then(() => S());
      }).then((txt) => {
        ok(txt && JSON.parse(txt).raison === 'fermeture', 'fenêtre fermée au calme : secours à jour');
        player.lastHit = G.time;
        window.dispatchEvent(new Event('pagehide'));
        return pause(300).then(() => S());
      }).then((txt) => {
        ok(txt === null, 'fenêtre fermée en plein combat : secours effacée (pas de retour en arrière)');
        player.lastHit = -99; G.points = 4321;
        return sauveSecoursEcrire('avant plantage');
      }).then((d) => S().then((txt) => {
        localStorage.setItem('zs.essai.secours', JSON.stringify({ points: G.points, round: G.round, games: Life.data.games }));
        ok(d.ok && txt, 'secours écrite, la partie continue (plantage ensuite)');
        return out;
      }));
    })).forEach(report);
    // plantage : le moteur de rendu de la fenêtre du jeu est arrêté de force, la fenêtre se ferme ; puis réouverture
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().startsWith('zsgame://game/'));
      if (w) w.webContents.forcefullyCrashRenderer();
    });
    await game.waitForEvent('close', { timeout: 30000 }).catch(() => {});
    game = await ouvrirJeu();
    // ------------------------------------------------ secours : récupération après le plantage
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const S = () => sauveStock.brut('bunker7', 'secours');
      const att = JSON.parse(localStorage.getItem('zs.essai.secours') || '{}');
      localStorage.removeItem('zs.essai.secours');
      if (G.state !== 'menu') quitToMenu();                    // dans la page seule : à la place du plantage
      return new Promise((fin) => setTimeout(fin, 300)).then(() => {
        const b = document.getElementById('btn-resume-save');
        ok(!b.hidden && /Reprendre la partie interrompue/.test(b.textContent) && b.dataset.type === 'secours', `menu : « ${b.textContent} »`);
        b.click();
        const t0 = performance.now();
        return new Promise((fin) => { const t = setInterval(() => { if (G.state === 'paused' || performance.now() - t0 > 60000) { clearInterval(t); fin(); } }, 100); });
      }).then(() => new Promise((fin) => setTimeout(fin, 200))).then(() => S()).then((txt) => {
        ok(G.state === 'paused' && G.points === att.points && G.round === att.round && txt === null, `partie récupérée en pause (manche ${G.round}, ${G.points} points), secours consommée`);
        ok(Life.data.games === att.games, 'aucune partie de plus');
        resumeGame(); player.lastHit = -99; clearZombies();
        return sauveSecoursTick();
      }).then((d) => {
        ok(d && d.ok && d.raison === 'reprise', 'après la reprise : nouvelle secours aussitôt');
        pauseGame(); document.getElementById('btn-quit').click(); document.getElementById('btn-confirm-yes').click();
        return new Promise((fin) => setTimeout(fin, 200)).then(() => S()).then((txt) => {
          ok(G.state === 'menu' && txt === null, 'quitter sans sauvegarder : secours effacée');
          return out;
        });
      });
    })).forEach(report);
    // ------------------------------------------------ fermeture de la fenêtre demandée par le launcher (dans la page : faux launcher)
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      if (window.zsLauncher) return out;                         // dans Electron : la vraie fenêtre, juste après
      let quitte = 0;
      window.zsLauncher = { quit: () => { quitte++; }, onCloseRequest() {}, toggleFullscreen() {}, platform: 'essai' };
      const conf = () => !document.getElementById('confirm').hidden;
      if (G.state !== 'menu') quitToMenu();
      sauveFermetureDemandee();
      ok(quitte === 1 && !conf(), 'au menu : la fenêtre se ferme sans question');
      __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } clearZombies(); player.lastHit = -99;
      sauveFermetureDemandee();
      ok(conf() && G.state === 'paused' && /Quitter le jeu/.test(document.getElementById('confirm-title').textContent)
        && document.getElementById('btn-confirm-yes').textContent === 'Sauvegarder et quitter' && !document.getElementById('btn-confirm-alt').hidden && quitte === 1,
      'partie en cours, au calme : « Quitter le jeu ? » (Sauvegarder et quitter, Quitter sans sauvegarder, Annuler)');
      document.getElementById('btn-confirm-no').click();
      ok(!conf() && G.state === 'paused' && quitte === 1, 'Annuler : retour à la pause, la fenêtre reste');
      sauveFermetureDemandee(); document.getElementById('btn-confirm-yes').click();
      return new Promise((fin) => setTimeout(fin, 300)).then(() => {
        ok(quitte === 2 && SAUVE.index.has('bunker7.manuelle'), 'Sauvegarder et quitter : sauvegardée, puis la fenêtre se ferme');
        sauveStock.effacer('bunker7', 'manuelle');
        __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } clearZombies();
        player.lastHit = -99; sauveSecoursEcrire('essai');
        player.lastHit = G.time;
        sauveFermetureDemandee();
        ok(conf() && document.getElementById('btn-confirm-yes').textContent === 'Quitter sans sauvegarder' && document.getElementById('btn-confirm-alt').hidden
          && /sauvegarde impossible/.test(document.getElementById('confirm-text').textContent), 'en plein combat : seulement « Quitter sans sauvegarder », avec la raison');
        document.getElementById('btn-confirm-yes').click();
        ok(quitte === 3 && !SAUVE.index.has('bunker7.secours'), 'quitté sans sauvegarder : secours effacée');
        delete window.zsLauncher;
        quitToMenu();
        return out;
      });
    })).forEach(report);
    // fermeture réelle de la fenêtre pendant une partie (méthode E2) : retenue, le jeu demande ; Annuler ; puis quitter
    await game.evaluate(() => { __zs.start(); if (G.state === 'paused') { showScreen(null); G.state = 'playing'; } clearZombies(); player.lastHit = -99; });
    const fermer = () => app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().startsWith('zsgame://game/')); if (w) w.close(); });
    await fermer();
    const demande = await game.waitForFunction(() => !document.getElementById('confirm').hidden && /Quitter le jeu/.test(document.getElementById('confirm-title').textContent), null, { timeout: 15000 }).then(() => true, () => false);
    report({ ok: demande && !game.isClosed(), label: 'fenêtre fermée pendant une partie : retenue, le jeu demande « Quitter le jeu ? »' });
    await game.click('#btn-confirm-no').catch(() => {});
    report({ ok: !game.isClosed() && await game.evaluate(() => G.state === 'paused').catch(() => false), label: 'Annuler : la fenêtre reste, partie en pause' });
    await fermer();
    await game.waitForFunction(() => !document.getElementById('confirm').hidden, null, { timeout: 15000 }).catch(() => {});
    const fermee = game.waitForEvent('close', { timeout: 20000 }).then(() => true, () => false);
    await game.click('#btn-confirm-alt').catch(() => {});
    report({ ok: await fermee, label: '« Quitter sans sauvegarder » : la fenêtre se ferme' });
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
  console.log(failures ? `${failures} échec(s).` : 'Sauvegarder et quitter : conforme (modes manche et entre, refus, reprise, fiabilité, confirmations).');
  process.exit(failures ? 1 : 0);
})();
