#!/usr/bin/env node
/*
 * mesures.js — mesures d'équilibrage du boss de Bunker 7 avec des robots « moyens » (350 DPS, réaction 0,45 s) face aux
 * zombies du modèle du prototype (150 PV, sprint, agressifs) : durée de chaque phase, cycles ailes + piqué, survie, total ;
 * v1.2 : chiens apparus et tués, dégâts reçus des chiens (et par source), morts par état, état quitté par un échec.
 * v1.3 : durée de vie de chaque mini-boss (libération → mort), dégâts reçus de chacun, morts par cause (source du coup fatal).
 * v1.4 : Le Démembré, salves de la phase 3, zombies de la faiblesse, paliers de la phase 5 (instant de chaque palier,
 * coups reçus par palier), illusions dissipées, crochets lancés et accrochés.
 * v1.5 : rages des mini-boss (dégâts des murs électrifiés, des zombies irradiés, des petits Démembrés, de la charge et des
 * impacts contre le mur ; petits apparus et tués ; charges, joueurs touchés, projections), Munitions max reçus, intangibilité
 * (évanouissements, traversées, frappes réussies juste après un resurgissement), tirs sur une cible (réserve du prototype :
 * 1 200 balles + 1 200 par Munitions max ; la réserve n'est pas simulée).
 *   node tests/logique/mesures.js                       → solo et coop 4 sur les 5 graines de référence
 *   GRAINES=1,2,3 MODES=solo node tests/logique/mesures.js
 *   SURCHARGES='{"phase2":{"pv":9000}}' node tests/logique/mesures.js   → essai de valeurs sans toucher config.js
 *   DETAIL=1 …                                          → une ligne par graine
 *   CHARGEUR=30 …                                       → robots avec l'arme du prototype (30 balles, 2,1 s de rechargement)
 * Le module exporte aussi mesurer(options) pour les tests.
 */
'use strict';
var path = require('path');
var Sim = require(path.join(__dirname, 'simulateur.js'));

var GRAINES_REFERENCE = [1939, 7, 99, 404, 2718];
var ROBOT_MOYEN = { dps: 350, reaction: 0.45 };
var PV_ZOMBIE = Sim.MODELE.pvZombie;          // zombies du prototype (150 PV)

function joueursMoyens(n, chargeur) {
  var l = [];
  for (var i = 1; i <= n; i++) l.push({ id: 'j' + i, dps: ROBOT_MOYEN.dps, reaction: ROBOT_MOYEN.reaction, chargeur: chargeur || 0, rechargement: 2.1 });
  return l;
}

