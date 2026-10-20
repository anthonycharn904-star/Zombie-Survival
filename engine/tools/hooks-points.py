# Points d'accroche du jeu 2.0.6 : HUD « portrait + points ». Exécuté par build.py après hooks-glissade.py.
# Demande d'Anthony du 20 octobre 2026 (paquet hud-points : engine/orig/hud-points/, inséré tel quel). Le branchement
# est dans le module src/H5-points.js : G.points reste la seule valeur ; le HUD en reçoit le total à chaque image.

# l'ancien affichage des points (en bas à droite) est masqué quand le nouveau HUD est là (sa valeur reste tenue à jour)
rep("""#points-wrap { position: relative; }""",
"""#points-wrap { position: relative; }
body.zs-pts #points-wrap { display: none; }   /* jeu 2.0.6 : HUD « portrait + points » en bas à gauche (section 20) */""")

# création, une fois, avec les autres éléments du HUD
rep("""      'prompt-sub', 'hint', 'pu-active', 'dmg', 'flash', 'downed', 'down-fill', 'lockhint']) this.el[id] = $(id);
  },""", """      'prompt-sub', 'hint', 'pu-active', 'dmg', 'flash', 'downed', 'down-fill', 'lockhint']) this.el[id] = $(id);
    ptsHudInit();                              // jeu 2.0.6 : HUD « portrait + points »
  },""")
# nouvelle partie, sauvegarde reprise : total posé sans bulle
rep("""    this.el['points-pops'].textContent = '';
""", """    this.el['points-pops'].textContent = '';
    ptsHudFull();                              // jeu 2.0.6 : HUD « portrait + points »
""")
# gains et dépenses : les bulles sont celles du nouveau HUD (une par image, à partir du total)
rep("""  pointsChanged(delta) {
    this.el.points.textContent = G.cheat ? '∞' : G.points;
""", """  pointsChanged(delta) {
    this.el.points.textContent = G.cheat ? '∞' : G.points;
    if (ptsHudOn()) return;                    // jeu 2.0.6 : bulles du HUD « portrait + points » (section 20)
""")
# achat refusé : secousse rouge
rep("""  denied() {
    const el = this.el.points;""", """  denied() {
    ptsHudRefuse();                            // jeu 2.0.6 : HUD « portrait + points »
    const el = this.el.points;""")
# digi pass : « ∞ »
rep("""  HUD.el.points.textContent = '∞';
""", """  HUD.el.points.textContent = '∞';
  ptsHudFull();                                // jeu 2.0.6 : HUD « portrait + points »
""")
# chaque image : en partie (update) et pour la visibilité, pause et menus compris (render)
rep("""  glEffets(dt);                                // jeu 2.0.6 : poussière et sons de la glissade
""", """  glEffets(dt);                                // jeu 2.0.6 : poussière et sons de la glissade
  ptsHudFrame();                               // jeu 2.0.6 : HUD « portrait + points »
""")
rep("""  persoBeforeRender();                         // jeu 2.0.6 : corps d'Anthony montré ou caché, caméra TPS
""", """  persoBeforeRender();                         // jeu 2.0.6 : corps d'Anthony montré ou caché, caméra TPS
  ptsHudFrame();                               // jeu 2.0.6 : HUD « portrait + points » (visibilité, total)
""")
