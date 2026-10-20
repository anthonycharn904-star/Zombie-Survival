# Points d'accroche du jeu 2.0.6 : prise des armes (préhension). Exécuté par build.py après hooks-elixirs.py.
# Demande d'Anthony du 17 octobre 2026 : un vrai système de préhension (points de prise par arme, poses
# anatomiques des doigts, du pouce et des poignets, synchronisées avec le tir et les rechargements),
# validé par lui le même jour : prises déclarées par arme et solveur anatomique (module H0-prehension.js),
# modèles corrigés (poignées et pontets), pouce et éminence du pouce refaits.
import re

def pose_t(prefix, new):
    """Remplace le pouce t: [...] d'une pose (ligne qui commence par prefix), qui doit exister une fois."""
    global s
    pat = re.compile(r'(\n' + re.escape(prefix) + r'[^\n]*?, t: )\[[^\]]*\]')
    s, n = pat.subn(lambda m: m.group(1) + '[' + ', '.join(str(v) for v in new) + ']', s)
    if n != 1:
        sys.exit(f'POSE INTROUVABLE ({n}) : {prefix}')

# ------------------------------------------------------------------ Pouce et éminence du pouce
# Le pouce de 1.9.0 se pliait à 52° vers la face palmaire : fléchi, il pendait sous la main (poing, repos)
# au lieu de traverser la paume. Nouveau repère de base : métacarpien au repos plus près du plan de la
# paume (37° de l'index, 7° sous la paume), flexion dans le plan de la paume, vers l'auriculaire (comme
# un vrai pouce) ; écart = abduction palmaire, rotation = opposition. Dimensions inchangées.
rep("""  {                                                                           // pouce au repos : 40° de l'index, un peu sous la paume ;
    const d0 = new THREE.Vector3(-0.5, -0.32, -0.8).normalize();             // il se plie vers la base de l'auriculaire
    const m = new THREE.Vector3(0.75, -0.55, 0.3); m.addScaledVector(d0, -m.dot(d0)).normalize();""",
"""  {                                                                           // pouce au repos : 37° de l'index, 7° sous la paume ;
    const d0 = new THREE.Vector3(-0.6, -0.12, -0.79).normalize();            // il se plie dans le plan de la paume, vers
    const m = new THREE.Vector3(0.92, -0.25, 0.05); m.addScaledVector(d0, -m.dot(d0)).normalize();   // l'auriculaire (jeu 2.0.6)""")
# éminence du pouce : une petite masse fixe dans la paume, et le gros de l'éminence porté par le
# métacarpien du pouce (elle le suit quand il s'écarte ou se replie)
# Éminence et commissure : le métacarpien du pouce n'est plus dessiné comme une phalange libre ; une gaine
# déformable (prGaine, module H0-prehension.js) le recouvre et le relie à la paume (construction 2).
rep("  mesh(G.thenar, body, -0.019, -0.0075, -0.032, 0.0175, 0.0145, 0.026);\n", "")
rep("  const t1 = new THREE.Group(); t1.rotation.order = 'YXZ'; t0.add(t1); mesh(G.thumb[0], t1);\n",
    "  const t1 = new THREE.Group(); t1.rotation.order = 'YXZ'; t0.add(t1);      // métacarpien : dans la gaine (jeu 2.0.6)\n")
rep("  const hand = { wrist, body, fingers, thumb: [t1, t2, t3], left: !!left, pose: null };\n  setHandPose(hand, HAND_POSES.relax);",
    "  const hand = { wrist, body, fingers, thumb: [t1, t2, t3], left: !!left, pose: null };\n  prGaine(hand, t0, M);                                                      // éminence et commissure (jeu 2.0.6)\n  setHandPose(hand, HAND_POSES.relax);")
rep("  t2.rotation.x = -mix(ta[2], tb[2]);\n  t3.rotation.x = -mix(ta[3], tb[3]);\n}",
    "  t2.rotation.x = -mix(ta[2], tb[2]);\n  t3.rotation.x = -mix(ta[3], tb[3]);\n  prMajGaine(hand);                                                          // gaine du pouce (jeu 2.0.6)\n}")
rep("""   auriculaire ; écart de chaque doigt ; pouce [écart, flexion de la base, milieu, bout, rotation sur lui-même (facultative)]. */""",
    """   auriculaire ; écart de chaque doigt ; pouce [abduction palmaire (0,35 : repos), flexion de la base dans le plan de la
   paume, milieu, bout, opposition (rotation sur lui-même, facultative)] (repère du pouce du jeu 2.0.6). */""")
