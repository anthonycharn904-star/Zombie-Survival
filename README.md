# Zombie-Survival
Prototype de mon jeu "Zombie Survival", qui j'espère deviendra un grand jeu dans le futur ! Mais toujours free-to-play

Survie par manches dans le style du mode Zombies : barricades, armes au mur, boîte mystère, atouts, courant, Amplificateur. Un seul fichier HTML (Three.js r128), sons synthétisés, textures générées au démarrage.

## Contenu du dépôt

| Dossier | Rôle |
|---|---|
| `game/zombie-survival.html` | **Le jeu.** Version navigateur : c'est le fichier à modifier. La version actuelle est dans `GAME_VERSION`. Il contient aussi le moteur des cartes et la bibliothèque de textures et d'objets utilisée par les Mod Tools. |
| `launcher/` | Launcher Windows (Electron) : installe le jeu hors ligne, le met à jour (mises à jour signées), contient l'outil de publication et les Mod Tools. |
| `launcher/src/modtools/` | **Mod Tools** : l'éditeur de cartes, réservé à l'auteur (voir plus bas). Il n'est pas dans le jeu des joueurs. |

## Jouer dans le navigateur

Ouvrir `game/zombie-survival.html` dans Chrome, Edge ou Firefox. Une connexion internet est nécessaire (Three.js et les polices viennent d'internet ; le launcher, lui, les embarque).

## Cartes

Depuis la version 1.1.0 du jeu, une carte est un fichier de données (JSON, format 1) : grille de cases de 1 m (sol, murs, fenêtres, portes payantes, murets, piliers, caisses, cour des zombies), textures par case, pièces nommées, éléments de jeu (départ, armes murales, atouts, emplacements de la boîte mystère, interrupteur, Amplificateur, lumières, panneaux, apparitions de zombies au sol), objets posés, ambiance et règles de la partie.

- **Bunker 7** est intégré au fichier du jeu.
- Les autres cartes sont livrées dans le paquet du jeu : `maps/index.json` (ordre du menu) et `maps/<id>.json`. Une carte de ce dossier qui porte l'identifiant `bunker7` remplace celle qui est intégrée.
- Le bouton **Jouer** du menu ouvre la **sélection de la carte** (depuis le jeu 1.2.0) : une fiche par carte, avec sa vignette (ou, à défaut, son plan dessiné d'après la grille), sa description, le record et le nombre de parties jouées. Choix à la souris ou aux flèches, Entrée ou double clic pour jouer, Échap pour revenir. La dernière carte jouée est présélectionnée. Le record est gardé par carte. Une carte qui ne peut pas se jouer (pas de départ, aucun zombie possible…) n'est pas proposée.
- Les images et modèles 3D importés (PNG, JPEG, WebP, `.glb`) sont embarqués dans la carte qui les utilise.

## Statistiques du joueur

Depuis le jeu 1.2.0, le bouton **Statistiques** du menu affiche les compteurs de toute la vie du joueur sur ce poste (enregistrés dans le stockage local du jeu, clé `zs.stats`, pendant les parties ; sauvegardés à la pause, à la fin de partie, à la fermeture de la fenêtre et toutes les 20 s de jeu). Les parties de test des Mod Tools ne comptent pas.

- **Service** : heures de jeu total (temps passé en partie, pauses exclues), parties jouées, manches terminées, meilleure manche (records des cartes compris), points gagnés, points dépensés.
- **Éliminations** : zombies tués ; dont tirs dans la tête, engins explosifs (grenades, Panzerschreck, munitions explosives), corps-à-corps, armes spéciales (Désintégrateur, Onde de choc), bonus Bombe ; précision des tirs (tirs ayant touché au moins un zombie / tirs).
- **Défense du bunker** : portes ouvertes, fenêtres totalement barricadées (la dernière planche reclouée par le joueur ; le bonus Charpentier ne compte pas), planches reclouées, courant rétabli, fois à terre.
- **Arsenal** : armes achetées au mur, tirages de la boîte mystère, atouts bus, armes amplifiées, bonus ramassés.

La précision de l'écran de fin de partie compte aussi un tir de fusil à pompe une seule fois, même si plusieurs plombs touchent.

## Mod Tools (éditeur de cartes)

**Réservés à l'auteur.** Le bouton « Mod Tools » n'apparaît dans le launcher que sur un PC qui possède la clé privée de publication correspondant à la clé publique intégrée au launcher. Le code est public : quelqu'un peut compiler son propre launcher avec sa propre clé et son propre éditeur, mais il ne peut rien publier pour les joueurs de ce launcher sans la clé privée. La protection réelle, c'est la signature des mises à jour.

Ouvrir : bouton **Mod Tools** du launcher (ou `npm run modtools` en développement).

- **Vues** : plan (vue de dessus) et 3D, côte à côte ou seules (Tab). La 3D est le rendu du jeu, avec une caméra libre.
- **Outils** : Sélection (V), Construire (B : pinceau, ligne, rectangle, pièce entière, remplissage), Textures (T : sol, murs, plafond ou ciel ouvert, case par case ou pièce entière), Objets (O), Éléments de jeu (G).
- **Bibliothèques** : 141 textures en 11 catégories et 181 objets en 11 catégories (stockage, mobilier, hôpital, bureau et labo, industriel, militaire, rue, nature, éclairage, horreur, décals), plus vos propres images et modèles `.glb`.
- **Carte** : nom, description, taille (8 à 160 cases), textures par défaut, ambiance (ciel, brouillard, lumière, hauteur des murs…), règles (points et arme de départ, courant allumé, armes de la boîte), caméra et vignette du menu.
- **Tester** (F5) : partie de test sur la carte en cours, sans record ; Échap puis « Retour aux Mod Tools ». Le test se lance même si la carte a des erreurs : un bandeau en haut à droite les rappelle pendant la partie (détaillé au départ et en pause). Un départ posé hors du sol est remplacé, pour le test seulement, par la case de sol la plus proche. Seule une carte sans aucune case de sol ne peut pas se tester.
- **Problèmes** : les erreurs (une carte qui en a ne peut pas être publiée pour les joueurs) et les conseils, avec la position sur le plan.
- Annuler / rétablir (Ctrl+Z / Ctrl+Y), copie de secours toutes les 40 s, 5 versions précédentes de chaque carte gardées. Aide complète : F1.

Atelier de l'auteur : `%APPDATA%\Zombie Survival\modtools\` (`maps/`, `textures/`, `models/`, `publish.json`, `recovery/`, `versions/`, `corbeille/`).

### Publier des cartes

1. Mod Tools → **Cartes** : cocher « Dans le jeu » pour chaque carte à publier et régler l'ordre du menu.
2. **Publier une version du jeu…** ouvre l'outil de publication, avec « Le jeu installé » choisi (le code ne change pas, seules les cartes changent) et le numéro suivant proposé.
3. **Publier pour tous les joueurs** (voir plus bas). Les joueurs reçoivent les cartes avec la mise à jour du jeu, à leur prochain démarrage du launcher.

Limites du moteur : un seul niveau (pas d'étages), murs sur la grille de 1 m, 160 × 160 cases au plus, au-delà de 16 lumières le jeu ralentit sur les petites cartes graphiques. Les modèles `.glb` compressés (Draco, Meshopt, KTX2) ne sont pas lus : les réexporter sans compression.

## Launcher

Prérequis : Node.js 22 ou plus récent. Sous Windows, rien d'autre. Sous Linux, l'installateur se compile aussi, avec wine en 32 bits (`wine32`).

```sh
cd launcher
npm install
npm test            # tests unitaires (signature des mises à jour, paquetage du jeu, publication, atelier des Mod Tools)
npm run test:e2e    # essais de bout en bout dans Electron : Mod Tools (clé de test jetable) puis menu du jeu et statistiques (sous Linux : xvfb-run -a npm run test:e2e)
npm start           # lance le launcher en mode développement
npm run modtools    # ouvre directement les Mod Tools (il faut la clé de l'auteur sur le PC)
npm run dist:win    # fabrique dist/Zombie-Survival-Setup-<version>.exe
```

`npm start` et `npm run dist:win` préparent d'abord `launcher/game/` : la version hors ligne de `game/zombie-survival.html`, livrée avec l'installateur.

- Version du launcher : champ `version` de `launcher/package.json`.
- Identifiant de l'application : `fr.zombiesurvival.launcher`. Ne pas le changer, sinon Windows considère le nouveau launcher comme une autre application et la mise à jour automatique ne remplace plus l'ancien.
- Configuration des mises à jour : `launcher/config/default.json`. Elle contient l'adresse du manifeste et la clé **publique** qui vérifie les signatures. Pour la réécrire : `npm run configure -- pseudo/depot cle-publique.pem`.

## Publier une nouvelle version du jeu

Tout se fait depuis le launcher de l'auteur (depuis la version 1.2.3) : ni l'auteur ni les joueurs n'ont à passer par le site de GitHub. GitHub sert seulement d'entrepôt public des fichiers de mise à jour, à l'adresse fixe `https://github.com/anthonycharn904-star/zombie-survival/releases/latest/download/latest.json` (le dépôt doit donc rester public).

**Une seule fois : relier le launcher à GitHub.** Outil de publication, étape 5 « Mise en ligne » : « Créer le jeton sur GitHub » ouvre la page des jetons *fine-grained*. Nom libre, expiration la plus longue, *Repository access* : *Only select repositories* → `Zombie-Survival`, *Repository permissions* → *Contents* : *Read and write*. Coller le jeton dans le launcher (pas ailleurs) : « Vérifier et enregistrer » contrôle le dépôt et le droit d'écriture (avec un brouillon de version supprimé aussitôt), puis garde le jeton chiffré par Windows (`%APPDATA%\Zombie Survival\publisher\github-token.bin`). « Délier GitHub » l'efface ; il se révoque aussi sur GitHub.

**À chaque version :**
1. Dans le launcher : Réglages → « Outil de publication » (ou Mod Tools → Cartes → « Publier une version du jeu… »). Contenu : « Le jeu installé », ou un fichier `zombie-survival.html` plus récent. Numéro de version et notes.
2. **Publier pour tous les joueurs**, puis confirmer. Le launcher signe la version, la crée sur GitHub en brouillon (invisible des launchers), envoie les fichiers (`latest.json` en dernier), la publie comme dernière version et relit l'adresse fixe pour vérifier. En cas de coupure, rien n'est visible des joueurs : « Réessayer la mise en ligne » reprend le brouillon.
3. Les launchers des joueurs installent la version seuls, à leur prochain démarrage ou au retour d'une partie. Un nouveau launcher joint à la publication (étape 4) s'installe seul aussi (une tentative par version toutes les 6 heures, sans boucle si l'installation échoue).

Garde-fous : l'outil propose toujours le jeu installé ; il refuse un fichier dont le jeu est plus ancien que le jeu installé, et un numéro de version plus petit que celui du code publié. « Créer seulement (test sur ce PC) » fabrique la version sans la mettre en ligne (bouton « Tester avec ce launcher »). Sans liaison GitHub, l'ancienne méthode reste possible : créer la publication, puis déposer ses fichiers dans une release `v<version>` marquée « Latest ».

## Sécurité

La clé **privée** de signature ne doit jamais entrer dans ce dépôt. Le launcher la garde chiffrée par Windows sur le PC de l'auteur. `.gitignore` bloque les fichiers `*.pem`, `*.key`, `*.p12` et `*.pfx`. Sans cette clé, personne ne peut publier une mise à jour acceptée par le launcher. Si elle est perdue, il faut en créer une nouvelle et diffuser un launcher configuré avec la nouvelle clé publique.

## Provenance (3 octobre 2026)

Les sources d'origine n'existaient que dans un espace de travail temporaire. Ce dépôt a été reconstitué à partir de la release publique `v1.0.2`, puis vérifié :

- `game/zombie-survival.html` : une fois repassé dans le code de paquetage du launcher, il redonne exactement l'`index.html` publié dans `zombie-survival-1.0.2.zip`.
- `launcher/` : code, configuration, polices, Three.js, icône et images de l'installateur proviennent de `Zombie-Survival-Setup-1.1.0.exe`. La configuration de compilation (`package.json`) a été reconstituée. Avec elle, `npm run dist:win` reproduit le launcher 1.1.0 à l'octet près, y compris l'exécutable et ses réglages de sécurité Electron. Seul diffère le jeu livré avec l'installateur, qui est maintenant la version de `game/`.
- Les tests d'origine sont perdus. `launcher/test/` contient des tests réécrits.

## Historique

- **4 octobre 2026 — launcher 1.2.3** : publication en un clic depuis le launcher (« Publier pour tous les joueurs », jeton GitHub chiffré, brouillon puis publication, vérification de l'adresse des mises à jour, reprise après coupure) ; mise à jour automatique du launcher lui-même ; nouvelle vérification au retour d'une partie ; garde-fous contre la republication d'un ancien jeu (incident de la version 1.2.0 du 4 octobre, retirée avant tout téléchargement) et contre un numéro trop petit.
- **4 octobre 2026 — jeu 1.2.0, launcher 1.2.2** : menu du jeu : sélection de la carte derrière le bouton Jouer (remplace les flèches), bouton et écran Statistiques (compteurs de toute la vie du joueur) ; précision des tirs corrigée (un tir de fusil à pompe ne compte plus plusieurs fois). Le launcher 1.2.2 ne change que le jeu qu'il livre (1.2.0).
- **4 octobre 2026 — launcher 1.2.1** : Mod Tools : partie de test possible malgré les erreurs de la carte, avec un bandeau qui les rappelle ; départ de secours si le point de départ est hors du sol ; alertes identiques regroupées (×2, ×3…) au lieu de s'empiler. Le jeu ne change pas (1.1.0).
- **4 octobre 2026 — jeu 1.1.0, launcher 1.2.0** : cartes en données (Bunker 7 converti à l'identique), choix de la carte dans le menu, records par carte, apparitions de zombies au sol, éléments facultatifs (boîte, courant, Amplificateur), prix des armes murales par carte, bibliothèques de textures et d'objets, modèles `.glb` ; Mod Tools réservés à l'auteur dans le launcher ; publication des cartes ; essai de bout en bout `npm run test:e2e`.
