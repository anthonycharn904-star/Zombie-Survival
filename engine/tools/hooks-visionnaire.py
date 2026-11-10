# Points d'accroche du jeu 2.0.7 : sixième easter egg secondaire de Bunker 7, « Visionnaire » (le Momifié, son portail de
# sable et l'hallucination du désert ; module src/HL-visionnaire.js ; demande d'Anthony du 10 novembre 2026).
# Exécuté par build.py après hooks-tetes.py.

# apparition : une fois par partie, 0,01 % à chaque zombie qui sort (vsType) ; ses couleurs ; le Momifié est suivi
rep("""  const type = zoneZombieType(sp.zone);""",
"""  const type = vsType(zoneZombieType(sp.zone));   // jeu 2.0.7 : le Momifié, très rare (HL-visionnaire.js)""")
rep("""  if (OW.on) khLook(look, type);                       // peau tannée, yeux turquoise
""",
"""  if (OW.on || VS.on) khLook(look, type);              // peau tannée, yeux turquoise (jeu 2.0.7 : aussi au désert du Visionnaire)
  if (type === VS_TYPE) vsLook(look);                  // jeu 2.0.7 : le Momifié, couleurs de sa fiche
""")
rep("""  Zombies.list.push(z);
  animateZombie(z, 0);
  return z;
}""",
"""  Zombies.list.push(z);
  animateZombie(z, 0);
  if (type === VS_TYPE) vsNe(z);               // jeu 2.0.7 : le Momifié (HL-visionnaire.js)
  return z;
}""")
# retiré vivant (bloqué, trop loin) : il ressortira au prochain zombie
rep("""function recycleZombie(z) {
  removeZombie(z);
""",
"""function recycleZombie(z) {
  removeZombie(z);
  if (z.vsMomie) vsPerdu(z);                   // jeu 2.0.7 : le Momifié ressortira (HL-visionnaire.js)
  if (z.vs) return;                            // jeu 2.0.7 : zombie du désert du Visionnaire, hors de la manche
""")
# tué : le portail de sable s'ouvre au cadavre (le Momifié compte comme un zombie normal)
ins_after("""function onZombieKilled(z, info) {
""",
"""  if (z.vsMomie) vsTue(z, info);               // jeu 2.0.7 : portail de sable du Momifié (HL-visionnaire.js)
  if (z.vs) return;                            // jeu 2.0.7 : désert du Visionnaire, une hallucination : rien ne compte
""")
# chaque image et remise à zéro
rep("""  tbMaj(dt);                                   // jeu 2.0.7 : têtes au béret (HK-tetes.js)""",
"""  tbMaj(dt);                                   // jeu 2.0.7 : têtes au béret (HK-tetes.js)
  vsMaj(dt);                                   // jeu 2.0.7 : portail du Momifié (HL-visionnaire.js)""")
rep("""  tbRemettre();                                // jeu 2.0.7 : têtes au béret (HK-tetes.js)""",
"""  tbRemettre();                                // jeu 2.0.7 : têtes au béret (HK-tetes.js)
  vsRemettre();                                // jeu 2.0.7 : le Momifié (HL-visionnaire.js)""")
# sauvegarde : le Momifié ne ressort pas après « Sauvegarder et quitter »
rep("""    kh: OW.on ? khSerialize() : null,                   // Khamsin : pièces, Sceptre, véhicules
""",
"""    kh: OW.on ? khSerialize() : null,                   // Khamsin : pièces, Sceptre, véhicules
    visionnaire: VS.fait,                               // jeu 2.0.7 : le Momifié est déjà sorti (HL-visionnaire.js)
""")
rep("""    if (OW.on && s.kh) khRestore(s.kh);
""",
"""    if (OW.on && s.kh) khRestore(s.kh);
    VS.fait = !!s.visionnaire;                          // jeu 2.0.7 : le Momifié, une fois par partie
""")