# poses : converties dans le nouveau repère (mêmes positions des articulations, à 1,4 mm près), sauf le
# repos, la main ouverte et le poing, refaits (pouce le long de l'index ; en travers des doigts dans le poing).
# Construction 2 : pouce des poses de geste recalculé par le solveur anatomique (prThumbPose, main seule) : pince
# et pression pulpe contre pulpe de l'index, chargeur, grenade, fiole et anneau avec le pouce opposé aux doigts
# (relax, pinch, pinPush, mag, ball, bottle, nade, thumbPush, ringHook, ringPoint) ; avant, il pendait sous la main.
for name, t in [('relax', [0.1, 0.25, 0.23, 0.27, 0.19]), ('open', [0.55, -0.15, 0.05, 0.05, 0]), ('flat', [0.21, -0.01, 0.05, -0.03, -0.48]),
                ('fist', [0.4, 0.7, 0.55, 0.65, 0.35]), ('pistol', [0.3, 0.3, 0.27, 0.09, -0.15]), ('wrist', [0.17, 0.48, 0.34, 0.12, -0.58]),
                ('fore', [0.5, -0.05, 0.05, 0.16, 0.2]), ('vgrip', [0.4, 0.4, 0.3, 0.27, -0.35]), ('pump', [0.4, 0.21, 0.29, 0.24, -0.28]),
                ('cup', [0.1, 0.25, 0.15, 0.14, -0.6]), ('mag', [0.79, 0.43, 0.05, 0.52, 0.45]), ('pinch', [0.61, 0.25, 0.28, 0.37, 0.19]),
                ('thumbPush', [0.39, 0.25, 0.28, 0.53, 0.12]), ('ball', [0.81, 0.25, 0.45, 0.3, 0.44]), ('bottle', [0.81, 0.25, 0.45, 0.3, 0.34])]:
    pose_t('  ' + name + ': { f: [[', t)
for name, t in [('nade', [0.58, 0.25, 0.23, 0.5, 0.2]), ('ringHook', [0.25, 0.03, 0.45, 0.57, -0.05]),
                ('ringPoint', [0.31, 0.25, 0.45, 0.47, 0.2]), ('pinPush', [0.51, 0.28, 0.3, 0.22, 0.17])]:
    pose_t('HAND_POSES.' + name + ' = {', t)

# ------------------------------------------------------------------ Prises déclarées (module H0-prehension.js)
# L'arme garde l'origine de son plan : les prises déclarées s'écrivent avec les nombres du modèle.
rep("  k.root.userData = { id, upgraded: tier > 0, tier, muzzle, parts: k.parts, info, anchors: k.anchors };",
    "  k.root.userData = { id, upgraded: tier > 0, tier, muzzle, parts: k.parts, info, anchors: k.anchors, origin: O.slice() };")
# Une arme qui a une prise déclarée (PRISES) passe par le solveur anatomique ; les autres gardent
# l'ajustement du jeu 1.9.0 jusqu'à leur tour.
rep("""  const root = gun.isObject3D ? gun : GUN_ROOT.get(ud);
  if (gun.isObject3D) GUN_ROOT.set(ud, gun);
""", """  const root = gun.isObject3D ? gun : GUN_ROOT.get(ud);
  if (gun.isObject3D) GUN_ROOT.set(ud, gun);
  if (root && PRISES[ud.id]) { const h = prGunHold(root); HOLD_CACHE.set(ud.id, h); return (ud.hold = h); }   // jeu 2.0.6
""")

