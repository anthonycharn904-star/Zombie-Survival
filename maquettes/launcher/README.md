# Maquettes du nouveau launcher

Maquettes pour la refonte du launcher de Zombie Survival : trois directions artistiques (demande d'Anthony du 31 octobre 2026), puis l'hybride D, qui combine A et B (son choix du même soir). Ce sont des maquettes interactives en HTML, CSS et JavaScript. Elles sont indépendantes du launcher réel (`launcher/`), qu'elles ne modifient pas : ni Electron, ni mises à jour, ni réglages. Toutes leurs fonctions sont simulées.

| Direction | Idée | Signature |
|---|---|---|
| **A · Militaire cinématographique** (`A-militaire/`) | Le poste de commandement de Bunker 7 : le vrai rendu du jeu en fond, lampe qui vacille, poussière dans le faisceau, dossiers tapés à la machine, tampons, plaques d'identité, interrupteurs à levier | Progression en bande de cartouches ; navigation en « manuel de campagne » (Opérations, Transmissions, Rapports, Intendance, Génie, Réglages) |
| **B · Launcher AAA moderne** (`B-aaa-moderne/`) | Une application structurée : barre latérale, accueil en grand bandeau défilant, cartes d'actualités filtrables, chronologie des versions, statistiques d'installation, panneau de lecture | Gestionnaire de téléchargement avec courbe de débit ; bouton Jouer qui se remplit |
| **C · Nouvelle génération** (`C-nouvelle-generation/`) | Une direction éditoriale et vivante : grande typographie (police Teko du HUD des points), veines rouges génératives, images en bichromie, navigation numérotée, volet rouge entre les sections | Cadran Jouer à 25 segments et bâtons de manche (5 × 5) qui se remplissent |
| **D · Hybride A+B** (`D-hybride/`) | L'architecture de B (barre latérale, pages, chronologie, actualités filtrables, cartes, gestionnaire de téléchargement) habillée de l'identité de A (rendu de Bunker 7 avec lampe et poussière, pochoir et machine à écrire, tampons, plaques d'identité, rayures de danger) ; de C, la bichromie des images d'actualités et l'index oblique de la navigation | Bouton Jouer « déploiement » ; bande de cartouches et courbe de débit dans le gestionnaire ; lecture des actualités sur une feuille de dossier ; fenêtre redimensionnable de 960 × 600 à la page entière |

Les quatre partagent les mêmes données et les mêmes états, pour que la comparaison porte sur la direction artistique.

**Fenêtre de D, redimensionnable** : poignée dans l'angle en bas à droite (de 960 × 600 à la page), bouton Agrandir et double-clic sur la barre du haut (bascule entre la taille choisie et la page entière). La mise en page suit la taille de la fenêtre (requêtes de conteneur) : trois actualités au lieu de deux à partir de 1 500 px de large, colonnes resserrées sous 1 180 px.

## Fond animé de D : Marécages maudits (prévisualisation)

Demande d'Anthony du 31 octobre 2026 au soir : remplacer le fond de l'accueil (la salle de Bunker 7) par la carte des Marécages maudits, animée, avec la bête qui dévore des Noyés, la pluie et l'orage.
- **Base** : une vraie capture du kit 2.0.7, « la Mère-Vase se jette sur un Noyé », retournée pour que la bête soit à droite du texte.
- **Animation** (`D-hybride/marais.js`, 2D, 30 images par seconde au plus) :
  - l'eau et les reflets ondulent ;
  - le leurre pulse ; les yeux des Noyés luisent et clignent ;
  - la brume de la carte dérive ;
  - la pluie (deux plans, ronds sur l'eau) et l'orage (éclairs dans les nuages et au sol) sont adaptés d'après les réglages du kit. Le code du kit n'est pas exécuté.
- **Économie** :
  - image fixe de secours (la capture en arrière-plan CSS ; une image figée quand l'animation est coupée) ;
  - réglage « Fond d'écran animé » ;
  - pause quand la fenêtre est masquée ou réduite (bouton Réduire simulé), hors de l'accueil et pendant une partie.
- **Réglage « Fond de l'accueil »** : Marécages maudits ou Bunker 7.
- **Provenance, références et suite** : `ressources/marecages/README.md`. La capture reste hors de Git (carte non publiée).
- **Éclairs discrets**, à éclat plafonné (une ambiance sombre, sans excès de lumière). Réglage « Éclairs de l'orage ».
- **Sons de l'ambiance** (`D-hybride/ambiance.js`) : les sons calculés du kit 2.0.7, exportés avec l'accord d'Anthony (`scene-bete/exporter-sons.js`), mêlés comme dans le jeu.
  - Pluie : à la force du jeu, réglée sur l'intensité de la pluie qu'on voit.
  - Tonnerre : sur chaque éclair, après l'arrivée du son, du côté de l'éclair, avec la réverbération de l'orage.
  - Volume général et compresseur du jeu en fin de chaîne.
  - Réglages « Sons de l'ambiance » (coupé par défaut : le launcher démarre en silence) et « Volume de l'ambiance » (80 %, le volume du jeu par défaut).
  - Son seulement quand le fond est visible. Fichiers et contrôle : `ressources/marecages/README.md`.
  - Choix et niveau validés par Anthony le 31 octobre 2026.
- **La vraie scène de la bête** (capture dans le jeu du kit) : `scene-bete/README.md`. Capture faite le 2 novembre sur l'ordre d'Anthony ; vidéos encodées par ffmpeg avec ses réglages (CRF 28, fondu d'une seconde) : `ressources/marecages/fond-marais.webm` et sa version sans éclairs, 4,5 Mo chacune, hors de Git.
  - Le lecteur vidéo de D (`D-hybride/fond-video.js`) prend la vidéo dès qu'elle existe (`ressources/marecages/fond-marais.webm`) ; sinon, la scène 2D.
  - Essayé avec des vidéos d'essai : le fond 2D, et l'essai court du 1er novembre avec son éclair (61 vérifications sur 61).

## Ce qui est représenté

- **Sections** : accueil, actualités, notes et historique des mises à jour, installation, Mod Tools (mode auteur), paramètres.
- **Indicateurs** : bouton Jouer, versions du jeu et du launcher.
- **États du vrai launcher** (`launcher/src/renderer/launcher/launcher.js`), simulés par `commun/maquette.js` : ouverture, vérification, prêt, mise à jour disponible, téléchargement (vitesse, temps restant, annulation), vérification de la signature, installation, réparation, retour à la version précédente, nouveau launcher et redémarrage, partie en cours, hors ligne, erreur et nouvel essai, jeu absent (première installation).
- **Panneau « Maquette »**, hors du launcher (touche M) :
  - scénarios ;
  - mode auteur (avec ou sans les Mod Tools) ;
  - taille de la fenêtre : 1 080 × 660 (taille actuelle), 1 280 × 720 (proposée), 1 600 × 900, ou toute la page ;
  - animations (coupées aussi par « réduire les animations » du système) ;
  - liens vers les autres directions.

## Ce qui est signalé comme simulé ou comme exemple

- Badge « Maquette · fonctions simulées » dans la barre de titre de chaque direction.
- Bulle « Simulation » à chaque action sans effet réel : lancer le jeu, ouvrir les Mod Tools, le dossier, le journal, enregistrer un réglage.
- **Actualités** : exemples, marqués « Exemple ». Le vrai launcher reçoit les siennes, en titre, texte et date, avec chaque version publiée. Les images des actualités sont une proposition.
- **Versions fictives** : la 2.0.7 et le launcher 1.4.0 des scénarios (numéro confirmé par Anthony le 2 novembre 2026) sont marqués « simulée ».
- **Notes des versions 1.5.1 à 2.0.6** : résumés d'après le README, marqués « Exemple ». Celles des versions 1.0.2 à 1.5.0 sont les notes publiées (`launcher/config/notes-history.json`).
- **Données réelles** (relevées le 31 octobre 2026) :
  - versions du jeu et du launcher ;
  - taille installée (8,3 Mo) et paquet d'une version (4,3 Mo, mesuré) ;
  - source des mises à jour et empreinte de la clé de confiance (`launcher/config/default.json`) ;
  - réglages du vrai launcher.
- L'illustration de Khamsin est un dessin de la maquette, pas une image du jeu.

## Fabrication

**Préalable** : `npm ci` dans `launcher/` (avec l'accord d'Anthony), pour `playwright-core` ; le Chromium « sans tête » de Playwright (`~/.cache/ms-playwright/`), ou `ZS_CHROMIUM` pour en imposer un. Les ressources des Marécages (capture, vidéos, sons) sont hors de Git : sans elles, D montre le fond de Bunker 7 et `essai.js` saute les contrôles du fond animé et des sons.

```bash
python3 maquettes/launcher/assembler.py
```

```bash
node maquettes/launcher/capture.js
```

```bash
node maquettes/launcher/essai.js
```

- **`assembler.py`** fait un fichier HTML autonome par direction dans `sortie/` (ignoré par Git) : environ 710 Ko pour A, B et C ; pour D, environ 14,5 Mo avec la capture, les deux vidéos et les sons. Il inclut les polices, les images, les sons, les styles et les scripts, et s'ouvre sous Windows sans serveur.
  - Polices : `launcher/src/renderer/fonts/`, plus Teko, reprise du HUD des points (licences dans `launcher/gamelibs/fonts/` : OFL, Apache 2.0 pour Special Elite ; Teko : OFL).
  - Images : rendu de Bunker 7 du launcher actuel, icône du jeu, portrait d'Anthony, vignette de la Lune ; pour D seulement, la capture et les vidéos des Marécages si elles sont là.
  - Sons de D : les 11 fichiers Opus de `ressources/marecages/sons/`, s'ils ont été exportés.
- **`capture.js`** fait, dans `sortie/captures/`, 8 vues par direction en 1 280 × 720 à l'échelle 1, et 4 de plus pour D : l'accueil en 1 600 × 900 et en 1 080 × 660, avec le fond de Bunker 7, et sur un éclair. Il fait aussi une planche par direction, la comparaison des trois premières et la planche « A + B → D ». Il dessine en 2D dans le Chromium sans tête de Playwright, sans WebGL ni rendu 3D (28 s).
- **`essai.js`** parcourt les scénarios en cliquant, avec le temps simulé accéléré (`?vite`) : 25 vérifications par direction, 67 pour D avec les ressources des Marécages, soit 142 en tout le 2 novembre 2026 (poignée de redimensionnement, Agrandir et retour, mises en pause du fond animé, départ de la vidéo depuis l'affiche, bascule avec ou sans éclairs en pleine lecture ; pour le son : silence au démarrage, allumage, niveau en sortie, tonnerre sur un éclair, pauses, volume, coupure), aucune erreur de page tolérée ; `--directions D` pour une seule direction. Sans les ressources (clone propre), le repli de D sur Bunker 7 est vérifié et ces contrôles sont sautés.

Pour ouvrir les maquettes sous Windows : le dossier `maquettes/launcher/sortie/` du worktree, par le chemin réseau `\\wsl.localhost\<distribution>\home\<utilisateur>\…\maquettes\launcher\sortie\`, puis double-clic sur un des quatre fichiers. Les quatre fichiers doivent rester dans le même dossier pour que les liens entre directions marchent.

## Suite

Anthony a retenu une combinaison de A et de B : la maquette D. Il l'examine et la valide ; on l'améliore ensemble ici, puis elle est intégrée au vrai launcher (`launcher/src/renderer/launcher/`), avec son accord pour chaque étape.

Les maquettes respectent déjà ces contraintes de l'intégration :
- polices et images locales ;
- aucune ressource en ligne ;
- états et actions calqués sur l'interface `window.zs` du launcher (`status`, `check`, `install`, `cancel`, `play`, `repair`, `rollback`, `updateLauncher`, `openModtools`, `openPublisher`, `open`, `setSetting`) ;
- barre de titre dessinée, la fenêtre étant sans bordure.

Fait au portage dans le launcher (2 novembre 2026, `docs/plan-integration-launcher.md` §9) : la politique de sécurité du launcher (`style-src 'self'`) interdit les styles en ligne ; les attributs `style` écrits par les maquettes passent par des classes ou par le CSSOM.
