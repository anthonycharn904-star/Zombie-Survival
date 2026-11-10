# Marécages Maudits : retouches du moteur, reprises du kit « Zombie Survival 2.0.7 - a publier (Stryges) »
# (sources/tools/patches.py, SHA-256 80334a5342d1a014371600af62d8f8766b709196f995fa69dcf51a59e35fed55), par engine/marecages/outils/generer-retouches.py.
# Écarts avec le kit : la retouche GAME_VERSION est retirée (les numéros sont gérés par Claude 5, décision
# d'Anthony du 1er novembre 2026) ; « jeu 2.1.x » devient « kit MM 2.1.x » et « jeu 2.0.7 » devient « kit 2.0.7 »
# (versions de travail, jamais publiées : voir engine/marecages/LISEZ-MOI.md). Lu par l'étape sans être exécuté.
# Retouches du moteur pour le marais : (nom, motif exact, remplacement). Chaque motif doit apparaître
# une seule fois dans main.js. Les branches « marais » passent avant celles de Khamsin (la branche par
# défaut du moteur), comme celles de la Lune.
PATCHES = [
 # ---- chargement, déchargement, chaque image
 ('owLoad zones',
  "zones: (owWorldOf(map.base) === 'lune' ? LU.locs : KH.locs)",
  "zones: (owWorldOf(map.base) === 'lune' ? LU.locs : owWorldOf(map.base) === 'marais' ? MA.locs : KH.locs)"),
 ('owLoad marais',
  "  luUnload();                                          // depuis la Lune : jauge d'oxygène, objectifs, son de la combinaison\n  luGravity(false); LUS.on.value = 0;\n",
  "  luUnload();                                          // depuis la Lune : jauge d'oxygène, objectifs, son de la combinaison\n  luGravity(false); LUS.on.value = 0;\n  if (OW.worldId === 'marais') { maLoad(map, opts); return; }   // kit MM 2.1.0 : les Marécages Maudits\n  maUnload();\n"),
 ('owLoad lune après le marais',
  "  if (OW.worldId === 'lune') { luLoad(map, opts); return; }\n",
  "  if (OW.worldId === 'lune') { maUnload(); luLoad(map, opts); return; }   // kit MM 2.1.5 : du marais à la Lune, le marais se défait (brume, bête, sons)\n"),
 ('owUnload marais',
  "  if (OW.worldId === 'lune') luUnload();\n",
  "  if (OW.worldId === 'lune') luUnload();\n  if (OW.worldId === 'marais') maUnload();\n"),
 ('owUpdateView marais',
  "  if (OW.worldId === 'lune') { luUpdateView(dt); return; }\n",
  "  if (OW.worldId === 'lune') { luUpdateView(dt); return; }\n  if (OW.worldId === 'marais') { maUpdateView(dt); return; }\n"),
 ('owUpdate marais',
  "  if (OW.worldId === 'lune') { luUpdate(dt); return; }\n",
  "  if (OW.worldId === 'lune') { luUpdate(dt); return; }\n  if (OW.worldId === 'marais') { maUpdate(dt); return; }\n"),
 ('owResetWorld marais',
  "  if (OW.worldId === 'lune') { luResetWorld(); khEnemiesReset(); owResetFeatures(); return; }\n",
  "  if (OW.worldId === 'lune') { luResetWorld(); khEnemiesReset(); owResetFeatures(); return; }\n  if (OW.worldId === 'marais') { maResetWorld(); khEnemiesReset(); owResetVehicles(); owResetFeatures(); return; }\n"),
 ('owPickSpawn marais',
  "  if (OW.worldId === 'lune') return luPickSpawn();\n",
  "  if (OW.worldId === 'lune') return luPickSpawn();\n  if (OW.worldId === 'marais') return maPickSpawn();\n"),
 ('owGroundColor marais',
  "  if (OW.worldId === 'lune') return luGroundColor(k, x, z, out);\n",
  "  if (OW.worldId === 'lune') return luGroundColor(k, x, z, out);\n  if (OW.worldId === 'marais') return maGroundColor(k, x, z, out);\n"),
 ('owHud fond marais',
  "OWH.bg = OW.worldId === 'lune' ? luPlanCanvas",
  "OWH.bg = OW.worldId === 'marais' ? maPlanCanvas(1000, 1000, { relief: true, pins: false }) : OW.worldId === 'lune' ? luPlanCanvas"),
 ('owUpdateHud marques',
  "if (owBaseHasPlaces()) { if (OW.worldId === 'lune') luQuestMapMarks(g, X, Z, S); else khQuestMapMarks(g, X, Z, S); }",
  "if (owBaseHasPlaces()) { if (OW.worldId === 'lune') luQuestMapMarks(g, X, Z, S); else if (OW.worldId === 'marais') maMapMarks(g, X, Z, S); else khQuestMapMarks(g, X, Z, S); }"),
 ('owViewLum marais',
  "  if (OW.worldId === 'lune') return LU.inside ? 0.85 :",
  "  if (OW.worldId === 'marais') return clamp(0.5 + 0.3 * (MA.inside || 0) + 0.25 * maLampNear(), 0.42, 0.95);\n  if (OW.worldId === 'lune') return LU.inside ? 0.85 :"),
 ('owDarkness marais',
  "  if (OW.worldId === 'lune') return LU.inside ? 0.45 :",
  "  if (OW.worldId === 'marais') return 0.92;                // la nuit du marais\n  if (OW.worldId === 'lune') return LU.inside ? 0.45 :"),
 ('owBaseThumb marais',
  "  if (owWorldOf(base) === 'lune') return luThumb(base);\n",
  "  if (owWorldOf(base) === 'lune') return luThumb(base);\n  if (owWorldOf(base) === 'marais') return maThumb(base);\n"),
 ('owUseBase marais',
  "    if (OW.worldId === 'lune') luRasterBase(id); else owRasterPyramids();",
  "    if (OW.worldId === 'lune') luRasterBase(id); else if (OW.worldId !== 'marais') owRasterPyramids();"),
 ('owProtectMask marais',
  "  if (OW.worldId === 'lune') { luProtect(id, put); OW.protect[id] = M; return M; }\n",
  "  if (OW.worldId === 'lune') { luProtect(id, put); OW.protect[id] = M; return M; }\n  if (OW.worldId === 'marais') { maProtect(id, put); OW.protect[id] = M; return M; }\n"),
 ('owApplyMods pentes marais',
  "      if (OW.worldId === 'lune') steep[k] = luSteepRule(k, s, b);",
  "      if (OW.worldId === 'lune') steep[k] = luSteepRule(k, s, b);\n      else if (OW.worldId === 'marais') steep[k] = OW.water[k] ? 0 : maSteepRule(k, s, b);"),
 ('owBuildFeatures marais',
  "  if (OW.worldId === 'lune') luBuildFeatures(group, map);\n",
  "  if (OW.worldId === 'lune') luBuildFeatures(group, map);\n  if (OW.worldId === 'marais') maBuildFeatures(group, map);\n"),
 ('zoneOn Khamsin seulement',
  "const zoneOn = () => OW.on && OW.worldId !== 'lune' && ZONE.circles.length > 0;",
  "const zoneOn = () => OW.on && OW.worldId === 'khamsin' && ZONE.circles.length > 0;"),
 ('khSpeedType marais',
  "  if (OW.worldId === 'lune') return luSpeedType(r);\n",
  "  if (OW.worldId === 'lune') return luSpeedType(r);\n  if (OW.worldId === 'marais') return maSpeedType(r);\n"),
 ('khZombieType marais',
  "  if (OW.worldId === 'lune') return luZombieType();",
  "  if (OW.worldId === 'marais') return maZombieType();\n  if (OW.worldId === 'lune') return luZombieType();"),
 ('khLook marais',
  "  if (type && type.lu) return luLook(look, type);\n",
  "  if (type && type.lu) return luLook(look, type);\n  if (OW.on && OW.worldId === 'marais') return maLook(look, type);\n"),
 ('khSerialize marais',
  "  if (OW.worldId === 'lune') return { lu: luSerialize() };",
  "  if (OW.worldId === 'lune') return { lu: luSerialize() };\n  if (OW.worldId === 'marais') return { ma: maSerialize() };"),
 ('khRestore marais',
  "  if (OW.worldId === 'lune') { if (s.lu) luRestore(s.lu); return; }",
  "  if (OW.worldId === 'lune') { if (s.lu) luRestore(s.lu); return; }\n  if (OW.worldId === 'marais') { if (s.ma) maRestore(s.ma); return; }"),
 ('khMenuTips marais',
  "  if (map && map.open && owWorldOf(map.base) === 'lune') { luMenuTips(map); return; }",
  "  for (const id of ['tip-swamp', 'tip-beast']) { const e = $(id); if (e) e.hidden = true; }\n  if (map && map.open && owWorldOf(map.base) === 'marais') { maMenuTips(map); return; }\n  if (map && map.open && owWorldOf(map.base) === 'lune') { luMenuTips(map); return; }"),
 ('khOnRound marais',
  "function khOnRound(n) {\n",
  "function khOnRound(n) {\n  if (OW.on && OW.worldId === 'marais') { maOnRound(n); return; }\n"),
 # ---- catalogue
 ('BUILTIN_MAPS',
  "const BUILTIN_MAPS = [BUNKER7, KHAMSIN, OMBRE];",
  "const BUILTIN_MAPS = [BUNKER7, KHAMSIN, OMBRE, MARAIS];"),
 ('catalogue marais',
  "  if (!order.includes(OMBRE.id) && pubEditor < 4) order.splice(Math.min(2, order.length), 0, OMBRE.id);\n",
  "  if (!order.includes(OMBRE.id) && pubEditor < 4) order.splice(Math.min(2, order.length), 0, OMBRE.id);\n  if (!order.includes(MARAIS.id) && pubEditor < 10) order.splice(Math.min(3, order.length), 0, MARAIS.id);   // kit MM 2.1.0\n"),
]

