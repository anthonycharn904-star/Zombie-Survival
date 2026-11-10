# Marécages Maudits : points d'accroche (retouches du moteur)

107 retouches (celles du kit, puis celles du confort), appliquées dans cet ordre par `etape.py` sur le jeu construit par `build.py`. Chacune doit trouver son
motif exactement une fois, dans la déclaration indiquée ; sinon la construction s'arrête et nomme la retouche, son lieu et
la session qui travaille sur ce code. Données : `retouches/kit.py` (motifs) et `retouches/controle.py` (contrôles).

| N° | Retouche | Lieu | Dans | Code travaillé par |
|---:|---|---|---|---|
| 1 | owLoad zones | `src/60-map.js` | `owLoad` | Khamsin et cartes ouvertes (Claude 2) |
| 2 | owLoad marais | `src/60-map.js` | `owLoad` | Khamsin et cartes ouvertes (Claude 2) |
| 3 | owLoad lune après le marais | `src/60-map.js` | `owLoad` | Khamsin et cartes ouvertes (Claude 2) |
| 4 | owUnload marais | `src/60-map.js` | `owUnload` | Khamsin et cartes ouvertes (Claude 2) |
| 5 | owUpdateView marais | `src/60-map.js` | `owUpdateView` | Khamsin et cartes ouvertes (Claude 2) |
| 6 | owUpdate marais | `src/60-map.js` | `owUpdate` | Khamsin et cartes ouvertes (Claude 2) |
| 7 | owResetWorld marais | `src/60-map.js` | `owResetWorld` | Khamsin et cartes ouvertes (Claude 2) |
| 8 | owPickSpawn marais | `src/40-phys.js` | `owPickSpawn` | Khamsin et cartes ouvertes (Claude 2) |
| 9 | owGroundColor marais | `src/50-render.js` | `owGroundColor` | Khamsin et cartes ouvertes (Claude 2) |
| 10 | owHud fond marais | `src/60-map.js` | `owHud` | Khamsin et cartes ouvertes (Claude 2) |
| 11 | owUpdateHud marques | `src/60-map.js` | `owUpdateHud` | Khamsin et cartes ouvertes (Claude 2) |
| 12 | owViewLum marais | `src/60-map.js` | `owViewLum` | Khamsin et cartes ouvertes (Claude 2) |
| 13 | owDarkness marais | `src/70-vehicles.js` | `owDarkness` | Khamsin et cartes ouvertes (Claude 2) |
| 14 | owBaseThumb marais | `src/62-open.js` | `owBaseThumb` | Khamsin et cartes ouvertes (Claude 2) |
| 15 | owUseBase marais | `src/63-mods.js` | `owUseBase` | Khamsin et cartes ouvertes (Claude 2) |
| 16 | owProtectMask marais | `src/63-mods.js` | `owProtectMask` | Khamsin et cartes ouvertes (Claude 2) |
| 17 | owApplyMods pentes marais | `src/63-mods.js` | `owApplyMods` | Khamsin et cartes ouvertes (Claude 2) |
| 18 | owBuildFeatures marais | `src/95-features.js` | `owBuildFeatures` | Khamsin et cartes ouvertes (Claude 2) |
| 19 | zoneOn Khamsin seulement | `src/A1-zone.js` | `zoneOn` | Khamsin et cartes ouvertes (Claude 2) |
| 20 | khSpeedType marais | `src/B0-enemies.js` | `khSpeedType` | Khamsin et cartes ouvertes (Claude 2) |
| 21 | khZombieType marais | `src/B0-enemies.js` | `khZombieType` | Khamsin et cartes ouvertes (Claude 2) |
| 22 | khLook marais | `src/B0-enemies.js` | `khLook` | Khamsin et cartes ouvertes (Claude 2) |
| 23 | khSerialize marais | `src/E0-quest.js` | `khSerialize` | Khamsin et cartes ouvertes (Claude 2) |
| 24 | khRestore marais | `src/E0-quest.js` | `khRestore` | Khamsin et cartes ouvertes (Claude 2) |
| 25 | khMenuTips marais | `src/G0-menu.js` | `khMenuTips` | Khamsin et cartes ouvertes (Claude 2) |
| 26 | khOnRound marais | `src/A0-storm.js` | `khOnRound` | Khamsin et cartes ouvertes (Claude 2) |
| 27 | BUILTIN_MAPS | `hooks.py` | `BUILTIN_MAPS` | Intégration (Claude 5) |
| 28 | catalogue marais | `hooks.py` | `loadMapCatalog` | Intégration (Claude 5) |
| 29 | tampon en développement | `html (jeu 1.9.0)` | `html` | Interface (Claude 4) |
| 30 | astuces marais | `html (hooks.py)` | `html` | Interface (Claude 4) |
| 31 | vehStep barque | `src/70-vehicles.js` | `vehStep` | Khamsin et cartes ouvertes (Claude 2) |
| 32 | vehPose barque | `src/70-vehicles.js` | `vehPose` | Khamsin et cartes ouvertes (Claude 2) |
| 33 | vehCellFree barque | `src/70-vehicles.js` | `vehCellFree` | Khamsin et cartes ouvertes (Claude 2) |
| 34 | vehEnter barque | `src/70-vehicles.js` | `vehEnter` | Khamsin et cartes ouvertes (Claude 2) |
| 35 | vehExit places barque | `src/70-vehicles.js` | `vehExit` | Khamsin et cartes ouvertes (Claude 2) |
| 36 | vehExit barque à l’eau | `src/70-vehicles.js` | `vehExit` | Khamsin et cartes ouvertes (Claude 2) |
| 37 | vehExit son barque | `src/70-vehicles.js` | `vehExit` | Khamsin et cartes ouvertes (Claude 2) |
| 38 | owDriveStep vue barque | `src/70-vehicles.js` | `owDriveStep` | Khamsin et cartes ouvertes (Claude 2) |
| 39 | vehCamera barque | `src/70-vehicles.js` | `vehCamera` | Khamsin et cartes ouvertes (Claude 2) |
| 40 | updateArms barque nage | `hooks.py` | `updateArms` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 41 | vehInteractable hold barque | `src/70-vehicles.js` | `vehInteractable` | Khamsin et cartes ouvertes (Claude 2) |
| 42 | vehInteractable useHold barque | `src/70-vehicles.js` | `vehInteractable` | Khamsin et cartes ouvertes (Claude 2) |
| 43 | vehInteractable prompt barque | `src/70-vehicles.js` | `vehInteractable` | Khamsin et cartes ouvertes (Claude 2) |
| 44 | vehInteractable prompt épave | `src/70-vehicles.js` | `vehInteractable` | Khamsin et cartes ouvertes (Claude 2) |
| 45 | vehInteractable use épave | `src/70-vehicles.js` | `vehInteractable` | Khamsin et cartes ouvertes (Claude 2) |
| 46 | owResetVehicles barque | `src/70-vehicles.js` | `owResetVehicles` | Khamsin et cartes ouvertes (Claude 2) |
| 47 | openValidate barque | `src/62-open.js` | `openValidate` | Khamsin et cartes ouvertes (Claude 2) |
| 48 | owEditorPlace barque | `src/97-editor.js` | `owEditorPlace` | Khamsin et cartes ouvertes (Claude 2) |
| 49 | updatePlayer nage | `hooks-glissade.py` | `updatePlayer` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 50 | updatePlayer patauger | `jeu 1.9.0` | `updatePlayer` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 51 | chase patauger | `jeu 1.9.0` | `chase` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 52 | chase attente sur la rive | `jeu 1.9.0` | `chase` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 53 | chase pas de recyclage sur l’eau | `jeu 1.9.0` | `chase` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 54 | owSandBurst marais | `src/60-map.js` | `owSandBurst` | Khamsin et cartes ouvertes (Claude 2) |
| 55 | owSandHit marais | `src/60-map.js` | `owSandHit` | Khamsin et cartes ouvertes (Claude 2) |
| 56 | HUD coque | `src/60-map.js` | `owUpdateHud` | Khamsin et cartes ouvertes (Claude 2) |
| 57 | fireWeapon bruit | `jeu 1.9.0` | `fireWeapon` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 58 | hitscan let | `hooks.py` | `hitscan` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 59 | hitscan eau bête | `jeu 1.9.0` | `hitscan` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 60 | hitscan bête touchée | `jeu 1.9.0` | `hitscan` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 61 | hitscan gerbe | `jeu 1.9.0` | `hitscan` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 62 | blastCone bête | `jeu 1.9.0` | `blastCone` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 63 | projectiles eau bête | `jeu 1.9.0` | `updateProjectiles` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 64 | projectiles coup direct bête | `jeu 1.9.0` | `updateProjectiles` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 65 | grenade dans l’eau | `hooks.py` | `updateGrenades` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 66 | explode marais | `jeu 1.9.0` | `explode` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 67 | window.ZS marais | `hooks-khepesh.py` | `boot` | interface des Mod Tools, window.ZS (Claude 2 et Claude 5) |
| 68 | persoEtatLocal siège barque | `src/H1-personnage.js` | `persoEtatLocal` | Animations (Claude 1) |
| 69 | persoEtatLocal visible barque | `src/H1-personnage.js` | `persoEtatLocal` | Animations (Claude 1) |
| 70 | persoAssis barque | `src/H1-personnage.js` | `persoAssis` | Animations (Claude 1) |
| 71 | vehCamera montée barque | `src/70-vehicles.js` | `vehCamera` | Khamsin et cartes ouvertes (Claude 2) |
| 72 | matières des noyés | `hooks.py` | `buildMaterials` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 73 | zPartVisible pièce facultative | `jeu 1.9.0` | `zPartVisible` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 74 | updateZombie noyés | `hooks.py` | `updateZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 75 | killZombie noyés | `hooks.py` | `killZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 76 | rayHitZombie noyés | `hooks.py` | `rayHitZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 77 | startCrawl noyés | `jeu 1.9.0` | `startCrawl` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 78 | vehZombies noyés | `src/70-vehicles.js` | `vehZombies` | Khamsin et cartes ouvertes (Claude 2) |
| 79 | fiche du Noyé | `hooks.py` | `SPECIMEN_FACTS` | Interface (Claude 4) |
| 80 | setModelAnim noyé | `hooks.py` | `setModelAnim` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 81 | carte en développement | `jeu 1.9.0` | `openMapSelect` | Interface (Claude 4) |
| 82 | aliveCount sans les noyés | `jeu 1.9.0` | `aliveCount` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 83 | matières des stryges (enchaînée sur « matières des noyés ») | `hooks.py` | `buildMaterials` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 84 | fiche de la Stryge (enchaînée sur « fiche du Noyé ») | `hooks.py` | `SPECIMEN_FACTS` | Interface (Claude 4) |
| 85 | setModelAnim stryge (enchaînée sur « setModelAnim noyé ») | `hooks.py` | `setModelAnim` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 86 | bouton tir dans l’aile | `jeu 1.9.0` | `selectSpecimen` | Interface (Claude 4) |
| 87 | updateZombie stryges (enchaînée sur « updateZombie noyés ») | `hooks.py` | `updateZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 88 | killZombie stryges (enchaînée sur « killZombie noyés ») | `hooks.py` | `killZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 89 | rayHitZombie stryges (enchaînée sur « rayHitZombie noyés ») | `hooks.py` | `rayHitZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 90 | damageZombie stryges | `hooks.py` | `damageZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 91 | startCrawl stryges (enchaînée sur « startCrawl noyés ») | `jeu 1.9.0` | `startCrawl` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 92 | gibArm stryges | `jeu 1.9.0` | `gibArm` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 93 | zLegHit stryges | `jeu 1.9.0` | `zLegHit` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 94 | vehZombies stryges (enchaînée sur « vehZombies noyés ») | `src/70-vehicles.js` | `vehZombies` | Khamsin et cartes ouvertes (Claude 2) |
| 95 | newGame manches de stryges | `hooks.py` | `newGame` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 96 | startRound PV des stryges | `hooks.py` | `startRound` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 97 | dogRoundStart stryges | `jeu 1.9.0` | `dogRoundStart` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 98 | updateDogSpawns stryges | `jeu 1.9.0` | `updateDogSpawns` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 99 | endRound stryges | `jeu 1.9.0` | `endRound` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 100 | onZombieKilled stryges | `jeu 1.9.0` | `onZombieKilled` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 101 | HUD manche des stryges | `jeu 1.9.0` | `HUD` | Interface (Claude 4) |
| 102 | killZombie foudre | `jeu 1.9.0` | `killZombie` | zombies et manches (Bunker 7, Claude 3, accroche aussi ce code) |
| 103 | compteur des stryges | `html (jeu 1.9.0)` | `html` | Interface (Claude 4) |
| 104 | bannière des stryges | `html (jeu 1.9.0)` | `html` | Interface (Claude 4) |
| 105 | confort : secousse de la vue | `jeu 1.9.0` | `updateCamera` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 106 | confort : à-coup des coups reçus | `jeu 1.9.0` | `updateCamera` | moteur commun (Claude 5 ; Animations pour les armes et le joueur) |
| 107 | confort : secousse des véhicules | `src/70-vehicles.js` | `vehCamera` | Khamsin et cartes ouvertes (Claude 2) |
