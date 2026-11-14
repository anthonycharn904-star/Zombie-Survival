# Marécages Maudits : intégration dans le moteur (`engine/marecages/`)

Chantier de Claude 6 (session Marécages), branche `chantier/marecages`, worktree `~/dev/zs-marecages`. Source de référence :
le kit « Zombie Survival 2.0.7 - a publier (Stryges) » d'Anthony, dont la copie privée, en lecture seule, avec ses empreintes,
est dans `~/dev/zs-verif-logs/marecages/kit-2.0.7-stryges/`. Ne jamais le confondre avec les kits « Marécages Maudits 2.1.x
(non signée) ».

**Dans l'historique depuis le 2 novembre 2026.** Le dossier est resté privé (verrou : `.gitignore` avec une ligne « * »)
jusqu'à l'accord d'Anthony du 2 novembre, donné après la revue des fichiers, de leur provenance et de leurs licences
(`PROVENANCE.md`). Le `.gitignore` n'exclut plus que les caches de Python. Pour garder de nouveau un travail privé, y
remettre une ligne « * » : Git ignore alors les fichiers non suivis du dossier, et `build.py` refuse d'écrire la carte dans
`game/zombie-survival.html` (`etape.py`). La copie privée du kit, les rapports et les constructions restent hors du dépôt.

## État au 2 novembre 2026

- Portage mécanique vérifié. Nos sources du kit, telles quelles, sont construites par `etape.py` sur le jeu officiel (2.0.6,
  construction 1). Le résultat redonne le jeu du kit (`jeu/index.html`, `ee29cf3b…`) avec 4 lignes d'écart, toutes attendues :
  le numéro du jeu et les en-têtes des trois modules autonomes (`outils/comparer.py`).
