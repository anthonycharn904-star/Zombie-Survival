# Effets visuels du boss « Le Septième » — `src/fx.js`

Module `BossB7Fx` (contrat : `API.md` §9). Script classique (`globalThis.BossB7Fx`) et CommonJS ; Three.js passé en
paramètre ; vérifié avec Three.js r128 et r186 (aucune erreur console).

| Fichier | Rôle |
|---|---|
| `src/fx.js` | le module (aucune dépendance hors Three.js) |
| `src/fx/apercu-fx.html` | aperçu : prototype + logique + modèle + effets, panneau de commande, outils de capture (`window.FXA`) |
| `src/fx/captures-fx.js` | planches de contrôle → `captures/fx/*.png` |
| `src/fx/mesure-fx.js` | coût CPU par image et allocations, scénario par scénario |

## Intégration

```js
const fx = BossB7Fx.creer(THREE, {
  scenes: { salle, bunker }, renderer, camera,          // caméra du joueur local
  config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE, qualite: 'haute',
  monde: { dalle(id), positionZombie(id), lieuDe(position),     // facultatif : tout se dégrade sans
           tir(lieu, origine, direction, max) },                 // v1.5, facultatif : faces des murs traversés
  surSecousse(force, duree, position) { /* secousse caméra du jeu */ }
});
const off = fx.brancher(combat);                       // évènements §4
// chaque image, APRÈS modele.update :
fx.mettreAJour(dt, combat.etat(), { modele, temps, joueurLocal: { id, position, lieu }, joueurs });
monde.intensiteLumieres(lieu, fx.facteurLumiere(lieu));  // obscurité de la phase 5 : le jeu applique le facteur
// rendu de la scène, puis l'arme, puis (option ecranSepare) le voile d'écran :
fx.rendreEcran(renderer);
fx.dispose();
```

Toutes les durées, rayons et portées viennent de la config (`phase4.rayon`, `phase2.pique.*`, `phase3.*`,
`phase5.obscurite.*`, `phase5.frappe.*`…) ou des `BossB7Logique.DEFAUTS` ; rien n'est recopié en dur.

### Options de `creer` (en plus du §9)

| Option | Défaut | Effet |
|---|---|---|
| `ecranSepare` | `false` | le voile d'écran (obscurité, capture des âmes, fondus, éclairs) n'est plus dans les scènes : le jeu l'affiche avec `fx.rendreEcran(renderer)` **après la vue de l'arme** (sinon l'arme passe devant le voile) |
| `obscurite` | `true` | `false` : le jeu gère lui-même l'obscurité de la phase 5 (plus de brouillard, de voile ni de lueur de vision) |
| `gouttesLames` | `true` | gouttes de sang des pointes de lames et éclaboussures (voir « Limites » : le modèle en dessine aussi) |
| `echelleLumieres` | `0.14` | échelle des PointLight de la réserve (unités physiques r155+ ou anciennes unités détectées) |
| `graine` | `1939` | graine du hasard (variations reproductibles) |
| `rayonCercleTeleport` | `2.0` | rayon du cercle rituel des téléportations dans le bunker (v1.1) |
| `rayonFaille` | `0.8` | rayon du sceau des failles des chiens (v1.2) : ≈ 1,6 m de diamètre |
| `socleCuve` | `0.46` | hauteur du socle des cuves (v1.3) : le verre va de `y + socleCuve` à `+ hauteur` (prototype : 0,46 m) |
| `fissuresCuve` | `true` | `false` : pas de fissures lumineuses de fx.js sur le verre (la cuve du jeu a les siennes) |
| `monde.sol(x, z, lieu)` | — | hauteur du sol du bunker si elle n'est pas 0 |
| `monde.tir(lieu, o, d, max)` | — | v1.5 : tir contre le décor (`{ distance, point, normale }`) ; oriente l'ondulation d'un mur traversé par l'intangible sur la vraie face et trouve la face de sortie (sinon : face à sa course, pas d'ondulation de sortie) |
| `facadeMurs` | apothème − épaisseur des dalles | v1.5 : distance (m) du centre de la salle à la face visible des murs (panneaux électrifiés) |
| `mareBras` | `true` | v1.5 : `false` si le jeu dessine déjà la mare de sang sous le bras (les veines et tendons restent) |
| `lueursIrradies` | `true` | v1.5 : `false` si le jeu dessine déjà la lueur au sol des zombies irradiés (retire aussi les comètes des zombies irradiés après la vague) |
| `rayonMiroitement` | `4` | v1.5 : au-delà (m du joueur local), l'intangible ne montre plus rien |

`ctx.joueurs` (facultatif, `[{ id, position, lieu }]`) : vrilles de capture des âmes vers chaque joueur, colonnes de
récompense des autres joueurs, joueurs accrochés et tirés par les crochets (v1.4). Sans lui, seul le joueur local est servi.
`ctx.modelesIllusions` (v1.4) n'est plus lu : les illusions sont retirées en v1.5.

### API

`version`, `qualite`, `effets` (noms pour `declencher`), `brancher(combat) → off`, `mettreAJour(dt, etat, ctx)`,
`declencher(nom, { position, lieu, … }) → booléen`, `facteurLumiere(lieu) → 0..1`, `rendreEcran(renderer)`,
`reinitialiser()`, `stats()` (éléments actifs), `dispose()` (restaure aussi les brouillards des scènes).

## Ce qui est couvert

