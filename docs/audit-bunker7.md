# Audit technique de Bunker 7

Référence du chantier Bunker 7, à lire au début de chaque session de ce chantier, après `CLAUDE.md` et `docs/transmission.md`.

- **État audité** : jeu 2.0.6, construction 1, commit `3667acd`, branche `chantier/bunker7` (Worktree `~/dev/zs-bunker7`).
- **Audit** : fait en lecture seule le 31 octobre 2026, puis recoupé le même jour avec le code, le README et `docs/transmission.md`. Enregistré ici à la demande d'Anthony (31 octobre 2026).
- **Repères** : les fonctions sont citées par leur nom. Les numéros de ligne du jeu construit changent à chaque construction : chercher avec `grep -n` (au commit `3667acd`, `const BUNKER7` est à la ligne 6283).

## 1. Cadre du chantier

Règles fixées par Anthony le 31 octobre 2026, en plus de `CLAUDE.md` :

- Session dédiée à Bunker 7. Travail exclusivement dans `~/dev/zs-bunker7`, sur `chantier/bunker7`.
- Ne jamais modifier `~/dev/zs-verif`, les autres Worktrees ni leurs branches, `main` ou `dev`. Ne pas intervenir sur le travail des animations des armes.
- Aucun commit, fusion, envoi, suppression ou publication sans son accord explicite. Aucune protection désactivée ou contournée, bac à sable compris.
- Un changement qui touche un système commun du moteur : lui en expliquer les conséquences et attendre son accord.
- Ressources : sa machine a déjà saturé sa mémoire et son swap pendant des rendus Blender. Pas de calcul lourd pendant le rendu d'une autre session ; vérifier la charge avant un essai coûteux ; fichiers temporaires propres à la session ; jamais les chemins ni les journaux d'une autre session.
- Méthode pour chaque demande : analyser, repérer les fichiers, vérifier les conflits avec les autres sessions, présenter la solution, attendre l'accord avant une modification importante, développer dans ce Worktree, essayer en isolement, chercher les régressions, présenter les résultats et les différences, attendre l'accord avant toute intégration Git.
- **Boss fight** : conçu par Anthony. **Le boss et les étapes pour y accéder sortent au jeu 2.0.7** (décision d'Anthony du 31 octobre 2026). Il transmettra les fichiers, modèles, animations, codes et instructions. Rien n'est développé avant leur réception. Respecter au plus près leur fonctionnement, leurs animations, leur rendu et leurs caractéristiques ; toute adaptation technique indispensable lui est expliquée avant d'être faite.
- La première session de ce chantier a été ouverte par erreur dans un sous-Worktree créé par l'appli de bureau (`.claude/worktrees/bunker7-dev-1cd72b`, branche `claude/bunker7-dev-1cd72b`, vides) : les garder ou les supprimer est la décision d'Anthony.

## 2. Vérification de départ (31 octobre 2026)

| Étape | Résultat |
|---|---|
| `npm ci` dans `launcher/` (accord d'Anthony) | 289 paquets en 13 s, `package-lock.json` inchangé (npm 11.19.0) |
| `python3 engine/tools/build.py --out <dossier temporaire de la session>/zs.html` | **identique octet pour octet** à `game/zombie-survival.html` : 7 485 058 octets, 55 150 lignes, 55 modules, en 1,5 s (79 Mo de mémoire) |
| SHA-256 | `2baa0f1a42027f382d5786b5cccc17de02983f1bdfc8ffbd09a22a2777e9eb56`, le jeu de la suite E2 du 20 octobre 2026 (1 018 vérifications sur 1 018) |
| `python3 engine/tools/dupcheck.py` | aucun doublon |
| `node scripts/prepare-game.js` | jeu 2.0.6 préparé dans `launcher/game/` (15 fichiers, ignoré par Git) |
| `npm test` | 31 tests sur 31 |

Remarques :

- Electron 44 n'a plus de script d'installation : son binaire sera sorti du cache (`~/.cache/electron`, version 44.5.1 présente) au premier lancement. Inutile dans le bac à sable, où Electron ne démarre pas.
- npm 11 n'a pas lancé le script d'installation d'`electron-winstaller` (règle `allowScripts`). Ce paquet sert à l'installateur Squirrel ; le projet produit un installateur NSIS (confiance moyenne : à vérifier à la première construction de l'installateur depuis ce Worktree).
- `$TMPDIR` vaut `/tmp/claude-1000`, partagé entre les sessions : utiliser le dossier temporaire propre à la session.

## 3. Données de la carte

**Où.** L'objet `BUNKER7` (section 01 « Données ») vient tel quel du jeu 1.9.0 (commit `69fe3cc`), la base de `build.py`. Aucun module de `engine/src` ni aucun point d'accroche ne le modifie : `hooks.py` l'ajoute seulement au catalogue (`BUILTIN_MAPS = [BUNKER7, KHAMSIN, OMBRE]`) et à `window.ZS`.

**Généralités.** Format 1, identifiant `bunker7`, graine 7, un seul niveau, murs de 3,5 m, grille de 52 × 31 cases de 1 m. Coordonnées des éléments : `[colonne, ligne]` de la grille ; `pos` des lumières et des panneaux : `[x, hauteur, z]` en mètres.

```
    0         1         2         3         4         5
    0123456789012345678901234567890123456789012345678901
 0                  ooo     ooo     ooo                 
 1                  ooo     ooo     ooo                 
 2                  ooo     ooo     ooo                 
 3             ######W#######W#######W#######           
 4             #............................#           
 5             #............................#           
 6          ooo#............................#           
 7          oooW............................#ooo        
 8          ooo#......P..............P......Wooo        
 9        ooo  #............................#ooo        
10        ooo  #............................#           
11        ooo  #............................#           
12     ####W#####DD####################DD############   
13     #............#................#..............#   
14     #............#................#..............#   
15     #............#................#..............#   
16  ooo#............#................#....xx........#   
17  oooW............#...x............#....x.........#ooo
18  ooo#....xx......#...x............#..............Wooo
19     #....xx......D................D..............#ooo
20     #............D................D..............#   
21     #............#................#.........xx...#   
22  ooo#............#............x...#..............#   
23  oooW.......xx...#............x...#..............#ooo
24  ooo#............#................#..............Wooo
25     #............#................#..............#ooo
26     #............#................#..............#   
27     #################W####W###W##########W########   
28                     ooo  ooo ooo        ooo          
29                     ooo  ooo ooo        ooo          
30                     ooo  ooo ooo        ooo          
```

Légende : `#` mur, `.` sol intérieur, `W` fenêtre barricadée, `D` porte payante, `x` caisses, `P` pilier, `o` cour où les zombies sortent de terre, espace : vide (dehors). Chaque fenêtre a sa cour de 3 × 3 cases.

**Champs vides.** `risers: []` (aucune apparition au sol : les zombies ne viennent que des fenêtres), `props: []` (aucun objet posé).

## 4. Pièces et progression

| Pièce | Intérieur (colonnes, lignes) | Zombie | Fenêtres |
|---|---|---|---|
| Salle d'arrivée | 17 à 32, 13 à 26 (16 × 14 m) | N°00 · Le Fantassin (par défaut) | 3 au sud : (20, 27), (25, 27), (29, 27) |
| Entrepôt | 34 à 47, 13 à 26 (14 × 14 m) | N°00-D · La Sentinelle (`sentinelle`) | 3 : (48, 18) et (48, 24) à l'est, (40, 27) au sud |
| Infirmerie | 4 à 15, 13 à 26 (12 × 14 m) | N°00-C · Le Savant (`savant`) | 3 : (7, 12) au nord, (3, 17) et (3, 23) à l'ouest |
| Salle des machines | 12 à 39, 4 à 11 (28 × 8 m) | N°00-A · Le Lacéré (`lacere`) | 5 : (17, 3), (25, 3), (33, 3) au nord, (11, 7) à l'ouest, (40, 8) à l'est |

Pièces (`zones`) : graine de la pièce et teinte de la lumière. Arrivée `[24, 20]`, `[1, 0.96, 0.9]` ; Entrepôt `[40, 20]`, `[1.05, 0.9, 0.74]` ; Infirmerie `[9, 15]`, `[0.84, 0.98, 0.9]` ; Machines `[25, 5]`, `[0.8, 0.87, 1.02]`.

| Porte | Cases | Prix | Type | Relie |
|---|---|---|---|---|
| 0 | (33, 19), (33, 20) | 750 | `door` (« ouvrir la porte ») | Arrivée et Entrepôt |
| 1 | (16, 19), (16, 20) | 1 000 | `debris` (« dégager les débris ») | Arrivée et Infirmerie |
| 2 | (35, 12), (36, 12) | 1 250 | `steel` (« ouvrir la porte blindée ») | Entrepôt et Machines |
| 3 | (13, 12), (14, 12) | 1 250 | `debris` | Infirmerie et Machines |

**Progression.** Départ dans la Salle d'arrivée (`spawn` en (24,5 ; 22,5), regard au nord), avec le M1911, 500 points, courant éteint (`rules`). On ouvre l'Entrepôt (750) ou l'Infirmerie (1 000), puis la Salle des machines par l'une ou l'autre (1 250). Les quatre pièces forment une boucle. L'interrupteur de la Salle des machines rétablit le courant : il réveille Le Glas, quatre atouts sur cinq (Quick Revive marche sans) et fait passer les deux lampes rouges au blanc. Les zombies ne sortent que des fenêtres des pièces ouvertes.

## 5. Éléments de jeu

| Élément | Identifiant | Case(s) | Tourné vers | Pièce |
|---|---|---|---|---|
| Arme murale | `kar98k` (Kar98k, 200) | (20, 12) | sud | Arrivée |
| Arme murale | `g43` (Gewehr 43, 600) | (29, 12) | sud | Arrivée |
| Digi pass | `digipass` (off 0,35 m, hauteur 1,45 m) | (30, 12) | sud | Arrivée, à droite de la Gewehr 43 |
| Arme murale | `trench` (M1897 Trench, 1 500) | (42, 12) | sud | Entrepôt |
| Arme murale | `mp40` (MP40, 1 000) | (44, 27) | nord | Entrepôt |
| Arme murale | `thompson` (Thompson, 1 200) | (3, 20) | est | Infirmerie |
| Arme murale | `dbarrel` (Double canon, 1 200) | (10, 12) | sud | Infirmerie |
| Arme murale | `stg44` (STG-44, 1 200) | (21, 3) | sud | Machines |
| Arme murale | `bar` (BAR, 1 800) | (29, 3) | sud | Machines |
| Atout | `souffle` (Quick Revive, Lazare, 500, sans courant) | (17, 14) | est | Arrivée |
| Atout | `mainleste` (Rechargement rapide, Vif-Argent, 3 000) | (47, 15) | ouest | Entrepôt |
| Atout | `cuirasse` (Mastodonte, Cuirasse, 2 500) | (5, 26) | nord | Infirmerie |
| Atout | `detente` (Double coup, Toccata, 2 000) | (12, 10) | est | Machines |
| Atout | `endurance` (Staminup, Pèlerin, 2 000) | (39, 5) | ouest | Machines |
| Boîte n° 0 (départ : `boxStart: 0`) | `boxes[0]` | (24, 13), (25, 13) | sud | Arrivée |
| Boîte n° 1 | `boxes[1]` | (34, 14), (34, 15) | est | Entrepôt |
| Boîte n° 2 | `boxes[2]` | (12, 26), (13, 26) | nord | Infirmerie |
| Boîte n° 3 | `boxes[3]` | (14, 4), (15, 4) | sud | Machines |
| Interrupteur | `power` | (40, 10) | ouest | Machines |
| Le Glas | `amp` | (25, 7), (26, 7) | sud | Machines |

- Prix des armes : les prix habituels (`WEAPONS[].wall`) ; la carte n'en fixe aucun (`wallbuyPrice` lit d'abord `cost`).
- Le Glas : plafond ouvert sur les 6 × 3 m du beffroi, la lune éclaire la cloche (README, « Le Glas »).
- Caisses : (8-9, 18-19) et (11-12, 23) dans l'Infirmerie ; (20, 17-18) et (29, 22-23) dans l'Arrivée ; (38-39, 16), (38, 17) et (43-44, 21) dans l'Entrepôt. Piliers : (18, 8) et (33, 8) dans les Machines.

## 6. Lumières, panneaux, ambiance

| Lampe | Position | Couleur | Intensité, portée | Scintillement | Pièce |
|---|---|---|---|---|---|
| 1 | (21 ; 3,1 ; 17,5) | `#ffc78f` | 1,8 ; 12 m | 0,12 | Arrivée |
| 2 | (28,5 ; 3,1 ; 23) | `#ffb070` | 1,5 ; 11 m | 0,45 | Arrivée |
| 3 | (40,5 ; 3,1 ; 20) | `#ffb46a` | 1,9 ; 12 m | 0,25 | Entrepôt |
| 4 | (9,5 ; 3,1 ; 20) | `#cfe8ff` | 1,7 ; 12 m | 0,6 | Infirmerie |
| 5 | (18,5 ; 3,1 ; 6,5) | `#ff2a1a`, puis `#e6eeff` avec le courant | 1,5 ; 7,5 m, puis 11 m | 0,08 | Machines |
| 6 | (32,5 ; 3,1 ; 7) | `#ff2a1a`, puis `#e6eeff` avec le courant | 1,5 ; 7,5 m, puis 11 m | 0,08 | Machines |

Toutes sont des lampes (`fixture: "lamp"`). Les lanternes des Sentinelles s'y ajoutent (vraie lumière pour les 3 plus proches du joueur).

**Panneaux** (6) : au-dessus des portes. Côté Arrivée : « ENTREPÔT » et « INFIRMERIE » ; côtés Entrepôt et Infirmerie : « MACHINES » ; côté Machines : « ENTREPÔT » et « INFIRMERIE ».

**Ambiance** : ciel et brouillard `#05070b`, densité 0,05 ; hémisphère `#3c475c` / `#15110d`, 0,65 ; exposition 1,18 ; lune ; tuyaux au plafond (`pipes`, dessinés par `buildDecor`) ; murs de 3,5 m. Le champ `trees: 46` est ignoré : une carte qui a des abords ne pose pas ces arbres simples (`buildDecor`).

**Textures** : sol `bunker_floor`, murs `bunker_wall`, plafond `bunker_ceiling`, extérieur `bunker_wall`, terrain `frost_ground`.

**Abords** : `outskirts: { seed: 7, density: 1 }`, construits par `buildOutskirts` (appelé par `buildDecor`). D'après le README (« Abords de Bunker 7 ») : 22 bâtiments en ruine tous différents, environ 175 arbres, brume de clair de lune (66 bancs bas, 20 voiles hauts, deux volutes par cour), 11 m dégagés devant chaque fenêtre, graine fixe, environ 1 s au chargement, environ 370 000 triangles. Décor seulement : on n'y va pas.

**Caméra du menu** : `menuCam` en (24,6 ; 1,72 ; 21,6), regard vers (24,9 ; 1,25 ; 13,4), balancement (3,4 ; 1,5).

## 7. Chaîne de chargement

1. Toute carte passe par `normalizeMap`, qui appelle d'abord `withBuiltinAdditions`. Pour une carte d'identifiant `bunker7` venue des Mod Tools, celle-ci reprend de la carte intégrée :
   - le digi pass, s'il manque et si les 5 × 5 cases autour de sa case sont inchangées ;
   - les abords, s'ils manquent ;
   - le zombie de chaque pièce, si aucune pièce n'en nomme (même nom de pièce).
2. `loadMap(map)` appelle `buildWorld(map)` (ou `owLoad` pour un monde ouvert), puis `resetFeatures`, `resetPlayer`, `resetArms` et `computeFlow(player.k)`.
3. `buildWorld` : `owUnload`, `disposeWorld`, aléa de la carte (`mulberry32(map.seed)`), textures et modèles propres à la carte, hauteur des murs, `applyMapLayout` (remplit `LAYOUT`), `parseMapGrid`, puis `buildLevelGeometry`, `buildDecor` (caisses, tuyaux, terrain, abords), `buildLights`, `buildLanterns`, `buildFeatures`, `buildElixirLights`, `buildProps`. Enfin `linearizeTree(root)` (conversion des couleurs du monde, une seule fois) et `applyAmbiance`.

## 8. Systèmes du moteur utilisés par Bunker 7

| Section | Système | Fonctions et données |
|---|---|---|
| 01 | Règles | `RULES` : 500 points, 24 zombies vivants au plus, 100 PV pour le joueur (250 avec Mastodonte), 30 dégâts par coup ; PV des zombies : 100, +50 par manche jusqu'à la 9, puis ×1,1 par manche ; boîte 950 ; munitions d'une arme reforgée 4 500 ; points : touche 10, élimination 50, tête 100, couteau 130, planche 10 (500 par manche au plus). `zombiesForRound`, `ZOMBIE_TYPES` (`fantassin`, `lacere`, `savant`, `sentinelle`), `DOGS`, `DOG_TYPE`, `GLAS`, `PERKS`. |
| 04 | Grille et collisions | `parseMapGrid`, `buildLevelGeometry`, `raycast`, `sightClear`, `computeFlow`, `flowAt`, `activateZone`, `buildLights`, `setPoweredLights` |
| 05 | Modèles et abords | `buildOutskirts`, modèles des zombies (`ZPARTS`, `variantGeometries`), du Molosse, des machines, du Glas |
| 09 | Zombies | `pickSpawnPoint` : fenêtres des pièces ouvertes, pondérées par la distance de marche au joueur et la file d'attente de la fenêtre ; `spawnZombie` : type de la pièce (`zoneZombieType`), sortie de terre à 2,6 à 4 m derrière la fenêtre ; 48 places de rendu (`ZR.N`), cadavres recyclés quand elles manquent ; `damageZombie`, `killZombie`. Chiens : `isDogRound`, `dogRoundStart` ; ils tombent du ciel dans les pièces ouvertes. |
| 10 | Éléments de jeu | `buildFeatures` ; fenêtres (`buildWindows`, `repairBoard`, `updateWindows`) ; portes (`buildDoors`, `openDoor`) ; achats muraux (`buildWallbuys`, `wallbuyPrice`) ; atouts (`buildPerks`, `grantPerk`) ; boîte (`buildBox`, `placeBox`) ; courant (`activatePower`) ; Le Glas (`buildAmpFeature`, `glas…`) ; digi pass (`buildDigipass`, `unlockDigipass`) ; bonus (`maybeDropPowerup`) ; butins des variantes (`maybeDropItem` : seringue du Savant 35 %, chargeur de la Sentinelle 25 %) ; lanternes ; `resetFeatures` |
| 11 | Partie | `G`, `addPoints`, `trySpend`, `startRound`, `endRound`, `updateRounds`, `onZombieKilled`, `schedule`, `newGame`, `gameOver`, `serializeGame`, `restoreSave`, `HUD`, `update`, `render`, `window.__zs` (outils d'essai) |

Les systèmes du jeu 2.0.6 s'appliquent à Bunker 7 comme ailleurs : préhension, personnage (vue TPS sur T), gestes, glissade et sprint tactique, HUD des points. Le corps-à-corps y est le couteau « Fossoyeur » (le khépesh est réservé à Khamsin).

## 9. Mod Tools et cartes publiées

- Bunker 7 s'ouvre dans l'atelier de l'auteur (`launcher/src/main/workspace.js` : `BUILTIN_MAPS`, `BUILTIN_NAMES`).
- Ses textures forment l'origine « Bunker 7 » du navigateur de textures (`launcher/src/modtools/browser.js`, d'après `ZS.BUNKER7` ; `texSrc` de `engine/src/N1-tex-cat.js`).
- Un fichier `maps/bunker7.json` publié remplace la carte intégrée. Aucun n'est livré aujourd'hui : `prepare-game.js` ne met que la liste des cartes intégrées dans `maps/`.
- Ce que les Mod Tools ne font pas encore pour cette carte (README) : poser un digi pass, régler les abords.
- L'ancienne Bunker 7 publiée par Anthony (jeu 1.5.0) sert d'exemple aux essais : `launcher/e2e/fixtures/bunker7-publiee-1.5.0.json`.

## 10. Où modifier Bunker 7

- **Données de la carte** : un nouveau fichier de points d'accroche, `engine/tools/hooks-bunker7.py`, avec `rep(ancien, nouveau)` sur le texte de `BUNKER7` (trouvé exactement une fois), appelé par `build.py`. Ajouter cet appel modifie `build.py`, fichier commun à toutes les sessions.
- **Nouveau système** (un boss, par exemple) : un module `engine/src/<préfixe>-<nom>.js`. L'ordre alphabétique des fichiers est l'ordre d'insertion : choisir un préfixe libre et vérifier ce qu'il doit suivre.
- **Code du jeu 1.9.0** (apparitions, manches, dégâts, HUD) : par des points d'accroche. Ce sont des systèmes communs : accord d'Anthony avant d'y toucher.
- **Numéros** : ne pas les changer dans la branche (`GAME_VERSION` 2.0.6, `GAME_BUILD` 1, `EDITOR_API` 9). Le boss sort avec la 2.0.7 ; la session d'intégration pose les numéros (décision d'Anthony du 31 octobre, confirmée le 2 novembre ; `SUIVI-BOSS-B7.md`). Si `window.ZS` change, le signaler pour `EDITOR_API`.
- **Après chaque modification** : construction, `dupcheck.py`, `prepare-game.js`, contrôles rapides avec `tzeval.js` et `e2e-page.js` (Chromium sans tête, dans le bac à sable), puis essais de bout en bout par Anthony, et documentation (README, `CLAUDE.md`, ce fichier).
- **Essais de bout en bout** : la méthode E2 de `CLAUDE.md` les prépare dans `~/dev/zs-verif`. Pour ce Worktree, la façon de lancer le script d'Anthony sur `~/dev/zs-bunker7/launcher` reste à décider avec lui.

## 11. Essais qui concernent Bunker 7

- Essais de bout en bout qui nomment Bunker 7 : `outskirts`, `zone-zombies`, `glas`, `elixirs`, `game-menu`, `glissade`, `hud-points`, `modtools`, `modtools-sizes`, `modtools-biblio`, `modtools-khamsin`, `modtools-desert`, `modtools-ombre`, `khamsin`, `khepesh`, `ombre`.
- D'autres lancent une partie sans nommer de carte (`dogs`, `perk-drink`, `rank`…) : ils jouent la carte chargée au démarrage, Bunker 7 a priori (non vérifié essai par essai).
- Electron ne démarre pas dans le bac à sable : ces essais tournent dans un terminal d'Anthony. Dans une session : `node engine/tools/e2e-page.js <dossier> <essai>…` joue leurs blocs dans la page du jeu, sans la remplacer.

## 12. Écarts et pistes connus

D'après `docs/transmission.md`. Rien de tout cela n'est à faire sans la demande d'Anthony.

- **Le Glas** : sa planche le place dans une chapelle en ruine, le jeu dans la salle des machines de Bunker 7 (écart jamais signalé comme tel). Autre écart : on tient F à 1,95 m de la cloche, et la corde bouge seule.
- **Lazare** : son âme ne monte que de 0,56 m sous le plafond de Bunker 7.
- **Valeurs « à équilibrer »** : les 100 PV du Fantassin et les multiplicateurs du Molosse sont appliqués tels quels ; Anthony voulait les régler après une partie d'essai.
- **Pistes notées** qui toucheraient la carte : abords réglables et digi pass déplaçable dans les Mod Tools, manches de chiens réglables par carte, deux armes murales sur les deux faces d'un mur, quête du battant du Glas, calibrage du Glas, pièges électriques, téléporteur, œuf de Pâques, ambiance des manches de chiens, chiens de feu, nouveaux mods de munition, fiche du Notable (N°00-B), option « mouvements de caméra réduits ».
- **Confort de la vue** : Anthony a le vertige. Aucune secousse de caméra ni aucun zoom dans un nouvel effet sans son accord. Le jeu de base secoue encore la vue quand le joueur est touché, aux explosions et à l'apparition des chiens.

## 13. Autres sessions et risques de conflit (31 octobre 2026, 14 h 15)

Relevé en lecture seule ; ces chantiers avancent, refaire le relevé avant toute intégration.

- **Animations des armes** : `chantier/anim-2.0.7`, dans `~/dev/zs-verif`, sans modification à cette date. Ses modules (`H0` à `H3`, `hooks-prehension.py`, `hooks-gestes.py`) ne sont pas sur le chemin de Bunker 7.
- **Cartes** : `chantier/carte`, Worktree `~/dev/zs-verif-logs/carte-2.0.8/zs-carte`, travail non commité.
  - 19 fichiers modifiés : modules du monde ouvert (`30-solid`, `31-log`, `40-phys`, `62-open`, `63-mods`, `64-buildings`, `95-features`, `96-props`, `97-editor`, `A0-storm`, `B0-enemies`, `C0-sanctuary`, `M1-decor`), Mod Tools (`ow-core.js`, `ow-tools.js`, `ow-ui.js`), `engine/tools/build.py`, README, jeu construit.
  - Nouveaux fichiers : `engine/src/65-etages.js`, `engine/src/N7-tex-photo.js`, `engine/tools/hooks-carte.py`, `engine/tools/textures-photo.js`, dossier `engine/assets/`.
  - Aucune de ses modifications ne nomme Bunker 7. Elle modifie en revanche `build.py`, où ce chantier ajoutera l'appel de `hooks-bunker7.py` : conflit simple, à régler à la fusion.
- **Interface** : `chantier/interface`, Worktree `~/dev/zs-interface`, créé le 31 octobre 2026 pendant cet audit, sans modification à 14 h 15. Son sujet n'est pas connu ici ; s'il touche le HUD, il croisera un boss qui a besoin d'un affichage (jauge de vie, par exemple).
- **Fichiers communs**, conflits attendus à chaque fusion : `game/zombie-survival.html` (se règle en reconstruisant, jamais à la main), `engine/tools/build.py`, `GAME_VERSION` et `GAME_BUILD`, `README.md`, `CLAUDE.md`, la liste `test:e2e` de `launcher/package.json`.
- **Numéro 2.0.7** : le boss et ses étapes d'accès sortent au jeu 2.0.7 (décision d'Anthony du 31 octobre 2026). Le chantier des animations porte le même numéro : sortie commune ou autre numéro, à régler avec Anthony au moment de l'intégration.

