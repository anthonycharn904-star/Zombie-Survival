# Marécages Maudits : retouches du moteur écrites pour l'intégration (elles ne viennent pas du kit).
# Décision d'Anthony du 2 novembre 2026 : dans le marais, les secousses et à-coups de la vue venus du jeu de base
# (coups reçus, morsures, grenades et explosions, Glas, véhicules) sont coupés tant que settings.shake n'est pas réglé ;
# les autres cartes ne changent pas (maSecousseVue, src/ma00_confort.js, vaut 1 hors du marais).
# Appliquées par etape.py après celles du kit, contrôlées de la même façon (retouches/controle.py). Données seulement.
PATCHES = [
 ('confort : secousse de la vue',
  "  const sh = FX.shake * FX.shake;\n  camera.rotation.order = 'YXZ';\n",
  "  const sh = FX.shake * FX.shake * maSecousseVue();       // confort (Marécages, ma00) : coupée dans le marais, sauf si réglée\n  camera.rotation.order = 'YXZ';\n"),
 ('confort : à-coup des coups reçus',
  "  const look = p.pitch + p.recoil + p.punch, ht = Arms.headTilt;\n",
  "  const look = p.pitch + p.recoil + p.punch * maSecousseVue(), ht = Arms.headTilt;   // confort (Marécages, ma00) : le recul de l'arme reste\n"),
 ('confort : secousse des véhicules',
  "  if (FX.shake > 0.01) { const sh = FX.shake * FX.shake; camera.rotation.x += rand(-1, 1) * sh * 0.02; camera.rotation.y += rand(-1, 1) * sh * 0.02; }\n",
  "  if (FX.shake > 0.01 && maSecousseVue()) { const sh = FX.shake * FX.shake; camera.rotation.x += rand(-1, 1) * sh * 0.02; camera.rotation.y += rand(-1, 1) * sh * 0.02; }   // confort (Marécages, ma00)\n"),
]
