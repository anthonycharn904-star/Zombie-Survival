# Machine de mort : intégration dans Zombie Survival

Brief pour Claude Code. À lire en entier avant de toucher au jeu.

La **Machine de mort** est une mitrailleuse rotative à 6 canons (style militaire Black Ops : acier phosphaté usé, boîte de munitions vert armée, bande de cartouches en laiton, compteur à 7 segments). Elle n'est **ni l'arme principale ni l'arme secondaire** : elle n'existe que par le bonus « Machine de mort ».

## Règles voulues par Anthony

| # | Règle | Comportement du paquet |
|---|---|---|
| 1 | Elle apparaît avec le bonus « Machine de mort » | bonus au sol façon CoD : miniature dorée qui flotte et tourne, halo vert, colonne de lumière, étincelles, clignotement avant de disparaître |
| 2 | Au ramassage, le joueur la garde **30 s** | minuteur lancé au ramassage, sortie (0,6 s) et rangement (0,55 s) compris |
| 3 | Chargeur de **700** cartouches | pas de rechargement, pas de réserve, pas de visée |
| 4 | Chargeur vide **ou** minuteur écoulé : il la perd | l'arme tourne à vide 0,75 s puis se range ; le jeu ressort l'arme d'avant |
| 5 | Il doit attendre un prochain bonus | aucun autre moyen de la récupérer |
| 6 | Pas une arme d'inventaire | l'arme du joueur est rangée pendant l'usage puis rendue telle quelle (même chargeur, mêmes munitions) |

Règles ajoutées, réglables (§7) : un second bonus ramassé pendant l'usage remet le minuteur à 30 s et le chargeur à 700 ; le joueur à terre ou mort la perd tout de suite ; changement d'arme, rechargement, visée et grenades bloqués pendant l'usage ; déplacement à 88 % de la vitesse.

**Point d'équilibrage à signaler à Anthony** : à la cadence par défaut (1 800 coups/min, 30 par seconde), 700 cartouches durent **23,3 s de tir continu**. Un joueur qui ne lâche jamais la détente vide le chargeur avant la fin des 30 s ; un joueur qui tire par rafales finit au minuteur. C'est ce qui rend les deux conditions de perte réelles. Pour que seul le minuteur compte, il faudrait 1 400 coups/min ou moins (§7).

## Contenu du dossier

