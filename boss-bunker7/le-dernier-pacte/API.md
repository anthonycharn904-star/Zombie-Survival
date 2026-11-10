# Boss de Bunker 7 — contrats entre modules (interne, fait foi)

Modules (dossier `boss/src/`), tous en JS sans dépendance (Three.js passé en paramètre quand il faut),
script classique (globalThis.X) + CommonJS (module.exports). Style : ES5/ES2015 simple, `'use strict'`,
noms et commentaires en français, aucune valeur d'équilibrage en dur (tout vient de `config.js`).

| Fichier | Global | Rôle |
|---|---|---|
| `config.js` | `BOSS_B7_CONFIG` | réglages (fait) |
| `arene.js` | `BOSS_B7_ARENE` | données de la salle (fait) |
| `logique.js` | `BossB7Logique` | machine à états du combat, indépendante du rendu (Node OK) |
| `modele/*.js` → `boss-modele.js` | `BossB7Modele` | corps 3D, squelette, ailes, lames, animations |
| `fx.js` | `BossB7Fx` | effets visuels (particules, sorts, âmes, débris, cercle, obscurité…) |
| `audio.js` | `BossB7Audio` | sons et musique (Web Audio) |
| `hud.js` | `BossB7Hud` | interface (DOM) |
| `proto/*.js` | `ProtoB7*` | mini-moteur du prototype : monde, navigation, joueur, zombies, bots, adaptateur |

## 1. Logique : `BossB7Logique.creerCombat(options)`

```js
const combat = BossB7Logique.creerCombat({
  config: BOSS_B7_CONFIG,     // cloné en interne ; options.surcharges = objet fusionné par-dessus (optionnel)
  arene: BOSS_B7_ARENE,
  jeu: adaptateur,            // §3
  graine: 1939                // optionnel (sinon config.general.graine)
});
combat.demarrer();            // appelé par la quête quand toutes les conditions sont remplies
combat.mettreAJour(dt);       // chaque image ; pas fixe interne (config.general.pasLogique)
combat.toucherBoss({ joueur, degats, zone: 'tete'|'corps', position, type: 'balle'|'explosif'|'melee' })
  // → { applique: bool, montant: nombre appliqué, raison: 'absent'|'invulnerable'|null }
combat.interagir(joueurId, maintenu: bool, dt)   // maintien de la touche d'interaction près du cadavre
combat.etat()                 // instantané sérialisable (§2) — l'affichage lit uniquement ça + les évènements
combat.on(type, fn) → off     // évènements (§4)
combat.allerA(etat)           // DEBUG : saute à un état (prépare ce qu'il faut : PV, lieu, ailes…)
combat.forcer(cle, valeur)    // DEBUG : ex. forcer('ames', 9), forcer('pvSegment', 1)
combat.detruire()
```

Toute la logique raisonne dans le repère MONDE : positions de la salle = `arene.salle.origine` + local.
Aléatoire : générateur à graine interne (mulberry32) ; jamais Math.random.

## 2. Instantané `combat.etat()`

```js
{
  etat: 'inactif'|'introduction'|'phase1'|'repit'|'phase2'|'transition23'|'absence'|'retour'|'phase3'
      |'transition34'|'rituel'|'rituel_fin'|'faiblesse'|'transition45'|'phase5'|'defaite'
      |'retour_salle'|'conclusion'|'recompenses'|'message'|'termine'|'echec',
  phase: 0..5,                // numéro affiché (0 = intro / fini)
  tempsEtat: s,
  compteARebours: s | null,   // répit 15, absence 30…
  controleJoueurs: bool,      // false pendant les séquences scénarisées
  lieu: 'salle'|'bunker',     // où se déroule l'action (rendu : quelle scène afficher)
  boss: {
    present: bool, visible: bool, lieu,
    position: {x,y,z},        // point au niveau des PIEDS du modèle (origine du modèle)
    lacet: rad,               // 0 = regarde +Z
    vitesse: {x,y,z},
    locomotion: 'aucune'|'levitation'|'ailes'|'rage'|'affaibli'|'traque'|'intangible'|'mort',   // v1.5 : 'intangible' (§17.3)
    action: null | { id, etape, t, duree, progression, cible: {x,y,z}|null, cibleJoueur: id|null, donnees: {} },
    vulnerable: bool, multiplicateur: nombre,
    protege: bool,            // v1.3 : un mini-boss est libéré ou va l'être (§15.2) : vulnerable = false, toucherBoss refusé
    palier: 0..3 | null,      // v1.4 (§16.5) : palier de la jauge, acquis ; null hors phase 5 et défaite
    couleurLames: 'bleu'|'rouge'|null,   // v1.4 : palier 0 → 'bleu', ≥ 1 → 'rouge' ; null hors phase 5 et défaite
    intangible: bool,         // v1.5 (§17.3) : invisible (visible = false), traverse les murs, toucherBoss → 'absent'
    puissance: 0..1,          // âmes / âmes nécessaires (aspect visuel)
    ames: entier,
    ailes: 'absentes'|'apparition'|'deployees'|'dissipation',
    lames: 'absentes'|'formation'|'actives'|'desintegration',
    affaiblissement: 0..1,    // usure visuelle dans la phase en cours (0 = intact)
    regard: {x,y,z} | null    // point que la tête doit regarder
  },
  barre: { visible, segments: [pvMax par segment], segment: index, valeur, max, titre },  // barre de vie
  capture: null | { etat: 'formation'|'libre'|'capture'|'conteste'|'recul'|'termine', progression: 0..1,
                    joueursDedans, zombiesDedans, regle },
  jauge: null | { valeur: 0..1, enBaisse: bool, gelee: bool },
  vision: 0..1,               // intensité de l'obscurité (phase 5)
  blocs: [ { id (= id de la dalle), etat: 'fissure'|'arrache'|'levitation'|'vol'|'impact'|'absent'|'reconstruction',
             position, rotation: {x,y,z} (Euler XYZ), t, cibleJoueur, pointImpact } ],
  projectiles: [ { id, type: 'invocation'|'trait', position, vitesse, cible } ],
  zones: [ { id, position, rayon, etat: 'marquee'|'active'|'fin', t, duree } ],
  ames: [ { id, zombieId, depart:{x,y,z}, t, duree } ],     // âmes en vol vers le boss
  pique: null | { depart, arrivee, etape, cibleJoueur },     // ligne de visée du piqué
  joueurs: { [id]: { critique: bool, invulnerableJusqua: s, immuniteFrappeJusqua: s, recompense: bool } },   // v1.4 : immuniteFrappeJusqua toujours 0
  interaction: null | { position, rayon, progression: 0..1, joueur, texte },
  message: null | { lignes, t, duree },
  recompenses: { [joueurId]: [ { type: 'arme'|'atout'|'bonus', id, donne: bool, repli } ] },
  secondeMoitie: bool,        // v1.2 : PV de la phase 1 passés sous phase1.secondeMoitie.seuil (double sort, meute)
  meute: null | { active, max, chiens: [ { id, position, lieu } ],              // v1.2 (§14.3)
                  failles: [ { id, position, lieu, t (s depuis l'ouverture), duree } ] },
  tubes: [ { id, etat: 'intact'|'siphon'|'fissure'|'eclate', miniBoss: 'survolte'|'irradie'|'demembre', t } ],   // v1.3 (§15.1), v1.4 : 3 cuves
  miniBoss: [ { id, type, nom, couleur, pv, pvMax, etat: 'actif'|'mort', position, lieu,           // v1.3 (§15.2) ; mort : 3 s, pv 0
                rage: null | { capacite: 'surcharge'|'infection'|'arrachement', actif, t },     // v1.5 (§17.1) : actif après duree s
                invulnerable: bool } ],                                                        // v1.5 : pendant duree (surcharge, arrachement)
  illusions: [],              // v1.5 (§17.3) : toujours vide (illusions de la v1.4 retirées ; clé gardée pour la compatibilité)
  crochets: [ { id, joueur, depart, position, etat: 'vol'|'accroche'|'traction'|'rate' } ],          // v1.4 (§16.5), palier 3
  murs: null | { etat: 'charge'|'electrifies'|'extinction', t, distance },   // v1.5 (§17.1) : murs du Survolté (t depuis le changement)
  infection: null | { active: bool, ids: [zombieIds] },  // v1.5 : rage de L'Irradié (active à la fin du cri ; ids = entités irradiées)
  bras: null | { etat: 'vol'|'pose'|'fletri', position, t },   // v1.5 : bras du Démembré (null tant qu'il l'a en main ; fletri : 3 s)
  petits: [zombieIds],        // v1.5 : petits Démembrés vivants (sortis du bras)
  temps: s                    // horloge de la logique
}
```

## 3. Adaptateur `jeu` (fourni par le jeu ; le prototype en fournit un)

Obligatoires :
```js
joueurs() → [ { id, position:{x,y,z}, vitesse:{x,y,z}, lacet, vivant, aTerre, lieu, pvFraction } ]
infligerDegats(id, fraction, { source, ignorerReductions }) // fraction des PV max
blessureCritique(id, fractionRestante)    // PV = min(PV actuels, fraction × PV max) ; ne tue jamais
teleporter(id, position, lacet, lieu)
controle(id, actif)                       // bloque / rend les commandes
invulnerable(id, actif)
faireApparaitreZombie({ position, lieu, effet: 'emergence'|'breche'|'normal'|'faille', source: 'boss',
                        vitesse, agressif,                 // v1.1 : 'sprint', true
                        type, profil }) → zombieId|null    // v1.2 : type 'chien' + profil { pv, vitesse, degats, cadence, portee }
                        // v1.3 : effet 'cuve', type 'survolte'|'irradie', miniBoss: true, nom, profil (config.miniBoss[type] + pv, pvMax)
                        // v1.4 : type 'demembre' en plus ; profils avec decharge.multi/etourdissement, boules, fleau (§16.1, §16.2)
                        // v1.5 : profils avec rage, echelle, charge, petits (§17.1) ; type 'demembre_petit' (petit Démembré, pas
                        //        un mini-boss) : effet 'bras', source 'boss', profil = miniBoss.demembre.petits.profil, 'sprint', agressif
                        // v1.5 (livraison) : zombies du combat : pv = config.zombies.pv (PV à l'échelle de DPS_REFERENCE, à utiliser à
                        //        la place des PV de la manche ; absent si config.zombies.pv est null)
zombies() → [ { id, position, vivant, lieu, type?, pv?, pvMax? } ]   // type facultatif : 'zombie' | 'chien' | 'demembre_petit' | type de
                                                           // mini-boss ; v1.3 : pv et pvMax obligatoires pour les mini-boss (barres
                                                           // de PV ; v1.5 : rages à seuil × pvMax)
effetZombie(id, effet, params)            // 'saisie' (immobilisé, résiste), 'extraction' (âme arrachée), 'relache'
                                          // v1.5 (§17.1), mini-boss : 'surcharge' { duree, source }, 'infection' { duree, aura, couleur },
                                          // 'arrachement' { duree, vol, cible } (+ reprise: true, duree restante, s'il a été remis
                                          // devant sa cuve après sa rage) ; zombies, chiens, petits : 'irradie' { actif, aura?, couleur? }
retirerZombie(id, { effet: 'cendres'|'absorbe'|'silencieux'|'effondrement', points: false })   // v1.5 : 'effondrement' (petits Démembrés)
```
Optionnelles (valeurs par défaut sûres si absentes) :
```js
regarder(id, point, duree)                // tourne la caméra vers un point (séquences ; v1.4 : joueur accroché par un crochet)
tirerJoueur(id, position)                 // v1.4 : traction d'un crochet, appelée à chaque pas ; défaut : teleporter(id, position, lacet, 'bunker')
chemin(depart, arrivee, lieu) → [points]|null   // navigation ; défaut : ligne droite
positionValide(p, lieu) → bool
visible(a, b, lieu) → bool                // ligne de vue (v1.5 : aussi les murs traversés par le Septième intangible, §17.3)
apparitionsNormales(actif, { max, intervalle, lieu }) → bool   // false = le jeu ne sait pas : la logique s'en charge
suspendreManches(actif)
listeAtouts() → [ids]
donnerArme(id, armeId, { pap }) → bool    // false = inventaire plein → repli autel
donnerAtout(id, atoutId) → bool
activerBonus(bonusId, { joueur })         // repli des bonus posés (v1.1 fin de phase, v1.5 mort d'un mini-boss)
faireApparaitreBonus({ type, position, lieu, duree }) → bool   // v1.1 (§13) bonus de fin de phase ; v1.5 (§17.2) à la mort d'un mini-boss
deposerRecompense({ type, id, pap, position, joueur })   // autel
lireDrapeau(cle) → bool ; ecrireDrapeau(cle, valeur)
pointsBunker(type) → [points]             // 'arrivee'|'boss'|'retour'|'zombies' ; défaut : arene.bunker7
journal(niveau, message)
```

## 4. Évènements `combat.on(type, fn(detail))`