# ------------------------------------------------------------------ Modèles corrigés
# STG-44 : la poignée faisait 61 mm d'avant en arrière et le dos de la poignée était à 107 mm de la
# détente (≈ 75–85 mm sur une vraie arme) : une main ne pouvait pas à la fois loger le dos de la poignée
# dans le creux entre pouce et index et poser l'index sur la détente. Dos de la poignée avancé de 24 mm
# en haut et de 18 mm en bas (portée 83 mm), stries recalées. Le pontet laissait 8 à 11 mm devant la
# détente pour un doigt ganté de 17 mm : barre avant avancée de 8 mm.
rep("""    k.side(M.bake, [[0.562, -0.044, 0.003], [0.622, -0.044, 0.004], [0.628, -0.06, 0.008], [0.652, -0.142, 0.01], [0.59, -0.146, 0.012], [0.574, -0.08, 0.02]], 0.0315, { bevel: 0.005, seg: 3 });
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.box(M.bake, 0.0012, 0.0016, 0.042, sx * 0.0158, -0.07 - i * 0.012, 0.6 + i * 0.0032);""",
"""    k.side(M.bake, [[0.562, -0.044, 0.003], [0.598, -0.044, 0.004], [0.604, -0.06, 0.008], [0.634, -0.142, 0.01], [0.59, -0.146, 0.012], [0.574, -0.08, 0.02]], 0.0315, { bevel: 0.005, seg: 3 });
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.box(M.bake, 0.0012, 0.0016, 0.026 + i * 0.0007, sx * 0.0158, -0.07 - i * 0.012, 0.589 + i * 0.0038);""")
rep("""    k.side(M.blue, [[0.5, -0.044], [0.565, -0.044], [0.563, -0.052, 0.003], [0.556, -0.0735, 0.008], [0.512, -0.0745, 0.01], [0.503, -0.052, 0.004]], 0.012, {
      holes: [[[0.5095, -0.0475, 0.003], [0.5555, -0.0475, 0.003], [0.5495, -0.0675, 0.007], [0.5155, -0.0678, 0.008]]],
    });
    k.side(M.bake, [[0.562""",
"""    k.side(M.blue, [[0.492, -0.044], [0.565, -0.044], [0.563, -0.052, 0.003], [0.556, -0.0735, 0.008], [0.504, -0.0745, 0.01], [0.495, -0.052, 0.004]], 0.012, {
      holes: [[[0.5015, -0.0475, 0.003], [0.5555, -0.0475, 0.003], [0.5495, -0.0675, 0.007], [0.5075, -0.0678, 0.008]]],
    });
    k.side(M.bake, [[0.562""")

# ------------------------------------------------------------------ Tir : la détente recule, l'index se plie avec elle
# À chaque coup, la détente est tirée (PR_TRIG) puis relâchée ; en rafale, elle reste tirée tant que l'arme
# tire. La main droite passe de sa prise à la prise « press » (index sur la détente tirée, calculée par le
# solveur) ; seulement pour les armes à prise déclarée (PRISES).
rep("  Arms.kick = Math.min(0.09, Arms.kick + 0.018 + rk * 0.6);\n",
    "  Arms.kick = Math.min(0.09, Arms.kick + 0.018 + rk * 0.6);\n"
    "  Arms.trigT = G.time + (wstat(s, 'auto') ? 1.25 * 60 / wstat(s, 'rpm') : 0.09);   // détente tirée jusqu'à (jeu 2.0.6)\n")
rep("  Arms.bloom = Arms.kick = Arms.kickRot = 0; Arms.cycleT = 0; Arms.cyc = null; Arms.rl = null; Arms.blow = 0;",
    "  Arms.bloom = Arms.kick = Arms.kickRot = 0; Arms.cycleT = 0; Arms.cyc = null; Arms.rl = null; Arms.blow = 0; Arms.trigK = Arms.trigT = 0;")
rep("  const st = Arms.state, k = Arms.dur > 0 ? clamp(Arms.t / Arms.dur, 0, 1) : 1;\n",
    "  const st = Arms.state, k = Arms.dur > 0 ? clamp(Arms.t / Arms.dur, 0, 1) : 1;\n"
    "  Arms.trigK = damp(Arms.trigK || 0, st === 'idle' && G.time < (Arms.trigT || 0) ? 1 : 0, 55, dt);\n"
    "  if (Arms.trigK < 1e-3) Arms.trigK = 0;\n")
rep("  if (gun && slot && !(st === 'reload' && Arms.rl)) rlRestParts(gun, slot, dt);\n",
    "  if (gun && slot && !(st === 'reload' && Arms.rl)) rlRestParts(gun, slot, dt);\n"
    "  const trigP = gun && PRISES[gun.userData.id] && gun.userData.parts.trigger;\n"
    "  if (trigP && !(st === 'reload' && Arms.rl)) {\n"
    "    trigP.quaternion.copy(trigP.userData.restQ);\n"
    "    if (Arms.trigK > 0) trigP.quaternion.multiply(_vmTQ.setFromAxisAngle(_vmTX, PR_TRIG * Arms.trigK));\n"
    "  }\n")
rep("const _vmQR = new THREE.Quaternion(), _vmQL = new THREE.Quaternion(), _vmV3 = new THREE.Vector3();\n",
    "const _vmQR = new THREE.Quaternion(), _vmQL = new THREE.Quaternion(), _vmV3 = new THREE.Vector3();\n"
    "const _vmTQ = new THREE.Quaternion(), _vmTX = new THREE.Vector3(1, 0, 0);\n")
