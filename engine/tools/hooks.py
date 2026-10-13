# Points d'accroche du monde ouvert dans le moteur (exécuté par build.py : rep, ins_after, ins_before).
# Quand OW.on est vrai, les fonctions de la grille passent la main au module « 12 MONDE OUVERT ».

# ---------------------------------------------------------------- CSS du HUD
ins_before('#zone-name {\n  position: absolute; left: calc(26px', '''/* Khamsin (jeu 2.0.0) : mini-carte en haut à droite (nord en haut), boussole en haut au milieu */
.ow-minimap { position: absolute; right: calc(22px + env(safe-area-inset-right, 0px)); top: calc(16px + env(safe-area-inset-top, 0px)); width: clamp(132px, 15vw, 220px); height: auto; filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55)); }
.ow-compass { position: absolute; left: 50%; top: calc(8px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); width: min(520px, calc(100vw - 2 * clamp(132px, 15vw, 220px) - 80px)); height: auto; }
.ow-storm { position: absolute; left: 50%; top: calc(58px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); padding: 3px 14px; font-weight: 700; font-size: 17px; letter-spacing: 0.16em; text-transform: uppercase; color: #f5e6cf; background: rgba(76, 31, 16, 0.72); box-shadow: 0 0 0 1px rgba(233, 136, 77, 0.6); text-shadow: 0 1px 0 #000; white-space: nowrap; }
.ow-storm.alert { color: #f5c88d; }
.ow-storm.tempete { color: #e9884d; }
.ow-storm.khamsin { color: #ff6a4d; background: rgba(40, 10, 4, 0.82); animation: owstorm 1.2s steps(1) infinite; }
@keyframes owstorm { 50% { box-shadow: 0 0 0 2px rgba(226, 64, 42, 0.9); } }
.ow-drive { position: absolute; right: calc(28px + env(safe-area-inset-right, 0px)); bottom: calc(22px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6); }
.ow-drive .nm { font-weight: 600; font-size: 16px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--paper); }
.ow-drive .row { display: flex; align-items: baseline; gap: 6px; }
.ow-drive .spd { font-weight: 700; font-size: 46px; line-height: 1; font-variant-numeric: tabular-nums; color: var(--paper); }
.ow-drive .u { font-size: 18px; font-weight: 600; color: var(--steel); }
.ow-drive .fuel { width: 150px; height: 8px; background: rgba(0, 0, 0, 0.55); box-shadow: 0 0 0 1px rgba(245, 200, 141, 0.55); }
.ow-drive .fuel i { display: block; height: 100%; background: #e9884d; }
.ow-drive .fuel.low i { background: var(--blood-hi); }
#hud.ow-driving #crosshair, #hud.ow-driving #weapon { visibility: hidden; }
''')

# ---------------------------------------------------------------- grille
rep('const levelOfNode = (k) => (k / GN) | 0;',
    'const levelOfNode = (k) => (OW.on ? owKl(k) : (k / GN) | 0);    // monde ouvert : couche du nœud')
ins_after('function surfY(k, x, z) {\n',
          '  if (OW.on) { const g = owGroundAt(owKl(k), x, z); return Number.isFinite(g) ? g : owH(x, z); }\n')
rep('const walkNode = (k) => surfK[k] > 0 && (grid[k] === T.FLOOR || (grid[k] === T.DOOR && doorOpen[k] === 1));',
    'const walkNode = (k) => (OW.on ? k >= 0 && owWalkCell(owKl(k), owKx(k), owKz(k)) : surfK[k] > 0 && (grid[k] === T.FLOOR || (grid[k] === T.DOOR && doorOpen[k] === 1)));')
ins_after('function locateNode(x, z, yHint = 0, walkOnly = false) {\n',
          '  if (OW.on) return owLocate(x, z, yHint, walkOnly);\n')
ins_after('function nearestNode(x, z, yHint = 0) {\n',
          '  if (OW.on) return owNearest(x, z, yHint);\n')
rep('const nodeCX = (k) => ((k % GN) % GW) + 0.5;\nconst nodeCZ = (k) => (((k % GN) / GW) | 0) + 0.5;',
    'const nodeCX = (k) => (OW.on ? owKx(k) : (k % GN) % GW) + 0.5;\nconst nodeCZ = (k) => (OW.on ? owKz(k) : ((k % GN) / GW) | 0) + 0.5;')
ins_after('function zoneAt(x, z, yHint = 0) {\n',
          '  if (OW.on) return OW.locs.indexOf(khNearestLoc(x, z).loc);      // monde ouvert : le lieu le plus proche\n')
ins_after('function floorBelow(x, z, y) {\n', '  if (OW.on) return owFloorBelow(x, z, y);\n')
ins_after('function solidPoint(x, y, z) {\n', '  if (OW.on) return owSolidPoint(x, y, z);\n')
ins_after('function settleBody(b, r) {\n', '  if (OW.on) { owSettle(b, r); return; }\n')
ins_after('function losClear(k0, x0, z0, x1, z1, r = 0.2) {\n', '  if (OW.on) return owLosClear(k0, x0, z0, x1, z1, r);\n')
ins_after('function raycast(ox, oy, oz, dx, dy, dz, maxT) {\n', '  if (OW.on) return owRaycast(ox, oy, oz, dx, dy, dz, maxT);\n')
ins_after('function computeFlow(k0) {\n', '  if (OW.on) { owComputeFlow(); return; }\n')
rep('const flowAt = (k) => (k >= 0 ? flow[k] : 1e9);',
    'const flowAt = (k) => (OW.on ? owFlowAt(k) : k >= 0 ? flow[k] : 1e9);')
