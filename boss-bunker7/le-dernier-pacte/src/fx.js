/*!
 * fx.js v1.5.0 — Zombie Survival, Bunker 7 : effets visuels du boss « Le Septième » (API.md §9, §13 à §17).
 * Particules (THREE.Points), rubans réutilisés (traînées, vrilles, éclairs, arcs, spirales, rayons), halos face caméra,
 * décalques au sol et sur les murs (géométries instanciées), volumes (colonnes, coques, implosion, vortex), voile d'écran
 * (obscurité, capture des âmes, fondus, éclairs, choc électrique) et réserve de 1 à 3 PointLight par scène. Tout est
 * préalloué : aucun objet, tableau ni fermeture créé par image (flottants de travail dans des tableaux typés, une seule
 * forme d'objet pour les réserves). Lueurs additives, depthWrite:false ; poussière et fumée en alpha prémultiplié.
 * Symboles 100 % inventés : cercles, arcs, points, spirales et le sceau à sept branches courbes de la tête du
 * boss (même dessin que boss/tete/bmarques.py). Aucune lettre, rune, croix ni forme réelle ; aucun texte.
 *
 *   var fx = BossB7Fx.creer(THREE, { scenes: { salle, bunker }, renderer, camera, config, arene, qualite, monde, surSecousse });
 *   var off = fx.brancher(combat);                       // évènements API.md §4
 *   fx.mettreAJour(dt, combat.etat(), { modele, temps, joueurLocal: { id, position, lieu }, joueurs });   // après modele.update
 *   // v1.5 : monde.positionZombie(id) sert aussi à l'infection ; monde.tir(lieu, origine, direction, max) (facultatif) oriente
 *   // l'ondulation des murs traversés par l'intangible (sinon : face à sa course) ; options v1.5 : facadeMurs (m du centre),
 *   // mareBras, lueursIrradies (false : le jeu les dessine déjà), rayonMiroitement (4 m)
 *   monde.intensiteLumieres(lieu, fx.facteurLumiere(lieu));   // obscurité de la phase 5 (le jeu applique)
 *   fx.declencher('impactMagique', { position, lieu });   // effet ponctuel à la main (liste : fx.effets)
 *   fx.dispose();
 * Script classique → globalThis.BossB7Fx ; CommonJS → module.exports. Three.js r128 à r186.
 */
(function (root) {
  'use strict';

  var VERSION = '1.5.0';
  var PI = Math.PI, TAU = PI * 2;

  // ───────────────────────────────────────── outils ─────────────────────────────────────────
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lisse(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function sortie(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
  function nombre(v, d) { v = +v; return isFinite(v) ? v : d; }
  function mulberry32(a) {
    var etat = new Uint32Array(1);   // état dans un tableau typé : un entier 32 bits dans une variable de fermeture serait mis en boîte
    etat[0] = a >>> 0;
    return function () {
      var t = (etat[0] + 0x6D2B79F5) >>> 0;
      etat[0] = t;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // v1.4 : même générateur, mais il rend un entier de 24 bits (petit entier : jamais mis en boîte au retour d'un appel
  // non compilé en ligne, contrairement à un flottant) ; l'appelant le multiplie par K_ALEA
  function mulberry24(a) {
    var etat = new Uint32Array(1);
    etat[0] = a >>> 0;
    return function () {
      var t = (etat[0] + 0x6D2B79F5) >>> 0;
      etat[0] = t;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 8;
    };
  }
  var K_ALEA = 1 / 16777216;
  function lireChemin(o, chemin) {
    var p = chemin.split('.');
    for (var i = 0; i < p.length; i++) { if (!o || typeof o !== 'object' || !(p[i] in o)) return undefined; o = o[p[i]]; }
    return o;
  }

  // ───────────────────────────────────────── réglages par qualité ─────────────────────────────────────────
  var QUALITES = {
    // v1.5 : panneaux (décalques verticaux : murs électrifiés, ondulations), lueurs au sol des zombies irradiés
    haute: { particules: 2600, rubans: 40, pointsRuban: 20, halos: 56, sols: 80, cylindres: 4, spheres: 4, lumieres: 3, bruit: 256, cercle: 1024, densite: 1, panneaux: 24, irradies: 24, bordures: true },
    moyenne: { particules: 1600, rubans: 30, pointsRuban: 16, halos: 44, sols: 60, cylindres: 3, spheres: 3, lumieres: 2, bruit: 128, cercle: 768, densite: 0.65, panneaux: 20, irradies: 16, bordures: true },
    basse: { particules: 900, rubans: 20, pointsRuban: 12, halos: 32, sols: 44, cylindres: 2, spheres: 2, lumieres: 1, bruit: 128, cercle: 512, densite: 0.4, panneaux: 12, irradies: 10, bordures: false }
  };

  // motifs des halos (panneaux face caméra)
  var H_LUEUR = 0, H_ECLAT = 1, H_ANNEAU = 2, H_AME = 3, H_ORBE = 4, H_BOUCLIER = 5, H_FUMEE = 6, H_MIROIR = 7;
  // motifs au sol
  var S_ONDE = 0, S_ZONE = 1, S_BRULURE = 2, S_FISSURES = 3, S_CIBLE = 4, S_COULOIR = 5, S_SECTEUR = 6, S_LUEUR = 7,
    S_CERCLE = 8, S_INTERACTION = 9, S_TACHE = 10, S_SCEAU = 11, S_FAILLE = 12, S_LISERE = 13, S_MARE = 14, S_VEINES = 15;
  var S_SOMBRES = { 2: 1, 3: 1, 10: 1, 14: 1, 15: 1 };   // dessinés en premier (assombrissent)
  // motifs des panneaux (décalques verticaux, v1.5) : mur électrifié, bordure du plafond, ondulation d'un mur traversé
  var PN_MUR = 0, PN_BORD = 1, PN_ONDULATION = 2;
  // styles et comportements des rubans
  var R_ENERGIE = 0, R_ECLAIR = 1, R_AME = 2, R_TRAINEE = 3, R_SOMBRE = 4, R_CHAINE = 5;
  var RT_VRILLE = 1, RT_ECLAIR = 2, RT_TRAINEE = 3, RT_ARC = 4, RT_SPIRALE = 5, RT_CROCHET = 6, RT_RAYON = 7;
  // volumes
  var V_COLONNE = 0, V_COQUILLE = 1, V_IMPLOSION = 2, V_VORTEX = 3, V_FISSURES = 4, V_BOUCLIER = 5;
  // particules : formes, modes, action au sol
  var P_LUEUR = 0, P_ETINCELLE = 1, P_POUSSIERE = 2, P_ECLAT = 3, P_GOUTTE = 4, P_AME = 5;
  var M_PHYS = 0, M_CONV = 1, M_ORBITE = 2;
  var SOL_RIEN = 0, SOL_MEURT = 1, SOL_REBOND = 2, SOL_SANG = 3, SOL_POSE = 4;
  // courbes d'animation automatique (halos, sols, volumes avec une durée de vie)
  var C_FLASH = 0, C_PULSE = 1, C_ANNEAU = 2, C_FIXE = 3;

  // ───────────────────────────────────────── palette (valeurs d'affichage) ─────────────────────────────────────────
  var COUL = {
    braise: [1.0, 0.45, 0.12], energie: [1.0, 0.3, 0.07], energieClaire: [1.0, 0.66, 0.34], energieSombre: [0.55, 0.06, 0.02],
    ame: [0.55, 1.0, 0.88], ameClaire: [0.8, 1.0, 0.96], ameSombre: [0.12, 0.55, 0.5],
    rituel: [1.0, 0.84, 0.48], rituelBlanc: [1.0, 0.96, 0.84], rituelOr: [1.0, 0.78, 0.36], rituelRouge: [0.85, 0.14, 0.08],
    sang: [0.32, 0.012, 0.01], sangVif: [0.9, 0.06, 0.04], sangTache: [0.42, 0.02, 0.015],
    poussiere: [0.3, 0.28, 0.26], fumee: [0.05, 0.045, 0.045], bouclier: [1.0, 0.86, 0.62],
    meute: [1.0, 0.13, 0.05], brasier: [1.0, 0.82, 0.5],
    cuve: [0.42, 1.0, 0.28], cuveClaire: [0.82, 1.0, 0.66], cuveSombre: [0.1, 0.4, 0.06], verre: [0.78, 0.96, 0.9],
    glace: [0.5, 0.78, 1.0], glaceVif: [0.78, 0.94, 1.0], glaceTache: [0.52, 0.7, 0.84],
    chaine: [0.55, 0.07, 0.03], chaineVif: [1.0, 0.28, 0.08],
    // v1.5
    elec: [0.28, 0.58, 1.0], elecVif: [0.72, 0.88, 1.0], elecSombre: [0.06, 0.16, 0.48], surcharge: [0.35, 0.92, 1.0],
    infection: [0.5, 1.0, 0.16], infectionClaire: [0.82, 1.0, 0.55], rougeSombre: [0.55, 0.05, 0.03], ecto: [0.32, 0.05, 0.3],
    cendreSang: [0.09, 0.035, 0.03], miroir: [0.62, 0.56, 0.74], ectoVif: [0.6, 0.22, 0.66]
  };

  // ───────────────────────────────────────── gabarits de particules ─────────────────────────────────────────
  // vie (s), taille (m), fin (× taille en fin de vie), vit (m/s), disp (0 = suit la direction, 1 = toutes
  // directions), rayon (m), monte (m/s), c1 → c2, alpha, add (1 additif, 0 assombrit), forme, grav (m/s²),
  // frein (1/s), tourb (m/s²), sol (action au sol), fi (part de la vie en apparition)
  var GAB = {
    etincelle: { vie: [0.25, 0.65], taille: [0.022, 0.04], fin: 0.6, vit: [2.5, 6.5], disp: 0.55, rayon: 0.05, monte: 0.5, c1: [1.0, 0.8, 0.45], c2: [1.0, 0.24, 0.05], alpha: [0.85, 1], add: 1, forme: P_ETINCELLE, grav: 7, frein: 1.0, tourb: 0, sol: SOL_REBOND, fi: 0.02 },
    braise: { vie: [0.9, 2.0], taille: [0.025, 0.055], fin: 0.35, vit: [0.2, 1.1], disp: 1, rayon: 0.25, monte: 0.4, c1: [1.0, 0.55, 0.16], c2: [0.75, 0.1, 0.02], alpha: [0.6, 1], add: 1, forme: P_LUEUR, grav: -0.6, frein: 0.7, tourb: 1.6, sol: SOL_RIEN, fi: 0.1 },
    poussiere: { vie: [1.4, 2.8], taille: [0.3, 0.65], fin: 2.4, vit: [0.4, 1.8], disp: 1, rayon: 0.3, monte: 0.2, c1: [0.3, 0.28, 0.26], c2: [0.22, 0.21, 0.2], alpha: [0.3, 0.5], add: 0, forme: P_POUSSIERE, grav: -0.1, frein: 2.0, tourb: 0.35, sol: SOL_RIEN, fi: 0.08 },
    fumee: { vie: [2.4, 4.0], taille: [0.25, 0.45], fin: 3.0, vit: [0.1, 0.35], disp: 0.4, rayon: 0.25, monte: 0.4, c1: [0.24, 0.21, 0.19], c2: [0.3, 0.29, 0.28], alpha: [0.3, 0.46], add: 0, forme: P_POUSSIERE, grav: -0.12, frein: 0.6, tourb: 0.3, sol: SOL_RIEN, fi: 0.15 },
    eclat: { vie: [1.0, 1.8], taille: [0.05, 0.12], fin: 1, vit: [2.5, 6.5], disp: 0.5, rayon: 0.25, monte: 1.5, c1: [0.2, 0.19, 0.18], c2: [0.17, 0.16, 0.15], alpha: [1, 1], add: 0, forme: P_ECLAT, grav: 9.8, frein: 0.25, tourb: 0, sol: SOL_POSE, fi: 0.01 },
    energie: { vie: [0.35, 0.8], taille: [0.04, 0.09], fin: 0.4, vit: [0.5, 2.0], disp: 1, rayon: 0.15, monte: 0, c1: [1.0, 0.62, 0.28], c2: [1.0, 0.16, 0.03], alpha: [0.8, 1], add: 1, forme: P_LUEUR, grav: 0, frein: 2.5, tourb: 2.0, sol: SOL_RIEN, fi: 0.05 },
    ame: { vie: [0.8, 1.6], taille: [0.05, 0.1], fin: 0.3, vit: [0.4, 1.6], disp: 1, rayon: 0.2, monte: 0.6, c1: [0.6, 1.0, 0.9], c2: [0.15, 0.6, 0.55], alpha: [0.7, 1], add: 1, forme: P_AME, grav: -0.3, frein: 1.2, tourb: 1.2, sol: SOL_RIEN, fi: 0.1 },
    rituel: { vie: [1.0, 2.2], taille: [0.035, 0.07], fin: 0.3, vit: [0.3, 1.2], disp: 1, rayon: 0.2, monte: 0.8, c1: [1.0, 0.95, 0.75], c2: [1.0, 0.62, 0.2], alpha: [0.7, 1], add: 1, forme: P_LUEUR, grav: -0.5, frein: 0.8, tourb: 0.8, sol: SOL_RIEN, fi: 0.1 },
    sang: { vie: [1.5, 2.5], taille: [0.02, 0.032], fin: 1, vit: [0, 0.15], disp: 1, rayon: 0.01, monte: 0, c1: [0.75, 0.05, 0.03], c2: [0.6, 0.03, 0.02], alpha: [0.95, 1], add: 0.5, forme: P_GOUTTE, grav: 9.8, frein: 0.1, tourb: 0, sol: SOL_SANG, fi: 0.01 },
    gerbeSang: { vie: [0.5, 1.0], taille: [0.022, 0.045], fin: 0.8, vit: [1.5, 4.5], disp: 0.5, rayon: 0.08, monte: 0.8, c1: [0.62, 0.035, 0.025], c2: [0.42, 0.015, 0.012], alpha: [0.95, 1], add: 0.25, forme: P_GOUTTE, grav: 9.8, frein: 0.4, tourb: 0, sol: SOL_SANG, fi: 0.01 },
    brumeRouge: { vie: [1.0, 2.0], taille: [0.16, 0.32], fin: 2.2, vit: [0.1, 0.5], disp: 1, rayon: 0.12, monte: 0.12, c1: [0.4, 0.025, 0.02], c2: [0.16, 0.01, 0.01], alpha: [0.25, 0.42], add: 0.35, forme: P_POUSSIERE, grav: -0.1, frein: 1.0, tourb: 0.6, sol: SOL_RIEN, fi: 0.15 },
    cendre: { vie: [1.4, 2.6], taille: [0.02, 0.04], fin: 0.8, vit: [0.3, 1.0], disp: 1, rayon: 0.35, monte: 0.6, c1: [0.26, 0.25, 0.24], c2: [0.18, 0.17, 0.16], alpha: [0.8, 1], add: 0, forme: P_ECLAT, grav: -0.25, frein: 0.9, tourb: 1.4, sol: SOL_RIEN, fi: 0.05 },
    plafond: { vie: [2.4, 3.6], taille: [0.1, 0.26], fin: 1.8, vit: [0, 0.3], disp: 1, rayon: 0.4, monte: 0, c1: [0.46, 0.43, 0.39], c2: [0.36, 0.34, 0.31], alpha: [0.3, 0.5], add: 0, forme: P_POUSSIERE, grav: 1.6, frein: 1.1, tourb: 0.3, sol: SOL_MEURT, fi: 0.1 },
    convergence: { vie: [0.5, 0.9], taille: [0.03, 0.06], fin: 0.5, vit: [0, 0], disp: 1, rayon: 0, monte: 0, c1: [1.0, 0.7, 0.36], c2: [1.0, 0.22, 0.04], alpha: [0.85, 1], add: 1, forme: P_ETINCELLE, grav: 0, frein: 0, tourb: 0, sol: SOL_RIEN, fi: 0.1 },
    etourdi: { vie: [1.2, 1.4], taille: [0.03, 0.05], fin: 0.6, vit: [0, 0], disp: 1, rayon: 0, monte: 0, c1: [1.0, 0.75, 0.4], c2: [1.0, 0.3, 0.06], alpha: [0.8, 1], add: 1, forme: P_LUEUR, grav: 0, frein: 0, tourb: 0, sol: SOL_RIEN, fi: 0.08 },
    filet: { vie: [1.0, 1.6], taille: [0.06, 0.12], fin: 1.8, vit: [0, 0.15], disp: 1, rayon: 0.05, monte: 0, c1: [0.48, 0.45, 0.4], c2: [0.36, 0.34, 0.3], alpha: [0.38, 0.58], add: 0, forme: P_POUSSIERE, grav: 3.5, frein: 0.8, tourb: 0.2, sol: SOL_MEURT, fi: 0.05 },
    siphon: { vie: [0.55, 0.9], taille: [0.045, 0.1], fin: 0.5, vit: [0, 0], disp: 1, rayon: 0, monte: 0, c1: [0.8, 1.0, 0.6], c2: [0.3, 0.9, 0.18], alpha: [0.85, 1], add: 1, forme: P_LUEUR, grav: 0, frein: 0, tourb: 0, sol: SOL_RIEN, fi: 0.08 },
    bulle: { vie: [0.3, 0.6], taille: [0.025, 0.05], fin: 0.6, vit: [0.6, 1.6], disp: 0.3, rayon: 0.05, monte: 0.8, c1: [0.88, 1.0, 0.72], c2: [0.4, 0.9, 0.3], alpha: [0.7, 1], add: 1, forme: P_LUEUR, grav: -1.5, frein: 1.5, tourb: 1.2, sol: SOL_RIEN, fi: 0.05 },
    verre: { vie: [0.9, 1.7], taille: [0.03, 0.075], fin: 1, vit: [3.0, 8.0], disp: 0.5, rayon: 0.45, monte: 1.2, c1: [0.78, 0.96, 0.9], c2: [0.52, 0.76, 0.66], alpha: [0.8, 1], add: 0.6, forme: P_ECLAT, grav: 9.8, frein: 0.3, tourb: 0, sol: SOL_REBOND, fi: 0.01 },
    liquide: { vie: [0.6, 1.2], taille: [0.03, 0.065], fin: 0.8, vit: [2.5, 6.0], disp: 0.55, rayon: 0.4, monte: 1.0, c1: [0.5, 1.0, 0.3], c2: [0.25, 0.7, 0.12], alpha: [0.85, 1], add: 0.6, forme: P_GOUTTE, grav: 9.8, frein: 0.3, tourb: 0, sol: SOL_MEURT, fi: 0.01 },
    brumeVerte: { vie: [1.4, 2.6], taille: [0.3, 0.6], fin: 2.4, vit: [0.3, 1.2], disp: 1, rayon: 0.5, monte: 0.3, c1: [0.14, 0.38, 0.09], c2: [0.05, 0.14, 0.04], alpha: [0.25, 0.42], add: 0.4, forme: P_POUSSIERE, grav: -0.15, frein: 1.2, tourb: 0.6, sol: SOL_RIEN, fi: 0.12 },
    vapeur: { vie: [1.2, 2.2], taille: [0.25, 0.5], fin: 2.6, vit: [0.3, 0.9], disp: 0.6, rayon: 0.4, monte: 0.6, c1: [0.62, 0.72, 0.62], c2: [0.4, 0.45, 0.42], alpha: [0.25, 0.42], add: 0.25, forme: P_POUSSIERE, grav: -0.4, frein: 1.0, tourb: 0.6, sol: SOL_RIEN, fi: 0.12 },
    lien: { vie: [0.9, 1.1], taille: [0.15, 0.22], fin: 0.6, vit: [0, 0], disp: 1, rayon: 0, monte: 0, c1: [1.0, 1.0, 1.0], c2: [1.0, 1.0, 1.0], alpha: [0.9, 1], add: 1, forme: P_LUEUR, grav: 0, frein: 0, tourb: 0, sol: SOL_RIEN, fi: 0.06 },
    glace: { vie: [1.5, 2.5], taille: [0.022, 0.034], fin: 1, vit: [0, 0.15], disp: 1, rayon: 0.01, monte: 0, c1: [0.82, 0.96, 1.0], c2: [0.58, 0.84, 1.0], alpha: [0.95, 1], add: 0.85, forme: P_GOUTTE, grav: 9.8, frein: 0.1, tourb: 0, sol: SOL_SANG, fi: 0.01 },
    gerbeGlace: { vie: [0.5, 1.0], taille: [0.022, 0.045], fin: 0.8, vit: [1.5, 4.5], disp: 0.5, rayon: 0.08, monte: 0.8, c1: [0.78, 0.94, 1.0], c2: [0.5, 0.78, 1.0], alpha: [0.95, 1], add: 0.7, forme: P_GOUTTE, grav: 9.8, frein: 0.4, tourb: 0, sol: SOL_SANG, fi: 0.01 },
    brumeGlace: { vie: [1.0, 2.0], taille: [0.16, 0.32], fin: 2.2, vit: [0.1, 0.5], disp: 1, rayon: 0.12, monte: 0.12, c1: [0.3, 0.46, 0.56], c2: [0.12, 0.2, 0.26], alpha: [0.25, 0.42], add: 0.45, forme: P_POUSSIERE, grav: -0.1, frein: 1.0, tourb: 0.6, sol: SOL_RIEN, fi: 0.15 },
    fumeeSombre: { vie: [0.8, 1.1], taille: [0.4, 0.75], fin: 0.45, vit: [0, 0], disp: 1, rayon: 0, monte: 0, c1: [0.15, 0.3, 0.17], c2: [0.04, 0.09, 0.05], alpha: [0.55, 0.75], add: 0.4, forme: P_POUSSIERE, grav: 0, frein: 0, tourb: 0, sol: SOL_RIEN, fi: 0.2 },
    fumeeVerte: { vie: [1.0, 1.8], taille: [0.25, 0.5], fin: 2.4, vit: [0.4, 1.4], disp: 1, rayon: 0.35, monte: 0.4, c1: [0.22, 0.6, 0.24], c2: [0.06, 0.18, 0.07], alpha: [0.3, 0.48], add: 0.45, forme: P_POUSSIERE, grav: -0.2, frein: 1.4, tourb: 0.8, sol: SOL_RIEN, fi: 0.08 },
    lueurVerte: { vie: [0.5, 0.9], taille: [0.03, 0.06], fin: 0.4, vit: [0, 0], disp: 1, rayon: 0, monte: 0, c1: [0.7, 1.0, 0.7], c2: [0.25, 0.9, 0.35], alpha: [0.85, 1], add: 1, forme: P_ETINCELLE, grav: 0, frein: 0, tourb: 0, sol: SOL_RIEN, fi: 0.1 },
    fumeeFaille: { vie: [1.2, 2.0], taille: [0.2, 0.36], fin: 2.8, vit: [0.9, 1.7], disp: 0.2, rayon: 0.2, monte: 0.5, c1: [0.5, 0.17, 0.06], c2: [0.1, 0.075, 0.07], alpha: [0.34, 0.52], add: 0.45, forme: P_POUSSIERE, grav: -0.5, frein: 1.0, tourb: 0.5, sol: SOL_RIEN, fi: 0.12 },
    // v1.5
    infection: { vie: [0.35, 0.65], taille: [0.07, 0.13], fin: 0.3, vit: [0, 0.25], disp: 1, rayon: 0.04, monte: 0.1, c1: [0.8, 1.0, 0.5], c2: [0.3, 0.9, 0.1], alpha: [0.85, 1], add: 1, forme: P_LUEUR, grav: 0, frein: 1.0, tourb: 0.6, sol: SOL_RIEN, fi: 0.04 },
    terre: { vie: [0.8, 1.5], taille: [0.04, 0.1], fin: 1, vit: [1.5, 4.0], disp: 0.45, rayon: 0.3, monte: 2.0, c1: [0.24, 0.17, 0.12], c2: [0.15, 0.11, 0.08], alpha: [1, 1], add: 0, forme: P_ECLAT, grav: 9.8, frein: 0.3, tourb: 0, sol: SOL_POSE, fi: 0.01 },
    sangNoir: { vie: [0.5, 1.0], taille: [0.022, 0.045], fin: 0.8, vit: [1.0, 3.0], disp: 0.6, rayon: 0.12, monte: 0.6, c1: [0.16, 0.02, 0.015], c2: [0.07, 0.01, 0.01], alpha: [0.95, 1], add: 0.1, forme: P_GOUTTE, grav: 9.8, frein: 0.4, tourb: 0, sol: SOL_MEURT, fi: 0.01 },
    fumeeNoire: { vie: [0.5, 0.8], taille: [0.4, 0.7], fin: 0.3, vit: [0, 0], disp: 1, rayon: 0, monte: 0, c1: [0.12, 0.03, 0.04], c2: [0.025, 0.01, 0.012], alpha: [0.6, 0.8], add: 0.15, forme: P_POUSSIERE, grav: 0, frein: 0, tourb: 0, sol: SOL_RIEN, fi: 0.15 },
    fumeeRouge: { vie: [1.0, 1.8], taille: [0.35, 0.7], fin: 2.2, vit: [1.2, 3.5], disp: 0.6, rayon: 0.4, monte: 0.4, c1: [0.34, 0.025, 0.02], c2: [0.08, 0.01, 0.01], alpha: [0.4, 0.6], add: 0.3, forme: P_POUSSIERE, grav: -0.2, frein: 1.6, tourb: 0.8, sol: SOL_RIEN, fi: 0.06 },
    ecto: { vie: [0.8, 1.4], taille: [0.15, 0.3], fin: 1.8, vit: [0.3, 1.0], disp: 0.5, rayon: 0.2, monte: 0.1, c1: [0.12, 0.02, 0.1], c2: [0.025, 0.0, 0.025], alpha: [0.45, 0.6], add: 0.2, forme: P_POUSSIERE, grav: -0.2, frein: 1.5, tourb: 1.0, sol: SOL_RIEN, fi: 0.08 },
    bulleSang: { vie: [0.3, 0.6], taille: [0.02, 0.04], fin: 0.8, vit: [0.6, 1.6], disp: 0.4, rayon: 0.12, monte: 0.6, c1: [0.55, 0.03, 0.02], c2: [0.32, 0.012, 0.01], alpha: [0.9, 1], add: 0.2, forme: P_GOUTTE, grav: 9.8, frein: 0.5, tourb: 0, sol: SOL_MEURT, fi: 0.01 }
  };

  // ───────────────────────────────────────── sceau à sept branches (dessin de la tête) ─────────────────────────────────────────
  // Repris de boss/tete/bmarques.py (design_2d) : nœud central en haricot cabossé (boucle fermée), sept branches
  // sinueuses toutes différentes, renflements et points brûlés. Ni symétrie de rotation, ni étoile, ni trait droit.
  var SCEAU_BRANCHES = [
    { h: 70, dep: -8, L: 56, k: -14, wob: 0.28, lam: 44, ph: 0.3, points: 2, w: 1.05, perles: [0.46] },
    { h: 114, dep: -6, L: 44, k: 16, wob: 0.26, lam: 34, ph: 2.0, points: 1, w: 0.8, perles: [] },
    { h: 18, dep: 8, L: 50, k: 24, wob: 0.22, lam: 46, ph: 1.2, points: 3, w: 0.9, perles: [0.36, 0.66] },
    { h: -20, dep: 8, L: 86, k: -16, wob: 0.28, lam: 54, ph: 3.1, points: 0, w: 0.8, perles: [0.5] },
    { h: -74, dep: -4, L: 112, k: 10, wob: 0.26, lam: 60, ph: 0.8, points: 2, w: 1.12, perles: [0.3, 0.56, 0.8] },
    { h: -122, dep: -8, L: 76, k: -20, wob: 0.26, lam: 42, ph: 4.4, points: 1, w: 0.85, perles: [] },
    { h: 172, dep: 10, L: 53, k: 26, wob: 0.24, lam: 36, ph: 5.0, points: 0, w: 0.75, perles: [0.52] }
  ];
  var SCEAU_ECARTS = [5.6, 11.0, 16.0], SCEAU_RAYONS = [2.3, 1.95, 1.6], SCEAU_ETENDUE = 136;   // mm
  function rayonNoeud(a) { return 8.2 + 2.4 * Math.cos(2 * (a - 0.62)) + 0.7 * Math.sin(3 * a + 2.1) + 0.35 * Math.sin(5 * a + 4.0); }
  function capBranche(A, s) { return A.h * PI / 180 + (A.k * PI / 180) * s / 100 + A.wob * (Math.sin(TAU * s / A.lam + A.ph) - Math.sin(A.ph)); }
  /** Dessine le sceau (traits blancs) centré en (cx, cy), échelle en px/mm, épaisseur relative. */
  function dessinerSceau(g, cx, cy, ech, ep) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (var i = 0; i <= 160; i++) {
      var a = i / 160 * TAU, r = rayonNoeud(a);
      var x = cx + Math.cos(a) * r * ech, y = cy - Math.sin(a) * r * ech;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.lineWidth = Math.max(1.5, 1.25 * ech * ep); g.stroke();
    for (var b = 0; b < SCEAU_BRANCHES.length; b++) {
      var A = SCEAU_BRANCHES[b], a0 = (A.h - A.dep) * PI / 180, r0 = rayonNoeud(a0);
      var px = Math.cos(a0) * r0, py = Math.sin(a0) * r0, pas = 0.6, n = Math.ceil(A.L / pas), phi = 0;
      for (var k = 0; k < n; k++) {
        var s = k * pas, t = s / A.L;
        phi = capBranche(A, s);
        var w = A.w * (1.15 - 0.68 * t);
        for (var q = 0; q < A.perles.length; q++) w *= 1 + 0.55 * Math.exp(-Math.pow((t - A.perles[q]) / 0.028, 2));
        var nx = px + Math.cos(phi) * pas, ny = py + Math.sin(phi) * pas;
        g.beginPath(); g.moveTo(cx + px * ech, cy - py * ech); g.lineTo(cx + nx * ech, cy - ny * ech);
        g.lineWidth = Math.max(1.5, w * ech * ep); g.stroke();
        px = nx; py = ny;
      }
      for (var d = 0; d < A.points; d++) {
        var qx = px + Math.cos(phi) * SCEAU_ECARTS[d], qy = py + Math.sin(phi) * SCEAU_ECARTS[d];
        g.beginPath(); g.arc(cx + qx * ech, cy - qy * ech, Math.max(1.5, SCEAU_RAYONS[d] * ech * Math.sqrt(ep)), 0, TAU); g.fill();
      }
    }
  }

  // ───────────────────────────────────────── glyphes inventés ─────────────────────────────────────────
  // Compositions de cercles ('c' x y r), arcs ('a' x y r a0 a1, degrés), points ('p' x y r) et spirales
  // ('s' x y rayon tours départ, degrés) dans un carré [-1, 1]. Jamais de trait droit : ni lettre, ni rune, ni croix.
  var GLYPHES = [
    [['s', 0, 0, 0.72, 1.55, 90], ['p', 0.6, -0.62, 0.12]],
    [['a', 0, 0, 0.82, 35, 300], ['c', 0.12, 0.08, 0.26], ['p', -0.5, -0.46, 0.1]],
    [['c', -0.42, 0.36, 0.22], ['c', 0.38, -0.34, 0.3], ['a', 0.42, 0.5, 0.62, 195, 285], ['p', 0.62, 0.62, 0.09]],
    [['p', -0.62, 0.32, 0.1], ['p', -0.52, -0.3, 0.12], ['p', 0.0, -0.66, 0.1], ['s', 0.28, 0.22, 0.42, 1.2, 0]],
    [['a', 0, 0, 0.78, 50, 330], ['c', 0, 0, 0.36], ['p', 0.76, 0.18, 0.11]],
    [['a', -0.15, 0.05, 0.72, 70, 250], ['a', 0.25, -0.1, 0.46, 240, 430], ['p', 0.62, 0.62, 0.1], ['p', -0.62, -0.66, 0.08]],
    [['c', 0, 0, 0.62], ['p', -0.24, 0.18, 0.09], ['p', 0.06, 0.3, 0.09], ['p', 0.28, 0.08, 0.09], ['a', 0, 0, 0.88, 200, 250]],
    [['s', -0.2, 0.12, 0.55, 1.3, 200], ['c', 0.56, -0.48, 0.18], ['p', 0.62, 0.52, 0.1]],
    [['a', 0, 0, 0.82, 0, 120], ['a', 0, 0, 0.6, 120, 240], ['a', 0, 0, 0.38, 240, 360], ['p', 0, 0, 0.1]],
    [['s', 0, 0, 0.66, 1.1, 300], ['a', 0, 0, 0.9, 300, 380], ['p', -0.1, 0.12, 0.08]],
    [['a', 0, 0, 0.78, 20, 200], ['a', 0, 0, 0.52, 200, 380], ['c', 0, 0, 0.22]],
    [['c', -0.62, -0.5, 0.16], ['p', -0.26, -0.36, 0.13], ['p', 0.06, -0.12, 0.11], ['p', 0.3, 0.18, 0.09], ['p', 0.46, 0.5, 0.07]],
    [['c', 0.25, 0.2, 0.3], ['a', -0.1, -0.05, 0.72, 150, 330], ['p', -0.55, 0.58, 0.1]],
    [['s', 0, 0, 0.6, 2.1, 45], ['p', -0.78, 0.2, 0.09], ['p', 0.72, -0.34, 0.09]]
  ];
  function dessinerGlyphe(g, i, cx, cy, s, ep) {
    var G = GLYPHES[i % GLYPHES.length];
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(1.2, ep);
    for (var k = 0; k < G.length; k++) {
      var e = G[k], t = e[0];
      g.beginPath();
      if (t === 'c') { g.arc(cx + e[1] * s, cy - e[2] * s, e[3] * s, 0, TAU); g.stroke(); }
      else if (t === 'p') { g.arc(cx + e[1] * s, cy - e[2] * s, Math.max(1, e[3] * s), 0, TAU); g.fill(); }
      else if (t === 'a') { g.arc(cx + e[1] * s, cy - e[2] * s, e[3] * s, -e[5] * PI / 180, -e[4] * PI / 180); g.stroke(); }
      else if (t === 's') {
        var n = 90, tours = e[4], a0 = e[5] * PI / 180;
        for (var j = 0; j <= n; j++) {
          var u = j / n, a = a0 + u * tours * TAU, r = e[3] * s * (0.12 + 0.88 * u);
          var x = cx + e[1] * s + Math.cos(a) * r, y = cy - e[2] * s - Math.sin(a) * r;
          if (j) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
    }
  }
  // Disposition de la texture du cercle (rayon normalisé ρ, 1 = demi-côté de la texture)
  var CERCLE_ECHELLE = 1.12;                  // demi-côté de la texture = rayon du rituel × 1,12
  var NB_GLYPHES = 14;

  // ───────────────────────────────────────── shaders ─────────────────────────────────────────
  var GLSL_BRUME = [
    '#ifdef USE_FOG',
    'uniform vec3 fogColor;',
    '#ifdef FOG_EXP2',
    'uniform float fogDensity;',
    '#else',
    'uniform float fogNear;',
    'uniform float fogFar;',
    '#endif',
    '#endif',
    'varying float vProf;',
    'float facteurBrume() {',
    '#ifdef USE_FOG',
    '#ifdef FOG_EXP2',
    '  return 1.0 - exp(-fogDensity * fogDensity * vProf * vProf);',
    '#else',
    '  return smoothstep(fogNear, fogFar, vProf);',
    '#endif',
    '#else',
    '  return 0.0;',
    '#endif',
    '}'
  ].join('\n');

  var VS_PARTICULES = [
    'attribute vec4 aCouleur;',
    'attribute vec4 aParams;',
    'attribute vec3 aVitesse;',
    'uniform vec2 uDemi;',
    'uniform float uTailleMax;',
    'uniform float uEtire;',
    'varying vec4 vCouleur;',
    'varying vec4 vInfo;',
    'varying vec2 vSeg;',
    'varying float vCote;',
    'varying float vProf;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vProf = -mv.z;',
    '  vec4 cp = projectionMatrix * mv;',
    '  float prof = max(0.05, -mv.z);',
    '  float rayon = 0.5 * aParams.x * projectionMatrix[1][1] * uDemi.y / prof;',
    '  float forme = aParams.z;',
    '  vec2 seg = vec2(0.0);',
    '  if ((forme > 0.5 && forme < 1.5) || (forme > 3.5 && forme < 4.5)) {',
    '    vec4 cq = projectionMatrix * (modelViewMatrix * vec4(position - aVitesse * uEtire, 1.0));',
    '    if (cp.w > 0.05 && cq.w > 0.05) {',
    '      vec2 d = (cq.xy / cq.w - cp.xy / cp.w) * uDemi;',
    '      float l = length(d), lmax = uTailleMax * 0.45;',
    '      if (l > lmax) d *= lmax / l;',
    '      seg = d * 0.5;',
    '      cp.xy += seg / uDemi * cp.w;',
    '    }',
    '  }',
    '  float r = max(rayon, 0.7);',
    '  float att = clamp(rayon / 0.7, 0.0, 1.0);',
    '  vCote = min(2.0 * (r + length(seg)) + 1.0, uTailleMax);',
    '  gl_PointSize = aCouleur.a > 0.0 ? vCote : 0.0;',
    '  vSeg = seg;',
    '  vInfo = vec4(aParams.y, forme, aParams.w, r);',
    '  vCouleur = vec4(aCouleur.rgb, aCouleur.a * att * att);',
    '  gl_Position = cp;',
    '}'
  ].join('\n');

  var FS_PARTICULES = [
    'uniform sampler2D uBruit;',
    'uniform vec2 uTempsV;',
    '#define uTemps uTempsV.x',
    'uniform float uAmbiance;',
    'varying vec4 vCouleur;',
    'varying vec4 vInfo;',
    'varying vec2 vSeg;',
    'varying float vCote;',
    GLSL_BRUME,
    'void main() {',
    '  vec2 c = (gl_PointCoord - 0.5) * vCote;',
    '  c.y = -c.y;',
    '  float forme = vInfo.y, rayon = vInfo.w, m = 0.0;',
    '  vec3 col = vCouleur.rgb;',
    '  if (forme < 0.5) {',
    '    float r = length(c) / rayon;',
    '    if (r > 1.0) discard;',
    '    float k = 1.0 - r;',
    '    m = k * k;',
    '    col *= 1.0 + 1.5 * k * k * k;',
    '  } else if (forme < 1.5 || (forme > 3.5 && forme < 4.5)) {',
    '    vec2 a = -vSeg, ba = 2.0 * vSeg, pa = c - a;',
    '    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);',
    '    float rr = rayon * (forme < 1.5 ? 1.0 : mix(1.0, 0.45, h));',
    '    float d = length(pa - ba * h) / rr;',
    '    if (d > 1.0) discard;',
    '    if (forme < 1.5) { m = (1.0 - d) * (1.0 - d) * mix(1.0, 0.2, h); col *= 1.0 + 1.2 * (1.0 - h) * (1.0 - d); }',
    '    else { m = smoothstep(0.0, 0.35, 1.0 - d); col *= 0.75 + 0.6 * smoothstep(0.6, 0.0, length(pa - ba * h + vec2(0.25, -0.3) * rr) / rr); }',
    '  } else if (forme < 2.5) {',
    '    float r = length(c) / rayon;',
    '    if (r > 1.0) discard;',
    '    float n = texture2D(uBruit, c / rayon * 0.2 + vInfo.z * 7.31).r;',
    '    m = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.6);',
    '  } else if (forme < 3.5) {',
    '    vec2 q = c / rayon;',
    '    float an = atan(q.y, q.x);',
    '    float bord = 0.55 + 0.45 * texture2D(uBruit, vec2(an * 0.1591 + vInfo.z, vInfo.z * 3.7)).g;',
    '    if (length(q) > bord) discard;',
    '    m = 1.0;',
    '    col *= 0.7 + 0.6 * clamp(q.y * 0.8 + 0.5, 0.0, 1.0);',
    '  } else {',
    '    float r = length(c) / rayon;',
    '    if (r > 1.0) discard;',
    '    float k = 1.0 - r;',
    '    m = k * k * (0.75 + 0.25 * sin(uTemps * 11.0 + vInfo.z * 40.0));',
    '    col *= 1.0 + k * k * 1.2;',
    '  }',
    '  col *= mix(uAmbiance, 1.0, vInfo.x);',
    '  float a = vCouleur.a * m;',
    '  float f = facteurBrume();',
    '  gl_FragColor = vec4(col * a * (1.0 - 0.75 * f), a * (1.0 - vInfo.x) * (1.0 - f));',
    '}'
  ].join('\n');

  var VS_RUBANS = [
    'attribute vec3 aTangente;',
    'attribute float aCote;',
    'attribute float aU;',
    'attribute float aLargeur;',
    'attribute vec4 aCouleur;',
    'attribute vec2 aStyle;',
    'varying vec4 vCouleur;',
    'varying vec3 vInfo;',
    'varying float vGraine;',
    'varying float vProf;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vec3 t = (modelViewMatrix * vec4(aTangente, 0.0)).xyz;',
    '  vec3 s = cross(t, mv.xyz);',
    '  float l = length(s);',
    '  s = l > 1e-6 ? s / l : vec3(0.0, 1.0, 0.0);',
    '  mv.xyz += s * aCote * aLargeur * 0.5;',
    '  vCouleur = aCouleur;',
    '  vInfo = vec3(aCote, aU, aStyle.x);',
    '  vGraine = aStyle.y;',
    '  vProf = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FS_RUBANS = [
    'uniform sampler2D uBruit;',
    'uniform vec2 uTempsV;',
    '#define uTemps uTempsV.x',
    'uniform float uAmbiance;',
    'varying vec4 vCouleur;',
    'varying vec3 vInfo;',
    'varying float vGraine;',
    GLSL_BRUME,
    'void main() {',
    '  float v = vInfo.x, u = vInfo.y, st = vInfo.z;',
    '  vec3 col = vCouleur.rgb;',
    '  float m = 0.0, coeur = 0.0, op = 0.0;',
    '  if (st < 0.5) {',
    '    float n = texture2D(uBruit, vec2(u * 2.5 - uTemps * 1.6 + vGraine, v * 0.2 + vGraine * 3.1)).r;',
    '    m = exp(-v * v * 2.6) * (0.45 + 0.9 * n);',
    '    coeur = exp(-v * v * 16.0) * (0.6 + 0.6 * n);',
    '  } else if (st < 1.5) {',
    '    m = exp(-v * v * 3.5) * 0.6;',
    '    coeur = exp(-v * v * 45.0) * 1.8;',
    '  } else if (st < 2.5) {',
    '    float n = texture2D(uBruit, vec2(u * 1.8 - uTemps * 0.9 + vGraine, v * 0.45 + uTemps * 0.25)).g;',
    '    m = exp(-v * v * 2.2) * (0.25 + 1.1 * n * n);',
    '    coeur = exp(-v * v * 12.0) * 0.45;',
    '  } else if (st < 3.5) {',
    '    m = exp(-v * v * 3.0);',
    '    coeur = exp(-v * v * 18.0) * 0.7;',
    '  } else if (st < 4.5) {',
    '    float n = texture2D(uBruit, vec2(u * 2.0 + vGraine, v * 0.3 - uTemps * 0.2)).r;',
    '    op = exp(-v * v * 2.0) * (0.5 + 0.6 * n) * vCouleur.a;',
    '  }',
    '  vec3 rgb = (col * m + mix(col, vec3(1.0), 0.55) * coeur) * vCouleur.a;',
    '  if (st > 4.5) {',                                               // chaîne (v1.4) : vGraine = nombre de maillons
    '    float sm = u * vGraine, fm = fract(sm), im = mod(floor(sm), 2.0);',
    '    vec2 q = vec2((fm - 0.5) * 2.0, v);',
    '    float face = smoothstep(0.3, 0.12, abs(length(q * vec2(1.0, 1.3)) - 0.62));',
    '    float profil = smoothstep(0.4, 0.22, abs(v)) * smoothstep(1.0, 0.82, abs(q.x));',
    '    float masque = mix(face, profil, im);',
    '    op = masque * vCouleur.a;',
    '    float reflet = 0.4 + 0.6 * smoothstep(0.0, 0.9, 1.0 - abs(v)) * (0.6 + 0.4 * sin(sm * 3.14159 + uTemps * 2.0));',
    '    rgb = vec3(0.17, 0.16, 0.16) * reflet * uAmbiance * op + col * masque * vCouleur.a * (0.55 + 0.45 * reflet);',
    '  } else if (st > 3.5) rgb = col * uAmbiance * op;',
    '  float f = facteurBrume();',
    '  gl_FragColor = vec4(rgb * (1.0 - 0.75 * f), op * (1.0 - f));',
    '}'
  ].join('\n');

  var VS_HALOS = [
    'attribute vec3 aCentre;',
    'attribute vec3 aTaille;',
    'attribute vec4 aCouleur;',
    'attribute vec4 aParams;',
    'attribute vec3 aVitesse;',
    'varying vec2 vUv;',
    'varying vec4 vCouleur;',
    'varying vec4 vParams;',
    'varying float vProf;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(aCentre, 1.0);',
    '  float l = length(mv.xyz), s = 1.0;',
    '  if (aTaille.z > 0.0 && l > 0.01) { s = 1.0 - min(aTaille.z, l * 0.7) / l; mv.xyz *= s; }',
    '  float rot = aParams.y;',
    '  if (dot(aVitesse, aVitesse) > 1e-8) {',
    '    vec3 vv = (modelViewMatrix * vec4(aVitesse, 0.0)).xyz;',
    '    vec2 d = vv.xy * (-mv.z) + mv.xy * vv.z;',
    '    if (dot(d, d) > 1e-12) rot = atan(d.y, d.x);',
    '  }',
    '  vec2 c = position.xy * 2.0;',
    '  float cs = cos(rot), sn = sin(rot);',
    '  mv.xy += vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) * aTaille.xy * s;',
    '  vUv = c;',
    '  vCouleur = aCouleur;',
    '  vParams = aParams;',
    '  vProf = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FS_HALOS = [
    'uniform sampler2D uBruit;',
    'uniform vec2 uTempsV;',
    '#define uTemps uTempsV.x',
    'uniform float uAmbiance;',
    'varying vec2 vUv;',
    'varying vec4 vCouleur;',
    'varying vec4 vParams;',
    GLSL_BRUME,
    'void main() {',
    '  float m = vParams.x, g = vParams.z, k = vParams.w;',
    '  vec2 p = vUv;',
    '  float r = length(p);',
    '  if (r > 1.0) discard;',
    '  vec3 col = vCouleur.rgb, em = vec3(0.0), base = vec3(0.0);',
    '  float op = 0.0;',
    '  if (m < 0.5) {',
    '    em = col * (exp(-r * r * 5.0) * 0.8 + exp(-r * r * 30.0) * 0.9) + vec3(1.0) * exp(-r * r * 70.0) * 0.3 * dot(col, vec3(0.33));',
    '  } else if (m < 1.5) {',
    '    float a = atan(p.y, p.x);',
    '    float rayons = pow(abs(cos(a * 3.5)), 18.0) * (1.0 - r) * 1.1;',
    '    em = col * (exp(-r * r * 9.0) + exp(-r * r * 40.0) + rayons) + vec3(1.0) * exp(-r * r * 90.0) * 0.4 * dot(col, vec3(0.33));',
    '  } else if (m < 2.5) {',
    '    float d = (r - k * 0.92) / 0.075;',
    '    float n = texture2D(uBruit, vec2(atan(p.y, p.x) * 0.48 + g, r * 0.5 - uTemps * 0.3)).r;',
    '    em = col * (exp(-d * d) * (0.65 + 0.7 * n) + 0.12 * exp(-r * r * 3.0) * (1.0 - k));',
    '  } else if (m < 3.5) {',
    '    vec2 c = p - vec2(0.42, 0.0);',
    '    float tete = exp(-dot(c, c) * 20.0);',
    '    float x = p.x;',
    '    float onde = sin(x * 7.0 - uTemps * 9.0 + g * 20.0) * 0.12 * (0.42 - x);',
    '    float larg = mix(0.02, 0.2, smoothstep(-1.0, 0.42, x));',
    '    float queue = exp(-pow((p.y - onde) / larg, 2.0)) * smoothstep(-1.0, -0.3, x) * step(x, 0.45);',
    '    float n = texture2D(uBruit, vec2(x * 0.6 - uTemps * 0.8, p.y * 0.8 + g)).r;',
    '    em = col * (tete * 1.4 + queue * (0.35 + 0.75 * n)) + vec3(0.85, 1.0, 1.0) * exp(-dot(c, c) * 90.0) * 0.6;',
    '  } else if (m < 4.5) {',
    '    float a = atan(p.y, p.x);',
    '    float n = texture2D(uBruit, vec2(a * 0.3183 + uTemps * 0.35 + g, r * 1.3 - uTemps * 1.1)).r;',
    '    float anneau = exp(-pow((r - 0.42 - 0.18 * (n - 0.5)) / 0.12, 2.0));',
    '    em = col * (exp(-r * r * 10.0) * 1.3 + anneau * (0.5 + 0.8 * n) + exp(-r * r * 2.5) * 0.25) + vec3(1.0, 0.92, 0.75) * exp(-r * r * 45.0) * 0.6;',
    '  } else if (m < 5.5) {',
    '    float d1 = (r - k * 0.95) / 0.06, d2 = (r - k * 0.6) / 0.05;',
    '    float n = texture2D(uBruit, p * 0.8 + g).g;',
    '    em = col * (exp(-d1 * d1) * 1.3 + exp(-d2 * d2) * 0.6 + exp(-r * r * 8.0) * 0.8) * (1.0 - k) * (0.75 + 0.5 * n);',
    '  } else if (m < 6.5) {',
    '    float n = texture2D(uBruit, p * 0.5 + vec2(g, uTemps * 0.05)).r;',
    '    op = vCouleur.a * smoothstep(1.0, 0.15, r + (n - 0.5) * 0.5);',
    '    base = col * uAmbiance;',
    '  } else {',                                                      // miroitement (v1.5) : l'intangible tout près du joueur
    '    float a = atan(p.y, p.x);',
    '    float n = texture2D(uBruit, vec2(a * 0.3183 + g, r * 0.7 - uTemps * 0.45)).r;',
    '    float n2 = texture2D(uBruit, p * vec2(0.6, 0.35) + vec2(g * 3.0, -uTemps * 0.3)).g;',
    '    float ondes = sin(r * 22.0 - uTemps * 7.0 + n * 5.0 + n2 * 3.0);',
    '    float env = smoothstep(1.0, 0.45, r) * smoothstep(0.0, 0.3, r) * (0.55 + 0.9 * n2);',
    '    em = col * max(ondes, 0.0) * env * 0.85 * vCouleur.a;',
    '    op = vCouleur.a * max(-ondes, 0.0) * env * 0.35;',
    '  }',
    '  float f = facteurBrume();',
    '  gl_FragColor = vec4(em * (1.0 - 0.75 * f) + base * op * (1.0 - f), op * (1.0 - f));',
    '}'
  ].join('\n');

  var VS_SOL = [
    'attribute vec3 aCentre;',
    'attribute vec4 aAxes;',
    'attribute vec4 aCouleur;',
    'attribute vec4 aParams;',
    'attribute vec4 aParams2;',
    'varying vec2 vL;',
    'varying vec2 vDemi;',
    'varying vec4 vCouleur;',
    'varying vec4 vP;',
    'varying vec4 vP2;',
    'varying float vMotif;',
    'varying float vProf;',
    'void main() {',
    '  vec2 c = position.xy * 2.0;',
    '  vec2 l = c * aAxes.xy;',
    '  float ca = cos(aAxes.z), sa = sin(aAxes.z);',
    '  vec3 w = aCentre + vec3(l.x * ca + l.y * sa, 0.0, -l.x * sa + l.y * ca);',
    '  vec4 mv = modelViewMatrix * vec4(w, 1.0);',
    '  vL = l; vDemi = aAxes.xy; vCouleur = aCouleur; vP = aParams; vP2 = aParams2; vMotif = aAxes.w;',
    '  vProf = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FS_SOL = [
    'uniform sampler2D uBruit;',
    'uniform sampler2D uCercle;',
    'uniform vec2 uTempsV;',
    '#define uTemps uTempsV.x',
    'uniform float uAmbiance;',
    'varying vec2 vL;',
    'varying vec2 vDemi;',
    'varying vec4 vCouleur;',
    'varying vec4 vP;',
    'varying vec4 vP2;',
    'varying float vMotif;',
    GLSL_BRUME,
    'float bruit(vec2 p) { return texture2D(uBruit, p).r; }',
    'void main() {',
    '  float m = vMotif;',
    '  vec2 L = vL;',
    '  float r = length(L), R = max(vDemi.x, 1e-3), rr = r / R;',
    '  float an01 = fract(atan(-L.x, L.y) / 6.2831853 + 1.0);',   // 0 = avant (nord), sens horaire vu de dessus
    '  vec3 em = vec3(0.0), base = vec3(0.0);',
    '  float op = 0.0;',
    '  if (m < 0.5) {',                                             // onde de choc
    '    if (rr > 1.0) discard;',
    '    float Rf = vP.x * R, ep = max(vP.y, 0.02);',
    '    float d = (r - Rf) / ep;',
    '    float n = bruit(vec2(an01 * 5.0 + vP.w, r * 0.3 - uTemps * 0.2));',
    '    float sillage = r < Rf ? exp(-(Rf - r) / max(Rf * 0.3, 0.05)) * 0.3 : 0.0;',
    '    em = vCouleur.rgb * (exp(-d * d * 1.6) * (0.65 + 0.7 * n) + sillage * n) * vCouleur.a;',
    '    op = (exp(-d * d * 0.6) * 0.25 + sillage * 0.4) * vCouleur.a * vP.z;',
    '    base = vec3(0.03, 0.026, 0.022);',
    '  } else if (m < 1.5) {',                                      // zone maudite
    '    if (rr > 1.03) discard;',
    '    float ph = vP.x, k = vP.y, age = vP2.x;',
    '    float bord = exp(-pow((rr - 0.965) / 0.022, 2.0));',
    '    float bord2 = exp(-pow((rr - 0.9) / 0.012, 2.0)) * 0.6;',
    '    float grad = smoothstep(0.32, 0.0, abs(fract(an01 * 24.0 + age * 0.35) - 0.5)) * step(0.905, rr) * step(rr, 0.945);',
    '    float n2 = bruit(vec2(L.x * 0.35 + age * 0.07, L.y * 0.35 - age * 0.05) + vP.z);',
    '    float dedans = smoothstep(1.0, 0.86, rr);',
    '    if (ph < 0.5) {',
    '      float trace = step(an01, k * 1.6);',
    '      float puls = 0.5 + 0.5 * sin(age * (10.0 + 18.0 * k));',
    '      em = vCouleur.rgb * (bord * trace * 1.5 + bord2 * trace + grad * 0.9 + dedans * (0.08 + 0.2 * k) * (0.55 + 0.45 * puls));',
    '      op = dedans * 0.2 * k;',
    '    } else if (ph < 1.5) {',
    '      float tour = bruit(vec2(an01 * 2.0 - age * 0.12 + rr * 0.6, rr * 1.3 - age * 0.35));',
    '      float veines = smoothstep(0.55, 0.85, tour) * dedans;',
    '      float etinc = smoothstep(0.9, 0.97, bruit(L * 1.7 + vec2(age * 0.6, -age * 0.4)));',
    '      em = vCouleur.rgb * (bord * 1.2 + bord2 * 0.8 + grad * 0.4 + dedans * (0.03 + 0.07 * n2) + veines * 0.65 + etinc * 0.5 * dedans);',
    '      op = dedans * (0.55 + 0.25 * n2);',
    '    } else {',
    '      float e = 1.0 - k;',
    '      em = vCouleur.rgb * (bord * e * e + dedans * 0.2 * e * n2);',
    '      op = dedans * 0.35 * e * e;',
    '    }',
    '    em *= vCouleur.a; op *= vCouleur.a;',
    '    base = vec3(0.02, 0.0, 0.0);',
    '  } else if (m < 2.5) {',                                      // brûlure
    '    float n = bruit(L / R * 0.6 + vP.z);',
    '    float rx = rr + (n - 0.5) * 0.45;',
    '    if (rx > 1.0) discard;',
    '    op = vCouleur.a * smoothstep(1.0, 0.35, rx) * 0.85;',
    '    base = vec3(0.02, 0.016, 0.014);',
    '    float braises = smoothstep(0.62, 0.8, bruit(L * 2.2 + vP.z * 3.0)) * smoothstep(0.75, 0.1, rx);',
    '    em = vCouleur.rgb * vP.x * (braises + 0.25 * smoothstep(0.5, 0.0, rx));',
    '  } else if (m < 3.5) {',                                      // fissures
    '    if (rr > 1.0) discard;',
    '    float dev = (bruit(vec2(rr * 0.8 + vP.z, an01 * 2.0)) - 0.5) * 0.9;',
    '    float br = fract(an01 * 7.0 + dev + 0.25 * sin(floor(an01 * 7.0) * 12.9 + vP.z * 6.0));',
    '    float d = abs(br - 0.5) * 6.2831853 / 7.0 * r;',
    '    float larg = 0.04 * (1.0 - rr) + 0.007;',
    '    float fiss = smoothstep(larg, 0.0, d) * step(rr, vP.x);',
    '    float b2 = fract(an01 * 13.0 + dev * 2.0);',
    '    float d2 = abs(b2 - 0.5) * 6.2831853 / 13.0 * r;',
    '    fiss = max(fiss, smoothstep(larg * 0.6, 0.0, d2) * step(rr, vP.x * 0.62) * step(0.25, rr));',
    '    float centre = smoothstep(0.75, 0.0, rr) * step(rr, vP.x);',
    '    op = vCouleur.a * (fiss * 0.9 + centre * 0.3);',
    '    base = vec3(0.015, 0.012, 0.01);',
    '    em = vCouleur.rgb * vP.y * (fiss * (1.0 - rr * 0.6) * 1.5 + centre * 0.25);',
    '  } else if (m < 4.5) {',                                      // cible
    '    if (rr > 1.05) discard;',
    '    float a1 = exp(-pow((rr - 0.95) / 0.035, 2.0));',
    '    float a2 = exp(-pow((rr - 0.55) / 0.03, 2.0)) * 0.7;',
    '    float rot = uTemps * (0.6 + 2.0 * vP.y) + vP.z;',
    '    float arcs = step(0.5, fract(an01 * 3.0 + rot * 0.159)) * exp(-pow((rr - 0.78) / 0.04, 2.0));',
    '    float centre = exp(-pow(rr / 0.09, 2.0));',
    '    float fond = smoothstep(1.0, 0.0, rr) * 0.15;',
    '    float puls = 0.65 + 0.35 * sin(uTemps * (8.0 + 10.0 * vP.y));',
    '    em = vCouleur.rgb * (a1 * 1.2 + a2 + arcs * 0.9 + centre + fond) * mix(puls, 1.0, vP.y) * vCouleur.a * vP.x;',
    '    op = smoothstep(1.0, 0.6, rr) * 0.12 * vCouleur.a * vP.x;',
    '    base = vec3(0.03, 0.0, 0.0);',
    '  } else if (m < 5.5) {',                                      // couloir du piqué
    '    float hx = vDemi.x, hz = max(vDemi.y, 1e-3);',
    '    float ax = abs(L.x) / hx;',
    '    if (ax > 1.0) discard;',
    '    float ay = (L.y + hz) / (2.0 * hz);',
    '    float bords = exp(-pow((ax - 0.93) / 0.045, 2.0));',
    '    float fond = smoothstep(1.0, 0.7, ax) * 0.16;',
    '    float vit = mix(1.4, 4.5, vP.y) + 6.0 * vP.z;',
    '    float ch = fract((L.y - abs(L.x) * 0.8) / 1.1 - uTemps * vit);',
    '    float chev = smoothstep(0.0, 0.12, ch) * smoothstep(0.5, 0.25, ch) * smoothstep(0.95, 0.55, ax);',
    '    float extr = smoothstep(0.0, 0.05, ay) * smoothstep(1.0, 0.93, ay);',
    '    float puls = mix(0.6 + 0.4 * sin(uTemps * 9.0), 1.0, vP.y);',
    '    em = vCouleur.rgb * (bords * 1.3 + fond + chev * 0.8) * extr * puls * vP.x;',
    '    op = (fond * 0.6 + 0.08) * extr * vP.x * 0.5;',
    '    base = vec3(0.03, 0.0, 0.0);',
    '  } else if (m < 6.5) {',                                      // secteur (frappe, onde)
    '    if (rr > 1.0) discard;',
    '    float a = abs(atan(L.x, L.y));',
    '    float dedans = step(a, vP.y);',
    '    float bordA = exp(-pow((a - vP.y) * r / 0.05, 2.0)) * step(vP.y, 3.1);',
    '    float bordR = exp(-pow((rr - 0.97) / 0.03, 2.0)) * dedans;',
    '    float ondes = fract(rr * 3.0 - uTemps * 2.5);',
    '    float rempl = dedans * (0.06 + 0.16 * smoothstep(0.7, 1.0, ondes) * vP.z + 0.22 * vP.w * smoothstep(vP.w * 1.05, vP.w * 0.95, rr) * step(rr, vP.w * 1.05));',
    '    em = vCouleur.rgb * (rempl + bordA * 0.9 + bordR * 1.1) * vP.x;',
    '    op = dedans * 0.3 * vP.x;',
    '    base = vec3(0.03, 0.0, 0.0);',
    '  } else if (m < 7.5) {',                                      // lueur au sol
    '    if (rr > 1.0) discard;',
    '    float n = bruit(L * 0.4 + vec2(uTemps * 0.15, -uTemps * 0.1));',
    '    em = vCouleur.rgb * exp(-rr * rr * 3.5) * (1.0 - vP.x * 0.6 + vP.x * 0.6 * n) * vCouleur.a;',
    '  } else if (m < 8.5) {',                                      // cercle du rituel (texture)
    '    if (rr > 1.0) discard;',
    '    vec3 tx = texture2D(uCercle, vec2(-L.x, L.y) / R * 0.5 + 0.5).rgb;',
    '    float k = vP.x, et = vP.y, prog = vP.z, tl = vP.w;',
    '    float t0 = 0.28, t1 = 0.52, sens = -1.0;',
    '    if (rr > 0.925) { t0 = 0.08; t1 = 0.33; sens = -1.0; }',
    '    else if (rr > 0.845) { t0 = 0.0; t1 = 0.25; sens = 1.0; }',
    '    else if (rr > 0.75) { t0 = 0.18; t1 = 0.43; sens = 1.0; }',
    '    float pa = clamp((k - t0) / (t1 - t0), 0.0, 1.0);',
    '    float aa = sens > 0.0 ? an01 : 1.0 - an01;',
    '    float anneaux = tx.r * step(aa, pa);',
    '    float tete = tx.r * exp(-pow((aa - pa) * 30.0, 2.0)) * step(0.001, pa) * step(pa, 0.999);',
    '    float rs = smoothstep(0.42, 0.78, k) * 0.6;',
    '    float sceau = tx.g * smoothstep(rs + 0.015, rs - 0.015, rr);',
    '    float frontS = tx.g * exp(-pow((rr - rs) * 28.0, 2.0)) * step(0.01, rs) * step(rs, 0.59);',
    '    float idx = floor(an01 * 14.0);',
    '    float ti = 0.55 + 0.3 * fract(idx * 0.618 + 0.13);',
    '    float gly = tx.b * smoothstep(ti, ti + 0.04, k);',
    '    float glyF = tx.b * exp(-pow((k - ti - 0.03) * 22.0, 2.0)) * 2.5;',
    '    float conteste = step(2.5, et) * step(et, 3.5), recul = step(3.5, et) * step(et, 4.5), capt = step(1.5, et) * step(et, 2.5);',
    '    float vit = capt * 1.6 + (1.0 - capt - conteste - recul) * 0.45 - recul * 0.7;',
    '    float circ = smoothstep(0.82, 1.0, k) * pow(0.5 + 0.5 * sin((an01 * 7.0 - tl * vit) * 6.2831853), 6.0);',
    '    float bande = smoothstep(0.84, 0.865, rr) * smoothstep(0.94, 0.915, rr);',
    '    float arc = step(an01, prog) * bande;',
    '    float bordArc = exp(-pow((an01 - prog) * 70.0, 2.0)) * bande * step(0.001, prog);',
    '    float fl = 1.0 - conteste * 0.55 * step(0.5, fract(sin(floor(tl * 15.0) * 12.9898) * 43758.5453));',
    '    float inten = vP2.x * fl;',
    '    vec3 cBase = mix(vCouleur.rgb, vec3(1.0, 0.14, 0.08), conteste * (0.75 + 0.25 * sin(tl * 14.0)) + recul * 0.35);',
    '    float lignes = anneaux * (0.55 + 0.6 * circ) + sceau * (0.45 + 0.75 * prog) + gly * (0.6 + 0.4 * circ);',
    '    em = cBase * (lignes + tete * 2.2 + frontS * 1.8 + glyF) * inten;',
    '    em += mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.3, 0.15), recul) * (arc * (0.9 + 0.4 * circ) + bordArc * 2.0) * inten * (1.0 - conteste * 0.6);',
    '    em += cBase * exp(-rr * rr * 6.0) * 0.035 * inten * (0.5 + prog);',
    '    em += vCouleur.rgb * vP2.y * (tx.r + tx.g + tx.b) * 1.5;',
    '  } else if (m < 9.5) {',                                      // interaction (cadavre)
    '    if (rr > 1.0) discard;',
    '    float anneau = exp(-pow((rr - 0.94) / 0.025, 2.0));',
    '    float arcI = exp(-pow((rr - 0.86) / 0.03, 2.0)) * step(an01, vP.x);',
    '    float fond = smoothstep(1.0, 0.2, rr) * 0.12;',
    '    float pts = step(0.5, fract(an01 * 36.0 - uTemps * 0.3)) * exp(-pow((rr - 0.86) / 0.012, 2.0)) * 0.4;',
    '    float puls = 0.75 + 0.25 * sin(uTemps * 3.0);',
    '    em = vCouleur.rgb * (anneau * puls + arcI * 1.6 + fond + pts) * vP.y;',
    '  } else if (m < 10.5) {',                                     // tache de sang
    '    vec2 q = L / R;',
    '    float n = bruit(q * 0.45 + vP.z);',
    '    float blob = length(q) + (n - 0.5) * 0.55;',
    '    float gout = smoothstep(0.84, 0.9, bruit(q * 1.6 + vP.z * 2.0)) * step(length(q), 1.0) * step(0.55, length(q)) * step(0.5, vP.x);',
    '    float masque = max(smoothstep(0.62 * vP.x + 0.03, 0.62 * vP.x - 0.03, blob), gout);',
    '    if (masque <= 0.002) discard;',
    '    op = vCouleur.a * masque;',
    '    base = vCouleur.rgb * (0.8 + 0.4 * n);',
    '    float bordT = smoothstep(0.62 * vP.x - 0.12, 0.62 * vP.x - 0.02, blob);',
    '    em = vP2.xyz * (0.1 + 0.35 * bordT + 0.35 * smoothstep(0.7, 0.95, bruit(q * 0.9 + 3.3))) * op;',
    '    em += vP2.xyz * vP2.w * (0.25 + 0.3 * smoothstep(0.62 * vP.x, 0.0, blob)) * op;',
    '  } else if (m < 11.5) {',                                     // sceau d'apparition
    '    if (rr > 1.0) discard;',
    '    vec3 tx = texture2D(uCercle, vec2(-L.x, L.y) / R * 0.5 + 0.5).rgb;',
    '    float rs = vP.x * 0.62;',
    '    float sceau = tx.g * smoothstep(rs + 0.02, rs - 0.02, rr);',
    '    float front = tx.g * exp(-pow((rr - rs) * 25.0, 2.0)) * step(0.01, vP.x) * step(vP.x, 0.98);',
    '    float anneau = tx.r * step(an01, vP.x * 1.3) * step(0.845, rr) * step(rr, 0.925);',
    '    float puls = 0.8 + 0.2 * sin(uTemps * 6.0 + rr * 8.0);',
    '    em = vCouleur.rgb * (sceau * 1.2 * puls + front * 2.2 + anneau + exp(-rr * rr * 4.0) * 0.22 + vP.z * (tx.g + tx.r)) * vP.y;',
    '    op = smoothstep(0.9, 0.2, rr) * 0.25 * vP.y;',
    '    base = vec3(0.02, 0.0, 0.0);',
    '  } else if (m < 12.5) {',                                      // faille des chiens (v1.2) : sceau inventé qui se fissure
    '    if (rr > 1.0) discard;',
    '    vec2 q = L / R;',
    '    float g = vP.z, tr = vP.x, inten = vP.y, fis = vP.w, ouv = vP2.x, ecl = vP2.y;',
    '    float aa = fract(an01 - g * 0.137);',                         // départ du tracé propre à chaque faille
    // anneau extérieur brisé en cinq arcs inégaux, un point dans chaque brèche
    '    float s5 = an01 * 5.0 + g, i5 = floor(s5), f5 = fract(s5);',
    '    float breche = 0.1 + 0.12 * fract(sin(i5 * 12.9898 + g * 78.233) * 43758.5453);',
    '    float ann = exp(-pow((rr - 0.9) / 0.032, 2.0)) * step(breche, f5) * step(aa, tr * 1.25);',
    '    float pts = smoothstep(0.055, 0.028, length(vec2((f5 - breche * 0.5) * 1.2566 * rr, rr - 0.9))) * smoothstep(0.45, 0.6, tr);',
    // couronne de onze points et anneau ondulé
    '    float d11 = length(vec2((fract(an01 * 11.0 + g * 2.0) - 0.5) * 0.5712 * rr, rr - 0.775));',
    '    float pts2 = smoothstep(0.03, 0.014, d11) * smoothstep(0.55, 0.8, tr);',
    '    float rw = 0.66 + 0.035 * sin(an01 * 37.699112 + g * 3.0);',  // 6 ondulations
    '    float ann2 = exp(-pow((rr - rw) / 0.022, 2.0)) * step(1.0 - aa, (tr - 0.2) * 1.6);',
    // deux arcs intérieurs qui tournent en sens contraire
    '    float b1 = fract(an01 + uTemps * 0.1 + g * 0.21), b2 = fract(an01 - uTemps * 0.13 + g * 0.43);',
    '    float arcs = (exp(-pow((rr - 0.47) / 0.02, 2.0)) * step(b1, 0.36) + exp(-pow((rr - 0.33) / 0.018, 2.0)) * step(b2, 0.28) * 0.9) * smoothstep(0.35, 0.65, tr);',
    // fissures qui partent du centre et brisent le sceau
    '    float dev = (bruit(vec2(rr * 0.9 + g, an01 * 2.0 + g * 0.3)) - 0.5) * 0.8;',
    '    float br = fract(an01 * 6.0 + dev + 0.2 * sin(floor(an01 * 6.0) * 7.7 + g * 5.0));',
    '    float lf = 0.03 * (1.0 - rr) + 0.007;',
    '    float fiss = smoothstep(lf, 0.0, abs(br - 0.5) * 1.0472 * rr) * step(rr, fis * 1.05);',
    '    float b3 = fract(an01 * 11.0 + dev * 1.7 + g);',
    '    fiss = max(fiss, smoothstep(lf * 0.7, 0.0, abs(b3 - 0.5) * 0.5712 * rr) * step(rr, fis * 0.7) * step(0.3, rr));',
    // cœur : fente brûlante qui s'ouvre au centre
    '    float yc = (bruit(vec2(q.x * 1.1 + g * 0.7, g)) - 0.5) * 0.2;',
    '    float demiL = 0.58 * ouv;',
    '    float ux = clamp(abs(q.x) / max(demiL, 1e-3), 0.0, 1.0);',
    '    float larg = ouv * 0.09 * (1.0 - ux * ux) * (0.7 + 0.6 * bruit(vec2(q.x * 3.0 + g, 0.5)));',
    '    float dy = abs(q.y - yc);',
    '    float coeur = smoothstep(larg + 0.014, larg - 0.008, dy) * step(abs(q.x), demiL);',
    '    float lueurC = exp(-dy / 0.07) * smoothstep(demiL + 0.12, demiL * 0.4, abs(q.x)) * ouv;',
    '    float puls = 0.85 + 0.15 * sin(uTemps * 9.0 + g * 6.0);',
    '    float lignes = (ann * 1.3 + pts + ann2 * 0.8 + pts2 * 0.8 + arcs * 0.9) * puls;',
    '    vec3 chaud = vec3(1.0, 0.82, 0.5);',
    '    em = vCouleur.rgb * (lignes + fiss * 1.7 * (1.0 - rr * 0.5) + lueurC * 1.2 + exp(-rr * rr * 3.0) * 0.14 * tr);',
    '    em += chaud * (coeur * 2.4 * (0.8 + 0.2 * sin(uTemps * 23.0 + q.x * 9.0)) + fiss * 0.35 * (1.0 - rr));',
    '    em *= inten * (1.0 + 1.6 * ecl);',
    '    em += chaud * ecl * exp(-rr * rr * 5.0) * 1.4 * inten;',
    '    op = (smoothstep(1.0, 0.45, rr) * 0.42 * tr + coeur * 0.5) * inten;',
    '    base = vec3(0.02, 0.008, 0.005);',
    '  } else if (m < 13.5) {',                                     // liseré des murs électrifiés (v1.5) : octogone d'apothème vP.x
    '    vec2 a = abs(L);',
    '    float d = max(max(a.x, a.y), (a.x + a.y) * 0.70710678);',      // « apothème » du point (murs à 0°, 45°, 90°…)
    '    float e = d - vP.x;',                                           // > 0 : côté des murs (danger)
    '    if (e < -0.45 || d > vP.y) discard;',
    '    float n = bruit(vec2(an01 * 37.0 - uTemps * 0.6, uTemps * 0.21 + vP.w));',
    '    float courant = 0.62 + 0.38 * sin(an01 * 314.159 - uTemps * 6.0);',   // impulsions qui courent le long du liseré
    '    float ligne = smoothstep(0.12, 0.05, abs(e)) * courant;',       // bande de 20 cm : lisible même de loin, en vue rasante
    '    float coeurL = exp(-e * e * 700.0);',
    '    float halo = exp(-abs(e) * (e > 0.0 ? 2.6 : 4.5)) * (e > 0.0 ? 0.6 : 0.35);',
    '    float bande = e > 0.0 ? exp(-e * 0.8) * 0.12 * (0.55 + 0.9 * n) : 0.0;',   // côté danger : lueur douce jusqu'aux murs
    '    float da = abs(fract(an01 - vP.w + 0.5) - 0.5);',
    '    float ouv = step(da, vP.z * 0.5 + 0.001);',                     // allumage : s'étend des deux côtés de l'angle vP.w
    '    float df = da - vP.z * 0.5;',
    '    float front = exp(-df * df * 3000.0) * step(vP.z, 0.999) * exp(-e * e * 60.0);',   // tête de l'allumage, sur la ligne
    '    float vu = max(ouv, vP2.x);',                                   // partie pas encore allumée : vP2.x
    '    em = vCouleur.rgb * ((ligne * 2.2 + halo * (0.6 + 0.4 * n) + bande) * vu + front * 1.6) * vCouleur.a;',
    '    em += vec3(0.85, 0.92, 1.0) * (coeurL * 1.2 * vu + front * 0.6) * vCouleur.a;',
    '  } else if (m < 14.5) {',                                     // mare de sang du bras du Démembré (v1.5)
    '    vec2 q = L / R;',
    '    float n = bruit(q * 0.32 + vP.z), n2 = bruit(q * 1.25 + vP.z * 1.7);',
    '    float blob = length(q * vec2(1.0, 1.12)) + (n - 0.5) * 0.5 + (n2 - 0.5) * 0.1;',
    '    float rk = 0.8 * vP.x;',
    '    float coul = smoothstep(0.86, 0.93, bruit(q * 1.9 + vP.z * 2.3)) * step(length(q), 1.0) * step(0.45, length(q)) * step(0.6, vP.x);',   // éclaboussures
    '    float masque = max(smoothstep(rk + 0.02, rk - 0.02, blob), coul);',
    '    if (masque <= 0.002) discard;',
    '    float sombre = vP.y;',
    '    op = vCouleur.a * masque;',
    '    float bord = smoothstep(rk - 0.14, rk - 0.01, blob);',
    '    base = mix(vCouleur.rgb * (0.7 + 0.55 * n2) * (1.0 - 0.45 * bord), vec3(0.028, 0.012, 0.01), sombre);',
    '    float rq = length(q);',
    '    float onde = exp(-(rq - vP.w * 0.75) * (rq - vP.w * 0.75) * 600.0) * (1.0 - vP.w) * step(0.001, vP.w);',   // le pouls ride la mare
    '    float reflet = smoothstep(0.6, 0.9, bruit(q * 0.75 + vec2(uTemps * 0.015, 0.0) + 4.1));',
    '    em = vP2.xyz * (reflet * 0.3 + onde * 0.9 + 0.12 * (1.0 - bord)) * (1.0 - sombre) * op;',
    '  } else if (m < 15.5) {',                                     // veines et tendons au sol autour du bras (v1.5)
    '    if (rr > 1.0) discard;',
    '    float g = vP.z, ext = vP.x, vague = vP.y, fl = vP.w;',
    '    float dev = (bruit(vec2(rr * 1.3 + g, an01 * 3.0 + g * 0.7)) - 0.5) * 0.6;',
    '    float s9 = an01 * 9.0 + dev + 0.25 * sin(rr * 6.0 + g * 9.0);',
    '    float b9 = abs(fract(s9) - 0.5) * 0.6981 * r;',                 // distance (m) à la veine principale la plus proche
    '    float larg = mix(0.14, 0.018, rr) * (1.0 - 0.45 * fl);',
    '    float veine = smoothstep(larg, larg * 0.3, b9) * smoothstep(ext + 0.02, ext - 0.04, rr);',
    '    float s23 = an01 * 23.0 + dev * 2.2 + g;',
    '    float b23 = abs(fract(s23) - 0.5) * 0.2732 * r;',
    '    float l2 = mix(0.04, 0.008, rr) * (1.0 - 0.45 * fl);',
    '    float sel = step(0.45, fract(sin(floor(s23) * 7.31 + g * 3.0) * 43758.5453));',
    '    veine = max(veine, smoothstep(l2, l2 * 0.3, b23) * step(0.28, rr) * smoothstep(ext * 0.85 + 0.02, ext * 0.85 - 0.04, rr) * sel);',
    '    if (veine <= 0.002) discard;',
    '    op = vCouleur.a * veine * 0.92;',
    '    base = mix(vCouleur.rgb, vec3(0.022, 0.01, 0.009), fl);',
    '    float fv = (rr - vague * 1.15) / 0.1;',
    '    float pouls = exp(-fv * fv) * (1.0 - vague) * step(0.001, vague);',   // vague du battement, du centre vers les bouts
    '    em = vP2.xyz * veine * (0.3 + 2.2 * pouls) * (1.0 - fl) * vCouleur.a;',
    '  }',
    '  float f = facteurBrume();',
    '  gl_FragColor = vec4(em * (1.0 - 0.75 * f) + base * uAmbiance * op * (1.0 - f), op * (1.0 - f));',
    '}'
  ].join('\n');

  // v1.5 : panneaux (décalques verticaux sur les murs) — repère local en mètres : x le long du mur (tangente
  // (cos a, 0, −sin a)), y vers le haut ; normale (sin a, 0, cos a) ; aAxes = demi-largeur, demi-hauteur, a, motif
  var VS_PANNEAU = [
    'attribute vec3 aCentre;',
    'attribute vec4 aAxes;',
    'attribute vec4 aCouleur;',
    'attribute vec4 aParams;',
    'attribute vec4 aParams2;',
    'attribute vec4 aParams3;',
    'varying vec2 vL;',
    'varying vec2 vDemi;',
    'varying vec4 vCouleur;',
    'varying vec4 vP;',
    'varying vec4 vP2;',
    'varying vec4 vP3;',
    'varying float vMotif;',
    'varying float vProf;',
    'void main() {',
    '  vec2 c = position.xy * 2.0;',
    '  vec2 l = c * aAxes.xy;',
    '  float ca = cos(aAxes.z), sa = sin(aAxes.z);',
    '  vec3 w = aCentre + vec3(l.x * ca, l.y, -l.x * sa);',
    '  vec4 mv = modelViewMatrix * vec4(w, 1.0);',
    '  vL = l; vDemi = aAxes.xy; vCouleur = aCouleur; vP = aParams; vP2 = aParams2; vP3 = aParams3; vMotif = aAxes.w;',
    '  vProf = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FS_PANNEAU = [
    'uniform sampler2D uBruit;',
    'uniform vec2 uTempsV;',
    '#define uTemps uTempsV.x',
    'uniform float uAmbiance;',
    'varying vec2 vL;',
    'varying vec2 vDemi;',
    'varying vec4 vCouleur;',
    'varying vec4 vP;',
    'varying vec4 vP2;',
    'varying vec4 vP3;',
    'varying float vMotif;',
    GLSL_BRUME,
    'float bruit(vec2 p) { return texture2D(uBruit, p).r; }',
    // arc électrique qui court le long de x autour de y0 : ligne brisée (deux échelles de bruit), allumée par
    // tronçons qui défilent et changent neuf fois par seconde (scintillement)
    'float arc(vec2 L, float y0, float amp, float vit, float g) {',
    '  float dy = (bruit(vec2(L.x * 0.09 + g, uTemps * 0.9 + g * 3.1)) - 0.5) * amp + (texture2D(uBruit, vec2(L.x * 0.43 - uTemps * 1.9, g * 1.3)).b - 0.5) * amp * 0.45;',
    '  float d = L.y - y0 - dy;',
    '  float seg = smoothstep(0.5, 0.7, bruit(vec2(L.x * 0.05 - uTemps * vit + g * 1.7, g * 2.3 + floor(uTemps * 9.0 + g * 5.0) * 0.371)));',
    '  return seg * (exp(-d * d * 1400.0) * 1.7 + exp(-d * d * 26.0) * 0.32);',
    '}',
    // dalle (rectangle de demi-côtés h, centre (o, cy)) : intérieur (x) et bord lumineux (y)
    'vec2 dalle(vec2 L, float o, vec3 dim) {',
    '  vec2 e = abs(vec2(L.x - o, L.y - dim.z)) - dim.xy * 0.5;',
    '  float dx = max(e.x, e.y);',
    '  return vec2(smoothstep(0.02, -0.03, dx), exp(-dx * dx * 1100.0) + exp(-dx * dx * 60.0) * 0.25);',
    '}',
    'void main() {',
    '  float m = vMotif;',
    '  vec2 L = vL, D = vDemi;',
    '  vec3 em = vec3(0.0), base = vec3(0.0);',
    '  float op = 0.0;',
    '  if (m < 0.5) {',                                               // mur électrifié : arcs qui courent, dalles bleues
    '    float k = vP.x, boom = vP.y, g = vP.z, fl = vP.w;',
    '    float coin = smoothstep(0.0, -0.7, abs(L.x) - D.x);',            // fondu vers les angles de l'octogone
    '    float a1 = arc(L, -D.y * 0.62 + 0.55 * sin(uTemps * 0.7 + g * 5.0), 0.9, 1.3, g);',
    '    float a2 = arc(L, -D.y * 0.08 + 0.5 * sin(uTemps * 0.53 + g * 3.0), 1.1, -1.7, g + 0.37);',
    '    float a3 = arc(L, D.y * 0.58 + 0.4 * sin(uTemps * 0.61 + g), 0.8, 2.1, g + 0.71);',
    '    float a4 = arc(vec2(L.y, L.x), D.x * 0.5 * sin(uTemps * 0.29 + g * 7.0), 0.8, 2.6, g + 0.13);',
    '    float a5 = arc(vec2(L.y, L.x), -D.x * 0.45 * sin(uTemps * 0.37 + g * 2.0), 0.7, -2.2, g + 0.53);',
    '    float arcs = (a1 + a2 + a3 + (a4 + a5) * 0.75) * coin;',
    '    vec3 dim = vP3.xyz;',
    '    vec2 d1 = dalle(L, vP2.x, dim), d2 = dalle(L, vP2.y, dim), d3 = dalle(L, vP2.z, dim);',
    '    float dal = max(d1.x, max(d2.x, d3.x)), cadre = max(d1.y, max(d2.y, d3.y));',
    '    float n = bruit(L * vec2(0.22, 0.3) + vec2(uTemps * 0.17, -uTemps * 0.29) + g);',
    '    float n2 = texture2D(uBruit, L * 0.8 + vec2(-uTemps * 0.6, uTemps * 0.35) + g * 2.0).g;',
    '    float plasma = dal * (0.14 + 0.55 * n * n + 0.3 * smoothstep(0.62, 0.9, n2));',
    '    float court = 0.65 + 0.7 * smoothstep(0.45, 0.8, bruit(vec2((L.x + L.y) * 0.37 - uTemps * 2.6, g + 0.9)));',
    '    float haut = exp(-(L.y - D.y) * (L.y - D.y) * 1.4) * 0.16;',      // (rien au pied du mur : le liseré au sol reste lisible)
    '    float fond = (0.03 + 0.06 * n) * coin + haut;',
    '    float i = (arcs + cadre * court * 1.25 + plasma + fond) * k * fl + boom * (0.3 + 0.45 * n + dal * 0.7 + arcs * 0.8 + cadre * 0.6);',
    '    em = vCouleur.rgb * i * vCouleur.a + vec3(0.9, 0.95, 1.0) * (arcs * 0.45 * k * fl + cadre * 0.2 * k * fl) * vCouleur.a;',
    '  } else if (m < 1.5) {',                                        // bordure du plafond : courant qui file le long du mur
    '    float k = vP.x, boom = vP.y, g = vP.z, fl = vP.w;',
    '    float yy = L.y / max(D.y, 0.01);',
    '    float coin = smoothstep(0.0, -0.4, abs(L.x) - D.x);',
    '    float coeur = exp(-yy * yy * 5.0);',
    '    float n = bruit(vec2(L.x * 0.08 - uTemps * 1.9, g));',
    '    float paquets = smoothstep(0.4, 0.92, fract(L.x * 0.11 - uTemps * 1.45 + g)) + smoothstep(0.55, 0.95, fract(-L.x * 0.07 - uTemps * 0.9 + g * 2.0)) * 0.6;',
    '    float a1 = arc(L, 0.0, D.y * 1.1, 3.2, g);',
    '    float i = (coeur * (0.22 + 0.55 * n) * (0.45 + paquets) + a1 * 1.1) * (k * fl + boom * 1.5) * coin;',
    '    em = (vCouleur.rgb * i + vec3(0.9, 0.95, 1.0) * a1 * 0.4 * k * fl * coin) * vCouleur.a;',
    '  } else {',                                                     // ondulation d'un mur traversé par l'intangible
    '    float pr = vP.x, inten = vP.y * vCouleur.a, g = vP.z, et = max(vP.w, 1.0);',
    '    vec2 q = vec2(L.x / et, L.y);',
    '    float rq = length(q) / max(D.y, 0.01);',
    '    if (rq > 1.0) discard;',
    '    float n = bruit(q * 0.7 + g), n2 = texture2D(uBruit, q * 1.6 + g * 1.3).g;',
    '    float ond = 0.0;',
    '    for (int j = 0; j < 3; j++) {',                                 // trois fronts concentriques : la pierre ondoie
    '      float fi = pr * 1.3 - float(j) * 0.17;',
    '      float d = (rq - fi + (n - 0.5) * 0.09) / 0.055;',
    '      ond += sin(d * 1.7) * exp(-d * d * 0.22) * step(0.0, fi) * (1.0 - float(j) * 0.28);',
    '    }',
    '    float env = smoothstep(1.0, 0.65, rq) * (1.0 - smoothstep(0.5, 1.0, pr));',
    '    float clair = max(ond, 0.0) * env, sombre = max(-ond, 0.0) * env;',
    // ectoplasme sombre : tache qui s'étale du point de passage, coulures vers le bas, puis s'estompe
    '    float coule = smoothstep(0.75, 0.95, n2) * smoothstep(0.0, -0.6, q.y / max(D.y, 0.01)) * 0.6;',
    '    float tache = smoothstep(0.5 * pr + 0.12 + (n - 0.5) * 0.3, 0.0, rq - coule * 0.25) * (1.0 - smoothstep(0.3, 1.0, pr));',
    '    op = clamp(sombre * 0.65 + tache * 0.8, 0.0, 1.0) * inten;',
    '    base = mix(vec3(0.045, 0.04, 0.038), vCouleur.rgb, clamp(tache * 1.6, 0.0, 1.0));',
    '    float bordT = tache * (1.0 - tache) * 4.0;',                     // bord de la tache d'ectoplasme : liseré violet
    '    em = (vec3(0.3, 0.28, 0.27) * clair * 0.7 * uAmbiance + vec3(0.26, 0.22, 0.3) * clair * 0.55 + vec3(0.4, 0.07, 0.38) * (clair * 0.35 + bordT * 0.35 + tache * 0.12 * (0.6 + 0.8 * n2))) * inten;',
    '  }',
    '  float f = facteurBrume();',
    '  gl_FragColor = vec4(em * (1.0 - 0.75 * f) + base * uAmbiance * op * (1.0 - f), op * (1.0 - f));',
    '}'
  ].join('\n');

  var VS_VOLUME = [
    'varying vec3 vN;',
    'varying vec3 vV;',
    'varying vec2 vUv;',
    'varying float vProf;',
    'void main() {',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vN = normalize(normalMatrix * normal);',
    '  vV = -mv.xyz;',
    '  vUv = uv;',
    '  vProf = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FS_VOLUME = [
    'uniform sampler2D uBruit;',
    'uniform vec2 uTempsV;',
    '#define uTemps uTempsV.x',
    'uniform vec4 uCoul;',
    'uniform vec4 uP;',
    'varying vec3 vN;',
    'varying vec3 vV;',
    'varying vec2 vUv;',
    GLSL_BRUME,
    'void main() {',
    '  vec3 N = normalize(vN), V = normalize(vV);',
    '  float fac = abs(dot(N, V));',
    '  float m = uP.x, k = uP.y;',
    '  vec3 em = vec3(0.0);',
    '  float op = 0.0;',
    '  if (m < 0.5) {',
    '    float n = texture2D(uBruit, vec2(vUv.x * 4.0 + uP.z, vUv.y * 0.7 - uTemps * 0.55)).r;',
    '    float n2 = texture2D(uBruit, vec2(vUv.x * 9.0 - uP.z, vUv.y * 1.6 - uTemps * 1.1)).g;',
    '    float v = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(uP.w, 1.0, vUv.y));',
    '    float pres = smoothstep(0.6, 3.0, vProf);',
    '    em = uCoul.rgb * pow(fac, 2.6) * v * (0.35 + 0.45 * n + 0.5 * smoothstep(0.55, 0.85, n2)) * k * pres;',
    '  } else if (m < 1.5) {',
    '    float n = texture2D(uBruit, vUv * vec2(4.0, 2.0) + vec2(uTemps * 0.1, uP.z)).r;',
    '    em = uCoul.rgb * pow(1.0 - fac, 4.0) * (0.5 + 0.7 * n) * k * (gl_FrontFacing ? 1.0 : 0.4);',
    '  } else if (m < 2.5) {',
    '    op = uCoul.a * pow(fac, 0.6) * k;',
    '    em = uCoul.rgb * pow(1.0 - fac, 3.0) * k * 1.5;',
    '  } else if (m < 3.5) {',
    '    float n = texture2D(uBruit, vec2(vUv.x * 2.0 + uTemps * 0.2, vUv.y * 1.5 - uTemps * 0.9)).r;',
    '    float bandes = smoothstep(0.82, 1.0, 0.5 + 0.5 * sin(vUv.x * 6.2831853 * 7.0 + vUv.y * 7.0 - uTemps * 6.0 + n * 3.0));',
    '    float v = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));',
    '    em = uCoul.rgb * bandes * v * (0.4 + 0.8 * n) * pow(fac, 1.5) * k * (gl_FrontFacing ? 1.0 : 0.0);',
    '  } else if (m < 4.5) {',                                          // fissures lumineuses sur le verre d'une cuve (v1.3)
    // repère du verre en mètres (pourtour 2π·0,85 ≈ 5,34 m, hauteur 2,6 m) ; point de rupture en u = 0 (face au boss), à 1,35 m
    '    float su = (vUv.x > 0.5 ? vUv.x - 1.0 : vUv.x) * 5.34;',
    '    vec2 e = vec2(su, vUv.y * 2.6 - 1.35);',
    '    float d = length(e), a = atan(e.y, e.x);',
    '    float nb = texture2D(uBruit, vec2(a * 0.159 + 0.3, d * 0.25)).r;',
    '    float ray = abs(fract(a * 1.273 + nb * 0.35) - 0.5) * 0.785 * d;',      // distance (m) au rayon le plus proche
    '    float rayons = smoothstep(0.014 + 0.012 * d, 0.0, ray);',
    '    float anneaux = smoothstep(0.022, 0.0, abs(d - 0.32 - nb * 0.06)) + smoothstep(0.02, 0.0, abs(d - 0.78 - nb * 0.1)) * 0.8;',
    '    float n1 = texture2D(uBruit, vec2(vUv.x * 1.7, vUv.y * 0.85) + vec2(0.37, 0.11)).r;',
    '    float reseau = smoothstep(0.95, 0.99, 1.0 - abs(n1 * 2.0 - 1.0));',
    '    float front = uP.w * 3.2;',
    '    float masque = smoothstep(front, front - 0.25, d);',
    '    float scint = 0.85 + 0.3 * sin(uTemps * 14.0 + d * 6.0);',
    '    em = uCoul.rgb * ((rayons * 1.2 + anneaux * 0.7 + reseau * 0.5) * masque * scint + exp(-d * d * 7.0) * 0.8 * uP.w) * k * (gl_FrontFacing ? 1.0 : 0.4);',
    '  } else {',                                                         // voile de bouclier du boss protégé (v1.3)
    '    float n = texture2D(uBruit, vec2(vUv.x * 3.0 + uTemps * 0.04, vUv.y * 2.0 - uTemps * 0.1)).r;',
    '    float rim = pow(1.0 - fac, 2.2);',
    '    float bandes = pow(0.5 + 0.5 * sin((vUv.y * 10.0 - uTemps * 1.3 + n * 2.5) * 3.14159), 6.0);',
    '    float pts = smoothstep(0.86, 0.95, texture2D(uBruit, vUv * vec2(6.0, 4.0) + vec2(uTemps * 0.02, 0.0)).b);',
    '    float puls = 0.78 + 0.22 * sin(uTemps * 4.2 + uP.w * 6.2831853);',
    '    em = uCoul.rgb * (rim * (0.55 + 0.6 * n) + bandes * (0.12 + 0.5 * rim) + pts * 0.25 + 0.03) * puls * k * (gl_FrontFacing ? 1.0 : 0.3);',
    '  }',
    '  float f = facteurBrume();',
    '  gl_FragColor = vec4(em * (1.0 - 0.75 * f), op * (1.0 - f));',
    '}'
  ].join('\n');

  var VS_ECRAN = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }';
  var FS_ECRAN = [
    'uniform sampler2D uBruit;',
    'uniform vec2 uTempsV;',
    '#define uTemps uTempsV.x',
    'uniform float uAspect;',
    'uniform vec4 uA;',      // obscurité (vignette), noir de la vision, capture des âmes, aspiration
    'uniform vec4 uB;',      // noir (fondus), éclair blanc, frappe (entaille rouge), état critique
    'uniform vec4 uC;',      // v1.4 : coup sans entaille (crochet, blocs…), teinte glacée de l'entaille (lames bleues) ; v1.5 : choc électrique (murs)
    'varying vec2 vUv;',
    'vec4 sur(vec4 d, vec3 rgb, float a) { return vec4(rgb + d.rgb * (1.0 - a), a + d.a * (1.0 - a)); }',
    'void main() {',
    '  vec2 p = vUv * 2.0 - 1.0;',
    '  p.x *= uAspect;',
    '  float r = length(p);',
    '  float an = atan(p.y, p.x);',
    '  vec4 o = vec4(0.0);',
    '  vec3 add = vec3(0.0);',
    '  if (uA.w > 0.001) {',
    '    float tour = an / 6.2831853 + 0.08 / (r + 0.15) + uTemps * 0.05;',
    '    float n = texture2D(uBruit, vec2(tour * 3.0, r * 0.6 + uTemps * 0.9)).r;',
    '    float n2 = texture2D(uBruit, vec2(tour * 7.0 + 0.3, r * 1.2 + uTemps * 1.7)).g;',
    '    float n3 = texture2D(uBruit, vec2(an * 1.909 + n * 0.4, r * 0.35 + uTemps * 1.3)).b;',
    '    float raies = smoothstep(0.6, 0.85, n3) * smoothstep(0.1, 0.8, r) * (0.6 + 0.6 * n);',
    '    add += mix(vec3(1.0, 0.3, 0.08), vec3(0.45, 0.55, 1.0), n2) * raies * uA.w * 0.8;',
    '    float tourb = sin(an * 3.0 + r * 4.0 - uTemps * 3.0) * 0.12 * uA.w;',
    '    float bord = smoothstep(1.4 - uA.w * 1.1, 1.7 - uA.w * 0.7, r + (n - 0.5) * 0.35 + tourb);',
    '    o = sur(o, vec3(0.02, 0.0, 0.0) * bord, clamp(bord * uA.w, 0.0, 1.0));',
    '  }',
    '  if (uA.x > 0.001) {',
    '    float n = texture2D(uBruit, vec2(an * 0.477 + uTemps * 0.015, r * 0.35 - uTemps * 0.04)).r;',
    '    float n2 = texture2D(uBruit, p * 0.3 + vec2(uTemps * 0.011, -uTemps * 0.009)).g;',
    '    float rv = mix(1.9, 1.0, uA.x) + (n - 0.5) * 0.26 + (n2 - 0.5) * 0.16 + 0.04 * sin(uTemps * 0.7);',
    '    float v = smoothstep(rv - 0.4, rv + 0.75, r);',
    '    float a = clamp(v * (0.55 + 0.37 * uA.x) + 0.05 * uA.x, 0.0, 0.94);',
    '    o = sur(o, vec3(0.006, 0.008, 0.014) * a, a);',
    '  }',
    '  if (uA.z > 0.001) {',
    '    float tour = an * 1.2732 - 0.35 / (r + 0.25) - uTemps * 0.25;',
    '    float n = texture2D(uBruit, vec2(tour * 1.4, r * 0.12 - uTemps * 0.35)).b;',
    '    float n2 = texture2D(uBruit, vec2(tour * 0.5 + 0.37, r * 0.3 - uTemps * 0.5)).r;',
    '    float voiles = smoothstep(0.6, 0.7, n) * smoothstep(0.15, 1.1, r) * (0.4 + 0.9 * n2);',
    '    add += vec3(0.3, 0.85, 0.75) * voiles * uA.z * (1.0 - uA.z * 0.55) * 0.55;',
    '    float a = clamp(smoothstep(1.5 - uA.z * 1.3, 1.7 - uA.z * 0.6, r) * uA.z + uA.z * 0.22, 0.0, 1.0);',
    '    o = sur(o, vec3(0.0, 0.01, 0.012) * a, a);',
    '  }',
    '  if (uA.y > 0.001) o = sur(o, vec3(0.0), uA.y);',
    '  if (uB.w > 0.001) {',
    '    float pouls = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(uTemps * 7.5), 3.0);',
    '    float a = smoothstep(0.75, 1.75, r) * uB.w * pouls * 0.55;',
    '    o = sur(o, vec3(0.28, 0.0, 0.0) * a, a);',
    '  }',
    '  if (uB.z > 0.001) {',
    '    vec2 dn = normalize(vec2(0.55, 1.0));',
    '    float d = dot(p, dn) + (texture2D(uBruit, vec2(dot(p, vec2(dn.y, -dn.x)) * 0.4, 0.3)).r - 0.5) * 0.08;',
    '    float entaille = exp(-d * d * 220.0) * smoothstep(1.3, 0.2, abs(dot(p, vec2(dn.y, -dn.x))));',
    '    add += mix(vec3(1.0, 0.12, 0.06), vec3(0.5, 0.82, 1.0), uC.y) * entaille * uB.z * 0.85;',
    '    float a = clamp(smoothstep(0.45, 1.6, r) * 0.45 + entaille * 0.2, 0.0, 1.0) * uB.z;',
    '    o = sur(o, mix(vec3(0.3, 0.0, 0.0), vec3(0.03, 0.1, 0.16), uC.y) * a, a);',
    '  }',
    '  if (uC.x > 0.001) {',
    '    float a = clamp(smoothstep(0.4, 1.6, r) * 0.5, 0.0, 1.0) * uC.x;',
    '    o = sur(o, vec3(0.3, 0.0, 0.0) * a, a);',
    '  }',
    '  if (uC.z > 0.001) {',                                           // v1.5 : choc des murs électrifiés (filaments bleus au bord)
    '    float fil = 0.0;',
    '    for (int k = 0; k < 6; k++) {',
    '      float g = floor(uTemps * 11.0) * 1.37 + float(k) * 17.0;',
    '      float ak = fract(sin(g * 12.9898) * 43758.5453) * 6.2831853 - 3.14159;',
    '      float jit = (texture2D(uBruit, vec2(r * 0.8 + g * 0.37, g * 0.13)).r - 0.5) * 0.6 + (texture2D(uBruit, vec2(r * 3.1 + g, g * 0.71)).g - 0.5) * 0.18;',
    '      float dA = an - ak - jit / max(r, 0.3);',
    '      dA -= 6.2831853 * floor((dA + 3.14159) / 6.2831853);',
    '      float w = abs(dA) * r;',
    '      float rmin = 0.55 + 0.6 * fract(sin(g * 7.13) * 917.3);',
    '      fil += exp(-w * w * 7000.0) * smoothstep(rmin, rmin + 0.25, r);',
    '    }',
    '    float bord = smoothstep(0.6, 1.7, r);',
    '    add += vec3(0.55, 0.78, 1.0) * (fil * 1.3 + bord * 0.2) * uC.z;',
    '    float a = clamp(bord * 0.35, 0.0, 1.0) * uC.z;',
    '    o = sur(o, vec3(0.01, 0.03, 0.08) * a, a);',
    '  }',
    '  if (uB.x > 0.001) { o = sur(o, vec3(0.0), uB.x); add *= 1.0 - uB.x; }',
    '  if (uB.y > 0.001) add += vec3(1.0, 0.93, 0.78) * uB.y * (0.75 + 0.25 * (1.0 - min(r, 1.0)));',
    '  gl_FragColor = vec4(o.rgb + add, o.a);',
    '}'
  ].join('\n');

  // ═════════════════════════════════════════════════════════════════════════════════════════
  // Création
  // ═════════════════════════════════════════════════════════════════════════════════════════
  function creer(THREE, options) {
    options = options || {};
    if (!THREE) throw new Error('BossB7Fx : THREE manquant');
    var CFG = options.config || root.BOSS_B7_CONFIG;
    var AR = options.arene || root.BOSS_B7_ARENE;
    if (!CFG) throw new Error('BossB7Fx : options.config manquante (BOSS_B7_CONFIG)');
    if (!AR || !AR.salle) throw new Error('BossB7Fx : options.arene manquante (BOSS_B7_ARENE)');
    var scenes = options.scenes || {};
    if (!scenes.salle && !scenes.bunker) throw new Error('BossB7Fx : options.scenes.salle ou options.scenes.bunker requis');
    var renderer = options.renderer || null, camera = options.camera || null, monde = options.monde || null;
    var surSecousse = typeof options.surSecousse === 'function' ? options.surSecousse : null;
    var nomQualite = QUALITES[options.qualite] ? options.qualite : 'haute';
    var Q = QUALITES[nomQualite];
    var N1 = 1 / Q.densite;                              // « une particule » pour les émetteurs (n × densité = 1), calculé une fois
    var REV = parseInt(THREE.REVISION, 10) || 0;
    var gouttesLames = options.gouttesLames !== false;
    var obscuriteActive = options.obscurite !== false;     // false : le jeu gère lui-même l'obscurité de la phase 5
    var ali = mulberry24(nombre(options.graine, 1939) + 77);
    function entre(a, b) { return a + (b - a) * (ali() * K_ALEA); }
    function plage(t) { return t[0] + (t[1] - t[0]) * (ali() * K_ALEA); }

    // ── réglages lus dans la config (aucune valeur d'équilibrage recopiée) ──
    function cfg(chemin, defaut) { var v = lireChemin(CFG, chemin); return v === undefined ? defaut : v; }
    var DEF = (root.BossB7Logique && root.BossB7Logique.DEFAUTS) || null;
    function defautLogique(cle, secours) {
      if (DEF && DEF[cle]) { var v = lireChemin(CFG, DEF[cle][0]); return v === undefined ? DEF[cle][1] : v; }
      return secours;
    }
    var R_RITUEL = nombre(cfg('phase4.rayon', AR.salle.cercle ? AR.salle.cercle.rayon : 4.5), 4.5);
    var T_FORMATION = nombre(cfg('phase4.formation', 4), 4);
    var T_FIN_RITUEL = nombre(cfg('phase4.fin', 4.2), 4.2);
    var K_EXPLOSION = nombre(defautLogique('explosionRituel', 0.62), 0.62);
    var T_FONDU_INTRO = nombre(cfg('introduction.fondu', 1.4), 1.4);
    var VISION_INT = clamp(nombre(cfg('phase5.obscurite.intensite', 0.85), 0.85), 0.05, 0.999);
    var RAYON_VISION = Math.max(1, nombre(cfg('phase5.obscurite.rayonVision', 7), 7));
    var H_TRAQUE = nombre(cfg('phase5.traque.hauteur', 0.25), 0.25);
    var PIQUE_RAYON = nombre(cfg('phase2.pique.rayonImpact', 1.3), 1.3);
    var PIQUE_DEPASSEMENT = nombre(cfg('phase2.pique.depassement', 3), 3);
    var PIQUE_VERROU = nombre(cfg('phase2.pique.verrouillage', 0.4), 0.4);
    var RAYON_BLOC = nombre(cfg('phase3.arrachement.rayonBloc', 1.4), 1.4);
    var ONDE_RAYON = nombre(cfg('phase3.ondeChoc.rayon', 5), 5);
    var T_DESCENTE = nombre(cfg('retourRage.descente', 1.2), 1.2);
    var FRAPPE_PORTEE = nombre(cfg('phase5.frappe.portee', 2.8), 2.8);
    var FRAPPE_ANGLE = nombre(cfg('phase5.frappe.angle', 75), 75) * PI / 180;
    var AMES_AILES = Math.max(1, nombre(cfg('phase2.amesPourAiles', 10), 10));
    var T_LAMES_DESINT = nombre(cfg('defaite.desintegrationLames', 2), 2);
    var T_RETOUR_BUNKER = nombre(cfg('conclusion.retourBunker', 2), 2);
    var T_MESSAGE = nombre(cfg('conclusion.message.duree', 10), 10);
    var T_DESIGNATION = nombre(cfg('phase3.arrachement.designation', 0.8), 0.8);
    var T_RECONSTRUCTION = nombre(defautLogique('reconstructionBloc', 2.0), 2.0);
    var T_ETOURDI = nombre(cfg('phase2.pique.etourdi', 1.4), 1.4);
    // v1.2 : meute de chiens zombies (API.md §14) — la faille s'ouvre chiens.faille.duree s avant le jaillissement
    var T_FAILLE_CHIEN = Math.max(0.2, nombre(cfg('chiens.faille.duree', 0.9), 0.9)), T_FAILLE_FIN = 0.6;
    var RAYON_FAILLE = Math.max(0.3, nombre(options.rayonFaille, 0.8));
    // v1.5 : rages des mini-boss, murs électrifiés, intangibilité de la phase 5 (API.md §17)
    var T_SURCHARGE = Math.max(0.1, nombre(cfg('miniBoss.survolte.rage.duree', 2.5), 2.5));
    var T_CRI = Math.max(0.1, nombre(cfg('miniBoss.irradie.rage.duree', 1.2), 1.2));
    var AURA_IRR = Math.max(0.3, nombre(cfg('miniBoss.irradie.rage.aura.rayon', 1.5), 1.5));
    var MURS_DISTANCE = Math.max(0.2, nombre(cfg('miniBoss.murs.distance', 2.2), 2.2));
    var MURS_EXTINCTION = Math.max(0.1, nombre(cfg('miniBoss.murs.extinction', 1.0), 1.0));
    var H_TORSE = nombre(defautLogique('torseSeptieme', 1.3), 1.3);
    var H_EPAULE = nombre(defautLogique('brasDepart', 3.0), 3.0);
    var V_INTANG = Math.max(0.5, nombre(cfg('phase5.paliers.intangible.vitesse', 6.5), 6.5));
    var R_MIROIR = Math.max(0.5, nombre(options.rayonMiroitement, 4));
    var mareBras = options.mareBras !== false;           // false : le jeu dessine déjà la mare sous le bras (les veines restent)
    var lueursIrradies = options.lueursIrradies !== false;   // false : le jeu dessine déjà la lueur au sol des zombies irradiés
    var G_ETOURDI = {};
    for (var kg in GAB.etourdi) G_ETOURDI[kg] = GAB.etourdi[kg];
    G_ETOURDI.vie = [T_ETOURDI * 0.85, T_ETOURDI];

    // ── arène (repère monde) ──
    var O = AR.salle.origine || { x: 0, y: 0, z: 0 };
    var SOL_SALLE = +O.y || 0;
    var APO = nombre(AR.salle.apotheme, 15), HAUT = nombre(AR.salle.hauteur, 8);
    var PLAFOND = SOL_SALLE + HAUT - 0.2;
    var CERCLE_X = (+O.x || 0) + (AR.salle.cercle ? +AR.salle.cercle.x || 0 : 0), CERCLE_Z = (+O.z || 0) + (AR.salle.cercle ? +AR.salle.cercle.z || 0 : 0);
    // v1.1 : piliers destructibles et cercle rituel des téléportations du bunker
    var PILIERS = {};
    (AR.salle.piliers || []).forEach(function (q) { PILIERS[q.id] = { x: (+O.x || 0) + q.x, y: SOL_SALLE, z: (+O.z || 0) + q.z, rayon: q.rayon || 0.85 }; });
    var RAYON_TP = nombre(options.rayonCercleTeleport, 2.0), DESSIN_TP = 0.35, TENUE_TP = 1.2, EFFACE_TP = 1.2;
    var DALLES = {};
    (AR.salle.dalles || []).forEach(function (d) {
      DALLES[d.id] = { x: (+O.x || 0) + d.centre.x, y: SOL_SALLE + d.centre.y, z: (+O.z || 0) + d.centre.z, nx: d.normale.x, nz: d.normale.z, l: d.largeur || 3.2, h: d.hauteur || 2.6 };
    });
    // v1.3 : cuves vertes (arene.salle.tubes) ; le verre commence au-dessus du socle (prototype : 0,46 m, option socleCuve)
    var SOCLE_CUVE = Math.max(0, nombre(options.socleCuve, 0.46));
    var FISSURES_CUVE = options.fissuresCuve !== false;   // false : la cuve du jeu dessine déjà ses fissures
    var TUBES = {}, LISTE_TUBES = [];
    (AR.salle.tubes || []).forEach(function (t) {
      var T0 = { id: t.id, i: LISTE_TUBES.length, x: (+O.x || 0) + (+t.x || 0), y: SOL_SALLE + (+t.y || 0), z: (+O.z || 0) + (+t.z || 0),
        rayon: nombre(t.rayon, 0.85), hauteur: nombre(t.hauteur, 2.6), miniBoss: t.miniBoss || null, bas: 0, haut: 0, fissures: null };
      T0.bas = T0.y + SOCLE_CUVE; T0.haut = T0.bas + T0.hauteur;
      TUBES[t.id] = T0; LISTE_TUBES.push(T0);
    });
    function tubePar(id, type) {
      if (id != null && TUBES[id]) return TUBES[id];
      if (type) for (var i = 0; i < LISTE_TUBES.length; i++) if (LISTE_TUBES[i].miniBoss === type) return LISTE_TUBES[i];
      return null;
    }
    function hexVersCouleur(h, defaut) {
      if (typeof h !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(h)) return defaut;
      var v = parseInt(h.replace('#', ''), 16);
      return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    }
    // couleurs des mini-boss (config.miniBoss.<type>.couleur), converties une fois
    var COUL_MB = {
      survolte: hexVersCouleur(cfg('miniBoss.survolte.couleur', '#38D9FF'), [0.22, 0.85, 1.0]),
      irradie: hexVersCouleur(cfg('miniBoss.irradie.couleur', '#8CFF2E'), [0.55, 1.0, 0.18]),
      demembre: hexVersCouleur(cfg('miniBoss.demembre.couleur', '#E3B65C'), [0.89, 0.71, 0.36])
    };
    (cfg('miniBoss.ordre', []) || []).forEach(function (t) { var c = hexVersCouleur(cfg('miniBoss.' + t + '.couleur', null), null); if (c) COUL_MB[t] = c; });
    function couleurMB(type) { return (type && COUL_MB[type]) || COUL.cuve; }
    // v1.5 : les murs de l'octogone (arene.salle.murs), décalques posés sur la façade (devant les dalles)
    var EP_DALLE = 0;
    (AR.salle.dalles || []).forEach(function (d) { var e = nombre(d.epaisseur, 0.6); if (e > EP_DALLE) EP_DALLE = e; });
    var FACADE = Math.max(1, nombre(options.facadeMurs, APO - EP_DALLE));
    var MURS = [], MUR_PAR_ID = {}, DALLE_SLOT = {};
    (function () {
      var L = AR.salle.murs && AR.salle.murs.length ? AR.salle.murs : null, nm = L ? L.length : 8, demi = Math.tan(PI / Math.max(3, nm));
      for (var m = 0; m < nm; m++) {
        var w = L ? L[m] : null, th = w && w.normale ? Math.atan2(+w.normale.x || 0, +w.normale.z || 0) : m * PI / 4;
        var nx = Math.sin(th), nz = Math.cos(th), tx = Math.cos(th), tz = -Math.sin(th);
        var M = { id: w && w.id ? w.id : 'mur' + m, i: m, ang: th, nx: nx, nz: nz, tx: tx, tz: tz, cx: (+O.x || 0) + nx * FACADE, cz: (+O.z || 0) + nz * FACADE,
          hw: FACADE * demi, o: [999, 999, 999], dl: 3.2, dh: 2.6, dy: 2.0 - HAUT / 2 };
        MURS.push(M); MUR_PAR_ID[M.id] = M;
      }
      (AR.salle.dalles || []).forEach(function (d) {
        var cx = (+O.x || 0) + d.centre.x, cz = (+O.z || 0) + d.centre.z, best = null, bd = -1e9;
        for (var k = 0; k < MURS.length; k++) { var v = (cx - (+O.x || 0)) * MURS[k].nx + (cz - (+O.z || 0)) * MURS[k].nz; if (v > bd) { bd = v; best = MURS[k]; } }
        if (!best) return;
        for (var j = 0; j < 3; j++) if (best.o[j] === 999) {
          best.o[j] = (cx - best.cx) * best.tx + (cz - best.cz) * best.tz;
          best.dl = nombre(d.largeur, 3.2); best.dh = nombre(d.hauteur, 2.6); best.dy = nombre(d.centre.y, 2.0) - HAUT / 2;
          DALLE_SLOT[d.id] = best.i * 3 + j;
          break;
        }
      });
    })();
    /** Mur dont le plan est le plus proche de (x, z) (distance la plus petite à la façade). */
    function murProche(x, z) {
      var best = MURS[0], bd = -1e9;
      for (var k = 0; k < MURS.length; k++) { var v = (x - (+O.x || 0)) * MURS[k].nx + (z - (+O.z || 0)) * MURS[k].nz; if (v > bd) { bd = v; best = MURS[k]; } }
      return best;
    }

    // ── lumières : unités physiques (r155+ ou physicallyCorrectLights) sinon anciennes unités ──
    var ECHELLE_LUMIERES = nombre(options.echelleLumieres, 0.14);
    var camPresente = false, CAM = new Float64Array(3);   // position de la caméra (x, y, z) de l'image
    var physique = REV >= 155 ? !(renderer && renderer.useLegacyLights === true) : !!(renderer && (renderer.physicallyCorrectLights === true || renderer.useLegacyLights === false));
    var K_LUM = physique ? 1 : 1 / PI;

    // ── uniformes partagés ──
    var U_TEMPS = { value: new THREE.Vector2() };   // x = horloge (vecteur : écriture en place, sans allocation)
    var U_DEMI = { value: new THREE.Vector2(640, 360) };
    var texBruit = creerTextureBruit(Q.bruit);
    var texCercle = creerTextureCercle(Q.cercle);
    var U_BRUIT = { value: texBruit };
    var U_CERCLE = { value: texCercle };
    var _taille = new THREE.Vector2();

    function uniformesBrume() { return { fogColor: { value: new THREE.Color(0, 0, 0) }, fogNear: { value: 1 }, fogFar: { value: 2000 }, fogDensity: { value: 0.00025 } }; }
    function materiau(vs, fs, u, opts) {
      var uni = uniformesBrume();
      for (var k in u) uni[k] = u[k];
      var m = new THREE.ShaderMaterial({
        uniforms: uni, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, depthTest: !(opts && opts.sansProfondeur),
        fog: !(opts && opts.sansBrume), side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
      });
      if (opts && opts.decalage) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }
      return m;
    }
    function dyn(attr) { if (attr.setUsage) attr.setUsage(THREE.DynamicDrawUsage); return attr; }

    // ─────────────────────────────── textures procédurales ───────────────────────────────
    function creerTextureBruit(N) {
      // bruit de valeur répétable, 4 canaux à fréquences différentes (fbm)
      var data = new Uint8Array(N * N * 4), r = mulberry32(4242);
      var G = 64, grille = new Float32Array(G * G * 4);
      for (var i = 0; i < grille.length; i++) grille[i] = r();
      function vn(x, y, f, c) {
        var X = x * f, Y = y * f, i0 = Math.floor(X), j0 = Math.floor(Y), fx = X - i0, fy = Y - j0;
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        var i1 = (i0 + 1) % f, j1 = (j0 + 1) % f; i0 %= f; j0 %= f;
        var a = grille[((j0 * G + i0) * 4) + c], b = grille[((j0 * G + i1) * 4) + c], cc = grille[((j1 * G + i0) * 4) + c], d = grille[((j1 * G + i1) * 4) + c];
        return a + (b - a) * fx + (cc - a) * fy + (a - b - cc + d) * fx * fy;
      }
      var F = [[4, 8, 16], [8, 16, 32], [16, 32, 64], [6, 12, 24]];
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var u = x / N, v = y / N, o = (y * N + x) * 4;
        for (var c = 0; c < 4; c++) {
          var f = F[c], s = 0.55 * vn(u, v, f[0], c) + 0.3 * vn(u, v, f[1], c) + 0.15 * vn(u, v, f[2], c);
          data[o + c] = Math.round(clamp((s - 0.5) * 1.6 + 0.5, 0, 1) * 255);
        }
      }
      var t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    }
    function nouveauCanevas(n) {
      if (typeof document !== 'undefined' && document.createElement) { var c = document.createElement('canvas'); c.width = c.height = n; return c; }
      if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(n, n);
      return null;
    }
    /** Cercle du rituel : R = anneaux (et points), G = sceau à sept branches, B = glyphes inventés. */
    function creerTextureCercle(N) {
      var cv = nouveauCanevas(N);
      if (!cv) { var t0 = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat); t0.needsUpdate = true; return t0; }
      var g = cv.getContext('2d'), c = N / 2, s = N / 1024;
      g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
      g.globalCompositeOperation = 'lighter';
      function anneau(rho, ep) { g.beginPath(); g.arc(c, c, rho * c, 0, TAU); g.lineWidth = Math.max(1.2, ep * s); g.stroke(); }
      g.strokeStyle = '#f00'; g.fillStyle = '#f00';
      anneau(0.965, 3); anneau(0.893, 9); anneau(0.86, 2.2); anneau(0.79, 3); anneau(0.615, 5);
      for (var i = 0; i < 48; i++) {                          // points entre l'anneau extérieur et le grand anneau
        var a = (i + 0.5) / 48 * TAU, rp = 0.93;
        g.beginPath(); g.arc(c + Math.sin(a) * rp * c, c - Math.cos(a) * rp * c, (i % 6 === 0 ? 4.2 : 2.2) * s, 0, TAU); g.fill();
      }
      for (var j = 0; j < 7; j++) {                           // sept petits arcs sur l'anneau intérieur
        var a1 = (j / 7) * TAU + 0.2;
        g.beginPath(); g.arc(c + Math.sin(a1) * 0.615 * c, c - Math.cos(a1) * 0.615 * c, 0.035 * c, 0, TAU); g.lineWidth = Math.max(1.2, 3 * s); g.stroke();
      }
      g.strokeStyle = '#0f0'; g.fillStyle = '#0f0';
      dessinerSceau(g, c, c, 0.56 * c / SCEAU_ETENDUE, 3.0);
      g.strokeStyle = '#00f'; g.fillStyle = '#00f';
      for (var k = 0; k < NB_GLYPHES; k++) {
        var ag = (k + 0.5) / NB_GLYPHES * TAU, rg = 0.703 * c;
        g.save();
        g.translate(c + Math.sin(ag) * rg, c - Math.cos(ag) * rg);
        g.rotate(ag);
        dessinerGlyphe(g, k, 0, 0, 0.052 * c, 3.2 * s);
        g.restore();
      }
      var t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.needsUpdate = true;
      return t;
    }

    // ─────────────────────────────── objets réutilisés ───────────────────────────────
    // Une seule forme d'objet (« fiche ») pour tout ce qui est en réserve : halos, sols, rubans, volumes. Les fonctions
    // communes (couleur, facteurFondu, lacher…) voient alors toujours la même classe cachée : accès monomorphes,
    // compilés en ligne, sans mise en boîte des flottants (aucune allocation par image).
    function Fiche() {
      // commun
      this.actif = false; this.motif = 0; this.x = 0; this.y = 0; this.z = 0; this.r = 1; this.g = 1; this.b = 1; this.a = 0;
      this.age = 0; this.vie = 0; this.courbe = 0; this.i0 = 1; this.fondu = 0; this.finFondu = 0; this.ancre = -1; this.k = 0; this.graine = 0;
      // halos (et volumes : sx, sy, s0, s1)
      this.sx = 0.5; this.sy = 0.5; this.tirer = 0; this.i = 1; this.rot = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.s0 = 0; this.s1 = 0;
      this.ox = 0; this.oy = 0; this.oz = 0; this.mx = 0; this.my = 0; this.mz = 0;
      // sols
      this.hx = 1; this.hz = 1; this.ang = 0; this.p0 = 0; this.p1 = 0; this.p2 = 0; this.p3 = 0; this.q0 = 0; this.q1 = 0; this.q2 = 0; this.q3 = 0; this.v0 = 0;
      // panneaux (v1.5) : troisième jeu de paramètres (dalles d'un mur : largeur, hauteur, centre)
      this.w0 = 0; this.w1 = 0; this.w2 = 0; this.w3 = 0;
      // rubans
      this.type = 0; this.style = 0; this.larg = 0.1; this.r2 = 1; this.g2 = 1; this.b2 = 1; this.alpha = 1;
      this.A = -1; this.B = -1; this.ax = 0; this.ay = 0; this.az = 0; this.bx = 0; this.by = 0; this.bz = 0;
      this.amp = 0; this.freq = 1; this.vit = 1; this.croissance = 1; this.arche = 0; this.regen = 0.05; this.tRegen = 0; this.flick = 1;
      this.e1x = 1; this.e1y = 0; this.e1z = 0; this.e2x = 0; this.e2y = 1; this.e2z = 0;
      this.pts = null; this.np = 0; this.off = null; this.hist = null; this.nh = 0; this.ih = 0; this.pousse = false; this.retrait = 0; this.sale = false;
      this.maillons = 10;                                // chaîne (v1.4) : nombre de maillons sur la longueur
      // volumes
      this.mesh = null; this.mat = null; this.geo = ''; this.sz = 1; this.haut = 0.55;
    }
    function nouveauHalo() { return new Fiche(); }
    function nouveauSol() { var o = new Fiche(); o.a = 1; return o; }
    function nouveauRuban(K) {
      var o = new Fiche();
      o.pts = new Float32Array(K * 3); o.off = new Float32Array(K * 2); o.hist = new Float32Array(K * 3);
      return o;
    }
    function nouveauVolume(mesh, mat, geo) {
      var o = new Fiche();
      o.mesh = mesh; o.mat = mat; o.geo = geo; o.sx = 1; o.sy = 1; o.s0 = 1; o.s1 = 1;
      return o;
    }

    // ─────────────────────────────── couches (une par scène) ───────────────────────────────
    var PS = 36;   // flottants par particule (CPU)
    var LISTE = [];
    function creerCouche(nom, scene) {
      var C = { nom: nom, scene: scene, groupe: new THREE.Group(), uAmbiance: { value: 1 } };
      C.groupe.name = 'boss-fx-' + nom;
      // particules
      var N = Q.particules;
      var gp = new THREE.BufferGeometry();
      var P = { cap: N, n: 0, nPrec: 0, D: new Float32Array(N * PS) };
      P.aPos = dyn(new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      P.aCoul = dyn(new THREE.BufferAttribute(new Float32Array(N * 4), 4));
      P.aPar = dyn(new THREE.BufferAttribute(new Float32Array(N * 4), 4));
      P.aVit = dyn(new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      gp.setAttribute('position', P.aPos); gp.setAttribute('aCouleur', P.aCoul); gp.setAttribute('aParams', P.aPar); gp.setAttribute('aVitesse', P.aVit);
      gp.setDrawRange(0, 0);
      P.mat = materiau(VS_PARTICULES, FS_PARTICULES, { uDemi: U_DEMI, uTailleMax: { value: 360 }, uEtire: { value: 0.045 }, uBruit: U_BRUIT, uTempsV: U_TEMPS, uAmbiance: C.uAmbiance });
      P.objet = new THREE.Points(gp, P.mat); P.objet.frustumCulled = false; P.objet.renderOrder = 40; P.geo = gp;
      C.groupe.add(P.objet);
      C.part = P;
      // rubans
      var R = Q.rubans, K = Q.pointsRuban, NV = R * K * 2;
      var gr = new THREE.BufferGeometry();
      var RB = { cap: R, K: K, liste: [], nPrec: 0, haut: 0 };
      RB.aPos = dyn(new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
      RB.aTan = dyn(new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
      RB.aLarg = dyn(new THREE.BufferAttribute(new Float32Array(NV), 1));
      RB.aCoul = dyn(new THREE.BufferAttribute(new Float32Array(NV * 4), 4));
      RB.aStyle = dyn(new THREE.BufferAttribute(new Float32Array(NV * 2), 2));
      var cote = new Float32Array(NV), uu = new Float32Array(NV), idx = new Uint16Array(R * (K - 1) * 6);
      for (var r = 0; r < R; r++) {
        RB.liste.push(nouveauRuban(K));
        for (var j = 0; j < K; j++) { var v = (r * K + j) * 2; cote[v] = -1; cote[v + 1] = 1; uu[v] = uu[v + 1] = j / (K - 1); }
        for (var s = 0; s < K - 1; s++) {
          var o = (r * (K - 1) + s) * 6, b0 = (r * K + s) * 2;
          idx[o] = b0; idx[o + 1] = b0 + 1; idx[o + 2] = b0 + 2; idx[o + 3] = b0 + 1; idx[o + 4] = b0 + 3; idx[o + 5] = b0 + 2;
        }
      }
      gr.setAttribute('position', RB.aPos); gr.setAttribute('aTangente', RB.aTan); gr.setAttribute('aLargeur', RB.aLarg);
      gr.setAttribute('aCouleur', RB.aCoul); gr.setAttribute('aStyle', RB.aStyle);
      gr.setAttribute('aCote', new THREE.BufferAttribute(cote, 1)); gr.setAttribute('aU', new THREE.BufferAttribute(uu, 1));
      gr.setIndex(new THREE.BufferAttribute(idx, 1));
      gr.setDrawRange(0, 0);
      RB.mat = materiau(VS_RUBANS, FS_RUBANS, { uBruit: U_BRUIT, uTempsV: U_TEMPS, uAmbiance: C.uAmbiance });
      RB.objet = new THREE.Mesh(gr, RB.mat); RB.objet.frustumCulled = false; RB.objet.renderOrder = 38; RB.geo = gr;
      C.groupe.add(RB.objet);
      C.rub = RB;
      // halos (instanciés)
      C.halos = creerInstances(Q.halos, [['aCentre', 3], ['aTaille', 3], ['aCouleur', 4], ['aParams', 4], ['aVitesse', 3]], VS_HALOS, FS_HALOS, 42, false, nouveauHalo, C);
      C.groupe.add(C.halos.objet);
      // sols (instanciés)
      C.sols = creerInstances(Q.sols, [['aCentre', 3], ['aAxes', 4], ['aCouleur', 4], ['aParams', 4], ['aParams2', 4]], VS_SOL, FS_SOL, 30, true, nouveauSol, C);
      C.groupe.add(C.sols.objet);
      // panneaux (instanciés, v1.5) : murs électrifiés, bordure du plafond, ondulations
      C.pans = creerInstances(Q.panneaux, [['aCentre', 3], ['aAxes', 4], ['aCouleur', 4], ['aParams', 4], ['aParams2', 4], ['aParams3', 4]], VS_PANNEAU, FS_PANNEAU, 31, true, nouveauSol, C);
      C.groupe.add(C.pans.objet);
      // volumes
      C.volumes = [];
      var gCyl = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true); gCyl.translate(0, 0.5, 0);
      var gSph = new THREE.SphereGeometry(1, 28, 16);
      C.gCyl = gCyl; C.gSph = gSph;
      for (var ic = 0; ic < Q.cylindres + Q.spheres; ic++) {
        var cyl = ic < Q.cylindres;
        var mv = materiau(VS_VOLUME, FS_VOLUME, { uBruit: U_BRUIT, uTempsV: U_TEMPS, uCoul: { value: new THREE.Vector4(1, 1, 1, 0) }, uP: { value: new THREE.Vector4(0, 0, 0, 0.55) } });
        var me = new THREE.Mesh(cyl ? gCyl : gSph, mv);
        me.visible = false; me.frustumCulled = false; me.renderOrder = 36;
        C.groupe.add(me);
        C.volumes.push(nouveauVolume(me, mv, cyl ? 'cyl' : 'sph'));
      }
      // lumières
      C.lumieres = []; C.cand = new Float32Array(24 * 8); C.nCand = 0;
      for (var il = 0; il < Q.lumieres; il++) {
        var L = new THREE.PointLight(0xffffff, 0, 10, 2);
        L.name = 'boss-fx-lumiere-' + il;
        C.groupe.add(L); C.lumieres.push(L);
      }
      // voile d'écran (matériau partagé entre les scènes)
      C.ecran = new THREE.Mesh(GEO_ECRAN, MAT_ECRAN); C.ecran.frustumCulled = false; C.ecran.renderOrder = 1e7; C.ecran.visible = false;
      if (!options.ecranSepare) C.groupe.add(C.ecran);
      scene.add(C.groupe);
      // brouillard d'origine (restauré quand l'obscurité retombe)
      var f = scene.fog;
      C.brume = { modifie: false, secours: null, type: f ? (f.isFogExp2 ? 2 : 1) : 0, d0: f && f.isFogExp2 ? f.density : 0, n0: f && f.isFog ? f.near : 0, f0: f && f.isFog ? f.far : 0,
        c0: f ? f.color.clone() : new THREE.Color(0, 0, 0) };
      LISTE.push(C);
      return C;
    }
    function creerInstances(cap, attrs, vs, fs, ordre, decalage, fabrique, C) {
      var g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
      var I = { cap: cap, liste: [], n: 0, nPrec: 0, attrs: [], geo: g };
      for (var i = 0; i < attrs.length; i++) {
        var at = dyn(new THREE.InstancedBufferAttribute(new Float32Array(cap * attrs[i][1]), attrs[i][1]));
        g.setAttribute(attrs[i][0], at); I.attrs.push(at); I[attrs[i][0]] = at;
      }
      g.instanceCount = 0;
      for (var k = 0; k < cap; k++) I.liste.push(fabrique());
      I.mat = materiau(vs, fs, { uBruit: U_BRUIT, uCercle: U_CERCLE, uTempsV: U_TEMPS, uAmbiance: C.uAmbiance }, { decalage: decalage });
      I.objet = new THREE.Mesh(g, I.mat); I.objet.frustumCulled = false; I.objet.renderOrder = ordre; I.objet.visible = false;
      return I;
    }
    var GEO_ECRAN = new THREE.PlaneGeometry(1, 1);
    var U_ECRAN = { uBruit: U_BRUIT, uTempsV: U_TEMPS, uAspect: { value: 16 / 9 }, uA: { value: new THREE.Vector4() }, uB: { value: new THREE.Vector4() }, uC: { value: new THREE.Vector4() } };
    var MAT_ECRAN = materiau(VS_ECRAN, FS_ECRAN, U_ECRAN, { sansProfondeur: true, sansBrume: true });
    var couches = {};
    if (scenes.salle) couches.salle = creerCouche('salle', scenes.salle);
    if (scenes.bunker) couches.bunker = scenes.bunker === scenes.salle ? couches.salle : creerCouche('bunker', scenes.bunker);
    function couche(lieu) { return couches[lieu] || couches.salle || couches.bunker; }
    // voile rendu séparément (après l'arme du jeu) : petite scène dédiée
    var sceneEcran = null, cameraEcran = null;
    if (options.ecranSepare) {
      sceneEcran = new THREE.Scene();
      var meEcran = new THREE.Mesh(GEO_ECRAN, MAT_ECRAN); meEcran.frustumCulled = false; sceneEcran.add(meEcran);
      cameraEcran = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    // ─────────────────────────────── état courant ───────────────────────────────
    var HORLOGE = new Float64Array(1), trame = 0, detruit = false;   // HORLOGE[0] (s) : tableau typé, sans boîte par image
    var modele = null, joueurLocal = null, joueursCtx = null, etatCourant = null;
    var lieuBoss = 'salle', lieuEtat = 'salle', bossVisible = false, bossLoco = 'aucune', BOSS = null, ACT = null;
    var solBunker = 0;
    var ecr = { noir: 0, flashBlanc: 0, flashRouge: 0, critique: 0, aspiration: 0, capture: 0, obscur: 0, noirVision: 0, coup: 0, glace: 0, choc: 0 };
    // facteur de lumière et oscillation par lieu (0 = salle, 1 = bunker) dans des tableaux typés : un flottant écrit
    // dans un objet par une clé calculée serait mis en boîte à chaque image
    var FACT = new Float64Array([1, 1]), OSC = new Float64Array(2);
    function iLieu(l) { return l === 'bunker' ? 1 : 0; }
    var _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
    // sorties des petites fonctions (ancre : 0..2, direction aléatoire : 3..5) : un tableau typé, car écrire un
    // flottant dans une variable de fermeture créerait une boîte (allocation) à chaque appel
    var SO = new Float64Array(6);
    // passage de la position (0..2) et de la vitesse (3..5) d'une particule à écrire (mêmes raisons)
    var EP = new Float64Array(7);
    var VIDE = {};
    var posSecousse = { x: 0, y: 0, z: 0 };

    // ─────────────────────────────── ancres (points du boss et repères) ───────────────────────────────
    var A_CENTRE = 0, A_POITRINE = 1, A_TETE = 2, A_BOUCHE = 3, A_MAING = 4, A_MAIND = 5, A_DOS = 6, A_PIEDG = 7, A_PIEDD = 8,
      A_LAMEG = 9, A_LAMED = 10, A_POINTEG = 11, A_POINTED = 12, A_AILEG = 13, A_AILED = 14, A_SOLBOSS = 15, A_CAMERA = 16,
      A_DEVANT = 17, A_JOUEUR = 18, A_RITUEL = 19, A_DYN = 20, NB_DYN = 34, A_FIXE = 54, NA = 64;
    // ancres dynamiques (posées par les suivis) : blocs 0–9, vrilles d'absorption 10–15, siphon 16, mini-boss 17–19,
    // crochets 20–23, v1.5 : poitrine du Survolté 24, de L'Irradié 25, moignon du bras 26, intangible 27 ;
    // vrilles de capture des âmes 30–33 (les 4 dernières)
    var A_BLOCS = A_DYN, A_VRILLES = A_DYN + 10, A_MBS = A_DYN + 17, A_CROCHETS = A_DYN + 20;
    var A_SURV = A_DYN + 24, A_IRR = A_DYN + 25, A_BRAS = A_DYN + 26, A_INTANG = A_DYN + 27;
    var NOMS_ANCRES = [null, 'poitrine', 'tete', 'bouche', 'mainG', 'mainD', 'dos', 'piedG', 'piedD', 'lameG', 'lameD', 'pointeLameG', 'pointeLameD', 'aileG', 'aileD'];
    // repli sans modèle : décalages dans le repère du boss (x = gauche, y, z = avant), pieds à y = 0
    var DECALAGES = [[0, 1.0, 0], [0, 1.33, 0.14], [0, 1.68, 0], [0, 1.6, 0.09], [0.25, 1.45, 0.35], [-0.25, 1.45, 0.35], [0, 1.3, -0.15],
      [0.1, 0.05, 0.05], [-0.1, 0.05, 0.05], [0.3, 1.0, 0.3], [-0.3, 1.0, 0.3], [0.55, 0.75, 0.6], [-0.55, 0.75, 0.6], [1.7, 2.3, -0.5], [-1.7, 2.3, -0.5]];
    var ANC = new Float32Array(NA * 3), ANC_T = new Int32Array(NA);
    for (var ia = 0; ia < NA; ia++) ANC_T[ia] = -1;
    var prochaineFixe = 0;
    function ancreFixe(x, y, z) {
      var i = A_FIXE + prochaineFixe; prochaineFixe = (prochaineFixe + 1) % (NA - A_FIXE);
      ANC[i * 3] = x; ANC[i * 3 + 1] = y; ANC[i * 3 + 2] = z; ANC_T[i] = -2;
      return i;
    }
    function poserAncre(i, x, y, z) { ANC[i * 3] = x; ANC[i * 3 + 1] = y; ANC[i * 3 + 2] = z; ANC_T[i] = trame; }
    /** Lit une ancre dans SO[0..2] (calculée au plus une fois par image). */
    function ancre(i) {
      if (i < A_DYN && ANC_T[i] !== trame) calculerAncre(i);
      var o = i * 3; SO[0] = ANC[o]; SO[1] = ANC[o + 1]; SO[2] = ANC[o + 2];
    }
    function calculerAncre(i) {
      ANC_T[i] = trame;
      var o = i * 3, B = BOSS;
      if (i <= A_AILED) {
        var nom = NOMS_ANCRES[i], pt = nom && modele && modele.points ? modele.points[nom] : null;
        if (pt && pt.getWorldPosition) { pt.getWorldPosition(_v); ANC[o] = _v.x; ANC[o + 1] = _v.y; ANC[o + 2] = _v.z; return; }
        if (!B || !B.position) return;
        var d = DECALAGES[i], la = +B.lacet || 0, c = Math.cos(la), s = Math.sin(la);
        ANC[o] = B.position.x + d[0] * c + d[2] * s; ANC[o + 1] = B.position.y + d[1]; ANC[o + 2] = B.position.z - d[0] * s + d[2] * c;
      } else if (i === A_SOLBOSS) {
        if (!B || !B.position) return;
        ANC[o] = B.position.x; ANC[o + 1] = sol(lieuBoss) + 0.02; ANC[o + 2] = B.position.z;
      } else if (i === A_CAMERA || i === A_DEVANT) {
        if (camera && camera.getWorldPosition) {
          camera.getWorldPosition(_v);
          if (i === A_DEVANT && camera.getWorldDirection) { camera.getWorldDirection(_v2); _v.addScaledVector(_v2, 1.8); }
        } else if (joueurLocal && joueurLocal.position) _v.set(joueurLocal.position.x, joueurLocal.position.y + 1.6, joueurLocal.position.z);
        ANC[o] = _v.x; ANC[o + 1] = _v.y; ANC[o + 2] = _v.z;
      } else if (i === A_JOUEUR) {
        if (joueurLocal && joueurLocal.position) { ANC[o] = joueurLocal.position.x; ANC[o + 1] = joueurLocal.position.y + 1.1; ANC[o + 2] = joueurLocal.position.z; }
      } else if (i === A_RITUEL) { ANC[o] = CERCLE_X; ANC[o + 1] = SOL_SALLE + 0.05; ANC[o + 2] = CERCLE_Z; }
    }
    function sol(lieu) { return lieu === 'bunker' ? solBunker : SOL_SALLE; }
    function lieuDe(p, defaut) {
      if (!p) return defaut || lieuBoss;
      if (monde && typeof monde.lieuDe === 'function') {
        var l = null;
        try { l = monde.lieuDe(p); } catch (e) { l = null; }
        if (l === 'salle' || l === 'bunker') return l;
      }
      var dx = p.x - (+O.x || 0), dz = p.z - (+O.z || 0);
      return Math.abs(dx) <= APO * 1.3 && Math.abs(dz) <= APO * 1.3 && p.y >= SOL_SALLE - 3 && p.y <= SOL_SALLE + HAUT + 8 ? 'salle' : 'bunker';
    }
    function uniteAlea() {
      var z = 2 * (ali() * K_ALEA) - 1, a = (ali() * K_ALEA) * TAU, r = Math.sqrt(1 - z * z);
      SO[3] = r * Math.cos(a); SO[4] = z; SO[5] = r * Math.sin(a);
    }

    // ─────────────────────────────── particules ───────────────────────────────
    /** Écrit la particule o du gabarit g : position EP[0..2], vitesse EP[3..5], échelle EP[6], couleurs facultatives.
     *  (v1.4 : aucun flottant passé ni rendu entre ces petites fonctions : V8 mettrait chacun en boîte quand l'appel
     *  n'est pas compilé en ligne ; le hasard est tiré en ligne, ali() rend un petit entier) */
    function ecrireParticule(P, o, g, c1, c2) {
      var D = P.D, vx = EP[3], vy = EP[4], vz = EP[5], r;
      D[o] = EP[0]; D[o + 1] = EP[1]; D[o + 2] = EP[2]; D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz;
      r = g.vie; D[o + 6] = 0; D[o + 7] = r[0] + (r[1] - r[0]) * (ali() * K_ALEA);
      r = g.taille; var t0 = (r[0] + (r[1] - r[0]) * (ali() * K_ALEA)) * Math.sqrt(EP[6]);
      D[o + 8] = t0; D[o + 9] = t0 * g.fin;
      var a = c1 || g.c1, b = c2 || (c1 ? c1 : g.c2), kb = c1 && !c2 ? 0.55 : 1;
      D[o + 10] = a[0]; D[o + 11] = a[1]; D[o + 12] = a[2]; D[o + 13] = b[0] * kb; D[o + 14] = b[1] * kb; D[o + 15] = b[2] * kb;
      r = g.alpha; D[o + 16] = r[0] + (r[1] - r[0]) * (ali() * K_ALEA); D[o + 17] = g.add; D[o + 18] = g.forme; D[o + 19] = g.grav; D[o + 20] = g.frein; D[o + 21] = g.tourb;
      D[o + 22] = M_PHYS; D[o + 23] = -1; D[o + 24] = 0; D[o + 25] = g.sol; D[o + 26] = 0; D[o + 27] = 0; D[o + 28] = 0;
      D[o + 29] = (ali() * K_ALEA); D[o + 30] = g.fi; D[o + 31] = 0; D[o + 32] = vx; D[o + 33] = vy; D[o + 34] = vz; D[o + 35] = 0;
    }
    // arguments flottants des émissions (v1.4) : EA = x, y, z, dx, dy, dz, échelle, sol (NaN : celui du lieu), disp, tour.
    // Les effets continus écrivent EA puis appellent emettreEA / emettreConvDepuisEA avec un nombre exact de particules.
    var EA = new Float64Array(10);
    /** Gerbe de n particules du gabarit g en (x, y, z), direction (dx, dy, dz) ou sphère si nulle, échelle ech. */
    function emettre(C, g, n, x, y, z, dx, dy, dz, ech, c1, c2, solY) {
      if (!C) return;
      EA[0] = x; EA[1] = y; EA[2] = z; EA[3] = dx; EA[4] = dy; EA[5] = dz; EA[6] = ech || 1; EA[7] = solY != null ? solY : NaN;
      emettreEA(C, g, Math.round(n * Q.densite), c1, c2);
    }
    function emettreEA(C, g, n, c1, c2) {
      if (!C) return;
      var P = C.part, e = EA[6] > 0 ? EA[6] : 1, x = EA[0], y = EA[1], z = EA[2], dx = EA[3], dy = EA[4], dz = EA[5];
      var ld = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (ld > 1e-6) { dx /= ld; dy /= ld; dz /= ld; }
      var sy = EA[7] === EA[7] ? EA[7] : sol(C.nom), dp = g.disp, rv = g.vit;
      for (var i = 0; i < n && P.n < P.cap; i++) {
        var o = P.n * PS; P.n++;
        uniteAlea();
        var rr = g.rayon * e * Math.pow((ali() * K_ALEA), 0.33);
        var px = x + SO[3] * rr, py = y + SO[4] * rr, pz = z + SO[5] * rr;
        uniteAlea();
        var wx = SO[3], wy = SO[4], wz = SO[5];
        if (ld > 1e-6) { wx = dx * (1 - dp) + SO[3] * dp; wy = dy * (1 - dp) + SO[4] * dp; wz = dz * (1 - dp) + SO[5] * dp; var lw = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1; wx /= lw; wy /= lw; wz /= lw; }
        var sp = (rv[0] + (rv[1] - rv[0]) * (ali() * K_ALEA)) * e;
        EP[0] = px; EP[1] = py; EP[2] = pz; EP[3] = wx * sp; EP[4] = wy * sp + g.monte * (0.5 + 0.5 * (ali() * K_ALEA)); EP[5] = wz * sp; EP[6] = e;
        ecrireParticule(P, o, g, c1, c2);
        P.D[o + 24] = sy;
      }
    }
    /** Gerbe sur un anneau horizontal (poussière soufflée par une onde, éclats). */
    function emettreAnneau(C, g, n, x, y, z, rayon, vitRad, ech, c1, c2) {
      if (!C) return;
      var P = C.part, e = ech || 1;
      n = Math.round(n * Q.densite);
      var sy = sol(C.nom);
      for (var i = 0; i < n && P.n < P.cap; i++) {
        var o = P.n * PS; P.n++;
        var a = (ali() * K_ALEA) * TAU, ca = Math.cos(a), sa = Math.sin(a), rr = rayon * (0.85 + 0.25 * (ali() * K_ALEA)), sp = vitRad * (0.6 + 0.6 * (ali() * K_ALEA));
        EP[0] = x + ca * rr; EP[1] = y + 0.25 * (ali() * K_ALEA) * e; EP[2] = z + sa * rr; EP[3] = ca * sp; EP[4] = g.monte * (0.3 + 0.7 * (ali() * K_ALEA)); EP[5] = sa * sp; EP[6] = e;
        ecrireParticule(P, o, g, c1, c2);
        P.D[o + 24] = sy;
      }
    }
    /** Particules qui convergent vers une ancre (départ sur une couronne autour, tourbillon). */
    function emettreConv(C, g, n, ia, rMin, rMax, hMin, hMax, tour, ech, c1, c2) {
      if (!C) return;
      var P = C.part;
      n = Math.round(n * Q.densite);
      ancre(ia);
      var cx = SO[0], cy = SO[1], cz = SO[2];
      for (var i = 0; i < n && P.n < P.cap; i++) {
        var o = P.n * PS; P.n++;
        var a = (ali() * K_ALEA) * TAU, rr = rMin + (rMax - rMin) * (ali() * K_ALEA), ox = Math.cos(a) * rr, oz = Math.sin(a) * rr, oy = hMin + (hMax - hMin) * (ali() * K_ALEA);
        EP[0] = cx + ox; EP[1] = cy + oy; EP[2] = cz + oz; EP[3] = 0; EP[4] = 0; EP[5] = 0; EP[6] = ech || 1;
        ecrireParticule(P, o, g, c1, c2);
        var D = P.D;
        D[o + 22] = M_CONV; D[o + 23] = ia; D[o + 26] = ox; D[o + 27] = oy; D[o + 28] = oz; D[o + 3] = tour * (0.6 + 0.6 * (ali() * K_ALEA)); D[o + 4] = 0; D[o + 5] = 0;
        D[o + 25] = SOL_RIEN;
      }
    }
    /** Particules qui convergent d'un point précis vers une ancre (âmes, vrilles). */
    function emettreConvDepuis(C, g, n, ia, x, y, z, disp, tour, ech, c1, c2) {
      if (!C) return;
      EA[0] = x; EA[1] = y; EA[2] = z; EA[6] = ech || 1; EA[8] = disp; EA[9] = tour;
      emettreConvDepuisEA(C, g, Math.round(n * Q.densite), ia, c1, c2);
    }
    function emettreConvDepuisEA(C, g, n, ia, c1, c2) {
      if (!C) return;
      var P = C.part, x = EA[0], y = EA[1], z = EA[2], e = EA[6] > 0 ? EA[6] : 1, disp = EA[8], tour = EA[9];
      ancre(ia);
      for (var i = 0; i < n && P.n < P.cap; i++) {
        var o = P.n * PS; P.n++;
        uniteAlea();
        var ox = x + SO[3] * disp - SO[0], oy = y + SO[4] * disp - SO[1], oz = z + SO[5] * disp - SO[2];
        EP[0] = SO[0] + ox; EP[1] = SO[1] + oy; EP[2] = SO[2] + oz; EP[3] = 0; EP[4] = 0; EP[5] = 0; EP[6] = e;
        ecrireParticule(P, o, g, c1, c2);
        var D = P.D;
        D[o + 22] = M_CONV; D[o + 23] = ia; D[o + 26] = ox; D[o + 27] = oy; D[o + 28] = oz; D[o + 3] = tour * (2 * (ali() * K_ALEA) - 1); D[o + 4] = 0.3; D[o + 5] = 0;
        D[o + 25] = SOL_RIEN;
      }
    }
    /** Particules en orbite autour d'une ancre (étourdissement, âmes, aura télékinétique, brume des lames). */
    function emettreOrbite(C, g, n, ia, rayon, hMin, hMax, vitAng, montee, bob, ech, c1, c2) {
      if (!C) return;
      var P = C.part;
      n = Math.round(n * Q.densite);
      for (var i = 0; i < n && P.n < P.cap; i++) {
        var o = P.n * PS; P.n++;
        EP[0] = 0; EP[1] = 0; EP[2] = 0; EP[3] = 0; EP[4] = 0; EP[5] = 0; EP[6] = ech || 1;
        ecrireParticule(P, o, g, c1, c2);
        var D = P.D;
        D[o + 22] = M_ORBITE; D[o + 23] = ia; D[o + 26] = rayon * (0.75 + 0.45 * (ali() * K_ALEA)); D[o + 27] = (ali() * K_ALEA) * TAU; D[o + 28] = vitAng * (0.7 + 0.6 * (ali() * K_ALEA));
        D[o + 3] = hMin + (hMax - hMin) * (ali() * K_ALEA); D[o + 4] = bob; D[o + 5] = montee; D[o + 25] = SOL_RIEN;
        ancre(ia);
        D[o] = SO[0] + Math.sin(D[o + 27]) * D[o + 26]; D[o + 1] = SO[1] + D[o + 3]; D[o + 2] = SO[2] + Math.cos(D[o + 27]) * D[o + 26];
      }
    }
    function majParticules(C, dt) {
      var P = C.part, D = P.D, n = P.n, idt = dt > 1e-6 ? 1 / dt : 0, t = HORLOGE[0];
      for (var i = n - 1; i >= 0; i--) {
        var o = i * PS;
        var age = D[o + 6] + dt;
        if (age >= D[o + 7]) { n--; if (i !== n) D.copyWithin(o, n * PS, n * PS + PS); continue; }
        D[o + 6] = age;
        var mode = D[o + 22];
        if (mode === M_PHYS) {
          var vx = D[o + 3], vy = D[o + 4] - D[o + 19] * dt, vz = D[o + 5], tb = D[o + 21];
          if (tb > 0) {
            var gr = D[o + 29] * 50;
            vx += Math.sin(t * 1.9 + gr + D[o + 1] * 1.3) * tb * dt; vz += Math.cos(t * 1.7 + gr * 1.3 + D[o] * 1.1) * tb * dt;
            vy += Math.sin(t * 2.3 + gr * 0.7) * tb * 0.4 * dt;
          }
          var fr = 1 / (1 + D[o + 20] * dt);
          vx *= fr; vy *= fr; vz *= fr;
          var px = D[o] + vx * dt, py = D[o + 1] + vy * dt, pz = D[o + 2] + vz * dt;
          var sa = D[o + 25];
          if (sa !== SOL_RIEN && py < D[o + 24]) {
            if (sa === SOL_REBOND) { py = D[o + 24]; vy = -vy * 0.3; vx *= 0.55; vz *= 0.55; }
            else if (sa === SOL_POSE) { py = D[o + 24] + D[o + 8] * 0.3; vy = 0; vx *= 0.2; vz *= 0.2; D[o + 19] = 0; D[o + 20] = 8; D[o + 25] = SOL_RIEN; }
            else {
              if (sa === SOL_SANG) tacheSang(C, px, D[o + 24], pz, D[o + 8]);
              n--; if (i !== n) D.copyWithin(o, n * PS, n * PS + PS); continue;
            }
          }
          D[o] = px; D[o + 1] = py; D[o + 2] = pz; D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz;
          D[o + 32] = vx; D[o + 33] = vy; D[o + 34] = vz;
        } else {
          ancre(D[o + 23]);
          var nx, ny, nz;
          if (mode === M_CONV) {
            var u = age / D[o + 7], e = u * u, th = D[o + 3] * e, c = Math.cos(th), s = Math.sin(th), k = 1 - e;
            var ox = D[o + 26], oz = D[o + 28];
            nx = SO[0] + (ox * c - oz * s) * k; ny = SO[1] + D[o + 27] * k + D[o + 4] * Math.sin(PI * u); nz = SO[2] + (ox * s + oz * c) * k;
          } else {
            var ang = D[o + 27] + D[o + 28] * age, rr = D[o + 26];
            nx = SO[0] + Math.sin(ang) * rr; nz = SO[2] + Math.cos(ang) * rr;
            ny = SO[1] + D[o + 3] + D[o + 5] * age + D[o + 4] * Math.sin(age * 3 + D[o + 29] * 20);
          }
          D[o + 32] = (nx - D[o]) * idt; D[o + 33] = (ny - D[o + 1]) * idt; D[o + 34] = (nz - D[o + 2]) * idt;
          D[o] = nx; D[o + 1] = ny; D[o + 2] = nz;
        }
      }
      P.n = n;
      var aP = P.aPos.array, aC = P.aCoul.array, aR = P.aPar.array, aV = P.aVit.array;
      for (var j = 0; j < n; j++) {
        var q = j * PS, uu = D[q + 6] / D[q + 7], fi = D[q + 30];
        var al2 = D[q + 16] * (fi > 0 ? Math.min(1, uu / fi) : 1) * (1 - lisse(0.6, 1, uu));
        var j3 = j * 3, j4 = j * 4;
        aP[j3] = D[q]; aP[j3 + 1] = D[q + 1]; aP[j3 + 2] = D[q + 2];
        aV[j3] = D[q + 32]; aV[j3 + 1] = D[q + 33]; aV[j3 + 2] = D[q + 34];
        aC[j4] = D[q + 10] + (D[q + 13] - D[q + 10]) * uu; aC[j4 + 1] = D[q + 11] + (D[q + 14] - D[q + 11]) * uu; aC[j4 + 2] = D[q + 12] + (D[q + 15] - D[q + 12]) * uu; aC[j4 + 3] = al2;
        aR[j4] = D[q + 8] + (D[q + 9] - D[q + 8]) * uu; aR[j4 + 1] = D[q + 17]; aR[j4 + 2] = D[q + 18]; aR[j4 + 3] = D[q + 29];
      }
      if (n > 0 || P.nPrec > 0) {
        P.aPos.needsUpdate = true; P.aCoul.needsUpdate = true; P.aPar.needsUpdate = true; P.aVit.needsUpdate = true;
        P.geo.setDrawRange(0, n);
      }
      P.objet.visible = n > 0;
      P.nPrec = n;
    }

    // ─────────────────────────────── halos, sols, volumes : réserve ───────────────────────────────
    function prendre(I) {
      var L = I.liste;
      for (var i = 0; i < L.length; i++) if (!L[i].actif) { var o = L[i]; o.actif = true; o.age = 0; o.vie = 0; o.fondu = 0; o.finFondu = 0; return o; }
      return null;
    }
    /** Halo animé seul : motif, position, tailles s0 → s1 (m), couleur × intensité, durée, courbe. */
    function halo(C, motif, x, y, z, s0, s1, coul, inten, vie, courbe, tirer) {
      if (!C) return null;
      var h = prendre(C.halos);
      if (!h) return null;
      h.motif = motif; h.x = x; h.y = y; h.z = z; h.s0 = s0; h.s1 = s1; h.sx = h.sy = s0; h.tirer = tirer || 0;
      h.r = coul[0]; h.g = coul[1]; h.b = coul[2]; h.a = 0; h.i0 = inten; h.i = inten; h.vie = vie; h.courbe = courbe; h.rot = (ali() * K_ALEA) * TAU;
      h.graine = (ali() * K_ALEA); h.k = 0; h.vx = h.vy = h.vz = 0; h.mx = h.my = h.mz = 0; h.ancre = -1;
      return h;
    }
    function solAuto(C, motif, x, z, rayon, coul, inten, vie, courbe) {
      if (!C) return null;
      var s = prendre(C.sols);
      if (!s) return null;
      s.motif = motif; s.x = x; s.y = sol(C.nom) + 0.018; s.z = z; s.hx = s.hz = rayon; s.ang = (ali() * K_ALEA) * TAU;
      s.r = coul[0]; s.g = coul[1]; s.b = coul[2]; s.a = inten; s.i0 = inten; s.vie = vie; s.courbe = courbe || 0;
      s.p0 = 0; s.p1 = 0; s.p2 = (ali() * K_ALEA) * 10; s.p3 = (ali() * K_ALEA); s.q0 = 0; s.q1 = 0; s.q2 = 0; s.q3 = 0; s.v0 = 0;
      return s;
    }
    function onde(C, x, z, rayon, epaisseur, coul, inten, vie, poussiere) {
      var s = solAuto(C, S_ONDE, x, z, rayon, coul, inten, vie, 0);
      if (s) { s.p1 = epaisseur; s.p2 = 0.04; s.p0 = 0.04; s.v0 = poussiere || 0; s.p3 = (ali() * K_ALEA) * 10; }
      return s;
    }
    function volume(C, type, motif, x, y, z, sx, sy, sz, coul, inten, vie, courbe) {
      if (!C) return null;
      for (var i = 0; i < C.volumes.length; i++) {
        var v = C.volumes[i];
        if (v.actif || v.geo !== type) continue;
        v.actif = true; v.age = 0; v.vie = vie; v.fondu = 0; v.finFondu = 0; v.motif = motif; v.x = x; v.y = y; v.z = z;
        v.sx = sx; v.sy = sy; v.sz = sz; v.s0 = 1; v.s1 = 1; v.r = coul[0]; v.g = coul[1]; v.b = coul[2]; v.a = 0.7; v.i0 = inten; v.k = inten;
        v.courbe = courbe || 0; v.ancre = -1; v.haut = 0.55; v.mesh.visible = true; v.mesh.rotation.set(0, 0, 0);
        if (motif === V_COQUILLE) v.s0 = 0.3;
        return v;
      }
      return null;
    }
    // lâché : s'éteint sur place (ne suit plus son ancre : pas de saut quand le boss se téléporte)
    function lacher(o, duree) { if (o && o.actif) { o.vie = 0; o.fondu = duree; o.finFondu = o.age + duree; o.ancre = -1; if (duree <= 0) o.actif = false; } }
    // NB : le facteur de fondu de sortie (fondu, finFondu → 0..1) est écrit en ligne dans les boucles chaudes : un flottant
    // rendu par un appel non compilé en ligne serait mis en boîte.

    function majHalos(C, dt) {
      var I = C.halos, L = I.liste, n = 0;
      var aC = I.aCentre.array, aT = I.aTaille.array, aK = I.aCouleur.array, aP = I.aParams.array, aV = I.aVitesse.array;
      for (var i = 0; i < L.length; i++) {
        var h = L[i];
        if (!h.actif) continue;
        h.age += dt;
        if (h.vie > 0) {
          var k = h.age / h.vie;
          if (k >= 1) { h.actif = false; continue; }
          if (h.courbe === C_FLASH) { h.i = h.i0 * (1 - k) * (1 - k); h.sx = h.sy = mix(h.s0, h.s1, sortie(k)); }
          else if (h.courbe === C_PULSE) { h.i = h.i0 * Math.sin(PI * k); h.sx = h.sy = mix(h.s0, h.s1, k); }
          else if (h.courbe === C_ANNEAU) { h.k = sortie(k); h.i = h.i0 * Math.pow(1 - k, 1.5); h.sx = h.sy = h.s1; }
          else { h.i = h.i0 * (1 - lisse(0.7, 1, k)); }
        }
        if (h.fondu > 0 && h.age >= h.finFondu) { h.actif = false; continue; }
        if (h.ancre >= 0) { ancre(h.ancre); h.x = SO[0] + h.ox; h.y = SO[1] + h.oy; h.z = SO[2] + h.oz; }
        else if (h.vie > 0) { h.x += h.mx * dt; h.y += h.my * dt; h.z += h.mz * dt; }
        var f = h.fondu > 0 ? (h.finFondu - h.age) / h.fondu : 1;
        f = (f < 0 ? 0 : f > 1 ? 1 : f) * h.i;
        var o3 = n * 3, o4 = n * 4;
        aC[o3] = h.x; aC[o3 + 1] = h.y; aC[o3 + 2] = h.z;
        aT[o3] = h.sx; aT[o3 + 1] = h.sy; aT[o3 + 2] = h.tirer;
        aK[o4] = h.r * f; aK[o4 + 1] = h.g * f; aK[o4 + 2] = h.b * f; aK[o4 + 3] = h.motif >= H_FUMEE ? f : 0;   // fumée, miroitement
        aP[o4] = h.motif; aP[o4 + 1] = h.rot; aP[o4 + 2] = h.graine; aP[o4 + 3] = h.k;
        aV[o3] = h.vx; aV[o3 + 1] = h.vy; aV[o3 + 2] = h.vz;
        n++;
      }
      finInstances(I, n);
    }
    function finInstances(I, n) {
      I.geo.instanceCount = n;
      if (n > 0 || I.nPrec > 0) for (var a = 0; a < I.attrs.length; a++) I.attrs[a].needsUpdate = true;
      I.objet.visible = n > 0;
      I.nPrec = n;
    }
    function majSols(C, dt) {
      var I = C.sols, L = I.liste, n = 0;
      for (var i = 0; i < L.length; i++) {
        var s = L[i];
        if (!s.actif) continue;
        s.age += dt;
        if (s.vie > 0) {
          var k = s.age / s.vie;
          if (k >= 1) { s.actif = false; continue; }
          var m = s.motif;
          if (m === S_ONDE) { s.p0 = mix(s.p2, 1, sortie(k)); s.a = s.i0 * Math.pow(1 - k, 1.3); s.p2 = s.p2; s.q0 = s.v0; }
          else if (m === S_BRULURE) { s.a = s.i0 * Math.min(1, k * 25) * (1 - lisse(0.6, 1, k)); s.p0 = s.q0 * (1 - k) * (1 - k); }
          else if (m === S_FISSURES) { s.p0 = lisse(0, 0.08, k); s.p1 = s.q0 * Math.pow(1 - k, 2); s.a = s.i0 * (1 - lisse(0.75, 1, k)); }
          else if (m === S_TACHE) { s.p0 = lisse(0, 0.03, k); s.a = s.i0 * (1 - lisse(0.8, 1, k)); }
          else if (m === S_LUEUR) { s.a = s.courbe === C_PULSE ? s.i0 * Math.sin(PI * k) : s.i0 * (1 - k) * (1 - k); }
          else if (m === S_SCEAU) {
            // cercle rituel de téléportation (v1.1) : se dessine en DESSIN_TP s, tient TENUE_TP s, s'efface ensuite
            var ag = s.age;
            s.p0 = lisse(0, DESSIN_TP, ag);
            s.p1 = (0.6 + 0.8 * lisse(0, DESSIN_TP, ag)) * (1 - lisse(DESSIN_TP + TENUE_TP, s.vie, ag));
            s.p2 = Math.max(0, 0.7 - ag * 2.2);
          }
          else if (m === S_FAILLE) {
            // faille des chiens (v1.2) : le sceau se trace, se fissure et s'ouvre pendant v0 s, éclat au jaillissement, puis s'éteint
            var Df = s.v0 > 0 ? s.v0 : T_FAILLE_CHIEN, af = s.age;
            s.p0 = lisse(0, Df * 0.55, af); s.p3 = lisse(Df * 0.25, Df, af); s.q0 = lisse(Df * 0.45, Df, af);
            s.q1 = af >= Df ? Math.exp(-(af - Df) * 7) : 0;
            s.p1 = s.i0 * lisse(0, 0.08, af) * (1 - lisse(Df + 0.1, s.vie, af));
          }
        }
        if (s.fondu > 0 && s.age >= s.finFondu) { s.actif = false; continue; }
      }
      // écriture : d'abord ce qui assombrit, puis les lueurs
      for (var passe = 0; passe < 2; passe++) {
        for (var j = 0; j < L.length; j++) {
          var t = L[j];
          if (!t.actif || (S_SOMBRES[t.motif] ? 1 : 0) !== 1 - passe) continue;
          ecrireSol(I, n, t);
          n++;
        }
      }
      finInstances(I, n);
    }
    function ecrireSol(I, n, s) {
      var f = s.fondu > 0 ? (s.finFondu - s.age) / s.fondu : 1, o3 = n * 3, o4 = n * 4;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      var aC = I.aCentre.array, aX = I.aAxes.array, aK = I.aCouleur.array, aP = I.aParams.array, aQ = I.aParams2.array;
      aC[o3] = s.x; aC[o3 + 1] = s.y; aC[o3 + 2] = s.z;
      aX[o4] = s.hx; aX[o4 + 1] = s.hz; aX[o4 + 2] = s.ang; aX[o4 + 3] = s.motif;
      aK[o4] = s.r; aK[o4 + 1] = s.g; aK[o4 + 2] = s.b; aK[o4 + 3] = s.a * f;
      aP[o4] = s.p0; aP[o4 + 1] = s.p1; aP[o4 + 2] = s.p2; aP[o4 + 3] = s.p3;
      aQ[o4] = s.q0; aQ[o4 + 1] = s.q1; aQ[o4 + 2] = s.q2; aQ[o4 + 3] = s.q3;
      if (s.motif === S_ONDE) { aP[o4 + 2] = s.q0; aP[o4 + 3] = s.p3; }
      if (s.motif === S_CIBLE || s.motif === S_COULOIR || s.motif === S_SECTEUR) aP[o4] = s.p0 * f;
      else if (s.motif === S_INTERACTION || s.motif === S_SCEAU || s.motif === S_FAILLE) aP[o4 + 1] = s.p1 * f;
      if (s.motif === S_CERCLE) aQ[o4] = s.q0 * f;
    }
    // v1.5 : panneaux (décalques verticaux) ; hx, hz = demi-largeur, demi-hauteur ; p = paramètres, q = paramètres 2, w = 3
    function majPanneaux(C, dt) {
      var I = C.pans, L = I.liste, n = 0;
      var aC = I.aCentre.array, aX = I.aAxes.array, aK = I.aCouleur.array, aP = I.aParams.array, aQ = I.aParams2.array, aR = I.aParams3.array;
      for (var i = 0; i < L.length; i++) {
        var s = L[i];
        if (!s.actif) continue;
        s.age += dt;
        if (s.vie > 0) {
          var k = s.age / s.vie;
          if (k >= 1) { s.actif = false; continue; }
          if (s.motif === PN_ONDULATION) s.p0 = k;
        }
        if (s.fondu > 0 && s.age >= s.finFondu) { s.actif = false; continue; }
        var f = s.fondu > 0 ? (s.finFondu - s.age) / s.fondu : 1;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        var o3 = n * 3, o4 = n * 4;
        aC[o3] = s.x; aC[o3 + 1] = s.y; aC[o3 + 2] = s.z;
        aX[o4] = s.hx; aX[o4 + 1] = s.hz; aX[o4 + 2] = s.ang; aX[o4 + 3] = s.motif;
        aK[o4] = s.r; aK[o4 + 1] = s.g; aK[o4 + 2] = s.b; aK[o4 + 3] = s.a * f;
        aP[o4] = s.p0; aP[o4 + 1] = s.p1; aP[o4 + 2] = s.p2; aP[o4 + 3] = s.p3;
        aQ[o4] = s.q0; aQ[o4 + 1] = s.q1; aQ[o4 + 2] = s.q2; aQ[o4 + 3] = s.q3;
        aR[o4] = s.w0; aR[o4 + 1] = s.w1; aR[o4 + 2] = s.w2; aR[o4 + 3] = s.w3;
        n++;
      }
      finInstances(I, n);
    }
    function majVolumes(C, dt) {
      for (var i = 0; i < C.volumes.length; i++) {
        var v = C.volumes[i];
        if (!v.actif) continue;
        v.age += dt;
        if (v.vie > 0) {
          var k = v.age / v.vie;
          if (k >= 1) { v.actif = false; v.mesh.visible = false; continue; }
          if (v.courbe === C_FLASH) { v.k = v.i0 * Math.pow(1 - k, 1.5); var e = mix(v.s0, v.s1, sortie(k)); v.mesh.scale.set(v.sx * e, v.sy * e, v.sz * e); }
          else if (v.courbe === C_PULSE) { v.k = v.i0 * Math.min(1, k * 6) * (1 - lisse(0.55, 1, k)); v.mesh.scale.set(v.sx, v.sy, v.sz); }
          else { v.mesh.scale.set(v.sx, v.sy, v.sz); }
        } else v.mesh.scale.set(v.sx, v.sy, v.sz);
        if (v.fondu > 0 && v.age >= v.finFondu) { v.actif = false; v.mesh.visible = false; continue; }
        if (v.ancre >= 0) { ancre(v.ancre); v.x = SO[0]; v.y = SO[1]; v.z = SO[2]; }
        if (v.motif === V_FISSURES) v.haut = Math.min(1, v.age / 0.45);   // les fissures courent sur le verre
        v.mesh.position.set(v.x, v.y, v.z);
        var f = v.fondu > 0 ? (v.finFondu - v.age) / v.fondu : 1;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        v.mat.uniforms.uCoul.value.set(v.r, v.g, v.b, v.a);
        v.mat.uniforms.uP.value.set(v.motif, v.k * f, v.age * 0.1, v.haut);
        v.mesh.visible = v.k * f > 0.001;
      }
    }

    // ─────────────────────────────── rubans ───────────────────────────────
    function ruban(C, type, style, larg, c1, c2, inten, vie) {
      if (!C) return null;
      var L = C.rub.liste;
      for (var i = 0; i < L.length; i++) {
        var r = L[i];
        if (r.actif) continue;
        r.actif = true; r.type = type; r.style = style; r.larg = larg; r.age = 0; r.vie = vie || 0; r.fondu = 0; r.finFondu = 0;
        r.r = c1[0] * inten; r.g = c1[1] * inten; r.b = c1[2] * inten;
        var d = c2 || c1; r.r2 = d[0] * inten; r.g2 = d[1] * inten; r.b2 = d[2] * inten;
        r.alpha = 1; r.A = -1; r.B = -1; r.amp = 0; r.freq = 1; r.vit = 1; r.graine = (ali() * K_ALEA) * 10; r.croissance = 1; r.arche = 0;
        r.tRegen = 0; r.flick = 1; r.np = 0; r.nh = 0; r.ih = 0; r.pousse = false; r.retrait = 0; r.p0 = 0; r.p1 = 0;
        return r;
      }
      return null;
    }
    function eclair(C, ax, ay, az, bx, by, bz, larg, coul, inten, vie, amp) {
      var r = ruban(C, RT_ECLAIR, R_ECLAIR, larg, coul, coul, inten, vie);
      if (!r) return null;
      r.ax = ax; r.ay = ay; r.az = az; r.bx = bx; r.by = by; r.bz = bz; r.amp = amp || 0.12; r.regen = entre(0.035, 0.06);
      return r;
    }
    function pousserTrainee(r, x, y, z) {
      if (!r) return;
      var K = r.pts.length / 3, H = r.hist;
      if (r.nh > 0) {
        var o = r.ih * 3, dx = x - H[o], dy = y - H[o + 1], dz = z - H[o + 2];
        if (dx * dx + dy * dy + dz * dz < 0.0036 && r.nh > 1) { H[o] = x; H[o + 1] = y; H[o + 2] = z; r.pousse = true; return; }
      }
      r.ih = (r.ih + 1) % K;
      H[r.ih * 3] = x; H[r.ih * 3 + 1] = y; H[r.ih * 3 + 2] = z;
      r.nh = Math.min(K, r.nh + 1);
      r.pousse = true;
    }
    function extremite(r, A, x, y, z) { if (A >= 0) { ancre(A); } else { SO[0] = x; SO[1] = y; SO[2] = z; } }
    function calculerRuban(r, dt) {
      var K = r.pts.length / 3, P = r.pts;
      if (r.type === RT_TRAINEE) {
        if (!r.pousse) { r.retrait += dt * K / 0.3; while (r.retrait >= 1 && r.nh > 0) { r.retrait -= 1; r.nh--; } }
        else r.retrait = 0;
        r.pousse = false;
        var H = r.hist;
        for (var j = 0; j < r.nh; j++) { var hi = ((r.ih - j + K) % K) * 3; P[j * 3] = H[hi]; P[j * 3 + 1] = H[hi + 1]; P[j * 3 + 2] = H[hi + 2]; }
        r.np = r.nh;
        return;
      }
      if (r.type === RT_ARC) {
        var k = r.vie > 0 ? clamp(r.age / r.vie, 0, 1) : 1;
        var tete = r.p0 + r.p1 * sortie(Math.min(1, k / 0.45)), queue = r.p0 + r.p1 * lisse(0.15, 1, k);
        for (var a = 0; a < K; a++) {
          var u = a / (K - 1), an = mix(queue, tete, u), c = Math.cos(an) * r.amp, s = Math.sin(an) * r.amp;
          P[a * 3] = r.ax + r.e1x * c + r.e2x * s; P[a * 3 + 1] = r.ay + r.e1y * c + r.e2y * s; P[a * 3 + 2] = r.az + r.e1z * c + r.e2z * s;
        }
        r.np = K;
        return;
      }
      if (r.type === RT_CROCHET) {
        extremite(r, r.B, r.bx, r.by, r.bz);
        var cx0 = SO[0], cy0 = SO[1], cz0 = SO[2], nT = Math.max(3, Math.round(K * 0.3)), lg = r.amp > 0 ? r.amp : 0.3, rc = lg * 0.38;
        for (var c = 0; c < K; c++) {
          var px, py, pz;
          if (c < nT) {                                     // tige : de la pointe vers l'arrière
            var uT = 1 - c / (nT - 1);
            px = cx0 - r.e1x * lg * uT; py = cy0 - r.e1y * lg * uT; pz = cz0 - r.e1z * lg * uT;
          } else {                                          // courbe : vers l'avant puis vers le bas et l'arrière
            var th = (c - nT + 1) / (K - nT) * PI * 1.25, sth = Math.sin(th), cth = Math.cos(th);
            px = cx0 - r.e2x * rc + (r.e1x * sth + r.e2x * cth) * rc;
            py = cy0 - r.e2y * rc + (r.e1y * sth + r.e2y * cth) * rc;
            pz = cz0 - r.e2z * rc + (r.e1z * sth + r.e2z * cth) * rc;
          }
          P[c * 3] = px; P[c * 3 + 1] = py; P[c * 3 + 2] = pz;
        }
        r.np = K;
        return;
      }
      if (r.type === RT_SPIRALE) {
        extremite(r, r.A, r.ax, r.ay, r.az);
        for (var b = 0; b < K; b++) {
          var u2 = b / (K - 1), an2 = u2 * r.freq * TAU + r.age * r.vit + r.graine, rad = r.amp * (1 - 0.4 * u2);
          P[b * 3] = SO[0] + Math.cos(an2) * rad; P[b * 3 + 1] = SO[1] + mix(r.p0, r.p1, u2); P[b * 3 + 2] = SO[2] + Math.sin(an2) * rad;
        }
        r.np = K;
        return;
      }
      // vrille ou éclair : de A vers B
      extremite(r, r.A, r.ax, r.ay, r.az);
      var x0 = SO[0], y0 = SO[1], z0 = SO[2];
      extremite(r, r.B, r.bx, r.by, r.bz);
      var dx = SO[0] - x0, dy = SO[1] - y0, dz = SO[2] - z0, L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-4) { r.np = 0; return; }
      var tx = dx / L, ty = dy / L, tz = dz / L;
      // base perpendiculaire : n1 = t × haut, n2 = n1 × t
      var n1x = ty * 0 - tz * 1, n1y = tz * 0 - tx * 0, n1z = tx * 1 - ty * 0, l1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z);
      if (l1 < 1e-3) { n1x = 1; n1y = 0; n1z = 0; l1 = 1; }
      n1x /= l1; n1y /= l1; n1z /= l1;
      var n2x = n1y * tz - n1z * ty, n2y = n1z * tx - n1x * tz, n2z = n1x * ty - n1y * tx;
      if (r.type === RT_ECLAIR) {
        r.tRegen -= dt;
        if (r.tRegen <= 0) {
          r.tRegen = r.regen; r.flick = 0.55 + 0.45 * (ali() * K_ALEA);
          var O2 = r.off, v1 = 0, v2 = 0;
          for (var q = 0; q < K; q++) { v1 += entre(-1, 1); v2 += entre(-1, 1); O2[q * 2] = v1; O2[q * 2 + 1] = v2; }
          var e1 = O2[(K - 1) * 2], e2 = O2[(K - 1) * 2 + 1];
          for (var w = 0; w < K; w++) { var f = w / (K - 1); O2[w * 2] = (O2[w * 2] - e1 * f) * 0.35; O2[w * 2 + 1] = (O2[w * 2 + 1] - e2 * f) * 0.35; }
        }
        for (var m = 0; m < K; m++) {
          var u3 = m / (K - 1), env = Math.pow(Math.sin(PI * u3), 0.6) * r.amp * L;
          var o1 = r.off[m * 2] * env, o2 = r.off[m * 2 + 1] * env;
          P[m * 3] = x0 + dx * u3 + n1x * o1 + n2x * o2; P[m * 3 + 1] = y0 + dy * u3 + n1y * o1 + n2y * o2; P[m * 3 + 2] = z0 + dz * u3 + n1z * o1 + n2z * o2;
        }
        r.np = K;
        return;
      }
      for (var j2 = 0; j2 < K; j2++) {
        var u4 = j2 / (K - 1), sv = u4 * r.croissance, env2 = Math.sin(PI * sv);
        var ph = sv * r.freq * TAU - r.age * r.vit + r.graine;
        var a1 = r.amp * env2 * Math.sin(ph), a2 = r.amp * 0.6 * env2 * Math.cos(ph * 1.3 + r.graine);
        var arc = r.arche * Math.sin(PI * sv);
        P[j2 * 3] = x0 + dx * sv + n1x * a1 + n2x * a2; P[j2 * 3 + 1] = y0 + dy * sv + n1y * a1 + n2y * a2 + arc; P[j2 * 3 + 2] = z0 + dz * sv + n1z * a1 + n2z * a2;
      }
      r.np = K;
    }
    function majRubans(C, dt) {
      var RB = C.rub, L = RB.liste, K = RB.K, haut = 0, modif = false;
      var aP = RB.aPos.array, aT = RB.aTan.array, aW = RB.aLarg.array, aK = RB.aCoul.array, aS = RB.aStyle.array;
      for (var i = 0; i < L.length; i++) {
        var r = L[i];
        if (!r.actif) {
          if (r.sale) { for (var z = 0; z < K * 2; z++) { aW[(i * K * 2) + z] = 0; aK[((i * K * 2) + z) * 4 + 3] = 0; } r.sale = false; modif = true; }
          continue;
        }
        r.age += dt;
        if ((r.vie > 0 && r.age >= r.vie) || (r.fondu > 0 && r.age >= r.finFondu)) { r.actif = false; r.sale = true; i--; continue; }
        calculerRuban(r, dt);
        if (r.type === RT_TRAINEE && r.nh <= 1 && !r.pousse && r.fondu > 0) { r.actif = false; r.sale = true; i--; continue; }
        var np = r.np, f = r.fondu > 0 ? (r.finFondu - r.age) / r.fondu : 1, kv = r.vie > 0 ? r.age / r.vie : 0;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        var glob = r.alpha * f;
        if (r.type === RT_ECLAIR) glob *= r.flick;
        else if (r.type !== RT_ARC && r.vie > 0) glob *= 1 - lisse(0.7, 1, kv);
        for (var j = 0; j < K; j++) {
          var jj = j < np ? j : np - 1;
          var vb = (i * K + j) * 2;
          if (np < 2) { aW[vb] = aW[vb + 1] = 0; aK[vb * 4 + 3] = aK[(vb + 1) * 4 + 3] = 0; continue; }
          var P = r.pts, o = jj * 3;
          var a = jj > 0 ? jj - 1 : jj, b = jj < np - 1 ? jj + 1 : jj;
          var tx = P[b * 3] - P[a * 3], ty = P[b * 3 + 1] - P[a * 3 + 1], tz = P[b * 3 + 2] - P[a * 3 + 2];
          var u = np > 1 ? jj / (np - 1) : 0, wp = 1, ap = 1;
          if (r.type === RT_TRAINEE) { wp = Math.pow(1 - u, 0.7); ap = Math.pow(1 - u, 1.4); }
          else if (r.type === RT_VRILLE) { wp = 1 - 0.55 * u; ap = Math.min(1, (1 - u) * 6 + 0.25); }
          else if (r.type === RT_ARC) { var su = Math.sin(PI * u); wp = Math.pow(su, 0.7); ap = su * Math.pow(1 - kv, 1.2); }
          else if (r.type === RT_SPIRALE) { wp = Math.pow(Math.sin(PI * u), 0.5); ap = Math.sin(PI * u); }
          else if (r.type === RT_RAYON) { wp = 0.35 + 0.65 * Math.pow(Math.sin(PI * u), 0.25); ap = 0.72 + 0.28 * Math.sin(u * 19 - r.age * 26); }   // v1.5 : rayon, pulsations vers B
          if (r.style === R_CHAINE) { wp = 1; ap = r.type === RT_SPIRALE ? Math.pow(Math.sin(PI * u), 0.3) : 1; }   // maillons de taille constante
          if (j >= np) wp = 0;
          var w = r.larg * wp, al3 = glob * ap;
          var cr = r.r + (r.r2 - r.r) * u, cg = r.g + (r.g2 - r.g) * u, cb = r.b + (r.b2 - r.b) * u;
          for (var sd = 0; sd < 2; sd++) {
            var v = vb + sd;
            aP[v * 3] = P[o]; aP[v * 3 + 1] = P[o + 1]; aP[v * 3 + 2] = P[o + 2];
            aT[v * 3] = tx; aT[v * 3 + 1] = ty; aT[v * 3 + 2] = tz;
            aW[v] = w;
            aK[v * 4] = cr; aK[v * 4 + 1] = cg; aK[v * 4 + 2] = cb; aK[v * 4 + 3] = al3;
            aS[v * 2] = r.style; aS[v * 2 + 1] = r.style === R_CHAINE ? r.maillons : r.graine;
          }
        }
        r.sale = true; modif = true; haut = i + 1;
      }
      if (modif || RB.nPrec > 0) {
        RB.aPos.needsUpdate = true; RB.aTan.needsUpdate = true; RB.aLarg.needsUpdate = true; RB.aCoul.needsUpdate = true; RB.aStyle.needsUpdate = true;
      }
      RB.geo.setDrawRange(0, haut * (K - 1) * 6);
      RB.objet.visible = haut > 0;
      RB.nPrec = haut;
    }

    // ─────────────────────────────── lumières ───────────────────────────────
    var LUM_TEMP = [];
    for (var lt = 0; lt < 16; lt++) LUM_TEMP.push({ actif: false, C: null, x: 0, y: 0, z: 0, r: 1, g: 1, b: 1, i0: 0, portee: 8, age: 0, vie: 0.3 });
    function eclairLumiere(C, x, y, z, coul, intensite, portee, vie) {
      if (!C) return;
      for (var i = 0; i < LUM_TEMP.length; i++) {
        var L = LUM_TEMP[i];
        if (L.actif) continue;
        L.actif = true; L.C = C; L.x = x; L.y = y; L.z = z; L.r = coul[0]; L.g = coul[1]; L.b = coul[2]; L.i0 = intensite; L.portee = portee; L.age = 0; L.vie = vie;
        return;
      }
    }
    // v1.4 : les demandes de lumière passent leurs flottants par un tableau typé (LC = x, y, z, r, v, b, intensité, portée) :
    // sept flottants passés à une fonction non compilée en ligne seraient mis en boîte à chaque appel, à chaque image
    var LC = new Float64Array(8);
    function lumiereLC(C) {
      if (!C || !(LC[6] > 0.01) || C.nCand >= 24) return;
      var o = C.nCand * 8, K = C.cand;
      K[o] = LC[0]; K[o + 1] = LC[1]; K[o + 2] = LC[2]; K[o + 3] = LC[3]; K[o + 4] = LC[4]; K[o + 5] = LC[5]; K[o + 6] = LC[6]; K[o + 7] = LC[7];
      C.nCand++;
    }
    function attribuerLumieres(C) {
      var K = C.cand, n = C.nCand;
      for (var l = 0; l < C.lumieres.length; l++) {
        var best = -1, bi = 0;
        for (var i = 0; i < n; i++) { var v = K[i * 8 + 6]; if (v > bi) { bi = v; best = i; } }
        var L = C.lumieres[l];
        if (best < 0) { L.intensity = 0; continue; }
        var o = best * 8, x = K[o], y = K[o + 1], z = K[o + 2];
        // la lumière s'écarte de la surface qui l'émet : vers la caméra et au-dessus du sol
        if (camPresente) { var dx = CAM[0] - x, dy = CAM[1] - y, dz = CAM[2] - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > 2.2) { var k = Math.min(1.0, d * 0.45) / d; x += dx * k; y += dy * k; z += dz * k; } }
        var sy = sol(C.nom);
        if (y < sy + 1.1) y = sy + 1.1;
        L.position.set(x, y, z);
        L.color.setRGB(K[o + 3], K[o + 4], K[o + 5]);
        L.intensity = K[o + 6] * K_LUM * ECHELLE_LUMIERES;
        L.distance = K[o + 7];
        K[o + 6] = -1;
      }
      C.nCand = 0;
    }

    // ─────────────────────────────── secousses ───────────────────────────────
    function secouer(force, duree, x, y, z, lieu) {
      if (!surSecousse) return;
      var f = force;
      if (joueurLocal && joueurLocal.position) {
        if (joueurLocal.lieu && lieu && joueurLocal.lieu !== lieu) return;
        var dx = joueurLocal.position.x - x, dz = joueurLocal.position.z - z, d2 = dx * dx + dz * dz;
        f = force / (1 + d2 / 81);
      }
      if (f < 0.02) return;
      posSecousse.x = x; posSecousse.y = y; posSecousse.z = z;
      try { surSecousse(clamp(f, 0, 1), duree, posSecousse); } catch (e) { /* le jeu gère ses erreurs */ }
    }

    // ─────────────────────────────── poignées (ressources tenues image par image) ───────────────────────────────
    function Poignee(type) { this.type = type; this.C = null; this.o = null; this.vu = false; this.fondu = 0.25; }
    var POIGNEES = [];
    function poignee(type, fondu) { var p = new Poignee(type); if (fondu != null) p.fondu = fondu; POIGNEES.push(p); return p; }
    /** Renvoie la ressource de la poignée dans le lieu donné (l'alloue au besoin) et la marque tenue pour cette image. */
    function tenir(p, lieu) {
      var C = couche(lieu);
      if (!C) return null;
      if (p.o && (p.C !== C || !p.o.actif)) { if (p.o.actif) lacher(p.o, p.fondu); p.o = null; }
      if (!p.o) {
        var o = null;
        if (p.type === 'halo') { o = prendre(C.halos); if (o) { o.motif = 0; o.i = 1; o.i0 = 1; o.k = 0; o.vx = o.vy = o.vz = 0; o.mx = o.my = o.mz = 0; o.ancre = -1; o.tirer = 0; o.rot = 0; o.graine = (ali() * K_ALEA); } }
        else if (p.type === 'sol') { o = prendre(C.sols); if (o) { o.a = 1; o.p0 = o.p1 = o.p2 = 0; o.p3 = (ali() * K_ALEA); o.q0 = o.q1 = o.q2 = o.q3 = 0; o.ang = 0; o.y = sol(lieu) + 0.018; } }
        else if (p.type === 'trainee') { o = ruban(C, RT_TRAINEE, R_TRAINEE, 0.2, COUL.energie, COUL.energie, 1, 0); }
        else if (p.type === 'vrille') { o = ruban(C, RT_VRILLE, R_ENERGIE, 0.1, COUL.energie, COUL.energie, 1, 0); }
        else if (p.type === 'spirale') { o = ruban(C, RT_SPIRALE, R_ENERGIE, 0.1, COUL.energie, COUL.energie, 1, 0); }
        else if (p.type === 'cyl' || p.type === 'sph') { o = volume(C, p.type, 0, 0, 0, 0, 1, 1, 1, COUL.energie, 0, 0, 0); }
        else if (p.type === 'pan') { o = prendre(C.pans); if (o) { o.a = 1; o.p0 = o.p1 = o.p2 = o.p3 = 0; o.q0 = o.q1 = o.q2 = o.q3 = 0; o.w0 = o.w1 = o.w2 = o.w3 = 0; o.ang = 0; } }   // v1.5
        if (!o) return null;
        p.o = o; p.C = C;
      }
      p.vu = true;
      return p.o;
    }
    function relacherPoignees() {
      for (var i = 0; i < POIGNEES.length; i++) {
        var p = POIGNEES[i];
        if (!p.vu && p.o) {
          if (p.o.actif) { if (p.type === 'trainee') { p.o.fondu = 0.6; p.o.finFondu = p.o.age + 0.6; } else lacher(p.o, p.fondu); }
          p.o = null; p.C = null;
        }
        p.vu = false;
      }
    }
    function couleur(o, c, k) { o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; }
    var KC = new Float64Array(1);                        // facteur de couleur calculé (couleur en ligne, sans argument flottant)
    function couleurMix(o, a, b, t, k) { o.r = mix(a[0], b[0], t) * k; o.g = mix(a[1], b[1], t) * k; o.b = mix(a[2], b[2], t) * k; }

    // poignées nommées des effets continus
    var PH = {
      mainG: poignee('halo', 0.2), mainD: poignee('halo', 0.2), mainG2: poignee('halo', 0.2), mainD2: poignee('halo', 0.2),
      cibleSort: poignee('sol', 0.3), sceauApparition: poignee('sol', 1.2), vortexApparition: poignee('cyl', 0.5), lueurBoss: poignee('halo', 0.35),
      lueurSol: poignee('sol', 0.6), dos: poignee('halo', 0.3), implosion: poignee('sph', 0.15), lueurImplosion: poignee('halo', 0.2),
      trainéeDescente: poignee('trainee'), vrilleTelek: poignee('vrille', 0.2), mainTelek: poignee('halo', 0.2), mainTelekG: poignee('halo', 0.2), ondePrep: poignee('sol', 0.2),
      couloir: poignee('sol', 0.3), ciblePique: poignee('sol', 0.3), trainéePique: poignee('trainee'), vortexAmes: poignee('cyl', 0.6),
      secteur: poignee('sol', 0.2), lameG: poignee('halo', 0.2), lameD: poignee('halo', 0.2), pointeG: poignee('halo', 0.2), pointeD: poignee('halo', 0.2),
      interaction: poignee('sol', 0.8), cercle: poignee('sol', 1.0), faisceau: poignee('cyl', 1.0), puissanceSol: poignee('sol', 0.6), instable: poignee('halo', 0.2),
      instableSol: poignee('sol', 0.3), lameFormG: poignee('halo', 0.3), lameFormD: poignee('halo', 0.3)
    };
    var PH_AMES_ORBITE = [];
    for (var po = 0; po < 10; po++) PH_AMES_ORBITE.push(poignee('halo', 0.4));
    var PH_EMBRASE = [poignee('halo', 0.3), poignee('halo', 0.3)];     // v1.4 : lames embrasées (passage au rouge)

    // ─────────────────────────────── effets ponctuels ───────────────────────────────
    function fxImpactMagique(lieu, x, y, z, ech) {
      var C = couche(lieu), e = ech || 1, sy = sol(lieu);
      halo(C, H_ECLAT, x, sy + 0.45 * e, z, 0.5 * e, 2.6 * e, COUL.energieClaire, 2.2, 0.35, C_FLASH, 0.4);
      halo(C, H_LUEUR, x, sy + 0.7 * e, z, 1.6 * e, 3.2 * e, COUL.energie, 1.0, 0.6, C_FLASH, 0.6);
      onde(C, x, z, 3.4 * e, 0.4 * e, COUL.energie, 1.6, 0.55, 1);
      var b = solAuto(C, S_BRULURE, x, z, 1.5 * e, COUL.braise, 0.8, 7, 0); if (b) b.q0 = 1.0;
      emettre(C, GAB.etincelle, 28 * e, x, sy + 0.15, z, 0, 1, 0, 1.1 * e);
      emettre(C, GAB.braise, 16 * e, x, sy + 0.3, z, 0, 1, 0, 1.2 * e);
      emettre(C, GAB.poussiere, 9 * e, x, sy + 0.25, z, 0, 1, 0, 1 * e);
      emettre(C, GAB.eclat, 6 * e, x, sy + 0.1, z, 0, 1, 0, 0.7 * e);
      eclairLumiere(C, x, sy + 0.9, z, COUL.energieClaire, 260 * e, 12, 0.4);
      secouer(0.18 * e, 0.3, x, sy, z, lieu);
    }
    function fxImpactTrait(lieu, x, y, z) {
      var C = couche(lieu);
      halo(C, H_ECLAT, x, y, z, 0.25, 1.1, COUL.energieClaire, 2.0, 0.22, C_FLASH, 0.3);
      emettre(C, GAB.etincelle, 18, x, y, z, 0, 0, 0, 0.9);
      emettre(C, GAB.braise, 6, x, y, z, 0, 1, 0, 0.8);
      eclairLumiere(C, x, y, z, COUL.energieClaire, 110, 8, 0.25);
    }
    function fxLancer(lieu, x, y, z, trait) {
      var C = couche(lieu);
      halo(C, H_ECLAT, x, y, z, 0.2, trait ? 0.8 : 1.2, COUL.energieClaire, 2.4, 0.2, C_FLASH, 0.45);
      emettre(C, GAB.etincelle, trait ? 10 : 14, x, y, z, 0, 0, 0, 0.7);
      eclairLumiere(C, x, y, z, COUL.energieClaire, 120, 8, 0.2);
    }
    function fxEmergence(lieu, x, y, z) {
      var C = couche(lieu), sy = sol(lieu);
      var f = solAuto(C, S_FISSURES, x, z, 1.15, COUL.energie, 0.95, 3.2, 0); if (f) f.q0 = 1.2;
      solAuto(C, S_LUEUR, x, z, 1.4, COUL.energie, 0.7, 1.0, C_PULSE);
      emettre(C, GAB.poussiere, 10, x, sy + 0.2, z, 0, 1, 0, 0.9);
      emettre(C, GAB.eclat, 9, x, sy + 0.05, z, 0, 1, 0, 0.6);
      emettre(C, GAB.braise, 8, x, sy + 0.1, z, 0, 1, 0, 0.8);
      tache(T_EMERGENCE, lieu, x, sy, z, 0.6, 0, 0, 0);
      eclairLumiere(C, x, sy + 0.5, z, COUL.energie, 70, 6, 0.6);
    }
    var dernierImpact = -1, impactsSeconde = 0;
    function fxImpactBalle(lieu, x, y, z, tete) {
      if (HORLOGE[0] - dernierImpact > 1) { impactsSeconde = 0; dernierImpact = HORLOGE[0]; }
      if (++impactsSeconde > 30) return;
      var C = couche(lieu);
      halo(C, H_LUEUR, x, y, z, 0.18, tete ? 0.36 : 0.4, tete ? COUL.rituel : COUL.energieClaire, tete ? 1.8 : 1.3, 0.14, C_FLASH, 0.25);
      emettre(C, GAB.etincelle, tete ? 14 : 9, x, y, z, 0, 0, 0, tete ? 0.85 : 0.7, tete ? COUL.rituelBlanc : null, tete ? COUL.energie : null);
      emettre(C, GAB.braise, 2, x, y, z, 0, 0, 0, 0.6);
    }
    function fxImmunise(lieu, x, y, z) {
      var C = couche(lieu);
      var h = halo(C, H_BOUCLIER, x, y, z, 0.42, 0.42, COUL.bouclier, 1.4, 0.32, C_ANNEAU, 0.25);
      if (h) h.motif = H_BOUCLIER;
      emettre(C, GAB.etincelle, 7, x, y, z, 0, 0, 0, 0.6, COUL.rituelBlanc, COUL.bouclier);
      if (modele && modele.voile && typeof modele.voile.impact === 'function') { _v.set(x, y, z); try { modele.voile.impact(_v); } catch (e) { /* modèle sans voile */ } }
    }
    function fxColere(lieu) {
      var C = couche(lieu);
      ancre(A_CENTRE);
      var x = SO[0], y = SO[1], z = SO[2];
      halo(C, H_ANNEAU, x, y + 0.3, z, 3.2, 3.2, COUL.energie, 1.6, 0.5, C_ANNEAU, 0);
      halo(C, H_ECLAT, x, y + 0.3, z, 0.6, 2.4, COUL.energieClaire, 1.8, 0.3, C_FLASH, 0.3);
      onde(C, x, z, 4.5, 0.5, COUL.energie, 1.3, 0.6, 1);
      emettre(C, GAB.braise, 34, x, y, z, 0, 0, 0, 1.4);
      emettre(C, GAB.etincelle, 24, x, y, z, 0, 0, 0, 1.2);
      eclairLumiere(C, x, y + 0.3, z, COUL.energieClaire, 380, 14, 0.5);
      secouer(0.25, 0.4, x, y, z, lieu);
    }
    function fxCendres(lieu, x, y, z) {
      var C = couche(lieu), sy = sol(lieu);
      halo(C, H_LUEUR, x, sy + 0.9, z, 0.6, 1.2, COUL.braise, 1.1, 0.5, C_FLASH, 0.2);
      emettre(C, GAB.braise, 16, x, sy + 0.8, z, 0, 1, 0, 1.0);
      emettre(C, GAB.cendre, 12, x, sy + 0.9, z, 0, 1, 0, 1.0);
      emettre(C, GAB.fumee, 3, x, sy + 0.6, z, 0, 1, 0, 0.8);
      var b = solAuto(C, S_BRULURE, x, z, 0.7, COUL.braise, 0.6, 6, 0); if (b) b.q0 = 0.8;
    }
    function fxAmeExtraite(lieu, x, y, z) {
      var C = couche(lieu);
      var h = halo(C, H_AME, x, y + 1.3, z, 0.45, 0.45, COUL.ameClaire, 1.6, 0.5, C_FIXE, 0.2);
      if (h) { h.sy = 0.24; h.vx = 0; h.vy = 1; h.vz = 0; h.my = 1.4; }
      halo(C, H_LUEUR, x, y + 1.2, z, 0.5, 1.3, COUL.ame, 1.2, 0.45, C_FLASH, 0.2);
      emettre(C, GAB.ame, 14, x, y + 1.2, z, 0, 1, 0, 1.0);
      eclairLumiere(C, x, y + 1.2, z, COUL.ame, 90, 7, 0.45);
    }
    function fxAmeAbsorbee(lieu) {
      var C = couche(lieu);
      ancre(A_POITRINE);
      halo(C, H_ECLAT, SO[0], SO[1], SO[2], 0.3, 1.5, COUL.ameClaire, 1.8, 0.35, C_FLASH, 0.35);
      halo(C, H_ANNEAU, SO[0], SO[1], SO[2], 1.5, 1.5, COUL.ame, 0.8, 0.45, C_ANNEAU, 0.35);
      emettre(C, GAB.ame, 12, SO[0], SO[1], SO[2], 0, 0, 0, 1.2);
      emettre(C, GAB.braise, 8, SO[0], SO[1], SO[2], 0, 0, 0, 1.0);
      eclairLumiere(C, SO[0], SO[1], SO[2], COUL.ame, 160, 9, 0.4);
    }
    function emettreAile(C, g, n, cote, ech, c1, c2) {
      ancre(A_DOS); var x0 = SO[0], y0 = SO[1], z0 = SO[2];
      ancre(cote > 0 ? A_AILEG : A_AILED);
      var dx = SO[0] - x0, dy = SO[1] - y0, dz = SO[2] - z0;
      var nn = Math.round(n * Q.densite);
      for (var i = 0; i < nn; i++) {
        var t = Math.sqrt((ali() * K_ALEA)), drop = entre(-0.9, 0.2) * t;
        emettre(C, g, N1, x0 + dx * t, y0 + dy * t + drop, z0 + dz * t, dx, dy * 0.5 + 0.3, dz, ech, c1, c2);
      }
    }
    function fxAilesDeploiement(lieu) {
      var C = couche(lieu);
      ancre(A_DOS);
      halo(C, H_ECLAT, SO[0], SO[1], SO[2], 0.5, 2.8, COUL.energieClaire, 2.2, 0.4, C_FLASH, 0.3);
      halo(C, H_ANNEAU, SO[0], SO[1], SO[2], 3.6, 3.6, COUL.energie, 1.3, 0.55, C_ANNEAU, 0);
      eclairLumiere(C, SO[0], SO[1], SO[2], COUL.energieClaire, 420, 14, 0.6);
      onde(C, SO[0], SO[2], 5, 0.5, COUL.energie, 1.0, 0.7, 1);
      for (var c = -1; c <= 1; c += 2) { emettreAile(C, GAB.etincelle, 22, c, 1.3); emettreAile(C, GAB.braise, 24, c, 1.3); emettreAile(C, GAB.energie, 18, c, 1.5); }
      secouer(0.3, 0.45, SO[0], SO[1], SO[2], lieu);
    }
    function fxPiqueImpact(lieu, x, y, z) {
      var C = couche(lieu), sy = sol(lieu), r = PIQUE_RAYON;
      halo(C, H_ECLAT, x, sy + 0.8, z, 0.6, 4.2, COUL.energieClaire, 2.4, 0.4, C_FLASH, 0.5);
      onde(C, x, z, r * 3.2, 0.6, COUL.energie, 1.8, 0.5, 1);
      onde(C, x, z, r * 5.0, 0.9, COUL.energieSombre, 1.0, 0.9, 1.5);
      var f = solAuto(C, S_FISSURES, x, z, r * 1.8, COUL.energie, 1.0, 6, 0); if (f) f.q0 = 1.4;
      var b = solAuto(C, S_BRULURE, x, z, r * 1.6, COUL.braise, 0.85, 9, 0); if (b) b.q0 = 1.0;
      volume(C, 'sph', V_COQUILLE, x, sy, z, r * 2.8, r * 1.4, r * 2.8, COUL.energie, 0.8, 0.5, C_FLASH);
      emettreAnneau(C, GAB.poussiere, 26, x, sy + 0.1, z, 0.8, 5.5, 1.1);
      emettre(C, GAB.eclat, 18, x, sy + 0.1, z, 0, 1, 0, 1.0);
      emettre(C, GAB.etincelle, 40, x, sy + 0.3, z, 0, 1, 0, 1.4);
      emettre(C, GAB.braise, 20, x, sy + 0.4, z, 0, 1, 0, 1.3);
      eclairLumiere(C, x, sy + 1.0, z, COUL.energieClaire, 700, 16, 0.6);
      secouer(0.6, 0.6, x, sy, z, lieu);
    }
    function fxTeleport(lieu, sens, x, y, z) {
      var C = couche(lieu), sy = sol(lieu), sang = lieu === 'bunker';
      var c1 = sang ? COUL.sangVif : COUL.energieClaire, c2 = sang ? COUL.sang : COUL.energie;
      // au bunker (traque dans le noir, souvent tout près du joueur) : éclair plus retenu, jamais aveuglant
      var kf = sang ? 0.6 : 1;
      halo(C, H_ECLAT, x, y + 1.0, z, 0.4, sang ? 2.0 : 2.6, c1, 2.0 * kf, 0.32, C_FLASH, 0.3);
      onde(C, x, z, 3.0, 0.4, c2, 1.2, 0.5, sens === 'arrivee' ? 1 : 0.3);
      if (sens === 'arrivee') {
        volume(C, 'cyl', V_COLONNE, x, sy, z, 0.75, 4.2, 0.75, c1, 0.9 * kf, 0.55, C_PULSE);
        emettreAnneau(C, GAB.poussiere, 14, x, sy + 0.1, z, 0.5, 3.0, 0.9);
        emettre(C, GAB.braise, 22, x, y + 1.0, z, 0, 0, 0, 1.2, sang ? COUL.sangVif : null, sang ? COUL.sang : null);
      } else {
        emettre(C, GAB.braise, 30, x, y + 1.0, z, 0, -1, 0, 1.0, sang ? COUL.sangVif : null, sang ? COUL.sang : null);
        emettre(C, GAB.etincelle, 18, x, y + 1.0, z, 0, 0, 0, 1.0, c1, c2);
        if (sang) emettre(C, GAB.brumeRouge, 8, x, y + 1.0, z, 0, 0, 0, 1.5);
      }
      eclairLumiere(C, x, y + 1.0, z, c1, sang ? 120 : 300, 12, 0.4);
    }
    function fxDeflagration(lieu) {
      var C = couche(lieu), sy = sol(lieu);
      ancre(A_CENTRE); var x = SO[0], y = SO[1], z = SO[2];
      halo(C, H_ECLAT, x, y, z, 1.0, 6.5, COUL.energieClaire, 2.6, 0.45, C_FLASH, 0.5);
      onde(C, x, z, APO * 0.95, 1.3, COUL.energie, 2.0, 0.9, 1.5);
      onde(C, x, z, APO * 0.6, 0.7, COUL.energieClaire, 1.2, 0.5, 0.5);
      volume(C, 'sph', V_COQUILLE, x, sy, z, APO * 0.8, APO * 0.4, APO * 0.8, COUL.energie, 0.55, 0.7, C_FLASH);
      emettreAnneau(C, GAB.poussiere, 44, x, sy + 0.1, z, 1.2, 8, 1.3);
      emettre(C, GAB.braise, 60, x, y, z, 0, 0, 0, 1.8);
      emettre(C, GAB.etincelle, 40, x, y, z, 0, 0, 0, 1.6);
      eclairLumiere(C, x, y, z, COUL.energieClaire, 1100, 26, 0.7);
      ecr.flashBlanc = Math.max(ecr.flashBlanc, 0.14);
      OSC[iLieu(lieu)] = 0.6;
      secouer(0.85, 0.8, x, y, z, lieu);
      tache(T_PLAFOND, lieu, x, y, z, 2.6, 1.0, 0, 0);
    }
    function fxRugissement(lieu, fort) {
      tache(T_RUGISSEMENT, lieu, 0, 0, 0, 1.0, fort ? 1 : 0.6, 0, 0);
      if (fort) tache(T_PLAFOND, lieu, 0, 0, 0, 2.2, 0.8, 0, 0);
      ancre(A_BOUCHE);
      secouer(fort ? 0.45 : 0.25, 0.6, SO[0], SO[1], SO[2], lieu);
    }
    function fxArrachement(D) {
      var C = couche('salle');
      var x = D.x + D.nx * 0.5, z = D.z + D.nz * 0.5;
      emettre(C, GAB.eclat, 26, x, D.y, z, D.nx, 0.25, D.nz, 1.2);
      emettre(C, GAB.poussiere, 18, x, D.y, z, D.nx, 0.1, D.nz, 1.4);
      emettre(C, GAB.etincelle, 16, x, D.y, z, D.nx, 0.3, D.nz, 1.0);
      halo(C, H_ECLAT, x, D.y, z, 0.5, 2.2, COUL.energieClaire, 1.6, 0.3, C_FLASH, 0.3);
      eclairLumiere(C, x, D.y, z, COUL.energieClaire, 260, 12, 0.4);
      secouer(0.25, 0.4, x, D.y, z, 'salle');
    }
    function fxBlocImpact(lieu, x, y, z) {
      var C = couche(lieu), sy = sol(lieu);
      halo(C, H_ECLAT, x, y, z, 0.5, 3.2, COUL.energieClaire, 1.8, 0.35, C_FLASH, 0.4);
      onde(C, x, z, RAYON_BLOC * 3.2, 0.55, COUL.energie, 1.4, 0.6, 1.5);
      var f = solAuto(C, S_FISSURES, x, z, RAYON_BLOC * 1.5, COUL.energie, 1.0, 6, 0); if (f) f.q0 = 0.9;
      var b = solAuto(C, S_BRULURE, x, z, RAYON_BLOC * 1.3, COUL.braise, 0.85, 9, 0); if (b) b.q0 = 0.6;
      emettre(C, GAB.eclat, 34, x, Math.max(y, sy + 0.4), z, 0, 1, 0, 1.3);
      emettre(C, GAB.poussiere, 30, x, Math.max(y, sy + 0.3), z, 0, 1, 0, 1.6);
      emettreAnneau(C, GAB.poussiere, 14, x, sy + 0.1, z, 1.0, 4, 1.2);
      emettre(C, GAB.etincelle, 20, x, y, z, 0, 1, 0, 1.0);
      eclairLumiere(C, x, y, z, COUL.energieClaire, 420, 14, 0.45);
      secouer(0.5, 0.5, x, y, z, lieu);
    }
    /** v1.1 : cercle rituel au sol à chaque téléportation du boss dans le bunker (départ et arrivée). */
    function fxCercleTeleport(lieu, x, z) {
      var C = couche(lieu);
      var s = solAuto(C, S_SCEAU, x, z, RAYON_TP, COUL.energie, 1, DESSIN_TP + TENUE_TP + EFFACE_TP, 0);
      if (s) { s.ang = (ali() * K_ALEA) * TAU; s.p0 = 0; s.p1 = 0.6; s.p2 = 0.7; }
      solAuto(C, S_LUEUR, x, z, RAYON_TP * 1.15, COUL.energie, 0.55, DESSIN_TP + TENUE_TP, C_PULSE);
      emettreAnneau(C, GAB.braise, 18, x, sol(lieu) + 0.08, z, RAYON_TP * 0.9, 0.6, 0.9);
    }
    /** v1.1 : bloc qui percute un pilier (touche) ou pilier qui s'effondre (detruit). */
    function fxPilier(d) {
      var C = couche('salle'), sy = SOL_SALLE;
      var c = d.position || PILIERS[d.id];
      if (!c) return;
      if (d.etat === 'detruit') {
        var r = (PILIERS[d.id] && PILIERS[d.id].rayon) || 0.85;
        for (var h = 0.6; h < 7.6; h += 1.4) emettre(C, GAB.poussiere, 10, c.x, sy + h, c.z, 0, -0.2, 0, 1.7);
        emettreAnneau(C, GAB.poussiere, 40, c.x, sy + 0.15, c.z, r, 7.0, 1.8);
        emettre(C, GAB.eclat, 46, c.x, sy + 2.5, c.z, 0, 0.6, 0, 1.5);
        emettre(C, GAB.etincelle, 20, c.x, sy + 1.5, c.z, 0, 1, 0, 1.0);
        onde(C, c.x, c.z, 6.5, 0.6, COUL.poussiere, 1.0, 0.9, 2.0);
        halo(C, H_ECLAT, c.x, sy + 1.6, c.z, 0.8, 3.6, COUL.energieClaire, 1.3, 0.4, C_FLASH, 0.3);
        tache(T_PLAFOND, 'salle', c.x, sy + 8, c.z, 2.0, 1.0, 0, 0);
        eclairLumiere(C, c.x, sy + 2, c.z, COUL.energieClaire, 380, 16, 0.5);
        secouer(0.8, 1.2, c.x, sy + 1, c.z, 'salle');
      } else {
        var q = d.pointImpact || c, y = q.y != null && q.y > sy + 0.3 ? q.y : sy + 1.8;
        var dx = q.x - c.x, dz = q.z - c.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
        emettre(C, GAB.eclat, 30, q.x, y, q.z, dx / l, 0.3, dz / l, 1.3);
        emettre(C, GAB.poussiere, 22, q.x, y, q.z, dx / l, 0.1, dz / l, 1.5);
        emettre(C, GAB.poussiere, 10, q.x, Math.min(y + 1.5, sy + 7.5), q.z, 0, -1, 0, 1.2);
        emettre(C, GAB.etincelle, 14, q.x, y, q.z, dx / l, 0.4, dz / l, 1.0);
        halo(C, H_ECLAT, q.x, y, q.z, 0.4, 2.2, COUL.energieClaire, 1.5, 0.3, C_FLASH, 0.3);
        secouer(0.35, 0.45, q.x, y, q.z, 'salle');
      }
    }

    // ─────────────────────────────── v1.2 : meute de chiens zombies (API.md §14.3, §14.5) ───────────────────────────────
    function solDe(lieu, y) { return y != null && isFinite(y) ? +y : sol(lieu); }
    /** Faille : sceau couleur braise qui se trace et se fissure au sol, fumée, braises, lumière (ouverture + 0,6 s). */
    function fxFaille(lieu, x, y, z, duree) {
      var C = couche(lieu), sy = solDe(lieu, y), D = duree > 0 ? duree : T_FAILLE_CHIEN;
      var s = solAuto(C, S_FAILLE, x, z, RAYON_FAILLE, COUL.braise, 1, D + T_FAILLE_FIN, 0);
      if (s) { s.y = sy + 0.02; s.v0 = D; s.p1 = 0; }
      var l = solAuto(C, S_LUEUR, x, z, RAYON_FAILLE * 1.5, COUL.braise, 0.22, D + T_FAILLE_FIN, C_PULSE);
      if (l) l.y = sy + 0.015;
      emettre(C, GAB.poussiere, 5, x, sy + 0.1, z, 0, 1, 0, 0.7);
      var T = tache(T_FAILLE, lieu, x, sy, z, D + T_FAILLE_FIN, D, 0, 0);
      if (T) T.h = halo(C, H_LUEUR, x, sy + 0.45, z, 0.32, 0.32, COUL.braise, 0.12, D + T_FAILLE_FIN, C_FIXE, 0);
    }
    /** Le chien jaillit de la faille : éclats de terre, braises, étincelles, éclair bref, petite onde. */
    function fxApparitionChien(lieu, x, y, z) {
      var C = couche(lieu), sy = solDe(lieu, y);
      emettre(C, GAB.eclat, 16, x, sy + 0.1, z, 0, 1, 0, 0.9);
      emettre(C, GAB.poussiere, 8, x, sy + 0.25, z, 0, 1, 0, 1.0);
      emettre(C, GAB.braise, 20, x, sy + 0.3, z, 0, 1, 0, 1.0);
      emettre(C, GAB.etincelle, 14, x, sy + 0.2, z, 0, 1, 0, 0.9, COUL.brasier, COUL.braise);
      halo(C, H_ECLAT, x, sy + 0.55, z, 0.3, 1.9, COUL.braise, 1.7, 0.26, C_FLASH, 0.2);
      var o = onde(C, x, z, RAYON_FAILLE * 2.6, 0.28, COUL.braise, 0.8, 0.35, 0.25);
      if (o) o.y = sy + 0.02;
      for (var e = 0; e < 2; e++) {
        var a = (ali() * K_ALEA) * TAU, r = entre(0.6, 1.2);
        eclair(C, x, sy + 0.1, z, x + Math.cos(a) * r, sy + entre(0.5, 1.3), z + Math.sin(a) * r, 0.05, COUL.energieClaire, 2.0, entre(0.1, 0.16), 0.15);
      }
      eclairLumiere(C, x, sy + 0.7, z, COUL.braise, 220, 9, 0.35);
    }
    /** Chien tué : petite bouffée de cendres et de braises (plus forte à la défaite du boss). */
    function fxMortChien(lieu, x, y, z, fort) {
      var C = couche(lieu), sy = solDe(lieu, y), k = fort ? 1.8 : 1;
      emettre(C, GAB.cendre, 16 * k, x, sy + 0.4, z, 0, 1, 0, 0.85);
      emettre(C, GAB.braise, 12 * k, x, sy + 0.35, z, 0, 1, 0, 0.85);
      emettre(C, GAB.fumee, 3 * k, x, sy + 0.3, z, 0, 1, 0, 0.7);
      halo(C, H_LUEUR, x, sy + 0.45, z, 0.4, fort ? 1.2 : 1.0, COUL.braise, fort ? 1.4 : 1.1, 0.4, C_FLASH, 0.15);
      eclairLumiere(C, x, sy + 0.5, z, COUL.braise, 70 * k, 5, 0.4);
    }
    /** Position et lieu du boss (centre du corps), sinon le centre du cercle de la salle. */
    var POS_MEUTE = { x: 0, y: 0, z: 0, lieu: 'salle' };
    function centreBoss() {
      if (BOSS && BOSS.position && bossVisible) { ancre(A_CENTRE); POS_MEUTE.x = SO[0]; POS_MEUTE.y = SO[1]; POS_MEUTE.z = SO[2]; POS_MEUTE.lieu = lieuBoss; }
      else { POS_MEUTE.x = CERCLE_X; POS_MEUTE.y = SOL_SALLE + 1; POS_MEUTE.z = CERCLE_Z; POS_MEUTE.lieu = 'salle'; }
      return POS_MEUTE;
    }
    /** La meute est lâchée : onde rouge autour du boss, anneau, braises, légère secousse. */
    function fxMeuteDechainee() {
      var P = centreBoss(), lieu = P.lieu, C = couche(lieu), x = P.x, y = P.y, z = P.z, sy = sol(lieu);
      onde(C, x, z, 9.0, 0.6, COUL.meute, 0.9, 1.1, 0.5);
      onde(C, x, z, 5.0, 0.4, COUL.sangVif, 0.7, 0.7, 0.2);
      halo(C, H_ANNEAU, x, y, z, 1.2, 4.5, COUL.meute, 1.0, 0.55, C_ANNEAU, 0.1);
      emettreAnneau(C, GAB.braise, 26, x, sy + 0.15, z, 1.0, 4.0, 1.0, COUL.sangVif, COUL.sang);
      emettre(C, GAB.brumeRouge, 8, x, y, z, 0, 0, 0, 1.4);
      eclairLumiere(C, x, y + 0.5, z, COUL.meute, 380, 14, 0.6);
      secouer(0.3, 0.5, x, y, z, lieu);
    }
    /** La meute se dissipe (défaite) : souffle discret de cendres autour du boss. */
    function fxMeuteDissipee() {
      var P = centreBoss(), C = couche(P.lieu);
      emettre(C, GAB.cendre, 10, P.x, P.y, P.z, 0, 1, 0, 1.4);
    }

    // ─────────────────────────────── v1.3 : cuves et mini-boss de la phase 2 (API.md §15.4, §15.5) ───────────────────────────────
    var A_SIPHON = A_DYN + 16;                          // départ du flot (haut de la cuve, côté boss)
    var PH_SIPHON = [poignee('vrille', 0.2), poignee('vrille', 0.2), poignee('vrille', 0.2), poignee('vrille', 0.2)];
    var PH_SIPHON_H = [poignee('halo', 0.3), poignee('halo', 0.3), poignee('halo', 0.3)];
    /** Siphon (action) : flot d'énergie verte du haut de la cuve aux deux mains du boss, liquide qui bouillonne. */
    function contSiphon(C, dt, et, pr, a) {
      var dn = a.donnees || VIDE, T0 = tubePar(dn.tube, dn.miniBoss);
      var tx, tz, haut, R = 0.85;
      if (T0) { tx = T0.x; tz = T0.z; haut = T0.haut; R = T0.rayon; }
      else if (a.cible) { tx = a.cible.x; tz = a.cible.z; haut = (+a.cible.y || 0) + 1.7; }
      else return;
      ancre(A_POITRINE);
      var dx = SO[0] - tx, dz = SO[2] - tz, l = Math.sqrt(dx * dx + dz * dz) || 1;
      var sx = tx + dx / l * R * 0.45, sy = haut + 0.06, sz = tz + dz / l * R * 0.45;
      (ANC[(A_SIPHON) * 3] = sx, ANC[(A_SIPHON) * 3 + 1] = sy, ANC[(A_SIPHON) * 3 + 2] = sz, ANC_T[A_SIPHON] = trame);
      // (courbes calculées en ligne : un flottant rendu par un appel non compilé en ligne serait mis en boîte)
      var u1 = pr < 0 ? 0 : pr > 1 ? 1 : pr, u6 = pr / 0.6, u12 = pr / 0.12;
      u6 = u6 < 0 ? 0 : u6 > 1 ? 1 : u6; u12 = u12 < 0 ? 0 : u12 > 1 ? 1 : u12;
      var f = et === 'approche' ? 0.3 * u1 * u1 * (3 - 2 * u1) : et === 'aspiration' ? 1 : et === 'eclatement' ? 1 - u6 * u6 * (3 - 2 * u6) : 0.12 * (1 - pr);
      if (et === 'aspiration' || (et === 'eclatement' && pr < 0.6)) {
        var cr = et === 'aspiration' ? u12 * u12 * (3 - 2 * u12) : 1;
        for (var m = 0; m < 2; m++) {
          var main = m ? A_MAIND : A_MAING, arche = 1.0 + 0.35 * m;
          var r = tenir(PH_SIPHON[m * 2], lieuBoss);
          if (r) {
            r.type = RT_VRILLE; r.style = R_ENERGIE; r.A = A_SIPHON; r.B = main; r.larg = 0.38; r.amp = 0.12; r.freq = 1.8; r.vit = 5; r.arche = arche; r.croissance = cr;
            (KC[0] = 1.15 * f, r.r = COUL.cuve[0] * KC[0], r.g = COUL.cuve[1] * KC[0], r.b = COUL.cuve[2] * KC[0]); r.r2 = COUL.cuve[0] * 1.3 * f; r.g2 = COUL.cuve[1] * 1.3 * f; r.b2 = COUL.cuve[2] * 1.3 * f;
          }
          var r2 = tenir(PH_SIPHON[m * 2 + 1], lieuBoss);
          if (r2) {
            r2.type = RT_VRILLE; r2.style = R_ENERGIE; r2.A = A_SIPHON; r2.B = main; r2.larg = 0.08; r2.amp = 0.3; r2.freq = 3.6; r2.vit = 9; r2.arche = arche; r2.croissance = cr;
            (KC[0] = 0.9 * f, r2.r = COUL.cuveClaire[0] * KC[0], r2.g = COUL.cuveClaire[1] * KC[0], r2.b = COUL.cuveClaire[2] * KC[0]); r2.r2 = COUL.cuveClaire[0] * 1.1 * f; r2.g2 = COUL.cuveClaire[1] * 1.1 * f; r2.b2 = COUL.cuveClaire[2] * 1.1 * f;
          }
        }
        acc.siphon += dt * 46 * Q.densite;
        while (acc.siphon >= 1) { acc.siphon -= 1; EA[0] = sx; EA[1] = sy; EA[2] = sz; EA[6] = 1; EA[8] = 0.18; EA[9] = 0.6; emettreConvDepuisEA(C, GAB.siphon, 1, (ali() * K_ALEA) < 0.5 ? A_MAING : A_MAIND, null, null); }
      }
      if (et !== 'recuperation') {                          // le liquide bouillonne en haut de la cuve
        acc.bulles += dt * (8 + 36 * f) * Q.densite;
        while (acc.bulles >= 1) {
          acc.bulles -= 1;
          var ab = (ali() * K_ALEA) * TAU, rb = Math.sqrt((ali() * K_ALEA)) * R * 0.75;
          EA[0] = tx + Math.cos(ab) * rb; EA[1] = haut - 0.12 - 0.5 * (ali() * K_ALEA); EA[2] = tz + Math.sin(ab) * rb; EA[3] = 0; EA[4] = 1; EA[5] = 0; EA[6] = 1; EA[7] = NaN;
          emettreEA(C, GAB.bulle, 1, null, null);
          if (f > 0.5 && (ali() * K_ALEA) < 0.3) { EA[0] = tx + Math.cos(ab) * rb * 0.8; EA[1] = haut - 0.05; EA[2] = tz + Math.sin(ab) * rb * 0.8; EA[3] = 0; EA[4] = 1; EA[5] = 0; EA[6] = 0.45; EA[7] = NaN; emettreEA(C, GAB.liquide, 1, COUL.cuveClaire, COUL.cuve); }
        }
      }
      var h0 = tenir(PH_SIPHON_H[0], lieuBoss);
      if (h0) { h0.motif = H_LUEUR; h0.x = sx; h0.y = sy; h0.z = sz; h0.sx = h0.sy = 0.5 + 0.6 * f; h0.tirer = 0.2; couleur(h0, COUL.cuve, 1); h0.i = 0.2 + 0.9 * f; }
      for (var k = 0; k < 2; k++) {
        var hm = tenir(PH_SIPHON_H[1 + k], lieuBoss);
        if (hm) { ancre(k ? A_MAIND : A_MAING); hm.motif = H_ORBE; hm.x = SO[0]; hm.y = SO[1]; hm.z = SO[2]; hm.sx = hm.sy = 0.14 + 0.16 * f; hm.tirer = 0.1; couleur(hm, COUL.cuveClaire, 1); hm.i = 0.3 + 1.3 * f; }
      }
      (LC[0] = sx, LC[1] = sy, LC[2] = sz, LC[3] = COUL.cuve[0], LC[4] = COUL.cuve[1], LC[5] = COUL.cuve[2], LC[6] = 20 + 110 * f, LC[7] = 9, lumiereLC(C));
      if (f > 0.2) { ancre(A_POITRINE); (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = COUL.cuve[0], LC[4] = COUL.cuve[1], LC[5] = COUL.cuve[2], LC[6] = 50 * f, LC[7] = 7, lumiereLC(C)); }
    }
    /** Évènement `tube` : siphon (le liquide se soulève), fissure (le verre se fend, lumineux), eclate (gerbe de verre…). */
    function fxCuve(d) {
      var T0 = tubePar(d.id, d.miniBoss), C = couche('salle'), p = d.position;
      if (!T0 && !p) return;
      var x = T0 ? T0.x : p.x, z = T0 ? T0.z : p.z, bas = T0 ? T0.bas : solDe('salle', p.y) + SOCLE_CUVE;
      var haut = T0 ? T0.haut : bas + 2.6, R = T0 ? T0.rayon : 0.85, H = T0 ? T0.hauteur : 2.6;
      var bx = CERCLE_X, bz = CERCLE_Z;                      // face de rupture : vers le boss (sinon le centre de la salle)
      if (BOSS && BOSS.position) { bx = BOSS.position.x; bz = BOSS.position.z; }
      var dx = bx - x, dz = bz - z, l = Math.sqrt(dx * dx + dz * dz) || 1; dx /= l; dz /= l;
      if (d.etat === 'siphon') {
        emettreAnneau(C, GAB.liquide, 18, x, haut - 0.05, z, R * 0.6, 1.4, 0.7, COUL.cuve, COUL.cuveSombre);
        halo(C, H_ECLAT, x + dx * R * 0.4, haut + 0.1, z + dz * R * 0.4, 0.3, 1.6, COUL.cuveClaire, 1.4, 0.3, C_FLASH, 0.2);
        eclairLumiere(C, x, haut, z, COUL.cuve, 160, 9, 0.4);
      } else if (d.etat === 'fissure') {
        var v = FISSURES_CUVE ? volume(C, 'cyl', V_FISSURES, x, bas, z, R + 0.025, H, R + 0.025, COUL.cuveClaire, 1.1, 3.0, 0) : null;
        if (v) { v.mesh.rotation.y = Math.atan2(dx, dz); v.haut = 0; v.a = 0; if (T0) T0.fissures = v; }
        var px = x + dx * (R + 0.03), pz = z + dz * (R + 0.03), py = bas + 1.35;
        halo(C, H_ECLAT, px, py, pz, 0.2, 1.2, COUL.verre, 1.6, 0.22, C_FLASH, 0.3);
        emettre(C, GAB.verre, 10, px, py, pz, dx, 0.2, dz, 0.5);
        emettre(C, GAB.etincelle, 10, px, py, pz, dx, 0.3, dz, 0.8, COUL.cuveClaire, COUL.cuve);
        eclairLumiere(C, px, py, pz, COUL.cuveClaire, 120, 7, 0.3);
      } else if (d.etat === 'eclate') {
        if (T0 && T0.fissures && T0.fissures.actif && T0.fissures.motif === V_FISSURES) lacher(T0.fissures, 0.12);
        if (T0) T0.fissures = null;
        var cy = bas + 1.3, fx0 = x + dx * R, fz0 = z + dz * R;
        emettre(C, GAB.verre, 60, fx0, cy, fz0, dx, 0.35, dz, 1.6);
        emettre(C, GAB.verre, 26, x, cy + 0.6, z, 0, 0, 0, 1.4);
        emettre(C, GAB.liquide, 70, x + dx * R * 0.8, bas + 0.9, z + dz * R * 0.8, dx, 0.25, dz, 1.6);
        emettre(C, GAB.brumeVerte, 22, x, cy, z, dx, 0.3, dz, 1.6);
        halo(C, H_ECLAT, fx0, cy, fz0, 0.8, 4.2, COUL.cuveClaire, 2.2, 0.4, C_FLASH, 0.35);
        onde(C, fx0, fz0, 7.0, 0.7, COUL.cuve, 1.4, 0.8, 1.2);
        solAuto(C, S_LUEUR, x + dx * 1.6, z + dz * 1.6, 2.6, COUL.cuve, 0.5, 2.5, 0);
        for (var e = 0; e < 3; e++) {
          var ae = Math.atan2(dx, dz) + entre(-0.9, 0.9), re = entre(1.5, 3.2);
          eclair(C, x, cy, z, x + Math.sin(ae) * re, bas + entre(0.1, 1.5), z + Math.cos(ae) * re, 0.07, COUL.cuveClaire, 2.2, entre(0.12, 0.2), 0.16);
        }
        eclairLumiere(C, fx0, cy, fz0, COUL.cuveClaire, 700, 18, 0.6);
        secouer(0.6, 0.7, x, cy, z, 'salle');
      }
    }
    /** Mini-boss libéré : vapeur autour de lui, éclat et onde à sa couleur (la vapeur continue ≈ 1,8 s, voir majProtection). */
    function fxMiniBossLibere(type, x, y, z) {
      var C = couche('salle'), c = couleurMB(type), sy = solDe('salle', y);
      emettreAnneau(C, GAB.vapeur, 26, x, sy + 0.15, z, 0.4, 1.8, 1.3);
      emettre(C, GAB.vapeur, 16, x, sy + 0.9, z, 0, 1, 0, 1.4);
      emettre(C, GAB.etincelle, 14, x, sy + 1.0, z, 0, 1, 0, 0.9, c, c);
      halo(C, H_LUEUR, x, sy + 1.1, z, 0.6, 2.0, c, 1.2, 0.5, C_FLASH, 0.2);
      onde(C, x, z, 3.5, 0.4, c, 1.0, 0.6, 0.6);
      eclairLumiere(C, x, sy + 1.2, z, c, 200, 9, 0.5);
    }
    /** Mini-boss tué : petite gerbe à sa couleur, vapeur (son corps et ses capacités sont dessinés par le jeu). */
    function fxMiniBossMort(type, x, y, z) {
      var C = couche('salle'), c = couleurMB(type), sy = solDe('salle', y);
      emettre(C, GAB.etincelle, 18, x, sy + 1.0, z, 0, 1, 0, 1.0, c, c);
      emettre(C, GAB.vapeur, 10, x, sy + 0.6, z, 0, 1, 0, 1.2);
      halo(C, H_ECLAT, x, sy + 1.0, z, 0.4, 1.8, c, 1.4, 0.3, C_FLASH, 0.2);
      eclairLumiere(C, x, sy + 1.0, z, c, 150, 8, 0.4);
    }
    /** Protection : le voile se forme (le lien suit l'instantané). */
    function fxProtectionDebut(type) {
      if (!bossVisible) return;
      var C = couche(lieuBoss), c = couleurMB(type);
      ancre(A_CENTRE);
      halo(C, H_ANNEAU, SO[0], SO[1] + 0.15, SO[2], 1.4, 2.4, c, 1.0, 0.45, C_ANNEAU, 0.1);
      eclairLumiere(C, SO[0], SO[1], SO[2], c, 160, 8, 0.4);
    }
    /** Fin de la protection : le voile se brise (le boss redevient vulnérable). */
    function fxProtectionFin(type) {
      if (!bossVisible) return;
      var C = couche(lieuBoss), c = couleurMB(type);
      ancre(A_CENTRE);
      var x = SO[0], y = SO[1] + 0.15, z = SO[2];
      halo(C, H_ANNEAU, x, y, z, 1.2, 3.4, COUL.bouclier, 1.3, 0.5, C_ANNEAU, 0.1);
      halo(C, H_ECLAT, x, y, z, 0.8, 3.0, c, 1.5, 0.35, C_FLASH, 0.3);
      emettre(C, GAB.etincelle, 34, x, y, z, 0, 0, 0, 1.4, COUL.bouclier, c);
      emettre(C, GAB.energie, 16, x, y, z, 0, 0, 0, 1.4, c, c);
      eclairLumiere(C, x, y, z, c, 260, 10, 0.45);
      secouer(0.25, 0.35, x, y, z, lieuBoss);
    }
    // lien pulsé boss ↔ mini-boss vivant (instantané etat().miniBoss), voile de bouclier tant que etat().boss.protege
    var SUIVI_MB = creerSuivis(3, ['vrille', 'vrille', 'halo', 'halo']);
    for (var smb = 0; smb < SUIVI_MB.length; smb++) SUIVI_MB[smb].ancre = A_MBS + smb;
    var PH_VOILE = poignee('sph', 0.35);
    var COUL_VOILE = [0, 0, 0], COUL_LIEN = [0, 0, 0];
    function majProtection(dt, E) {
      var B = E.boss, protege = !!(B && B.protege && bossVisible), L = E.miniBoss, typeVoile = null;
      var C = couche(lieuBoss);
      if (L && L.length) {
        for (var i = 0; i < L.length; i++) {
          var mb = L[i];
          if (!mb || mb.etat !== 'actif' || !mb.position) continue;
          var s = trouverSuivi(SUIVI_MB, mb.id, true);
          if (!s) continue;
          s.vu = true; s.age += dt;
          if (!typeVoile) typeVoile = mb.type;
          var c = couleurMB(mb.type), Cm = couche(mb.lieu === 'bunker' ? 'bunker' : 'salle');
          var px = mb.position.x, py = mb.position.y + 1.25, pz = mb.position.z;
          (ANC[(s.ancre) * 3] = px, ANC[(s.ancre) * 3 + 1] = py, ANC[(s.ancre) * 3 + 2] = pz, ANC_T[s.ancre] = trame);
          if (s.age < 1.8) {                                // vapeur pendant la sortie de la cuve
            s.acc += dt * 22 * (1 - s.age / 1.8) * Q.densite;
            while (s.acc >= 1) {
              s.acc -= 1; var av = (ali() * K_ALEA) * TAU, rv = 0.3 + 0.5 * (ali() * K_ALEA);
              EA[0] = mb.position.x + Math.cos(av) * rv; EA[1] = mb.position.y + 0.1 + 1.3 * (ali() * K_ALEA); EA[2] = mb.position.z + Math.sin(av) * rv; EA[3] = 0; EA[4] = 1; EA[5] = 0; EA[6] = 1; EA[7] = NaN;
              emettreEA(Cm, GAB.vapeur, 1, null, null);
            }
          }
          if (!protege || (mb.rage && mb.rage.capacite === 'surcharge' && !mb.rage.actif)) continue;   // v1.5 : le rayon de la surcharge remplace le lien
          var puls = 0.5 + 0.5 * Math.sin(HORLOGE[0] * 7.0 + i * 2.1), ua = s.age / 0.4; ua = ua > 1 ? 1 : ua < 0 ? 0 : ua;
          var cr = ua * ua * (3 - 2 * ua);
          COUL_LIEN[0] = c[0] + (1 - c[0]) * 0.35; COUL_LIEN[1] = c[1] + (1 - c[1]) * 0.35; COUL_LIEN[2] = c[2] + (1 - c[2]) * 0.35;
          var r = tenir(s.p[0], lieuBoss);
          if (r) {
            r.type = RT_VRILLE; r.style = R_ENERGIE; r.A = s.ancre; r.B = A_POITRINE; r.larg = 0.28; r.amp = 0.1; r.freq = 1.4; r.vit = 6; r.arche = 0.3; r.croissance = cr;
            (KC[0] = 0.8 + 0.9 * puls, r.r = c[0] * KC[0], r.g = c[1] * KC[0], r.b = c[2] * KC[0]); r.r2 = c[0] * (0.9 + 0.8 * puls); r.g2 = c[1] * (0.9 + 0.8 * puls); r.b2 = c[2] * (0.9 + 0.8 * puls);
            r.alpha = 0.55 + 0.45 * puls;
          }
          var r2 = tenir(s.p[1], lieuBoss);
          if (r2) {
            r2.type = RT_VRILLE; r2.style = R_ENERGIE; r2.A = s.ancre; r2.B = A_POITRINE; r2.larg = 0.07; r2.amp = 0.22; r2.freq = 3.2; r2.vit = 10; r2.arche = 0.3; r2.croissance = cr;
            (KC[0] = 0.9 + 0.5 * puls, r2.r = COUL_LIEN[0] * KC[0], r2.g = COUL_LIEN[1] * KC[0], r2.b = COUL_LIEN[2] * KC[0]); r2.r2 = COUL_LIEN[0] * 1.1; r2.g2 = COUL_LIEN[1] * 1.1; r2.b2 = COUL_LIEN[2] * 1.1; r2.alpha = 0.8;
          }
          var hA = tenir(s.p[2], lieuBoss);
          if (hA) { hA.motif = H_LUEUR; hA.x = px; hA.y = py; hA.z = pz; hA.sx = hA.sy = 0.45 + 0.15 * puls; hA.tirer = 0.15; couleur(hA, c, 1); hA.i = 0.5 + 0.4 * puls; }
          var hB = tenir(s.p[3], lieuBoss);
          if (hB) { ancre(A_POITRINE); hB.motif = H_LUEUR; hB.x = SO[0]; hB.y = SO[1]; hB.z = SO[2]; hB.sx = hB.sy = 0.32 + 0.1 * puls; hB.tirer = 0.2; couleur(hB, COUL_LIEN, 1); hB.i = 0.45 + 0.35 * puls; }
          s.lat -= dt;
          if (s.lat <= 0 && cr >= 1) { s.lat = 0.36; emettreConvDepuis(C, GAB.lien, N1, A_POITRINE, px, py, pz, 0.05, 0, 1.0, COUL_LIEN, c); }
          (LC[0] = px, LC[1] = py, LC[2] = pz, LC[3] = c[0], LC[4] = c[1], LC[5] = c[2], LC[6] = 18 + 14 * puls, LC[7] = 6, lumiereLC(C));
        }
      }
      finSuivis(SUIVI_MB);
      if (!protege) return;
      var v = tenir(PH_VOILE, lieuBoss);
      if (v) {
        var ct = typeVoile ? couleurMB(typeVoile) : (ACT && ACT.id === 'siphon' && ACT.donnees && ACT.donnees.miniBoss ? couleurMB(ACT.donnees.miniBoss) : COUL.bouclier);
        COUL_VOILE[0] = ct[0] + (1 - ct[0]) * 0.3; COUL_VOILE[1] = ct[1] + (1 - ct[1]) * 0.3; COUL_VOILE[2] = ct[2] + (1 - ct[2]) * 0.3;
        v.motif = V_BOUCLIER; v.ancre = A_CENTRE; v.sx = v.sz = 1.05; v.sy = 1.4; couleur(v, COUL_VOILE, 1); v.a = 0; v.k = 0.55; v.haut = 0;
      }
    }

    // ─────────────────────────────── v1.4 : paliers et crochets de la phase 5 (API.md §16.5, §16.7) ───────────────────────────────
    /** Évènement `palier` : 1 → les lames s'embrasent (rouge), onde ; 2 → intangibilité (v1.5 : les ombres l'avalent) ; 3 → chaînes. */
    function fxPalier(numero) {
      if (!bossVisible || !(numero >= 1)) return;
      var C = couche(lieuBoss), sy = sol(lieuBoss);
      ancre(A_CENTRE);
      var x = SO[0], y = SO[1], z = SO[2];
      if (numero === 1) {
        for (var m = 0; m < 2; m++) {
          ancre(m ? A_POINTED : A_POINTEG); var px = SO[0], py = SO[1], pz = SO[2];
          ancre(m ? A_LAMED : A_LAMEG);
          halo(C, H_ECLAT, (px + SO[0]) * 0.5, (py + SO[1]) * 0.5, (pz + SO[2]) * 0.5, 0.4, 2.2, COUL.sangVif, 2.0, 0.35, C_FLASH, 0.25);
          emettre(C, GAB.braise, 22, px, py, pz, 0, 1, 0, 1.2, COUL.chaineVif, COUL.sangVif);
          emettre(C, GAB.etincelle, 14, px, py, pz, 0, 0.5, 0, 1.0, COUL.energieClaire, COUL.sangVif);
        }
        onde(C, x, z, 7.0, 0.6, COUL.meute, 1.2, 0.9, 0.6);
        halo(C, H_ANNEAU, x, y, z, 1.4, 3.6, COUL.sangVif, 1.0, 0.5, C_ANNEAU, 0.1);
        tache(T_EMBRASEMENT, lieuBoss, 0, 0, 0, 1.3, 0, 0, 0);
        eclairLumiere(C, x, y + 0.3, z, COUL.sangVif, 420, 12, 0.6);
        secouer(0.25, 0.4, x, y, z, lieuBoss);
      } else if (numero === 2) {
        fxPalierIntangible(C, x, y, z);
      } else if (numero >= 3) {
        for (var k = 0; k < 3; k++) {
          var r = ruban(C, RT_SPIRALE, R_CHAINE, 0.075, COUL.chaine, COUL.chaine, 1.3, 1.5);
          if (r) { r.A = A_CENTRE; r.amp = 0.95 + 0.12 * k; r.freq = 1.35; r.vit = (k % 2 ? -1 : 1) * 0.9; r.graine = k * 2.1; r.p0 = -0.75 + 0.1 * k; r.p1 = 0.85 + 0.15 * k; r.maillons = 70; }
        }
        halo(C, H_ECLAT, x, y, z, 0.6, 2.6, COUL.chaineVif, 1.2, 0.35, C_FLASH, 0.2);
        emettre(C, GAB.etincelle, 20, x, y, z, 0, 0, 0, 1.3, COUL.energieClaire, COUL.chaineVif);
        eclairLumiere(C, x, y, z, COUL.chaineVif, 260, 10, 0.5);
      }
      void sy;
    }
    /** v1.5 : palier 2 — des ombres s'enroulent autour de lui et l'avalent un instant (annonce de l'intangibilité). */
    function fxPalierIntangible(C, x, y, z) {
      emettreConv(C, GAB.fumeeNoire, 30, A_CENTRE, 1.0, 2.6, -0.9, 1.5, 2.2, 1.1);
      emettre(C, GAB.ecto, 14, x, y, z, 0, 0.4, 0, 1.3);
      emettre(C, GAB.braise, 18, x, y, z, 0, 1, 0, 1.1, COUL.sangVif, COUL.rougeSombre);
      halo(C, H_ANNEAU, x, y, z, 1.3, 3.4, COUL.rougeSombre, 1.4, 0.6, C_ANNEAU, 0.1);
      halo(C, H_FUMEE, x, y + 0.1, z, 1.5, 1.5, COUL.fumee, 0.85, 0.9, C_PULSE, 0);
      onde(C, x, z, 4.2, 0.5, COUL.rougeSombre, 1.0, 0.8, 0.5);
      eclairLumiere(C, x, y + 0.4, z, COUL.rougeSombre, 260, 10, 0.6);
      var il = iLieu(lieuBoss);
      if (OSC[il] < 0.45) OSC[il] = 0.45;
    }

    // ─────────────────────────────── v1.5 : rages des mini-boss (API.md §17.1) ───────────────────────────────
    // Anti-doublon : chaque effet ponctuel passe par une transition gardée (« état vu »), appelée aussi bien par l'évènement
    // que par l'instantané ; le premier des deux déclenche, l'autre ne fait plus rien.
    var CENTRE_X = (+O.x || 0) + (AR.salle.centre ? +AR.salle.centre.x || 0 : 0), CENTRE_Z = (+O.z || 0) + (AR.salle.centre ? +AR.salle.centre.z || 0 : 0);
    var RAGES_VUES = [null, null, null, null, null, null], iRage = 0;
    function rageVue(id) { for (var i = 0; i < RAGES_VUES.length; i++) if (RAGES_VUES[i] === id) return true; return false; }
    function marquerRage(id) { RAGES_VUES[iRage] = id; iRage = (iRage + 1) % RAGES_VUES.length; }
    /** Début d'une rage : la surcharge s'allume (éclat bleu sur le Survolté, énergie arrachée au torse du Septième) ; cri de L'Irradié. */
    function fxRageDebut(cap, x, y, z) {
      var C = couche('salle'), sy = SOL_SALLE;
      if (cap === 'surcharge') {
        halo(C, H_ECLAT, x, sy + 1.4, z, 0.4, 2.4, COUL.elecVif, 2.0, 0.35, C_FLASH, 0.3);
        halo(C, H_ANNEAU, x, sy + 1.3, z, 1.0, 2.6, COUL.surcharge, 1.2, 0.45, C_ANNEAU, 0.1);
        emettre(C, GAB.etincelle, 26, x, sy + 1.4, z, 0, 0.5, 0, 1.2, COUL.elecVif, COUL.elec);
        onde(C, x, z, 3.2, 0.35, COUL.elec, 1.0, 0.45, 0.3);
        eclairLumiere(C, x, sy + 1.5, z, COUL.elecVif, 320, 11, 0.4);
        if (BOSS && BOSS.position && lieuBoss === 'salle') {
          ancre(A_POITRINE);
          halo(C, H_ECLAT, SO[0], SO[1], SO[2], 0.3, 1.6, COUL.surcharge, 1.6, 0.3, C_FLASH, 0.3);
          emettre(C, GAB.etincelle, 14, SO[0], SO[1], SO[2], 0, 0, 0, 0.9, COUL.elecVif, COUL.elec);
          eclair(C, SO[0], SO[1], SO[2], x, sy + 1.35, z, 0.12, COUL.elecVif, 2.6, 0.22, 0.05);
        }
        secouer(0.2, 0.3, x, sy + 1, z, 'salle');
      } else if (cap === 'infection') {
        halo(C, H_ECLAT, x, sy + 1.3, z, 0.4, 2.0, COUL.infectionClaire, 1.5, 0.3, C_FLASH, 0.25);
        onde(C, x, z, 3.0, 0.4, COUL.infection, 1.0, 0.5, 0.3);
        emettre(C, GAB.brumeVerte, 8, x, sy + 1.0, z, 0, 1, 0, 1.2);
        eclairLumiere(C, x, sy + 1.3, z, COUL.infection, 220, 9, 0.4);
      }
    }
    // surcharge du Survolté (instantané : miniBoss[i].rage { capacite: 'surcharge', actif: false }) : rayon d'énergie du torse du
    // Septième à la poitrine du Survolté, arcs qui serpentent autour, pulsations qui filent vers lui, Survolté illuminé
    var SV = new Float64Array(8);                        // 0 arcs du Survolté, 1 arcs du torse, 2 particules, 3 étincelles, 4..6 poitrine du Survolté, 7 connue
    var PH_SURCH = { rayon: poignee('vrille', 0.3), coeur: poignee('vrille', 0.3), arc1: poignee('vrille', 0.12), arc2: poignee('vrille', 0.12),
      hS: poignee('halo', 0.45), hS2: poignee('halo', 0.35), sS: poignee('sol', 0.6), hT: poignee('halo', 0.3), hT2: poignee('halo', 0.3) };
    var PH_PULSES = [poignee('halo', 0.12), poignee('halo', 0.12), poignee('halo', 0.12), poignee('halo', 0.12)];
    function contSurcharge(dt, mb) {
      var C = couche('salle'), t = nombre(mb.rage.t, 0), k = t / T_SURCHARGE;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      var px = mb.position.x, py = mb.position.y + 1.3, pz = mb.position.z;
      (ANC[A_SURV * 3] = px, ANC[A_SURV * 3 + 1] = py, ANC[A_SURV * 3 + 2] = pz, ANC_T[A_SURV] = trame);
      var fl = 0.85 + 0.15 * (ali() * K_ALEA), puls = 0.5 + 0.5 * Math.sin(HORLOGE[0] * 13);
      ancre(A_POITRINE);                                   // torse du Septième (modèle, sinon sa position + hauteur du torse)
      var sx = SO[0], sy = SO[1], sz = SO[2];
      var cr = t / 0.22; cr = cr > 1 ? 1 : cr;             // le rayon jaillit du torse en 0,22 s
      var r = tenir(PH_SURCH.rayon, 'salle');
      if (r) {
        r.type = RT_RAYON; r.style = R_ENERGIE; r.A = A_POITRINE; r.B = A_SURV; r.larg = 0.34 + 0.36 * k; r.amp = 0.05 + 0.04 * k; r.freq = 1.3; r.vit = 9; r.arche = 0; r.croissance = cr;
        (KC[0] = (0.8 + 0.7 * k) * fl, r.r = COUL.surcharge[0] * KC[0], r.g = COUL.surcharge[1] * KC[0], r.b = COUL.surcharge[2] * KC[0]);
        (KC[0] = 1.0 + 0.6 * k, r.r2 = COUL.elecVif[0] * KC[0], r.g2 = COUL.elecVif[1] * KC[0], r.b2 = COUL.elecVif[2] * KC[0]); r.alpha = 1;
      }
      var c = tenir(PH_SURCH.coeur, 'salle');
      if (c) {
        c.type = RT_RAYON; c.style = R_ECLAIR; c.A = A_POITRINE; c.B = A_SURV; c.larg = 0.09 + 0.07 * k; c.amp = 0.015; c.freq = 2; c.vit = 14; c.arche = 0; c.croissance = cr;
        (KC[0] = 1.2 + 0.8 * k, c.r = COUL.elecVif[0] * KC[0], c.g = COUL.elecVif[1] * KC[0], c.b = COUL.elecVif[2] * KC[0]); c.r2 = c.r; c.g2 = c.g; c.b2 = c.b; c.alpha = 1;
      }
      for (var a = 0; a < 2; a++) {                        // arcs qui serpentent autour du rayon
        if (a === 1 && nomQualite === 'basse') break;
        var e = tenir(a ? PH_SURCH.arc2 : PH_SURCH.arc1, 'salle');
        if (!e) continue;
        e.type = RT_ECLAIR; e.style = R_ECLAIR; e.A = A_POITRINE; e.B = A_SURV; e.larg = 0.045 + 0.02 * k; e.amp = 0.035 + 0.025 * k; e.regen = 0.04 + 0.02 * a; e.croissance = 1;
        (KC[0] = 1.5 + 0.8 * k, e.r = COUL.elecVif[0] * KC[0], e.g = COUL.elecVif[1] * KC[0], e.b = COUL.elecVif[2] * KC[0]); e.r2 = e.r; e.g2 = e.g; e.b2 = e.b; e.alpha = cr;
      }
      for (var q = 0; q < PH_PULSES.length; q++) {         // pulsations qui filent du torse vers le Survolté
        if (q >= 2 && nomQualite === 'basse') break;
        var u = (HORLOGE[0] * 1.5 + q / PH_PULSES.length) % 1, h = tenir(PH_PULSES[q], 'salle');
        if (!h) continue;
        var su = Math.sin(PI * u);
        h.motif = H_ORBE; h.x = sx + (px - sx) * u; h.y = sy + (py - sy) * u; h.z = sz + (pz - sz) * u;
        h.sx = h.sy = 0.18 + 0.24 * su + 0.1 * k; h.tirer = 0.1; couleur(h, COUL.surcharge, 1); h.i = (0.7 + 1.1 * k) * Math.sqrt(su) * (u <= cr ? 1 : 0);
      }
      SV[2] += dt * (30 + 60 * k) * Q.densite;             // énergie arrachée au Septième, qui file vers le Survolté
      while (SV[2] >= 1) {
        SV[2] -= 1;
        uniteAlea();
        EA[0] = sx + SO[3] * 0.25; EA[1] = sy + SO[4] * 0.25; EA[2] = sz + SO[5] * 0.25; EA[6] = 1; EA[8] = 0.12; EA[9] = 0;
        emettreConvDepuisEA(C, GAB.convergence, 1, A_SURV, COUL.elecVif, COUL.surcharge);
      }
      var hS = tenir(PH_SURCH.hS, 'salle');                // le Survolté s'illumine
      if (hS) { hS.motif = H_LUEUR; hS.x = px; hS.y = py; hS.z = pz; hS.sx = hS.sy = 0.8 + 1.3 * k + 0.15 * puls; hS.tirer = 0.3; couleur(hS, COUL.surcharge, 1); hS.i = (0.5 + 1.3 * k) * fl; }
      var hS2 = tenir(PH_SURCH.hS2, 'salle');
      if (hS2) { hS2.motif = H_ORBE; hS2.x = px; hS2.y = py; hS2.z = pz; hS2.sx = hS2.sy = 0.2 + 0.3 * k; hS2.tirer = 0.35; couleur(hS2, COUL.elecVif, 1); hS2.i = (1.0 + 1.4 * k) * fl; }
      var sS = tenir(PH_SURCH.sS, 'salle');
      if (sS) { sS.motif = S_LUEUR; sS.x = px; sS.z = pz; sS.y = SOL_SALLE + 0.02; sS.hx = sS.hz = 1.6 + 1.2 * k; couleur(sS, COUL.elec, 1); sS.a = (0.3 + 0.5 * k) * fl; sS.p0 = 0.6; }
      var hT = tenir(PH_SURCH.hT, 'salle');                // torse du Septième : l'énergie lui est arrachée
      if (hT) { hT.motif = H_ORBE; hT.x = sx; hT.y = sy; hT.z = sz; hT.sx = hT.sy = 0.16 + 0.14 * k; hT.tirer = 0.3; couleur(hT, COUL.surcharge, 1); hT.i = (0.9 + 0.7 * k) * fl; }
      var hT2 = tenir(PH_SURCH.hT2, 'salle');
      if (hT2) { hT2.motif = H_LUEUR; hT2.x = sx; hT2.y = sy; hT2.z = sz; hT2.sx = hT2.sy = 0.6 + 0.5 * k; hT2.tirer = 0.3; couleur(hT2, COUL.elec, 1); hT2.i = 0.4 + 0.5 * k; }
      SV[0] -= dt;
      if (SV[0] <= 0) {                                    // crépitements autour du Survolté
        SV[0] = entre(0.06, 0.14) / (0.6 + 0.6 * k);
        uniteAlea();
        var dd = entre(0.5, 1.2) * (0.8 + 0.4 * k);
        var ex = eclair(C, px, py, pz, px + SO[3] * dd, py + SO[4] * dd * 0.8, pz + SO[5] * dd, 0.035, COUL.elecVif, 2.2, entre(0.07, 0.13), 0.22);
        if (ex) ex.A = A_SURV;
      }
      SV[1] -= dt;
      if (SV[1] <= 0) {                                    // et autour du torse du Septième
        SV[1] = entre(0.18, 0.35);
        uniteAlea();
        var de = entre(0.35, 0.8);
        var et = eclair(C, sx, sy, sz, sx + SO[3] * de, sy + SO[4] * de, sz + SO[5] * de, 0.03, COUL.surcharge, 1.8, entre(0.07, 0.12), 0.2);
        if (et) et.A = A_POITRINE;
      }
      SV[3] += dt * 14 * k * Q.densite;
      while (SV[3] >= 1) {
        SV[3] -= 1; uniteAlea();
        EA[0] = px + SO[3] * 0.35; EA[1] = py + SO[4] * 0.5; EA[2] = pz + SO[5] * 0.35; EA[3] = SO[3]; EA[4] = 0.2; EA[5] = SO[5]; EA[6] = 0.6; EA[7] = NaN;
        emettreEA(C, GAB.etincelle, 1, COUL.elecVif, COUL.elec);
      }
      (LC[0] = px, LC[1] = py, LC[2] = pz, LC[3] = COUL.surcharge[0], LC[4] = COUL.surcharge[1], LC[5] = COUL.surcharge[2], LC[6] = (50 + 260 * k) * fl, LC[7] = 11, lumiereLC(C));
      (LC[0] = sx, LC[1] = sy, LC[2] = sz, LC[3] = COUL.elec[0], LC[4] = COUL.elec[1], LC[5] = COUL.elec[2], LC[6] = 30 + 70 * k, LC[7] = 8, lumiereLC(C));
    }
    // cri de L'Irradié (rage 'infection', vulnérable, `duree` s) : il se gorge de lueur verte, anneaux au sol
    var PH_CRI = [poignee('halo', 0.3), poignee('sol', 0.4)];
    var CR = new Float64Array(2);
    function contCri(dt, mb) {
      var C = couche('salle'), t = nombre(mb.rage.t, 0), k = t / T_CRI;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      var px = mb.position.x, py = mb.position.y + 1.2, pz = mb.position.z;
      (ANC[A_IRR * 3] = px, ANC[A_IRR * 3 + 1] = py, ANC[A_IRR * 3 + 2] = pz, ANC_T[A_IRR] = trame);
      var h = tenir(PH_CRI[0], 'salle');
      if (h) { h.motif = H_LUEUR; h.x = px; h.y = py; h.z = pz; h.sx = h.sy = 0.8 + 1.0 * k; h.tirer = 0.3; couleur(h, COUL.infection, 1); h.i = (0.5 + 0.9 * k) * (0.8 + 0.2 * Math.sin(HORLOGE[0] * 17)); }
      var s = tenir(PH_CRI[1], 'salle');
      if (s) { s.motif = S_LUEUR; s.x = px; s.z = pz; s.y = SOL_SALLE + 0.02; s.hx = s.hz = 1.8 + 1.4 * k; couleur(s, COUL.infection, 1); s.a = 0.3 + 0.4 * k; s.p0 = 0.7; }
      CR[0] -= dt;
      if (CR[0] <= 0) { CR[0] = 0.28; onde(C, px, pz, 2.6 + 1.6 * k, 0.32, COUL.infection, 0.7 + 0.4 * k, 0.45, 0.1); }
      CR[1] += dt * 50 * Q.densite;
      while (CR[1] >= 1) { CR[1] -= 1; emettreConv(C, GAB.lueurVerte, N1, A_IRR, 0.8, 2.4, -1.0, 1.0, 2.0, 1.0); }
      (LC[0] = px, LC[1] = py, LC[2] = pz, LC[3] = COUL.infection[0], LC[4] = COUL.infection[1], LC[5] = COUL.infection[2], LC[6] = 40 + 120 * k, LC[7] = 9, lumiereLC(C));
    }
    /** Rages en cours (instantané) : surcharge, cri ; début de rage s'il n'a pas déjà été montré par l'évènement. */
    function majRages(dt, E) {
      var L = E.miniBoss, surch = null, cri = null;
      INF[3] = 0;
      if (L && L.length) {
        for (var i = 0; i < L.length; i++) {
          var mb = L[i];
          if (!mb || mb.etat !== 'actif' || !mb.position || !mb.rage) continue;
          var rg = mb.rage;
          if (!rageVue(mb.id)) { marquerRage(mb.id); if (nombre(rg.t, 0) < 0.4) fxRageDebut(rg.capacite, mb.position.x, mb.position.y, mb.position.z); }
          if (rg.capacite === 'surcharge') { SV[4] = mb.position.x; SV[5] = mb.position.y + 1.3; SV[6] = mb.position.z; SV[7] = 1; if (!rg.actif) surch = mb; }
          else if (rg.capacite === 'infection') { INF[0] = mb.position.x; INF[1] = mb.position.y + 1.2; INF[2] = mb.position.z; INF[3] = 1; if (!rg.actif) cri = mb; }
        }
      }
      if (surch) contSurcharge(dt, surch);
      if (cri) contCri(dt, cri);
    }

    // ─────────────────────────────── v1.5 : murs électrifiés (API.md §17.1) ───────────────────────────────
    var MURS_ETAT = 0;                                    // 0 éteints, 1 charge, 2 électrifiés, 3 extinction (état vu)
    var MU = new Float64Array(8);                         // 0 temps dans l'état, 1 éclat (déflagration), 2 allumage du liseré, 3 angle de départ (tours),
                                                          // 4 prochain éclair, 5 étincelles, 6 distance des dégâts
    var PH_MURS = [], PH_BORDS = [];
    for (var pmu = 0; pmu < MURS.length; pmu++) { PH_MURS.push(poignee('pan', 0.35)); PH_BORDS.push(poignee('pan', 0.35)); }
    var PH_LISERE = poignee('sol', 0.45);
    var ABSENTES = new Int8Array(Math.max(3, MURS.length * 3));
    function codeMurs(s) { return s === 'charge' ? 1 : s === 'electrifies' ? 2 : s === 'extinction' ? 3 : 0; }
    function transitionMurs(code) {
      if (code === MURS_ETAT) return;
      MURS_ETAT = code; MU[0] = 0;
      if (code === 1) fxMursCharge();
      else if (code === 2) fxMursDeflagration();
      else if (code === 3) fxMursExtinction();
    }
    /** Point du mur M (x le long du mur depuis son milieu, y au-dessus du sol), décalé de d m vers la salle, dans SO[0..2]. */
    function pointMur(M, x, y, d) { SO[0] = M.cx + M.tx * x - M.nx * d; SO[1] = SOL_SALLE + y; SO[2] = M.cz + M.tz * x - M.nz * d; }
    /** Éclair au hasard sur les murs : le long d'un mur, de la bordure du plafond vers une dalle, ou d'un mur à l'autre par l'angle. */
    function eclairMur(C, fort) {
      if (!MURS.length) return null;
      var M = MURS[Math.floor((ali() * K_ALEA) * MURS.length) % MURS.length], typ = ali() * K_ALEA, M2 = M, x1, y1, x2, y2;
      if (typ < 0.5) {
        x1 = entre(-M.hw + 0.6, M.hw - 0.6); y1 = entre(0.5, HAUT - 1.0);
        var lg = entre(1.4, 4.0) * (fort ? 1.3 : 1);
        x2 = clamp(x1 + (ali() < 8388608 ? -lg : lg), -M.hw + 0.3, M.hw - 0.3); y2 = clamp(y1 + entre(-1.3, 1.3), 0.3, HAUT - 0.4);
      } else if (typ < 0.78) {
        x1 = entre(-M.hw + 0.6, M.hw - 0.6); y1 = HAUT - 0.25; x2 = x1 + entre(-1.0, 1.0); y2 = M.dy + HAUT / 2 + M.dh / 2 + entre(-0.6, 0.3);
      } else {
        M2 = MURS[(M.i + 1) % MURS.length];
        x1 = M.hw - entre(0.3, 1.6); y1 = entre(1.0, HAUT - 1.5); x2 = -M2.hw + entre(0.3, 1.6); y2 = y1 + entre(-1.0, 1.0);
      }
      pointMur(M, x1, y1, 0.07); var ax = SO[0], ay = SO[1], az = SO[2];
      pointMur(M2, x2, y2, 0.07);
      var r = eclair(C, ax, ay, az, SO[0], SO[1], SO[2], fort ? 0.085 : 0.06, (ali() * K_ALEA) < 0.35 ? COUL.elecVif : COUL.elec, fort ? 2.8 : 2.2, entre(0.1, 0.2), 0.16);
      EA[0] = SO[0]; EA[1] = SO[1]; EA[2] = SO[2]; EA[3] = -M2.nx; EA[4] = 0.2; EA[5] = -M2.nz; EA[6] = 0.7; EA[7] = NaN;
      emettreEA(C, GAB.etincelle, Math.round((fort ? 8 : 5) * Q.densite), COUL.elecVif, COUL.elec);
      eclairLumiere(C, (ax + SO[0]) * 0.5, (ay + SO[1]) * 0.5, (az + SO[2]) * 0.5, COUL.elec, fort ? 260 : 150, 9, 0.18);
      return r;
    }
    /** Charge (pendant la surcharge) : premiers crépitements sur les murs. */
    function fxMursCharge() {
      var C = couche('salle');
      MU[1] = 0.25; MU[2] = 1; MU[4] = 0.25;
      for (var i = 0; i < (nomQualite === 'basse' ? 2 : 4); i++) eclairMur(C, false);
    }
    /** Montée (`electrifies`) : déflagration — éclat de tous les murs, éclairs partout, pluie d'étincelles de la bordure du
     *  plafond, le Survolté se décharge dans les murs, le liseré s'allume depuis son côté. */
    function fxMursDeflagration() {
      var C = couche('salle'), sy = SOL_SALLE;
      MU[1] = 1; MU[2] = 0; MU[4] = 0.12;
      if (SV[7]) { var a0 = Math.atan2(-(SV[4] - CENTRE_X), SV[6] - CENTRE_Z) / TAU; MU[3] = a0 - Math.floor(a0); } else MU[3] = 0;
      var nb = nomQualite === 'basse' ? 6 : nomQualite === 'moyenne' ? 10 : 14;
      for (var i = 0; i < nb; i++) eclairMur(C, true);
      for (var m = 0; m < MURS.length; m++) {
        var M = MURS[m];
        for (var j = 0; j < (nomQualite === 'basse' ? 1 : 3); j++) {
          pointMur(M, entre(-M.hw + 0.8, M.hw - 0.8), HAUT - 0.3, 0.15);
          emettre(C, GAB.etincelle, 6, SO[0], SO[1], SO[2], -M.nx, -0.3, -M.nz, 1.0, COUL.elecVif, COUL.elec);
        }
      }
      if (SV[7]) {                                         // le Survolté décharge sa surcharge dans les murs voisins
        for (var b = 0; b < 3; b++) {
          var Mb = murProche(SV[4] + entre(-6, 6), SV[6] + entre(-6, 6));
          var xs = (SV[4] - Mb.cx) * Mb.tx + (SV[6] - Mb.cz) * Mb.tz;
          pointMur(Mb, clamp(xs + entre(-2.5, 2.5), -Mb.hw + 0.5, Mb.hw - 0.5), entre(1.5, 4.5), 0.07);
          eclair(C, SV[4], SV[5], SV[6], SO[0], SO[1], SO[2], 0.1, COUL.elecVif, 3.0, entre(0.22, 0.32), 0.12);
        }
        halo(C, H_ECLAT, SV[4], SV[5], SV[6], 0.6, 3.2, COUL.elecVif, 2.2, 0.4, C_FLASH, 0.3);
        emettre(C, GAB.etincelle, 30, SV[4], SV[5], SV[6], 0, 0.3, 0, 1.4, COUL.elecVif, COUL.elec);
      }
      eclairLumiere(C, CENTRE_X, sy + 5.5, CENTRE_Z, COUL.elecVif, 1000, 32, 0.6);
      if (!joueurLocal || !joueurLocal.lieu || joueurLocal.lieu === 'salle') ecr.flashBlanc = Math.max(ecr.flashBlanc, 0.1);
      if (OSC[0] < 0.55) OSC[0] = 0.55;
      secouer(0.35, 0.5, CENTRE_X, sy + 2, CENTRE_Z, 'salle');
    }
    /** Extinction (mort du Survolté) : dernier sursaut, étincelles, les murs grésillent et s'éteignent en `extinction` s. */
    function fxMursExtinction() {
      var C = couche('salle');
      MU[1] = 0.45;
      for (var i = 0; i < (nomQualite === 'basse' ? 3 : 6); i++) eclairMur(C, false);
      for (var m = 0; m < MURS.length; m += 2) { var M = MURS[m]; pointMur(M, entre(-M.hw + 1, M.hw - 1), HAUT - 0.3, 0.15); emettre(C, GAB.etincelle, 8, SO[0], SO[1], SO[2], -M.nx, -0.5, -M.nz, 0.9, COUL.elecVif, COUL.elec); }
      eclairLumiere(C, CENTRE_X, SOL_SALLE + 5, CENTRE_Z, COUL.elec, 400, 28, 0.35);
      if (OSC[0] < 0.35) OSC[0] = 0.35;
    }
    /** `mursChoc` : arc du mur au joueur touché ; éclat d'écran (choc électrique) pour le joueur local. */
    function fxMursChoc(d) {
      var p = d.position;
      if (!p || !MURS.length) return;
      var C = couche('salle'), local = !!(joueurLocal && d.joueur === joueurLocal.id);
      var pj = positionJoueurCtx(d.joueur) || p, M = (d.mur && MUR_PAR_ID[d.mur]) || murProche(pj.x, pj.z);
      var xs = clamp((pj.x - M.cx) * M.tx + (pj.z - M.cz) * M.tz, -M.hw + 0.4, M.hw - 0.4);
      pointMur(M, xs + entre(-0.6, 0.6), entre(1.3, 2.6), 0.07);
      var wx = SO[0], wy = SO[1], wz = SO[2], tx = pj.x, ty = pj.y + (local ? 0.95 : 1.1), tz = pj.z;
      eclair(C, wx, wy, wz, tx, ty, tz, 0.09, COUL.elecVif, 3.0, 0.24, 0.13);
      eclair(C, wx, wy, wz, tx, ty - 0.2, tz, 0.05, COUL.elec, 2.4, 0.17, 0.2);
      if (nomQualite !== 'basse') { pointMur(M, xs + entre(-1.5, 1.5), entre(0.6, 3.2), 0.07); eclair(C, SO[0], SO[1], SO[2], tx, ty + 0.1, tz, 0.04, COUL.elecVif, 2.0, 0.13, 0.22); }
      halo(C, H_ECLAT, wx, wy, wz, 0.3, local ? 0.9 : 1.5, COUL.elecVif, local ? 1.1 : 1.8, 0.25, C_FLASH, 0.15);
      emettre(C, GAB.etincelle, 10, wx, wy, wz, -M.nx, 0.2, -M.nz, 0.8, COUL.elecVif, COUL.elec);
      if (!local) { halo(C, H_ECLAT, tx, ty, tz, 0.25, 1.1, COUL.elecVif, 1.5, 0.2, C_FLASH, 0.2); emettre(C, GAB.etincelle, 14, tx, ty, tz, 0, 0.3, 0, 0.9, COUL.elecVif, COUL.elec); }
      eclairLumiere(C, (wx + tx) * 0.5, (wy + ty) * 0.5, (wz + tz) * 0.5, COUL.elecVif, local ? 150 : 260, 9, 0.25);
      if (local) { ecr.choc = 1; secouer(0.3, 0.3, tx, ty, tz, 'salle'); }
    }
    /** Murs (instantané etat().murs) : 8 pans électrifiés, bordure du plafond, liseré au sol à `distance` m des murs,
     *  éclairs au hasard, étincelles ; charge, électrifiés, extinction. */
    function majMurs(dt, E) {
      var Mt = E.murs, code = Mt ? codeMurs(Mt.etat) : 0;
      if (code !== MURS_ETAT) transitionMurs(code);
      if (MURS_ETAT === 0 || !MURS.length) return;
      var C = couche('salle');
      MU[0] += dt;
      if (Mt && Mt.distance > 0) MU[6] = Mt.distance; else if (!(MU[6] > 0)) MU[6] = MURS_DISTANCE;
      var t = MU[0], k = MURS_ETAT === 1 ? 0.1 + 0.5 * lisse(0, T_SURCHARGE, t) : MURS_ETAT === 2 ? 1 : 1 - lisse(0, MURS_EXTINCTION, t);
      // scintillement : petites baisses au hasard, fortes pendant l'extinction
      var flick = MURS_ETAT === 3 ? ((ali() * K_ALEA) < 0.35 ? 0.15 : 1) : 0.88 + 0.12 * (ali() * K_ALEA);
      MU[1] = MU[1] > dt * 1.7 ? MU[1] - dt * 1.7 : 0;
      if (MURS_ETAT === 2 && MU[2] < 1) MU[2] = MU[2] + dt * 2 > 1 ? 1 : MU[2] + dt * 2;
      // dalles absentes (arrachées en phase 3) : pas de lueur
      for (var a = 0; a < ABSENTES.length; a++) ABSENTES[a] = 0;
      var BL = E.blocs;
      if (BL) for (var b = 0; b < BL.length; b++) { var bl = BL[b]; if (bl && bl.etat !== 'fissure') { var sl = DALLE_SLOT[bl.id]; if (sl !== undefined) ABSENTES[sl] = 1; } }
      for (var i = 0; i < MURS.length; i++) {
        var M = MURS[i], s = tenir(PH_MURS[i], 'salle');
        if (s) {
          s.motif = PN_MUR; s.x = M.cx - M.nx * 0.02; s.y = SOL_SALLE + HAUT / 2; s.z = M.cz - M.nz * 0.02; s.hx = M.hw; s.hz = HAUT / 2; s.ang = M.ang;
          couleur(s, COUL.elec, 1); s.a = 1; s.p0 = k; s.p1 = MU[1]; s.p2 = i * 0.137 + 0.05; s.p3 = flick;
          s.q0 = ABSENTES[i * 3] ? 999 : M.o[0]; s.q1 = ABSENTES[i * 3 + 1] ? 999 : M.o[1]; s.q2 = ABSENTES[i * 3 + 2] ? 999 : M.o[2]; s.q3 = 3;
          s.w0 = M.dl; s.w1 = M.dh; s.w2 = M.dy; s.w3 = 0;
        }
        if (Q.bordures) {
          var bo = tenir(PH_BORDS[i], 'salle');
          if (bo) {
            bo.motif = PN_BORD; bo.x = M.cx - M.nx * 0.24; bo.y = SOL_SALLE + HAUT - 0.32; bo.z = M.cz - M.nz * 0.24; bo.hx = M.hw * (FACADE - 0.24) / FACADE; bo.hz = 0.36; bo.ang = M.ang;
            couleur(bo, COUL.elec, 1); bo.a = 1; bo.p0 = k; bo.p1 = MU[1]; bo.p2 = i * 0.211 + 0.3; bo.p3 = flick;
          }
        }
      }
      var li = tenir(PH_LISERE, 'salle');                  // liseré au sol : la limite du danger
      if (li) {
        li.motif = S_LISERE; li.x = (+O.x || 0); li.z = (+O.z || 0); li.y = SOL_SALLE + 0.022; li.hx = li.hz = FACADE + 0.2; li.ang = 0;
        couleur(li, COUL.elec, 1);
        li.a = MURS_ETAT === 1 ? (0.25 + 0.5 * lisse(0, T_SURCHARGE, t)) * (0.55 + 0.45 * Math.sin(HORLOGE[0] * 11)) : MURS_ETAT === 2 ? 1 + 0.6 * MU[1] : k * flick;
        li.p0 = APO - MU[6]; li.p1 = FACADE; li.p2 = MURS_ETAT === 2 ? MU[2] : 1; li.p3 = MU[3]; li.q0 = MURS_ETAT === 2 ? 0.3 : 1;
      }
      MU[4] -= dt;                                         // éclairs au hasard
      if (MU[4] <= 0) {
        var base = MURS_ETAT === 2 ? 0.16 : MURS_ETAT === 1 ? 0.35 + 0.4 * (1 - k) : 0.25;
        MU[4] = base * entre(0.6, 1.5) / (nomQualite === 'basse' ? 0.55 : nomQualite === 'moyenne' ? 0.8 : 1);
        if (MURS_ETAT !== 3 || (ali() * K_ALEA) < k) eclairMur(C, false);
      }
      MU[5] += dt * (MURS_ETAT === 2 ? 22 : 7) * k * Q.densite;   // étincelles qui tombent de la bordure et du haut des dalles
      while (MU[5] >= 1) {
        MU[5] -= 1;
        var Ms = MURS[Math.floor((ali() * K_ALEA) * MURS.length) % MURS.length], bord = (ali() * K_ALEA) < 0.55;
        var xs = entre(-Ms.hw + 0.4, Ms.hw - 0.4), ys = HAUT - 0.3;
        if (!bord) { var jd = Math.floor((ali() * K_ALEA) * 3) % 3; if (Ms.o[jd] !== 999) { xs = Ms.o[jd] + entre(-0.5, 0.5) * Ms.dl; ys = Ms.dy + HAUT / 2 + Ms.dh / 2; } }
        EA[0] = Ms.cx + Ms.tx * xs - Ms.nx * 0.1; EA[1] = SOL_SALLE + ys; EA[2] = Ms.cz + Ms.tz * xs - Ms.nz * 0.1;
        EA[3] = -Ms.nx * 0.6; EA[4] = -0.2; EA[5] = -Ms.nz * 0.6; EA[6] = 0.55; EA[7] = NaN;
        emettreEA(C, GAB.etincelle, 1, COUL.elecVif, COUL.elec);
      }
      // lumière froide qui baigne la salle (les éclairs ont leurs lumières brèves)
      (LC[0] = CENTRE_X, LC[1] = SOL_SALLE + HAUT * 0.7, LC[2] = CENTRE_Z, LC[3] = COUL.elec[0], LC[4] = COUL.elec[1], LC[5] = COUL.elec[2], LC[6] = (35 * k + 500 * MU[1]) * flick, LC[7] = APO * 2.2, lumiereLC(C));
    }

    // ─────────────────────────────── v1.5 : infection de L'Irradié (API.md §17.1) ───────────────────────────────
    var INF = new Float64Array(6);                        // 0..2 poitrine de L'Irradié, 3 connue, 4 temps depuis la vague
    var INF_ETAT = 0;                                     // 1 : infection active, vague lancée (garde : évènement et instantané)
    var NB_COM = Q.irradies;
    var COM_ID = [], COM_E = new Int8Array(NB_COM), COM_F = new Float64Array(NB_COM * 12), PH_COM = [];
    for (var icm = 0; icm < NB_COM; icm++) { COM_ID.push(null); PH_COM.push(poignee('halo', 0.12)); }
    var SUIVI_IRR = creerSuivis(Q.irradies, ['sol']);
    function positionZombieSure(id) {
      if (!monde || typeof monde.positionZombie !== 'function') return null;
      var q = null;
      try { q = monde.positionZombie(id); } catch (e) { q = null; }
      return q && isFinite(q.x) && isFinite(q.z) ? q : null;
    }
    /** Comète verte de (x, y, z) vers le zombie id (suit le zombie ; COM_F : départ, âge, retard, durée, cible, flèche, accumulateur). */
    function lancerComete(id, x, y, z, retard) {
      var q = positionZombieSure(id);
      if (!q) return;
      for (var c = 0; c < NB_COM; c++) {
        if (COM_E[c] !== 0) continue;
        var o = c * 12, dx = q.x - x, dz = q.z - z, d = Math.sqrt(dx * dx + dz * dz);
        COM_ID[c] = id; COM_E[c] = 1;
        COM_F[o] = x; COM_F[o + 1] = y; COM_F[o + 2] = z; COM_F[o + 3] = 0; COM_F[o + 4] = retard + d * 0.012;
        COM_F[o + 5] = clamp(0.3 + d / 15, 0.35, 1.4); COM_F[o + 6] = q.x; COM_F[o + 7] = q.y + 1.0; COM_F[o + 8] = q.z;
        COM_F[o + 9] = 0.8 + 0.12 * d; COM_F[o + 10] = 0; COM_F[o + 11] = ali() * K_ALEA;
        return;
      }
    }
    /** L'infection se déclenche : onde verte qui part de L'Irradié, une comète vers chaque zombie irradié (infection.ids). */
    function fxInfectionVague(ids) {
      var C = couche('salle'), x = INF[3] ? INF[0] : CENTRE_X, y = INF[3] ? INF[1] : SOL_SALLE + 1.2, z = INF[3] ? INF[2] : CENTRE_Z, rmax = 4;
      if (ids) for (var i = 0; i < ids.length; i++) { var q = positionZombieSure(ids[i]); if (q) { var d = Math.sqrt((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z)); if (d > rmax) rmax = d; } }
      rmax = Math.min(rmax + 1.5, APO * 2);
      onde(C, x, z, rmax, 0.9, COUL.infection, 1.5, clamp(rmax / 15, 0.5, 1.4), 0.4);
      onde(C, x, z, rmax * 0.6, 0.5, COUL.infectionClaire, 0.9, clamp(rmax / 22, 0.35, 0.9), 0.1);
      halo(C, H_ECLAT, x, y, z, 0.6, 3.4, COUL.infectionClaire, 2.0, 0.4, C_FLASH, 0.3);
      halo(C, H_ANNEAU, x, y, z, 1.5, 4.5, COUL.infection, 1.2, 0.55, C_ANNEAU, 0.1);
      emettre(C, GAB.brumeVerte, 14, x, y - 0.4, z, 0, 0.5, 0, 1.6);
      emettre(C, GAB.etincelle, 24, x, y, z, 0, 0.4, 0, 1.3, COUL.infectionClaire, COUL.infection);
      emettreAnneau(C, GAB.etincelle, 20, x, SOL_SALLE + 0.1, z, 0.8, 6, 1.0, COUL.infectionClaire, COUL.infection);
      eclairLumiere(C, x, y, z, COUL.infection, 600, 20, 0.6);
      INF[4] = 0;
      if (ids) for (var j = 0; j < ids.length; j++) lancerComete(ids[j], x, y + 0.2, z, (ali() * K_ALEA) * 0.12);
      secouer(0.15, 0.3, x, y, z, 'salle');
    }
    /** Infection (instantané etat().infection) : vague au passage à `active` (une fois), comètes, lueur verte au sol sous
     *  chaque entité irradiée (monde.positionZombie), comète propre pour celles irradiées plus tard. */
    function majInfection(dt, E) {
      var I = E.infection, active = !!(I && I.active);
      if (active && INF_ETAT === 0) { INF_ETAT = 1; fxInfectionVague(I.ids); }
      else if (!active && INF_ETAT === 1) INF_ETAT = 0;
      INF[4] += dt;
      var C = couche('salle');
      for (var c = 0; c < NB_COM; c++) {
        if (COM_E[c] === 0) continue;
        var o = c * 12;
        COM_F[o + 3] += dt;
        var tt = COM_F[o + 3] - COM_F[o + 4];
        if (tt < 0) continue;
        var q = positionZombieSure(COM_ID[c]);
        if (q) { COM_F[o + 6] = q.x; COM_F[o + 7] = q.y + 1.0; COM_F[o + 8] = q.z; }
        var u = tt / COM_F[o + 5], tx = COM_F[o + 6], ty = COM_F[o + 7], tz = COM_F[o + 8];
        if (u >= 1) {                                      // arrivée : petit éclat vert sur le zombie
          COM_E[c] = 0; COM_ID[c] = null;
          halo(C, H_ECLAT, tx, ty, tz, 0.25, 1.1, COUL.infectionClaire, 1.6, 0.25, C_FLASH, 0.15);
          EA[0] = tx; EA[1] = ty; EA[2] = tz; EA[3] = 0; EA[4] = 0.3; EA[5] = 0; EA[6] = 0.7; EA[7] = NaN;
          emettreEA(C, GAB.etincelle, Math.round(8 * Q.densite), COUL.infectionClaire, COUL.infection);
          onde(C, tx, tz, 1.4, 0.25, COUL.infection, 0.8, 0.35, 0);
          eclairLumiere(C, tx, ty, tz, COUL.infection, 90, 5, 0.25);
          continue;
        }
        var sx = COM_F[o], sy = COM_F[o + 1], sz = COM_F[o + 2], e = u, m = 1 - u;
        var cx = (sx + tx) * 0.5, cy = (sy > ty ? sy : ty) + COM_F[o + 9], cz = (sz + tz) * 0.5;
        var px = m * m * sx + 2 * m * e * cx + e * e * tx, py = m * m * sy + 2 * m * e * cy + e * e * ty, pz = m * m * sz + 2 * m * e * cz + e * e * tz;
        var h = tenir(PH_COM[c], 'salle');
        if (h) {
          h.motif = H_AME; h.x = px; h.y = py; h.z = pz;
          h.vx = 2 * m * (cx - sx) + 2 * e * (tx - cx); h.vy = 2 * m * (cy - sy) + 2 * e * (ty - cy); h.vz = 2 * m * (cz - sz) + 2 * e * (tz - cz);
          h.sx = 0.6; h.sy = 0.24; h.tirer = 0.1; couleur(h, COUL.infectionClaire, 1); h.i = 1.9;
        }
        COM_F[o + 10] += dt * 70 * Q.densite;
        while (COM_F[o + 10] >= 1) { COM_F[o + 10] -= 1; EA[0] = px; EA[1] = py; EA[2] = pz; EA[3] = 0; EA[4] = 0; EA[5] = 0; EA[6] = 0.8; EA[7] = NaN; emettreEA(C, GAB.infection, 1, null, null); }
      }
      if (active && I.ids && lueursIrradies) {
        var ids = I.ids;
        for (var i = 0; i < ids.length; i++) {
          var id = ids[i], s = trouverSuivi(SUIVI_IRR, id, true);
          if (!s) break;                                   // plus de place : les suivants n'ont pas de lueur
          var p = positionZombieSure(id);
          if (!p) continue;
          s.vu = true;
          if (s.etatPrec === null) { s.etatPrec = 'vu'; if (INF[4] > 0.8 && INF[3]) lancerComete(id, INF[0], INF[1] + 0.2, INF[2], 0); }   // irradié plus tard
          s.age += dt;
          var g = tenir(s.p[0], 'salle');
          if (g) {
            var kf = s.age < 0.3 ? 0 : s.age < 1.0 ? (s.age - 0.3) / 0.7 : 1;
            g.motif = S_LUEUR; g.x = p.x; g.z = p.z; g.y = SOL_SALLE + 0.025; g.hx = g.hz = AURA_IRR * 0.85; couleur(g, COUL.infection, 1);
            g.a = (0.34 + 0.1 * Math.sin(HORLOGE[0] * 3.1 + s.lat * 4)) * kf; g.p0 = 0.7;
          }
          if (nomQualite !== 'basse') {
            s.acc += dt * 2.2 * Q.densite;
            if (s.acc >= 1) {
              s.acc -= 1; var aa = (ali() * K_ALEA) * TAU, rr = AURA_IRR * 0.6 * Math.sqrt(ali() * K_ALEA);
              EA[0] = p.x + Math.cos(aa) * rr; EA[1] = SOL_SALLE + 0.1; EA[2] = p.z + Math.sin(aa) * rr; EA[3] = 0; EA[4] = 1; EA[5] = 0; EA[6] = 0.8; EA[7] = NaN;
              emettreEA(C, GAB.bulle, 1, COUL.infectionClaire, COUL.infection);
            }
          }
        }
      }
      finSuivis(SUIVI_IRR);
    }

    // ─────────────────────────────── v1.5 : bras du Démembré, petits Démembrés (API.md §17.1) ───────────────────────────────
    var BRAS_ETAT = 0;                                    // 0 aucun, 1 vol, 2 posé, 3 flétri (état vu)
    var BR = new Float64Array(12);                        // 0 temps dans l'état, 1 phase du pouls, 2 gouttes, 3 flétrissement, 4 angle, 5 graine,
                                                          // 6..8 position, 9 bulles, 10 étalement de la mare, 11 extension des veines
    var PH_BRAS = { mare: poignee('sol', 1.4), veines: poignee('sol', 1.4), trainee: poignee('trainee', 0.6) };
    var PH_TENDONS = [];
    for (var itd = 0; itd < (nomQualite === 'basse' ? 2 : nomQualite === 'moyenne' ? 3 : 4); itd++) PH_TENDONS.push(poignee('vrille', 1.0));
    function codeBras(s) { return s === 'vol' || s === 'lance' ? 1 : s === 'pose' ? 2 : s === 'fletri' ? 3 : 0; }
    function transitionBras(code, x, y, z) {
      if (code === BRAS_ETAT) return;
      var prec = BRAS_ETAT;
      BRAS_ETAT = code; BR[0] = 0;
      if (code === 1) fxBrasLance(x, y, z);
      else if (code === 2) fxBrasImpact(x, y, z);
      else if (code === 3) fxBrasFletri(x, y, z, prec);
    }
    /** Le Démembré s'arrache le bras : gerbe de sang à l'épaule (position = celle du Démembré). */
    function fxBrasArrache(x, y, z) {
      var C = couche('salle'), sy = SOL_SALLE, hy = sy + H_EPAULE * 0.95;
      emettre(C, GAB.gerbeSang, 18, x, hy, z, 0, 0.8, 0, 1.8, null, null, sy);   // (chaque goutte de sang qui touche le sol y laisse une tache)
      emettre(C, GAB.bulleSang, 60, x, hy, z, 0, 0.5, 0, 1.8);
      emettre(C, GAB.sang, 8, x, hy, z, 0, 0, 0, 1.2, null, null, sy);
      emettre(C, GAB.brumeRouge, 18, x, hy, z, 0, 0.3, 0, 2.2);
      halo(C, H_ECLAT, x, hy, z, 0.3, 2.2, COUL.sangVif, 1.6, 0.3, C_FLASH, 0.2);
      eclairLumiere(C, x, hy, z, COUL.sangVif, 160, 9, 0.35);
      secouer(0.35, 0.4, x, hy, z, 'salle');
    }
    /** Le bras est lancé (depuis l'épaule) : jet de sang dans le sens du lancer. */
    function fxBrasLance(x, y, z) {
      var C = couche('salle'), dx = CENTRE_X - x, dz = CENTRE_Z - z, l = Math.sqrt(dx * dx + dz * dz) || 1;
      emettre(C, GAB.gerbeSang, 20, x, y, z, dx / l, 0.6, dz / l, 1.3, null, null, SOL_SALLE);
      emettre(C, GAB.bulleSang, 14, x, y, z, dx / l, 0.5, dz / l, 1.2);
      emettre(C, GAB.brumeRouge, 6, x, y, z, dx / l, 0.3, dz / l, 1.4);
      BR[6] = x; BR[7] = y; BR[8] = z;
    }
    /** Le bras s'abat au centre : onde, fissures, terre et sang projetés, poussière du plafond ; la mare s'étale. */
    function fxBrasImpact(x, y, z) {
      var C = couche('salle'), sy = SOL_SALLE;
      BR[4] = (ali() * K_ALEA) * TAU; BR[5] = (ali() * K_ALEA) * 10; BR[3] = 0; BR[10] = 0; BR[11] = 0; BR[1] = 0.5;
      onde(C, x, z, 6.5, 0.8, COUL.sangVif, 1.1, 0.75, 1.6);
      onde(C, x, z, 3.5, 0.5, COUL.poussiere, 1.0, 0.5, 1.2);
      var f = solAuto(C, S_FISSURES, x, z, 2.6, COUL.sangVif, 0.95, 7, 0); if (f) f.q0 = 0.55;
      for (var i = 0; i < 5; i++) {
        var a = (ali() * K_ALEA) * TAU, r = entre(1.2, 3.4);
        var t = solAuto(C, S_TACHE, x + Math.cos(a) * r, z + Math.sin(a) * r, entre(0.35, 0.7), COUL.sangTache, 0.95, 14, 0);
        if (t) { t.y = sy + 0.013; t.q0 = 0.6; t.q1 = 0.05; t.q2 = 0.03; t.q3 = 0; }
      }
      emettreAnneau(C, GAB.poussiere, 30, x, sy + 0.1, z, 0.8, 5.5, 1.4);
      emettre(C, GAB.terre, 26, x, sy + 0.15, z, 0, 1, 0, 1.2);
      emettre(C, GAB.eclat, 12, x, sy + 0.1, z, 0, 1, 0, 0.9);
      emettre(C, GAB.gerbeSang, 14, x, sy + 0.3, z, 0, 1, 0, 1.8, null, null, sy);
      emettre(C, GAB.bulleSang, 44, x, sy + 0.3, z, 0, 1, 0, 1.7);
      emettre(C, GAB.brumeRouge, 14, x, sy + 0.4, z, 0, 0.5, 0, 1.8);
      halo(C, H_ECLAT, x, sy + 0.6, z, 0.6, 3.4, COUL.sangVif, 1.2, 0.35, C_FLASH, 0.3);
      eclairLumiere(C, x, sy + 1.0, z, COUL.sangVif, 520, 15, 0.5);
      tache(T_PLAFOND, 'salle', x, sy, z, 1.6, 0.6, 0, 0);
      secouer(0.6, 0.6, x, sy, z, 'salle');
    }
    /** Mort du Démembré : le bras se flétrit — petite gerbe sombre (s'il meurt en vol, le bras retombe déjà flétri). */
    function fxBrasFletri(x, y, z, prec) {
      var C = couche('salle'), sy = SOL_SALLE;
      if (prec === 1 || prec === 0) {
        BR[4] = (ali() * K_ALEA) * TAU; BR[5] = (ali() * K_ALEA) * 10; BR[10] = 0.6; BR[11] = 0.7; BR[3] = 0;
        emettreAnneau(C, GAB.poussiere, 16, x, sy + 0.1, z, 0.6, 3.5, 1.1);
        onde(C, x, z, 3.5, 0.5, COUL.poussiere, 0.8, 0.5, 1.0);
      }
      emettre(C, GAB.sangNoir, 18, x, sy + 0.3, z, 0, 1, 0, 1.2);
      emettre(C, GAB.fumee, 6, x, sy + 0.3, z, 0, 1, 0, 1.1, COUL.cendreSang, COUL.fumee);
      emettre(C, GAB.cendre, 10, x, sy + 0.3, z, 0, 1, 0, 1.0);
    }
    /** Bras (instantané etat().bras) : en vol, traînée et gouttes de sang ; posé, mare, veines et tendons qui palpitent au
     *  rythme d'un pouls lent ; flétri, le sang noircit, le pouls s'éteint. */
    function majBras(dt, E) {
      var Bv = E.bras, code = Bv && Bv.position ? codeBras(Bv.etat) : 0;
      if (code !== BRAS_ETAT) { if (code === 0) BRAS_ETAT = 0; else transitionBras(code, Bv.position.x, Bv.position.y, Bv.position.z); }
      if (BRAS_ETAT === 0) return;
      var C = couche('salle'), x = Bv.position.x, y = Bv.position.y, z = Bv.position.z, sy = SOL_SALLE;
      BR[0] += dt;
      if (BRAS_ETAT === 1) {
        var r = tenir(PH_BRAS.trainee, 'salle');
        if (r) { r.style = R_SOMBRE; r.larg = 0.42; couleur(r, COUL.sang, 1.4); r.r2 = COUL.sang[0]; r.g2 = COUL.sang[1]; r.b2 = COUL.sang[2]; pousserTrainee(r, x, y, z); }
        BR[2] += dt * 26 * Q.densite;
        while (BR[2] >= 1) {
          BR[2] -= 1; uniteAlea();
          EA[0] = x + SO[3] * 0.25; EA[1] = y + SO[4] * 0.2; EA[2] = z + SO[5] * 0.25; EA[3] = 0; EA[4] = -1; EA[5] = 0; EA[6] = 1; EA[7] = sy;
          var gq = ali() * K_ALEA;
          emettreEA(C, gq < 0.22 ? GAB.sang : gq < 0.85 ? GAB.bulleSang : GAB.brumeRouge, 1, null, null);
        }
        BR[6] = x; BR[7] = y; BR[8] = z;
        return;
      }
      var fletri = BRAS_ETAT === 3;
      if (fletri) BR[3] = BR[3] + dt / 2.5 > 1 ? 1 : BR[3] + dt / 2.5;
      var wv = BR[3];
      if (BR[10] < 1) BR[10] = BR[10] + dt / 1.2 > 1 ? 1 : BR[10] + dt / 1.2;
      if (BR[11] < 1) BR[11] = BR[11] + dt / 1.4 > 1 ? 1 : BR[11] + dt / 1.4;
      var etal = BR[10] * (2 - BR[10]), ext = BR[11] * (2 - BR[11]);
      BR[1] += dt * (1.1 - 0.7 * wv);
      if (BR[1] >= 1) BR[1] -= 1;
      var ph = BR[1], b1 = ph / 0.07, b2 = (ph - 0.2) / 0.07;
      var batt = (Math.exp(-b1 * b1) + 0.6 * Math.exp(-b2 * b2)) * (1 - wv);   // double battement
      var vague = ph < 0.65 ? ph / 0.65 : 0;
      if (mareBras) {
        var s = tenir(PH_BRAS.mare, 'salle');
        if (s) {
          s.motif = S_MARE; s.x = x; s.z = z; s.y = sy + 0.014; s.hx = s.hz = 2.3; s.ang = BR[4];
          s.r = 0.3; s.g = 0.012; s.b = 0.01; s.a = 0.93;
          s.p0 = etal * (1 + 0.025 * batt); s.p1 = wv * 0.85; s.p2 = BR[5]; s.p3 = vague * (1 - wv);
          s.q0 = 0.75; s.q1 = 0.1; s.q2 = 0.07;
        }
      }
      var v = tenir(PH_BRAS.veines, 'salle');
      if (v) {
        v.motif = S_VEINES; v.x = x; v.z = z; v.y = sy + 0.016; v.hx = v.hz = 3.3; v.ang = BR[4] + 0.7;
        v.r = 0.2; v.g = 0.012; v.b = 0.01; v.a = 0.9 * (1 - 0.35 * wv);
        v.p0 = ext; v.p1 = vague * (1 - wv); v.p2 = BR[5] + 3.1; v.p3 = wv;
        KC[0] = 0.5 + 0.5 * batt; v.q0 = 1.0 * KC[0]; v.q1 = 0.1 * KC[0]; v.q2 = 0.05 * KC[0];
      }
      for (var j = 0; j < PH_TENDONS.length; j++) {        // tendons : du moignon au sol, ils gonflent à chaque battement
        var td = tenir(PH_TENDONS[j], 'salle');
        if (!td) continue;
        var an = BR[4] + (j + 0.5) / PH_TENDONS.length * TAU + 0.4 * Math.sin(BR[5] + j * 1.7), rr = 1.5 + 0.8 * Math.abs(Math.sin(BR[5] * 1.3 + j * 2.1));
        td.type = RT_VRILLE; td.style = R_SOMBRE; td.A = -1; td.B = -1;
        td.ax = x + Math.cos(an) * 0.25; td.ay = sy + 0.16; td.az = z + Math.sin(an) * 0.25;
        td.bx = x + Math.cos(an) * rr; td.by = sy + 0.01; td.bz = z + Math.sin(an) * rr;
        td.larg = (0.075 + 0.035 * batt) * (1 - 0.45 * wv); td.amp = 0.05; td.freq = 1.6; td.vit = 1.5 - wv; td.arche = (0.32 + 0.07 * batt) * (1 - 0.6 * wv);
        td.croissance = ext;
        KC[0] = (0.9 + 0.9 * batt) * (1 - 0.75 * wv);
        td.r = 0.42 * KC[0]; td.g = 0.03 * KC[0]; td.b = 0.025 * KC[0]; td.r2 = td.r * 0.6; td.g2 = td.g * 0.6; td.b2 = td.b * 0.6;
        td.alpha = fletri ? 1 - 0.7 * lisse(0.6, 1, wv) : 1;
      }
      (LC[0] = x, LC[1] = sy + 0.7, LC[2] = z, LC[3] = 0.9, LC[4] = 0.06, LC[5] = 0.03, LC[6] = (14 + 55 * batt) * (1 - wv), LC[7] = 7, lumiereLC(C));
      if (!fletri && nomQualite !== 'basse') {             // bulles de sang qui crèvent à la surface
        BR[9] += dt * 3 * Q.densite;
        if (BR[9] >= 1) {
          BR[9] -= 1; var ab = (ali() * K_ALEA) * TAU, rb = Math.sqrt(ali() * K_ALEA) * 1.4 * etal;
          EA[0] = x + Math.cos(ab) * rb; EA[1] = sy + 0.05; EA[2] = z + Math.sin(ab) * rb; EA[3] = 0; EA[4] = 1; EA[5] = 0; EA[6] = 0.35; EA[7] = sy;
          emettreEA(C, GAB.bulleSang, 1, null, null);
        }
      }
    }
    // petits Démembrés : gerbe de sang et de terre là où ils sortent (évènement, sinon instantané petits + positionZombie)
    var PETITS_VUS = [], iPetit = 0;
    for (var ipv = 0; ipv < 24; ipv++) PETITS_VUS.push(null);
    function petitVu(id) { for (var i = 0; i < PETITS_VUS.length; i++) if (PETITS_VUS[i] === id) return true; return false; }
    function marquerPetit(id) { PETITS_VUS[iPetit] = id; iPetit = (iPetit + 1) % PETITS_VUS.length; }
    function fxPetitSortie(x, y, z) {
      var C = couche('salle'), sy = SOL_SALLE;
      emettre(C, GAB.terre, 16, x, sy + 0.1, z, 0, 1, 0, 1.0);
      emettre(C, GAB.eclat, 5, x, sy + 0.1, z, 0, 1, 0, 0.6);
      emettre(C, GAB.poussiere, 7, x, sy + 0.2, z, 0, 1, 0, 0.9);
      emettre(C, GAB.gerbeSang, 6, x, sy + 0.2, z, 0, 1, 0, 1.0, null, null, sy);
      emettre(C, GAB.bulleSang, 16, x, sy + 0.15, z, 0, 1, 0, 1.0);
      emettre(C, GAB.brumeRouge, 3, x, sy + 0.4, z, 0, 0.5, 0, 1.0);
      var f = solAuto(C, S_FISSURES, x, z, 0.9, COUL.sangVif, 0.85, 4.5, 0); if (f) f.q0 = 0.35;
      var t = solAuto(C, S_TACHE, x, z, 0.55, COUL.sangTache, 0.9, 9, 0); if (t) { t.y = sy + 0.013; t.q0 = 0.6; t.q1 = 0.05; t.q2 = 0.03; t.q3 = 0; }
      onde(C, x, z, 1.8, 0.3, COUL.sangVif, 0.7, 0.35, 0.8);
      eclairLumiere(C, x, sy + 0.5, z, COUL.sangVif, 90, 6, 0.3);
    }
    function fxPetitEffondrement(x, y, z) {
      var C = couche('salle'), sy = SOL_SALLE;
      emettre(C, GAB.sangNoir, 12, x, sy + 0.5, z, 0, 1, 0, 1.0);
      emettre(C, GAB.fumee, 4, x, sy + 0.4, z, 0, 1, 0, 0.9, COUL.cendreSang, COUL.fumee);
      emettre(C, GAB.cendre, 8, x, sy + 0.5, z, 0, 1, 0, 0.9);
      var t = solAuto(C, S_TACHE, x, z, 0.45, COUL.cendreSang, 0.85, 6, 0); if (t) { t.y = sy + 0.013; t.q0 = 0.1; t.q1 = 0.02; t.q2 = 0.02; t.q3 = 0; }
    }
    function majPetits(E) {
      var L = E.petits;
      if (!L || !L.length) return;
      for (var i = 0; i < L.length; i++) {
        var id = L[i];
        if (id == null || petitVu(id)) continue;
        marquerPetit(id);
        var q = positionZombieSure(id);
        if (q) fxPetitSortie(q.x, q.y, q.z);
      }
    }

    // ─────────────────────────────── v1.5 : intangibilité de la phase 5 (API.md §17.3) ───────────────────────────────
    var INTANG = false;                                   // vu intangible (garde : évènements et instantané)
    var IT = new Float64Array(9);                         // 0..2 position du boss (dernier instantané), 3 connue, 4 miroitement, 5 fumée
    var PH_INTANG = { miroir: poignee('halo', 0.25), sombre: poignee('halo', 0.3), lueur: poignee('halo', 0.25) };
    function transitionIntangible(b, x, y, z) {
      if (b === INTANG) return;
      INTANG = b;
      if (b) fxDisparition(x, y, z); else fxResurgissement(x, y, z);
    }
    /** Fin de l'évanouissement : la fumée sombre s'effondre sur elle-même et disparaît, braises. */
    function fxDisparition(x, y, z) {
      var C = couche(lieuBoss), cy = y - H_TRAQUE + 1.1;
      var ia = ancreFixe(x, cy, z);
      emettreConv(C, GAB.fumeeNoire, 22, ia, 0.5, 1.6, -0.9, 0.9, 2.4, 1.0);
      emettre(C, GAB.braise, 22, x, cy, z, 0, 1, 0, 1.2, COUL.sangVif, COUL.rougeSombre);
      emettre(C, GAB.ecto, 8, x, cy, z, 0, 0.3, 0, 1.0);
      halo(C, H_FUMEE, x, cy, z, 1.3, 0.2, COUL.fumee, 0.9, 0.45, C_FLASH, 0);
      onde(C, x, z, 2.6, 0.35, COUL.rougeSombre, 0.8, 0.45, 0.4);
      eclairLumiere(C, x, cy, z, COUL.rougeSombre, 120, 7, 0.35);
    }
    /** Resurgissement : déflagration de fumée rouge sombre, onde, braises. */
    function fxResurgissement(x, y, z) {
      var C = couche(lieuBoss), sy = sol(lieuBoss), cy = y - H_TRAQUE + 1.0;
      emettre(C, GAB.fumeeRouge, 34, x, cy, z, 0, 0.2, 0, 1.5);
      emettreAnneau(C, GAB.fumeeRouge, 16, x, sy + 0.2, z, 0.5, 3.2, 1.3);
      emettre(C, GAB.braise, 26, x, cy, z, 0, 0.5, 0, 1.4, COUL.sangVif, COUL.rougeSombre);
      emettre(C, GAB.ecto, 8, x, cy, z, 0, 0.4, 0, 1.2);
      halo(C, H_ECLAT, x, cy, z, 0.5, 2.8, COUL.rougeSombre, 1.8, 0.35, C_FLASH, 0.2);
      halo(C, H_ANNEAU, x, cy, z, 1.2, 3.6, COUL.sangVif, 0.9, 0.45, C_ANNEAU, 0.1);
      onde(C, x, z, 4.5, 0.6, COUL.rougeSombre, 1.2, 0.6, 1.0);
      eclairLumiere(C, x, cy, z, COUL.sangVif, 320, 10, 0.45);
      secouer(0.35, 0.4, x, cy, z, lieuBoss);
    }
    /** Ondulation de la pierre d'un mur traversé (n : normale de la face, d : sens de la course) : panneau, poussière,
     *  ectoplasme sombre, petits éclats. */
    function ondulation(C, x, y, z, nx, nz, dx, dz, inten) {
      var cosi = Math.abs(dx * nx + dz * nz), et = cosi > 0.45 ? 1 / cosi : 2.2;
      if (et > 2.2) et = 2.2;
      var s = prendre(C.pans);
      if (s) {
        s.motif = PN_ONDULATION; s.x = x + nx * 0.025; s.y = y; s.z = z + nz * 0.025; s.ang = Math.atan2(nx, nz);
        s.hx = 1.45 * et; s.hz = 1.45; s.vie = 1.6;
        s.r = COUL.ecto[0]; s.g = COUL.ecto[1]; s.b = COUL.ecto[2]; s.a = 1;
        s.p0 = 0; s.p1 = inten; s.p2 = (ali() * K_ALEA) * 10; s.p3 = et;
        s.q0 = s.q1 = s.q2 = s.q3 = 0; s.w0 = s.w1 = s.w2 = s.w3 = 0;
      }
      emettre(C, GAB.poussiere, 9 * inten, x + nx * 0.2, y, z + nz * 0.2, nx, 0.1, nz, 0.9);
      emettre(C, GAB.filet, 6 * inten, x + nx * 0.15, y + 0.7, z + nz * 0.15, 0, -1, 0, 0.9);
      emettre(C, GAB.eclat, 5 * inten, x + nx * 0.1, y, z + nz * 0.1, nx, 0.3, nz, 0.5);
      emettre(C, GAB.ecto, 12 * inten, x + nx * 0.2, y, z + nz * 0.2, nx + dx * 0.4, 0.15, nz + dz * 0.4, 1.1);
      halo(C, H_FUMEE, x + nx * 0.35, y, z + nz * 0.35, 0.6, 1.5, COUL.poussiere, 0.55 * inten, 1.0, C_FLASH, 0);
      eclairLumiere(C, x + nx * 0.55, y + 0.2, z + nz * 0.55, COUL.ectoVif, 200 * inten, 5, 0.6);   // éclaire la pierre autour (dans le noir aussi)
      secouer(0.12 * inten, 0.3, x, y, z, C.nom);
    }
    /** `intangible traversee` (position du boss dans le mur) : ondulation au point d'entrée (monde.tir le long de sa course,
     *  sinon face à elle) et, si monde.tir trouve l'autre face, une seconde quand il en ressort. */
    function fxTraversee(x, y, z) {
      var lieu = lieuBoss === 'salle' ? 'salle' : 'bunker', C = couche(lieu), hy = y - H_TRAQUE + 1.15, dx = 0, dz = 0;
      if (IT[3]) { var ddx = x - IT[0], ddz = z - IT[2], ll = Math.sqrt(ddx * ddx + ddz * ddz); if (ll > 0.01) { dx = ddx / ll; dz = ddz / ll; } }
      if (dx === 0 && dz === 0 && BOSS && isFinite(+BOSS.lacet)) { dx = Math.sin(+BOSS.lacet); dz = Math.cos(+BOSS.lacet); }
      if (dx === 0 && dz === 0) dz = 1;
      // sans monde.tir (ou sans face trouvée) : la face d'entrée est entre sa position précédente (hors du mur) et celle-ci
      var nx = -dx, nz = -dz, px = x - dx * 0.12, pz = z - dz * 0.12, trouve = false;
      if (IT[3] && (x - IT[0]) * (x - IT[0]) + (z - IT[2]) * (z - IT[2]) < 0.25) { px = IT[0] - dx * 0.02; pz = IT[2] - dz * 0.02; }
      if (monde && typeof monde.tir === 'function') {
        var h = null;
        try { h = monde.tir(lieu, { x: x - dx * 1.5, y: hy, z: z - dz * 1.5 }, { x: dx, y: 0, z: dz }, 2.5); } catch (e) { h = null; }
        if (h && h.point && h.normale) {
          var hn = Math.sqrt(h.normale.x * h.normale.x + h.normale.z * h.normale.z);
          if (hn > 0.3) { px = h.point.x; pz = h.point.z; hy = h.point.y; nx = h.normale.x / hn; nz = h.normale.z / hn; trouve = true; }
        }
      }
      ondulation(C, px, hy, pz, nx, nz, dx, dz, 1);
      if (trouve) {
        var h2 = null;
        try { h2 = monde.tir(lieu, { x: px + dx * 3, y: hy, z: pz + dz * 3 }, { x: -dx, y: 0, z: -dz }, 3); } catch (e2) { h2 = null; }
        if (h2 && h2.point && h2.normale) {
          var ep = 3 - h2.distance, hn2 = Math.sqrt(h2.normale.x * h2.normale.x + h2.normale.z * h2.normale.z);
          if (ep > 0.03 && ep < 2.5 && hn2 > 0.3) {
            var T = tache(T_SORTIE_MUR, lieu, h2.point.x, h2.point.y, h2.point.z, ep / V_INTANG + 0.04, h2.normale.x / hn2, h2.normale.z / hn2, dx);
            if (T) T.acc = dz;
          }
        }
      }
    }
    /** Évanouissement (action, étape fondu) : fumée sombre qui s'effondre sur lui, braises qui s'échappent. */
    function contEvanouissement(C, dt, pr) {
      IT[5] += dt * (90 + 90 * pr) * Q.densite;
      while (IT[5] >= 1) {
        IT[5] -= 1;
        var tq = ali() * K_ALEA;
        if (tq < 0.6) emettreConv(C, GAB.fumeeNoire, N1, A_CENTRE, 0.7, 2.0, -1.0, 1.3, 2.6, 1.2);   // la fumée s'enroule et s'effondre sur lui
        else if (tq < 0.72) emettreConv(C, GAB.ecto, N1, A_CENTRE, 0.6, 1.6, -0.8, 1.0, 2.0, 1.1);
        else {
          ancre(ANCRES_CORPS[Math.floor((ali() * K_ALEA) * ANCRES_CORPS.length) % ANCRES_CORPS.length]);
          EA[0] = SO[0]; EA[1] = SO[1]; EA[2] = SO[2]; EA[3] = 0; EA[4] = 1; EA[5] = 0; EA[6] = 0.9; EA[7] = NaN;
          emettreEA(C, GAB.braise, 1, COUL.sangVif, COUL.rougeSombre);
        }
      }
      ancre(A_CENTRE);
      var h = tenir(PH_INTANG.sombre, lieuBoss);
      if (h) { h.motif = H_FUMEE; h.x = SO[0]; h.y = SO[1] + 0.1; h.z = SO[2]; h.sx = 0.9 + 0.45 * pr; h.sy = 1.35 + 0.4 * pr; h.tirer = 0.2; couleur(h, COUL.fumee, 1); h.i = 0.3 + 0.55 * pr; }
      var l = tenir(PH_INTANG.lueur, lieuBoss);
      if (l) { l.motif = H_LUEUR; l.x = SO[0]; l.y = SO[1]; l.z = SO[2]; l.sx = l.sy = 1.3 - 0.3 * pr; l.tirer = 0.25; couleur(l, COUL.rougeSombre, 1); l.i = 0.75 * (1 - 0.6 * pr); }
      (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = COUL.rougeSombre[0], LC[4] = COUL.rougeSombre[1], LC[5] = COUL.rougeSombre[2], LC[6] = 70 * (1 - 0.5 * pr), LC[7] = 7, lumiereLC(C));
    }
    /** Resurgissement (action, étape apparition) : fumée rouge sombre qui se disperse autour de lui, lueur qui retombe. */
    function contResurgissement(C, dt, pr) {
      ancre(A_CENTRE);
      var x = SO[0], y = SO[1], z = SO[2];
      IT[5] += dt * 30 * (1 - pr) * Q.densite;
      while (IT[5] >= 1) {
        IT[5] -= 1; uniteAlea();
        EA[0] = x + SO[3] * 0.5; EA[1] = y + SO[4] * 0.7; EA[2] = z + SO[5] * 0.5; EA[3] = SO[3]; EA[4] = 0.4; EA[5] = SO[5]; EA[6] = 1.0; EA[7] = NaN;
        if ((ali() * K_ALEA) < 0.7) emettreEA(C, GAB.fumeeRouge, 1, null, null); else emettreEA(C, GAB.braise, 1, COUL.sangVif, COUL.rougeSombre);
      }
      var l = tenir(PH_INTANG.lueur, lieuBoss);
      if (l) { l.motif = H_LUEUR; l.x = x; l.y = y; l.z = z; l.sx = l.sy = 1.4 - 0.5 * pr; l.tirer = 0.2; couleur(l, COUL.rougeSombre, 1); l.i = 0.9 * (1 - pr); }
      (LC[0] = x, LC[1] = y, LC[2] = z, LC[3] = COUL.sangVif[0], LC[4] = COUL.sangVif[1], LC[5] = COUL.sangVif[2], LC[6] = 90 * (1 - pr), LC[7] = 8, lumiereLC(C));
    }
    /** Intangible (instantané boss.intangible) : transitions gardées, puis à peine un miroitement à ≤ R_MIROIR m du joueur
     *  local (rien au-delà). */
    function majIntangible(dt, E) {
      var B = E.boss;
      if (!B || !B.position) return;
      var b = !!B.intangible;
      if (b !== INTANG) transitionIntangible(b, B.position.x, B.position.y, B.position.z);
      IT[0] = B.position.x; IT[1] = B.position.y; IT[2] = B.position.z; IT[3] = 1;
      if (!b || !joueurLocal || !joueurLocal.position || (joueurLocal.lieu && B.lieu && joueurLocal.lieu !== B.lieu)) return;
      var cy = B.position.y - H_TRAQUE + 1.05;
      var dx = joueurLocal.position.x - B.position.x, dy = joueurLocal.position.y + 1.2 - cy, dz = joueurLocal.position.z - B.position.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= R_MIROIR) return;
      var k = 1 - lisse(R_MIROIR * 0.55, R_MIROIR, d), lieu = B.lieu === 'salle' ? 'salle' : 'bunker';
      var h = tenir(PH_INTANG.miroir, lieu);
      if (h) { h.motif = H_MIROIR; h.x = B.position.x; h.y = cy; h.z = B.position.z; h.sx = 0.85; h.sy = 1.35; h.tirer = 0; h.rot = 0; couleur(h, COUL.miroir, 1); h.i = 0.9 * k; }
      IT[4] += dt * 4 * k * Q.densite;
      if (IT[4] >= 1) {
        IT[4] -= 1; uniteAlea();
        EA[0] = B.position.x + SO[3] * 0.4; EA[1] = cy + SO[4] * 0.6; EA[2] = B.position.z + SO[5] * 0.4; EA[3] = 0; EA[4] = 0.2; EA[5] = 0; EA[6] = 0.5; EA[7] = NaN;
        emettreEA(couche(lieu), GAB.ecto, 1, null, null);
      }
    }
    /** Position d'un joueur dans le contexte (joueur local, puis ctx.joueurs) ; null si inconnu. */
    function positionJoueurCtx(id) {
      if (joueurLocal && joueurLocal.id === id && joueurLocal.position) return joueurLocal.position;
      if (joueursCtx) for (var i = 0; i < joueursCtx.length; i++) { var j = joueursCtx[i]; if (j && j.id === id && j.position) return j.position; }
      return null;
    }
    /** Crochet en préparation : la chaîne s'enroule et luit dans la main droite. */
    var PH_CROCHET_PREP = [poignee('vrille', 0.2), poignee('halo', 0.25)];
    function contCrochet(C, dt, et, pr) {
      if (et !== 'preparation') return;
      var r = tenir(PH_CROCHET_PREP[0], lieuBoss);
      if (r) {
        r.type = RT_SPIRALE; r.style = R_CHAINE; r.A = A_MAIND; r.amp = 0.16 + 0.05 * pr; r.freq = 2.2; r.vit = 5 + 7 * pr; r.p0 = -0.2; r.p1 = 0.2; r.larg = 0.06; r.maillons = 26;
        (KC[0] = 0.8 + 0.9 * pr, r.r = COUL.chaine[0] * KC[0], r.g = COUL.chaine[1] * KC[0], r.b = COUL.chaine[2] * KC[0]); r.r2 = COUL.chaine[0] * (0.8 + 0.9 * pr); r.g2 = COUL.chaine[1] * (0.8 + 0.9 * pr); r.b2 = COUL.chaine[2] * (0.8 + 0.9 * pr);
        r.alpha = lisse(0, 0.25, pr);
      }
      var h = tenir(PH_CROCHET_PREP[1], lieuBoss);
      if (h) { ancre(A_MAIND); h.motif = H_LUEUR; h.x = SO[0]; h.y = SO[1]; h.z = SO[2]; h.sx = h.sy = 0.3 + 0.25 * pr; h.tirer = 0.2; couleur(h, COUL.chaineVif, 1); h.i = 0.3 + 0.9 * pr; }
      ancre(A_MAIND);
      (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = COUL.chaineVif[0], LC[4] = COUL.chaineVif[1], LC[5] = COUL.chaineVif[2], LC[6] = 20 + 70 * pr, LC[7] = 7, lumiereLC(C));
    }
    // suivi des crochets (instantané etat().crochets) : chaîne de la main à la pointe, crochet, traînée de traction, chute si raté
    var SUIVI_CROCHETS = creerSuivis(4, ['vrille', 'vrille', 'halo', 'trainee', 'vrille']);
    for (var scr = 0; scr < SUIVI_CROCHETS.length; scr++) SUIVI_CROCHETS[scr].ancre = A_CROCHETS + scr;
    var MAILLON = 0.1;                                       // longueur d'un maillon (m)
    function majCrochets(dt, E) {
      var L = E.crochets;
      if (L && L.length && bossVisible) {
        var C = couche(lieuBoss);
        ancre(A_MAIND);
        var hx = SO[0], hy = SO[1], hz = SO[2];
        for (var i = 0; i < L.length; i++) {
          var c = L[i];
          if (!c || !c.position) continue;
          var s = trouverSuivi(SUIVI_CROCHETS, c.id, true);
          if (!s) continue;
          s.vu = true;
          if (c.etat !== s.etatPrec) { s.etatPrec = c.etat; s.lat = 0; s.acc = 0; s.x = c.position.x; s.y = c.position.y; s.z = c.position.z; }
          s.lat += dt;                                       // temps dans l'état ; s.x/y/z : pointe à l'entrée de l'état
          var tx = c.position.x, ty = c.position.y, tz = c.position.z, sag = 0, alpha = 1, glow = 1;
          if (c.etat === 'accroche' || c.etat === 'traction') {
            var pj = positionJoueurCtx(c.joueur);
            if (pj) { tx = pj.x; ty = pj.y + 1.0; tz = pj.z; }
            glow = c.etat === 'traction' ? 1.8 : 1.6;
          } else if (c.etat === 'rate') {                    // la chaîne retombe et se rétracte vers la main (0,6 s)
            var kr = clamp(s.lat / 0.6, 0, 1), e = kr * kr;
            tx = s.x + (hx - s.x) * e; tz = s.z + (hz - s.z) * e;
            ty = s.y + (hy - s.y) * e - 1.1 * Math.sin(PI * Math.min(1, kr * 1.25));
            sag = -(0.5 + 1.2 * Math.sin(PI * kr)); alpha = 1 - lisse(0.75, 1, kr); glow = 0.8;
          } else { sag = -0.08; glow = 1.5; }
          (ANC[(s.ancre) * 3] = tx, ANC[(s.ancre) * 3 + 1] = ty, ANC[(s.ancre) * 3 + 2] = tz, ANC_T[s.ancre] = trame);
          var dxc = tx - hx, dyc = ty - hy, dzc = tz - hz, Lc = Math.sqrt(dxc * dxc + dyc * dyc + dzc * dzc) || 1e-3;
          var r = tenir(s.p[0], lieuBoss);
          if (r) {
            r.type = RT_VRILLE; r.style = R_CHAINE; r.A = A_MAIND; r.B = s.ancre; r.larg = 0.1; r.amp = c.etat === 'traction' ? 0.025 : 0; r.freq = 5; r.vit = 30;
            r.arche = sag * Math.min(1, Lc / 6); r.croissance = 1; r.maillons = Math.max(4, Lc / MAILLON);
            (KC[0] = glow, r.r = COUL.chaine[0] * KC[0], r.g = COUL.chaine[1] * KC[0], r.b = COUL.chaine[2] * KC[0]); r.r2 = COUL.chaine[0] * glow; r.g2 = COUL.chaine[1] * glow; r.b2 = COUL.chaine[2] * glow; r.alpha = alpha;
          }
          var rg = nomQualite === 'basse' ? null : tenir(s.p[4], lieuBoss);
          if (rg) {                                          // lueur rouge sombre autour de la chaîne (lisible dans le noir)
            rg.type = RT_VRILLE; rg.style = R_ENERGIE; rg.A = A_MAIND; rg.B = s.ancre; rg.larg = 0.3; rg.amp = r ? r.amp : 0; rg.freq = 5; rg.vit = 30;
            rg.arche = sag * Math.min(1, Lc / 6); rg.croissance = 1;
            (KC[0] = 0.32 * glow, rg.r = COUL.chaine[0] * KC[0], rg.g = COUL.chaine[1] * KC[0], rg.b = COUL.chaine[2] * KC[0]); rg.r2 = COUL.chaine[0] * 0.5 * glow; rg.g2 = COUL.chaine[1] * 0.5 * glow; rg.b2 = COUL.chaine[2] * 0.5 * glow; rg.alpha = alpha;
          }
          var ux = dxc / Lc, uy = dyc / Lc, uz = dzc / Lc;
          var rh = tenir(s.p[1], lieuBoss);
          if (rh) {                                          // le crochet, à la pointe, dans le plan (direction, haut)
            rh.type = RT_CROCHET; rh.style = R_ENERGIE; rh.A = -1; rh.B = s.ancre; rh.larg = 0.075; rh.amp = 0.4;
            var upx = -ux * uy, upy = 1 - uy * uy, upz = -uz * uy, lu = Math.sqrt(upx * upx + upy * upy + upz * upz) || 1;
            rh.e1x = ux; rh.e1y = uy; rh.e1z = uz; rh.e2x = upx / lu; rh.e2y = upy / lu; rh.e2z = upz / lu;
            (KC[0] = 0.85 * glow, rh.r = COUL.chaineVif[0] * KC[0], rh.g = COUL.chaineVif[1] * KC[0], rh.b = COUL.chaineVif[2] * KC[0]); rh.r2 = COUL.chaine[0] * 1.2; rh.g2 = COUL.chaine[1] * 1.2; rh.b2 = COUL.chaine[2] * 1.2; rh.alpha = alpha;
          }
          var hh = tenir(s.p[2], lieuBoss);
          if (hh) { hh.motif = H_LUEUR; hh.x = tx; hh.y = ty; hh.z = tz; hh.sx = hh.sy = 0.34; hh.tirer = 0.1; couleur(hh, COUL.chaineVif, 1); hh.i = (c.etat === 'vol' ? 0.75 : 0.45) * alpha; }
          if (c.etat === 'vol') {
            s.acc += dt * 28 * Q.densite;
            while (s.acc >= 1) { s.acc -= 1; emettre(C, GAB.etincelle, N1, tx, ty, tz, -ux, 0.1 - uy, -uz, 0.45, COUL.chaineVif, COUL.chaine); }
          } else if (c.etat === 'traction') {
            var rt = tenir(s.p[3], lieuBoss);
            if (rt) { rt.style = R_TRAINEE; rt.larg = 0.55; couleur(rt, COUL.chaine, 1.1); rt.r2 = COUL.sang[0]; rt.g2 = COUL.sang[1]; rt.b2 = COUL.sang[2]; pousserTrainee(rt, tx, ty - 0.35, tz); }
          }
          (LC[0] = tx, LC[1] = ty, LC[2] = tz, LC[3] = COUL.chaineVif[0], LC[4] = COUL.chaineVif[1], LC[5] = COUL.chaineVif[2], LC[6] = 22 * alpha * glow, LC[7] = 6, lumiereLC(C));
        }
      }
      finSuivis(SUIVI_CROCHETS);
    }
    /** Évènements `crochet` : lancer (étincelles à la main), accroche (étincelles, sang), rate (mur : gerbe ; esquive : retombée), arrivee. */
    function fxCrochet(d) {
      var p = d.position;
      if (!p) return;
      var C = couche(lieuBoss), sy = sol(lieuBoss);
      if (d.etat === 'lancer') {
        emettre(C, GAB.etincelle, 10, p.x, p.y, p.z, 0, 0, 0, 0.7, COUL.chaineVif, COUL.chaine);
        halo(C, H_ECLAT, p.x, p.y, p.z, 0.2, 0.9, COUL.chaineVif, 1.3, 0.2, C_FLASH, 0.2);
      } else if (d.etat === 'accroche') {
        var pj = positionJoueurCtx(d.joueur), x = pj ? pj.x : p.x, y = pj ? pj.y + 1.0 : p.y, z = pj ? pj.z : p.z;
        var local = !!(joueurLocal && d.joueur === joueurLocal.id);    // joueur local : pas d'éclat devant sa propre caméra
        emettre(C, GAB.etincelle, local ? 10 : 30, x, y, z, 0, 0, 0, 1.0, COUL.energieClaire, COUL.chaineVif);
        emettre(C, GAB.gerbeSang, local ? 8 : 24, x, y, z, 0, 0.3, 0, 0.9, null, null, sy);
        if (!local) halo(C, H_ECLAT, x, y, z, 0.3, 1.1, COUL.chaineVif, 1.2, 0.25, C_FLASH, 0.3);
        eclairLumiere(C, x, y, z, COUL.chaineVif, 180, 8, 0.35);
        if (local) { ecr.coup = Math.max(ecr.coup, 0.6); secouer(0.45, 0.4, x, y, z, lieuBoss); }
      } else if (d.etat === 'rate') {
        if (d.raison === 'mur') {
          emettre(C, GAB.etincelle, 18, p.x, p.y, p.z, 0, 0.3, 0, 1.0, COUL.energieClaire, COUL.chaineVif);
          emettre(C, GAB.poussiere, 5, p.x, p.y, p.z, 0, 0, 0, 0.6);
          emettre(C, GAB.eclat, 4, p.x, p.y, p.z, 0, 0.5, 0, 0.4);
          halo(C, H_ECLAT, p.x, p.y, p.z, 0.2, 0.9, COUL.energieClaire, 1.2, 0.18, C_FLASH, 0.2);
        } else {
          emettre(C, GAB.etincelle, 8, p.x, p.y, p.z, 0, -0.5, 0, 0.6, COUL.chaineVif, COUL.chaine);
        }
      } else if (d.etat === 'arrivee') {
        emettre(C, GAB.poussiere, 6, p.x, sy + 0.1, p.z, 0, 1, 0, 0.7);
      }
    }
    function fxOndeChoc(lieu, x, y, z, rayon) {
      var C = couche(lieu), sy = sol(lieu);
      onde(C, x, z, rayon, 0.75, COUL.energieClaire, 2.0, 0.4, 1.5);
      onde(C, x, z, rayon * 1.15, 0.4, COUL.energie, 1.0, 0.7, 0.5);
      volume(C, 'sph', V_COQUILLE, x, sy, z, rayon * 0.85, rayon * 0.35, rayon * 0.85, COUL.energie, 0.9, 0.42, C_FLASH);
      halo(C, H_ECLAT, x, sy + 0.6, z, 0.6, 3.0, COUL.energieClaire, 2.0, 0.3, C_FLASH, 0.3);
      emettreAnneau(C, GAB.poussiere, 34, x, sy + 0.05, z, 0.8, rayon * 2.2, 1.0);
      emettreAnneau(C, GAB.etincelle, 26, x, sy + 0.15, z, 0.6, rayon * 2.0, 1.0);
      eclairLumiere(C, x, sy + 1.0, z, COUL.energieClaire, 520, 16, 0.45);
      secouer(0.5, 0.5, x, sy, z, lieu);
    }
    function fxRituelExplosion() {
      var C = couche('salle'), x = CERCLE_X, z = CERCLE_Z, sy = SOL_SALLE;
      ecr.flashBlanc = Math.max(ecr.flashBlanc, 0.36);
      halo(C, H_ECLAT, x, sy + 2.5, z, 1.5, 7.5, COUL.rituelBlanc, 1.8, 0.7, C_FLASH, 0);
      onde(C, x, z, APO * 0.95, 1.6, COUL.rituel, 2.2, 1.0, 1.2);
      volume(C, 'sph', V_COQUILLE, x, sy, z, APO * 1.05, APO * 0.55, APO * 1.05, COUL.rituel, 0.7, 1.0, C_FLASH);
      emettre(C, GAB.rituel, 90, x, sy + 2.0, z, 0, 0, 0, 3.0);
      emettreAnneau(C, GAB.etincelle, 50, x, sy + 0.3, z, R_RITUEL, 9, 1.2, COUL.rituelBlanc, COUL.rituel);
      eclairLumiere(C, x, sy + 3, z, COUL.rituelBlanc, 1800, 30, 1.0);
      OSC[0] = 0.8;
      secouer(0.8, 0.8, x, sy, z, 'salle');
    }
    function fxFrappe(lieu, reussie, speciale, cibleLocale) {
      var C = couche(lieu), B = BOSS;
      if (!B || !B.position) return;
      var la = +B.lacet || 0, fx = Math.sin(la), fz = Math.cos(la), rx = -Math.cos(la), rz = Math.sin(la);
      ancre(A_POITRINE);
      var cx = SO[0] + fx * 0.35, cy = SO[1] - 0.1, cz = SO[2] + fz * 0.35;
      // arc tranchant : demi-cercle incliné devant le boss
      var r = ruban(C, RT_ARC, R_ENERGIE, speciale ? 0.32 : 0.2, PAL.halo, PAL.bleu ? COUL.glaceVif : COUL.energieClaire, (reussie ? 1.9 : 1.3) * (PAL.bleu ? 0.7 : 1), 0.26);
      if (r) {
        r.ax = cx; r.ay = cy; r.az = cz; r.amp = FRAPPE_PORTEE * 0.62;
        r.e1x = rx; r.e1y = 0.35; r.e1z = rz; r.e2x = fx; r.e2y = -0.25; r.e2z = fz;
        var l1 = Math.sqrt(r.e1x * r.e1x + r.e1y * r.e1y + r.e1z * r.e1z), l2 = Math.sqrt(r.e2x * r.e2x + r.e2y * r.e2y + r.e2z * r.e2z);
        r.e1x /= l1; r.e1y /= l1; r.e1z /= l1; r.e2x /= l2; r.e2y /= l2; r.e2z /= l2;
        r.p0 = -0.25; r.p1 = PI * 0.95;
      }
      var r2 = ruban(C, RT_ARC, R_SOMBRE, speciale ? 0.45 : 0.3, PAL.sombre, PAL.sombre, PAL.bleu ? 0.5 : 1, 0.34);
      if (r2 && r) { r2.ax = cx; r2.ay = cy - 0.05; r2.az = cz; r2.amp = r.amp * 0.96; r2.e1x = r.e1x; r2.e1y = r.e1y; r2.e1z = r.e1z; r2.e2x = r.e2x; r2.e2y = r.e2y; r2.e2z = r.e2z; r2.p0 = r.p0; r2.p1 = r.p1; }
      var sy = sol(lieu);
      if (reussie) {
        var tx = SO[0] + fx * FRAPPE_PORTEE * 0.7, ty = SO[1] - 0.2, tz = SO[2] + fz * FRAPPE_PORTEE * 0.7;
        if (cibleLocale) { ancre(A_DEVANT); tx = SO[0]; ty = SO[1] - 0.3; tz = SO[2]; }
        emettre(C, PAL.gerbe, 26, tx, ty, tz, rx, 0.4, rz, 1.0, null, null, sy);
        emettre(C, PAL.brume, 8, tx, ty, tz, rx, 0.2, rz, 1.2);
        halo(C, H_ECLAT, tx, ty, tz, 0.3, 1.6, PAL.halo, 1.8 * PAL.k, 0.25, C_FLASH, 0.3);
        eclairLumiere(C, tx, ty, tz, PAL.halo, 260 * PAL.k, 9, 0.35);
        if (cibleLocale) { ecr.flashRouge = Math.max(ecr.flashRouge, 1); ecr.glace = PAL.bleu ? 1 : 0; }   // entaille glacée au palier 0
      } else {
        var gx = B.position.x + fx * FRAPPE_PORTEE * 0.75, gz = B.position.z + fz * FRAPPE_PORTEE * 0.75;
        emettre(C, GAB.etincelle, 34, gx, sy + 0.05, gz, fx, 0.6, fz, 1.2, COUL.rituelBlanc, COUL.energie);
        emettre(C, GAB.poussiere, 8, gx, sy + 0.1, gz, 0, 1, 0, 0.8);
        emettre(C, GAB.eclat, 6, gx, sy + 0.05, gz, 0, 1, 0, 0.5);
        var f = solAuto(C, S_FISSURES, gx, gz, 0.8, PAL.vif, 0.8, 3.5, 0); if (f) f.q0 = 0.9;
        halo(C, H_ECLAT, gx, sy + 0.15, gz, 0.2, 1.0, COUL.energieClaire, 1.6, 0.2, C_FLASH, 0.2);
        eclairLumiere(C, gx, sy + 0.4, gz, COUL.energieClaire, 160, 7, 0.3);
      }
    }
    function fxLiberation(lieu) {
      var C = couche(lieu), sy = sol(lieu);
      ancre(A_POITRINE); var x = SO[0], y = SO[1], z = SO[2];
      halo(C, H_ECLAT, x, y, z, 0.8, 4.5, COUL.ameClaire, 2.2, 0.6, C_FLASH, 0.3);
      halo(C, H_ANNEAU, x, y, z, 4.5, 4.5, COUL.energie, 1.4, 0.7, C_ANNEAU, 0);
      onde(C, x, z, 7, 0.8, COUL.energie, 1.6, 0.8, 1.2);
      volume(C, 'sph', V_COQUILLE, x, y, z, 3.2, 3.2, 3.2, COUL.ame, 0.7, 0.7, C_FLASH);
      emettre(C, GAB.ame, 40, x, y, z, 0, 1, 0, 2.2);
      emettre(C, GAB.braise, 40, x, y, z, 0, 0, 0, 1.8);
      tache(T_LIBERATION, lieu, x, y, z, 2.6, 0, 0, 0);
      eclairLumiere(C, x, y, z, COUL.ameClaire, 700, 18, 1.0);
      secouer(0.45, 0.6, x, y, z, lieu);
      void sy;
    }
    function fxRecompense(lieu, x, y, z, type) {
      var C = couche(lieu), sy = sol(lieu);
      var c = type === 'arme' ? COUL.rituel : type === 'atout' ? COUL.ame : COUL.rituelOr;
      var v = null;
      for (var i = 0; i < C.volumes.length; i++) { var w = C.volumes[i]; if (w.actif && w.motif === V_COLONNE && Math.abs(w.x - x) < 0.6 && Math.abs(w.z - z) < 0.6 && w.vie > 0) { v = w; break; } }
      if (v) { v.age = Math.min(v.age, 0.3); v.vie = Math.max(v.vie, 2.6); v.i0 = Math.min(1.8, v.i0 + 0.15); couleur(v, c, 1); }
      else volume(C, 'cyl', V_COLONNE, x, sy, z, 0.42, 3.6, 0.42, c, 0.6, 2.6, C_PULSE);
      solAuto(C, S_LUEUR, x, z, 1.0, c, 0.45, 2.6, C_PULSE);
      emettre(C, GAB.rituel, 14, x, sy + 0.5, z, 0, 1, 0, 1.0, c, COUL.rituel);
      halo(C, H_ECLAT, x, sy + 1.2, z, 0.3, 1.4, c, 1.4, 0.35, C_FLASH, 0.2);
      eclairLumiere(C, x, sy + 1.4, z, c, 140, 7, 0.6);
    }
    function fxInteractionFin(lieu, x, y, z) {
      var C = couche(lieu), sy = sol(lieu);
      halo(C, H_ECLAT, x, sy + 0.6, z, 0.5, 3.2, COUL.rituelBlanc, 2.0, 0.5, C_FLASH, 0.2);
      onde(C, x, z, 4, 0.6, COUL.rituel, 1.6, 0.7, 0.4);
      emettre(C, GAB.rituel, 50, x, sy + 0.4, z, 0, 1, 0, 1.6);
      eclairLumiere(C, x, sy + 1, z, COUL.rituelBlanc, 500, 14, 0.8);
    }
    // v1.4 : palette des lames de la phase 5 (instantané boss.couleurLames : 'bleu' au palier 0, 'rouge' ensuite) ;
    // bleu très clair = liquide glacé lumineux, sans sang rouge
    // (halo : couleur des lueurs ; k : facteur d'intensité des lueurs et lumières, le bleu clair paraît bien plus lumineux que le rouge)
    var LAMES_ROUGE = { bleu: false, goutte: GAB.sang, gerbe: GAB.gerbeSang, brume: GAB.brumeRouge, vif: COUL.sangVif, sombre: COUL.sang, halo: COUL.sangVif, k: 1,
      tache: COUL.sangTache, tacheEm: [0.6, 0.05, 0.03], tacheBrillance: 0, tacheOp: 0.95 };
    var LAMES_BLEU = { bleu: true, goutte: GAB.glace, gerbe: GAB.gerbeGlace, brume: GAB.brumeGlace, vif: COUL.glaceVif, sombre: COUL.glace, halo: COUL.glace, k: 0.5,
      tache: COUL.glaceTache, tacheEm: [0.4, 0.72, 1.0], tacheBrillance: 1, tacheOp: 0.6 };
    var PAL = LAMES_ROUGE;
    function tacheSang(C, x, y, z, taille) {
      var s = solAuto(C, S_TACHE, x, z, clamp(taille * 5.0, 0.1, 0.24) * entre(0.8, 1.3), PAL.tache, PAL.tacheOp, nomQualite === 'basse' ? 4 : 7, 0);
      if (s) { s.y = y + 0.012; s.q0 = PAL.tacheEm[0]; s.q1 = PAL.tacheEm[1]; s.q2 = PAL.tacheEm[2]; s.q3 = PAL.tacheBrillance; }
    }

    // ─────────────────────────────── tâches (effets en plusieurs temps) ───────────────────────────────
    var T_EMERGENCE = 1, T_PLAFOND = 2, T_RUGISSEMENT = 3, T_LIBERATION = 4, T_DISSIPATION = 5, T_DECHARGE = 6, T_ECLAIR_APPARITION = 7, T_RITUEL_FIN = 8, T_DESINTEGRATION = 9, T_FAILLE = 10,
      T_EMBRASEMENT = 11, T_SORTIE_MUR = 12;
    var TACHES = [];
    for (var it = 0; it < 40; it++) TACHES.push({ actif: false, type: 0, lieu: 'salle', t: 0, duree: 0, x: 0, y: 0, z: 0, a: 0, b: 0, c: 0, acc: 0, n: 0, h: null });
    function tache(type, lieu, x, y, z, duree, a, b, c) {
      for (var i = 0; i < TACHES.length; i++) {
        var T = TACHES[i];
        if (T.actif) continue;
        T.actif = true; T.type = type; T.lieu = lieu; T.t = 0; T.duree = duree; T.x = x; T.y = y; T.z = z; T.a = a; T.b = b; T.c = c; T.acc = 0; T.n = 0; T.h = null;
        return T;
      }
      return null;
    }
    function majTaches(dt) {
      for (var i = 0; i < TACHES.length; i++) {
        var T = TACHES[i];
        if (!T.actif) continue;
        var t0 = T.t; T.t += dt;
        var C = couche(T.lieu);
        if (T.type === T_EMERGENCE) {
          // petits éclairs rouges qui dansent sur le sol qui craque
          T.acc += dt;
          if (T.acc >= 0.12 && T.n < 5) {
            T.acc = 0; T.n++;
            var a = (ali() * K_ALEA) * TAU, r = entre(0.5, 1.1), sy = sol(T.lieu);
            eclair(C, T.x + Math.cos(a) * 0.15, sy + 0.05, T.z + Math.sin(a) * 0.15, T.x + Math.cos(a) * r, sy + entre(0.05, 0.35), T.z + Math.sin(a) * r, 0.05, COUL.energie, 1.6, entre(0.1, 0.18), 0.2);
          }
        } else if (T.type === T_PLAFOND) {
          // poussière qui tombe du plafond un peu partout (et quelques éclats)
          var k = 1 - T.t / T.duree;
          T.acc += dt * 70 * T.a * Math.max(0, k) * Q.densite;
          while (T.acc >= 1) {
            T.acc -= 1;
            var an = (ali() * K_ALEA) * TAU, rr = Math.sqrt((ali() * K_ALEA)) * APO * 0.85;
            var px = (+O.x || 0) + Math.cos(an) * rr, pz = (+O.z || 0) + Math.sin(an) * rr;
            if (T.lieu === 'bunker') { px = T.x + Math.cos(an) * rr * 0.4; pz = T.z + Math.sin(an) * rr * 0.4; }
            var py = T.lieu === 'bunker' ? sol(T.lieu) + 3.2 : PLAFOND;
            emettre(C, GAB.plafond, N1, px, py, pz, 0, -1, 0, 1.0);
            if ((ali() * K_ALEA) < 0.12) emettre(C, GAB.eclat, N1, px, py, pz, 0, -1, 0, 0.35);
          }
        } else if (T.type === T_RUGISSEMENT) {
          // trois anneaux d'onde qui partent de la bouche
          var pas = 0.22;
          if ((t0 === 0 || Math.floor(t0 / pas) !== Math.floor(T.t / pas)) && T.n < 3) {
            T.n++;
            ancre(A_BOUCHE);
            var h = halo(C, H_ANNEAU, SO[0], SO[1], SO[2], 0.9 + T.n * 0.6, 0.9 + T.n * 0.6, COUL.energie, 0.6 * T.a + 0.2, 0.45, C_ANNEAU, 0.1);
            if (h) h.graine = (ali() * K_ALEA);
            emettre(C, GAB.energie, 8, SO[0], SO[1], SO[2], 0, 0, 0, 1.0);
          }
        } else if (T.type === T_LIBERATION) {
          // âmes libérées qui montent en spirale (défaite)
          T.acc += dt * 10;
          while (T.acc >= 1 && T.t < T.duree * 0.8) {
            T.acc -= 1;
            var hh = halo(C, H_AME, T.x + entre(-0.6, 0.6), T.y + entre(-0.3, 0.6), T.z + entre(-0.6, 0.6), 0.32, 0.32, COUL.ameClaire, 1.3, entre(1.4, 2.2), C_FIXE, 0);
            if (hh) { hh.sy = 0.16; hh.mx = hh.vx = entre(-0.7, 0.7); hh.my = hh.vy = entre(2.0, 3.4); hh.mz = hh.vz = entre(-0.7, 0.7); }
          }
        } else if (T.type === T_DISSIPATION) {
          // les ailes s'effritent en braises et en cendres
          T.acc += dt * 60 * (1 - T.t / T.duree) * Q.densite;
          while (T.acc >= 1) {
            T.acc -= 1;
            emettreAile(C, (ali() * K_ALEA) < 0.6 ? GAB.braise : GAB.cendre, 1, (ali() * K_ALEA) < 0.5 ? 1 : -1, 1.0, null, null);
          }
        } else if (T.type === T_DECHARGE) {
          // éclairs autour du boss (souffrance, effondrement, défaite)
          dechargeArcs(C, dt, T.a, T);
        } else if (T.type === T_ECLAIR_APPARITION) {
          if (t0 === 0) {
            var sy2 = sol(T.lieu);
            for (var e = 0; e < 3; e++) eclair(C, T.x + entre(-1.5, 1.5), PLAFOND, T.z + entre(-1.5, 1.5), T.x, T.y + 1.4, T.z, 0.14, COUL.energieClaire, 2.6, 0.32, 0.1);
            halo(C, H_ECLAT, T.x, T.y + 1.2, T.z, 1.0, 6.0, COUL.energieClaire, 2.6, 0.45, C_FLASH, 0.5);
            onde(C, T.x, T.z, 7.5, 0.9, COUL.energie, 1.8, 0.8, 1.2);
            volume(C, 'sph', V_COQUILLE, T.x, sy2, T.z, 5.5, 3.0, 5.5, COUL.energie, 0.6, 0.6, C_FLASH);
            emettre(C, GAB.etincelle, 50, T.x, T.y + 1.0, T.z, 0, 0, 0, 1.6);
            emettre(C, GAB.braise, 40, T.x, T.y + 1.0, T.z, 0, 0, 0, 1.6);
            emettreAnneau(C, GAB.poussiere, 30, T.x, sy2 + 0.05, T.z, 1.0, 6, 1.2);
            eclairLumiere(C, T.x, T.y + 1.5, T.z, COUL.energieClaire, 900, 22, 0.7);
            secouer(0.4, 0.5, T.x, T.y, T.z, T.lieu);
          }
        } else if (T.type === T_DESINTEGRATION) {
          // lames qui s'effritent : fragments de sang, brume rouge
          var kk = 1 - T.t / T.duree;
          T.acc += dt * 26 * kk * Q.densite;
          while (T.acc >= 1) {
            T.acc -= 1;
            var cote = (ali() * K_ALEA) < 0.5 ? A_POINTEG : A_POINTED, gg = (ali() * K_ALEA) < 0.5 ? A_LAMEG : A_LAMED;
            ancre(cote); var x1 = SO[0], y1 = SO[1], z1 = SO[2]; ancre(gg);
            var u = (ali() * K_ALEA);
            var px2 = mix(SO[0], x1, u), py2 = mix(SO[1], y1, u), pz2 = mix(SO[2], z1, u);
            if ((ali() * K_ALEA) < 0.5) emettre(C, GAB.eclat, N1, px2, py2, pz2, 0, 0, 0, 0.35, PAL.sombre, PAL.sombre);
            else if ((ali() * K_ALEA) < 0.6) emettre(C, PAL.brume, N1, px2, py2, pz2, 0, 1, 0, 1.0);
            else emettre(C, GAB.braise, N1, px2, py2, pz2, 0, 1, 0, 0.8, PAL.vif, PAL.sombre);
          }
        } else if (T.type === T_FAILLE) {
          // faille des chiens (v1.2) : colonne de fumée éclairée par en dessous, braises, crépitements sur les fissures,
          // lumière qui monte avec l'ouverture (T.a = durée d'ouverture, T.y = sol de la faille)
          var Df = T.a, kf = T.t < Df ? lisse(0, Df, T.t) : 1 - lisse(Df, T.duree, T.t);
          T.acc += dt * (16 + 40 * kf) * Q.densite;
          while (T.acc >= 1) {
            T.acc -= 1;
            var af = (ali() * K_ALEA) * TAU, rf = Math.sqrt((ali() * K_ALEA)) * RAYON_FAILLE * 0.4;
            var pxf = T.x + Math.cos(af) * rf, pzf = T.z + Math.sin(af) * rf;
            if ((ali() * K_ALEA) < 0.55) emettre(C, GAB.fumeeFaille, N1, pxf, T.y + 0.1, pzf, 0, 1, 0, 1.0);
            else emettre(C, GAB.braise, N1, pxf, T.y + 0.08, pzf, 0, 1, 0, 0.9);
          }
          T.c -= dt;
          if (T.c <= 0 && T.t < Df) {
            T.c = entre(0.07, 0.15);
            var ae = (ali() * K_ALEA) * TAU, re = entre(0.4, 0.95) * RAYON_FAILLE;
            eclair(C, T.x, T.y + 0.04, T.z, T.x + Math.cos(ae) * re, T.y + entre(0.03, 0.18), T.z + Math.sin(ae) * re, 0.035, COUL.braise, 1.6, entre(0.07, 0.13), 0.1);
          }
          var hv = T.h;
          if (hv && hv.actif && hv.motif === H_LUEUR) { hv.i0 = 0.15 + 0.65 * kf; hv.sx = 0.32 + 0.24 * kf; hv.sy = 0.7 + 1.0 * kf; hv.y = T.y + 0.45 + 0.9 * kf; }
          (LC[0] = T.x, LC[1] = T.y + 0.45 + 0.45 * kf, LC[2] = T.z, LC[3] = COUL.braise[0], LC[4] = COUL.braise[1], LC[5] = COUL.braise[2], LC[6] = 35 + 140 * kf, LC[7] = 8, lumiereLC(C));
        } else if (T.type === T_EMBRASEMENT) {
          // v1.4 : les lames s'embrasent au passage au rouge (flammes le long des lames)
          var ke = 1 - T.t / T.duree;
          T.acc += dt * 110 * ke * Q.densite;
          while (T.acc >= 1) {
            T.acc -= 1;
            var cg = (ali() * K_ALEA) < 0.5;
            ancre(cg ? A_POINTEG : A_POINTED); var qx = SO[0], qy = SO[1], qz = SO[2];
            ancre(cg ? A_LAMEG : A_LAMED);
            var ul = (ali() * K_ALEA);
            emettre(C, (ali() * K_ALEA) < 0.6 ? GAB.energie : GAB.braise, N1, SO[0] + (qx - SO[0]) * ul, SO[1] + (qy - SO[1]) * ul, SO[2] + (qz - SO[2]) * ul, 0, 1, 0, 0.8, COUL.chaineVif, COUL.sangVif);
          }
          for (var mb = 0; mb < 2; mb++) {                    // lueur vacillante sur chaque lame
            ancre(mb ? A_POINTED : A_POINTEG); var bx2 = SO[0], by2 = SO[1], bz2 = SO[2];
            ancre(mb ? A_LAMED : A_LAMEG);
            var hb = tenir(PH_EMBRASE[mb], T.lieu);
            if (hb) {
              hb.motif = H_LUEUR; hb.x = (SO[0] + bx2) * 0.5; hb.y = (SO[1] + by2) * 0.5; hb.z = (SO[2] + bz2) * 0.5; hb.sx = 0.55; hb.sy = 0.9; hb.tirer = 0.15;
              couleurMix(hb, COUL.chaineVif, COUL.sangVif, 0.5 + 0.5 * Math.sin(HORLOGE[0] * 23 + mb * 2), 1); hb.i = 1.8 * ke * (0.8 + 0.2 * Math.sin(HORLOGE[0] * 31 + mb));
            }
          }
          ancre(A_POITRINE);
          (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.18, LC[5] = 0.06, LC[6] = 130 * ke, LC[7] = 9, lumiereLC(C));
        } else if (T.type === T_SORTIE_MUR) {
          // v1.5 : l'intangible ressort de l'autre côté du mur : seconde ondulation (T.a, T.b : normale ; T.c, T.acc : course)
          if (T.n === 0 && T.t >= T.duree - 1e-6) { T.n = 1; ondulation(C, T.x, T.y, T.z, T.a, T.b, T.c, T.acc, 0.8); }
        }
        if (T.t >= T.duree) T.actif = false;
      }
      for (var l = 0; l < LUM_TEMP.length; l++) {
        var L2 = LUM_TEMP[l];
        if (!L2.actif) continue;
        L2.age += dt;
        if (L2.age >= L2.vie) { L2.actif = false; continue; }
        var kl = 1 - L2.age / L2.vie;
        (LC[0] = L2.x, LC[1] = L2.y, LC[2] = L2.z, LC[3] = L2.r, LC[4] = L2.g, LC[5] = L2.b, LC[6] = L2.i0 * kl * kl, LC[7] = L2.portee, lumiereLC(L2.C));
      }
    }
    /** Éclairs qui partent du corps du boss vers des points voisins (souffrance, colère, faiblesse, défaite). */
    var ANCRES_CORPS = [A_POITRINE, A_MAING, A_MAIND, A_TETE, A_DOS, A_CENTRE];
    function dechargeArcs(C, dt, intensite, T) {
      T.acc -= dt * intensite;
      if (T.acc > 0) return;
      T.acc = entre(0.07, 0.2);
      var src = ANCRES_CORPS[Math.floor((ali() * K_ALEA) * ANCRES_CORPS.length) % ANCRES_CORPS.length];
      ancre(src);
      var x = SO[0], y = SO[1], z = SO[2];
      uniteAlea();
      var d = entre(1.0, 2.6) * (0.7 + 0.3 * intensite);
      var bx = x + SO[3] * d, by = Math.max(sol(T.lieu) + 0.02, y + SO[4] * d - 0.6), bz = z + SO[5] * d;
      var r = eclair(C, x, y, z, bx, by, bz, 0.06 + 0.04 * intensite, (ali() * K_ALEA) < 0.3 ? COUL.energieClaire : COUL.energie, 1.8 + intensite, entre(0.1, 0.22), 0.16);
      if (r) r.A = src;
      emettre(C, GAB.etincelle, 5, bx, by, bz, 0, 0, 0, 0.6);
      (LC[0] = x, LC[1] = y, LC[2] = z, LC[3] = COUL.energieClaire[0], LC[4] = COUL.energieClaire[1], LC[5] = COUL.energieClaire[2], LC[6] = 40 + 60 * intensite * (ali() * K_ALEA), LC[7] = 10, lumiereLC(C));
    }
    var DECHARGE = { acc: 0, lieu: 'salle' };

    // ─────────────────────────────── effets continus (pilotés par l'état) ───────────────────────────────
    var acc = { conv: 0, mains: 0, crepite: 0, recharge: 0, ames: 0, puissance: 0, gouttes: 0, brume: 0, fumee: 0, braises: 0, instable: 0, instArc: 0, interaction: 0, plafond: 0, rituel: 0, ecl: 0, telek: 0, formation: 0, siphon: 0, bulles: 0 };
    function majActionEnCours(dt, E, a) {
      var C = couche(lieuBoss), id = a.id, et = a.etape, pr = nombre(a.progression, 0);
      if (id === 'apparition') contApparition(C, dt, et, pr);
      else if (id === 'invocation' || id === 'trait') contIncantation(C, dt, id === 'trait', et, pr, a);
      else if (id === 'souffrance' || id === 'effondrement') { DECHARGE.lieu = lieuBoss; dechargeArcs(C, dt, et === 'colere' ? 1.5 : 1, DECHARGE); lueurInstable(C, 0.8); }
      else if (id === 'recharge') contRecharge(C, dt);
      else if (id === 'transformation_ailes' && et === 'cambrure') contCambrure(C, dt, pr);
      else if (id === 'teleport_depart') contImplosion(C, dt, pr);
      else if (id === 'teleport_arrivee') { var h = tenir(PH.lueurBoss, lieuBoss); if (h) { var bk = lieuBoss === 'bunker'; ancre(A_CENTRE); h.motif = H_LUEUR; h.x = SO[0]; h.y = SO[1]; h.z = SO[2]; h.sx = h.sy = bk ? 1.1 : 1.8; h.tirer = bk ? 0 : 0.3; couleur(h, bk ? COUL.sangVif : COUL.energie, 1); h.i = (bk ? 0.7 : 1.2) * (1 - pr); } }
      else if (id === 'retour_rage') contRetourRage(C, dt, et, pr);
      else if (id === 'arrachement') contTelekinesie(C, dt, et, pr, a);
      else if (id === 'onde_choc' && et === 'preparation') contOndePreparation(C, dt, pr);
      else if (id === 'faiblesse') contInstable(C, dt, 1);
      else if (id === 'rituel_ames') contRituelAmes(C, dt, et, pr);
      else if (id === 'frappe' || id === 'frappe_ordinaire') contFrappe(C, dt, et, pr, id === 'frappe');
      else if (id === 'defaite') { if (et === 'chancelle') { DECHARGE.lieu = lieuBoss; dechargeArcs(C, dt, 0.8, DECHARGE); lueurInstable(C, 1); } else if (et === 'genoux') contInstable(C, dt, 0.6); }
      else if (id === 'siphon') contSiphon(C, dt, et, pr, a);                                   // v1.3
      else if (id === 'crochet') contCrochet(C, dt, et, pr);                                     // v1.4
      else if (id === 'evanouissement') contEvanouissement(C, dt, pr);                          // v1.5
      else if (id === 'resurgissement') contResurgissement(C, dt, pr);
      else if (id === 'pique' && et === 'etourdi') { var hs = tenir(PH.instable, lieuBoss); if (hs) { ancre(A_TETE); hs.motif = H_LUEUR; hs.x = SO[0]; hs.y = SO[1] + 0.15; hs.z = SO[2]; hs.sx = hs.sy = 0.7; couleur(hs, COUL.energie, 1); hs.i = 0.6 + 0.3 * Math.sin(HORLOGE[0] * 12); } }
    }
    function contApparition(C, dt, et, pr) {
      ancre(A_SOLBOSS);
      var gx = SO[0], gz = SO[2];
      var s = tenir(PH.sceauApparition, lieuBoss);
      if (s) {
        s.motif = S_SCEAU; s.x = gx; s.z = gz; s.hx = s.hz = 3.0; s.ang = 0.4;
        couleur(s, COUL.energie, 1);
        if (et === 'formation') { s.p0 = lisse(0, 0.85, pr); s.p1 = 0.7 + 0.6 * pr; s.p2 = 0; }
        else { s.p0 = 1; s.p1 = 1.3 * (1 - lisse(0.1, 1, pr)); s.p2 = Math.max(0, 0.6 - pr * 3); }
      }
      if (et === 'formation') {
        acc.conv += dt * 80 * (0.3 + pr) * Q.densite;
        var n = Math.floor(acc.conv); acc.conv -= n;
        if (n > 0) { emettreConv(C, GAB.convergence, n * 0.6 / Q.densite, A_CENTRE, 3.5, 8, -0.5, 4, 3.2, 1.4); emettreConv(C, GAB.energie, n * 0.4 / Q.densite, A_CENTRE, 2.5, 6, -0.5, 3, 2.5, 1.2); }
        var v = tenir(PH.vortexApparition, lieuBoss);
        if (v) { v.motif = V_VORTEX; ancre(A_SOLBOSS); v.x = SO[0]; v.y = SO[1]; v.z = SO[2]; v.sx = v.sz = 1.5 - 0.4 * pr; v.sy = 3.6; couleur(v, COUL.energie, 1); v.k = 0.6 * Math.sin(PI * Math.min(1, pr * 1.1)); }
        acc.ecl += dt;
        if (acc.ecl > 0.32 - 0.2 * pr) {
          acc.ecl = 0;
          var a = (ali() * K_ALEA) * TAU, r = 2.6, sy = sol(lieuBoss);
          ancre(A_CENTRE);
          var e = eclair(C, gx + Math.cos(a) * r, sy + 0.05, gz + Math.sin(a) * r, SO[0], SO[1], SO[2], 0.07, COUL.energie, 1.8, 0.16, 0.18);
          if (e) e.B = A_CENTRE;
        }
        ancre(A_CENTRE);
        (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.35, LC[5] = 0.1, LC[6] = 30 + 110 * pr, LC[7] = 14, lumiereLC(C));
      } else {
        acc.braises += dt * 12 * (1 - pr) * Q.densite;
        var nb = Math.floor(acc.braises); acc.braises -= nb;
        if (nb > 0) { ancre(A_CENTRE); emettre(C, GAB.braise, nb / Q.densite, SO[0], SO[1], SO[2], 0, 1, 0, 1.4); }
      }
    }
    function contIncantation(C, dt, trait, et, pr, a) {
      var force = et === 'preparation' ? pr : et === 'lancer' ? 1 : 1 - lisse(0, 0.8, pr);
      var mains = trait ? 1 : 2;
      for (var m = 0; m < mains; m++) {
        var ia = trait || m === 1 ? A_MAIND : A_MAING;
        var p = trait || m === 1 ? PH.mainD : PH.mainG, p2 = trait || m === 1 ? PH.mainD2 : PH.mainG2;
        ancre(ia);
        var h = tenir(p, lieuBoss);
        if (h) {
          h.motif = H_ORBE; h.x = SO[0]; h.y = SO[1]; h.z = SO[2]; h.tirer = 0.25;
          h.sx = h.sy = (trait ? 0.12 : 0.16) + (trait ? 0.2 : 0.32) * force;
          couleur(h, trait ? COUL.energieClaire : COUL.energie, 1); h.i = 0.4 + 1.4 * force * (et === 'lancer' ? 1.3 : 1);
        }
        var h2 = tenir(p2, lieuBoss);
        if (h2) { h2.motif = H_LUEUR; h2.x = SO[0]; h2.y = SO[1]; h2.z = SO[2]; h2.tirer = 0.3; h2.sx = h2.sy = 0.5 + 0.9 * force; couleur(h2, COUL.energie, 1); h2.i = 0.25 + 0.7 * force; }
        (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.4, LC[5] = 0.12, LC[6] = 15 + 60 * force, LC[7] = 9, lumiereLC(C));
      }
      if (et === 'preparation') {
        acc.mains += dt * (trait ? 45 : 60) * (0.4 + pr) * Q.densite;
        var n = Math.floor(acc.mains); acc.mains -= n;
        for (var k = 0; k < n; k++) emettreConv(C, GAB.energie, N1, (trait || k % 2) ? A_MAIND : A_MAING, 0.5, 1.4, -0.4, 0.5, 2.5, 0.8);
        acc.crepite += dt * 12 * pr;
        if (acc.crepite >= 1) { acc.crepite = 0; ancre(trait || (ali() * K_ALEA) < 0.5 ? A_MAIND : A_MAING); emettre(C, GAB.etincelle, 3, SO[0], SO[1], SO[2], 0, 0, 0, 0.5); }
      }
      // repère au sol du point visé par le sort (zone à venir)
      if (!trait && a.cible && et !== 'recuperation') {
        var s = tenir(PH.cibleSort, lieuBoss);
        if (s) { s.motif = S_CIBLE; s.x = a.cible.x; s.z = a.cible.z; s.y = sol(lieuBoss) + 0.02; s.hx = s.hz = 1.0; couleur(s, COUL.energie, 1); s.a = 1; s.p0 = 0.35 + 0.65 * force; s.p1 = 0; s.p2 = 0; }
      }
    }
    function lueurInstable(C, k) {
      var h = tenir(PH.instable, lieuBoss);
      if (!h) return;
      ancre(A_CENTRE);
      h.motif = H_LUEUR; h.x = SO[0]; h.y = SO[1] + 0.2; h.z = SO[2]; h.sx = h.sy = 1.6; h.tirer = 0.3;
      couleur(h, COUL.energie, 1);
      h.i = k * ((ali() * K_ALEA) < 0.25 ? 0.15 : 0.45 + 0.4 * (ali() * K_ALEA));
    }
    function contInstable(C, dt, k) {
      lueurInstable(C, k);
      acc.instArc -= dt;
      if (acc.instArc <= 0) {
        acc.instArc = entre(0.25, 0.8) / k;
        var src = ANCRES_CORPS[Math.floor((ali() * K_ALEA) * ANCRES_CORPS.length) % ANCRES_CORPS.length];
        ancre(src);
        uniteAlea();
        var d = entre(0.4, 1.1);
        var r = eclair(C, SO[0], SO[1], SO[2], SO[0] + SO[3] * d, SO[1] + SO[4] * d, SO[2] + SO[5] * d, 0.04, COUL.energie, 1.5, entre(0.08, 0.16), 0.22);
        if (r) r.A = src;
        emettre(C, GAB.etincelle, 4, SO[0] + SO[3] * d, SO[1] + SO[4] * d, SO[2] + SO[5] * d, 0, -1, 0, 0.5);
      }
      acc.instable += dt * 6 * k;
      if (acc.instable >= 1) { acc.instable = 0; ancre(A_CENTRE); emettre(C, GAB.etincelle, 2, SO[0], SO[1], SO[2], 0, 1, 0, 0.5); emettre(C, GAB.braise, 1, SO[0], SO[1], SO[2], 0, 1, 0, 0.6); }
      var s = tenir(PH.instableSol, lieuBoss);
      if (s) { ancre(A_SOLBOSS); s.motif = S_LUEUR; s.x = SO[0]; s.z = SO[2]; s.hx = s.hz = 1.8; couleur(s, COUL.energie, 1); s.a = 0.35 * k * ((ali() * K_ALEA) < 0.2 ? 0.3 : 1); s.p0 = 0.8; }
    }
    function contRecharge(C, dt) {
      acc.recharge += dt * 14 * Q.densite;
      var n = Math.floor(acc.recharge); acc.recharge -= n;
      if (n > 0) emettreConv(C, GAB.energie, n / Q.densite, A_POITRINE, 2.5, 5, -1, 2.5, 1.5, 0.9);
      var s = tenir(PH.lueurSol, lieuBoss);
      if (s) { ancre(A_SOLBOSS); s.motif = S_LUEUR; s.x = SO[0]; s.z = SO[2]; s.hx = s.hz = 2.2; couleur(s, COUL.energie, 1); s.a = 0.25 + 0.1 * Math.sin(HORLOGE[0] * 2.5); s.p0 = 0.5; }
    }
    function contCambrure(C, dt, pr) {
      acc.conv += dt * 60 * Q.densite;
      var n = Math.floor(acc.conv); acc.conv -= n;
      if (n > 0) emettreConv(C, GAB.energie, n / Q.densite, A_DOS, 1, 2.5, -0.5, 1.5, 2.0, 1.0);
      var h = tenir(PH.dos, lieuBoss);
      if (h) { ancre(A_DOS); h.motif = H_LUEUR; h.x = SO[0]; h.y = SO[1]; h.z = SO[2]; h.sx = h.sy = 0.6 + 1.2 * pr; couleur(h, COUL.energie, 1); h.i = 0.4 + 1.2 * pr; }
      ancre(A_DOS);
      (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.35, LC[5] = 0.1, LC[6] = 30 + 110 * pr, LC[7] = 12, lumiereLC(C));
    }
    function contImplosion(C, dt, pr) {
      var sang = lieuBoss === 'bunker';
      acc.conv += dt * 90 * Q.densite;
      var n = Math.floor(acc.conv); acc.conv -= n;
      if (n > 0) emettreConv(C, GAB.convergence, n / Q.densite, A_CENTRE, 1.0, 3.0, -1.0, 1.5, 3.0, 1.0, sang ? COUL.sangVif : null, sang ? COUL.sang : null);
      var v = tenir(PH.implosion, lieuBoss);
      if (v) { v.motif = V_IMPLOSION; v.ancre = A_CENTRE; var r = 1.7 * (1 - 0.8 * pr); v.sx = v.sy = v.sz = r; couleur(v, sang ? COUL.sangVif : COUL.energie, 1); v.a = 0.75; v.k = lisse(0, 0.3, pr) * (1 - lisse(0.85, 1, pr) * 0.5); }
      var h = tenir(PH.lueurImplosion, lieuBoss);
      if (h) { ancre(A_CENTRE); h.motif = H_LUEUR; h.x = SO[0]; h.y = SO[1]; h.z = SO[2]; h.sx = h.sy = sang ? 0.3 + 0.6 * pr : 0.4 + 0.9 * pr; h.tirer = sang ? 0 : 0.3; couleur(h, sang ? COUL.sangVif : COUL.energieClaire, 1); h.i = (0.4 + 1.6 * pr) * (sang ? 0.6 : 1); }
      ancre(A_CENTRE);
      (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = sang ? 0.1 : 0.35, LC[5] = 0.08, LC[6] = 30 + 120 * pr, LC[7] = 10, lumiereLC(C));
    }
    function contRetourRage(C, dt, et, pr) {
      if (et !== 'descente') return;
      ancre(A_CENTRE);
      var r = tenir(PH.trainéeDescente, lieuBoss);
      if (r) { r.style = R_ENERGIE; r.larg = 0.55; couleur(r, COUL.energie, 1.1); r.r2 = COUL.energieSombre[0]; r.g2 = COUL.energieSombre[1]; r.b2 = COUL.energieSombre[2]; pousserTrainee(r, SO[0], SO[1], SO[2]); }
      acc.braises += dt * 40 * Q.densite;
      var n = Math.floor(acc.braises); acc.braises -= n;
      if (n > 0) emettre(C, GAB.braise, n / Q.densite, SO[0], SO[1], SO[2], 0, 1, 0, 1.4);
      acc.ecl += dt;
      if (acc.ecl > 0.22) {
        acc.ecl = 0;
        var e = eclair(C, SO[0] + entre(-2, 2), PLAFOND + 1, SO[2] + entre(-2, 2), SO[0], SO[1] + 0.6, SO[2], 0.12, COUL.energieClaire, 2.4, 0.18, 0.12);
        if (e) e.B = A_TETE;
      }
      (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.35, LC[5] = 0.1, LC[6] = 120, LC[7] = 16, lumiereLC(C));
    }
    // Télékinésie : une vrille de la main vers chaque bloc désigné (v1.4 : salves, donnees.blocs ; sinon donnees.bloc)
    function contTelekinesie(C, dt, et, pr, a) {
      if (et === 'recuperation') return;
      var dn = a.donnees || VIDE, liste = dn.blocs && dn.blocs.length ? dn.blocs : null, n = liste ? liste.length : dn.bloc ? 1 : 0;
      if (!n) return;
      var mains = 0, salve = n > 1;
      for (var i = 0; i < n; i++) {
        var cible = suiviBloc(liste ? liste[i] : dn.bloc);
        if (!cible || cible.etatPrec === 'vol') continue;           // parti : plus de lien
        var main = i % 2 ? A_MAING : A_MAIND;
        mains |= i % 2 ? 2 : 1;
        var r = tenir(cible.p[3], lieuBoss);
        if (r) {
          r.type = RT_VRILLE; r.style = R_ENERGIE; r.A = main; r.B = cible.ancre; r.larg = salve ? 0.075 : 0.09; r.amp = 0.18; r.freq = 2.2; r.vit = 9; r.arche = 0.3 + 0.15 * (i % 2);
          (KC[0] = salve ? 1.1 : 1.3, r.r = COUL.energieClaire[0] * KC[0], r.g = COUL.energieClaire[1] * KC[0], r.b = COUL.energieClaire[2] * KC[0]); r.r2 = COUL.energie[0] * 1.3; r.g2 = COUL.energie[1] * 1.3; r.b2 = COUL.energie[2] * 1.3;
          r.croissance = et === 'designation' ? lisse(0, 0.6, pr) : 1;
        }
      }
      for (var m = 0; m < 2; m++) {
        if (!(mains & (m ? 2 : 1))) continue;
        var h = tenir(m ? PH.mainTelekG : PH.mainTelek, lieuBoss);
        if (h) { ancre(m ? A_MAING : A_MAIND); h.motif = H_ORBE; h.x = SO[0]; h.y = SO[1]; h.z = SO[2]; h.sx = h.sy = 0.28; h.tirer = 0.25; couleur(h, COUL.energie, 1); h.i = 1.1; }
      }
      ancre(A_MAIND);
      (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.4, LC[5] = 0.12, LC[6] = salve ? 60 : 40, LC[7] = 9, lumiereLC(C));
    }
    function contOndePreparation(C, dt, pr) {
      var s = tenir(PH.ondePrep, lieuBoss);
      if (s) {
        ancre(A_SOLBOSS);
        s.motif = S_SECTEUR; s.x = SO[0]; s.z = SO[2]; s.hx = s.hz = ONDE_RAYON; s.ang = 0;
        couleur(s, COUL.energie, 1); s.a = 1; s.p0 = 0.45 + 0.75 * pr; s.p1 = PI; s.p2 = 1; s.p3 = lisse(0, 1, pr);
      }
      acc.conv += dt * 70 * Q.densite;
      var n = Math.floor(acc.conv); acc.conv -= n;
      if (n > 0) emettreConv(C, GAB.energie, n / Q.densite, A_SOLBOSS, 1.5, ONDE_RAYON, 0.05, 0.4, 1.0, 0.9);
      ancre(A_CENTRE);
      (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.35, LC[5] = 0.1, LC[6] = 40 + 130 * pr, LC[7] = 12, lumiereLC(C));
    }
    var JOUEURS_TMP = [];
    function contRituelAmes(C, dt, et, pr) {
      var sang = false;
      if (et === 'elevation') {
        acc.conv += dt * 60 * Q.densite;
        var n = Math.floor(acc.conv); acc.conv -= n;
        if (n > 0) emettreConv(C, (ali() * K_ALEA) < 0.5 ? GAB.ame : GAB.energie, n / Q.densite, A_POITRINE, 3, 7, -1, 3, 2.5, 1.0);
      }
      if (et === 'incantation' || et === 'capture') {
        var v = tenir(PH.vortexAmes, lieuBoss);
        if (v) { v.motif = V_VORTEX; ancre(A_SOLBOSS); v.x = SO[0]; v.y = SO[1]; v.z = SO[2]; v.sx = v.sz = 2.2; v.sy = 4.6; couleur(v, COUL.ame, 1); v.k = et === 'incantation' ? 0.2 + 0.3 * pr : 0.5; }
        var croissance = et === 'incantation' ? lisse(0.25, 1, pr) : 1;
        // vrilles vers chaque joueur (le joueur local, plus ceux fournis par ctx.joueurs)
        var nj = listeJoueurs();
        for (var j = 0; j < nj && j < PH_VRILLES_J.length; j++) {
          var J = JOUEURS_TMP[j];
          if (J.lieu && J.lieu !== lieuBoss) continue;
          var ia = A_DYN + NB_DYN - 1 - j;
          (ANC[(ia) * 3] = J.position.x, ANC[(ia) * 3 + 1] = J.position.y + 1.1, ANC[(ia) * 3 + 2] = J.position.z, ANC_T[ia] = trame);
          var r = tenir(PH_VRILLES_J[j], lieuBoss);
          if (r) {
            r.type = RT_VRILLE; r.style = R_AME; r.A = A_POITRINE; r.B = ia; r.larg = 0.14; r.amp = 0.35; r.freq = 1.6; r.vit = 7; r.arche = 0.6; r.croissance = croissance;
            couleur(r, COUL.energie, 1.2); r.r2 = COUL.ame[0] * 1.4; r.g2 = COUL.ame[1] * 1.4; r.b2 = COUL.ame[2] * 1.4;
          }
          if (et === 'capture') {
            acc.ames += dt * 30 * Q.densite;
            var m = Math.floor(acc.ames); acc.ames -= m;
            if (m > 0) emettreConvDepuis(C, GAB.ame, m / Q.densite, A_POITRINE, J.position.x, J.position.y + 1.1, J.position.z, 0.4, 1.5, 1.0);
          }
        }
        ancre(A_POITRINE);
        (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 0.4, LC[4] = 1.0, LC[5] = 0.85, LC[6] = 40 + 90 * (et === 'capture' ? 1 : pr), LC[7] = 14, lumiereLC(C));
      }
      void sang;
    }
    var PH_VRILLES_J = [poignee('vrille', 0.3), poignee('vrille', 0.3), poignee('vrille', 0.3), poignee('vrille', 0.3)];
    function listeJoueurs() {
      var n = 0;
      if (joueurLocal && joueurLocal.position) JOUEURS_TMP[n++] = joueurLocal;
      if (joueursCtx && joueursCtx.length) {
        for (var i = 0; i < joueursCtx.length && n < 4; i++) {
          var J = joueursCtx[i];
          if (!J || !J.position || (joueurLocal && J.id === joueurLocal.id) || J.vivant === false) continue;
          JOUEURS_TMP[n++] = J;
        }
      }
      return n;
    }
    var FRAPPE_POIGNEES = [PH.pointeG, PH.pointeD, PH.lameG, PH.lameD], FRAPPE_ANCRES = [A_POINTEG, A_POINTED, A_LAMEG, A_LAMED];
    function contFrappe(C, dt, et, pr, speciale) {
      if (et === 'recuperation') return;
      var k = et === 'preparation' ? pr : 1 - lisse(0, 1, pr);
      var c = PAL.bleu ? COUL.glace : speciale ? COUL.sangVif : COUL.energie;
      var puls = 0.75 + 0.25 * Math.sin(HORLOGE[0] * (speciale ? 30 : 18));
      for (var i = 0; i < 4; i++) {
        var h = tenir(FRAPPE_POIGNEES[i], lieuBoss);
        if (!h) continue;
        ancre(FRAPPE_ANCRES[i]);
        h.motif = H_LUEUR; h.x = SO[0]; h.y = SO[1]; h.z = SO[2]; h.tirer = 0.2;
        h.sx = h.sy = (i < 2 ? 0.26 : 0.34) * (0.6 + 0.6 * k) * (speciale ? 1.15 : 0.85);
        couleur(h, c, 1); h.i = (0.6 + 1.6 * k) * puls * (speciale ? 1.2 : 0.7) * PAL.k;
      }
      if (et === 'preparation') {
        var B = BOSS, s = tenir(PH.secteur, lieuBoss);
        if (s && B && B.position) {
          s.motif = S_SECTEUR; s.x = B.position.x; s.z = B.position.z; s.y = sol(lieuBoss) + 0.02; s.hx = s.hz = FRAPPE_PORTEE + 0.35; s.ang = +B.lacet || 0;
          couleur(s, c, 1); s.a = 1; s.p0 = (speciale ? 0.55 : 0.3) + (speciale ? 0.8 : 0.4) * pr; s.p1 = FRAPPE_ANGLE * 0.5; s.p2 = 1; s.p3 = 0;
        }
        ancre(A_POITRINE);
        (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = c[0], LC[4] = c[1], LC[5] = c[2], LC[6] = ((speciale ? 50 : 25) + (speciale ? 110 : 45) * pr) * PAL.k, LC[7] = 8, lumiereLC(C));
        acc.brume += dt * (speciale ? 18 : 8);
        if (acc.brume >= 1) { acc.brume = 0; ancre((ali() * K_ALEA) < 0.5 ? A_POINTEG : A_POINTED); emettre(C, PAL.brume, 1, SO[0], SO[1], SO[2], 0, 1, 0, 1.0); }
      }
    }
    function contFumeeCadavre(C, dt) {
      var B = BOSS;
      if (!B || !B.position) return;
      var la = +B.lacet || 0, fx = Math.sin(la), fz = Math.cos(la), sy = sol(lieuBoss);
      acc.fumee += dt * 5.0;
      while (acc.fumee >= 1) {
        acc.fumee -= 1;
        var u = entre(-0.2, 1.4);
        emettre(C, GAB.fumee, N1, B.position.x - fx * u, sy + 0.25, B.position.z - fz * u, 0, 1, 0, 1.0);
      }
      acc.braises += dt * 1.8;
      while (acc.braises >= 1) {
        acc.braises -= 1;
        var u2 = entre(-0.2, 1.4);
        emettre(C, GAB.braise, N1, B.position.x - fx * u2, sy + 0.2, B.position.z - fz * u2, 0, 1, 0, 0.7);
      }
    }

    // ─────────────────────────────── suivis (projectiles, zones, âmes, blocs, vrilles) ───────────────────────────────
    function Suivi() { this.id = null; this.vu = false; this.age = 0; this.p = []; this.etatPrec = null; this.ancre = -1; this.lat = 0; this.x = 0; this.y = 0; this.z = 0; this.acc = 0; this.extrait = false; }
    function creerSuivis(n, types) {
      var l = [];
      for (var i = 0; i < n; i++) { var s = new Suivi(); for (var k = 0; k < types.length; k++) s.p.push(poignee(types[k], types[k] === 'trainee' ? 0.6 : 0.25)); l.push(s); }
      return l;
    }
    function trouverSuivi(L, id, creer2) {
      for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
      if (!creer2) return null;
      for (var j = 0; j < L.length; j++) if (L[j].id === null) { var s = L[j]; s.id = id; s.age = 0; s.etatPrec = null; s.lat = entre(-1, 1); s.acc = 0; s.extrait = false; return s; }
      return null;
    }
    function finSuivis(L) { for (var i = 0; i < L.length; i++) { if (L[i].id !== null && !L[i].vu) L[i].id = null; L[i].vu = false; } }
    var SUIVI_PROJ = creerSuivis(8, ['halo', 'halo', 'trainee', 'sol']);
    var SUIVI_ZONES = creerSuivis(8, ['sol']);
    var SUIVI_AMES = creerSuivis(12, ['halo', 'trainee']);
    var SUIVI_BLOCS = creerSuivis(10, ['halo', 'trainee', 'sol', 'vrille']);   // v1.4 : salves (4 blocs et plus à la fois)
    var SUIVI_VRILLES = creerSuivis(6, ['vrille', 'halo']);
    for (var sb = 0; sb < SUIVI_BLOCS.length; sb++) SUIVI_BLOCS[sb].ancre = A_BLOCS + sb;
    for (var sv = 0; sv < SUIVI_VRILLES.length; sv++) SUIVI_VRILLES[sv].ancre = A_VRILLES + sv;
    function suiviBloc(id) { return trouverSuivi(SUIVI_BLOCS, id, false); }

    function majProjectiles(dt, E) {
      var L = E.projectiles;
      if (L && L.length) {
        var C = couche(lieuBoss);
        for (var i = 0; i < L.length; i++) {
          var p = L[i];
          if (!p || !p.position) continue;
          var s = trouverSuivi(SUIVI_PROJ, p.id, true);
          if (!s) continue;
          s.vu = true; s.age += dt;
          var trait = p.type === 'trait', x = p.position.x, y = p.position.y, z = p.position.z;
          var h = tenir(s.p[0], lieuBoss);
          if (h) {
            h.motif = H_ORBE; h.x = x; h.y = y; h.z = z; h.tirer = 0.1; h.sx = h.sy = trait ? 0.22 : 0.38;
            couleur(h, trait ? COUL.energieClaire : COUL.energie, 1); h.i = 1.6;
            if (trait && p.vitesse) { h.motif = H_AME; h.vx = p.vitesse.x; h.vy = p.vitesse.y; h.vz = p.vitesse.z; h.sx = 0.45; h.sy = 0.12; couleur(h, COUL.energieClaire, 1); h.i = 2.0; }
          }
          var h2 = tenir(s.p[1], lieuBoss);
          if (h2) { h2.motif = H_LUEUR; h2.x = x; h2.y = y; h2.z = z; h2.sx = h2.sy = trait ? 0.7 : 1.2; couleur(h2, COUL.energie, 1); h2.i = 0.7; }
          var r = tenir(s.p[2], lieuBoss);
          if (r) { r.style = R_TRAINEE; r.larg = trait ? 0.12 : 0.26; couleur(r, trait ? COUL.energieClaire : COUL.energie, 1.4); r.r2 = COUL.energieSombre[0]; r.g2 = COUL.energieSombre[1]; r.b2 = COUL.energieSombre[2]; pousserTrainee(r, x, y, z); }
          s.acc += dt * (trait ? 30 : 40) * Q.densite;
          var n = Math.floor(s.acc); s.acc -= n;
          if (n > 0) { emettre(C, GAB.braise, n * 0.6 / Q.densite, x, y, z, 0, 0, 0, 0.7); emettre(C, GAB.energie, n * 0.4 / Q.densite, x, y, z, 0, 0, 0, 0.6); }
          if (!trait && p.cible) {
            var sc = tenir(s.p[3], lieuBoss);
            if (sc) { sc.motif = S_CIBLE; sc.x = p.cible.x; sc.z = p.cible.z; sc.y = sol(lieuBoss) + 0.02; sc.hx = sc.hz = 1.1; couleur(sc, COUL.energie, 1); sc.a = 1; sc.p0 = 1; sc.p1 = 0.6; sc.p2 = 0; }
          }
          (LC[0] = x, LC[1] = y, LC[2] = z, LC[3] = 1.0, LC[4] = 0.4, LC[5] = 0.12, LC[6] = trait ? 40 : 70, LC[7] = 9, lumiereLC(C));
        }
      }
      finSuivis(SUIVI_PROJ);
    }
    function majZones(dt, E) {
      var L = E.zones;
      if (L && L.length) {
        var C = couche(lieuBoss);
        for (var i = 0; i < L.length; i++) {
          var zn = L[i];
          if (!zn || !zn.position) continue;
          var s = trouverSuivi(SUIVI_ZONES, zn.id, true);
          if (!s) continue;
          s.vu = true; s.age += dt;
          var o = tenir(s.p[0], lieuBoss);
          var ph = zn.etat === 'marquee' ? 0 : zn.etat === 'active' ? 1 : 2, k = zn.duree > 0 ? clamp(zn.t / zn.duree, 0, 1) : 1;
          if (o) {
            o.motif = S_ZONE; o.x = zn.position.x; o.z = zn.position.z; o.y = sol(lieuBoss) + 0.02; o.hx = o.hz = (zn.rayon || 2.4) * 1.03;
            couleur(o, COUL.energie, 1); o.a = 1; o.p0 = ph; o.p1 = k; o.q0 = s.age;
          }
          var R = zn.rayon || 2.4;
          if (ph === 1) {
            s.acc += dt * R * R * 2.2 * Q.densite;
            while (s.acc >= 1) {
              s.acc -= 1;
              var a = (ali() * K_ALEA) * TAU, rr = Math.sqrt((ali() * K_ALEA)) * R * 0.9;
              emettre(C, (ali() * K_ALEA) < 0.35 ? GAB.brumeRouge : GAB.energie, N1, zn.position.x + Math.cos(a) * rr, sol(lieuBoss) + 0.05, zn.position.z + Math.sin(a) * rr, 0, 1, 0, 0.7);
            }
            (LC[0] = zn.position.x, LC[1] = sol(lieuBoss) + 0.6, LC[2] = zn.position.z, LC[3] = 1.0, LC[4] = 0.18, LC[5] = 0.05, LC[6] = 25, LC[7] = R * 2.5, lumiereLC(C));
          } else if (ph === 0) {
            s.acc += dt * 24 * (0.3 + k) * Q.densite;
            while (s.acc >= 1) {
              s.acc -= 1;
              var a2 = (ali() * K_ALEA) * TAU;
              emettre(C, GAB.energie, N1, zn.position.x + Math.cos(a2) * R * 0.97, sol(lieuBoss) + 0.05, zn.position.z + Math.sin(a2) * R * 0.97, -Math.cos(a2), 0.3, -Math.sin(a2), 0.6);
            }
          }
        }
      }
      finSuivis(SUIVI_ZONES);
    }
    function majAmes(dt, E) {
      var L = E.ames;
      if (L && L.length) {
        var C = couche(lieuBoss);
        ancre(A_POITRINE);
        var tx = SO[0], ty = SO[1], tz = SO[2];
        for (var i = 0; i < L.length; i++) {
          var a = L[i];
          if (!a || !a.depart) continue;
          var s = trouverSuivi(SUIVI_AMES, a.id, true);
          if (!s) continue;
          s.vu = true;
          var u = clamp(a.duree > 0 ? a.t / a.duree : 1, 0, 1), e = u * u * (3 - 2 * u);
          var sx = a.depart.x, sy = a.depart.y, sz = a.depart.z;
          var dx = tx - sx, dz = tz - sz, d = Math.sqrt(dx * dx + dz * dz) || 1;
          var cx = (sx + tx) / 2 - dz / d * s.lat * d * 0.3, cy = Math.max(sy, ty) + 1.0 + 0.2 * d, cz = (sz + tz) / 2 + dx / d * s.lat * d * 0.3;
          var m = 1 - e;
          var px = m * m * sx + 2 * m * e * cx + e * e * tx, py = m * m * sy + 2 * m * e * cy + e * e * ty, pz = m * m * sz + 2 * m * e * cz + e * e * tz;
          var vx = 2 * m * (cx - sx) + 2 * e * (tx - cx), vy = 2 * m * (cy - sy) + 2 * e * (ty - cy), vz = 2 * m * (cz - sz) + 2 * e * (tz - cz);
          var h = tenir(s.p[0], lieuBoss);
          if (h) { h.motif = H_AME; h.x = px; h.y = py; h.z = pz; h.vx = vx; h.vy = vy; h.vz = vz; h.sx = 0.42; h.sy = 0.2; h.tirer = 0.1; couleur(h, COUL.ameClaire, 1); h.i = 1.5; }
          var r = tenir(s.p[1], lieuBoss);
          if (r) { r.style = R_AME; r.larg = 0.3; couleur(r, COUL.ame, 1.3); r.r2 = COUL.ameSombre[0]; r.g2 = COUL.ameSombre[1]; r.b2 = COUL.ameSombre[2]; pousserTrainee(r, px, py, pz); }
          s.acc += dt * 26 * Q.densite;
          var n = Math.floor(s.acc); s.acc -= n;
          if (n > 0) emettre(C, GAB.ame, n / Q.densite, px, py, pz, 0, 0, 0, 0.6);
          (LC[0] = px, LC[1] = py, LC[2] = pz, LC[3] = 0.45, LC[4] = 1.0, LC[5] = 0.85, LC[6] = 25, LC[7] = 7, lumiereLC(C));
        }
      }
      finSuivis(SUIVI_AMES);
    }
    function majPuissance(dt, E) {
      var B = E.boss, pw = B ? clamp(nombre(B.puissance, 0), 0, 1) : 0;
      if (!bossVisible || pw <= 0.001 || !B) return;
      var C = couche(lieuBoss), nb = Math.min(PH_AMES_ORBITE.length, Math.round(pw * Math.min(10, AMES_AILES)));
      ancre(A_POITRINE);
      var cx = SO[0], cy = SO[1] - 0.35, cz = SO[2];
      for (var i = 0; i < nb; i++) {
        var h = tenir(PH_AMES_ORBITE[i], lieuBoss);
        if (!h) continue;
        var ph = i * 2.399 + HORLOGE[0] * (1.1 + 0.07 * i), rr = 0.75 + 0.18 * Math.sin(HORLOGE[0] * 1.3 + i), hy = 0.4 * Math.sin(HORLOGE[0] * 0.9 + i * 1.7);
        h.motif = H_AME; h.x = cx + Math.sin(ph) * rr; h.y = cy + hy; h.z = cz + Math.cos(ph) * rr;
        h.vx = Math.cos(ph); h.vy = 0.15 * Math.cos(HORLOGE[0] * 0.9 + i * 1.7); h.vz = -Math.sin(ph);
        h.sx = 0.26; h.sy = 0.12; couleur(h, COUL.ame, 1); h.i = 0.8 + 0.6 * pw;
      }
      var s = tenir(PH.puissanceSol, lieuBoss);
      if (s) { ancre(A_SOLBOSS); s.motif = S_LUEUR; s.x = SO[0]; s.z = SO[2]; s.hx = s.hz = 1.2 + 1.6 * pw; couleurMix(s, COUL.energie, COUL.ame, 0.35, 1); s.a = 0.18 + 0.5 * pw; s.p0 = 0.6; }
      acc.puissance += dt * 14 * pw * Q.densite;
      var n = Math.floor(acc.puissance); acc.puissance -= n;
      if (n > 0) emettre(C, (ali() * K_ALEA) < 0.6 ? GAB.ame : GAB.braise, n / Q.densite, cx, cy - 0.4, cz, 0, 1, 0, 1.2);
      (LC[0] = cx, LC[1] = cy, LC[2] = cz, LC[3] = 0.6, LC[4] = 0.9, LC[5] = 0.8, LC[6] = 10 + 35 * pw, LC[7] = 9, lumiereLC(C));
    }
    function majPique(dt, E) {
      var P = E.pique, a = ACT;
      if (!P || !P.depart || !P.arrivee) return;
      var C = couche(lieuBoss), sy = sol(lieuBoss);
      var dx = P.arrivee.x - P.depart.x, dz = P.arrivee.z - P.depart.z, L = Math.sqrt(dx * dx + dz * dz);
      var ux = L > 1e-3 ? dx / L : Math.sin(+BOSS.lacet || 0), uz = L > 1e-3 ? dz / L : Math.cos(+BOSS.lacet || 0);
      var et = P.etape, pr = a && a.id === 'pique' ? nombre(a.progression, 0) : 0;
      var verrou = 0, inten = 1, charge = 0;
      if (et === 'montee') inten = 0.25 + 0.4 * pr;
      else if (et === 'visee') { inten = 0.7 + 0.3 * pr; if (a && a.id === 'pique' && a.etape === 'visee' && a.duree != null && a.t >= a.duree - PIQUE_VERROU - 1e-6) verrou = 1; }
      else if (et === 'charge') { verrou = 1; charge = 1; inten = 1.1; }
      else if (et === 'impact') { verrou = 1; inten = 0.6 * (1 - pr); }
      var s = tenir(PH.couloir, lieuBoss);
      if (s) {
        var tot = L + PIQUE_DEPASSEMENT;
        s.motif = S_COULOIR; s.x = P.depart.x + ux * tot / 2; s.z = P.depart.z + uz * tot / 2; s.y = sy + 0.02;
        s.hx = PIQUE_RAYON + 0.35; s.hz = Math.max(0.5, tot / 2); s.ang = Math.atan2(ux, uz);
        couleurMix(s, COUL.energie, COUL.energieClaire, verrou * 0.6, 1); s.a = 1; s.p0 = inten; s.p1 = verrou; s.p2 = charge;
      }
      var c = tenir(PH.ciblePique, lieuBoss);
      if (c) { c.motif = S_CIBLE; c.x = P.arrivee.x; c.z = P.arrivee.z; c.y = sy + 0.025; c.hx = c.hz = PIQUE_RAYON * 1.15; couleurMix(c, COUL.energie, COUL.rituelBlanc, verrou * 0.5, 1); c.a = 1; c.p0 = inten; c.p1 = verrou; c.p2 = 0; }
      if (et === 'charge') {
        ancre(A_CENTRE);
        var r = tenir(PH.trainéePique, lieuBoss);
        if (r) { r.style = R_TRAINEE; r.larg = 1.3; couleur(r, COUL.energie, 1.3); r.r2 = COUL.energieSombre[0]; r.g2 = COUL.energieSombre[1]; r.b2 = COUL.energieSombre[2]; pousserTrainee(r, SO[0], SO[1], SO[2]); }
        emettre(C, GAB.braise, 3, SO[0], SO[1], SO[2], -ux, 0.2, -uz, 1.2);
        emettre(C, GAB.etincelle, 2, SO[0], SO[1], SO[2], -ux, 0.1, -uz, 1.0);
        (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = 1.0, LC[4] = 0.35, LC[5] = 0.1, LC[6] = 150, LC[7] = 14, lumiereLC(C));
      }
      if (verrou && et === 'visee') (LC[0] = P.arrivee.x, LC[1] = sy + 0.5, LC[2] = P.arrivee.z, LC[3] = 1.0, LC[4] = 0.45, LC[5] = 0.2, LC[6] = 40, LC[7] = 6, lumiereLC(C));
    }
    function majBlocs(dt, E) {
      var L = E.blocs;
      if (L && L.length) {
        var C = couche('salle');
        var salve = !!(ACT && ACT.id === 'arrachement' && ACT.donnees && ACT.donnees.salve);   // v1.4 : désignations simultanées
        for (var i = 0; i < L.length; i++) {
          var b = L[i];
          if (!b) continue;
          var s = trouverSuivi(SUIVI_BLOCS, b.id, true);
          if (!s) continue;
          s.vu = true;
          var D = DALLES[b.id], et = b.etat;
          if (b.position) (ANC[(s.ancre) * 3] = b.position.x, ANC[(s.ancre) * 3 + 1] = b.position.y, ANC[(s.ancre) * 3 + 2] = b.position.z, ANC_T[s.ancre] = trame);
          if (et !== s.etatPrec) {
            if (et === 'arrache' && D) fxArrachement(D);
            else if (et === 'vol' && b.position) { emettre(C, GAB.poussiere, 8, b.position.x, b.position.y, b.position.z, 0, 0, 0, 1.0); halo(C, H_ECLAT, b.position.x, b.position.y, b.position.z, 0.5, 2.0, COUL.energieClaire, 1.4, 0.25, C_FLASH, 0.3); }
            else if (et === 'fissure' && D) { emettre(C, GAB.poussiere, 6, D.x + D.nx * 0.4, D.y, D.z + D.nz * 0.4, D.nx, 0, D.nz, 0.8); }
            s.etatPrec = et;
          }
          if (et === 'fissure' && D) {
            var k = clamp(nombre(b.t, 0) / T_DESIGNATION, 0, 1);
            var h = tenir(s.p[0], 'salle');
            var fl = 0.8 + 0.2 * Math.sin(HORLOGE[0] * 20 + i * 1.7);
            if (h) { h.motif = H_LUEUR; h.x = D.x + D.nx * 0.45; h.y = D.y; h.z = D.z + D.nz * 0.45; h.sx = h.sy = (1.4 + 0.6 * k) * (salve ? 1.2 : 1); couleur(h, COUL.energie, 1); h.i = (0.35 + 0.9 * k) * fl * (salve ? 1.25 : 1); h.tirer = 0; }
            if (salve) {                                     // salve : lueur au pied du mur, repérable du coin de l'œil
              var sl = tenir(s.p[2], 'salle');
              if (sl) { sl.motif = S_LUEUR; sl.x = D.x + D.nx * 0.9; sl.z = D.z + D.nz * 0.9; sl.y = SOL_SALLE + 0.02; sl.hx = sl.hz = 1.5; couleur(sl, COUL.energie, 1); sl.a = (0.25 + 0.45 * k) * fl; sl.p0 = sl.p1 = sl.p2 = 0; }
            }
            s.acc += dt * 14 * Q.densite;
            while (s.acc >= 1) {
              s.acc -= 1;
              var u = entre(-0.5, 0.5), tx = -D.nz, tz = D.nx;
              emettre(C, GAB.filet, N1, D.x + D.nx * 0.33 + tx * u * D.l, D.y - D.h * 0.45, D.z + D.nz * 0.33 + tz * u * D.l, 0, -1, 0, 1.0);
            }
            if ((ali() * K_ALEA) < dt * 8) emettre(C, GAB.etincelle, 2, D.x + D.nx * 0.35, D.y + entre(-1, 1), D.z + D.nz * 0.35, D.nx, 0.2, D.nz, 0.5);
            (LC[0] = D.x + D.nx * 0.8, LC[1] = D.y, LC[2] = D.z + D.nz * 0.8, LC[3] = 1.0, LC[4] = 0.3, LC[5] = 0.08, LC[6] = 30 + 60 * k, LC[7] = 8, lumiereLC(C));
          } else if ((et === 'arrache' || et === 'levitation' || et === 'vol') && b.position) {
            var x = b.position.x, y = b.position.y, z = b.position.z;
            var h2 = tenir(s.p[0], 'salle');
            if (h2) { h2.motif = H_LUEUR; h2.x = x; h2.y = y; h2.z = z; h2.sx = h2.sy = 2.4; couleur(h2, COUL.energie, 1); h2.i = et === 'vol' ? 0.7 : 0.55 + 0.15 * Math.sin(HORLOGE[0] * 6); h2.tirer = 0.6; }
            s.acc += dt * (et === 'vol' ? 30 : 18) * Q.densite;
            while (s.acc >= 1) {
              s.acc -= 1;
              uniteAlea();
              if (et === 'levitation' && (ali() * K_ALEA) < 0.5) emettreOrbite(C, GAB.energie, N1, s.ancre, 1.5, -0.6, 0.6, 3.0, 0, 0.2, 0.8);
              else emettre(C, GAB.filet, N1, x + SO[3] * 1.2, y - 0.9, z + SO[5] * 1.2, 0, -1, 0, 1.0);
            }
            if (et === 'vol') {
              var r = tenir(s.p[1], 'salle');
              if (r) { r.style = R_ENERGIE; r.larg = 1.1; couleur(r, COUL.energie, 0.9); r.r2 = COUL.energieSombre[0]; r.g2 = COUL.energieSombre[1]; r.b2 = COUL.energieSombre[2]; pousserTrainee(r, x, y, z); }
            }
            if ((et === 'levitation' || et === 'vol') && b.pointImpact) {
              var c = tenir(s.p[2], 'salle');
              if (c) { c.motif = S_CIBLE; c.x = b.pointImpact.x; c.z = b.pointImpact.z; c.y = SOL_SALLE + 0.02; c.hx = c.hz = RAYON_BLOC * 1.1; couleur(c, COUL.energie, 1); c.a = 1; c.p0 = et === 'vol' ? 1 : 0.8; c.p1 = et === 'vol' ? 1 : 0; c.p2 = 0; }
            }
            (LC[0] = x, LC[1] = y, LC[2] = z, LC[3] = 1.0, LC[4] = 0.35, LC[5] = 0.1, LC[6] = 45, LC[7] = 9, lumiereLC(C));
          } else if (et === 'reconstruction' && D) {
            var k2 = clamp(nombre(b.t, 0) / T_RECONSTRUCTION, 0, 1);
            var h3 = tenir(s.p[0], 'salle');
            if (h3) { h3.motif = H_LUEUR; h3.x = D.x + D.nx * 0.45; h3.y = D.y; h3.z = D.z + D.nz * 0.45; h3.sx = h3.sy = 1.6; couleur(h3, COUL.rituel, 1); h3.i = 0.25 + 0.5 * Math.sin(PI * k2); h3.tirer = 0; }
            s.acc += dt * 34 * Q.densite;
            (ANC[(s.ancre) * 3] = D.x + D.nx * 0.32, ANC[(s.ancre) * 3 + 1] = D.y, ANC[(s.ancre) * 3 + 2] = D.z + D.nz * 0.32, ANC_T[s.ancre] = trame);
            var ia = s.ancre;
            while (s.acc >= 1) {
              s.acc -= 1;
              var u2 = entre(-1.6, 1.6), d2 = entre(1.5, 4.5);
              emettreConvDepuis(C, GAB.rituel, N1, ia, D.x + D.nx * d2 - D.nz * u2, SOL_SALLE + 0.1, D.z + D.nz * d2 + D.nx * u2, 0.2, 0.5, 1.6, COUL.rituelBlanc, COUL.energieClaire);
            }
          }
        }
      }
      finSuivis(SUIVI_BLOCS);
    }
    // vrilles d'absorption (phase 2)
    var ABS = { actif: false, cibles: null, t: 0 };
    function majVrilles(dt, E) {
      var a = ACT;
      if (!ABS.actif || !ABS.cibles || !a || a.id !== 'absorption' || a.etape === 'fin' || !monde || typeof monde.positionZombie !== 'function') { finSuivis(SUIVI_VRILLES); return; }
      ABS.t += dt;
      var C = couche(lieuBoss);
      for (var i = 0; i < ABS.cibles.length && i < SUIVI_VRILLES.length; i++) {
        var id = ABS.cibles[i];
        var s = trouverSuivi(SUIVI_VRILLES, id, true);
        if (!s || s.extrait) { if (s) s.vu = true; continue; }
        var p = null;
        try { p = monde.positionZombie(id); } catch (e) { p = null; }
        if (!p) continue;
        s.vu = true;
        (ANC[(s.ancre) * 3] = p.x, ANC[(s.ancre) * 3 + 1] = p.y + 1.25, ANC[(s.ancre) * 3 + 2] = p.z, ANC_T[s.ancre] = trame);
        var main = i % 2 ? A_MAING : A_MAIND;
        var r = tenir(s.p[0], lieuBoss);
        if (r) {
          r.type = RT_VRILLE; r.style = R_ENERGIE; r.A = main; r.B = s.ancre; r.larg = 0.1; r.amp = 0.16; r.freq = 2.6; r.vit = 8; r.arche = 0.25;
          r.croissance = lisse(0, 0.35, ABS.t);
          couleur(r, COUL.energie, 1.3); r.r2 = COUL.ame[0] * 1.3; r.g2 = COUL.ame[1] * 1.3; r.b2 = COUL.ame[2] * 1.3;
        }
        var h = tenir(s.p[1], lieuBoss);
        if (h) { h.motif = H_LUEUR; h.x = p.x; h.y = p.y + 1.25; h.z = p.z; h.sx = h.sy = 0.7; couleur(h, COUL.ame, 1); h.i = 0.5 + 0.2 * Math.sin(HORLOGE[0] * 9 + i); }
        s.acc += dt * 16 * Q.densite;
        var n = Math.floor(s.acc); s.acc -= n;
        if (n > 0 && ABS.t > 0.25) emettreConvDepuis(C, GAB.ame, n / Q.densite, main, p.x, p.y + 1.25, p.z, 0.25, 0.8, 0.8);
        (LC[0] = p.x, LC[1] = p.y + 1.3, LC[2] = p.z, LC[3] = 0.45, LC[4] = 1.0, LC[5] = 0.85, LC[6] = 12, LC[7] = 5, lumiereLC(C));
      }
      finSuivis(SUIVI_VRILLES);
    }
    function majRituel(dt, E) {
      var et = E.etat, cap = E.capture;
      if (et !== 'rituel' && et !== 'rituel_fin') return;
      var C = couche('salle');
      var s = tenir(PH.cercle, 'salle');
      var k = 1, code = 1, prog = 0, inten = 0.7, flash = 0;
      if (et === 'rituel') {
        k = clamp(E.tempsEtat / T_FORMATION, 0, 1);
        if (cap && cap.etat !== 'formation') {
          prog = clamp(nombre(cap.progression, 0), 0, 1);
          code = cap.etat === 'capture' ? 2 : cap.etat === 'conteste' ? 3 : cap.etat === 'recul' ? 4 : 1;
          inten = code === 2 ? 1.15 : code === 3 ? 0.9 : code === 4 ? 0.55 : 0.65;
        } else { code = 0; inten = 0.6 + 0.5 * k; }
      } else {
        var tf = clamp(E.tempsEtat / T_FIN_RITUEL, 0, 1);
        code = 5; prog = 1; inten = 1.4 * (1 - lisse(K_EXPLOSION, K_EXPLOSION + 0.25, tf)); flash = 0.5 * lisse(0, K_EXPLOSION, tf) * (1 - lisse(K_EXPLOSION, K_EXPLOSION + 0.1, tf));
      }
      if (s) {
        s.motif = S_CERCLE; s.x = CERCLE_X; s.z = CERCLE_Z; s.y = SOL_SALLE + 0.02; s.hx = s.hz = R_RITUEL * CERCLE_ECHELLE; s.ang = 0;
        couleur(s, COUL.rituel, 1); s.a = 1;
        s.p0 = k; s.p1 = code; s.p2 = prog; s.p3 = HORLOGE[0]; s.q0 = inten; s.q1 = flash;
      }
      // énergie qui monte du cercle, crépitements quand c'est contesté
      var taux = code === 0 ? 10 + 40 * k : code === 2 ? 45 : code === 3 ? 12 : code === 4 ? 6 : code === 5 ? 90 : 14;
      acc.rituel += dt * taux * Q.densite;
      while (acc.rituel >= 1) {
        acc.rituel -= 1;
        var a = (ali() * K_ALEA) * TAU, rr = R_RITUEL * (code === 5 ? Math.sqrt((ali() * K_ALEA)) : entre(0.6, 1.0));
        var px = CERCLE_X + Math.sin(a) * rr, pz = CERCLE_Z + Math.cos(a) * rr;
        if (code === 3 && (ali() * K_ALEA) < 0.6) emettre(C, GAB.etincelle, N1, px, SOL_SALLE + 0.05, pz, 0, 1, 0, 0.6, COUL.rituelRouge, COUL.energie);
        else emettre(C, GAB.rituel, N1, px, SOL_SALLE + 0.05, pz, 0, 1, 0, code === 5 ? 1.8 : 1.0, code === 4 ? COUL.rituelRouge : null, null);
      }
      (LC[0] = CERCLE_X, LC[1] = SOL_SALLE + 2.5, LC[2] = CERCLE_Z, LC[3] = 1.0, LC[4] = 0.85, LC[5] = 0.55, LC[6] = (code === 5 ? 350 : 40 + 80 * prog) * (code === 3 ? 0.6 + 0.4 * (ali() * K_ALEA) : 1), LC[7] = 12, lumiereLC(C));
      // fin du rituel : faisceau vers le plafond
      if (et === 'rituel_fin') {
        var tf2 = clamp(E.tempsEtat / T_FIN_RITUEL, 0, 1);
        var v = tenir(PH.faisceau, 'salle');
        if (v) {
          v.motif = V_COLONNE; v.x = CERCLE_X; v.y = SOL_SALLE; v.z = CERCLE_Z; v.sx = v.sz = mix(0.55, 1.6, lisse(0, K_EXPLOSION, tf2)); v.sy = PLAFOND - SOL_SALLE + 4; v.haut = 0.85;
          couleur(v, COUL.rituelBlanc, 1); v.k = 1.15 * lisse(0, 0.12, tf2) * (1 - lisse(K_EXPLOSION, 1, tf2));
        }
        acc.plafond += dt;
        if (acc.plafond > 0.6 && tf2 < K_EXPLOSION) { acc.plafond = 0; secouer(0.15 + 0.35 * tf2, 0.6, CERCLE_X, SOL_SALLE, CERCLE_Z, 'salle'); }
        if (OSC[0] < 0.25 * tf2) OSC[0] = 0.25 * tf2;
      }
    }
    function majLames(dt, E) {
      var B = E.boss;
      if (!bossVisible || !B) return;
      var C = couche(lieuBoss), L = B.lames, sy = sol(lieuBoss);
      if (L === 'actives' && gouttesLames) {
        acc.gouttes += dt * 7.0;
        while (acc.gouttes >= 1) {
          acc.gouttes -= 1;
          ancre((ali() * K_ALEA) < 0.5 ? A_POINTEG : A_POINTED);
          emettre(C, PAL.goutte, N1, SO[0], SO[1] - 0.02, SO[2], 0, -1, 0, 1.0, null, null, sy);
        }
        acc.brume += dt * 1.6;
        if (acc.brume >= 1) { acc.brume = 0; ancre((ali() * K_ALEA) < 0.5 ? A_POINTEG : A_POINTED); emettre(C, PAL.brume, 1, SO[0], SO[1], SO[2], 0, 1, 0, 0.8); }
      } else if (L === 'formation') {
        var a = ACT, pr = a && a.id === 'transformation_lames' ? nombre(a.progression, 0) : 0.5;
        acc.formation += dt * 34 * Q.densite;
        while (acc.formation >= 1) {
          acc.formation -= 1;
          var g = (ali() * K_ALEA) < 0.5;
          if ((ali() * K_ALEA) < 0.45) emettreOrbite(C, PAL.brume, N1, g ? A_MAING : A_MAIND, 0.35, -0.3, 0.3, 4.0, 0.15, 0.1, 1.0);
          else emettreConv(C, GAB.energie, N1, g ? A_MAING : A_MAIND, 0.6, 1.5, -0.6, 0.6, 3.0, 0.8, PAL.vif, PAL.sombre);
          if ((ali() * K_ALEA) < 0.3) { ancre(g ? A_MAING : A_MAIND); emettre(C, PAL.goutte, N1, SO[0], SO[1] - 0.05, SO[2], 0, -1, 0, 1.0, null, null, sy); }
        }
        var hg = tenir(PH.lameFormG, lieuBoss), hd = tenir(PH.lameFormD, lieuBoss);
        if (hg) { ancre(A_MAING); hg.motif = H_LUEUR; hg.x = SO[0]; hg.y = SO[1]; hg.z = SO[2]; hg.sx = hg.sy = 0.4 + 0.5 * pr; hg.tirer = 0.25; couleur(hg, PAL.halo, 1); hg.i = (0.5 + 1.0 * pr) * PAL.k; }
        if (hd) { ancre(A_MAIND); hd.motif = H_LUEUR; hd.x = SO[0]; hd.y = SO[1]; hd.z = SO[2]; hd.sx = hd.sy = 0.4 + 0.5 * pr; hd.tirer = 0.25; couleur(hd, PAL.halo, 1); hd.i = (0.5 + 1.0 * pr) * PAL.k; }
        ancre(A_POITRINE);
        (LC[0] = SO[0], LC[1] = SO[1], LC[2] = SO[2], LC[3] = PAL.halo[0], LC[4] = PAL.halo[1], LC[5] = PAL.halo[2], LC[6] = (40 + 90 * pr) * PAL.k, LC[7] = 8, lumiereLC(C));
      }
    }
    function majInteraction(dt, E) {
      var I = E.interaction;
      if (!I || !I.position) return;
      var lieu = E.lieu || 'salle', C = couche(lieu), pr = clamp(nombre(I.progression, 0), 0, 1);
      var s = tenir(PH.interaction, lieu);
      if (s) { s.motif = S_INTERACTION; s.x = I.position.x; s.z = I.position.z; s.y = sol(lieu) + 0.02; s.hx = s.hz = nombre(I.rayon, 2.6); couleur(s, COUL.rituel, 1); s.a = 1; s.p0 = pr; s.p1 = 0.7 + 0.5 * pr; }
      acc.interaction += dt * (5 + 30 * pr) * Q.densite;
      while (acc.interaction >= 1) {
        acc.interaction -= 1;
        var a = (ali() * K_ALEA) * TAU, rr = nombre(I.rayon, 2.6) * entre(0.2, 0.95);
        emettre(C, GAB.rituel, N1, I.position.x + Math.sin(a) * rr, sol(lieu) + 0.05, I.position.z + Math.cos(a) * rr, 0, 1, 0, 0.8);
      }
      (LC[0] = I.position.x, LC[1] = sol(lieu) + 1.0, LC[2] = I.position.z, LC[3] = 1.0, LC[4] = 0.85, LC[5] = 0.55, LC[6] = 30 + 70 * pr, LC[7] = 8, lumiereLC(C));
    }

    // ─────────────────────────────── obscurité et voile d'écran ───────────────────────────────
    var COUL_OBSCUR = new THREE.Color().setRGB(0.0016, 0.002, 0.0036);
    var DENSITE_OBSCUR = Math.sqrt(-Math.log(0.35)) / RAYON_VISION;
    var lieuObscur = null, kObscur = 0;
    function majVision(dt, E) {
      var v = clamp(nombre(E.vision, 0), 0, 1);
      var s = clamp(v / VISION_INT, 0, 1), b = clamp((v - VISION_INT) / (1 - VISION_INT), 0, 1);
      var lieu = joueurLocal && joueurLocal.lieu ? joueurLocal.lieu : E.lieu || 'salle';
      if (E.lieu && joueurLocal && joueurLocal.lieu && joueurLocal.lieu !== E.lieu) { s = 0; b = 0; }
      if (!obscuriteActive) { s = 0; b = 0; }
      ecr.obscur = s; ecr.noirVision = b;
      lieuObscur = lieu; if (kObscur !== s) kObscur = s;
      FACT[0] = 1; FACT[1] = 1;
      if (s > 0 || b > 0) FACT[iLieu(lieu)] = clamp((1 - 0.25 * s) * (1 - 0.85 * b), 0.03, 1);
      // lueur froide autour du joueur : on distingue toujours le sol et les murs proches (jouabilité)
      if (s > 0.01 && camPresente) (LC[0] = CAM[0], LC[1] = CAM[1] + 1.6, LC[2] = CAM[2], LC[3] = 0.55, LC[4] = 0.62, LC[5] = 0.8, LC[6] = 300 * s * (1 - b), LC[7] = RAYON_VISION * 1.5, lumiereLC(couche(lieu)));
    }
    function majBrouillards() {
      for (var i = 0; i < LISTE.length; i++) {
        var C = LISTE[i], B = C.brume, sc = C.scene, k = C.nom === lieuObscur ? kObscur : 0;
        if (k <= 0.0005) {
          if (B.modifie) {
            if (B.secours && sc.fog === B.secours) sc.fog = null;
            else if (sc.fog) { if (sc.fog.isFogExp2) sc.fog.density = B.d0; else { sc.fog.near = B.n0; sc.fog.far = B.f0; } sc.fog.color.copy(B.c0); }
            B.modifie = false;
          }
          continue;
        }
        if (!sc.fog) { if (!B.secours) B.secours = new THREE.FogExp2(0x000000, 0); sc.fog = B.secours; B.d0 = 0; B.c0.setRGB(0, 0, 0); }
        var f = sc.fog;
        if (f.isFogExp2) f.density = mix(B.d0, Math.max(B.d0, DENSITE_OBSCUR), k);
        else { f.near = mix(B.n0, RAYON_VISION * 0.2, k); f.far = mix(B.f0, RAYON_VISION * 1.4, k); }
        f.color.copy(B.c0).lerp(COUL_OBSCUR, k);
        B.modifie = true;
      }
    }
    function majEcran(dt, E) {
      // fondus et effets écran pilotés par l'état
      var noir = 0, asp = 0, capt = 0, crit = 0;
      if (E) {
        var et = E.etat, te = nombre(E.tempsEtat, 0), a = ACT;
        if (et === 'introduction') {
          if (!bossVisible) { asp = lisse(0, T_FONDU_INTRO, te); noir = lisse(T_FONDU_INTRO * 0.4, T_FONDU_INTRO, te); }
          else if (a && a.id === 'apparition' && a.etape === 'formation') { noir = 1 - lisse(0, 0.7, nombre(a.t, 0)); asp = 1 - lisse(0, 0.35, nombre(a.t, 0)); }
        } else if (et === 'message' && te > T_MESSAGE) {
          var t2 = te - T_MESSAGE;
          noir = lisse(0, T_RETOUR_BUNKER * 0.45, t2) * (1 - lisse(T_RETOUR_BUNKER * 0.55, T_RETOUR_BUNKER, t2));
        }
        if (a && a.id === 'rituel_ames' && (!joueurLocal || !joueurLocal.lieu || joueurLocal.lieu === lieuBoss)) {
          if (a.etape === 'incantation') capt = 0.25 * lisse(0.4, 1, nombre(a.progression, 0));
          else if (a.etape === 'capture') capt = 0.25 + 0.75 * nombre(a.progression, 0);
        }
        if (joueurLocal && E.joueurs && E.joueurs[joueurLocal.id] && E.joueurs[joueurLocal.id].critique) crit = 1;
      }
      ecr.noir = noir; ecr.aspiration = asp; ecr.capture = capt;
      ecr.critique += (crit - ecr.critique) * Math.min(1, dt * 3);
      ecr.flashBlanc *= Math.exp(-dt / 0.28);
      ecr.flashRouge *= Math.exp(-dt / 0.35);
      ecr.coup *= Math.exp(-dt / 0.3);
      ecr.choc *= Math.exp(-dt / 0.2);
      if (ecr.flashBlanc < 0.002) ecr.flashBlanc = 0;
      if (ecr.flashRouge < 0.002) ecr.flashRouge = 0;
      if (ecr.coup < 0.002) ecr.coup = 0;
      if (ecr.choc < 0.002) ecr.choc = 0;
      var uA = U_ECRAN.uA.value, uB = U_ECRAN.uB.value, uC = U_ECRAN.uC.value;   // champs écrits un à un (pas de flottants passés en arguments)
      uA.x = ecr.obscur; uA.y = ecr.noirVision; uA.z = ecr.capture; uA.w = ecr.aspiration;
      uB.x = ecr.noir; uB.y = ecr.flashBlanc < 0.7 ? ecr.flashBlanc : 0.7; uB.z = ecr.flashRouge; uB.w = ecr.critique;
      uC.x = ecr.coup; uC.y = ecr.glace; uC.z = ecr.choc;
      var actif = ecr.obscur + ecr.noirVision + ecr.capture + ecr.aspiration + ecr.noir + ecr.flashBlanc + ecr.flashRouge + ecr.critique + ecr.coup + ecr.choc > 0.003;
      for (var i = 0; i < LISTE.length; i++) LISTE[i].ecran.visible = actif;
      ecranActif = actif;
    }
    var ecranActif = false;
    // uniformes scalaires écrits seulement quand ils changent (un flottant écrit dans { value } est mis en boîte)
    var tailleConnue = false;
    function majTailleEcran() {
      var aspect = 0;
      if (renderer && renderer.getDrawingBufferSize) {
        renderer.getDrawingBufferSize(_taille);
        if (_taille.x > 0 && _taille.y > 0 && (!tailleConnue || _taille.x * 0.5 !== U_DEMI.value.x || _taille.y * 0.5 !== U_DEMI.value.y)) {
          tailleConnue = true;
          U_DEMI.value.set(_taille.x * 0.5, _taille.y * 0.5); aspect = _taille.x / _taille.y;
          for (var i = 0; i < LISTE.length; i++) LISTE[i].part.mat.uniforms.uTailleMax.value = Math.max(64, U_DEMI.value.y * 0.9);
        }
      } else if (camera && camera.aspect) aspect = camera.aspect;
      if (aspect > 0 && aspect !== U_ECRAN.uAspect.value) U_ECRAN.uAspect.value = aspect;
    }

    // ─────────────────────────────── évènements (API.md §4) ───────────────────────────────
    function surEvenement(type, d) {
      if (detruit) return;
      d = d || VIDE;
      var p = d.position;
      switch (type) {
        case 'action': surAction(d); break;
        case 'degats': if (p) fxImpactBalle(lieuDe(p, lieuBoss), p.x, p.y, p.z, d.zone === 'tete'); break;
        case 'immunise': if (p) fxImmunise(lieuDe(p, lieuBoss), p.x, p.y, p.z); break;
        case 'projectile': if (p) fxLancer(lieuBoss, p.x, p.y, p.z, d.type === 'trait'); break;
        case 'projectileImpact':
          if (p) { if (d.type === 'invocation') fxImpactMagique(lieuBoss, p.x, p.y, p.z, 1); else fxImpactTrait(lieuBoss, p.x, p.y, p.z); }
          break;
        case 'invocation': if (p) fxEmergence(lieuDe(p, lieuBoss), p.x, p.y, p.z); break;
        case 'absorption':
          if (d.etat === 'debut') { ABS.actif = true; ABS.cibles = d.cibles || null; ABS.t = 0; for (var v = 0; v < SUIVI_VRILLES.length; v++) { SUIVI_VRILLES[v].id = null; SUIVI_VRILLES[v].extrait = false; } }
          else ABS.actif = false;
          break;
        case 'ameExtraite':
          if (p) fxAmeExtraite(lieuDe(p, lieuBoss), p.x, p.y, p.z);
          var sv2 = trouverSuivi(SUIVI_VRILLES, d.zombieId, false);
          if (sv2) { sv2.extrait = true; ancre(sv2.ancre); halo(couche(lieuBoss), H_ECLAT, SO[0], SO[1], SO[2], 0.2, 1.0, COUL.ameClaire, 1.6, 0.25, C_FLASH, 0.2); }
          break;
        case 'ameAbsorbee': fxAmeAbsorbee(lieuBoss); break;
        case 'ailes':
          if (d.etat === 'apparition') fxAilesDeploiement(lieuBoss);
          else if (d.etat === 'deployees') fxRugissement(lieuBoss, false);
          else if (d.etat === 'dissipation') tache(T_DISSIPATION, lieuBoss, 0, 0, 0, 1.2, 0, 0, 0);
          break;
        case 'pique':
          if (d.etape === 'verrouille' && d.arrivee) {
            var Cp = couche(lieuBoss);
            halo(Cp, H_ANNEAU, d.arrivee.x, sol(lieuBoss) + 0.3, d.arrivee.z, PIQUE_RAYON * 1.6, PIQUE_RAYON * 1.6, COUL.rituelBlanc, 1.2, 0.35, C_ANNEAU, 0);
          }
          break;
        case 'piqueImpact': if (p) fxPiqueImpact(lieuBoss, p.x, p.y, p.z); break;
        case 'teleport':
          if (p) {
            var lt = d.lieu || lieuDe(p, lieuBoss);
            fxTeleport(lt, d.sens, p.x, p.y, p.z);
            if (lt === 'bunker') fxCercleTeleport(lt, p.x, p.z);         // v1.1 : cercle rituel au sol
          }
          break;
        case 'pilier': fxPilier(d); break;
        case 'chien':                                                   // v1.2 : chiens zombies de la meute
          if (p) {
            var lc = d.lieu === 'salle' || d.lieu === 'bunker' ? d.lieu : lieuDe(p, lieuBoss);
            if (d.etat === 'faille') fxFaille(lc, p.x, p.y, p.z, 0);
            else if (d.etat === 'apparition') fxApparitionChien(lc, p.x, p.y, p.z);
            else if (d.etat === 'mort') fxMortChien(lc, p.x, p.y, p.z, false);
            else if (d.etat === 'fin' && d.raison === 'defaite') fxMortChien(lc, p.x, p.y, p.z, true);   // transfert, bloque, echec : retrait silencieux
          }
          break;
        case 'tube': fxCuve(d); break;                               // v1.3 : cuves et mini-boss
        case 'palier': fxPalier(nombre(d.numero, 0)); break;          // v1.4 : paliers de la phase 5
        case 'crochet': fxCrochet(d); break;
        case 'miniBoss':
          if (d.etat === 'rage') { if (p && d.id != null && !rageVue(d.id)) { marquerRage(d.id); fxRageDebut(d.capacite, p.x, p.y, p.z); } }   // v1.5
          else if (p) { if (d.etat === 'libere') fxMiniBossLibere(d.type, p.x, p.y, p.z); else if (d.etat === 'mort') fxMiniBossMort(d.type, p.x, p.y, p.z); }
          break;
        // v1.5 (API.md §17) : chaque transition est gardée (l'instantané qui la constate ensuite ne la rejoue pas)
        case 'murs': transitionMurs(codeMurs(d.etat)); break;
        case 'mursChoc': fxMursChoc(d); break;
        case 'bras':
          if (p) { if (d.etat === 'arrache') fxBrasArrache(p.x, p.y, p.z); else { var cb = codeBras(d.etat); if (cb) transitionBras(cb, p.x, p.y, p.z); } }
          break;
        case 'petitDemembre':
          if (p) {
            if (d.etat === 'apparition') { if (d.id == null || !petitVu(d.id)) { if (d.id != null) marquerPetit(d.id); fxPetitSortie(p.x, p.y, p.z); } }
            else if (d.etat === 'effondrement') fxPetitEffondrement(p.x, p.y, p.z);
          }
          break;
        case 'intangible':
          if (p) { if (d.etat === 'debut') transitionIntangible(true, p.x, p.y, p.z); else if (d.etat === 'fin') transitionIntangible(false, p.x, p.y, p.z); else if (d.etat === 'traversee') fxTraversee(p.x, p.y, p.z); }
          break;
        case 'protection': if (d.actif) fxProtectionDebut(d.miniBoss); else fxProtectionFin(d.miniBoss); break;
        case 'meute':
          if (d.etat === 'dechainee') fxMeuteDechainee();
          else if (d.etat === 'dissipee') fxMeuteDissipee();
          break;
        case 'zombiesCendres':
          if (d.ids && monde && typeof monde.positionZombie === 'function') {
            for (var i = 0; i < d.ids.length; i++) {
              var q = null;
              try { q = monde.positionZombie(d.ids[i]); } catch (e) { q = null; }
              if (q) fxCendres(lieuDe(q, lieuEtat), q.x, q.y, q.z);
            }
          }
          break;
        case 'bloc':
          if (d.etat === 'reconstruit' && DALLES[d.id]) {
            var D = DALLES[d.id], Cs = couche('salle');
            halo(Cs, H_ECLAT, D.x + D.nx * 0.4, D.y, D.z + D.nz * 0.4, 0.5, 2.4, COUL.rituel, 1.2, 0.35, C_FLASH, 0);
            emettre(Cs, GAB.poussiere, 6, D.x + D.nx * 0.4, D.y - 0.8, D.z + D.nz * 0.4, D.nx, 0, D.nz, 0.8);
          }
          break;
        case 'blocImpact': if (p) fxBlocImpact('salle', p.x, p.y, p.z); break;
        case 'ondeChoc': if (p) fxOndeChoc(lieuBoss, p.x, p.y, p.z, nombre(d.rayon, ONDE_RAYON)); break;
        case 'rituel': if (d.etat === 'explosion') fxRituelExplosion(); break;
        case 'capture':
          if (d.etat === 'conteste') { var Cc = couche('salle'); emettreAnneau(Cc, GAB.etincelle, 30, CERCLE_X, SOL_SALLE + 0.1, CERCLE_Z, R_RITUEL, 1.5, 0.8, COUL.rituelRouge, COUL.energie); }
          else if (d.etat === 'capture') { var Cc2 = couche('salle'); emettreAnneau(Cc2, GAB.rituel, 24, CERCLE_X, SOL_SALLE + 0.1, CERCLE_Z, R_RITUEL, 0.6, 1.0); }
          break;
        case 'joueurTouche':
          if (joueurLocal && d.joueur === joueurLocal.id && d.source !== 'frappe') ecr.coup = Math.max(ecr.coup, d.source === 'bloc' || d.source === 'pique' ? 0.6 : 0.35);   // v1.4 : sans entaille
          break;
        case 'frappe': fxFrappe(lieuBoss, !!d.reussie, d.speciale !== false, !!(joueurLocal && d.joueur === joueurLocal.id && d.reussie)); break;
        case 'lames':
          if (d.etat === 'actives') {
            var Cl = couche(lieuBoss);
            for (var m = 0; m < 2; m++) { ancre(m ? A_MAIND : A_MAING); halo(Cl, H_ECLAT, SO[0], SO[1], SO[2], 0.3, 1.6, PAL.halo, 2.0 * PAL.k, 0.3, C_FLASH, 0.3); emettre(Cl, GAB.etincelle, 10, SO[0], SO[1], SO[2], 0, 0, 0, 0.7, PAL.vif, PAL.sombre); emettre(Cl, PAL.brume, 6, SO[0], SO[1], SO[2], 0, 1, 0, 1.0); }
            ancre(A_POITRINE); eclairLumiere(Cl, SO[0], SO[1], SO[2], PAL.halo, 300 * PAL.k, 10, 0.4);
          } else if (d.etat === 'desintegration') {
            var Cd = couche(lieuBoss);
            for (var m2 = 0; m2 < 2; m2++) { ancre(m2 ? A_POINTED : A_POINTEG); emettre(Cd, PAL.brume, 10, SO[0], SO[1], SO[2], 0, 1, 0, 1.4); emettre(Cd, PAL.gerbe, 8, SO[0], SO[1], SO[2], 0, 1, 0, 0.7, null, null, sol(lieuBoss)); }
            tache(T_DESINTEGRATION, lieuBoss, 0, 0, 0, T_LAMES_DESINT, 0, 0, 0);
          }
          break;
        case 'defaite': tache(T_DECHARGE, lieuBoss, 0, 0, 0, 1.4, 1.2, 0, 0); break;
        case 'interaction':
          if (d.etat === 'terminee' && etatCourant && etatCourant.interaction && etatCourant.interaction.position) { var ip = etatCourant.interaction.position; fxInteractionFin(lieuEtat, ip.x, ip.y, ip.z); }
          break;
        case 'recompense': recompense(d.joueur, d.type); break;
        case 'etat': if (d.vers === 'inactif' || d.vers === 'echec') reinitialiser(); break;
      }
    }
    function surAction(d) {
      var id = d.id, et = d.etape;
      if (id === 'apparition' && et === 'presentation') { ancre(A_CENTRE); tache(T_ECLAIR_APPARITION, lieuBoss, SO[0], SO[1] - 1, SO[2], 0.1, 0, 0, 0); }
      else if (id === 'souffrance' && et === 'colere') fxColere(lieuBoss);
      else if (id === 'retour_rage' && et === 'descente') tache(T_PLAFOND, lieuBoss, 0, 0, 0, T_DESCENTE + 1.0, 0.7, 0, 0);
      else if (id === 'retour_rage' && et === 'deflagration') fxDeflagration(lieuBoss);
      else if (id === 'retour_rage' && et === 'rugissement') fxRugissement(lieuBoss, true);
      else if (id === 'transformation_ailes' && et === 'rugissement') { /* l'évènement « ailes déployées » s'en charge */ }
      else if (id === 'pique' && et === 'etourdi') {
        emettreOrbite(couche(lieuBoss), G_ETOURDI, 12, A_TETE, 0.32, 0.16, 0.3, 5.5, 0, 0.04, 1.0);
      }
      else if (id === 'defaite' && et === 'chute') fxLiberation(lieuBoss);
      else if (id === 'effondrement' && et === 'souffrance') { ancre(A_CENTRE); halo(couche(lieuBoss), H_ANNEAU, SO[0], SO[1], SO[2], 2.6, 2.6, COUL.energie, 1.0, 0.45, C_ANNEAU, 0); }
    }
    function recompense(joueur, type) {
      var pos = null, lieu = lieuEtat;
      if (joueurLocal && joueur === joueurLocal.id && joueurLocal.position) { pos = joueurLocal.position; lieu = joueurLocal.lieu || lieuEtat; }
      else if (joueursCtx) for (var i = 0; i < joueursCtx.length; i++) if (joueursCtx[i] && joueursCtx[i].id === joueur && joueursCtx[i].position) { pos = joueursCtx[i].position; lieu = joueursCtx[i].lieu || lieuEtat; }
      if (pos) fxRecompense(lieu, pos.x, pos.y, pos.z, type);
    }

    // ─────────────────────────────── boucle ───────────────────────────────
    function mettreAJour(dt, etat, ctx) {
      if (detruit) return;
      dt = clamp(nombre(dt, 0), 0, 0.1);
      HORLOGE[0] += dt; trame++;
      U_TEMPS.value.x = HORLOGE[0];
      ctx = ctx || VIDE;
      modele = ctx.modele || null;
      joueurLocal = ctx.joueurLocal || null;
      joueursCtx = ctx.joueurs || null;
      etatCourant = etat || null;
      majTailleEcran();
      if (camera && camera.getWorldPosition) { camera.getWorldPosition(_v); CAM[0] = _v.x; CAM[1] = _v.y; CAM[2] = _v.z; camPresente = true; }
      else if (joueurLocal && joueurLocal.position) { CAM[0] = joueurLocal.position.x; CAM[1] = joueurLocal.position.y + 1.6; CAM[2] = joueurLocal.position.z; camPresente = true; }
      var B = etat && etat.boss ? etat.boss : null;
      BOSS = B;
      ACT = B ? B.action : null;
      lieuBoss = B && B.lieu ? B.lieu : (etat && etat.lieu) || lieuBoss;
      lieuEtat = etat && etat.lieu ? etat.lieu : lieuBoss;
      bossVisible = !!(B && B.present && B.visible);
      bossLoco = B ? B.locomotion : 'aucune';
      PAL = B && B.couleurLames === 'bleu' ? LAMES_BLEU : LAMES_ROUGE;      // v1.4 : couleur des lames du palier
      // sol de la maquette du bunker : pieds du joueur local, sinon le boss en traque
      if (monde && typeof monde.sol === 'function') { try { var sb2 = monde.sol(0, 0, 'bunker'); if (isFinite(sb2) && sb2 !== solBunker) solBunker = sb2; } catch (e) { /* facultatif */ } }
      else if (joueurLocal && joueurLocal.lieu === 'bunker' && joueurLocal.position) { if (joueurLocal.position.y !== solBunker) solBunker = joueurLocal.position.y; }
      else if (B && B.lieu === 'bunker' && B.position) { var sb3 = B.position.y - (bossLoco === 'traque' ? H_TRAQUE : 0); if (sb3 !== solBunker) solBunker = sb3; }
      majTaches(dt);
      if (etat) {
        if (bossVisible && ACT) majActionEnCours(dt, etat, ACT);
        if (bossVisible && !ACT && bossLoco === 'affaibli') contInstable(couche(lieuBoss), dt, 1);
        if (bossVisible && bossLoco === 'mort') contFumeeCadavre(couche(lieuBoss), dt);
        majProjectiles(dt, etat); majZones(dt, etat); majAmes(dt, etat); majPuissance(dt, etat); majPique(dt, etat);
        majBlocs(dt, etat); majVrilles(dt, etat); majRituel(dt, etat); majLames(dt, etat); majInteraction(dt, etat);
        majVision(dt, etat);
        majProtection(dt, etat);                          // v1.3 : lien et voile de protection
        majCrochets(dt, etat);                            // v1.4 : crochets de la phase 5
        majRages(dt, etat); majMurs(dt, etat); majInfection(dt, etat); majBras(dt, etat); majPetits(etat); majIntangible(dt, etat);   // v1.5
      }
      majEcran(dt, etat);
      majBrouillards();
      relacherPoignees();
      for (var i = 0; i < LISTE.length; i++) {
        var C = LISTE[i];
        var il2 = iLieu(C.nom);
        OSC[il2] = OSC[il2] > dt * 0.9 ? OSC[il2] - dt * 0.9 : 0;
        var amb = FACT[il2] < 0.15 ? 0.15 : FACT[il2] > 1 ? 1 : FACT[il2];
        if (amb !== C.uAmbiance.value) C.uAmbiance.value = amb;
        majParticules(C, dt);
        majRubans(C, dt);
        majHalos(C, dt);
        majSols(C, dt);
        majPanneaux(C, dt);
        majVolumes(C, dt);
        attribuerLumieres(C);
      }
    }
    function reinitialiser() {
      for (var i = 0; i < LISTE.length; i++) {
        var C = LISTE[i];
        C.part.n = 0;
        for (var r = 0; r < C.rub.liste.length; r++) { if (C.rub.liste[r].actif) C.rub.liste[r].sale = true; C.rub.liste[r].actif = false; }
        for (var h = 0; h < C.halos.liste.length; h++) C.halos.liste[h].actif = false;
        for (var s = 0; s < C.sols.liste.length; s++) C.sols.liste[s].actif = false;
        for (var pn = 0; pn < C.pans.liste.length; pn++) C.pans.liste[pn].actif = false;
        for (var v = 0; v < C.volumes.length; v++) { C.volumes[v].actif = false; C.volumes[v].mesh.visible = false; }
      }
      for (var t = 0; t < TACHES.length; t++) TACHES[t].actif = false;
      for (var l = 0; l < LUM_TEMP.length; l++) LUM_TEMP[l].actif = false;
      for (var p = 0; p < POIGNEES.length; p++) { POIGNEES[p].o = null; POIGNEES[p].vu = false; }
      [SUIVI_PROJ, SUIVI_ZONES, SUIVI_AMES, SUIVI_BLOCS, SUIVI_VRILLES].forEach(function (L) { for (var k = 0; k < L.length; k++) { L[k].id = null; L[k].vu = false; } });
      ABS.actif = false; ABS.cibles = null;
      ecr.flashBlanc = ecr.flashRouge = ecr.coup = ecr.choc = 0;
      // v1.5 : états vus (gardes anti-doublon) et suivis
      MURS_ETAT = 0; INF_ETAT = 0; BRAS_ETAT = 0; INTANG = false; SV[7] = 0; INF[3] = 0; IT[3] = 0;
      for (var rv = 0; rv < RAGES_VUES.length; rv++) RAGES_VUES[rv] = null;
      for (var pv = 0; pv < PETITS_VUS.length; pv++) PETITS_VUS[pv] = null;
      for (var cm = 0; cm < NB_COM; cm++) { COM_E[cm] = 0; COM_ID[cm] = null; }
      for (var si = 0; si < SUIVI_IRR.length; si++) { SUIVI_IRR[si].id = null; SUIVI_IRR[si].vu = false; }
    }

    // ─────────────────────────────── effets à la main ───────────────────────────────
    var EFFETS = {
      impactMagique: function (p, l) { fxImpactMagique(l, p.x, p.y, p.z, nombre(this.echelle, 1)); },
      impactTrait: function (p, l) { fxImpactTrait(l, p.x, p.y, p.z); },
      lancer: function (p, l) { fxLancer(l, p.x, p.y, p.z, false); },
      emergence: function (p, l) { fxEmergence(l, p.x, p.y, p.z); },
      impactBalle: function (p, l) { fxImpactBalle(l, p.x, p.y, p.z, this.zone === 'tete'); },
      immunise: function (p, l) { fxImmunise(l, p.x, p.y, p.z); },
      colere: function (p, l) { fxColere(l); },
      decharge: function (p, l) { tache(T_DECHARGE, l, 0, 0, 0, nombre(this.duree, 1.5), nombre(this.intensite, 1), 0, 0); },
      cendres: function (p, l) { fxCendres(l, p.x, p.y, p.z); },
      ameExtraite: function (p, l) { fxAmeExtraite(l, p.x, p.y, p.z); },
      ameAbsorbee: function (p, l) { fxAmeAbsorbee(l); },
      ailesDeploiement: function (p, l) { fxAilesDeploiement(l); },
      ailesDissipation: function (p, l) { tache(T_DISSIPATION, l, 0, 0, 0, 1.2, 0, 0, 0); },
      piqueImpact: function (p, l) { fxPiqueImpact(l, p.x, p.y, p.z); },
      teleportDepart: function (p, l) { fxTeleport(l, 'depart', p.x, p.y, p.z); },
      teleportArrivee: function (p, l) { fxTeleport(l, 'arrivee', p.x, p.y, p.z); },
      eclairApparition: function (p, l) { tache(T_ECLAIR_APPARITION, l, p.x, p.y, p.z, 0.1, 0, 0, 0); },
      deflagration: function (p, l) { fxDeflagration(l); },
      rugissement: function (p, l) { fxRugissement(l, this.fort !== false); },
      poussierePlafond: function (p, l) { tache(T_PLAFOND, l, p.x, p.y, p.z, nombre(this.duree, 2.5), nombre(this.intensite, 1), 0, 0); },
      arrachement: function (p, l) { if (DALLES[this.id]) fxArrachement(DALLES[this.id]); },
      blocImpact: function (p, l) { fxBlocImpact(l, p.x, p.y, p.z); },
      cercleTeleport: function (p, l) { fxCercleTeleport(l, p.x, p.z); },
      pilierTouche: function (p) { fxPilier({ id: this.id, etat: 'touche', position: this.centre || null, pointImpact: p }); },
      pilierDetruit: function (p) { fxPilier({ id: this.id, etat: 'detruit', position: p }); },
      chienFaille: function (p, l) { fxFaille(l, p.x, p.y, p.z, nombre(this.duree, 0)); },
      chienApparition: function (p, l) { fxApparitionChien(l, p.x, p.y, p.z); },
      chienMort: function (p, l) { fxMortChien(l, p.x, p.y, p.z, !!this.fort); },
      meuteDechainee: function () { fxMeuteDechainee(); },
      meuteDissipee: function () { fxMeuteDissipee(); },
      cuveSiphon: function (p) { fxCuve({ id: this.id || 'tube0', etat: 'siphon', position: p, miniBoss: this.type || null }); },
      cuveFissure: function (p) { fxCuve({ id: this.id || 'tube0', etat: 'fissure', position: p, miniBoss: this.type || null }); },
      cuveEclatement: function (p) { fxCuve({ id: this.id || 'tube0', etat: 'eclate', position: p, miniBoss: this.type || null }); },
      miniBossLibere: function (p) { fxMiniBossLibere(this.type || 'survolte', p.x, p.y, p.z); },
      miniBossMort: function (p) { fxMiniBossMort(this.type || 'survolte', p.x, p.y, p.z); },
      protectionDebut: function () { fxProtectionDebut(this.type || 'survolte'); },
      protectionFin: function () { fxProtectionFin(this.type || 'survolte'); },
      palierRouge: function () { fxPalier(1); },
      palierIntangible: function () { fxPalier(2); },
      palierCrochets: function () { fxPalier(3); },
      crochetAccroche: function (p) { fxCrochet({ etat: 'accroche', position: p, joueur: this.joueur || null }); },
      crochetRate: function (p) { fxCrochet({ etat: 'rate', position: p, raison: this.raison || 'mur' }); },
      ondeChoc: function (p, l) { fxOndeChoc(l, p.x, p.y, p.z, nombre(this.rayon, ONDE_RAYON)); },
      // v1.5 (effets ponctuels : les effets continus suivent l'instantané)
      rageSurcharge: function (p) { fxRageDebut('surcharge', p.x, p.y, p.z); },
      rageInfection: function (p) { fxRageDebut('infection', p.x, p.y, p.z); },
      mursCharge: function () { fxMursCharge(); },
      mursDeflagration: function () { fxMursDeflagration(); },
      mursExtinction: function () { fxMursExtinction(); },
      mursChoc: function (p) { fxMursChoc({ position: p, joueur: this.joueur != null ? this.joueur : (joueurLocal ? joueurLocal.id : null), mur: this.mur || null }); },
      infectionVague: function (p) { INF[0] = p.x; INF[1] = p.y + 1.2; INF[2] = p.z; INF[3] = 1; fxInfectionVague(this.ids || null); },
      brasArrache: function (p) { fxBrasArrache(p.x, p.y, p.z); },
      brasLance: function (p) { fxBrasLance(p.x, p.y, p.z); },
      brasImpact: function (p) { fxBrasImpact(p.x, p.y, p.z); },
      brasFletri: function (p) { fxBrasFletri(p.x, p.y, p.z, 2); },
      petitSortie: function (p) { fxPetitSortie(p.x, p.y, p.z); },
      petitEffondrement: function (p) { fxPetitEffondrement(p.x, p.y, p.z); },
      evanouissement: function (p) { fxDisparition(p.x, p.y, p.z); },
      traversee: function (p) { fxTraversee(p.x, p.y, p.z); },
      resurgissement: function (p) { fxResurgissement(p.x, p.y, p.z); },
      rituelExplosion: function () { fxRituelExplosion(); },
      frappe: function (p, l) { fxFrappe(l, this.reussie !== false, this.speciale !== false, !!this.local); },
      liberation: function (p, l) { fxLiberation(l); },
      recompense: function (p, l) { fxRecompense(l, p.x, p.y, p.z, this.type || 'bonus'); },
      interactionFin: function (p, l) { fxInteractionFin(l, p.x, p.y, p.z); },
      tacheSang: function (p, l) { tacheSang(couche(l), p.x, sol(l), p.z, 0.03); },
      flash: function () {      // couleur : 'rouge' (entaille d'une frappe), 'glace' (lames bleues), 'coup' (sans entaille), 'choc' (murs, v1.5), sinon blanc
        var c = this.couleur;
        if (c === 'rouge' || c === 'glace') { ecr.flashRouge = Math.max(ecr.flashRouge, nombre(this.force, 1)); ecr.glace = c === 'glace' ? 1 : 0; }
        else if (c === 'coup') ecr.coup = Math.max(ecr.coup, nombre(this.force, 0.6));
        else if (c === 'choc') ecr.choc = Math.max(ecr.choc, nombre(this.force, 1));
        else ecr.flashBlanc = Math.max(ecr.flashBlanc, nombre(this.force, 0.5));
      },
      explosion: function (p, l) { fxImpactMagique(l, p.x, p.y, p.z, nombre(this.echelle, 1.5)); }
    };
    var POS_DEFAUT = { x: 0, y: 0, z: 0 };
    function declencher(nom, params) {
      var f = EFFETS[nom];
      if (!f || detruit) return false;
      params = params || VIDE;
      var p = params.position;
      if (!p) {
        if (BOSS && BOSS.position) p = BOSS.position;
        else { POS_DEFAUT.x = CERCLE_X; POS_DEFAUT.y = SOL_SALLE; POS_DEFAUT.z = CERCLE_Z; p = POS_DEFAUT; }
      }
      var l = params.lieu === 'salle' || params.lieu === 'bunker' ? params.lieu : lieuDe(p, lieuBoss);
      f.call(params, p, l);
      return true;
    }

    // ─────────────────────────────── API ───────────────────────────────
    var abonnements = [];
    var api = {
      version: VERSION,
      qualite: nomQualite,
      effets: Object.keys(EFFETS),
      brancher: function (combat) {
        if (!combat || typeof combat.on !== 'function') return function () {};
        var off = combat.on('*', surEvenement);
        abonnements.push(off);
        return function () { var i = abonnements.indexOf(off); if (i >= 0) abonnements.splice(i, 1); if (typeof off === 'function') off(); };
      },
      mettreAJour: mettreAJour,
      declencher: declencher,
      /** Multiplicateur (0..1) à appliquer aux lumières du monde d'un lieu (obscurité de la phase 5, éclats). */
      facteurLumiere: function (lieu) {
        var f = FACT[iLieu(lieu)], o = OSC[iLieu(lieu)];
        if (o > 0) f *= 1 - o * (0.5 + 0.5 * Math.sin(HORLOGE[0] * 37) * Math.sin(HORLOGE[0] * 23));
        return clamp(f, 0, 1);
      },
      /** Voile d'écran rendu à part (option ecranSepare : après la vue de l'arme). */
      rendreEcran: function (r) {
        if (!sceneEcran || !ecranActif || !r) return;
        var ac = r.autoClear; r.autoClear = false;
        r.render(sceneEcran, cameraEcran);
        r.autoClear = ac;
      },
      reinitialiser: reinitialiser,
      stats: function () {
        var s = { particules: 0, rubans: 0, halos: 0, sols: 0, panneaux: 0, volumes: 0, taches: 0, lumieres: 0, ecran: ecranActif };
        for (var i = 0; i < LISTE.length; i++) {
          var C = LISTE[i];
          s.particules += C.part.n; s.halos += C.halos.nPrec; s.sols += C.sols.nPrec; s.panneaux += C.pans.nPrec;
          for (var r = 0; r < C.rub.liste.length; r++) if (C.rub.liste[r].actif) s.rubans++;
          for (var v = 0; v < C.volumes.length; v++) if (C.volumes[v].actif) s.volumes++;
          for (var l = 0; l < C.lumieres.length; l++) if (C.lumieres[l].intensity > 0) s.lumieres++;
        }
        for (var t = 0; t < TACHES.length; t++) if (TACHES[t].actif) s.taches++;
        return s;
      },
      dispose: function () {
        if (detruit) return;
        detruit = true;
        abonnements.slice().forEach(function (off) { if (typeof off === 'function') off(); });
        abonnements.length = 0;
        kObscur = 0; majBrouillards();
        LISTE.forEach(function (C) {
          if (C.groupe.parent) C.groupe.parent.remove(C.groupe);
          C.part.geo.dispose(); C.part.mat.dispose();
          C.rub.geo.dispose(); C.rub.mat.dispose();
          C.halos.geo.dispose(); C.halos.mat.dispose();
          C.sols.geo.dispose(); C.sols.mat.dispose();
          C.pans.geo.dispose(); C.pans.mat.dispose();
          C.volumes.forEach(function (v) { v.mat.dispose(); });
          C.gCyl.dispose(); C.gSph.dispose();
          C.lumieres.forEach(function (L) { if (L.dispose) L.dispose(); });
        });
        GEO_ECRAN.dispose(); MAT_ECRAN.dispose();
        texBruit.dispose(); texCercle.dispose();
      }
    };
    return api;
  }

  var BossB7Fx = { version: VERSION, creer: creer, QUALITES: QUALITES, GLYPHES: GLYPHES, dessinerSceau: dessinerSceau, dessinerGlyphe: dessinerGlyphe };
  if (typeof module === 'object' && module && module.exports) module.exports = BossB7Fx;
  if (root) root.BossB7Fx = BossB7Fx;
})(typeof globalThis !== 'undefined' ? globalThis : this);