HTML_PATCHES = [
 ('tampon en développement',
  '.ms-card[aria-selected="false"] .ms-stamp { display: none; }',
  '.ms-card[aria-selected="false"] .ms-stamp { display: none; }\n'
  '.ms-dev {\n'
  '  position: absolute; top: 18px; left: 16px; padding: 1px 7px; font-family: var(--font-display); font-weight: 900; font-size: 13px;\n'
  '  letter-spacing: 0.08em; text-transform: uppercase; color: #3b2f12; border: 2px dashed rgba(59, 47, 18, 0.85);\n'
  '  background: rgba(214, 178, 74, 0.9); transform: rotate(-4deg); pointer-events: none;\n'
  '}'),
 ('astuces marais',
  '<li id="tip-o2" hidden></li>',
  '<li id="tip-o2" hidden></li>\n        <li id="tip-swamp" hidden></li>\n        <li id="tip-beast" hidden></li>'),
]

# ---- barque, nage, eau (kit MM 2.1.0)
PATCHES += [
 ('vehStep barque',
  "function vehStep(V, dt, ctl) {\n  if (V.mech) { vehStepArcheo(V, dt, ctl); return; }",
  "function vehStep(V, dt, ctl) {\n  if (V.T.boat) { maBoatStep(V, dt, ctl); return; }         // kit MM 2.1.0 : la barque (eau seulement)\n  if (V.mech) { vehStepArcheo(V, dt, ctl); return; }"),
 ('vehPose barque',
  "function vehPose(V, dt, snap) {\n  const T = V.T, [fx, fz] = vehFwd(V.yaw), rx = -fz, rz = fx, a = T.wb / 2, b = T.track / 2;",
  "function vehPose(V, dt, snap) {\n  if (V.T.boat) { maBoatPose(V, dt, snap); return; }        // kit MM 2.1.0 : elle flotte\n  const T = V.T, [fx, fz] = vehFwd(V.yaw), rx = -fz, rz = fx, a = T.wb / 2, b = T.track / 2;"),
 ('vehCellFree barque',
  "function vehCellFree(x, z, gy, T) {\n  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(OW.surf, cx, cz);",
  "function vehCellFree(x, z, gy, T) {\n  if (T.boat) return maBoatCellFree(x, z);                 // kit MM 2.1.0 : la barque ne va que sur l'eau\n  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(OW.surf, cx, cz);"),
 ('vehEnter barque',
  "  vehSeat(V);\n  if (V.mech) {\n    // jeu 2.0.6 : la jeep démarre",
  "  vehSeat(V);\n  if (V.T.boat) { maBoatEnter(V); return; }               // kit MM 2.1.0 : vue embarquée, on tire\n  if (V.mech) {\n    // jeu 2.0.6 : la jeep démarre"),
 ('vehExit places barque',
  "  const spots = [[T.seat[2] * -1, -(T.wid / 2 + 0.7)], [T.seat[2] * -1, T.wid / 2 + 0.7], [-(T.len / 2 + 0.9), 0], [T.len / 2 + 0.9, 0], [0, -(T.wid / 2 + 1.6)], [0, T.wid / 2 + 1.6]];",
  "  const spots = T.boat ? maBoatExitSpots(V) : [[T.seat[2] * -1, -(T.wid / 2 + 0.7)], [T.seat[2] * -1, T.wid / 2 + 0.7], [-(T.len / 2 + 0.9), 0], [T.len / 2 + 0.9, 0], [0, -(T.wid / 2 + 1.6)], [0, T.wid / 2 + 1.6]];"),
 ('vehExit barque à l’eau',
  "  if (!pos) { if (!force) { HUD.hint('Pas de place pour descendre ici', 1.5); return; } pos = [V.x + rx * -(T.wid / 2 + 0.7), V.z + rz * -(T.wid / 2 + 0.7)]; }",
  "  if (!pos) {\n    if (!force) { HUD.hint(T.boat ? 'Pas de berge ni de ponton ici : approchez-vous' : 'Pas de place pour descendre ici', 1.5); return; }\n    if (T.boat) { maBoatBail(V); return; }                 // kit MM 2.1.0 : à terre dans la barque, au large : à l'eau\n    pos = [V.x + rx * -(T.wid / 2 + 0.7), V.z + rz * -(T.wid / 2 + 0.7)];\n  }"),
 ('vehExit son barque',
  "  Arms.root.visible = true;\n  vehSoundStop();\n  player.yaw = V.yaw + VEH.lookYaw; player.pitch = 0;",
  "  Arms.root.visible = true;\n  vehSoundStop();\n  if (T.boat) { maBoatSoundStop(); MA.exitCam = { p: camera.position.clone(), t: 0 }; }   // kit MM 2.1.0 : on descend en douceur\n  player.yaw = V.yaw + VEH.lookYaw; player.pitch = 0;"),
 ('owDriveStep vue barque',
  "    VEH.lookYaw = 0; VEH.lookPitch = VEH.view ? 0 : -0.12; vehGlass(V); }",
  "    VEH.lookYaw = 0; VEH.lookPitch = VEH.view ? 0 : -0.12; vehGlass(V); if (V.T.boat) Arms.root.visible = !!VEH.view; }"),
 ('vehCamera barque',
  "  if (Number.isFinite(g) && _vc.y < g + 0.8) _vc.y = g + 0.8;",
  "  if (Number.isFinite(g) && _vc.y < g + 0.8) _vc.y = g + 0.8;\n  if (T.boat && _vc.y < MA.water + 0.7) _vc.y = MA.water + 0.7;   // kit MM 2.1.0 : jamais sous l'eau"),
 ('updateArms barque nage',
  "  if (OW.on && (owDriving() || KHP.busy > 0)) { player.ads = 0; return; }",
  "  if (OW.on && ((owDriving() && !(VEH.drive.T.boat && VEH.view === 1)) || KHP.busy > 0 || MA_SWIM.on)) { player.ads = 0; return; }   // kit MM 2.1.0 : en barque, vue embarquée, on tire ; à la nage, non"),
 ('vehInteractable hold barque',
  "    get hold() { return (!!V.stuck || !!V.flipped) && !VEH.drive; },",
  "    get hold() { return (!!V.stuck || !!V.flipped || !!V.capsized) && !VEH.drive; },"),
 ('vehInteractable useHold barque',
  "    useHold(dt) {\n      if (V.flipped) {\n        if (V.unflipping) return;",
  "    useHold(dt) {\n      if (V.capsized) { maBoatRight(V, dt); return; }       // kit MM 2.1.0 : barque chavirée\n      if (V.flipped) {\n        if (V.unflipping) return;"),
 ('vehInteractable prompt barque',
  "      if (V.flipped) return { text: 'Maintenez F pour remettre le véhicule sur ses roues'",
  "      if (V.capsized) return { text: 'Maintenez F pour retourner la barque', sub: `${Math.round(((V.rightT || 0) / 3) * 100)} %` };\n      if (V.flipped) return { text: 'Maintenez F pour remettre le véhicule sur ses roues'"),
 ('vehInteractable prompt épave',
  "      if (V.flipping || V.unflipping) return null;",
  "      if (V.flipping || V.unflipping || V.wrecked) return null;   // kit MM 2.1.3 : barque détruite"),
 ('vehInteractable use épave',
  "      if (VEH.drive || V.flipped || V.flipping || V.unflipping) return;",
  "      if (VEH.drive || V.flipped || V.flipping || V.unflipping || V.wrecked) return;"),
 ('owResetVehicles barque',
  "    vehPose(V, 0, true);\n    if (V.jeep) { jeepLights(V, false); V.jeep.update(0, V.mech.state); }",
  "    if (V.T.boat) { maBoatReset(V); if (V.wake) V.wake.pts.length = 0; }\n    vehPose(V, 0, true);\n    if (V.jeep) { jeepLights(V, false); V.jeep.update(0, V.mech.state); }"),
 ('openValidate barque',
  "      if (owWaterAt(v.x, v.z)) E(`${T.name} : dans l’eau.`, [v.x, v.z]);",
  "      if (T.boat) { if (!owWaterAt(v.x, v.z) && !(OW.worldId === 'marais' && maDepth(v.x, v.z) > 0.4)) E(`${T.name} : hors de l’eau.`, [v.x, v.z]); }\n      else if (owWaterAt(v.x, v.z)) E(`${T.name} : dans l’eau.`, [v.x, v.z]);"),
 ('owEditorPlace barque',
  "    if (owWaterAt(x, z)) return { ok: false, why: 'Pas dans l’eau.' };",
  "    if (opts && opts.type && VEH_TYPES[opts.type] && VEH_TYPES[opts.type].boat) { const ok = owWaterAt(x, z) || (OW.worldId === 'marais' && maDepth(x, z) > 0.4); return { ok, x: r3(x), z: r3(z), y: r3(MA.water), why: ok ? '' : 'Une barque se pose sur l’eau.' }; }\n    if (owWaterAt(x, z)) return { ok: false, why: 'Pas dans l’eau.' };"),
 ('updatePlayer nage',
  "  if (OW.on && owDriving()) { if (GL.actif) glReset(); owDriveStep(dt); owPlayerVitals(dt); return; }",
  "  if (OW.on && owDriving()) { if (GL.actif) glReset(); owDriveStep(dt); owPlayerVitals(dt); return; }\n  if (OW.on && MA_SWIM.on) { if (GL.actif) glReset(); maSwimStep(dt); owPlayerVitals(dt); return; }   // kit MM 2.1.0 : à la nage"),
 ('updatePlayer patauger',
  "  if (endurance) speed *= 1.07;",
  "  if (endurance) speed *= 1.07;\n  if (OW.on && OW.worldId === 'marais') speed *= maWalkK(p.pos.x, p.pos.z);   // kit MM 2.1.2 : l'eau et la vase ralentissent, pas les planches"),
 ('chase patauger',
  "  let sp = z.crawl ? (z.crawlT < 0.55 ? 0 : z.crawlSpeed) : z.speed * (z.stagger > 0 ? 0.25 : 1);",
  "  let sp = z.crawl ? (z.crawlT < 0.55 ? 0 : z.crawlSpeed) : z.speed * (z.stagger > 0 ? 0.25 : 1);\n  if (OW.on && OW.worldId === 'marais') sp *= maWadeK(z.pos.x, z.pos.z);"),
 ('chase attente sur la rive',
  "  z.farT = flowAt(z.k) > 42 && !z.los ? z.farT + dt : 0;",
  "  z.farT = flowAt(z.k) > 42 && !z.los && !maHoldZombies() ? z.farT + dt : 0;   // kit MM 2.1.0 : sur l'eau, ils attendent sur la rive"),
 ('chase pas de recyclage sur l’eau',
  "  if (z.farT > 12 || z.stuck >= 2) recycleZombie(z);",
  "  if (z.farT > 12 || (z.stuck >= 2 && !maHoldZombies())) recycleZombie(z);"),
 ('owSandBurst marais',
  "function owSandBurst(x, z, y) {",
  "function owSandBurst(x, z, y) {\n  if (OW.worldId === 'marais') { maMudBurst(x, z, y); return; }   // kit MM 2.1.0 : vase et eau"),
 ('owSandHit marais',
  "function owSandHit(x, y, z, nx, ny, nz) {",
  "function owSandHit(x, y, z, nx, ny, nz) {\n  if (OW.worldId === 'marais') { maMudHit(x, y, z, nx, ny, nz); return; }"),
 ('HUD coque',
  "    OWH.dName.textContent = !J ? V.T.name :",
  "    OWH.dName.textContent = !J ? (V.T.boat ? `${V.T.name} · coque ${Math.round(V.hull)} %` : V.T.name) :"),
]

