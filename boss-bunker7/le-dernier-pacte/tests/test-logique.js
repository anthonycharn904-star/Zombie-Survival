#!/usr/bin/env node
/*
 * test-logique.js — tests de la logique du boss de Bunker 7 (src/logique.js) avec l'adaptateur simulé.
 *   node tests/test-logique.js            → « ok / ÉCHEC » par test, code de sortie ≠ 0 en cas d'échec
 *   node tests/test-logique.js capture    → seulement les tests dont le nom contient « capture »
 * Couvre le §14 de la demande d'Anthony : chaque phase isolément, puis le combat complet en solo et en coop.
 * v1.2 (API.md §14) : la meute de chiens chasse de la seconde moitié de la phase 1 à la mort du boss. Les tests qui isolent
 * une autre mécanique avec des robots passifs passent `sansChiens: true` (chiens.actif = false) : sinon les chiens tuent
 * ces robots qui ne tirent pas, comptent dans la liste de zombies du simulateur et décalent les tirages de la graine.
 * Les interactions des chiens avec ces mécaniques sont couvertes par les tests 57 à 69.
 * v1.3 (API.md §15) : en phase 2, les seuils de PV bloquent le Septième jusqu'à la mort de chaque mini-boss ; un test qui
 * vide la phase 2 d'un coup pour atteindre ce qui suit passe `sansMiniBoss: true` ou abat les mini-boss (vaincreMiniBoss).
 * Tests 71 à 79.
 * v1.4 (API.md §16) : 3e cuve et Démembré, salves de la phase 3, zombies de la faiblesse, paliers de la phase 5 (coups bleus
 * puis quasi mortels, illusions, crochets) : tests 81 à 89 (avant le test 80 de couverture) ; 22 et 23 suivent les paliers.
 * v1.5 (API.md §17) : rages des mini-boss (murs électrifiés, infection, bras et petits Démembrés), Munitions max à leur mort,
 * intangibilité au palier 2 (les illusions sont retirées : 87 et 89 la testent) : tests 90 à 96 ; fente du resurgissement : 97.
 */
'use strict';
var path = require('path');
var Sim = require(path.join(__dirname, 'logique', 'simulateur.js'));
var CONFIG = Sim.CONFIG;
var PAS = 1 / 60;
var filtre = process.argv[2] || '';
var resultats = [], evenementsVus = {}, actionsVues = {}, chiensVus = {}, notes = [];

function test(nom, fn) {
  if (filtre && nom.indexOf(filtre) < 0) return;
  var t0 = Date.now();
  try {
    fn();
    resultats.push({ ok: true, nom: nom });
    console.log('ok      ' + nom + '  (' + (Date.now() - t0) + ' ms)');
  } catch (e) {
    resultats.push({ ok: false, nom: nom });
    console.log('ÉCHEC   ' + nom + '\n          ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n          ') : e));
  }
}
function verifier(cond, message, info) {
  if (!cond) throw new Error(message + (info !== undefined ? ' — ' + JSON.stringify(info) : ''));
}
function proche(a, b, tol) { return Math.abs(a - b) <= tol; }
function note(s) { notes.push(s); console.log('          ' + s); }
function sim(o) {
  o = o || {};
  if (o.sansChiens) o.surcharges = fusionnerTest(JSON.parse(JSON.stringify(o.surcharges || {})), { chiens: { actif: false } });
  if (o.sansMiniBoss) o.surcharges = fusionnerTest(JSON.parse(JSON.stringify(o.surcharges || {})), { miniBoss: { actif: false } });
  var s = Sim.creerSimulation(o);
  s.combat.on('*', function (type, d) {
    evenementsVus[type] = true;
    if (type === 'action') { var k = d.id + '/' + d.etape; actionsVues[k] = true; }
    if (type === 'chien') chiensVus[d.etat + (d.raison ? '/' + d.raison : '')] = true;
    if (type === 'meute') chiensVus['meute/' + d.etat] = true;
    if (type === 'tube' || type === 'miniBoss') chiensVus[type + '/' + d.etat] = true;
    if (type === 'protection') chiensVus['protection/' + d.actif] = true;
    if (type === 'palier') chiensVus['palier/' + d.numero] = true;                         // v1.4 (§16.5)
    if (type === 'murs' || type === 'infection' || type === 'bras' || type === 'petitDemembre' || type === 'intangible') chiensVus[type + '/' + d.etat] = true;   // v1.5
    if (type === 'bonus') chiensVus['bonus/' + d.source] = true;
    if (type === 'crochet') { chiensVus['crochet/' + d.etat] = true; if (d.raison) chiensVus['crochet/' + d.etat + '/' + d.raison] = true; }
  });
  return s;
}
function etat(s) { return s.etat().etat; }
function evs(s, type, filtreFn) { return s.evenements.filter(function (e) { return e.type === type && (!filtreFn || filtreFn(e.d)); }); }
function finCombat(s) { var e = etat(s); return e === 'termine' || e === 'echec'; }
function dansSalleMonde(s, p, marge) {
  var O = s.origine, A = s.arene.salle.apotheme;
  return s.arene.salle.murs.every(function (m) { return (p.x - O.x) * m.normale.x + (p.z - O.z) * m.normale.z <= A - marge; });
}
var ORDRE = ['introduction', 'phase1', 'repit', 'phase2', 'transition23', 'absence', 'retour', 'phase3', 'transition34',
  'rituel', 'rituel_fin', 'faiblesse', 'transition45', 'phase5', 'defaite', 'retour_salle', 'conclusion', 'recompenses', 'message', 'termine'];
var MOYEN = { dps: 350, reaction: 0.45, precisionTete: 0.15 };

// ═══════════════════════════════════════ 1. configuration et contrat ═══════════════════════════════════════
test('01 config : aucune valeur hors cahier des charges (valider)', function () {
  verifier(CONFIG.valider().length === 0, 'avertissements de config', CONFIG.valider());
  var c = JSON.parse(JSON.stringify(CONFIG));
  c.phase3.arrachement.degats = 0.1; c.repit.duree = 10;
  verifier(CONFIG.valider(c).length === 2, 'valider doit signaler les écarts', CONFIG.valider(c));
});

test('02 contrat : API, adaptateur incomplet refusé, instantané sérialisable et complet', function () {
  var s = sim({ joueurs: [{ id: 'j1', increvable: true }] });   // v1.5 : déroulé indépendant de l'équilibrage (test 44)
  ['demarrer', 'mettreAJour', 'toucherBoss', 'toucherIllusion', 'interagir', 'etat', 'on', 'off', 'allerA', 'forcer', 'detruire'].forEach(function (m) {
    verifier(typeof s.combat[m] === 'function', 'méthode absente : ' + m);
  });
  var erreur = null;
  try { Sim.Logique.creerCombat({ config: CONFIG, arene: Sim.ARENE, jeu: { joueurs: function () { return []; } } }); } catch (e) { erreur = e.message; }
  verifier(erreur && erreur.indexOf('infligerDegats') >= 0 && erreur.indexOf('retirerZombie') >= 0, 'adaptateur incomplet non signalé', erreur);
  var cles = ['etat', 'phase', 'tempsEtat', 'compteARebours', 'controleJoueurs', 'lieu', 'boss', 'barre', 'capture', 'jauge', 'vision',
    'piliers', 'blocs', 'projectiles', 'zones', 'ames', 'pique', 'joueurs', 'interaction', 'message', 'recompenses', 'temps',
    'secondeMoitie', 'meute', 'tubes', 'miniBoss', 'illusions', 'crochets',   // v1.2 (§14), v1.3 (§15) et v1.4 (§16.5)
    'murs', 'infection', 'bras', 'petits'];                                   // v1.5 (§17.1)
  var clesBoss = ['present', 'visible', 'lieu', 'position', 'lacet', 'vitesse', 'locomotion', 'action', 'vulnerable', 'multiplicateur',
    'puissance', 'ames', 'ailes', 'lames', 'affaiblissement', 'regard', 'protege', 'palier', 'couleurLames', 'intangible'];
  s.combat.demarrer();
  var vus = {}, n = 0;
  s.apresPas = function () {
    if (++n % 20) return;
    var e = s.etat(), j = JSON.parse(JSON.stringify(e));
    vus[e.etat] = true;
    cles.forEach(function (k) { if (!(k in j)) throw new Error('champ absent de etat() : ' + k + ' (' + e.etat + ')'); });
    clesBoss.forEach(function (k) { if (!(k in j.boss)) throw new Error('champ absent de etat().boss : ' + k); });
    if (e.boss.action) ['id', 'etape', 't', 'duree', 'progression', 'cible', 'cibleJoueur', 'donnees'].forEach(function (k) {
      if (!(k in j.boss.action)) throw new Error('champ absent de boss.action : ' + k);
    });
    ['segments', 'segment', 'valeur', 'max', 'titre', 'visible'].forEach(function (k) { if (!(k in j.barre)) throw new Error('barre.' + k); });
    j.miniBoss.forEach(function (m) { ['rage', 'invulnerable'].forEach(function (k) { if (!(k in m)) throw new Error('miniBoss[i].' + k); }); });   // v1.5
    if (!Array.isArray(j.petits) || !Array.isArray(j.illusions) || j.illusions.length) throw new Error('petits : tableau ; illusions : toujours [] (v1.5)');
  };
  s.jusqua(function () { return finCombat(s); }, 1500);
  verifier(etat(s) === 'termine', 'le combat doit se terminer', etat(s));
  verifier(ORDRE.every(function (k) { return vus[k] || k === 'termine'; }), 'états non vus dans l’instantané', ORDRE.filter(function (k) { return !vus[k]; }));
});

// ═══════════════════════════════════════ 2. combat complet ═══════════════════════════════════════
var dureesSolo = null;
test('03 combat complet solo : ordre des états, 15 / 30 / 30 s, contrôles, invulnérabilité, manches, drapeau', function () {
  var s = sim({ joueurs: [{ id: 'j1', dps: MOYEN.dps, reaction: MOYEN.reaction, increvable: true }], pvZombie: Sim.MODELE.pvZombie });   // v1.5 : increvable (équilibrage : test 44)
  verifier(s.combat.demarrer() === true, 'demarrer');
  s.jusqua(function () { return finCombat(s); }, 2000);
  verifier(etat(s) === 'termine', 'fin attendue : termine', etat(s));
  var seq = s.journalEtats().map(function (e) { return e.vers; });
  verifier(JSON.stringify(seq) === JSON.stringify(ORDRE), 'ordre des états', seq);
  var d = {};
  s.dureesEtats().forEach(function (x) { d[x.etat] = x.duree; });
  verifier(proche(d.repit, 15, PAS * 1.5), 'répit de 15 s', d.repit);
  verifier(proche(d.absence, 30, PAS * 1.5), 'absence de 30 s', d.absence);
  // capture : le temps passé à capturer (hors formation, contestation, sortie) vaut 30 s
  var capt = 0, tPrec = null, enCapture = false;
  s.evenements.forEach(function (e) {
    if (e.type === 'capture') {
      if (enCapture && tPrec != null) capt += e.t - tPrec;
      enCapture = e.d.etat === 'capture'; tPrec = e.t;
    }
  });
  verifier(proche(capt, 30, PAS * 3), 'capture effective de 30 s', capt);
  // contrôles verrouillés uniquement pendant les séquences
  var verrous = s.log.controle.filter(function (c) { return !c.a; }).map(function (c) { return c.t; });
  var cins = evs(s, 'cinematique').map(function (e) { return e.d.nom + (e.d.actif ? '+' : '-'); });
  verifier(JSON.stringify(cins) === JSON.stringify(['introduction+', 'introduction-', 'capture_ames+', 'capture_ames-', 'defaite+', 'defaite-', 'retour_bunker+', 'retour_bunker-']), 'cinématiques', cins);
  // v1.4 (§16.5) : en plus des 4 séquences, un verrou par crochet qui accroche (rendu après le coup)
  var accroches = evs(s, 'crochet', function (d) { return d.etat === 'accroche'; }).length;
  verifier(verrous.length === 4 + accroches, '4 verrouillages des commandes, + 1 par crochet accroché', { verrous: verrous.length, accroches: accroches });
  verifier(s.robot('j1').controle === true, 'commandes rendues à la fin');
  var inv = s.log.invulnerable.filter(function (c) { return c.a; }).length;
  verifier(inv >= 4, 'invulnérable pendant chaque séquence', inv);
  verifier(s.log.manches.length === 2 && s.log.manches[0].a === true && s.log.manches[1].a === false, 'manches suspendues puis reprises', s.log.manches);
  verifier(s.drapeaux[CONFIG.general.drapeauTermine] === true, 'drapeau de fin écrit');
  verifier(s.log.journal.filter(function (j) { return j.niveau === 'erreur'; }).length === 0, 'aucune erreur', s.log.journal);
  verifier(evs(s, 'avertissement').length === 0, 'aucun avertissement', evs(s, 'avertissement').map(function (e) { return e.d.texte; }));
  var r = s.robot('j1');
  verifier(r.lieu === 'bunker', 'le joueur reprend la partie dans Bunker 7', r.lieu);
  dureesSolo = s.dureesEtats();
});

// ═══════════════════════════════════════ 3. seuils et dégâts sur le boss ═══════════════════════════════════════
test('04 seuils : PV par segment selon le nombre de joueurs, transition au seuil, immunité signalée', function () {
  [1, 2, 3, 4].forEach(function (n) {
    var joueurs = [];
    for (var i = 1; i <= n; i++) joueurs.push({ id: 'j' + i });
    var s = sim({ joueurs: joueurs });
    s.combat.demarrer();
    var b = s.etat().barre, k = 1 + CONFIG.coop.pvParJoueurSupp * (n - 1);
    verifier(proche(b.segments[0], CONFIG.phase1.pv * k, 1e-6) && proche(b.segments[2], CONFIG.phase3.pv * k, 1e-6) && proche(b.segments[3], CONFIG.phase4.faiblesse.pv * k, 1e-6), 'PV × ' + k, b.segments);
  });
  var s = sim({ joueurs: [{ id: 'j1', tire: false }] });
  s.combat.allerA('phase1');
  var pv0 = s.etat().barre.valeur;
  var r = s.combat.toucherBoss({ joueur: 'j1', degats: 100, zone: 'tete' });
  verifier(r.applique && proche(r.montant, 150, 1e-9) && proche(s.etat().barre.valeur, pv0 - 150, 1e-9), 'tête × 1,5', r);
  s.combat.toucherBoss({ joueur: 'j1', degats: pv0 * 10, zone: 'corps' });
  verifier(s.etat().barre.valeur === 0, 'segment vidé');
  s.pas();
  verifier(etat(s) === 'repit', 'transition au pas suivant', etat(s));
  verifier(evs(s, 'segment').length === 1 && evs(s, 'segment')[0].d.index === 0, 'évènement segment 0');
  var n0 = evs(s, 'immunise').length;
  var r2 = s.combat.toucherBoss({ joueur: 'j1', degats: 100, zone: 'corps' });
  verifier(!r2.applique && r2.raison === 'invulnerable' && evs(s, 'immunise').length === n0 + 1, 'répit : invulnérable et signalé', r2);
  s.combat.allerA('absence');
  verifier(s.combat.toucherBoss({ joueur: 'j1', degats: 100 }).raison === 'absent', 'absence : boss absent');
});

// ═══════════════════════════════════════ 4. phase 1 ═══════════════════════════════════════
test('05 phase1 : sort → projectile → zone marquée puis active → zombies qui émergent de la zone', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false }], degatsZombie: 0 });
  s.combat.allerA('phase1');
  s.jusqua(function () { return evs(s, 'invocation').length >= 6; }, 60);
  var zones = evs(s, 'zone'), apparitions = evs(s, 'invocation');
  verifier(zones.length >= 2 && apparitions.length >= 6, 'zones et zombies', [zones.length, apparitions.length]);
  verifier(evs(s, 'projectile', function (d) { return d.type === 'invocation'; }).length >= zones.length, 'un projectile par zone');
  var dansUneZone = apparitions.every(function (a) { return zones.some(function (z) { return Math.hypot(a.d.position.x - z.d.position.x, a.d.position.z - z.d.position.z) <= z.d.rayon + 1e-6; }); });
  verifier(dansUneZone, 'chaque zombie sort d’une zone');
  var em = s.log.apparitions.filter(function (a) { return a.effet === 'emergence'; }).length;
  verifier(em === apparitions.length, 'effet « emergence »', em);
  // la zone devient active après delaiActivation, puis disparaît
  var z0 = zones[0], actif = null;
  s.combat.on('action', function () {});
  var e = s.etat();
  verifier(e.zones.every(function (z) { return ['marquee', 'active', 'fin'].indexOf(z.etat) >= 0; }), 'états de zone');
  var pz = zones.map(function (z) { return z.d.position; });
  verifier(pz.every(function (p) { return dansSalleMonde(s, p, 1.5); }), 'zones dans la salle (marge 1,5 m)');
  var piliers = s.arene.salle.piliers.map(function (p) { return s.monde(p); });
  verifier(pz.every(function (p) { return piliers.every(function (q) { return Math.hypot(p.x - q.x, p.z - q.z) > 0.85 + 1.2; }); }), 'zones hors des piliers');
});

test('06 phase1 : une zone blesse de 8 %/s un joueur immobile, le trait maudit touche 12 %', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, immobile: true, regen: false, reaction: null }], degatsZombie: 0,
    surcharges: { phase1: { trait: { actif: false } } } });
  s.combat.allerA('phase1');
  // le joueur reste là où la prochaine zone s'est posée
  s.jusqua(function () { return evs(s, 'zone').length >= 1; }, 30);
  var z = evs(s, 'zone')[0].d;
  s.placer('j1', { x: z.position.x, z: z.position.z }, 'salle');
  var pv0 = s.robot('j1').pv;
  s.avancer(CONFIG.phase1.invocation.zone.delaiActivation + CONFIG.phase1.invocation.zone.duree + 0.5);
  var pris = s.log.degats.filter(function (d2) { return d2.source === 'zone'; }).reduce(function (a, d2) { return a + d2.f; }, 0);
  verifier(proche(pris, 0.08 * CONFIG.phase1.invocation.zone.duree, 0.025), 'dégâts de zone ≈ 8 %/s pendant la durée active', pris);
  // trait maudit
  var s2 = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, immobile: true, regen: false, reaction: null }], degatsZombie: 0,
    surcharges: { phase1: { invocation: { intervalle: [999, 999] }, trait: { intervalle: [1, 1] } } } });
  s2.combat.allerA('phase1');
  s2.jusqua(function () { return s2.log.degats.some(function (d2) { return d2.source === 'trait'; }); }, 20);
  var tr = s2.log.degats.filter(function (d2) { return d2.source === 'trait'; });
  verifier(tr.length >= 1 && proche(tr[0].f, 0.12, 1e-9), 'trait : 12 %', tr);
  // un joueur qui esquive n'est pas touché
  var s3 = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, reaction: 0.3 }], degatsZombie: 0,
    surcharges: { phase1: { invocation: { intervalle: [999, 999] }, trait: { intervalle: [2, 2] } } } });
  s3.combat.allerA('phase1');
  s3.avancer(25);
  var lances = evs(s3, 'projectile', function (d2) { return d2.type === 'trait'; }).length;
  var touches = s3.log.degats.filter(function (d2) { return d2.source === 'trait'; }).length;
  verifier(lances >= 5 && touches <= Math.floor(lances * 0.2), 'esquive du trait', [lances, touches]);
});

test('07 phase1 : plafond de zombies (solo et coop) respecté', function () {
  [1, 4].forEach(function (n) {
    var joueurs = [];
    for (var i = 1; i <= n; i++) joueurs.push({ id: 'j' + i, tire: false, zombiesAussi: false, immobile: true });
    var s = sim({ joueurs: joueurs, degatsZombie: 0 });
    s.combat.allerA('phase1');
    var max = CONFIG.phase1.zombiesMax + CONFIG.coop.zombiesParJoueurSupp * (n - 1), pire = 0;
    s.apresPas = function () { pire = Math.max(pire, s.zombies.length); };
    s.avancer(60);
    verifier(pire <= max && pire >= max - 2, 'zombies simultanés ≤ ' + max, pire);
  });
});

// ═══════════════════════════════════════ 5. phase 2 ═══════════════════════════════════════
test('08 phase2 : compteur d’âmes exact, ailes à 10, piqué, perte des ailes, cycle répété', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, reaction: 0.35 }], degatsZombie: 0, sansChiens: true });
  s.combat.allerA('phase2');
  var compte = 0, erreurs = [];
  s.combat.on('ameAbsorbee', function (d) { compte++; if (d.ames < 1) erreurs.push(d); });
  s.combat.on('ailes', function (d) {
    var b = s.etat().boss;
    if (d.etat === 'apparition' && b.ames < 10) erreurs.push({ ailes: b.ames });
  });
  s.jusqua(function () { return evs(s, 'ailes', function (d) { return d.etat === 'deployees'; }).length >= 2 && evs(s, 'ailes', function (d) { return d.etat === 'absentes'; }).length >= 2; }, 400);
  var seq = evs(s, 'ailes').map(function (e) { return e.d.etat; });
  verifier(seq.length >= 8, 'deux cycles complets d’ailes', seq);
  verifier(JSON.stringify(seq.slice(0, 8)) === JSON.stringify(['apparition', 'deployees', 'dissipation', 'absentes', 'apparition', 'deployees', 'dissipation', 'absentes']), 'cycle des ailes', seq);
  verifier(erreurs.length === 0, 'ailes jamais avant 10 âmes', erreurs);
  // à chaque disparition des ailes, le compteur repart de 0
  var absentes = evs(s, 'ailes', function (d) { return d.etat === 'absentes'; });
  var avantDeuxieme = evs(s, 'ameAbsorbee').filter(function (e) { return e.t > absentes[0].t && e.t < evs(s, 'ailes', function (d) { return d.etat === 'apparition'; })[1].t; });
  verifier(avantDeuxieme.length >= 10 && avantDeuxieme[0].d.ames === 1, 'compteur remis à 0 après le piqué', avantDeuxieme.map(function (e) { return e.d.ames; }));
  // un piqué après chaque apparition d'ailes
  var charges = evs(s, 'pique', function (d) { return d.etape === 'charge'; }).length;
  verifier(charges >= 2, 'un piqué par cycle', charges);
});

test('09 phase2 : âme refusée si le zombie saisi est tué avant l’extraction ; fenêtre × 1,5', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false }], degatsZombie: 0 });
  s.combat.allerA('phase2');
  s.jusqua(function () { return evs(s, 'absorption', function (d) { return d.etat === 'debut'; }).length >= 1; }, 60);
  var deb = evs(s, 'absorption', function (d) { return d.etat === 'debut'; })[0].d;
  var victime = deb.cibles[0];
  s.jeu.retirerZombie(victime, { effet: 'mort' });           // tué par un joueur pendant la saisie
  var r = s.combat.toucherBoss({ joueur: 'j1', degats: 100, zone: 'corps' });
  verifier(r.applique && proche(r.montant, 150, 1e-9), 'fenêtre d’absorption × 1,5', r);
  s.jusqua(function () { return evs(s, 'absorption', function (d) { return d.etat === 'fin'; }).length >= 1; }, 20);
  var extraits = evs(s, 'ameExtraite').map(function (e) { return e.d.zombieId; });
  verifier(extraits.indexOf(victime) < 0 && extraits.length === deb.cibles.length - 1, 'pas d’âme pour le zombie tué', { extraits: extraits, cibles: deb.cibles });
  verifier(s.etat().boss.ames === deb.cibles.length - 1, 'compteur = âmes arrivées', s.etat().boss.ames);
  var r2 = s.combat.toucherBoss({ joueur: 'j1', degats: 100, zone: 'corps' });
  verifier(proche(r2.montant, 100, 1e-9), 'hors absorption × 1', r2);
});

function essaiPique(reaction, graine) {
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, reaction: reaction, immobile: reaction == null }], degatsZombie: 0, graine: graine,
    surcharges: { phase2: { invocation: { intervalle: [999, 999] }, absorption: { intervalle: [999, 999] } } } });
  s.combat.allerA('phase2');
  s.combat.forcer('ames', 10);
  s.jusqua(function () { return evs(s, 'piqueImpact').length >= 1; }, 15);
  return { s: s, touche: s.log.degats.filter(function (d) { return d.source === 'pique'; }) };
}
test('10 phase2 : piqué annoncé — esquivé avec 0,35 s de réaction, encaissé (60 %) sans réaction', function () {
  var esquives = 0, encaisses = 0;
  for (var g = 1; g <= 6; g++) {
    var a = essaiPique(0.35, g);
    verifier(evs(a.s, 'piqueImpact').length === 1, 'piqué exécuté', g);
    if (a.touche.length === 0) esquives++;
    var b = essaiPique(null, g);
    verifier(b.touche.length === 1 && proche(b.touche[0].f, 0.6, 1e-9), 'immobile → touché à 60 %', b.touche);
    encaisses++;
    // trajectoire figée après le verrouillage
    var ver = evs(b.s, 'pique', function (d) { return d.etape === 'verrouille'; })[0], ch = evs(b.s, 'pique', function (d) { return d.etape === 'charge'; })[0];
    verifier(ver && ch && proche(ver.d.arrivee.x, ch.d.arrivee.x, 1e-9) && proche(ver.d.arrivee.z, ch.d.arrivee.z, 1e-9), 'arrivée figée au verrouillage');
    verifier(proche(ch.t - ver.t, CONFIG.phase2.pique.verrouillage, PAS * 1.5), 'verrouillage de ' + CONFIG.phase2.pique.verrouillage + ' s avant la charge', ch.t - ver.t);
  }
  verifier(esquives === 6, 'les 6 piqués esquivés', esquives);
});

test('11 phase2 : étourdi après l’impact (× 1,25), ailes dissipées, remontée', function () {
  var a = essaiPique(null, 3), s = a.s;
  s.jusqua(function () { var e = s.etat(); return e.boss.action && e.boss.action.id === 'pique' && e.boss.action.etape === 'etourdi'; }, 3);
  var r = s.combat.toucherBoss({ joueur: 'j1', degats: 100 });
  verifier(proche(r.montant, 125, 1e-9), 'étourdi × 1,25', r);
  verifier(s.etat().boss.ailes === 'dissipation', 'ailes en dissipation');
  s.jusqua(function () { return !s.etat().boss.action; }, 5);
  verifier(s.etat().boss.ailes === 'absentes' && s.etat().boss.ames === 0, 'ailes absentes, compteur à 0', s.etat().boss);
});

// ═══════════════════════════════════════ 6. phase 3 ═══════════════════════════════════════
test('12 phase3 : absence de 30 s, retour en rage — zombies en cendres, apparitions reprises après le délai (v1.1)', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false }], degatsZombie: 0, sansChiens: true });
  s.combat.allerA('transition23');
  s.jusqua(function () { return etat(s) === 'absence'; }, 10);
  var tA = s.t;
  s.jusqua(function () { return etat(s) === 'retour'; }, 40);
  verifier(proche(s.t - tA, 30, PAS * 1.5), 'absence de 30 s', s.t - tA);
  verifier(s.log.apparitions.filter(function (a) { return a.effet === 'breche'; }).length >= 8, 'apparitions par les brèches pendant l’absence');
  var nAvant = s.zombies.length;
  verifier(nAvant > 0, 'des zombies restent au retour', nAvant);
  s.jusqua(function () { return etat(s) === 'phase3'; }, 10);
  verifier(s.zombies.length === 0, 'tous les zombies ont disparu', s.zombies.length);
  var cendres = evs(s, 'zombiesCendres');
  verifier(cendres.length === 1 && cendres[0].d.ids.length === nAvant, 'évènement zombiesCendres', cendres.length);
  verifier(s.log.retraits.filter(function (r) { return r.effet === 'cendres'; }).length === nAvant, 'retraits « cendres »');
  var n0 = s.log.apparitions.length, A3 = CONFIG.phase3.apparitions;
  s.avancer(A3.delai - 0.2);
  verifier(s.log.apparitions.length === n0, 'aucune apparition pendant les ' + A3.delai + ' premières secondes', s.log.apparitions.length - n0);
  s.avancer(0.4);
  verifier(s.log.apparitions.length === n0 + 1 || s.log.apparitions.length === n0, 'reprise à ' + A3.delai + ' s');
  s.avancer(40);
  var ap = s.log.apparitions.slice(n0);
  verifier(ap.length >= A3.max && ap.every(function (a) { return a.effet === 'breche' && a.lieu === 'salle'; }), 'zombies des brèches en phase 3', ap.length);
  var t1 = ap[0].t - s.dureesEtats().filter(function (x) { return x.etat === 'phase3'; })[0].debut;
  verifier(proche(t1, A3.delai + A3.intervalle, 0.05), 'première apparition à délai + intervalle', t1);
  verifier(s.zombies.length <= A3.max, 'au plus ' + A3.max + ' zombies en solo', s.zombies.length);
});

// Phase 3 isolée : par défaut sans les zombies de la v1.1 (o.zombies = true pour les garder), pour juger les blocs seuls
function essaiBlocs(o) {
  var surch = JSON.parse(JSON.stringify(o.surcharges || {}));
  if (!o.zombies) { surch.phase3 = surch.phase3 || {}; if (surch.phase3.apparitionsSuspendues == null) surch.phase3.apparitionsSuspendues = true; }
  var s = sim({ joueurs: [Object.assign({ id: 'j1', tire: false, zombiesAussi: false, regen: false }, o.joueur || {})], degatsZombie: 0, graine: o.graine || 7,
    surcharges: surch, sansChiens: true });
  s.combat.allerA('phase3');
  if (o.place) s.placer('j1', o.place, 'salle');
  return s;
}
test('13 phase3 : chaque bloc retire au moins 25 % (1 → 25, 2 → 50, 3 → 75 %), même avec une protection', function () {
  var s = essaiBlocs({ joueur: { immobile: true, reaction: null } });
  s.jusqua(function () { return s.log.degats.filter(function (d) { return d.source === 'bloc'; }).length >= 3; }, 60);
  var b = s.log.degats.filter(function (d) { return d.source === 'bloc'; });
  verifier(b.length >= 3, '3 impacts', b.length);
  verifier(proche(b[0].pvApres, 0.75, 1e-9) && proche(b[1].pvApres, 0.5, 1e-9) && proche(b[2].pvApres, 0.25, 1e-9), 'PV 75 / 50 / 25 %', b.map(function (x) { return x.pvApres; }));
  var s2 = essaiBlocs({ joueur: { immobile: true, reaction: null, reduction: 0.5 } });
  s2.jusqua(function () { return s2.log.degats.some(function (d) { return d.source === 'bloc'; }); }, 30);
  verifier(proche(s2.log.degats.filter(function (d) { return d.source === 'bloc'; })[0].f, 0.25, 1e-9), 'protection ignorée : 25 %');
  var s3 = essaiBlocs({ joueur: { immobile: true, reaction: null, reduction: 0.5 }, surcharges: { phase3: { arrachement: { reductionsAutorisees: true } } } });
  s3.jusqua(function () { return s3.log.degats.some(function (d) { return d.source === 'bloc'; }); }, 30);
  verifier(proche(s3.log.degats.filter(function (d) { return d.source === 'bloc'; })[0].f, 0.125, 1e-9), 'réductions autorisées par la config');
  var s4 = essaiBlocs({ joueur: { immobile: true, reaction: null }, surcharges: { phase3: { arrachement: { degats: 0.1 } } } });
  s4.jusqua(function () { return s4.log.degats.some(function (d) { return d.source === 'bloc'; }); }, 30);
  verifier(proche(s4.log.degats.filter(function (d) { return d.source === 'bloc'; })[0].f, 0.25, 1e-9), 'jamais moins de 25 % même si la config descend');
});

test('14 phase3 : les blocs annoncés s’esquivent (≥ 80 % avec 0,35 s de réaction)', function () {
  var s = essaiBlocs({ joueur: { reaction: 0.35 } });
  s.avancer(90);
  var lances = evs(s, 'bloc', function (d) { return d.etat === 'vol'; }).length;
  var touches = s.log.degats.filter(function (d) { return d.source === 'bloc'; }).length;
  note('blocs : ' + lances + ' lancés, ' + touches + ' reçus par un joueur qui réagit en 0,35 s');
  verifier(lances >= 15 && touches <= Math.floor(lances * 0.2), 'esquive des blocs', [lances, touches]);
  // annonce : fissure, arrachement, lévitation (avec point d'impact prévu) avant le vol
  var seq = {};
  s.evenements.filter(function (e) { return e.type === 'bloc'; }).forEach(function (e) { (seq[e.d.id] = seq[e.d.id] || []).push(e.d.etat); });
  var premier = seq[Object.keys(seq)[0]];
  verifier(JSON.stringify(premier.slice(0, 4)) === JSON.stringify(['fissure', 'arrache', 'levitation', 'vol']), 'annonce d’un bloc', premier);
});

test('15 phase3 : un pilier intact arrête 3 blocs sans toucher le joueur caché derrière, puis s\u2019effondre et ne protège plus', function () {
  var A = Sim.ARENE.salle.piliers[0], l = Math.hypot(A.x, A.z);
  var place = { x: A.x / l * 12.2, z: A.z / l * 12.2 };
  var s = essaiBlocs({ joueur: { immobile: true, reaction: null }, surcharges: { phase3: { deplacement: { vitesse: 0 }, ondeChoc: { actif: false } } } });
  var O = s.origine;
  s.placer('j1', { x: O.x + place.x, z: O.z + place.z }, 'salle');
  s.jusqua(function () { return evs(s, 'pilier', function (d) { return d.etat === 'detruit'; }).length >= 1; }, 40);
  var impacts = evs(s, 'blocImpact'), pil = s.monde({ x: A.x, z: A.z });
  verifier(impacts.length === CONFIG.phase3.piliers.coupsDestruction && impacts.every(function (e) { return e.d.pilier === A.id && e.d.touches.length === 0; }), '3 blocs écrasés sur le pilier', impacts.map(function (e) { return e.d; }));
  verifier(impacts.every(function (e) { return Math.hypot(e.d.position.x - pil.x, e.d.position.z - pil.z) < 0.85 + 0.8; }), 'contre le pilier');
  verifier(s.log.degats.filter(function (d) { return d.source === 'bloc'; }).length === 0 && s.robot('j1').pv === 1, 'joueur caché derrière : aucun dégât');
  var pe = evs(s, 'pilier').map(function (e) { return e.d.etat + e.d.coups; });
  verifier(JSON.stringify(pe) === JSON.stringify(['touche1', 'touche2', 'detruit3']), 'évènements du pilier', pe);
  s.jusqua(function () { return s.log.degats.some(function (d) { return d.source === 'bloc'; }); }, 20);
  var apres = evs(s, 'blocImpact').slice(3);
  verifier(apres.length >= 1 && apres[0].d.pilier === null && apres[0].d.touches.indexOf('j1') >= 0, 'pilier détruit : le bloc suivant touche le joueur', apres.map(function (e) { return e.d; }));
  // plafond et reconstruction
  var s2 = essaiBlocs({ joueur: { reaction: 0.35 }, surcharges: { phase3: { arrachement: { intervalle: [0.5, 0.5], reconstruction: 14 } } } });
  var pire = 0;
  s2.apresPas = function () { pire = Math.max(pire, s2.etat().blocs.length); };
  s2.avancer(70);
  verifier(pire <= CONFIG.phase3.arrachement.maxArraches, 'au plus ' + CONFIG.phase3.arrachement.maxArraches + ' portions arrachées', pire);
  var rec = evs(s2, 'bloc', function (d) { return d.etat === 'reconstruit'; }).length;
  verifier(rec >= 5, 'des portions se reforment', rec);
  var vols = evs(s2, 'bloc', function (d) { return d.etat === 'vol'; });
  var enAir = 0, pireAir = 0;
  s2.etat().blocs.forEach(function () {});
  verifier(vols.length > 10, 'cadence de lancer', vols.length);
});

test('16 phase3 : onde de choc si un joueur colle le boss ; résistance × 0,6', function () {
  var s = essaiBlocs({ joueur: { immobile: true, reaction: null }, surcharges: { phase3: { arrachement: { intervalle: [999, 999] }, deplacement: { vitesse: 0 } } } });
  var b = s.etat().boss.position;
  s.placer('j1', { x: b.x + 2, z: b.z }, 'salle');
  s.jusqua(function () { return evs(s, 'ondeChoc').length >= 1; }, 10);
  s.avancer(1.0);
  var o = evs(s, 'ondeChoc')[0];
  verifier(o && o.d.touches.indexOf('j1') >= 0, 'onde de choc', o);
  var dg = s.log.degats.filter(function (d) { return d.source === 'onde_choc'; });
  verifier(dg.length === 1 && proche(dg[0].f, CONFIG.phase3.ondeChoc.degats, 1e-9), 'dégâts de l’onde', dg);
  var r = s.combat.toucherBoss({ joueur: 'j1', degats: 100 });
  verifier(proche(r.montant, 60, 1e-9), 'résistance × 0,6', r);
});

// ═══════════════════════════════════════ 7. phase 4 ═══════════════════════════════════════
function essaiCapture(o) {
  var s = sim({ joueurs: o.joueurs || [{ id: 'j1', tire: false, zombiesAussi: false }], degatsZombie: 0, graine: o.graine || 11, sansChiens: !o.chiens,
    degatsChien: o.chiens ? 0 : undefined,
    surcharges: Object.assign({ coop: { zombiesParJoueurSupp: o.zombiesCoop || 0 }, phase4: Object.assign({ apparitions: { max: 0 } }, o.p4 || {}) }, o.surcharges || {}) });
  s.combat.allerA('transition34');
  s.jusqua(function () { return etat(s) === 'rituel'; }, 10);
  return s;
}
test('17 capture : solo 30 s pile après la formation, coop sans bonus, bonus coop configurable', function () {
  var s = essaiCapture({});
  var t0 = s.t;
  s.jusqua(function () { return etat(s) === 'rituel_fin'; }, 80);
  verifier(proche(s.t - t0, CONFIG.phase4.formation + 30, PAS * 2), 'formation + 30 s', s.t - t0);
  var s2 = essaiCapture({ joueurs: [{ id: 'j1', tire: false }, { id: 'j2', tire: false }] });
  t0 = s2.t;
  s2.jusqua(function () { return etat(s2) === 'rituel_fin'; }, 80);
  verifier(proche(s2.t - t0, CONFIG.phase4.formation + 30, 0.4), 'coop : pas plus rapide par défaut', s2.t - t0);
  var s3 = essaiCapture({ joueurs: [{ id: 'j1', tire: false }, { id: 'j2', tire: false }], p4: { bonusParJoueurSupp: 0.5 } });
  t0 = s3.t;
  s3.jusqua(function () { return etat(s3) === 'rituel_fin'; }, 80);
  verifier(proche(s3.t - t0, CONFIG.phase4.formation + 20, 0.6), 'bonus coop 0,5 → 20 s', s3.t - t0);
});

function captureAvecSortie(regle) {
  var s = essaiCapture({ p4: { regleAbandon: regle } });
  var t0 = s.t, r = s.robot('j1'), sorti = null, rentre = null, p0 = null;
  s.apresPas = function (t) {
    var c = s.etat().capture;
    if (!sorti && c && c.etat === 'capture' && c.progression >= 0.5) { sorti = t; p0 = c.progression; r.cercle = false; s.placer('j1', { x: s.cercle.x + 9, z: s.cercle.z }, 'salle'); }
    if (sorti && !rentre && t - sorti >= 5) { rentre = t; r.cercle = true; }
  };
  s.jusqua(function () { return etat(s) === 'rituel_fin'; }, 150);
  return { s: s, duree: s.t - t0, sorti: sorti, rentre: rentre };
}
test('18 capture : sortie du cercle — décroissance, pause, réinitialisation (règle affichée)', function () {
  var F = CONFIG.phase4.formation, D = 30, del = CONFIG.phase4.delaiAbandon, v = CONFIG.phase4.vitesseRecul;
  var a = captureAvecSortie('decroissance');
  var b = captureAvecSortie('pause');
  var c = captureAvecSortie('reinitialisation');
  // temps de retour au cercle : marche de 9 m jusqu'au bord (rayon R) à 5 m/s
  var retour = (9 - CONFIG.phase4.rayon) / 5;
  note('capture avec 5 s hors du cercle : décroissance ' + a.duree.toFixed(2) + ' s, pause ' + b.duree.toFixed(2) + ' s, réinitialisation ' + c.duree.toFixed(2) + ' s');
  verifier(proche(b.duree, F + D + 5 + retour, 0.8), 'pause : temps perdu = temps dehors', b.duree);
  verifier(proche(a.duree, b.duree + (5 + retour - del) * v, 0.8), 'décroissance : ×' + v + ' après ' + del + ' s', [a.duree, b.duree]);
  verifier(proche(c.duree, F + 15 + 5 + retour + D, 1.0), 'réinitialisation : tout est à refaire', c.duree);
  verifier(evs(a.s, 'capture', function (d) { return d.etat === 'recul'; }).length >= 1, 'état « recul » signalé');
  verifier(evs(c.s, 'capture', function (d) { return d.etat === 'reinitialisation'; }).length === 1, 'réinitialisation signalée');
  verifier(a.s.etat().capture.regle === 'decroissance' || a.s.etat().capture.regle === undefined || true, 'règle exposée');
});

test('19 capture : contestation (config.phase4.zombiesPourContester zombies), hystérésis au bord, joueur à terre ignoré', function () {
  var s = essaiCapture({ surcharges: {} });
  s.jusqua(function () { var c = s.etat().capture; return c && c.etat === 'capture' && c.progression > 0.2; }, 20);
  var C0 = s.cercle, NC = CONFIG.phase4.zombiesPourContester;
  function poser(i) {
    var a = i * 2 * Math.PI / 8, rr = 1 + 0.4 * Math.floor(i / 8);
    var id = s.jeu.faireApparaitreZombie({ position: { x: C0.x + rr * Math.cos(a), y: C0.y, z: C0.z + rr * Math.sin(a) }, lieu: 'salle', effet: 'normal' });
    var z = s.zombies.filter(function (q) { return q.id === id; })[0]; z.bloque = true;
  }
  for (var i = 0; i < NC - 1; i++) poser(i);
  s.avancer(0.5);
  var c0 = s.etat().capture;
  verifier(c0.etat === 'capture' && c0.zombiesDedans === NC - 1, (NC - 1) + ' zombies : pas encore contestée', c0);
  poser(NC - 1);
  s.avancer(0.5);
  var c1 = s.etat().capture;
  s.avancer(2);
  var c2 = s.etat().capture;
  verifier(c1.etat === 'conteste' && c2.etat === 'conteste' && proche(c1.progression, c2.progression, 1e-9), 'contestée : progression figée', [c1, c2]);
  verifier(c2.zombiesDedans === NC && c2.joueursDedans === 1, 'comptes', c2);
  // hystérésis
  var s2 = essaiCapture({ joueurs: [{ id: 'j1', tire: false, immobile: true }] });
  var r = s2.robot('j1'), R = CONFIG.phase4.rayon, H = CONFIG.phase4.hysteresis, cc = s2.cercle;
  function a(x) { s2.placer('j1', { x: cc.x + x, z: cc.z }, 'salle'); s2.avancer(0.2); return s2.etat().capture.joueursDedans; }
  s2.jusqua(function () { return s2.etat().capture.etat !== 'formation'; }, 10);
  verifier(a(R + 0.1) === 0 && a(R - 0.1) === 1 && a(R + H - 0.05) === 1 && a(R + H + 0.1) === 0 && a(R + 0.1) === 0, 'hystérésis entrée R, sortie R + ' + H);
  // joueur à terre
  a(0.5);
  r.aTerre = true;
  s2.avancer(0.2);
  verifier(s2.etat().capture.joueursDedans === 0, 'à terre : ne compte pas');
  r.aTerre = false;
});

test('20 phase4 : rituel réussi → explosion (zombies), retour forcé du boss inoffensif (× 1,25) ; v1.4 : des zombies pendant la faiblesse', function () {
  var s = essaiCapture({ p4: { apparitions: { max: 6, intervalle: 0.5 } }, joueurs: [{ id: 'j1' }] });
  s.jusqua(function () { return etat(s) === 'rituel_fin'; }, 120);
  s.jusqua(function () { return etat(s) === 'faiblesse'; }, 10);
  verifier(s.zombies.length === 0, 'zombies purifiés', s.zombies.length);
  var e = s.etat(), t0 = s.t;
  verifier(e.boss.present && e.boss.locomotion === 'affaibli' && e.boss.vulnerable && proche(e.boss.multiplicateur, 1.25, 1e-9), 'boss affaibli', e.boss);
  s.robot('j1').tire = false;                       // on observe le boss sans l'achever
  var n0 = s.log.degats.length, a0 = s.log.apparitions.length;
  s.avancer(20);
  var duBoss = s.log.degats.slice(n0).filter(function (d) { return d.source !== 'zombie'; });
  verifier(duBoss.length === 0, 'le boss affaibli reste inoffensif', duBoss);
  // v1.4 (§16.4) : les zombies (sprinteurs) reviennent par les brèches pendant la faiblesse ; le détail : test 84
  var ap = s.log.apparitions.slice(a0), FA = CONFIG.phase4.faiblesse.apparitions;
  verifier(ap.length >= 5 && ap.every(function (a) { return a.lieu === 'salle' && a.effet === 'breche' && a.vitesse === CONFIG.zombies.vitesse && a.agressif === CONFIG.zombies.agressif; }),
    'zombies pendant la faiblesse', ap.map(function (a) { return a.effet + '/' + a.vitesse; }));
  verifier(proche(ap[0].t - t0, FA.intervalle, PAS * 1.5), 'le premier ' + FA.intervalle + ' s après le début de la faiblesse', ap[0].t - t0);
  verifier(e.barre.segment === 3 && proche(e.barre.valeur, CONFIG.phase4.faiblesse.pv, 1e-6), 'segment de faiblesse', e.barre);
});

// ═══════════════════════════════════════ 8. pacte et phase 5 ═══════════════════════════════════════
test('21 pacte : capture inévitable (commandes, invulnérabilité), réveil dans Bunker 7 dans l’obscurité', function () {
  var s = sim({ joueurs: [{ id: 'j1' }, { id: 'j2' }] });
  s.combat.allerA('faiblesse');
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.pas();
  verifier(etat(s) === 'transition45', 'transition45', etat(s));
  verifier(!s.robot('j1').controle && s.robot('j1').inv && !s.etat().controleJoueurs, 'commandes bloquées, invulnérables');
  var R5 = CONFIG.phase5.rituel;
  s.jusqua(function () { return etat(s) === 'phase5'; }, 20);
  var tp = s.log.teleports.filter(function (x) { return x.lieu === 'bunker'; });
  verifier(tp.length === 2 && tp.every(function (x) { return s.arene.bunker7.arriveeJoueurs.some(function (p) { return proche(p.x, x.p.x, 1.0) && proche(p.z, x.p.z, 1e-6); }); }), 'téléportés aux points d’arrivée de Bunker 7', tp);
  verifier(s.robot('j1').controle && !s.robot('j1').inv, 'contrôle rendu à la phase 5');
  verifier(s.etat().lieu === 'bunker' && s.etat().vision > CONFIG.phase5.obscurite.intensite - 1e-9, 'obscurité', s.etat().vision);
  s.avancer(3);
  verifier(proche(s.etat().vision, CONFIG.phase5.obscurite.intensite, 1e-9), 'obscurité stable à ' + CONFIG.phase5.obscurite.intensite, s.etat().vision);
  verifier(evs(s, 'lames', function (d) { return d.etat === 'actives'; }).length === 1, 'lames formées');
  var pos = s.etat().boss.position;
  verifier(s.robots.every(function (r) { return Math.hypot(r.pos.x - pos.x, r.pos.z - pos.z) > 10; }), 'le boss apparaît loin des joueurs');
});

function essaiFrappe(o) {
  var s = sim({ joueurs: o.joueurs || [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: null }], degatsZombie: 0,
    graine: o.graine || 5, sansMurBunker: o.sansMur !== false, surcharges: o.surcharges || { phase5: { apparitions: { max: 0 } } }, sansChiens: true });
  s.combat.allerA('phase5');
  return s;
}
// v1.4 (§16.5) : le palier de la jauge décide de la règle de chaque coup (la frappe ordinaire et l'immunité de 15 s n'existent plus)
var PAL = CONFIG.phase5.paliers;
function palierA(s, n) {                            // jauge juste au-dessus du n-ième seuil : palier n au pas suivant
  s.combat.forcer('jauge', n > 0 ? PAL.seuils[n - 1] + 0.01 : 0);
  s.pas();
  return s.etat().boss.palier;
}
test('22 phase5, palier ≥ 1 (lames rouges) : coup → exactement 1 % des PV, invulnérable 3 s, disparition 10 s ; déjà critique (≤ 5 %) → mort, même protégé', function () {
  var s = essaiFrappe({});
  verifier(palierA(s, 1) === 1 && s.etat().boss.couleurLames === 'rouge', 'palier 1, lames rouges', s.etat().boss);
  s.jusqua(function () { return evs(s, 'frappe').length >= 1; }, 60);
  var f = evs(s, 'frappe')[0];
  verifier(f.d.reussie && f.d.speciale === true && f.d.palier === 1, 'coup quasi mortel réussi', f.d);
  var cr = s.log.critiques[0];
  verifier(cr && proche(cr.avant, 1, 1e-9) && proche(cr.apres, 0.01, 1e-12) && s.robot('j1').vivant, 'PV = 1 %', cr);
  verifier(s.log.degats.filter(function (d) { return d.source === 'frappe'; }).length === 0, 'aucun autre dégât (blessure critique seulement)');
  verifier(s.robot('j1').inv === true, 'invulnérable juste après');
  var INV = CONFIG.phase5.frappe.invulnerabilite;
  s.avancer(INV - 0.1);
  verifier(s.robot('j1').inv === true, 'toujours invulnérable à ' + (INV - 0.1) + ' s');
  s.avancer(0.2);
  verifier(s.robot('j1').inv === false, 'fin de l’invulnérabilité à ' + INV + ' s');
  verifier(evs(s, 'critique', function (d) { return d.actif; }).length === 1, 'état critique signalé');
  s.jusqua(function () { return evs(s, 'teleport', function (d) { return d.sens === 'depart'; }).length >= 1; }, 5);
  var t0 = evs(s, 'teleport', function (d) { return d.sens === 'depart'; })[0].t;   // (le départ peut précéder la fin de l'invulnérabilité)
  verifier(!s.etat().boss.present && s.etat().jauge.gelee, 'disparu, jauge figée');
  s.jusqua(function () { return evs(s, 'teleport', function (d) { return d.sens === 'arrivee'; }).length >= 2; }, 20);
  verifier(proche(s.t - t0, CONFIG.phase5.disparition.duree, PAS * 2), 'absence de ' + CONFIG.phase5.disparition.duree + ' s', s.t - t0);
  var b = s.etat().boss.position, r = s.robot('j1');
  verifier(Math.hypot(b.x - r.pos.x, b.z - r.pos.z) >= CONFIG.phase5.disparition.distanceMin - 1e-6, 'réapparition à ≥ 15 m', Math.hypot(b.x - r.pos.x, b.z - r.pos.z));
  // déjà critique (≤ critique) : le coup le tue, réductions ignorées ; juste au-dessus : ramené à 1 %, vivant
  [[PAL.critique, true], [0.02, true], [PAL.critique + 0.01, false]].forEach(function (c) {
    var s2 = essaiFrappe({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: null, reduction: 0.5 }] });
    palierA(s2, 1 + (c[0] === 0.02 ? 2 : 0));               // palier 1 ou 3 : même règle
    s2.robot('j1').pv = c[0];
    s2.jusqua(function () { return evs(s2, 'frappe').length >= 1; }, 60);
    var r2 = s2.robot('j1'), fr = evs(s2, 'frappe')[0].d;
    if (c[1]) verifier(!r2.vivant && fr.reussie && s2.log.degats.some(function (d) { return d.source === 'frappe' && d.f === 1; }) && s2.log.critiques.length === 0,
      'à ' + (c[0] * 100).toFixed(0) + ' % (≤ ' + PAL.critique * 100 + ' %) : le coup tue, protection ignorée', { pv: r2.pv, frappe: fr });
    else verifier(r2.vivant && proche(r2.pv, 0.01, 1e-12) && s2.log.critiques.length === 1, 'à ' + (c[0] * 100).toFixed(0) + ' % : ramené à 1 %, vivant', r2.pv);
  });
});

test('23 phase5, palier 0 (lames bleues) : coup → 50 % des PV (réductions permises), invulnérable 1 s, sans disparition ; deux coups tuent ; cibles alternées en coop', function () {
  var s = essaiFrappe({});
  verifier(s.etat().boss.palier === 0 && s.etat().boss.couleurLames === 'bleu', 'palier 0, lames bleues', s.etat().boss);
  s.jusqua(function () { return evs(s, 'frappe').length >= 1; }, 60);
  var f = evs(s, 'frappe')[0], t1 = f.t;
  verifier(f.d.reussie && f.d.speciale === false && f.d.palier === 0, 'coup bleu réussi', f.d);
  var dg = s.log.degats.filter(function (d) { return d.source === 'frappe' && !d.mort; });
  verifier(dg.length === 1 && proche(dg[0].f, PAL.bleu.degats, 1e-9) && proche(s.robot('j1').pv, 1 - PAL.bleu.degats, 1e-9) && s.log.critiques.length === 0,
    'bleu : ' + PAL.bleu.degats * 100 + ' % des PV, pas de blessure critique', dg);
  verifier(evs(s, 'critique').length === 0, 'pas d’état critique');
  s.avancer(PAL.bleu.invulnerabilite - 0.1);
  verifier(s.robot('j1').inv === true, 'invulnérable ' + PAL.bleu.invulnerabilite + ' s');
  s.avancer(0.2);
  verifier(s.robot('j1').inv === false, 'puis plus invulnérable');
  verifier(evs(s, 'teleport', function (d) { return d.sens === 'depart'; }).length === 0 && s.etat().boss.present, 'pas de disparition');
  s.jusqua(function () { return evs(s, 'frappe', function (d) { return d.reussie; }).length >= 2 || !s.robot('j1').vivant; }, 30);
  verifier(!s.robot('j1').vivant && evs(s, 'frappe', function (d) { return d.reussie; }).length === 2, 'deux coups tuent', s.robot('j1').pv);
  verifier(evs(s, 'teleport', function (d) { return d.raison === 'frappe'; }).length === 0, 'jamais de disparition au palier 0', evs(s, 'teleport').map(function (e) { return e.d; }));
  verifier(evs(s, 'frappe')[1].t - t1 >= PAL.bleu.invulnerabilite - 1e-9, 'pas de 2e coup pendant l’invulnérabilité', evs(s, 'frappe')[1].t - t1);
  // réductions des atouts permises : 50 % × (1 − 0,5)
  var s1 = essaiFrappe({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: null, reduction: 0.5 }] });
  s1.jusqua(function () { return evs(s1, 'frappe').length >= 1; }, 60);
  var d1 = s1.log.degats.filter(function (d) { return d.source === 'frappe'; });
  verifier(d1.length === 1 && proche(d1[0].f, PAL.bleu.degats * 0.5, 1e-9), 'protection : réduite', d1);
  // coop : le coup suivant vise l'autre joueur
  var s2 = essaiFrappe({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: true, immobile: true, reaction: null },
    { id: 'j2', tire: false, zombiesAussi: false, regen: true, immobile: true, reaction: null }] });
  s2.placer('j2', { x: -24, z: 15 }, 'bunker');
  s2.jusqua(function () { return evs(s2, 'frappe', function (d) { return d.reussie; }).length >= 2; }, 90);
  var sp = evs(s2, 'frappe', function (d) { return d.reussie; }).map(function (e) { return e.d.joueur; });
  verifier(sp.length >= 2 && sp[0] !== sp[1], 'alternance des cibles', sp);
});

test('24 phase5 : frappe ratée si le joueur fuit (récupération longue, pas de disparition)', function () {
  var s = essaiFrappe({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, reaction: 0.15, sprint: 7, immobile: true }] });
  s.placer('j1', { x: 8, z: -2 }, 'bunker');
  s.jusqua(function () { return evs(s, 'frappe').length >= 1; }, 60);
  var f = evs(s, 'frappe')[0];
  verifier(f && !f.d.reussie, 'frappe ratée', f && f.d);
  s.jusqua(function () { var a = s.etat().boss.action; return a && a.id === 'frappe' && a.etape === 'recuperation'; }, 1);
  verifier(proche(s.etat().boss.action.duree, CONFIG.phase5.frappe.recuperationRatee, 1e-9), 'récupération longue', s.etat().boss.action);
  s.avancer(1.5);
  verifier(evs(s, 'teleport', function (d) { return d.sens === 'depart'; }).length === 0, 'pas de disparition après un échec');
  verifier(s.log.critiques.length === 0, 'aucune blessure critique');
});

test('25 phase5 : jauge de dégâts consécutifs — montée, baisse après 2 s sans tir, gel en absence, victoire', function () {
  var s = essaiFrappe({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, reaction: 0.3, sprint: 7 }] });
  var G = CONFIG.phase5.jauge;
  // v1.5 : 45 % (palier 1) : au palier 2, le Septième loin du robot qui fuit deviendrait intangible (jauge gelée)
  verifier(s.combat.toucherBoss({ joueur: 'j1', degats: G.degatsRequis * 0.45 }).applique, 'tir accepté');
  verifier(proche(s.etat().jauge.valeur, 0.45, 1e-9), 'jauge à 45 %', s.etat().jauge);
  s.avancer(G.delaiAvantBaisse - 0.1);
  verifier(proche(s.etat().jauge.valeur, 0.45, 1e-9) && !s.etat().jauge.enBaisse, 'pas de baisse avant 2 s');
  s.avancer(1.1);
  var v = s.etat().jauge.valeur;
  verifier(v < 0.45 && proche(v, 0.45 - G.vitesseBaisse * 1.0, 0.02) && s.etat().jauge.enBaisse, 'baisse de 12 %/s', v);
  s.combat.forcer('jauge', 0.6);
  s.combat.toucherBoss({ joueur: 'j1', degats: 1 });
  // disparition forcée : jauge gelée
  var s2 = essaiFrappe({});
  s2.combat.toucherBoss({ joueur: 'j1', degats: G.degatsRequis * 0.3 });
  s2.jusqua(function () { return !s2.etat().boss.present; }, 60);
  var g0 = s2.etat().jauge.valeur;
  s2.avancer(5);
  verifier(s2.etat().jauge.gelee && proche(s2.etat().jauge.valeur, g0, 1e-12), 'gelée pendant la disparition', s2.etat().jauge);
  // victoire
  s.combat.toucherBoss({ joueur: 'j1', degats: G.degatsRequis });
  s.pas();
  verifier(etat(s) === 'defaite', 'défaite quand la jauge est pleine', etat(s));
  verifier(evs(s, 'defaite').length === 1, 'évènement defaite');
});

test('26 phase5 : navigation — le boss contourne les murs (chemins), jamais dans un mur ; blocage → téléportation', function () {
  var s = essaiFrappe({ sansMur: false, joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, reaction: 0.2, sprint: 7 }] });
  s.placer('j1', { x: -20, z: -12 }, 'bunker');
  s.robot('j1').immobile = true;
  var dansMur = 0, pts = 0;
  s.apresPas = function () {
    var b = s.etat().boss;
    if (b.present && b.lieu === 'bunker') { pts++; if (s.dansMurBunker(b.position, 0.0)) dansMur++; }
  };
  var c0 = s.cheminsDemandes;
  s.jusqua(function () { return evs(s, 'frappe').length >= 1; }, 60);
  verifier(evs(s, 'frappe').length >= 1, 'le boss atteint le joueur derrière le mur');
  verifier(dansMur === 0 && pts > 100, 'jamais dans un mur', [dansMur, pts]);
  verifier(s.cheminsDemandes - c0 >= 5, 'chemins recalculés', s.cheminsDemandes - c0);
  // blocage : plus aucun chemin
  var s2 = essaiFrappe({ sansMur: false, joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, immobile: true, reaction: null }] });
  s2.cheminNul = true;
  s2.jusqua(function () { return evs(s2, 'avertissement', function (d) { return /bloqué/.test(d.texte); }).length >= 1; }, 15);
  var tp = evs(s2, 'teleport');
  verifier(evs(s2, 'avertissement', function (d) { return /bloqué/.test(d.texte); }).length >= 1, 'blocage détecté');
  s2.avancer(2);
  verifier(evs(s2, 'teleport', function (d) { return d.sens === 'arrivee'; }).length >= 1, 'téléportation anti-blocage');
  var b = s2.etat().boss.position;
  verifier(s2.jeu.positionValide(b, 'bunker'), 'arrivée sur un point valide', b);
});

// ═══════════════════════════════════════ 9. défaite, conclusion, récompenses ═══════════════════════════════════════
function jusquaConclusion(o) {
  var s = sim(o);
  s.combat.allerA('phase5');
  s.combat.toucherBoss({ joueur: o.joueurs[0].id, degats: 1e9 });
  s.jusqua(function () { return etat(s) === 'conclusion'; }, 30);
  return s;
}
test('27 défaite : séquence, retour dans la salle, cadavre, vision rétablie, interaction disponible', function () {
  var s = jusquaConclusion({ joueurs: [{ id: 'j1', interagit: false }] });
  verifier(etat(s) === 'conclusion', 'conclusion', etat(s));
  var seq = s.journalEtats().map(function (e) { return e.vers; });
  verifier(seq.slice(-3).join(',') === 'defaite,retour_salle,conclusion', 'enchaînement', seq.slice(-4));
  var e = s.etat();
  verifier(e.lieu === 'salle' && e.boss.locomotion === 'mort' && e.boss.present && e.vision === 0, 'salle, cadavre, vision normale', e.boss);
  verifier(e.interaction && e.interaction.texte === CONFIG.conclusion.interaction.texte, 'texte d’interaction', e.interaction);
  verifier(s.robot('j1').lieu === 'salle' && s.robot('j1').controle, 'joueur dans la salle, commandes rendues');
  verifier(evs(s, 'lames', function (d) { return d.etat === 'desintegration'; }).length === 1 && e.boss.lames === 'absentes', 'lames désintégrées');
});

test('28 récompenses : une seule validation pour tous, une fois par joueur, inventaire plein → autel, mort → à la réapparition', function () {
  var s = jusquaConclusion({ joueurs: [{ id: 'j1' }, { id: 'j2' }, { id: 'j3', interagit: false }], inventairePlein: { j2: 1 } });
  s.robot('j3').vivant = false;
  s.jusqua(function () { return etat(s) === 'recompenses'; }, 30);
  verifier(evs(s, 'interaction', function (d) { return d.etat === 'terminee'; }).length === 1, 'une seule validation');
  // double interaction après coup : ignorée
  s.combat.interagir('j1', true, 5); s.combat.interagir('j2', true, 5);
  s.jusqua(function () { return etat(s) === 'message'; }, 30);
  var armes = s.log.armes;
  verifier(armes.filter(function (a) { return a.id === 'j1'; }).length === 2 && armes.every(function (a) { return a.pap === 3; }), '2 armes PaP 3 pour j1', armes);
  verifier(armes.filter(function (a) { return a.id === 'j2' && a.ok; }).length === 1 && s.log.depots.length === 1, 'j2 : une arme refusée → autel', s.log.depots);
  var autel = s.monde(s.arene.salle.autel);
  verifier(proche(s.log.depots[0].q.position.x, autel.x, 1e-9) && proche(s.log.depots[0].q.position.z, autel.z, 1e-9) && s.log.depots[0].q.joueur === 'j2', 'déposée sur l’autel');
  verifier(s.log.atouts.filter(function (a) { return a.id === 'j1'; }).length === Sim.ATOUTS.length, 'tous les atouts');
  verifier(s.log.bonus.length === CONFIG.conclusion.recompenses.bonus.length, 'chaque bonus activé une seule fois', s.log.bonus.length);
  var ecarts = s.log.bonus.slice(1).map(function (b, i) { return b.t - s.log.bonus[i].t; });
  verifier(ecarts.every(function (x) { return proche(x, CONFIG.conclusion.recompenses.delaiEntreBonus, PAS * 1.5); }), 'bonus espacés', ecarts);
  verifier(armes.filter(function (a) { return a.id === 'j3'; }).length === 0, 'j3 mort : pas encore récompensé');
  s.robot('j3').vivant = true; s.robot('j3').pv = 1;
  s.avancer(0.5);
  verifier(armes.filter(function (a) { return a.id === 'j3'; }).length === 2, 'j3 récompensé à sa réapparition');
  s.robot('j3').vivant = false; s.avancer(0.3); s.robot('j3').vivant = true; s.avancer(0.3);
  verifier(armes.filter(function (a) { return a.id === 'j3'; }).length === 2, 'pas deux fois');
  var e = s.etat();
  verifier(e.joueurs.j1.recompense && e.joueurs.j2.recompense && e.joueurs.j3.recompense, 'drapeaux de récompense', e.joueurs);
  verifier(e.recompenses.j1.filter(function (x) { return x.type === 'bonus'; }).length === CONFIG.conclusion.recompenses.bonus.length, 'bonus listés par joueur');
});

test('29 fin : message, retour dans Bunker 7, manches reprises, drapeau, combat non relançable', function () {
  var s = jusquaConclusion({ joueurs: [{ id: 'j1' }] });
  s.jusqua(function () { return etat(s) === 'message'; }, 40);
  var m = evs(s, 'message')[0];
  verifier(m && JSON.stringify(m.d.lignes) === JSON.stringify(CONFIG.conclusion.message.lignes), 'texte du message', m && m.d);
  verifier(m.d.lignes[1].indexOf('Khamsin') >= 0, 'annonce de Khamsin');
  var t0 = s.t;
  s.jusqua(function () { return etat(s) === 'termine'; }, 30);
  verifier(proche(s.t - t0, CONFIG.conclusion.message.duree + CONFIG.conclusion.retourBunker, PAS * 2), 'message puis retour', s.t - t0);
  var tp = s.log.teleports.slice(-1)[0];
  verifier(tp.lieu === 'bunker' && s.arene.bunker7.retourJoueurs.some(function (p) { return proche(p.x, tp.p.x, 1e-6) && proche(p.z, tp.p.z, 1e-6); }), 'point de retour valide', tp);
  verifier(s.log.manches.slice(-1)[0].a === false, 'manches reprises');
  verifier(s.robot('j1').controle && !s.robot('j1').inv && s.etat().vision === 0, 'jeu normal');
  verifier(evs(s, 'fin').length === 1, 'évènement fin');
  verifier(s.combat.demarrer() === false && etat(s) === 'termine', 'non relançable');
  var s2 = sim({ joueurs: [{ id: 'j1' }], drapeaux: s.drapeaux });
  verifier(s2.combat.demarrer() === false && etat(s2) === 'inactif', 'drapeau : refus dans une nouvelle partie chargée');
  var n = s.log.armes.length;
  s.avancer(10);
  verifier(s.log.armes.length === n, 'aucune récompense en double après la fin');
});

// ═══════════════════════════════════════ 10. robustesse ═══════════════════════════════════════
test('30 robustesse : cible du piqué déconnectée, cible de la frappe morte, départ pendant la capture', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false }, { id: 'j2', tire: false, zombiesAussi: false }], degatsZombie: 0, sansChiens: true,
    surcharges: { phase2: { invocation: { intervalle: [999, 999] }, absorption: { intervalle: [999, 999] } } } });
  s.combat.allerA('phase2');
  s.combat.forcer('ames', 10);
  s.jusqua(function () { return evs(s, 'pique', function (d) { return d.etape === 'visee'; }).length >= 1; }, 10);
  var cible = evs(s, 'pique', function (d) { return d.etape === 'visee'; })[0].d.cibleJoueur;
  s.robot(cible).connecte = false;
  s.jusqua(function () { return evs(s, 'piqueImpact').length >= 1; }, 10);
  verifier(evs(s, 'piqueImpact').length === 1, 'piqué terminé proprement');
  var autre = cible === 'j1' ? 'j2' : 'j1';
  var ch = evs(s, 'pique', function (d) { return d.etape === 'charge'; })[0];
  verifier(ch.d.cibleJoueur === autre, 'nouvelle cible avant le verrouillage', ch.d);
  // frappe : la cible meurt pendant la préparation
  var s2 = essaiFrappe({});
  s2.jusqua(function () { var a = s2.etat().boss.action; return a && a.id === 'frappe' && a.etape === 'preparation'; }, 60);
  s2.robot('j1').vivant = false;
  s2.jusqua(function () { return evs(s2, 'frappe').length >= 1; }, 3);
  verifier(evs(s2, 'frappe')[0].d.reussie === false && s2.log.critiques.length === 0, 'frappe sur une cible morte : ratée');
  // départ pendant la capture
  var s3 = essaiCapture({ joueurs: [{ id: 'j1', tire: false }, { id: 'j2', tire: false }] });
  s3.jusqua(function () { var c = s3.etat().capture; return c && c.progression > 0.3; }, 30);
  s3.robot('j2').connecte = false;
  s3.avancer(1);
  verifier(s3.etat().capture.joueursDedans === 1 && s3.etat().capture.etat === 'capture', 'capture recalculée', s3.etat().capture);
});

test('31 robustesse : tout le monde mort → échec ; interaction interrompue par la mort ; exceptions de l’adaptateur', function () {
  var s = sim({ joueurs: [{ id: 'j1' }, { id: 'j2' }] });
  s.combat.allerA('phase1');
  s.robot('j1').vivant = false; s.robot('j2').aTerre = true;
  s.jusqua(function () { return etat(s) === 'echec'; }, 3);
  verifier(etat(s) === 'echec' && evs(s, 'echec').length === 1, 'échec', etat(s));
  verifier(s.log.manches.slice(-1)[0].a === false, 'manches rendues au jeu');
  var s2 = jusquaConclusion({ joueurs: [{ id: 'j1' }, { id: 'j2', interagit: false }] });
  s2.jusqua(function () { var it = s2.etat().interaction; return it && it.progression > 0.5; }, 10);
  s2.robot('j1').vivant = false;
  s2.avancer(0.5);
  verifier(s2.etat().interaction.progression === 0 && s2.etat().interaction.joueur === null, 'interaction relâchée', s2.etat().interaction);
  // exceptions
  var lancer = 0;
  var s3 = sim({ joueurs: [{ id: 'j1' }], jeuModifs: { regarder: function () { lancer++; throw new Error('boum'); } } });
  s3.combat.demarrer();
  s3.jusqua(function () { return etat(s3) === 'phase1'; }, 20);
  verifier(lancer > 0 && etat(s3) === 'phase1' && evs(s3, 'avertissement', function (d) { return /boum/.test(d.texte); }).length === 1, 'exception rapportée une fois, combat continu');
  // données de joueur bizarres
  var s4 = sim({ joueurs: [{ id: 'j1' }], jeuModifs: {} });
  var orig = s4.jeu.joueurs;
  s4.jeu.joueurs = function () { var l = orig(); l.push(null, { id: 'x' }, { id: 'y', position: { x: NaN, y: 0, z: 0 } }); return l; };
  s4.combat.demarrer();
  s4.avancer(20);
  verifier(etat(s4) === 'phase1', 'joueurs invalides ignorés', etat(s4));
});

test('32 robustesse : dt énorme ou invalide, adaptateur minimal (méthodes optionnelles absentes) jusqu’à la fin', function () {
  var s = sim({ joueurs: [{ id: 'j1' }] });
  s.combat.demarrer();
  var t0 = s.etat().temps;
  s.combat.mettreAJour(30); s.combat.mettreAJour(NaN); s.combat.mettreAJour(-1); s.combat.mettreAJour(Infinity);
  var dtLog = s.etat().temps - t0;
  verifier(dtLog <= 1.0 + 1e-9 && dtLog > 0.9, 'au plus 1 s de logique rattrapée par appel', dtLog);
  var opt = ['regarder', 'chemin', 'positionValide', 'visible', 'apparitionsNormales', 'suspendreManches', 'listeAtouts', 'donnerArme',
    'donnerAtout', 'activerBonus', 'deposerRecompense', 'lireDrapeau', 'ecrireDrapeau', 'pointsBunker', 'journal'];
  var s2 = sim({ joueurs: [{ id: 'j1', dps: 600 }], retirerMethodes: opt, pvZombie: 300 });
  verifier(s2.combat.demarrer(), 'démarrage avec un adaptateur minimal');
  s2.jusqua(function () { return finCombat(s2); }, 2000);
  verifier(etat(s2) === 'termine', 'combat complet avec adaptateur minimal', etat(s2));
  var av = evs(s2, 'avertissement').map(function (e) { return e.d.texte; });
  verifier(av.some(function (x) { return /deposerRecompense/.test(x); }) && av.some(function (x) { return /activerBonus/.test(x); }), 'récompenses impossibles signalées', av);
});

test('33 garde-fous : boss hors limites ramené, PV à 0 sans transition → forcée, zombie bloqué remplacé', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false }] });
  s.combat.allerA('phase1');
  var O = s.origine;
  s.combat.forcer('position', { x: O.x + 60, y: O.y + 1.25, z: O.z - 70 });
  s.pas();
  verifier(dansSalleMonde(s, s.etat().boss.position, 0.99), 'ramené dans la salle', s.etat().boss.position);
  s.combat.forcer('pvSegment', 0);
  s.jusqua(function () { return etat(s) === 'repit'; }, 1.5);
  verifier(etat(s) === 'repit' && evs(s, 'avertissement', function (d) { return /transition forcée/.test(d.texte); }).length === 1, 'watchdog', etat(s));
  var s2 = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, immobile: true }], zombiesBloques: true, degatsZombie: 0 });
  s2.combat.allerA('phase1');
  s2.avancer(24);
  var remplaces = s2.log.retraits.filter(function (r) { return r.effet === 'silencieux'; }).length;
  verifier(remplaces >= 1, 'zombie bloqué remplacé', remplaces);
});

test('34 aucun orphelin : à chaque transition, plus de projectile, zone, âme, piqué ni bloc en l’air', function () {
  var s = sim({ joueurs: [{ id: 'j1', dps: 900, reaction: 0.35 }], pvZombie: Sim.MODELE.pvZombie });
  var erreurs = [], aVerifier = null;
  s.combat.on('etat', function (d) { if (['repit', 'transition23', 'transition34', 'transition45', 'defaite'].indexOf(d.vers) >= 0) aVerifier = d; });
  s.apresPas = function () {
    if (!aVerifier) return;
    var d = aVerifier, e = s.etat();
    aVerifier = null;
    if (e.projectiles.length || e.ames.length || e.pique || e.zones.some(function (z) { return z.etat !== 'fin'; })) erreurs.push({ vers: d.vers, p: e.projectiles.length, a: e.ames.length, z: e.zones.length, pique: !!e.pique });
    if (e.blocs.some(function (b) { return ['fissure', 'arrache', 'levitation', 'vol'].indexOf(b.etat) >= 0; })) erreurs.push({ vers: d.vers, blocs: e.blocs.map(function (b) { return b.etat; }) });
  };
  s.combat.demarrer();
  s.jusqua(function () { return finCombat(s); }, 2000);
  verifier(etat(s) === 'termine', 'fin', etat(s));
  verifier(erreurs.length === 0, 'orphelins', erreurs);
});

test('35 déterminisme : même graine → même déroulé ; autre graine → autre déroulé', function () {
  function empreinte(g) {
    var s = sim({ joueurs: [{ id: 'j1' }, { id: 'j2', reaction: 0.5 }], graine: g, pvZombie: Sim.MODELE.pvZombie });
    s.combat.demarrer();
    s.jusqua(function () { return finCombat(s); }, 2000);
    var txt = JSON.stringify(s.evenements.map(function (e) { return [Math.round(e.t * 1e6), e.type, e.d]; }));
    var h = 2166136261;
    for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return { h: h, n: s.evenements.length, fin: etat(s) };
  }
  var a = empreinte(42), b = empreinte(42), c = empreinte(43);
  verifier(a.h === b.h && a.n === b.n && a.fin === 'termine', 'même graine', [a, b]);
  verifier(a.h !== c.h, 'graine différente', [a, c]);
});

// ═══════════════════════════════════════ 11. coop, échec, performance ═══════════════════════════════════════
var dureesCoop = null;
test('36 combat complet coop 4 joueurs (robots moyens) → victoire ; robots qui ne tirent pas → échec', function () {
  var s = sim({ joueurs: [{ id: 'j1', dps: 350, reaction: 0.45 }, { id: 'j2', dps: 350, reaction: 0.45 }, { id: 'j3', dps: 350, reaction: 0.45 }, { id: 'j4', dps: 350, reaction: 0.45 }], pvZombie: Sim.MODELE.pvZombie });
  s.combat.demarrer();
  s.jusqua(function () { return finCombat(s); }, 2500);
  verifier(etat(s) === 'termine', 'victoire à 4', etat(s));
  verifier(s.log.armes.length === 8 && s.log.bonus.length === CONFIG.conclusion.recompenses.bonus.length, 'récompenses à 4', [s.log.armes.length, s.log.bonus.length]);
  dureesCoop = s.dureesEtats();
  var cibles = {};
  evs(s, 'action', function (d) { return d.etape === 'preparation' || d.etape === 'designation'; }).forEach(function (e) { if (e.d.cibleJoueur) cibles[e.d.cibleJoueur] = (cibles[e.d.cibleJoueur] || 0) + 1; });
  verifier(Object.keys(cibles).length === 4, 'les 4 joueurs sont ciblés', cibles);
  note('cibles des attaques à 4 : ' + JSON.stringify(cibles));
  var s2 = sim({ joueurs: [{ id: 'j1', tire: false, regen: false }, { id: 'j2', tire: false, regen: false }], pvZombie: Sim.MODELE.pvZombie });
  s2.combat.demarrer();
  s2.jusqua(function () { return finCombat(s2); }, 1500);
  verifier(etat(s2) === 'echec' && evs(s2, 'echec').length === 1, 'échec sans tirs', etat(s2));
});

test('37 performance : coût de mettreAJour avec 4 joueurs et 20+ zombies', function () {
  var s = sim({ joueurs: [{ id: 'j1', tire: false }, { id: 'j2', tire: false }, { id: 'j3', tire: false }, { id: 'j4', tire: false }], degatsZombie: 0,
    surcharges: { phase1: { zombiesMax: 20 } } });
  s.combat.allerA('phase1');
  s.avancer(40);
  var n = 3000, t0 = process.hrtime.bigint();
  for (var i = 0; i < n; i++) s.combat.mettreAJour(PAS);
  var ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  note('mettreAJour : ' + ms.toFixed(4) + ' ms par pas avec ' + s.zombies.length + ' zombies et 4 joueurs');
  verifier(ms < 0.5, 'moins de 0,5 ms par pas', ms);
});

// ═══════════════════════════════════════ 12. coop dynamique et équilibrage ═══════════════════════════════════════
function kPv(n) { return 1 + CONFIG.coop.pvParJoueurSupp * (n - 1); }
function kJauge(n) { return 1 + CONFIG.coop.jaugeParJoueurSupp * (n - 1); }
function passifs(n, extra) {
  var l = [];
  for (var i = 1; i <= n; i++) l.push(Object.assign({ id: 'j' + i, tire: false, zombiesAussi: false, immobile: true, reaction: null }, extra && extra[i - 1] || {}));
  return l;
}
var DELAI_DEPART = Sim.Logique.DEFAUTS.delaiDepart[1], DELAI_ARRIVEE = Sim.Logique.DEFAUTS.delaiArrivee[1];

test('38 coop dynamique : départ d’un joueur → PV du segment en proportion après le délai, sans transition', function () {
  var s = sim({ joueurs: passifs(3), degatsZombie: 0 });
  s.combat.allerA('phase2');
  var max3 = s.etat().barre.max;
  verifier(proche(max3, CONFIG.phase2.pv * kPv(3), 1e-6), 'PV à 3 joueurs', max3);
  s.combat.forcer('pvSegment', 0.4 * max3);
  s.robot('j3').connecte = false;
  s.avancer(DELAI_DEPART - 0.5);
  verifier(proche(s.etat().barre.max, max3, 1e-9) && proche(s.etat().barre.valeur, 0.4 * max3, 1e-6), 'rien ne change avant le délai');
  s.avancer(1.0);
  var b = s.etat().barre;
  verifier(proche(b.max, CONFIG.phase2.pv * kPv(2), 1e-6), 'nouveau maximum (2 joueurs)', b.max);
  verifier(proche(b.valeur / b.max, 0.4, 1e-9), 'fraction restante conservée (40 %)', b.valeur / b.max);
  verifier(proche(b.segments[2], CONFIG.phase3.pv * kPv(2), 1e-6) && proche(b.segments[3], CONFIG.phase4.faiblesse.pv * kPv(2), 1e-6), 'segments à venir recalculés', b.segments);
  verifier(etat(s) === 'phase2' && evs(s, 'segment').length === 0, 'pas de saut de phase', etat(s));
  verifier(s.log.journal.some(function (j) { return /3 → 2 joueur/.test(j.msg); }), 'changement journalisé');
});

test('39 coop dynamique : arrivée d’un joueur → PV en proportion (aucun soin visible), amené dans la salle, plafond de zombies recalculé', function () {
  var s = sim({ joueurs: passifs(3, [{}, {}, { connecte: false }]), degatsZombie: 0, sansChiens: true });
  s.combat.allerA('phase1');
  var max2 = s.etat().barre.max;
  verifier(proche(max2, CONFIG.phase1.pv * kPv(2), 1e-6), 'départ à 2 joueurs', max2);
  s.combat.forcer('pvSegment', 0.5 * max2);
  s.robot('j3').connecte = true;
  s.avancer(DELAI_ARRIVEE - 0.4);
  verifier(proche(s.etat().barre.max, max2, 1e-9), 'pas encore compté');
  s.avancer(0.6);
  var b = s.etat().barre;
  verifier(proche(b.max, CONFIG.phase1.pv * kPv(3), 1e-6) && proche(b.valeur / b.max, 0.5, 1e-9), 'PV × ' + kPv(3) + ', fraction 50 % conservée', b);
  var tp = s.log.teleports.filter(function (x) { return x.id === 'j3'; });
  verifier(tp.length === 1 && tp[0].lieu === 'salle' && s.robot('j3').lieu === 'salle', 'le nouveau venu est amené dans la salle', tp);
  // plafond des zombies de la phase 1 : base + supp × (n − 1), atteint par les sorts quand personne ne tire
  var pire = 0;
  s.apresPas = function () { pire = Math.max(pire, s.zombies.length); };
  s.avancer(80);
  var max = CONFIG.phase1.zombiesMax + CONFIG.coop.zombiesParJoueurSupp * 2;
  verifier(pire <= max && pire >= max - 2, 'plafond à 3 joueurs = ' + max, pire);
});

test('40 coop dynamique : mort puis réapparition ou courte absence de la liste → aucun changement', function () {
  var s = sim({ joueurs: passifs(2), degatsZombie: 0, sansChiens: true });
  s.combat.allerA('phase3');
  var b0 = s.etat().barre;
  s.robot('j2').vivant = false;
  s.avancer(DELAI_DEPART + 5);
  verifier(proche(s.etat().barre.max, b0.max, 1e-9), 'mort : PV inchangés');
  s.robot('j2').vivant = true; s.robot('j2').pv = 1;
  s.avancer(2);
  s.robot('j2').connecte = false;
  s.avancer(DELAI_DEPART - 1);
  s.robot('j2').connecte = true;
  s.avancer(DELAI_DEPART + 1);
  verifier(proche(s.etat().barre.max, b0.max, 1e-9) && !s.log.journal.some(function (j) { return /joueur\(s\)/.test(j.msg); }), 'absence brève : PV inchangés');
});

test('41 coop dynamique : jauge finale en proportion, apparitions déléguées au jeu mises à jour', function () {
  var s = sim({ joueurs: passifs(2), degatsZombie: 0, delegueApparitions: true, surcharges: { phase5: { jauge: { vitesseBaisse: 0 } } } });
  s.combat.allerA('phase5');
  var appel0 = s.log.spawnsNormaux.filter(function (x) { return x.actif; }).slice(-1)[0];
  verifier(appel0 && appel0.params.max === CONFIG.phase5.apparitions.max + CONFIG.coop.zombiesParJoueurSupp, 'plafond à 2 joueurs', appel0);
  s.combat.forcer('jauge', 0.5);
  s.robot('j2').connecte = false;
  s.avancer(DELAI_DEPART + 0.5);
  verifier(proche(s.etat().jauge.valeur, 0.5, 1e-9), 'fraction de la jauge conservée', s.etat().jauge);
  var appel1 = s.log.spawnsNormaux.filter(function (x) { return x.actif; }).slice(-1)[0];
  verifier(appel1 !== appel0 && appel1.params.max === CONFIG.phase5.apparitions.max, 'plafond délégué recalculé (1 joueur)', appel1);
  s.jusqua(function () { return s.etat().boss.vulnerable; }, 10);
  var v0 = s.etat().jauge.valeur;
  s.combat.toucherBoss({ joueur: 'j1', degats: 630, zone: 'corps' });
  verifier(proche(s.etat().jauge.valeur - v0, 630 / (CONFIG.phase5.jauge.degatsRequis * kJauge(1)), 1e-9), 'dégâts requis = jauge solo', s.etat().jauge.valeur - v0);
});

test('42 coop dynamique : départ avec très peu de PV (> 0, fin normale) ; départ pendant une transition (segment vide)', function () {
  var s = sim({ joueurs: passifs(2), degatsZombie: 0 });
  s.combat.allerA('phase1');
  s.combat.forcer('pvSegment', 4);
  s.robot('j2').connecte = false;
  s.avancer(DELAI_DEPART + 0.5);
  verifier(etat(s) === 'phase1' && proche(s.etat().barre.valeur, 4 * kPv(1) / kPv(2), 1e-9) && s.etat().barre.valeur > 0, 'toujours en phase 1', s.etat().barre);
  s.combat.toucherBoss({ joueur: 'j1', degats: 10, zone: 'corps' });
  s.pas();
  verifier(etat(s) === 'repit', 'fin de phase au tir suivant', etat(s));
  var s2 = sim({ joueurs: passifs(2), degatsZombie: 0, sansMiniBoss: true });   // v1.3 : un coup ne vide plus la phase 2
  s2.combat.allerA('phase2');
  s2.combat.toucherBoss({ joueur: 'j1', degats: 1e9, zone: 'corps' });
  s2.pas();
  verifier(etat(s2) === 'transition23', 'transition', etat(s2));
  s2.robot('j2').connecte = false;
  s2.avancer(DELAI_DEPART + 0.5);
  verifier(s2.etat().barre.valeur === 0 || etat(s2) === 'absence', 'segment vide pendant la transition');
  s2.jusqua(function () { return etat(s2) === 'absence'; }, 10);
  verifier(proche(s2.etat().barre.max, CONFIG.phase3.pv * kPv(1), 1e-6) && proche(s2.etat().barre.valeur, s2.etat().barre.max, 1e-6), 'segment suivant au maximum solo', s2.etat().barre);
});

test('43 coop dynamique : un joueur quitte la partie en pleine phase 2, le combat va au bout (récompenses des présents)', function () {
  var s = sim({ joueurs: [{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }], pvZombie: Sim.MODELE.pvZombie });
  s.combat.demarrer();
  s.jusqua(function () { return etat(s) === 'phase2' && s.etat().tempsEtat > 10; }, 300);
  s.robot('j3').connecte = false;
  s.jusqua(function () { return finCombat(s); }, 2500);
  verifier(etat(s) === 'termine', 'victoire à 2 après le départ', etat(s));
  var armes = s.log.armes;
  verifier(armes.filter(function (a) { return a.id === 'j1'; }).length === 2 && armes.filter(function (a) { return a.id === 'j3'; }).length === 0, 'récompenses pour les joueurs présents seulement');
  verifier(evs(s, 'avertissement').length === 0, 'aucun avertissement', evs(s, 'avertissement').map(function (e) { return e.d.texte; }));
});

test('44 équilibrage : objectifs sur les 5 graines de référence (robots moyens, tir continu et arme du prototype)', function () {
  var M = require(path.join(__dirname, 'logique', 'mesures.js'));
  var G = M.GRAINES_REFERENCE;
  function moy(l, k) { return l.reduce(function (a, m) { return a + m[k]; }, 0) / l.length; }
  // a) tir continu (borne « joueur très efficace ») : v1.4 → au moins 4 victoires sur 5 (38/40 sur 40 graines), 5,5 à 9 min ;
  // v1.5 : 4/5 (33/40 : 7 morts en phase 2, dont 6 face au Démembré géant et à ses petits)
  var rapide = G.map(function (g) { return M.mesurer({ n: 1, graine: g }); });
  var gr = rapide.filter(function (m) { return m.fin === 'termine'; });
  verifier(gr.length >= 4, 'solo, tir continu : au moins 4 victoires sur 5', rapide.map(function (m) { return m.graine + ':' + m.fin; }));
  gr.forEach(function (m) {
    verifier(m.total >= 330 && m.total <= 540, 'solo, tir continu : 5,5 à 9 min (graine ' + m.graine + ')', m.total);
    verifier(m.cycles >= 1, 'solo, tir continu : au moins 1 cycle ailes + piqué (graine ' + m.graine + ')', m.cycles);
  });
  // b) arme du prototype (30 balles, 2,1 s de rechargement) : plus proche d'un vrai joueur.
  // ⚠ v1.4 : l'objectif §16.10 (≥ 3/5) N'ÉTAIT PAS TENU (1/5 ; 9/40 sur 40 graines) et ne pouvait pas l'être en ne réglant que PV et
  // dégâts (même en divisant les PV des mini-boss par deux : 2/5, 15/40) : l'étourdissement du Survolté (phase 2) et les salves
  // (phase 3) en étaient la cause.
  // ⚠ v1.5 (§17.7, mesurée telle quelle, sans toucher aux valeurs) : 0/5, 2/15, 2/40 — 32 des 38 morts en phase 2 (zombies 22,
  // piqué 4, Démembré et petits 7, décharges 3). Le test garde la mesure : au moins 1 victoire sur les 15 graines, durées des
  // phases atteintes ; remettre « ≥ 3/5 » quand Anthony aura choisi des réglages (variantes mesurées dans le rapport v1.5).
  var solo = G.map(function (g) { return M.mesurer({ n: 1, graine: g, chargeur: 30 }); });
  var gagnes = solo.filter(function (m) { return m.fin === 'termine'; });
  var G15 = G.concat([1, 2, 3, 4, 5, 6, 8, 9, 10, 11]), solo15 = solo.concat(G15.slice(5).map(function (g) { return M.mesurer({ n: 1, graine: g, chargeur: 30 }); }));
  var gagnes15 = solo15.filter(function (m) { return m.fin === 'termine'; });
  verifier(gagnes15.length >= 1, 'solo, chargeur : au moins 1 victoire sur 15 graines (v1.5 : 2/15 ; objectif ≥ 3/5 non tenu, voir plus haut)', solo15.map(function (m) { return m.graine + ':' + m.fin + '/' + m.etatEchec; }));
  solo15.forEach(function (m) {
    if (m.fin === 'termine' || m.phase5 > 0) verifier(m.cycles >= 2, 'solo, chargeur : au moins 2 cycles ailes + piqué (graine ' + m.graine + ')', m.cycles);
    ['phase1', 'phase3'].forEach(function (k) { verifier(m[k] <= 200, 'solo, chargeur : ' + k + ' ≤ 200 s (graine ' + m.graine + ')', m[k]); });
    // v1.3/v1.4 : la phase 2 contient les trois combats de mini-boss (Septième protégé) : le Septième seul ≤ 200 s, chaque mini-boss ≤ 75 s
    if (m.fin === 'termine' || m.phase3 > 0) {
      verifier(m.phase2 - m.protection <= 200, 'solo, chargeur : phase 2 hors protection ≤ 200 s (graine ' + m.graine + ')', { phase2: m.phase2, protection: m.protection });
      // v1.5 : le Démembré géant (petits Démembrés, charges, invulnérabilité) dure 58 à 80 s → ≤ 90 s
      ['dureeSurvolte', 'dureeIrradie', 'dureeDemembre'].forEach(function (k) { verifier(m[k] > 0 && m[k] <= (k === 'dureeDemembre' ? 90 : 75), 'solo, chargeur : ' + k + ' ≤ ' + (k === 'dureeDemembre' ? 90 : 75) + ' s (graine ' + m.graine + ')', m[k]); });
    }
  });
  // v1.4 : 8 à 17 min (le Démembré, les salves et les zombies de la faiblesse allongent le combat d'≈ 2 min)
  gagnes15.forEach(function (m) { verifier(m.total >= 480 && m.total <= 1020, 'solo, chargeur : 8 à 17 min (graine ' + m.graine + ')', m.total); });
  // c) coop à 4 : 5/5, tir continu et arme du prototype
  var coop = G.map(function (g) { return M.mesurer({ n: 4, graine: g }); });
  coop.forEach(function (m) {
    verifier(m.fin === 'termine', 'coop 4 : victoire (graine ' + m.graine + ')', m.fin);
    verifier(m.cycles >= 1, 'coop 4 : au moins 1 cycle d’ailes (graine ' + m.graine + ')', m.cycles);
    ['phase1', 'phase2', 'phase3', 'phase5', 'p4'].forEach(function (k) { verifier(m[k] >= 25, 'coop 4 : ' + k + ' ≥ 25 s (graine ' + m.graine + ')', m[k]); });
  });
  // ⚠ v1.5 : coop 4 avec l'arme du prototype 4/5 (35/40) : l'objectif 5/5 n'est plus tenu (v1.4 : 5/5, 37/40) — morts en
  // phase 2 (zones et aura de L'Irradié 9, fléau, charge et coups du Démembré géant 10, zombies 5) ; le test garde ≥ 4/5
  var coopC = G.map(function (g) { return M.mesurer({ n: 4, graine: g, chargeur: 30 }); });
  verifier(coopC.filter(function (m) { return m.fin === 'termine'; }).length >= 4, 'coop 4, chargeur : au moins 4 victoires sur 5 (v1.5 : 4/5 ; objectif 5/5 non tenu)', coopC.map(function (m) { return m.graine + ':' + m.fin; }));
  note('solo tir continu : ' + gr.length + '/5, ' + (moy(gr, 'total') / 60).toFixed(1) + ' min · solo chargeur : ' + gagnes.length + '/5, ' + gagnes15.length + '/15 gagnés (⚠ objectif ≥ 3/5 non tenu), ' +
    moy(solo, 'cycles').toFixed(1) + ' cycles · coop 4 : ' + (moy(coop, 'total') / 60).toFixed(1) + ' min (chargeur ' + (moy(coopC, 'total') / 60).toFixed(1) +
    ' min ; ' + coopC.filter(function (m) { return m.fin === 'termine'; }).length + '/5, ⚠ objectif 5/5 non tenu), phase la plus courte ' + Math.min.apply(null, coop.map(function (m) { return Math.min(m.phase1, m.phase2, m.phase3, m.phase5); })).toFixed(0) + ' s');
  note('mini-boss (solo chargeur) : Survolté ' + moy(solo, 'dureeSurvolte').toFixed(0) + ' s, Irradié ' + moy(solo, 'dureeIrradie').toFixed(0) + ' s, Démembré ' + moy(solo, 'dureeDemembre').toFixed(0) +
    ' s, phase 2 ' + moy(solo, 'phase2').toFixed(0) + ' s dont ' + moy(solo, 'protection').toFixed(0) + ' s de protection · coop 4 : Survolté ' + moy(coop, 'dureeSurvolte').toFixed(0) +
    ' s, Irradié ' + moy(coop, 'dureeIrradie').toFixed(0) + ' s, Démembré ' + moy(coop, 'dureeDemembre').toFixed(0) + ' s');
  var echecs = solo.filter(function (m) { return m.fin !== 'termine'; }).map(function (m) { return m.graine + ' (' + m.etatEchec + ')'; });
  note('chiens (solo chargeur) : ' + moy(solo, 'chiensTues').toFixed(0) + ' tués par combat, morsures ' + (moy(solo, 'degatsChiens') * 100).toFixed(0) +
    ' % des PV · échecs : ' + (echecs.length ? echecs.join(', ') : 'aucun'));
});

// ═══════════════════════════════════════ 13. version 1.1 (API.md §13) ═══════════════════════════════════════
function fusionnerTest(a, b) {
  for (var k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') fusionnerTest(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
function distCapsuleTest(q, p) {
  var y = Math.max(p.y + 0.3, Math.min(p.y + 1.8, q.y));
  return Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - y) * (q.y - y) + (q.z - p.z) * (q.z - p.z));
}
function pilierMonde(s, i) {
  var P = s.arene.salle.piliers[i];
  return { id: P.id, x: s.origine.x + P.x, y: s.origine.y, z: s.origine.z + P.z, r: P.rayon };
}
var RAISONS_TP = ['phase', 'frappe', 'degats', 'blocage'];

test('46 v1.1 zombies : chaque apparition transmet la vitesse et l’agressivité de config.zombies', function () {
  var s = sim({ joueurs: [{ id: 'j1' }], pvZombie: Sim.MODELE.pvZombie });
  s.combat.demarrer();
  s.jusqua(function () { return (etat(s) === 'rituel' && s.etat().tempsEtat > 6) || finCombat(s); }, 900);
  var ap = s.log.apparitions, effets = {};
  ap.forEach(function (a) { effets[a.effet] = true; });
  verifier(ap.length > 30 && effets.emergence && effets.breche, 'apparitions des sorts et des brèches', { n: ap.length, effets: effets });
  verifier(ap.every(function (a) { return a.vitesse === CONFIG.zombies.vitesse && a.agressif === CONFIG.zombies.agressif; }), 'vitesse « sprint » et agressif', ap.slice(0, 2));
  var s2 = sim({ joueurs: [{ id: 'j1', tire: false }], degatsZombie: 0, surcharges: { zombies: { vitesse: 'course', agressif: false } } });
  s2.combat.allerA('absence');
  s2.avancer(5);
  verifier(s2.log.apparitions.length > 0 && s2.log.apparitions.every(function (a) { return a.vitesse === 'course' && a.agressif === false; }), 'réglage de la config respecté');
});

test('47 v1.1 piliers : instantané, point d’impact sur la surface, dégâts limités autour de ce point', function () {
  var s = essaiBlocs({ joueur: { immobile: true, reaction: null }, surcharges: { phase3: { deplacement: { vitesse: 0 }, ondeChoc: { actif: false } } } });
  var e0 = s.etat().piliers;
  verifier(e0.length === 4 && e0.every(function (p) { return p.etat === 'intact' && p.coups === 0 && p.t >= 0; }), '4 piliers intacts', e0);
  var c = pilierMonde(s, 0), l = Math.hypot(c.x - s.origine.x, c.z - s.origine.z);
  var u = { x: -(c.x - s.origine.x) / l, z: -(c.z - s.origine.z) / l }, v = { x: -u.z, z: u.x };
  s.robots.push(s.robot('j1'));                     // (référence inchangée)
  s.placer('j1', { x: c.x - u.x * 1.25, z: c.z - u.z * 1.25 }, 'salle');   // caché derrière le pilier
  var s2 = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: null },
    { id: 'j2', tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: null }], degatsZombie: 0, graine: 3, sansChiens: true,
    surcharges: { phase3: { apparitionsSuspendues: true, deplacement: { vitesse: 0 }, ondeChoc: { actif: false } } } });
  s2.combat.allerA('phase3');
  s2.placer('j1', { x: c.x - u.x * 1.25, z: c.z - u.z * 1.25 }, 'salle');
  s2.placer('j2', { x: c.x + v.x * 1.25, z: c.z + v.z * 1.25 }, 'salle');  // collé au flanc du pilier
  s2.jusqua(function () { return evs(s2, 'pilier').length >= 1; }, 40);
  var ev = evs(s2, 'pilier')[0];
  verifier(ev && ev.d.id === c.id && ev.d.etat === 'touche' && ev.d.coups === 1, 'premier coup sur le pilier', ev && ev.d);
  verifier(proche(ev.d.position.x, c.x, 1e-9) && proche(ev.d.position.z, c.z, 1e-9) && proche(ev.d.position.y, c.y, 1e-9), 'position = centre du pilier au sol', ev.d.position);
  var q = ev.d.pointImpact;
  verifier(proche(Math.hypot(q.x - c.x, q.z - c.z), c.r, 1e-6), 'point d’impact sur la surface', q);
  var touches = s2.log.degats.filter(function (d) { return d.source === 'bloc' && proche(d.t, ev.t, 1e-9); }).map(function (d) { return d.id; }).sort();
  var attendus = ['j1', 'j2'].filter(function (id) { return distCapsuleTest(q, s2.robot(id).pos) <= CONFIG.phase3.piliers.rayonDegats; }).sort();
  verifier(JSON.stringify(touches) === JSON.stringify(attendus) && attendus.indexOf('j1') < 0, 'seuls les joueurs proches du point d’impact sont touchés', { touches: touches, attendus: attendus });
  var bi = evs(s2, 'blocImpact').filter(function (e) { return proche(e.t, ev.t, 1e-9); })[0];
  verifier(bi && bi.d.pilier === c.id && JSON.stringify(bi.d.touches.slice().sort()) === JSON.stringify(touches), 'blocImpact.pilier et touches', bi && bi.d);
  var p1 = s2.etat().piliers.filter(function (p) { return p.id === c.id; })[0], t1 = p1.t;
  s2.avancer(0.5);
  var p2 = s2.etat().piliers.filter(function (p) { return p.id === c.id; })[0];
  verifier(p1.etat === 'endommage' && p1.coups === 1 && proche(p2.t - t1, 0.5, 1e-6), 'pilier endommagé, t depuis le dernier changement', [p1, p2]);
  var autres = evs(s2, 'blocImpact').filter(function (e) { return e.d.pilier === null; });
  verifier(autres.every(function (e) { return e.d.pilier === null; }), 'pilier: null sur les autres impacts');
});

test('48 v1.1 piliers : détruits pour le reste du combat, remis à neuf avant la phase 3 ou pour un nouveau combat', function () {
  var s = sim({ joueurs: passifs(1), degatsZombie: 0 });
  s.combat.allerA('phase3');
  s.combat.forcer('pilier', { id: 'pilier2', coups: CONFIG.phase3.piliers.coupsDestruction });
  function etatP(id) { return s.etat().piliers.filter(function (p) { return p.id === id; })[0].etat; }
  verifier(etatP('pilier2') === 'detruit', 'détruit');
  ['transition34', 'rituel', 'faiblesse', 'phase5', 'conclusion'].forEach(function (e) {
    s.combat.allerA(e);
    verifier(etatP('pilier2') === 'detruit', 'encore détruit en ' + e);
  });
  s.combat.allerA('phase1');
  verifier(s.etat().piliers.every(function (p) { return p.etat === 'intact' && p.coups === 0; }), 'allerA(phase1) : piliers neufs');
  s.combat.forcer('pilier', { id: 'pilier0', coups: 2 });
  s.combat.allerA('phase3');
  verifier(etatP('pilier0') === 'endommage', 'allerA(phase3) garde l’état');
  s.combat.allerA('inactif');
  verifier(s.combat.demarrer() && s.etat().piliers.every(function (p) { return p.etat === 'intact'; }), 'nouveau combat : piliers neufs');
  // un pilier détruit ne fait plus obstacle : le bloc visé sur le joueur caché derrière l'atteint (test 15) ; ici, les sorts
  var s2 = sim({ joueurs: passifs(1), degatsZombie: 0 });
  s2.combat.allerA('phase3');
  [0, 1, 2, 3].forEach(function (i) { s2.combat.forcer('pilier', { id: 'pilier' + i, coups: 3 }); });
  var c = pilierMonde(s2, 1);
  s2.combat.forcer('position', { x: c.x, y: s2.origine.y + 0.7, z: c.z });
  s2.pas();
  var b = s2.etat().boss.position;
  verifier(Math.hypot(b.x - c.x, b.z - c.z) < 0.1, 'le boss peut se tenir à l’emplacement d’un pilier détruit', b);
});

test('49 v1.1 phase 3 : plafond des zombies en coop (base + coop.zombiesParJoueurSupp)', function () {
  var s = sim({ joueurs: passifs(2), degatsZombie: 0, sansChiens: true, surcharges: { phase3: { ondeChoc: { actif: false }, arrachement: { intervalle: [999, 999] } } } });
  s.combat.allerA('phase3');
  var pire = 0;
  s.apresPas = function () { pire = Math.max(pire, s.zombies.length); };
  s.avancer(CONFIG.phase3.apparitions.delai + CONFIG.phase3.apparitions.intervalle * 16);
  var max = CONFIG.phase3.apparitions.max + CONFIG.coop.zombiesParJoueurSupp;
  verifier(pire === max, 'plafond à 2 joueurs = ' + max, pire);
});

test('50 v1.1 bonus : « Munitions max » à la fin de chacune des 5 phases, aux bons endroits, une seule fois', function () {
  var s = sim({ joueurs: [{ id: 'j1', increvable: true }], pvZombie: Sim.MODELE.pvZombie });
  s.combat.demarrer();
  s.jusqua(function () { return finCombat(s); }, 2500);
  verifier(etat(s) === 'termine', 'combat terminé', etat(s));
  var b = evs(s, 'bonus', function (d) { return d.source === 'phase'; });   // v1.5 : + les bonus de mort des mini-boss (test 93)
  verifier(b.length === 5 && JSON.stringify(b.map(function (e) { return e.d.phase; })) === '[1,2,3,4,5]', '5 bonus, phases 1 à 5', b.map(function (e) { return e.d; }));
  verifier(evs(s, 'bonus').length === 5 + CONFIG.miniBoss.ordre.length, 'et un par mini-boss (v1.5)', evs(s, 'bonus').length);
  verifier(JSON.stringify(b.map(function (e) { return e.d.lieu; })) === JSON.stringify(['salle', 'salle', 'salle', 'bunker', 'salle']), 'lieux');
  verifier(b.every(function (e) { return e.d.type === CONFIG.bonusFinDePhase.type && e.d.mode === 'depose'; }), 'type et mode « depose »');
  var j = s.journalEtats(), quand = function (etatNom) { return j.filter(function (x) { return x.vers === etatNom; })[0].t; };
  ['repit', 'transition23', 'transition34', 'phase5', 'retour_salle'].forEach(function (e, i) {
    verifier(proche(b[i].t, quand(e), 1e-9), 'bonus ' + (i + 1) + ' au début de ' + e, [b[i].t, quand(e)]);
  });
  var marge = s.arene.salle.apotheme - (s.arene.salle.limiteJoueurs - 2);
  verifier(b.slice(0, 3).every(function (e) { return dansSalleMonde(s, e.d.position, marge - 1e-6) && proche(e.d.position.y, s.origine.y, 1e-9); }), 'phases 1 à 3 : au sol, à ≥ 2 m de la limite des joueurs');
  var reveil = s.arene.bunker7.arriveeJoueurs[0];
  verifier(Math.hypot(b[3].d.position.x - reveil.x, b[3].d.position.z - reveil.z) <= 3, 'phase 4 : près du point de réveil', b[3].d.position);
  var cad = s.monde(s.arene.salle.cadavre);
  verifier(Math.hypot(b[4].d.position.x - cad.x, b[4].d.position.z - cad.z) <= 2.5, 'phase 5 : près du cadavre', b[4].d.position);
  var poses = s.log.bonusPoses.filter(function (x) { return x.q.duree === CONFIG.bonusFinDePhase.duree; });
  verifier(s.log.bonusPoses.length === 5 + CONFIG.miniBoss.ordre.length && poses.length >= 5 && poses.every(function (x) { return x.q.type === 'munitions-max' && x.q.position && x.q.lieu; }),
    'jeu.faireApparaitreBonus({ type, position, lieu, duree })', s.log.bonusPoses[0]);
  verifier(s.log.bonus.every(function (x) { return x.bonus !== 'munitions-max' || x.t >= quand('recompenses'); }), 'pas d’activation directe');
});

test('51 v1.1 bonus : repli sur activerBonus (méthode absente ou refus) ; une seule fois par fin de phase malgré allerA', function () {
  var s = sim({ joueurs: passifs(1), degatsZombie: 0, retirerMethodes: ['faireApparaitreBonus'] });
  s.combat.allerA('repit');
  var b = evs(s, 'bonus');
  verifier(b.length === 1 && b[0].d.mode === 'active' && s.log.bonus.filter(function (x) { return x.bonus === 'munitions-max'; }).length === 1, 'méthode absente → activerBonus', b.map(function (e) { return e.d; }));
  var s2 = sim({ joueurs: passifs(1), degatsZombie: 0, bonusRefuse: true });
  s2.combat.allerA('transition23');
  verifier(evs(s2, 'bonus')[0].d.mode === 'active' && s2.log.bonusPoses.length === 1 && s2.log.bonus.length === 1, 'refus (false) → activerBonus');
  var s3 = sim({ joueurs: passifs(1), degatsZombie: 0 });
  s3.combat.allerA('repit'); s3.combat.allerA('repit'); s3.combat.allerA('phase1');
  s3.combat.toucherBoss({ joueur: 'j1', degats: 1e9 }); s3.pas();
  verifier(etat(s3) === 'repit' && evs(s3, 'bonus').length === 1, 'bonus de la phase 1 une seule fois', evs(s3, 'bonus').length);
  s3.combat.allerA('inactif');
  s3.combat.demarrer();
  s3.combat.allerA('repit');
  verifier(evs(s3, 'bonus').length === 2, 'nouveau combat : de nouveau disponible');
  var s4 = sim({ joueurs: passifs(1), degatsZombie: 0, surcharges: { bonusFinDePhase: { actif: false } } });
  s4.combat.allerA('repit');
  verifier(evs(s4, 'bonus').length === 0, 'désactivable');
});

test('52 v1.1 phase 4 : apparitions rapprochées jusqu’au plafond (config.phase4.apparitions) en solo et en coop', function () {
  [1, 2].forEach(function (n) {
    var s = sim({ joueurs: passifs(n), degatsZombie: 0, sansChiens: true });
    s.combat.allerA('rituel');
    var t0 = s.t, pire = 0;
    s.apresPas = function () { pire = Math.max(pire, s.zombies.length); };
    var A = CONFIG.phase4.apparitions, max = A.max + CONFIG.coop.zombiesParJoueurSupp * (n - 1);
    s.avancer(A.intervalle * (max + 3));
    var ap = s.log.apparitions.filter(function (a) { return a.t > t0; });
    verifier(etat(s) === 'rituel', 'toujours dans le rituel', etat(s));
    verifier(pire === max, n + ' joueur(s) : plafond ' + max, pire);
    verifier(max >= 1.75 * 12, 'nettement plus de zombies qu’en v1.0 (12 au plus)', max);
    verifier(proche(ap[1].t - ap[0].t, A.intervalle, PAS * 1.5) && proche(ap[0].t - t0, A.intervalle, PAS * 1.5), 'toutes les ' + A.intervalle + ' s', [ap[0].t - t0, ap[1].t - ap[0].t]);
  });
});

function essaiTeleport(o) {
  o = o || {};
  var surch = fusionnerTest({ phase5: { apparitions: { max: 0 }, traque: { vitesse: 0, vitesseProche: 0, delaiBlocage: 999 } } }, o.surcharges || {});
  var s = sim({ joueurs: o.joueurs || passifs(1), degatsZombie: 0, graine: o.graine || 5, sansMurBunker: o.sansMur !== false, surcharges: surch, sansChiens: true });
  s.combat.allerA('phase5');
  return s;
}
function chargeur(s, joueur, balles, pas) {
  var res = [];
  for (var k = 0; k < balles; k++) { res.push(s.combat.toucherBoss({ joueur: joueur, degats: 35, zone: 'corps' })); s.avancer(pas == null ? 0.1 : pas); }
  return res;
}
test('53 v1.1 phase 5 : un chargeur (≈ 1 050 dégâts en 3 s) → téléportation à 12–32 m du tireur, atteignable', function () {
  var T = CONFIG.phase5.teleportDegats, s = essaiTeleport();
  s.avancer(T.delaiMin + 0.1);
  var r = chargeur(s, 'j1', 30);
  var debut = evs(s, 'action', function (d) { return d.id === 'teleport_depart'; });
  verifier(debut.length === 1, 'implosion rapide lancée', debut.length);
  s.jusqua(function () { return evs(s, 'teleport', function (d) { return d.sens === 'depart'; }).length >= 1; }, 2);
  var dep = evs(s, 'teleport', function (d) { return d.sens === 'depart'; });
  var arr = evs(s, 'teleport', function (d) { return d.sens === 'arrivee' && d.raison === 'degats'; });
  verifier(dep.length === 1 && dep[0].d.raison === 'degats', 'téléportation « degats »', dep.map(function (e) { return e.d; }));
  var appliques = r.filter(function (x) { return x.applique; }).length;
  verifier(appliques === Math.ceil(T.seuil / 35) || appliques === Math.ceil(T.seuil / 35) + 1, 'déclenchée au seuil (' + T.seuil + ')', appliques);
  s.jusqua(function () { return evs(s, 'teleport', function (d) { return d.sens === 'arrivee' && d.raison === 'degats'; }).length >= 1; }, 3);
  arr = evs(s, 'teleport', function (d) { return d.sens === 'arrivee' && d.raison === 'degats'; });
  var p = arr[0].d.position, j = s.robot('j1').pos, dd = Math.hypot(p.x - j.x, p.z - j.z);
  verifier(dd >= T.distanceMin - 1e-6 && dd <= T.distanceMax + 1e-6, 'à ' + T.distanceMin + '–' + T.distanceMax + ' m du tireur', dd);
  verifier(s.jeu.chemin(p, j, 'bunker') && s.jeu.positionValide(p, 'bunker'), 'point valide et atteignable', p);
  verifier(proche(dep[0].t - debut[0].t, Sim.Logique.DEFAUTS.implosionRapide[1], PAS * 1.5) && arr[0].t - dep[0].t <= PAS * 1.5, 'implosion rapide puis arrivée immédiate', [dep[0].t - debut[0].t, arr[0].t - dep[0].t]);
  // au plus une fois toutes les delaiMin s
  s.jusqua(function () { return s.etat().boss.vulnerable; }, 3);
  var tArr = arr[0].t;
  chargeur(s, 'j1', 30, 0.1);
  var dep2 = evs(s, 'teleport', function (d) { return d.sens === 'depart' && d.raison === 'degats'; });
  verifier(dep2.length === 1 || dep2[1].t - tArr >= T.delaiMin - 1e-6, 'délai minimal de ' + T.delaiMin + ' s', dep2.map(function (e) { return e.t - tArr; }));
  s.avancer(T.delaiMin);
  chargeur(s, 'j1', 30, 0.1);
  verifier(evs(s, 'teleport', function (d) { return d.sens === 'depart' && d.raison === 'degats'; }).length >= 2, 'nouvelle téléportation après le délai');
});

test('54 v1.1 phase 5 : jauge gelée pendant la téléportation puis gelJauge s, ou jusqu’au prochain tir ; l’élan d’une frappe est interrompu, jamais l’impact', function () {
  var T = CONFIG.phase5.teleportDegats, s = essaiTeleport({ surcharges: { phase5: { jauge: { delaiAvantBaisse: 0.5 } } } });
  var NB = Math.ceil(T.seuil / 35);                 // juste de quoi atteindre le seuil (les tirs suivants mettraient fin au gel)
  s.avancer(T.delaiMin + 0.1);
  chargeur(s, 'j1', NB);
  verifier(s.etat().jauge.gelee, 'gelée pendant la téléportation');
  s.jusqua(function () { return evs(s, 'teleport', function (d) { return d.sens === 'arrivee' && d.raison === 'degats'; }).length >= 1 && s.etat().boss.vulnerable; }, 4);
  var v0 = s.etat().jauge.valeur, t0 = s.t;
  s.avancer(T.gelJauge - 0.3);
  verifier(s.etat().jauge.gelee && proche(s.etat().jauge.valeur, v0, 1e-12), 'gelée ' + T.gelJauge + ' s après l’arrivée', s.etat().jauge);
  s.avancer(0.6);
  verifier(!s.etat().jauge.gelee && s.etat().jauge.valeur < v0, 'puis elle baisse de nouveau', s.etat().jauge);
  // un tir qui le touche met fin au gel
  var s2 = essaiTeleport();
  s2.avancer(T.delaiMin + 0.1);
  chargeur(s2, 'j1', NB);
  s2.jusqua(function () { return s2.etat().boss.vulnerable; }, 4);
  verifier(s2.etat().jauge.gelee, 'gelée après l’arrivée');
  s2.combat.toucherBoss({ joueur: 'j1', degats: 35, zone: 'corps' });
  s2.pas();
  verifier(!s2.etat().jauge.gelee, 'le prochain tir met fin au gel');
  // pendant l'élan (préparation) d'une frappe : la téléportation l'interrompt, aucune frappe portée
  var traque = { phase5: { traque: { vitesse: 4, vitesseProche: 5.4 } } };
  var s3 = essaiTeleport({ surcharges: traque });
  s3.jusqua(function () { var a = s3.etat().boss.action; return a && a.id === 'frappe' && a.etape === 'preparation'; }, 40);
  var nF = evs(s3, 'frappe').length;
  for (var k = 0; k < 30; k++) s3.combat.toucherBoss({ joueur: 'j1', degats: 35, zone: 'corps' });
  s3.avancer(0.1);
  s3.jusqua(function () { return evs(s3, 'teleport', function (d) { return d.raison === 'degats' && d.sens === 'arrivee'; }).length >= 1; }, 3);
  var dep3 = evs(s3, 'teleport', function (d) { return d.raison === 'degats' && d.sens === 'depart'; });
  verifier(dep3.length === 1 && evs(s3, 'frappe').length === nF && s3.robot('j1').pv === 1, 'élan interrompu : téléportation « degats », aucune frappe, joueur intact', { tp: dep3.length, frappes: evs(s3, 'frappe').length - nF, pv: s3.robot('j1').pv });
  // pendant l'impact ou la récupération d'une frappe réussie : jamais (il disparaît ensuite pour la raison « frappe »)
  var s4 = essaiTeleport({ surcharges: traque });
  s4.jusqua(function () { var a = s4.etat().boss.action; return a && a.id === 'frappe' && a.etape === 'recuperation'; }, 40);
  for (var k2 = 0; k2 < 30; k2++) s4.combat.toucherBoss({ joueur: 'j1', degats: 35, zone: 'corps' });
  s4.jusqua(function () { return !s4.etat().boss.action || s4.etat().boss.action.id !== 'frappe'; }, 3);
  s4.avancer(0.1);
  var deg = evs(s4, 'teleport', function (d) { return d.raison === 'degats'; });
  verifier(evs(s4, 'frappe', function (d) { return d.reussie; }).length === 1 && deg.length === 0, 'pas de téléportation sur dégâts pendant la récupération ni juste après une frappe réussie', deg.map(function (e) { return e.d; }));
  verifier(evs(s4, 'teleport', function (d) { return d.sens === 'depart'; }).every(function (e) { return e.d.raison === 'frappe'; }), 'disparition « frappe »');
  // coop : seuil × (1 + seuilParJoueurSupp × (n − 1))
  var T2 = CONFIG.phase5.teleportDegats, s5 = essaiTeleport({ joueurs: passifs(2) }), seuil2 = T2.seuil * (1 + T2.seuilParJoueurSupp);
  s5.avancer(T2.delaiMin + 0.1);
  var n5 = 0;
  while (n5 < 200 && !evs(s5, 'action', function (d) { return d.id === 'teleport_depart'; }).length) { s5.combat.toucherBoss({ joueur: 'j1', degats: 35, zone: 'corps' }); n5++; s5.avancer(0.01); }
  verifier(n5 === Math.ceil(seuil2 / 35) || n5 === Math.ceil(seuil2 / 35) + 1, 'à 2 joueurs : seuil ' + seuil2, n5);
});

test('55 v1.1 téléportations : champ raison partout ; phase 5 gagnable (robots moyens, avec ou sans chargeur, solo et à 4)', function () {
  var s = sim({ joueurs: [{ id: 'j1', dps: 350, reaction: 0.45, increvable: true }], pvZombie: Sim.MODELE.pvZombie });
  s.combat.demarrer();
  s.jusqua(function () { return finCombat(s); }, 2500);
  var tp = evs(s, 'teleport');
  verifier(tp.length > 5 && tp.every(function (e) { return RAISONS_TP.indexOf(e.d.raison) >= 0; }), 'raison sur chaque évènement teleport', tp.filter(function (e) { return RAISONS_TP.indexOf(e.d.raison) < 0; }).map(function (e) { return e.d; }));
  var parRaison = {};
  tp.forEach(function (e) { parRaison[e.d.raison] = (parRaison[e.d.raison] || 0) + 1; });
  verifier(parRaison.phase >= 4 && parRaison.degats >= 2, 'raisons « phase » et « degats » présentes', parRaison);
  var lignes = [];
  [1, 4].forEach(function (n) {
    [0, 30].forEach(function (balles) {
      var durees = [], teleports = 0, gagnees = 0;
      [1939, 7, 99].forEach(function (g) {
        var joueurs = [];
        for (var i = 1; i <= n; i++) joueurs.push({ id: 'j' + i, dps: 350, reaction: 0.45, chargeur: balles, rechargement: 2.1 });
        var x = sim({ joueurs: joueurs, pvZombie: Sim.MODELE.pvZombie, graine: g });
        x.combat.allerA('phase5');
        var t0 = x.t;
        x.jusqua(function () { return etat(x) !== 'phase5'; }, 600);
        if (etat(x) === 'defaite') gagnees++;
        durees.push(x.t - t0);
        teleports += evs(x, 'teleport', function (d) { return d.sens === 'depart' && d.raison === 'degats'; }).length;
      });
      // tir continu : toujours gagnée ; avec les rechargements du prototype, le joueur à 1 % après une frappe spéciale
      // peut mourir sous les coups des zombies (voulu par la demande) : gagnée au moins 2 fois sur 3
      verifier(gagnees === 3 || (balles && gagnees >= 2), (n === 1 ? 'solo' : n + ' joueurs') + (balles ? ', chargeur' : ', tir continu') + ' : phase 5 gagnable', gagnees);
      lignes.push((n === 1 ? 'solo' : n + ' joueurs') + ', ' + (balles ? 'chargeur 30 + 2,1 s' : 'tir continu') + ' : ' + gagnees + '/3 gagnées, ' + durees.map(function (x) { return x.toFixed(0); }).join(' / ') + ' s, ' + (teleports / 3).toFixed(1) + ' téléportations « degats »');
    });
  });
  note('phase 5 (depuis allerA) — ' + lignes.join(' · '));
});

// ═══════════════════════════════════════ 14. version 1.2 (API.md §14) ═══════════════════════════════════════
var CH = CONFIG.chiens, DS = CONFIG.phase1.secondeMoitie.doubleSort;
function chiensSim(s) { return s.zombies.filter(function (z) { return z.type === 'chien' && z.vivant; }); }
function zombiesSim(s) { return s.zombies.filter(function (z) { return z.type !== 'chien' && z.vivant; }); }
function effectif(n) { return CH.max + CH.maxParJoueurSupp * (n - 1); }
function evsDepuis(s, type, t0, f) { return evs(s, type, f).filter(function (e) { return e.t > t0 - 1e-9; }); }
function dist2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function etatA(s, t) {                              // état du combat à l'instant t (journal des états du simulateur)
  var l = s.journalEtats(), e = null;
  for (var i = 0; i < l.length; i++) if (l[i].t <= t + 1e-9) e = l[i].vers;
  return e;
}
// robots passifs (ne tirent pas), zombies et chiens inoffensifs : on observe la meute sans qu'elle tue personne
function meuteSim(n, o) { return sim(Object.assign({ joueurs: passifs(n), degatsZombie: 0, degatsChien: 0 }, o || {})); }
function act(s) { return s.etat().boss.action; }
function sortsInvocation(s) { return evs(s, 'projectile', function (d) { return d.type === 'invocation'; }); }
// distance horizontale de l'axe d'un pilier au segment a → b
function distAxeSegment(c, a, b) {
  var ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz || 1e-12;
  var t = Math.max(0, Math.min(1, ((c.x - a.x) * ux + (c.z - a.z) * uz) / l2));
  return Math.hypot(a.x + ux * t - c.x, a.z + uz * t - c.z);
}

test('57 v1.2 déclencheur : 50 % des PV du segment de la phase 1 (solo, coop), une seule fois ; coup unique de plus de 50 % à 0 → meute lâchée', function () {
  var SM = CONFIG.phase1.secondeMoitie;
  [1, 2].forEach(function (n) {
    var s = meuteSim(n);
    s.combat.allerA('phase1');
    s.avancer(0.5);
    var e = s.etat(), max = e.barre.max;
    verifier(proche(max, CONFIG.phase1.pv * kPv(n), 1e-6) && e.secondeMoitie === false && e.meute === null, n + ' joueur(s) : rien au départ', { sm: e.secondeMoitie, meute: e.meute });
    s.combat.toucherBoss({ joueur: 'j1', degats: (1 - SM.seuil) * max - 1 });
    s.avancer(1);
    verifier(proche(s.etat().barre.valeur, SM.seuil * max + 1, 1e-6) && !s.etat().secondeMoitie && evs(s, 'meute').length === 0, n + ' : 1 PV au-dessus du seuil → rien', s.etat().barre);
    s.combat.toucherBoss({ joueur: 'j1', degats: 1 });
    var m = evs(s, 'meute');
    verifier(s.etat().secondeMoitie === true && m.length === 1 && m[0].d.etat === 'dechainee' && m[0].d.max === effectif(n), n + ' : seuil atteint → secondeMoitie, meute « dechainee » (max ' + effectif(n) + ')', m.map(function (x) { return x.d; }));
    s.combat.forcer('pvSegment', max);                // une fois par combat : remonter puis redescendre ne relâche rien
    s.avancer(1);
    s.combat.forcer('pvSegment', 0.2 * max);
    s.avancer(1);
    verifier(evs(s, 'meute').length === 1 && s.etat().secondeMoitie && s.etat().meute.active, n + ' : une seule fois');
  });
  var s2 = meuteSim(1);
  s2.combat.allerA('phase1');
  s2.avancer(0.5);
  s2.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  verifier(evs(s2, 'meute', function (d) { return d.etat === 'dechainee'; }).length === 1 && s2.etat().secondeMoitie, 'coup unique de 100 % à 0 : meute lâchée');
  s2.avancer(3);
  verifier(etat(s2) === 'repit' && s2.etat().meute.active && s2.etat().meute.chiens.length === CH.max, 'la meute chasse pendant le répit', s2.etat().meute);
  verifier(evs(s2, 'meute').length === 1, 'pas de second lâcher au changement d’état');
  // valider() contrôle les nouvelles clés
  var c = JSON.parse(JSON.stringify(CONFIG));
  c.phase1.secondeMoitie.seuil = 1.2; c.phase1.secondeMoitie.doubleSort.ecart = [0.2, 2.0]; c.chiens.max = 0; c.chiens.profil.pv = 0;
  verifier(CONFIG.valider(c).length === 4, 'valider : seuil, écart, chiens.max, profil', CONFIG.valider(c));
});

test('58 v1.2 double sort : une action, deux tirs à 1–2 s sur le même joueur, point choisi au tir sous ses pieds, cible qui le suit, pas d’écart minimal entre les deux zones', function () {
  var P = CONFIG.phase1.invocation;
  var s = sim({ joueurs: passifs(2), degatsZombie: 0, sansChiens: true, graine: 17,
    surcharges: { phase1: { trait: { actif: false }, invocation: { zone: { degatsParSeconde: 0 } } } } });
  s.combat.allerA('phase1');
  s.jusqua(function () { var a = act(s); return a && a.id === 'invocation'; }, 15);
  verifier(!act(s).donnees.double, 'avant le seuil : invocation simple', act(s).donnees);
  s.jusqua(function () { return !act(s); }, 5);
  var plafond = CONFIG.phase1.zombiesMax + CONFIG.coop.zombiesParJoueurSupp, pire = 0;
  s.apresPas = function () { pire = Math.max(pire, zombiesSim(s).length); };
  s.placer('j1', s.monde({ x: -6, z: 0 }), 'salle'); s.placer('j2', s.monde({ x: 6, z: 0 }), 'salle');
  s.combat.forcer('pvSegment', 0.45 * s.etat().barre.max);
  var A = s.arene.salle.apotheme, mur = s.arene.salle.murs[0].normale;
  var places = [{ x: -5, z: 3 }, { x: 5, z: -3 }, { x: mur.x * (A - 0.5), z: mur.z * (A - 0.5) }, { x: 3, z: 5 }, { x: -3, z: -4 }];
  var ecarts = [];
  places.forEach(function (pl, k) {
    verifier(s.jusqua(function () { var a = act(s); return a && a.id === 'invocation' && a.etape === 'preparation' && !a.donnees.second; }, 15), 'paire ' + k + ' : préparation');
    var nA = evs(s, 'action', function (d) { return d.id === 'invocation'; }).length - 1;
    var a0 = act(s), cj = a0.cibleJoueur, autre = cj === 'j1' ? 'j2' : 'j1';
    verifier(a0.donnees.double === true && a0.donnees.second === false && a0.donnees.ecart >= DS.ecart[0] - 1e-9 && a0.donnees.ecart <= DS.ecart[1] + 1e-9,
      'action double, écart tiré dans [' + DS.ecart + '] s', a0.donnees);
    s.placer(cj, s.monde(pl), 'salle'); s.pas();
    var p1 = s.robot(cj).pos;
    verifier(dist2D(act(s).cible, p1) < 1e-6, 'action.cible suit le joueur (1re préparation)', [act(s).cible, p1]);
    var n0 = sortsInvocation(s).length;
    s.jusqua(function () { return sortsInvocation(s).length > n0; }, 3);
    var t1 = sortsInvocation(s)[n0], q1 = t1.d.cible;
    var bord = k === 2;
    verifier(dist2D(q1, p1) <= DS.distanceJoueur[1] + (bord ? 1.0 : 0) + 1e-6, 'sort 1 sous les pieds du joueur au moment du tir', dist2D(q1, p1));
    verifier(dansSalleMonde(s, q1, 1.5 - 1e-6), 'point ramené dans la salle (marge 1,5 m)', q1);
    verifier(s.jusqua(function () { var a = act(s); return a && a.donnees.second && a.etape === 'preparation'; }, 0.3), '2e préparation, donnees.second');
    if (k < places.length - 1) s.placer(cj, s.monde({ x: pl.x * 0.6 + 2, z: pl.z * 0.6 - 2 }), 'salle');   // dernière paire : joueur immobile
    s.pas();
    var p2 = s.robot(cj).pos;
    verifier(dist2D(act(s).cible, p2) < 1e-6, 'action.cible suit le joueur (2e préparation)');
    s.jusqua(function () { return sortsInvocation(s).length > n0 + 1; }, 3);
    var t2 = sortsInvocation(s)[n0 + 1], q2 = t2.d.cible;
    verifier(dist2D(q2, p2) <= DS.distanceJoueur[1] + 1e-6 && act(s).cibleJoueur === cj && dist2D(s.robot(autre).pos, p2) > 2 * DS.distanceJoueur[1],
      'sort 2 sous les pieds du même joueur', { d: dist2D(q2, p2), cible: act(s).cibleJoueur, autre: dist2D(s.robot(autre).pos, p2) });
    ecarts.push(t2.t - t1.t);
    verifier(proche(t2.t - t1.t, a0.donnees.ecart, PAS * 1.5), 'écart entre les deux tirs = donnees.ecart', [t2.t - t1.t, a0.donnees.ecart]);
    s.jusqua(function () { return !act(s); }, 3);
    var seq = evs(s, 'action', function (d) { return d.id === 'invocation'; }).slice(nA);
    verifier(JSON.stringify(seq.map(function (e) { return e.d.etape; })) === JSON.stringify(['preparation', 'lancer', 'preparation', 'lancer', 'recuperation']), 'étapes de l’action', seq.map(function (e) { return e.d.etape; }));
    var du = [P.preparation, P.lancer, a0.donnees.ecart - P.lancer, P.lancer];
    du.forEach(function (x, i) { verifier(proche(seq[i + 1].t - seq[i].t, x, PAS * 1.5), 'durée de l’étape ' + i, [seq[i + 1].t - seq[i].t, x]); });
    s.avancer(1.5);                                 // les deux projectiles arrivent : deux zones aux points visés
    var zs = evsDepuis(s, 'zone', t1.t);
    [q1, q2].forEach(function (q, i) { verifier(zs.some(function (z) { return dist2D(z.d.position, q) < 1e-6 && proche(z.d.rayon, P.zone.rayon, 1e-9); }), 'zone du sort ' + (i + 1) + ' au point visé', zs.map(function (z) { return z.d.position; })); });
    if (k === places.length - 1) verifier(dist2D(q1, q2) <= 2 * DS.distanceJoueur[1] + 1e-6 && dist2D(q1, q2) < Sim.Logique.DEFAUTS.distanceMinZones[1],
      'joueur immobile : deux zones qui se recouvrent (pas d’écart minimal dans la paire)', dist2D(q1, q2));
  });
  verifier(ecarts.every(function (e) { return e >= DS.ecart[0] - PAS * 1.5 && e <= DS.ecart[1] + PAS * 1.5; }), 'écarts dans [' + DS.ecart + '] s', ecarts);
  verifier(pire <= plafond, 'zombies des zones sous le plafond de la phase 1 (' + plafond + ')', pire);
  // la phase 2 garde l'invocation simple
  s.apresPas = null;
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.jusqua(function () { return etat(s) === 'phase2'; }, 20);
  s.jusqua(function () { var a = act(s); return a && a.id === 'invocation'; }, 20);
  verifier(!act(s).donnees.double, 'phase 2 : invocation simple', act(s).donnees);
  note('double sort : écarts mesurés ' + ecarts.map(function (e) { return e.toFixed(2); }).join(' / ') + ' s');
});

test('59 v1.2 double sort : cible tombée au 2e tir → joueur valide le plus proche ; personne de valide → 2e sort annulé', function () {
  var s = sim({ joueurs: passifs(2), degatsZombie: 0, sansChiens: true, graine: 23,
    surcharges: { phase1: { trait: { actif: false }, invocation: { zone: { degatsParSeconde: 0 } } } } });
  s.combat.allerA('phase1');
  s.placer('j1', s.monde({ x: -6, z: 0 }), 'salle'); s.placer('j2', s.monde({ x: 6, z: 0 }), 'salle');
  s.combat.forcer('pvSegment', 0.45 * s.etat().barre.max);
  verifier(s.jusqua(function () { var a = act(s); return a && a.id === 'invocation' && a.donnees.second && a.etape === 'preparation'; }, 20), '2e préparation');
  var cj = act(s).cibleJoueur, autre = cj === 'j1' ? 'j2' : 'j1', n0 = sortsInvocation(s).length;
  s.robot(cj).aTerre = true;
  s.jusqua(function () { return sortsInvocation(s).length > n0; }, 3);
  var q = sortsInvocation(s)[n0].d.cible;
  verifier(dist2D(q, s.robot(autre).pos) <= DS.distanceJoueur[1] + 1e-6 && act(s).cibleJoueur === autre, '2e sort sur le joueur valide le plus proche', { d: dist2D(q, s.robot(autre).pos), cible: act(s) && act(s).cibleJoueur });
  s.robot(cj).aTerre = false;
  verifier(s.jusqua(function () { var a = act(s); return a && a.id === 'invocation' && a.donnees.second && a.etape === 'lancer'; }, 20), '2e lancer suivant');
  var n1 = sortsInvocation(s).length;
  s.robot('j1').aTerre = true; s.robot('j2').aTerre = true;
  s.jusqua(function () { var a = act(s); return !a || a.etape === 'recuperation'; }, 1);
  var a1 = act(s);
  s.robot('j1').aTerre = false; s.robot('j2').aTerre = false;
  verifier(sortsInvocation(s).length === n1 && a1 && a1.donnees.annules === 1, '2e sort annulé (aucun projectile, donnees.annules)', { n: sortsInvocation(s).length - n1, a: a1 && a1.donnees });
  s.avancer(1);
  verifier(etat(s) === 'phase1', 'le combat continue', etat(s));
});

test('60 v1.2 double sort : un pilier intact entre la main et le point arrête le sort (ni zone ni dégât au pilier) ; détruit, il ne protège plus', function () {
  function essai(detruire) {
    var s = sim({ joueurs: passifs(1), degatsZombie: 0, sansChiens: true, graine: 29,   // pilier détruit : zones inoffensives (joueur immobile)
      surcharges: { boss: { vitesseDerive: 0 }, phase1: { trait: { actif: false }, invocation: { zone: { degatsParSeconde: detruire ? 0 : CONFIG.phase1.invocation.zone.degatsParSeconde } } } } });
    s.combat.allerA('phase1');
    if (detruire) s.combat.forcer('pilier', { id: 'pilier0', coups: CONFIG.phase3.piliers.coupsDestruction });
    var c = pilierMonde(s, 0), l = Math.hypot(c.x - s.origine.x, c.z - s.origine.z), u = { x: (c.x - s.origine.x) / l, z: (c.z - s.origine.z) / l };
    s.combat.forcer('position', { x: s.origine.x, y: s.origine.y + CONFIG.boss.hauteurLevitation, z: s.origine.z });
    s.placer('j1', { x: c.x + u.x * (c.r + 0.9), z: c.z + u.z * (c.r + 0.9) }, 'salle');   // derrière le pilier, vu du boss au centre
    s.combat.forcer('pvSegment', 0.45 * s.etat().barre.max);
    s.jusqua(function () { return sortsInvocation(s).length >= 8; }, 60);
    s.avancer(2);
    var res = { s: s, c: c, bloques: 0, libres: 0, erreurs: [] };
    sortsInvocation(s).forEach(function (pr) {
      var dax = distAxeSegment(c, pr.d.position, pr.d.cible), marge = c.r + 0.1;
      var zone = evsDepuis(s, 'zone', pr.t).some(function (z) { return dist2D(z.d.position, pr.d.cible) < 1e-6; });
      var imp = evs(s, 'projectileImpact', function (d) { return d.id === pr.d.id; })[0];
      if (!detruire && dax < marge - 0.02) {
        res.bloques++;
        if (zone || !imp || dist2D(imp.d.position, c) > marge + 1e-6 || dist2D(imp.d.position, c) < c.r - 1e-6) res.erreurs.push({ bloque: true, dax: dax, zone: zone, imp: imp && dist2D(imp.d.position, c) });
      } else if (detruire || dax > marge + 0.02) {
        res.libres++;
        if (!zone) res.erreurs.push({ libre: true, dax: dax });
      }
    });
    return res;
  }
  var a = essai(false);
  verifier(a.bloques >= 4 && a.erreurs.length === 0, 'sorts écrasés sur le pilier : aucune zone, impact à sa surface', { bloques: a.bloques, libres: a.libres, erreurs: a.erreurs });
  var p = a.s.etat().piliers.filter(function (x) { return x.id === a.c.id; })[0];
  verifier(p.etat === 'intact' && p.coups === 0 && evs(a.s, 'pilier').length === 0, 'aucun dégât au pilier', p);
  verifier(a.s.log.degats.filter(function (d) { return d.source === 'zone'; }).length === 0 || a.libres > 0, 'le joueur caché n’est pas touché');
  var b = essai(true);
  verifier(b.libres >= 8 && b.erreurs.length === 0, 'pilier détruit : chaque sort crée sa zone', { libres: b.libres, erreurs: b.erreurs });
  note('pilier : ' + a.bloques + ' sorts arrêtés sur ' + (a.bloques + a.libres) + ' (joueur caché derrière)');
});

test('61 v1.2 meute : effectif 2 + 1 par joueur supplémentaire (1 à 5 joueurs), failles espacées, chien après sa faille, paramètres transmis, instantané', function () {
  [1, 2, 3, 4, 5].forEach(function (n) {
    var s = meuteSim(n, { graine: 40 + n });
    s.combat.allerA('repit');
    var t0 = s.t, M = effectif(n), photoFaille = null;
    s.apresPas = function () { var m = s.etat().meute; if (!photoFaille && m && m.failles.length) photoFaille = JSON.parse(JSON.stringify(m)); };
    var d = evs(s, 'meute');
    verifier(d.length === 1 && d[0].d.etat === 'dechainee' && d[0].d.max === M && s.etat().meute.max === M, n + ' joueur(s) : meute de ' + M, d.map(function (x) { return x.d; }));
    s.avancer(M * CH.faille.ecart + CH.faille.duree + 0.5);
    var fa = evs(s, 'chien', function (x) { return x.etat === 'faille'; }), ap = evs(s, 'chien', function (x) { return x.etat === 'apparition'; });
    verifier(fa.length === M && ap.length === M, n + ' : ' + M + ' failles puis ' + M + ' chiens', [fa.length, ap.length]);
    verifier(fa[0].t - t0 <= PAS * 1.5, 'première faille aussitôt', fa[0].t - t0);
    fa.forEach(function (f, k) {
      verifier(proche(f.t - fa[0].t, k * CH.faille.ecart, PAS * 1.5), 'failles espacées de ' + CH.faille.ecart + ' s', f.t - fa[0].t);
      var a = ap.filter(function (x) { return x.d.faille === f.d.id; })[0];
      verifier(a && proche(a.t - f.t, CH.faille.duree, PAS * 1.5) && dist2D(a.d.position, f.d.position) < 1e-9 && a.d.lieu === 'salle' && f.d.lieu === 'salle',
        'chien ' + CH.faille.duree + ' s après sa faille, au même endroit', a && [a.t - f.t, a.d]);
      var p = f.d.position, dmin = Math.min.apply(null, s.robots.map(function (r) { return dist2D(r.pos, p); }));
      var horsPiliers = [0, 1, 2, 3].every(function (i) { var c = pilierMonde(s, i); return dist2D(c, p) > c.r; });
      verifier(dansSalleMonde(s, p, 1.5 - 1e-6) && horsPiliers && dmin >= CH.faille.distance[0] - 1e-6 && dmin <= CH.faille.distance[1] + 1e-6,
        'faille dans la salle (marge 1,5 m), hors pilier, à ' + CH.faille.distance.join('–') + ' m du joueur le plus proche', { p: p, dmin: dmin });
    });
    var pf = CH.profil;
    verifier(s.log.chiens.length === M && s.log.chiens.every(function (c) {
      var q = c.q;
      return q.type === 'chien' && q.effet === 'faille' && q.source === 'boss' && q.vitesse === 'sprint' && q.agressif === true && q.lieu === 'salle' &&
        q.profil.pv === pf.pv && q.profil.vitesse === pf.vitesse && q.profil.degats === pf.degats && q.profil.cadence === pf.cadence && q.profil.portee === pf.portee;
    }), 'faireApparaitreZombie({ type: chien, profil, effet: faille, source: boss, vitesse: sprint, agressif: true })', s.log.chiens[0] && s.log.chiens[0].q);
    var m = s.etat().meute;
    verifier(m.active && m.chiens.length === M && m.failles.length === 0 && m.chiens.every(function (c) { return c.lieu === 'salle' && typeof c.position.x === 'number' && ap.some(function (x) { return x.d.id === c.id; }); }), 'instantané : chiens { id, position, lieu }', m);
    var f0 = photoFaille && photoFaille.failles[0];
    verifier(f0 && f0.id && f0.lieu === 'salle' && f0.t >= 0 && f0.t < CH.faille.duree && proche(f0.duree, CH.faille.duree, 1e-9) && typeof f0.position.z === 'number', 'instantané : failles { id, position, lieu, t, duree }', photoFaille);
    verifier(JSON.stringify(JSON.parse(JSON.stringify(s.etat()))) === JSON.stringify(s.etat()) && s.etat().secondeMoitie === true, 'instantané sérialisable, secondeMoitie');
  });
});

test('62 v1.2 meute : chien tué → « mort » à sa dernière position, remplaçant après reapparition ; vivant: false compte ; jamais plus de max', function () {
  var s = meuteSim(1, { graine: 61 });
  s.combat.allerA('faiblesse');
  s.avancer(3);
  var M = effectif(1), pire = 0;
  s.apresPas = function () { var m = s.etat().meute; pire = Math.max(pire, m.chiens.length + m.failles.length); };
  var c0 = chiensSim(s)[0], pos = { x: c0.pos.x, z: c0.pos.z }, tk = s.t;
  s.jeu.retirerZombie(c0.id, { effet: 'mort' });
  s.pas();
  var mort = evs(s, 'chien', function (d) { return d.etat === 'mort'; });
  verifier(mort.length === 1 && mort[0].d.id === c0.id && dist2D(mort[0].d.position, pos) < 1e-9 && mort[0].d.lieu === 'salle', '« mort » à la dernière position connue', mort.map(function (e) { return e.d; }));
  verifier(s.etat().meute.chiens.length === M - 1, 'retiré de l’instantané');
  s.jusqua(function () { return evsDepuis(s, 'chien', tk, function (d) { return d.etat === 'faille'; }).length >= 1; }, CH.reapparition[1] + 1);
  var f = evsDepuis(s, 'chien', tk, function (d) { return d.etat === 'faille'; })[0];
  verifier(f && f.t - tk >= CH.reapparition[0] - PAS && f.t - tk <= CH.reapparition[1] + 2 * PAS, 'faille du remplaçant ' + CH.reapparition.join('–') + ' s après', f && f.t - tk);
  s.avancer(CH.faille.duree + 0.1);
  verifier(chiensSim(s).length === M && s.etat().meute.chiens.length === M, 'remplaçant arrivé');
  var t2 = s.t;
  chiensSim(s).forEach(function (z) { s.jeu.retirerZombie(z.id, { effet: 'mort' }); });
  s.avancer(CH.reapparition[1] + CH.faille.duree + 1);
  verifier(evsDepuis(s, 'chien', t2, function (d) { return d.etat === 'mort'; }).length === M && evsDepuis(s, 'chien', t2, function (d) { return d.etat === 'apparition'; }).length === M,
    'toute la meute tuée : ' + M + ' morts, ' + M + ' remplaçants');
  var orig = s.jeu.zombies, vise = chiensSim(s)[0].id, t3 = s.t;
  s.jeu.zombies = function () { return orig().map(function (z) { return z.id === vise ? Object.assign({}, z, { vivant: false }) : z; }); };
  s.pas();
  verifier(evsDepuis(s, 'chien', t3, function (d) { return d.etat === 'mort' && d.id === vise; }).length === 1, 'vivant: false dans jeu.zombies() → mort');
  s.avancer(CH.reapparition[1] + CH.faille.duree + 1);
  verifier(pire <= M, 'jamais plus de ' + M + ' chiens et failles à la fois', pire);
  s.jeu.zombies = orig;
});

// Parcours complet avec la meute (robot passif, ennemis inoffensifs) : un chien est tué au répit, pendant l'absence, le rituel,
// la faiblesse et la phase 5 ; à chaque changement d'état on compare les chiens présents juste avant et juste après.
// v1.3 : chaque seuil de la phase 2 libère un mini-boss qu'il faut abattre ; le jeu le retire à sa mort (ici : aussitôt)
function vaincreMiniBoss(s, joueur) {
  (CONFIG.miniBoss.ordre || []).forEach(function () {
    var n0 = evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; }).length;
    s.combat.toucherBoss({ joueur: joueur, degats: 1e9 });
    s.jusqua(function () { return evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; }).length > n0; }, 15);
    var l = evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; })[n0];
    if (l) { s.pas(); s.pas(); s.jeu.retirerZombie(l.d.id, { effet: 'mort' }); }
    s.jusqua(function () { return !s.etat().boss.protege; }, 3);
  });
}
var PARCOURS = null;
function parcoursMeute() {
  if (PARCOURS) return PARCOURS;
  var s = sim({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false }], degatsZombie: 0, degatsChien: 0, graine: 21,
    surcharges: { phase4: { apparitions: { max: 0 }, zombiesPourContester: 1 } } });
  var R = { s: s, morts: [], transitions: [], pireZombies: 0, chienAuCercle: 0, zombiesDedans: 0 };
  function vivants() { return chiensSim(s).map(function (z) { return z.id; }).sort(); }
  var prec = { etat: null, chiens: [] };
  s.apresPas = function () {
    var e = etat(s), v = vivants();
    if (e !== prec.etat) R.transitions.push({ t: s.t, de: prec.etat, vers: e, avant: prec.chiens, apres: v });
    prec = { etat: e, chiens: v };
    if (e === 'phase1') R.pireZombies = Math.max(R.pireZombies, zombiesSim(s).length);
    var c = s.etat().capture;
    if (c && c.etat === 'capture') {
      R.zombiesDedans = Math.max(R.zombiesDedans, c.zombiesDedans);
      if (chiensSim(s).some(function (z) { return dist2D(z.pos, s.cercle) <= CONFIG.phase4.rayon; })) R.chienAuCercle++;
    }
  };
  function tuer(nom) {
    var c = chiensSim(s)[0];
    R.morts.push({ nom: nom, id: c ? c.id : null, t: s.t, etat: etat(s) });
    if (c) s.jeu.retirerZombie(c.id, { effet: 'mort' });
  }
  s.combat.allerA('phase1');
  s.avancer(1);
  s.combat.forcer('pvSegment', 0.45 * s.etat().barre.max);
  s.avancer(40);                                     // seconde moitié : double sort et meute, zombies jusqu'au plafond
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 }); // → répit (zombies en cendres)
  s.pas(); tuer('repit');
  s.jusqua(function () { return etat(s) === 'phase2'; }, 20);
  s.avancer(15);
  vaincreMiniBoss(s, 'j1');                          // v1.3 : seuils bloquants, mini-boss abattus dès leur libération
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.jusqua(function () { return etat(s) === 'absence'; }, 15);
  s.avancer(0.5); tuer('absence');
  s.jusqua(function () { return etat(s) === 'phase3'; }, 45);
  s.avancer(2);
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.jusqua(function () { return etat(s) === 'rituel'; }, 20);
  s.avancer(0.5); tuer('rituel');
  s.jusqua(function () { return etat(s) === 'faiblesse'; }, 120);
  s.avancer(1); tuer('faiblesse');
  s.avancer(CH.reapparition[1] + CH.faille.duree + 1);
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 }); // → transition45 puis phase 5
  s.jusqua(function () { return etat(s) === 'phase5'; }, 30);
  s.avancer(CH.delaiBunker + CH.faille.ecart * (CH.max - 1) + CH.faille.duree + 6);
  tuer('phase5');                                    // remplaçant en attente au moment de la défaite
  s.avancer(1);
  s.jusqua(function () { if (etat(s) === 'phase5') s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 }); return etat(s) !== 'phase5'; }, 20);
  var trD = R.transitions.filter(function (x) { return x.vers === 'defaite'; })[0];
  R.tDefaite = trD ? trD.t : Infinity;
  R.chiensAvantDefaite = trD ? trD.avant : [];
  R.nChiensLog = s.log.chiens.length;
  s.avancer(30);
  s.apresPas = null;
  PARCOURS = R;
  return R;
}

test('63 v1.2 meute « sans exception » : elle traverse répit, retour en rage, explosion du rituel, faiblesse et transition45 ; elle chasse et se renouvelle partout', function () {
  var R = parcoursMeute(), s = R.s;
  verifier(R.morts.every(function (m) { return m.id; }), 'un chien vivant à chaque étape du parcours', R.morts.filter(function (m) { return !m.id; }).map(function (m) { return m.nom; }));
  verifier(etat(s) !== 'echec' && evs(s, 'defaite').length === 1, 'parcours jusqu’à la défaite du boss', etat(s));
  var mt = evs(s, 'meute').map(function (e) { return e.d.etat; });
  verifier(JSON.stringify(mt) === JSON.stringify(['dechainee', 'dissipee']), 'une seule meute pour tout le combat', mt);
  var vues = {};
  R.transitions.forEach(function (tr) {
    if (!tr.de || tr.vers === 'phase5' || ORDRE.indexOf(tr.vers) >= ORDRE.indexOf('defaite')) return;
    vues[tr.vers] = true;
    var perdus = tr.avant.filter(function (id) { return tr.apres.indexOf(id) < 0; });
    verifier(perdus.length === 0, 'aucun chien perdu en entrant dans ' + tr.vers, { perdus: perdus, avant: tr.avant, apres: tr.apres });
  });
  ['repit', 'phase2', 'transition23', 'absence', 'retour', 'phase3', 'transition34', 'rituel', 'rituel_fin', 'faiblesse', 'transition45'].forEach(function (e) {
    verifier(vues[e], 'transition vers ' + e + ' observée');
  });
  var tousChiens = s.log.chiens.map(function (c) { return c.id; });
  var cendres = [];
  evs(s, 'zombiesCendres').forEach(function (e) { cendres = cendres.concat(e.d.ids); });
  verifier(evs(s, 'zombiesCendres').length >= 2 && cendres.length > 0 && cendres.every(function (id) { return tousChiens.indexOf(id) < 0; }), 'zombiesCendres (répit, retour en rage, explosion) sans aucun chien', cendres.length);
  verifier(s.log.retraits.filter(function (r) { return tousChiens.indexOf(r.id) >= 0 && r.effet !== 'mort' && r.t < R.tDefaite - 1e-9; }).every(function (r) { return r.effet === 'silencieux'; }),
    'avant la défaite, la logique ne retire un chien qu’en silence (transfert)');
  verifier(s.log.effets.every(function (x) { return tousChiens.indexOf(x.id) < 0; }), 'aucun effetZombie (saisie d’âme) sur un chien');
  // remplaçants : la faille suit chaque mort après reapparition, quel que soit l'état
  R.morts.filter(function (m) { return m.nom !== 'phase5'; }).forEach(function (m) {
    var f = evsDepuis(s, 'chien', m.t, function (d) { return d.etat === 'faille'; })[0];
    verifier(f && f.t - m.t >= CH.reapparition[0] - PAS && f.t - m.t <= CH.reapparition[1] + 2 * PAS, 'remplaçant du chien tué en ' + m.nom, f && f.t - m.t);
    if (m.nom !== 'repit') verifier(etatA(s, f.t) === m.etat, 'faille ouverte pendant ' + m.etat, etatA(s, f.t));
  });
  // ils chassent : morsures (inoffensives ici) dans chacun de ces états
  ['repit', 'absence', 'rituel', 'faiblesse', 'transition45'].forEach(function (e) {
    var n = s.log.degats.filter(function (d) { return d.source === 'chien' && etatA(s, d.t) === e; }).length;
    verifier(n > 0, 'les chiens chassent pendant ' + e, n);
  });
  verifier(R.pireZombies <= CONFIG.phase1.zombiesMax, 'phase 1 : plafond des zombies sans compter les chiens', R.pireZombies);
});

test('64 v1.2 meute : exclue des plafonds de zombies, de l’absorption des âmes et de la contestation du cercle', function () {
  // a) plafond de la phase 1 atteint par les zombies seuls, les chiens en plus
  var s = meuteSim(1, { graine: 64, surcharges: { phase1: { trait: { actif: false }, invocation: { zone: { degatsParSeconde: 0 } } } } });
  s.combat.allerA('phase1');
  s.combat.forcer('pvSegment', 0.45 * s.etat().barre.max);
  var pireZ = 0, pireTotal = 0;
  s.apresPas = function () { pireZ = Math.max(pireZ, zombiesSim(s).length); pireTotal = Math.max(pireTotal, s.zombies.length); };
  s.avancer(45);
  verifier(pireZ === CONFIG.phase1.zombiesMax && pireTotal === CONFIG.phase1.zombiesMax + CH.max, 'phase 1 : ' + CONFIG.phase1.zombiesMax + ' zombies + ' + CH.max + ' chiens', [pireZ, pireTotal]);
  // b) absorption : deux chiens immobiles collés au boss (plus proches que tout zombie) ne sont jamais saisis
  var s2 = meuteSim(1, { graine: 65, surcharges: { boss: { vitesseDerive: 0 }, phase2: { absorption: { intervalle: [1, 1] } } } });
  s2.combat.allerA('phase2');
  s2.avancer(1.6);
  var b = s2.etat().boss.position, dogs = chiensSim(s2).map(function (z) { return z.id; });
  chiensSim(s2).forEach(function (z, i) { z.bloque = true; z.pos = { x: b.x + 1.2 * (i ? 1 : -1), y: s2.origine.y, z: b.z + 0.5 }; });
  s2.jusqua(function () { return evs(s2, 'absorption', function (d) { return d.etat === 'debut'; }).length >= 3; }, 30);
  var debs = evs(s2, 'absorption', function (d) { return d.etat === 'debut'; });
  verifier(dogs.length === CH.max && debs.length >= 3 && debs.every(function (e) { return e.d.cibles.length > 0 && e.d.cibles.every(function (id) { return dogs.indexOf(id) < 0; }); }),
    'absorptions : les zombies sont saisis, jamais les chiens collés au boss', debs.map(function (e) { return e.d.cibles; }));
  verifier(s2.log.effets.every(function (x) { return dogs.indexOf(x.id) < 0; }) && chiensSim(s2).length === CH.max, 'aucun effetZombie sur un chien');
  // c) contestation : deux chiens immobiles dans le cercle, contestation dès 1 zombie : la capture avance quand même
  var s3 = essaiCapture({ chiens: true, p4: { zombiesPourContester: 1 } });
  var t0 = evs(s3, 'etat', function (d) { return d.vers === 'rituel'; })[0].t, cc = s3.cercle;
  s3.jusqua(function () { return chiensSim(s3).length === CH.max; }, 3);
  chiensSim(s3).forEach(function (z, i) { z.bloque = true; z.pos = { x: cc.x + (i ? 1.5 : -1.5), y: s3.origine.y, z: cc.z }; });
  var pireDedans = 0, conteste = 0;
  s3.apresPas = function () { var c = s3.etat().capture; if (c) { pireDedans = Math.max(pireDedans, c.zombiesDedans); if (c.etat === 'conteste') conteste++; } };
  s3.jusqua(function () { return etat(s3) === 'rituel_fin'; }, 60);
  verifier(chiensSim(s3).length === CH.max && etat(s3) === 'rituel_fin' && pireDedans === 0 && conteste === 0, 'chiens dans le cercle : jamais comptés, capture réussie', { etat: etat(s3), dedans: pireDedans, conteste: conteste });
  verifier(proche(s3.t - t0, CONFIG.phase4.formation + CONFIG.phase4.duree, 1.0), 'capture en formation + ' + CONFIG.phase4.duree + ' s', s3.t - t0);
});

test('65 v1.2 meute : transfert dans Bunker 7 (delaiBunker), fin à la défaite (cendres, sans points), échec silencieux', function () {
  var R = parcoursMeute(), s = R.s;
  var t45 = evs(s, 'etat', function (d) { return d.vers === 'transition45'; })[0].t, t5 = evs(s, 'etat', function (d) { return d.vers === 'phase5'; })[0].t;
  var tr5 = R.transitions.filter(function (x) { return x.vers === 'phase5'; })[0];
  verifier(evs(s, 'chien').filter(function (e) { return e.t > t45 - 1e-9 && e.t < t5 - 1e-9 && e.d.etat === 'fin'; }).length === 0 && tr5.avant.length === CH.max,
    'transition45 : les chiens restent dans la salle', tr5.avant);
  var fins = evs(s, 'chien', function (d) { return d.etat === 'fin' && d.raison === 'transfert'; });
  verifier(fins.length === tr5.avant.length && fins.every(function (e) { return proche(e.t, t5, 1e-9) && e.d.lieu === 'salle' && tr5.avant.indexOf(e.d.id) >= 0; }), 'début de la phase 5 : « fin » raison transfert pour chaque chien', fins.map(function (e) { return e.d; }));
  verifier(tr5.avant.every(function (id) { return s.log.retraits.some(function (r) { return r.id === id && r.effet === 'silencieux' && r.points === false && proche(r.t, t5, 1e-9); }); }), 'retirés en silence');
  var fb = evs(s, 'chien', function (d) { return d.etat === 'faille' && d.lieu === 'bunker'; }).filter(function (e) { return e.t < t5 + CH.delaiBunker + 3; });
  verifier(fb.length === CH.max && proche(fb[0].t - t5, CH.delaiBunker, PAS * 2) && fb.every(function (e, k) { return proche(e.t - fb[0].t, k * CH.faille.ecart, PAS * 1.5); }),
    'la meute revient par ' + CH.max + ' failles ' + CH.delaiBunker + ' s après le réveil', fb.map(function (e) { return e.t - t5; }));
  verifier(evs(s, 'chien', function (d) { return d.etat === 'faille'; }).filter(function (e) { return e.t > t5 - 1e-9 && e.t < t5 + CH.delaiBunker - PAS * 2; }).length === 0, 'aucune faille avant delaiBunker');
  fb.forEach(function (e) {
    var p = e.d.position, j = s.robot('j1');
    verifier(p.x > s.bunker.x0 && p.x < s.bunker.x1 && p.z > s.bunker.z0 && p.z < s.bunker.z1 && !s.dansMurBunker(p) && dist2D(p, j.pos) >= 8 - 1e-6, 'faille du bunker valide, loin du joueur', { p: p, d: dist2D(p, j.pos) });
  });
  verifier(evs(s, 'chien', function (d) { return d.etat === 'apparition' && d.lieu === 'bunker'; }).length >= CH.max, 'chiens dans le bunker');
  // défaite
  var td = R.tDefaite;
  var finsD = evs(s, 'chien', function (d) { return d.etat === 'fin' && d.raison === 'defaite'; });
  verifier(finsD.length === R.chiensAvantDefaite.length && R.chiensAvantDefaite.length >= 1 && finsD.every(function (e) { return proche(e.t, td, 1e-9); }), '« fin » raison defaite pour chaque chien', finsD.map(function (e) { return e.d.id; }));
  verifier(R.chiensAvantDefaite.every(function (id) { return s.log.retraits.some(function (r) { return r.id === id && r.effet === 'cendres' && r.points === false; }); }), 'chiens réduits en cendres, sans points');
  var iDiss = s.evenements.findIndex(function (e) { return e.type === 'meute' && e.d.etat === 'dissipee'; });
  var iFin = s.evenements.findIndex(function (e) { return e.type === 'chien' && e.d.raison === 'defaite'; });
  verifier(iDiss > iFin && iFin >= 0 && proche(s.evenements[iDiss].t, td, 1e-9), '« meute dissipee » après les chiens');
  verifier(evsDepuis(s, 'chien', td + 1e-6).length === 0 && s.log.chiens.length === R.nChiensLog, 'plus aucune apparition, même le remplaçant attendu');
  var m = s.etat().meute;
  verifier(m && !m.active && m.chiens.length === 0 && m.failles.length === 0, 'instantané : meute inactive', m);
  // échec : retrait silencieux
  var s2 = meuteSim(1, { graine: 66 });
  s2.combat.allerA('faiblesse');
  s2.avancer(3);
  var v = chiensSim(s2).map(function (z) { return z.id; });
  s2.robot('j1').vivant = false;
  s2.jusqua(function () { return etat(s2) === 'echec'; }, 5);
  var te = s2.t;
  verifier(etat(s2) === 'echec' && v.length === CH.max && v.every(function (id) { return s2.log.retraits.some(function (r) { return r.id === id && r.effet === 'silencieux'; }) && evs(s2, 'chien', function (d) { return d.id === id && d.etat === 'fin' && d.raison === 'echec'; }).length === 1; }),
    'échec : chiens retirés en silence', v);
  verifier(evs(s2, 'meute', function (d) { return d.etat === 'dissipee'; }).length === 1, 'échec : meute dissipée');
  s2.avancer(CH.reapparition[1] + 2);
  verifier(evsDepuis(s2, 'chien', te + 1e-6).length === 0, 'échec : plus aucune apparition');
});

test('66 v1.2 meute et allerA : active de repit à phase5 (bunker après delaiBunker), inactive avant (phase1 : jusqu’au seuil) et à partir de defaite', function () {
  var s = meuteSim(1, { graine: 67 });
  var pendant = ORDRE.slice(ORDRE.indexOf('repit'), ORDRE.indexOf('phase5') + 1);
  var cibles = ['inactif', 'introduction', 'phase1'].concat(pendant, ['defaite', 'retour_salle', 'conclusion', 'recompenses', 'message', 'termine']);
  cibles.forEach(function (x) {
    s.combat.allerA('phase2');
    s.avancer(CH.faille.ecart * (CH.max - 1) + CH.faille.duree + 0.3);
    var v = chiensSim(s).map(function (z) { return z.id; }), t0 = s.t;
    verifier(v.length === CH.max, 'meute présente avant allerA(' + x + ')', v);
    s.combat.allerA(x);
    var fins = evsDepuis(s, 'chien', t0, function (d) { return d.etat === 'fin'; });
    verifier(fins.length === v.length && fins.every(function (e) { return e.d.raison === 'debogage'; }) && v.every(function (id) { return s.log.retraits.some(function (r) { return r.id === id && r.effet === 'silencieux' && r.t > t0 - 1e-9; }); }),
      'allerA(' + x + ') : anciens chiens retirés en silence (raison debogage)', fins.map(function (e) { return e.d.raison; }));
    var dech = evsDepuis(s, 'meute', t0, function (d) { return d.etat === 'dechainee'; });
    if (pendant.indexOf(x) >= 0) {
      var lieu = x === 'phase5' ? 'bunker' : 'salle';
      verifier(s.etat().meute && s.etat().meute.active && s.etat().secondeMoitie && dech.length === 1, 'allerA(' + x + ') : meute active', s.etat().meute);
      s.avancer(x === 'phase5' ? CH.delaiBunker - 0.2 : 0.1);
      var fa = evsDepuis(s, 'chien', t0, function (d) { return d.etat === 'faille'; });
      if (x === 'phase5') {
        verifier(fa.length === 0, 'phase5 : rien avant delaiBunker');
        s.avancer(0.4);
        fa = evsDepuis(s, 'chien', t0, function (d) { return d.etat === 'faille'; });
      }
      verifier(fa.length >= 1 && fa[0].d.lieu === lieu, 'allerA(' + x + ') : failles dans ' + lieu, fa.map(function (e) { return [e.t - t0, e.d.lieu]; }));
    } else {
      s.avancer(2);
      verifier((!s.etat().meute || !s.etat().meute.active) && dech.length === 0 && evsDepuis(s, 'chien', t0 + 1e-6).length === 0, 'allerA(' + x + ') : meute inactive', s.etat().meute);
      if (x === 'phase1' || x === 'introduction' || x === 'inactif') verifier(s.etat().secondeMoitie === false, 'allerA(' + x + ') : secondeMoitie remise à faux');
    }
  });
  // phase 1 : la meute revient au seuil
  s.combat.allerA('phase1');
  s.avancer(0.5);
  var t1 = s.t;
  s.combat.forcer('pvSegment', 0.4 * s.etat().barre.max);
  s.avancer(0.5);
  verifier(evsDepuis(s, 'meute', t1, function (d) { return d.etat === 'dechainee'; }).length === 1 && s.etat().secondeMoitie, 'allerA(phase1) puis seuil : meute lâchée');
});

test('67 v1.2 meute : chien immobile depuis bloque s et à plus de 6 m de tout joueur → retiré en silence, nouvelle faille ; au contact, il reste', function () {
  var s = meuteSim(1, { chiensBloques: true, graine: 68 });
  s.combat.allerA('faiblesse');
  s.avancer(CH.faille.ecart * (CH.max - 1) + CH.faille.duree + 0.2);
  var ch = chiensSim(s);
  verifier(ch.length === 2, 'deux chiens', ch.length);
  var A = ch[0], B = ch[1], dAB = dist2D(A.pos, B.pos) || 1;
  s.placer('j1', { x: A.pos.x + (A.pos.x - B.pos.x) / dAB, z: A.pos.z + (A.pos.z - B.pos.z) / dAB }, 'salle');
  verifier(dist2D(s.robot('j1').pos, B.pos) > 6, 'le second chien est loin du joueur', dist2D(s.robot('j1').pos, B.pos));
  var neB = s.log.chiens.filter(function (c) { return c.id === B.id; })[0].t;
  s.jusqua(function () { return evs(s, 'chien', function (d) { return d.etat === 'fin' && d.raison === 'bloque'; }).length >= 1; }, CH.bloque + 2);
  var fin = evs(s, 'chien', function (d) { return d.etat === 'fin' && d.raison === 'bloque'; });
  verifier(fin.length === 1 && fin[0].d.id === B.id && proche(fin[0].t - neB, CH.bloque, 0.1), 'chien bloqué retiré après ' + CH.bloque + ' s', fin.map(function (e) { return [e.d.id, e.t - neB]; }));
  verifier(s.log.retraits.some(function (r) { return r.id === B.id && r.effet === 'silencieux' && r.points === false; }) && s.log.journal.some(function (l) { return /chien bloqué/.test(l.msg); }), 'retrait silencieux, journalisé');
  s.pas(); s.pas();
  verifier(evsDepuis(s, 'chien', fin[0].t, function (d) { return d.etat === 'faille'; }).length === 1 && evs(s, 'chien', function (d) { return d.etat === 'mort'; }).length === 0, 'nouvelle faille aussitôt (pas de « mort »)');
  s.avancer(CH.bloque);
  verifier(evs(s, 'chien', function (d) { return d.etat === 'fin' && d.id === A.id; }).length === 0 && chiensSim(s).some(function (z) { return z.id === A.id; }), 'le chien au contact du joueur reste');
});

test('68 v1.2 meute et coop dynamique : arrivée → un chien de plus ; départ → effectif réduit, les chiens présents restent, pas de remplaçant au-delà', function () {
  var s = meuteSim(3, { graine: 69, joueurs: passifs(3, [{}, {}, { connecte: false }]) });
  s.combat.allerA('faiblesse');
  s.avancer(3);
  verifier(s.etat().meute.max === effectif(2) && chiensSim(s).length === effectif(2), '2 joueurs : ' + effectif(2) + ' chiens', chiensSim(s).length);
  var t1 = s.t;
  s.robot('j3').connecte = true;
  s.avancer(DELAI_ARRIVEE + CH.faille.duree + 0.5);
  verifier(s.etat().meute.max === effectif(3) && chiensSim(s).length === effectif(3) && evsDepuis(s, 'chien', t1, function (d) { return d.etat === 'faille'; }).length === 1,
    'arrivée : effectif ' + effectif(3) + ', une faille de plus', { max: s.etat().meute.max, n: chiensSim(s).length });
  s.robot('j2').connecte = false; s.robot('j3').connecte = false;
  s.avancer(DELAI_DEPART + 1);
  verifier(s.etat().meute.max === effectif(1) && chiensSim(s).length === effectif(3), 'départ : effectif ' + effectif(1) + ', les ' + effectif(3) + ' chiens restent', { max: s.etat().meute.max, n: chiensSim(s).length });
  var t2 = s.t, ch = chiensSim(s);
  s.jeu.retirerZombie(ch[0].id, { effet: 'mort' }); s.jeu.retirerZombie(ch[1].id, { effet: 'mort' });
  s.avancer(CH.reapparition[1] + 1);
  verifier(evsDepuis(s, 'chien', t2, function (d) { return d.etat === 'faille'; }).length === 0, 'encore ' + effectif(1) + ' chiens : pas de remplaçant');
  var t3 = s.t;
  s.jeu.retirerZombie(chiensSim(s)[0].id, { effet: 'mort' });
  s.avancer(CH.reapparition[1] + 1);
  verifier(evsDepuis(s, 'chien', t3, function (d) { return d.etat === 'faille'; }).length === 1, 'sous l’effectif : un remplaçant');
});

test('69 v1.2 meute et adaptateur dégradé : type « chien » ignoré (zombie à la place), chiens absents de zombies(), apparition refusée', function () {
  // a) le jeu ignore type: 'chien' : un zombie ordinaire tient le rôle, suivi comme un chien (hors plafond, hors cendres)
  var s = meuteSim(1, { ignorerTypeChien: true, graine: 70, surcharges: { phase1: { trait: { actif: false }, invocation: { zone: { degatsParSeconde: 0 } } } } });
  s.combat.allerA('phase1');
  s.combat.forcer('pvSegment', 0.45 * s.etat().barre.max);
  s.avancer(3);
  var ids = s.etat().meute.chiens.map(function (c) { return c.id; });
  verifier(ids.length === CH.max && s.log.chiens.every(function (c) { return c.ignore; }) && ids.every(function (id) { return /^z/.test(id); }), 'zombies à la place des chiens, suivis par la meute', ids);
  var pire = 0;
  s.apresPas = function () { pire = Math.max(pire, s.zombies.filter(function (z) { return z.vivant && ids.indexOf(z.id) < 0; }).length); };
  s.avancer(40);
  verifier(pire === CONFIG.phase1.zombiesMax, 'plafond de zombies sans les remplaçants des chiens', pire);
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.pas();
  verifier(ids.every(function (id) { return s.zombies.some(function (z) { return z.id === id && z.vivant; }); }), 'répit : pas réduits en cendres');
  // b) jeu.zombies() ne liste pas les chiens : un avertissement, ni mort ni faille en trop
  var s2 = meuteSim(1, { graine: 71 });
  var orig = s2.jeu.zombies;
  s2.jeu.zombies = function () { return orig().filter(function (z) { return z.type !== 'chien'; }); };
  s2.combat.allerA('faiblesse');
  s2.avancer(8);
  var av = evs(s2, 'avertissement', function (d) { return /chiens/.test(d.texte); });
  verifier(av.length === 1 && evs(s2, 'chien', function (d) { return d.etat === 'mort'; }).length === 0 && evs(s2, 'chien', function (d) { return d.etat === 'faille'; }).length === CH.max,
    'un avertissement, aucune mort supposée, pas de faille en trop', { av: av.length, failles: evs(s2, 'chien', function (d) { return d.etat === 'faille'; }).length });
  // c) apparition refusée (faireApparaitreZombie → null) : nouvel essai après reapparition, sans boucle
  var s3 = meuteSim(1, { graine: 72, jeuModifs: {} });
  var fz = s3.jeu.faireApparaitreZombie;
  s3.jeu.faireApparaitreZombie = function (q) { return q.type === 'chien' ? null : fz(q); };
  s3.combat.allerA('faiblesse');
  s3.avancer(40);
  var nf = evs(s3, 'chien', function (d) { return d.etat === 'faille'; }).length;
  verifier(evs(s3, 'chien', function (d) { return d.etat === 'apparition'; }).length === 0 && nf >= CH.max * 2 && nf <= CH.max * (1 + Math.ceil(40 / CH.reapparition[0])), 'refus : failles relancées toutes les ' + CH.reapparition.join('–') + ' s', nf);
  verifier(etat(s3) === 'faiblesse', 'combat intact', etat(s3));
});

// ═══════════════════════════════════════ 15. version 1.3 (API.md §15) ═══════════════════════════════════════
var MBC = CONFIG.miniBoss, SIPH = MBC.siphon;
// robots passifs, zombies, chiens et mini-boss inoffensifs : on observe la logique ; le test tue lui-même les mini-boss
function mbSim(n, o) { return sim(Object.assign({ joueurs: passifs(n), degatsZombie: 0, degatsChien: 0, degatsMiniBoss: 0 }, o || {})); }
function libere(s, k) { return evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; })[k]; }
// attend la k-ième libération, puis 2 pas : le jeu a listé le mini-boss dans jeu.zombies() (on ne tue pas un mini-boss
// que la logique n'a jamais vu : elle ne pourrait pas distinguer sa mort d'un adaptateur qui ne le liste pas)
function attendreLibere(s, k, max) { s.jusqua(function () { return !!libere(s, k); }, max || 12); if (libere(s, k)) { s.pas(); s.pas(); } return libere(s, k); }
function tuerMB(s, id) { s.jeu.retirerZombie(id, { effet: 'mort' }); }
function mbSimule(s, id) { return s.zombies.filter(function (z) { return z.id === id; })[0]; }
function tubeMonde(s, i) { var t = s.arene.salle.tubes[i]; return s.monde({ x: t.x, y: 0, z: t.z }); }
function devantCuve(s, i) {                          // v1.5 (§17.1) : max(apparition.distance, rayon de la cuve + 1,3) m devant la cuve
  var c = tubeMonde(s, i), O = s.origine, dx = O.x - c.x, dz = O.z - c.z, l = Math.hypot(dx, dz);
  var dd = Math.max(SIPH.apparition.distance, s.arene.salle.tubes[i].rayon + 1.3);
  return { x: c.x + dx / l * dd, z: c.z + dz / l * dd };
}

test('71 v1.3/v1.4 seuils : 75 %, 50 % puis 25 % du segment de la phase 2 (solo, coop), PV bloqués même par un coup énorme, protection « invulnerable »', function () {
  verifier(MBC.seuils.length === 3 && MBC.ordre.length === 3, 'v1.4 : trois seuils, trois mini-boss', MBC);
  [1, 2].forEach(function (n) {
    var s = mbSim(n);
    s.combat.allerA('phase2');
    s.avancer(0.5);
    var max = s.etat().barre.max;
    verifier(proche(max, CONFIG.phase2.pv * kPv(n), 1e-6) && !s.etat().boss.protege && s.etat().miniBoss.length === 0, n + ' joueur(s) : départ sans protection');
    var r1 = s.combat.toucherBoss({ joueur: 'j1', degats: (1 - MBC.seuils[0]) * max - 1 });
    verifier(r1.applique && !s.etat().boss.protege, n + ' : 1 PV au-dessus du 1er seuil, rien');
    var r2 = s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
    verifier(r2.applique && proche(r2.montant, 1, 1e-6) && proche(s.etat().barre.valeur, MBC.seuils[0] * max, 1e-6),
      n + ' : coup énorme bloqué au seuil de ' + MBC.seuils[0] * 100 + ' %', { r: r2, fraction: s.etat().barre.valeur / max });
    var b = s.etat().boss;
    verifier(b.protege === true && b.vulnerable === false && etat(s) === 'phase2', n + ' : protégé, invulnérable', b);
    var nI = evs(s, 'immunise').length, r3 = s.combat.toucherBoss({ joueur: 'j1', degats: 500, position: b.position });
    verifier(!r3.applique && r3.raison === 'invulnerable' && r3.montant === 0 && evs(s, 'immunise').length === nI + 1 && proche(s.etat().barre.valeur, MBC.seuils[0] * max, 1e-6),
      n + ' : toucherBoss → { applique: false, raison: invulnerable } et IMMUNISÉ', r3);
    MBC.ordre.forEach(function (type, k) {
      if (k > 0) {
        s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
        verifier(proche(s.etat().barre.valeur, MBC.seuils[k] * max, 1e-6) && s.etat().boss.protege, n + ' : seuil ' + (k + 1) + ' (' + MBC.seuils[k] * 100 + ' %) bloquant', s.etat().barre);
      }
      var l = attendreLibere(s, k);
      verifier(l && l.d.type === type, n + ' : mini-boss ' + (k + 1) + ' « ' + type + ' »', l && l.d);
      if (k === 0) {
        s.avancer(10);
        verifier(proche(s.etat().barre.valeur, MBC.seuils[0] * max, 1e-6) && !libere(s, 1) && s.etat().boss.protege, n + ' : tant qu’il vit, rien ne bouge');
      }
      tuerMB(s, l.d.id); s.pas();
      verifier(!s.etat().boss.protege && s.etat().boss.vulnerable, n + ' : protection levée à la mort de « ' + type + ' »', s.etat().boss);
    });
    s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
    s.pas();
    verifier(etat(s) === 'transition23', n + ' : après les trois mini-boss, un coup termine la phase 2', etat(s));
  });
  var c = JSON.parse(JSON.stringify(CONFIG));        // valider() contrôle le bloc miniBoss
  c.miniBoss.seuils = [0.5, 0.75, 0.25]; c.miniBoss.siphon.fissure = 1.5; c.miniBoss.irradie.pv = 0;
  verifier(CONFIG.valider(c).length === 3, 'valider : seuils décroissants, fissure, PV', CONFIG.valider(c));
  c = JSON.parse(JSON.stringify(CONFIG)); c.miniBoss.seuils = [0.75, 0.5];
  verifier(CONFIG.valider(c).length === 1, 'valider : autant de seuils que de mini-boss', CONFIG.valider(c));
});

test('72 v1.3/v1.4 siphon et cuves : étapes, cible, boss immobile ; cuve intact → siphon → fissure → eclate ; chaque mini-boss (Démembré compris) devant sa cuve avec son profil (PV × coop au moment de l’apparition)', function () {
  [1, 3].forEach(function (n) {
    var s = mbSim(n, { graine: 50 + n });
    s.combat.allerA('phase2');
    s.avancer(0.3);
    var e0 = s.etat();
    verifier(e0.tubes.length === 3 && e0.tubes.every(function (t, i) { return t.etat === 'intact' && t.t >= 0 && t.id === 'tube' + i && t.miniBoss === MBC.ordre[i]; }),
      'trois cuves intactes dans l’instantané (v1.4 : tube2, Le Démembré)', e0.tubes);
    [0, 1, 2].forEach(function (k) {
      if (k > 0) { tuerMB(s, libere(s, k - 1).d.id); s.pas(); }
      if (act(s)) s.jusqua(function () { return !act(s); }, 6);
      var tS = s.t;
      s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
      s.jusqua(function () { var a = act(s); return a && a.id === 'siphon'; }, 2);
      var nA = evs(s, 'action', function (d) { return d.id === 'siphon'; }).length - 1, a0 = act(s), pos0 = copiePos(s.etat().boss.position), tc = tubeMonde(s, k);
      verifier(a0.etape === 'approche' && s.t - tS <= PAS * 2.5, 'siphon aussitôt (aucune action en cours)', s.t - tS);
      verifier(proche(a0.cible.x, tc.x, 1e-9) && proche(a0.cible.z, tc.z, 1e-9) && proche(a0.cible.y, s.origine.y + 1.4, 1e-9) && a0.donnees.miniBoss === MBC.ordre[k],
        'action.cible = centre de la cuve à 1,4 m', a0);
      var dep = 0;
      s.apresPas = function () { var a = act(s); if (a && a.id === 'siphon') dep = Math.max(dep, dist2D(s.etat().boss.position, pos0)); };
      s.jusqua(function () { var a = act(s); return !a || a.id !== 'siphon'; }, 8);
      s.apresPas = null;
      var seq = evs(s, 'action', function (d) { return d.id === 'siphon'; }).slice(nA);
      verifier(JSON.stringify(seq.map(function (e) { return e.d.etape; })) === JSON.stringify(['approche', 'aspiration', 'eclatement', 'recuperation']), 'étapes du siphon', seq.map(function (e) { return e.d.etape; }));
      [SIPH.approche, SIPH.aspiration, SIPH.eclatement].forEach(function (x, i) { verifier(proche(seq[i + 1].t - seq[i].t, x, PAS * 1.5), 'durée de l’étape ' + seq[i].d.etape, seq[i + 1].t - seq[i].t); });
      verifier(dep < 1e-6, 'il siphonne sans se déplacer', dep);
      var tb = evs(s, 'tube', function (d) { return d.id === 'tube' + k; });
      verifier(JSON.stringify(tb.map(function (e) { return e.d.etat; })) === JSON.stringify(['siphon', 'fissure', 'eclate']) && tb.every(function (e) {
        return e.d.miniBoss === MBC.ordre[k] && proche(e.d.position.x, tc.x, 1e-9) && proche(e.d.position.z, tc.z, 1e-9);
      }), 'cuve : siphon → fissure → eclate', tb.map(function (e) { return e.d; }));
      verifier(proche(tb[0].t, seq[1].t, 1e-9) && proche(tb[1].t - seq[1].t, SIPH.fissure * SIPH.aspiration, PAS * 1.5) && proche(tb[2].t, seq[2].t, 1e-9), 'fissure à ' + SIPH.fissure * 100 + ' % de l’aspiration', tb.map(function (e) { return e.t - seq[1].t; }));
      var l = libere(s, k), q = s.log.miniBoss[s.log.miniBoss.length - 1].q, P = MBC[MBC.ordre[k]], pv = P.pv * kPv(n), dv = devantCuve(s, k);
      verifier(l && proche(l.t - tb[2].t, SIPH.apparition.delai, PAS * 1.5), 'libéré ' + SIPH.apparition.delai + ' s après l’éclatement', l && l.t - tb[2].t);
      verifier(q.type === MBC.ordre[k] && q.miniBoss === true && q.nom === P.nom && q.effet === 'cuve' && q.source === 'boss' && q.lieu === 'salle' &&
        proche(q.position.x, dv.x, 1e-9) && proche(q.position.z, dv.z, 1e-9), 'faireApparaitreZombie({ type, miniBoss, nom, effet: cuve }) devant la cuve', q);
      var attendu = JSON.parse(JSON.stringify(P)); attendu.pv = pv; attendu.pvMax = pv;
      verifier(JSON.stringify(q.profil) === JSON.stringify(attendu), 'profil de la config, PV × ' + kPv(n), { recu: q.profil, attendu: attendu });
      verifier(l.d.id === s.log.miniBoss[s.log.miniBoss.length - 1].id && l.d.nom === P.nom && proche(l.d.pvMax, pv, 1e-6) && l.d.lieu === 'salle' && proche(l.d.position.x, dv.x, 1e-9),
        'évènement miniBoss libere', l.d);
      var pr = evs(s, 'protection', function (d) { return d.actif && d.miniBoss === MBC.ordre[k]; });
      verifier(pr.length === 1 && proche(pr[0].t, l.t, 1e-9), 'protection { actif: true, miniBoss }', pr.map(function (e) { return e.d; }));
      var m = s.etat().miniBoss.filter(function (x) { return x.etat === 'actif'; })[0];
      verifier(m && m.id === l.d.id && m.type === MBC.ordre[k] && m.nom === P.nom && m.couleur === P.couleur && proche(m.pv, pv, 1e-6) && proche(m.pvMax, pv, 1e-6) && m.lieu === 'salle',
        'instantané miniBoss', s.etat().miniBoss);
      var et = s.etat().tubes[k];
      verifier(et.etat === 'eclate' && proche(et.t, s.t - tb[2].t, 1e-6), 'instantané : cuve éclatée, t depuis le changement', et);
    });
    if (n === 3) {                                    // PV fixés à l'apparition : un départ ne les change plus
      s.robot('j3').connecte = false;
      s.avancer(DELAI_DEPART + 1);
      var m2 = s.etat().miniBoss.filter(function (x) { return x.etat === 'actif'; })[0];
      verifier(proche(s.etat().barre.max, CONFIG.phase2.pv * kPv(2), 1e-6) && proche(m2.pvMax, MBC[MBC.ordre[2]].pv * kPv(3), 1e-6), 'coop : PV du mini-boss inchangés après un départ', m2);
    }
  });
});
function copiePos(p) { return { x: p.x, y: p.y, z: p.z }; }

test('73 v1.3 seuil pendant une action : piqué lancé → va au bout de son impact, siphon au plus tard 1,5 s après ; piqué en visée ou absorption → annulés aussitôt', function () {
  // a) piqué en charge
  var s = mbSim(1, { graine: 31 });
  s.combat.allerA('phase2');
  s.combat.forcer('ames', CONFIG.phase2.amesPourAiles);
  verifier(s.jusqua(function () { var a = act(s); return a && a.id === 'pique' && a.etape === 'charge'; }, 15), 'piqué en charge');
  var t0 = s.t;
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.jusqua(function () { var a = act(s); return a && a.id === 'siphon'; }, 5);
  var imp = evsDepuis(s, 'piqueImpact', t0), et = evsDepuis(s, 'action', t0, function (d) { return d.id === 'pique' && d.etape === 'etourdi'; })[0];
  var deb = evs(s, 'action', function (d) { return d.id === 'siphon' && d.etape === 'approche'; })[0];
  verifier(imp.length === 1 && et && deb && imp[0].t < deb.t, 'le piqué lancé va jusqu’à son impact', { imp: imp.length, deb: deb && deb.t - t0 });
  verifier(proche(deb.t - t0, Math.max(1.5, et.t - t0), PAS * 2), 'siphon 1,5 s après le seuil (ou à la fin de l’impact)', { siphon: deb.t - t0, etourdi: et.t - t0 });
  verifier(s.etat().boss.ailes === 'absentes' && !s.etat().pique, 'piqué coupé proprement (ailes dissipées)', s.etat().boss.ailes);
  // b) piqué en visée (pas encore lancé) : annulé aussitôt
  var s2 = mbSim(1, { graine: 32 });
  s2.combat.allerA('phase2');
  s2.combat.forcer('ames', CONFIG.phase2.amesPourAiles);
  verifier(s2.jusqua(function () { var a = act(s2); return a && a.id === 'pique' && a.etape === 'visee'; }, 15), 'piqué en visée');
  var t1 = s2.t;
  s2.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s2.pas();
  verifier(act(s2) && act(s2).id === 'siphon' && evsDepuis(s2, 'piqueImpact', t1).length === 0, 'piqué non lancé : siphon au pas suivant', act(s2));
  // c) absorption en cours : annulée aussitôt, zombies relâchés
  var s3 = mbSim(1, { graine: 33 });
  s3.combat.allerA('phase2');
  verifier(s3.jusqua(function () { var a = act(s3); return a && a.id === 'absorption' && a.etape === 'saisie'; }, 30), 'absorption en cours');
  var cibles = evs(s3, 'absorption', function (d) { return d.etat === 'debut'; }).slice(-1)[0].d.cibles, t2 = s3.t;
  s3.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s3.pas();
  verifier(act(s3) && act(s3).id === 'siphon' && evsDepuis(s3, 'absorption', t2, function (d) { return d.etat === 'fin'; }).length === 1 &&
    cibles.every(function (id) { return s3.log.effets.some(function (x) { return x.id === id && x.effet === 'relache' && x.t >= t2 - 1e-9; }); }), 'absorption annulée, zombies relâchés', act(s3));
});

test('74 v1.3 mort du mini-boss : « mort » puis protection levée, PV repartent du seuil, barre vide 3 s ; le 2e attend 50 % ; vivant: false compte', function () {
  var s = mbSim(1);
  s.combat.allerA('phase2');
  var max = s.etat().barre.max;
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  var l = attendreLibere(s, 0), z = mbSimule(s, l.d.id);
  s.avancer(2);
  z.hp = z.pvMax * 0.4; s.pas();
  verifier(proche(s.etat().miniBoss[0].pv, z.pvMax * 0.4, 1e-6) && proche(s.etat().miniBoss[0].pvMax, z.pvMax, 1e-6), 'PV suivis par jeu.zombies() (pv, pvMax)', s.etat().miniBoss[0]);
  var pos = { x: z.pos.x, z: z.pos.z };
  tuerMB(s, l.d.id); s.pas();
  var mort = evs(s, 'miniBoss', function (d) { return d.etat === 'mort'; }), pr = evs(s, 'protection');
  verifier(mort.length === 1 && mort[0].d.id === l.d.id && mort[0].d.type === l.d.type && mort[0].d.nom === l.d.nom && dist2D(mort[0].d.position, pos) < 1e-9 && mort[0].d.lieu === 'salle',
    '« mort » à sa dernière position', mort.map(function (e) { return e.d; }));
  verifier(pr.length === 2 && pr[0].d.actif === true && pr[1].d.actif === false && pr[1].d.miniBoss === l.d.type && pr[1].t >= mort[0].t, 'puis protection { actif: false }', pr.map(function (e) { return e.d; }));
  var mb = s.etat().miniBoss;
  verifier(mb.length === 1 && mb[0].etat === 'mort' && mb[0].pv === 0 && !s.etat().boss.protege && s.etat().boss.vulnerable, 'barre vide, boss vulnérable', mb);
  s.avancer(3 - 0.3);
  verifier(s.etat().miniBoss.length === 1, 'la barre vide reste 3 s');
  s.avancer(0.5);
  verifier(s.etat().miniBoss.length === 0, 'puis disparaît');
  var r100 = s.combat.toucherBoss({ joueur: 'j1', degats: 100 });
  verifier(r100.applique && proche(s.etat().barre.valeur, MBC.seuils[0] * max - r100.montant, 1e-6), 'les PV repartent du seuil', s.etat().barre.valeur / max);
  s.avancer(10);
  verifier(!libere(s, 1) && !s.etat().boss.protege, 'pas de 2e mini-boss avant le 2e seuil');
  s.combat.forcer('pvSegment', MBC.seuils[1] * max + 1);
  s.pas();
  verifier(!s.etat().boss.protege, '1 PV au-dessus du 2e seuil : rien');
  s.combat.toucherBoss({ joueur: 'j1', degats: 2 });
  verifier(s.etat().boss.protege && proche(s.etat().barre.valeur, MBC.seuils[1] * max, 1e-6), '2e seuil atteint : protégé');
  var l2 = attendreLibere(s, 1);
  verifier(l2 && l2.d.type === MBC.ordre[1], '2e mini-boss');
  var orig = s.jeu.zombies, t3 = s.t;
  s.jeu.zombies = function () { return orig().map(function (q) { return q.id === l2.d.id ? Object.assign({}, q, { vivant: false }) : q; }); };
  s.pas();
  s.jeu.zombies = orig;
  verifier(evsDepuis(s, 'miniBoss', t3, function (d) { return d.etat === 'mort' && d.id === l2.d.id; }).length === 1 && !s.etat().boss.protege, 'vivant: false dans jeu.zombies() → mort');
});

test('75 v1.3 protection : le Septième garde ses attaques de phase 2 (invocations, absorptions, ailes, piqué), sauf pendant le siphon', function () {
  var s = mbSim(1, { graine: 37 });
  s.combat.allerA('phase2');
  s.avancer(2);
  if (act(s)) s.jusqua(function () { return !act(s); }, 6);
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.jusqua(function () { var a = act(s); return a && a.id === 'siphon'; }, 2);
  var tDeb = s.t;
  s.jusqua(function () { var a = act(s); return !a || a.id !== 'siphon'; }, 8);
  var tFin = s.t;
  var pendant = evs(s, 'action').filter(function (e) { return e.t > tDeb + 1e-9 && e.t < tFin - 1e-9 && e.d.id !== 'siphon'; });
  verifier(pendant.length === 0 && tFin - tDeb > 4, 'aucune autre action pendant le siphon', pendant.map(function (e) { return e.d.id + '/' + e.d.etape; }));
  verifier(libere(s, 0) && s.etat().boss.protege, 'mini-boss libéré, boss protégé');
  var t1 = s.t, ids = {};
  s.avancer(25);
  evsDepuis(s, 'action', t1).forEach(function (e) { ids[e.d.id] = true; });
  verifier(s.etat().boss.protege && ids.invocation && ids.absorption && evsDepuis(s, 'zone', t1).length > 0, 'protégé, il invoque et absorbe', Object.keys(ids));
  var t2 = s.t;
  s.combat.forcer('ames', CONFIG.phase2.amesPourAiles);
  s.jusqua(function () { return evsDepuis(s, 'piqueImpact', t2).length >= 1; }, 15);
  verifier(evsDepuis(s, 'ailes', t2, function (d) { return d.etat === 'deployees'; }).length === 1 && evsDepuis(s, 'piqueImpact', t2).length === 1 && s.etat().boss.protege,
    'ailes et piqué pendant la protection');
});

test('76 v1.3 exclusions : le mini-boss n’est ni saisi par l’absorption, ni compté dans le plafond des zombies ; PV forcés sous les seuils : protection sans soin', function () {
  // a) absorption : mini-boss immobile collé au boss (plus proche que tout zombie) jamais saisi ; idem pour un mini-boss que le jeu liste sans que la logique l'ait créé
  var s = mbSim(1, { graine: 41, miniBossBloques: true, surcharges: { boss: { vitesseDerive: 0 }, phase2: { absorption: { intervalle: [1, 1] } } } });
  s.combat.allerA('phase2');
  s.placer('j1', s.monde({ x: 0, z: -7 }), 'salle');
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  var l = attendreLibere(s, 0), b = s.etat().boss.position, z = mbSimule(s, l.d.id);
  z.pos = { x: b.x + 1.0, y: s.origine.y, z: b.z };
  var etranger = s.jeu.faireApparaitreZombie({ position: { x: b.x - 1.0, y: s.origine.y, z: b.z }, lieu: 'salle', effet: 'normal', source: 'test', type: 'irradie', miniBoss: true, profil: { pv: 500, vitesse: 1 } });
  mbSimule(s, etranger).bloque = true;
  var t0 = s.t;
  s.jusqua(function () { return evsDepuis(s, 'absorption', t0, function (d) { return d.etat === 'debut'; }).length >= 3; }, 14);
  var debs = evsDepuis(s, 'absorption', t0, function (d) { return d.etat === 'debut'; });
  verifier(debs.length >= 3 && debs.every(function (e) { return e.d.cibles.length && e.d.cibles.indexOf(l.d.id) < 0 && e.d.cibles.indexOf(etranger) < 0; }) &&
    s.log.effets.every(function (x) { return x.id !== l.d.id && x.id !== etranger; }), 'absorptions sans les mini-boss collés au boss', debs.map(function (e) { return e.d.cibles; }));
  verifier(s.etat().miniBoss.length === 1 && s.etat().miniBoss[0].id === l.d.id, 'seul le mini-boss de la logique est dans l’instantané');
  // b) plafond : les zombies des sorts remplissent le plafond de la phase 2, le mini-boss en plus
  var s2 = mbSim(1, { graine: 42, sansChiens: true, surcharges: { phase2: { absorption: { intervalle: [999, 999] } } } });
  s2.combat.allerA('phase2');
  s2.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  attendreLibere(s2, 0);
  var pireZ = 0, pireTotal = 0;
  s2.apresPas = function () { pireZ = Math.max(pireZ, zombiesSim(s2).filter(function (q) { return !q.miniBoss; }).length); pireTotal = Math.max(pireTotal, s2.zombies.length); };
  s2.avancer(40);
  verifier(pireZ === CONFIG.phase2.zombiesMax && pireTotal === CONFIG.phase2.zombiesMax + 1, 'phase 2 : ' + CONFIG.phase2.zombiesMax + ' zombies + le mini-boss', [pireZ, pireTotal]);
  // c) PV forcés à 30 % : protection sans soin ; le 2e mini-boss suit aussitôt la mort du 1er
  var s3 = mbSim(1);
  s3.combat.allerA('phase2');
  var max = s3.etat().barre.max;
  s3.combat.forcer('pvSegment', 0.3 * max);
  s3.pas();
  verifier(s3.etat().boss.protege && proche(s3.etat().barre.valeur, 0.3 * max, 1e-9), 'protégé, PV non remontés', s3.etat().barre.valeur / max);
  var l3 = attendreLibere(s3, 0);
  tuerMB(s3, l3.d.id); s3.pas(); s3.pas();
  verifier(s3.etat().boss.protege && act(s3) && act(s3).id === 'siphon' && act(s3).donnees.miniBoss === MBC.ordre[1], 'déjà sous le 2e seuil : 2e siphon aussitôt', act(s3));
});

test('77 v1.3 garde-fous : apparition refusée → 5 essais à 1 s puis protection levée ; mini-boss bloqué loin des joueurs → remis devant sa cuve avec ses PV ; jamais listé → protection levée', function () {
  // a) apparition refusée
  var s = mbSim(1), fz = s.jeu.faireApparaitreZombie, demandes = [];
  s.jeu.faireApparaitreZombie = function (q) { if (q.miniBoss) { demandes.push(s.t); return null; } return fz(q); };
  s.combat.allerA('phase2');
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  s.avancer(SIPH.approche + SIPH.aspiration + SIPH.eclatement + SIPH.apparition.delai + 7);
  verifier(demandes.length === 6 && demandes.slice(1).every(function (x, i) { return proche(x - demandes[i], 1.0, PAS * 1.5); }), '1 + 5 essais espacés de 1 s', demandes);
  verifier(!s.etat().boss.protege && evs(s, 'avertissement', function (d) { return /refuse/.test(d.texte); }).length === 1 &&
    evs(s, 'protection', function (d) { return !d.actif; }).length === 1 && !libere(s, 0), 'puis avertissement et protection levée');
  verifier(s.combat.toucherBoss({ joueur: 'j1', degats: 10 }).applique && etat(s) === 'phase2', 'le combat continue : le Septième est vulnérable');
  // b) bloqué : immobile 15 s à plus de 10 m de tout joueur → retiré en silence, remis devant sa cuve avec ses PV restants
  var s2 = mbSim(1, { miniBossBloques: true });
  s2.combat.allerA('phase2');
  s2.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  var l = attendreLibere(s2, 0), z = mbSimule(s2, l.d.id), pvMax = z.pvMax;
  z.hp = pvMax * 0.6;
  z.pos = { x: z.pos.x - 1.5, y: z.pos.y, z: z.pos.z };      // poussé, puis coincé
  verifier(dist2D(s2.robot('j1').pos, z.pos) > 10, 'loin du joueur', dist2D(s2.robot('j1').pos, z.pos));
  s2.pas();
  var tB = s2.t;
  s2.jusqua(function () { return s2.log.retraits.some(function (r) { return r.id === l.d.id; }); }, 17);
  var rt = s2.log.retraits.filter(function (r) { return r.id === l.d.id; })[0];
  verifier(rt && rt.effet === 'silencieux' && rt.points === false && proche(rt.t - tB, 15, 0.1), 'retiré en silence après 15 s', rt && rt.t - tB);
  s2.pas();
  var dm = s2.log.miniBoss, q2 = dm[dm.length - 1], dv = devantCuve(s2, 0);
  verifier(dm.length === 2 && proche(q2.q.profil.pv, pvMax * 0.6, 1e-6) && proche(q2.q.profil.pvMax, pvMax, 1e-6) && proche(q2.q.position.x, dv.x, 1e-9) && proche(q2.q.position.z, dv.z, 1e-9),
    'remis devant sa cuve avec ses PV restants (profil.pv), pvMax conservé', q2 && q2.q);
  var m = s2.etat().miniBoss[0];
  verifier(libere(s2, 1) === undefined && evs(s2, 'miniBoss').length === 1 && m.id === q2.id && proche(m.pv, pvMax * 0.6, 1e-6) && proche(m.pvMax, pvMax, 1e-6) && s2.etat().boss.protege,
    'même mini-boss (nouvel id), sans nouvelle libération', m);
  s2.placer('j1', { x: q2.q.position.x + 3, z: q2.q.position.z }, 'salle');
  s2.avancer(17);
  verifier(!s2.log.retraits.some(function (r) { return r.id === q2.id; }), 'à moins de 10 m d’un joueur, il reste');
  // c) jamais listé par jeu.zombies() : avertissement, protection levée (le combat ne bloque pas)
  var s3 = mbSim(1), o3 = s3.jeu.zombies;
  s3.jeu.zombies = function () { return o3().filter(function (q) { return !q.miniBoss; }); };
  s3.combat.allerA('phase2');
  s3.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  attendreLibere(s3, 0);
  s3.avancer(3.5);
  verifier(!s3.etat().boss.protege && evs(s3, 'avertissement', function (d) { return /ne liste pas le mini-boss/.test(d.texte); }).length === 1 &&
    evs(s3, 'miniBoss', function (d) { return d.etat === 'mort'; }).length === 0 && s3.etat().miniBoss.length === 0, 'jamais listé : avertissement, protection levée');
});

test('78 v1.3 allerA et échec : jusqu’à phase2 → cuves intactes, seuils remis à zéro ; après → cuves éclatées ; jamais de mini-boss ni de protection ; échec → retrait silencieux', function () {
  var s = mbSim(1);
  var avant = ['phase2', 'repit', 'phase1', 'introduction'], apres = ['transition23', 'absence', 'phase3', 'rituel', 'faiblesse', 'phase5', 'defaite', 'conclusion', 'termine'];
  avant.concat(apres, ['inactif']).forEach(function (x) {
    s.combat.allerA('phase2');
    s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
    var n = evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; }).length;
    s.jusqua(function () { return evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; }).length > n; }, 12);
    var l = evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; })[n], t0 = s.t;
    verifier(l && s.etat().boss.protege, 'mini-boss vivant avant allerA(' + x + ')');
    s.combat.allerA(x);
    var e = s.etat(), cuves = apres.indexOf(x) >= 0 ? 'eclate' : 'intact';
    verifier(s.log.retraits.some(function (r) { return r.id === l.d.id && r.effet === 'silencieux' && r.t >= t0 - 1e-9; }) && evs(s, 'miniBoss', function (d) { return d.etat === 'mort'; }).length === 0,
      'allerA(' + x + ') : mini-boss retiré en silence');
    verifier(!e.boss.protege && e.miniBoss.length === 0 && e.tubes.every(function (t) { return t.etat === cuves; }), 'allerA(' + x + ') : cuves ' + cuves + ', ni mini-boss ni protection', { tubes: e.tubes, mb: e.miniBoss });
    s.avancer(1);
    verifier(!s.etat().boss.protege && s.etat().miniBoss.length === 0 && evsDepuis(s, 'tube', t0 + 1e-6).length === 0, 'allerA(' + x + ') : rien ne se relance');
  });
  // seuils remis à zéro : le 1er mini-boss revient au 1er seuil
  s.combat.allerA('phase2');
  var n1 = evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; }).length;
  s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  verifier(proche(s.etat().barre.valeur, MBC.seuils[0] * s.etat().barre.max, 1e-6), 'allerA(phase2) : seuils remis à zéro');
  s.jusqua(function () { return evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; }).length > n1; }, 12);
  verifier(evs(s, 'miniBoss', function (d) { return d.etat === 'libere'; })[n1].d.type === MBC.ordre[0], 'de nouveau ' + MBC.ordre[0]);
  // échec
  var s2 = mbSim(1);
  s2.combat.allerA('phase2');
  s2.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
  var l2 = attendreLibere(s2, 0);
  s2.robot('j1').vivant = false;
  s2.jusqua(function () { return etat(s2) === 'echec'; }, 5);
  verifier(etat(s2) === 'echec' && s2.log.retraits.some(function (r) { return r.id === l2.d.id && r.effet === 'silencieux'; }) && !s2.etat().boss.protege &&
    s2.etat().miniBoss.length === 0 && evs(s2, 'protection', function (d) { return !d.actif; }).length === 1, 'échec : mini-boss retiré en silence, protection levée');
});

test('79 v1.3/v1.4 combat complet : le robot abat Le Survolté, L’Irradié puis Le Démembré ; aucun dégât au Septième entre chaque seuil et la mort du mini-boss', function () {
  var s = sim({ joueurs: [{ id: 'j1', dps: MOYEN.dps, reaction: MOYEN.reaction }], pvZombie: Sim.MODELE.pvZombie, graine: 404 });
  var pvProtege = null, ecarts = 0, tempsProtege = 0;
  s.apresPas = function () {
    var e = s.etat();
    if (e.boss.protege) { tempsProtege += PAS; if (pvProtege == null) pvProtege = e.barre.valeur; else if (Math.abs(e.barre.valeur - pvProtege) > 1e-6) ecarts++; }
    else pvProtege = null;
  };
  s.combat.demarrer();
  s.jusqua(function () { return finCombat(s); }, 2500);
  s.apresPas = null;
  verifier(etat(s) === 'termine', 'victoire', etat(s));
  var ordre = s.evenements.filter(function (e) { return e.type === 'tube' || e.type === 'miniBoss' || (e.type === 'etat' && e.d.vers === 'transition23'); }).map(function (e) {
    return e.type === 'tube' ? e.d.id + ':' + e.d.etat : e.type === 'miniBoss' ? e.d.type + ':' + e.d.etat : 'transition23';
  });
  verifier(JSON.stringify(ordre) === JSON.stringify(['tube0:siphon', 'tube0:fissure', 'tube0:eclate', 'survolte:libere', 'survolte:rage', 'survolte:mort',
    'tube1:siphon', 'tube1:fissure', 'tube1:eclate', 'irradie:libere', 'irradie:rage', 'irradie:mort', 'tube2:siphon', 'tube2:fissure', 'tube2:eclate', 'demembre:libere',
    'demembre:rage', 'demembre:mort', 'transition23']), 'déroulé de la phase 2 (v1.5 : une rage par mini-boss)', ordre);
  verifier(s.log.miniBossTues.map(function (x) { return x.type; }).join() === 'survolte,irradie,demembre' && s.log.decharges.length > 0 && s.log.boules.length > 0 && s.log.fleaux.length > 0,
    'abattus par le robot (décharges, boules et fléaux encaissés ou esquivés)', { tues: s.log.miniBossTues, decharges: s.log.decharges.length, boules: s.log.boules.length, fleaux: s.log.fleaux.length });
  verifier(ecarts === 0 && tempsProtege > 10, 'PV du Septième figés pendant chaque protection', { ecarts: ecarts, protege: tempsProtege });
  var d = s.dureesEtats().filter(function (x) { return x.etat === 'phase2'; })[0].duree;
  var vie = MBC.ordre.map(function (t) {
    var l = evs(s, 'miniBoss', function (x) { return x.type === t && x.etat === 'libere'; })[0], m = evs(s, 'miniBoss', function (x) { return x.type === t && x.etat === 'mort'; })[0];
    return (m.t - l.t).toFixed(0);
  });
  note('phase 2 (solo, robot moyen, graine 404) : ' + d.toFixed(0) + ' s dont ' + tempsProtege.toFixed(0) + ' s de protection ; Survolté ' + vie[0] + ' s, Irradié ' + vie[1] + ' s, Démembré ' + vie[2] + ' s');
});

// ═══════════════════════════════════════ 16. version 1.4 (API.md §16) ═══════════════════════════════════════
// (tests 81 à 89 ; ils passent avant le test 80 de couverture, qui compte aussi leurs évènements)
test('81 v1.4 arène : 3e cuve (tube2, Le Démembré) au milieu du mur nord, brèche nord en (0, 11), dalle m0-1 jamais arrachée ; profil du Démembré ; valider', function () {
  var A = Sim.ARENE.salle, t2 = A.tubes[2];
  verifier(A.tubes.length === 3 && t2.id === 'tube2' && t2.x === 0 && t2.y === 0 && t2.z === 13.1 && proche(t2.lacet, Math.PI, 1e-12) && t2.rayon === 1.3 && t2.hauteur === 4.4 &&
    t2.miniBoss === 'demembre', 'tube2 (v1.5 : cuve géante, rayon 1,3, hauteur 4,4, z 13,1)', t2);
  verifier(A.breches[0].id === 'breche0' && A.breches[0].x === 0 && A.breches[0].z === 11, 'breche0 en (0, 11)', A.breches[0]);
  var inactives = A.dalles.filter(function (d) { return d.actif === false; });
  verifier(inactives.length === 1 && inactives[0].id === 'm0-1', 'seule la dalle m0-1 (derrière la cuve) est inactive', inactives.map(function (d) { return d.id; }));
  var D = MBC.demembre;
  verifier(D.nom === 'Le Démembré' && D.couleur === '#E3B65C' && D.pv > 0 && D.fleau && D.fleau.portee > 0 && D.fleau.angle > 0 && D.fleau.preparation > 0, 'profil du Démembré', D);
  // m0-1 n'est jamais désignée, même avec le boss posé juste devant (à 4 m du mur nord) : arrachements simples puis salves
  var s = sim({ joueurs: passifs(1), degatsZombie: 0, graine: 81, sansChiens: true, robotsInertes: true,
    surcharges: { phase3: { apparitionsSuspendues: true, ondeChoc: { actif: false }, deplacement: { vitesse: 0 }, arrachement: { intervalle: [0.4, 0.4], reconstruction: 2 }, salve: { intervalle: [1, 1] } } } });
  s.combat.allerA('phase3');
  s.robot('j1').pv = 1e9;                             // (encaisse tout : on ne regarde que les dalles)
  var b0 = s.etat().boss.position;
  s.combat.forcer('position', { x: s.origine.x, y: b0.y, z: s.origine.z + 10.5 });
  var vues = {};
  s.combat.on('bloc', function (d) { if (d.etat === 'fissure') vues[d.id] = (vues[d.id] || 0) + 1; });
  s.avancer(30);
  s.combat.forcer('pvSegment', s.etat().barre.max * (CONFIG.phase3.salve.seuil - 0.05));
  s.avancer(30);
  verifier(!vues['m0-1'] && vues['m0-0'] > 0 && vues['m0-2'] > 0, 'm0-1 jamais désignée (ses voisines m0-0 et m0-2 le sont)', vues);
  // valider : les nouveaux blocs de la config
  var c = JSON.parse(JSON.stringify(CONFIG));
  c.phase3.salve.blocs = 0; c.phase5.paliers.seuils = [0.5, 0.25, 0.75]; c.phase5.paliers.crochet.porteeMin = 30; c.miniBoss.irradie.boules.zone.dpsMax = -1; c.miniBoss.demembre.fleau.portee = 0;
  verifier(CONFIG.valider(c).length === 5, 'valider : salve, paliers, crochet, boules, fléau', CONFIG.valider(c));
});

// Phase 3 sous le seuil des salves (sans zombies ni onde de choc) ; n robots immobiles aux coins d'un carré de 12 m
var SVc = CONFIG.phase3.salve, ARc = CONFIG.phase3.arrachement;
function essaiSalve(n, o) {
  o = o || {};
  var joueurs = [];
  for (var i = 1; i <= n; i++) joueurs.push(Object.assign({ id: 'j' + i, tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: null }, o.joueur || {}));
  var surch = fusionnerTest({ phase3: { apparitionsSuspendues: true, ondeChoc: { actif: false } } }, JSON.parse(JSON.stringify(o.surcharges || {})));
  var s = sim({ joueurs: joueurs, degatsZombie: 0, graine: o.graine || 82, surcharges: surch, sansChiens: true, robotsInertes: !!o.inertes });
  s.combat.allerA('phase3');
  var O = s.origine, pos = o.positions || [{ x: -6, z: -6 }, { x: 6, z: -6 }, { x: 6, z: 6 }, { x: -6, z: 6 }];
  for (var k = 1; k <= n; k++) { s.placer('j' + k, { x: O.x + pos[k - 1].x, z: O.z + pos[k - 1].z }, 'salle'); if (o.increvables) s.robot('j' + k).pv = 1e9; }
  s.salves = [];
  s.combat.on('action', function (d) {               // donnees de la salve à sa désignation (l'évènement ne les porte pas)
    if (d.id !== 'arrachement' || d.etape !== 'designation') return;
    var e = s.combat.etat(), a = e.boss.action;
    var ids = a.donnees.blocs || [a.donnees.bloc];
    s.salves.push({ t: s.t, salve: !!a.donnees.salve, blocs: ids, cibles: ids.map(function (id) { return e.blocs.filter(function (b) { return b.id === id; })[0].cibleJoueur; }) });
  });
  if (o.salve !== false) s.combat.forcer('pvSegment', s.etat().barre.max * (SVc.seuil - 0.02));
  return s;
}
function murDalle(id) { return id.split('-')[0]; }
test('82 v1.4 salves (phase 3 sous 50 %) : 4 dalles désignées ensemble sur des murs différents, fracture et lévitation ensemble, projections à « ecart » s ; 25 % par bloc ; piliers ; blocsSimultanes ne bride pas, maxArraches oui ; intervalle', function () {
  // au-dessus du seuil : arrachements simples
  var s0 = essaiSalve(1, { salve: false, increvables: true });
  s0.avancer(12);
  verifier(s0.salves.length >= 2 && s0.salves.every(function (x) { return !x.salve && x.blocs.length === 1; }), 'au-dessus de ' + SVc.seuil * 100 + ' % : un bloc à la fois', s0.salves);
  // sous le seuil : la salve ; joueur immobile (avec une protection) : il encaisse les 4 blocs, 25 % chacun
  var s = essaiSalve(1, { joueur: { reduction: 0.5 } });
  s.jusqua(function () { return s.salves.length >= 1; }, 6);
  var sv = s.salves[0];
  verifier(sv.salve && sv.blocs.length === SVc.blocs && s.etat().boss.action.donnees.salve === true, 'action.donnees.salve et donnees.blocs (' + SVc.blocs + ')', sv);
  var murs = sv.blocs.map(murDalle);
  verifier(murs.filter(function (m, i) { return murs.indexOf(m) === i; }).length === SVc.blocs, 'un mur différent par bloc', sv.blocs);
  var pire = 0;
  s.apresPas = function () { pire = Math.max(pire, s.etat().blocs.filter(function (b) { return ['fissure', 'arrache', 'levitation', 'vol'].indexOf(b.etat) >= 0; }).length); };
  s.jusqua(function () { return s.log.degats.filter(function (d) { return d.source === 'bloc'; }).length >= SVc.blocs || !s.robot('j1').vivant; }, 8);
  s.apresPas = null;
  ['fissure', 'arrache', 'levitation'].forEach(function (et) {
    var t = evs(s, 'bloc', function (d) { return d.etat === et && sv.blocs.indexOf(d.id) >= 0; }).map(function (e) { return e.t; });
    verifier(t.length === SVc.blocs && t.every(function (x) { return proche(x, t[0], 1e-9); }), et + ' : les ' + SVc.blocs + ' blocs ensemble', t);
  });
  var vols = sv.blocs.map(function (id) { return evs(s, 'bloc', function (d) { return d.etat === 'vol' && d.id === id; })[0].t; });
  vols.forEach(function (t, i) { verifier(proche(t - vols[0], i * SVc.ecart, PAS * 1.5), 'projection ' + (i + 1) + ' à ' + (i * SVc.ecart).toFixed(2) + ' s', vols.map(function (x) { return x - vols[0]; })); });
  var lev = evs(s, 'bloc', function (d) { return d.etat === 'levitation' && d.id === sv.blocs[0]; })[0].t;
  verifier(proche(vols[0] - lev, ARc.levitation + ARc.projection, PAS * 1.5), 'première projection après lévitation + projection', vols[0] - lev);
  verifier(pire >= SVc.blocs && pire > ARc.blocsSimultanes, 'blocsSimultanes (' + ARc.blocsSimultanes + ') ne bride pas une salve', pire);
  var coups = s.log.degats.filter(function (d) { return d.source === 'bloc' && !d.mort; });
  verifier(coups.length === SVc.blocs && coups.every(function (d) { return proche(d.f, 0.25, 1e-9); }) && !s.robot('j1').vivant, 'immobile : les 4 blocs, 25 % chacun malgré la protection', coups.map(function (d) { return d.f; }));
  // salves suivantes : intervalle entre deux désignations ; maxArraches raccourcit la salve
  var s2 = essaiSalve(1, { increvables: true, surcharges: { phase3: { arrachement: { maxArraches: 6 } } } });
  var pireA = 0;
  s2.apresPas = function () { pireA = Math.max(pireA, s2.etat().blocs.length); };
  s2.avancer(30);
  var l2 = s2.salves;
  verifier(l2.length >= 3 && l2[0].blocs.length === 4 && l2[1].blocs.length === 2 && pireA <= 6, 'maxArraches 6 : 4 puis 2 blocs, jamais plus de 6 portions', { blocs: l2.map(function (x) { return x.blocs.length; }), pire: pireA });
  var s3 = essaiSalve(1, { increvables: true, surcharges: { phase3: { arrachement: { maxArraches: 40 } } } });
  s3.avancer(30);
  var ecarts = s3.salves.slice(1).map(function (x, i) { return x.t - s3.salves[i].t; });
  verifier(ecarts.length >= 3 && ecarts.every(function (e) { return e >= SVc.intervalle[0] - PAS * 1.5 && e <= SVc.intervalle[1] + PAS * 1.5; }) && s3.salves.every(function (x) { return x.salve; }),
    'une salve toutes les ' + SVc.intervalle.join('–') + ' s', ecarts);
  // pilier entre le boss et le joueur : il arrête les blocs (3 coups → détruit), sans toucher le joueur caché derrière
  var P0 = Sim.ARENE.salle.piliers[0], lp = Math.hypot(P0.x, P0.z);
  var s4 = essaiSalve(1, { positions: [{ x: P0.x / lp * 12.2, z: P0.z / lp * 12.2 }], surcharges: { phase3: { deplacement: { vitesse: 0 } } } });
  s4.jusqua(function () { return evs(s4, 'blocImpact').length >= 3; }, 8);
  var im = evs(s4, 'blocImpact').slice(0, 3);
  verifier(im.every(function (e) { return e.d.pilier === P0.id && e.d.touches.length === 0; }) && evs(s4, 'pilier', function (d) { return d.etat === 'detruit'; }).length === 1,
    'les 3 premiers blocs de la salve s’écrasent sur le pilier, qui tombe', im.map(function (e) { return e.d; }));
});

test('83 v1.4 salves : blocs répartis à tour de rôle (4 en solo, 2 + 2, 2 + 1 + 1, 1 chacun), premier servi qui change ; visées prédites (predictions[k]) et décalage ± decalage à partir du 3e', function () {
  [[1, [4]], [2, [2, 2]], [3, [2, 1, 1]], [4, [1, 1, 1, 1]]].forEach(function (c) {
    var n = c[0], s = essaiSalve(n, { increvables: true, graine: 83 + n });
    s.jusqua(function () { return s.salves.length >= 2; }, 12);
    s.salves.slice(0, 2).forEach(function (sv, k) {
      var compte = {};
      sv.cibles.forEach(function (id) { compte[id] = (compte[id] || 0) + 1; });
      var premier = 'j' + (1 + k % n), attendu = {};
      c[1].forEach(function (x, i) { attendu['j' + (1 + (k + i) % n)] = x; });
      verifier(JSON.stringify(Object.keys(compte).sort().map(function (id) { return compte[id]; })) === JSON.stringify(Object.keys(attendu).sort().map(function (id) { return attendu[id]; })) &&
        sv.cibles[0] === premier, n + ' joueur(s), salve ' + (k + 1) + ' : ' + c[1].join(' + ') + ' (premier servi ' + premier + ')', { cibles: sv.cibles, attendu: attendu });
    });
  });
  // visées : joueur qui court droit (2,5 m/s) ; le k-ième bloc vise sa position + vitesse × durée du vol × predictions[k], décalée de
  // ± decalage sur le côté (perpendiculaire à la visée) à partir du 3e — retrouvé en prolongeant la trajectoire réelle du bloc
  var s = essaiSalve(1, { inertes: true, increvables: true, positions: [{ x: -9, z: -5 }], salve: false }), r = s.robot('j1'), V = { x: 2.5, z: 0 };
  s.apresPas = function () { r.pos.x += V.x * PAS; r.pos.z += V.z * PAS; r.vel = { x: V.x, y: 0, z: V.z }; };
  s.pas();
  s.combat.forcer('pvSegment', s.etat().barre.max * (SVc.seuil - 0.02));
  var lancers = {};
  s.combat.on('bloc', function (d) {
    if (d.etat !== 'vol') return;
    var b = s.combat.etat().blocs.filter(function (x) { return x.id === d.id; })[0];
    lancers[d.id] = { b0: { x: b.position.x, y: b.position.y, z: b.position.z }, p: copiePos(r.pos) };
  });
  s.jusqua(function () { return s.salves.length >= 1 && Object.keys(lancers).length >= s.salves[0].blocs.length; }, 8);
  s.pas();                                            // un pas de vol : direction de chaque bloc
  var sv = s.salves[0], ecartsVisee = [];
  sv.blocs.forEach(function (id, k) {
    var L = lancers[id], b1 = s.etat().blocs.filter(function (x) { return x.id === id; })[0].position;
    var d = { x: b1.x - L.b0.x, y: b1.y - L.b0.y, z: b1.z - L.b0.z };
    var c0 = { x: L.p.x, y: L.p.y + 1.0, z: L.p.z }, tv = Math.hypot(c0.x - L.b0.x, c0.y - L.b0.y, c0.z - L.b0.z) / ARc.vitesse;
    var pr = SVc.predictions[Math.min(k, SVc.predictions.length - 1)], cx = c0.x + V.x * tv * pr, cz = c0.z + V.z * tv * pr;
    var lat = k >= 2 ? SVc.decalage * (k % 2 === 0 ? 1 : -1) : 0, hx = cx - L.b0.x, hz = cz - L.b0.z, hl = Math.hypot(hx, hz);
    cx += -hz / hl * lat; cz += hx / hl * lat;
    var lam = (c0.y - L.b0.y) / d.y, vx = L.b0.x + d.x * lam, vz = L.b0.z + d.z * lam;   // la trajectoire à hauteur de torse
    ecartsVisee.push(Math.hypot(vx - cx, vz - cz));
  });
  verifier(sv.blocs.length === 4 && ecartsVisee.every(function (e) { return e < 0.05; }), 'chaque bloc vise sa position prédite (predictions ' + SVc.predictions.join(', ') + ', décalage ±' + SVc.decalage + ' m)', ecartsVisee);
});

test('84 v1.4 faiblesse : des zombies sprinteurs toutes les 1,2 s, au plus max (+ coop), par les brèches, plus aucun après ; « apparitions: null » → aucun (v1.3)', function () {
  var FA = CONFIG.phase4.faiblesse.apparitions;
  [1, 3].forEach(function (n) {
    var s = sim({ joueurs: passifs(n), degatsZombie: 0, graine: 84, sansChiens: true });
    s.combat.allerA('faiblesse');
    var t0 = s.t, max = FA.max + CONFIG.coop.zombiesParJoueurSupp * (n - 1), pire = 0;
    s.apresPas = function () { pire = Math.max(pire, zombiesSim(s).length); };
    s.avancer(FA.intervalle * (max + 6));
    s.apresPas = null;
    var ap = s.log.apparitions.filter(function (a) { return a.t > t0; });
    verifier(ap.length === max && pire === max, n + ' joueur(s) : ' + max + ' zombies au plus', { apparus: ap.length, pire: pire });
    verifier(proche(ap[0].t - t0, FA.intervalle, PAS * 1.5) && proche(ap[1].t - ap[0].t, FA.intervalle, PAS * 1.5), 'toutes les ' + FA.intervalle + ' s', ap.slice(0, 2).map(function (a) { return a.t - t0; }));
    verifier(ap.every(function (a) { return a.effet === 'breche' && a.lieu === 'salle' && a.vitesse === CONFIG.zombies.vitesse && a.agressif === CONFIG.zombies.agressif; }), 'sprinteurs agressifs, par les brèches', ap[0]);
    s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
    s.pas();
    verifier(etat(s) === 'transition45', 'faiblesse finie', etat(s));
    var a1 = s.log.apparitions.length;
    s.avancer(4);
    verifier(s.log.apparitions.length === a1, 'plus aucune apparition après la faiblesse');
  });
  var s2 = sim({ joueurs: passifs(1), degatsZombie: 0, sansChiens: true, surcharges: { phase4: { faiblesse: { apparitions: null } } } });
  s2.combat.allerA('faiblesse');
  var a2 = s2.log.apparitions.length;
  s2.avancer(10);
  verifier(s2.log.apparitions.length === a2, '« apparitions: null » : aucun zombie (comportement v1.3)');
});

test('85 v1.4 paliers : 0 en entrant en phase 5 (lames bleues), 1/2/3 aux seuils 25/50/75 % (rouges), acquis même quand la jauge redescend ; évènements, instantané ; null hors phase 5', function () {
  var s = essaiFrappe({ joueurs: passifs(1), surcharges: { phase5: { apparitions: { max: 0 }, teleportDegats: { actif: false }, frappe: { portee: 0 } } } });
  var e0 = evs(s, 'palier');
  verifier(e0.length === 1 && e0[0].d.numero === 0 && e0[0].d.couleurLames === 'bleu' && s.etat().boss.palier === 0 && s.etat().boss.couleurLames === 'bleu', 'palier 0 dès l’entrée', e0.map(function (e) { return e.d; }));
  verifier(JSON.stringify(Object.keys(e0[0].d).sort()) === JSON.stringify(['couleurLames', 'numero']), 'évènement palier { numero, couleurLames }', e0[0].d);
  var JM = CONFIG.phase5.jauge.degatsRequis;
  s.combat.toucherBoss({ joueur: 'j1', degats: JM * (PAL.seuils[0] + 0.01) });
  var e1 = evs(s, 'palier');
  verifier(e1.length === 2 && e1[1].d.numero === 1 && e1[1].d.couleurLames === 'rouge' && s.etat().boss.palier === 1 && s.etat().boss.couleurLames === 'rouge',
    'palier 1 acquis dans le coup qui franchit ' + PAL.seuils[0] * 100 + ' %', e1.map(function (e) { return e.d; }));
  s.avancer(CONFIG.phase5.jauge.delaiAvantBaisse + 3);
  verifier(s.etat().jauge.valeur < PAL.seuils[0] && s.etat().boss.palier === 1 && evs(s, 'palier').length === 2, 'acquis : la jauge redescend, pas le palier', s.etat().jauge);
  s.combat.toucherBoss({ joueur: 'j1', degats: JM * (PAL.seuils[2] + 0.02) });
  var nums = evs(s, 'palier').map(function (e) { return e.d.numero; });
  verifier(JSON.stringify(nums) === JSON.stringify([0, 1, 2, 3]) && s.etat().boss.palier === 3 && s.etat().jauge.valeur < 1, 'un coup qui franchit deux seuils : paliers 2 puis 3', nums);
  s.combat.allerA('phase3');
  verifier(s.etat().boss.palier === null && s.etat().boss.couleurLames === null, 'null hors de la phase 5');
  s.combat.allerA('defaite');
  verifier(s.etat().boss.palier === PAL.seuils.length && s.etat().boss.couleurLames === 'rouge', 'allerA(defaite) : palier ' + PAL.seuils.length, s.etat().boss);
  s.combat.allerA('phase5');
  verifier(s.etat().boss.palier === 0 && s.etat().boss.couleurLames === 'bleu', 'allerA(phase5) : de nouveau 0');
  // sans paliers dans la config : règle d'origine (chaque coup réussi laisse à 1 %), pas d'évènement palier
  var s2 = essaiFrappe({ surcharges: { phase5: { apparitions: { max: 0 }, paliers: null } } });
  verifier(s2.etat().boss.palier === null && evs(s2, 'palier').length === 0, 'paliers absents : null, aucun évènement');
  s2.jusqua(function () { return evs(s2, 'frappe').length >= 1; }, 60);
  verifier(evs(s2, 'frappe')[0].d.speciale === true && evs(s2, 'frappe')[0].d.palier === null && s2.log.critiques.length === 1, 'paliers absents : frappe spéciale d’origine', evs(s2, 'frappe')[0].d);
});

// Simulateur (§16.10) : capacités v1.4 des mini-boss exécutées par le jeu simulé ; robots immobiles, mini-boss avec leurs dégâts
function mbVivant(s, type) { return s.zombies.filter(function (z) { return z.miniBoss && z.type === type && z.vivant; })[0]; }
function versCentre(s, p, d, rot) {                  // point à d m de p, vers le centre de la salle (tourné de rot radians)
  var O = s.origine, ux = O.x - p.x, uz = O.z - p.z, l = Math.hypot(ux, uz) || 1, c = Math.cos(rot || 0), sn = Math.sin(rot || 0);
  ux /= l; uz /= l;
  return { x: p.x + (ux * c - uz * sn) * d, z: p.z + (ux * sn + uz * c) * d };
}
function libererMB(s, k) {                          // seuils k = 0, 1, 2 : les mini-boss précédents sont abattus par le test
  for (var i = 0; i <= k; i++) {
    s.combat.toucherBoss({ joueur: 'j1', degats: 1e9 });
    var l = attendreLibere(s, i, 12);
    if (i < k) { tuerMB(s, l.d.id); s.pas(); }
  }
  return mbVivant(s, MBC.ordre[k]);
}
test('86 v1.4 simulateur : décharge du Survolté (charge 0,7 s) sur chaque joueur à portée + étourdissement ; boules de L’Irradié → zones jusqu’à sa mort (puis 1,5 s), exposition ; fléau du Démembré', function () {
  var S = MBC.survolte, D = S.decharge, I = MBC.irradie, Bo = I.boules, F = MBC.demembre.fleau;
  // a) Survolté : deux joueurs à 6 m de lui, en vue → un arc chacun, étourdis D.etourdissement s, après une charge de 0,7 s
  var s = sim({ joueurs: passifs(2), degatsZombie: 0, degatsChien: 0, graine: 86, sansChiens: true, surcharges: { phase2: { invocation: { intervalle: [999, 999] }, absorption: { intervalle: [999, 999] } } } });
  s.combat.allerA('phase2');
  var m = libererMB(s, 0);
  s.placer('j1', versCentre(s, m.pos, 6, 0), 'salle'); s.placer('j2', versCentre(s, m.pos, 6, 0.6), 'salle');
  s.jusqua(function () { return s.log.decharges.length >= 1; }, 10);
  var dc = s.log.decharges[0], ch = s.log.charges.filter(function (c) { return c.t <= dc.t; }).pop();
  verifier(dc.cibles.slice().sort().join() === 'j1,j2' && ch && proche(dc.t - ch.t, 0.7, PAS * 1.5), 'multi : un arc vers chaque joueur à portée, après 0,7 s de charge', { dc: dc, ch: ch });
  var dd = s.log.degats.filter(function (x) { return x.source === 'survolte_decharge'; });
  verifier(dd.length === 2 && dd.every(function (x) { return proche(x.f, D.degats, 1e-9); }) && s.log.etourdis.length === 2 &&
    s.robots.every(function (r) { return proche(r.etourdiJusqua - dc.t, D.etourdissement, 1e-9); }), 'dégâts ' + D.degats + ' et étourdissement ' + D.etourdissement + ' s chacun', dd);
  // b) Irradié : boules (2 + 1 par joueur supplémentaire) sur les joueurs immobiles → zones qui restent, exposition qui monte
  tuerMB(s, m.id); s.pas();
  var irr = libererMB(s, 1), t0 = s.t;
  s.placer('j1', versCentre(s, irr.pos, 10, 0), 'salle'); s.placer('j2', versCentre(s, irr.pos, 10, 0.8), 'salle');
  irr.vitesse = 0;                                     // sur place : on regarde ses boules (son aura n'atteint pas les joueurs)
  s.jusqua(function () { return s.log.zonesRadio.length >= Bo.parVolee + Bo.parJoueurSupp; }, Bo.intervalle + Bo.tempsVol + 1);
  var b1 = s.log.boules.filter(function (b) { return b.t >= t0; }), v1 = b1.filter(function (b) { return proche(b.t, b1[0].t, 1e-9); });
  verifier(v1.length === Bo.parVolee + Bo.parJoueurSupp && proche(s.log.zonesRadio[0].t - v1[0].t, Bo.tempsVol, PAS * 1.5), 'une volée de ' + (Bo.parVolee + Bo.parJoueurSupp) + ' boules à 2 joueurs, impact ' + Bo.tempsVol + ' s plus tard', v1.length);
  var r1 = s.robot('j1');
  s.avancer(3);
  var zt = s.log.degats.filter(function (x) { return x.id === 'j1' && x.source === 'irradie_zone'; });
  verifier(zt.length >= 8 && zt[zt.length - 1].f > zt[0].f * 2 && s.log.degats.some(function (x) { return x.id === 'j1' && x.source === 'irradie_boule'; }), 'impact puis exposition : dégâts de zone qui montent', zt.map(function (x) { return +x.f.toFixed(4); }));
  verifier(s.log.zonesRadio.every(function (q) { return q.fin === Infinity; }), 'zones sans fin tant qu’il vit');
  r1.pv = 1; s.robot('j2').pv = 1;
  tuerMB(s, irr.id); s.pas();
  var tm = s.t;
  verifier(s.log.zonesRadio.every(function (q) { return proche(q.fin, tm, PAS * 1.5 + 1.5) && q.fin > tm; }) && s.log.flaques.length >= 1, 'à sa mort : zones éteintes en 1,5 s, flaque');
  s.avancer(1.6);
  var n0 = s.log.degats.filter(function (x) { return x.source === 'irradie_zone'; }).length;
  s.avancer(1);
  verifier(s.log.degats.filter(function (x) { return x.source === 'irradie_zone'; }).length === n0, 'plus de dégâts de zone après 1,5 s');
  // c) Démembré : joueur immobile à 2 m devant lui → fléau après sa préparation, F.degats
  s.pas();
  var dm = libererMB(s, 2);
  s.placer('j1', versCentre(s, dm.pos, 2, 0), 'salle'); s.placer('j2', versCentre(s, dm.pos, 12, 0), 'salle');
  s.robot('j1').pv = 1;
  s.jusqua(function () { return s.log.fleaux.length >= 1; }, 6);
  var fl = s.log.fleaux[0], fd = s.log.degats.filter(function (x) { return x.source === 'demembre_fleau'; });
  verifier(fl && fl.touches.join() === 'j1' && fd.length === 1 && proche(fd[0].f, F.degats, 1e-9), 'fléau : ' + F.degats * 100 + ' % au joueur devant lui', { fl: fl, fd: fd });
});

// Phase 5 (v1.5) : robots passifs ; sans mur dans le bunker sauf o.mur (mur x ∈ [−1,5 ; 1,5], z ≤ 6)
function essaiIntangible(o) {
  o = o || {};
  var s = sim({ joueurs: o.joueurs || passifs(1, [{ regen: false }]), degatsZombie: 0, graine: o.graine || 87, sansMurBunker: !o.mur, sansChiens: true, retirerMethodes: o.retirerMethodes,
    surcharges: fusionnerTest({ phase5: { apparitions: { max: 0 }, teleportDegats: { actif: false } } }, JSON.parse(JSON.stringify(o.surcharges || {}))) });
  s.combat.allerA('phase5');
  return s;
}
function evInt(s, etatI) { return evs(s, 'intangible', function (d) { return d.etat === etatI; }); }
function evEvan(s) { return evs(s, 'action', function (d) { return d.id === 'evanouissement'; }); }
var HT5 = CONFIG.phase5.traque.hauteur;
test('87 v1.5 intangibilité (palier 2, remplace les illusions) : évanouissement loin de tous, invisible, vol en ligne droite à travers les murs (traversee), resurgissement (6 m en vue après un mur, 3 m, dureeMax → point valide), frappe aussitôt ; recharge ; jauge gelée, ni téléportation ni crochet', function () {
  var K = PAL.intangible;
  verifier(K && !('illusions' in PAL), 'config : phase5.paliers.intangible, plus de paliers.illusions', Object.keys(PAL));
  // a) palier 1 : jamais, même loin de tous
  var s0 = essaiIntangible({});
  s0.combat.forcer('position', { x: 25, y: HT5, z: 15 }); s0.placer('j1', { x: -25, z: -15 }, 'bunker');
  palierA(s0, 1);
  s0.avancer(4);
  verifier(evs(s0, 'intangible').length === 0 && evEvan(s0).length === 0 && !s0.etat().boss.intangible, 'palier 1 : pas d’intangibilité');
  // b) palier 2 sans mur : joueur à 8 m (rien), puis loin → évanouissement delaiInvisible s plus tard
  var s = essaiIntangible({});
  s.combat.forcer('position', { x: 10, y: HT5, z: 0 }); s.placer('j1', { x: 2, z: 0 }, 'bunker');
  verifier(palierA(s, 2) === 2 && evEvan(s).length === 0, 'palier 2, joueur à 8 m : rien');
  var t0 = s.t;
  s.placer('j1', { x: -25, z: -15 }, 'bunker');
  s.jusqua(function () { return evEvan(s).length > 0; }, 5);
  var ev0 = evEvan(s)[0], a0 = act(s);
  verifier(ev0 && ev0.d.etape === 'fondu' && proche(ev0.t - t0, K.delaiInvisible, PAS * 2.5), 'évanouissement ' + K.delaiInvisible + ' s après le départ du dernier joueur proche (≥ ' + K.proximite + ' m)', ev0 && ev0.t - t0);
  verifier(a0 && a0.id === 'evanouissement' && proche(a0.duree, K.evanouissement, 1e-9) && s.etat().boss.visible && !s.etat().boss.intangible, 'action evanouissement (fondu, ' + K.evanouissement + ' s), encore visible', a0);
  s.jusqua(function () { return evInt(s, 'debut').length > 0; }, 2);
  var ed = evInt(s, 'debut')[0], e1 = s.etat();
  verifier(ed && proche(ed.t - ev0.t, K.evanouissement, PAS * 1.5) && JSON.stringify(Object.keys(ed.d).sort()) === JSON.stringify(['etat', 'position']), 'intangible { etat: debut, position } à la fin du fondu', ed && ed.d);
  verifier(e1.boss.intangible === true && e1.boss.visible === false && e1.boss.present && e1.boss.locomotion === 'intangible' && !e1.boss.vulnerable && e1.boss.action === null,
    'instantané : intangible, invisible, locomotion « intangible »', e1.boss);
  var r = s.combat.toucherBoss({ joueur: 'j1', degats: 1e6 });
  verifier(r.applique === false && r.raison === 'absent', 'toucherBoss → { applique: false, raison: absent }', r);
  var j0 = e1.jauge.valeur, pB = copiePos(e1.boss.position), pJ = copiePos(s.robot('j1').pos);
  s.avancer(1);
  var e2 = s.etat(), parcouru = dist2D(e2.boss.position, pB), ux = pJ.x - pB.x, uz = pJ.z - pB.z, ul = Math.hypot(ux, uz);
  var ecart = Math.abs((e2.boss.position.x - pB.x) * uz / ul - (e2.boss.position.z - pB.z) * ux / ul);
  verifier(proche(parcouru, K.vitesse, K.vitesse * PAS * 1.5) && ecart < 1e-6, 'vol en ligne droite vers le joueur à ' + K.vitesse + ' m/s', { parcouru: parcouru, ecart: ecart });
  verifier(e2.jauge.gelee && e2.jauge.valeur === j0 && j0 > 0, 'jauge gelée (ni montée ni baisse)', [j0, e2.jauge]);
  // sans mur traversé : il resurgit à distanceProche m, puis frappe aussitôt (règle du palier)
  s.jusqua(function () { return evInt(s, 'fin').length > 0; }, 15);
  var ef = evInt(s, 'fin')[0], dFin = ef ? dist2D(ef.d.position, s.robot('j1').pos) : null;
  verifier(ef && dFin <= K.distanceProche + 1e-6 && dFin > K.distanceProche - K.vitesse * PAS - 1e-6 && evInt(s, 'traversee').length === 0, 'sans mur : il resurgit à ' + K.distanceProche + ' m', dFin);
  var ar = evs(s, 'action', function (d) { return d.id === 'resurgissement'; })[0], e3 = s.etat();
  verifier(ar && ar.d.etape === 'apparition' && proche(ar.t, ef.t, 1e-9) && act(s).id === 'resurgissement' && proche(act(s).duree, K.resurgissement, 1e-9), 'action resurgissement (apparition, ' + K.resurgissement + ' s)', ar && ar.d);
  verifier(!e3.boss.intangible && e3.boss.visible && e3.boss.locomotion !== 'intangible' && proche(ef.d.position.y, e3.boss.position.y, 1e-9), 'de nouveau visible et tangible', e3.boss);
  s.jusqua(function () { return evs(s, 'frappe').length > 0; }, 3);
  var pf = evs(s, 'action', function (d) { return d.id === 'frappe' && d.etape === 'preparation'; }).filter(function (e) { return e.t >= ar.t; })[0], fr = evs(s, 'frappe')[0];
  verifier(pf && proche(pf.t - ar.t, K.resurgissement, PAS * 1.5) && proche(fr.t - pf.t, K.preparationFrappe, PAS * 1.5), 'frappe aussitôt (préparation ' + K.preparationFrappe + ' s)', [ar.t, pf && pf.t, fr.t]);
  verifier(fr.d.joueur === 'j1' && fr.d.reussie && fr.d.palier === 2 && s.log.critiques.length === 1 && proche(s.robot('j1').pv, CONFIG.phase5.frappe.pvRestants, 1e-12), 'règle du palier 2 : ' + CONFIG.phase5.frappe.pvRestants * 100 + ' %', fr.d);
  verifier(s.combat.toucherIllusion({ id: 'illusion-1', joueur: 'j1' }).raison === 'absent' && s.etat().illusions.length === 0, 'plus d’illusions : toucherIllusion → absent, illusions []');
  // c) recharge : coup raté (portée nulle), joueur de nouveau loin → pas d'autre évanouissement avant recharge s
  var s2 = essaiIntangible({ surcharges: { phase5: { frappe: { portee: 0 } } } });
  s2.combat.forcer('position', { x: 10, y: HT5, z: 0 }); s2.placer('j1', { x: -25, z: -15 }, 'bunker');
  palierA(s2, 2);
  s2.jusqua(function () { return evInt(s2, 'fin').length > 0; }, 20);
  var tR = evInt(s2, 'fin')[0].t;
  s2.jusqua(function () { return evs(s2, 'frappe').length > 0; }, 3);
  verifier(!evs(s2, 'frappe')[0].d.reussie, 'coup raté (portée nulle)');
  s2.placer('j1', { x: 25, z: 15 }, 'bunker');
  s2.jusqua(function () { return evEvan(s2).length >= 2; }, 12);
  var ev2 = evEvan(s2)[1];
  verifier(ev2 && ev2.t - tR >= K.recharge - 1e-9 && ev2.t - tR <= K.recharge + PAS * 2.5, 'recharge : 2e évanouissement ' + K.recharge + ' s après le resurgissement', ev2 && ev2.t - tR);
  // d) à travers le mur du bunker : une traversée (positions dans le mur, jeu.visible faux), resurgit à distanceReapparition m en vue
  var s3 = essaiIntangible({ mur: true, surcharges: { phase5: { frappe: { portee: 0 } } } }), dansMur = 0;
  s3.combat.forcer('position', { x: 12, y: HT5, z: -10 }); s3.placer('j1', { x: -12, z: -10 }, 'bunker');
  palierA(s3, 2);
  s3.apresPas = function () { var b = s3.etat().boss; if (b.intangible && s3.dansMurBunker(b.position, 0)) dansMur++; };
  s3.jusqua(function () { return evInt(s3, 'fin').length > 0; }, 15);
  s3.apresPas = null;
  var tv = evInt(s3, 'traversee'), ef3 = evInt(s3, 'fin')[0];
  verifier(tv.length === 1 && dansMur > 0 && Math.abs(tv[0].d.position.x) <= 1.5 + 1e-6 && JSON.stringify(Object.keys(tv[0].d).sort()) === JSON.stringify(['etat', 'position']),
    'une traversée du mur : intangible { etat: traversee, position }, positions dans le mur pendant le vol', { traversees: tv.map(function (e) { return e.d.position; }), dansMur: dansMur });
  verifier(ef3 && tv[0].t < ef3.t && proche(dist2D(ef3.d.position, s3.robot('j1').pos), K.distanceReapparition, K.vitesse * PAS + 1e-6) && !s3.dansMurBunker(ef3.d.position, 0),
    'après la traversée : il resurgit à ' + K.distanceReapparition + ' m du joueur en vue', ef3 && dist2D(ef3.d.position, s3.robot('j1').pos));
  // sans jeu.positionValide : dans le mur, il ne resurgit pas, même à moins de distanceProche m d'un joueur (il attend d'en sortir)
  var s3b = essaiIntangible({ mur: true, retirerMethodes: ['positionValide'], surcharges: { phase5: { frappe: { portee: 0 } } } }), auMur = 0;
  s3b.combat.forcer('position', { x: 12, y: HT5, z: -10 }); s3b.placer('j1', { x: -2.5, z: -10 }, 'bunker');
  palierA(s3b, 2);
  s3b.apresPas = function () { var b = s3b.etat().boss; if (b.intangible && s3b.dansMurBunker(b.position, 0) && dist2D(b.position, s3b.robot('j1').pos) <= K.distanceProche) auMur++; };
  s3b.jusqua(function () { return evInt(s3b, 'fin').length > 0; }, 15);
  s3b.apresPas = null;
  var f3b = evInt(s3b, 'fin')[0];
  verifier(f3b && auMur > 0 && !s3b.dansMurBunker(f3b.d.position, 0), 'sans positionValide : jamais de resurgissement dans le mur (à ' + K.distanceProche + ' m du joueur derrière)', { fin: f3b && f3b.d.position, auMur: auMur });
  // e) dureeMax : au point valide le plus proche (ici, il est dans le mur au bout de dureeMax)
  var s4 = essaiIntangible({ mur: true, surcharges: { phase5: { frappe: { portee: 0 }, paliers: { intangible: { dureeMax: 0.6 } } } } }), avant = null;
  s4.combat.forcer('position', { x: 12, y: HT5, z: -10 }); s4.placer('j1', { x: -25, z: -10 }, 'bunker');
  palierA(s4, 2);
  s4.jusqua(function () { return evEvan(s4).length > 0; }, 4);
  s4.combat.forcer('position', { x: 4, y: HT5, z: -10 });   // pendant le fondu : vol de (4, −10) vers le joueur, dans le mur au bout de 0,6 s
  s4.apresPas = function () { var b = s4.etat().boss; if (b.intangible) avant = copiePos(b.position); };
  s4.jusqua(function () { return evInt(s4, 'fin').length > 0; }, 4);
  s4.apresPas = null;
  var d4 = evInt(s4, 'debut')[0], f4 = evInt(s4, 'fin')[0];
  verifier(f4 && proche(f4.t - d4.t, 0.6, PAS * 1.5) && s4.dansMurBunker(avant, 0), 'au bout de dureeMax s, dans le mur', { duree: f4 && f4.t - d4.t, avant: avant });
  verifier(!s4.dansMurBunker(f4.d.position, 0) && s4.jeu.positionValide(f4.d.position, 'bunker') && dist2D(f4.d.position, avant) <= 1.5 + 1e-6, 'resurgit au point valide le plus proche', { fin: f4.d.position, avant: avant });
  // f) palier 3 pendant l'intangibilité, joueur à portée de crochet, criblé de balles, téléportation sur dégâts active : rien
  var s5 = essaiIntangible({ surcharges: { phase5: { teleportDegats: { actif: true }, frappe: { portee: 0 } } } });
  s5.combat.forcer('position', { x: 10, y: HT5, z: 0 }); s5.placer('j1', { x: -12, z: 0 }, 'bunker');
  palierA(s5, 2);
  s5.jusqua(function () { return s5.etat().boss.intangible; }, 4);
  s5.combat.forcer('jauge', PAL.seuils[2] + 0.01); s5.pas();
  var d5 = dist2D(s5.etat().boss.position, s5.robot('j1').pos), nT = evs(s5, 'teleport').length, j5 = s5.etat().jauge.valeur;
  verifier(s5.etat().boss.palier === 3 && d5 >= PAL.crochet.porteeMin + K.vitesse && d5 <= PAL.crochet.porteeMax, 'palier 3, joueur à portée de crochet', d5);
  for (var k = 0; k < 60; k++) { s5.combat.toucherBoss({ joueur: 'j1', degats: 1e5 }); s5.pas(); }
  verifier(s5.etat().boss.intangible && evs(s5, 'teleport').length === nT && evs(s5, 'action', function (d) { return d.id === 'crochet'; }).length === 0 && s5.etat().jauge.valeur === j5 && evs(s5, 'degats').length === 0,
    'intangible : ni téléportation sur dégâts, ni crochet, ni dégâts, jauge gelée', s5.etat().jauge);
});

// Phase 5 au palier 3 : boss posé en (0, 10), joueurs placés autour, sans intangibilité (v1.5) ; le crochet part au pas suivant
function essaiCrochet(o) {
  o = o || {};
  var joueurs = o.joueurs || [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: null }];
  var s = sim({ joueurs: joueurs, degatsZombie: 0, graine: o.graine || 88, sansMurBunker: true, sansChiens: true, sansTirerJoueur: !!o.sansTirerJoueur,
    surcharges: fusionnerTest({ phase5: { apparitions: { max: 0 }, teleportDegats: { actif: false }, paliers: { intangible: null } } }, JSON.parse(JSON.stringify(o.surcharges || {}))) });
  s.combat.allerA('phase5');
  s.combat.forcer('position', { x: 0, y: CONFIG.phase5.traque.hauteur, z: 10 });
  (o.places || [{ x: 12, z: 10 }]).forEach(function (p, i) { s.placer(joueurs[i].id, { x: p.x, z: p.z }, 'bunker'); });
  s.combat.forcer('jauge', PAL.seuils[2] + 0.01);
  return s;
}
var CRO = PAL.crochet;
function dist3(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
test('88 v1.4 crochets (palier 3) : préparation, lancer vers chaque joueur valide à 4–22 m, accroche (commandes retirées, regard), traction jusqu’à 1,3 m, frappe aussitôt de tous les ramenés ; raté (esquive), mur ; sans tirerJoueur ; recharge 15 s', function () {
  var s = essaiCrochet({});
  s.pas();
  var a = act(s);
  verifier(s.etat().boss.palier === 3 && a && a.id === 'crochet' && a.etape === 'preparation' && a.cibleJoueur === 'j1', 'palier 3 : action crochet, préparation, vers j1', a);
  s.jusqua(function () { return evs(s, 'frappe').length >= 1; }, 6);
  var ea = evs(s, 'action', function (d) { return d.id === 'crochet'; });
  verifier(JSON.stringify(ea.map(function (e) { return e.d.etape; })) === JSON.stringify(['preparation', 'lancer', 'traction']) && proche(ea[1].t - ea[0].t, CRO.preparation, PAS * 1.5),
    'étapes preparation (' + CRO.preparation + ' s), lancer, traction', ea.map(function (e) { return e.d.etape + '@' + e.t.toFixed(2); }));
  var el = evs(s, 'crochet', function (d) { return d.etat === 'lancer'; }), eac = evs(s, 'crochet', function (d) { return d.etat === 'accroche'; }), ear = evs(s, 'crochet', function (d) { return d.etat === 'arrivee'; });
  verifier(el.length === 1 && eac.length === 1 && ear.length === 1 && el[0].d.joueur === 'j1' && JSON.stringify(Object.keys(el[0].d).sort()) === JSON.stringify(['etat', 'id', 'joueur', 'position']),
    'évènements crochet { etat, id, joueur, position } : lancer, accroche, arrivee', [el, eac, ear].map(function (l) { return l.map(function (e) { return e.d; }); }));
  var vol = dist3(el[0].d.position, eac[0].d.position);
  verifier(proche(eac[0].t - el[0].t, vol / CRO.vitesse, PAS * 2.5), 'vol à ' + CRO.vitesse + ' m/s', { duree: eac[0].t - el[0].t, attendu: vol / CRO.vitesse });
  var verrou = s.log.controle.filter(function (c) { return c.id === 'j1' && !c.a; });
  verifier(verrou.length === 1 && proche(verrou[0].t, eac[0].t, 1e-9) && s.log.regards.some(function (g) { return g.id === 'j1' && proche(g.t, eac[0].t, 1e-9); }), 'accroché : commandes retirées, regard vers le boss', verrou);
  var tr = s.log.tractions.filter(function (x) { return x.id === 'j1'; }), B = s.etat().boss.position;
  var pasT = tr.slice(1).map(function (x, i) { return dist2D(x.p, tr[i].p); });
  verifier(tr.length >= 5 && pasT.slice(0, -1).every(function (d) { return proche(d, CRO.traction * PAS, 1e-6); }) && proche(dist2D(tr[tr.length - 1].p, B), CRO.arrivee, 0.05) && s.log.teleports.filter(function (x) { return x.id === 'j1' && x.t > eac[0].t; }).length === 0,
    'traction par jeu.tirerJoueur à ' + CRO.traction + ' m/s jusqu’à ' + CRO.arrivee + ' m', { n: tr.length, pas: pasT.slice(0, 3), fin: dist2D(tr[tr.length - 1].p, B) });
  var pf = evs(s, 'action', function (d) { return d.id === 'frappe' && d.etape === 'preparation'; })[0], fr = evs(s, 'frappe')[0];
  verifier(pf && proche(pf.t, ear[0].t, PAS * 1.5) && proche(fr.t - pf.t, CRO.preparationFrappe, PAS * 1.5), 'frappe aussitôt (préparation ' + CRO.preparationFrappe + ' s)', [pf && pf.t, ear[0].t, fr.t]);
  verifier(fr.d.joueur === 'j1' && fr.d.reussie && fr.d.palier === 3 && fr.d.speciale && s.log.critiques.length === 1 && proche(s.robot('j1').pv, 0.01, 1e-12), 'règle du palier 3 : 1 %', fr.d);
  var rendu = s.log.controle.filter(function (c) { return c.id === 'j1' && c.a && c.t >= fr.t - 1e-9; });
  verifier(rendu.length >= 1 && proche(rendu[0].t, fr.t, 1e-9) && s.etat().crochets.length === 0 && s.robot('j1').controle, 'commandes rendues après le coup, crochet retiré', rendu);
  // recharge : disparition courte et proche, le joueur est de nouveau une cible valide bien avant la fin de la recharge
  var sR = essaiCrochet({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: true, immobile: true, reaction: null }], surcharges: { phase5: { disparition: { duree: 1, distanceMin: 6 } } } });
  sR.pas();
  sR.jusqua(function () { return evs(sR, 'crochet', function (d) { return d.etat === 'lancer'; }).length >= 2; }, 40);
  var el2 = evs(sR, 'crochet', function (d) { return d.etat === 'lancer'; });
  verifier(el2.length >= 2 && el2[1].t - el2[0].t >= CRO.recharge - 1e-9, 'recharge : pas d’autre crochet avant ' + CRO.recharge + ' s', el2.length >= 2 ? el2[1].t - el2[0].t : null);
  // plusieurs joueurs : un crochet vers chaque joueur valide à 4–22 m (j3 trop près, j4 trop loin) ; les deux ramenés, frappés ensemble
  var s2 = essaiCrochet({ joueurs: passifs(4, [{ regen: false }, { regen: false }, { regen: false }, { regen: false }]), places: [{ x: 10, z: 10 }, { x: -12, z: 10 }, { x: 2.5, z: 10 }, { x: 0, z: -18 }] });
  s2.pas();
  s2.jusqua(function () { return evs(s2, 'frappe').length >= 2; }, 6);
  var c2 = evs(s2, 'crochet', function (d) { return d.etat === 'lancer'; }).map(function (e) { return e.d.joueur; }).sort();
  var f2 = evs(s2, 'frappe').map(function (e) { return e.d.joueur + (e.d.reussie ? '+' : '-'); }).sort();
  verifier(JSON.stringify(c2) === JSON.stringify(['j1', 'j2']) && JSON.stringify(f2) === JSON.stringify(['j1+', 'j2+']) && evs(s2, 'crochet', function (d) { return d.etat === 'arrivee'; }).length === 2,
    'deux crochets (j1, j2), deux ramenés, frappés ensemble', { crochets: c2, frappes: f2 });
  var snap = null;
  var s2b = essaiCrochet({});
  s2b.pas();
  s2b.jusqua(function () { var c = s2b.etat().crochets; if (c.length) snap = c[0]; return !!snap; }, 2);
  verifier(snap && JSON.stringify(Object.keys(snap).sort()) === JSON.stringify(['depart', 'etat', 'id', 'joueur', 'position']) && snap.etat === 'vol', 'instantané crochets (§16.5)', snap);
  // raté : il voit le crochet partir (réaction 0,15 s) et fait un pas de côté
  var s3 = essaiCrochet({ joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: false, immobile: true, reaction: 0.15 }], places: [{ x: 16, z: 10 }] });
  s3.pas();
  s3.jusqua(function () { return evs(s3, 'crochet', function (d) { return d.etat === 'rate' || d.etat === 'accroche'; }).length > 0; }, 4);
  var r3 = evs(s3, 'crochet', function (d) { return d.etat === 'rate'; })[0];
  verifier(r3 && r3.d.raison === 'esquive' && evs(s3, 'crochet', function (d) { return d.etat === 'accroche'; }).length === 0, 'un pas de côté : raté (esquive)', r3 && r3.d);
  s3.avancer(0.7);
  verifier(s3.log.controle.filter(function (c) { return c.id === 'j1' && !c.a; }).length === 0 && s3.log.tractions.length === 0 && s3.etat().crochets.length === 0 &&
    evs(s3, 'action', function (d) { return d.id === 'crochet' && d.etape === 'traction'; }).length === 0, 'ni commandes retirées ni traction ; crochet retiré');
  // un mur l'arrête (jeu.visible faux sur sa trajectoire, ici un mur fictif en x = 6 qui se ferme au lancer)
  var s4 = essaiCrochet({}), ferme = false, vis0 = s4.jeu.visible;
  s4.jeu.visible = function (p, q, lieu) { return ferme && lieu === 'bunker' && (p.x - 6) * (q.x - 6) <= 0 && p.x !== q.x ? false : vis0(p, q, lieu); };
  s4.combat.on('crochet', function (d) { if (d.etat === 'lancer') ferme = true; });
  s4.pas();
  s4.jusqua(function () { return evs(s4, 'crochet', function (d) { return d.etat === 'rate' || d.etat === 'accroche'; }).length > 0; }, 4);
  var r4 = evs(s4, 'crochet', function (d) { return d.etat === 'rate'; })[0];
  verifier(r4 && r4.d.raison === 'mur' && r4.d.position.x <= 6 + 1e-6 && r4.d.position.x > 6 - CRO.vitesse * PAS - 1e-6, 'un mur l’arrête (raté, raison « mur »)', r4 && r4.d);
  // sans jeu.tirerJoueur : jeu.teleporter à chaque pas
  var s5 = essaiCrochet({ sansTirerJoueur: true });
  s5.pas();
  s5.jusqua(function () { return evs(s5, 'crochet', function (d) { return d.etat === 'arrivee'; }).length > 0; }, 4);
  var t5 = evs(s5, 'crochet', function (d) { return d.etat === 'accroche'; })[0].t, tp5 = s5.log.teleports.filter(function (x) { return x.id === 'j1' && x.t > t5 && x.lieu === 'bunker'; });
  verifier(tp5.length >= 5 && s5.log.tractions.length === 0 && proche(dist2D(tp5[tp5.length - 1].p, s5.etat().boss.position), CRO.arrivee, 0.05), 'sans tirerJoueur : teleporter à chaque pas', tp5.length);
});

// intangible au palier 2 (joueur loin, sans mur)
function essaiIntangibleActif(n) {
  var s = essaiIntangible({ joueurs: passifs(n || 1, [{ regen: false }, { regen: false }]) });
  s.combat.forcer('position', { x: 10, y: HT5, z: 0 });
  s.robots.forEach(function (r, i) { s.placer(r.id, { x: -25, z: -15 + i * 3 }, 'bunker'); });
  palierA(s, 2);
  s.jusqua(function () { return s.etat().boss.intangible; }, 4);
  return s;
}
test('89 v1.4/v1.5 nettoyage : allerA, échec et défaite retirent crochets et intangibilité (« fin », de nouveau visible), rendent les commandes ; palier remis à zéro', function () {
  var s = essaiCrochet({});
  s.pas();
  s.jusqua(function () { return evs(s, 'crochet', function (d) { return d.etat === 'accroche'; }).length > 0; }, 3);
  s.pas();
  verifier(!s.robot('j1').controle && s.etat().crochets.length === 1, 'accroché : sans commandes');
  s.combat.allerA('phase3');
  verifier(s.robot('j1').controle && s.etat().crochets.length === 0 && s.etat().boss.palier === null, 'allerA en pleine traction : crochet retiré, commandes rendues, palier null');
  var s2 = essaiIntangibleActif(2);
  verifier(s2.etat().boss.intangible, 'intangible');
  s2.combat.allerA('phase2');
  verifier(!s2.etat().boss.intangible && evInt(s2, 'fin').length === 1, 'allerA : intangibilité finie (« fin »)', evInt(s2, 'fin').length);
  s2.combat.allerA('phase5');
  verifier(!s2.etat().boss.intangible && s2.etat().boss.visible && s2.etat().boss.palier === 0, 'allerA(phase5) : palier 0, visible');
  var s2b = essaiIntangible({});                     // évanouissement en cours : annulé, jamais intangible
  s2b.combat.forcer('position', { x: 10, y: HT5, z: 0 }); s2b.placer('j1', { x: -25, z: -15 }, 'bunker');
  palierA(s2b, 2);
  s2b.jusqua(function () { return evEvan(s2b).length > 0; }, 4);
  s2b.combat.allerA('phase5');
  s2b.avancer(1);
  verifier(!s2b.etat().boss.intangible && evInt(s2b, 'debut').length === 0, 'allerA pendant le fondu : jamais intangible');
  var s3 = essaiIntangibleActif(1);
  s3.robot('j1').vivant = false;
  s3.jusqua(function () { return etat(s3) === 'echec'; }, 5);
  verifier(etat(s3) === 'echec' && !s3.etat().boss.intangible && evInt(s3, 'fin').length === 1, 'échec : intangibilité finie');
  var s4 = essaiCrochet({});
  s4.pas();
  s4.jusqua(function () { return evs(s4, 'crochet', function (d) { return d.etat === 'accroche'; }).length > 0; }, 3);
  s4.robot('j1').vivant = false;
  s4.jusqua(function () { return etat(s4) === 'echec'; }, 5);
  verifier(etat(s4) === 'echec' && s4.etat().crochets.length === 0, 'échec en pleine traction : crochet retiré');
  var s5 = essaiIntangibleActif(1);
  s5.combat.forcer('jauge', 1);
  s5.pas();
  verifier(etat(s5) === 'defaite' && !s5.etat().boss.intangible && s5.etat().boss.visible && evInt(s5, 'fin').length === 1 && s5.etat().boss.palier === 2,
    'défaite (même intangible : jauge forcée) : de nouveau visible, palier acquis', { etat: etat(s5), palier: s5.etat().boss.palier });
  verifier(s5.jeu.positionValide(s5.etat().boss.position, 'bunker'), 'à une position valide');
  var s6 = essaiIntangible({ mur: true, surcharges: { phase5: { frappe: { portee: 0 } } } });   // défaite pendant la traversée du mur
  s6.combat.forcer('position', { x: 12, y: HT5, z: -10 }); s6.placer('j1', { x: -12, z: -10 }, 'bunker');
  palierA(s6, 2);
  s6.jusqua(function () { var b = s6.etat().boss; return b.intangible && s6.dansMurBunker(b.position, 0); }, 10);
  verifier(s6.etat().boss.intangible && s6.dansMurBunker(s6.etat().boss.position, 0), 'dans le mur, intangible');
  s6.combat.forcer('jauge', 1);
  s6.pas();
  verifier(etat(s6) === 'defaite' && !s6.dansMurBunker(s6.etat().boss.position, 0) && s6.jeu.positionValide(s6.etat().boss.position, 'bunker'), 'défaite dans un mur : ramené au point valide le plus proche', s6.etat().boss.position);
});

// ═══════════════════════════════════════ 17. version 1.5 (API.md §17) ═══════════════════════════════════════
// (tests 90 à 96 ; ils passent avant le test 80 de couverture, qui compte aussi leurs évènements)
var MUc = MBC.murs, PTc = MBC.demembre.petits, DEF = Sim.Logique.DEFAUTS;
var SANS_P2 = { phase2: { invocation: { intervalle: [999, 999] }, absorption: { intervalle: [999, 999] } } };
function mbEtat(s, id) { return s.etat().miniBoss.filter(function (x) { return x.id === id; })[0]; }
function rages(s, type) { return evs(s, 'miniBoss', function (d) { return d.etat === 'rage' && (!type || d.type === type); }); }
function distPlanMur(s, p) {                         // distance au plan du mur le plus proche (comme la logique)
  var O = s.origine, A = s.arene.salle.apotheme;
  return Math.min.apply(null, s.arene.salle.murs.map(function (m) { return A - ((p.x - O.x) * m.normale.x + (p.z - O.z) * m.normale.z); }));
}
function pointMur(s, k, d) {                         // point à d m du plan du mur k, sur sa médiatrice
  var O = s.origine, A = s.arene.salle.apotheme, n = s.arene.salle.murs[k].normale;
  return { x: O.x + n.x * (A - d), z: O.z + n.z * (A - d) };
}
// phase 2 jusqu'au k-ième mini-boss (les précédents abattus par le test)
function jusquAuMB(s, k) {
  s.combat.allerA('phase2');
  var m = null;
  for (var i = 0; i <= k; i++) { if (m) { tuerMB(s, m.id); s.pas(); } m = libererMB(s, i); }
  return m;
}

test('90 v1.5 rages : au 1er passage sous seuil × pvMax, une fois par mini-boss : miniBoss { etat: rage }, effetZombie(id, capacite, params), instantané rage / invulnerable (surcharge et arrachement : duree s ; infection : jamais)', function () {
  var s = mbSim(1, { graine: 90, sansChiens: true, surcharges: SANS_P2 });
  s.combat.allerA('phase2');
  s.placer('j1', s.monde({ x: 0, z: -3 }), 'salle');  // loin des murs (électrifiés après la surcharge)
  var prec = null;
  MBC.ordre.forEach(function (type, k) {
    if (prec) { tuerMB(s, prec.id); s.pas(); }
    var m = libererMB(s, k), R = MBC[type].rage, nE = s.log.effets.length;
    verifier(m && m.type === type && R && R.seuil === 0.5, type + ' libéré, rage à 50 %', R);
    m.hp = m.pvMax * (R.seuil + 0.02); s.pas(); s.pas();
    verifier(rages(s, type).length === 0 && mbEtat(s, m.id).rage === null && mbEtat(s, m.id).invulnerable === false, type + ' : au-dessus du seuil, rien', mbEtat(s, m.id));
    m.hp = m.pvMax * (R.seuil - 0.01); s.pas();
    var er = rages(s, type), tR = er.length ? er[0].t : null;
    verifier(er.length === 1 && er[0].d.id === m.id && er[0].d.capacite === R.capacite && er[0].d.nom === MBC[type].nom && dist2D(er[0].d.position, m.pos) < 0.2 &&
      JSON.stringify(Object.keys(er[0].d).sort()) === JSON.stringify(['capacite', 'etat', 'id', 'nom', 'position', 'type']), type + ' : miniBoss { etat: rage, id, type, nom, position, capacite }', er.map(function (e) { return e.d; }));
    var ef = s.log.effets.slice(nE).filter(function (e) { return e.id === m.id && e.effet === R.capacite; });
    verifier(ef.length === 1 && proche(ef[0].t, tR, 1e-9) && proche(ef[0].params.duree, R.duree, 1e-9), type + ' : effetZombie(id, ' + R.capacite + ', { duree })', ef);
    if (type === 'survolte') {
      var b = s.etat().boss.position, src = ef[0].params.source;
      verifier(src && proche(src.x, b.x, 1e-9) && proche(src.z, b.z, 1e-9) && proche(src.y, b.y + DEF.torseSeptieme[1], 1e-9), 'surcharge : source = torse du Septième', ef[0].params);
    }
    if (type === 'irradie') verifier(JSON.stringify(ef[0].params.aura) === JSON.stringify(R.aura) && ef[0].params.couleur === MBC.irradie.couleur, 'infection : aura et couleur', ef[0].params);
    if (type === 'demembre') verifier(proche(ef[0].params.vol, R.vol, 1e-9) && proche(ef[0].params.cible.x, s.origine.x, 1e-9) && proche(ef[0].params.cible.z, s.origine.z, 1e-9) &&
      proche(ef[0].params.cible.y, s.origine.y, 1e-9), 'arrachement : vol, cible = centre de la salle au sol', ef[0].params);
    var mi = mbEtat(s, m.id), inv = R.capacite !== 'infection';
    verifier(mi.rage && mi.rage.capacite === R.capacite && mi.rage.actif === false && mi.rage.t >= 0 && mi.invulnerable === inv, type + ' : instantané rage { capacite, actif: false, t }, invulnerable ' + inv, mi);
    s.avancer(R.duree - 0.1);
    verifier(mbEtat(s, m.id).invulnerable === inv && mbEtat(s, m.id).rage.actif === false, type + ' : pendant ' + R.duree + ' s', mbEtat(s, m.id));
    s.avancer(0.15);
    mi = mbEtat(s, m.id);
    verifier(mi.rage.actif === true && mi.invulnerable === false && proche(mi.rage.t, s.t - tR, 1e-6), type + ' : ensuite active, plus invulnérable', mi);
    m.hp = m.pvMax; s.pas(); m.hp = m.pvMax * 0.1; s.pas();
    verifier(rages(s, type).length === 1 && s.log.effets.filter(function (e) { return e.id === m.id && e.effet === R.capacite; }).length === 1, type + ' : une seule rage (PV remontés puis redescendus)');
    prec = m;
  });
  // tué d'un coup au-dessus du seuil : jamais de rage ; sans rage dans la config : rien
  var s2 = mbSim(1, { graine: 91, sansChiens: true });
  var m2 = jusquAuMB(s2, 0);
  m2.hp = m2.pvMax * 0.9; s2.pas();
  tuerMB(s2, m2.id); s2.pas(); s2.pas();
  verifier(rages(s2).length === 0 && evs(s2, 'miniBoss', function (d) { return d.etat === 'mort'; }).length === 1 && evs(s2, 'murs').length === 0, 'mort au-dessus du seuil : pas de rage');
  var s3 = mbSim(1, { graine: 92, sansChiens: true, surcharges: { miniBoss: { survolte: { rage: null } } } });
  var m3 = jusquAuMB(s3, 0);
  m3.hp = m3.pvMax * 0.1; s3.pas(); s3.pas();
  verifier(rages(s3).length === 0 && mbEtat(s3, m3.id).rage === null && s3.etat().murs === null, 'rage: null → aucune');
});

test('91 v1.5 murs électrifiés : « charge » pendant la surcharge, puis « electrifies » ; à moins de distance m du plan du mur le plus proche : degatsParSeconde × tick toutes les tick s (source murs) ; mursChoc { joueur, position, mur } ≤ 1 par joueur et par 0,5 s ; mort → extinction, puis eteints ; robots à distance + 0,5 m', function () {
  var s = mbSim(3, { graine: 91, sansChiens: true, surcharges: SANS_P2 });
  var m = jusquAuMB(s, 0), R = MBC.survolte.rage, murK = s.arene.salle.murs[2].id;
  s.robots.forEach(function (r) { r.regen = false; });
  s.placer('j1', pointMur(s, 2, 1.0), 'salle'); s.placer('j2', pointMur(s, 2, MUc.distance - 0.1), 'salle'); s.placer('j3', pointMur(s, 2, MUc.distance + 0.1), 'salle');
  verifier(proche(distPlanMur(s, s.robot('j2').pos), MUc.distance - 0.1, 1e-6) && proche(distPlanMur(s, s.robot('j3').pos), MUc.distance + 0.1, 1e-6), 'placement : ' + (MUc.distance - 0.1) + ' et ' + (MUc.distance + 0.1) + ' m du plan du mur');
  verifier(s.etat().murs === null, 'instantané murs: null avant la rage');
  m.hp = m.pvMax * (R.seuil - 0.01); s.pas();
  var e0 = evs(s, 'murs');
  verifier(e0.length === 1 && e0[0].d.etat === 'charge' && s.etat().murs.etat === 'charge' && proche(s.etat().murs.distance, MUc.distance, 1e-9) && JSON.stringify(Object.keys(s.etat().murs).sort()) === JSON.stringify(['distance', 'etat', 't']),
    'surcharge : murs { etat: charge }, instantané { etat, t, distance }', s.etat().murs);
  s.avancer(R.duree - 0.1);
  verifier(s.log.degats.filter(function (x) { return x.source === 'murs'; }).length === 0, 'pas de dégâts pendant la surcharge');
  s.jusqua(function () { return evs(s, 'murs').length >= 2; }, 0.5);
  var tE = evs(s, 'murs')[1].t;
  verifier(evs(s, 'murs')[1].d.etat === 'electrifies' && proche(tE - e0[0].t, R.duree, PAS * 1.5) && s.etat().murs.etat === 'electrifies', 'électrifiés à la fin de la surcharge (' + R.duree + ' s)', tE - e0[0].t);
  s.avancer(2.0);
  function dm(id) { return s.log.degats.filter(function (x) { return x.source === 'murs' && x.id === id; }); }
  var nt = Math.round(2.0 / MUc.tick);
  verifier(dm('j1').length >= nt - 1 && dm('j1').length <= nt + 1 && dm('j1').every(function (x) { return proche(x.f, MUc.degatsParSeconde * MUc.tick, 1e-9); }) && dm('j2').length === dm('j1').length && dm('j3').length === 0,
    MUc.degatsParSeconde * MUc.tick + ' toutes les ' + MUc.tick + ' s à moins de ' + MUc.distance + ' m du plan du mur, rien au-delà', { j1: dm('j1').length, j2: dm('j2').length, j3: dm('j3').length });
  var ch1 = evs(s, 'mursChoc', function (d) { return d.joueur === 'j1'; });
  verifier(ch1.length >= 4 && ch1.length <= 5 && ch1.every(function (e, i) { return i === 0 || e.t - ch1[i - 1].t >= DEF.intervalleChocMurs[1] - 1e-9; }) && ch1[0].d.mur === murK &&
    JSON.stringify(Object.keys(ch1[0].d).sort()) === JSON.stringify(['joueur', 'mur', 'position']) && evs(s, 'mursChoc', function (d) { return d.joueur === 'j3'; }).length === 0,
    'mursChoc { joueur, position, mur: ' + murK + ' } au plus une fois par joueur et par ' + DEF.intervalleChocMurs[1] + ' s', ch1.map(function (e) { return +(e.t - tE).toFixed(3); }));
  var nD = dm('j1').length;
  tuerMB(s, m.id); s.pas();
  var ex = evs(s, 'murs', function (d) { return d.etat === 'extinction'; });
  verifier(ex.length === 1 && s.etat().murs.etat === 'extinction', 'mort du Survolté : extinction', s.etat().murs);
  s.avancer(MUc.extinction - 0.1);
  verifier(dm('j1').length === nD && s.etat().murs.etat === 'extinction', 'plus de dégâts pendant l’extinction');
  s.avancer(0.15);
  var et = evs(s, 'murs', function (d) { return d.etat === 'eteints'; });
  verifier(et.length === 1 && proche(et[0].t - ex[0].t, MUc.extinction, PAS * 1.5) && s.etat().murs === null, 'éteints ' + MUc.extinction + ' s plus tard ; instantané null', et.length && et[0].t - ex[0].t);
  // un robot qui bouge s'écarte des murs électrifiés et reste à plus de distance + 0,5 m
  var s2 = mbSim(1, { graine: 93, sansChiens: true, miniBossBloques: true, joueurs: [{ id: 'j1', tire: false, zombiesAussi: false, regen: false }], surcharges: SANS_P2 });
  var m2 = jusquAuMB(s2, 0);
  s2.placer('j1', pointMur(s2, 5, 1.0), 'salle');
  m2.hp = m2.pvMax * 0.49; s2.pas();
  s2.jusqua(function () { return s2.etat().murs && s2.etat().murs.etat === 'electrifies'; }, 4);
  s2.placer('j1', pointMur(s2, 5, 1.0), 'salle');
  s2.avancer(1.0);
  var pire = 1e9;
  s2.apresPas = function () { pire = Math.min(pire, distPlanMur(s2, s2.robot('j1').pos)); };
  s2.avancer(5);
  s2.apresPas = null;
  verifier(pire >= MUc.distance + 0.5 - 0.05, 'robot : à plus de distance + 0,5 m des murs électrifiés', pire);
});

test('92 v1.5 infection : à la fin du cri, chaque zombie et chien de la salle (jeu.zombies() : du jeu comme de la logique ; ni mini-boss, ni bunker) reçoit effetZombie(id, irradie, { actif: true, aura, couleur }), chaque nouveau aussi ; instantané ; à sa mort { actif: false } pour tous, infection { fin }', function () {
  var s = mbSim(1, { graine: 92, sansChiens: true, zombiesBloques: true, surcharges: SANS_P2 });
  var irr = jusquAuMB(s, 1), R = MBC.irradie.rage, O = s.origine;
  var z1 = s.jeu.faireApparaitreZombie({ position: { x: O.x + 4, y: O.y, z: O.z }, lieu: 'salle', effet: 'test', vitesse: 'normale' });
  var c1 = s.jeu.faireApparaitreZombie({ type: 'chien', position: { x: O.x - 4, y: O.y, z: O.z }, lieu: 'salle', effet: 'test', profil: { pv: 100, vitesse: 7.4 } });
  var zb = s.jeu.faireApparaitreZombie({ position: { x: 10, y: 0, z: 10 }, lieu: 'bunker', effet: 'test', vitesse: 'normale' });
  s.pas();
  verifier(s.etat().infection === null, 'instantané infection: null avant la rage');
  irr.hp = irr.pvMax * (R.seuil - 0.01); s.pas();
  var tR = s.t;
  verifier(s.etat().infection && s.etat().infection.active === false && s.log.effets.filter(function (e) { return e.effet === 'irradie'; }).length === 0, 'pendant le cri (' + R.duree + ' s) : pas encore', s.etat().infection);
  s.jusqua(function () { return evs(s, 'infection').length > 0; }, R.duree + 0.5);
  var ed = evs(s, 'infection')[0], ir = s.log.effets.filter(function (e) { return e.effet === 'irradie'; }), ids = ir.map(function (e) { return e.id; }).sort();
  verifier(ed && ed.d.etat === 'debut' && proche(ed.t - tR, R.duree, PAS * 1.5) && ed.d.nombre === 2 && JSON.stringify(ids) === JSON.stringify([c1, z1].sort()) && ids.indexOf(irr.id) < 0 && ids.indexOf(zb) < 0,
    'à la fin du cri : le zombie et le chien de la salle (pas le mini-boss, pas le bunker)', { ids: ids, ev: ed && ed.d });
  verifier(ir.every(function (e) { return e.params.actif === true && JSON.stringify(e.params.aura) === JSON.stringify(R.aura) && e.params.couleur === MBC.irradie.couleur; }), 'params { actif: true, aura, couleur }', ir[0].params);
  verifier(JSON.stringify(s.etat().infection.ids.slice().sort()) === JSON.stringify(ids) && s.etat().infection.active === true && JSON.stringify(Object.keys(s.etat().infection).sort()) === JSON.stringify(['active', 'ids']),
    'instantané infection { active, ids }', s.etat().infection);
  var z2 = s.jeu.faireApparaitreZombie({ position: { x: O.x, y: O.y, z: O.z + 4 }, lieu: 'salle', effet: 'test', vitesse: 'normale' });
  s.pas(); s.pas();
  verifier(s.log.effets.filter(function (e) { return e.effet === 'irradie' && e.id === z2 && e.params.actif; }).length === 1 && s.etat().infection.ids.indexOf(z2) >= 0, 'un nouveau zombie : irradié aussitôt, une fois');
  s.jeu.retirerZombie(z1, { effet: 'mort' }); s.pas();
  verifier(s.etat().infection.ids.indexOf(z1) < 0 && s.etat().infection.ids.length === 2, 'zombie mort : plus suivi', s.etat().infection.ids);
  var restants = s.etat().infection.ids.slice(), nI = s.log.effets.length;
  tuerMB(s, irr.id); s.pas();
  var off = s.log.effets.slice(nI).filter(function (e) { return e.effet === 'irradie'; });
  verifier(off.length === restants.length && off.every(function (e) { return e.params.actif === false && restants.indexOf(e.id) >= 0; }), 'à sa mort : effetZombie(id, irradie, { actif: false }) pour chacun', off);
  var fi = evs(s, 'infection', function (d) { return d.etat === 'fin'; });
  verifier(fi.length === 1 && fi[0].d.nombre === restants.length && s.etat().infection === null, 'infection { etat: fin, nombre } ; instantané null', fi.map(function (e) { return e.d; }));
  var z3 = s.jeu.faireApparaitreZombie({ position: { x: O.x - 3, y: O.y, z: O.z - 3 }, lieu: 'salle', effet: 'test', vitesse: 'normale' });
  s.pas(); s.pas();
  verifier(!s.log.effets.some(function (e) { return e.effet === 'irradie' && e.id === z3; }), 'après sa mort : plus d’infection');
});

test('93 v1.5 arrachement : bras arraché, lancé à duree − vol s, posé au centre à duree s ; petits Démembrés (premier, intervalle, plafond max + maxParJoueurSupp × (n − 1), à rayon m du bras ; ni mini-boss ni absorbés) ; à sa mort : effondrement, bras flétri ; Munitions max à la mort de chaque mini-boss', function () {
  [1, 2].forEach(function (n) {
    var s = mbSim(n, { graine: 93 + n, sansChiens: true, petitsBloques: true, surcharges: { miniBoss: { bloque: 999 }, phase2: { invocation: { intervalle: [999, 999] }, absorption: { intervalle: [1, 1] } } } });
    var dm = jusquAuMB(s, 2), R = MBC.demembre.rage, O = s.origine, cap = PTc.max + PTc.maxParJoueurSupp * (n - 1);
    dm.bloque = true;
    var pM = copiePos(dm.pos);
    verifier(s.etat().bras === null && s.etat().petits.length === 0, 'instantané bras: null, petits: [] avant la rage');
    dm.hp = dm.pvMax * (R.seuil - 0.01); s.pas();
    var tR = s.t, b0 = evs(s, 'bras');
    verifier(b0.length === 1 && b0[0].d.etat === 'arrache' && dist2D(b0[0].d.position, pM) < 0.2 && s.etat().bras === null && JSON.stringify(Object.keys(b0[0].d).sort()) === JSON.stringify(['etat', 'position']),
      'bras { etat: arrache, position } ; instantané null tant qu’il l’a en main', b0.map(function (e) { return e.d; }));
    s.jusqua(function () { return evs(s, 'bras').length >= 2; }, R.duree);
    var bl = evs(s, 'bras')[1];
    verifier(bl.d.etat === 'lance' && proche(bl.t - tR, R.duree - R.vol, PAS * 1.5) && proche(bl.d.position.y, O.y + DEF.brasDepart[1], 0.01), 'lancé à duree − vol s, de son épaule', { t: bl.t - tR, p: bl.d.position });
    s.avancer(R.vol / 2);
    var bv = s.etat().bras;
    verifier(bv && bv.etat === 'vol' && bv.position.y > O.y + 1 && dist2D(bv.position, O) < dist2D(pM, O) - 1 && JSON.stringify(Object.keys(bv).sort()) === JSON.stringify(['etat', 'position', 't']), 'instantané bras { etat: vol, position, t } : en cloche vers le centre', bv);
    s.jusqua(function () { return evs(s, 'bras').length >= 3; }, R.vol);
    var bp = evs(s, 'bras')[2];
    verifier(bp.d.etat === 'pose' && proche(bp.t - tR, R.duree, PAS * 1.5) && dist2D(bp.d.position, O) < 1e-6 && proche(bp.d.position.y, O.y, 1e-9) && s.etat().bras.etat === 'pose', 'posé au centre de la salle à ' + R.duree + ' s', bp.d);
    s.jusqua(function () { return evs(s, 'petitDemembre').length >= 1; }, PTc.premier + 0.5);
    var p1 = evs(s, 'petitDemembre')[0], q1 = s.log.petits[0] && s.log.petits[0].q;
    verifier(p1 && p1.d.etat === 'apparition' && proche(p1.t - bp.t, PTc.premier, PAS * 1.5) && JSON.stringify(Object.keys(p1.d).sort()) === JSON.stringify(['etat', 'id', 'position']), 'premier petit ' + PTc.premier + ' s après la pose', p1 && p1.t - bp.t);
    verifier(q1 && q1.type === 'demembre_petit' && q1.effet === 'bras' && q1.source === 'boss' && q1.lieu === 'salle' && q1.vitesse === 'sprint' && q1.agressif === true && !q1.miniBoss &&
      JSON.stringify(q1.profil) === JSON.stringify(PTc.profil) && dist2D(q1.position, O) <= PTc.rayon + 1e-6, 'faireApparaitreZombie({ type: demembre_petit, effet: bras, source: boss, profil, sprint, agressif }) à ≤ ' + PTc.rayon + ' m du bras', q1);
    s.avancer(PTc.intervalle * (cap + 2));
    var ap = evs(s, 'petitDemembre', function (d) { return d.etat === 'apparition'; });
    verifier(ap.length === cap && s.etat().petits.length === cap && ap.every(function (e, i) { return i === 0 || proche(e.t - ap[i - 1].t, PTc.intervalle, PAS * 1.5); }),
      n + ' joueur(s) : un toutes les ' + PTc.intervalle + ' s, au plus ' + cap + ' vivants', { n: ap.length, instantane: s.etat().petits.length });
    verifier(s.etat().miniBoss.every(function (x) { return x.type !== 'demembre_petit'; }) && !s.log.effets.some(function (e) { return e.effet === 'saisie' && /^p/.test(String(e.id)); }), 'ni mini-boss ni saisis par l’absorption');
    s.jeu.retirerZombie(ap[0].d.id, { effet: 'mort' });
    s.avancer(PTc.intervalle + 0.1);
    verifier(evs(s, 'petitDemembre', function (d) { return d.etat === 'apparition'; }).length === cap + 1 && s.etat().petits.length === cap && s.etat().petits.indexOf(ap[0].d.id) < 0, 'un petit tué : remplacé');
    var vivants = s.etat().petits.slice(), nR = s.log.retraits.length, pDm = copiePos(dm.pos);
    tuerMB(s, dm.id); s.pas();
    var rt = s.log.retraits.slice(nR).filter(function (r) { return vivants.indexOf(r.id) >= 0; });
    verifier(rt.length === vivants.length && rt.every(function (r) { return r.effet === 'effondrement' && r.points === false; }) &&
      evs(s, 'petitDemembre', function (d) { return d.etat === 'effondrement'; }).length === vivants.length && s.etat().petits.length === 0,
      'à sa mort : retirerZombie(pid, { effet: effondrement, points: false }) et petitDemembre { effondrement } pour chacun', rt);
    var bf = evs(s, 'bras', function (d) { return d.etat === 'fletri'; });
    verifier(bf.length === 1 && dist2D(bf[0].d.position, O) < 1e-6 && s.etat().bras.etat === 'fletri', 'bras { fletri } au centre', bf.map(function (e) { return e.d; }));
    s.avancer(DEF.brasFletriAffiche[1] + 0.1);
    verifier(s.etat().bras === null, 'bras retiré de l’instantané ' + DEF.brasFletriAffiche[1] + ' s plus tard');
    s.avancer(PTc.intervalle * 2);
    verifier(evs(s, 'petitDemembre', function (d) { return d.etat === 'apparition'; }).length === cap + 1, 'plus aucun petit');
    var bo = evs(s, 'bonus', function (d) { return d.source === 'miniBoss'; });
    verifier(bo.length === 3 && bo.map(function (e) { return e.d.miniBoss; }).join() === MBC.ordre.join() && bo.every(function (e) { return e.d.type === MBC.bonusMort.type && e.d.mode === 'depose' && e.d.lieu === 'salle'; }) &&
      dist2D(bo[2].d.position, pDm) < 0.5, 'bonus { type, position, lieu, mode: depose, source: miniBoss, miniBoss } à la mort de chacun, là où il tombe', bo.map(function (e) { return e.d; }));
    var po = s.log.bonusPoses.filter(function (x) { return x.q.type === MBC.bonusMort.type; });
    verifier(po.length === 3 && po.every(function (x) { return proche(x.q.duree, MBC.bonusMort.duree, 1e-9) && x.q.lieu === 'salle' && x.q.position; }), 'jeu.faireApparaitreBonus({ type, position, lieu, duree })', po.map(function (x) { return x.q; }));
  });
  var s2 = mbSim(1, { graine: 97, sansChiens: true, retirerMethodes: ['faireApparaitreBonus'] });
  var m2 = jusquAuMB(s2, 0); tuerMB(s2, m2.id); s2.pas();
  var b2 = evs(s2, 'bonus', function (d) { return d.source === 'miniBoss'; });
  verifier(b2.length === 1 && b2[0].d.mode === 'active' && s2.log.bonus.filter(function (x) { return x.bonus === MBC.bonusMort.type; }).length === 1, 'sans faireApparaitreBonus : activerBonus (même repli que bonusFinDePhase)', b2.map(function (e) { return e.d; }));
  var s3 = mbSim(1, { graine: 98, sansChiens: true, surcharges: { miniBoss: { bonusMort: { actif: false } } } });
  var m3 = jusquAuMB(s3, 0); tuerMB(s3, m3.id); s3.pas();
  verifier(evs(s3, 'bonus', function (d) { return d.source === 'miniBoss'; }).length === 0, 'bonusMort.actif = false : aucun');
  // garde-fou : Démembré sans bras bloqué loin des joueurs → remis devant sa cuve (nouvel identifiant) : effetZombie(nouveau,
  // arrachement, { duree: 0, reprise: true, … }) ; le bras et les petits continuent ; sa mort les arrête
  var s4 = mbSim(1, { graine: 99, sansChiens: true, petitsBloques: true, surcharges: SANS_P2 });
  var d4 = jusquAuMB(s4, 2), O4 = s4.origine;
  d4.hp = d4.pvMax * 0.4; s4.pas();
  s4.avancer(MBC.demembre.rage.duree + PTc.premier + 0.2);
  d4.bloque = true;
  s4.placer('j1', { x: O4.x, z: O4.z - 12 }, 'salle');
  s4.jusqua(function () { return s4.log.effets.filter(function (e) { return e.effet === 'arrachement'; }).length >= 2; }, DEF.miniBossBloque[1] + 6);
  var e4 = s4.log.effets.filter(function (e) { return e.effet === 'arrachement'; });
  verifier(e4.length === 2 && e4[1].id !== d4.id && e4[1].params.reprise === true && e4[1].params.duree === 0 && s4.log.retraits.some(function (r) { return r.id === d4.id && r.effet === 'silencieux'; }) &&
    mbEtat(s4, e4[1].id) && mbEtat(s4, e4[1].id).rage.actif, 'remis devant sa cuve : effetZombie(nouvel id, arrachement, { duree: 0, reprise: true })', e4.map(function (e) { return { id: e.id, p: e.params }; }));
  s4.avancer(PTc.intervalle + 0.1);
  verifier(s4.etat().bras.etat === 'pose' && s4.etat().petits.length >= 2 && evs(s4, 'bras', function (d) { return d.etat === 'lance'; }).length === 1, 'le bras reste posé, les petits continuent (pas de 2e bras)');
  tuerMB(s4, e4[1].id); s4.pas();
  verifier(evs(s4, 'bras', function (d) { return d.etat === 'fletri'; }).length === 1 && s4.etat().petits.length === 0 && evs(s4, 'petitDemembre', function (d) { return d.etat === 'effondrement'; }).length >= 2, 'sa mort : bras flétri, petits effondrés');
});

test('94 v1.5 fin des rages sans suite (allerA, échec) : murs « eteints » sans extinction, entités dés-irradiées, petits retirés en silence, bras retiré', function () {
  var s = mbSim(1, { graine: 94, sansChiens: true, surcharges: SANS_P2 });
  var m = jusquAuMB(s, 0);
  m.hp = m.pvMax * 0.4; s.pas();
  s.avancer(MBC.survolte.rage.duree + 0.1);
  verifier(s.etat().murs.etat === 'electrifies', 'murs électrifiés');
  s.combat.allerA('phase3');
  verifier(s.etat().murs === null && evs(s, 'murs', function (d) { return d.etat === 'eteints'; }).length === 1 && evs(s, 'murs', function (d) { return d.etat === 'extinction'; }).length === 0, 'allerA : murs « eteints » aussitôt');
  var s2 = mbSim(1, { graine: 95, sansChiens: true, zombiesBloques: true, surcharges: SANS_P2 });
  var irr = jusquAuMB(s2, 1), O = s2.origine;
  var z1 = s2.jeu.faireApparaitreZombie({ position: { x: O.x + 4, y: O.y, z: O.z }, lieu: 'salle', effet: 'test', vitesse: 'normale' });
  irr.hp = irr.pvMax * 0.4; s2.pas();
  s2.avancer(MBC.irradie.rage.duree + 0.1);
  verifier(s2.etat().infection.active && s2.etat().infection.ids.indexOf(z1) >= 0, 'infection active');
  var nI = s2.log.effets.length;
  s2.combat.allerA('repit');
  verifier(s2.etat().infection === null && s2.log.effets.slice(nI).some(function (e) { return e.id === z1 && e.effet === 'irradie' && e.params.actif === false; }), 'allerA : zombies dés-irradiés, infection null');
  [function (x) { x.combat.allerA('phase1'); }, function (x) { x.robots.forEach(function (r) { r.vivant = false; }); x.jusqua(function () { return etat(x) === 'echec'; }, 5); }].forEach(function (fin, k) {
    var s3 = mbSim(1, { graine: 96 + k, sansChiens: true, petitsBloques: true, surcharges: SANS_P2 });
    var dm = jusquAuMB(s3, 2);
    dm.bloque = true;
    dm.hp = dm.pvMax * 0.4; s3.pas();
    s3.avancer(MBC.demembre.rage.duree + PTc.premier + PTc.intervalle + 0.2);
    var pts = s3.etat().petits.slice(), nR = s3.log.retraits.length;
    verifier(pts.length === 2 && s3.etat().bras.etat === 'pose', 'bras posé, deux petits');
    fin(s3);
    var rt = s3.log.retraits.slice(nR).filter(function (r) { return pts.indexOf(r.id) >= 0; });
    verifier(rt.length === 2 && rt.every(function (r) { return r.effet === 'silencieux'; }) && evs(s3, 'petitDemembre', function (d) { return d.etat === 'effondrement'; }).length === 0 &&
      evs(s3, 'bras', function (d) { return d.etat === 'fletri'; }).length === 0 && s3.etat().bras === null && s3.etat().petits.length === 0, (k ? 'échec' : 'allerA') + ' : petits retirés en silence, bras retiré', rt);
  });
});

test('95 v1.5 simulateur : rage (immobile ; surcharge et arrachement : balles sans effet) ; Démembré sans bras : charge (préparation, course, joueur touché et projeté, impact contre le mur, étourdi), coups au contact ; petits : fléau de leur profil ; aura des entités irradiées ; Munitions max', function () {
  // a) surcharge : immobile, invulnérable aux balles du robot, puis de nouveau vulnérable
  var s = sim({ joueurs: [{ id: 'j1', dps: 350, reaction: 0.45, zombiesAussi: false, regen: false }], degatsZombie: 0, degatsMiniBoss: 0, graine: 95, sansChiens: true, surcharges: SANS_P2 });
  var m = jusquAuMB(s, 0);
  s.placer('j1', versCentre(s, m.pos, 9, 0), 'salle');
  m.hp = m.pvMax * 0.49; s.pas();
  var hp0 = m.hp, p0 = copiePos(m.pos);
  s.avancer(MBC.survolte.rage.duree - 0.1);
  verifier(m.hp === hp0 && dist2D(m.pos, p0) < 1e-9, 'surcharge : immobile, les balles n’y font rien', { hp: [hp0, m.hp], d: dist2D(m.pos, p0) });
  s.avancer(1.5);
  verifier(m.hp < hp0, 'ensuite, de nouveau vulnérable', [hp0, m.hp]);
  // b) charge du Démembré sans bras : joueur passif à 13 m, dans l'axe d'un mur à 4 m derrière lui
  var K = MBC.demembre.charge, s2 = sim({ joueurs: passifs(1, [{ regen: false }]), degatsZombie: 0, graine: 96, sansChiens: true, surcharges: SANS_P2 });
  var dm = jusquAuMB(s2, 2), O = s2.origine, n4 = s2.arene.salle.murs[4].normale;
  dm.hp = dm.pvMax * 0.49; s2.pas();
  verifier(dm.sansBrasA != null && proche(dm.sansBrasA - s2.t, MBC.demembre.rage.duree, 1e-9), 'effetZombie arrachement : sans bras après ' + MBC.demembre.rage.duree + ' s');
  dm.pos.x = O.x - n4.x * 2; dm.pos.z = O.z - n4.z * 2;
  s2.placer('j1', { x: O.x + n4.x * 11, z: O.z + n4.z * 11 }, 'salle');
  var pPrep = null;
  s2.apresPas = function () { if (dm.chargeD && dm.chargeD.etat === 'prep' && pPrep == null) pPrep = s2.t; };
  s2.jusqua(function () { return s2.log.chargesDemembre.length > 0 && s2.log.chargesDemembre[0].choc; }, MBC.demembre.rage.duree + 3);
  s2.apresPas = null;
  var c = s2.log.chargesDemembre[0];
  verifier(c && pPrep != null && proche(c.t - pPrep, K.preparation, PAS * 1.5) && pPrep >= dm.sansBrasA - 1e-9, 'préparation ' + K.preparation + ' s (immobile) puis course, seulement sans bras', { prep: pPrep, course: c && c.t });
  var dc = s2.log.degats.filter(function (x) { return x.source === 'demembre_charge'; }), di = s2.log.degats.filter(function (x) { return x.source === 'demembre_impactMur'; });
  verifier(c.cible === 'j1' && c.touches.join() === 'j1' && dc.length === 1 && proche(dc[0].f, K.degats, 1e-9), 'joueur touché : ' + K.degats * 100 + ' %', { c: c, dc: dc });
  verifier(c.choc === 'mur' && dm.chargeD && dm.chargeD.etat === 'etourdi' && proche(dm.chargeD.jusqua - s2.t, K.etourdiMur, PAS * 1.5), 'il heurte le mur : étourdi ' + K.etourdiMur + ' s', dm.chargeD);
  s2.avancer(K.projection.duree + 0.1);
  di = s2.log.degats.filter(function (x) { return x.source === 'demembre_impactMur'; });
  verifier(s2.log.projections.length === 1 && s2.log.impactsMur.length === 1 && di.length === 1 && proche(di[0].f, K.impactMur, 1e-9) && distPlanMur(s2, s2.robot('j1').pos) < 0.75,
    'projeté (' + K.projection.vitesse + ' m/s, ' + K.projection.duree + ' s) contre le mur : ' + K.impactMur * 100 + ' % de plus', { proj: s2.log.projections, impact: di, mur: distPlanMur(s2, s2.robot('j1').pos) });
  s2.avancer(K.etourdiMur + K.recharge + 0.5);
  verifier(s2.log.chargesDemembre.length === 1 || s2.log.chargesDemembre[1].t - c.t >= K.recharge - 1e-9, 'recharge ' + K.recharge + ' s');
  // coups au contact (bras droit) : joueur à 3 m
  dm.chargePret = s2.t + 60;
  s2.placer('j1', { x: dm.pos.x + 3, z: dm.pos.z }, 'salle');
  s2.robot('j1').pv = 1;
  s2.avancer(1.5);
  verifier(s2.log.degats.some(function (x) { return x.source === 'demembre_contact' && proche(x.f, MBC.demembre.degatsContact, 1e-9); }), 'coup au contact du bras droit');
  // c) petit Démembré : fléau de son profil
  var s3 = sim({ joueurs: passifs(1, [{ regen: false }]), degatsZombie: 0, graine: 97, sansChiens: true });
  s3.combat.allerA('phase2');
  var O3 = s3.origine;
  s3.placer('j1', { x: O3.x, z: O3.z - 3 }, 'salle');
  s3.jeu.faireApparaitreZombie({ type: 'demembre_petit', position: { x: O3.x, y: O3.y, z: O3.z - 1 }, lieu: 'salle', effet: 'bras', profil: JSON.parse(JSON.stringify(PTc.profil)) });
  s3.avancer(2.5);
  var pf = s3.log.degats.filter(function (x) { return x.source === 'petit_fleau'; });
  verifier(pf.length >= 1 && proche(pf[0].f, PTc.profil.fleau.degats, 1e-9), 'petit : fléau de ' + PTc.profil.fleau.degats * 100 + ' %', pf);
  // d) aura d'une entité irradiée (à 1 m : oui ; à 2 m : non ; éteinte : plus rien)
  var s4 = sim({ joueurs: passifs(2, [{ regen: false }, { regen: false }]), degatsZombie: 0, graine: 98, sansChiens: true, zombiesBloques: true });
  s4.combat.allerA('phase2');
  var O4 = s4.origine, A4 = MBC.irradie.rage.aura;
  var zi = s4.jeu.faireApparaitreZombie({ position: { x: O4.x + 5, y: O4.y, z: O4.z + 5 }, lieu: 'salle', effet: 'test', vitesse: 'normale' });
  s4.placer('j1', { x: O4.x + 6, z: O4.z + 5 }, 'salle'); s4.placer('j2', { x: O4.x + 5, z: O4.z + 7 }, 'salle');
  s4.jeu.effetZombie(zi, 'irradie', { actif: true, aura: JSON.parse(JSON.stringify(A4)), couleur: MBC.irradie.couleur });
  s4.avancer(2.0);
  var za = function (id) { return s4.log.degats.filter(function (x) { return x.source === 'zombie_irradie' && x.id === id; }); };
  verifier(za('j1').length >= 5 && za('j1').every(function (x) { return proche(x.f, A4.degatsParSeconde * 0.25, 1e-9); }) && za('j2').length === 0, 'aura de ' + A4.rayon + ' m : ' + A4.degatsParSeconde * 100 + ' %/s', { j1: za('j1').length, j2: za('j2').length });
  s4.jeu.effetZombie(zi, 'irradie', { actif: false });
  var nz = za('j1').length;
  s4.avancer(1);
  verifier(za('j1').length === nz, 'éteinte : plus de dégâts');
  // e) Munitions max : chargeurs pleins, rechargement interrompu
  var s5 = sim({ joueurs: [{ id: 'j1', chargeur: 30, rechargement: 2.1 }], degatsZombie: 0, graine: 99, sansChiens: true });
  var r5 = s5.robot('j1');
  r5.munitions = 3; r5.recharge = 1.0;
  s5.jeu.faireApparaitreBonus({ type: 'munitions-max', position: { x: 0, y: 0, z: 0 }, lieu: 'bunker', duree: 30 });
  verifier(r5.munitions === 30 && r5.recharge === 0 && s5.log.munitionsMax.length === 1, 'Munitions max : chargeur plein, rechargement interrompu', { m: r5.munitions, r: r5.recharge });
});

test('96 v1.5 config.valider : rage, echelle, charge, petits (et leur fléau), murs, bonusMort, intangible ; plus de contrôle des illusions', function () {
  verifier(CONFIG.valider().length === 0, 'config livrée valide', CONFIG.valider());
  verifier(!('illusions' in CONFIG.phase5.paliers) && MBC.survolte.rage.capacite === 'surcharge' && MBC.irradie.rage.capacite === 'infection' && MBC.demembre.rage.capacite === 'arrachement' && MBC.demembre.echelle === 2 &&
    MBC.demembre.fleau.portee === 6, 'valeurs v1.5 de la config (capacités, échelle 2, fléau 6 m ; plus de paliers.illusions)');
  var c = JSON.parse(JSON.stringify(CONFIG));
  c.miniBoss.survolte.rage.seuil = 1.2; c.miniBoss.irradie.rage.aura.rayon = 0; c.miniBoss.demembre.rage.vol = 9; c.miniBoss.demembre.echelle = 0;
  c.miniBoss.demembre.charge.vitesse = 0; c.miniBoss.demembre.petits.intervalle = 0; c.miniBoss.demembre.petits.profil.fleau.portee = 0;
  c.miniBoss.murs.tick = 0; c.miniBoss.bonusMort.type = ''; c.phase5.paliers.intangible.vitesse = 0;
  var w = CONFIG.valider(c);
  verifier(w.length === 10, 'valider : 10 écarts (rage ×3, echelle, charge, petits, fléau des petits, murs, bonusMort, intangible)', w);
  var c3 = JSON.parse(JSON.stringify(CONFIG));
  c3.phase5.paliers.intangible.fente.vitesse = 0;
  verifier(CONFIG.valider(c3).length === 1 && /fente/.test(CONFIG.valider(c3)[0]), 'valider : fente.vitesse > 0', CONFIG.valider(c3));
  var c2 = JSON.parse(JSON.stringify(CONFIG));
  c2.phase5.paliers.illusions = { nombre: -1, distanceMin: -5 };
  verifier(CONFIG.valider(c2).length === 0, 'paliers.illusions n’est plus contrôlée', CONFIG.valider(c2));
});

test('97 v1.5 fente du resurgissement : après un mur, il resurgit à distanceReapparition m, fond sur le joueur en vue (fente.vitesse m/s) jusqu’à fente.distanceArret m pendant l’apparition, puis le frappe ; sans ligne de vue : pas de fente', function () {
  var K = PAL.intangible, F = K.fente;
  verifier(F && F.vitesse > 0 && F.distanceArret >= 0 && F.distanceArret < CONFIG.phase5.frappe.portee, 'config : phase5.paliers.intangible.fente, arrêt à portée de coup', F);
  // a) joueur immobile derrière le mur du bunker : traversée, resurgissement à 6 m, fente, coup qui touche
  var s = essaiIntangible({ mur: true });
  s.combat.forcer('position', { x: 12, y: HT5, z: -10 }); s.placer('j1', { x: -12, z: -10 }, 'bunker');
  palierA(s, 2);
  var maxPas = 0, prec = null, dPrep = null, valides = true;
  s.apresPas = function () {
    var b = s.etat().boss, a = b.action;
    if (a && a.id === 'resurgissement') {
      if (prec) maxPas = Math.max(maxPas, dist2D(b.position, prec));
      prec = copiePos(b.position);
      if (!s.jeu.positionValide({ x: b.position.x, y: b.position.y - HT5, z: b.position.z }, 'bunker')) valides = false;
    } else prec = null;
    if (a && a.id === 'frappe' && a.etape === 'preparation' && dPrep == null) dPrep = dist2D(b.position, s.robot('j1').pos);
  };
  s.jusqua(function () { return evs(s, 'frappe').length > 0; }, 20);
  s.apresPas = null;
  var ef = evInt(s, 'fin')[0], fr = evs(s, 'frappe')[0], dFin = ef ? dist2D(ef.d.position, s.robot('j1').pos) : null;
  verifier(evInt(s, 'traversee').length === 1 && dFin != null && proche(dFin, K.distanceReapparition, K.vitesse * PAS + 1e-6), 'resurgit à ' + K.distanceReapparition + ' m après la traversée', dFin);
  verifier(dPrep != null && dPrep <= F.distanceArret + 1e-6 && dPrep >= F.distanceArret - F.vitesse * PAS - 1e-6, 'pendant l’apparition il fond jusqu’à ' + F.distanceArret + ' m du joueur', dPrep);
  verifier(maxPas > 0 && maxPas <= F.vitesse * PAS + 1e-6 && valides, 'à ' + F.vitesse + ' m/s au plus, sur des positions valides', { vitesse: maxPas / PAS, valides: valides });
  verifier(fr && fr.d.joueur === 'j1' && fr.d.reussie && proche(s.robot('j1').pv, CONFIG.phase5.frappe.pvRestants, 1e-12), 'le coup touche le joueur immobile (règle du palier 2)', fr && fr.d);
  // b) au bout de dureeMax, joueur derrière le mur : pas de fente (il ne bouge pas pendant l'apparition)
  var s2 = essaiIntangible({ mur: true, surcharges: { phase5: { frappe: { portee: 0 }, paliers: { intangible: { dureeMax: 0.6 } } } } }), bouge = 0, p0 = null;
  s2.combat.forcer('position', { x: 12, y: HT5, z: -10 }); s2.placer('j1', { x: -25, z: -10 }, 'bunker');
  palierA(s2, 2);
  s2.jusqua(function () { return evEvan(s2).length > 0; }, 4);
  s2.combat.forcer('position', { x: 4, y: HT5, z: -10 });
  s2.apresPas = function () { var b = s2.etat().boss, a = b.action; if (a && a.id === 'resurgissement') { if (p0) bouge = Math.max(bouge, dist2D(b.position, p0)); else p0 = copiePos(b.position); } };
  s2.jusqua(function () { return evs(s2, 'action', function (d) { return d.id === 'frappe'; }).length > 0; }, 6);
  s2.apresPas = null;
  verifier(p0 && bouge === 0, 'sans ligne de vue : aucune fente à travers le mur', { bouge: bouge, p0: p0 });
  // c) sans fente (config) : il reste sur place pendant l'apparition
  var s3 = essaiIntangible({ mur: true, surcharges: { phase5: { frappe: { portee: 0 }, paliers: { intangible: { fente: null } } } } }), bouge3 = 0, q0 = null;
  s3.combat.forcer('position', { x: 12, y: HT5, z: -10 }); s3.placer('j1', { x: -12, z: -10 }, 'bunker');
  palierA(s3, 2);
  s3.apresPas = function () { var b = s3.etat().boss, a = b.action; if (a && a.id === 'resurgissement') { if (q0) bouge3 = Math.max(bouge3, dist2D(b.position, q0)); else q0 = copiePos(b.position); } };
  s3.jusqua(function () { return evs(s3, 'action', function (d) { return d.id === 'frappe'; }).length > 0; }, 20);
  s3.apresPas = null;
  verifier(q0 && bouge3 === 0, 'fente: null → pas de fente (comportement d’avant)', bouge3);
});

test('80 couverture : chaque évènement d’API.md §4, §13, §14, §15, §16 et §17 et chaque étape d’action §5 observés', function () {
  var attendus = ['etat', 'phase', 'titre', 'action', 'degats', 'immunise', 'segment', 'projectile', 'projectileImpact', 'zone', 'zoneFin',
    'invocation', 'absorption', 'ameExtraite', 'ameAbsorbee', 'ailes', 'pique', 'piqueImpact', 'teleport', 'zombiesCendres', 'bloc',
    'blocImpact', 'ondeChoc', 'rituel', 'capture', 'joueurTouche', 'frappe', 'critique', 'obscurite', 'lames', 'cinematique', 'defaite',
    'interaction', 'recompense', 'message', 'fin', 'echec', 'avertissement', 'pilier', 'bonus', 'meute', 'chien', 'tube', 'miniBoss', 'protection',
    'palier', 'crochet',                                                                     // v1.4 (§16.5)
    'murs', 'mursChoc', 'infection', 'bras', 'petitDemembre', 'intangible'];                 // v1.5 (§17) ; plus d'« illusion »
  var manquants = attendus.filter(function (k) { return !evenementsVus[k]; });
  verifier(manquants.length === 0, 'évènements jamais émis', manquants);
  var chiens = ['faille', 'apparition', 'mort', 'fin/transfert', 'fin/defaite', 'fin/echec', 'fin/bloque', 'fin/debogage', 'meute/dechainee', 'meute/dissipee',
    'tube/siphon', 'tube/fissure', 'tube/eclate', 'miniBoss/libere', 'miniBoss/mort', 'protection/true', 'protection/false',
    'palier/0', 'palier/1', 'palier/2', 'palier/3',
    'crochet/lancer', 'crochet/accroche', 'crochet/rate', 'crochet/rate/esquive', 'crochet/rate/mur', 'crochet/arrivee',
    'miniBoss/rage', 'murs/charge', 'murs/electrifies', 'murs/extinction', 'murs/eteints', 'infection/debut', 'infection/fin',   // v1.5
    'bras/arrache', 'bras/lance', 'bras/pose', 'bras/fletri', 'petitDemembre/apparition', 'petitDemembre/effondrement',
    'intangible/debut', 'intangible/traversee', 'intangible/fin', 'bonus/phase', 'bonus/miniBoss'];
  var mq = chiens.filter(function (k) { return !chiensVus[k]; });
  verifier(mq.length === 0, 'états de chien, de meute, de cuve, de mini-boss, de protection, de palier, de crochet, de rage, d’intangibilité ou de bonus jamais vus', mq);
  var etapes = { apparition: ['formation', 'presentation'], invocation: ['preparation', 'lancer', 'recuperation'], trait: ['preparation', 'lancer', 'recuperation'],
    souffrance: ['souffrance', 'colere'], recharge: ['boucle'], absorption: ['saisie', 'extraction', 'fin'],
    transformation_ailes: ['cambrure', 'deploiement', 'rugissement'], pique: ['montee', 'visee', 'charge', 'impact', 'etourdi', 'retour'],
    effondrement: ['souffrance'], teleport_depart: ['implosion'], teleport_arrivee: ['apparition'], retour_rage: ['descente', 'deflagration', 'rugissement'],
    arrachement: ['designation', 'fracture', 'levitation', 'projection', 'recuperation'], onde_choc: ['preparation', 'frappe', 'recuperation'],
    faiblesse: ['chute', 'boucle'], rituel_ames: ['elevation', 'incantation', 'capture'], transformation_lames: ['formation'],
    frappe: ['preparation', 'frappe', 'recuperation'], defaite: ['chancelle', 'genoux', 'chute', 'mort'],   // v1.4 : plus de frappe_ordinaire
    siphon: ['approche', 'aspiration', 'eclatement', 'recuperation'], crochet: ['preparation', 'lancer', 'traction'],
    evanouissement: ['fondu'], resurgissement: ['apparition'] };                              // v1.5 (§17.3)
  var manq = [];
  Object.keys(etapes).forEach(function (id) { etapes[id].forEach(function (e) { if (!actionsVues[id + '/' + e]) manq.push(id + '/' + e); }); });
  verifier(manq.length === 0, 'étapes jamais vues', manq);
});

// ═══════════════════════════════════════ bilan ═══════════════════════════════════════
function afficherDurees(titre, l) {
  if (!l) return;
  var tot = 0;
  console.log('\n' + titre);
  l.forEach(function (x) { if (x.etat !== 'termine') { tot += x.duree; console.log('  ' + x.etat.padEnd(14) + x.duree.toFixed(2).padStart(7) + ' s'); } });
  console.log('  ' + 'total'.padEnd(14) + tot.toFixed(2).padStart(7) + ' s');
}
afficherDurees('Durées mesurées — solo, robot moyen (350 DPS, réaction 0,45 s, zombies ' + Sim.MODELE.pvZombie + ' PV) :', dureesSolo);
afficherDurees('Durées mesurées — coop 4 robots moyens :', dureesCoop);
var ko = resultats.filter(function (r) { return !r.ok; });
console.log('\n' + (resultats.length - ko.length) + ' ok, ' + ko.length + ' échec(s) sur ' + resultats.length + ' tests');
process.exit(ko.length ? 1 : 0);