`etat` {de, vers} · `phase` {numero} · `titre` {texte, sousTexte, duree} · `action` {id, etape, cible, cibleJoueur} ·
`degats` {montant, multiplicateur, joueur, position, zone, restant} · `immunise` {joueur, position} ·
`segment` {index} (barre : segment vidé) · `projectile` {id, type, position, cible} · `projectileImpact` {id, type, position} ·
`zone` {id, position, rayon} · `zoneFin` {id} · `invocation` {zombieId, position} ·
`absorption` {etat: 'debut'|'fin', cibles} · `ameExtraite` {zombieId, position} · `ameAbsorbee` {ames, besoin} ·
`ailes` {etat} · `pique` {etape, depart, arrivee, cibleJoueur} · `piqueImpact` {position, touches} ·
`teleport` {sens: 'depart'|'arrivee', position, lieu} · `zombiesCendres` {ids} ·
`bloc` {id, etat, position} · `blocImpact` {id, position, touches} · `ondeChoc` {position, rayon, touches} ·
`rituel` {etat} · `capture` {etat} · `joueurTouche` {joueur, source, fraction} · `frappe` {joueur, reussie, speciale, palier} ·
`critique` {joueur, actif} · `obscurite` {intensite} · `lames` {etat} · `cinematique` {nom, actif} ·
`defaite` {} · `interaction` {etat: 'disponible'|'progression'|'terminee', joueur} ·
`recompense` {joueur, type, id, donne, repli} · `message` {lignes, duree} · `fin` {} · `echec` {raison} ·
`avertissement` {texte} · v1.1 : `pilier` {id, etat, coups, position, pointImpact} · `bonus` {type, position, lieu, phase, mode} ·
v1.2 : `meute` {etat: 'dechainee'|'dissipee', max} · `chien` {etat: 'faille'|'apparition'|'mort'|'fin', id, position, lieu,
faille? (id de la faille, sur `apparition`), raison? ('transfert'|'defaite'|'echec'|'bloque'|'debogage', sur `fin`)} ·
v1.3 : `tube` {id, etat: 'siphon'|'fissure'|'eclate', position, miniBoss} · `miniBoss` {etat: 'libere'|'mort', id, type, nom,
position, lieu, pvMax? (sur `libere`)} · `protection` {actif, miniBoss} (`actif: true` à la libération ; `actif: false` à la mort
du mini-boss, et aussi sur `allerA`, `echec` ou apparition refusée) ·
v1.4 : `palier` {numero, couleurLames} · `crochet` {etat: 'lancer'|'accroche'|'rate'|'arrivee', id, joueur, position, raison?
('mur'|'esquive', sur `rate`)} (`illusion` : retiré en v1.5) ·
v1.5 (§17) : `miniBoss` {etat: 'rage', id, type, nom, position, capacite} · `murs` {etat: 'charge'|'electrifies'|'extinction'|'eteints'} ·
`mursChoc` {joueur, position, mur (id du mur, 'mur0'…'mur7')} · `infection` {etat: 'debut'|'fin', nombre} · `bras` {etat: 'arrache'|
'lance'|'pose'|'fletri', position} · `petitDemembre` {etat: 'apparition'|'effondrement', id, position} · `intangible` {etat: 'debut'|
'traversee'|'fin', position} · `bonus` : + `source` ('phase'|'miniBoss') et `miniBoss` (type, sur `source: 'miniBoss'`)

## 5. Actions du boss (`etat().boss.action`) — les durées viennent de la config

| id | étapes dans l'ordre |
|---|---|
| `apparition` | `formation`, `presentation` |
| `invocation` | `preparation`, `lancer`, `recuperation` (cible = point au sol) ; v1.2, seconde moitié de la phase 1 : `preparation`, `lancer`, `preparation` (donnees.second), `lancer`, `recuperation` (donnees : double, second, ecart) |
| `trait` | `preparation`, `lancer`, `recuperation` (cibleJoueur) |
| `souffrance` | `souffrance`, `colere` (fin de phase 1) |
| `recharge` | `boucle` (répit) |
| `absorption` | `saisie`, `extraction`, `fin` (donnees.cibles = zombieIds) |
| `transformation_ailes` | `cambrure`, `deploiement`, `rugissement` |
| `pique` | `montee`, `visee`, `charge`, `impact`, `etourdi`, `retour` |
| `effondrement` | `souffrance` (fin de phase 2 et 3, avant `teleport_depart`) |
| `teleport_depart` | `implosion` |
| `teleport_arrivee` | `apparition` |
| `retour_rage` | `descente`, `deflagration`, `rugissement` |
| `arrachement` | `designation`, `fracture`, `levitation`, `projection`, `recuperation` (donnees.bloc) ; v1.4, salve : mêmes étapes, projection allongée de (blocs − 1) × ecart (donnees.salve = true, donnees.blocs = [ids]) |
| `onde_choc` | `preparation`, `frappe`, `recuperation` |
| `faiblesse` | `chute`, `boucle` |
| `rituel_ames` | `elevation`, `incantation`, `capture` |
| `transformation_lames` | `formation` |
| `frappe` | `preparation`, `frappe`, `recuperation` (donnees.reussie ; v1.4 : speciale, palier, groupe (joueurs ramenés par les crochets) ou null, touches) |
| `frappe_ordinaire` | v1.4 : n'existe plus (chaque coup de la phase 5 suit la règle du palier) |
| `defaite` | `chancelle`, `genoux`, `chute`, `mort` |
| `siphon` (v1.3) | `approche`, `aspiration`, `eclatement`, `recuperation` (cible = centre de la cuve à 1,4 m ; donnees : tube, miniBoss) |
| `crochet` (v1.4) | `preparation`, `lancer`, `traction` (cibleJoueur = le plus proche des visés, cible = sa position ; donnees.crochets = [ids], donnees.tires ; pas de `traction` si aucun crochet n'accroche) |
| `evanouissement` (v1.5) | `fondu` (`intangible.evanouissement` s, encore visible ; à la fin : intangible, aucune action pendant le vol) |
| `resurgissement` (v1.5) | `apparition` (`intangible.resurgissement` s, visible et vulnérable), puis aussitôt `frappe` (préparation `intangible.preparationFrappe` s) |

Locomotions (quand aucune action ou en fond) : `levitation` (calme, ph. 1-2), `ailes` (ailes déployées),
`rage` (ph. 3, plus bas, agressif), `affaibli` (ph. 4), `traque` (ph. 5, glisse au ras du sol, lames),
`intangible` (v1.5, ph. 5, palier ≥ 2 : invisible, vol en ligne droite à travers les murs), `mort` (cadavre au sol).

## 6. Modèle : `BossB7Modele.creer(THREE, options)`

```js
const modele = BossB7Modele.creer(THREE, { renderer, tete: globalThis.BOSS_B7_TETE || null, qualite: 'haute' });
scene.add(modele.object);       // origine aux pieds, regarde +Z
modele.update(dt, vue);         // vue = combat.etat().boss (+ vue.temps) ; place, oriente, anime tout
modele.reagir(dirX, dirZ, force)  // réaction additive aux dégâts (appelée sur l'évènement `degats`)
modele.flash(couleur, intensite)  // éclair d'émission bref (dégâts, immunité)
modele.points                   // Object3D : mainG, mainD, tete, bouche, poitrine, dos, piedG, piedD, lameG, lameD, pointeLameG, pointeLameD
modele.hitboxes()               // [{ zone: 'tete'|'corps', type: 'sphere', centre:{x,y,z}, rayon }] en monde, à jour
modele.dispose()
```
Le modèle ne lit rien d'autre que `vue` (pas d'évènement obligatoire) : il doit pouvoir être affiché seul
(page d'aperçu des poses). Version 2.1 (v1.3) : action `siphon` jouée avec le clip `absorption` (bras qui se lèvent vers
la cuve, doigts crochus qui tirent par saccades, énergie ramenée à la poitrine à l'éclatement). Une action inconnue retombe
sur la locomotion en cours (aucune erreur).
Version 2.2 (v1.4) : `vue.couleurLames` (`'bleu'` | `'rouge'` | `'vert'` ; `null` ou inconnu = rouge ; clé absente = inchangé) et
`modele.couleurLames(nom)` (sans argument : couleur courante) teignent verre, veines, cœur, tendons, traînées, fumée et gouttes,
sans recompiler ni allouer ; options de `creer` : `couleurLames` (défaut `'rouge'`), `allege` (défaut `false` : sans simulation
du manteau ni de l'étole, moins d'os mis à jour, sans ombres ; même silhouette à 5–10 m). Action `crochet` (`preparation`,
`lancer`, `traction`). Illusion recommandée : `creer(THREE, { renderer, tete, qualite: 'basse', allege: true, ombres: false,
gouttes: false, couleurLames: 'vert' })` (≈ 27 800 triangles, 24 appels de dessin, 0,1 ms par `update`), créée à l'avance et
réutilisée ; la vue de chaque illusion porte toujours `couleurLames: 'vert'`, et ses apparitions et dissipations se jouent avec
les actions `teleport_arrivee` / `teleport_depart`. **v1.5 (modèle 2.3)** : plus d'illusions (la recette reste valable pour toute
copie allégée) ; actions `evanouissement` (`fondu`) et `resurgissement` (`apparition`) de l'intangibilité (§17.3) ; quand
`vue.visible` est faux, le modèle est masqué.

## 7. Prototype : mini-moteur `proto/`

Monde (salle secrète d'après `arene.js` + maquette de Bunker 7), navigation (grille + A*), joueur FPS
(déplacement, saut, sprint, tir hitscan, PV avec régénération), zombies (modèle, animations, IA, effets
`saisie`/`extraction`/`cendres`/`emergence`), bots coop (option), et l'adaptateur `jeu` du §3. Deux scènes
Three.js (salle / bunker) ; la caméra et le rendu suivent `lieu`.

## 8. Monde du prototype ↔ logique (dalles arrachables)

`monde.appliquerBlocs(etat.blocs, temps)` : pour chaque dalle de `arene.salle.dalles`, le monde affiche soit la
dalle en place (avec un voile de fissures si `etat === 'fissure'`), soit le renfoncement (dalle absente), soit
la dalle détachée à `position`/`rotation` données par la logique (`arrache`, `levitation`, `vol`), soit la
reconstruction (`reconstruction` : fragments qui reviennent, t/durée). Les dalles hors liste sont en place.
`monde.dalle(id)` → Object3D de la dalle (pour les effets). Les collisions des joueurs ne changent jamais
(limite à `arene.salle.limiteJoueurs`).

## 9. Effets visuels : `BossB7Fx.creer(THREE, options)` (fichier `src/fx.js`)

```js
const fx = BossB7Fx.creer(THREE, {
  scenes: { salle, bunker },        // scènes Three.js ; un effet va dans la scène de son `lieu`
  renderer, camera,                  // caméra du joueur local (effets écran : obscurité, voiles)
  config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE,
  qualite: 'haute' | 'moyenne' | 'basse',     // nombre de particules, résolution des textures procédurales
  monde: {                           // optionnel (le jeu fournit l'équivalent)
    dalle(id) → Object3D | null,     // dalle arrachable (fissures, poussière)
    positionZombie(id) → {x,y,z} | null,
    lieuDe(position) → 'salle' | 'bunker'
  },
  surSecousse(force 0..1, duree s, position|null)   // optionnel : le jeu secoue sa caméra
});
const off = fx.brancher(combat);     // s'abonne aux évènements §4 (renvoie la fonction de désabonnement)
fx.mettreAJour(dt, etat, { modele, temps, joueurLocal: { id, position, lieu } });   // chaque image, APRÈS modele.update
fx.declencher(nom, params);          // effet ponctuel à la main (le jeu ou le prototype peuvent l'appeler)
fx.dispose();
```
Règles : aucune allocation par image (réserves préallouées), r128 et récent, additif + `depthWrite:false` pour les
lueurs, aucune lumière dynamique créée à la volée (réserve de 2–4 PointLight réutilisées au plus). Palette : énergie du
boss rouge-orangé (comme le sceau), âmes bleu-vert pâle (comme les fioles), rituel de purification blanc-or, sang rouge
sombre, obscurité bleu-noir désaturée. Symboles 100 % inventés (cercles, arcs, points, spirales, sceau à sept
branches) : aucune lettre, rune, croix, aigle ou forme réelle.

## 10. Audio : `BossB7Audio.creer(options)` (fichier `src/audio.js`)

```js
const audio = BossB7Audio.creer({
  context,                           // AudioContext du jeu (THREE.AudioContext.getContext() par ex.)
  destination,                       // défaut context.destination
  manifeste,                         // contenu de audio/out/manifest.json
  base: 'sons/boss/',                // préfixe des fichiers MP3 ; ou sons: { cle: ArrayBuffer | URL }
  volumes: { general: 1, musique: 0.85, effets: 1 }
});
await audio.precharger();            // { charges, total }
const off = audio.brancher(combat);  // évènements §4 → effets et musique (enchaînements exacts : répit 15 s, absence 30 s)
audio.mettreAJour(dt, etat, { auditeur: { position, lacet }, joueurLocalId });  // spatialisation, couches, boucles
audio.jouer(cle, { position, volume, vitesse }) → poignée   // effet à la main
audio.morsureChien(position, lieu)                // v1.2 : à chaque morsure d'un chien
audio.annoncerBonus(type)                         // v1.1 : « Munitions max ! » au ramassage
audio.sonMiniBoss(type, quoi, position, { lieu, id, etat, intensite, duree })   // v1.3 : capacités des mini-boss :
  // 'survolte' : 'charge' (≈ 0,7 s avant la décharge ; le bourdon de ce mini-boss monte et accélère), 'decharge', 'spasme' ;
  // 'irradie' : 'flaque' (etat 'debut' | 'fin' ; 'tick' ignoré ; sans 'fin', s'arrête après config flaque.duree)
audio.setVolume(canal, v) ; audio.stop(fondu) ; audio.dispose()
```

## 11. Interface : `BossB7Hud.creer(options)` (fichier `src/hud.js`)

```js
const hud = BossB7Hud.creer({ racine: HTMLElement, config: BOSS_B7_CONFIG, toucheInteraction: 'E' });
const off = hud.brancher(combat);    // titres, avertissements, récompenses, message final
hud.mettreAJour(dt, etat, { joueurLocalId });   // barre à segments, phase, comptes à rebours, capture, jauge, critique, invite
hud.dispose();
```
v1.3 : sous la ligne d'état du boss, une barre par entrée de `etat.miniBoss` (nom, « Mini-boss » / « Abattu », PV, couleur
`couleur`) ; ligne d'état « Protégé : abattez <nom> » (« Protégé : il siphonne une cuve » avant la libération), barre du
Septième bleu acier et bord pulsé à la couleur du mini-boss ; repères des seuils `miniBoss.seuils` sur le segment de la phase 2 ;
objectifs `phase2siphon` / `phase2mb` ({nom}) ; carte de titre et messages à la libération, message à la mort.

