/*!
 * proto-zombies.js — Zombies du prototype : modèle procédural « fantassin mort-vivant » (maillage skinné, uniforme
 * déchiré, peau grise abîmée, plaies, yeux orange), 3 variantes, animations procédurales (marche, course,
 * attaque, mort) et effets `emergence` (sort du sol), `breche` (sort d'une grille), `saisie` (immobilisé,
 * soulevé, se débat), `extraction` (âme arrachée : se cambre, yeux éteints), retrait `absorbe` (s'effondre,
 * se dessèche, s'effrite), `cendres` (brûle et s'effrite). IA : champ de flux vers le joueur le plus proche,
 * séparation, attaque. Réserve préallouée (pas d'allocation par image).
 *
 *   const Z = ProtoB7Zombies.creer(THREE, { monde, compat, max: 40, surAttaque(z, cibleId), surMort(z, tueurId) });
 *   Z.apparaitre({ position, lieu, effet, source, variante, vitesse }) → id | null
 *   Z.mettreAJour(dt, temps, joueurs)        // joueurs = [{ id, position, vivant, lieu }]
 *   Z.effet(id, 'saisie' | 'extraction' | 'relache', params) ; Z.retirer(id, { effet: 'cendres' | 'absorbe' | 'silencieux' })
 *   Z.toucher(id, degats, zone, info) → { tue } ; Z.intersecter(o, d, max, lieu) → hit ; Z.liste() → vues ; Z.tuerTous(effet)
 *
 * Chiens zombies (v1.2, API §14.4) — même API : Z.apparaitre({ position, lieu, type: 'chien', effet: 'faille' | 'normal',
 *   profil: { pv, vitesse, degats, cadence, portee }, vitesse, agressif, source }) → id. Galop à profil.vitesse (7,4 m/s),
 *   bond-morsure à profil.portee m toutes les profil.cadence s → surAttaque(chien, joueurId) (chien.degats = profil.degats),
 *   mort → surMort(chien, tueur) ; zones de tir 'tete' / 'corps' ; liste() / nombre(lieu, type) / plusProche(x, z, lieu, max, type)
 *   / tuerTous(effet, type) ; chaque vue porte `type` ('zombie' | 'chien').
 *
 * Mini-boss (v1.3, API §15) — même API : Z.apparaitre({ position, lieu, type: 'survolte' | 'irradie', miniBoss: true, nom,
 *   profil, effet: 'cuve' | 'normal', pvMax? }) → id ('m…') ; liste() : type, nom, pv, pvMax, miniBoss ; zones 'tete' / 'corps' ;
 *   capacités exécutées ici (décharge + flou, recharge, contact ; aura, flaque) : dégâts via Z.brancherDegats(fn(z, joueurId,
 *   fraction, source, info)), signalement via l'option surCapacite(z, quoi, info) (quoi : 'charge' | 'decharge' | 'spasme' |
 *   'aura' | 'flaque') ; Z.dangersZone(out), Z.flaques(), Z.PROFILS_MB. ProtoB7Zombies.modeleDormant(THREE, type, { compat })
 *   → { groupe, animer(t, agitation) } : le mini-boss endormi des cuves (utilisé par proto-monde.js).
 *
 * v1.4 (API §16.1, §16.2) — type 'demembre' en plus (Le Démembré, fiche N°02 : colosse de 1,95 m, bras gauche arraché pendu
 *   à des tendons, maillage à part mû par un pendule) ; Le Survolté : décharge multiple (un arc vers chaque joueur valide à
 *   portée et en vue) + étourdissement ; L'Irradié : 4,4 m/s, aura de 6 m, salves de boules (repère au sol dès le lancer),
 *   zones radioactives sans plafond jusqu'à sa mort (puis 1,5 s d'extinction), exposition par joueur ; Le Démembré : fléau
 *   (tournoiement `preparation` s puis arc de `angle`° sur `portee` m, tous les joueurs dedans).
 *   Dégâts : Z.brancherDegats(fn(z, joueurId, fraction, source, info)) — sources 'decharge' | 'aura' | 'flaque' | 'boule' |
 *   'zone' | 'fleau' ; info.etourdissement (s) et info.flou (s) pour la décharge ; le crochet renvoie false si rien n'est
 *   appliqué (joueur mort, invulnérable) : pas d'arc, pas d'« etourdi » signalé.
 *   surCapacite(z, quoi, info) — en plus : 'fleau' (info.etat 'preparation' | 'frappe'), 'impact' (un par joueur touché par le
 *   fléau, info.cible), 'boule' (etat 'lancer' | 'impact'), 'zone' (etat 'debut' | 'fin', info.id), 'etourdi' (info.cible) ;
 *   info.position (monde) et info.impact sont toujours renseignés. L'objet info est réutilisé : le copier s'il doit durer.
 *   Z.zones() → [{ id, x, z, rayon, lieu, source (id de L’Irradié), extinction (s restantes ou null) }] ;
 *   Z.boules() → [{ x, y, z, cible: { x, z }, rayon, restant }] ;
 *   Z.exposition(idIrradie, idJoueur) → s d'exposition ; Z.dangersZone(out) inclut les zones radioactives (source 'zone').
 *
 * v1.5 (API §17.1) — rages des mini-boss, exécutées ici (animation + invulnérabilité : pendant `duree`, Z.toucher → { tue: false,
 *   immunise: true }) ; `reprise: true` (mini-boss remis devant sa cuve) reprend l'état sans rejouer le début :
 *   Z.effet(id, 'surcharge', { duree, source: { x, y, z } }) (Le Survolté) : immobile, bras levés vers `source` (torse du
 *     Septième ; le rayon lui-même est dessiné par fx.js), de plus en plus lumineux ; puis « surchargé » (arcs plus forts) jusqu'à
 *     sa mort. Z.effet(id, 'infection', { duree }) (L'Irradié) : cri, immobile, vulnérable.
 *   Z.effet(id, 'irradie', { actif, aura: { rayon, degatsParSeconde }, couleur }) : zombies, chiens, petits Démembrés (jamais
 *     les mini-boss → false) : lueur verte, halo au sol (option creer({ halosIrradies: false }) pour l'ôter), aura par tics de
 *     0,25 s (brancherDegats, source 'aura') ; { actif: false } → normal. Z.irradies() → [{ id, type, rayon, degatsParSeconde }].
 *   Démembré géant : profil.echelle (2) → modèle, zones de tir, collision, navigation, cadence des pas et fléau à l'échelle.
 *   Z.effet(id, 'arrachement', { duree, vol, cible: { x, z } }) : invulnérable ; il arrache son bras pendu (surCapacite
 *     'arrachement' etat 'arrache'), le lance à `duree − vol` s ('lance'), posé sur `cible` à `duree` s ('pose') ; le bras reste au
 *     sol (mare de sang, pulsations) et se flétrit tout seul à sa mort. Z.bras() → [{ etat: 'main' | 'vol' | 'pose' | 'fletri',
 *     position, proprietaire }]. Sans bras : coups du bras droit au contact, charge (profil.charge : 'charge' etat
 *     'preparation' | 'elan' | 'impact' (info.cible) | 'mur') ; trajectoire figée au début de la préparation, dans
 *     Z.dangersZone(out) (type 'ligne', source 'charge') ; joueurs touchés : brancherDegats(…, 'charge', info) avec
 *     info.projection = { vx, vz, duree } (l'adaptateur appelle projeter) ; Z.impactMur(joueurId, { x, z, vitesse }) (projeté
 *     contre un mur) → impactMur en plus (source 'impactMur') + surCapacite 'projection' (info.cible, etat 'mur').
 *   Petits Démembrés : Z.apparaitre({ type: 'demembre_petit', effet: 'bras' | 'normal', profil, … }) → id ('m…') ; ni mini-boss
 *     (vue.miniBoss false) ni zombie ; effet 'bras' : sortent du sol en griffant, rampent, se relèvent. Z.retirer(id, { effet:
 *     'effondrement' }) : s'écroule et se dissout (aussi pour les zombies).
 * Global : ProtoB7Zombies.
 */
(function (root) {
  'use strict';
  var U = root.ProtoB7Commun, NAV = root.ProtoB7Nav;
  var PI = Math.PI, TAU = PI * 2;
  function h2(a, b) { return Math.sqrt(a * a + b * b); }   // Math.hypot à 2 termes sans boxing des arguments (boucles par image)
  // aléa rapide (xorshift32, état entier) pour les boucles par image : Math.random renvoie un nombre « emballé » (une allocation)
  // à chaque appel ; cette petite fonction est inlinée par l'optimiseur. Graine tirée au chargement (parties différentes).
  var ALEA = new Int32Array(1); ALEA[0] = (Math.random() * 2147483647) | 0 || 0x2545f491;
  function alea() { var x = ALEA[0]; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; ALEA[0] = x; return (x >>> 0) / 4294967296; }

  // ── squelette (repère du modèle : pieds à y = 0, regarde +Z, gauche = +X) ──
  var OS = [
    ['hanches', null, 0, 0.95, 0], ['colonne', 'hanches', 0, 1.12, -0.01], ['poitrine', 'colonne', 0, 1.3, -0.02],
    ['cou', 'poitrine', 0, 1.49, -0.02], ['tete', 'cou', 0, 1.58, 0.0], ['machoire', 'tete', 0, 1.6, 0.03],
    ['brasG', 'poitrine', 0.185, 1.43, -0.03], ['avantBrasG', 'brasG', 0.205, 1.16, -0.035], ['mainG', 'avantBrasG', 0.215, 0.91, -0.02],
    ['brasD', 'poitrine', -0.185, 1.43, -0.03], ['avantBrasD', 'brasD', -0.205, 1.16, -0.035], ['mainD', 'avantBrasD', -0.215, 0.91, -0.02],
    ['cuisseG', 'hanches', 0.1, 0.92, 0], ['tibiaG', 'cuisseG', 0.108, 0.5, 0.012], ['piedG', 'tibiaG', 0.112, 0.085, -0.02],
    ['cuisseD', 'hanches', -0.1, 0.92, 0], ['tibiaD', 'cuisseD', -0.108, 0.5, 0.012], ['piedD', 'tibiaD', -0.112, 0.085, -0.02]
  ];
  var IDX = {}; OS.forEach(function (o, i) { IDX[o[0]] = i; });
  var POS = {}; OS.forEach(function (o) { POS[o[0]] = [o[2], o[3], o[4]]; });

  // ── palettes (sRGB) ──
  var PAL = {
    peau: [0x8a8f80, 0x7d8576, 0x939486], peauSombre: 0x4e5248, plaie: 0x4a0d0a, plaieFraiche: 0x6e140e, os: 0xb8ad94,
    tunique: [0x4b5240, 0x56503c, 0x3e4542], tuniqueSombre: 0x2c302a, pantalon: [0x3b3f36, 0x46412f, 0x35393a],
    cuir: 0x231d18, ceinturon: 0x2a221a, casque: 0x3d4339, bandage: 0xb5ab95, cheveux: 0x1d1814, boue: 0x3f3527
  };

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // Fabrique de géométrie skinnée (anneaux le long d'axes)
  // ════════════════════════════════════════════════════════════════════════════════════════════
  function Fabrique(rng, indices) {
    this.P = []; this.C = []; this.UV = []; this.SI = []; this.SW = []; this.I = [];
    this.R = rng;
    this.IDX = indices || IDX;              // nom d'os → indice (squelette du zombie par défaut, du chien sinon)
  }
  /** Anneau : centre c, axes (lat, av) unitaires, demi-axes rx/rz, n segments, couleur fn(angle) → [r,g,b], poids [[os, w], …]. */
  Fabrique.prototype.anneau = function (c, lat, av, rx, rz, n, couleur, poids, v, deform) {
    var base = this.P.length / 3;
    for (var k = 0; k <= n; k++) {
      var a = k / n * TAU, ca = Math.cos(a), sa = Math.sin(a);
      var x = c[0] + lat[0] * rx * ca + av[0] * rz * sa, y = c[1] + lat[1] * rx * ca + av[1] * rz * sa, z = c[2] + lat[2] * rx * ca + av[2] * rz * sa;
      if (deform) { var d = deform(a, x, y, z); x += d[0]; y += d[1]; z += d[2]; }
      this.P.push(x, y, z);
      var col = couleur(a, x, y, z);
      this.C.push(col[0], col[1], col[2]);
      this.UV.push(k / n * (rx + rz) * 6, v);
      var w = typeof poids === 'function' ? poids(a, x, y, z) : poids;
      for (var q = 0; q < 4; q++) { if (q < w.length) { this.SI.push(this.IDX[w[q][0]]); this.SW.push(w[q][1]); } else { this.SI.push(0); this.SW.push(0); } }
    }
    return base;
  };
  /** Relie deux anneaux consécutifs de n segments. */
  Fabrique.prototype.relier = function (a, b, n, inverse) {
    for (var k = 0; k < n; k++) {
      var i0 = a + k, i1 = a + k + 1, j0 = b + k, j1 = b + k + 1;
      if (inverse) this.I.push(i0, i1, j0, i1, j1, j0); else this.I.push(i0, j0, i1, i1, j0, j1);
    }
  };
  /** Ferme un anneau par un éventail vers un point. */
  Fabrique.prototype.fermer = function (a, n, pt, couleur, poids, inverse) {
    var c = this.P.length / 3;
    this.P.push(pt[0], pt[1], pt[2]); this.C.push(couleur[0], couleur[1], couleur[2]); this.UV.push(0.5, 0.5);
    for (var q = 0; q < 4; q++) { if (q < poids.length) { this.SI.push(this.IDX[poids[q][0]]); this.SW.push(poids[q][1]); } else { this.SI.push(0); this.SW.push(0); } }
    for (var k = 0; k < n; k++) { if (inverse) this.I.push(a + k, a + k + 1, c); else this.I.push(a + k + 1, a + k, c); }
  };
  /** Tube le long d'une suite de sections { c, rx, rz, poids, couleur, deform }, axes latéraux fixes. */
  Fabrique.prototype.tube = function (sections, n, lat, av, opts) {
    opts = opts || {};
    var prec = -1, v = 0;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (i > 0) { var p = sections[i - 1].c; v += Math.hypot(s.c[0] - p[0], s.c[1] - p[1], s.c[2] - p[2]) * 6; }
      var a = this.anneau(s.c, s.lat || lat, s.av || av, s.rx, s.rz, n, s.couleur, s.poids, v, s.deform);
      if (prec >= 0) this.relier(prec, a, n, opts.inverse);
      prec = a;
      if (i === 0 && opts.fermerDebut) this.fermer(a, n, opts.fermerDebut, s.couleur(0, 0, 0, 0), typeof s.poids === 'function' ? s.poids(0, s.c[0], s.c[1], s.c[2]) : s.poids, !opts.inverse);
      if (i === sections.length - 1 && opts.fermerFin) this.fermer(a, n, opts.fermerFin, s.couleur(0, 0, 0, 0), typeof s.poids === 'function' ? s.poids(0, s.c[0], s.c[1], s.c[2]) : s.poids, !!opts.inverse);
    }
  };
  Fabrique.prototype.geometrie = function (THREE, sphere) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setIndex(this.I);
    // normales lissées en fusionnant les sommets confondus (coutures des anneaux)
    var P = this.P, n = P.length / 3, N = new Float32Array(n * 3), cle = {}, rep = new Int32Array(n);
    for (var i = 0; i < n; i++) {
      var k = Math.round(P[i * 3] * 2000) + ',' + Math.round(P[i * 3 + 1] * 2000) + ',' + Math.round(P[i * 3 + 2] * 2000);
      if (cle[k] === undefined) cle[k] = i;
      rep[i] = cle[k];
    }
    var I = this.I;
    for (var t = 0; t < I.length; t += 3) {
      var a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      var ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      [I[t], I[t + 1], I[t + 2]].forEach(function (q) { var r = rep[q] * 3; N[r] += nx; N[r + 1] += ny; N[r + 2] += nz; });
    }
    for (var j = 0; j < n; j++) { var r = rep[j] * 3, l = Math.hypot(N[r], N[r + 1], N[r + 2]) || 1; N[j * 3] = N[r] / l; N[j * 3 + 1] = N[r + 1] / l; N[j * 3 + 2] = N[r + 2] / l; }
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.computeBoundingSphere();
    g.boundingSphere.radius = sphere ? sphere[3] : 1.3;   // marge pour les poses (pas de disparition par le frustum)
    g.boundingSphere.center.set(sphere ? sphere[0] : 0, sphere ? sphere[1] : 0.9, sphere ? sphere[2] : 0);
    return g;
  };

  /** Boîte skinnée (pochettes, boucle) : centre c, demi-tailles h, couleur, poids. */
  Fabrique.prototype.boite = function (c, h, couleur, poids) {
    var faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [-1, 0, 0], [0, 1, 0]], [[0, 0, -1], [1, 0, 0], [0, 1, 0]]];
    for (var f = 0; f < 6; f++) {
      var n = faces[f][0], u = faces[f][1], v = faces[f][2], base = this.P.length / 3;
      var coins = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (var k = 0; k < 4; k++) {
        var a = coins[k][0], b = coins[k][1];
        this.P.push(c[0] + (n[0] + u[0] * a + v[0] * b) * h[0], c[1] + (n[1] + u[1] * a + v[1] * b) * h[1], c[2] + (n[2] + u[2] * a + v[2] * b) * h[2]);
        this.C.push(couleur[0], couleur[1], couleur[2]); this.UV.push(a * 0.5 + 0.5, b * 0.5 + 0.5);
        for (var q = 0; q < 4; q++) { if (q < poids.length) { this.SI.push(this.IDX[poids[q][0]]); this.SW.push(poids[q][1]); } else { this.SI.push(0); this.SW.push(0); } }
      }
      // orientation : (u × v) doit suivre n
      var cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0];
      if (cx * n[0] + cy * n[1] + cz * n[2] > 0) this.I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else this.I.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  };

  var X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], NX = [-1, 0, 0];
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function sm(a, b, x) { return U.smooth(a, b, x); }
  function gauss(dx, sx, dy, sy) { return Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy)); }
  function distSeg2(px, py, ax, ay, bx, by) { var ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey, t = l2 ? U.clamp(((px - ax) * ex + (py - ay) * ey) / l2, 0, 1) : 0; return h2(px - ax - ex * t, py - ay - ey * t); }

  /** Construit la géométrie d'une variante (0 : tête nue, 1 : casque, 2 : bandage). */
  function construireVariante(THREE, variante, graine) {
    var R = U.rng(graine), F = new Fabrique(R);
    var lin = U.lin, mix = U.melange;
    var peau = lin(PAL.peau[variante % 3]), peauS = lin(PAL.peauSombre), plaie = lin(PAL.plaie), plaieF = lin(PAL.plaieFraiche), osC = lin(PAL.os);
    var tun = lin(PAL.tunique[variante % 3]), tunS = lin(PAL.tuniqueSombre), pant = lin(PAL.pantalon[variante % 3]), cuir = lin(PAL.cuir), cein = lin(PAL.ceinturon);
    var casque = lin(PAL.casque), band = lin(PAL.bandage), chev = lin(PAL.cheveux), boue = lin(PAL.boue);
    var metal = lin(0x7c7562), noir = lin(0x0b0605), dent = lin(0x857a5f), veine = lin(0x3a3440);
    var tache = function (x, y, z, s, f) { return U.fbm2((x + z * 0.7) * f + s, (y + x * 0.3) * f + s * 1.3, graine + s, 3); };
    var plaies = [];
    for (var i = 0; i < 5; i++) plaies.push([R.entre(-0.17, 0.17), R.entre(1.0, 1.4), R.entre(-0.1, 0.12), R.entre(0.025, 0.06)]);
    function couleurPlaies(c, x, y, z) {
      for (var k = 0; k < plaies.length; k++) {
        var p = plaies[k], d = Math.hypot(x - p[0], y - p[1], (z - p[2]) * 0.6);
        if (d < p[3]) c = mix(c, d < p[3] * 0.55 ? plaieF : plaie, sm(p[3], p[3] * 0.5, d));
      }
      return c;
    }
    function crasse(c, x, y, z) {
      var t = tache(x, y, z, 3, 7), b = sm(0.6, 0.78, t);
      c = mix(c, [c[0] * 0.55, c[1] * 0.52, c[2] * 0.5], b * 0.7);
      var bo = sm(0.35, 0.0, y) * 0.5 + sm(0.62, 0.8, tache(x, y, z, 7, 3)) * 0.3;
      return mix(c, boue, Math.min(0.85, bo));
    }
    var dechire = function (x, y, z) { return sm(0.68, 0.74, tache(x, y, z, 11, 9)); };
    function sangle(x, y, z) {
      // bretelles en Y : devant deux bandes du ceinturon aux épaules, derrière elles se rejoignent
      var ax = Math.abs(x);
      if (z > 0) return distSeg2(ax, y, 0.085, 1.045, 0.115, 1.44) < 0.014;
      return distSeg2(ax, y, 0.0, 1.16, 0.115, 1.44) < 0.014 || (ax < 0.014 && y > 1.045 && y < 1.16);
    }

    // ── torse (tunique boutonnée, poches, col, bretelles) ──
    var torse = [
      [0.80, 0.176, 0.13], [0.88, 0.179, 0.123], [0.95, 0.176, 0.119], [1.03, 0.16, 0.11], [1.12, 0.16, 0.112], [1.2, 0.172, 0.12],
      [1.28, 0.185, 0.126], [1.36, 0.192, 0.124], [1.42, 0.198, 0.114], [1.455, 0.16, 0.1], [1.475, 0.11, 0.085], [1.495, 0.066, 0.064]
    ];
    var poidsTorse = function (y) {
      if (y < 1.0) return [['hanches', 1]];
      if (y < 1.12) { var t = sm(1.0, 1.12, y); return [['hanches', 1 - t], ['colonne', t]]; }
      if (y < 1.22) return [['colonne', 1]];
      if (y < 1.32) { var t2 = sm(1.22, 1.32, y); return [['colonne', 1 - t2], ['poitrine', t2]]; }
      if (y < 1.46) return [['poitrine', 1]];
      var t3 = sm(1.46, 1.5, y); return [['poitrine', 1 - t3], ['cou', t3]];
    };
    F.tube(torse.map(function (r) {
      var y = r[0];
      return {
        c: [0, y, -0.01 - (y > 1.2 ? (y - 1.2) * 0.05 : 0)], rx: r[1], rz: r[2], poids: poidsTorse(y),
        deform: function (a, x, yy, z) {
          if (y < 0.85) return [0, (R() * 0.07) * (Math.sin(a * 7 + 1.3) * 0.5 + 0.5), 0];      // ourlet déchiqueté
          return [0, 0, (yy > 1.25 && Math.sin(a) < 0 ? -0.012 : 0)];
        },
        couleur: function (a, x, yy, z) {
          var c = tun, ax = Math.abs(x);
          if (yy > 1.485) return crasse(couleurPlaies(peau, x, yy, z), x, yy, z);
          if (yy > 1.43) c = tunS;                                                         // col
          if (z > 0.05) {
            if (ax < 0.005 && yy > 1.0) c = tunS;                                           // patte de boutonnage
            [1.07, 1.17, 1.27, 1.37].forEach(function (by) { if (h2(x, (yy - by) * 0.9) < 0.009) c = metal; });
            if (ax > 0.04 && ax < 0.13 && yy > 1.27 && yy < 1.365) c = yy > 1.35 ? lin(0x262a22) : mix(tun, tunS, 0.45);   // poches de poitrine
            if (ax > 0.04 && ax < 0.14 && yy > 1.07 && yy < 1.165) c = yy > 1.155 ? lin(0x262a22) : mix(tun, tunS, 0.45);  // poches basses
          }
          if (sangle(x, yy, z)) c = cuir;
          if (dechire(x, yy, z) > 0.5 && yy > 1.0 && yy < 1.42) c = couleurPlaies(peau, x, yy, z);
          if (variante === 1 && ax > 0.13 && yy > 1.05 && yy < 1.3 && z < 0.03 && z > -0.06) { c = mix(c, osC, sm(0.45, 0.85, Math.sin(yy * 110) * 0.5 + 0.5) * 0.85); if (Math.sin(yy * 110) < -0.3) c = plaie; }  // côtes à vif
          return crasse(c, x, yy, z);
        }
      };
    }), 22, X, Z, { fermerDebut: [0, 0.78, -0.01] });
    // ceinturon, boucle et cartouchières
    F.tube([[1.0, 0.165, 0.114], [1.05, 0.164, 0.113]].map(function (r) { return { c: [0, r[0], -0.01], rx: r[1], rz: r[2], poids: [['hanches', 1]], couleur: function () { return cein; } }; }), 22, X, Z);
    F.boite([0, 1.025, 0.106], [0.026, 0.022, 0.008], metal, [['hanches', 1]]);
    [[0.075, 0.098], [0.12, 0.075], [-0.075, 0.098], [-0.12, 0.075]].forEach(function (pq) { F.boite([pq[0], 1.005, pq[1] + 0.012], [0.021, 0.03, 0.016], cuir, [['hanches', 1]]); });
    F.boite([0.14, 0.97, -0.07], [0.03, 0.06, 0.035], lin(0x3a3a30), [['hanches', 1]]);       // gamelle / pelle au dos

    // ── cou et tête (traits marqués : orbites, arcades, nez, pommettes creusées, bouche ouverte, oreilles) ──
    var profil = [[1.49, 0.052, 0.055, -0.005], [1.53, 0.054, 0.058, 0.0], [1.555, 0.058, 0.068, 0.02], [1.575, 0.066, 0.08, 0.024], [1.595, 0.072, 0.088, 0.024],
      [1.615, 0.077, 0.095, 0.02], [1.64, 0.082, 0.1, 0.016], [1.66, 0.084, 0.102, 0.013], [1.68, 0.085, 0.104, 0.011], [1.70, 0.085, 0.104, 0.008],
      [1.72, 0.083, 0.101, 0.004], [1.745, 0.078, 0.095, 0.0], [1.77, 0.068, 0.083, -0.004], [1.79, 0.052, 0.064, -0.008], [1.803, 0.03, 0.038, -0.01]];
    var anneaux = [];
    for (var pi = 0; pi < profil.length; pi++) {
      anneaux.push(profil[pi]);
      if (pi < profil.length - 1 && profil[pi][0] > 1.54 && profil[pi][0] < 1.73) { var A2 = profil[pi], B2 = profil[pi + 1]; anneaux.push([(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2, (A2[2] + B2[2]) / 2, (A2[3] + B2[3]) / 2]); }
    }
    function traits(x, yy, z) {
      // relief du visage (vers l'avant) : renvoie dz
      var ax = Math.abs(x), dz = 0;
      dz -= 0.03 * gauss(ax - 0.034, 0.014, yy - 1.668, 0.011);                    // orbites
      dz += 0.013 * gauss(ax - 0.03, 0.03, yy - 1.692, 0.006);                     // arcades
      var tNez = sm(1.684, 1.628, yy) * sm(1.618, 1.63, yy);
      dz += (0.009 + 0.022 * tNez) * gauss(x, 0.011, 0, 1) * sm(1.615, 1.63, yy) * sm(1.69, 1.675, yy);   // nez
      dz -= 0.016 * gauss(ax - 0.053, 0.014, yy - 1.613, 0.012);                    // joues creuses
      dz -= 0.02 * gauss(0, 1, yy - 1.597, 0.0035) * sm(0.04, 0.025, ax);           // bouche ouverte
      dz += 0.008 * gauss(x, 0.02, yy - 1.565, 0.008);                              // menton
      return dz;
    }
    F.tube(anneaux.map(function (r) {
      var y = r[0];
      var w = y < 1.55 ? [['cou', 1]] : y < 1.6 ? [['cou', 1 - sm(1.55, 1.6, y)], ['tete', sm(1.55, 1.6, y)]] : [['tete', 1]];
      return {
        c: [0, y, r[3]], rx: r[1], rz: r[2],
        poids: function (a, x, yy, z) {
          if (yy < 1.6 && yy > 1.54 && z > 0.02) { var t = sm(1.6, 1.585, yy) * sm(0.02, 0.06, z); return [['tete', 1 - t], ['machoire', t]]; }
          return w;
        },
        deform: function (a, x, yy, z) {
          var dz = z > 0.03 ? traits(x, yy, z) * sm(0.03, 0.07, z) : 0, dx = 0;
          // oreilles
          if (Math.abs(z - 0.005) < 0.025 && yy > 1.635 && yy < 1.7) dx = Math.sign(x) * 0.012 * sm(0.07, 0.083, Math.abs(x)) * gauss(0, 1, yy - 1.665, 0.016);
          return [dx, 0, dz];
        },
        couleur: function (a, x, yy, z) {
          var c = peau, ax = Math.abs(x);
          if (yy < 1.55) { c = mix(peau, veine, sm(0.6, 0.75, tache(x, yy, z, 17, 40)) * 0.6); return crasse(c, x, yy, z); }
          if (z > 0.035) {
            var orb = gauss(ax - 0.034, 0.013, yy - 1.668, 0.01);
            c = mix(c, peauS, sm(0.15, 0.5, orb)); if (orb > 0.7) c = noir;
            var bou = gauss(0, 1, yy - 1.597, 0.004) * sm(0.04, 0.026, ax);
            if (bou > 0.35) c = noir; else if (Math.abs(yy - 1.604) < 0.004 && ax < 0.028) c = dent; else if (Math.abs(yy - 1.589) < 0.004 && ax < 0.026) c = dent;
            if (gauss(ax - 0.06, 0.02, yy - 1.64, 0.02) > 0.5) c = mix(c, peauS, 0.35);
            // veines sombres autour des yeux
            if (sm(0.66, 0.72, tache(x, yy, z, 23, 60)) > 0.5 && orb > 0.08) c = mix(c, veine, 0.7);
          }
          if (variante === 0 && yy > 1.715 && tache(x, yy, z, 5, 30) > 0.45) c = chev;
          if (variante === 2 && yy > 1.69 && yy < 1.745) c = mix(band, plaie, sm(0.58, 0.72, tache(x, yy, z, 9, 20)));
          if (variante === 2 && yy > 1.745) c = mix(c, chev, 0.6);
          c = couleurPlaies(c, x * 0.8 + 0.1, yy - 0.3, z);
          return crasse(c, x, yy + 0.4, z);
        }
      };
    }), 28, X, Z, { fermerFin: [0, 1.81, -0.01] });
    if (variante === 1) {
      F.tube([[1.7, 0.122, 0.138], [1.712, 0.116, 0.13], [1.745, 0.112, 0.124], [1.785, 0.096, 0.106], [1.815, 0.062, 0.07], [1.83, 0.015, 0.018]].map(function (r) {
        return { c: [0, r[0], -0.008], rx: r[1], rz: r[2], poids: [['tete', 1]], couleur: function (a, x, yy, z) { return mix(casque, boue, sm(0.55, 0.75, tache(x, yy, z, 13, 12)) * 0.6); } };
      }), 22, X, Z, { fermerFin: [0, 1.832, -0.008] });
      F.tube([[1.695, 0.008, 0.008, 0.0], [1.68, 0.006, 0.006, 0.03]].map(function (r, k) { return { c: [0.11, r[0], 0.01 + r[3]], rx: 0.004, rz: 0.004, poids: [['tete', 1]], couleur: function () { return cuir; } }; }), 6, X, Z, { inverse: true });
    }

    // ── bras (manches épaisses ; avant-bras gauche dénudé) et mains en griffes ──
    ['G', 'D'].forEach(function (S) {
      var sx = S === 'G' ? 1 : -1;
      var ep = POS['bras' + S], co = POS['avantBras' + S], po = POS['main' + S];
      var nu = S === 'G';
      var secs = [];
      [[-0.06, 0.068, 0.07], [0.0, 0.07, 0.073], [0.15, 0.066, 0.068], [0.5, 0.06, 0.062], [0.85, 0.055, 0.057], [1.0, 0.052, 0.054]].forEach(function (r) {
        var c = lerp3(ep, co, r[0]); c[0] += sx * 0.006;
        var w = r[0] < 0.12 ? [['poitrine', 0.35], ['bras' + S, 0.65]] : r[0] > 0.85 ? [['bras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['avantBras' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['bras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) { var c2 = dechire(x * 2, y, z) > 0.6 ? couleurPlaies(peau, x, y, z) : tun; if (Math.abs(y - 1.36) < 0.02) c2 = tunS; return crasse(c2, x, y, z); } });
      });
      [[0.08, 0.054, 0.056], [0.4, 0.05, 0.05], [0.75, 0.042, 0.04], [0.95, 0.036, 0.034], [1.0, 0.034, 0.032]].forEach(function (r) {
        var c = lerp3(co, po, r[0]);
        var w = r[0] < 0.2 ? [['bras' + S, 0.3], ['avantBras' + S, 0.7]] : r[0] > 0.85 ? [['avantBras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.6], ['main' + S, sm(0.85, 1.0, r[0]) * 0.6]] : [['avantBras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) {
          var c2 = (nu && r[0] > 0.05) || r[0] > 0.78 ? couleurPlaies(peau, x - 0.2 * sx, y + 0.3, z) : tun;
          if (!nu && Math.abs(r[0] - 0.78) < 0.06) c2 = tunS;                  // manchette
          if (nu && Math.abs(r[0] - 0.08) < 0.06) c2 = tunS;                   // manche retroussée
          if (nu) c2 = mix(c2, veine, sm(0.62, 0.7, tache(x, y, z, 31, 30)) * 0.6);
          return crasse(c2, x, y, z);
        } });
      });
      F.tube(secs, 12, X, Z, { fermerDebut: [ep[0] - sx * 0.01, ep[1] + 0.06, ep[2]], inverse: true });   // tubes descendants : faces vers l'extérieur
      // paume
      var m0 = [po[0], po[1] + 0.005, po[2]], mK = [po[0] + sx * 0.006, po[1] - 0.085, po[2] + 0.012];
      var cMain = mix(peau, peauS, 0.45);
      F.tube([[0.0, 0.03, 0.02], [0.35, 0.044, 0.022], [0.75, 0.047, 0.02], [1.0, 0.043, 0.017]].map(function (r) {
        return { c: lerp3(m0, mK, r[0]), rx: r[1], rz: r[2], poids: [['main' + S, 1]], couleur: function (a, x, y, z) { return crasse(cMain, x, y, z); } };
      }), 10, X, Z, { inverse: true });
      // doigts en griffes (4) + pouce
      for (var d = 0; d < 4; d++) {
        var ox = (d - 1.5) * 0.022 * sx, L = [0.068, 0.078, 0.074, 0.062][d];
        var b0 = [mK[0] + ox, mK[1] + 0.004, mK[2]], b1 = [b0[0] + ox * 0.15, b0[1] - L * 0.6, b0[2] + 0.012], b2 = [b1[0] + ox * 0.1, b1[1] - L * 0.35, b1[2] + 0.028];
        F.tube([[b0, 0.0105, 0.009], [b1, 0.0085, 0.0078], [b2, 0.005, 0.005]].map(function (r, k) {
          return { c: r[0], rx: r[1], rz: r[2], poids: [['main' + S, 1]], couleur: function () { return k === 2 ? lin(0x2a1a14) : cMain; } };
        }), 6, X, Z, { fermerFin: [b2[0], b2[1] - 0.006, b2[2] + 0.004], inverse: true });
      }
      var t0 = [po[0] - sx * 0.005, po[1] - 0.03, po[2] + 0.02], t1 = [t0[0] - sx * 0.01, t0[1] - 0.035, t0[2] + 0.03];
      F.tube([[t0, 0.012, 0.011], [t1, 0.008, 0.008]].map(function (r) { return { c: r[0], rx: r[1], rz: r[2], poids: [['main' + S, 1]], couleur: function () { return cMain; } }; }), 6, X, Z, { fermerFin: [t1[0], t1[1] - 0.008, t1[2] + 0.006], inverse: true });
    });

    // ── jambes (pantalon, genoux salis, bottes hautes lacées) ──
    ['G', 'D'].forEach(function (S) {
      var hi = POS['cuisse' + S], ge = POS['tibia' + S], ch = POS['pied' + S];
      var secs = [];
      [[0.0, 0.09, 0.092], [0.3, 0.082, 0.084], [0.7, 0.068, 0.07], [1.0, 0.06, 0.062]].forEach(function (r) {
        var c = lerp3(hi, ge, r[0]);
        var w = r[0] < 0.1 ? [['hanches', 0.5], ['cuisse' + S, 0.5]] : r[0] > 0.85 ? [['cuisse' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['tibia' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['cuisse' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) { var c2 = dechire(x * 1.5, y * 2, z) > 0.62 ? couleurPlaies(peau, x, y + 0.5, z) : pant; if (z > 0.03 && Math.abs(y - 0.52) < 0.06) c2 = mix(c2, boue, 0.6); return crasse(c2, x, y, z); } });
      });
      [[0.12, 0.059, 0.062], [0.45, 0.058, 0.064], [0.56, 0.066, 0.072], [0.6, 0.067, 0.073], [0.8, 0.058, 0.064], [1.0, 0.052, 0.058]].forEach(function (r) {
        var c = lerp3(ge, ch, r[0]);
        var w = r[0] < 0.2 ? [['cuisse' + S, 0.3], ['tibia' + S, 0.7]] : r[0] > 0.9 ? [['tibia' + S, 0.6], ['pied' + S, 0.4]] : [['tibia' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) {
          if (r[0] < 0.55) return crasse(pant, x, y, z);
          var c2 = cuir;
          if (z > 0.04 && Math.abs(x - ch[0]) < 0.012 && Math.sin(y * 300) > 0.3) c2 = lin(0x4a4034);     // lacets
          return crasse(c2, x, y, z);
        } });
      });
      F.tube(secs, 12, X, Z, { inverse: true });
      var talon = [ch[0], 0.058, ch[2] - 0.075], bout = [ch[0], 0.045, ch[2] + 0.175];
      F.tube([[0.0, 0.052, 0.055], [0.25, 0.058, 0.06], [0.7, 0.052, 0.042], [1.0, 0.032, 0.026]].map(function (r) {
        var c = lerp3(talon, bout, r[0]); c[1] = 0.058 - r[0] * 0.014;
        return { c: c, rx: r[1], rz: r[2], lat: X, av: Y, poids: [['pied' + S, 1]], couleur: function (a, x, y, z) { return crasse(y < 0.012 ? lin(0x0c0a08) : cuir, x, y, z); } };
      }), 10, X, Y, { fermerDebut: [talon[0], 0.058, talon[2] - 0.01], fermerFin: [bout[0], 0.04, bout[2] + 0.015], inverse: true });
    });
    return F.geometrie(THREE);
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // CHIEN ZOMBIE (v1.2, API §14.4) : grand chien décharné, dessin original (≈ 0,72 m au garrot, ≈ 1,15 m de la truffe
  // à la croupe) : peau grise tendue sur les os, plaques de poil, côtes et échine à vif, oreille arrachée, babines
  // retroussées sur les crocs, moignon de queue, yeux couleur braise du Pacte. Squelette de 23 os, maillage skinné.
  // ════════════════════════════════════════════════════════════════════════════════════════════
  var OS_CHIEN = [
    ['bassin', null, 0, 0.62, -0.3], ['lombes', 'bassin', 0, 0.64, -0.1], ['thorax', 'lombes', 0, 0.64, 0.12],
    ['cou', 'thorax', 0, 0.68, 0.29], ['tete', 'cou', 0, 0.8, 0.43], ['machoire', 'tete', 0, 0.75, 0.48],
    ['queue', 'bassin', 0, 0.63, -0.47],
    ['epauleG', 'thorax', 0.11, 0.56, 0.22], ['coudeG', 'epauleG', 0.105, 0.35, 0.165], ['carpeG', 'coudeG', 0.1, 0.1, 0.19], ['pattAvG', 'carpeG', 0.1, 0.03, 0.225],
    ['epauleD', 'thorax', -0.11, 0.56, 0.22], ['coudeD', 'epauleD', -0.105, 0.35, 0.165], ['carpeD', 'coudeD', -0.1, 0.1, 0.19], ['pattAvD', 'carpeD', -0.1, 0.03, 0.225],
    ['hancheG', 'bassin', 0.1, 0.6, -0.35], ['genouG', 'hancheG', 0.115, 0.37, -0.25], ['jarretG', 'genouG', 0.105, 0.16, -0.39], ['pattArG', 'jarretG', 0.1, 0.03, -0.355],
    ['hancheD', 'bassin', -0.1, 0.6, -0.35], ['genouD', 'hancheD', -0.115, 0.37, -0.25], ['jarretD', 'genouD', -0.105, 0.16, -0.39], ['pattArD', 'jarretD', -0.1, 0.03, -0.355]
  ];
  var IDX_CHIEN = {}; OS_CHIEN.forEach(function (o, i) { IDX_CHIEN[o[0]] = i; });
  var POS_CHIEN = {}; OS_CHIEN.forEach(function (o) { POS_CHIEN[o[0]] = [o[2], o[3], o[4]]; });
  var NOMS_CHIEN = OS_CHIEN.map(function (o) { return o[0]; });
  var PAL_CHIEN = {
    peau: [0x5f564f, 0x524a44], peauNue: 0x84726a, poil: [0x231d19, 0x1d1815], chair: 0x5a1610, plaie: 0x3f0b08, os: 0xc2b596,
    gencive: 0x5c1915, langue: 0x6e2a26, dent: 0xcfc29e, truffe: 0x131010, griffe: 0x16120e, boue: 0x3f3527
  };
  // torse : z, centre y, demi-largeur, demi-hauteur (croupe → poitrail) ; poitrine profonde, ventre très levretté
  var TORSE_CHIEN = [
    [-0.512, 0.575, 0.05, 0.05], [-0.49, 0.585, 0.088, 0.088], [-0.45, 0.595, 0.112, 0.112], [-0.39, 0.6, 0.124, 0.124], [-0.3, 0.607, 0.113, 0.11], [-0.2, 0.622, 0.093, 0.088],
    [-0.1, 0.612, 0.103, 0.108], [0.0, 0.588, 0.118, 0.148], [0.1, 0.567, 0.128, 0.172], [0.19, 0.566, 0.124, 0.174], [0.26, 0.584, 0.11, 0.152], [0.315, 0.615, 0.085, 0.11]
  ];
  function anneauTorseChien(z) {
    var T = TORSE_CHIEN, i = 0;
    while (i < T.length - 2 && T[i + 1][0] < z) i++;
    var a = T[i], b = T[i + 1], t = U.clamp((z - a[0]) / (b[0] - a[0]), 0, 1);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  }
  function construireChien(THREE, variante, graine) {
    var R = U.rng(graine), F = new Fabrique(R, IDX_CHIEN);
    var lin = U.lin, mix = U.melange;
    var peau = lin(PAL_CHIEN.peau[variante % 2]), peauNue = lin(PAL_CHIEN.peauNue), poil = lin(PAL_CHIEN.poil[variante % 2]), chair = lin(PAL_CHIEN.chair), plaie = lin(PAL_CHIEN.plaie);
    var osC = mix(lin(PAL_CHIEN.os), lin(PAL_CHIEN.chair), 0.3), gencive = lin(PAL_CHIEN.gencive), langue = lin(PAL_CHIEN.langue), dent = mix(lin(PAL_CHIEN.dent), lin(0x6b5a3a), 0.35), truffe = lin(PAL_CHIEN.truffe), griffe = lin(PAL_CHIEN.griffe), boue = lin(PAL_CHIEN.boue);
    var cote = variante % 2 ? -1 : 1;                 // flanc écorché (côtes à vif) ; l'oreille arrachée est de l'autre côté
    var n = function (x, y, z, s, f) { return U.fbm2((x * 0.7 + z) * f + s, (y + x * 0.4) * f + s * 1.7, graine + s, 3); };
    var plaies = [];
    for (var i = 0; i < 6; i++) plaies.push([R.entre(-0.12, 0.12), R.entre(0.35, 0.7), R.entre(-0.45, 0.3), R.entre(0.02, 0.045)]);
    function decharne(c, x, y, z) {
      // peau grise, plaques de poil ras et sombre, galle (peau nue), plaies, boue en bas
      var f = n(x, y, z, 3, 9), pg = sm(0.46, 0.56, f);
      c = mix(c, poil, pg * 0.85);
      c = mix(c, peauNue, sm(0.66, 0.74, n(x, y, z, 11, 13)) * 0.7);
      for (var k = 0; k < plaies.length; k++) { var p = plaies[k], d = Math.hypot(x - p[0], y - p[1], z - p[2]); if (d < p[3]) c = mix(c, d < p[3] * 0.5 ? chair : plaie, sm(p[3], p[3] * 0.45, d)); }
      c = mix(c, [c[0] * 0.6, c[1] * 0.57, c[2] * 0.55], sm(0.58, 0.75, n(x, y, z, 7, 5)) * 0.5);
      return mix(c, boue, Math.min(0.8, sm(0.3, 0.0, y) * 0.75));
    }
    function ecorche(x, y, z) {                       // flanc écorché : peau déchirée sur les côtes
      if (x * cote < 0.04) return 0;
      var bord = 0.012 * (n(x, y, z, 21, 40) - 0.5);
      var dz = Math.max(0, Math.max(0.02 - z, z - 0.25)), dy = Math.max(0, Math.max(0.44 - y, y - 0.64));
      return sm(0.03 + bord, 0.0, h2(dz, dy));
    }
    // ── torse : anneaux dans le plan XY, du derrière vers le poitrail ──
    F.tube(TORSE_CHIEN.map(function (r) {
      var z = r[0];
      var poids = z < -0.35 ? [['bassin', 1]] : z < -0.15 ? [['bassin', sm(-0.15, -0.35, z)], ['lombes', 1 - sm(-0.15, -0.35, z)]]
        : z < 0.05 ? [['lombes', sm(0.05, -0.15, z)], ['thorax', 1 - sm(0.05, -0.15, z)]] : z < 0.27 ? [['thorax', 1]] : [['thorax', 0.6], ['cou', 0.4]];
      return {
        c: [0, r[1], z], rx: r[2], rz: r[3], poids: poids,
        deform: function (a, x, y, zz) {
          var ca = Math.cos(a), sa = Math.sin(a), d = 0;
          if (sa > 0.82 && z > -0.42 && z < 0.27) d += 0.008 * Math.max(0, Math.sin(z * TAU / 0.05));                 // vertèbres
          if (z > -0.03 && z < 0.27 && sa < 0.55 && sa > -0.75) d += 0.009 * Math.pow(0.5 + 0.5 * Math.sin(z * TAU / 0.042), 3);   // côtes
          d += 0.02 * gauss(z + 0.36, 0.035, Math.abs(a) - 1.0, 0.25) + 0.02 * gauss(z + 0.36, 0.035, Math.abs(a - PI) - 1.0, 0.25);   // ailes du bassin
          d += 0.014 * gauss(z - 0.2, 0.04, sa - 0.8, 0.15);                                                         // omoplates
          d -= 0.018 * ecorche(x, y, zz);                                                                              // creux du flanc écorché
          return [ca * d, sa * d, 0];
        },
        couleur: function (a, x, y, zz) {
          var c = decharne(peau, x, y, zz), e = ecorche(x, y, zz);
          if (e > 0) c = mix(c, mix(chair, plaie, n(x, y, zz, 5, 30)), e);
          if (Math.sin(a) > 0.86 && z > -0.26 && z < -0.04) c = mix(c, chair, 0.6);                                   // échine à vif
          return c;
        }
      };
    }), 18, X, Y, { fermerDebut: [0, 0.572, -0.522], fermerFin: [0, 0.62, 0.325], inverse: true });
    // côtes à vif (5 arcs osseux sur le flanc écorché)
    [0.035, 0.08, 0.125, 0.17, 0.215].forEach(function (zc, k) {
      // côtes inégales : certaines cassées, plus ou moins dégagées de la peau
      var a0 = 0.5 - R() * 0.2, a1 = -0.78 + (k === 2 ? 0.55 : R() * 0.3), pts = [];
      for (var j = 0; j <= 6; j++) {
        var a = a0 + (a1 - a0) * j / 6, z2 = zc - (0.5 - a) * 0.025 + (R() - 0.5) * 0.004;
        var t2 = anneauTorseChien(z2);
        pts.push([cote * Math.cos(a) * (t2[1] + 0.002), t2[0] + Math.sin(a) * (t2[2] + 0.002), z2]);
      }
      F.tube(pts.map(function (p, jj) { return { c: p, rx: 0.0055, rz: 0.0065, poids: [['thorax', 1]], couleur: function () { return mix(osC, chair, 0.2 + 0.15 * (k % 2) + 0.25 * Math.abs(jj - 3) / 3); } }; }), 6, Z, X);
    });
    // échine à vif : apophyses des vertèbres lombaires
    for (var v = 0; v < 5; v++) { var zv = -0.24 + v * 0.045, tv = anneauTorseChien(zv); F.boite([0, tv[0] + tv[2] + 0.002, zv], [0.006, 0.007, 0.008], mix(osC, chair, 0.25 + 0.1 * (v % 2)), [['lombes', 1]]); }
    // ── cou : décharné (trachée, tendons, gouttières jugulaires), incliné vers l'avant ──
    var N0 = [0, 0.655, 0.265], N1 = [0, 0.795, 0.42], avCou = [0, 0.754, -0.657];
    F.tube([[0, 0.072, 0.086], [0.25, 0.061, 0.074], [0.5, 0.053, 0.064], [0.75, 0.049, 0.058], [1, 0.047, 0.055]].map(function (r) {
      var t = r[0], poids = t < 0.15 ? [['thorax', 0.6], ['cou', 0.4]] : t > 0.85 ? [['cou', 0.5], ['tete', 0.5]] : [['cou', 1]];
      return { c: lerp3(N0, N1, t), rx: r[1], rz: r[2], av: avCou, poids: poids,
        deform: function (a) {
          var u = Math.cos(a), w = Math.sin(a), d = 0;
          if (w < 0) d += (0.007 * Math.exp(-u * u / 0.03) + 0.004 * (Math.exp(-(u - 0.55) * (u - 0.55) / 0.012) + Math.exp(-(u + 0.55) * (u + 0.55) / 0.012))) * -w;   // trachée, tendons
          d -= 0.008 * Math.exp(-w * w / 0.08) * (0.4 + 0.6 * Math.sin(PI * t));                                       // gouttières (cou creusé)
          if (w > 0) d += 0.004 * Math.exp(-u * u / 0.02) * w;                                                           // crête de la nuque
          return [u * d, avCou[1] * w * d, avCou[2] * w * d];
        },
        couleur: function (a, x, y, z) {
          var c = decharne(peau, x, y, z);
          if (x * cote < -0.04 && Math.abs(y - 0.72) < 0.035 && Math.abs(z - 0.35) < 0.03) c = mix(c, chair, 0.85);   // morsure au cou
          return c;
        } };
    }), 18, X, avCou, { inverse: true });
    // ── tête (repère : s vers la truffe, h vers le haut, x latéral) : crâne étroit à crête sagittale, tempes creuses,
    //    arcades zygomatiques, stop marqué, orbites enfoncées, museau en coin, truffe, babines noires retroussées
    //    sur les crocs, joue déchirée sur le flanc écorché ──
    var O = [0, 0.805, 0.405], dir = [0, -0.193, 0.981], avT = [0, 0.981, 0.193];
    var tete = function (s, h, x) { return [x || 0, O[1] + dir[1] * s + avT[1] * h, O[2] + dir[2] * s + avT[2] * h]; };
    var sT = function (y, z) { return (y - O[1]) * dir[1] + (z - O[2]) * dir[2]; }, hT = function (y, z) { return (y - O[1]) * avT[1] + (z - O[2]) * avT[2]; };
    var OE = [0.116, 0.022, 0.035];                    // œil : s, h, |x|
    var oeil = function (sx) { return tete(OE[0], OE[1], sx * OE[2]); };
    var yeux = [oeil(1), oeil(-1)];
    var masque = mix(peau, [0.012, 0.009, 0.008], 0.55), levre = lin(0x1d1613), gueule = mix(gencive, [0.01, 0.004, 0.004], 0.45);
    function dOeil(s, x, h) { var ds = s - OE[0], dh = h - OE[1], dx = Math.abs(x) - OE[2]; return Math.sqrt(ds * ds + dh * dh + dx * dx); }
    function joue(s, x, h) { return x * cote > 0.02 ? gauss(s - 0.13, 0.02, h + 0.036, 0.011) : 0; }   // joue arrachée (côté écorché)
    var SECT_TETE = [
      // s, centre h, demi-largeur, demi-hauteur, exposant (super-ellipse), resserrement du dessus, évasement des babines
      [0.000, 0.012, 0.040, 0.044, 2.0, 0.0, 0.0], [0.022, 0.009, 0.056, 0.058, 2.1, 0.05, 0.0], [0.050, 0.005, 0.064, 0.064, 2.2, 0.1, 0.0],
      [0.080, 0.001, 0.066, 0.061, 2.3, 0.14, 0.0], [0.106, -0.005, 0.061, 0.056, 2.4, 0.16, 0.02], [0.128, -0.013, 0.050, 0.048, 2.6, 0.2, 0.06],
      [0.155, -0.019, 0.042, 0.044, 2.8, 0.24, 0.1], [0.190, -0.022, 0.037, 0.041, 3.0, 0.26, 0.12], [0.225, -0.022, 0.034, 0.039, 3.0, 0.26, 0.12],
      [0.255, -0.021, 0.031, 0.036, 2.9, 0.24, 0.1], [0.278, -0.018, 0.027, 0.031, 2.7, 0.2, 0.06]
    ];
    F.tube(SECT_TETE.map(function (r) {
      var s = r[0];
      return { c: tete(s, r[1]), rx: r[2], rz: r[3], av: avT,
        poids: function (a) {                                                                                           // commissure : suit en partie la mâchoire
          var km = 0.55 * sm(-0.35, -0.75, Math.sin(a)) * sm(0.085, 0.105, s) * (1 - sm(0.125, 0.16, s));
          return km > 0.01 ? [['tete', 1 - km], ['machoire', km]] : [['tete', 1]];
        },
        deform: function (a) {
          var u = Math.cos(a), w = Math.sin(a), p = r[4], au = Math.abs(u);
          var f = Math.pow(Math.pow(au, p) + Math.pow(Math.abs(w), p), -1 / p);
          var lx = r[2] * u * f * (w > 0 ? 1 - r[5] * w : 1 + r[6] * -w), lh = r[3] * w * f;
          var x = lx, h = r[1] + lh, d = 0;
          var de = dOeil(s, x, h); if (de < 0.026) d -= 0.008 * Math.pow(1 - de / 0.026, 1.5);                         // orbites
          var ds = s - 0.104, dx = Math.abs(x) - 0.041, dh = h - 0.043, db = Math.sqrt(ds * ds + dx * dx + dh * dh);
          if (db < 0.022) d += 0.006 * (1 - db / 0.022) * (1 - db / 0.022);                                             // arcades sourcilières
          d += 0.007 * sm(0.045, 0.07, s) * (1 - sm(0.1, 0.122, s)) * gauss(h + 0.012, 0.009, 0, 1) * sm(0.6, 0.85, au);   // arcades zygomatiques
          d -= 0.005 * sm(0.03, 0.05, s) * (1 - sm(0.095, 0.115, s)) * gauss(h + 0.04, 0.01, 0, 1) * sm(0.5, 0.8, au);     // masséters fondus
          var ft = sm(-0.005, 0.015, s) * (1 - sm(0.07, 0.09, s));
          d -= 0.008 * ft * gauss(w - 0.68, 0.14, 0, 1);                                                               // tempes creuses
          if (w > 0) d += 0.005 * ft * Math.exp(-u * u / 0.016);                                                        // crête sagittale
          if (s > 0.13 && s < 0.2 && w > 0.25) d += 0.0022 * sm(0.13, 0.145, s) * (1 - sm(0.18, 0.2, s)) * Math.pow(Math.sin((s - 0.13) * TAU / 0.0135 + 2.5 * au), 2);   // plis du rictus
          d -= 0.009 * joue(s, x, h);                                                                                   // joue arrachée (creux)
          lx += u * d; lh += w * d;
          if (s > 0.12 && w < -0.5) lh += (-0.004 + 0.011 * gauss(s - 0.215, 0.02, 0, 1) * sm(0.35, 0.75, au)) * sm(-0.5, -0.8, w);   // babines pendantes, retroussées sur les crocs
          var dl = lx - r[2] * u, dh2 = lh - r[3] * w;
          return [dl, avT[1] * dh2, avT[2] * dh2];
        },
        couleur: function (a, x, y, z) {
          var s2 = sT(y, z), h = hT(y, z), w = Math.sin(a), c = decharne(peau, x, y, z);
          c = mix(c, masque, sm(0.13, 0.27, s2) * 0.6);                                                                 // museau plus sombre
          if (w > 0.9 && s2 < 0.09) c = mix(c, peauNue, 0.35);                                                          // crête : peau tendue
          var de = dOeil(s2, x, h); if (de < 0.024) c = mix(c, [0.018, 0.011, 0.009], 0.9 * sm(0.024, 0.016, de));      // orbites sombres
          if (s2 > 0.11 && w < -0.45) c = mix(c, levre, sm(-0.45, -0.68, w));                                            // babines noires
          if (s2 > 0.18 && s2 < 0.25 && w < -0.6) c = mix(c, gencive, 0.8 * gauss(s2 - 0.215, 0.02, 0, 1) * sm(0.3, 0.7, Math.abs(Math.cos(a))));   // gencives découvertes
          if (s2 > 0.12 && w < -0.86) c = mix(c, gueule, sm(-0.86, -0.95, w));                                            // palais
          var j = joue(s2, x, h); if (j > 0.05) c = mix(c, mix(chair, plaie, n(x, y, z, 9, 60)), sm(0.05, 0.5, j));         // joue arrachée
          return c;
        } };
    }), 22, X, avT, { fermerDebut: tete(-0.014, 0.014), fermerFin: tete(0.288, -0.017), inverse: true });
    // truffe (bombée, philtrum) et narines
    F.tube([[0.264, -0.006, 0.016, 0.0125], [0.276, -0.003, 0.0205, 0.0155], [0.288, -0.003, 0.021, 0.0155], [0.297, -0.005, 0.0175, 0.0125], [0.3015, -0.006, 0.011, 0.008]].map(function (r) {
      return { c: tete(r[0], r[1]), rx: r[2], rz: r[3], av: avT, poids: [['tete', 1]],
        deform: function (a) {
          var u = Math.cos(a), w = Math.sin(a), f = Math.pow(Math.pow(Math.abs(u), 2.5) + Math.pow(Math.abs(w), 2.5), -0.4);
          var dl = r[2] * u * (f - 1), dh = r[3] * w * (f - 1) - (w < 0 ? 0.004 * Math.exp(-u * u / 0.025) * -w : 0);   // philtrum
          return [dl, avT[1] * dh, avT[2] * dh];
        },
        couleur: function (a, x, y, z) { return mix(truffe, [0.05, 0.04, 0.038], 0.25 * n(x, y, z, 31, 140)); } };
    }), 14, X, avT, { fermerFin: tete(0.3035, -0.0065), inverse: true });
    [1, -1].forEach(function (sx) {
      var nar = function () { return [0.004, 0.003, 0.003]; };
      F.tube([{ c: tete(0.295, -0.0045, sx * 0.0088), rx: 0.0042, rz: 0.0027, poids: [['tete', 1]], couleur: nar },
        { c: tete(0.3035, -0.005, sx * 0.0092), rx: 0.0038, rz: 0.0024, poids: [['tete', 1]], couleur: nar }], 7, X, avT, { fermerFin: tete(0.3048, -0.005, sx * 0.0093), inverse: true });
    });
    // mâchoire inférieure (os 'machoire') : gouttière de la langue, babine inférieure noire
    var J0 = tete(0.074, -0.046), J1 = tete(0.272, -0.064), avJ = [0, 0.9652, 0.2617];
    var mach = function (t, x, hh) { return [x, J0[1] + (J1[1] - J0[1]) * t + avJ[1] * hh, J0[2] + (J1[2] - J0[2]) * t + avJ[2] * hh]; };
    var SECT_MACH = [[0, 0.046, 0.03], [0.18, 0.042, 0.027], [0.4, 0.036, 0.022], [0.62, 0.031, 0.019], [0.82, 0.026, 0.017], [1, 0.021, 0.015]];
    var rzJ = function (t) { for (var q = 0; q < SECT_MACH.length - 1; q++) if (t <= SECT_MACH[q + 1][0]) return U.lerp(SECT_MACH[q][2], SECT_MACH[q + 1][2], (t - SECT_MACH[q][0]) / (SECT_MACH[q + 1][0] - SECT_MACH[q][0])); return 0.014; };
    F.tube(SECT_MACH.map(function (r) {
      var t = r[0];
      return { c: mach(t, 0, 0), rx: r[1], rz: r[2], av: avJ, poids: t < 0.1 ? [['machoire', 0.7], ['tete', 0.3]] : [['machoire', 1]],
        deform: function (a) {
          var u = Math.cos(a), w = Math.sin(a), f = Math.pow(Math.pow(Math.abs(u), 2.4) + Math.pow(Math.abs(w), 2.4), -1 / 2.4);
          var dl = r[1] * u * (f - 1), dh = r[2] * w * (f - 1);
          if (w > 0) dh -= 0.6 * r[2] * w * Math.pow(Math.max(0, 1 - u * u * 1.6), 1.5);                                 // gouttière
          return [dl, avJ[1] * dh, avJ[2] * dh];
        },
        couleur: function (a, x, y, z) {
          var u = Math.cos(a), w = Math.sin(a), c = mix(decharne(peau, x, y, z), masque, 0.45);
          if (w > 0.2) c = mix(c, levre, sm(0.2, 0.45, w));                                                               // babine inférieure
          if (w > 0.5 && Math.abs(u) < 0.62) c = mix(c, gueule, sm(0.62, 0.45, Math.abs(u)));                             // intérieur de la gueule
          return c;
        } };
    }), 16, X, avJ, { fermerDebut: mach(-0.04, 0, 0), fermerFin: mach(1.035, 0, -0.002), inverse: true });
    F.tube([[0.1, 0.022, 0.006], [0.35, 0.021, 0.0065], [0.6, 0.018, 0.006], [0.82, 0.014, 0.005]].map(function (r) {   // langue
      return { c: mach(r[0], 0, rzJ(r[0]) * 0.4 + 0.002), rx: r[1], rz: r[2], av: avJ, poids: [['machoire', 1]],
        couleur: function (a) { var w = Math.sin(a), u = Math.cos(a); return mix(langue, [0.03, 0.008, 0.007], w > 0 ? 0.35 * Math.exp(-u * u / 0.01) : 0.5); } };
    }), 10, X, avJ, { fermerFin: mach(0.87, 0, rzJ(0.87) * 0.4 + 0.002), inverse: true });
    // dents (haut : os 'tete', bas : 'machoire')
    function dentC(base, pointe, r, os) {
      F.tube([{ c: base, rx: r, rz: r * 0.9, poids: [[os, 1]], couleur: function () { return dent; } }, { c: lerp3(base, pointe, 0.6), rx: r * 0.7, rz: r * 0.65, poids: [[os, 1]], couleur: function () { return dent; } }], 5, X, Z,
        { fermerFin: pointe, inverse: pointe[1] < base[1] });
    }
    [1, -1].forEach(function (sx) {
      dentC(tete(0.212, -0.036, sx * 0.024), tete(0.218, -0.079, sx * 0.0225), 0.0058, 'tete');                            // crocs du haut
      dentC(mach(0.83, sx * 0.0165, 0.004), mach(0.82, sx * 0.018, 0.027), 0.0049, 'machoire');                            // crocs du bas
      for (var k = 0; k < 2; k++) {
        var s2 = 0.148 + k * 0.028;
        dentC(tete(s2, -0.046, sx * 0.0335), tete(s2 + 0.002, -0.061, sx * 0.0335), 0.0042, 'tete');                       // prémolaires
        dentC(mach(0.45 + k * 0.17, sx * 0.029, 0.006), mach(0.45 + k * 0.17, sx * 0.029, 0.018), 0.0037, 'machoire');
      }
      for (var ki = 0; ki < 3; ki++) dentC(tete(0.274 - ki * 0.003, -0.036, sx * (0.0045 + ki * 0.006)), tete(0.276 - ki * 0.003, -0.05, sx * (0.0045 + ki * 0.006)), 0.0028, 'tete');   // incisives
      for (var kj = 0; kj < 2; kj++) dentC(mach(0.975 - kj * 0.02, sx * (0.004 + kj * 0.0065), 0.004), mach(0.98 - kj * 0.02, sx * (0.004 + kj * 0.0065), 0.014), 0.0025, 'machoire');
    });
    [0.118, 0.134].forEach(function (s2) { dentC(tete(s2, -0.044, cote * 0.041), tete(s2 + 0.002, -0.058, cote * 0.041), 0.0048, 'tete'); });   // molaires à nu (joue arrachée)
    // oreilles : une dressée (conque creusée, face interne nue), l'autre arrachée (moignon déchiqueté)
    function vec(a, b) { return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; }
    function unit(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function croix(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function oreille(sx, haut, dechiree) {
      var B = tete(0.03, 0.048, sx * 0.042), Tp = tete(0.0, 0.048 + haut, sx * (0.042 + haut * 0.32));
      var dO = unit(vec(B, Tp)), nO = unit([sx * 0.45, 0.06, 0.89]), lO = unit(croix(nO, dO));
      var secs = dechiree ? [[0, 0.03, 0.0065], [0.55, 0.027, 0.0055], [1, 0.024, 0.0045]] : [[0, 0.031, 0.0068], [0.3, 0.028, 0.0058], [0.6, 0.02, 0.0045], [0.85, 0.009, 0.003], [1, 0.0025, 0.0018]];
      F.tube(secs.map(function (r) {
        var t = r[0];
        return { c: lerp3(B, Tp, t), rx: r[1], rz: r[2], lat: lO, av: nO, poids: [['tete', 1]],
          deform: function (a) {
            var u = Math.cos(a), cup = -0.009 * (1 - u * u) * (1 - 0.7 * t) * (dechiree ? 0.5 : 1), dd = 0;
            if (dechiree && t === 1) dd = -0.013 * (0.5 + 0.3 * Math.sin(a * 5 + 1.7) + 0.2 * Math.sin(a * 13 + 0.4));     // bord déchiqueté
            return [nO[0] * cup + dO[0] * dd, nO[1] * cup + dO[1] * dd, nO[2] * cup + dO[2] * dd];
          },
          couleur: function (a, x, y, z) {
            var w = Math.sin(a), u = Math.cos(a);
            if (dechiree) return t === 1 ? mix(plaie, chair, 0.5 + 0.5 * Math.sin(a * 7)) : t > 0.5 ? mix(decharne(poil, x, y, z), plaie, 0.45) : decharne(poil, x, y, z);
            return w > 0.15 && Math.abs(u) < 0.85 ? mix(mix(peauNue, chair, 0.3), [0.03, 0.02, 0.018], 0.35 + 0.4 * t) : decharne(poil, x, y, z);
          } };
      }), 10, lO, nO, { fermerFin: dechiree ? lerp3(B, Tp, 0.7) : Tp, inverse: true });
    }
    oreille(-cote, 0.105, false);
    oreille(cote, 0.04, true);
    // ── pattes : avant (épaule → coude → carpe → patte), arrière (hanche → grasset → jarret → patte) ──
    ['G', 'D'].forEach(function (S) {
      var sx = S === 'G' ? 1 : -1, P = function (nom) { var q = POS_CHIEN[nom + S]; return [q[0], q[1], q[2]]; };
      // avant
      var S0 = [sx * 0.072, 0.645, 0.228], E = P('coude'), W = P('carpe'), Pa = P('pattAv');
      var secs = [];
      [[0, 0.04, 0.078, [['thorax', 0.6], ['epaule' + S, 0.4]]], [0.3, 0.046, 0.07, [['epaule' + S, 1]]], [0.65, 0.04, 0.052, [['epaule' + S, 1]]], [1, 0.033, 0.038, [['epaule' + S, 0.5], ['coude' + S, 0.5]]]].forEach(function (r) {
        secs.push({ c: lerp3(S0, E, r[0]), rx: r[1], rz: r[2], poids: r[3], deform: r[0] === 1 ? function () { return [0, 0, -0.012]; } : null, couleur: function (a, x, y, z) { return decharne(peau, x, y, z); } });
      });
      [[0.12, 0.031, 0.034, [['coude' + S, 1]]], [0.5, 0.026, 0.028, [['coude' + S, 1]]], [0.92, 0.023, 0.024, [['coude' + S, 0.6], ['carpe' + S, 0.4]]]].forEach(function (r) {
        secs.push({ c: lerp3(E, W, r[0]), rx: r[1], rz: r[2], poids: r[3], couleur: function (a, x, y, z) { return decharne(peau, x, y, z); } });
      });
      [[0.2, 0.019, 0.02, [['carpe' + S, 1]]], [0.75, 0.019, 0.021, [['carpe' + S, 0.6], ['pattAv' + S, 0.4]]]].forEach(function (r) {
        secs.push({ c: lerp3(W, Pa, r[0]), rx: r[1], rz: r[2], poids: r[3], couleur: function (a, x, y, z) { return decharne(peau, x, y, z); } });
      });
      F.tube(secs, 12, X, Z, { fermerDebut: [S0[0], S0[1] + 0.03, S0[2]], inverse: true });
      patte(Pa, 'pattAv' + S, 1.12);
      // arrière
      var H0 = [sx * 0.075, 0.64, -0.35], K = P('genou'), J = P('jarret'), Pr = P('pattAr');
      var secs2 = [];
      [[0, 0.055, 0.1, [['bassin', 0.55], ['hanche' + S, 0.45]]], [0.28, 0.064, 0.1, [['hanche' + S, 1]]], [0.62, 0.052, 0.072, [['hanche' + S, 1]]], [1, 0.04, 0.046, [['hanche' + S, 0.5], ['genou' + S, 0.5]]]].forEach(function (r) {
        secs2.push({ c: lerp3(H0, K, r[0]), rx: r[1], rz: r[2], poids: r[3], couleur: function (a, x, y, z) { return decharne(peau, x, y, z); } });
      });
      [[0.12, 0.035, 0.04, [['genou' + S, 1]]], [0.5, 0.027, 0.033, [['genou' + S, 1]]], [0.94, 0.022, 0.027, [['genou' + S, 0.6], ['jarret' + S, 0.4]]]].forEach(function (r) {
        secs2.push({ c: lerp3(K, J, r[0]), rx: r[1], rz: r[2], poids: r[3], deform: r[0] > 0.9 ? function () { return [0, 0.004, -0.016]; } : null, couleur: function (a, x, y, z) { return decharne(peau, x, y, z); } });
      });
      [[0.18, 0.019, 0.021, [['jarret' + S, 1]]], [0.75, 0.019, 0.02, [['jarret' + S, 0.6], ['pattAr' + S, 0.4]]]].forEach(function (r) {
        secs2.push({ c: lerp3(J, Pr, r[0]), rx: r[1], rz: r[2], poids: r[3], couleur: function (a, x, y, z) { return decharne(peau, x, y, z); } });
      });
      F.tube(secs2, 12, X, Z, { fermerDebut: [H0[0], H0[1] + 0.035, H0[2]], inverse: true });
      patte(Pr, 'pattAr' + S, 1.06);
    });
    function patte(Pp, os, k) {
      // pied compact : coussinet à l'arrière, quatre doigts serrés (sillons), dessous aplati, ongles noirs
      var x0 = Pp[0], z0 = Pp[2];
      F.tube([[-0.03, 0.019, 0.02, 0.028], [-0.012, 0.025, 0.023, 0.024], [0.01, 0.028, 0.02, 0.019], [0.028, 0.026, 0.016, 0.015], [0.042, 0.019, 0.011, 0.011]].map(function (r) {
        var dz = r[0];
        return { c: [x0, r[3], z0 + dz * k], rx: r[1] * k, rz: r[2], poids: [[os, 1]],
          deform: function (a) {
            var u = Math.cos(a), w = Math.sin(a);
            if (w < -0.55) return [0, (-0.55 - w) * r[2] * 0.6, 0];                                                     // dessous aplati
            if (dz < 0.005) return [0, 0, 0];
            var sil = Math.exp(-u * u / 0.008) + Math.exp(-(u - 0.5) * (u - 0.5) / 0.008) + Math.exp(-(u + 0.5) * (u + 0.5) / 0.008);
            var d = -0.0035 * sil * sm(0.005, 0.02, dz) * Math.max(0, w + 0.3);                                         // sillons entre les doigts
            return [u * d, w * d, 0];
          },
          couleur: function (a, x, y, z) { return mix(decharne(peau, x, y, z), boue, 0.45); } };
      }), 12, X, Y, { fermerDebut: [x0, 0.032, z0 - 0.037 * k], fermerFin: [x0, 0.011, z0 + 0.048 * k], inverse: true });
      for (var g = 0; g < 4; g++) {                                                                                        // griffes
        var gx = x0 + (g - 1.5) * 0.0125 * k, base = [gx, 0.012, z0 + 0.041 * k], bout = [gx, 0.002, z0 + 0.057 * k];
        F.tube([{ c: base, rx: 0.0042, rz: 0.0038, poids: [[os, 1]], couleur: function () { return griffe; } }, { c: lerp3(base, bout, 0.5), rx: 0.0028, rz: 0.0028, poids: [[os, 1]], couleur: function () { return griffe; } }], 5, X, Y, { fermerFin: bout, inverse: true });
      }
    }
    // moignon de queue (bout déchiqueté)
    var Q0 = [0, 0.63, -0.47], Q1 = [0, 0.598, -0.585], avQ = [0, 0.965, -0.263];
    F.tube([[0, 0.03, 0.03, [['bassin', 0.3], ['queue', 0.7]]], [0.5, 0.025, 0.026, [['queue', 1]]], [1, 0.02, 0.021, [['queue', 1]]]].map(function (r) {
      return { c: lerp3(Q0, Q1, r[0]), rx: r[1], rz: r[2], av: avQ, poids: r[3], couleur: function (a, x, y, z) { return r[0] === 1 ? chair : decharne(poil, x, y, z); } };
    }), 10, X, avQ, { fermerFin: [0, 0.594, -0.596] });
    return { geo: F.geometrie(THREE, [0, 0.5, 0.05, 1.1]), yeux: yeux };
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // MINI-BOSS (v1.3, API §15) : Le Survolté (fiche N°06, 1,80 m) et L'Irradié (fiche N°04, 1,90 m), d'après les fiches
  // d'Anthony. Squelette du zombie (18 os). Deux maillages skinnés par modèle : le corps (éclairé) et ses parties
  // émissives (cicatrices de foudre, yeux, pustules, bave), rendues sans éclairage ni compression de tons.
  // ════════════════════════════════════════════════════════════════════════════════════════════
  var PAL_SURVOLTE = {
    veste: 0x2E4057, vesteSombre: 0x1d2a3a, bande: 0xC8D1D6, pantalon: 0x363c45, peau: 0xA7B4BE, peauSombre: 0x56626e,
    gant: 0x7A2A20, cuir: 0x5b3b22, cuirSombre: 0x3a2414, botte: 0x241d18, casque: 0xE6E2D6, noir: 0x101114, metal: 0xA9B2B8,
    cheveux: 0x141519, cyan: 0x38D9FF, cuivre: 0xC77B2E, genouillere: 0x17181b, dent: 0xd8d6cc
  };
  var PAL_IRRADIE = {
    combi: 0xD9B526, combiSombre: 0x8C7012, couture: 0x9c7d16, peau: 0x9FA88A, peauSombre: 0x596048, vert: 0x8CFF2E,
    noir: 0x22231F, caoutchouc: 0x141414, verre: 0x66848f, metal: 0x8d8f8a, dent: 0xb9b294, filtre: 0x3b3d3a
  };
  function norm3(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function croix3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function constante(c) { return function () { return c; }; }
  /** Tube fin le long d'une polyligne (câbles, cicatrices, fils, bave) : repère local par section ; r : nombre ou fn(t). */
  function cordon(F, pts, r, couleur, poids, n, fermer) {
    var secs = [], N = pts.length;
    for (var i = 0; i < N; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
      var d = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      var ref = Math.abs(d[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
      var lat = norm3(croix3(ref, d)), av = croix3(lat, d), rr = typeof r === 'function' ? r(i / (N - 1)) : r;
      secs.push({ c: pts[i], rx: rr, rz: rr, lat: lat, av: av, poids: typeof poids === 'function' ? poids(pts[i], i / (N - 1)) : poids,
        couleur: typeof couleur === 'function' ? couleur : constante(couleur) });
    }
    F.tube(secs, n || 5, secs[0].lat, secs[0].av, fermer === false ? {} : { fermerDebut: pts[0], fermerFin: pts[N - 1] });
  }
  /** Insère deux anneaux de part et d'autre de chaque niveau (transition nette des couleurs de sommets) ; sections [p, a, b, …]. */
  function raffiner(secs, niveaux, eps) {
    eps = eps || 0.003;
    var out = secs.map(function (q) { return q.slice(); });
    niveaux.forEach(function (v) {
      [v - eps, v + eps].forEach(function (pp) {
        for (var i = 0; i < out.length - 1; i++) {
          var A = out[i], B = out[i + 1];
          if (pp > Math.min(A[0], B[0]) && pp < Math.max(A[0], B[0])) {
            var t = (pp - A[0]) / (B[0] - A[0]);
            out.splice(i + 1, 0, A.map(function (x, k) { return k === 0 ? pp : x + (B[k] - x) * t; }));
            return;
          }
        }
      });
    });
    return out;
  }
  /** Ellipsoïde fermé (axe Z) : genouillères, pustules, masque, poches. */
  function ellipsoide(F, c, rx, ry, rz, n, couleur, poids, deform) {
    var secs = [], N = 6;
    for (var i = 1; i < N; i++) {
      var u = -1 + 2 * i / N, k = Math.sqrt(1 - u * u);
      secs.push({ c: [c[0], c[1], c[2] + u * rz], rx: rx * k, rz: ry * k, poids: poids, couleur: typeof couleur === 'function' ? couleur : constante(couleur), deform: deform });
    }
    F.tube(secs, n || 10, X, Y, { fermerDebut: [c[0], c[1], c[2] - rz], fermerFin: [c[0], c[1], c[2] + rz], inverse: true });
  }
  /** Tore (anneaux de bretelles, colliers, bourrelets) : centre c, normale nrm, rayon R, section r (fn(θ) possible). */
  function tore(F, c, nrm, R, r, n, couleur, poids, deform) {
    var w = norm3(nrm), u = norm3(croix3(Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], w)), v = croix3(w, u), secs = [], N = 20;
    for (var i = 0; i <= N; i++) {
      var th = i / N * TAU, ct = Math.cos(th), st = Math.sin(th);
      var rad = [u[0] * ct + v[0] * st, u[1] * ct + v[1] * st, u[2] * ct + v[2] * st];
      var rr = typeof r === 'function' ? r(th) : r;
      secs.push({ c: [c[0] + rad[0] * R, c[1] + rad[1] * R, c[2] + rad[2] * R], rx: rr, rz: rr, lat: rad, av: w, poids: poids,
        couleur: typeof couleur === 'function' ? couleur : constante(couleur), deform: deform ? (function (th0) { return function (a, x, y, z) { return deform(th0, a, x, y, z); }; })(th) : null });
    }
    F.tube(secs, n || 6, u, w, {});
  }
  /** Plaque mince (insigne, autocollant) : centre c, normale nrm, demi-tailles l × h, épaisseur e, forme fn(angle) → échelle. */
  function plaque(F, c, nrm, l, h, e, couleur, poids, forme) {
    var n = norm3(nrm), lat = norm3(croix3([0, 1, 0], n)), av = croix3(n, lat), secs = [];
    [-e, e].forEach(function (o) {
      secs.push({ c: [c[0] + n[0] * o, c[1] + n[1] * o, c[2] + n[2] * o], rx: l, rz: h, lat: lat, av: av, poids: poids, couleur: typeof couleur === 'function' ? couleur : constante(couleur),
        deform: forme ? function (a) { var ca = Math.cos(a), sa = Math.sin(a), k = forme(a) - 1; return [(lat[0] * ca * l + av[0] * sa * h) * k, (lat[1] * ca * l + av[1] * sa * h) * k, (lat[2] * ca * l + av[2] * sa * h) * k]; } : null });
    });
    F.tube(secs, 16, lat, av, { fermerDebut: secs[0].c, fermerFin: secs[1].c, inverse: true });
  }
  /** Main en griffes : paume, 4 doigts (écart réglable), pouce, ongles ; o.cMain(x,y,z), o.cOngle, o.ecart (0–1), o.k (taille). */
  function mainGriffes(F, S, po, o) {
    var sx = o.sx != null ? o.sx : (S === 'G' ? 1 : -1), k = o.k || 1, ec = o.ecart || 0, os = o.os || ('main' + S), cm = o.cMain, w = [[os, 1]];
    var m0 = [po[0], po[1] + 0.005, po[2]], mK = [po[0] + sx * (0.006 + 0.012 * ec), po[1] - 0.085 * k, po[2] + 0.012];
    F.tube([[0.0, 0.031, 0.021], [0.35, 0.046, 0.023], [0.75, 0.05, 0.021], [1.0, 0.046, 0.018]].map(function (r) {
      return { c: lerp3(m0, mK, r[0]), rx: r[1] * k, rz: r[2] * k, poids: w, couleur: cm };
    }), 10, X, Z, { inverse: true });
    for (var d = 0; d < 4; d++) {
      var e = (d - 1.5), ox = e * 0.023 * sx * k * (1 + ec * 0.5), L = [0.072, 0.083, 0.079, 0.066][d] * k * (o.long || 1);
      var dl = e * 0.32 * ec * sx;                                                  // éventail des doigts
      var b0 = [mK[0] + ox, mK[1] + 0.004, mK[2]], b1 = [b0[0] + ox * 0.15 + dl * L * 0.6, b0[1] - L * 0.6, b0[2] + 0.012 - 0.006 * ec];
      var b2 = [b1[0] + ox * 0.1 + dl * L * 0.4, b1[1] - L * 0.32, b1[2] + 0.026 - 0.012 * ec];
      F.tube([[b0, 0.0112 * k, 0.0098 * k], [b1, 0.0092 * k, 0.0084 * k], [b2, 0.0062 * k, 0.006 * k]].map(function (r, q) {
        return { c: r[0], rx: r[1], rz: r[2], poids: w, couleur: q === 2 && o.gantNoir ? constante(o.cOngle) : cm };
      }), 6, X, Z, { inverse: true });
      var gp = [b2[0] + (b2[0] - b1[0]) * 0.55, b2[1] + (b2[1] - b1[1]) * 0.55 - 0.004, b2[2] + (b2[2] - b1[2]) * 0.55 + 0.006];
      F.tube([{ c: b2, rx: 0.0058 * k, rz: 0.0052 * k, poids: w, couleur: constante(o.cOngle) }, { c: lerp3(b2, gp, 0.55), rx: 0.0036 * k, rz: 0.0034 * k, poids: w, couleur: constante(o.cOngle) }], 5, X, Z, { fermerFin: gp, inverse: true });
    }
    var t0 = [po[0] - sx * 0.006, po[1] - 0.03 * k, po[2] + 0.022], t1 = [t0[0] - sx * (0.012 + 0.012 * ec), t0[1] - 0.034 * k, t0[2] + 0.03];
    F.tube([[t0, 0.0128 * k, 0.0118 * k], [t1, 0.0088 * k, 0.0085 * k]].map(function (r) { return { c: r[0], rx: r[1], rz: r[2], poids: w, couleur: cm }; }), 6, X, Z, { inverse: true });
    var tp = [t1[0] - sx * 0.006, t1[1] - 0.016, t1[2] + 0.01];
    F.tube([{ c: t1, rx: 0.006 * k, rz: 0.0056 * k, poids: w, couleur: constante(o.cOngle) }, { c: lerp3(t1, tp, 0.5), rx: 0.0038 * k, rz: 0.0036 * k, poids: w, couleur: constante(o.cOngle) }], 5, X, Z, { fermerFin: tp, inverse: true });
  }
  // profil du cou et de la tête (y, demi-largeur, demi-profondeur, décalage z) — repris du zombie
  var PROFIL_TETE = [[1.49, 0.052, 0.055, -0.005], [1.53, 0.054, 0.058, 0.0], [1.555, 0.058, 0.068, 0.02], [1.575, 0.066, 0.08, 0.024], [1.595, 0.072, 0.088, 0.024],
    [1.615, 0.077, 0.095, 0.02], [1.64, 0.082, 0.1, 0.016], [1.66, 0.084, 0.102, 0.013], [1.68, 0.085, 0.104, 0.011], [1.70, 0.085, 0.104, 0.008],
    [1.72, 0.083, 0.101, 0.004], [1.745, 0.078, 0.095, 0.0], [1.77, 0.068, 0.083, -0.004], [1.79, 0.052, 0.064, -0.008], [1.803, 0.03, 0.038, -0.01]];
  function profilTete(y) {
    var T = PROFIL_TETE, i = 0;
    while (i < T.length - 2 && T[i + 1][0] < y) i++;
    var a = T[i], b = T[i + 1], t = U.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  }
  /** Relief du visage (vers l'avant, dz) : orbites, arcades, nez, joues, bouche (o.bouche : ouverture), menton. */
  function traitsVisage(x, yy, o) {
    var ax = Math.abs(x), dz = 0, b = o.bouche || 1;
    dz -= 0.03 * gauss(ax - 0.034, 0.014, yy - 1.668, 0.011);
    dz += (o.arcades || 0.013) * gauss(ax - 0.03, 0.03, yy - 1.692, 0.006);
    var tNez = sm(1.684, 1.628, yy) * sm(1.618, 1.63, yy);
    dz += (0.009 + 0.022 * tNez) * gauss(x, 0.011, 0, 1) * sm(1.615, 1.63, yy) * sm(1.69, 1.675, yy);
    dz -= 0.017 * gauss(ax - 0.053, 0.014, yy - 1.613, 0.012);
    dz -= 0.024 * b * gauss(0, 1, yy - 1.598, 0.0045 * b) * sm(0.034 + 0.008 * b, 0.022, ax);
    dz += 0.008 * gauss(x, 0.02, yy - 1.565, 0.008);
    return dz;
  }
  /** Point de la surface de la tête à la hauteur y, angle a (0 = +X, π/2 = avant), relief compris, décalé de `ecart`. */
  function surfaceTete(y, a, ecart, o) {
    var p = profilTete(y), x = Math.cos(a) * (p[0] * ((o && o.largeur) || 1) + ecart), z = p[2] + Math.sin(a) * (p[1] + ecart);
    if (z > 0.03) z += traitsVisage(x, y, o) * sm(0.03, 0.07, z);
    return [x, y, z];
  }
  /** Cou et tête communs aux mini-boss : couleur(a, x, y, z, info) → [r,g,b] ; o.bouche, o.oreilles. */
  function teteMiniBoss(F, o) {
    var anneaux = [];
    for (var pi = 0; pi < PROFIL_TETE.length; pi++) {
      anneaux.push(PROFIL_TETE[pi]);
      if (pi < PROFIL_TETE.length - 1 && PROFIL_TETE[pi][0] > 1.54 && PROFIL_TETE[pi][0] < 1.75) { var A2 = PROFIL_TETE[pi], B2 = PROFIL_TETE[pi + 1]; anneaux.push([(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2, (A2[2] + B2[2]) / 2, (A2[3] + B2[3]) / 2]); }
    }
    F.tube(anneaux.map(function (r) {
      var y = r[0], w = y < 1.55 ? [['cou', 1]] : y < 1.6 ? [['cou', 1 - sm(1.55, 1.6, y)], ['tete', sm(1.55, 1.6, y)]] : [['tete', 1]];
      return {
        c: [0, y, r[3]], rx: r[1] * (o.largeur || 1), rz: r[2],
        poids: function (a, x, yy, z) {
          if (yy < 1.6 && yy > 1.54 && z > 0.02) { var t = sm(1.6, 1.585, yy) * sm(0.02, 0.06, z); return [['tete', 1 - t], ['machoire', t]]; }
          return w;
        },
        deform: function (a, x, yy, z) {
          var dz = z > 0.03 ? traitsVisage(x, yy, o) * sm(0.03, 0.07, z) : 0, dx = 0;
          if (o.oreilles !== false && Math.abs(z - 0.005) < 0.025 && yy > 1.635 && yy < 1.7) dx = Math.sign(x) * 0.012 * sm(0.07, 0.083, Math.abs(x)) * gauss(0, 1, yy - 1.665, 0.016);
          var d2 = o.deform ? o.deform(a, x, yy, z) : null;
          return d2 ? [dx + d2[0], d2[1], dz + d2[2]] : [dx, 0, dz];
        },
        couleur: o.couleur
      };
    }), 28, X, Z, { fermerFin: [0, 1.81, -0.01] });
  }
  /** Bouche : rangées de dents pointues (os 'tete' en haut, 'machoire' en bas) et intérieur sombre. */
  function dentsMiniBoss(F, couleurDent, k) {
    for (var q = -3; q <= 3; q++) {
      var x = q * 0.0085 * (k || 1), zf = 0.091 - Math.abs(q) * 0.0042;
      var bh = [x, 1.6085, zf - 0.006], ph = [x * 1.02, 1.6005 - (q % 2 ? 0 : 0.003), zf - 0.001];
      F.tube([{ c: bh, rx: 0.0042, rz: 0.0034, poids: [['tete', 1]], couleur: constante(couleurDent) }, { c: lerp3(bh, ph, 0.6), rx: 0.0026, rz: 0.0022, poids: [['tete', 1]], couleur: constante(couleurDent) }], 4, X, Z, { fermerFin: ph, inverse: true });
      var bb = [x, 1.5865, zf - 0.008], pb = [x * 1.02, 1.5935 + (q % 2 ? 0.003 : 0), zf - 0.003];
      F.tube([{ c: bb, rx: 0.0038, rz: 0.003, poids: [['machoire', 1]], couleur: constante(couleurDent) }, { c: lerp3(bb, pb, 0.6), rx: 0.0024, rz: 0.002, poids: [['machoire', 1]], couleur: constante(couleurDent) }], 4, X, Z, { fermerFin: pb });
    }
  }
  /** Zigzag (cicatrice de foudre, fil) entre des points d'ancrage, avec amplitude a et graine. */
  function zigzag(R, ancres, pas, amp) {
    var pts = [];
    for (var i = 0; i < ancres.length - 1; i++) {
      var A = ancres[i], B = ancres[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), n = Math.max(1, Math.round(L / pas));
      for (var k = 0; k < n; k++) {
        var t = k / n, p = lerp3(A, B, t);
        if (k > 0) { p[0] += (R() - 0.5) * amp; p[1] += (R() - 0.5) * amp * 0.5; p[2] += (R() - 0.5) * amp * 0.4; }
        pts.push(p);
      }
    }
    pts.push(ancres[ancres.length - 1].slice());
    return pts;
  }
  /** Point sur un membre (tube de l'os A vers B, rayons rx/rz) : t le long, a autour (0 = +X, π/2 = avant), décalage radial. */
  function surMembre(A, B, t, a, rx, rz, ecart) { var c = lerp3(A, B, t); return [c[0] + Math.cos(a) * (rx + ecart), c[1], c[2] + Math.sin(a) * (rz + ecart)]; }

  // ── Le Survolté (fiche N°06) : électricien de ligne foudroyé ──
  function construireSurvolte(THREE, graine) {
    var R = U.rng(graine), F = new Fabrique(R), G = new Fabrique(R);
    var lin = U.lin, mix = U.melange, P = PAL_SURVOLTE;
    var veste = lin(P.veste), vesteS = lin(P.vesteSombre), bande = lin(P.bande), pant = lin(P.pantalon), peau = lin(P.peau), peauS = lin(P.peauSombre);
    var gant = lin(P.gant), cuir = lin(P.cuir), cuirS = lin(P.cuirSombre), botte = lin(P.botte), casque = lin(P.casque), noir = lin(P.noir), metal = lin(P.metal);
    var chev = lin(P.cheveux), cyan = lin(P.cyan), cyanVif = mix(lin(P.cyan), [1, 1, 1], 0.45), cuivre = lin(P.cuivre), genou = lin(P.genouillere), dent = lin(P.dent);
    var tache = function (x, y, z, s, f) { return U.fbm2((x + z * 0.7) * f + s, (y + x * 0.3) * f + s * 1.3, graine + s, 3); };
    function crasse(c, x, y, z, k) {
      var t = tache(x, y, z, 3, 7);
      c = mix(c, [c[0] * 0.62, c[1] * 0.6, c[2] * 0.58], sm(0.6, 0.8, t) * 0.5 * (k == null ? 1 : k));
      return mix(c, lin(0x3f3527), Math.min(0.7, sm(0.28, 0.0, y) * 0.6));
    }
    function brule(c, x, y, z) { return mix(c, [0.018, 0.018, 0.022], sm(0.7, 0.83, tache(x, y, z, 19, 10)) * 0.75); }   // brûlures de la foudre
    function bretelle(x, y, z) { var ax = Math.abs(x); return z > 0 ? distSeg2(ax, y, 0.072, 1.0, 0.1, 1.45) < 0.016 : distSeg2(ax, y, 0.06, 1.0, 0.092, 1.45) < 0.016; }
    function bandes(y) { return Math.abs(y - 1.355) < 0.021 || Math.abs(y - 1.125) < 0.019; }
    // ── torse : veste de travail bleu nuit, bandes réfléchissantes, fermeture, bretelles ──
    var torse = [[0.80, 0.182, 0.136], [0.88, 0.186, 0.131], [0.95, 0.185, 0.127], [1.03, 0.175, 0.122], [1.12, 0.177, 0.124], [1.2, 0.188, 0.131],
      [1.28, 0.199, 0.137], [1.36, 0.208, 0.135], [1.42, 0.222, 0.126], [1.455, 0.184, 0.11], [1.475, 0.12, 0.09], [1.495, 0.068, 0.066]];
    var poidsTorse = function (y) {
      if (y < 1.0) return [['hanches', 1]];
      if (y < 1.12) { var t = sm(1.0, 1.12, y); return [['hanches', 1 - t], ['colonne', t]]; }
      if (y < 1.22) return [['colonne', 1]];
      if (y < 1.32) { var t2 = sm(1.22, 1.32, y); return [['colonne', 1 - t2], ['poitrine', t2]]; }
      if (y < 1.46) return [['poitrine', 1]];
      var t3 = sm(1.46, 1.5, y); return [['poitrine', 1 - t3], ['cou', t3]];
    };
    F.tube(raffiner(torse, [0.975, 1.106, 1.144, 1.334, 1.376, 1.43]).map(function (r) {
      var y = r[0];
      return {
        c: [0, y, -0.01 - (y > 1.2 ? (y - 1.2) * 0.05 : 0)], rx: r[1], rz: r[2], poids: poidsTorse(y),
        deform: function (a, x, yy, z) { return [0, 0, yy > 1.25 && Math.sin(a) < 0 ? -0.01 : 0]; },
        couleur: function (a, x, yy, z) {
          var ax = Math.abs(x), c = veste;
          if (yy > 1.485) return crasse(mix(peau, peauS, 0.25), x, yy, z);
          if (yy < 0.975) return crasse(pant, x, yy, z);
          if (bandes(yy)) c = bande;
          if (yy > 1.43) c = vesteS;
          if (z > 0.05 && ax < 0.0065 && yy > 1.0) c = vesteS;                              // fermeture éclair
          if (bretelle(x, yy, z)) c = noir;
          c = brule(c, x, yy, z);
          return crasse(c, x, yy, z, 0.7);
        }
      };
    }), 24, X, Z, { fermerDebut: [0, 0.78, -0.01] });
    // col montant ouvert en V
    F.tube([[1.43, 0.118, 0.106], [1.47, 0.104, 0.095], [1.51, 0.094, 0.087], [1.535, 0.091, 0.084]].map(function (r) {
      return { c: [0, r[0], -0.028], rx: r[1], rz: r[2], poids: r[0] < 1.46 ? [['poitrine', 1]] : [['poitrine', 0.5], ['cou', 0.5]],
        deform: function (a) { var s = Math.sin(a); return [0, s > 0.55 ? -0.075 * sm(0.55, 0.95, s) * sm(1.44, 1.5, r[0]) : 0, 0]; },
        couleur: function (a, x, y, z) { return crasse(vesteS, x, y, z, 0.5); } };
    }), 20, X, Z, {});
    F.boite([0, 1.425, 0.126], [0.009, 0.014, 0.004], metal, [['poitrine', 1]]);                         // tirette
    // anneaux des bretelles et insigne (bouclier gris, étincelle cyan)
    [1, -1].forEach(function (sx) { tore(F, [sx * 0.086, 1.25, 0.114], [sx * 0.42, 0, 0.9], 0.016, 0.0042, 6, metal, [['poitrine', 0.6], ['colonne', 0.4]]); });
    plaque(F, [0.128, 1.235, 0.094], [0.6, 0.05, 0.8], 0.024, 0.027, 0.0035, mix(lin(0xA7B4BE), metal, 0.3), [['poitrine', 0.6], ['colonne', 0.4]],
      function (a) { var s = Math.sin(a), c2 = Math.abs(Math.cos(a)); return s > 0 ? Math.pow(Math.pow(c2, 4) + Math.pow(s, 4), -0.25) : 1 - 0.32 * (-s) * (1 - c2 * 0.5); });
    cordon(G, zigzag(R, [[0.118, 1.256, 0.103], [0.13, 1.236, 0.1], [0.136, 1.215, 0.096]], 0.006, 0.008), 0.0016, cyanVif, [['poitrine', 0.6], ['colonne', 0.4]], 4);
    // ── ceinturon à outils, boucle, deux sacoches, outils ──
    F.tube([[0.975, 0.181, 0.127], [1.0, 0.181, 0.127], [1.035, 0.178, 0.125]].map(function (r) { return { c: [0, r[0], -0.01], rx: r[1], rz: r[2], poids: [['hanches', 1]], couleur: function (a, x, y, z) { return crasse(cuir, x, y, z, 0.6); } }; }), 24, X, Z);
    F.boite([0, 1.005, 0.128], [0.027, 0.022, 0.006], metal, [['hanches', 1]]);
    [1, -1].forEach(function (sx) {
      var cx = sx * 0.15, cz = 0.07;
      ellipsoide(F, [cx, 0.915, cz], 0.048, 0.07, 0.045, 10, function (a, x, y, z) { return crasse(y > 0.965 ? cuirS : cuir, x, y, z, 0.8); }, [['hanches', 1]]);
      F.boite([cx, 0.968, cz + 0.01], [0.047, 0.012, 0.043], cuirS, [['hanches', 1]]);                        // rabat
      cordon(F, [[cx + sx * 0.012, 0.97, cz + 0.02], [cx + sx * 0.016, 1.04, cz + 0.026]], 0.0075, sx > 0 ? lin(0xc9a227) : lin(0x8d1d14), [['hanches', 1]], 6);   // manche d'outil
      cordon(F, [[cx - sx * 0.014, 0.97, cz + 0.022], [cx - sx * 0.02, 1.025, cz + 0.03]], 0.005, metal, [['hanches', 1]], 5);
    });
    cordon(F, [[-0.12, 1.035, 0.105], [-0.11, 0.94, 0.118]], 0.004, metal, [['hanches', 1]], 5);                  // tournevis glissé dans la ceinture
    cordon(F, [[-0.135, 1.04, 0.1], [-0.128, 0.955, 0.112]], 0.004, metal, [['hanches', 1]], 5);
    // ── cou, tête (peau gris-bleu, joues creuses, bouche grande ouverte), dents, cheveux dressés ──
    var oTete = { bouche: 1.6, couleur: null };
    oTete.couleur = function (a, x, yy, z) {
      var c = peau, ax = Math.abs(x);
      if (yy < 1.55) return crasse(mix(peau, peauS, sm(0.6, 0.75, tache(x, yy, z, 17, 40)) * 0.6), x, yy, z, 0.5);
      if (z > 0.035) {
        var orb = gauss(ax - 0.034, 0.014, yy - 1.668, 0.011);
        c = mix(c, peauS, sm(0.12, 0.45, orb)); if (orb > 0.62) c = noir;
        var bou = gauss(0, 1, yy - 1.598, 0.0072) * sm(0.046, 0.032, ax);
        if (bou > 0.3) c = mix(noir, lin(0x3a0d0b), 0.25);
        if (gauss(ax - 0.06, 0.02, yy - 1.64, 0.02) > 0.5) c = mix(c, peauS, 0.4);
      }
      if (yy > 1.705) c = mix(c, chev, 0.85);
      c = brule(c, x * 1.3, yy, z);
      return crasse(c, x, yy + 0.4, z, 0.5);
    };
    teteMiniBoss(F, oTete);
    dentsMiniBoss(F, dent, 1.15);
    // cicatrice de foudre (émissive) : du casque, le long de la tempe et de la joue droites, jusqu'au cou
    var cic = [];
    [[1.708, 2.02], [1.69, 2.16], [1.665, 2.3], [1.64, 2.25], [1.615, 2.42], [1.59, 2.55], [1.565, 2.6], [1.54, 2.75], [1.51, 2.9]].forEach(function (p, k) {
      cic.push(surfaceTete(p[0], p[1] + (k % 2 ? 0.07 : -0.05), 0.0025, oTete));
    });
    var pc = function (p) { return p[1] < 1.56 ? [['cou', 1]] : [['tete', 1]]; };
    cordon(G, cic, 0.0021, cyanVif, pc, 4);
    cordon(G, [surfaceTete(1.64, 2.25, 0.0025, oTete), surfaceTete(1.632, 2.05, 0.0025, oTete), surfaceTete(1.62, 1.98, 0.0025, oTete)], 0.0015, cyan, pc, 4);
    cordon(G, [surfaceTete(1.59, 2.55, 0.0025, oTete), surfaceTete(1.575, 2.35, 0.0025, oTete)], 0.0014, cyan, pc, 4);
    // yeux ronds et blancs (émissifs)
    [1, -1].forEach(function (sx) { ellipsoide(G, [sx * 0.034, 1.668, 0.079], 0.0135, 0.0125, 0.011, 10, mix(cyanVif, [1, 1, 1], 0.5), [['tete', 1]]); });
    // cheveux dressés (mèches en pointes sous le casque)
    for (var mh = 0; mh < 30; mh++) {
      var am = PI * 0.66 + mh / 29 * PI * 1.68 + (R() - 0.5) * 0.08, ym = 1.69 + (mh % 3) * 0.009 + R() * 0.006, b0 = surfaceTete(ym, am, -0.004, oTete);
      var dir = norm3([Math.cos(am), 0.2 + R() * 0.45, Math.sin(am) * 0.9]), Lm = 0.022 + R() * 0.03, cb = (R() - 0.5) * 0.012;
      cordon(F, [b0, [b0[0] + dir[0] * Lm * 0.5, b0[1] + dir[1] * Lm * 0.5 + cb, b0[2] + dir[2] * Lm * 0.5], [b0[0] + dir[0] * Lm, b0[1] + dir[1] * Lm + cb * 2, b0[2] + dir[2] * Lm]],
        function (t) { return 0.009 * (1 - t) + 0.0008; }, chev, [['tete', 1]], 5);
    }
    // ── casque de chantier blanc fendu : calotte, nervure, visière, autocollant cyan, fissure ──
    var calotte = [[1.712, 0.119, 0.137], [1.73, 0.118, 0.134], [1.76, 0.112, 0.127], [1.79, 0.1, 0.113], [1.82, 0.077, 0.088], [1.84, 0.042, 0.049]];
    F.tube(calotte.map(function (r) {
      return { c: [0, r[0], -0.008], rx: r[1], rz: r[2], poids: [['tete', 1]],
        deform: function (a) { var ca = Math.cos(a), d = 0.007 * Math.exp(-ca * ca / 0.004) * sm(1.71, 1.74, r[0]); return [ca * d, 0, Math.sin(a) * d]; },
        couleur: function (a, x, y, z) { return crasse(casque, x, y, z, 0.9); } };
    }), 26, X, Z, { fermerFin: [0, 1.848, -0.008] });
    F.tube([[0, 0.119, 0.137, 1.716], [1, 0.152, 0.17, 1.708], [1, 0.154, 0.172, 1.699], [0, 0.118, 0.136, 1.703]].map(function (r, k) {
      return { c: [0, r[3], -0.008], rx: r[1], rz: r[2], poids: [['tete', 1]],
        deform: function (a) { var s = Math.sin(a), e = r[0] * (s > 0 ? 0.045 * s : 0); return [Math.cos(a) * e * 0.4, -0.004 * r[0] * Math.max(0, s), Math.sin(a) * e]; },
        couleur: function (a, x, y, z) { return crasse(casque, x, y, z, 0.9); } };
    }), 26, X, Z, { inverse: true });
    plaque(G, [-0.072, 1.778, 0.082], [-0.66, 0.25, 0.71], 0.017, 0.011, 0.0022, mix(cyan, [0.2, 0.25, 0.3], 0.35), [['tete', 1]], function (a) { var c2 = Math.abs(Math.cos(a)), s2 = Math.abs(Math.sin(a)); return Math.pow(Math.pow(c2, 6) + Math.pow(s2, 6), -1 / 6); });
    var fis = [];
    [[1.715, 1.32], [1.735, 1.22], [1.752, 1.34], [1.772, 1.2], [1.79, 1.3], [1.805, 1.18]].forEach(function (p) {
      var pr = U.clamp((p[0] - 1.712) / (1.84 - 1.712), 0, 1), j = 0;
      while (j < calotte.length - 2 && calotte[j + 1][0] < p[0]) j++;
      var A = calotte[j], B = calotte[j + 1], t = (p[0] - A[0]) / (B[0] - A[0]), rx = A[1] + (B[1] - A[1]) * t, rz = A[2] + (B[2] - A[2]) * t;
      fis.push([Math.cos(p[1]) * (rx + 0.0015), p[0], -0.008 + Math.sin(p[1]) * (rz + 0.0015)]);
    });
    cordon(F, fis, 0.0024, noir, [['tete', 1]], 4);
    // ── bras : manches à bandes réfléchissantes ; main droite gantée de rouge, main gauche nue, câble enroulé ──
    ['G', 'D'].forEach(function (S) {
      var sx = S === 'G' ? 1 : -1, ep = POS['bras' + S], co = POS['avantBras' + S], po = POS['main' + S], nue = S === 'G', secs = [];
      var RB = raffiner([[-0.115, 0.03, 0.031], [-0.095, 0.056, 0.058], [-0.065, 0.071, 0.074], [-0.03, 0.078, 0.081], [0.0, 0.08, 0.083], [0.15, 0.077, 0.08], [0.5, 0.07, 0.072], [0.85, 0.064, 0.066], [1.0, 0.061, 0.063]], [0.722, 0.889]);
      RB.forEach(function (r) {
        var c = lerp3(ep, co, r[0]); c[0] += sx * 0.008;
        var w = r[0] < 0.12 ? [['poitrine', 0.35], ['bras' + S, 0.65]] : r[0] > 0.85 ? [['bras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['avantBras' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['bras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) {
          var c2 = Math.abs(r[0] - 0.75) < 0.001 || (y > 1.19 && y < 1.235) ? bande : veste;
          if (y > 1.39) c2 = mix(veste, vesteS, 0.4);
          return crasse(brule(c2, x, y, z), x, y, z, 0.7);
        } });
      });
      var RA = raffiner([[0.08, 0.063, 0.065], [0.4, 0.058, 0.058], [0.75, 0.05, 0.048], [0.9, 0.047, 0.045], [0.95, 0.04, 0.038], [1.0, 0.037, 0.034]], [0.86, 0.89, 0.93]);
      RA.forEach(function (r) {
        var c = lerp3(co, po, r[0]);
        var w = r[0] < 0.2 ? [['bras' + S, 0.3], ['avantBras' + S, 0.7]] : r[0] > 0.85 ? [['avantBras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.6], ['main' + S, sm(0.85, 1.0, r[0]) * 0.6]] : [['avantBras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) {
          var c2 = r[0] > 0.86 ? vesteS : veste;                                                              // poignet élastique
          if (r[0] > 0.93) c2 = nue ? mix(peau, peauS, 0.3) : gant;
          if (!nue && r[0] > 0.89) c2 = gant;                                                                   // manchette du gant
          return crasse(brule(c2, x, y, z), x, y, z, 0.7);
        } });
      });
      var cap = lerp3(ep, co, -0.125); cap[0] += sx * 0.008;
      F.tube(secs, 14, X, Z, { fermerDebut: cap, inverse: true });
      // manchette évasée du gant rouge
      if (!nue) F.tube([[0.82, 0.052, 0.05], [0.9, 0.057, 0.055], [0.97, 0.045, 0.043]].map(function (r) {
        return { c: lerp3(co, po, r[0]), rx: r[1], rz: r[2], poids: [['avantBras' + S, 0.6], ['main' + S, 0.4]], couleur: function (a, x, y, z) { return crasse(gant, x, y, z, 0.6); } };
      }), 14, X, Z, { inverse: true });
      mainGriffes(F, S, po, { k: 1.08, ecart: 0.95, cMain: function (a, x, y, z) { return crasse(nue ? brule(mix(peau, peauS, 0.25), x * 2, y, z) : gant, x, y, z, 0.6); }, cOngle: lin(0x0e0c0c), gantNoir: false });
      // cicatrices / courant le long du bord extérieur de la manche (émissif)
      var aExt = sx > 0 ? 0 : PI, pw = function (p, t) { return p[1] > co[1] ? [['bras' + S, 1]] : [['avantBras' + S, 1]]; };
      var pb = [];
      for (var kb = 0; kb <= 9; kb++) { var tb = 0.05 + kb / 9 * 0.9, rr = U.lerp(0.081, 0.064, tb); pb.push(surMembre(ep, co, tb, aExt + (kb % 2 ? 0.2 : -0.16) * sx, rr + sx * 0, U.lerp(0.084, 0.066, tb), 0.002)); pb[pb.length - 1][0] += sx * 0.008; }
      for (var ka = 1; ka <= 8; ka++) { var ta = ka / 8 * 0.85, ra = U.lerp(0.063, 0.05, ta); pb.push(surMembre(co, po, ta, aExt + (ka % 2 ? 0.22 : -0.18) * sx, ra, U.lerp(0.065, 0.048, ta), 0.002)); }
      cordon(G, pb, 0.0034, cyanVif, pw, 4);
      cordon(G, [pb[3], surMembre(ep, co, 0.42, aExt + 0.6 * sx, 0.075, 0.077, 0.002), surMembre(ep, co, 0.5, aExt + 0.95 * sx, 0.074, 0.076, 0.002)], 0.0016, cyan, pw, 4);
      if (nue) {
        // câble noir enroulé sur l'avant-bras gauche, extrémité dénudée (fils de cuivre)
        var hel = [];
        for (var kh = 0; kh <= 44; kh++) {
          var th = kh / 44, ang = th * 4.6 * TAU, tt = U.lerp(0.28, 0.78, th), rh = U.lerp(0.061, 0.051, tt) + 0.011;
          var ch = lerp3(co, po, tt); hel.push([ch[0] + Math.cos(ang) * rh, ch[1], ch[2] + Math.sin(ang) * (rh - 0.002)]);
        }
        var bout = hel[hel.length - 1], sortie = [bout[0] + 0.045, bout[1] - 0.012, bout[2] + 0.03];
        hel.push(sortie);
        cordon(F, hel, 0.0085, noir, [['avantBras' + S, 1]], 6);
        for (var kf = 0; kf < 4; kf++) {
          var af = kf / 4 * TAU + 0.4, tip = [sortie[0] + 0.022 + Math.cos(af) * 0.01, sortie[1] - 0.006 + Math.sin(af) * 0.012, sortie[2] + 0.012 + Math.sin(af * 2) * 0.008];
          cordon(F, [sortie, lerp3(sortie, tip, 0.5), tip], 0.0016, cuivre, [['avantBras' + S, 1]], 4);
        }
      }
    });
    // ── jambes : pantalon de travail, genouillères, bandes réfléchissantes, chaussures de sécurité ──
    ['G', 'D'].forEach(function (S) {
      var sx = S === 'G' ? 1 : -1, hi = POS['cuisse' + S], ge = POS['tibia' + S], ch = POS['pied' + S], secs = [];
      raffiner([[0.0, 0.098, 0.1], [0.3, 0.088, 0.091], [0.7, 0.074, 0.076], [1.0, 0.067, 0.069]], [0.769, 0.826]).forEach(function (r) {
        var c = lerp3(hi, ge, r[0]);
        var w = r[0] < 0.1 ? [['hanches', 0.5], ['cuisse' + S, 0.5]] : r[0] > 0.85 ? [['cuisse' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['tibia' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['cuisse' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) { return crasse(brule(Math.abs(y - 0.585) < 0.012 ? genou : pant, x, y, z), x, y, z); } });
      });
      raffiner([[0.12, 0.066, 0.069], [0.45, 0.063, 0.068], [0.62, 0.062, 0.066], [0.8, 0.064, 0.07], [0.86, 0.072, 0.08], [1.0, 0.068, 0.078]], [0.542, 0.639, 0.711]).forEach(function (r) {
        var c = lerp3(ge, ch, r[0]);
        var w = r[0] < 0.2 ? [['cuisse' + S, 0.3], ['tibia' + S, 0.7]] : r[0] > 0.9 ? [['tibia' + S, 0.6], ['pied' + S, 0.4]] : [['tibia' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) {
          if (y < 0.205) return crasse(botte, x, y, z);
          var c2 = Math.abs(y - 0.255) < 0.02 ? bande : pant;
          return crasse(brule(c2, x, y, z), x, y, z);
        } });
      });
      F.tube(secs, 14, X, Z, { inverse: true });
      ellipsoide(F, [ge[0] + sx * 0.004, 0.54, ge[2] + 0.058], 0.06, 0.066, 0.03, 12, function (a, x, y, z) { return crasse(mix(genou, metal, sm(0.95, 1.0, Math.sin(a)) * 0.1), x, y, z, 0.6); }, [['cuisse' + S, 0.35], ['tibia' + S, 0.65]]);
      // courant le long de la jambe (émissif)
      var aE = sx > 0 ? 0 : PI, pj = [];
      for (var kj = 0; kj <= 9; kj++) { var tj = 0.08 + kj / 9 * 0.88; pj.push(surMembre(hi, ge, tj, aE + (kj % 2 ? 0.18 : -0.14) * sx, U.lerp(0.097, 0.068, tj), U.lerp(0.099, 0.07, tj), 0.002)); }
      for (var kt = 1; kt <= 7; kt++) { var tt2 = kt / 7 * 0.7; pj.push(surMembre(ge, ch, tt2, aE + (kt % 2 ? 0.2 : -0.16) * sx, 0.066, 0.069, 0.002)); }
      cordon(G, pj, 0.0034, cyanVif, function (p) { return p[1] > ge[1] ? [['cuisse' + S, 1]] : [['tibia' + S, 1]]; }, 4);
      // chaussure de sécurité (coque, semelle épaisse)
      var talon = [ch[0], 0.064, ch[2] - 0.08], bout = [ch[0], 0.05, ch[2] + 0.19];
      F.tube([[0.0, 0.058, 0.06], [0.25, 0.064, 0.066], [0.7, 0.06, 0.05], [0.9, 0.05, 0.04], [1.0, 0.036, 0.028]].map(function (r) {
        var c = lerp3(talon, bout, r[0]); c[1] = 0.064 - r[0] * 0.016;
        return { c: c, rx: r[1], rz: r[2], lat: X, av: Y, poids: [['pied' + S, 1]], couleur: function (a, x, y, z) { return crasse(y < 0.018 ? lin(0x0b0908) : botte, x, y, z); } };
      }), 12, X, Y, { fermerDebut: [talon[0], 0.064, talon[2] - 0.012], fermerFin: [bout[0], 0.044, bout[2] + 0.016], inverse: true });
    });
    return { geo: F.geometrie(THREE), geoEmissif: G.geometrie(THREE), yeux: [[0.034, 1.668, 0.08], [-0.034, 1.668, 0.08]], couleur: P.cyan, hauteur: 1.8 };
  }

  // ── L'Irradié (fiche N°04) : technicien de centrale en combinaison jaune ──
  function construireIrradie(THREE, graine) {
    var R = U.rng(graine), F = new Fabrique(R), G = new Fabrique(R);
    var lin = U.lin, mix = U.melange, P = PAL_IRRADIE;
    var combi = lin(P.combi), combiS = lin(P.combiSombre), couture = lin(P.couture), peau = lin(P.peau), peauS = lin(P.peauSombre), vert = lin(P.vert);
    var vertVif = mix(vert, [1, 1, 1], 0.2), noir = lin(P.noir), cao = lin(P.caoutchouc), verre = lin(P.verre), metal = lin(P.metal), dent = lin(P.dent), filtre = lin(P.filtre);
    var tache = function (x, y, z, s, f) { return U.fbm2((x + z * 0.7) * f + s, (y + x * 0.3) * f + s * 1.3, graine + s, 3); };
    function salir(c, x, y, z, k) {                       // taches brunes de la combinaison, crasse en bas
      var t = tache(x, y, z, 5, 6);
      c = mix(c, combiS, sm(0.62, 0.7, t) * 0.8 * (k == null ? 1 : k));
      c = mix(c, [c[0] * 0.7, c[1] * 0.68, c[2] * 0.6], sm(0.55, 0.8, tache(x, y, z, 9, 15)) * 0.35);
      return mix(c, lin(0x3a3424), Math.min(0.6, sm(0.4, 0.0, y) * 0.6));
    }
    function plis(a, y, f, amp) { return amp * Math.sin(y * f + Math.sin(a * 3) * 1.2) * (0.5 + 0.5 * Math.sin(a * 5 + y * 7)); }
    // ── torse massif ──
    var torse = [[0.80, 0.205, 0.152], [0.88, 0.21, 0.152], [0.95, 0.206, 0.15], [1.03, 0.2, 0.147], [1.12, 0.21, 0.152], [1.2, 0.222, 0.16],
      [1.28, 0.232, 0.165], [1.36, 0.24, 0.161], [1.42, 0.252, 0.15], [1.455, 0.218, 0.13], [1.475, 0.152, 0.107], [1.495, 0.075, 0.07]];
    var poidsTorse = function (y) {
      if (y < 1.0) return [['hanches', 1]];
      if (y < 1.12) { var t = sm(1.0, 1.12, y); return [['hanches', 1 - t], ['colonne', t]]; }
      if (y < 1.22) return [['colonne', 1]];
      if (y < 1.32) { var t2 = sm(1.22, 1.32, y); return [['colonne', 1 - t2], ['poitrine', t2]]; }
      if (y < 1.46) return [['poitrine', 1]];
      var t3 = sm(1.46, 1.5, y); return [['poitrine', 1 - t3], ['cou', t3]];
    };
    F.tube(torse.map(function (r) {
      var y = r[0];
      return {
        c: [0, y, -0.012 - (y > 1.2 ? (y - 1.2) * 0.05 : 0)], rx: r[1], rz: r[2], poids: poidsTorse(y),
        deform: function (a, x, yy, z) {
          var d = plis(a, yy, 38, 0.004);
          return [Math.cos(a) * d, 0, Math.sin(a) * d + (yy > 1.25 && Math.sin(a) < 0 ? -0.01 : 0)];
        },
        couleur: function (a, x, yy, z) {
          var ax = Math.abs(x), c = combi;
          if (yy > 1.485) return mix(peau, peauS, 0.3);
          if (z > 0.08 && ax < 0.006 && yy > 0.98) c = couture;                                                // fermeture
          if (z < -0.02 && ax < 0.004) c = couture;
          if (Math.abs(Math.cos(a)) > 0.985) c = couture;                                                       // coutures latérales
          return salir(c, x, yy, z);
        }
      };
    }), 26, X, Z, { fermerDebut: [0, 0.78, -0.012] });
    // capuche rabattue autour du cou (bourrelet épais, plus gros derrière)
    tore(F, [0, 1.495, -0.035], [0, 1, 0.12], 0.098, function (th) { return 0.034 + 0.018 * Math.max(0, -Math.cos(th)) + 0.004 * Math.sin(th * 5); }, 10,
      function (a, x, y, z) { return salir(combi, x, y, z, 0.6); }, [['poitrine', 0.5], ['cou', 0.5]]);
    // ceinture noire et passants gris
    F.tube([[0.985, 0.209, 0.153], [1.0, 0.21, 0.154], [1.04, 0.205, 0.151]].map(function (r) { return { c: [0, r[0], -0.012], rx: r[1], rz: r[2], poids: [['hanches', 1]], couleur: function (a, x, y, z) { return mix(noir, [0.1, 0.1, 0.09], tache(x, y, z, 2, 30) * 0.3); } }; }), 26, X, Z);
    [1, -1].forEach(function (sx) { F.boite([sx * 0.112, 1.012, 0.138], [0.026, 0.026, 0.008], metal, [['hanches', 1]]); });
    // masque à gaz pendu sur la poitrine : corps en caoutchouc, deux oculaires (l'un fendu), cartouche filtrante, sangle
    var MZ = 0.162;
    ellipsoide(F, [0, 1.318, MZ], 0.07, 0.062, 0.034, 14, function (a, x, y, z) { return mix(cao, [0.08, 0.08, 0.08], sm(0.6, 0.8, tache(x, y, z, 31, 40)) * 0.5); }, [['poitrine', 1]]);
    [1, -1].forEach(function (sx) {
      ellipsoide(F, [sx * 0.031, 1.33, MZ + 0.026], 0.021, 0.02, 0.007, 14, function (a, x, y, z) { return sx > 0 && Math.abs(x - 0.031 - (y - 1.33) * 0.4) < 0.002 ? [0.6, 0.65, 0.66] : verre; }, [['poitrine', 1]]);
      tore(F, [sx * 0.031, 1.33, MZ + 0.028], [0, 0, 1], 0.021, 0.0038, 6, cao, [['poitrine', 1]]);
    });
    F.tube([[0, 0.031, 0.031], [0.3, 0.034, 0.034], [0.55, 0.031, 0.031], [0.8, 0.034, 0.034], [1, 0.03, 0.03]].map(function (r) {
      return { c: [0, 1.272 - r[0] * 0.05, MZ + 0.03 + r[0] * 0.006], rx: r[1], rz: r[1] * 0.85, poids: [['poitrine', 1]], couleur: function (a, x, y, z) { return mix(filtre, metal, Math.sin(y * 260) > 0.4 ? 0.35 : 0); } };
    }), 12, X, Z, { fermerDebut: [0, 1.274, MZ + 0.03], fermerFin: [0, 1.218, MZ + 0.036], inverse: true });
    [1, -1].forEach(function (sx) { cordon(F, [[sx * 0.066, 1.34, MZ - 0.005], [sx * 0.085, 1.42, 0.06], [sx * 0.072, 1.5, -0.01], [sx * 0.03, 1.535, -0.09]], 0.006, cao, [['poitrine', 1]], 5, false); });
    // ── cou et tête : crâne chauve gris-vert, yeux verts, bouche ouverte, pustules, veines et bave émissives ──
    var oTete = { bouche: 1.35, arcades: 0.017, largeur: 1.04, couleur: null };
    oTete.couleur = function (a, x, yy, z) {
      var c = mix(peau, peauS, sm(0.55, 0.8, tache(x, yy, z, 13, 25)) * 0.45), ax = Math.abs(x);
      if (z > 0.035) {
        var orb = gauss(ax - 0.034, 0.014, yy - 1.668, 0.011);
        c = mix(c, peauS, sm(0.15, 0.5, orb)); if (orb > 0.66) c = [0.02, 0.025, 0.012];
        var bou = gauss(0, 1, yy - 1.598, 0.0062) * sm(0.042, 0.03, ax);
        if (bou > 0.32) c = mix([0.02, 0.03, 0.01], vert, 0.08);
        if (gauss(ax - 0.06, 0.02, yy - 1.64, 0.02) > 0.5) c = mix(c, peauS, 0.35);
      }
      return c;
    };
    teteMiniBoss(F, oTete);
    dentsMiniBoss(F, dent, 1.0);
    var pT = function (p) { return p[1] < 1.56 ? [['cou', 1]] : [['tete', 1]]; };
    [1, -1].forEach(function (sx) { ellipsoide(G, [sx * 0.034, 1.668, 0.078], 0.014, 0.0105, 0.01, 10, vertVif, [['tete', 1]]); });
    // pustules : grappe sur la tempe gauche, petites sur le front et la joue droite
    [[1.705, 0.55, 0.019], [1.678, 0.35, 0.015], [1.655, 0.22, 0.012], [1.735, 1.25, 0.008], [1.62, 2.3, 0.009], [1.7, 1.95, 0.007]].forEach(function (p) {
      var c = surfaceTete(p[0], p[1], p[2] * 0.25, oTete), rr = p[2];
      ellipsoide(G, c, rr, rr, rr * 0.75, 10, function (a, x, y, z) { return mix(vertVif, [0.2, 0.35, 0.05], 0.25 * Math.max(0, -Math.sin(a))); }, [['tete', 1]]);
      tore(F, [c[0], c[1], c[2]], [c[0], 0.0, c[2] + 0.02], rr * 0.95, rr * 0.28, 5, peauS, [['tete', 1]]);
    });
    // veines vertes (front, joue, cou)
    [[[1.75, 1.15], [1.722, 1.3], [1.7, 1.18], [1.685, 1.32]], [[1.645, 2.1], [1.625, 2.25], [1.6, 2.15], [1.58, 2.3]], [[1.56, 1.4], [1.535, 1.5], [1.51, 1.38]]].forEach(function (L) {
      cordon(G, L.map(function (p) { return surfaceTete(p[0], p[1], 0.002, oTete); }), 0.0016, mix(vert, [0.1, 0.2, 0.05], 0.2), pT, 4);
    });
    // bave verte qui coule de la bouche
    [[0.012, 0.055], [-0.016, 0.04]].forEach(function (b) {
      var p0 = [b[0], 1.592, 0.09], pts = [p0, [b[0] * 1.05, 1.575, 0.093], [b[0] * 1.1, 1.555, 0.092], [b[0] * 1.12, 1.592 - b[1], 0.088]];
      cordon(G, pts, function (t) { return 0.0042 - t * 0.0016 + (t > 0.9 ? 0.0012 : 0); }, vertVif, [['machoire', 1]], 6);
    });
    // ── bras massifs : manches jaunes ; main droite gantée de noir, main gauche nue (gant arraché) ──
    ['G', 'D'].forEach(function (S) {
      var sx = S === 'G' ? 1 : -1, ep = POS['bras' + S], co = POS['avantBras' + S], po = POS['main' + S], nue = S === 'G', secs = [];
      [[-0.13, 0.034, 0.035], [-0.108, 0.066, 0.068], [-0.075, 0.086, 0.088], [-0.035, 0.095, 0.097], [0.0, 0.098, 0.1], [0.15, 0.093, 0.095], [0.5, 0.085, 0.087], [0.85, 0.08, 0.082], [1.0, 0.078, 0.08]].forEach(function (r) {
        var c = lerp3(ep, co, r[0]); c[0] += sx * 0.03;
        var w = r[0] < 0.12 ? [['poitrine', 0.35], ['bras' + S, 0.65]] : r[0] > 0.85 ? [['bras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['avantBras' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['bras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, deform: function (a, x, y, z) { var d = plis(a, y, 45, 0.004); return [Math.cos(a) * d, 0, Math.sin(a) * d]; },
          couleur: function (a, x, y, z) { return salir(Math.abs(Math.cos(a)) > 0.985 ? couture : combi, x, y, z); } });
      });
      [[0.08, 0.08, 0.082], [0.4, 0.077, 0.078], [0.72, 0.071, 0.07], [0.84, 0.068, 0.066], [0.88, 0.058, 0.056], [1.0, 0.05, 0.047]].forEach(function (r) {
        var c = lerp3(co, po, r[0]); c[0] += sx * 0.026 * (1 - r[0]);
        var w = r[0] < 0.2 ? [['bras' + S, 0.3], ['avantBras' + S, 0.7]] : r[0] > 0.85 ? [['avantBras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.6], ['main' + S, sm(0.85, 1.0, r[0]) * 0.6]] : [['avantBras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, deform: function (a, x, y, z) { var d = plis(a, y, 50, 0.0035); return [Math.cos(a) * d, 0, Math.sin(a) * d]; },
          couleur: function (a, x, y, z) {
            if (r[0] > 0.86) return nue ? mix(peau, peauS, 0.35) : cao;
            return salir(combi, x, y, z);
          } });
      });
      var capI = lerp3(ep, co, -0.142); capI[0] += sx * 0.03;
      F.tube(secs, 14, X, Z, { fermerDebut: capI, inverse: true });
      // manchette noire : gant entier à droite, lambeau déchiqueté à gauche
      F.tube([[0.8, 0.07, 0.068], [0.87, 0.075, 0.072], [0.93, nue ? 0.064 : 0.062, nue ? 0.062 : 0.06]].map(function (r, k) {
        var c = lerp3(co, po, r[0]); c[0] += sx * 0.026 * (1 - r[0]);
        return { c: c, rx: r[1], rz: r[2], poids: [['avantBras' + S, 0.7], ['main' + S, 0.3]],
          deform: nue && k === 2 ? function (a) { return [0, 0.018 * (0.5 + 0.5 * Math.sin(a * 6 + 1.1)) * (0.6 + 0.4 * Math.sin(a * 11)), 0]; } : null,
          couleur: function (a, x, y, z) { return mix(cao, [0.06, 0.06, 0.06], tache(x, y, z, 51, 40) * 0.4); } };
      }), 14, X, Z, { inverse: true });
      mainGriffes(F, S, po, { k: 1.18, ecart: 0.35, long: 1.12, cMain: function (a, x, y, z) { return nue ? mix(peau, peauS, sm(0.5, 0.8, tache(x, y, z, 61, 60)) * 0.5) : mix(cao, [0.07, 0.07, 0.07], tache(x, y, z, 7, 50) * 0.5); }, cOngle: nue ? lin(0x1d1f12) : lin(0x0b0b0b), gantNoir: !nue });
      if (nue) {
        [[0.0, 0.02, 0.012], [0.035, -0.012, 0.01], [0.06, 0.016, 0.008]].forEach(function (p) {
          ellipsoide(G, [po[0] + sx * (0.03 + p[1] * 0.3), po[1] - 0.03 - p[0], po[2] + 0.02 + p[1]], p[2], p[2], p[2] * 0.7, 8, vertVif, [['main' + S, 1]]);
        });
        cordon(G, [[po[0] + sx * 0.03, po[1] + 0.06, po[2] + 0.045], [po[0] + sx * 0.036, po[1] + 0.02, po[2] + 0.04], [po[0] + sx * 0.03, po[1] - 0.02, po[2] + 0.034], [po[0] + sx * 0.04, po[1] - 0.06, po[2] + 0.03]], 0.0015, mix(vert, [0.1, 0.2, 0.05], 0.2), [['main' + S, 1]], 4);
        cordon(G, [[po[0] + sx * 0.02, po[1] - 0.1, po[2] + 0.03], [po[0] + sx * 0.021, po[1] - 0.135, po[2] + 0.031], [po[0] + sx * 0.02, po[1] - 0.16, po[2] + 0.03]], function (t) { return 0.003 - t * 0.001; }, vertVif, [['main' + S, 1]], 5);
      }
    });
    // trous déchirés dans la combinaison (poitrine droite, cuisse droite) : peau grise à pustules, bord sombre effiloché
    function pointTorse(x, y) {
      var i = 0; while (i < torse.length - 2 && torse[i + 1][0] < y) i++;
      var A = torse[i], B = torse[i + 1], t = U.clamp((y - A[0]) / (B[0] - A[0]), 0, 1), rx = A[1] + (B[1] - A[1]) * t, rz = A[2] + (B[2] - A[2]) * t;
      var cz = -0.012 - (y > 1.2 ? (y - 1.2) * 0.05 : 0), ca = U.clamp(x / rx, -0.99, 0.99), sa = Math.sqrt(1 - ca * ca);
      return { p: [x, y, cz + rz * sa], n: norm3([ca / rx, 0, sa / rz]) };
    }
    function dechirure(c, n, l, h, poids, gr, pustules) {
      var Rd = U.rng(gr), bosses = [];
      for (var k = 0; k < 9; k++) bosses.push(0.8 + Rd() * 0.4);
      var forme = function (a) { var u = a / TAU * 9, i0 = Math.floor(u) % 9, f = u - Math.floor(u); return U.lerp(bosses[i0], bosses[(i0 + 1) % 9], f) * (1 + 0.1 * Math.sin(a * 13)); };
      var off = function (o) { return [c[0] + n[0] * o, c[1] + n[1] * o, c[2] + n[2] * o]; };
      plaque(F, off(0.0016), n, l * 1.2, h * 1.2, 0.0011, mix(combiS, [0.03, 0.025, 0.01], 0.55), poids, function (a) { return forme(a + 0.3); });
      plaque(F, off(0.0032), n, l, h, 0.0011, function (a, x, y, z) { return mix(peau, peauS, sm(0.35, 0.75, tache(x, y, z, 23, 70)) * 0.65); }, poids, forme);
      var lat = norm3(croix3([0, 1, 0], n));
      pustules.forEach(function (q) {
        var pc = [c[0] + lat[0] * q[0] * l + n[0] * 0.004, c[1] + q[1] * h, c[2] + lat[2] * q[0] * l + n[2] * 0.004];
        ellipsoide(G, pc, q[2], q[2], q[2] * 0.7, 8, vertVif, poids);
      });
      return off(0.004);
    }
    var tp = pointTorse(-0.095, 1.19);
    var cTrou = dechirure(tp.p, tp.n, 0.05, 0.043, [['colonne', 0.5], ['poitrine', 0.5]], 71, [[-0.2, 0.25, 0.012], [0.35, 0.1, 0.009], [-0.3, -0.3, 0.008], [0.2, -0.35, 0.006], [0.0, 0.0, 0.007]]);
    cordon(G, [[cTrou[0] + 0.004, cTrou[1] - 0.03, cTrou[2] + 0.001], [cTrou[0] + 0.005, cTrou[1] - 0.06, cTrou[2] + 0.003], [cTrou[0] + 0.004, cTrou[1] - 0.1, cTrou[2] + 0.002], [cTrou[0] + 0.005, cTrou[1] - 0.13, cTrou[2] + 0.0]],
      function (t) { return 0.0035 - t * 0.0012 + (t > 0.9 ? 0.0015 : 0); }, vertVif, [['colonne', 1]], 5);
    var ac = 0.5 * PI + 0.45, hiD = [POS.cuisseD[0] - 0.012, POS.cuisseD[1], POS.cuisseD[2]], geD = [POS.tibiaD[0] - 0.012, POS.tibiaD[1], POS.tibiaD[2]];
    var cc = lerp3(hiD, geD, 0.667), rxC = 0.095, rzC = 0.093;
    dechirure([cc[0] + Math.cos(ac) * rxC, 0.64, cc[2] + Math.sin(ac) * rzC], norm3([Math.cos(ac) / rxC, 0, Math.sin(ac) / rzC]), 0.042, 0.037, [['cuisseD', 1]], 72, [[-0.25, 0.2, 0.011], [0.3, -0.1, 0.008], [-0.1, -0.35, 0.007]]);
    // ── jambes massives dans de hautes bottes noires ──
    ['G', 'D'].forEach(function (S) {
      var sx = S === 'G' ? 1 : -1, hi = POS['cuisse' + S], ge = POS['tibia' + S], ch = POS['pied' + S], secs = [];
      var hi2 = [hi[0] + sx * 0.012, hi[1], hi[2]], ge2 = [ge[0] + sx * 0.012, ge[1], ge[2]];
      [[0.0, 0.112, 0.112], [0.3, 0.106, 0.104], [0.7, 0.094, 0.092], [1.0, 0.088, 0.088]].forEach(function (r) {
        var c = lerp3(hi2, ge2, r[0]);
        var w = r[0] < 0.1 ? [['hanches', 0.5], ['cuisse' + S, 0.5]] : r[0] > 0.85 ? [['cuisse' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['tibia' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['cuisse' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, deform: function (a, x, y, z) { var d = plis(a, y, 40, 0.004); return [Math.cos(a) * d, 0, Math.sin(a) * d]; },
          couleur: function (a, x, y, z) {
            return salir(Math.abs(Math.cos(a)) > 0.985 ? couture : combi, x, y, z);
          } });
      });
      [[0.12, 0.088, 0.09], [0.4, 0.082, 0.086], [0.62, 0.079, 0.083], [0.66, 0.088, 0.093], [0.72, 0.087, 0.092], [0.85, 0.08, 0.088], [1.0, 0.076, 0.086]].forEach(function (r) {
        var c = lerp3(ge2, ch, r[0]);
        var w = r[0] < 0.2 ? [['cuisse' + S, 0.3], ['tibia' + S, 0.7]] : r[0] > 0.9 ? [['tibia' + S, 0.6], ['pied' + S, 0.4]] : [['tibia' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, deform: r[0] < 0.6 ? function (a, x, y, z) { var d = plis(a, y, 42, 0.0035); return [Math.cos(a) * d, 0, Math.sin(a) * d]; } : null,
          couleur: function (a, x, y, z) {
            if (r[0] > 0.63) return mix(cao, [0.07, 0.07, 0.065], tache(x, y, z, 3, 30) * 0.5);                // botte haute
            return salir(combi, x, y, z);
          } });
      });
      F.tube(secs, 14, X, Z, { inverse: true });
      var talon = [ch[0] + sx * 0.004, 0.066, ch[2] - 0.085], bout = [ch[0] + sx * 0.004, 0.052, ch[2] + 0.2];
      F.tube([[0.0, 0.066, 0.064], [0.25, 0.072, 0.07], [0.7, 0.068, 0.054], [0.9, 0.057, 0.042], [1.0, 0.04, 0.03]].map(function (r) {
        var c = lerp3(talon, bout, r[0]); c[1] = 0.066 - r[0] * 0.016;
        return { c: c, rx: r[1], rz: r[2], lat: X, av: Y, poids: [['pied' + S, 1]], couleur: function (a, x, y, z) { return y < 0.02 ? lin(0x070707) : mix(cao, [0.07, 0.07, 0.065], tache(x, y, z, 3, 30) * 0.5); } };
      }), 12, X, Y, { fermerDebut: [talon[0], 0.066, talon[2] - 0.012], fermerFin: [bout[0], 0.046, bout[2] + 0.016], inverse: true });
    });
    return { geo: F.geometrie(THREE), geoEmissif: G.geometrie(THREE), yeux: [[0.034, 1.668, 0.08], [-0.034, 1.668, 0.08]], couleur: P.vert, hauteur: 1.9,
      insigne: { position: [0.132, 1.335, 0.121], normale: [0.43, 0.05, 0.9], rayon: 0.043 } };
  }
  /** Insigne radioactif (disque crème, trèfle noir) : texture de canevas. */
  function texInsigneRadioactif(THREE, C) {
    var W = 128, cv = U.canvas(W, W), g = cv.getContext('2d'), c = W / 2;
    g.fillStyle = '#efe6cc'; g.beginPath(); g.arc(c, c, c - 2, 0, TAU); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#2a2620'; g.stroke();
    g.fillStyle = '#16130f';
    g.beginPath(); g.arc(c, c, W * 0.085, 0, TAU); g.fill();
    for (var k = 0; k < 3; k++) {
      var a0 = -PI / 2 + k * TAU / 3 - PI / 6, a1 = a0 + PI / 3;
      g.beginPath(); g.arc(c, c, W * 0.41, a0, a1); g.arc(c, c, W * 0.13, a1, a0, true); g.closePath(); g.fill();
    }
    var t = U.tex(THREE, C, cv, { clamp: true });
    return t;
  }
  // ── Le Démembré (fiche N°02, v1.4) : colosse de 1,95 m, bras gauche arraché à l'épaule, pendu par des tendons ──
  // Squelette du zombie + 3 os pour le bras détaché (pendule simulé à chaque image par le module) ; le bras et la chaîne de
  // tendons (mélange 'poitrine' → 'brasLibre') font partie du même maillage skinné que le corps.
  var OS_LIBRE = [['brasLibre', 'poitrine', 0.33, 1.16, -0.02], ['avantBrasLibre', 'brasLibre', 0.35, 0.9, -0.02], ['mainLibre', 'avantBrasLibre', 0.365, 0.65, 0.0]];
  var OS_DEMEMBRE = OS.concat(OS_LIBRE);
  var IDX_DEMEMBRE = {}; OS_DEMEMBRE.forEach(function (o, i) { IDX_DEMEMBRE[o[0]] = i; });
  var POS_DEMEMBRE = {}; OS_DEMEMBRE.forEach(function (o) { POS_DEMEMBRE[o[0]] = [o[2], o[3], o[4]]; });
  var ATTACHE_TENDONS = [0.252, 1.35, -0.015];              // bas du moignon, où partent les tendons (repère du modèle)
  var PAL_DEMEMBRE = {
    peau: 0x8E9A7C, peauSombre: 0x5f6a52, debardeur: 0x9B968A, debardeurSombre: 0x6e695f, pantalon: 0x6B5D3F, pantalonSombre: 0x463b26,
    botte: 0x2A211B, semelle: 0x14100D, lacet: 0x5A4A3D, os: 0xE6D3A3, chair: 0xA33138, chairSombre: 0x5E1219, tendon: 0xE0A39B,
    sang: 0x7A0F17, sangSombre: 0x4A070C, hematome: 0x5D4A66, crasse: 0x7C776A, ceinture: 0x3B2E22, boucle: 0x9A8F7A,
    dent: 0xD9CBA6, griffe: 0x2A1D16, oeil: 0xF6E7A6, bouche: 0x1C0B0A, orbite: 0x120A09
  };
  /** Ellipsoïde orienté selon l'axe n (moignon, os, cervelle) : demi-axe rn le long de n, r1/r2 en travers. */
  function ellipsoideAxe(F, c, n, rn, r1, r2, nSeg, couleur, poids, deform) {
    var w = norm3(n), u = norm3(croix3(Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], w)), v = croix3(w, u), secs = [], N = 6;
    for (var i = 1; i < N; i++) {
      var q = -1 + 2 * i / N, k = Math.sqrt(1 - q * q);
      secs.push({ c: [c[0] + w[0] * q * rn, c[1] + w[1] * q * rn, c[2] + w[2] * q * rn], rx: r1 * k, rz: r2 * k, lat: u, av: v, poids: poids, couleur: typeof couleur === 'function' ? couleur : constante(couleur), deform: deform });
    }
    F.tube(secs, nSeg || 12, u, v, { fermerDebut: [c[0] - w[0] * rn, c[1] - w[1] * rn, c[2] - w[2] * rn], fermerFin: [c[0] + w[0] * rn, c[1] + w[1] * rn, c[2] + w[2] * rn], inverse: true });
  }
  function construireDemembre(THREE, graine) {
    var R = U.rng(graine), F = new Fabrique(R, IDX_DEMEMBRE), G = new Fabrique(R, IDX_DEMEMBRE);
    var lin = U.lin, mix = U.melange, P = PAL_DEMEMBRE, PD = POS_DEMEMBRE;
    // la salle est éclairée chaud (torches, accents rouges) : les teintes de la fiche sont légèrement refroidies pour que la peau
    // se lise gris-vert, le débardeur gris et le pantalon kaki (et non beige, rose et orangé)
    function teinte(c, k) { return [c[0] * k[0], c[1] * k[1], c[2] * k[2]]; }
    var peau = teinte(lin(P.peau), [0.8, 1.0, 0.8]), peauS = teinte(lin(P.peauSombre), [0.8, 1.0, 0.82]), deb = teinte(lin(P.debardeur), [0.8, 0.9, 1.0]), debS = teinte(lin(P.debardeurSombre), [0.84, 0.92, 1.0]);
    var pant = teinte(lin(P.pantalon), [0.86, 0.98, 1.0]), pantS = teinte(lin(P.pantalonSombre), [0.88, 0.98, 1.0]);
    var botte = lin(P.botte), semelle = lin(P.semelle), lacet = lin(P.lacet), osC = lin(P.os), chair = lin(P.chair), chairS = lin(P.chairSombre), tendon = lin(P.tendon);
    var sang = lin(P.sang), sangS = lin(P.sangSombre), hema = lin(P.hematome), crasse = lin(P.crasse), cein = lin(P.ceinture), boucle = lin(P.boucle);
    var dent = lin(P.dent), griffe = lin(P.griffe), oeil = lin(P.oeil), bouche = lin(P.bouche), orbite = lin(P.orbite), noir = [0.012, 0.01, 0.009];
    var tache = function (x, y, z, s, f) { return U.fbm2((x + z * 0.7) * f + s, (y + x * 0.3) * f + s * 1.3, graine + s, 3); };
    // hématomes violacés placés (centre, rayon) + marbrures de la peau
    var BLEUS = [[-0.33, 1.25, 0.02, 0.05], [-0.06, 1.6, 0.075, 0.022], [0.37, 0.8, 0.06, 0.04], [0.16, 1.42, 0.12, 0.035], [-0.2, 1.43, -0.12, 0.05], [-0.37, 0.98, 0.03, 0.03]];
    function cPeau(x, y, z, k) {
      var c = mix(peau, peauS, sm(0.5, 0.8, tache(x, y, z, 13, 20)) * 0.55 * (k == null ? 1 : k));
      c = mix(c, [c[0] * 0.82, c[1] * 0.85, c[2] * 0.8], sm(0.6, 0.85, tache(x, y, z, 5, 55)) * 0.5);
      for (var b = 0; b < BLEUS.length; b++) {
        var B = BLEUS[b], d = Math.hypot(x - B[0], y - B[1], z - B[2]) / B[3];
        if (d < 1.4) c = mix(c, hema, sm(1.25, 0.55 + 0.25 * tache(x, y, z, 37 + b, 40), d) * 0.85);
      }
      return c;
    }
    function plis(a, y, f, amp) { return amp * Math.sin(y * f + Math.sin(a * 3) * 1.2) * (0.5 + 0.5 * Math.sin(a * 5 + y * 7)); }

    // ── torse de colosse : ventre, poitrail, épaule gauche affaissée (côté moignon) ──
    var TORSE = [[0.8, 0.226, 0.176], [0.87, 0.234, 0.182], [0.94, 0.24, 0.19], [1.0, 0.244, 0.198], [1.06, 0.248, 0.203], [1.12, 0.256, 0.2],
      [1.19, 0.268, 0.194], [1.26, 0.282, 0.188], [1.32, 0.294, 0.182], [1.37, 0.3, 0.173], [1.41, 0.296, 0.159], [1.44, 0.274, 0.143],
      [1.465, 0.224, 0.125], [1.485, 0.156, 0.102], [1.5, 0.096, 0.086]];
    function profilTorse(y) {
      var i = 0; while (i < TORSE.length - 2 && TORSE[i + 1][0] < y) i++;
      var A = TORSE[i], B = TORSE[i + 1], t = U.clamp((y - A[0]) / (B[0] - A[0]), 0, 1);
      return [A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
    }
    function czTorse(y) { return -0.015 - (y > 1.2 ? (y - 1.2) * 0.06 : 0); }
    function deformTorse(a, x, y, z) {
      var ca = Math.cos(a), sa = Math.sin(a), av = Math.max(0, sa);
      var dz = 0.026 * Math.pow(av, 1.5) * gauss(0, 1, y - 1.04, 0.075);                                   // ventre
      dz += 0.013 * av * av * gauss(0, 1, y - 1.31, 0.05) * (1 - 0.7 * gauss(x, 0.035, 0, 1));             // pectoraux
      var gauche = Math.max(0, ca), dy = -0.036 * sm(0.04, 0.22, x) * sm(1.3, 1.46, y);                  // épaule affaissée
      var dx = -0.03 * Math.pow(gauche, 4) * sm(1.28, 1.36, y) * sm(1.5, 1.42, y);                          // pas de deltoïde à gauche
      return [ca * (dz * 0.15) + dx, dy, sa * dz];
    }
    function surfaceTorse(a, y, ecart) {
      var pr = profilTorse(y), x = Math.cos(a) * (pr[0] + ecart), z = czTorse(y) + Math.sin(a) * (pr[1] + ecart), d = deformTorse(a, x, y, z);
      return [x + d[0], y + d[1], z + d[2]];
    }
    var poidsTorse = function (y) {
      if (y < 1.0) return [['hanches', 1]];
      if (y < 1.12) { var t = sm(1.0, 1.12, y); return [['hanches', 1 - t], ['colonne', t]]; }
      if (y < 1.22) return [['colonne', 1]];
      if (y < 1.32) { var t2 = sm(1.22, 1.32, y); return [['colonne', 1 - t2], ['poitrine', t2]]; }
      if (y < 1.47) return [['poitrine', 1]];
      var t3 = sm(1.47, 1.505, y); return [['poitrine', 1 - t3], ['cou', t3]];
    };
    // peau du torse (visible au décolleté, aux emmanchures et au dos) ; pantalon sous la ceinture
    var anneauxT = raffiner(TORSE.map(function (r) { return r.slice(); }), [0.975], 0.004);
    F.tube(anneauxT.map(function (r) {
      var y = r[0];
      return { c: [0, y, czTorse(y)], rx: r[1], rz: r[2], poids: poidsTorse(y),
        deform: function (a, x, yy, z) { var d = deformTorse(a, x, yy, z), p = y < 0.98 ? plis(a, yy, 40, 0.004) : 0; return [d[0] + Math.cos(a) * p, d[1], d[2] + Math.sin(a) * p]; },
        couleur: function (a, x, yy, z) {
          if (yy < 0.975) return mix(pant, pantS, sm(0.55, 0.8, tache(x, yy, z, 3, 12)) * 0.6);
          var c = cPeau(x, yy, z);
          if (x > 0.1 && yy > 1.25 && z > -0.1) c = mix(c, sang, sm(0.1, 0.24, x) * sm(1.25, 1.36, yy) * 0.75);   // sang sous le moignon
          return c;
        } };
    }), 30, X, Z, { fermerDebut: [0, 0.78, -0.015] });
    // ── débardeur : couche au-dessus de la peau, bord supérieur découpé (encolure en U, bretelles, emmanchures profondes) ──
    var BORD = [[0, 1.265], [22, 1.33], [36, 1.452], [52, 1.452], [64, 1.395], [90, 1.335], [116, 1.395], [128, 1.452], [144, 1.452], [158, 1.33], [180, 1.265],
      [202, 1.33], [216, 1.458], [232, 1.458], [252, 1.43], [270, 1.405], [288, 1.43], [308, 1.458], [324, 1.458], [338, 1.33], [360, 1.265]];
    function bordDebardeur(a) {
      var d = ((a * 180 / PI) % 360 + 360) % 360, i = 0;
      while (i < BORD.length - 2 && BORD[i + 1][0] < d) i++;
      var A = BORD[i], B = BORD[i + 1], t = (d - A[0]) / (B[0] - A[0]); t = t * t * (3 - 2 * t);
      return A[1] + (B[1] - A[1]) * t;
    }
    function sangDebardeur(x, y, z) {
      if (x < -0.03) return 0;
      var b = 0.05 * (tache(x, y, z, 41, 16) - 0.5);
      var grande = sm(1.1 + b, 1.2 + b, y) * sm(0.02 + b, 0.11, x) * (z > -0.09 ? 1 : 0.35);                         // grande tache sous le moignon
      var coul = sm(0.66, 0.74, 0.5 + 0.5 * Math.sin(x * 130 + tache(x, 0, z, 7, 5) * 7)) * sm(0.98, 1.04, y) * (1 - sm(1.12, 1.2, y)) * sm(0.05, 0.12, x) * sm(0.25, 0.17, x) * (z > 0 ? 1 : 0);
      return U.clamp(grande + coul, 0, 1);
    }
    var NIV_DEB = [0, 0.1, 0.22, 0.34, 0.46, 0.57, 0.67, 0.76, 0.84, 0.9, 0.945, 0.975, 1.0], Y_OURLET = 0.972, NDEB = 72, precD = -1;
    NIV_DEB.forEach(function (s, iN) {
      var a0 = F.anneau([0, 0, 0], X, Z, 1, 1, NDEB,
        function (a, x, y, z) {
          var c = mix(deb, debS, sm(0.45, 0.85, tache(x, y, z, 17, 9)) * 0.3);
          c = mix(c, crasse, sm(0.5, 0.65, tache(x, y, z, 19, 7)) * gauss(x + 0.12, 0.07, y - 1.06, 0.05) * 1.4 * (z > 0 ? 1 : 0));        // tache de crasse (ventre droit)
          c = mix(c, [c[0] * 0.8, c[1] * 0.78, c[2] * 0.75], sm(0.35, 0.0, y - Y_OURLET) * 0.5);                                  // bas sali
          var sg = sangDebardeur(x, y, z); if (sg > 0) c = mix(c, mix(sang, sangS, sm(0.6, 1.0, tache(x, y, z, 23, 30)) * 0.5), sg * 0.94);
          if (s > 0.965 || s < 0.02) c = mix(c, debS, 0.45);                                                                     // ourlets
          return c;
        },
        function (a, x, y, z) { return poidsTorse(y); }, s,
        function (a, x, y, z) {
          var yy = Y_OURLET + (bordDebardeur(a) - Y_OURLET) * s, p = surfaceTorse(a, yy, 0.0065 + (s < 0.03 ? 0.002 : 0));
          var pl = plis(a, yy, 34, 0.0025) * (1 - s);
          return [p[0] + Math.cos(a) * pl - x, p[1] - y, p[2] + Math.sin(a) * pl - z];
        });
      if (precD >= 0) F.relier(precD, a0, NDEB, false);
      precD = a0;
    });
    // bretelles par-dessus les épaules (bande plate qui suit la surface)
    [1, -1].forEach(function (sx) {
      var secs = [], N = 9;
      for (var i = 0; i <= N; i++) {
        var u = i / N, aDeg = sx > 0 ? 44 - u * 88 : 136 + u * 88, a = aDeg * PI / 180, y = 1.452 + 0.034 * Math.sin(PI * u) - (sx > 0 ? 0.0 : 0.0);
        var p = surfaceTorse(a, y, 0.0085 + 0.004 * Math.sin(PI * u));
        secs.push(p);
      }
      var sec2 = secs.map(function (p, i) {
        var a = secs[Math.max(0, i - 1)], b = secs[Math.min(secs.length - 1, i + 1)], T = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        var nrm = norm3([p[0], (p[1] - 1.42) * 2.2, p[2] - czTorse(p[1])]), lat = norm3(croix3(nrm, T));
        return { c: p, rx: 0.019, rz: 0.0032, lat: lat, av: nrm, poids: [['poitrine', 1]], couleur: function (a2, x, y, z) { return mix(sx > 0 ? mix(deb, sang, 0.75) : deb, debS, 0.25); } };
      });
      F.tube(sec2, 8, sec2[0].lat, sec2[0].av, {});
    });
    // trous dans le débardeur : peau meurtrie (bord sombre effiloché)
    function trou(aDeg, y, l, h, gr, bleu) {
      var a = aDeg * PI / 180, c = surfaceTorse(a, y, 0.0072), n = norm3([Math.cos(a), 0, Math.sin(a) * 1.15]), Rd = U.rng(gr), bosses = [];
      for (var k = 0; k < 9; k++) bosses.push(0.78 + Rd() * 0.44);
      var forme = function (q) { var u = q / TAU * 9, i0 = Math.floor(u) % 9, f = u - Math.floor(u); return U.lerp(bosses[i0], bosses[(i0 + 1) % 9], f) * (1 + 0.1 * Math.sin(q * 13)); };
      var off = function (o) { return [c[0] + n[0] * o, c[1] + n[1] * o, c[2] + n[2] * o]; };
      plaque(F, off(0.001), n, l * 1.3, h * 1.3, 0.0008, mix(debS, noir, 0.72), poidsTorse(y), function (q) { return forme(q + 0.3); });
      plaque(F, off(0.0022), n, l, h, 0.0008, function (q, x, yy, z) { var cc = cPeau(x, yy, z); return bleu ? mix(cc, hema, sm(0.95, 0.2, Math.hypot(x - c[0], yy - c[1]) / l) * 0.85) : cc; }, poidsTorse(y), forme);
    }
    trou(108, 1.235, 0.036, 0.032, 81, true);
    trou(72, 1.07, 0.031, 0.026, 82, false);
    // ceinture et boucle
    F.tube([[0.958, 0.0], [0.965, 0.011], [0.998, 0.012], [1.006, 0.0]].map(function (r) {
      var pr = profilTorse(r[0]);
      return { c: [0, r[0], czTorse(r[0])], rx: pr[0] + 0.004 + r[1], rz: pr[1] + 0.004 + r[1], poids: [['hanches', 1]], deform: function (a, x, y, z) { var d = deformTorse(a, x, y, z); return [d[0], 0, d[2]]; },
        couleur: function (a, x, y, z) { return mix(cein, [0.03, 0.025, 0.02], tache(x, y, z, 2, 30) * 0.4); } };
    }), 30, X, Z);
    var pb = surfaceTorse(PI / 2, 0.982, 0.018);
    F.boite([0, 0.982, pb[2] + 0.004], [0.027, 0.021, 0.006], boucle, [['hanches', 1]]);
    F.boite([0, 0.982, pb[2] + 0.0105], [0.015, 0.011, 0.0015], cein, [['hanches', 1]]);

    // ── cou épais (blessure à gauche) et tête : crâne chauve, plaie ouverte, points de suture, œil crevé, mâchoire béante ──
    var COU = [[1.43, 0.112, 0.097, -0.026], [1.465, 0.1, 0.09, -0.021], [1.505, 0.087, 0.082, -0.013], [1.54, 0.077, 0.076, -0.007], [1.572, 0.069, 0.07, -0.001]];
    F.tube(COU.map(function (r) {
      var y = r[0], w = y < 1.47 ? [['poitrine', 1]] : y < 1.53 ? [['poitrine', 1 - sm(1.47, 1.53, y)], ['cou', sm(1.47, 1.53, y)]] : [['cou', 0.75], ['tete', 0.25]];
      return { c: [0, y, r[3]], rx: r[1], rz: r[2], poids: w, deform: function (a, x, yy, z) { return [0, -0.02 * sm(0.03, 0.09, x) * sm(1.43, 1.5, yy) * (1 - sm(1.5, 1.57, yy)), 0]; },
        couleur: function (a, x, yy, z) {
          var c = cPeau(x, yy, z);
          if (z > 0.02 && Math.abs(x) < 0.05) c = mix(c, sang, sm(0.45, 0.75, tache(x, yy, z, 61, 25)) * 0.8 * sm(1.48, 1.55, yy));   // sang du menton
          return c;
        } };
    }), 26, X, Z);
    // plaie du cou (gauche) : chair à vif, trachée claire
    plaque(F, [0.058, 1.502, 0.049], [0.72, 0.05, 0.7], 0.02, 0.014, 0.0014, function (a, x, y, z) { return mix(chairS, chair, 0.25 + 0.5 * sm(0.4, 0.8, tache(x, y, z, 63, 90))); }, [['poitrine', 0.4], ['cou', 0.6]],
      function (q) { return 1 + 0.22 * Math.sin(q * 5 + 0.4) + 0.12 * Math.sin(q * 11); });
    var oTete = { bouche: 1.8, arcades: 0.024, largeur: 1.14, couleur: null };
    oTete.couleur = function (a, x, yy, z) {
      var c = cPeau(x, yy, z, 0.8), ax = Math.abs(x);
      if (z > 0.03) {
        var orb = gauss(ax - 0.034, 0.014, yy - 1.668, 0.011);
        if (x < 0) { c = mix(c, peauS, sm(0.12, 0.5, orb)); if (orb > 0.62) c = [0.03, 0.025, 0.02]; }
        else { c = mix(c, mix(chairS, orbite, 0.5), sm(0.1, 0.42, orb)); if (orb > 0.45) c = orbite; if (gauss(x - 0.036, 0.015, yy - 1.652, 0.004) > 0.5) c = chair; }   // œil gauche crevé
        var bou = gauss(0, 1, yy - 1.598, 0.0068) * sm(0.046, 0.031, ax);
        if (bou > 0.28) c = bouche;
        var joue = gauss(x - 0.056, 0.012, yy - 1.6, 0.014);                                                            // joue gauche déchirée
        if (joue > 0.4 && z > 0.05) c = mix(chair, chairS, sm(0.6, 1.0, tache(x, yy, z, 71, 120)) * 0.6);
        if (yy < 1.585 && ax < 0.04) c = mix(c, sang, sm(0.4, 0.7, tache(x, yy, z, 73, 30)) * 0.7);                     // sang du menton
      }
      if (yy > 1.755 && x > 0.012 && x < 0.075 && z > -0.05) {                                                          // plaie du crâne
        var pl = gauss(x - 0.045, 0.02, yy - 1.775, 0.018) * gauss(z - 0.01, 0.035, 0, 1);
        c = mix(c, chairS, sm(0.15, 0.35, pl));
      }
      return c;
    };
    teteMiniBoss(F, oTete);
    dentsMiniBoss(F, dent, 1.18);
    // cervelle à vif dans la plaie du crâne (replis roses), bourrelet sombre autour
    var pCr = [0.044, 1.789, 0.006];
    ellipsoideAxe(F, pCr, [0.35, 1, 0.1], 0.016, 0.036, 0.03, 16, function (a, x, y, z) { return Math.sin(a * 7 + x * 260) > 0.25 ? mix(tendon, chair, 0.35) : chair; }, [['tete', 1]]);
    tore(F, [pCr[0] - 0.002, pCr[1] - 0.006, pCr[2]], [0.35, 1, 0.1], 0.036, 0.007, 6, chairS, [['tete', 1]]);
    // points de suture sur le front (côté droit)
    var su = [[1.742, 0.62 * PI], [1.752, 0.7 * PI], [1.758, 0.78 * PI], [1.76, 0.86 * PI]].map(function (q) { return surfaceTete(q[0], q[1], 0.0015, oTete); });
    cordon(F, su, 0.0016, noir, [['tete', 1]], 4, false);
    [0.66, 0.74, 0.82].forEach(function (aa) {
      var p0 = surfaceTete(1.742, aa * PI, 0.0018, oTete), p1 = surfaceTete(1.764, (aa + 0.03) * PI, 0.0018, oTete);
      cordon(F, [p0, lerp3(p0, p1, 0.5), p1], 0.0012, noir, [['tete', 1]], 4, false);
    });
    // chair à vif de la joue gauche (dents visibles)
    var pJ = surfaceTete(1.6, 0.27 * PI, 0.002, oTete);
    plaque(F, pJ, [0.62, -0.05, 0.78], 0.016, 0.019, 0.0013, function (a, x, y, z) { return mix(chair, chairS, sm(0.3, 0.9, tache(x, y, z, 75, 140))); }, [['tete', 0.5], ['machoire', 0.5]],
      function (q) { return 1 + 0.2 * Math.sin(q * 4 + 1) + 0.12 * Math.sin(q * 9); });
    [-0.006, 0.0, 0.006].forEach(function (o, i) { var b0 = [pJ[0] - 0.004 + o * 0.3, pJ[1] + o, pJ[2] + 0.004]; cordon(F, [b0, [b0[0] + 0.006, b0[1] - 0.001, b0[2] + 0.002]], 0.0022, dent, [['tete', i < 2 ? 1 : 0.4], ['machoire', i < 2 ? 0 : 0.6]], 4); });
    // sang qui coule de la mâchoire
    [[0.012, 0.07, 0.0042], [-0.014, 0.05, 0.0036], [0.026, 0.035, 0.003]].forEach(function (b) {
      var p0 = [b[0], 1.575, 0.088], pts = [p0, [b[0] * 1.05, 1.56, 0.091], [b[0] * 1.08, 1.54, 0.09], [b[0] * 1.1, 1.575 - b[1], 0.086]];
      cordon(F, pts, function (t) { return b[2] - t * 0.0012 + (t > 0.9 ? 0.0014 : 0); }, sang, [['machoire', 1]], 5);
    });
    // œil droit : lueur pâle (émissif) ; œil gauche crevé (orbite sombre, rien d'émissif)
    ellipsoide(G, [-0.034, 1.668, 0.077], 0.0135, 0.0098, 0.009, 10, oeil, [['tete', 1]]);
    ellipsoide(G, [-0.033, 1.668, 0.0855], 0.0042, 0.0042, 0.0015, 8, [0.25, 0.17, 0.02], [['tete', 1]]);

    // ── bras droit : massif, ecchymoses, griffures, main en griffes ──
    (function () {
      var S = 'D', sx = -1, ep = POS['bras' + S], co = POS['avantBras' + S], po = POS['main' + S], secs = [];
      [[-0.14, 0.042, 0.044], [-0.115, 0.082, 0.084], [-0.08, 0.106, 0.108], [-0.04, 0.117, 0.119], [0.0, 0.119, 0.121], [0.15, 0.112, 0.114], [0.5, 0.1, 0.102], [0.85, 0.09, 0.092], [1.0, 0.087, 0.089]].forEach(function (r) {
        var c = lerp3(ep, co, r[0]); c[0] += sx * 0.055;
        var w = r[0] < 0.12 ? [['poitrine', 0.35], ['bras' + S, 0.65]] : r[0] > 0.85 ? [['bras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['avantBras' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['bras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) { return cPeau(x, y, z); } });
      });
      [[0.08, 0.089, 0.091], [0.4, 0.086, 0.087], [0.72, 0.077, 0.076], [0.86, 0.069, 0.066], [0.93, 0.061, 0.057], [1.0, 0.053, 0.05]].forEach(function (r) {
        var c = lerp3(co, po, r[0]); c[0] += sx * 0.034 * (1 - r[0]);
        var w = r[0] < 0.2 ? [['bras' + S, 0.3], ['avantBras' + S, 0.7]] : r[0] > 0.85 ? [['avantBras' + S, 1 - sm(0.85, 1.0, r[0]) * 0.6], ['main' + S, sm(0.85, 1.0, r[0]) * 0.6]] : [['avantBras' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) {
          var cc = cPeau(x, y, z), gr = Math.abs(y - (1.08 - (x + 0.3) * 0.6)) < 0.006 || Math.abs(y - (1.05 - (x + 0.3) * 0.6)) < 0.005;   // griffures
          return gr && z > 0.0 && y > 0.98 && y < 1.12 ? mix(cc, chair, 0.85) : cc;
        } });
      });
      var capI = lerp3(ep, co, -0.155); capI[0] += sx * 0.055;
      F.tube(secs, 16, X, Z, { fermerDebut: capI, inverse: true });
      mainGriffes(F, S, [po[0] + sx * 0.0, po[1], po[2]], { k: 1.36, ecart: 0.55, long: 1.15, cMain: function (a, x, y, z) { return cPeau(x, y, z, 0.7); }, cOngle: griffe });
    })();

    // ── moignon de l'épaule gauche : chair arrachée, clavicule à nu, bourrelet de peau déchirée ──
    var MG = [0.262, 1.372, -0.018];
    ellipsoideAxe(F, MG, [1, -0.12, 0.05], 0.028, 0.074, 0.08, 16, function (a, x, y, z) { var r = sm(0.35, 1.0, tache(x, y, z, 91, 70)); return x > 0.268 ? mix(chairS, chair, 0.3 + 0.5 * r) : mix(chair, chairS, 0.3 * r); }, [['poitrine', 1]]);
    tore(F, [MG[0] - 0.006, MG[1], MG[2]], [1, -0.12, 0.05], 0.074, function (th) { return 0.012 + 0.006 * Math.abs(Math.sin(th * 5 + 1.3)) + 0.004 * Math.sin(th * 11); }, 6,
      function (a, x, y, z) { return mix(cPeau(x, y, z), chair, 0.35); }, [['poitrine', 1]],
      function (th, a, x, y, z) { return [0.008 * Math.sin(th * 7), 0, 0]; });
    cordon(F, [[0.19, 1.438, 0.045], [0.235, 1.43, 0.062], [0.275, 1.418, 0.072]], 0.0115, osC, [['poitrine', 1]], 8);                   // clavicule
    ellipsoide(F, [0.281, 1.416, 0.074], 0.017, 0.015, 0.016, 10, osC, [['poitrine', 1]]);
    ellipsoideAxe(F, [0.284, 1.352, 0.012], [1, 0, 0.2], 0.012, 0.019, 0.019, 10, mix(osC, [0.8, 0.7, 0.55], 0.2), [['poitrine', 1]]);   // glène (os rond)
    // coulures de sang du moignon sur le débardeur
    [[0.24, 0.04, 1.33, 0.13], [0.255, 0.0, 1.32, 0.09], [0.215, 0.06, 1.31, 0.18]].forEach(function (d, i) {
      var pts = [];
      for (var k = 0; k <= 5; k++) { var y = d[2] - d[3] * k / 5, aa = Math.atan2((0.02 + d[1] + i * 0.01) / 0.18, d[0] / 0.26), p = surfaceTorse(aa, y, 0.0105); pts.push(p); }
      cordon(F, pts, function (t) { return 0.0042 - t * 0.0016 + (t > 0.92 ? 0.0016 : 0); }, sang, function (p) { return poidsTorse(p[1]); }, 5);
    });

    // ── bras gauche détaché : chair déchirée et humérus qui dépasse en haut, pendu au moignon par une chaîne de tendons ──
    (function () {
      var hb = PD.brasLibre, co = PD.avantBrasLibre, po = PD.mainLibre, secs = [];
      [[0.0, 0.08, 0.082], [0.035, 0.099, 0.101], [0.12, 0.108, 0.109], [0.4, 0.103, 0.104], [0.75, 0.094, 0.096], [1.0, 0.088, 0.09]].forEach(function (r, i) {
        var c = lerp3(hb, co, r[0]);
        var w = r[0] > 0.85 ? [['brasLibre', 1 - sm(0.85, 1.0, r[0]) * 0.5], ['avantBrasLibre', sm(0.85, 1.0, r[0]) * 0.5]] : [['brasLibre', 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w,
          deform: i === 0 ? function (a) { return [0, 0.016 * Math.sin(a * 5 + 0.7) + 0.008 * Math.sin(a * 13), 0]; } : null,
          couleur: function (a, x, y, z) {
            if (i === 0) return mix(chair, chairS, 0.35);
            if (i === 1) return mix(cPeau(x, y, z), chair, 0.55);
            var cc = cPeau(x, y, z);
            if (y > 1.02 && Math.sin(a * 3 + 0.4) > 0.55) cc = mix(cc, sang, sm(1.02, 1.12, y) * 0.8);                     // sang qui coule de la déchirure
            return cc;
          } });
      });
      [[0.08, 0.089, 0.091], [0.4, 0.085, 0.086], [0.72, 0.076, 0.075], [0.86, 0.068, 0.065], [0.93, 0.06, 0.056], [1.0, 0.052, 0.049]].forEach(function (r) {
        var c = lerp3(co, po, r[0]);
        var w = r[0] < 0.2 ? [['brasLibre', 0.3], ['avantBrasLibre', 0.7]] : r[0] > 0.85 ? [['avantBrasLibre', 1 - sm(0.85, 1.0, r[0]) * 0.6], ['mainLibre', sm(0.85, 1.0, r[0]) * 0.6]] : [['avantBrasLibre', 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, couleur: function (a, x, y, z) { return cPeau(x, y, z); } });
      });
      F.tube(secs, 16, X, Z, { fermerDebut: [hb[0], hb[1] - 0.012, hb[2]], inverse: true });
      // intérieur de la déchirure (chair sombre) et humérus qui dépasse
      F.tube([{ c: [hb[0], hb[1] - 0.004, hb[2]], rx: 0.062, rz: 0.064, poids: [['brasLibre', 1]], couleur: constante(chairS) }, { c: [hb[0], hb[1] - 0.014, hb[2]], rx: 0.03, rz: 0.03, poids: [['brasLibre', 1]], couleur: constante(mix(chairS, noir, 0.3)) }], 14, X, Z, { fermerFin: [hb[0], hb[1] - 0.016, hb[2]] });
      cordon(F, [[hb[0] + 0.004, hb[1] - 0.02, hb[2] + 0.004], [hb[0] + 0.006, hb[1] + 0.03, hb[2] + 0.006], [hb[0] + 0.01, hb[1] + 0.068, hb[2] + 0.008]], function (t) { return 0.017 - t * 0.003; }, osC, [['brasLibre', 1]], 8);
      ellipsoide(F, [hb[0] + 0.012, hb[1] + 0.082, hb[2] + 0.009], 0.025, 0.02, 0.022, 10, osC, [['brasLibre', 1]]);
      [[0.0, 0.07], [2.2, 0.1], [4.1, 0.06]].forEach(function (d) {
        var pts = [];
        for (var k = 0; k <= 4; k++) { var y = hb[1] - 0.01 - d[1] * k / 4, aa = d[0] + 0.1 * Math.sin(k * 1.7); pts.push([hb[0] + Math.cos(aa) * 0.097, y, hb[2] + Math.sin(aa) * 0.099]); }
        cordon(F, pts, function (t) { return 0.0044 - t * 0.0016 + (t > 0.9 ? 0.0016 : 0); }, sang, [['brasLibre', 1]], 5);
      });
      mainGriffes(F, 'G', po, { os: 'mainLibre', sx: 1, k: 1.3, ecart: 0.25, long: 1.12, cMain: function (a, x, y, z) { return cPeau(x, y, z, 0.8); }, cOngle: griffe });
    })();
    // ── tendons : du bas du moignon (os 'poitrine') au haut du bras (os 'brasLibre'), mélange linéaire le long du brin ──
    var hbL = PD.brasLibre;
    [[[0.247, 1.346, 0.022], [hbL[0] - 0.02, hbL[1] + 0.012, 0.02], 0.0078, tendon], [[0.262, 1.35, -0.012], [hbL[0] + 0.012, hbL[1] + 0.014, -0.012], 0.0068, tendon],
     [[0.24, 1.342, -0.045], [hbL[0] - 0.016, hbL[1] + 0.01, -0.052], 0.006, mix(tendon, chair, 0.5)], [[0.268, 1.354, 0.006], [hbL[0] + 0.024, hbL[1] + 0.012, 0.004], 0.0052, chair],
     [[0.254, 1.348, -0.03], [hbL[0] + 0.002, hbL[1] + 0.012, -0.036], 0.0045, mix(tendon, [1, 1, 1], 0.15)]].forEach(function (td, i) {
      var A = td[0], B = td[1], pts = [];
      for (var k = 0; k <= 8; k++) { var t = k / 8, p = lerp3(A, B, t); p[0] += 0.012 * Math.sin(PI * t) * (i % 2 ? 1 : -0.6); p[2] += 0.006 * Math.sin(PI * t * 2 + i); pts.push(p); }
      cordon(F, pts, td[2], function (a, x, y, z) { return Math.sin(y * 260 + i) > 0.6 ? mix(td[3], chair, 0.6) : td[3]; },
        function (p, t) { var k = sm(0.06, 0.94, t); return [['poitrine', 1 - k], ['brasLibre', k]]; }, 6);
    });

    // ── jambes : pantalon kaki (genou droit déchiré), bottes ──
    ['G', 'D'].forEach(function (S) {
      var sx = S === 'G' ? 1 : -1, hi = POS['cuisse' + S], ge = POS['tibia' + S], ch = POS['pied' + S], secs = [];
      var hi2 = [hi[0] + sx * 0.022, hi[1], hi[2]], ge2 = [ge[0] + sx * 0.018, ge[1], ge[2]], ch2 = [ch[0] + sx * 0.012, ch[1], ch[2]];
      [[0.0, 0.146, 0.144], [0.3, 0.138, 0.135], [0.7, 0.12, 0.117], [1.0, 0.108, 0.108]].forEach(function (r) {
        var c = lerp3(hi2, ge2, r[0]);
        var w = r[0] < 0.1 ? [['hanches', 0.5], ['cuisse' + S, 0.5]] : r[0] > 0.85 ? [['cuisse' + S, 1 - sm(0.85, 1.0, r[0]) * 0.5], ['tibia' + S, sm(0.85, 1.0, r[0]) * 0.5]] : [['cuisse' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, deform: function (a, x, y, z) { var d = plis(a, y, 36, 0.005); return [Math.cos(a) * d, 0, Math.sin(a) * d]; },
          couleur: function (a, x, y, z) {
            var c2 = mix(pant, pantS, sm(0.5, 0.82, tache(x, y, z, 3, 11)) * 0.55);
            if (S === 'G' && z > -0.02 && sm(0.62, 0.7, tache(x, y, z, 45, 26)) > 0.5 && y > 0.7) c2 = mix(c2, sang, 0.7);       // gouttes de sang (bras)
            return c2;
          } });
      });
      [[0.12, 0.107, 0.108], [0.4, 0.103, 0.106], [0.6, 0.097, 0.101], [0.64, 0.104, 0.109], [0.68, 0.099, 0.105], [0.76, 0.095, 0.102], [0.88, 0.088, 0.096], [1.0, 0.084, 0.094]].forEach(function (r) {
        var c = lerp3(ge2, ch2, r[0]);
        var w = r[0] < 0.2 ? [['cuisse' + S, 0.3], ['tibia' + S, 0.7]] : r[0] > 0.9 ? [['tibia' + S, 0.6], ['pied' + S, 0.4]] : [['tibia' + S, 1]];
        secs.push({ c: c, rx: r[1], rz: r[2], poids: w, deform: r[0] < 0.62 ? function (a, x, y, z) { var d = plis(a, y, 38, 0.0045); return [Math.cos(a) * d, 0, Math.sin(a) * d]; } : null,
          couleur: function (a, x, y, z) {
            if (r[0] > 0.66) return mix(botte, [0.05, 0.04, 0.03], tache(x, y, z, 3, 30) * 0.5);                                     // tige de la botte
            return mix(pant, pantS, sm(0.5, 0.82, tache(x, y, z, 3, 11)) * 0.55 + (r[0] > 0.55 ? 0.2 : 0));
          } });
      });
      F.tube(secs, 16, X, Z, { inverse: true });
      var talon = [ch2[0] + sx * 0.004, 0.07, ch2[2] - 0.09], bout = [ch2[0] + sx * 0.006, 0.054, ch2[2] + 0.215];
      F.tube([[0.0, 0.07, 0.068], [0.25, 0.077, 0.074], [0.7, 0.073, 0.058], [0.9, 0.061, 0.046], [1.0, 0.043, 0.033]].map(function (r) {
        var c = lerp3(talon, bout, r[0]); c[1] = 0.07 - r[0] * 0.017;
        return { c: c, rx: r[1], rz: r[2], lat: X, av: Y, poids: [['pied' + S, 1]], couleur: function (a, x, y, z) { return y < 0.022 ? semelle : mix(botte, [0.05, 0.04, 0.03], tache(x, y, z, 3, 30) * 0.5); } };
      }), 12, X, Y, { fermerDebut: [talon[0], 0.07, talon[2] - 0.013], fermerFin: [bout[0], 0.048, bout[2] + 0.017], inverse: true });
      for (var l = 0; l < 3; l++) { var zl = ch2[2] + 0.05 + l * 0.032, yl = 0.105 - l * 0.012; cordon(F, [[ch2[0] + sx * 0.004 - 0.03, yl, zl + 0.05], [ch2[0] + sx * 0.004 + 0.03, yl + 0.004, zl + 0.05]], 0.0035, lacet, [['pied' + S, 1]], 4); }
      if (S === 'D') {
        // genou droit : pantalon déchiré, plaie
        var aK = PI / 2 + 0.25, rK = lerp3(ge2, ch2, 0.05), cK = [rK[0] + Math.cos(aK) * 0.1, 0.51, rK[2] + Math.sin(aK) * 0.103], nK = norm3([Math.cos(aK), 0.05, Math.sin(aK)]);
        plaque(F, [cK[0] + nK[0] * 0.002, cK[1], cK[2] + nK[2] * 0.002], nK, 0.04, 0.034, 0.0008, mix(pantS, noir, 0.5), [['tibia' + S, 1]], function (q) { return 1 + 0.15 * Math.sin(q * 7) + 0.08 * Math.sin(q * 13); });
        plaque(F, [cK[0] + nK[0] * 0.0034, cK[1], cK[2] + nK[2] * 0.0034], nK, 0.033, 0.027, 0.0008, function (q, x, y, z) { return cPeau(x, y, z); }, [['tibia' + S, 1]], function (q) { return 1 + 0.12 * Math.sin(q * 7 + 0.5); });
        ellipsoideAxe(F, [cK[0] + nK[0] * 0.006, cK[1] - 0.002, cK[2] + nK[2] * 0.006], nK, 0.006, 0.015, 0.011, 10, chair, [['tibia' + S, 1]]);
      }
    });
    return { geo: F.geometrie(THREE, [0, 0.9, 0, 1.6]), geoEmissif: G.geometrie(THREE, [0, 0.9, 0, 1.6]), yeux: [[-0.034, 1.668, 0.08]], couleur: 0xE3B65C, hauteur: 1.95,
      os: OS_DEMEMBRE, osLibre: ['brasLibre', 'avantBrasLibre', 'mainLibre'], attache: ATTACHE_TENDONS, echelleTete: 1.1 };
  }
  var MODELES_MB = [];
  /** Modèle (géométries partagées) d'un mini-boss pour cette instance de THREE : { geo, geoEmissif, yeux, couleur, hauteur, insigne? }. */
  function modeleMiniBoss(THREE, type) {
    for (var i = 0; i < MODELES_MB.length; i++) if (MODELES_MB[i].THREE === THREE && MODELES_MB[i].type === type) return MODELES_MB[i].m;
    var m = type === 'irradie' ? construireIrradie(THREE, 4404) : type === 'demembre' ? construireDemembre(THREE, 2202) : construireSurvolte(THREE, 6606);
    MODELES_MB.push({ THREE: THREE, type: type, m: m });
    return m;
  }
  /** Squelette + maillages d'un mini-boss (utilisé par les entités et par le dormeur des cuves). */
  function instancierMiniBoss(THREE, C, type, matCorps, matEmis) {
    var M = modeleMiniBoss(THREE, type), LISTE = M.os || OS, POSM = {}, bones = [], byName = {};   // Démembré : 3 os de plus (bras détaché)
    LISTE.forEach(function (o) { POSM[o[0]] = [o[2], o[3], o[4]]; });
    LISTE.forEach(function (os) {
      var b = new THREE.Bone(); b.name = os[0];
      if (os[1]) { var p = POSM[os[1]]; b.position.set(os[2] - p[0], os[3] - p[1], os[4] - p[2]); byName[os[1]].add(b); }
      else b.position.set(os[2], os[3], os[4]);
      bones.push(b); byName[os[0]] = b;
    });
    var groupe = new THREE.Group(), racineOs = new THREE.Group(); groupe.add(racineOs); racineOs.add(bones[0]);
    var mesh = new THREE.SkinnedMesh(M.geo, matCorps), meshE = new THREE.SkinnedMesh(M.geoEmissif, matEmis);
    groupe.add(mesh); groupe.add(meshE);
    racineOs.updateMatrixWorld(true);
    var sq = new THREE.Skeleton(bones);
    mesh.bind(sq, new THREE.Matrix4()); meshE.bind(sq, new THREE.Matrix4());
    mesh.frustumCulled = false; meshE.frustumCulled = false;
    if (M.echelleTete) byName.tete.scale.setScalar(M.echelleTete);   // Démembré : grosse tête de brute (déformation après la liaison)
    var insigne = null;
    if (M.insigne) {
      var I = M.insigne, pt = POS.poitrine;
      var mi = new THREE.MeshStandardMaterial({ map: texInsigneRadioactif(THREE, C), roughness: 0.6, metalness: 0.1 });
      insigne = new THREE.Mesh(new THREE.CircleGeometry(I.rayon, 24), mi);
      insigne.position.set(I.position[0] - pt[0], I.position[1] - pt[1], I.position[2] - pt[2]);
      insigne.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(I.normale[0], I.normale[1], I.normale[2]).normalize());
      byName.poitrine.add(insigne);
    }
    var rest = {}, restPos = {}; LISTE.forEach(function (o) { rest[o[0]] = byName[o[0]].quaternion.clone(); restPos[o[0]] = byName[o[0]].position.clone(); });
    return { groupe: groupe, racineOs: racineOs, os: byName, rest: rest, restPos: restPos, mesh: mesh, meshEmissif: meshE, squelette: sq, modele: M, insigne: insigne };
  }
  function matEmissifMB(THREE, C) {
    var m = new THREE.MeshBasicMaterial({ vertexColors: true });
    m.toneMapped = false;
    if ('skinning' in m && C.rev < 136) m.skinning = true;
    return m;
  }
  /**
   * Mini-boss endormi pour les cuves du monde : SkinnedMesh en pose suspendue (bras flottants, tête penchée, genoux fléchis),
   * matériau légèrement teinté par le liquide. → { groupe, animer(t) } (léger balancement, aucune allocation).
   */
  function modeleDormant(THREE, type, opts) {
    opts = opts || {};
    var C = opts.compat || U.compat(THREE);
    var mc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
    mc.emissive = C.couleur(type === 'irradie' ? 0x1c3a08 : type === 'demembre' ? 0x16300c : 0x0e2a2e); mc.emissiveIntensity = 0.55;
    if ('skinning' in mc && C.rev < 136) mc.skinning = true;
    var me = matEmissifMB(THREE, C);
    me.color.setRGB(0.55, 0.55, 0.55);                                   // endormi : lueur faible
    var I = instancierMiniBoss(THREE, C, type, mc, me);
    // angles (x, y, z) par os dans un Float64Array, puis une seule boucle : quaternion d'Euler XYZ composé avec la pose de repos
    // (aucun appel avec des nombres en argument → aucune allocation par image)
    var NOMS_D = ['hanches', 'colonne', 'poitrine', 'cou', 'tete', 'machoire', 'brasG', 'brasD', 'avantBrasG', 'avantBrasD', 'mainG', 'mainD',
      'cuisseG', 'cuisseD', 'tibiaG', 'tibiaD', 'piedG', 'piedD'];
    if (I.os.brasLibre) NOMS_D.push('brasLibre', 'avantBrasLibre');                // Démembré : le bras arraché flotte au bout de ses tendons
    var A = new Float64Array(NOMS_D.length * 3), OSD = NOMS_D.map(function (n) { return I.os[n]; }), RD = NOMS_D.map(function (n) { return I.rest[n]; });
    var ph = type === 'irradie' ? 1.7 : 0.3;
    // v1.5 : `debout` (cuve géante, Démembré ×2) : il tient debout dans sa cuve (genoux à peine pliés, bras près du corps)
    var dbt = opts.debout ? 1 : 0, kE = 1 - 0.6 * dbt, kG = 1 - 0.75 * dbt;
    I.animer = function (t, ag) {
      ag = ag || 0;                                                       // agitation (siphon) : sursauts
      var s = Math.sin(t * 0.55 + ph) + ag * 0.6 * Math.sin(t * 9.1), s2 = Math.sin(t * 0.37 + ph * 2) + ag * 0.5 * Math.sin(t * 11.3 + 1);
      A[0] = 0.05 + 0.02 * s; A[1] = 0.04 * s2; A[2] = 0;                  // hanches
      A[3] = 0.06; A[4] = 0; A[5] = 0.02 * s2;                             // colonne
      A[6] = 0.08 + 0.02 * s; A[7] = 0; A[8] = 0;                          // poitrine
      A[9] = 0.25; A[10] = 0; A[11] = 0;                                   // cou
      A[12] = 0.38 + 0.04 * s2; A[13] = 0.1 * s; A[14] = 0.12;             // tête
      A[15] = 0.22; A[16] = 0; A[17] = 0;                                  // mâchoire
      A[18] = -0.25 + 0.06 * s; A[19] = 0; A[20] = (0.42 + 0.08 * s2) * kE;   // bras gauche (flotte, écarté)
      A[21] = -0.18 + 0.06 * s2; A[22] = 0; A[23] = (-0.38 - 0.08 * s) * kE;  // bras droit
      A[24] = -0.5 - 0.1 * s2; A[25] = 0; A[26] = 0;                       // avant-bras
      A[27] = -0.42 - 0.1 * s; A[28] = 0; A[29] = 0;
      A[30] = -0.2; A[31] = 0; A[32] = 0.15;                               // mains
      A[33] = -0.25; A[34] = 0; A[35] = -0.15;
      A[36] = (-0.32 + 0.05 * s2) * kG; A[37] = 0; A[38] = -0.08;          // cuisses
      A[39] = (-0.2 + 0.05 * s) * kG; A[40] = 0; A[41] = 0.07;
      A[42] = (0.62 + 0.06 * s) * kG; A[43] = 0; A[44] = 0;                // tibias (genoux fléchis)
      A[45] = (0.5 + 0.06 * s2) * kG; A[46] = 0; A[47] = 0;
      A[48] = 0.4; A[49] = 0; A[50] = 0;                                   // pieds pendants
      A[51] = 0.35; A[52] = 0; A[53] = 0;
      if (OSD.length > 18) { A[54] = -0.35 + 0.12 * s2; A[55] = 0.1 * s; A[56] = (0.55 + 0.12 * s) * (1 - 0.7 * dbt); A[57] = -0.45 - 0.1 * s2; A[58] = 0; A[59] = 0; }
      for (var k = 0; k < OSD.length; k++) {
        var hx = A[k * 3] * 0.5, hy = A[k * 3 + 1] * 0.5, hz = A[k * 3 + 2] * 0.5;
        var c1 = Math.cos(hx), c2 = Math.cos(hy), c3 = Math.cos(hz), s1 = Math.sin(hx), s2b = Math.sin(hy), s3 = Math.sin(hz);
        var bx = s1 * c2 * c3 + c1 * s2b * s3, by = c1 * s2b * c3 - s1 * c2 * s3, bz = c1 * c2 * s3 + s1 * s2b * c3, bw = c1 * c2 * c3 - s1 * s2b * s3;
        var R = RD[k], ax = R.x, ay = R.y, az = R.z, aw = R.w;              // repos × rotation locale (Quaternion.multiplyQuaternions)
        OSD[k].quaternion.set(ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz, az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz);
      }
      I.racineOs.position.y = 0.04 * s;
      I.racineOs.rotation.y = 0.12 * s2;
    };
    I.animer(0);
    I.echelle = (type === 'irradie' ? 1.05 : type === 'demembre' ? 1.08 : 0.97) * (opts.echelle > 0 ? opts.echelle : 1);   // v1.5 : Démembré géant ×2
    I.groupe.scale.setScalar(I.echelle);
    return I;
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════
  // Poses (angles en radians, rotations locales XYZ appliquées sur la pose de repos)
  // ════════════════════════════════════════════════════════════════════════════════════════════
  function poseVide() { var p = {}; OS.forEach(function (o) { p[o[0]] = [0, 0, 0]; }); return p; }

  function creer(THREE, o) {
    o = o || {};
    var C = o.compat || U.compat(THREE), monde = o.monde;
    var MAX = o.max || 40;
    var Z = { liste: null, pv: o.pv || 150, degatsAttaque: o.degatsAttaque != null ? o.degatsAttaque : 0.2 };
    var surAttaque = o.surAttaque || function () {}, surMort = o.surMort || function () {};

    // ── matériaux : partagé + clones pour les effets (dissolution, brûlure, dessèchement) ──
    var texCrasse = U.tex(THREE, C, U.texCrasse(256, 21).map);
    function patch(m) {
      m.userData.u = { uDissolution: { value: 0 }, uBrulure: { value: 0 }, uDesseche: { value: 0 }, uLueur: { value: 0 }, uIrradie: { value: 0 }, uCoulIrr: { value: new THREE.Color(0.55, 1, 0.18) } };
      m.onBeforeCompile = function (sh) {
        for (var k in m.userData.u) sh.uniforms[k] = m.userData.u[k];
        sh.vertexShader = 'varying vec3 vPosObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosObj = position;');
        sh.fragmentShader = 'uniform float uDissolution; uniform float uBrulure; uniform float uDesseche; uniform float uLueur; uniform float uIrradie; uniform vec3 uCoulIrr; varying vec3 vPosObj;\n' +
          'float hz(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }\n' +
          'float bz(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(hz(i),hz(i+vec3(1,0,0)),f.x),mix(hz(i+vec3(0,1,0)),hz(i+vec3(1,1,0)),f.x),f.y),mix(mix(hz(i+vec3(0,0,1)),hz(i+vec3(1,0,1)),f.x),mix(hz(i+vec3(0,1,1)),hz(i+vec3(1,1,1)),f.x),f.y),f.z); }\n' +
          sh.fragmentShader
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat nD = bz(vPosObj*28.0)*0.6 + bz(vPosObj*7.0)*0.4;\nfloat seuil = uDissolution*1.15 - 0.075 + (1.8 - vPosObj.y)*0.0;\nif (uDissolution > 0.0 && nD < seuil) discard;')
            .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' +
              'float bord = uDissolution > 0.0 ? smoothstep(seuil + 0.09, seuil, nD) : 0.0;\n' +
              'vec3 lum = gl_FragColor.rgb;\n' +
              'float g = dot(lum, vec3(0.3,0.59,0.11));\n' +
              'lum = mix(lum, vec3(g*0.55, g*0.5, g*0.45), uDesseche);\n' +
              'lum += vec3(1.6,0.45,0.08) * bord * (uBrulure*2.0 + 0.35);\n' +
              'lum += vec3(1.0,0.32,0.06) * uBrulure * (0.25 + 0.75*bz(vPosObj*16.0)) * 0.6;\n' +
              'lum += vec3(0.9,0.2,0.1) * uLueur;\n' +
              // v1.5 : irradié : lueur verte qui grésille (taches plus vives, veines)
              'lum += uCoulIrr * uIrradie * (0.32 + 0.68 * smoothstep(0.35, 0.85, bz(vPosObj*11.0 + vec3(0.0, uIrradie*2.0, 0.0))));\n' +
              'gl_FragColor.rgb = lum;');
      };
      m.customProgramCacheKey = function () { return 'zombie-effets-v2'; };
      return m;
    }
    var matBase = patch(new THREE.MeshStandardMaterial({ vertexColors: true, map: texCrasse, roughness: 0.86, metalness: 0 }));
    if ('skinning' in matBase && C.rev < 136) matBase.skinning = true;
    var reserveMats = [];
    function prendreMat() {
      var m = reserveMats.pop();
      if (!m) { m = patch(matBase.clone()); if ('skinning' in matBase && C.rev < 136) m.skinning = true; }
      m.userData.u.uDissolution.value = 0; m.userData.u.uBrulure.value = 0; m.userData.u.uDesseche.value = 0; m.userData.u.uLueur.value = 0; m.userData.u.uIrradie.value = 0;
      return m;
    }
    function rendreMat(m) { if (m && m !== matBase) reserveMats.push(m); }
    var matYeux = new THREE.MeshBasicMaterial({ color: C.couleur(0xff8a1a) });
    var matYeuxEteints = new THREE.MeshBasicMaterial({ color: C.couleur(0x1a1410) });
    var geoYeux = (function () {
      var a = new THREE.SphereGeometry(0.0115, 10, 8), b = a.clone();
      a.translate(0.034, 1.669 - POS.tete[1], 0.085 - POS.tete[2]); b.translate(-0.034, 1.669 - POS.tete[1], 0.085 - POS.tete[2]);
      return U.fusionner(THREE, [a, b]);
    })();
    var halo = (function () { var c = U.canvas(32, 32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,170,60,0.9)'); gr.addColorStop(1, 'rgba(255,90,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return U.tex(THREE, C, c, { clamp: true }); })();
    var matHalo = new THREE.SpriteMaterial({ map: halo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

    // ── géométries des variantes ──
    var GEOS = [construireVariante(THREE, 0, 101), construireVariante(THREE, 1, 202), construireVariante(THREE, 2, 303)];

    // ── réserve de zombies ──
    var pool = [], prochainId = 1;
    function creerInstance(i) {
      var bones = [], byName = {};
      OS.forEach(function (os) {
        var b = new THREE.Bone(); b.name = os[0];
        if (os[1]) { var p = POS[os[1]]; b.position.set(os[2] - p[0], os[3] - p[1], os[4] - p[2]); byName[os[1]].add(b); }
        else b.position.set(os[2], os[3], os[4]);
        bones.push(b); byName[os[0]] = b;
      });
      var groupe = new THREE.Group();
      var racineOs = new THREE.Group(); groupe.add(racineOs); racineOs.add(bones[0]);
      var v = i % 3;
      var mesh = new THREE.SkinnedMesh(GEOS[v], matBase);
      groupe.add(mesh);
      racineOs.updateMatrixWorld(true);
      var sk = new THREE.Skeleton(bones);
      mesh.bind(sk, new THREE.Matrix4());
      mesh.frustumCulled = false;
      var yeux = new THREE.Mesh(geoYeux, matYeux); byName.tete.add(yeux);
      var h1 = new THREE.Sprite(matHalo); h1.scale.set(0.085, 0.085, 1); h1.position.set(0.034, 1.669 - POS.tete[1], 0.095); byName.tete.add(h1);
      var h2 = new THREE.Sprite(matHalo); h2.scale.set(0.085, 0.085, 1); h2.position.set(-0.034, 1.669 - POS.tete[1], 0.095); byName.tete.add(h2);
      groupe.visible = false;
      var rest = {}; OS.forEach(function (os) { rest[os[0]] = byName[os[0]].quaternion.clone(); });
      return {
        idx: i, id: null, actif: false, groupe: groupe, racineOs: racineOs, mesh: mesh, os: byName, rest: rest, yeux: yeux, halos: [h1, h2],
        variante: v, mat: matBase, lieu: 'salle', position: new THREE.Vector3(), vitesse: new THREE.Vector3(), lacet: 0,
        etat: 'inactif', t: 0, pv: 150, vitesseMax: 1.4, course: false, phase: Math.random() * 10, boiterie: Math.random() < 0.5 ? 0.3 : 0,
        cible: null, attente: 0, attaqueT: 0, attaqueFrappee: false, source: null, effet: null, effetT: 0, hauteur: 0, lacetVise: 0,
        vue: { id: null, position: { x: 0, y: 0, z: 0 }, vivant: true, lieu: 'salle', etat: '', type: 'zombie', source: null, pv: 0, pvMax: 0, nom: null, miniBoss: false }, bloqueT: 0, derniereDist: 1e9, type: 'zombie',
        miniBoss: false, pousse: false, pvMax: 150, nom: null,
        mb: false, rayonCol: 0.3, rayonS: 0.3, masse: 1, irrActif: false, irrRayon: 1.5, irrDps: 0.04, irrCoul: new THREE.Color(0.55, 1, 0.18)   // v1.5 : irradiation
      };
    }
    for (var i = 0; i < MAX; i++) pool.push(creerInstance(i));
    var scenesAjout = {};
    function placerDansScene(z) {
      if (!monde) return;
      var sc = monde.scenes[z.lieu];
      if (z.groupe.parent !== sc) sc.add(z.groupe);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    // CHIENS ZOMBIES (v1.2, API §14.4) : réserve, sortie de faille, IA de meute, galop rotatoire, bond-morsure
    // Même API publique que les zombies (apparaitre type 'chien', liste, toucher, intersecter, retirer…).
    // ════════════════════════════════════════════════════════════════════════════════════════
    var MAX_CHIENS = o.maxChiens || 8;
    var PROFIL_CHIEN = { pv: 100, vitesse: 7.4, degats: 0.1, cadence: 0.9, portee: 1.4 };
    var MODELES_CHIEN = [construireChien(THREE, 0, 404), construireChien(THREE, 1, 505)];
    // yeux couleur braise du Pacte (COUL.energie de src/fx.js : 1,0 / 0,3 / 0,07), sans compression de tons
    var matYeuxChien = new THREE.MeshBasicMaterial(); matYeuxChien.color.setRGB(1.0, 0.3, 0.07); matYeuxChien.toneMapped = false;
    var haloChien = (function () { var c = U.canvas(32, 32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,150,70,1)'); gr.addColorStop(0.35, 'rgba(255,77,18,0.75)'); gr.addColorStop(1, 'rgba(255,40,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return U.tex(THREE, C, c, { clamp: true }); })();
    var matHaloChien = new THREE.SpriteMaterial({ map: haloChien, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    matHaloChien.toneMapped = false;
    var geoYeuxChien = MODELES_CHIEN.map(function (M) {
      var pt = POS_CHIEN.tete, a = new THREE.SphereGeometry(0.0108, 12, 8); a.scale(1, 0.62, 1.15); var b = a.clone();   // œil en amande
      a.translate(M.yeux[0][0] - pt[0], M.yeux[0][1] - pt[1], M.yeux[0][2] - pt[2] + 0.004);
      b.translate(M.yeux[1][0] - pt[0], M.yeux[1][1] - pt[1], M.yeux[1][2] - pt[2] + 0.004);
      return U.fusionner(THREE, [a, b]);
    });
    var chiens = [];
    function creerChien(i) {
      var bones = [], byName = {};
      OS_CHIEN.forEach(function (os) {
        var b = new THREE.Bone(); b.name = os[0];
        if (os[1]) { var p = POS_CHIEN[os[1]]; b.position.set(os[2] - p[0], os[3] - p[1], os[4] - p[2]); byName[os[1]].add(b); }
        else b.position.set(os[2], os[3], os[4]);
        bones.push(b); byName[os[0]] = b;
      });
      var groupe = new THREE.Group(), racineOs = new THREE.Group(); groupe.add(racineOs); racineOs.add(bones[0]);
      var v = i % 2, M = MODELES_CHIEN[v];
      var mesh = new THREE.SkinnedMesh(M.geo, matBase);
      groupe.add(mesh);
      racineOs.updateMatrixWorld(true);
      mesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
      mesh.frustumCulled = false;
      var yeux = new THREE.Mesh(geoYeuxChien[v], matYeuxChien); byName.tete.add(yeux);
      var halos = M.yeux.map(function (p) {
        var h = new THREE.Sprite(matHaloChien); h.scale.set(0.042, 0.042, 1);
        h.position.set(p[0] - POS_CHIEN.tete[0], p[1] - POS_CHIEN.tete[1], p[2] - POS_CHIEN.tete[2] + 0.012); byName.tete.add(h); return h;
      });
      groupe.visible = false;
      var rest = {}; NOMS_CHIEN.forEach(function (n) { rest[n] = byName[n].quaternion.clone(); });
      return {
        idx: i, type: 'chien', id: null, actif: false, groupe: groupe, racineOs: racineOs, mesh: mesh, os: byName, rest: rest, yeux: yeux, halos: halos, variante: v,
        mat: matBase, lieu: 'salle', position: new THREE.Vector3(), vitesse: new THREE.Vector3(), lacet: 0, etat: 'inactif', t: 0,
        pv: 100, pvMax: 100, profil: { pv: 100, vitesse: 7.4, degats: 0.1, cadence: 0.9, portee: 1.4 }, degats: 0.1, vitesseMax: 7.4, agressif: true,
        phase: Math.random() * TAU, virage: 0, decalage: 0, reaction: 0, cible: null, attente: 0, morsureT: 0, morsureFrappee: false, morsures: 0,
        hauteur: 0, immobileT: 0, grogneT: 0, bloqueT: 0, derniereDist: 1e9, mortCote: 1, source: null,
        vue: { id: null, position: { x: 0, y: 0, z: 0 }, vivant: true, lieu: 'salle', etat: '', type: 'chien', source: null, pv: 0, pvMax: 0, nom: null, miniBoss: false },
        miniBoss: false, pousse: false, nom: null,
        mb: false, rayonCol: 0.33, rayonS: 0.36, masse: 1, irrActif: false, irrRayon: 1.5, irrDps: 0.04, irrCoul: new THREE.Color(0.55, 1, 0.18)   // v1.5 : irradiation
      };
    }
    for (var ic = 0; ic < MAX_CHIENS; ic++) chiens.push(creerChien(ic));
    var tous = pool.concat(chiens);          // zombies + chiens (parcours communs, aucune allocation par image)

    function apparaitreChien(opts) {
      var c = null;
      for (var k = 0; k < chiens.length; k++) if (!chiens[k].actif) { c = chiens[k]; break; }
      if (!c) return null;
      var p = opts.position, pr = opts.profil || {}, P0c = PROFIL_CHIEN;
      c.id = 'c' + (prochainId++); parId[c.id] = c;
      c.actif = true; c.lieu = opts.lieu || (monde && monde.lieuDe ? monde.lieuDe(p.x) : 'salle');
      c.position.set(p.x, 0, p.z); c.vitesse.set(0, 0, 0);
      c.lacet = opts.lacet != null ? opts.lacet : Math.random() * TAU;
      c.profil.pv = pr.pv > 0 ? pr.pv : P0c.pv; c.profil.vitesse = pr.vitesse > 0 ? pr.vitesse : P0c.vitesse;
      c.profil.degats = pr.degats != null ? pr.degats : P0c.degats; c.profil.cadence = pr.cadence > 0 ? pr.cadence : P0c.cadence; c.profil.portee = pr.portee > 0 ? pr.portee : P0c.portee;
      c.pv = c.pvMax = opts.pv || c.profil.pv; c.degats = c.profil.degats;
      c.vitesseMax = typeof opts.vitesse === 'number' ? opts.vitesse : c.profil.vitesse;   // 'sprint' : le chien court à sa vitesse de profil
      c.agressif = opts.agressif !== false; c.source = opts.source || null;
      c.reaction = 0; c.attente = 0.35; c.morsureT = 0; c.morsureFrappee = false; c.morsures = 0; c.immobileT = 0; c.grogneT = 0; c.bloqueT = 0; c.derniereDist = 1e9;
      c.virage = 0; c.decalage = Math.random() * 2 - 1; c.hauteur = 0; c.cible = null; c.irrActif = false; IRR_K[c.it] = 0;
      if (c.mat !== matBase) { rendreMat(c.mat); c.mat = matBase; c.mesh.material = matBase; }
      c.yeux.material = matYeuxChien; c.halos[0].visible = c.halos[1].visible = true;
      c.groupe.visible = true; c.groupe.scale.setScalar(opts.echelle || (0.96 + Math.random() * 0.08)); c.groupe.scale.y *= 1;
      var e = opts.effet || 'normal';
      c.etat = (e === 'faille' || e === 'emergence' || e === 'breche') ? 'faille' : 'course'; c.t = 0;
      placerDansScene(c);
      if (c.etat === 'faille') { decal(p.x, p.z, c.lieu, 5, 1.0); projeter(terrePour(c.lieu), p.x, 0.05, p.z, 34, 3.2, 0.7, 0.5); }
      appliquerPoseChien(c, 0);
      return c.id;
    }

    // ── IA et états (aucune allocation) ──
    function majChien(c, dt, temps, joueurs) {
      c.t += dt; c.reaction = Math.max(0, c.reaction - dt * 4.5); c.attente -= dt;
      if (c.etat === 'mort') {
        // effondrement sur le flanc (glisse sur son élan), puis il brûle et tombe en cendres
        c.vitesse.multiplyScalar(Math.max(0, 1 - dt * 4));
        c.position.x += c.vitesse.x * dt; c.position.z += c.vitesse.z * dt;
        if (c.t > 0.8) {
          if (c.mat === matBase) { c.mat = prendreMat(); c.mesh.material = c.mat; }
          var um = c.mat.userData.u;
          um.uBrulure.value = U.clamp((c.t - 0.8) / 0.45, 0, 1); um.uDesseche.value = U.clamp((c.t - 0.8) / 0.6, 0, 1) * 0.8;
          um.uDissolution.value = U.clamp((c.t - 1.05) / 0.95, 0, 1);
          if (alea() < dt * 50) projeter(braisesPour(c.lieu), c.position.x + (alea() - 0.5) * 0.7, 0.1 + alea() * 0.4, c.position.z + (alea() - 0.5) * 0.7, 2, 1.1, 0.25, 0.5);
        }
        if (c.t > 2.1) { decal(c.position.x, c.position.z, c.lieu, 7, 0.9, [0.45, 0.42, 0.4]); liberer(c); return; }
      } else if (c.etat === 'cendres' || c.etat === 'absorbe') {
        if (c.mat === matBase) { c.mat = prendreMat(); c.mesh.material = c.mat; }
        var u2 = c.mat.userData.u;
        u2.uBrulure.value = U.clamp(c.t / 0.45, 0, 1); u2.uDesseche.value = U.clamp(c.t / 0.7, 0, 1) * 0.8; u2.uDissolution.value = U.clamp((c.t - 0.4) / 1.0, 0, 1);
        c.vitesse.multiplyScalar(Math.max(0, 1 - dt * 5));
        if (alea() < dt * 55) projeter(braisesPour(c.lieu), c.position.x + (alea() - 0.5) * 0.6, 0.15 + alea() * 0.6 * (1 - u2.uDissolution.value), c.position.z + (alea() - 0.5) * 0.6, 2, 1.1, 0.2, 0.5);
        if (c.t > 1.45) { decal(c.position.x, c.position.z, c.lieu, 7, 0.8, [0.45, 0.42, 0.4]); liberer(c); return; }
      } else {
        // cible : joueur vivant le plus proche dans le même lieu
        var cible = null, bd = 1e9;
        for (var q = 0; q < joueurs.length; q++) {
          var j = joueurs[q];
          if (!j.vivant || j.lieu !== c.lieu) continue;
          var dd = h2(j.position.x - c.position.x, j.position.z - c.position.z);
          if (dd < bd) { bd = dd; cible = j; }
        }
        c.cible = cible;
        var vx0 = cible ? cible.position.x - c.position.x : 0, vz0 = cible ? cible.position.z - c.position.z : 0;
        var vise = c.lacet, kAcc = Math.min(1, dt * 6);
        if (c.etat === 'faille') {
          // jaillit du sol en bondissant vers sa proie (≈ 0,72 s), puis chasse aussitôt
          if (cible) vise = Math.atan2(vx0, vz0);
          var elan = c.t > 0.12 ? 2.6 : 0;
          c.vitesse.x = Math.sin(c.lacet) * elan; c.vitesse.z = Math.cos(c.lacet) * elan;
          if (c.t >= 0.72) { c.etat = 'course'; c.t = 0; c.vitesse.x = Math.sin(c.lacet) * 4.5; c.vitesse.z = Math.cos(c.lacet) * 4.5; }
        } else if (c.etat === 'morsure') {
          c.morsureT += dt;
          var mt = c.morsureT;
          if (cible) vise = Math.atan2(vx0, vz0);
          if (cible && mt > 0.09 && mt < 0.3) {
            var vL = U.clamp((bd - 0.72) / 0.2, 0, 8.5);                          // bond : comble l'écart jusqu'à la gueule
            c.vitesse.x += (vx0 / (bd || 1) * vL - c.vitesse.x) * Math.min(1, dt * 14); c.vitesse.z += (vz0 / (bd || 1) * vL - c.vitesse.z) * Math.min(1, dt * 14);
          } else c.vitesse.multiplyScalar(Math.max(0, 1 - dt * 9));
          if (!c.morsureFrappee && mt >= 0.26) {
            c.morsureFrappee = true;
            if (cible) {
              var dot = (vx0 * Math.sin(c.lacet) + vz0 * Math.cos(c.lacet)) / (bd || 1);
              if (bd <= c.profil.portee && dot > 0.25) { c.morsures++; surAttaque(c, cible.id); }
            }
          }
          if (mt >= 0.5) { c.etat = 'course'; c.t = 0; }
        } else {
          // course / grognement
          if (!cible) {
            c.vitesse.multiplyScalar(Math.max(0, 1 - dt * 5));
            if (c.etat !== 'grogne') { c.etat = 'grogne'; c.grogneT = 0; }
          } else {
            var gz = monde && monde.grilles ? monde.grilles[c.lieu] : null;
            var direct = !monde || (bd < 16 && gz && gz.lignePraticable(c.position.x, c.position.z, cible.position.x, cible.position.z));
            if (direct) {
              var lat = c.decalage * 1.8 * U.clamp((bd - 3) / 6, 0, 1), ddx = vx0 - vz0 / (bd || 1) * lat, ddz = vz0 + vx0 / (bd || 1) * lat, dl0 = h2(ddx, ddz) || 1;
              _dir.x = ddx / dl0; _dir.z = ddz / dl0;
            } else { var ch = champPour(cible, temps); if (ch) ch.direction(c.position.x, c.position.z, _dir); else { _dir.x = vx0 / bd; _dir.z = vz0 / bd; } }
            var vmax = c.vitesseMax * (1 - 0.35 * c.reaction);
            if (c.attente > 0 && bd < 2.8) {
              // entre deux morsures : il tourne autour de sa proie à ≈ 1,7 m (harcèlement), sans s'arrêter
              var sens = c.decalage >= 0 ? 1 : -1, tx = -vz0 / bd * sens, tz = vx0 / bd * sens, rad = U.clamp((bd - 1.7) * 1.6, -1, 1);
              _dir.x = tx * 0.8 + vx0 / bd * rad; _dir.z = tz * 0.8 + vz0 / bd * rad;
              var nd = h2(_dir.x, _dir.z) || 1; _dir.x /= nd; _dir.z /= nd;
              vmax = Math.min(vmax, 3.6);
            } else if (bd < 2.6) vmax *= U.clamp((bd - 0.8) / 1.6, 0.35, 1);
            // séparation (zombies et chiens) : vitesse ; la passe positionnelle garantit l'absence de recouvrement
            var sx = 0, sz = 0;
            for (var r2 = 0; r2 < tous.length; r2++) {
              var a2 = tous[r2];
              if (a2 === c || !a2.actif || a2.lieu !== c.lieu) continue;
              var ex = c.position.x - a2.position.x, ez = c.position.z - a2.position.z, d2 = ex * ex + ez * ez;
              if (d2 < 1.0 && d2 > 1e-6) { var dl = Math.sqrt(d2); sx += ex / dl * (1.0 - dl); sz += ez / dl * (1.0 - dl); }
            }
            var fSep = 2.5 + c.vitesseMax * 0.6, vx = _dir.x * vmax + sx * fSep, vz = _dir.z * vmax + sz * fSep;
            c.vitesse.x += (vx - c.vitesse.x) * kAcc; c.vitesse.z += (vz - c.vitesse.z) * kAcc;
            vise = Math.atan2(c.vitesse.x * 0.7 + vx0 / bd * 0.3, c.vitesse.z * 0.7 + vz0 / bd * 0.3);
            // bond-morsure : à portée (+ élan), toutes les `cadence` s
            if (c.attente <= 0 && bd <= c.profil.portee + 0.6 && c.etat !== 'grogne') { c.etat = 'morsure'; c.morsureT = 0; c.morsureFrappee = false; c.attente = c.profil.cadence; }
            // bloqué loin de sa proie (aucun progrès) → grogne sur place, puis retente
            var vit = h2(c.vitesse.x, c.vitesse.z);
            if (c.etat === 'course') {
              if (vit < 0.6 && bd > 2.5) c.immobileT += dt; else c.immobileT = Math.max(0, c.immobileT - dt * 2);
              if (c.immobileT > 0.9) { c.etat = 'grogne'; c.grogneT = 0; }
            }
          }
          if (c.etat === 'grogne') {
            c.grogneT += dt;
            c.vitesse.multiplyScalar(Math.max(0, 1 - dt * 6));
            if (cible) vise = Math.atan2(vx0, vz0);
            if (cible && c.grogneT > 0.75) { c.etat = 'course'; c.immobileT = 0; c.t = 0; }
          }
        }
        var lac0 = c.lacet;
        c.lacet += U.angleDiff(c.lacet, vise) * Math.min(1, dt * 9);
        c.virage += (U.angleDiff(lac0, c.lacet) / Math.max(dt, 1e-4) - c.virage) * Math.min(1, dt * 6);
        // déplacement en sous-pas + collisions (piliers intacts ou détruits, autel, murs)
        var depl = h2(c.vitesse.x, c.vitesse.z) * dt, nSp = depl > 0.12 ? Math.min(6, Math.ceil(depl / 0.12)) : 1;
        for (var sp = 0; sp < nSp; sp++) {
          c.position.x += c.vitesse.x * dt / nSp; c.position.z += c.vitesse.z * dt / nSp;
          if (monde && c.etat !== 'faille') { _pos.x = c.position.x; _pos.z = c.position.z; monde.resoudre(c.lieu, _pos, 0.33); c.position.x = _pos.x; c.position.z = _pos.z; }
        }
        var vv = h2(c.vitesse.x, c.vitesse.z);
        c.phase += dt * vv * (vv > 3.2 ? 2.2 : 3.6);                                   // galop ≈ 2,6 foulées/s à 7,4 m/s
        if (cible) { if (bd > c.derniereDist - 0.05) c.bloqueT += dt; else c.bloqueT = 0; c.derniereDist = bd; }
      }
      appliquerPoseChien(c, dt);
    }

    // ── poses (tampons réutilisés) ──
    var AC = {}; NOMS_CHIEN.forEach(function (n) { AC[n] = [0, 0, 0]; });
    function setC(n, x, y, z) { var a = AC[n]; a[0] = x; a[1] = y; a[2] = z; }
    function addC(n, x, y, z) { var a = AC[n]; a[0] += x; a[1] += y; a[2] += z; }
    var DECAL_GALOP = { pattArG: 0.0, pattArD: 0.09, pattAvD: 0.42, pattAvG: 0.53 }, DECAL_TROT = { pattArG: 0.0, pattAvD: 0.0, pattArD: 0.5, pattAvG: 0.5 };
    var OS_PATTES = { avG: ['epauleG', 'coudeG', 'carpeG', 'pattAvG'], avD: ['epauleD', 'coudeD', 'carpeD', 'pattAvD'],
      arG: ['hancheG', 'genouG', 'jarretG', 'pattArG'], arD: ['hancheD', 'genouD', 'jarretD', 'pattArD'] };   // noms précalculés (pas de concaténation par image)
    function fr(x) { return x - Math.floor(x); }
    function ease(s) { return s * s * (3 - 2 * s); }
    /** Patte avant (S = 'G' | 'D') au point u du cycle ; facteurs d'amplitude a (allure) et g (galop). */
    function patteAvant(N, u, D, a, g) {
      var st = u < D, s = st ? u / D : (u - D) / (1 - D), A1 = 0.75 + 0.4 * g;
      var ep = st ? U.lerp(-0.55, 0.42, s) : U.lerp(0.42, -0.55, ease(s));
      var co = st ? 0.08 * Math.sin(PI * s) : 0.75 * Math.sin(PI * Math.min(1, s * 1.25)) - 0.18 * U.smooth(0.7, 1, s);
      var ca = st ? -0.2 * Math.sin(PI * s) : 1.65 * Math.sin(PI * Math.pow(s, 0.85));
      setC(N[0], ep * A1 * a, 0, 0); setC(N[1], co * a, 0, 0); setC(N[2], ca * a, 0, 0); setC(N[3], st ? 0 : 0.4 * Math.sin(PI * s) * a, 0, 0);
    }
    function patteArriere(N, u, D, a, g) {
      var st = u < D, s = st ? u / D : (u - D) / (1 - D), A1 = 0.75 + 0.35 * g;
      var ha = st ? U.lerp(-0.5, 0.62, s) : U.lerp(0.62, -0.5, ease(s));
      var ge = st ? -0.25 * Math.sin(PI * s) : 0.95 * Math.sin(PI * Math.min(1, s * 1.15));
      var ja = st ? 0.28 * Math.sin(PI * s) : -0.95 * Math.sin(PI * s);
      setC(N[0], ha * A1 * a, 0, 0); setC(N[1], ge * a, 0, 0); setC(N[2], ja * a, 0, 0); setC(N[3], st ? 0 : 0.55 * Math.sin(PI * s) * a, 0, 0);
    }
    function appliquerPoseChien(c, dt) {
      for (var i = 0; i < NOMS_CHIEN.length; i++) { var a0 = AC[NOMS_CHIEN[i]]; a0[0] = 0; a0[1] = 0; a0[2] = 0; }
      var t = c.t, s = Math.sin, y0 = 0, tangage = 0, roulis = 0;
      var v = h2(c.vitesse.x, c.vitesse.z), g = U.smooth(2.8, 4.8, v), am = Math.min(1, v / 1.1), cyc = c.phase / TAU;
      if (c.etat === 'course' || c.etat === 'morsure' || c.etat === 'grogne') {
        var D = U.lerp(0.5, 0.33, g);
        patteArriere(OS_PATTES.arG, fr(cyc - U.lerp(DECAL_TROT.pattArG, DECAL_GALOP.pattArG, g)), D, am, g);
        patteArriere(OS_PATTES.arD, fr(cyc - U.lerp(DECAL_TROT.pattArD, DECAL_GALOP.pattArD, g)), D, am, g);
        patteAvant(OS_PATTES.avD, fr(cyc - U.lerp(DECAL_TROT.pattAvD, DECAL_GALOP.pattAvD, g)), D, am, g);
        patteAvant(OS_PATTES.avG, fr(cyc - U.lerp(DECAL_TROT.pattAvG, DECAL_GALOP.pattAvG, g)), D, am, g);
        // colonne qui se replie et s'étend (galop rotatoire), tête stabilisée, gueule entrouverte
        var flex = s(TAU * (cyc - 0.2)) * g * am;
        { var _a = AC.bassin, _x = -0.11 * flex, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.lombes, _x = 0.17 * flex, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.thorax, _x = 0.07 * flex, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.cou, _x = 0.2 * g * am - 0.06 + 0.04 * s(t * 1.7) * (1 - g), _y = 0.08 * s(t * 1.3) * (1 - g), _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.tete, _x = -0.16 * g * am - 0.05 * flex, _y = 0.06 * s(t * 2.1) * (1 - g), _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.machoire, _x = 0.09 + 0.08 * s(t * 8.3) * (0.3 + 0.7 * g), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.queue, _x = 0.3 * s(TAU * cyc) * am - 0.15, _y = 0.25 * s(t * 3.1), _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        y0 = (0.034 * s(TAU * 2 * cyc + 0.6) * g + 0.012 * Math.abs(s(TAU * cyc)) * (1 - g)) * am;
        tangage = 0.045 * s(TAU * cyc + 0.4) * g * am;
        roulis = U.clamp(-c.virage * 0.09, -0.32, 0.32) * Math.min(1, v / 4);
        if (c.etat === 'grogne') {
          // grogne sur place : arrière-train fléchi, tête basse, babines qui tremblent
          var kg = Math.min(1, c.grogneT * 4) * (1 - am);
          { var _a = AC.hancheG, _x = -0.35 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.hancheD, _x = -0.35 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.genouG, _x = 0.5 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.genouD, _x = 0.5 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.jarretG, _x = -0.35 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.jarretD, _x = -0.35 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.epauleG, _x = -0.12 * kg, _y = 0, _z = 0.04 * kg; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.epauleD, _x = -0.12 * kg, _y = 0, _z = -0.04 * kg; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.thorax, _x = 0.12 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.cou, _x = 0.32 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.tete, _x = -0.36 * kg, _y = 0.05 * s(t * 2.3) * kg, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.machoire, _x = (0.06 + 0.035 * s(t * 37)) * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.queue, _x = -0.3 * kg, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          y0 += (-0.05 + 0.004 * s(t * 29)) * kg;
        }
        if (c.etat === 'morsure') {
          var m = c.morsureT, pre = U.smooth(0, 0.09, m) * (1 - U.smooth(0.09, 0.15, m)), saut = U.smooth(0.08, 0.2, m) * (1 - U.smooth(0.3, 0.46, m));
          var claque = U.smooth(0.24, 0.28, m), fin = U.smooth(0.3, 0.5, m) * (1 - U.smooth(0.42, 0.5, m));
          { var _a = AC.hancheG, _x = -0.35 * pre + 0.75 * saut, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.hancheD, _x = -0.35 * pre + 0.75 * saut, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.genouG, _x = 0.45 * pre - 0.3 * saut, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.genouD, _x = 0.45 * pre - 0.3 * saut, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.jarretG, _x = -0.3 * pre + 0.35 * saut, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.jarretD, _x = -0.3 * pre + 0.35 * saut, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.epauleG, _x = -0.9 * saut + 0.25 * fin, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.epauleD, _x = -0.85 * saut + 0.25 * fin, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.coudeG, _x = -0.2 * saut + 0.45 * fin, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.coudeD, _x = -0.2 * saut + 0.45 * fin, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.thorax, _x = 0.1 * pre - 0.1 * saut, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.cou, _x = -0.25 * saut + 0.1 * pre, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.tete, _x = 0.38 * claque * (1 - fin) - 0.1 * saut, _y = 0.12 * s(m * 40) * claque * (1 - fin), _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AC.machoire, _x = 0.05 + 0.85 * U.smooth(0.08, 0.22, m) * (1 - claque) + 0.25 * fin, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          y0 += 0.24 * s(PI * U.clamp((m - 0.09) / 0.32, 0, 1)) - 0.05 * pre;
          tangage += -0.2 * saut + 0.1 * fin;
        }
      } else if (c.etat === 'faille') {
        // jaillit du sol : trajectoire balistique (−0,9 m → +0,5 m → sol à 0,72 s), museau d'abord
        var tf = Math.min(t, 0.72);
        y0 = -0.9 + 6.29 * tf - 7 * tf * tf;
        tangage = U.lerp(-0.75, 0.15, U.smooth(0, 0.72, t));
        var mon = 1 - U.smooth(0.42, 0.62, t);
        { var _a = AC.epauleG, _x = -0.95 * mon - 0.2, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.epauleD, _x = -0.9 * mon - 0.2, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.coudeG, _x = -0.25 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.coudeD, _x = -0.25 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.carpeG, _x = 0.5 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.carpeD, _x = 0.5 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.hancheG, _x = 0.75 * mon - 0.3 * (1 - mon), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.hancheD, _x = 0.75 * mon - 0.3 * (1 - mon), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.genouG, _x = -0.25 * mon + 0.4 * (1 - mon), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.genouD, _x = -0.25 * mon + 0.4 * (1 - mon), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.jarretG, _x = 0.4 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.jarretD, _x = 0.4 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.lombes, _x = -0.12 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.cou, _x = -0.3 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.tete, _x = -0.2 * mon, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.machoire, _x = 0.6, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.queue, _x = 0.4, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
      } else if (c.etat === 'mort') {
        // s'effondre sur le flanc, pattes molles, tête qui retombe
        var km = U.smooth(0, 0.42, t), cote = c.mortCote;
        roulis = cote * 1.32 * km; y0 = 0.02 * km - 0.08 * km * (1 - km) * 4;
        tangage = 0.08 * km;
        { var _a = AC.epauleG, _x = -0.3 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.epauleD, _x = 0.25 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.coudeG, _x = 0.35 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.coudeD, _x = 0.5 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.hancheG, _x = 0.3 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.hancheD, _x = -0.2 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.genouG, _x = 0.4 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.genouD, _x = 0.6 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.lombes, _x = 0.1 * km, _y = 0, _z = 0.12 * cote * km; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.cou, _x = 0.25 * km, _y = 0, _z = -0.25 * cote * km; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.tete, _x = 0.2 * km, _y = 0, _z = -0.2 * cote * km; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.machoire, _x = 0.45 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.queue, _x = -0.3 * km, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
      } else if (c.etat === 'cendres' || c.etat === 'absorbe') {
        // brûle debout puis se couche
        var kc = U.smooth(0, 0.8, t);
        { var _a = AC.hancheG, _x = -0.9 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.hancheD, _x = -0.9 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.genouG, _x = 1.2 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.genouD, _x = 1.2 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.jarretG, _x = -0.9 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.jarretD, _x = -0.9 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.epauleG, _x = 0.6 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.epauleD, _x = 0.6 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AC.coudeG, _x = -1.2 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.coudeD, _x = -1.2 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.cou, _x = 0.4 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AC.machoire, _x = 0.7, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        y0 = -0.3 * kc;
      }
      // réaction aux balles (additive)
      var r = c.reaction;
      if (r > 0) { { var _a = AC.tete, _x = 0.35 * r, _y = 0.28 * r * (c.idx % 2 ? 1 : -1), _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.thorax, _x = 0, _y = 0, _z = 0.18 * r * (c.idx % 2 ? -1 : 1); _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.lombes, _x = 0, _y = 0.12 * r, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AC.cou, _x = -0.15 * r, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } }
      for (var k = 0; k < NOMS_CHIEN.length; k++) {
        var nb = NOMS_CHIEN[k], ab = AC[nb], b = c.os[nb];
        _e.set(ab[0], ab[1], ab[2], 'XYZ'); _q.setFromEuler(_e);
        b.quaternion.copy(c.rest[nb]).multiply(_q);
      }
      c.racineOs.position.set(0, y0, 0);
      c.racineOs.rotation.set(tangage, 0, roulis);
      c.groupe.position.set(c.position.x, c.position.y, c.position.z);
      c.groupe.rotation.y = c.lacet;
      c.hauteur = Math.max(0, y0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    // MINI-BOSS (v1.3, API §15) : Le Survolté et L'Irradié. Même API publique que les zombies (apparaitre({ type:
    // 'survolte' | 'irradie', miniBoss, nom, profil, effet: 'cuve' }), liste, toucher, intersecter, retirer…). Leur IA et
    // leurs capacités tournent ici ; les dégâts des capacités passent par Z.brancherDegats (l'adaptateur s'y branche) et
    // chaque capacité est signalée par surCapacite(z, quoi, info) pour les sons et les effets.
    // ════════════════════════════════════════════════════════════════════════════════════════
    var CFG_MB = root.BOSS_B7_CONFIG && root.BOSS_B7_CONFIG.miniBoss;
    var TYPES_MB = ['survolte', 'irradie', 'demembre'];
    // profils par défaut (= config 1.4) ; la config du combat et le profil transmis à apparaitre() priment
    var PROFILS_MB = {
      survolte: { nom: 'Le Survolté', couleur: '#38D9FF', pv: 4900, vitesse: 5.4, degatsContact: 0.24, cadenceContact: 1.2,
                  decharge: { portee: 8, intervalle: 4, degats: 0.15, flou: 1.0, recharge: 2.0, multi: true, etourdissement: 1.0 } },
      irradie: { nom: 'L’Irradié', couleur: '#8CFF2E', pv: 7350, vitesse: 4.4, degatsContact: 0.16, cadenceContact: 1.4, aura: { rayon: 6, degatsParSeconde: 0.07 },
                 flaque: { rayon: 2.5, duree: 5, degatsParSeconde: 0.07 },
                 boules: { intervalle: 6, parVolee: 2, parJoueurSupp: 1, portee: 24, tempsVol: 1.1, impact: { rayon: 1.2, degats: 0.08 },
                           zone: { rayon: 2.5, dpsBase: 0.04, dpsParSeconde: 0.05, dpsMax: 0.35, oubli: 2 } } },
      demembre: { nom: 'Le Démembré', couleur: '#E3B65C', pv: 5705, vitesse: 4.2, degatsContact: 0.3, cadenceContact: 1.6, echelle: 2,
                  fleau: { portee: 6.0, angle: 150, preparation: 0.7, degats: 0.3 },
                  rage: { seuil: 0.5, capacite: 'arrachement', duree: 2.4, vol: 1.2 },
                  charge: { preparation: 0.8, vitesse: 13, distanceMax: 16, largeur: 1.8, degats: 0.35, projection: { vitesse: 12, duree: 0.5 },
                            impactMur: 0.10, recharge: 3.0, etourdiMur: 1.2 } },
      // v1.5 : petit Démembré (taille normale, bras et fléau) qui sort du bras posé ; ce n'est pas un mini-boss
      demembre_petit: { nom: 'Démembré', couleur: '#E3B65C', pv: 450, vitesse: 4.0, degatsContact: 0.12, cadenceContact: 1.4, echelle: 1,
                        fleau: { portee: 2.4, angle: 140, preparation: 0.6, degats: 0.15 } }
    };
    if (CFG_MB) TYPES_MB.forEach(function (t) { if (CFG_MB[t]) PROFILS_MB[t] = CFG_MB[t]; });
    if (CFG_MB && CFG_MB.demembre && CFG_MB.demembre.petits && CFG_MB.demembre.petits.profil) PROFILS_MB.demembre_petit = CFG_MB.demembre.petits.profil;
    var TYPES_ENT = TYPES_MB.concat(['demembre_petit']);                 // entités du code des mini-boss (le petit n'en est pas un)
    var surCapacite = o.surCapacite || function () {};
    var brancheDegats = [];
    /** Branche un récepteur des dégâts des capacités : fn(z, joueurId, fraction, source, info) → false si les effets (flou,
     *  étourdissement) ne s'appliquent pas (joueur invulnérable…). Sources : 'decharge' | 'aura' | 'flaque' | 'boule' | 'zone' | 'fleau'. */
    Z.brancherDegats = function (fn) { if (typeof fn === 'function') brancheDegats.push(fn); };
    function blesser(m, id, fraction, source, info) {
      info.source = source;
      var ok = true;
      for (var k = 0; k < brancheDegats.length; k++) { try { if (brancheDegats[k](m, id, fraction, source, info) === false) ok = false; } catch (e) { setTimeout(function () { throw e; }); } }
      return ok;
    }
    function signaler(m, quoi, info) { try { surCapacite(m, quoi, info); } catch (e) { setTimeout(function () { throw e; }); } }
    var DUREE_CHARGE = 0.7, DUREE_DECHARGE = 0.3, TICK_ZONE = 0.25;
    // textures : lueur blanche (teintée par sprite), halo d'aura au sol, flaque toxique
    var lueurBlanche = (function () { var c = U.canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return U.tex(THREE, C, c, { clamp: true }); })();
    var texAura = (function () {
      var W = 256, c = U.canvas(W, W), g = c.getContext('2d'), m0 = W / 2;
      var gr = g.createRadialGradient(m0, m0, 0, m0, m0, m0);
      gr.addColorStop(0, 'rgba(150,255,60,0.42)'); gr.addColorStop(0.16, 'rgba(140,255,46,0.16)'); gr.addColorStop(0.3, 'rgba(140,255,46,0.05)'); gr.addColorStop(0.82, 'rgba(140,255,46,0.07)');
      gr.addColorStop(0.93, 'rgba(170,255,80,0.42)'); gr.addColorStop(0.965, 'rgba(210,255,130,0.85)'); gr.addColorStop(1, 'rgba(140,255,46,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, W);
      var R = U.rng(91); g.fillStyle = 'rgba(190,255,110,0.28)';
      for (var k = 0; k < 26; k++) { var a = R() * TAU, r = Math.sqrt(R()) * m0 * 0.85; g.beginPath(); g.arc(m0 + Math.cos(a) * r, m0 + Math.sin(a) * r, 1 + R() * 2.5, 0, TAU); g.fill(); }
      return U.tex(THREE, C, c, { clamp: true });
    })();
    var texFlaque = (function () {
      var W = 256, c = U.canvas(W, W), g = c.getContext('2d'), R = U.rng(93), m0 = W / 2;
      g.clearRect(0, 0, W, W);
      for (var k = 0; k < 14; k++) {
        var a = R() * TAU, d = R() * m0 * 0.42, r = m0 * (0.25 + R() * 0.3), x = m0 + Math.cos(a) * d, y = m0 + Math.sin(a) * d;
        var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,235,40,0.95)'); gr.addColorStop(0.7, 'rgba(70,170,20,0.85)'); gr.addColorStop(1, 'rgba(40,110,10,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(210,255,140,0.8)'; g.lineWidth = 2;
      for (var b = 0; b < 26; b++) { var ab = R() * TAU, db = Math.sqrt(R()) * m0 * 0.6; g.beginPath(); g.arc(m0 + Math.cos(ab) * db, m0 + Math.sin(ab) * db, 2 + R() * 6, 0, TAU); g.stroke(); }
      return U.tex(THREE, C, c, { clamp: true });
    })();
    // v1.4 : zone radioactive (flaque lumineuse qui grésille), repère d'impact des boules (anneau), boule (lueur)
    var texZone = (function () {
      var W = 256, c = U.canvas(W, W), g = c.getContext('2d'), R = U.rng(197), m0 = W / 2;
      g.clearRect(0, 0, W, W);
      var gr = g.createRadialGradient(m0, m0, 0, m0, m0, m0);
      gr.addColorStop(0, 'rgba(120,255,40,0.5)'); gr.addColorStop(0.55, 'rgba(90,230,30,0.34)'); gr.addColorStop(0.86, 'rgba(110,255,40,0.42)'); gr.addColorStop(0.95, 'rgba(170,255,90,0.6)'); gr.addColorStop(1, 'rgba(90,200,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, W);
      for (var k = 0; k < 18; k++) {
        var a = R() * TAU, d = Math.sqrt(R()) * m0 * 0.7, r = m0 * (0.08 + R() * 0.16), x = m0 + Math.cos(a) * d, y = m0 + Math.sin(a) * d;
        var g2 = g.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, 'rgba(200,255,120,0.55)'); g2.addColorStop(1, 'rgba(120,255,40,0)');
        g.fillStyle = g2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(230,255,170,0.85)'; g.lineWidth = 1.6;                                   // craquelures lumineuses
      for (var f = 0; f < 22; f++) {
        var a0 = R() * TAU, r0 = Math.sqrt(R()) * m0 * 0.75, x0 = m0 + Math.cos(a0) * r0, y0 = m0 + Math.sin(a0) * r0;
        g.beginPath(); g.moveTo(x0, y0);
        for (var q = 0; q < 4; q++) { a0 += (R() - 0.5) * 1.6; x0 += Math.cos(a0) * (4 + R() * 9); y0 += Math.sin(a0) * (4 + R() * 9); g.lineTo(x0, y0); }
        g.stroke();
      }
      return U.tex(THREE, C, c, { clamp: true });
    })();
    var texRepere = (function () {
      var W = 128, c = U.canvas(W, W), g = c.getContext('2d'), m0 = W / 2;
      g.clearRect(0, 0, W, W);
      var gr = g.createRadialGradient(m0, m0, 0, m0, m0, m0);
      gr.addColorStop(0, 'rgba(140,255,60,0.16)'); gr.addColorStop(0.8, 'rgba(140,255,60,0.12)'); gr.addColorStop(0.9, 'rgba(210,255,140,0.95)'); gr.addColorStop(0.97, 'rgba(160,255,80,0.6)'); gr.addColorStop(1, 'rgba(140,255,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, W);
      g.strokeStyle = 'rgba(220,255,160,0.9)'; g.lineWidth = 3;
      for (var k = 0; k < 4; k++) { var a = k * PI / 2; g.beginPath(); g.moveTo(m0 + Math.cos(a) * m0 * 0.18, m0 + Math.sin(a) * m0 * 0.18); g.lineTo(m0 + Math.cos(a) * m0 * 0.42, m0 + Math.sin(a) * m0 * 0.42); g.stroke(); }
      return U.tex(THREE, C, c, { clamp: true });
    })();
    // rubans additifs (arcs électriques en lignes brisées, régénérés à chaque image) : 2 quads croisés par segment
    function creerRubans(maxSeg) {
      var g = new THREE.BufferGeometry(), P = new Float32Array(maxSeg * 24), Cc = new Float32Array(maxSeg * 24), I = [];
      for (var s = 0; s < maxSeg; s++) { var b = s * 8; I.push(b, b + 1, b + 2, b + 2, b + 1, b + 3, b + 4, b + 5, b + 6, b + 6, b + 5, b + 7); }
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); g.setIndex(I);
      g.setDrawRange(0, 0);
      var mt = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      mt.toneMapped = false;
      var me = new THREE.Mesh(g, mt); me.frustumCulled = false; me.renderOrder = 6;
      return { mesh: me, P: P, C: Cc, n: 0, max: maxSeg };
    }
    // Les nombres passent par des tampons Float64Array réutilisés (SEG, ARC) et non par des arguments : un appel non inliné
    // « emballerait » chaque nombre passé en argument (une allocation par nombre et par appel).
    var SEG = new Float64Array(10);   // ax, ay, az, bx, by, bz, largeur, r, g, b
    function segment(Rb) {
      if (Rb.n >= Rb.max) return;
      var ax = SEG[0], ay = SEG[1], az = SEG[2], bx = SEG[3], by = SEG[4], bz = SEG[5], w = SEG[6], cr = SEG[7], cg = SEG[8], cb = SEG[9];
      var dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; dx /= L; dy /= L; dz /= L;
      var ux = -dz, uz = dx, ul = Math.sqrt(ux * ux + uz * uz);
      if (ul < 1e-3) { ux = 1; uz = 0; ul = 1; }
      ux /= ul; uz /= ul;
      var vx = dy * uz, vy = dz * ux - dx * uz, vz = -dy * ux;
      var P = Rb.P, Cc = Rb.C, b = Rb.n * 24;
      P[b] = ax + ux * w; P[b + 1] = ay; P[b + 2] = az + uz * w; P[b + 3] = ax - ux * w; P[b + 4] = ay; P[b + 5] = az - uz * w;
      P[b + 6] = bx + ux * w; P[b + 7] = by; P[b + 8] = bz + uz * w; P[b + 9] = bx - ux * w; P[b + 10] = by; P[b + 11] = bz - uz * w;
      P[b + 12] = ax + vx * w; P[b + 13] = ay + vy * w; P[b + 14] = az + vz * w; P[b + 15] = ax - vx * w; P[b + 16] = ay - vy * w; P[b + 17] = az - vz * w;
      P[b + 18] = bx + vx * w; P[b + 19] = by + vy * w; P[b + 20] = bz + vz * w; P[b + 21] = bx - vx * w; P[b + 22] = by - vy * w; P[b + 23] = bz - vz * w;
      for (var q = 0; q < 24; q += 3) { Cc[b + q] = cr; Cc[b + q + 1] = cg; Cc[b + q + 2] = cb; }
      Rb.n++;
    }
    /** Arc en ligne brisée de A vers B (n segments, amplitude amp, largeur w, intensité k), avec une branche éventuelle.
     *  Paramètres dans ARC : [ax, ay, az, bx, by, bz, amp, w, k] (à remplir avant l'appel). */
    var ARC = new Float64Array(9);
    function arcElectrique(Rb, n, branche) {
      var ax = ARC[0], ay = ARC[1], az = ARC[2], bx = ARC[3], by = ARC[4], bz = ARC[5], amp = ARC[6], w = ARC[7], k = ARC[8];
      var dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      var ex = dx / L, ey = dy / L, ez = dz / L;
      var p1x = -ez, p1z = ex, pl = Math.sqrt(p1x * p1x + p1z * p1z); if (pl < 1e-3) { p1x = 1; p1z = 0; pl = 1; } p1x /= pl; p1z /= pl;
      var p2x = ey * p1z, p2y = ez * p1x - ex * p1z, p2z = -ey * p1x;
      var px = ax, py = ay, pz = az, br = branche ? 1 + Math.floor(alea() * (n - 2)) : -1;
      for (var i = 1; i <= n; i++) {
        var t = i / n, a = i < n ? amp * Math.sin(PI * t) * (0.45 + alea() * 0.9) : 0;
        var r1 = (alea() - 0.5) * 2 * a, r2 = (alea() - 0.5) * 2 * a;
        var qx = ax + dx * t + p1x * r1 + p2x * r2, qy = ay + dy * t + p2y * r2, qz = az + dz * t + p1z * r1 + p2z * r2;
        SEG[0] = px; SEG[1] = py; SEG[2] = pz; SEG[3] = qx; SEG[4] = qy; SEG[5] = qz;
        SEG[6] = w * 3.2; SEG[7] = 0.06 * k; SEG[8] = 0.32 * k; SEG[9] = 0.5 * k; segment(Rb);      // halo
        SEG[6] = w; SEG[7] = 0.62 * k; SEG[8] = 0.93 * k; SEG[9] = k; segment(Rb);                  // cœur
        if (i === br) {
          var bxx = qx, byy = qy, bzz = qz, lb = L * (0.18 + alea() * 0.2), sgn = alea() < 0.5 ? -1 : 1;
          for (var j = 1; j <= 3; j++) {
            var nx = bxx + (ex * 0.5 + p1x * sgn * 0.8) * lb / 3 + (alea() - 0.5) * lb * 0.25, ny = byy + (ey * 0.5 + p2y * 0.3) * lb / 3 + (alea() - 0.5) * lb * 0.25, nz = bzz + (ez * 0.5 + p1z * sgn * 0.8) * lb / 3 + (alea() - 0.5) * lb * 0.25;
            SEG[0] = bxx; SEG[1] = byy; SEG[2] = bzz; SEG[3] = nx; SEG[4] = ny; SEG[5] = nz; SEG[6] = w * 0.7; SEG[7] = 0.45 * k; SEG[8] = 0.8 * k; SEG[9] = 0.95 * k; segment(Rb);
            bxx = nx; byy = ny; bzz = nz;
          }
        }
        px = qx; py = qy; pz = qz;
      }
    }
    function finRubans(Rb) {
      var g = Rb.mesh.geometry;
      g.setDrawRange(0, Rb.n * 12);
      if (Rb.n > 0) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; }
    }
    // particules : étincelles cyan (gravité), spores vertes (montent), vapeur
    var etincelles = {}, spores = {}, vapeurs = {}, listeEtincelles = [], listeSpores = [], listeVapeurs = [];
    function systeme(table, liste, lieu, taille, couleur, carte) {
      if (table[lieu]) return table[lieu];
      var g2 = new THREE.BufferGeometry(), P2 = new Float32Array(NT * 3); for (var k = 0; k < NT; k++) P2[k * 3 + 1] = -999;
      g2.setAttribute('position', new THREE.BufferAttribute(P2, 3));
      var mt = new THREE.PointsMaterial({ map: carte || lueurBlanche, size: taille, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: C.couleur(couleur) });
      mt.toneMapped = false;
      var pts = new THREE.Points(g2, mt); pts.frustumCulled = false;
      if (monde) monde.scenes[lieu].add(pts);
      table[lieu] = { pts: pts, P: P2, V: new Float32Array(NT * 3), vie: new Float32Array(NT), i: 0 };
      liste.push(table[lieu]);
      return table[lieu];
    }
    // gouttes opaques (sang) : mélange normal (l'additif rendrait le sang lumineux)
    function systemeNormal(table, liste, lieu, taille, couleur) {
      if (table[lieu]) return table[lieu];
      var g2 = new THREE.BufferGeometry(), P2 = new Float32Array(NT * 3); for (var k = 0; k < NT; k++) P2[k * 3 + 1] = -999;
      g2.setAttribute('position', new THREE.BufferAttribute(P2, 3));
      var mt = new THREE.PointsMaterial({ map: lueurBlanche, size: taille, transparent: true, depthWrite: false, color: C.couleur(couleur), alphaTest: 0.05 });
      var pts = new THREE.Points(g2, mt); pts.frustumCulled = false;
      if (monde) monde.scenes[lieu].add(pts);
      table[lieu] = { pts: pts, P: P2, V: new Float32Array(NT * 3), vie: new Float32Array(NT), i: 0 };
      liste.push(table[lieu]);
      return table[lieu];
    }
    function etincellesPour(lieu) { return systeme(etincelles, listeEtincelles, lieu, 0.045, 0x9ff0ff); }
    function sporesPour(lieu) { return systeme(spores, listeSpores, lieu, 0.06, 0x8cff2e); }
    function vapeurPour(lieu) { return systeme(vapeurs, listeVapeurs, lieu, 0.42, 0x2f4a1c); }
    var crepits = {}, listeCrepits = [];
    function crepitementsPour(lieu) { return systeme(crepits, listeCrepits, lieu, 0.035, 0xdcff9a); }   // v1.4 : grésillement des zones radioactives
    var sangs = {}, listeSangs = [];
    function sangPour(lieu) { return systemeNormal(sangs, listeSangs, lieu, 0.07, 0x7a0805); }        // v1.5 : gerbes de sang (bras arraché)
    var COUL_CYAN = C.couleur(0x38d9ff), COUL_VERT = C.couleur(0x8cff2e), COUL_FLASH = C.couleur(0xc8f6ff);
    var MAX_MB_TYPE = o.maxMiniBoss || 2, mbs = [];
    function infoVide(source) { return { cible: null, position: { x: 0, y: 0, z: 0 }, impact: { x: 0, y: 0, z: 0 }, degats: 0, flou: 0, duree: 0, rayon: 0, touche: false, etat: '', intensite: 0, source: source || '', id: null, etourdissement: 0,
      projection: { vx: 0, vz: 0, duree: 0 } }; }
    function creerMiniBoss(type, i) {
      var fam = type === 'demembre_petit' ? 'demembre' : type;            // v1.5 : le petit Démembré a le modèle et l'IA du Démembré
      var matC = patch(matBase.clone()); if ('skinning' in matBase && C.rev < 136) matC.skinning = true;
      matC.emissive = fam === 'irradie' ? new THREE.Color(0.075, 0.062, 0.004) : fam === 'demembre' ? new THREE.Color(0.012, 0.014, 0.008) : new THREE.Color(0.006, 0.016, 0.03); matC.emissiveIntensity = 1;
      var matE = matEmissifMB(THREE, C);
      var I = instancierMiniBoss(THREE, C, fam, matC, matE), M = I.modele, sv = fam === 'survolte', ir = fam === 'irradie', dm = fam === 'demembre';
      var coulYeux = sv ? COUL_CYAN : ir ? COUL_VERT : C.couleur(0xf6e7a6);
      var mh = new THREE.SpriteMaterial({ map: lueurBlanche, color: coulYeux, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); mh.toneMapped = false;
      var halos = M.yeux.map(function (p) {
        var h = new THREE.Sprite(mh); h.scale.set(dm ? 0.06 : 0.075, dm ? 0.06 : 0.075, 1);
        h.position.set(p[0] - POS.tete[0], p[1] - POS.tete[1], p[2] - POS.tete[2] + 0.014); I.os.tete.add(h); return h;
      });
      // lueurs : mains (Survolté) ou torse (Irradié) ; aucune pour le Démembré
      var ml = new THREE.SpriteMaterial({ map: lueurBlanche, color: sv ? COUL_CYAN : COUL_VERT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }); ml.toneMapped = false;
      var lueurs = [];
      if (sv) ['mainG', 'mainD'].forEach(function (n, k) { var s0 = new THREE.Sprite(ml); s0.scale.set(0.22, 0.22, 1); s0.position.set((k ? -1 : 1) * 0.006, -0.07, 0.02); I.os[n].add(s0); lueurs.push(s0); });
      else if (ir) { var st = new THREE.Sprite(ml); st.scale.set(0.55, 0.55, 1); st.position.set(0, 0.0, 0.2); I.os.poitrine.add(st); lueurs.push(st); }
      var bolts = [];
      if (sv) for (var kb = 0; kb < 4; kb++) bolts.push({ t: 0, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, touche: false });
      var m = {
        idx: i, type: type, fam: fam, mb: true, miniBoss: type !== 'demembre_petit', id: null, actif: false, groupe: I.groupe, racineOs: I.racineOs, mesh: I.mesh, meshE: I.meshEmissif, os: I.os, rest: I.rest, restPos: I.restPos,
        mat: matC, matE: matE, halos: halos, matHalo: mh, lueurs: lueurs, matLueur: ml, modele: M,
        lieu: 'salle', position: new THREE.Vector3(), vitesse: new THREE.Vector3(), lacet: 0, etat: 'inactif', t: 0,
        pv: 1, pvMax: 1, nom: '', couleur: '', degats: 0.2, vitesseMax: 3, agressif: true, source: null,
        profil: { nom: '', couleur: '', pv: 1, vitesse: 3, degatsContact: 0.2, cadenceContact: 1.2,
          decharge: { portee: 8, intervalle: 4, degats: 0.15, flou: 1, recharge: 2, multi: true, etourdissement: 1 },
          aura: { rayon: 6, degatsParSeconde: 0.07 }, flaque: { rayon: 2.5, duree: 5, degatsParSeconde: 0.07 },
          boules: { intervalle: 6, parVolee: 2, parJoueurSupp: 1, portee: 24, tempsVol: 1.1, impact: { rayon: 1.2, degats: 0.08 }, zone: { rayon: 2.5, dpsBase: 0.04, dpsParSeconde: 0.05, dpsMax: 0.35, oubli: 2 } },
          fleau: { portee: 2.6, angle: 150, preparation: 0.55, degats: 0.3 }, echelle: 1, rageDuree: 0,
          charge: { preparation: 0.8, vitesse: 13, distanceMax: 16, largeur: 1.8, degats: 0.35, projVitesse: 12, projDuree: 0.5, impactMur: 0.1, recharge: 3, etourdiMur: 1.2 } },
        mode: 'chasse', modeT: 0, dechargeT: 0, cible: null, cibleDist: 1e9, spasmeT: 0, prochainSpasme: 2, attenteContact: 0, attaqueT: 0, attaqueFrappee: false,
        auraT: 0, reaction: 0, phase: 0, virage: 0, hauteur: 0, decalage: 0, bloqueT: 0, derniereDist: 1e9, strafe: 1, strafeT: 0, mortAvant: false, flaqueFaite: false,
        cuve: { actif: false, sx: 0, sz: 0, px: 0, pz: 0, y: 0 }, lumiere: null, flash: 0, chargeK: 0,
        rubans: sv ? creerRubans(360) : null, bolt: sv ? bolts[0] : null, bolts: bolts, nbBolts: 0,
        haloSol: null, scale: sv ? 0.97 : ir ? 1.05 : 1.08, danger: { type: 'cercle', centre: { x: 0, z: 0 }, rayon: 3, lieu: 'salle', source: 'aura' },
        info: infoVide(''),
        vue: { id: null, position: { x: 0, y: 0, z: 0 }, vivant: true, lieu: 'salle', etat: '', type: type, source: null, pv: 0, pvMax: 0, nom: null, miniBoss: type !== 'demembre_petit', couleur: '' },
        // v1.5 : échelle (Démembré géant ×2), rayons de collision et de séparation, masse ; rages (surcharge, arrachement, cri) ;
        // invulnérabilité ; bras arraché, charge ; irradiation (petits Démembrés)
        scaleBase: sv ? 0.97 : ir ? 1.05 : 1.08, echelle: 1, rayonCol: sv ? 0.36 : ir ? 0.42 : 0.44, rayonS: sv ? 0.42 : ir ? 0.5 : 0.52, masse: 0.15,
        invulT: 0, rage: null, rageT: 0, rageD: 0, surcharge: false, sourceX: 0, sourceY: 0, sourceZ: 0,
        sansBras: false, arr: { phase: 0, cx: 0, cz: 0, vol: 1.2, tArr: 0.66, tLance: 1.2, objet: null },
        chargeAttente: 0, chDirX: 0, chDirZ: 1, chX0: 0, chZ0: 0, chDist: 0, chTouches: {},
        dangerCh: { type: 'ligne', a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, largeur: 1.8, lieu: 'salle', source: 'charge', actif: false },
        irrActif: false, irrRayon: 1.5, irrDps: 0.04, irrCoul: new THREE.Color(0.55, 1, 0.18), fleauK: 0,
        // Irradié (v1.4) : salves de boules, expositions par joueur aux zones ; Démembré : fléau, bras pendu (pendule)
        bouleT: 0, bouleTour: 0, lance: false, expos: {}, frappeFaite: false, fleauPsi: 0,
        bras: dm ? { init: false, cx: 0, cy: 0, cz: 0, vx: 0, vy: 0, vz: 0, px: 0, py: 0, pz: 0, coude: 0.15, script: false } : null,
        pousse: false
      };
      if (ir) {
        var ha = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texAura, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
        ha.material.toneMapped = false; ha.rotation.x = -PI / 2; ha.visible = false; ha.renderOrder = 2; m.haloSol = ha;
      }
      I.groupe.visible = false;
      return m;
    }
    TYPES_MB.forEach(function (t) { for (var k = 0; k < MAX_MB_TYPE; k++) mbs.push(creerMiniBoss(t, mbs.length)); });
    // v1.5 : petits Démembrés (flot qui sort du bras posé : au plus 6 en solo, +2 par joueur → 12 en coop à 4, + marge)
    var MAX_PETITS = o.maxPetits || 14;
    for (var kpt = 0; kpt < MAX_PETITS; kpt++) mbs.push(creerMiniBoss('demembre_petit', mbs.length));
    // flaques toxiques (indépendantes de l'entité : elles durent après sa disparition)
    var flaques = [];
    for (var fq = 0; fq < 3; fq++) {
      var fm = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texFlaque, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      fm.material.toneMapped = false; fm.rotation.x = -PI / 2; fm.visible = false; fm.renderOrder = 2;
      flaques.push({ mesh: fm, actif: false, x: 0, z: 0, lieu: 'salle', rayon: 2.5, duree: 5, dps: 0.07, t: 0, tick: 0, source: null, danger: { type: 'cercle', centre: { x: 0, z: 0 }, rayon: 2.5, lieu: 'salle', source: 'flaque' },
        info: infoVide('flaque') });
    }
    function fusionnerProfil(m, pr) {
      var B = PROFILS_MB[m.type] || {}, P = m.profil;
      pr = pr || {};
      function v(a, b, d) { return a != null ? a : (b != null ? b : d); }
      function pos(a, b, d) { return a > 0 ? a : (b > 0 ? b : d); }
      P.nom = pr.nom || B.nom || m.type; P.couleur = pr.couleur || B.couleur || '#ffffff';
      P.pv = pos(pr.pv, B.pv, 1000); P.vitesse = pos(pr.vitesse, B.vitesse, 3);
      P.degatsContact = v(pr.degatsContact, B.degatsContact, 0.2); P.cadenceContact = pos(pr.cadenceContact, B.cadenceContact, 1.2);
      var d0 = B.decharge || {}, d1 = pr.decharge || {}, a0 = B.aura || {}, a1 = pr.aura || {}, f0 = B.flaque || {}, f1 = pr.flaque || {};
      P.decharge.portee = pos(d1.portee, d0.portee, 8); P.decharge.intervalle = pos(d1.intervalle, d0.intervalle, 4);
      P.decharge.degats = v(d1.degats, d0.degats, 0.15); P.decharge.flou = v(d1.flou, d0.flou, 1); P.decharge.recharge = pos(d1.recharge, d0.recharge, 2);
      P.decharge.multi = v(d1.multi, d0.multi, false) !== false; P.decharge.etourdissement = v(d1.etourdissement, d0.etourdissement, 0);
      P.aura.rayon = pos(a1.rayon, a0.rayon, 3); P.aura.degatsParSeconde = v(a1.degatsParSeconde, a0.degatsParSeconde, 0.07);
      P.flaque.rayon = pos(f1.rayon, f0.rayon, 2.5); P.flaque.duree = pos(f1.duree, f0.duree, 5); P.flaque.degatsParSeconde = v(f1.degatsParSeconde, f0.degatsParSeconde, 0.07);
      var b0 = B.boules || {}, b1 = pr.boules || {}, i0 = b0.impact || {}, i1 = b1.impact || {}, z0 = b0.zone || {}, z1 = b1.zone || {}, BO = P.boules;
      BO.intervalle = pos(b1.intervalle, b0.intervalle, 0); BO.parVolee = v(b1.parVolee, b0.parVolee, 0); BO.parJoueurSupp = v(b1.parJoueurSupp, b0.parJoueurSupp, 0);
      BO.portee = pos(b1.portee, b0.portee, 24); BO.tempsVol = pos(b1.tempsVol, b0.tempsVol, 1.1);
      BO.impact.rayon = pos(i1.rayon, i0.rayon, 1.2); BO.impact.degats = v(i1.degats, i0.degats, 0.08);
      BO.zone.rayon = pos(z1.rayon, z0.rayon, 2.5); BO.zone.dpsBase = v(z1.dpsBase, z0.dpsBase, 0.04); BO.zone.dpsParSeconde = v(z1.dpsParSeconde, z0.dpsParSeconde, 0.05);
      BO.zone.dpsMax = v(z1.dpsMax, z0.dpsMax, 0.35); BO.zone.oubli = pos(z1.oubli, z0.oubli, 2);
      var e0 = B.fleau || {}, e1 = pr.fleau || {}, FL = P.fleau;
      FL.portee = pos(e1.portee, e0.portee, 2.6); FL.angle = pos(e1.angle, e0.angle, 150); FL.preparation = pos(e1.preparation, e0.preparation, 0.55); FL.degats = v(e1.degats, e0.degats, P.degatsContact);
      // v1.5 : échelle (Démembré géant), charge du Démembré sans bras, durée de la rage (reprise après une remise devant la cuve)
      P.echelle = pos(pr.echelle, B.echelle, 1);
      var c0 = B.charge || {}, c1 = pr.charge || {}, j0 = c0.projection || {}, j1 = c1.projection || {}, CH = P.charge;
      CH.preparation = pos(c1.preparation, c0.preparation, 0.8); CH.vitesse = pos(c1.vitesse, c0.vitesse, 13); CH.distanceMax = pos(c1.distanceMax, c0.distanceMax, 16);
      CH.largeur = pos(c1.largeur, c0.largeur, 1.8); CH.degats = v(c1.degats, c0.degats, 0.35); CH.projVitesse = pos(j1.vitesse, j0.vitesse, 12); CH.projDuree = pos(j1.duree, j0.duree, 0.5);
      CH.impactMur = v(c1.impactMur, c0.impactMur, 0.1); CH.recharge = pos(c1.recharge, c0.recharge, 3); CH.etourdiMur = pos(c1.etourdiMur, c0.etourdiMur, 1.2);
      var r0 = B.rage || {}, r1 = pr.rage || {}; P.rageDuree = pos(r1.duree, r0.duree, 0);
    }
    function apparaitreMiniBoss(opts) {
      var type = TYPES_ENT.indexOf(opts.type) >= 0 ? opts.type : 'survolte', m = null;
      for (var k = 0; k < mbs.length; k++) if (mbs[k].type === type && !mbs[k].actif) { m = mbs[k]; break; }
      if (!m) return null;
      var p = opts.position;
      m.id = 'm' + (prochainId++); parId[m.id] = m;
      fusionnerProfil(m, opts.profil);
      m.nom = opts.nom || m.profil.nom; m.couleur = m.profil.couleur;
      m.pv = opts.pv > 0 ? opts.pv : m.profil.pv; m.pvMax = opts.pvMax > 0 ? opts.pvMax : (opts.profil && opts.profil.pvMax > 0 ? opts.profil.pvMax : m.pv);
      m.degats = m.profil.degatsContact; m.vitesseMax = typeof opts.vitesse === 'number' ? opts.vitesse : m.profil.vitesse;
      m.actif = true; m.lieu = opts.lieu || (monde && monde.lieuDe ? monde.lieuDe(p.x) : 'salle'); m.source = opts.source || null; m.agressif = opts.agressif !== false;
      m.position.set(p.x, 0, p.z); m.vitesse.set(0, 0, 0);
      m.mode = 'chasse'; m.modeT = 0; m.dechargeT = m.profil.decharge.intervalle * 0.5; m.spasmeT = 0; m.prochainSpasme = 1.5 + alea() * 1.5;
      m.attenteContact = 0.8; m.attaqueT = 0; m.attaqueFrappee = false; m.auraT = 0; m.reaction = 0; m.virage = 0; m.hauteur = 0; m.bloqueT = 0; m.derniereDist = 1e9;
      m.decalage = alea() * 2 - 1; m.flash = 0; m.chargeK = 0; m.flaqueFaite = false; m.cible = null;
      for (var kb = 0; kb < m.bolts.length; kb++) m.bolts[kb].t = 0;
      m.nbBolts = 0; m.bouleT = m.profil.boules.intervalle * 0.5; m.lance = false; m.frappeFaite = false; m.fleauPsi = 0;
      for (var ke in m.expos) { var ex = m.expos[ke]; ex.expo = 0; ex.hors = 99; ex.tick = 0; }
      if (m.bras) m.bras.init = false;
      if (m.mat.userData.u) { var u = m.mat.userData.u; u.uDissolution.value = 0; u.uBrulure.value = 0; u.uDesseche.value = 0; u.uLueur.value = 0; u.uIrradie.value = 0; }
      m.matE.color.setRGB(1, 1, 1); for (var hh = 0; hh < m.halos.length; hh++) m.halos[hh].visible = true; m.matLueur.opacity = 0.8;
      for (var l = 0; l < m.lueurs.length; l++) m.lueurs[l].visible = true;
      // v1.5 : échelle (Démembré géant ×2 : modèle, zones de tir, collision, séparation, cadence des pas), rages, bras, charge
      var E = m.profil.echelle > 0 ? m.profil.echelle : 1, f0 = m.fam;
      m.echelle = E; m.scale = m.scaleBase * E;
      m.rayonCol = (f0 === 'irradie' ? 0.42 : f0 === 'demembre' ? 0.44 : 0.36) * E; m.rayonS = (f0 === 'irradie' ? 0.5 : f0 === 'demembre' ? 0.52 : 0.42) * E;
      m.masse = m.miniBoss ? 0.15 / (E * E) : 0.6;
      SEP_R[m.it] = m.rayonS; SEP_M[m.it] = m.masse; COL_R[m.it] = m.rayonCol; IRR_K[m.it] = 0;
      m.invulT = 0; m.rage = null; m.rageT = 0; m.rageD = 0; m.surcharge = false; m.sansBras = false; m.arr.phase = 0; m.arr.objet = null;
      m.chargeAttente = 0; m.chDist = 0; m.dangerCh.actif = false; m.irrActif = false; m.fleauK = 0;
      if (m.os.brasLibre) m.os.brasLibre.scale.setScalar(1);
      m.groupe.visible = true; m.groupe.scale.setScalar(m.scale);
      // sortie de cuve : il bascule du socle, tombe à quatre pattes devant la cuve et se redresse
      var tube = opts.effet === 'cuve' && monde && monde.tubes ? tubeProche(p.x, p.z, type) : null;
      if (tube) {
        var dx = p.x - tube.x, dz = p.z - tube.z, dl = h2(dx, dz) || 1, rT = (tube.rayon || 0.85) * 0.85; dx /= dl; dz /= dl;   // départ : avant du verre
        m.cuve.actif = true; m.cuve.sx = tube.x + dx * rT; m.cuve.sz = tube.z + dz * rT; m.cuve.px = p.x; m.cuve.pz = p.z;
        m.position.set(m.cuve.sx, 0, m.cuve.sz); m.lacet = Math.atan2(dx, dz); m.etat = 'cuve';
        m.lumiere = f0 !== 'demembre' && monde.emprunterLumiereTube ? monde.emprunterLumiereTube(tube.id) : null;   // le Démembré ne luit pas : la cuve garde sa lumière
        if (monde.cacherDormeur) monde.cacherDormeur(tube.id);
      } else if (opts.effet === 'bras') {
        // v1.5 : petit Démembré : il s'extrait du sol près du bras posé, en rampant (vers l'extérieur du bras)
        var Bo = brasLePlusProche(p.x, p.z), ex = Bo ? p.x - Bo.x1 : Math.sin(alea() * TAU), ez = Bo ? p.z - Bo.z1 : Math.cos(alea() * TAU), el = h2(ex, ez) || 1;
        ex /= el; ez /= el;
        m.cuve.actif = false; m.etat = 'bras'; m.cuve.sx = p.x; m.cuve.sz = p.z; m.cuve.px = p.x + ex * 0.55; m.cuve.pz = p.z + ez * 0.55;
        m.lacet = Math.atan2(ex, ez); m.lumiere = null;
        decal(p.x, p.z, m.lieu, 7, 1.0, [0.3, 0.05, 0.04]); projeter(terrePour(m.lieu), p.x, 0.05, p.z, 30, 2.2, 0.5, 0.5); projeter(sangPour(m.lieu), p.x, 0.1, p.z, 16, 2.6, 0.4, 0.4);
      } else {
        m.cuve.actif = false; m.etat = opts.effet === 'cuve' ? 'cuve' : 'actif';
        m.cuve.sx = m.cuve.px = p.x; m.cuve.sz = m.cuve.pz = p.z;
        m.lacet = opts.lacet != null ? opts.lacet : alea() * TAU; m.lumiere = null;
      }
      m.t = 0;
      placerDansScene(m);
      if (monde) {
        var sc = monde.scenes[m.lieu];
        if (m.rubans && m.rubans.mesh.parent !== sc) sc.add(m.rubans.mesh);
        if (m.haloSol && m.haloSol.parent !== sc) sc.add(m.haloSol);
      }
      if (m.rubans) { m.rubans.n = 0; finRubans(m.rubans); m.rubans.mesh.visible = true; }
      if (m.haloSol) m.haloSol.visible = false;
      appliquerPoseMB(m, 0);
      return m.id;
    }
    function tubeProche(x, z, type) {
      var T = monde.tubes, best = null, bd = 1e9;
      for (var k = 0; k < T.length; k++) { var d = h2(T[k].x - x, T[k].z - z) + (T[k].miniBoss === type ? 0 : 5); if (d < bd) { bd = d; best = T[k]; } }
      return bd < 9 ? best : null;
    }
    function cibleMB(m, joueurs) {
      var best = null, bd = 1e9;
      for (var q = 0; q < joueurs.length; q++) {
        var j = joueurs[q];
        if (!j.vivant || j.lieu !== m.lieu) continue;
        var d = h2(j.position.x - m.position.x, j.position.z - m.position.z);
        if (d < bd) { bd = d; best = j; }
      }
      m.cibleDist = bd; m.cible = best;
      return best;
    }
    var _dmb = { x: 0, z: 0 }, _o3 = { x: 0, y: 0, z: 0 }, _d3 = { x: 0, y: 0, z: 0 }, _vm = new THREE.Vector3(), _vm2 = new THREE.Vector3();
    /** Déplacement : 'approche' (ligne droite praticable ou champ de flux), 'recul', 'flanc', 'arret'. */
    function deplacerMB(m, dt, temps, cible, mode, vmax) {
      var vx = 0, vz = 0;
      if (cible && mode !== 'arret') {
        var ex = cible.position.x - m.position.x, ez = cible.position.z - m.position.z, bd = h2(ex, ez) || 1e-6;
        if (mode === 'approche') {
          var gz = monde && monde.grilles ? monde.grilles[m.lieu] : null;
          var direct = !monde || (bd < 16 && (gz ? gz.lignePraticable(m.position.x, m.position.z, cible.position.x, cible.position.z) : monde.visible(m.position, cible.position, m.lieu)));
          if (direct && gz && m.echelle > 1.2) {                          // v1.5 : géant : la ligne droite doit être libre sur toute sa largeur
            var ox = -ez / bd * 0.45 * m.echelle, oz = ex / bd * 0.45 * m.echelle;
            direct = gz.lignePraticable(m.position.x + ox, m.position.z + oz, cible.position.x + ox, cible.position.z + oz) && gz.lignePraticable(m.position.x - ox, m.position.z - oz, cible.position.x - ox, cible.position.z - oz);
          }
          if (direct) { _dmb.x = ex / bd; _dmb.z = ez / bd; }
          else { var ch = champPour(cible, temps); if (ch) ch.direction(m.position.x, m.position.z, _dmb); else { _dmb.x = ex / bd; _dmb.z = ez / bd; } }
          vx = _dmb.x * vmax; vz = _dmb.z * vmax;
        } else if (mode === 'recul') { vx = -ex / bd * vmax + -ez / bd * m.strafe * vmax * 0.35; vz = -ez / bd * vmax + ex / bd * m.strafe * vmax * 0.35; }
        else if (mode === 'flanc') { vx = -ez / bd * m.strafe * vmax; vz = ex / bd * m.strafe * vmax; }
      }
      var k = Math.min(1, dt * 5);
      m.vitesse.x += (vx - m.vitesse.x) * k; m.vitesse.z += (vz - m.vitesse.z) * k;
      var depl = h2(m.vitesse.x, m.vitesse.z) * dt, nSp = depl > 0.12 ? Math.min(5, Math.ceil(depl / 0.12)) : 1;
      for (var sp = 0; sp < nSp; sp++) {
        m.position.x += m.vitesse.x * dt / nSp; m.position.z += m.vitesse.z * dt / nSp;
        if (monde) { _pos.x = m.position.x; _pos.z = m.position.z; monde.resoudre(m.lieu, _pos, m.rayonCol); m.position.x = _pos.x; m.position.z = _pos.z; }
      }
    }
    function tourner(m, dt, vise, vitesse) {
      var l0 = m.lacet;
      m.lacet += U.angleDiff(m.lacet, vise) * Math.min(1, dt * vitesse);
      m.virage += (U.angleDiff(l0, m.lacet) / Math.max(dt, 1e-4) - m.virage) * Math.min(1, dt * 6);
    }
    function posOs(m, nom, out) { out.setFromMatrixPosition(m.os[nom].matrixWorld); return out; }
    /** Décharge du Survolté : arc jusqu'à la poitrine de la cible (ligne de vue), dégâts + vision brouillée, éclair. */
    /** Décharge du Survolté (v1.4 : multiple) : un arc vers chaque joueur valide à portée et en ligne de vue, en même temps
     *  (dégâts, vision brouillée, étourdissement) ; personne : l'arc s'écrase sur l'obstacle ou s'éteint au bout de sa portée. */
    function tirerDecharge(m, cible, joueurs) {
      var D = m.profil.decharge, info = m.info, n = 0, premier = null;
      m.groupe.updateMatrixWorld(true);
      posOs(m, 'mainG', _vm); posOs(m, 'mainD', _vm2);
      var ax = (_vm.x + _vm2.x) * 0.5, ay = (_vm.y + _vm2.y) * 0.5 - 0.05, az = (_vm.z + _vm2.z) * 0.5;
      info.flou = D.flou; info.etourdissement = D.etourdissement; info.rayon = 0; info.intensite = 1; info.id = null;
      for (var q = 0; q < joueurs.length && n < m.bolts.length; q++) {
        var j = joueurs[q];
        if (!j.vivant || j.lieu !== m.lieu || (!D.multi && j !== cible)) continue;
        var bx = j.position.x, by = (j.position.y || 0) + 1.25, bz = j.position.z;
        var dist = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay) + (bz - az) * (bz - az));
        if (dist > D.portee + 1.2 || (monde && !monde.visible(m.position, j.position, m.lieu))) continue;
        var B = m.bolts[n++]; B.t = DUREE_DECHARGE; B.ax = ax; B.ay = ay; B.az = az; B.bx = bx; B.by = by; B.bz = bz; B.touche = true;
        if (!premier) premier = j;
        info.cible = j.id; info.position.x = ax; info.position.y = ay; info.position.z = az; info.impact.x = bx; info.impact.y = by; info.impact.z = bz;
        info.degats = D.degats; info.duree = D.recharge; info.touche = true; info.etat = 'touche';
        var applique = blesser(m, j.id, D.degats, 'decharge', info);
        if (applique && D.etourdissement > 0) {
          info.position.x = bx; info.position.y = by; info.position.z = bz; info.duree = D.etourdissement; info.etat = 'etourdi';
          signaler(m, 'etourdi', info);
        }
        projeter(etincellesPour(m.lieu), bx, by, bz, 26, 3.2, 0.25, 0.25);
      }
      if (!n) {
        var cx = cible ? cible.position.x : ax + Math.sin(m.lacet) * D.portee, cy = cible ? (cible.position.y || 0) + 1.25 : ay, cz = cible ? cible.position.z : az + Math.cos(m.lacet) * D.portee;
        var dist2 = Math.sqrt((cx - ax) * (cx - ax) + (cy - ay) * (cy - ay) + (cz - az) * (cz - az)), lim = Math.min(dist2, D.portee);
        if (monde && monde.tir && dist2 > 1e-3) {
          _o3.x = ax; _o3.y = ay; _o3.z = az; _d3.x = (cx - ax) / dist2; _d3.y = (cy - ay) / dist2; _d3.z = (cz - az) / dist2;
          var hT = monde.tir(m.lieu, _o3, _d3, lim);
          if (hT) lim = Math.min(lim, hT.distance);
        }
        if (dist2 > 1e-3) { cx = ax + (cx - ax) * lim / dist2; cy = ay + (cy - ay) * lim / dist2; cz = az + (cz - az) * lim / dist2; }
        var B0 = m.bolts[0]; B0.t = DUREE_DECHARGE; B0.ax = ax; B0.ay = ay; B0.az = az; B0.bx = cx; B0.by = cy; B0.bz = cz; B0.touche = false; n = 1;
        info.cible = null; info.impact.x = cx; info.impact.y = cy; info.impact.z = cz; info.degats = 0; info.flou = 0; info.etourdissement = 0; info.touche = false; info.etat = 'rate';
        projeter(etincellesPour(m.lieu), cx, cy, cz, 26, 3.2, 0.25, 0.25);
      } else {
        var B1 = m.bolts[0];
        info.cible = premier.id; info.impact.x = B1.bx; info.impact.y = B1.by; info.impact.z = B1.bz; info.degats = D.degats; info.flou = D.flou; info.etourdissement = D.etourdissement; info.touche = true; info.etat = 'touche';
      }
      for (var r = n; r < m.bolts.length; r++) m.bolts[r].t = 0;
      m.nbBolts = n; m.flash = 1; m.dechargeT = 0;
      info.position.x = ax; info.position.y = ay; info.position.z = az; info.duree = D.recharge; info.rayon = 0; info.intensite = premier ? n : 0; info.id = null;
      signaler(m, 'decharge', info);
      projeter(etincellesPour(m.lieu), ax, ay, az, 14, 2.4, 0.2, 0.2);
    }
    /** Le Survolté voit-il au moins un joueur valide à portée (ligne de vue) ? (décharge multiple : pas seulement le plus proche) */
    function cibleDechargeVisible(m, joueurs, portee) {
      for (var q = 0; q < joueurs.length; q++) {
        var j = joueurs[q];
        if (!j.vivant || j.lieu !== m.lieu || h2(j.position.x - m.position.x, j.position.z - m.position.z) > portee) continue;
        if (!monde || monde.visible(m.position, j.position, m.lieu)) return true;
      }
      return false;
    }
    function ticksZone(m, dt, joueurs) {
      // aura de l'Irradié : dégâts continus (par pas de TICK_ZONE s) à tous les joueurs valides dans le rayon
      m.auraT += dt;
      if (m.auraT < TICK_ZONE) return;
      m.auraT -= TICK_ZONE;
      var A = m.profil.aura, info = m.info;
      for (var q = 0; q < joueurs.length; q++) {
        var j = joueurs[q];
        if (!j.vivant || j.lieu !== m.lieu) continue;
        if (h2(j.position.x - m.position.x, j.position.z - m.position.z) > A.rayon) continue;
        info.cible = j.id; info.position.x = m.position.x; info.position.y = 0; info.position.z = m.position.z; info.impact.x = j.position.x; info.impact.y = 1; info.impact.z = j.position.z;
        info.degats = A.degatsParSeconde * TICK_ZONE; info.flou = 0; info.etourdissement = 0; info.duree = TICK_ZONE; info.rayon = A.rayon; info.touche = true; info.etat = 'tick'; info.intensite = 1; info.id = null;
        blesser(m, j.id, info.degats, 'aura', info);
        signaler(m, 'aura', info);
      }
    }
    function creerFlaque(m) {
      var F0 = m.profil.flaque, f = null;
      for (var k = 0; k < flaques.length; k++) if (!flaques[k].actif) { f = flaques[k]; break; }
      if (!f) f = flaques[0];
      f.actif = true; f.x = m.position.x + Math.sin(m.lacet) * 0.5; f.z = m.position.z + Math.cos(m.lacet) * 0.5; f.lieu = m.lieu; f.rayon = F0.rayon; f.duree = F0.duree; f.dps = F0.degatsParSeconde;
      f.t = 0; f.tick = 0; f.source = m;
      f.mesh.position.set(f.x, 0.012, f.z); f.mesh.scale.setScalar(0.2); f.mesh.rotation.z = alea() * TAU; f.mesh.visible = true;
      if (monde && f.mesh.parent !== monde.scenes[f.lieu]) monde.scenes[f.lieu].add(f.mesh);
      var info = f.info; info.cible = null; info.position.x = f.x; info.position.y = 0; info.position.z = f.z; info.rayon = f.rayon; info.duree = f.duree; info.degats = 0; info.etat = 'debut'; info.touche = false; info.intensite = 1;
      signaler(m, 'flaque', info);
    }
    function majFlaques(dt, joueurs) {
      for (var k = 0; k < flaques.length; k++) {
        var f = flaques[k];
        if (!f.actif) continue;
        f.t += dt;
        var ouv = U.smooth(0, 0.6, f.t), fin = U.smooth(f.duree - 1.0, f.duree, f.t);
        f.mesh.scale.setScalar(f.rayon * (0.25 + 0.75 * ouv));
        f.mesh.material.opacity = 0.85 * ouv * (1 - fin) * (0.85 + 0.15 * Math.sin(f.t * 5));
        if (alea() < dt * 14 * (1 - fin)) { var a = alea() * TAU, r = Math.sqrt(alea()) * f.rayon * 0.8; projeter(sporesPour(f.lieu), f.x + Math.cos(a) * r, 0.03, f.z + Math.sin(a) * r, 1, 0.5, 0.05, 0.5); }
        if (alea() < dt * 4 * (1 - fin)) projeter(vapeurPour(f.lieu), f.x + (alea() - 0.5) * f.rayon, 0.1, f.z + (alea() - 0.5) * f.rayon, 1, 0.35, 0.3, 1.2);
        f.tick += dt;
        if (f.tick >= TICK_ZONE && f.t < f.duree) {
          f.tick -= TICK_ZONE;
          var info = f.info;
          for (var q = 0; q < joueurs.length; q++) {
            var j = joueurs[q];
            if (!j.vivant || j.lieu !== f.lieu || h2(j.position.x - f.x, j.position.z - f.z) > f.rayon * ouv) continue;
            info.cible = j.id; info.degats = f.dps * TICK_ZONE; info.etat = 'tick'; info.touche = true; info.impact.x = j.position.x; info.impact.y = 0; info.impact.z = j.position.z;
            blesser(f.source, j.id, info.degats, 'flaque', info);
            signaler(f.source, 'flaque', info);
          }
        }
        if (f.t >= f.duree) {
          f.actif = false; f.mesh.visible = false;
          var fi = f.info; fi.cible = null; fi.degats = 0; fi.etat = 'fin'; fi.touche = false;
          signaler(f.source, 'flaque', fi);
        }
      }
    }

    // ── v1.4 : boules radioactives de l'Irradié (lancer en cloche, point d'impact marqué au sol dès le lancer) ──
    var boules = [], NB_BOULES = 12, _valides = [];
    var geoBoule = new THREE.SphereGeometry(0.1, 14, 10), matBoule = new THREE.MeshBasicMaterial({ color: C.couleur(0xc6ff70) }); matBoule.toneMapped = false;
    var matHaloBoule = new THREE.SpriteMaterial({ map: lueurBlanche, color: COUL_VERT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); matHaloBoule.toneMapped = false;
    var geoRepere = new THREE.PlaneGeometry(2, 2);
    for (var nbo = 0; nbo < NB_BOULES; nbo++) {
      var mbo = new THREE.Mesh(geoBoule, matBoule); mbo.visible = false; mbo.frustumCulled = false;
      var hbo = new THREE.Sprite(matHaloBoule); hbo.scale.set(0.75, 0.75, 1); mbo.add(hbo);
      var mre = new THREE.MeshBasicMaterial({ map: texRepere, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }); mre.toneMapped = false;
      var rpe = new THREE.Mesh(geoRepere, mre); rpe.rotation.x = -PI / 2; rpe.visible = false; rpe.renderOrder = 3;
      boules.push({ actif: false, owner: null, lieu: 'salle', t: 0, duree: 1.1, x0: 0, y0: 0, z0: 0, x1: 0, z1: 0, h: 2, rayon: 1.2, mesh: mbo, repere: rpe, cible: null });
    }
    /** Salve de l'Irradié : parVolee + parJoueurSupp × (n − 1) boules, une sur chaque joueur valide à tour de rôle ; au-delà d'un
     *  tour, la boule vise l'endroit où le joueur sera dans 1 s. */
    function lancerVolee(m, joueurs) {
      var BO = m.profil.boules, nTous = 0;
      _valides.length = 0;
      for (var q = 0; q < joueurs.length; q++) {
        var j = joueurs[q];
        if (!j.vivant || j.lieu !== m.lieu) continue;
        nTous++;
        if (h2(j.position.x - m.position.x, j.position.z - m.position.z) <= BO.portee) _valides.push(j);
      }
      var n = _valides.length;
      if (!n) return 0;
      var nb = BO.parVolee + BO.parJoueurSupp * Math.max(0, nTous - 1), lancees = 0, premiere = null;
      m.groupe.updateMatrixWorld(true); posOs(m, 'mainG', _vm);
      for (var k = 0; k < nb; k++) {
        var cj = _valides[(m.bouleTour + k) % n], tour = Math.floor(k / n), v = cj.vitesse;
        _pos.x = cj.position.x + (tour > 0 && v ? v.x : 0); _pos.z = cj.position.z + (tour > 0 && v ? v.z : 0);
        if (monde) monde.resoudre(m.lieu, _pos, 0.25);
        var b = lancerBoule(m, _vm.x, _vm.y, _vm.z, _pos.x, _pos.z, cj.id);
        if (b) { lancees++; if (!premiere) premiere = b; }
      }
      m.bouleTour++;
      if (premiere) {
        var info = m.info;
        info.cible = premiere.cible; info.position.x = _vm.x; info.position.y = _vm.y; info.position.z = _vm.z; info.impact.x = premiere.x1; info.impact.y = 0; info.impact.z = premiere.z1;
        info.degats = BO.impact.degats; info.flou = 0; info.etourdissement = 0; info.duree = BO.tempsVol; info.rayon = BO.impact.rayon; info.touche = false; info.etat = 'lancer'; info.intensite = lancees; info.id = null;
        signaler(m, 'boule', info);
      }
      return lancees;
    }
    function lancerBoule(m, x0, y0, z0, x1, z1, cibleId) {
      var b = null;
      for (var k = 0; k < boules.length; k++) if (!boules[k].actif) { b = boules[k]; break; }
      if (!b) return null;
      var BO = m.profil.boules, d = h2(x1 - x0, z1 - z0);
      b.actif = true; b.owner = m; b.lieu = m.lieu; b.t = 0; b.duree = BO.tempsVol; b.x0 = x0; b.y0 = y0; b.z0 = z0; b.x1 = x1; b.z1 = z1; b.h = 1.6 + d * 0.14; b.rayon = BO.impact.rayon; b.cible = cibleId;
      var sc = monde ? monde.scenes[b.lieu] : null;
      if (sc && b.mesh.parent !== sc) { sc.add(b.mesh); sc.add(b.repere); }
      b.mesh.visible = true; b.mesh.position.set(x0, y0, z0);
      b.repere.visible = true; b.repere.position.set(x1, 0.016, z1); b.repere.scale.setScalar(b.rayon); b.repere.material.opacity = 0;
      return b;
    }
    function majBoules(dt, joueurs) {
      for (var k = 0; k < boules.length; k++) {
        var b = boules[k];
        if (!b.actif) continue;
        b.t += dt;
        var u = b.t / b.duree, m = b.owner;
        if (u < 1) {
          var hx = b.x0 + (b.x1 - b.x0) * u, hz = b.z0 + (b.z1 - b.z0) * u, hy = b.y0 + (0.02 - b.y0) * u + 4 * b.h * u * (1 - u);
          var bp = b.mesh.position; bp.x = hx; bp.y = hy; bp.z = hz;
          if (alea() < dt * 40) projeter(sporesPour(b.lieu), hx, hy, hz, 1, 0.25, 0.05, 0.35);
          var mr = b.repere.material; mr.opacity = (0.35 + 0.6 * u) * (0.75 + 0.25 * Math.sin(b.t * 18));        // le repère s'affirme à l'approche
          var sr = b.rayon * (1.06 - 0.06 * u); b.repere.scale.x = sr; b.repere.scale.y = sr; b.repere.scale.z = sr;
          continue;
        }
        // impact : dégâts dans impact.rayon, éclaboussure, zone radioactive (tant que l'Irradié est en vie)
        b.actif = false; b.mesh.visible = false; b.repere.visible = false;
        if (!m) continue;
        var vivantM = m.actif && (m.etat === 'actif' || m.etat === 'cuve'), info = m.info, touche = null;
        projeter(sporesPour(b.lieu), b.x1, 0.15, b.z1, 22, 1.6, 0.5, 0.5); projeter(vapeurPour(b.lieu), b.x1, 0.2, b.z1, 3, 0.5, 0.6, 1.1);
        if (!vivantM) continue;
        var BO = m.profil.boules;
        for (var q = 0; q < joueurs.length; q++) {
          var j = joueurs[q];
          if (!j.vivant || j.lieu !== b.lieu || h2(j.position.x - b.x1, j.position.z - b.z1) > b.rayon || Math.abs((j.position.y || 0) - 0) > 2) continue;
          if (!touche) touche = j;
          info.cible = j.id; info.position.x = b.x1; info.position.y = 0; info.position.z = b.z1; info.impact.x = j.position.x; info.impact.y = 1; info.impact.z = j.position.z;
          info.degats = BO.impact.degats; info.flou = 0; info.etourdissement = 0; info.duree = 0; info.rayon = b.rayon; info.touche = true; info.etat = 'impact'; info.intensite = 1; info.id = null;
          blesser(m, j.id, BO.impact.degats, 'boule', info);
        }
        info.cible = touche ? touche.id : null; info.position.x = b.x1; info.position.y = 0; info.position.z = b.z1; info.impact.x = b.x1; info.impact.y = 0; info.impact.z = b.z1;
        info.degats = touche ? BO.impact.degats : 0; info.flou = 0; info.etourdissement = 0; info.duree = 0; info.rayon = b.rayon; info.touche = !!touche; info.etat = 'impact'; info.intensite = 1; info.id = null;
        signaler(m, 'boule', info);
        creerZone(m, b.x1, b.z1);
      }
    }
    function eteindreBoules(m) { for (var k = 0; k < boules.length; k++) { var b = boules[k]; if (b.actif && b.owner === m) { b.actif = false; b.mesh.visible = false; b.repere.visible = false; } } }

    // ── v1.4 : zones radioactives (sans plafond : elles restent jusqu'à la mort de l'Irradié, puis s'éteignent en 1,5 s).
    //    Une seule InstancedMesh par lieu (un appel de dessin pour toutes), couleur par instance (grésillement, extinction),
    //    particules qui montent et crépitements ; aucune lumière. ──
    var zonesParLieu = {}, listeZonesLieux = [], zonesLibres = [], prochaineZone = 1, EXTINCTION_ZONE = 1.5;
    var geoZone = new THREE.PlaneGeometry(2, 2); geoZone.rotateX(-PI / 2);
    var matZone = new THREE.MeshBasicMaterial({ map: texZone, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); matZone.toneMapped = false;
    var _mz = new THREE.Matrix4(), _vz = new THREE.Vector3(), _cz = new THREE.Color();
    function zonesDe(lieu) {
      var Zl = zonesParLieu[lieu];
      if (Zl) return Zl;
      Zl = zonesParLieu[lieu] = { lieu: lieu, mesh: null, cap: 0, liste: [] };
      listeZonesLieux.push(Zl);
      agrandirZones(Zl, 48);
      return Zl;
    }
    function agrandirZones(Zl, cap) {
      var ancien = Zl.mesh, me = new THREE.InstancedMesh(geoZone, matZone, cap);
      me.frustumCulled = false; me.renderOrder = 2;
      // (setColorAt crée l'attribut de couleur à la taille de `count` : le compte n'est réduit qu'après)
      for (var k = 0; k < cap; k++) { _mz.identity(); me.setMatrixAt(k, _mz); me.setColorAt(k, _cz.setRGB(0, 0, 0)); }
      me.count = 0;
      Zl.mesh = me; Zl.cap = cap;
      for (var q = 0; q < Zl.liste.length; q++) poserZone(Zl, Zl.liste[q], q);
      me.count = Zl.liste.length;
      var sc = ancien && ancien.parent ? ancien.parent : (monde ? monde.scenes[Zl.lieu] : null);
      if (ancien && ancien.parent) ancien.parent.remove(ancien);
      if (ancien && ancien.dispose) ancien.dispose();
      if (sc) sc.add(me);
    }
    function poserZone(Zl, zr, idx) {
      zr.idx = idx;
      _mz.makeRotationY(zr.rot); _mz.scale(_vz.set(zr.rayon, 1, zr.rayon)); _mz.setPosition(zr.x, 0.018 + (idx % 7) * 0.0015, zr.z);
      Zl.mesh.setMatrixAt(idx, _mz); Zl.mesh.instanceMatrix.needsUpdate = true;
    }
    function creerZone(m, x, z) {
      var Zl = zonesDe(m.lieu), BO = m.profil.boules;
      if (Zl.liste.length >= Zl.cap) agrandirZones(Zl, Zl.cap * 2);
      var zr = zonesLibres.length ? zonesLibres.pop() : { id: '', x: 0, z: 0, rayon: 2.5, lieu: 'salle', owner: null, t: 0, fin: -1, idx: 0, rot: 0, ph: 0, danger: { type: 'cercle', centre: { x: 0, z: 0 }, rayon: 2.5, lieu: 'salle', source: 'zone' } };
      zr.id = 'zr' + (prochaineZone++); zr.x = x; zr.z = z; zr.rayon = BO.zone.rayon; zr.lieu = m.lieu; zr.owner = m; zr.t = 0; zr.fin = -1; zr.rot = alea() * TAU; zr.ph = alea() * 10;
      Zl.liste.push(zr); poserZone(Zl, zr, Zl.liste.length - 1); Zl.mesh.count = Zl.liste.length;
      var info = m.info;
      info.cible = null; info.position.x = x; info.position.y = 0; info.position.z = z; info.impact.x = x; info.impact.y = 0; info.impact.z = z;
      info.degats = 0; info.flou = 0; info.etourdissement = 0; info.duree = 0; info.rayon = zr.rayon; info.touche = false; info.etat = 'debut'; info.intensite = 1; info.id = zr.id;
      signaler(m, 'zone', info);
      return zr;
    }
    function retirerZoneIdx(Zl, idx) {
      var zr = Zl.liste[idx], dernier = Zl.liste.pop();
      if (idx < Zl.liste.length) { Zl.liste[idx] = dernier; poserZone(Zl, dernier, idx); }
      Zl.mesh.count = Zl.liste.length;
      zr.owner = null; zonesLibres.push(zr);
    }
    /** Mort (ou retrait) de l'Irradié : ses zones s'éteignent en 1,5 s ('zone' etat 'fin' pour chacune). */
    function eteindreZones(m) {
      for (var l = 0; l < listeZonesLieux.length; l++) {
        var L = listeZonesLieux[l].liste;
        for (var k = 0; k < L.length; k++) {
          var zr = L[k];
          if (zr.owner !== m || zr.fin >= 0) continue;
          zr.fin = EXTINCTION_ZONE;
          var info = m.info;
          info.cible = null; info.position.x = zr.x; info.position.y = 0; info.position.z = zr.z; info.impact.x = zr.x; info.impact.y = 0; info.impact.z = zr.z;
          info.degats = 0; info.flou = 0; info.etourdissement = 0; info.duree = EXTINCTION_ZONE; info.rayon = zr.rayon; info.touche = false; info.etat = 'fin'; info.intensite = 1; info.id = zr.id;
          signaler(m, 'zone', info);
        }
      }
    }
    function majZones(dt) {
      for (var l = 0; l < listeZonesLieux.length; l++) {
        var Zl = listeZonesLieux[l], L = Zl.liste, n = L.length;
        if (!n) continue;
        for (var k = n - 1; k >= 0; k--) {
          var zr = L[k];
          zr.t += dt;
          var kf = 1;
          if (zr.fin >= 0) { zr.fin -= dt; kf = zr.fin > 0 ? zr.fin / EXTINCTION_ZONE : 0; if (zr.fin <= 0) { retirerZoneIdx(Zl, k); continue; } }
          // grésillement : scintillement rapide + respiration lente ; apparition en 0,35 s. Couleur écrite directement dans le
          // tampon d'instances (setColorAt + Color.setRGB de Three récent passent par la gestion des espaces de couleur)
          var ko = zr.t < 0.35 ? zr.t / 0.35 : 1, g = (0.8 + 0.12 * Math.sin(zr.t * 2.1 + zr.ph) + 0.18 * alea()) * ko * kf;
          var CA = Zl.mesh.instanceColor.array, ic = zr.idx * 3;
          CA[ic] = 0.78 * g; CA[ic + 1] = g; CA[ic + 2] = 0.62 * g;
        }
        Zl.mesh.instanceColor.needsUpdate = true;
        // particules qui montent et crépitements, répartis au hasard sur les zones (débit plafonné par image)
        var nEm = Math.min(5, Math.ceil(L.length * dt * 9));
        for (var e = 0; e < nEm && L.length; e++) {
          var zz = L[(alea() * L.length) | 0];
          if (zz.fin >= 0 && alea() < 0.7) continue;
          var a = alea() * TAU, r = Math.sqrt(alea()) * zz.rayon * 0.92, px = zz.x + Math.cos(a) * r, pz = zz.z + Math.sin(a) * r;
          if (alea() < 0.55) projeter(sporesPour(Zl.lieu), px, 0.04, pz, 1, 0.35, 0.05, 0.9);
          else projeter(crepitementsPour(Zl.lieu), px, 0.03, pz, 2, 0.9, 0.05, 0.12);
        }
      }
    }
    // ════════════════════════════════════════════════════════════════════════════════════════
    // v1.5 (API §17.1) : entités irradiées (lueur verte, halo au sol, aura), bras arraché du Démembré géant (objet en main,
    // en vol, posé, flétri), arcs visuels du fléau, projections de la charge. Aucune allocation par image.
    // ════════════════════════════════════════════════════════════════════════════════════════
    var texHaloIrr = (function () {
      var W = 128, c = U.canvas(W, W), g = c.getContext('2d'), m0 = W / 2, R = U.rng(271);
      g.clearRect(0, 0, W, W);
      var gr = g.createRadialGradient(m0, m0, 0, m0, m0, m0);
      gr.addColorStop(0, 'rgba(150,255,70,0.5)'); gr.addColorStop(0.45, 'rgba(110,240,40,0.2)'); gr.addColorStop(0.84, 'rgba(120,255,50,0.14)');
      gr.addColorStop(0.93, 'rgba(200,255,130,0.62)'); gr.addColorStop(1, 'rgba(120,255,50,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, W);
      for (var k = 0; k < 10; k++) {                                             // taches qui grésillent
        var a = R() * TAU, d = Math.sqrt(R()) * m0 * 0.6, r = m0 * (0.06 + R() * 0.1), x = m0 + Math.cos(a) * d, y = m0 + Math.sin(a) * d;
        var g2 = g.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, 'rgba(210,255,140,0.5)'); g2.addColorStop(1, 'rgba(120,255,40,0)');
        g.fillStyle = g2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      return U.tex(THREE, C, c, { clamp: true });
    })();
    var geoHaloIrr = new THREE.PlaneGeometry(2, 2); geoHaloIrr.rotateX(-PI / 2);
    var matHaloIrr = new THREE.MeshBasicMaterial({ map: texHaloIrr, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    matHaloIrr.toneMapped = false;
    var halosIrr = {}, listeHalosIrr = [];
    function halosIrrDe(lieu) {
      var H = halosIrr[lieu];
      if (H) return H;
      var cap = 64, me = new THREE.InstancedMesh(geoHaloIrr, matHaloIrr, cap);
      me.frustumCulled = false; me.renderOrder = 2; me.name = 'halosIrradies';
      for (var k = 0; k < cap; k++) { _mz.identity(); me.setMatrixAt(k, _mz); me.setColorAt(k, _cz.setRGB(0, 0, 0)); }   // (couleurs avant de réduire count)
      me.count = 0;
      if (monde) monde.scenes[lieu].add(me);
      H = halosIrr[lieu] = { mesh: me, cap: cap, n: 0, lieu: lieu }; listeHalosIrr.push(H);
      return H;
    }
    /** Irradie (ou rend normal) un zombie, un chien ou un petit Démembré : lueur verte émissive, halo au sol, aura. */
    function irradier(z, p) {
      if (z.miniBoss) return false;                                   // jamais les mini-boss (§17.1)
      if (p.actif === false) { if (z.irrActif) { z.irrActif = false; finIrradiation(z); } return true; }
      if (!Z.vivant(z)) return false;
      var A = p.aura || {};
      z.irrRayon = A.rayon > 0 ? A.rayon : 1.5; z.irrDps = A.degatsParSeconde >= 0 ? A.degatsParSeconde : 0.04; IRR_R[z.it] = z.irrRayon; IRR_D[z.it] = z.irrDps;
      if (p.couleur != null) { var cc = C.couleur(p.couleur); z.irrCoul.r = cc.r; z.irrCoul.g = cc.g; z.irrCoul.b = cc.b; }
      if (!z.mb && z.mat === matBase) { z.mat = prendreMat(); z.mesh.material = z.mat; }
      z.mat.userData.u.uCoulIrr.value.copy(z.irrCoul);
      z.irrActif = true;
      return true;
    }
    function finIrradiation(z) {
      if (z.mat && z.mat.userData.u) z.mat.userData.u.uIrradie.value = 0;
      IRR_K[z.it] = 0;
      // redevenu normal (et ni mourant ni saisi) : matériau partagé
      var e = z.etat;
      if (!z.mb && z.mat !== matBase && e !== 'mort' && e !== 'cendres' && e !== 'absorbe' && e !== 'saisie' && e !== 'extraction' && e !== 'inactif') { rendreMat(z.mat); z.mat = matBase; z.mesh.material = matBase; }
    }
    var tickIrrT = 0, infoIrr = infoVide('aura');
    var HALOS_IRR = o.halosIrradies !== false;                         // halo au sol des irradiés (fx.js 1.5 en dessine un aussi : option)
    function majIrradies(dt, temps, joueurs) {
      for (var l = 0; l < listeHalosIrr.length; l++) listeHalosIrr[l].n = 0;
      tickIrrT += dt;
      var tick = tickIrrT >= TICK_ZONE;
      if (tick) tickIrrT -= TICK_ZONE;
      for (var k = 0; k < tous.length; k++) {
        var z = tous[k];
        if (!z.actif || !z.irrActif) continue;
        var viv = Z.vivant(z);
        var kI = IRR_K[k]; kI += ((viv ? 1 : 0) - kI) * Math.min(1, dt * (viv ? 3 : 1.5)); IRR_K[k] = kI;   // s'allume en ≈ 0,4 s, s'éteint en mourant
        z.mat.userData.u.uIrradie.value = kI * (0.62 + 0.2 * Math.sin(temps * 5.3 + z.idx * 1.7) + 0.12 * alea());
        if (!viv) continue;
        var H = HALOS_IRR ? halosIrrDe(z.lieu) : null, R = IRR_R[k], Dps = IRR_D[k];
        if (H && H.n < H.cap) {
          _mz.makeScale(R, 1, R); _mz.setPosition(z.position.x, 0.022, z.position.z);
          H.mesh.setMatrixAt(H.n, _mz);
          var g = kI * (0.72 + 0.28 * Math.sin(temps * 3.1 + z.idx)), CA = H.mesh.instanceColor.array, ic = H.n * 3;
          CA[ic] = z.irrCoul.r * g; CA[ic + 1] = z.irrCoul.g * g; CA[ic + 2] = z.irrCoul.b * g;
          H.n++;
        }
        if (alea() < dt * 3) projeter(sporesPour(z.lieu), z.position.x + (alea() - 0.5) * 0.6, 0.3 + alea() * 1.2, z.position.z + (alea() - 0.5) * 0.6, 1, 0.3, 0.2, 0.9);
        // aura : dégâts continus par tics de 0,25 s (source 'aura', comme celle de L'Irradié)
        if (tick && Dps > 0) {
          for (var q = 0; q < joueurs.length; q++) {
            var j = joueurs[q];
            if (!j.vivant || j.lieu !== z.lieu) continue;
            var dx = j.position.x - z.position.x, dz = j.position.z - z.position.z;
            if (dx * dx + dz * dz > R * R) continue;
            var I = infoIrr; I.cible = j.id; I.position.x = z.position.x; I.position.y = 0; I.position.z = z.position.z; I.impact.x = j.position.x; I.impact.y = 1; I.impact.z = j.position.z;
            I.degats = Dps * TICK_ZONE; I.flou = 0; I.etourdissement = 0; I.duree = TICK_ZONE; I.rayon = R; I.touche = true; I.etat = 'tick'; I.intensite = 1; I.id = z.id; I.projection.duree = 0;
            blesser(z, j.id, I.degats, 'aura', I);
          }
        }
      }
      for (var l2 = 0; l2 < listeHalosIrr.length; l2++) { var H2 = listeHalosIrr[l2]; H2.mesh.count = H2.n; if (H2.n) { H2.mesh.instanceMatrix.needsUpdate = true; H2.mesh.instanceColor.needsUpdate = true; } }
    }

    // ── bras arraché : le bras du modèle (sommets liés aux os du bras), extrait une fois, en maillage statique ──
    var geoBrasTranche = null;
    function geometrieBras() {
      if (geoBrasTranche) return geoBrasTranche;
      var M = modeleMiniBoss(THREE, 'demembre'), g = M.geo, Pp = g.attributes.position.array, Cc = g.attributes.color ? g.attributes.color.array : null, UVa = g.attributes.uv ? g.attributes.uv.array : null;
      var SI = g.attributes.skinIndex.array, SW = g.attributes.skinWeight.array, Ix = g.index ? g.index.array : null;
      var bA = IDX_DEMEMBRE.brasLibre, bB = IDX_DEMEMBRE.avantBrasLibre, bC = IDX_DEMEMBRE.mainLibre;
      function poidsBras(v) { var w = 0; for (var q = 0; q < 4; q++) { var b = SI[v * 4 + q]; if (b === bA || b === bB || b === bC) w += SW[v * 4 + q]; } return w; }
      var o0 = OS_LIBRE[0], ox = o0[2], oy = o0[3], oz = o0[4], pos = [], col = [], uv = [], n = Ix ? Ix.length : Pp.length / 3;
      for (var t = 0; t + 2 < n; t += 3) {
        var a = Ix ? Ix[t] : t, b = Ix ? Ix[t + 1] : t + 1, c = Ix ? Ix[t + 2] : t + 2;
        if (poidsBras(a) < 0.5 || poidsBras(b) < 0.5 || poidsBras(c) < 0.5) continue;
        for (var e = 0; e < 3; e++) {
          var v = e === 0 ? a : e === 1 ? b : c;
          pos.push(Pp[v * 3] - ox, Pp[v * 3 + 1] - oy, Pp[v * 3 + 2] - oz);
          if (Cc) col.push(Cc[v * 3], Cc[v * 3 + 1], Cc[v * 3 + 2]); else col.push(0.5, 0.5, 0.5);
          if (UVa) uv.push(UVa[v * 2], UVa[v * 2 + 1]); else uv.push(0, 0);
        }
      }
      var G = new THREE.BufferGeometry();
      G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); G.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      G.computeVertexNormals();
      geoBrasTranche = G;
      return G;
    }
    var texMareSang = (function () {
      var W = 256, c = U.canvas(W, W), g = c.getContext('2d'), R = U.rng(613), m0 = W / 2;
      g.clearRect(0, 0, W, W);
      for (var k = 0; k < 16; k++) {
        var a = R() * TAU, d = R() * m0 * 0.4, r = m0 * (0.18 + R() * 0.3), x = m0 + Math.cos(a) * d, y = m0 + Math.sin(a) * d;
        var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(70,4,3,0.95)'); gr.addColorStop(0.75, 'rgba(95,8,5,0.85)'); gr.addColorStop(1, 'rgba(60,2,2,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      for (var s = 0; s < 40; s++) { var a2 = R() * TAU, d2 = m0 * (0.45 + R() * 0.45), r2 = 1 + R() * 4; g.fillStyle = 'rgba(80,5,4,' + (0.5 + R() * 0.5).toFixed(2) + ')'; g.beginPath(); g.arc(m0 + Math.cos(a2) * d2, m0 + Math.sin(a2) * d2, r2, 0, TAU); g.fill(); }
      return U.tex(THREE, C, c, { clamp: true });
    })();
    var brasObjets = [];
    function creerBrasObjet() {
      var mat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, map: texCrasse, roughness: 0.78, metalness: 0 }));
      var me = new THREE.Mesh(geometrieBras(), mat); me.frustumCulled = false;
      var grp = new THREE.Group(); grp.add(me); grp.visible = false;
      var mm = new THREE.MeshBasicMaterial({ map: texMareSang, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      var mare = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mm); mare.rotation.x = -PI / 2; mare.visible = false; mare.renderOrder = 2;
      return { actif: false, owner: null, dernier: null, etat: '', t: 0, groupe: grp, mesh: me, mat: mat, mare: mare, matMare: mm, x0: 0, y0: 0, z0: 0, x1: 0, z1: 0,
        vol: 1.2, ech: 2, lacetSol: 0, orphelinT: -1, lieu: 'salle', fletriT: 0, fletrirAuSol: false, pulse: 0, info: infoVide('arrachement') };
    }
    for (var kbo = 0; kbo < MAX_MB_TYPE; kbo++) brasObjets.push(creerBrasObjet());
    function prendreBrasObjet() { for (var k = 0; k < brasObjets.length; k++) if (!brasObjets[k].actif) return brasObjets[k]; return null; }
    function brasLePlusProche(x, z) {
      var best = null, bd = 1e9;
      for (var k = 0; k < brasObjets.length; k++) { var B = brasObjets[k]; if (!B.actif || (B.etat !== 'pose' && B.etat !== 'vol')) continue; var d = h2(B.x1 - x, B.z1 - z); if (d < bd) { bd = d; best = B; } }
      return best;
    }
    function brasOrphelin() { for (var k = 0; k < brasObjets.length; k++) { var B = brasObjets[k]; if (B.actif && !B.owner && B.etat !== 'fletri' && B.orphelinT >= 0) return B; } return null; }
    function montrerBras(B) {
      var sc = monde ? monde.scenes[B.lieu] : null;
      if (sc && B.groupe.parent !== sc) sc.add(B.groupe);
      if (sc && B.mare.parent !== sc) sc.add(B.mare);
      B.groupe.visible = true;
      var u = B.mat.userData.u; u.uDissolution.value = 0; u.uDesseche.value = 0; u.uBrulure.value = 0; u.uLueur.value = 0; u.uIrradie.value = 0;
    }
    function cacherBras(B) { B.actif = false; B.owner = null; B.groupe.visible = false; B.mare.visible = false; B.matMare.opacity = 0; B.etat = ''; }
    /** Le bras (et la moitié des tendons) disparaît du corps : os du bras ramené au moignon, échelle quasi nulle. */
    function cacherBrasCorps(m) { var Ob = m.os.brasLibre; Ob.position.set(ATT_LOC[0], ATT_LOC[1], ATT_LOC[2]); Ob.scale.setScalar(0.001); Ob.quaternion.copy(m.rest.brasLibre); }
    function signalerBras(B, etat, x, y, z) {
      var m = B.owner || B.dernier; if (!m) return;
      var I = B.info; I.cible = null; I.position.x = x; I.position.y = y; I.position.z = z; I.impact.x = B.x1; I.impact.y = 0; I.impact.z = B.z1;
      I.degats = 0; I.flou = 0; I.etourdissement = 0; I.duree = B.vol; I.rayon = 0; I.touche = false; I.etat = etat; I.intensite = 1; I.id = null; I.projection.duree = 0;
      signaler(m, 'arrachement', I);
    }
    /** Arrachement : le bras quitte le corps (gerbe de sang, tendons qui claquent), dans la main droite. */
    function arracherBras(m, silencieux) {
      var Ar = m.arr;
      if (Ar.phase >= 3) return;
      Ar.phase = 3; m.sansBras = true;
      cacherBrasCorps(m);
      var B = Ar.objet || prendreBrasObjet();
      Ar.objet = B;
      if (!silencieux) {
        m.groupe.updateMatrixWorld(true);
        _vm.set(ATT_LOC[0], ATT_LOC[1], ATT_LOC[2]).applyMatrix4(m.os.poitrine.matrixWorld);
        projeter(sangPour(m.lieu), _vm.x, _vm.y, _vm.z, 90, 5.5 * Math.sqrt(m.echelle), 0.7, 0.6);
        projeter(terrePour(m.lieu), _vm.x, _vm.y - 0.2, _vm.z, 30, 3.5, 0.5, 0.5);
      }
      if (B) { B.actif = true; B.owner = m; B.dernier = m; B.etat = 'main'; B.t = 0; B.ech = m.scale; B.lieu = m.lieu; B.orphelinT = -1; B.fletriT = 0; B.fletrirAuSol = false; B.x1 = Ar.cx; B.z1 = Ar.cz; montrerBras(B); }
      if (B && !silencieux) signalerBras(B, 'arrache', m.position.x, 1.5 * m.scale, m.position.z);
    }
    /** Lancer : de la main vers la cible, en cloche (flèche de 3 m), posé à la fin de la rage. */
    function lancerBras(m) {
      var Ar = m.arr, B = Ar.objet;
      Ar.phase = 4;
      if (!B) return;
      m.groupe.updateMatrixWorld(true); posOs(m, 'mainD', _vm);
      B.etat = 'vol'; B.t = 0; B.x0 = _vm.x; B.y0 = _vm.y; B.z0 = _vm.z; B.x1 = Ar.cx; B.z1 = Ar.cz; B.vol = Math.max(0.05, m.rageD - m.rageT);
      B.lacetSol = Math.atan2(B.x1 - B.x0, B.z1 - B.z0) + (alea() - 0.5) * 1.2;
      signalerBras(B, 'lance', _vm.x, _vm.y, _vm.z);
    }
    var _qb = new THREE.Quaternion(), _vb = new THREE.Vector3(), _vb2 = new THREE.Vector3(), BAS = new THREE.Vector3(0, -1, 0), CLOCHE_BRAS = 3.0;
    function majBrasObjets(dt, temps) {
      for (var k = 0; k < brasObjets.length; k++) {
        var B = brasObjets[k];
        if (!B.actif) continue;
        B.t += dt;
        var G = B.groupe, e = B.ech, u = B.mat.userData.u;
        if (B.orphelinT >= 0 && !B.owner) {                          // maître retiré sans mourir : adopté par une reprise, sinon retiré
          B.orphelinT += dt;
          if (B.orphelinT > 1.5) { u.uDissolution.value = Math.min(1, (B.orphelinT - 1.5) / 0.4); B.matMare.opacity *= Math.max(0, 1 - dt * 6); if (B.orphelinT > 1.9) { cacherBras(B); continue; } }
        }
        if (B.etat === 'main') {
          var m = B.owner;
          if (!m || !m.actif) { B.etat = 'pose'; B.t = 0; B.x1 = G.position.x; B.z1 = G.position.z; continue; }
          m.groupe.updateMatrixWorld(true); posOs(m, 'mainD', _vb); posOs(m, 'avantBrasD', _vb2);
          _vb2.subVectors(_vb, _vb2).normalize();
          _qb.setFromUnitVectors(BAS, _vb2);
          G.position.copy(_vb); G.quaternion.copy(_qb); G.scale.setScalar(e);
        } else if (B.etat === 'vol') {
          var uu = Math.min(1, B.t / B.vol), ye = 0.1 * e;
          G.position.set(B.x0 + (B.x1 - B.x0) * uu, B.y0 + (ye - B.y0) * uu + 4 * CLOCHE_BRAS * uu * (1 - uu), B.z0 + (B.z1 - B.z0) * uu);
          G.rotation.set(-PI / 2 * uu - 2.6 * PI * uu * (1 - uu) * 2, B.lacetSol, 0.6 * Math.sin(uu * 5), 'YXZ'); G.scale.setScalar(e);
          if (alea() < dt * 30) projeter(sangPour(B.lieu), G.position.x, G.position.y, G.position.z, 2, 0.8, 0.1, 0.4);
          if (uu >= 1) {
            B.etat = 'pose'; B.t = 0;
            projeter(sangPour(B.lieu), B.x1, 0.15, B.z1, 70, 4.2, 0.9, 0.5); projeter(terrePour(B.lieu), B.x1, 0.1, B.z1, 40, 3.2, 1.0, 0.6);
            signalerBras(B, 'pose', B.x1, 0, B.z1);
            if (B.fletrirAuSol) { B.etat = 'fletri'; B.fletriT = 0; }
          }
        }
        if (B.etat === 'pose' || B.etat === 'fletri') {
          // couché au sol (le bras, du moignon à la main, s'étend vers lacetSol), il palpite ; flétri : se dessèche puis se dissout
          var fl = B.etat === 'fletri';
          if (fl) B.fletriT += dt;
          var kf = fl ? Math.min(1, B.fletriT / 2.2) : 0, pul = fl ? 0 : 1;
          var bat = Math.sin(temps * 6.5 + k) * Math.max(0, Math.sin(temps * 2.1 + k * 2)), sx = e * (1 - 0.14 * kf) * (1 + 0.035 * bat * pul);
          G.position.set(B.x1, 0.085 * e * (1 - 0.3 * kf), B.z1);
          G.rotation.set(-PI / 2 + 0.06 * bat * pul, B.lacetSol, 0.18 + 0.05 * Math.sin(temps * 11 + k) * pul * Math.max(0, bat), 'YXZ');
          G.scale.set(sx, e * (1 - 0.14 * kf), sx);
          u.uDesseche.value = 0.85 * kf;
          if (fl && B.fletriT > 2.4) u.uDissolution.value = Math.min(1, (B.fletriT - 2.4) / 1.4);
          // mare de sang sous le bras (s'étale à la pose, s'assombrit en se flétrissant)
          var Mq = B.mare, ce = B.t < 1.2 ? U.smooth(0, 1.2, B.t) : 1, rr = (0.75 + 0.45 * ce) * e * 0.6;
          Mq.visible = true; Mq.position.set(B.x1 + Math.sin(B.lacetSol) * 0.4 * e, 0.012, B.z1 + Math.cos(B.lacetSol) * 0.4 * e); Mq.scale.set(rr, rr, 1);
          B.matMare.opacity = (fl ? Math.max(0, 1 - Math.max(0, B.fletriT - 2.6) / 1.2) : 1) * 0.88 * ce;
          if (!fl && alea() < dt * 2.5) projeter(sangPour(B.lieu), B.x1 + Math.sin(B.lacetSol) * 0.15 * e, 0.12 * e, B.z1 + Math.cos(B.lacetSol) * 0.15 * e, 2, 0.6, 0.05, 0.4);
          if (fl && B.fletriT > 3.9) cacherBras(B);
        }
      }
    }
    /** Mort du géant : le bras se flétrit tout seul (en main : il tombe ; en vol : à l'atterrissage). */
    function fletrirBras(m) {
      var B = m.arr.objet;
      if (!B || !B.actif || B.owner !== m) return;
      if (B.etat === 'main') { B.etat = 'fletri'; B.fletriT = 0; B.t = 0; B.x1 = B.groupe.position.x; B.z1 = B.groupe.position.z; }
      else if (B.etat === 'vol') B.fletrirAuSol = true;
      else if (B.etat === 'pose') { B.etat = 'fletri'; B.fletriT = 0; }
    }

    // ── arcs visuels du fléau : secteur au sol pendant la préparation (danger lisible), puis bande qui balaie toute la
    //    portée pendant la frappe (le bras ne mesure qu'une fraction des 6 m du géant). Un maillage dynamique par lieu. ──
    var N_SEG_ARC = 20, MAX_SECT = 24, arcsFleau = {}, listeArcsFleau = [];
    function arcsFleauDe(lieu) {
      var A = arcsFleau[lieu];
      if (A) return A;
      var nv = (N_SEG_ARC + 1) * 2, g = new THREE.BufferGeometry(), P2 = new Float32Array(MAX_SECT * nv * 3), C2 = new Float32Array(MAX_SECT * nv * 3), I2 = [];
      for (var s = 0; s < MAX_SECT; s++) for (var q = 0; q < N_SEG_ARC; q++) { var b = s * nv + q * 2; I2.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
      g.setAttribute('position', new THREE.BufferAttribute(P2, 3)); g.setAttribute('color', new THREE.BufferAttribute(C2, 3)); g.setIndex(I2); g.setDrawRange(0, 0);
      var mt = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      mt.toneMapped = false;
      var me = new THREE.Mesh(g, mt); me.frustumCulled = false; me.renderOrder = 5; me.name = 'arcsFleau';
      if (monde) monde.scenes[lieu].add(me);
      A = arcsFleau[lieu] = { mesh: me, P: P2, C: C2, n: 0, nv: nv }; listeArcsFleau.push(A);
      return A;
    }
    // secteur (centre, lacet, angles a0 → a1 depuis l'avant vers la gauche, rayons r0 → r1, hauteurs y0 → y1, couleurs intérieure/extérieure)
    var SECT = new Float64Array(16);   // cx, cz, lacet, a0, a1, r0, r1, y0, y1, ri, gi, bi, re, ge, be
    function secteur(A) {
      if (A.n >= MAX_SECT) return;
      var cx = SECT[0], cz = SECT[1], la = SECT[2], a0 = SECT[3], a1 = SECT[4], r0 = SECT[5], r1 = SECT[6], y0 = SECT[7], y1 = SECT[8];
      var fx = Math.sin(la), fz = Math.cos(la), gx = Math.cos(la), gz = -Math.sin(la), P2 = A.P, C2 = A.C, b = A.n * A.nv * 3;
      for (var q = 0; q <= N_SEG_ARC; q++) {
        var f = q / N_SEG_ARC, a = a0 + (a1 - a0) * f, ca = Math.cos(a), sa = Math.sin(a), dx = fx * ca + gx * sa, dz = fz * ca + gz * sa, yy = y0 + (y1 - y0) * f;
        var bord = Math.sin(PI * f), o = b + q * 6;
        P2[o] = cx + dx * r0; P2[o + 1] = yy; P2[o + 2] = cz + dz * r0; P2[o + 3] = cx + dx * r1; P2[o + 4] = yy; P2[o + 5] = cz + dz * r1;
        C2[o] = SECT[9] * bord; C2[o + 1] = SECT[10] * bord; C2[o + 2] = SECT[11] * bord; C2[o + 3] = SECT[12] * bord; C2[o + 4] = SECT[13] * bord; C2[o + 5] = SECT[14] * bord;
      }
      A.n++;
    }
    function arcsDuFleau(m) {
      if (m.fam !== 'demembre' || m.sansBras || m.etat !== 'actif' || m.mode !== 'fleau') return;
      var FL = m.profil.fleau, P0 = FL.preparation, tf = m.modeT, demi = FL.angle * PI / 360, A = arcsFleauDe(m.lieu);
      if (tf < P0) {
        var kp = U.smooth(0, P0, tf) * 0.32;                       // secteur au sol qui se remplit : la zone du coup, bien lisible
        SECT[0] = m.position.x; SECT[1] = m.position.z; SECT[2] = m.lacet; SECT[3] = demi; SECT[4] = -demi; SECT[5] = 0.6 * m.echelle; SECT[6] = FL.portee; SECT[7] = 0.035; SECT[8] = 0.035;
        SECT[9] = 0.25 * kp; SECT[10] = 0.02 * kp; SECT[11] = 0.01 * kp; SECT[12] = 0.95 * kp; SECT[13] = 0.12 * kp; SECT[14] = 0.04 * kp; secteur(A);
      } else if (tf < P0 + DUREE_FRAPPE + 0.3) {
        var v = Math.min(1, (tf - P0) / DUREE_FRAPPE), ev = 1 - Math.pow(1 - v, 1.6), kf = tf < P0 + DUREE_FRAPPE ? 1 : 1 - (tf - P0 - DUREE_FRAPPE) / 0.3, s0 = m.scale;
        var aC = demi - 2 * demi * ev, aT = Math.min(demi, aC + 0.9);   // bande : de la traîne (≈ 50°) au bras qui s'abat
        SECT[0] = m.position.x; SECT[1] = m.position.z; SECT[2] = m.lacet; SECT[3] = aT; SECT[4] = aC; SECT[5] = 0.35 * FL.portee; SECT[6] = FL.portee;
        SECT[7] = (1.5 - 0.35 * ev) * s0 * 0.75; SECT[8] = (1.4 - 0.55 * ev) * s0 * 0.75;
        SECT[9] = 0.25 * kf; SECT[10] = 0.2 * kf; SECT[11] = 0.16 * kf; SECT[12] = 1.0 * kf; SECT[13] = 0.86 * kf; SECT[14] = 0.66 * kf; secteur(A);
        // onde au sol sur toute la portée
        SECT[7] = 0.04; SECT[8] = 0.04; SECT[5] = 0.8 * FL.portee; SECT[3] = demi; SECT[4] = aC;
        SECT[9] = 0.05 * kf; SECT[10] = 0.03 * kf; SECT[11] = 0.02 * kf; SECT[12] = 0.55 * kf; SECT[13] = 0.36 * kf; SECT[14] = 0.22 * kf; secteur(A);
      }
    }
    function finArcsFleau() {
      for (var l = 0; l < listeArcsFleau.length; l++) {
        var A = listeArcsFleau[l], g = A.mesh.geometry;
        g.setDrawRange(0, A.n * N_SEG_ARC * 6);
        if (A.n > 0) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; }
        A.n = 0;
      }
    }

    // ── projections de la charge : qui a été projeté, par qui (pour l'impact contre un mur, signalé par le joueur ou le bot) ──
    var projetes = {};
    function noterProjection(m, id, duree) { var r = projetes[id] || (projetes[id] = { m: null, t: 0, duree: 0 }); r.m = m; r.t = 0; r.duree = duree + 0.25; }
    function majProjections(dt) { for (var id in projetes) { var r = projetes[id]; if (r.m) { r.t += dt; if (r.t > r.duree) r.m = null; } } }
    /** Un joueur projeté par une charge heurte un mur (appelé par l'adaptateur) : `impactMur` en plus, rappel 'projection'. */
    Z.impactMur = function (joueurId, p) {
      var r = projetes[joueurId];
      if (!r || !r.m) return false;
      var m = r.m, CH = m.profil.charge, I = m.info;
      r.m = null;
      I.cible = joueurId; I.position.x = p && p.x != null ? p.x : m.position.x; I.position.y = 1; I.position.z = p && p.z != null ? p.z : m.position.z; I.impact.x = I.position.x; I.impact.y = 1; I.impact.z = I.position.z;
      I.degats = CH.impactMur; I.flou = 0; I.etourdissement = 0; I.duree = 0; I.rayon = 0; I.touche = true; I.etat = 'mur'; I.intensite = p && p.vitesse ? p.vitesse : 1; I.id = null; I.projection.duree = 0;
      if (CH.impactMur > 0) blesser(m, joueurId, CH.impactMur, 'impactMur', I);
      signaler(m, 'projection', I);
      projeter(terrePour(m.lieu), I.position.x, 1.0, I.position.z, 20, 2.4, 0.4, 0.4);
      return true;
    };

    /** Exposition aux zones d'un Irradié, par joueur : dps = min(dpsMax, dpsBase + dpsParSeconde × expo) par pas de TICK_ZONE ;
     *  expo = secondes passées dans ses zones, remise à zéro après `oubli` s dehors. Aura et zones se cumulent. */
    function majExpositions(m, dt, joueurs) {
      var Zc = m.profil.boules.zone, Zl = zonesParLieu[m.lieu], L = Zl ? Zl.liste : null;
      for (var q = 0; q < joueurs.length; q++) {
        var j = joueurs[q], e = m.expos[j.id];
        if (!e) e = m.expos[j.id] = { expo: 0, hors: 99, tick: 0 };
        var dedans = null;
        if (L && j.vivant && j.lieu === m.lieu) {
          for (var k = 0; k < L.length; k++) { var zr = L[k]; if (zr.owner === m && zr.fin < 0 && h2(j.position.x - zr.x, j.position.z - zr.z) <= zr.rayon) { dedans = zr; break; } }
        }
        if (!dedans) { e.hors += dt; e.tick = 0; if (e.hors > Zc.oubli) e.expo = 0; continue; }
        e.hors = 0; e.expo += dt; e.tick += dt;
        if (e.tick < TICK_ZONE) continue;
        e.tick -= TICK_ZONE;
        var dps = Math.min(Zc.dpsMax, Zc.dpsBase + Zc.dpsParSeconde * e.expo), info = m.info;
        info.cible = j.id; info.position.x = dedans.x; info.position.y = 0; info.position.z = dedans.z; info.impact.x = j.position.x; info.impact.y = 1; info.impact.z = j.position.z;
        info.degats = dps * TICK_ZONE; info.flou = 0; info.etourdissement = 0; info.duree = TICK_ZONE; info.rayon = dedans.rayon; info.touche = true; info.etat = 'tick'; info.intensite = e.expo; info.id = dedans.id;
        blesser(m, j.id, info.degats, 'zone', info);
      }
    }

    // ── v1.4 : fléau du Démembré : tous les joueurs à `portee` m dans le cône de `angle`° devant lui ──
    function frapperFleau(m, joueurs) {
      var FL = m.profil.fleau, info = m.info, cosDemi = Math.cos(FL.angle * PI / 360), fx = Math.sin(m.lacet), fz = Math.cos(m.lacet), n = 0;
      for (var q = 0; q < joueurs.length; q++) {
        var j = joueurs[q];
        if (!j.vivant || j.lieu !== m.lieu) continue;
        var dx = j.position.x - m.position.x, dz = j.position.z - m.position.z, d = h2(dx, dz);
        if (d > FL.portee || (d > 1e-4 && (dx * fx + dz * fz) / d < cosDemi)) continue;
        n++;
        info.cible = j.id; info.position.x = j.position.x; info.position.y = (j.position.y || 0) + 1.1; info.position.z = j.position.z; info.impact.x = info.position.x; info.impact.y = info.position.y; info.impact.z = info.position.z;
        info.degats = FL.degats; info.flou = 0; info.etourdissement = 0; info.duree = 0; info.rayon = FL.portee; info.touche = true; info.etat = 'touche'; info.intensite = 1; info.id = null;
        blesser(m, j.id, FL.degats, 'fleau', info);
        signaler(m, 'impact', info);
        projeter(terrePour(m.lieu), j.position.x, 1.1, j.position.z, 8, 1.6, 0.3, 0.3);
      }
      return n;
    }
    // ── bras détaché du Démembré : pendule (centre de gravité du bras au bout des tendons), mû par le corps ; pendant le fléau,
    //    trajectoire imposée (tournoiement puis arc), relâchée à la fin avec sa vitesse. Aucune allocation. ──
    var ATT_LOC = [ATTACHE_TENDONS[0] - POS.poitrine[0], ATTACHE_TENDONS[1] - POS.poitrine[1], ATTACHE_TENDONS[2] - POS.poitrine[2]];
    var BL_LOC = [OS_LIBRE[0][2] - POS.poitrine[0], OS_LIBRE[0][3] - POS.poitrine[1], OS_LIBRE[0][4] - POS.poitrine[2]];
    var AXE_BRAS = norm3([OS_LIBRE[1][2] - OS_LIBRE[0][2], OS_LIBRE[1][3] - OS_LIBRE[0][3], OS_LIBRE[1][4] - OS_LIBRE[0][4]]), C_BRAS = 0.3;
    var CG_LOC = [BL_LOC[0] + AXE_BRAS[0] * C_BRAS, BL_LOC[1] + AXE_BRAS[1] * C_BRAS, BL_LOC[2] + AXE_BRAS[2] * C_BRAS];
    var L_CG = Math.sqrt(Math.pow(CG_LOC[0] - ATT_LOC[0], 2) + Math.pow(CG_LOC[1] - ATT_LOC[1], 2) + Math.pow(CG_LOC[2] - ATT_LOC[2], 2));
    var DIR_REPOS = new THREE.Vector3((CG_LOC[0] - ATT_LOC[0]) / L_CG, (CG_LOC[1] - ATT_LOC[1]) / L_CG, (CG_LOC[2] - ATT_LOC[2]) / L_CG);
    var _bA = new THREE.Vector3(), _bR = new THREE.Vector3(), _bD = new THREE.Vector3(), _bInv = new THREE.Matrix4(), _bQ = new THREE.Quaternion(), _bT = new THREE.Vector3();
    function brasDemembre(m, dt) {
      var Br = m.bras, sc = m.scale, poi = m.os.poitrine, Lw = L_CG * sc;
      _bA.set(ATT_LOC[0], ATT_LOC[1], ATT_LOC[2]).applyMatrix4(poi.matrixWorld);                           // ancre (bas du moignon), monde
      _bR.copy(DIR_REPOS).transformDirection(poi.matrixWorld);                                               // direction de repos, monde
      var fx = Math.sin(m.lacet), fz = Math.cos(m.lacet), gx = Math.cos(m.lacet), gz = -Math.sin(m.lacet);  // avant, gauche (repère du corps)
      if (!Br.init || !(dt > 0)) {
        Br.cx = _bA.x + _bR.x * Lw; Br.cy = _bA.y + _bR.y * Lw; Br.cz = _bA.z + _bR.z * Lw; Br.vx = Br.vy = Br.vz = 0; Br.init = true;
      }
      var px = Br.cx, py = Br.cy, pz = Br.cz, script = false, tx = 0, ty = 0, tz = 0, allonge = 1;
      if (m.etat === 'actif' && m.mode === 'fleau') {
        var P0 = m.profil.fleau.preparation, tf = m.modeT, psi = 0, R = 0.8, hy = 0;
        // tournoiement au-dessus de l'épaule (cercle incliné : haut devant, bas derrière), puis arc qui s'abat de gauche à droite
        if (tf < P0) { var u = tf / P0; psi = PI / 2 + TAU * (1 - Math.pow(u, 1.6)); R = 0.52 + 0.3 * u; hy = -0.3 * (1 - u) * (1 - u) + 0.3 * u + 0.16 * u * Math.cos(psi); script = true; }
        else if (tf < P0 + DUREE_FRAPPE) { var v = (tf - P0) / DUREE_FRAPPE, e = 1 - Math.pow(1 - v, 1.6); psi = PI / 2 - PI * e; R = 0.86; hy = 0.3 - 0.52 * v + 0.12 * Math.cos(psi); script = true; }
        if (script) {
          m.fleauPsi = psi;
          var cp = Math.cos(psi), sp = Math.sin(psi), rw = R * sc;
          tx = _bA.x + (fx * cp + gx * sp) * rw; ty = _bA.y + hy * sc; tz = _bA.z + (fz * cp + gz * sp) * rw;
          allonge = R / L_CG;
        }
      }
      if (m.etat === 'actif' && m.mode === 'arrache' && m.arr.phase === 1) {
        // v1.5 : la main droite saisit le bras pendu et l'amène devant le corps
        posOs(m, 'mainD', _bT);
        var kg = U.smooth(0.2, 0.85, m.rageT / Math.max(0.05, m.arr.tArr)), rx0 = _bA.x + _bR.x * Lw, ry0 = _bA.y + _bR.y * Lw, rz0 = _bA.z + _bR.z * Lw;
        tx = rx0 + (_bT.x - rx0) * kg; ty = ry0 + (_bT.y - 0.06 * sc - ry0) * kg; tz = rz0 + (_bT.z - rz0) * kg; script = true;
      }
      if (script) {
        var kq = Math.min(1, dt * 26);
        Br.cx += (tx - Br.cx) * kq; Br.cy += (ty - Br.cy) * kq; Br.cz += (tz - Br.cz) * kq;
        if (dt > 0) { Br.vx = (Br.cx - px) / dt; Br.vy = (Br.cy - py) / dt; Br.vz = (Br.cz - pz) / dt; }
      } else {
        // pendule : gravité, rappel doux vers la pose de repos (tendons), amortissement, corde (tendons) de longueur Lw
        var kr = m.etat === 'mort' ? 3 : 13, am = 1.7;
        Br.vx += ((_bA.x + _bR.x * Lw - Br.cx) * kr - Br.vx * am) * dt;
        Br.vy += (-9.8 + (_bA.y + _bR.y * Lw - Br.cy) * kr - Br.vy * am) * dt;
        Br.vz += ((_bA.z + _bR.z * Lw - Br.cz) * kr - Br.vz * am) * dt;
        Br.cx += Br.vx * dt; Br.cy += Br.vy * dt; Br.cz += Br.vz * dt;
        var dx = Br.cx - _bA.x, dy = Br.cy - _bA.y, dz = Br.cz - _bA.z, dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        if (dl > Lw) {
          var nx = dx / dl, ny = dy / dl, nz = dz / dl, vr = Br.vx * nx + Br.vy * ny + Br.vz * nz;
          Br.cx = _bA.x + nx * Lw; Br.cy = _bA.y + ny * Lw; Br.cz = _bA.z + nz * Lw;
          if (vr > 0) { Br.vx -= nx * vr; Br.vy -= ny * vr; Br.vz -= nz * vr; }
        }
        // le bras ne traverse pas le corps : ellipse du torse et des hanches (repère du corps)
        var ox = Br.cx - m.position.x, oz = Br.cz - m.position.z, yl = (Br.cy - m.position.y) / sc;
        if (yl > 0.45 && yl < 1.5) {
          var xl = (ox * gx + oz * gz) / sc, zl = (ox * fx + oz * fz) / sc + 0.02, ex = xl / 0.36, ez = zl / 0.29, el = ex * ex + ez * ez;
          if (el < 1 && el > 1e-6) {
            var kel = 1 / Math.sqrt(el), nxl = xl * kel - xl, nzl = zl * kel - zl;
            var wx = (gx * nxl + fx * nzl) * sc, wz = (gz * nxl + fz * nzl) * sc, wl = Math.sqrt(wx * wx + wz * wz) || 1e-6;
            Br.cx += wx; Br.cz += wz;
            var vn = (Br.vx * wx + Br.vz * wz) / wl; if (vn < 0) { Br.vx -= wx / wl * vn; Br.vz -= wz / wl * vn; }
          }
        }
      }
      // os du bras : direction de repos → direction actuelle (repère de la poitrine), tendons allongés au-delà de leur longueur
      var dx2 = Br.cx - _bA.x, dy2 = Br.cy - _bA.y, dz2 = Br.cz - _bA.z, dl2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2) || 1e-6;
      _bInv.copy(poi.matrixWorld).invert();
      _bD.set(dx2 / dl2, dy2 / dl2, dz2 / dl2).transformDirection(_bInv);
      _bQ.setFromUnitVectors(DIR_REPOS, _bD);
      var Ob = m.os.brasLibre, extra = Math.max(0, dl2 / sc - L_CG);
      _bT.set(BL_LOC[0] - ATT_LOC[0], BL_LOC[1] - ATT_LOC[1], BL_LOC[2] - ATT_LOC[2]).applyQuaternion(_bQ);
      Ob.position.set(ATT_LOC[0] + _bT.x + _bD.x * extra, ATT_LOC[1] + _bT.y + _bD.y * extra, ATT_LOC[2] + _bT.z + _bD.z * extra);
      Ob.quaternion.copy(_bQ);
      // coude : légèrement plié au repos, tendu par la force centrifuge pendant le fléau, ballant pendant la course
      var vit = Math.sqrt(Br.vx * Br.vx + Br.vy * Br.vy + Br.vz * Br.vz), coude = script ? 0.04 : 0.16 + Math.min(0.35, vit * 0.05);
      Br.coude += (coude - Br.coude) * Math.min(1, dt * 8);
      _eMB.set(-Br.coude, 0, 0, 'XYZ'); _qMB.setFromEuler(_eMB); m.os.avantBrasLibre.quaternion.copy(m.rest.avantBrasLibre).multiply(_qMB);
      _eMB.set(-0.25 - 0.2 * Br.coude, 0, 0.1, 'XYZ'); _qMB.setFromEuler(_eMB); m.os.mainLibre.quaternion.copy(m.rest.mainLibre).multiply(_qMB);
      Br.px = Br.cx; Br.py = Br.cy; Br.pz = Br.cz;
      return allonge;
    }
    var DUREE_FRAPPE = 0.2, RECUP_FLEAU = 0.45;
    function rendreLumiere(m) { if (m.lumiere) { if (monde && monde.rendreLumiereTube) monde.rendreLumiereTube(m.lumiere); m.lumiere = null; } }
    function eteindreEffets(m) {
      if (m.rubans) { m.rubans.n = 0; finRubans(m.rubans); }
      if (m.haloSol) m.haloSol.visible = false;
      for (var h = 0; h < m.halos.length; h++) m.halos[h].visible = false;
      for (var l = 0; l < m.lueurs.length; l++) m.lueurs[l].visible = false;
      for (var b = 0; b < m.bolts.length; b++) m.bolts[b].t = 0;
      if (m.type === 'irradie') { eteindreZones(m); eteindreBoules(m); }
      m.dangerCh.actif = false;
    }
    function tuerMiniBoss(m, tueur) {
      m.etat = 'mort'; m.t = 0; m.vitesse.set(0, 0, 0); m.mortAvant = m.type !== 'survolte';
      m.flaqueFaite = false; m.invulT = 0; m.rage = null; m.dangerCh.actif = false;
      if (m.arr.objet) fletrirBras(m);                                     // v1.5 : le bras posé se flétrit tout seul
      if (m.type === 'irradie') { eteindreZones(m); eteindreBoules(m); }
      var info = m.info;
      info.cible = null; info.position.x = m.position.x; info.position.y = 1; info.position.z = m.position.z; info.degats = 0; info.etat = 'mort'; info.touche = false; info.intensite = 1; info.id = null;
      if (m.type === 'survolte') { signaler(m, 'spasme', info); projeter(etincellesPour(m.lieu), m.position.x, 1.2, m.position.z, 40, 3.5, 0.4, 0.3); }
      surMort(m, tueur);
    }
    // ── rages (v1.5, §17.1) : la logique appelle jeu.effetZombie(id, capacite, params) ; le jeu joue l'animation, rend le
    //    mini-boss invulnérable `duree` s (surcharge, arrachement : toucher → immunisé) et garde la capacité jusqu'à sa mort.
    //    `reprise: true` (remis devant sa cuve) : l'état reprend sans rejouer le début (aucun second bras). ──
    function surcharger(m, p) {
      if (!Z.vivant(m)) return false;
      var D = p.duree > 0 ? +p.duree : 0, Dt = m.profil.rageDuree > 0 ? m.profil.rageDuree : 2.5, src = p.source;
      m.sourceX = src && isFinite(src.x) ? +src.x : m.position.x + Math.sin(m.lacet) * 6; m.sourceY = src && isFinite(src.y) ? +src.y : 4;
      m.sourceZ = src && isFinite(src.z) ? +src.z : m.position.z + Math.cos(m.lacet) * 6;
      if (m.etat === 'cuve') { m.etat = 'actif'; m.t = 0; }
      if (D <= 0) { m.surcharge = true; m.rage = null; m.invulT = 0; if (m.mode === 'surcharge') { m.mode = 'chasse'; m.modeT = 0; } return true; }
      m.rage = 'surcharge'; m.rageD = p.reprise ? Math.max(D, Dt) : D; m.rageT = m.rageD - D; m.invulT = D;
      m.mode = 'surcharge'; m.modeT = 0; m.chargeK = 0; m.vitesse.set(0, 0, 0);      // il s'immobilise aussitôt
      return true;
    }
    function crier(m, p) {                                              // L'Irradié : cri d'infection (il reste vulnérable)
      if (!Z.vivant(m)) return false;
      var D = p.duree > 0 ? +p.duree : 0;
      if (D <= 0) return true;
      if (m.etat === 'cuve') { m.etat = 'actif'; m.t = 0; }
      m.rage = 'cri'; m.rageD = D; m.rageT = 0; m.mode = 'cri'; m.modeT = 0; m.vitesse.set(0, 0, 0);
      return true;
    }
    function arracher(m, p) {
      if (!Z.vivant(m) || (m.sansBras && !p.reprise)) return false;
      var D = p.duree >= 0 ? +p.duree : (m.profil.rageDuree || 2.4), V = p.vol >= 0 ? Math.min(+p.vol, D) : Math.min(1.2, D), Ar = m.arr;
      Ar.cx = p.cible && isFinite(p.cible.x) ? +p.cible.x : 0; Ar.cz = p.cible && isFinite(p.cible.z) ? +p.cible.z : 0; Ar.vol = V;
      if (m.etat === 'cuve' || m.etat === 'bras') { m.etat = 'actif'; m.t = 0; }
      m.rageD = D; m.rageT = 0; m.invulT = D; m.dangerCh.actif = false; m.vitesse.set(0, 0, 0);
      Ar.tLance = Math.max(0, D - V); Ar.tArr = Math.min(Ar.tLance, Math.max(0.35, Ar.tLance * 0.55));
      if (p.reprise) {
        var B = brasOrphelin();
        m.sansBras = true; cacherBrasCorps(m);
        if (B) { B.owner = m; B.dernier = m; B.orphelinT = -1; Ar.objet = B; Ar.phase = B.etat === 'main' ? 3 : 4; }
        else { Ar.phase = 2; arracherBras(m, true); }                     // il n'avait pas encore lancé : le bras est déjà dans sa main
        if (D <= 0) { if (Ar.phase === 3) { m.rageD = 0; lancerBras(m); } m.rage = null; m.mode = 'chasse'; m.modeT = 0; Ar.phase = 5; return true; }
        m.rage = 'arrachement'; m.mode = 'arrache'; m.modeT = 0;
        if (Ar.phase === 3 && Ar.tLance <= 0) lancerBras(m);
        return true;
      }
      m.rage = 'arrachement'; m.mode = 'arrache'; m.modeT = 0; Ar.phase = 1; Ar.objet = null;
      if (D <= 0) { arracherBras(m); lancerBras(m); m.rage = null; m.mode = 'chasse'; Ar.phase = 5; }
      return true;
    }
    // longueur libre d'une charge (murs de l'octogone, la salle seulement ; les piliers l'arrêtent en chemin)
    var AR_SALLE = root.BOSS_B7_ARENE && root.BOSS_B7_ARENE.salle;
    function longueurLibre(m, dx, dz, max) {
      if (m.lieu !== 'salle') return max;
      var O = (AR_SALLE && AR_SALLE.origine) || { x: 0, z: 0 }, Lim = (AR_SALLE && AR_SALLE.limiteJoueurs ? AR_SALLE.limiteJoueurs : 14.3) - m.rayonCol, best = max;
      var px = m.position.x - O.x, pz = m.position.z - O.z;
      for (var k = 0; k < 8; k++) {
        var th = k * PI / 4, nx = Math.sin(th), nz = Math.cos(th), dn = dx * nx + dz * nz;
        if (dn > 1e-4) { var t = (Lim - (px * nx + pz * nz)) / dn; if (t < best) best = t > 0 ? t : 0; }
      }
      return best;
    }
    function majDangerCharge(m, dx, dz, reste) {
      var D0 = m.dangerCh, L = longueurLibre(m, dx, dz, reste);
      D0.actif = true; D0.lieu = m.lieu; D0.largeur = m.profil.charge.largeur;
      D0.a.x = m.position.x; D0.a.z = m.position.z; D0.b.x = m.position.x + dx * L; D0.b.z = m.position.z + dz * L;
    }
    function signalCharge(m, etat, cibleId, x, z) {
      var I = m.info, CH = m.profil.charge;
      I.cible = cibleId; I.position.x = x; I.position.y = 1.2 * m.scale * 0.5; I.position.z = z; I.impact.x = m.dangerCh.b.x; I.impact.y = 0; I.impact.z = m.dangerCh.b.z;
      I.degats = etat === 'impact' ? CH.degats : 0; I.flou = 0; I.etourdissement = 0; I.duree = etat === 'preparation' ? CH.preparation : etat === 'mur' ? CH.etourdiMur : 0;
      I.rayon = CH.largeur; I.touche = etat === 'impact'; I.etat = etat; I.intensite = 1; I.id = null; I.projection.duree = 0;
      signaler(m, 'charge', I);
    }
    // joueurs à moins de `largeur` m du segment parcouru : `degats` (source 'charge') et projetés (sens de la charge, écartés de 45°)
    function toucherCharge(m, joueurs) {
      var CH = m.profil.charge, ax = m.chX0, az = m.chZ0, ex = m.position.x - ax, ez = m.position.z - az, l2 = ex * ex + ez * ez;
      for (var q = 0; q < joueurs.length; q++) {
        var j = joueurs[q];
        if (!j.vivant || j.lieu !== m.lieu || m.chTouches[j.id] === true) continue;
        var t = l2 > 1e-6 ? ((j.position.x - ax) * ex + (j.position.z - az) * ez) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        var qx = j.position.x - (ax + ex * t), qz = j.position.z - (az + ez * t);
        if (qx * qx + qz * qz > CH.largeur * CH.largeur) continue;
        m.chTouches[j.id] = true;
        var nx = -m.chDirZ, nz = m.chDirX, s = (j.position.x - ax) * nx + (j.position.z - az) * nz >= 0 ? 1 : -1;
        var px = m.chDirX + nx * s, pz = m.chDirZ + nz * s, pl = h2(px, pz) || 1, I = m.info;
        I.cible = j.id; I.position.x = j.position.x; I.position.y = 1.1; I.position.z = j.position.z; I.impact.x = j.position.x; I.impact.y = 1.1; I.impact.z = j.position.z;
        I.degats = CH.degats; I.flou = 0; I.etourdissement = 0; I.duree = CH.projDuree; I.rayon = CH.largeur; I.touche = true; I.etat = 'impact'; I.intensite = 1; I.id = null;
        I.projection.vx = px / pl * CH.projVitesse; I.projection.vz = pz / pl * CH.projVitesse; I.projection.duree = CH.projDuree;
        if (blesser(m, j.id, CH.degats, 'charge', I)) noterProjection(m, j.id, CH.projDuree);
        I.projection.duree = 0;
        signaler(m, 'charge', I);
        projeter(terrePour(m.lieu), j.position.x, 1.0, j.position.z, 18, 2.6, 0.4, 0.4); projeter(sangPour(m.lieu), j.position.x, 1.2, j.position.z, 14, 2.4, 0.3, 0.4);
      }
    }
    /** Le Démembré sans bras : coups du bras droit au contact, charge (préparation lisible, ruée en ligne droite, étourdi contre
     *  un mur ou un pilier, recharge). */
    function majSansBras(m, dt, temps, cible, bd, vise, joueurs) {
      var CH = m.profil.charge, E = m.echelle, allonge = 1.75 * E;
      m.chargeAttente -= dt;
      if (m.mode === 'chPrep') {
        // trajectoire figée dès le début de la préparation (vers la position de sa proie à cet instant) : annoncée et esquivable
        deplacerMB(m, dt, temps, null, 'arret', 0);
        tourner(m, dt, Math.atan2(m.chDirX, m.chDirZ), 6);
        majDangerCharge(m, m.chDirX, m.chDirZ, CH.distanceMax);
        if (alea() < dt * 22) projeter(terrePour(m.lieu), m.position.x - Math.sin(m.lacet) * 0.35 * E + Math.cos(m.lacet) * -0.2 * E, 0.05, m.position.z - Math.cos(m.lacet) * 0.35 * E - Math.sin(m.lacet) * -0.2 * E, 3, 1.6, 0.2, 0.5);
        if (m.modeT >= CH.preparation) {
          var dx = m.chDirX, dz = m.chDirZ; m.lacet = Math.atan2(dx, dz);
          m.chX0 = m.position.x; m.chZ0 = m.position.z; m.chDist = 0;
          for (var kt in m.chTouches) m.chTouches[kt] = false;
          m.mode = 'chElan'; m.modeT = 0;
          majDangerCharge(m, dx, dz, CH.distanceMax);
          signalCharge(m, 'elan', cible ? cible.id : null, m.position.x, m.position.z);
        }
      } else if (m.mode === 'chElan') {
        var vit = CH.vitesse, pas = vit * dt, nSp = Math.max(1, Math.ceil(pas / 0.25)), st = pas / nSp, bute = false;
        for (var sp = 0; sp < nSp && !bute && m.chDist < CH.distanceMax; sp++) {
          _pos.x = m.position.x + m.chDirX * st; _pos.z = m.position.z + m.chDirZ * st;
          if (monde) monde.resoudre(m.lieu, _pos, m.rayonCol);
          var av = (_pos.x - m.position.x) * m.chDirX + (_pos.z - m.position.z) * m.chDirZ;
          m.position.x = _pos.x; m.position.z = _pos.z; m.chDist += av > 0 ? av : 0;
          if (av < st * 0.55) bute = true;                                 // un mur ou un pilier l'arrête
        }
        m.vitesse.x = m.chDirX * vit; m.vitesse.z = m.chDirZ * vit; m.lacet = Math.atan2(m.chDirX, m.chDirZ);
        toucherCharge(m, joueurs);
        majDangerCharge(m, m.chDirX, m.chDirZ, Math.max(0, CH.distanceMax - m.chDist));
        if (alea() < dt * 30) projeter(terrePour(m.lieu), m.position.x + (alea() - 0.5) * 0.6 * E, 0.05, m.position.z + (alea() - 0.5) * 0.6 * E, 3, 1.4, 0.3, 0.6);
        if (bute) {
          m.mode = 'etourdi'; m.modeT = 0; m.vitesse.set(0, 0, 0); m.dangerCh.actif = false;
          var fx = m.position.x + m.chDirX * m.rayonCol, fz = m.position.z + m.chDirZ * m.rayonCol;
          projeter(terrePour(m.lieu), fx, 1.2 * E, fz, 60, 4.0, 0.9, 0.7);
          signalCharge(m, 'mur', null, fx, fz);
        } else if (m.chDist >= CH.distanceMax - 1e-3) { m.mode = 'chFin'; m.modeT = 0; m.dangerCh.actif = false; }
      } else if (m.mode === 'chFin') {
        var kf = Math.max(0, 1 - m.modeT / 0.45), v2 = CH.vitesse * 0.35 * kf;           // il freine en glissant
        _pos.x = m.position.x + m.chDirX * v2 * dt; _pos.z = m.position.z + m.chDirZ * v2 * dt;
        if (monde) monde.resoudre(m.lieu, _pos, m.rayonCol);
        m.position.x = _pos.x; m.position.z = _pos.z; m.vitesse.x = m.chDirX * v2; m.vitesse.z = m.chDirZ * v2;
        if (alea() < dt * 25 * kf) projeter(terrePour(m.lieu), m.position.x, 0.05, m.position.z, 2, 1.2, 0.4, 0.5);
        if (m.modeT >= 0.45) { m.mode = 'chasse'; m.modeT = 0; m.chargeAttente = CH.recharge; m.vitesse.set(0, 0, 0); }
      } else if (m.mode === 'etourdi') {
        deplacerMB(m, dt, temps, null, 'arret', 0);
        if (m.modeT >= CH.etourdiMur) { m.mode = 'chasse'; m.modeT = 0; m.chargeAttente = CH.recharge; }
      } else if (m.mode === 'contact') {
        deplacerMB(m, dt, temps, cible, 'arret', 0);
        tourner(m, dt, vise, 4);
        if (!m.attaqueFrappee && m.modeT >= 0.62) { m.attaqueFrappee = true; if (cible && bd < allonge + 0.45) { surAttaque(m, cible.id); projeter(terrePour(m.lieu), cible.position.x, 1.0, cible.position.z, 10, 2.0, 0.3, 0.3); } }
        if (m.modeT >= 1.25) { m.mode = 'chasse'; m.modeT = 0; m.attenteContact = Math.max(0.1, m.profil.cadenceContact - 1.25); }
      } else {
        m.mode = 'chasse'; m.dangerCh.actif = false;
        var vu = cible && (!monde || monde.visible(m.position, cible.position, m.lieu));
        if (cible && bd < allonge && m.attenteContact <= 0) { m.mode = 'contact'; m.modeT = 0; m.attaqueFrappee = false; }
        else if (cible && vu && m.chargeAttente <= 0 && bd > allonge + 1.0 && bd <= CH.distanceMax) {
          m.mode = 'chPrep'; m.modeT = 0;
          var cx = cible.position.x - m.position.x, cz = cible.position.z - m.position.z, cl = h2(cx, cz) || 1;
          m.chDirX = cx / cl; m.chDirZ = cz / cl;
          majDangerCharge(m, m.chDirX, m.chDirZ, CH.distanceMax);
          signalCharge(m, 'preparation', cible.id, m.position.x, m.position.z);
        }
        if (m.mode === 'chasse') deplacerMB(m, dt, temps, cible, cible && bd > allonge - 0.3 ? 'approche' : 'arret', m.vitesseMax);
        else deplacerMB(m, dt, temps, null, 'arret', 0);
        tourner(m, dt, vise, 4);
      }
    }
    /** Arrachement en cours (invulnérable) : il saisit son bras pendu, l'arrache, l'arme au-dessus de sa tête, le lance au centre. */
    function majArrachement(m, dt) {
      var Ar = m.arr;
      deplacerMB(m, dt, 0, null, 'arret', 0);
      m.rageT += dt;
      tourner(m, dt, Math.atan2(Ar.cx - m.position.x, Ar.cz - m.position.z), 3);
      if (Ar.phase === 1 && m.rageT >= Ar.tArr) arracherBras(m);
      if (Ar.phase === 3 && m.rageT >= Ar.tLance) lancerBras(m);
      if (Ar.phase === 3 && alea() < dt * 8) { m.groupe.updateMatrixWorld(true); _vm.set(ATT_LOC[0], ATT_LOC[1], ATT_LOC[2]).applyMatrix4(m.os.poitrine.matrixWorld); projeter(sangPour(m.lieu), _vm.x, _vm.y, _vm.z, 3, 1.2, 0.1, 0.4); }
      if (m.rageT >= m.rageD) {
        if (Ar.phase < 3) arracherBras(m);
        if (Ar.phase < 4) lancerBras(m);
        Ar.phase = 5; m.rage = null; m.mode = 'chasse'; m.modeT = 0; m.chargeAttente = 0.8; m.attenteContact = 0.4;
      }
    }
    // ── IA et capacités (aucune allocation) ──
    function majMiniBoss(m, dt, temps, joueurs) {
      m.t += dt; m.reaction = Math.max(0, m.reaction - dt * 4); m.flash = Math.max(0, m.flash - dt * 7);
      if (m.invulT > 0) m.invulT = Math.max(0, m.invulT - dt);
      for (var kb = 0; kb < m.bolts.length; kb++) if (m.bolts[kb].t > 0) m.bolts[kb].t -= dt;
      var sv = m.type === 'survolte', ir = m.type === 'irradie', dm = m.fam === 'demembre';
      if (m.etat === 'bras') {
        // v1.5 : petit Démembré qui s'extrait du sol près du bras : il remonte (0–0,6 s), rampe (→ 1,4 s), se redresse (→ 2,0 s)
        var kc0 = U.smooth(0.5, 1.4, m.t);
        m.position.x = U.lerp(m.cuve.sx, m.cuve.px, kc0); m.position.z = U.lerp(m.cuve.sz, m.cuve.pz, kc0);
        if (m.t < 1.0 && alea() < dt * 30) projeter(terrePour(m.lieu), m.position.x + (alea() - 0.5) * 0.7, 0.05, m.position.z + (alea() - 0.5) * 0.7, 2, 1.6, 0.3, 0.5);
        if (m.t < 0.8 && alea() < dt * 12) projeter(sangPour(m.lieu), m.position.x + (alea() - 0.5) * 0.4, 0.1, m.position.z + (alea() - 0.5) * 0.4, 2, 1.4, 0.2, 0.4);
        cibleMB(m, joueurs);
        if (m.t > 1.2 && m.cible) tourner(m, dt, Math.atan2(m.cible.position.x - m.position.x, m.cible.position.z - m.position.z), 3);
        if (m.t >= 2.0) { m.etat = 'actif'; m.t = 0; m.mode = 'chasse'; m.modeT = 0; m.attenteContact = 0.3; }
      } else if (m.etat === 'effondrement') {
        // v1.5 : à la mort du géant, les petits s'écroulent et se dissolvent (sans points)
        var uE = m.mat.userData.u;
        uE.uDesseche.value = U.clamp((m.t - 0.35) / 0.8, 0, 1) * 0.7; uE.uDissolution.value = U.clamp((m.t - 0.7) / 0.95, 0, 1);
        if (m.t < 0.8 && alea() < dt * 14) projeter(sangPour(m.lieu), m.position.x + (alea() - 0.5) * 0.5, 0.5 + alea() * 0.6, m.position.z + (alea() - 0.5) * 0.5, 2, 1.2, 0.2, 0.4);
        if (m.t > 0.6 && alea() < dt * 10) projeter(terrePour(m.lieu), m.position.x + (alea() - 0.5) * 0.8, 0.15, m.position.z + (alea() - 0.5) * 0.8, 2, 0.8, 0.3, 0.5);
        for (var hE = 0; hE < m.halos.length; hE++) m.halos[hE].visible = m.t < 0.4;
        if (m.t > 1.75) { liberer(m); return; }
      } else if (m.etat === 'cuve') {
        // bascule du socle (0–0,45 s), à quatre pattes (→ 1,25 s), se redresse (→ 2,4 s)
        var kf = U.smooth(0, 0.45, m.t), kc = U.smooth(0.45, 1.25, m.t);
        m.position.x = U.lerp(m.cuve.sx, m.cuve.px, 0.55 * kf + 0.45 * kc); m.position.z = U.lerp(m.cuve.sz, m.cuve.pz, 0.55 * kf + 0.45 * kc);
        if (m.t < 1.3 && alea() < dt * 30) projeter(sporesPour(m.lieu), m.position.x + (alea() - 0.5) * 0.6, 0.2 + alea() * 0.8, m.position.z + (alea() - 0.5) * 0.6, 1, 0.6, 0.2, 0.6);
        if (m.t < 2.0 && alea() < dt * 8) projeter(vapeurPour(m.lieu), m.position.x + (alea() - 0.5) * 0.5, 0.5 + alea(), m.position.z + (alea() - 0.5) * 0.5, 1, 0.4, 0.3, 1.0);
        if (m.t >= 2.4) { m.etat = 'actif'; m.t = 0; m.mode = ir ? 'marche' : 'chasse'; m.modeT = 0; }
        cibleMB(m, joueurs);
        if (m.t > 1.25 && m.cible) tourner(m, dt, Math.atan2(m.cible.position.x - m.position.x, m.cible.position.z - m.position.z), 2.5);
      } else if (m.etat === 'mort') {
        var dur = sv ? 3.6 : dm ? 3.3 : 2.9, u = m.mat.userData.u;
        if (sv) {
          // court-circuit : convulsions et étincelles, effondrement, corps calciné qui s'effrite
          if (m.t < 1.0 && alea() < dt * 12) { projeter(etincellesPour(m.lieu), m.position.x + (alea() - 0.5) * 0.4, 0.6 + alea() * 1.1, m.position.z + (alea() - 0.5) * 0.4, 8, 2.8, 0.2, 0.25); m.flash = Math.max(m.flash, 0.7); }
          if (m.t > 1.6 && m.t < 3.0 && alea() < dt * 3) projeter(etincellesPour(m.lieu), m.position.x + (alea() - 0.5) * 0.8, 0.15, m.position.z + (alea() - 0.5) * 0.8, 4, 1.6, 0.2, 0.2);
          if (m.t > 1.2 && alea() < dt * 5) projeter(vapeurPour(m.lieu), m.position.x + (alea() - 0.5) * 0.8, 0.25, m.position.z + (alea() - 0.5) * 0.8, 1, 0.5, 0.3, 1.2);
          u.uBrulure.value = U.clamp((m.t - 2.0) / 0.8, 0, 1) * 0.8; u.uDesseche.value = U.clamp((m.t - 1.2) / 1.0, 0, 1) * 0.7;
          u.uDissolution.value = U.clamp((m.t - 2.6) / 0.95, 0, 1);
          var cE = m.matE.color, kE = Math.max(0, 1.6 - m.t); cE.r = m.t < 1.0 ? 0.5 + 0.5 * alea() : kE; cE.g = m.t < 1.0 ? 0.5 + 0.5 * alea() : kE; cE.b = m.t < 1.0 ? 0.5 + 0.5 * alea() : kE;
        } else if (ir) {
          // s'effondre à genoux puis face contre terre ; la flaque toxique s'étale, le corps s'y dissout
          if (!m.flaqueFaite && m.t > 0.9) { m.flaqueFaite = true; creerFlaque(m); }
          u.uDesseche.value = U.clamp((m.t - 1.3) / 0.8, 0, 1) * 0.6; u.uDissolution.value = U.clamp((m.t - 1.7) / 1.1, 0, 1);
          var ke = Math.max(0, 1 - m.t / 1.4), cI = m.matE.color; cI.r = ke; cI.g = ke; cI.b = ke;
          if (alea() < dt * 20) projeter(sporesPour(m.lieu), m.position.x + (alea() - 0.5) * 0.7, 0.2 + alea() * 0.6, m.position.z + (alea() - 0.5) * 0.7, 1, 0.5, 0.2, 0.6);
        } else {
          // le colosse vacille, tombe à genoux, s'abat face contre terre ; mare de sang, le corps se dessèche puis se dissout
          if (!m.flaqueFaite && m.t > 1.15) { var oE = 0.9 * m.echelle; m.flaqueFaite = true; decal(m.position.x + Math.sin(m.lacet) * oE, m.position.z + Math.cos(m.lacet) * oE, m.lieu, 8, 1.7 * m.echelle, [0.32, 0.03, 0.03]); projeter(terrePour(m.lieu), m.position.x + Math.sin(m.lacet) * oE, 0.1, m.position.z + Math.cos(m.lacet) * oE, 30 * m.echelle, 1.8, 0.8 * m.echelle, 0.5); }
          u.uDesseche.value = U.clamp((m.t - 1.6) / 0.9, 0, 1) * 0.65; u.uDissolution.value = U.clamp((m.t - 2.2) / 1.05, 0, 1);
          var kd = Math.max(0, 1 - m.t / 1.0), cD = m.matE.color; cD.r = kd; cD.g = kd; cD.b = kd;
        }
        for (var l = 0; l < m.lueurs.length; l++) m.lueurs[l].visible = sv ? m.t < 1.0 : m.t < 1.1;
        for (var hh = 0; hh < m.halos.length; hh++) m.halos[hh].visible = m.t < (sv ? 1.0 : 1.1);
        if (m.haloSol) { m.haloSol.visible = m.t < 1.2; m.haloSol.material.opacity = Math.max(0, 1 - m.t / 1.2); }
        if (m.t > dur) { liberer(m); return; }
      } else if (m.etat === 'cendres') {
        var u2 = m.mat.userData.u;
        u2.uBrulure.value = U.clamp(m.t / 0.5, 0, 1); u2.uDesseche.value = U.clamp(m.t / 0.8, 0, 1) * 0.8; u2.uDissolution.value = U.clamp((m.t - 0.45) / 1.0, 0, 1);
        if (alea() < dt * 50) projeter(braisesPour(m.lieu), m.position.x + (alea() - 0.5) * 0.6, 0.2 + alea() * 1.5 * (1 - u2.uDissolution.value), m.position.z + (alea() - 0.5) * 0.6, 2, 1.2, 0.2, 0.5);
        if (m.t > 1.5) { decal(m.position.x, m.position.z, m.lieu, 7, 1.0, [0.45, 0.42, 0.4]); liberer(m); return; }
      } else {
        // ── actif ──
        var cible = cibleMB(m, joueurs), bd = m.cibleDist, vise = m.lacet;
        m.attenteContact -= dt; m.modeT += dt;
        if (cible) vise = Math.atan2(cible.position.x - m.position.x, cible.position.z - m.position.z);
        if (sv) {
          var D = m.profil.decharge;
          if (m.mode !== 'surcharge') m.dechargeT += dt;
          m.spasmeT = Math.max(0, m.spasmeT - dt);
          if (m.mode === 'surcharge') {
            // v1.5 : surcharge (invulnérable) : immobile, bras levés vers le Septième, de plus en plus lumineux
            deplacerMB(m, dt, temps, null, 'arret', 0);
            m.rageT += dt; m.chargeK = U.smooth(0, m.rageD, m.rageT);
            vise = Math.atan2(m.sourceX - m.position.x, m.sourceZ - m.position.z);
            if (alea() < dt * (12 + 30 * m.chargeK)) projeter(etincellesPour(m.lieu), m.position.x + (alea() - 0.5) * 1.0, 0.4 + alea() * 1.8, m.position.z + (alea() - 0.5) * 1.0, 3, 2.6, 0.2, 0.2);
            if (m.rageT >= m.rageD) { m.surcharge = true; m.rage = null; m.mode = 'chasse'; m.modeT = 0; m.chargeK = 0; m.flash = 1; projeter(etincellesPour(m.lieu), m.position.x, 1.3, m.position.z, 60, 4.5, 0.5, 0.3); }
          } else if (m.mode === 'chasse') {
            m.strafeT -= dt; if (m.strafeT <= 0) { m.strafe = alea() < 0.5 ? -1 : 1; m.strafeT = 1.5 + alea() * 1.5; }
            var vis = !!cible && (!monde || monde.visible(m.position, cible.position, m.lieu));
            var pret = m.dechargeT >= D.intervalle - DUREE_CHARGE, vu = pret && (D.multi ? cibleDechargeVisible(m, joueurs, D.portee) : vis && bd <= D.portee);
            if (cible && bd < 1.6 && m.attenteContact <= 0) { m.mode = 'contact'; m.modeT = 0; m.attaqueFrappee = false; }
            else if (vu) {
              m.mode = 'charge'; m.modeT = 0;
              var ic = m.info; ic.cible = cible.id; ic.position.x = m.position.x; ic.position.y = 1.2; ic.position.z = m.position.z; ic.duree = DUREE_CHARGE; ic.degats = 0; ic.etat = 'charge'; ic.touche = false; ic.intensite = 1; ic.flou = 0; ic.etourdissement = 0; ic.id = null;
              signaler(m, 'charge', ic);
            }
            var modeD = !cible ? 'arret' : (bd > 7 || !vis) ? 'approche' : bd < 5 && bd > 1.6 ? 'recul' : bd >= 5 ? 'flanc' : 'arret';   // sans ligne de vue : il contourne pour la retrouver
            deplacerMB(m, dt, temps, cible, modeD, modeD === 'flanc' ? 1.1 : modeD === 'recul' ? m.vitesseMax * 0.7 : m.vitesseMax);
            // spasmes
            m.prochainSpasme -= dt;
            if (m.prochainSpasme <= 0) {
              m.prochainSpasme = 1.4 + alea() * 1.8; m.spasmeT = 0.35;
              var is = m.info; is.cible = null; is.position.x = m.position.x; is.position.y = 1.3; is.position.z = m.position.z; is.duree = 0.35; is.degats = 0; is.etat = 'spasme'; is.intensite = 0.6 + alea() * 0.4; is.touche = false; is.flou = 0; is.etourdissement = 0; is.id = null;
              signaler(m, 'spasme', is);
              projeter(etincellesPour(m.lieu), m.position.x, 1.0 + alea() * 0.6, m.position.z, 10, 2.6, 0.35, 0.2);
            }
          } else if (m.mode === 'charge') {
            deplacerMB(m, dt, temps, cible, 'arret', 0);
            m.chargeK = U.smooth(0, DUREE_CHARGE, m.modeT);
            if (alea() < dt * 30) projeter(etincellesPour(m.lieu), m.position.x + (alea() - 0.5) * 0.9, 0.9 + alea() * 0.9, m.position.z + (alea() - 0.5) * 0.9, 2, 1.8, 0.1, 0.15);
            if (m.modeT >= DUREE_CHARGE) {
              var ok = cible && cible.vivant && (D.multi || bd <= D.portee + 1.2);
              if (ok) { tirerDecharge(m, cible, joueurs); m.mode = 'decharge'; m.modeT = 0; }
              else { m.mode = 'chasse'; m.modeT = 0; m.chargeK = 0; }
            }
          } else if (m.mode === 'decharge') {
            deplacerMB(m, dt, temps, cible, 'arret', 0);
            if (m.modeT >= DUREE_DECHARGE) { m.mode = 'recharge'; m.modeT = 0; m.chargeK = 0; }
          } else if (m.mode === 'recharge') {
            // sa fenêtre : immobile, avachi, presque éteint
            deplacerMB(m, dt, temps, null, 'arret', 0);
            if (alea() < dt * 4) projeter(vapeurPour(m.lieu), m.position.x + (alea() - 0.5) * 0.4, 1.2 + alea() * 0.4, m.position.z + (alea() - 0.5) * 0.4, 1, 0.3, 0.2, 0.9);
            if (m.modeT >= D.recharge) { m.mode = 'chasse'; m.modeT = 0; }
          } else if (m.mode === 'contact') {
            deplacerMB(m, dt, temps, cible, 'arret', 0);
            if (!m.attaqueFrappee && m.modeT >= 0.38) {
              m.attaqueFrappee = true;
              if (cible && bd < 1.9) { surAttaque(m, cible.id); projeter(etincellesPour(m.lieu), cible.position.x, 1.2, cible.position.z, 12, 2.5, 0.3, 0.2); m.flash = Math.max(m.flash, 0.5); }
            }
            if (m.modeT >= 0.85) { m.mode = 'chasse'; m.modeT = 0; m.attenteContact = Math.max(0.1, m.profil.cadenceContact - 0.85); }   // un coup toutes les cadenceContact s
          }
          if (m.mode !== 'recharge') tourner(m, dt, vise, m.mode === 'charge' || m.mode === 'decharge' ? 9 : m.mode === 'surcharge' ? 3 : 5);
          if (m.mode !== 'recharge' && alea() < dt * (m.mode === 'charge' ? 10 : 3)) projeter(etincellesPour(m.lieu), m.position.x + Math.sin(m.lacet + 1.6) * 0.45, 0.9, m.position.z + Math.cos(m.lacet + 1.6) * 0.45, 2, 1.5, 0.1, 0.15);
        } else if (ir) {
          // L'Irradié : pas traînants (rapides), coup lourd au contact, aura permanente, salves de boules radioactives
          var BO = m.profil.boules;
          // la recharge des boules court dans tous les modes sauf le lancer (aussi pendant ses coups au contact) : « toutes les
          // intervalle s » (API.md §16.2) ; il ne lance qu'en marche, donc dès que la cible sort du contact
          if (m.mode !== 'lancer' && m.mode !== 'cri' && BO.intervalle > 0 && BO.parVolee > 0) m.bouleT += dt;
          if (m.mode === 'cri') {
            // v1.5 : cri d'infection (il reste vulnérable) : bras ouverts, tête renversée, bouffée de spores
            deplacerMB(m, dt, temps, null, 'arret', 0);
            m.rageT += dt;
            if (alea() < dt * 60) projeter(sporesPour(m.lieu), m.position.x + (alea() - 0.5) * 1.6, 0.4 + alea() * 1.8, m.position.z + (alea() - 0.5) * 1.6, 2, 1.6, 0.5, 1.0);
            if (m.rageT >= m.rageD) { m.rage = null; m.mode = 'marche'; m.modeT = 0; }
          } else if (m.mode === 'lancer') {
            deplacerMB(m, dt, temps, cible, 'arret', 0);
            if (!m.lance && m.modeT >= 0.42) { m.lance = true; lancerVolee(m, joueurs); }
            if (m.modeT >= 0.8) { m.mode = 'marche'; m.modeT = 0; }
          } else if (m.mode === 'contact') {
            deplacerMB(m, dt, temps, cible, 'arret', 0);
            if (!m.attaqueFrappee && m.modeT >= 0.62) { m.attaqueFrappee = true; if (cible && bd < 2.0) surAttaque(m, cible.id); }
            if (m.modeT >= 1.25) { m.mode = 'marche'; m.modeT = 0; m.attenteContact = Math.max(0.1, m.profil.cadenceContact - 1.25); }
          } else {
            m.mode = 'marche';
            if (cible && bd < 1.75 && m.attenteContact <= 0) { m.mode = 'contact'; m.modeT = 0; m.attaqueFrappee = false; }
            else if (cible && BO.intervalle > 0 && BO.parVolee > 0 && m.bouleT >= BO.intervalle && bd <= BO.portee) { m.mode = 'lancer'; m.modeT = 0; m.lance = false; m.bouleT = 0; }
            if (m.mode === 'marche') deplacerMB(m, dt, temps, cible, cible && bd > 1.2 ? 'approche' : 'arret', m.vitesseMax);
            else deplacerMB(m, dt, temps, cible, 'arret', 0);
          }
          if (m.mode !== 'cri') tourner(m, dt, vise, m.mode === 'lancer' ? 6 : 3);
          ticksZone(m, dt, joueurs);
          majExpositions(m, dt, joueurs);
          if (alea() < dt * 14) projeter(sporesPour(m.lieu), m.position.x + (alea() - 0.5) * 1.2, 0.3 + alea() * 1.6, m.position.z + (alea() - 0.5) * 1.2, 1, 0.35, 0.3, 1.2);
          if (alea() < dt * 5) projeter(vapeurPour(m.lieu), m.position.x + (alea() - 0.5) * 0.5, 1.5 + alea() * 0.4, m.position.z + (alea() - 0.5) * 0.5, 1, 0.45, 0.25, 1.4);
        } else {
          // Le Démembré : démarche lourde et boiteuse ; fléau : il fait tournoyer son bras pendu (preparation s), puis frappe en arc
          // v1.5 : géant (×2, fléau de 6 m) ; rage : il s'arrache le bras (arrachement), puis, sans bras, il charge ; petits : fléau
          var FL = m.profil.fleau, P0 = FL.preparation, finF = P0 + DUREE_FRAPPE + RECUP_FLEAU, Ech = m.echelle;
          if (m.mode === 'arrache') majArrachement(m, dt);
          else if (m.sansBras) majSansBras(m, dt, temps, cible, bd, vise, joueurs);
          else if (m.mode === 'fleau') {
            var tf = m.modeT;
            if (tf < P0) { deplacerMB(m, dt, temps, cible, cible && bd > 1.25 * Ech ? 'approche' : 'arret', m.vitesseMax * 0.35); tourner(m, dt, vise, 7); }
            else if (tf < P0 + DUREE_FRAPPE) {
              deplacerMB(m, dt, temps, cible, 'arret', 0);
              if (!m.attaqueFrappee) {
                m.attaqueFrappee = true;
                var ifr = m.info; ifr.cible = cible ? cible.id : null; ifr.position.x = m.bras.cx; ifr.position.y = m.bras.cy; ifr.position.z = m.bras.cz; ifr.impact.x = m.position.x + Math.sin(m.lacet) * FL.portee; ifr.impact.y = 1; ifr.impact.z = m.position.z + Math.cos(m.lacet) * FL.portee;
                ifr.degats = FL.degats; ifr.flou = 0; ifr.etourdissement = 0; ifr.duree = DUREE_FRAPPE; ifr.rayon = FL.portee; ifr.touche = false; ifr.etat = 'frappe'; ifr.intensite = 1; ifr.id = null;
                signaler(m, 'fleau', ifr);
              }
              if (!m.frappeFaite && tf >= P0 + DUREE_FRAPPE * 0.35) { m.frappeFaite = true; frapperFleau(m, joueurs); }
            } else deplacerMB(m, dt, temps, null, 'arret', 0);
            if (tf >= finF) { m.mode = 'chasse'; m.modeT = 0; m.attenteContact = Math.max(0, m.profil.cadenceContact - finF); }   // un fléau toutes les cadenceContact s
          } else {
            m.mode = 'chasse';
            if (cible && bd < FL.portee - 0.35 && m.attenteContact <= 0) {
              m.mode = 'fleau'; m.modeT = 0; m.frappeFaite = false; m.attaqueFrappee = false;
              var ip = m.info; ip.cible = cible.id; ip.position.x = m.position.x; ip.position.y = 1.4 * m.scale; ip.position.z = m.position.z; ip.impact.x = cible.position.x; ip.impact.y = 1; ip.impact.z = cible.position.z;
              ip.degats = FL.degats; ip.flou = 0; ip.etourdissement = 0; ip.duree = P0; ip.rayon = FL.portee; ip.touche = false; ip.etat = 'preparation'; ip.intensite = 1; ip.id = null;
              signaler(m, 'fleau', ip);
            }
            if (m.mode === 'chasse') deplacerMB(m, dt, temps, cible, cible && bd > 1.3 * Ech ? 'approche' : 'arret', m.vitesseMax);
            tourner(m, dt, vise, 4);
          }
          if (!m.sansBras && m.bras.init && alea() < dt * 3) projeter(sangPour(m.lieu), m.bras.cx, m.bras.cy - 0.3 * Ech, m.bras.cz, 1, 0.3, 0.05, 0.4);   // gouttes de sang du bras
          else if (m.sansBras && alea() < dt * 2) { m.groupe.updateMatrixWorld(true); _vm.set(ATT_LOC[0], ATT_LOC[1], ATT_LOC[2]).applyMatrix4(m.os.poitrine.matrixWorld); projeter(sangPour(m.lieu), _vm.x, _vm.y, _vm.z, 1, 0.4, 0.05, 0.4); }   // moignon
        }
        // cadence des pas : à l'échelle (le géant fait des pas deux fois plus longs) ; Irradié (4,4 m/s) : petits pas traînants rapides
        m.phase += dt * h2(m.vitesse.x, m.vitesse.z) * (sv ? 2.4 : dm ? 2.5 / m.echelle : 2.6);
        if (cible) { if (bd > m.derniereDist - 0.05) m.bloqueT += dt; else m.bloqueT = 0; m.derniereDist = bd; }
      }
      appliquerPoseMB(m, dt);
      effetsMB(m, dt);
    }
    // ── effets propres à l'entité : arcs (mains ↔ sol), éclairs des décharges, lueurs, halo d'aura, lumière empruntée, bras pendu ──
    function effetsMB(m, dt) {
      var sv = m.type === 'survolte', vivant = m.etat === 'actif' || m.etat === 'cuve';
      var t = m.t, L = m.lumiere;
      m.groupe.updateMatrixWorld(true);
      if (sv) {
        var Rb = m.rubans; Rb.n = 0;
        var recharge = m.etat === 'actif' && m.mode === 'recharge', ck = m.chargeK, mortCC = m.etat === 'mort' && m.t < 1.0;
        // v1.5 : surcharge (il puise dans le Septième : de plus en plus lumineux), puis « surchargé » jusqu'à sa mort (arcs plus forts)
        var surc = m.etat === 'actif' && m.mode === 'surcharge', boost = m.surcharge ? 1 : 0;
        var kArc = recharge ? (alea() < 0.08 ? 0.35 + 0.3 * boost : 0) : m.etat === 'cuve' ? U.smooth(1.0, 2.2, m.t) : mortCC ? 1.2 : vivant ? 0.85 + 0.15 * alea() + 0.5 * ck + 0.5 * boost + (surc ? 0.6 * ck : 0) : 0;
        if (kArc > 0) {
          for (var h = 0; h < 2; h++) {
            posOs(m, h ? 'mainD' : 'mainG', _vm);
            var sx = h ? -1 : 1, ca = Math.cos(m.lacet), sa = Math.sin(m.lacet);
            var gx = m.position.x + ca * sx * (0.32 + 0.15 * alea()) + sa * (alea() - 0.3) * 0.35, gz = m.position.z - sa * sx * (0.32 + 0.15 * alea()) + ca * (alea() - 0.3) * 0.35;
            ARC[0] = _vm.x; ARC[1] = _vm.y - 0.08; ARC[2] = _vm.z; ARC[3] = gx; ARC[4] = 0.01; ARC[5] = gz; ARC[6] = 0.07 + 0.05 * ck; ARC[7] = 0.0055 + 0.003 * ck; ARC[8] = kArc; arcElectrique(Rb, 7, alea() < 0.6);
            if (ck > 0.3 || mortCC) { ARC[0] = _vm.x; ARC[1] = _vm.y - 0.05; ARC[2] = _vm.z; ARC[3] = m.position.x + (alea() - 0.5) * 0.3; ARC[4] = 1.0 + alea() * 0.5; ARC[5] = m.position.z + (alea() - 0.5) * 0.3; ARC[6] = 0.06; ARC[7] = 0.004; ARC[8] = kArc * 0.8; arcElectrique(Rb, 5, false); }
          }
          if (ck > 0.5 || mortCC) { posOs(m, 'mainG', _vm); posOs(m, 'mainD', _vm2); ARC[0] = _vm.x; ARC[1] = _vm.y; ARC[2] = _vm.z; ARC[3] = _vm2.x; ARC[4] = _vm2.y; ARC[5] = _vm2.z; ARC[6] = 0.12; ARC[7] = 0.005; ARC[8] = kArc; arcElectrique(Rb, 9, true); }
          if (alea() < 0.35 * kArc) { posOs(m, 'tete', _vm); ARC[0] = _vm.x; ARC[1] = _vm.y + 0.18; ARC[2] = _vm.z; ARC[3] = _vm.x + (alea() - 0.5) * 0.5; ARC[4] = _vm.y + 0.3 + alea() * 0.25; ARC[5] = _vm.z + (alea() - 0.5) * 0.5; ARC[6] = 0.05; ARC[7] = 0.003; ARC[8] = kArc * 0.8; arcElectrique(Rb, 4, false); }
          if (surc) {
            // courtes étincelles des mains tendues vers le Septième (≤ 0,85 m : le rayon venu du Septième est dessiné par fx.js) et
            // gaine d'arcs autour du corps
            var dxs = m.sourceX - m.position.x, dys = m.sourceY - 1.6, dzs = m.sourceZ - m.position.z, dls = Math.sqrt(dxs * dxs + dys * dys + dzs * dzs) || 1, ls = 0.35 + 0.5 * ck;
            for (var hs = 0; hs < 2; hs++) {
              posOs(m, hs ? 'mainD' : 'mainG', _vm);
              ARC[0] = _vm.x; ARC[1] = _vm.y; ARC[2] = _vm.z; ARC[3] = _vm.x + dxs / dls * ls + (alea() - 0.5) * 0.3; ARC[4] = _vm.y + dys / dls * ls + (alea() - 0.5) * 0.3; ARC[5] = _vm.z + dzs / dls * ls + (alea() - 0.5) * 0.3;
              ARC[6] = 0.06 + 0.05 * ck; ARC[7] = 0.005 + 0.003 * ck; ARC[8] = 1.1 + 0.7 * ck; arcElectrique(Rb, 6, true);
            }
          }
          if ((surc || boost) && vivant) {
            for (var gs = 0; gs < (surc ? 3 : 2); gs++) {
              posOs(m, gs === 0 ? 'tete' : gs === 1 ? 'poitrine' : 'hanches', _vm);
              var as = alea() * TAU, rs0 = 0.25 + 0.2 * alea();
              ARC[0] = _vm.x + Math.cos(as) * rs0; ARC[1] = _vm.y + (alea() - 0.3) * 0.3; ARC[2] = _vm.z + Math.sin(as) * rs0;
              ARC[3] = _vm.x + Math.cos(as + 1.6 + alea()) * rs0; ARC[4] = _vm.y + (alea() - 0.5) * 0.5; ARC[5] = _vm.z + Math.sin(as + 1.6 + alea()) * rs0;
              ARC[6] = 0.06; ARC[7] = 0.004 + 0.002 * boost; ARC[8] = kArc * (surc ? 0.9 : 0.75); arcElectrique(Rb, 5, false);
            }
          }
        }
        for (var kb = 0; kb < m.bolts.length; kb++) {
          var B = m.bolts[kb];
          if (!(B.t > 0)) continue;
          var kbt = U.clamp(B.t / DUREE_DECHARGE, 0, 1), Lb = h2(B.bx - B.ax, B.bz - B.az);
          ARC[0] = B.ax; ARC[1] = B.ay; ARC[2] = B.az; ARC[3] = B.bx; ARC[4] = B.by; ARC[5] = B.bz; ARC[6] = 0.06 + Lb * 0.035; ARC[7] = 0.014; ARC[8] = 1.4 * (0.6 + 0.4 * kbt); arcElectrique(Rb, 14, true);
          ARC[0] = B.ax; ARC[1] = B.ay; ARC[2] = B.az; ARC[3] = B.bx; ARC[4] = B.by; ARC[5] = B.bz; ARC[6] = 0.05 + Lb * 0.03; ARC[7] = 0.007; ARC[8] = 1.0 * kbt; arcElectrique(Rb, 12, true);
        }
        finRubans(Rb);
        var kl = recharge ? 0.25 + 0.1 * Math.sin(t * 9) + 0.2 * boost : vivant ? 0.75 + 0.25 * alea() + 0.6 * ck + 0.45 * boost + (surc ? 1.1 * ck : 0) : mortCC ? alea() : 0;
        var cS = m.matE.color; cS.r = kl; cS.g = kl; cS.b = kl;          // (affectations directes : aucun appel → aucun nombre emballé)
        m.matLueur.opacity = Math.min(1, (recharge ? 0.15 : 0.55 + 0.45 * ck) + m.flash * 0.6);
        for (var l = 0; l < m.lueurs.length; l++) { var sc = 0.18 + 0.22 * ck + 0.3 * m.flash + 0.04 * alea() + 0.1 * boost + (surc ? 0.35 * ck : 0); var sl = m.lueurs[l].scale; sl.x = sc; sl.y = sc; sl.z = 1; m.lueurs[l].visible = vivant || mortCC; }
        m.matHalo.opacity = recharge ? 0.35 : 1;
        if (L) {
          posOs(m, 'poitrine', _vm); L.position.x = _vm.x; L.position.y = _vm.y + 0.1; L.position.z = _vm.z; L.color.copy(m.flash > 0.4 ? COUL_FLASH : COUL_CYAN);
          L.intensity = vivant || mortCC ? (recharge ? 1.2 + 2 * boost : 3 + 9 * ck + 45 * m.flash + 1.5 * alea() + 5 * boost + (surc ? 22 * ck : 0)) : Math.max(0, 6 - m.t * 3);
        }
      } else if (m.fam === 'demembre') {
        if (!m.sansBras) brasDemembre(m, dt);                            // v1.5 : sans bras après l'arrachement
        var kO = m.etat === 'mort' ? Math.max(0, 1 - m.t) : 0.8 + 0.2 * Math.sin(t * 2.7), cO = m.matE.color; cO.r = kO; cO.g = kO; cO.b = kO;   // l'œil qui reste luit faiblement
        m.matHalo.opacity = 0.55 * kO;
      } else {
        var vivI = vivant || (m.etat === 'mort' && m.t < 1.2);
        if (m.haloSol) {
          var A = m.profil.aura, kh = m.etat === 'cuve' ? U.smooth(1.4, 2.4, m.t) : m.etat === 'actif' ? 1 : m.haloSol.material.opacity;
          m.haloSol.visible = vivI && kh > 0.01;
          m.haloSol.position.x = m.position.x; m.haloSol.position.y = 0.02; m.haloSol.position.z = m.position.z;
          var sh = A.rayon * (0.97 + 0.03 * Math.sin(t * 2.3)); m.haloSol.scale.x = sh; m.haloSol.scale.y = sh; m.haloSol.scale.z = sh;
          if (m.etat !== 'mort') m.haloSol.material.opacity = kh * (0.78 + 0.22 * Math.sin(t * 3.1));
          m.haloSol.rotation.z += dt * 0.15;
        }
        var kg = 0.78 + 0.22 * Math.sin(t * 6.3) * Math.sin(t * 2.1);
        if (m.etat === 'actif' || m.etat === 'cuve') { var cG = m.matE.color; cG.r = kg; cG.g = kg; cG.b = kg; }
        m.matLueur.opacity = vivI ? 0.45 + 0.2 * Math.sin(t * 4.1) : 0;
        if (L) {
          posOs(m, 'poitrine', _vm); L.position.x = _vm.x + Math.sin(m.lacet) * 0.35; L.position.y = _vm.y; L.position.z = _vm.z + Math.cos(m.lacet) * 0.35; L.color.copy(COUL_VERT);
          L.intensity = vivI ? 9 + 2.5 * Math.sin(t * 7.3) * Math.sin(t * 1.7) : Math.max(0, 9 - (m.t - 1.2) * 6);
        }
      }
    }
    // ── poses des mini-boss (tampons réutilisés) ──
    var NOMS_MB = OS.map(function (q) { return q[0]; }), AM = {}; NOMS_MB.forEach(function (n) { AM[n] = [0, 0, 0]; });
    var _eMB = new THREE.Euler(), _qMB = new THREE.Quaternion();
    function setM(n, x, y, zz) { var a = AM[n]; a[0] = x; a[1] = y; a[2] = zz; }
    function addM(n, x, y, zz) { var a = AM[n]; a[0] += x; a[1] += y; a[2] += zz; }
    function appliquerPoseMB(m, dt) {
      for (var ia = 0; ia < NOMS_MB.length; ia++) { var a0 = AM[NOMS_MB[ia]]; a0[0] = 0; a0[1] = 0; a0[2] = 0; }
      var t = m.t, s = Math.sin, c = Math.cos, sv = m.type === 'survolte', dm = m.fam === 'demembre', y0 = 0, pitch = 0, roll = 0, T = m.t + m.idx * 3.7;
      var v = h2(m.vitesse.x, m.vitesse.z), amp = Math.min(1, v / (sv ? 2.6 : dm ? 3.0 * m.echelle : 1.6)), w = m.phase;   // géant : foulée à l'échelle
      // posture de base (marche comprise)
      if (sv) {
        // bras écartés, doigts tendus, démarche raide et saccadée, tremblement électrique permanent
        { var _a = AM.cuisseG, _x = -s(w) * 0.55 * amp - 0.04, _y = 0, _z = 0.06; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = s(w) * 0.55 * amp - 0.04, _y = 0, _z = -0.06; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.tibiaG, _x = Math.max(0, -c(w)) * 0.95 * amp + 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = Math.max(0, c(w)) * 0.95 * amp + 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.piedG, _x = s(w) * 0.2 * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.piedD, _x = -s(w) * 0.2 * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.hanches, _x = 0, _y = s(w) * 0.1 * amp, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.colonne, _x = 0.1 + 0.05 * amp, _y = -s(w) * 0.06 * amp, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = 0.04, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.cou, _x = -0.05, _y = 0.12 * s(T * 0.9), _z = 0.06 * s(T * 1.3); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = 0.02, _y = 0.1 * s(T * 1.1), _z = 0.1 * s(T * 0.7); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.machoire, _x = 0.32 + 0.08 * s(T * 23), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.brasG, _x = -0.18 + s(w) * 0.12 * amp, _y = 0, _z = 0.55; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = -0.18 - s(w) * 0.12 * amp, _y = 0, _z = -0.55; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.avantBrasG, _x = -0.32, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.32, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainG, _x = 0.05, _y = 0, _z = 0.28; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainD, _x = 0.05, _y = 0, _z = -0.28; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        y0 = (Math.abs(c(w)) - 0.6) * 0.025 * amp;
      } else if (dm) {
        // démarche lourde et boiteuse (genou droit blessé : il plie peu, le corps plonge dessus), épaule gauche affaissée,
        // tête basse, mâchoire béante qui bave le sang ; le bras droit ballant ; le bras gauche pend aux tendons (pendule)
        var wb = w + 0.35 * s(w), appui = Math.max(0, s(wb));
        { var _a = AM.cuisseG, _x = -s(wb) * 0.5 * amp - 0.05, _y = 0, _z = 0.09; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = s(wb) * 0.4 * amp - 0.05, _y = 0, _z = -0.09; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.tibiaG, _x = Math.max(0, -c(wb)) * 0.85 * amp + 0.12, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = Math.max(0, c(wb)) * 0.42 * amp + 0.07, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.piedG, _x = s(wb) * 0.18 * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.piedD, _x = -s(wb) * 0.12 * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.hanches, _x = 0, _y = s(wb) * 0.12 * amp, _z = 0.05 * s(wb) * amp + 0.03; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.colonne, _x = 0.14 + 0.06 * amp, _y = -s(wb) * 0.07 * amp, _z = -0.04; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = 0.06 + 0.02 * s(T * 1.6), _y = 0, _z = -0.08; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.cou, _x = 0.2, _y = 0.06 * s(T * 0.5), _z = 0.09; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = 0.12 + 0.04 * s(T * 0.9), _y = 0.08 * s(T * 0.6), _z = 0.08; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.machoire, _x = 0.5 + 0.08 * s(T * 1.9) + 0.06 * appui * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.brasD, _x = 0.1 - s(wb) * 0.36 * amp, _y = 0, _z = -0.2; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.28 - 0.18 * Math.max(0, s(wb + 1)) * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainD, _x = 0.12, _y = 0, _z = -0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        y0 = -0.035 * Math.abs(c(wb)) * amp - 0.012 - 0.035 * appui * amp;
        roll = s(wb) * 0.05 * amp - 0.025;
      } else {
        // pas traînants, bras ballants, tête affaissée sur le torse, roulis lourd
        { var _a = AM.cuisseG, _x = -s(w) * 0.34 * amp - 0.06, _y = 0, _z = 0.04; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = s(w) * 0.34 * amp - 0.06, _y = 0, _z = -0.04; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.tibiaG, _x = Math.max(0, -c(w)) * 0.38 * amp + 0.14, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = Math.max(0, c(w)) * 0.38 * amp + 0.14, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.piedG, _x = -0.12 * Math.max(0, -c(w)) * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.piedD, _x = -0.12 * Math.max(0, c(w)) * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.hanches, _x = 0, _y = s(w) * 0.12 * amp, _z = s(w) * 0.07 * amp; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.colonne, _x = 0.16, _y = -s(w) * 0.08 * amp, _z = -s(w) * 0.05 * amp; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.cou, _x = 0.42, _y = 0.12 * s(T * 0.6), _z = 0.08 * s(T * 0.45); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = 0.26, _y = 0.1 * s(T * 0.8), _z = 0.14 + 0.05 * s(T * 0.5); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.machoire, _x = 0.38 + 0.05 * s(T * 1.7), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.brasG, _x = 0.06 + s(w + 0.6) * 0.3 * amp + 0.03 * s(T * 1.3), _y = 0, _z = 0.14; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = 0.06 - s(w + 0.6) * 0.3 * amp + 0.03 * s(T * 1.1), _y = 0, _z = -0.14; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.avantBrasG, _x = -0.18 - 0.12 * Math.max(0, s(w + 1.2)) * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.18 - 0.12 * Math.max(0, -s(w + 1.2)) * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.mainG, _x = 0.15, _y = 0, _z = 0.12; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainD, _x = 0.15, _y = 0, _z = -0.12; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        y0 = -0.03 * Math.abs(c(w)) * amp - 0.01;
        roll = s(w) * 0.035 * amp;
      }
      if (m.etat === 'actif') {
        if (sv) {
          var md = m.mode, k;
          if (md === 'charge') {
            k = U.smooth(0, DUREE_CHARGE * 0.7, m.modeT);
            { var _a = AM.brasG, _x = U.lerp(AM.brasG[0], -0.35, k), _y = 0, _z = U.lerp(0.55, 1.25, k); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -0.35, k), _y = 0, _z = U.lerp(-0.55, -1.25, k); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.avantBrasG, _x = -0.32 + 0.2 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.32 + 0.2 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainG, _x = -0.2 * k, _y = 0, _z = 0.28 + 0.3 * k; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainD, _x = -0.2 * k, _y = 0, _z = -0.28 - 0.3 * k; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cou, _x = -0.05 - 0.22 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = -0.2 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = 0.04 - 0.18 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.colonne, _x = 0.1 - 0.1 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.machoire, _x = 0.32 + 0.35 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cuisseG, _x = -0.04, _y = 0, _z = 0.06 + 0.1 * k; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = -0.04, _y = 0, _z = -0.06 - 0.1 * k; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaG, _x = 0.1 + 0.12 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = 0.1 + 0.12 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 = 0.02 * k;
          } else if (md === 'decharge') {
            k = 1 - U.smooth(0, DUREE_DECHARGE, m.modeT) * 0.4;
            { var _a = AM.brasG, _x = -1.45 * k, _y = 0, _z = 0.14; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = -1.45 * k, _y = 0, _z = -0.14; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasG, _x = -0.08, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.08, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.mainG, _x = -0.3, _y = 0, _z = 0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainD, _x = -0.3, _y = 0, _z = -0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.colonne, _x = -0.12 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = -0.1 * k, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cou, _x = 0.05, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = 0.08, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.75, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          } else if (md === 'recharge') {
            // pause de recharge bien lisible : avachi, bras pendants, tête basse, respiration lente
            var ke = U.smooth(0, 0.35, m.modeT) * (1 - U.smooth(m.profil.decharge.recharge - 0.45, m.profil.decharge.recharge, m.modeT)), rs = s(T * 2.6);
            { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], 0.42, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], 0.22 + 0.04 * rs, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cou, _x = U.lerp(AM.cou[0], 0.55, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = U.lerp(AM.tete[0], 0.32, ke), _y = 0.05 * s(T * 0.7) * ke, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = U.lerp(AM.machoire[0], 0.5, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.brasG, _x = U.lerp(AM.brasG[0], 0.12, ke), _y = 0, _z = U.lerp(0.55, 0.1, ke); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], 0.12, ke), _y = 0, _z = U.lerp(-0.55, -0.1, ke); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.avantBrasG, _x = U.lerp(-0.32, -0.12, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = U.lerp(-0.32, -0.12, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cuisseG, _x = U.lerp(AM.cuisseG[0], -0.28, ke), _y = 0, _z = 0.06; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = U.lerp(AM.cuisseD[0], -0.28, ke), _y = 0, _z = -0.06; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.tibiaG, _x = U.lerp(AM.tibiaG[0], 0.5, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = U.lerp(AM.tibiaD[0], 0.5, ke), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 = U.lerp(y0, -0.07, ke);
          } else if (md === 'contact') {
            var at = m.modeT / 0.85, k1 = U.smooth(0, 0.4, at), k2 = U.smooth(0.4, 0.55, at), k3 = U.smooth(0.7, 1.0, at), lev = k1 * (1 - k2), fr = k2 * (1 - k3);
            { var _a = AM.brasG, _x = U.lerp(AM.brasG[0], -2.4, lev) + 1.6 * fr, _y = 0.2, _z = U.lerp(0.55, 0.15, lev); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -2.3, lev) + 1.5 * fr, _y = -0.2, _z = U.lerp(-0.55, -0.15, lev); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.avantBrasG, _x = -0.5 * lev - 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.5 * lev - 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.colonne, _x = -0.2 * lev + 0.45 * fr, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.poitrine, _x = -0.12 * lev + 0.25 * fr, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.machoire, _x = 0.4 + 0.4 * fr, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          } else if (md === 'surcharge') {
            // v1.5 : il puise dans le Septième : bras levés vers lui, paumes ouvertes, buste renversé, tremblement qui s'amplifie
            var kS = U.smooth(0, 0.35, m.rageT), kL = m.chargeK, el = Math.max(-0.6, Math.min(0.5, Math.atan2(m.sourceY - 1.5 * m.scale, h2(m.sourceX - m.position.x, m.sourceZ - m.position.z) + 0.5)));
            { var _a = AM.brasG, _x = U.lerp(AM.brasG[0], -1.75 - el * 0.9, kS), _y = 0.1 * kS, _z = U.lerp(AM.brasG[2], 0.32, kS); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -1.75 - el * 0.9, kS), _y = -0.1 * kS, _z = U.lerp(AM.brasD[2], -0.32, kS); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.avantBrasG, _x = -0.12 * kS, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.12 * kS, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainG, _x = -0.45 * kS, _y = 0, _z = 0.25; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.mainD, _x = -0.45 * kS, _y = 0, _z = -0.25; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], -0.16 - 0.06 * kL, kS), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], -0.12 - 0.06 * kL, kS), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cou, _x = U.lerp(AM.cou[0], -0.3 - el * 0.4, kS), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.tete, _x = -0.18 * kS, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.35 + 0.4 * kL + 0.08 * s(T * 31), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseG, _x = -0.08, _y = 0, _z = 0.14 * kS; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cuisseD, _x = -0.08, _y = 0, _z = -0.14 * kS; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaG, _x = 0.18, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = 0.18, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 = -0.03 * kS; k = 0;
          }
          if (md !== 'recharge') {
            // tremblement électrique + spasme
            var tr = 0.025 + 0.05 * m.chargeK + (md === 'surcharge' ? 0.05 * m.chargeK : m.surcharge ? 0.02 : 0);
            { var _a = AM.tete, _x = tr * s(T * 41), _y = tr * s(T * 37), _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.brasG, _x = tr * s(T * 47), _y = 0, _z = tr * s(T * 39); _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.brasD, _x = tr * s(T * 43), _y = 0, _z = tr * s(T * 51); _a[0] += _x; _a[1] += _y; _a[2] += _z; }
            { var _a = AM.avantBrasG, _x = tr * s(T * 53), _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.avantBrasD, _x = tr * s(T * 49), _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.poitrine, _x = 0, _y = tr * s(T * 29), _z = tr * 0.6 * s(T * 33); _a[0] += _x; _a[1] += _y; _a[2] += _z; }
            if (m.spasmeT > 0) {
              var ks = s(PI * m.spasmeT / 0.35);
              { var _a = AM.colonne, _x = 0.22 * ks * s(T * 50), _y = 0.25 * ks * s(T * 31), _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.tete, _x = 0.35 * ks * s(T * 43), _y = 0.5 * ks * s(T * 37), _z = 0.3 * ks * s(T * 29); _a[0] += _x; _a[1] += _y; _a[2] += _z; }
              { var _a = AM.brasG, _x = 0.4 * ks * s(T * 45), _y = 0, _z = 0.45 * ks * s(T * 39); _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.brasD, _x = 0.4 * ks * s(T * 41), _y = 0, _z = -0.45 * ks * s(T * 47); _a[0] += _x; _a[1] += _y; _a[2] += _z; }
              { var _a = AM.avantBrasG, _x = -0.5 * ks * Math.abs(s(T * 33)), _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.avantBrasD, _x = -0.5 * ks * Math.abs(s(T * 35)), _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; }
              y0 += 0.02 * ks * s(T * 60);
            }
          }
        } else if (dm) {
          if (m.mode === 'arrache') {
            // v1.5 : il saisit son bras pendu de la main droite, l'arrache, l'arme au-dessus de sa tête et le lance au centre
            var Ar = m.arr, rT = m.rageT, k1 = U.smooth(0, Math.max(0.05, Ar.tArr), rT), k2 = Ar.phase >= 3 ? U.smooth(Ar.tArr, Math.max(Ar.tArr + 0.05, Ar.tLance), rT) : 0, k3 = Ar.phase >= 4 ? U.smooth(Ar.tLance, Ar.tLance + 0.28, rT) : 0;
            var sac = Ar.phase >= 3 && rT < Ar.tArr + 0.18 ? s(PI * (rT - Ar.tArr) / 0.18) : 0;   // secousse de l'arrachement
            { var _a = AM.colonne, _x = U.lerp(U.lerp(U.lerp(AM.colonne[0], 0.12, k1), -0.3, k2), 0.38, k3), _y = U.lerp(U.lerp(0.32 * k1, -0.38, k2), 0.3, k3) - 0.25 * sac, _z = -0.06 * k1 * (1 - k2); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.poitrine, _x = U.lerp(U.lerp(0.06, 0.08, k1), -0.12, k2) + 0.12 * k3, _y = U.lerp(U.lerp(0.28 * k1, -0.25, k2), 0.2, k3), _z = U.lerp(-0.08, -0.14, k1); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cou, _x = U.lerp(U.lerp(0.2, 0.42, k1), -0.35, k2) + 0.3 * k3, _y = U.lerp(0.35 * k1, 0, k2), _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = U.lerp(0.12, 0.2, k1) * (1 - k2) - 0.1 * k2, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.machoire, _x = 0.5 + 0.35 * k2 + 0.25 * sac, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.brasD, _x = U.lerp(U.lerp(AM.brasD[0], -0.95, k1), -2.75, k2) * (1 - k3) + k3 * -0.55, _y = U.lerp(0.3 * k1, 0.35, k2) * (1 - k3), _z = U.lerp(U.lerp(AM.brasD[2], 0.62, k1), -0.2, k2) * (1 - k3) - 0.3 * k3; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.avantBrasD, _x = U.lerp(-0.65 * k1, -1.35, k2) * (1 - k3) - 0.15 * k3, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainD, _x = -0.3 * k1 * (1 - k2), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cuisseG, _x = U.lerp(AM.cuisseG[0], -0.3, Math.max(k1, k2)), _y = 0, _z = 0.16; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = U.lerp(AM.cuisseD[0], 0.12, Math.max(k1, k2)), _y = 0, _z = -0.16; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.tibiaG, _x = U.lerp(AM.tibiaG[0], 0.42, Math.max(k1, k2)), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = U.lerp(AM.tibiaD[0], 0.25, Math.max(k1, k2)), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 = U.lerp(y0, -0.05, Math.max(k1, k2)); roll = -0.06 * k1 * (1 - k2);
          } else if (m.sansBras && m.mode === 'chPrep') {
            // v1.5 : préparation de la charge : tête basse, il gratte le sol du pied droit (bien lisible)
            var kP = U.smooth(0, 0.25, m.modeT), gr = s(T * 9.5);
            { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], 0.42, kP), _y = 0.05 * gr * kP, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], 0.2, kP), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cou, _x = U.lerp(AM.cou[0], 0.48, kP), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = U.lerp(AM.tete[0], 0.32, kP), _y = 0.06 * gr * kP, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.machoire, _x = 0.55 + 0.1 * Math.abs(gr) * kP, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseG, _x = U.lerp(AM.cuisseG[0], -0.42, kP), _y = 0, _z = 0.12; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.tibiaG, _x = U.lerp(AM.tibiaG[0], 0.62, kP), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.piedG, _x = -0.18 * kP, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cuisseD, _x = U.lerp(AM.cuisseD[0], -0.05 + 0.32 * gr, kP), _y = 0, _z = -0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = U.lerp(AM.tibiaD[0], 0.3 + 0.32 * Math.max(0, gr), kP), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.piedD, _x = 0.35 * Math.max(0, -gr) * kP, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -0.45, kP), _y = 0, _z = U.lerp(AM.brasD[2], -0.35, kP); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.avantBrasD, _x = -0.4 * kP, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 = U.lerp(y0, -0.1, kP); pitch = 0.1 * kP;
          } else if (m.sansBras && (m.mode === 'chElan' || m.mode === 'chFin')) {
            // v1.5 : ruée : penché en avant, tête baissée comme un taureau, bras droit rejeté en arrière
            var kR = m.mode === 'chElan' ? U.smooth(0, 0.12, m.modeT) : 1 - U.smooth(0, 0.45, m.modeT);
            { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], 0.55, kR), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], 0.22, kR), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cou, _x = U.lerp(AM.cou[0], 0.35, kR), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = U.lerp(AM.tete[0], 0.2, kR), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], 0.55 + 0.2 * s(w), kR), _y = 0, _z = U.lerp(AM.brasD[2], -0.32, kR); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = U.lerp(AM.avantBrasD[0], -0.5, kR), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.machoire, _x = U.lerp(AM.machoire[0], 0.85, kR), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            pitch = 0.16 * kR;
          } else if (m.sansBras && m.mode === 'etourdi') {
            // v1.5 : sonné contre un mur ou un pilier : il titube, secoue la tête
            var kD = U.smooth(0, 0.15, m.modeT) * (1 - U.smooth(m.profil.charge.etourdiMur - 0.3, m.profil.charge.etourdiMur, m.modeT));
            { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], -0.12 + 0.08 * s(T * 3.1), kD), _y = 0.12 * s(T * 2.3) * kD, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cou, _x = U.lerp(AM.cou[0], 0.15, kD), _y = 0.45 * s(T * 7.5) * kD, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.tete, _x = U.lerp(AM.tete[0], 0.05, kD), _y = 0, _z = 0.32 * s(T * 5.2) * kD; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.7, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], 0.15, kD), _y = 0, _z = U.lerp(AM.brasD[2], -0.5, kD); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.3 * kD, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cuisseG, _x = U.lerp(AM.cuisseG[0], -0.3, kD), _y = 0, _z = 0.16; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = U.lerp(AM.cuisseD[0], -0.25, kD), _y = 0, _z = -0.16; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.tibiaG, _x = U.lerp(AM.tibiaG[0], 0.45, kD), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = U.lerp(AM.tibiaD[0], 0.4, kD), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 = U.lerp(y0, -0.07, kD); roll = 0.09 * s(T * 3.4) * kD; pitch = -0.05 * kD;
          } else if (m.sansBras && m.mode === 'contact') {
            // v1.5 : coup du bras droit (marteau), au minutage de L'Irradié
            var aH = m.modeT / 1.25, l1 = U.smooth(0, 0.45, aH), l2 = U.smooth(0.45, 0.58, aH), l3 = U.smooth(0.72, 1.0, aH), le = l1 * (1 - l2), fi = l2 * (1 - l3);
            { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -2.6, le) + 2.0 * fi, _y = -0.12, _z = U.lerp(AM.brasD[2], -0.18, le + fi); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.45 * le, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.colonne, _x = U.lerp(0.16, -0.16, le) + 0.5 * fi, _y = -0.2 * le + 0.25 * fi, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(0.06, -0.08, le) + 0.25 * fi, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cou, _x = U.lerp(0.2, 0.05, le) + 0.2 * fi, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.6 + 0.3 * fi, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 -= 0.04 * fi;
          } else if (m.mode === 'fleau') {
            // il fait tournoyer son bras pendu (le buste suit le bras), puis l'abat en arc ; jambes en garde, bras droit en balancier
            var P0f = m.profil.fleau.preparation, tf = m.modeT, finFr = P0f + DUREE_FRAPPE, kp = U.smooth(0, 0.15, tf) * (1 - U.smooth(finFr, finFr + RECUP_FLEAU, tf));
            var tw = tf < finFr ? 0.42 * s(m.fleauPsi) : -0.42 * (1 - U.smooth(finFr, finFr + RECUP_FLEAU, tf)), pench = tf < P0f ? -0.08 : tf < finFr ? 0.22 * U.smooth(P0f, finFr, tf) : 0.22 * (1 - U.smooth(finFr, finFr + RECUP_FLEAU, tf));
            { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], 0.06, kp) + pench, _y = tw * 0.55, _z = U.lerp(AM.colonne[2], 0, kp); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], 0.02, kp) + pench * 0.5, _y = tw * 0.45, _z = U.lerp(AM.poitrine[2], 0.04, kp); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.hanches, _x = 0, _y = tw * 0.25, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cuisseG, _x = U.lerp(AM.cuisseG[0], -0.3, kp), _y = 0, _z = U.lerp(AM.cuisseG[2], 0.16, kp); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = U.lerp(AM.cuisseD[0], 0.12, kp), _y = 0, _z = U.lerp(AM.cuisseD[2], -0.16, kp); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.tibiaG, _x = U.lerp(AM.tibiaG[0], 0.42, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = U.lerp(AM.tibiaD[0], 0.2, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -0.55, kp), _y = -0.2 * kp, _z = U.lerp(AM.brasD[2], -0.55, kp); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = U.lerp(AM.avantBrasD[0], -0.5, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = AM.cou, _x = U.lerp(AM.cou[0], 0.02, kp), _y = -tw * 0.35, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = U.lerp(AM.tete[0], -0.05, kp), _y = -tw * 0.3, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.5 + 0.3 * kp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            y0 = U.lerp(y0, -0.06, kp);
          }
        } else if (m.mode === 'cri') {
          // v1.5 : cri d'infection : bras ouverts, tête renversée, mâchoire béante
          var kC = U.smooth(0, 0.25, m.rageT) * (1 - U.smooth(m.rageD - 0.25, m.rageD, m.rageT)), trC = 0.04 * kC;
          { var _a = AM.brasG, _x = U.lerp(AM.brasG[0], -1.25, kC) + trC * s(T * 37), _y = 0, _z = U.lerp(AM.brasG[2], 1.05, kC); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -1.25, kC) + trC * s(T * 41), _y = 0, _z = U.lerp(AM.brasD[2], -1.05, kC); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.avantBrasG, _x = -0.35 * kC, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.35 * kC, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], -0.2, kC), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], -0.1, kC), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cou, _x = U.lerp(AM.cou[0], -0.42, kC), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.tete, _x = U.lerp(AM.tete[0], -0.25, kC) + trC * s(T * 29), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = U.lerp(AM.machoire[0], 0.95, kC), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        } else if (m.mode === 'lancer') {
          // boules : main nue armée au-dessus de l'épaule, puis lancer en cloche vers l'avant
          var tl = m.modeT, kw = U.smooth(0, 0.36, tl) * (1 - U.smooth(0.4, 0.52, tl)), kt = U.smooth(0.38, 0.5, tl) * (1 - U.smooth(0.58, 0.8, tl));
          { var _a = AM.brasG, _x = U.lerp(U.lerp(AM.brasG[0], -2.75, kw), -1.35, kt), _y = 0.15 * kw, _z = U.lerp(AM.brasG[2], 0.32, kw + kt); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasG, _x = -0.95 * kw - 0.2 * kt, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.mainG, _x = -0.3 * kw + 0.25 * kt, _y = 0, _z = 0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], -0.06, kw) + 0.22 * kt, _y = 0.32 * kw - 0.22 * kt, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], 0.0, kw) + 0.1 * kt, _y = 0.14 * kw - 0.12 * kt, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.cou, _x = U.lerp(AM.cou[0], 0.08, Math.min(1, kw + kt)), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = U.lerp(AM.tete[0], 0.0, Math.min(1, kw + kt)), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.45 + 0.25 * kt, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        } else if (m.mode === 'contact') {
          var ai = m.modeT / 1.25, l1 = U.smooth(0, 0.45, ai), l2 = U.smooth(0.45, 0.58, ai), l3 = U.smooth(0.72, 1.0, ai), le = l1 * (1 - l2), fi = l2 * (1 - l3);
          { var _a = AM.brasG, _x = U.lerp(AM.brasG[0], -2.5, le) + 1.9 * fi, _y = 0.15, _z = 0.2; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -2.45, le) + 1.85 * fi, _y = -0.15, _z = -0.2; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.avantBrasG, _x = -0.4 * le, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = -0.4 * le, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.colonne, _x = U.lerp(0.16, -0.18, le) + 0.55 * fi, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(0.1, -0.1, le) + 0.3 * fi, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.cou, _x = U.lerp(0.5, 0.15, le), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.55, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          y0 -= 0.04 * fi;
        }
      } else if (m.etat === 'cuve' || m.etat === 'bras') {
        // tombe du socle → à quatre pattes → se redresse ; v1.5 'bras' (petit Démembré) : remonte du sol en griffant, rampe, se redresse
        var eb = m.etat === 'bras', kf = eb ? U.smooth(0, 0.6, t) : U.smooth(0, 0.45, t), kq = eb ? U.smooth(0.1, 0.5, t) : U.smooth(0.3, 0.6, t), kr = eb ? U.smooth(1.15, 1.95, t) : U.smooth(1.25, 2.3, t), kp = kq * (1 - kr);
        var hauteurSocle = (eb ? -1.3 * (1 - kf) : 0.45 / m.scale * (1 - kf)) - 0.42 * kp;      // (socle : hauteur réelle, quelle que soit l'échelle)
        pitch = eb ? 0.35 * (1 - kf) : 0.55 * kf * (1 - kq) + 0.0;
        { var _a = AM.cuisseG, _x = U.lerp(AM.cuisseG[0], -1.35, kp), _y = 0, _z = U.lerp(AM.cuisseG[2], 0.1, kp); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = U.lerp(AM.cuisseD[0], -1.25, kp), _y = 0, _z = U.lerp(AM.cuisseD[2], -0.1, kp); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.tibiaG, _x = U.lerp(AM.tibiaG[0], 2.15, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = U.lerp(AM.tibiaD[0], 2.05, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.piedG, _x = U.lerp(AM.piedG[0], 0.5, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.piedD, _x = U.lerp(AM.piedD[0], 0.5, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.colonne, _x = U.lerp(AM.colonne[0], 0.95, kp) + 0.3 * kf * (1 - kq), _y = 0.1 * s(t * 5) * kp, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.poitrine, _x = U.lerp(AM.poitrine[0], 0.35, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.cou, _x = U.lerp(AM.cou[0], -0.45, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tete, _x = U.lerp(AM.tete[0], 0.1, kp), _y = 0.35 * s(t * 7) * kp * U.smooth(0.6, 0.9, t), _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.brasG, _x = U.lerp(AM.brasG[0], -1.05, Math.max(kp, kf * (1 - kq))), _y = 0, _z = U.lerp(AM.brasG[2], 0.12, Math.max(kp, kf * (1 - kq))); _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = U.lerp(AM.brasD[0], -1.1, Math.max(kp, kf * (1 - kq))), _y = 0, _z = U.lerp(AM.brasD[2], -0.12, Math.max(kp, kf * (1 - kq))); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.avantBrasG, _x = U.lerp(AM.avantBrasG[0], -0.15, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.avantBrasD, _x = U.lerp(AM.avantBrasD[0], -0.15, kp), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = AM.machoire, _x = 0.5, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        y0 = hauteurSocle + 0.0;
      } else if (m.etat === 'mort' || m.etat === 'effondrement') {
        if (m.etat === 'effondrement') t = t * 1.55;                    // v1.5 : il s'écroule plus vite (puis se dissout)
        if (sv) {
          // court-circuit debout (convulsions), puis effondrement en arrière
          var kc2 = U.smooth(0, 0.25, t) * (1 - U.smooth(0.85, 1.05, t)), kd = U.smooth(0.95, 1.55, t);
          { var _a = AM.colonne, _x = 0.3 * kc2 * s(T * 47), _y = 0.3 * kc2 * s(T * 33), _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.tete, _x = 0.4 * kc2 * s(T * 39), _y = 0.6 * kc2 * s(T * 29), _z = 0.3 * kc2 * s(T * 31); _a[0] += _x; _a[1] += _y; _a[2] += _z; }
          { var _a = AM.brasG, _x = -0.4 * kc2 + 0.6 * kc2 * s(T * 43), _y = 0, _z = 0.9 * kc2 + 0.4 * kc2 * s(T * 37) + 0.3 * kd; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = -0.4 * kc2 + 0.6 * kc2 * s(T * 41), _y = 0, _z = -0.9 * kc2 - 0.4 * kc2 * s(T * 35) - 0.3 * kd; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.machoire, _x = 0.7, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cou, _x = -0.3 * kc2 - 0.2 * kd, _y = 0, _z = 0.3 * kd; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.cuisseG, _x = -0.2 * kd, _y = 0, _z = 0.12 * kd; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = 0.05 * kd, _y = 0, _z = -0.1 * kd; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaG, _x = 0.5 * kd, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = 0.2 * kd, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          pitch = -1.42 * kd; y0 = 0.14 * kd;
        } else if (dm) {
          // le colosse vacille en arrière, ses genoux lâchent, il s'abat face contre terre (le bras pendu suit, par la physique)
          var kv = U.smooth(0, 0.35, t) * (1 - U.smooth(0.35, 0.75, t)), kg3 = U.smooth(0.3, 0.95, t), ka3 = U.smooth(0.9, 1.5, t);
          { var _a = AM.cuisseG, _x = -1.25 * kg3 * (1 - ka3) - 0.15 * ka3, _y = 0, _z = 0.14; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = -1.15 * kg3 * (1 - ka3) - 0.1 * ka3, _y = 0, _z = -0.12; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.tibiaG, _x = 2.0 * kg3 * (1 - ka3) + 0.25 * ka3, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = 1.9 * kg3 * (1 - ka3) + 0.2 * ka3, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.colonne, _x = -0.25 * kv + 0.4 * kg3, _y = 0, _z = -0.05; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cou, _x = 0.5, _y = 0.3 * ka3, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.machoire, _x = 0.8, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.brasD, _x = -0.5 * ka3, _y = 0, _z = -0.4 - 0.3 * ka3; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          y0 = -0.48 * kg3 * (1 - ka3) + 0.2 * ka3 - 0.03 * kv; pitch = -0.12 * kv + 1.42 * ka3;
        } else {
          // à genoux puis face contre terre
          var kg2 = U.smooth(0, 0.6, t), ka = U.smooth(0.55, 1.25, t);
          { var _a = AM.cuisseG, _x = -1.3 * kg2 * (1 - ka) - 0.2 * ka, _y = 0, _z = 0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cuisseD, _x = -1.2 * kg2 * (1 - ka) - 0.1 * ka, _y = 0, _z = -0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.tibiaG, _x = 2.1 * kg2 * (1 - ka) + 0.3 * ka, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.tibiaD, _x = 2.0 * kg2 * (1 - ka) + 0.3 * ka, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = AM.colonne, _x = 0.35 * kg2, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.cou, _x = 0.6, _y = 0.4 * ka, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasG, _x = -0.4 * ka, _y = 0, _z = 0.3 + 0.4 * ka; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = AM.brasD, _x = -0.6 * ka, _y = 0, _z = -0.3 - 0.3 * ka; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          y0 = -0.45 * kg2 * (1 - ka) + 0.16 * ka; pitch = 1.45 * ka;
        }
      }
      // réaction aux balles (additive)
      if (m.reaction > 0) { var r = m.reaction; { var _a = AM.colonne, _x = -0.16 * r, _y = 0, _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.tete, _x = -0.22 * r, _y = 0.12 * r * (m.idx % 2 ? 1 : -1), _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } { var _a = AM.poitrine, _x = 0, _y = 0.12 * r * (m.idx % 2 ? -1 : 1), _z = 0; _a[0] += _x; _a[1] += _y; _a[2] += _z; } }
      for (var ib = 0; ib < NOMS_MB.length; ib++) { var nb = NOMS_MB[ib], ab = AM[nb], bo = m.os[nb]; _eMB.set(ab[0], ab[1], ab[2], 'XYZ'); _qMB.setFromEuler(_eMB); bo.quaternion.copy(m.rest[nb]).multiply(_qMB); }
      m.racineOs.position.x = 0; m.racineOs.position.y = y0; m.racineOs.position.z = 0;
      m.racineOs.rotation.set(pitch, 0, roll);
      m.groupe.position.x = m.position.x; m.groupe.position.y = m.position.y; m.groupe.position.z = m.position.z;
      m.groupe.rotation.y = m.lacet;
      m.hauteur = Math.max(0, y0) * m.scale;
    }
    tous = tous.concat(mbs);              // zombies + chiens + mini-boss
    // v1.5 : rayon et masse de séparation, irradiation (lueur, rayon, dps) par indice de `tous` dans des Float64Array : `tous` mêle
    // zombies, chiens et mini-boss (accès mégamorphes) ; un nombre lu ou écrit dans leurs propriétés y serait « emballé » (alloué)
    var SEP_R = new Float64Array(tous.length), SEP_M = new Float64Array(tous.length), COL_R = new Float64Array(tous.length);
    var IRR_K = new Float64Array(tous.length), IRR_R = new Float64Array(tous.length), IRR_D = new Float64Array(tous.length);
    for (var it0 = 0; it0 < tous.length; it0++) { var q0 = tous[it0]; q0.it = it0; SEP_R[it0] = q0.rayonS; SEP_M[it0] = q0.masse; COL_R[it0] = q0.rayonCol; IRR_R[it0] = 1.5; IRR_D[it0] = 0.04; }

    // ── effets au sol : terre projetée (points) + fissure (décalques) ──
    var NT = 360, tg = new THREE.BufferGeometry(), tP = new Float32Array(NT * 3), tV = new Float32Array(NT * 3), tVie = new Float32Array(NT), tL = [], tI = 0;
    tg.setAttribute('position', new THREE.BufferAttribute(tP, 3));
    for (var q = 0; q < NT; q++) { tP[q * 3 + 1] = -999; tL.push('salle'); }
    var texTerre = (function () { var c = U.canvas(32, 32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(70,58,44,1)'); gr.addColorStop(0.6, 'rgba(50,42,32,0.8)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return U.tex(THREE, C, c, { clamp: true }); })();
    var terres = {}, listeTerres = [], listeBraises = [];   // listes : parcours sans for…in à chaque image
    function terrePour(lieu) {
      if (terres[lieu]) return terres[lieu];
      var g2 = new THREE.BufferGeometry();
      var P2 = new Float32Array(NT * 3); for (var k = 0; k < NT; k++) P2[k * 3 + 1] = -999;
      g2.setAttribute('position', new THREE.BufferAttribute(P2, 3));
      var pts = new THREE.Points(g2, new THREE.PointsMaterial({ map: texTerre, size: 0.09, transparent: true, depthWrite: false, color: 0xffffff }));
      pts.frustumCulled = false;
      if (monde) monde.scenes[lieu].add(pts);
      terres[lieu] = { pts: pts, P: P2, V: new Float32Array(NT * 3), vie: new Float32Array(NT), i: 0, braise: false };
      listeTerres.push(terres[lieu]);
      return terres[lieu];
    }
    var braises = {};
    function braisesPour(lieu) {
      if (braises[lieu]) return braises[lieu];
      var g2 = new THREE.BufferGeometry(), P2 = new Float32Array(NT * 3); for (var k = 0; k < NT; k++) P2[k * 3 + 1] = -999;
      g2.setAttribute('position', new THREE.BufferAttribute(P2, 3));
      var pts = new THREE.Points(g2, new THREE.PointsMaterial({ map: halo, size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: C.couleur(0xff7a20) }));
      pts.frustumCulled = false;
      if (monde) monde.scenes[lieu].add(pts);
      braises[lieu] = { pts: pts, P: P2, V: new Float32Array(NT * 3), vie: new Float32Array(NT), i: 0 };
      listeBraises.push(braises[lieu]);
      return braises[lieu];
    }
    function projeter(sys, x, y, z, n, vitesse, dispersion, vieMin) {
      for (var k = 0; k < n; k++) {
        var s = sys.i++ % NT;
        sys.P[s * 3] = x + (alea() - 0.5) * dispersion; sys.P[s * 3 + 1] = y; sys.P[s * 3 + 2] = z + (alea() - 0.5) * dispersion;
        var an = alea() * TAU, sp = alea() * vitesse;
        sys.V[s * 3] = Math.cos(an) * sp * 0.6; sys.V[s * 3 + 1] = vitesse * (0.5 + alea()); sys.V[s * 3 + 2] = Math.sin(an) * sp * 0.6;
        sys.vie[s] = (vieMin || 0.5) + alea() * 0.6;
      }
    }
    function majParticules(sys, dt, gravite) {
      for (var k = 0; k < NT; k++) {
        if (sys.vie[k] <= 0) continue;
        sys.vie[k] -= dt;
        if (sys.vie[k] <= 0) { sys.P[k * 3 + 1] = -999; continue; }
        sys.V[k * 3 + 1] -= gravite * dt;
        sys.P[k * 3] += sys.V[k * 3] * dt; sys.P[k * 3 + 1] += sys.V[k * 3 + 1] * dt; sys.P[k * 3 + 2] += sys.V[k * 3 + 2] * dt;
        if (sys.P[k * 3 + 1] < 0.01 && gravite > 0) { sys.P[k * 3 + 1] = 0.01; sys.V[k * 3] *= 0.5; sys.V[k * 3 + 2] *= 0.5; sys.V[k * 3 + 1] = 0; }
      }
      sys.pts.geometry.attributes.position.needsUpdate = true;
    }
    // fissures / tas de cendres au sol (décalques réutilisés)
    var texSol = (function () {
      var c = U.canvas(128, 128), g = c.getContext('2d'), R = U.rng(77);
      g.clearRect(0, 0, 128, 128);
      var gr = g.createRadialGradient(64, 64, 4, 64, 64, 60); gr.addColorStop(0, 'rgba(20,16,12,0.95)'); gr.addColorStop(0.5, 'rgba(30,24,18,0.6)'); gr.addColorStop(1, 'rgba(30,24,18,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(10,8,6,0.95)'; g.lineCap = 'round';
      for (var k = 0; k < 9; k++) { var a = k / 9 * TAU + R() * 0.4, x = 64, y = 64; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); for (var s = 0; s < 14; s++) { a += (R() - 0.5) * 0.8; x += Math.cos(a) * 4; y += Math.sin(a) * 4; g.lineTo(x, y); g.lineWidth = Math.max(0.5, 3 - s * 0.2); } g.stroke(); }
      return U.tex(THREE, C, c, { clamp: true });
    })();
    var decals = [], NDC = 16, dcI = 0;
    var gDec = new THREE.PlaneGeometry(1.6, 1.6);
    for (var d0 = 0; d0 < NDC; d0++) {
      var dm = new THREE.Mesh(gDec, new THREE.MeshBasicMaterial({ map: texSol, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      dm.rotation.x = -PI / 2; dm.visible = false; decals.push({ mesh: dm, vie: 0, duree: 1 });
    }
    function decal(x, z, lieu, duree, taille, teinte) {
      var D = decals[dcI++ % NDC];
      D.mesh.position.set(x, 0.008, z); D.mesh.rotation.z = Math.random() * TAU; D.mesh.scale.setScalar(taille || 1);
      D.mesh.material.color.setRGB(teinte ? teinte[0] : 1, teinte ? teinte[1] : 1, teinte ? teinte[2] : 1);
      D.mesh.visible = true; D.vie = duree; D.duree = duree;
      if (monde) monde.scenes[lieu].add(D.mesh);
    }

    // ── champs de flux par joueur (recalcul échelonné) ──
    var champs = {};          // cle (joueur id) → { champ, lieu, t }
    function champPour(j, temps) {
      if (!monde || !NAV) return null;
      var c = champs[j.id];
      var grille = monde.grilles[j.lieu];
      if (!grille) return null;
      if (!c || c.lieu !== j.lieu) { c = champs[j.id] = { champ: new NAV.Champ(grille), lieu: j.lieu, t: -1, x: 1e9, z: 1e9 }; }
      if (temps - c.t > 0.35 || h2(c.x - j.position.x, c.z - j.position.z) > 2.5 || c.champ.version !== grille.version) {
        c.champ.calculer(j.position.x, j.position.z, 70); c.t = temps; c.x = j.position.x; c.z = j.position.z;
      }
      return c.champ;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    // API
    // ════════════════════════════════════════════════════════════════════════════════════════
    var parId = {};
    Z.apparaitre = function (opts) {
      if (opts && opts.type === 'chien') return apparaitreChien(opts);
      if (opts && TYPES_ENT.indexOf(opts.type) >= 0) return apparaitreMiniBoss(opts);   // mini-boss et petits Démembrés (v1.5)
      var z = null;
      for (var k = 0; k < pool.length; k++) if (!pool[k].actif) { z = pool[k]; break; }
      if (!z) return null;
      var p = opts.position;
      z.id = 'z' + (prochainId++); parId[z.id] = z;
      z.actif = true; z.lieu = opts.lieu || (monde && monde.lieuDe ? monde.lieuDe(p.x) : 'salle');
      z.position.set(p.x, p.y || 0, p.z); z.vitesse.set(0, 0, 0);
      z.lacet = opts.lacet != null ? opts.lacet : Math.random() * TAU;
      z.pv = z.pvMax = opts.pv || Z.pv; z.source = opts.source || null;
      var vit = opts.vitesse;
      z.sprint = vit === 'sprint' || (typeof vit === 'number' && vit >= 4.5);
      z.course = z.sprint || vit === 'course' || (typeof vit === 'number' && vit >= 2.5) || (vit == null && Math.random() < 0.18);
      z.vitesseMax = typeof vit === 'number' ? vit : z.sprint ? 5.8 + Math.random() * 0.4 : z.course ? 3.3 + Math.random() * 0.4 : 1.15 + Math.random() * 0.45;
      z.agressif = !!opts.agressif;
      z.decalage = Math.random() * 2 - 1;                            // approche un peu de biais : la meute s'étale au lieu de faire la queue
      z.effet = null; z.effetT = 0; z.hauteur = 0; z.attente = 0; z.bloqueT = 0; z.derniereDist = 1e9; z.virage = 0; z.irrActif = false; IRR_K[z.it] = 0;
      if (z.mat !== matBase) { rendreMat(z.mat); z.mat = matBase; z.mesh.material = matBase; }
      z.yeux.material = matYeux; z.halos[0].visible = z.halos[1].visible = true;
      z.groupe.visible = true; z.groupe.scale.setScalar(opts.echelle || (0.96 + Math.random() * 0.1));
      var e = opts.effet || 'normal';
      z.etat = e === 'emergence' ? 'emergence' : e === 'breche' ? 'breche' : 'marche';
      z.dureeSortie = z.etat === 'emergence' ? (z.agressif ? 1.1 : 1.7) : (z.agressif ? 1.25 : 1.9);   // agressifs : sortent vite et chassent aussitôt
      z.t = 0;
      placerDansScene(z);
      if (z.etat === 'emergence') { decal(p.x, p.z, z.lieu, 6, 0.9); projeter(terrePour(z.lieu), p.x, 0.05, p.z, 40, 2.4, 0.6, 0.6); }
      if (z.etat === 'breche' && monde && monde.brecheProche) { var b = monde.brecheProche(p.x, p.z); if (b >= 0) monde.ouvrirBreche(b, 2.4); projeter(terrePour(z.lieu), p.x, 0.05, p.z, 18, 1.6, 0.8, 0.4); }
      appliquerPose(z, 0);
      return z.id;
    };
    Z.obtenir = function (id) { return parId[id] || null; };
    Z.effet = function (id, effet, params) {
      var z = parId[id];
      if (!z || !z.actif) return false;
      params = params || {};
      // v1.5 (§17.1) : irradiation (zombies, chiens, petits Démembrés), rages des mini-boss (surcharge, arrachement, cri d'infection)
      if (effet === 'irradie') return irradier(z, params);
      if (z.mb) {
        if (effet === 'surcharge' && z.type === 'survolte') return surcharger(z, params);
        if (effet === 'arrachement' && z.type === 'demembre') return arracher(z, params);
        if (effet === 'infection' && z.type === 'irradie') return crier(z, params);
        return effet === 'relache';                                     // ni saisie ni extraction (petits Démembrés : hors des absorptions)
      }
      if (z.type === 'chien') return effet === 'relache';   // ni saisie ni extraction pour les chiens et les mini-boss (API §14.3, §15)
      if (effet === 'saisie') { z.effet = 'saisie'; z.effetT = 0; z.etatAvant = z.etat; z.etat = 'saisie'; z.t = 0; return true; }
      if (effet === 'extraction') {
        if (z.etat !== 'saisie' && z.etat !== 'extraction') { z.etat = 'saisie'; z.t = 0.6; }
        z.effet = 'extraction'; z.etat = 'extraction'; z.t = 0;
        z.yeux.material = matYeuxEteints; z.halos[0].visible = z.halos[1].visible = false;
        if (z.mat === matBase) { z.mat = prendreMat(); z.mesh.material = z.mat; }
        return true;
      }
      if (effet === 'relache') {
        if (z.etat === 'saisie' || z.etat === 'extraction') { z.etat = 'chute'; z.t = 0; z.effet = null; z.yeux.material = matYeux; z.halos[0].visible = z.halos[1].visible = true; }
        return true;
      }
      return false;
    };
    Z.retirer = function (id, opts) {
      var z = parId[id];
      if (!z || !z.actif) return false;
      var e = (opts && opts.effet) || 'silencieux';
      if (e === 'silencieux') { liberer(z); return true; }
      if (z.mb) {
        // v1.5 : 'effondrement' (petits Démembrés à la mort du géant) : il s'écroule et se dissout ; sinon cendres
        z.etat = e === 'effondrement' ? 'effondrement' : 'cendres'; z.t = 0; z.vitesse.set(0, 0, 0); eteindreEffets(z); z.invulT = 0;
        if (z.arr.objet && z.arr.objet.owner === z) fletrirBras(z);
        return true;
      }
      if (z.type === 'chien') { z.etat = 'cendres'; z.t = 0; z.yeux.material = matYeuxEteints; z.halos[0].visible = z.halos[1].visible = false; return true; }
      if (z.mat === matBase) { z.mat = prendreMat(); z.mesh.material = z.mat; }
      z.etat = e === 'cendres' ? 'cendres' : 'absorbe'; z.t = 0;                 // 'effondrement' d'un zombie : il s'effondre et s'effrite
      z.yeux.material = matYeuxEteints; z.halos[0].visible = z.halos[1].visible = false;
      return true;
    };
    function liberer(z) {
      z.actif = false; z.groupe.visible = false; z.etat = 'inactif'; z.irrActif = false; IRR_K[z.it] = 0;
      if (z.mb) {
        rendreLumiere(z); eteindreEffets(z);
        var Bo = z.arr.objet;                                            // v1.5 : bras en vol ou posé d'un géant retiré sans mourir → orphelin
        if (Bo && Bo.actif && Bo.owner === z && Bo.etat !== 'fletri') { Bo.owner = null; Bo.orphelinT = 0; if (Bo.etat === 'main') { Bo.etat = 'pose'; Bo.t = 0; Bo.x1 = Bo.groupe.position.x; Bo.z1 = Bo.groupe.position.z; } }
        z.arr.objet = null;
      }
      else if (z.mat !== matBase) { rendreMat(z.mat); z.mat = matBase; z.mesh.material = matBase; }
      delete parId[z.id];
      if (z.groupe.parent) z.groupe.parent.remove(z.groupe);
    }
    /** Retire tout (zombies et chiens) ; `type` facultatif : 'zombie' | 'chien' | 'survolte' | 'irradie'. Les mini-boss ne sont
     *  retirés que si `type` les désigne ou si `inclureMiniBoss` est vrai (bombe, nettoyages : ils restent). */
    Z.tuerTous = function (effet, type, inclureMiniBoss) {
      for (var k = 0; k < tous.length; k++) {
        var q = tous[k];
        if (!q.actif || (type && q.type !== type) || (q.miniBoss && !type && !inclureMiniBoss) || q.etat === 'mort' || q.etat === 'cendres' || q.etat === 'absorbe') continue;
        Z.retirer(q.id, { effet: effet || 'cendres' });
      }
    };
    Z.vivant = function (z) { return z.actif && z.etat !== 'mort' && z.etat !== 'cendres' && z.etat !== 'absorbe' && z.etat !== 'inactif' && z.etat !== 'effondrement'; };
    var vues = [];
    Z.liste = function () {
      vues.length = 0;
      for (var k = 0; k < tous.length; k++) {
        var z = tous[k];
        if (!z.actif) continue;
        var v = z.vue; v.id = z.id; v.position.x = z.position.x; v.position.y = z.position.y + z.hauteur; v.position.z = z.position.z;
        v.vivant = Z.vivant(z); v.lieu = z.lieu; v.etat = z.etat; v.source = z.source;
        v.pv = z.pv > 0 ? z.pv : 0; v.pvMax = z.pvMax || z.pv; v.nom = z.nom || null;
        if (v.vivant) vues.push(v);
      }
      return vues;
    };
    /** Nombre de vivants ; `lieu` et `type` ('zombie' | 'chien') facultatifs. */
    Z.nombre = function (lieu, type) { var n = 0; for (var k = 0; k < tous.length; k++) { var q = tous[k]; if (Z.vivant(q) && (!lieu || q.lieu === lieu) && (!type || q.type === type)) n++; } return n; };
    Z.toucher = function (id, degats, zone, info) {
      var z = parId[id];
      if (!z || !Z.vivant(z)) return { tue: false };
      if (z.etat === 'emergence' && z.t < 0.5) return { tue: false };
      if (z.mb) {
        if (z.etat === 'cuve' && z.t < 0.5) return { tue: false };              // encore dans la cuve
        if (z.etat === 'bras' && z.t < 0.45) return { tue: false };             // v1.5 : petit Démembré encore sous le sol
        if (z.invulT > 0) return { tue: false, immunise: true };                // v1.5 : rage (surcharge, arrachement) : immunisé
        z.pv -= degats * (zone === 'tete' ? 2 : 1);
        z.reaction = Math.min(1, z.reaction + 0.5);
        if (z.pv <= 0) { z.pv = 0; tuerMiniBoss(z, info && info.joueur); return { tue: true }; }
        return { tue: false };
      }
      if (z.type === 'chien') {
        if (z.etat === 'faille' && z.t < 0.2) return { tue: false };                 // encore sous le sol
        z.pv -= degats * (zone === 'tete' ? 2 : 1);
        z.reaction = 1;
        if (z.pv <= 0) {
          z.etat = 'mort'; z.t = 0; z.mortCote = Math.random() < 0.5 ? 1 : -1;
          z.yeux.material = matYeuxEteints; z.halos[0].visible = z.halos[1].visible = false;
          surMort(z, info && info.joueur); return { tue: true };
        }
        return { tue: false };
      }
      z.pv -= degats * (zone === 'tete' ? 2 : 1);
      z.reaction = 1;
      if (z.pv <= 0) { z.etat = 'mort'; z.t = 0; z.chuteAvant = Math.random() < 0.5; surMort(z, info && info.joueur); return { tue: true }; }
      return { tue: false };
    };
    // intersection d'un rayon avec les zombies (capsule corps + sphère tête), dans un lieu
    var _hb = new THREE.Vector3(), _hh = new THREE.Vector3(), _hp = new THREE.Vector3();
    var hit = { distance: 0, point: { x: 0, y: 0, z: 0 }, normale: { x: 0, y: 0, z: 0 }, zone: 'corps', cible: null, materiau: 'chair' };
    function raySphere(o, d, c, r, max) {
      var cx = c.x - o.x, cy = c.y - o.y, cz = c.z - o.z, t = cx * d.x + cy * d.y + cz * d.z;
      if (t < 0) return -1;
      var d2 = cx * cx + cy * cy + cz * cz - t * t;
      if (d2 > r * r) return -1;
      var t0 = t - Math.sqrt(r * r - d2);
      return t0 < max ? t0 : -1;
    }
    var _hs = new THREE.Vector3(), _hc = new THREE.Vector3();
    function raySegmentChien(o, d, a, b, r, max) {
      var best = -1;
      for (var k = 0; k <= 5; k++) {
        _hs.set(a.x + (b.x - a.x) * k / 5, a.y + (b.y - a.y) * k / 5, a.z + (b.z - a.z) * k / 5);
        var t = raySphere(o, d, _hs, r, max);
        if (t >= 0 && (best < 0 || t < best)) best = t;
      }
      return best;
    }
    var _rq = new THREE.Vector3();                                     // v1.5 : propre à raySegment (a ou b peuvent être _hp)
    function raySegment(o, d, a, b, r, max) {
      // distance minimale rayon-segment approchée par échantillonnage (6 sphères)
      var best = -1;
      for (var k = 0; k <= 5; k++) {
        _rq.set(a.x + (b.x - a.x) * k / 5, a.y + (b.y - a.y) * k / 5, a.z + (b.z - a.z) * k / 5);
        var t = raySphere(o, d, _rq, r, max);
        if (t >= 0 && (best < 0 || t < best)) best = t;
      }
      return best;
    }
    Z.intersecter = function (o, d, max, lieu) {
      var best = max, trouve = null, zone = 'corps';
      for (var k = 0; k < pool.length; k++) {
        var z = pool[k];
        if (!Z.vivant(z) || (lieu && z.lieu !== lieu)) continue;
        if (h2(z.position.x - o.x, z.position.z - o.z) > best + 2) continue;
        z.os.tete.getWorldPosition(_hh); z.os.hanches.getWorldPosition(_hb);
        var th = raySphere(o, d, _hh, 0.16, best);
        if (th >= 0) { best = th; trouve = z; zone = 'tete'; }
        _hp.set(z.position.x, z.position.y + z.hauteur + 0.12, z.position.z);
        var tb = raySegment(o, d, _hb, _hh, 0.24, best);
        if (tb >= 0 && tb < best) { best = tb; trouve = z; zone = 'corps'; }
        var tj = raySegment(o, d, _hp, _hb, 0.2, best);
        if (tj >= 0 && tj < best) { best = tj; trouve = z; zone = 'corps'; }
      }
      for (var kc = 0; kc < chiens.length; kc++) {
        var c = chiens[kc];
        if (!Z.vivant(c) || (lieu && c.lieu !== lieu)) continue;
        if (h2(c.position.x - o.x, c.position.z - o.z) > best + 2) continue;
        // corps : capsule bassin → thorax + cou ; tête : crâne + museau (prioritaire quand les deux sont touchés) ; pattes ignorées
        c.os.bassin.getWorldPosition(_hb); c.os.thorax.getWorldPosition(_hp);
        var tb2 = raySegmentChien(o, d, _hb, _hp, 0.17, best);
        c.os.cou.getWorldPosition(_hp);
        var tn = raySphere(o, d, _hp, 0.11, best);
        if (tn >= 0 && (tb2 < 0 || tn < tb2)) tb2 = tn;
        c.os.tete.updateWorldMatrix(true, false);                                       // pose de cette image, même hors rendu
        _hh.set(0, -0.02, 0.1).applyMatrix4(c.os.tete.matrixWorld);
        var tc = raySphere(o, d, _hh, 0.115, best + 0.12);
        _hh.set(0, -0.045, 0.2).applyMatrix4(c.os.tete.matrixWorld);
        var tm = raySphere(o, d, _hh, 0.075, best + 0.12);
        if (tm >= 0 && (tc < 0 || tm < tc)) tc = tm;
        if (tc >= 0 && (tb2 < 0 || tc <= tb2 + 0.12)) { best = tc; trouve = c; zone = 'tete'; }
        else if (tb2 >= 0 && tb2 < best) { best = tb2; trouve = c; zone = 'corps'; }
      }
      for (var km = 0; km < mbs.length; km++) {
        var mb = mbs[km];
        if (!Z.vivant(mb) || (lieu && mb.lieu !== lieu)) continue;
        if (h2(mb.position.x - o.x, mb.position.z - o.z) > best + 2.5) continue;
        var sc = mb.scale, gros = mb.fam === 'irradie', colosse = mb.fam === 'demembre';
        mb.os.tete.updateWorldMatrix(true, false);
        _hh.set(0, 0.1, 0.03).applyMatrix4(mb.os.tete.matrixWorld);                     // (l'échelle de la grosse tête du Démembré est dans la matrice)
        var thm = raySphere(o, d, _hh, (gros ? 0.15 : colosse ? 0.15 : 0.145) * sc, best + 0.1);
        // torse : capsule hanches → poitrine, puis poitrine → cou plus étroite (épaules) pour que la tête reste une zone distincte
        // (v1.5 : avant, l'alias du vecteur de travail réduisait la capsule à une sphère aux hanches : tirs dans la poitrine perdus)
        mb.os.hanches.getWorldPosition(_hb); mb.os.poitrine.getWorldPosition(_hp); mb.os.cou.getWorldPosition(_hc);
        var rT = (gros ? 0.33 : colosse ? 0.36 : 0.27) * sc, tbm = raySegment(o, d, _hb, _hp, rT, best), tbu = raySegment(o, d, _hp, _hc, rT * 0.62, best);
        if (tbu >= 0 && (tbm < 0 || tbu < tbm)) tbm = tbu;
        _hs.set(mb.position.x, mb.position.y + mb.hauteur + 0.18, mb.position.z);
        var tjm = raySegment(o, d, _hs, _hb, (gros ? 0.24 : colosse ? 0.27 : 0.2) * sc, best);
        if (tjm >= 0 && (tbm < 0 || tjm < tbm)) tbm = tjm;
        if (colosse && !mb.sansBras) {                                                       // bras pendu : touché comme le corps
          mb.os.brasLibre.getWorldPosition(_hb); mb.os.mainLibre.getWorldPosition(_hp);
          var tam = raySegment(o, d, _hb, _hp, 0.1 * sc, best);
          if (tam >= 0 && (tbm < 0 || tam < tbm)) tbm = tam;
        }
        if (thm >= 0 && (tbm < 0 || thm <= tbm + 0.1 * sc)) { best = thm; trouve = mb; zone = 'tete'; }
        else if (tbm >= 0 && tbm < best) { best = tbm; trouve = mb; zone = 'corps'; }
      }
      if (!trouve) return null;
      hit.distance = best; hit.point.x = o.x + d.x * best; hit.point.y = o.y + d.y * best; hit.point.z = o.z + d.z * best;
      hit.normale.x = -d.x; hit.normale.y = -d.y; hit.normale.z = -d.z; hit.zone = zone; hit.cible = trouve.id;
      return hit;
    };
    /** Le plus proche (zombie ou chien ; `type` facultatif : 'zombie' | 'chien'). */
    Z.plusProche = function (x, z, lieu, max, type) {
      var best = null, bd = max || 1e9;
      for (var k = 0; k < tous.length; k++) { var q = tous[k]; if (!Z.vivant(q) || q.lieu !== lieu || (type && q.type !== type)) continue; var d = h2(q.position.x - x, q.position.z - z); if (d < bd) { bd = d; best = q; } }
      return best;
    };
    /** Fournisseur de cibles pour ProtoB7Arme. */
    Z.fournisseur = function (getLieu, surToucheExterne) {
      return {
        nom: 'zombies', lieu: getLieu,
        intersecter: function (o, d, max) { return Z.intersecter(o, d, max, getLieu ? getLieu() : null); },
        toucher: function (h, degats, info) { var r = Z.toucher(h.cible, degats, h.zone, info); if (surToucheExterne) surToucheExterne(h, degats, r); return r; }
      };
    };

    // ════════════════════════════════════════════════════════════════════════════════════════
    // Animation procédurale
    // ════════════════════════════════════════════════════════════════════════════════════════
    var _e = new THREE.Euler(), _q = new THREE.Quaternion(), P0 = poseVide();
    function rot(z, nom, x, y, zz) {
      var b = z.os[nom];
      _e.set(x, y, zz, 'XYZ'); _q.setFromEuler(_e);
      b.quaternion.copy(z.rest[nom]).multiply(_q);
    }
    // angles par os : tampons réutilisés (aucune allocation par image)
    var NOMS_OS = OS.map(function (o) { return o[0]; }), A = {};
    NOMS_OS.forEach(function (n) { A[n] = [0, 0, 0]; });
    function set(n, x, y, zz) { var a = A[n]; a[0] = x; a[1] = y; a[2] = zz; }
    function appliquerPose(z, dt) {
      var t = z.t, ph = z.phase, s = Math.sin, c = Math.cos;
      var y0 = 0, pitchRacine = 0, rollRacine = 0;
      for (var ia = 0; ia < NOMS_OS.length; ia++) { var a0 = A[NOMS_OS[ia]]; a0[0] = 0; a0[1] = 0; a0[2] = 0; }
      var reac = z.reaction || 0;
      if (z.etat === 'marche' || z.etat === 'course' || z.etat === 'attaque' || z.etat === 'chute' || z.etat === 'idle') {
        var v = h2(z.vitesse.x, z.vitesse.z), course = z.course;
        if (z.sprint && v > 2.2 && z.etat !== 'chute') {
          // ── sprint (≈ 6 m/s) : foulée longue, genou très fléchi en phase aérienne, buste penché, bras qui battent ──
          var ampS = Math.min(1, v / 5.5), wS = ph, sw = s(wS);
          { var _a = A.cuisseG, _x = (-0.42 - 0.8 * sw) * ampS, _y = 0, _z = 0.05; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.cuisseD, _x = (-0.42 + 0.8 * sw) * ampS, _y = 0, _z = -0.05; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          var kG = Math.max(0, c(wS + 0.35)), kD = Math.max(0, c(wS + 0.35 + Math.PI));
          { var _a = A.tibiaG, _x = (0.3 + 1.75 * Math.pow(kG, 1.4) + 0.25 * Math.max(0, -c(wS + 0.35))) * ampS + 0.05, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.tibiaD, _x = (0.3 + 1.75 * Math.pow(kD, 1.4) + 0.25 * Math.max(0, c(wS + 0.35))) * ampS + 0.05, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.piedG, _x = 0.35 * s(wS + 0.9) * ampS, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.piedD, _x = -0.35 * s(wS + 0.9) * ampS, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.hanches, _x = 0, _y = sw * 0.16 * ampS, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.colonne, _x = 0.3 * ampS + 0.04 * s(wS * 2), _y = -sw * 0.14 * ampS, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.poitrine, _x = 0.2 * ampS, _y = -sw * 0.16 * ampS, _z = 0.04 * s(z.t * 3 + ph); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.cou, _x = -0.38 * ampS + 0.06 * s(z.t * 2.3 + ph), _y = 0.12 * s(z.t * 1.1 + ph), _z = 0.1 * s(z.t * 1.7); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.tete, _x = -0.22 * ampS, _y = 0.1 * s(z.t * 1.9 + ph), _z = 0.12 * s(z.t * 1.3); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.machoire, _x = 0.45 + 0.2 * s(z.t * 6.5 + ph), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.brasG, _x = (-0.35 + 0.95 * sw) * ampS + 0.12 * s(z.t * 5.3 + ph), _y = 0.1, _z = -0.22; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.brasD, _x = (-0.35 - 0.95 * sw) * ampS + 0.12 * s(z.t * 4.7 + ph * 1.3), _y = -0.1, _z = 0.22; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.avantBrasG, _x = -1.25 - 0.3 * sw * ampS, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.avantBrasD, _x = -1.25 + 0.3 * sw * ampS, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.mainG, _x = 0.4, _y = 0, _z = 0.25; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.mainD, _x = 0.4, _y = 0, _z = -0.25; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          y0 = (0.045 * Math.abs(c(wS)) - 0.02) * ampS;
          rollRacine = U.clamp(-(z.virage || 0) * 0.07, -0.22, 0.22);
        } else {
          var amp = Math.min(1, v / (course ? 3.0 : 1.2));
          var w = ph;
          var boit = z.boiterie;
          // jambes
          { var _a = A.cuisseG, _x = -s(w) * (course ? 0.75 : 0.42) * amp - 0.05, _y = 0, _z = 0.03; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.cuisseD, _x = s(w) * (course ? 0.75 : 0.42) * amp * (1 - boit) - 0.05 + boit * 0.15, _y = 0, _z = -0.03 - boit * 0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.tibiaG, _x = Math.max(0, -c(w)) * (course ? 1.3 : 0.75) * amp + 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.tibiaD, _x = Math.max(0, c(w)) * (course ? 1.3 : 0.75) * amp * (1 - boit * 0.7) + 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.piedG, _x = s(w) * 0.25 * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.piedD, _x = -s(w) * 0.25 * amp, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          // torse penché, balancement
          var pench = course ? 0.42 : 0.22;
          { var _a = A.hanches, _x = 0, _y = s(w) * 0.12 * amp, _z = s(w) * 0.05 * amp; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.colonne, _x = pench * 0.5 + 0.04 * s(w * 2) * amp, _y = -s(w) * 0.1 * amp, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.poitrine, _x = pench * 0.5, _y = -s(w) * 0.12 * amp, _z = s(w * 0.5 + 1) * 0.05; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.cou, _x = -0.15 + 0.08 * s(z.t * 1.7 + ph), _y = 0.2 * s(z.t * 0.7 + ph), _z = 0.25 * s(z.t * 0.9 + ph * 2) * (course ? 0.3 : 1); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.tete, _x = -0.1, _y = 0.15 * s(z.t * 1.3 + ph), _z = 0.2 * s(z.t * 0.8); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.machoire, _x = 0.25 + 0.15 * s(z.t * 3.1 + ph), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          // bras tendus vers l'avant (marche) ou balancés (course)
          if (course) {
            { var _a = A.brasG, _x = -0.3 + s(w) * 0.6, _y = 0, _z = -0.25; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.brasD, _x = -0.3 - s(w) * 0.6, _y = 0, _z = 0.25; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = A.avantBrasG, _x = -1.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.avantBrasD, _x = -1.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          } else {
            { var _a = A.brasG, _x = -1.15 + 0.12 * s(z.t * 1.4 + ph) + s(w) * 0.1 * amp, _y = 0.15, _z = -0.12; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = A.brasD, _x = -1.0 + 0.12 * s(z.t * 1.2 + ph + 1) - s(w) * 0.1 * amp, _y = -0.15, _z = 0.12; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
            { var _a = A.avantBrasG, _x = -0.35 - 0.1 * s(z.t * 2 + ph), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.avantBrasD, _x = -0.5 - 0.12 * s(z.t * 1.7 + ph), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          }
          { var _a = A.mainG, _x = 0.3, _y = 0, _z = 0.2; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.mainD, _x = 0.3, _y = 0, _z = -0.2; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          y0 = (Math.abs(c(w)) - 0.6) * 0.03 * amp;
        }
        if (z.etat === 'attaque') {
          var at = z.attaqueT * (z.agressif ? 1.1 / 0.72 : 1), k1 = U.smooth(0, 0.45, at), k2 = U.smooth(0.45, 0.62, at), k3 = U.smooth(0.75, 1.1, at);
          var lev = k1 * (1 - k2), frappe = k2 * (1 - k3);
          var bg = A.brasG[0], bd = A.brasD[0];
          { var _a = A.brasG, _x = U.lerp(bg, -2.5, lev) + frappe * 1.6 - lev * 0, _y = 0.2, _z = -0.2; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.brasD, _x = U.lerp(bd, -2.4, lev) + frappe * 1.5, _y = -0.2, _z = 0.2; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.avantBrasG, _x = -0.6 * lev - 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.avantBrasD, _x = -0.6 * lev - 0.1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.colonne, _x = A.colonne[0] - 0.25 * lev + 0.5 * frappe, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.poitrine, _x = A.poitrine[0] - 0.15 * lev + 0.3 * frappe, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.machoire, _x = 0.5 * lev + 0.6 * frappe, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        }
        if (z.etat === 'chute') { y0 = Math.max(0, z.hauteur); }
      } else if (z.etat === 'emergence' || z.etat === 'breche') {
        var D = z.dureeSortie || (z.etat === 'emergence' ? 1.7 : 1.9), k = U.clamp(t / D, 0, 1);
        var sortie = U.smooth(0.0, 0.85, k);
        y0 = -1.65 * (1 - sortie);
        var bras1 = U.smooth(0.0, 0.25, k) * (1 - U.smooth(0.6, 1.0, k));
        { var _a = A.brasG, _x = -2.6 * bras1 - 0.6 * (1 - bras1) * (1 - k), _y = 0.2, _z = -0.3 * bras1; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.brasD, _x = -2.2 * bras1 + 0.3 * U.smooth(0.15, 0.3, k), _y = -0.2, _z = 0.3 * bras1; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.avantBrasG, _x = -0.4 * bras1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.avantBrasD, _x = -0.8 * bras1, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.colonne, _x = 0.6 * (1 - k) + 0.1, _y = 0.2 * s(t * 6) * (1 - k), _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.poitrine, _x = 0.4 * (1 - k), _y = 0, _z = 0.15 * s(t * 5) * (1 - k); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.cou, _x = -0.3 * (1 - k), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tete, _x = 0.3 * s(t * 4) * (1 - k), _y = 0.3 * s(t * 3), _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.cuisseG, _x = -1.2 * (1 - k), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tibiaG, _x = 1.5 * (1 - k), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.cuisseD, _x = -0.6 * (1 - k), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tibiaD, _x = 1.0 * (1 - k), _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.machoire, _x = 0.6, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
      } else if (z.etat === 'saisie' || z.etat === 'extraction') {
        var ks = U.smooth(0, 0.6, z.etat === 'saisie' ? t : 1);
        z.hauteur = U.lerp(z.hauteur, 0.45 + 0.05 * s(t * 3), Math.min(1, dt * 4));
        var lutte = z.etat === 'saisie' ? 1 : 0, ex = z.etat === 'extraction' ? U.smooth(0, 0.35, t) : 0;
        var f = 14 + 6 * s(t * 2);
        { var _a = A.brasG, _x = -1.6 * lutte + 0.6 * s(t * f) * lutte - (-0.6) * ex + 0.5 * ex, _y = 0.3 * s(t * f * 0.7), _z = -0.6 * ex - 0.3 * lutte; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.brasD, _x = -1.4 * lutte + 0.6 * s(t * f + 1.5) * lutte + 1.1 * ex, _y = -0.3 * s(t * f * 0.8), _z = 0.6 * ex + 0.3 * lutte; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.avantBrasG, _x = -0.8 * lutte + 0.4 * s(t * f * 1.3) * lutte, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.avantBrasD, _x = -0.7 * lutte + 0.4 * s(t * f * 1.1 + 2) * lutte, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.colonne, _x = -0.25 * ks - 0.35 * ex + 0.08 * s(t * f) * lutte, _y = 0.25 * s(t * 5) * lutte, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.poitrine, _x = -0.15 * ks - 0.35 * ex, _y = 0.15 * s(t * 7) * lutte, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.cou, _x = -0.5 * ex + 0.2 * s(t * 9) * lutte, _y = 0.4 * s(t * 6) * lutte, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.tete, _x = -0.5 * ex + 0.3 * s(t * 11) * lutte, _y = 0.3 * s(t * 8) * lutte, _z = 0.2 * s(t * 5); _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.machoire, _x = 0.4 + 0.5 * ex + 0.3 * s(t * 13) * lutte, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.cuisseG, _x = -0.3 + 0.5 * s(t * f * 0.9) * lutte, _y = 0, _z = 0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.cuisseD, _x = -0.2 - 0.5 * s(t * f * 0.9) * lutte, _y = 0, _z = -0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.tibiaG, _x = 0.6 + 0.4 * s(t * f) * lutte, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tibiaD, _x = 0.5 + 0.4 * s(t * f + 1) * lutte, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        { var _a = A.piedG, _x = 0.6, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.piedD, _x = 0.6, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
        y0 = z.hauteur;
        if (ex > 0) { var tr = 0.012 * ex; z.racineOs.position.x = (alea() - 0.5) * tr; z.racineOs.position.z = (alea() - 0.5) * tr; }
        if (z.mat !== matBase) z.mat.userData.u.uLueur.value = 0.25 * ex * (0.6 + 0.4 * s(t * 30));
      } else if (z.etat === 'mort' || z.etat === 'absorbe' || z.etat === 'cendres') {
        var kc = U.smooth(0, z.etat === 'cendres' ? 0.9 : 0.7, t);
        var avant = z.etat === 'mort' ? z.chuteAvant : z.etat === 'absorbe';
        if (z.etat === 'cendres') {
          // brûle debout puis s'affaisse sur les genoux
          { var _a = A.colonne, _x = 0.6 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.poitrine, _x = 0.3 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.cou, _x = 0.4 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.cuisseG, _x = -1.4 * kc, _y = 0, _z = 0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.cuisseD, _x = -1.3 * kc, _y = 0, _z = -0.1; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tibiaG, _x = 2.2 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tibiaD, _x = 2.1 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.brasG, _x = -0.4 * kc + 0.2 * s(t * 20) * (1 - kc), _y = 0, _z = -0.3; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.brasD, _x = -0.3 * kc + 0.2 * s(t * 18) * (1 - kc), _y = 0, _z = 0.3; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.machoire, _x = 0.8, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          y0 = -0.5 * kc;
        } else {
          pitchRacine = (avant ? 1 : -1) * 1.45 * kc;
          { var _a = A.colonne, _x = (avant ? 0.2 : -0.2) * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.cou, _x = (avant ? 0.3 : -0.4) * kc, _y = 0.5 * kc, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.brasG, _x = (avant ? -2.6 : -0.6) * kc, _y = 0, _z = -0.5 * kc; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.brasD, _x = (avant ? -0.8 : -2.4) * kc, _y = 0, _z = 0.6 * kc; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.cuisseG, _x = -0.3 * kc, _y = 0, _z = 0.2 * kc; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tibiaG, _x = 0.6 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.cuisseD, _x = 0.1 * kc, _y = 0, _z = -0.1 * kc; _a[0] = _x; _a[1] = _y; _a[2] = _z; } { var _a = A.tibiaD, _x = 0.2 * kc, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          { var _a = A.machoire, _x = 0.5, _y = 0, _z = 0; _a[0] = _x; _a[1] = _y; _a[2] = _z; }
          var hauteurDepart = z.hauteur || 0;
          y0 = U.lerp(hauteurDepart, 0, U.smooth(0, 0.5, t)) + 0.16 * kc;
          z.hauteur = Math.max(0, hauteurDepart - dt * 2.5);
        }
      }
      // réaction aux balles (additive)
      if (reac > 0) { A.colonne[0] -= 0.25 * reac; A.tete[0] -= 0.3 * reac; A.poitrine[1] += 0.2 * reac * (z.idx % 2 ? 1 : -1); }
      for (var ib = 0; ib < NOMS_OS.length; ib++) { var nb = NOMS_OS[ib], ab = A[nb]; _e.set(ab[0], ab[1], ab[2], 'XYZ'); _q.setFromEuler(_e); z.os[nb].quaternion.copy(z.rest[nb]).multiply(_q); }
      z.racineOs.position.y = y0;
      if (z.etat !== 'extraction') { z.racineOs.position.x = 0; z.racineOs.position.z = 0; }
      // bascule du corps entier autour des pieds (chute)
      z.racineOs.rotation.set(pitchRacine, 0, rollRacine);
      if (pitchRacine !== 0) { z.racineOs.position.z = -Math.sin(pitchRacine) * 0.95 * 0; }
      z.groupe.position.set(z.position.x, z.position.y, z.position.z);
      z.groupe.rotation.y = z.lacet;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    // Mise à jour (IA + effets)
    // ════════════════════════════════════════════════════════════════════════════════════════
    var _dir = { x: 0, z: 0 }, _pos = { x: 0, z: 0 }, _vers = { x: 0, z: 0 };
    Z.mettreAJour = function (dt, temps, joueurs) {
      joueurs = joueurs || [];
      for (var k = 0; k < pool.length; k++) {
        var z = pool[k];
        if (!z.actif) continue;
        z.t += dt;
        z.reaction = Math.max(0, (z.reaction || 0) - dt * 5);
        if (z.etat === 'emergence' || z.etat === 'breche') {
          var D = z.dureeSortie || (z.etat === 'emergence' ? 1.7 : 1.9);
          if (alea() < dt * 20 && z.t < D * 0.8) projeter(terrePour(z.lieu), z.position.x, 0.05, z.position.z, 2, 1.6, 0.5, 0.4);
          if (z.t >= D) { z.etat = 'marche'; z.t = 0; }
        } else if (z.etat === 'saisie' || z.etat === 'extraction') {
          z.vitesse.set(0, 0, 0);
        } else if (z.etat === 'chute') {
          z.hauteur = Math.max(0, z.hauteur - dt * 3);
          if (z.hauteur <= 0) { z.etat = 'marche'; z.t = 0; }
        } else if (z.etat === 'mort') {
          if (z.t > 2.2) { if (z.mat === matBase) { z.mat = prendreMat(); z.mesh.material = z.mat; } z.mat.userData.u.uDissolution.value = U.clamp((z.t - 2.2) / 1.2, 0, 1); }
          if (z.t > 3.5) liberer(z);
        } else if (z.etat === 'absorbe') {
          // s'effondre, se dessèche, s'effrite
          var u = z.mat.userData.u;
          u.uDesseche.value = U.clamp(z.t / 0.9, 0, 1);
          u.uDissolution.value = U.clamp((z.t - 0.9) / 1.1, 0, 1);
          z.groupe.scale.y = 1 - 0.06 * U.clamp(z.t / 0.9, 0, 1);
          if (z.t > 0.9 && alea() < dt * 30) projeter(terrePour(z.lieu), z.position.x + (alea() - 0.5) * 0.6, 0.2 + alea() * 0.4, z.position.z + (alea() - 0.5) * 0.6, 2, 0.5, 0.3, 0.6);
          if (z.t > 2.1) { decal(z.position.x, z.position.z, z.lieu, 5, 0.7, [0.6, 0.55, 0.5]); liberer(z); }
        } else if (z.etat === 'cendres') {
          var u2 = z.mat.userData.u;
          u2.uBrulure.value = U.clamp(z.t / 0.5, 0, 1);
          u2.uDesseche.value = U.clamp(z.t / 0.8, 0, 1) * 0.8;
          u2.uDissolution.value = U.clamp((z.t - 0.45) / 1.0, 0, 1);
          if (alea() < dt * 60) projeter(braisesPour(z.lieu), z.position.x + (alea() - 0.5) * 0.5, 0.2 + alea() * 1.4 * (1 - u2.uDissolution.value), z.position.z + (alea() - 0.5) * 0.5, 2, 1.2, 0.2, 0.5);
          if (z.t > 1.5) { decal(z.position.x, z.position.z, z.lieu, 7, 0.8, [0.45, 0.42, 0.4]); liberer(z); }
        } else {
          // ── IA : cible = joueur vivant le plus proche dans le même lieu ──
          var cible = null, bd = 1e9;
          for (var q = 0; q < joueurs.length; q++) {
            var j = joueurs[q];
            if (!j.vivant || j.lieu !== z.lieu) continue;
            var dd = h2(j.position.x - z.position.x, j.position.z - z.position.z);
            if (dd < bd) { bd = dd; cible = j; }
          }
          z.cible = cible;
          var vise = z.lacet, AG = z.agressif;
          if (cible) {
            var vers = _vers; vers.x = cible.position.x - z.position.x; vers.z = cible.position.z - z.position.z;
            if (z.etat === 'attaque') {
              // agressifs : coup plus rapide, plus fréquent, et ils continuent d'avancer (fente) pendant l'élan
              var dureeA = AG ? 0.72 : 1.1, frappeA = AG ? 0.33 : 0.55;
              z.attaqueT += dt;
              if (!z.attaqueFrappee && z.attaqueT >= frappeA) {
                z.attaqueFrappee = true;
                var dn = h2(vers.x, vers.z), dot = (vers.x * Math.sin(z.lacet) + vers.z * Math.cos(z.lacet)) / (dn || 1);
                if (dn < (AG ? 1.7 : 1.55) && dot > (AG ? 0.2 : 0.3)) surAttaque(z, cible.id);
              }
              if (z.attaqueT >= dureeA) { z.etat = 'marche'; z.attente = AG ? 0.08 : 0.15; }
              if (AG && bd > 0.8) {
                var vL = Math.min(2.4, (bd - 0.6) * 2.2);
                z.vitesse.x += (vers.x / bd * vL - z.vitesse.x) * Math.min(1, dt * 8); z.vitesse.z += (vers.z / bd * vL - z.vitesse.z) * Math.min(1, dt * 8);
              } else z.vitesse.multiplyScalar(Math.max(0, 1 - dt * 8));
              vise = Math.atan2(vers.x, vers.z);
            } else {
              // ligne droite si elle est praticable pour un agent (grille), sinon champ de flux
              var gz = monde && monde.grilles ? monde.grilles[z.lieu] : null;
              var direct = !monde || (bd < (gz ? 16 : 4) && (gz ? gz.lignePraticable(z.position.x, z.position.z, cible.position.x, cible.position.z) : monde.visible(z.position, cible.position, z.lieu)));
              if (direct) {
                var lat = z.decalage * 1.5 * U.clamp((bd - 2.5) / 6, 0, 1), ddx = vers.x - vers.z / (bd || 1) * lat, ddz = vers.z + vers.x / (bd || 1) * lat, dln = h2(ddx, ddz) || 1;
                _dir.x = ddx / dln; _dir.z = ddz / dln;
              }
              else { var ch = champPour(cible, temps); if (ch) ch.direction(z.position.x, z.position.z, _dir); else { _dir.x = vers.x / bd; _dir.z = vers.z / bd; } }
              // séparation entre zombies (renforcée à grande vitesse ; une passe positionnelle suit)
              var sx = 0, sz = 0;
              for (var r2 = 0; r2 < pool.length; r2++) {
                var a2 = pool[r2];
                if (a2 === z || !a2.actif || a2.lieu !== z.lieu) continue;
                var ex = z.position.x - a2.position.x, ez = z.position.z - a2.position.z, d2 = ex * ex + ez * ez;
                if (d2 < 0.81 && d2 > 1e-6) { var dl = Math.sqrt(d2); sx += ex / dl * (0.9 - dl); sz += ez / dl * (0.9 - dl); }
              }
              var fSep = 2.5 + z.vitesseMax * 0.6, vmax = z.vitesseMax;
              if (z.sprint) vmax *= U.clamp((bd - 0.7) / 1.6, 0.18, 1);       // freine juste avant le contact
              else if (bd < 1.0) vmax *= 0.2;
              var vx = _dir.x * vmax + sx * fSep, vz = _dir.z * vmax + sz * fSep;
              var kAcc = Math.min(1, dt * (z.sprint ? 7 : 5));
              z.vitesse.x += (vx - z.vitesse.x) * kAcc; z.vitesse.z += (vz - z.vitesse.z) * kAcc;
              vise = Math.atan2(vers.x * 0.5 + _dir.x, vers.z * 0.5 + _dir.z);
              z.attente -= dt;
              if (bd < (AG ? 1.45 : 1.35) && z.attente <= 0) { z.etat = 'attaque'; z.attaqueT = 0; z.attaqueFrappee = false; }
            }
          } else { z.vitesse.multiplyScalar(Math.max(0, 1 - dt * 3)); }
          var lacet0 = z.lacet;
          z.lacet += U.angleDiff(z.lacet, vise) * Math.min(1, dt * (z.sprint ? 8 : 6));
          z.virage += (U.angleDiff(lacet0, z.lacet) / Math.max(dt, 1e-4) - z.virage) * Math.min(1, dt * 6);
          // déplacement en sous-pas : à 6 m/s, pas de traversée des murs fins même à bas régime d'images
          var depl = h2(z.vitesse.x, z.vitesse.z) * dt, nSp = depl > 0.12 ? Math.min(5, Math.ceil(depl / 0.12)) : 1;
          for (var sp = 0; sp < nSp; sp++) {
            z.position.x += z.vitesse.x * dt / nSp; z.position.z += z.vitesse.z * dt / nSp;
            if (monde) { _pos.x = z.position.x; _pos.z = z.position.z; monde.resoudre(z.lieu, _pos, 0.3); z.position.x = _pos.x; z.position.z = _pos.z; }
          }
          z.phase += dt * h2(z.vitesse.x, z.vitesse.z) * (z.sprint ? 1.65 : z.course ? 2.6 : 3.4);
          // zombie bloqué : signalé (la logique du boss peut le remplacer)
          if (cible) { if (bd > z.derniereDist - 0.05) z.bloqueT += dt; else z.bloqueT = 0; z.derniereDist = bd; }
        }
        appliquerPose(z, dt);
      }
      for (var kc = 0; kc < chiens.length; kc++) if (chiens[kc].actif) majChien(chiens[kc], dt, temps, joueurs);
      for (var km = 0; km < mbs.length; km++) if (mbs[km].actif) { majMiniBoss(mbs[km], dt, temps, joueurs); if (mbs[km].actif) arcsDuFleau(mbs[km]); }
      finArcsFleau();
      majIrradies(dt, temps, joueurs);                                  // v1.5 : zombies, chiens et petits Démembrés irradiés
      majBrasObjets(dt, temps);                                        // v1.5 : bras arraché du géant (en main, en vol, posé, flétri)
      majProjections(dt);
      majFlaques(dt, joueurs);
      majBoules(dt, joueurs);
      majZones(dt);
      separer(joueurs);
      // particules et décalques
      for (var l = 0; l < listeTerres.length; l++) majParticules(listeTerres[l], dt, 9);
      for (var l2 = 0; l2 < listeBraises.length; l2++) majParticules(listeBraises[l2], dt, -1.5);
      for (var l3 = 0; l3 < listeEtincelles.length; l3++) majParticules(listeEtincelles[l3], dt, 9);
      for (var l4 = 0; l4 < listeSpores.length; l4++) majParticules(listeSpores[l4], dt, -0.25);
      for (var l5 = 0; l5 < listeVapeurs.length; l5++) majParticules(listeVapeurs[l5], dt, -0.5);
      for (var l6 = 0; l6 < listeCrepits.length; l6++) majParticules(listeCrepits[l6], dt, 2.5);
      for (var l7 = 0; l7 < listeSangs.length; l7++) majParticules(listeSangs[l7], dt, 9);
      for (var dd2 = 0; dd2 < NDC; dd2++) {
        var D2 = decals[dd2];
        if (!D2.mesh.visible) continue;
        D2.vie -= dt;
        D2.mesh.material.opacity = U.clamp(D2.vie / Math.min(1.5, D2.duree), 0, 1) * 0.9;
        if (D2.vie <= 0) D2.mesh.visible = false;
      }
    };
    // Séparation positionnelle : aucun recouvrement entre zombies (0,6 m) ni dans un joueur (0,55 m), quelle que soit la vitesse.
    function mobile(z) { return z.actif && (z.mb ? z.etat === 'actif' : z.type === 'chien' ? (z.etat === 'course' || z.etat === 'morsure' || z.etat === 'grogne') : (z.etat === 'marche' || z.etat === 'attaque')); }
    function separer(joueurs) { passeSeparation(joueurs); passeSeparation(joueurs); }   // 2 passes : tient dans les foules serrées contre un mur
    function passeSeparation(joueurs) {
      for (var a = 0; a < tous.length; a++) tous[a].pousse = false;
      for (var i = 0; i < tous.length; i++) {
        var A = tous[i];
        if (!mobile(A)) continue;
        var rA = SEP_R[i], mA = SEP_M[i];
        for (var k = i + 1; k < tous.length; k++) {
          var B = tous[k];
          if (!mobile(B) || B.lieu !== A.lieu) continue;
          var rAB = rA + SEP_R[k], ex = B.position.x - A.position.x, ez = B.position.z - A.position.z, d2 = ex * ex + ez * ez;
          if (d2 >= rAB * rAB) continue;
          var d = Math.sqrt(d2), mB = SEP_M[k], fA = mA / (mA + mB), fB = mB / (mA + mB);    // les mini-boss, massifs, bougent peu (le géant, presque pas)
          if (d < 1e-5) { ex = Math.cos(i * 2.4); ez = Math.sin(i * 2.4); d = 0; }
          else { ex /= d; ez /= d; }
          var ecart = rAB - d; A.position.x -= ex * ecart * fA; A.position.z -= ez * ecart * fA; B.position.x += ex * ecart * fB; B.position.z += ez * ecart * fB;
          A.pousse = B.pousse = true;
        }
        var rJ = A.mb ? rA + 0.3 : A.type === 'chien' ? 0.6 : 0.55;
        for (var q = 0; q < joueurs.length && A.mode !== 'chElan'; q++) {   // (le géant qui charge traverse : les joueurs sont projetés)
          var J = joueurs[q];
          if (!J.vivant || J.lieu !== A.lieu) continue;
          var jx = A.position.x - J.position.x, jz = A.position.z - J.position.z, dj = h2(jx, jz);
          if (dj < rJ && dj > 1e-5) { A.position.x = J.position.x + jx / dj * rJ; A.position.z = J.position.z + jz / dj * rJ; A.pousse = true; }
        }
      }
      for (var m = 0; m < tous.length; m++) {
        var Z1 = tous[m];
        if (!Z1.pousse) continue;
        if (monde) { _pos.x = Z1.position.x; _pos.z = Z1.position.z; monde.resoudre(Z1.lieu, _pos, COL_R[m]); Z1.position.x = _pos.x; Z1.position.z = _pos.z; }
        Z1.groupe.position.x = Z1.position.x; Z1.groupe.position.z = Z1.position.z;
      }
    }
    Z.bloques = function (seuil) { var r = []; for (var k = 0; k < pool.length; k++) if (Z.vivant(pool[k]) && pool[k].bloqueT > (seuil || 15)) r.push(pool[k].id); return r; };
    Z.reserve = pool;
    Z.reserveChiens = chiens;
    Z.PROFIL_CHIEN = PROFIL_CHIEN;
    Z.reserveMiniBoss = mbs;
    Z.PROFILS_MB = PROFILS_MB;
    /** Zones dangereuses des mini-boss (aura de l'Irradié, flaques toxiques) ajoutées à `out` (objets réutilisés) : [{ type: 'cercle', centre, rayon, lieu }]. */
    Z.dangersZone = function (out) {
      for (var k = 0; k < mbs.length; k++) {
        var m = mbs[k];
        if (m.type !== 'irradie' || !Z.vivant(m) || m.etat !== 'actif') continue;
        m.danger.centre.x = m.position.x; m.danger.centre.z = m.position.z; m.danger.rayon = m.profil.aura.rayon + 0.3; m.danger.lieu = m.lieu; out.push(m.danger);
      }
      for (var f = 0; f < flaques.length; f++) {
        var F0 = flaques[f]; if (!F0.actif) continue;
        F0.danger.centre.x = F0.x; F0.danger.centre.z = F0.z; F0.danger.rayon = F0.rayon + 0.2; F0.danger.lieu = F0.lieu; out.push(F0.danger);
      }
      // v1.5 : trajectoire d'une charge annoncée (préparation) ou en cours : ligne de `largeur` m (évitée par les coéquipiers)
      for (var kc = 0; kc < mbs.length; kc++) { var mc = mbs[kc]; if (mc.actif && mc.dangerCh.actif && mc.etat === 'actif') out.push(mc.dangerCh); }
      for (var lz = 0; lz < listeZonesLieux.length; lz++) {
        var LZ = listeZonesLieux[lz].liste;
        for (var kz = 0; kz < LZ.length; kz++) {
          var zr = LZ[kz]; if (zr.fin >= 0) continue;
          zr.danger.centre.x = zr.x; zr.danger.centre.z = zr.z; zr.danger.rayon = zr.rayon + 0.25; zr.danger.lieu = zr.lieu; out.push(zr.danger);
        }
      }
      return out;
    };
    Z.flaques = function () { var r = []; for (var k = 0; k < flaques.length; k++) if (flaques[k].actif) r.push({ x: flaques[k].x, z: flaques[k].z, lieu: flaques[k].lieu, rayon: flaques[k].rayon, restant: flaques[k].duree - flaques[k].t }); return r; };
    /** v1.4 : zones radioactives de l'Irradié (instantané) : [{ id, x, z, rayon, lieu, source (id de l'Irradié), extinction (s restantes ou null) }]. */
    Z.zones = function () {
      var r = [];
      for (var l = 0; l < listeZonesLieux.length; l++) { var L = listeZonesLieux[l].liste; for (var k = 0; k < L.length; k++) { var zr = L[k]; r.push({ id: zr.id, x: zr.x, z: zr.z, rayon: zr.rayon, lieu: zr.lieu, source: zr.owner ? zr.owner.id : null, extinction: zr.fin >= 0 ? zr.fin : null }); } }
      return r;
    };
    /** v1.4 : boules radioactives en vol : [{ x, y, z, cible: { x, z }, rayon, restant }]. */
    Z.boules = function () { var r = []; for (var k = 0; k < boules.length; k++) { var b = boules[k]; if (b.actif) r.push({ x: b.mesh.position.x, y: b.mesh.position.y, z: b.mesh.position.z, cible: { x: b.x1, z: b.z1 }, rayon: b.rayon, restant: b.duree - b.t }); } return r; };
    /** v1.5 : bras arrachés du Démembré géant : [{ etat: 'main' | 'vol' | 'pose' | 'fletri', position, proprietaire (id | null) }]. */
    Z.bras = function () { var r = []; for (var k = 0; k < brasObjets.length; k++) { var B = brasObjets[k]; if (B.actif) r.push({ etat: B.etat, position: { x: B.groupe.position.x, y: B.groupe.position.y, z: B.groupe.position.z }, proprietaire: B.owner ? B.owner.id : null }); } return r; };
    /** v1.5 : entités irradiées vivantes : [{ id, type, rayon, degatsParSeconde }]. */
    Z.irradies = function () { var r = []; for (var k = 0; k < tous.length; k++) { var q = tous[k]; if (q.actif && q.irrActif && Z.vivant(q)) r.push({ id: q.id, type: q.type, rayon: q.irrRayon, degatsParSeconde: q.irrDps }); } return r; };
    /** v1.4 : exposition d'un joueur aux zones d'un Irradié (secondes) ; 0 sinon. */
    Z.exposition = function (idIrradie, idJoueur) { var m = parId[idIrradie]; var e = m && m.expos ? m.expos[idJoueur] : null; return e ? e.expo : 0; };
    return Z;
  }

  var API = { creer: creer, OS: OS, modeleDormant: modeleDormant, modeleMiniBoss: modeleMiniBoss };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Zombies = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
