# Points d'accroche du jeu 2.0.7 : easter egg de l'horloge de la gare, dans les abords de Bunker 7 (module
# src/HE-horloge.js), et bonus « Atout gratuit » des easter eggs (module src/HF-atout-gratuit.js) ; demande d'Anthony
# du 4 novembre 2026. Exécuté par build.py après hooks-debris.py.

# abords : l'ancienne horloge plate retirée de la gare (le modèle de la bibliothèque n'est pas touché)…
rep("""  for (const p of placed) batches[sectorOf(p.fx, p.fz)].add(modelParts(p.id).parts, matOf(p.x, p.z, p.r));""",
"""  for (const p of placed) batches[sectorOf(p.fx, p.fz)].add(horlParts(p.id, modelParts(p.id).parts), matOf(p.x, p.z, p.r));   // jeu 2.0.7 : horloge (HE-horloge.js)""")
# … et l'horloge 3D posée dans le groupe des abords, après le clair de lune (qui lit les couleurs de sommets de ses enfants)
rep("""  group.traverse((m) => { m.raycast = NO_RAYCAST; });""",
"""  horlAbords(group, placed);                  // jeu 2.0.7 : horloge de la gare en 3D (HE-horloge.js)
  group.traverse((m) => { m.raycast = NO_RAYCAST; });""")
# tir : après les zombies (un zombie ou un mur devant arrête la balle), le cadran ; la traçante s'y arrête
rep("""  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;""",
"""  if (!stopped) { const tH = horlRayon(ox, oy, oz, dx, dy, dz, endT); if (tH >= 0) { endT = tH; stopped = true; horlTouche(ox + dx * tH, oy + dy * tH, oz + dz * tH, G.stats.shots); } }   // jeu 2.0.7 : horloge
  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;""")
# bonus « atout gratuit » : jamais tiré au hasard (seulement par les easter eggs)
rep("""  if (!Powerups.bag.length) Powerups.bag = shuffle(Object.keys(POWERUPS));""",
"""  if (!Powerups.bag.length) Powerups.bag = shuffle(Object.keys(POWERUPS).filter((k) => POWERUPS[k].tirage !== false));   // jeu 2.0.7""")
rep("""    if (!Powerups.bag.length) Powerups.bag = shuffle(Object.keys(POWERUPS).filter((k) => k !== 'carpenter'));""",
"""    if (!Powerups.bag.length) Powerups.bag = shuffle(Object.keys(POWERUPS).filter((k) => k !== 'carpenter' && POWERUPS[k].tirage !== false));""")
# … son modèle (la fiole au sol) et son effet (le joueur boit l'atout)
rep("""function buildPowerupModel(type) {
""", """function buildPowerupModel(type) {
  if (type === 'freeperk') return atgModele();   // jeu 2.0.7 : atout gratuit (HF-atout-gratuit.js)
""")
rep("""    case 'carpenter':
      repairAllWindows();
      addPoints(RULES.carpenterPoints, true);
      break;
""", """    case 'carpenter':
      repairAllWindows();
      addPoints(RULES.carpenterPoints, true);
      break;
    case 'freeperk': atgRamasse(); break;   // jeu 2.0.7 : atout gratuit, bu (HF-atout-gratuit.js)
""")
# remise à zéro et chaque image
rep("""  resetDigipass();
""", """  resetDigipass();
  horlRemettre();                              // jeu 2.0.7 : horloge de la gare (HE-horloge.js)
  atgRemettre();                               // jeu 2.0.7 : atout gratuit (HF-atout-gratuit.js)
""")
rep("""  updateDigipass(dt);
}""", """  updateDigipass(dt);
  horlMaj(dt);                                 // jeu 2.0.7 : horloge de la gare (HE-horloge.js)
  atgMaj(dt);                                  // jeu 2.0.7 : atout gratuit, bu (HF-atout-gratuit.js)
}""")
# sons : outils de synthèse prêtés aux modules (l'horloge, et les easter eggs à venir)
rep("""  function hitmark(kill) {
""", """  /* jeu 2.0.7 : outils de synthèse pour les sons des modules (easter eggs : HE-horloge.js) ; null sans son */
  function synthe() { return ctx && ctx.state !== 'closed' ? { ctx, out, tone, noiseHit, bell, filt, musique: musicBus } : null; }
  function hitmark(kill) {
""")
rep("""    elixir, elixirClang, elixirKnock, elixirFelt, elixirBellows, elixirTick, elixirDrip, elixirShot,
  };""", """    elixir, elixirClang, elixirKnock, elixirFelt, elixirBellows, elixirTick, elixirDrip, elixirShot,
    synthe,
  };""")
