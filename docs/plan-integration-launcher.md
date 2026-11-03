# Plan d'intégration du nouveau launcher (maquette D)

Plan préparé le 31 octobre 2026, à la demande d'Anthony (« Je valide D, prépare le plan d'intégration au launcher ») ; principe validé le même soir, procédure détaillée au §8. Portage commencé le 2 novembre 2026 à sa demande : état au §9. Chaque étape attend son accord. L'intégration finale dans `dev` et `main` revient à la cinquième session (Claude Code 5), sur son ordre.

- **Référence visuelle et fonctionnelle** : `maquettes/launcher/D-hybride/` et son socle `commun/`.
- **Fond animé** : `maquettes/launcher/ressources/marecages/README.md`.

## 1. Périmètre

| Change | Ne change pas |
|---|---|
| L'interface du launcher : `launcher/src/renderer/launcher/` (balisage, styles, script), remplacée par celle de D | Le processus principal, sauf la fenêtre et deux réglages (§3) |
| La fenêtre du launcher : 1 280 × 720, redimensionnable, agrandissable | Les mises à jour, la signature, le manifeste, l'installation, le retour à la version précédente (`updater.js`, `gamepack.js`, `publisher.js`) |
| Deux réglages : fond animé, fond de l'accueil | Les Mod Tools, la fenêtre du jeu, l'outil de publication |
| Le fond animé « Marécages maudits », après validation de la prévisualisation | L'interface `window.zs` (preload), sauf l'action de fenêtre « agrandir » (§3) |

## 2. Fichiers touchés

1. **`launcher/src/renderer/launcher/index.html`** : structure de D (barre latérale, six pages, bandeau, gestionnaire de téléchargement), sans le panneau de maquette ni les badges « Maquette » et « Exemple ».
2. **`launcher.css`** : styles de D (`D-hybride/style.css`).
   - Les rares styles en ligne de la maquette (positions d'images, largeur de la barre de progression) passent par des classes ou par le CSSOM (`element.style.setProperty`). La politique de sécurité (`style-src 'self'`) interdit les attributs `style` écrits dans le HTML.
3. **`launcher.js`** : la logique de D, branchée sur `window.zs` au lieu de la simulation `ZSM` (§4).
4. **`marais.js`** (nouveau) : la scène animée de l'accueil.
5. **`assets/`** : `bg.jpg` (Bunker 7, déjà là) et la capture des Marécages en WebP. Ce second fichier n'arrive que si Anthony accepte de montrer la carte non publiée dans un launcher distribué aux joueurs.
6. **`launcher/src/main/main.js`** :
   - fenêtre (§3) ;
   - action « agrandir » ;
   - réglages `fondAnime` et `fond`.
7. **`launcher/src/preload/launcher.js`** : rien à ajouter. `windowAction(action)` existe ; le processus principal accepte une action de plus.
8. **Essais** : `launcher/e2e/publish-online.e2e.js` à adapter (§5) ; un nouvel essai de l'interface du launcher.

## 3. Processus principal

- **Fenêtre**, dans `createLauncherWindow` :
  - `width: 1280, height: 720, minWidth: 960, minHeight: 600, resizable: true, maximizable: true`, sans cadre comme aujourd'hui ;
  - garder la dernière taille dans `settings.json`, si Anthony le souhaite.
- **Action « agrandir »** : `launcher:window` accepte `maximize`, qui bascule entre `maximize()` et `unmaximize()`. L'état est renvoyé pour l'icône du bouton.
- **Réglages** : `DEFAULT_SETTINGS` reçoit `fondAnime: true`.
  - Le fond de l'accueil n'est pas un booléen : le gestionnaire `launcher:setting`, qui n'accepte que des booléens, doit prendre aussi `fond`, avec les seules valeurs `marais` et `bunker`.
  - Autre solution : un booléen `fondMarais`.
- **Pause du fond animé** :
  - Fenêtre réduite ou masquée : la page passe en `document.hidden`. C'est déjà le cas pendant une partie quand « garder le launcher ouvert » est coupé (`launcherWin.hide()`). À vérifier sous Windows : une fenêtre réduite donne `visibilityState = 'hidden'`. Sinon, transmettre `minimize` et `restore` au rendu.
  - Le rendu arrête aussi la scène hors de l'accueil, pendant une partie (`phase === 'playing'`), sous « réduire les animations » du système et quand `fondAnime` est coupé.

## 4. De la simulation au vrai launcher

**Phases.** La maquette suit déjà les phases de `launcher.js` :

| Maquette | Vrai launcher | Remarque |
|---|---|---|
| `demarrage` | `starting` | le titre d'état est « Ouverture du jeu… » au départ (§5 ; « Ouverture du bunker… » jusqu'au 3 novembre 2026, et encore dans les maquettes, `maquettes/launcher/commun/maquette.js`) |
| `verification` | `checking` | |
| `pret` | `ready` | |
| `maj` | `update` | « Jouer à la X » reste proposé |
| `telechargement` | `downloading` | vitesse et temps restant calculés comme aujourd'hui (`trackRate`) ; courbe de débit sur les 40 dernières mesures |
| `signature`, `installation` | `installing` | une seule phase réelle, détail « vérification et extraction » |
| `redemarrage` | `restarting` | |
| `partie` | `playing` | |
| `hors-ligne` | `offline` | y compris `NOT_CONFIGURED` (« Mises à jour inactives ») |
| `erreur` | `error` | contextes `install`, `launcher`, `check` |
| `absent` | `installed` vide | « Installer », taille du paquet |