| Fichier | Rôle | À copier dans le jeu ? |
|---|---|---|
| `machine-de-mort/machine-de-mort.js` | Tout-en-un, script classique (≈ 0,62 Mo) : `MachineDeMort3D` (modèle, effets, bonus), `MachineDeMortLogique`, `MachineDeMortSons` (sons intégrés en base64), `MachineDeMortHud` (icône et police intégrées), `MachineDeMort` (assemblage) | **Oui** |
| `machine-de-mort/machine-de-mort.mjs` | Enveloppe ES module (`import { MachineDeMort } from './machine-de-mort.mjs'`), à garder à côté du `.js` | Si le jeu utilise des modules ES |
| `machine-de-mort/LICENCE-Teko-OFL.txt` | Licence de la police intégrée au HUD (la même que le HUD des points) | **Oui** |
| `demo.html` + `vendor/` | Démo jouable (stand de tir de nuit) : intégration de référence. `vendor/` contient Three.js r128, `survivant.js`, `survivant-matieres.js` et la carabine de démonstration du paquet d'Anthony | Non |
| `sons/` | Les sons en fichiers séparés (WAV et MP3) et `apercu-machine-de-mort.mp3` (écoute d'un cycle complet). Ils sont déjà dans le `.js` | Non (sauf pour les charger par URL, option `chemin`) |
| `captures/` | Rendus du modèle, du bonus, de la vue FPS et du HUD | Non |
| `sources/` | Sources découpées, script d'assemblage, synthèse des sons (Python), tests | Non |
| `INTEGRATION.md`, `LICENCES.md`, `LICENCE-voix-M-AILABS.txt` | Ce document, licences | Non |

Three.js est passé en paramètre. Testé en r128 (la version du jeu) ; les versions r150+ ne sont pas testées (les espaces de couleur sont gérés, mais l'intensité des lumières et certains blocs de shaders ont changé depuis). Aucune autre dépendance. Les bras FPS sont ceux du paquet `anthony-realiste` (`createSurvivorArms`), déjà dans le jeu.

## Ordre de travail

1. Lire ce document, puis `demo.html` (environ 60 lignes utiles autour de `MachineDeMort.creer` et de la boucle). La tester servie en HTTP (`py -m http.server 8000`, puis `http://localhost:8000/demo.html`).
2. Explorer le jeu et noter, sans rien modifier :
   - le **système de bonus existant** (« Munitions max », « Mort instantanée »…) : table de tirage, apparition au sol, durée de vie, ramassage, annonceur, liste des identifiants (chercher `powerup`, `bonus`, `drop`, `pickup`, `munitions-max`) ;
   - le **système d'armes** : arme courante, changement, rechargement, visée, tir, modèle de vue (`viewmodel`), appel de `arms.update` ;
   - le **tir et les dégâts** : fonction de rayon (raycast/hitscan), dégâts aux zombies, multiplicateurs (tête, Mort instantanée, Double points), points gagnés ;
   - le **HUD des munitions** de l'arme ;
   - l'audio : instance `audio-zombies` (annonceur), gain des sons du jeu (celui qui reçoit `onDuck`) ;
   - la caméra FPS (`MouvementCoD.applyViewmodel`, champ de vision), la mort et l'état « à terre », la coopération.
3. Présenter à Anthony un plan court qui branche la Machine de mort sur ces systèmes sans en recréer de parallèles. Puis intégrer étape par étape (§4).
4. Vérifier chaque point de la section « Critères de validation » et lui rapporter le résultat.

## 4. Intégration pas à pas

### 4.1 Charger le script

```html
<script src="js/machine-de-mort/machine-de-mort.js"></script>   <!-- après three.js et survivant.js -->
```

Modules ES / Vite : `import { MachineDeMort } from './machine-de-mort/machine-de-mort.mjs';` (l'import du `.js` définit aussi les globaux).

### 4.2 Créer l'instance une seule fois, au lancement de la partie

Après la création du renderer, de la scène, de la caméra et des bras FPS :

```js
const mdm = MachineDeMort.creer({
  THREE, renderer, scene, camera,
  bras: arms,                              // createSurvivorArms(...) du jeu
  qualite: reglages.qualite === 'basse' ? 'basse' : 'haute',
  annonceur: sons,                          // instance audio-zombies : dit « Machine de mort ! » au ramassage
  sons: { contexte: sons.context, sortie: gainSonsDuJeu },   // même AudioContext, gain qui reçoit onDuck
  jeu: {
    tirer: (t) => tirHitscan(t),           // voir 4.3
    rangerArme: () => armes.ranger(),       // annule rechargement et visée, cache l'arme de vue du joueur, bloque son tir
    ressortirArme: (raison) => armes.ressortir(),
    sol: (x, z) => hauteurDuSol(x, z),      // douilles ; facultatif
  },
});
mdm.prechauffer();                          // compile les shaders maintenant (pas d'à-coup au premier bonus)
```

Une seule instance par joueur local. Retour au menu : `mdm.dispose()`, puis recréer à la partie suivante.

### 4.3 Brancher le tir sur le système de dégâts du jeu

`jeu.tirer(t)` est appelée **à chaque coup** (jusqu'à 30 fois par seconde) avec :

| Champ | Valeur |
|---|---|
| `t.origine` | position de la caméra (`THREE.Vector3`, repère du monde) |
| `t.direction` | direction normalisée, dispersion de 2° déjà appliquée |
| `t.degats` | 150 par défaut |
| `t.portee` | 120 m |
| `t.penetration` | 2 : nombre de zombies qu'une balle peut traverser |
| `t.numero`, `t.arme` | numéro du coup, `'machine-de-mort'` |

Elle doit réutiliser la fonction de tir existante (rayon, dégâts, multiplicateurs, points, sang, réactions des zombies) et renvoyer le premier impact visible, ou `null` :

```js
function tirHitscan(t) {
  const r = armes.lancerRayon(t.origine, t.direction, t.portee, { penetration: t.penetration });
  for (const z of r.zombies) zombies.blesser(z, t.degats, { arme: t.arme, point: z.point, tete: z.tete });
  if (!r.premier) return null;
  return { point: r.premier.point, normale: r.premier.normale, type: r.premier.zombie ? 'chair' : 'metal' };  // 'chair' | 'metal' | 'sol' | 'bois'
}
```

Le paquet dessine les traçantes (de la bouche des canons jusqu'au point renvoyé), les étincelles et la poussière. Le sang et les impacts sur les zombies restent ceux du jeu ; si le jeu dessine déjà ses impacts sur le décor, passer `tir: { impacts: false }`.

Les **dégâts** (150) sont calés sur l'échelle CoD (150 PV à la manche 1). Les adapter à la vie des zombies du jeu et le dire à Anthony : `tir: { degats: … }`.

### 4.4 Le bonus « Machine de mort » dans le système de bonus existant

Ajouter `'machine-de-mort'` à la table de tirage des bonus avec la même logique que les autres (probabilité, limite par manche, durée au sol). Au moment où le jeu fait apparaître ce bonus :

```js
mdm.faireApparaitreBonus(position, { duree: DUREE_BONUS_AU_SOL });   // position au sol (Vector3), durée de vie au sol en s
```

Le paquet s'occupe du bonus au sol : miniature dorée, halo, colonne de lumière, étincelles, clignotement des 7 dernières secondes, son au sol, ramassage par contact (1,15 m), éclair, son de ramassage, annonce, bannière, et il donne l'arme. Le jeu n'a rien d'autre à faire pour ce bonus.

Si le jeu doit garder **son** objet au sol pour tous les bonus (un seul code de ramassage), il peut afficher la miniature dorée du paquet et donner l'arme lui-même au ramassage :

```js
const icone = MachineDeMort3D.iconeDoree(THREE, renderer).arme.objet.clone();   // géométries et matériau partagés
// … au ramassage :
mdm.activer({ annonce: true });   // annonce: true seulement si le jeu ne fait pas déjà parler l'annonceur
```

Le bonus doit être visible pour tous les joueurs, mais seul celui qui le ramasse reçoit l'arme. En coopération : `mdm.maj(dt, { joueurs: [positions], indexLocal })` ; l'évènement `bonus-ramasse` donne l'index du joueur qui l'a pris. Les bonus **Bunker 7** (paquet du boss) qui appellent `faireApparaitreBonus({ type: 'machine-de-mort', … })` passent par le même chemin.

### 4.5 Boucle de jeu (à chaque image)

```js
mdm.maj(dt, {
  tir: entree.tirEnfonce,                         // clic gauche maintenu
  bloque: !mouvementOut.weapon.canFire || menuOuvert,   // sprint, glissade, menus : le rotor ralentit, aucun coup
  vitesse: vitesseHorizontale,                    // balancement de l'arme
  joueur: joueur.positionPieds,                   // ramassage du bonus
  pause: jeuEnPause,                              // fige le minuteur et le bonus au sol
});
```

Tant que `mdm.actif` est vrai :

- ne **pas** appeler le tir, le rechargement, la visée ni le changement d'arme du jeu (`mdm.peutChangerArme === false`) ; bloquer aussi le couteau, les grenades et les objets tactiques (les deux mains tiennent la Machine de mort) ;
- ne **pas** appeler `arms.update` avec l'arme du jeu : le paquet place lui-même les mains sur la Machine de mort (poignée arrière `'pistol'`, poignée avant `'support'`) ;
- multiplier la vitesse de déplacement par `mdm.vitesseDeplacement` (0,88 ; 1 hors usage) ;
- facultatif : ajouter `mdm.secousse.tangage` et `mdm.secousse.lacet` (radians) à la caméra.

**Vue FPS.** L'arme est dans `mdm.vue`, enfant de la caméra, posée à la hanche (`[0.165, -0.275, -0.33]`, réglée pour 72° de champ vertical). Si le jeu applique son balancement avec `MouvementCoD.applyViewmodel`, créer l'instance avec `vue: { geree: true }` et appeler `MouvementCoD.applyViewmodel(mdm.vue, out, POSITION_HANCHE_MDM)` avec `POSITION_HANCHE_MDM = new THREE.Vector3(0.165, -0.275, -0.33)`. Les animations propres (sortie, rangement, vibration, recul, inertie) sont dans un groupe enfant et s'ajoutent.

### 4.6 Perte immédiate

```js
mdm.perdre('a-terre');   // joueur à terre, mort, fin de partie, téléportation, cinématique
```

L'évènement `fin` part avec la raison donnée, puis `jeu.ressortirArme(raison)` est appelée. À la réanimation, le joueur retrouve son arme, pas la Machine de mort.

### 4.7 Interface

Le paquet affiche, pendant l'usage : en bas à droite « MACHINE DE MORT », le compteur 700 → 0 (rouge sous 100) et la barre du temps ; en bas au centre l'icône dorée du bonus actif et son minuteur (elle clignote les 5 dernières secondes) ; une bannière au ramassage ; un viseur de dispersion si `hud: { viseur: true }`. **Masquer l'affichage des munitions de l'arme du jeu** pendant ce temps (pas de double compteur) :

```js
mdm.on('debut', () => hudArme.cacher());
mdm.on('fin', () => hudArme.montrer());
```

Si le jeu a sa propre rangée d'icônes de bonus actifs, la Machine de mort doit y figurer à la place de l'icône du paquet : `hud: { icone: false }` et afficher `MachineDeMortHud.ICONE` (image dorée, data URL) avec `mdm.tempsRestant`.

### 4.8 Sons

Sons synthétisés pour le jeu : 6 variantes de coup (30 par seconde), moteur et rotor dont la hauteur suit le régime (montée en 0,32 s, descente en 1,3 s), écho de fin de rafale, démarrage, clic à vide, sortie et rangement, douilles, ramassage, boucle du bonus au sol (atténuée avec la distance). Les brancher sur le **même AudioContext** que le jeu et sur le **gain des sons du jeu** (celui qu'`onDuck` baisse pendant les annonces) : `sons: { contexte, sortie }`. Volume : `mdm.sons.setVolume(v)` (canal effets des options).

### 4.9 Troisième personne et coopération (facultatif)

Pour le corps d'Anthony (ombre, coéquipiers) : un second modèle `MachineDeMort3D.creerArme(THREE, { renderer, qualite: 'basse' })` accroché avec `hero.setWeapon(arme2.objet, …)` tant que `mdm.actif`. La pose des bras du corps reste celle d'une arme lourde tenue à la hanche (`armed: true, aim: false`).

## 5. API

### `MachineDeMort.creer(options)`

| Option | Défaut | Rôle |
|---|---|---|
| `THREE`, `renderer`, `scene`, `camera` | — | obligatoires (la caméra doit être dans la scène) |
| `bras` | `null` | bras FPS d'Anthony ; sans eux l'arme flotte seule |
| `qualite` | `'haute'` | `'basse'` : moins de segments, matériau simplifié, moins de particules |
| `config` | §7 | règles (durée, munitions, cadence…) |
| `tir` | `{ degats: 150, portee: 120, penetration: 2, dispersion: 0.035, traceuseTous: 3, impacts: true }` | dispersion en radians (demi-angle) ; une traçante tous les 3 coups |
| `vue` | `{ position: [0.165, -0.275, -0.33], rotation: [0.05, 0.09, -0.04], geree: false }` | position de hanche dans le repère de la caméra |
| `jeu` | `{}` | `tirer(t)`, `rangerArme()`, `ressortirArme(raison)`, `sol(x, z)`, `joueur()` |
| `sons` | créé | `false`, une instance `MachineDeMortSons`, ou `{ contexte, sortie, volume }` |
| `hud` | créé | `false` ou `{ parent, icone, panneau, banniere, viseur, alerteMunitions: 100, alerteTemps: 5 }` |
| `annonceur` | `null` | objet avec `annonce(id)` (l'instance `audio-zombies`) |
| `vitesseDeplacement` | `0.88` | multiplicateur exposé par `mdm.vitesseDeplacement` |
| `lumiereBouche` | `true` | lumière de bouche (une `PointLight` ajoutée **une fois** à la scène, éteinte hors tir : aucune recompilation) |

### Instance

| Membre | Rôle |
|---|---|
| `maj(dt, { tir, bloque, vitesse, joueur, joueurs, indexLocal, pause })` | à chaque image ; renvoie `{ tirs: [décalages], tir }` |
| `activer({ annonce })` | donne l'arme (`'debut'`) ou renouvelle (`'renouvele'`) |
| `perdre(raison)` | retire l'arme tout de suite |
| `pause(oui)` | fige le minuteur |
| `faireApparaitreBonus(position, { duree, rayon, hauteur, lumiere })` | bonus au sol ; renvoie l'objet bonus |
| `bonus`, `viderBonus()` | bonus au sol en cours ; les retirer (fin de partie) |
| `actif`, `etat` | `'inactive'`, `'sortie'`, `'active'`, `'vide'`, `'rangement'` |
| `munitions`, `tempsRestant` | état courant |
| `peutChangerArme`, `vitesseDeplacement`, `secousse` | pour les systèmes du jeu |
| `vue`, `arme`, `effets`, `logique`, `sons`, `hud` | sous-objets (réglages fins) |
| `on(nom, fn)` | renvoie une fonction de désabonnement |
| `prechauffer()`, `dispose()` | compilation à l'avance ; libération |

Évènements : `debut` `{ duree, munitions }` · `prete` · `tir-debut` · `tir-fin` `{ chaleur }` · `vide` · `expire` · `rangement` `{ raison }` · `fin` `{ raison: 'vide' | 'expire' | raison de perdre, tirs }` · `renouvele` · `bonus-apparu` · `bonus-ramasse` `{ index, position }` · `bonus-expire`.

### Modules utilisables seuls

- `MachineDeMortLogique.creer(config)` : règles sans rendu (fonctionne sous Node) ; `activer`, `perdre`, `pause`, `maj(dt, { detente, bloque })`, mêmes évènements, `presence` (0 → 1 à la sortie).
- `MachineDeMort3D.creerArme(THREE, { renderer, qualite, dore })` : `objet`, `rotor`, `ancres.droite` / `ancres.gauche`, `bouche`, `ejection`, `afficheur`, `maj(dt, { regime, chaleur, munitions, avance, tir })`, `stats`, `dispose()`. Repère glTF des armes du jeu : +Z avant, +Y haut, origine au centre de la poignée arrière ; en vue FPS `objet.rotation.y = Math.PI`.
- `MachineDeMort3D.creerBonus(THREE, { renderer, scene, position, duree })`, `iconeDoree(THREE, renderer)`, `creerEffets(THREE, { scene })`, `environnementSecours(THREE, renderer)`.
- `MachineDeMortSons.creer({ contexte, sortie })`, `MachineDeMortHud.creer({ parent })`.

## 6. Modèle 3D

- Mitrailleuse « MDM-6 », 0,93 m : 6 canons Ø 25 mm sur colliers en fleur, rotor animé, pare-chaleur ajouré, carter et bloc arrière (vert armée, ouïes, plaque signalétique, câble, moteur à ailettes), boîte de 700 cartouches 7,62 × 51 avec pochoirs, bande de cartouches animée qui avance à chaque coup et disparaît à la fin du chargeur, compteur rouge à 7 segments visible du joueur, poignée de transport sur le dessus.
- Matières procédurales sans texture ni UV : usure sur les arêtes (peinture écaillée, métal poli), crasse dans les creux, poussière sur le dessus, grain du métal, suie à la bouche, canons qui rougissent après une dizaine de secondes de tir.
- ≈ 63 000 triangles et 15 appels de dessin en qualité haute ; ≈ 44 000 en basse. Bonus au sol : miniature allégée (≈ 35 000 triangles, géométries partagées entre tous les bonus) et ≈ 16 appels de dessin avec le halo, la lueur au sol, la colonne et les étincelles.
- Effets : flamme de bouche (3 plans + étoile), lumière de bouche, traçantes (un seul maillage), douilles (une instance), fumée et étincelles (sprites recyclés). Rien n'est créé pendant le tir.

## 7. Réglages (`config`)

| Clé | Défaut | Effet |
|---|---|---|
| `duree` | `30` | secondes à partir du ramassage |
| `munitions` | `700` | chargeur unique |
| `cadence` | `1800` | coups par minute ; autonomie en tir continu = munitions / (cadence / 60) |
| `montee` / `seuilTir` / `descente` | `0.32` / `0.8` / `1.3` | rotor : montée en régime, régime minimal pour tirer, arrêt |
| `sortie` / `rangement` / `delaiVide` | `0.6` / `0.55` / `0.75` | animations ; rotation à vide avant le rangement |
| `chauffe` / `refroidissement` | `0.085` / `0.16` | chaleur des canons (rouge à partir de 35 %) |
| `renouvellement` | `'recharger'` | second bonus pendant l'usage : `'recharger'` (30 s et 700) ou `'prolonger'` (+30 s) |

## 8. Critères de validation (à vérifier et rapporter à Anthony)

| # | Critère | Comment vérifier |
|---|---|---|
| 1 | Chargement | aucune erreur ni avertissement `MachineDeMort` dans la console ; `typeof MachineDeMort.creer === 'function'` ; `mdm.sons.charger()` résout `{ charges: 18, total: 18 }` |
| 2 | Tirage | le bonus « Machine de mort » sort comme les autres bonus (forcer son tirage pour le test) |
| 3 | Bonus au sol | miniature dorée qui tourne, halo et colonne verts, étincelles ; clignote les 7 dernières secondes puis disparaît |
| 4 | Ramassage | au contact : éclair, son, « Machine de mort ! » une seule fois, bannière ; l'arme du joueur se range, la Machine de mort sort en 0,6 s |
| 5 | Mains | `arms.anchors.right` à moins de 5 mm de `mdm.arme.ancres.droite`, `arms.anchors.left` à moins de 1 cm de `mdm.arme.ancres.gauche` (0 mm mesuré dans la démo) |
| 6 | Tir | clic maintenu : le rotor monte en régime (≈ 0,26 s) puis 30 coups/s, traçantes, flamme, douilles, compteur de l'arme et du HUD qui baissent ; les zombies prennent les dégâts du jeu |
| 7 | Arrêt | détente lâchée : écho, rotor qui ralentit, fumée si les canons sont chauds |
| 8 | Chargeur vide | à 0 : clic à vide, rotation à vide, rangement ; l'arme d'avant revient avec ses munitions |
| 9 | Minuteur | sans tirer, rangement à 30 s ; la barre et l'icône clignotent sous 5 s |
| 10 | Blocages | pendant l'usage : pas de changement d'arme, de rechargement, de visée, de couteau ni de grenade ; le sprint coupe le tir (`bloque`) |
| 11 | Perte | joueur à terre : l'arme disparaît tout de suite ; après réanimation, arme d'avant |
| 12 | Renouvellement | second bonus ramassé pendant l'usage : 30 s et 700 |
| 13 | HUD | le compteur de munitions du jeu est caché pendant l'usage, puis revient |
| 14 | Sons | branchés sur le gain des sons du jeu : ils baissent pendant les annonces |
| 15 | Performances | pas d'à-coup au premier ramassage (`prechauffer`) ; 60 i/s visées en tir continu sur la machine d'Anthony |

## 9. Tests fournis

- `node sources/tests/test-logique.js machine-de-mort/machine-de-mort.js` : 32 vérifications des règles (700 coups exacts, vide à 24,2 s en tir continu, expiration à 30 s, rangement, renouvellement, perte, pause, blocage, indépendance à la fréquence d'images 30/60/144 i/s).
- `node sources/tests/test-demo.js http://localhost:8000/demo.html captures` (Playwright) : démo sans erreur, bonus ramassé, 700 cartouches, mains sur les ancres, tir, perte, vitrine.

## 10. Dépannage

- **Arme noire ou terne** : pas d'environnement. `scene.environment = Survivant.createEnvironment(THREE, renderer)` (le paquet crée un environnement de secours sinon).
- **À-coup au premier bonus** : appeler `mdm.prechauffer()` après le chargement.
- **Plus de lumières / scène plus lente après le premier tir** : la lumière de bouche est créée une fois à l'appel de `creer` ; ne pas recréer l'instance à chaque bonus.
- **Une main ne tient pas l'arme** : `vue.position` trop loin (portée du bras ≈ 0,60 m) ; garder les valeurs par défaut ou rapprocher en `z`.
- **Deux armes à l'écran** : `jeu.rangerArme` doit cacher le modèle de vue du jeu ; vérifier aussi l'arme tenue par le corps (`hero.setFirstPerson(true)`).
- **Double annonce** : l'annonceur parle déjà dans le code de ramassage générique du jeu → ne pas passer `annonceur` (ou `activer()` sans `annonce`).
- **Pas de son** : AudioContext suspendu (règle des navigateurs) ; il démarre au premier clic si c'est celui du jeu.

## 11. Erreurs à éviter

- Ajouter la Machine de mort à l'inventaire, au cycle des armes ou à la boîte mystère : elle n'existe que par le bonus.
- La recharger, lui donner une réserve, autoriser la visée.
- Créer une nouvelle instance à chaque bonus (fuite de mémoire, recompilation) : une instance par partie.
- Reformater ou réécrire `machine-de-mort.js` à la main : modifier les sources de `sources/src/` et reconstruire (commandes dans `sources/README.md`).
