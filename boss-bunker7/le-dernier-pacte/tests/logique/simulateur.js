/*
 * simulateur.js — adaptateur `jeu` simulé pour tester logique.js sous Node (API.md §3).
 * Monde : la salle secrète d'après arene.js (déplacée par une origine non nulle pour tester les repères) et une
 * maquette de Bunker 7 (rectangle 60 × 40 m coupé par un mur avec un passage). Joueurs = robots réglables
 * (DPS, temps de réaction, esquive des attaques annoncées, recul au sprint devant un zombie à moins de 3 m, tir sur
 * les zombies à moins de 8 m sauf ceux que le boss a saisis, placement dans le cercle, interaction, chargeur optionnel :
 * { chargeur: 30, rechargement: 2.1 } comme l'arme du prototype), zombies au comportement du prototype (MODELE).
 * Les piliers détruits par la logique (etat().piliers) ne bloquent plus ni les déplacements ni les lignes de vue.
 * v1.2 (API.md §14) : faireApparaitreZombie({ type: 'chien', profil }) crée un chien zombie (galop à profil.vitesse,
 * morsure de profil.degats toutes les profil.cadence s à profil.portee m, id « c… », listé avec type: 'chien').
 * Les robots abattent d'abord les chiens à moins de 8 m, ne les fuient pas (plus rapides que leur sprint), sortent
 * d'une zone au sol en sprint et rechargent au quart du chargeur quand rien ne menace à moins de 8 m.
 * Options : degatsChien, vitesseChien, chiensBloques (chiens immobiles), ignorerTypeChien (jeu qui ignore type).
 * v1.3 (API.md §15) : faireApparaitreZombie({ miniBoss: true, type: 'survolte'|'irradie', profil }) crée le mini-boss avec
 * ses capacités (Survolté : décharge à portée et en vue toutes les `intervalle` s, puis `recharge` s immobile, se tient à
 * 5–7 m ; Irradié : aura continue, flaque à sa mort ; tous deux : coup au contact), listé avec pv, pvMax, miniBoss: true.
 * Les robots tirent sur le mini-boss quand le Septième est protégé, restent hors de l'aura (≥ aura + 0,5 m) et de la
 * flaque ; vision brouillée par une décharge : dégâts de leurs tirs × 0,5 pendant `flou` s (hypothèse).
 * Options : miniBossBloques (immobiles), ignorerMiniBoss (jeu qui crée un zombie ordinaire), degatsMiniBoss (× sur
 * tous leurs dégâts, 0 = inoffensifs).
 * v1.4 (API.md §16) : Le Démembré (fléau : préparation lisible puis arc devant lui) ; L'Irradié plus rapide, aura de 6 m,
 * boules en cloche (point d'impact marqué, dégâts d'impact, zone radioactive jusqu'à sa mort, sans plafond, dégâts par
 * exposition) ; Le Survolté : décharge sur chaque joueur à portée et étourdissement (ni déplacement, ni tir, ni
 * rechargement). IA des mini-boss alignée sur proto-zombies.js (charge de 0,7 s avant la décharge, tolérance de 1,2 m,
 * approche / recul / flanc ; coups au contact armés et immobiles). jeu.tirerJoueur (sauf option sansTirerJoueur).
 * Robots : en présence d'un danger de L'Irradié (aura, zones, impacts marqués), ils choisissent leur route parmi 16
 * directions (coût des points atteints dans 0,25, 0,6 et 1,2 s : zones, impacts, aura de L'Irradié qui les poursuit, zones
 * des sorts, zombies, murs, piliers ; direction gardée 0,35 s) et n'esquivent pas en se jetant dedans ; Septième protégé :
 * ils se placent par rapport au mini-boss (bandeMiniBoss) et s'écartent de leurs coéquipiers à moins de 3 m ; ils
 * reculent devant le fléau, esquivent un crochet seulement s'ils le voient partir à temps (réaction) ; chaque bloc d'une
 * salve fait réagir le joueur qu'il vise.
 * v1.5 (API.md §17) : le jeu simulé exécute les rages (effetZombie 'surcharge' / 'infection' / 'arrachement' : animation de
 * `duree` s, immobile ; invulnérable pour surcharge et arrachement : les balles n'y font rien), l'aura des zombies, chiens et
 * petits irradiés (effetZombie 'irradie'), les petits Démembrés (type 'demembre_petit' : fléau de leur profil) et le
 * Démembré sans bras (charge : préparation, course en ligne droite, joueurs touchés projetés, impact contre le mur, étourdi
 * s'il heurte un mur ou un pilier ; coups au contact du bras droit, allonge × echelle) ; Démembré géant : fléau du profil
 * (6 m). Robots : ils restent à distance + 0,5 m des murs électrifiés (l'espace jouable se réduit), s'écartent de la ligne
 * d'une charge qu'ils voient se préparer, ne voient pas le Septième intangible (ils se placent par rapport à l'endroit où il
 * a disparu) et fuient quand il resurgit près d'eux ; Munitions max (bonus de fin de phase ou de mort d'un mini-boss) :
 * chargeurs pleins aussitôt (hypothèse : ramassé tout de suite). Option de robot increvable (tests du déroulé d'un combat complet,
 * indépendants de l'équilibrage) : aucun dégât ne l'atteint (blessureCritique s'applique).
 */
'use strict';
var path = require('path');
var CONFIG = require(path.join(__dirname, '..', '..', 'src', 'config.js'));
var ARENE = require(path.join(__dirname, '..', '..', 'src', 'arene.js'));
var Logique = require(path.join(__dirname, '..', '..', 'src', 'logique.js'));

function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Modèle aligné sur le prototype (proto/proto-joueur.js, proto-zombies.js, proto-arme.js, API.md §13) :
// joueur 4,6 m/s, sprint 6,6 m/s, régénération 0,5 PV max/s après 3,5 s sans dégât ; zombies de 150 PV, 20 % des PV max
// par coup ; vitesses 'normale' 1,7, 'course' 3,5, 'sprint' 6,0 m/s. Attaque comme dans proto-zombies.js : elle commence
// à moins de `debut` m, le zombie s'arrête, le coup part au bout de `armement` s et ne touche que si le joueur est
// encore à moins de `allonge` m ; puis `fin` s avant de reprendre la poursuite. Zombie agressif (hypothèse, en attendant
// les réglages du prototype v1.1) : poursuite immédiate (émergence deux fois plus courte) et attaques plus rapprochées.
var MODELE = {
  marche: 4.6, sprint: 6.6, delaiRegen: 3.5, vitesseRegen: 0.5,
  pvZombie: 150, degatsZombie: 0.2, vitesses: { normale: 1.7, course: 3.5, sprint: 6.0 },
  attaque: { debut: 1.35, armement: 0.55, allonge: 1.55, fin: 1.25 },
  attaqueAgressif: { debut: 1.5, armement: 0.4, allonge: 1.7, fin: 0.9 },
  // mini-boss : sortie de la cuve, effet du flou sur les tirs des robots (hypothèses) ; leur IA suit proto-zombies.js
  // (MB_PROTO plus bas)
  sortieMiniBoss: 1.0, facteurFlou: 0.5,
  // v1.4 : Septième protégé → le robot se place par rapport au mini-boss (distance mini, maxi), plus par rapport au Septième
  bandeMiniBoss: { survolte: [8.5, 12], irradie: [7.5, 11], demembre: [4, 9] }
};
var ATOUTS = ['mastodonte', 'recharge-eclair', 'double-coup', 'revivification', 'endurance', 'mule', 'tir-precis', 'phd'];

