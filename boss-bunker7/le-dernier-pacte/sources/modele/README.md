# Modèle 3D animé du Septième (boss de Bunker 7) — version 2.2.0

Fichier livré : `boss/src/boss-modele.js` (script classique → `globalThis.BossB7Modele`, ou CommonJS), assemblé par
`outils/assembler.py` à partir de `parts/*.js`. Compatible Three.js r128 (global) et récent (r186 testé).
Personnage entièrement inventé (voir `boss/DESIGN.md`, « Apparence du Septième ») : aucune personne réelle, aucun
symbole réel ; motifs occultes faits uniquement de cercles, arcs, points, spirales et du sceau à sept branches courbes.

Nouveautés 2.2 (combat 1.4, `boss/API.md` §16.6) : couleur des lames (bleu / rouge / vert), action `crochet`, option
`allege` et ressources partagées pour les illusions, frappe retouchée (la lame droite ne traverse plus le visage),
deux passes de matrices en moins par image (résultat identique).

## API (`boss/API.md` §6, §16.6)

```js
const modele = BossB7Modele.creer(THREE, { renderer, tete: globalThis.BOSS_B7_TETE || null, qualite: 'haute' });
scene.add(modele.object);          // origine aux pieds, regarde +Z
await modele.pret;                 // textures de la tête chargées (Promise)
modele.update(dt, vue);            // vue = combat.etat().boss (+ vue.temps) : place, oriente, anime tout
modele.reagir(dirX, dirZ, force);  // sursaut additif à l'impact (direction de la balle, force 0..1,5)
modele.flash(couleur, intensite);  // éclair d'émission bref
modele.couleurLames(nom);          // 'bleu' | 'rouge' | 'vert' (null ou inconnu → 'rouge') ; sans argument : couleur courante
modele.points;                     // Object3D qui suivent le corps (voir plus bas)
modele.hitboxes();                 // [{ zone: 'tete'|'corps', type: 'sphere', centre: {x,y,z}, rayon, os }] en monde (tableau réutilisé)
modele.dispose();
```
Extras : `reinitialiser()` (tissus, particules, fondus), `stats`, `version` ('2.2.0'), `allege`, `teteType`, et pour les
outils `os`, `squelette`, `maillages`, `materiaux`, `uniformes`, `tete`, `ailes`, `lames`, `voile`, `aura`, `animateur`.
Le module exporte aussi `actions`, `locomotions` (listes de l'API) et `clips` (noms des poses).

### Options de `creer`

| option | défaut | effet |
|---|---|---|
| `renderer` | `null` | sert à détecter l'espace de couleur de sortie (et l'anisotropie des textures de la tête) |
| `tete` | `null` | données `BOSS_B7_TETE` (`boss/tete/out/boss-tete.js`) ; `null` → tête de remplacement procédurale |
| `qualite` | `'haute'` | `'moyenne'` (× 0,72 de densité), `'basse'` (× 0,5 ; textures de tête 512²) |
| `ombres` | `true` (`false` si `allege`) | projection et réception des ombres (et matériaux de profondeur) |
| `gouttes` | `true` | `false` : aucune goutte de sang ni éclaboussure côté modèle (le jeu les dessine, `src/fx.js`) |
| `solY` | `null` | hauteur du sol sous le boss (nombre ou `(x, z) => y`) pour les poses au sol ; à défaut `vue.sol`, sinon la hauteur des pieds |
| `couleursLineaires` | auto | force la conversion des couleurs de sommets en linéaire |
| `couleurLames` | `'rouge'` | couleur initiale des lames (v2.2) |
| `allege` | `false` | instance légère pour les illusions (v2.2, voir plus bas) |

### Ce que lit `update` dans `vue`

`present`, `visible`, `position` (pieds, monde), `lacet`, `vitesse` (inclinaison), `regard` (point regardé),
`action` (`id`, `etape`, `t`, `duree`, `progression`, `cible`, `cibleJoueur`, `donnees.reussie`), `locomotion`,
`ailes` (`absentes|apparition|deployees|dissipation`), `lames` (`absentes|formation|actives|desintegration`),
`couleurLames` (v2.2 : `'bleu'|'rouge'|'vert'`, `null` = rouge ; clé absente = couleur inchangée), `puissance`,
`affaiblissement`, `vulnerable` (voile de protection), `ames` (secousse à chaque âme), `temps`, `sol`.
Rien d'autre (pas d'évènement obligatoire) : la page d'aperçu l'affiche seul.