## 12. Prototype assemblé (`proto/boss-proto.html` + `proto/proto-boss.js`)

Charge : three, `src/config.js`, `src/arene.js`, `src/logique.js`, `tete/out/boss-tete.js`, `src/boss-modele.js`,
`src/fx.js`, `src/audio.js`, `src/hud.js`, puis `proto/*.js`. Boucle : `combat.mettreAJour(dt)` → `etat` →
`monde.appliquerBlocs` (+ v1.1 `appliquerPiliers`, v1.3 `appliquerTubes`) → `modele.update(dt, vue)` → `fx.mettreAJour` →
`audio.mettreAJour` → `hud.mettreAJour` → rendu
de la scène du `lieu` du joueur local → `arme.rendreVue`. Panneau de debug : `combat.allerA(etat)` pour chaque état,
invincibilité, bots, vitesse du temps, v1.3 « Seuil suivant » et « Tuer le mini-boss ». `window.BOSS` expose tout pour
les tests. v1.3 : `zombies.creer({ surCapacite(z, quoi, info) })` → `audio.sonMiniBoss` ; tant que `boss.protege`, les
coéquipiers simulés visent le mini-boss vivant (5–11 m, hors de l'aura de l'Irradié). v1.4 : une instance du modèle par
illusion (créées pendant la capture des âmes, réutilisées, vue construite depuis `etat().illusions`), un fournisseur de tir par
instance → `combat.toucherIllusion`, `fx` reçoit `ctx.modelesIllusions` (fonction id → instance) ; `jeu.tirerJoueur` (traction des
crochets) ; `surCapacite` transmet `info.id` (zones) et `info.cible` (étourdi) ; l'interface reçoit `ctx.etourdi` (secondes
restantes) ; panneau P : « Phase 3 sous 50 % (salves) » et « Palier suivant (phase 5) ». v1.5 : instances et tirs des illusions
retirés ; `fx` reçoit `monde.tir` et `mareBras: false` (le bras du prototype a sa mare), `lueursIrradies: true` ;
`zombies.creer({ halosIrradies: false })` (la lueur au sol vient des effets) ; `audio.mettreAJour` reçoit `ctx.positionZombie` ;
coéquipiers : `situation.murs` tant que les murs sont électrifiés ; panneau P : « Mini-boss à 49 % (rage) ».

## 13. Version 1.1 — demandes d'Anthony du 27/10 (fait foi pour les trois chantiers en parallèle)

1. **Zombies beaucoup plus agressifs** : tous les zombies du combat courent à leur vitesse maximale.
   Config : `zombies: { vitesse: 'sprint', agressif: true }`. La logique passe ces champs à
   `jeu.faireApparaitreZombie({ position, lieu, effet, source: 'boss', vitesse: 'sprint', agressif: true })`.
   Prototype : `'sprint'` ≈ 5,8–6,2 m/s (le sprint du joueur fait 6,6 m/s : on peut encore les distancer en sprintant),
   cycle de course adapté à cette vitesse, poursuite immédiate dès l'apparition, attaques plus rapprochées et plus fréquentes.
2. **Phase 3 — piliers destructibles** (`arene.salle.piliers`, 4 piliers ronds) : un bloc projeté dont la trajectoire
   (segment point de lévitation → point visé, en XZ) croise un pilier intact s'écrase sur ce pilier (point d'impact sur sa
   surface, dégâts aux joueurs proches de ce point seulement). **3 blocs reçus → pilier détruit** (effondrement), pour chacun
   des piliers. Un pilier détruit ne fait plus obstacle aux blocs suivants et reste en ruine jusqu'à la fin du combat (remis
   à neuf seulement par `allerA('inactif')`/`phase1`… ou un nouveau combat). Config : `phase3.piliers: { coupsDestruction: 3 }`.
   Instantané : `etat().piliers = [{ id, etat: 'intact'|'endommage'|'detruit', coups, t }]` (t = secondes depuis le dernier
   changement). Évènements : `pilier` `{ id, etat: 'touche'|'detruit', coups, position (centre du pilier, y = 0), pointImpact }`
   ; `blocImpact` reçoit en plus `pilier: id|null`. Monde (prototype) : `monde.appliquerPiliers(etat.piliers, temps)` chaque
   image (intact, fissuré selon `coups`, effondrement animé ≈ 1,2 s puis tas de gravats) ; la collision du pilier détruit est
   retirée (ou remplacée par un tas bas) et la grille de navigation de la salle est mise à jour ; `monde.pilier(id)` → Object3D.
   **Zombies en phase 3** : ils chassent aussi le joueur. Le retour en rage réduit toujours tous les zombies en cendres, puis
   les apparitions reprennent `phase3.apparitions.delai` s plus tard. Config : `phase3.apparitionsSuspendues: false`,
   `phase3.apparitions: { delai: 5, intervalle: 2.0, max: 8 }` (coop : `coop.zombiesParJoueurSupp` en plus). Pour garder
   la durée de la v1.0, `phase3.pv` passe de `s(36)` à `s(30)`.
3. **Musique plus forte** : volume par défaut du bus musique 1,4 (v1.0 : 0,85, soit ≈ +4,3 dB), limiteur final
   (seuil −1,5 dB, ratio 20) après le compresseur pour éviter toute saturation. `audio.setVolume('musique', v)` reste
   disponible ; curseur du panneau de test réglé sur 1,4 (0 à 2).
