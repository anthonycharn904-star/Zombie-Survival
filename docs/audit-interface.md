# Audit des interfaces

Référence du chantier interface, à lire au début de chaque session de ce chantier, après `CLAUDE.md` et `docs/transmission.md`.

- **État audité** : jeu 2.0.6, construction 1, commit `3667acd`, branche `chantier/interface` (worktree `~/dev/zs-interface`).
- **Audit** : fait en lecture seule le 31 octobre 2026, puis complété le même jour avec l'accord d'Anthony (dépendances du launcher, jeu préparé, tests unitaires, banc de la couche HUD). Enregistré ici à sa demande (31 octobre 2026). Le soir, après ses décisions sur l'audit : caractéristiques des deux modes du champ de vision (§11), comparaison des propositions du HUD (§12), place réservée de la jauge du boss (§13), banc rangé dans `engine/tools/banc-interface/` (§10).
- **Repères** : les fonctions sont citées par leur nom. Les numéros de ligne du jeu construit changent à chaque construction : chercher avec `grep -n`.

## 1. Cadre du chantier

Responsabilités confiées par Anthony le 31 octobre 2026 :

1. le HUD en jeu : points, manches, munitions, santé, atouts, informations et indicateurs ;
2. les menus : menu principal, choix des cartes, paramètres, pause, statistiques et navigation ;
3. les interfaces des Mod Tools : panneaux, boutons, outils, navigateurs, fenêtres et ergonomie ;
4. les éléments graphiques et les animations des interfaces ;
5. la compatibilité avec les résolutions 16:9 et 21:9.

Règles du 31 octobre 2026, en plus de `CLAUDE.md` :

- travail exclusivement dans `~/dev/zs-interface`, sur `chantier/interface` ; ne jamais modifier les autres worktrees, ni `dev`, ni `main` ;
- aucun commit, fusion, envoi ou publication sans son accord ; aucune fusion vers `dev` ou `main` ;
- protections Git, règles du projet et méthodes de construction du moteur respectées (le jeu construit ne se modifie jamais à la main) ;
- aucune mécanique de jeu modifiée sans son autorisation ;
- signaler les risques de conflit avec les autres chantiers.

Décisions d'Anthony du 31 octobre 2026, en réponse à la première analyse :

1. **Dépendances** : `npm ci` autorisé seulement dans `~/dev/zs-interface/launcher`, et `prepare-game.js` dans ce worktree. Vérifier avant la mémoire disponible et les scripts d'installation ; ne toucher à aucune dépendance globale ni à aucun autre worktree ; aucun essai lourd pendant les rendus des autres sessions. Fait (§2).
2. **Versions** : la 2.0.7 regroupera notamment les animations des armes, le boss de Bunker 7 et les améliorations d'interface validées. Le chantier Khamsin (cartes) prépare la 2.0.8 : ne pas supposer que ses modifications rejoignent la 2.0.7. `GAME_VERSION`, `GAME_BUILD` et `EDITOR_API` ne se changent pas sans coordination. L'intégration finale sera faite par une cinquième session Claude Code, sur son ordre (worktree `~/dev/zs-integration-207`, branche `integration/2.0.7`, créés le 31 octobre).
3. **Mod Tools** : ne pas modifier les systèmes communs avec le chantier Khamsin, notamment les modules `ow-*.js`. Les analyser et préparer des propositions, à coordonner avant de les appliquer. Les interfaces indépendantes du chantier cartographique peuvent être travaillées après son autorisation.
4. **Documentation** : cette analyse est enregistrée ici, dans `~/dev/zs-interface` seulement. Pas de commit sans son accord.
5. **Isolation** : chaque session doit pouvoir modifier exclusivement son propre worktree. Pour l'instant, aucune protection, configuration Git ou règle du bac à sable n'est changée. Les autorisations trop larges sont documentées (§3). La cinquième session étudiera une meilleure isolation, sans affaiblir les protections ni les mécanismes de commit.
6. **21:9** : approfondir le champ de vision et le HUD sur son écran 3440 × 1440 ; comparer 16:9 et 21:9 avec des captures réelles si les outils et les ressources le permettent. Ne modifier ni le champ de vision ni les proportions de l'interface avant de lui avoir présenté les propositions et leurs conséquences visuelles (§6).
7. **Boss de Bunker 7** : ne pas développer de jauge de vie avant de connaître les besoins du boss ; les deux sessions se coordonneront quand ses caractéristiques seront définies.
8. **Suite** : confirmer que les tests de base fonctionnent et que les autres worktrees sont intacts (§2), puis attendre ses instructions pour les premières modifications des interfaces.

Décisions d'Anthony du 31 octobre 2026 au soir, sur l'audit (il en valide les tests) :

1. **Captures 3D** : reportées tant que la session des animations consomme beaucoup de ressources ; elles se feront quand la machine sera assez libre.
2. **Champ de vision en 21:9** : il préfère la proposition B (le joueur choisit entre le champ actuel et un mode Hor+ pour les écrans larges). Ne pas encore modifier le moteur ; préparer les caractéristiques précises des deux modes et leurs conséquences sur le rendu (§11).
3. **HUD** : étudier les deux propositions (informations importantes dans une zone 16:9 ; échelle unique), avec une comparaison visuelle, sans modifier l'interface officielle. Garder la possibilité de personnaliser le HUD progressivement (§12).
4. **Banc d'analyse** : ses scripts peuvent rester dans un dossier dédié de ce worktree, après vérification de leur contenu et de leur absence d'effets sur les autres sessions. Ne modifier ni `build.py`, ni les fichiers construits, ni les systèmes de jeu pour les enregistrer. Pas de commit sans son accord (§10).
5. **Boss de Bunker 7** : prévoir l'intégration d'une jauge de vie au futur HUD, mais attendre les caractéristiques du boss avant toute mise en œuvre (§13).
6. **Mod Tools et autres worktrees** : ne pas toucher aux modifications des autres sessions, notamment celle de Khamsin ; ne supprimer aucun ancien worktree. Les conflits seront traités par la cinquième session à l'intégration.
7. **Suite** : continuer sur les interfaces du jeu, le HUD, les menus et les Mod Tools, en préservant l'architecture actuelle, une demande précise d'Anthony par nouvelle fonctionnalité, seulement dans `~/dev/zs-interface` sur `chantier/interface`. Aucune fusion, aucun changement de version, aucune publication pour l'instant.

## 2. Vérification de départ (31 octobre 2026)

| Étape | Résultat |
|---|---|
| `python3 engine/tools/build.py --out <dossier temporaire de la session>/zs.html` | identique octet pour octet à `game/zombie-survival.html` : 7 485 058 octets, 55 150 lignes, 55 modules, en 1,2 s (79 Mo de mémoire) |
| SHA-256 | `2baa0f1a42027f382d5786b5cccc17de02983f1bdfc8ffbd09a22a2777e9eb56`, le jeu de la suite E2 du 20 octobre 2026 (1 018 vérifications sur 1 018) |
| `python3 engine/tools/dupcheck.py` | aucun doublon |
| Avant `npm ci` | 2,5 Go de mémoire disponible (machine chargée par d'autres sessions). Un seul paquet a un script d'installation : `electron-winstaller` 5.4.0 (dépendance de développement ; il choisit le 7-Zip de l'installateur Squirrel, or le projet fait un installateur NSIS). Electron 44 n'en a plus. Aucun `.npmrc` dans le projet. |
| `npm ci --prefer-offline --no-audit --no-fund` dans `launcher/` | 289 paquets en 9 s, 324 Mo de mémoire au plus ; `package-lock.json` et `package.json` inchangés ; le script d'`electron-winstaller` n'a pas été lancé (npm 11.19 : liste `allow-scripts` vide). Écritures : `launcher/node_modules/` (ignoré par Git) et le cache npm commun `~/.npm`. |
| `node scripts/prepare-game.js` | jeu 2.0.6 préparé dans `launcher/game/` (15 fichiers, ignoré par Git), sans réseau |
| `npm test` | 31 tests : l'échec intermittent connu (`workspace.test.js:31`, « 4 !== 5 », `CLAUDE.md` §5) une fois, puis 31 sur 31 à deux passages |
| Autres worktrees | relevé sans verrou (`GIT_OPTIONAL_LOCKS=0`) avant et après les opérations : identiques, sauf le travail propre d'une autre session pendant ce temps |
| `git status` du worktree | aucun fichier suivi modifié ; fichiers ignorés : `launcher/node_modules/` et `launcher/game/` |

Remarques :

- **Version en ligne pour les joueurs** (manifeste public relu le 31 octobre) : jeu 2.0.6, launcher 1.3.3, publiés le 20 octobre 2026 à 19 h 22.
- **Machine chargée pendant tout l'audit** (charge de 22 à 28 pour 16 fils, de 2,3 à 3,1 Go de mémoire disponible, mémoire d'échange utilisée) : aucun rendu 3D du jeu n'a été lancé (§6.1).
- **Dossier temporaire** : ce chantier écrit dans celui de sa propre session, jamais dans le dossier temporaire commun.

## 3. Protections et autorisations trop larges

Relevé du 31 octobre 2026 ; rien n'est changé (décision 5).

Ce qui protège ce worktree :
- le bac à sable (sockets Unix refusés, aucune commande hors du bac à sable) ;
- le refus de l'envoi vers GitHub (règle, et adresse d'envoi désactivée) ;
- l'accord d'Anthony demandé pour tout commit ;
- la garde Git, dont les crochets sont réglés dans la configuration commune du dépôt : elle s'applique à tous les worktrees.

