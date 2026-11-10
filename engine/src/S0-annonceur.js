/* ===================================================================== 27 ANNONCEUR ==
   Voix enregistrées de l'annonceur des bonus (jeu 2.0.7, demande d'Anthony du 2 novembre 2026 : « que tu changes
   […] l'annonceur quand le joueur récupère des bonus »). Son paquet « annonceur-voix-B » (engine/orig/annonceur-voix-B/
   voix/ : neuf MP3) est inséré tel quel par build.py, en base 64, dans un script de données (ANNONCEUR_VOIX : nom du
   fichier sans « .mp3 » → contenu) ; ce module le branche sur le jeu :
   · au ramassage d'un bonus (applyPowerup : toutes les cartes, Mod Tools compris), la voix enregistrée remplace la
     synthèse vocale du navigateur ; même réglage (« Voix d'annonce des bonus », settings.voice) ; une annonce coupe
     la précédente, comme la synthèse (speechSynthesis.cancel) ; règles et effets des bonus inchangés ; le bonus
     « Double points » s'appelle « Points doubles », comme sa voix (hooks-annonceur.py) ;
   · son dans le graphe du jeu (volume général, compresseur), par le bus de la combinaison (Sound.suitBus : après le
     filtre de l'étouffement) : la voix reste claire sur la Lune et à terre, comme la synthèse, qui ne passait pas par
     le filtre (choix d'Anthony du 2 novembre) ; ANNONCE.bus = 'effets' la mettrait avec les bruits du jeu ;
   · les voix se décodent à l'apparition d'un bonus (annoncePrepare, une fois par contexte audio), avant son
     ramassage ; une annonce demandée pendant le décodage part dès qu'il finit (ANNONCE.attente au plus) ;
   · un bonus sans voix enregistrée, une voix illisible, un jeu sans son : synthèse vocale d'avant (Sound.say, texte
     POWERUPS[type].say).
   Les voix des bonus à venir sont déjà là (décision d'Anthony du 2 novembre : « les bonus en question sortiront
   ultérieurement ») : un bonus créé dans POWERUPS sous le nom freeperk, firesale ou bonuspoints aura sa voix sans
   autre changement (deathmachine, la machine de mort, l'a reçue le 4 novembre : section 32) ; seules les voix des
   bonus du jeu se décodent.
   ============================================================================ */
const ANNONCE = {
  gain: 1,                                    // volume de la voix avant le volume général (1 : le fichier tel quel)
  bus: 'combinaison',                         // 'combinaison' (Sound.suitBus, jamais étouffée) ou 'effets' (Sound.bus)
  attente: 1.5,                               // s : une annonce encore en décodage au-delà est abandonnée
  voix: {
    ammo: 'munitions-max', insta: 'mort-instantanee', double: 'points-doubles', nuke: 'kaboum', carpenter: 'charpentier',
    // bonus à venir
    freeperk: 'atout-gratuit', firesale: 'liquidation', deathmachine: 'machine-de-mort', bonuspoints: 'points-bonus',
  },
  ctx: null, prep: null, buf: {}, src: null, joue: null, err: null,
};
const annonceBus = () => (ANNONCE.bus === 'effets' || !Sound.suitBus ? Sound.bus() : Sound.suitBus());
/* MP3 en base 64 → AudioBuffer (promesse) ; sert aussi aux musiques des manches (section 28). */
function sonMp3(ctx, b64) {
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return ctx.decodeAudioData(u8.buffer);
}
/* Décodage des voix des bonus du jeu, une fois par contexte audio ; null sans son (contexte pas encore créé) ou sans
   données. */
function annoncePrepare() {
  const b = annonceBus();
  if (!b || typeof ANNONCEUR_VOIX !== 'object' || !ANNONCEUR_VOIX) return null;
  if (ANNONCE.prep && ANNONCE.ctx === b.ctx) return ANNONCE.prep;
  const ctx = b.ctx;
  ANNONCE.ctx = ctx; ANNONCE.buf = {}; ANNONCE.err = null;
  ANNONCE.prep = Promise.all(Object.keys(ANNONCE.voix).filter((type) => POWERUPS[type]).map((type) => {
    const b64 = ANNONCEUR_VOIX[ANNONCE.voix[type]];
    if (typeof b64 !== 'string') return null;
    const echec = (e) => { ANNONCE.err = `${ANNONCE.voix[type]} : ${(e && e.message) || e}`; };
    try {
      return sonMp3(ctx, b64).then((buf) => { if (ANNONCE.ctx === ctx) ANNONCE.buf[type] = buf; }, echec);
    } catch (e) { echec(e); return null; }
  }));
  return ANNONCE.prep;
}
/* Coupe l'annonce en cours (voix enregistrée ou synthèse). */
function annonceCoupe() {
  const src = ANNONCE.src;
  ANNONCE.src = null; ANNONCE.joue = null;
  if (src) try { src.stop(); } catch (e) { /* déjà finie */ }
  if ('speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) { /* synthèse indisponible */ }
}
/* Joue la voix d'un bonus si elle est décodée ; false sinon. */
function annonceJoue(type) {
  const b = annonceBus(), buf = ANNONCE.buf[type];
  if (!b || !buf || ANNONCE.ctx !== b.ctx) return false;
  annonceCoupe();
  const src = b.ctx.createBufferSource(), g = b.ctx.createGain();
  src.buffer = buf; g.gain.value = ANNONCE.gain;
  src.connect(g); g.connect(b.sortie);
  src.onended = () => { if (ANNONCE.src === src) { ANNONCE.src = null; ANNONCE.joue = null; } };
  src.start();
  ANNONCE.src = src; ANNONCE.joue = type;
  return true;
}
/* Annonce d'un bonus ramassé (applyPowerup) : la voix enregistrée, sinon la synthèse d'avant. */
function annonceBonus(type) {
  if (!settings.voice) return;
  const say = () => { const p = POWERUPS[type]; if (p && p.say) Sound.say(p.say); };
  if (annonceJoue(type)) return;
  const prep = ANNONCE.voix[type] ? annoncePrepare() : null;
  if (!prep) { say(); return; }
  const t0 = performance.now();
  prep.then(() => {
    if (!settings.voice || performance.now() - t0 > ANNONCE.attente * 1000) return;
    if (!annonceJoue(type)) say();
  });
}
