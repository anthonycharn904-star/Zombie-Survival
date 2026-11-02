# Points d'accroche du jeu 2.0.7 : le boss de Bunker 7, « Le Dernier Pacte ». Exécuté par build.py après hooks-points.py.
# Demande d'Anthony du 1er novembre 2026 (paquet boss-bunker7/le-dernier-pacte/, ses modules insérés tels quels par
# build.py ; config.js et arene.js : engine/boss-b7/). Suivi étape par étape : SUIVI-BOSS-B7.md.

# Numéro : aucun changement ici. Le boss sort avec le jeu 2.0.7 (décision d'Anthony du 31 octobre 2026), mais les
# chantiers gardent 2.0.6 : la session d'intégration pose les numéros à la fin (décision d'Anthony du 31 octobre,
# confirmée pour ce chantier le 2 novembre 2026) ; interface des Mod Tools inchangée (9).

# Étape 3 : adaptateur « jeu » (module src/H6-boss-b7.js). Chaque branchement est sans effet hors du combat, sauf la
# nouvelle partie : combat créé et sons du boss décodés (≈ 173 Mo) dès la première partie sur Bunker 7.
# commandes coupées pendant les scènes du boss : touches (ici), souris et tir (b7Entrees, au début de update) ; étape 6 :
# étourdi ou projeté, déplacement, saut, rechargement, couteau et grenade coupés (b7Touche), la vue reste libre
rep("""const key = (c) => !!Input.keys[c];
const pressed = (c) => !!Input.down[c];""", """const key = (c) => !!Input.keys[c] && b7Touche(c);         // jeu 2.0.7 : commandes coupées pendant les scènes du boss
const pressed = (c) => !!Input.down[c] && b7Touche(c);""")
# invulnérable pendant les scènes du boss
rep("""  if (player.down || G.state !== 'playing' || G.god || G.cheat) return;   // G.cheat : digi pass (immortel)""",
"""  if (player.down || G.state !== 'playing' || G.god || G.cheat || b7Invulnerable()) return;   // G.cheat : digi pass (immortel) ; jeu 2.0.7 : scènes du boss""")
# manches suspendues pendant le combat (le compteur de manche ne bouge pas)
rep("""function updateRounds(dt) {
""", """function updateRounds(dt) {
  if (b7ManchesSuspendues()) return;           // jeu 2.0.7 : combat du boss de Bunker 7
""")
# zombie du combat tué : points habituels (killZombie), ni bonus au hasard ni compte dans la manche
rep("""function onZombieKilled(z, info) {
""", """function onZombieKilled(z, info) {
  if (z.b7) { b7ZombieTue(z, info); return; }   // jeu 2.0.7 : zombie du combat du boss
""")
# aucun bonus au hasard pendant le combat (décision D3)
rep("""function maybeDropPowerup(x, z, gy = 0) {
""", """function maybeDropPowerup(x, z, gy = 0) {
  if (b7SansBonus()) return;                   // jeu 2.0.7 : combat du boss (D3)
""")
# un zombie du combat retiré (traînard, bloqué) ne compte pas dans la manche
rep("""function recycleZombie(z) {
  removeZombie(z);
""", """function recycleZombie(z) {
  removeZombie(z);
  if (z.b7) return;                            // jeu 2.0.7 : zombie du combat du boss, hors de la manche
""")
# zombie saisi ou extrait par le Septième : sur place, animé
rep("""  switch (z.state) {
    case 'rise': {
      z.pos.y = z.gy - z.riseD * (1 - smooth(clamp(z.t / 1.3, 0, 1)));""", """  if (z.b7Effet && b7EffetZombie(z, dt)) { if (z.alive && !z.removed) animateZombie(z, dt); return; }   // jeu 2.0.7 : boss
  switch (z.state) {
    case 'rise': {
      z.pos.y = z.gy - z.riseD * (1 - smooth(clamp(z.t / 1.3, 0, 1)));""")
# nouvelle partie : combat remis à zéro, sons du boss (première partie sur Bunker 7)
rep("""  if (OW.on && G.dogs) G.dogs.off = true;              // monde ouvert : pas de manches de chiens
  HUD.full();""", """  if (OW.on && G.dogs) G.dogs.off = true;              // monde ouvert : pas de manches de chiens
  b7NouvellePartie();                          // jeu 2.0.7 : boss de Bunker 7
  HUD.full();""")
# chaque image : commandes et regard des scènes (avant le joueur), combat (après les manches)
rep("""  runEvents();
  updatePlayer(dt);""", """  runEvents();
  b7Entrees(dt);                               // jeu 2.0.7 : boss (commandes coupées, regard des scènes)
  updatePlayer(dt);""")