Le relevé des autorisations plus larges que « chaque session ne modifie que son worktree » est gardé hors du dépôt, comme le détail des protections locales (`CLAUDE.md` §7) ; l'étude est confiée à la cinquième session. Quelle que soit l'amélioration, chaque session doit garder le droit d'écrire dans son worktree, dans le `.git` commun (commits), dans son dossier temporaire et dans le cache npm.

## 4. Autres chantiers et risques de conflit

Relevé du 31 octobre 2026, en lecture seule ; le détail (worktrees, branches, état de chacun) est gardé hors du dépôt. Tous les chantiers partent de `3667acd` et avancent : refaire le relevé avant toute intégration.

| Chantier | Croisement avec l'interface |
|---|---|
| Animations des armes (2.0.7) | faible ; même version |
| Boss de Bunker 7 (2.0.7) | jauge de vie du boss : coordination (décision 7) |
| Intégration 2.0.7 | reçoit les chantiers sur ordre d'Anthony |
| Khamsin, cartes (2.0.8) | **Mod Tools** : `ow-core.js`, `ow-tools.js`, `ow-ui.js` (décision 3) ; `launcher/package.json` |

**Fichiers communs**, avec des conflits attendus à chaque fusion :
- `game/zombie-survival.html`, qui se reconstruit et ne se fusionne jamais à la main ;
- `engine/tools/build.py`, où chaque chantier ajoute ses points d'accroche ;
- `README.md` et `CLAUDE.md` ;
- la liste `test:e2e` de `launcher/package.json` (le chantier des cartes y a déjà ajouté `etages.e2e.js`) ;
- `GAME_VERSION`, `GAME_BUILD` et `EDITOR_API`.

**Pour limiter les conflits**, une modification du HUD ou des menus passerait par :
- un module propre, `engine/src/I0-interface.js`, inséré entre les modules `H` et `L` ;
- un fichier d'accroches propre, `engine/tools/hooks-interface.py`.

Seule la ligne qui appelle ce fichier dans `build.py` serait commune. `hooks.py`, qui porte les styles du HUD du monde ouvert et les consignes du menu, resterait intact.

## 5. Inventaire des interfaces

### 5.1 Jeu : où vit le code

| Partie | Où | Comment la modifier |
|---|---|---|
| Styles et balisage du HUD, des écrans et des menus | tête du jeu 1.9.0 : le style, puis `#hud`, `#menu`, `#pause`, `#options`, `#gameover`, `#mapsel`, `#stats`, `#models`, `#ranking`, `#mods` | accroche (`rep`) dans un `hooks-*.py` |
| Logique du HUD | `HUD` (section 11 : `round`, `perks`, `weapon`, `pointsChanged`, `banner`, `hint`, `zone`, `prompt`, `hitmarker`, `setDowned`, `update`), `tallySVG` | accroche |
| Écrans et navigation | `showScreen`, `onGlobalKey`, `bindUI`, `refreshMenu`, `pauseGame`, `resumeGame`, `quitToMenu`, `gameOver` (section 11) | accroche |
| Options | `SETTINGS_DEFAULT`, `settings`, `saveSettings` (section 00, `localStorage` `zs.settings`) ; liaison dans `bindUI` | accroche |
| HUD du monde ouvert | `owHud`, `owUpdateHud` (`engine/src/60-map.js`) ; styles `.ow-*` ajoutés par `hooks.py` | module |
| Oxygène de la Lune | `luO2Hud`, `luO2HudUpdate` (`engine/src/L6-lune-vie.js`, feuille de style injectée) | module |
| Quêtes | `lu-quest` (`L9-lune-quete.js`) ; `kh-quest` (`E0-quest.js`, éteinte depuis la 2.0.6) | module |
| Jauge du Gardien | `khBossBar` (`D0-gardien.js`, styles en ligne, éteinte depuis la 2.0.6) | module |
| Points d'Anthony | `engine/src/H5-points.js` et son paquet `engine/orig/hud-points/`, inséré tel quel, empreinte contrôlée par `build.py` | branchement seulement ; le paquet ne se retouche pas |

### 5.2 HUD par zone

