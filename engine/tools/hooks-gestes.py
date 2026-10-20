# Points d'accroche du jeu 2.0.6 : rechargements et boisson d'atout retravaillés (module src/H2-gestes.js).
# Demande d'Anthony du 19 octobre 2026 : rechargements propres à chaque arme, fluides et anatomiques ;
# boisson d'atout sans main qui traverse la fiole, pour toutes les fioles. Exécuté par build.py après
# hooks-personnage.py.

# boisson : prise de la fiole calculée par le solveur, pour la forme de la fiole tenue (ballon, calebasse)
rep("""let _bottleHold = null;
function bottleHold() {
  if (!_bottleHold) _bottleHold = handWrap(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(-0.15, 0.05, -1), new THREE.Vector3(0, 1, 0.15), false, 0.046, 0.03, 'bottle');
  return _bottleHold;
}""", """/* Prise de la fiole tenue (jeu 2.0.6 : calculée par le solveur pour sa forme, module H2-gestes.js). */
function bottleHold() {
  const B = Arms.bottle, sh = B && B.userData.shape;
  return geBottleHold(sh ? sh.kind : 'flask');
}""")
rep("""      rPose = HAND_POSES.bottle;""", """      rPose = H.pose || HAND_POSES.bottle;                  // jeu 2.0.6 : doigts et pouce posés sur la fiole""")

# rechargements et réarmements : mains et arme sur des courbes continues (H2-gestes.js : geHand, geGun)
rep("""function rlHand(c, side, gun, t, outP, outQ) {
  const sp = rlSpan(c[side], t);""", """function rlHand(c, side, gun, t, outP, outQ) {
  return geHand(c, side, gun, t, outP, outQ);                   // jeu 2.0.6 : courbes continues
  const sp = rlSpan(c[side], t);""")
rep("""function rlGun(c, t) {
  _rlG.fill(0);""", """function rlGun(c, t) {
  return geGun(c, t, _rlG);                                      // jeu 2.0.6 : courbe continue
  _rlG.fill(0);""")
# masse de l'arme pendant un rechargement (pas pendant les réarmements entre deux tirs : la cadence ne change pas)
rep("""    const go = rlGun(clip.c, clip.t);""", """    const go = geGunInertia(rlGun(clip.c, clip.t), clip === Arms.rl ? clip.c : null, dt);   // jeu 2.0.6 : masse de l'arme""")

# boisson : le coude est choisi comme pour les armes (poignet dans ses limites) ; avant, le coude levé de force
# repliait la main contre l'avant-bras quand la fiole basculait à la bouche (poignet à 171°)
rep("""  const armAuto = !!gun && st !== 'drink' && st !== 'nade';               // coude choisi (jeu 2.0.6)""",
    """  const armAuto = st !== 'nade' && (!!gun || st === 'drink');            // coude choisi (jeu 2.0.6 ; boisson : gestes)""")

# boisson : fin du lancer réglable (GE_SUIT, H2-gestes.js)
rep("""        _btE.set(Rr.th - 0.8 * q, Rr.ps, Rr.la - 0.4 * q, 'ZXY');""",
    """        _btE.set(Rr.th + GE_SUIT.th * q, Rr.ps + GE_SUIT.ps * q, Rr.la + GE_SUIT.la * q, 'ZXY');   // jeu 2.0.6 : gestes""")

# boisson : poses de la fiole. Au jeu 1.9.0, la fiole tournait de −90° sur elle-même pour boire (ψ −1,57) :
# l'avant-bras droit aurait dû partir vers la gauche, à travers le visage, et le poignet se pliait de 130 à
# 180°. Ici la main reste du côté droit de la fiole (ψ +0,3 à +0,4) : poignet entre −20° et +40° pendant
# la montée, le débouchage et la gorgée ; lâcher moins basculé (θ −0,4, λ −1,3) et fin du lancer qui
# relève la main (GE_SUIT) : le poignet reste dans ses limites jusqu'à la sortie de la vue.
rep("""  [DRINK.bring, [0.07, -0.145, -0.37], 0.05, -0.19, 0.04],
  [DRINK.uncap, [0.068, -0.14, -0.365], 0.04, -0.21, 0.03],
  [DRINK.mouth, null, 1.9, -1.57, 0],
  [DRINK.grant, null, 2.12, -1.57, 0],
  [DRINK.away, [0.12, -0.15, -0.3], 0.6, -1.4, -0.4],
  [DRINK.wind, [0.2, -0.08, -0.27], -0.2, -1.5, -0.8],
  [DRINK.release, [0.17, -0.17, -0.5], -1.0, -1.5, -1.0],""",
    """  [DRINK.bring, [0.07, -0.145, -0.37], 0.05, 0.4, 0.04],          // jeu 2.0.6 : la main reste à droite de la fiole
  [DRINK.uncap, [0.068, -0.14, -0.365], 0.04, 0.38, 0.03],
  [DRINK.mouth, null, 1.9, 0.3, 0],
  [DRINK.grant, null, 2.12, 0.3, 0],
  [DRINK.away, [0.12, -0.15, -0.3], 0.6, 0.3, -0.4],
  [DRINK.wind, [0.2, -0.08, -0.27], -0.2, 0.3, -0.8],
  [DRINK.release, [0.17, -0.17, -0.5], -0.4, 0.3, -1.3],""")

# poignets gardés dans leurs limites pendant les rechargements et réarmements (geSolveArm, H2-gestes.js)
rep("""  if (rP) { prSolveArm(AR, rP, rQ, armAuto); setHandPose(AR.hand, rPose, rPose2, rK); }""",
    """  if (rP) { setHandPose(AR.hand, rPose, rPose2, rK); geSolveArm(AR, rP, rQ, armAuto, ch && ch.r ? clip : null, 'R', gun); }   // jeu 2.0.6 : poignet""")
rep("""  if (lP) { prSolveArm(AL, lP, lQ, armAuto); setHandPose(AL.hand, lPose, lPose2, lK); }""",
    """  if (lP) { setHandPose(AL.hand, lPose, lPose2, lK); geSolveArm(AL, lP, lQ, armAuto, ch && ch.l ? clip : null, 'L', gun); }   // jeu 2.0.6 : poignet""")
