# Points d'accroche du jeu 2.0.7 : quatrième easter egg secondaire de Bunker 7, les caisses toxiques (module
# src/HJ-caisses.js ; demande d'Anthony du 9 novembre 2026). Exécuté par build.py après hooks-ampoules.py.

# petites caisses : retirées de la géométrie fondue (mêmes tirages du monde), un maillage chacune
rep("""  // Caisses
  const crates = [];""", """  // Caisses
  CX.liste = [];                               // jeu 2.0.7 : petites caisses à part (HJ-caisses.js)
  const crates = [];""")
rep("""        crates.push({ geo: BOX, matrix: mtx(x + 0.5 + wr(-0.08, 0.08), E + 0.95 + 0.33, z + 0.5 + wr(-0.08, 0.08), 0, wr(-0.5, 0.5), 0, 0.66, 0.66, 0.66), color: [0.85, 0.85, 0.85] });""",
"""        const jx = wr(-0.08, 0.08), jz = wr(-0.08, 0.08), jr = wr(-0.5, 0.5);   // jeu 2.0.7 : mêmes tirages, dans le même ordre
        if (cxIci()) cxPetite(li, x + 0.5 + jx, E + 0.95 + 0.33, z + 0.5 + jz, jr, k);   // caisses toxiques (HJ-caisses.js)
        else crates.push({ geo: BOX, matrix: mtx(x + 0.5 + jx, E + 0.95 + 0.33, z + 0.5 + jz, 0, jr, 0, 0.66, 0.66, 0.66), color: [0.85, 0.85, 0.85] });""")
rep("""  perLevel(cratesLv, MAT.crate);""", """  perLevel(cratesLv, MAT.crate);
  cxConstruire(group);                         // jeu 2.0.7 : petites caisses (HJ-caisses.js)""")
rep("""  const wallT = RAY.t, wallHit = RAY.hit, wallSand = OW.on && RAY.hit && RAY.type >= 16;""",
"""  const wallT = RAY.t, wallHit = RAY.hit, wallSand = OW.on && RAY.hit && RAY.type >= 16;
  const cxCel = RAY.hit ? RAY.cell : -1;      // jeu 2.0.7 : caisses toxiques (la case touchée, avant tout autre rayon)""")
# tir : après les ampoules ; la colonne de la caisse arrête le rayon de la grille : on regarde jusque dans la case
rep("""  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""",
"""  if (!stopped) { const tX = cxRayon(ox, oy, oz, dx, dy, dz, endT + (cxCel >= 0 ? 1.2 : 0)); if (tX >= 0 && (tX <= endT || CX.c.k === cxCel)) { endT = tX; stopped = true; cxTouche(s, ox + dx * tX, oy + dy * tX, oz + dz * tX, dmg, boom); } }   // jeu 2.0.7 : caisses toxiques
  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""")
# explosions
rep("""  camExplosion(x, y, z, radius, damage, opts);   // jeu 2.0.7 : camion (HH-camion.js)""",
"""  camExplosion(x, y, z, radius, damage, opts);   // jeu 2.0.7 : camion (HH-camion.js)
  cxExplosion(x, y, z, radius);                // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)""")
# couteau : la lame arrive sans zombie (onMiss du module : estoc dans le vide, sans sang) : la caisse devant le joueur
rep("""    choisirCible: knifeChoose, onHit: knifeOnHit, degats: KNIFE.damage,""",
"""    choisirCible: knifeChoose, onHit: knifeOnHit, degats: KNIFE.damage,
    onMiss: () => cxCouteauVide(),                            // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)""")
# chaque image et remise à zéro
rep("""  camMaj(dt);                                  // jeu 2.0.7 : camion (HH-camion.js)""",
"""  camMaj(dt);                                  // jeu 2.0.7 : camion (HH-camion.js)
  cxMaj(dt);                                   // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)""")
rep("""  ampRemettre();                               // jeu 2.0.7 : ampoules (HI-ampoules.js)""",
"""  ampRemettre();                               // jeu 2.0.7 : ampoules (HI-ampoules.js)
  cxRemettre();                                // jeu 2.0.7 : caisses toxiques (HJ-caisses.js)""")