/** Joue un combat complet et renvoie ses mesures. */
function mesurer(o) {
  var s = Sim.creerSimulation({ joueurs: o.joueurs || joueursMoyens(o.n || 1, o.chargeur), pvZombie: o.pvZombie || PV_ZOMBIE, graine: o.graine,
    surcharges: o.surcharges });
  var pvMin = 1, etatCourant = 'inactif', mortsPhase = {}, etatEchec = null;
  s.combat.on('etat', function (d) { etatCourant = d.vers; if (d.vers === 'echec') etatEchec = d.de; });
  s.apresPas = function () {
    s.robots.forEach(function (r) {
      if (r.connecte) pvMin = Math.min(pvMin, r.pv);
      if (!r.vivant && !r.mortNotee) { r.mortNotee = true; mortsPhase[etatCourant] = (mortsPhase[etatCourant] || 0) + 1; }
    });
  };
  s.combat.demarrer();
  s.jusqua(function () { var e = s.etat().etat; return e === 'termine' || e === 'echec'; }, o.max || 3000);
  var etats = s.dureesEtats(), d = {}, debut = {};
  etats.forEach(function (x) { d[x.etat] = (d[x.etat] || 0) + x.duree; if (debut[x.etat] == null) debut[x.etat] = x.debut; });
  var p2 = etats.filter(function (x) { return x.etat === 'phase2'; })[0];
  function dansP2(e) { return p2 && e.t >= p2.debut - 1e-9 && e.t <= p2.debut + p2.duree + 1e-9; }
  var cycles = s.evenements.filter(function (e) { return e.type === 'piqueImpact' && dansP2(e); }).length;
  var ames = s.evenements.filter(function (e) { return e.type === 'ameAbsorbee' && dansP2(e); }).length;
  var morts = {};
  s.log.degats.forEach(function (x) { if (x.mort) morts[x.id] = true; });
  var fin = s.etat().etat;
  return {
    graine: o.graine, n: (o.joueurs || joueursMoyens(o.n || 1, o.chargeur)).length, fin: fin, total: s.t,
    combat: debut.defaite != null ? debut.defaite : s.t,
    phase1: d.phase1 || 0, phase2: d.phase2 || 0, phase3: d.phase3 || 0,
    p3complete: (d.absence || 0) + (d.retour || 0) + (d.phase3 || 0),
    p4: (d.rituel || 0) + (d.rituel_fin || 0) + (d.faiblesse || 0), faiblesse: d.faiblesse || 0, phase5: d.phase5 || 0,
    cycles: cycles, ames: ames, morts: Object.keys(morts).length, pvMin: pvMin,
    blocs: s.evenements.filter(function (e) { return e.type === 'bloc' && e.d.etat === 'vol'; }).length,
    mortsPhase: mortsPhase,
    etatEchec: etatEchec,                       // état quitté par l'échec (null si le combat n'a pas échoué)
    secondeMoitie: !!s.etat().secondeMoitie,    // v1.2 : déclencheur de la seconde moitié de la phase 1 atteint
    chiensTues: s.log.chiensTues,
    chiensApparus: s.evenements.filter(function (e) { return e.type === 'chien' && e.d.etat === 'apparition'; }).length,
    degatsChiens: s.log.degats.reduce(function (a, x) { return a + (x.source === 'chien' && x.f > 0 ? x.f : 0); }, 0),
    degatsParSource: s.log.degats.reduce(function (a, x) { if (x.f > 0) a[x.source] = (a[x.source] || 0) + x.f; return a; }, {}),
    frappes: s.evenements.filter(function (e) { return e.type === 'frappe' && e.d.reussie; }).length,
    // v1.3 : mini-boss
    dureeSurvolte: dureeMiniBoss(s, 'survolte'), dureeIrradie: dureeMiniBoss(s, 'irradie'), dureeDemembre: dureeMiniBoss(s, 'demembre'),
    degatsDemembre: s.log.degats.reduce(function (a, x) { return a + (x.f > 0 && /^demembre/.test(x.source) ? x.f : 0); }, 0),
    salves: (function () {                      // instants où plusieurs dalles se fissurent ensemble
      var n = {};
      s.evenements.forEach(function (e) { if (e.type === 'bloc' && e.d.etat === 'fissure') n[e.t.toFixed(4)] = (n[e.t.toFixed(4)] || 0) + 1; });
      return Object.keys(n).filter(function (k) { return n[k] >= 2; }).length;
    })(),
    zombiesFaiblesse: s.log.apparitions.filter(function (a) { var e = etatA(s, a.t); return e === 'faiblesse'; }).length,
    paliers: s.evenements.filter(function (e) { return e.type === 'palier' && e.d.numero > 0; }).map(function (e) { return { n: e.d.numero, t: e.t }; }),
    frappesPalier: s.evenements.filter(function (e) { return e.type === 'frappe' && e.d.reussie; }).reduce(function (a, e) { var k = 'p' + e.d.palier; a[k] = (a[k] || 0) + 1; return a; }, {}),
    // v1.5 (§17)
    intangibilites: s.evenements.filter(function (e) { return e.type === 'intangible' && e.d.etat === 'debut'; }).length,
    traversees: s.evenements.filter(function (e) { return e.type === 'intangible' && e.d.etat === 'traversee'; }).length,
    frappesResurgissement: frappesApres(s, 'resurgissement'),
    degatsMurs: somme(s, /^murs$/), chocsMurs: s.evenements.filter(function (e) { return e.type === 'mursChoc'; }).length,
    degatsIrradies: somme(s, /^zombie_irradie$/), infectes: s.log.effets.filter(function (e) { return e.effet === 'irradie' && e.params && e.params.actif; }).length,
    petits: s.log.petits.length, petitsTues: s.log.petitsTues, degatsPetits: somme(s, /^petit_/),
    charges: s.log.chargesDemembre.length, chargesTouches: s.log.chargesDemembre.reduce(function (a, c) { return a + c.touches.length; }, 0),
    projections: s.log.projections.length, impactsMur: s.log.impactsMur.length, degatsCharge: somme(s, /^demembre_(charge|impactMur)$/),
    munitionsMax: s.log.munitionsMax.length,
    tirs: s.robots.reduce(function (a, r) { var st = r.stats || {}; return a + (st.chien || 0) + (st.zombie || 0) + (st.boss || 0) + (st.miniBoss || 0) + (st.petit || 0); }, 0),
    crochets: s.evenements.filter(function (e) { return e.type === 'crochet' && e.d.etat === 'lancer'; }).length,
    accroches: s.evenements.filter(function (e) { return e.type === 'crochet' && e.d.etat === 'accroche'; }).length,
    protection: dureeProtection(s),             // s de protection du Septième (début du siphon → protection levée)
    degatsSurvolte: s.log.degats.reduce(function (a, x) { return a + (x.f > 0 && /^survolte/.test(x.source) ? x.f : 0); }, 0),
    degatsIrradie: s.log.degats.reduce(function (a, x) { return a + (x.f > 0 && /^irradie/.test(x.source) ? x.f : 0); }, 0),
    mortsCause: s.log.degats.reduce(function (a, x) { if (x.mort) a[x.source] = (a[x.source] || 0) + 1; return a; }, {}),
    avertissements: s.evenements.filter(function (e) { return e.type === 'avertissement'; }).map(function (e) { return e.d.texte; })
  };
}