ins_after('function flowDir(k, x, z, out) {\n', '  if (OW.on) return owFlowDir(k, x, z, out);\n')

# ---------------------------------------------------------------- construction du monde
ins_after('function buildWorld(map, opts = {}) {\n', '  owUnload();                                   // retour d\'un monde ouvert\n')

# ---------------------------------------------------------------- effets (sol sous les particules, éclats, débris)
rep('const fy = NL > 1 ? floorBelow(this.pos[k], this.pos[k + 2], this.pos[k + 1] - this.vel[k + 1] * dt) + 0.015 : 0.015;',
    'const fy = NL > 1 || OW.on ? floorBelow(this.pos[k], this.pos[k + 2], this.pos[k + 1] - this.vel[k + 1] * dt) + 0.015 : 0.015;')
rep('function surfaceBelow(x, z, y) {\n  if (NL > 1) return floorBelow(x, z, y);',
    'function surfaceBelow(x, z, y) {\n  if (NL > 1 || OW.on) return floorBelow(x, z, y);')
ins_after('function addDecal(kind, x, y, z, nx, ny, nz, size) {\n',
          '  if (OW.on && ny === 1 && !nx && !nz) { const n = owDecalSlope(x, y, z); if (n) { nx = n.x; ny = n.y; nz = n.z; y = n.y0 + 0.002; } }   // dans la pente\n')
ins_after('function dirtBurst(x, z, y = 0) {\n', '  if (OW.on) { owSandBurst(x, z, y); return; }   // monde ouvert : du sable\n')
ins_after('function clearToZombie(x, y, z, k0, zb) {\n',
          '  if (OW.on) return owSightClear(x, y + 0.3, z, zb.pos.x, zb.pos.y + 0.9, zb.pos.z);\n')
ins_after('function nodeUnder(x, z, y) {\n', '  if (OW.on) return owLocate(x, z, owFloorBelow(x, z, y + 0.1));\n')
ins_after('function debrisHit(x, y, z, ox, oz) {\n', '  if (OW.on) return owSolidPoint(x, y, z);\n')
rep('  const fl = NL > 1 ? floorBelow(x, z, y + 0.1) : 0;\n  FX.boomLight.position',
    '  const fl = NL > 1 || OW.on ? floorBelow(x, z, y + 0.1) : 0;\n  FX.boomLight.position')
rep('const d = Math.hypot(player.pos.x - x, player.pos.z - z, NL > 1 ? Math.max(0, Math.abs(player.gy + 0.9 - y) - 0.9) : 0);',
    'const d = Math.hypot(player.pos.x - x, player.pos.z - z, NL > 1 || OW.on ? Math.max(0, Math.abs(player.gy + 0.9 - y) - 0.9) : 0);')
rep('const dz = Math.hypot(zb.pos.x - x, zb.pos.z - z, NL > 1 ? Math.max(0, Math.abs(zb.pos.y + 0.9 - y) - 0.9) : 0);',
    'const dz = Math.hypot(zb.pos.x - x, zb.pos.z - z, NL > 1 || OW.on ? Math.max(0, Math.abs(zb.pos.y + 0.9 - y) - 0.9) : 0);')
rep("const fy = (NL > 1 ? floorBelow(m.position.x, m.position.z, m.position.y + 0.3) : 0) + (b.type === 'lever' ? 0.004 : 0.003);",
    "const fy = (NL > 1 || OW.on ? floorBelow(m.position.x, m.position.z, m.position.y + 0.3) : 0) + (b.type === 'lever' ? 0.004 : 0.003);")
rep('const gf = NL > 1 ? floorBelow(g.x, g.z, g.y + 0.3) : 0;', 'const gf = NL > 1 || OW.on ? floorBelow(g.x, g.z, g.y + 0.3) : 0;')
rep('const dfy = NL > 1 ? floorBelow(m.position.x, m.position.z, m.position.y + 0.3) : 0;',
    'const dfy = NL > 1 || OW.on ? floorBelow(m.position.x, m.position.z, m.position.y + 0.3) : 0;')
rep('const hfy = NL > 1 ? floorBelow(m.position.x, m.position.z, m.position.y + 0.3) : 0;',
    'const hfy = NL > 1 || OW.on ? floorBelow(m.position.x, m.position.z, m.position.y + 0.3) : 0;')
rep('const limbFloor = (x, z, y) => (NL > 1 ? floorBelow(x, z, y + 0.3) : 0);',
    'const limbFloor = (x, z, y) => (NL > 1 || OW.on ? floorBelow(x, z, y + 0.3) : 0);')
ins_after('function rdTop(cx, cz, y) {\n', '  if (OW.on) return owRdTop(cx, cz, y);\n')

# ---------------------------------------------------------------- joueur
ins_after('function placePlayer(x, z, lv) {\n', '''  if (OW.on) {
    // monde ouvert : posé sur le terrain (le sous-sol si lv < 0)
    player.pos.set(x, 0, z); player.layer = lv !== undefined && lv < 0 ? 1 : 0; player.k = -1; player.gy = NaN;
    owSettle(player, 0.3);
    player.pos.y = player.gy;
    return;
  }
''')