**Actions** : `play`, `install`, `cancel`, `check`, `repair`, `rollback`, `updateLauncher`, `openModtools`, `openPublisher`, `open('game' | 'logs')`, `setSetting`, `resetSource`, `windowAction`, `openExternal`. Elles existent toutes.

**Données** :
- `status.installed`, `remote`, `history` (notes publiées), `news`, `launcherUpdate`, `author`, `settings`, `source` (adresse, empreinte de la clé, source de test, adresse provisoire) ;
- les versions du jeu et du launcher.

**Actualités.** Le manifeste ne porte qu'un titre, un texte et une date. Les cartes d'actualités de D s'affichent donc :
- avec une illustration par défaut selon le mot-clé, en attendant la décision d'Anthony sur les images d'actualités ;
- ou sans image.

**Ce qui disparaît** :
- la simulation `ZSM` ;
- le panneau de maquette, les badges, les étiquettes « Exemple » ;
- les données d'exemple (`donnees.js`).

## 5. Contrats des essais de bout en bout

Les essais lisent ces éléments de la page du launcher ; ils doivent rester.

| Élément | Essais | Ce qui est attendu | Dans D |
|---|---|---|---|
| `#btn-main` | 19 | activé quand on peut jouer ; un clic lance le jeu | le bouton Jouer du bandeau prend cet identifiant |
| `#status-title` | 10 | vaut « Ouverture du jeu… » au démarrage, puis change | la ligne d'état du bandeau prend cet identifiant et ce texte de départ |
| `#btn-modtools` | 9 | visible pour l'auteur, caché pour un joueur ; un clic ouvre les Mod Tools | bouton « Mod Tools » visible sur l'accueil pour l'auteur (comme aujourd'hui dans la barre du bas) ; l'entrée de la barre latérale ouvre la page |
| `#dossier.clickable`, `#notes-more`, `#history`, `#veil` | 1 (`publish-online`) | fiche des notes cliquable, historique en fenêtre | l'historique devient une page : adapter `publish-online.e2e.js` (seul essai touché) |

Les identifiants des Mod Tools et du jeu ne changent pas.

## 6. Étapes, contrôles et accords

1. **Accord d'Anthony sur ce plan** et sur deux points :
   - le fond par défaut : Marécages maudits, montré aux joueurs avant la sortie de la carte, ou Bunker 7 jusqu'à la sortie ;
   - les images d'actualités : sans, ou par défaut.
2. **Travail dans `~/dev/zs-interface`**, branche `chantier/interface` : interface, processus principal, essai.
3. **Contrôles dans la session** :
   - `npm test` ;
   - la page du launcher chargée dans le Chromium sans tête avec un faux `window.zs`, pour les captures de chaque phase (Electron ne démarre pas dans le bac à sable) ;
   - les captures sont comparées à la maquette.
4. **Suite E2** lancée par Anthony (méthode E2), les 29 essais, avec `publish-online` adapté et le nouvel essai de l'interface.
5. **Numéro du launcher** : 1.4.0, décision d'Anthony du 2 novembre 2026 à 17 h 30 (« Change la version du launcher, elle sera finalement en 1.4.0. »), transmise par la cinquième session ; elle remplace le 2.3.4 annoncé à 17 h 27. Le jeu 2.0.7 et le launcher 1.4.0 partent dans la même publication. La cinquième session pose les numéros à l'intégration : `launcher/package.json` ne bouge pas sur cette branche. Le launcher se met à jour lui-même ; `publish-online` le contrôle (il simule un launcher 9.9.9).
6. **Commit** sur `chantier/interface` avec son accord, puis remise à la cinquième session pour l'intégration. L'installateur demande wine, absent de WSL (`CLAUDE.md` §6).

