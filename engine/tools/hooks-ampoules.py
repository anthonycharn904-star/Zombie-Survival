# Points d'accroche du jeu 2.0.7 : troisième easter egg secondaire de Bunker 7, les ampoules des lampes (module
# src/HI-ampoules.js ; demande d'Anthony du 9 novembre 2026). Exécuté par build.py après hooks-camion.py.

# tir : après le camion, les ampoules (la balle s'y arrête)
rep("""  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""",
"""  if (!stopped) { const tA = ampRayon(ox, oy, oz, dx, dy, dz, endT); if (tA >= 0) { endT = tA; stopped = true; ampTouche(ox + dx * tA, oy + dy * tA, oz + dz * tA, G.stats.shots); } }   // jeu 2.0.7 : ampoules
  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""")
# lampes : le scintillement, après la quête
rep("""  qpLumieres(dt);                              // jeu 2.0.7 : coupure et lockdowns de la quête (HG-quete.js)""",
"""  qpLumieres(dt);                              // jeu 2.0.7 : coupure et lockdowns de la quête (HG-quete.js)
  ampLumieres(dt);                             // jeu 2.0.7 : ampoules qui scintillent (HI-ampoules.js)""")
# remise à zéro
rep("""  camRemettre();                               // jeu 2.0.7 : camion (HH-camion.js)""",
"""  camRemettre();                               // jeu 2.0.7 : camion (HH-camion.js)
  ampRemettre();                               // jeu 2.0.7 : ampoules (HI-ampoules.js)""")