rep("""  updateRounds(dt);
  updateFeatures(dt);""", """  updateRounds(dt);
  b7Update(dt);                                // jeu 2.0.7 : combat du boss de Bunker 7
  updateFeatures(dt);""")
# une autre carte chargée : salle du boss retirée du monde (étape 4, mondes ouverts compris), sons du boss libérés
rep("""  else buildWorld(map);
  G.mapId = map.id;""", """  else buildWorld(map);
  G.mapId = map.id;
  b7ChangementDeCarte();                       // jeu 2.0.7 : hors de Bunker 7, salle du boss retirée et sons libérés""")

# Étape 4 : salle secrète (module src/H7-boss-salle.js). Chaque branchement est sans effet hors de la salle ; la grille
# de Bunker 7 grandit en jeu (salle ajoutée), sans accès ni rendu depuis la carte.
# fin de la construction du monde : la salle ajoutée à la grille de Bunker 7 (en jeu seulement, jamais dans les Mod Tools)
rep("""  linearizeTree(root);
  applyAmbiance(map.ambiance);
""", """  linearizeTree(root);
  applyAmbiance(map.ambiance);
  b7SalleCarte(map);                           // jeu 2.0.7 : salle secrète du boss, ajoutée à la grille de Bunker 7
""")
# corps posés sur la grille : repoussés aussi par les collisions exactes de la salle (octogone, piliers, cuves, meubles)
rep("""  b.k = k;
  b.gy = surfY(k, b.pos.x, b.pos.z);
}""", """  b.k = k;
  b.gy = surfY(k, b.pos.x, b.pos.z);
  if (B7S.actif) b7SalleCorps(b, r);           // jeu 2.0.7 : collisions exactes de la salle du boss
}""")
# tirs, grenades et lignes de vue partis de la salle : son décor exact
rep("""function raycast(ox, oy, oz, dx, dy, dz, maxT) {
  if (OW.on) return owRaycast(ox, oy, oz, dx, dy, dz, maxT);""", """function raycast(ox, oy, oz, dx, dy, dz, maxT) {
  if (OW.on) return owRaycast(ox, oy, oz, dx, dy, dz, maxT);
  if (B7S.actif && b7SalleRayon(ox, oy, oz, dx, dy, dz, maxT)) return RAY;   // jeu 2.0.7 : décor exact de la salle du boss""")
# avant chaque rendu : la salle dessinée seulement quand on y est (Bunker 7 caché pendant ce temps), son ambiance
rep("""  persoBeforeRender();                         // jeu 2.0.6 : corps d'Anthony montré ou caché, caméra TPS
""", """  persoBeforeRender();                         // jeu 2.0.6 : corps d'Anthony montré ou caché, caméra TPS
  b7SalleAvantRendu();                         // jeu 2.0.7 : salle du boss ou Bunker 7, et leur ambiance
""")

# Étape 5 : rendu et tirs (module src/H8-boss-rendu.js). Le Septième entre dans la liste des zombies comme le Gardien de
# Khamsin (b7boss) ; ses branchements passent devant ceux du Gardien. Sans effet hors du combat. Étape 6 (module
# src/H9-boss-ennemis.js) : les mini-boss et les petits Démembrés du module des zombies du prototype y entrent de même
# (b7ent).
# suivis par le combat ou par le module (position, lieu), jamais par l'IA des zombies
rep("""  if (z.boss) { khGardienUpdate(z, dt); return; }      // Khamsin : le Gardien""",
"""  if (z.b7boss || z.b7ent) return;             // jeu 2.0.7 : le Septième (b7BossEntree), les entités du module (b7EntSync)
  if (z.boss) { khGardienUpdate(z, dt); return; }      // Khamsin : le Gardien""")
# rayons des armes contre leurs zones de tir
rep("""  if (z.boss) return khGardienRay(z, ox, oy, oz, dx, dy, dz, extra);""",
"""  if (z.b7boss) return b7BossRayon(z, ox, oy, oz, dx, dy, dz, extra);   // jeu 2.0.7 : le Septième
  if (z.b7ent) return b7EntRayon(z, ox, oy, oz, dx, dy, dz, extra);     // jeu 2.0.7 : mini-boss, petits Démembrés
  if (z.boss) return khGardienRay(z, ox, oy, oz, dx, dy, dz, extra);""")