## 7. Risques et coordination

- **Chantier des cartes** : il modifie `launcher/package.json` (liste `test:e2e`) et des Mod Tools, pas l'interface du launcher. Conflit possible sur la liste des essais seulement.
- **Kit « Zombie Survival 2.0.7 - a publier (Stryges) »** sur le PC d'Anthony :
  - il prépare une autre 2.0.7 : le jeu 2.0.6, plus les Marécages maudits en développement, les Stryges, la pluie et l'orage ;
  - son message pour Claude Code demande une publication avec l'outil d'Anthony et le launcher 1.3.3 ;
  - cette 2.0.7 n'est pas celle préparée dans WSL (animations, boss de Bunker 7, interface). Le numéro et l'ordre des sorties sont à arbitrer par Anthony avant toute publication ;
  - cette session n'a rien publié et ne publiera rien.
- **Carte non publiée dans un launcher public** : la capture des Marécages serait visible de tous les joueurs. C'est un choix d'Anthony (§6, étape 1).
- **Performances** : le fond tourne à 30 images par seconde au plus, sur un canevas de la taille du bandeau, et s'arrête dès qu'il n'est plus visible. Il reste à le mesurer sur un PC modeste lors de la suite E2.

## 8. Procédure détaillée : garder toutes les fonctions actuelles

Principe d'Anthony du 31 octobre au soir : le plan est validé, mais le launcher fonctionnel n'est pas modifié avant qu'il ait vu la scène finale. Cette procédure servira à ce moment-là.

**Règle de conduite** : seule l'interface change.
- Le processus principal reçoit trois retouches : la fenêtre, l'action « agrandir », les réglages du fond.
- `updater.js`, `gamepack.js`, `publisher.js`, `github.js`, `history.js`, `workspace.js`, les préchargements et l'outil de publication ne bougent pas.

### 8.1 Fonction par fonction

| Fonction actuelle | Où elle vit (inchangé) | Ce que la nouvelle interface appelle et montre | Vérification |
|---|---|---|---|
| Recherche de mises à jour, téléchargement, annulation | `updater.js`, `main.js` (`checkForUpdates`, `install`, `cancel`) | `zs.check`, `zs.install`, `zs.cancel` ; phases `checking`, `update`, `downloading` ; bande de cartouches et débit | `updater.test.js` ; E2 `publish-online` |
| Installation, réparation, retour à la version précédente | `updater.js`, `gamepack.js` | `zs.install`, `zs.repair`, `zs.rollback` ; phase `installing` ; page Installation | `gamepack.test.js`, `updater.test.js` ; les 19 essais qui lancent le jeu par `#btn-main` |
| Vérifications : manifeste signé, SHA-256, clé de confiance | `updater.js`, `publisher.js` (`fingerprint`), `config/default.json` | source et empreinte (`8508-2046-8B30-034A`) ; erreurs (`MANIFEST_INVALID`…) en phase `error`, avec « Réessayer » et « Journal » | `updater.test.js`, `publisher.test.js`, `config.test.js` |
| Signature et publication (auteur) | `publisher.js`, `github.js`, `history.js`, fenêtre de l'outil de publication | lien « Outil de publication » (`zs.openPublisher`) dans Mod Tools et Paramètres | `github.test.js`, `history.test.js` ; E2 `publish-online` |
| Mise à jour du launcher lui-même | `main.js` (`launcherUpdate`, `updateLauncher`, `restarting`) | bandeau « Nouveau launcher », phase `restarting` | E2 `publish-online` |
| Paramètres | `reglages.js`, repris par `main.js` (`DEFAULT_SETTINGS`, `launcher:setting`) | les quatre réglages actuels, plus `fondAnime` et `fondEclairs` (booléens), `fond` (`marais` ou `bunker`) et `volumeSons` (entier de 0 à 100, 80 par défaut) ; les sons de l'ambiance : réglage de la page, coupés à chaque lancement, absents de `settings.json` (§9.1) | nouvel essai de l'interface ; relecture de `settings.json` |
| Mod Tools | `main.js` (`openModtools`, mode auteur) | `#btn-modtools` sur l'accueil pour l'auteur ; page Mod Tools | les 9 essais E2 des Mod Tools |
| Lancement du jeu, partie, retour | `main.js` (`play`, fenêtre du jeu, `keepLauncherOpen`) | `#btn-main`, phase `playing` ; fond en pause ; launcher réduit ou caché selon le réglage | les 19 essais E2 |
| Historique et notes | `status.history`, `config/notes-history.json` | page Mises à jour (chronologie) | E2 `publish-online`, adapté |
| Actualités | `manifest.news` | cartes d'actualités (titre, texte, date) | à ajouter au nouvel essai |
| Dossier du jeu, journal | `zs.open('game' \| 'logs')` | boutons de la page Installation | manuel |

