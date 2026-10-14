# CLAUDE.md — Zombie Survival

Guide de reprise du développement. À lire en entier au début de chaque session, puis `docs/transmission.md` (préférences d'Anthony, décisions et leurs raisons, demandes en attente, écarts connus, leçons), puis le document privé de reprise désigné par `CLAUDE.local.md` (hors du dépôt : environnement, protections locales, état vérifié, problèmes connus). Le détail de chaque système se trouve dans `README.md` (sections citées plus bas) ; l'atelier du moteur est décrit dans `engine/README.md`.

## 1. Le projet

- **Le jeu.** Survie par manches contre des zombies, en vue FPS, dans le style du mode Zombies de Call of Duty. Gratuit. Auteur et seul décideur : **Anthony** (Belgique, francophone).
- **Langue.** Tout se fait **en français** : textes du jeu et du launcher, commentaires du code, README, messages de commit, échanges avec Anthony. Heures en Europe/Brussels.
- **Façon de répondre à Anthony** (détail dans `docs/transmission.md` §2) :
  - direct, sans préambule, sans remplissage ni flatterie ;
  - dire clairement quand il se trompe, corriger une prémisse fausse ;
  - donner un niveau de confiance quand c'est incertain ;
  - finir par des actions précises et la façon de vérifier ;
  - jamais la tournure « ce n'est pas X, c'est Y ».
- **Deux livrables.**
  - Le jeu : un seul fichier HTML, `game/zombie-survival.html` (three.js r128).
  - Le launcher Windows : `launcher/`, en Electron. Il installe le jeu hors ligne, le met à jour depuis GitHub (versions signées), publie les versions (outil réservé à l'auteur) et contient les **Mod Tools**, l'éditeur de cartes réservé à l'auteur.
- **Cartes intégrées.**
  - Bunker 7 : carte à grille.
  - Khamsin : désert égyptien de 4 × 3 km, monde ouvert, véhicules, tempêtes, boss, évasion.
  - Ombre éternelle : mine de glace en gradins sur la Lune, monde ouvert, 1/6 g, oxygène.
  - Les autres cartes viennent des Mod Tools.
- **Environnement de développement (depuis le 14 octobre 2026).** Claude Code dans Ubuntu 24.04 (WSL2), sur le PC d'Anthony, ouvert depuis l'appli de bureau Claude. Le bac à sable de Claude Code est actif. L'ancienne conversation claude.ai et son Projet sont des archives.
- **État au 14 octobre 2026.**
  - Jeu 2.0.4, construction 2 (le khépesh sur Khamsin seulement) ; interface des Mod Tools 9 ; launcher 1.3.3.
  - Pour les joueurs (GitHub Releases), la dernière version en ligne est `v2.0.4`, construction 1, publiée par Anthony le 13 octobre 2026 à 19 h 35. La construction 2 ne change rien pour eux (le Désert vierge n'est pas dans leur menu) ; elle partira avec la prochaine version du jeu.
  - Migration vers WSL terminée le 14 octobre 2026 : reconstruction identique du jeu, tests unitaires 30 sur 31 (§5), 918 vérifications de bout en bout sur 918.
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
| `docs/transmission.md` | Transmission du 13 octobre 2026 : préférences et règles d'Anthony, décisions et leurs raisons, demandes en attente (Marteau gravitationnel, carte du marécage…), écarts entre ses planches et le jeu, leçons, questions ouvertes. Public : jamais de secret dedans. |

**Clones locaux (WSL) et branches**
- `~/dev/zs-verif` : l'atelier (`origin` = le clone de référence). On y travaille sur la branche `dev` : modifications, constructions, `npm ci`, tests, essais, installateur.
- `~/dev/Zombie-Survival` : le clone de référence, sur `main`. Il ne reçoit que des modifications essayées et validées par Anthony ; on n'y modifie rien à la main.
- `main` reste stable : c'est le dernier état validé, d'où partent les installateurs et les publications.
- L'envoi vers GitHub est désactivé dans les deux clones jusqu'à ce qu'Anthony crée une identification (jeton ou clé, saisis par lui seul).

**Hors du dépôt**
- **Dossier privé de reprise** (dans WSL, désigné par `CLAUDE.local.md`, jamais versionné) : document de reprise (environnement, protections locales, état vérifié, problèmes connus, contradictions), notes privées détaillées (historique des livraisons, empreintes, échanges et décisions), scripts privés (garde Git, essais de bout en bout, sauvegarde chiffrée). Il est sauvegardé chiffré hors de WSL.
- **Projet claude.ai « Zombie Survival »** : archive. Son document `claude/zombie-survival-notes.md` reste la référence historique ; c'est le seul document qui contient le **code du digi pass**. La copie du jeu qu'il contient (construction 1) est redondante avec l'historique Git : son retrait est décidé (choix d'Anthony du 13 octobre 2026, pour la place) et c'est son action.
- **PC d'Anthony (Windows)** : launcher et jeu installés (`%APPDATA%\Zombie Survival`), clé privée de publication, copies de livraisons dans `Téléchargements\Zombie Survival …`. Claude Code n'écrit jamais dans le jeu ni dans le launcher installés et ne lit jamais leur dossier `publisher`.

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
Le README a une section par système, avec ses noms de fonctions : Cartes, Khamsin, Ombre éternelle, Étages et escaliers, Atouts, Le Glas, Statistiques, Modèles, Manches de chiens, Animations des zombies, Armes et rechargements, Grenade, Couteau, Khépesh, Rang, Digi pass, Abords, Mod Tools (et ses sous-sections), Launcher, Publier. Les notes privées contiennent en plus un tableau « Où modifier quoi » plus détaillé.

## 4. Méthode de travail

**Règle générale.** Accord explicite d'Anthony avant toute installation (y compris `npm ci`), modification importante, commit, envoi, publication ou suppression ; rapport avant chaque étape importante. Aucune mécanique du jeu modifiée sans son accord.

**Modifier le jeu** (dans `~/dev/zs-verif`, sur la branche `dev`)
1. **Vérification de départ.** Lancer `python3 engine/tools/build.py --out /tmp/zs.html`, puis `cmp /tmp/zs.html game/zombie-survival.html`. S'ils diffèrent, quelqu'un a modifié le HTML hors de l'atelier : reporter ces changements dans `engine/` d'abord.
2. **Modifier dans `engine/`.**
   - Un nouveau système ou un système du monde ouvert va dans un module de `engine/src/`. L'ordre alphabétique des fichiers est l'ordre d'insertion.
   - Un changement dans le code du jeu 1.9.0 (sections 00 à 11) passe par un point d'accroche, dans un fichier `engine/tools/hooks-<sujet>.py` exécuté par `build.py`. On utilise `rep(ancien, nouveau)` ; le texte doit être trouvé exactement une fois.
3. **Construire.** Lancer `python3 engine/tools/build.py`, puis `python3 engine/tools/dupcheck.py game/zombie-survival.html`, puis `cd launcher && node scripts/prepare-game.js`.
4. **Vérifier vite.** `node engine/tools/tzeval.js corps.js` exécute du code dans le jeu, au menu. Il sert aux mesures, aux contrôles et aux simulations avec `__zs.step`. Les images se font avec `khshot.js` ou `khepshot.js` (`ZS_CHROMIUM` désigne le Chromium de Playwright). Ces outils lancent Chromium : à vérifier dans le bac à sable (§5) avant d'en dépendre.
5. **Écrire ou adapter un essai** dans `launcher/e2e/`, et l'ajouter à `test:e2e` dans `launcher/package.json`. Anthony le lance avec la méthode E2 (§5).
6. **Documenter.** Mettre à jour le README (section du système, « Où modifier », « Historique ») et ce fichier si une règle change.
7. **Commiter** sur `dev`, dans `~/dev/zs-verif`, **avec l'accord d'Anthony**, en français, avec un message détaillé : ce qui change, pourquoi, et ce qui est signalé à Anthony. Ajouter à la fin les lignes d'attribution données par la session. La garde Git locale contrôle chaque commit (secrets, fichiers privés) ; ne jamais la contourner. Tant que l'envoi est désactivé, les commits restent locaux.

**Intégrer dans `main`** (après les essais de bout en bout et l'accord d'Anthony)
1. Dans le clone de référence, resté sur `main` : `git fetch ~/dev/zs-verif dev:dev` (copie la branche, sans toucher `main`).
2. `git merge --ff-only dev` : `main` avance jusqu'à `dev`, sans commit de fusion. Si l'avance simple est impossible, s'arrêter et en parler à Anthony.
3. Dans `~/dev/zs-verif` : `git fetch origin`, puis, avant de construire un installateur, mettre `main` à jour (`git switch main`, `git merge --ff-only origin/main`).
4. Refaire la sauvegarde du dépôt (document privé de reprise). Envoyer `main` sur GitHub quand l'envoi sera rétabli.
- Les protections interdisent d'écrire `.git/config` : pas de branche suivie (`--track`, `branch -u`) ; toujours nommer la branche (`origin/main`, `dev:dev`). Git affiche alors « error: could not write config file » puis prétend avoir réglé le suivi : rien n'a été écrit.
- Un gros chantier peut avoir sa propre branche, `chantier/<sujet>` (par exemple `chantier/marteau`), créée depuis `dev` et ramenée dans `dev` avant l'intégration. Git refuse `dev/<sujet>` à côté de `dev`.

**Numéros**
- Un nouveau contenu prend un nouveau numéro de jeu, choisi avec Anthony.
- Si on refait sous le même numéro, augmenter `GAME_BUILD`, ou `EDITOR_API` si l'interface change. Sinon, un launcher qui a déjà ce numéro ne remplace pas le jeu.
- Un numéro déjà publié ne repart pas chez les joueurs : leur launcher n'installe qu'un numéro plus grand que le sien (`remoteIsNewer`). Un jeu refait sous ce numéro ne sert qu'au launcher d'Anthony et aux nouveaux installateurs. Anthony publie parfois dans les minutes qui suivent une livraison (2.0.4 : installée à 19 h 32, publiée à 19 h 35) : ne livrer que du travail essayé.
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

- **Tests unitaires** : `cd launcher && npm test` dans `~/dev/zs-verif` (31 tests). Dans WSL, `workspace.test.js` échoue (collision d'horodatages des sauvegardes des Mod Tools, problème connu non corrigé) : 30 sur 31 attendu.
- **Essais de bout en bout** : 26 essais, 918 vérifications (14 octobre 2026), environ 39 minutes dans WSL. Le plus long est `modtools-biblio` (14 min) ; le plus court `publish-online` (15 s).
  - Les 26 essais : `modtools`, `game-menu`, `publish-online`, `stairs`, `rank`, `perk-drink`, `outskirts`, `zone-zombies`, `glas`, `elixirs`, `zombie-anims`, `weapons`, `dogs`, `grenade`, `knife`, `khamsin`, `khepesh`, `modtools-khamsin`, `modtools-desert`, `ombre`, `modtools-ombre`, `modtools-sizes`, `modtools-decor`, `modtools-surfaces`, `modtools-pyramides`, `modtools-biblio`.
  - **Ils ne tournent pas dans une session Claude Code** : le bac à sable interdit les sockets Unix, et Electron s'arrête au démarrage. Ne jamais les relancer hors du bac à sable.
  - **Méthode E2** : Claude prépare dans `~/dev/zs-verif` (construction, `prepare-game.js`) ; Anthony lance les essais dans un terminal Ubuntu séparé avec le script privé indiqué dans `CLAUDE.local.md`, qui confine chaque essai (système en lecture seule, dossier personnel et disques Windows masqués) ; Claude analyse ensuite `resume.tsv` et les journaux.
  - Un par un, sans autre rendu lourd à côté. `modtools-khamsin` échoue parfois sur « atout posé au clic en 3D » (2 fois sur 8) : relancer cet essai seul.
  - 16 essais lancent le vrai launcher, qui lit le manifeste en ligne au démarrage : si une version plus récente est publiée, ils la téléchargent et l'essaient à la place de celle du clone. Vérifier la version en ligne avant une suite complète.
- **Rendu logiciel sous Linux** (SwiftShader : `--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu-watchdog`). Points à connaître :
  - une image toutes les 2 à 6 s ;
  - `requestAnimationFrame` est affamé pendant que les vignettes se font : attendre des images, interroger la page toutes les 250 ms ;
  - la première compilation d'un shader à reflets cubeUV (le bronze du khépesh) prend environ 23 s, une seule fois. Rien de tel sur une vraie carte graphique.
- Les essais des Mod Tools utilisent une clé de test jetable, jamais celle d'Anthony.

## 6. Livrer à Anthony

La méthode de l'ancien environnement claude.ai (envoi en morceaux dans la conversation, copie par `device_commit_files`) ne s'applique plus. Dans WSL, elle reste à établir à la première livraison :
1. **Installateur.** `cd launcher && npm run dist:win` dans `~/dev/zs-verif`, sur `main` (dernier état validé), produit `launcher/dist/Zombie-Survival-Setup-<version>.exe`, d'environ 104 Mo. Il demande wine, absent de WSL au 14 octobre 2026 (installation : accord d'Anthony). Vérifier dans `dist/win-unpacked/resources/game-bundle/` que le jeu livré est le bon.
2. **Remise.** Claude n'écrit pas sur les disques Windows (bac à sable). Anthony récupère l'installateur depuis Windows dans le dossier `launcher/dist/` du clone de vérification (chemin réseau `\\wsl.localhost\…`) et contrôle son empreinte SHA-256 (PowerShell : `Get-FileHash`), donnée par Claude.
3. **Fin de livraison.**
   - Dire à Anthony comment installer (fermer le launcher, lancer l'installateur par-dessus) et comment vérifier : la ligne du journal du launcher et ce qu'il doit voir en jeu.
   - Rappeler que la publication pour les joueurs passe par l'outil de publication, et qu'elle est **son** action.
4. **Notes privées.** Mettre à jour l'état, les empreintes et les décisions dans les notes du dossier privé de reprise (plus dans le Projet claude.ai, devenu archive).

## 7. Règles impératives (sécurité)

- **Clé privée de signature.** Elle ne doit **jamais** entrer dans le dépôt, un fichier ou un message (`.gitignore` bloque `*.pem`, `*.key`, `*.p12`, `*.pfx`). Ne pas lire `%APPDATA%\Zombie Survival\publisher`.
- **Jeton GitHub.** Seul Anthony le colle, et seulement dans le launcher. Jamais dans la conversation ; ne jamais le taper soi-même ; ne pas regarder l'écran après « Generate token ».
- **Code du digi pass.** Il ne doit **jamais** apparaître en clair dans ce dépôt public (README, code, essais, ce fichier), ni dans le dossier privé de reprise, un journal ou la conversation. Il se trouve seulement dans les notes du Projet claude.ai (archive). Pour un essai : un code fictif.
- **E-mail d'Anthony.** Il sert uniquement à l'attribution.
- **Ordinateur d'Anthony.** Ne pas taper dans un terminal de son ordinateur par contrôle de l'écran. Ne jamais modifier le jeu ni le launcher installés.
- **Protections locales.** Garde Git, règles de Claude Code (refus et demandes d'autorisation), bac à sable : ne jamais les modifier, désactiver ni contourner sans l'autorisation explicite d'Anthony. Si une protection gêne, lui présenter le problème et proposer une exception limitée. Les essayer seulement sur des fichiers fictifs.
- **Dépôt public.** Ne pas y publier les planches et PDF d'Anthony, ses données personnelles, ni le contenu du dossier privé de reprise.
- **Suppressions.** Aucune suppression de ses fichiers ni des documents du Projet sans son accord explicite, donné pour cette suppression (13 octobre 2026 : « Ne supprime aucun fichier avant […] d'avoir obtenu mon autorisation »).

## 8. Pièges déjà rencontrés

- `npx asar extract-file` lancé dans le dossier du dépôt a écrasé `launcher/package.json`. Toujours extraire ailleurs.
- **Heredoc du shell.** Un heredoc sans guillemets remplace les accents graves dans du code Python ou JS : utiliser `<<'EOF'`.
- **Tailles du jeu.** Le jeu fait 46 500 lignes. Lire par plages et chercher avec `grep -n` : ne pas le lire en entier.
- **Bibliothèques.** Les identifiants de la bibliothèque doivent être en minuscules (`/^gx_[a-z0-9_]+$/`, `/^gm_[a-z0-9_]+$/`) : le moteur signale les autres dans la console.
- **Corps-à-corps.** Le couteau et le khépesh ne tapent ni à travers les murs ni d'un étage à l'autre ; les règles sont celles du jeu (`knifeReach`, `khepeshCan`).
- **`npm install`** peut réécrire `package-lock.json` : utiliser `npm ci`.
- **Bac à sable.**
  - Pas de socket Unix : Electron, D-Bus et X11 ne démarrent pas dans une session (§5).
  - Pendant une session, `git status` du dossier de travail montre des fichiers non suivis (`.bashrc`, `.mcp.json`, `.claude/`…) : ce sont des montages du bac à sable, rien sur le disque. Ne jamais faire `git add -A` ni `git add .`.
  - Écriture permise seulement dans le dossier de travail, le clone de vérification, ses journaux et `/tmp` ; les fichiers de configuration (Claude Code, Git, `CLAUDE.local.md`) restent protégés.
- **Commandes de lecture soumises à autorisation.** `git tag` et `git remote -v` demandent l'accord ; préférer `git for-each-ref refs/tags` et `git config --get-regexp '^remote\.'`. La lecture de `core.hooksPath` par `git config` est refusée : utiliser `git rev-parse --git-path hooks`.
- **Instructions dans les dossiers.** Un `CLAUDE.md` ou `CLAUDE.local.md` est lu comme des instructions dès que Claude travaille dans son dossier, sous-dossiers compris.
- **Mémoire des conversations.** Une longue conversation est condensée et le détail des échanges se perd. Écrire chaque décision d'Anthony le jour même : dans les notes privées, et dans le README ou ce fichier si elle peut être publique.

## 9. Décisions et travaux en attente

- **Khépesh (jeu 2.0.4, construction 2).**
  - Il sert d'arme de corps-à-corps sur Khamsin et sur les cartes faites à partir d'elle dans les Mod Tools (base « khamsin » : `khepeshOn`, `OW.baseId`). Partout ailleurs, Désert vierge compris, c'est le couteau. Décision d'Anthony du 13 octobre 2026, 23 h 39 ; la construction 1 le donnait aussi au Désert vierge.
  - Ses flaques gardent la couleur du fichier, presque noire : décision d'Anthony (13 octobre, 23 h 39).
  - **À faire à la prochaine version du jeu.**
    - Retirer `engine/src/P2-khepesh-reflets.js` et l'option `envMap: khepeshEnv()` dans `buildKhepesh`. Le module recalcule alors ses reflets, au pixel près. L'image ne fait gagner que 1 à 2 s en rendu logiciel, pour 230 Ko de plus.
    - Corriger les commentaires et le README qui parlaient d'un gain de 25 s.
- **Projet claude.ai.** Le retrait de la copie du jeu (`claude/zombie-survival.html`) est décidé et sans risque (construction 1 dans l'historique Git) : c'est l'action d'Anthony. Le document des notes reste.
- **Marteau gravitationnel (Lune) et carte du marécage** : toujours prévus (Anthony, 13 octobre, 23 h 39). Rien n'est commencé.
- **Demandes en attente et écarts connus** : `docs/transmission.md` §5 et §6. On y trouve le Marteau gravitationnel, la carte du marécage, le bogue du halo de Vif-Argent, le faisceau coupé pendant la tempête, etc. Ne rien corriger sans la demande d'Anthony.
- **Environnement WSL, à décider par Anthony** : identification GitHub pour rétablir l'envoi ; création de la branche `dev` dans `~/dev/zs-verif` (§4, avec son accord) ; installation de wine pour l'installateur (§6) ; corrections proposées (horodatages des Mod Tools, `ZS_CHROMIUM` dans 5 essais, `.gitattributes`, adresse locale pour les 16 essais qui lisent le manifeste en ligne) ; sort de la branche `editeur-cartes`.
- **Numéros refaits.** Plusieurs jeux ont été refaits sous le même numéro (2.0.0, 2.0.3, 2.0.4) ; le launcher départage par interface puis par construction.
- **Historique.** `README.md` « Historique », `git log` (messages détaillés) et les notes privées.

## 10. Reprendre le travail (liste)

1. Lire ce fichier, `docs/transmission.md`, puis le document privé de reprise désigné par `CLAUDE.local.md` (s'il n'est pas dans le contexte, le lire avec `cat`) et appliquer sa liste de vérification de session.
2. Lire dans les notes privées la section utile à la demande.
3. Synchroniser avec GitHub (`git pull` dans le clone de référence) seulement avec l'accord d'Anthony.
4. Dans `~/dev/zs-verif`, sur `dev` : `npm ci` si `node_modules` manque (accord d'Anthony), `node scripts/prepare-game.js`, vérification de départ (§4.1), tests unitaires.
5. Pour une demande d'Anthony : commencer tout de suite si elle est claire. Ne poser une question que si une mauvaise supposition coûterait cher : gros chantier, ambiguïté, décision irréversible.
6. Avant de livrer : essais de bout en bout par Anthony (méthode E2), README, notes privées, commit (accord), installateur, remise et vérification des empreintes.
