# Ressources « Marécages maudits » du launcher

Ressources retenues pour le fond animé de l'accueil de la maquette D (`D-hybride/marais.js`), copiées le 31 octobre 2026, en lecture seule, depuis le projet d'Anthony réalisé avec Claude Artefact. Le projet d'origine n'a pas été modifié et aucun de ses scripts n'a été exécuté.

## Fichier copié

| Fichier | Origine (PC d'Anthony) | Taille | Empreinte SHA-256 |
|---|---|---|---|
| `13_la_mere_vase_se_jette_sur_un_noye.jpg` | `%USERPROFILE%\Documents\Zombie Survival - Publications\Zombie Survival 2.0.7 - a publier (Stryges)\captures\` | 1 280 × 635, 79 998 octets | `abe40c67fb6194c9…` (identique à l'original) |

C'est une capture du jeu du kit 2.0.7, prise en vue libre, sans HUD ni arme : la Mère-Vase jaillit sur un Noyé, avec son leurre allumé, la brume, le ponton du Bourg et des yeux de Noyés au loin.
- **Usage** : fond de l'accueil, retournée horizontalement pour que la bête soit à droite, hors du texte. La légende du bandeau le dit.
- **Image fixe de secours** : la même capture, en arrière-plan CSS sous le canevas.

**Statut** : la carte sort avec le jeu 2.0.7 (« en développement » dans le choix des cartes, comme dans le kit), et le launcher 1.4.0 avec elle.
- **Publication autorisée par Anthony le 2 novembre 2026** pour le fond de l'accueil du launcher. Les copies livrées sont dans `launcher/src/renderer/launcher/assets/marecages/` : les deux vidéos, une affiche (les deux sont identiques), les 11 sons que charge `ambiance.js` et leurs réglages (`sons/ambiance.json`), faites par `../../scene-bete/vers-launcher.py`, qui contrôle la concordance des chronologies, des affiches et des sons.
- Ce dossier garde les originaux, exclus de Git, sauf ce README et son `.gitignore` : la capture de la scène 2D, les vidéos et leurs chronologies (`fond-marais*.json`), les affiches, les sons (`sons/`, avec les maîtres et l'aperçu).
- **Règle d'Anthony du 31 octobre 2026**, qui valait jusque-là : aucune image, vidéo ou ressource de cette carte sur GitHub sans son autorisation explicite. Une nouvelle ressource de la carte demande toujours son accord.
- La vraie scène de la bête (capture dans le jeu du kit) a sa procédure dans `../../scene-bete/README.md`.

## Références consultées (lues, pas copiées)

Toutes viennent du kit 2.0.7.
- **Pluie** : `sources/src/ma/ma17_pluie.js`, `MA_WXC`.
  - Gouttes à 8,2 à 9,8 m/s, penchées par le vent, en deux volumes (proche, lointain).
  - Ronds de pluie sur l'eau.
  - Intensité par épisodes, avec moments forts et accalmies.
- **Orage** : `sources/src/ma/ma18_orage.js`, `MA_ORC`.
  - Éclairs irréguliers dans les nuages et au sol.
  - Canal par déplacement aléatoire du milieu, branches qui s'arrêtent en l'air.
  - 1 à 6 arcs en retour tous les 30 à 140 ms ; teinte et force tirées au hasard.
  - Tonnerre après distance ÷ 343 m/s, puis roulement de 8 à 15 s.
- **Brume** : `ma14_brume.js`, `MA_HFOG` (couleur `0x5a6a62`, vent `[0,42 ; 0,17]`), plus épaisse sous la pluie (`MA_WXC.hfK`).
- **Noyés** : `ma15_noyes.js`, `MA_NOYE.eye` (rouge braise `#FF5226`) ; ils clignent.
- **La Mère-Vase** : `mere-vase.js` 1.2.1, ses clips et ses ancres (voir plus bas).
- **Aspect de la pluie et de la foudre** : captures 14 à 18 du kit (vues FPS avec l'arme, donc pas utilisables comme fond).

## Ce qui est adapté en 2D

La pluie, l'orage et la brume sont redessinés en 2D d'après ces réglages. Le code du kit n'est pas exécuté.

**Adaptation pour le confort** (vertige d'Anthony) :
- au plus 3 arcs par éclair, espacés d'au moins 140 ms ;
- un éclair toutes les 6 à 15 s ;
- éclat plafonné ;
- aucun mouvement de caméra.

**Éclat plafonné à 0,5** depuis la demande d'Anthony du 31 octobre au soir (une ambiance sombre, sans excès de lumière). **Réglage « Éclairs de l'orage »** pour les couper.

**Fait le 2 novembre 2026** : la capture complète de la séquence animée de la bête qui se jette sur des Noyés (option A, choisie par Anthony), sur son ordre, par la file commune des tâches lourdes. Vidéos dans ce dossier, hors de Git : `fond-marais.webm` (4,51 Mo) et `fond-marais-sans-eclairs.webm` (4,46 Mo), leurs affiches et la chronologie `fond-marais.json` ; CRF 28 et fondu d'une seconde, choisis par lui (`../../scene-bete/README.md`, §3 bis).

## Sons (`sons/`, exportés le 31 octobre 2026)

**Autorisation d'Anthony** (31 octobre 2026) : « j'autorise l'export des sons du kit ». Ce sont les sons **calculés** par le jeu du kit : aucun fichier son n'existe dans le kit, donc aucune question de droits.

**Comment ils sont faits** : `../../scene-bete/exporter-sons.js` exécute seulement les blocs du calcul audio du kit, tels quels, dans une page vide du Chromium sans tête, sans réseau.
- `ma17_pluie.js` : de `maWxRand` à `maWxGenAll`.
- `ma18_orage.js` : `maBoltPath`, puis de `maThunderChannel` à `maThunderIR`.
- Les sources viennent de la copie vérifiée de `preparer.sh`. Les empreintes des fichiers et des blocs sont contrôlées ; un écart arrête tout.
- Graine fixée : l'export se refait à l'identique (`node maquettes/launcher/scene-bete/exporter-sons.js`, 10 à 15 s).

| Fichier | Contenu | Durée |
|---|---|---|
| `pluie-eau`, `-bois`, `-boue`, `-feuillage`, `-lointain`, `-toit` | les six nappes du jeu (`maWxGenAll`, graine 1), stéréo, en boucle | 7,3 ; 6,1 ; 6,7 ; 5,9 ; 8,9 ; 7,7 s |
| `orage-reverberation` | la réverbération commune des tonnerres (`maOrIR`), stéréo | 4,5 s |
| `tonnerre-sol-450`, `-900`, `-1700`, `-3000` | éclairs au sol à cette distance (m), canal tracé comme dans le jeu (`maBoltGround`, `maStrikePlan`), mono | 10,9 à 14,9 s |
| `tonnerre-nuages-2000`, `-3500` | éclairs dans les nuages (`maFlashCloud`), mono | 5,8 et 8,0 s |

- **Distances** : celles du jeu pour un joueur à terre. Pas d'éclair « tout près » (3 à 28 m, seulement en partie) : un launcher ne doit pas assourdir.
- **Formats** :
  - `maitres/*.wav` : les tampons du jeu en 16 bits, 48 kHz (15 Mo) ;
  - `*.ogg` : les mêmes en Opus, encodés par WebCodecs (pas de ffmpeg), 1,7 Mo en tout. Ce sont les fichiers d'usage.
  - Les nappes portent 50 ms de marge de part et d'autre (`boucle` dans `sons.json`) : la boucle se coupe au milieu d'un son continu, sans couture.
- **Contrôle des Opus**, décodés comme le fera le launcher :
  - longueurs exactes, décalage nul ;
  - énergie par tiers d'octave à ±0,02 à 0,04 dB en moyenne, au pire 0,6 dB à 40 Hz ;
  - enveloppe des impacts corrélée à 0,99 ou plus.
- **`sons.json`** : durées, crêtes, niveaux, la chaîne du jeu (le mélange de la pluie, la chaîne du tonnerre, le bus et son compresseur), le contrôle de chaque fichier.
- **`ondes.png`** : planche des formes d'onde.
- **`apercu-orage.wav`** : 40 s d'écoute, la pluie et trois tonnerres mêlés par la chaîne du jeu jusqu'à son bus (volume général 0,8, compresseur).

**Dans la maquette D** (`D-hybride/ambiance.js`) : le mélange du jeu.
- **Pluie** : nappes eau, bois, feuillage, lointain. Force du jeu : `MA_WXA_K` × parts de ce qui entoure l'auditeur (au ras de l'eau, près du ponton) × intensité de la pluie qu'on voit dans la scène.
- **Tonnerre** : sur chaque éclair de la scène, après l'arrivée du son (`t0`). Médium, force selon la distance, côté selon l'endroit de l'éclair, réverbération de l'orage. Trois tonnerres à la fois au plus.
- **Fin de chaîne** : volume général du jeu, puis son compresseur.
- **Réglages** :
  - « Sons de l'ambiance » coupé par défaut ; aucun contexte audio avant qu'on l'allume ;
  - « Volume de l'ambiance » à 80 %, le volume du jeu par défaut ;
  - son seulement quand le fond est visible, avec une montée de 1,5 s à chaque reprise ;
  - pas d'éclair, pas de tonnerre ; sur l'image fixe, la pluie continue.
- **Validé par Anthony le 31 octobre 2026** : ces choix (aucun éclair tout près, image fixe, nappes utilisées) et le niveau (80 %, compresseur du jeu, pluie à −27 dB pleine échelle).

## Réutilisation possible des modèles et animations

L'étude a été faite en lecture seule.
- **`mere-vase.js`**
  - Autonome : three.js r128 seul, modèle, squelette et textures générés en code, aucun fichier externe.
  - Clips : `nage`, `guet`, `remontee`, `plongee`, `surgissement`, `cri`, `preparation`, `ruee`, `attaqueJoueur`, `devoration`, `degats`, `mort`…
  - `devoration` dure 3,6 s, avec les repères `saisie` (0,32 s), `secousse` (0,9 et 1,6 s), `avale` (2,35 s) et `plonge` (3,1 s). Il est synchronisé avec une victime par l'ancre `bite`.
  - Un studio d'essai existe (`sources/test/mv_view.html`).
- **Le Noyé** (`ma15_noyes.js`) : il repose sur le squelette du Fantassin du moteur et sur les crochets de `patches.py`. Il ne s'anime que dans le jeu complet (`jeu/index.html`).
- **Pluie, orage, eau, brume** : ce sont des systèmes du jeu complet, en shaders et dans la scène du marais.
- **Séquence précalculée proposée** : mise en scène dans le jeu complet du kit (la bête dévore un Noyé sous l'averse et l'orage), rendue image par image, encodée en vidéo courte et bouclée par fondu.
  - Exécution du jeu du kit autorisée par Anthony le 1er novembre (« Tu peux y aller ! »).
  - La capture passe par la file commune des tâches lourdes (`zs-lourd`, consigne du 2 novembre) et part sur l'ordre d'Anthony.
  - L'encodeur : ffmpeg (VP9 en deux passes, `scene-bete/encoder.js`), installé par Anthony le 2 novembre 2026. Avant, faute de ffmpeg, l'enregistrement d'un canevas par le navigateur : des images perdues et un rythme irrégulier.

## Intégration au vrai launcher (faite le 2 novembre 2026)

Faite autrement que prévu ici au départ (une capture en WebP et la scène 2D `marais.js`) : le launcher reçoit la vidéo et les sons, copiés par `../../scene-bete/vers-launcher.py` dans `launcher/src/renderer/launcher/assets/marecages/` (publication autorisée par Anthony le 2 novembre 2026).
- **Vidéo** : `fond-video.js`, politique de sécurité `media-src 'self'`.
- **Sons** : par le préchargement (`zs.ambiance()`). Les 11 sons que charge `ambiance.js` : 4 nappes de pluie, la réverbération de l'orage, 6 tonnerres. Avec la boucle actuelle (un seul éclair, dans les nuages à 4,4 km), seuls `tonnerre-nuages-3500` et `tonnerre-sol-1700` sont joués, en alternance (« pas deux fois le même de suite ») ; les 4 autres gardent la gamme validée de 450 m à 3,5 km pour une boucle aux éclairs plus proches (0,49 Mo dans l'installateur).
- **Réglages** : `fond`, `fondAnime`, `fondEclairs` et `volumeSons`. Les sons repartent coupés à chaque lancement et ne sont jamais enregistrés.
- Détail : `docs/plan-integration-launcher.md`, §8.3, §8.4 et §9.1.