### 8.2 Pas à pas

1. **État de départ**, dans `~/dev/zs-interface` (branche `chantier/interface`) :
   - reconstruction identique du jeu ;
   - `npm test` (31 sur 31, ou 30 avec l'intermittent connu) ;
   - relevé des essais E2 de référence.
2. **Interface** : remplacer le contenu de `launcher/src/renderer/launcher/` par celui de D.
   - Brancher sur `window.zs` (`status`, `onStatus`).
   - Retirer la simulation, le panneau de maquette et les badges.
   - Garder les identifiants du §5.
3. **Processus principal** : la fenêtre (1 280 × 720, au moins 960 × 600, redimensionnable), `launcher:window` + `maximize`, les réglages du fond (gestionnaire `launcher:setting`, qui n'accepte que des booléens, élargi au choix `fond` et au nombre `volumeSons`, borné de 0 à 100).
4. **Ressources** :
   - **Bunker 7** (`assets/bg.jpg`) : au choix (« Fond de l'accueil »), et en secours si la vidéo est illisible.
   - **Les Marécages** (capture, vidéo, sons) : prévus hors de Git tant qu'Anthony ne l'autorisait pas. **Publication autorisée le 2 novembre 2026** (§9.1) : vidéos, affiche et sons copiés dans `launcher/src/renderer/launcher/assets/marecages/`, versionnés et livrés ; fond par défaut.
   - **Les sons** (§8.3) : sons introuvables, l'interrupteur se désactive.
5. **Contrôles dans la session** :
   - `npm test` ;
   - la page du launcher dans le Chromium sans tête, avec un faux `window.zs` qui rejoue toutes les phases ; captures comparées à la maquette ;
   - le fond en pause dans tous les cas.
6. **Suite E2 par Anthony** (les 29 essais, `publish-online` adapté, plus le nouvel essai) ; analyse de `resume.tsv`.
7. **Retour arrière** : l'ancienne interface reste dans l'historique Git (`git checkout <commit> -- launcher/src/renderer/launcher`). Les trois retouches du processus principal sont isolées dans un commit à part.
8. **Commit avec l'accord d'Anthony**, puis remise à la cinquième session, qui pose le numéro du launcher (1.4.0) à l'intégration.

### 8.3 Sons de l'ambiance (maquette D : `ambiance.js`)

**Réglages validés par Anthony le 31 octobre 2026** (« Je valide les quatre choix et le niveau ») : à garder tels quels.
- Tonnerres de 450 m à 3,5 km, aucun éclair tout près ; 450 m seulement pour les éclairs au sol les plus forts (`choisir` dans `ambiance.js`).
- Volume de l'ambiance à 80 % par défaut, puis le compresseur du jeu en fin de chaîne.
- Image fixe : la pluie continue. Sans éclair, pas de tonnerre.
- Nappes eau, bois, feuillage et lointain ; boue et toit pas utilisées.

**Sources** : les fichiers Opus de `maquettes/launcher/ressources/marecages/sons/` et les réglages de `sons.json` (`boucle`, `echelle`, `t0`, `niveauJeu`, `medium_dB`, `envoiReverb`, `kJeu`). Ils viennent de `scene-bete/exporter-sons.js` (export autorisé par Anthony le 31 octobre 2026).
- Ce sont des ressources de la carte non publiée : ni Git ni paquet sans son accord. **Publication autorisée par Anthony le 2 novembre 2026** (§9).

**Chargement** : la politique de sécurité de la page du launcher (`default-src 'none'`, `connect-src 'none'`) interdit à la page de lire un fichier son (`fetch`, balise `<audio>`). Electron ne sert pas non plus `file://` à `fetch`.
- **Proposé, et fait le 2 novembre 2026** : le processus principal lit les `.ogg` et le préchargement les passe à la page (`zs.ambiance()` → `{ meta, fichiers: { id: ArrayBuffer } }` ; `lireAmbiance` dans `main.js`). La page les décode (`decodeAudioData`, que la politique ne bride pas). La politique ne change pas pour les sons.
- **Repli** : un script local qui contient les sons en base64, comme la maquette (`script-src 'self'` le permet). Environ 1,8 Mo de texte.

**Deux réglages du processus principal à connaître** : `autoplayPolicy: 'no-user-gesture-required'` et `backgroundThrottling: false` sont ceux des fenêtres du jeu et des Mod Tools (`play` et `openModtools` dans `main.js`). La fenêtre du launcher (`createLauncherWindow`) garde les valeurs par défaut d'Electron :
- `autoplayPolicy` vaut déjà `no-user-gesture-required` par défaut : un contexte audio jouerait sans geste. La page n'en crée donc aucun tant que « Sons de l'ambiance » est coupé ; `ambiance.js` le fait déjà.
- `backgroundThrottling` vaut `true` : une fenêtre réduite ou masquée passe en `document.hidden` (à vérifier sous Windows, §3), mais un contexte audio continue de jouer. La page doit suspendre elle-même le son : fenêtre réduite ou masquée, partie en cours (`status.phase === 'playing'`), hors de l'accueil.

**Poids** : 1,4 Mo de fichiers. Une fois les sons allumés, environ 25 Mo de mémoire pour les sons décodés ; rien tant qu'ils sont coupés. Contexte suspendu dès que le fond ne se voit plus.

**Contrôles** : les 20 vérifications du son de `essai.js` sont à reprendre dans le nouvel essai de l'interface. Elles couvrent :
- aucun contexte au démarrage ;
- l'allumage, avec 11 sons décodés ;
- le niveau en sortie ;
- le tonnerre sur un éclair ;
- les cinq pauses ;
- le volume ;
- la coupure.

### 8.4 Vidéo du fond (maquette D : `fond-video.js`)

**Source** : `fond-marais.webm` et `fond-marais-sans-eclairs.webm`, leurs affiches et la chronologie `fond-marais.json`, faits par `maquettes/launcher/scene-bete/encoder.js` (ffmpeg, VP9, depuis le 2 novembre 2026). Réglages choisis par Anthony le 2 novembre : CRF 28, fondu d'une seconde ; boucle de 7,7 s, 1 600 × 620, environ 4,5 Mo par version (9 Mo pour les deux). Ce sont des ressources de la carte non publiée : ni Git ni paquet sans l'accord d'Anthony. **Publication autorisée par Anthony le 2 novembre 2026** (§9).

**Points relevés le 2 novembre 2026, à décider ou à vérifier à l'intégration** (relecture indépendante de l'encodeur ; détail : `scene-bete/README.md`, §3 bis) :
- **Politique de sécurité** : la page du launcher déclare `default-src 'none'` sans `media-src` ; une balise `<video>` y est refusée. La maquette lit des URI `data:` sans aucune politique. Deux voies : `media-src 'self'` avec le fichier dans les ressources du launcher, ou un `blob:` fait par la page à partir d'un `ArrayBuffer` passé par le préchargement, comme les sons (`media-src blob:`). **Retenue le 2 novembre 2026 : `media-src 'self'`**, la plus simple : la vidéo est lue au fil de la lecture, sans 9 Mo de plus en mémoire ni `blob:`. Ce n'est pas la plus étroite : dans une page chargée par `loadFile` (`file://`), `'self'` admet toute adresse `file:` du poste, pas seulement les fichiers du launcher ; `media-src blob:` n'aurait admis que les blobs faits par la page. Ce choix vaut tant que la page ne lit que ses chemins fixes (`MARAIS` dans `launcher.js`, `assets/marecages/`) et n'écrit jamais dans un `src` une adresse reçue (actualités, réglages, fichier choisi) ; sinon, revoir ce choix (`blob:`, ou un protocole propre au launcher).
- **Couleurs** : mesurées dans le Chromium sans tête des essais (Chromium 141, rendu logiciel, Linux) : biais de 0,13 niveau au plus en moyenne. Le launcher tourne sur Electron 44.5.1 (Chromium 152), avec la carte graphique, sous Windows : refaire la mesure ou comparer à l'œil avec les images d'origine.
- **Affiche** : corrigé dans la maquette le 2 novembre 2026, à la demande d'Anthony (`fond-video.js`). L'affiche est F[M], l'image de l'instant M/fps ; chaque lecture qui part de l'affiche (démarrage, reprise après une pause) repart de cet instant, et l'affiche ne s'efface qu'à la première image présentée. Avant : départ à 0 s, sur une autre image (écart moyen de 8,6 niveaux, 13 % des pixels à plus de 20) ; après : l'écart d'une image à la suivante (2,1 niveaux). À reprendre tel quel à l'intégration ; `essai.js` le contrôle au démarrage et à la reprise.
- **Passage avec ou sans éclairs** : corrigé dans la maquette le 2 novembre 2026, à la demande d'Anthony (`fond-video.js`). Un lecteur par version, superposés ; celui qui n'est pas montré reste rendu mais transparent (`.en-retrait`) et à l'arrêt. En lecture, il se cale sur une image un peu à venir, avec une avance apprise selon la durée de sa recherche (la version sans éclairs n'a qu'une image clé), puis prend le relais quand le lecteur montré présente l'image juste avant. Pas d'affiche, pas d'arrêt, la boucle continue d'une image à la suivante. À l'arrêt, la bascule est immédiate, l'affiche couvrant tout. Mesuré en rendu logiciel : relais 0,3 à 3,3 s après la demande, la version d'avant jouant jusque-là ; `essai.js` contrôle quatre bascules, dont une tardive et une à cheval sur le retour au début. Pas besoin d'images clés en plus (`-g 30`). À reprendre tel quel à l'intégration.
- **Taille d'affichage** : la fenêtre agrandie sur l'écran de 3 440 × 1 440 d'Anthony montre la vidéo à × 1,96 ; le choix du CRF se juge sur des planches agrandies deux fois.
- **Coût du décodage** : à lire sur l'accueil (Gestionnaire des tâches : processeur, GPU, « Video Decode »). Le décodage VP9 matériel est probable avec sa carte NVIDIA. La pause pendant une partie est déjà prévue (§8.1).
- **Deux versions cohérentes** : les deux `.json` doivent donner les mêmes `fps`, `images`, `fondu` et `duree`, et les deux vidéos le même nombre d'images (une ligne de contrôle après l'encodage).

## 9. État du portage (2 novembre 2026)

Demande d'Anthony du 2 novembre 2026 : « Commence le portage vers Claude 5. Claude 5 me dira comment installer le launcher ensuite. » Ses réponses du même jour :
- fond par défaut pour les joueurs : Marécages maudits, la carte sortant avec le jeu 2.0.7, en même temps que le launcher ;
- actualités : illustration par défaut pour le moment ;
- vidéo et sons des Marécages en local : plus tard.

**Fait**, sur `chantier/interface`, en deux commits (les retouches du processus principal à part, §8.2, point 7), avec l'accord d'Anthony du 2 novembre 2026 (« Envoie le commit ! ») :
1. Faux `window.zs` (`launcher/e2e/faux-zs.js`) et contrôle de la page sans Electron (`launcher/e2e/page-launcher.js`). Sur l'ancienne interface, avant le portage : 96 sur 96 à 1 080 × 660, avec 12 scénarios ; le scénario « pages », ajouté ensuite, n'y fait que les 6 contrôles communs.
2. Interface de D dans `launcher/src/renderer/launcher/` (`index.html`, `launcher.css`, `launcher.js`, `assets/khamsin.svg`, `assets/ombre.svg`), avec le fond Bunker 7. Contrôle : 148 sur 148 à 1 280 × 720, 960 × 600 et 1 600 × 900 (13 scénarios, dont les pages), sans erreur de page ni refus de la politique de sécurité ; captures comparées à celles de la maquette, et à 3 440 × 1 400 (fenêtre agrandie sur l'écran d'Anthony).
3. Processus principal (`main.js`, trois retouches) :
   - fenêtre de 1 280 × 720 (ou la zone de travail), au moins 960 × 600, redimensionnable, agrandissable ;
   - état de la fenêtre envoyé à la page (`windowState`) et action `maximize` ;
   - réglage `fondAnime`.
4. Essais :
   - `test/interface.test.js` : 4 tests statiques ; `npm test` donne 35 sur 35, ou 34 avec l'intermittent connu ;
   - `publish-online.e2e.js` adapté contrôle par contrôle : toujours 30 contrôles, dont les 9 de l'historique, rejoués contre la page (9 sur 9) ;
   - nouvel essai `launcher-interface.e2e.js` (14 contrôles), à ajouter à `test:e2e` à l'intégration (le chantier des cartes modifie aussi cette liste).

**Choix faits par défaut** (Anthony peut les changer) :
- Données que le launcher n'a pas, remplacées :
  - les chiffres de la page Installation sont la version installée, sa date d'installation, la version précédente gardée et la taille du paquet en ligne ; la maquette montrait la taille installée, la construction, l'interface des Mod Tools et le chemin du dossier ;
  - les actualités n'ont ni catégories ni filtres.
- L'accueil montre les notes de la version (l'installée, ou la nouvelle à installer), au lieu du titre et du texte écrits à la main pour la 2.0.6 dans la maquette.
- Bloc « Théâtres » gardé : Bunker 7 (photo), Khamsin et Ombre éternelle (dessins du launcher, pas des images du jeu).
- Veille « Partie en cours », avec un bouton « Revenir à la partie » (`zs.play()` ramène la fenêtre du jeu).
- Taille de la fenêtre non gardée d'une ouverture à l'autre.
- Fond en pause aussi quand le launcher n'est pas au premier plan (derrière les Mod Tools ou le jeu en fenêtre).
- Largeur de la barre latérale réglée sur les captures de la maquette (246 px à 1 280). Dans la maquette, elle suivait la page du navigateur, pas la fenêtre.
- Écran de titre : une seconde au moins, 2,5 s au plus ; la bulle « Launcher mis à jour » attend sa fin.
- Pendant une partie (« Garder le launcher ouvert » coché), seul l'accueil se met en veille : la barre latérale et les autres pages restent utilisables, comme dans le launcher 1.3.3.
- Le bandeau de l'accueil grandit si les notes ou la ligne d'état ne tiennent pas (la première note tient en deux lignes au plus, texte entier en info-bulle).
- Fenêtre agrandie sur un écran large : au-delà de 1 920 px, les pages, accueil compris, et le gestionnaire de téléchargement restent centrés sur 1 660 px. L'accueil gardait d'abord toute la largeur (bandeau cinématographique) ; il est centré lui aussi depuis le 2 novembre 2026 au soir (réponse « Oui » d'Anthony, §9.1).

**Relecture indépendante avant les commits** (2 novembre 2026, six relecteurs et un contradicteur par constat) : 34 constats, 33 confirmés, tous corrigés, 1 réfuté.
- Le plus important : le texte de l'accueil était rogné par le haut avec une longue note ou une ligne d'état sur deux lignes.
- Défauts hérités de la maquette, corrigés dans le launcher seulement (la maquette reste la référence commitée) :
  - courbe du débit dessinée en 20 × 20 au lieu de 120 × 32 ;
  - pastille de la ligne d'état de l'accueil toujours grise ;
  - texte crème sur le bouton laiton « Mettre à jour » de la page Mises à jour ;
  - sceau qui masquait du texte ;
  - bulles qui captaient les clics des cartes.
- Comme dans le launcher 1.3.3 : message d'erreur, adresse de la source et empreinte de la clé sélectionnables ; espace insécable entre un nombre et son unité.
- Robustesse :
  - un double-clic ne relance pas une action ;
  - dates des actualités sans décalage de fuseau ;
  - « vérifié le … » pour un autre jour ;
  - « 0 Ko » au début d'un téléchargement ;
  - focus rendu à la fermeture d'une actualité ;
  - nombre de notifications lu par les lecteurs d'écran.
- Essais : `publish-online` contrôle de nouveau le retrait des tirets de tête (notes dépliées) ; `launcher-interface` écoute les erreurs dès le premier chargement.

**Reste** :
1. Suite E2 par Anthony (méthode E2) : les 29 essais, dont `publish-online` adapté, et `launcher-interface`.
2. Remise à la cinquième session :
   - numéro 1.4.0 (`launcher/package.json`) et ligne `test:e2e` (ajouter `launcher-interface`) ;
   - entrée « Historique » du README, à dater et à numéroter à la publication ;
   - comptes de `CLAUDE.md` (avec l'accord d'Anthony) : 7 tests unitaires de plus (`interface.test.js` 4, `reglages.test.js` 4 depuis la relecture de l'étape des Marécages : 39, ou 38 avec l'intermittent connu) et un essai E2 de plus (`launcher-interface`, 18 contrôles, §9.1) ;
   - intégration, installateur, explication de l'installation à Anthony.
3. Étape des Marécages : faite le 2 novembre 2026 au soir, avec l'autorisation d'Anthony de publier les ressources de la carte (§9.1).

### 9.1 Étape des Marécages (2 novembre 2026, au soir)

Réponses d'Anthony du 2 novembre 2026, au soir : accueil centré sur un écran large (« Oui ») ; les deux dossiers vides du harnais retirés (« Oui ») ; publication des ressources des Marécages pour le fond (« oui. Claude 6 (Marécage) finalise justement la publication de la map et la commit vers claude 5. »).

**Fait** :
- Ressources copiées par `maquettes/launcher/scene-bete/vers-launcher.py` dans `launcher/src/renderer/launcher/assets/marecages/` : les deux vidéos (4,51 et 4,46 Mo), l'affiche (81 Ko), les 11 sons que charge `ambiance.js` (1,41 Mo : 4 nappes de pluie, la réverbération, 6 tonnerres ; avec la boucle actuelle, un seul éclair dans les nuages à 4,4 km, seuls `tonnerre-nuages-3500` et `tonnerre-sol-3000` sont joués, en alternance (décision d'Anthony du 2 novembre 2026, ci-dessous) ; les 4 autres gardent la gamme validée pour une boucle aux éclairs plus proches) et leurs réglages (`sons/ambiance.json`). Soit 10,5 Mo de plus dans le dépôt et dans l'installateur.
- Fond des Marécages Maudits par défaut ; Bunker 7 au choix (réglage « Fond de l'accueil »), et à la place si la vidéo est illisible.
- `fond-video.js` et `ambiance.js` repris de la maquette, sans changer leurs réglages validés. Une correction pour le vrai launcher : la vidéo n'est pas encore chargée au démarrage ; elle est donc calée sur l'image de l'affiche, et la lecture attend la fin de ce calage (sinon l'image de 0 s pouvait passer d'abord).
- Sons : par le préchargement (§8.3). Vidéo : `media-src 'self'` (§8.4).
- Réglages : `src/main/reglages.js` (`fond`, `fondEclairs`, `volumeSons` ; une valeur de `settings.json` qui ne convient pas reprend sa valeur par défaut en mémoire, et reste dans le fichier : `aEcrire`, pour un launcher plus récent) et `test/reglages.test.js`. Les sons eux-mêmes repartent coupés à chaque lancement : réglage de la page seulement.
- Textes de la carte, confirmés par Claude 6 : « Les Marécages Maudits », l'accroche du jeu (« Rapport d'incident · Les Marécages Maudits · nuit ») et sa description. La 2.0.7 garde le tampon « en développement » dans le choix des cartes : la carte du launcher le dit aussi.
- Accueil centré sur 1 660 px au-delà de 1 920 px, comme les autres pages (`@container fenetre (min-width: 1800px)` vise `.d-page`) ; le halo de la lampe de Bunker 7 garde sa taille de 1 920 px.
- Contrôles : `npm test` 39 sur 39 ; la page avec un faux `window.zs` qui rend les vrais sons (scénarios `marais` et `maraisPannes`) : 189 sur 189 à 1 280 × 720, 960 × 600 et 1 600 × 900 ; `launcher-interface` passe à 18 contrôles (vidéo lue dans la vraie fenêtre, sons décodés, réglages enregistrés).