# ---------------------------------------------------------------- armes
rep('  lum = clamp(lum, 0.42, 1.1);', '  lum = OW.on ? owViewLum() : clamp(lum, 0.42, 1.1);       // monde ouvert : la lumière du jour')
rep('  const wallT = RAY.t, wallHit = RAY.hit;', '  const wallT = RAY.t, wallHit = RAY.hit, wallSand = OW.on && RAY.hit && RAY.type >= 16;')
rep('''    addDecal('hole', wx, wy, wz, wnx, wny, wnz, rand(0.07, 0.11));
    sparkBurst(wx, wy, wz, wnx, wny, wnz, def.kind === 'shotgun' ? 2 : 4);
    if (Math.random() < 0.3) spawnPuff(wx + wnx * 0.05, wy + wny * 0.05, wz + wnz * 0.05, 0.25, 0.5, 0x8a8478, 0.35, 0.2);
''', '''    if (wallSand) owSandHit(wx, wy, wz, wnx, wny, wnz);                    // monde ouvert : le sable gicle
    else {
      addDecal('hole', wx, wy, wz, wnx, wny, wnz, rand(0.07, 0.11));
      sparkBurst(wx, wy, wz, wnx, wny, wnz, def.kind === 'shotgun' ? 2 : 4);
      if (Math.random() < 0.3) spawnPuff(wx + wnx * 0.05, wy + wny * 0.05, wz + wnz * 0.05, 0.25, 0.5, 0x8a8478, 0.35, 0.2);
    }
''')

# ---------------------------------------------------------------- zombies
rep('    z.gy = LVY[sp.li]; z.k = sp.k;', '    z.gy = OW.on ? sp.y : LVY[sp.li]; z.k = sp.k; z.layer = sp.layer | 0;')
rep('''  if (Zombies.flowT <= 0 || pc !== Zombies.lastCell) {
    computeFlow(pc);
    Zombies.flowT = 0.3;''', '''  // monde ouvert : le champ (160 × 160 m) est refait toutes les 0,25 s, pas à chaque case
  if (Zombies.flowT <= 0 || (pc !== Zombies.lastCell && !OW.on)) {
    computeFlow(pc);
    Zombies.flowT = OW.on ? 0.25 : 0.3;''')
ins_after('function pickSpawnPoint() {\n', '  if (OW.on) return owPickSpawn();\n')

# ---------------------------------------------------------------- partie, boucle, menu
rep('''  if (save) restoreSave(save);
  HUD.full();''', '''  if (save) restoreSave(save);
  if (OW.on && G.dogs) G.dogs.off = true;              // monde ouvert : pas de manches de chiens
  HUD.full();''')
rep('  updateLights(dt, G.time);\n  G.timers.insta', '  updateLights(dt, G.time);\n  if (OW.on) owUpdate(dt);\n  G.timers.insta')
rep('  if (G.creakT <= 0) { G.creakT = rand(8, 18); Sound.creak(); }',
    '  if (G.creakT <= 0) { G.creakT = rand(8, 18); if (!OW.on) Sound.creak(); }   // pas de grincements de bunker au désert')
rep('''  if (Features.box) Features.box.beam.material.opacity = 0.2 + Math.sin(G.menuT * 2.2) * 0.06;
}''', '''  if (Features.box) Features.box.beam.material.opacity = 0.2 + Math.sin(G.menuT * 2.2) * 0.06;
  if (OW.on) owUpdateView(dt);
}''')
rep("    else if (G.state === 'gameover') { updateFX(dt); updateLights(dt, G.time += dt * 0.3); camera.position.y = damp(camera.position.y, player.gy + 0.4, 1.5, dt); }",
    "    else if (G.state === 'gameover') { updateFX(dt); updateLights(dt, G.time += dt * 0.3); camera.position.y = damp(camera.position.y, player.gy + 0.4, 1.5, dt); if (OW.on) owUpdateView(dt); }")
rep("    $('menu-eyebrow').textContent = `Rapport d'incident · ${map.name} · nuit du 14 décembre`;",
    "    $('menu-eyebrow').textContent = map.eyebrow || `Rapport d'incident · ${map.name} · nuit du 14 décembre`;")
rep("    $('menu-lead').textContent = `${b7 ? 'Tenez le bunker' : 'Tenez bon'} le plus longtemps possible. Chaque manche amène des morts plus nombreux, plus rapides et plus coriaces.`;",
    "    $('menu-lead').textContent = map.lead || `${b7 ? 'Tenez le bunker' : 'Tenez bon'} le plus longtemps possible. Chaque manche amène des morts plus nombreux, plus rapides et plus coriaces.`;")

# ---------------------------------------------------------------- catalogue
rep('const BUILTIN_MAPS = [BUNKER7];', 'const BUILTIN_MAPS = [BUNKER7, KHAMSIN, OMBRE];      // Khamsin (désert) et Ombre éternelle (Lune) : mondes ouverts (jeu 2.0.0), deuxième et troisième cartes du menu')
rep('function registerMap(raw, source) {\n  const m = normalizeMap(raw);',
    'function registerMap(raw, source) {\n  // carte ouverte (Khamsin) : pas de grille ; ses éléments viennent du fichier (Mod Tools) ou de la carte intégrée\n  const m = raw.open ? openNormalize(raw) : normalizeMap(raw);\n  if (m === KHAMSIN) khThumb();\n  else if (m.open && !m.thumb) m.thumb = owBaseThumb(m.base);')
rep("if (typeof id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(id) || !withFile.includes(id)) continue;",
    "if (typeof id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(id) || !withFile.includes(id) || (MAPS.byId[id] && MAPS.byId[id].open)) continue;")
