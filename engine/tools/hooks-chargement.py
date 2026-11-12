# Points d'accroche du jeu 2.0.7 : temps de chargement (section 43, module src/S6-chargement.js). Exécuté par build.py
# après hooks-machine-de-mort.py. Demande d'Anthony du 11 novembre 2026 : mesurer chez lui le lancement d'une carte
# (ligne « [chargement] » recopiée par le launcher dans launcher.log) et préparer au menu ce qui peut l'être.

# démarrage de la page : la mesure part de l'ouverture de la fenêtre (0) ; le menu montré, attente des premières images
rep("""async function boot(data) {
""", """async function boot(data) {
  CHG.pageMs = performance.now(); chgDebut('démarrage', null, 0);   // jeu 2.0.7 : temps de chargement (section 43)
""")
rep("""  sauveDemarrage();                            // jeu 2.0.7 : sauvegardes (section 29)
""", """  sauveDemarrage();                            // jeu 2.0.7 : sauvegardes (section 29)
  chgMenu();                                   // jeu 2.0.7 : temps de chargement, fin du démarrage (section 43)
""")

# clic sur « Jouer » : départ de la mesure du lancement
rep("""  store.set('zs.map', map.id);
""", """  store.set('zs.map', map.id);
  chgDebut('nouvelle partie', map.id);         // jeu 2.0.7 : temps de chargement (section 43)
""")

# construction du monde
rep("""function loadMap(map) {
""", """function loadMap(map) {
  const chgT = performance.now();              // jeu 2.0.7 : temps de chargement (section 43)
""")
rep("""  resetArms();
  computeFlow(player.k);
}
/* ------------------------------------------------- Sélection de la carte -- */""", """  resetArms();
  computeFlow(player.k);
  chgMonde(map, performance.now() - chgT);     // jeu 2.0.7 : temps de chargement (section 43)
}
/* ------------------------------------------------- Sélection de la carte -- */""")

# mise en place de la partie, puis attente des premières images
rep("""function startGame(save) {
""", """function startGame(save) {
  const chgT = performance.now();              // jeu 2.0.7 : temps de chargement (section 43)
""")
rep("""  if (!SAUVE.reprise) requestLock();           // jeu 2.0.7 : reprise d'une sauvegarde, en pause (section 29)
}""", """  if (!SAUVE.reprise) requestLock();           // jeu 2.0.7 : reprise d'une sauvegarde, en pause (section 29)
  chgMdm(mdmLampesPartie());                   // jeu 2.0.7 : machine de mort recompilée pour l'éclairage de la carte (section 43)
  chgPartie(performance.now() - chgT);         // jeu 2.0.7 : temps de chargement (section 43)
}""")

# chaque image
rep("""function frame(now) {
  requestAnimationFrame(frame);
""", """function frame(now) {
  requestAnimationFrame(frame);
  chgImage();                                  // jeu 2.0.7 : temps de chargement, premières images (section 43)
""")

# construction 3 (12 novembre 2026, choix d'Anthony après ses mesures) : le menu s'ouvre sur Bunker 7 (la dernière carte
# jouée, les Marécages surtout, allongeait chaque démarrage : 14,6 s de construction du marais sur son PC) ; la carte
# d'une reprise demandée par le launcher est construite tout de suite (pas deux cartes de suite)
rep("""  const wanted = (data && data.save && data.save.map) || params.get('map') || store.get('zs.map', null);""",
    """  const wanted = (data && data.save && data.save.map) || chgCarteReprise() || params.get('map') || BUNKER7.id;   // jeu 2.0.7 (section 43)""")
# … la sélection des cartes propose toujours la dernière carte jouée
rep("""  MapSel.sel = MAPS.list.includes(G.mapId) ? G.mapId : MAPS.list[0];""",
    """  const chgDerniere = store.get('zs.map', null);   // jeu 2.0.7 (section 43) : la dernière carte jouée, même si le menu montre Bunker 7
  MapSel.sel = MAPS.list.includes(chgDerniere) ? chgDerniere : MAPS.list.includes(G.mapId) ? G.mapId : MAPS.list[0];""")
# préparations (machine de mort, craies) derrière l'écran de chargement, avant le menu : le menu ne gèle plus
rep("""  G.state = 'menu';
  refreshMenu();
  showScreen('menu');
  requestAnimationFrame(frame);
  sauveDemarrage();""", """  G.state = 'menu';
  refreshMenu();
  chgPreparer();                               // jeu 2.0.7 : préparations du démarrage, avant le menu (section 43)
  showScreen('menu');
  requestAnimationFrame(frame);
  sauveDemarrage();""")
