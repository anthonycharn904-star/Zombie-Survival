/* ============================================================ 28 MUSIQUE DES MANCHES ==
   Musiques des manches (jeu 2.0.7, demandes d'Anthony du 2 novembre 2026). Son paquet « musiques-manches-arrivee »
   (engine/orig/musiques-manches-arrivee/musique/ : manche-a.mp3, manche-b.mp3, arrivee.mp3) est inséré tel quel par
   build.py, en base 64 (MANCHE_MUSIQUES) :
   · fin d'une manche (Sound.roundEnd : toutes les cartes, Mod Tools compris) : A ou B au hasard, une chance sur deux
     (« Le changement de manche alternera de son entre le A et le B de façon aléatoire »), à la place du carillon
     synthétisé ; 8,7 s chacune, pour la pause de 9 s entre deux manches ; le carillon reste si aucune n'est décodée ;
   · début de la partie (première manche d'une nouvelle partie, ou d'une partie reprise) : la musique d'arrivée (17 s),
     coupée par A ou B si la manche finit avant elle ;
   · début des autres manches : plus de son (décision d'Anthony : « Retire ») ; la musique de fin de la manche
     précédente fait la transition ;
   · début d'une manche qui suit une manche de chiens (ou toute manche finie sans A ni B) : A ou B au hasard (décision
     d'Anthony du 2 novembre : la manche qui suit les chiens a un son) ;
   · inchangées : les manches de chiens elles-mêmes (dogRoundStart, Sound.dogRoundEnd : « laisse tel quel pour le
     moment ») ;
   · dans le bus de la musique (Sound.musiqueBus : réglage « Musique » ; étouffée avec le reste sur la Lune, à terre et
     en fin de partie, comme le carillon) ;
   · décodage à chaque nouvelle partie et au début des manches (manchePrepare, une fois par contexte audio) ; une
     arrivée demandée pendant le décodage part dès qu'il finit (MANCHE.attente au plus) ;
   · arrêtées par la musique de fin de partie et au retour au menu (mancheCoupe) ;
   · courant rétabli (activatePower : toutes les cartes, Mod Tools compris ; demande d'Anthony du 4 novembre 2026, à la
     place de l'annonce vocale) : courant-retabli-riff-1-mesure.mp3 (engine/orig/courant-retabli/, 6,1 s, clé
     « courant »), par le même lecteur : elle coupe la musique en cours (arrivée, A ou B) et la fin de manche la coupe à
     son tour ; jamais pour un courant rétabli d'office (règle de la carte, partie reprise : powerOnQuiet).
   ============================================================================ */
