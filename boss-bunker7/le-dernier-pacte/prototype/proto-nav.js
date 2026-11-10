/*!
 * proto-nav.js — Navigation du prototype : grille 0,5 m par lieu, A* (8 voisins, sans couper les coins),
 * lissage par ligne de vue, champs de flux (Dijkstra) pour les hordes, ligne de vue (DDA), point libre le
 * plus proche. Aucune allocation pendant une recherche (tampons réutilisés). Global : ProtoB7Nav.
 */
(function (root) {
  'use strict';

  // tas binaire sur indices de cellules, clé = tableau de coûts partagé
  function Tas(capacite) {
    this.i = new Int32Array(capacite);
    this.k = new Float32Array(capacite);
    this.n = 0;
  }
  Tas.prototype.vider = function () { this.n = 0; };
  Tas.prototype.pousser = function (idx, cle) {
    var p = this.n++, I = this.i, K = this.k;
    while (p > 0) {
      var q = (p - 1) >> 1;
      if (K[q] <= cle) break;
      I[p] = I[q]; K[p] = K[q]; p = q;
    }
    I[p] = idx; K[p] = cle;
  };
  Tas.prototype.extraire = function () {
    var I = this.i, K = this.k, top = I[0];
    var n = --this.n;
    if (n > 0) {
      var di = I[n], dk = K[n], p = 0;
      for (;;) {
        var a = 2 * p + 1, b = a + 1, m = p, mk = dk;
        if (a < n && K[a] < mk) { m = a; mk = K[a]; }
        if (b < n && K[b] < mk) { m = b; mk = K[b]; }
        if (m === p) break;
        I[p] = I[m]; K[p] = K[m]; p = m;
      }
      I[p] = di; K[p] = dk;
    }
    return top;
  };

  var DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
  var CO = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

  /**
   * Grille d'un lieu. opts : { lieu, min:{x,z}, max:{x,z}, pas (0,5), rayonAgent (0,4) }.
   * Construction : grille.solide(x0,z0,x1,z1) / solideCercle / solideSi(fn), puis grille.finaliser().
   */
  function Grille(opts) {
    this.lieu = opts.lieu;
    this.pas = opts.pas || 0.5;
    this.x0 = opts.min.x; this.z0 = opts.min.z;
    this.nx = Math.ceil((opts.max.x - opts.min.x) / this.pas);
    this.nz = Math.ceil((opts.max.z - opts.min.z) / this.pas);
    var N = this.nx * this.nz;
    this.N = N;
    this.rayonAgent = opts.rayonAgent != null ? opts.rayonAgent : 0.4;
    this.sol = new Uint8Array(N);          // 1 = hors du sol (vide, extérieur)
    this.dur = new Uint8Array(N);          // 1 = obstacle physique (mur, pilier, meuble)
    this.opaque = new Uint8Array(N);       // 1 = bloque la vue (murs, piliers)
    this.bloque = new Uint8Array(N);       // résultat : 1 = non marchable pour l'agent
    this.distObs = new Float32Array(N);    // distance (m) à l'obstacle le plus proche
    // tampons A* / Dijkstra
    this.g = new Float32Array(N); this.gen = new Uint32Array(N); this.par = new Int32Array(N); this.ferme = new Uint32Array(N);
    this.generation = 1;
    this.tas = new Tas(N * 4 + 16);
    this._chemin = [];
    this.version = 0;                      // incrémentée à chaque finaliser() (les champs de flux se recalculent)
  }
  Grille.prototype.indice = function (x, z) {
    var ix = Math.floor((x - this.x0) / this.pas), iz = Math.floor((z - this.z0) / this.pas);
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return -1;
    return iz * this.nx + ix;
  };
  Grille.prototype.cx = function (i) { return this.x0 + ((i % this.nx) + 0.5) * this.pas; };
  Grille.prototype.cz = function (i) { return this.z0 + (Math.floor(i / this.nx) + 0.5) * this.pas; };
  Grille.prototype.horsSolSi = function (fn) {
    for (var i = 0; i < this.N; i++) if (fn(this.cx(i), this.cz(i))) { this.sol[i] = 1; this.opaque[i] = 1; }
  };
  Grille.prototype.solide = function (x0, z0, x1, z1, opaque) {
    var a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(z0, z1), d = Math.max(z0, z1);
    for (var z = c + this.pas * 0.5 * 0; z <= d; z += this.pas * 0.5) {
      for (var x = a; x <= b; x += this.pas * 0.5) {
        var i = this.indice(x, z);
        if (i >= 0) { this.dur[i] = 1; if (opaque) this.opaque[i] = 1; }
      }
    }
  };
  Grille.prototype.solideCercle = function (cx, cz, r, opaque) {
    for (var z = cz - r; z <= cz + r; z += this.pas * 0.5) {
      for (var x = cx - r; x <= cx + r; x += this.pas * 0.5) {
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > r * r) continue;
        var i = this.indice(x, z);
        if (i >= 0) { this.dur[i] = 1; if (opaque) this.opaque[i] = 1; }
      }
    }
  };
  /** Rectangle orienté (centre, demi-tailles, angle autour de Y). */
  Grille.prototype.solideBoite = function (cx, cz, hx, hz, ang, opaque) {
    var c = Math.cos(ang || 0), s = Math.sin(ang || 0), R = Math.hypot(hx, hz);
    for (var z = cz - R; z <= cz + R; z += this.pas * 0.5) {
      for (var x = cx - R; x <= cx + R; x += this.pas * 0.5) {
        var dx = x - cx, dz = z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) > hx || Math.abs(lz) > hz) continue;
        var i = this.indice(x, z);
        if (i >= 0) { this.dur[i] = 1; if (opaque) this.opaque[i] = 1; }
      }
    }
  };
  /** Efface les obstacles (garde le contour du sol) pour reconstruire la grille sur place (piliers détruits…). */
  Grille.prototype.effacerSolides = function () {
    this.dur.fill(0);
    this.opaque.set(this.sol);
    return this;
  };
  /** Calcule la distance aux obstacles (chanfrein 3-4) puis les cellules non marchables pour l'agent. */
  Grille.prototype.finaliser = function () {
    this.version++;
    var nx = this.nx, nz = this.nz, D = this.distObs, INF = 1e9, p = this.pas;
    for (var i = 0; i < this.N; i++) D[i] = (this.sol[i] || this.dur[i]) ? 0 : INF;
    var a = p, b = p * Math.SQRT2;
    for (var z = 0; z < nz; z++) for (var x = 0; x < nx; x++) {
      var k = z * nx + x, v = D[k];
      if (x > 0) v = Math.min(v, D[k - 1] + a);
      if (z > 0) { v = Math.min(v, D[k - nx] + a); if (x > 0) v = Math.min(v, D[k - nx - 1] + b); if (x < nx - 1) v = Math.min(v, D[k - nx + 1] + b); }
      D[k] = v;
    }
    for (var z2 = nz - 1; z2 >= 0; z2--) for (var x2 = nx - 1; x2 >= 0; x2--) {
      var k2 = z2 * nx + x2, v2 = D[k2];
      if (x2 < nx - 1) v2 = Math.min(v2, D[k2 + 1] + a);
      if (z2 < nz - 1) { v2 = Math.min(v2, D[k2 + nx] + a); if (x2 < nx - 1) v2 = Math.min(v2, D[k2 + nx + 1] + b); if (x2 > 0) v2 = Math.min(v2, D[k2 + nx - 1] + b); }
      D[k2] = v2;
    }
    // distance depuis le centre de la cellule jusqu'au BORD de l'obstacle ≈ D − pas/2
    for (var j = 0; j < this.N; j++) {
      var d = D[j] > 0 ? D[j] - p * 0.5 : 0;
      this.distObs[j] = Math.max(0, d);
      this.bloque[j] = (this.sol[j] || this.dur[j] || d < this.rayonAgent) ? 1 : 0;
    }
    return this;
  };
  Grille.prototype.libre = function (x, z) { var i = this.indice(x, z); return i >= 0 && !this.bloque[i]; };
  Grille.prototype.distanceObstacle = function (x, z) { var i = this.indice(x, z); return i < 0 ? 0 : this.distObs[i]; };

  /** Cellule libre la plus proche (recherche en anneaux), ou -1. */
  Grille.prototype.plusProcheLibreIndice = function (x, z, rayonMax) {
    var i0 = this.indice(x, z);
    if (i0 >= 0 && !this.bloque[i0]) return i0;
    var ix = Math.floor((x - this.x0) / this.pas), iz = Math.floor((z - this.z0) / this.pas);
    var R = Math.ceil((rayonMax || 8) / this.pas), best = -1, bestD = 1e9;
    for (var r = 1; r <= R; r++) {
      for (var dz = -r; dz <= r; dz++) for (var dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        var cx = ix + dx, cz = iz + dz;
        if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) continue;
        var k = cz * this.nx + cx;
        if (this.bloque[k]) continue;
        var d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best >= 0) return best;
    }
    return -1;
  };
  Grille.prototype.plusProcheLibre = function (x, z, rayonMax) {
    var k = this.plusProcheLibreIndice(x, z, rayonMax);
    return k < 0 ? null : { x: this.cx(k), z: this.cz(k) };
  };

  // parcours DDA (Amanatides & Woo) : s'arrête sur la première cellule marquée 1 dans `tab` (aucune allocation)
  Grille.prototype._dda = function (ax, az, bx, bz, tab) {
    var p = this.pas, x = (ax - this.x0) / p, z = (az - this.z0) / p, X = (bx - this.x0) / p, Z = (bz - this.z0) / p;
    var ix = Math.floor(x), iz = Math.floor(z), ex = Math.floor(X), ez = Math.floor(Z);
    var dx = X - x, dz = Z - z;
    var sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    var tdx = dx !== 0 ? Math.abs(1 / dx) : 1e9, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e9;
    var tmx = dx !== 0 ? (dx > 0 ? (ix + 1 - x) : (x - ix)) * tdx : 1e9;
    var tmz = dz !== 0 ? (dz > 0 ? (iz + 1 - z) : (z - iz)) * tdz : 1e9;
    for (var n = 0; n < 4096; n++) {
      if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return true;
      if (tab[iz * this.nx + ix] === 1) return true;
      if (ix === ex && iz === ez) return false;
      if (tmx > 1 && tmz > 1) return false;          // fin du segment dans cette cellule (extrémité pile sur une arête de cellule)
      if (tmx < tmz) { tmx += tdx; ix += sx; } else { tmz += tdz; iz += sz; }
    }
    return false;
  };
  /** Ligne de vue (murs et piliers seulement). */
  Grille.prototype.visible = function (ax, az, bx, bz) {
    return !this._dda(ax, az, bx, bz, this.opaque);
  };
  /** Ligne praticable pour l'agent (toutes les cellules traversées libres). */
  Grille.prototype.lignePraticable = function (ax, az, bx, bz) {
    return !this._dda(ax, az, bx, bz, this.bloque);
  };

  /**
   * A* : renvoie un tableau de points {x, z} lissé (départ exclu, arrivée incluse), ou null.
   * Le tableau renvoyé est neuf (la logique du boss le garde) ; la recherche elle-même n'alloue rien.
   */
  Grille.prototype.astar = function (ax, az, bx, bz, maxIter) {
    var s = this.plusProcheLibreIndice(ax, az, 3), t = this.plusProcheLibreIndice(bx, bz, 6);
    if (s < 0 || t < 0) return null;
    var nx = this.nx, G = this.g, GEN = this.gen, PAR = this.par, FER = this.ferme, B = this.bloque;
    var gen = ++this.generation;
    var tas = this.tas; tas.vider();
    var tx = t % nx, tz = (t / nx) | 0;
    var h = function (i) { var dx = Math.abs(i % nx - tx), dz = Math.abs(((i / nx) | 0) - tz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    G[s] = 0; GEN[s] = gen; PAR[s] = -1;
    tas.pousser(s, h(s));
    var it = 0, max = maxIter || 60000, trouve = false;
    while (tas.n > 0 && it++ < max) {
      var c = tas.extraire();
      if (FER[c] === gen) continue;
      FER[c] = gen;
      if (c === t) { trouve = true; break; }
      var cx = c % nx, cz = (c / nx) | 0;
      for (var d = 0; d < 8; d++) {
        var x = cx + DX[d], z = cz + DZ[d];
        if (x < 0 || z < 0 || x >= nx || z >= this.nz) continue;
        var k = z * nx + x;
        if (B[k] || FER[k] === gen) continue;
        if (d >= 4 && (B[cz * nx + x] || B[z * nx + cx])) continue;       // pas de coin coupé
        var ng = G[c] + CO[d];
        if (GEN[k] !== gen || ng < G[k]) { GEN[k] = gen; G[k] = ng; PAR[k] = c; tas.pousser(k, ng + h(k)); }
      }
    }
    if (!trouve) return null;
    var brut = this._chemin; brut.length = 0;
    for (var q = t; q >= 0; q = PAR[q]) brut.push(q);
    brut.reverse();
    // lissage : on garde le point le plus lointain atteignable en ligne droite praticable
    var out = [], px = ax, pz = az, i0 = 0;
    while (i0 < brut.length - 1) {
      var j = brut.length - 1;
      while (j > i0 + 1 && !this.lignePraticable(px, pz, this.cx(brut[j]), this.cz(brut[j]))) j--;
      px = this.cx(brut[j]); pz = this.cz(brut[j]);
      out.push({ x: px, z: pz });
      i0 = j;
    }
    if (!out.length) out.push({ x: this.cx(t), z: this.cz(t) });
    // arrivée exacte si elle est praticable
    if (this.libre(bx, bz)) { out[out.length - 1] = { x: bx, z: bz }; }
    return out;
  };

  /** Champ de flux : distances (m) de chaque cellule à la cible (Dijkstra). Tampon fourni ou créé. */
  function Champ(grille) {
    this.grille = grille;
    this.dist = new Float32Array(grille.N);
    this.tas = new Tas(grille.N * 4 + 16);
    this.cible = { x: 0, z: 0 };
    this.valide = false;
    this.version = -1;                     // version de la grille au dernier calcul
  }
  Champ.prototype.calculer = function (x, z, distanceMax) {
    var Gd = this.grille, D = this.dist, B = Gd.bloque, nx = Gd.nx, nz = Gd.nz, p = Gd.pas;
    this.version = Gd.version;
    D.fill(1e9);
    var s = Gd.plusProcheLibreIndice(x, z, 4);
    this.cible.x = x; this.cible.z = z;
    if (s < 0) { this.valide = false; return this; }
    var tas = this.tas; tas.vider();
    D[s] = 0; tas.pousser(s, 0);
    var lim = distanceMax || 1e9;
    while (tas.n > 0) {
      var c = tas.extraire(), dc = D[c];
      if (dc > lim) break;
      var cx = c % nx, cz = (c / nx) | 0;
      for (var d = 0; d < 8; d++) {
        var X = cx + DX[d], Z = cz + DZ[d];
        if (X < 0 || Z < 0 || X >= nx || Z >= nz) continue;
        var k = Z * nx + X;
        if (B[k]) continue;
        if (d >= 4 && (B[cz * nx + X] || B[Z * nx + cx])) continue;
        var nd = dc + CO[d] * p;
        if (nd < D[k]) { D[k] = nd; tas.pousser(k, nd); }
      }
    }
    this.valide = true;
    return this;
  };
  /** Direction (sortie dans out {x, z}, normée) à suivre depuis (x, z) ; renvoie la distance restante. */
  Champ.prototype.direction = function (x, z, out) {
    var Gd = this.grille, i = Gd.indice(x, z);
    out.x = 0; out.z = 0;
    if (i < 0 || !this.valide) return 1e9;
    var D = this.dist, B = Gd.bloque, nx = Gd.nx, cx = i % nx, cz = (i / nx) | 0;
    if (B[i]) {                                   // sur une case bloquée (bord) : revenir vers le libre
      var k0 = Gd.plusProcheLibreIndice(x, z, 2);
      if (k0 >= 0) { out.x = Gd.cx(k0) - x; out.z = Gd.cz(k0) - z; var l0 = Math.hypot(out.x, out.z) || 1; out.x /= l0; out.z /= l0; return D[k0]; }
      return 1e9;
    }
    var best = D[i], bk = -1;
    for (var d = 0; d < 8; d++) {
      var X = cx + DX[d], Z = cz + DZ[d];
      if (X < 0 || Z < 0 || X >= nx || Z >= Gd.nz) continue;
      var k = Z * nx + X;
      if (B[k]) continue;
      if (d >= 4 && (B[cz * nx + X] || B[Z * nx + cx])) continue;
      if (D[k] < best) { best = D[k]; bk = k; }
    }
    if (bk < 0) { out.x = this.cible.x - x; out.z = this.cible.z - z; }
    else { out.x = Gd.cx(bk) - x; out.z = Gd.cz(bk) - z; }
    var l = Math.hypot(out.x, out.z) || 1;
    out.x /= l; out.z /= l;
    return D[i];
  };

  var API = { Grille: Grille, Champ: Champ, Tas: Tas };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Nav = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