rep('''  // une carte qui ne peut pas se jouer n'est pas proposée
  MAPS.list = [...new Set(order)].filter((id) => { try { return !validateMap(MAPS.byId[id]).errors.length; } catch (e) { return false; } });''',
    '''  // Khamsin reste la deuxième carte, même quand la liste publiée ne la nomme pas
  if (!order.includes(KHAMSIN.id)) order.splice(Math.min(1, order.length), 0, KHAMSIN.id);
  // une carte qui ne peut pas se jouer n'est pas proposée (une carte ouverte n'a pas de grille à vérifier)
  MAPS.list = [...new Set(order)].filter((id) => { try { const m = MAPS.byId[id]; return m.open || !validateMap(m).errors.length; } catch (e) { return false; } });''')
rep('function loadMap(map) {\n  buildWorld(map);', 'function loadMap(map) {\n  if (map.open) owLoad(map);                     // monde ouvert (Khamsin)\n  else buildWorld(map);')
# Mod Tools : les cartes ouvertes ne s'éditent pas
rep('DEFAULT_TEXTURES, DEFAULT_AMBIANCE, DEFAULT_RULES, MAP_MIN, MAP_MAX, BUNKER7, MAPS, CUR,',
    'DEFAULT_TEXTURES, DEFAULT_AMBIANCE, DEFAULT_RULES, MAP_MIN, MAP_MAX, BUNKER7, get MAPS() { return editorMaps(); }, CUR,')
# outils de test
rep('  G, player, Arms, Zombies, World, Features, Powerups, Input, settings,\n',
    '  G, player, Arms, Zombies, World, Features, Powerups, Input, settings, OW, KH, OWNAV,\n')

# ---------------------------------------------------------------- véhicules (Khamsin)
rep('  // --- déplacement\n  const slot = curSlot();',
    '  // --- déplacement (Khamsin : au volant, le véhicule remplace la marche)\n  if (OW.on && owDriving()) { owDriveStep(dt); owPlayerVitals(dt); return; }\n  const slot = curSlot();')
ins_after('function updateArms(dt) {\n', '  if (OW.on && (owDriving() || KHP.busy > 0)) { player.ads = 0; return; }   // au volant : seul, on ne tire pas ; ni dans un passage\n')
ins_after('function updateInteract(dt) {\n', '  if (OW.on && owDriving()) { HUD.prompt(null); return; }\n')
rep("  if (player.down || G.state !== 'playing' || G.god || G.cheat) return;   // G.cheat : digi pass (immortel)\n",
    "  if (player.down || G.state !== 'playing' || G.god || G.cheat) return;   // G.cheat : digi pass (immortel)\n  if (OW.on && owDriving()) amount *= VEH.drive.T.protect;           // au volant : la caisse protège (légère, aucune, lourde)\n")
rep('  if (CUR.map && CUR.map.rules.powerOn) powerOnQuiet();\n}', '  if (CUR.map && CUR.map.rules.powerOn) powerOnQuiet();\n  if (OW.on) owResetWorld();\n}')

# boîte mystère : dans le monde ouvert, ses cases deviennent des solides bas
rep('  for (const [x, z] of L.cells) setProp(L.li, x, z, 0.78);\n', '  for (const [x, z] of L.cells) setProp(L.li, x, z, 0.78);\n  if (OW.on && L.ow) owBoxProp(prev, L);\n')

# qualité graphique changée en jeu : les ombres du monde ouvert suivent
ins_after("q.addEventListener('change', () => { settings.quality = q.value; saveSettings(); applyQuality(); ", "if (OW.on) owShadows(); ")

# tempêtes : une toutes les quatre manches (Khamsin)
rep('  if (G.dogRound) dogRoundStart(); else Sound.roundStart();\n', '  if (G.dogRound) dogRoundStart(); else Sound.roundStart();\n  if (OW.on) khOnRound(n);\n')

# ---------------------------------------------------------------- ennemis (Khamsin) : Desséchés et Rôdeurs
ins_after('function zoneZombieType(zi) {\n', '  if (OW.on) return khZombieType(zi);                // Khamsin : Desséchés selon le lieu le plus proche\n')
rep('  look.helmet = !!type.helmet;\n  paintZombieSlot(slot, look, ZR, type.model);',
    '  look.helmet = !!type.helmet;\n  if (OW.on) khLook(look, type);                       // peau tannée, yeux turquoise\n  paintZombieSlot(slot, look, ZR, type.model);')
ins_after('function rollSpeedType(round) {\n', '  if (OW.on) return khSpeedType(round);               // ils marchent, puis courent dès la manche 6\n')
rep('  G.zombieHp = G.dogRound ? dogHpForRound(n) : zombieHpForRound(n);',
    '  G.zombieHp = G.dogRound ? dogHpForRound(n) : OW.on ? khHp(n) : zombieHpForRound(n);   // Khamsin : 150, +100 par manche')
ins_after('function updateDog(z, dt) {\n', '  if (z.rodeur) { khRodeurUpdate(z, dt); return; }   // Rôdeur des sables : son propre comportement\n')
rep('function killZombie(z, info) {\n  if (z.dog) { killDog(z, info); return; }',
    'function killZombie(z, info) {\n  if (z.boss) return;                                  // le Gardien meurt par ses dégâts\n  if (z.dog) { if (z.rodeur) khKillRodeur(z, info); else killDog(z, info); return; }')
