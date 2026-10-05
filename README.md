# Zombie-Survival
Prototype de mon jeu "Zombie Survival", qui j'espère deviendra un grand jeu dans le futur ! Mais toujours free-to-play

Survie par manches dans le style du mode Zombies : barricades, armes au mur, boîte mystère, atouts, courant, Amplificateur. Un seul fichier HTML (Three.js r128), sons synthétisés, textures générées au démarrage.

## Installer le jeu (joueurs)

Télécharger l'installateur `Zombie-Survival-Setup-<version>.exe` sur la page de la dernière version : <https://github.com/anthonycharn904-star/Zombie-Survival/releases/latest> (fichier joint, ou lien « Nouveau joueur ? » de la description), puis le lancer. Windows peut afficher « Windows a protégé votre ordinateur » (installateur non signé) : « Informations complémentaires » → « Exécuter quand même ».

C'est le seul passage par GitHub. Ensuite, le launcher installe lui-même chaque nouvelle version du jeu et du launcher, à son démarrage et au retour d'une partie (Réglages : « Installer automatiquement les mises à jour », activé par défaut).

## Contenu du dépôt

| Dossier | Rôle |
|---|---|
| `game/zombie-survival.html` | **Le jeu.** Version navigateur : c'est le fichier à modifier. La version actuelle est dans `GAME_VERSION`. Il contient aussi le moteur des cartes et la bibliothèque de textures et d'objets utilisée par les Mod Tools. |
| `launcher/` | Launcher Windows (Electron) : installe le jeu hors ligne, le met à jour (mises à jour signées), contient l'outil de publication et les Mod Tools. |
| `launcher/src/modtools/` | **Mod Tools** : l'éditeur de cartes, réservé à l'auteur (voir plus bas). Il n'est pas dans le jeu des joueurs. |

## Jouer dans le navigateur

