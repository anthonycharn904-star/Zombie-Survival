/*!
 * logique.js v1.5.0 — Zombie Survival, Bunker 7 : logique du boss fight en cinq phases.
 * Machine à états du combat, attaques, absorption des âmes, piqué, arrachement des murs, rituel, traque,
 * jauge finale, récompenses et garde-fous. Indépendante du rendu : aucun Three.js, testable sous Node.
 * v1.4 (API.md §16) : 3e cuve (Le Démembré), salves de murs sous 50 % en phase 3, zombies pendant la faiblesse, paliers de
 * la phase 5 (coups bleus, coups quasi mortels, crochets) ; précisions : API.md §16.11.
 * v1.5 (API.md §17) : rages des mini-boss à la moitié de leurs PV (murs électrifiés, infection des zombies, bras arraché et
 * flot de Démembrés), Munitions max à la mort de chaque mini-boss, intangibilité de la phase 5 à la place des illusions ;
 * précisions : API.md §17.8.
 * Contrats : API.md (§1 à §5, §8). Tous les réglages viennent de config.js (BOSS_B7_CONFIG) ; les seules
 * valeurs écrites ici sont des durées de présentation absentes de la config (DEFAUTS, surchargeables via
 * la config au chemin indiqué) et des dimensions physiques (capsule d'un joueur).
 *
 *   var combat = BossB7Logique.creerCombat({ config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE, jeu: adaptateur });
 *   combat.demarrer();                       // quand la quête principale est terminée
 *   combat.mettreAJour(dt);                  // chaque image
 *   combat.toucherBoss({ joueur, degats, zone, position, type });   // chaque balle qui touche le boss
 *   combat.toucherIllusion({ id, joueur, position });                 // v1.5 : plus d'illusions → { applique: false, raison: 'absent' }
 *   combat.interagir(joueurId, maintenu, dt) // touche d'interaction près du cadavre
 *   var e = combat.etat();                   // instantané sérialisable (API.md §2)
 *   combat.on('action', fn);                 // évènements (API.md §4) ; '*' reçoit tout (type, détail)
 *
 * Script classique → globalThis.BossB7Logique ; CommonJS → module.exports.
 */
