# Points d'accroche du jeu 2.0.6 : Anthony, le personnage jouable. Exécuté par build.py après hooks-prehension.py.
# Demande d'Anthony du 18 octobre 2026 : son personnage 3D (engine/orig/survivant/, inséré tel quel) devient le
# premier personnage jouable. Ses choix du même jour : ses bras FPS pilotés par la préhension du jeu, le
# personnage à 1,75 m (yeux à la hauteur de ceux du jeu), la visée en vue TPS sans mouvement de caméra.
# Le branchement est dans le module src/H1-personnage.js.

# création : ses bras dans la vue FPS et son corps dans la scène, avant la conversion des couleurs de la scène
# et de la vue (ses matières se convertissent elles-mêmes et sont marquées comme déjà converties)
rep("""  warmHolds();
}""", """  warmHolds();
  persoInit();                                            // Anthony, le personnage (jeu 2.0.6)
}""")

# ses bras suivent nos bras, posés par la préhension (fin de la vue FPS)
rep("""  Arms.keyLight.intensity = damp(Arms.keyLight.intensity, lum * 0.78, 4, dt);
}""", """  Arms.keyLight.intensity = damp(Arms.keyLight.intensity, lum * 0.78, 4, dt);
  persoArmsSync();                                        // jeu 2.0.6 : ses bras sur la préhension
}""")

# son corps suit le joueur (après la caméra et les armes)
rep("""  updatePlayer(dt);
  updateArms(dt);
""", """  updatePlayer(dt);
  updateArms(dt);
  persoUpdate(dt);                             // jeu 2.0.6 : le corps d'Anthony
""")

# rendu : corps montré seulement en partie (pas au menu, ni dans les Mod Tools, ni pendant une scène) ;
# vue TPS : la scène vue par la caméra derrière l'épaule, sans la vue de l'arme (ni les bras du couteau et du khépesh)
rep("""  renderer.clear();
  renderer.render(scene, viewCamera || camera);""", """  renderer.clear();
  persoBeforeRender();                         // jeu 2.0.6 : corps d'Anthony montré ou caché, caméra TPS
  renderer.render(scene, viewCamera || persoCamera());""")
rep("""  if (G.state === 'playing' || G.state === 'paused') {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);""", """  if ((G.state === 'playing' || G.state === 'paused') && !persoTps()) {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);""")

# vue TPS : traçantes et projectiles partent du canon de l'arme du corps (les balles, des yeux, comme en vue FPS)
rep("""function muzzleWorld() {
  const k = 1 - player.ads;""", """function muzzleWorld() {
  if (persoMuzzle(_mw)) return _mw;            // jeu 2.0.6 : vue TPS
  const k = 1 - player.ads;""")

# commandes : T, vue FPS ou TPS (au volant : vue du conducteur ou de poursuite, comme C)
rep("""        <dt>Espace · C</dt><dd>Sauter · s'accroupir</dd>
""", """        <dt>Espace · C</dt><dd>Sauter · s'accroupir</dd>
        <dt>T</dt><dd>Vue à la première ou à la troisième personne</dd>
""")
rep("F pour monter ou descendre, C pour la vue, L pour les phares.", "F pour monter ou descendre, C ou T pour la vue, L pour les phares.")

# bras du couteau (sa propre vue) : aux couleurs d'Anthony, veste et mitaines (demande du 19 octobre 2026) ;
# sans son modèle, les couleurs et la matière des manches d'avant (persoCouleursBras, persoMancheBras)
rep("""    couleurs: { gant: 0x3b2a1d, manche: 0x4f5638 },          // MAT.glove, MAT.sleeve
    gravite: 9.81, hauteurSol: 0,
    son: true, volume: KNIFE.volume""", """    couleurs: persoCouleursBras(),                           // jeu 2.0.6 : ceux d'Anthony (veste, mitaines)
    gravite: 9.81, hauteurSol: 0,
    son: true, volume: KNIFE.volume""")
rep("""  // manche : la matière des bras du jeu (même couleur, même toile ; sans elle, la manche unie paraissait
  // deux fois plus claire que celle du bras qui tient l'arme)
  Couteau.rig.traverse((m) => { if (m.material && m.material.color && !m.material.map && m.material.color.equals(MAT.sleeve.color)) m.material = MAT.sleeve; });""",
"""  // manche : sans le modèle d'Anthony, la matière des bras du jeu (même couleur, même toile ; sans elle, la
  // manche unie paraissait deux fois plus claire que celle du bras qui tient l'arme)
  persoMancheBras(Couteau.rig);                             // jeu 2.0.6""")
