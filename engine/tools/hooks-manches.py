# Points d'accroche du jeu 2.0.7 : musiques des manches. Exécuté par build.py après hooks-annonceur.py.
# Demandes d'Anthony du 2 novembre 2026 (paquet musiques-manches-arrivee : engine/orig/musiques-manches-arrivee/musique/,
# inséré tel quel). Le branchement est dans le module src/S1-manches.js ; les manches de chiens ne changent pas.

# bus de la musique (réglage « Musique ») pour un module qui joue sa propre musique
rep("""  function suitBus() { return ctx && ctx.state !== 'closed' ? { ctx, sortie: master } : null; }
""", """  function suitBus() { return ctx && ctx.state !== 'closed' ? { ctx, sortie: master } : null; }
  /* jeu 2.0.7 : bus de la musique (réglage « Musique »), pour un module qui joue sa propre musique (section 28) */
  function musiqueBus() { return ctx && ctx.state !== 'closed' ? { ctx, sortie: musicBus } : null; }
""")
rep("""    init, ready, suspend, setVolumes, setMuffle, setListener, startAmbient, setHum, suitBus,
""", """    init, ready, suspend, setVolumes, setMuffle, setListener, startAmbient, setHum, suitBus, musiqueBus,
""")
# début de manche : plus de carillon (décision d'Anthony : « Retire ») ; musique d'arrivée à la première manche de la
# partie ; les musiques se décodent (une fois par contexte audio), bien avant la fin de la manche
rep("""  function roundStart() {
    if (!ctx) return;
    const t = ctx.currentTime, o = out(null, 0.9, 4, musicBus);
    const pad = (f, det) => {
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = det;
      const lp = filt('lowpass', 360, 1); const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 1.4);
      g.gain.setValueAtTime(0.16, t + 3.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.6);
      s.connect(lp); lp.connect(g); g.connect(o); s.start(t); s.stop(t + 5.7);
    };
    pad(55, -9); pad(55, 8); pad(82.4, 0);
    [[0.25, 220], [0.95, 207.65], [1.65, 174.61], [2.6, 146.83]].forEach(([dt, f]) => bell(t + dt, f, 0.3, o, 2.8));
    tone('sine', 92, 38, t + 2.6, 0.9, 0.7, o);
  }
""", """  function roundStart() {
    if (!ctx) return;
    // jeu 2.0.7 : plus de carillon au début des manches (décision d'Anthony du 2 novembre 2026) ; musique d'arrivée
    // au début de la partie, musiques A et B à la fin des manches (section 28)
    manchePrepare();
    mancheDebut();
  }
""")
# fin de manche : musique A ou B au hasard, à la place du carillon (qui reste si aucune n'est encore décodée)
rep("""  function roundEnd() {
    if (!ctx) return;
""", """  function roundEnd() {
    if (!ctx) return;
    if (mancheMusique()) return;               // jeu 2.0.7 : musiques des manches (section 28)
""")
# nouvelle partie (ou reprise) : l'arrivée jouera au début de sa première manche ; décodage lancé
rep("""  G.round = 0; G.roundState = 'pre'; G.roundT = 2.2;
""", """  G.round = 0; G.roundState = 'pre'; G.roundT = 2.2;
  mancheNouvellePartie();                      // jeu 2.0.7 : musique d'arrivée (section 28)
""")
# musique de fin de partie, retour au menu : la musique des manches s'arrête
rep("""  function gameOver() {
    if (!ctx) return;
""", """  function gameOver() {
    if (!ctx) return;
    mancheCoupe();                             // jeu 2.0.7 : musiques des manches (section 28)
""")
rep("""function quitToMenu() {
  Life.save();
""", """function quitToMenu() {
  Life.save();
  mancheCoupe();                               // jeu 2.0.7 : musiques des manches (section 28)
""")