# ---- tirs, projectiles, grenades, explosions dans le marais ; interface (kit MM 2.1.0)
PATCHES += [
 ('fireWeapon bruit',
  "  muzzleFlash(def, s.up);\n  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;\n  const mw = muzzleWorld();\n",
  "  muzzleFlash(def, s.up);\n  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;\n  const mw = muzzleWorld();\n  if (OW.on && OW.worldId === 'marais') maNoise(ox, oz, 'shot');   // kit MM 2.1.0 : la bête entend les coups de feu\n"),
 ('hitscan let',                                     # motif raccourci le 10 novembre 2026 : Bunker 7 (hooks-visionnaire.py) change la fin de la ligne
  "  const wallT = RAY.t, wallHit = RAY.hit, ",
  "  let wallT = RAY.t, wallHit = RAY.hit, "),
 ('hitscan eau bête',
  "  const wx = RAY.x, wy = RAY.y, wz = RAY.z, wnx = RAY.nx, wny = RAY.ny, wnz = RAY.nz;\n  _hits.length = 0;\n",
  "  const wx = RAY.x, wy = RAY.y, wz = RAY.z, wnx = RAY.nx, wny = RAY.ny, wnz = RAY.nz;\n"
  "  // kit MM 2.1.0 : le marais. La balle s'arrête dans l'eau (un mètre) ; la bête est une cible\n"
  "  const MW = OW.on && OW.worldId === 'marais' ? maShot(s, ox, oy, oz, dx, dy, dz, wallT) : null;\n"
  "  if (MW) { if (MW.stopT < wallT) { wallT = MW.stopT; wallHit = false; } if (MW.mon && MW.mon.t < wallT) wallT = MW.mon.t; }\n"
  "  _hits.length = 0;\n"),
 ('hitscan bête touchée',
  "  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;\n  if (Math.random() < (def.auto ? 0.5 : 0.85)) addTracer(",
  "  if (MW && MW.mon && !stopped) { maShotHit(s, MW, dx, dy, dz, dmg); endT = MW.mon.t; stopped = true; }\n"
  "  const ex = ox + dx * endT, ey = oy + dy * endT, ez = oz + dz * endT;\n  if (Math.random() < (def.auto ? 0.5 : 0.85)) addTracer("),
 ('hitscan gerbe',
  "    if (boom && explode(wx + wnx * 0.25, wy + wny * 0.25, wz + wnz * 0.25, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s })) Arms.shotHit = true;\n  }\n}\n",
  "    if (boom && explode(wx + wnx * 0.25, wy + wny * 0.25, wz + wnz * 0.25, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s })) Arms.shotHit = true;\n  }\n"
  "  if (MW) maShotEnd(MW, ox, oy, oz, dx, dy, dz, endT, s);   // kit MM 2.1.0 : la gerbe où elle entre dans l'eau\n}\n"),
 ('blastCone bête',
  "    hit++;\n  }\n  for (let i = 0; i < 6; i++) {\n    spawnPuff(ox + _fwd.x * (1 + i * 1.2)",
  "    hit++;\n  }\n  if (OW.on && OW.worldId === 'marais') hit += maBlastCone(ox, oy, oz, b, s);   // kit MM 2.1.0\n  for (let i = 0; i < 6; i++) {\n    spawnPuff(ox + _fwd.x * (1 + i * 1.2)"),
 ('projectiles eau bête',
  "    let hitT = Infinity, hitZ = null;\n    raycast(p.x, p.y, p.z, dx, dy, dz, step);\n    if (RAY.hit) hitT = RAY.t;\n",
  "    let hitT = Infinity, hitZ = null, hitM = null;\n    raycast(p.x, p.y, p.z, dx, dy, dz, step);\n    if (RAY.hit) hitT = RAY.t;\n"
  "    if (OW.on && OW.worldId === 'marais') {                // kit MM 2.1.0 : elle éclate à la surface de l'eau, ou sur la bête\n"
  "      const tw = maRayWater(p.y, dy); if (tw < hitT) hitT = tw;\n"
  "      hitM = maRayMonster(p.x, p.y, p.z, dx, dy, dz, Math.min(step, hitT)); if (hitM) hitT = hitM.t;\n"
  "    }\n"),
 ('projectiles coup direct bête',
  "      if (hitZ && p.proj.direct) damageZombie(hitZ, p.proj.direct, { kind: 'explosive', src: p.proj.type, dx, dz, force: 4, slot: p.slot });\n",
  "      if (hitZ && p.proj.direct) damageZombie(hitZ, p.proj.direct, { kind: 'explosive', src: p.proj.type, dx, dz, force: 4, slot: p.slot });\n"
  "      else if (hitM && p.proj.direct) maBeastDamage(p.proj.direct, hitM.part, { kind: 'explosive', under: hitM.under });\n"),
 ('grenade dans l’eau',
  "    g.vy -= GRAV.feel * dt;\n    const sp = Math.hypot(g.vx, g.vy, g.vz);\n",
  "    g.vy -= GRAV.feel * dt;\n    if (OW.on && OW.worldId === 'marais') maNadeWater(g, dt);   // kit MM 2.1.0 : elle plonge et coule\n    const sp = Math.hypot(g.vx, g.vy, g.vz);\n"),
 ('explode marais',                                  # motif raccourci le 10 novembre 2026 : Bunker 7 (hooks-camion.py, hooks-caisses.py) ajoute deux lignes en tête
  "function explode(x, y, z, radius, damage, opts = {}) {\n",
  "function explode(x, y, z, radius, damage, opts = {}) {\n"
  "  if (OW.on && OW.worldId === 'marais') { const w = maExplodeWater(x, y, z, radius, damage, opts); if (w >= 0) return w; }   // kit MM 2.1.0 : la bête ; sous l'eau, une gerbe\n"),
 ('window.ZS marais',
  "window.ZS = {\n  version: GAME_VERSION, editorApi: EDITOR_API, build: GAME_BUILD, ready: false,\n",
  "window.ZS = {\n  marais: MA_API,                                       // kit MM 2.1.0 : crochets du marais (quêtes à venir), réglages de la bête\n  version: GAME_VERSION, editorApi: EDITOR_API, build: GAME_BUILD, ready: false,\n"),
]