**Évènements §4** : `action` (étapes : éclair de présentation, colère, descente/déflagration/rugissement du retour,
étourdissement, chute de la défaite, effondrement), `degats` (étincelles, braises, tête plus vive), `immunise` (onde du
bouclier ; appelle `modele.voile.impact` s'il existe), `projectile`, `projectileImpact` (explosion, anneau, brûlure),
`invocation` (sol qui craque, poussière, éclairs, lueur), `absorption`, `ameExtraite`, `ameAbsorbee` (pulsation),
`ailes` (déploiement, onde, dissipation), `pique` (verrouillage), `piqueImpact`, `teleport` (départ, arrivée ; rouge
sang au bunker), `zombiesCendres` (via `monde.positionZombie`), `bloc` (reconstruit), `blocImpact`, `ondeChoc`,
`rituel` (explosion de lumière), `capture` (contesté, capture), `joueurTouche` (voile rouge du joueur local),
`frappe` (arc sang-énergie ou étincelles au sol si ratée), `lames` (formation, désintégration), `defaite`,
`interaction` (terminée), `recompense` (colonne de lumière et étincelles sur le joueur), `etat` (remise à zéro).

**Actions et états suivis en continu** : apparition (sceau au sol, vortex, énergie qui converge, éclairs), incantation
et trait (mains, repère au sol de la cible), souffrance et colère (arcs), recharge, cambrure des ailes, téléportation
(implosion), retour de rage (traînée de descente), arrachement (fissures lumineuses, filets de poussière, aura
télékinétique, traînée du bloc, point d'impact, reconstruction), préparation de l'onde de choc, faiblesse (pouvoirs
instables), capture des âmes (vrilles vers les joueurs, voile qui s'assombrit), frappe (lueur rouge d'avertissement,
secteur au sol), défaite (pouvoirs qui fuient, fumée du cadavre). Projectiles (orbe, traînée), zones maudites
(marquée → active → fin, au bon rayon), âmes (forme spectrale, vol en courbe jusqu'à la poitrine), puissance (aura et
âmes en orbite), pique (couloir de visée : montée, visée, verrouillage, charge), vrilles d'absorption, cercle rituel
(anneaux, sceau, glyphes inventés qui s'allument, énergie qui circule ; libre / capture / contesté / recul avec la
progression ; faisceau vers le plafond à la fin), lames (brume, gouttes), obscurité (`etat.vision`), invite
d'interaction (`etat.interaction`).

**Effets à la main** (`fx.effets`) : `impactMagique`, `impactTrait`, `lancer`, `emergence`, `impactBalle`, `immunise`,
`colere`, `decharge`, `cendres`, `ameExtraite`, `ameAbsorbee`, `ailesDeploiement`, `ailesDissipation`, `piqueImpact`,
`teleportDepart`, `teleportArrivee`, `eclairApparition`, `deflagration`, `rugissement`, `poussierePlafond`,
`arrachement` (`{ id }` de dalle), `blocImpact`, `ondeChoc`, `rituelExplosion`, `frappe`, `liberation`, `recompense`,
`interactionFin`, `tacheSang`, `flash` (`{ couleur: 'rouge' | 'glace' | 'coup' | 'choc' | 'blanc', force }` ; `rouge`/`glace` :
entaille d'une frappe ; `coup` : voile rouge sans entaille ; `choc` : filaments électriques des murs), `explosion`, et
pour la v1.5 : `palierIntangible`, `rageSurcharge`, `rageInfection`, `mursCharge`, `mursDeflagration`, `mursExtinction`,
`mursChoc` (`{ position, joueur?, mur? }`), `infectionVague` (`{ position, ids }`), `brasArrache`, `brasLance`, `brasImpact`,
`brasFletri`, `petitSortie`, `petitEffondrement`, `evanouissement`, `traversee`, `resurgissement`.

## Obscurité de la phase 5

Pilotée par `etat.vision` et `config.phase5.obscurite` : brouillard exponentiel de la scène du joueur (on voit à
environ `rayonVision`, restauré ensuite), voile d'écran en vignette légèrement animée, lueur froide au-dessus du
joueur pour toujours lire le sol et les murs proches, et `facteurLumiere(lieu)` (≥ 0,75 pendant la traque) que le jeu
applique à ses lumières. Les lumières du monde ne sont jamais modifiées par le module.

## Technique

Particules : un `THREE.Points` par scène (ShaderMaterial, étirées selon la vitesse). Rubans réutilisés (traînées,
vrilles, éclairs, arcs, spirales), halos face caméra et décalques au sol en géométries instanciées, motifs dessinés
dans les shaders (anneaux, sceau à sept branches, glyphes de cercles, d'arcs et de points ; aucune lettre ni rune).
Volumes (colonnes, coques d'onde, implosion, vortex). Lueurs additives et `depthWrite:false`, poussière et fumée en
alpha prémultiplié dans la même passe. Couleurs sans conversion d'espace colorimétrique : rendu identique en r128 et
r186. Réserve de 1 à 3 PointLight par scène attribuées aux demandes les plus fortes, jamais masquées (pas de
recompilation des matériaux). Rien n'est créé après `creer` : objets en réserve d'une seule forme, flottants de travail
dans des tableaux typés.

Qualités : `haute` (2 600 particules par scène, 40 rubans, 3 lumières), `moyenne`, `basse` (900, 20, 1).

## Coût mesuré (`node mesure-fx.js r128|recent [qualite] [tas] [scenarios=…] [chauffe=n]`)

Chromium (CPU du conteneur), qualité haute, scénarios pilotés par la vraie logique, après chauffe du JIT,
résolution fine de `performance.now()` (page isolée COOP/COEP servie par le script). `fx.mettreAJour` + traitement
des évènements, en ms par image, r128 / r186 (v1.4.0) :

| Scénario | moyenne | p95 | p99 |
|---|---|---|---|
| introduction | 0,018 / 0,023 | 0,06 / 0,05 | 0,10 / 0,10 |
| phase 1 | 0,027 / 0,030 | 0,06 / 0,06 | 0,08 / 0,09 |
| phase 2 | 0,044 / 0,035 | 0,09 / 0,07 | 0,13 / 0,10 |
| transition 2-3 | 0,016 / 0,016 | 0,04 / 0,04 | 0,06 / 0,05 |
| phase 3 | 0,034 / 0,043 | 0,07 / 0,08 | 0,10 / 0,13 |
| rituel (phase 4) | 0,028 / 0,020 | 0,06 / 0,04 | 0,09 / 0,07 |
| phase 5 | 0,027 / 0,019 | 0,06 / 0,04 | 0,08 / 0,06 |
| défaite | 0,019 / 0,017 | 0,05 / 0,04 | 0,10 / 0,06 |
| meute (v1.2, salle) | 0,027 / 0,033 | 0,07 / 0,08 | 0,10 / 0,14 |
| meute (v1.2, bunker obscur) | 0,032 / 0,029 | 0,07 / 0,06 | 0,10 / 0,08 |
| cuves (v1.3) | 0,056 / 0,059 | 0,11 / 0,10 | 0,17 / 0,15 |
| **3e cuve (v1.4)** | 0,036 / 0,034 | 0,08 / 0,07 | 0,12 / 0,09 |
| **salves (v1.4)** | 0,043 / 0,048 | 0,08 / 0,09 | 0,13 / 0,13 |
| **paliers (v1.4)** : lames bleues, rouge, illusions tirées, crochets | 0,036 / 0,040 | 0,09 / 0,09 | 0,16 / 0,16 |
| *v1.5.0 :* | | | |
| **murs (v1.5)** : surcharge, murs électrifiés, chocs, extinction | 0,086 / 0,090 | 0,14 / 0,18 | 0,29 / 0,38 |
| **infection (v1.5)** : cri, vague, comètes, lueurs sous 8 puis 10 zombies | 0,060 / 0,058 | 0,12 / 0,12 | 0,17 / 0,16 |
| **bras (v1.5)** : arraché, lancé, posé, mare, veines, tendons, petits, flétri | 0,066 / 0,075 | 0,12 / 0,15 | 0,16 / 0,19 |
| **intangible (v1.5)** : évanouissement, traversées, resurgissement, frappe | 0,027 / 0,027 | 0,07 / 0,06 | 0,11 / 0,10 |
| **paliers (v1.5)** : palier 2 = intangibilité | 0,024 / 0,022 | 0,05 / 0,04 | 0,09 / 0,07 |

En qualité basse (r128) : murs 0,052, infection 0,043, bras 0,045, intangible 0,018 ms par image en moyenne (8 panneaux
au lieu de 16, 1 lumière, ≤ 210 particules).

Pics isolés jusqu'à ~3,3 ms (ramasse-miettes ou compilation du JIT). Au plus ~740 particules (salve : poussière des
4 blocs), 9 rubans, 23 halos, 82 décalques actifs (deux scènes). GPU : au plus 5 appels de dessin par scène (+ 1 par
volume actif, 7 au plus) et 3 PointLight. Aucune erreur console (r128, r186).

Allocations (`tas`) : aucun objet, tableau ni fermeture n'est créé par image ; le profil du tas ne montre que des
nombres mis en boîte par V8 (flottants rendus ou passés en argument par du code pas encore optimisé). v1.4 en supprime
les plus fréquents : hasard rendu en entier de 24 bits, demandes de lumière (`LC`) et arguments des émetteurs de
particules (`EA`, `EP`) par des tableaux typés, facteurs de lumière par lieu en `Float64Array`, uniformes du voile
écrits champ par champ, couleurs et ancres calculées en ligne. En régime établi sur une même phase (6 passes de
chauffe) : 0,12 Ko par image (paliers) et 0,13 Ko (salves), contre ≈ 0,3 Ko avant ces changements. Quand les scénarios
s'enchaînent vite, V8 désoptimise puis réoptimise les chemins rares à chaque reprise (siphon, protection, arrachement :
quelques secondes par occurrence, cartes des objets de l'instantané disparues entre deux reprises) : cycle complet des
14 scénarios (3 passes de chauffe, préparations comprises) 0,21 Ko par image ; pire cas mesuré, cycle court
paliers/salve/3e cuve en r186, 1,1 Ko par image, presque tout dans `majBlocs`, `contSiphon`, `majProtection`,
`contTelekinesie`. ~0,1 Mo en tout pour les évènements de tout le combat.

## Captures de contrôle (`node captures-fx.js r128|recent [planches|tout] [qualite] [paramètres]`)

Servir le dossier parent de `boss/` (`python3 -m http.server 8797`). Planches dans `captures/fx/` (préfixe `r186-`
pour Three.js récent) : `intro`, `phase1`, `tirs`, `souffrance`, `absorption`, `ailes`, `teleport`, `retour`,
`blocs`, `onde`, `cercle`, `rituelFin`, `capture`, `lames`, `obscurite`, `gouttes`, `defaite`, et pour la v1.2
`faille` (salle), `failleBunker` (bunker obscur), `meute`, pour la v1.3 `siphon`, `protection`, `protection2`, pour
la v1.4 `paliers`, `crochet`, `salve`, `cuve3` (la planche `illusions` est retirée), et pour la v1.5 `surcharge`,
`murs`, `infection`, `bras`, `intangible`. Variantes :
`obscurite-0-*` (phase 5 en pleine lumière, `obscurite=0`), `r186-basse-*` (qualité basse). Aperçu interactif :
`src/fx/apercu-fx.html?three=r128|recent&qualite=…&obscurite=0`.

## Limites connues

- Pas de vraie distorsion de l'image (pas de post-traitement) : la « distorsion » de l'introduction est un voile de
  stries et une vignette tourbillonnante.
- Le modèle (`boss-modele.js`) dessine lui aussi des gouttes de sang sous les lames : son option `gouttes` est déclarée
  mais pas lue. Choisir une seule source (`gouttes: false` honorée par le modèle, ou `gouttesLames: false` ici).
- Dans l'obscurité, les gouttes et les petites taches restent discrètes (voulu : brouillard et voile).
- `monde.lieuDe` du prototype prend un nombre (x) ; le §9 dit une position : l'aperçu l'adapte.

## Version 1.1 (API.md §13)

- **Cercle rituel de téléportation** : à chaque `teleport` du boss dans le bunker (départ et arrivée, toutes raisons), un
  sceau de 2 m de rayon (couleur `energie`) se trace en 0,35 s, tient 1,2 s puis s'efface en 1,2 s, avec une lueur pulsée
  et un anneau de braises. Effet nommé `cercleTeleport` (option `rayonCercleTeleport`).
- **Piliers** : `pilier` `touche` → éclats, poussière et étincelles au point d'impact, petite secousse (`pilierTouche`) ;
  `pilier` `detruit` → colonnes et anneau de poussière, gerbe d'éclats, onde, éclair, poussière du plafond, lumière,
  secousse forte (`pilierDetruit`).

## Version 1.2 (API.md §14) — meute de chiens zombies

- **`chien` `faille`** → `fxFaille` : sceau inventé couleur braise (rayon `rayonFaille`, 0,8 m) qui se trace, se fissure
  depuis le centre puis s'ouvre sur une fente brûlante, pendant `config.chiens.faille.duree` (lu dans la config) + 0,6 s ;
  colonne de fumée éclairée par en dessous (en partie additive), braises, petits arcs sur les fissures, lueur verticale
  au-dessus de la faille et lumière qui monte avec l'ouverture (lisibles de loin et dans le noir de la phase 5).
  Motifs : anneau brisé en cinq arcs avec un point dans chaque brèche, couronne de onze points, anneau ondulé, deux arcs
  qui tournent en sens contraire, fissures ; ni lettre, ni rune, ni symbole réel.
- **`chien` `apparition`** → éclats de terre projetés, poussière, braises, étincelles, éclat lumineux, deux arcs brefs,
  petite onde au sol, éclair de lumière (0,35 s). Le sceau s'illumine puis s'éteint en 0,6 s.
- **`chien` `mort`** → petite bouffée de cendres, de braises et de fumée, lueur brève. **`fin`** raison `defaite` → la même,
  plus forte ; `transfert`, `bloque`, `echec`, `debogage` : rien (retrait silencieux).
- **`meute` `dechainee`** → onde rouge au sol autour du boss (et une seconde plus courte), anneau rouge face caméra,
  couronne de braises, brume rouge, éclair de lumière rouge, légère secousse. **`dissipee`** → souffle discret de cendres.
- Champ `lieu` des évènements respecté (salle ou bunker) ; hauteur du sol prise sur `position.y`.
- Effets nommés (`fx.declencher`) : `chienFaille` (`{ position, lieu, duree? }`), `chienApparition`, `chienMort`
  (`{ fort }`), `meuteDechainee`, `meuteDissipee`.
- Réserves : un décalque de faille et une lueur au sol, une tâche minutée et un halo par faille ; aucun objet créé par
  image (profil du tas : `node mesure-fx.js r128 haute tas`, scénarios `meute` et `meuteBunker` ; coût CPU moyen
  0,03–0,05 ms par image, du même ordre que les autres phases).
- Aperçu : boutons « seconde moitié (meute) » (PV de la phase 1 sous le seuil) et « tuer un chien » ; aides `FXA.failles`,
  `attendreFaille`, `attendreJaillissement`, `secondeMoitie`, `camAutour`, `joueurVers`, `tuerChien`.
- Planches : `captures/fx/faille.png`, `failleBunker.png`, `meute.png` (et `r186-*`, `r186-basse-failleBunker.png`).
- Limites : à plus de 10 m dans le noir, seule la lueur verticale et le reflet de la lumière signalent la faille (le sceau
  n'est plus qu'un trait) ; une faille ouverte contre un décor du prototype (brasero, cage) peut être en partie cachée.

## Version 1.3 (API.md §15) — cuves et mini-boss de la phase 2

- **Siphon** (action `siphon`, `donnees.tube`) : `approche` → lueur et bulles en haut de la cuve ; `aspiration` → flot
  d'énergie verte qui jaillit du haut de la cuve (côté boss) et file en arc jusqu'aux **deux mains** (deux brins par main
  qui suivent les ancres `mainG` / `mainD`, perles de liquide qui filent le long du flot), le liquide bouillonne et
  gicle à la surface, lueurs aux mains et lumière verte ; `eclatement` → le flot retombe en 0,35 s.
- **`tube` `siphon`** → couronne de gouttes et éclat en haut de la cuve. **`fissure`** → fissures lumineuses qui courent sur
  le verre depuis le point de rupture tourné vers le boss (rayons, deux anneaux, réseau fin : volume cylindrique
  `V_FISSURES` posé sur le verre), éclat, éclats de verre, étincelles. **`eclate`** → gerbe de verre (éclats qui rebondissent),
  éclaboussure de liquide vert, brume verte, grand éclat, trois arcs, onde verte au sol, lueur verte résiduelle, lumière,
  secousse.
- **`miniBoss` `libere`** → vapeur autour du mini-boss qui sort (gerbe, anneau, puis vapeur qui le suit ≈ 1,8 s), éclat et
  onde à sa couleur. **`mort`** → petite gerbe et vapeur à sa couleur (son corps, ses arcs, son aura et sa flaque sont
  dessinés par le jeu).
- **Protection** (instantané `etat().boss.protege`, `etat().miniBoss`) : **lien pulsé** du boss (poitrine) à chaque
  mini-boss vivant, à sa couleur (`config.miniBoss.<type>.couleur` : cyan pour Le Survolté, vert pour L'Irradié) : brin large
  qui pulse, brin fin, perles qui filent vers le boss, lueurs aux deux bouts ; **voile de bouclier** (volume sphérique
  `V_BOUCLIER` : bord lumineux, bandes qui défilent) sur le boss tant qu'il est protégé, teinté par le mini-boss (ou par la
  cuve en cours de siphon). `protection` `actif: true` → anneau à la couleur du mini-boss ; `actif: false` → le voile se
  brise (anneaux, éclat, étincelles, légère secousse) et s'éteint.
- Effets nommés : `cuveSiphon`, `cuveFissure`, `cuveEclatement` (`{ id }`), `miniBossLibere`, `miniBossMort`
  (`{ position, type }`), `protectionDebut`, `protectionFin` (`{ type }`). Options `socleCuve`, `fissuresCuve`.
- Réserves : 4 rubans et 3 halos pour le siphon, 2 rubans et 2 halos par lien, un cylindre pour les fissures, une sphère
  pour le voile ; aucun objet créé par image (profil du tas, scénario `cuves` de `mesure-fx.js` : 0,07 ms par image en moyenne).
- Aperçu : boutons « seuil mini-boss (siphon) » (PV de la phase 2 sous le prochain seuil) et « tuer le mini-boss » ; aides
  `FXA.seuilMiniBoss`, `tuerMiniBoss`, `miniBoss`, `tubes`, `cuve` ; la boucle applique `monde.appliquerTubes`.
- Planches : `captures/fx/siphon.png` (flot, bouillonnement, fissures, éclatement, libération), `protection.png` (lien,
  voile, immunité, rupture), `protection2.png` (second seuil, L'Irradié), et `r186-*`, `r186-basse-siphon.png`.
- Limites : les fissures du prototype (texture de la cuve) et celles de fx.js se superposent ; dans un jeu dont la cuve a
  ses propres fissures, `fissuresCuve: false` ne garde que l'éclat et les éclats de verre de `fissure`.
  Le voile est une ellipsoïde fixe (≈ 2,1 × 2,8 m) : les ailes de la phase 2 en dépassent.

## Version 1.4 (API.md §16, surtout §16.3, §16.5, §16.7, §16.11)

- **Paliers de la phase 5** (instantané `boss.couleurLames`, évènement `palier`) :
  - palier 0, **lames bleues** : gouttes et éclaboussures en **liquide glacé lumineux** (gouttes bleu très clair, taches au
    sol claires et un peu lumineuses dans le noir, brume froide), sans aucun sang rouge ; la préparation du coup luit en bleu
    glacé, l'arc de la frappe, la gerbe et l'éclat sont glacés, et l'entaille d'écran du joueur touché devient bleu glacé.
    Les lueurs et lumières bleues sont à mi-intensité (le bleu clair paraît bien plus lumineux que le rouge). Le modèle
    teint lui-même ses lames (`vue.couleurLames`, modèle 2.2).
  - `palier` 1, **passage au rouge** : éclats sur les deux lames, braises et étincelles aux pointes, onde rouge au sol,
    anneau, puis les lames **s'embrasent** 1,3 s (flammes le long de chaque lame, lueur vacillante sur chacune, lumière
    rouge), petite secousse. Gouttes et taches redeviennent du sang.
  - `palier` 2 : *(v1.5 : remplacé par les ombres de l'intangibilité, voir plus bas ; les reflets verts sont retirés)*.
  - `palier` 3, **chaînes** : trois chaînes en spirale apparaissent ~1,5 s autour du Septième (maillons, lueur rouge
    sombre), éclat et étincelles.
- *(Retirées en v1.5 avec les illusions de la logique.)* **Illusions** (instantané `illusions`, évènements `illusion`) : `apparition` (et `retour`) → fumée sombre aux reflets
  verts qui se **condense** sur l'illusion pendant `phase5.paliers.illusions.apparition` s, points verts qui convergent,
  lueur, anneau au sol, lumière verte ; en traque et pendant ses gestes, **légère lueur verte autour de ses lames**
  (plus vive pendant la frappe) ; `dissipation` (balle) → **bouffée de fumée verte**, étincelles vertes, éclat, puis fumée
  verte pendant `dissipation` s ; `fin` → petite bouffée.
- **Crochets** (action `crochet`, instantané `crochets`, évènements `crochet`) : `preparation` → la chaîne s'enroule
  autour de la main droite (`ctx.modele.points.mainD`) et luit de plus en plus ; en vol → **chaîne de la main à la pointe**
  (maillons alternés face/profil, métal sombre et lueur rouge sombre, enveloppe lumineuse pour la lire dans le noir),
  **crochet** en J à la pointe, étincelles ; `accroche` → étincelles et sang au torse du joueur (pour le joueur local : voile
  rouge sans entaille et secousse, pas d'éclat devant sa propre caméra) ; `traction` → la chaîne raccourcit jusqu'au
  joueur tiré (position dans `ctx.joueurLocal` / `ctx.joueurs`), traînée ; `arrivee` → poussière ; `rate` → la chaîne
  **retombe et se rétracte** vers la main en 0,6 s (`mur` : gerbe d'étincelles, poussière, éclats au point d'arrêt ;
  `esquive` : quelques étincelles). Réserves : 4 suivis (3 rubans, 1 halo, 1 traînée chacun ; l'enveloppe est omise en
  qualité basse), aucun objet créé par image.
- **Salves de la phase 3** : rien ne suppose un seul bloc : télékinésie avec une vrille par bloc de `donnees.blocs`
  (mains alternées, plus fines en salve), 10 blocs suivis à la fois ; chaque dalle désignée a sa lueur (plus grande en
  salve) et, en salve, une lueur au pied de son mur ; fractures, lévitations, traînées et impacts propres à chaque bloc.
- **3e cuve** : siphon, fissures, éclatement et libération valent pour toute cuve de `arene.salle.tubes` (tube2 vérifiée,
  lien et vapeur à la couleur du Démembré, `#E3B65C`).
- **Écran** : nouveau voile rouge **sans entaille** (`joueurTouche` autres que la frappe, crochet) ; l'entaille de la
  frappe reste réservée aux coups de lames (bleu glacé au palier 0).
- Effets nommés : `palierRouge`, `palierIllusions`, `palierCrochets`, `illusionApparition`, `illusionDissipation`
  (`{ position, lieu }`), `crochetAccroche` (`{ position, joueur }`), `crochetRate` (`{ position, raison }`).
  Aucune nouvelle option de `creer`.
- **Ce que le jeu fournit** : `ctx.joueurLocal` et `ctx.joueurs` (`[{ id, position, lieu }]`, positions des joueurs
  accrochés et tirés) ; `ctx.modele` (main droite `points.mainD` pour la chaîne) ; facultatif `ctx.modelesIllusions`
  (objet `{ id d'illusion → instance du modèle }` ou fonction `id → instance`, chaque instance avec `points.lameG`,
  `lameD`, `pointeLameG`, `pointeLameD`). Le jeu dessine lui-même les illusions (instances « basse » du modèle,
  `vue.couleurLames = 'vert'`) ; l'aperçu les montre à partir de 55 % de l'apparition et jusqu'à 30 % de la dissipation,
  le temps que la fumée les cache.
- Aperçu : une instance « basse » du modèle par illusion (le prototype ne les dessine pas ; montrée une fois la fumée
  condensée), boutons « salves (phase 3 < 50 %) », « palier 1/2/3 », « tirer sur une illusion » ; aides `FXA.salve`,
  `palier(n)`, `illusions`, `crochets`, `tirerIllusion`, `loin`, `attendreLoin`, `ramasserBonus`, `camDegagee`,
  `camCote`, `vj`, `sousVignette` ; `?fx=` charge un autre fichier d'effets (comparaisons).
- Planches : `captures/fx/paliers.png`, `illusions.png`, `crochet.png`, `salve.png`, `cuve3.png` (et `r186-*`,
  `r186-basse-*`) ; `lames`, `gouttes`, `obscurite` montrent désormais les lames bleues du palier 0.
  Le raté sur un mur est obtenu dans la planche en testant le vol contre le décor (`monde.tir`) : la ligne de vue de la
  logique (grille du prototype) ne laisse jamais un mur couper une trajectoire visible au lancer.
- Coût (`mesure-fx.js`, scénarios `paliers`, `salve`, `cuve3`) : 0,034–0,048 ms par image en moyenne, p99 ≤ 0,16 ms
  (tableau « Coût mesuré » plus haut) ; aucune erreur console en r128 et r186 ; allocations : voir « Coût mesuré ».
- Limites : dans l'aperçu, le modèle est encore la 2.1 (pas de `couleurLames`) : ses lames, ses traînées et ses propres
  gouttes restent rouges, y compris sur les illusions (la lueur verte de fx.js s'y ajoute) ; la « fumée sombre » de
  l'apparition est volontairement teintée de vert et un peu lumineuse, sinon elle disparaît dans le noir de la phase 5.

## Version 1.5 (API.md §17, surtout §17.1, §17.3, §17.4)

Anti-doublon : chaque effet ponctuel passe par une **transition gardée** (« état vu » : rage vue par identifiant, état
des murs, infection, état du bras, intangibilité, petits vus par identifiant) appelée aussi bien par l'évènement que par
l'instantané ; le premier des deux déclenche, l'autre ne fait rien. Vérifié : mêmes éléments créés avec les évènements
branchés ou débranchés (début de rage, électrification, bras posé, disparition). Les effets continus suivent
l'instantané.

- **Surcharge du Survolté** (`miniBoss[i].rage` `surcharge` non `actif`, `duree` s ; évènement `miniBoss` `rage`) : au
  début, éclat bleu et anneau sur le Survolté, éclat sur le torse du Septième et premier arc ; puis **rayon d'énergie**
  du torse du Septième (`ctx.modele.points.poitrine`, sinon position + 1,3 m) à la poitrine du Survolté : faisceau qui
  jaillit en 0,22 s, cœur blanc-bleu, ondulations qui filent vers lui (ruban `RT_RAYON`), **deux arcs** qui serpentent
  autour (un en basse), **pulsations** (4 orbes, 2 en basse) et étincelles arrachées au torse qui filent vers le
  Survolté ; **le Survolté s'illumine** (lueur et cœur qui grossissent avec la charge, lueur au sol, crépitements,
  étincelles, lumière), le torse du Septième luit et crépite. Le lien de protection (v1.3) s'efface pendant la surcharge.
  Effet visuel seulement.
- **Murs électrifiés** (instantané `murs`, évènement `murs`, `mursChoc`) : 8 **panneaux** posés sur la façade des murs
  (`arene.salle.murs`, devant les dalles : `facadeMurs`) : arcs qui courent (5 traînées brisées qui scintillent et
  défilent), **dalles bleues** (plasma, cadre lumineux ; une dalle arrachée en phase 3 ne luit pas), haut du mur ;
  **bordure du plafond** (8 bandes : courant qui file, arc ; pas en basse) ; **éclairs au hasard** (le long d'un mur, de la
  bordure vers une dalle, d'un mur à l'autre par l'angle) avec étincelles et lumière brève ; étincelles qui tombent de la
  bordure et du haut des dalles ; lumière froide sur la salle. **Liseré au sol** (décalque octogonal sur toute la salle)
  à `murs.distance` m du plan des murs (apothème − distance) : bande lumineuse de 20 cm qui pulse, halo, lueur douce côté
  murs ; le sol n'est pas électrifié. `charge` : murs qui se chargent, liseré qui clignote ; `electrifies` :
  **déflagration** (éclat de tous les murs, 14 éclairs, pluie d'étincelles, le Survolté se décharge dans les murs voisins,
  lumière de toute la salle, léger éclair blanc, lumières du monde qui vacillent, secousse) et le liseré s'allume depuis
  le côté du Survolté ; `extinction` : dernier sursaut puis les murs grésillent et s'éteignent en `extinction` s ;
  `eteints` : plus rien. `mursChoc` : deux ou trois arcs du mur (en face du joueur) au joueur touché, éclat, étincelles ;
  pour le joueur local, **choc d'écran** (filaments bleus qui partent des bords, renouvelés 11 fois par seconde, ≈ 0,4 s)
  et secousse.
- **Infection** (instantané `infection`, évènement `infection`) : pendant le cri, L'Irradié se gorge de lueur verte
  (anneaux au sol, points verts qui convergent) ; au passage à `active` (une fois) : **onde verte** au sol jusqu'au zombie le
  plus lointain, anneau, éclat, brume, étincelles en couronne, et **une comète verte vers chaque zombie** de
  `infection.ids` (positions par `monde.positionZombie`, la comète suit le zombie), éclat vert à l'arrivée ; ensuite
  **lueur verte au sol sous chaque entité irradiée** (24 suivies en haute, 16, 10), bulles vertes ; une entité irradiée
  après la vague reçoit sa propre comète. Le zombie lui-même brille côté jeu (prototype : `halosIrradies: false`).
- **Bras du Démembré** (évènements `bras`, `petitDemembre`, instantané `bras`, `petits`) : `arrache` → gerbe de sang à
  l'épaule (`brasDepart`), brume, éclat ; `lance` → jet de sang dans le sens du lancer ; en vol → **traînée de sang**
  sombre, gouttes ; `pose` → **impact** au centre (onde rouge, onde de poussière, fissures, éclaboussures, terre, éclats,
  sang, poussière du plafond, lumière, secousse) puis **mare de sang** qui s'étale (reflets, ride à chaque battement),
  **veines** au sol qui s'étendent et **tendons** (3D, du moignon au sol) qui palpitent sur un double battement (≈ 66 bpm),
  lumière rouge au rythme ; `fletri` → petite gerbe sombre, le sang **noircit**, le pouls s'éteint, les tendons se
  fanent ; disparition en 1,4 s quand l'instantané l'oublie. `petitDemembre` `apparition` → **gerbe de sang et de terre**
  là où il sort (mottes, éclats, fissures, tache, petite onde) ; `effondrement` → **petite gerbe sombre** (sang noir,
  fumée, cendres). Le bras lui-même est dessiné par le jeu (`mareBras: false` si le jeu a déjà sa mare).
- **Intangibilité** (palier 2 ; instantané `boss.intangible`, actions `evanouissement` / `resurgissement`, évènement
  `intangible`) : `palier` 2 → les ombres l'avalent (fumée noire qui s'enroule, ectoplasme, braises, anneau rouge sombre,
  lumières qui vacillent) ; **évanouissement** → fumée sombre qui s'enroule et s'effondre sur lui, braises, ectoplasme,
  lueur rouge sombre qui retombe ; disparition (`debut`) → la fumée s'effondre sur elle-même, braises, onde ; invisible
  → **à peine un miroitement** (anneaux de chaleur à peine visibles, quelques volutes) à ≤ 4 m du joueur local
  (`rayonMiroitement`), **rien au-delà** ; `traversee` → **ondulation sur le mur** : la pierre ondoie (trois fronts
  concentriques clairs et sombres), tache d'ectoplasme sombre qui coule, poussière, filets, éclats, ectoplasme, lumière
  violette brève ; posée sur la vraie face par `monde.tir` le long de sa course (étirée selon l'incidence), sinon entre
  sa position précédente et celle-ci, face à sa course ; avec `monde.tir`, seconde ondulation **à la sortie** du mur (au
  bout de épaisseur / vitesse) ; `fin` / resurgissement → **déflagration de fumée rouge sombre** (gerbe et couronne de
  fumée, braises, onde, éclat, anneau, lumière, secousse), puis la fumée se disperse pendant l'apparition.
- **Illusions retirées** : plus d'effets d'illusion, plus de reflets verts au palier 2, `ctx.modelesIllusions` ignoré.
- **Nouveaux éléments** : réserve de **panneaux** (décalques verticaux instanciés, 24 / 20 / 12 par scène), décalques au sol
  liseré, mare et veines, halo « miroitement », ruban « rayon », voile d'écran « choc ». Couleurs `elec`, `elecVif`,
  `surcharge`, `infection`, `rougeSombre`, `ecto`. Aucun texte, aucun symbole.
- Effets nommés : voir « Effets à la main ». Options : `facadeMurs`, `mareBras`, `lueursIrradies`, `rayonMiroitement`,
  `monde.tir`.
- **Ce que le jeu fournit** : `monde.positionZombie(id)` (infection, petits sans évènement) ; `ctx.joueurLocal`
  (`position`, `lieu` : choc, miroitement) et `ctx.joueurs` (chocs des autres joueurs) ; `ctx.modele` (torse du Septième) ;
  facultatif `monde.tir(lieu, origine, direction, max) → { distance, point, normale }` (faces des murs traversés). Le jeu
  dessine le bras (maillage), l'éclat du Survolté en surcharge et la lueur des zombies irradiés.
- Aperçu : zombies du prototype créés avec `halosIrradies: false`, `monde.tir` transmis ; boutons « rage du Survolté
  (murs) », « rage de L'Irradié (infection) » (6 zombies autour), « rage du Démembré (bras) », « palier 2
  (intangibilité) » ; aides `FXA.liberer(type)`, `rage(type, frac)`, `miniBossType`, `murs`, `infection`, `bras`, `petits`,
  `cache(n)` (le joueur attend dans la salle : personne près du Septième sans qu'il devienne intangible).
- Planches : `captures/fx/surcharge.png`, `murs.png`, `infection.png`, `bras.png`, `intangible.png` (et `r186-*`,
  `r186-basse-murs.png`, `r186-basse-surcharge.png`, `r186-basse-bras.png`, `obscurite-0-intangible.png`) ; `paliers.png`
  et `crochet.png` mises à jour (palier 2 = ombres ; attentes hors du bunker).
- Coût (`mesure-fx.js`, scénarios `murs`, `infection`, `bras`, `intangible`) : 0,03–0,09 ms par image en moyenne (r128 et
  r186), p99 ≤ 0,4 ms (tableau « Coût mesuré ») ; au plus ~610 particules, 27 rubans, 24 halos, 51 décalques et 16
  panneaux ; +1 appel de dessin par scène (panneaux). Aucune erreur console. Allocations, scénarios v1.5 seuls
  (`tas horsprep chauffe=6`, préparations exclues) : les chemins v1.5 (murs, infection, bras, intangibilité, surcharge)
  ne mettent plus en boîte que quelques octets par image en régime établi ; total ≈ 0,59 Ko par image (r128 et r186),
  presque tout dans `majProtection` (lien de protection v1.3, actif toute la vie d'un mini-boss) que Chromium sans tête
  garde au niveau Maglev de V8 (flottants mis en boîte) : avec `jsflags=--invocation-count-for-turbofan=500` il tombe à
  ≈ 0,1 Ko par image. Avant d'être compilés par TurboFan (premières dizaines de secondes), les chemins v1.5 mettent eux
  aussi des flottants en boîte (≈ 1–2 Ko par image pendant `murs` au premier passage).
- Limites : l'ondulation est un décalque (la pierre ne se déforme pas vraiment) ; sans `monde.tir`, elle est posée entre
  deux pas du boss (au plus ~11 cm devant la face) et il n'y a pas d'ondulation de sortie ; dans le prototype, la grille de
  navigation (lignes de vue de la logique) bloque des zones que `monde.tir` ne touche pas (aucun maillage) : l'ondulation y
  flotte au bord de la zone. Le liseré suppose un octogone régulier (murs à 0°, 45°…) ; les panneaux suivent
  `arene.salle.murs`. Le prototype dessine aussi une mare sous le bras (plus petite) : les deux se superposent. Dans le
  noir de la phase 5, la fumée sombre se lit surtout par ses braises et sa lueur rouge.