rep('  if (p.down) { f = 0; s = 0; }', '  if (p.down || p.grabT > 0 || (OW.on && KHP.busy > 0)) { f = 0; s = 0; }   // Khamsin : agrippé par un Rôdeur, dans un escalier')
ins_after('function knifeOnHit(z) {\n', '  if (z.rodeur) khKnifeRelease(z);                    // le couteau fait lâcher prise au Rôdeur\n')
rep('    if (!z.dog || !z.alive || z.removed) continue;', '    if (!z.dog || z.rodeur || z.boss || !z.alive || z.removed) continue;')
rep('  for (const [part, ba, a, bb, b, r] of DOG_HIT) {', '  for (const [part, ba, a, bb, b, r] of (z.rodeur ? RODEUR_HIT : DOG_HIT)) {')
ins_before('  for (const k in MAT) linearize(share(MAT[k]));\n',
           "  MAT.khEyes = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });   // Khamsin : yeux turquoise (teinte de l'instance)\n"
           "  MAT.khBone = std({ vertexColors: true, roughness: 0.82, emissive: 0x16110b, emissiveIntensity: 1 });   // Khamsin : os secs du Rôdeur\n")
# écran « Modèles »
rep('  const type = ZOMBIE_TYPES.find((t) => t.model === model) || BASE_TYPE;',
    '  const type = SPECIMEN_TYPES.find((t) => t.model === model && !t.dog) || BASE_TYPE;   // Desséchés de Khamsin compris')
rep('  const look = () => ({ ...randomZombieLook(), helmet });', '  const look = () => khSpecLook({ ...randomZombieLook(), helmet }, type);')
rep("  if (Models.sel === DOG_TYPE.id) { if (k === 'gallop') Sound.dogSnarl(null); else Sound.ui(); return; }",
    "  if (Models.sel === DOG_TYPE.id || Models.sel === RODEUR_TYPE.id) { if (k === 'gallop') Sound.dogSnarl(null); else Sound.ui(); return; }")
ins_before('/* Toise peinte sur le mur du fond', 'khSpecimenSetup();                                    // Khamsin : fiches des Desséchés et du Rôdeur\n\n')

# ---------------------------------------------------------------- sanctuaire (Khamsin) : l'autel remplace Le Glas
ins_after('function glasAnimate(amp, dt) {\n', '  if (amp.altar) { khAltarAnimate(amp, dt); return; }   // Khamsin : l\'autel du sanctuaire\n')
ins_after('function glasPrompt(amp) {\n', '  if (amp.altar) return khAltarPrompt(amp);\n')
rep("  glas: { name: 'Le Glas', has: (map) => !!(map && map.amp), tiers: () => GLAS.tiers, how: (t) => `${t}ᵉ coup de cloche` },",
    "  glas: { name: 'Le Glas', has: (map) => !!(map && (map.amp || map.altar)), tiers: () => GLAS.tiers, how: (t) => `${t}ᵉ coup de cloche (à Khamsin : ${t}ᵉ rayon de l’autel du sanctuaire)` },")

# ---------------------------------------------------------------- le Gardien (Khamsin) : dans la liste des zombies, à part
rep('function updateZombie(z, dt) {\n  if (z.dog) { updateDog(z, dt); return; }', 'function updateZombie(z, dt) {\n  if (z.boss) { khGardienUpdate(z, dt); return; }      // Khamsin : le Gardien\n  if (z.pilot && khPilotWander(z, dt)) return;          // Khamsin : le pilote fait le tour du bassin\n  if (z.dog) { updateDog(z, dt); return; }')
ins_after('function rayHitZombie(z, ox, oy, oz, dx, dy, dz, extra) {\n', '  if (z.boss) return khGardienRay(z, ox, oy, oz, dx, dy, dz, extra);\n')
ins_after('function damageZombie(z, amount, info) {\n', '  if (z.boss) return khGardienDamage(z, amount, info);\n')
rep('    bloodBurst(hx, hy, hz, dx, dz, h.head ? 7 : 4, 1);', '    if (h.z.boss) khGardienSpark(hx, hy, hz, dx, dz); else bloodBurst(hx, hy, hz, dx, dz, h.head ? 7 : 4, 1);')
ins_before('/* Toise peinte sur le mur du fond', 'khGardienSetup();                                     // Khamsin : fiche du Gardien\n\n')
# écran « Modèles » : le Gardien (3,2 m) se voit de plus loin
rep("  const model = SPECIMEN_MODELS[type.model] || SPECIMEN_MODELS.fantassin;\n  Models.sel = type.id;",
    "  const model = SPECIMEN_MODELS[type.model] || SPECIMEN_MODELS.fantassin;\n  MODEL_VIEW.distMax = type.boss ? 6.4 : 3.8;\n  if (Models.dist > MODEL_VIEW.distMax || type.boss) Models.dist = MODEL_VIEW.distMax;\n  Models.sel = type.id;")

# ---------------------------------------------------------------- quête (Khamsin) : sauvegarde, victoire
ins_after('    perks: [...player.perks], souffleUses: player.souffleUses, power: G.power,\n', '    kh: OW.on ? khSerialize() : null,                   // Khamsin : pièces, Sceptre, véhicules\n')
rep('    if (s.power) powerOnQuiet();\n', '    if (s.power) powerOnQuiet();\n    if (OW.on && s.kh) khRestore(s.kh);\n')
rep("  G.state = 'gameover';\n  closeKeypad();\n  Sound.gameOver();", "  G.state = 'gameover';\n  closeKeypad();\n  $('go-title').textContent = 'Partie terminée';\n  if (!(OW.on && KHQ.won)) Sound.gameOver();          // Khamsin : l'évasion n'est pas une défaite")

