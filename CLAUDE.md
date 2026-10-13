# CLAUDE.md — Zombie Survival

Guide de reprise du développement. À lire en entier au début de chaque session. Le détail de chaque système se trouve dans `README.md` (sections citées plus bas) ; l'atelier du moteur est décrit dans `engine/README.md`.

## 1. Le projet

- **Le jeu.** Survie par manches contre des zombies, en vue FPS, dans le style du mode Zombies de Call of Duty. Gratuit. Auteur et seul décideur : **Anthony** (Belgique, francophone).
- **Langue.** Tout se fait **en français** : textes du jeu et du launcher, commentaires du code, README, messages de commit, échanges avec Anthony. Heures en Europe/Brussels.
- **Deux livrables.**
  - Le jeu : un seul fichier HTML, `game/zombie-survival.html` (three.js r128).
  - Le launcher Windows : `launcher/`, en Electron. Il installe le jeu hors ligne, le met à jour depuis GitHub (versions signées), publie les versions (outil réservé à l'auteur) et contient les **Mod Tools**, l'éditeur de cartes réservé à l'auteur.
- **Cartes intégrées.**
  - Bunker 7 : carte à grille.
  - Khamsin : désert égyptien de 4 × 3 km, monde ouvert, véhicules, tempêtes, boss, évasion.
  - Ombre éternelle : mine de glace en gradins sur la Lune, monde ouvert, 1/6 g, oxygène.
  - Les autres cartes viennent des Mod Tools.
- **État au 13 octobre 2026.**
  - Jeu 2.0.4, construction 1 (le khépesh de Khamsin) ; interface des Mod Tools 9 ; launcher 1.3.3.
  - Pour les joueurs (GitHub Releases), la dernière version en ligne est `v2.0.3`.
  - **Publier une version pour les joueurs est l'action d'Anthony, jamais celle de Claude.**

## 2. Où est quoi

| Chemin | Contenu |
|---|---|
| `game/zombie-survival.html` | Le jeu complet : environ 3,3 Mo et 46 500 lignes. Fichier **construit** par `engine/` ; ne pas le modifier à la main (voir §4). |
| `engine/` | Atelier du moteur. `tools/build.py` reconstruit le jeu à partir de trois éléments : le jeu 1.9.0 de l'historique git, les points d'accroche `tools/hooks*.py` et les modules `src/*.js`. On y trouve aussi les outils d'essai (`tzeval.js`, `khshot.js`, `khepshot.js`) et le fichier d'origine du khépesh (`orig/`). |
| `launcher/src/main/` | Electron, processus principal. `main.js` : fenêtres, IPC, ouverture des Mod Tools, `editorEngine`. `updater.js` : manifeste signé, installation, jeu livré (`ensureBundled`, `editorApiOf`, `gameBuildOf`). `gamepack.js` : paquet du jeu. `publisher.js` : clés et signature. `github.js` : mise en ligne. `history.js` : notes de version. `workspace.js` : atelier des cartes de l'auteur. |
| `launcher/src/modtools/` | Mod Tools, 16 fichiers. `core.js` (état, édition, annulation), `ui.js`, `tools.js`, `plan.js` (plan et vue XY), `view3d.js`, `gizmo.js` (flèches), `browser.js` (navigateurs de textures et de modèles), `thumbs.js` (vignettes), `ow-*.js` (cartes ouvertes : noyau, plan, vue, terrain, outils, panneaux), `main.js`. |
| `launcher/src/preload/`, `launcher/src/renderer/` | Ponts IPC et interfaces du launcher et de l'outil de publication. |
| `launcher/scripts/prepare-game.js` | Copie le jeu dans `launcher/game/` (version hors ligne : three.js et polices locales, `gamelibs/`). À relancer après chaque construction du jeu. |
| `launcher/config/` | `default.json` (adresse du manifeste et clé **publique**) et `notes-history.json`. |
| `launcher/test/` | Tests unitaires (`npm test`, `node --test` : 31 tests). |
| `launcher/e2e/` | 26 essais de bout en bout (Electron et Playwright, voir §5). `fake-github.js` simule GitHub pour la publication. |
| `README.md` | Documentation complète : chaque fonctionnalité, ses règles, « Où modifier », la publication et l'historique. |

**Hors du dépôt**
- **Projet claude.ai « Zombie Survival ».**
  - Il contient le document privé `claude/zombie-survival-notes.md`. On y trouve l'historique détaillé des livraisons (empreintes, envois, copies sur le PC), les échanges et décisions avec Anthony, l'état « en ligne / prêt », et le **code du digi pass**.
  - Une session rattachée au Projet le lit avec l'outil Projects (`project_read`, `project_search`).
  - **Ne plus copier le jeu dans le Projet**, pour une raison de place : la limite est de 2 millions de jetons et le jeu en prenait environ 1,7. C'est le choix d'Anthony du 13 octobre 2026.
- **PC d'Anthony.**
  - Il héberge le launcher installé, le jeu installé (`%APPDATA%\Zombie Survival`) et sa clé privée de publication.
  - Il garde aussi ses copies de livraisons dans `Téléchargements\Zombie Survival …`.
  - Accès uniquement quand la conversation est reliée à son ordinateur, par l'appli de bureau Claude. Ce lien ne sert qu'à copier des livraisons : le développement ne dépend pas du PC.

## 3. Architecture du jeu (`game/zombie-survival.html`)

Sections : chercher les marqueurs `/* ===… NN NOM ==`.

| Section | Contenu |
|---|---|
| 00 | Noyau : entrées, aléa reproductible. `GAME_VERSION`, `EDITOR_API` et `GAME_BUILD` juste avant la section 01. |
| 01 Données | Armes (`WEAPONS`), paliers du Glas, atouts (`PERKS`), types de zombies, règles (`RULES`), rang. Cartes : `normalizeMap`, `validateMap`, `analyzeMap`, `serializeMap`, niveaux et escaliers ; Bunker 7 (`BUNKER7`). |
| 02 Audio | `Sound`, tout synthétisé. Bus des effets : `Sound.bus()`. |
| 03 Textures | Générées au démarrage, plus la bibliothèque. |
| 04 Monde | Grille de cases de 1 m par niveau, collisions, `raycast` et `sightClear`, champ de flux, géométrie, lumières. |
| 05 Modèles | Armes, grenade, bibliothèque d'objets, abords, zombies (Fantassin et variantes), écran Modèles, `.glb`, Le Glas, Le Molosse. |
| 06 Effets | Particules, sang, éclats. |
| 07 Joueur | `player`. |
| 08 Armes et vue FPS | `Arms`, bras et mains articulés, rechargements, boisson d'atout, grenade. Corps-à-corps : `startKnife`, puis `meleeMod` (le couteau « Fossoyeur » `creerCouteauMelee`, ou le khépesh dans le désert). |
| 09 Zombies | IA, animations, morts et corps physique, chiens : `damageZombie`, `killZombie`, `spawnZombie`. |
| 10 Carte | Éléments de jeu : achats muraux, boîte, atouts, courant, Le Glas, digi pass… |
| 11 Partie | `G`, HUD, statistiques (`Life`), rang (`Rank`), menus. En fin de section : catalogue des cartes, boucle (`frame`, `update`, `render`), `window.ZS` (interface des Mod Tools), `window.__zs` (outils de test). |
| 12 Monde ouvert | Module de `engine/src`, inséré avant « Catalogue des cartes ». Objets `OW` et `KH`, deux mondes (`OW_WORLDS`). Bases : `OW_BASES` (`khamsin`, `desert` → monde « khamsin » ; `ombre`, `lune` → monde « lune »). Chargement : `owLoad`. Puis Khamsin : véhicules, tempêtes, ennemis, sanctuaire, pyramides, Gardien, quête, menu. |
| 13 La Lune | Ombre éternelle. |
| 14 Tailles | Tailles réglables et décor des lieux. |
| Fin du module | Bibliothèques de textures et de modèles (identifiants `gx_…` et `gm_…`, **jamais renommés**), puis le khépesh (`creerKhepesh`, `KHEPESH`, `buildKhepesh`). |

**Règles du moteur à connaître**
- **Couleurs.** three r128 n'a pas de gestion des couleurs. Le rendu se fait en sRGB, avec ACES. Toute couleur donnée en sRGB doit être convertie en linéaire (`linearize`, `setLin`, `convertSRGBToLinear`), sinon elle sort 2 à 3 fois trop claire. Cela vaut aussi pour un module importé (voir le couteau et le khépesh).
- **Monde ouvert.** Quand `OW.on` est vrai, les fonctions de la grille (sol, collisions, rayons, flux, apparitions) passent la main au monde ouvert. `CUR.editor` vaut vrai dans les Mod Tools.
- **Versions.**
  - `GAME_VERSION` : le numéro publié.
  - `EDITOR_API` : l'interface `window.ZS` utilisée par les Mod Tools. Les Mod Tools testent `ZS.editorApi >= n` ; l'augmenter quand l'interface change.
  - `GAME_BUILD` : la construction à numéro et interface égaux. L'augmenter quand on refait un jeu sans changer son numéro.
  - Le launcher remplace le jeu installé par celui qu'il livre selon (numéro, interface, construction) ; les Mod Tools choisissent leur moteur dans le même ordre.
- **Carte qui utilise une bibliothèque.** Une carte qui utilise des textures `gx_` ou des modèles `gm_` demande le jeu 2.0.4 ou plus récent.

**Où modifier**
Le README a une section par système, avec ses noms de fonctions : Cartes, Khamsin, Ombre éternelle, Étages et escaliers, Atouts, Le Glas, Statistiques, Modèles, Manches de chiens, Animations des zombies, Armes et rechargements, Grenade, Couteau, Khépesh, Rang, Digi pass, Abords, Mod Tools (et ses sous-sections), Launcher, Publier. Les notes privées du Projet contiennent en plus un tableau « Où modifier quoi » plus détaillé.

## 4. Méthode de travail

**Modifier le jeu**
1. **Vérification de départ.** Lancer `python3 engine/tools/build.py --out /tmp/zs.html`, puis `cmp /tmp/zs.html game/zombie-survival.html`. S'ils diffèrent, quelqu'un a modifié le HTML hors de l'atelier : reporter ces changements dans `engine/` d'abord.
2. **Modifier dans `engine/`.**
   - Un nouveau système ou un système du monde ouvert va dans un module de `engine/src/`. L'ordre alphabétique des fichiers est l'ordre d'insertion.
   - Un changement dans le code du jeu 1.9.0 (sections 00 à 11) passe par un point d'accroche, dans un fichier `engine/tools/hooks-<sujet>.py` exécuté par `build.py`. On utilise `rep(ancien, nouveau)` ; le texte doit être trouvé exactement une fois.
3. **Construire.** Lancer `python3 engine/tools/build.py`, puis `python3 engine/tools/dupcheck.py game/zombie-survival.html`, puis `cd launcher && node scripts/prepare-game.js`.
4. **Vérifier vite.** `node engine/tools/tzeval.js corps.js` exécute du code dans le jeu, au menu. Il sert aux mesures, aux contrôles et aux simulations avec `__zs.step`. Les images se font avec `khshot.js` ou `khepshot.js`.
5. **Écrire ou adapter un essai** dans `launcher/e2e/`, et l'ajouter à `test:e2e` dans `launcher/package.json`.
6. **Documenter.** Mettre à jour le README (section du système, « Où modifier », « Historique ») et ce fichier si une règle change.
7. **Commiter** sur `main`, en français, avec un message détaillé : ce qui change, pourquoi, et ce qui est signalé à Anthony. Ajouter à la fin les lignes d'attribution données par la session.

**Numéros**
- Un nouveau contenu prend un nouveau numéro de jeu, choisi avec Anthony.
- Si on refait sous le même numéro, augmenter `GAME_BUILD`, ou `EDITOR_API` si l'interface change. Sinon, un launcher qui a déjà ce numéro ne remplace pas le jeu.
- Le numéro du launcher est dans `launcher/package.json`.

**Intégrer un module fait par Anthony dans une page à part** (cas du couteau et du khépesh)
- Garder le fichier tel quel dans `engine/orig/` et le transformer par un script qui contrôle l'empreinte. On ne fait que les changements d'intégration :
  - en faire une fonction du script ;
  - son dans `Sound.bus()` ;
  - couleurs converties en linéaire ;
  - pas d'écoute du clavier ;
  - pas de secousse de caméra ni de coup de zoom (Anthony a le vertige).
- Le module dessine et joue ; le jeu choisit les cibles et applique ses règles : `damageZombie`, points, murs (`sightClear`), étages.
- Signaler à Anthony chaque écart avec le fichier.

## 5. Essais

- **Tests unitaires** : `cd launcher && npm test` (31 tests).
- **Essais de bout en bout** : `cd launcher && xvfb-run -a node e2e/<nom>.e2e.js`, **un par un**, sans autre rendu lourd à côté (pas de construction de l'installateur pendant ce temps).
  - Suite complète : `npm run test:e2e`.
  - Le 13 octobre 2026 : 26 essais, 914 vérifications, environ 1 h 45 en rendu logiciel. Le plus long est `modtools-biblio` (23 min) ; les plus courts sont `publish-online` (40 s) et la plupart des essais du jeu (1 à 3 min).
  - Les 26 essais : `modtools`, `game-menu`, `publish-online`, `stairs`, `rank`, `perk-drink`, `outskirts`, `zone-zombies`, `glas`, `elixirs`, `zombie-anims`, `weapons`, `dogs`, `grenade`, `knife`, `khamsin`, `khepesh`, `modtools-khamsin`, `modtools-desert`, `ombre`, `modtools-ombre`, `modtools-sizes`, `modtools-decor`, `modtools-surfaces`, `modtools-pyramides`, `modtools-biblio`.
- **Rendu logiciel sous Linux** (SwiftShader : `--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu-watchdog`). Points à connaître :
  - une image toutes les 2 à 6 s ;
  - `requestAnimationFrame` est affamé pendant que les vignettes se font : attendre des images, interroger la page toutes les 250 ms ;
  - la première compilation d'un shader à reflets cubeUV (le bronze du khépesh) prend environ 23 s, une seule fois. Rien de tel sur une vraie carte graphique.
- Les essais des Mod Tools utilisent une clé de test jetable, jamais celle d'Anthony.

## 6. Livrer à Anthony

1. **Installateur.** `cd launcher && npm run dist:win` (sous Linux, avec wine) produit `launcher/dist/Zombie-Survival-Setup-<version>.exe`, d'environ 104 Mo. Vérifier dans `dist/win-unpacked/resources/game-bundle/` que le jeu livré est le bon.
2. **Envoi dans la conversation** (limite de 30 Mio par fichier).
   - Créer un **nouveau dossier unique** sous `/mnt/user-data/outputs/`. Ne jamais réutiliser un ancien chemin ; noter le nom réel du dossier.
   - Y mettre les morceaux de 29 000 000 octets (`split -b 29000000 -d -a 1`) et `recoller-installateur.bat` (fins de ligne CRLF, texte ASCII). Ce script recolle par `copy /b` et affiche l'empreinte SHA-256 attendue.
   - Joindre `zombie-survival.html` si utile.
3. **Copie sur le PC** quand il est relié : dossier `Téléchargements`, par `device_commit_files` (100 Mo au plus par appel). **Relire les empreintes SHA-256** de chaque copie.
4. **Fin de livraison.**
   - Dire à Anthony comment installer (recoller, fermer le launcher, lancer l'installateur par-dessus) et comment vérifier : la ligne du journal du launcher et ce qu'il doit voir en jeu.
   - Rappeler que la publication pour les joueurs passe par l'outil de publication, et qu'elle est **son** action.
5. **Notes privées du Projet.** Mettre à jour l'état, les empreintes et les décisions. Pour envoyer un fichier local avec `project_write` (`local_path`), il doit être dans le dossier de travail : le copier dans `.upload-tmp/`, l'envoyer, relire par empreinte, puis supprimer `.upload-tmp/`.

## 7. Règles impératives (sécurité)

- **Clé privée de signature.** Elle ne doit **jamais** entrer dans le dépôt, un fichier ou un message (`.gitignore` bloque `*.pem`, `*.key`, `*.p12`, `*.pfx`). Ne pas lire `%APPDATA%\Zombie Survival\publisher`.
- **Jeton GitHub.** Seul Anthony le colle, et seulement dans le launcher. Jamais dans la conversation ; ne jamais le taper soi-même ; ne pas regarder l'écran après « Generate token ».
- **Code du digi pass.** Il ne doit **jamais** apparaître en clair dans ce dépôt public (README, code, essais, ce fichier). Il est dans les notes privées.
- **E-mail d'Anthony.** Il sert uniquement à l'attribution.
- **Ordinateur d'Anthony.** Ne pas taper dans un terminal de son ordinateur par contrôle de l'écran.
- **Dépôt public.** Ne pas y publier les planches et PDF d'Anthony, ni ses données personnelles.

## 8. Pièges déjà rencontrés

- `npx asar extract-file` lancé dans le dossier du dépôt a écrasé `launcher/package.json`. Toujours extraire ailleurs.
- **Heredoc du shell.** Un heredoc sans guillemets remplace les accents graves dans du code Python ou JS : utiliser `<<'EOF'`.
- **Tailles du jeu.** Le jeu fait 46 500 lignes. Lire par plages et chercher avec `grep -n` : ne pas le lire en entier.
- **Bibliothèques.** Les identifiants de la bibliothèque doivent être en minuscules (`/^gx_[a-z0-9_]+$/`, `/^gm_[a-z0-9_]+$/`) : le moteur signale les autres dans la console.
- **Corps-à-corps.** Le couteau et le khépesh ne tapent ni à travers les murs ni d'un étage à l'autre ; les règles sont celles du jeu (`knifeReach`, `khepeshCan`).
- **Place du Projet claude.ai.** La limite est de 2 millions de jetons. N'y mettre que des notes, jamais le jeu ni des données en base64.

## 9. Décisions et travaux en attente

- **Khépesh (jeu 2.0.4, construction 1).**
  - Il sert d'arme de corps-à-corps dans tout le désert : Khamsin, ses copies, le Désert vierge (`khepeshOn`). Partout ailleurs, c'est le couteau.
  - Ses flaques gardent la couleur du fichier (presque noires) ; Anthony peut demander de les éclaircir.
  - **À faire à la prochaine version du jeu.**
    - Retirer `engine/src/P2-khepesh-reflets.js` et l'option `envMap: khepeshEnv()` dans `buildKhepesh`. Le module recalcule alors ses reflets, au pixel près. L'image ne fait gagner que 1 à 2 s en rendu logiciel, pour 230 Ko de plus.
    - Corriger les commentaires et le README qui parlaient d'un gain de 25 s.
- **Numéros refaits.** Plusieurs jeux ont été refaits sous le même numéro (2.0.0, 2.0.3, 2.0.4) ; le launcher départage par interface puis par construction.
- **Historique.** `README.md` « Historique », `git log` (messages détaillés) et les notes privées du Projet.

## 10. Reprendre le travail (liste)

1. `git pull`, puis lire ce fichier et la section du README qui concerne la demande.
2. Si la session est rattachée au Projet : lire les notes privées (`project_read claude/zombie-survival-notes.md` : état au dernier jour, décisions en cours).
3. `cd launcher && npm install` (si `node_modules` manque), puis `node scripts/prepare-game.js`.
4. Faire la vérification de départ de l'atelier (§4.1), puis lancer les tests unitaires.
5. Pour une demande d'Anthony : commencer tout de suite si elle est claire. Ne poser une question que si une mauvaise supposition coûterait cher : gros chantier, ambiguïté, décision irréversible.
6. Avant de livrer : faire la suite des essais concernés (toute la suite si le cœur change), le README, les notes, le commit, l'installateur, l'envoi et la vérification des empreintes.
