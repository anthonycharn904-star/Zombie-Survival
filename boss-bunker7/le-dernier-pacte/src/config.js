/*!
 * config.js — Boss de Bunker 7 : TOUS les réglages d'équilibrage au même endroit.
 * Unités : secondes, mètres, m/s. Dégâts infligés AUX JOUEURS : fraction de leurs PV maximaux (0,25 = 25 %).
 * Dégâts infligés AU BOSS : points de dégâts tels que le jeu les calcule pour ses armes (mêmes unités).
 * Repère de calcul des PV : une arme « de référence » à DPS_REFERENCE dégâts/seconde en tir continu.
 * Les PV de chaque phase = secondes de tir continu × DPS_REFERENCE (tableau en tête de fichier).
 * Script classique → globalThis.BOSS_B7_CONFIG ; CommonJS → module.exports.
 */
(function (root) {
  'use strict';
  // À régler sur le DPS d'une bonne arme du jeu au moment du boss (fin de la quête de Bunker 7) : dégâts d'une balle dans le
  // corps (sans multiplicateur de tête, avec l'amélioration Pack-a-Punch que le joueur a normalement à ce moment) × balles par
  // seconde, sans compter les rechargements. Le prototype : 35 × 10 = 350. Tous les PV et seuils écrits s(…) suivent ce
  // nombre (Septième, mini-boss, chiens, petits Démembrés, zombies du combat, jauge, téléportation sur dégâts).
  var DPS_REFERENCE = 350;
  var s = function (secondes) { return Math.round(secondes * DPS_REFERENCE); };

  var CONFIG = {
    version: 1,
    dpsReference: DPS_REFERENCE,

    general: {
      nomAffiche: 'Le Septi\u00e8me',        // nom affiché (HUD, carte de titre)
      sousTitre: 'Le Dernier Pacte',
      histoire: 'Ancien directeur du programme occulte de Bunker 7, il s\u2019est soumis lui-m\u00eame au Pacte et s\u2019est li\u00e9 aux \u00e2mes des morts.',
      graine: 1939,                        // aléatoire reproductible (tests, coop)
      pasLogique: 1 / 60,                  // pas fixe de la logique (s)
      dtMax: 0.1,                          // un dt plus grand est découpé (onglet en arrière-plan)
      drapeauTermine: 'boss-b7-termine'    // drapeau de sauvegarde : empêche de relancer le combat
    },

    // Mise à l'échelle selon le nombre de joueurs (n) : calculée au démarrage, puis recalculée quand un joueur
    // rejoint ou quitte la partie (mourir et réapparaître ne compte pas). Règle détaillée dans logique.js.
    coop: {
      pvParJoueurSupp: 1.0,                // PV × (1 + 1,0 × (n − 1)) = PV × n
      jaugeParJoueurSupp: 1.5,             // dégâts de la jauge finale × (1 + 1,5 × (n − 1)) : à plusieurs, les tirs ne s'arrêtent jamais
      zombiesParJoueurSupp: 4,             // zombies simultanés en plus par joueur supplémentaire
      ciblesDifferentes: true              // le boss alterne ses cibles quand plusieurs joueurs sont valides
    },

    // Zombies du combat (v1.1) : tous courent à leur vitesse maximale et chassent dès leur apparition.
    // Passé tel quel à jeu.faireApparaitreZombie({ …, vitesse, agressif }).
    // pv (facultatif, transmis au jeu) : PV des zombies du combat ; les mesures d'équilibrage supposent ≈ 0,43 s de tir de
    // référence par zombie (150 PV pour 350) et des coups de zombie à ≈ 20 % des PV max du joueur. null : PV de la manche du jeu.
    zombies: { vitesse: 'sprint', agressif: true, pv: s(0.4286) },

    // Meute de chiens zombies (v1.2) : lâchée en seconde moitié de phase 1, elle chasse jusqu'à la mort du boss, sans
    // exception (les chiens ne sont pas des zombies pour la logique : ni plafond, ni absorption, ni cercle, ni cendres).
    chiens: {
      actif: true,
      max: 2, maxParJoueurSupp: 1,                         // chiens en même temps : 2 en solo, +1 par joueur supplémentaire
      faille: { duree: 0.9, ecart: 0.6, distance: [8, 16] }, // la faille s'ouvre `duree` s avant que le chien en jaillisse
      // §14.8 : valeurs d'origine pv 100, degats 0.1, reapparition [4, 7] → solo avec l'arme du prototype 0–1/5. Réglé sur
      // la durée de vie et la fréquence des chiens (jamais leur nombre) : solo chargeur 30 → 3/5 (10/15), coop 4 → 5/5.
      reapparition: [10, 15],                               // un chien tué est remplacé après ce délai (s)
      delaiBunker: 4,                                       // phase 5 : la meute revient dans le bunker ce délai après le réveil
      bloque: 10,                                           // chien immobile et loin des joueurs depuis ce délai → nouvelle faille
      profil: { pv: s(0.2), vitesse: 7.4, degats: 0.05, cadence: 0.9, portee: 1.4 }   // transmis au jeu ; pv 70 au DPS de référence 350
    },

    // Bonus déposé à la fin de chaque phase (v1.1) : jeu.faireApparaitreBonus({ type, position, lieu, duree }) ;
    // si le jeu ne sait pas le faire, jeu.activerBonus(type, {}) directement.
    bonusFinDePhase: { actif: true, type: 'munitions-max', duree: 30 },

    boss: {
      multiplicateurTete: 1.5,             // tir à la tête (la jauge et les PV utilisent la même règle)
      hauteurLevitation: 1.25,             // hauteur des pieds au-dessus du sol en lévitation calme (m)
      hauteurRage: 0.7,
      rayonCorps: 0.45,                    // capsule simplifiée utilisée par la logique (collisions d'attaques)
      hauteurCorps: 1.75,
      vitesseDerive: 1.2,                  // déplacement lent entre les ancres (phases 1-2)
      intervalleDerive: [5, 8],
      // Retour visuel quand le boss ne prend pas de dégâts : « IMMUNISÉ » + son de ricochet
      signalerImmunite: true
    },

    introduction: {
      fondu: 1.4,                          // effet de déclenchement + fondu au noir avant la téléportation
      apparition: 2.6,                     // le boss se forme au centre de la salle
      presentation: 3.4,                   // carte de titre, rugissement ; contrôle rendu ensuite
      joueursInvulnerables: true           // pendant toute séquence où les joueurs n'ont pas le contrôle
    },

    // ── PHASE 1 — L'Invocation des morts ──
    phase1: {
      pv: s(27),
      invocation: {
        intervalle: [4.2, 6.0],            // entre deux sorts (s)
        preparation: 1.1, lancer: 0.35, recuperation: 0.6,
        vitesseProjectile: 14,
        distanceCible: [3.5, 8.5],         // distance du point d'impact au joueur visé
        zombiesParSort: [2, 3],
        delaiEmergence: 0.35,              // entre deux zombies d'un même sort
        zone: { rayon: 2.4, delaiActivation: 0.6, duree: 4.0, degatsParSeconde: 0.08 }
      },
      trait: {                             // projectile direct, peu fréquent (punit l'immobilité)
        actif: true, intervalle: [8, 11], preparation: 0.7, lancer: 0.25, recuperation: 0.4,
        vitesse: 17, rayon: 0.55, degats: 0.12
      },
      zombiesMax: 6,                       // en solo ; + coop.zombiesParJoueurSupp par joueur supplémentaire
      // v1.2 : quand le segment de la phase 1 tombe à `seuil` de ses PV max, chaque invocation devient une paire de sorts
      // tirés SOUS le joueur visé, `ecart` s l'un après l'autre (point choisi au tir, à distanceJoueur m de ses pieds),
      // et la meute de chiens est lâchée (voir `chiens`).
      secondeMoitie: { seuil: 0.5, doubleSort: { actif: true, ecart: [1.0, 2.0], distanceJoueur: [0, 1.0] } }
    },

    repit: { duree: 15, tuerZombies: true, suspendreApparitions: true },

    // ── PHASE 2 — L'Absorption des âmes ──
    phase2: {
      pv: s(66),                           // phase longue : deux cycles ailes + piqué en solo
      invocation: {
        intervalle: [3.4, 4.8], preparation: 1.0, lancer: 0.35, recuperation: 0.5,
        vitesseProjectile: 15, distanceCible: [3.5, 9], zombiesParSort: [4, 5], delaiEmergence: 0.3,
        zone: { rayon: 2.4, delaiActivation: 0.6, duree: 3.5, degatsParSeconde: 0.08 }
      },
      absorption: {
        intervalle: [3.0, 4.0],            // entre deux absorptions (s) : les zombies nourrissent les ailes au lieu de s'accumuler
        ciblesMax: 4,                      // zombies saisis par absorption
        saisie: 0.9,                       // zombies immobilisés, qui résistent
        delaiEntreAmes: 0.35,
        volAme: 1.0,                       // durée du trajet d'une âme vers le boss
        multiplicateurDegats: 1.5,         // fenêtre d'attaque : le boss prend +50 % pendant l'absorption
        distanceMax: 20
      },
      amesPourAiles: 10,
      pique: {
        montee: 0.9,                       // le boss s'élève, ailes grandes ouvertes
        visee: 1.1,                        // ligne de visée visible au sol
        verrouillage: 0.4,                 // trajectoire figée ce temps avant la charge (esquive possible)
        vitesse: 24, depassement: 3.0,     // m/s ; il continue un peu après le point visé
        rayonImpact: 1.3, degats: 0.6,     // très lourds mais pas mortels à pleine vie
        etourdi: 1.4, multiplicateurEtourdi: 1.25, retour: 1.0
      },
      zombiesMax: 8                        // en solo
    },

    // Les deux mini-boss de la phase 2 (v1.3, API.md §15) : à chaque seuil de PV du segment de la phase 2, les PV du
    // Septième sont bloqués au seuil, il devient protégé (invulnérable) et siphonne la cuve suivante de `ordre`, qui éclate
    // et libère son mini-boss ; la protection tombe à la mort du mini-boss. Un seul mini-boss à la fois. Le Septième garde
    // ses attaques de phase 2 pendant la protection (sauf pendant le siphon). PV × (1 + coop.pvParJoueurSupp × (n − 1)) au
    // moment de l'apparition. `profil` est transmis au jeu, qui exécute l'IA et les capacités du mini-boss.
    miniBoss: {
      actif: true,
      ordre: ['survolte', 'irradie', 'demembre'],   // cuve siphonnée à chaque seuil (arene.salle.tubes[i].miniBoss) ; v1.4 : 3e, Le Démembré
      seuils: [0.75, 0.5, 0.25],           // fractions des PV du segment de la phase 2, décroissantes, une par mini-boss
      siphon: { approche: 1.0, aspiration: 2.2, fissure: 0.6, eclatement: 0.6, recuperation: 0.8,   // fissure : fraction de l'aspiration
                apparition: { delai: 0.6, distance: 1.6 } },   // s après l'éclatement ; m devant la cuve, vers le centre
      // v1.4 : plus rapide (4,2 → 5,4 m/s) ; la décharge frappe tous les joueurs valides à portée en même temps (multi) et les
      // étourdit (etourdissement s : ni déplacement, ni tir) en plus de la vision brouillée
      survolte: { nom: 'Le Survolt\u00e9', couleur: '#38D9FF', pv: s(14), vitesse: 5.4, degatsContact: 0.24, cadenceContact: 1.2,
                  decharge: { portee: 8, intervalle: 4, degats: 0.15, flou: 1.0, recharge: 2.0, multi: true, etourdissement: 1.0 },
                  // v1.5 : à la moitié de ses PV, il devient invulnérable `duree` s et puise de la force dans le Septième (effet
                  // visuel seulement), puis électrifie tous les murs de la salle jusqu'à sa mort (murs.*)
                  rage: { seuil: 0.5, capacite: 'surcharge', duree: 2.5 } },
      // v1.4 : plus rapide (2,8 → 4,4 m/s), aura bien plus grande (3 → 6 m) ; boules radioactives : salve de parVolee
      // (+ parJoueurSupp par joueur supplémentaire) toutes les intervalle s ; chaque impact crée une zone qui reste jusqu'à sa
      // mort, sans plafond (choix d'Anthony) ; dégâts par exposition : min(dpsMax, dpsBase + dpsParSeconde × secondes passées
      // dans les zones), remise à zéro après oubli s hors des zones
      irradie: { nom: 'L\u2019Irradi\u00e9', couleur: '#8CFF2E', pv: s(21), vitesse: 4.4, degatsContact: 0.16, cadenceContact: 1.4,
                 aura: { rayon: 6, degatsParSeconde: 0.07 }, flaque: { rayon: 2.5, duree: 5, degatsParSeconde: 0.07 },
                 boules: { intervalle: 6, parVolee: 2, parJoueurSupp: 1, portee: 24, tempsVol: 1.1, impact: { rayon: 1.2, degats: 0.08 },
                           zone: { rayon: 2.5, dpsBase: 0.04, dpsParSeconde: 0.05, dpsMax: 0.35, oubli: 2 } },
                 // v1.5 : à la moitié de ses PV, il irradie tous les zombies et chiens de la salle, et ceux qui y apparaîtront, jusqu'à
                 // sa mort (choix d'Anthony : lueur verte et petite aura) ; `duree` s de cri d'infection (il reste vulnérable)
                 rage: { seuil: 0.5, capacite: 'infection', duree: 1.2, aura: { rayon: 1.5, degatsParSeconde: 0.04 } } },
      // v1.4 : fiche N°02 « brute » (PV ×1,4, vitesse ×0,8, dégâts ×1,5), 1,95 m, sans faiblesse (son bras ne se détache jamais).
      // Fléau : il fait tournoyer son bras pendant (preparation s) puis frappe en arc : tous les joueurs à portee m dans un cône
      // de angle degrés devant lui. Vitesse 4,2 m/s (la fiche donnerait 3,4 : un joueur qui marche le distancerait)
      // v1.5 : deux fois plus grand et plus large (echelle 2 : 3,9 m), fléau de bien plus grande portée (2,6 → 6 m). À la moitié de
      // ses PV : invulnérable `duree` s, il s'arrache le bras et le lance au centre de la salle (vol s) ; de là sortent des
      // Démembrés de taille normale (petits : un toutes les intervalle s, au plus max + maxParJoueurSupp × (n − 1) vivants, choix
      // d'Anthony : flot continu plafonné), qui s'effondrent à sa mort. Sans bras, il charge (charge.*) : dégâts massifs et
      // joueurs projetés contre les murs.
      demembre: { nom: 'Le D\u00e9membr\u00e9', couleur: '#E3B65C', pv: s(16.3), vitesse: 4.2, degatsContact: 0.30, cadenceContact: 1.6, echelle: 2,
                  fleau: { portee: 6.0, angle: 150, preparation: 0.7, degats: 0.30 },
                  rage: { seuil: 0.5, capacite: 'arrachement', duree: 2.4, vol: 1.2 },
                  charge: { preparation: 0.8, vitesse: 13, distanceMax: 16, largeur: 1.8, degats: 0.35, projection: { vitesse: 12, duree: 0.5 },
                            impactMur: 0.10, recharge: 3.0, etourdiMur: 1.2 },
                  petits: { intervalle: 2.5, premier: 0.8, max: 6, maxParJoueurSupp: 2, rayon: 1.6,
                            // équilibrage v1.5 (variante A2 mesurée par le simulateur) : 450 → 250 PV, fléau 0,15 → 0,10 ; le flot choisi par
                            // Anthony (un toutes les 2,5 s, 6 au plus, +2 par joueur) ne change pas ; la coop 4 retrouve 5/5
                            profil: { nom: 'D\u00e9membr\u00e9', pv: s(0.715), vitesse: 4.0, degatsContact: 0.12, cadenceContact: 1.4, echelle: 1,
                                      fleau: { portee: 2.4, angle: 140, preparation: 0.6, degats: 0.10 } } } },
      // v1.5 : Munitions max posé à la mort de chaque mini-boss, là où il tombe
      bonusMort: { actif: true, type: 'munitions-max', duree: 30 },
      // v1.5 : murs électrifiés par Le Survolté (de la fin de sa surcharge à sa mort) : tout joueur à moins de `distance` m d'un mur
      // (plan du mur, sol non compris) prend degatsParSeconde (par pas de tick s) ; extinction s à sa mort
      murs: { distance: 2.2, degatsParSeconde: 0.12, tick: 0.25, extinction: 1.0 }
    },
    transition23: { souffrance: 2.2 },

    // ── PHASE 3 — La Colère du bunker ──
    absence: { duree: 30, apparitions: { intervalle: 2.0, max: 9 } },
    retourRage: { descente: 1.2, deflagration: 0.8, rugissement: 1.0 },
    phase3: {
      pv: s(30),                           // v1.1 : 36 → 30 s de tir, pour compenser le temps passé sur les zombies de la phase 3 (durée ≈ v1.0)
      resistance: 0.6,                     // dégâts reçus × 0,6 : plus résistant qu'en phases 1-2
      apparitionsSuspendues: false,        // v1.1 : les zombies reviennent pendant la phase 3…
      apparitions: { delai: 5, intervalle: 2.0, max: 8 },   // … delai s après son début (coop : + zombiesParJoueurSupp)
      piliers: {
        coupsDestruction: 3,               // blocs reçus → pilier détruit (il reste en ruine jusqu'à la fin du combat)
        margeBloc: 0.8,                    // un bloc touche un pilier quand sa trajectoire passe à moins de rayon + marge
        rayonDegats: 1.6                   // bloc écrasé sur un pilier : seuls les joueurs à moins de ce rayon du point d'impact sont touchés
      },
      arrachement: {
        intervalle: [3.0, 4.2],
        designation: 0.8, fracture: 0.6, levitation: 0.75, projection: 0.35, recuperation: 0.5,
        vitesse: 19, rayonBloc: 1.4,
        degats: 0.25,                      // AU MOINS 0,25 (25 % des PV max) : exigence du cahier des charges
        reductionsAutorisees: false,       // atouts / protections ne réduisent pas ce coup
        prediction: 0.35,                  // 0 = vise la position actuelle, 1 = anticipe tout le mouvement
        blocsSimultanes: 2,                // blocs en l'air en même temps au maximum
        maxArraches: 10,                   // portions arrachées en même temps au maximum
        reconstruction: 14                 // une portion arrachée se reforme après ce délai (s)
      },
      // v1.4 : sous seuil × PV de la phase 3, chaque arrachement devient une salve de blocs (total, répartis entre les joueurs
      // valides : 4 en solo, 2 + 2 à deux, 1 chacun à quatre) projetés à ecart s d'intervalle ; le k-ième bloc d'un joueur vise
      // sa position prédite (predictions[k]) avec un décalage latéral alterné de ± decalage m à partir du 3e ; 25 % minimum par bloc
      salve: { seuil: 0.5, blocs: 4, ecart: 0.12, intervalle: [5.0, 6.5], predictions: [0, 0.45, 0.9, 1.3], decalage: 1.1 },
      ondeChoc: { actif: true, distance: 3.5, delaiProximite: 1.0, preparation: 0.8, rayon: 5.0, degats: 0.15, recul: 6 },
      deplacement: { intervalle: [3, 5], vitesse: 3.2 }
    },
    transition34: { souffrance: 2.0 },

    // ── PHASE 4 — Le Rituel de purification ──
    phase4: {
      formation: 4.0,                      // le cercle se dessine ; capture impossible avant
      rayon: 4.5,
      duree: 30,                           // secondes de capture
      hysteresis: 0.3,                     // entrée à r ≤ rayon, sortie à r > rayon + 0,3
      regleAbandon: 'decroissance',        // 'decroissance' | 'pause' | 'reinitialisation'
      delaiAbandon: 1.0,                   // cercle vide depuis ce délai → la règle s'applique
      vitesseRecul: 1.5,                   // décroissance : secondes perdues par seconde
      bonusParJoueurSupp: 0,               // 0 = plusieurs joueurs ne vont pas plus vite (pas de contournement)
      zombiesPourContester: 6,             // zombies dans le cercle → capture « contestée » (en pause) ; 6 car la horde est bien plus grosse
      apparitions: { intervalle: 1.0, max: 22 },   // v1.1 : beaucoup plus de zombies pendant le rituel (v1.0 : 1,5 s et 12), sprinteurs ; coop : +4 par joueur
      fin: 4.2,                            // faisceau, tremblement, explosion, retour forcé du boss
      // v1.4 : des zombies apparaissent aussi pendant la faiblesse (le boss affaibli à terre) ; coop : + zombiesParJoueurSupp
      faiblesse: { pv: s(12), multiplicateur: 1.25, apparitions: { intervalle: 1.2, max: 10 }, dureeMax: 0 }
    },

    // ── PHASE 5 — Le Dernier Pacte ──
    phase5: {
      rituel: { elevation: 1.0, incantation: 2.6, capture: 1.6 },   // capture inévitable de l'âme des joueurs
      obscurite: { intensite: 0.85, rayonVision: 7.0, entree: 2.5 },
      lames: { formation: 2.0 },
      traque: {
        vitesse: 4.0, vitesseProche: 5.4, distanceProche: 8,
        distanceAttaque: 2.3, recalculChemin: 0.6, delaiBlocage: 4.0, hauteur: 0.25
      },
      frappe: {                            // coup du Septième ; v1.4 : au palier ≥ 1 (voir paliers), il laisse le joueur à pvRestants
        preparation: 0.6, frappe: 0.18, recuperation: 0.5, recuperationRatee: 1.2,
        portee: 2.8, angle: 75,            // portée (m) et ouverture (degrés) au moment de l'impact
        pvRestants: 0.01,
        invulnerabilite: 3.0,              // le joueur frappé ne peut plus rien subir pendant ce temps (v1.1 : 3 s, zombies sprinteurs)
        immunite: 15                       // v1.4 : ne sert plus (chaque coup suit la règle du palier) ; gardée pour la compatibilité
      },
      frappeOrdinaire: { preparation: 0.45, frappe: 0.15, recuperation: 0.5, degats: 0.2 },   // v1.4 : ne sert plus (paliers) ; gardée pour la compatibilité
      disparition: { duree: 10, distanceMin: 15 },    // après un coup réussi au palier ≥ 1 (v1.4 ; avant : frappe spéciale)
      // v1.1 : au moins `seuil` dégâts reçus sur les `fenetre` dernières secondes (≈ un chargeur) → téléportation rapide
      // vers un point atteignable à distanceMin–distanceMax m du tireur ; au plus une fois toutes les delaiMin s ;
      // la jauge reste gelée pendant la téléportation puis gelJauge s (ou jusqu'au prochain tir qui le touche).
      // v1.1 : ≈ 18 balles du prototype (630 dégâts) en 3 s → il se téléporte, y compris pendant l'élan d'une frappe
      // (+75 % du seuil par joueur supplémentaire, sinon il ne ferait que se téléporter à 4)
      teleportDegats: { actif: true, seuil: s(1.8), fenetre: 3.0, seuilParJoueurSupp: 0.75, delaiMin: 5, distanceMin: 12, distanceMax: 32, gelJauge: 8 },
      jauge: {
        degatsRequis: s(18),               // « dégâts consécutifs » pour rompre le pacte
        delaiAvantBaisse: 2.0,             // sans dégât depuis ce délai, la jauge baisse…
        vitesseBaisse: 0.12,               // …de 12 % par seconde
        gelEnAbsence: true                 // la jauge ne baisse pas quand le boss a disparu
      },
      apparitions: { intervalle: 2.6, max: 7 },
      // v1.4 : paliers de la jauge (atteints une fois, acquis) : 0 = lames bleu très clair, chaque coup inflige bleu.degats
      // (deux coups tuent) ; 1 (25 %) = lames rouges, chaque coup laisse à frappe.pvRestants (1 %), un joueur déjà sous
      // critique meurt ; 2 (50 %) = v1.5 : intangibilité (les illusions de la v1.4 sont retirées, demande d'Anthony) : loin de
      // tous les joueurs, il devient invisible et traverse les murs en ligne droite vers un joueur, puis resurgit et frappe ;
      // 3 (75 %) = + crochets (recharge s) qui ramènent les joueurs accrochés devant lui, puis il frappe aussitôt
      paliers: {
        seuils: [0.25, 0.5, 0.75],
        critique: 0.05,
        bleu: { degats: 0.5, invulnerabilite: 1.0 },
        // v1.5 : evanouissement / resurgissement = durées des fondus ; vitesse invisible (m/s, en ligne droite, murs ignorés) ;
        // il resurgit après avoir traversé au moins un mur quand un joueur est à distanceReapparition m en vue, ou dès qu'il est à
        // distanceProche m d'un joueur, ou au bout de dureeMax s ; il redevient invisible quand aucun joueur n'est à proximite m
        // depuis delaiInvisible s et recharge s après son dernier resurgissement ; fente : pendant le resurgissement il fond sur le
        // joueur le plus proche en vue (vitesse m/s, jamais à travers un mur) jusqu'à distanceArret m, puis frappe (portée 2,8 m)
        intangible: { evanouissement: 0.7, resurgissement: 0.5, vitesse: 6.5, distanceReapparition: 6, distanceProche: 3.0,
                      proximite: 10, delaiInvisible: 1.5, recharge: 6, dureeMax: 12, preparationFrappe: 0.5,
                      fente: { vitesse: 9, distanceArret: 1.8 } },
        crochet: { recharge: 15, porteeMin: 4, porteeMax: 22, preparation: 0.7, vitesse: 26, rayon: 0.9, traction: 14, arrivee: 1.3, preparationFrappe: 0.25 }
      }
    },

    // ── Défaite, conclusion, récompenses ──
    defaite: { chancelle: 1.5, genoux: 1.2, chute: 1.3, desintegrationLames: 2.0, retourSalle: 1.6 },
    conclusion: {
      interaction: { rayon: 2.6, duree: 2.5, texte: 'Maintenir la touche d’interaction pour achever le rituel', autoValidation: 120 },
      recompenses: {
        armes: [{ id: 'merveille-1', pap: 3 }, { id: 'merveille-2', pap: 3 }],
        atouts: 'tous',                    // 'tous' = jeu.listeAtouts() ; ou tableau d'identifiants
        bonus: ['munitions-max', 'mort-instantanee', 'points-doubles', 'bombe-nucleaire', 'charpentier',
                'vente-flash', 'points-bonus', 'atout-gratuit', 'machine-de-mort'],
        delaiEntreBonus: 1.3,
        recompenserMorts: 'a-la-reapparition',   // joueur mort à la fin : récompensé à sa réapparition
        repliInventairePlein: 'autel'      // arme refusée par l'inventaire → déposée sur l'autel, jamais perdue
      },
      message: {
        lignes: [
          'Félicitations ! Vous avez terminé l’histoire principale de Bunker 7 !',
          'La suite de votre aventure vous attend sur Khamsin...',
          'Mais attention : tous les secrets de Bunker 7 n’ont pas encore été révélés. De nombreux mystères restent à découvrir !'
        ],
        duree: 10
      },
      retourBunker: 2.0
    },

    // ── Garde-fous (anti-blocage) ──
    securite: {
      zombieBloque: 15,                    // zombie invoqué immobile et loin des joueurs → remplacé
      bossHorsLimites: true,               // ramené dans l'arène / sur un point valide
      transitionWatchdog: 1.0,             // PV ≤ 0 mais pas de transition depuis ce délai → transition forcée
      dureeMaxPhase: 900                   // avertissement seulement (ne force rien)
    }
  };

  /** Contrôle les valeurs qui doivent respecter le cahier des charges. Renvoie une liste d'avertissements. */
  CONFIG.valider = function (c) {
    c = c || CONFIG;
    var w = [];
    if (c.phase3.arrachement.degats < 0.25) w.push('phase3.arrachement.degats < 0,25 : le cahier des charges exige au moins 25 % des PV max');
    if (c.phase5.frappe.pvRestants !== 0.01) w.push('phase5.frappe.pvRestants ≠ 0,01 : le cahier des charges demande 1 %');
    if (c.repit.duree !== 15) w.push('repit.duree ≠ 15 s');
    if (c.absence.duree !== 30) w.push('absence.duree ≠ 30 s');
    if (c.phase4.duree !== 30) w.push('phase4.duree ≠ 30 s');
    if (c.phase2.amesPourAiles < 1) w.push('phase2.amesPourAiles doit être ≥ 1');
    ['phase1', 'phase2', 'phase3'].forEach(function (p) { if (!(c[p].pv > 0)) w.push(p + '.pv doit être > 0'); });
    if (!(c.phase4.faiblesse.pv > 0)) w.push('phase4.faiblesse.pv doit être > 0');
    if (!(c.phase5.jauge.degatsRequis > 0)) w.push('phase5.jauge.degatsRequis doit être > 0');
    if (c.phase2.pique.visee <= c.phase2.pique.verrouillage) w.push('phase2.pique : la visée doit durer plus longtemps que le verrouillage');
    if (c.phase3.piliers && !(c.phase3.piliers.coupsDestruction >= 1)) w.push('phase3.piliers.coupsDestruction doit être ≥ 1');
    var sm = c.phase1.secondeMoitie;
    if (sm) {
      if (!(sm.seuil > 0 && sm.seuil < 1)) w.push('phase1.secondeMoitie.seuil doit être entre 0 et 1 (exclus)');
      var ds = sm.doubleSort;
      if (ds && ds.actif) {
        if (!(ds.ecart && ds.ecart[0] > c.phase1.invocation.lancer && ds.ecart[0] <= ds.ecart[1])) w.push('phase1.secondeMoitie.doubleSort.ecart : [min, max] avec min > phase1.invocation.lancer');
        if (!(ds.distanceJoueur && ds.distanceJoueur[0] >= 0 && ds.distanceJoueur[0] <= ds.distanceJoueur[1])) w.push('phase1.secondeMoitie.doubleSort.distanceJoueur : [min, max] avec 0 ≤ min ≤ max');
      }
    }
    var ch = c.chiens;
    if (ch && ch.actif) {
      if (!(ch.max >= 1)) w.push('chiens.max doit être ≥ 1');
      if (!(ch.maxParJoueurSupp >= 0)) w.push('chiens.maxParJoueurSupp doit être ≥ 0');
      if (!(ch.faille && ch.faille.duree >= 0 && ch.faille.ecart >= 0 && ch.faille.distance && ch.faille.distance[0] <= ch.faille.distance[1])) w.push('chiens.faille : duree ≥ 0, ecart ≥ 0, distance [min, max]');
      if (!(ch.reapparition && ch.reapparition[0] >= 0 && ch.reapparition[0] <= ch.reapparition[1])) w.push('chiens.reapparition : [min, max] avec 0 ≤ min ≤ max');
      if (!(ch.delaiBunker >= 0)) w.push('chiens.delaiBunker doit être ≥ 0');
      if (!(ch.bloque > 0)) w.push('chiens.bloque doit être > 0');
      var pf = ch.profil || {};
      if (!(pf.pv > 0 && pf.vitesse > 0 && pf.degats >= 0 && pf.cadence > 0 && pf.portee > 0)) w.push('chiens.profil : pv, vitesse, cadence, portee > 0 et degats ≥ 0');
    }
    var mb = c.miniBoss;
    if (mb && mb.actif) {
      var ordre = mb.ordre || [], seuils = mb.seuils || [];
      if (!ordre.length || ordre.length !== seuils.length) w.push('miniBoss : ordre et seuils doivent avoir la même longueur (≥ 1)');
      for (var si = 0; si < seuils.length; si++) {
        if (!(seuils[si] > 0 && seuils[si] < 1)) w.push('miniBoss.seuils[' + si + '] doit être entre 0 et 1 (exclus)');
        if (si > 0 && !(seuils[si] < seuils[si - 1])) w.push('miniBoss.seuils doit être strictement décroissant');
      }
      var sp = mb.siphon || {};
      if (!(sp.approche >= 0 && sp.aspiration >= 0 && sp.eclatement >= 0 && sp.recuperation >= 0)) w.push('miniBoss.siphon : durées ≥ 0');
      if (!(sp.fissure >= 0 && sp.fissure <= 1)) w.push('miniBoss.siphon.fissure : fraction de l\u2019aspiration entre 0 et 1');
      if (!(sp.apparition && sp.apparition.delai >= 0 && sp.apparition.distance >= 0)) w.push('miniBoss.siphon.apparition : delai ≥ 0, distance ≥ 0');
      ordre.forEach(function (t) {
        var pm = mb[t];
        if (!pm) { w.push('miniBoss.' + t + ' : profil absent'); return; }
        if (!(pm.pv > 0 && pm.vitesse > 0 && pm.degatsContact >= 0 && pm.cadenceContact > 0)) w.push('miniBoss.' + t + ' : pv, vitesse, cadenceContact > 0 et degatsContact ≥ 0');
        if (pm.decharge && !(pm.decharge.portee > 0 && pm.decharge.intervalle > 0 && pm.decharge.degats >= 0 && pm.decharge.flou >= 0 && pm.decharge.recharge >= 0)) w.push('miniBoss.' + t + '.decharge : portee, intervalle > 0 ; degats, flou, recharge ≥ 0');
        if (pm.aura && !(pm.aura.rayon > 0 && pm.aura.degatsParSeconde >= 0)) w.push('miniBoss.' + t + '.aura : rayon > 0, degatsParSeconde ≥ 0');
        if (pm.flaque && !(pm.flaque.rayon > 0 && pm.flaque.duree >= 0 && pm.flaque.degatsParSeconde >= 0)) w.push('miniBoss.' + t + '.flaque : rayon > 0, duree et degatsParSeconde ≥ 0');
        // v1.4 (§16.1, §16.2)
        if (pm.decharge && pm.decharge.etourdissement != null && !(pm.decharge.etourdissement >= 0)) w.push('miniBoss.' + t + '.decharge.etourdissement doit être ≥ 0');
        var bo = pm.boules;
        if (bo && !(bo.intervalle > 0 && bo.parVolee >= 0 && bo.parJoueurSupp >= 0 && bo.portee > 0 && bo.tempsVol >= 0 && bo.impact && bo.impact.rayon > 0 && bo.impact.degats >= 0 &&
            bo.zone && bo.zone.rayon > 0 && bo.zone.dpsBase >= 0 && bo.zone.dpsParSeconde >= 0 && bo.zone.dpsMax >= 0 && bo.zone.oubli >= 0)) {
          w.push('miniBoss.' + t + '.boules : intervalle, portee, impact.rayon, zone.rayon > 0 ; parVolee, parJoueurSupp, tempsVol, dégâts et oubli ≥ 0');
        }
        var fl = pm.fleau;
        if (fl && !(fl.portee > 0 && fl.angle > 0 && fl.angle <= 360 && fl.preparation >= 0 && fl.degats >= 0)) w.push('miniBoss.' + t + '.fleau : portee > 0, angle dans ]0, 360], preparation et degats ≥ 0');
        // v1.5 (§17.1)
        var rg = pm.rage;
        if (rg && !(rg.seuil > 0 && rg.seuil < 1 && typeof rg.capacite === 'string' && rg.capacite && rg.duree >= 0)) w.push('miniBoss.' + t + '.rage : seuil dans ]0, 1[, capacite (texte), duree ≥ 0');
        if (rg && rg.capacite === 'infection' && !(rg.aura && rg.aura.rayon > 0 && rg.aura.degatsParSeconde >= 0)) w.push('miniBoss.' + t + '.rage.aura : rayon > 0, degatsParSeconde ≥ 0');
        if (rg && rg.capacite === 'arrachement' && !(rg.vol >= 0 && rg.vol <= rg.duree)) w.push('miniBoss.' + t + '.rage.vol : entre 0 et duree');
        if (pm.echelle != null && !(pm.echelle > 0)) w.push('miniBoss.' + t + '.echelle doit être > 0');
        var cg = pm.charge;
        if (cg && !(cg.preparation >= 0 && cg.vitesse > 0 && cg.distanceMax > 0 && cg.largeur > 0 && cg.degats >= 0 && cg.projection && cg.projection.vitesse >= 0 &&
            cg.projection.duree >= 0 && cg.impactMur >= 0 && cg.recharge >= 0 && cg.etourdiMur >= 0)) w.push('miniBoss.' + t + '.charge : vitesse, distanceMax, largeur > 0 ; le reste ≥ 0');
        var pt = pm.petits;
        if (pt && !(pt.intervalle > 0 && pt.premier >= 0 && pt.max >= 0 && pt.maxParJoueurSupp >= 0 && pt.rayon >= 0 && pt.profil && pt.profil.pv > 0 && pt.profil.vitesse > 0)) {
          w.push('miniBoss.' + t + '.petits : intervalle > 0, profil.pv et profil.vitesse > 0, le reste ≥ 0');
        }
        var pf = pt && pt.profil && pt.profil.fleau;
        if (pf && !(pf.portee > 0 && pf.angle > 0 && pf.angle <= 360 && pf.preparation >= 0 && pf.degats >= 0)) w.push('miniBoss.' + t + '.petits.profil.fleau : portee > 0, angle dans ]0, 360], preparation et degats ≥ 0');
      });
      var mu = mb.murs;
      if (mu && !(mu.distance > 0 && mu.degatsParSeconde >= 0 && mu.tick > 0 && mu.extinction >= 0)) w.push('miniBoss.murs : distance, tick > 0 ; degatsParSeconde, extinction ≥ 0');
      var bm = mb.bonusMort;
      if (bm && bm.actif && !(typeof bm.type === 'string' && bm.type && bm.duree >= 0)) w.push('miniBoss.bonusMort : type (texte), duree ≥ 0');
    }
    // v1.4 (§16.3 à §16.5)
    var sv = c.phase3.salve;
    if (sv && !(sv.seuil > 0 && sv.seuil <= 1 && sv.blocs >= 1 && sv.ecart >= 0 && sv.intervalle && sv.intervalle[0] >= 0 && sv.intervalle[0] <= sv.intervalle[1] &&
        Array.isArray(sv.predictions) && sv.predictions.length > 0 && sv.decalage >= 0)) {
      w.push('phase3.salve : seuil dans ]0, 1], blocs ≥ 1, ecart ≥ 0, intervalle [min, max], predictions non vide, decalage ≥ 0');
    }
    var fa = c.phase4.faiblesse.apparitions;
    if (fa && fa !== true && !(fa.intervalle > 0 && fa.max >= 0)) w.push('phase4.faiblesse.apparitions : intervalle > 0, max ≥ 0');
    var pa = c.phase5.paliers;
    if (pa) {
      var ps = pa.seuils || [], okS = ps.length > 0;
      for (var pi = 0; pi < ps.length; pi++) if (!(ps[pi] > 0 && ps[pi] < 1) || (pi > 0 && !(ps[pi] > ps[pi - 1]))) okS = false;
      if (!okS) w.push('phase5.paliers.seuils : strictement croissants, dans ]0, 1[');
      if (!(pa.critique >= 0 && pa.critique < 1 && pa.bleu && pa.bleu.degats > 0 && pa.bleu.degats <= 1 && pa.bleu.invulnerabilite >= 0)) w.push('phase5.paliers : critique dans [0, 1[, bleu.degats dans ]0, 1], bleu.invulnerabilite ≥ 0');
      var it = pa.intangible;                     // v1.5 (§17.3) ; les illusions de la v1.4 sont retirées
      if (it && !(it.evanouissement >= 0 && it.resurgissement >= 0 && it.vitesse > 0 && it.distanceReapparition > 0 && it.distanceProche > 0 && it.proximite > 0 &&
          it.delaiInvisible >= 0 && it.recharge >= 0 && it.dureeMax > 0 && it.preparationFrappe >= 0 &&
          (!it.fente || (it.fente.vitesse > 0 && it.fente.distanceArret >= 0)))) {
        w.push('phase5.paliers.intangible : vitesse, distances, proximite et dureeMax > 0 ; durées ≥ 0 ; fente.vitesse > 0, fente.distanceArret ≥ 0');
      }
      var cr = pa.crochet;
      if (cr && !(cr.recharge >= 0 && cr.porteeMin >= 0 && cr.porteeMin < cr.porteeMax && cr.preparation >= 0 && cr.vitesse > 0 && cr.rayon > 0 && cr.traction > 0 && cr.arrivee >= 0 && cr.preparationFrappe >= 0)) {
        w.push('phase5.paliers.crochet : porteeMin < porteeMax ; vitesse, rayon, traction > 0 ; le reste ≥ 0');
      }
    }
    var td = c.phase5.teleportDegats;
    if (td && td.actif && !(td.distanceMin < td.distanceMax)) w.push('phase5.teleportDegats : distanceMin doit être < distanceMax');
    return w;
  };

  if (typeof module === 'object' && module && module.exports) module.exports = CONFIG;
  if (root) root.BOSS_B7_CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
