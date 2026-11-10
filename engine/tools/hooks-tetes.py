# Points d'accroche du jeu 2.0.7 : cinquième easter egg secondaire de Bunker 7, les têtes de zombie au béret (module
# src/HK-tetes.js ; demande d'Anthony du 9 novembre 2026). Exécuté par build.py après hooks-caisses.py.

# tir : après les caisses toxiques
rep("""  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""",
"""  if (!stopped) { const tT = tbRayon(ox, oy, oz, dx, dy, dz, endT + (cxCel >= 0 ? 1.2 : 0)); if (tT >= 0 && (tT <= endT || TB.t.k === cxCel)) { endT = tT; stopped = true; tbTouche(ox + dx * tT, oy + dy * tT, oz + dz * tT); } }   // jeu 2.0.7 : têtes au béret (dans la case pleine d'une machine : on regarde jusque dans la case)
  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""")
# remise à zéro : trois têtes neuves
rep("""  cxRemettre();                                // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)""",
"""  cxRemettre();                                // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)
  tbRemettre();                                // jeu 2.0.7 : têtes au béret (HK-tetes.js)""")
# chaque image : la tête de Quick Revive suit sa machine (retirée à la troisième relève, en solo)
rep("""  cxMaj(dt);                                   // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)""",
"""  cxMaj(dt);                                   // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)
  tbMaj(dt);                                   // jeu 2.0.7 : têtes au béret (HK-tetes.js)""")