| Zone | Éléments |
|---|---|
| Bas à gauche (`#bl`) | portrait et points d'Anthony ; jauge d'oxygène (Lune) ; atouts (pastilles) ; manche (bâtons jusqu'à 5, puis chiffre ; ambre en manche de chiens) |
| Bas à droite (`#br`) | arme, munitions (rouges sous 25 %), mod de munition du Glas, grenades. Au volant : nom, rapport, vitesse, carburant (`.ow-drive`). L'ancien affichage des points y reste, masqué. |
| Centre | réticule (écart selon la dispersion), marqueur de touche, invite (touche F, coût), rappel (« Rechargez [R] »), bannière (manche, bonus, atout), digi pass, « À terre » |
| Haut | lieu (à gauche), boussole et tempête (au centre), mini-carte (à droite), montée de niveau (au centre, au-dessus des menus) |
| Bas, au centre | bonus actifs (Mort instantanée, Double points, avec leur temps) |
| Plein écran | vignette, voile rouge des dégâts, éclair, visière (Lune) |

**Santé** : aucune barre ni aucun chiffre. Seul le voile rouge `#dmg` monte avec les points de vie perdus (`HUD.update`).

### 5.3 Menus et navigation

- **Menu principal** :
  - boutons Jouer, Reprendre (sauvegarde), Statistiques, Modèles, Ranking, Amélioration d'arme, Options, Commandes (écrans étroits) et Quitter (dans le launcher) ;
  - dossier « Ordres » : touches, et consignes adaptées à la carte.
- **Écrans** : choix de la carte, statistiques, modèles (aperçu 3D), ranking (prestiges, niveaux), amélioration d'arme, options, pause, fin de partie, chargement, absence de WebGL.
- **Clavier** :
  - Échap revient au menu depuis les sous-écrans ;
  - les flèches parcourent les onglets et la grille des cartes ; Entrée lance la carte choisie ;
  - le premier bouton reçoit le focus.
- **Manette** : aucune.
- **Mouvements réduits** : `prefers-reduced-motion` coupe les animations CSS.

### 5.4 Options (7)

- Sensibilité de la souris.
- Champ de vision (horizontal, de 70 à 115°).
- Volume général ; musique et jingles.
- Qualité graphique, qui règle la résolution de rendu : basse 0,7 ; moyenne, densité de l'écran, 1,25 au plus ; haute, 2 au plus.
- Voix d'annonce des bonus.
- Axe vertical inversé.

Il n'y a rien pour le HUD, les touches ou le confort de la vue. La piste « mouvements de caméra réduits » est notée dans `docs/transmission.md` §5.

### 5.5 Mod Tools

- **Fichiers** : 16 dans `launcher/src/modtools/`. `launcher/src/preload/modtools.js` les ajoute à la page du jeu (servie par `zsgame://editor/`) ; le jeu ne les contient pas.
- **Mise en page** :
  - grille `52 px | vues | 344 px` : barre d'outils, plan et 3D, panneaux ;
  - barre du haut de 46 px, barre d'état de 26 px ;
  - police de base de 15 px ; deux paliers, à 1 560 et 1 380 px ;
  - fenêtre de 1 600 × 940 (1 180 × 700 au moins), agrandie à l'ouverture.
- **Livraison** : ils sont livrés avec le launcher (1.3.3). Une retouche demande donc un nouveau launcher et son installateur (wine est absent de WSL, `CLAUDE.md` §6), et doit respecter `ZS.editorApi`.
- **Modules communs avec le chantier des cartes** : `ow-core.js`, `ow-tools.js` et `ow-ui.js`, qu'il modifie ; par prudence, tous les `ow-*.js` (décision 3).

### 5.6 Launcher

- Fenêtre du launcher : fixe, 1 080 × 660, sans cadre.
- Outil de publication : 940 × 780.
- Jeu : en plein écran par défaut (réglage `fullscreen`), sinon fenêtre agrandie (1 280 × 720, 960 × 540 au moins).

### 5.7 Essais qui dépendent de l'interface

- **Identifiants du DOM** : les essais de bout en bout s'appuient sur eux, qui ne se renomment donc pas :
  - `btn-quit` (9 essais) et les classes `mt-` des Mod Tools (9) ;
  - `ms-grid`, `btn-play`, `btn-ms-play` et `gameover` (4) ;
  - `points` (3) ;
  - `round`, `perks`, `prompt` et `banner` (2)…
- **Positions** : `hud-points` contrôle des positions relatives (portrait aligné à gauche sur le bloc des manches, au moins 10 px au-dessus de lui, de 52 à 120 px). Les propositions du §6.2 les respectent.

## 6. 16:9 et 21:9 (écran d'Anthony : 3440 × 1440)

### 6.1 Champ de vision

**Ce que fait le code** (confiance élevée) :

- **Caméra du jeu** : le réglage est un champ **horizontal** (90° par défaut), converti en champ vertical selon les proportions de la fenêtre dans `updatePlayer` (« champ de vision horizontal → vertical, avec zoom de visée »). La caméra TPS fait le même calcul (`persoTpsCam`, `engine/src/H1-personnage.js`).
- **Bras et armes** (`vmCamera`) : champ **vertical** fixe de 52°. Bras du couteau et du khépesh : 72° vertical fixe.
- **Caméra du menu** : 60° vertical au démarrage. Après une partie, elle garde la dernière valeur du jeu, car rien ne la remet : la vue du menu change entre avant et après la première partie (détail).

Conséquence en 21:9 : à réglage égal, le champ horizontal est le même qu'en 16:9 et le champ vertical se réduit. Le grossissement vaut 3440/1440 ÷ 16/9 = ×1,34, quel que soit le réglage :

| Réglage | Vertical en 16:9 | Vertical en 21:9 aujourd'hui | Grossissement en 21:9 | Horizontal en 21:9 avec Hor+ |
|---|---|---|---|---|
| 70° | 43,0° | 32,7° | ×1,34 | 86,5° |
| 80° | 50,5° | 38,7° | ×1,34 | 96,9° |
| 90° | 58,7° | 45,4° | ×1,34 | 106,7° |
| 100° | 67,7° | 53,0° | ×1,34 | 116,0° |
| 115° | 82,9° | 66,6° | ×1,34 | 129,3° |

En 2560 × 1080, le grossissement est de ×1,33.

**Proposition A, champ « Hor+ »** : le réglage décrit le champ horizontal d'un écran 16:9. En 21:9, le champ vertical reste celui du 16:9 et les côtés s'élargissent. Conséquences visuelles (schéma `schema-fov.png`, §10) :

- **Tailles** : le décor, les zombies et l'arme ont les mêmes tailles qu'en 16:9. Aujourd'hui, en 21:9, le décor est grossi ×1,34 et l'arme ne l'est pas : elle paraît plus petite par rapport au décor.
- **Champ** : 106,7° de large au réglage 90 (au lieu de 90°), et le haut et le bas sont rendus (sol proche, plafond).
- **Bords** : plus étirés par la perspective. Au réglage 115, l'image fait 129° de large et l'étirement est fort ; borner le réglage en 21:9 ou le laisser libre reste à décider.
- **Coût** : plus de décor à dessiner sur les côtés (cône de vue 1,34 fois plus large), à mesurer sur une vraie carte graphique.
- **Jeu** : les joueurs en 21:9 voient plus sur les côtés, ce qui est un avantage ; c'est la pratique courante des jeux récents (confiance moyenne).
- **Vertige** : un champ plus large réduit en général l'effet de « tunnel », mais l'étirement des bords peut gêner ; à essayer sur son écran (confiance faible).

**Proposition B** : une option « Champ de vision : référence 16:9 (Hor+) ou écran (actuel) », pour garder le choix. Retenue par Anthony le 31 octobre au soir : caractéristiques des deux modes au §11.

Ni A ni B ne change de règle du jeu (dégâts, portées, visée) : seule la caméra de rendu change.

**Captures 3D réelles : pas encore faites**, la machine étant chargée (décision 1). La méthode est prête (banc 3D, §10) : trois images de la même vue de Bunker 7 :
- en 2560 × 1440 (16:9) ;
- en 3440 × 1440, avec le champ actuel ;
- en 3440 × 1440, avec le champ Hor+ simulé par le seul réglage (106,7 donne en 21:9 le champ vertical d'un réglage 90 en 16:9).

Coût estimé : chargement du jeu en rendu logiciel, plusieurs minutes et environ 1,5 Go (confiance moyenne).

### 6.2 HUD

Mesures du banc de la couche HUD (§10 ; vrais styles, vrai module des points, valeurs d'exemple) :

| Élément | 1920 × 1080 | 2560 × 1440 | 3440 × 1440 aujourd'hui | 3440 × 1440, proposition 1 |
|---|---|---|---|---|
| Portrait des points (côté) | 69 px | 92 px | 92 px | 92 px |
| Bloc de la manche (hauteur) | 92 px | 92 px | 92 px | 92 px |
| Munitions (hauteur) | 46 px | 46 px | 46 px | 46 px |
| Distance du centre aux éléments du bas à gauche | 912–1 024 px (84–95 % de la hauteur) | 1 245–1 391 px (86–97 %) | 1 657–1 791 px (115–124 %) | 1 245–1 391 px (86–97 %) |
| Distance du centre aux munitions | 1 006 px | 1 373 px | 1 771 px | 1 373 px |
| Mini-carte (côté ; distance du centre) | 220 px ; 926 px | 220 px ; 1 293 px | 220 px ; 1 695 px | 220 px ; 1 293 px |
| Boussole (largeur) | 520 px | 520 px | 520 px | 520 px |

Constats :

1. **Coins** : en 3440 × 1440, le regard parcourt environ 30 % de plus qu'en 16:9 (rapporté à la hauteur de l'écran) pour lire les points, la manche ou les munitions.
2. **Deux échelles** : le module des points suit la hauteur de l'écran (6,4 % de la hauteur, de 52 à 120 px) ; le reste a des tailles fixes. En 1080p, le portrait fait 75 % de la hauteur du bloc de la manche ; en 1440p, 100 %. La mini-carte (220 px au plus) et la boussole (520 px) ne grandissent pas non plus.

**Proposition 1, HUD dans la zone 16:9** :
- Sur un écran plus large que 16:9, les éléments ancrés aux côtés (bas à gauche, bas à droite, lieu, mini-carte, conduite) se placent dans la zone 16:9 centrée, soit 440 px de marge de chaque côté en 3440 × 1440.
- Mesuré : en 3440 × 1440, ils tombent exactement là où ils sont en 2560 × 1440, et les côtés restent libres pour la vue.
- Sans effet en 16:9. Elle peut devenir une option (« HUD : plein écran / zone 16:9 »).

**Proposition 2, échelle unique** :
- Les éléments à taille fixe suivent la hauteur de l'écran, avec la règle du module des points : hauteur ÷ 1080, bornée entre 0,75 et 1,5.
- En 1440p : manche 123 px, munitions 62 px, atouts 45 px, soit les proportions du 1080p. Le module d'Anthony ne change pas.
- Une option « Taille du HUD » (par exemple de 80 à 130 %) multiplierait ce facteur.
- À décider : la mini-carte, la boussole, l'invite et les bannières suivent-elles aussi ?

**Proposition 3** : 1 et 2 ensemble (capture `p12-khamsin-3440x1440.png` du banc).

Anthony les étudie toutes deux (31 octobre au soir) : comparaison visuelle, mesures et personnalisation progressive au §12.

**Mise en œuvre envisagée** (après accord) :
- deux variables CSS posées par le module de l'interface (marge de la zone 16:9, facteur d'échelle), reprises par les règles des éléments ancrés ;
- des accroches dans `hooks-interface.py` pour les styles du jeu 1.9.0 ;
- une accroche pour chaque élément créé par un module avec des styles en ligne ou injectés (oxygène, quêtes, jauge du Gardien) ;
- essais : `hud-points` (positions relatives, respectées) et un nouvel essai de l'interface.

### 6.3 Menus

Le contenu est centré sur 1 180 px au plus (menu, feuillets, cartes de 250 à 300 px). En 3440 × 1440, il reste environ 1 130 px vides de chaque côté, et le dégradé sombre du menu, calculé sur toute la largeur, ne suit pas le texte. Constat fait sur le code, pas encore vu sur une capture (confiance moyenne).

## 7. Constats de structure

- **Les styles des interfaces vivent à cinq endroits** :
  - la tête du jeu 1.9.0 ;
  - les accroches (`hooks.py` surtout) ;
  - des styles en ligne (jauge du Gardien) ;
  - des feuilles injectées par les modules (oxygène) ;
  - le paquet des points, qui a sa propre feuille.

  Aucune variable commune ne place ni ne dimensionne un élément de module : chaque nouvel élément (jauge de boss, quête, oxygène) choisit seul sa place.
- **La santé** ne s'affiche que par le voile rouge ; une barre de vie serait un choix de conception (jeu et boss).
- **L'ancien affichage des points** reste, masqué : il sert de repli si le module manquait.
- **Les identifiants du DOM** sont des contrats des essais (§5.7).

## 8. Écarts dans les documents (non corrigés)

1. `CLAUDE.md` §1 dit « en ligne : `v2.0.4` ». En réalité, le jeu 2.0.6 et le launcher 1.3.3 sont en ligne depuis le 20 octobre 2026.
2. `CLAUDE.md` §1 dit plusieurs systèmes du 2.0.6 « non commités ». Tout est dans `3667acd`, aussi sur `main`.
3. `CLAUDE.md` §2 et §4 disent que l'atelier `~/dev/zs-verif` travaille sur `dev`. Il est sur `chantier/anim-2.0.7`, et l'organisation en worktrees (cinq chantiers) n'est décrite nulle part.
4. Taille du jeu : `CLAUDE.md` donne « 51 800 lignes » au §2 et « 47 200 lignes » au §8 ; il en fait 55 150 (7 485 058 octets).
5. La section « Launcher » du README dit `npm install`, alors que `CLAUDE.md` impose `npm ci`.

## 9. Propositions et décisions en attente

Rien n'est commencé dans le jeu.

Priorité actuelle (Anthony, 31 octobre au soir, §14) : la refonte du launcher. Le HUD, le champ de vision et la jauge du boss sont en attente, leurs analyses gardées.

0. **Launcher** (§14) : examen et validation de la maquette hybride D (A+B) par Anthony, puis améliorations, avant toute intégration au vrai launcher.
1. **Champ de vision** (§11.4 et §11.3) : mode par défaut, noms de l'option, plafond éventuel, règle du Minuit du Glas, passage instantané au changement ; puis son accord pour la mise en œuvre (§11.5).
2. **HUD** (§12), après la comparaison : zone (proposition 1), échelle (proposition 2) et sa borne basse (720p), éléments placés seuls (mini-carte, boussole, invite, bannière, bonus), mise à l'échelle de Windows de son écran ; puis son accord pour l'étape 1 de la personnalisation (§12.4).
3. **Captures 3D** du champ de vision (§11.6), quand la machine sera libre.
4. **Jauge du boss** (§13) : caractéristiques du boss attendues ; une entrée commune du HUD à proposer à la session Bunker 7, par Anthony.
5. Options rangées en sections (vidéo, son, commandes, interface, confort), avec la piste « mouvements de caméra réduits » (elle touche `FX.shake` : son accord est nécessaire).
6. Ergonomie des Mod Tools : propositions seulement pour les `ow-*.js` (décision 3) ; interfaces indépendantes après son accord.
7. Commit de cet audit, du banc (§10) et des maquettes du launcher (§14) : avec son accord.

## 10. Banc de l'interface (`engine/tools/banc-interface/`)

Rangé dans ce worktree le 31 octobre 2026 au soir (décision 4 du soir) ; commité avec le chantier le 2 novembre. Mode d'emploi, sorties et effets vérifiés : son `README.md`. `build.py` ne le lit pas : il appelle ses accroches par leur nom et ne parcourt que `engine/src/*.js`, en plus des paquets d'Anthony de `engine/orig/`.

- **Fichiers** :
  - `fabrique.py` écrit les pages du banc dans un dossier donné, hors du dépôt ;
  - `banc.js` remplit la couche HUD, applique les variantes et mesure ;
  - `comparaison.js` porte les commandes de la page interactive ;
  - `capture.js` fait les captures en 2D (19 à 22 s, machine chargée) ;
  - `vue3d.js` est le banc 3D, avec sa garde de charge ; pas lancé.
- **Changements depuis la version du dossier temporaire** :
  - chemins relatifs à l'emplacement des scripts ;
  - dossier de sortie obligatoire, et refusé s'il est dans le dépôt ;
  - polices et scripts inclus dans les pages ;
  - variantes exprimées comme des réglages ;
  - page interactive ;
  - garde de charge du banc 3D.
- **Vérifications du 31 octobre** :
  - deux passages complets, sans erreur de page ;
  - aucun profil temporaire de Chromium laissé derrière ;
  - rien d'écrit dans le dépôt en dehors de ce dossier (`git status`).
- **Non repris** : le relevé des worktrees, propre à cette machine (chemins des autres sessions). Il reste dans le dossier temporaire de la session.
- **Sorties** : dans le dossier temporaire de la session, effacé à l'arrêt de WSL. Elles se refont en 20 s.
- **Limite** : la couche HUD est rendue sans la scène 3D ni ce que le jeu dessine dans ses canevas ; la mini-carte et la boussole y sont des repères de même taille et de même place.

## 11. Champ de vision : les deux modes (proposition B)

Caractéristiques préparées le 31 octobre 2026 au soir (décision 2 du soir). Rien n'est modifié dans le moteur. Repères dans le code : `updatePlayer` (« champ de vision horizontal → vertical, avec zoom de visée »), `persoTpsCam`.

### 11.1 Définition

Un seul réglage, de 70 à 115° (90 par défaut), et un choix de mode. R est le réglage, p la largeur de la fenêtre divisée par sa hauteur.

| | Mode actuel (horizontal fixe) | Mode Hor+ |
|---|---|---|
| Sens du réglage | champ horizontal de l'écran, quel qu'il soit | champ horizontal d'un écran 16:9 |
| Champ vertical | `2·atan(tan(R/2) / p)` | `2·atan(tan(R/2) / min(p, 16/9))` |
| Écran 16:9 ou plus étroit (16:10, 4:3) | référence | identique au mode actuel |
| Écran plus large (21:9, 32:9) | champ vertical réduit, image grossie de p ÷ 16/9 | champ vertical du 16:9, côtés élargis |

**Visée et sprint.** Ensuite, le zoom de visée (`WEAPONS[…].zoom`) et le sprint (×1,06) s'appliquent à `tan(vertical/2)`, comme aujourd'hui. Leur effet relatif est donc le même dans les deux modes.

Champ horizontal × vertical (table complète, du 4:3 au 32:9 : `fov.md`, faite par `fabrique.py`) :

| Écran | Réglage | Mode actuel | Mode Hor+ | Tailles à l'écran, Hor+ ÷ actuel | Facteur des bords, actuel → Hor+ |
|---|---|---|---|---|---|
| 16:9, toutes tailles | 90 | 90,0° × 58,7° | 90,0° × 58,7° | ×1,00 | 1,41 → 1,41 |
| 2560 × 1080 | 90 | 90,0° × 45,7° | 106,3° × 58,7° | ×0,75 | 1,41 → 1,67 |
| 3440 × 1440 | 70 | 70,0° × 32,7° | 86,5° × 43,0° | ×0,74 | 1,22 → 1,37 |
| 3440 × 1440 | 90 | 90,0° × 45,4° | 106,7° × 58,7° | ×0,74 | 1,41 → 1,68 |
| 3440 × 1440 | 115 | 115,0° × 66,6° | 129,3° × 82,9° | ×0,74 | 1,86 → 2,33 |
| 5120 × 1440 (32:9) | 90 | 90,0° × 31,4° | 126,9° × 58,7° | ×0,50 | 1,41 → 2,24 |
| 5120 × 1440 (32:9) | 115 | 115,0° × 47,6° | 144,7° × 82,9° | ×0,50 | 1,86 → 3,29 |

**Facteur des bords** : f = 1 / cos(demi-champ horizontal), en perspective exacte. Au bord gauche ou droit de l'image, à distance égale, un objet paraît f fois plus haut et f² fois plus large qu'au centre ; le brouillard et la limite d'affichage y portent f fois plus loin (§11.2, point 5).

### 11.2 Conséquences sur le rendu

Seulement sur un écran plus large que 16:9, en mode Hor+. Confiance élevée (code et géométrie), sauf mention contraire.

1. **Tailles.** Le décor, les zombies et les effets gardent les tailles d'un écran 16:9 de même hauteur. Le mode actuel les grossit : ×1,34 en 3440 × 1440, ×2 en 32:9.
2. **Champ.** Au réglage 90, la vue passe de 90,0° × 45,4° à 106,7° × 58,7°. Le plan de l'image est 1,8 fois plus grand, sol proche et plafond compris.
3. **Bras et arme** : inchangés dans les deux modes (`vmCamera` à 52° vertical ; vue du couteau et du khépesh à 72°). Le rapport entre l'arme et le décor redevient celui du 16:9 : le mode actuel grossit le décor, pas l'arme.
4. **Bords.** Ils sont plus étirés : facteur 1,68 au réglage 90 (1,41 en 16:9), 2,33 au réglage 115, de 2,24 à 3,29 en 32:9.
5. **Brouillard et limite d'affichage.** three r128 compte la profondeur le long de l'axe de la caméra : `fogDepth = -mvPosition.z`, et le plan lointain est plat.
   - Au bord de l'image, on voit donc f fois plus loin qu'au centre : ×1,68 en 21:9 Hor+ au réglage 90, contre ×1,41 en 16:9.
   - Cet effet existe déjà. Hor+ l'accentue sur les côtés : les tempêtes de Khamsin (`scene.fog`, `khFar`) et le brouillard des cartes en grille y paraissent un peu moins denses.
   - Un brouillard compté en distance le supprimerait. Il changerait l'aspect de toutes les cartes : il n'est pas proposé ici.
6. **Particules.** La taille des points de three r128 (`PointsMaterial`) ne dépend pas du champ de vision. Sont concernés le sang, les étincelles, la terre, la bave et les yeux des chiens, le sable de Khamsin et la poussière de la Lune.
   - Dans le mode actuel en 21:9, ces particules paraissent 26 % plus petites par rapport au décor qu'en 16:9 ; Hor+ rétablit les proportions du 16:9.
   - Les particules du couteau, du khépesh et de la glissade compensent déjà le champ (`uEchelle`, `uScale`).
7. **Ombres du monde ouvert** (`owShadows`) : un carré de ±55 m (qualité moyenne) ou ±80 m (haute) qui suit la caméra.
   - Au-delà de ce carré, il n'y a d'ombre dans aucun des deux modes. Hor+ montre davantage les côtés, donc davantage cette limite.
   - Les cartes en grille n'ont pas de carte d'ombres.
8. **Coût.** Le nombre de pixels ne change pas. L'angle horizontal du cône de vue augmente de 19 % au réglage 90 (de 12 % au réglage 115) en 21:9. three.js écarte seulement ce qui sort du cône, rien derrière les murs : jusqu'à environ 19 % d'objets dessinés en plus (estimation, confiance moyenne), à mesurer sur une vraie carte graphique.
9. **Vue TPS.** `persoTpsCam` refait le même calcul et doit appeler la même fonction. Son réticule suit, puisqu'il est projeté par la caméra TPS.
10. **Au volant.** `updatePlayer` s'arrête avant le calcul du champ (`owDriveStep`). La caméra garde donc le champ d'avant la montée, ce qui est déjà vrai aujourd'hui ; un redimensionnement au volant ne le recalcule pas non plus. La mise en œuvre l'appliquerait aussi au volant.
11. **Menu.** Sa caméra garde le champ de la dernière partie (§6.1) : sans lien avec le mode.
12. **Mod Tools.**
    - Leurs vues 3D ont leurs propres caméras : aucun effet.
    - Le bouton Test lance le jeu dans l'origine `zsgame://editor/`, dont les réglages (`localStorage`) sont séparés de ceux du jeu. Le mode s'y choisirait donc à part, comme toutes les options aujourd'hui.
13. **Essais existants** : aucun ne contrôle une valeur du champ qui dépendrait du mode (confiance élevée).
    - `knife`, `khepesh` et `personnage` contrôlent des écarts du champ.
    - Le douzième coup de `glas` place ses zombies devant, derrière, et derrière un mur : même résultat dans les deux modes.
    - La fenêtre du jeu s'ouvre en plein écran par défaut. Sur l'écran 21:9 d'Anthony, les essais tournent donc probablement en 21:9 (confiance moyenne).

### 11.3 Ce qui touche au jeu (à décider par Anthony)

- **Minuit du Glas** (`glasMidnightStrike`, « les zombies à l'écran s'effondrent »).
  - Il tue les zombies qui sont dans le cône de la caméra du jeu (`THREE.Frustum`) et en vue directe (`sightClear`).
  - En Hor+ sur 21:9, ce cône couvre un angle horizontal plus large : de 19 % au réglage 90, de 12 % au réglage 115 ; en 32:9, de 41 % au réglage 90. Le Minuit peut donc tuer plus de zombies.
  - La règle dépend déjà du réglage (de 70 à 115°) et de la visée, dont le zoom rétrécit le cône.
  - Deux choix :
    - la garder telle quelle : « à l'écran » veut dire ce que le joueur voit ;
    - la caler sur le cône du 16:9, pour que la forme de l'écran ne change rien.
  - Recommandation : la garder (confiance moyenne : c'est un choix de conception).
- **Apparitions** : elles ne dépendent pas du champ de vision, mais d'angles fixes autour de la direction du regard.
  - Monde ouvert : au moins 83° du regard quand elles sont tirées « derrière » le joueur. Lune : au moins 88°. Pyramides : « en vue » sous 69,5°.
  - Le demi-champ Hor+ reste en deçà, avec une exception : en 32:9, au-delà du réglage 107, une apparition des pyramides classée « hors de vue » peut sortir au bord de l'image.
- **Tirs, portées, IA, dégâts** : aucun effet. Le tir part du centre de la caméra.

### 11.4 L'option dans le menu (proposition)

- **Place** : sous « Champ de vision », une liste « Vue sur écran large », avec « Recadrée (actuelle) » et « Élargie (Hor+) ». Les noms sont à choisir par Anthony.
- **Champ réel** : à côté du réglage, en mode Hor+ sur un écran large, le champ effectif, par exemple « 90° (106,7° sur cet écran) ».
- **Enregistrement** : `settings.fovMode`, `'horizontal'` ou `'horplus'`. Une ancienne sauvegarde sans cette clé prend la valeur par défaut, comme les autres options.
- **Passage instantané** au changement d'option. Aujourd'hui, le champ rejoint sa cible par un amortissement (`damp`, 14 par seconde), soit un glissement d'environ 0,2 s. Il est évité pour un changement de réglage, à cause du vertige.
- **Défaut** : à décider. Recommandation : Hor+ (confiance moyenne). Il ne change rien en 16:9, et c'est la pratique courante des jeux récents pour les écrans larges. Autre choix : « Recadrée » par défaut, pour que rien ne change sans action du joueur.
- **Plafond** : aucun proposé. Un plafond du champ horizontal réel (par exemple 130°) n'agirait qu'en 32:9, au-delà du réglage 94.

### 11.5 Mise en œuvre envisagée (après accord ; rien de fait)

- **Calcul** : une fonction `fovVertical(reglage, proportions)` dans le module de l'interface (`engine/src/I0-interface.js`).
- **`updatePlayer`** (jeu 1.9.0) : une accroche dans `hooks-interface.py` sur `const vf = 2 * Math.atan(Math.tan(hf / 2) / camera.aspect);`. Une deuxième accroche, dans la branche de la conduite ajoutée par `hooks.py`, éviterait de toucher à `70-vehicles.js`, que modifie le chantier des cartes.
- **`persoTpsCam`** (`engine/src/H1-personnage.js`) : une ligne. **Conflit possible** avec le chantier des animations s'il retouche ce module (rien de modifié chez lui au 31 octobre, 19 h 50) : à signaler à la cinquième session.
- **Option** : balisage et liaison ajoutés par le module, sans toucher au texte de `SETTINGS_DEFAULT` ni au formulaire des options, communs à tous les chantiers.
- **Essai** : un nouvel essai, ou un bloc de `game-menu`, qui contrôle le champ vertical en 3440 × 1440 dans les deux modes.
- **Versions** : `EDITOR_API` ne change pas, car l'interface `window.ZS` reste la même. `GAME_VERSION` et `GAME_BUILD` se fixent en coordination (décision 2).

### 11.6 Captures 3D

Reportées (décision 1 du soir). `vue3d.js` les fera quand la machine sera libre ; il refuse de partir avant (§10). Il capture trois vues de Bunker 7 : 2560 × 1440, 3440 × 1440 en mode actuel, et 3440 × 1440 en Hor+, simulé par le seul réglage (106,7 en 21:9 donne le champ vertical d'un réglage de 90 en 16:9).

## 12. HUD : comparaison des propositions 1 et 2

Préparée le 31 octobre 2026 au soir (décision 3 du soir). Rien n'est modifié dans l'interface du jeu.

### 12.1 Comparaison visuelle

- **`comparaison-hud.html`** : page interactive en un seul fichier, faite par le banc, sans serveur.
  - Elle montre les quatre propositions (touches 1 à 4) et des réglages séparés : zone (plein écran, 21:9, 16:9), échelle (mixte ou unique), taille de 80 à 130 %, échelle étendue aux éléments placés seuls.
  - On y choisit aussi la carte (Bunker 7 ou Khamsin) et l'écran : réel, ou simulé de 1280 × 720 à 5120 × 1440.
  - Options d'affichage : cadre 16:9, distances au centre, place réservée de la jauge du boss.
  - Ouverte en plein écran dans Chrome ou Edge, à 100 % de zoom, sur l'écran 3440 × 1440, elle montre le HUD à sa taille réelle, mise à l'échelle de Windows comprise.
- **`planche-hud.png`** : en 3440 × 1440, la référence 2560 × 1440, puis le HUD actuel, la proposition 1, la 2, les deux, et les deux avec la place réservée de la jauge du boss.
- **`planche-echelle.png`** : en 16:9, de 1280 × 720 à 3840 × 2160, l'échelle actuelle à côté de l'échelle unique.

### 12.2 Mesures (banc, valeurs d'exemple)

Hauteurs en pixels CSS. Pour la manche, les atouts et les munitions, échelle actuelle → échelle unique :

| Élément | 1280 × 720 | 1920 × 1080 | 2560 × 1440 | 3840 × 2160 |
|---|---|---|---|---|
| Portrait des points (identique dans les deux échelles) | 52 | 69 | 92 | 120 |
| Bloc de la manche | 92 → 69 | 92 → 92 | 92 → 123 | 92 → 160 |
| Atouts | 34 → 26 | 34 → 34 | 34 → 45 | 34 → 59 |
| Munitions | 46 → 35 | 46 → 46 | 46 → 62 | 46 → 80 |
| Facteur de l'échelle unique | 0,75 | 1 | 1,33 | 1,74 |

En 3440 × 1440, distances du centre aux points, à la manche, aux munitions et à la mini-carte, rapportées à la hauteur de l'écran :

| Variante | Points | Manche | Munitions | Mini-carte |
|---|---|---|---|---|
| Actuel | 115 % | 124 % | 123 % | 118 % |
| Proposition 1 | 86 % | 97 % | 95 % | 90 % |
| Proposition 2 | 114 % | 123 % | 122 % | 118 % |
| Propositions 1 et 2 | 85 % | 96 % | 94 % | 90 % |
| Référence 2560 × 1440, actuel | 86 % | 97 % | 95 % | 90 % |

Les conditions de l'essai `hud-points` restent vraies dans toutes les variantes : portrait aligné à gauche sur le bloc des manches, 12 px au-dessus, de 52 à 120 px.

### 12.3 Constats

1. **Proposition 1** : en 3440 × 1440, le HUD retrouve exactement les places du 2560 × 1440 (marge de 440 px de chaque côté). Elle est sans effet en 16:9 et sur les écrans plus étroits. Une zone 21:9 est une étape intermédiaire possible, utile en 32:9.
2. **Proposition 2** : elle est identique au HUD actuel en 1080p, par construction.
   - Facteur : ×1,33 en 1440p, ×1,74 en 4K à 100 %, où la manche passe de 92 à 160 px.
   - En 1280 × 720 (fenêtre du jeu hors plein écran), ×0,75 : la manche et l'arme rapetissent, comme le portrait, déjà à son minimum de 52 px.
   - Variante possible : une borne basse à 1, si Anthony préfère que rien ne rapetisse. En 720p, l'écart actuel demeure alors.
3. **Mise à l'échelle de Windows.** Les tailles se comptent en pixels CSS, et les captures supposent une mise à l'échelle de 100 %.
   - À 125 %, l'écran 3440 × 1440 donne 2752 × 1152 pixels CSS (facteur 1,07 au lieu de 1,33). À 150 %, 2293 × 960 (facteur 0,89).
   - La page interactive, en « écran réel », montre sa configuration exacte.
   - Question pour Anthony : quelle mise à l'échelle utilise-t-il ?
4. **Le module d'Anthony** suit déjà la règle de la proposition 2. Une taille réglable lui passerait par son option `size` de `PointsHud.create` (`--zs-s`), sans retoucher son fichier.
5. **Éléments placés seuls** (mini-carte, boussole, invite, bannière, bonus) : à décider. La page montre l'effet de leur mise à l'échelle avec la case « Échelle aussi pour… ».

### 12.4 Personnalisation progressive (architecture proposée ; rien de fait)

- **Étape 1 : deux variables.** Le module de l'interface pose deux variables CSS sur `#hud` : la marge de la zone et le facteur d'échelle, recalculées au redimensionnement (`onResize`).
  - Les règles des éléments ancrés aux côtés les reprennent (accroches dans `hooks-interface.py`).
  - Les deux propositions deviennent deux options : « Zone du HUD » (plein écran, 21:9, 16:9) et « Échelle du HUD » (mixte ou unique, puis une taille de 80 à 130 %).
- **Étape 2 : un emplacement par élément.** Chaque élément reçoit un coin d'ancrage, un décalage, une taille et une visibilité, rangés dans un objet `settings.hud` versionné. Les éléments des modules (oxygène, quêtes, jauge du boss, points) s'y inscrivent au lieu de choisir seuls leur place (§7).
- **Étape 3 : un écran de personnalisation**, avec l'aperçu du HUD, le déplacement à la souris et le retour aux valeurs par défaut.
- **Contraintes** :
  - identifiants du DOM conservés (essais, §5.7) ;
  - positions relatives de `hud-points` respectées ;
  - aucun élément créé avec des styles en ligne hors de ces variables ;
  - coût et essais de chaque étape chiffrés avant de la commencer.

## 13. Jauge du boss de Bunker 7 : place réservée

Décision 5 du soir : prévoir son intégration au futur HUD ; aucune mise en œuvre avant les caractéristiques du boss.

- **Place réservée : en haut, au centre.**
  - Précédent : la jauge du Gardien (`khBossBar`), à 64 px du haut, large de `min(560px, 70vw)`, avec le nom, la barre, des repères de phase à 33 et 66 % et une ligne d'état.
  - Dans le banc : à 24 px du haut sur les cartes en grille ; sous la boussole et le bandeau de la tempête dans le monde ouvert (96 px).
  - Elle suit l'échelle unique ; la zone 16:9 ne la déplace pas, puisqu'elle est centrée.
- **Ce que prépare la session Bunker 7** (son audit, lu sans rien modifier, état de 14 h 18) :
  - elle note que le boss aura besoin d'un affichage (« jauge de vie, par exemple ») ;
  - elle cite `khBossBar` parmi les fonctions du Gardien, seul boss du moteur ;
  - ses « étapes d'accès » pourraient demander des objectifs à l'écran, comme les quêtes de la Lune et de Khamsin.
- **Risque** : une jauge reprise de `khBossBar` dans son module, avec des styles en ligne, hors de la couche commune. Elle échapperait alors à la zone, à l'échelle et à la personnalisation.
- **Proposition de coordination**, à transmettre par Anthony quand il le jugera utile :
  - une entrée commune du HUD, par exemple `HUD.boss.montrer({ nom, pv, pvMax, phases, etat })` et `HUD.boss.cacher()`, fournie par l'interface ;
  - le module du boss l'appelle ;
  - le style vit dans la couche HUD.
- **Questions pour la session du boss** :
  - nom affiché ;
  - une barre ou des segments (phases, armure, bouclier) ;
  - chiffres visibles ;
  - plusieurs boss à la fois ;
  - état à montrer (phase, fenêtre de tir, point faible, minuterie) ;
  - vie partagée en coopération ;
  - conditions d'affichage (arène, étage) ;
  - couleurs ;
  - objectifs des étapes d'accès.
- **Rien n'est fait.**

## 14. Refonte du launcher : trois maquettes (31 octobre 2026, soir)

**Demande d'Anthony** : nouvelle priorité. Le launcher doit devenir une application professionnelle, moderne, immersive et visuellement impressionnante, une vraie refonte de l'expérience plutôt qu'un changement de couleurs.
- **Identité** : univers sombre et post-apocalyptique, ambiance militaire et cinématographique, rouge profond, noir et gris anthracite, éléments de l'univers du jeu.
- **Première étape** : trois maquettes interactives aux directions vraiment différentes, en HTML, CSS et JavaScript, ouvrables sous Windows, avec des captures.
- **Interdits** : rien dans le launcher officiel (fichiers, Electron, mises à jour, réglages) ; aucun autre worktree ; aucun rendu 3D lourd ; aucun commit, aucune fusion, aucune publication sans son accord.
- **Travaux précédents** : analyses du HUD et du mode Hor+ gardées. Champ de vision inchangé, à cause du Minuit du Glas (§11.3). Jauge du boss en attente de la coordination avec Bunker 7.

**Fait** : dossier `maquettes/launcher/`, indépendant du launcher. Mode d'emploi et inventaire de ce qui est simulé : son `README.md`.

- **Les trois directions** :
  - **A · Militaire cinématographique** : poste de commandement de Bunker 7 sur le vrai rendu du jeu. Dossiers, tampons, tôle, interrupteurs à levier ; progression en bande de cartouches.
  - **B · Launcher AAA moderne** : barre latérale, accueil en bandeau défilant, actualités filtrables, chronologie, gestionnaire de téléchargement avec courbe de débit.
  - **C · Nouvelle génération** : typographie du HUD (Teko), veines rouges génératives, bichromie, navigation numérotée ; cadran Jouer et bâtons de manche.
- **Socle commun** (`commun/maquette.js`) : les états du vrai launcher simulés, le panneau « Maquette » (scénarios, mode auteur, tailles de fenêtre, animations) et le cadre de la fenêtre sans bordure.
- **Données** : réelles quand elles existent (versions, tailles, source, empreinte de la clé, réglages, notes publiées). Le reste est marqué « Exemple » ou « simulée ».
- **Vérifié le 31 octobre** :
  - 24 captures en 2D et 4 planches en 18 s ;
  - `essai.js` : 75 vérifications sur 75 (scénarios cliqués dans les trois directions, aucune erreur de page).
- **Défaut trouvé par l'essai, corrigé** : sur un écran étroit, le panneau de la maquette couvrait le haut droit du launcher. Le launcher se décale désormais.
- **À l'intégration** : la politique de sécurité du launcher (`style-src 'self'`) interdit les styles en ligne des maquettes ; ils passeront par des classes ou par le CSSOM.

**Choix d'Anthony du 31 octobre au soir** : combiner A et B.
- B sert de base : architecture, navigation, présentation des mises à jour, actualités, paramètres, Mod Tools.
- A apporte son identité : militaire, cinématographique, éléments de Bunker 7, détails immersifs.
- C peut prêter quelques effets discrets, sans surcharger l'interface.
- La maquette est en 1 280 × 720, redimensionnable, avec une navigation complète, des animations discrètes et toutes les fonctions déjà représentées.
- A, B et C restent intactes. Le launcher officiel n'est pas modifié avant sa validation.

**Fait : maquette D · Hybride A+B** (`maquettes/launcher/D-hybride/`).
- **De B** : la barre latérale, les six pages, la chronologie des versions, les actualités filtrables, les statistiques d'installation, les Mod Tools et le gestionnaire de téléchargement.
- **De A** :
  - le rendu de Bunker 7, avec la lampe qui vacille et la poussière dans son faisceau ;
  - les typographies au pochoir et à la machine ;
  - les tampons, les plaques d'identité, les rayures de danger ;
  - le bouton Jouer « déploiement » ;
  - la bande de cartouches dans le gestionnaire ;
  - la lecture des actualités sur une feuille de dossier.
- **De C** : la bichromie rouge et noir des images d'actualités, et l'index oblique de la navigation.
- **Fenêtre redimensionnable** : poignée d'angle (de 960 × 600 à la page), bouton Agrandir et double-clic sur la barre du haut. La mise en page suit la taille de la fenêtre.
- **Socle commun** : la poignée n'est active que pour D. Le panneau gagne un lien vers D ; A, B et C ne changent pas autrement.

**Vérifié** :
- `essai.js` : 103 vérifications sur 103 (A, B et C 25 chacune, D 28) ;
- 34 captures (32 en 1 280 × 720, plus D en 1 600 × 900 et en 1 080 × 660) et 6 planches.

**Défauts trouvés et corrigés** :
1. Les captures A, B et C remises le 31 octobre vers 20 h 40 étaient réduites à 84 % (1 076 × 606 au lieu de 1 280 × 720). En mode capture, le panneau était masqué après le calcul de la taille de la fenêtre. Corrigé : toutes les captures sont désormais à l'échelle 1, contrôlées par leurs dimensions.
2. Fenêtre agrandie, le panneau de la maquette couvrait les boutons de fenêtre du launcher. Il passe désormais sous la barre de titre.

**D validée par Anthony** (31 octobre au soir). Il demande aussi :
- le plan d'intégration, rédigé dans `docs/plan-integration-launcher.md` ;
- un nouveau fond d'accueil : la carte « Marécages maudits », non publiée, animée (la bête qui dévore des Noyés, la pluie, l'orage).

Ses exigences :
- les vraies références de la carte ; dire ce qui n'existe pas sous forme exploitable avant de le recréer ;
- une séquence précalculée si elle donne un meilleur résultat ;
- un fond léger : image fixe de secours, animation qu'on peut couper, pause quand la fenêtre est masquée ou réduite ;
- aucun rendu Blender lourd pendant la session Animations ;
- le projet d'origine en lecture seule, aucun de ses scripts exécuté sans analyse et autorisation ;
- les ressources copiées seulement dans ce worktree, et documentées ;
- une prévisualisation avant de toucher au launcher officiel.

**Analyse, en lecture seule** :
1. **Marécages Maudits 2.1.7** (le premier dossier indiqué) : ni pluie ni orage. Les mots « orage », « tonnerre » et « foudre » de son jeu viennent du jeu de base 2.0.6, qui en compte exactement autant.
2. **Anthony corrige** : la pluie et l'orage sont dans le kit « Zombie Survival 2.0.7 - a publier (Stryges) », dans `ma17_pluie.js` et `ma18_orage.js`. Ses notes appellent les dossiers 2.1.x « versions de travail plus anciennes ».
3. **La Mère-Vase** (`mere-vase.js`) est réutilisable telle quelle : autonome, three.js r128 ; clip `devoration` synchronisé avec une victime.
4. **Le Noyé** dépend du moteur du jeu (squelette du Fantassin, `patches.py`) : il ne s'anime que dans le jeu complet du kit.
5. **Aucune capture ne montre une dévoration complète de Noyé.** La capture 13 du kit montre le moment où la bête se jette sur un Noyé.
6. **ffmpeg était absent de WSL** le 31 octobre. Anthony l'a installé le 2 novembre 2026 ; `scene-bete/encoder.js` passe par lui depuis, avec son accord (VP9 en deux passes, au lieu de l'enregistrement d'un canevas par le navigateur).

**Prévisualisation** (`D-hybride/marais.js`), sur cette capture :
- **Éléments réels** : capture, leurre, yeux des Noyés, brume de la carte.
- **Pluie et orage** : redessinés en 2D d'après les réglages du kit ; aucun script du kit exécuté.
- **Pour le confort** : 3 arcs par éclair au plus, un éclair toutes les 6 à 15 s, éclat plafonné.
- **Économie** : image fixe de secours, réglage « Fond d'écran animé », pause hors de l'accueil, fenêtre réduite ou masquée, pendant une partie.
- **Ressource copiée** : `maquettes/launcher/ressources/marecages/` (README ; image exclue de Git).

**En attente d'Anthony** :
1. La séquence précalculée de la dévoration : exécuter le jeu du kit, avoir un créneau de rendu, un encodeur.
2. Le tonnerre et le bruit de la pluie, avec le son du kit.
3. Le fond par défaut dans un launcher public.

**Signalé, sans rien faire** : le kit contient un message qui demande à Claude Code de publier une 2.0.7 (Marécages, Stryges) avec l'outil d'Anthony. Ce n'est pas la 2.0.7 préparée dans WSL. Cette session ne publie rien ; la publication reste l'action d'Anthony.

**Décisions d'Anthony du 31 octobre, tard dans la soirée** :
1. **Prévisualisation** : validée comme base de travail.
2. **La vraie scène** de la Mère-Vase qui dévore un Noyé est impérative et doit être fidèle aux modèles et animations du jeu. Préparer la procédure, les scripts et les conditions de capture ; aucun rendu lourd tant que la session Animations travaille.
3. **Pluie et éclairs** validés : une ambiance sombre et réaliste, sans excès de lumière, animations qu'on peut couper. Étudier les vrais sons du kit ; le launcher démarre en silence.
4. **Marécages maudits** devient l'identité visuelle future du launcher. Aucune image, vidéo ou ressource de cette carte sur GitHub sans son autorisation explicite.
5. **Le plan d'intégration** est validé dans son principe. Le launcher fonctionnel reste intact ; préparer une procédure qui garde toutes les fonctions.

**Fait** :
- **Procédure et scripts de la scène** : `maquettes/launcher/scene-bete/` (README, `preparer.sh`, `capturer.js`, `encoder.js`, `images-2d.js`).
- **Le comportement réel**, lu dans le code du kit : la bête chasse les Noyés quand le joueur est à terre (`festin`), bondit (`ruee`, 1,9 s) et engloutit jusqu'à 3 Noyés à l'impact. Le clip « dévoration » de 3,6 s ne sert qu'au joueur ; le mettre en scène avec un Noyé serait l'option B, à décider.
- **Copie vérifiée du jeu du kit** dans `scene-bete/kit/` : 16 fichiers conformes, hors de Git.
- **Chaîne vidéo** essayée sur des images 2D : boucle de 11 s, VP9, 3,7 Mo. Mesurée le 2 novembre : 3 images perdues et un à-coup à chaque tour. Refaite avec ffmpeg le même jour : 330 images sur 330, 2,4 Mo, plus fidèle (`scene-bete/README.md`, §3 bis).
- **Lecteur vidéo de D** (`fond-video.js`) : 42 vérifications sur 42 avec la vidéo d'essai.
- **Éclairs** : éclat plafonné à 0,5, et réglage « Éclairs de l'orage ».
- **Sons** : réglage présent, coupé et inactif ; étude de l'export des sons calculés du kit (`maWxGenAll`, `maThunderChannel`).
- **Procédure d'intégration** fonction par fonction : `docs/plan-integration-launcher.md` §8.

**Rien n'est exécuté du kit.** Un lancement de `capturer.js --essai`, envoyé dans la même commande qu'un simple contrôle de syntaxe, a été refusé par le contrôle de sécurité de Claude Code avant toute exécution. Ce lancement aurait de toute façon été arrêté par la garde de charge. La syntaxe a ensuite été vérifiée sans exécution (`node --check`).

**Essais des maquettes** : 117 vérifications sur 117.

**En attente d'Anthony** :
1. Autoriser l'exécution du jeu du kit pour l'essai court, puis la capture, quand la machine sera libre.
2. Option A (comportement réel) ou option B (clip de dévoration de 3,6 s avec un Noyé).
3. L'export des sons du kit.

**Décisions d'Anthony du 31 octobre (nuit)** : « Option A, et j'autorise l'export des sons du kit ».
1. **Option A** : la capture montrera le comportement réel du jeu (festin, ruée, engloutissement). Elle attend toujours son accord pour exécuter le jeu du kit et une machine libre.
2. **Export des sons** : fait le même soir.

**Fait : les sons de l'ambiance** (`maquettes/launcher/scene-bete/exporter-sons.js`).
- **Ce qui s'exécute** : seuls les trois blocs du calcul audio du kit, tels quels, dans une page vide du Chromium sans tête, sans réseau.
  - Pluie : `ma17_pluie.js`, de `maWxRand` à `maWxGenAll`.
  - Tonnerre : `ma18_orage.js`, `maBoltPath`, puis de `maThunderChannel` à `maThunderIR`.
  - Le reste du jeu ne tourne pas. Empreintes des deux fichiers et des trois blocs contrôlées avant l'exécution ; graine fixée, donc un export identique à chaque passage.
- **Sons exportés** (hors de Git, `ressources/marecages/sons/`) :
  - les six nappes de pluie du jeu (eau, bois, boue, feuillage, lointain, toit ; 5,9 à 8,9 s, stéréo, en boucle) ;
  - la réverbération de l'orage (4,5 s) ;
  - six tonnerres tracés comme dans le jeu : au sol à 450 m, 900 m, 1,7 km et 3 km ; dans les nuages à 2 et 3,5 km. Aucun éclair « tout près » : un launcher ne doit pas assourdir.
  - Formats : maîtres WAV 16 bits, et Opus (WebCodecs, sans ffmpeg) pour l'usage : 1,7 Mo en tout.
- **Contrôle des Opus**, décodés comme le fera le launcher :
  - longueurs exactes, décalage nul ;
  - énergie par tiers d'octave à ±0,02 à 0,04 dB en moyenne, au pire 0,6 dB à 40 Hz ;
  - enveloppe des impacts corrélée à 0,99 ou plus.
- **Dans D** (`D-hybride/ambiance.js`) : le mélange du jeu.
  - Pluie : nappes eau, bois, feuillage et lointain, à la force du jeu, réglée sur l'intensité de la pluie qu'on voit.
  - Tonnerre : sur chaque éclair, après l'arrivée du son, du côté de l'éclair, avec la réverbération de l'orage.
  - Fin de chaîne : le volume général du jeu, puis son compresseur.
- **Réglages** :
  - « Sons de l'ambiance » coupé par défaut : aucun contexte audio n'existe avant qu'on l'allume.
  - « Volume de l'ambiance » à 80 %, le volume du jeu par défaut.
  - Le son joue seulement quand le fond est visible. Pas d'éclair, pas de tonnerre ; sur l'image fixe, la pluie continue.
- **Niveaux mesurés** : à 80 %, la pluie sort à −27 dB pleine échelle. L'aperçu de 40 s (`apercu-orage.wav`) ne dépasse pas 0,70.

**Essais des maquettes** : 134 vérifications sur 134 (A, B et C 25 chacune, D 59, dont 20 pour le son), et 32 captures refaites.

**Décision d'Anthony du 31 octobre (nuit)** : « Je valide les quatre choix et le niveau ».
1. **Pas d'éclair tout près** : tonnerres de 450 m à 3,5 km. Le plus proche, 450 m, est réservé aux éclairs au sol les plus forts, environ 7 % des éclairs.
2. **Niveau** : volume de l'ambiance à 80 % (le volume du jeu par défaut) et compresseur du jeu. La pluie sort à −27 dB pleine échelle.
3. **Image fixe** : la pluie continue. Sans éclair, pas de tonnerre.
4. **Nappes boue et toit** : exportées, mais pas utilisées par la scène, qui se passe dehors, sur l'eau.
- Ces réglages sont la référence pour l'intégration (`docs/plan-integration-launcher.md` §8.3).

**En attente d'Anthony** :
1. Autoriser l'exécution du jeu du kit pour l'essai court, puis la capture (option A), quand la session Animations sera arrêtée.
2. Le commit du chantier, après présentation des différences. Les textes qui décrivent la carte (README, scripts, `marais.js`, `ambiance.js`) sont à relire avec lui avant.

**Suite, 1er et 2 novembre 2026** (détail : `maquettes/launcher/scene-bete/README.md`) :
- l'essai court et le cadrage de la capture, puis la capture complète le 2 novembre, sur l'ordre d'Anthony (« lance la capture »), par la file commune des tâches lourdes ;
- l'encodeur passé à ffmpeg avec son accord (« d'accord pour ffmpeg ») ; réglages choisis par lui : CRF 28 et fondu d'une seconde ;
- dans la maquette D, le saut de l'affiche au démarrage et la bascule avec ou sans éclairs, corrigés à sa demande ;
- le commit du chantier, sur son ordre du 2 novembre (« Envoie le commit »), avec les textes qui décrivent la carte.