Ouvrir `game/zombie-survival.html` dans Chrome, Edge ou Firefox. Une connexion internet est nécessaire (Three.js et les polices viennent d'internet ; le launcher, lui, les embarque).

## Cartes

Depuis la version 1.1.0 du jeu, une carte est un fichier de données (JSON, format 1) : grille de cases de 1 m (sol, murs, fenêtres, portes payantes, murets, piliers, caisses, cour des zombies), textures par case, pièces nommées, éléments de jeu (départ, armes murales, atouts, emplacements de la boîte mystère, interrupteur, Amplificateur, digi pass, lumières, panneaux, apparitions de zombies au sol), objets posés, ambiance et règles de la partie. Depuis le jeu 1.4.0, une carte peut avoir des étages et des sous-sols reliés par des escaliers (format 2, voir « Étages et escaliers » ; une carte sans étage reste au format 1).

- **Bunker 7** est intégré au fichier du jeu.
- Les autres cartes sont livrées dans le paquet du jeu : `maps/index.json` (ordre du menu) et `maps/<id>.json`. Une carte de ce dossier qui porte l'identifiant `bunker7` remplace celle qui est intégrée.
- Le bouton **Jouer** du menu ouvre la **sélection de la carte** (depuis le jeu 1.2.0) : une fiche par carte, avec sa vignette (ou, à défaut, son plan dessiné d'après la grille), sa description, le record et le nombre de parties jouées. Choix à la souris ou aux flèches, Entrée ou double clic pour jouer, Échap pour revenir. La dernière carte jouée est présélectionnée. Le record est gardé par carte. Une carte qui ne peut pas se jouer (pas de départ, aucun zombie possible…) n'est pas proposée.
- Les images et modèles 3D importés (PNG, JPEG, WebP, `.glb`) sont embarqués dans la carte qui les utilise.

## Étages et escaliers

Depuis le jeu 1.4.0, une carte peut monter sur plusieurs niveaux : rez-de-chaussée (niveau 0), jusqu'à 6 étages au-dessus et 3 sous-sols en dessous, 8 niveaux au plus. Un niveau mesure la hauteur des murs plus une dalle de 30 cm (3,8 m avec des murs de 3,5 m). Bunker 7 reste sur un seul niveau, à l'identique.

- **Escaliers** : quatre formes (droit, de 1 à 3 cases de large ; quart tournant ; demi-tour avec palier ; colimaçon autour d'un noyau, 3 × 3 cases) et neuf matériaux (bois, bois ancien, pierre, pierre moussue, béton, métal, caillebotis, brique, marbre). Marches d'environ 19 cm. Le bois, le bois ancien, le métal et le caillebotis sont posés sur des limons, dessous ouvert ; la pierre, la pierre moussue, le béton, la brique et le marbre sont pleins jusqu'au sol.
- **Trémie et garde-corps** : au-dessus des hautes marches, le plancher de l'étage est ouvert (la tête passe) ; des garde-corps bordent automatiquement les vides (trémies, bords d'étage, terrasses) : on ne tombe pas.
- **Zombies** : ils montent et descendent comme le joueur, d'un niveau à l'autre ou à travers plusieurs (champ de distances sur tous les niveaux). Ils sortent des fenêtres et des apparitions au sol de tous les étages ; une pièce reliée par un escalier s'ouvre avec la pièce d'où il part.
- **Le reste suit l'étage** : une lampe n'éclaire que son étage ; les tirs s'arrêtent sur les dalles (sauf à travers une trémie) ; une explosion ne traverse pas un plancher ; les sons venant d'un autre étage sont étouffés.
- **Format 2** : `grid` et `layers` décrivent le rez-de-chaussée ; `floors: [{ lv, grid, layers }]` les autres niveaux ; chaque élément porte `lv` (absent = rez-de-chaussée ; pour une apparition au sol : `[x, z, lv]`) ; `stairs: [{ x, z, dir, shape, w, n, n2, turn, mat, lv }]` : case de la première marche, sens de la montée, forme (`straight`, `l`, `u`, `spiral`), largeur, longueur des volées, virage (1 à droite, -1 à gauche), matériau, niveau de départ ; l'escalier monte au niveau `lv + 1`.

## Statistiques du joueur

Depuis le jeu 1.2.0, le bouton **Statistiques** du menu affiche les compteurs de toute la vie du joueur sur ce poste (enregistrés dans le stockage local du jeu, clé `zs.stats`, pendant les parties ; sauvegardés à la pause, à la fin de partie, à la fermeture de la fenêtre et toutes les 20 s de jeu). Les parties de test des Mod Tools ne comptent pas.

- **Service** : heures de jeu total (temps passé en partie, pauses exclues), parties jouées, manches terminées, meilleure manche (records des cartes compris), points gagnés, points dépensés.
- **Éliminations** : zombies tués ; dont tirs dans la tête, engins explosifs (grenades, Panzerschreck, munitions explosives), corps-à-corps, armes spéciales (Désintégrateur, Onde de choc), bonus Bombe ; précision des tirs (tirs ayant touché au moins un zombie / tirs).
- **Défense du bunker** : portes ouvertes, fenêtres totalement barricadées (la dernière planche reclouée par le joueur ; le bonus Charpentier ne compte pas), planches reclouées, courant rétabli, fois à terre.
- **Arsenal** : armes achetées au mur, tirages de la boîte mystère, atouts bus, armes amplifiées, bonus ramassés.

La précision de l'écran de fin de partie compte aussi un tir de fusil à pompe une seule fois, même si plusieurs plombs touchent.

## Modèles (fiches des zombies)

Depuis le jeu 1.3.0, le bouton **Modèles** du menu (à côté de Statistiques) ouvre une fiche par type de zombie :

- le modèle 3D animé, photographié devant une toise : glisser pour le faire tourner, molette pour zoomer, double clic pour recadrer ; animations Repos, Marche, Trot, Sprint, Attaque, Barricade, Sortie de terre ; « Autre apparence » ; « Tir dans le casque » (le casque tombe, puis revient). Le modèle est dessiné et animé exactement comme en partie ;
- l'en-tête (numéro, catégorie, première manche), le nom, la description, le nombre de zombies de ce type éliminés par le joueur, des jauges PV, Vitesse et Dégâts par rapport à la référence ×1 du bestiaire, la capacité, la faiblesse et des détails chiffrés. Tout ce qui est chiffré est calculé d'après les règles du jeu : la fiche reste exacte si les règles changent.

### N°00 · Le Fantassin (zombie standard, dès la manche 1)

Depuis le jeu 1.4.0, le zombie de base est **Le Fantassin** : « Un soldat tombé au front et relevé par l'infection. Seul, il est lent et prévisible ; en horde, il submerge. » Uniforme feldgrau, casque d'acier (maille à part), ceinturon et cartouchières, bretelles en Y, grenade à manche, boîte du masque à gaz, plaies, bottes, mains griffues, yeux jaunes ; 1,80 m casque compris. Démarche traînante : bras droit tendu, bras gauche ballant, pied gauche qui racle le sol.

- Référence ×1 du bestiaire : 100 PV à la manche 1, +50 par manche, puis ×1,1 dès la manche 10 (`RULES.zombieHp`) ; 30 dégâts par coup (`RULES.zombieHit`).
- Capacité « Horde » : marche seule jusqu'à la manche 3, trot dès la 4, sprint dès la 8 (`speedMixForRound`).
- Faiblesse : la tête, dégâts ×2 quelle que soit l'arme. Le casque encaisse le premier tir à la tête (0 dégât, +10 points), puis tombe et roule au sol ; sous Mort instantanée, il saute sans rien encaisser. Les explosions peuvent aussi l'arracher.

Pour ajouter un type de zombie : une entrée dans `ZOMBIE_TYPES` (section 01 : nom, catégorie, première manche, description, multiplicateurs `mult` des PV, de la vitesse et des dégâts par rapport au Fantassin, multiplicateur de la tête, casque, capacité, cartes où il apparaît), son modèle dans `SPECIMEN_MODELS` (section 05) et ses rubriques dans `SPECIMEN_FACTS` (section 11). L'ordre de `ZOMBIE_TYPES` est celui des onglets.

## Rang : niveaux et prestiges

Depuis le jeu 1.5.0, le joueur a un rang : niveaux 1 à 55 et 20 prestiges, gardés dans le stockage local du jeu (clé `zs.rank` : prestige, niveau, XP du niveau en cours, XP totale). Les règles sont dans `RANK_RULES` (section 01).

- **Niveaux** : le joueur commence au niveau 1. Passer au niveau 2 demande 500 XP, et chaque niveau demande deux fois plus que le précédent : 1 000 XP du niveau 2 au 3, 2 000 du 3 au 4… environ 4,5 × 10¹⁸ du 54 au 55.
- **Éliminations** : une élimination rapporte une part de ce que demande le niveau en cours (au prestige 1) : 1,1 % pour une élimination normale (balle dans le corps, Désintégrateur, Onde de choc), 1,5 % pour un tir dans la tête, 1,2 % pour un explosif (grenade, Panzerschreck, munitions explosives), 2 % au couteau. Chaque niveau demande donc le même nombre d'éliminations : 91 normales, 67 dans la tête, 84 à l'explosif ou 50 au couteau.
- **Bombe** (bonus Bombe atomique) : 50 XP par manche (manche 1 : 50 XP, manche 10 : 500 XP). Les zombies qu'elle tue ne rapportent rien de plus.
- **Prestige** : au niveau 55, l'XP ne s'accumule plus. Le bouton **Prestige** du menu Ranking (avec confirmation) fait passer au prestige suivant, au niveau 1. Au prestige n, chaque niveau demande n fois plus d'XP : le prestige 2 est deux fois plus long que le prestige 1, le prestige 3 trois fois, etc. Un prestige complet (54 niveaux) représente environ 4 900 éliminations normales au prestige 1 et 98 300 au prestige 20. Avant le premier prestige, les niveaux durent comme au prestige 1.
- **Pas d'XP** dans les parties de test des Mod Tools, ni après le digi pass (à partir du bon code, jusqu'à la fin de la partie).
- **Annonce** : quand le joueur gagne un ou plusieurs niveaux, un bandeau apparaît en haut de l'écran, par-dessus le jeu et les menus : l'ancien grade (insigne au-dessus, numéro en dessous) se fait barrer d'une croix rouge, puis le nouveau grade arrive à côté, avec son nom (« +3 niveaux » si plusieurs d'un coup). Le passage d'un prestige s'annonce de la même façon.
- **Emblèmes**, dessinés par le jeu : 55 insignes de niveau en 11 grades de 5 niveaux (Recrue, Soldat, Caporal, Sergent, Sergent-chef, Adjudant, Lieutenant, Capitaine, Commandant, Colonel, Général : écusson, plaque, médaillon ou octogone ; chevrons, galons, losange, barrettes, feuille, ailes, étoiles ; bronze, argent puis or), avec des traits qui marquent le niveau dans le grade ; 20 emblèmes de prestige (Casque, Plaque, Grenade, Pelles, Masque à gaz, Barricade, Crâne, Boîte mystère, Courant, Griffes, Atout, Tireur d'élite, Roquette, Atome, Bunker, Barbelés, Œil jaune, Sablier, Brasier, Maître) : médaille, écusson, insigne à lauriers, étoile, ailes, puis le Maître ; bronze, cuivre, argent, or, platine. Dès le prestige 1, l'emblème du prestige est épinglé sur l'insigne de niveau. Ils reprennent le principe des emblèmes de Call of Duty (un insigne par niveau, un emblème par prestige) sans en copier aucun.
- **Menu Ranking** (bouton à côté de Statistiques et Modèles) : la fiche du grade (insigne, niveau, nom du grade, XP du niveau et barre, éliminations restantes, bouton Prestige) ; l'onglet **Prestiges**, avec les 20 prestiges (emblème, nom, durée, état : Obtenu, En cours, Disponible, Verrouillé) et à côté de chacun une armoire à récompenses « Verrouillé - Arrivera lors d'une prochaine mise à jour » ; l'onglet **Niveaux**, avec les 55 insignes et l'XP de chaque niveau au prestige en cours. Le menu principal affiche le grade, l'écran de fin de partie l'XP gagnée et les niveaux pris.
- Les quantités d'XP s'écrivent en chiffres jusqu'au million, puis en M (millions), Md (milliards) et puissances de dix.

## Digi pass (Bunker 7)

Depuis le jeu 1.4.0, un digi pass (clavier à code) est fixé au mur de la Gewehr 43, à sa droite, à hauteur de main.

- **F** devant le clavier l'ouvre. Le code tapé s'affiche au centre de l'écran, en blanc. Chiffres de la rangée du haut (sur un clavier AZERTY, sans Maj) ou du pavé numérique ; **Retour arrière** corrige ; **F** referme. S'éloigner, tomber ou mettre en pause referme aussi. Pendant la saisie, 1 et 2 ne changent pas d'arme et les éléments voisins (la Gewehr 43) ne réagissent pas à F.
- Mauvais code : « Code erroné », puis le clavier se vide.
- Bon code (le code d'Anthony, 4 chiffres) : le digi pass disparaît de la carte et, jusqu'à la fin de la partie, les points sont infinis (∞ ; tout achat passe sans rien retirer) et le joueur est immortel. Une nouvelle partie remet le digi pass en place.
- Le code n'est pas écrit en clair dans le jeu : seule son empreinte l'est (`DIGIPASS_HASH`, section 10). Pour le changer, calculer `digipassHash('1234')` (fonction du jeu) et remplacer la valeur. Limite : il n'existe que 10 000 codes, quelqu'un qui lit le code source peut tous les essayer ; l'empreinte empêche seulement de le lire d'un coup d'œil.
- Format de carte : élément facultatif `digipass: { cell, n, off, y }` (case de mur, direction de la pièce, décalage latéral de −0,42 à 0,42 m, hauteur de 0,9 à 2,2 m). Les Mod Tools (launcher 1.2.5) le déplacent quand la carte est redimensionnée et le retirent si son mur disparaît ; ils ne permettent pas encore d'en poser un.

## Mod Tools (éditeur de cartes)

**Réservés à l'auteur.** Le bouton « Mod Tools » n'apparaît dans le launcher que sur un PC qui possède la clé privée de publication correspondant à la clé publique intégrée au launcher. Le code est public : quelqu'un peut compiler son propre launcher avec sa propre clé et son propre éditeur, mais il ne peut rien publier pour les joueurs de ce launcher sans la clé privée. La protection réelle, c'est la signature des mises à jour.

Ouvrir : bouton **Mod Tools** du launcher (ou `npm run modtools` en développement).

- **Vues** : plan (vue de dessus) et 3D, côte à côte ou seules (Tab). La 3D est le rendu du jeu, avec une caméra libre.
- **Outils** : Sélection (V), Construire (B : pinceau, ligne, rectangle, pièce entière, remplissage), Textures (T : sol, murs, plafond ou ciel ouvert, case par case ou pièce entière), Objets (O), Éléments de jeu (G), Escaliers (K, avec le jeu 1.4.0 ou plus récent).
- **Étages** (launcher 1.2.5) : le sélecteur de niveau de la barre du haut (ou Ctrl+↑ / Ctrl+↓) choisit le niveau édité ; tous les outils travaillent sur ce niveau. Le plan montre en transparence le niveau du dessous ; la vue 3D cache les niveaux du dessus (coupe). Onglet Carte → Niveaux : ajouter un étage ou un sous-sol (il reprend les murs du niveau voisin), supprimer l'étage le plus haut ou le sous-sol le plus bas.
- **Escaliers** (K) : forme, matériau, largeur, longueur, virage et sens de la montée (R tourne d'un quart de tour) ; clic sur la case de la première marche. L'étage d'arrivée est ajouté s'il manque, la trémie s'ouvre toute seule ; déplacer, tourner ou retirer l'escalier (clic droit, Suppr) la referme. La pose est refusée si la trémie couperait un mur, une porte, une fenêtre ou un élément de l'étage du dessus.
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

Limites du moteur : murs sur la grille de 1 m, 160 × 160 cases au plus, 8 niveaux au plus (6 étages, 3 sous-sols), pas de rampe ni d'ascenseur, au-delà de 16 lumières (24 sur une carte à étages) le jeu peut ralentir sur les petites cartes graphiques. Les modèles `.glb` compressés (Draco, Meshopt, KTX2) ne sont pas lus : les réexporter sans compression.

## Launcher

Prérequis : Node.js 22 ou plus récent. Sous Windows, rien d'autre. Sous Linux, l'installateur se compile aussi, avec wine en 32 bits (`wine32`).

```sh
cd launcher
npm install
npm test            # tests unitaires (signature des mises à jour, paquetage du jeu, publication, atelier des Mod Tools)
npm run test:e2e    # essais de bout en bout dans Electron : Mod Tools (clé de test jetable, étages et escaliers compris), menu du jeu, statistiques et rang, publication en un clic contre un faux GitHub, zombies et joueur dans les escaliers d'une carte à trois niveaux (sous Linux : xvfb-run -a npm run test:e2e)
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

**Une seule fois : relier le launcher à GitHub.** Outil de publication, étape 5 « Mise en ligne » : « Créer le jeton sur GitHub » ouvre la page des jetons *fine-grained*. Nom libre, expiration la plus longue (ou *No expiration*), *Repository access* : *Only select repositories* → `Zombie-Survival`. *Permissions* → « Add permissions » → cocher *Contents*, puis sur la ligne *Contents* passer *Read-only* à *Read and write* (la ligne *Metadata*, en lecture seule, s'ajoute d'elle-même). Coller le jeton dans le launcher (pas ailleurs) : « Vérifier et enregistrer » contrôle le dépôt et le droit d'écriture (avec un brouillon de version supprimé aussitôt), puis garde le jeton chiffré par Windows (`%APPDATA%\Zombie Survival\publisher\github-token.bin`). « Délier GitHub » l'efface ; il se révoque aussi sur GitHub.

**À chaque version :**
1. Dans le launcher : Réglages → « Outil de publication » (ou Mod Tools → Cartes → « Publier une version du jeu… »). Contenu : « Le jeu installé », ou un fichier `zombie-survival.html` plus récent. Numéro de version et notes.
2. **Publier pour tous les joueurs**, puis confirmer. Le launcher signe la version, la crée sur GitHub en brouillon (invisible des launchers), envoie les fichiers (`latest.json` en dernier), la publie comme dernière version et relit l'adresse fixe pour vérifier. En cas de coupure, rien n'est visible des joueurs : « Réessayer la mise en ligne » reprend le brouillon.
3. Les launchers des joueurs installent la version seuls, à leur prochain démarrage ou au retour d'une partie. Un nouveau launcher joint à la publication (étape 4) s'installe seul aussi (une tentative par version toutes les 6 heures, sans boucle si l'installation échoue). La page de la version sur GitHub donne toujours aux nouveaux joueurs le lien de l'installateur (« Nouveau joueur ? »), même quand la version ne joint pas de nouveau launcher : il pointe alors vers la version qui le contient.

Garde-fous : l'outil propose toujours le jeu installé ; il refuse un fichier dont le jeu est plus ancien que le jeu installé, et un numéro de version plus petit que celui du code publié. « Créer seulement (test sur ce PC) » fabrique la version sans la mettre en ligne (bouton « Tester avec ce launcher »). Sans liaison GitHub, l'ancienne méthode reste possible : créer la publication, puis déposer ses fichiers dans une release `v<version>` marquée « Latest ».

## Sécurité

La clé **privée** de signature ne doit jamais entrer dans ce dépôt. Le launcher la garde chiffrée par Windows sur le PC de l'auteur. `.gitignore` bloque les fichiers `*.pem`, `*.key`, `*.p12` et `*.pfx`. Sans cette clé, personne ne peut publier une mise à jour acceptée par le launcher. Si elle est perdue, il faut en créer une nouvelle et diffuser un launcher configuré avec la nouvelle clé publique.

## Provenance (3 octobre 2026)

Les sources d'origine n'existaient que dans un espace de travail temporaire. Ce dépôt a été reconstitué à partir de la release publique `v1.0.2`, puis vérifié :

- `game/zombie-survival.html` : une fois repassé dans le code de paquetage du launcher, il redonne exactement l'`index.html` publié dans `zombie-survival-1.0.2.zip`.
- `launcher/` : code, configuration, polices, Three.js, icône et images de l'installateur proviennent de `Zombie-Survival-Setup-1.1.0.exe`. La configuration de compilation (`package.json`) a été reconstituée. Avec elle, `npm run dist:win` reproduit le launcher 1.1.0 à l'octet près, y compris l'exécutable et ses réglages de sécurité Electron. Seul diffère le jeu livré avec l'installateur, qui est maintenant la version de `game/`.
- Les tests d'origine sont perdus. `launcher/test/` contient des tests réécrits.

## Historique

- **5 octobre 2026 — jeu 1.5.0, rang** : niveaux 1 à 55 et 20 prestiges ; XP par élimination (normale, tête, explosif, couteau) et par bombe ; annonce des niveaux gagnés en haut de l'écran (ancien grade barré, nouveau grade) ; menu **Ranking** (fiche du grade, 20 prestiges avec leur armoire à récompenses verrouillée, 55 niveaux, bouton Prestige) ; grade dans le menu principal, XP gagnée en fin de partie.
- **5 octobre 2026 — jeu 1.4.0, étages** : cartes sur plusieurs niveaux (étages et sous-sols) reliées par des escaliers de quatre formes et neuf matériaux, que zombies et joueur montent et descendent ; trémies et garde-corps automatiques ; lumière, tirs, explosions et sons limités à leur étage. Bunker 7 inchangé.
- **4 octobre 2026 — jeu 1.4.0** : le zombie de base devient **Le Fantassin** (fiche d'Anthony) : nouveau modèle, démarche traînante, casque qui tombe ; règles de la fiche (100 PV +50 par manche puis ×1,1 dès la 10, 30 dégâts, trot dès la manche 4, sprint dès la 8, tête ×2 pour toutes les armes au lieu de ×1,5 à ×4 selon l'arme, casque qui encaisse le premier tir à la tête). Écran Modèles : fiche au format de la sienne (en-tête, jauges ×1, capacité, faiblesse), démonstration du casque, brume au sol. Seuls les zombies présents sont dessinés (le modèle est plus détaillé). **Digi pass** sur le mur de la Gewehr 43 (Bunker 7) : code à 4 chiffres tapé au centre de l'écran ; le bon code retire le clavier et donne, pour la partie, points infinis et immortalité.
- **4 octobre 2026 — jeu 1.3.0** : écran **Modèles** dans le menu (fiche et modèle 3D animé de chaque type de zombie, caractéristiques tirées des règles du jeu, éliminations du joueur).
- **5 octobre 2026 — launcher 1.2.5** (livre le jeu 1.4.0) : Mod Tools : étages et sous-sols, outil Escaliers, sélecteur de niveau, coupe de la vue 3D, barre du haut adaptée aux fenêtres étroites ; le digi pass suit le redimensionnement de la carte et part avec son mur. Aide de l'étape « Mise en ligne » adaptée à la nouvelle page des jetons GitHub (« Add permissions », puis *Read-only* → *Read and write*).
- **4 octobre 2026, 21 h 10 — en ligne : jeu 1.2.1 et launcher 1.2.4** (release `v1.2.1`), première publication faite en un clic depuis le launcher. Le jeu 1.2.1 est le code du jeu 1.2.0, republié sous un numéro plus grand que la release 1.2.0 retirée. Vérifié : signature, contenu identique au dépôt, mise à jour d'un launcher 1.1.0 simulée (jeu installé, launcher 1.2.4 proposé et vérifié).
- **4 octobre 2026 — launcher 1.2.4** : la page de chaque version mise en ligne donne aux nouveaux joueurs le lien de l'installateur (« Nouveau joueur ? »), même quand la version ne joint pas de nouveau launcher : le premier téléchargement se fait toujours depuis la page de la dernière version.
- **4 octobre 2026 — launcher 1.2.3** : publication en un clic depuis le launcher (« Publier pour tous les joueurs », jeton GitHub chiffré, brouillon puis publication, vérification de l'adresse des mises à jour, reprise après coupure) ; mise à jour automatique du launcher lui-même ; nouvelle vérification au retour d'une partie ; garde-fous contre la republication d'un ancien jeu (incident de la version 1.2.0 du 4 octobre, retirée avant tout téléchargement) et contre un numéro trop petit.
- **4 octobre 2026 — jeu 1.2.0, launcher 1.2.2** : menu du jeu : sélection de la carte derrière le bouton Jouer (remplace les flèches), bouton et écran Statistiques (compteurs de toute la vie du joueur) ; précision des tirs corrigée (un tir de fusil à pompe ne compte plus plusieurs fois). Le launcher 1.2.2 ne change que le jeu qu'il livre (1.2.0).
- **4 octobre 2026 — launcher 1.2.1** : Mod Tools : partie de test possible malgré les erreurs de la carte, avec un bandeau qui les rappelle ; départ de secours si le point de départ est hors du sol ; alertes identiques regroupées (×2, ×3…) au lieu de s'empiler. Le jeu ne change pas (1.1.0).
- **4 octobre 2026 — jeu 1.1.0, launcher 1.2.0** : cartes en données (Bunker 7 converti à l'identique), choix de la carte dans le menu, records par carte, apparitions de zombies au sol, éléments facultatifs (boîte, courant, Amplificateur), prix des armes murales par carte, bibliothèques de textures et d'objets, modèles `.glb` ; Mod Tools réservés à l'auteur dans le launcher ; publication des cartes ; essai de bout en bout `npm run test:e2e`.