function creerSimulation(o) {
  o = o || {};
  var PAS = 1 / 60;
  var graine = o.graine != null ? o.graine : 1939;
  var R = mulberry32((graine * 7919 + 13) >>> 0);
  var origine = o.origine || { x: 120, y: -40, z: -35 };
  var arene = ARENE.construire({ origine: origine });
  if (o.bunkerPoints !== false) {
    arene.bunker7.arriveeJoueurs = [{ x: -20, y: 0, z: -10, lacet: 0 }, { x: -18, y: 0, z: -10, lacet: 0 }, { x: -20, y: 0, z: -7, lacet: 0 }, { x: -18, y: 0, z: -7, lacet: 0 }];
    arene.bunker7.apparitionsBoss = [{ x: 20, y: 0, z: -15 }, { x: 22, y: 0, z: 10 }, { x: -22, y: 0, z: 15 }, { x: 10, y: 0, z: 15 },
      { x: 25, y: 0, z: 0 }, { x: -25, y: 0, z: -18 }, { x: -10, y: 0, z: -18 }, { x: 15, y: 0, z: -5 }];
    arene.bunker7.retourJoueurs = [{ x: 0, y: 0, z: 15, lacet: 0 }, { x: 3, y: 0, z: 15, lacet: 0 }, { x: -3, y: 0, z: 15, lacet: 0 }, { x: 6, y: 0, z: 15, lacet: 0 }];
    arene.bunker7.apparitionsZombies = [{ x: -28, y: 0, z: 5 }, { x: 28, y: 0, z: 18 }, { x: 10, y: 0, z: -19 }, { x: -10, y: 0, z: 19 }, { x: 28, y: 0, z: -18 }];
  }
  var SA = arene.salle, O = SA.origine, APO = SA.apotheme;
  var PIL = SA.piliers.map(function (p) { return { id: p.id, x: O.x + p.x, z: O.z + p.z, r: p.rayon, detruit: false }; });
  var MURS = SA.murs.map(function (m) { return m.normale; });
  var CERCLE = { x: O.x + SA.cercle.x, y: O.y, z: O.z + SA.cercle.z };
  var BUNKER = { x0: -30, x1: 30, z0: -20, z1: 20, y: 0, murs: o.sansMurBunker ? [] : [{ x0: -1.5, x1: 1.5, z0: -20, z1: 6 }] };

  var t = 0;
  var robots = (o.joueurs || [{ id: 'j1' }]).map(function (d) {
    return {
      id: d.id, pos: { x: -20, y: 0, z: -10 }, vel: { x: 0, y: 0, z: 0 }, lacet: 0, vivant: true, aTerre: false, lieu: 'bunker',
      pv: 1, dernierCoup: -1e9, controle: true, inv: false, connecte: d.connecte !== false,
      dps: d.dps != null ? d.dps : 350, reaction: d.reaction === undefined ? 0.35 : d.reaction, tire: d.tire !== false,
      zombiesAussi: d.zombiesAussi !== false, regen: d.regen !== false, reduction: d.reduction || 0, cercle: d.cercle !== false,
      interagit: d.interagit !== false, immobile: !!d.immobile, vitesse: d.vitesse || MODELE.marche, sprint: d.sprint || MODELE.sprint,
      recule: d.recule !== false, distanceRecul: d.distanceRecul || 3.0, tueSaisis: !!d.tueSaisis,
      chargeur: d.chargeur || 0, rechargement: d.rechargement != null ? d.rechargement : 2.1, munitions: d.chargeur || 0, recharge: 0,
      precisionTete: d.precisionTete != null ? d.precisionTete : 0.15,
      esquiveJusqua: 0, esquiveDir: null, reactions: [], tirT: 0, sens: 1, sensT: 0, cible: null,
      etourdiJusqua: 0, flouJusqua: 0, expo: 0, horsZoneT: 0, projection: null, bossVu: null, increvable: !!d.increvable
    };
  });
  var RI = {};
  robots.forEach(function (r) { RI[r.id] = r; });
  var zombies = [], ZI = {}, nz = 0;
  var drapeaux = o.drapeaux || {};
  var log = { degats: [], teleports: [], controle: [], invulnerable: [], armes: [], atouts: [], bonus: [], depots: [], manches: [],
    effets: [], retraits: [], apparitions: [], journal: [], critiques: [], regards: [], spawnsNormaux: [], bonusPoses: [], chiens: [], chiensTues: 0,
    miniBoss: [], decharges: [], flaques: [], miniBossTues: [],
    boules: [], zonesRadio: [], fleaux: [], etourdis: [], tractions: [], charges: [],
    petits: [], petitsTues: 0, chargesDemembre: [], projections: [], impactsMur: [], munitionsMax: [] };
  var sim = { t: 0, robots: robots, zombies: zombies, log: log, drapeaux: drapeaux, cheminNul: false, cheminsDemandes: 0, positionsBoss: [] };

  // ───────── géométrie ─────────
  function dansSalle(p, marge) {
    for (var i = 0; i < MURS.length; i++) if ((p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z > APO - marge) return false;
    return true;
  }
  function contraindreSalle(p, marge) {
    for (var k = 0; k < 2; k++) for (var i = 0; i < MURS.length; i++) {
      var v = (p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z, lim = APO - marge;
      if (v > lim) { p.x -= MURS[i].x * (v - lim); p.z -= MURS[i].z * (v - lim); }
    }
    for (var j = 0; j < PIL.length; j++) {
      if (PIL[j].detruit) continue;
      var dx = p.x - PIL[j].x, dz = p.z - PIL[j].z, l = Math.hypot(dx, dz), r = PIL[j].r + 0.35;
      if (l < r) { if (l < 1e-6) { dx = 1; dz = 0; l = 1; } p.x = PIL[j].x + dx / l * r; p.z = PIL[j].z + dz / l * r; }
    }
  }
  function dansMurBunker(p, marge) {
    for (var i = 0; i < BUNKER.murs.length; i++) {
      var m = BUNKER.murs[i];
      if (p.x > m.x0 - marge && p.x < m.x1 + marge && p.z > m.z0 - marge && p.z < m.z1 + marge) return m;
    }
    return null;
  }
  function contraindreBunker(p, marge) {
    p.x = Math.max(BUNKER.x0 + marge, Math.min(BUNKER.x1 - marge, p.x));
    p.z = Math.max(BUNKER.z0 + marge, Math.min(BUNKER.z1 - marge, p.z));
    var m = dansMurBunker(p, marge);
    if (m) {   // sortie par le côté le plus proche
      var d = [p.x - (m.x0 - marge), (m.x1 + marge) - p.x, (m.z1 + marge) - p.z];
      var k = d.indexOf(Math.min.apply(null, d));
      if (k === 0) p.x = m.x0 - marge; else if (k === 1) p.x = m.x1 + marge; else p.z = m.z1 + marge;
    }
  }
  function segCoupeRect(a, b, m, marge) {
    var n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25) + 1;
    for (var i = 0; i <= n; i++) {
      var u = i / n, x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
      if (x > m.x0 - marge && x < m.x1 + marge && z > m.z0 - marge && z < m.z1 + marge) return true;
    }
    return false;
  }
  function segCoupePilier(a, b) {
    for (var i = 0; i < PIL.length; i++) {
      if (PIL[i].detruit) continue;
      var abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
      var u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((PIL[i].x - a.x) * abx + (PIL[i].z - a.z) * abz) / l2)) : 0;
      if (Math.hypot(PIL[i].x - (a.x + abx * u), PIL[i].z - (a.z + abz * u)) < PIL[i].r) return true;
    }
    return false;
  }
  function visible(a, b, lieu) {
    if (lieu === 'salle') return !segCoupePilier(a, b);
    for (var i = 0; i < BUNKER.murs.length; i++) if (segCoupeRect(a, b, BUNKER.murs[i], 0)) return false;
    return true;
  }
  function chemin(a, b, lieu) {
    sim.cheminsDemandes++;
    if (sim.cheminNul) return null;
    if (lieu !== 'bunker') return [{ x: b.x, y: b.y, z: b.z }];
    function libre(p, q) { return !BUNKER.murs.some(function (m) { return segCoupeRect(p, q, m, 0.35); }); }
    if (libre(a, b)) return [{ x: b.x, y: b.y, z: b.z }];
    // graphe de visibilité minimal : coins autour du bout de chaque mur
    var noeuds = [];
    BUNKER.murs.forEach(function (m) { noeuds.push({ x: m.x0 - 2.2, y: 0, z: m.z1 + 2.5 }, { x: m.x1 + 2.2, y: 0, z: m.z1 + 2.5 }); });
    var best = null, bl = 1e18;
    function long(l) { var s2 = 0, p = a; l.forEach(function (q) { s2 += Math.hypot(q.x - p.x, q.z - p.z); p = q; }); return s2; }
    noeuds.forEach(function (n1) {
      if (libre(a, n1) && libre(n1, b)) { var l1 = [n1, b]; if (long(l1) < bl) { bl = long(l1); best = l1; } }
      noeuds.forEach(function (n2) {
        if (n2 === n1) return;
        if (libre(a, n1) && libre(n1, n2) && libre(n2, b)) { var l2 = [n1, n2, b]; if (long(l2) < bl) { bl = long(l2); best = l2; } }
      });
    });
    return best ? best.map(function (q) { return { x: q.x, y: q.y || 0, z: q.z }; }) : null;
  }
  function positionValide(p, lieu) {
    if (lieu === 'salle') return dansSalle(p, 0.3) && !segCoupePilier(p, p);
    return p.x >= BUNKER.x0 && p.x <= BUNKER.x1 && p.z >= BUNKER.z0 && p.z <= BUNKER.z1 && !dansMurBunker(p, 0.0);
  }

  // ───────── dégâts ─────────
  function blesser(r, f, opts) {
    if (!r || !r.vivant) return;
    var source = opts && opts.source;
    if (r.inv) { log.degats.push({ t: t, id: r.id, source: source, f: 0, ignore: true }); return; }
    if (r.increvable) { log.degats.push({ t: t, id: r.id, source: source, f: 0, ignore: 'increvable' }); return; }   // tests du déroulé (v1.5)
    var frac = f;
    if (r.reduction && !(opts && opts.ignorerReductions)) frac *= 1 - r.reduction;
    r.pv -= frac;
    r.dernierCoup = t;
    log.degats.push({ t: t, id: r.id, source: source, f: frac, pvApres: r.pv });
    if (opts && opts.recul) { r.esquiveDir = { x: opts.recul.direction.x, z: opts.recul.direction.z }; r.esquiveJusqua = t + 0.25; }
    if (r.pv <= 1e-9) { r.pv = 0; r.vivant = false; log.degats.push({ t: t, id: r.id, source: source, mort: true }); }
  }

  // ───────── adaptateur `jeu` ─────────
  var jeu = {
    joueurs: function () {
      return robots.filter(function (r) { return r.connecte; }).map(function (r) {
        return { id: r.id, position: { x: r.pos.x, y: r.pos.y, z: r.pos.z }, vitesse: { x: r.vel.x, y: 0, z: r.vel.z }, lacet: r.lacet,
          vivant: r.vivant, aTerre: r.aTerre, lieu: r.lieu, pvFraction: r.pv };
      });
    },
    infligerDegats: function (id, f, opts) { blesser(RI[id], f, opts); },
    blessureCritique: function (id, f) {
      var r = RI[id];
      if (!r || !r.vivant) return;
      var avant = r.pv;
      r.pv = Math.min(r.pv, f);
      r.dernierCoup = t;
      log.critiques.push({ t: t, id: id, avant: avant, apres: r.pv });
    },
    teleporter: function (id, p, lacet, lieu) {
      var r = RI[id];
      log.teleports.push({ t: t, id: id, p: { x: p.x, y: p.y, z: p.z }, lieu: lieu });
      if (!r) return;
      r.pos = { x: p.x, y: p.y, z: p.z }; r.lacet = lacet; r.lieu = lieu; r.vel = { x: 0, y: 0, z: 0 }; r.esquiveJusqua = 0; r.reactions = [];
    },
    controle: function (id, a) { log.controle.push({ t: t, id: id, a: a }); if (RI[id]) RI[id].controle = a; },
    tirerJoueur: o.sansTirerJoueur ? undefined : function (id, p) {        // v1.4 : traction d'un crochet
      var r = RI[id];
      log.tractions.push({ t: t, id: id, p: { x: p.x, y: p.y, z: p.z } });
      if (!r) return;
      r.pos = { x: p.x, y: p.y, z: p.z }; r.vel = { x: 0, y: 0, z: 0 }; r.esquiveJusqua = 0; r.reactions = [];
    },
    invulnerable: function (id, a) { log.invulnerable.push({ t: t, id: id, a: a }); if (RI[id]) RI[id].inv = a; },
    faireApparaitreZombie: function (q) {
      if (o.refuserZombies) return null;
      var id = 'z' + (++nz);
      var agressif = !!q.agressif && o.zombiesAgressifs !== false;
      var z;
      if (q.miniBoss && !o.ignorerMiniBoss) {              // mini-boss (v1.3) : capacités de son profil
        var pm = q.profil || {};
        id = 'm' + nz;
        z = { id: id, type: q.type, miniBoss: true, nom: q.nom, pos: { x: q.position.x, y: q.position.y, z: q.position.z }, lieu: q.lieu, vivant: true,
          hp: pm.pv != null ? pm.pv : 1000, pvMax: pm.pvMax != null ? pm.pvMax : (pm.pv != null ? pm.pv : 1000), nait: t, emergence: MODELE.sortieMiniBoss,
          saisi: false, attaqueT: -1e9, bloque: !!o.miniBossBloques, effet: q.effet, vitesse: o.vitesseMiniBoss || pm.vitesse || 3, profil: pm,
          auraT: 0, demande: q };
        log.miniBoss.push({ t: t, id: id, q: q });
      } else if (q.type === 'demembre_petit' && !o.ignorerPetits) {   // v1.5 : petit Démembré (profil transmis : fléau, contact)
        var pp = q.profil || {};
        id = 'p' + nz;
        z = { id: id, type: 'demembre_petit', pos: { x: q.position.x, y: q.position.y, z: q.position.z }, lieu: q.lieu, vivant: true,
          hp: pp.pv != null ? pp.pv : 450, nait: t, emergence: 0.4, saisi: false, attaqueT: -1e9, bloque: !!o.petitsBloques, effet: q.effet,
          vitesse: o.vitessePetit || pp.vitesse || 4, profil: pp, demande: q };
        log.petits.push({ t: t, id: id, q: q });
      } else if (q.type === 'chien' && !o.ignorerTypeChien) {   // chien zombie : galop à profil.vitesse, morsure sans armement
        var pf = q.profil || {};
        id = 'c' + nz;
        z = { id: id, type: 'chien', pos: { x: q.position.x, y: q.position.y, z: q.position.z }, lieu: q.lieu, vivant: true,
          hp: pf.pv != null ? pf.pv : 100, nait: t, emergence: 0.2, saisi: false, attaqueT: -1e9, bloque: !!o.chiensBloques, effet: q.effet,
          vitesse: o.vitesseChien || pf.vitesse || 7.4, agressif: true, profil: pf, demande: { vitesse: q.vitesse, agressif: q.agressif } };
        log.chiens.push({ t: t, id: id, q: q });
      } else {
        var v = o.vitesseZombie || (typeof q.vitesse === 'number' ? q.vitesse : MODELE.vitesses[q.vitesse] || MODELE.vitesses.normale);
        z = { id: id, pos: { x: q.position.x, y: q.position.y, z: q.position.z }, lieu: q.lieu, vivant: true, hp: o.pvZombie || MODELE.pvZombie, nait: t,
          emergence: (q.effet === 'emergence' ? 1.0 : q.effet === 'breche' ? 0.8 : 0.3) * (agressif ? 0.5 : 1), saisi: false, attaqueT: -1e9,
          bloque: !!(o.zombiesBloques), effet: q.effet, vitesse: v, agressif: agressif, demande: { vitesse: q.vitesse, agressif: q.agressif } };
        if (q.miniBoss) log.miniBoss.push({ t: t, id: id, q: q, ignore: true });
        else if (q.type !== 'chien') log.apparitions.push({ t: t, id: id, effet: q.effet, lieu: q.lieu, p: { x: q.position.x, z: q.position.z }, vitesse: q.vitesse, agressif: q.agressif });
        else log.chiens.push({ t: t, id: id, q: q, ignore: true });
      }
      zombies.push(z); ZI[id] = z;
      return id;
    },
    zombies: function () {
      return zombies.filter(function (z) { return z.vivant; }).map(function (z) {
        var q = { id: z.id, position: { x: z.pos.x, y: z.pos.y, z: z.pos.z }, vivant: true, lieu: z.lieu };
        if (z.type) q.type = z.type;
        if (z.miniBoss) { q.miniBoss = true; q.pv = Math.max(0, z.hp); q.pvMax = z.pvMax; }
        return q;
      });
    },
    effetZombie: function (id, effet, params) {
      log.effets.push({ t: t, id: id, effet: effet, params: params });
      var z = ZI[id];
      if (!z) return;
      if (effet === 'saisie') z.saisi = true;
      if (effet === 'relache') z.saisi = false;
      // v1.5 : rages (animation de `duree` s, immobile ; invulnérable pour surcharge et arrachement) et entités irradiées
      if (effet === 'surcharge' || effet === 'infection' || effet === 'arrachement') {
        var du = params && params.duree || 0;
        z.rageJusqua = t + du;
        if (effet !== 'infection') z.invulnJusqua = t + du;
        if (effet === 'arrachement') z.sansBrasA = t + du;
      }
      if (effet === 'irradie') z.irradie = params && params.actif ? { aura: params.aura || {}, t: 0 } : null;
    },
    retirerZombie: function (id, opts) {
      log.retraits.push({ t: t, id: id, effet: opts && opts.effet, points: opts && opts.points });
      var z = ZI[id];
      if (z) { z.vivant = false; delete ZI[id]; if (z.miniBoss) finMiniBossSim(z, opts && opts.effet); }
      for (var i = zombies.length - 1; i >= 0; i--) if (zombies[i].id === id) zombies.splice(i, 1);
    },
    regarder: function (id, p, duree) { log.regards.push({ t: t, id: id, duree: duree }); },
    chemin: function (a, b, lieu) { return chemin(a, b, lieu); },
    positionValide: function (p, lieu) { return positionValide(p, lieu); },
    visible: function (a, b, lieu) { return visible(a, b, lieu); },
    apparitionsNormales: function (actif, params) { log.spawnsNormaux.push({ t: t, actif: actif, params: params }); return !!o.delegueApparitions; },
    suspendreManches: function (a) { log.manches.push({ t: t, a: a }); },
    listeAtouts: function () { return ATOUTS.slice(); },
    donnerArme: function (id, arme, opts) {
      var deja = log.armes.filter(function (x) { return x.id === id && x.ok; }).length;
      var ok = !(o.inventairePlein && o.inventairePlein[id] != null && deja >= o.inventairePlein[id]);
      log.armes.push({ t: t, id: id, arme: arme, pap: opts && opts.pap, ok: ok });
      return ok;
    },
    donnerAtout: function (id, at) { log.atouts.push({ t: t, id: id, atout: at }); return true; },
    activerBonus: function (b, opts) { log.bonus.push({ t: t, bonus: b }); if (b === 'munitions-max') munitionsMax(); },
    faireApparaitreBonus: function (q) {
      log.bonusPoses.push({ t: t, q: q });
      if (o.bonusRefuse) return false;
      if (q && q.type === 'munitions-max') munitionsMax();   // v1.5 : ramassé aussitôt (hypothèse) : chargeurs pleins
      return true;
    },
    deposerRecompense: function (q) { log.depots.push({ t: t, q: q }); },
    lireDrapeau: function (k) { return drapeaux[k] === true; },
    ecrireDrapeau: function (k, v) { drapeaux[k] = v; },
    pointsBunker: o.sansPointsBunker ? undefined : function (type) {
      var cles = { arrivee: 'arriveeJoueurs', boss: 'apparitionsBoss', retour: 'retourJoueurs', zombies: 'apparitionsZombies' };
      return (arene.bunker7[cles[type]] || []).map(function (p) { return { x: p.x, y: p.y, z: p.z, lacet: p.lacet || 0 }; });
    },
    journal: function (niveau, msg) { log.journal.push({ t: t, niveau: niveau, msg: msg }); }
  };
  if (o.retirerMethodes) o.retirerMethodes.forEach(function (m) { delete jeu[m]; });
  if (o.jeuModifs) for (var km in o.jeuModifs) jeu[km] = o.jeuModifs[km];

  var combat = Logique.creerCombat({ config: o.config || CONFIG, arene: arene, jeu: jeu, graine: graine, surcharges: o.surcharges });
  var C = combat.config;
  var evenements = [];
  combat.on('*', function (type, d) { evenements.push({ t: t, type: type, d: d }); });

  // ───────── réactions des robots aux annonces ─────────
  function planifier(r, quand, type, dir, duree, vitesse) {
    if (r.reaction == null || r.reaction < 0) return;
    r.reactions.push({ at: quand + r.reaction, type: type, dir: dir, duree: duree, vitesse: vitesse });
  }
  function perpendiculaire(r, source) {
    var dx = r.pos.x - source.x, dz = r.pos.z - source.z, l = Math.hypot(dx, dz) || 1;
    var c1 = { x: -dz / l, z: dx / l }, c2 = { x: dz / l, z: -dx / l };
    function marge(c) {
      var p = { x: r.pos.x + c.x * 4, y: r.pos.y, z: r.pos.z + c.z * 4 };
      if (r.lieu === 'salle') { if (!dansSalle(p, Math.max(1.0, margeMurs()))) return -1; return segCoupePilier(r.pos, p) ? 0 : 1; }
      return positionValide(p, 'bunker') ? 1 : -1;
    }
    var m1 = marge(c1), m2 = marge(c2);
    return m2 > m1 ? c2 : c1;
  }
  function fuite(r, source) {
    var dx = r.pos.x - source.x, dz = r.pos.z - source.z, l = Math.hypot(dx, dz);
    if (l < 1e-3) {                                   // juste sur la source (boule lancée sur un joueur immobile) : un pas de côté,
      var bp = E().boss.position;                     // perpendiculaire à la direction du Septième
      var bx = bp ? r.pos.x - bp.x : 1, bz = bp ? r.pos.z - bp.z : 0, bl = Math.hypot(bx, bz);
      if (bl < 1e-3) { bx = 1; bz = 0; bl = 1; }
      return { x: -bz / bl * r.sens, z: bx / bl * r.sens };
    }
    return { x: dx / l, z: dz / l };
  }
  combat.on('crochet', function (d) {                 // v1.4 : il voit le crochet partir → un pas de côté (s'il réagit à temps)
    var r = d.etat === 'lancer' ? RI[d.joueur] : null;
    if (r) planifier(r, t, 'crochet', function () { return perpendiculaire(r, E().boss.position); }, 0.6, r.sprint);
  });
  combat.on('intangible', function (d) {             // v1.5 : il resurgit près d'eux → ils fuient (après leur réaction)
    if (d.etat !== 'fin') return;
    robots.forEach(function (q) {
      if (q.lieu === 'bunker' && Math.hypot(q.pos.x - d.position.x, q.pos.z - d.position.z) < 8) planifier(q, t, 'frappe', function () { return fuite(q, d.position); }, 1.0, q.sprint);
    });
  });
  combat.on('pique', function (d) {
    if (d.etape !== 'visee') return;
    var r = RI[d.cibleJoueur];
    if (r && d.depart) planifier(r, t, 'pique', function () { return perpendiculaire(r, E().boss.position); }, 1.8, r.sprint);
  });
  combat.on('action', function (d) {
    var r = d.cibleJoueur != null ? RI[d.cibleJoueur] : null;
    var b = function () { return E().boss.position; };
    if (d.id === 'arrachement' && d.etape === 'levitation') {   // v1.4 : une salve vise plusieurs joueurs
      // l'évènement part au début de l'étape, avant que les blocs passent en lévitation : état frais, blocs de l'action
      var vises = {}, ef = combat.etat(), ids = ef.boss.action && ef.boss.action.donnees && ef.boss.action.donnees.blocs;
      if (r) vises[r.id] = r;
      if (ids) ef.blocs.forEach(function (bl) { if (ids.indexOf(bl.id) >= 0 && bl.cibleJoueur != null && RI[bl.cibleJoueur]) vises[bl.cibleJoueur] = RI[bl.cibleJoueur]; });
      Object.keys(vises).forEach(function (id) { var q = vises[id]; planifier(q, t, 'bloc', function () { return perpendiculaire(q, b()); }, 1.8, q.sprint); });
    }
    if (d.id === 'trait' && d.etape === 'preparation' && r) planifier(r, t, 'trait', function () { return perpendiculaire(r, b()); }, 1.0, r.sprint);
    if ((d.id === 'frappe' || d.id === 'frappe_ordinaire') && d.etape === 'preparation' && r) planifier(r, t, 'frappe', function () { return fuite(r, b()); }, 1.3, r.sprint);
    if (d.id === 'onde_choc' && d.etape === 'preparation') robots.forEach(function (q) {
      if (q.lieu === 'salle' && Math.hypot(q.pos.x - b().x, q.pos.z - b().z) < 5.5) planifier(q, t, 'onde', function () { return fuite(q, b()); }, 1.0, q.sprint);
    });
  });

  var etatCache = null;
  function E() { return etatCache || (etatCache = combat.etat()); }

  // ───────── IA des robots ─────────
  // v1.4 : dangers au sol de L'Irradié (aura, zones radioactives, impacts annoncés) dans le lieu du robot ; null s'il n'y en
  // a aucun (le robot garde alors exactement son comportement de la v1.3). Quand il y en a, les zones des sorts, les flaques
  // et les zombies proches comptent aussi.
  function dangersRadio(r) {
    var irr = zombies.filter(function (z) { return z.vivant && z.miniBoss && z.type === 'irradie' && z.lieu === r.lieu && z.profil && z.profil.aura && t - z.nait >= z.emergence; });
    var zr = log.zonesRadio.filter(function (q) { return q.fin - t > 1.5 && q.lieu === r.lieu; });
    var bo = log.boules.filter(function (b) { return !b.fait && b.lieu === r.lieu; });
    if (!irr.length && !zr.length && !bo.length) return null;
    var sol = r.lieu === 'salle' ? E().zones.filter(function (z) { return z.etat !== 'fin'; }).map(function (z) { return { pos: z.position, rayon: z.rayon }; }) : [];
    log.flaques.forEach(function (f) { if (t < f.fin && f.lieu === r.lieu) sol.push({ pos: f.pos, rayon: f.rayon }); });
    var zs = zombies.filter(function (z) { return z.vivant && !z.miniBoss && z.type !== 'chien' && z.lieu === r.lieu && !z.saisi && t - z.nait >= z.emergence * 0.5; });
    var proie = irr.map(function (z) {                 // le joueur que chaque Irradié poursuit (le plus proche)
      var best = null, bd = 1e9;
      robotsDans(z.lieu).forEach(function (q) { var dd = Math.hypot(q.pos.x - z.pos.x, q.pos.z - z.pos.z); if (dd < bd) { bd = dd; best = q; } });
      return best;
    });
    return { irr: irr, proie: proie, zones: zr, boules: bo, sol: sol, zombies: zs };
  }
  // coût d'un point atteint dans tau s : dans une zone (≈ 5 à 17), dans un impact annoncé (≈ 10 à 21), dans l'aura + 1 m de
  // L'Irradié (≈ 6 à 27 ; s'il poursuit ce joueur, il a pu avancer de vitesse × tau vers ce point), dans une zone de sort ou
  // une flaque, près d'un zombie
  function coutDanger(p, D, tau, r) {
    var c = 0, i, d, R;
    for (i = 0; i < D.zones.length; i++) { R = D.zones[i].rayon + 0.4; d = Math.hypot(p.x - D.zones[i].pos.x, p.z - D.zones[i].pos.z); if (d < R) c += 5 + 4 * (R - d); }
    for (i = 0; i < D.boules.length; i++) { R = D.boules[i].Bo.impact.rayon + 0.7; d = Math.hypot(p.x - D.boules[i].pos.x, p.z - D.boules[i].pos.z); if (d < R) c += 10 + 6 * (R - d); }
    for (i = 0; i < D.irr.length; i++) {
      var z = D.irr[i];
      R = z.profil.aura.rayon + 1.0; d = Math.hypot(p.x - z.pos.x, p.z - z.pos.z) - (tau && r && D.proie[i] === r ? z.vitesse * tau : 0);
      if (d < R) c += 6 + 3 * (R - Math.max(0, d));
    }
    for (i = 0; i < D.sol.length; i++) { R = D.sol[i].rayon + 0.4; d = Math.hypot(p.x - D.sol[i].pos.x, p.z - D.sol[i].pos.z); if (d < R) c += 4 + 3 * (R - d); }
    for (i = 0; i < D.zombies.length; i++) { d = Math.hypot(p.x - D.zombies[i].pos.x, p.z - D.zombies[i].pos.z); if (d < 2.0) c += 2 * (2.0 - d); }
    return c;
  }
  function penetrationMur(p, marge) {               // de combien un point dépasse la limite de la salle (m), 0 s'il est dedans
    var m = 0;
    for (var i = 0; i < MURS.length; i++) m = Math.max(m, (p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z - (APO - marge));
    return m;
  }
  // coût d'une direction : points atteints dans 0,25, 0,6 et 1,2 s (mur : cher et croissant, pilier sur le trajet : cher) et
  // un petit coût pour s'écarter de la direction voulue `pref`
  var HORIZONS = [[0.25, 1], [0.6, 1], [1.2, 0.6]];
  function coutDirection(r, D, d, v, pref) {
    var c = 0.8 * (1 - (d.x * pref.x + d.z * pref.z));
    for (var h = 0; h < HORIZONS.length; h++) {
      var tau = HORIZONS[h][0], w = HORIZONS[h][1], p = { x: r.pos.x + d.x * v * tau, y: r.pos.y, z: r.pos.z + d.z * v * tau };
      c += w * coutDanger(p, D, tau, r);
      if (r.lieu === 'salle') { var pen = penetrationMur(p, Math.max(0.9, margeMurs())); if (pen > 0) c += w * (8 + 12 * pen); if (segCoupePilier(r.pos, p)) c += w * 15; }
      else if (!positionValide(p, r.lieu)) c += w * 25;
    }
    return c;
  }
  // la meilleure des 16 directions ; la direction choisie est gardée 0,35 s tant qu'elle reste presque aussi bonne (pas de
  // zigzag d'une image à l'autre)
  function meilleureDirection(r, D, pref, v) {
    var best = pref, bc = 1e18;
    for (var k = 0; k < 16; k++) {
      var a = k * Math.PI / 8, d = { x: Math.sin(a), z: Math.cos(a) }, c = coutDirection(r, D, d, v, pref);
      if (c < bc) { bc = c; best = d; }
    }
    if (r.pilote && t < r.pilote.jusqua && coutDirection(r, D, r.pilote.dir, v, pref) <= bc + 4) return r.pilote.dir;
    r.pilote = { dir: best, jusqua: t + 0.35 };
    return best;
  }
  // esquive en présence de dangers de L'Irradié : la direction prévue ou une direction proche (±50°) ; pour un pas de côté
  // (piqué, bloc, trait, crochet), l'autre côté aussi ; on garde la moins dangereuse
  function directionEsquive(r, D, esq, type, v) {
    var lateral = type === 'pique' || type === 'bloc' || type === 'trait' || type === 'crochet' || type === 'charge', best = esq, bc = 1e18;
    for (var k = 0; k < 16; k++) {
      var a = k * Math.PI / 8, d = { x: Math.sin(a), z: Math.cos(a) }, pd = d.x * esq.x + d.z * esq.z;
      if (!(pd >= 0.64 || (lateral && pd <= -0.64))) continue;
      var c = coutDirection(r, D, d, v, lateral && pd < 0 ? { x: -esq.x, z: -esq.z } : esq);
      if (c < bc) { bc = c; best = d; }
    }
    return best;
  }
  function bouger(r, dir, v, dt, libre) {
    // v1.4 : un joueur moyen ne marche pas dans un danger de L'Irradié qu'il voit (zone, impact marqué, aura) : si le pas
    // prévu y mène, il prend la meilleure issue proche (sauf pendant une esquive : `libre`)
    if (!libre) {
      var D = dangersRadio(r);
      if (D) {
        var vv = Math.max(v, r.vitesse), pa = { x: r.pos.x + dir.x * vv * 0.5, y: r.pos.y, z: r.pos.z + dir.z * vv * 0.5 };
        if (coutDanger(pa, D, 0.5, r) > 0) { dir = meilleureDirection(r, D, dir, vv); v = vv; }
      }
    }
    r.vel = { x: dir.x * v, y: 0, z: dir.z * v };
    var mE = r.lieu === 'salle' ? margeMurs() : 0, dAvant = mE ? distanceMur(r.pos) : 0;
    r.pos.x += r.vel.x * dt; r.pos.z += r.vel.z * dt;
    // v1.5 : murs électrifiés : il ne s'approche pas à moins de distance + 0,5 m (déjà plus près : il ne s'en rapproche plus)
    if (r.lieu === 'salle') { contraindreSalle(r.pos, mE ? Math.max(0.7, Math.min(mE, dAvant)) : 0.7); } else contraindreBunker(r.pos, 0.4);
    if (Math.hypot(dir.x, dir.z) > 0.01) r.lacet = Math.atan2(dir.x, dir.z);
  }
  function versPoint(r, p, v, dt, arret) {
    var dx = p.x - r.pos.x, dz = p.z - r.pos.z, l = Math.hypot(dx, dz);
    if (l <= (arret || 0.2)) { r.vel = { x: 0, y: 0, z: 0 }; return true; }
    if (r.lieu === 'bunker') {
      var ch = chemin(r.pos, p, 'bunker');
      if (ch && ch.length) { dx = ch[0].x - r.pos.x; dz = ch[0].z - r.pos.z; l = Math.hypot(dx, dz) || 1; }
      sim.cheminsDemandes--;
    }
    bouger(r, { x: dx / l, z: dz / l }, Math.min(v, l / dt), dt);
    return false;
  }
  // zombie dont un joueur moyen s'écarte (les chiens, plus rapides que son sprint, ne se fuient pas : il les abat)
  function zombieProche(r, dmax) {
    var best = null, bd = dmax;
    zombies.forEach(function (z) {
      if (!z.vivant || z.type === 'chien' || z.lieu !== r.lieu || z.saisi || t - z.nait < z.emergence * 0.5) return;
      var d = Math.hypot(z.pos.x - r.pos.x, z.pos.z - r.pos.z);
      if (d < bd) { bd = d; best = z; }
    });
    return best;
  }
  function flaqueSous(r, marge) {
    for (var i = 0; i < log.flaques.length; i++) {
      var f = log.flaques[i];
      if (t < f.fin && f.lieu === r.lieu && Math.hypot(r.pos.x - f.pos.x, r.pos.z - f.pos.z) < f.rayon + marge) return f;
    }
    return null;
  }
  // v1.5 : Munitions max (ramassé aussitôt, hypothèse) : chargeurs pleins, rechargement interrompu (proto-arme.js : chargeur et
  // réserve pleins ; la réserve n'est pas simulée : illimitée, comme en v1.4)
  function munitionsMax() {
    log.munitionsMax.push({ t: t });
    robots.forEach(function (r) { if (r.chargeur && r.vivant) { r.munitions = r.chargeur; r.recharge = 0; } });
  }
  // v1.5 : murs électrifiés (instantané de la logique) → marge des robots = distance + 0,5 m (0 : murs inoffensifs)
  function margeMurs() {
    var M = E().murs;
    return M && M.etat === 'electrifies' ? (M.distance || 2.2) + 0.5 : 0;
  }
  function distanceMur(p) {                          // distance au plan du mur le plus proche (comme la logique)
    var dm = 1e9;
    for (var i = 0; i < MURS.length; i++) dm = Math.min(dm, APO - ((p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z));
    return dm;
  }
  function horsDesMurs(p, marge) {                   // direction vers l'intérieur (normales des murs à moins de `marge` m)
    var x = 0, z = 0;
    for (var i = 0; i < MURS.length; i++) {
      var dd = APO - ((p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z);
      if (dd < marge) { x -= MURS[i].x * (marge - dd); z -= MURS[i].z * (marge - dd); }
    }
    var l = Math.hypot(x, z);
    return l > 1e-9 ? { x: x / l, z: z / l } : null;
  }
  function ennemiProche(r, dmax) {                    // zombie ou chien
    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.vivant && z.lieu === r.lieu && !z.saisi && Math.hypot(z.pos.x - r.pos.x, z.pos.z - r.pos.z) < dmax) return z;
    }
    return null;
  }
  function majRobot(r, dt) {
    if (!r.connecte || !r.vivant) { r.vel = { x: 0, y: 0, z: 0 }; return; }
    var e = E();
    // réactions programmées
    for (var i = r.reactions.length - 1; i >= 0; i--) {
      var q = r.reactions[i];
      if (t >= q.at) {
        r.reactions.splice(i, 1);
        if (r.controle) {
          r.esquiveDir = q.dir(); r.esquiveJusqua = t + q.duree; r.esquiveV = q.vitesse;
          var De = dangersRadio(r);                    // v1.4 : il n'esquive pas en se jetant dans un danger de L'Irradié
          if (De) r.esquiveDir = directionEsquive(r, De, r.esquiveDir, q.type, q.vitesse);
        }
      }
    }
    if (r.projection) { if (projeter(r, dt)) return; }  // v1.5 : projeté par la charge du Démembré : ni commandes, ni tir
    if (!r.controle) { r.vel = { x: 0, y: 0, z: 0 }; return; }
    if (t < r.etourdiJusqua) { r.vel = { x: 0, y: 0, z: 0 }; return; }   // v1.4 : étourdi (Survolté) : ni déplacement, ni tir, ni rechargement
    var B = e.boss, enSalle = r.lieu === 'salle';
    if (B.present && B.visible && B.lieu === r.lieu) r.bossVu = { x: B.position.x, y: B.position.y, z: B.position.z };   // v1.5 : intangible → où il a disparu
    var mE = enSalle ? margeMurs() : 0, hd = null;
    if (t < r.esquiveJusqua && r.esquiveDir) bouger(r, r.esquiveDir, r.esquiveV || r.sprint, dt, true);
    else if (r.immobile) r.vel = { x: 0, y: 0, z: 0 };
    else if (mE && distanceMur(r.pos) < mE && (hd = horsDesMurs(r.pos, mE))) bouger(r, hd, r.sprint, dt, true);   // v1.5 : il s'écarte des murs électrifiés
    else {
      var zoneDanger = enSalle && e.zones.filter(function (z) { return z.etat !== 'fin' && Math.hypot(r.pos.x - z.position.x, r.pos.z - z.position.z) < z.rayon + 0.6; })[0];
      var flq = enSalle && !zoneDanger ? flaqueSous(r, 0.6) : null;
      if (flq) zoneDanger = { position: flq.pos, rayon: flq.rayon };
      // v1.4 : dans un danger de L'Irradié (zone radioactive, impact marqué, aura + 1 m) : il en sort au sprint par la
      // meilleure issue (16 directions, murs, piliers, autres zones, zones des sorts, zombies proches) ; sinon v1.3
      var DR = dangersRadio(r);
      if (DR && coutDanger(r.pos, DR, 0, r) > 0) {
        var pref = r.vel && Math.hypot(r.vel.x, r.vel.z) > 0.1 ? { x: r.vel.x / Math.hypot(r.vel.x, r.vel.z), z: r.vel.z / Math.hypot(r.vel.x, r.vel.z) } : fuite(r, B.position || r.pos);
        bouger(r, meilleureDirection(r, DR, pref, r.sprint), r.sprint, dt, true);
      }
      else if (zoneDanger) {                                   // sort au sol : il en sort au sprint, en s'écartant aussi des zombies proches
        var fz = fuite(r, zoneDanger.position), zq = r.recule ? zombieProche(r, 4) : null;
        if (zq) { var fq = fuite(r, zq.pos), fx = fz.x + fq.x * 0.7, fzz = fz.z + fq.z * 0.7, fl = Math.hypot(fx, fzz) || 1; fz = { x: fx / fl, z: fzz / fl }; }
        bouger(r, fz, r.sprint, dt);
      }
      else if (e.etat === 'rituel' && e.capture && e.capture.etat !== 'formation' && r.cercle) {
        // dans le cercle : recule devant un zombie au contact sans sortir du cercle
        var zc0 = r.recule ? zombieProche(r, r.distanceRecul) : null, Rc = (combat.config.phase4.rayon || 4.5) - 0.6;
        if (zc0 && Math.hypot(r.pos.x - CERCLE.x, r.pos.z - CERCLE.z) <= Rc + 0.3) {
          var kx = r.pos.x - zc0.pos.x, kz = r.pos.z - zc0.pos.z, kl = Math.hypot(kx, kz) || 1;
          bouger(r, { x: kx / kl, z: kz / kl }, zc0.vitesse > r.vitesse ? r.sprint : r.vitesse, dt);
          var cx = r.pos.x - CERCLE.x, cz = r.pos.z - CERCLE.z, cl = Math.hypot(cx, cz);
          if (cl > Rc) { r.pos.x = CERCLE.x + cx / cl * Rc; r.pos.z = CERCLE.z + cz / cl * Rc; }
        } else versPoint(r, CERCLE, r.vitesse, dt, 1.0 + (robots.indexOf(r) * 0.5));
      }
      else if (e.etat === 'rituel' && r.cercle) versPoint(r, CERCLE, r.vitesse, dt, 1.0);
      else if (e.etat === 'conclusion' && e.interaction && r.interagit) {
        if (versPoint(r, e.interaction.position, r.vitesse, dt, 1.2)) combat.interagir(r.id, true, dt);
      } else if (B.present && B.lieu === r.lieu && e.controleJoueurs) {
        // v1.4 : Septième protégé → repère = le mini-boss vivant (bande de distance selon son type), sinon le Septième
        var mbR = B.protege ? zombies.filter(function (z) { return z.vivant && z.miniBoss && z.lieu === r.lieu; })[0] : null;
        var ref = mbR ? mbR.pos : B.intangible && r.bossVu ? r.bossVu : B.position, bande = mbR ? bandeMB(mbR) : null;
        var dx = r.pos.x - ref.x, dz = r.pos.z - ref.z, l = Math.hypot(dx, dz) || 1;
        var loinMin = bande ? bande[0] : enSalle ? 6.5 : 6, loinMax = bande ? bande[1] : 11;
        if (t - r.sensT > 3) { r.sensT = t; r.sens = R() < 0.5 ? -1 : 1; }
        // comportement d'un joueur moyen : il recule (en tirant) devant un zombie qui arrive au contact
        var zp = r.recule ? zombieProche(r, r.distanceRecul) : null;
        if (zp) {
          var ax = r.pos.x - zp.pos.x, az = r.pos.z - zp.pos.z, al = Math.hypot(ax, az) || 1;
          var rx = ax / al - az / al * 0.4 * r.sens, rz = az / al + ax / al * 0.4 * r.sens, rl = Math.hypot(rx, rz) || 1;
          bouger(r, { x: rx / rl, z: rz / rl }, zp.vitesse > r.vitesse ? r.sprint : r.vitesse, dt);
        } else {
          var mv = l < loinMin ? { x: dx / l, z: dz / l, v: r.vitesse } : l > loinMax ? { x: -dx / l, z: -dz / l, v: r.vitesse * 0.8 } : { x: -dz / l * r.sens, z: dx / l * r.sens, v: r.vitesse * 0.45 };
          // v1.4 : des coéquipiers ne restent pas collés les uns aux autres (sinon une aura ou un piqué les prend tous)
          var sx = 0, sz = 0;
          robots.forEach(function (o2) {
            if (o2 === r || !o2.vivant || !o2.connecte || o2.lieu !== r.lieu) return;
            var ox = r.pos.x - o2.pos.x, oz = r.pos.z - o2.pos.z, ol = Math.hypot(ox, oz);
            if (ol < 3 && ol > 1e-6) { sx += ox / ol * (3 - ol) / 3; sz += oz / ol * (3 - ol) / 3; }
            else if (ol <= 1e-6) { sx += r.sens; }
          });
          if (sx || sz) { var bx = mv.x + sx * 1.5, bz = mv.z + sz * 1.5, bl = Math.hypot(bx, bz) || 1; mv = { x: bx / bl, z: bz / bl, v: Math.max(mv.v, r.vitesse * 0.6) }; }
          bouger(r, { x: mv.x, z: mv.z }, mv.v, dt);
        }
      } else r.vel = { x: 0, y: 0, z: 0 };
    }
    // tir
    r.tirT -= dt;
    if (r.chargeur && r.recharge > 0) { r.recharge -= dt; if (r.recharge <= 0) r.munitions = r.chargeur; }
    // rechargement « tactique » d'un joueur moyen : chargeur au quart, aucun ennemi à moins de 8 m et pas de boss à cribler
    var Bt = E().boss, bossCible = Bt.present && Bt.visible && Bt.vulnerable && Bt.lieu === r.lieu;
    if (r.chargeur && r.recharge <= 0 && r.munitions <= r.chargeur * 0.25 && !bossCible && !ennemiProche(r, 8)) r.recharge = r.rechargement;
    if (r.tire && r.tirT <= 0 && r.chargeur && (r.munitions <= 0 || r.recharge > 0)) r.tirT = 0;   // pas de tir pendant un rechargement
    else if (r.tire && r.tirT <= 0) {
      r.tirT += 0.1;
      if (r.chargeur) { r.munitions--; if (r.munitions <= 0) r.recharge = r.rechargement; }
      var zc = null, zd = 1e9, bossVisible = B.present && B.visible && B.lieu === r.lieu;   // sans boss à viser, il tire sur tous les zombies en vue
      var flou = t < (r.flouJusqua || 0) ? MODELE.facteurFlou : 1;                        // vision brouillée par une décharge
      var teteR = { x: r.pos.x, y: r.pos.y + 1.6, z: r.pos.z }, mbVise = null;
      if (Bt.protege) zombies.forEach(function (z) {      // v1.3 : le Septième est protégé → le mini-boss en vue (v1.5 : pas s'il est invulnérable)
        if (!z.vivant || !z.miniBoss || z.lieu !== r.lieu || t - z.nait < z.emergence || t < (z.invulnJusqua || 0)) return;
        var dd = Math.hypot(z.pos.x - r.pos.x, z.pos.z - r.pos.z);
        if (dd < 40 && (!mbVise || dd < mbVise.d) && visible(teteR, { x: z.pos.x, y: z.pos.y + 1.3, z: z.pos.z }, r.lieu)) mbVise = { z: z, d: dd };
      });
      // 1) les chiens proches (moins de 8 m) d'abord : ils courent plus vite que lui
      if (r.zombiesAussi) zombies.forEach(function (z) {
        if (!z.vivant || z.type !== 'chien' || z.lieu !== r.lieu || t - z.nait < z.emergence) return;
        var dd = Math.hypot(z.pos.x - r.pos.x, z.pos.z - r.pos.z);
        if (dd < zd && dd < (r.porteeChiens || 8)) { zd = dd; zc = z; }
      });
      // 2) puis le zombie le plus proche (8 m ; 25 m s'il n'y a pas de boss à viser). Un joueur moyen ignore les zombies
      // saisis par le boss (immobiles, inoffensifs) : il profite de la fenêtre d'absorption pour tirer sur le boss
      // (option tueSaisis pour un joueur qui prive le boss de ses âmes). Septième protégé : seuls les zombies à moins de
      // 4 m passent avant le mini-boss en vue.
      if (r.zombiesAussi && !zc) zombies.forEach(function (z) {
        if (!z.vivant || z.miniBoss || z.lieu !== r.lieu || t - z.nait < z.emergence * 0.5 || (z.saisi && !r.tueSaisis)) return;
        var dd = Math.hypot(z.pos.x - r.pos.x, z.pos.z - r.pos.z);
        if (dd < zd && dd < (r.porteeZombies || (mbVise ? 4 : bossVisible ? 8 : 25))) { zd = dd; zc = z; }
      });
      if (!zc && mbVise) zc = mbVise.z;
      r.stats = r.stats || { chien: 0, zombie: 0, boss: 0, rien: 0, recharge: 0, miniBoss: 0, petit: 0 };
      if (zc) {
        var cat = zc.miniBoss ? 'miniBoss' : zc.type === 'chien' ? 'chien' : zc.type === 'demembre_petit' ? 'petit' : 'zombie';
        r.stats[cat] = (r.stats[cat] || 0) + 1;
        if (!(t < (zc.invulnJusqua || 0))) zc.hp -= r.dps * 0.1 * flou;   // v1.5 : rage invulnérable → les balles n'y font rien
        if (zc.hp <= 0) {
          if (zc.type === 'chien') log.chiensTues++;
          if (zc.type === 'demembre_petit') log.petitsTues++;
          if (zc.miniBoss) { log.miniBossTues.push({ t: t, id: zc.id, type: zc.type, par: r.id }); finMiniBossSim(zc, 'mort'); }
          zc.vivant = false; delete ZI[zc.id]; zombies.splice(zombies.indexOf(zc), 1);
        }
      } else if (B.present && B.visible && B.lieu === r.lieu) {
        var tete = { x: r.pos.x, y: r.pos.y + 1.6, z: r.pos.z }, poitrine = { x: B.position.x, y: B.position.y + 1.3, z: B.position.z };
        if (Math.hypot(poitrine.x - tete.x, poitrine.z - tete.z) < 60 && visible(tete, poitrine, r.lieu)) {
          var res = combat.toucherBoss({ joueur: r.id, degats: r.dps * 0.1 * flou, zone: R() < r.precisionTete ? 'tete' : 'corps', position: poitrine, type: 'balle' });
          r.dernierTir = res;
          r.stats.boss++;
        } else r.stats.rien++;
      } else r.stats.rien++;
    }
  }
  function degatsMB(f) { return o.degatsMiniBoss != null ? f * o.degatsMiniBoss : f; }
  function robotsDans(lieu) { return robots.filter(function (r) { return r.connecte && r.vivant && r.lieu === lieu; }); }
  function teteDe(p, h) { return { x: p.x, y: p.y + (h || 1.5), z: p.z }; }
  // IA des mini-boss alignée sur proto/proto-zombies.js : Survolté en chasse (approche au-delà de 7 m ou sans ligne de vue,
  // recul sous 5 m, de flanc entre les deux) → charge (0,7 s immobile, bien visible) dès que sa décharge est presque prête
  // et la cible à portée et en vue → décharge si la cible est encore à portée + 1,2 m (sinon, retour en chasse) → 0,3 s →
  // recharge (immobile) ; coups au contact armés et immobiles (Survolté : coup à 0,38 s sur 0,85 s ; Irradié : 0,62 s sur
  // 1,25 s), l'attaque suivante au plus tôt cadenceContact s après la précédente ; le Démembré arme son fléau (plus bas)
  var MB_PROTO = { charge: 0.7, decharge: 0.3, toleranceDecharge: 1.2,
    contact: { survolte: { debut: 1.6, frappe: 0.38, allonge: 1.9, duree: 0.85 }, irradie: { debut: 1.75, frappe: 0.62, allonge: 2.0, duree: 1.25 } } };
  function majMiniBossSim(z, dt, cible, cd) {
    var P = z.profil || {};
    if (z.type === 'irradie' && P.aura) {             // aura continue, par tranches de 0,25 s
      z.auraT += dt;
      while (z.auraT >= 0.25) {
        z.auraT -= 0.25;
        robotsDans(z.lieu).forEach(function (r) {
          if (Math.hypot(r.pos.x - z.pos.x, r.pos.z - z.pos.z) <= P.aura.rayon) blesser(r, degatsMB(P.aura.degatsParSeconde * 0.25), { source: 'irradie_aura' });
        });
      }
    }
    var enRage = t < (z.rageJusqua || 0);           // v1.5 : animation de rage : immobile, sans attaque (l'aura continue)
    if (z.type === 'irradie' && P.boules && !z.bloque && !enRage) lancerBoules(z, P.boules);
    var D = z.type === 'survolte' ? P.decharge : null;
    if (D) z.dechT = (z.dechT == null ? D.intervalle * 0.5 : z.dechT) + dt;   // comme le prototype : 1re décharge plus tôt
    if (enRage) { z.fleau = null; z.chargeD = null; if (z.mode && z.mode !== 'recharge') { z.mode = 'chasse'; z.modeT = 0; } return; }   // attaque en cours interrompue
    if (!cible || z.bloque) return;
    if (z.type === 'demembre' && P.charge && sansBras(z)) { majChargeSim(z, dt, cible, cd, P); return; }   // v1.5 : sans bras, il charge
    if (z.type === 'demembre' && P.fleau) { majFleau(z, dt, cible, cd, P); return; }
    z.modeT = (z.modeT || 0) + dt;
    var K = MB_PROTO.contact[z.type] || MB_PROTO.contact.irradie;
    if (z.mode === 'contact') {
      if (!z.frappeFaite && z.modeT >= K.frappe) { z.frappeFaite = true; if (cd < K.allonge) blesser(cible, degatsMB(P.degatsContact || 0), { source: z.type + '_contact' }); }
      if (z.modeT >= K.duree) { z.mode = 'chasse'; z.modeT = 0; z.contactPret = t + Math.max(0.1, (P.cadenceContact || 1.2) - K.duree); }
      return;
    }
    if (D && z.mode === 'charge') {
      if (z.modeT >= MB_PROTO.charge) {
        if (cd <= D.portee + MB_PROTO.toleranceDecharge) { tirerDechargeSim(z, cible, D); z.mode = 'decharge'; } else z.mode = 'chasse';
        z.modeT = 0;
      }
      return;
    }
    if (D && z.mode === 'decharge') { if (z.modeT >= MB_PROTO.decharge) { z.mode = 'recharge'; z.modeT = 0; } return; }
    if (D && z.mode === 'recharge') { if (z.modeT >= (D.recharge || 0)) { z.mode = 'chasse'; z.modeT = 0; } return; }
    z.mode = 'chasse';
    if (cd < K.debut && t >= (z.contactPret || 0)) { z.mode = 'contact'; z.modeT = 0; z.frappeFaite = false; return; }
    var vis = visible(teteDe(z.pos), teteDe(cible.pos, 1.2), z.lieu);
    if (D && vis && cd <= D.portee && z.dechT >= D.intervalle - MB_PROTO.charge) { z.mode = 'charge'; z.modeT = 0; log.charges.push({ t: t, id: z.id, cible: cible.id }); return; }
    avancerMiniBoss(z, dt, cible, cd, vis);
  }
  // v1.4 : multi = un arc vers chaque joueur valide à portée (+ tolérance) et en vue ; étourdissement en plus du flou
  function tirerDechargeSim(z, cible, D) {
    var portee = D.portee + MB_PROTO.toleranceDecharge;
    var vises = (D.multi ? robotsDans(z.lieu) : [cible]).filter(function (r) {
      return r.vivant && Math.hypot(r.pos.x - z.pos.x, r.pos.z - z.pos.z) <= portee && visible(teteDe(z.pos), teteDe(r.pos, 1.2), z.lieu);
    });
    z.dechT = 0;
    vises.forEach(function (r) {
      blesser(r, degatsMB(D.degats || 0), { source: 'survolte_decharge' });
      r.flouJusqua = t + (D.flou || 0);
      if (D.etourdissement) { r.etourdiJusqua = Math.max(r.etourdiJusqua, t + D.etourdissement); log.etourdis.push({ t: t, id: r.id }); }
    });
    log.decharges.push({ t: t, id: z.id, cible: cible.id, cibles: vises.map(function (r) { return r.id; }) });
  }
  function avancerMiniBoss(z, dt, cible, cd, vis) {
    var dx = cible.pos.x - z.pos.x, dz = cible.pos.z - z.pos.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, vx, vz;
    if (z.type === 'survolte') {
      if (t >= (z.strafeT || 0)) { z.strafe = R() < 0.5 ? -1 : 1; z.strafeT = t + 1.5 + R() * 1.5; }
      var S = z.strafe || 1;
      if (cd > 7 || !vis) { vx = ux * z.vitesse; vz = uz * z.vitesse; }                       // approche
      else if (cd < 5) { var vr = z.vitesse * 0.7; vx = -ux * vr - uz * S * vr * 0.35; vz = -uz * vr + ux * S * vr * 0.35; }   // recul
      else { vx = -uz * S * 1.1; vz = ux * S * 1.1; }                                           // de flanc
    } else { var v = cd > 1.2 * echelleDe(z) ? z.vitesse : 0; vx = ux * v; vz = uz * v; }
    z.pos.x += vx * dt; z.pos.z += vz * dt;
    if (z.lieu === 'salle') contraindreSalle(z.pos, 0.6 * echelleDe(z)); else contraindreBunker(z.pos, 0.4);
  }
  function echelleDe(z) { return (z.profil && z.profil.echelle > 0) ? z.profil.echelle : 1; }
  function sansBras(z) { return z.sansBrasA != null && t >= z.sansBrasA; }
  // coups au contact du Démembré sans bras (bras droit) : minutage de L'Irradié (brute), distances × echelle (hypothèse)
  function contactDe(z) {
    var K = MB_PROTO.contact[z.type] || MB_PROTO.contact.irradie, e = echelleDe(z);
    return { debut: K.debut * e, frappe: K.frappe, allonge: K.allonge * e, duree: K.duree };
  }
  // v1.4/v1.5 : Septième protégé → bande de distance au mini-boss ; Démembré : hors de portée de son fléau (de son bras droit
  // une fois le bras arraché) : [max(4, portée + 1), max(9, portée + 5)]
  function bandeMB(z) {
    if (z.type === 'demembre' && z.profil) {
      var pr = !sansBras(z) && z.profil.fleau ? z.profil.fleau.portee : contactDe(z).allonge;
      return [Math.max(4, pr + 1), Math.max(9, pr + 5)];
    }
    return MODELE.bandeMiniBoss[z.type] || [6.5, 11];
  }
  // Démembré : quand sa proie est à portée, il fait tournoyer son bras `preparation` s (immobile, lisible), puis frappe
  // en arc (portee m, cône de angle degrés devant lui) ; l'attaque suivante pas avant cadenceContact s
  function majFleau(z, dt, cible, cd, P) {
    var F = P.fleau;
    if (z.fleau) {
      if (t - z.fleau.t0 < F.preparation) return;
      var dir = z.fleau.dir, demi = (F.angle || 150) * Math.PI / 360, touches = [];
      robotsDans(z.lieu).forEach(function (r) {
        var rx = r.pos.x - z.pos.x, rz = r.pos.z - z.pos.z, rl = Math.hypot(rx, rz);
        if (rl > F.portee + 0.35) return;
        var ang = rl < 0.3 ? 0 : Math.acos(Math.max(-1, Math.min(1, (rx * dir.x + rz * dir.z) / rl)));
        if (ang <= demi) { blesser(r, degatsMB(F.degats || 0), { source: z.type === 'demembre_petit' ? 'petit_fleau' : 'demembre_fleau' }); touches.push(r.id); }
      });
      log.fleaux.push({ t: t, id: z.id, touches: touches });
      z.fleau = null; z.attaqueT = t;
      return;
    }
    if (cd <= F.portee && t - z.attaqueT >= (P.cadenceContact || 1.6)) {
      var l = cd || 1;
      z.fleau = { t0: t, dir: { x: (cible.pos.x - z.pos.x) / l, z: (cible.pos.z - z.pos.z) / l } };
      robotsDans(z.lieu).forEach(function (r) {           // ceux qui le voient armer reculent (après leur temps de réaction)
        if (Math.hypot(r.pos.x - z.pos.x, r.pos.z - z.pos.z) <= F.portee + 1.0) planifier(r, t, 'fleau', function () { return fuite(r, z.pos); }, 0.8, r.sprint);
      });
      return;
    }
    avancerMiniBoss(z, dt, cible, cd);
  }
  // v1.5 : Démembré sans bras (§17.1). Charge : quand sa proie est en vue, entre l'allonge de son coup et distanceMax m, et la
  // recharge écoulée, il s'arrête `preparation` s (ceux qui le voient s'écartent de sa ligne après leur réaction), puis fonce
  // en ligne droite vers la position de sa proie au départ (direction figée), à `vitesse` m/s sur au plus `distanceMax` m ;
  // tout joueur à moins de `largeur` m du segment parcouru prend `degats` (une fois par charge) et est projeté ; mur ou pilier
  // heurté : étourdi `etourdiMur` s. Recharge `recharge` s après la fin de la course. Sinon, coups au contact du bras droit.
  function majChargeSim(z, dt, cible, cd, P) {
    var K = P.charge, ech = echelleDe(z), c = z.chargeD;
    if (c && c.etat === 'etourdi') { if (t < c.jusqua) return; z.chargeD = c = null; }
    if (c && c.etat === 'prep') {
      if (t - c.t0 < (K.preparation || 0)) return;
      var proie = c.cible && c.cible.vivant && c.cible.lieu === z.lieu ? c.cible : cible;
      var dx = proie.pos.x - z.pos.x, dz = proie.pos.z - z.pos.z, l = Math.hypot(dx, dz) || 1;
      c.etat = 'course'; c.t0 = t; c.depart = { x: z.pos.x, z: z.pos.z }; c.dir = { x: dx / l, z: dz / l }; c.parcouru = 0; c.touches = {};
      c.entree = { t: t, id: z.id, cible: proie.id, touches: [], choc: null };
      log.chargesDemembre.push(c.entree);
    }
    if (c && c.etat === 'course') {
      var pasC = Math.max(0, Math.min(K.vitesse * dt, K.distanceMax - c.parcouru));
      z.pos.x += c.dir.x * pasC; z.pos.z += c.dir.z * pasC;
      c.parcouru += pasC;
      var choc = obstacleCharge(z, ech);
      if (choc) { if (z.lieu === 'salle') contraindreSalle(z.pos, 0.6 * ech); else contraindreBunker(z.pos, 0.4); }
      robotsDans(z.lieu).forEach(function (r) {
        if (c.touches[r.id] || distanceSegment(r.pos, c.depart, z.pos) >= K.largeur) return;
        c.touches[r.id] = true; c.entree.touches.push(r.id);
        blesser(r, degatsMB(K.degats || 0), { source: 'demembre_charge' });
        if (r.vivant && K.projection) lancerProjection(r, c.dir, z.pos, K.projection, K.impactMur || 0);
      });
      if (choc || c.parcouru >= K.distanceMax - 1e-9) {
        c.entree.choc = choc;
        z.chargeD = choc ? { etat: 'etourdi', jusqua: t + (K.etourdiMur || 0) } : null;
        z.chargePret = t + (K.recharge || 0);
      }
      return;
    }
    var Kc = contactDe(z);
    z.modeT = (z.modeT || 0) + dt;
    if (z.mode === 'contact') {                     // bras droit : armé, immobile
      if (!z.frappeFaite && z.modeT >= Kc.frappe) { z.frappeFaite = true; if (cd < Kc.allonge) blesser(cible, degatsMB(P.degatsContact || 0), { source: 'demembre_contact' }); }
      if (z.modeT >= Kc.duree) { z.mode = 'chasse'; z.modeT = 0; z.contactPret = t + Math.max(0.1, (P.cadenceContact || 1.6) - Kc.duree); }
      return;
    }
    z.mode = 'chasse';
    if (cd < Kc.debut && t >= (z.contactPret || 0)) { z.mode = 'contact'; z.modeT = 0; z.frappeFaite = false; return; }
    var vis = visible(teteDe(z.pos, 1.5 * ech), teteDe(cible.pos, 1.2), z.lieu);
    if (vis && cd >= Kc.debut && cd <= K.distanceMax && t >= (z.chargePret || 0)) {
      z.chargeD = { etat: 'prep', t0: t, cible: cible };
      robotsDans(z.lieu).forEach(function (r) {     // ceux qui le voient gratter le sol s'écartent de sa ligne (après leur réaction)
        if (Math.hypot(r.pos.x - z.pos.x, r.pos.z - z.pos.z) > K.distanceMax + 2 || !visible(teteDe(r.pos, 1.6), teteDe(z.pos, 1.5 * ech), z.lieu)) return;
        planifier(r, t, 'charge', function () { return perpendiculaire(r, z.pos); }, 1.0, r.sprint);
      });
      return;
    }
    avancerMiniBoss(z, dt, cible, cd, vis);
  }
  function distanceSegment(p, a, b) {
    var abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
    var u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2)) : 0;
    return Math.hypot(p.x - (a.x + abx * u), p.z - (a.z + abz * u));
  }
  function obstacleCharge(z, ech) {                // mur ou pilier heurté par la charge (rayon de collision 0,44 × echelle)
    if (z.lieu !== 'salle') return positionValide(z.pos, z.lieu) ? null : 'mur';
    if (penetrationMur(z.pos, 0.6 * ech) > 0) return 'mur';
    for (var j = 0; j < PIL.length; j++) if (!PIL[j].detruit && Math.hypot(z.pos.x - PIL[j].x, z.pos.z - PIL[j].z) < PIL[j].r + 0.44 * ech) return 'pilier';
    return null;
  }
  // projection : dans le sens de la charge, écartée vers l'extérieur (côté du joueur par rapport à la trajectoire), à 45°
  function lancerProjection(r, dirC, centre, Pj, impactMur) {
    var lat = (r.pos.x - centre.x) * -dirC.z + (r.pos.z - centre.z) * dirC.x, sg = lat >= 0 ? 1 : -1;
    var dx = dirC.x - dirC.z * sg, dz = dirC.z + dirC.x * sg, l = Math.hypot(dx, dz) || 1;
    r.projection = { dir: { x: dx / l, z: dz / l }, v: Pj.vitesse || 0, jusqua: t + (Pj.duree || 0), impactMur: impactMur };
    r.esquiveJusqua = 0; r.reactions = [];
    log.projections.push({ t: t, id: r.id });
  }
  function projeter(r, dt) {                       // true tant que le robot est projeté ; mur heurté : impactMur, fin
    var P = r.projection;
    if (!(t < P.jusqua) || !r.vivant) { r.projection = null; return false; }
    r.pos.x += P.dir.x * P.v * dt; r.pos.z += P.dir.z * P.v * dt;
    var choc = r.lieu === 'salle' ? penetrationMur(r.pos, 0.7) > 0 : !positionValide(r.pos, r.lieu);
    if (r.lieu === 'salle') contraindreSalle(r.pos, 0.7); else contraindreBunker(r.pos, 0.4);
    r.vel = { x: P.dir.x * P.v, y: 0, z: P.dir.z * P.v };
    if (choc) {
      r.projection = null; r.vel = { x: 0, y: 0, z: 0 };
      log.impactsMur.push({ t: t, id: r.id });
      blesser(r, degatsMB(P.impactMur), { source: 'demembre_impactMur' });
    }
    return true;
  }
  // v1.5 : aura des zombies, chiens et petits Démembrés irradiés (effetZombie 'irradie'), par tranches de 0,25 s
  function majIrradies(dt) {
    zombies.forEach(function (z) {
      if (!z.vivant || !z.irradie || z.miniBoss || t - z.nait < z.emergence) return;
      var A = z.irradie.aura || {};
      if (!(A.rayon > 0)) return;
      z.irradie.t += dt;
      while (z.irradie.t >= 0.25) {
        z.irradie.t -= 0.25;
        robotsDans(z.lieu).forEach(function (r) {
          if (Math.hypot(r.pos.x - z.pos.x, r.pos.z - z.pos.z) <= A.rayon) blesser(r, degatsMB((A.degatsParSeconde || 0) * 0.25), { source: 'zombie_irradie' });
        });
      }
    });
  }
  // Irradié : toutes les `intervalle` s, parVolee + parJoueurSupp × (n − 1) boules en cloche, une sur chaque joueur valide
  // à portée, à tour de rôle ; la 2e boule d'un même joueur vise sa position dans 1 s. Impact marqué dès le lancer.
  function lancerBoules(z, Bo) {
    if (z.bouleT == null) z.bouleT = t;
    if (t - z.bouleT < Bo.intervalle) return;
    var vises = robotsDans(z.lieu).filter(function (r) { return Math.hypot(r.pos.x - z.pos.x, r.pos.z - z.pos.z) <= Bo.portee; });
    if (!vises.length) return;
    z.bouleT = t;
    var n = robots.filter(function (r) { return r.connecte; }).length;
    var total = Math.max(0, Math.round(Bo.parVolee + Bo.parJoueurSupp * (n - 1))), parJ = {};
    for (var k = 0; k < total; k++) {
      var r = vises[k % vises.length], deja = parJ[r.id] = (parJ[r.id] || 0) + 1;
      var p = deja > 1 ? { x: r.pos.x + r.vel.x * 1.0, y: r.pos.y, z: r.pos.z + r.vel.z * 1.0 } : { x: r.pos.x, y: r.pos.y, z: r.pos.z };
      if (z.lieu === 'salle') contraindreSalle(p, 0.7);
      log.boules.push({ t: t, impactT: t + Bo.tempsVol, pos: p, lieu: z.lieu, src: z.id, Bo: Bo, fait: false });
    }
  }
  function finMiniBossSim(z, effet) {
    if (z.type === 'irradie') {
      log.zonesRadio.forEach(function (q) { if (q.src === z.id && q.fin === Infinity) q.fin = t + 1.5; });   // elles s'éteignent en 1,5 s
      log.boules.forEach(function (b) { if (b.src === z.id) b.fait = true; });
      var FQ = z.profil && z.profil.flaque;
      if (FQ && effet !== 'silencieux') log.flaques.push({ t: t, pos: { x: z.pos.x, y: z.pos.y, z: z.pos.z }, lieu: z.lieu, rayon: FQ.rayon, fin: t + FQ.duree, dps: FQ.degatsParSeconde, tick: 0 });
    }
  }
  // flaques, impacts de boules, zones radioactives (dégâts par exposition : min(dpsMax, dpsBase + dpsParSeconde × expo),
  // expo remise à zéro après `oubli` s hors des zones), par tranches de 0,25 s
  function majDangers(dt) {
    var i, f;
    for (i = log.flaques.length - 1; i >= 0; i--) {
      f = log.flaques[i];
      if (t >= f.fin) continue;
      f.tick += dt;
      while (f.tick >= 0.25) {
        f.tick -= 0.25;
        robotsDans(f.lieu).forEach(function (r) { if (Math.hypot(r.pos.x - f.pos.x, r.pos.z - f.pos.z) <= f.rayon) blesser(r, degatsMB(f.dps * 0.25), { source: 'irradie_flaque' }); });
      }
    }
    log.boules.forEach(function (b) {
      if (b.fait || t < b.impactT) return;
      b.fait = true;
      robotsDans(b.lieu).forEach(function (r) { if (Math.hypot(r.pos.x - b.pos.x, r.pos.z - b.pos.z) <= b.Bo.impact.rayon) blesser(r, degatsMB(b.Bo.impact.degats), { source: 'irradie_boule' }); });
      log.zonesRadio.push({ t: t, pos: b.pos, lieu: b.lieu, rayon: b.Bo.zone.rayon, Z: b.Bo.zone, src: b.src, fin: Infinity });
    });
    if (!log.zonesRadio.length) return;
    robots.forEach(function (r) {
      if (!r.connecte || !r.vivant) return;
      var dedans = log.zonesRadio.some(function (q) { return t < q.fin && q.fin - t > 1.5 - 1e-9 && q.lieu === r.lieu && Math.hypot(r.pos.x - q.pos.x, r.pos.z - q.pos.z) <= q.rayon; });
      var Z = log.zonesRadio[0].Z;
      if (dedans) { r.expo += dt; r.horsZoneT = 0; }
      else { r.horsZoneT += dt; if (r.horsZoneT >= Z.oubli) r.expo = 0; }
      r.zoneTick = (r.zoneTick || 0) + (dedans ? dt : 0);
      while (r.zoneTick >= 0.25) {
        r.zoneTick -= 0.25;
        blesser(r, degatsMB(Math.min(Z.dpsMax, Z.dpsBase + Z.dpsParSeconde * r.expo) * 0.25), { source: 'irradie_zone' });
      }
    });
  }
  function majZombie(z, dt) {
    if (!z.vivant || z.saisi || t - z.nait < z.emergence) return;
    if (z.bloque && !z.miniBoss) return;
    var cible = null, cd = 1e9;
    robots.forEach(function (r) {
      if (!r.connecte || !r.vivant || r.lieu !== z.lieu) return;
      var dd = Math.hypot(r.pos.x - z.pos.x, r.pos.z - z.pos.z);
      if (dd < cd) { cd = dd; cible = r; }
    });
    if (z.miniBoss) { majMiniBossSim(z, dt, cible, cd); return; }
    if (!cible) return;
    if (z.type === 'demembre_petit' && z.profil && z.profil.fleau) { majFleau(z, dt, cible, cd, z.profil); return; }   // v1.5 : fléau de son profil
    if (z.type === 'chien') {
      var P = z.profil || {}, portee = P.portee || 1.4;
      if (cd <= portee) {
        if (t - z.attaqueT >= (P.cadence || 0.9)) { z.attaqueT = t; blesser(cible, o.degatsChien != null ? o.degatsChien : (P.degats != null ? P.degats : 0.1), { source: 'chien' }); }
        if (cd <= portee * 0.6) return;               // au contact : il reste collé à sa proie
      }
    } else {
    var A = z.agressif ? MODELE.attaqueAgressif : MODELE.attaque;
    if (z.attaque) {                                   // coup en cours : le zombie est arrêté
      z.attaque.t += dt;
      if (!z.attaque.frappee && z.attaque.t >= A.armement) {
        z.attaque.frappee = true;
        var c = z.attaque.cible;
        if (c.vivant && c.lieu === z.lieu && Math.hypot(c.pos.x - z.pos.x, c.pos.z - z.pos.z) <= A.allonge) blesser(c, o.degatsZombie != null ? o.degatsZombie : MODELE.degatsZombie, { source: 'zombie' });
      }
      if (z.attaque.t >= A.fin) z.attaque = null;
      return;
    }
    if (cd <= A.debut) { z.attaque = { t: 0, frappee: false, cible: cible }; return; }
    }
    var dx = cible.pos.x - z.pos.x, dz = cible.pos.z - z.pos.z, l = Math.hypot(dx, dz) || 1;
    if (z.lieu === 'bunker') {
      var ch = chemin(z.pos, cible.pos, 'bunker'); sim.cheminsDemandes--;
      if (ch && ch.length) { dx = ch[0].x - z.pos.x; dz = ch[0].z - z.pos.z; l = Math.hypot(dx, dz) || 1; }
    }
    var v = z.vitesse;
    z.pos.x += dx / l * v * dt; z.pos.z += dz / l * v * dt;
    if (z.lieu === 'salle') contraindreSalle(z.pos, 0.6); else contraindreBunker(z.pos, 0.4);
  }

  function pas() {
    var dt = PAS;
    t += dt;
    sim.t = t;
    etatCache = null;
    var ep = E().piliers;
    if (ep) ep.forEach(function (q) { PIL.forEach(function (pl) { if (pl.id === q.id) pl.detruit = q.etat === 'detruit'; }); });
    if (!o.robotsInertes) robots.forEach(function (r) { majRobot(r, dt); });
    zombies.slice().forEach(function (z) { majZombie(z, dt); });
    majDangers(dt);
    majIrradies(dt);
    robots.forEach(function (r) {
      if (r.regen && r.vivant && t - r.dernierCoup >= MODELE.delaiRegen) r.pv = Math.min(1, r.pv + MODELE.vitesseRegen * dt);
    });
    combat.mettreAJour(dt);
    etatCache = null;
    if (o.suivreBoss) { var b = combat.etat().boss; if (b.present && b.lieu === 'bunker') sim.positionsBoss.push({ t: t, x: b.position.x, z: b.position.z }); }
    if (sim.apresPas) sim.apresPas(t);
  }
  sim.pas = pas;
  sim.avancer = function (s) { var n = Math.round(s / PAS); for (var i = 0; i < n; i++) pas(); };
  sim.jusqua = function (pred, max) {
    var fin = t + (max == null ? 600 : max);
    while (!pred() && t < fin) pas();
    return pred();
  };
  sim.etat = function () { return combat.etat(); };
  sim.combat = combat;
  sim.config = C;
  sim.jeu = jeu;
  sim.arene = arene;
  sim.evenements = evenements;
  sim.robot = function (id) { return RI[id]; };
  sim.cercle = CERCLE;
  sim.origine = O;
  sim.bunker = BUNKER;
  sim.dansMurBunker = dansMurBunker;
  sim.placer = function (id, p, lieu) { var r = RI[id]; r.pos = { x: p.x, y: p.y != null ? p.y : (lieu === 'salle' ? O.y : 0), z: p.z }; if (lieu) r.lieu = lieu; r.vel = { x: 0, y: 0, z: 0 }; };
  sim.monde = function (p) { return { x: O.x + p.x, y: O.y + (p.y || 0), z: O.z + p.z }; };
  sim.journalEtats = function () { return evenements.filter(function (e) { return e.type === 'etat'; }).map(function (e) { return { t: e.t, vers: e.d.vers }; }); };
  sim.dureesEtats = function () {
    var l = sim.journalEtats(), r = [];
    for (var i = 0; i < l.length; i++) r.push({ etat: l[i].vers, debut: l[i].t, duree: (i + 1 < l.length ? l[i + 1].t : t) - l[i].t });
    return r;
  };
  return sim;
}

module.exports = { creerSimulation: creerSimulation, CONFIG: CONFIG, ARENE: ARENE, Logique: Logique, ATOUTS: ATOUTS, mulberry32: mulberry32, MODELE: MODELE };