function somme(s, re) { return s.log.degats.reduce(function (a, x) { return a + (x.f > 0 && re.test(x.source) ? x.f : 0); }, 0); }
// frappes réussies du Septième dont la préparation a commencé à la fin d'une action `id` (resurgissement : « frappe aussitôt »)
function frappesApres(s, id) {
  var fins = [], n = 0;
  s.evenements.forEach(function (e, i) {
    if (e.type === 'action' && e.d.id === id) fins.push(e.t);
    if (e.type === 'frappe' && e.d.reussie && fins.some(function (t0) { return e.t - t0 >= 0 && e.t - t0 <= 1.5; })) n++;
  });
  return n;
}
function etatA(s, t) {
  var l = s.journalEtats(), e = null;
  for (var i = 0; i < l.length; i++) if (l[i].t <= t + 1e-9) e = l[i].vers;
  return e;
}
// durée de vie d'un mini-boss (évènements miniBoss libere → mort) ; 0 s'il n'a pas été libéré, jusqu'à la fin s'il vit encore
function dureeMiniBoss(s, type) {
  var l = s.evenements.filter(function (e) { return e.type === 'miniBoss' && e.d.type === type; });
  var lib = l.filter(function (e) { return e.d.etat === 'libere'; })[0], mort = l.filter(function (e) { return e.d.etat === 'mort'; })[0];
  return lib ? (mort ? mort.t : s.t) - lib.t : 0;
}
// temps passé protégé : du début de chaque siphon (≤ 1,5 s après le seuil) à la levée de la protection
function dureeProtection(s) {
  var debuts = s.evenements.filter(function (e) { return e.type === 'action' && e.d.id === 'siphon' && e.d.etape === 'approche'; });
  var fins = s.evenements.filter(function (e) { return e.type === 'protection' && !e.d.actif; });
  return debuts.reduce(function (a, e, i) { return a + ((fins[i] ? fins[i].t : s.t) - e.t); }, 0);
}
function resume(liste, cle) {
  var v = liste.map(function (m) { return m[cle]; });
  var moy = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
  return { min: Math.min.apply(null, v), moy: moy, max: Math.max.apply(null, v) };
}
function f0(x) { return x.toFixed(0); }