rep("    rP = _handR; rQ = _vmQR; heldTarget(gun, hold.R, rP, rQ); rPose = hold.R.pose; _vmHR.copy(rP);\n",
    "    rP = _handR; rQ = _vmQR; heldTarget(gun, hold.R, rP, rQ); rPose = hold.R.pose; _vmHR.copy(rP);\n"
    "    if (hold.R.press && Arms.trigK > 0) { rPose2 = hold.R.press; rK = Arms.trigK; }   // l'index tire (jeu 2.0.6)\n")

# ------------------------------------------------------------------ Bras : coude choisi pour un poignet neutre
# Avec l'arme en main (hors fiole et grenade), le coude tourne autour de l'axe épaule–poignet pour garder
# le poignet dans ses limites confortables (prSolveArm) ; la fiole et la grenade gardent leurs coudes.
rep("  if (rP) { solveArm(AR, rP, rQ); setHandPose(AR.hand, rPose, rPose2, rK); }\n",
    "  const armAuto = !!gun && st !== 'drink' && st !== 'nade';               // coude choisi (jeu 2.0.6)\n"
    "  if (rP) { prSolveArm(AR, rP, rQ, armAuto); setHandPose(AR.hand, rPose, rPose2, rK); }\n")
rep("  if (lP) { solveArm(AL, lP, lQ); setHandPose(AL.hand, lPose, lPose2, lK); }\n",
    "  if (lP) { prSolveArm(AL, lP, lQ, armAuto); setHandPose(AL.hand, lPose, lPose2, lK); }\n")

# ------------------------------------------------------------------ Rechargements : poses des pièces saisies, main détendue
# Une clé de rechargement peut porter une pose calculée (objet) au lieu d'un nom de HAND_POSES (prFitGrip).
rep("  const pz = (k) => (k.pose === 'press' ? pressPose(hold) : k.pose ? HAND_POSES[k.pose] : hold);",
    "  const pz = (k) => (k.pose === 'press' ? pressPose(hold) : k.pose && typeof k.pose === 'object' ? k.pose : k.pose ? HAND_POSES[k.pose] : hold);")
# La main qui s'éloigne de l'arme, qui arrive vers un levier ou qui le lâche est détendue : grande
# ouverte, elle donnait une main en éventail ou un « index levé » en vue du joueur.
rep("const RL_AWAY = { f: 'cam', p: [-0.14, -0.34, -0.38], d: [0.3, -0.4, -1], u: [0, 1, 0], pose: 'open' };",
    "const RL_AWAY = { f: 'cam', p: [-0.14, -0.34, -0.38], d: [0.3, -0.4, -1], u: [0, 1, 0], pose: 'relax' };")
rep("    tr.push(bk(t0 - (t0 - tEnd) * 0.45, { p: around(1), pose: 'open', e: 'io' }), bk(t0, { e: 'io' }), bk(t1, { e: B.ease || 'io' }),\n"
    "      Object.assign({ t: t1 + 0.08, f: B.part, e: 'o' }, B.grip, { pose: 'open', p: rlAdd(B.grip.p, B.rel || [0, 0.012, 0.025]) }),\n"
    "      Object.assign({ t: t1 + 0.2, f: B.part, e: 'io' }, B.grip, { pose: 'open', p: rlAdd(B.grip.p, [outS * 0.08, -0.01, -0.05]) }));",
    "    tr.push(bk(t0 - (t0 - tEnd) * 0.45, { p: around(1), pose: 'relax', e: 'io' }), bk(t0, { e: 'io' }), bk(t1, { e: B.ease || 'io' }),\n"
    "      Object.assign({ t: t1 + 0.08, f: B.part, e: 'o' }, B.grip, { pose: 'relax', p: rlAdd(B.grip.p, B.rel || [0, 0.012, 0.025]) }),\n"
    "      Object.assign({ t: t1 + 0.2, f: B.part, e: 'io' }, B.grip, { pose: 'relax', p: rlAdd(B.grip.p, [outS * 0.08, -0.01, -0.05]) }));")

# Pièces saisies au rechargement : calculées pendant le menu dans une tranche à part (après la prise de
# l'arme), et au besoin au début du rechargement si le menu n'en a pas eu le temps.
rep("    try { gunHold(buildGun(id, 0)); } catch (e) { HOLD_CACHE.set(id, null); console.warn('prise', id, e); }\n    setTimeout(step, 20);",
    "    let g0 = null;\n"
    "    try { g0 = buildGun(id, 0); gunHold(g0); } catch (e) { HOLD_CACHE.set(id, null); console.warn('prise', id, e); }\n"
    "    if (g0 && PRISES[id]) setTimeout(() => prFitReload(g0), 20);           // jeu 2.0.6\n"
    "    setTimeout(step, 40);")
