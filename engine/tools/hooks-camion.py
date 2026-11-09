# Points d'accroche du jeu 2.0.7 : deuxième easter egg secondaire de Bunker 7, le camion des abords qu'on détruit
# (module src/HH-camion.js ; demande d'Anthony du 9 novembre 2026). Exécuté par build.py après hooks-quete.py.

# abords : les camions retirés des objets semés (le modèle de la bibliothèque n'est pas touché), puis posés en 3D
rep("""  for (const p of props) { const info = modelParts(p.m); if (info) batches[sectorOf(p.x, p.z)].add(info.parts, matOf(p.x, p.z, p.r, p.s, p.tilt), p.tint); }""",
"""  camChoisir(props);                          // jeu 2.0.7 : camion (HH-camion.js)
  for (const p of props) { if (camProp(p)) continue; const info = modelParts(p.m); if (info) batches[sectorOf(p.x, p.z)].add(info.parts, matOf(p.x, p.z, p.r, p.s, p.tilt), p.tint); }""")
rep("""  horlAbords(group, placed);                  // jeu 2.0.7 : horloge de la gare en 3D (HE-horloge.js)""",
"""  horlAbords(group, placed);                  // jeu 2.0.7 : horloge de la gare en 3D (HE-horloge.js)
  camAbords(group);                            // jeu 2.0.7 : camions en 3D (HH-camion.js)""")
# tirs : après la plaque du disjoncteur et l'horloge, le camion (la traçante s'y arrête)
rep("""  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""",
"""  if (!stopped) { const tC = camRayon(ox, oy, oz, dx, dy, dz, endT); if (tC >= 0) { endT = tC; stopped = true; camTouche(s, ox + dx * tC, oy + dy * tC, oz + dz * tC, tC, dmg, fall, boom); } }   // jeu 2.0.7 : camion
  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;
  if (Math.random() < (def.auto ? 0.5 : 0.85))""")
# explosions (grenades, roquettes, Désintégrateur, balles explosives) : le souffle sur le camion
rep("""  const big = clamp(radius / 4.5, 0.4, 1.6);""",
"""  camExplosion(x, y, z, radius, damage, opts);   // jeu 2.0.7 : camion (HH-camion.js)
  const big = clamp(radius / 4.5, 0.4, 1.6);""")
# projectiles : ils éclatent sur le camion
rep("""    if (hitT <= step || p.life <= 0) {""",
"""    { const tC = camRayon(p.x, p.y, p.z, dx, dy, dz, Math.min(step, hitT)); if (tC >= 0) { hitT = tC; hitZ = null; } }   // jeu 2.0.7 : camion
    if (hitT <= step || p.life <= 0) {""")
# grenades : elles rebondissent sur le camion
rep("""    const gf = NL > 1 || OW.on ? floorBelow(g.x, g.z, g.y + 0.3) : 0;""",
"""    camGrenade(g);                               // jeu 2.0.7 : camion (HH-camion.js)
    const gf = NL > 1 || OW.on ? floorBelow(g.x, g.z, g.y + 0.3) : 0;""")
# Onde de choc
rep("""  const b = wstat(s, 'blast');
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;""",
"""  const b = wstat(s, 'blast');
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  camSouffle(ox, oy, oz, b);                   // jeu 2.0.7 : camion (HH-camion.js)""")
# chaque image et remise à zéro
rep("""  qpMaj(dt);                                   // jeu 2.0.7 : quête principale (HG-quete.js)""",
"""  qpMaj(dt);                                   // jeu 2.0.7 : quête principale (HG-quete.js)
  camMaj(dt);                                  // jeu 2.0.7 : camion (HH-camion.js)""")
rep("""  qpRemettre();                                // jeu 2.0.7 : quête principale (HG-quete.js)""",
"""  qpRemettre();                                // jeu 2.0.7 : quête principale (HG-quete.js)
  camRemettre();                               // jeu 2.0.7 : camion (HH-camion.js)""")