# dégâts : la porte unique du brief (combat.toucherBoss) ; les entités du module (leurs PV, leurs protections)
rep("""  if (z.boss) return khGardienDamage(z, amount, info);""",
"""  if (z.b7boss) return b7BossDegats(z, amount, info);   // jeu 2.0.7 : le Septième (combat.toucherBoss)
  if (z.b7ent) return b7EntDegats(z, amount, info);     // jeu 2.0.7 : mini-boss, petits Démembrés (module des zombies)
  if (z.boss) return khGardienDamage(z, amount, info);""")
# balles : sang, étincelles et bouclier dessinés par les effets du boss (Septième) ou par b7EntImpact (bouclier d'un
# mini-boss en rage, sang sinon) ; marqueur de touche seulement si le coup porte
rep("""    if (h.z.boss) khGardienSpark(hx, hy, hz, dx, dz); else bloodBurst(hx, hy, hz, dx, dz, h.head ? 7 : 4, 1);""",
"""    if (h.z.b7boss) { /* jeu 2.0.7 : le Septième, impacts dessinés par ses effets */ } else if (h.z.b7ent) b7EntImpact(h.z, hx, hy, hz, dx, dz, h.head); else if (h.z.boss) khGardienSpark(hx, hy, hz, dx, dz); else bloodBurst(hx, hy, hz, dx, dz, h.head ? 7 : 4, 1);""")
rep("""    HUD.hitmarker(killed);
    if (boom) explode(hx, hy, hz, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s });""",
"""    if (!(h.z.b7boss || h.z.b7ent) || B7V.touche) HUD.hitmarker(killed);   // jeu 2.0.7 : boss et mini-boss, seulement si le coup porte
    if (boom) explode(hx, hy, hz, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s });""")
# lampes : obscurité et éclats des effets du boss (après leur mise à jour de l'image)
rep("""  updateLights(dt, G.time);
  if (OW.on) owUpdate(dt);""", """  updateLights(dt, G.time);
  b7Lumieres();                                // jeu 2.0.7 : obscurité des effets du boss sur les lampes
  if (OW.on) owUpdate(dt);""")
# voile d'écran des effets du boss, après l'arme
rep("""    if (Khepesh) Khepesh.rendreVue(renderer);   // le bras au khépesh (Khamsin), par-dessus
  }
}""", """    if (Khepesh) Khepesh.rendreVue(renderer);   // le bras au khépesh (Khamsin), par-dessus
  }
  b7RenduEcran();                              // jeu 2.0.7 : voile d'écran des effets du boss, après l'arme
}""")

# Étape 6 : ennemis et mécaniques du combat (module src/H9-boss-ennemis.js). Chaque branchement est sans effet hors du
# combat (chiens marqués b7, projection).
# projeté par la charge du Démembré : la vitesse imposée remplace la marche (collisions du jeu ensuite)
rep("""  if (GRAV.moon) luAccel(p, wx * speed, wz * speed, dt);""",
"""  if (b7Projete()) b7Projection(p, dt);       // jeu 2.0.7 : projeté par la charge du Démembré (vitesse imposée)
  else if (GRAV.moon) luAccel(p, wx * speed, wz * speed, dt);""")
# chiens de la meute du boss : le Molosse avec le profil du combat ; il sort de la faille des effets du boss (ni éclair ni
# secousse), mord selon son profil (sans à-coup de la vue), n'est jamais déplacé par le jeu (la logique le remplace),
# éclate à sa mort sans souffle ni secousse
rep("""function spawnDog(k, hp) {""", """function spawnDog(k, hp, b7 = false) {      // b7 (jeu 2.0.7) : chien de la meute du boss""")
rep("""  dogLightning(x, z.gy, zz);
  Sound.dogSpawn(z.pos);
  Zombies.list.push(z);""", """  if (!b7) { dogLightning(x, z.gy, zz); Sound.dogSpawn(z.pos); }   // jeu 2.0.7 : la faille du boss tient lieu d'éclair
  Zombies.list.push(z);""")
rep("""  const Bt = DOGS.bite;""", """  const Bt = z.b7 ? z.b7.morsure : DOGS.bite;   // jeu 2.0.7 : chien du boss (portée et cadence de son profil)""")
rep("""playerDamage(RULES.zombieHit * DOG_TYPE.mult.damage); Sound.dogBite(z.pos); }""",
"""if (z.b7) b7Degats(B7.id, z.b7.degats); else playerDamage(RULES.zombieHit * DOG_TYPE.mult.damage); Sound.dogBite(z.pos); }   // jeu 2.0.7 : profil du boss""")
rep("""      playerDamage(RULES.zombieHit * DOG_TYPE.mult.damage);
      player.punch = Math.min(0.2, player.punch + 0.08);""",
"""      if (z.b7) b7Degats(B7.id, z.b7.degats);     // jeu 2.0.7 : chien du boss (profil, sans à-coup de la vue)
      else { playerDamage(RULES.zombieHit * DOG_TYPE.mult.damage); player.punch = Math.min(0.2, player.punch + 0.08); }""")