rep("  const c = def && Arms.gun ? def.clip(s, Arms.gun.userData) : null;",
    "  if (Arms.gun && PRISES[s.id]) prFitReload(Arms.gun);                // pièces saisies (jeu 2.0.6), si le menu ne les a pas faites\n"
    "  const c = def && Arms.gun ? def.clip(s, Arms.gun.userData) : null;")

# ------------------------------------------------------------------ Modèles corrigés (étape 2 : poignées pistolet)
def shift_u(old, pred, du):
    """Texte old (exactement une fois dans le jeu) dont les points [u, v(, r)] qui vérifient pred(u, v) sont
    décalés de du(u, v) le long de u (vers l'avant si négatif)."""
    def f(m):
        u, v = float(m.group(1)), float(m.group(2))
        if not pred(u, v):
            return m.group(0)
        return '[' + format(round(u + du(u, v), 4), 'g') + ', ' + m.group(2) + (m.group(3) or '') + ']'
    new = re.sub(r'\[(-?\d+\.\d+), (-?\d+\.\d+)((?:, -?\d+\.\d+)?)\]', f, old)
    rep(old, new)

def grip_fix(old, b1, b2, b3, d, frac=0.75):
    """Poignée : dos (coins b1, b2 en haut, b3 en bas, valeurs de u) avancé de d (b3 de frac·d)."""
    shift_u(old, lambda u, v: u in (b1, b2, b3), lambda u, v: -d * (frac if u == b3 else 1))

def guard_fix(old, ut, d=0.008):
    """Pontet : barre avant (points devant la détente, u < ut) avancée de d."""
    shift_u(old, lambda u, v: u < ut, lambda u, v: -d)

# Portée de détente ramenée à ≈ 83 mm (dos de la poignée avancé), pontets agrandis de 8 mm devant la détente.
# MP40 : 123 → 83 mm (profondeur de la poignée 79 → 41 mm, stries recalées).
grip_fix("k.side(M.bakeBlack, [[0.424, -0.04, 0.003], [0.51, -0.04, 0.004], [0.515, -0.06, 0.008], [0.526, -0.148, 0.01], [0.45, -0.152, 0.012], [0.436, -0.08, 0.02]], 0.0335, { bevel: 0.004 });",
         0.51, 0.515, 0.526, 0.0403)
rep("for (let i = 0; i < 7; i++) for (const s of [-1, 1]) k.box(M.bakeBlack, 0.0012, 0.0016, 0.05, s * 0.0168, -0.065 - i * 0.011, 0.477 + i * 0.0018);",
    "for (let i = 0; i < 7; i++) for (const s of [-1, 1]) k.box(M.bakeBlack, 0.0012, 0.0016, 0.028, s * 0.0168, -0.065 - i * 0.011, 0.4545 + i * 0.0025);")
guard_fix("k.side(M.blue, [[0.368, -0.04], [0.428, -0.04], [0.427, -0.05, 0.003], [0.42, -0.0725, 0.008], [0.38, -0.0735, 0.01], [0.37, -0.05, 0.004]], 0.011, {\n      holes: [[[0.377, -0.0455, 0.003], [0.419, -0.0455, 0.003], [0.413, -0.0665, 0.007], [0.383, -0.0668, 0.008]]],",
          0.391)
# Thompson : 110 → 83 mm.
grip_fix("k.side(M.wood, [[0.502, -0.044, 0.003], [0.567, -0.044, 0.004], [0.574, -0.06, 0.008], [0.6, -0.148, 0.012], [0.532, -0.152, 0.012], [0.512, -0.08, 0.02]], 0.033, { bevel: 0.0065, seg: 3 });",
         0.567, 0.574, 0.6, 0.0272)
guard_fix("k.side(M.blue, [[0.44, -0.044], [0.502, -0.044], [0.5, -0.052, 0.003], [0.494, -0.0735, 0.008], [0.452, -0.0745, 0.01], [0.443, -0.052, 0.004]], 0.012, {\n      holes: [[[0.4495, -0.0475, 0.003], [0.4935, -0.0475, 0.003], [0.4875, -0.0675, 0.007], [0.4555, -0.0678, 0.008]]],",
          0.463)
# FG42 : 96 → 82 mm.
grip_fix("k.side(M.wood, [[0.6, -0.033, 0.003], [0.66, -0.033, 0.004], [0.668, -0.05, 0.008], [0.674, -0.13, 0.01], [0.616, -0.134, 0.01], [0.606, -0.06, 0.02]], 0.032, { bevel: 0.0065, seg: 3 });",
         0.66, 0.668, 0.674, 0.017)
