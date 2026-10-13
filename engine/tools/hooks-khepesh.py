# Jeu 2.0.4 refait (13 octobre 2026) : le khépesh, arme de corps-à-corps de Khamsin
# (src/P0-khepesh.js : le module du fichier d'Anthony ; src/P1-khepesh-jeu.js : règles du jeu).
# Exécuté par build.py après hooks-libs.py : V et E frappent avec le khépesh sur Khamsin (et les cartes
# faites à partir d'elle), le couteau ailleurs. Construction 1 du jeu 2.0.4 : le khépesh (aussi dans le
# Désert vierge) ; construction 2 : sur Khamsin seulement (décision d'Anthony du 13 octobre, 23 h 39).
# Le launcher remplace un jeu installé de construction plus ancienne.
rep("""const EDITOR_API = 9;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles, 6 : décor des lieux, 7 : surfaces du décor, matières, plus de pièce fixe, 8 : intérieur des pyramides, prix des herses (jeu 2.0.3, launcher 1.3.2) ; 9 : bibliothèques de textures et de modèles (jeu 2.0.4, launcher 1.3.3)
""", """const EDITOR_API = 9;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles, 6 : décor des lieux, 7 : surfaces du décor, matières, plus de pièce fixe, 8 : intérieur des pyramides, prix des herses (jeu 2.0.3, launcher 1.3.2) ; 9 : bibliothèques de textures et de modèles (jeu 2.0.4, launcher 1.3.3)
/* Construction du jeu, à numéro et interface égaux : le launcher remplace un jeu installé de construction
   plus ancienne (1 : jeu 2.0.4 refait le 13 octobre 2026, le khépesh de Khamsin ; 2 : le khépesh sur
   Khamsin seulement, le Désert vierge garde le couteau, décision d'Anthony du 13 octobre, 23 h 39). */
const GAME_BUILD = 2;
""")
rep("  version: GAME_VERSION, editorApi: EDITOR_API, ready: false,",
    "  version: GAME_VERSION, editorApi: EDITOR_API, build: GAME_BUILD, ready: false,")

# menu : « V ou E » dit l'arme de la carte choisie (khMenuTips)
rep("<dt>V ou E</dt><dd>Couteau</dd>", '<dt>V ou E</dt><dd id="key-melee">Couteau</dd>')

# V ou E : le khépesh sur Khamsin, le couteau ailleurs
rep("""/* V ou E : coup de couteau (module « Fossoyeur ») ; pendant le retour en garde, un nouvel appui relance
   un coup aussitôt ; pendant l'estoc, il ne compte pas. Le coup annule un rechargement en cours, comme avant. */
function startKnife() {
  if (player.down || !Couteau) return;
  if (Arms.state === 'knife') { Couteau.frapper(); return; }
  if (!['idle', 'reload', 'swapIn'].includes(Arms.state)) return;
  Couteau.regler({ hauteurSol: player.gy });
  if (Couteau.frapper()) { Arms.state = 'knife'; Arms.t = 0; Arms.dur = 0; }
}""", """/* V ou E : coup de couteau (module « Fossoyeur ») ; sur Khamsin, coup de khépesh (jeu 2.0.4,
   meleeMod) ; pendant le retour en garde, un nouvel appui relance un coup aussitôt ; pendant l'estoc, il
   ne compte pas. Le coup annule un rechargement en cours, comme avant. */
function startKnife() {
  if (player.down) return;
  const M = meleeMod();
  if (!M) return;
  if (Arms.state === 'knife') { M.frapper(); return; }
  if (!['idle', 'reload', 'swapIn'].includes(Arms.state)) return;
  M.regler({ hauteurSol: player.gy });
  if (M.frapper()) { Arms.state = 'knife'; Arms.t = 0; Arms.dur = 0; }
}""")
rep("""    case 'knife':
      if (player.down) { Couteau.annuler(); KnifeLunge.m = 0; Arms.state = 'idle'; break; }
      knifeLungeStep(dt);
      if (!Couteau.occupe) Arms.state = 'idle';
      break;""", """    case 'knife': {
      const M = meleeCur();                              // le khépesh sur Khamsin (jeu 2.0.4), sinon le couteau
      if (!M || player.down) { if (M) M.annuler(); KnifeLunge.m = 0; Arms.state = 'idle'; break; }
      knifeLungeStep(dt);
      if (!M.occupe) Arms.state = 'idle';
      break;
    }""")
rep("""  else if (st === 'knife') { const q = Couteau ? Couteau.abaissementArme : 0; y -= 0.34 * q; rx -= 0.95 * q; }   // sous la vue""",
    """  else if (st === 'knife') { const M = meleeCur(), q = M ? M.abaissementArme : 0; y -= 0.34 * q; rx -= 0.95 * q; }   // sous la vue""")
rep("""  if (Couteau) { Couteau.annuler(); Couteau.sangSurLame = 0; }   // nouvelle partie : lame propre""",
    """  if (Couteau) { Couteau.annuler(); Couteau.sangSurLame = 0; }   // nouvelle partie : lame propre
  khepeshClear();                                                  // khépesh rangé, sang effacé (jeu 2.0.4)""")
rep("""  if (Couteau) Couteau.retirerSecousse();      // (secousse coupée ; utile si on la remet : la vue est refaite ici)""",
    """  if (Couteau) Couteau.retirerSecousse();      // (secousse coupée ; utile si on la remet : la vue est refaite ici)
  if (Khepesh) Khepesh.retirerSecousse();""")
rep("""  if (Couteau) Couteau.update(dt);
""", """  if (Couteau) Couteau.update(dt);
  if (Khepesh && khepeshOn()) { Khepesh.regler({ hauteurSol: player.gy }); Khepesh.update(dt); }   // jeu 2.0.4 : le khépesh de Khamsin
""")
rep("""    if (Couteau) Couteau.rendreVue(renderer);   // le bras au couteau, par-dessus""",
    """    if (Couteau) Couteau.rendreVue(renderer);   // le bras au couteau, par-dessus
    if (Khepesh) Khepesh.rendreVue(renderer);   // le bras au khépesh (Khamsin), par-dessus""")
# partie de test des Mod Tools : retour à l'éditeur sans le sang de la partie
rep("""  stopTest() {
    exitLock();
    clearZombies(); clearFX();""", """  stopTest() {
    exitLock();
    clearZombies(); clearFX(); khepeshClear();""")