## Couleur des lames (v2.2)

| | verre (couleurs de sommets) | veines, front, fissures (`uVeineCoul`) | cœur de la garde | traînées, fumée, gouttes | dissolution du corps* |
|---|---|---|---|---|---|
| `rouge` | sang coagulé (couleurs d'origine) | rouge sang | rouge | rouge | brume de sang |
| `bleu` | bleu très clair, verre glacé translucide (opacité 0,8, plus lisse) | cyan pâle presque blanc, reflet de bord glacé | bleu clair | bleu pâle | brume glacée |
| `vert` | vert spectral sombre | vert spectral | vert | vert | brume verte |

\* et halo de l'aura, tant que les lames sont là (phase 5 : apparitions, téléportations). Les os de la poignée et les
dents d'os ne changent pas ; les tendons de la poignée suivent la teinte. Le changement est instantané : les couleurs de
sommets des trois palettes sont préparées à la création et recopiées seulement au changement (verre, cœur, tendons) ;
le reste passe par des uniformes (`uVeineCoul`, `uLameReg`, `uDissolCoul`, `uCoul`, `uReflet`) et des couleurs de
matériau. Aucune recompilation, aucune allocation par image. Chaque instance a ses propres matériaux et uniformes.

## Actions et locomotions

Toutes les actions et étapes de l'API §5 sont jouées (séquenceur `parts/14-sequenceur.js` → clips de
`parts/12-poses.js`, avancement = `progression` de l'étape) : apparition, invocation, trait, souffrance, recharge,
absorption, transformation_ailes, pique, effondrement, teleport_depart, teleport_arrivee, retour_rage,
arrachement, onde_choc, faiblesse, rituel_ames, transformation_lames, frappe (`frappe-ratee` si
`donnees.reussie === false`), frappe_ordinaire, defaite, siphon (2.1), crochet (2.2). Locomotions : `aucune`/`levitation`
(lévitation), `ailes`, `rage`, `affaibli`, `traque`, `mort` (cadavre). Couches procédurales : respiration, flottement,
tremblement de rage, frisson de faiblesse, regard (tête, cou, yeux), visée des bras, sursauts, inclinaison selon
la vitesse, fondus entre clips. Effets : ailes (os + membranes d'énergie : apparition, battements, flèche du piqué,
dissolution), deux lames vivantes (formation, cœurs qui battent, traînées, fumée, gouttes, désintégration), voile
d'invulnérabilité, aura et braises, dissolution du corps (apparitions, téléportations).

**Crochet** (palier 3, lames actives), trois clips propres faits des clés de 'designation-mur', 'lancer' et 'absorption' :
`preparation` → `crochet-visee` (bras droit tendu vers le joueur visé, poing serré, épaule droite en avant ; visée
`action.cible` + 1,15 m quand `cibleJoueur` est donné) ; `lancer` (durée inconnue de la logique : `duree` null) →
`crochet-lancer` joué en 0,42 s d'après `action.t` (armé, main au-dessus de l'épaule, puis jeté vers la cible) puis bras
tendu qui tient la chaîne ; `traction` (durée inconnue) → `crochet-traction` en boucle depuis le début de l'étape (les
deux poings ramènent la chaîne à la hanche, buste rejeté en arrière, un à-coup toutes les 0,8 s). La chaîne de fx.js part
de `points.mainD`. Les lames restent dans les mains : aucune ne pénètre le corps (`outils/controle_lames.js`).

Contrainte anti-salut : un bras qui vise reste toujours sous l’horizontale (`MIN_VISEE`, de 9° à 41° selon le geste ; 9°
pour le crochet), coude légèrement fléchi, main en griffe, poing ou paume de côté ; `outils/audit_salut.js` rejoue toutes
les actions et ne relève aucun bras tendu vers l'avant au-dessus de l'horizontale.

## Illusions (phase 5, palier 2) : instances légères

