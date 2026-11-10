# Points d'accroche du jeu 2.0.7 : easter egg principal de Bunker 7 (module src/HG-quete.js ; demande d'Anthony du
# 9 novembre 2026). Exécuté par build.py après hooks-horloge.py.

# disjoncteur : pas de rallumage tant que la quête ne le permet pas ; au rallumage, la quête reprend la main
rep("""    prompt() { return G.power ? null : { text: 'Appuyez sur F pour rétablir le courant' }; },
    use() { if (!G.power) activatePower(); },""",
"""    prompt() { return G.power || qpBloqueCourant() ? null : { text: 'Appuyez sur F pour rétablir le courant' }; },   // jeu 2.0.7 : quête (HG-quete.js)
    use() { if (!G.power && !qpBloqueCourant()) { activatePower(); qpRallume(); } },""")
# rallumage de la quête : le courant n'est compté qu'une fois dans les statistiques à vie
rep("""  Life.add('power');""", """  if (QP.etape !== 'eteint') Life.add('power');   // jeu 2.0.7 : rallumage de la quête (HG-quete.js) pas compté deux fois""")
# tir sur le disjoncteur (avant l'horloge : la plaque arrête la balle)
rep("""  if (!stopped) { const tH = horlRayon(ox, oy, oz, dx, dy, dz, endT);""",
"""  if (!stopped) { const tQ = qpRayon(s, ox, oy, oz, dx, dy, dz, endT); if (tQ >= 0) { endT = tQ; stopped = true; qpTouche(s, ox + dx * tQ, oy + dy * tQ, oz + dz * tQ, G.stats.shots); } }   // jeu 2.0.7 : quête
  if (!stopped) { const tH = horlRayon(ox, oy, oz, dx, dy, dz, endT);""")
# lumières : après celles du boss, en partie et sous l'écran de fin
rep("""  b7Lumieres();                                // jeu 2.0.7 : obscurité des effets du boss sur les lampes""",
"""  b7Lumieres();                                // jeu 2.0.7 : obscurité des effets du boss sur les lampes
  qpLumieres(dt);                              // jeu 2.0.7 : coupure et lockdowns de la quête (HG-quete.js)""")
rep("""b7Lumieres(); /* jeu 2.0.7 : obscurité du boss gardée */""",
"""b7Lumieres(); qpLumieres(0); /* jeu 2.0.7 : obscurité du boss et de la quête gardée */""")
# chaque image et remise à zéro
rep("""  atgMaj(dt);                                  // jeu 2.0.7 : atout gratuit, bu (HF-atout-gratuit.js)""", """  atgMaj(dt);                                  // jeu 2.0.7 : atout gratuit, bu (HF-atout-gratuit.js)
  qpMaj(dt);                                   // jeu 2.0.7 : quête principale (HG-quete.js)""")
rep("""  atgRemettre();                               // jeu 2.0.7 : atout gratuit (HF-atout-gratuit.js)""", """  atgRemettre();                               // jeu 2.0.7 : atout gratuit (HF-atout-gratuit.js)
  qpRemettre();                                // jeu 2.0.7 : quête principale (HG-quete.js)""")
# manches figées pendant la quête
rep("""  if (b7ManchesSuspendues()) return;           // jeu 2.0.7 : combat du boss de Bunker 7""",
"""  if (b7ManchesSuspendues()) return;           // jeu 2.0.7 : combat du boss de Bunker 7
  if (qpManchesSuspendues()) return;           // jeu 2.0.7 : coupure et lockdowns de la quête""")
# zombies des lockdowns : hors manche (morts, recyclage) ; chiens apparus dans la salle du lockdown
rep("""  if (z.b7) { b7ZombieTue(z, info); return; }   // jeu 2.0.7 : zombie du combat du boss""",
"""  if (z.b7) { b7ZombieTue(z, info); return; }   // jeu 2.0.7 : zombie du combat du boss
  if (z.qp) { qpTue(z, info); return; }          // jeu 2.0.7 : zombie d'un lockdown de la quête""")
rep("""  if (z.b7) return;                            // jeu 2.0.7 : zombie du combat du boss, hors de la manche""",
"""  if (z.b7) return;                            // jeu 2.0.7 : zombie du combat du boss, hors de la manche
  if (z.qp) return;                            // jeu 2.0.7 : zombie d'un lockdown de la quête""")
rep("""    if (zi < 0 || !G.activeZones.has(zi)) continue;
    const d = flow[k];""",
"""    if (zi < 0 || !G.activeZones.has(zi) || (qpZoneLockdown() >= 0 && zi !== qpZoneLockdown())) continue;   // jeu 2.0.7 : lockdown
    const d = flow[k];""")
# barrières des lockdowns : seul le joueur est arrêté (balles, grenades et zombies passent)
rep("""  if (OW.on) { owSettle(b, r); return; }
  if (b.k < 0) b.k = nearestNode(b.pos.x, b.pos.z, b.gy || 0);""",
"""  if (OW.on) { owSettle(b, r); return; }
  if (b === player) qpBarrieres(b, r);         // jeu 2.0.7 : barrières des lockdowns de la quête (HG-quete.js)
  if (b.k < 0) b.k = nearestNode(b.pos.x, b.pos.z, b.gy || 0);""")
# toit de la Salle d'arrivée : les cases de la brèche dans un maillage à part (caché par la foudre), bord et gravats
rep("""            if (ct !== 'none') hface(ct, x, z, WALL_H, false, ao(tint, 0.9), cornerAO);""",
"""            if (ct !== 'none') { if (qpBrecheCase(li, x, z)) qpPlafondBreche(texSize(ct), ct, x, z, E + WALL_H, ao(tint, 0.9), cornerAO); else hface(ct, x, z, WALL_H, false, ao(tint, 0.9), cornerAO); }   // jeu 2.0.7 : quête""")
rep("""    K.build(group);""", """    K.build(group);
    if (li === 0) qpBrecheConstruire(group, E);   // jeu 2.0.7 : toit de la Salle d'arrivée (HG-quete.js)""")
