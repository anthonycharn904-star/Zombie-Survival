# Transmission des connaissances — Zombie Survival

Complément de `CLAUDE.md`, à lire juste après lui. Écrit le 13 octobre 2026 au soir, à la demande d'Anthony, avant son passage à Claude Code (« audit de transmission de connaissances »). Il rassemble ce qui ne figurait ni dans `CLAUDE.md` ni dans les notes privées du Projet claude.ai (`claude/zombie-survival-notes.md`) :

- les préférences et les règles d'Anthony ;
- les décisions et leurs raisons ;
- ce qui est demandé ou annoncé et pas encore fait ;
- les écarts entre ses fichiers de conception et le jeu ;
- les problèmes rencontrés et leurs solutions.

**Règles d'usage**
- Rien ici n'autorise une modification. Chaque correction attend une demande d'Anthony : certains écarts sont peut-être voulus.
- Le dépôt est public. Ce document ne contient ni le code du digi pass, ni clé, ni jeton, ni mot de passe, et il ne doit jamais en contenir.
- Quand un point est réglé : le retirer d'ici et l'écrire là où il doit vivre (README, `CLAUDE.md` ou notes privées).
- Confiance, entre parenthèses :
  - *élevée* : vérifié dans le code ou dans le fichier source ;
  - *moyenne* : relevé par un sous-agent et non revérifié en entier, ou déduit ;
  - *faible* : estimation.

## 1. Sources de cet audit

**Consultées le 13 octobre 2026**

- **La conversation de développement.** C'est une seule longue session, du 3 au 13 octobre. Elle a été condensée plusieurs fois, donc :
  - en détail, seulement la fin (depuis le 13 octobre vers 23 h) ;
  - par résumés : la journée du 13 octobre (de 7 h 57 à 23 h) et le premier jour (3 octobre) ;
  - les consignes et rapports de sous-agents (5 et 8 octobre ; audits du 13 octobre) ;
  - une centaine de sorties d'outils gardées sur disque (4 au 13 octobre), presque toutes techniques.
- **Les documents.**
  - Les notes privées du Projet : `zombie-survival-notes.md`, 279 787 octets, état du 13 octobre à 10 h 45.
  - `README.md`, `CLAUDE.md`, `engine/README.md` et `git log`.
  - `launcher/config/notes-history.json` : les notes de version écrites par Anthony.
- **Les fichiers joints par Anthony.**
  - Planches PDF : « Le Glas », « Khamsin » (8 pages), « Ombre éternelle », « Élixirs ».
  - Fiches du Fantassin et du Molosse.
  - Modules du couteau et du khépesh.
  - 26 images, dont 23 distinctes.
- **La mémoire claude.ai d'Anthony** : projets de jeux, jeux vidéo, matériel.

**Plus accessibles** (rien ici ne prétend en venir)

- Le texte des échanges du 4 au 12 octobre, et celui du 13 octobre avant 23 h. Seuls des résumés en restent. Ce qu'on en sait vient des notes du Projet (écrites au jour le jour), du README, de `git log` et des pièces jointes.
- La conversation claude.ai d'avant le 3 octobre, où le jeu est né (jusqu'à la version 1.0.2). On ne la connaît que par les notes et la section « Provenance » du README.
- Les conversations où Anthony prépare ses planches et ses modules avec Claude.

## 2. Travailler avec Anthony

### Comment lui répondre

Ces préférences sont réglées dans son compte claude.ai. Une session Claude Code lancée ailleurs, par exemple en ligne de commande, ne les reçoit pas forcément : les appliquer partout.

- **En français**, directement : sans préambule, sans reformuler sa question, sans remplissage ni flatterie.
- **Raisonner à partir des premiers principes.** Dire clairement quand il se trompe. Corriger une prémisse fausse avant de répondre. Présenter une position défendable même si elle est minoritaire ou inconfortable.
- **Incertitude** : donner son niveau de confiance et ce qui le ferait changer.
- **Problème concret** : finir par des actions précises et exécutables (quoi faire, dans quel ordre, comment vérifier que ça marche).
- **Style** : jamais la tournure « ce n'est pas X, c'est Y », ni aucune définition par contraste.

### Comment il décide