Recette (une instance par illusion, créées à l'avance et réutilisées : ne pas les recréer à chaque apparition) :
```js
const illusion = BossB7Modele.creer(THREE, { renderer, tete: globalThis.BOSS_B7_TETE || null, qualite: 'basse',
  allege: true, ombres: false, gouttes: false, couleurLames: 'vert' });
await illusion.pret;
scene.add(illusion.object);
// chaque image : { present, visible, position, lacet, vitesse, locomotion: 'traque', lames: 'actives', couleurLames: 'vert',
//   action } avec action = { id: 'frappe', etape, t, duree, progression } pendant ses gestes,
//   { id: 'teleport_arrivee', etape: 'apparition', progression } à l'apparition, { id: 'teleport_depart', etape: 'implosion', progression }
//   à la dissipation, null sinon ; { present: false } quand elle est absente
illusion.update(dt, vue);
```
`allege: true` : pans du manteau et de l'étole posés à l'équilibre de la simulation (sans intégration ni collisions
itérées ; écart moyen 1–2 cm avec la simulation), pas d'ailes (leurs os sortent de l'arbre mis à jour), sans ombres,
dernière passe de matrices laissée au rendu, pièces métalliques fondues dans le cuir et bandages dans le drap, fioles,
gemme de la broche et dents omises. Même silhouette à 5–10 m (planches `allegee-vs-complete*.png`). Les points
`aileG`/`aileD` ne sont pas tenus à jour en mode allégé ; il suppose que le rendu recalcule les matrices monde
(`scene.matrixWorldAutoUpdate`, défaut de three.js) — `points.*.getWorldPosition()` et `hitboxes()` restent justes.

Ressources partagées (toutes les instances, v2.2) : géométries du corps et de la tête cuite, textures de la tête, pour
des instances de même configuration (même THREE, qualité, espace de couleur, tête, allègement). Compteur de références :
libérées avec la dernière instance (`dispose`). Matériaux, uniformes, géométries des lames (couleurs modifiables),
squelettes, morphoses actives : propres à chaque instance. `BOSS_B7_TETE` n'est jamais modifié.

Téléportations d'une illusion : brume de dissolution, halo et éclats à la couleur des lames (aucun flash rouge) ; lame,
cœur et poignée fondent avec le corps (planche `illusion-teleportations.png`).

## Points (`modele.points`)

`mainG`, `mainD`, `tete`, `bouche` (suit la mâchoire), `poitrine`, `dos`, `piedG`, `piedD`, `lameG`, `lameD`
(gardes), `pointeLameG`, `pointeLameD` (pointes, pour les gouttes), plus `oeilG`, `oeilD`, `aileG`, `aileD`.

## Zones de tir

12 sphères liées aux os (rayons à l'échelle du boss) : `tete` (os head, 0,122 m) ; `corps` : poitrine 0,209,
colonne 0,194, bassin 0,209, cuisses 0,126, tibias 0,097, bras 0,083, avant-bras 0,073.

## Tête

Avec `BOSS_B7_TETE` : peau skinnée sur les os head / neck / chest (poids du contrat) → le bas du cou suit la poitrine
et reste dans le col montant, tête basculée comprise ; mâchoire (morphose + dents + langue), yeux et sceau émissifs
(≈ 2 au repos, ≈ 3,2 dans les rugissements, 0 à la mort), dissolution avec le corps. Sans données : tête de
remplacement procédurale (crâne rasé, sceau gravé lumineux, cicatrice agrafée, iris rouge).

## Performances (r186, Chromium, tête du Septième, traque lames actives ; `outils/mesurer_instances.js`)

| instance | triangles | appels de dessin | `update()` | mémoire GPU estimée (géométries + textures) |
|---|---|---|---|---|
| haute, ombres + gouttes (aperçu, 1 lumière à ombres) | 55 648 | 50 | 0,22 ms | 2,7 + 73 Mo (tête 2048²) |
| haute, sans ombres ni gouttes (prototype) | 55 648 | 33 | 0,15 ms | 2,7 + 73 Mo |
| basse | 33 014 | 31 | 0,12–0,15 ms | 1,6 + 9,3 Mo |
| basse allégée (illusion) | 27 804 | 24 | 0,08–0,10 ms | 1,5 + 9,3 Mo |
| basse allégée, tête de remplacement | 15 100 | 23 | 0,08 ms | 0,8 + 2 Mo |
| 6 illusions + le boss | 218 784 | 173 | 0,84 ms au total | illusions : 2,0 + 9,3 Mo (au lieu de 8,8 + 56 sans partage) |

Création : ≈ 250–500 ms pour la première instance d'une configuration, ≈ 50–80 ms pour les suivantes (géométries et
textures partagées) ; 6 illusions : ≈ 0,5 s. Allocations de `update()` (profil du tas, `outils/profil_alloc.js`) :
≈ 0,2 Ko par appel, dans three.js, aucune dans les fonctions du modèle (vecteurs et objets de travail réutilisés ; le
changement de couleur des lames recopie dans des tableaux existants). Les écarts de tas de `outils/mesurer_alloc.js`
(quelques dizaines de Ko) sont du bruit du moteur JavaScript, du même ordre en 2.1. Les temps de rendu SwiftShader (logiciel) ne sont pas représentatifs d'un GPU : seuls les triangles et
les appels de dessin comptent ici. 2.1 → 2.2 : `update()` deux fois plus rapide en basse (deux passes complètes de
matrices en moins), halo de l'aura en un seul appel, traînées et gouttes non dessinées quand elles sont vides.