(function (root) {
  'use strict';

  var VERSION = '1.5.0';                 // API.md §17 (v1.5)

  // ───────────────────── Valeurs de présentation absentes de config.js (surchargeables) ─────────────────────
  // Chaque entrée : [chemin dans la config, valeur par défaut]. Si le chemin existe dans la config, il prime.
  var DEFAUTS = {
    souffrance1: ['transition12.souffrance', 1.6],      // fin de phase 1 : souffrance…
    colere1: ['transition12.colere', 1.4],              // … puis colère (pendant le répit)
    cambrure: ['phase2.transformation.cambrure', 0.6],  // apparition des ailes
    deploiement: ['phase2.transformation.deploiement', 0.9],
    rugissementAiles: ['phase2.transformation.rugissement', 0.6],
    hauteurPique: ['phase2.pique.hauteur', 4.0],        // altitude des pieds au-dessus du sol avant le piqué
    impactPique: ['phase2.pique.impact', 0.4],
    implosion: ['teleport.implosion', 1.2],             // disparition du boss
    apparitionTp: ['teleport.apparition', 0.9],         // réapparition du boss
    implosionRapide: ['teleport.implosionRapide', 0.6], // téléportation anti-blocage (phase 5)
    apparitionRapide: ['teleport.apparitionRapide', 0.5],
    impactBloc: ['phase3.arrachement.impact', 0.6],     // une dalle qui vient de frapper se brise
    reconstructionBloc: ['phase3.arrachement.dureeReconstruction', 2.0],
    elevationBloc: ['phase3.arrachement.elevation', 2.4], // le bloc flotte à cette hauteur au-dessus des pieds du boss
    chuteFaiblesse: ['phase4.faiblesse.chute', 1.5],
    explosionRituel: ['phase4.explosion', 0.62],        // fraction de phase4.fin où la lumière explose
    reveil: ['phase5.reveil', 1.0],                     // après la capture des âmes, avant de rendre le contrôle
    finCritique: ['phase5.frappe.finCritique', 0.2],    // l'état critique cesse au-dessus de 20 % des PV
    pauseMort: ['defaite.pauseMort', 0.8],              // le boss reste au sol avant le retour dans la salle
    zoneFin: ['phase1.invocation.zone.fin', 0.4],       // disparition visuelle d'une zone
    tickZone: ['phase1.invocation.zone.tick', 0.25],    // les zones blessent par tranches de 0,25 s
    graceEchec: ['securite.graceEchec', 1.0],           // tout le monde à terre depuis ce délai → échec
    relanceAbsorption: ['phase2.absorption.relance', 1.5],  // absorption prête mais aucun zombie : nouvel essai après ce délai
    delaiArrivee: ['coop.delaiArrivee', 1.0],           // un nouveau joueur compte après ce temps de présence continue
    delaiDepart: ['coop.delaiDepart', 5.0],             // un joueur absent de jeu.joueurs() depuis ce délai a quitté la partie
    interactionPerimee: ['conclusion.interaction.perimee', 0.25], // plus d'appel de interagir() → relâchée
    titrePhase: ['general.dureeTitrePhase', 3.0],
    porteeTrait: ['phase1.trait.portee', 45],
    distanceMinZones: ['phase1.invocation.zone.ecart', 3.0], // deux zones actives ne se recouvrent pas
    // v1.3 (API.md §15.2) : cuves et mini-boss de la phase 2
    siphonDelaiMax: ['miniBoss.siphon.delaiMax', 1.5],  // le siphon commence au plus tard ce délai après le seuil
    hauteurSiphon: ['miniBoss.siphon.hauteurCible', 1.4], // action.cible = centre de la cuve à cette hauteur
    essaisMiniBoss: ['miniBoss.essais', 5],             // apparition refusée : nouveaux essais…
    intervalleEssaiMiniBoss: ['miniBoss.intervalleEssai', 1.0], // … toutes les 1 s, puis fin de la protection
    miniBossBloque: ['miniBoss.bloque', 15],            // immobile (< 0,5 m) depuis ce délai…
    miniBossDistanceBloque: ['miniBoss.distanceBloque', 10], // … et à plus de cette distance de tout joueur → remis devant sa cuve
    miniBossMortAffiche: ['miniBoss.mortAffiche', 3],   // un mini-boss mort reste ce temps dans l'instantané (barre vide)
    miniBossInvisible: ['miniBoss.invisible', 3],       // jamais listé par jeu.zombies() après ce délai → avertissement
    // v1.5 (API.md §17)
    ecartCuve: ['miniBoss.siphon.apparition.ecartCuve', 1.3],   // apparition à max(apparition.distance, rayon de la cuve + ceci) m
    torseSeptieme: ['boss.hauteurTorse', 1.3],          // torse du Septième (source de la surcharge, lignes de vue de l'intangibilité)
    intervalleChocMurs: ['miniBoss.murs.intervalleChoc', 0.5],  // mursChoc : au plus un par joueur et par ce délai
    brasDepart: ['miniBoss.demembre.rage.hauteurDepart', 3.0],  // hauteur d'où part le bras (épaule du géant)
    brasCloche: ['miniBoss.demembre.rage.hauteurVol', 3.0],     // flèche de la cloche du bras
    brasFletriAffiche: ['miniBoss.demembre.rage.fletriAffiche', 3],   // bras flétri gardé ce temps dans l'instantané
    petitInvisible: ['miniBoss.demembre.petits.invisible', 3]   // petit Démembré jamais listé après ce délai : oublié
  };
  // Réglages de config.js qui ne concernent pas la logique : phase5.obscurite.rayonVision (rendu de l'obscurité) ;
  // repit.suspendreApparitions (aucune apparition « normale » n'existe pendant le répit : seuls les sorts en créent).
  // Dimensions physiques (aucun équilibrage) : un joueur est une capsule verticale.
  var J_RAYON = 0.35, J_BAS = 0.3, J_HAUT = 1.6, J_TETE = 1.6, J_TORSE = 1.0;
  var MAIN_HAUT = 1.45, MAIN_AVANT = 0.4, MAIN_COTE = 0.25;   // main droite du boss (modèle de 1,75 m)

  var TITRES = {
    1: 'L’Invocation des morts', 2: 'L’Absorption des âmes', 3: 'La Colère du bunker',
    4: 'Le Rituel de purification', 5: 'Le Dernier Pacte'
  };
  // États de combat (le joueur peut mourir, l'échec est surveillé)
  var ETATS_COMBAT = ['introduction', 'phase1', 'repit', 'phase2', 'transition23', 'absence', 'retour', 'phase3',
    'transition34', 'rituel', 'rituel_fin', 'faiblesse', 'transition45', 'phase5', 'defaite', 'retour_salle',
    'conclusion', 'recompenses', 'message'];
  var LIEU_ETAT = {
    introduction: 'salle', phase1: 'salle', repit: 'salle', phase2: 'salle', transition23: 'salle', absence: 'salle',
    retour: 'salle', phase3: 'salle', transition34: 'salle', rituel: 'salle', rituel_fin: 'salle', faiblesse: 'salle',
    transition45: 'salle', phase5: 'bunker', defaite: 'bunker', retour_salle: 'salle', conclusion: 'salle',
    recompenses: 'salle', message: 'salle', termine: 'bunker', echec: null, inactif: null
  };
  var PHASE_ETAT = {
    inactif: 0, introduction: 0, phase1: 1, repit: 1, phase2: 2, transition23: 2, absence: 3, retour: 3, phase3: 3,
    transition34: 3, rituel: 4, rituel_fin: 4, faiblesse: 4, transition45: 5, phase5: 5, defaite: 5,
    retour_salle: 0, conclusion: 0, recompenses: 0, message: 0, termine: 0, echec: 0
  };
  // segment de la barre de vie utilisé par chaque état (−1 : pas de barre)
  var SEGMENT_ETAT = {
    introduction: 0, phase1: 0, repit: 0, phase2: 1, transition23: 1, absence: 2, retour: 2, phase3: 2,
    transition34: 2, rituel: 3, rituel_fin: 3, faiblesse: 3
  };

  // ───────────────────────────────────────── outils ─────────────────────────────────────────
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
  function estObjet(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function cloner(o) {
    if (Array.isArray(o)) return o.map(cloner);
    if (estObjet(o)) { var r = {}; for (var k in o) if (typeof o[k] !== 'function') r[k] = cloner(o[k]); return r; }
    return o;
  }
  function fusionner(base, sur) {
    if (!estObjet(sur)) return base;
    for (var k in sur) {
      if (estObjet(sur[k]) && estObjet(base[k])) fusionner(base[k], sur[k]);
      else base[k] = cloner(sur[k]);
    }
    return base;
  }
  function lireChemin(o, chemin) {
    var p = chemin.split('.');
    for (var i = 0; i < p.length; i++) { if (!estObjet(o) || !(p[i] in o)) return undefined; o = o[p[i]]; }
    return o;
  }
  function nombre(v, d) { v = +v; return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lisse(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function v3(x, y, z) { return { x: x || 0, y: y || 0, z: z || 0 }; }
  function copie(p) { return p ? { x: +p.x || 0, y: +p.y || 0, z: +p.z || 0 } : null; }
  function ajouter(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  function soustraire(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function echelle(a, k) { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
  function norme(a) { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
  function normaliser(a) { var l = norme(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
  function dist2(a, b) { var dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
  function interp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }; }
  function lacetVers(de, vers) { return Math.atan2(vers.x - de.x, vers.z - de.z); }
  function ecartAngle(a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  // distance 2D d'un point au segment [a, b] (plan XZ) et paramètre t
  function distSegment2(p, a, b) {
    var abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
    var t = l2 > 1e-12 ? clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / l2, 0, 1) : 0;
    var dx = p.x - (a.x + abx * t), dz = p.z - (a.z + abz * t);
    return { d: Math.sqrt(dx * dx + dz * dz), t: t };
  }
  // distance 3D d'un point au segment vertical [bas, haut] d'une capsule
  function distCapsule(p, base, bas, haut) {
    var y = clamp(p.y, base.y + bas, base.y + haut);
    var dx = p.x - base.x, dy = p.y - y, dz = p.z - base.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ─────────────────────────────────────── création ───────────────────────────────────────
  function creerCombat(options) {
    options = options || {};
    if (!options.config) throw new Error('BossB7Logique : options.config manquante (BOSS_B7_CONFIG)');
    if (!options.arene || !options.arene.salle) throw new Error('BossB7Logique : options.arene manquante (BOSS_B7_ARENE)');
    var C = fusionner(cloner(options.config), options.surcharges || {});
    var AR = options.arene;
    var graine = options.graine != null ? options.graine : nombre(lireChemin(C, 'general.graine'), 1);
    var rng = mulberry32(graine);
    function d(cle) { var e = DEFAUTS[cle]; var v = lireChemin(C, e[0]); return v === undefined ? e[1] : v; }
    function entre(a, b) { if (Array.isArray(a)) { b = a[1]; a = a[0]; } return a + (b - a) * rng(); }
    function entier(a, b) { if (Array.isArray(a)) { b = a[1]; a = a[0]; } return Math.floor(a + (b - a + 1) * rng()); }

    // ── adaptateur du jeu : méthodes obligatoires et valeurs par défaut sûres ──
    var jeuBrut = options.jeu || {};
    var OBLIGATOIRES = ['joueurs', 'infligerDegats', 'blessureCritique', 'teleporter', 'controle', 'invulnerable',
      'faireApparaitreZombie', 'zombies', 'effetZombie', 'retirerZombie'];
    var manquantes = OBLIGATOIRES.filter(function (m) { return typeof jeuBrut[m] !== 'function'; });
    if (manquantes.length) throw new Error('BossB7Logique : adaptateur incomplet, méthodes manquantes : ' + manquantes.join(', '));
    var avertis = {};
    if (typeof options.config.valider === 'function') {
      (options.config.valider(C) || []).forEach(function (w) {
        if (typeof jeuBrut.journal === 'function') { try { jeuBrut.journal('avertissement', 'BossB7 config : ' + w); } catch (e) { /* rien */ } }
      });
    }
    function appel(nom) {
      var f = jeuBrut[nom];
      if (typeof f !== 'function') return undefined;
      try { return f.apply(jeuBrut, Array.prototype.slice.call(arguments, 1)); } catch (e) {
        avertir('exception dans jeu.' + nom + ' : ' + (e && e.message ? e.message : e), 'exception-' + nom);
        return undefined;
      }
    }
    function existe(nom) { return typeof jeuBrut[nom] === 'function'; }
    function avertir(texte, cle) {
      if (cle) { if (avertis[cle]) return; avertis[cle] = true; }
      if (existe('journal')) { try { jeuBrut.journal('avertissement', 'BossB7 : ' + texte); } catch (e) { /* rien */ } }
      emettre('avertissement', { texte: texte });
    }

    // ── évènements ──
    var ecouteurs = {};
    function emettre(type, detail) {
      var l = ecouteurs[type], t = ecouteurs['*'];
      if (l) for (var i = 0; i < l.length; i++) { try { l[i](detail); } catch (e) { erreurEcouteur(type, e); } }
      if (t) for (var j = 0; j < t.length; j++) { try { t[j](type, detail); } catch (e2) { erreurEcouteur(type, e2); } }
    }
    function erreurEcouteur(type, e) {
      if (existe('journal')) { try { jeuBrut.journal('erreur', 'BossB7 : écouteur « ' + type + ' » : ' + (e && e.message ? e.message : e)); } catch (x) { /* rien */ } }
    }

    // ── géométrie de la salle en coordonnées du monde ──
    var SA = AR.salle;
    var O = copie(SA.origine || { x: 0, y: 0, z: 0 });
    var SOL = O.y;
    var APO = nombre(SA.apotheme, 15);
    function monde(p) { return { x: O.x + (+p.x || 0), y: O.y + (+p.y || 0), z: O.z + (+p.z || 0) }; }
    var MURS = (SA.murs || []).map(function (m, i) { return { x: m.normale.x, z: m.normale.z, id: m.id != null ? m.id : 'mur' + i }; });
    if (!MURS.length) for (var mk = 0; mk < 8; mk++) MURS.push({ x: Math.sin(mk * Math.PI / 4), z: Math.cos(mk * Math.PI / 4), id: 'mur' + mk });
    var PILIERS = (SA.piliers || []).map(function (p, i) { return { id: p.id != null ? p.id : 'pilier' + i, i: i, x: O.x + p.x, z: O.z + p.z, r: nombre(p.rayon, 0.8), h: nombre(p.hauteur, 8) }; });
    var LIMITE_J = nombre(SA.limiteJoueurs, APO - 0.7);
    var DALLES = (SA.dalles || []).filter(function (dl) { return dl.actif !== false; }).map(function (dl) {
      return { id: dl.id, centre: monde(dl.centre), normale: { x: dl.normale.x, y: 0, z: dl.normale.z }, mur: dl.mur != null ? dl.mur : dl.id,
        lacet: Math.atan2(dl.normale.x, dl.normale.z), largeur: dl.largeur, hauteur: dl.hauteur };
    });
    var DALLE_PAR_ID = {};
    DALLES.forEach(function (dl) { DALLE_PAR_ID[dl.id] = dl; });
    var ANCRES = (SA.ancres && SA.ancres.length ? SA.ancres : [{ x: 0, z: 0 }]).map(function (a) { return { x: O.x + a.x, y: SOL, z: O.z + a.z }; });
    var BRECHES = (SA.breches || []).map(monde);
    var CENTRE = monde(SA.centre || { x: 0, y: 0, z: 0 });
    var CERCLE = { x: O.x + ((SA.cercle && SA.cercle.x) || 0), y: SOL, z: O.z + ((SA.cercle && SA.cercle.z) || 0) };
    var ARRIVEE = (SA.arriveeJoueurs || []).map(function (p) { var q = monde(p); q.lacet = +p.lacet || 0; return q; });
    var RETOUR_SALLE = (SA.retourSalle && SA.retourSalle.length ? SA.retourSalle : SA.arriveeJoueurs || []).map(function (p) { var q = monde(p); q.lacet = +p.lacet || 0; return q; });
    var CADAVRE = SA.cadavre ? monde(SA.cadavre) : copie(CENTRE);
    var LACET_CADAVRE = SA.cadavre ? +SA.cadavre.lacet || 0 : 0;
    var AUTEL = SA.autel ? monde(SA.autel) : copie(CENTRE);

    function distanceMur(p) {      // distance signée la plus grande vers l'extérieur (0 au centre, APO sur un mur)
      var m = -1e9;
      for (var i = 0; i < MURS.length; i++) { var v = (p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z; if (v > m) m = v; }
      return m;
    }
    function dansSalle(p, marge) { return distanceMur(p) <= APO - marge; }
    function contraindreSalle(p, marge) {
      for (var k = 0; k < 2; k++) {
        for (var i = 0; i < MURS.length; i++) {
          var v = (p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z, lim = APO - marge;
          if (v > lim) { p.x -= MURS[i].x * (v - lim); p.z -= MURS[i].z * (v - lim); }
        }
      }
      return p;
    }
    // Cuves (v1.3, §15.1) : deux cuves dos au mur, chacune retient un mini-boss ; intactes ou brisées, elles font obstacle.
    // Repli si l'arène n'en décrit pas : les emplacements du §15.1.
    var TUBES = (SA.tubes && SA.tubes.length ? SA.tubes : [
      { id: 'tube0', x: 11.918, y: 0, z: 4.937, rayon: 0.85, hauteur: 2.6, miniBoss: 'survolte' },
      { id: 'tube1', x: -11.918, y: 0, z: -4.937, rayon: 0.85, hauteur: 2.6, miniBoss: 'irradie' },
      { id: 'tube2', x: 0, y: 0, z: 13.25, rayon: 0.85, hauteur: 2.6, miniBoss: 'demembre' }   // v1.4 (§16.1)
    ]).map(function (t, i) {
      var q = monde(t);
      return { id: t.id != null ? t.id : 'tube' + i, i: i, x: q.x, y: SOL, z: q.z, r: nombre(t.rayon, 0.85), h: nombre(t.hauteur, 2.6), miniBoss: t.miniBoss || null };
    });
    function dansCuve(p, marge) {
      for (var i = 0; i < TUBES.length; i++) if (dist2(p, TUBES[i]) < TUBES[i].r + 0.2 + marge) return TUBES[i];
      return null;
    }
    function horsCuves(p, rayon) {
      for (var i = 0; i < TUBES.length; i++) {
        var tb = TUBES[i], dx = p.x - tb.x, dz = p.z - tb.z, l = Math.sqrt(dx * dx + dz * dz), r = tb.r + 0.2 + rayon;
        if (l < r) { if (l < 1e-6) { dx = CENTRE.x - tb.x; dz = CENTRE.z - tb.z; l = Math.sqrt(dx * dx + dz * dz) || 1; } p.x = tb.x + dx / l * r; p.z = tb.z + dz / l * r; }
      }
      return p;
    }
    // Piliers : un pilier détruit (phase 3, v1.1) ne fait plus obstacle, ni aux blocs, ni aux sorts, ni au boss.
    function pilierIntact(pl) { return !S || !S.piliers || !S.piliers[pl.i] || S.piliers[pl.i].etat !== 'detruit'; }
    function horsPiliers(p, rayon) {
      for (var i = 0; i < PILIERS.length; i++) {
        if (!pilierIntact(PILIERS[i])) continue;
        var pl = PILIERS[i], dx = p.x - pl.x, dz = p.z - pl.z, l = Math.sqrt(dx * dx + dz * dz), r = pl.r + rayon;
        if (l < r) { if (l < 1e-6) { dx = 1; dz = 0; l = 1; } p.x = pl.x + dx / l * r; p.z = pl.z + dz / l * r; }
      }
      return p;
    }
    function dansPilier(p, marge) {
      for (var i = 0; i < PILIERS.length; i++) if (pilierIntact(PILIERS[i]) && dist2(p, PILIERS[i]) < PILIERS[i].r + marge && p.y < SOL + PILIERS[i].h) return PILIERS[i];
      return null;
    }
    function segmentCoupePilier(a, b, marge) {   // le segment a→b passe-t-il dans un pilier intact ?
      return !!pilierSurSegment(a, b, marge);
    }
    // Premier pilier intact traversé par le segment a→b (en XZ, rayon du pilier + marge, sous son sommet) : { pl, t }
    // où t ∈ [0, 1] est l'entrée dans le cylindre élargi ; null si aucun.
    function pilierSurSegment(a, b, marge) {
      var best = null;
      for (var i = 0; i < PILIERS.length; i++) {
        var pl = PILIERS[i];
        if (!pilierIntact(pl)) continue;
        var R2 = (pl.r + marge) * (pl.r + marge), dx = b.x - a.x, dz = b.z - a.z, fx = a.x - pl.x, fz = a.z - pl.z;
        var A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), Cc = fx * fx + fz * fz - R2, t;
        if (Cc <= 0) t = 0;                                  // déjà dans le cylindre élargi
        else {
          if (A < 1e-12) continue;
          var disc = B * B - 4 * A * Cc;
          if (disc < 0) continue;
          t = (-B - Math.sqrt(disc)) / (2 * A);
          if (t < 0 || t > 1) continue;
        }
        var y = a.y + (b.y - a.y) * t;
        if (y >= SOL + pl.h) continue;
        if (!best || t < best.t) best = { pl: pl, t: t };
      }
      return best;
    }

    // ── Mise à l'échelle coop (dynamique) ──
    // n = nombre de joueurs DANS LA PARTIE : présents dans jeu.joueurs(), qu'ils soient vivants, à terre ou morts.
    // Mourir puis réapparaître ne change donc pas n (l'adaptateur garde les morts dans la liste, vivant: false) ;
    // seuls une arrivée (nouvel identifiant présent depuis coop.delaiArrivee s) ou un départ (identifiant absent de la
    // liste depuis coop.delaiDepart s) le changent. À chaque changement de n pendant le combat :
    //   • PV max de chaque segment = PV de base × (1 + coop.pvParJoueurSupp × (n − 1)) ;
    //   • segment en cours : la FRACTION de PV restante est conservée (pv ← pv × nouveauMax / ancienMax). La barre ne
    //     bouge pas : pas de soin quand quelqu'un arrive, et un départ ne peut pas vider le segment (pas de saut de
    //     phase ; un segment déjà vide, pendant une transition, reste vide) ;
    //   • segments déjà terminés : inchangés ; segments à venir : nouveau maximum ;
    //   • jauge finale : la fraction remplie est conservée, les dégâts requis suivent
    //     (1 + coop.jaugeParJoueurSupp × (n − 1)) ;
    //   • zombies simultanés (base + coop.zombiesParJoueurSupp × (n − 1)) : plafond recalculé, apparitions en cours
    //     comprises ; les zombies déjà présents restent.
    // Un joueur qui arrive pendant le combat (de l'introduction à la défaite) et qui n'est pas là où se déroule
    // l'action est téléporté à un point d'arrivée de ce lieu (salle ou Bunker 7) : il participe à ce qu'il paie.
    // Rien n'est recalculé hors combat (inactif, termine, echec). n vaut au moins 1.
    var N = 1;
    function echelleCoop(par) { return 1 + nombre(par, 0) * (N - 1); }
    function suivreEffectif() {
      var co = S.coop, presents = {}, change = false;
      J.forEach(function (p) { presents[p.id] = true; });
      Object.keys(presents).forEach(function (id) {
        delete co.absent[id];
        if (co.comptes[id]) return;
        if (co.vu[id] == null) co.vu[id] = S.temps;
        if (S.temps - co.vu[id] >= d('delaiArrivee') - 1e-9) { co.comptes[id] = true; delete co.vu[id]; change = true; accueillir(id); }
      });
      Object.keys(co.vu).forEach(function (id) { if (!presents[id]) delete co.vu[id]; });
      Object.keys(co.comptes).forEach(function (id) {
        if (presents[id]) return;
        if (co.absent[id] == null) co.absent[id] = S.temps;
        if (S.temps - co.absent[id] >= d('delaiDepart') - 1e-9) { delete co.comptes[id]; delete co.absent[id]; change = true; }
      });
      if (change) {
        var n = Math.max(1, Object.keys(co.comptes).length);
        if (n !== N) changerEffectif(n);
      }
    }
    function accueillir(id) {
      var p = JI[id], i = ETATS_COMBAT.indexOf(S.etat);
      if (!p || !S.lieu || p.lieu === S.lieu || i < 0 || i >= ETATS_COMBAT.indexOf('retour_salle')) return;
      if (S.etat === 'introduction' && S.sousEtat === 'fondu') return;      // la téléportation de l'introduction s'en charge
      var pts = S.lieu === 'salle' ? ARRIVEE : pointsBunker('arrivee');
      if (!pts.length) { avertir('aucun point d\u2019arrivée pour accueillir un nouveau joueur dans « ' + S.lieu + ' »', 'accueil-' + S.lieu); return; }
      var pt = pts[(Object.keys(S.coop.comptes).length - 1) % pts.length];
      appel('teleporter', p.id, { x: pt.x, y: pt.y, z: pt.z }, +pt.lacet || 0, S.lieu);   // p.id : identifiant d'origine (nombre ou texte)
      p.position = { x: pt.x, y: pt.y, z: pt.z };
      p.lieu = S.lieu;
    }
    function changerEffectif(n) {
      var ancien = N, anciensMax = S.segmentsMax.slice(), seg = SEGMENT_ETAT[S.etat];
      N = n;
      var k = echelleCoop(C.coop.pvParJoueurSupp);
      S.segmentsMax = [C.phase1.pv * k, C.phase2.pv * k, C.phase3.pv * k, C.phase4.faiblesse.pv * k];
      for (var i = 0; i < S.segmentsMax.length; i++) {
        if (seg != null && i === seg) {
          S.pv = anciensMax[i] > 0 ? S.pv / anciensMax[i] * S.segmentsMax[i] : 0;
          S.segments[i] = S.segmentsMax[i];
        } else if (seg == null ? i > S.segment : i > seg) S.segments[i] = S.segmentsMax[i];
      }
      S.jaugeMax = C.phase5.jauge.degatsRequis * echelleCoop(C.coop.jaugeParJoueurSupp);
      var sp = S.spawner;
      if (sp.actif && sp.params) {
        var max = maxZombies(sp.params.max);
        if (sp.delegue) appel('apparitionsNormales', true, { max: max, intervalle: sp.intervalle, lieu: sp.lieu });
        else sp.max = max;
      }
      ajusterMeute();
      if (existe('journal')) appel('journal', 'info', 'BossB7 : ' + ancien + ' → ' + n + ' joueur(s) ; PV et jauge ajustés en proportion');
    }

    // ── état ──
    var S, boss, J = [], JI = {}, ZL = [], ZI = {}, compteurId = 0;
    function nouvelId(p) { compteurId++; return p + compteurId; }
    function reinitialiser() {
      S = {
        etat: 'inactif', tempsEtat: 0, temps: 0, lieu: 'salle', cinematique: false, detruit: false,
        segments: [0, 0, 0, 0], segment: 0, pv: 0, seuil: false, seuilT: 0,
        jauge: null, capture: null, vision: 0, visionCible: 0, visionVitesse: 0,
        blocs: [], projectiles: [], zones: [], ames: [], pique: null, emergences: [],
        joueurs: {}, interne: {}, interaction: null, message: null, recompenses: {},
        spawner: { actif: false }, zombiesBoss: {}, saisis: {},
        minuteries: {}, cibles: {}, proximite: {}, tousATerreT: 0, phaseDebut: 0, dureeMaxAverti: false,
        sousEtat: null, drapeaux: {}, fileBonus: [], tBonus: 0, finMessage: false,
        piliers: [], bonusPoses: {}, fenetreDegats: [], tDernierTp: -1e9, gelJaugeJusqua: 0,
        secondeMoitie: false, meute: null, trame: 0,
        mb: nouveauxMiniBoss(), tubes: [],
        palier: null, intang: nouvelIntang(), crochets: [], crochetDispo: null, salveTour: null,
        murs: null, infection: null, bras: null, petits: [], entites: []   // v1.5 (§17.1)
      };
      remettrePiliers();
      remettreTubes('intact');
      boss = {
        present: false, visible: false, lieu: 'salle', position: v3(CENTRE.x, SOL, CENTRE.z), lacet: Math.PI,
        vitesse: v3(), prec: v3(CENTRE.x, SOL, CENTRE.z), locomotion: 'aucune', act: null,
        vulnerable: false, multBase: 1, multAction: 1, ames: 0, ailes: 'absentes', lames: 'absentes',
        affaiblissement: 0, regard: null, dest: null, hauteur: SOL, traque: null, ancreIndex: 0,
        intangible: false                                  // v1.5 (§17.3)
      };
    }
    // v1.5 : intangibilité de la phase 5 (palier 2) — loinT : secondes sans joueur valide à moins de `proximite` m ;
    // dernier : instant du dernier resurgissement ; vol : traversée invisible en cours
    function nouvelIntang() { return { loinT: 0, dernier: null, vol: null }; }
    function remettrePiliers() {
      S.piliers = PILIERS.map(function () { return { etat: 'intact', coups: 0, depuis: S.temps }; });
    }
    // v1.3 : seuils franchis, protection, siphon en attente, apparition en attente, mini-boss (vivants et morts récents)
    function nouveauxMiniBoss() { return { prochain: 0, protege: false, type: null, attente: null, apparition: null, liste: [] }; }
    function remettreTubes(etat) {
      S.tubes = TUBES.map(function () { return { etat: etat, depuis: S.temps }; });
    }
    reinitialiser();

    // ─────────────────────────────────────── joueurs ───────────────────────────────────────
    function lireJoueurs() {
      var l = appel('joueurs');
      J = [];
      JI = {};
      if (!Array.isArray(l)) return;
      for (var i = 0; i < l.length; i++) {
        var p = l[i];
        if (!p || p.id == null || !p.position) continue;
        var q = {
          id: p.id, position: copie(p.position), vitesse: copie(p.vitesse || { x: 0, y: 0, z: 0 }),
          lacet: nombre(p.lacet, 0), vivant: p.vivant !== false, aTerre: !!p.aTerre,
          lieu: p.lieu || S.lieu, pvFraction: nombre(p.pvFraction, 1)
        };
        if (!isFinite(q.position.x + q.position.y + q.position.z)) continue;
        J.push(q);
        JI[q.id] = q;
        etatJoueur(q.id);
      }
    }
    function etatJoueur(id) {
      if (!S.joueurs[id]) {
        S.joueurs[id] = { critique: false, invulnerableJusqua: 0, immuniteFrappeJusqua: 0, recompense: false };
        S.interne[id] = { participant: S.etat !== 'inactif', inv: null, ctrl: null, dansCercle: false, zoneAcc: 0, zoneTick: 0,
          enAttenteRecompense: false, vuVivant: true };
      }
      return S.joueurs[id];
    }
    function valide(p, lieu) { return p && p.vivant && !p.aTerre && (!lieu || p.lieu === lieu); }
    function joueursValides(lieu) { return J.filter(function (p) { return valide(p, lieu); }); }
    function centreJoueur(p) { return { x: p.position.x, y: p.position.y + J_TORSE, z: p.position.z }; }
    function teteJoueur(p) { return { x: p.position.x, y: p.position.y + J_TETE, z: p.position.z }; }
    function touchePossible(id) {
      if (S.cinematique && C.introduction.joueursInvulnerables !== false) return false;
      return !(S.joueurs[id] && S.joueurs[id].invulnerableJusqua > S.temps);
    }
    function blesser(id, fraction, source, opts) {
      var p = JI[id];
      if (!p || !p.vivant || !touchePossible(id)) return false;
      appel('infligerDegats', id, fraction, { source: source, ignorerReductions: !!(opts && opts.ignorerReductions), recul: opts && opts.recul });
      emettre('joueurTouche', { joueur: id, source: source, fraction: fraction });
      return true;
    }
    // commandes et invulnérabilité : appliquées seulement quand elles changent
    function appliquerEtatsJoueurs() {
      for (var i = 0; i < J.length; i++) {
        var p = J[i], e = S.joueurs[p.id], it = S.interne[p.id];
        var inv = (S.cinematique && C.introduction.joueursInvulnerables !== false) || e.invulnerableJusqua > S.temps;
        if (it.inv !== inv) { it.inv = inv; appel('invulnerable', p.id, inv); }
        var ctrl = !S.cinematique && !it.accroche;          // v1.4 : accroché par un crochet (traction, puis frappe)
        if (it.ctrl !== ctrl) { it.ctrl = ctrl; appel('controle', p.id, ctrl); }
      }
    }
    function cinematique(nom, actif) {
      if (S.cinematique === actif && S.nomCinematique === nom) return;
      S.cinematique = actif;
      S.nomCinematique = actif ? nom : null;
      emettre('cinematique', { nom: nom, actif: actif });
      appliquerEtatsJoueurs();
    }
    function regarderTous(point, duree) {
      for (var i = 0; i < J.length; i++) if (J[i].vivant) appel('regarder', J[i].id, copie(point), duree);
    }
    function teleporterTous(points, lieu) {
      var ids = J.map(function (p) { return p.id; }).sort(cmpId);
      if (!points || !points.length) { avertir('aucun point de téléportation pour « ' + lieu + ' »', 'tp-' + lieu); return; }
      for (var i = 0; i < ids.length; i++) {
        var pt = points[i % points.length], k = Math.floor(i / points.length);
        var pos = { x: pt.x + k * 0.9, y: pt.y, z: pt.z };
        appel('teleporter', ids[i], pos, +pt.lacet || 0, lieu);
        var p = JI[ids[i]];
        if (p) { p.position = copie(pos); p.lieu = lieu; }
      }
    }
    function cmpId(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }
    // choix d'une cible : alternance en coop (ciblesDifferentes), aléatoire reproductible
    function choisirCible(lieu, cle, opts) {
      var l = joueursValides(lieu).sort(function (a, b) { return cmpId(a.id, b.id); });
      if (opts && opts.filtre) { var f = l.filter(opts.filtre); if (f.length) l = f; }
      if (!l.length) return null;
      var der = S.cibles[cle];
      if (C.coop.ciblesDifferentes && l.length > 1 && der != null) {
        var autres = l.filter(function (p) { return p.id !== der; });
        if (autres.length) l = autres;
      }
      var p = l[Math.floor(rng() * l.length) % l.length];
      S.cibles[cle] = p.id;
      return p;
    }
    function plusProcheValide(lieu, depuis) {
      var best = null, bd = 1e18;
      joueursValides(lieu).forEach(function (p) { var dd = dist(p.position, depuis); if (dd < bd - 1e-9 || (Math.abs(dd - bd) <= 1e-9 && best && cmpId(p.id, best.id) < 0)) { bd = dd; best = p; } });
      return best;
    }

    // ─────────────────────────────────────── zombies ───────────────────────────────────────
    function lireZombies() {
      var l = appel('zombies');
      ZL = [];
      ZI = {};
      S.entites = [];                                      // v1.5 : entités non mini-boss de la salle (infection)
      if (!Array.isArray(l)) return;
      for (var i = 0; i < l.length; i++) {
        var z = l[i];
        if (!z || z.id == null || !z.position || z.vivant === false) continue;
        var dansSalle = (z.lieu || S.lieu) === 'salle';
        var ch = S.meute ? S.meute.chiens[String(z.id)] : null;
        if (ch) {                                          // chien de la meute : position suivie, vu à ce pas
          ch.position.x = +z.position.x || 0; ch.position.y = +z.position.y || 0; ch.position.z = +z.position.z || 0;
          if (z.lieu) ch.lieu = z.lieu;
          ch.vu = S.trame; ch.vuUneFois = true;
          if (dansSalle) S.entites.push({ id: z.id });
          continue;
        }
        if (z.type === 'chien') { if (dansSalle) S.entites.push({ id: z.id }); continue; }   // chien du jeu hors meute : pas un zombie pour la logique
        var pt = S.petits.length ? petitSuivi(z.id) : null;
        if (pt || z.type === 'demembre_petit') {           // v1.5 : petit Démembré : ni zombie, ni mini-boss (hors de ZL)
          if (pt) { pt.position.x = +z.position.x || 0; pt.position.y = +z.position.y || 0; pt.position.z = +z.position.z || 0; pt.vu = S.trame; pt.vuUneFois = true; }
          if (dansSalle) S.entites.push({ id: z.id });
          continue;
        }
        var mb = miniBossSuivi(z.id);
        if (mb) {                                          // mini-boss (v1.3) : position et PV suivis, vu à ce pas
          mb.position.x = +z.position.x || 0; mb.position.y = +z.position.y || 0; mb.position.z = +z.position.z || 0;
          if (z.lieu) mb.lieu = z.lieu;
          if (isFinite(+z.pv) && z.pv !== null) mb.pv = clamp(+z.pv, 0, mb.pvMax);
          mb.vu = S.trame; mb.vuUneFois = true;
          continue;
        }
        if (z.miniBoss === true || estTypeMiniBoss(z.type)) continue;   // mini-boss non suivi : jamais un zombie non plus
        var q = { id: z.id, position: copie(z.position), lieu: z.lieu || S.lieu };
        ZL.push(q);
        ZI[q.id] = q;
        if (dansSalle) S.entites.push({ id: z.id });
      }
    }
    function zombiesDans(lieu) { return ZL.filter(function (z) { return z.lieu === lieu; }); }
    function maxZombies(base) { return Math.max(0, Math.round(nombre(base, 0) + nombre(C.coop.zombiesParJoueurSupp, 0) * (N - 1))); }
    function faireApparaitre(position, lieu, effet) {
      var Zc = C.zombies || {};
      var pz = { position: copie(position), lieu: lieu, effet: effet, source: 'boss', vitesse: Zc.vitesse, agressif: !!Zc.agressif };
      if (Zc.pv > 0) pz.pv = Zc.pv;                       // PV des zombies du combat (config.zombies.pv, à l'échelle du DPS de référence)
      var id = appel('faireApparaitreZombie', pz);
      if (id == null) return null;
      S.zombiesBoss[id] = { naissance: S.temps, pos: copie(position), tMouvement: S.temps, lieu: lieu, effet: effet };
      ZL.push({ id: id, position: copie(position), lieu: lieu });
      ZI[id] = ZL[ZL.length - 1];
      emettre('invocation', { zombieId: id, position: copie(position) });
      return id;
    }
    function reduireEnCendres(lieu) {
      var ids = [];
      ZL.slice().forEach(function (z) { if (!lieu || z.lieu === lieu) { ids.push(z.id); appel('retirerZombie', z.id, { effet: 'cendres', points: false }); } });
      ZL = ZL.filter(function (z) { return ids.indexOf(z.id) < 0; });
      ids.forEach(function (id) { delete ZI[id]; delete S.zombiesBoss[id]; delete S.saisis[id]; });
      S.emergences = [];
      if (ids.length) emettre('zombiesCendres', { ids: ids });
      return ids;
    }
    function retirerTousSilencieux() {
      ZL.slice().forEach(function (z) { appel('retirerZombie', z.id, { effet: 'silencieux', points: false }); });
      ZL = []; ZI = {}; S.zombiesBoss = {}; S.saisis = {}; S.emergences = [];
    }
    // apparitions « normales » (absence, rituel, phase 5)
    function activerApparitions(params, lieu) {
      couperApparitions();
      var max = maxZombies(params.max), intervalle = Math.max(0.1, nombre(params.intervalle, 2));
      if (lieu === 'bunker' && existe('apparitionsNormales')) {
        var ok = appel('apparitionsNormales', true, { max: max, intervalle: intervalle, lieu: lieu });
        if (ok === true) { S.spawner = { actif: true, delegue: true, lieu: lieu, params: params, intervalle: intervalle }; return; }
      }
      S.spawner = { actif: true, delegue: false, lieu: lieu, max: max, intervalle: intervalle, t: 0, params: params };
    }
    function couperApparitions() {
      if (S.spawner.actif && S.spawner.delegue) appel('apparitionsNormales', false, { lieu: S.spawner.lieu });
      S.spawner = { actif: false };
    }
    function pointApparition(lieu) {
      var valides = joueursValides(lieu), cand;
      if (lieu === 'salle') cand = BRECHES.slice();
      else cand = pointsBunker('zombies');
      if (!cand.length) { avertir('aucun point d’apparition de zombies pour « ' + lieu + ' »', 'spawn-' + lieu); return null; }
      var loin = cand.filter(function (p) { return valides.every(function (j) { return dist2(j.position, p) >= (lieu === 'salle' ? 5 : 8); }); });
      var l = loin.length ? loin : cand;
      return l[Math.floor(rng() * l.length) % l.length];
    }
    function majApparitions(dt) {
      var sp = S.spawner;
      if (!sp.actif || sp.delegue) return;
      sp.t += dt;
      while (sp.t >= sp.intervalle) {
        sp.t -= sp.intervalle;
        if (zombiesDans(sp.lieu).length + S.emergences.length >= sp.max) continue;
        var p = pointApparition(sp.lieu);
        if (p) faireApparaitre(p, sp.lieu, sp.lieu === 'salle' ? 'breche' : 'normal');
      }
    }
    function majEmergences(dt) {
      for (var i = S.emergences.length - 1; i >= 0; i--) {
        var e = S.emergences[i];
        e.t -= dt;
        if (e.t <= 0) {
          S.emergences.splice(i, 1);
          if (zombiesDans(e.lieu).length < e.max) faireApparaitre(e.position, e.lieu, 'emergence');
        }
      }
    }
    // zombie invoqué bloqué (immobile, loin des joueurs) → remplacé
    var tZombiesControle = 0;
    function surveillerZombies(dt) {
      tZombiesControle += dt;
      if (tZombiesControle < 0.5) return;
      tZombiesControle = 0;
      var limite = nombre(C.securite.zombieBloque, 15);
      Object.keys(S.zombiesBoss).sort(cmpId).forEach(function (id) {
        var info = S.zombiesBoss[id], z = ZI[id];
        if (!z) { delete S.zombiesBoss[id]; return; }
        if (S.saisis[id]) { info.tMouvement = S.temps; info.pos = copie(z.position); return; }
        if (dist(z.position, info.pos) >= 0.5) { info.pos = copie(z.position); info.tMouvement = S.temps; return; }
        if (S.temps - info.tMouvement < limite) return;
        var proche = plusProcheValide(z.lieu, z.position);
        if (proche && dist2(proche.position, z.position) < 6) { info.tMouvement = S.temps; return; }
        appel('retirerZombie', id, { effet: 'silencieux', points: false });
        delete S.zombiesBoss[id];
        ZL = ZL.filter(function (q) { return q.id !== id; });
        delete ZI[id];
        var p = z.lieu === 'salle' ? pointApparition('salle') : pointApparition('bunker');
        if (p) faireApparaitre(p, z.lieu, z.lieu === 'salle' ? 'breche' : 'normal');
        if (existe('journal')) appel('journal', 'info', 'BossB7 : zombie bloqué ' + id + ' remplacé');
      });
    }
    function pointsBunker(type) {
      var cles = { arrivee: 'arriveeJoueurs', boss: 'apparitionsBoss', retour: 'retourJoueurs', zombies: 'apparitionsZombies' };
      var l = existe('pointsBunker') ? appel('pointsBunker', type) : null;
      if (!Array.isArray(l) || !l.length) l = (AR.bunker7 && AR.bunker7[cles[type]]) || [];
      return l.filter(function (p) { return p && isFinite(+p.x + +p.z); }).map(function (p) { var q = copie(p); q.lacet = +p.lacet || 0; return q; });
    }

    // ─────────────────────────────────────── boss ───────────────────────────────────────
    function setVulnerable(v, mult) { boss.vulnerable = v; if (mult != null) boss.multBase = mult; }
    function avant() { return { x: Math.sin(boss.lacet), y: 0, z: Math.cos(boss.lacet) }; }
    function droite() { return { x: -Math.cos(boss.lacet), y: 0, z: Math.sin(boss.lacet) }; }
    function main() {
      var f = avant(), r = droite();
      return { x: boss.position.x + f.x * MAIN_AVANT + r.x * MAIN_COTE, y: boss.position.y + MAIN_HAUT, z: boss.position.z + f.z * MAIN_AVANT + r.z * MAIN_COTE };
    }
    function tournerVers(point, vitesse, dt) {
      if (!point) return;
      var cible = lacetVers(boss.position, point);
      if (dist2(boss.position, point) < 0.05) return;
      var e = ecartAngle(boss.lacet, cible), m = vitesse * dt;
      boss.lacet += clamp(e, -m, m);
    }
    function versHauteur(y, vitesse, dt) {
      var dy = y - boss.position.y, m = vitesse * dt;
      boss.position.y += clamp(dy, -m, m);
    }
    function deplacerVers(dest, vmax, dt) {
      var dx = dest.x - boss.position.x, dz = dest.z - boss.position.z, l = Math.sqrt(dx * dx + dz * dz);
      if (l < 1e-4) return true;
      var pas = Math.min(l, vmax * dt);
      boss.position.x += dx / l * pas;
      boss.position.z += dz / l * pas;
      return l - pas < 0.05;
    }
    function contraindreBoss() {
      if (boss.lieu !== 'salle' || !boss.present) return;
      if (!C.securite.bossHorsLimites) return;
      var avantX = boss.position.x, avantZ = boss.position.z;
      contraindreSalle(boss.position, 1.0);
      if (boss.position.y < SOL + PILIERS_H()) horsPiliers(boss.position, nombre(C.boss.rayonCorps, 0.45));
      if (Math.abs(avantX - boss.position.x) > 2 || Math.abs(avantZ - boss.position.z) > 2) avertir('boss ramené dans l’arène', null);
      if (boss.position.y < SOL - 0.5 || boss.position.y > SOL + 12 || !isFinite(boss.position.y)) boss.position.y = SOL + nombre(C.boss.hauteurLevitation, 1.25);
      if (!isFinite(boss.position.x) || !isFinite(boss.position.z)) { boss.position.x = CENTRE.x; boss.position.z = CENTRE.z; }
    }
    function PILIERS_H() { return PILIERS.length ? PILIERS[0].h : 0; }
    function regardAuto() {
      if (!boss.present || boss.locomotion === 'mort') return null;
      var a = boss.act;
      if (a && a.cibleJoueur != null && JI[a.cibleJoueur]) return teteJoueur(JI[a.cibleJoueur]);
      if (a && a.cible) return copie(a.cible);
      var p = plusProcheValide(boss.lieu, boss.position);
      return p ? teteJoueur(p) : null;
    }

    // ── actions du boss : étapes successives, annulables avec nettoyage ──
    function action(id, etapes, o) {
      annulerAction();
      o = o || {};
      var a = { id: id, etapes: etapes, i: -1, t: 0, duree: 0, cible: o.cible ? copie(o.cible) : null,
        cibleJoueur: o.cibleJoueur != null ? o.cibleJoueur : null, donnees: o.donnees || {}, fin: o.fin, annuler: o.annuler, suivante: false };
      boss.act = a;
      etapeSuivante(a);
      return a;
    }
    function etapeSuivante(a) {
      a.i++;
      if (a.i >= a.etapes.length) { if (boss.act === a) boss.act = null; if (a.fin) a.fin(a); return; }
      var e = a.etapes[a.i];
      a.t = 0;
      a.suivante = false;
      var du = typeof e.duree === 'function' ? e.duree(a) : e.duree;
      a.duree = du == null ? Infinity : Math.max(0, nombre(du, 0));
      emettre('action', { id: a.id, etape: e.nom, cible: copie(a.cible), cibleJoueur: a.cibleJoueur });
      if (e.entrer) e.entrer(a);
    }
    function majAction(dt) {
      var a = boss.act;
      if (!a) return;
      var e = a.etapes[a.i];
      a.t += dt;
      if (e.maj) e.maj(a, dt);
      if (boss.act !== a) return;
      if (a.suivante || a.t >= a.duree - 1e-9) {
        if (e.sortir) e.sortir(a);
        if (boss.act === a) etapeSuivante(a);
      }
    }
    function annulerAction() {
      var a = boss.act;
      if (!a) return;
      boss.act = null;
      if (a.annuler) a.annuler(a);
    }
    function instantaneAction() {
      var a = boss.act;
      if (!a) return null;
      var e = a.etapes[a.i];
      return { id: a.id, etape: e.nom, t: a.t, duree: isFinite(a.duree) ? a.duree : null,
        progression: isFinite(a.duree) && a.duree > 0 ? clamp(a.t / a.duree, 0, 1) : 0,
        cible: copie(a.cible), cibleJoueur: a.cibleJoueur, donnees: cloner(a.donnees) };
    }
    // Téléportations du boss. raison : 'phase' (changement de phase), 'frappe' (disparition après une frappe spéciale
    // et réapparition), 'degats' (gros dégâts en phase 5), 'blocage' (anti-blocage de la traque).
    function teleportDepart(apres, rapide, raison) {
      var D = rapide ? d('implosionRapide') : d('implosion');
      setVulnerable(false);
      S.fenetreDegats = [];
      action('teleport_depart', [{ nom: 'implosion', duree: D, sortir: function () {
        boss.present = false; boss.visible = false;
        emettre('teleport', { sens: 'depart', position: copie(boss.position), lieu: boss.lieu, raison: raison || 'phase' });
      } }], { fin: apres, annuler: function () { boss.present = false; boss.visible = false; } });
    }
    function teleportArrivee(position, lieu, apres, rapide, raison) {
      boss.position = copie(position);
      boss.prec = copie(position);
      boss.lieu = lieu;
      boss.present = true; boss.visible = true;
      setVulnerable(false);
      S.tDernierTp = S.temps;
      emettre('teleport', { sens: 'arrivee', position: copie(position), lieu: lieu, raison: raison || 'phase' });
      action('teleport_arrivee', [{ nom: 'apparition', duree: rapide ? d('apparitionRapide') : d('apparitionTp') }], { fin: apres });
    }

    // ─────────────────────────── projectiles, zones, âmes, piqué, blocs ───────────────────────────
    function nettoyerAttaques() {
      S.projectiles = [];
      S.zones.forEach(function (z) { emettre('zoneFin', { id: z.id }); });
      S.zones = [];
      S.ames = [];
      S.pique = null;
      S.emergences = [];
      Object.keys(S.saisis).forEach(function (id) { appel('effetZombie', id, 'relache', {}); });
      S.saisis = {};
    }
    function choisirPointInvocation(joueur, P) {
      var z = P.zone, ecart = d('distanceMinZones');
      for (var essai = 0; essai < 16; essai++) {
        var ang = rng() * Math.PI * 2, r = entre(P.distanceCible);
        var p = { x: joueur.position.x + Math.sin(ang) * r, y: SOL, z: joueur.position.z + Math.cos(ang) * r };
        if (!dansSalle(p, 1.5)) continue;
        if (dansPilier({ x: p.x, y: SOL, z: p.z }, z.rayon * 0.5 + 0.5)) continue;
        if (dansCuve(p, 0.5)) continue;
        if (segmentCoupePilier(main(), p, 0.3)) continue;
        if (S.zones.some(function (q) { return dist2(q.position, p) < ecart; })) continue;
        if (existe('positionValide') && appel('positionValide', copie(p), 'salle') === false) continue;
        return p;
      }
      return null;
    }
    function tirerInvocation(cible, P) {
      var depart = main(), v = normaliser(soustraire(cible, depart));
      var pr = { id: nouvelId('proj-'), type: 'invocation', position: depart, vitesse: echelle(v, P.vitesseProjectile), cible: copie(cible), P: P, vie: 0 };
      S.projectiles.push(pr);
      emettre('projectile', { id: pr.id, type: pr.type, position: copie(depart), cible: copie(cible) });
    }
    function tirerTrait(joueurId, T) {
      var p = JI[joueurId];
      var depart = main();
      var vise = p ? centreJoueur(p) : ajouter(depart, echelle(avant(), 10));
      var v = normaliser(soustraire(vise, depart));
      var pr = { id: nouvelId('proj-'), type: 'trait', position: depart, vitesse: echelle(v, T.vitesse), cible: vise, T: T, vie: 0, parcouru: 0 };
      S.projectiles.push(pr);
      emettre('projectile', { id: pr.id, type: pr.type, position: copie(depart), cible: copie(vise) });
    }
    function majProjectiles(dt) {
      for (var i = S.projectiles.length - 1; i >= 0; i--) {
        var pr = S.projectiles[i], avantPos = pr.position, pas = norme(pr.vitesse) * dt;
        pr.vie += dt;
        var apres = ajouter(pr.position, echelle(pr.vitesse, dt));
        var fini = false, impact = apres;
        if (pr.type === 'invocation') {
          var plp = pilierSurSegment(avantPos, apres, 0.1);
          if (plp) { impact = interp(avantPos, apres, plp.t); fini = true; }        // écrasé sur un pilier : pas de zone
          else if (dist(pr.position, pr.cible) <= pas + 1e-6) { impact = copie(pr.cible); fini = true; creerZone(pr.cible, pr.P); }
          else if (pr.vie > 5) fini = true;
        } else {
          var T = pr.T, touches = [];
          for (var k = 0; k < J.length; k++) {
            var j = J[k];
            if (!valide(j, 'salle')) continue;
            if (distCapsule(apres, j.position, J_BAS, J_HAUT + 0.2) <= T.rayon + J_RAYON) touches.push(j.id);
          }
          pr.parcouru += pas;
          if (touches.length) {
            touches.forEach(function (id) { blesser(id, T.degats, 'trait'); });
            fini = true;
          } else if (segmentCoupePilier(avantPos, apres, 0.1) || apres.y <= SOL + 0.05 || !dansSalle(apres, 0.3) || pr.parcouru > d('porteeTrait')) fini = true;
        }
        pr.position = apres;
        if (fini) {
          S.projectiles.splice(i, 1);
          emettre('projectileImpact', { id: pr.id, type: pr.type, position: copie(impact) });
        }
      }
    }
    function creerZone(position, P) {
      var z = P.zone;
      var zone = { id: nouvelId('zone-'), position: { x: position.x, y: SOL, z: position.z }, rayon: z.rayon, etat: 'marquee',
        t: 0, duree: z.delaiActivation, Z: z };
      S.zones.push(zone);
      emettre('zone', { id: zone.id, position: copie(zone.position), rayon: zone.rayon });
      // zombies qui sortent de la zone
      var n = entier(P.zombiesParSort);
      var max = maxZombies(S.etat === 'phase2' ? C.phase2.zombiesMax : C.phase1.zombiesMax);
      var place = max - zombiesDans('salle').length - S.emergences.length;
      n = Math.max(0, Math.min(n, place));
      for (var k = 0; k < n; k++) {
        var ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * z.rayon * 0.7;
        var p = { x: position.x + Math.sin(ang) * r, y: SOL, z: position.z + Math.cos(ang) * r };
        contraindreSalle(p, 1.0); horsPiliers(p, 0.5); horsCuves(p, 0.5);
        if (existe('positionValide') && appel('positionValide', copie(p), 'salle') === false) p = { x: position.x, y: SOL, z: position.z };
        S.emergences.push({ t: z.delaiActivation + P.delaiEmergence * k, position: p, lieu: 'salle', max: max });
      }
    }
    function majZones(dt) {
      var tick = d('tickZone');
      var vus = {};
      for (var i = S.zones.length - 1; i >= 0; i--) {
        var z = S.zones[i];
        z.t += dt;
        if (z.etat === 'marquee' && z.t >= z.duree) { z.etat = 'active'; z.t = 0; z.duree = z.Z.duree; }
        else if (z.etat === 'active' && z.t >= z.duree) { z.etat = 'fin'; z.t = 0; z.duree = d('zoneFin'); }
        else if (z.etat === 'fin' && z.t >= z.duree) { S.zones.splice(i, 1); emettre('zoneFin', { id: z.id }); continue; }
        if (z.etat !== 'active') continue;
        for (var k = 0; k < J.length; k++) {
          var j = J[k];
          if (!valide(j, 'salle')) continue;
          if (dist2(j.position, z.position) > z.rayon || Math.abs(j.position.y - z.position.y) > 1.5) continue;
          var it = S.interne[j.id];
          vus[j.id] = true;
          it.zoneAcc += z.Z.degatsParSeconde * dt;
          it.zoneTick += dt;
          if (it.zoneTick >= tick) { blesser(j.id, it.zoneAcc, 'zone'); it.zoneAcc = 0; it.zoneTick = 0; }
        }
      }
      J.forEach(function (j) { if (!vus[j.id]) { var it = S.interne[j.id]; it.zoneAcc = 0; it.zoneTick = 0; } });
    }
    function majAmes(dt) {
      var besoin = Math.max(1, nombre(C.phase2.amesPourAiles, 10));
      for (var i = S.ames.length - 1; i >= 0; i--) {
        var a = S.ames[i];
        a.t += dt;
        if (a.t >= a.duree) {
          S.ames.splice(i, 1);
          boss.ames += 1;
          emettre('ameAbsorbee', { ames: boss.ames, besoin: besoin });
        }
      }
    }

    // blocs (dalles arrachées)
    function blocActif(b) { return b.etat === 'fissure' || b.etat === 'arrache' || b.etat === 'levitation' || b.etat === 'vol'; }
    function setBloc(b, etat) {
      b.etat = etat;
      b.t = 0;
      emettre('bloc', { id: b.id, etat: etat, position: copie(b.position) });
    }
    function impactBloc(b, touches, pilierId) {
      b.vitesse = v3();
      b.pointImpact = null;
      setBloc(b, 'impact');
      emettre('blocImpact', { id: b.id, position: copie(b.position), touches: touches || [], pilier: pilierId != null ? pilierId : null });
    }
    // Un bloc s'écrase sur un pilier intact (v1.1) : point d'impact sur la surface du pilier, dégâts aux seuls joueurs
    // proches de ce point (phase3.piliers.rayonDegats), un coup de plus au compteur ; coupsDestruction coups → détruit.
    function impactPilier(b, pl, contact) {
      var R = C.phase3.arrachement, P = C.phase3.piliers || {}, st = S.piliers[pl.i];
      var dx = contact.x - pl.x, dz = contact.z - pl.z, l = Math.sqrt(dx * dx + dz * dz);
      if (l < 1e-6) { dx = boss.position.x - pl.x; dz = boss.position.z - pl.z; l = Math.sqrt(dx * dx + dz * dz) || 1; }
      var y = clamp(contact.y, SOL + 0.3, SOL + pl.h - 0.3);
      var q = { x: pl.x + dx / l * pl.r, y: y, z: pl.z + dz / l * pl.r };
      b.position = { x: pl.x + dx / l * (pl.r + 0.35), y: y, z: pl.z + dz / l * (pl.r + 0.35) };   // la dalle se brise contre le pilier
      var rayon = nombre(P.rayonDegats, R.rayonBloc), frac = Math.max(nombre(R.degats, 0.25), 0.25), touches = [];
      for (var k = 0; k < J.length; k++) {
        var j = J[k];
        if (!valide(j, 'salle')) continue;
        if (distCapsule(q, j.position, J_BAS, J_HAUT + 0.2) <= rayon && blesser(j.id, frac, 'bloc', { ignorerReductions: !R.reductionsAutorisees })) touches.push(j.id);
      }
      st.coups += 1;
      st.depuis = S.temps;
      var detruit = st.coups >= Math.max(1, nombre(P.coupsDestruction, 3));
      st.etat = detruit ? 'detruit' : 'endommage';
      impactBloc(b, touches, pl.id);
      emettre('pilier', { id: pl.id, etat: detruit ? 'detruit' : 'touche', coups: st.coups, position: { x: pl.x, y: SOL, z: pl.z }, pointImpact: copie(q) });
    }
    function lacherBloc(b) {          // annulation : une dalle cassée tombe, sans dégâts ; une dalle fissurée reste en place
      if (b.etat === 'fissure') { retirerBloc(b, 'reconstruit'); return; }
      if (b.etat === 'arrache' || b.etat === 'levitation' || b.etat === 'vol') impactBloc(b, [], null);
    }
    function retirerBloc(b, ev) {
      S.blocs = S.blocs.filter(function (x) { return x !== b; });
      emettre('bloc', { id: b.id, etat: ev || 'reconstruit', position: copie(DALLE_PAR_ID[b.id] ? DALLE_PAR_ID[b.id].centre : b.position) });
    }
    function majBlocs(dt) {
      var R = C.phase3.arrachement;
      for (var i = S.blocs.length - 1; i >= 0; i--) {
        var b = S.blocs[i];
        b.t += dt;
        if (b.etat === 'vol') {
          var avantPos = b.position, apres = ajouter(b.position, echelle(b.vitesse, dt));
          b.rotation.x += b.spin.x * dt; b.rotation.y += b.spin.y * dt; b.rotation.z += b.spin.z * dt;
          b.vol += dt;
          // pilier intact sur le trajet de ce pas : le bloc s'y écrase (un joueur caché derrière est épargné)
          var plc = pilierSurSegment(avantPos, apres, nombre((C.phase3.piliers || {}).margeBloc, R.rayonBloc * 0.6));
          if (plc) { impactPilier(b, plc.pl, interp(avantPos, apres, plc.t)); continue; }
          var touches = [];
          for (var k = 0; k < J.length; k++) {
            var j = J[k];
            if (!valide(j, 'salle')) continue;
            if (distCapsule(apres, j.position, J_BAS, J_HAUT + 0.2) <= R.rayonBloc + J_RAYON) touches.push(j.id);
          }
          b.position = apres;
          if (touches.length) {
            var frac = Math.max(nombre(R.degats, 0.25), 0.25);   // au moins 25 % des PV max (cahier des charges)
            touches.forEach(function (id) { blesser(id, frac, 'bloc', { ignorerReductions: !R.reductionsAutorisees }); });
            impactBloc(b, touches, null);
          } else if (apres.y - R.rayonBloc * 0.5 <= SOL || !dansSalle(apres, R.rayonBloc * 0.5) || b.vol > 3.5) {
            impactBloc(b, [], null);
          }
        } else if (b.etat === 'impact' && b.t >= d('impactBloc')) {
          setBloc(b, 'absent');
        } else if (b.etat === 'absent' && S.temps - b.arrache >= nombre(R.reconstruction, 14)) {
          b.position = copie(DALLE_PAR_ID[b.id].centre);
          b.rotation = { x: 0, y: DALLE_PAR_ID[b.id].lacet, z: 0 };
          setBloc(b, 'reconstruction');
        } else if (b.etat === 'reconstruction' && b.t >= d('reconstructionBloc')) {
          retirerBloc(b, 'reconstruit');
        }
      }
    }

    // ─────────────────────────────────── attaques des phases 1 à 3 ───────────────────────────────────
    // ── Seconde moitié de la phase 1 (v1.2, API.md §14.1-14.2) ──
    // Déclencheur (une fois par combat) : PV du segment de la phase 1 ≤ secondeMoitie.seuil × PV max → double sort jusqu'à
    // la fin de la phase 1 et meute lâchée. Au plus tard au changement d'état qui termine la phase 1 (coup unique de > 50 % à 0).
    function verifierSecondeMoitie() {
      var SM = C.phase1.secondeMoitie;
      if (!SM || S.secondeMoitie || S.etat !== 'phase1' || !S.segmentsMax) return;
      if (S.pv <= nombre(SM.seuil, 0.5) * S.segmentsMax[0] + 1e-9) declencherSecondeMoitie();
    }
    function declencherSecondeMoitie() {
      if (S.secondeMoitie) return;
      S.secondeMoitie = true;
      lacherMeute(S.lieu === 'bunker' ? 'bunker' : 'salle', 0);
    }
    function doubleSortActif() {
      var SM = C.phase1.secondeMoitie;
      return S.etat === 'phase1' && S.secondeMoitie && !!SM && !!SM.doubleSort && !!SM.doubleSort.actif;
    }
    // Double sort : UNE action `invocation` aux étapes preparation → lancer (sort 1) → preparation (donnees.second) → lancer
    // (sort 2) → recuperation ; l'écart entre les deux tirs est tiré dans doubleSort.ecart. Les deux sorts visent le même
    // joueur ; le point d'impact est choisi AU TIR : sous ses pieds (± distanceJoueur), ramené dans la salle (marge 1,5 m).
    // action.cible suit le joueur tant que le sort n'est pas parti. Pas de règle d'écart entre les deux zones ; un pilier
    // intact entre la main et le point arrête le sort (pas de zone).
    function lancerDoubleSort(P) {
      var DS = C.phase1.secondeMoitie.doubleSort;
      var j = choisirCible('salle', 'invocation');
      if (!j) return false;
      var ecart = Math.max(P.lancer, entre(DS.ecart));
      function suivre(a) {
        var p = JI[a.cibleJoueur];
        if (p && valide(p, 'salle')) a.cible = { x: p.position.x, y: SOL, z: p.position.z };
      }
      function tirer(a) {
        var p = JI[a.cibleJoueur];
        if (!p || !valide(p, 'salle')) {                  // cible tombée ou partie : le joueur valide le plus proche, sinon rien
          p = plusProcheValide('salle', boss.position);
          if (!p) { a.donnees.annules = (a.donnees.annules || 0) + 1; return; }
          a.cibleJoueur = p.id;
        }
        var ang = rng() * Math.PI * 2, r = entre(DS.distanceJoueur);
        var q = contraindreSalle({ x: p.position.x + Math.sin(ang) * r, y: SOL, z: p.position.z + Math.cos(ang) * r }, 1.5);
        a.cible = q;
        tirerInvocation(q, P);
      }
      action('invocation', [
        { nom: 'preparation', duree: P.preparation, maj: function (a, dt) { suivre(a); tournerVers(a.cible, 4, dt); } },
        { nom: 'lancer', duree: P.lancer, maj: function (a) { suivre(a); }, sortir: tirer },
        { nom: 'preparation', duree: ecart - P.lancer, entrer: function (a) { a.donnees.second = true; suivre(a); },
          maj: function (a, dt) { suivre(a); tournerVers(a.cible, 4, dt); } },
        { nom: 'lancer', duree: P.lancer, maj: function (a) { suivre(a); }, sortir: tirer },
        { nom: 'recuperation', duree: P.recuperation }
      ], { cible: { x: j.position.x, y: SOL, z: j.position.z }, cibleJoueur: j.id, donnees: { double: true, second: false, ecart: ecart } });
      return true;
    }
    function lancerInvocation(P) {
      if (doubleSortActif()) return lancerDoubleSort(P);
      var j = choisirCible('salle', 'invocation');
      if (!j) return false;
      var point = choisirPointInvocation(j, P);
      if (!point) return false;
      action('invocation', [
        { nom: 'preparation', duree: P.preparation, maj: function (a, dt) { tournerVers(a.cible, 4, dt); } },
        { nom: 'lancer', duree: P.lancer, sortir: function (a) { tirerInvocation(a.cible, P); } },
        { nom: 'recuperation', duree: P.recuperation }
      ], { cible: point, cibleJoueur: j.id });
      return true;
    }
    function lancerTrait(T) {
      var j = choisirCible('salle', 'trait');
      if (!j) return false;
      action('trait', [
        { nom: 'preparation', duree: T.preparation, maj: function (a, dt) { var p = JI[a.cibleJoueur]; if (p) tournerVers(p.position, 5, dt); } },
        { nom: 'lancer', duree: T.lancer, sortir: function (a) { tirerTrait(a.cibleJoueur, T); } },
        { nom: 'recuperation', duree: T.recuperation }
      ], { cibleJoueur: j.id });
      return true;
    }
    function lancerAbsorption() {
      var A = C.phase2.absorption;
      var zs = zombiesDans('salle').filter(function (z) { return !S.saisis[z.id] && dist(z.position, boss.position) <= A.distanceMax; });
      if (!zs.length) return false;
      zs.sort(function (a, b) { var da = dist(a.position, boss.position), db = dist(b.position, boss.position); return da - db || cmpId(a.id, b.id); });
      var cibles = zs.slice(0, Math.max(1, A.ciblesMax)).map(function (z) { return z.id; });
      function relacher() {
        cibles.forEach(function (id) { if (S.saisis[id]) { delete S.saisis[id]; appel('effetZombie', id, 'relache', {}); } });
      }
      action('absorption', [
        { nom: 'saisie', duree: A.saisie, entrer: function () {
          boss.multAction = A.multiplicateurDegats;
          cibles.forEach(function (id) { S.saisis[id] = true; appel('effetZombie', id, 'saisie', { duree: A.saisie }); });
          emettre('absorption', { etat: 'debut', cibles: cibles.slice() });
        } },
        { nom: 'extraction', duree: null, entrer: function (a) { a.donnees.k = 0; a.donnees.prochain = 0; }, maj: function (a) {
          while (a.donnees.k < cibles.length && a.t >= a.donnees.prochain - 1e-9) {
            var id = cibles[a.donnees.k++];
            a.donnees.prochain += A.delaiEntreAmes;
            var z = ZI[id];
            delete S.saisis[id];
            if (!z) continue;                       // tué par les joueurs avant l'extraction : âme refusée
            var pos = copie(z.position);
            emettre('ameExtraite', { zombieId: id, position: pos });
            appel('effetZombie', id, 'extraction', {});
            appel('retirerZombie', id, { effet: 'absorbe', points: false });
            ZL = ZL.filter(function (q) { return q.id !== id; });
            delete ZI[id];
            delete S.zombiesBoss[id];
            S.ames.push({ id: nouvelId('ame-'), zombieId: id, depart: { x: pos.x, y: pos.y + 1.2, z: pos.z }, t: 0, duree: A.volAme, action: a });
          }
          if (a.donnees.k >= cibles.length && !S.ames.some(function (s) { return s.action === a; })) a.suivante = true;
        } },
        { nom: 'fin', duree: 0.5, entrer: function () { boss.multAction = 1; emettre('absorption', { etat: 'fin', cibles: cibles.slice() }); } }
      ], {
        donnees: { cibles: cibles.slice() },
        fin: function () { boss.multAction = 1; verifierAiles(); },
        annuler: function (a) {
          boss.multAction = 1;
          relacher();
          S.ames = S.ames.filter(function (s) { return s.action !== a; });
          emettre('absorption', { etat: 'fin', cibles: cibles.slice() });
        }
      });
      return true;
    }
    function verifierAiles() {
      var besoin = Math.max(1, nombre(C.phase2.amesPourAiles, 10));
      if (S.etat === 'phase2' && boss.ames >= besoin && boss.ailes === 'absentes' && !boss.act) lancerTransformation();
    }
    function setAiles(etat) { if (boss.ailes !== etat) { boss.ailes = etat; emettre('ailes', { etat: etat }); } }
    function lancerTransformation() {
      action('transformation_ailes', [
        { nom: 'cambrure', duree: d('cambrure') },
        { nom: 'deploiement', duree: d('deploiement'), entrer: function () { setAiles('apparition'); } },
        { nom: 'rugissement', duree: d('rugissementAiles'), entrer: function () { setAiles('deployees'); boss.locomotion = 'ailes'; } }
      ], { fin: function () { lancerPique(); }, annuler: function () { if (boss.ailes !== 'absentes') { setAiles('dissipation'); setAiles('absentes'); } boss.locomotion = 'levitation'; } });
    }
    function lancerPique() {
      var P = C.phase2.pique;
      var j = choisirCible('salle', 'pique');
      if (!j) return false;
      var hauteur = SOL + d('hauteurPique');
      S.pique = { depart: null, arrivee: null, etape: 'montee', cibleJoueur: j.id, verrouille: false, touches: [], derniere: copie(j.position) };
      function ligne() {
        var p = JI[S.pique.cibleJoueur];
        if (p && valide(p, 'salle')) S.pique.derniere = copie(p.position);
        else if (!S.pique.verrouille) {        // cible tombée ou partie avant le verrouillage : nouvelle cible
          var n = choisirCible('salle', 'pique');
          if (n) { S.pique.cibleJoueur = n.id; S.pique.derniere = copie(n.position); }
        }
        S.pique.depart = copie(boss.position);
        var a = S.pique.derniere;
        S.pique.arrivee = { x: a.x, y: SOL, z: a.z };
      }
      function evPique(etape) {
        emettre('pique', { etape: etape, depart: copie(S.pique.depart), arrivee: copie(S.pique.arrivee), cibleJoueur: S.pique.cibleJoueur });
      }
      action('pique', [
        { nom: 'montee', duree: P.montee, entrer: function (a) { a.donnees.y0 = boss.position.y; ligne(); evPique('montee'); },
          maj: function (a, dt) { boss.position.y = a.donnees.y0 + (hauteur - a.donnees.y0) * lisse(a.t / a.duree); ligne(); tournerVers(S.pique.arrivee, 5, dt); } },
        { nom: 'visee', duree: P.visee, entrer: function () { S.pique.etape = 'visee'; ligne(); evPique('visee'); },
          maj: function (a, dt) {
            if (!S.pique.verrouille) {
              ligne();
              if (a.t >= a.duree - P.verrouillage - 1e-9) { S.pique.verrouille = true; evPique('verrouille'); }
            }
            tournerVers(S.pique.arrivee, 6, dt);
          } },
        { nom: 'charge', duree: null, entrer: function (a) {
          S.pique.etape = 'charge';
          var dep = copie(boss.position), arr = S.pique.arrivee;
          var hor = { x: arr.x - dep.x, y: 0, z: arr.z - dep.z }, lh = norme(hor);
          var dirH = lh > 1e-6 ? echelle(hor, 1 / lh) : avant();
          var fin = { x: arr.x + dirH.x * P.depassement, y: SOL, z: arr.z + dirH.z * P.depassement };
          a.donnees.chemin = [dep, { x: arr.x, y: SOL, z: arr.z }, fin];
          a.donnees.seg = 0;
          boss.lacet = Math.atan2(dirH.x, dirH.z);
          S.pique.depart = dep;
          evPique('charge');
        }, maj: function (a, dt) {
          var reste = P.vitesse * dt, ch = a.donnees.chemin, avantPos = copie(boss.position);
          while (reste > 0 && a.donnees.seg < ch.length - 1) {
            var cible = ch[a.donnees.seg + 1], v = soustraire(cible, boss.position), l = norme(v);
            if (l <= reste) { boss.position = copie(cible); reste -= l; a.donnees.seg++; }
            else { boss.position = ajouter(boss.position, echelle(v, reste / l)); reste = 0; }
          }
          // collisions avec les joueurs (une fois chacun)
          var R = P.rayonImpact + J_RAYON;
          for (var k = 0; k < J.length; k++) {
            var j = J[k];
            if (!valide(j, 'salle') || S.pique.touches.indexOf(j.id) >= 0) continue;
            var seg = distSegment2(j.position, avantPos, boss.position);
            var yb = avantPos.y + (boss.position.y - avantPos.y) * seg.t;
            var chevauche = yb <= j.position.y + J_HAUT + 0.2 && yb + nombre(C.boss.hauteurCorps, 1.75) >= j.position.y;
            if (seg.d <= R && chevauche) { S.pique.touches.push(j.id); blesser(j.id, P.degats, 'pique'); }
          }
          var pl = dansPilier({ x: boss.position.x, y: boss.position.y, z: boss.position.z }, nombre(C.boss.rayonCorps, 0.45));
          if (pl || !dansSalle(boss.position, 1.0) || a.donnees.seg >= ch.length - 1) {
            contraindreSalle(boss.position, 1.0);
            horsPiliers(boss.position, nombre(C.boss.rayonCorps, 0.45) + 0.05);
            a.suivante = true;
          }
        } },
        { nom: 'impact', duree: d('impactPique'), entrer: function () {
          S.pique.etape = 'impact';
          boss.position.y = SOL;
          emettre('piqueImpact', { position: copie(boss.position), touches: S.pique.touches.slice() });
          setAiles('dissipation');
          boss.locomotion = 'levitation';
        } },
        { nom: 'etourdi', duree: P.etourdi, entrer: function () { S.pique = null; boss.multAction = P.multiplicateurEtourdi; },
          sortir: function () { boss.multAction = 1; } },
        { nom: 'retour', duree: P.retour, entrer: function () { setAiles('absentes'); boss.ames = 0; },
          maj: function (a, dt) { versHauteur(SOL + nombre(C.boss.hauteurLevitation, 1.25), 2.5, dt); } }
      ], {
        cibleJoueur: j.id,
        annuler: function () {
          S.pique = null; boss.multAction = 1;
          if (boss.ailes !== 'absentes') { setAiles('dissipation'); setAiles('absentes'); }
          boss.ames = 0;
          boss.locomotion = 'levitation';
        }
      });
      return true;
    }
    function lancerArrachement() {
      var R = C.phase3.arrachement;
      var enAir = S.blocs.filter(function (b) { return b.etat === 'fissure' || b.etat === 'arrache' || b.etat === 'levitation' || b.etat === 'vol'; }).length;
      if (enAir >= Math.max(1, R.blocsSimultanes)) return false;
      if (S.blocs.length >= Math.max(1, R.maxArraches)) return false;
      var j = choisirCible('salle', 'bloc');
      if (!j) return false;
      var libres = DALLES.filter(function (dl) { return !S.blocs.some(function (b) { return b.id === dl.id; }); });
      if (!libres.length) return false;
      libres.sort(function (a, b) { return dist(a.centre, boss.position) - dist(b.centre, boss.position) || cmpId(a.id, b.id); });
      // parmi les plus proches du boss, pas celles collées au joueur visé
      var cand = libres.slice(0, 6).filter(function (dl) { return dist2(dl.centre, j.position) > 4; });
      if (!cand.length) cand = libres.slice(0, 6);
      var dl = cand[Math.floor(rng() * cand.length) % cand.length];
      var b = { id: dl.id, etat: 'fissure', position: copie(dl.centre), rotation: { x: 0, y: dl.lacet, z: 0 }, t: 0,
        cibleJoueur: j.id, pointImpact: null, vitesse: v3(), spin: v3(), vol: 0, arrache: S.temps };
      S.blocs.push(b);
      emettre('bloc', { id: b.id, etat: 'fissure', position: copie(b.position) });
      function suspension() {
        var p = JI[b.cibleJoueur] || plusProcheValide('salle', boss.position);
        var vers = p ? soustraire(p.position, boss.position) : avant();
        vers.y = 0;
        var l = norme(vers) || 1;
        var cote = { x: -vers.z / l, y: 0, z: vers.x / l };
        var dSl = soustraire(dl.centre, boss.position);
        if (dSl.x * cote.x + dSl.z * cote.z < 0) cote = echelle(cote, -1);
        return { x: boss.position.x + cote.x * 1.5, y: boss.position.y + d('elevationBloc'), z: boss.position.z + cote.z * 1.5 };
      }
      function viser(predire) {
        var p = JI[b.cibleJoueur];
        if (!p || !valide(p, 'salle')) { var n = plusProcheValide('salle', b.position); if (n) { b.cibleJoueur = n.id; p = n; } }
        if (!p) return null;
        var c = centreJoueur(p), t = dist(b.position, c) / Math.max(1, R.vitesse);
        if (predire) { c.x += p.vitesse.x * t * R.prediction; c.z += p.vitesse.z * t * R.prediction; }
        return c;
      }
      function majImpactPrevu() { majPointImpact(b, viser(true)); }
      action('arrachement', [
        { nom: 'designation', duree: R.designation, maj: function (a, dt) { tournerVers(dl.centre, 5, dt); } },
        { nom: 'fracture', duree: R.fracture, entrer: function (a) { setBloc(b, 'arrache'); a.donnees.p0 = copie(b.position); },
          maj: function (a) {
            var k = lisse(a.t / Math.max(1e-6, a.duree));
            b.position = { x: a.donnees.p0.x + dl.normale.x * 1.4 * k, y: a.donnees.p0.y + 0.3 * k, z: a.donnees.p0.z + dl.normale.z * 1.4 * k };
            b.rotation.x = 0.15 * k;
          } },
        { nom: 'levitation', duree: R.levitation, entrer: function (a) { setBloc(b, 'levitation'); a.donnees.p1 = copie(b.position); },
          maj: function (a, dt) {
            var k = lisse(a.t / Math.max(1e-6, a.duree));
            b.position = interp(a.donnees.p1, suspension(), k);
            b.rotation.y += 0.6 * dt; b.rotation.z = 0.12 * Math.sin(S.temps * 3);
            majImpactPrevu();
            var p = JI[b.cibleJoueur];
            if (p) tournerVers(p.position, 5, dt);
          } },
        { nom: 'projection', duree: R.projection,
          maj: function (a, dt) { b.position = suspension(); majImpactPrevu(); var p = JI[b.cibleJoueur]; if (p) tournerVers(p.position, 6, dt); },
          sortir: function () {
            var c = viser(true);
            if (!c) { impactBloc(b, [], null); return; }
            b.vitesse = echelle(normaliser(soustraire(c, b.position)), R.vitesse);
            b.spin = { x: entre(-2, 2), y: entre(-1.5, 1.5), z: entre(-2, 2) };
            b.vol = 0;
            setBloc(b, 'vol');
          } },
        { nom: 'recuperation', duree: R.recuperation }
      ], { cibleJoueur: j.id, donnees: { bloc: dl.id }, annuler: function () { lacherBloc(b); } });
      return true;
    }
    // point d'impact annoncé d'un bloc qui vise c (au sol, ou sur un pilier intact qui croise la trajectoire)
    function majPointImpact(b, c) {
      var R = C.phase3.arrachement;
      if (!c) { b.pointImpact = null; return; }
      var dir = normaliser(soustraire(c, b.position));
      var k = dir.y < -1e-3 ? (b.position.y - SOL) / -dir.y : dist(b.position, c);
      var pt = ajouter(b.position, echelle(dir, Math.min(k, dist(b.position, c) + 6)));
      var plc = pilierSurSegment(b.position, pt, nombre((C.phase3.piliers || {}).margeBloc, R.rayonBloc * 0.6));
      if (plc) {
        var cp = interp(b.position, pt, plc.t), ex = cp.x - plc.pl.x, ez = cp.z - plc.pl.z, el = Math.sqrt(ex * ex + ez * ez) || 1;
        b.pointImpact = { x: plc.pl.x + ex / el * plc.pl.r, y: clamp(cp.y, SOL + 0.3, SOL + plc.pl.h - 0.3), z: plc.pl.z + ez / el * plc.pl.r };
      } else b.pointImpact = { x: pt.x, y: SOL, z: pt.z };
    }
    // ── Salves de murs (v1.4, API.md §16.3) ──
    // Sous phase3.salve.seuil × PV max de la phase 3, chaque arrachement devient une salve : `blocs` dalles désignées ensemble
    // (sur des murs différents si possible), fracture et lévitation simultanées, puis projections à `ecart` s d'intervalle.
    // Les blocs sont répartis à tour de rôle entre les joueurs valides (le premier servi change à chaque salve) ; le k-ième
    // bloc d'un joueur vise sa position prédite (predictions[k], même sens que arrachement.prediction : fraction du mouvement
    // pendant le vol) décalée de ± decalage m sur le côté à partir du 3e. Au moins 25 % par bloc, piliers comme d'habitude
    // (majBlocs). blocsSimultanes ne bride pas une salve ; maxArraches oui (la salve est raccourcie, ou remise à plus tard).
    function salveActive() {
      var SV = C.phase3.salve;
      return !!SV && S.etat === 'phase3' && !!S.segmentsMax && S.pv <= nombre(SV.seuil, 0.5) * S.segmentsMax[2] + 1e-9;
    }
    function choisirDallesSalve(n, valides) {
      var libres = DALLES.filter(function (dl) { return !S.blocs.some(function (b) { return b.id === dl.id; }); });
      var loin = libres.filter(function (dl) { return valides.every(function (j) { return dist2(dl.centre, j.position) > 4; }); });
      if (loin.length >= n) libres = loin;
      var parMur = {};
      libres.forEach(function (dl) { (parMur[dl.mur] = parMur[dl.mur] || []).push(dl); });
      var murs = Object.keys(parMur).map(function (m) {
        var l = parMur[m].sort(function (a, b) { return dist(a.centre, boss.position) - dist(b.centre, boss.position) || cmpId(a.id, b.id); });
        return { m: m, l: l, d: dist(l[0].centre, boss.position) };
      }).sort(function (a, b) { return a.d - b.d || cmpId(a.m, b.m); });
      var pool = murs.slice(0, Math.min(murs.length, n + 2)), choix = [];
      while (choix.length < n && pool.length) {               // un mur différent par bloc, au hasard parmi les plus proches
        var w = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
        choix.push(w.l[Math.floor(rng() * w.l.length) % w.l.length]);
      }
      if (choix.length < n) {                                  // pas assez de murs : d'autres dalles, les plus proches du boss
        libres.filter(function (dl) { return choix.indexOf(dl) < 0; })
          .sort(function (a, b) { return dist(a.centre, boss.position) - dist(b.centre, boss.position) || cmpId(a.id, b.id); })
          .slice(0, n - choix.length).forEach(function (dl) { choix.push(dl); });
      }
      return choix;
    }
    function lancerSalve() {
      var R = C.phase3.arrachement, SV = C.phase3.salve;
      var n = Math.min(Math.max(1, Math.floor(nombre(SV.blocs, 4))), Math.max(0, Math.floor(nombre(R.maxArraches, 10)) - S.blocs.length));
      if (n <= 0) return false;
      var valides = joueursValides('salle').sort(function (a, b) { return cmpId(a.id, b.id); });
      if (!valides.length) return false;
      var dalles = choisirDallesSalve(n, valides);
      n = dalles.length;
      if (!n) return false;
      S.salveTour = ((S.salveTour == null ? -1 : S.salveTour) + 1) % valides.length;
      var parJoueur = {}, pred = SV.predictions && SV.predictions.length ? SV.predictions : [nombre(R.prediction, 0.35)];
      var lot = dalles.map(function (dl, i) {
        var j = valides[(S.salveTour + i) % valides.length], k = parJoueur[j.id] = parJoueur[j.id] == null ? 0 : parJoueur[j.id] + 1;
        var b = { id: dl.id, etat: 'fissure', position: copie(dl.centre), rotation: { x: 0, y: dl.lacet, z: 0 }, t: 0,
          cibleJoueur: j.id, pointImpact: null, vitesse: v3(), spin: v3(), vol: 0, arrache: S.temps };
        S.blocs.push(b);
        emettre('bloc', { id: b.id, etat: 'fissure', position: copie(b.position) });
        return { b: b, dl: dl, k: k, i: i, prediction: nombre(pred[Math.min(k, pred.length - 1)], 0),
          lateral: k >= 2 ? nombre(SV.decalage, 1.1) * (k % 2 === 0 ? 1 : -1) : 0, parti: false };
      });
      function suspension(e) {                                 // au-dessus du boss, du côté de sa dalle (les blocs s'écartent)
        var dS = soustraire(e.dl.centre, boss.position); dS.y = 0;
        var l = norme(dS) || 1;
        return { x: boss.position.x + dS.x / l * 1.8, y: boss.position.y + d('elevationBloc') + 0.35 * (e.i % 2), z: boss.position.z + dS.z / l * 1.8 };
      }
      function viser(e) {
        var b = e.b, p = JI[b.cibleJoueur];
        if (!p || !valide(p, 'salle')) { var nv = plusProcheValide('salle', b.position); if (nv) { b.cibleJoueur = nv.id; p = nv; } }
        if (!p) return null;
        var c = centreJoueur(p), t = dist(b.position, c) / Math.max(1, R.vitesse);
        c.x += p.vitesse.x * t * e.prediction; c.z += p.vitesse.z * t * e.prediction;
        if (e.lateral) {
          var hx = c.x - b.position.x, hz = c.z - b.position.z, hl = Math.sqrt(hx * hx + hz * hz) || 1;
          c.x += -hz / hl * e.lateral; c.z += hx / hl * e.lateral;
        }
        return c;
      }
      function prevoir(e) { majPointImpact(e.b, viser(e)); }
      function projeter(e) {
        e.parti = true;
        var c = viser(e);
        if (!c) { impactBloc(e.b, [], null); return; }
        e.b.vitesse = echelle(normaliser(soustraire(c, e.b.position)), R.vitesse);
        e.b.spin = { x: entre(-2, 2), y: entre(-1.5, 1.5), z: entre(-2, 2) };
        e.b.vol = 0;
        setBloc(e.b, 'vol');
      }
      var ecart = Math.max(0, nombre(SV.ecart, 0.12)), centreVise = function () {
        var p = JI[lot[0].b.cibleJoueur]; return p ? p.position : null;
      };
      action('arrachement', [
        { nom: 'designation', duree: R.designation, maj: function (a, dt) { tournerVers(lot[0].dl.centre, 5, dt); } },
        { nom: 'fracture', duree: R.fracture, entrer: function () { lot.forEach(function (e) { setBloc(e.b, 'arrache'); e.p0 = copie(e.b.position); }); },
          maj: function (a) {
            var k = lisse(a.t / Math.max(1e-6, a.duree));
            lot.forEach(function (e) {
              e.b.position = { x: e.p0.x + e.dl.normale.x * 1.4 * k, y: e.p0.y + 0.3 * k, z: e.p0.z + e.dl.normale.z * 1.4 * k };
              e.b.rotation.x = 0.15 * k;
            });
          } },
        { nom: 'levitation', duree: R.levitation, entrer: function () { lot.forEach(function (e) { setBloc(e.b, 'levitation'); e.p1 = copie(e.b.position); }); },
          maj: function (a, dt) {
            var k = lisse(a.t / Math.max(1e-6, a.duree));
            lot.forEach(function (e) {
              e.b.position = interp(e.p1, suspension(e), k);
              e.b.rotation.y += 0.6 * dt; e.b.rotation.z = 0.12 * Math.sin(S.temps * 3 + e.i);
              prevoir(e);
            });
            var c = centreVise(); if (c) tournerVers(c, 5, dt);
          } },
        { nom: 'projection', duree: R.projection + (n - 1) * ecart,
          maj: function (a, dt) {
            lot.forEach(function (e) {
              if (e.parti) return;
              e.b.position = suspension(e);
              prevoir(e);
              if (a.t >= R.projection + e.i * ecart - 1e-9) projeter(e);
            });
            var c = centreVise(); if (c) tournerVers(c, 6, dt);
          },
          sortir: function () { lot.forEach(function (e) { if (!e.parti) projeter(e); }); } },
        { nom: 'recuperation', duree: R.recuperation }
      ], { cibleJoueur: lot[0].b.cibleJoueur, donnees: { salve: true, blocs: lot.map(function (e) { return e.b.id; }) },
        annuler: function () { lot.forEach(function (e) { if (!e.parti) lacherBloc(e.b); }); } });
      return true;
    }
    function lancerOndeChoc() {
      var Oc = C.phase3.ondeChoc;
      action('onde_choc', [
        { nom: 'preparation', duree: Oc.preparation },
        { nom: 'frappe', duree: 0.2, entrer: function () {
          var touches = [];
          joueursValides('salle').forEach(function (j) {
            if (dist2(j.position, boss.position) <= Oc.rayon) {
              var dir = normaliser({ x: j.position.x - boss.position.x, y: 0, z: j.position.z - boss.position.z });
              if (blesser(j.id, Oc.degats, 'onde_choc', { recul: { direction: dir, force: Oc.recul } })) touches.push(j.id);
            }
          });
          emettre('ondeChoc', { position: { x: boss.position.x, y: SOL, z: boss.position.z }, rayon: Oc.rayon, touches: touches });
        } },
        { nom: 'recuperation', duree: 0.6 }
      ], {});
      S.proximite = {};
    }

    // ─────────────────────────────────────── phase 5 ───────────────────────────────────────
    function pointsBossValides() {
      return pointsBunker('boss').filter(function (p) { return !existe('positionValide') || appel('positionValide', copie(p), 'bunker') !== false; });
    }
    function pointReapparition(distMin) {
      var pts = pointsBossValides();
      if (!pts.length) { avertir('aucun point d’apparition du boss dans Bunker 7 (pointsBunker(’boss’))', 'pts-boss'); return null; }
      var valides = joueursValides('bunker');
      function dmin(p) { var m = 1e9; valides.forEach(function (j) { m = Math.min(m, dist(j.position, p)); }); return m; }
      var loin = pts.filter(function (p) { return dmin(p) >= distMin; });
      var caches = loin.filter(function (p) { return !existe('visible') || valides.every(function (j) { return appel('visible', teteJoueur(j), { x: p.x, y: p.y + 1.5, z: p.z }, 'bunker') === false; }); });
      var l = caches.length ? caches : loin.length ? loin : pts.slice().sort(function (a, b) { return dmin(b) - dmin(a); }).slice(0, 1);
      return l[Math.floor(rng() * l.length) % l.length];
    }
    // Point de réapparition après un blocage : d'abord un point d'apparition du boss à ≥ 6 m de la cible, d'où un
    // chemin mène à la cible et que les joueurs ne voient pas ; sinon un point valide sur un anneau de 3 à 7 m autour
    // de la cible (positionValide + chemin) ; sinon le point d'apparition le plus proche de la cible.
    function pointAntiBlocage(cible) {
      var pts = pointsBossValides(), valides = joueursValides('bunker');
      function cache(p) { return !existe('visible') || valides.every(function (j) { return appel('visible', teteJoueur(j), { x: p.x, y: p.y + 1.5, z: p.z }, 'bunker') === false; }); }
      function relie(p) { if (!existe('chemin')) return true; var ch = appel('chemin', copie(p), copie(cible.position), 'bunker'); return Array.isArray(ch) && ch.length > 0; }
      var tries = pts.map(function (p) { return { p: p, d: dist(p, cible.position) }; })
        .filter(function (q) { return q.d >= 6 && dist(q.p, boss.position) >= 1; }).sort(function (a, b) { return a.d - b.d; });
      var i, q;
      for (i = 0; i < tries.length; i++) { q = tries[i].p; if (cache(q) && relie(q)) return q; }
      for (i = 0; i < tries.length; i++) { q = tries[i].p; if (relie(q)) return q; }
      for (var k = 0; k < 16; k++) {
        var ang = rng() * Math.PI * 2, r = 3 + rng() * 4;
        q = { x: cible.position.x + Math.sin(ang) * r, y: cible.position.y, z: cible.position.z + Math.cos(ang) * r };
        if (existe('positionValide') && appel('positionValide', copie(q), 'bunker') !== true) continue;
        if (relie(q)) return q;
      }
      if (!pts.length) return null;
      return pts.slice().sort(function (a, b) { return dist(a, cible.position) - dist(b, cible.position); })[0];
    }
    function choisirCibleTraque() {
      var l = joueursValides('bunker');
      if (!l.length) return null;
      var libres = l.filter(function (p) { return S.joueurs[p.id].immuniteFrappeJusqua <= S.temps; });
      var cand = libres.length ? libres : l;
      if (C.coop.ciblesDifferentes && cand.length > 1 && S.derniereFrappe != null) {
        var autres = cand.filter(function (p) { return p.id !== S.derniereFrappe; });
        if (autres.length) cand = autres;
      }
      cand.sort(function (a, b) { return dist(a.position, boss.position) - dist(b.position, boss.position) || cmpId(a.id, b.id); });
      var T = boss.traque, actuelle = T && T.cible != null ? JI[T.cible] : null;
      if (actuelle && cand.indexOf(actuelle) >= 0 && S.temps - T.choixT < 1.0) return actuelle;
      if (actuelle && cand.indexOf(actuelle) >= 0 && dist(actuelle.position, boss.position) <= 1.3 * dist(cand[0].position, boss.position)) { T.choixT = S.temps; return actuelle; }
      if (T) { T.cible = cand[0].id; T.choixT = S.temps; T.chemin = null; }
      return cand[0];
    }
    function traque(dt) {
      var TR = C.phase5.traque;
      if (!boss.traque) boss.traque = { cible: null, choixT: -1e9, chemin: null, idx: 0, recalc: 0, dest: null, histo: [], histoT: -1e9 };
      var T = boss.traque;
      var cible = choisirCibleTraque();
      if (!cible) { boss.vitesse = v3(); T.histo = []; return; }
      T.cible = cible.id;
      var dCible = dist(boss.position, cible.position);
      // attaque
      if (dist2(boss.position, cible.position) <= TR.distanceAttaque && Math.abs(boss.position.y - cible.position.y) < 2 &&
          (!existe('visible') || appel('visible', { x: boss.position.x, y: boss.position.y + 1.3, z: boss.position.z }, centreJoueur(cible), 'bunker') !== false)) {
        lancerFrappe(cible);
        T.histo = [];
        return;
      }
      // chemin (recalculé régulièrement ou si la cible s'est éloignée du bout du chemin)
      T.recalc -= dt;
      if (!T.chemin || T.recalc <= 0 || !T.dest || dist(T.dest, cible.position) > 2) {
        var ch = existe('chemin') ? appel('chemin', copie(boss.position), copie(cible.position), 'bunker') : [copie(cible.position)];
        T.chemin = Array.isArray(ch) && ch.length ? ch.map(copie) : null;
        T.idx = 0;
        T.recalc = TR.recalculChemin;
        T.dest = copie(cible.position);
      }
      if (T.chemin) {
        var v = dCible < TR.distanceProche ? TR.vitesseProche : TR.vitesse, reste = v * dt, avantPos = copie(boss.position);
        while (reste > 0 && T.idx < T.chemin.length) {
          var wp = T.chemin[T.idx], l = dist2(boss.position, wp);
          if (l <= reste) { boss.position.x = wp.x; boss.position.z = wp.z; reste -= l; T.idx++; }
          else { boss.position.x += (wp.x - boss.position.x) / l * reste; boss.position.z += (wp.z - boss.position.z) / l * reste; reste = 0; }
        }
        var wpY = T.chemin[Math.min(T.idx, T.chemin.length - 1)].y;
        versHauteur(wpY + TR.hauteur, 4, dt);
        var mv = { x: boss.position.x - avantPos.x, y: 0, z: boss.position.z - avantPos.z };
        if (norme(mv) > 1e-4) tournerVers(ajouter(boss.position, mv), 6, dt);
      }
      // anti-blocage : déplacement NET de moins de 1 m sur delaiBlocage alors qu'il chasse (immobile, coincé ou qui
      // oscille sur place à cause d'un chemin impossible). Un boss qui poursuit un joueur qui fuit avance : pas concerné.
      if (S.temps - T.histoT >= 0.5) {
        T.histoT = S.temps;
        T.histo.push({ t: S.temps, x: boss.position.x, z: boss.position.z });
        while (T.histo.length > 2 && S.temps - T.histo[1].t >= TR.delaiBlocage) T.histo.shift();
      }
      var h0 = T.histo[0];
      if (h0 && S.temps - h0.t >= TR.delaiBlocage - 1e-9 && Math.hypot(boss.position.x - h0.x, boss.position.z - h0.z) < 1.0) {
        T.histo = [];
        var p = pointAntiBlocage(cible);
        if (p) {
          emettre('avertissement', { texte: 'boss bloqué : téléportation près de la cible' });
          teleportDepart(function () { teleportArrivee({ x: p.x, y: p.y + TR.hauteur, z: p.z }, 'bunker', finTeleportTraque, true, 'blocage'); }, true, 'blocage');
        }
      }
    }
    function finTeleportTraque() { setVulnerable(true, 1); boss.traque = null; graceJauge(); }
    function graceJauge() { if (S.jauge) S.jauge.dernier = Math.max(S.jauge.dernier, S.temps); }
    // Frappe du Septième (phase 5) : règle du palier (frapperJoueur). Après des crochets (o.groupe), il frappe aussitôt tous
    // les joueurs ramenés (préparation o.preparation), sans test de portée, et leur rend les commandes après le coup.
    // Un coup qui porte au palier ≥ 1 le fait disparaître comme avant (la règle « quasi mortelle » = l'ancienne frappe spéciale).
    function lancerFrappe(cible, o) {
      o = o || {};
      var Fs = C.phase5.frappe, groupe = o.groupe || null;
      var portee = nombre(Fs.portee, 2.8), demiAngle = nombre(Fs.angle, 75) * Math.PI / 360;
      var palier = paliersActifs() ? S.palier : null, speciale = !paliersActifs() || S.palier >= 1;
      function liberer() { if (groupe) { groupe.forEach(libererTracte); (o.crochets || []).forEach(retirerCrochet); } }
      action('frappe', [
        { nom: 'preparation', duree: o.preparation != null ? o.preparation : Fs.preparation, maj: function (a, dt) {
          var p = JI[a.cibleJoueur];
          if (p && (groupe || a.t < 0.7 * a.duree)) tournerVers(p.position, 8, dt);
        } },
        { nom: 'frappe', duree: Fs.frappe, entrer: function (a) {
          var ids = groupe || [a.cibleJoueur], touches = [];
          ids.forEach(function (id) {
            var p = JI[id], ok = false;
            if (p && valide(p, 'bunker')) {
              var dh = dist2(p.position, boss.position), dy = Math.abs(p.position.y - boss.position.y);
              var ang = Math.abs(ecartAngle(boss.lacet, lacetVers(boss.position, p.position)));
              if (groupe || (dh <= portee + J_RAYON && dy < 2.0 && (ang <= demiAngle || dh < 0.6))) ok = frapperJoueur(p);
            }
            if (ok) touches.push(id);
            emettre('frappe', { joueur: id, reussie: ok, speciale: speciale, palier: palier });
          });
          a.donnees.reussie = touches.length > 0;
          a.donnees.touches = touches;
          if (touches.length) S.derniereFrappe = touches[0];
          liberer();                                        // commandes rendues après le coup
        } },
        { nom: 'recuperation', duree: function (a) { return a.donnees.reussie ? Fs.recuperation : nombre(Fs.recuperationRatee, Fs.recuperation); } }
      ], {
        cibleJoueur: cible.id, donnees: { reussie: false, speciale: speciale, palier: palier, groupe: groupe ? groupe.slice() : null },
        fin: function (a) { if (a.donnees.reussie && speciale) disparaitre5(); },
        annuler: liberer
      });
    }
    function disparaitre5() {
      teleportDepart(function () {
        S.disparition = { t: 0, duree: nombre(C.phase5.disparition.duree, 10) };
      }, false, 'frappe');
    }
    function reapparaitre5() {
      S.disparition = null;
      var p = pointReapparition(nombre(C.phase5.disparition.distanceMin, 15));
      if (!p) { S.disparition = { t: 0, duree: 1 }; return; }
      boss.traque = null;
      S.retourContact = true;
      teleportArrivee({ x: p.x, y: p.y + C.phase5.traque.hauteur, z: p.z }, 'bunker', function () { setVulnerable(true, 1); graceJauge(); }, false, 'frappe');
    }

    // ── Téléportation sur gros dégâts (phase 5, v1.1) ──
    // Fenêtre glissante : au moins teleportDegats.seuil dégâts reçus sur les teleportDegats.fenetre dernières secondes →
    // téléportation rapide vers un point atteignable (chemin valide) à distanceMin–distanceMax m du tireur (celui qui a
    // infligé le plus de dégâts dans la fenêtre), puis reprise de la traque. Seuil × (1 + seuilParJoueurSupp × (n − 1)) en coop.
    // Pendant la PRÉPARATION d'une frappe (spéciale ou ordinaire), la téléportation l'interrompt : le boss criblé de balles
    // pendant son élan s'enfuit au lieu de frapper. Jamais pendant l'impact ni la récupération d'une frappe, une téléportation,
    // la formation des lames ou une disparition ; au moins delaiMin s après sa dernière arrivée (toutes raisons).
    // Jauge : gelée pendant la téléportation puis gelJauge s, ou jusqu'au prochain tir qui le touche.
    function verifierTeleportDegats() {
      var T = C.phase5.teleportDegats, f = S.fenetreDegats;
      if (!T || !T.actif) return;
      while (f.length && S.temps - f[0].t > T.fenetre + 1e-9) f.shift();
      var act = boss.act, elan = !!act && (act.id === 'frappe' || act.id === 'frappe_ordinaire') && !!act.etapes[act.i] && act.etapes[act.i].nom === 'preparation';
      if (!f.length || !boss.present || !boss.vulnerable || S.disparition || (act && !elan)) return;
      if (S.temps - S.tDernierTp < T.delaiMin - 1e-9) return;
      var somme = 0, par = {};
      f.forEach(function (e) { somme += e.m; par[e.j] = (par[e.j] || 0) + e.m; });
      if (somme < T.seuil * echelleCoop(nombre(T.seuilParJoueurSupp, 0)) - 1e-9) return;
      var tireur = null, meilleur = -1;
      joueursValides('bunker').sort(function (a, b) { return cmpId(a.id, b.id); }).forEach(function (p) {
        var m = par[p.id] || 0;
        if (m > meilleur) { meilleur = m; tireur = p; }
      });
      if (!tireur) return;
      S.fenetreDegats = [];
      var p = pointTeleportDegats(tireur, T);
      if (!p) {
        S.tDernierTp = S.temps;                         // nouvel essai dans delaiMin s
        avertir('téléportation sur dégâts impossible : aucun point atteignable à ' + T.distanceMin + '–' + T.distanceMax + ' m du tireur', 'tp-degats');
        return;
      }
      var H = C.phase5.traque.hauteur;
      boss.traque = null;
      teleportDepart(function () {
        teleportArrivee({ x: p.x, y: p.y + H, z: p.z }, 'bunker', function () {
          setVulnerable(true, 1);
          boss.traque = null;
          graceJauge();
          S.gelJaugeJusqua = S.temps + Math.max(0, nombre(T.gelJauge, 0));
        }, true, 'degats');
      }, true, 'degats');
    }
    function pointTeleportDegats(tireur, T) {
      var dmin = nombre(T.distanceMin, 12), dmax = nombre(T.distanceMax, 32);
      function relie(q) {
        if (!existe('chemin')) return true;
        var ch = appel('chemin', copie(q), copie(tireur.position), 'bunker');
        return Array.isArray(ch) && ch.length > 0;
      }
      function distanceOk(q) { var dd = dist2(q, tireur.position); return dd >= dmin - 1e-9 && dd <= dmax + 1e-9 && dist2(q, boss.position) >= 3; }
      var cand = pointsBossValides().filter(distanceOk).filter(relie);
      if (!cand.length && existe('positionValide')) {   // sinon : points tirés sur l'anneau autour du tireur
        for (var k = 0; k < 24 && !cand.length; k++) {
          var ang = rng() * Math.PI * 2, r = entre(dmin, dmax);
          var q = { x: tireur.position.x + Math.sin(ang) * r, y: tireur.position.y, z: tireur.position.z + Math.cos(ang) * r };
          if (appel('positionValide', copie(q), 'bunker') === true && distanceOk(q) && relie(q)) cand.push(q);
        }
      }
      if (!cand.length) return null;
      return cand[Math.floor(rng() * cand.length) % cand.length];
    }

    // ── Paliers de la phase 5 (v1.4, API.md §16.5) ──
    // Le palier = nombre de phase5.paliers.seuils atteints par la jauge ; il reste acquis (la jauge qui redescend ne le fait
    // pas reculer). 0 : lames bleues, chaque coup inflige bleu.degats (réductions permises) puis bleu.invulnerabilite s, sans
    // disparition. ≥ 1 : lames rouges, chaque coup laisse à frappe.pvRestants (invulnérable frappe.invulnerabilite s, puis le
    // Septième disparaît) ; un joueur déjà à critique ou moins meurt. ≥ 2 : intangibilité (v1.5 ; les illusions de la v1.4
    // sont retirées). ≥ 3 : crochets. La frappe ordinaire et
    // l'immunité de 15 s (phase5.frappeOrdinaire, phase5.frappe.immunite) ne servent plus.
    function paliersActifs() { var P = C.phase5.paliers; return !!(P && Array.isArray(P.seuils)); }
    function couleurPalier(n) { return n == null ? null : n >= 1 ? 'rouge' : 'bleu'; }
    function majPalier() {
      if (S.palier == null || !S.jauge || !paliersActifs()) return;
      var sl = C.phase5.paliers.seuils;
      while (S.palier < sl.length && S.jauge.valeur >= nombre(sl[S.palier], 1) - 1e-9) {
        S.palier++;
        emettre('palier', { numero: S.palier, couleurLames: couleurPalier(S.palier) });
        if (S.palier >= 3 && S.crochetDispo == null) S.crochetDispo = S.temps;
      }
    }
    // Règle du palier pour un coup qui atteint le joueur p ; true si le coup porte
    function frapperJoueur(p) {
      var e = S.joueurs[p.id], Fs = C.phase5.frappe, P = C.phase5.paliers || {};
      if (!touchePossible(p.id)) return false;
      if (paliersActifs() && S.palier === 0) {
        var B = P.bleu || {};
        if (!blesser(p.id, nombre(B.degats, 0.5), 'frappe')) return false;
        e.invulnerableJusqua = S.temps + nombre(B.invulnerabilite, 1.0);
        appliquerEtatsJoueurs();
        return true;
      }
      if (paliersActifs() && p.pvFraction <= nombre(P.critique, 0.05) + 1e-9) {   // déjà critique : le coup le tue
        return blesser(p.id, 1, 'frappe', { ignorerReductions: true });
      }
      appel('blessureCritique', p.id, nombre(Fs.pvRestants, 0.01));
      e.invulnerableJusqua = S.temps + nombre(Fs.invulnerabilite, 3.0);
      if (!e.critique) { e.critique = true; emettre('critique', { joueur: p.id, actif: true }); }
      emettre('joueurTouche', { joueur: p.id, source: 'frappe', fraction: null });
      appliquerEtatsJoueurs();
      return true;
    }

    // ── Intangibilité (palier 2, v1.5, API.md §17.3 ; remplace les illusions de la v1.4) ──
    // Au palier ≥ 2, Septième visible et sans action, aucun joueur valide à moins de `proximite` m depuis `delaiInvisible` s, et
    // `recharge` s après son dernier resurgissement (pas de recharge avant le premier) : action `evanouissement` (`fondu`), puis
    // invisible et intangible (toucherBoss → absent, jauge gelée, ni téléportation sur dégâts ni crochet). Il fonce en ligne
    // droite vers le joueur valide le plus proche à `vitesse` m/s en traversant les murs (ni chemin ni position validée en vol) ;
    // chaque mur traversé (jeu.visible(avant, après) faux, au plus un évènement par mur) → `intangible { etat: 'traversee' }`.
    // Resurgissement : après au moins une traversée, un joueur valide à ≤ distanceReapparition m en vue et sa position valide ;
    // ou à ≤ distanceProche m d'un joueur (position valide) ; ou au bout de dureeMax s, au point valide le plus proche. Action
    // `resurgissement` (`apparition`) : pendant ce temps il fond sur le joueur valide le plus proche en vue (fente.vitesse m/s,
    // jusqu'à fente.distanceArret m, chaque pas sur une position valide, jamais sans ligne de vue), puis le frappe aussitôt
    // (préparation preparationFrappe s).
    function intangibleCfg() { return (C.phase5.paliers && C.phase5.paliers.intangible) || null; }
    function torse(p) { return { x: p.x, y: p.y + d('torseSeptieme'), z: p.z }; }
    function majLoinIntangible(dt) {                         // temps sans joueur valide à moins de `proximite` m
      var K = intangibleCfg();
      if (!K || !boss.present || !boss.visible || boss.intangible) { S.intang.loinT = 0; return; }
      var p = plusProcheValide('bunker', boss.position);
      if (p && dist2(p.position, boss.position) >= nombre(K.proximite, 10) - 1e-9) S.intang.loinT += dt; else S.intang.loinT = 0;
    }
    function intangiblePret() {
      var K = intangibleCfg();
      return !!K && paliersActifs() && S.palier >= 2 && boss.present && boss.visible && !boss.intangible && !boss.act && !S.disparition &&
        S.intang.loinT >= nombre(K.delaiInvisible, 1.5) - 1e-9 && joueursValides('bunker').length > 0 &&
        (S.intang.dernier == null || S.temps - S.intang.dernier >= nombre(K.recharge, 6) - 1e-9);
    }
    function lancerEvanouissement() {
      var K = intangibleCfg();
      action('evanouissement', [{ nom: 'fondu', duree: nombre(K.evanouissement, 0.7) }], { fin: devenirIntangible });
    }
    function devenirIntangible() {
      boss.visible = false; boss.intangible = true; boss.locomotion = 'intangible'; boss.traque = null;
      setVulnerable(false);
      S.fenetreDegats = [];
      S.intang.vol = { t: 0, traversees: 0, enMur: false, cible: null };
      emettre('intangible', { etat: 'debut', position: copie(boss.position) });
    }
    function positionValideBunker(q) { return !existe('positionValide') || appel('positionValide', copie(q), 'bunker') !== false; }
    function pointValideProche(p) {                          // le point valide le plus proche (anneaux de 0,5 m, puis points du boss)
      var q0 = { x: p.x, y: p.y, z: p.z };
      if (positionValideBunker(q0)) return q0;
      for (var r = 0.5; r <= 12 + 1e-9; r += 0.5) {
        for (var k = 0; k < 16; k++) {
          var a = k * Math.PI / 8, q = { x: p.x + Math.sin(a) * r, y: p.y, z: p.z + Math.cos(a) * r };
          if (positionValideBunker(q)) return q;
        }
      }
      var pts = pointsBossValides().slice().sort(function (a, b) { return dist2(a, p) - dist2(b, p); });
      return pts[0] ? copie(pts[0]) : q0;
    }
    function majIntangible(dt) {
      var K = intangibleCfg(), V = S.intang.vol, H = C.phase5.traque.hauteur;
      V.t += dt;
      var sol = { x: boss.position.x, y: boss.position.y - H, z: boss.position.z };
      if (V.t >= nombre(K.dureeMax, 12) - 1e-9) { resurgir(pointValideProche(sol)); return; }
      var valides = joueursValides('bunker'), cible = plusProcheValide('bunker', boss.position);
      if (!cible) return;
      V.cible = cible.id;
      var avant = copie(boss.position), dx = cible.position.x - boss.position.x, dz = cible.position.z - boss.position.z, l = Math.sqrt(dx * dx + dz * dz);
      var pasV = nombre(K.vitesse, 6.5) * dt;
      if (l > 1e-6) { var k = Math.min(1, pasV / l); boss.position.x += dx * k; boss.position.z += dz * k; boss.lacet = lacetVers(avant, cible.position); }
      boss.position.y = cible.position.y + H;
      if (existe('visible')) {                               // mur traversé : segment du pas sans ligne de vue
        var vu = appel('visible', torse(avant), torse(boss.position), 'bunker') !== false;
        if (!vu) { if (!V.enMur) { V.enMur = true; V.traversees++; emettre('intangible', { etat: 'traversee', position: copie(boss.position) }); } }
        else V.enMur = false;
      }
      if (V.enMur) return;
      sol = { x: boss.position.x, y: boss.position.y - H, z: boss.position.z };
      var dmin = 1e9, vuProche = false, dR = nombre(K.distanceReapparition, 6);
      valides.forEach(function (p) {
        var dd = dist2(p.position, boss.position);
        dmin = Math.min(dmin, dd);
        if (dd <= dR + 1e-9 && (!existe('visible') || appel('visible', torse(boss.position), centreJoueur(p), 'bunker') !== false)) vuProche = true;
      });
      if ((dmin <= nombre(K.distanceProche, 3) + 1e-9 || (V.traversees >= 1 && vuProche)) && positionValideBunker(sol)) resurgir(sol);
    }
    function resurgir(p) {
      var K = intangibleCfg();
      boss.position = { x: p.x, y: p.y + C.phase5.traque.hauteur, z: p.z };
      boss.prec = copie(boss.position);
      S.intang.vol = null;
      S.intang.dernier = S.temps;
      boss.intangible = false; boss.visible = true; boss.locomotion = 'traque'; boss.traque = null;
      setVulnerable(true, 1);
      graceJauge();
      emettre('intangible', { etat: 'fin', position: copie(boss.position) });
      action('resurgissement', [{ nom: 'apparition', duree: nombre(K && K.resurgissement, 0.5), maj: function (a, dt) { fendre(dt); } }], { fin: function () {
        var c = plusProcheValide('bunker', boss.position);
        if (c) lancerFrappe(c, { preparation: nombre(K && K.preparationFrappe, 0.35) });
      } });
    }
    // fente du resurgissement : vers le joueur valide le plus proche, s'il est en vue, jusqu'à distanceArret m (position valide)
    function fendre(dt) {
      var K = intangibleCfg(), F = K && K.fente;
      if (!F || !boss.present) return;
      var c = plusProcheValide('bunker', boss.position);
      if (!c) return;
      var dx = c.position.x - boss.position.x, dz = c.position.z - boss.position.z, l = Math.sqrt(dx * dx + dz * dz);
      var arret = Math.max(0, nombre(F.distanceArret, 1.8));
      if (l > 1e-6) boss.lacet = lacetVers(boss.position, c.position);
      if (l <= arret + 1e-9) return;
      if (existe('visible') && appel('visible', torse(boss.position), centreJoueur(c), 'bunker') === false) return;   // pas à travers un mur
      var pas = Math.min(Math.max(0, nombre(F.vitesse, 9)) * dt, l - arret), H = C.phase5.traque.hauteur;
      var q = { x: boss.position.x + dx / l * pas, y: boss.position.y - H, z: boss.position.z + dz / l * pas };
      if (!positionValideBunker(q)) return;
      boss.position.x = q.x; boss.position.z = q.z;
    }
    // fin forcée (défaite, échec, allerA, entrée en phase 5) : de nouveau visible, sans frappe ; dans un mur → point valide le
    // plus proche
    function finIntangible(signaler) {
      var etait = boss.intangible;
      if (boss.intangible) {
        boss.intangible = false; boss.visible = boss.present; if (boss.locomotion === 'intangible') boss.locomotion = 'traque';
        if (boss.lieu === 'bunker') {
          var H = C.phase5.traque.hauteur, q = pointValideProche({ x: boss.position.x, y: boss.position.y - H, z: boss.position.z });
          boss.position = { x: q.x, y: q.y + H, z: q.z };
        }
      }
      S.intang = nouvelIntang();
      if (etait && signaler) emettre('intangible', { etat: 'fin', position: copie(boss.position) });
    }

    // ── Crochets (palier 3) ──
    // Au plus une fois toutes les `recharge` s : action `crochet` (preparation : il vise ; lancer : un crochet vers chaque
    // joueur valide à porteeMin–porteeMax m, en ligne de vue, non invulnérable, à `vitesse` m/s vers sa position au lancer ;
    // traction). Le crochet accroche si le joueur est à moins de `rayon` m de la pointe à l'arrivée ; un mur (jeu.visible)
    // l'arrête. Accroché : plus de commandes, tiré à `traction` m/s jusqu'à `arrivee` m du Septième (jeu.tirerJoueur, sinon
    // jeu.teleporter à chaque pas ; jeu.regarder vers lui), puis frappe aussitôt (preparationFrappe s) de tous les joueurs
    // ramenés, selon la règle du palier ; commandes rendues après le coup.
    function crochetCfg() { return (C.phase5.paliers && C.phase5.paliers.crochet) || {}; }
    function ciblesCrochet() {
      var K = crochetCfg(), m = main();
      return joueursValides('bunker').filter(function (p) {
        var dd = dist2(p.position, boss.position);
        if (dd < nombre(K.porteeMin, 4) - 1e-9 || dd > nombre(K.porteeMax, 22) + 1e-9) return false;
        if (!touchePossible(p.id) || S.interne[p.id].accroche) return false;
        return !existe('visible') || appel('visible', copie(m), centreJoueur(p), 'bunker') !== false;
      }).sort(function (a, b) { return dist(a.position, boss.position) - dist(b.position, boss.position) || cmpId(a.id, b.id); });
    }
    function crochetPret() {
      return paliersActifs() && S.palier >= 3 && S.crochetDispo != null && S.temps >= S.crochetDispo - 1e-9 && boss.present && boss.vulnerable &&
        !S.disparition && ciblesCrochet().length > 0;
    }
    function libererTracte(id) {
      var it = S.interne[id];
      if (!it || !it.accroche) return;
      it.accroche = false;
      appliquerEtatsJoueurs();
    }
    function lancerCrochet() {
      var K = crochetCfg(), cl = ciblesCrochet();
      if (!cl.length) return false;
      S.crochetDispo = S.temps + nombre(K.recharge, 15);
      var lot = [];
      function tous(f) { return lot.every(f); }
      action('crochet', [
        { nom: 'preparation', duree: nombre(K.preparation, 0.7), maj: function (a, dt) {
          var p = JI[a.cibleJoueur];
          if (p) { a.cible = copie(p.position); tournerVers(p.position, 8, dt); }
        } },
        { nom: 'lancer', duree: null, entrer: function (a) {
          var dep = main();
          ciblesCrochet().forEach(function (p) {
            var pt = { x: p.position.x, y: p.position.y + J_TORSE, z: p.position.z }, l = dist(dep, pt);
            var c = { id: nouvelId('crochet-'), joueur: p.id, depart: copie(dep), position: copie(dep), cible: pt, etat: 'vol', t: 0,
              dir: normaliser(soustraire(pt, dep)), longueur: l, parcouru: 0, action: a, vers: null, arrive: false };
            S.crochets.push(c);
            lot.push(c);
            emettre('crochet', { etat: 'lancer', id: c.id, joueur: p.id, position: copie(dep) });
          });
          a.donnees.crochets = lot.map(function (c) { return c.id; });
          if (!lot.length) a.suivante = true;
        }, maj: function (a) { if (tous(function (c) { return c.etat !== 'vol'; })) a.suivante = true; },
          sortir: function (a) { if (!lot.some(function (c) { return c.etat === 'accroche'; })) a.i = a.etapes.length - 1; } },   // personne : pas de traction
        { nom: 'traction', duree: null, entrer: function (a) {
          lot.forEach(function (c) {
            if (c.etat !== 'accroche') return;
            c.etat = 'traction';
            var p = JI[c.joueur];
            var dx = p ? p.position.x - boss.position.x : 0, dz = p ? p.position.z - boss.position.z : 1, l = Math.sqrt(dx * dx + dz * dz) || 1;
            c.vers = { x: dx / l, z: dz / l };
            c.tMax = (l / Math.max(1, nombre(K.traction, 14))) + 1.0;
          });
          a.donnees.tires = lot.filter(function (c) { return c.etat === 'traction'; }).map(function (c) { return c.joueur; });
        }, maj: function (a, dt) {
          var fini = true;
          lot.forEach(function (c) {
            if (c.etat !== 'traction' || c.arrive) return;
            var p = JI[c.joueur];
            if (!p || !p.vivant || p.lieu !== 'bunker') { c.etat = 'rate'; c.t = 0; libererTracte(c.joueur); return; }
            var arr = nombre(K.arrivee, 1.3);
            var but = { x: boss.position.x + c.vers.x * arr, y: p.position.y, z: boss.position.z + c.vers.z * arr };
            var dx = but.x - p.position.x, dz = but.z - p.position.z, l = Math.sqrt(dx * dx + dz * dz), pas = nombre(K.traction, 14) * dt;
            var q = l <= pas ? but : { x: p.position.x + dx / l * pas, y: p.position.y, z: p.position.z + dz / l * pas };
            if (existe('tirerJoueur')) appel('tirerJoueur', p.id, copie(q));
            else appel('teleporter', p.id, copie(q), lacetVers(q, boss.position), 'bunker');
            p.position = copie(q);
            c.position = { x: q.x, y: q.y + J_TORSE, z: q.z };
            c.t += dt;
            if (l <= pas + 1e-6 || c.t >= c.tMax) {
              c.arrive = true;
              emettre('crochet', { etat: 'arrivee', id: c.id, joueur: c.joueur, position: copie(q) });
            } else fini = false;
          });
          if (fini) a.suivante = true;
        } }
      ], {
        cibleJoueur: cl[0].id, cible: copie(cl[0].position), donnees: { crochets: [] },
        fin: function () {
          var ramenes = lot.filter(function (c) { return c.etat === 'traction' && c.arrive; }).map(function (c) { return c.joueur; });
          if (!ramenes.length) { lot.forEach(function (c) { if (c.etat !== 'rate') retirerCrochet(c); }); return; }
          var p0 = JI[ramenes[0]];
          lancerFrappe(p0 || { id: ramenes[0], position: boss.position }, { groupe: ramenes, preparation: nombre(K.preparationFrappe, 0.25), crochets: lot });
        },
        annuler: function () { lot.forEach(function (c) { libererTracte(c.joueur); if (c.etat !== 'rate') retirerCrochet(c); }); }
      });
      return true;
    }
    function retirerCrochet(c) { S.crochets = S.crochets.filter(function (x) { return x !== c; }); }
    function retirerCrochets() {
      (S.crochets || []).forEach(function (c) { libererTracte(c.joueur); });
      S.crochets = [];
    }
    function majCrochets(dt) {
      if (!S.crochets || !S.crochets.length) return;
      var K = crochetCfg(), v = nombre(K.vitesse, 26);
      for (var i = S.crochets.length - 1; i >= 0; i--) {
        var c = S.crochets[i];
        if (c.etat === 'rate') { c.t += dt; if (c.t >= 0.6) S.crochets.splice(i, 1); continue; }
        if (c.etat !== 'vol') continue;
        var pas = Math.min(v * dt, c.longueur - c.parcouru);
        var q = ajouter(c.position, echelle(c.dir, pas));
        if (existe('visible') && pas > 1e-6 && appel('visible', copie(c.position), copie(q), 'bunker') === false) {   // un mur l'arrête
          c.etat = 'rate'; c.t = 0;
          emettre('crochet', { etat: 'rate', id: c.id, joueur: c.joueur, position: copie(c.position), raison: 'mur' });
          continue;
        }
        c.position = q;
        c.parcouru += pas;
        if (c.parcouru < c.longueur - 1e-6) continue;
        var p = JI[c.joueur];
        var dans = p && valide(p, 'bunker') && touchePossible(p.id) && dist2(p.position, c.position) <= nombre(K.rayon, 0.9) + 1e-9 &&
          Math.abs(p.position.y + J_TORSE - c.position.y) < 2;
        if (dans) {
          c.etat = 'accroche'; c.t = 0;
          S.interne[p.id].accroche = true;
          appliquerEtatsJoueurs();
          appel('regarder', p.id, { x: boss.position.x, y: boss.position.y + 1.6, z: boss.position.z }, 1.5);
          emettre('crochet', { etat: 'accroche', id: c.id, joueur: c.joueur, position: copie(c.position) });
        } else {
          c.etat = 'rate'; c.t = 0;
          emettre('crochet', { etat: 'rate', id: c.id, joueur: c.joueur, position: copie(c.position), raison: 'esquive' });
        }
      }
    }

    // ── Bonus de fin de phase (v1.1) : une seule fois par fin de phase et par combat, même avec allerA ──
    function positionBonusSalle(p) {                    // sous le boss, ramené à au moins 2 m de la limite des joueurs
      var q = { x: p.x, y: SOL, z: p.z };
      contraindreSalle(q, APO - Math.max(0.5, LIMITE_J - 2));
      horsPiliers(q, 0.6);
      return q;
    }
    function positionBonusReveil() {                    // dans le bunker, devant le premier point de réveil des joueurs
      var pts = pointsBunker('arrivee'), p0 = pts[0];
      if (!p0) { var j = joueursValides('bunker')[0]; if (j) p0 = { x: j.position.x, y: j.position.y, z: j.position.z, lacet: j.lacet }; }
      if (!p0) return null;
      var l = +p0.lacet || 0, q = { x: p0.x + Math.sin(l) * 2.5, y: p0.y, z: p0.z + Math.cos(l) * 2.5 };
      if (existe('positionValide') && appel('positionValide', copie(q), 'bunker') === false) q = { x: p0.x, y: p0.y, z: p0.z };
      return q;
    }
    function positionBonusCadavre() {                   // dans la salle, à 2 m du cadavre, du côté des joueurs
      var c = RETOUR_SALLE[0] || ARRIVEE[0], dx = c ? c.x - CADAVRE.x : 0, dz = c ? c.z - CADAVRE.z : -1, l = Math.sqrt(dx * dx + dz * dz) || 1;
      return positionBonusSalle({ x: CADAVRE.x + dx / l * 2.0, z: CADAVRE.z + dz / l * 2.0 });
    }
    function poserBonus(phase, position, lieu) {
      var B = C.bonusFinDePhase;
      if (!B || !B.actif || S.bonusPoses[phase]) return;
      S.bonusPoses[phase] = true;
      var depose = false;
      if (position && existe('faireApparaitreBonus')) {
        try { depose = jeuBrut.faireApparaitreBonus({ type: B.type, position: copie(position), lieu: lieu, duree: B.duree }) !== false; }
        catch (e) { depose = false; avertir('exception dans jeu.faireApparaitreBonus : ' + (e && e.message ? e.message : e), 'exception-faireApparaitreBonus'); }
      }
      if (!depose) {
        if (existe('activerBonus')) appel('activerBonus', B.type, {});
        else avertir('ni jeu.faireApparaitreBonus ni jeu.activerBonus : bonus de fin de phase perdu', 'bonus-fin-absent');
      }
      emettre('bonus', { type: B.type, position: copie(position), lieu: lieu, phase: phase, mode: depose ? 'depose' : 'active', source: 'phase' });
    }

    // ── Meute de chiens zombies (v1.2, API.md §14.3) ──
    // Lâchée au déclencheur de la seconde moitié de la phase 1, elle chasse jusqu'à la mort du boss, sans exception :
    // les chiens ne sont pas des zombies pour la logique (hors de ZL : ni plafonds, ni absorption, ni contestation du
    // cercle, ni reduireEnCendres). Effectif : chiens.max + maxParJoueurSupp × (n − 1), suivi par la coop dynamique
    // (les chiens présents restent ; l'effectif s'applique aux remplaçants et aux failles à venir). Un chien apparaît
    // par une faille (faille.duree s d'annonce) ; mort (absent de jeu.zombies()) → remplaçant après reapparition s.
    // Phase 5 : les chiens de la salle sont retirés en silence, la meute revient dans le bunker delaiBunker s plus tard.
    // Fin : cendres à l'entrée de `defaite`, retrait silencieux en `echec`. Chien bloqué → retiré, nouvelle faille.
    function effectifMeute() {
      var Ch = C.chiens || {};
      return Math.max(0, Math.round(nombre(Ch.max, 2) + nombre(Ch.maxParJoueurSupp, 0) * (N - 1)));
    }
    function compteMeute() { var M = S.meute; return M.ordre.length + M.failles.length + M.attente.length; }
    function planifierFailles(n, delai) {
      var M = S.meute, ecart = Math.max(0, nombre(C.chiens.faille && C.chiens.faille.ecart, 0.6));
      for (var k = 0; k < n; k++) M.attente.push({ t: delai + k * ecart });
    }
    function lacherMeute(lieu, delai) {
      var Ch = C.chiens;
      if (!Ch || !Ch.actif || (S.meute && S.meute.active)) return;
      S.meute = { active: true, lieu: lieu, max: effectifMeute(), chiens: {}, ordre: [], failles: [], attente: [] };
      emettre('meute', { etat: 'dechainee', max: S.meute.max });
      planifierFailles(S.meute.max, Math.max(0, nombre(delai, 0)));
    }
    function dissoudreMeute(effet, raison) {
      var M = S.meute;
      if (!M) return;
      for (var i = 0; i < M.ordre.length; i++) {
        var c = M.chiens[M.ordre[i]];
        appel('retirerZombie', c.id, { effet: effet, points: false });
        emettre('chien', { etat: 'fin', id: c.id, position: copie(c.position), lieu: c.lieu, raison: raison });
      }
      var etaitActive = M.active;
      M.chiens = {}; M.ordre = []; M.failles = []; M.attente = []; M.active = false;
      if (etaitActive) emettre('meute', { etat: 'dissipee', max: M.max });
    }
    function transfererMeute() {                          // début de la phase 5 : la meute passe dans Bunker 7
      var M = S.meute;
      for (var i = 0; i < M.ordre.length; i++) {
        var c = M.chiens[M.ordre[i]];
        appel('retirerZombie', c.id, { effet: 'silencieux', points: false });
        emettre('chien', { etat: 'fin', id: c.id, position: copie(c.position), lieu: c.lieu, raison: 'transfert' });
      }
      M.chiens = {}; M.ordre = []; M.failles = []; M.attente = [];
      M.lieu = 'bunker';
      planifierFailles(M.max, Math.max(0, nombre(C.chiens.delaiBunker, 4)));
    }
    function ajusterMeute() {                             // la coop change : nouvel effectif
      var M = S.meute;
      if (!M || !M.active) return;
      M.max = effectifMeute();
      var n = compteMeute();
      if (n < M.max) planifierFailles(M.max - n, 0);
      else while (compteMeute() > M.max && M.attente.length) M.attente.pop();
    }
    function pointFaille(lieu) {
      var F = C.chiens.faille || {}, dmin = nombre(F.distance && F.distance[0], 8), dmax = nombre(F.distance && F.distance[1], 16);
      var valides = joueursValides(lieu), k, p;
      function dProche(q) { var m = 1e9; for (var i = 0; i < valides.length; i++) m = Math.min(m, dist2(valides[i].position, q)); return m; }
      function relie(q) {
        if (!existe('chemin') || !valides.length) return true;
        var ch = appel('chemin', copie(q), copie(plusProcheValide(lieu, q).position), lieu);
        return Array.isArray(ch) && ch.length > 0;
      }
      function auHasard(l) { return l[Math.floor(rng() * l.length) % l.length]; }
      if (lieu === 'salle') {
        for (k = 0; k < 24; k++) {
          var ancre = valides.length ? auHasard(valides).position : CENTRE, ang = rng() * Math.PI * 2, r = entre(dmin, dmax);
          p = { x: ancre.x + Math.sin(ang) * r, y: SOL, z: ancre.z + Math.cos(ang) * r };
          if (!dansSalle(p, 1.5) || dansPilier(p, 0.6) || dansCuve(p, 0.6)) continue;
          if (valides.length) { var dd = dProche(p); if (dd < dmin - 1e-9 || dd > dmax + 1e-9) continue; }
          if (existe('positionValide') && appel('positionValide', copie(p), 'salle') === false) continue;
          if (!relie(p)) continue;
          return p;
        }
        var br = BRECHES.slice().sort(function (a, b) { return dProche(b) - dProche(a); });   // repli : brèche la plus éloignée
        return br.length ? copie(br[0]) : null;
      }
      var pts = pointsBunker('zombies'), cand = [];
      for (k = 0; k < pts.length; k++) { var d2 = valides.length ? dProche(pts[k]) : 15; if (d2 >= 8 && d2 <= 30 && relie(pts[k])) cand.push(pts[k]); }
      if (cand.length) return copie(auHasard(cand));
      if (existe('positionValide') && valides.length) {   // sinon : points valides atteignables à 10–20 m des joueurs
        for (k = 0; k < 24; k++) {
          var a0 = auHasard(valides).position, an = rng() * Math.PI * 2, rr = entre(10, 20);
          p = { x: a0.x + Math.sin(an) * rr, y: a0.y, z: a0.z + Math.cos(an) * rr };
          if (appel('positionValide', copie(p), 'bunker') !== true || dProche(p) < 10 - 1e-9 || !relie(p)) continue;
          return p;
        }
      }
      return pts.length ? copie(auHasard(pts)) : null;
    }
    function ouvrirFaille() {
      var M = S.meute, p = pointFaille(M.lieu);
      if (!p) return false;
      var f = { id: nouvelId('faille-'), position: p, lieu: M.lieu, t: 0, duree: Math.max(0, nombre(C.chiens.faille && C.chiens.faille.duree, 0.9)) };
      M.failles.push(f);
      emettre('chien', { etat: 'faille', id: f.id, position: copie(p), lieu: M.lieu });
      return true;
    }
    function faireJaillirChien(f) {
      var pf = C.chiens.profil || {};
      var id = appel('faireApparaitreZombie', { position: copie(f.position), lieu: f.lieu, effet: 'faille', source: 'boss', type: 'chien',
        vitesse: 'sprint', agressif: true, profil: { pv: pf.pv, vitesse: pf.vitesse, degats: pf.degats, cadence: pf.cadence, portee: pf.portee } });
      if (id == null) return false;
      var M = S.meute, cle = String(id);
      M.chiens[cle] = { id: id, position: copie(f.position), lieu: f.lieu, vu: S.trame, vuUneFois: false, ne: S.temps, ref: copie(f.position), refT: S.temps };
      M.ordre.push(cle);
      emettre('chien', { etat: 'apparition', id: id, position: copie(f.position), lieu: f.lieu, faille: f.id });
      return true;
    }
    function majMeute(dt) {
      var M = S.meute;
      if (!M || !M.active) return;
      var Ch = C.chiens, i, c;
      for (i = M.ordre.length - 1; i >= 0; i--) {
        c = M.chiens[M.ordre[i]];
        if (c.vu !== S.trame) {
          if (!c.vuUneFois) {                             // jamais vu dans jeu.zombies() : on ne peut pas suivre sa mort
            if (S.temps - c.ne > 2) avertir('jeu.zombies() ne liste pas les chiens de la meute : morts et remplaçants impossibles à suivre', 'chiens-invisibles');
            continue;
          }
          M.ordre.splice(i, 1);
          delete M.chiens[String(c.id)];
          emettre('chien', { etat: 'mort', id: c.id, position: copie(c.position), lieu: c.lieu });
          if (compteMeute() < M.max) M.attente.push({ t: entre(Ch.reapparition) });
          continue;
        }
        if (dist(c.position, c.ref) >= 0.5) { c.ref.x = c.position.x; c.ref.y = c.position.y; c.ref.z = c.position.z; c.refT = S.temps; }
        else if (S.temps - c.refT >= nombre(Ch.bloque, 10)) {
          var proche = plusProcheValide(c.lieu, c.position);
          if (proche && dist2(proche.position, c.position) <= 6) c.refT = S.temps;   // il attend au contact : pas bloqué
          else {
            appel('retirerZombie', c.id, { effet: 'silencieux', points: false });
            M.ordre.splice(i, 1);
            delete M.chiens[String(c.id)];
            emettre('chien', { etat: 'fin', id: c.id, position: copie(c.position), lieu: c.lieu, raison: 'bloque' });
            if (existe('journal')) appel('journal', 'info', 'BossB7 : chien bloqué ' + c.id + ' remplacé');
            M.attente.push({ t: 0 });
          }
        }
      }
      for (i = M.attente.length - 1; i >= 0; i--) {
        var w = M.attente[i];
        w.t -= dt;
        if (w.t > 1e-9) continue;
        if (ouvrirFaille()) M.attente.splice(i, 1); else w.t = 1.0;
      }
      for (i = M.failles.length - 1; i >= 0; i--) {
        var f = M.failles[i];
        f.t += dt;
        if (f.t < f.duree - 1e-9) continue;
        M.failles.splice(i, 1);
        if (!faireJaillirChien(f)) M.attente.push({ t: entre(Ch.reapparition) });
      }
    }

    // ── Cuves et mini-boss de la phase 2 (v1.3, API.md §15) ──
    // Seuils (miniBoss.seuils, fractions des PV du segment de la phase 2) : au 1er passage sous un seuil, les PV sont bloqués
    // au seuil (même un coup énorme ne le saute pas) et le boss devient protégé (toucherBoss → invulnerable). Il siphonne la
    // cuve du mini-boss suivant de `ordre` (action `siphon` : approche, aspiration, eclatement, recuperation ; cuve siphon →
    // fissure → eclate). Un piqué déjà lancé (charge et après) va au bout, toute autre action est annulée ; le siphon commence
    // au plus tard siphonDelaiMax s après le seuil (le piqué est alors coupé, jamais pendant sa charge ni son impact).
    // apparition.delai s après l'éclatement : jeu.faireApparaitreZombie({ type, miniBoss: true, nom, profil, effet: 'cuve' }),
    // PV × coop au moment de l'apparition. Suivi par jeu.zombies() (pv, pvMax) ; mort → protection levée, PV repartent du
    // seuil. Les mini-boss ne sont pas des zombies pour la logique (hors de ZL : ni absorption, ni plafonds, ni cendres, ni
    // contestation). Garde-fous : apparition refusée → 5 nouveaux essais (1 s) puis protection levée ; mini-boss bloqué loin
    // des joueurs → remis devant sa cuve avec ses PV ; jamais listé par jeu.zombies() → avertissement, protection levée.
    var PIQUE_LANCE = ['charge', 'impact', 'etourdi', 'retour'];
    function miniBossActif() { return !!(C.miniBoss && C.miniBoss.actif); }
    function estTypeMiniBoss(type) { return type != null && !!C.miniBoss && (C.miniBoss.ordre || []).indexOf(type) >= 0; }
    function miniBossSuivi(id) {
      if (!S.mb) return null;
      var cle = String(id), l = S.mb.liste;
      for (var i = 0; i < l.length; i++) if (l[i].etat === 'actif' && !l[i].remise && l[i].cle === cle) return l[i];
      return null;
    }
    function tubeDe(type) {
      for (var i = 0; i < TUBES.length; i++) if (TUBES[i].miniBoss === type) return TUBES[i];
      var k = (C.miniBoss.ordre || []).indexOf(type);
      return TUBES[k] || null;
    }
    function setTube(tube, etat) {
      var st = S.tubes[tube.i];
      if (!st || st.etat === etat) return;
      st.etat = etat; st.depuis = S.temps;
      emettre('tube', { id: tube.id, etat: etat, position: { x: tube.x, y: SOL, z: tube.z }, miniBoss: tube.miniBoss });
    }
    function pvSeuilMiniBoss(k) { return nombre(C.miniBoss.seuils[k], 0) * (S.segmentsMax ? S.segmentsMax[1] : 0); }
    function seuilMiniBossRestant() { return miniBossActif() && S.mb.prochain < (C.miniBoss.seuils || []).length && S.mb.prochain < (C.miniBoss.ordre || []).length; }
    // PV après un coup en phase 2 : bloqués au prochain seuil (qui déclenche la protection), sans jamais soigner
    function bornerSeuilMiniBoss(nouveau) {
      if (S.etat !== 'phase2' || S.mb.protege || !seuilMiniBossRestant()) return nouveau;
      var lim = pvSeuilMiniBoss(S.mb.prochain);
      if (nouveau > lim + 1e-9) return nouveau;
      nouveau = Math.max(nouveau, Math.min(lim, S.pv));
      declencherProtection(S.mb.prochain);
      return nouveau;
    }
    function verifierSeuilsMiniBoss() {                   // chaque pas de phase 2 : PV forcés ou ajustés par la coop
      if (S.etat !== 'phase2' || S.mb.protege || !seuilMiniBossRestant() || !S.segmentsMax) return;
      if (S.pv <= pvSeuilMiniBoss(S.mb.prochain) + 1e-9) declencherProtection(S.mb.prochain);
    }
    function declencherProtection(k) {
      var type = C.miniBoss.ordre[k];
      S.mb.prochain = k + 1;
      S.mb.protege = true;
      S.mb.type = type;
      S.mb.attente = { k: k, type: type, t: 0 };         // le siphon commence au pas suivant (ou après le piqué lancé)
    }
    function majAttenteSiphon(dt) {
      var at = S.mb.attente, a = boss.act;
      at.t += dt;
      if (a && a.id === 'pique' && PIQUE_LANCE.indexOf(a.etapes[a.i].nom) >= 0) {
        var et = a.etapes[a.i].nom;
        if (at.t < d('siphonDelaiMax') - 1e-9 || et === 'charge' || et === 'impact') return;
      }
      S.mb.attente = null;
      annulerAction();
      lancerSiphon(at.type);
    }
    function lancerSiphon(type) {
      var SI = C.miniBoss.siphon || {}, tube = tubeDe(type);
      if (!tube) { programmerApparition(type, null); return; }
      var cible = { x: tube.x, y: SOL + d('hauteurSiphon'), z: tube.z };
      var fissure = clamp(nombre(SI.fissure, 0.6), 0, 1);
      action('siphon', [
        { nom: 'approche', duree: nombre(SI.approche, 1.0), maj: function (a, dt) { tournerVers(a.cible, 3, dt); } },
        { nom: 'aspiration', duree: nombre(SI.aspiration, 2.2), entrer: function () { setTube(tube, 'siphon'); },
          maj: function (a, dt) { tournerVers(a.cible, 3, dt); if (a.t >= fissure * a.duree - 1e-9) setTube(tube, 'fissure'); },
          sortir: function () { setTube(tube, 'fissure'); } },
        { nom: 'eclatement', duree: nombre(SI.eclatement, 0.6), entrer: function () { setTube(tube, 'eclate'); programmerApparition(type, null); } },
        { nom: 'recuperation', duree: nombre(SI.recuperation, 0.8) }
      ], { cible: cible, donnees: { tube: tube.id, miniBoss: type } });
    }
    function programmerApparition(type, remplace) {
      var A = (C.miniBoss.siphon && C.miniBoss.siphon.apparition) || {};
      S.mb.apparition = { type: type, t: remplace ? 0 : Math.max(0, nombre(A.delai, 0.6)), essais: 0, remplace: remplace || null };
    }
    function pointApparitionMiniBoss(type) {        // devant la cuve, vers le centre : max(apparition.distance, rayon + ecartCuve) m (v1.5)
      var tube = tubeDe(type), A = (C.miniBoss.siphon && C.miniBoss.siphon.apparition) || {};
      if (!tube) return copie(CENTRE);
      var dd = Math.max(0, nombre(A.distance, 1.6), tube.r + d('ecartCuve'));
      var dx = CENTRE.x - tube.x, dz = CENTRE.z - tube.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
      return { x: tube.x + dx / l * dd, y: SOL, z: tube.z + dz / l * dd };
    }
    function majApparitionMiniBoss(dt) {
      var ap = S.mb.apparition;
      ap.t -= dt;
      if (ap.t > 1e-9) return;
      var P = C.miniBoss[ap.type] || {}, pos = pointApparitionMiniBoss(ap.type), m = ap.remplace;
      var pvMax = m ? m.pvMax : nombre(P.pv, 1) * echelleCoop(C.coop.pvParJoueurSupp);
      var profil = cloner(P);
      profil.pv = m ? Math.max(1, m.pv) : pvMax;       // remis devant sa cuve : PV restants
      profil.pvMax = pvMax;
      var id = appel('faireApparaitreZombie', { position: copie(pos), lieu: 'salle', effet: 'cuve', source: 'boss', type: ap.type, miniBoss: true,
        nom: P.nom, profil: profil });
      if (id == null) {
        ap.essais++;
        if (ap.essais <= d('essaisMiniBoss')) { ap.t = d('intervalleEssaiMiniBoss'); return; }
        S.mb.apparition = null;
        avertir('jeu.faireApparaitreZombie refuse le mini-boss « ' + ap.type + ' » : protection levée', null);
        if (m) { m.etat = 'perdu'; S.mb.liste = S.mb.liste.filter(function (x) { return x !== m; }); }
        finProtection(ap.type);
        return;
      }
      S.mb.apparition = null;
      if (m) {                                          // garde-fou : même mini-boss, nouvel identifiant, devant sa cuve
        m.id = id; m.cle = String(id); m.remise = false; m.position = copie(pos); m.lieu = 'salle';
        m.vu = S.trame; m.vuUneFois = false; m.ne = S.temps; m.ref = copie(pos); m.refT = S.temps;
        if (existe('journal')) appel('journal', 'info', 'BossB7 : mini-boss « ' + m.type + ' » bloqué, remis devant sa cuve (' + Math.round(m.pv) + ' PV)');
        if (m.rage) reprendreRage(m);                     // v1.5 : rage déjà déclenchée → le jeu reprend son état (bras arraché…)
        return;
      }
      m = { id: id, cle: String(id), type: ap.type, nom: P.nom, couleur: P.couleur, pv: pvMax, pvMax: pvMax, etat: 'actif',
        position: copie(pos), lieu: 'salle', vu: S.trame, vuUneFois: false, ne: S.temps, ref: copie(pos), refT: S.temps, mortT: null, remise: false };
      S.mb.liste.push(m);
      emettre('miniBoss', { etat: 'libere', id: id, type: m.type, nom: m.nom, position: copie(pos), lieu: 'salle', pvMax: pvMax });
      emettre('protection', { actif: true, miniBoss: m.type });
    }
    function finProtection(type) {
      if (!S.mb.protege) return;
      S.mb.protege = false; S.mb.type = null; S.mb.attente = null; S.mb.apparition = null;
      emettre('protection', { actif: false, miniBoss: type });
    }
    function garderMiniBoss(x) { return x.etat === 'actif' || (x.etat === 'mort' && S.temps - x.mortT < d('miniBossMortAffiche') - 1e-9); }
    function majMiniBoss(dt) {
      var M = S.mb, i, m;
      for (i = 0; i < M.liste.length; i++) {
        m = M.liste[i];
        if (m.etat !== 'actif' || m.remise) continue;
        if (m.vu !== S.trame) {
          if (!m.vuUneFois) {                             // jamais listé : impossible de suivre sa mort, le combat ne doit pas bloquer
            if (S.temps - m.ne < d('miniBossInvisible')) continue;
            avertir('jeu.zombies() ne liste pas le mini-boss « ' + m.type + ' » : protection levée', 'miniboss-invisible');
            m.etat = 'perdu';
            if (M.type === m.type) finProtection(m.type);
            continue;
          }
          m.etat = 'mort'; m.pv = 0; m.mortT = S.temps;
          emettre('miniBoss', { etat: 'mort', id: m.id, type: m.type, nom: m.nom, position: copie(m.position), lieu: m.lieu });
          finRages(m, false);                             // v1.5 : murs, infection, bras et petits Démembrés
          poserBonusMort(m);                              // v1.5 : Munitions max là où il tombe
          if (M.type === m.type) finProtection(m.type);
          continue;
        }
        if (dist2(m.position, m.ref) >= 0.5) { m.ref.x = m.position.x; m.ref.y = m.position.y; m.ref.z = m.position.z; m.refT = S.temps; }
        else if (S.temps - m.refT >= d('miniBossBloque')) {
          var proche = plusProcheValide(m.lieu, m.position);
          if (proche && dist2(proche.position, m.position) <= d('miniBossDistanceBloque')) m.refT = S.temps;
          else {
            appel('retirerZombie', m.id, { effet: 'silencieux', points: false });
            m.remise = true;
            programmerApparition(m.type, m);
          }
        }
      }
      for (i = 0; i < M.liste.length; i++) if (!garderMiniBoss(M.liste[i])) { M.liste = M.liste.filter(garderMiniBoss); break; }   // sans allocation à chaque pas
      if (S.etat !== 'phase2') return;
      verifierSeuilsMiniBoss();
      if (M.attente) majAttenteSiphon(dt);
      if (M.apparition) majApparitionMiniBoss(dt);
    }
    // allerA, echec, nouveau combat : mini-boss vivants retirés en silence, seuils et protection remis à zéro
    function reinitialiserMiniBoss(etatTubes) {
      var etaitProtege = S.mb && S.mb.protege, type = S.mb && S.mb.type;
      if (S.mb) S.mb.liste.forEach(function (x) { if (x.etat === 'actif' && !x.remise) appel('retirerZombie', x.id, { effet: 'silencieux', points: false }); });
      finRages(null, true);                               // v1.5 : murs, infection, bras et petits arrêtés sans suite
      S.mb = nouveauxMiniBoss();
      if (etaitProtege) emettre('protection', { actif: false, miniBoss: type });
      if (etatTubes) remettreTubes(etatTubes);
    }

    // ── Rages des mini-boss (v1.5, API.md §17.1) ──
    // Chaque mini-boss a au plus une rage (config.miniBoss.<type>.rage) : au 1er passage de ses PV (jeu.zombies(), pv / pvMax)
    // sous seuil × pvMax : évènement miniBoss { etat: 'rage' }, jeu.effetZombie(id, capacite, params) ; `duree` s d'animation
    // (invulnérable pour surcharge et arrachement), puis la capacité est active jusqu'à sa mort : murs électrifiés (surcharge),
    // zombies et chiens irradiés (infection), bras posé au centre d'où sort un flot de Démembrés (arrachement). Les petits
    // Démembrés ne sont pas des zombies pour la logique (hors de ZL : ni absorption, ni plafonds, ni cendres, ni contestation).
    function rageCfg(type) { var P = C.miniBoss && C.miniBoss[type]; return P && P.rage && P.rage.capacite ? P.rage : null; }
    function petitsCfg() { return (C.miniBoss && C.miniBoss.demembre && C.miniBoss.demembre.petits) || {}; }
    function verifierRages() {
      var l = S.mb.liste;
      for (var i = 0; i < l.length; i++) {
        var m = l[i], R = rageCfg(m.type);
        if (!R || m.etat !== 'actif' || m.remise || m.rage || !m.vuUneFois || !(m.pvMax > 0) || !(m.pv > 0)) continue;
        if (m.pv <= clamp(nombre(R.seuil, 0.5), 0, 1) * m.pvMax + 1e-9) declencherRage(m, R);
      }
    }
    function declencherRage(m, R) {
      var cap = String(R.capacite), duree = Math.max(0, nombre(R.duree, 0)), params = { duree: duree };
      m.rage = { capacite: cap, debut: S.temps, duree: duree, actif: false };
      m.invulnerableJusqua = cap === 'surcharge' || cap === 'arrachement' ? S.temps + duree : 0;
      emettre('miniBoss', { etat: 'rage', id: m.id, type: m.type, nom: m.nom, position: copie(m.position), capacite: cap });
      if (cap === 'surcharge') params.source = torse(boss.position);
      else if (cap === 'infection') { params.aura = cloner(R.aura || {}); params.couleur = m.couleur; }
      else if (cap === 'arrachement') { params.vol = clamp(nombre(R.vol, 1.2), 0, duree); params.cible = { x: CENTRE.x, y: SOL, z: CENTRE.z }; }
      appel('effetZombie', m.id, cap, params);
      if (cap === 'surcharge') {
        S.murs = { etat: 'charge', depuis: S.temps, distance: nombre((C.miniBoss.murs || {}).distance, 2.2), src: m, tickT: 0, chocs: {} };
        emettre('murs', { etat: 'charge' });
      } else if (cap === 'infection') {
        S.infection = { active: false, ids: [], src: m, aura: cloner(R.aura || {}), couleur: m.couleur };
      } else if (cap === 'arrachement') {
        S.bras = { etat: 'main', src: m, depuis: S.temps, lance: S.temps + duree - params.vol, pose: S.temps + duree, vol: params.vol,
          depart: null, cible: params.cible, position: copie(m.position) };
        S.petitsProchain = null;
        emettre('bras', { etat: 'arrache', position: copie(m.position) });
      }
    }
    // mini-boss remis devant sa cuve (nouvel identifiant) après sa rage : même capacité, `duree` = temps d'animation restant
    // (0 si elle est finie), `reprise: true` (le jeu ne rejoue pas le début : le Démembré est déjà sans bras, aucun 2e bras)
    function reprendreRage(m) {
      var R = rageCfg(m.type) || {}, cap = m.rage.capacite, params = { duree: Math.max(0, m.rage.debut + m.rage.duree - S.temps), reprise: true };
      if (cap === 'surcharge') params.source = torse(boss.position);
      else if (cap === 'infection') { params.aura = cloner(R.aura || {}); params.couleur = m.couleur; }
      else if (cap === 'arrachement') { params.vol = Math.min(params.duree, clamp(nombre(R.vol, 1.2), 0, m.rage.duree)); params.cible = { x: CENTRE.x, y: SOL, z: CENTRE.z }; }
      appel('effetZombie', m.id, cap, params);
    }
    function majRages(dt) {
      verifierRages();
      var l = S.mb.liste;
      for (var i = 0; i < l.length; i++) {
        var m = l[i];
        if (!m.rage || m.rage.actif || m.etat !== 'actif' || S.temps - m.rage.debut < m.rage.duree - 1e-9) continue;
        m.rage.actif = true;                              // fin de l'animation : capacité active
        if (S.murs && S.murs.src === m && S.murs.etat === 'charge') { S.murs.etat = 'electrifies'; S.murs.depuis = S.temps; S.murs.tickT = 0; emettre('murs', { etat: 'electrifies' }); }
        if (S.infection && S.infection.src === m && !S.infection.active) {
          S.infection.active = true;
          infecterNouveaux();
          emettre('infection', { etat: 'debut', nombre: S.infection.ids.length });
        }
      }
      majMurs(dt);
      majInfection();
      majBras();
      majPetits();
    }
    // murs électrifiés : distance au plan du mur le plus proche (apothème le long de sa normale)
    function murLePlusProche(p) {
      var best = null, bd = 1e18;
      for (var i = 0; i < MURS.length; i++) { var dd = APO - ((p.x - O.x) * MURS[i].x + (p.z - O.z) * MURS[i].z); if (dd < bd) { bd = dd; best = MURS[i]; } }
      return { id: best ? best.id : null, distance: bd };
    }
    function majMurs(dt) {
      var M = S.murs, MU = (C.miniBoss && C.miniBoss.murs) || {};
      if (!M) return;
      if (M.etat === 'extinction') { if (S.temps - M.depuis >= nombre(MU.extinction, 1.0) - 1e-9) { S.murs = null; emettre('murs', { etat: 'eteints' }); } return; }
      if (M.etat !== 'electrifies') return;
      var tick = Math.max(1e-3, nombre(MU.tick, 0.25)), f = nombre(MU.degatsParSeconde, 0.12) * tick;
      M.tickT += dt;
      while (M.tickT >= tick - 1e-9) {
        M.tickT -= tick;
        joueursValides('salle').forEach(function (p) {
          var w = murLePlusProche(p.position);
          if (w.distance >= M.distance - 1e-9 || !blesser(p.id, f, 'murs')) return;
          var der = M.chocs[p.id];
          if (der == null || S.temps - der >= d('intervalleChocMurs') - 1e-9) { M.chocs[p.id] = S.temps; emettre('mursChoc', { joueur: p.id, position: copie(p.position), mur: w.id }); }
        });
      }
    }
    // infection : chaque entité non mini-boss listée dans la salle (zombies, chiens, petits Démembrés), nouvelles comprises
    function infecterNouveaux() {
      var I = S.infection, vus = {};
      I.ids.forEach(function (x) { vus[String(x.id)] = true; });
      S.entites.forEach(function (e) {
        if (vus[String(e.id)]) return;
        I.ids.push({ id: e.id });
        appel('effetZombie', e.id, 'irradie', { actif: true, aura: cloner(I.aura), couleur: I.couleur });
      });
    }
    function majInfection() {
      var I = S.infection;
      if (!I || !I.active) return;
      var presents = {};
      S.entites.forEach(function (e) { presents[String(e.id)] = true; });
      I.ids = I.ids.filter(function (x) { return presents[String(x.id)]; });   // morts ou retirées : plus suivies
      infecterNouveaux();
    }
    // bras du Démembré : en main jusqu'au lancer (duree − vol), vol en cloche jusqu'à `duree`, posé au centre jusqu'à sa mort
    function majBras() {
      var B = S.bras;
      if (!B) return;
      if (B.etat === 'main' && S.temps >= B.lance - 1e-9) {
        var m = B.src;
        B.depart = { x: m.position.x, y: m.position.y + d('brasDepart'), z: m.position.z };
        B.etat = 'vol'; B.depuis = S.temps; B.position = copie(B.depart);
        emettre('bras', { etat: 'lance', position: copie(B.depart) });
      }
      if (B.etat === 'vol') {
        var u = B.vol > 1e-6 ? clamp((S.temps - B.depuis) / B.vol, 0, 1) : 1;
        B.position = { x: B.depart.x + (B.cible.x - B.depart.x) * u, y: B.depart.y + (B.cible.y - B.depart.y) * u + 4 * d('brasCloche') * u * (1 - u),
          z: B.depart.z + (B.cible.z - B.depart.z) * u };
        if (S.temps >= B.pose - 1e-9) {
          B.etat = 'pose'; B.depuis = S.temps; B.position = copie(B.cible);
          S.petitsProchain = S.temps + Math.max(0, nombre(petitsCfg().premier, 0.8));
          emettre('bras', { etat: 'pose', position: copie(B.cible) });
        }
      }
      if (B.etat === 'fletri' && S.temps - B.depuis >= d('brasFletriAffiche') - 1e-9) S.bras = null;
    }
    function pointPetit(centre, r) {
      for (var k = 0; k < 8; k++) {
        var a = rng() * Math.PI * 2, q = { x: centre.x + Math.sin(a) * r, y: SOL, z: centre.z + Math.cos(a) * r };
        contraindreSalle(q, APO - LIMITE_J + 0.3);
        horsPiliers(q, 0.5);
        if (!existe('positionValide') || appel('positionValide', copie(q), 'salle') !== false) return q;
      }
      return { x: centre.x, y: SOL, z: centre.z };
    }
    function majPetits() {
      if (S.petits.length) S.petits = S.petits.filter(function (x) { return x.vu === S.trame || (!x.vuUneFois && S.temps - x.ne < d('petitInvisible')); });
      var B = S.bras;
      if (!B || B.etat !== 'pose' || S.petitsProchain == null || S.temps < S.petitsProchain - 1e-9) return;
      var Pt = petitsCfg(), iv = Math.max(0.1, nombre(Pt.intervalle, 2.5));
      S.petitsProchain = S.temps + iv;
      if (S.petits.length >= Math.max(0, Math.round(nombre(Pt.max, 6) + nombre(Pt.maxParJoueurSupp, 0) * (N - 1)))) return;
      var pos = pointPetit(B.position, Math.max(0, nombre(Pt.rayon, 1.6)));
      var id = appel('faireApparaitreZombie', { position: copie(pos), lieu: 'salle', effet: 'bras', source: 'boss', type: 'demembre_petit',
        profil: cloner(Pt.profil || {}), vitesse: 'sprint', agressif: true });
      if (id == null) return;
      S.petits.push({ id: id, cle: String(id), position: copie(pos), ne: S.temps, vu: -1, vuUneFois: false });
      emettre('petitDemembre', { etat: 'apparition', id: id, position: copie(pos) });
    }
    function petitSuivi(id) {
      var cle = String(id);
      for (var i = 0; i < S.petits.length; i++) if (S.petits[i].cle === cle) return S.petits[i];
      return null;
    }
    // fin des rages : mort de `m` (suite visible : extinction, fin, flétrissement, effondrement) ; m null + silencieux : tout
    // arrêter sans suite (allerA, echec, nouveau combat ; murs → « eteints », zombies dés-irradiés, petits retirés en silence)
    function finRages(m, silencieux) {
      if (S.murs && (!m || S.murs.src === m)) {
        if (silencieux) { S.murs = null; emettre('murs', { etat: 'eteints' }); }
        else if (S.murs.etat !== 'extinction') { S.murs.etat = 'extinction'; S.murs.depuis = S.temps; emettre('murs', { etat: 'extinction' }); }
      }
      if (S.infection && (!m || S.infection.src === m)) {
        var I = S.infection;
        S.infection = null;
        I.ids.forEach(function (x) { appel('effetZombie', x.id, 'irradie', { actif: false }); });
        if (I.active) emettre('infection', { etat: 'fin', nombre: I.ids.length });
      }
      if (S.bras && (!m || S.bras.src === m)) {
        var lp = S.petits;
        S.petits = []; S.petitsProchain = null;
        lp.forEach(function (x) {
          appel('retirerZombie', x.id, { effet: silencieux ? 'silencieux' : 'effondrement', points: false });
          if (!silencieux) emettre('petitDemembre', { etat: 'effondrement', id: x.id, position: copie(x.position) });
        });
        if (silencieux || S.bras.etat === 'main') S.bras = null;
        else {
          if (S.bras.etat === 'vol') S.bras.position = copie(S.bras.cible);
          S.bras.etat = 'fletri'; S.bras.depuis = S.temps;
          emettre('bras', { etat: 'fletri', position: copie(S.bras.position) });
        }
      }
    }
    // Munitions max à la mort d'un mini-boss (v1.5, §17.2), là où il tombe, même repli que bonusFinDePhase
    function poserBonusMort(m) {
      var B = C.miniBoss && C.miniBoss.bonusMort;
      if (!B || !B.actif) return;
      var pos = positionBonusSalle(m.position), depose = false;
      if (existe('faireApparaitreBonus')) {
        try { depose = jeuBrut.faireApparaitreBonus({ type: B.type, position: copie(pos), lieu: 'salle', duree: B.duree }) !== false; }
        catch (e) { depose = false; avertir('exception dans jeu.faireApparaitreBonus : ' + (e && e.message ? e.message : e), 'exception-faireApparaitreBonus'); }
      }
      if (!depose) {
        if (existe('activerBonus')) appel('activerBonus', B.type, {});
        else avertir('ni jeu.faireApparaitreBonus ni jeu.activerBonus : bonus de mort de mini-boss perdu', 'bonus-mort-absent');
      }
      emettre('bonus', { type: B.type, position: copie(pos), lieu: 'salle', mode: depose ? 'depose' : 'active', source: 'miniBoss', miniBoss: m.type });
    }

    // ─────────────────────────────────────── états ───────────────────────────────────────
    function aller(nouvel) {
      var ancien = S.etat;
      if (ETATS[ancien] && ETATS[ancien].sortir) ETATS[ancien].sortir();
      S.etat = nouvel;
      S.tempsEtat = 0;
      S.phaseDebut = S.temps;
      S.dureeMaxAverti = false;
      S.sousEtat = null;
      emettre('etat', { de: ancien, vers: nouvel });
      var ph = PHASE_ETAT[nouvel];
      if (ph && ph !== S.phaseAnnoncee) { S.phaseAnnoncee = ph; emettre('phase', { numero: ph }); }
      if (SEGMENT_ETAT[nouvel] != null && SEGMENT_ETAT[nouvel] !== S.segment) { S.segment = SEGMENT_ETAT[nouvel]; S.pv = S.segments[S.segment]; }
      if (ETATS[nouvel] && ETATS[nouvel].entrer) ETATS[nouvel].entrer();
    }
    function titrePhase(n) { emettre('titre', { texte: 'Phase ' + n, sousTexte: TITRES[n], duree: d('titrePhase') }); }
    function seuilAtteint(suivant) {
      var idx = S.segment;
      S.seuil = false;
      S.pv = 0;
      emettre('segment', { index: idx });
      aller(suivant);
    }
    function hauteurLocomotion() {
      switch (boss.locomotion) {
        case 'levitation': case 'ailes': return SOL + nombre(C.boss.hauteurLevitation, 1.25);
        case 'rage': return SOL + nombre(C.boss.hauteurRage, 0.7);
        case 'affaibli': case 'mort': return SOL;
        default: return null;
      }
    }
    function derive(dt) {
      if (!S.minuteries.derive || S.minuteries.derive <= 0 || !boss.dest) {
        var n = ANCRES.length;
        var i = n > 1 ? (boss.ancreIndex + 1 + Math.floor(rng() * (n - 1))) % n : 0;
        boss.ancreIndex = i;
        boss.dest = copie(ANCRES[i]);
        S.minuteries.derive = entre(C.boss.intervalleDerive);
      }
      deplacerVers(boss.dest, nombre(C.boss.vitesseDerive, 1.2), dt);
    }
    function cerveauInvocateur(P, dt, phase) {
      ['sort', 'trait', 'absorption'].forEach(function (k) { if (S.minuteries[k] != null) S.minuteries[k] -= dt; });
      S.minuteries.derive = (S.minuteries.derive || 0) - dt;
      if (boss.act) return;
      if (boss.ailes === 'deployees') { if ((S.minuteries.reessaiPique = (S.minuteries.reessaiPique || 0) - dt) <= 0) { S.minuteries.reessaiPique = 0.5; lancerPique(); } return; }
      derive(dt);
      var regard = regardAuto();
      if (regard) tournerVers(regard, 2.5, dt);
      if (phase === 2) {
        verifierAiles();
        if (boss.act) return;
        if (S.minuteries.absorption <= 0) {
          if (lancerAbsorption()) { S.minuteries.absorption = entre(C.phase2.absorption.intervalle); return; }
          S.minuteries.absorption = d('relanceAbsorption');      // aucun zombie à saisir : il guette les prochains
        }
      }
      if (phase === 1 && P.trait && P.trait.actif && S.minuteries.trait <= 0) {
        if (lancerTrait(P.trait)) { S.minuteries.trait = entre(P.trait.intervalle); return; }
        S.minuteries.trait = 1.0;
      }
      if (S.minuteries.sort <= 0) {
        if (lancerInvocation(P.invocation)) S.minuteries.sort = entre(P.invocation.intervalle);
        else S.minuteries.sort = 1.0;
      }
    }
    function cerveauRage(dt) {
      var P3 = C.phase3;
      S.minuteries.bloc = (S.minuteries.bloc || 0) - dt;
      S.minuteries.deplacement = (S.minuteries.deplacement || 0) - dt;
      // proximité (onde de choc)
      var colle = false;
      joueursValides('salle').forEach(function (j) {
        if (dist2(j.position, boss.position) <= P3.ondeChoc.distance) { S.proximite[j.id] = (S.proximite[j.id] || 0) + dt; if (S.proximite[j.id] >= P3.ondeChoc.delaiProximite) colle = true; }
        else S.proximite[j.id] = 0;
      });
      if (boss.act) return;
      var regard = regardAuto();
      if (regard) tournerVers(regard, 4, dt);
      if (P3.ondeChoc.actif && colle) { lancerOndeChoc(); return; }
      if (S.minuteries.bloc <= 0) {
        if (salveActive()) { if (lancerSalve()) { S.minuteries.bloc = entre(P3.salve.intervalle); return; } }
        else if (lancerArrachement()) { S.minuteries.bloc = entre(P3.arrachement.intervalle); return; }
        S.minuteries.bloc = 0.5;
      }
      if (S.minuteries.deplacement <= 0 || !boss.dest) {
        for (var essai = 0; essai < 10; essai++) {
          var ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 7;
          var p = { x: CENTRE.x + Math.sin(ang) * r, y: SOL, z: CENTRE.z + Math.cos(ang) * r };
          if (!dansPilier(p, nombre(C.boss.rayonCorps, 0.45) + 0.6)) { boss.dest = p; break; }
        }
        S.minuteries.deplacement = entre(P3.deplacement.intervalle);
      }
      if (boss.dest) deplacerVers(boss.dest, P3.deplacement.vitesse, dt);
    }
    function majCapture(dt) {
      var P4 = C.phase4, cap = S.capture, R = P4.rayon, h = nombre(P4.hysteresis, 0.3);
      var dedans = 0;
      J.forEach(function (j) {
        var it = S.interne[j.id];
        if (!valide(j, 'salle')) { it.dansCercle = false; return; }
        var dd = dist2(j.position, CERCLE);
        it.dansCercle = it.dansCercle ? dd <= R + h : dd <= R;
        if (it.dansCercle) dedans++;
      });
      var zDedans = zombiesDans('salle').filter(function (z) { return dist2(z.position, CERCLE) <= R; }).length;
      cap.joueursDedans = dedans;
      cap.zombiesDedans = zDedans;
      var etat;
      if (dedans > 0) {
        cap.tVide = 0;
        if (zDedans >= Math.max(1, P4.zombiesPourContester)) etat = 'conteste';
        else {
          etat = 'capture';
          var vitesse = 1 + nombre(P4.bonusParJoueurSupp, 0) * (dedans - 1);
          cap.progression = Math.min(1, cap.progression + dt * vitesse / P4.duree);
        }
      } else {
        cap.tVide += dt;
        if (cap.tVide < P4.delaiAbandon) etat = 'libre';
        else if (P4.regleAbandon === 'decroissance') {
          etat = cap.progression > 0 ? 'recul' : 'libre';
          cap.progression = Math.max(0, cap.progression - dt * nombre(P4.vitesseRecul, 1) / P4.duree);
        } else if (P4.regleAbandon === 'reinitialisation') {
          if (cap.progression > 0) { cap.progression = 0; emettre('capture', { etat: 'reinitialisation' }); }
          etat = 'libre';
        } else etat = 'libre';
      }
      if (etat !== cap.etat) { cap.etat = etat; emettre('capture', { etat: etat }); }
    }

    var ETATS = {
      inactif: {},

      introduction: {
        entrer: function () {
          cinematique('introduction', true);
          S.sousEtat = 'fondu';
          setVulnerable(false);
          boss.present = false; boss.visible = false;
          S.lieu = J.length && J[0].lieu ? J[0].lieu : 'bunker';
        },
        maj: function (dt) {
          var I = C.introduction;
          if (S.sousEtat === 'fondu' && S.tempsEtat >= I.fondu) {
            S.sousEtat = 'apparition';
            retirerTousSilencieux();
            teleporterTous(ARRIVEE, 'salle');
            S.lieu = 'salle';
            boss.lieu = 'salle';
            boss.position = { x: CENTRE.x, y: SOL + nombre(C.boss.hauteurLevitation, 1.25), z: CENTRE.z };
            boss.prec = copie(boss.position);
            boss.lacet = ARRIVEE.length ? lacetVers(boss.position, ARRIVEE[0]) : Math.PI;
            boss.present = true; boss.visible = true;
            boss.locomotion = 'levitation';
            var tete = { x: CENTRE.x, y: boss.position.y + 1.6, z: CENTRE.z };
            regarderTous(tete, I.apparition + I.presentation);
            action('apparition', [
              { nom: 'formation', duree: I.apparition },
              { nom: 'presentation', duree: I.presentation, entrer: function () {
                emettre('titre', { texte: C.general.nomAffiche, sousTexte: C.general.sousTitre, duree: I.presentation });
              } }
            ], { fin: function () { cinematique('introduction', false); aller('phase1'); } });
          }
        }
      },

      phase1: {
        entrer: function () {
          titrePhase(1);
          setVulnerable(true, 1);
          boss.multAction = 1;
          boss.locomotion = 'levitation';
          S.minuteries = { sort: 1.2, trait: entre(C.phase1.trait.intervalle), derive: 0 };
        },
        maj: function (dt) { verifierSecondeMoitie(); cerveauInvocateur(C.phase1, dt, 1); if (S.seuil) seuilAtteint('repit'); }
      },

      repit: {
        entrer: function () {
          if (!S.secondeMoitie && S.segmentsMax) declencherSecondeMoitie();   // fin de phase 1 : la meute est lâchée au plus tard ici
          poserBonus(1, positionBonusSalle(boss.position), 'salle');
          annulerAction();
          nettoyerAttaques();
          setVulnerable(false);
          couperApparitions();
          if (C.repit.tuerZombies) reduireEnCendres('salle');
          action('souffrance', [
            { nom: 'souffrance', duree: d('souffrance1') },
            { nom: 'colere', duree: d('colere1') }
          ], { fin: function () { action('recharge', [{ nom: 'boucle', duree: null }], {}); } });
        },
        maj: function (dt) {
          versHauteur(SOL + nombre(C.boss.hauteurLevitation, 1.25), 1.5, dt);
          deplacerVers(CENTRE, 1.5, dt);
          if (S.tempsEtat >= C.repit.duree - 1e-9) aller('phase2');
        }
      },

      phase2: {
        entrer: function () {
          titrePhase(2);
          annulerAction();
          setVulnerable(true, 1);
          boss.multAction = 1;
          boss.locomotion = 'levitation';
          boss.ames = 0;
          S.minuteries = { sort: 1.0, absorption: entre(C.phase2.absorption.intervalle), derive: 0 };
        },
        // v1.3 : majMiniBoss (avant les actions) gère seuils, siphon et mini-boss ; pendant l'action `siphon`, le cerveau ne
        // fait que décompter ses minuteries ; ensuite le boss reprend toutes ses attaques, protégé ou non (choix d'Anthony)
        maj: function (dt) { cerveauInvocateur(C.phase2, dt, 2); if (S.seuil && !S.mb.protege) seuilAtteint('transition23'); }
      },

      transition23: {
        entrer: function () {
          if (S.mb.liste.some(function (x) { return x.etat === 'actif'; }) || S.mb.protege) { avertir('mini-boss encore présent à la fin de la phase 2 : retiré', null); reinitialiserMiniBoss(null); S.mb.prochain = ((C.miniBoss && C.miniBoss.ordre) || []).length; }
          poserBonus(2, positionBonusSalle(boss.position), 'salle');
          annulerAction();
          nettoyerAttaques();
          setVulnerable(false);
          boss.multAction = 1;
          if (boss.ailes !== 'absentes') { setAiles('dissipation'); setAiles('absentes'); }
          boss.ames = 0;
          boss.locomotion = 'levitation';
          action('effondrement', [{ nom: 'souffrance', duree: C.transition23.souffrance }],
            { fin: function () { teleportDepart(function () { aller('absence'); }, false, 'phase'); } });
        }
      },

      absence: {
        entrer: function () {
          titrePhase(3);
          annulerAction();
          boss.present = false; boss.visible = false;
          boss.locomotion = 'aucune';
          setVulnerable(false);
          activerApparitions(C.absence.apparitions, 'salle');
        },
        maj: function () { if (S.tempsEtat >= C.absence.duree - 1e-9) aller('retour'); }
      },

      retour: {
        entrer: function () {
          var R = C.retourRage;
          couperApparitions();
          boss.lieu = 'salle';
          boss.locomotion = 'rage';
          var haut = { x: CENTRE.x, y: SOL + 6, z: CENTRE.z };
          boss.position = copie(haut);
          boss.prec = copie(haut);
          boss.present = true; boss.visible = true;
          setVulnerable(false);
          emettre('teleport', { sens: 'arrivee', position: copie(haut), lieu: 'salle', raison: 'phase' });
          var p = plusProcheValide('salle', boss.position);
          if (p) boss.lacet = lacetVers(boss.position, p.position);
          action('retour_rage', [
            { nom: 'descente', duree: R.descente, maj: function (a) { boss.position.y = SOL + 6 + (nombre(C.boss.hauteurRage, 0.7) - 6) * lisse(a.t / Math.max(1e-6, a.duree)); } },
            { nom: 'deflagration', duree: R.deflagration, entrer: function () { reduireEnCendres('salle'); } },
            { nom: 'rugissement', duree: R.rugissement }
          ], { fin: function () { aller('phase3'); } });
        }
      },

      phase3: {
        entrer: function () {
          setVulnerable(true, nombre(C.phase3.resistance, 0.6));
          boss.multAction = 1;
          boss.locomotion = 'rage';
          boss.dest = null;
          S.proximite = {};
          S.minuteries = { bloc: 1.5, deplacement: 0 };
          S.apparitions3 = false;
        },
        maj: function (dt) {
          // v1.1 : le retour en rage a réduit les zombies en cendres ; ils reviennent phase3.apparitions.delai s plus tard
          var A3 = C.phase3.apparitions;
          if (!C.phase3.apparitionsSuspendues && !S.apparitions3 && S.tempsEtat >= nombre(A3 && A3.delai, 0) - 1e-9) {
            S.apparitions3 = true;
            activerApparitions(A3 || C.absence.apparitions, 'salle');
          }
          cerveauRage(dt);
          if (S.seuil) seuilAtteint('transition34');
        }
      },

      transition34: {
        entrer: function () {
          poserBonus(3, positionBonusSalle(boss.position), 'salle');
          annulerAction();
          nettoyerAttaques();
          S.blocs.slice().forEach(lacherBloc);
          setVulnerable(false);
          couperApparitions();
          action('effondrement', [{ nom: 'souffrance', duree: C.transition34.souffrance }],
            { fin: function () { teleportDepart(function () { aller('rituel'); }, false, 'phase'); } });
        }
      },

      rituel: {
        entrer: function () {
          titrePhase(4);
          annulerAction();
          boss.present = false; boss.visible = false;
          boss.locomotion = 'aucune';
          setVulnerable(false);
          J.forEach(function (j) { S.interne[j.id].dansCercle = false; });
          S.capture = { etat: 'formation', progression: 0, joueursDedans: 0, zombiesDedans: 0, regle: C.phase4.regleAbandon, tVide: 0 };
          emettre('rituel', { etat: 'formation' });
          emettre('capture', { etat: 'formation' });
          activerApparitions(C.phase4.apparitions, 'salle');
        },
        maj: function (dt) {
          if (S.tempsEtat < C.phase4.formation) return;
          if (S.sousEtat !== 'actif') { S.sousEtat = 'actif'; emettre('rituel', { etat: 'actif' }); }
          majCapture(dt);
          if (S.capture.progression >= 1 - 1e-9) aller('rituel_fin');
        }
      },

      rituel_fin: {
        entrer: function () {
          S.capture.progression = 1;
          S.capture.etat = 'termine';
          emettre('capture', { etat: 'termine' });
          emettre('rituel', { etat: 'fin' });
          couperApparitions();
        },
        maj: function () {
          var F = C.phase4.fin;
          if (S.sousEtat !== 'explose' && S.tempsEtat >= F * d('explosionRituel')) { S.sousEtat = 'explose'; reduireEnCendres('salle'); emettre('rituel', { etat: 'explosion' }); }
          if (S.tempsEtat >= F - 1e-9) aller('faiblesse');
        }
      },

      faiblesse: {
        entrer: function () {
          var Fb = C.phase4.faiblesse;
          S.capture = null;
          boss.lieu = 'salle';
          boss.position = { x: CENTRE.x, y: SOL, z: CENTRE.z };
          boss.prec = copie(boss.position);
          boss.present = true; boss.visible = true;
          boss.locomotion = 'affaibli';
          var p = plusProcheValide('salle', boss.position);
          if (p) boss.lacet = lacetVers(boss.position, p.position);
          emettre('teleport', { sens: 'arrivee', position: copie(boss.position), lieu: 'salle', raison: 'phase' });
          setVulnerable(true, nombre(Fb.multiplicateur, 1.25));
          boss.multAction = 1;
          action('faiblesse', [{ nom: 'chute', duree: d('chuteFaiblesse') }, { nom: 'boucle', duree: null }], {});
          // v1.4 (§16.4) : zombies pendant la faiblesse, réglage propre (phase4.faiblesse.apparitions, + coop) ; `true` = ceux du rituel
          if (Fb.apparitions) activerApparitions(Fb.apparitions === true ? C.phase4.apparitions : Fb.apparitions, 'salle');
        },
        maj: function () {
          var Fb = C.phase4.faiblesse;
          if (S.seuil) { seuilAtteint('transition45'); return; }
          if (Fb.dureeMax > 0 && S.tempsEtat >= Fb.dureeMax) {     // il reprend des forces : nouveau rituel
            S.segments[3] = S.segmentsMax[3];
            S.pv = S.segmentsMax[3];
            emettre('avertissement', { texte: 'faiblesse trop longue : le boss reprend des forces, nouveau rituel' });
            teleportDepart(function () { aller('rituel'); }, false, 'phase');
          }
        },
        sortir: function () { couperApparitions(); }
      },

      transition45: {
        entrer: function () {
          var R5 = C.phase5.rituel;
          annulerAction();
          nettoyerAttaques();
          couperApparitions();
          reduireEnCendres('salle');
          setVulnerable(false);
          cinematique('capture_ames', true);
          boss.locomotion = 'levitation';
          var total = R5.elevation + R5.incantation + R5.capture;
          regarderTous({ x: boss.position.x, y: SOL + 2.0 + 1.6, z: boss.position.z }, total);
          action('rituel_ames', [
            { nom: 'elevation', duree: R5.elevation, entrer: function (a) { a.donnees.y0 = boss.position.y; },
              maj: function (a) { boss.position.y = a.donnees.y0 + (SOL + 2.0 - a.donnees.y0) * lisse(a.t / Math.max(1e-6, a.duree)); } },
            { nom: 'incantation', duree: R5.incantation },
            { nom: 'capture', duree: R5.capture, maj: function (a) { S.vision = clamp(a.t / Math.max(1e-6, a.duree), 0, 1); } }
          ], { fin: function () {
            var pts = pointsBunker('arrivee');
            teleporterTous(pts.length ? pts : ARRIVEE, 'bunker');
            S.lieu = 'bunker';
            boss.present = false; boss.visible = false;
            boss.lieu = 'bunker';
            S.vision = 1;
            S.sousEtat = 'reveil';
            S.reveilT = 0;
          } });
        },
        maj: function (dt) {
          if (S.sousEtat !== 'reveil') return;
          S.reveilT += dt;
          var Ob = C.phase5.obscurite;
          S.vision = 1 + (Ob.intensite - 1) * clamp(S.reveilT / Math.max(1e-6, Ob.entree), 0, 1);
          if (S.reveilT >= d('reveil') - 1e-9) { cinematique('capture_ames', false); aller('phase5'); }
        }
      },

      phase5: {
        entrer: function () {
          titrePhase(5);
          S.lieu = 'bunker';
          if (S.meute && S.meute.active && S.meute.lieu !== 'bunker') transfererMeute();
          S.jauge = { valeur: 0, enBaisse: false, gelee: false, dernier: S.temps };
          S.disparition = null;
          S.retourContact = false;
          S.derniereFrappe = null;
          S.fenetreDegats = [];
          S.gelJaugeJusqua = 0;
          finIntangible(false); retirerCrochets();
          S.palier = paliersActifs() ? 0 : null; S.crochetDispo = null;   // v1.4 (§16.5) : palier 0, lames bleues
          if (S.palier != null) emettre('palier', { numero: 0, couleurLames: couleurPalier(0) });
          poserBonus(4, positionBonusReveil(), 'bunker');
          emettre('obscurite', { intensite: C.phase5.obscurite.intensite });
          activerApparitions(C.phase5.apparitions, 'bunker');
          boss.ailes = 'absentes';
          boss.traque = null;
          boss.locomotion = 'traque';
          var p = pointReapparition(nombre(C.phase5.disparition.distanceMin, 15));
          if (!p) { p = { x: CENTRE.x, y: SOL, z: CENTRE.z }; }
          boss.position = { x: p.x, y: p.y + C.phase5.traque.hauteur, z: p.z };
          boss.prec = copie(boss.position);
          boss.lieu = 'bunker';
          boss.present = true; boss.visible = true;
          setVulnerable(false);
          S.tDernierTp = S.temps;
          emettre('teleport', { sens: 'arrivee', position: copie(boss.position), lieu: 'bunker', raison: 'phase' });
          action('transformation_lames', [{ nom: 'formation', duree: C.phase5.lames.formation, entrer: function () { setLames('formation'); } }],
            { fin: function () { setLames('actives'); setVulnerable(true, 1); graceJauge(); }, annuler: function () { if (boss.lames === 'formation') setLames('actives'); } });
        },
        maj: function (dt) {
          var Ob = C.phase5.obscurite;
          if (S.vision > Ob.intensite) S.vision = Math.max(Ob.intensite, S.vision - dt / Math.max(0.1, Ob.entree));
          else S.vision = Ob.intensite;
          majJauge(dt);
          if (S.jauge.valeur >= 1 - 1e-9) { aller('defaite'); return; }
          majPalier();
          majCrochets(dt);
          if (S.disparition) { S.disparition.t += dt; if (S.disparition.t >= S.disparition.duree) reapparaitre5(); return; }
          if (boss.intangible) { majIntangible(dt); return; }    // v1.5 : ni téléportation sur dégâts, ni crochet, ni traque
          majLoinIntangible(dt);
          verifierTeleportDegats();
          if (boss.present && !boss.act) { if (crochetPret()) lancerCrochet(); else if (intangiblePret()) lancerEvanouissement(); else traque(dt); }
          if (boss.present && boss.lieu === 'bunker' && existe('positionValide') && appel('positionValide', copie(boss.position), 'bunker') === false) {
            S.horsCarteT = (S.horsCarteT || 0) + dt;
            if (S.horsCarteT > 1 && !boss.act) {
              S.horsCarteT = 0;
              var pv = pointsBossValides().sort(function (a, b) { return dist(a, boss.position) - dist(b, boss.position); })[0];
              if (pv) { emettre('avertissement', { texte: 'boss hors de la carte : replacé' }); boss.position = { x: pv.x, y: pv.y + C.phase5.traque.hauteur, z: pv.z }; boss.traque = null; }
            }
          } else S.horsCarteT = 0;
        },
        sortir: function () { couperApparitions(); }
      },

      defaite: {
        entrer: function () {
          var Df = C.defaite;
          dissoudreMeute('cendres', 'defaite');          // la meute meurt avec son maître
          finIntangible(true); retirerCrochets();          // v1.5 : de nouveau visible ; v1.4 : les crochets tombent
          annulerAction();
          nettoyerAttaques();
          couperApparitions();
          S.disparition = null;
          if (S.jauge) { S.jauge.valeur = 1; S.jauge.enBaisse = false; }
          setVulnerable(false);
          if (!boss.present) { boss.present = true; boss.visible = true; }
          reduireEnCendres(null);
          cinematique('defaite', true);
          regarderTous({ x: boss.position.x, y: boss.position.y + 1.4, z: boss.position.z }, Df.chancelle + Df.genoux + Df.chute + d('pauseMort'));
          emettre('defaite', {});
          boss.locomotion = 'traque';
          action('defaite', [
            { nom: 'chancelle', duree: Df.chancelle },
            { nom: 'genoux', duree: Df.genoux, entrer: function () { setLames('desintegration'); S.finLamesT = S.temps + nombre(Df.desintegrationLames, 2); } },
            { nom: 'chute', duree: Df.chute, entrer: function () { boss.locomotion = 'mort'; } },
            { nom: 'mort', duree: null }
          ], {});
        },
        maj: function () {
          var Df = C.defaite;
          if (boss.lames === 'desintegration' && S.temps >= S.finLamesT) setLames('absentes');
          if (S.tempsEtat >= Df.chancelle + Df.genoux + Df.chute + d('pauseMort') - 1e-9) aller('retour_salle');
        }
      },

      retour_salle: {
        entrer: function () {
          if (boss.lames !== 'absentes') setLames('absentes');
          teleporterTous(RETOUR_SALLE, 'salle');
          S.lieu = 'salle';
          boss.lieu = 'salle';
          boss.position = copie(CADAVRE);
          boss.prec = copie(CADAVRE);
          boss.lacet = LACET_CADAVRE;
          boss.locomotion = 'mort';
          boss.present = true; boss.visible = true;
          S.jauge = null;
          S.visionDepart = S.vision;
          poserBonus(5, positionBonusCadavre(), 'salle');
          regarderTous({ x: CADAVRE.x, y: SOL + 0.3, z: CADAVRE.z }, C.defaite.retourSalle);
          emettre('obscurite', { intensite: 0 });
        },
        maj: function () {
          S.vision = S.visionDepart * (1 - clamp(S.tempsEtat / Math.max(1e-6, C.defaite.retourSalle), 0, 1));
          if (S.tempsEtat >= C.defaite.retourSalle - 1e-9) { S.vision = 0; cinematique('defaite', false); aller('conclusion'); }
        }
      },

      conclusion: {
        entrer: function () {
          var I = C.conclusion.interaction;
          S.interaction = { position: copie(CADAVRE), rayon: I.rayon, progression: 0, joueur: null, texte: I.texte, derniere: -1e9 };
          emettre('interaction', { etat: 'disponible', joueur: null });
        },
        maj: function () {
          var I = C.conclusion.interaction, it = S.interaction;
          if (it.joueur != null) {
            var p = JI[it.joueur];
            if (S.temps - it.derniere > d('interactionPerimee') || !p || !p.vivant || dist2(p.position, it.position) > it.rayon) {
              it.joueur = null; it.progression = 0;
            }
          }
          if (I.autoValidation > 0 && S.tempsEtat >= I.autoValidation) {
            emettre('avertissement', { texte: 'interaction finale validée automatiquement après ' + I.autoValidation + ' s' });
            terminerInteraction(null);
          }
        }
      },

      recompenses: {
        entrer: function () {
          var R = C.conclusion.recompenses;
          appel('ecrireDrapeau', C.general.drapeauTermine, true);
          S.interaction = null;
          Object.keys(S.joueurs).sort(cmpId).forEach(function (id) {
            var it = S.interne[id];
            if (!it.participant) return;
            var p = JI[id];
            if (p && p.vivant) donnerRecompenses(id);
            else if (R.recompenserMorts === 'a-la-reapparition') it.enAttenteRecompense = true;
          });
          S.fileBonus = (R.bonus || []).slice();
          S.tBonus = 0;
        },
        maj: function (dt) {
          var R = C.conclusion.recompenses;
          S.tBonus -= dt;
          if (S.fileBonus.length && S.tBonus <= 0) {
            var b = S.fileBonus.shift();
            appel('activerBonus', b, { joueur: null });
            if (!existe('activerBonus')) avertir('jeu.activerBonus absent : les bonus de la victoire ne sont pas activés', 'bonus-absent');
            Object.keys(S.joueurs).sort(cmpId).forEach(function (id) {
              if (!S.interne[id].participant) return;
              var ent = { type: 'bonus', id: b, donne: existe('activerBonus'), repli: null };
              (S.recompenses[id] = S.recompenses[id] || []).push(ent);
              emettre('recompense', { joueur: id, type: 'bonus', id: b, donne: ent.donne, repli: null });
            });
            S.tBonus = R.delaiEntreBonus;
          }
          if (!S.fileBonus.length && S.tBonus <= 0) aller('message');
        }
      },

      message: {
        entrer: function () {
          var M = C.conclusion.message;
          S.message = { lignes: M.lignes.slice(), t: 0, duree: M.duree };
          emettre('message', { lignes: M.lignes.slice(), duree: M.duree });
        },
        maj: function () {
          var M = C.conclusion.message, rb = nombre(C.conclusion.retourBunker, 2);
          if (S.message) S.message.t = Math.min(S.tempsEtat, M.duree);
          if (S.tempsEtat >= M.duree && S.message) { S.message = null; cinematique('retour_bunker', true); }
          if (S.tempsEtat >= M.duree + rb / 2 && S.sousEtat !== 'teleporte') {
            S.sousEtat = 'teleporte';
            var pts = pointsBunker('retour');
            teleporterTous(pts.length ? pts : pointsBunker('arrivee'), 'bunker');
            S.lieu = 'bunker';
            S.vision = 0;
          }
          if (S.tempsEtat >= M.duree + rb - 1e-9) {
            cinematique('retour_bunker', false);
            appel('suspendreManches', false);
            aller('termine');
          }
        }
      },

      termine: {
        entrer: function () { setVulnerable(false); emettre('fin', {}); }
      },

      echec: {
        entrer: function () {
          annulerAction();
          nettoyerAttaques();
          couperApparitions();
          S.blocs.slice().forEach(lacherBloc);
          setVulnerable(false);
          if (S.cinematique) cinematique(S.nomCinematique || 'echec', false);
          dissoudreMeute('silencieux', 'echec');
          reinitialiserMiniBoss(null);                    // v1.3 : mini-boss retirés en silence (cuves inchangées) ; v1.5 : rages arrêtées
          finIntangible(true); retirerCrochets();          // v1.4, v1.5
          appel('suspendreManches', false);
          emettre('echec', { raison: J.length ? 'joueurs_morts' : 'aucun_joueur' });
        }
      }
    };

    function setLames(etat) { if (boss.lames !== etat) { boss.lames = etat; emettre('lames', { etat: etat }); } }
    // Jauge finale : elle baisse quand plus personne ne touche le boss depuis delaiAvantBaisse. Avec gelEnAbsence, elle
    // est figée pendant que le boss est absent (disparition après une frappe spéciale, téléportations) ET pendant son
    // retour : après une réapparition, le gel dure jusqu'à ce qu'un joueur le touche ou qu'il arrive à moins de
    // traque.distanceProche d'un joueur valide (sinon la marche d'approche, dans le noir, efface la jauge).
    function majJauge(dt) {
      var G = C.phase5.jauge, j = S.jauge;
      var absent = !boss.present || S.disparition || (boss.act && (boss.act.id === 'teleport_depart' || boss.act.id === 'teleport_arrivee'));
      if (S.retourContact && !absent) {
        var proche = plusProcheValide('bunker', boss.position);
        if (proche && dist(proche.position, boss.position) <= nombre(C.phase5.traque.distanceProche, 8)) { S.retourContact = false; graceJauge(); }
      }
      var gelPost = S.temps < (S.gelJaugeJusqua || 0);  // après une téléportation sur dégâts (v1.1)
      j.gelee = !!(((absent || S.retourContact) && G.gelEnAbsence) || gelPost || boss.intangible);   // v1.5 : intangible → gelée
      if (j.gelee) { j.enBaisse = false; return; }
      if (S.temps - j.dernier >= G.delaiAvantBaisse && j.valeur > 0) {
        j.valeur = Math.max(0, j.valeur - G.vitesseBaisse * dt);
        j.enBaisse = true;
      } else j.enBaisse = false;
    }
    function donnerRecompenses(id) {
      var it = S.interne[id], e = S.joueurs[id], R = C.conclusion.recompenses;
      if (e.recompense) return;
      e.recompense = true;
      it.enAttenteRecompense = false;
      var l = S.recompenses[id] = S.recompenses[id] || [];
      (R.armes || []).forEach(function (a) {
        var ok = appel('donnerArme', id, a.id, { pap: a.pap }) === true, repli = null;
        if (!ok) {
          repli = R.repliInventairePlein || 'autel';
          appel('deposerRecompense', { type: 'arme', id: a.id, pap: a.pap, position: copie(AUTEL), joueur: id });
          if (!existe('deposerRecompense')) avertir('jeu.deposerRecompense absent : une arme refusée par l’inventaire ne peut pas être déposée', 'depot-absent');
        }
        l.push({ type: 'arme', id: a.id, donne: ok, repli: repli });
        emettre('recompense', { joueur: id, type: 'arme', id: a.id, donne: ok, repli: repli });
      });
      var atouts = R.atouts === 'tous' ? (appel('listeAtouts') || []) : (R.atouts || []);
      atouts.forEach(function (at) {
        var ok = appel('donnerAtout', id, at) === true;
        l.push({ type: 'atout', id: at, donne: ok, repli: null });
        emettre('recompense', { joueur: id, type: 'atout', id: at, donne: ok, repli: null });
      });
    }
    function terminerInteraction(joueur) {
      if (S.etat !== 'conclusion') return;
      if (S.interaction) { S.interaction.progression = 1; S.interaction.joueur = joueur; }
      emettre('interaction', { etat: 'terminee', joueur: joueur });
      aller('recompenses');
    }

    // ─────────────────────────────────────── pas fixe ───────────────────────────────────────
    function pas(dt) {
      S.temps += dt;
      S.tempsEtat += dt;
      S.trame++;
      lireJoueurs();
      lireZombies();
      var actif = ETATS_COMBAT.indexOf(S.etat) >= 0;
      // nouveaux joueurs arrivés en cours de combat : participants
      if (actif) { J.forEach(function (j) { S.interne[j.id].participant = true; }); appliquerEtatsJoueurs(); if (S.coop) suivreEffectif(); }
      // fin de l'état critique, récompenses en attente
      J.forEach(function (j) {
        var e = S.joueurs[j.id];
        if (e.critique && (!j.vivant || j.pvFraction > d('finCritique'))) { e.critique = false; emettre('critique', { joueur: j.id, actif: false }); }
        if (S.interne[j.id].enAttenteRecompense && j.vivant && (S.etat === 'recompenses' || S.etat === 'message' || S.etat === 'termine')) donnerRecompenses(j.id);
      });
      if (S.etat === 'termine' || S.etat === 'echec' || S.etat === 'inactif') return;
      // échec : plus personne debout
      var debout = J.filter(function (p) { return p.vivant && !p.aTerre; }).length;
      if (debout === 0 && !S.cinematique) {
        S.tousATerreT += dt;
        if (S.tousATerreT >= d('graceEchec')) { aller('echec'); return; }
      } else S.tousATerreT = 0;
      majMiniBoss(dt);
      majRages(dt);                                       // v1.5 (§17.1)
      var etatAvant = S.etat;
      majAction(dt);
      if (S.etat === etatAvant) { var e = ETATS[S.etat]; if (e && e.maj) e.maj(dt); }
      // hauteur de locomotion (hors actions qui pilotent la hauteur)
      var y = hauteurLocomotion(), a = boss.act;
      var pilote = a && (a.id === 'pique' || a.id === 'retour_rage' || a.id === 'rituel_ames');
      if (y != null && boss.present && boss.lieu === 'salle' && !pilote) versHauteur(y, 2.5, dt);
      majProjectiles(dt);
      majZones(dt);
      majAmes(dt);
      majBlocs(dt);
      majEmergences(dt);
      majApparitions(dt);
      majMeute(dt);
      surveillerZombies(dt);
      contraindreBoss();
      // regard, affaiblissement, vitesse
      boss.regard = regardAuto();
      if (SEGMENT_ETAT[S.etat] != null && S.segmentsMax[S.segment] > 0) boss.affaiblissement = clamp(1 - S.pv / S.segmentsMax[S.segment], 0, 1);
      else if (S.jauge) boss.affaiblissement = clamp(S.jauge.valeur, 0, 1);
      boss.vitesse = echelle(soustraire(boss.position, boss.prec), 1 / dt);
      boss.prec = copie(boss.position);
      // garde-fous : seuil de PV non traité, phase trop longue
      if (SEGMENT_ETAT[S.etat] != null && S.pv <= 0 && ['phase1', 'phase2', 'phase3', 'faiblesse'].indexOf(S.etat) >= 0 && !S.mb.protege) {
        S.seuilT += dt;
        if (S.seuilT >= nombre(C.securite.transitionWatchdog, 1)) { S.seuilT = 0; avertir('transition forcée (PV à 0 sans transition)', null); S.seuil = true; }
      } else S.seuilT = 0;
      if (!S.dureeMaxAverti && S.tempsEtat > nombre(C.securite.dureeMaxPhase, 900)) { S.dureeMaxAverti = true; avertir('état « ' + S.etat + ' » anormalement long', null); }
    }

    // ─────────────────────────────────────── API ───────────────────────────────────────
    var accu = 0;
    var api = {
      version: VERSION,
      demarrer: function () {
        if (S.detruit || S.etat !== 'inactif') return false;
        if (appel('lireDrapeau', C.general.drapeauTermine) === true) { avertir('combat déjà terminé (drapeau « ' + C.general.drapeauTermine + ' »)', null); return false; }
        lireJoueurs();
        lireZombies();
        if (!J.length) { avertir('demarrer() sans joueur', null); return false; }
        preparer();
        appel('suspendreManches', true);
        aller('introduction');
        return true;
      },
      mettreAJour: function (dt) {
        if (S.detruit) return;
        dt = +dt;
        if (!isFinite(dt) || dt <= 0) return;
        var pasL = Math.max(1 / 240, nombre(C.general.pasLogique, 1 / 60));
        accu += Math.min(dt, Math.max(nombre(C.general.dtMax, 0.1), pasL) * 10);   // au plus 1 s rattrapée par appel
        var n = 0;
        while (accu >= pasL - 1e-12 && n < 600) { accu -= pasL; pas(pasL); n++; }
      },
      toucherBoss: function (o) {
        o = o || {};
        if (S.detruit || ETATS_COMBAT.indexOf(S.etat) < 0) return { applique: false, montant: 0, raison: 'absent' };
        if (!boss.present || !boss.visible) return { applique: false, montant: 0, raison: 'absent' };
        var pos = o.position ? copie(o.position) : null;
        if (!boss.vulnerable || S.mb.protege) {             // v1.3 : protégé tant qu'un mini-boss vit (§15.2)
          var cle = 'imm-' + o.joueur;
          if (C.boss.signalerImmunite && (!S.drapeaux[cle] || S.temps - S.drapeaux[cle] >= 0.15)) { S.drapeaux[cle] = S.temps; emettre('immunise', { joueur: o.joueur, position: pos }); }
          return { applique: false, montant: 0, raison: 'invulnerable' };
        }
        var brut = Math.max(0, nombre(o.degats, 0));
        var m = boss.multBase * boss.multAction * (o.zone === 'tete' ? nombre(C.boss.multiplicateurTete, 1.5) : 1);
        var montant = brut * m;
        if (S.etat === 'phase5' && S.jauge) {
          S.jauge.valeur = Math.min(1, S.jauge.valeur + montant / S.jaugeMax);
          S.jauge.dernier = S.temps;
          S.retourContact = false;
          S.gelJaugeJusqua = 0;
          S.fenetreDegats.push({ t: S.temps, m: montant, j: o.joueur });
          emettre('degats', { montant: montant, multiplicateur: m, joueur: o.joueur, position: pos, zone: o.zone || 'corps', restant: 1 - S.jauge.valeur });
          majPalier();                                    // v1.4 : palier acquis dès le coup qui franchit le seuil
          return { applique: true, montant: montant, raison: null };
        }
        if (SEGMENT_ETAT[S.etat] == null || S.pv <= 0) return { applique: false, montant: 0, raison: 'invulnerable' };
        var avantPv = S.pv;
        S.pv = bornerSeuilMiniBoss(Math.max(0, S.pv - montant));   // phase 2 : un seuil de mini-boss ne se saute pas
        emettre('degats', { montant: avantPv - S.pv, multiplicateur: m, joueur: o.joueur, position: pos, zone: o.zone || 'corps', restant: S.pv });
        if (S.pv <= 0) S.seuil = true;
        if (S.etat === 'phase1') verifierSecondeMoitie();
        return { applique: true, montant: avantPv - S.pv, raison: null };
      },
      toucherIllusion: function () { return { applique: false, raison: 'absent' }; },   // v1.5 (§17.3) : plus d'illusions
      interagir: function (joueurId, maintenu, dt) {
        if (S.detruit || S.etat !== 'conclusion' || !S.interaction) return false;
        var it = S.interaction, p = JI[joueurId];
        if (!p || !p.vivant || p.lieu !== 'salle' || dist2(p.position, it.position) > it.rayon) {
          if (it.joueur === joueurId) { it.joueur = null; it.progression = 0; }
          return false;
        }
        if (!maintenu) { if (it.joueur === joueurId) { it.joueur = null; it.progression = 0; } return false; }
        if (it.joueur != null && it.joueur !== joueurId && S.temps - it.derniere <= d('interactionPerimee')) return false;
        if (it.joueur !== joueurId) { it.joueur = joueurId; it.progression = 0; emettre('interaction', { etat: 'progression', joueur: joueurId }); }
        it.derniere = S.temps;
        it.progression = Math.min(1, it.progression + Math.max(0, nombre(dt, 0)) / Math.max(0.01, C.conclusion.interaction.duree));
        if (it.progression >= 1 - 1e-9) terminerInteraction(joueurId);
        return true;
      },
      etat: function () { return instantane(); },
      on: function (type, fn) {
        (ecouteurs[type] = ecouteurs[type] || []).push(fn);
        return function () { api.off(type, fn); };
      },
      off: function (type, fn) { var l = ecouteurs[type]; if (l) ecouteurs[type] = l.filter(function (x) { return x !== fn; }); },
      allerA: function (cible) { allerA(cible); },
      forcer: function (cle, valeur) { forcer(cle, valeur); },
      detruire: function () {
        if (S.detruit) return;
        var actif = ETATS_COMBAT.indexOf(S.etat) >= 0;
        annulerAction();
        nettoyerAttaques();
        couperApparitions();
        S.cinematique = false;
        J.forEach(function (j) { appel('controle', j.id, true); appel('invulnerable', j.id, false); });
        if (actif) appel('suspendreManches', false);
        S.detruit = true;
        ecouteurs = {};
      },
      get config() { return C; }
    };

    function preparer() {
      remettrePiliers();
      reinitialiserMiniBoss('intact');
      S.palier = null; S.intang = nouvelIntang(); boss.intangible = false; S.crochets = []; S.crochetDispo = null; S.salveTour = null;
      S.secondeMoitie = false;
      S.meute = null;
      S.bonusPoses = {};
      S.fenetreDegats = [];
      S.gelJaugeJusqua = 0;
      S.coop = { comptes: {}, vu: {}, absent: {} };
      J.forEach(function (p) { S.coop.comptes[p.id] = true; });
      N = Math.max(1, J.length);
      var k = echelleCoop(C.coop.pvParJoueurSupp);
      S.segmentsMax = [C.phase1.pv * k, C.phase2.pv * k, C.phase3.pv * k, C.phase4.faiblesse.pv * k];
      S.segments = S.segmentsMax.slice();
      S.segment = 0;
      S.pv = S.segments[0];
      S.jaugeMax = C.phase5.jauge.degatsRequis * echelleCoop(C.coop.jaugeParJoueurSupp);
      J.forEach(function (j) { S.interne[j.id].participant = true; });
    }

    function instantane() {
      var a = instantaneAction();
      var seg = SEGMENT_ETAT[S.etat];
      var segMax = S.segmentsMax || [0, 0, 0, 0];
      var cr = null;
      if (S.etat === 'repit') cr = Math.max(0, C.repit.duree - S.tempsEtat);
      else if (S.etat === 'absence') cr = Math.max(0, C.absence.duree - S.tempsEtat);
      else if (S.etat === 'phase5' && S.disparition) cr = null;
      var joueurs = {};
      Object.keys(S.joueurs).forEach(function (id) {
        var e = S.joueurs[id];
        joueurs[id] = { critique: e.critique, invulnerableJusqua: e.invulnerableJusqua, immuniteFrappeJusqua: e.immuniteFrappeJusqua, recompense: e.recompense };
      });
      var besoin = Math.max(1, nombre(C.phase2.amesPourAiles, 10));
      return {
        etat: S.etat,
        phase: PHASE_ETAT[S.etat] || 0,
        tempsEtat: S.tempsEtat,
        compteARebours: cr,
        controleJoueurs: !S.cinematique,
        lieu: S.lieu,
        boss: {
          present: boss.present, visible: boss.visible, lieu: boss.lieu,
          position: copie(boss.position), lacet: boss.lacet, vitesse: copie(boss.vitesse),
          locomotion: boss.present ? boss.locomotion : 'aucune',
          action: a,
          vulnerable: boss.vulnerable && boss.present && !S.mb.protege, multiplicateur: boss.multBase * boss.multAction,
          protege: !!S.mb.protege,                        // v1.3 : un mini-boss vit (ou va être libéré) : invulnérable
          palier: S.etat === 'phase5' || S.etat === 'defaite' ? S.palier : null,             // v1.4 (§16.5)
          couleurLames: S.etat === 'phase5' || S.etat === 'defaite' ? couleurPalier(S.palier) : null,
          intangible: !!boss.intangible,                  // v1.5 (§17.3) : invisible, traverse les murs
          puissance: boss.ailes === 'deployees' || boss.ailes === 'apparition' ? 1 : S.etat === 'phase2' || S.etat === 'transition23' ? clamp(boss.ames / besoin, 0, 1) : 0,
          ames: boss.ames, ailes: boss.ailes, lames: boss.lames,
          affaiblissement: boss.affaiblissement, regard: copie(boss.regard)
        },
        barre: {
          visible: seg != null && S.etat !== 'introduction' && S.etat !== 'inactif',
          segments: segMax.slice(), segment: seg != null ? seg : -1,
          valeur: seg != null ? S.pv : 0, max: seg != null ? segMax[seg] : 0, titre: C.general.nomAffiche
        },
        capture: S.capture ? { etat: S.capture.etat, progression: S.capture.progression, joueursDedans: S.capture.joueursDedans,
          zombiesDedans: S.capture.zombiesDedans, regle: S.capture.regle } : null,
        jauge: S.jauge ? { valeur: S.jauge.valeur, enBaisse: S.jauge.enBaisse, gelee: S.jauge.gelee } : null,
        vision: S.vision,
        secondeMoitie: !!S.secondeMoitie,
        meute: S.meute ? {
          active: S.meute.active, max: S.meute.max,
          chiens: S.meute.ordre.map(function (k) { var c = S.meute.chiens[k]; return { id: c.id, position: copie(c.position), lieu: c.lieu }; }),
          failles: S.meute.failles.map(function (f) { return { id: f.id, position: copie(f.position), lieu: f.lieu, t: f.t, duree: f.duree }; })
        } : null,
        piliers: PILIERS.map(function (pl) {
          var st = S.piliers[pl.i];
          return { id: pl.id, etat: st.etat, coups: st.coups, t: S.temps - st.depuis };
        }),
        tubes: TUBES.map(function (tb) {                  // v1.3 (§15.1)
          var st = S.tubes[tb.i];
          return { id: tb.id, etat: st.etat, miniBoss: tb.miniBoss, t: S.temps - st.depuis };
        }),
        illusions: [],                                    // v1.5 (§17.3) : les illusions sont retirées (toujours vide)
        crochets: (S.crochets || []).map(function (c) {
          return { id: c.id, joueur: c.joueur, depart: copie(c.depart), position: copie(c.position), etat: c.etat };
        }),
        miniBoss: S.mb.liste.filter(function (m) { return m.etat === 'actif' || m.etat === 'mort'; }).map(function (m) {   // v1.3 (§15.2)
          return { id: m.id, type: m.type, nom: m.nom, couleur: m.couleur, pv: m.etat === 'mort' ? 0 : m.pv, pvMax: m.pvMax, etat: m.etat,
            position: copie(m.position), lieu: m.lieu,
            rage: m.rage ? { capacite: m.rage.capacite, actif: !!m.rage.actif, t: S.temps - m.rage.debut } : null,   // v1.5 (§17.1)
            invulnerable: m.etat === 'actif' && S.temps < (m.invulnerableJusqua || 0) };
        }),
        murs: S.murs ? { etat: S.murs.etat, t: S.temps - S.murs.depuis, distance: S.murs.distance } : null,   // v1.5 (§17.1)
        infection: S.infection ? { active: !!S.infection.active, ids: S.infection.ids.map(function (x) { return x.id; }) } : null,
        bras: S.bras && S.bras.etat !== 'main' ? { etat: S.bras.etat, position: copie(S.bras.position), t: S.temps - S.bras.depuis } : null,   // en main : null
        petits: S.petits.map(function (x) { return x.id; }),
        blocs: S.blocs.map(function (b) {
          return { id: b.id, etat: b.etat, position: copie(b.position), rotation: { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z },
            t: b.t, cibleJoueur: b.cibleJoueur, pointImpact: copie(b.pointImpact) };
        }),
        projectiles: S.projectiles.map(function (p) { return { id: p.id, type: p.type, position: copie(p.position), vitesse: copie(p.vitesse), cible: copie(p.cible) }; }),
        zones: S.zones.map(function (z) { return { id: z.id, position: copie(z.position), rayon: z.rayon, etat: z.etat, t: z.t, duree: z.duree }; }),
        ames: S.ames.map(function (s) { return { id: s.id, zombieId: s.zombieId, depart: copie(s.depart), t: s.t, duree: s.duree }; }),
        pique: S.pique ? { depart: copie(S.pique.depart), arrivee: copie(S.pique.arrivee), etape: S.pique.etape, cibleJoueur: S.pique.cibleJoueur } : null,
        joueurs: joueurs,
        interaction: S.interaction ? { position: copie(S.interaction.position), rayon: S.interaction.rayon, progression: S.interaction.progression,
          joueur: S.interaction.joueur, texte: S.interaction.texte } : null,
        message: S.message ? { lignes: S.message.lignes.slice(), t: S.message.t, duree: S.message.duree } : null,
        recompenses: cloner(S.recompenses),
        temps: S.temps
      };
    }

    // ─────────────────────────────────────── debug ───────────────────────────────────────
    function allerA(cible) {
      if (!ETATS[cible]) throw new Error('BossB7Logique.allerA : état inconnu « ' + cible + ' »');
      lireJoueurs();
      lireZombies();
      if (cible === 'inactif') {
        var etaitActif = ETATS_COMBAT.indexOf(S.etat) >= 0;
        dissoudreMeute('silencieux', 'debogage');
        reinitialiserMiniBoss(null);
        finIntangible(true); retirerCrochets();
        annulerAction(); nettoyerAttaques(); couperApparitions();
        J.forEach(function (j) { appel('controle', j.id, true); appel('invulnerable', j.id, false); });
        if (etaitActif) appel('suspendreManches', false);
        var ec = ecouteurs;
        reinitialiser();
        ecouteurs = ec;
        emettre('etat', { de: null, vers: 'inactif' });
        return;
      }
      if (!S.segmentsMax || S.etat === 'inactif') { preparer(); appel('suspendreManches', true); }
      // meute (§14.3) : de `repit` à `phase5`, lâchée aussitôt dans le bon lieu (phase 5 : après delaiBunker) ;
      // avant (introduction, phase1 : jusqu'au seuil) et à partir de `defaite` : inactive
      dissoudreMeute('silencieux', 'debogage');
      S.meute = null;
      var iCible = ETATS_COMBAT.indexOf(cible), meuteVoulue = iCible >= ETATS_COMBAT.indexOf('repit') && iCible <= ETATS_COMBAT.indexOf('phase5');
      if (iCible >= 0 && iCible <= ETATS_COMBAT.indexOf('phase1')) S.secondeMoitie = false;
      else if (meuteVoulue) S.secondeMoitie = true;
      // cuves et mini-boss (§15.2) : jusqu'à `phase2` → cuves intactes, seuils remis à zéro ; après → cuves éclatées ;
      // jamais de mini-boss ni de protection
      finIntangible(true); retirerCrochets();              // v1.4/v1.5 : ni intangibilité ni crochet ; palier remis (phase 5 : 0, défaite : acquis)
      S.palier = cible === 'defaite' && paliersActifs() ? C.phase5.paliers.seuils.length : null; S.crochetDispo = null;
      var apresPhase2 = iCible < 0 || iCible > ETATS_COMBAT.indexOf('phase2');
      reinitialiserMiniBoss(apresPhase2 && miniBossActif() ? 'eclate' : 'intact');
      if (apresPhase2) S.mb.prochain = ((C.miniBoss && C.miniBoss.ordre) || []).length;
      annulerAction();
      nettoyerAttaques();
      couperApparitions();
      S.blocs.forEach(function (b) { emettre('bloc', { id: b.id, etat: 'reconstruit', position: copie(b.position) }); });
      S.blocs = [];
      S.capture = null; S.jauge = null; S.message = null; S.interaction = null; S.disparition = null;
      S.seuil = false; S.proximite = {}; S.minuteries = {};
      S.fenetreDegats = []; S.gelJaugeJusqua = 0; S.retourContact = false;
      if (ETATS_COMBAT.indexOf(cible) < ETATS_COMBAT.indexOf('phase3')) remettrePiliers();   // piliers neufs avant la phase 3
      retirerTousSilencieux();
      if (S.cinematique) cinematique(S.nomCinematique, false);
      // lieu et joueurs
      var lieu = LIEU_ETAT[cible] === undefined ? 'salle' : LIEU_ETAT[cible];
      if (cible === 'introduction') lieu = null;
      if (lieu) {
        var pasAuBonEndroit = J.some(function (j) { return j.lieu !== lieu; });
        if (pasAuBonEndroit || cible === 'retour_salle' || cible === 'conclusion') {
          if (lieu === 'salle') teleporterTous(cible === 'conclusion' || cible === 'recompenses' || cible === 'message' ? RETOUR_SALLE : ARRIVEE, 'salle');
          else { var pts = pointsBunker('arrivee'); teleporterTous(pts.length ? pts : ARRIVEE, 'bunker'); }
        }
        S.lieu = lieu;
      }
      // PV : segments précédents vides, segment de l'état plein
      var seg = SEGMENT_ETAT[cible];
      S.segments = S.segmentsMax.slice();
      if (seg != null) { for (var i = 0; i < seg; i++) S.segments[i] = 0; S.segment = seg; S.pv = cible === 'repit' ? 0 : S.segments[seg]; if (cible === 'repit') S.segments[0] = 0; }
      // boss
      boss.ames = 0; boss.multAction = 1; boss.traque = null; boss.dest = null;
      if (boss.ailes !== 'absentes') setAiles('absentes');
      setLames(cible === 'defaite' ? 'actives' : 'absentes');
      boss.lieu = lieu || 'salle';
      boss.present = ['absence', 'rituel', 'rituel_fin', 'inactif', 'introduction'].indexOf(cible) < 0;
      boss.visible = boss.present;
      boss.locomotion = { phase3: 'rage', retour: 'rage', faiblesse: 'affaibli', phase5: 'traque', defaite: 'traque', retour_salle: 'mort', conclusion: 'mort',
        recompenses: 'mort', message: 'mort', termine: 'mort' }[cible] || 'levitation';
      if (boss.lieu === 'salle') {
        var y = boss.locomotion === 'mort' || boss.locomotion === 'affaibli' ? SOL : boss.locomotion === 'rage' ? SOL + nombre(C.boss.hauteurRage, 0.7) : SOL + nombre(C.boss.hauteurLevitation, 1.25);
        boss.position = boss.locomotion === 'mort' ? copie(CADAVRE) : { x: CENTRE.x, y: y, z: CENTRE.z };
      } else {
        var pb = pointsBossValides()[0];
        boss.position = pb ? { x: pb.x, y: pb.y + C.phase5.traque.hauteur, z: pb.z } : { x: CENTRE.x, y: SOL, z: CENTRE.z };
      }
      boss.prec = copie(boss.position);
      S.vision = cible === 'phase5' || cible === 'defaite' ? C.phase5.obscurite.intensite : 0;
      if (cible === 'rituel_fin') S.capture = { etat: 'termine', progression: 1, joueursDedans: 0, zombiesDedans: 0, regle: C.phase4.regleAbandon, tVide: 0 };
      if (cible === 'defaite') S.jauge = { valeur: 1, enBaisse: false, gelee: false, dernier: S.temps };
      var ancien = S.etat;
      S.etat = cible;
      S.tempsEtat = 0;
      S.sousEtat = null;
      S.phaseAnnoncee = PHASE_ETAT[cible];
      emettre('etat', { de: ancien, vers: cible });
      if (PHASE_ETAT[cible]) emettre('phase', { numero: PHASE_ETAT[cible] });
      if (ETATS[cible].entrer) ETATS[cible].entrer();
      if (cible === 'phase5') { boss.act = null; setLames('actives'); setVulnerable(true, 1); }
      if (meuteVoulue) lacherMeute(cible === 'phase5' ? 'bunker' : 'salle', cible === 'phase5' ? nombre(C.chiens && C.chiens.delaiBunker, 4) : 0);
    }
    function forcer(cle, valeur) {
      switch (cle) {
        case 'ames': boss.ames = Math.max(0, Math.floor(+valeur || 0)); verifierAiles(); break;
        case 'pvSegment': S.pv = Math.max(0, +valeur || 0); break;
        case 'jauge': if (S.jauge) S.jauge.valeur = clamp(+valeur || 0, 0, 1); break;
        case 'capture': if (S.capture) S.capture.progression = clamp(+valeur || 0, 0, 1); break;
        case 'position': if (valeur) { boss.position = copie(valeur); } break;
        case 'pilier': {                                 // forcer('pilier', { id, coups }) : état d'un pilier (débogage)
          var pf = PILIERS.filter(function (q) { return q.id === (valeur && valeur.id); })[0];
          if (!pf) throw new Error('BossB7Logique.forcer : pilier inconnu « ' + (valeur && valeur.id) + ' »');
          var sf = S.piliers[pf.i], nCoups = Math.max(0, Math.floor(+valeur.coups || 0));
          sf.coups = nCoups; sf.depuis = S.temps;
          sf.etat = nCoups >= Math.max(1, nombre((C.phase3.piliers || {}).coupsDestruction, 3)) ? 'detruit' : nCoups > 0 ? 'endommage' : 'intact';
          break;
        }
        default: throw new Error('BossB7Logique.forcer : clé inconnue « ' + cle + ' »');
      }
    }

    return api;
  }

  var BossB7Logique = { version: VERSION, creerCombat: creerCombat, DEFAUTS: DEFAUTS, TITRES: TITRES };
  if (typeof module === 'object' && module && module.exports) module.exports = BossB7Logique;
  if (root) root.BossB7Logique = BossB7Logique;
})(typeof globalThis !== 'undefined' ? globalThis : this);