function campagne(n, graines, surcharges, detail, chargeur) {
  var l = graines.map(function (g) { return mesurer({ n: n, graine: g, surcharges: surcharges, chargeur: chargeur }); });
  var titre = n === 1 ? 'SOLO' : 'COOP ' + n;
  console.log('\n' + titre + ' — ' + graines.length + ' graines (' + graines.join(', ') + ')');
  if (detail) l.forEach(function (m) {
    console.log('  graine ' + String(m.graine).padEnd(6) + m.fin.padEnd(8) + ' total ' + f0(m.total) + ' s | P1 ' + f0(m.phase1) + ' P2 ' + f0(m.phase2) +
      ' P3 ' + f0(m.phase3) + ' (' + f0(m.p3complete) + ') P4 ' + f0(m.p4) + ' faib ' + f0(m.faiblesse) + ' P5 ' + f0(m.phase5) +
      ' | cycles ' + m.cycles + ' âmes ' + m.ames + ' | morts ' + m.morts + (m.morts ? ' ' + JSON.stringify(m.mortsPhase) : '') + ' pvMin ' + m.pvMin.toFixed(2) +
      ' | chiens ' + m.chiensTues + '/' + m.chiensApparus + ' tués, morsures ' + (m.degatsChiens * 100).toFixed(0) + ' % | Survolté ' + f0(m.dureeSurvolte) + ' s (' +
      (m.degatsSurvolte * 100).toFixed(0) + ' %), Irradié ' + f0(m.dureeIrradie) + ' s (' + (m.degatsIrradie * 100).toFixed(0) + ' %), Démembré ' + f0(m.dureeDemembre) + ' s (' +
      (m.degatsDemembre * 100).toFixed(0) + ' %) | blocs ' + m.blocs + ' frappes ' + JSON.stringify(m.frappesPalier) + ' intangible ' + m.intangibilites + ' (' + m.frappesResurgissement + ' frappes au resurgissement) crochets ' + m.accroches + '/' + m.crochets +
      ' | murs ' + (m.degatsMurs * 100).toFixed(0) + ' %, irradiés ' + (m.degatsIrradies * 100).toFixed(0) + ' %, petits ' + m.petitsTues + '/' + m.petits + ' (' + (m.degatsPetits * 100).toFixed(0) + ' %), charges ' + m.chargesTouches + '/' + m.charges + ' (' + (m.degatsCharge * 100).toFixed(0) + ' %, ' + m.impactsMur + ' contre le mur), munitions max ' + m.munitionsMax + ', tirs ' + m.tirs +
      (Object.keys(m.mortsCause).length ? ' | causes ' + JSON.stringify(m.mortsCause) : '') +
      (m.avertissements.length ? ' | ' + m.avertissements.length + ' avertissement(s)' : ''));
  });
  ['total', 'combat', 'phase1', 'phase2', 'dureeSurvolte', 'dureeIrradie', 'dureeDemembre', 'phase3', 'p3complete', 'p4', 'faiblesse', 'phase5', 'cycles', 'ames', 'pvMin',
    'chiensTues', 'degatsChiens', 'degatsSurvolte', 'degatsIrradie', 'degatsDemembre', 'crochets', 'accroches',
    'degatsMurs', 'degatsIrradies', 'petits', 'petitsTues', 'degatsPetits', 'charges', 'chargesTouches', 'degatsCharge', 'impactsMur', 'munitionsMax',
    'intangibilites', 'traversees', 'frappesResurgissement', 'tirs'].forEach(function (k) {
    var r = resume(l, k), dec = k === 'pvMin' || /^degats/.test(k) ? 2 : k === 'cycles' || k === 'ames' ? 1 : 0;
    console.log('  ' + k.padEnd(19) + 'min ' + r.min.toFixed(dec).padStart(6) + '   moy ' + r.moy.toFixed(dec).padStart(6) + '   max ' + r.max.toFixed(dec).padStart(6));
  });
  var victoires = l.filter(function (m) { return m.fin === 'termine'; }).length;
  var survivants = l.filter(function (m) { return m.morts === 0; }).length;
  var mp = {}, mc = {};
  l.forEach(function (m) { for (var k in m.mortsPhase) mp[k] = (mp[k] || 0) + m.mortsPhase[k]; for (var c in m.mortsCause) mc[c] = (mc[c] || 0) + m.mortsCause[c]; });
  console.log('  victoires ' + victoires + '/' + l.length + ' · aucune mort ' + survivants + '/' + l.length + (Object.keys(mp).length ? ' · morts par état ' + JSON.stringify(mp) : '') +
    (Object.keys(mc).length ? ' · par cause ' + JSON.stringify(mc) : ''));
  return l;
}

if (require.main === module) {
  var graines = process.env.GRAINES ? process.env.GRAINES.split(',').map(Number) : GRAINES_REFERENCE;
  var modes = (process.env.MODES || 'solo,coop4').split(',');
  var surcharges = process.env.SURCHARGES ? JSON.parse(process.env.SURCHARGES) : undefined;
  var t0 = Date.now();
  modes.forEach(function (m) { campagne(m === 'solo' ? 1 : +m.replace('coop', ''), graines, surcharges, !!process.env.DETAIL, +process.env.CHARGEUR || 0); });
  console.log('\n(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s de calcul)');
}

module.exports = { mesurer: mesurer, campagne: campagne, GRAINES_REFERENCE: GRAINES_REFERENCE, ROBOT_MOYEN: ROBOT_MOYEN, PV_ZOMBIE: PV_ZOMBIE };