## 14. Boss du jeu 2.0.7 : ce que le moteur offre déjà

Relevé en lecture seule le 31 octobre 2026, avant la réception des fichiers d'Anthony. Rien n'est commencé.

- **Le Gardien de Khamsin** (`engine/src/D0-gardien.js`, éteint depuis le jeu 2.0.6 : `KHG_ON = false`) est le seul boss du moteur.
  - Il entre dans la liste des zombies (`Zombies.list`), avec `boss: true` et son type `GARDIEN_TYPE` (`boss: true`) : tirs, explosions et couteau le trouvent.
  - Ses fonctions : modèle (`khGardienModel`, `khGardienPose`), apparition (`khGardienSpawn`), comportement (`khGardienUpdate`, `khGardienArena`, coups `khGardienSlam` et `khGardienWhirl`, renforts `khGardienSummon`), dégâts (`khGardienRay`, `KHG_HIT`, `khGardienDamage`), mort (`khGardienDie`), étincelles au lieu du sang (`khGardienSpark`), sons (`khGardienSound`), jauge de vie (`khBossBar`), fiche de l'écran Modèles (`makeGardienSpecimen`).
  - Ses branchements dans le code du jeu 1.9.0 sont dans `engine/tools/hooks.py` et appellent ses fonctions par leur nom : `updateZombie`, `rayHitZombie`, `damageZombie`, `killZombie` (sans effet sur lui : il meurt par ses dégâts), le sang des impacts, les boucles des chiens, la distance de la caméra de l'écran Modèles.
  - Un second boss demandera soit de rendre ces branchements génériques (modification de `hooks.py`, fichier commun), soit de placer les siens devant eux (`hooks-bunker7.py`). Choix à soumettre à Anthony.