rep("""  if (z.farT > 8 || z.stuck >= 2) dogRelocate(z);""",
"""  if ((z.farT > 8 || z.stuck >= 2) && !z.b7) dogRelocate(z);   // jeu 2.0.7 : un chien du boss perdu est remplacé par la logique""")
rep("""  FX.shake = Math.min(1.1, FX.shake + Math.max(0, 1 - pd / 7) * 0.5);""",
"""  if (z.b7) return;                            // jeu 2.0.7 : chien du boss, ni secousse ni souffle
  FX.shake = Math.min(1.1, FX.shake + Math.max(0, 1 - pd / 7) * 0.5);""")

# Étape 7 : panneau de test développeur (module src/HA-boss-panneau.js), seulement dans une partie de test des Mod Tools
# sur Bunker 7. Boucle du jeu : la vitesse du temps du panneau (×1 sinon : un seul pas, comme avant).
rep("""    if (G.state === 'playing') update(dt);
    else if (G.state === 'menu') menuCamera(dt);""", """    if (G.state === 'playing') b7Pas(dt);      // jeu 2.0.7 : vitesse du temps du panneau de test du boss (×1 sinon)
    else if (G.state === 'menu') menuCamera(dt);""")

# Étape 8 : déclenchement par le digi pass (module src/HB-boss-acces.js). Sans effet ailleurs que sur Bunker 7 avec le
# combat : le digi pass d'avant.
# le clavier accepte aussi le code du boss (une fois par partie ; le jeu n'en garde que l'empreinte)
rep("""      if (digipassHash(Keypad.code) === DIGIPASS_HASH) { Keypad.state = 'ok'; Keypad.t = 0.8; Sound.keypad('ok'); }""",
"""      if ((Keypad.b7 = b7CodeDigipass(Keypad.code))) { Keypad.state = 'ok'; Keypad.t = 0.8; Sound.keypad('ok'); }   // jeu 2.0.7 : code secret ou code du boss""")
rep("""    } else if (Keypad.state === 'ok') unlockDigipass();""",
"""    } else if (Keypad.state === 'ok') b7CodeAccepte(Keypad.b7);   // jeu 2.0.7 : code secret (unlockDigipass) ou code du boss""")
# le code secret ne fait plus disparaître le digi pass à lui seul sur Bunker 7 : il faut aussi celui du boss
rep("""  hideDigipass();
  const p = dp.root.position, n = LAYOUT.digipass.n;
  spawnPuff(p.x + n[0] * 0.2, p.y, p.z + n[1] * 0.2, 0.45, 0.8, 0xc8d4dc, 0.45, 0.3);
  sparkBurst(p.x + n[0] * 0.05, p.y, p.z + n[1] * 0.05, n[0], 0, n[1], 10);
  G.cheat = true;""", """  if (!b7DigipassReste()) b7DigipassDisparait();   // jeu 2.0.7 : sur Bunker 7, il reste jusqu'au code du boss
  G.cheat = true;""")

# Étape 9 : fin de partie et retour au menu pendant le combat (module src/HB-boss-acces.js). Sans effet hors du combat.
# fin de partie : la musique et les sons du combat s'éteignent (le jeu joue sa propre fin de partie)
rep("""  Sound.setMuffle(true);
  exitLock();
  HUD.setDowned(false);""", """  Sound.setMuffle(true);
  b7FinDePartie();                             // jeu 2.0.7 : musique et sons du combat du boss éteints
  exitLock();
  HUD.setDowned(false);""")
# fin de partie pendant la phase 5 : derrière l'écran de fin, les lampes de Bunker 7 gardent l'obscurité des effets
rep("""updateLights(dt, G.time += dt * 0.3);""", """updateLights(dt, G.time += dt * 0.3); b7Lumieres(); /* jeu 2.0.7 : obscurité du boss gardée */""")
# retour au menu (Mod Tools compris) : le combat est remis à zéro, rien de lui ne reste au menu
rep("""  clearZombies(); clearFX(); resetFeatures(); resetPlayer(); resetArms();
  if (G.editorSession && window.ZSEditor) {""", """  clearZombies(); clearFX(); resetFeatures(); resetPlayer(); resetArms();
  b7RetourMenu();                              // jeu 2.0.7 : combat du boss remis à zéro (musique, Septième, effets, obscurité)
  if (G.editorSession && window.ZSEditor) {""")