**À vérifier sous Windows** (suite E2 et essai d'Anthony) :
- couleurs de la vidéo dans Electron 44 ;
- coût du décodage (Gestionnaire des tâches) ;
- pause du son quand la fenêtre est réduite ;
- volume réel (régler dans Paramètres, écouter à l'accueil : hors de l'accueil, les sons sont en pause).

**Relecture indépendante de l'étape** (2 novembre 2026, six relecteurs et un contradicteur par constat) : 30 constats, 28 confirmés, 1 incertain, 1 réfuté ; tous corrigés, l'alternance des tonnerres sur la décision d'Anthony.
- Code :
  - fenêtre à l'écran mais à l'arrière-plan : la vidéo s'arrête sur l'image en cours, sans revenir à l'affiche ;
  - reprise du son revérifiée après coup (une pause pendant la reprise laissait la pluie) ;
  - bascule des éclairs pendant le chargement ;
  - préchargement de l'en-tête seulement tant que rien ne joue ;
  - Paramètres à jour après une panne de la vidéo ;
  - un seul message, en français, si les sons sont introuvables ou illisibles ;
  - valeurs d'un launcher plus récent gardées dans `settings.json` ;
  - halo de la lampe plafonné ; légende hors de la colonne du texte ;
  - curseur du volume annoncé avec son unité.
- Essais : silence vérifié une seconde après les pauses ; éclairs coupés puis rallumés comme le ferait le processus principal ; contrôles plus stricts.
- Alternance des tonnerres, décidée par Anthony le 2 novembre 2026 (« Fais cela pour le tonnerre ») : la règle « pas deux fois le même tonnerre de suite » de la maquette D faisait alterner, avec le seul éclair de la boucle, `tonnerre-nuages-3500` et `tonnerre-sol-1700`, 7,4 dB plus fort et 5,3 s plus tôt. Elle prend désormais le voisin en distance (`VOISIN` dans `ambiance.js`, launcher et maquette) : `tonnerre-sol-3000`, 2,7 dB de plus et 1,6 s plus tôt. Un coup au sol ne se remplace jamais par un plus proche : 450 m reste réservé aux éclairs au sol les plus forts (règle validée le 31 octobre).

