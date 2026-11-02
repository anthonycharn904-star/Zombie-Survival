# Mini-moteur du prototype — boss de Bunker 7 (sous-tâche E)

Prototype autonome (navigateur, Three.js r128 **ou** récent, sans serveur ni build) qui fournit le **monde**, le
**joueur FPS**, l'**arme hitscan**, les **zombies**, des **coéquipiers simulés** et l'**adaptateur `jeu`** du
contrat `API.md` §3. Il ne dépend d'aucun autre fichier de branche : seulement `src/arene.js` (`BOSS_B7_ARENE`)
et, optionnellement, `src/config.js`. Rien ici n'est intégré au jeu principal.

## Lancer

- `proto-test.html` : ouvrir dans un navigateur (fichier local). Clic → souris verrouillée.
  ZQSD ou WASD (touches physiques), Maj = sprint, Espace = saut, clic gauche = tir, clic droit = visée,
  R = recharger, F ou E = prendre une récompense sur l'autel. Panneau de droite : lieu, zombies (chaque effet),
  dalles (faux états), joueur (dégâts 25 %, critique 1 %, invulnérable, commandes verrouillées), coop
  (bots, danger, cercle), récompenses (armes PaP 3, atouts, bonus, inventaire plein → autel), A*, drapeau.
- `?three=recent` : charge Three.js récent (r186) au lieu de r128. `?auto=1` : pas de boucle (tests pilotés).
- `window.PROTO` expose `THREE, renderer, camera, monde, joueur, arme, zombies, bots, jeu, cible, actions,
  opt, pas(n, dt), rendre(), temps(), demoDalle(id)`.

Tests (Playwright, chemins de la machine de travail) : `node dev/test-proto.js [recent]` (12 vérifications +
captures), `node dev/shot-monde.js [recent]` (vues du monde), `node dev/zombie-gros-plan.js`,
`node dev/glyphes.js` (planche des glyphes), `node dev/allocations.js` (allocations par image).

## Fichiers (ordre de chargement)