- Adaptations faites (décisions d'Anthony du 1er novembre 2026) : confort (secousses, flashs), diagnostic, étiquettes des
  versions de travail, ancre de `damageZombie`. Le 2 novembre : secousses du jeu de base coupées dans le marais
  (`retouches/confort.py`).
- **La ligne de `build.py`** (accord d'Anthony du 2 novembre 2026) exécute `etape.py` à la fin de la construction :
  `game/zombie-survival.html` contient la carte ; `ZS_SANS_MARECAGES=1` donne le jeu sans elle.
- Commits sur `chantier/marecages`, avec l'accord d'Anthony (2 novembre 2026) : `830296a` (comptes des essais E2 et liste
  de publication du launcher), puis ce dossier, la ligne de `build.py`, le jeu reconstruit et la documentation.
- Les numéros (`GAME_VERSION`, `GAME_BUILD`, `EDITOR_API`) ne sont pas touchés : ils reviennent à Claude 5. Le jeu de la
  branche porte donc les numéros du jeu 2.0.6.
- Textes de `MARAIS` repris par le launcher 1.4.0 (session Interface, 2 novembre 2026) : `eyebrow`, `name`, `description`,
  `dev: true` (« en développement »), et une légende sur la Mère-Vase et les Noyés. Si l'un d'eux change, prévenir la
  session Interface (ou Claude 5).
- Noms du marais lus par « Sauvegarder et quitter » (session 5, `engine/src/S2-sauvegarde.js`, 3 novembre 2026) :
  `maSerialize`, `maRestore`, `MA_SWIM.on`, `MAB.on`, `MAB.state` (sauvegarde permise en `dormant` et `rode`),
  `MA_BOSS.on`, `G.dogRound` (manche des Stryges). Ne pas les renommer sans prévenir Claude 5.
- 10 novembre 2026 (fusion d'essai de Claude 5 avec Bunker 7) : motifs `hitscan let` et `explode marais` raccourcis ;
  section du marais passée de 21 à 42 (décision d'Anthony : la 21 est au boss de Bunker 7) ; `generer-retouches.py`
  donne aux fichiers d'accroche l'environnement de `build.py` (`os`, `HERE`…), dont `hooks-interface.py` se sert.

## Contenu

| Chemin | Rôle |
|---|---|
| `src/ma00_confort.js` | Nouveau, chargé en premier. Réglages de confort (secousses, flashs), garde des flashs. |
| `src/ma01_core.js` … `ma19_arrivee.js` | Les sources du marais du kit (monde, eau, lieux, barque, bête, Noyés, Stryges, pluie, orage, arrivée), réétiquetées puis adaptées. Insérées dans le script du jeu, avant la fin du monde ouvert, après tous les modules de `engine/src/`. |
| `orig/mere-vase.js`, `orig/mere-vase-audio.js`, `orig/barque.js` | Les trois modules autonomes du kit, chacun dans son `<script>`, avec leur empreinte contrôlée (comme la jeep). Insérés tels quels, sauf la Mère-Vase : 8 retouches contrôlées à l'insertion (`retouches/modules.py`, décision d'Anthony du 13 novembre 2026), le fichier restant celui du kit. |
| `retouches/kit.py` | Les 104 retouches du moteur : 100 du script, 4 de l'en-tête. Données lues sans être exécutées. |
| `retouches/confort.py` | Les 3 retouches écrites pour l'intégration (2 novembre 2026) : secousses et à-coups du jeu de base coupés dans le marais, là où le moteur les applique à la caméra (`updateCamera`, `vehCamera`). |
| `retouches/controle.py` | Pour chaque retouche : lieu, déclaration englobante, session concernée. Aussi les versions validées, les empreintes des modules visés et les 232 noms du moteur dont le marais dépend. Calculé par `outils/generer-retouches.py`. |
| `retouches/points-d-accroche.md` | La liste lisible des retouches. |
| `etape.py` | L'étape de construction, exécutée sur le jeu que vient de construire `build.py`. |
| `construire.py` | Construit le jeu avec le marais sans toucher `build.py`. Écrit hors du dépôt, jamais dans `game/zombie-survival.html`. |
| `outils/` | `generer-retouches.py`, `reprendre-sources.py` (première reprise), `etiquettes.py`, `comparer.py`, `provenance.py`. |
| `essais/` | Essais légers, sans rendu : `syntaxe.js`, `flashs.js`, `confort.js`, `sur-autres.py`. Par la file commune : `navigateur.js` (essai en navigateur) ; `e2e-comparer.sh`, `e2e-bilan.py`, `refus-souris.js` et `e2e-tranche.js` (essais E2 rejoués dans la page). |
| `PROVENANCE.md` | Provenance de chaque fichier : origine, empreintes, transformation, licences. |

## Construire

```bash
python3 engine/marecages/construire.py
```

Le jeu est écrit dans `~/dev/zs-verif-logs/marecages/constructions/zombie-survival-marecages.html`, ou ailleurs avec
`--out`. `python3 engine/tools/build.py` écrit le même jeu, octet pour octet, dans `game/zombie-survival.html` (depuis le
2 novembre 2026 ; vérification de départ : `python3 engine/tools/build.py --out /tmp/zs.html`, puis `cmp` avec
`game/zombie-survival.html`). Le jeu sans la carte, par exemple pour le comparer au jeu officiel :
`ZS_SANS_MARECAGES=1 python3 engine/tools/build.py --out /tmp/sans.html`.
L'étape vérifie, et s'arrête avec un message clair au moindre écart :

- la version et l'interface du jeu : validées pour le jeu 2.0.6 ou 2.0.7, interface 9 ou 10 ;
- que les 232 noms du moteur dont le marais dépend sont toujours déclarés ;
- que chaque motif est trouvé exactement une fois, et dans la déclaration où il a été validé ;
- que les modules autonomes sont intacts ;
- qu'aucun nom n'est déclaré deux fois ;
- qu'aucune source ne remplace `console.error`.

Les modules visés qui ont changé depuis la validation sont signalés sans arrêter la construction : leurs retouches restent
contrôlées une par une.

**La ligne de la fin de `build.py`.** Elle est en place dans ce worktree ; Claude 5 la reprendra à la fusion. Elle se place
en dernier, juste avant l'écriture du fichier, après les blocs de Carte et de Bunker 7 :

```python
# Marécages Maudits : retouches, sources et modules du kit 2.0.7 « Stryges » (engine/marecages/LISEZ-MOI.md) ;
# s'arrête avec un message clair si une retouche ne tient plus.
exec(open(os.path.join(KH, 'marecages', 'etape.py'), encoding='utf-8').read())
```

## Essais légers (sans rendu)

```bash
node engine/marecages/essais/syntaxe.js FICHIER.html
python3 engine/tools/dupcheck.py FICHIER.html
node engine/marecages/essais/flashs.js
node engine/marecages/essais/confort.js
python3 engine/marecages/essais/sur-autres.py FICHIER.html DOSSIER_ENGINE
python3 engine/marecages/outils/comparer.py ~/dev/zs-verif-logs/marecages/kit-2.0.7-stryges DOSSIER
```

- `syntaxe.js` compile chaque bloc `<script>` sans l'exécuter.
- `dupcheck.py` cherche les noms déclarés deux fois.
- `flashs.js` simule 20 minutes d'orage au plus fort et une nuée de Stryges, avec 12 seuils et 3 tirages.
- `confort.js` vérifie les secousses, le voile blanc et le diagnostic.
- `sur-autres.py` essaie l'étape sur le jeu construit par un autre chantier, sans rien écrire chez lui.
- `comparer.py` fait le rapport des différences avec le kit.

## Essais en navigateur (par la file commune)

`essais/navigateur.js` (option (a) choisie par Anthony le 2 novembre 2026) charge le jeu dans un Chromium sans tête. Il
pilote le navigateur par deux tubes, sans socket, sans Playwright et sans `node_modules`, et ne touche à aucun outil
commun. Le jeu est emballé comme le fait le launcher (réécriture du HTML par `gamepack.js`, réutilisée telle quelle),
puis servi en local. Comme le demande la consigne du 2 novembre, la souris verrouillée est refusée avant le chargement du
jeu, et le bandeau « Souris libre » est masqué dès le menu.

Toujours par `zs-lourd`, jamais directement :

```bash
~/outils/bin/zs-lourd --classe jeu --memoire 3000 --nom "Marécages : essais en navigateur" -- node engine/marecages/essais/navigateur.js FICHIER.html DOSSIER
```

Les étapes :

- `menu` : la carte au menu.
- `global` : rien n'est installé au chargement du jeu.
- `charger` : une partie dans le marais.
- `confort` : les secousses.
- `diag` : F8 et Maj+F8.
- `eclairs` : la lumière mesurée à l'écran pendant un éclair au sol, dans trois réglages (comme le kit, « limités »,
  « réduits »).
- `autres` : Bunker 7 et Khamsin, chargés après le marais.

Mesure du 2 novembre 2026 : 3 min 29 s, 1,8 à 2,1 Go au plus, aucune erreur de la page. Résultats et images dans
`~/dev/zs-verif-logs/marecages/rapports/2026-11-02/navigateur/`.

## Essais E2 rejoués dans la page (jeu officiel et jeu avec le marais)

Accord d'Anthony du 2 novembre 2026 : `npm ci` fait dans ce worktree (Electron non décompressé), puis la série.

- `essais/e2e-comparer.sh` rejoue les blocs de 19 essais E2 du jeu avec `engine/tools/e2e-page.js`, utilisé tel quel :
  d'abord sur le jeu officiel, puis sur le jeu avec le marais. Chaque essai est un travail de la file commune.
- `essais/refus-souris.js`, chargé par `NODE_OPTIONS=--require`, refuse la souris verrouillée et masque le bandeau dans
  chaque page de Playwright, sans modifier `mains.js`.
- `essais/e2e-bilan.py` compare chaque vérification et chaque bloc en erreur, message compris. Il met à part les valeurs
  mesurées qui changent d'un passage à l'autre (temps, tirages, physique).
- `essais/e2e-tranche.js` (option `--sections` du script) rejoue telle quelle une section d'un essai qui suit des clics,
  avec les clics et le clavier de Playwright : la page tient lieu de fenêtre du jeu du launcher. Par défaut, la section
  « écran Modèles » de `dogs` et de `zone-zombies`, que `e2e-page.js` ne peut pas rejouer. Comme dans la méthode E2 :
  1280 × 720, délai de 180 s, boucle du jeu active. Un seul travail de la file par jeu.

```bash
engine/marecages/essais/e2e-comparer.sh [--sections] JEU_MARAIS.html DOSSIER [essai…]
python3 -I engine/marecages/essais/e2e-bilan.py DOSSIER [A B]
```

À la fin, le script remet le jeu officiel dans `launcher/game/`. Les essais des Mod Tools et de la publication demandent le
launcher : ils restent à la méthode E2 d'Anthony.

Série du 2 novembre 2026 :
- jeu officiel : 475 vérifications sur 482 ;
- jeu avec le marais : 472 sur 482.

Les trois écarts viennent de comptes figés dans les essais : trois cartes et onze fiches. Le reste est identique, blocs en
erreur et messages compris. Les échecs à prévoir dans la suite complète sont listés dans le rapport,
`~/dev/zs-verif-logs/marecages/rapports/2026-11-02/e2e-page/analyse.md`.

Après l'adaptation de ces comptes (accord d'Anthony, même jour) :
- `khamsin`, `ombre` et `dogs` : 44 sur 48 des deux côtés, aucune différence réelle (`e2e-page-comptes/`) ;
- sections « écran Modèles » de `dogs` et `zone-zombies`, avec `--sections` : 15 sur 15 des deux côtés
  (`e2e-sections/`).

Restent les essais des Mod Tools, qui demandent le launcher.

L'essai de bout en bout `marecages` (`launcher/e2e/marecages.e2e.js`, Electron, méthode E2) : 54 vérifications, écrit le
11 novembre 2026 (accord d'Anthony). Ses 46 vérifications faites dans la page passent aussi par `engine/tools/e2e-page.js`
(chaque bloc recharge le marais s'il n'est pas là) : 46 sur 46 sur le jeu fusionné de la 2.0.7 (`89bd203`). Les 8 autres
(clics de « Jouer », écran Modèles, retour au Bunker 7, image) : sections rejouées par `essais/e2e-tranche.js`
(`marecages:« Jouer »`, `marecages:écran Modèles`, `marecages:retour au Bunker 7`) : 7 sur 7, et l'image du bloc conforme
(424 appels de dessin, 0 erreur WebGL). À ajouter à `test:e2e` de `launcher/package.json` (fichier commun) à l'intégration.

Le même jour, deux comptes manqués le 2 novembre : l'écran « Jouer » de `khamsin` (ligne 64) et d'`ombre` (ligne 65)
attendait trois fiches ; avec le marais, il y en a quatre. Rejoué avec les clics (`e2e-tranche.js`) : 1 sur 2 avant la
correction, 2 sur 2 après, sans et avec la carte. `e2e-tranche.js` donne aussi `ok` et `errors` aux sections, comme en tête
de chaque essai.

## Temps de chargement (13 novembre 2026)

Demande d'Anthony du 12 novembre 2026, par la session 5 (`docs/integration/correctifs-fusion/pour-marecages-chargement.md`
du worktree d'intégration) : 14,6 s pour construire le marais sur son PC (RTX 3080, Direct3D 11).

- **Mesure** : `maLoad` écrit une ligne `[chargement] marais : … en tout ; préparation … ; terrain et ciel … ; lieux … ;
  végétation … ; éléments et barques … ; couleurs … ; eau et brume … ; effets des créatures … ; pluie et orage … ;
  réglages de la vue … ; Mère-Vase … ; précompilation … ; autotest de la pluie … ; N programmes compilés`
  (`console.info`, recopiée par le launcher 1.4.0 dans `launcher.log` ; rien dans les Mod Tools). Une étape qui relit la
  carte graphique (précompilation, autotest) attend aussi le travail des étapes d'avant.
- **Brume** (`maMistTexture`) : pixels écrits dans une image neuve, sans `getImageData` ; même texture (comparée sur la
  toile et telle que la carte graphique la reçoit : 0 octet d'écart).
- **Autotest de la pluie** : une fois par session (`maWxSelfTestSession`, résultat dans `MA.wxTest`) ; aux chargements
  suivants, le résultat est repris (version simple posée tout de suite si la normale ne s'affichait pas). Le contrôle en
  jeu (`maWxProbe`) reste à chaque chargement ; `ZS.marais.meteo.test()` refait l'autotest à la demande.
- **Mesuré en rendu logiciel** (Chromium sans tête, jeu de l'intégration `e77863f`, deux chargements du marais à la
  suite) : premier chargement 25,1 s → 24,2 s ; second 4,9 s → 1,7 s. Au premier, 10,1 s de précompilation (96
  programmes) et 8,1 s d'autotest, qui attend surtout la fin de cette compilation : l'attente que causait la brume s'est
  reportée là. Le gros du temps est la compilation des shaders, voulue (`maPrewarm` évite les gels en partie). Sur la carte
  graphique d'Anthony, la répartition est à lire dans sa ligne `[chargement] marais`.
- **Mesures d'Anthony** (RTX 3080, Direct3D 11, construction 5, 13 novembre 2026) : `11,6 s en tout ; lieux 1,5 s ;
  éléments et barques 4,2 s ; Mère-Vase 4,0 s ; précompilation 1,1 s ; autotest de la pluie 0,1 s ; 96 programmes`.
  Chez lui, la carte graphique n'est pas le goulot : la brume et l'autotest ne coûtaient presque rien ; le temps est au
  calcul (modèles et textures).

### Peau de la Mère-Vase par morceaux (13 novembre 2026)

Demande d'Anthony par la session 5 (« construire la Mère-Vase seulement quand elle sert »). Elle sert déjà en partie (elle
chasse sur l'eau, mange les Noyés) : la construire au premier besoin gèlerait le jeu 4 s. Sa décision : « Par morceaux en
jeu ».

- **Mesure** (Node, module du kit) : en qualité haute, 7,0 s de création, dont 6,4 s pour les quatre textures de la peau
  (2048 × 1024 : couleur, relief, rugosité, pores lumineux) ; géométrie 0,18 s ; gueule 0,28 s.
- **Retouches du module** (`retouches/modules.py`, appliquées par `etape.py` après le contrôle de l'empreinte, chacune
  trouvée exactement une fois) : `makeSkinTextures` devient un générateur (`makeSkinTexturesPas`) qui rend la main après
  chaque ligne de pixels et toutes les 64 verrues ; `makeSkinTextures` le déroule d'un trait comme avant ; `create` accepte
  des textures de peau faites (`skinTextures`) ; l'API donne le générateur (`MereVase.skinTexturesSteps`). Peau identique
  à l'octet près en qualités haute, moyenne et basse (empreintes des données comparées dans Node), pas plus lente.
- **Dans le marais** (`src/ma09_beast.js`, `MA_PEAU`) : au premier chargement de la session, la bête est créée avec une
  peau provisoire (textures de 4 × 4 pixels, mêmes réglages : teinte moyenne, relief plat, sans pores) ; `maPeauPas`
  (appelée par `maUpdate`) calcule la peau pendant la partie, au plus 5 ms par image (10 ms quand le joueur est sur l'eau
  ou qu'elle s'éveille ; un morceau n'est lancé que s'il tient dans ce budget, d'après leur durée moyenne) ; `maPeauPose`
  remplace les provisoires une par une (une par image), chacune envoyée tout de suite à la carte graphique
  (`maPeauEnvoi` : une image de 1 × 1 pixel), sans recompiler (mêmes réglages des textures). Ligne
  `[chargement] marais : peau de la Mère-Vase prête en partie, … après le chargement (… de calcul en … morceaux, qualité …)`.
  F8 : « peau en calcul » ou « peau calculée en partie ». Sans le générateur du module : création d'avant, d'un trait.
- **Mesuré en rendu logiciel** (jeu de l'intégration, construction 5, qualité haute) : étape « Mère-Vase » de 4,5 s à
  0,9 s ; premier chargement de 30,4 s à 24,6 s ; peau prête environ 20 s après le chargement (2,8 s de calcul, 3 111
  morceaux) ; aucun programme de plus. Essais dans la page : `marecages` 48 sur 48 (2 vérifications de la peau),
  `sauvegarde-cartes` 26 sur 26, `sauvegarde` 83 sur 83.

## Confort (décisions d'Anthony du 1er novembre 2026)

Deux clés des réglages du jeu (`settings`, enregistrés sous `zs.settings`) attendent l'écran des options (session
Interface) :

- `settings.shake = true` : les secousses et balancements de la caméra du marais reviennent, comme dans le kit.
  - Par défaut, aucun : les 20 secousses (bête, barque, Noyés, foudre, Stryges), le balancement de la nage, la vue
    secouée du nageur tenu sous l'eau et les à-coups de la barque dans la vue du barreur.
  - La vue du barreur suit alors la pose calme de la barque : houle, virage, avant qui se lève, soulèvement par la bête.
  - La barque et les créatures gardent toutes leurs animations.
  - Les secousses et à-coups du jeu de base sont coupés eux aussi dans le marais, sur décision d'Anthony du 2 novembre
    2026 : coups reçus, morsures, grenades et explosions, Glas, véhicules. Le recul de l'arme reste. Sur les autres cartes,
    ils ne changent pas (`maSecousseVue`, `retouches/confort.py`).
- `settings.flashes = 'reduced'` : effets lumineux réduits. Par défaut, `'limited'`, ou rien : limités.
  - **Limités** : jamais plus de 3 flashs par seconde, quel que soit le seuil ; pic adouci ; voile blanc à 45 % ; les
    scintillements tirés au hasard à chaque image deviennent des battements de 2,4 Hz.
  - **Réduits** : jamais plus d'un flash par seconde ; montée de 60 ms et descente de 350 ms ; plafond bas ; rouge
    désaturé ; aucun voile blanc ; lueurs fixes.
  - La forme des éclairs, leurs impacts, leur tonnerre et leurs dégâts ne changent pas.

## Diagnostic (F8, Maj+F8)

Rien ne s'installe au chargement du jeu, et rien ne marche hors du marais.

- **F8** (le panneau, en lecture seule) marche sur une carte du marais, dans l'un de ces cas :
  - une partie de test des Mod Tools ;
  - `?diag=marais` dans l'adresse du jeu ;
  - `store.set('zs.diag', 'marais')` tapé dans la console.
- **Maj+F8** (appeler la bête) marche seulement dans une partie de test des Mod Tools.
- `console.error` n'est plus remplacé : les erreurs du marais passent par `maErr`.
- Le message aux joueurs quand le pilote graphique réinitialise le rendu reste, dans le marais seulement.

## Étiquettes de versions

Dans `src/` et `retouches/kit.py`, le mot « jeu » ne désigne plus que les vrais numéros du jeu (2.0.6, puis ceux de Claude 5).

- « kit MM 2.1.x » : les versions de travail des Marécages Maudits (kits « 2.1.x (non signée) »), jamais publiées.
- « MM 2.1.x » : la même chose, quand le kit écrivait le numéro seul.
- « kit 2.0.7 » : le kit « Stryges » du 31 octobre 2026, non publié.

Les textes d'origine restent dans la copie de référence. Les modules de `orig/` sont gardés tels quels, leurs commentaires
compris.

## Quand une retouche ne tient plus

1. Lire le message. Il nomme la retouche, son lieu, la déclaration attendue et la session qui travaille sur ce code.
2. Comparer le code actuel avec la version validée : `git show 3667acd:engine/src/<module>`, ou le jeu 1.9.0 pour le jeu de
   base.
3. Reprendre le motif dans `retouches/kit.py`. Le motif doit être le plus court possible, unique, et rester dans la même
   déclaration. Exemples : `damageZombie stryges`, raccourci le 1er novembre pour Bunker 7 ; `hitscan let` et
   `explode marais`, raccourcis le 10 novembre pour Bunker 7.
4. Relancer `python3 engine/marecages/outils/generer-retouches.py <kit>`. Il garde `kit.py` et recalcule les contrôles.
5. Reconstruire, relancer les essais légers, puis l'essai de bout en bout du marais.
6. Ne jamais modifier le fichier d'une autre session. Si une retouche doit changer de nature, l'écrire à Claude 5.

## Effets globaux au chargement (connus et voulus)

- `maTextures` (ma01) ajoute 13 textures « (Marais) » à la bibliothèque, pour toutes les cartes et les Mod Tools.
- `maHFogPatch` (ma14) modifie les morceaux de nuanceur du brouillard de three.js pour toutes les matières. Hors du marais,
  sa branche reste éteinte (`uHFog` nul) ; c'est aux essais de bout en bout de le confirmer en image.
- Inscriptions : bases `marais` et `marais_vierge`, monde `marais`, sols 17 à 22, type de véhicule `barque`, fiches de
  l'écran Modèles (Noyé, Stryge), carte « Les Marécages Maudits » au menu, avec son tampon « En développement ».
