# Le Dernier Pacte — brief d'intégration dans Zombie Survival (pour Claude Code)

Ce paquet contient le combat final de la quête principale de **Bunker 7** : le boss **Le Septième**, ses cinq phases, son modèle 3D animé, ses effets, ses sons et sa musique, son interface. Il contient aussi un **prototype jouable autonome** qui montre tout fonctionnant ensemble.

**Rien n'est encore intégré au jeu.** Tout a été construit et testé hors du code de Zombie Survival, sur un mini-moteur de démonstration (`prototype/`). Ton travail : brancher les modules de `src/` sur les vrais systèmes du jeu, en suivant ce document. Lis aussi `CONCEPTION.md` (ce que fait chaque phase) et `API.md` (contrats exacts des modules).

## 0. Ce qui change depuis la v1.0 (à lire en premier si une version précédente est déjà intégrée)

### Version 1.5 — rages des mini-boss, murs électrifiés, Démembré géant, intangibilité de la phase 5

Demande d'Anthony après la v1.4. Contrat détaillé : `API.md` §17 (précisions de l'implémentation : §17.8). Choix validés par
Anthony :
- le bras du Démembré libère un **flot continu plafonné** de Démembrés de taille normale : un toutes les 2,5 s tant que le géant
  vit, au plus 6 vivants en solo (+2 par joueur) ; à sa mort le bras se flétrit et tous s'effondrent ;
- zombies et chiens irradiés : **lueur verte et petite aura** (1,5 m, 4 % des PV par seconde).

| # | Demande | Ce que fait le paquet | Ce que tu dois brancher dans le jeu |
|---|---|---|---|
| 27 | Le Survolté, à la moitié de ses PV : invulnérable un court instant, puise sa force dans le Septième (visuel seulement), puis électrifie tous les murs (pas le sol) jusqu'à sa mort ; dégâts aux joueurs près des murs ; beaux effets, sons uniques | Rage `surcharge` (2,5 s) : `jeu.effetZombie(id, 'surcharge', { duree, source })`, `miniBoss[i].invulnerable` ; rayon d'énergie du torse du Septième au Survolté (aucun effet sur le Septième) ; puis `murs` `electrifies` : les 8 pans de l'octogone et la bordure du plafond (arcs, lueur, liseré au sol à 2,2 m), **12 %/s** par tics de 0,25 s à moins de **2,2 m** d'un mur (`source: 'murs'`), `mursChoc` ; bandeau « Murs électrifiés : restez loin des murs » ; 8 boucles sonores aux murs ; tout s'éteint à sa mort | Dans l'IA du Survolté : animation de la surcharge (immobile, bras levés vers `source`) et invulnérabilité (`toucher` sans effet pendant `duree`, impact « bouclier »). Le reste vient des modules (`fx.brancher`, `audio.brancher`, `hud.brancher`). Coéquipiers IA du jeu : rester à plus de 2,7 m des murs tant que `etat().murs.etat` vaut `electrifies` (référence : `situation.murs` dans `proto-bots.js`) |
| 28 | L'Irradié, à la moitié de ses PV : infecte tous les zombies et chiens zombies, et chaque zombie qui apparaît dans la salle, jusqu'à sa mort | Rage `infection` (cri de 1,2 s, il reste vulnérable) ; puis `jeu.effetZombie(zid, 'irradie', { actif: true, aura: { rayon: 1.5, degatsParSeconde: 0.04 }, couleur })` pour chaque zombie, chien ou petit Démembré de la salle (vérifié à chaque pas, nouveaux compris) ; `{ actif: false }` pour tous à sa mort ; instantané `infection { active, ids }` | Dans le jeu : lueur verte sur l'entité irradiée et aura (dégâts continus à 1,5 m, comme l'aura de L'Irradié). Les effets dessinent l'onde d'infection et une lueur au sol (option `lueursIrradies: false` si le jeu la dessine) : fournis `monde.positionZombie(id)` à `fx` et `positionZombie(id)` dans le contexte de `audio.mettreAJour` (grésillement des irradiés) |
| 29 | Le Démembré 2× plus grand (hauteur et largeur), fléau à portée largement augmentée | `demembre.echelle: 2` (≈ 3,9 m), fléau **6 m** (2,6 m en v1.4), préparation 0,7 s ; sa cuve `tube2` agrandie (rayon 1,3 m, 4,4 m de haut, en (0 ; 13,1)) ; il sort à 2,6 m devant elle ; cri, râle, fléau et mort rejoués plus graves | Modèle du Démembré à l'échelle `profil.echelle` : maillage, zones de tir, collision, cercle de navigation, cadence des pas. Cuve 3 à la taille de `arene.salle.tubes[2]` |
| 30 | Le Démembré, à la moitié de ses PV : invulnérable un court instant, s'arrache le bras et le lance au milieu de la salle ; de là sortent beaucoup de Démembrés de taille normale | Rage `arrachement` (2,4 s, invulnérable) : `bras` `arrache` → `lance` à 1,2 s → `pose` au centre à 2,4 s ; puis `jeu.faireApparaitreZombie({ type: 'demembre_petit', profil, effet: 'bras', vitesse: 'sprint', agressif: true })` toutes les 2,5 s, au plus 6 vivants en solo (+2 par joueur) ; petits : 250 PV, 4 m/s, fléau 2,4 m à 10 % ; ni barre ni protection | Animation de l'arrachement, bras en cloche puis posé au sol (mare de sang, tendons qui palpitent ; les effets en dessinent une partie : option `mareBras: false` si le jeu dessine la mare), petits Démembrés = le modèle du Démembré à l'échelle 1 avec le profil reçu, qui sortent du sol en griffant (`effet: 'bras'`). `retirerZombie(id, { effet: 'effondrement' })` : il s'écroule et se dissout. Référence : `proto-zombies.js` (`arracher`, petits Démembrés) |
| 31 | Le Démembré sans bras charge les joueurs, gros dégâts, les projette contre les murs | Profil `demembre.charge` : préparation 0,8 s (il gratte le sol), course à 13 m/s sur 16 m au plus, largeur 1,8 m, **35 %**, joueur **projeté** (12 m/s pendant 0,5 s), **+10 %** s'il heurte un mur ; le Démembré qui heurte un mur reste étourdi 1,2 s ; recharge 3 s | IA de charge dans le jeu, déplacement forcé du joueur projeté (sans contrôle pendant 0,5 s) et collision contre les murs. Sons : `audio.sonMiniBoss('demembre', 'charge', p, { etat: 'preparation' \| 'elan' \| 'impact' \| 'mur', id, cible })` et `('demembre', 'projection', p, { etat: 'mur', cible })` |
| 32 | Le 3e combat de mini-boss se termine à sa mort | À sa mort : petits effondrés, bras flétri, protection levée | — |
| 33 | « Munition Max » à chaque mini-boss tué | `miniBoss.bonusMort` : `jeu.faireApparaitreBonus({ type: 'munitions-max', position: <là où il tombe>, lieu: 'salle', duree: 30 })`, évènement `bonus { source: 'miniBoss', miniBoss }` | Rien de plus que la v1.1 (vrai bonus du jeu à ramasser) |
| 34 | Phase 5 : supprimer les illusions | `phase5.paliers.illusions` retirée ; `etat().illusions` toujours `[]` ; `toucherIllusion` répond `absent` ; 4 sons supprimés | **Retirer** `appliquerIllusions`, les instances du modèle des illusions et les tirs sur elles |
| 35 | Phase 5 : il devient invisible par moments et traverse les murs ; après avoir passé un mur il redevient visible et attaque ; si aucun joueur n'est près de lui, il recommence | Palier 2 (50 % de la jauge) et au-delà : quand aucun joueur n'est à moins de 10 m depuis 1,5 s (recharge 6 s), action `evanouissement` (0,7 s), puis `boss.visible = false`, `boss.intangible = true` (balles sans effet, jauge gelée) ; il fonce en ligne droite à 6,5 m/s vers le joueur le plus proche **à travers les murs** (`intangible { traversee }` à chaque mur) ; après un mur, dès qu'un joueur est à 6 m en vue (ou à 3 m, ou au bout de 12 s) : action `resurgissement` (0,5 s) pendant laquelle **il fond sur le joueur** (9 m/s, jusqu'à 1,8 m, jamais à travers un mur), puis **frappe** (préparation 0,5 s, règle du palier) | Rien de spécial : `modele.update` masque le modèle quand `boss.visible` est faux ; ne propose pas `modele.hitboxes()` aux tirs dans ce cas (le prototype le fait déjà). Fournis `monde.tir(lieu, origine, direction, max) → { point, normale } \| null` à `fx` pour orienter l'ondulation du mur traversé (facultatif) |

Fichiers à remplacer pour la v1.5 : `src/config.js`, `src/arene.js`, `src/logique.js`, `src/boss-modele.js` (2.3 : actions
`evanouissement` et `resurgissement`), `src/fx.js`, `src/audio.js`, `src/hud.js`, `sons/manifest.json` ; à ajouter : les 23 sons
`survolte_surcharge`, `murs_electrification`, `murs_boucle`, `murs_arc`, `murs_choc`, `murs_extinction`, `irradie_infection`,
`zombie_irradie`, `demembre_arrachement`, `bras_lancer`, `bras_impact`, `bras_pulsation`, `petit_sortie`, `petit_effondrement`,
`demembre_charge`, `demembre_percussion`, `projection_mur`, `bras_fletri`, `intangible_debut`, `intangible_boucle`,
`traversee_mur`, `resurgissement`, `palier_intangible` (`.mp3`) ; à remplacer : `demembre_cri`, `demembre_mort`, `demembre_rale`,
`demembre_fleau` (plus graves) ; à supprimer : `illusion_apparition`, `illusion_dissipation`, `illusion_murmure`,
`palier_illusions`. Clés de config v1.5 : `miniBoss.<type>.rage`, `miniBoss.murs`, `miniBoss.bonusMort`,
`miniBoss.demembre.echelle`, `fleau`, `charge`, `petits`, `phase5.paliers.intangible` (dont `fente`) ; `phase5.paliers.illusions`
n'existe plus.

**Difficulté** : réglage appliqué après mesure (petits Démembrés 450 → 250 PV, leur fléau 15 → 10 %). Robot de test, 40 combats :
solo avec l'arme du prototype **6/40** (v1.4 : 9/40), coop 4 avec l'arme du prototype **35/40** (5/5 sur les graines de
référence), tir continu 37/40 en solo et 40/40 à 4. En solo, ≈ 60 % des morts viennent des zombies ordinaires de la phase 2 :
l'objectif « solo ≥ 3/5 » demande de toucher aux zombies ordinaires (dégâts ou plafond en phase 2), ce qui reste la décision
d'Anthony (`API.md` §17.7 ; campagne : `NG=40 node tests/logique/campagne.js`).