# ---- l'hallucination : le désert a sa propre physique (VS.on), loin de la grille de Bunker 7
ins_after("""function surfY(k, x, z) {
""", """  if (VS.on) return vsSol(x, z);               // jeu 2.0.7 : désert du Visionnaire (HL-visionnaire.js)
""")
ins_after("""function settleBody(b, r) {
""", """  if (VS.on) { vsPoser(b); return; }           // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function floorBelow(x, z, y) {
""", """  if (VS.on) return vsSol(x, z);               // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function solidPoint(x, y, z) {
""", """  if (VS.on) return y < vsSol(x, z);           // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function raycast(ox, oy, oz, dx, dy, dz, maxT) {
""", """  if (VS.on) return vsRayon(ox, oy, oz, dx, dy, dz, maxT);   // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function losClear(k0, x0, z0, x1, z1, r = 0.2) {
""", """  if (VS.on) return true;                      // jeu 2.0.7 : désert du Visionnaire (rien entre les dunes)
""")
ins_after("""function clearToZombie(x, y, z, k0, zb) {
""", """  if (VS.on) return true;                      // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function computeFlow(k0) {
""", """  if (VS.on) return;                           // jeu 2.0.7 : désert du Visionnaire (en ligne droite)
""")
ins_after("""function flowDir(k, x, z, out) {
""", """  if (VS.on) return false;                     // jeu 2.0.7 : désert du Visionnaire (en ligne droite)
""")
rep("""const flowAt = (k) => (OW.on ? owFlowAt(k) : k >= 0 ? flow[k] : 1e9);""",
"""const flowAt = (k) => (VS.on ? 0 : OW.on ? owFlowAt(k) : k >= 0 ? flow[k] : 1e9);   // jeu 2.0.7 : désert du Visionnaire""")
ins_after("""function rdTop(cx, cz, y) {
""", """  if (VS.on) return -Infinity;                 // jeu 2.0.7 : désert du Visionnaire (aucun mur)
""")
ins_after("""function debrisHit(x, y, z, ox, oz) {
""", """  if (VS.on) return y < vsSol(x, z);           // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function nodeUnder(x, z, y) {
""", """  if (VS.on) return -1;                        // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function zoneAt(x, z, yHint = 0) {
""", """  if (VS.on) return -1;                        // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function locateNode(x, z, yHint = 0, walkOnly = false) {
""", """  if (VS.on) return -1;                        // jeu 2.0.7 : désert du Visionnaire
""")
rep("NL > 1 || OW.on", "NL > 1 || OW.on || VS.on", 10)      # sol sous les particules, grenades, étuis, membres, corps (désert du Visionnaire)
rep("""  if (OW.on) { owSandBurst(x, z, y); return; }   // monde ouvert : du sable
""", """  if (OW.on || VS.on) { owSandBurst(x, z, y); return; }   // monde ouvert : du sable (jeu 2.0.7 : aussi au désert du Visionnaire)
""")
rep("""    z.gy = OW.on ? sp.y : LVY[sp.li];""", """    z.gy = OW.on || VS.on ? sp.y : LVY[sp.li];""")
ins_after("""function zoneZombieType(zi) {
""", """  if (VS.on) return vsTypeDesert();            // jeu 2.0.7 : désert du Visionnaire, Desséchés de Khamsin
""")
rep("""wallSand = OW.on && RAY.hit && RAY.type >= 16;""", """wallSand = (OW.on || VS.on) && RAY.hit && RAY.type >= 16;""")
# ce qui ne compte pas : objets lâchés, Le Glas, expérience du rang
ins_after("""function maybeDropItem(z, win) {
""", """  if (z.vs) return;                            // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""function glasOnKill(z, info) {
""", """  if (z.vs) return;                            // jeu 2.0.7 : désert du Visionnaire
""")
ins_after("""  kill(info) {
""", """    if (VS.on) return 0;                       // jeu 2.0.7 : désert du Visionnaire, l'expérience ne compte pas
""")
# la « mort » au désert : le réveil au portail (ni relève, ni Quick Revive consommé, ni fin de partie)
rep("""  if (player.hp <= 0) goDown();
""", """  if (player.hp <= 0) { if (VS.on) { vsMort(); return; } goDown(); }   // jeu 2.0.7 : réveil du Visionnaire (HL-visionnaire.js)
""")
# chaque image : l'hallucination à la place de Bunker 7 (figé)
ins_after("""  G.stats.time = G.time;
""", """  if (VS.on) { vsUpdate(dt); return; }         // jeu 2.0.7 : désert du Visionnaire, Bunker 7 figé (HL-visionnaire.js)
""")
rep("""  b7SalleAvantRendu();                         // jeu 2.0.7 : salle du boss ou Bunker 7, et leur ambiance
""", """  b7SalleAvantRendu();                         // jeu 2.0.7 : salle du boss ou Bunker 7, et leur ambiance
  vsAvantRendu();                              // jeu 2.0.7 : désert du Visionnaire (vent coupé en pause)
""")
# sauvegarde pendant l'hallucination : refusée par la sauvegarde S2 à la fusion (décision d'Anthony du 10 novembre 2026)