const MANCHE = {
  gain: 1,                                    // volume avant le réglage « Musique » (1 : le fichier tel quel)
  musiques: ['manche-a', 'manche-b'],         // fin de manche : tirées au hasard, une chance sur deux
  arrivee: 'arrivee',                         // début de la partie
  courant: 'courant',                         // courant rétabli
  debutMax: 10,                               // s de partie : au-delà (partie reprise sur une manche de chiens), pas d'arrivée
  attente: 2,                                 // s : une arrivée encore en décodage au-delà est abandonnée
  debut: false,                               // vrai d'une nouvelle partie jusqu'au début de sa première manche
  fin: null,                                  // dernière manche finie avec A ou B (fin normale, Sound.roundEnd)
  ctx: null, prep: null, buf: {}, src: null, joue: null, err: null,
};
/* Décodage des musiques, une fois par contexte audio ; null sans son ou sans données. */
function manchePrepare() {
  const b = Sound.musiqueBus && Sound.musiqueBus();
  if (!b || typeof MANCHE_MUSIQUES !== 'object' || !MANCHE_MUSIQUES) return null;
  if (MANCHE.prep && MANCHE.ctx === b.ctx) return MANCHE.prep;
  const ctx = b.ctx;
  MANCHE.ctx = ctx; MANCHE.buf = {}; MANCHE.err = null;
  MANCHE.prep = Promise.all([...MANCHE.musiques, MANCHE.arrivee, MANCHE.courant].map((k) => {
    const b64 = MANCHE_MUSIQUES[k];
    if (typeof b64 !== 'string') return null;
    const echec = (e) => { MANCHE.err = `${k} : ${(e && e.message) || e}`; };
    try {
      return sonMp3(ctx, b64).then((buf) => { if (MANCHE.ctx === ctx) MANCHE.buf[k] = buf; }, echec);
    } catch (e) { echec(e); return null; }
  }));
  return MANCHE.prep;
}
/* Arrête la musique en cours. */
function mancheCoupe() {
  const src = MANCHE.src;
  MANCHE.src = null; MANCHE.joue = null;
  if (src) try { src.stop(); } catch (e) { /* déjà finie */ }
}
/* Joue une musique décodée dans le bus de la musique, en coupant la précédente ; false si elle n'est pas prête. */
function mancheJoue(k) {
  const b = Sound.musiqueBus && Sound.musiqueBus(), buf = MANCHE.buf[k];
  if (!b || !buf || MANCHE.ctx !== b.ctx) return false;
  mancheCoupe();
  const src = b.ctx.createBufferSource(), g = b.ctx.createGain();
  src.buffer = buf; g.gain.value = MANCHE.gain;
  src.connect(g); g.connect(b.sortie);
  src.onended = () => { if (MANCHE.src === src) { MANCHE.src = null; MANCHE.joue = null; } };
  src.start();
  MANCHE.src = src; MANCHE.joue = k;
  return true;
}
/* Fin de manche (Sound.roundEnd) : A ou B si elles sont décodées ; false sinon (le carillon d'avant). */
function mancheMusique() {
  MANCHE.fin = G.round;
  const b = Sound.musiqueBus && Sound.musiqueBus();
  if (!b) return false;
  manchePrepare();
  const pretes = MANCHE.ctx === b.ctx ? MANCHE.musiques.filter((k) => MANCHE.buf[k]) : [];
  if (!pretes.length) return false;
  return mancheJoue(pretes[Math.floor(Math.random() * pretes.length)]);
}
/* Nouvelle partie (newGame) : la musique en cours s'arrête ; l'arrivée jouera au début de sa première manche ; décodage
   lancé dès maintenant. */
function mancheNouvellePartie() {
  mancheCoupe();
  MANCHE.debut = true; MANCHE.fin = null;
  manchePrepare();
}
/* Début d'une manche normale (Sound.roundStart) : la musique d'arrivée à la première manche de la partie ; A ou B si la
   manche d'avant n'a pas fini sur A ou B (manche de chiens) ; rien sinon. */
function mancheDebut() {
  const premiere = MANCHE.debut;
  MANCHE.debut = false;
  if (premiere && G.time <= MANCHE.debutMax) { mancheArrivee(); return; }
  if (MANCHE.fin !== G.round - 1) mancheMusique();
}
/* Courant rétabli (activatePower) : sa musique, qui coupe celle en cours ; si elle se décode encore, elle part dès la fin
   du décodage (MANCHE.attente au plus). */
function mancheCourant() {
  if (mancheJoue(MANCHE.courant)) return;
  const prep = manchePrepare();
  if (!prep) return;
  const t0 = performance.now();
  prep.then(() => {
    if (performance.now() - t0 > MANCHE.attente * 1000 || G.state !== 'playing') return;
    mancheJoue(MANCHE.courant);
  });
}
/* Musique d'arrivée ; si elle se décode encore, elle part dès la fin du décodage (MANCHE.attente au plus). */
function mancheArrivee() {
  if (mancheJoue(MANCHE.arrivee)) return;
  const prep = manchePrepare();
  if (!prep) return;
  const t0 = performance.now();
  prep.then(() => {
    if (performance.now() - t0 > MANCHE.attente * 1000 || MANCHE.src || G.state !== 'playing') return;
    mancheJoue(MANCHE.arrivee);
  });
}