# ---- le barreur : corps d'Anthony assis dans la barque (vue à la 3e personne, coop), montée en douceur
PATCHES += [
 ('persoEtatLocal siège barque',
  "    siege: V && V.jeep ? { V, place: 'conducteur', thr: VEH.thr || 0 } : null,\n",
  "    siege: V && (V.jeep || V.barque) ? { V, place: 'conducteur', thr: VEH.thr || 0 } : null,   // kit MM 2.1.0 : la barque aussi\n"),
 ('persoEtatLocal visible barque',
  "  E.visible = E.playing && !E.cinematique && !(V && !V.jeep) && !(E.down && E.vue === 'fps');\n",
  "  E.visible = E.playing && !E.cinematique && !(V && !V.jeep && !(V.barque && !VEH.view)) && !(E.down && E.vue === 'fps');   // kit MM 2.1.0 : barque, vue de poursuite\n"),
 ('persoAssis barque',
  "function persoAssis(av, E, dt) {\n  const V = E.siege.V, J = V.jeep,",
  "function persoAssis(av, E, dt) {\n  if (E.siege.V.barque) { persoAssisBarque(av, E, dt); return; }   // kit MM 2.1.0 : le barreur\n  const V = E.siege.V, J = V.jeep,"),
 ('vehCamera montée barque',
  "    camera.quaternion.setFromEuler(_ve);\n    camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');\n    return;\n  }\n",
  "    camera.quaternion.setFromEuler(_ve);\n    camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');\n"
  "    if (T.boat) maBoatCamConfort(V);                      // confort (Marécages, ma00) : sans les secousses de la barque, sauf si réglées\n"
  "    if (T.boat && VEH.boardCam) maBoatBoardCam(dt);       // kit MM 2.1.0 : on enjambe le plat-bord\n    return;\n  }\n"),
]