# ---------------------------------------------------------------- menu (Khamsin) : consignes, commandes au volant ; version
rep("const GAME_VERSION = '1.9.0';", "const GAME_VERSION = '2.0.3';")
rep('        <li>Reclouez les planches des fenêtres : 10 points par planche.</li>\n',
    '        <li id="tip-planks">Reclouez les planches des fenêtres : 10 points par planche.</li>\n')
ins_after('        <li id="tip-power">Rétablissez le courant dans la salle des machines pour les atouts et Le Glas, la cloche qui reforge les armes.</li>\n',
          '        <li id="tip-veh" hidden>Véhicules\u00a0: F pour monter ou descendre, C pour la vue, L pour les phares. Au volant, on ne tire pas.</li>\n'
          '        <li id="tip-storm" hidden>Toutes les quatre manches, une tempête de sable\u00a0: abritez-vous sous un toit.</li>\n')
rep("      : `Rétablissez le courant pour ${map.amp ? 'les atouts et Le Glas' : 'les atouts'}.`;\n  }\n",
    "      : `Rétablissez le courant pour ${map.amp ? 'les atouts et Le Glas' : 'les atouts'}.`;\n    khMenuTips(map);                                    // Khamsin : consignes du désert (les autres cartes : textes du jeu)\n  }\n")

# courant à Khamsin : bandeau sans « Le Glas » (l'autel est au sanctuaire), pas de bourdonnement dans tout le désert
rep("  HUD.banner('Courant rétabli', a ? 'Atouts disponibles · Le Glas s’éveille' : 'Atouts disponibles', 'power');",
    "  HUD.banner('Courant rétabli', a && a.altar ? 'Atouts disponibles · camion blindé · batterie de l’avion en charge' : a ? 'Atouts disponibles · Le Glas s’éveille' : 'Atouts disponibles', 'power');")
rep("  Sound.powerOn();\n  setPoweredLights();\n", "  Sound.powerOn();\n  if (OW.on) Sound.setHum(false);                     // Khamsin : pas de bourdonnement électrique dans tout le désert\n  setPoweredLights();\n")

# ---------------------------------------------------------------- Mod Tools : cartes ouvertes (interface 3)
rep("const EDITOR_API = 2;", "const EDITOR_API = 5;                       // 3 : cartes ouvertes (jeu 2.0.0, Mod Tools du launcher 1.3.0) ; 4 : la Lune (Ombre éternelle, Lune vierge ; launcher 1.3.1) ; 5 : tailles (jeu 2.0.3, launcher 1.3.2)")
# un fichier de carte ouverte (Khamsin modifiée dans les Mod Tools) remplace la carte intégrée
rep("if (typeof id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(id) || !withFile.includes(id) || (MAPS.byId[id] && MAPS.byId[id].open)) continue;",
    "if (typeof id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(id) || !withFile.includes(id)) continue;")
rep("DEFAULT_TEXTURES, DEFAULT_AMBIANCE, DEFAULT_RULES, MAP_MIN, MAP_MAX, BUNKER7, get MAPS() { return editorMaps(); }, CUR,",
    "DEFAULT_TEXTURES, DEFAULT_AMBIANCE, DEFAULT_RULES, MAP_MIN, MAP_MAX, BUNKER7, get MAPS() { return editorMaps(); }, get MAPS_ALL() { return MAPS; }, CUR,\n"
    "  /* cartes ouvertes (interface 3) : format, vérification, monde pour l'éditeur */\n"
    "  openNormalize, openSerialize, openValidate, OPEN_LIMITS, OPEN_KINDS, OPEN_RULES, VEH_TYPES, ELIXIRS,\n"
    "  ow: {\n"
    "    load: owEditorLoad, rebuild: owEditorRebuild, frame: owEditorFrame, ray: owEditorRay, plan: owEditorPlan, tile: owEditorTile,\n"
    "    place: owEditorPlace, ground: owEditorGround, locs: owEditorLocs, near: owEditorNear, validate: (m) => openValidate(m, true),\n"
    "    get on() { return OW.on; }, get W() { return OW.W; }, get D() { return OW.D; }, get root() { return OW.elemRoot; }, get props() { return OW.propsRoot; },\n"
    "    get vehicles() { return VEH.list; }, get box() { return Features.box; },\n"
    "    pose: owEditorPose, poseProp: owEditorPoseProp, surface: owEditorSurface, get objs() { return OW.elObjs; }, roads: owEditorRoads,\n"
    "    height: (x, z) => owGroundAt(0, x, z),   // sol avec les éléments (dessus d'un objet plein)\n"
    "    /* niveau 2 : terrain, routes, bâtiments, lieux, désert vierge */\n"
    "    BASES: OW_BASES, get BUILDINGS() { return owBuildingsOf(OW.worldId || 'khamsin'); }, get PAINTS() { return owPaints().map((id) => ({ id, v: OWB[id] })); }, bldRect: owBldRect, namedLocs: () => owNamedLocs(OW.map),\n"
    "    /* interface 4 : la Lune (monde du chargement en cours ; catalogue complet des bâtiments) */\n"
    "    get worldId() { return OW.worldId || 'khamsin'; }, ALL_BUILDINGS: OWBLD, worldOf: owWorldOf,\n"
    "    sculpt: owEditorSculpt, paint: owEditorPaint, afterTerrain: owEditorAfterTerrain, commitTerrain: owEditorCommitTerrain,\n"
    "    apply: owEditorApply, reapply: owEditorReapply, syncMods: owEditorSyncMods, modsRect: owModsRect, buildingPlace: owEditorBuildingPlace,\n"
    "    reliefAt: owEditorReliefAt, protectAt: (x, z) => owProtectMask()[owPointIndex(x, z)] / 255, get baseId() { return OW.baseId; }, baseThumb: owBaseThumb,\n"
    "    get far() { return camera.far; }, get spawnY() { return OW.on && CUR.map ? owEditorGround(CUR.map.spawn.pos[0], CUR.map.spawn.pos[1]) : 0; },\n"
    "  },")