guard_fix("k.side(M.blue, [[0.55, -0.033], [0.604, -0.033], [0.602, -0.041, 0.003], [0.595, -0.0625, 0.008], [0.562, -0.0635, 0.01], [0.553, -0.041, 0.004]], 0.012, {\n      holes: [[[0.5595, -0.0365, 0.003], [0.5955, -0.0365, 0.003], [0.5905, -0.0565, 0.007], [0.5625, -0.0568, 0.008]]],",
          0.571)
# MG42 : 101 → 83 mm (stries recalées).
grip_fix("k.side(M.bakeBlack, [[0.765, -0.034, 0.003], [0.826, -0.034, 0.004], [0.832, -0.05, 0.008], [0.858, -0.138, 0.01], [0.795, -0.142, 0.012], [0.778, -0.07, 0.02]], 0.033, { bevel: 0.005, seg: 3 });",
         0.826, 0.832, 0.858, 0.018)
rep("for (let i = 0; i < 6; i++) for (const s of [-1, 1]) k.box(M.bakeBlack, 0.0012, 0.0016, 0.042, s * 0.0165, -0.062 - i * 0.012, 0.806 + i * 0.0035);",
    "for (let i = 0; i < 6; i++) for (const s of [-1, 1]) k.box(M.bakeBlack, 0.0012, 0.0016, 0.03 + i * 0.0005, s * 0.0165, -0.062 - i * 0.012, 0.7966 + i * 0.0036);")
guard_fix("k.side(M.blue, [[0.705, -0.033], [0.77, -0.033], [0.768, -0.041, 0.003], [0.761, -0.0625, 0.008], [0.718, -0.0635, 0.01], [0.709, -0.041, 0.004]], 0.012, {\n      holes: [[[0.7155, -0.0365, 0.003], [0.7605, -0.0365, 0.003], [0.7555, -0.0565, 0.007], [0.7215, -0.0568, 0.008]]],",
          0.73)
# Panzerschreck : portée déjà juste (80 mm) ; pontet seulement (12 mm : il ne laissait que 6 mm).
guard_fix("k.side(M.blue, [[0.912, -0.058], [0.964, -0.058], [0.962, -0.068, 0.003], [0.955, -0.091, 0.008], [0.92, -0.092, 0.01], [0.914, -0.066, 0.004]], 0.012, {\n      holes: [[[0.9215, -0.063, 0.003], [0.9565, -0.063, 0.003], [0.9515, -0.085, 0.007], [0.9255, -0.0855, 0.008]]],",
          0.931, 0.012)
# Onde de choc : 88 → 83 mm.
grip_fix("k.side(M.bake, [[0.45, -0.046, 0.003], [0.505, -0.046, 0.004], [0.512, -0.062, 0.008], [0.535, -0.15, 0.012], [0.476, -0.154, 0.012], [0.462, -0.08, 0.02]], 0.032, { bevel: 0.006, seg: 3 });",
         0.505, 0.512, 0.535, 0.0052)
guard_fix("k.side(M.blue, [[0.4, -0.046], [0.455, -0.046], [0.453, -0.054, 0.003], [0.446, -0.0755, 0.008], [0.41, -0.0765, 0.01], [0.403, -0.054, 0.004]], 0.012, {\n      holes: [[[0.4095, -0.0495, 0.003], [0.4465, -0.0495, 0.003], [0.4415, -0.0695, 0.007], [0.4125, -0.0698, 0.008]]],",
          0.423)

# ------------------------------------------------------------------ Modèles corrigés (étape 2 : crosses et pistolets)
# Pontets : 3 à 11 mm devant la détente ; barre avant avancée de 8 mm (M1911 : 6 mm, de 8,4 à 14,4 mm).
# La portée de détente de ces crosses (creux de la main sur le haut de la poignée → détente) est déjà
# réaliste : 74 à 82 mm (PPSh : 92 mm).
# Kar98k et G43 : l'ouverture du pontet ne faisait que 19 mm de haut pour un doigt ganté de 17 à 19 mm ;
# l'arc descend aussi de 5 mm (24 mm, comme un vrai Kar98k).
def guard_fix2(old, ut, d=0.008, dv=0.005, vb=-0.065):
    """Pontet : barre avant avancée de d, bas de l'arc (v < vb) descendu de dv."""
    def f(m):
        u, v = float(m.group(1)), float(m.group(2))
        nu = round(u - d, 4) if u < ut else u
        nv = round(v - dv, 4) if v < vb else v
        if nu == u and nv == v:
            return m.group(0)
        return '[' + format(nu, 'g') + ', ' + format(nv, 'g') + (m.group(3) or '') + ']'
    rep(old, re.sub(r'\[(-?\d+\.\d+), (-?\d+\.\d+)((?:, -?\d+\.\d+)?)\]', f, old))