# ---- les Noyés (kit MM 2.1.6) : zombies aquatiques du marais (src/ma/ma15_noyes.js)
PATCHES += [
 ('matières des noyés',
  "  MAT.khBone = std({ vertexColors: true, roughness: 0.82, emissive: 0x16110b, emissiveIntensity: 1 });   // Khamsin : os secs du Rôdeur\n",
  "  MAT.khBone = std({ vertexColors: true, roughness: 0.82, emissive: 0x16110b, emissiveIntensity: 1 });   // Khamsin : os secs du Rôdeur\n"
  "  // kit MM 2.1.6 : les Noyés du marais, peau gorgée d'eau et étoffes trempées (luisantes) ; sous l'eau, le corps se perd dans l'eau croupie (maNoyeMurk)\n"
  "  MAT.maNoyeSkin = maNoyeMurk(std({ map: share(maNoyeSkinTex()), vertexColors: true, roughness: 0.38, emissive: 0x1e2c28, emissiveIntensity: 1 }));\n"
  "  MAT.maNoyeCloth = maNoyeMurk(std({ map: share(maNoyeClothTex()), vertexColors: true, roughness: 0.62, emissive: 0x161c18, emissiveIntensity: 1 }));\n"),
 ('zPartVisible pièce facultative',
  "function zPartVisible(z, def, side) {\n  if (def.head && z.headless) return false;\n",
  "function zPartVisible(z, def, side) {\n  if (def.head && z.headless) return false;\n  if (def.opt && !z.look[def.opt]) return false;          // kit MM 2.1.6 : pièce facultative (Noyés : cheveux, bonnet)\n"),
 ('updateZombie noyés',
  "  if (z.boss) { khGardienUpdate(z, dt); return; }      // Khamsin : le Gardien\n",
  "  if (z.boss) { khGardienUpdate(z, dt); return; }      // Khamsin : le Gardien\n  if (z.noye) return;                                  // kit MM 2.1.6 : les Noyés (maNoyesUpdate, après la barque)\n"),
 ('killZombie noyés',
  "  if (z.boss) return;                                  // le Gardien meurt par ses dégâts\n",
  "  if (z.boss) return;                                  // le Gardien meurt par ses dégâts\n  if (z.noye) { maNoyeKill(z, info); return; }         // kit MM 2.1.6 : hors du décompte de la manche\n"),
 ('rayHitZombie noyés',
  "  if (z.boss) return khGardienRay(z, ox, oy, oz, dx, dy, dz, extra);\n",
  "  if (z.boss) return khGardienRay(z, ox, oy, oz, dx, dy, dz, extra);\n  if (z.noye) return maNoyeRay(z, ox, oy, oz, dx, dy, dz, extra);   // kit MM 2.1.6\n"),
 ('startCrawl noyés',
  "  if (z.dog || z.crawl || !z.alive || z.state === 'rise' || z.state === 'climb') return false;",
  "  if (z.dog || z.noye || z.crawl || !z.alive || z.state === 'rise' || z.state === 'climb') return false;"),
 ('vehZombies noyés',
  "    if (!z.alive || z.boss || z.state === 'rise' || Math.abs(z.gy - V.y) > 2.2) continue;",
  "    if (!z.alive || z.boss || z.noye || z.state === 'rise' || Math.abs(z.gy - V.y) > 2.2) continue;   // kit MM 2.1.6 : les Noyés ont leur contact (ma15)"),
 ('fiche du Noyé',
  "luSpecimenSetup();                                    // Lune : fiches de l'Astronaute et du Mineur\n",
  "luSpecimenSetup();                                    // Lune : fiches de l'Astronaute et du Mineur\n\nmaNoyeSpecimenSetup();                                // kit MM 2.1.6 : fiche du Noyé (Marécages Maudits)\n"),
 ('setModelAnim noyé',
  "  if (Models.sel === DOG_TYPE.id || Models.sel === RODEUR_TYPE.id) {",
  "  if (Models.sel === MA_NOYE_TYPE.id) { maNoyeSpecSound(k); return; }   // kit MM 2.1.6 : ses propres sons\n  if (Models.sel === DOG_TYPE.id || Models.sel === RODEUR_TYPE.id) {"),
 # kit MM 2.1.7 : jusqu'à 20 Noyés à la fois ; ils ne prennent pas les places des zombies ordinaires (24 au plus)
 # kit 2.0.7 : une map marquée dev (les Marécages Maudits) porte le tampon « En développement » dans le choix des maps
 ('carte en développement',
  "    card.append(photo, el('span', 'ms-stamp', 'Choisie'), el('b', 'ms-name', map.name));",
  "    card.append(photo, el('span', 'ms-stamp', 'Choisie'), el('b', 'ms-name', map.name));\n    if (map.dev) card.append(el('span', 'ms-dev', 'En développement'));   // kit 2.0.7"),
 ('aliveCount sans les noyés',
  "function aliveCount() {\n  let n = 0;\n  for (const z of Zombies.list) if (z.alive) n++;\n  return n;\n}",
  "function aliveCount() {\n  let n = 0;\n  for (const z of Zombies.list) if (z.alive && !z.noye) n++;   // kit MM 2.1.7 : les Noyés à part (ils ont leur plafond)\n  return n;\n}"),
]

