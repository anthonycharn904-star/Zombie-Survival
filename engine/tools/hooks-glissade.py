# Points d'accroche du jeu 2.0.6 : glissade, annulation de glissade et sprint tactique. Exécuté par build.py après
# hooks-gestes.py. Demande d'Anthony du 19 octobre 2026 (paquet mouvement-cod : engine/orig/mouvement/, inséré tel
# quel). Le branchement est dans le module src/H4-glissade.js.
# Choix d'Anthony du même jour : glissade, annulation et sprint tactique avec les vitesses du jeu (Maj et C maintenus,
# endurance du sprint, atouts, visée inchangés) ; caméra : descente des yeux seule ; pas sur la Lune.

# déplacement : le contrôleur décide de l'état (sprint, sprint tactique, accroupi, glissade, saut) ; hors glissade,
# la vitesse reste celle du jeu ; au volant, le contrôleur est remis à zéro
rep("""  if (OW.on && owDriving()) { owDriveStep(dt); owPlayerVitals(dt); return; }""",
"""  if (OW.on && owDriving()) { if (GL.actif) glReset(); owDriveStep(dt); owPlayerVitals(dt); return; }""")
rep("""  if (wantSprint && canSprint && !p.sprinting && (endurance || p.stamina > 0.15)) p.sprinting = true;
  if (!wantSprint || !canSprint) p.sprinting = false;""",
"""  const gl = glStep(dt, f, s, mobility, endurance, wantSprint);   // jeu 2.0.6 : glissade, sprint tactique (null : Lune, à terre)
  if (gl) p.sprinting = gl.sprinting;
  else {
    if (wantSprint && canSprint && !p.sprinting && (endurance || p.stamina > 0.15)) p.sprinting = true;
    if (!wantSprint || !canSprint) p.sprinting = false;
  }""")
rep("""  const crouchTarget = key('KeyC') && !p.sprinting ? 1 : 0;""",
"""  const crouchTarget = gl ? gl.crouch : key('KeyC') && !p.sprinting ? 1 : 0;""")
rep("""  if (p.sprinting) speed *= 1.46;""", """  if (p.sprinting) speed *= 1.46 * (gl ? gl.tac : 1);""")
rep("""  else { p.vel.x = damp(p.vel.x, wx * speed, accel, dt); p.vel.z = damp(p.vel.z, wz * speed, accel, dt); }
  const lx0 = p.pos.x, lz0 = p.pos.z;""",
"""  else if (gl && gl.slide) { p.vel.x = gl.vx; p.vel.z = gl.vz; }   // jeu 2.0.6 : en glissade, la vitesse du contrôleur
  else { p.vel.x = damp(p.vel.x, wx * speed, accel, dt); p.vel.z = damp(p.vel.z, wz * speed, accel, dt); }
  const lx0 = p.pos.x, lz0 = p.pos.z, lgy0 = p.gy;""")
rep("""  if (GRAV.moon && p.grounded && dt > 0) { const ax = (p.pos.x - lx0) / dt, az = (p.pos.z - lz0) / dt; if (Math.hypot(ax, az) < Math.hypot(p.vel.x, p.vel.z) - 0.05) { p.vel.x = ax; p.vel.z = az; } }
""", """  if (GRAV.moon && p.grounded && dt > 0) { const ax = (p.pos.x - lx0) / dt, az = (p.pos.z - lz0) / dt; if (Math.hypot(ax, az) < Math.hypot(p.vel.x, p.vel.z) - 0.05) { p.vel.x = ax; p.vel.z = az; } }
  glCollide(dt, lx0, lz0, lgy0);              // jeu 2.0.6 : obstacles et pente pour la glissade
""")
# saut : décidé par le contrôleur (saut de glissade compris : il annule la glissade en gardant l'élan)
rep("""  if (pressed('Space') && p.grounded && !p.down && p.crouch < 0.5 && !p.luSlide) {""",
"""  if ((gl ? gl.jump : pressed('Space') && p.crouch < 0.5) && p.grounded && !p.down && !p.luSlide) {""")
# en glissade : ni balancement de la tête, ni bruit de pas
rep("""  p.bobAmt = damp(p.bobAmt, p.grounded ? clamp(hs / 4.6, 0, 1.5) : 0, 10, dt);""",
"""  p.bobAmt = damp(p.bobAmt, p.grounded && !glSliding() ? clamp(hs / 4.6, 0, 1.5) : 0, 10, dt);""")
rep("""  if (p.grounded && hs > 1) {""", """  if (p.grounded && hs > 1 && !glSliding()) {""")