- Il est l'auteur et le seul décideur.
- **Questions** : il répond volontiers aux questions à choix et écrit ses conditions. Exemple du 13 octobre : « Je privilégie donc l'option 1, mais avant toute suppression, je souhaite que tu : », suivi de cinq vérifications.
- **Actions irréversibles** : vérifications d'abord, puis son accord explicite. Le 13 octobre :
  - « Ne supprime aucun fichier avant de m'avoir confirmé ces cinq points et d'avoir obtenu mon autorisation » ;
  - puis « Non, attends », quand on lui a demandé l'accord. Le retrait du jeu du Projet attend toujours.
- **Ordre des étapes** : c'est lui qui le fixe (« Avant d'attaquer l'étape 1, fais l'étape 2 avec le nouvel installateur »).
- **Horizon** : le très long terme (« continuer à développer Zombie Survival pendant des années sans rencontrer à nouveau ce problème de stockage »).
- **Fidélité aux fichiers** : quand il fournit un fichier, il veut un résultat « identique au fichier » (khépesh, 13 octobre). Chaque écart lui est signalé (`CLAUDE.md` §4).
- **Notes de version** : il les écrit lui-même, dans un style direct qui annonce la suite aux joueurs (`launcher/config/notes-history.json`, puis l'outil de publication). Ce qu'il y annonce engage le jeu (§5).

### Ses références

- **Call of Duty Zombies.**
  - Le jeu en reprend le style et des noms : il a choisi les noms des atouts le 5 octobre.
  - Mémoire claude.ai :
    - il joue à Call of Duty de façon agressive, ou à distance et en survie ;
    - il fait du modding Call of Duty en GSC et Lua ;
    - il parle de « ma map zombie », sans préciser si c'est pour Call of Duty ou pour ce jeu.
- **Radiant de Black Ops III**, pour les Mod Tools.
  - Le 12 octobre à 23 h 30, il a joint trois captures : la vue 3D avec les flèches X, Y et Z sur la sélection, le navigateur de textures (vues All, In Use, Favorites et filtres), la vue « XY Top ».
  - Écart jamais signalé : dans Radiant, Z (bleu) est la verticale. Dans les Mod Tools, Y (vert) monte et Z (bleu) va vers le sud, et la vue de dessus s'appelle pourtant « XY ». Constat certain ; qu'il en soit gêné est une supposition (confiance faible).
  - Les textures-outils de Radiant (murs invisibles pour le joueur, l'IA ou les tirs ; volumes de lumière et de brouillard) n'existent pas dans les Mod Tools. Il ne les a pas demandées.
- **Sa façon de concevoir** : il prépare ses cartes, ses zombies et ses objets avec Claude dans d'autres conversations, puis les envoie ici pour être intégrés.
  - Planches PDF : Le Glas, Khamsin, Ombre éternelle, Élixirs.
  - Fiches HTML : Fantassin, Lacéré, Savant, Sentinelle, Molosse.
  - Modules JS : couteau, khépesh.
- **Nom** : il appelle aussi le jeu « Survival Zombie ».

### Son matériel

- **Écran 21:9.** Ses captures en plein écran font 3439 × 1439 pixels, soit un écran d'environ 3440 × 1440 (confiance élevée). Les documents ne parlaient que d'une fenêtre d'environ 2,7:1 : c'était sa fenêtre de Firefox. Vérifier toute interface en 21:9 en plus du 16:9.
- **Firefox.** Il teste aussi le jeu dans Firefox, en plus du launcher (Chromium) : Firefox est l'application ouverte sur ses captures du 7 et du 8 octobre (confiance moyenne). Y penser pour le verrouillage de la souris, l'audio et les performances.
- **PC.** Windows 11, carte graphique haut de gamme (mémoire claude.ai). Les durées mesurées ici en rendu logiciel (SwiftShader) ne disent rien de son PC.

## 3. Règles qu'il a fixées (en plus de `CLAUDE.md` §7)

- **Suppressions.** Aucune sans son accord explicite, même celle d'une copie redondante (13 octobre).
- **Confort de la vue.**
  - Les modules intégrés n'ont ni secousse de caméra ni coup de zoom (`CLAUDE.md` §4).
  - Le jeu de base secoue encore la vue (`FX.shake`) :
    - quand le joueur prend un coup ;
    - aux explosions et aux tirs de l'Onde de choc (`blastCone`) ;
    - à l'apparition et à l'explosion des chiens ;
    - aux chocs en véhicule ;
    - quand un Rôdeur agrippe ;
    - aux pas du Gardien.
  - Une option « mouvements de caméra réduits » figure dans les pistes des notes.
  - Pour un nouvel effet : pas de secousse ni de zoom sans lui demander (déduit de la règle des modules).
- **Noms des atouts.** Il garde les noms de Call of Duty « pour le moment » (notes). Les noms de machines de la planche (Lazare, Pèlerin, Toccata, Cuirasse, Vif-Argent) ne s'affichent pas en partie, selon l'audit (confiance moyenne).

## 4. Décisions et leurs raisons (non écrites ailleurs)

| Décision | Date | Raison |
|---|---|---|
| Le jeu n'est plus copié dans le Projet claude.ai (« option 1 »). | 13 oct. | Le Projet était presque plein : 1,83 million de jetons sur 2, dont environ 1,7 pour le jeu. Anthony veut développer « sur le très long terme » sans cette limite. Le dépôt GitHub devient la seule copie de travail. Le retrait effectif attend son accord. |
| L'atelier du moteur (`engine/`) entre dans le dépôt (commit `2eec425`). | 13 oct. | Il n'existait que dans l'espace de travail temporaire des sessions ; le perdre empêchait de reconstruire le jeu. Le même problème s'était posé le 3 octobre avec les sources d'origine (README, « Provenance »). |
| Le khépesh sert dans tout le désert : Khamsin, ses copies et le Désert vierge. | 13 oct. | Anthony a écrit « uniquement dans la 2ème map, Khamsin ». Les copies et le Désert vierge sont le même monde (`OW.worldId === 'khamsin'`). À confirmer avec lui (§9). |
| Volume du khépesh : 0,21 (0,7 dans le fichier). | 13 oct. | Mesuré : à 0,27, la valeur du couteau, le coup sonnait 2 dB plus fort que le couteau ; à 0,21, ils sonnent pareil. |
| Flaques du khépesh presque noires (`0x1c0202`). | 13 oct. | Fidélité au fichier. Anthony peut demander de les éclaircir. |
| Reflets du bronze calculés d'avance (`P2-khepesh-reflets.js`), à retirer. | 13 oct. | Annoncés à tort comme un gain de 25 s ; mesurés ensuite : 1 à 2 s en rendu logiciel, pour 230 Ko. Retrait à la prochaine version du jeu (`CLAUDE.md` §9). |
| Textures, modèles et sons générés par le code. | 3 oct. | Le jeu tient en un seul fichier. Depuis l'environnement cloud, aucun site de ressources libres (CC0) n'était joignable : seuls GitHub et les registres de paquets l'étaient. Une session avec un réseau ouvert pourrait en télécharger : à décider avec Anthony (poids du fichier, licences). |

## 5. Demandé ou annoncé, pas encore fait

**Demandé par Anthony, absent des notes et du dépôt**

Ces deux demandes viennent de la mémoire claude.ai. La date exacte est inconnue (avant le 12 octobre).

- **Marteau gravitationnel** : l'arme de corps-à-corps principale de sa carte lunaire.
  - Ombre éternelle existe depuis le jeu 2.0.0, mais elle garde le couteau. Les notes disent seulement « une arme de corps-à-corps propre à Ombre éternelle ».
  - Aucune planche ni aucun module reçu.
  - Modèle d'intégration : le khépesh (`meleeMod`, `khepeshOn`, `CLAUDE.md` §4).
- **Petite carte sombre de marécage** : 4 maisonnettes reliées par des passerelles. Rien n'est commencé.

**Annoncé aux joueurs par Anthony** (notes de version publiées)

- 1.4.0 : « 3 autres modèles de base vont arriver ».
- 1.5.0 : « D'autres modèles de Zombies sont à venir prochainement ».
  - Fait depuis : trois variantes du Fantassin (jeu 1.8.0 : Lacéré, Savant, Sentinelle). La fiche du Notable (N°00-B) est encore attendue.
  - Dans ces mêmes notes, il appelle le Fantassin « Nazi Zombie », sans doute un clin d'œil aux Nazi Zombies de Call of Duty: World at War (confiance moyenne).
- Annoncés dans le jeu lui-même :
  - armoires de prestige : « Arrivera lors d'une prochaine mise à jour » (`CABINET_NOTE`) ;
  - mods de munition : « D'autres arriveront avec de prochaines cartes ».

**Résumé des « Pistes pour la suite » des notes privées**

Copié ici pour une session sans accès au Projet ; la liste complète est dans les notes.

- **Khépesh** : flaques plus claires ou moins nombreuses, posées selon la pente.
- **Mod Tools**
  - Vues de face et de côté (XZ, YZ) ; inclinaison, et rotation sur trois axes.
  - Lumière réelle pour les textures lumineuses ; collisions fines des grands modèles ; import de modèles en lot ; plus de 62 textures peintes par carte.
  - Taille réglable pour les véhicules et les textures des cartes ouvertes.
  - Abords réglables ; digi pass déplaçable ; manches de chiens réglables par carte ; deux armes murales sur les deux faces d'un mur.
  - Cartes ouvertes : relief des lieux, routes courbes et ponts, intérieurs à composer, quête pour un Désert vierge.
- **Ombre éternelle** : modules pressurisés posés dans les Mod Tools ; sas et quête pour une Lune vierge ; véhicule lunaire ; coopération ; réglages après essai (oxygène, adhérence, bonds).
- **Khamsin**
  - Intérieurs des bâtiments ; pyramides en blocs ; chambres sous le plateau.
  - Passagers et tir depuis un véhicule ; autres véhicules de la planche ; Rôdeurs à plusieurs.
  - Réglages de la tempête après essai ; succès et récompenses de l'évasion.
- **Zombies** : fiche du Notable.
  - Animations : cheville articulée, corps qui se heurtent, jambes arrachées par les balles, réactions d'un corps à terre.
- **Armes**
  - Sortie d'arme, inspection, course ; doigts qui épousent les pièces ; chargeur gardé au rechargement tactique.
  - Grenade cuite, lancer en cloche, grenade à manche allemande, fumigène, grenade murale.
  - Couteau Bowie au mur ; gouttes plus fines ; cadence du couteau.
- **Jeu**
  - Pièges électriques, téléporteur, œuf de Pâques.
  - Quête du battant du Glas ; calibrage du Glas.
  - Rampes et ascenseurs ; manette ; coopération en ligne.
  - Nouveaux mods de munition ; chiens de feu ; ambiance des manches de chiens.
  - Option « mouvements de caméra réduits ».
- **Noms** : noms des atouts d'après la planche, quand Anthony le voudra.

**Travaux techniques prévus** (`CLAUDE.md` §9) : à la prochaine version du jeu, retirer `P2-khepesh-reflets.js` et `envMap: khepeshEnv()`, et corriger les commentaires qui parlent de 25 à 30 s (`P1-khepesh-jeu.js`, `P2`, README).

## 6. Écarts entre ses fichiers de conception et le jeu (absents des docs)

Les écarts déjà notés sont dans les notes privées, sections « Limites connues » et « Pistes pour la suite » : pas de passagers, Rôdeur libéré au corps-à-corps, touche F au lieu de E, quête du battant du Glas non faite, lumières des machines… Ce qui suit n'y figure pas.

### Khamsin (planche de 8 pages)

1. **Faisceau et yeux coupés pendant la tempête** (élevée, d'après le code ; pas vérifié en image).
   - La distance d'affichage suit la planche : 4 300 m au calme, puis 1 000, 220 et 60 m (`KHS_LV`, `khFar`, `engine/src/A0-storm.js`).
   - Elle coupe tout, y compris le faisceau de la Grande Pyramide (`owBuildBeam`, `fog: false`) et les yeux turquoise (`khEyes`, dessinés de 12 à 150 m).
   - La planche veut le faisceau « visible dans les quatre phases », et au pic : « Faisceau, phares, yeux ».
   - Dans le jeu, en tempête et au pic, le faisceau disparaît dès que la pyramide est au-delà de la distance d'affichage ; au pic, les yeux au-delà de 60 m aussi. La boussole du HUD garde la direction.
2. **Pistes ensablées, −15 %** (élevée).
   - `OW.stormTrack = 0.85` est calculé (`A0-storm.js:81`), mais rien ne le lit : aucune piste ne ralentit.
   - La planche prévoit aussi que la R47 s'ensable côté sud pendant les tempêtes : rien de tel dans le code.
3. **Bruit des moteurs** (élevée).
   - La planche, et la fiche du jeu (`B0-enemies.js:666`), disent : « un moteur qui tourne attire les Desséchés jusqu'à 60 m » (100 m pour le camion).
   - Dans le code, `noise` règle seulement la distance d'apparition : de 16 m à `noise × 0,6` à l'arrêt, de 45 à 95 m devant le véhicule quand il roule vite (`40-phys.js:366-377`). Tous les zombies poursuivent déjà le joueur.
4. **Abrasion en véhicule** (élevée).
   - Planche, README et notes : un véhicule fermé la divise par deux.
   - Code (`khShelterFactor`) : ×0,5 dans le 4×4, ×0,25 dans le camion blindé (`protect: 0.25`), ×1 dans le buggy (ouvert).
5. **Le Gardien traverse 260 m près du joueur** (élevée).
   - README et notes : « il traverse la carte ».
   - Code (`khGardienStormTick`, `KHG.cross`) : il entre 110 m en arrière, sur l'axe du couloir de tempête, au plus près du joueur, et marche 260 m.
   - La planche dit « traverse la zone » : le code est plus fidèle à la planche que les documents.
6. **Moteur qui chauffe** (élevée). Planche, phase Khamsin : « Véhicules à 30 km/h, le moteur chauffe au-delà ». Le jeu bride à 30 km/h, sans surchauffe.
7. **Plus de zombies pendant la tempête** (élevée). La planche baisse la distance d'affichage pour mettre « plus de zombies à l'écran pour le même coût de rendu ». Le plafond reste à 24 zombies (`RULES.maxAlive`).
8. **Disjoncteurs** (élevée).
   - Planche : salle des turbines, poste de transformation, prise d'eau.
   - Jeu : salle des turbines, poste de commande, transformateurs (`62-open.js`). « Tenir » y devient : F maintenue 4 s.
9. **Course finale vers l'avion** (faible : non mesurée).
   - La planche prévoit 45 s de marge en buggy, 35 s en 4×4, et un camion trop lent de 30 s.
   - Un sous-agent a estimé, sans jouer, des marges bien plus courtes : environ 23 s et 8 s.
   - À mesurer en partie avant tout réglage.
10. **Détail** : distance d'affichage au calme de 4 300 m (4 000 sur la planche).

### Ombre éternelle

1. **Feu et fumée dans le vide.**
   - Les explosions du jeu de base (`explode` : boule de feu, fumée grise, étincelles) n'ont pas de variante lunaire (élevée). Seule l'explosion du dépôt est faite « ni feu ni fumée ».
   - D'après l'audit, brûlent aussi dehors : les flammes de bouche des armes, les bougies du Glas et les feux des machines Cuirasse et Vif-Argent (moyenne).
2. **Propulseurs** : 16 dans le jeu, dont 2 au fond ; 14 sur le plan de la planche (moyenne).
3. **Convoyeur** : environ 125 m plus au sud que sur la planche (moyenne).

### Le Glas

1. **Lieu.** La planche le place dans une chapelle en ruine. Le jeu le met sur Bunker 7, à la place de l'ancienne machine, dans la salle des machines (README). L'écart n'a jamais été signalé comme tel (élevée).
2. **Corde.** On tient F à 1,95 m de la cloche, et la corde bouge seule (moyenne).

### Élixirs (machines d'atouts)

1. **Bogue : le halo du globe de Vif-Argent n'est jamais ajouté** (élevée).
   - Ligne 9201 du jeu construit : `const globeHalo = elixSprite(...); // teinte foncée : violette même sur un mur clair globeHalo.position.set(0, 2.02, zc); root.add(globeHalo);`.
   - Le commentaire avale la fin de la ligne : le halo est créé mais jamais placé dans la scène.
   - Présent depuis le jeu 1.8.0 (commit `7c76a22`).
   - Correction : un point d'accroche qui passe à la ligne avant `globeHalo.position…`, car ce code fait partie de la base 1.9.0. À faire dans une nouvelle version du jeu, avec l'accord d'Anthony.
2. **Couleurs de la Cuirasse et du Pèlerin** (élevée).
   - Acier de la Cuirasse (`M.steel` de `elixirResources`) : `#B4BEC8` dans le jeu, `#76808A` (plus sombre) sur la planche.
   - Les couleurs « Cœur » de la planche ne sont pas utilisées : `#FFE4DA` (Cuirasse) et `#F2FFE8` (Pèlerin).
3. **Détails** (moyenne).
   - Lazare : feux follets sur un rayon de 0,3 m (0,25 sur la planche) ; son âme ne monte que de 0,56 m sous le plafond de Bunker 7.
   - Cuirasse : plastron en ellipsoïde plein ; lames sans rivets.

### Fantassin, Molosse, couteau

1. **Couteau : l'angle vertical n'est pas contrôlé** (élevée).
   - Le fichier vise dans un cône en 3D autour du regard.
   - Le jeu ne regarde que la direction horizontale (`knifeReach`) : on touche un zombie en regardant le plafond ou ses pieds.
   - Le khépesh, lui, contrôle l'angle en 3D (`khepeshChoose`).
   - Décision non retrouvée.
2. **Couteau : la version 1 du module est toujours là** (élevée).
   - Le jeu emploie la version 2 : `decision: 'appui'`, réglée dans `buildKnife`.
   - `decision: 'contact'` rétablirait la version 1 : début de geste commun, choix au contact, raté en « élan, déséquilibre, reprise ».
3. **Couteau : dragonne** (élevée, faible importance). Elle suit la pesanteur de la carte (`GRAV.k`, lunaire sur la Lune) ; le fichier la fixe à 9,81 m/s². Ce changement d'intégration manque dans la liste du README.
4. **Fantassin : 1,755 m** casque compris, mesuré dans le jeu. La fiche, le README, les notes et le commentaire de `ZRIG` disent 1,80 m (moyenne : mesure d'un sous-agent, non refaite).
5. **Fantassin : deux détails du dessin manquent** : la plaque d'identité au cou et le pantalon déchiré au genou droit (moyenne).
6. **Valeurs « à équilibrer »** (moyenne).
   - La fiche du Molosse dit « valeurs de départ, à équilibrer en jeu ». PV ×0,5, vitesse ×2 et dégâts ×0,7 sont pourtant appliqués tels quels.
   - Même chose pour les 100 PV « proposés » du Fantassin.
   - Anthony voulait les régler après essai.
7. **Molosse : détails du dessin** : l'oreille entaillée et la pupille fendue manquent. Le commentaire du code annonce une cicatrice qui n'existe pas (moyenne).

### Erreurs dans les documents

À corriger dans les documents quand on y touche, ou dans le code si Anthony le décide.

- **Notes, « Limites connues »** : « toutes les cartes ont des manches de chiens ». C'est faux depuis le jeu 2.0.0 : le monde ouvert les coupe (`G.dogs.off`).
- **README et notes, abrasion** : un véhicule fermé la « divise par deux ». Le camion la divise par quatre.
- **README et notes, Gardien** : il « traverse la carte ». Il traverse en fait 260 m de la zone du joueur.
- **README, notes et `ZRIG`, Fantassin** : 1,80 m annoncé, 1,755 m mesuré.
- **Notes, « Sources et sauvegardes »** : le dernier commit cité est `64ee430`. Une mise à jour est prête mais pas appliquée (§8).
- **Commentaires du khépesh** (25 à 30 s) : à corriger avec la prochaine version du jeu.

## 7. Problèmes rencontrés et leurs solutions

### Garder le savoir

- **Les conversations longues sont condensées**, et le détail des échanges disparaît. Écrire chaque décision d'Anthony le jour même :
  - dans les notes privées, avec la date et l'heure ;
  - si elle peut être publique, aussi dans le README ou `CLAUDE.md`.
- **Deux fois, un outil indispensable n'existait que dans l'espace de travail temporaire** : les sources d'origine (3 octobre), puis l'atelier du moteur (13 octobre). Tout ce qui sert à construire va dans le dépôt et part sur GitHub avant la fin de la session.
- **Le Projet claude.ai est limité** à 2 millions de jetons : n'y mettre que des notes.

### Moteur et rendu

- **Ressources partagées.** Dans three r128, `texture.userData` n'existe pas. Une ressource partagée entre les cartes passe par `share()` (WeakSet `SHARED`) : `disposeWorld` ne la libère jamais, et il libère tout le reste.
  - Sans `share()`, une ressource commune est détruite au changement de carte.
  - Avec `share()` sur une ressource propre à une carte, la mémoire fuit.
  - Exemple : les géométries des lampes sont gardées dans `LIGHT_GEO`.
- **Noms globaux.** Un générateur de texture nommé comme une fonction du jeu (`genPlanks`) avait remplacé celle-ci. Préfixer les nouveaux noms (`tg…` pour les textures, `ow…`, `kh…`, `lu…`). `dupcheck.py` attrape les déclarations en double.
- **Mesurer avant d'annoncer un gain.** Les reflets précalculés devaient faire gagner 25 s ; ce temps venait en fait de la première compilation du shader cubeUV (environ 23 s, une seule fois, en SwiftShader). Mesurer deux fois, avec et sans, et séparer compilation et calcul.
- **Son d'un module importé** : le régler par mesure, en le comparant au couteau.

### Essais

- **Page en erreur.** Un essai qui attend une page en erreur peut tourner sans fin : l'arrêter dès `window.onerror`.
- **Attentes d'un essai.** Les premières attentes de `khepesh.e2e.js` étaient fausses (fin du coup, sang sur la lame, moment du second coup, seuil de couverture). On les a corrigées d'après les tables du module (`DUREE`, `T_CONTACT`, `SEQ`) : prendre les attentes dans ces tables.
- **Attentes longues.** L'outil Bash de la session coupe une commande à 600 s : attendre par tranches de 570 s au plus.

### Livraison

- **Envoi dans la conversation.** Un envoi est parti une fois avec un mauvais nom de dossier. Écrire le nom réel du dossier de sortie dans un fichier dès sa création, puis le relire au moment d'envoyer.
- **Copie sur le PC** (`device_commit_files`) : 30 Mo au plus par fichier, 100 Mo par appel. Copier les morceaux de 29 000 000 octets (deux appels pour quatre morceaux), puis relire chaque copie par empreinte.
- **GitHub.** Le 3 octobre, l'envoi (push) a été refusé (403) jusqu'à ce qu'Anthony installe l'application GitHub de Claude ; le jeton `gh` de la session était refusé.

## 8. État au 13 octobre 2026, 23 h 30 (complète les notes, arrêtées à 10 h 45)

- **Dépôt** : `main` contient `2eec425` (16 h 25 : `engine/` et `CLAUDE.md`), puis ce document. Avant : `595aa3a` (10 h 35 : jeu 2.0.4 construction 1, launcher 1.3.3). Reconstruction vérifiée depuis un clone neuf : `496ed859…9dda`.
- **PC d'Anthony.**
  - Livraison de 10 h 40 : launcher 1.3.3 refait, jeu 2.0.4 construction 1, installateur recollé `f8d39622…8f2b` (104 120 299 octets).
  - Copiée à 19 h 22 dans `Téléchargements\Zombie Survival 2.0.4\launcher-1.3.3-khepesh\`, et relue par empreinte.
  - Jeu installé, relevé vers 18 h : 2.0.3 interface 7 (installé le 12 octobre à 20 h 28). La nouvelle version n'était donc pas encore installée.
- **En ligne pour les joueurs** : `v2.0.3`.
- **Projet claude.ai**
  - Il contient encore le jeu (`claude/zombie-survival.html`) et les notes : 1,83 million de jetons sur 2.
  - Le retrait du jeu est décidé (option 1), mais il attend l'accord d'Anthony (« Non, attends »).
  - Une mise à jour des notes est prête, hors du dépôt, pour le moment du retrait. Si elle s'est perdue, la refaire à partir de ce paragraphe.
- **Sans le Projet** : `CLAUDE.md`, le README et ce document suffisent pour développer. Le code du digi pass et l'historique des livraisons restent dans les notes privées.

## 9. Questions ouvertes pour Anthony

1. Retrait du jeu du Projet (étape 1) : quand donne-t-il son accord ?
2. Khépesh : dans tout le désert (Khamsin, copies, Désert vierge), ou dans Khamsin seulement ?
3. Flaques du khépesh : les garder presque noires, ou les éclaircir ?
4. Marteau gravitationnel (Lune) et carte du marécage : toujours prévus ? Une planche ou un module va-t-il arriver ?
5. Écarts du §6 : lesquels corriger à la prochaine version ? Les plus visibles : le halo de Vif-Argent, le faisceau pendant la tempête, les pistes ensablées.
6. Valeurs « à équilibrer » du Molosse et du Fantassin : les régler après une partie d'essai ?
