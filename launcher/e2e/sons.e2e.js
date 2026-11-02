'use strict';
/* Sons du jeu 2.0.7, dans la fenêtre du jeu du launcher.
   Annonceur des bonus : neuf voix du paquet annonceur-voix-B d'Anthony insérées telles quelles (tailles d'origine),
   dont quatre pour des bonus à venir ; les cinq des bonus du jeu décodées une fois, à l'apparition d'un bonus ; au
   ramassage, la voix du bonus à la place de la synthèse vocale, dans le bus de la combinaison (jamais étouffée) ; une
   annonce coupe l'autre ; réglage « Voix d'annonce des bonus » respecté ; bonus sans voix : synthèse d'avant ;
   « Points doubles » au bandeau et dans les bonus actifs.
   Musiques des manches (paquet musiques-manches-arrivee, tailles d'origine) : décodées dès la nouvelle partie ; musique
   d'arrivée au début de la première manche ; plus de carillon au début des manches ; à la fin d'une manche, A ou B au
   hasard à la place du carillon, dans le bus de la musique, qui coupe l'arrivée ; A ou B au début de la manche qui
   suit une manche de chiens ; arrêtées en fin de partie et au retour au menu ; manches de chiens inchangées ; rendu
   sans erreur.
     xvfb-run -a node e2e/sons.e2e.js   (Linux sans écran) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EXE = require('electron');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zs-e2e-sons-'));
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
    (await game.evaluate(() => {
      const out = [];
      const ok = (cond, label, extra) => out.push({ ok: !!cond, label, extra });
      const taille = (b64) => (b64.length * 3) / 4 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
      // durées (ffprobe) et tailles des fichiers d'origine
      const VOIX = { ammo: ['munitions-max', 3.576, 72045], insta: ['mort-instantanee', 3.96, 79725], double: ['points-doubles', 3.264, 65805],
        nuke: ['kaboum', 3.216, 64845], carpenter: ['charpentier', 3.432, 69165] };
      const A_VENIR = { freeperk: ['atout-gratuit', 73005], firesale: ['liquidation', 71085], deathmachine: ['machine-de-mort', 73965], bonuspoints: ['points-bonus', 68205] };
      const MUSIQUES = { arrivee: [17.088, 410733], 'manche-a': [8.664, 208557], 'manche-b': [8.664, 208557] };
      ok(typeof ANNONCEUR_VOIX === 'object' && Object.keys(ANNONCEUR_VOIX).length === 9
        && Object.keys(VOIX).every((t) => ANNONCE.voix[t] === VOIX[t][0] && taille(ANNONCEUR_VOIX[VOIX[t][0]] || '') === VOIX[t][2])
        && Object.keys(A_VENIR).every((t) => ANNONCE.voix[t] === A_VENIR[t][0] && taille(ANNONCEUR_VOIX[A_VENIR[t][0]] || '') === A_VENIR[t][1]),
      'neuf voix du paquet annonceur-voix-B, à leur taille d’origine (quatre pour des bonus à venir)', Object.keys(ANNONCEUR_VOIX || {}));
      ok(typeof MANCHE_MUSIQUES === 'object' && Object.keys(MANCHE_MUSIQUES).sort().join() === 'arrivee,manche-a,manche-b'
        && Object.keys(MUSIQUES).every((k) => taille(MANCHE_MUSIQUES[k]) === MUSIQUES[k][1]), 'musiques A, B et arrivée, à leur taille d’origine', Object.keys(MANCHE_MUSIQUES || {}));
      ok(/annonceBonus\(type\)/.test(applyPowerup.toString()) && !/Sound\.say/.test(applyPowerup.toString()) && /annoncePrepare\(\)/.test(spawnPowerup.toString()),
        'ramassage : annonceBonus à la place de la synthèse ; apparition : décodage des voix');
      ok(POWERUPS.double.name === 'Points doubles' && POWERUPS.double.say === 'Points doubles !', 'bonus « Points doubles » (comme sa voix)');
      // nouvelle partie : décodage des musiques lancé, arrivée au début de la première manche
      Sound.init(); settings.voice = true;
      __zs.start(); __zs.god(true);
      if (G.state === 'paused') { showScreen(null); G.state = 'playing'; }
      const prepM = MANCHE.prep;
      ok(MANCHE.debut === true && prepM && MANCHE.ctx === Sound.musiqueBus().ctx && Sound.musiqueBus().sortie !== Sound.bus().sortie && Sound.musiqueBus().sortie !== Sound.suitBus().sortie,
        'nouvelle partie : arrivée prévue, décodage des musiques lancé (bus de la musique)');
      for (let i = 0; i < 400 && G.round < 1; i++) __zs.step(1, 1 / 60);
      G.roundState = 'pre'; G.roundT = 1e9; G.spawnT = 1e9; clearZombies();
      ok(G.round === 1 && MANCHE.debut === false, `première manche commencée (${G.time.toFixed(1)} s de partie)`);
      G.timers.double = 5; __zs.step(2, 1 / 60);
      const pu = document.getElementById('pu-active').textContent;
      G.timers.double = 0;
      ok(/Points doubles/.test(pu) && !/Double points/.test(pu), `bonus actifs : « ${pu.replace(/\s+/g, ' ').trim()} »`);
      ANNONCE.prep = null; ANNONCE.ctx = null;
      spawnPowerup('ammo', player.pos.x + 30, player.pos.z + 30, player.gy);
      const prepV = ANNONCE.prep;
      ok(prepV && ANNONCE.ctx === Sound.suitBus().ctx, 'apparition d’un bonus : décodage des voix lancé');
      clearPowerups();
      return Promise.all([prepV, prepM]).then(() => {
        const pic = (b) => { const d = b.getChannelData(0); let m = 0; for (let i = 0; i < d.length; i += 7) m = Math.max(m, Math.abs(d[i])); return m; };
        for (const t of Object.keys(VOIX)) {
          const b = ANNONCE.buf[t], p = b ? pic(b) : 0;
          ok(b && Math.abs(b.duration - VOIX[t][1]) < 0.15 && p > 0.5, `${VOIX[t][0]}.mp3 décodé : ${b ? b.duration.toFixed(3) : '—'} s, crête ${p.toFixed(2)}`);
        }
        ok(Object.keys(A_VENIR).every((t) => !ANNONCE.buf[t]) && !ANNONCE.err, 'voix des bonus à venir non décodées (bonus absents), aucune voix illisible', ANNONCE.err);
        for (const k of Object.keys(MUSIQUES)) {
          const b = MANCHE.buf[k], p = b ? pic(b) : 0;
          ok(b && Math.abs(b.duration - MUSIQUES[k][0]) < 0.15 && p > 0.5, `${k}.mp3 décodée : ${b ? b.duration.toFixed(3) : '—'} s, crête ${p.toFixed(2)}`);
        }
        ok(!MANCHE.err, 'aucune musique illisible', MANCHE.err);
        // branchements : source → son gain → bus
        const paires = [], c0 = AudioNode.prototype.connect;
        const espion = () => { paires.length = 0; AudioNode.prototype.connect = function (n, ...r) { paires.push([this, n]); return c0.call(this, n, ...r); }; };
        const fin = () => { AudioNode.prototype.connect = c0; };
        const vers = (src, sortie) => { const g = (paires.find(([a]) => a === src) || [])[1]; return !!g && paires.some(([a, n]) => a === g && n === sortie); };
        let osc = 0;
        const o0 = BaseAudioContext.prototype.createOscillator;
        const compte = () => { osc = 0; BaseAudioContext.prototype.createOscillator = function (...r) { osc++; return o0.apply(this, r); }; };
        const finCompte = () => { BaseAudioContext.prototype.createOscillator = o0; };
        const arr = MANCHE.src;
        ok(MANCHE.joue === 'arrivee' && arr && arr.buffer === MANCHE.buf.arrivee, 'début de la première manche : musique d’arrivée', MANCHE.joue);
        const r0 = G.round;
        G.round = 2; MANCHE.fin = 1;                      // la manche 1 a fini sur A ou B
        compte();
        try { Sound.roundStart(); } finally { finCompte(); }
        ok(osc === 0 && MANCHE.src === arr, 'début d’une manche normale : plus de carillon, rien de nouveau (l’arrivée continue)', { osc });
        G.round = r0;
        // ramassage : voix enregistrée, sans synthèse, dans le bus de la combinaison
        const say0 = Sound.say, dits = [];
        Sound.say = (t) => dits.push(t);
        espion();
        try { applyPowerup('ammo'); } finally { fin(); }
        const s1 = ANNONCE.src;
        ok(ANNONCE.joue === 'ammo' && s1 && s1.buffer === ANNONCE.buf.ammo && dits.length === 0 && vers(s1, Sound.suitBus().sortie),
          'Munitions max ramassé : voix enregistrée, bus de la combinaison, pas de synthèse', { joue: ANNONCE.joue, dits });
        let coupee = false;
        const stop0 = s1.stop.bind(s1); s1.stop = () => { coupee = true; stop0(); };
        annonceBonus('insta');
        ok(coupee && ANNONCE.joue === 'insta' && ANNONCE.src.buffer === ANNONCE.buf.insta, 'Mort instantanée coupe Munitions max');
        const suite = ['double', 'nuke', 'carpenter'].map((t) => { annonceBonus(t); return ANNONCE.joue === t && ANNONCE.src.buffer === ANNONCE.buf[t]; });
        ok(suite.every(Boolean) && dits.length === 0, 'Points doubles, Kaboum, Charpentier : leur voix', suite);
        annonceCoupe(); settings.voice = false; annonceBonus('ammo'); const muet = ANNONCE.joue === null && dits.length === 0; settings.voice = true;
        ok(muet, '« Voix d’annonce des bonus » décochée : aucune annonce');
        POWERUPS.essai = { name: 'Essai', say: 'Essai !' }; annonceBonus('essai'); delete POWERUPS.essai;
        ok(dits.length === 1 && dits[0] === 'Essai !', 'bonus sans voix enregistrée : synthèse vocale d’avant', dits);
        annonceCoupe(); Sound.say = say0;
        // fin de manche : A ou B au hasard, sans le carillon, dans le bus de la musique ; elle coupe l'arrivée
        let arrCoupee = false;
        const stopA = arr.stop.bind(arr); arr.stop = () => { arrCoupee = true; stopA(); };
        compte(); espion();
        try { G.roundState = 'active'; G.dogRound = false; G.total = 1; G.killed = 1; endRound(); } finally { fin(); finCompte(); }
        const m1 = MANCHE.src;
        ok(/^manche-[ab]$/.test(MANCHE.joue || '') && m1 && m1.buffer === MANCHE.buf[MANCHE.joue] && osc === 0 && vers(m1, Sound.musiqueBus().sortie) && arrCoupee,
          `fin de manche : musique « ${MANCHE.joue} », bus de la musique, sans le carillon ; elle coupe l’arrivée`, { joue: MANCHE.joue, osc, arrCoupee });
        const vus = new Set([MANCHE.joue]);
        for (let i = 0; i < 40; i++) { Sound.roundEnd(); vus.add(MANCHE.joue); }
        ok(vus.has('manche-a') && vus.has('manche-b'), `A et B tirées au hasard (41 fins de manche : ${[...vus].join(', ')})`);
        Sound.gameOver();
        ok(MANCHE.joue === null && MANCHE.src === null, 'musique de fin de partie : la musique des manches s’arrête');
        compte();
        try { Sound.dogRoundEnd(); } finally { finCompte(); }
        ok(MANCHE.joue === null && osc > 0, 'manche de chiens : son d’avant, inchangé');
        // manche qui suit une manche de chiens : A ou B à son début
        const r1 = G.round;
        G.round = 7; MANCHE.fin = 5;                      // la manche 6 était une manche de chiens
        compte(); espion();
        try { Sound.roundStart(); } finally { fin(); finCompte(); }
        ok(/^manche-[ab]$/.test(MANCHE.joue || '') && osc === 0 && vers(MANCHE.src, Sound.musiqueBus().sortie), `début de la manche qui suit une manche de chiens : « ${MANCHE.joue} »`, { joue: MANCHE.joue, osc });
        // partie reprise sur une manche de chiens : pas d'arrivée au milieu de la partie, A ou B à la manche suivante
        mancheCoupe(); MANCHE.debut = true; MANCHE.fin = null; const t0 = G.time; G.time = 100; Sound.roundStart(); G.time = t0;
        ok(/^manche-[ab]$/.test(MANCHE.joue || '') && MANCHE.debut === false, 'première manche normale après 10 s de partie : pas d’arrivée, A ou B', MANCHE.joue);
        G.round = r1;
        Sound.roundEnd(); const avantMenu = MANCHE.joue;
        quitToMenu();
        ok(avantMenu && MANCHE.joue === null && MANCHE.src === null, 'retour au menu : la musique des manches s’arrête');
        renderEnabled = true; render(); renderEnabled = false;
        return out;
      });
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
  console.log(failures ? `${failures} échec(s).` : 'Sons 2.0.7 : conformes (voix et musiques d’origine, décodage, ramassage, arrivée, fins de manche, coupures, réglage, replis).');
  process.exit(failures ? 1 : 0);
})();
