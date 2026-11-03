# Refonte de l'interface du jeu : analyse et plan technique

Demande d'Anthony du 2 novembre 2026 (« Zombie Survival — refonte complète de l'interface du jeu », mission de Claude Code 4). Références : trois prototypes.
1. Menu principal : fond de Khamsin, logo, boutons verticaux à gauche, rapport opérationnel à droite.
2. Sélection de la carte (Khamsin) : liste au centre, grand aperçu vidéo et fiche à droite.
3. Sélection de la carte (Marécage) : fiches en dossiers et grand aperçu à droite.

Ce document couvre la phase A (analyse, faite le 2 novembre 2026 en lecture seule, sans rien lancer) et le plan des phases B à F, **à valider par Anthony avant toute modification du jeu**. Rapports détaillés de l'analyse : hors du dépôt, dans le dossier de travail de la session.

## 1. Ce qui existe (vérifié dans le code)

Le code des menus vient presque entièrement du jeu 1.9.0 ; il ne se modifie que par des accroches (`engine/tools/hooks*.py`) ou des modules (`engine/src/`).

| Élément | Aujourd'hui |
|---|---|
| Menu principal `#menu` | Deux colonnes centrées sur 1 180 px : titre « Zombie Survival », boutons (Jouer, Reprendre, Statistiques, Modèles, Ranking, Amélioration d'arme, Options, Commandes, Quitter), grade, record, version ; à droite, le dossier « Ordres » (touches et consignes propres à la carte, `tip-*`, `khMenuTips`, `luMenuTips`). |
| Fond du menu | **La vraie scène 3D de la carte chargée**, en direct, avec une caméra qui se balance lentement (`menuCamera`, cycle de 57 s). Aucun zombie au menu. La carte du menu est la dernière jouée (`zs.map`), chargée au démarrage. Le rendu tourne sans arrêt, même sous les autres écrans. |
| Jouer | Ouvre la sélection des cartes (`#mapsel`) ; « Jouer » de la sélection lance la carte choisie (`playSelectedMap`, qui la charge si elle diffère de celle du menu). |
| Sélection `#mapsel` | Grille `#ms-grid` de cartes `.ms-card` construite depuis `MAPS.list` (pas de liste en dur dans l'écran) : vignette (plan de la carte, jamais une vue 3D), nom, description, record et parties. |
| Amélioration d'arme `#mods` | **Fiche d'information** sur les mods de munition du Glas (Résonance, Minuit) ; on n'y améliore rien. L'amélioration se fait en jeu, au Glas. |
| Statistiques, Modèles, Ranking, Options, pause, fin de partie | Écrans du 1.9.0 ; Modèles crée un second moteur WebGL, gardé toute la session. |
| Reprendre | N'existe que dans l'ancien environnement claude.ai : jamais visible dans le launcher. |
| Quitter | Visible seulement dans le launcher (`zsLauncher.quit`). |
| Clavier | Échap revient au menu depuis les feuillets ; flèches et Entrée dans la grille des cartes ; **pas de flèches entre les boutons du menu** ; Échap sans effet dans Options, la pause, la fin de partie. |
| Sons d'interface | Un seul (`Sound.ui`, au clic), **muet avant la première partie** : le contexte audio n'est créé qu'au lancement d'une partie. |
| Mouvements réduits | La préférence du système coupe les animations CSS, pas le balancement de la caméra du menu. |
| Polices | Big Shoulders Stencil Display, Barlow Condensed, Special Elite (OFL et Apache 2.0, livrées par le launcher), plus « ZS Teko » du HUD des points. |

**Données réelles d'une carte** :
- textes : `name`, `description`, `eyebrow` (« Rapport d'incident · … »), `lead` (briefing), `author`, `updated` ;
- caractéristiques : `open` (monde ouvert ou carte à grille), `rules` (points de départ, arme, courant, tempêtes), éléments de la carte (Glas, boîtes, atouts, véhicules), `dev` (marais : « en développement »), consignes `tip-*`.

**Données réelles du joueur** :
- par carte : record de manches (`zs.best.<id>`) et nombre de parties (`Life.data.maps[id].games`) ;
- tout le reste (éliminations, temps, manches…) est global, sauf les éliminations par type de zombie ;
- grade et XP (`Rank`).

**N'existent pas** : difficulté, niveau d'alerte, code d'opération, date d'ajout, statut « nouveau » ou « à venir ».

## 2. Prémisses à corriger

1. **Les fonds des prototypes sont des illustrations peintes** : pyramides sous un faisceau, cabane sur pilotis sous l'orage, photographies. Aucune ne vient du jeu. Avec les vrais environnements, que la demande exige, le fond aura l'aspect du jeu (three.js), pas celui des prototypes. La mise en page, la typographie, les documents, les lumières et les transitions peuvent être reproduits fidèlement ; l'aspect peint des fonds, non, sauf à utiliser des images qui ne montrent pas la vraie carte.
2. **Données inventées dans les prototypes** :
   - données à écarter : « Opération ZS-03 », « Niveau d'alerte : élevé », « Difficulté : élevée », « Occurrences ZS-03 », « Mode hors ligne » (le jeu ne connaît pas d'état en ligne), « v0.6 » (le vrai numéro est `GAME_VERSION`) ;
   - données réelles : « 10 parties » et « Record personnel : manche 23 ».
3. **Nom de la carte** : le jeu l'appelle « Les Marécages Maudits » (confirmé par la session de la carte), pas « Marécage Maudit ».
4. **Statut du marais** : en 2.0.7 il est jouable, avec le tampon « en développement » (`dev: true`). Le prototype 2 le montre « à venir », verrouillé ; le prototype 3, « Nouveau ». Aucun des deux ne correspond aux données.
5. **Amélioration d'arme** est une fiche d'information, pas un atelier : elle garde ce rôle.
6. **Fonctions absentes des prototypes**, à garder :
   - Reprendre (claude.ai seulement, caché ailleurs) ;
   - Commandes (la liste des touches, ouverte sur un écran étroit) ;
   - les consignes propres à chaque carte ;
   - le grade.

## 3. Architecture proposée

### 3.1 Où vit le code

- **Un module** `engine/src/I0-interface.js` (noms préfixés `ifc`), éventuellement découpé (`I1`, `I2`…), et ses styles et balisage dans `engine/interface/`. La lettre I est libre (H6–HB : boss de Bunker 7 ; S0–S1 : sons de l'intégration ; 65–6M et N7–N9 : chantier des cartes). Numéro de section à demander à Claude 5.
- **Un seul `engine/tools/hooks-interface.py`**, avec des accroches qu'aucun autre chantier ne vise :
  - `</style>` (styles) ;
  - `<div id="loading" class="screen">` (balisage) ;
  - début de `showScreen` ;
  - `bindUI();` dans `boot` ;
  - `  MapSel.sel = id;` dans `selectMapCard` ;
  - `  if (!renderEnabled) return;` dans `render` ;
  - le corps de `menuCamera`.

  Une seule ligne ajoutée à `build.py` : sa place est à fixer avec Claude 5.
- **Méthode** : on restyle et on **déplace les éléments existants** dans la nouvelle mise en page (même identifiants, mêmes écouteurs). On ne réécrit pas la logique des écrans.

### 3.2 Ce qui ne bouge pas

Ces éléments sont des contrats des essais, des Mod Tools ou des retouches des autres chantiers.

**Identifiants et classes** :
- menu et sélection : `#menu`, `#mapsel`, `#ms-grid`, `.ms-card[data-id]`, `.ms-name`, `.ms-photo img`, `.ms-desc`, `MapSel.sel`, `#btn-play`, `#btn-ms-play` ;
- autres écrans : `#btn-stats`, `#btn-models`, `#btn-ranking`, `#btn-mods`, `#md-*`, `#rk-*`, `#wm-*` ;
- pause et fin de partie : `#btn-quit`, `#btn-go-menu` (texte seul : les Mod Tools le réécrivent), `#gameover`, `#go-*`, `#loading` ;
- dossier : `#menu-eyebrow`, `#menu-lead`, `tip-*`, `#key-melee`, les lignes de touches.

**État et fonctions** :
- `G.state === 'menu'` ;
- `showScreen`, `quitToMenu`, `startGame`, `pauseGame`, `resumeGame`, `gameOver` ;
- `window.ZS` et `window.__zs` (aucun changement de l'interface des Mod Tools).

**Chargement de la carte par défaut au démarrage** : 18 essais lancent la partie sur la carte déjà chargée.

**Lignes visées par les autres chantiers**, à ne pas réécrire :
- Marécages : la ligne `card.append(photo, …)` d'`openMapSelect`, la règle `.ms-stamp`, `tip-o2`, `BUILTIN_MAPS`, `khMenuTips` ;
- boss de Bunker 7 : des lignes de `frame`, `gameOver`, `quitToMenu` ;
- intégration 2.0.7 : le début de `quitToMenu`.

**La grille des cartes reste la liste visible** de la sélection : les essais cliquent ses cartes, ce que Playwright refuse sur un élément caché.

### 3.3 Menu principal

- **Disposition** :
  - logo en haut à gauche (« ZOMBIE » blanc cassé, « SURVIVAL » rouge, pochoir usé) ;
  - sous le logo, la ligne d'accroche de la carte (`eyebrow`) ;
  - boutons verticaux à gauche, surlignage rouge animé ;
  - rapport opérationnel à droite ;
  - bandeau du haut et pied (version réelle, grade).
- **Rapport opérationnel** (données réelles seulement) :
  - zone : nom de la carte ;
  - type : monde ouvert ou carte à grille ;
  - lieu : `eyebrow` ;
  - briefing : `lead` ;
  - vue de la carte : plan ou affiche ;
  - record et parties sur cette carte ;
  - consignes propres à la carte (les `tip-*` actuels) ;
  - touches dans un volet repliable (« Commandes »).
- **Fond** : la vraie scène 3D de la carte du menu, comme aujourd'hui (un seul moteur, rien à charger en plus), avec une couche d'atmosphère légère en 2D par-dessus, propre à chaque carte et définie par une configuration : poussière de sable, particules de pluie, poussière lunaire, grain.
  - Balancement de la caméra : il suit « réduire les animations ».
  - Mode allégé : image fixe à la place de la 3D.
  - Le rendu 3D s'arrête sous un écran opaque (drapeau séparé, pas `renderEnabled`, que les Mod Tools et 17 essais emploient).
- **Clavier** : flèches haut et bas entre les boutons, Entrée, Échap. Focus visible.
- **Son** : sons d'interface discrets (survol, validation) par le bus du jeu, seulement si le réglage « Sons des menus » est allumé. Le contexte audio est créé au premier geste.

### 3.4 Sélection des cartes

- **Trois zones** :
  - navigation verticale ;
  - liste des cartes (la grille actuelle, restylée en fiches) ;
  - grand aperçu et fiche de la carte.
- **Survol et clavier** : la carte se surligne, l'aperçu change en fondu, la fiche se met à jour. Le survol ne choisit pas : la carte réellement choisie (clic, Entrée) reste distincte, avec son tampon.
- **Fiche** :
  - nom officiel, description, type, lieu, briefing ;
  - record et parties ;
  - tampon « En développement » si `map.dev` ;
  - bouton JOUER.
- **Badges « Nouveau » ou « À venir »** : seulement si une donnée réelle existe (décision 5).
- **Extensible** : tout vient de `MAPS.list`. Une carte des Mod Tools, sans vidéo, montre son image ou son plan, agrandis.

### 3.5 Aperçus vidéo

- **Un seul lecteur actif**, chargé à l'ouverture de la sélection seulement, et seulement pour une carte qui a une vidéo déclarée. Aucune requête pour les autres cartes, donc aucune erreur de chargement dans la console (19 essais échouent sur une erreur de console).
- **Fondu** entre deux aperçus (deux couches, comme le fond du launcher).
- **Arrêt et déchargement** en quittant l'écran ; repli sur l'image si le décodage échoue.
- **Déclaration** dans un manifeste par identifiant de carte (`apercus/index.json` : fichier, affiche, cadrage). Pas de liste en dur.
- **Livraison** : fichiers à côté du jeu, dans `gamelibs/apercus/`, copiés dans le paquet sans changer de code.
  - Ils n'atteignent les joueurs qu'avec le launcher qui les contient : la publication prend `gamelibs` dans le launcher installé.
  - Lecture par `fetch` puis `Blob`, car le protocole du jeu ne transmet pas les requêtes partielles. À essayer dans Electron.
- **Version navigateur, cartes sans vidéo, vidéo illisible** : affiche ou plan.

### 3.6 Options ajoutées

Sans toucher aux réglages existants ni à leurs valeurs par défaut :
- « Réduire les animations » (et la préférence du système) ;
- « Sons des menus » ;
- « Fond du menu » (animé ou image fixe, c'est le mode allégé).

Les réglages de confort des Marécages (secousses, éclairs) attendent l'écran des options : leur place se décide avec Claude 6.

### 3.7 Tailles d'écran

- De 1 280 × 720 à 3 440 × 1 440, et jusqu'à la fenêtre minimale du jeu (960 × 540).
- Échelle sur la hauteur, bornée.
- En 21:9, le fond occupe toute la largeur ; les commandes restent à gauche et l'aperçu à droite, chacun dans une largeur de lecture.
- Aucun chevauchement : contrôlé par des mesures, comme pour le launcher.

### 3.8 Mémoire et performances

- Un seul moteur 3D au menu (celui qui existe) ; aucun monde chargé pour un aperçu.
- Une seule vidéo décodée à la fois, déchargée en quittant.
- Rendu 3D coupé sous les écrans opaques.
- Boucles d'animation du menu arrêtées hors de l'état « menu » et dans les Mod Tools.
- Aucune fuite au changement répété de carte : contrôle par mesure.

## 4. Captures des aperçus (à approuver avant de lancer quoi que ce soit)

**Méthode** : la chaîne du fond du launcher (`maquettes/launcher/scene-bete/`), généralisée.
- Le jeu tourne sans tête, par la file `zs-lourd --classe jeu`, avec la souris verrouillée refusée et seul le canevas lu (le bandeau `#lockhint` ne peut pas y paraître).
- Temps de jeu piloté, hasard figé.
- Encodage en VP9 par ffmpeg, boucle avec fondu.

**Mise en scène par carte** (à choisir par Anthony) :
- caméra fixe ou lent glissement, sans secousse ni zoom ;
- zombies présents ou non ;
- météo (tempête de Khamsin, orage du marais) ;
- moment ;
- 8 à 12 s.

**Format** : 21:9 (2560 × 1080) avec la zone utile 16:9 au centre, pour aller de 1280 × 720 à 3440 × 1440 sans perdre l'essentiel.

**Coûts estimés** (rendu logiciel de WSL, d'après la capture des Marécages : environ 3 s par image en 1600 × 620) :

| Par carte | Estimation |
|---|---|
| Capture | 30 à 45 min en 2560 × 1080 |
| Mémoire | 2 à 3 Go (budget de la file : 4 000 Mo) |
| Encodage | 1 à 2 min, 0,6 Go |
| Vidéo | 5 à 9 Mo |

Pour les 4 cartes : 2 à 3 h de la place « jeu » de la file, en arrière-plan, une capture à la fois ; 20 à 35 Mo de plus dans le paquet du jeu et dans l'installateur.

**Le marais a déjà sa scène** : la vidéo du launcher, en 1600 × 620. On peut la reprendre comme aperçu, ou la refaire au format 21:9.

**En attendant les vidéos** : l'affiche ou le plan, présentés comme des images (avec une étiquette « Aperçu fixe »), jamais comme des vidéos.

## 5. Phases et points d'accord

| Phase | Contenu | Contrôles | Fin de phase |
|---|---|---|---|
| B. Prototype | Menu vertical, sélection en trois zones avec fiche, transitions, survol, clavier, options ajoutées ; fond 3D actuel ; aperçus en images. | Construction (cmp, dupcheck), essais de la page dans le Chromium sans tête par la file `zs-lourd` (une instance), captures aux 4 tailles. | Captures à Anthony. |
| C. Fonds et vidéos | Couches d'atmosphère par carte, lecteur d'aperçus et manifeste ; captures **après son accord sur la mise en scène**. | Lecture, fondus, déchargement, mémoire au fil de 50 changements de carte. | Vidéos à Anthony. |
| D. Finitions | Documents militaires (papier, tampons, photo), lumières, grain, sons ; mêmes codes visuels pour Statistiques, Modèles, Ranking, Amélioration d'arme, Options, pause et fin de partie, sans changer leur logique. | Captures, contraste, lisibilité. | Captures à Anthony. |
| E. Vérification | Tous les boutons, le clavier, les 4 tailles plus 960 × 540, mouvements réduits, mode allégé, mémoire, Mod Tools (partie de test), construction avec les autres chantiers (étape des Marécages). | Nouvel essai de bout en bout `menus.e2e.js` (contrats non couverts aujourd'hui : options, Retour, clavier des cartes, Quitter) ; suite E2 lancée par Anthony. | Rapport des essais. |
| F. Remise | Commit local sur `chantier/interface` avec son accord, puis instructions à Claude 5. | — | Fusion et publication : jamais sans lui. |

## 6. Coordination

- **Claude 5** :
  - place de l'accroche dans `build.py` et numéro de section ;
  - mécanisme commun des ressources hors du fichier : le chantier des animations se pose la même question pour son modèle ;
  - type `.webm` dans `tzeval.js` et `e2e-page.js` ;
  - ordre des boutons dans `game-menu.e2e.js`, que modifie aussi le chantier Bunker 7 ;
  - version cible : celle qui suivra la 2.0.7, déjà en cours de fusion.
- **Claude 6 (Marécages)** :
  - ses ancres dans la sélection des cartes (ne pas les réécrire) ;
  - ses réglages de confort à placer dans Options ;
  - son passage `sur-autres.py` sur notre construction.
- **Chantier des cartes** : l'aspect de Khamsin change en 2.0.8. Un aperçu filmé avant serait périmé ; le refaire après sa fusion.
- **Bunker 7** : ses accroches de `frame`, `gameOver` et `quitToMenu` restent intactes.

## 7. Décisions d'Anthony (2 novembre 2026, au soir)

1. **JOUER ouvre la sélection des cartes**, comme aujourd'hui. Le bouton « Sélection de carte » du prototype ferait donc la même chose : il est retiré, comme le prévoit la demande pour les doublons. Menu : JOUER, AMÉLIORATION D'ARME, STATISTIQUES, MODÈLES, RANKING, OPTIONS, QUITTER (Reprendre et Commandes gardés là où ils servent). Dans la sélection, la navigation de gauche met JOUER en évidence.
2. **Fond du menu principal** : la vraie scène 3D en direct de la carte en cours, avec une atmosphère 2D légère par-dessus ; image fixe en mode allégé.
3. **Aperçus vidéo** : le lecteur, le manifeste et les fondus sont faits pendant le prototype, avec des images marquées « Aperçu fixe ». La mise en scène de chaque carte se décide après le prototype, avant toute capture.
4. **Données** : seulement les vraies données, plus « En développement » et « Jamais jouée », et un champ de carte « ajoutée en version… » (`ajout`) qui affiche « Nouveau » sur les cartes de la version installée.

Choix par défaut annoncés à Anthony, sans objection de sa part :
- ordre des boutons du prototype : une ligne de `game-menu.e2e.js` à adapter, avec Claude 5 ;
- mêmes codes visuels pour Statistiques, Modèles, Ranking, Amélioration d'arme, Options, pause et fin de partie (phase D), sans changer leur logique ;
- trois options : « Réduire les animations », « Sons des menus » (allumés, contexte audio au premier clic), « Fond du menu » (animé ou fixe) ;
- version cible : celle qui suivra la 2.0.7.

## 8. Phase B : prototype (2 novembre 2026, au soir)

**Fichiers** (rien d'autre ne change dans le moteur) :
- `engine/src/I0-interface.js` : le module (`IFC`, fonctions `ifc…`) ;
- `engine/interface/interface.css` : les styles, insérés tels quels à la fin de la feuille du jeu ;
- `engine/tools/hooks-interface.py` : six accroches (fin de la feuille de styles, `bindUI();` du démarrage, début de `showScreen`, `MapSel.sel = id;` de `selectMapCard`, `if (!renderEnabled) return;` de `render`, temps de `menuCamera`) ; une ligne dans `build.py`, après `hooks-points.py` (sa place définitive se fixe avec Claude 5 : Bunker 7 et l'intégration 2.0.7 ajoutent les leurs au même endroit, simple conflit de lignes à la fusion) ;
- `launcher/gamelibs/apercus/index.json` : manifeste des aperçus vidéo (copié avec le jeu par `gamepack.collectPackage`) ; vide pendant la phase B, il déclare depuis le 3 novembre les aperçus de Bunker 7, Khamsin et Ombre éternelle (§9) ;
- `launcher/e2e/game-menu.e2e.js` : la vérification de l'ordre des boutons suit les maquettes (Amélioration d'arme entre Jouer et Statistiques) ;
- `engine/tools/banc-interface/menus.js` : banc de captures et de mesures des menus (par `zs-lourd`, classe jeu).

**Ce que fait le prototype** :
- menu principal : logo en pochoir usé en haut à gauche, ligne d'accroche de la carte, boutons verticaux avec surlignage rouge qui se déploie (reflet lent), rapport opérationnel à droite (nom, plan ou affiche, type, parties, auteur, record, briefing, consignes, commandes repliables), grade et version en bas ;
- sélection : trois zones (navigation, dossiers numérotés, aperçu et fiche) ; le survol change l'aperçu en fondu (après 90 ms) et la fiche, sans choisir la carte ; la carte choisie garde son cadre rouge, son onglet rouge et son tampon « Choisie » ; sous la fiche, « Carte choisie : … » rappelle ce que lancera JOUER ; Entrée sur une carte la choisit et la lance, comme le clic ;
- aperçus : lecteur et manifeste (`apercus/index.json` : vidéo, affiche, cadrage par carte), lu à la première ouverture de la sélection ; une seule vidéo décodée à la fois, lue depuis un `Blob`, en fondu quand elle joue, déchargée en quittant l'écran, en pause quand la fenêtre est cachée ; vidéo illisible : l'image reste ; « Réduire les animations » et le fond allégé gardent l'image ; sans vidéo déclarée : l'image ou le plan de la carte, marqués « Aperçu fixe » ;
- clavier : flèches haut et bas dans les menus verticaux, Entrée, Échap (y compris dans les Options, qui ramènent à l'écran d'avant, la sélection comprise) ;
- sons des menus : contexte audio créé au premier geste, clic discret au survol sur le bus des effets ; éteints, le clic de validation du jeu se tait aussi hors partie (pause et fin de partie le gardent) ;
- fond : la scène 3D n'est plus redessinée sous la sélection et les écrans du menu (la dernière image reste) ; « Fond du menu : image fixe » fait de même au menu, après 2 s (le temps que modèles et textures arrivent ; terrain fin des mondes ouverts construit avant) ; tout changement de carte, d'écran ou de taille de la toile (fenêtre, qualité graphique) redessine ;
- réglages, dans `zs.interface` (les réglages du jeu ne changent pas) : « Réduire les animations » (par défaut, la préférence du système ; arrête aussi le balancement de la caméra du menu et les animations des autres écrans du menu), « Sons des menus », « Fond du menu » ;
- fenêtres étroites (navigateur, moins de 860 px) : une colonne, rapport visible, Retour gardé dans la sélection ; fenêtres basses (moins de 620 px) : menu resserré.

**Relecture** (4 angles, chaque constat contre-vérifié, 2 novembre au soir) : 27 constats, 23 confirmés, une quinzaine de défauts distincts, tous corrigés. Les plus importants : image fixe figée avant la fin de la construction du terrain (Khamsin, Lune), fondu échelonné rejoué à chaque survol, barre de défilement parasite du rapport, tampon « En développement » des Marécages posé sur le nom de la carte. Seconde relecture, ciblée sur le lecteur et les corrections : 6 constats, 5 confirmés, mineurs, corrigés (vidéo en pause quand la fenêtre du launcher perd le focus, car sa page reste « visible » ; affiche absente : retour à l'image ou au plan ; dernière image de la vidéo gardée pendant le fondu ; la souris qui quitte la liste revient sur la carte qui a le focus ; terrain construit d'un coup seulement pour l'image fixe). Les mesures du banc (chevauchements entre zones, sortie de la fenêtre, textes coupés, défilement, erreurs de console) sont sans défaut à 1 920 × 1 080, 1 280 × 720, 960 × 540, 960 × 505 (fenêtre minimale du launcher sous sa barre de titre, avec Reprendre et Quitter) et 3 440 × 1 440 ; le lecteur a été essayé avec une vidéo d'essai (lecture, une seule vidéo, déchargement, fichier cassé). La lecture est contrôlée par l'état du lecteur (évènement « playing », source `blob:`) ; la capture montre aussi la vidéo d'essai.

**Pour Claude 5 et Claude 6** :
- le champ `ajout` doit traverser `openNormalize` et `normalizeMap` (ils ne gardent qu'une liste de champs) ; sans lui, « Nouveau » ne s'affiche pas ;
- le tampon `.ms-dev` des Marécages reste sur l'image de la carte dans la liste ; la fiche montre aussi « En développement » (à confirmer avec Claude 6) ;
- avec les sons des menus allumés, le contexte audio naît au premier clic au menu : l'ambiance de menu des Marécages démarrera alors avant toute partie.

## 9. Suite du 3 novembre 2026

**Réponses d'Anthony au prototype** (3 novembre, au matin) : « Le chantier que tu as déjà fait est déjà bien, tu peux continuer » ; « Ouverture du jeu… » à la place de « Ouverture du bunker… » sur l'écran de chargement du jeu (fait par une accroche ; la ligne d'état du launcher aussi depuis sa réponse de l'après-midi, voir §10) ; « Salles et couloirs » gardé ; les entrées du rail (Statistiques, Modèles, Ranking, Amélioration d'arme) ramènent au menu, les Options à l'écran d'avant : gardé ; captures des aperçus : accord (« Il y a uniquement Claude 2 qui travaille en même temps que toi »).

**Phase C, ambiance** : `engine/src/I1-ambiance.js`. Couche 2D du menu par-dessus la scène 3D, choisie par la base de la carte (`IFC_AMBIANCE_BASES`) : poussière en suspension (cartes à grille), sable porté par le vent (Khamsin, Désert vierge), fine poussière en lévitation au ras du sol (Ombre éternelle, la lueur d'horizon des régions rasées par le Soleil). Les Marécages n'en ont pas : leur scène a déjà sa pluie et sa brume en 3D. Toile à demi-résolution, 30 images par seconde au plus, arrêtée hors du menu, fenêtre cachée, dans les Mod Tools et avec le fond allégé ; animations réduites : une image fixe. Aucun éclair ni clignotement. Grain fixe très léger sous les menus.

**Phase C, aperçus** : outil `engine/tools/banc-interface/apercus.js` (par `zs-lourd`, classe jeu) : la carte filmée dans le vrai jeu, image par image, caméra pilotée par des plans (fichier JSON, coordonnées du monde, hauteur au-dessus du sol), temps du menu piloté, hasard figé ; vidéo VP9 1280 × 720, 24 images par seconde, muette, fondus de 0,6 s entre les plans, boucle sans saut ; affiche JPEG. Mode `--essai` : trois images par plan et une planche, pour choisir les plans avant de filmer. Le format 21:9 du §4 est abandonné : la vidéo ne sert qu'au cadre 16:9 de la sélection (le fond du menu est la scène en direct, décision 2), dont la largeur ne dépasse pas 1 280 px. Khamsin change avec la 2.0.8 (chantier des cartes) : son aperçu sera à refaire après cette fusion, avec le même outil et les mêmes plans ajustés ; les Marécages, après leur fusion.

**Phase D** : `engine/src/I2-ecrans.js`. Statistiques, Modèles, Ranking et Amélioration d'arme prennent le rail de la sélection (logo, entrées du menu avec l'écran en cours en évidence, Retour) ; sous 1 240 px de large, le rail devient une ligne (logo, Retour) au-dessus de la fiche. Pause et fin de partie : cadre sombre bordé de rouge, boutons du menu (surlignage, flèches) ; tailles en u (titre de fin de partie ramené pour la fenêtre minimale). Options : même cadre, titre « Réglages du survivant ». Logique des écrans inchangée ; le rail construit par `ifcRail` (commun à la sélection) ; le focus que `showScreen` donne au premier lien passe sur l'écran en cours. Banc : 1 920 × 1 080, 1 280 × 720 et 960 × 540 sans défaut ni erreur de console.

**Relecture des phases C et D** (3 novembre) : 8 constats, 7 confirmés, mineurs, corrigés (particules redistribuées après un redimensionnement, limiteur de 30 i/s juste à 60 Hz, focus des fiches à rail sous 1 240 px et sur l'onglet choisi, vide entre rail et fiche en fenêtre étroite).

**Phase E, essai** : `launcher/e2e/menus.e2e.js`, ajouté à `test:e2e` après `hud-points` (à confirmer avec Claude 5, qui tient la suite). Blocs synchrones dans la page (rejouables ici par `engine/tools/banc-interface/essai-page.js`, souris verrouillée refusée) : menu vertical et flèches, rapport, écran de chargement, ambiance, sélection (survol sans choix, clic, rail, Options et Échap), manifeste, trois réglages (zs.settings inchangé), fiches à rail, pause et fin de partie.

**Aperçus livrés** (3 novembre) : `launcher/gamelibs/apercus/` : `bunker7`, `khamsin` et `ombre`, chacun une vidéo `.webm` (VP9, 1 280 × 720, 24 images par seconde, 10,2 s, muette) et une affiche `.jpg` ; 3,0 Mo de vidéos et 0,15 Mo d'affiches en tout, autant de plus dans chaque paquet du jeu et dans l'installateur. Mise en scène : cinq plans proposés et contrôlés par carte (workflow), images d'essai de chacun, trois retenus par carte sur ces images, dans `engine/tools/banc-interface/plans-apercus.json` :
- Bunker 7 : la boîte mystère (la vue du menu), l'entrepôt sous la lampe, Le Glas ;
- Ombre éternelle : la fosse depuis le talus sud, la catapulte, la base Séléné ;
- Khamsin : le plateau vu du nord-ouest (trois pyramides, faisceau, tempête), le portail de Khéops, les jeeps devant la tempête (à refaire après la 2.0.8).
Écartés : un plan de Bunker 7 où un pilier masque l'image, la crête lunaire presque vide, deux plans qui doublaient la vue du menu. Coût mesuré : 17, 59 et 9 min de la place « jeu ». Luminosité contrôlée image par image : la première capture de Bunker 7 avait une coupure au hasard des lampes (la salle s'éteignait trois images, à chaque boucle) ; l'outil retire désormais ces coupures pendant la capture, et la vidéo refaite ne varie pas de plus de 1,3 point d'une image à l'autre.

**Vérifications du 3 novembre** :
- essai `menus` rejoué dans la page : toutes les vérifications réussies (48 sur 48 avant les ajouts de la relecture finale) ;
- banc avec les vraies vidéos : les trois jouent dans la sélection, une seule à la fois, affiche dessous ;
- banc des écrans en 960 × 540 : focus à l'ouverture sur Retour (Statistiques) ou l'onglet choisi (Modèles, Ranking, Amélioration d'arme).

**Relecture finale** (3 novembre) : 8 constats, 6 confirmés (essai renforcé : manifeste réel, vidéos lues par le protocole du jeu, clic de validation compté, flèches et Entrée sur les cartes, Quitter ; documentation ; mesure de la fin de partie du banc). Bilan de complétude : voir la remise (§10, à écrire en phase F).

## 10. Fond illustré (3 novembre 2026, après-midi)

**Demande d'Anthony** : remplacer le fond du menu (la scène 3D de la carte) par l'illustration de sa maquette (les pyramides dans la tempête, le faisceau, le camp), et faire de même dans les autres menus (sélection, etc.) ; garder les aperçus vidéo de la sélection tels quels. Elle remplace la décision 2 (« 3D en direct ») comme réglage par défaut.

**Fait** :
- calque `#ifc-fond` sous les écrans du menu, au-dessus de la toile 3D, montré hors partie seulement (menu, sélection, fiches, options ouvertes depuis le menu ; ni chargement, ni pause, ni fin de partie, ni Mod Tools) ; l'image (`IFC_FOND`, `launcher/gamelibs/fonds/menu.jpg`) est chargée d'avance et ne remplace la scène qu'une fois arrivée : absente (version navigateur sans `gamelibs`), la scène reste ;
- derrière l'illustration, la scène 3D n'est plus dessinée (`ifcFige`) : le menu ne calcule plus d'images 3D ;
- la sélection, les fiches et les options laissent voir l'illustration, assombrie (voiles plus légers quand elle est là, comme la maquette 3) ;
- ambiance 2D accordée à l'illustration (sable), quelle que soit la carte chargée ;
- réglage « Fond du menu » : Illustration (par défaut), Scène de la carte (3D animée), Scène de la carte figée (allégé) ; l'ancienne valeur « anime » devient « Scène de la carte ».

**Image** : la maquette d'Anthony elle-même (sa question du 3 novembre au soir : « Tu ne sais pas tout simplement recréer/copier l'image en arrière-plan que je t'avais donnée ? »). Aucun outil de génération d'images n'est disponible : l'interface peinte sur la maquette (barre du haut, logo, menu, rapport, barre du bas) est effacée par `engine/tools/banc-interface/retouche-fond.py` (remplissage à plusieurs échelles depuis les bords des zones, grain recopié d'un morceau de nuages voisin, hors du faisceau et des arêtes), puis l'image est agrandie de 1 499 × 834 à 3 440 × 1 914 (Lanczos, léger renforcement, grain fin) ; JPEG qualité 88 sans sous-échantillonnage des couleurs, 0,75 Mo. Les zones effacées deviennent des voiles de poussière lisses, cachés sous les boutons, le rapport et les voiles des bords ; l'image reste un peu molle en 3 440 × 1 440 (agrandie 2,3 fois). Une version d'Anthony sans interface et en grande taille la remplacerait sans autre changement. Le menu principal voile moins l'illustration que la scène 3D (comme la maquette). Une première image provisoire (une vue du vrai Khamsin, étalonnée) avait des blocs de couleur dans le faisceau, relevés par Anthony : le JPEG de la capture plus l'étalonnage ; l'outil de capture sait désormais rendre ses images fixes en PNG (`--png`).

**Réponses d'Anthony du 3 novembre, après-midi** :
1. Échap dans la pause reprend la partie : fait (accroche sur `onGlobalKey`, `ifcEchapReprend` ; un Échap arrivé moins de 400 ms après l'ouverture de la pause est ignoré, car c'est la touche qui a libéré la souris verrouillée) ; ligne des commandes « Échap : pause · reprendre ». Échap ne donne pas au navigateur le droit de reprendre la souris verrouillée : la partie repart en « souris libre » (bandeau existant), et le premier clic sert seulement à reprendre la souris, sans tirer ni viser (`ifcReprendre`, écouteur mousedown en capture), comme le bouton Reprendre. Relevé par la contre-vérification du 3 novembre : sans cela, ce clic tirait et le jeu ne reprenait la souris qu'au clic suivant, après 1,5 s.
2. Le clignotement de « SURVIVAL » reste.
3. « Ouverture du jeu… » aussi dans la ligne d'état du launcher : fait (page, script, essais qui attendent ce texte, `docs/plan-integration-launcher.md` ; les anciennes maquettes gardent l'ancien texte).
4. Commit : attendre son accord.

**Compatibilité avec « Sauvegarder et quitter »** (Claude 5, jeu 2.0.7 ; ses choix du 3 novembre au soir : confirmations dans un écran à part `#confirm`, `#btn-save-quit` et `#pause-save-why` dans la pause, `.save-info` dans `btn-resume-save`, `#menu-save-done` sous les entrées du menu) : la mise en page ne retire plus aucun élément inconnu (enfants de `.intro` sous les boutons du menu, de `#dossier` en bas du rapport, de la feuille de la sélection dans la colonne de la fiche ; bouton inconnu avant Options) ; `#confirm` habillé comme la pause et compté parmi les écrans du menu (illustration derrière) ; styles de `.save-info` et de `#menu-save-done`. Vérifié sur son balisage simulé avant le démarrage (5 sur 5) ; commit de suivi avec l'accord d'Anthony (« Vas-y », 3 novembre).