- **Étapes d'accès** : les cartes en grille, dont Bunker 7, n'ont aucun système de quête.
  - Les deux quêtes du jeu sont des modules du monde ouvert : « Sortir du Khamsin » (`E0-quest.js`, éteinte depuis le jeu 2.0.6 : `KHQ_ON = false`, code gardé pour une future quête) et « quitter la Lune » (`L9-lune-quete.js`).
  - Leur forme peut servir de modèle : pièces à trouver puis à poser, séquence à tenir, objectifs à l'écran. Leur code dépend du monde ouvert.
- **Interactions** : chaque élément interactif de Bunker 7 est une entrée de `Features.interactables` (position, rayon, `prompt()`, puis `use()`, ou `hold` et `useHold(dt)` pour une touche maintenue), lue par `updateInteract` (touche F). C'est la voie naturelle pour des étapes à activer sur la carte.

## 15. Non couvert par cet audit

À étudier à la réception des fichiers du boss, avant de proposer son intégration :

- l'ajout d'un type d'ennemi : `ZOMBIE_TYPES` et ses champs, `ZPARTS`, `variantGeometries`, `SPECIMEN_MODELS`, `SPECIMEN_FACTS` (README, « Variantes du Fantassin ») ; Le Molosse comme modèle d'un ennemi à squelette propre ;
- les dégâts et la mort : `damageZombie`, `killZombie`, `onZombieKilled`, les points ;
- le déroulé des manches : `zombiesForRound`, `startRound`, `endRound`, `updateRounds`, `schedule`, les manches spéciales (chiens) ;
- la sauvegarde (`serializeGame`, `restoreSave`), le HUD, le son (`Sound`, `Sound.bus()`), les outils d'essai `window.__zs` ;
- les performances de la carte en jeu : rien n'a été mesuré en images ni en temps de rendu.