# ---- les Stryges (kit 2.0.7) : manche spéciale volante du marais (src/ma/ma16_stryges.js)
PATCHES += [
 ('matières des stryges',
  "  MAT.maNoyeCloth = maNoyeMurk(std({ map: share(maNoyeClothTex()), vertexColors: true, roughness: 0.62, emissive: 0x161c18, emissiveIntensity: 1 }));\n",
  "  MAT.maNoyeCloth = maNoyeMurk(std({ map: share(maNoyeClothTex()), vertexColors: true, roughness: 0.62, emissive: 0x161c18, emissiveIntensity: 1 }));\n"
  "  maStrygeMaterials(std);                              // kit 2.0.7 : les Stryges du marais (peau, étoffe, membrane en éventail)\n"),
 ('fiche de la Stryge',
  "maNoyeSpecimenSetup();                                // kit MM 2.1.6 : fiche du Noyé (Marécages Maudits)\n",
  "maNoyeSpecimenSetup();                                // kit MM 2.1.6 : fiche du Noyé (Marécages Maudits)\n"
  "maStrygeSpecimenSetup();                              // kit 2.0.7 : fiche de la Stryge (N°07)\n"),
 ('setModelAnim stryge',
  "  if (Models.sel === MA_NOYE_TYPE.id) { maNoyeSpecSound(k); return; }   // kit MM 2.1.6 : ses propres sons\n",
  "  if (Models.sel === MA_NOYE_TYPE.id) { maNoyeSpecSound(k); return; }   // kit MM 2.1.6 : ses propres sons\n"
  "  if (Models.sel === MA_STRYGE_TYPE.id) { maStrygeSpecSound(k); return; }   // kit 2.0.7\n"),
 ('bouton tir dans l’aile',
  "  if (!model.dog) {\n    const arm = el('button', 'md-chip alt', 'Tir au bras');",
  "  if (model.wing) {\n"
  "    // kit 2.0.7 : la Stryge, un tir dans la membrane (au deuxième, elle s'écrase)\n"
  "    const shot = el('button', 'md-chip alt', 'Tir dans l’aile');\n"
  "    shot.type = 'button';\n"
  "    shot.dataset.action = 'wing';\n"
  "    shot.addEventListener('click', () => { Sound.init(); if (Models.spec && Models.spec.wingShot) Models.spec.wingShot(); });\n"
  "    box.append(shot);\n"
  "  } else if (!model.dog) {\n    const arm = el('button', 'md-chip alt', 'Tir au bras');"),
 ('updateZombie stryges',
  "  if (z.noye) return;                                  // kit MM 2.1.6 : les Noyés (maNoyesUpdate, après la barque)\n",
  "  if (z.noye) return;                                  // kit MM 2.1.6 : les Noyés (maNoyesUpdate, après la barque)\n"
  "  if (z.stryge) return;                                // kit 2.0.7 : les Stryges (maStrygesUpdate, après les Noyés)\n"),
 ('killZombie stryges',
  "  if (z.noye) { maNoyeKill(z, info); return; }         // kit MM 2.1.6 : hors du décompte de la manche\n",
  "  if (z.noye) { maNoyeKill(z, info); return; }         // kit MM 2.1.6 : hors du décompte de la manche\n"
  "  if (z.stryge) { maStrygeKill(z, info); return; }     // kit 2.0.7\n"),
 ('rayHitZombie stryges',
  "  if (z.noye) return maNoyeRay(z, ox, oy, oz, dx, dy, dz, extra);   // kit MM 2.1.6\n",
  "  if (z.noye) return maNoyeRay(z, ox, oy, oz, dx, dy, dz, extra);   // kit MM 2.1.6\n"
  "  if (z.stryge) return maStrygeRay(z, ox, oy, oz, dx, dy, dz, extra);   // kit 2.0.7 : corps, tête, membranes (trous compris)\n"),
 # motif raccourci (1er novembre 2026) : Bunker 7 insère sa ligne du boss entre l'en-tête de damageZombie et celle du
 # Gardien ; le contrôle de la déclaration englobante (damageZombie) garde la retouche à sa place
 ('damageZombie stryges',
  "  if (z.boss) return khGardienDamage(z, amount, info);\n",
  "  if (z.boss) return khGardienDamage(z, amount, info);\n"
  "  if (z.stryge) return maStrygeDamage(z, amount, info);   // kit 2.0.7 : ailes, chute, noyade\n"),
 ('startCrawl stryges',
  "  if (z.dog || z.noye || z.crawl || !z.alive || z.state === 'rise' || z.state === 'climb') return false;",
  "  if (z.dog || z.noye || z.stryge || z.crawl || !z.alive || z.state === 'rise' || z.state === 'climb') return false;   // kit 2.0.7 : les Stryges ont leur chute"),
 ('gibArm stryges',
  "function gibArm(z, side, dx = 0, dz = 0) {\n  if (z.dog || (z.gib & side)) return false;",
  "function gibArm(z, side, dx = 0, dz = 0) {\n  if (z.dog || z.stryge || (z.gib & side)) return false;   // kit 2.0.7 : pas de bras arraché à une Stryge"),
 ('zLegHit stryges',
  "function zLegHit(z, dx, dz, hx, hz, def) {\n  if (z.dog) return false;",
  "function zLegHit(z, dx, dz, hx, hz, def) {\n  if (z.dog || z.stryge) return false;"),
 ('vehZombies stryges',
  "    if (!z.alive || z.boss || z.noye || z.state === 'rise' || Math.abs(z.gy - V.y) > 2.2) continue;   // kit MM 2.1.6 : les Noyés ont leur contact (ma15)",
  "    if (!z.alive || z.boss || z.noye || z.stryge || z.state === 'rise' || Math.abs(z.gy - V.y) > 2.2) continue;   // kit MM 2.1.6 : les Noyés ont leur contact (ma15) ; kit 2.0.7 : les Stryges volent"),
 # la manche spéciale : celle des chiens (même tirage, même nombre, mêmes vagues), avec les Stryges dans le marais
 ('newGame manches de stryges',
  "  if (OW.on && G.dogs) G.dogs.off = true;              // monde ouvert : pas de manches de chiens\n",
  "  if (OW.on && G.dogs) G.dogs.off = OW.worldId !== 'marais';   // monde ouvert : pas de manches de chiens (kit 2.0.7 : le marais a celles des Stryges)\n"),
 ('startRound PV des stryges',
  "  G.zombieHp = G.dogRound ? dogHpForRound(n) : OW.on ? khHp(n) : zombieHpForRound(n);   // Khamsin : 150, +100 par manche\n",
  "  G.zombieHp = G.dogRound ? (maStrygeRoundOn() ? maStrygeHp(n) : dogHpForRound(n)) : OW.on ? khHp(n) : zombieHpForRound(n);   // Khamsin : 150, +100 par manche ; kit 2.0.7 : Stryges ×1,3\n"),
 ('dogRoundStart stryges',
  "function dogRoundStart() {\n",
  "function dogRoundStart() {\n  if (maStrygeRoundOn()) { maStrygeRoundStart(); return; }   // kit 2.0.7 : dans le marais, les Stryges\n"),
 ('updateDogSpawns stryges',
  "function updateDogSpawns(dt) {\n",
  "function updateDogSpawns(dt) {\n  if (maStrygeRoundOn()) { maStrygeSpawns(dt); return; }      // kit 2.0.7 : mêmes vagues, dans le ciel du marais\n"),
 ('endRound stryges',
  "  if (G.dogRound) { G.dogs.n++; G.dogRound = false; Sound.dogRoundEnd(); } else Sound.roundEnd();\n",
  "  if (G.dogRound) { G.dogs.n++; G.dogRound = false; if (maStrygeRoundOn()) maStrygeRoundEnd(); else Sound.dogRoundEnd(); } else Sound.roundEnd();   // kit 2.0.7 : fin des Stryges\n"),
 ('onZombieKilled stryges',
  "  if (z.dog) { if (G.roundState === 'active' && G.dogRound && G.killed + 1 >= G.total) spawnPowerup('ammo', z.pos.x, z.pos.z, z.gy); }\n",
  "  if (z.stryge) { if (G.roundState === 'active' && G.dogRound && G.killed + 1 >= G.total) maStrygeLastDrop(z); }   // kit 2.0.7 : la dernière Stryge, munitions max\n"
  "  else if (z.dog) { if (G.roundState === 'active' && G.dogRound && G.killed + 1 >= G.total) spawnPowerup('ammo', z.pos.x, z.pos.z, z.gy); }\n"),
 ('HUD manche des stryges',
  "    el.classList.toggle('dogs', !!G.dogRound);\n",
  "    el.classList.toggle('dogs', !!G.dogRound);\n    el.classList.toggle('stryges', !!G.dogRound && maStrygeRoundOn());   // kit 2.0.7 : le compteur rouge des Stryges\n"),
]
# ---- la pluie et l'orage (kit 2.0.7, src/ma/ma17_pluie.js, ma18_orage.js) : la foudre tue les zombies proches ;
# ils comptent pour la manche, sans points (kind 'nuke') ni relevés du joueur (éliminations, carrière, rang)
PATCHES += [
 ('killZombie foudre',
  "  G.stats.kills++;\n  Life.kill(info, z.type);\n  Rank.kill(info);\n  if (info.head && info.kind === 'bullet') {\n    G.stats.headshots++;\n",
  "  if (!info.foudre) { G.stats.kills++; Life.kill(info, z.type); Rank.kill(info); }   // kit 2.0.7 : la foudre du marais n'est pas le joueur\n"
  "  if (info.head && info.kind === 'bullet') {\n    G.stats.headshots++;\n"),
]
HTML_PATCHES += [
 ('compteur des stryges',
  '#round.dogs.pulse { animation-name: roundpulse-dogs; }',
  '#round.dogs.pulse { animation-name: roundpulse-dogs; }\n'
  '/* kit 2.0.7 : manche de Stryges (marais) : le rouge de leurs yeux */\n'
  '#round.dogs.stryges { color: #ff2e3a; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.65)) drop-shadow(0 0 16px rgba(255, 46, 58, 0.5)); }\n'
  '#round.dogs.stryges.pulse { animation-name: roundpulse-stryges; }\n'
  '@keyframes roundpulse-stryges {\n  0%, 20%, 40%, 60% { color: var(--paper); }\n  10%, 30%, 50%, 70%, 100% { color: #ff2e3a; }\n}'),
 ('bannière des stryges',
  '#banner.dogs #banner-title { color: #ffb000; text-shadow: 0 0 18px rgba(255, 176, 0, 0.5), 0 3px 0 rgba(0, 0, 0, 0.6); }',
  '#banner.dogs #banner-title { color: #ffb000; text-shadow: 0 0 18px rgba(255, 176, 0, 0.5), 0 3px 0 rgba(0, 0, 0, 0.6); }\n'
  '#banner.stryges #banner-title { color: #ff2e3a; text-shadow: 0 0 18px rgba(255, 46, 58, 0.55), 0 3px 0 rgba(0, 0, 0, 0.6); }'),
]