guard_fix2("k.side(M.blue, [[0.733, -0.050], [0.791, -0.055, 0.003], [0.787, -0.0715, 0.01], [0.766, -0.0795, 0.012], [0.743, -0.0775, 0.01], [0.733, -0.059, 0.004]], 0.012, {\n      holes: [[[0.7415, -0.0555, 0.004], [0.7785, -0.0575, 0.004], [0.7765, -0.0718, 0.009], [0.7465, -0.0718, 0.009]]],", 0.7515)
guard_fix2("k.side(M.blue, [[0.684, -0.051], [0.758, -0.053, 0.003], [0.752, -0.0715, 0.01], [0.73, -0.0795, 0.012], [0.700, -0.0775, 0.01], [0.684, -0.06, 0.004]], 0.012, {\n      holes: [[[0.6925, -0.0555, 0.004], [0.7445, -0.0575, 0.004], [0.7405, -0.0718, 0.009], [0.6985, -0.0718, 0.009]]],", 0.7095)
guard_fix("k.side(M.blue, [[0.63, -0.034], [0.70, -0.034], [0.699, -0.044, 0.003], [0.692, -0.0675, 0.008], [0.648, -0.0685, 0.01], [0.636, -0.046, 0.004]], 0.012, {\n      holes: [[[0.6435, -0.0395, 0.003], [0.6905, -0.0395, 0.003], [0.6855, -0.0615, 0.007], [0.6505, -0.0618, 0.008]]],", 0.661)
guard_fix("k.side(M.blue, [[0.738, -0.034], [0.80, -0.042], [0.797, -0.05, 0.003], [0.79, -0.072, 0.009], [0.752, -0.073, 0.01], [0.742, -0.05, 0.004]], 0.012, {\n      holes: [[[0.7475, -0.0405, 0.003], [0.7905, -0.0465, 0.003], [0.7855, -0.0665, 0.007], [0.7535, -0.0668, 0.008]]],", 0.755)
guard_fix("k.side(M.blue, [[0.84, -0.048], [0.9, -0.048], [0.898, -0.056, 0.003], [0.891, -0.0775, 0.008], [0.852, -0.0785, 0.01], [0.843, -0.056, 0.004]], 0.012, {\n      holes: [[[0.8495, -0.0515, 0.003], [0.8915, -0.0515, 0.003], [0.8855, -0.0715, 0.007], [0.8555, -0.0718, 0.008]]],", 0.862)
guard_fix("k.side(M.blue, [[0.33, -0.047], [0.40, -0.047], [0.398, -0.055, 0.003], [0.391, -0.0765, 0.008], [0.347, -0.0775, 0.01], [0.335, -0.055, 0.004]], 0.012, {\n      holes: [[[0.3425, -0.0505, 0.003], [0.3905, -0.0505, 0.003], [0.3855, -0.0705, 0.007], [0.3485, -0.0708, 0.008]]],", 0.369)
guard_fix("k.side(M.blue, [[0.41, -0.043], [0.474, -0.043], [0.472, -0.051, 0.003], [0.465, -0.0725, 0.008], [0.423, -0.0735, 0.01], [0.414, -0.051, 0.004]], 0.012, {\n      holes: [[[0.4205, -0.0465, 0.003], [0.4645, -0.0465, 0.003], [0.4595, -0.0665, 0.007], [0.4255, -0.0668, 0.008]]],", 0.438)
# M1911 : le pontet fait partie de la carcasse ; ses points sous la glissière (v < −0,026) avancent de
# 6 mm, et le bas de l'arc descend de 4 mm (ouverture de 21 à 25 mm pour un doigt ganté de 18 mm).
old1911 = ("[0.1281, -0.0525, 0.004], [0.098, -0.0532, 0.007], [0.0905, -0.042, 0.009], [0.0898, -0.0255, 0.002], [0.046, -0.0255, 0.0015]], 0.0186, {\n"
           "      bevel: 0.0014, holes: [[[0.0952, -0.0283, 0.003], [0.1203, -0.0283, 0.002], [0.1262, -0.0488, 0.004], [0.1, -0.0492, 0.0065], [0.0948, -0.0425, 0.006]]],")
