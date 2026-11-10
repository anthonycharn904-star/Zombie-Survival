# Points d'accroche du jeu 2.0.7 : débris payants des cartes en grille (module src/HD-debris.js ; demande d'Anthony du
# 4 novembre 2026, Bunker 7). Exécuté par build.py après hooks-boss-b7.py. Hors des portes « debris », rien ne change.

# construction : un amas de pierres et de rochers, au lieu des caisses, sacs, planches et pavés
rep("""    if (d.type === 'debris') {
      const hw = width / 2;
      for (let i = 0; i < 2; i++) add(MAT.crate, rand(0.78, 0.9), rand(0.75, 0.88), rand(0.7, 0.85), -hw / 2 + i * hw, 0.42, rand(-0.15, 0.15), 0, rand(-0.3, 0.3), 0);
      add(MAT.crate, 0.72, 0.7, 0.7, rand(-0.3, 0.3), 1.18, rand(-0.1, 0.1), 0, rand(-0.5, 0.5), rand(-0.1, 0.1));
      for (let i = 0; i < 5; i++) add(MAT.sandbag, 0.56, 0.22, 0.34, rand(-hw + 0.3, hw - 0.3), 0.11 + (i > 2 ? 0.22 : 0), (i % 2 ? 0.42 : -0.42), 0, rand(-0.3, 0.3), 0);
      for (let i = 0; i < 4; i++) add(MAT.board, width * 1.1, 0.15, 0.05, 0, 1.45 + i * 0.28, rand(-0.3, 0.3), 0, rand(-0.2, 0.2), rand(-0.6, 0.6));
      for (let i = 0; i < 6; i++) { const s = rand(0.22, 0.45); add(MAT.rubble, s, s * 0.8, s, rand(-hw + 0.2, hw - 0.2), rand(0.85, 2.0), rand(-0.3, 0.3), rand(0, 3), rand(0, 3), rand(0, 3)); }
    } else {""", """    if (d.type === 'debris') {
      debConstruire(d, alongX, width, E, id);      // jeu 2.0.7 : amas de pierres et de rochers, charge, traces (HD-debris.js)
    } else {""")
# achat : la charge est posée (l'ouverture vient à l'explosion) ; plus d'achat pendant qu'elle bipe
rep("""      prompt() { return d.opened ? null : { text: `Appuyez sur F pour ${d.verb}`, cost: d.cost }; },
      use() { if (!d.opened && trySpend(d.cost)) openDoor(d); },""",
"""      prompt() { return d.opened || d.charge ? null : { text: `Appuyez sur F pour ${d.verb}`, cost: d.cost }; },   // jeu 2.0.7 : charge posée
      use() { if (!d.opened && !d.charge && trySpend(d.cost)) { if (d.type === 'debris' && d.deb) debPoser(d); else openDoor(d); } },""")
# ouverture d'une porte « debris » (charge, phase 5 du boss, __zs.openAll) : l'explosion, au lieu des pièces qui volent
rep("""  for (const p of d.pieces) {
    if (d.type === 'debris') {
      p.vx = rand(-2.5, 2.5); p.vy = rand(2, 5); p.vz = rand(-2.5, 2.5);""",
"""  if (d.type === 'debris' && d.deb) debExplosion(d);   // jeu 2.0.7 : la charge saute (HD-debris.js)
  else for (const p of d.pieces) {
    if (d.type === 'debris') {
      p.vx = rand(-2.5, 2.5); p.vy = rand(2, 5); p.vz = rand(-2.5, 2.5);""")
# ouverture d'une porte « debris » : sa poussière claire d'origine laisse la place à celle de l'explosion
rep("""  for (let i = 0; i < 4; i++) spawnPuff(d.cx + rand(-0.8, 0.8), d.E + rand(0.3, 1.8), d.cz + rand(-0.8, 0.8), 1.2, 1.4, 0x7d776c, 0.5, 0.3);""",
"""  if (!(d.type === 'debris' && d.deb)) for (let i = 0; i < 4; i++) spawnPuff(d.cx + rand(-0.8, 0.8), d.E + rand(0.3, 1.8), d.cz + rand(-0.8, 0.8), 1.2, 1.4, 0x7d776c, 0.5, 0.3);   // jeu 2.0.7""")
# remise à zéro : plus de charge, d'éclat ni de trace
rep("""      p.m.position.copy(p.pos); p.m.rotation.copy(p.rot); p.m.scale.copy(p.scale);
    }""", """      p.m.position.copy(p.pos); p.m.rotation.copy(p.rot); p.m.scale.copy(p.scale);
    }
    debRemettre(d);                               // jeu 2.0.7 : débris (HD-debris.js)""")
# chaque image : charges, éclats, traces d'une partie restaurée
rep("""function updateDoors(dt) {
""", """function updateDoors(dt) {
  debMaj(dt);                                   // jeu 2.0.7 : débris (HD-debris.js)
""")
# sauvegarde : une charge posée compte comme une porte ouverte (les points sont dépensés ; elle saute dans les 3 s)
rep("""    doors: Object.keys(World.doors).filter((id) => World.doors[id].opened),""",
"""    doors: Object.keys(World.doors).filter((id) => World.doors[id].opened || World.doors[id].charge),""")   # la ligne continue : pas de commentaire JS
# … et ce passage compte déjà dans les statistiques sauvegardées (openDoor, qui le compte, ne passera pas à la restauration)
rep("""    stats: Object.assign({}, G.stats), cheat: G.cheat, rank: G.rankStart,""",
"""    stats: Object.assign({}, G.stats, { doors: G.stats.doors + Object.values(World.doors).filter((d) => d.charge && !d.opened).length }), cheat: G.cheat, rank: G.rankStart,   // jeu 2.0.7 : charges posées""")
# bips de la charge placés dans l'espace (le digi pass appelle toujours keypad(kind), sans place : inchangé)
rep("""  function keypad(kind = 'key') {
    if (!ctx) return;
    const t = ctx.currentTime, o = out(null, kind === 'key' ? 0.1 : 0.2);""",
"""  function keypad(kind = 'key', pos = null) {   // jeu 2.0.7 : pos, la charge des débris (HD-debris.js)
    if (!ctx) return;
    const t = ctx.currentTime, o = out(pos, (kind === 'key' ? 0.1 : 0.2) * (pos ? 2.5 : 1));
    if (!o) return;""")