## Aperçu et outils

- `apercu.html?three=r186|r128&tete=b7|aucune&qualite=haute&lames=rouge|bleu|vert&allege=1` : toutes les actions et
  locomotions (dont `crochet`, `illusion_apparition`, `illusion_dissipation`), liste « Lames », défilement du temps,
  figer, tout enchaîner, impact, éclair, invulnérabilité, affaiblissement ; vues face, 3/4, profil, dos, buste, tête.
  Servir le dossier `scratchpad/` (ex. `python3 -m http.server 8794`).
- `outils/capturer.js travaux.json [three] [tete] [qualite] [lames] [allege]` : planches PNG (Playwright) ; une entrée
  `multi` place plusieurs instances (boss et illusions, pénombre) ; travaux de la 2.2 : `dev/t_*22*.json`.
- `outils/audit_salut.js` (contrôle anti-salut), `outils/controle_lames.js` (pénétration des lames dans le corps, Node),
  `outils/mesurer_instances.js` (coût d'une instance et de 6 illusions), `outils/mesurer_alloc.js` et
  `outils/profil_alloc.js` (coût et allocations de `update`), `outils/planches_revue.js` (planches de revue).

## Captures (`boss/captures/modele/`)

`lames-couleurs-r186.png`, `lames-couleurs-r128.png` (bleu, rouge, vert de près), `lames-couleurs-penombre-r186.png`,
`lames-couleurs-penombre-r128.png`, `crochet.png` (3 étapes, 4 vues), `illusions-penombre-r186.png`,
`illusions-penombre-r128.png` (le boss et 3 illusions), `allegee-vs-complete.png`, `allegee-vs-complete-penombre.png`,
`illusion-teleportations.png`.

## Limites connues

- Le corps est formé d'un SkinnedMesh par matériau (13 ; 8 en allégé), pas d'un seul : shaders différents (cuir, drap,
  verre, émissif).
- Étole et pans du manteau : physique de ressorts simple (collisions avec le torse et les jambes, pas entre eux) ;
  dans les poses extrêmes un pan peut effleurer une jambe. En allégé : équilibre de la simulation, sans inertie propre.
- Les manches remontent par morphose selon l'inclinaison de l'avant-bras (pas de glissement physique).
- Crochet : le bras visé reste au moins 9° sous l'horizontale ; à 10 m il montre donc les jambes du joueur plutôt que sa
  poitrine. Pendant la traction, les lames, toujours en main, s'écartent de part et d'autre des poings.
- La traînée des lames pendant `frappe` est volontairement très lumineuse ; l'intensité d'émission de la tête est
  réglée pour l'exposition de l'aperçu (à ajuster avec un bloom). Le bleu, plus clair, paraît plus lumineux que le rouge.
- Les planches sont rendues par SwiftShader (ombres et brillances un peu plus dures que sur un GPU).