4. **Bonus « Munitions max » à la fin de chaque phase** : config `bonusFinDePhase: { actif: true, type: 'munitions-max',
   duree: 30 }`. Fin de phase 1 (→ répit), 2 (→ transition23), 3 (→ transition34) : au sol sous la position du boss (ramenée
   dans la salle à au moins 2 m de `limiteJoueurs`). Fin de phase 4 (boss affaibli vaincu → capture des âmes) : déposé dans le
   bunker près du point de réveil des joueurs au début de la phase 5. Fin de phase 5 (défaite) : dans la salle près du
   cadavre au début de `retour_salle`. La logique appelle `jeu.faireApparaitreBonus({ type, position, lieu, duree })` (nouvelle
   fonction optionnelle de l'adaptateur : le jeu fait apparaître son propre bonus à ramasser) ; si elle est absente ou renvoie
   `false`, `jeu.activerBonus(type, {})` directement. Évènement `bonus` `{ type, position, lieu, phase, mode: 'depose'|'active' }`.
   Prototype : bonus flottant lumineux qui tourne, clignote les 5 dernières secondes, ramassé au contact (1,5 m) par un joueur
   ou un coéquipier → recharge les munitions de tous (chargeur plein + réserve pleine), callback `surBonus(type, joueurId)`.
   Sons : `bonus` mode `depose` → tintement positionnel au point de dépôt ; **annonce vocale au ramassage** :
   `audio.annoncerBonus('munitions-max')` (son `annonce_munitions_max`, voix de l'annonceur), à n'appeler que si le jeu n'a
   pas déjà son propre annonceur pour ses bonus. Interface : message « Bonus « Munitions max » au sol : ramassez-le ! ».
5. **Phase 4 : beaucoup plus de zombies** : `phase4.apparitions: { intervalle: 1.0, max: 22 }` en solo (v1.0 : 1,5 s et 12),
   +`coop.zombiesParJoueurSupp` (4) par joueur supplémentaire. Contestation du cercle à partir de `phase4.zombiesPourContester: 6`
   zombies dedans (v1.0 : 3), sinon la capture serait presque toujours en pause. (Valeurs d'abord essayées : 0,6 s et 24 ;
   le robot moyen ne gagnait plus une seule fois en solo.)
6. **Phase 5 : téléportation sur gros dégâts** : config `phase5.teleportDegats: { actif: true, seuil: s(1.8), fenetre: 3.0,
   seuilParJoueurSupp: 0.75, delaiMin: 5, distanceMin: 12, distanceMax: 32, gelJauge: 8 }`. Si le boss reçoit au moins
   `seuil × (1 + seuilParJoueurSupp × (n − 1))` dégâts sur les `fenetre` dernières secondes (solo : 630, ≈ 18 balles du
   prototype, soit 60 % d'un chargeur), il se téléporte (`teleport_depart` rapide) vers un point du bunker à 12–32 m du tireur
   (atteignable), puis reprend sa traque. **Pendant l'élan (étape `preparation`) d'une frappe, spéciale ou ordinaire, la
   téléportation interrompt la frappe** ; jamais pendant l'impact ou la récupération d'une frappe, une autre téléportation,
   la formation des lames ou une disparition ; au plus une fois toutes les `delaiMin` s. (Première version : un chargeur
   entier, 980 dégâts en 4,5 s, sans interruption : dans le prototype, le boss atteignait le joueur et frappait avant que le
   seuil soit atteint, la téléportation ne se déclenchait presque jamais.) La jauge du pacte reste gelée pendant la téléportation puis `gelJauge` s (ou jusqu'au
   prochain tir qui le touche). Les évènements `teleport` portent un champ `raison` : `'degats'`, `'frappe'`, `'phase'`,
   `'blocage'` (garde-fou de navigation). Interface : message « Blessé, il se téléporte ailleurs dans le bunker : retrouvez-le ! ».
   Équilibrage associé : `phase5.frappe.invulnerabilite` passe de 1,5 à 3 s (avec des sprinteurs, un joueur laissé à 1 % mourait
   presque toujours avant de pouvoir fuir).
   **Effets** : à chaque téléportation du boss dans le bunker (départ ET arrivée, toutes raisons), un **cercle rituel** au sol
   (≈ 2 m de rayon, rouge-orangé comme le sceau, glyphes inventés) qui se dessine en ≈ 0,35 s, tient ≈ 1,2 s et s'efface en ≈ 1,2 s.
   Pilier : poussière, fissures lumineuses et éclats au point d'impact (`pilier` touche) ; effondrement : nuage de poussière,
   gerbe de débris, secousse (`pilier` détruit).

## 14. Version 1.2 — seconde moitié de la phase 1 : double sort et meute de chiens zombies (fait foi)

Demande d'Anthony : « Quand le boss a perdu la moitié de ses PV (uniquement la phase 1), le boss lancera 2 sorts, les 2 sur
le joueur, à 1 ou 2 secondes d'intervalle. Ajoute les chiens zombies à partir de ce moment ; ils resteront jusqu'à la fin du
boss, sans exception. » Choix validés par Anthony : les 2 sorts tombent **sous le joueur** ; **2 chiens en solo, +1 par
joueur supplémentaire**, un chien tué revient quelques secondes plus tard.

### 14.1 Déclencheur (une fois par combat)
PV du segment de la phase 1 ≤ `phase1.secondeMoitie.seuil` (0,5) × PV max du segment → `S.secondeMoitie = true` : le double
sort s'active jusqu'à la fin de la phase 1, et la meute est lâchée (évènement `meute` `dechainee`). Si un seul coup fait passer
la phase 1 de plus de 50 % à 0, la meute est lâchée quand même (au plus tard au changement d'état qui termine la phase 1).

### 14.2 Double sort (phase 1, après le déclencheur)
Config : `phase1.secondeMoitie: { seuil: 0.5, doubleSort: { actif: true, ecart: [1.0, 2.0], distanceJoueur: [0, 1.0] } }`.
Chaque `invocation` devient une paire, dans UNE action `invocation` aux étapes :
`preparation` (P.preparation) → `lancer` (P.lancer ; sort 1 tiré à la fin de l'étape, comme aujourd'hui) →
`preparation` (durée `ecart − P.lancer`, `donnees.second = true`) → `lancer` (P.lancer ; sort 2) → `recuperation`.
`ecart` (temps entre les deux tirs) est tiré dans [1,0 ; 2,0] s. Les deux sorts visent **le même joueur** (cibleJoueur choisi
comme aujourd'hui ; s'il n'est plus valide au 2e tir : le joueur valide le plus proche, sinon le 2e sort est annulé).
**Point d'impact choisi au moment du tir** (sortie de l'étape `lancer`) : position du joueur à cet instant + décalage aléatoire
de `distanceJoueur` m, ramené dans la salle (marge 1,5 m). La zone (rayon 2,4 m) couvre donc ses pieds ; elle reste marquée
`delaiActivation` (0,6 s) avant d'être active, plus le temps de vol : on l'esquive en bougeant. `action.cible` suit le joueur
pendant les étapes `preparation` (le modèle vise avec la main). Si la ligne main → point croise un pilier intact, le sort part
quand même et s'écrase sur le pilier (pas de zone, pas de dégât au pilier) : se cacher protège. La règle d'écart minimal entre
zones ne s'applique pas à la paire. Les zombies des zones respectent le plafond `phase1.zombiesMax` (+ coop). Le `trait`, les
intervalles entre invocations et tout le reste de la phase 1 ne changent pas. Avant le déclencheur : phase 1 inchangée.

### 14.3 Meute de chiens zombies (du déclencheur à la mort du boss)
Config :
```js
chiens: {
  actif: true,
  max: 2, maxParJoueurSupp: 1,                         // chiens en même temps : 2 en solo, +1 par joueur supplémentaire
  faille: { duree: 0.9, ecart: 0.6, distance: [8, 16] }, // la faille s'ouvre `duree` s avant que le chien en jaillisse
  reapparition: [10, 15],                               // un chien tué est remplacé après ce délai (s) — réglé (§14.8)
  delaiBunker: 4,                                       // phase 5 : la meute revient dans le bunker ce délai après le réveil
  bloque: 10,                                           // chien immobile et loin des joueurs depuis ce délai → nouvelle faille
  profil: { pv: 70, vitesse: 7.4, degats: 0.05, cadence: 0.9, portee: 1.4 }   // transmis au jeu — réglé (§14.8)
}
```
- **Apparition** : la logique choisit un point (salle : dans la salle, marge 1,5 m, hors pilier, à `faille.distance` m du joueur
  valide le plus proche, atteignable si `chemin` existe ; bunker : `pointsBunker('zombies')` ou points valides atteignables à
  10–20 m des joueurs) → évènement `chien` `{ etat: 'faille', id: idFaille, position, lieu }` → `faille.duree` s plus tard,
  `jeu.faireApparaitreZombie({ position, lieu, effet: 'faille', source: 'boss', type: 'chien', vitesse: 'sprint', agressif: true,
  profil })` → évènement `chien` `{ etat: 'apparition', id, position, lieu }`. Au déclencheur, toute la meute arrive, failles
  espacées de `faille.ecart` s.
- **Effectif** : `max + maxParJoueurSupp × (n − 1)`, recalculé quand un joueur arrive ou part (comme le reste de la coop).
- **Mort** : un chien absent de `jeu.zombies()` (ou `vivant: false`) → `chien` `{ etat: 'mort', id, position (dernière connue),
  lieu }`, remplaçant prévu après un délai tiré dans `reapparition`.
- **« Sans exception »** : les chiens ne sont PAS des zombies pour la logique : exclus des plafonds de zombies, de l'absorption
  des âmes (phase 2), du compte de contestation du cercle (phase 4) et de tous les `reduireEnCendres` (répit, retour en rage,
  explosion du rituel, capture des âmes). Ils chassent pendant le répit, l'absence, le rituel, la faiblesse et la phase 5, et
  les apparitions continuent.
- **Passage dans Bunker 7** : pendant `transition45` (joueurs invulnérables), les chiens restent dans la salle. Quand les
  joueurs sont téléportés dans le bunker (début de `phase5`), les chiens de la salle sont retirés en silence
  (`retirerZombie(id, { effet: 'silencieux' })`, `chien` `{ etat: 'fin', raison: 'transfert' }`) et la meute revient dans le
  bunker par des failles `delaiBunker` s après.
- **Fin** : à l'entrée de `defaite`, chaque chien → `retirerZombie(id, { effet: 'cendres', points: false })` + `chien`
  `{ etat: 'fin', raison: 'defaite' }`, puis `meute` `{ etat: 'dissipee' }` ; plus aucune apparition. `echec` : retrait silencieux.
- **Débogage** : `allerA(x)` pour x de `repit` à `phase5` → meute active (lâchée aussitôt dans le bon lieu ; phase 5 après
  `delaiBunker`) ; `inactif`, `introduction`, `phase1` → inactive (phase 1 : jusqu'au seuil) ; `defaite` et après → inactive.
- **Garde-fou** : chien immobile (< 0,5 m) depuis `bloque` s et à plus de 6 m de tout joueur valide → retiré en silence,
  remplacé par une nouvelle faille.
- **Instantané** : `etat().meute = null | { active, max, chiens: [ { id, position, lieu } ], failles: [ { id, position, lieu, t,
  duree } ] }` ; `etat().secondeMoitie` (bool).
- **Évènements** : `meute` `{ etat: 'dechainee'|'dissipee', max }` ; `chien` `{ etat: 'faille'|'apparition'|'mort'|'fin', id,
  position, lieu, raison? }`.
- **Adaptateur** (§3) : `faireApparaitreZombie` reçoit `type: 'chien'` et `profil` → le jeu crée un chien zombie (le sien s'il
  en a déjà, façon « manches de chiens »). S'il ignore `type`, un zombie apparaît à la place (dégradé mais fonctionnel).
  `zombies()` liste aussi les chiens (champ facultatif `type: 'chien'`) ; `retirerZombie` s'applique aux chiens.

### 14.4 Prototype (mini-moteur, `proto/`)
Chiens dans `proto-zombies.js` (ou un module voisin qui expose la même API) : `type: 'chien'`, modèle procédural ORIGINAL
(chien zombie décharné : peau déchirée, côtes apparentes, yeux couleur braise du Pacte ; pas de crinière de feu, rien qui
copie un chien de l'enfer d'un jeu existant), galop à `profil.vitesse` (7,4 m/s, plus rapide que le sprint du joueur, 6,6),
bond-morsure à `profil.portee` m toutes les `profil.cadence` s (`profil.degats` des PV max), séparation, champ de flux, sortie
de faille (bond), mort (effondrement + cendres), zones de tir `tete`/`corps` pour l'arme, coéquipiers simulés qui les visent
en priorité sous 8 m, points à la mort. `liste()` donne `type`. `surAttaque(z, id)` et `surMort(z, tueur)` reçoivent le chien.

### 14.5 Effets (`fx.js`)
`chien` `faille` : sceau inventé couleur braise qui se fissure au sol (≈ 1,6 m), colonne de fumée, braises, lumière, pendant
`faille.duree` + ≈ 0,6 s ; `apparition` : gerbe (éclats, éclair) quand le chien jaillit ; `mort` : petite bouffée de cendres
et de braises. `meute` `dechainee` : onde rouge autour du boss + légère secousse. Lisible dans le noir de la phase 5, dans les
deux lieux, sans allocation par image.

### 14.6 Sons (`audio.js` + manifeste)
Nouveaux sons synthétisés : `chien_faille` (≈ 1,2 s), `chien_hurlement` (≈ 2,5 s), `chien_grognement` (boucle ≈ 2 s),
`chien_aboiement` (≈ 0,5 s), `chien_morsure` (≈ 0,35 s), `chien_mort` (≈ 1,2 s). Câblage : `faille` → `chien_faille` ;
`apparition` → aboiement ou hurlement court ; `mort` → `chien_mort` ; `meute` `dechainee` → hurlements ; chaque image :
grognement en boucle sur le chien vivant le plus proche, aboiements aléatoires ; `audio.morsureChien(position)` à chaque morsure.

### 14.7 Interface (`hud.js`)
`meute` `dechainee` → message « Le Septième lâche ses chiens : ils vous traqueront jusqu'à sa mort ! ».

### 14.8 Équilibrage
Simulateur : chiens qui chassent à `profil.vitesse`, mordent `profil.degats` toutes les `profil.cadence` s à `profil.portee`
m ; robots qui les abattent quand ils sont proches. Objectifs : solo avec l'arme du prototype ≥ 3/5 victoires sur les graines
de référence, coop 4 : 5/5. S'ils ne sont pas tenus, régler `chiens.profil` (pv, degats) ou `reapparition`, **jamais** le nombre
de chiens (choix d'Anthony). Résultat : avec les valeurs de départ (pv 100, degats 0,1, remplaçant après 4–7 s), le solo avec
l'arme du prototype tombait à 1/5 ; réglé à pv 70, degats 0,05, remplaçant après 10–15 s → solo chargeur 3/5 (10/15), coop 4 5/5.

## 15. Version 1.3 — les cuves et les deux mini-boss de la phase 2 (fait foi)

Demande d'Anthony : modéliser complètement les cuves vertes (en garder 2) ; un mini-boss dans chacune (fiches d'Anthony :
**N°06 « Le Survolté »** et **N°04 « L'Irradié »**) ; en phase 2, quand le Septième a perdu 25 % de ses PV, il siphonne une
cuve qui éclate et libère son mini-boss ; quand il a perdu 50 %, il siphonne l'autre ; les mini-boss chassent et tuent avec
leurs propres capacités ; chacun a sa barre de PV avec son nom en haut de l'écran, ses sons, ses animations ; il faut
**impérativement** les battre pour pouvoir de nouveau blesser le Septième, **invulnérable** tant qu'ils sont dans l'arène.
Choix validés par Anthony : un mini-boss à la fois (le 2e sort à 50 % des PV du Septième, donc après la mort du 1er) ;
**le Septième continue d'attaquer** pendant que les mini-boss sont là. Ordre : 1er Le Survolté, 2e L'Irradié.

### 15.1 Cuves (`arene.salle.tubes`, monde)
Deux cuves dos au mur (emplacements des anciennes cuves brisées) : `tube0` (x 11,918 ; z 4,937 ; Le Survolté) et `tube1`
(x −11,918 ; z −4,937 ; L'Irradié), rayon du verre 0,85 m, hauteur 2,6 m, `lacet` = face au centre. Intactes au début de chaque
combat, chacune montre son mini-boss endormi qui flotte dans le liquide vert. États : `intact` → `siphon` (le liquide est aspiré,
le niveau baisse, les bulles s'affolent) → `fissure` (le verre se fend, fissures lumineuses) → `eclate` (verre brisé au bord
déchiqueté, tessons, flaque ; le mini-boss endormi disparaît : c'est l'entité de jeu qui prend le relais). Instantané :
`etat().tubes = [ { id, etat, miniBoss, t } ]` (t = secondes depuis le dernier changement). Monde du prototype :
`monde.appliquerTubes(etat.tubes, temps)` chaque image ; une cuve, intacte ou brisée, reste un obstacle (cercle r + 0,2).

### 15.2 Déroulé (phase 2)
- Seuils `config.miniBoss.seuils = [0.75, 0.5]` (fraction des PV du segment de la phase 2). Au 1er passage sous un seuil, les
  PV sont **bloqués à ce seuil** (un seuil ne peut pas être sauté, même avec un énorme coup) et le boss devient **protégé**
  (`boss.protege = true`, `toucherBoss` → `{ applique: false, raison: 'invulnerable' }`, retour « IMMUNISÉ » habituel).
- Il siphonne alors la cuve suivante de `ordre` : action `siphon` aux étapes `approche` (il se tourne, bras levés vers la cuve),
  `aspiration` (cuve `siphon` à l'entrée, `fissure` à `siphon.fissure` × durée), `eclatement` (cuve `eclate`), `recuperation` ;
  `action.cible` = centre de la cuve à 1,4 m de haut. Il siphonne à distance, sans se déplacer. Si une action est en cours au
  passage du seuil : un piqué déjà lancé (`charge` et après) va au bout, toute autre action est annulée ; le siphon commence au
  plus tard 1,5 s après le seuil.
- `siphon.apparition.delai` s après l'éclatement : `jeu.faireApparaitreZombie({ position (devant la cuve, à
  apparition.distance m vers le centre), lieu: 'salle', effet: 'cuve', source: 'boss', type: 'survolte'|'irradie',
  miniBoss: true, nom, profil })` → id ; évènements `miniBoss { etat: 'libere', id, type, nom, position, lieu, pvMax }` et
  `protection { actif: true, miniBoss: type }`.
- **Le Septième continue d'attaquer** (choix d'Anthony) : invocations, traits, absorptions, ailes et piqués continuent pendant
  que le mini-boss est là (sauf pendant l'action `siphon`). Les mini-boss et les chiens sont exclus des cibles d'absorption, des
  plafonds de zombies et de tous les `reduireEnCendres`.
- **Mort** du mini-boss (absent de `jeu.zombies()` ou `vivant: false`) → `miniBoss { etat: 'mort', … }` puis
  `protection { actif: false }` : le Septième est de nouveau vulnérable et ses PV repartent du seuil.
- PV : `profil.pv` × (1 + coop.pvParJoueurSupp × (n − 1)) au moment de l'apparition. `jeu.zombies()` doit donner `pv` et
  `pvMax` pour les mini-boss (barre de PV) ; instantané `etat().miniBoss = [ { id, type, nom, couleur, pv, pvMax,
  etat: 'actif'|'mort', position, lieu } ]` (un mini-boss mort y reste 3 s, barre vide, puis disparaît).
- Garde-fous : apparition refusée (null) → nouvel essai toutes les 1 s, 5 fois, puis avertissement et fin de la protection (le
  combat ne doit jamais se bloquer) ; mini-boss immobile (< 0,5 m) depuis 15 s et à plus de 10 m de tout joueur valide →
  retiré en silence et remis devant sa cuve avec ses PV actuels (`profil.pv` = PV restants).
- Débogage : `allerA('phase2')` et avant → cuves intactes, seuils remis à zéro, aucun mini-boss ; `allerA` après la phase 2 →
  cuves `eclate`, aucun mini-boss, pas de protection. `echec` → mini-boss retirés en silence.
- Précisions de l'implémentation (logique 1.3.0) : les seuils sont vérifiés à chaque pas (PV forcés au débogage ou ajustés par
  la coop compris) ; `boss.protege` passe à vrai dès le seuil (siphon compris), l'évènement `protection { actif: true }` ne part
  qu'à la libération ; pendant l'attente du siphon, un piqué en `charge` ou `impact` va au bout, `etourdi` et `retour` sont
  coupés à 1,5 s ; un mini-boss que `jeu.zombies()` ne liste jamais dans les 3 s → avertissement et protection levée.

### 15.3 Profils (`config.miniBoss`, transmis au jeu, qui exécute leur IA et leurs capacités)
```js
miniBoss: {
  actif: true,
  ordre: ['survolte', 'irradie'],
  seuils: [0.75, 0.5],
  siphon: { approche: 1.0, aspiration: 2.2, fissure: 0.6, eclatement: 0.6, recuperation: 0.8,
            apparition: { delai: 0.6, distance: 1.6 } },
  survolte: { nom: 'Le Survolté', couleur: '#38D9FF', pv: s(14), vitesse: 4.2, degatsContact: 0.24, cadenceContact: 1.2,
              decharge: { portee: 8, intervalle: 4, degats: 0.15, flou: 1.0, recharge: 2.0 } },
  irradie: { nom: 'L’Irradié', couleur: '#8CFF2E', pv: s(21), vitesse: 2.8, degatsContact: 0.16, cadenceContact: 1.4,
             aura: { rayon: 3, degatsParSeconde: 0.07 }, flaque: { rayon: 2.5, duree: 5, degatsParSeconde: 0.07 } }
}
```
- **Le Survolté** (fiche N°06, « tireur », 1,80 m) : électricien de ligne foudroyé en pleine réparation. Casque de chantier
  blanc fendu, veste bleu nuit à bandes réfléchissantes, bretelles, ceinture à outils et sacoches, genouillères, un gant rouge,
  cicatrices de foudre émissives cyan, cheveux dressés. Animation : spasmes, bras écartés, pause de recharge bien lisible.
  **Décharge** : toutes les `intervalle` s, arc vers le joueur valide le plus proche à `portee` m maximum (ligne de vue) :
  `degats` + **vision brouillée** `flou` s ; puis `recharge` s **immobile** (sa fenêtre). Il chasse à `vitesse` et se tient à
  5–7 m de sa cible pour décharger ; coup au contact (`degatsContact`) si on le colle. Effets : arcs en lignes brisées
  régénérés chaque image entre ses mains et le sol, éclair à la décharge.
- **L'Irradié** (fiche N°04, « zone toxique », 1,90 m) : technicien de centrale resté trop longtemps près du réacteur.
  Combinaison jaune mate, masque à gaz pendu sur la poitrine, badge radioactif, tête de zombie aux yeux verts lumineux et
  pustules, bave verte, gants et bottes noirs. Animation : pas traînants, bras ballants, tête affaissée sur le torse. **Aura** :
  `aura.degatsParSeconde` en continu à `aura.rayon` m ; **à sa mort, flaque toxique** de `flaque.rayon` m pendant
  `flaque.duree` s. Lent et massif : on l'abat à distance avant d'entrer dans son aura. Effets : lumière verte sur le torse,
  vapeur et particules flottantes, halo vert au sol.

### 15.4 Évènements
`tube { id, etat: 'siphon'|'fissure'|'eclate', position, miniBoss }` · `miniBoss { etat: 'libere'|'mort', id, type, nom,
position, lieu, pvMax? }` · `protection { actif, miniBoss? }` · action `siphon` (approche, aspiration, eclatement,
recuperation). Le jeu (ou le prototype) signale les capacités pour les sons et les effets : `decharge`, `charge`, `aura`,
`flaque` (voir §15.6).

### 15.5 Effets (`fx.js`)
Siphon : flot d'énergie verte qui sort du haut de la cuve et file jusqu'aux mains du boss, liquide qui bouillonne ; fissure :
fissures lumineuses sur le verre ; éclatement : gerbe de verre, éclaboussure de liquide vert, brume, éclair, onde, secousse ;
libération : vapeur autour du mini-boss qui sort. Protection : **lien** pulsé du boss au mini-boss vivant (couleur du
mini-boss) + voile de bouclier sur le boss tant que `boss.protege`. Préalloué, sans allocation par image.

### 15.6 Sons
`tube_siphon`, `tube_fissure`, `tube_eclatement`, `miniboss_apparition` (stinger), `survolte_bourdon` (boucle),
`survolte_charge`, `survolte_decharge`, `survolte_spasme`, `survolte_cri`, `survolte_mort`, `irradie_geiger` (boucle),
`irradie_rale` (boucle), `irradie_cri`, `irradie_mort`, `flaque_toxique` (boucle). `audio.js` : évènements `tube`,
`miniBoss`, `protection` ; boucles sur les mini-boss vivants (instantané) ; API `audio.sonMiniBoss(type, quoi, position)`
appelée par le jeu pour `charge`, `decharge`, `spasme`, `flaque`.

### 15.7 Interface (`hud.js`)
Sous la barre du Septième, une barre par mini-boss actif : son nom (« LE SURVOLTÉ », « L'IRRADIÉ ») et ses PV, à sa couleur.
Ligne d'état du boss : « PROTÉGÉ : abattez Le Survolté ». Message à la libération.

### 15.8 Équilibrage
Simulateur : mini-boss avec leurs capacités ; robots qui les abattent quand le Septième est protégé, restent hors de l'aura de
l'Irradié et encaissent les décharges. Objectifs : solo avec l'arme du prototype ≥ 3/5 victoires sur les graines de référence,
coop 4 : 5/5. S'ils ne sont pas tenus : régler PV et dégâts des mini-boss, pas leurs mécaniques.

## 16. Version 1.4 — 3e cuve (Le Démembré), mini-boss renforcés, salves de murs, zombies pendant la faiblesse, paliers de la phase 5 (fait foi)

Demande d'Anthony du 27/10 après la v1.3 (photo de la salle + fiche **N°02 « Le Démembré »**). Choix validés par Anthony :
zones radioactives de L'Irradié **sans plafond** (elles restent jusqu'à sa mort) ; **2 boules par salve en solo, +1 par joueur
supplémentaire** ; salve de murs de la phase 3 : **4 blocs au total**, répartis entre les joueurs ; illusions de la phase 5 :
**dissipées par une balle, de retour 8 s plus tard ailleurs**, 3 en solo +1 par joueur, elles ne remplissent pas la jauge.
Versions : logique 1.4.0, modèle 2.2.0, fx 1.4.0, audio 1.4.0, hud 1.4.0.

### 16.1 Troisième cuve et Le Démembré (phase 2, à 25 % des PV restants)
- `arene.salle.tubes[2] = { id: 'tube2', x: 0, y: 0, z: 13.25, lacet: π, rayon: 0.85, hauteur: 2.6, miniBoss: 'demembre' }` :
  milieu du mur nord, entre la table de laboratoire (coin nord-est) et la cage (coin nord-ouest), l'endroit vide de la photo
  d'Anthony. La brèche `breche0` passe de (0, 13) à **(0, 11)** (devant la cuve) ; la dalle `m0-1` derrière la cuve devient
  `actif: false` (jamais arrachée : un bloc ne lévite plus à travers la cuve).
- `config.miniBoss.ordre = ['survolte', 'irradie', 'demembre']`, `seuils = [0.75, 0.5, 0.25]` : même déroulé que §15.2 (PV
  bloqués au seuil, protégé, siphon de la cuve suivante, un mini-boss à la fois, le Septième continue d'attaquer).
- `config.miniBoss.demembre` (fiche N°02 « brute », 1,95 m ; PV ×1,4, vitesse ×0,8, dégâts ×1,5 ; **pas de faiblesse** : le bras ne
  se détache jamais) : `{ nom: 'Le Démembré', couleur: '#E3B65C', pv: s(16.3), vitesse: 4.2, degatsContact: 0.30,
  cadenceContact: 1.6, fleau: { portee: 2.6, angle: 150, preparation: 0.55, degats: 0.30 } }`. **Fléau** : il fait tournoyer son
  bras gauche pendant (`preparation` s, bien lisible), puis frappe en arc large : tous les joueurs à `portee` m dans un cône de
  `angle` degrés devant lui prennent `degats`. Animation : démarche lourde et boiteuse, épaule gauche affaissée, bras gauche
  pendant relié par des tendons (pendule), mâchoire ouverte, un œil crevé.

### 16.2 L'Irradié et Le Survolté renforcés (capacités exécutées par le jeu, comme §15.3)
- **L'Irradié** : `vitesse` 2,8 → **4,4** (pas traînants mais rapides) ; `aura.rayon` 3 → **6** ; nouvelle capacité **boules** :
  `boules: { intervalle: 6, parVolee: 2, parJoueurSupp: 1, portee: 24, tempsVol: 1.1, impact: { rayon: 1.2, degats: 0.08 },
  zone: { rayon: 2.5, dpsBase: 0.04, dpsParSeconde: 0.05, dpsMax: 0.35, oubli: 2 } }`. Toutes les `intervalle` s, il lance
  `parVolee + parJoueurSupp × (n − 1)` boules en cloche (une sur chaque joueur valide, à tour de rôle ; une boule en plus d'un
  joueur vise l'endroit où il sera dans 1 s). Le point d'impact est marqué au sol dès le lancer (esquivable). Chaque impact
  inflige `impact.degats` à `impact.rayon` m et crée une **zone radioactive** qui **reste jusqu'à la mort de L'Irradié** (puis
  s'éteint en 1,5 s), **sans plafond**. **Exposition** : par joueur, `expo` = secondes passées dans une zone (sans en sortir plus
  de `oubli` s) ; dégâts par seconde = min(`dpsMax`, `dpsBase` + `dpsParSeconde` × `expo`) : traverser coûte peu, rester tue
  (≈ 5,5 s depuis la pleine santé). Aura et zones se cumulent. La flaque de sa mort (§15.3) ne change pas.
- **Le Survolté** : `vitesse` 4,2 → **5,4** ; `decharge.multi: true` (un arc vers **chaque** joueur valide à `portee` m en ligne de
  vue, en même temps) ; `decharge.etourdissement: 1.0` : chaque joueur touché est **étourdi 1 s** (ni déplacement, ni saut, ni
  tir, ni rechargement ; la vue reste libre mais tremble) en plus de la vision brouillée.
- Recharge des boules : elle court dans tous les modes sauf pendant le lancer (aussi pendant ses coups au contact) ; il ne lance
  qu'en marche, donc dès que la cible sort du contact. Un seul signal `'boule'` `'lancer'` par salve (`info.intensite` = nombre de
  boules), puis un `'impact'` et un `'zone'` `'debut'` par boule.
- Signalement au son (`surCapacite` → `audio.sonMiniBoss`) : `'demembre'` : `'fleau'` (`etat` `'preparation'` | `'frappe'`),
  `'impact'` ; `'irradie'` : `'boule'` (`etat` `'lancer'` | `'impact'`), `'zone'` (`etat` `'debut'` | `'fin'`, `id`) ;
  `'survolte'` : `'etourdi'` (`cible` = joueur étourdi).

### 16.3 Phase 3 : salves de murs sous 50 %
`config.phase3.salve = { seuil: 0.5, blocs: 4, ecart: 0.12, intervalle: [5.0, 6.5], predictions: [0, 0.45, 0.9, 1.3], decalage: 1.1 }`.
Quand les PV de la phase 3 passent sous `seuil` × max, chaque arrachement devient une **salve** : `blocs` dalles désignées
ensemble (sur des murs différents si possible), fracture et lévitation simultanées, puis projections à `ecart` s d'intervalle
(≈ 0,4 s pour les 4). Les blocs sont **répartis entre les joueurs valides** (à tour de rôle : 4 en solo, 2 + 2 à deux, 2 + 1 + 1 à
trois, 1 chacun à quatre). Le k-ième bloc d'un joueur vise sa position prédite avec `predictions[k]` et un décalage latéral
alterné de ± `decalage` m à partir du 3e : rester immobile fait tout encaisser, bouger en évite la plupart. Chaque bloc garde
**au moins 25 %** (règle d'origine), les piliers les arrêtent toujours. `blocsSimultanes` ne bride pas une salve. Salve suivante
après `intervalle`. `etat().boss.action.donnees.salve = true`, `donnees.blocs = [ids]`.

### 16.4 Phase 4 : zombies pendant la faiblesse
`config.phase4.faiblesse.apparitions = { intervalle: 1.2, max: 10 }` (+ `coop.zombiesParJoueurSupp` par joueur) : pendant que le
Septième est affaibli à terre, des zombies (sprinteurs) apparaissent comme dans les autres phases. Rien d'autre ne change.

### 16.5 Phase 5 : paliers de la jauge « Rompre le pacte »
`config.phase5.paliers = { seuils: [0.25, 0.5, 0.75], critique: 0.05,
  bleu: { degats: 0.5, invulnerabilite: 1.0 },
  illusions: { nombre: 3, parJoueurSupp: 1, max: 6, apparition: 1.0, dissipation: 0.8, retour: 8, distanceMin: 12 },
  crochet: { recharge: 15, porteeMin: 4, porteeMax: 22, preparation: 0.7, vitesse: 26, rayon: 0.9, traction: 14, arrivee: 1.3,
             preparationFrappe: 0.25 } }`.
Le palier vaut le nombre de seuils atteints par la jauge et **reste acquis** (la jauge qui redescend ne le fait pas reculer).
- **Palier 0** (début) : lames **bleu très clair** ; chaque coup du Septième inflige `bleu.degats` (50 % des PV max : **2 coups
  tuent**), puis le joueur est invulnérable `bleu.invulnerabilite` s ; pas de disparition.
- **Palier 1** (25 % de la jauge) : lames **rouges** (couleurs d'origine) ; **chaque coup est quasi mortel** : un joueur au-dessus de
  `critique` (5 %) tombe à `frappe.pvRestants` (1 %), invulnérable `frappe.invulnerabilite` (3 s), et le Septième disparaît
  `disparition.duree` s comme avant ; un joueur déjà critique (≤ 5 %) **meurt**. La frappe ordinaire et l'immunité de 15 s de la
  v1.0 n'existent plus en phase 5 (chaque coup suit la règle du palier).
- **Palier 2** (50 %) : **illusions** en plus : `nombre + parJoueurSupp × (n − 1)` (au plus `max`), qui apparaissent dans tout le
  bunker à au moins `distanceMin` m des joueurs, traquent chacune un joueur comme le Septième (même vitesse, chemins du jeu) et
  jouent ses gestes de frappe **sans aucun dégât**, avec des **lames vertes**. Une balle en dissipe une (`dissipation` s, fumée
  verte) ; elle revient ailleurs `retour` s plus tard. Elles ne remplissent pas la jauge, ne déclenchent pas la téléportation sur
  dégâts, disparaissent à la défaite. `combat.toucherIllusion({ id, joueur, position }) → { applique, raison }`.
- **Palier 3** (75 %) : **crochets** en plus, au plus une fois toutes les `recharge` s : action `crochet` (`preparation` : il lève
  le bras et vise ; `lancer` : un crochet vers **chaque** joueur valide à `porteeMin`–`porteeMax` m en ligne de vue et non
  invulnérable, à `vitesse` m/s vers sa position au lancer ; `traction`). Un crochet accroche si le joueur est à moins de `rayon` m
  de la pointe à l'arrivée (un pas de côté l'évite) ; un mur l'arrête. Joueur accroché : **plus de commandes**
  (`jeu.controle(id, false)`), tiré vers le Septième à `traction` m/s jusqu'à `arrivee` m devant lui (`jeu.tirerJoueur(id,
  position)` si le jeu le fournit, sinon `jeu.teleporter` à chaque pas ; `jeu.regarder` vers le boss), puis il **frappe aussitôt**
  (action `frappe`, préparation `preparationFrappe` s) tous les joueurs ramenés, selon la règle du palier ; commandes rendues après
  le coup.
- Instantané : `boss.palier` (0–3, `null` hors phase 5), `boss.couleurLames` (`'bleu'` | `'rouge'` | `null`) ;
  `illusions: [ { id, etat: 'apparition'|'traque'|'frappe'|'dissipation'|'absente', position, lacet, vitesse, lieu, cibleJoueur,
  action: null | { id: 'frappe', etape, t, duree, progression }, t } ]` ; `crochets: [ { id, joueur, depart, position,
  etat: 'vol'|'accroche'|'traction'|'rate' } ]`.
- Évènements : `palier` {numero, couleurLames} · `illusion` {etat: 'apparition'|'dissipation'|'retour'|'fin', id, position, lieu,
  joueur? (tireur, sur `dissipation`)} · `crochet` {etat: 'lancer'|'accroche'|'rate'|'arrivee', id, joueur, position}.
- Actions (§5) : `crochet` : `preparation`, `lancer`, `traction` (cibleJoueur, cible = joueur visé).

### 16.6 Modèle 2.2
`vue.couleurLames` (`'bleu'` | `'rouge'` | `'vert'`) ou `modele.couleurLames(nom)` : teinte des lames (verre de sang, veines, cœur,
traînées, fumée). Rouge = couleurs d'origine. Les illusions sont d'autres instances du modèle (qualité basse) avec `'vert'`.
Action `crochet` : `preparation` (bras tendu vers la cible), `lancer` (geste de lancer), `traction` (il tire à deux mains).

### 16.7 Effets (`fx.js` 1.4)
Gouttes et éclaboussures des lames à la couleur du palier (bleu très clair : liquide glacé lumineux) ; passage au rouge
(embrasement des lames, onde) ; illusions : apparition (fumée sombre qui se condense, reflets verts), dissipation (bouffée de fumée
verte et étincelles), légère lueur verte des lames ; crochets : chaîne de la main du boss à la pointe (maillons, lueur), crochet en
vol, impact (étincelles, sang), traction (traînée), chute de la chaîne si raté ; salves de la phase 3 (plusieurs désignations
simultanées) ; 3e cuve (comme les autres). Les effets des mini-boss eux-mêmes restent dans le jeu (prototype : `proto-zombies.js`).

### 16.8 Sons (19 nouveaux, manifeste 114)
`demembre_cri`, `demembre_mort`, `demembre_fleau`, `demembre_impact`, `demembre_rale` (boucle) ; `irradie_boule`,
`irradie_boule_impact`, `zone_radioactive` (boucle) ; `survolte_etourdi` ; `crochet_lancer`, `crochet_accroche`,
`crochet_traction`, `crochet_rate` ; `illusion_apparition`, `illusion_dissipation`, `illusion_murmure` (boucle) ;
`palier_lames_rouges`, `palier_illusions`, `palier_crochets`.

### 16.9 Interface (`hud.js` 1.4)
3e barre de mini-boss et repère 25 % (génériques) ; un message quand les salves de la phase 3 commencent (pas à chaque salve) ;
jauge de la phase 5 : repères à 25/50/75 %, ligne d'aide selon le palier (« Lames bleues : deux coups vous tuent », « Lames
rouges : chaque coup vous laisse à 1 % », « Illusions : seules ses lames rouges blessent », « Crochets : un pas de côté
l'évite ») ; message à chaque palier ; objectif de la faiblesse (zombies).

### 16.10 Équilibrage
Simulateur : Démembré (fléau), Irradié (vitesse, aura 6 m, boules, zones avec exposition), Survolté (multi, étourdissement),
salves, zombies de la faiblesse, paliers (coups à 50 %, coups quasi mortels, illusions qui détournent une part des tirs,
crochets). Objectifs inchangés : solo avec l'arme du prototype ≥ 3/5 victoires sur les graines de référence, coop 4 : 5/5. S'ils
ne sont pas tenus : régler PV et dégâts, jamais les mécaniques ni les choix d'Anthony ci-dessus.

### 16.11 Précisions de l'implémentation (logique 1.4.0)
- **API** : `combat.toucherIllusion({ id, joueur, position })` → `{ applique, raison }` avec `raison` `'absent'` (hors phase 5 ou
  après `detruire`), `'inconnue'` (id inconnu), `'absente'` (déjà en dissipation ou absente), `null` si la balle porte. Elle ne
  touche ni la jauge ni la fenêtre de la téléportation sur dégâts et n'émet pas `degats`.
- **Mini-boss** : tout est générique (`ordre`, `seuils`, `arene.salle.tubes`, de longueur quelconque ; `valider` exige autant de
  seuils que de mini-boss) ; garde-fous, `allerA` et `echec` de la v1.3 s'appliquent à la 3e cuve. Les capacités (décharge
  multiple, étourdissement, boules, zones, fléau) sont exécutées par le jeu : la logique transmet seulement le profil.
- **Salves** : actives quand les PV de la phase 3 sont ≤ `seuil` × max (vérifié à chaque décision d'arrachement). Dalles : parmi
  les dalles libres (de préférence à plus de 4 m de tous les joueurs valides), une par mur, tirée au hasard parmi les
  `blocs` + 2 murs les plus proches du boss ; s'il manque des murs, les dalles libres les plus proches. Répartition :
  joueurs valides triés par id, le premier servi avance d'un cran à chaque salve. `predictions[k]` a le sens de
  `arrachement.prediction` (fraction du mouvement du joueur pendant le vol) ; le décalage est perpendiculaire à la visée
  horizontale, `+decalage` pour k = 2, 4…, `−decalage` pour k = 3, 5… Les blocs attendent au-dessus du boss, à 1,8 m vers leur
  mur (hauteurs alternées de 0,35 m) ; le i-ième part à `projection + i × ecart` s du début de l'étape `projection`.
  `maxArraches` raccourcit la salve (`blocs` ≤ max − portions déjà arrachées ; aucune → nouvel essai 0,5 s plus tard) ;
  `blocsSimultanes` ne compte pas. `intervalle` part du début de la salve (désignation). `action.cibleJoueur` = cible du
  premier bloc. L'évènement `action` ne porte pas `donnees` : les lire dans `etat().boss.action`.
- **Faiblesse** : `phase4.faiblesse.apparitions` (`true` = celles du rituel, `null`/`false` = aucune) démarrées à l'entrée,
  plafond + `coop.zombiesParJoueurSupp` × (n − 1), coupées à la sortie ; effet `'breche'`, `vitesse`/`agressif` de
  `config.zombies` comme ailleurs.
- **Paliers** : `palier` {numero: 0, couleurLames: 'bleu'} part à l'entrée en phase 5 (aussi par `allerA('phase5')`). Le palier
  est recalculé à chaque pas et dans `toucherBoss` juste après `degats` : un évènement par seuil franchi, dans l'ordre (un
  coup peut en franchir plusieurs). `boss.palier`/`couleurLames` restent visibles en `defaite` (palier acquis ;
  `allerA('defaite')` → 3). Coup au palier 0 : `infligerDegats(bleu.degats, { source: 'frappe' })` (réductions permises), puis
  invulnérable `bleu.invulnerabilite` s, ni `critique` ni disparition. Palier ≥ 1 : `pvFraction` ≤ `critique` →
  `infligerDegats(1, { ignorerReductions: true })` (il meurt) ; sinon `blessureCritique(pvRestants)`, invulnérable
  `frappe.invulnerabilite` s, `critique` ; tout coup qui porte (même mortel) le fait disparaître `disparition.duree` s.
  `frappe` {joueur, reussie, speciale (palier ≥ 1), palier}. Sans `phase5.paliers` dans la config : `palier` null, aucun
  évènement, chaque coup qui porte suit la règle « 1 % ». `phase5.frappeOrdinaire` et `phase5.frappe.immunite` ne servent
  plus (clés gardées) ; `joueurs[id].immuniteFrappeJusqua` vaut toujours 0. La téléportation sur dégâts interrompt toujours
  la préparation d'un coup (y compris celui qui suit les crochets : les joueurs ramenés sont alors libérés).
- **Illusions** : créées au palier 2, leur nombre suit l'effectif (arrivée → `apparition`, départ → `fin` de la dernière).
  Point d'apparition : un point de `pointsBunker('boss')` à ≥ `distanceMin` m de tous les joueurs valides et à ≥ 2 m du
  Septième et des autres illusions (au hasard) ; sinon un point valide (`jeu.positionValide`) à `distanceMin` –
  `distanceMin` + 10 m d'un joueur ; sinon le point le plus éloigné des joueurs ; aucun → `absente`, nouvel essai 1 s plus
  tard. Cible : le joueur valide le moins suivi par les autres illusions, puis le plus proche. Traque : `jeu.chemin`,
  vitesses et recalcul de `phase5.traque` ; geste quand elle est à `distanceAttaque` en ligne de vue (`jeu.visible`,
  |Δy| < 2) : `frappe.preparation`, `frappe.frappe`, `frappe.recuperation` dans `illusions[].action`, sans dégât ni
  évènement ; coincée (moins de 1 m en `delaiBlocage` s) → elle reparaît ailleurs (`retour`). `vitesse` de l'instantané =
  déplacement du pas / dt. Toutes `fin` à l'entrée en phase 5, à la défaite, sur `echec` et sur `allerA`.
- **Crochets** : prêt quand palier ≥ 3, `temps` ≥ disponibilité (aussitôt le palier 3 atteint, puis `recharge` s après le
  début de l'action précédente), Septième présent, vulnérable, pas disparu, sans action, au moins une cible ; testé avant
  la traque à chaque pas. Cibles (recalculées à l'étape `lancer`) : joueurs valides du bunker à `porteeMin`–`porteeMax` m
  (horizontal), touchables, pas déjà accrochés, en vue de la main (`jeu.visible(main, torse)`). Chaque crochet part de la
  main vers le torse du joueur (position + 1 m) au lancer, en ligne droite à `vitesse` m/s ; à chaque pas
  `jeu.visible(avant, après)` faux → `rate` (`raison: 'mur'`). À l'arrivée : accroché si le joueur est valide, touchable, à
  ≤ `rayon` m (horizontal) de la pointe et |Δy| < 2, sinon `rate` (`raison: 'esquive'`) ; un crochet raté reste 0,6 s dans
  `etat().crochets`. Accroché : `jeu.controle(id, false)` jusqu'au coup, `jeu.regarder(id, Septième, 1,5 s)`. L'étape
  `traction` commence quand plus aucun crochet ne vole (aucun accroché : l'action s'arrête après `lancer`) : chaque pas,
  vers Septième + (direction Septième → joueur au début de la traction) × `arrivee`, à `traction` m/s, par
  `jeu.tirerJoueur(id, p)` ou à défaut `jeu.teleporter(id, p, lacet vers le Septième, 'bunker')` ; sécurité : distance /
  `traction` + 1 s ; évènement `arrivee`. Puis action `frappe` (`preparation` = `preparationFrappe`) sur tous les joueurs
  ramenés, sans test de portée ni d'angle, selon la règle du palier ; commandes rendues et crochets retirés juste après
  le coup (ou si le coup est annulé). Un joueur mort ou parti pendant la traction : crochet `rate`, joueur libéré.
  `echec`, `defaite` et `allerA` retirent les crochets et rendent les commandes.
- **`allerA`** : ni illusion ni crochet, recharge remise à zéro ; palier null, sauf `phase5` (0) et `defaite` (3).
- **`config.valider`** contrôle aussi `phase3.salve`, `phase4.faiblesse.apparitions`, `phase5.paliers` (seuils croissants dans
  ]0, 1[, critique, bleu, illusions, crochet avec `porteeMin` < `porteeMax`), `boules`, `fleau` et `decharge.etourdissement`.

## 17. Version 1.5 — rages des mini-boss, murs électrifiés, Démembré géant, intangibilité de la phase 5 (fait foi)

Demande d'Anthony du 30/10 après la v1.4. Choix validés par Anthony : Démembré qui lance son bras → **flot continu plafonné**
de Démembrés de taille normale (un toutes les 2,5 s, au plus 6 vivants en solo, +2 par joueur), qui s'effondrent à sa mort ;
zombies et chiens irradiés → **lueur verte et petite aura** (1,5 m, 4 % des PV par seconde). Les **illusions de la phase 5 sont
supprimées** et remplacées par l'intangibilité. Versions : logique 1.5.0, modèle 2.3.0, fx 1.5.0, audio 1.5.0, hud 1.5.0.
Rien d'autre ne change (lames bleues/rouges, crochets, salves, faiblesse, boules et zones de l'Irradié, étourdissement…).

### 17.1 Rages des mini-boss (phase 2, à la moitié de leurs PV)
`config.miniBoss.<type>.rage = { seuil: 0.5, capacite, duree, … }`. La logique suit les PV de chaque mini-boss (`jeu.zombies()`,
`pv`/`pvMax`) ; au 1er passage sous `seuil` × pvMax, elle déclenche sa rage **une fois** : évènement `miniBoss { etat: 'rage',
id, type, nom, position, capacite }`, instantané `miniBoss[i].rage` (`null` → `capacite` ; `actif` une fois `duree` écoulée) et
`miniBoss[i].invulnerable` (vrai pendant `duree` pour `surcharge` et `arrachement`), puis `jeu.effetZombie(id, capacite, params)`.
Le jeu exécute l'animation et l'invulnérabilité (`toucher` sans effet pendant `duree`, retour « immunisé »). Tout s'arrête à la mort
du mini-boss (et sur `echec`, `allerA`, nouveau combat).

**Le Survolté — `surcharge`** (`duree` 2,5 s) : `jeu.effetZombie(id, 'surcharge', { duree, source: <torse du Septième> })`.
Il s'immobilise, bras levés vers le Septième, invulnérable, et **puise de la force dans le Septième** : effet visuel seulement
(rayon d'énergie du torse du Septième au Survolté, `fx.js`), **aucun effet sur le Septième**. À la fin : **murs électrifiés**
jusqu'à sa mort. `config.miniBoss.murs = { distance: 2.2, degatsParSeconde: 0.12, tick: 0.25, extinction: 1.0 }` : tous les
murs de la salle (les 8 pans de l'octogone, plafond compris pour l'effet ; le sol, les piliers et les cuves non compris).
Dégâts : tout joueur valide de la salle dont la distance au **plan du mur le plus proche** (apothème `arene.salle.apotheme` le long
de la normale du mur) est < `distance` prend `degatsParSeconde × tick` toutes les `tick` s (`infligerDegats(id, f, { source:
'murs' })`) ; évènement `mursChoc { joueur, position, mur }` au plus une fois par joueur et par 0,5 s. Instantané `murs: null |
{ etat: 'charge' | 'electrifies' | 'extinction', t, distance }` (`charge` pendant la surcharge) ; évènement `murs { etat }`
(`charge`, `electrifies`, `extinction` à la mort du Survolté, `eteints` `extinction` s plus tard). Les robots et les coéquipiers
simulés restent à plus de `distance` + 0,5 m des murs tant qu'ils sont électrifiés.

**L'Irradié — `infection`** (`duree` 1,2 s, il reste vulnérable) : il irradie **tous les zombies et chiens** de la salle (pas les
mini-boss) et **chaque zombie ou chien qui y apparaîtra** tant qu'il vit : `jeu.effetZombie(zid, 'irradie', { actif: true, aura:
{ rayon: 1.5, degatsParSeconde: 0.04 }, couleur })` pour chaque entité listée par `jeu.zombies()` (vérifié à chaque pas : celles
du jeu comme celles de la logique) ; à sa mort, `jeu.effetZombie(zid, 'irradie', { actif: false })` pour toutes. Le jeu affiche
la lueur verte et applique l'aura (dégâts continus à `aura.rayon` m, comme l'aura de L'Irradié). Instantané `infection: null |
{ active, ids }` ; évènements `infection { etat: 'debut' | 'fin', nombre }`.

**Le Démembré — `arrachement`** (`duree` 2,4 s, `vol` 1,2 s) : `jeu.effetZombie(id, 'arrachement', { duree, vol, cible:
<centre de la salle, sol> })`. Invulnérable, il **s'arrache le bras** et le **lance au centre de la salle** (projectile en cloche,
le bras reste posé jusqu'à sa mort). Évènements `bras { etat: 'arrache' | 'lance' | 'pose' | 'fletri', position }` (`pose` à
`duree` s : le bras est au sol ; `fletri` à sa mort) ; instantané `bras: null | { etat: 'vol' | 'pose' | 'fletri', position, t }`.
Dès `pose` (+ `petits.premier` s), **flot de Démembrés de taille normale** : un toutes les `petits.intervalle` s tant que moins
de `petits.max + petits.maxParJoueurSupp × (n − 1)` sont vivants : `jeu.faireApparaitreZombie({ position (cercle de `rayon` m
autour du bras), lieu: 'salle', effet: 'bras', source: 'boss', type: 'demembre_petit', profil: petits.profil, vitesse: 'sprint',
agressif: true })`. Ce ne sont pas des mini-boss : pas de barre, pas de protection ; ils sont exclus des absorptions, des plafonds
de zombies et des `reduireEnCendres` (comme les chiens). À la mort du Démembré : `retirerZombie(pid, { effet: 'effondrement',
points: false })` pour tous, `bras { etat: 'fletri' }`. Instantané `petits: [ids]` ; évènement `petitDemembre { etat:
'apparition' | 'effondrement', id, position }`.
**Sans bras**, le Démembré **charge** (IA du jeu, profil `charge`) : il s'arrête `preparation` s (il gratte le sol, tête basse), puis
fonce en ligne droite à `vitesse` m/s sur au plus `distanceMax` m ; tout joueur à moins de `largeur` m de sa trajectoire prend
`degats` et est **projeté** (`projection.vitesse` m/s pendant `projection.duree` s, dans le sens de la charge écarté vers
l'extérieur) ; un joueur projeté qui heurte un mur prend `impactMur` en plus. S'il heurte un mur ou un pilier, il reste étourdi
`etourdiMur` s. Recharge `recharge` s. Il garde ses coups au contact (bras droit).

**Démembré géant** : `echelle: 2` (3,9 m de haut, deux fois plus large ; rayon de collision, zones de tir et cercle de navigation ×2),
fléau `portee` 6 m (preparation 0,7 s). Sa cuve (`tube2`) est agrandie : rayon 1,3 m, hauteur 4,4 m, en (0 ; 13,1). Point
d'apparition des mini-boss : `max(siphon.apparition.distance, rayon de la cuve + 1,3)` m devant la cuve.

### 17.2 Munitions max à la mort de chaque mini-boss
`config.miniBoss.bonusMort = { actif: true, type: 'munitions-max', duree: 30 }` : à la mort d'un mini-boss, la logique appelle
`jeu.faireApparaitreBonus({ type, position: <là où il tombe>, lieu: 'salle', duree })` (comme `bonusFinDePhase`, même repli) ;
évènement `bonus { type, position, lieu, mode: 'depose', source: 'miniBoss', miniBoss: <type> }`.

### 17.3 Phase 5 : intangibilité (remplace les illusions au palier 2)
`config.phase5.paliers.intangible = { evanouissement: 0.7, resurgissement: 0.5, vitesse: 6.5, distanceReapparition: 6,
distanceProche: 3.0, proximite: 10, delaiInvisible: 1.5, recharge: 6, dureeMax: 12, preparationFrappe: 0.5, fente: { vitesse: 9,
distanceArret: 1.8 } }`. La clé
`illusions` est retirée : plus d'illusions, plus de `toucherIllusion` (l'API répond `{ applique: false, raison: 'absent' }`),
`etat().illusions` toujours `[]`.
Au palier ≥ 2, quand le Septième est visible, sans action, et qu'**aucun joueur valide n'est à moins de `proximite` m** depuis
`delaiInvisible` s, et au moins `recharge` s après son dernier resurgissement (aussitôt au premier passage au palier 2) :
1. action `evanouissement` (étape `fondu`, `evanouissement` s) : il s'efface ; puis `boss.visible = false`, `boss.intangible =
   true`, locomotion `intangible`. Intangible : `toucherBoss` → `{ applique: false, raison: 'absent' }`, la jauge est gelée (ni
   montée ni baisse), pas de téléportation sur dégâts, pas de crochet.
2. Il fonce **en ligne droite** vers le joueur valide le plus proche (`cibleJoueur`), à `vitesse` m/s, **en traversant les murs**
   (aucun chemin, position non validée en vol). Chaque passage dans un mur (segment de son pas sans ligne de vue,
   `jeu.visible(avant, après)` faux) → évènement `intangible { etat: 'traversee', position }` (au plus un par mur traversé).
3. **Resurgissement** : après au moins une traversée, dès qu'un joueur valide est à ≤ `distanceReapparition` m **en vue** et que sa
   position est valide (`jeu.positionValide`) ; ou dès qu'il est à ≤ `distanceProche` m d'un joueur (position valide) ; ou au bout de
   `dureeMax` s (au point valide le plus proche). Action `resurgissement` (étape `apparition`, `resurgissement` s), `boss.visible`
   vrai, `intangible` faux ; pendant l'apparition **il fond sur le joueur valide le plus proche** s'il le voit (`fente.vitesse`
   m/s, jusqu'à `fente.distanceArret` m, chaque pas sur une position valide, jamais à travers un mur), puis **il le frappe
   aussitôt** (action `frappe`, préparation `preparationFrappe` s, règle du palier). Entre le moment où il redevient visible et
   le coup : 1,0 s (assez pour s'écarter). Évènements `intangible { etat: 'debut' | 'fin', position }`.
4. Il recommence quand plus aucun joueur n'est près de lui (règle du début).
Instantané : `boss.intangible` (bool). Modèle 2.3 : actions `evanouissement` (`fondu`) et `resurgissement` (`apparition`).

### 17.4 Effets (`fx.js` 1.5)
Surcharge : rayon d'énergie du torse du Septième au Survolté (arcs, pulsations vers le Survolté), Survolté illuminé ; murs
électrifiés : arcs qui courent sur les 8 murs et la bordure du plafond, lueur bleue des dalles, étincelles, éclairs aléatoires,
**liseré lumineux au sol** à `distance` m des murs (lisibilité du danger), choc sur le joueur touché (`mursChoc`), extinction.
Infection : onde verte qui part de L'Irradié et rejoint chaque zombie (`infection` `debut`), petite lueur verte au sol sous chaque
zombie irradié (instantané `infection.ids` + `monde.positionZombie`). Bras : impact au centre, mare de sang, tendons qui palpitent,
sortie de chaque petit Démembré (`petitDemembre`), flétrissement. Intangibilité : évanouissement (fumée sombre qui s'effondre,
braises), **ondulation sur le mur** à chaque traversée (pierre qui ondoie, poussière, ectoplasme sombre), très léger miroitement à
≤ 4 m quand il est invisible, resurgissement (déflagration de fumée rouge sombre). Effets des illusions retirés (`palier 2` →
intangibilité).

### 17.5 Sons (`audio.js` 1.5, manifeste 133)
23 nouveaux : `survolte_surcharge`, `murs_electrification`, `murs_boucle` (boucle),
`murs_arc`, `murs_choc`, `murs_extinction` ; `irradie_infection`, `zombie_irradie` (boucle courte) ; `demembre_arrachement`,
`bras_lancer`, `bras_impact`, `bras_pulsation` (boucle), `petit_sortie`, `demembre_charge`, `demembre_percussion`,
`projection_mur`, `bras_fletri`, `petit_effondrement` ; `intangible_debut`, `intangible_boucle` (boucle), `traversee_mur`,
`resurgissement`, `palier_intangible`. Régénérés plus graves (géant) : `demembre_cri`, `demembre_mort`, `demembre_rale`,
`demembre_fleau`. Retirés : `illusion_apparition`, `illusion_dissipation`, `illusion_murmure`, `palier_illusions`.
Boucles : une par mur électrifié (8, aux centres des murs) avec des arcs au hasard ; grésillement `zombie_irradie` sur les 5
entités irradiées les plus proches à moins de 14 m — il faut passer `ctx.positionZombie(id) → { x, y, z } | null` à
`audio.mettreAJour(dt, etat, ctx)` (sans elle, pas de grésillement) ; `intangible_boucle` suit le Septième invisible (portée
8 m : on l'entend venir). `sonMiniBoss(type, 'charge' | 'projection', …)` pour la charge du Démembré et la projection contre un
mur (voir `proto/proto-boss.js`).

### 17.6 Interface (`hud.js` 1.5)
Messages à chaque rage (« Le Survolté puise dans le Septième… », « Murs électrifiés : éloignez-vous des murs ! », « L'Irradié
contamine les zombies ! », « Le Démembré s'arrache le bras ! ») ; ligne d'état « Murs électrifiés » tant qu'ils le sont ; barre du
mini-boss : « Invulnérable » pendant `miniBoss[i].invulnerable` ; Munitions max (message existant) ; aide du palier 2 :
« Intangible : invisible, il traverse les murs et surgit pour frapper » ; message du palier 2 mis à jour.

### 17.7 Équilibrage
Objectifs inchangés (solo avec l'arme du prototype ≥ 3/5 sur les graines de référence, coop 4 : 5/5) mais **la v1.4 ne les tenait
déjà pas en solo** (1/5, 9/40). Mesures de la v1.5 (robots moyens du simulateur, 40 graines : `NG=40 node tests/logique/campagne.js`
depuis la racine du paquet) :

| Mode | v1.5 brute | v1.5 livrée (petits 250 PV, fléau des petits 10 %, fente) |
|---|---|---|
| solo, tir continu | 33/40 | 37/40 |
| solo, arme du prototype (chargeur 30) | 2/40 | 6/40 (0/5 sur les graines de référence) |
| coop 4, tir continu | 40/40 | 40/40 |
| coop 4, arme du prototype | 35/40 | 35/40 (5/5) |

Réglage appliqué (variante A2) : petits Démembrés 450 → 250 PV, leur fléau 15 → 10 %. En solo avec l'arme du prototype, les morts
viennent surtout des zombies ordinaires de la phase 2 (≈ 60 %) : l'objectif ≥ 3/5 n'est pas atteignable avec les seuls PV,
dégâts et distances des mécaniques v1.5 ; c'est une décision d'Anthony (dégâts ou plafond des zombies ordinaires en phase 2).
La fente du resurgissement ne change pas ces taux : les robots, qui fuient 0,45 s après le resurgissement, l'esquivent ; un
joueur qui ne bouge pas est touché.

### 17.8 Précisions de l'implémentation (logique 1.5.0)
- **Rages** : déclenchées au premier pas où `pv` ≤ `seuil` × `pvMax` (lus dans `jeu.zombies()`) pour un mini-boss actif déjà
  listé ; un mini-boss tué d'au-dessus du seuil entre deux pas n'a pas de rage ; `rage: null` → aucune. `miniBoss[i].rage.t` =
  s depuis le déclenchement, `actif` à `duree` s ; `invulnerable` de 0 à `duree` s pour `surcharge` et `arrachement` (c'est le
  jeu qui rend `toucher` sans effet). `source` de la surcharge = torse du Septième au déclenchement (position +
  `boss.hauteurTorse`, 1,3 m par défaut), non remise à jour. Mini-boss remis devant sa cuve par le garde-fou de la v1.3 après
  sa rage : `effetZombie(nouvelId, capacite, { …, duree: <animation restante, 0 si finie>, reprise: true })` — le jeu reprend
  l'état sans rejouer le début (aucun second bras) ; murs, infection, bras et petits continuent.
- **Murs** : `charge` dès la rage, `electrifies` à `duree` s (premiers dégâts `tick` s plus tard), `extinction` à la mort,
  `eteints` `extinction` s après ; aucun dégât en `charge` ni en `extinction`. Seuls les joueurs valides de la salle sont
  touchés (pas les zombies) : distance au plan = `apotheme − (p − origine)·normale` du mur le plus proche (sol et plafond
  ignorés), `infligerDegats(id, degatsParSeconde × tick, { source: 'murs' })` ; un joueur invulnérable n'est pas touché et n'a
  pas de `mursChoc`. `mursChoc.mur` = `arene.salle.murs[i].id` ; au plus un par joueur et par 0,5 s
  (`miniBoss.murs.intervalleChoc`).
- **Infection** : active à la fin du cri (`duree` s), pas au déclenchement. Entités : tout ce que `jeu.zombies()` liste dans la
  salle hors mini-boss (zombies du jeu ou de la logique, chiens de la meute ou non, petits Démembrés), vérifié à chaque pas ;
  `irradie { actif: true }` une fois par entité ; une entité qui quitte la liste n'est plus suivie (pas d'`actif: false` pour
  elle). `infection { debut }` porte le nombre irradié à l'activation ; à la mort de L'Irradié, `irradie { actif: false }`
  pour chaque entité suivie puis, si elle était active, `infection { fin }` (même nombre).
- **Bras** : en main de la rage à `duree − vol` s (instantané `bras: null`, évènement `arrache` à la position du Démembré),
  `lance` depuis son épaule (position + 3 m), cloche de 3 m jusqu'au centre au sol, `pose` à `duree` s ; `fletri` à sa mort (en
  vol : posé au point d'arrivée), gardé 3 s dans l'instantané. Mort avant le lancer : aucun autre évènement de bras.
- **Petits Démembrés** : le premier à `pose` + `premier` s, puis un essai toutes les `intervalle` s (cadence fixe : au plafond,
  l'essai est reporté) ; plafond = arrondi(`max` + `maxParJoueurSupp` × (n − 1)), n du moment ; position sur le cercle de
  `rayon` m autour du bras (angle au hasard), ramenée dans la salle et hors des piliers, validée par `jeu.positionValide`
  (8 essais, sinon sur le bras) ; apparition refusée → essai suivant. Un petit jamais listé est oublié après 3 s. Hors des
  absorptions, des plafonds, des cendres et de la contestation du cercle ; compté dans l'infection.
- **Arrêt sans suite** (`allerA`, `echec`, nouveau combat) : `murs` → `eteints` aussitôt (sans `extinction`), entités
  `irradie { actif: false }` (+ `infection { fin }` si elle était active), petits retirés `{ effet: 'silencieux' }` sans
  évènement, bras retiré sans `fletri`.
- **Munitions max de mort** : position = celle du mini-boss ramenée à ≥ 2 m de la limite des joueurs et hors des piliers (comme
  les bonus de fin de phase dans la salle) ; `bonus { type, position, lieu: 'salle', mode, source: 'miniBoss', miniBoss: type }`
  (les bonus de fin de phase portent `source: 'phase'`) ; repli `activerBonus(type, {})` si la méthode manque, refuse ou lève
  une exception ; `bonusMort.actif: false` → rien.
- **Apparition des mini-boss** : `max(siphon.apparition.distance, rayon de la cuve + siphon.apparition.ecartCuve)` (1,3 par
  défaut) → 2,15 m devant les cuves 0 et 1, 2,6 m devant la cuve géante.
- **Intangibilité** — compte « loin » : temps continu où le Septième est présent, visible et tangible avec le joueur valide le
  plus proche à ≥ `proximite` m (horizontal) ; il court aussi avant le palier 2 (joueurs déjà loin au passage du palier 2 →
  évanouissement aussitôt). Départ : palier ≥ 2, aucune action ni disparition, un joueur valide au moins, compte ≥
  `delaiInvisible`, `recharge` s depuis le dernier resurgissement (aucune avant le premier) ; le crochet passe avant s'il est
  prêt au même pas. Pendant le `fondu` il reste visible et vulnérable (la jauge monte) ; la téléportation sur dégâts ne part
  pas pendant cette action et sa fenêtre est vidée à l'évanouissement.
  Vol : cible = joueur valide le plus proche, réévaluée à chaque pas (non exposée, `boss.action` null) ; ligne droite
  horizontale à `vitesse` m/s, hauteur = celle de la cible + `traque.hauteur`, lacet vers elle ; ni chemin ni validation.
  Traversée : segment torse → torse du pas (à `boss.hauteurTorse`) sans ligne de vue → `traversee` au premier pas dans le mur
  (un évènement par mur, on en sort au premier pas de nouveau visible) ; dans un mur, seul `dureeMax` le fait resurgir.
  Resurgissement : (≤ `distanceProche` m d'un joueur valide, ou une traversée au moins et un joueur valide à ≤
  `distanceReapparition` m en ligne de vue torse → centre du joueur) et sol valide → sur place ; `dureeMax` → point valide le
  plus proche (anneaux de 0,5 à 12 m, 16 directions, sinon le point de `pointsBunker('boss')` le plus proche). Visible et
  vulnérable dès le début d'`apparition` (grâce de la jauge comme après une réapparition), `recharge` comptée depuis ce début ;
  pendant `apparition`, fente (`fente`) : à chaque pas, vers le joueur valide le plus proche s'il est en ligne de vue (torse →
  centre du joueur), pas de `min(fente.vitesse × dt, distance − distanceArret)` sur le segment, refusé si la position au sol
  n'est pas valide (`jeu.positionValide`) ; lacet vers lui ; `fente: null` → sur place. À la fin d'`apparition`, `frappe` vers
  le joueur valide le plus proche (préparation `preparationFrappe` s, règle du palier ; au palier ≥ 1, un coup qui porte le
  fait disparaître comme d'habitude). Intangible : `toucherBoss` → `absent` sans
  `immunise`, jauge `gelee` (ni montée ni baisse), ni téléportation sur dégâts, ni crochet, ni traque. Fin forcée (`allerA`,
  `echec`, `defaite`, entrée en phase 5) : de nouveau visible au point valide le plus proche s'il est dans un mur,
  `intangible { fin }` ; un évanouissement en cours est annulé avec l'action.
- **Illusions retirées** : `toucherIllusion` répond toujours `{ applique: false, raison: 'absent' }`, `etat().illusions` vaut
  `[]`, `config.valider` ne contrôle plus `phase5.paliers.illusions` (contrôle de `intangible`, des rages, de `echelle`,
  `charge`, `petits` et de leur fléau, `murs`, `bonusMort`).
- **Simulateur (tests, §17.7)** — hypothèses : rages immobiles pendant `duree` (balles sans effet pendant surcharge et
  arrachement ; les robots visent alors les zombies) ; Démembré sans bras : charge vers sa proie en vue entre l'allonge de
  son coup et `distanceMax` m (direction figée au départ vers la position de sa proie), joueurs à moins de `largeur` m du
  segment parcouru touchés une fois et projetés à 45° vers l'extérieur, `impactMur` contre un mur (pas un pilier) ; et coups
  au contact du bras droit au minutage de L'Irradié, allonge × `echelle` (avant : fléau seul, comme en v1.4) ; petits : fléau
  de leur profil ; aura des entités irradiées par
  tranches de 0,25 s ; robots à plus de `distance` + 0,5 m des murs électrifiés, pas de côté devant une charge qu'ils voient
  se préparer (après leur réaction), Septième intangible : repère = là où il a disparu, fuite quand il resurgit à moins de
  8 m ; Munitions max ramassé aussitôt (chargeur plein, réserve non simulée).