# caméra : les yeux descendent pendant la glissade (choix d'Anthony : rien d'autre)
rep("""  const eye = p.down ? 0.55 : PLAYER_EYE - p.crouch * 0.55;""",
"""  const eye = p.down ? 0.55 : PLAYER_EYE - p.crouch * 0.55 - glOeil(dt);   // jeu 2.0.6 : glissade""")

# arme de la vue FPS : pose du sprint effacée en sprint tactique ; arme penchée en glissade, levée en sprint tactique
rep("""  Arms.sprintK = damp(Arms.sprintK, player.sprinting ? 1 : 0, 10, dt);
  x -= 0.06 * Arms.sprintK; y -= 0.045 * Arms.sprintK; ry += 0.75 * Arms.sprintK; rz += 0.22 * Arms.sprintK; rx -= 0.12 * Arms.sprintK;""",
"""  Arms.sprintK = damp(Arms.sprintK, player.sprinting ? 1 - glTacW() : 0, 10, dt);   // jeu 2.0.6 : sprint tactique
  x -= 0.06 * Arms.sprintK; y -= 0.045 * Arms.sprintK; ry += 0.75 * Arms.sprintK; rz += 0.22 * Arms.sprintK; rx -= 0.12 * Arms.sprintK;
  { const g = glVue(dt, _glVm); x += g[0]; y += g[1]; z += g[2]; rx += g[3]; ry += g[4]; rz += g[5]; }   // jeu 2.0.6 : glissade""")
# main gauche libre en sprint tactique (elle balance au rythme de la course)
rep("""  if (st === 'nade' && Arms.nd) {""",
"""  if (gun && st === 'idle') { const m = glMainGauche(lP, lQ, lPose); if (m) { lP = _handL.copy(m.p); lQ = _vmQL.copy(m.q); lPose = m.pose; lPose2 = m.pose2; lK = m.k; } }   // jeu 2.0.6
  if (st === 'nade' && Arms.nd) {""")
# tir : délais du début de glissade et du sprint tactique (un clic pendant le délai part à la fin)
rep("""  if (s && Arms.state === 'idle') tryFire(s);""",
"""  if (s && Arms.state === 'idle') glTir(s);    // jeu 2.0.6 : délais de la glissade et du sprint tactique""")

# nouvelle partie : contrôleur remis à zéro
rep("""function resetPlayer() {
""", """function resetPlayer() {
  glReset();                                   // jeu 2.0.6 : glissade
""")
# poussière et sons de la glissade (après le corps)
rep("""  persoUpdate(dt);                             // jeu 2.0.6 : le corps d'Anthony
""", """  persoUpdate(dt);                             // jeu 2.0.6 : le corps d'Anthony
  glEffets(dt);                                // jeu 2.0.6 : poussière et sons de la glissade
""")

# commandes
rep("""        <dt>Maj</dt><dd>Sprinter</dd>
        <dt>Espace · C</dt><dd>Sauter · s'accroupir</dd>
""", """        <dt>Maj</dt><dd>Sprinter · deux appuis : sprint tactique</dd>
        <dt>Espace · C</dt><dd>Sauter · s'accroupir</dd>
        <dt>C en sprint</dt><dd>Glissade · Espace, C ou Maj l'annule</dd>
""")
