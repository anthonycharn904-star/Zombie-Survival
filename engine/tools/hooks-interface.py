# Points d'accroche de la refonte de l'interface du jeu (chantier interface). Exécuté par build.py après
# hooks-points.py. Demande d'Anthony du 2 novembre 2026 ; plan et décisions : docs/plan-interface-jeu.md.
# Le module src/I0-interface.js déplace les éléments du jeu 1.9.0 dans la nouvelle mise en page (mêmes
# identifiants, mêmes écouteurs) ; ces accroches ne visent aucune ligne retouchée par les autres chantiers.

# styles : engine/interface/interface.css, inséré tel quel à la fin de la feuille du jeu
css = open(os.path.join(KH, 'interface', 'interface.css'), encoding='utf-8').read()
if '</style' in css.lower():
    sys.exit('engine/interface/interface.css contient une balise de fin de style')
ins_before("""</style>
</head>""", css.rstrip('\n') + '\n')

# mise en page, options et clavier : une fois, après les écouteurs du jeu
ins_after("""  bindUI();
""", """  ifcMonter();                                  // refonte de l'interface : menu vertical, sélection en trois zones
""")
# chaque écran qui s'ouvre : rapport de la carte, dossiers de la sélection, fond figé
ins_after("""function showScreen(id) {
""", """  ifcEcran(id);                                 // refonte de l'interface
""")
# carte choisie : aperçu et fiche de la sélection
ins_after("""  MapSel.sel = id;
""", """  ifcChoix(id);                                 // refonte de l'interface : aperçu et fiche
""")
# fond du menu figé sous un écran opaque, ou en image fixe (réglage « Fond du menu »)
ins_after("""  if (!renderEnabled) return;
""", """  if (ifcFige()) return;                        // refonte de l'interface : la dernière image reste à l'écran
""")
# balancement de la caméra du menu arrêté si les animations sont réduites
rep("""  const t = G.menuT * 0.11, v = menuView();""",
    """  const t = ifcBalance(G.menuT) * 0.11, v = menuView();   // refonte de l'interface : animations réduites""")
# écran de chargement au démarrage : « Ouverture du jeu… » (demande d'Anthony du 3 novembre 2026)
rep("""<div id="loading" class="screen">Ouverture du bunker…</div>""",
    """<div id="loading" class="screen">Ouverture du jeu…</div>""")
# Échap dans la pause reprend la partie, comme P (demande d'Anthony du 3 novembre 2026) ; ifcEchapReprend ignore
# l'Échap qui arrive juste après l'ouverture de la pause (la touche qui a libéré la souris verrouillée)
rep("""    else if (G.state === 'paused' && e.code === 'KeyP') resumeGame();""",
    """    else if (G.state === 'paused' && (e.code === 'KeyP' || ifcEchapReprend(e))) ifcReprendre(e);   // refonte de l'interface : Échap reprend""")
rep("""<dt>Échap</dt><dd>Pause</dd>""", """<dt>Échap</dt><dd>Pause · reprendre</dd>""")