# partie de test des Mod Tools sur une carte ouverte
rep("    G.editorSession = true;\n    viewCamera = null;\n    buildWorld(map);", "    G.editorSession = true;\n    viewCamera = null;\n    if (map.open) owLoad(map); else buildWorld(map);")
# liste publiée par un launcher qui connaît Khamsin (maps/index.json, editor 3) : suivie telle quelle
rep("  let order = [];\n  for (const raw of BUILTIN_MAPS)", "  let order = [], pubEditor = 0;\n  for (const raw of BUILTIN_MAPS)")
rep("      if (index && Array.isArray(index.maps)) {\n        // files :", "      if (index && Array.isArray(index.maps)) {\n        pubEditor = Number(index.editor) || 0;\n        // files :")
rep("  // Khamsin reste la deuxième carte, même quand la liste publiée ne la nomme pas\n  if (!order.includes(KHAMSIN.id)) order.splice(",
    "  // Khamsin reste la deuxième carte quand la liste publiée ne la nomme pas (liste d'un launcher\n  // d'avant Khamsin) ; une liste des Mod Tools 1.3 (editor 3) est suivie : l'auteur a pu la retirer\n  if (!order.includes(KHAMSIN.id) && pubEditor < 3) order.splice(")
rep("  if (!order.includes(KHAMSIN.id) && pubEditor < 3) order.splice(Math.min(1, order.length), 0, KHAMSIN.id);\n",
    "  if (!order.includes(KHAMSIN.id) && pubEditor < 3) order.splice(Math.min(1, order.length), 0, KHAMSIN.id);\n"
    "  // Ombre éternelle : troisième carte, sauf dans une liste des Mod Tools 1.3.1 (editor 4) qui l'a retirée\n"
    "  if (!order.includes(OMBRE.id) && pubEditor < 4) order.splice(Math.min(2, order.length), 0, OMBRE.id);\n")

# ================================================================ La Lune (Ombre éternelle) : 1/6 g
# pesanteur des effets (rapport à la Terre : sang, débris, douilles, membres, morts) et « de jeu » (joueur, grenades)
rep('      this.vel[k + 1] -= this.g * dt;', '      this.vel[k + 1] -= this.g * GRAV.k * dt;')
rep('\n    b.vy -= 12 * dt;', '\n    b.vy -= 12 * GRAV.k * dt;')
rep('\n    d.vy -= 12 * dt;', '\n    d.vy -= 12 * GRAV.k * dt;')
rep('\n    h.vy -= 12 * dt;', '\n    h.vy -= 12 * GRAV.k * dt;')
rep('\n  L.vy -= 12 * dt;', '\n  L.vy -= 12 * GRAV.k * dt;')
rep('\n        p.vy -= 12 * dt;', '\n        p.vy -= 12 * GRAV.k * dt;', 2)
rep("    e.vy -= (e.kind === 'scrap' ? 6 : 9.8) * dt;", "    e.vy -= (e.kind === 'scrap' && !GRAV.moon ? 6 : 9.8) * GRAV.k * dt;")
rep('      b.v.y -= 9.8 * dt;', '      b.v.y -= 9.8 * GRAV.k * dt;')
rep('    g.vy -= 14 * dt;', '    g.vy -= GRAV.feel * dt;')
rep('      gMonde.set(0, -9.81 * dt * dt, 0);', '      gMonde.set(0, -9.81 * GRAV.k * dt * dt, 0);')
rep('      var g = o.gravite;', '      var g = o.gravite * GRAV.k;')
rep('    L.t += dt; L.v.y -= 9.8 * dt;', '    L.t += dt; L.v.y -= 9.8 * GRAV.k * dt;')
# joueur : adhérence, saut, chute, propulseurs
rep('''  const accel = p.grounded ? 14 : 2.5;
  p.vel.x = damp(p.vel.x, wx * speed, accel, dt);
  p.vel.z = damp(p.vel.z, wz * speed, accel, dt);
  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;''', '''  const accel = p.grounded ? 14 : 2.5;
  if (GRAV.moon) luAccel(p, wx * speed, wz * speed, dt);        // Lune : 3 m/s² au sol, 0,35 en l'air, glissades
  else { p.vel.x = damp(p.vel.x, wx * speed, accel, dt); p.vel.z = damp(p.vel.z, wz * speed, accel, dt); }
  const lx0 = p.pos.x, lz0 = p.pos.z;
  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;''')
