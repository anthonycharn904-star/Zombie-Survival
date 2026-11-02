# Scène de la Mère-Vase : procédure de capture

**Le but** : enregistrer en vidéo, dans le jeu du kit 2.0.7, la vraie scène de la Mère-Vase qui attaque et dévore des Noyés, sous l'averse et l'orage. La vidéo servira de fond animé à l'accueil du launcher (maquette D). Tout ce qu'on voit vient du jeu : carte, bête, Noyés, pluie, orage, brume, sons.

**Statut au 2 novembre 2026** : Anthony a choisi l'option A (le comportement réel, §1) et autorisé la capture le 1er novembre (« Tu peux y aller ! »).
- Faits : l'essai court et le cadrage. La partie est reproductible au pixel près d'un lancement à l'autre (§4).
- **Capture complète faite le 2 novembre**, sur l'ordre d'Anthony (« lance la capture ») : par la file `zs-lourd` (350 s d'attente, 27 min de travail, 1,48 Go au plus), fenêtre de 1,2 à 9,9 s, 261 images par version. Même partie aux trois passages (bond à 3,317 s, 0 image différente, même journal), hasard pris hors du jeu : 0. Deux bonds, deux Noyés engloutis (4,42 et 7,73 s), un éclair dans les nuages à 4,4 km (images 64 à 67 : la scène s'éclaircit de 6,9 niveaux au plus, surtout l'eau ; ailleurs, les deux versions sont identiques). Aucun éclat au seuil de 10 % de luminance relative. Sorties : `sortie/capture/`.
- L'encodeur passe par ffmpeg depuis le 2 novembre, avec son accord (§3 bis) ; il a été relu de façon indépendante et corrigé le même jour.
- **Vidéos faites le 2 novembre** avec les réglages choisis par Anthony (CRF 28, fondu d'une seconde) : `../ressources/marecages/fond-marais.webm` (4,51 Mo) et `fond-marais-sans-eclairs.webm` (4,46 Mo), boucle de 7,7 s, hors de Git. La maquette D les montre (`../sortie/D-hybride.html`) ; `essai.js` : 142 vérifications sur 142 après les corrections du départ et de la bascule (67 pour D).
- Les sons du kit sont exportés (§7).

## 1. Ce que le jeu du kit fait vraiment (lu dans ses sources, sans exécution)

- **La chasse aux Noyés** (`ma09_beast.js`, `ma15_noyes.js`) :
  1. Le joueur est hors de l'eau. Les Noyés le regardent depuis l'eau (état `stare`).
  2. La bête éveillée choisit le plus proche (`maBeastFeast`) et nage vers lui (`festin`, 9 m/s).
  3. Elle bondit (`ruee`, clip de 1,9 s : jaillit, impact à 0,7 s, retombe à 1,25 s).
  4. À l'impact, elle engloutit jusqu'à 3 Noyés à moins de 2,4 m de la gueule (`maLeapImpact`, `maNoyesEngulf`, `maNoyeEaten`), avec une gerbe de sang, des lambeaux du ciré et le craquement de la mâchoire (`saisie`).
  5. Après 2,2 s de repos, elle peut recommencer sur un autre Noyé.
  - C'est ce que montre la capture 13 du kit (« la Mère-Vase se jette sur un Noyé »), et c'est ce que le script enregistre.
- **Le clip « dévoration »** (3,6 s : `saisie`, deux `secousse`, `avale`, `plonge`, victime tenue par l'ancre `bite`) ne sert, dans le jeu, qu'à la dévoration du joueur (`maDevourUpdate`), jamais à celle d'un Noyé.
  - Un plan avec ce clip et un Noyé comme victime utiliserait les vrais modèles et le vrai clip, mais dans une scène qui n'existe pas en jeu.
  - C'est l'option B. **Anthony a choisi l'option A** le 31 octobre (« Option A ») : le comportement réel, que fait le script.

## 2. Conditions de capture (toutes requises)

1. **L'accord explicite d'Anthony** pour exécuter le jeu du kit, dans sa copie vérifiée (`kit/`), avec le Chromium sans tête.
   - Donné le 1er novembre 2026 (« Tu peux y aller ! »). Après l'incident du même soir (point 4), chaque relance s'est faite avec son feu vert.
   - Analyse faite : aucun appel réseau externe, un seul chargement local (`maps/index.json`).
2. **La file commune `zs-lourd`** (consigne d'Anthony du 2 novembre 2026). Tout passage qui fait tourner le jeu (cadrage, essai, capture) passe par `~/outils/bin/zs-lourd --classe jeu`, avec un budget mesuré (§3), jamais hors de la file.
   - La classe `jeu` n'a qu'une place pour les six sessions : une seule instance du jeu à la fois.
   - Un travail ne part que s'il reste son budget plus 3 Go, après les réservations des travaux en cours.
   - Code 75 : refus ou attente trop longue. Ne pas relancer en boucle : réduire le travail ou prévenir Anthony.
3. **La garde propre du script**, adaptée à la file le 2 novembre 2026 avec l'accord d'Anthony (§2 bis). `--forcer` la lève, seulement sur son ordre.
   - Sous la file : la file a déjà décidé du départ. Pendant la capture, la mémoire est mesurée avant chaque appel à la page, et le script s'arrête (sortie 4) si la mémoire disponible tombe sous 1,5 Go, le seuil d'alerte de la file.
   - Hors de la file (que la consigne interdit) : au départ, aucun Blender, moins de 0,5 de charge par processeur logique et au moins 10 Go disponibles, sinon sortie 3 ; arrêt sous 2,5 Go pendant la capture.
   - La dernière ligne d'un passage dit s'il a tourné « sous la file zs-lourd » ou « hors de la file ».
4. **La souris verrouillée est refusée dans la page.** Le jeu la demande à chaque partie (`startGame`). Si elle est accordée, le Chromium sans tête boucle sur des « souris déplacée » synthétiques, et sa mémoire gonfle. Le refus fait passer le jeu en mode sans verrou (`setFallback`), sans effet sur l'image : seul le canevas est capturé, sans le HUD.
   - **Incident du 1er novembre 2026** : des instances du jeu de 7 à 18 Go, celle-ci et celles d'autres sessions, ont saturé la mémoire d'Ubuntu, qui a été redémarré de force à 21 h 26.
   - La session Bunker 7 a trouvé la cause : le verrou de la souris.
   - Avec le refus, le cadrage a pris environ 2 Go en 1,1 min, au lieu de 7 à 8 Go.
   - Le bandeau « Souris libre » (`#lockhint`), que le jeu affiche alors, n'entre pas dans les images : seul le canevas du rendu est lu, pas la page.

## 2 bis. La garde du script face à la file (adaptée le 2 novembre 2026)

Avant l'adaptation, la garde de départ du script pouvait refuser un travail que la file venait d'admettre. Le script sortait alors avec le code 3 : la place était rendue, mais l'attente déjà faite et la position dans la file étaient perdues. Trois cas, vérifiés dans le code des deux outils :
- **Mémoire** : la file admet un budget de 4 Go dès 6,9 Go disponibles après les réservations, alors que le script exige 10 Go.
- **Charge** : la file n'a aucun critère de charge et laisse tourner un jeu à côté de rendus Blender, qui dépassent à eux seuls 0,5 par processeur logique. Cette nuit, la charge était de 0,51 à 0,53 par fil pendant que la file faisait tourner un jeu et une cuisson.
- **Blender** : la file permet un jeu à côté d'un rendu si la mémoire suffit ; le script refuse. Depuis une session Claude Code, ce test ne voit d'ailleurs aucun Blender, car `ps` n'y montre que les processus du bac à sable.

En cours de capture, l'arrêt sous 2,5 Go tombait dans la réserve que la file garde pour les sessions (3 Go). Une capture de 45 min aurait pu s'arrêter sans vraie saturation.

**Adaptation faite**, acceptée par Anthony le 2 novembre 2026 (« Oui, les deux »), sans effet hors de la file :
- le script reconnaît qu'il tourne sous la file, quand `ZS_LOURD_CLASSE` vaut `jeu` et que le fichier `ZS_LOURD_PLACE` existe (il est effacé à la fin du travail) ;
- il saute alors sa garde de départ, puisque la file a déjà décidé ;
- il garde son arrêt en cours de route, avec le seuil d'alerte de la file : 1,5 Go au lieu de 2,5. La file n'agit jamais sur un travail en cours : cette nuit, elle a laissé la mémoire descendre à 0,33 Go.

La même adaptation est faite dans `engine/tools/banc-interface/vue3d.js` (garde de charge).

Contrôle : la ligne de détection des deux outils, évaluée dans quatre situations, répond comme prévu. Classe `jeu` avec la fiche : oui. Fiche absente, autre classe ou aucune variable : non. La première capture par la file le confirmera par sa dernière ligne.

## 3. Étapes

| Étape | Commande | Coût mesuré (rendu logiciel) | État |
|---|---|---|---|
| 0. Copie vérifiée du jeu du kit | `bash preparer.sh` | quelques secondes | refaite le 1er novembre à 20 h 31 (kit mis à jour le 31 octobre à 23 h 10 : arrivée des Stryges) : 16 fichiers conformes, `index.html` `ee29cf3b114810cc…` ; ancienne copie gardée dans `kit/ancien-2026-10-31-2224/` |
| 1. Essai court | `capturer.js --essai` (640 × 248, 3 s) ; file : `jeu`, 3 500 Mo | 16,9 min, avant le refus de la souris verrouillée | fait le 1er novembre à 20 h 38 : même partie aux trois passages, au plus un éclat par seconde ; caméra mal placée (derrière le bord du ponton), refaite |
| 2. Cadrage | `capturer.js --cadrage` (640 × 248, une image par 1/3 s sur toute la fenêtre de la capture) ; file : `jeu`, 3 000 Mo (3 500 Mo en 1 600 × 620) | 1,1 min, environ 2 Go ; en 1 600 × 620, 2,9 min pour 27 images, environ 3 Go | refait le 2 novembre, version reproductible : trois bonds, le troisième sur la caméra (§5 bis) ; puis en 1 600 × 620 sur la fenêtre proposée (`--largeur 1600 --hauteur 620 --duree 8.7`) |
| 3. Capture | `capturer.js --duree 8.7` (1 600 × 620, 30 images/s : 261 images par version, deux versions) ; file : `jeu`, 4 000 Mo (2 000 suffiraient : pic × 1,25) | 27 min, 1,48 Go au plus (mesure du 2 novembre) | faite le 2 novembre sur l'ordre d'Anthony : partie conforme (statut en tête) |
| 4. Vidéos et affiches | `encoder.js` (ffmpeg), une fois par version (commandes ci-dessous) ; commande directe (environ 0,6 Go au plus, sous le seuil de 1 Go de la consigne) | 1 à 2 min chacune (deux passes, priorité basse) | fait le 2 novembre sur la vraie capture, avec les réglages choisis par Anthony (CRF 28, fondu d'une seconde) : `fond-marais.webm` 4,51 Mo et `fond-marais-sans-eclairs.webm` 4,46 Mo, 231 images chacune, même boucle ; la première identique à l'octet à l'essai en CRF 28 (§3 bis) |
| 5. Maquette D avec la vidéo | `python3 ../assembler.py`, puis `node ../essai.js` | léger | fait le 2 novembre avec la vraie vidéo : 142 vérifications sur 142 (les quatre directions ; D en mode vidéo, 67 contrôles, tonnerre sur le vrai éclair, départ depuis l'affiche et bascule en pleine lecture compris ; 136 avant ces deux corrections). Avant, avec des vidéos d'essai de ffmpeg : 61 sur 61 pour D avec l'essai court du 1er novembre (son éclair, `--fondu 0.3`) ; 59 sur 61 avec les images 2D, comme avec l'ancienne vidéo : encodées sans `--journal`, elles n'ont pas d'éclair dans leur chronologie, donc les deux contrôles du tonnerre échouent |
| 6. Contrôle visuel | `node planche.js sortie/capture/images sortie/capture/images-sans-eclairs`, maquette D | — | par Anthony |

**Après chaque passage**, je lis le journal (ponton, Noyés placés, états de la bête, bonds, engloutissements, éclairs) et je regarde les images. Je ne passe à l'étape suivante que si la scène est juste.

**Les commandes**, depuis `~/dev/zs-interface`, après un coup d'œil à la file (`~/outils/bin/zs-lourd etat`) :

```bash
~/outils/bin/zs-lourd --classe jeu --memoire 3000 --nom "Mère-Vase : cadrage 640x248" -- node maquettes/launcher/scene-bete/capturer.js --cadrage
```

```bash
~/outils/bin/zs-lourd --classe jeu --memoire 4000 --nom "Mère-Vase : capture 1600x620" -- node maquettes/launcher/scene-bete/capturer.js --duree 8.7
```

```bash
node maquettes/launcher/scene-bete/encoder.js maquettes/launcher/scene-bete/sortie/capture/images --journal maquettes/launcher/scene-bete/sortie/capture/journal.json --sortie maquettes/launcher/ressources/marecages/fond-marais.webm
```

```bash
node maquettes/launcher/scene-bete/encoder.js maquettes/launcher/scene-bete/sortie/capture/images-sans-eclairs --sortie maquettes/launcher/ressources/marecages/fond-marais-sans-eclairs.webm
```

- `planche.js` (environ 0,3 Go), `encoder.js` (environ 0,6 Go), `comparer-video.py` (0,5 Go), `couleurs-video.js` (0,6 Go), `preparer.sh` et `assembler.py` restent des commandes directes, une à la fois.
- La capture dure environ 45 min. Dans une session, la lancer en arrière-plan : une commande de premier plan est tuée au bout de 10 min, et `zs-lourd` avec elle, sans ligne de fin au journal.
- Les budgets viennent des mesures des cadrages (2,2 à 2,8 Go pris en 640 × 248, environ 2,7 Go en 1 600 × 620), avec la règle de `zs-lourd` : pic × 1,25, arrondi au multiple de 500 Mo supérieur. Après chaque passage, relire la colonne `pic_go` (`zs-lourd journal 5`) et ajuster.
- Codes de sortie de `capturer.js` :
  - 0 : réussi ;
  - 75 : refus ou attente dépassée (`zs-lourd`) ;
  - 3 : refus de la garde de départ du script, hors de la file seulement (§2 bis) ;
  - 4 : capture arrêtée par sa garde de mémoire ;
  - 2 : copie du kit absente ;
  - 1 : erreur, ou contrôle non conforme.

  Après 75 ou 3, ne pas relancer en boucle.
- Codes de sortie d'`encoder.js` : 0 réussi ; 2 réglages, journal, images ou outils invalides (rien n'est écrit) ; 1 erreur d'encodage ou vidéo relue non conforme (rien n'est remplacé) ; 129, 130 ou 143 arrêté par un signal (vidéo partielle et journal des passes effacés).

## 3 bis. L'encodeur vidéo (ffmpeg depuis le 2 novembre 2026)

**Pourquoi.** L'ancien `encoder.js` passait par l'enregistreur de Chromium (MediaRecorder), faute de ffmpeg. Cet enregistreur date chaque image à l'horloge réelle : une image lente à préparer reste en retard dans la vidéo, ou se perd. Anthony a installé ffmpeg le 2 novembre 2026 et accepté le changement le même jour (« d'accord pour ffmpeg »). L'ancien script est gardé hors de Git : `sortie/ancien-2026-11-02/encoder-mediarecorder.js`.

**Mesures du 2 novembre 2026, sur la scène 2D d'essai** (360 images de `images-2d.js`, 1 600 × 620 ; boucle de 330 images) :

| Vidéo | Taille | Images | PSNR moyen (pire image) | SSIM moyen (pire image) | Couleurs dans Chromium : biais moyen par canal (R ; V ; B), 7 images |
|---|---|---|---|---|---|
| Ancienne (MediaRecorder, 31 octobre) | 3,67 Mo | 327 : 3 perdues (31, 206 et 329, la dernière de la boucle) ; l'image 1, codée sur 676 octets, montre presque l'image 0 ; écarts de 15 à 82 ms | 39,3 dB (32,6) | 0,955 (0,893) | −0,82 ; +0,61 ; −0,69 (légère teinte verte) |
| ffmpeg, CRF 32 | 4,23 Mo | 330, écarts de 33 ou 34 ms | 42,5 dB (39,6) | 0,976 (0,970) | +0,13 ; −0,09 ; −0,10 |
| **ffmpeg, CRF 40 (défaut)** | **2,39 Mo** | 330, idem | 40,5 dB (37,2) | 0,965 (0,953) | +0,10 ; −0,13 ; −0,08 |
| ffmpeg, CRF 44 | 1,72 Mo | 330, idem | 39,3 dB (36,1) | 0,956 (0,943) | — |
| ffmpeg, CRF 48 | 1,20 Mo | 330, idem | 38,2 dB (34,9) | 0,947 (0,931) | — |

- **Images et rythme** : paquets relus un à un. Les temps du WebM sont en millisecondes : 33,3 ms donnent 33 ou 34. Chez l'ancienne, l'image manquante en fin de boucle et l'image 1 presque identique à l'image 0 font un à-coup à chaque tour. Le premier relevé disait « 4 perdues, l'image 0 en double » ; la relecture a montré que l'image 1 est sous-codée plutôt que perdue (confiance d'environ 90 %), ce qui ne change pas l'à-coup.
- **Fidélité** : les 300 images pures de la boucle (3 manquent à l'ancienne), comparées aux images d'origine décodées par ffmpeg (`comparer-video.py`). Les pires images de l'ancienne vidéo suivent l'éclair : 12 images sous 36 dB entre les images 107 et 121, jusqu'à 32,6 dB. Le CRF 40 y garde de 37,2 à 43,9 dB. Planches à l'échelle 1 : `sortie/essai-ffmpeg/planches/` (`planche-video.py`). Recalculées par une autre méthode (filtres psnr et ssim de ffmpeg), les moyennes ne bougent que de quelques centièmes de dB, dans le même ordre.
- **Couleurs** : 7 images de la vidéo dessinées par le Chromium sans tête des essais (Chromium 141, rendu logiciel), comparées aux images d'origine décodées par lui (`couleurs-video.js`). Écart dans les zones sombres : 0,19 niveau avec le CRF 40. Ce Chromium lit donc bien les étiquettes de couleur du fichier (BT.709, transfert sRGB). Le launcher tourne sur Electron 44 (Chromium 152), avec la carte graphique, sous Windows : à revoir à l'intégration.
- **Mode de qualité** : `-crf` et `-b:v` donnés ensemble mettent libvpx en qualité contrainte. Loin du plafond de débit, il code plus fin que le CRF : au CRF 40, 270 images sur 330 au niveau de quantification 139 au lieu de 160, à 1,74 Mbit/s pour un plafond de 4,5. Quand le plafond mord, il code plus grossier.
- **Reproductible** : mêmes images et mêmes réglages donnent le même fichier, à l'octet (deux encodages comparés ; ffmpeg 6.1.1, libvpx 1.14.0, mêmes options, dont `-threads 4`). La version corrigée après la relecture donne le même fichier que la première.
- **Coût** : environ 0,6 Go au plus, de 53 à 103 s selon la charge de la machine, en priorité basse.
- **CRF 40 sur la scène 2D** : il bat l'ancienne vidéo sur toutes les mesures, avec un fichier plus petit d'un tiers. Le CRF 44 n'atteint que la fidélité moyenne de l'ancienne, avec un fichier deux fois plus petit. Pour la vraie capture, Anthony a choisi le CRF 28 (plus bas). Changer de réglage ne demande qu'un nouvel encodage : `--qualite <CRF>`.
- **Sur la vraie capture** (2 novembre ; boucle de 231 images, 7,7 s ; plus sombre que la scène 2D : luminance moyenne 41,5 contre 66). Encodée en CRF 28, 32, 36 et 40, puis mesurée (`comparer-video.py`) et regardée sur des planches agrandies deux fois : agrandie sur l'écran de 3 440 × 1 440 d'Anthony, la fenêtre montre la vidéo à × 1,96.

  | CRF | Taille (avec éclairs) | PSNR moyen (pire image) | SSIM moyen (pire image) |
  |---|---|---|---|
  | 28 (plafond relevé à 8 Mbit/s) | 4,51 Mo | 43,6 dB (41,1) | 0,981 (0,974) |
  | 32 | 3,41 Mo | 42,6 dB (40,1) | 0,978 (0,969) |
  | 36 | 2,65 Mo | 41,7 dB (39,0) | 0,974 (0,965) |
  | 40 | 2,11 Mo | 40,8 dB (37,9) | 0,970 (0,959) |

  - À l'œil (`sortie/capture-videos/planches/`) : aucune bande dans le ciel, à aucun réglage. La différence porte sur les fins détails, l'écume autour de la bête et les petits ronds de pluie sur l'eau : le CRF 40 en efface une bonne part, le 36 un peu moins ; le 32 et le 28 en gardent le plus, le 28 un peu plus que le 32.
  - Aucun réglage n'est bridé par le plafond : libvpx code plus fin que le niveau visé (CRF 32 : niveaux 104 à 107 pour 128). Le CRF 28 dépasse 4,5 Mbit/s en moyenne : il demande `--debit 8000000`.
  - Couleurs dans Chromium (CRF 40, 7 images) : biais moyen de 0,24 niveau au plus, 0,17 dans les zones sombres. Éclats sur la boucle, en trois tours : aucun au seuil de 10 %. Les deux versions ont la même boucle (231 images, fondu de 30, 7,7 s) ; l'éclair tombe à 2,133 s.
  - Raccord de la boucle (`raccord-boucle.jpg`) : pendant la seconde du fondu, le dos de la bête, qui affleure à droite à la fin, se dissout dans la scène du début ; deux reflets du leurre se voient un moment. C'est le contenu de la fenêtre, pas l'encodeur.
  - **Choix d'Anthony le 2 novembre 2026 : CRF 28 et fondu d'une seconde.** Ce sont désormais les réglages par défaut d'`encoder.js` (CRF 28, plafond de 8 Mbit/s), donc les commandes du §3 n'ont pas d'option à ajouter.
- **Passage avec ou sans éclairs** : la version sans éclairs n'a qu'une image clé ; pour reprendre au même instant, le lecteur peut avoir à décoder jusqu'à 230 images. Une image clé par seconde (`-g 30`) l'aurait accéléré pour 18 % de taille en plus (2,83 Mo au lieu de 2,39 au CRF 40). Corrigé autrement le 2 novembre, à la demande d'Anthony : deux lecteurs dans la maquette D (§7), sans changer les fichiers.
- **Relecture indépendante du 2 novembre** (quatre relecteurs, constats graves contre-vérifiés) : défauts trouvés et corrigés le même jour, essais à l'appui.
  - Une première image illisible donnait des dimensions nulles et une boucle sans fin (environ 4 Go, puis arrêt) ; une image illisible, tronquée ou d'une autre taille plus loin passait sans erreur. Toutes les images sont maintenant décodées une fois avant l'encodage, et la fautive est nommée (code 2).
  - La vidéo partielle s'appelait `….webm.partiel`, nom que le `.gitignore` des ressources ne couvrait pas : elle s'appelle maintenant `….partiel.webm`.
  - Le journal est lu avant l'encodage ; la vidéo est relue avant de remplacer quoi que ce soit.
  - Un fondu plus long que la boucle est refusé ; le contrôle de libvpx ne se trompe plus quand il manque ; un ffprobe absent est signalé ; SIGHUP est traité comme SIGINT et SIGTERM ; le journal des passes va dans un dossier temporaire unique.

## 4. La mise en scène (réglages sans effet sur l'aspect)

- **Le joueur**, invulnérable et caché, se tient sur un ponton, près d'une barque amarrée. C'est la condition du jeu pour que la bête chasse les Noyés (`maBeastFeast` : joueur hors de l'eau).
- **Les Noyés** : six places en eau profonde devant le ponton, de 11 à 22 m (`maNoyeSpawn`). Une place trop peu profonde est sautée : avec la graine 7, quatre Noyés sont placés. Ils sortent en 2,1 s environ, puis regardent le joueur. Leur regard dure 25 à 35 s au lieu de 4 à 8 (`MA_NOYE.stare`), pour que la bête ait le temps de venir.
- **La bête**, éveillée (`MAM.attn`, état `rode`), part à 36 m du ponton, derrière les Noyés.
  - Elle chasse d'elle-même dès que les Noyés regardent : premier bond à 3,3 s de jeu avec la graine 7.
  - Sinon, la chasse est relancée (`maBeastFeast(true)`) après `--chasse` s de jeu.
- **Le temps** : l'averse et l'orage du jeu (`ZS.marais.meteo.orage()`). Au premier bond, un éclair dans les nuages (`maFlashCloud`), dont la lumière vient de derrière la bête (§4 bis).
- **La caméra**, fixe à cause du vertige d'Anthony :
  - au ras de l'eau (1,1 m), au-dessus de l'eau libre juste devant le ponton, à 4,5 m au moins de la barque ;
  - face aux Noyés (ils regardent le joueur : on voit leurs yeux) et à la bête, qui bondit vers eux, donc vers nous ;
  - ni planche ni haut-fond entre elle et les Noyés (contrôlé en 16 points) ;
  - places essayées dans l'ordre de `CAMERA` ; avec la graine 7 : 6 m vers le large et 7 m de côté ; champ de 42° ;
  - `FX.shake` remis à 0 à chaque pas : le jeu secoue la vue au bond ;
  - ni arme (`vmScene`), ni HUD (le canevas seul est capturé), ni corps du joueur.
- **Le temps de jeu** avance par `__zs.step`, deux pas de 1/60 s par image : des images régulières, quelle que soit la lenteur du rendu.
- **Trois passages avec la même graine**, sur le seul temps du jeu (la même partie à chaque fois) :
  - le premier, sans rendu, repère l'instant du bond ;
  - le deuxième rend la fenêtre utile avec les éclairs, le troisième sans ;
  - la fenêtre : 2,5 s avant le bond, mais pas avant la fin de la mise en scène (1,2 s de jeu), puis 12 s.
- **Un déroulé reproductible**, contrôlé (même état de la scène image par image, même journal) :
  - la boucle du jeu (`frame`) et `requestAnimationFrame` sont arrêtés. L'image déjà demandée par la boucle est annulée : elle faisait un pas de jeu hors des nôtres (démarrage de l'orage, point où rôde la bête), à un moment qui dépend de l'affichage ;
  - les minuteries du jeu (`setTimeout`) partent au temps du jeu ;
  - le hasard du jeu repart de la graine au début de la mise en scène, et seule la simulation y puise (mise en scène et pas de jeu). Un appel venu d'ailleurs prend un autre hasard ; il est compté et sa provenance notée (`horsJeu`) ;
  - le rendu a son propre hasard : three.js puise dans `Math.random` en rendant, alors que le premier passage ne rend rien ;
  - le son du jeu passe par un contexte audio hors ligne (48 kHz, jamais démarré). Le vrai dépend de la carte son, et le jeu remplit son bruit avec le hasard (3 s multipliées par la fréquence) : la météo changeait d'un lancement à l'autre. La vidéo est muette ;
  - les sons de pluie, calculés par tranches d'horloge réelle (3 ms par pas, `maWxAudioPrep`), sont finis d'un coup pendant la mise en scène. À la fin de ce calcul, le jeu tire leurs départs dans son hasard (`maWxAudioStart`), à un pas qui dépendait de la vitesse de la machine ;
  - le tonnerre, calculé lui aussi par tranches d'horloge réelle (`maThunderJob`), est retiré. On garde le lieu de chaque éclair.

## 4 bis. Les éclairs

Décisions d'Anthony du 1er novembre 2026 pour la carte, appliquées au fond :
- **Au plus trois éclats par seconde** (« flashs limités », son réglage par défaut ; le kit va jusqu'à 13 à 15).
  - Un arc en retour n'est gardé que s'il part au moins 0,36 s (`ECART`) après le précédent, tous éclairs confondus.
  - Le script compte les éclats sur les images (luminance relative, seuil 0,1 du WCAG) et refuse une capture qui dépasse trois par seconde.
- **Une seconde version de la même scène, sans éclairs** : l'interrupteur « Éclairs de l'orage » du launcher agit aussi sur la vidéo.
- **Pas de secousse de caméra** (vertige).

Validé par Anthony le 2 novembre 2026 (« Nuages seulement ») : **les éclairs restent dans les nuages**. Le script neutralise l'impact au sol (`maStrikePlan`), car ses gerbes, sa vapeur, ses brûlures et les Noyés qu'il tue ne pourraient pas disparaître de la version sans éclairs.

## 5. Points vérifiés en marche (essai court et cadrages du 1er novembre 2026)

Le script s'arrête avec un message clair si l'un d'eux manque.
- Les barques sont dans `VEH.list` (`V.T.boat`, `V.group.position`), et `maOnFloor(x, z)` désigne bien les planches d'un ponton : ponton trouvé à 2 m d'une barque amarrée.
- `__zs.tp` laisse le joueur sur les planches, hors de l'eau (`maPlayerOnWater()` faux).
- Placés alors que le joueur est à terre, les Noyés sortent (en 2,1 s environ) puis regardent ; la bête les chasse d'elle-même.
- `viewCamera` remplace la caméra du rendu, `vmScene.visible = false` cache l'arme, et `toDataURL` juste après `render()` donne l'image.
- La même partie aux trois passages d'un même lancement : bond, état de la scène image par image, journal.
- Depuis le 2 novembre, la même partie d'un lancement à l'autre : deux cadrages de suite donnent les mêmes images à l'octet près (37 sur 37), le même journal et les mêmes éclairs.

## 5 bis. Le cadrage du 2 novembre 2026 (graine 7, version reproductible)

Caméra : 6 m vers le large et 7 m de côté, à 1,1 m au-dessus de l'eau, champ de 42°. Chronologie en temps de jeu, avec la distance de la bête à la caméra :
- **1,2 à 3,3 s** : le calme. La bête rôde au loin, à gauche (30 m ; on voit son leurre). Les Noyés sortent de l'eau (leurs yeux, des ronds dans l'eau).
- **3,3 s** : premier bond, à gauche, au loin (29 à 32 m), avec l'éclair dans les nuages. À 4,4 s, un Noyé est englouti.
- **5,6 à 6,6 s** : elle nage vers le suivant (de 22 à 18 m).
- **6,6 s** : second bond, à droite, tout près (de 16 à 12 m) : gueule ouverte, leurre, gerbe. À 7,7 s, un Noyé est englouti.
- **7,7 à 9,9 s** : son corps affleure à droite, puis elle nage vers le troisième Noyé (de 11 à 10 m).
- **9,95 s** : troisième bond, sur la caméra. La bête passe à 3 m puis à 1,4 m, et la caméra traverse son corps : inutilisable. À 11,05 s, un Noyé est englouti ; à 11,4 s, un éclair de l'orage.

**Fenêtre proposée** : de 1,2 à 9,9 s de jeu (`--duree 8.7`). Elle donne 261 images par version et une boucle de 7,7 s (fondu d'une seconde), et s'arrête avant le troisième bond.

## 6. Sorties

Tout reste hors de Git : la carte n'est pas publiée. `sortie/` est ignoré en entier ; dans `../ressources/marecages/`, les vidéos (y compris la vidéo partielle `….partiel.webm` pendant l'encodage), les affiches et les chronologies `fond-marais*.json` le sont aussi.
- `sortie/cadrage/` :
  - `images/` : une image par 1/3 s, sur toute la fenêtre de la capture ;
  - `cadrage.json` : réglages, étapes, état de la bête image par image, journal, éclairs ;
  - `planche.jpg`.
- `sortie/essai/`, `sortie/capture/` :
  - `images/` (avec éclairs) et `images-sans-eclairs/` ;
  - `journal.json` : les événements datés (la bête, les Noyés, les attaques, la foudre, la météo) et chaque éclair (instant dans la fenêtre, départs de ses éclats, distance, côté dans l'image) ;
  - `eclats.json` : la luminance image par image et les éclats par seconde à chaque seuil ;
  - `scene.json` : réglages, caméra, positions, et le contrôle (bond aux trois passages, images d'état différent, même journal).
- Un dossier de sortie déjà rempli est mis de côté (renommé avec la date), jamais effacé.
- `../ressources/marecages/` : `assembler.py` prend ces fichiers s'ils existent.
  - `fond-marais.webm` (avec éclairs) et son `.json` (la boucle et ses éclairs, pour le tonnerre) ;
  - `fond-marais-sans-eclairs.webm` ;
  - les affiches (`…-affiche.jpg`), celle de la version sans éclairs de préférence.
- **Règle d'Anthony du 31 octobre** : aucune image, vidéo ou ressource de cette carte sur GitHub sans son autorisation explicite. Les fichiers texte qui la décrivent (ces README, les scripts, `marais.js`) sont aussi à relire avant tout commit.

## 7. Sons de pluie et de tonnerre (exportés le 31 octobre 2026)

**Autorisation d'Anthony** : « j'autorise l'export des sons du kit » (31 octobre 2026). Ce sont des sons calculés par le jeu ; le kit ne contient aucun fichier son.

**Export** : `node maquettes/launcher/scene-bete/exporter-sons.js` (10 à 15 s, léger, sans 3D). Il demande la copie des sources par `preparer.sh`.
- **Ce qui s'exécute** : seuls les blocs du calcul audio, tels quels, dans une page vide du Chromium sans tête, sans réseau.
  - Pluie : `ma17_pluie.js`, de `maWxRand` à `maWxGenAll`. Fonctions pures : rien du jeu.
  - Tonnerre : `ma18_orage.js`, `maBoltPath` (le canal qu'on voit), puis de `maThunderChannel` à `maThunderIR`. Une seule donnée du jeu lue : le tampon partagé `MA_OR.tbuf`, fourni vide.
  - Les empreintes des deux fichiers et des trois blocs sont contrôlées avant l'exécution : si le kit change, l'export refuse de partir.
- **Les mises en scène** reprennent les appels du jeu :
  - éclair au sol : `maBoltGround` (canal principal), `maStrikePlan` (retourné, du sol vers le nuage), `maThunderChannel` avec les options du jeu ;
  - éclair dans les nuages : `maFlashCloud` ;
  - auditeur sur le ponton, oreilles à 1,6 m au-dessus des planches (`maThunderJob`) ;
  - hasard fixé : l'export se refait à l'identique.
- **Sorties** (hors de Git) : `../ressources/marecages/sons/`, décrites dans `../ressources/marecages/README.md`.
  - Six nappes de pluie, la réverbération de l'orage, six tonnerres (au sol de 450 m à 3 km ; dans les nuages à 2 et 3,5 km).
  - Maîtres WAV et fichiers Opus (WebCodecs du Chromium, pas de ffmpeg), `sons.json`, `ondes.png`.
  - `apercu-orage.wav` : 40 s d'écoute, mêlées par la chaîne du jeu.
- **Contrôle des Opus**, décodés par le navigateur comme le fera le launcher :
  - longueurs exactes, décalage nul ;
  - énergie par tiers d'octave à ±0,02 à 0,04 dB en moyenne ;
  - enveloppe des impacts corrélée à 0,99 ou plus.

**Dans la maquette D** (`../D-hybride/ambiance.js`) : le mélange du jeu.
- **Pluie** : à la force du jeu, réglée sur l'intensité de la pluie qu'on voit.
- **Tonnerre** : sur chaque éclair de la scène 2D, après l'arrivée du son.
- **Fin de chaîne** : volume général et compresseur du jeu.
- **Réglages** :
  - coupé par défaut (le launcher démarre en silence) ;
  - volume à 80 % ;
  - son seulement quand le fond est visible.
- **Choix et niveau validés par Anthony** le 31 octobre 2026 (détail : `../ressources/marecages/README.md`).
- **Avec la vidéo de la capture** (`../D-hybride/fond-video.js`), le tonnerre suit les éclairs de la vidéo :
  - `encoder.js --journal` écrit à côté de la vidéo la chronologie de ses éclairs dans la boucle : instant, côté dans l'image, distance. Le fondu de la boucle est pris en compte ; un éclair effacé à plus de moitié par le fondu n'a pas de tonnerre.
  - `assembler.py` la donne à la maquette D (`window.ZSM_FOND_BOUCLE`).
  - La lecture suit les images de la vidéo (`requestVideoFrameCallback`, ou `timeupdate` à défaut). Elle lance le tonnerre du jeu au passage de chaque éclair, boucle comprise.
  - Depuis l'encodage par ffmpeg (§3 bis), l'image i de la vidéo tombe à i/30 s, au millième près : l'instant de chaque éclair du journal est celui de son image, sans dérive.
  - Pas de saut entre l'affiche et la vidéo (corrigé le 2 novembre à la demande d'Anthony) : l'affiche est l'image de l'instant `fondu / fps` de la boucle (1 s), chaque lecture qui part de l'affiche repart de cet instant, et l'affiche ne s'efface qu'à la première image présentée.
  - La force vient de la distance : 1,15 jusqu'à 2 500 m, 1 jusqu'à 3 200 m, 0,8 au-delà.
  - Éclairs coupés : la version sans éclairs prend le relais au même instant, sans tonnerre. Depuis le 2 novembre, sans coupure : un lecteur par version, celui en retrait se cale sur une image à venir et prend le relais quand l'autre y arrive, sans recharger ni montrer l'affiche (`essai.js` en contrôle quatre, dont une tardive et une au retour au début de la boucle).

## 8. Fichiers

- `preparer.sh` : copie vérifiée du jeu du kit et des deux sources des sons (lecture seule).
- `capturer.js` : la capture (gardes de charge et de mémoire, cadrage, trois passages, éclairs limités, version sans éclairs, contrôles).
- `planche.js` : planche de contrôle des images, en une grille JPEG ; avec deux dossiers, les deux versions côte à côte.
- `encoder.js` : vidéo en boucle (ffmpeg, VP9 en deux passes, 30 images par seconde exactes) et affiche ; avec `--journal`, la chronologie des éclairs dans la boucle.
- `comparer-video.py` : une vidéo comparée aux images dont elle vient (images perdues ou doublées, rythme, PSNR, SSIM, zones sombres, raccord de la boucle), sans navigateur (§3 bis).
- `couleurs-video.js` : les couleurs d'une vidéo telles que Chromium les rend, comparées aux images d'origine (§3 bis).
- `planche-video.py` : planche de comparaison, à l'échelle 1 ou agrandie (`--echelle 2`) : la source et une ou plusieurs vidéos côte à côte, sur des zones choisies, avec le PSNR de chaque zone.
- `exporter-sons.js` : export des sons calculés du kit (pluie, tonnerre, réverbération), contrôle et aperçu.
- `images-2d.js` : images d'essai tirées du fond 2D, pour essayer la chaîne sans le kit.
- `.gitignore` : `kit/`, `sortie/` et les caches de Python hors du dépôt.
- **Prérequis** : ffmpeg et ffprobe (paquet Ubuntu `ffmpeg`) ; Python 3 avec numpy, scipy et Pillow (`comparer-video.py`, `planche-video.py`) ; `playwright-core` (`npm ci` dans `launcher/`, avec l'accord d'Anthony) et le Chromium « sans tête » de Playwright, ou `ZS_CHROMIUM`, pour les scripts qui ouvrent une page.