def f1911(m):
    u, v = float(m.group(1)), float(m.group(2))
    nu = round(u - 0.006, 4) if (u < 0.1036 and v < -0.026) else u
    nv = round(v - 0.004, 4) if v < -0.047 else v
    if nu == u and nv == v:
        return m.group(0)
    return '[' + format(nu, 'g') + ', ' + format(nv, 'g') + (m.group(3) or '') + ']'
rep(old1911, re.sub(r'\[(-?\d+\.\d+), (-?\d+\.\d+)((?:, -?\d+\.\d+)?)\]', f1911, old1911))

# ------------------------------------------------------------------ Numéro : jeu 2.0.6, construction 1 ; interface des Mod Tools inchangée (9)
rep("const GAME_VERSION = '2.0.5';", "const GAME_VERSION = '2.0.6';")

# Base du pouce (articulation trapézo-métacarpienne) à sa place anatomique (construction 2) : côté paume, en avant
# du métacarpien de l'index (l'éminence du pouce fait saillie dans la paume), et non au milieu de l'épaisseur de la
# paume. Au milieu, une paume posée à plat contre une poignée laissait la base du pouce à 2,5 cm du flanc : le pouce
# ne pouvait pas faire le tour de la poignée (mesuré : MP40 39 poses libres sur l'autre flanc, 173 ici ; STG-44 0 et 38).
rep("  thumb: { p: [-0.0215, -0.0085, -0.021], L: [0.041, 0.0335, 0.0275], r: [0.0125, 0.0112, 0.0101] },",
    "  thumb: { p: [-0.0235, -0.022, -0.022], L: [0.041, 0.0335, 0.0275], r: [0.0125, 0.0112, 0.0101] },   // base côté paume (jeu 2.0.6)")

# ------------------------------------------------------------------ BAR : détente et poignet de crosse (construction 2)
# Demande d'Anthony du 17 octobre 2026. Sur la vraie BAR M1918A2, le pontet est à l'arrière de la boîte de
# culasse, juste devant le poignet de la crosse, et la main droite tient ce poignet (environ 47 mm de haut).
# Le modèle mettait la détente 11 cm devant le bois et un poignet de 58 à 80 mm de haut : la main tenait la
# boîte d'acier (68 mm de haut), et le pouce ne pouvait pas en faire le tour. Détente et pontet reculés de
# 75 mm (devant le poignet) ; poignet de 50 mm de haut, son dessus 8 mm sous la boîte de culasse et son dessous
# à hauteur du pontet (l'index arrive à la détente par en dessous de la boîte sans la traverser ; mesuré sur cinq
# variantes). Boîte de culasse, hausse, chargeur, talon de la crosse et longueur totale inchangés.
shift_u("k.side(M.blue, [[0.832, -0.048], [0.9, -0.048], [0.898, -0.056, 0.003], [0.891, -0.0775, 0.008], [0.844, -0.0785, 0.01], [0.835, -0.056, 0.004]], 0.012, {\n      holes: [[[0.8415, -0.0515, 0.003], [0.8915, -0.0515, 0.003], [0.8855, -0.0715, 0.007], [0.8475, -0.0718, 0.008]]],",
        lambda u, v: True, lambda u, v: 0.075)
rep("    k.part('trigger', 0, -0.049, 0.867);\n    k.side(M.blue, [[0.862, -0.0485], [0.87, -0.0485], [0.872, -0.063, 0.003], [0.868, -0.0695, 0.002], [0.864, -0.063]], 0.0072);",
    "    k.part('trigger', 0, -0.049, 0.942);\n    k.side(M.blue, [[0.937, -0.0485], [0.945, -0.0485], [0.947, -0.063, 0.003], [0.943, -0.0695, 0.002], [0.939, -0.063]], 0.0072);")
rep("k.side(M.wood, [[0.98, 0.0085, 0.003], [1.205, -0.0035, 0.004], [1.214, -0.0115, 0.004], [1.214, -0.135, 0.006], [1.2, -0.139, 0.004], [1.05, -0.087, 0.05],\n      [0.99, -0.07, 0.012], [0.98, -0.05, 0.003]], 0.044,",
    "k.side(M.wood, [[0.98, 0.0085, 0.003], [1.005, -0.008, 0.02], [1.205, -0.0035, 0.004], [1.214, -0.0115, 0.004], [1.214, -0.135, 0.006], [1.2, -0.139, 0.004], [1.09, -0.09, 0.05],\n      [1.025, -0.058, 0.012], [0.98, -0.056, 0.003]], 0.044,")