rep('''  settleBody(p, p.radius);

  // --- saut et gravité (y : au-dessus du sol, qui suit les marches)
  if (pressed('Space') && p.grounded && !p.down && p.crouch < 0.5) { p.vy = 4.7; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= 14 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; Sound.land(); }
  }''', '''  settleBody(p, p.radius);
  // Lune : arrêté par un mur, l'élan tombe (sinon il resterait collé à 3 m/s²)
  if (GRAV.moon && p.grounded && dt > 0) { const ax = (p.pos.x - lx0) / dt, az = (p.pos.z - lz0) / dt; if (Math.hypot(ax, az) < Math.hypot(p.vel.x, p.vel.z) - 0.05) { p.vel.x = ax; p.vel.z = az; } }

  // --- saut et gravité (y : au-dessus du sol, qui suit les marches ; Lune : 1,62 m/s², 3 m de saut)
  if (pressed('Space') && p.grounded && !p.down && p.crouch < 0.5 && !p.luSlide) { p.vy = GRAV.jump; p.grounded = false; if (GRAV.moon) p.luTop = p.gy; }
  if (GRAV.moon) luPadLaunchPlayer(dt);
  if (!p.grounded) {
    p.vy -= GRAV.feel * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; if (GRAV.moon) luLand(p, (p.luTop !== undefined ? p.luTop : p.gy) - p.gy); else Sound.land(); }
  }''')

# Lune : pas d'air. Dehors, les sons du monde se taisent ; ceux du joueur passent étouffés par la
# combinaison (filtre passe-bas) ; souffle, radio et alarmes de la combinaison passent après le filtre.
rep("  function bus() { return ctx && ctx.state !== 'closed' ? { ctx, sortie: sfxBus } : null; }",
    "  function bus() { return ctx && ctx.state !== 'closed' ? { ctx, sortie: sfxBus } : null; }\n"
    "  /* Lune : sons de la combinaison (souffle, radio, alarmes), après le filtre de l'étouffement */\n"
    "  function suitBus() { return ctx && ctx.state !== 'closed' ? { ctx, sortie: master } : null; }")
rep("    init, ready, suspend, setVolumes, setMuffle, setListener, startAmbient, setHum,",
    "    init, ready, suspend, setVolumes, setMuffle, setListener, startAmbient, setHum, suitBus,")
rep("    lowpass.frequency.setTargetAtTime(on ? 650 : 20000, ctx.currentTime, 0.25);",
    "    lowpass.frequency.setTargetAtTime(on ? (typeof on === 'number' ? on : 650) : 20000, ctx.currentTime, 0.25);   // Lune : fréquence de la combinaison")
rep("  function out(pos, vol = 1, ref = 4, bus = null) {\n    let gain = vol;",
    "  function out(pos, vol = 1, ref = 4, bus = null) {\n    let gain = vol;\n"
    "    // Lune : dehors, aucun son du monde (pas d'air) ; dans la base, ceux de la base\n"
    "    if (pos && GRAV.moon && !luHears(pos)) return null;")

# Lune : l'anomalie prend les gouttes, la poussière et les éclats (cercles sans fin) au lieu de la pesanteur
rep('      this.vel[k + 1] -= this.g * GRAV.k * dt;', '      if (!(GRAV.moon && luAnomalyPoint(this, k, dt))) this.vel[k + 1] -= this.g * GRAV.k * dt;')
# Lune : les morts avancent par bonds (poursuite, pose en l'air) ; en l'air au-dessus du joueur, ils ne le poussent pas
ins_after('function chase(z, dt) {\n', '  if (GRAV.moon && (z.luAir || !(z.knockT > 0))) { luChase(z, dt); return; }   // Lune : bonds balistiques\n')
rep('  zActions(z, P, dt);\n  if (!z.alive) zDeathPose(z, P);', '  zActions(z, P, dt);\n  if (GRAV.moon) luHopPose(z, P);                      // Lune : ramassé, jambes repliées en l\'air\n  if (!z.alive) zDeathPose(z, P);')
rep("    if (!z.alive || z.state === 'rise' || z.outside || Math.abs(z.gy - p.gy) > 1) continue;\n    const dx = p.pos.x - z.pos.x, dz = p.pos.z - z.pos.z, d = Math.hypot(dx, dz), m = p.radius + 0.3;",
    "    if (!z.alive || z.state === 'rise' || z.outside || Math.abs(z.gy - p.gy) > 1) continue;\n    if (GRAV.moon && Math.abs(z.gy + (z.luY || 0) - p.gy - p.y) > 1.4) continue;   // Lune : l'un des deux en plein bond\n    const dx = p.pos.x - z.pos.x, dz = p.pos.z - z.pos.z, d = Math.hypot(dx, dz), m = p.radius + 0.3;")
# Lune : la cuve d'oxygène liquide en orbite dans l'anomalie (trois balles la font sortir)
ins_after('  const wallT = RAY.t, wallHit = RAY.hit, wallSand = OW.on && RAY.hit && RAY.type >= 16;\n',
          '  if (GRAV.moon) luLoxRay(ox, oy, oz, dx, dy, dz, wallT);   // Lune : la cuve d\'oxygène liquide de l\'anomalie\n')
# Lune : l'évasion n'est pas une défaite
rep("  if (!(OW.on && KHQ.won)) Sound.gameOver();", "  if (!(OW.on && (KHQ.won || LUQ.won))) Sound.gameOver();")
# Lune : consignes du menu (pesanteur, oxygène)
ins_after('        <li id="tip-storm" hidden>Toutes les quatre manches, une tempête de sable : abritez-vous sous un toit.</li>\n',
          '        <li id="tip-moon" hidden></li>\n        <li id="tip-o2" hidden></li>\n')
# écran « Modèles » : fiches des morts de la mine
ins_before('/* Toise peinte sur le mur du fond', 'luSpecimenSetup();                                    // Lune : fiches de l\'Astronaute et du Mineur\n\n')