| fichier | global | rôle |
|---|---|---|
| `proto-commun.js` | `ProtoB7Commun` | aléatoire à graine, bruit, compat r128↔récent (`compat(THREE)`), textures procédurales, 16 glyphes **inventés** |
| `proto-nav.js` | `ProtoB7Nav` | grille 0,5 m, A* 8 voisins sans couper les coins + lissage, champs de flux (Dijkstra), ligne de vue |
| `proto-monde.js` | `ProtoB7Monde` | salle secrète (octogone d'après `arene.js`) + maquette de Bunker 7 (x + 200 m), collisions, dalles §8 |
| `proto-joueur.js` | `ProtoB7Joueur` | joueur FPS |
| `proto-arme.js` | `ProtoB7Arme` | arme hitscan + modèle 1re personne + effets |
| `proto-zombies.js` | `ProtoB7Zombies` | zombies skinnés procéduraux, animations, effets, IA, réserve |
| `proto-bots.js` | `ProtoB7Bots` | coéquipiers simulés (coop) |
| `proto-adaptateur.js` | `ProtoB7Adaptateur` | adaptateur `jeu` (API §3) + systèmes simulés visibles |

## API effective (résumé)

**Monde** — `ProtoB7Monde.creer(THREE, { arene, renderer, qualite, ombres })` →
`scenes.salle|bunker`, `mettreAJour(dt, t)`, `appliquerBlocs(blocs, t)` / `dalle(id)` (§8 : `fissure`,
`arrache`, `levitation`, `vol`, `impact`, `absent`, `reconstruction`), `resoudre(lieu, pos, r)`,
`positionValide(p, lieu)`, `visible(a, b, lieu)`, `chemin(a, b, lieu)`, `tir(lieu, o, d, max)` →
`{distance, point, normale, surface}`, `grilles[lieu]`, `points.salle{arrivee, retour, breches, centre}`,
`points.bunker{arrivee×4, boss×8, retour×4, zombies×10}`, `ouvrirBreche(i)`, `autel.deposer/retirer/liste`,
`intensiteLumieres(lieu, k)`, `lieuDe(x)`, `OX_BUNKER = 200`.

**Joueur** — `ProtoB7Joueur.creer(THREE, { monde, camera, element, id, lieu, position, lacet, pvMax })` →
`mettreAJour`, `infligerDegats(fraction, {source, ignorerReductions, direction})`, `blessureCritique(f)`,
`soigner`, `reapparaitre`, `definirControle`, `definirInvulnerable`, `teleporter(p, lacet, lieu)`,
`regarder(point, duree)`, `donnerAtout`, `vue()`, `directionRegard(out)`, `positionYeux(out)`, `secousse`,
`recul`, `entree`, `on('degats'|'mort'|'teleport'|'reapparition'|'reanime')`.
Régénération façon CoD : 3,5 s sans dégât puis 50 % des PV max par seconde.

**Arme** — `ProtoB7Arme.creer(THREE, { joueur, monde, camera })` → `ajouterFournisseur({nom, lieu(),
intersecter(o, d, max), toucher(hit, degats, info)})`, `ProtoB7Arme.fournisseurSpheres(nom, getSpheres,
onTouche, getLieu)` (hitboxes du boss : `{zone, centre, rayon}`), `tirer`, `recharger`, `definirPap(n)`,
`rendreVue(renderer)` (après le rendu du monde), `on('tir'|'touche'|'impact'|'rechargement'|'recharge')`.

**Zombies** — `ProtoB7Zombies.creer(THREE, { monde, max, surAttaque, surMort, pv, degatsAttaque })` →
`apparaitre({position, lieu, effet: 'normal'|'emergence'|'breche', vitesse, lacet})`, `effet(id,
'saisie'|'extraction'|'relache')`, `retirer(id, {effet: 'cendres'|'absorbe'|'silencieux'})`, `toucher`,
`intersecter`, `plusProche`, `fournisseur(getLieu)`, `liste`, `nombre(lieu)`, `vivant`, `tuerTous`,
`bloques(seuil)`, `mettreAJour(dt, t, joueurs)`.

**Bots** — `ProtoB7Bots.creer(THREE, { monde, zombies, surTir })` → `ajouter`, `retirer`, `liste`,
`mettreAJour(dt, t, { cible, dangers, cercle, distanceCible, tirer, precision, reaction })`.

**Adaptateur `jeu`** — `ProtoB7Adaptateur.creer({ monde, joueur, arme, bots, zombies, arene, ui })` : toutes les
fonctions du §3 (`joueurs`, `infligerDegats`, `blessureCritique`, `teleporter`, `controle`, `invulnerable`,
`faireApparaitreZombie`, `zombies`, `effetZombie`, `retirerZombie`, `regarder`, `chemin`, `positionValide`,
`visible`, `apparitionsNormales`, `suspendreManches`, `listeAtouts`, `donnerArme` (3 armes max → `false`),
`donnerAtout` (une fois), `activerBonus`, `deposerRecompense`, `lireDrapeau`, `ecrireDrapeau`, `pointsBunker`,
`journal`) + `ramasserAutel(id)`, `ajouterPoints`, `mortInstantanee()`, `mettreAJour(dt, t)`, `etat`
(points, inventaires, atouts, bonus, drapeaux, journal), affichés dans le panneau « Jeu ».

Brancher la logique : `combat = BossB7Logique.creerCombat({ config, arene, jeu })`, puis à chaque image
`monde.appliquerBlocs(combat.etat().blocs, t)` et un fournisseur de hitboxes du modèle pour l'arme et les bots.

## Conventions

- Lacet : 0 = regarde +Z (comme `arene.js`) ; caméra : `lacet + π`. Lieu `'salle'` / `'bunker'` ;
  la maquette est décalée de +200 m en X (`lieuDe(x)`).
- Les dalles sont des maillages séparés posés devant le mur porteur : leur absence laisse un renfoncement de
  0,6 m, jamais une ouverture ; les collisions des joueurs ne changent pas.
- Glyphes : 16 formes inventées (cercles, arcs, points, spirales) ; aucun symbole nazi, runique ou ésotérique
  réel. Planche : `captures/glyphes-atlas.png`, anneau du sol : `captures/glyphes-anneau.png`.

## Vérifié (r128 et r186)

12/12 vérifications de `dev/test-proto.js` sur les deux versions, sans erreur console. Captures regardées :
salle, dalles (6 états), maquette, zombies (chaque effet), gros plans, joueur et arme, bots, 24 zombies.
Perf (SwiftShader, CPU) : 24 zombies IA + animation ≈ 0,3 ms/image ; tir décor ≈ 0,14 ms (mandataires
de lancer de rayon par cellules de 4 m). Les boucles par image du joueur, de l'arme et des zombies ne créent
pas d'objets (tampons réutilisés) ; les bots n'allouent qu'en recalculant un chemin A*, le panneau de debug
est rafraîchi à 4 Hz.

## Limites connues

- Le modèle de zombie reste procédural (pas de texture peinte) ; de près il paraît simple.
- Ombres portées désactivées par défaut (coût logiciel) ; `ombres: true` les active.
- (v1.4) La cage du décor est passée à 327° pour ne plus chevaucher l'autel : vue de (0, 7) avec le champ du jeu (75°),
  elle sort du cadre à droite (sur la photo d'Anthony, cage et autel sont tous deux à droite). Autre place possible : entre la
  3e cuve et l'autel (x ≈ −2,45), avec des passages de 0,75 m de chaque côté.
- Les bots suivent des règles simples (pas d'apprentissage) ; le réseau (coop réel) n'est pas simulé.
- Les allocations internes de Three.js au rendu (caches d'uniformes) ne sont pas maîtrisées ici.

## Version 1.1 (API.md §13)

- **Zombies** (`proto-zombies.js`) : `vitesse: 'sprint'` → 5,8 à 6,2 m/s (le joueur : 4,6 en marche, 6,6 au sprint), foulée
  de sprint, poursuite immédiate (`agressif: true`), freinage juste avant le contact, séparation entre zombies.
- **Piliers** (`proto-monde.js`) : `monde.appliquerPiliers(etat.piliers, temps)` chaque image (fissures selon `coups`,
  effondrement animé, tas de gravats), `monde.impactPilier(id, point, coups)` (marque au point d'impact réel),
  `monde.pilier(id)` (Object3D), `monde.etatPiliers()` (débogage). La collision du pilier détruit devient un moignon bas
  et la grille de navigation de la salle est recalculée (`proto-nav.js`, version de grille).
- **Bonus au sol** (`proto-adaptateur.js` + `monde.creerBonus`) : `jeu.faireApparaitreBonus({ type, position, lieu, duree })`
  → caisse de munitions inventée, flottante et lumineuse, qui clignote les 5 dernières secondes ; ramassée à 1,5 m par le
  joueur ou un coéquipier → `arme.remplirMunitions()` pour tous, option `surBonus(type, joueurId)`.
- **Arme** (`proto-arme.js`) : réserve finie (`reserveMax: 1200`, 40 chargeurs), affichée « chargeur / réserve ».
- Tests : `node dev/test-v11.js`, `node dev/test-piliers.js` (mini-moteur seul) ; le prototype assemblé est vérifié par
  `dev/test-v11-assemblage.js` (`tests/navigateur/` dans le paquet).

## Version 1.2 (API.md §14.4) — chiens zombies

- **Même module, même API** (`proto-zombies.js`, aucun nouveau fichier) :
  `zombies.apparaitre({ position, lieu, type: 'chien', effet: 'faille' | 'normal', profil: { pv, vitesse, degats, cadence, portee },
  vitesse, agressif, source, lacet })` → id (`'c…'`). `liste()` (chaque vue porte `type: 'zombie' | 'chien'`),
  `nombre(lieu, type)`, `plusProche(x, z, lieu, max, type)`, `tuerTous(effet, type)`, `toucher`, `intersecter` (zones
  `tete` ×2 / `corps`), `retirer(id, { effet: 'cendres' | 'absorbe' | 'silencieux' })`, `obtenir`, `effet` (un chien refuse
  `saisie` / `extraction`), `reserveChiens`, `PROFIL_CHIEN`. Rappels : `surAttaque(chien, joueurId)` à chaque morsure
  (`chien.degats` = `profil.degats`), `surMort(chien, tueur)` (`chien.type === 'chien'`).
- **Modèle procédural original** : grand chien décharné (≈ 0,74 m au garrot, ≈ 1,15 m de la truffe à la croupe), 23 os,
  ≈ 4 000 triangles, peau grise tendue, plaques de poil, côtes à vif sur un flanc écorché, échine à nu, cou creusé
  (trachée, tendons), moignon de queue, pieds compacts à quatre doigts et ongles noirs. Tête anatomique : crâne à crête
  sagittale et tempes creuses, arcades zygomatiques et sourcilières, stop marqué, orbites enfoncées (yeux en amande couleur
  `energie` de `src/fx.js`, 1 / 0,3 / 0,07), museau en coin, truffe et narines, babines noires retroussées sur les crocs,
  commissures qui s'étirent avec la mâchoire, langue, joue arrachée (molaires à nu), une oreille en conque, l'autre
  arrachée (moignon déchiqueté). Deux variantes (côté écorché inversé).
- **Animation** : galop rotatoire (≈ 2,6 foulées/s à 7,4 m/s ; trot en dessous de 3 m/s), colonne qui se replie et
  s'étend, inclinaison dans les virages, bond-morsure (élan, saut, la tête claque) à `portee` toutes les `cadence` s,
  harcèlement en cercle entre deux morsures, réaction aux balles, mort (effondrement sur le flanc puis cendres), sortie de
  faille (jaillit du sol en bondissant, invulnérable 0,2 s), grognement sur place quand il ne peut pas progresser.
- **IA** : poursuite immédiate du joueur vivant le plus proche (ligne droite praticable ou champ de flux partagé avec les
  zombies : contourne piliers intacts, autel, brèches ; traverse les piliers détruits), séparation avec zombies et chiens.
- **Adaptateur** : `faireApparaitreZombie({ type: 'chien', profil })` → chien ; `zombies()` porte `type` ; plafond des
  apparitions normales calculé sur les seuls zombies ; `jeu.attaqueZombie(z, joueurId)` (dégâts : `z.degats`, sinon
  `jeu.degatsZombie`) et `jeu.zombieTue(z, tueur)` (100 points par chien, 60 par zombie) à brancher sur `surAttaque` / `surMort`.
- **Coéquipiers** (`proto-bots.js`) : un chien à moins de 8 m (et en vue) passe avant le boss et les zombies ; visée à 0,55 m.
- **Correctif v1.2** : les tubes descendants des zombies (bras, mains, jambes, jugulaire) étaient orientés vers l'intérieur
  (faces arrière visibles : manches trop claires, épaules « en bloc ») ; ils sont maintenant orientés vers l'extérieur.
- Tests : `node dev/test-chiens.js [recent]` (13 vérifications + captures `v12-*`), `node dev/chien-gros-plan.js [recent]`
  (gros plans `chien-*`, cycle de galop `chien-galop-0…7`), `node dev/allocations-chiens.js` (allocations par image).

## Coéquipiers immortels (essais d'Anthony)

`ProtoB7Bots.creer(THREE, { …, immortels: true })` ou `B.immortels(true|false)` : les coups portent (frappe à 1 %, blocs,
morsures) et la régénération reprend, mais les PV ne descendent jamais sous 1 ; activer l'option relève ceux qui sont morts.
Le prototype assemblé l'active par défaut (`BOTS_IMMORTELS` dans la page, case « coéquipiers immortels » du panneau P,
`?bots=mortels` pour l'enlever). Dans ce mode, le joueur tombé revient au combat près d'un coéquipier 6 s plus tard
(invulnérable 2 s), puisque l'échec « tous les joueurs à terre » ne peut plus arriver. Test : `node dev/test-bots-immortels.js`.

## Version 1.3 (API.md §15.1, §15.3, §15.4) — cuves vertes et mini-boss

- **Cuves** (`proto-monde.js`, remplacent les deux cuves brisées, positions de `arene.salle.tubes`) : socle à nervures et bride
  boulonnée, 4 pieds en équerre boulonnés, anneaux (bas, milieu, haut) et 4 montants qui laissent l'avant dégagé, verre
  (r 0,85, h 2,6) avec reflets, couvercle en dôme boulonné à vanne, 2 tuyaux et 3 câbles vers le coin, plaque gravée
  (« CONFINEMENT N°06 / SUJET : LE SURVOLTÉ »), liquide vert animé (défilement, surface), 70 bulles, mini-boss endormi qui
  flotte (vrai modèle, pose suspendue, balancement ; il s'agite pendant le siphon).
  `monde.appliquerTubes(etat.tubes, temps)` : `intact` → `siphon` (le niveau baisse, bulles affolées, lumière qui vacille) →
  `fissure` (fissures lumineuses qui s'étendent, stroboscope) → `eclate` (verre brisé à dents en haut et en bas, arêtes vives,
  tessons, flaque qui s'étale ; le dormeur bascule vers l'ouverture puis disparaît au bout de `siphon.apparition.delai` s, ou
  dès que l'entité sort : `monde.cacherDormeur(id)`). Collision : cercle r + 0,2 dans tous les états. Une lumière par cuve
  (comme avant) ; un mini-boss libéré l'emprunte (`monde.emprunterLumiereTube(id | type)` / `monde.rendreLumiereTube(L)`) :
  aucune lumière ajoutée. Aussi : `monde.tubes`, `monde.tube(id)`, `monde.etatTubes()`.
- **Mini-boss** (`proto-zombies.js`, même API que zombies et chiens) : `apparaitre({ type: 'survolte' | 'irradie', miniBoss:
  true, nom, profil, effet: 'cuve' | 'normal', pvMax? })` → id (`'m…'`) ; `liste()` : `type`, `nom`, `pv`, `pvMax`,
  `miniBoss` ; PV = `profil.pv` ; zones `tete` (×2) / `corps` ; `retirer` (`cendres`, `silencieux`) ; `tuerTous` les épargne
  sauf demande explicite (`type` ou 3e argument) ; `effet` (saisie / extraction) refusé.
  Modèles d'après les fiches : Survolté 1,80 m (casque blanc fendu et autocollant cyan, cheveux dressés, veste bleu nuit à
  bandes réfléchissantes, fermeture, bretelles à anneaux, insigne, ceinture à outils et sacoches, genouillères, gant rouge,
  câble enroulé et fils de cuivre, cicatrices et courant cyan émissifs) ; Irradié 1,90 m (combinaison jaune à plis et taches,
  capuche rabattue, masque à gaz pendu (oculaire fendu, cartouche), insigne radioactif, trous déchirés à pustules, gant noir
  et main nue, hautes bottes, crâne chauve gris-vert, yeux, pustules, veines et bave vertes émissives).
  Animations : Survolté (bras écartés, tremblement électrique, spasmes, charge bras levés, décharge bras tendus, recharge
  avachie), Irradié (pas traînants, bras ballants, tête affaissée, coup lourd) ; sortie de cuve (bascule du socle, à quatre
  pattes, se redresse) ; morts (Survolté : court-circuit, effondrement, corps calciné ; Irradié : à genoux, face contre
  terre, se dissout dans la flaque).
  Capacités : décharge toutes les `intervalle` s vers le joueur valide le plus proche à `portee` m en ligne de vue (charge
  lisible 0,7 s, arc, `degats`, vision brouillée `flou` s), puis `recharge` s immobile ; se tient à 5–7 m (contourne pour
  retrouver la ligne de vue) ; coup au contact ; aura (`degatsParSeconde` par pas de 0,25 s à `aura.rayon` m) ; flaque
  toxique de `flaque.rayon` m pendant `flaque.duree` s à la mort. Effets propres : arcs en lignes brisées régénérés chaque
  image (mains ↔ sol), éclair, lueurs, étincelles ; halo d'aura au sol, spores, vapeur, lueur verte du torse.
  Rappels : `surCapacite(z, quoi, info)` (`'charge' | 'decharge' | 'spasme' | 'aura' | 'flaque'` ; `info` réutilisé :
  `{ cible, position, impact, degats, flou, duree, rayon, touche, etat, intensite, source }`), `surAttaque(z, id)` (contact),
  `surMort(z, tueur)`. Dégâts des capacités : `Z.brancherDegats(fn(z, joueurId, fraction, source, info))` (l'adaptateur s'y
  branche tout seul). `Z.dangersZone(out)` : aura et flaques (évitées par les coéquipiers). `Z.flaques()`, `Z.PROFILS_MB`.
- **Joueur** : `j.flou(duree)`, `j.flouRestant()` : couche floutée (backdrop-filter) + éblouissement cyan qui s'estompe, en DOM
  par-dessus le canevas (rendu WebGL intact, interface nette).
- **Adaptateur** : `faireApparaitreZombie` transmet `type`, `miniBoss`, `nom`, `profil`, `pvMax` ; `zombies()` porte `pv`,
  `pvMax`, `type`, `nom` ; dégâts des capacités par `infligerDegats` (sources `decharge`, `aura`, `flaque`), contact par
  `jeu.attaqueZombie` (source `contact`) ; décharge sur le joueur local → `joueur.flou(info.flou)` ; 500 points par mini-boss.
- **Coéquipiers** : aura de l'Irradié et flaques ajoutées d'office aux dangers évités ; les mini-boss sont des cibles.
- **Correctif** (`proto-nav.js`) : la ligne de vue / ligne praticable de la grille échouait quand l'extrémité tombait pile sur
  une arête de cellule (le parcours dépassait le segment) ; le parcours s'arrête maintenant à la fin du segment.
- **Perf** (Survolté + Irradié + 5 chiens + 26 zombies, IA + capacités + effets, hors rendu) : ≈ 0,5 ms par image, p95 ≈ 1 ms,
  r128 comme r186 ; salle ≈ 198 k triangles, 315–330 appels. Boucles par image : aléa entier `alea()` (xorshift, inliné) au
  lieu de `Math.random` (qui alloue un nombre à chaque appel), arcs remplis via des tampons `Float64Array` (`SEG`, `ARC`),
  couleurs et positions affectées directement, dormeurs animés par une seule boucle. Résidu mesuré en régime établi :
  ≈ 3,5 Ko par image pour toute la scène (surtout le code zombies/chiens, et les fonctions des mini-boss tant que V8 ne les a
  pas promues au compilateur optimisant) → un ramasse-miettes mineur toutes les ~25 s, sans pic d'image.
- Tests : `node dev/test-miniboss.js [recent]` (cuves, mini-boss, capacités, morts, flaque, zones, coéquipiers, perf +
  captures `v13-*`), `node dev/allocations-miniboss.js`.

## Version 1.4 (API.md §16.1, §16.2) — 3e cuve, Le Démembré, mini-boss renforcés

- **Monde** (`proto-monde.js`) : autant de cuves que `arene.salle.tubes` (3 : `tube2` au milieu du mur nord). Tout est
  générique : `construireCuve(…, T0, indice)` (graine par cuve), plaque « CONFINEMENT N°xx / SUJET : … » par type (N°06
  Survolté, N°04 Irradié, N°02 Démembré, nom de la config), dormeur `modeleDormant(type)`, tuyaux à la longueur disponible
  jusqu'au mur, câbles par cuve (vers le centre ; le long du mur quand une brèche est devant, cas de `tube2` et de
  `breche0` en (0, 11)), une lumière par cuve. Budget de la salle tenu : 13 lumières ponctuelles comme en v1.3 (l'accent
  rouge mural à moins de 6 m d'une cuve laisse sa place). Collision : cercle r + 0,2 ; **correctif** : ces cercles
  (1,05 m) n'étaient pas reportés dans la grille de navigation (filtre `r < 1`) — sans effet pour les cuves des coins, mais
  derrière la 3e cuve les zombies cherchaient un passage inexistant ; ils la contournent maintenant. Brèches lues dans les
  données. La **cage** chevauchait l'autel (déplacé en v1.1) : elle passe à 327° (−7,0 ; 10,8), toujours à droite de la cuve
  vue du centre. Distances au centre de `tube2` : cage 7,4 m, table 5,1 m, autel 4,9 m ; cage–autel 2,7 m.
- **Le Démembré** (`proto-zombies.js`, type `'demembre'`, fiche N°02) : colosse de 1,95 m (débardeur gris taché de sang,
  pantalon kaki, ceinture, bottes lacées, peau verdâtre meurtrie, mâchoire ouverte et joue arrachée, œil gauche crevé,
  plaie au crâne, points de suture). Bras gauche arraché à l'épaule (moignon, clavicule), **maillage à part** relié par 5
  tendons, mû par un pendule (centre de gravité au bout des tendons, ressort de repos, amortissement, contrainte de corde,
  collision avec le torse ; sans allocation) : il ballotte à la marche, ne se détache jamais. Squelette : les 18 os + 3
  (`brasLibre`, `avantBrasLibre`, `mainLibre`). Démarche lourde et boiteuse, épaule gauche affaissée. **Fléau** : dès qu'un
  joueur est à `portee` − 0,35 m, il fait tournoyer le bras au-dessus de l'épaule pendant `preparation` s (il avance à
  35 % et se tourne vers sa cible), puis l'arc s'abat de sa gauche vers sa droite (0,2 s) ; à 35 % de la frappe, **tous**
  les joueurs à `portee` m dans le cône de `angle`° devant lui prennent `degats` (source `'fleau'`). Un fléau toutes les
  `cadenceContact` s. Mort : vacille, à genoux, face contre terre, mare de sang ; sortie de cuve comme les autres (la cuve
  garde sa lumière). Zones de tir : tête (×2) / corps (le bras pendu compte comme le corps).
- **L'Irradié** : vitesse du profil (4,4 m/s, pas courts et rapides), aura de `aura.rayon` (6 m : halo agrandi, dangers).
  **Boules** : toutes les `intervalle` s (à portée), geste de lancer 0,8 s, `parVolee + parJoueurSupp × (n − 1)` boules en
  cloche (`tempsVol` s), une par joueur valide à tour de rôle, la suivante sur l'endroit où il sera dans 1 s ; repère au
  sol dès le lancer (il s'intensifie jusqu'à l'impact) ; impact : `impact.degats` dans `impact.rayon` m (source `'boule'`)
  et une **zone radioactive** (r `zone.rayon`) qui reste jusqu'à sa mort, **sans plafond** (instances qui s'agrandissent
  au besoin), puis s'éteint en 1,5 s. Rendu : disques additifs qui palpitent, filaments qui crépitent, spores et
  étincelles vertes qui montent ; aucune lumière ajoutée. **Exposition** par joueur et par Irradié : tic de 0,25 s,
  dps = min(`dpsMax`, `dpsBase` + `dpsParSeconde` × expo), expo remise à zéro après `oubli` s dehors (source `'zone'`) ;
  aura et zones se cumulent. `Z.zones()`, `Z.boules()`, `Z.exposition(idIrradie, idJoueur)` ; zones dans `dangersZone`.
- **Le Survolté** : vitesse 5,4 ; décharge `multi` : un arc vers **chaque** joueur valide à portée et en vue (4 au plus),
  `degats` + `flou` + **étourdissement** `etourdissement` s (`info.etourdissement`) ; un joueur invulnérable voit l'arc
  mais ne prend rien (le crochet `brancherDegats` renvoie false : pas d'« etourdi »).
- **Rappels** `surCapacite(z, quoi, info)` : en plus de v1.3, `'fleau'` (`etat` `'preparation'` | `'frappe'`), `'impact'`
  (un par joueur touché, `cible`), `'boule'` (`'lancer'` | `'impact'`), `'zone'` (`'debut'` | `'fin'`, `id`), `'etourdi'`
  (`cible`) ; `info.position` (monde) et `info.impact` toujours remplis.
- **Joueur** : `j.etourdir(duree)`, `j.etourdiRestant()` (ni déplacement, ni saut, ni tir, ni rechargement ; la vue reste
  libre mais tremble ; voile d'éclairs bref) ; `j.tirerVers(position)` : déplacement forcé, vitesse horizontale remise à
  0, collisions suspendues 0,15 s après le dernier appel (puis le joueur est repoussé hors des obstacles), position non
  finie refusée. **Arme** : rien pendant l'étourdissement (le rechargement attend).
- **Coéquipiers** : `b.etourdir`, `b.etourdiRestant`, `b.tirerVers` (mêmes règles) ; zones radioactives et aura de 6 m
  évitées (`dangersZone`).
- **Adaptateur** : étourdissement par `brancherDegats` (`info.etourdissement` → joueur ou coéquipier) ; sources `'fleau'`,
  `'boule'`, `'zone'` ; `jeu.tirerJoueur(id, position)` (joueur et coéquipiers) ; `zombies()` porte toujours `pv`/`pvMax`
  des mini-boss ; type `'demembre'` accepté (`PROFILS_MB`).
- **Perf** (SwiftShader, Survolté + Irradié + Démembré + 5 chiens + 26 zombies : IA, capacités, effets, zones, hors rendu) :
  ≈ 0,35–0,4 ms par image, p95 0,6–0,9 ms, r128 comme r186. Salle : ≈ 215,5 k triangles et 329 appels (r128), 216,6 k et
  350 (r186) ; v1.3 : 198 k, 315–330. Allocations (échantillonnage du tas, scène complète) : r128 ≈ 4,4 Ko par image après
  30 s de jeu, ≈ 3,0 Ko après 100 s (code promu au compilateur optimisant) ; r186 ≈ 5,1 et 3,4 Ko (dont ≈ 0,45 Ko internes
  au navigateur). Part des mini-boss v1.4 en régime établi : ≈ 0,4 Ko (IA, déplacements, zones) ; le reste vient du code des
  zombies et des chiens, comme en v1.3. Les couleurs des zones sont écrites directement dans le tampon d'instances
  (`setColorAt` + `Color.setRGB` de Three récent coûtaient ≈ 1,1 Ko par image avec 34 zones).
- **Vérifié** (r128 et r186) : `test-miniboss` 43/43, `test-proto` 12/12, `test-v11` 12/12, `test-piliers` 4/4,
  `test-chiens` 13/13 ; prototype assemblé : v1.1 19/19, v1.2 16/16, coéquipiers immortels 9/9, combat complet 15/15, fin
  6/6, `test-v13-assemblage` 27/35 (les 8 échecs attendent la v1.3 : 2 cuves, versions 1.3 ; rien côté moteur, aucune erreur
  console).
- Tests : `node dev/test-miniboss.js [recent]` (43 vérifications, captures `v13-*` et `v14-*`), `node
  dev/allocations-miniboss.js [chauffe] [images] [recent]`. `dev/test-v11.js` : le point « derrière l'autel » (0 ; 13,6)
  tombait dans la 3e cuve ; il suit maintenant `arene.salle.autel` (seuil de 2,4 m dans cette poche de 1,5 m, où les
  derniers zombies font la queue).

## Version 1.5 (API.md §17.1) — rages des mini-boss, Démembré géant, charge et projections

- **Monde** (`proto-monde.js`) : chaque cuve suit sa taille (`rayon`, `hauteur` de `arene.salle.tubes`) : verre, socle,
  couvercle, tuyaux, câbles, plaque et lumière à l'échelle (lumière `14 × k^1,5`, à `1,5 × kH` m). `tube2` (r 1,3, h 4,4,
  z 13,1) abrite **Le Démembré ×2 debout** (`modeleDormant(THREE, type, { echelle, debout })`) : os dans le verre, sous le
  couvercle. Budget de la salle inchangé (13 lumières ponctuelles). **Correctif** : à la remise à neuf (`intact`), le dormeur
  basculé par l'éclatement est recentré (il dépassait du verre de 0,65 m pour la cuve géante). `monde.distanceMur(lieu, x, z,
  out?)` (plan du mur le plus proche, `out` = normale sortante) ; après `monde.resoudre(…)`, `monde.contactMur` et
  `monde.normaleMur` (un mur de l'octogone, ni pilier ni décor, a repoussé le cercle).
- **Rages** (`proto-zombies.js`, `Z.effet` ; l'adaptateur relaie `jeu.effetZombie`) : pendant `duree`, `Z.toucher` →
  `{ tue: false, immunise: true }` ; le mini-boss s'immobilise aussitôt (vitesse remise à 0). `reprise: true` (mini-boss remis
  devant sa cuve) reprend l'état sans rejouer le début.
  - `'surcharge'` `{ duree, source }` (Le Survolté) : il se tourne vers `source`, bras levés, de plus en plus lumineux
    (émissif, lueurs, lumière, gaine d'arcs, étincelles courtes aux mains ≤ 0,85 m : le rayon venu du Septième est fait par
    `fx.js`) ; ensuite **surchargé** jusqu'à sa mort (arcs plus forts, plus lumineux). `duree` 0 → surchargé d'emblée.
  - `'infection'` `{ duree }` (L'Irradié) : cri, immobile, vulnérable ; l'irradiation des entités vient de la logique.
  - `'arrachement'` `{ duree, vol, cible }` (Le Démembré) : voir plus bas.
- **Entités irradiées** : `Z.effet(zid, 'irradie', { actif, aura: { rayon, degatsParSeconde }, couleur })` sur zombies, chiens
  et petits Démembrés (mini-boss → `false`) : lueur verte pulsée (shader des zombies : `uIrradie`, `uCoulIrr`), **halo au sol**
  (une instance par entité, un seul appel de rendu par salle), spores ; aura par tics de 0,25 s (`brancherDegats`, source
  `'aura'`) ; `{ actif: false }` → normal (matériau partagé rendu). `Z.irradies()`. Option `creer({ halosIrradies: false })` :
  pas de halo (`fx.js` 1.5 dessine sa propre lueur au sol, `lueursIrradies`).
- **Démembré géant** (`profil.echelle` 2 → échelle 2,16, 3,9 m) : modèle, zones de tir, rayon de collision (0,88), séparation
  (1,04), masse, navigation (ligne directe testée à sa largeur), foulée (cadence des pas ÷ échelle) et pendule du bras à
  l'échelle ; fléau de `portee` (6 m) : secteur au sol pendant la préparation puis bande qui balaie, à la mesure de la portée.
- **Arrachement** : invulnérable `duree` s ; il saisit son bras pendu de la main droite et l'arrache (gerbe de sang, tendons
  qui claquent ; `surCapacite` `'arrachement'` etat `'arrache'`), le brandit, le lance à `duree − vol` s depuis l'épaule
  (`'lance'`), cloche de 3 m, posé sur `cible` à `duree` s (`'pose'`). Le bras (maillage à part tiré des poids de peau) reste au
  sol : mare de sang, pulsations ; à la mort du géant il se flétrit tout seul puis disparaît. Retiré sans mourir (garde-fou) :
  bras orphelin 1,5 s, adopté par la reprise (aucun second bras), sinon dissous. `Z.bras()` → `[{ etat: 'main' | 'vol' |
  'pose' | 'fletri', position, proprietaire }]`.
- **Sans bras** : coups du bras droit au contact (allonge × échelle) ; **charge** (`profil.charge`) : préparation `preparation`
  s (il gratte le sol, tête basse ; `'charge'` etat `'preparation'`, `info.cible`), **trajectoire figée dès le début de la
  préparation** vers la position de sa proie (dans `Z.dangersZone` : `ligne`, `largeur`, source `'charge'`), ruée en ligne
  droite à `vitesse` m/s sur au plus `distanceMax` m (`'elan'`) ; chaque joueur à moins de `largeur` m du segment parcouru :
  `degats` (source `'charge'`, `'impact'` par joueur) et `info.projection = { vx, vz, duree }` (sens de la charge écarté de 45°
  vers l'extérieur) ; mur ou pilier → `'mur'`, étourdi `etourdiMur` s ; sinon glissade 0,45 s ; recharge `recharge` s.
- **Projections** : `j.projeter(vx, vz, duree)`, `j.projectionRestante()`, `j.surImpactMur`, évènements `'projection'` et
  `'impactMur'` (joueur) ; `b.projeter`, `b.projectionRestante`, `B.surImpactMur` (coéquipiers, basculés et décollés du sol
  pendant la projection) ; collisions comprises. Un mur de la salle heurté → `Z.impactMur(id, { x, z, vitesse })` →
  `impactMur` en plus (source `'impactMur'`) et `surCapacite` `'projection'` (`cible`, etat `'mur'`). L'adaptateur branche tout.
- **Petits Démembrés** : `type: 'demembre_petit'` (ni mini-boss ni zombie : `miniBoss` false, 100 points), taille normale,
  bras pendu et fléau du `profil` ; effet `'bras'` : ils sortent du sol en griffant près du bras, rampent, se relèvent
  (insensibles 0,45 s). Réserve de 14 (option `maxPetits`). `Z.retirer(id, { effet: 'effondrement' })` : il s'écroule et se
  dissout (aussi pour un zombie).
- **Coéquipiers** (`proto-bots.js`) : `situation.murs = { distance }` → but ramené hors de la bande, vitesse vers le mur
  annulée et poussée vers l'intérieur : ils restent à plus de `distance` + 0,5 m du plan des murs ; la ligne d'une charge
  annoncée est esquivée (après `reaction` s), comme les autres dangers.
- **Correctifs de zones de tir** : depuis la v1.3, le vecteur de travail de `raySegment` était aussi l'extrémité du segment :
  la capsule du torse des mini-boss se réduisait à une sphère aux hanches (tirs dans la poitrine perdus) et le bras pendu à
  une sphère à l'épaule. Torse : capsule hanches → poitrine puis poitrine → cou plus étroite ; la tête reste prioritaire
  (marge × échelle).
- **Perf** (SwiftShader, IA + capacités + effets, hors rendu) : scène v1.4 (Survolté, Irradié, géant, 5 chiens, 26 zombies)
  0,48 ms (r128) / 0,54 ms (r186) par image ; scène v1.5 (géant sans bras qui charge, 12 petits, Survolté surchargé, 20 zombies
  et 4 chiens irradiés) 0,53 / 0,51 ms, p95 0,8 ms ; rendu : 316,5 k triangles et 333 appels (r128), 317,6 k et 354 (r186).
  Allocations (chauffe 30 s, `allocations-miniboss.js 1800 600 [recent] v15`) : ≈ 6–10 Ko par image (r128), 8–16 Ko (r186),
  selon ce que le compilateur a optimisé ou intégré (Quaternion/Euler de Three) ; scène v1.4 : 4,9 Ko (r128). **Correctif** :
  la séparation et l'irradiation lisaient des nombres dans les propriétés d'objets de formes différentes (zombies, chiens,
  mini-boss : accès mégamorphes, chaque lecture allouait) → 46 Ko (r128) et 72 Ko (r186) par image ; rayons, masses et
  irradiation sont maintenant dans des `Float64Array` indexés par entité.
- **Vérifié** (r128 et r186) : `test-miniboss` 72/72, `test-proto` 12/12, `test-v11` 12/12, `test-piliers` 4/4,
  `test-chiens` 13/13 ; prototype assemblé : v1.1 19/19, v1.2 16/16, coéquipiers immortels 9/9, combat complet 15/15, fin
  6/6 ; aucune erreur console. Après l'assemblage final de la v1.5 : `test-v15-assemblage` 35/35, `test-v14-assemblage` 28/28
  (adapté : versions ≥ 1.4, 15 sons v1.4 encore utilisés, absence d'illusions au palier 2), `test-v13-assemblage` 35/35.
- Tests : `node dev/test-miniboss.js [recent]` (captures `v15-*`), `node dev/allocations-miniboss.js [chauffe] [images]
  [recent] [v15]`. Les tests v1.4 du Démembré lisent maintenant la config (portée 6 m, préparation 0,7 s, échelle).