### Version 1.4 — 3e cuve (Le Démembré), mini-boss renforcés, salves de murs, faiblesse, paliers de la phase 5

Demande d'Anthony après avoir joué la v1.3 (avec une photo de la salle et la fiche N°02 « Le Démembré »). Contrat détaillé :
`API.md` §16 (précisions de l'implémentation : §16.11). Choix validés par Anthony :
- zones radioactives de L'Irradié **sans plafond** (elles restent jusqu'à sa mort) ;
- **2 boules par salve en solo, +1 par joueur** ;
- salves de la phase 3 : **4 blocs au total**, répartis entre les joueurs ;
- illusions : **dissipées par une balle, de retour 8 s plus tard** ailleurs ; 3 en solo, +1 par joueur ; elles ne remplissent pas la jauge
  (**retirées en v1.5**, remplacées par l'intangibilité : ligne 24 et critère 33 caducs).

| # | Demande | Ce que fait le paquet | Ce que tu dois brancher dans le jeu |
|---|---|---|---|
| 16 | 3e cuve à l'endroit vide de la photo, avec Le Démembré, libéré à 25 % des PV restants (phase 2), sans faiblesse | `arene.salle.tubes[2]` (`tube2`, milieu du mur nord, (0 ; 13,25)) ; la brèche nord passe en (0 ; 11), la dalle `m0-1` derrière la cuve n'est plus arrachable ; 3e seuil 0,25, même déroulé que la v1.3 (protégé, siphon, un mini-boss à la fois) ; profil `config.miniBoss.demembre` (5 705 PV en solo, 4,2 m/s, **fléau** : bras pendant qu'il fait tournoyer 0,55 s puis frappe en arc de 150° à 2,6 m, 30 %) | Construire la 3e cuve comme les deux autres ; créer Le Démembré quand `type === 'demembre'` (modèle, démarche boiteuse, bras gauche pendu par des tendons, fléau). Son bras ne se détache jamais. Référence : `prototype/proto-zombies.js` (partie « MINI-BOSS ») et `proto-monde.js` |
| 17 | L'Irradié marche plus vite, zone de radioactivité beaucoup plus grande | `irradie.vitesse` 2,8 → **4,4** m/s ; `aura.rayon` 3 → **6** m | Appliquer le profil reçu |
| 18 | L'Irradié lance des boules radioactives (selon le nombre de joueurs) ; leurs zones tuent si on y reste et durent jusqu'à sa mort | `irradie.boules` : une salve toutes les 6 s, 2 boules en solo +1 par joueur (une sur chaque joueur, la 2e en solo vise où il va), point d'impact marqué au sol ; impact 8 % ; **zone de 2,5 m sans plafond jusqu'à sa mort** ; exposition : min(35 %, 4 % + 5 % × secondes passées dedans) par seconde (traverser coûte peu, rester ≈ 5,5 s tue) | Lancers en cloche, zones et exposition dans le jeu (référence : prototype). Signaler au son : `audio.sonMiniBoss('irradie', 'boule', p, { etat: 'lancer' \| 'impact' })`, `'zone'` (`etat: 'debut' \| 'fin'`, `id` de la zone) |
| 19 | Le Survolté frappe plusieurs joueurs à la fois et étourdit 1 s | `survolte.vitesse` 4,2 → **5,4** m/s ; `decharge.multi` (un arc vers **chaque** joueur à 8 m en vue) ; `decharge.etourdissement` 1 s | Étourdissement du joueur touché : ni déplacement, ni saut, ni tir, ni rechargement pendant 1 s, la vue reste libre mais tremble. `audio.sonMiniBoss('survolte', 'etourdi', p, { cible })` |
| 20 | Phase 3, sous 50 % : plusieurs murs presque d'un coup, répartis entre les joueurs | `phase3.salve` : 4 dalles désignées ensemble, lancées à 0,12 s d'écart (≈ 0,4 s pour les 4) ; 4 sur le joueur seul, 2 + 2 à deux, 1 chacun à quatre ; visées décalées (rester immobile fait tout encaisser) ; chaque bloc garde au moins 25 % | Rien : les dalles (`etat().blocs`) et les piliers fonctionnent comme avant, plusieurs à la fois |
| 21 | Phase 4 : des zombies pendant que le boss est affaibli à terre | `phase4.faiblesse.apparitions` (un toutes les 1,2 s, 10 au plus en solo) | Rien de plus que les apparitions déjà branchées |
| 22 | Phase 5 : lames bleu très clair, deux coups pour tuer | Palier 0 : `boss.couleurLames: 'bleu'`, chaque coup enlève 50 % des PV max | Le modèle 2.2 teint les lames tout seul ; les effets aussi |
| 23 | Phase 5, −25 % : lames rouges, chaque coup quasi mortel (1 %) | Palier 1 : lames rouges, chaque coup laisse à 1 % (un joueur déjà sous 5 % meurt), puis il disparaît 10 s comme avant ; la frappe ordinaire et l'immunité de 15 s n'existent plus | Rien |
| 24 | Phase 5, −50 % : illusions qui traquent sans blesser, lames vertes | Palier 2 : `etat().illusions` (3 en solo, +1 par joueur), qui traquent avec les chemins du jeu et font ses gestes sans aucun dégât ; `combat.toucherIllusion({ id, joueur, position })` en dissipe une (de retour 8 s plus tard) | Dessiner chaque illusion avec une instance du modèle (recette : `API.md` §6, v2.2 : qualité basse, allégée, `couleurLames: 'vert'`) et une vue construite depuis `etat().illusions` ; intersecter les tirs avec leurs `hitboxes()` et appeler `combat.toucherIllusion`. Référence : `prototype/proto-boss.js` (`appliquerIllusions`) |
| 25 | Phase 5, −75 % : crochets (recharge 15 s) qui ramènent le ou les joueurs, puis il frappe | Palier 3 : action `crochet` ; un crochet vers chaque joueur à 4–22 m en vue ; accroché → plus de commandes, tiré vers lui à 14 m/s, puis il frappe aussitôt (règle du palier) ; un pas de côté l'évite | Fournir `jeu.tirerJoueur(id, position)` (déplacement forcé sans collision ; sinon la logique utilise `teleporter` à chaque pas) |
| 26 | Survolté et Irradié plus rapides | 5,4 et 4,4 m/s (joueur : 4,6 en marche, 6,6 au sprint) | — |

Fichiers à remplacer pour la v1.4 : `src/config.js`, `src/arene.js`, `src/logique.js`, `src/boss-modele.js` (2.2 : couleur des lames, crochet, mode allégé), `src/fx.js`, `src/audio.js`, `src/hud.js`, `sons/manifest.json` ; à ajouter : les 19 sons `demembre_cri`, `demembre_mort`, `demembre_fleau`, `demembre_impact`, `demembre_rale`, `irradie_boule`, `irradie_boule_impact`, `zone_radioactive`, `survolte_etourdi`, `crochet_lancer`, `crochet_accroche`, `crochet_traction`, `crochet_rate`, `illusion_apparition`, `illusion_dissipation`, `illusion_murmure`, `palier_lames_rouges`, `palier_illusions`, `palier_crochets` (`.mp3`). Clés de config v1.4 : `miniBoss.ordre`, `seuils`, `demembre`, `irradie.vitesse`, `aura`, `boules`, `survolte.vitesse`, `decharge.multi`, `decharge.etourdissement`, `phase3.salve`, `phase4.faiblesse.apparitions`, `phase5.paliers`. `phase5.frappeOrdinaire` et `phase5.frappe.immunite` ne servent plus (clés gardées).

**Difficulté** : la v1.4 rend le solo nettement plus dur. Le robot de test avec l'arme du prototype gagne 9 combats sur 40 (v1.3 : environ 60 %). Il meurt surtout en phase 2, pendant l'étourdissement du Survolté (les zombies du Septième arrivent pendant qu'il est figé), et en phase 3, sous les salves. En coop à 4, il gagne 37 combats sur 40. Anthony décide s'il faut alléger. Les leviers sont dans `CONCEPTION.md`, « Durées mesurées ».

### Version 1.3 — les deux cuves et les mini-boss de la phase 2

Demande d'Anthony après avoir joué la v1.2 (avec ses deux fiches : N°06 « Le Survolté », N°04 « L'Irradié »). Contrat
détaillé : `API.md` §15. Choix validés par Anthony : un mini-boss à la fois (le 2e sort quand le Septième est à 50 %, donc
après la mort du 1er) ; le Septième **continue d'attaquer** pendant que les mini-boss sont là ; ordre : Le Survolté, puis L'Irradié.

| # | Demande | Ce que fait le paquet | Ce que tu dois brancher dans le jeu |
|---|---|---|---|
| 9 | Modéliser complètement les cuves vertes, en garder 2 | `arene.salle.tubes` (2 cuves dos au mur, à la place des anciennes cuves brisées) ; `etat().tubes` donne l'état de chacune : `intact`, `siphon`, `fissure`, `eclate` | Construire les 2 cuves aux positions de `arene.salle.tubes` (socle, verre, liquide vert, câbles, mini-boss endormi dedans) et les afficher selon `etat().tubes` ; collision = cercle de rayon + 0,2 m, intacte ou brisée. Référence complète : `ProtoB7Monde` (`monde.appliquerTubes`) dans `prototype/proto-monde.js` |
| 10 | Un mini-boss dans chaque cuve | Cuve `tube0` : Le Survolté ; cuve `tube1` : L'Irradié (`miniBoss` de chaque cuve) | Le mini-boss endormi est un décor tant que la cuve est intacte ; il disparaît quand la cuve éclate (référence : `ProtoB7Zombies.modeleDormant`) |
| 11 | Phase 2, Septième à −25 % : il siphonne une cuve qui éclate et libère son mini-boss | À 75 % des PV de la phase 2, PV bloqués au seuil (un gros coup ne le saute pas), boss protégé, action `siphon` (approche, aspiration, éclatement, récupération), puis `faireApparaitreZombie({ type: 'survolte', miniBoss: true, nom, profil, effet: 'cuve' })` | Créer le mini-boss quand `miniBoss === true` (voir la ligne 13). Le modèle, les effets, les sons et l'interface jouent le siphon tout seuls |
| 12 | À −50 % : l'autre cuve, le 2e mini-boss | Même chose au seuil 50 % (atteignable seulement après la mort du Survolté, puisque le Septième est invulnérable avant) : L'Irradié | Rien de plus |
| 13 | Les mini-boss chassent et tuent le joueur avec leurs capacités (fiches) | `profil` = `config.miniBoss.survolte` / `irradie` (PV × coop, vitesse, coups, capacités) ; l'IA et les capacités tournent **dans le jeu** | Dans `faireApparaitreZombie`, créer l'entité (modèle, animations, IA de poursuite) et ses capacités : **Survolté** (4 900 PV, 4,2 m/s) : décharge toutes les 4 s à 8 m maximum en ligne de vue, 15 % des PV max + **vision brouillée 1 s**, puis 2 s immobile ; se tient à 5–7 m ; coup au contact 24 %. **Irradié** (7 350 PV, 2,8 m/s) : aura de 3 m, 7 % des PV max par seconde ; coup au contact 16 % ; **flaque toxique** de 2,5 m pendant 5 s à sa mort (7 %/s). `zombies()` doit lister les mini-boss avec `pv` et `pvMax`. Signaler les capacités au son : `audio.sonMiniBoss(type, 'charge' \| 'decharge' \| 'spasme' \| 'flaque', position, { id, etat })`. Référence complète (modèles, IA, capacités, effets propres, rappels) : `prototype/proto-zombies.js`, partie « MINI-BOSS » |
| 14 | Barre de PV de chaque mini-boss en haut de l'écran, avec son nom ; ses sons, ses animations | `hud.js` 1.3 : barre sous celle du Septième (nom, PV, couleur), « Protégé : abattez … », repères 75 % / 50 % ; `audio.js` 1.3 : 15 sons (cuves, arrivée, boucles, cris, morts, flaque) ; `fx.js` 1.3 : flot du siphon, fissures, éclatement, lien et voile de protection | Rien : ces modules lisent `etat()` et les évènements. `fx` suit le mini-boss par `monde.positionZombie(id)` (déjà fourni) |
| 15 | Il faut battre les mini-boss pour blesser de nouveau le Septième | `boss.protege` : `toucherBoss` renvoie `{ applique: false, raison: 'invulnerable' }` du seuil à la mort du mini-boss ; à sa mort, évènement `protection { actif: false }` et les PV repartent du seuil | Afficher l'impact « bouclier » quand `raison === 'invulnerable'` (déjà le cas depuis la v1.0) |

Fichiers à remplacer pour la v1.3 : `src/config.js`, `src/arene.js`, `src/logique.js`, `src/boss-modele.js` (2.1 : action `siphon`), `src/fx.js`, `src/audio.js`, `src/hud.js`, `sons/manifest.json` ; à ajouter : les 15 sons `sons/tube_siphon.mp3`, `tube_fissure.mp3`, `tube_eclatement.mp3`, `miniboss_apparition.mp3`, `survolte_bourdon.mp3`, `survolte_charge.mp3`, `survolte_decharge.mp3`, `survolte_spasme.mp3`, `survolte_cri.mp3`, `survolte_mort.mp3`, `irradie_geiger.mp3`, `irradie_rale.mp3`, `irradie_cri.mp3`, `irradie_mort.mp3`, `flaque_toxique.mp3`. Clé de config v1.3 : `miniBoss` (actif, ordre, seuils, siphon, survolte, irradie). Garde-fous de la logique : mini-boss refusé par le jeu → 5 nouveaux essais puis protection levée ; mini-boss bloqué loin des joueurs → remis devant sa cuve ; jamais listé par `zombies()` → protection levée : **le combat ne peut pas se bloquer**.

Points : le prototype donne 500 points par mini-boss abattu (convention du prototype, à aligner sur le barème du jeu).

### Version 1.2 — seconde moitié de la phase 1

Demande d'Anthony après avoir joué la v1.1. Contrat détaillé : `API.md` §14.

| # | Demande | Ce que fait le paquet | Ce que tu dois brancher dans le jeu |
|---|---|---|---|
| 7 | Sous 50 % des PV de la phase 1, 2 sorts sur le joueur, à 1–2 s d'écart | Chaque `invocation` devient une paire (étapes `preparation`, `lancer`, `preparation`, `lancer`, `recuperation`) ; le point d'impact est choisi au tir, sous le joueur ; un pilier qui le couvre arrête le sort | Rien : le modèle, les effets et les sons utilisent les mêmes étapes |
| 8 | Chiens zombies à partir de ce moment, jusqu'à la fin du boss, sans exception | La logique gère la meute : 2 chiens en solo, +1 par joueur ; chacun sort d'une faille au sol 0,9 s après son ouverture ; un chien tué est remplacé après 10–15 s ; aucun nettoyage de zombies ne les touche ; ils passent dans Bunker 7 en phase 5 ; ils tombent en cendres à la défaite du boss | Dans `faireApparaitreZombie`, créer un **chien zombie** quand `type === 'chien'` (celui du jeu s'il existe, sinon reprendre le chien du prototype : `prototype/proto-zombies.js`), avec `profil` : 70 PV, 7,4 m/s, morsure de 5 % des PV max toutes les 0,9 s à 1,4 m. `effet: 'faille'` : il jaillit du sol. `zombies()` doit lister les chiens. À chaque morsure, `audio.morsureChien(position)` si le jeu n'a pas ses propres sons de chien |

Fichiers à remplacer pour la v1.2 : `src/config.js`, `src/logique.js`, `src/fx.js`, `src/audio.js`, `src/hud.js`, `sons/manifest.json` ; à ajouter : `sons/chien_faille.mp3`, `chien_hurlement.mp3`, `chien_grognement.mp3`, `chien_aboiement.mp3`, `chien_morsure.mp3`, `chien_mort.mp3`. Clés de config v1.2 : `phase1.secondeMoitie` (seuil, doubleSort) et `chiens` (max, maxParJoueurSupp, faille, reapparition, delaiBunker, bloque, profil).

Réglage fait pendant l'équilibrage : les chiens prévus au départ (100 PV, 10 % par morsure, remplaçant après 4–7 s) rendaient le solo presque impossible pour le robot de test (1 victoire sur 5). Le nombre de chiens n'a pas changé ; les PV, les dégâts et le délai de retour ont baissé.

### Version 1.1

Demandes d'Anthony après avoir joué la v1.0. Contrat détaillé : `API.md` §13.

| # | Demande | Ce que fait le paquet | Ce que tu dois brancher dans le jeu |
|---|---|---|---|
| 1 | Zombies beaucoup plus agressifs, au sprint | La logique passe `vitesse: 'sprint', agressif: true` (config `zombies`) à chaque `faireApparaitreZombie` | Les zombies du combat courent à la **vitesse maximale du jeu** (prototype : 5,8 à 6,2 m/s pour un joueur à 4,6 m/s en marche et 6,6 m/s au sprint), poursuivent un joueur dès l'apparition, sans errance |
| 2 | Phase 3 : pilier détruit après 3 rochers ; zombies en phase 3 | `etat().piliers`, évènements `pilier` (touche / détruit), apparitions de zombies en phase 3 (`phase3.apparitions`) | Afficher les 4 piliers selon `etat().piliers` (fissures, effondrement, tas de gravats), **retirer la collision** du pilier détruit et **mettre à jour la navigation** de la salle. Référence : `monde.appliquerPiliers` et `monde.impactPilier` dans `prototype/proto-monde.js` |
| 3 | Musique plus forte | Bus musique à 1,4 par défaut (v1.0 : 0,85, ≈ +4,3 dB), limiteur final | Si le jeu a un réglage « volume musique », le multiplier par ce gain plutôt que de le remplacer |
| 4 | « Munitions max » à chaque fin de phase | La logique appelle `jeu.faireApparaitreBonus({ type: 'munitions-max', position, lieu, duree: 30 })` aux 5 fins de phase | Faire apparaître le **vrai bonus « Munitions max » du jeu** à cette position (avec son ramassage et son annonceur) et renvoyer `true`. Sans annonceur dans le jeu : appeler `audio.annoncerBonus('munitions-max')` au ramassage |
| 5 | Phase 4 : beaucoup plus de zombies | 22 zombies simultanés en solo, un toutes les 1,0 s (v1.0 : 12, toutes les 1,5 s) ; contestation à 6 zombies | Vérifier que le jeu tient 22 zombies (+4 par joueur supplémentaire) à 60 images/s |
| 6 | Phase 5 : téléportation après de gros dégâts + cercle rituel | ≈ 18 balles en 3 s (630 dégâts en solo, +75 % par joueur supplémentaire), même pendant l'élan de sa frappe → téléportation à 12–32 m, cercle rituel au sol (effets), message | Rien de plus que `chemin`/`positionValide` déjà fournis ; vérifier que les points d'arrivée sont atteignables |

Réglages ajustés pour que le combat reste jouable : `phase3.pv` 36 → 30 s de tir (les zombies de la phase 3 rallongeaient la phase d'un tiers), `phase5.frappe.invulnerabilite` 1,5 → 3 s.

Fichiers à remplacer : `src/config.js`, `src/logique.js`, `src/fx.js`, `src/audio.js`, `src/hud.js`, `sons/manifest.json` ; fichier à ajouter : `sons/annonce_munitions_max.mp3`. `arene.js`, `boss-modele.js` et la tête ne changent pas. Si tu avais modifié `config.js`, reporte tes valeurs dans la nouvelle version (clés v1.1 : `zombies`, `phase3.piliers`, `phase3.apparitions`, `phase3.apparitionsSuspendues`, `bonusFinDePhase`, `phase4.apparitions`, `phase4.zombiesPourContester`, `phase5.teleportDegats`, `phase5.frappe.invulnerabilite`).

---

## 1. Ce que contient le paquet

| Dossier / fichier | Rôle |
|---|---|
| `src/config.js` | **Tous** les réglages (PV, dégâts, durées, zombies, coop, textes, récompenses). Global `BOSS_B7_CONFIG` |
| `src/arene.js` | Données éditables de la salle secrète et des points de Bunker 7 (Mod Tools). Global `BOSS_B7_ARENE` |
| `src/logique.js` | Machine à états du combat, **indépendante du rendu** (tourne sous Node) : phases, attaques, absorption, piqué, murs, rituel, traque, jauge, récompenses, coop, garde-fous anti-blocage. Global `BossB7Logique` |
| `src/boss-modele.js` + `src/tete/boss-tete.js` | Modèle 3D animé du Septième : corps skinné (143 os), manteau et étole simulés, ailes, deux lames, 24 actions (v1.3 : `siphon` ; v1.4 : `crochet` ; v1.5 : `evanouissement`, `resurgissement`), 7 locomotions, couleur des lames (v1.4). Global `BossB7Modele`, tête `BOSS_B7_TETE` |
| `src/fx.js` | Effets visuels : sorts, zones, âmes, ailes, piqué, téléportations (cercle rituel au sol dans le bunker), débris, piliers touchés et effondrés, cercle rituel, faisceau, obscurité, sang, défaite ; v1.5 : surcharge, murs électrifiés, infection, bras et petits Démembrés, intangibilité. Global `BossB7Fx` |
| `src/audio.js` + `sons/` | Musique par phase (enchaînements exacts), effets, annonce « Munitions max », sons des chiens zombies, des cuves, des mini-boss (rages, murs, bras, charge), des paliers, de l'intangibilité et des crochets ; 133 MP3 + `manifest.json`. Global `BossB7Audio` |
| `src/hud.js` | Interface DOM : barre à segments, phase, comptes à rebours, anneau de capture, jauge du pacte, état critique, invite d'interaction, titres, messages (pilier effondré, bonus au sol, téléportation, mini-boss), barres des mini-boss, récompenses, message final. Global `BossB7Hud` |
| `prototype/` | Démonstration jouable (`index.html`) + mini-moteur de référence. `proto-adaptateur.js` est **l'exemple complet d'adaptateur** à reproduire avec les systèmes du jeu ; `proto-zombies.js` contient l'IA et les capacités des mini-boss, des chiens et des petits Démembrés (à porter dans le jeu) ; `proto-joueur.js` les mécaniques du joueur (étourdissement, projection, traction…) ; `proto-monde.js` la salle secrète construite en procédural ; `proto-boss.js` l'assemblage (tirs sur le Septième, boucle) ; `proto-bots.js` des coéquipiers de test, à ne pas intégrer |
| `tests/` | 94 tests de la logique (Node), campagne d'équilibrage (`tests/logique/campagne.js`) + tests navigateur du prototype (Playwright) |
| `sources/` | Pour régénérer : sources du modèle (`modele/parts` + `assembler.py`), chaîne de sculpture de la tête (Python), recettes audio (Python) |

Tous les modules sont des scripts classiques (`globalThis.X`) **et** CommonJS, sans dépendance. Three.js est passé en paramètre. Ils sont compatibles avec Three.js **r128 et récent** (vérifié en r186).

## 2. Ordre de travail (par étapes ; à la fin de chaque étape : rapport à Anthony et accord avant la suivante)

À chaque fin d'étape, écris à Anthony, en français simple : ce qui est fait, ce qu'il doit tester dans le jeu (gestes précis et
résultat attendu), ce qui reste. Attends son accord avant l'étape suivante. Ne supprime ni ne réécris aucun système du jeu
existant : tu ajoutes le combat et tu branches ses points d'entrée.

0. **Préparer** : branche git dédiée (ou copie de sauvegarde du jeu). Garde ce paquet tel quel dans un dossier du dépôt (par
   exemple `boss-bunker7/`) : c'est la référence et l'endroit où se lancent les tests (§11.1). Crée à la racine du jeu un fichier
   de suivi, `SUIVI-BOSS-B7.md` (étape en cours, fait, reste, décisions d'Anthony, problèmes ouverts), tenu à jour à chaque
   étape, et ajoute au `CLAUDE.md` du jeu une courte section qui renvoie à ce paquet et à ce fichier : une nouvelle session
   reprend ainsi là où la précédente s'est arrêtée.
   Fichiers à ne jamais lire en entier (données générées, plusieurs Mo) : `src/tete/boss-tete.js`, `prototype/sons-embarques.js`,
   `prototype/vendor/three.min.js`, `sons/manifest.json`. Les gros modules (`logique.js`, `fx.js`, `boss-modele.js`,
   `audio.js`, `prototype/proto-zombies.js`, `prototype/proto-monde.js`) se lisent par leur en-tête et par sections, avec
   `API.md` comme carte.
1. **Lire et décrire** (aucun code) : lis ce document en entier (§11 à §14 compris), `API.md`, `CONCEPTION.md`, puis le code du
   jeu. Établis la **fiche du jeu** (§12) et la liste des **décisions** (§13) avec leurs valeurs par défaut. Présente-les à
   Anthony avec ton plan ; corrige selon ses réponses.
2. **Copier et calibrer** : copie `src/` et `sons/` dans le jeu (par exemple `jeu/boss-b7/` et `jeu/sons/boss/`) et charge-les
   dans cet ordre : `config.js`, `arene.js`, `logique.js`, `tete/boss-tete.js`, `boss-modele.js`, `fx.js`, `audio.js`, `hud.js`.
   Règle `DPS_REFERENCE` (§11.1) et les identifiants des récompenses (§11.8). Contrôle : le jeu se lance comme avant, sans erreur
   dans la console, `BOSS_B7_CONFIG.valider()` renvoie `[]`.
3. **Adaptateur `jeu`** (§3 et §11) : le seul pont entre le combat et le jeu.
4. **Salle secrète** (§4) : géométrie, collisions, navigation des zombies, cuves, dalles, piliers, lumières.
5. **Rendu et tirs** : modèle, tirs sur le Septième (§11.2), effets, sons, interface, boucle (§5, §6).
6. **Ennemis et mécaniques du combat** (§11.4) : zombies du combat, chiens, mini-boss (IA et capacités à porter depuis
   `prototype/proto-zombies.js`), petits Démembrés ; mécaniques du joueur (étourdissement, vision brouillée, projection, traction,
   état critique ; référence `prototype/proto-joueur.js`).
7. **Menu de test développeur** (§14).
8. **Déclenchement et fin** (§7).
9. **Validation** : chaque critère du §9, rapporté à Anthony (ce qui marche, ce qui reste, ce qui n'a pas pu être vérifié).

## 3. L'adaptateur `jeu` (API.md §3)

Reproduis `prototype/proto-adaptateur.js` avec les vrais systèmes. Toutes les positions sont en mètres, dans le repère monde du jeu. Le lacet vaut 0 quand le personnage regarde +Z.

Obligatoires :

| Fonction | À brancher sur |
|---|---|
| `joueurs()` | joueurs présents : `{ id, position, vitesse, lacet, vivant, aTerre, lieu, pvFraction }`. `lieu` = `'salle'` (salle secrète) ou `'bunker'` (carte). Morts compris : la coop compte les présents |
| `infligerDegats(id, fraction, { source, ignorerReductions })` | dégâts en **fraction des PV max**. `ignorerReductions: true` pour les blocs de la phase 3 (25 % minimum, exigence du cahier des charges : les atouts ne réduisent pas) |
| `blessureCritique(id, 0.01)` | PV = min(PV actuels, 1 % des PV max), **ne tue jamais**. La régénération normale du jeu reprend ensuite |
| `teleporter(id, position, lacet, lieu)` | téléportation (salle ↔ Bunker 7) |
| `controle(id, actif)` / `invulnerable(id, actif)` | séquences scénarisées |
| `faireApparaitreZombie({ position, lieu, effet, source, vitesse, agressif })` → id | zombie du jeu à cet endroit ; `effet` : `'emergence'` (sort du sol), `'breche'`, `'normal'` ; v1.1 : `vitesse: 'sprint'` = vitesse de course maximale du jeu, `agressif: true` = poursuite immédiate et continue d'un joueur |
| `zombies()` | `{ id, position, vivant, lieu }` |
| `effetZombie(id, effet)` | `'saisie'` (immobilisé, il résiste), `'extraction'` (soulevé, âme arrachée), `'relache'` |
| `retirerZombie(id, { effet })` | `'cendres'`, `'absorbe'`, `'silencieux'` ; **sans points** pour les joueurs |

Optionnelles, mais à fournir dans le jeu : `faireApparaitreBonus({ type, position, lieu, duree })` → `true` (v1.1 : vrai bonus du jeu à ramasser ; absent ou `false` → la logique appelle `activerBonus`), `chemin` (navigation de Bunker 7 pour la traque de la phase 5), `positionValide`, `visible`, `apparitionsNormales(actif, { max, intervalle, lieu })` (sinon la logique fait apparaître elle-même), `suspendreManches(actif)`, `listeAtouts()` (tous les atouts de Bunker 7), `donnerArme(id, armeId, { pap: 3 })` (`false` si l'inventaire est plein), `donnerAtout`, `activerBonus(bonusId, { joueur })`, `deposerRecompense` (autel), `lireDrapeau`/`ecrireDrapeau` (sauvegarde), `pointsBunker(type)`, `regarder`, `journal`.

Les identifiants des récompenses sont dans `config.conclusion.recompenses` : remplace `merveille-1`/`merveille-2` par les identifiants réels des deux armes merveilles de Bunker 7, et vérifie les 9 bonus (`munitions-max`, `mort-instantanee`, `points-doubles`, `bombe-nucleaire`, `charpentier`, `vente-flash`, `points-bonus`, `atout-gratuit`, `machine-de-mort`). Les bonus absents du jeu peuvent être retirés de la liste.

## 4. La salle secrète et les points de Bunker 7

- `arene.salle.origine` : place la salle **hors des zones jouables** (sous la carte, par exemple), invisible depuis Bunker 7. Toute la logique raisonne en `origine + coordonnées locales`.
- Géométrie : salle octogonale (apothème 15 m, hauteur 8 m), 4 piliers, 8 brèches au sol, autel, lustre et 4 braseros.
- **Piliers destructibles (v1.1)** : affiche-les selon `etat().piliers` (`intact`, `endommage` avec `coups` = 1 ou 2, `detruit`) ; à `detruit`, effondrement (≈ 1,2 s, `t` = secondes depuis le changement), puis tas de gravats bas : collision retirée ou réduite, navigation des zombies mise à jour, ligne de vue dégagée. L'évènement `pilier` `touche` donne `pointImpact` pour placer la marque. Les piliers restent en ruine jusqu'à la fin du combat. Le prototype la construit en procédural dans `prototype/proto-monde.js` (`ProtoB7Monde`). Tu peux reprendre ce constructeur, ou la refaire avec les ressources du jeu en gardant les mêmes données.
- **Dalles arrachables** (24, 3 par mur) : chaque dalle est un maillage séparé posé **devant** le mur porteur. Son absence laisse un renfoncement de 0,6 m, jamais une ouverture : les collisions des joueurs ne changent pas (`salle.limiteJoueurs`). Affiche-les selon `etat().blocs` (API.md §8 ; référence : `monde.appliquerBlocs` dans `proto-monde.js`). Elles se reforment après 14 s.
- **Cuves des mini-boss (v1.3, 3e cuve en v1.4)** : 3 cuves (`arene.salle.tubes` : position, `lacet` face au centre, rayon 0,85 m, hauteur 2,6 m ; la 3e au milieu du mur nord, devant la dalle `m0-1` qui n'est plus arrachable, la brèche nord avancée en (0 ; 11)) ; affiche-les selon `etat().tubes` : `intact` (liquide vert, bulles, mini-boss endormi qui flotte), `siphon` (le niveau baisse, les bulles s'affolent), `fissure` (fissures lumineuses), `eclate` (verre brisé au bord déchiqueté, tessons, flaque ; le dormeur disparaît). Obstacle permanent. Référence : `monde.appliquerTubes` dans `proto-monde.js`.
- `arene.bunker7` : **à remplir** avec de vraies positions de Bunker 7 : `arriveeJoueurs` (réveil en phase 5), `apparitionsBoss` (au moins 6 points répartis, accessibles), `retourJoueurs` (après la victoire), `apparitionsZombies` (seulement si le jeu ne gère pas ses apparitions). Sinon, fournis `jeu.pointsBunker(type)`.

## 5. Modules de rendu

```js
const combat = BossB7Logique.creerCombat({ config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE, jeu });
const modele = BossB7Modele.creer(THREE, { renderer, tete: BOSS_B7_TETE, qualite: 'haute', gouttes: false });
scene.add(modele.object);                 // le changer de scène si le jeu a une scène par lieu
const fx = BossB7Fx.creer(THREE, { scenes: { salle, bunker }, renderer, camera, config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE,
  ecranSepare: true, monde: { dalle: id => objetDalle(id), positionZombie: id => posZombie(id), lieuDe: p => lieu(p),
    tir: (lieu, origine, direction, max) => tirDecor(lieu, origine, direction, max) },   // v1.5 : { point, normale } | null
  // v1.5 : mareBras: false / lueursIrradies: false si le jeu dessine déjà la mare du bras / la lueur des irradiés
  surSecousse: (force, duree) => secouerCamera(force, duree) });
fx.brancher(combat);
const audio = BossB7Audio.creer({ context: THREE.AudioContext.getContext(), manifeste, base: 'sons/boss/', config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE });
await audio.precharger(); audio.brancher(combat);
// v1.1 : au ramassage du bonus « Munitions max » posé par le combat, si le jeu n'a pas son propre annonceur :
// audio.annoncerBonus('munitions-max');
// v1.3 : à chaque capacité d'un mini-boss (IA du jeu) : audio.sonMiniBoss('survolte', 'charge' | 'decharge' | 'spasme', position, { id })
//        et audio.sonMiniBoss('irradie', 'flaque', position, { etat: 'debut' | 'fin' })
// v1.4 : audio.sonMiniBoss('demembre', 'fleau' | 'impact', …), ('irradie', 'boule' | 'zone', p, { etat, id }), ('survolte', 'etourdi', p, { cible })
// v1.5 : audio.sonMiniBoss('demembre', 'charge', p, { etat, id, cible }), ('demembre', 'projection', p, { etat: 'mur', cible }),
//        ('demembre_petit', 'fleau' | 'impact', …) ; plus d'illusions (v1.4) : ni instances du modèle ni toucherIllusion
const hud = BossB7Hud.creer({ racine: document.body, config: BOSS_B7_CONFIG, toucheInteraction: 'E' });
hud.brancher(combat);
```

- **Tirs sur le boss** : intersecte les rayons des armes avec `modele.hitboxes()` (sphères `tete`/`corps` à jour chaque image). Pour chaque touche, appelle `combat.toucherBoss({ joueur, degats, zone, position, type: 'balle'|'explosif'|'melee' })`. Le retour `{ applique, raison }` indique `raison: 'invulnerable'` quand le tir est absorbé : affiche alors l'impact « bouclier ». Les dégâts sont ceux de l'arme du jeu ; `config.dpsReference` (350) sert d'étalon aux PV.
- **Obscurité de la phase 5** : applique `fx.facteurLumiere(lieu)` aux lumières du jeu, et appelle `fx.rendreEcran(renderer)` **après** le rendu de l'arme en 1re personne (sinon l'arme passe devant le voile).
- **Gouttes de sang** : les effets les dessinent ; garde `gouttes: false` sur le modèle.
- **Une seule** instance de chaque module, créée au chargement de Bunker 7 (pas à chaque partie).

## 6. Boucle (chaque image)

```js
combat.mettreAJour(dt);
const e = combat.etat();
appliquerDalles(e.blocs);                                   // §4
appliquerPiliers(e.piliers);                                // §4, v1.1 (collision et navigation comprises)
appliquerCuves(e.tubes);                                    // §4, v1.3 (cuves des mini-boss)
const vue = e.boss; vue.temps = e.temps; modele.update(dt, vue);   // place, oriente et anime tout
fx.mettreAJour(dt, e, { modele, temps, joueurLocal: { id, position, lieu }, joueurs });
audio.mettreAJour(dt, e, { auditeur: { position: yeuxJoueur, lacet: lacetJoueur, lieu }, joueurLocalId: id,
  positionZombie: zid => posZombie(zid) });                 // v1.5 : grésillement des zombies irradiés
hud.mettreAJour(dt, e, { joueurLocalId: id, positionLocale: positionJoueur });
if (e.interaction) combat.interagir(id, toucheInteractionMaintenue, dt);
// rendu de la scène du lieu du joueur, puis l'arme 1re personne, puis fx.rendreEcran(renderer)
```

La référence exacte est `prototype/proto-boss.js` (fonction `pas`).

## 7. Déclenchement et fin

- **Déclenchement** : à l'évènement final de la quête principale de Bunker 7, si `!jeu.lireDrapeau(config.general.drapeauTermine)`, appelle `combat.demarrer()`. La logique fait la suite : fondu, téléportation de tous les joueurs dans la salle, introduction, phases.
- **Pendant le combat** : la logique appelle `suspendreManches(true)` et gère ses apparitions de zombies.
- **Fin** : après les récompenses et le message, l'état `termine` téléporte les joueurs vers `bunker7.retourJoueurs`, rétablit la vision, reprend les manches (`suspendreManches(false)`) et pose le drapeau. **La partie ne s'arrête pas.**
- **Échec** (tous les joueurs à terre) : état `echec`, à brancher sur la fin de partie habituelle du jeu.

## 8. Réglages et Mod Tools

Tout se règle dans `src/config.js`, sans valeur dispersée dans le code :

| Demande d'Anthony | Clés |
|---|---|
| PV du boss, seuils | `phase1.pv`, `phase2.pv`, `phase3.pv`, `phase4.faiblesse.pv`, `phase5.jauge.degatsRequis`, `dpsReference` |
| Fréquence et nombre de zombies | `phase1/2.invocation.intervalle`, `zombiesParSort`, `zombiesMax`, `absence.apparitions`, `phase3.apparitions`, `phase4.apparitions`, `phase5.apparitions`, `coop.zombiesParJoueurSupp` |
| Vitesse et agressivité des zombies (v1.1) | `zombies.vitesse` (`'sprint'`), `zombies.agressif` |
| Piliers (v1.1) | `phase3.piliers.coupsDestruction` (3), `margeBloc`, `rayonDegats` |
| Bonus de fin de phase (v1.1) | `bonusFinDePhase.actif`, `type`, `duree` |
| Téléportation sur dégâts (v1.1) | `phase5.teleportDegats.seuil`, `fenetre`, `delaiMin`, `distanceMin`, `distanceMax`, `gelJauge` |
| Dégâts des attaques | `phase1.invocation.zone.degatsParSeconde`, `phase1.trait.degats`, `phase2.pique.degats`, `phase3.arrachement.degats` (≥ 0,25), `phase3.ondeChoc.degats`, `phase5.frappe.pvRestants` (0,01), `phase5.frappeOrdinaire.degats` |
| Temps entre les capacités | tous les `intervalle` |
| Âmes pour les ailes, vitesse du piqué | `phase2.amesPourAiles`, `phase2.pique.vitesse` |
| v1.4 | `miniBoss.demembre.*` (pv, vitesse, fleau), `irradie.boules.*` (intervalle, parVolee, parJoueurSupp, impact, zone : dpsBase, dpsParSeconde, dpsMax, oubli), `survolte.decharge.multi`, `etourdissement`, `phase3.salve` (seuil, blocs, ecart, intervalle, predictions, decalage), `phase4.faiblesse.apparitions`, `phase5.paliers` (seuils, critique, bleu, crochet ; `illusions` retirée en v1.5) |
| v1.5 | `miniBoss.survolte.rage`, `irradie.rage` (dont `aura`), `demembre.rage` (`duree`, `vol`), `miniBoss.murs` (distance, degatsParSeconde, tick, extinction), `demembre.echelle`, `fleau`, `charge` (preparation, vitesse, distanceMax, largeur, degats, projection, impactMur, recharge, etourdiMur), `petits` (intervalle, premier, max, maxParJoueurSupp, rayon, profil), `miniBoss.bonusMort`, `phase5.paliers.intangible` (dont `fente`) |
| Mini-boss (v1.3) | `miniBoss.seuils` (0,75 et 0,5), `ordre`, `siphon.*` (durées, apparition), `survolte.pv`, `vitesse`, `degatsContact`, `decharge.*` (portée, intervalle, dégâts, flou, recharge), `irradie.pv`, `vitesse`, `degatsContact`, `aura.*`, `flaque.*` ; `miniBoss.actif: false` retire la mécanique |
| Téléportations, absence | `introduction.*`, `absence.duree` (30 s), `phase5.disparition.duree` |
| Rituel | `phase4.duree` (30 s), `phase4.rayon`, `regleAbandon`, `zombiesPourContester` (6) |
| Frappe spéciale | `phase5.frappe.pvRestants` (0,01), `invulnerabilite` (3 s), `immunite` (15 s) |
| Obscurité | `phase5.obscurite.intensite`, `rayonVision` |
| Dégâts consécutifs | `phase5.jauge.degatsRequis`, `delaiAvantBaisse`, `vitesseBaisse` |
| Coop | `coop.*` |
| Textes, nom, message final, récompenses | `general.*`, `conclusion.*` |

`config.valider()` signale toute valeur qui contredit le cahier des charges (25 %, 1 %, 15 s, 30 s, 30 s).

Pour le Mod Tools : `arene.js` (positions, dalles, cercle, brèches, points de Bunker 7, lumières), `config.js`, la table `BossB7Audio.SONS_ACTIONS` (son de chaque geste), `manifest.json` (fichiers et niveaux), les textes de `BossB7Hud` (`OBJECTIFS`, `NOMS`, options `objectifs` et `noms`).

**Coop en réseau** (si le jeu en a un plus tard) : fais tourner la logique sur l'hôte seulement, et diffuse `combat.etat()` et les évènements aux clients. Le modèle, les effets, les sons et l'interface ne lisent que l'instantané et les évènements : ils fonctionnent tels quels côté client.

## 9. Critères de validation (à vérifier et rapporter)

| # | Critère | Comment vérifier |
|---|---|---|
| 1 | Logique intacte | `node tests/test-logique.js` : 94 tests sur 94 |
| 2 | Déclenchement unique | le combat ne démarre qu'après la quête ; impossible une 2e fois (drapeau) |
| 3 | Téléportation et salle secrète | tous les joueurs arrivent dans la salle, invisible depuis Bunker 7 |
| 4 | Phase 1 | sorts visibles et esquivables, zombies qui émergent, réactions du boss aux tirs |
| 5 | Répit et absence | 15,0 s et 30,0 s exactement (comptes à rebours) |
| 6 | Phase 2 | 10 âmes → ailes ; piqué annoncé et esquivable ; ailes perdues après chaque piqué |
| 7 | Phase 3 | blocs : au moins 25 % des PV max par impact, même avec des atouts ; murs reconstruits, aucune collision cassée |
| 8 | Phase 4 | capture 30 s ; règle du cercle vide affichée ; en coop, pas plus rapide à plusieurs |
| 9 | Phase 5 | traque qui respecte la navigation de Bunker 7 (pas de passage à travers les murs) ; frappe spéciale → 1 % exactement ; jauge compréhensible |
| 10 | Fin | interaction, récompenses une seule fois par joueur (armes PaP 3, atouts, bonus), message final, retour dans Bunker 7, manches qui reprennent |
| 11 | Robustesse | mort ou départ d'un joueur à chaque phase, tir pendant les séquences, onglet en arrière-plan : jamais de blocage |
| 12 | Performances | 60 images/s visées sur la machine d'Anthony ; le modèle fait ≈ 56 000 triangles et ≤ 39 appels de dessin ; 22 zombies au sprint en phase 4 |
| 13 | v1.1 zombies | tous les zombies du combat courent à la vitesse maximale du jeu et foncent sur un joueur dès l'apparition |
| 14 | v1.1 piliers | caché derrière un pilier en phase 3 : 3 blocs le détruisent (effondrement, gravats) ; le 4e bloc passe et touche ; aucun zombie ni joueur coincé dans les gravats |
| 15 | v1.1 phase 3 | des zombies arrivent ≈ 5 s après le retour en rage et traquent les joueurs |
| 16 | v1.1 bonus | à la fin de chacune des 5 phases, un « Munitions max » du jeu apparaît au sol ; le ramasser remplit chargeurs et réserves ; l'annonceur le dit |
| 17 | v1.1 phase 4 | jusqu'à 22 zombies en solo (26 à deux…) ; le cercle reste tenable |
| 18 | v1.1 phase 5 | ≈ 18 balles en 3 s sur lui (60 % d'un chargeur) → il se téléporte ailleurs dans le bunker, avec un cercle rituel au sol au départ et à l'arrivée ; criblé pendant l'élan de sa frappe, il s'enfuit sans frapper |
| 19 | v1.2 phase 1 | sous 50 % des PV de la phase 1 : chaque sort est doublé, les deux tombent sous le joueur à 1–2 s d'écart ; caché derrière un pilier, le sort s'y écrase |
| 20 | v1.2 chiens | sous 50 % : 2 chiens (solo) sortent de failles ; ils restent pendant le répit, l'absence, la phase 3, le rituel, la faiblesse ; ils reviennent dans Bunker 7 en phase 5 ; un chien tué revient après 10–15 s ; à la défaite du boss ils tombent en cendres et n'apparaissent plus |
| 21 | v1.3 cuves | 2 cuves modélisées et intactes à chaque début de phase 2, un mini-boss endormi visible dans chacune ; brisées ensuite jusqu'à la fin du combat ; aucune collision cassée |
| 22 | v1.3 1er seuil | Septième à 75 % en phase 2 : même un très gros coup s'arrête à 75 % ; « Protégé » ; il siphonne la cuve du Survolté (flot vert, fissures, éclatement) et le Survolté en sort |
| 23 | v1.3 protection | tant que le mini-boss vit : tirs sur le Septième « Protégé » (aucun dégât), le Septième continue d'attaquer ; à la mort du mini-boss, il reprend des dégâts à partir du seuil |
| 24 | v1.3 2e seuil | à 50 % : 2e cuve, L'Irradié ; puis la phase 2 se termine normalement |
| 25 | v1.3 capacités | Survolté : décharge à 8 m max (15 %, vision brouillée 1 s), pause de 2 s après chaque décharge ; Irradié : aura de 3 m, flaque toxique 5 s à sa mort |
| 26 | v1.3 interface et sons | une barre par mini-boss sous celle du Septième, à son nom et à sa couleur ; « Abattu » puis disparition 3 s après sa mort ; sons des cuves, de l'arrivée, des boucles et des morts |
| 27 | v1.4 3e cuve | 3 cuves intactes au début de chaque phase 2 ; à 25 % des PV, la 3e cuve éclate et Le Démembré en sort, barre « LE DÉMEMBRÉ » dorée ; son fléau tournoie, puis frappe en arc ; son bras ne se détache jamais |
| 28 | v1.4 Irradié | 4,4 m/s, aura de 6 m ; une salve de boules toutes les 6 s (2 en solo, +1 par joueur) ; chaque zone reste jusqu'à sa mort et tue si on y reste ≈ 5 s ; toutes s'éteignent à sa mort |
| 29 | v1.4 Survolté | 5,4 m/s ; une décharge touche tous les joueurs à 8 m en vue ; chaque joueur touché est étourdi 1 s |
| 30 | v1.4 phase 3 | sous 50 % : 4 blocs désignés ensemble et lancés en moins d'une demi-seconde, répartis entre les joueurs ; message à la première salve |
| 31 | v1.4 faiblesse | des zombies apparaissent pendant que le Septième est à terre |
| 32 | v1.4 phase 5, lames | lames bleu très clair : deux coups tuent ; à 25 % de la jauge, lames rouges : chaque coup laisse à 1 % |
| 33 | v1.4 illusions | **caduc en v1.5** : il n'y a plus d'illusions (voir 43) |
| 34 | v1.4 crochets | à 75 % : au plus un lancer toutes les 15 s ; accroché, on est ramené devant lui sans pouvoir résister, puis il frappe ; un pas de côté l'évite |
| 35 | v1.5 Survolté | à la moitié de ses PV : immobile, « Invulnérable » sur sa barre, rayon d'énergie depuis le Septième (dont les PV ne bougent pas) ; 2,5 s plus tard les 8 murs s'électrifient (effets, sons), bandeau « Murs électrifiés » |
| 36 | v1.5 murs | à moins de 2,2 m d'un mur : ≈ 12 % des PV par seconde ; au centre : rien ; à sa mort, les murs s'éteignent en 1 s ; les coéquipiers IA s'écartent des murs |
| 37 | v1.5 Irradié | à la moitié de ses PV : cri, puis tous les zombies et chiens de la salle deviennent verts et blessent à 1,5 m (≈ 4 %/s) ; un zombie qui apparaît ensuite l'est aussi ; à sa mort, tous redeviennent normaux |
| 38 | v1.5 Démembré géant | sort d'une cuve agrandie ; deux fois plus grand qu'un petit Démembré ; son fléau touche jusqu'à 6 m |
| 39 | v1.5 bras | à la moitié de ses PV : invulnérable, il s'arrache le bras et le lance au centre ; un petit Démembré en sort toutes les 2,5 s, jamais plus de 6 en solo (+2 par joueur) ; à sa mort, ils s'effondrent tous et le bras se flétrit |
| 40 | v1.5 charge | sans bras, il gratte le sol 0,8 s puis fonce ; touché : 35 % et projeté ; contre un mur : +10 % ; lui contre un mur : étourdi 1,2 s |
| 41 | v1.5 Munitions max | un bonus au sol à la mort de chacun des 3 mini-boss ; le ramasser remplit chargeurs et réserves |
| 42 | v1.5 plus d'illusions | à 50 % de la jauge : aucune illusion, aucun son d'illusion |
| 43 | v1.5 intangibilité | à 50 % de la jauge, s'éloigner à plus de 10 m : il s'efface, invisible (les balles le traversent, la jauge ne bouge pas, on l'entend) ; il traverse les murs en ligne droite (le mur ondule) ; après un mur, à ≈ 6 m d'un joueur en vue, il réapparaît, fond sur lui et frappe (≈ 1 s pour s'écarter) ; loin de tout joueur, il recommence (pas avant 6 s) |
| 44 | Armes du jeu | une arme de chaque catégorie du §11.3 blesse le Septième ; tête : × 1,5 exactement par rapport au corps ; impact « bouclier » quand il est protégé ; les balles le traversent quand il est invisible |
| 45 | Calibrage | avec l'arme de référence, en solo : ≈ 27 s de tir continu sur lui pour finir la phase 1 (PV `s(27)`) |
| 46 | Morts d'un coup | ni « mort instantanée », ni « bombe nucléaire », ni arme merveille n'abattent le Septième ou un mini-boss d'un coup |
| 47 | Bonus du combat | pas de bonus aléatoire pendant le combat (D3 par défaut) ; « Munitions max » à chaque fin de phase et à chaque mini-boss abattu |
| 48 | Récompenses | les 2 armes merveilles au niveau voulu (ou sur l'autel si l'inventaire est plein), tous les atouts, les bonus du jeu, une fois par joueur |

## 10. Ce qui a été vérifié avant livraison (prototype, pas le jeu)

- **Logique** : 94 tests sous Node (chaque phase, règles 25 %, 1 % et 30 s, coop de 1 à 4 joueurs, arrivées et départs, robustesse, déterminisme, les 6 demandes v1.1, les 2 demandes v1.2, les mini-boss de la v1.3, toute la v1.4 : 3e cuve, salves et leur répartition de 1 à 4 joueurs, faiblesse, paliers, crochets ; et la v1.5 : rages, murs, infection, bras et petits, charge, Munitions max, intangibilité et fente, fins sans suite ; 24 mutations de la logique toutes détectées en v1.4).
- **v1.5 dans le prototype assemblé** (`tests/navigateur/test-v15-assemblage.js`, 35 vérifications) : 23 nouveaux sons chargés (133), ceux des illusions retirés ; Survolté à 50 % : invulnérable (balle sans effet), « Invulnérable » sur sa barre, rayon dessiné, murs électrifiés 2,5 s plus tard, bandeau, 8 boucles sonores ; 12 %/s à 1,2 m d'un mur, rien au centre, coéquipier qui s'écarte du mur ; extinction à sa mort, Munitions max posé puis ramassé (chargeur et réserve pleins) ; Irradié : infection 1,2 s après le cri, tous les zombies et chiens irradiés, un nouveau zombie irradié en 0,02 s, aura ≈ 4 %/s, grésillement, tout s'éteint à sa mort ; Démembré : cuve géante, 3,9 m de haut, fléau qui touche à 4 m, bras posé au centre à 2,42 s, petits toutes les 2,5 s plafonnés à 6, rapport de taille 2, charge à 35 % avec projection, effondrement des 6 petits à sa mort ; 3 Munitions max ; phase 5 : aucune illusion, évanouissement, modèle masqué, balles « absent », jauge gelée, boucle sonore, une traversée de mur, resurgissement à 5,4 m, fente jusqu'à 1,8 m et coup qui porte, nouvel évanouissement après la recharge ; aucune erreur console.
- **v1.4 dans le prototype assemblé** (`tests/navigateur/test-v14-assemblage.js`, 28 vérifications en v1.5 : le bloc des illusions est remplacé par leur absence) : 3 cuves et 3 repères ; une décharge du Survolté qui touche le joueur et un coéquipier, étourdissement de 1 s ; Irradié à 4,4 m/s, salves de 2 boules toutes les ≈ 6 s, zones qui restent puis s'éteignent toutes à sa mort (sons compris), aura à 5 m ; Démembré libéré de la 3e cuve, barre dorée, fléau à 30 % ; fin normale de la phase 2 ; salve de 4 blocs en 0,37 s ; zombies pendant la faiblesse ; lames bleues (50 %), rouges (1 %), plus aucune illusion au palier 2 (v1.5), crochet lancé, accroché, ramené, puis coup ; aucune erreur console.
- **v1.3 dans le prototype assemblé** (`tests/navigateur/test-v13-assemblage.js`, 35 vérifications) : cuves intactes, PV bloqués à 75 % puis 50 %, siphon en 4 étapes, cuve siphon › fissure › éclatée, Survolté puis Irradié libérés avec les PV de la config, protection (tirs refusés), le Septième qui continue d'attaquer, décharges (dégâts, vision brouillée), aura et flaque, barres de PV (nom, couleur, 60 % après 40 % de dégâts, « Abattu »), 500 points, sons (15 chargés, boucles qui suivent le mini-boss et se coupent à sa mort), fin normale de la phase 2, cuves remises à neuf par `allerA`.
- **v1.2 dans le prototype assemblé** (`tests/navigateur/test-v12-assemblage.js`) : un seul sort avant 50 %, meute lâchée à 50 % (2 failles puis 2 chiens), paires de sorts à 1–2 s qui tombent à moins de 1,6 m du joueur, morsures, chien remplacé après 10–15 s, chiens intacts au répit, meute en phase 3 et au rituel, 2 chiens dans Bunker 7 en phase 5, cendres à la défaite et plus aucune faille.
- **v1.1 dans le prototype assemblé** (`tests/navigateur/test-v11-assemblage.js`) : sprinteurs, bonus posé puis ramassé (munitions pleines, annonce), pilier détruit au 3e bloc, zombies en phase 3, 22 zombies en phase 4, téléportation sur dégâts avec cercles rituels.
- **Prototype dans Chromium** : chargement sans erreur, introduction depuis le bunker, chaque état, puis combat complet avec 3 coéquipiers simulés jusqu'à la conclusion (839 s ≈ 14 min de jeu en v1.5 avec les coéquipiers immortels, les 3 mini-boss et leurs rages, et les 4 paliers de la phase 5 compris). Fin vérifiée : interaction, 2 armes, tous les atouts, 9 bonus, message, retour dans Bunker 7, drapeau posé.
- **Rendus** : r128 et r186. Revue visuelle du modèle (27 planches), des effets (17 planches) et du prototype. Contrôle anti-salut automatique.
- **Sons** : mesures et spectrogrammes seulement. **Personne n'a écouté les sons.**
- **Rendu logiciel seulement** (SwiftShader) : jamais testé sur une vraie carte graphique.

Licences : `LICENCES.md`.

## 11. Armes, Pack-a-Punch et systèmes du jeu (règles d'intégration)

Principe : le combat ne connaît aucune arme du jeu. Il reçoit des **dégâts** (`combat.toucherBoss`) et lit les **PV** des ennemis
que le jeu fait vivre (`jeu.zombies()`). Toutes les armes du jeu (de départ, murales, de la boîte, améliorées au Pack-a-Punch à
n'importe quel niveau, armes merveilles, armes de corps-à-corps des personnages, équipements) fonctionnent donc sans liste à
tenir, à condition de suivre les règles ci-dessous.

### 11.1 Calibrage des PV sur les armes du jeu (`DPS_REFERENCE`)
- `src/config.js`, en tête : `DPS_REFERENCE` (350 dans le paquet : arme du prototype, 35 dégâts × 10 balles/s). Tous les PV et
  seuils écrits `s(…)` en dépendent : Septième (phases 1, 2, 3 et faiblesse), mini-boss, chiens, petits Démembrés, zombies du
  combat (`zombies.pv`), jauge de la phase 5, seuil de téléportation sur dégâts.
- Valeur à mettre : DPS soutenu de l'**arme de référence** choisie avec Anthony (§13, D1) = dégâts d'une balle dans le corps, au
  niveau de Pack-a-Punch que le joueur a normalement à la fin de la quête, × balles par seconde ; sans rechargement, sans
  multiplicateur de tête, sans atout. Montre le calcul à Anthony (données de l'arme : fichier et ligne) avant de l'appliquer.
- Lecture : avec `DPS_REFERENCE` = 1 400, le Septième a 4 × plus de PV qu'avec 350, et les durées de `CONCEPTION.md` restent
  valables pour un joueur qui a l'arme de référence. Une arme 2 × plus forte (arme merveille, niveau de Pack-a-Punch supérieur)
  divise environ par 2 la durée de chaque phase ; une arme de départ la multiplie.
- Téléportation sur dégâts (phase 5) : calibrée sur ≈ 60 % d'un chargeur de 30 balles de l'arme de référence en 3 s. Si les
  chargeurs du jeu sont très différents, ajuste `phase5.teleportDegats.seuil` (toujours en `s(…)`).
- Tests : les tests de la logique et la campagne d'équilibrage supposent 350 (robots à 350 DPS, zombies de 150 PV). Lance-les
  dans le dossier du paquet, dont la config reste à 350 : `node tests/test-logique.js` (94 sur 94). Dans la copie du jeu, ne
  modifie que `config.js` et `arene.js` ; garde `logique.js` identique au paquet. Une correction de la logique se fait dans les
  deux copies, puis les tests se relancent dans le paquet.

### 11.2 Tirs sur le Septième : une seule porte d'entrée
- Cibles : les sphères `modele.hitboxes()` (`tete`, `corps`), à jour à chaque image ; pas de lancer de rayon sur le maillage
  skinné. Ne les propose aux armes que si `etat().boss.present && etat().boss.visible`, dans le même `lieu` que le tireur
  (référence : le fournisseur de tir du boss dans `prototype/proto-boss.js`).
- Chaque touche → `combat.toucherBoss({ joueur, degats, zone, position, type })` :
  - `degats` = les dégâts que l'arme du jeu infligerait à un zombie touché **au corps** (Pack-a-Punch, atouts, munitions
    spéciales, distance et pénétration compris), **sans** le multiplicateur de tête du jeu : la logique applique le sien
    (`boss.multiplicateurTete`, 1,5) quand `zone === 'tete'`. Sinon la tête compterait deux fois ;
  - `type` : `'balle'`, `'explosif'` ou `'melee'` ;
  - fusil à pompe : un appel par plomb, ou un appel par tir et par zone avec la somme des plombs ;
  - explosion : un appel par explosion, avec les dégâts du jeu à la distance du Septième (`zone: 'corps'`) ;
  - dégâts sur la durée (feu, poison, électricité) : un appel par tic, comme pour un zombie.
- Retour `{ applique, montant, raison }` : `raison: 'invulnerable'` → impact « bouclier », pas de marqueur de touche normal ;
  `'absent'` → la balle continue sa course (Septième invisible, intangible ou absent). Marqueur de touche et chiffres de dégâts
  du jeu seulement si `applique`.
- Multiplicateurs déjà appliqués par la logique (ne pas les refaire) : phase 3 × 0,6 ; + 50 % pendant une absorption ;
  faiblesse × 1,25.
- Le Septième ne meurt jamais d'un effet « mort instantanée », d'un pourcentage de PV ou d'un script de mise à mort : seulement
  par des dégâts transmis à `toucherBoss`.

### 11.3 Catégories d'armes et d'effets

| Catégorie | Contre le Septième | Contre les mini-boss | Contre zombies, chiens, petits Démembrés |
|---|---|---|---|
| Balles (toutes armes, tous niveaux de Pack-a-Punch) | `toucherBoss`, `type: 'balle'` | dégâts normaux du jeu sur leurs zones de tir (le géant ×2 : zones ×2) | normal |
| Explosifs (grenades, lance-roquettes, munitions explosives) | `'explosif'`, un appel par explosion | normal | normal |
| Corps-à-corps : couteau (Anthony), machette (Chinedu), sabre japonais (Takeshi), lathi (Rajesh) et leurs améliorations | `'melee'` | normal | normal |
| Armes merveilles et effets qui tuent d'un coup (désintégration, gel, aspiration, souffle, foudre en chaîne…) | dégâts **finis** par impact (§13, D5), jamais d'effet de mort | mêmes dégâts finis, jamais tués d'un coup | effet normal |
| Effets de contrôle (gel, ralentissement, toile, étourdissement, recul, aspiration, attraction) | aucun | aucun pendant la sortie de cuve, les rages et la charge ; ailleurs, au plus un ralentissement | normal |
| Dégâts sur la durée | un appel par tic | normal | normal |
| Leurres (attirent les zombies) | ignorés | ignorés | normal (zombies du combat compris) |
| Alliés invoqués par une arme ou un atout | leurs dégâts passent par `toucherBoss` | normal | normal |
| Pièges de la carte (phase 5, dans Bunker 7) | sans effet (§13, D10) | — | normal |

### 11.4 Ennemis du combat (le jeu les fait vivre)
- **Zombies du combat** : `faireApparaitreZombie({ position, lieu, effet, source: 'boss', vitesse: 'sprint', agressif: true, pv })`.
  `pv` = `config.zombies.pv` (≈ 0,43 s de tir de référence) : utilise-le comme PV du zombie à la place des PV de la manche (§13,
  D6). Les mesures supposent aussi des coups de zombie à ≈ 20 % des PV max du joueur. Leurs morts donnent les points habituels ;
  les retraits par la logique (`retirerZombie`, `points: false` : cendres, absorption) n'en donnent pas.
- **Chiens** (meute, `API.md` §14.3) : `type: 'chien'` + `profil` (PV, vitesse, dégâts, cadence, portée). Si le jeu a déjà des
  chiens zombies, prends leur modèle avec ce profil.
- **Mini-boss** (Le Survolté, L'Irradié, Le Démembré géant) : ennemis du jeu créés avec les `pv`/`pvMax` reçus (coop déjà
  comprise) ; `zombies()` doit renvoyer `type`, `pv` et `pvMax` (barres de PV, rages à 50 %). Leur IA et leurs capacités tournent
  dans le jeu : à porter depuis `prototype/proto-zombies.js` (partie « MINI-BOSS ») avec les profils de `config.miniBoss` :
  décharge sur chaque joueur en vue + étourdissement 1 s (Survolté) ; aura, boules et zones radioactives (Irradié) ; fléau,
  arrachement, charge et projection (Démembré) ; rages v1.5 par `effetZombie` (`surcharge`, `infection`, `arrachement`, et
  `irradie` sur les zombies, chiens et petits). Invulnérables pendant la sortie de cuve et pendant `surcharge` et `arrachement`
  (`toucher` sans effet, impact « bouclier ») ; jamais tués d'un coup (« mort instantanée », « bombe nucléaire », armes
  merveilles). Points : 500 au joueur qui l'abat (prototype).
- **Petits Démembrés** : `type: 'demembre_petit'` + `profil` ; ni mini-boss ni zombie de manche (`API.md` §17.1). 100 points.
- **Mécaniques du joueur** à fournir (référence `prototype/proto-joueur.js`) : étourdissement (ni déplacement, ni saut, ni tir, ni
  rechargement ; la vue tremble), vision brouillée, projection (déplacement forcé 0,5 s avec collisions, choc contre un mur →
  `impactMur`), traction du crochet (`tirerJoueur`), `blessureCritique` (1 %, ne tue jamais), `controle`, `invulnerable`,
  `teleporter` entre la salle et Bunker 7, `regarder`.

### 11.5 Bonus (power-ups) pendant le combat
- Le combat pose lui-même « Munitions max » à la fin de chaque phase et à la mort de chaque mini-boss
  (`faireApparaitreBonus`) : utilise le vrai bonus du jeu (objet au sol, ramassage, annonce).
- **Bonus aléatoires lâchés par les zombies** : désactivés du début du combat jusqu'à l'état `termine` (§13, D3). Si Anthony les
  garde : « mort instantanée » ne touche ni le Septième ni les mini-boss ; « bombe nucléaire » tue zombies, chiens et petits
  Démembrés, jamais les mini-boss (le Septième n'est pas concerné) ; « charpentier » ne touche pas les dalles de la salle (elles
  se reforment seules) ; les autres suivent les règles du jeu.
- Les bonus de la récompense finale : §11.8.

### 11.6 Munitions, points, machines et manches
- Manches : `suspendreManches(true)` au début du combat, `false` à la fin ; le compteur de manche ne bouge pas pendant le combat.
- Phases 1 à 4 (salle secrète) : ni boîte, ni armes murales, ni Pack-a-Punch, ni atouts ; les munitions viennent des
  « Munitions max ». Phase 5 (Bunker 7) : machines, armes murales et boîte selon §13, D4.
- Points : gains habituels sur les zombies, chiens et petits Démembrés, 500 par mini-boss, rien par touche sur le Septième (§13,
  D7) ; les points restent après le combat.
- Chargeurs et rechargements : règles du jeu (les mesures supposent 30 balles et 2,1 s de rechargement).

### 11.7 Atouts, PV et réanimation
- Les dégâts du combat sont des **fractions des PV max** (`infligerDegats(id, fraction, { source, ignorerReductions })`) : un
  atout qui augmente les PV max ne change pas le nombre de coups du Septième et des mini-boss pour tuer ; il aide contre les
  zombies (dégâts du jeu).
- Réductions de dégâts du jeu (armure, atouts, bouclier) : appliquées, sauf avec `ignorerReductions: true` (blocs de la phase 3 :
  25 % minimum, exigence du cahier des charges).
- `blessureCritique(id, 0.01)` : PV = min(PV, 1 % des PV max), ne tue jamais ; la régénération normale reprend ensuite.
- À terre et réanimation : règles du jeu ; `joueurs()` donne `vivant` et `aTerre` exacts (réanimation par un coéquipier et
  auto-réanimation en solo comprises). Tous les joueurs à terre → état `echec` → fin de partie habituelle.
- Atouts perdus en tombant : règles du jeu (pas de rachat possible pendant les phases 1 à 4).
- Un joueur à terre qui tire encore (si le jeu le permet) passe par `toucherBoss` comme les autres.

### 11.8 Récompenses
- `config.conclusion.recompenses.armes` = `[{ id: 'merveille-1', pap: 3 }, { id: 'merveille-2', pap: 3 }]` : remplace les deux
  identifiants par ceux des deux armes merveilles de Bunker 7 (§13, D2) ; `pap` = niveau de Pack-a-Punch maximal du jeu (un seul
  niveau dans le jeu → arme améliorée).
- `donnerArme(id, armeId, { pap })` renvoie `false` si l'inventaire est plein (atout de 3e arme compris) : l'arme est alors posée
  sur l'autel (`deposerRecompense`), ramassable, jamais perdue. Arme déjà possédée : remplacée par la version améliorée.
- `atouts: 'tous'` → `listeAtouts()` = tous les atouts disponibles sur Bunker 7 ; la limite d'atouts du jeu est ignorée pour
  cette récompense (§13, D11).
- `bonus` : les 9 identifiants du paquet → ceux du jeu (`munitions-max`, `mort-instantanee`, `points-doubles`,
  `bombe-nucleaire`, `charpentier`, `vente-flash`, `points-bonus`, `atout-gratuit`, `machine-de-mort`) ; retire ceux qui
  n'existent pas.
- Une seule fois par joueur ; un joueur mort à la fin est récompensé à sa réapparition.

### 11.9 Personnages
Anthony, Chinedu, Takeshi et Rajesh : rien de spécifique au combat, sinon leur arme de corps-à-corps (§11.3, `type: 'melee'`).

### 11.10 Coop
Le combat gère 1 à 4 joueurs (PV × n, jauge × (1 + 1,5 × (n − 1)), +4 zombies par joueur supplémentaire), les arrivées et les
départs. Jeu en réseau : la logique tourne sur l'hôte seulement (§8). Les coéquipiers simulés du prototype (`proto-bots.js`,
immortels) sont un outil de test : ne les intègre pas au jeu.

### 11.11 Réglages du joueur, interface, sons
- Volumes : relie `audio.setVolume('general' | 'musique' | 'effets', v)` aux réglages du jeu. La musique du combat remplace celle
  du jeu pendant tout le combat (coupe la musique de manche, rends-la à la fin).
- L'interface du combat (DOM, classes `.b7h-*`) s'ajoute à celle du jeu (munitions, points, atouts, manche) : vérifie aux
  résolutions du jeu qu'aucun élément ne se chevauche (barres en haut au centre, objectif en haut à gauche, jauge et messages en
  bas au centre, alertes et titres au centre) ; déplace au besoin les éléments du combat.
- Lampe torche ou vision nocturne (si le jeu en a) : en phase 5, portée limitée à `phase5.obscurite.rayonVision` (§13, D9).

## 12. Fiche du jeu (à établir en lisant le code, puis à présenter à Anthony)

Pour chaque point : le fichier et la fonction du jeu qui s'en chargent, ou « absent ».
1. Three.js : version, scènes (une ou plusieurs), caméra, rendu de l'arme en 1re personne, boucle principale et `dt`.
2. Joueur : PV et PV max, régénération, à terre et réanimation, contrôles, téléportation, invulnérabilité, effets de caméra.
3. Armes : liste (départ, murales, boîte, merveilles), dégâts, cadence, chargeur, rechargement, multiplicateur de tête,
   pénétration, explosifs, dégâts sur la durée, effets spéciaux ; niveaux de Pack-a-Punch et leurs effets ; corps-à-corps de
   chaque personnage.
4. Détection des tirs : rayons ou projectiles ; comment ajouter une cible (sphères du Septième).
5. Zombies : création, PV par manche, IA, navigation, zones de tir, mort, points ; chiens zombies existants ou non.
6. Bonus : liste et identifiants, lâchers aléatoires, objet au sol, annonceur.
7. Atouts : liste et identifiants, limite, machines, perte en tombant.
8. Équipements : grenades, leurres, mines, boucliers ; pièges de Bunker 7.
9. Économie : points, boîte, armes murales, machine de Pack-a-Punch (coût, niveaux).
10. Manches : début, fin, suspension, compteur.
11. Bunker 7 : évènement final de la quête principale, positions (réveil des joueurs, apparitions du boss, retour, zombies),
    navigation, lumières, emplacement de la salle secrète, identifiants des deux armes merveilles.
12. Sauvegarde : lecture et écriture des drapeaux.
13. Audio : AudioContext, réglages de volume, musique de manche, annonceur.
14. Interface : éléments existants et leurs positions.
15. Coop : nombre de joueurs, réseau ou non, coéquipiers IA.
16. Mod Tools : comment il lit les données de carte (pour `arene.js` et `config.js`).
17. Performances : images par seconde et budget (triangles, appels de dessin) sur la machine d'Anthony.

## 13. Décisions d'Anthony (valeurs par défaut s'il ne tranche pas)

| # | Décision | Par défaut |
|---|---|---|
| D1 | Arme de référence pour `DPS_REFERENCE` | l'arme principale améliorée au Pack-a-Punch la plus courante à la fin de la quête (calcul montré à Anthony) |
| D2 | Les deux armes merveilles de la récompense | les deux armes merveilles de Bunker 7, au niveau de Pack-a-Punch maximal |
| D3 | Bonus aléatoires lâchés pendant le combat | désactivés |
| D4 | Boîte, armes murales, Pack-a-Punch et atouts en phase 5 (Bunker 7) | utilisables normalement |
| D5 | Dégâts des armes qui tuent d'un coup, contre le Septième et les mini-boss | par impact : `DPS_REFERENCE` (1 s de tir de référence), × 2 si l'arme est améliorée |
| D6 | PV des zombies du combat | `config.zombies.pv` (pas les PV de la manche) |
| D7 | Points par touche sur le Septième | aucun |
| D8 | Difficulté en solo | valeurs livrées (solo très dur, voir `CONCEPTION.md`, « Durées mesurées ») |
| D9 | Lampe torche en phase 5 | portée limitée à `phase5.obscurite.rayonVision` |
| D10 | Pièges de la carte contre le Septième | sans effet |
| D11 | Limite d'atouts pour la récompense « tous les atouts » | ignorée |
| D12 | Emplacement de la salle secrète | sous Bunker 7, hors des zones jouables, invisible depuis la carte |

## 14. Menu de test développeur (à ajouter dans le jeu)

Comme le panneau P du prototype, accessible seulement en mode développeur (ou par un réglage du Mod Tools) : aller à chaque état
(`combat.allerA`), joueur invincible, « Seuil suivant » (phase 2), « Mini-boss à 49 % (rage) », « Tuer le mini-boss », « Phase 3
sous 50 % », « Palier suivant (phase 5) », vitesse du temps, et remise à zéro du drapeau `boss-b7-termine` (pour relancer le
combat sur la même sauvegarde). Référence : `prototype/index.html` (gestionnaire du panneau `debug`). Sans ce menu, chaque
vérification demande un combat complet (≈ 14 min).
