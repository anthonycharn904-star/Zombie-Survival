/*!
 * proto-monde.js — Monde du prototype : salle secrète du boss (d'après BOSS_B7_ARENE) et maquette de Bunker 7.
 * Deux scènes Three.js (salle, bunker), collisions 2D, grilles de navigation, dalles arrachables (API §8),
 * lumières animées, autel des récompenses. La maquette est décalée de +200 m en X (coordonnées sans ambiguïté).
 *
 *   const monde = ProtoB7Monde.creer(THREE, { arene: BOSS_B7_ARENE, renderer, qualite: 'haute', ombres: false });
 *   monde.scenes.salle / monde.scenes.bunker         scènes à rendre selon le lieu
 *   monde.mettreAJour(dt, temps)                     flammes, braises, scintillements, reconstruction
 *   monde.appliquerBlocs(etat.blocs, temps)          états des 24 dalles (API §8) ; monde.dalle(id) → Object3D
 *   monde.resoudre(lieu, pos, rayon)                 repousse un cercle (pos {x, z}) hors des obstacles
 *   monde.tir(lieu, origine, direction, max)         impact du décor { distance, point, normale, surface } | null
 *   monde.grilles[lieu]                              ProtoB7Nav.Grille (navigation, ligne de vue)
 *   monde.points.bunker / monde.points.salle         points d'arrivée, du boss, de retour, des zombies
 *   monde.ouvrirBreche(i)                            soulève la grille d'une brèche (sortie de zombie)
 *   monde.autel.deposer({ type, id, pap, joueur }) / monde.autel.retirer(objet)
 *   monde.appliquerTubes(etat.tubes, temps)         cuves vertes (v1.3, API §15.1) : intact | siphon | fissure | eclate ;
 *   monde.tubes, monde.tube(id), monde.etatTubes()   monde.emprunterLumiereTube(id | type) / monde.rendreLumiereTube(L)
 *   v1.4 (API §16.1) : autant de cuves que arene.salle.tubes (3 : tube2 au milieu du mur nord, Le Démembré endormi) ; tout est
 *   générique (câbles par cuve, dormeur par type de mini-boss, plaque N° et nom par type, une lumière par cuve) ; collision
 *   cercle rayon + 0,2 ; brèches lues dans les données (breche0 en (0, 11)) ; la cage passe à 327° (elle chevauchait l'autel) ;
 *   budget de la salle : 13 lumières ponctuelles (l'accent rouge le plus proche d'une cuve cède sa place).
 *   v1.5 (API §17.1) : chaque cuve suit sa taille (rayon, hauteur de arene : verre, socle, couvercle, tuyaux, plaque, lumière) ;
 *   la cuve géante (tube2 : r 1,3, h 4,4) abrite Le Démembré ×2 debout ; dormeur recentré à la remise à neuf.
 *   monde.distanceMur(lieu, x, z, out?) → distance au plan du mur de l'octogone le plus proche (out = sa normale sortante) ;
 *   après monde.resoudre(…) : monde.contactMur (un mur de la salle a repoussé le cercle) et monde.normaleMur { x, z }.
 * Global : ProtoB7Monde.
 */
(function (root) {
  'use strict';
  var U = root.ProtoB7Commun, NAV = root.ProtoB7Nav;
  var PI = Math.PI, TAU = PI * 2;
  // aléa rapide (xorshift32) pour les boucles par image : Math.random renvoie un nombre « emballé » (une allocation) à chaque appel
  var ALEA = new Int32Array(1); ALEA[0] = (Math.random() * 2147483647) | 0 || 0x5bd1e995;
  function alea() { var x = ALEA[0]; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; ALEA[0] = x; return (x >>> 0) / 4294967296; }
  function h2(a, b) { return Math.sqrt(a * a + b * b); }
  var OX_BUNKER = 200;                     // décalage de la maquette

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Accumulateur de géométrie par matériau (positions, normales, uv, couleurs) → BufferGeometry
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  function Accu() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  Accu.prototype.sommet = function (x, y, z, nx, ny, nz, u, v, c) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v);
    if (c) this.c.push(c[0], c[1], c[2]); else this.c.push(1, 1, 1);
    return this.p.length / 3 - 1;
  };
  /** Quadrilatère a, b, c, d (tableaux [x,y,z]) dans l'ordre trigonométrique vu depuis la normale. */
  Accu.prototype.quad = function (a, b, c, d, uv, col) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    var k = this.sommet(a[0], a[1], a[2], nx, ny, nz, uv[0], uv[1], col);
    this.sommet(b[0], b[1], b[2], nx, ny, nz, uv[2], uv[3], col);
    this.sommet(c[0], c[1], c[2], nx, ny, nz, uv[4], uv[5], col);
    this.sommet(d[0], d[1], d[2], nx, ny, nz, uv[6], uv[7], col);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  /** Ajoute une BufferGeometry (indexée ou non) transformée par une matrice Three.js. */
  Accu.prototype.geo = function (THREE, g, m, col, uvEchelle) {
    var gg = g.clone(); if (m) gg.applyMatrix4(m);
    if (typeof uvEchelle === 'number') U.uvMonde(gg, uvEchelle);
    else if (uvEchelle && gg.attributes.uv) { var uu = gg.attributes.uv.array; for (var q = 0; q < uu.length; q += 2) { uu[q] *= uvEchelle.u; uu[q + 1] *= uvEchelle.v; } }
    var P = gg.attributes.position.array, N = gg.attributes.normal.array, UV = gg.attributes.uv ? gg.attributes.uv.array : null;
    var base = this.p.length / 3, n = gg.attributes.position.count;
    for (var k = 0; k < n; k++) this.sommet(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], N[k * 3], N[k * 3 + 1], N[k * 3 + 2], UV ? UV[k * 2] : 0, UV ? UV[k * 2 + 1] : 0, col);
    if (gg.index) { var I = gg.index.array; for (var j = 0; j < I.length; j++) this.i.push(I[j] + base); }
    else for (var j2 = 0; j2 < n; j2++) this.i.push(base + j2);
    gg.dispose();
  };
  Accu.prototype.construire = function (THREE) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    var nv = this.p.length / 3;
    g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  Accu.prototype.vide = function () { return this.i.length === 0; };

  /**
   * Mandataires de tir : découpe un gros maillage fusionné en cellules de « taille » m (plan XZ) pour que
   * Raycaster ne teste que les cellules traversées (boîtes englobantes serrées). Invisibles, même matériau.
   */
  function decouperPourTir(THREE, me, parent, taille) {
    var g = me.geometry, P = g.attributes.position.array, I = g.index.array, cell = {}, cles = [];
    for (var t = 0; t < I.length; t += 3) {
      var a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      var cle = Math.floor((P[a] + P[b] + P[c]) / 3 / taille) + ',' + Math.floor((P[a + 2] + P[b + 2] + P[c + 2]) / 3 / taille);
      if (!cell[cle]) { cell[cle] = []; cles.push(cle); }
      cell[cle].push(I[t], I[t + 1], I[t + 2]);
    }
    var remap = new Int32Array(P.length / 3).fill(-1), out = [];
    cles.forEach(function (k) {
      var idx = cell[k], pos = [], ind = new Uint32Array(idx.length), utilises = [];
      for (var j = 0; j < idx.length; j++) {
        var v = idx[j];
        if (remap[v] < 0) { remap[v] = pos.length / 3; utilises.push(v); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); }
        ind[j] = remap[v];
      }
      for (var q = 0; q < utilises.length; q++) remap[utilises[q]] = -1;
      var gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.setIndex(new THREE.BufferAttribute(ind, 1));
      gg.computeBoundingSphere(); gg.computeBoundingBox();
      var px = new THREE.Mesh(gg, me.material);
      px.visible = false; px.userData.proxy = true; px.userData.source = me;
      px.position.copy(me.position); px.quaternion.copy(me.quaternion); px.scale.copy(me.scale);
      parent.add(px);
      out.push(px);
    });
    return out;
  }

  function M4(THREE) { return new THREE.Matrix4(); }
  function matTRS(THREE, x, y, z, rx, ry, rz, sx, sy, sz) {
    var m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ'));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));
    return m;
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Collisions 2D : segments (murs), cercles (piliers, fûts), boîtes orientées (meubles), octogone
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  function Collisions(min, max) {
    this.cell = 2.0;
    this.x0 = min.x; this.z0 = min.z;
    this.nx = Math.ceil((max.x - min.x) / this.cell) + 1; this.nz = Math.ceil((max.z - min.z) / this.cell) + 1;
    this.seaux = new Array(this.nx * this.nz);
    for (var i = 0; i < this.seaux.length; i++) this.seaux[i] = [];
    this.prims = [];
    this.plans = [];                          // demi-espaces globaux (octogone de la salle) : {nx, nz, d}
  }
  Collisions.prototype._inserer = function (p, x0, z0, x1, z1) {
    var m = 0.8;
    var a = Math.max(0, Math.floor((x0 - m - this.x0) / this.cell)), b = Math.min(this.nx - 1, Math.floor((x1 + m - this.x0) / this.cell));
    var c = Math.max(0, Math.floor((z0 - m - this.z0) / this.cell)), d = Math.min(this.nz - 1, Math.floor((z1 + m - this.z0) / this.cell));
    for (var z = c; z <= d; z++) for (var x = a; x <= b; x++) this.seaux[z * this.nx + x].push(p);
    this.prims.push(p);
  };
  Collisions.prototype.segment = function (ax, az, bx, bz) {
    var p = { t: 0, ax: ax, az: az, bx: bx, bz: bz };
    this._inserer(p, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
    return p;
  };
  Collisions.prototype.cercle = function (x, z, r) {
    var p = { t: 1, x: x, z: z, r: r };
    this._inserer(p, x - r, z - r, x + r, z + r);
    return p;
  };
  Collisions.prototype.boite = function (x, z, hx, hz, ang) {
    var p = { t: 2, x: x, z: z, hx: hx, hz: hz, c: Math.cos(ang || 0), s: Math.sin(ang || 0) };
    var R = h2(hx, hz);
    this._inserer(p, x - R, z - R, x + R, z + R);
    return p;
  };
  Collisions.prototype.plan = function (nx, nz, d) { this.plans.push({ nx: nx, nz: nz, d: d }); };
  /** Repousse le cercle (pos.x, pos.z, r). Renvoie true en cas de contact. */
  Collisions.prototype.resoudre = function (pos, r) {
    var contact = false;
    this.contactPlan = false;                 // v1.5 : un mur de l'octogone a-t-il repoussé le cercle ? (normale sortante du mur)
    for (var it = 0; it < 3; it++) {
      var bouge = false;
      for (var k = 0; k < this.plans.length; k++) {
        var P = this.plans[k], dd = pos.x * P.nx + pos.z * P.nz - (P.d - r);
        if (dd > 0) { pos.x -= P.nx * dd; pos.z -= P.nz * dd; bouge = true; this.contactPlan = true; this.planNx = P.nx; this.planNz = P.nz; }
      }
      var ix = Math.floor((pos.x - this.x0) / this.cell), iz = Math.floor((pos.z - this.z0) / this.cell);
      if (ix >= 0 && iz >= 0 && ix < this.nx && iz < this.nz) {
        var S = this.seaux[iz * this.nx + ix];
        for (var j = 0; j < S.length; j++) if (this._pousser(S[j], pos, r)) bouge = true;
      }
      if (!bouge) break;
      contact = true;
    }
    return contact;
  };
  Collisions.prototype._pousser = function (p, pos, r) {
    var dx, dz, d;
    if (p.t === 0) {
      var ex = p.bx - p.ax, ez = p.bz - p.az, l2 = ex * ex + ez * ez;
      var t = l2 > 0 ? ((pos.x - p.ax) * ex + (pos.z - p.az) * ez) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      dx = pos.x - (p.ax + ex * t); dz = pos.z - (p.az + ez * t); d = h2(dx, dz);
      if (d >= r) return false;
      if (d < 1e-6) { dx = -ez; dz = ex; d = h2(dx, dz) || 1; pos.x += dx / d * r; pos.z += dz / d * r; return true; }
      pos.x += dx / d * (r - d); pos.z += dz / d * (r - d);
      return true;
    }
    if (p.t === 1) {
      dx = pos.x - p.x; dz = pos.z - p.z; d = h2(dx, dz);
      var R = p.r + r;
      if (d >= R) return false;
      if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
      pos.x = p.x + dx / d * R; pos.z = p.z + dz / d * R;
      return true;
    }
    // boîte orientée : repère local
    dx = pos.x - p.x; dz = pos.z - p.z;
    var lx = dx * p.c - dz * p.s, lz = dx * p.s + dz * p.c;
    var cx = lx < -p.hx ? -p.hx : lx > p.hx ? p.hx : lx, cz = lz < -p.hz ? -p.hz : lz > p.hz ? p.hz : lz;
    var ox = lx - cx, oz = lz - cz;
    d = h2(ox, oz);
    if (d >= r) return false;
    if (d < 1e-6) {                       // centre dans la boîte : sortie par le côté le plus proche
      var px = p.hx - Math.abs(lx), pz = p.hz - Math.abs(lz);
      if (px < pz) { lx = (lx < 0 ? -1 : 1) * (p.hx + r); } else { lz = (lz < 0 ? -1 : 1) * (p.hz + r); }
    } else { lx = cx + ox / d * r; lz = cz + oz / d * r; }
    pos.x = p.x + lx * p.c + lz * p.s; pos.z = p.z - lx * p.s + lz * p.c;
    return true;
  };

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Création
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  function creer(THREE, opts) {
    opts = opts || {};
    var C = U.compat(THREE);
    var ARENE = opts.arene || root.BOSS_B7_ARENE;
    var haute = opts.qualite !== 'basse';
    var TX = haute ? 512 : 256;
    var monde = { THREE: THREE, compat: C, scenes: {}, grilles: {}, collisions: {}, points: {}, lumieres: { salle: [], bunker: [] }, solides: { salle: [], bunker: [] }, anime: [] };

    // ── matériaux ──
    var cache = {};
    function textures(cle, fab) { return cache[cle] || (cache[cle] = fab()); }
    function matStd(o) {
      var m = new THREE.MeshStandardMaterial({ roughness: o.rough != null ? o.rough : 0.9, metalness: o.metal || 0 });
      m.color = C.couleur(o.couleur != null ? o.couleur : 0xffffff);
      if (o.map) m.map = o.map;
      if (o.normal) { m.normalMap = o.normal; m.normalScale = new THREE.Vector2(o.nScale || 1, o.nScale || 1); }
      if (o.couleursSommets) m.vertexColors = true;
      if (o.emissive != null) { m.emissive = C.couleur(o.emissive); m.emissiveIntensity = o.emissiveIntensite != null ? o.emissiveIntensite : 1; }
      if (o.transparent) { m.transparent = true; m.opacity = o.opacite != null ? o.opacite : 1; m.depthWrite = !!o.depthWrite; }
      if (o.alphaMap) { m.alphaMap = o.alphaMap; m.transparent = true; m.depthWrite = false; }
      if (o.decal) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
      if (o.double) m.side = THREE.DoubleSide;
      return m;
    }
    var TP = textures('pierre', function () { return U.texPierre(TX, 11, { teinte: [0.25, 0.25, 0.25], rangs: 4, contraste: 0.55 }); });
    var TPD = textures('pierreDalle', function () { return U.texPierre(TX, 29, { teinte: [0.26, 0.255, 0.25], rangs: 2, mortier: 0.012, fissures: 4, relief: 8, contraste: 0.5 }); });
    var TPF = textures('pierreFine', function () { return U.texPierre(TX, 17, { teinte: [0.24, 0.235, 0.23], rangs: 6, mortier: 0.012, fissures: 3, relief: 7, contraste: 0.55 }); });
    var TD = textures('dalles', function () { return U.texDalles(TX, 23, { teinte: [0.2, 0.198, 0.195], cases: 4 }); });
    var TB = textures('beton', function () { return U.texBeton(TX, 37); });
    var TBs = textures('betonSol', function () { return U.texBeton(TX, 41, { teinte: [0.32, 0.315, 0.30], planches: 2, relief: 3 }); });
    var TM = textures('metal', function () { return U.texMetal(256, 5, [0.19, 0.205, 0.19]); });
    var TMr = textures('metalRouge', function () { return U.texMetal(256, 8, [0.30, 0.10, 0.08]); });
    var TW = textures('bois', function () { return U.texBois(256, 7); });
    var TC = textures('crasse', function () { return U.texCrasse(256, 3); });
    function T(cv, o) { return U.tex(THREE, C, cv, o); }
    var mat = {
      pierre: matStd({ map: T(TP.map), normal: T(TP.normal, { donnees: true }), couleur: 0xffffff, rough: 0.93, nScale: 1.0, couleursSommets: true }),
      pierreFine: matStd({ map: T(TPF.map), normal: T(TPF.normal, { donnees: true }), rough: 0.9, couleursSommets: true }),
      pierreDalle: matStd({ map: T(TPD.map), normal: T(TPD.normal, { donnees: true }), rough: 0.9, couleursSommets: true }),
      sol: matStd({ map: T(TD.map), normal: T(TD.normal, { donnees: true }), rough: 0.88, nScale: 0.8, couleursSommets: true }),
      beton: matStd({ map: T(TB.map), normal: T(TB.normal, { donnees: true }), rough: 0.95, couleursSommets: true }),
      betonSol: matStd({ map: T(TBs.map), normal: T(TBs.normal, { donnees: true }), rough: 0.9, couleursSommets: true }),
      fer: matStd({ map: T(TM.map), rough: 0.62, metal: 0.45, couleursSommets: true }),
      ferRouge: matStd({ map: T(TMr.map), rough: 0.7, metal: 0.3, couleursSommets: true }),
      bois: matStd({ map: T(TW.map), rough: 0.85, couleursSommets: true }),
      crasse: matStd({ map: T(TC.map), rough: 0.9, couleursSommets: true }),
      verre: matStd({ couleur: 0x9fb7b0, rough: 0.08, metal: 0.0, transparent: true, opacite: 0.22, double: true }),
      liquideVert: matStd({ couleur: 0x2f5a1a, emissive: 0x3f8a1c, emissiveIntensite: 0.9, rough: 0.2 }),
      liquideAmbre: matStd({ couleur: 0x6a3a0a, emissive: 0xa0560c, emissiveIntensite: 0.7, rough: 0.2 }),
      liquideRouge: matStd({ couleur: 0x3a0505, emissive: 0x6a0a06, emissiveIntensite: 0.5, rough: 0.25 }),
      noir: new THREE.MeshBasicMaterial({ color: 0x000000 }),
      lampe: new THREE.MeshBasicMaterial({ color: C.couleur(0xffd9a0) }),
      lampeRouge: new THREE.MeshBasicMaterial({ color: C.couleur(0xff3020) })
    };
    monde.materiaux = mat;

    // textures de décor : glyphes, anneau, fissures, flamme, braise, fosse
    var atlas = T(U.atlasGlyphes(512), { clamp: true });
    var anneau = T(U.anneauGlyphes(1024, 61, { nombre: 24 }), { clamp: true });
    var texFissures = T(dessinerFissures(512), { clamp: true });
    var texFlamme = T(dessinerFlamme(128), { clamp: true });
    var texBraise = T(dessinerPoint(64), { clamp: true });
    var texFosse = T(dessinerFosse(128), { clamp: true });
    monde.textures = { atlasGlyphes: atlas, anneau: anneau, fissures: texFissures, flamme: texFlamme, braise: texBraise };

    // ── animations du décor (flammes, braises, scintillements) ──
    var flammes = [];             // sprites
    var lumieresVacillantes = [];
    var braiseSystemes = [];

    var dalles = {}, fragments = null, fragInfo = [];
    var _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
    var vus = {};
    var objetsAutel = [];

    var piliers = {}, pilierListe = [];
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PILIERS DESTRUCTIBLES (v1.1, API §13) : intact → endommagé (fissures et éclats selon les coups)
    // → détruit (effondrement en tronçons ≈ 1,2 s, puis tas de gravats ; collision réduite au moignon,
    // grille de navigation reconstruite sur place, ligne de vue dégagée). Un retour à « intact » remet tout à neuf.
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    var GRAV_PILIER = 12;                                  // gravité stylisée des tronçons (m/s²)
    var R_FUT = 0.85, Y_BAGUE = 0.75, Y_CASSE_BAS = 1.05, Y_CASSE_HAUT = 8.45, Y_SOMMET = 10.2;
    var BORNES_TRONCONS = [Y_CASSE_BAS, 2.5, 3.95, 5.4, 6.9, Y_CASSE_HAUT];
    var NB_ECLATS = 14, GRAVATS_PAR_TRONCON = 8, NB_GRAVATS = 5 * GRAVATS_PAR_TRONCON + 6;
    var DUREE_EFFONDREMENT = 1.45;                         // au-delà : état final figé (plus aucun calcul)
    var COL_CASSURE = [1.12, 1.06, 1.0], N_FUT = 24;
    // cratères (rayon, profondeur selon le niveau de dégâts) et calques de fissures centrés dessus
    var CRATERES = [{ r: [0.5, 0.62], p: [0.15, 0.21] }, { r: [0, 0.72], p: [0, 0.25] }];
    var CALQUES = [{ dT: 2.3, h: 3.2 }, { dT: 2.6, h: 3.6 }];
    var FISSURES_PILIER = [0, 1].map(function (v) {
      var rC = CRATERES[v].r[1] + 0.02, aDemi = rC / R_FUT, hC = rC / 0.85;
      return { ex: aDemi / (CALQUES[v].dT / 2) * 128, ey: hC / CALQUES[v].h * 512 };
    });
    var partagePilier = null;

    function ressourcesPilier() {
      if (partagePilier) return partagePilier;
      // caillou facetté (icosaèdre déformé, sommets identiques déplacés de la même façon)
      var gc = new THREE.IcosahedronGeometry(1, 1);
      var Pc = gc.attributes.position.array;
      for (var i = 0; i < Pc.length; i += 3) {
        var x = Pc[i], y = Pc[i + 1], z = Pc[i + 2];
        var k = 0.7 + 0.55 * U.hash3(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40), 17);
        Pc[i] = x * k; Pc[i + 1] = y * k * 0.72; Pc[i + 2] = z * k;
      }
      gc.computeVertexNormals();
      var nc = gc.attributes.position.count, cc = new Float32Array(nc * 3);
      for (var j = 0; j < nc; j++) { var v = 0.72 + 0.26 * U.hash2(Math.floor(j / 3), 5, 9); cc[j * 3] = v; cc[j * 3 + 1] = v * 0.97; cc[j * 3 + 2] = v * 0.93; }
      gc.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      if (!gc.attributes.uv) gc.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nc * 2), 2));
      // calques de fissures (1 coup / 2 coups) : fissures sombres + cœur rougeoyant (carte d'émission)
      // calques de fissures (cratère A, cratère B) : fissures anguleuses qui partent du bord du cratère
      // (le centre reste transparent : le cratère est creusé dans la géométrie), cœur rougeoyant discret
      var mats = [0, 1].map(function (v) {
        var W = 256, H = 512, cv = U.canvas(W, H), g = cv.getContext('2d'), cl = U.canvas(W, H), gl = cl.getContext('2d');
        g.clearRect(0, 0, W, H); gl.fillStyle = '#000'; gl.fillRect(0, 0, W, H);
        g.lineCap = gl.lineCap = 'round'; g.lineJoin = gl.lineJoin = 'miter';
        var F = FISSURES_PILIER[v], ex = F.ex, ey = F.ey, cx = W / 2, cy = H / 2, nb = v ? 12 : 9;
        function branche(ctx, R, x, y, a, n, ep, prof) {
          var enfants = [];
          ctx.beginPath(); ctx.moveTo(x, y);
          for (var s2 = 0; s2 < n; s2++) {
            a += (R() - 0.5) * 0.42; if (R() < 0.12) a += (R() - 0.5) * 1.1;          // segments droits, cassures nettes
            var l = 6 + R() * 7; x += Math.cos(a) * l; y += Math.sin(a) * l;
            ctx.lineTo(x, y);
            if (prof < 2 && R() < 0.12) enfants.push([x, y, a + (R() < 0.5 ? -1 : 1) * R.entre(0.5, 1.1)]);
          }
          ctx.lineWidth = ep; ctx.stroke();
          for (var e = 0; e < enfants.length; e++) branche(ctx, R, enfants[e][0], enfants[e][1], enfants[e][2], Math.max(2, n * 0.5), ep * 0.62, prof + 1);
        }
        [[g, 'rgba(14,10,8,0.3)', v ? 13 : 10], [g, 'rgba(7,5,4,0.97)', v ? 5.5 : 4.2], [gl, 'rgb(255,140,80)', v ? 1.8 : 1.4]].forEach(function (ps) {
          var R = U.rng(5150 + v * 77);
          ps[0].strokeStyle = ps[1];
          for (var b2 = 0; b2 < nb; b2++) {
            var an = b2 / nb * TAU + R() * 0.5;
            branche(ps[0], R, cx + Math.cos(an) * ex * 0.92, cy + Math.sin(an) * ey * 0.92, an + (R() - 0.5) * 0.4, (v ? 9 : 6) + R() * 5, ps[2], 0);
          }
        });
        // rebord du cratère : liseré sombre, puis centre vidé (le creux est géométrique)
        g.strokeStyle = 'rgba(8,6,5,0.6)'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(cx, cy, ex * 1.02, ey * 1.02, 0, 0, TAU); g.stroke();
        g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
        g.beginPath(); g.ellipse(cx, cy, ex * 0.98, ey * 0.98, 0, 0, TAU); g.fill();
        g.globalCompositeOperation = 'source-over';
        gl.fillStyle = '#000'; gl.beginPath(); gl.ellipse(cx, cy, ex * 0.98, ey * 0.98, 0, 0, TAU); gl.fill();
        var m = new THREE.MeshStandardMaterial({ map: T(cv, { clamp: true }), emissiveMap: T(cl, { clamp: true }), transparent: true, depthWrite: false, roughness: 0.95,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        m.color = C.couleur(0xffffff); m.emissive = C.couleur(0xff4a1a); m.emissiveIntensity = 0.35;
        return m;
      });
      // tache de poussière au sol sous les gravats
      var ct = U.canvas(128, 128), gt = ct.getContext('2d'), rt = gt.createRadialGradient(64, 64, 4, 64, 64, 64);
      rt.addColorStop(0, 'rgba(36,32,28,0.9)'); rt.addColorStop(0.55, 'rgba(46,41,36,0.55)'); rt.addColorStop(1, 'rgba(50,45,40,0)');
      gt.fillStyle = rt; gt.fillRect(0, 0, 128, 128);
      var matCharbon = matStd({ couleur: 0x200804, emissive: 0xff4a10, emissiveIntensite: 1.2, rough: 1 });
      partagePilier = { caillou: gc, fissures: mats, tache: T(ct, { clamp: true }), charbon: matCharbon };
      return partagePilier;
    }
    /** Fût (anneaux lissés, uv continues en y monde) entre y0 et y1 ; options : jagBas/jagHaut, capBas/capHaut, decalY. */
    function futAccu(acc, y0, y1, o) {
      o = o || {};
      var r = o.r || R_FUT, col = o.col || [1, 1, 1], E = 2.5, dy = o.decalY || 0, jb = o.jagBas, jh = o.jagHaut;
      for (var k = 0; k < N_FUT; k++) {
        var a0 = k / N_FUT * TAU, a1 = (k + 1) / N_FUT * TAU;
        var s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1);
        var yb0 = y0 + (jb ? jb[k] : 0), yb1 = y0 + (jb ? jb[k + 1] : 0), yt0 = y1 + (jh ? jh[k] : 0), yt1 = y1 + (jh ? jh[k + 1] : 0);
        var u0 = a0 * r / E, u1 = a1 * r / E;
        var ia = acc.sommet(s0 * r, yb0 + dy, c0 * r, s0, 0, c0, u0, yb0 / E, col);
        acc.sommet(s1 * r, yb1 + dy, c1 * r, s1, 0, c1, u1, yb1 / E, col);
        acc.sommet(s1 * r, yt1 + dy, c1 * r, s1, 0, c1, u1, yt1 / E, col);
        acc.sommet(s0 * r, yt0 + dy, c0 * r, s0, 0, c0, u0, yt0 / E, col);
        acc.i.push(ia, ia + 1, ia + 2, ia, ia + 2, ia + 3);
      }
      [[o.capBas, y0, -1], [o.capHaut, y1, 1]].forEach(function (cp) {
        if (!cp[0]) return;
        var y = cp[1] + dy, ny = cp[2], ic = acc.sommet(0, y, 0, 0, ny, 0, 0, 0, COL_CASSURE);
        for (var q = 0; q <= N_FUT; q++) { var a = q / N_FUT * TAU; acc.sommet(Math.sin(a) * r, y, Math.cos(a) * r, 0, ny, 0, Math.sin(a) * r / E, Math.cos(a) * r / E, COL_CASSURE); }
        for (var q2 = 0; q2 < N_FUT; q2++) { if (ny > 0) acc.i.push(ic, ic + 1 + q2, ic + 2 + q2); else acc.i.push(ic, ic + 2 + q2, ic + 1 + q2); }
      });
    }
    /** Dentelure d'une cassure : N_FUT + 1 décalages en y (le dernier = le premier). */
    function dentelure(R, amp) {
      var f1 = R.entre(0, TAU), f2 = R.entre(0, TAU), out = [];
      for (var k = 0; k < N_FUT; k++) { var a = k / N_FUT * TAU; out.push(amp * (0.45 * Math.sin(2 * a + f1) + 0.3 * Math.sin(5 * a + f2) + 0.45 * (R() - 0.3))); }
      out.push(out[0]);
      return out;
    }
    function triangleAccu(acc, a, b, c, col) {
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      var k = acc.sommet(a[0], a[1], a[2], nx, ny, nz, a[0] / 2.5, a[2] / 2.5 + a[1] / 2.5, col);
      acc.sommet(b[0], b[1], b[2], nx, ny, nz, b[0] / 2.5, b[2] / 2.5 + b[1] / 2.5, col);
      acc.sommet(c[0], c[1], c[2], nx, ny, nz, c[0] / 2.5, c[2] / 2.5 + c[1] / 2.5, col);
      acc.i.push(k, k + 1, k + 2);
    }
    /** Surface de cassure déchiquetée (anneaux concentriques, normales par facette) ; sens +1 = regarde vers le haut. */
    function capDentele(acc, y, jag, sens, R) {
      var F = [1, 0.68, 0.36, 0], H = [];
      for (var a = 0; a < F.length; a++) {
        var row = [];
        for (var k = 0; k < N_FUT; k++) row.push(a === 0 ? jag[k] : sens * R.entre(-0.06, 0.26) * (a === 3 ? 0.6 : 1));
        row.push(row[0]); H.push(row);
      }
      function p(a, k) { var an = k / N_FUT * TAU, r = R_FUT * F[a]; return [Math.sin(an) * r, y + H[a][k], Math.cos(an) * r]; }
      for (var a2 = 0; a2 < F.length - 1; a2++) {
        for (var k2 = 0; k2 < N_FUT; k2++) {
          var o0 = p(a2, k2), o1 = p(a2, k2 + 1), i0 = p(a2 + 1, k2), i1 = p(a2 + 1, k2 + 1);
          if (sens > 0) { triangleAccu(acc, i0, o0, o1, COL_CASSURE); if (a2 < F.length - 2) triangleAccu(acc, i0, o1, i1, COL_CASSURE); }
          else { triangleAccu(acc, i0, o1, o0, COL_CASSURE); if (a2 < F.length - 2) triangleAccu(acc, i0, i1, o1, COL_CASSURE); }
        }
      }
    }
    function maillagePilier(acc, m, parent, solide) {
      var me = new THREE.Mesh(acc.construire(THREE), m);
      me.castShadow = true; me.receiveShadow = true;
      parent.add(me);
      if (solide) monde.solides.salle.push(me);
      return me;
    }

    function construirePilier(racine, pl, ip, colSombre, E) {
      var RS = ressourcesPilier();
      var id = pl.id != null ? pl.id : 'pilier' + ip, R = U.rng(7100 + ip * 131);
      var g = new THREE.Group(); g.name = id; g.position.set(pl.x, 0, pl.z); racine.add(g);
      var d0 = h2(pl.x, pl.z) || 1, ux = -pl.x / d0, uz = -pl.z / d0;
      var versCentre = Math.atan2(ux, uz), aChute = Math.atan2(-ux, -uz) + R.entre(-0.4, 0.4);
      var D = { x: Math.sin(aChute), z: Math.cos(aChute) }, L = { x: Math.cos(aChute), z: -Math.sin(aChute) };
      var P = { id: id, i: ip, x: pl.x, z: pl.z, groupe: g, etat: 'intact', coups: 0, final: false, D: D, L: L, R: R,
        angles: [0, 0], hauteurs: [R.entre(3.0, 4.3), R.entre(1.9, 3.1)] };
      var cote = R() < 0.5 ? -1 : 1;                                // dégâts sur les flancs, loin du brasero (côté centre)
      P.angles[0] = versCentre + cote * R.entre(0.8, 1.2); P.angles[1] = versCentre - cote * R.entre(0.95, 1.4);
      // socle (base + bague basse) : toujours en place
      var aS = new Accu();
      aS.geo(THREE, new THREE.CylinderGeometry(1.08, 1.12, 0.45, 24), matTRS(THREE, 0, 0.225, 0), colSombre, { u: TAU * 1.1 / E, v: 0.45 / E });
      aS.geo(THREE, new THREE.CylinderGeometry(0.98, 0.98, 0.3, 24), matTRS(THREE, 0, 0.6, 0), colSombre, { u: TAU / E, v: 0.3 / E });
      P.socle = maillagePilier(aS, mat.pierreFine, g, true);
      // fût intact d'un seul tenant (bague haute comprise)
      var aF = new Accu();
      futAccu(aF, Y_BAGUE, Y_SOMMET, {});
      aF.geo(THREE, new THREE.CylinderGeometry(0.98, 0.98, 0.3, 24), matTRS(THREE, 0, 7.25, 0), colSombre, { u: TAU / E, v: 0.3 / E });
      P.fut = maillagePilier(aF, mat.pierre, g, true);
      // fût endommagé : cratères creusés dans la géométrie (reconstruit selon les coups et les points d'impact)
      P.abimeGroupe = new THREE.Group(); P.abimeGroupe.visible = false; g.add(P.abimeGroupe);
      P.abime = new THREE.Mesh(new THREE.BufferGeometry(), mat.pierre); P.abime.castShadow = P.abime.receiveShadow = true;
      P.abimeGroupe.add(P.abime); monde.solides.salle.push(P.abime);
      var aBH = new Accu(); aBH.geo(THREE, new THREE.CylinderGeometry(0.98, 0.98, 0.3, 24), matTRS(THREE, 0, 7.25, 0), colSombre, { u: TAU / E, v: 0.3 / E });
      maillagePilier(aBH, mat.pierre, P.abimeGroupe, true);
      // version cassée : moignon bas (cassure déchiquetée) et chicot haut resté accroché à la voûte
      var jb = dentelure(R, 0.17), jh = dentelure(R, 0.22);
      var aM = new Accu(); futAccu(aM, Y_BAGUE, Y_CASSE_BAS, { jagHaut: jb }); capDentele(aM, Y_CASSE_BAS, jb, 1, R);
      P.moignon = maillagePilier(aM, mat.pierre, g, true); P.moignon.visible = false;
      var aH = new Accu(); futAccu(aH, Y_CASSE_HAUT, Y_SOMMET, { jagBas: jh }); capDentele(aH, Y_CASSE_HAUT, jh, -1, R);
      P.chicot = maillagePilier(aH, mat.pierre, g, true); P.chicot.visible = false;
      // tronçons qui tombent (le fût d'un seul tenant les remplace tant que le pilier tient)
      P.troncons = [];
      for (var k = 0; k < 5; k++) {
        var y0 = BORNES_TRONCONS[k], y1 = BORNES_TRONCONS[k + 1], yc = (y0 + y1) / 2, hh = (y1 - y0) / 2;
        var gt = new THREE.Group(); gt.position.set(0, yc, 0); g.add(gt);
        var aT = new Accu(); futAccu(aT, y0, y1, { decalY: -yc, capBas: true, capHaut: true });
        if (7.25 > y0 && 7.25 < y1) aT.geo(THREE, new THREE.CylinderGeometry(0.98, 0.98, 0.3, 24), matTRS(THREE, 0, 7.25 - yc, 0), colSombre, { u: TAU / E, v: 0.3 / E });
        var mt = maillagePilier(aT, mat.pierre, gt, true); mt.visible = false;
        var vf = k === 0 ? 2.1 : 0.45 + 0.3 * k + R.entre(-0.15, 0.15), vl = R.entre(-0.6, 0.6);
        var delai = k === 0 ? 0 : 0.03 + 0.045 * k, yPose = 0.2 + 0.09 * k;
        var chute = Math.max(0.25, yc - (yPose + hh * 0.55));
        P.troncons.push({ groupe: gt, mesh: mt, yc: yc, hh: hh, vf: vf, vl: vl, delai: delai, tPose: Math.sqrt(2 * chute / GRAV_PILIER),
          w: R.entre(1.8, 3.2) * (k === 0 ? -1 : 1), spin: R.entre(-1.4, 1.4) });
      }
      // brasero solidaire du tronçon du bas (il tombe avec lui) ; braises, flammes et lumière s'éteignent
      var T0 = P.troncons[0], yaw = Math.atan2(ux, uz), aB = new Accu();
      aB.geo(THREE, new THREE.BoxGeometry(0.08, 0.08, 0.55), matTRS(THREE, ux * 1.0, 2.25 - T0.yc, uz * 1.0, 0, yaw, 0), [0.6, 0.6, 0.6], 0.5);
      aB.geo(THREE, new THREE.BoxGeometry(0.06, 0.6, 0.06), matTRS(THREE, ux * 0.95, 1.95 - T0.yc, uz * 0.95, 0.6, yaw, 0), [0.6, 0.6, 0.6], 0.5);
      aB.geo(THREE, new THREE.LatheGeometry([new THREE.Vector2(0.02, -0.18), new THREE.Vector2(0.18, -0.16), new THREE.Vector2(0.32, -0.05), new THREE.Vector2(0.4, 0.1), new THREE.Vector2(0.37, 0.12), new THREE.Vector2(0.3, 0.0), new THREE.Vector2(0.02, -0.08)], 16),
        matTRS(THREE, ux * 1.25, 2.38 - T0.yc, uz * 1.25), [0.75, 0.7, 0.68], 0.5);
      P.brasero = maillagePilier(aB, mat.fer, T0.groupe, false);
      var charbon = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), RS.charbon);
      charbon.rotation.x = -PI / 2; charbon.position.set(ux * 1.25, 2.43 - T0.yc, uz * 1.25); T0.groupe.add(charbon);
      P.charbon = charbon;
      var bx = pl.x + ux * 1.25, bz = pl.z + uz * 1.25;
      P.flammes = flammeEn(racine, bx, 2.5, bz, 1.0, 3);
      P.braises = braisesEn(racine, bx, 2.5, bz, 0.25, 40);
      P.lumiere = lumiere(racine, 'salle', 0xff6a22, 85, 20, bx, 3.0, bz, 0.35);
      P.lumiereRepos = { x: bx, y: 3.0, z: bz };
      // braises éparpillées sur les gravats (le brasero tombe avec le tronçon du bas)
      P.braisesSol = new THREE.InstancedMesh(RS.caillou, RS.charbon, 7);
      P.braisesSol.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      P.braisesSol.visible = false; P.braisesSol.frustumCulled = false; g.add(P.braisesSol);
      // fissures (calque 1 coup, calque 2 coups)
      P.fissures = [0, 1].map(function (v) {
        var dT = CALQUES[v].dT, hF = CALQUES[v].h;
        var me = new THREE.Mesh(new THREE.CylinderGeometry(R_FUT + 0.012 + v * 0.004, R_FUT + 0.012 + v * 0.004, hF, 14, 1, true, -dT / 2, dT), RS.fissures[v]);
        me.visible = false; me.renderOrder = 2;
        g.add(me);
        return me;
      });
      // éclats tombés au pied du pilier (endommagé) puis gravats et tas (détruit)
      P.eclats = new THREE.InstancedMesh(RS.caillou, mat.pierre, NB_ECLATS);
      P.eclats.visible = false; P.eclats.frustumCulled = false; P.eclats.castShadow = P.eclats.receiveShadow = true; g.add(P.eclats);
      P.gravats = new THREE.InstancedMesh(RS.caillou, mat.pierre, NB_GRAVATS);
      P.gravats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      P.gravats.visible = false; P.gravats.frustumCulled = false; P.gravats.castShadow = P.gravats.receiveShadow = true; g.add(P.gravats);
      var gTas = new THREE.SphereGeometry(1, 20, 8, 0, TAU, 0, PI / 2), Pt = gTas.attributes.position.array, Ut = gTas.attributes.uv.array;
      for (var it = 0; it < Pt.length; it += 3) {
        var tx = Pt[it], ty = Pt[it + 1], tz = Pt[it + 2], kk = 0.82 + 0.3 * U.fbm2(Math.atan2(tx, tz) * 2.2 + 5, ty * 3.0, 31 + ip, 3);
        Pt[it] = tx * kk; Pt[it + 1] = ty * (0.8 + 0.4 * U.hash2(Math.round(tx * 9), Math.round(tz * 9), 3)); Pt[it + 2] = tz * kk;
      }
      for (var iu = 0; iu < Ut.length; iu += 2) { Ut[iu] *= 3.0; Ut[iu + 1] *= 0.8; }
      gTas.computeVertexNormals();
      var nT = gTas.attributes.position.count, cT = new Float32Array(nT * 3).fill(0.7);
      gTas.setAttribute('color', new THREE.BufferAttribute(cT, 3));
      P.tas = new THREE.Mesh(gTas, mat.pierre); P.tas.visible = false; P.tas.castShadow = P.tas.receiveShadow = true;
      P.tas.position.set(D.x * 0.75, 0, D.z * 0.75); g.add(P.tas); monde.solides.salle.push(P.tas);
      var mTache = new THREE.MeshBasicMaterial({ map: RS.tache, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      P.tache = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), mTache);
      P.tache.rotation.x = -PI / 2; P.tache.position.set(D.x * 1.3, 0.009, D.z * 1.3); P.tache.visible = false; g.add(P.tache);
      // positions finales des gravats (5 × 8 autour des points de chute des tronçons + 6 contre le moignon)
      P.infoGravats = [];
      for (var k2 = 0; k2 < 5; k2++) {
        var Tk = P.troncons[k2], tl = Tk.tPose;
        var lx = D.x * Tk.vf * tl + L.x * Tk.vl * tl, lz = D.z * Tk.vf * tl + L.z * Tk.vl * tl;
        for (var j = 0; j < GRAVATS_PAR_TRONCON; j++) {
          var an = R() * TAU, rr = Math.sqrt(R()) * (0.55 + 0.12 * k2), s = R.entre(0.14, 0.4) * (j < 2 ? 1.25 : 1);
          var gx = lx + Math.cos(an) * rr, gz = lz + Math.sin(an) * rr;
          P.infoGravats.push({ k: k2, x: gx, z: gz, s: s, sy: s * R.entre(0.55, 0.95), rx: R() * TAU, ry: R() * TAU, rz: R() * TAU });
        }
      }
      for (var j2 = 0; j2 < 6; j2++) {
        var an2 = j2 / 6 * TAU + R() * 0.6, rr2 = R.entre(1.05, 1.45), s2 = R.entre(0.16, 0.3);
        P.infoGravats.push({ k: 0, x: Math.sin(an2) * rr2, z: Math.cos(an2) * rr2, s: s2, sy: s2 * 0.7, rx: R() * TAU, ry: R() * TAU, rz: R() * TAU });
      }
      P.infoGravats.forEach(function (q) {                         // posés sur le tas (hauteur du dôme sous le caillou)
        var dx = q.x - P.tas.position.x, dz = q.z - P.tas.position.z, dd = h2(dx, dz) / 1.6;
        q.y = q.sy * 0.45 + (dd < 1 ? 0.5 * Math.sqrt(1 - dd * dd) * 0.85 : 0) + (h2(q.x, q.z) < 1.12 ? 0.42 : 0);
      });
      var T0p = P.troncons[0], tl0 = T0p.tPose;
      P.chute0 = { x: D.x * T0p.vf * tl0 + L.x * T0p.vl * tl0, z: D.z * T0p.vf * tl0 + L.z * T0p.vl * tl0 };
      P.infoBraises = [];
      for (var j3 = 0; j3 < 7; j3++) {
        var an3 = R() * TAU, rr3 = Math.sqrt(R()) * 0.6, s3 = R.entre(0.045, 0.09);
        P.infoBraises.push({ x: P.chute0.x + Math.cos(an3) * rr3, z: P.chute0.z + Math.sin(an3) * rr3, s: s3, rx: R() * TAU, ry: R() * TAU });
      }
      P.infoBraises.forEach(function (q) { var dx = q.x - P.tas.position.x, dz = q.z - P.tas.position.z, dd = h2(dx, dz) / 1.6; q.y = q.s * 0.5 + (dd < 1 ? 0.5 * Math.sqrt(1 - dd * dd) * 0.85 : 0) + 0.04; });
      placerEclats(P);
      piliers[id] = P; pilierListe.push(P);
      return P;
    }
    function placerEclats(P) {
      var R = U.rng(910 + P.i * 17), a0 = P.angles[0], a1 = P.angles[1];
      for (var i = 0; i < NB_ECLATS; i++) {
        var a = (i < 6 ? a0 : (i % 2 ? a1 : a0)) + R.entre(-0.75, 0.75), r = R.entre(1.18, 2.1), s = R.entre(0.05, 0.13);
        _v.set(Math.sin(a) * r, s * 0.5, Math.cos(a) * r);
        _e.set(R() * TAU, R() * TAU, R() * TAU, 'XYZ'); _q.setFromEuler(_e); _s.set(s, s * R.entre(0.6, 1), s);
        _m4.compose(_v, _q, _s); P.eclats.setMatrixAt(i, _m4);
      }
      P.eclats.instanceMatrix.needsUpdate = true;
    }
    /** Géométrie du fût endommagé : grille 48 × (pas 0,15 m) ; les cratères enfoncent la surface (pierre fraîche). */
    function futAbimeGeo(P, niv) {
      var NA = 48, y0 = Y_BAGUE, y1 = Y_SOMMET, pas = 0.15, NY = Math.ceil((y1 - y0) / pas), E = 2.5;
      var cr = [];
      for (var c = 0; c < 2; c++) if (CRATERES[c].r[niv - 1] > 0) cr.push({ a: P.angles[c], y: P.hauteurs[c], r: CRATERES[c].r[niv - 1], p: CRATERES[c].p[niv - 1], g: 11 + c + P.i * 7 });
      var nv = (NY + 1) * (NA + 1), pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), creux = new Uint8Array(nv);
      var v = 0;
      for (var j = 0; j <= NY; j++) {
        var y = Math.min(y1, y0 + j * pas);
        for (var k = 0; k <= NA; k++, v++) {
          var a = k / NA * TAU, enf = 0, frac = 0;
          for (var q = 0; q < cr.length; q++) {
            var C0 = cr[q], da = Math.atan2(Math.sin(a - C0.a), Math.cos(a - C0.a)), dd = h2(da * R_FUT, (y - C0.y) * 0.85) / C0.r;
            var bordDent = 1 + 0.16 * (U.hash2(Math.round(Math.atan2(y - C0.y, da) * 5), 3, C0.g) - 0.5);   // bord déchiqueté
            if (dd < bordDent) {
              var b = 0.45 + 0.9 * U.hash2(Math.round(a * 30), Math.round(y * 22), C0.g);
              var prof = C0.p * U.smooth(bordDent, bordDent * 0.62, dd) * (0.75 + 0.25 * b) + C0.p * 0.18 * (b - 0.5) * U.smooth(bordDent, 0.5, dd);
              if (prof > enf) enf = prof;
              frac = Math.max(frac, U.smooth(bordDent, bordDent * 0.8, dd));
            }
          }
          var r = R_FUT - enf;
          pos[v * 3] = Math.sin(a) * r; pos[v * 3 + 1] = y; pos[v * 3 + 2] = Math.cos(a) * r;
          var dec = enf > 0.012 ? 1 : 0;                                                   // la texture se casse dans l'éclat
          uv[v * 2] = a * R_FUT / E + dec * (0.37 + enf * 0.6); uv[v * 2 + 1] = y / E + dec * (0.23 + enf * 0.4);
          var sombre = 1 - 0.5 * Math.min(1, enf / 0.2);
          col[v * 3] = sombre * (1 + 0.1 * frac); col[v * 3 + 1] = sombre * (1 + 0.04 * frac); col[v * 3 + 2] = sombre * (1 - 0.04 * frac);
          creux[v] = enf > 0 ? 1 : 0;
        }
      }
      var idx = new (nv > 65535 ? Uint32Array : Uint16Array)(NY * NA * 6), n = 0;
      for (var j2 = 0; j2 < NY; j2++) for (var k2 = 0; k2 < NA; k2++) {
        var i0 = j2 * (NA + 1) + k2, i1 = i0 + 1, i2 = i0 + NA + 1, i3 = i2 + 1;
        idx[n++] = i0; idx[n++] = i1; idx[n++] = i3; idx[n++] = i0; idx[n++] = i3; idx[n++] = i2;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      var N = g.attributes.normal.array;                              // hors cratères : normales radiales exactes (pas de couture)
      for (var w = 0; w < nv; w++) if (!creux[w]) { var aa = (w % (NA + 1)) / NA * TAU; N[w * 3] = Math.sin(aa); N[w * 3 + 1] = 0; N[w * 3 + 2] = Math.cos(aa); }
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
    function majFutAbime(P) {
      var niv = Math.min(2, Math.max(1, P.coups));
      var cle = niv + ':' + P.angles[0].toFixed(3) + ':' + P.angles[1].toFixed(3) + ':' + P.hauteurs[0].toFixed(2) + ':' + P.hauteurs[1].toFixed(2);
      if (P.cleAbime === cle) return;
      P.cleAbime = cle;
      P.abime.geometry.dispose();
      P.abime.geometry = futAbimeGeo(P, niv);
    }
    function placerFissures(P) {
      for (var v = 0; v < 2; v++) { var f = P.fissures[v]; f.rotation.set(0, P.angles[v], 0); f.position.set(0, P.hauteurs[v], 0); }
    }
    function remettrePilierANeuf(P) {
      P.etat = 'intact'; P.coups = 0; P.final = false;
      P.fut.visible = true; P.abimeGroupe.visible = false; P.moignon.visible = false; P.chicot.visible = false;
      P.braisesSol.visible = false; P.lumiere.position.set(P.lumiereRepos.x, P.lumiereRepos.y, P.lumiereRepos.z);
      for (var k = 0; k < 5; k++) { var T = P.troncons[k]; T.mesh.visible = false; T.groupe.position.set(0, T.yc, 0); T.groupe.rotation.set(0, 0, 0); }
      P.brasero.visible = true; P.charbon.visible = true;
      P.flammes.forEach(function (f) { f.visible = true; });
      P.braises.pts.visible = true; P.lumiere.userData.extinction = 1;
      P.fissures[0].visible = P.fissures[1].visible = false;
      P.eclats.visible = false; P.gravats.visible = false; P.tas.visible = false; P.tache.visible = false;
      if (P.collision) P.collision.r = 1.12;
    }
    function endommagerPilier(P, coups) {
      P.etat = 'endommage'; P.coups = coups;
      majFutAbime(P);
      P.fut.visible = false; P.abimeGroupe.visible = true;
      placerFissures(P);
      P.fissures[0].visible = coups >= 1; P.fissures[1].visible = coups >= 2;
      P.eclats.count = coups >= 2 ? NB_ECLATS : 6; P.eclats.visible = coups >= 1;
    }
    function commencerEffondrement(P) {
      P.etat = 'detruit'; P.final = false;
      P.fut.visible = false; P.abimeGroupe.visible = false; P.moignon.visible = true; P.chicot.visible = true;
      for (var k = 0; k < 5; k++) P.troncons[k].mesh.visible = true;
      P.braisesSol.visible = true;
      P.fissures[0].visible = P.fissures[1].visible = false;
      P.charbon.visible = false;
      P.flammes.forEach(function (f) { f.visible = false; });
      P.braises.pts.visible = false;
      P.eclats.count = NB_ECLATS; P.eclats.visible = true;
      P.gravats.visible = true; P.tas.visible = true; P.tache.visible = true;
      if (P.collision) P.collision.r = 0.98;                       // il reste un moignon bas
    }
    /** Effondrement en fonction du temps t (s) depuis la destruction (fonction pure de t : un saut d'état est sûr). */
    function animerEffondrement(P, t) {
      var D = P.D, L = P.L, T0 = P.troncons[0], tl0 = T0.delai + T0.tPose;
      if (t < tl0) {
        var t0 = Math.max(0, t - T0.delai), dyL = -0.5 * GRAV_PILIER * t0 * t0;
        P.lumiere.position.set(P.lumiereRepos.x + D.x * T0.vf * t0 + L.x * T0.vl * t0, Math.max(0.5, P.lumiereRepos.y + dyL), P.lumiereRepos.z + D.z * T0.vf * t0 + L.z * T0.vl * t0);
        P.lumiere.userData.extinction = 1 - 0.5 * U.smooth(0, tl0, t);
      } else {
        P.lumiere.position.set(P.x + P.chute0.x, 0.55, P.z + P.chute0.z);  // braises répandues sur les gravats
        P.lumiere.userData.extinction = 0.42;
      }
      var fb = Math.min(1, Math.max(0, (t - tl0) / 0.12));
      for (var ib = 0; ib < P.infoBraises.length; ib++) {
        var qb = P.infoBraises[ib];
        _v.set(qb.x, qb.y, qb.z); _e.set(qb.rx, qb.ry, 0, 'XYZ'); _q.setFromEuler(_e); _s.set(qb.s * fb + 1e-4, qb.s * 0.7 * fb + 1e-4, qb.s * fb + 1e-4);
        _m4.compose(_v, _q, _s); P.braisesSol.setMatrixAt(ib, _m4);
      }
      P.braisesSol.instanceMatrix.needsUpdate = true;
      for (var k = 0; k < 5; k++) {
        var T = P.troncons[k], tk = Math.max(0, t - T.delai);
        if (tk >= T.tPose) { T.mesh.visible = false; if (k === 0) P.brasero.visible = false; continue; }
        T.mesh.visible = true; if (k === 0) P.brasero.visible = true;
        var y = T.yc - 0.5 * GRAV_PILIER * tk * tk;
        T.groupe.position.set(D.x * T.vf * tk + L.x * T.vl * tk, y, D.z * T.vf * tk + L.z * T.vl * tk);
        // bascule autour de l'axe latéral (le haut part vers D) + rotation propre
        _q.setFromAxisAngle(_axeL.set(L.x, 0, L.z), T.w * tk);
        _q2.setFromAxisAngle(_axeY, T.spin * tk);
        T.groupe.quaternion.copy(_q).multiply(_q2);
      }
      // gravats : chaque lot apparaît quand son tronçon touche le sol
      for (var i = 0; i < NB_GRAVATS; i++) {
        var q = P.infoGravats[i], Tq = P.troncons[q.k], tq = t - Tq.delai - Tq.tPose;
        var f = i >= 5 * GRAVATS_PAR_TRONCON ? U.smooth(0.15, 0.45, t) : (tq <= 0 ? 0 : Math.min(1, tq / 0.09));
        _v.set(q.x, q.y + (1 - f) * 0.3, q.z);
        _e.set(q.rx, q.ry, q.rz, 'XYZ'); _q.setFromEuler(_e);
        _s.set(q.s * f + 1e-4, q.sy * f + 1e-4, q.s * f + 1e-4);
        _m4.compose(_v, _q, _s); P.gravats.setMatrixAt(i, _m4);
      }
      P.gravats.instanceMatrix.needsUpdate = true;
      var kt = U.smooth(0.3, 1.25, t);
      P.tas.scale.set(0.7 + 0.9 * kt, 0.04 + 0.5 * kt, 0.7 + 0.9 * kt);
      P.tache.material.opacity = 0.85 * U.smooth(0.2, 1.0, t);
      if (t >= DUREE_EFFONDREMENT) P.final = true;
    }
    var _axeL = new THREE.Vector3(), _axeY = new THREE.Vector3(0, 1, 0), _q2 = new THREE.Quaternion();

    /** Grille de navigation de la salle reconstruite sur place (les champs de flux la recalculent). */
    function majGrilleSalle() {
      var gr = monde.grilles.salle, col = monde.collisions.salle, O = monde.origineSalle || { x: 0, z: 0 };
      if (!gr || !col) return;
      gr.effacerSolides();
      for (var i = 0; i < pilierListe.length; i++) {
        var P = pilierListe[i];
        if (P.etat === 'detruit') gr.solideCercle(O.x + P.x, O.z + P.z, 0.95, false);   // moignon bas : ne cache plus la vue
        else gr.solideCercle(O.x + P.x, O.z + P.z, 1.1, true);
      }
      col.prims.forEach(function (p) {
        if (p.pilier) return;
        if (p.t === 2) gr.solideBoite(O.x + p.x, O.z + p.z, p.hx, p.hz, Math.atan2(p.s, p.c), false);
        else if (p.t === 1) gr.solideCercle(O.x + p.x, O.z + p.z, p.r, false);   // v1.4 : cuves (r + 0,2 = 1,05) comprises (avant : r < 1 seulement)
      });
      gr.finaliser();
    }

    /**
     * API §13 : états des piliers donnés par la logique, chaque image.
     * piliers = [{ id, etat: 'intact'|'endommage'|'detruit', coups, t }] (t = secondes depuis le dernier changement).
     */
    monde.appliquerPiliers = function (liste, temps) {
      if (!liste) return;
      var grilleSale = false;
      for (var i = 0; i < liste.length; i++) {
        var s = liste[i], P = piliers[s.id];
        if (!P) continue;
        var e = s.etat || 'intact', c = s.coups | 0;
        if (e === 'intact') { if (P.etat !== 'intact' || P.coups) { var avant = P.etat; remettrePilierANeuf(P); if (avant === 'detruit') grilleSale = true; } continue; }
        if (e === 'endommage') {
          if (P.etat === 'detruit') { remettrePilierANeuf(P); grilleSale = true; }
          if (P.etat !== 'endommage' || P.coups !== c) endommagerPilier(P, Math.max(1, c));
          continue;
        }
        if (e === 'detruit') {
          if (P.etat !== 'detruit') { if (P.coups < 2) { placerFissures(P); } commencerEffondrement(P); grilleSale = true; }
          if (!P.final) animerEffondrement(P, Math.max(0, +s.t || 0));
        }
      }
      if (grilleSale) majGrilleSalle();
    };
    /** Object3D d'un pilier (effets). */
    monde.pilier = function (id) { var P = piliers[id]; return P ? P.groupe : null; };
    /** Oriente les dégâts visibles vers le point d'impact réel (évènement `pilier` touche) ; facultatif. */
    monde.impactPilier = function (id, point, coups) {
      var P = piliers[id];
      if (!P || !point || P.etat === 'detruit') return;
      var O = monde.origineSalle || { x: 0, y: 0, z: 0 };
      var n = coups != null ? U.clamp((coups | 0) - 1, 0, 1) : Math.min(1, P.etat === 'endommage' ? P.coups : 0);
      P.angles[n] = Math.atan2(point.x - O.x - P.x, point.z - O.z - P.z);
      if (point.y != null) P.hauteurs[n] = U.clamp(point.y - (O.y || 0), 1.9, 6.0);
      placerFissures(P); placerEclats(P);
      if (P.etat === 'endommage') majFutAbime(P);
    };
    /** Liste de contrôle : [{ id, etat, coups, final, collision }]. */
    monde.etatPiliers = function () {
      return pilierListe.map(function (P) { return { id: P.id, etat: P.etat, coups: P.coups, final: P.final, collision: P.collision ? P.collision.r : null, x: P.x, z: P.z, chute: { x: P.D.x, z: P.D.z }, angles: P.angles.slice(), hauteurs: P.hauteurs.slice() }; });
    };

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // BONUS AU SOL (v1.1, API §13) : icône flottante lumineuse qui tourne (caisse de munitions inventée),
    // halo, lueur au sol, étincelles en orbite, lumière (préallouée : le nombre de lumières ne change pas) ;
    // clignote les 5 dernières secondes ; éclat bref au ramassage. Le gameplay (durée, contact) est dans l'adaptateur.
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    var bonusVisuels = [], lumieresBonus = [], partageBonus = null;
    function ressourcesBonus() {
      if (partageBonus) return partageBonus;
      function radial(stops) {
        var c = U.canvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        return T(c, { clamp: true });
      }
      var texHalo = radial([[0, 'rgba(235,255,215,1)'], [0.3, 'rgba(170,255,125,0.85)'], [0.58, 'rgba(90,225,60,0.35)'], [0.8, 'rgba(50,160,30,0.1)'], [1, 'rgba(20,80,10,0)']]);
      var texSol = radial([[0, 'rgba(180,255,140,0.95)'], [0.35, 'rgba(95,225,65,0.4)'], [1, 'rgba(30,90,20,0)']]);
      var texEtincelle = radial([[0, 'rgba(255,255,240,1)'], [0.3, 'rgba(195,255,155,0.85)'], [1, 'rgba(60,160,40,0)']]);
      // caisse de munitions (dessin inventé) : coffre à bandes, rebord, loquet, poignées, pochoir de cartouches,
      // trois cartouches dressées en éventail sur le couvercle
      var aC = new Accu(), aB = new Accu(), aL = new Accu(), aP = new Accu();
      aC.geo(THREE, new THREE.BoxGeometry(0.46, 0.24, 0.28), null, [1, 1, 1], 0.5);
      [-0.165, 0.165].forEach(function (x) { aB.geo(THREE, new THREE.BoxGeometry(0.05, 0.252, 0.292), matTRS(THREE, x, 0, 0), [1, 1, 1], 0.5); });
      aB.geo(THREE, new THREE.BoxGeometry(0.472, 0.035, 0.292), matTRS(THREE, 0, 0.104, 0), [1, 1, 1], 0.5);
      aB.geo(THREE, new THREE.BoxGeometry(0.07, 0.07, 0.022), matTRS(THREE, 0, 0.066, 0.148), [1, 1, 1], 0.5);
      [-1, 1].forEach(function (sx) { aB.geo(THREE, new THREE.TorusGeometry(0.045, 0.012, 6, 12, PI), matTRS(THREE, sx * 0.236, 0.0, 0, 0, sx * PI / 2, 0), [1, 1, 1], 0.5); });
      [-0.07, 0, 0.07].forEach(function (x) {
        aB.geo(THREE, new THREE.BoxGeometry(0.026, 0.085, 0.006), matTRS(THREE, x, -0.04, 0.142), [1, 1, 1], 0.5);
        aB.geo(THREE, new THREE.ConeGeometry(0.013, 0.03, 8), matTRS(THREE, x, 0.017, 0.142), [1, 1, 1], 0.5);
      });
      [[-0.095, 0.2], [0, 0], [0.095, -0.2]].forEach(function (c) {
        var a = c[1], sx = -Math.sin(a), cy = Math.cos(a), x0 = c[0], y0 = 0.12 + 0.07;
        aL.geo(THREE, new THREE.CylinderGeometry(0.03, 0.03, 0.15, 12), matTRS(THREE, x0, y0, 0, 0, 0, a), [1, 1, 1], 0.5);
        aL.geo(THREE, new THREE.CylinderGeometry(0.033, 0.033, 0.018, 12), matTRS(THREE, x0 - sx * 0.066, y0 - cy * 0.066, 0, 0, 0, a), [1, 1, 1], 0.5);
        aP.geo(THREE, new THREE.LatheGeometry([new THREE.Vector2(0.0302, 0), new THREE.Vector2(0.029, 0.018), new THREE.Vector2(0.025, 0.038), new THREE.Vector2(0.018, 0.056),
          new THREE.Vector2(0.009, 0.07), new THREE.Vector2(0.0, 0.078)], 12), matTRS(THREE, x0 + sx * 0.075, y0 + cy * 0.075, 0, 0, 0, a), [1, 1, 1], 0.5);   // ogive
      });
      function mE(couleur, emissive, k, metal) { return matStd({ couleur: couleur, emissive: emissive, emissiveIntensite: k, rough: 0.45, metal: metal || 0, couleursSommets: true }); }
      // corps vert sombre légèrement lumineux, bandes et pochoirs très lumineux (contour qui « brille »),
      // douilles en laiton, ogives cuivrées
      var munitions = [
        [aC.construire(THREE), mE(0x22361a, 0x3c9a22, 0.42)],
        [aB.construire(THREE), mE(0x3a6a22, 0x8cff5a, 0.95)],
        [aL.construire(THREE), mE(0x9c7024, 0xffa82a, 0.42, 0.7)],
        [aP.construire(THREE), mE(0x8a4522, 0xff6a30, 0.32, 0.6)]
      ];
      // icône générique des autres bonus : médaille épaisse frappée d'un glyphe inventé
      var aG = new Accu();
      aG.geo(THREE, new THREE.CylinderGeometry(0.26, 0.26, 0.06, 28), matTRS(THREE, 0, 0, 0, PI / 2, 0, 0), [1, 1, 1], 0.5);
      var generique = [[aG.construire(THREE), mE(0x8a6a1e, 0xffc848, 0.7, 0.6)]];
      partageBonus = { texHalo: texHalo, texSol: texSol, texEtincelle: texEtincelle, icones: { 'munitions-max': munitions }, generique: generique };
      return partageBonus;
    }
    /** Lumières des bonus : une par scène, créée avec le monde (intensité nulle hors bonus). */
    function preparerLumieresBonus() {
      ['salle', 'bunker'].forEach(function (lieu) {
        var L = new THREE.PointLight(C.couleur(0x8cff66), 0, 8, 2);
        L.position.set(0, -50, 0);
        monde.scenes[lieu].add(L);
        lumieresBonus.push({ lieu: lieu, L: L });
      });
    }
    /**
     * Crée l'objet visuel d'un bonus au sol : { id, type, lieu, groupe, restant, ramasser(), retirer() }.
     * L'adaptateur met à jour `restant` (clignotement < 5 s) ; monde.mettreAJour anime et détruit l'objet.
     */
    monde.creerBonus = function (o) {
      var RB = ressourcesBonus(), lieu = o.lieu || monde.lieuDe(o.position.x), sc = monde.scenes[lieu];
      if (!sc) return null;
      var g = new THREE.Group(); g.position.set(o.position.x, o.position.y || 0, o.position.z);
      var pivot = new THREE.Group(); pivot.position.y = 1.0; g.add(pivot);
      var icone = new THREE.Group(); pivot.add(icone);
      (RB.icones[o.type] || RB.generique).forEach(function (gm) { icone.add(new THREE.Mesh(gm[0], gm[1])); });
      icone.scale.setScalar(1.35);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: RB.texHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.material.toneMapped = false;
      halo.scale.set(1.7, 1.7, 1); halo.renderOrder = 3; pivot.add(halo);
      var sol = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ map: RB.texSol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      sol.material.toneMapped = false;
      sol.rotation.x = -PI / 2; sol.position.y = 0.015; g.add(sol);
      var NE = 14, gE = new THREE.BufferGeometry(), PE = new Float32Array(NE * 3);
      gE.setAttribute('position', new THREE.BufferAttribute(PE, 3));
      var etincelles = new THREE.Points(gE, new THREE.PointsMaterial({ map: RB.texEtincelle, size: 0.085, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: C.couleur(0xd8ffc4) }));
      etincelles.frustumCulled = false; pivot.add(etincelles);
      sc.add(g);
      var v = { id: o.id || null, type: o.type || 'munitions-max', lieu: lieu, groupe: g, pivot: pivot, icone: icone, halo: halo, sol: sol, etincelles: etincelles,
        PE: PE, NE: NE, t: 0, restant: o.duree != null ? o.duree : 30, etat: 'actif', tEtat: 0, ph: Math.random() * 10, lumiereK: 1 };
      v.ramasser = function () { if (v.etat === 'actif') { v.etat = 'ramasse'; v.tEtat = 0; } };
      v.retirer = function () { v.etat = 'fini'; };
      bonusVisuels.push(v);
      majBonus(v, 0);
      return v;
    };
    monde.bonusVisuels = function () { return bonusVisuels; };
    function majBonus(v, dt) {
      v.t += dt; v.tEtat += dt;
      var t = v.t, k = 1, visible = true;
      v.icone.rotation.y = t * 1.7 + v.ph;
      v.pivot.position.y = 1.0 + Math.sin(t * 2.3 + v.ph) * 0.07;
      var pulse = 0.82 + 0.18 * Math.sin(t * 5.1 + v.ph);
      if (v.etat === 'actif' && v.restant < 5) { var f = 2.2 + (5 - Math.max(0, v.restant)) * 1.3; visible = ((t * f) % 1) < 0.62; }
      if (v.etat === 'ramasse') {
        var kr = Math.min(1, v.tEtat / 0.35); k = 1 - kr;
        v.icone.scale.setScalar(1.35 * (1 + kr * 0.9));
        if (kr >= 1) v.etat = 'fini';
      }
      v.groupe.visible = visible && v.etat !== 'fini';
      v.halo.material.opacity = 0.9 * pulse * k;
      v.halo.scale.setScalar(1.45 + 0.15 * Math.sin(t * 3.7) + (1 - k) * 1.8);
      v.sol.material.opacity = 0.62 * pulse * k;
      for (var i = 0; i < v.NE; i++) {
        var a = t * (1.4 + (i % 3) * 0.35) + i * 2.399, r = 0.4 + 0.08 * Math.sin(t * 2 + i), h = Math.sin(t * 1.7 + i * 1.3) * 0.32;
        v.PE[i * 3] = Math.cos(a) * r; v.PE[i * 3 + 1] = h; v.PE[i * 3 + 2] = Math.sin(a) * r;
      }
      v.etincelles.geometry.attributes.position.needsUpdate = true;
      v.etincelles.material.opacity = k;
      v.lumiereK = v.groupe.visible ? pulse * k * (v.etat === 'ramasse' ? 1.8 : 1) : 0;
    }
    function detruireBonus(v) {
      if (v.groupe.parent) v.groupe.parent.remove(v.groupe);
      v.halo.material.dispose(); v.sol.geometry.dispose(); v.sol.material.dispose();
      v.etincelles.geometry.dispose(); v.etincelles.material.dispose();
    }
    function majTousBonus(dt) {
      for (var i = bonusVisuels.length - 1; i >= 0; i--) {
        var v = bonusVisuels[i];
        if (v.etat !== 'fini') majBonus(v, dt);
        if (v.etat === 'fini') { detruireBonus(v); bonusVisuels.splice(i, 1); }
      }
      for (var l = 0; l < lumieresBonus.length; l++) {
        var LB = lumieresBonus[l], cible = null;
        for (var q = bonusVisuels.length - 1; q >= 0; q--) if (bonusVisuels[q].lieu === LB.lieu) { cible = bonusVisuels[q]; break; }
        if (cible) { LB.L.position.set(cible.groupe.position.x, cible.groupe.position.y + 1.15, cible.groupe.position.z); LB.L.intensity = 9 * cible.lumiereK; }
        else LB.L.intensity = 0;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // CUVES VERTES (v1.3, API §15.1) : socle et pieds boulonnés, anneaux, montants, cylindre de verre (r 0,85, h 2,6),
    // couvercle à tuyaux et câbles vers le mur, plaque, liquide vert lumineux animé, bulles, mini-boss endormi qui flotte.
    // États (monde.appliquerTubes) : intact → siphon (le niveau baisse, bulles affolées) → fissure (fissures lumineuses)
    // → eclate (verre brisé au bord déchiqueté, tessons, flaque ; le dormeur disparaît). Collision : cercle r + 0,2.
    // Une seule lumière par cuve (budget de la salle inchangé) ; un mini-boss peut l'emprunter (monde.emprunterLumiereTube).
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    var cuves = {}, listeCuves = [];
    monde.tubes = [];
    var H_SOCLE = 0.46, N_BULLES = 70, VIDANGE = 0.36;          // vitesse de vidange pendant le siphon (fraction par seconde)
    // le dormeur reste (il bascule vers l'ouverture) jusqu'à la sortie de l'entité : siphon.apparition.delai s après l'éclatement
    var CFG_SIPHON = root.BOSS_B7_CONFIG && root.BOSS_B7_CONFIG.miniBoss && root.BOSS_B7_CONFIG.miniBoss.siphon;
    var DELAI_DORMEUR = CFG_SIPHON && CFG_SIPHON.apparition && CFG_SIPHON.apparition.delai != null ? CFG_SIPHON.apparition.delai : 0.6;
    var ressCuves = null;
    function ressourcesCuves() {
      if (ressCuves) return ressCuves;
      // liquide : traînées verticales claires sur fond vert, bulles ; répété et défilé vers le haut
      var cl = U.canvas(128, 256), gl = cl.getContext('2d'), Rl = U.rng(611);
      var grd = gl.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#2f8a1a'); grd.addColorStop(0.5, '#3fa524'); grd.addColorStop(1, '#2a7a16');
      gl.fillStyle = grd; gl.fillRect(0, 0, 128, 256);
      for (var k = 0; k < 26; k++) {
        var x0 = Rl() * 128, w = 2 + Rl() * 7; gl.strokeStyle = 'rgba(190,255,120,' + (0.08 + Rl() * 0.18).toFixed(2) + ')'; gl.lineWidth = w;
        gl.beginPath(); for (var y = -10; y <= 266; y += 8) { var xx = x0 + Math.sin(y * 0.04 + k) * 6; if (y < 0) gl.moveTo(xx, y); else gl.lineTo(xx, y); } gl.stroke();
      }
      for (var b = 0; b < 40; b++) { gl.fillStyle = 'rgba(220,255,170,' + (0.15 + Rl() * 0.3).toFixed(2) + ')'; gl.beginPath(); gl.arc(Rl() * 128, Rl() * 256, 0.8 + Rl() * 2.2, 0, TAU); gl.fill(); }
      var texLiq = T(cl); texLiq.wrapS = texLiq.wrapT = THREE.RepeatWrapping; texLiq.repeat.set(3, 1.4);
      // surface : ondes concentriques
      var cs = U.canvas(128, 128), gs = cs.getContext('2d');
      var gr2 = gs.createRadialGradient(64, 64, 0, 64, 64, 64); gr2.addColorStop(0, '#9dff60'); gr2.addColorStop(1, '#3d9a1f'); gs.fillStyle = gr2; gs.fillRect(0, 0, 128, 128);
      for (var o = 0; o < 6; o++) { gs.strokeStyle = 'rgba(230,255,190,0.35)'; gs.lineWidth = 2; gs.beginPath(); gs.arc(64 + Math.sin(o) * 6, 64 + Math.cos(o * 1.7) * 6, 10 + o * 9, 0, TAU); gs.stroke(); }
      var texSurf = T(cs, { clamp: true });
      // fissures du verre : 3 niveaux, du centre (point de rupture) vers les bords, traits lumineux
      var texFis = [0, 1, 2].map(function (niv) {
        var W2 = 512, cf = U.canvas(W2, W2), gf = cf.getContext('2d'), Rf = U.rng(700 + niv * 13);
        gf.clearRect(0, 0, W2, W2); gf.lineCap = 'round'; gf.lineJoin = 'miter';
        function branche(x, y, a, n, ep, prof) {
          gf.lineWidth = ep; gf.beginPath(); gf.moveTo(x, y);
          var enfants = [];
          for (var s = 0; s < n; s++) {
            a += (Rf() - 0.5) * 0.5; var l = 9 + Rf() * 14; x += Math.cos(a) * l; y += Math.sin(a) * l; gf.lineTo(x, y);
            if (prof < 2 && Rf() < 0.18) enfants.push([x, y, a + (Rf() < 0.5 ? -1 : 1) * (0.5 + Rf() * 0.7)]);
          }
          gf.stroke();
          enfants.forEach(function (e) { branche(e[0], e[1], e[2], Math.max(3, n - 4), Math.max(1, ep * 0.6), prof + 1); });
        }
        var cx = W2 * 0.5, cy = W2 * 0.45, nb = [4, 6, 9][niv], lon = [6, 10, 14][niv];
        for (var pass = 0; pass < 2; pass++) {
          gf.strokeStyle = pass ? 'rgba(235,255,215,0.9)' : 'rgba(120,255,60,0.18)';
          var Rs = Rf; Rf = U.rng(700 + niv * 13);
          for (var r0 = 0; r0 < nb; r0++) branche(cx, cy, r0 / nb * TAU + Rf() * 0.4, lon, pass ? 1.6 : 4.5, 0);
          Rf = Rs;
        }
        // anneaux de choc autour du point d'impact
        gf.strokeStyle = 'rgba(220,255,200,0.7)'; gf.lineWidth = 1.5;
        for (var an = 0; an <= niv; an++) { gf.beginPath(); for (var q = 0; q <= 24; q++) { var aa = q / 24 * TAU, rr = 18 + an * 26 + (Rf() - 0.5) * 8; if (q === 0) gf.moveTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); else gf.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr); } gf.stroke(); }
        return T(cf, { clamp: true });
      });
      // flaque verte (éclatement)
      var cp = U.canvas(256, 256), gp = cp.getContext('2d'), Rp = U.rng(733);
      for (var f = 0; f < 12; f++) { var a1 = Rp() * TAU, d1 = Rp() * 50, r1 = 40 + Rp() * 50, x1 = 128 + Math.cos(a1) * d1, y1 = 128 + Math.sin(a1) * d1; var g3 = gp.createRadialGradient(x1, y1, 0, x1, y1, r1); g3.addColorStop(0, 'rgba(110,230,40,0.95)'); g3.addColorStop(0.75, 'rgba(60,160,20,0.8)'); g3.addColorStop(1, 'rgba(30,90,10,0)'); gp.fillStyle = g3; gp.beginPath(); gp.arc(x1, y1, r1, 0, TAU); gp.fill(); }
      var texFl = T(cp, { clamp: true });
      ressCuves = {
        texLiq: texLiq, texSurf: texSurf, texFis: texFis, texFl: texFl,
        verreAv: matStd({ couleur: 0xa8c8c0, rough: 0.05, metal: 0.0, transparent: true, opacite: 0.16 }),
        verreAr: matStd({ couleur: 0x8fb0a8, rough: 0.05, metal: 0.0, transparent: true, opacite: 0.12 }),
        reflet: new THREE.MeshBasicMaterial({ color: C.couleur(0xd8fff0), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
        bulle: new THREE.PointsMaterial({ map: texBraise, size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: C.couleur(0xc8ff9a) })
      };
      ressCuves.verreAr.side = THREE.BackSide;
      ressCuves.reflet.toneMapped = false; ressCuves.bulle.toneMapped = false;
      return ressCuves;
    }
    function texPlaque(T0) {
      var cv = U.canvas(256, 104), g = cv.getContext('2d');
      g.fillStyle = '#3b3d38'; g.fillRect(0, 0, 256, 104);
      g.strokeStyle = '#1c1d1a'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 98);
      g.fillStyle = '#20211e'; [[12, 12], [244, 12], [12, 92], [244, 92]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 5, 0, TAU); g.fill(); });
      var FICHES = { survolte: ['06', 'LE SURVOLTÉ'], irradie: ['04', 'L’IRRADIÉ'], demembre: ['02', 'LE DÉMEMBRÉ'] }, fi = FICHES[T0.miniBoss] || ['??', String(T0.miniBoss || '').toUpperCase()];
      var cfgN = root.BOSS_B7_CONFIG && root.BOSS_B7_CONFIG.miniBoss && root.BOSS_B7_CONFIG.miniBoss[T0.miniBoss];
      var num = fi[0], nom = cfgN && cfgN.nom ? String(cfgN.nom).toUpperCase() : fi[1];
      g.fillStyle = '#c9c6b8'; g.textAlign = 'center';
      g.font = 'bold 22px monospace'; g.fillText('CONFINEMENT N°' + num, 128, 36);
      g.font = 'bold 17px monospace'; g.fillText('SUJET : ' + nom, 128, 62);
      g.fillStyle = '#d9a21e'; g.font = 'bold 14px monospace'; g.fillText('— NE PAS OUVRIR —', 128, 86);
      return T(cv, { clamp: true });
    }
    /** Distance du point (x, z) au mur de l'octogone dans la direction (dx, dz) (∞ si aucun). */
    function distanceMur(x, z, dx, dz, A) {
      var best = 1e9;
      for (var k = 0; k < 8; k++) { var t = k * PI / 4, nx = Math.sin(t), nz = Math.cos(t), nd = nx * dx + nz * dz; if (nd > 1e-4) { var d = (A - (nx * x + nz * z)) / nd; if (d > 0 && d < best) best = d; } }
      return best;
    }
    function construireCuve(accF, racine, col, T0, indice) {
      var Rs = ressourcesCuves(), r = T0.rayon || 0.85, Hv = T0.hauteur || 2.6, yaw = T0.lacet || 0, Rr = U.rng(901 + (indice || 0));
      var cy = Math.cos(yaw), sy = Math.sin(yaw), yH = H_SOCLE + Hv;
      // v1.5 : tout suit la taille de la cuve (cuve géante du Démembré : r 1,3, h 4,4) ; kT = 1 et kH = 1 pour les cuves de 0,85 × 2,6
      var kT = Math.max(1, r / 0.85), kH = Math.max(1, Hv / 2.6), kQ = Math.sqrt(kT);
      // repère local de la cuve : +z vers le centre de la salle
      function M(lx, ly, lz, rx, ry, rz, sx, sy2, sz) { return matTRS(THREE, T0.x + lx * cy + lz * sy, ly, T0.z - lx * sy + lz * cy, rx || 0, yaw + (ry || 0), rz || 0, sx, sy2, sz); }
      function P(lx, lz) { return [T0.x + lx * cy + lz * sy, T0.z - lx * sy + lz * cy]; }
      var acier = [0.62, 0.64, 0.62], sombre = [0.32, 0.33, 0.32], cuivre = [0.75, 0.5, 0.32], noirC = [0.1, 0.1, 0.1], rouille = [0.6, 0.42, 0.3];
      // ── socle boulonné ──
      accF.geo(THREE, new THREE.CylinderGeometry(r + 0.16, r + 0.21, 0.36, 36), M(0, 0.18, 0), acier, 1);
      accF.geo(THREE, new THREE.CylinderGeometry(r + 0.2, r + 0.2, 0.05, 36), M(0, 0.385, 0), sombre, 1);
      accF.geo(THREE, new THREE.CylinderGeometry(r + 0.045, r + 0.07, 0.05, 36), M(0, 0.435, 0), acier, 1);
      for (var b = 0; b < 24; b++) { var ab = (b + 0.5) / 24 * TAU; accF.geo(THREE, new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6), M(Math.cos(ab) * (r + 0.13), 0.425, Math.sin(ab) * (r + 0.13)), sombre, 1); }
      for (var nr = 0; nr < 12; nr++) { var an = nr / 12 * TAU; accF.geo(THREE, new THREE.BoxGeometry(0.05, 0.32, 0.05), M(Math.cos(an) * (r + 0.2), 0.18, Math.sin(an) * (r + 0.2), 0, -an, 0), sombre, 1); }   // nervures
      // pieds boulonnés (équerres inclinées + semelles à 2 boulons)
      for (var pd = 0; pd < 4; pd++) {
        var ap = PI / 4 + pd * PI / 2, ca = Math.cos(ap), sa = Math.sin(ap);
        accF.geo(THREE, new THREE.BoxGeometry(0.34 * kT, 0.035 * kQ, 0.12 * kT), M(ca * (r + 0.3 * kT), 0.14, sa * (r + 0.3 * kT), 0, -ap, -0.62), acier, 1);
        accF.geo(THREE, new THREE.BoxGeometry(0.03 * kQ, 0.26, 0.12 * kT), M(ca * (r + 0.24 * kT), 0.13, sa * (r + 0.24 * kT), 0, -ap, 0), sombre, 1);
        accF.geo(THREE, new THREE.BoxGeometry(0.26 * kT, 0.03, 0.2 * kT), M(ca * (r + 0.43 * kT), 0.015, sa * (r + 0.43 * kT), 0, -ap, 0), acier, 1);
        [-0.06, 0.06].forEach(function (o) { accF.geo(THREE, new THREE.CylinderGeometry(0.02 * kQ, 0.02 * kQ, 0.03, 6), M(ca * (r + 0.47 * kT) - sa * o * kT, 0.04, sa * (r + 0.47 * kT) + ca * o * kT), sombre, 1); });
      }
      // ── anneaux (bas, milieu, haut) et montants (laissent l'avant dégagé) ──
      accF.geo(THREE, new THREE.TorusGeometry(r + 0.025, 0.028 * kQ, 6, 40), M(0, H_SOCLE + 0.03, 0, PI / 2, 0, 0), acier, 1);
      accF.geo(THREE, new THREE.TorusGeometry(r + 0.022, 0.018 * kQ, 6, 40), M(0, H_SOCLE + Hv * 0.55, 0, PI / 2, 0, 0), sombre, 1);
      if (kH > 1.2) { accF.geo(THREE, new THREE.TorusGeometry(r + 0.022, 0.018 * kQ, 6, 40), M(0, H_SOCLE + Hv * 0.28, 0, PI / 2, 0, 0), sombre, 1); accF.geo(THREE, new THREE.TorusGeometry(r + 0.022, 0.018 * kQ, 6, 40), M(0, H_SOCLE + Hv * 0.8, 0, PI / 2, 0, 0), sombre, 1); }   // cuve géante : anneaux de plus
      accF.geo(THREE, new THREE.CylinderGeometry(r + 0.07, r + 0.07, 0.12 * kQ, 36), M(0, yH + 0.06 * kQ, 0), acier, 1);
      [0.85, 2.29, 3.99, 5.43].forEach(function (am) {
        var cm = Math.cos(am), sm2 = Math.sin(am), ep = 0.075 * kQ;
        accF.geo(THREE, new THREE.BoxGeometry(ep, Hv + 0.1, 0.09 * kQ), M(cm * (r + ep), H_SOCLE + (Hv + 0.1) / 2, sm2 * (r + ep), 0, -am, 0), acier, 1);
        (kH > 1.2 ? [0.28, 0.55, 0.8] : [0.55]).forEach(function (fy) { accF.geo(THREE, new THREE.BoxGeometry(0.13 * kQ, 0.06 * kQ, 0.13 * kQ), M(cm * (r + ep), H_SOCLE + Hv * fy, sm2 * (r + ep), 0, -am, 0), sombre, 1); });
        [0.15, Hv - 0.15].forEach(function (yy) { accF.geo(THREE, new THREE.CylinderGeometry(0.018 * kQ, 0.018 * kQ, 0.12 * kQ, 6), M(cm * (r + ep), H_SOCLE + yy, sm2 * (r + ep), PI / 2, -am, 0), sombre, 1); });
      });
      // ── couvercle : bride boulonnée, dôme, vanne à volant ──
      var yC = yH + 0.16 * kQ, nBc = Math.round(18 * kT);                    // bride, dôme et vanne (à la taille de la cuve)
      accF.geo(THREE, new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.08 * kQ, 36), M(0, yC, 0), sombre, 1);
      for (var bc = 0; bc < nBc; bc++) { var ac = (bc + 0.5) / nBc * TAU; accF.geo(THREE, new THREE.CylinderGeometry(0.02 * kQ, 0.02 * kQ, 0.03, 6), M(Math.cos(ac) * (r + 0.07), yC + 0.055 * kQ, Math.sin(ac) * (r + 0.07)), acier, 1); }
      var yD = yC + 0.04 * kQ, hD = (r + 0.1) * 0.34;
      accF.geo(THREE, new THREE.SphereGeometry(r + 0.1, 32, 8, 0, TAU, 0, PI / 2), M(0, yD, 0, 0, 0, 0, 1, 0.34, 1), acier, 1);
      accF.geo(THREE, new THREE.CylinderGeometry(0.16 * kT, 0.19 * kT, 0.14 * kQ, 16), M(0, yD + hD + 0.037 * kQ, 0), sombre, 1);
      accF.geo(THREE, new THREE.CylinderGeometry(0.03 * kQ, 0.03 * kQ, 0.16 * kQ, 8), M(0, yD + hD + 0.177 * kQ, 0), acier, 1);
      accF.geo(THREE, new THREE.TorusGeometry(0.15 * kT, 0.016 * kQ, 6, 24), M(0, yD + hD + 0.257 * kQ, 0, PI / 2, 0, 0), rouille, 1);
      for (var rv = 0; rv < 4; rv++) accF.geo(THREE, new THREE.BoxGeometry(0.3 * kT, 0.012 * kQ, 0.012 * kQ), M(0, yD + hD + 0.257 * kQ, 0, 0, rv * PI / 4, 0), rouille, 1);
      // ── tuyaux (vers le mur derrière la cuve : coin ou milieu d'un mur) et câbles qui pendent jusqu'au mur ──
      var dos = -1;                                                  // −z local : vers le mur
      var prof = distanceMur(T0.x, T0.z, -sy, -cy, (ARENE.salle && ARENE.salle.apotheme) || 15), kP = Math.min(1, Math.max(0.3, (prof - 0.1) / 3.0));   // cuves des coins : 1 (inchangé)
      [[-0.42, 0.075, 0.0], [0.4, 0.055, 0.6]].forEach(function (tp, ii) {
        var x0 = tp[0] * kT, y0 = yD + hD - 0.153 * kQ, pts = [[x0, y0 + 0.05, dos * 0.25 * kT], [x0, y0 + 0.58 + ii * 0.2, dos * 0.3 * kT], [x0 * 1.3, y0 + 0.78 + ii * 0.2, dos * 0.9 * kP], [x0 * (1 + 0.8 * kP), y0 + 0.78 + ii * 0.2, dos * 2.2 * kP], [x0 * (1 + 1.1 * kP), y0 + 0.73 + ii * 0.2, dos * 3.0 * kP]];
        var v3 = pts.map(function (p) { var w = P(p[0], p[2]); return new THREE.Vector3(w[0], p[1], w[1]); });
        accF.geo(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v3, false, 'catmullrom', 0.1), 28, tp[1] * kQ, 10), null, ii ? cuivre : acier, 1);
        [0, 2].forEach(function (k) { var a = v3[k], b2 = v3[k + 1], d = b2.clone().sub(a).normalize(); var g = new THREE.CylinderGeometry(tp[1] * kQ + 0.025, tp[1] * kQ + 0.025, 0.05 * kQ, 12); var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); var mm = new THREE.Matrix4().compose(a.clone().lerp(b2, 0.08), q, new THREE.Vector3(1, 1, 1)); accF.geo(THREE, g, mm, sombre, 1); });
      });
      for (var cb = 0; cb < 3; cb++) {
        var xs = (cb - 1) * 0.35 * kT, pts2 = [];
        for (var t = 0; t <= 10; t++) {
          var f = t / 10, lz = dos * (0.75 * kT + f * 2.25) * kP, ly = yD + hD * 0.31 - 0.75 * Math.sin(PI * f) * (0.7 + cb * 0.15) + f * (0.9 + cb * 0.15), w2 = P(xs * (1 + f * 1.2), lz);
          pts2.push(new THREE.Vector3(w2[0], ly, w2[1]));
        }
        accF.geo(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 24, 0.022 + cb * 0.004, 6), null, noirC, 1);
      }
      // ── plaque gravée sur le socle (texture de canevas) ──
      var kPl = Math.min(1.35, kT);
      var plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.46 * kPl, 0.19 * kPl), matStd({ map: texPlaque(T0), rough: 0.55, metal: 0.4 }));
      plaque.applyMatrix4(M(0, 0.2, r + 0.205)); racine.add(plaque);
      // ── parties animées (groupe local de la cuve) ──
      var grp = new THREE.Group(); grp.position.set(T0.x, 0, T0.z); grp.rotation.y = yaw; racine.add(grp);
      var verreAv = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Hv, 44, 1, true), Rs.verreAv), verreAr = new THREE.Mesh(verreAv.geometry, Rs.verreAr);
      verreAv.position.y = verreAr.position.y = H_SOCLE + Hv / 2; verreAv.renderOrder = 8; verreAr.renderOrder = 3; grp.add(verreAr); grp.add(verreAv);
      [0.55, -0.32].forEach(function (aRef, k) { var ref = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + k * 0.03, Hv * 0.92), Rs.reflet); ref.position.set(Math.sin(aRef) * (r + 0.004), H_SOCLE + Hv / 2, Math.cos(aRef) * (r + 0.004)); ref.rotation.y = aRef; ref.renderOrder = 9; grp.add(ref); verreAv['reflet' + k] = ref; });
      // liquide : cylindre (dos et face), surface, bulles
      var matLiq = new THREE.MeshBasicMaterial({ map: Rs.texLiq, color: C.couleur(0x7ee05a), transparent: true, opacity: 0.4, depthWrite: false });
      var matLiqAr = matLiq.clone(); matLiqAr.side = THREE.BackSide; matLiqAr.opacity = 0.55; matLiqAr.color = C.couleur(0x5aa83a);
      var gLiq = new THREE.CylinderGeometry(r - 0.015, r - 0.015, 1, 44, 1, true); gLiq.translate(0, 0.5, 0);
      var liqAv = new THREE.Mesh(gLiq, matLiq), liqAr = new THREE.Mesh(gLiq, matLiqAr);
      liqAv.position.y = liqAr.position.y = H_SOCLE; liqAv.renderOrder = 7; liqAr.renderOrder = 4; grp.add(liqAr); grp.add(liqAv);
      var matSurf = new THREE.MeshBasicMaterial({ map: Rs.texSurf, color: C.couleur(0xa8e890), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      var surf = new THREE.Mesh(new THREE.CircleGeometry(r - 0.015, 44), matSurf); surf.rotation.x = -PI / 2; surf.renderOrder = 6; grp.add(surf);
      var nBulles = Math.round(N_BULLES * kT * kT * kH), gB = new THREE.BufferGeometry(), PB = new Float32Array(nBulles * 3), bulles = [];
      for (var bb = 0; bb < nBulles; bb++) bulles.push({ a: Rr() * TAU, r: Math.sqrt(Rr()) * (r - 0.08), y: Rr(), v: 0.25 + Rr() * 0.45, ph: Rr() * TAU });
      gB.setAttribute('position', new THREE.BufferAttribute(PB, 3));
      var ptsB = new THREE.Points(gB, Rs.bulle); ptsB.frustumCulled = false; ptsB.renderOrder = 5; grp.add(ptsB);
      // fissures lumineuses (3 niveaux, sur l'avant du verre)
      var fissures = Rs.texFis.map(function (tx, k) {
        var mf = new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: C.couleur(0xcfffb0), side: THREE.DoubleSide });
        mf.toneMapped = false;
        var gf = new THREE.CylinderGeometry(r + 0.006, r + 0.006, Hv * 0.86, 24, 1, true, -0.95, 1.9);
        var mfi = new THREE.Mesh(gf, mf); mfi.position.y = H_SOCLE + Hv * 0.5; mfi.rotation.y = (k - 1) * 0.12 + (Rr() - 0.5) * 0.3; mfi.renderOrder = 10; mfi.visible = false; grp.add(mfi);
        return mfi;
      });
      // verre brisé : partie arrière intacte, avant arraché (dents en bas et en haut)
      var seg = 48, pos = [], idx = [], uvs = [], hautBas = [], hautHaut = [];
      for (var i2 = 0; i2 <= seg; i2++) {
        var a2 = i2 / seg * TAU, avant = Math.max(0, Math.cos(a2 - PI / 2)), brise = avant > 0.18;
        var dent = 0.15 + Rr() * 0.6 * (i2 % 2 ? 1 : 0.45);
        hautBas.push(brise ? H_SOCLE + 0.05 + dent * (1.0 - avant * 0.6) : yH);
        hautHaut.push(brise ? yH - (0.08 + Rr() * 0.5 * (i2 % 2 ? 1 : 0.4)) * (1.1 - avant * 0.5) : yH);
      }
      for (var i3 = 0; i3 <= seg; i3++) {
        var a3 = i3 / seg * TAU, x3 = Math.cos(a3) * r, z3 = Math.sin(a3) * r;
        pos.push(x3, H_SOCLE, z3, x3, hautBas[i3], z3, x3, hautHaut[i3], z3, x3, yH, z3); uvs.push(i3 / seg, 0, i3 / seg, 0.5, i3 / seg, 0.5, i3 / seg, 1);
        if (i3 < seg) { var kk = i3 * 4; idx.push(kk, kk + 1, kk + 4, kk + 1, kk + 5, kk + 4, kk + 2, kk + 3, kk + 6, kk + 3, kk + 7, kk + 6); }
      }
      var gBr = new THREE.BufferGeometry(); gBr.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gBr.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); gBr.setIndex(idx); gBr.computeVertexNormals();
      var matBrise = matStd({ couleur: 0xa6c4b6, rough: 0.06, metal: 0.0, transparent: true, opacite: 0.34, double: true });
      var brise = new THREE.Mesh(gBr, matBrise); brise.renderOrder = 8; brise.visible = false; grp.add(brise);
      // arêtes vives de la cassure (lignes claires le long des dents)
      var pA = [];
      for (var i4 = 0; i4 < seg; i4++) {
        var a4 = i4 / seg * TAU, a5 = (i4 + 1) / seg * TAU;
        if (hautBas[i4] < yH - 0.01 || hautBas[i4 + 1] < yH - 0.01) pA.push(Math.cos(a4) * r, hautBas[i4], Math.sin(a4) * r, Math.cos(a5) * r, hautBas[i4 + 1], Math.sin(a5) * r);
        if (hautHaut[i4] < yH - 0.01 || hautHaut[i4 + 1] < yH - 0.01) pA.push(Math.cos(a4) * r, hautHaut[i4], Math.sin(a4) * r, Math.cos(a5) * r, hautHaut[i4 + 1], Math.sin(a5) * r);
      }
      var gA = new THREE.BufferGeometry(); gA.setAttribute('position', new THREE.Float32BufferAttribute(pA, 3));
      var aretes = new THREE.LineSegments(gA, new THREE.LineBasicMaterial({ color: C.couleur(0xd8ffe0), transparent: true, opacity: 0.85 }));
      aretes.renderOrder = 9; brise.add(aretes);
      // tessons au sol (devant) et flaque qui s'étale
      var gT = new THREE.BufferGeometry(), pT = [];
      for (var ts = 0; ts < 26; ts++) {
        var at = PI / 2 + (Rr() - 0.5) * 2.4, dt2 = r + 0.15 + Math.pow(Rr(), 0.7) * 2.1 * kT, tx = Math.cos(at) * dt2, tz = Math.sin(at) * dt2, tl = (0.04 + Rr() * 0.13) * kQ, rt = Rr() * TAU;
        for (var v = 0; v < 3; v++) { var av = rt + v * TAU / 3 + (Rr() - 0.5) * 0.9, lv = tl * (0.5 + Rr() * 0.7); pT.push(tx + Math.cos(av) * lv, 0.006 + Rr() * 0.01, tz + Math.sin(av) * lv); }
      }
      gT.setAttribute('position', new THREE.Float32BufferAttribute(pT, 3)); gT.computeVertexNormals();
      var tessons = new THREE.Mesh(gT, matBrise); tessons.visible = false; grp.add(tessons);
      var matFl = new THREE.MeshBasicMaterial({ map: Rs.texFl, color: C.couleur(0x9dff70), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      var flaque = new THREE.Mesh(new THREE.PlaneGeometry(3.4 * kT, 2.4 * kT), matFl); flaque.rotation.x = -PI / 2; flaque.position.set(0, 0.006, r + 0.75 * kT); flaque.visible = false; grp.add(flaque);
      // mini-boss endormi (modèle du module zombies) : flotte au milieu du liquide
      // v1.5 : échelle du mini-boss (config.miniBoss.<type>.echelle, sinon d'après la hauteur de la cuve) ; un géant tient debout
      var dormeur = null, cfgD = root.BOSS_B7_CONFIG && root.BOSS_B7_CONFIG.miniBoss && T0.miniBoss ? root.BOSS_B7_CONFIG.miniBoss[T0.miniBoss] : null;
      var echD = cfgD && cfgD.echelle > 0 ? cfgD.echelle : (kH > 1.2 ? kH : 1), yDorm = H_SOCLE + (echD > 1.2 ? 0.06 : 0.36);
      if (root.ProtoB7Zombies && root.ProtoB7Zombies.modeleDormant && T0.miniBoss) {
        try { dormeur = root.ProtoB7Zombies.modeleDormant(THREE, T0.miniBoss, { compat: C, echelle: echD, debout: echD > 1.2 }); dormeur.groupe.position.set(0, yDorm, 0.02); grp.add(dormeur.groupe); }
        catch (e) { dormeur = null; if (typeof console !== 'undefined') console.warn('cuve : dormeur indisponible', e); }
      }
      // lumière verte : la seule de la cuve (budget de la salle inchangé)
      var lumBase = 14 * Math.pow(kT, 1.5), L = new THREE.PointLight(C.couleur(0x6aff40), lumBase, 6.5 * kT, 2), wl = P(0, r + 0.55 * kT);
      L.position.set(wl[0], 1.5 * kH, wl[1]); racine.add(L); monde.lumieres.salle.push(L);
      L.userData.base = lumBase; L.userData.cuve = T0.id;
      col.cercle(T0.x, T0.z, r + 0.2);
      var cu = {
        id: T0.id, miniBoss: T0.miniBoss || null, x: T0.x, z: T0.z, lacet: yaw, r: r, Hv: Hv, groupe: grp, etat: 'intact', t: 0, niveau: 1, niveauDebut: 1,
        verreAv: verreAv, verreAr: verreAr, liqAv: liqAv, liqAr: liqAr, surf: surf, matLiq: matLiq, matLiqAr: matLiqAr, matSurf: matSurf, bulles: bulles, PB: PB, ptsB: ptsB,
        fissures: fissures, brise: brise, tessons: tessons, flaque: flaque, matFl: matFl, dormeur: dormeur, lumiere: L, empruntee: false, lumBase: wl, eclatT: 0,
        yDormeur: yDorm, kD: echD, intensiteBase: lumBase
      };
      cuves[T0.id] = cu; listeCuves.push(cu);
      monde.tubes.push({ id: T0.id, x: T0.x, z: T0.z, lacet: yaw, rayon: r, hauteur: Hv, miniBoss: T0.miniBoss || null });
      appliquerEtatCuve(cu, 'intact', 0);
      return cu;
    }
    function appliquerEtatCuve(cu, etat, t) {
      var nouveau = etat !== cu.etat;
      if (nouveau && etat === 'fissure') cu.niveauDebut = cu.etat === 'siphon' ? cu.niveau : 1 - VIDANGE * 1.3;
      if (nouveau && etat === 'siphon') cu.niveauDebut = 1;
      cu.etat = etat; cu.t = t;
      var brisee = etat === 'eclate';
      cu.verreAv.visible = cu.verreAr.visible = !brisee;
      cu.verreAv.reflet0.visible = cu.verreAv.reflet1.visible = !brisee;
      cu.brise.visible = cu.tessons.visible = cu.flaque.visible = brisee;
      if (cu.dormeur) { cu.dormeur.groupe.visible = !brisee || t < DELAI_DORMEUR; cu.dormeur.groupe.rotation.x = 0; if (!brisee) cu.dormeur.groupe.position.z = 0.02; }   // v1.5 : recentré à la remise à neuf
      cu.ptsB.visible = !brisee;
      for (var k = 0; k < cu.fissures.length; k++) cu.fissures[k].visible = etat === 'fissure';
      if (etat === 'intact') { cu.niveau = 1; cu.niveauDebut = 1; }
      majNiveau(cu);
    }
    function majNiveau(cu) {
      var Hl = cu.etat === 'eclate' ? 0.05 : (cu.Hv - 0.18) * cu.niveau;
      cu.liqAv.scale.y = cu.liqAr.scale.y = Math.max(0.01, Hl);
      cu.surf.position.y = H_SOCLE + Math.max(0.01, Hl);
      cu.liqAv.visible = cu.liqAr.visible = cu.surf.visible = true;
    }
    /** États des cuves (API §15.1) : [{ id, etat: 'intact'|'siphon'|'fissure'|'eclate', t }], chaque image. */
    monde.appliquerTubes = function (liste, temps) {
      if (!liste) return;
      for (var i = 0; i < liste.length; i++) {
        var e = liste[i], cu = cuves[e.id];
        if (!cu) continue;
        var et = e.etat === 'siphon' || e.etat === 'fissure' || e.etat === 'eclate' ? e.etat : 'intact';
        if (et !== cu.etat) appliquerEtatCuve(cu, et, e.t || 0); else cu.t = e.t != null ? e.t : cu.t;
      }
    };
    monde.tube = function (id) { return cuves[id] ? cuves[id].groupe : null; };
    /** L'entité de jeu prend le relais : cache le mini-boss endormi de la cuve (id). */
    monde.cacherDormeur = function (id) { var cu = cuves[id]; if (cu && cu.dormeur) cu.dormeur.groupe.visible = false; };
    monde.etatTubes = function () { return listeCuves.map(function (cu) { return { id: cu.id, etat: cu.etat, miniBoss: cu.miniBoss, niveau: +cu.niveau.toFixed(3) }; }); };
    /** Prête la lumière d'une cuve (id ou type de mini-boss) à un mini-boss libéré ; null si déjà prêtée. */
    monde.emprunterLumiereTube = function (cle) {
      for (var i = 0; i < listeCuves.length; i++) { var cu = listeCuves[i]; if ((cu.id === cle || cu.miniBoss === cle) && !cu.empruntee) { cu.empruntee = true; return cu.lumiere; } }
      return null;
    };
    monde.rendreLumiereTube = function (L) {
      for (var i = 0; i < listeCuves.length; i++) { var cu = listeCuves[i]; if (cu.lumiere === L) { cu.empruntee = false; L.color.copy(couleurCuve); L.position.set(cu.lumBase[0], 1.5, cu.lumBase[1]); } }
    };
    var couleurCuve = C.couleur(0x6aff40);
    function majCuves(dt, temps) {
      if (ressCuves) { ressCuves.texLiq.offset.y = -((temps * 0.06) % 1); ressCuves.texLiq.offset.x = Math.sin(temps * 0.21) * 0.03; }
      for (var i = 0; i < listeCuves.length; i++) {
        var cu = listeCuves[i], et = cu.etat, Rs = ressCuves;
        cu.t += dt;
        // niveau : vidange pendant le siphon et la fissure
        if (et === 'siphon') cu.niveau = Math.max(0.12, 1 - VIDANGE * cu.t);
        else if (et === 'fissure') cu.niveau = Math.max(0.1, cu.niveauDebut - VIDANGE * cu.t);
        majNiveau(cu);
        var agite = et === 'siphon' ? 1 : et === 'fissure' ? 1.6 : 0;
        // liquide qui défile et bouillonne
        cu.matLiq.opacity = 0.4 + 0.04 * Math.sin(temps * 2.3 + i);
        // bulles (affolées pendant le siphon : plus vites, tourbillon vers le haut)
        if (et !== 'eclate') {
          var Hl = H_SOCLE + (cu.Hv - 0.18) * cu.niveau, PB = cu.PB, hc = cu.Hv * cu.niveau;
          var kv = dt * (1 + agite * 3.2) / (hc > 0.3 ? hc : 0.3), ka = dt * (1.5 + agite * 2), kr = dt * 0.08 * agite;   // hors de la boucle (aucun appel par bulle)
          for (var k = 0; k < cu.bulles.length; k++) {
            var b = cu.bulles[k];
            b.y += b.v * kv;
            if (agite) { b.a += ka; var rb = b.r - kr; b.r = rb > 0.05 ? rb : 0.05; }
            if (b.y > 1) { b.y = 0; b.r = Math.sqrt(alea()) * (cu.r - 0.08); b.a = alea() * TAU; }
            var yb = H_SOCLE + 0.05 + b.y * (Hl - H_SOCLE - 0.06), wob = Math.sin(temps * 4 + b.ph) * 0.015 * (1 + agite * 2);
            PB[k * 3] = Math.cos(b.a) * b.r + wob; PB[k * 3 + 1] = yb; PB[k * 3 + 2] = Math.sin(b.a) * b.r;
          }
          cu.ptsB.geometry.attributes.position.needsUpdate = true;
        }
        // fissures : apparition progressive, éclat qui palpite
        if (et === 'fissure') {
          for (var f = 0; f < cu.fissures.length; f++) cu.fissures[f].material.opacity = 0.7 * U.smooth(f * 0.25, f * 0.25 + 0.15, cu.t) * (0.7 + 0.3 * Math.sin(temps * 30 + f * 2));
        }
        // flaque qui s'étale après l'éclatement
        if (et === 'eclate') { var ke = U.smooth(0, 0.7, cu.t); cu.flaque.scale.set(0.3 + 0.7 * ke, 0.3 + 0.7 * ke, 1); cu.matFl.opacity = 0.85 * ke * (0.9 + 0.1 * Math.sin(temps * 3 + i)); }
        // dormeur : léger balancement ; s'agite pendant le siphon ; à l'éclatement, bascule vers l'ouverture puis l'entité prend le relais
        if (cu.dormeur && et !== 'eclate') {
          cu.dormeur.animer(temps + i * 7, agite);
          cu.dormeur.groupe.position.y = cu.yDormeur + (agite ? (alea() - 0.5) * 0.02 * agite : 0) - (1 - cu.niveau) * (cu.kD > 1.2 ? 0.05 : 0.25);
        } else if (cu.dormeur && cu.dormeur.groupe.visible) {
          var kd = U.smooth(0, DELAI_DORMEUR, cu.t);
          cu.dormeur.animer(temps + i * 7, 2.2 * (1 - kd));
          cu.dormeur.groupe.rotation.x = 0.55 * kd; cu.dormeur.groupe.position.z = 0.02 + 0.3 * kd * cu.kD;
          if (cu.t >= DELAI_DORMEUR) cu.dormeur.groupe.visible = false;
        }
        // lumière : stable (intact), vacillante (siphon), stroboscopique (fissure), faible au-dessus de la flaque (éclatée)
        if (!cu.empruntee) {
          var L = cu.lumiere, mult = L.userData.multiplicateur != null ? L.userData.multiplicateur : 1, base, I0 = cu.intensiteBase;
          if (et === 'intact') base = I0 * (0.94 + 0.06 * Math.sin(temps * 1.7 + i * 3));
          else if (et === 'siphon') base = I0 * (0.7 + 0.5 * alea());
          else if (et === 'fissure') base = I0 * (alea() < 0.3 ? 0.2 : 1.3 + 0.4 * alea());
          else base = I0 * Math.max(0.22, 1 - cu.t * 1.2) * (0.9 + 0.1 * Math.sin(temps * 3));
          L.intensity = base * mult;
        }
      }
    }

    construireSalle();
    construireBunker();
    preparerLumieresBonus();

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // SALLE SECRÈTE
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    function construireSalle() {
      var S = ARENE.salle, O = S.origine || { x: 0, y: 0, z: 0 };
      var scene = new THREE.Scene();
      scene.name = 'salle';
      scene.background = C.couleur(0x020203);
      scene.fog = new THREE.FogExp2(C.couleur(0x05060a).getHex(), 0.024);
      monde.scenes.salle = scene;
      var racine = new THREE.Group(); racine.position.set(O.x, O.y, O.z); scene.add(racine);
      monde.racineSalle = racine;
      monde.origineSalle = O;
      var A = S.apotheme, Hm = S.hauteur, a = S.limiteJoueurs + 0.1;   // façade des dalles (14,4)
      var tan8 = Math.tan(PI / 8), h = a * tan8;
      var aP = A;                                                      // mur porteur (15)
      var accP = new Accu(), accPF = new Accu(), accSol = new Accu(), accFer = new Accu(), accBois = new Accu();
      var teinte = function (k) { return U.lin(k); };
      var colMur = [1, 1, 1], colSombre = [0.62, 0.6, 0.58], colTresSombre = [0.42, 0.4, 0.38];
      var E = 2.5;                                                     // une texture de pierre couvre 2,5 m
      // point sur la face d'un mur k : (u le long du mur, y, profondeur radiale r)
      function P(k, u, y, r) {
        var th = k * PI / 4, nx = Math.sin(th), nz = Math.cos(th), tx = Math.cos(th), tz = -Math.sin(th);
        return [nx * r + tx * u, y, nz * r + tz * u];
      }
      // rectangle de façade (vu depuis l'intérieur : normale −n)
      function facade(acc, k, u0, u1, y0, y1, r, col) {
        acc.quad(P(k, u1, y0, r), P(k, u0, y0, r), P(k, u0, y1, r), P(k, u1, y1, r),
          [u1 / E, y0 / E, u0 / E, y0 / E, u0 / E, y1 / E, u1 / E, y1 / E], col);
      }
      for (var k = 0; k < 8; k++) {
        // façade (14,4) avec 3 ouvertures pour les dalles
        facade(accP, k, -h, h, 0, 0.7, a, colMur);
        facade(accP, k, -h, h, 3.3, Hm, a, colMur);
        [[-h, -5.6], [-2.4, -1.6], [1.6, 2.4], [5.6, h]].forEach(function (s) { facade(accP, k, s[0], s[1], 0.7, 3.3, a, colMur); });
        // renfoncements derrière les dalles : fond (15) et 4 côtés
        [-4, 0, 4].forEach(function (off) {
          var u0 = off - 1.6, u1 = off + 1.6, y0 = 0.7, y1 = 3.3;
          facade(accPF, k, u0, u1, y0, y1, aP, colSombre);
          // côtés : gauche (u0) regarde vers +u, droite (u1) vers −u, bas regarde +y, haut regarde −y
          accPF.quad(P(k, u0, y0, a), P(k, u0, y0, aP), P(k, u0, y1, aP), P(k, u0, y1, a), [0, 0, 0.24, 0, 0.24, 1.04, 0, 1.04], colTresSombre);
          accPF.quad(P(k, u1, y0, aP), P(k, u1, y0, a), P(k, u1, y1, a), P(k, u1, y1, aP), [0, 0, 0.24, 0, 0.24, 1.04, 0, 1.04], colTresSombre);
          accPF.quad(P(k, u0, y0, a), P(k, u1, y0, a), P(k, u1, y0, aP), P(k, u0, y0, aP), [0, 0, 1.28, 0, 1.28, 0.24, 0, 0.24], colTresSombre);
          accPF.quad(P(k, u1, y1, a), P(k, u0, y1, a), P(k, u0, y1, aP), P(k, u1, y1, aP), [0, 0, 1.28, 0, 1.28, 0.24, 0, 0.24], colTresSombre);
        });
        // plinthe (0–0,35 m, saillie 0,12) et corniche (3,55–3,85 m, saillie 0,18)
        var hp = h - 0.3;
        facade(accPF, k, -hp, hp, 0, 0.35, a - 0.12, colSombre);
        accPF.quad(P(k, hp, 0.35, a - 0.12), P(k, -hp, 0.35, a - 0.12), P(k, -hp, 0.35, a), P(k, hp, 0.35, a), [0, 0, 4, 0, 4, 0.05, 0, 0.05], colSombre);
        facade(accPF, k, -hp, hp, 3.55, 3.85, a - 0.18, colSombre);
        accPF.quad(P(k, hp, 3.85, a - 0.18), P(k, -hp, 3.85, a - 0.18), P(k, -hp, 3.85, a), P(k, hp, 3.85, a), [0, 0, 4, 0, 4, 0.07, 0, 0.07], colSombre);
        accPF.quad(P(k, -hp, 3.55, a - 0.18), P(k, hp, 3.55, a - 0.18), P(k, hp, 3.55, a), P(k, -hp, 3.55, a), [0, 0, 4, 0, 4, 0.07, 0, 0.07], colTresSombre);
        // bandeau haut (sous la voûte)
        facade(accPF, k, -hp, hp, 7.55, 7.85, a - 0.22, colSombre);
        accPF.quad(P(k, -hp, 7.55, a - 0.22), P(k, hp, 7.55, a - 0.22), P(k, hp, 7.55, a), P(k, -hp, 7.55, a), [0, 0, 4, 0, 4, 0.09, 0, 0.09], colTresSombre);
      }
      // colonnettes d'angle
      var colGeo = new THREE.CylinderGeometry(0.3, 0.34, Hm + 0.4, 14, 1, true);
      var uvCol = { u: TAU * 0.32 / E, v: (Hm + 0.4) / E };
      var rv = a / Math.cos(PI / 8);
      for (var c = 0; c < 8; c++) {
        var ang = (c + 0.5) * PI / 4;
        accPF.geo(THREE, colGeo, matTRS(THREE, Math.sin(ang) * (rv - 0.12), (Hm + 0.4) / 2, Math.cos(ang) * (rv - 0.12)), colSombre, uvCol);
      }
      // sol (octogone au niveau du mur porteur) et incrustation de l'anneau
      var R0 = aP / Math.cos(PI / 8), ES = 6;
      for (var s = 0; s < 8; s++) {
        var a0 = (s - 0.5) * PI / 4, a1 = (s + 0.5) * PI / 4;
        var p0 = [Math.sin(a0) * R0, 0, Math.cos(a0) * R0], p1 = [Math.sin(a1) * R0, 0, Math.cos(a1) * R0];
        var ci = accSol.sommet(0, 0, 0, 0, 1, 0, 0, 0, colMur);
        accSol.sommet(p1[0], 0, p1[2], 0, 1, 0, p1[0] / ES, p1[2] / ES, colMur);
        accSol.sommet(p0[0], 0, p0[2], 0, 1, 0, p0[0] / ES, p0[2] / ES, colMur);
        accSol.i.push(ci, ci + 2, ci + 1);
      }
      // voûte octogonale : du haut des murs (y = Hm) à l'oculus (rayon 1,6, y = 11,5)
      var yV = 11.5, rc = 1.6, accV = new Accu();
      for (var v = 0; v < 8; v++) {
        var b0 = (v - 0.5) * PI / 4, b1 = (v + 0.5) * PI / 4;
        var q0 = [Math.sin(b0) * rv, Hm, Math.cos(b0) * rv], q1 = [Math.sin(b1) * rv, Hm, Math.cos(b1) * rv];
        var q2 = [Math.sin(b1) * rc / Math.cos(PI / 8), yV, Math.cos(b1) * rc / Math.cos(PI / 8)], q3 = [Math.sin(b0) * rc / Math.cos(PI / 8), yV, Math.cos(b0) * rc / Math.cos(PI / 8)];
        // vue d'en dessous : ordre q1, q0, q3, q2
        accV.quad(q1, q0, q3, q2, [0, 0, 5.2, 0, 5.2, 5.6, 0, 5.6], colSombre);
        // nervure le long de l'arête
        var dx = q3[0] - q0[0], dy = q3[1] - q0[1], dz = q3[2] - q0[2], L = Math.hypot(dx, dy, dz);
        var m = new THREE.Matrix4().lookAt(new THREE.Vector3(q0[0], q0[1], q0[2]), new THREE.Vector3(q3[0], q3[1], q3[2]), new THREE.Vector3(0, 1, 0));
        m.setPosition((q0[0] + q3[0]) / 2, (q0[1] + q3[1]) / 2 - 0.12, (q0[2] + q3[2]) / 2);
        accPF.geo(THREE, new THREE.BoxGeometry(0.42, 0.42, L), m, colSombre, E);
      }
      // anneau de l'oculus et puits sombre
      accPF.geo(THREE, new THREE.TorusGeometry(rc + 0.25, 0.28, 8, 24), matTRS(THREE, 0, yV, 0, PI / 2, 0, 0), colSombre, E);
      var puits = new THREE.Mesh(new THREE.CylinderGeometry(rc, rc, 3, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }));
      puits.position.set(0, yV + 1.5, 0); racine.add(puits);
      // piliers destructibles (fût, socle, bagues, brasero) : un groupe par pilier (API §13)
      S.piliers.forEach(function (pl, ip) { construirePilier(racine, pl, ip, colSombre, E); });
      // inscriptions murales peintes (une grande par mur, rouge brun délavé)
      var matPeinture = matStd({ couleur: 0x4a0d08, alphaMap: atlas, rough: 0.95, decal: true });
      matPeinture.opacity = 0.75;
      for (var w = 0; w < 8; w++) {
        var g = new THREE.PlaneGeometry(2.3, 2.3);
        var gi = (w * 5 + 3) % 16;
        setUvCellule(g, gi);
        var me = new THREE.Mesh(g, matPeinture);
        var th = w * PI / 4;
        me.position.set(Math.sin(th) * (a - 0.01), 5.7, Math.cos(th) * (a - 0.01));
        me.rotation.y = th + PI;
        racine.add(me);
      }
      // anneau gravé au sol (rituel endormi) et incrustation sombre
      var rr = S.cercle.rayon + 0.4;
      var annGeo = new THREE.RingGeometry(S.cercle.rayon - 0.05, S.cercle.rayon + 0.4, 64, 1);
      var ann = new THREE.Mesh(annGeo, matStd({ couleur: 0x15110f, rough: 0.7, decal: true }));
      ann.rotation.x = -PI / 2; ann.position.y = 0.002; racine.add(ann);
      var grav = new THREE.Mesh(new THREE.PlaneGeometry(rr * 2, rr * 2), matStd({ couleur: 0x0a0807, alphaMap: anneau, rough: 0.6, decal: true }));
      grav.material.opacity = 0.9;
      grav.rotation.x = -PI / 2; grav.position.y = 0.004; racine.add(grav);
      monde.anneauSol = grav;
      // brèches : fosse sombre + grille articulée
      monde.breches = [];
      S.breches.forEach(function (b, i) {
        var d = h2(b.x, b.z) || 1, yaw = Math.atan2(b.x / d, b.z / d);
        var fosse = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: texFosse, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        fosse.rotation.set(-PI / 2, 0, yaw); fosse.position.set(b.x, 0.006, b.z); racine.add(fosse);
        var grille = new THREE.Group();
        var gFer = new Accu();
        for (var q = -3; q <= 3; q++) gFer.geo(THREE, new THREE.BoxGeometry(0.05, 0.05, 1.3), matTRS(THREE, q * 0.18, 0, 0.65), [0.7, 0.7, 0.7], 0.5);
        gFer.geo(THREE, new THREE.BoxGeometry(1.3, 0.06, 0.08), matTRS(THREE, 0, 0, 0.04), [0.7, 0.7, 0.7], 0.5);
        gFer.geo(THREE, new THREE.BoxGeometry(1.3, 0.06, 0.08), matTRS(THREE, 0, 0, 1.26), [0.7, 0.7, 0.7], 0.5);
        var gm = new THREE.Mesh(gFer.construire(THREE), mat.fer);
        grille.add(gm);
        // charnière côté mur : la grille se soulève vers le centre de la salle
        grille.position.set(b.x + Math.sin(yaw) * 0.65, 0.04, b.z + Math.cos(yaw) * 0.65);
        grille.rotation.y = yaw + PI;
        racine.add(grille);
        monde.breches.push({ id: b.id, x: b.x, z: b.z, grille: grille, ouverture: 0, cible: 0, minuteur: 0 });
      });
      // autel nord
      var al = S.autel;
      accPF.geo(THREE, new THREE.BoxGeometry(1.7, 0.95, 0.85), matTRS(THREE, al.x, 0.475, al.z), colSombre, E);
      accPF.geo(THREE, new THREE.BoxGeometry(1.95, 0.12, 1.05), matTRS(THREE, al.x, 1.0, al.z), colSombre, E);
      accFer.geo(THREE, new THREE.LatheGeometry([new THREE.Vector2(0.01, 0), new THREE.Vector2(0.12, 0.02), new THREE.Vector2(0.26, 0.12), new THREE.Vector2(0.3, 0.18), new THREE.Vector2(0.27, 0.19), new THREE.Vector2(0.01, 0.08)], 18), matTRS(THREE, al.x, 1.06, al.z), [1.2, 0.85, 0.45], 0.4);
      for (var cdl = 0; cdl < 5; cdl++) {
        var cxx = al.x - 0.75 + cdl * 0.375, czz = al.z + (cdl % 2 ? 0.25 : -0.28), hc = 0.12 + (cdl % 3) * 0.06;
        accBois.geo(THREE, new THREE.CylinderGeometry(0.035, 0.04, hc, 8), matTRS(THREE, cxx, 1.06 + hc / 2, czz), [2.2, 2.1, 1.9], 0.3);
        flammeEn(racine, cxx, 1.06 + hc + 0.04, czz, 0.12, 1);
      }
      lumiere(racine, 'salle', 0xffa050, 30, 8, al.x, 1.7, al.z - 0.4, 0.2);
      monde.autelSalle = { x: al.x, y: 1.2, z: al.z };
      // lustre (couronne de fer, bougies, chaînes vers l'oculus)
      var ly = 7.2;
      accFer.geo(THREE, new THREE.TorusGeometry(1.4, 0.05, 6, 40), matTRS(THREE, 0, ly, 0, PI / 2, 0, 0), [0.7, 0.7, 0.7], 0.5);
      accFer.geo(THREE, new THREE.TorusGeometry(0.9, 0.035, 6, 30), matTRS(THREE, 0, ly + 0.25, 0, PI / 2, 0, 0), [0.7, 0.7, 0.7], 0.5);
      for (var cb = 0; cb < 12; cb++) {
        var an = cb / 12 * TAU, cx2 = Math.sin(an) * 1.4, cz2 = Math.cos(an) * 1.4;
        accBois.geo(THREE, new THREE.CylinderGeometry(0.03, 0.035, 0.18, 6), matTRS(THREE, cx2, ly + 0.12, cz2), [2.2, 2.1, 1.9], 0.3);
        flammeEn(racine, cx2, ly + 0.25, cz2, 0.11, 1);
      }
      chaine(accFer, [0, yV + 0.2, 0], [0, ly + 0.3, 0], 0.07);
      for (var ch = 0; ch < 3; ch++) { var ah = ch / 3 * TAU; chaine(accFer, [0, ly + 1.6, 0], [Math.sin(ah) * 1.38, ly + 0.04, Math.cos(ah) * 1.38], 0.05); }
      lumiere(racine, 'salle', 0xffc890, 90, 24, 0, ly - 0.3, 0, 0.12);
      // chaînes suspendues le long des murs
      var RCH = U.rng(77);
      for (var cc = 0; cc < 9; cc++) {
        var ac = (cc + 0.5) / 9 * TAU + 0.11;
        var r1 = 11.2 + RCH() * 1.6, xh = Math.sin(ac) * r1, zh = Math.cos(ac) * r1;
        var bas = 3.6 + RCH() * 2.4;
        var hautY = Hm + (A - r1) / (A - rc) * (yV - Hm);
        chaine(accFer, [xh, hautY, zh], [xh, bas, zh], 0.06);
        accFer.geo(THREE, new THREE.TorusGeometry(0.1, 0.022, 5, 10, PI * 1.3), matTRS(THREE, xh, bas - 0.12, zh, 0, ac, PI * 0.85), [0.7, 0.7, 0.7], 0.3);
      }
      // traces d'expériences (coins, dos au mur) — gabarits compacts pour ne pas gêner les dalles
      var coins = [];
      for (var kc = 0; kc < 8; kc++) {
        var ac2 = (kc + 0.5) * PI / 4, rcn = 12.9;
        coins.push({ x: Math.sin(ac2) * rcn, z: Math.cos(ac2) * rcn, yaw: ac2 + PI });
      }
      var col = monde.collisions.salle = new Collisions({ x: -17, z: -17 }, { x: 17, z: 17 });
      tableLabo(accBois, accFer, racine, coins[0], col, 1);
      // v1.3 : les 2 cuves vertes de l'arène (API §15.1), aux emplacements des anciennes cuves brisées
      var tubesArene = (S.tubes && S.tubes.length) ? S.tubes : [
        { id: 'tube0', x: coins[1].x, z: coins[1].z, lacet: coins[1].yaw, rayon: 0.85, hauteur: 2.6, miniBoss: 'survolte' },
        { id: 'tube1', x: coins[5].x, z: coins[5].z, lacet: coins[5].yaw, rayon: 0.85, hauteur: 2.6, miniBoss: 'irradie' }];
      tubesArene.forEach(function (T0, it) { construireCuve(accFer, racine, col, T0, it); });
      tableOperation(accFer, racine, coins[2], col);
      caisses(accBois, accFer, coins[3], col, 4);
      caisses(accBois, accFer, coins[4], col, 5);
      tableLabo(accBois, accFer, racine, coins[6], col, 7);
      // v1.4 : la cage, qui chevauchait l'autel (déplacé en v1.1), passe à côté de lui, vers le mur nord-ouest (toujours à droite
      // de la 3e cuve vue du centre)
      var aCage = 327 * PI / 180;
      cage(accFer, { x: Math.sin(aCage) * 12.9, z: Math.cos(aCage) * 12.9, yaw: aCage + PI }, col);
      // câbles au sol, par cuve : vers le centre de la salle (cuves des coins) ; le long du mur s'ils passeraient sur une brèche
      tubesArene.forEach(function (T0, ii) { cablesSol(accFer, T0, ii, S.breches || []); });
      // maillages fusionnés
      function ajouter(acc, m, solide, ombre) {
        if (acc.vide()) return null;
        var me = new THREE.Mesh(acc.construire(THREE), m);
        me.receiveShadow = true; me.castShadow = !!ombre;
        racine.add(me);
        if (solide) {
          if (me.geometry.index.count / 3 > 1500) Array.prototype.push.apply(monde.solides.salle, decouperPourTir(THREE, me, racine, 4));
          else monde.solides.salle.push(me);
        }
        return me;
      }
      ajouter(accP, mat.pierre, true, true);
      ajouter(accPF, mat.pierreFine, true, true);
      ajouter(accSol, mat.sol, true, false);
      ajouter(accV, mat.pierreFine, true, false);
      ajouter(accFer, mat.fer, true, true);
      ajouter(accBois, mat.bois, true, true);
      // dalles arrachables
      construireDalles(racine, S);
      // collisions de la salle : octogone jouable + piliers (base comprise)
      for (var kk = 0; kk < 8; kk++) { var t2 = kk * PI / 4; col.plan(Math.sin(t2), Math.cos(t2), S.limiteJoueurs); }
      pilierListe.forEach(function (P) { P.collision = col.cercle(P.x, P.z, 1.12); P.collision.pilier = P.id; });
      col.boite(al.x, al.z, 0.98, 0.53, 0);
      // lumières : ambiance froide, puits de lumière depuis l'oculus, accents rouges
      var hemi = new THREE.HemisphereLight(C.couleur(0x5a6c92), C.couleur(0x1c1414), 2.6);
      racine.add(hemi); monde.lumieres.salle.push(hemi);
      var spot = new THREE.SpotLight(C.couleur(0x7f9fd8), 1100, 30, 0.34, 0.9, 2);
      spot.position.set(0, yV + 1.0, 0); spot.target.position.set(0, 0, 0);
      racine.add(spot); racine.add(spot.target);
      spot.castShadow = !!opts.ombres;
      if (spot.castShadow) { spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; }
      monde.lumieres.salle.push(spot); monde.spotOculus = spot;
      // accents rouges : hauts, contre les angles des murs (entre les brèches et loin de l'arrivée) pour baigner
      // murs et glyphes sans saturer les zombies qui sortent des brèches ni les joueurs
      // v1.4 (budget de lumières inchangé) : un accent à moins de 6 m d'une cuve est remplacé par la lumière de la cuve (3e cuve,
      // milieu du mur nord : l'accent du coin nord-est disparaît ; avec les 2 cuves des coins, les 4 accents restent)
      [22.5, 112.5, 202.5, 292.5].forEach(function (deg) {
        var a = deg * PI / 180, ax = Math.sin(a) * 13.0, az = Math.cos(a) * 13.0;
        if ((S.tubes || []).some(function (T0) { return h2(T0.x - ax, T0.z - az) < 6; })) return;
        lumiere(racine, 'salle', 0xff1408, 34, 14, ax, 4.4, az, 0.1);
      });
      racine.add(puitsDeLumiere(rc, yV, 3.0));
      racine.add(poussiere(220, 2.6, yV));
      // navigation
      var gr = new NAV.Grille({ lieu: 'salle', min: { x: O.x - 16, z: O.z - 16 }, max: { x: O.x + 16, z: O.z + 16 }, pas: 0.5, rayonAgent: 0.4 });
      gr.horsSolSi(function (x, z) {
        var lx = x - O.x, lz = z - O.z;
        for (var q = 0; q < 8; q++) { var tq = q * PI / 4; if (lx * Math.sin(tq) + lz * Math.cos(tq) > S.limiteJoueurs) return true; }
        return false;
      });
      monde.grilles.salle = gr;
      majGrilleSalle();                                  // piliers (selon leur état) + obstacles des collisions
      monde.points.salle = {
        arrivee: S.arriveeJoueurs.map(function (p) { return { x: O.x + p.x, y: O.y + p.y, z: O.z + p.z, lacet: p.lacet }; }),
        retour: S.retourSalle.map(function (p) { return { x: O.x + p.x, y: O.y + p.y, z: O.z + p.z, lacet: p.lacet }; }),
        breches: S.breches.map(function (p) { return { x: O.x + p.x, y: O.y, z: O.z + p.z }; }),
        centre: { x: O.x, y: O.y, z: O.z }
      };
    }

    // ── dalles ──
    function construireDalles(racine, S) {
      var geo = new THREE.BoxGeometry(3.14, 2.56, 0.6);
      // UV en mètres sur chaque face (texture de pierre de 2,5 m)
      var Pz = geo.attributes.position.array, Nz = geo.attributes.normal.array, Uv = geo.attributes.uv.array;
      for (var i = 0; i < geo.attributes.position.count; i++) {
        var x = Pz[i * 3], y = Pz[i * 3 + 1], z = Pz[i * 3 + 2], nx = Math.abs(Nz[i * 3]), ny = Math.abs(Nz[i * 3 + 1]);
        if (nx > 0.5) { Uv[i * 2] = z / 3.2 + 0.5; Uv[i * 2 + 1] = y / 2.6 + 0.5; } else if (ny > 0.5) { Uv[i * 2] = x / 3.2 + 0.5; Uv[i * 2 + 1] = z / 3.2; } else { Uv[i * 2] = x / 3.2 + 0.5; Uv[i * 2 + 1] = y / 2.6 + 0.5; }
      }
      var col = new Float32Array(geo.attributes.position.count * 3).fill(0.86);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var matGravure = matStd({ couleur: 0x050403, alphaMap: atlas, rough: 0.8, decal: true });
      matGravure.opacity = 1.0;
      var matResidu = matStd({ couleur: 0x5a0c06, emissive: 0x2a0402, emissiveIntensite: 0.6, alphaMap: atlas, rough: 0.9, decal: true });
      matResidu.opacity = 0.55;
      var matFiss = new THREE.MeshBasicMaterial({ map: texFissures, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      matFiss.toneMapped = false;   // le cœur rougeoyant garde sa couleur
      S.dalles.forEach(function (d, i) {
        var grp = new THREE.Group();
        var m = new THREE.Mesh(geo, mat.pierreDalle);
        m.castShadow = true; m.receiveShadow = true;
        grp.add(m);
        var gg = new THREE.PlaneGeometry(1.5, 1.5); setUvCellule(gg, (i * 7 + 1) % 16);
        var grav = new THREE.Mesh(gg, matGravure); grav.position.z = 0.302; grp.add(grav);
        var res = new THREE.Mesh(gg, matResidu); res.position.z = 0.303; res.scale.setScalar(1.04); grp.add(res);
        var fm = matFiss.clone();
        var fiss = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.5), fm); fiss.position.z = 0.305; fiss.visible = false; grp.add(fiss);
        var yaw = Math.atan2(d.normale.x, d.normale.z);
        var base = { x: d.centre.x, y: d.centre.y, z: d.centre.z, yaw: yaw };
        grp.position.set(d.centre.x, d.centre.y, d.centre.z);
        grp.rotation.set(0, yaw, 0, 'XYZ');
        racine.add(grp);
        monde.solides.salle.push(m);
        dalles[d.id] = { id: d.id, groupe: grp, mesh: m, fissure: fiss, base: base, etat: 'mur', index: i, actif: d.actif !== false };
      });
      // fragments de reconstruction (instanciés : 24 × 6)
      var fg = new THREE.BoxGeometry(1, 1, 1);
      fragments = new THREE.InstancedMesh(fg, mat.pierreDalle, S.dalles.length * 6);
      fragments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      var cache0 = new THREE.Matrix4().makeScale(0, 0, 0);
      for (var f = 0; f < S.dalles.length * 6; f++) fragments.setMatrixAt(f, cache0);
      fragments.frustumCulled = false;
      racine.add(fragments);
      var Rf = U.rng(99);
      for (var j = 0; j < S.dalles.length * 6; j++) fragInfo.push({ dx: Rf.entre(-1.1, 1.1), dy: Rf.entre(-0.9, 0.9), sx: Rf.entre(0.6, 1.1), sy: Rf.entre(0.5, 0.9), ox: Rf.entre(-2.5, 2.5), oz: Rf.entre(1.5, 4.5), rot: Rf.entre(-3, 3) });
    }
    monde.dalle = function (id) { return dalles[id] ? dalles[id].groupe : null; };
    /** API §8 : applique l'état des blocs donné par la logique. */
    monde.appliquerBlocs = function (blocs, temps) {
      for (var id in vus) vus[id] = false;
      if (blocs) for (var i = 0; i < blocs.length; i++) {
        var b = blocs[i], d = dalles[b.id];
        if (!d) continue;
        vus[b.id] = true;
        appliquer(d, b);
      }
      for (var id2 in dalles) if (!vus[id2] && dalles[id2].etat !== 'mur') remettre(dalles[id2]);
    };
    function remettre(d) {
      d.etat = 'mur';
      d.groupe.visible = true; d.mesh.visible = true;
      d.groupe.position.set(d.base.x, d.base.y, d.base.z);
      d.groupe.rotation.set(0, d.base.yaw, 0, 'XYZ');
      d.groupe.scale.setScalar(1);
      d.fissure.visible = false; d.fissure.material.opacity = 0;
      cacherFragments(d.index);
    }
    function appliquer(d, b) {
      var e = b.etat;
      if (e === 'fissure') {
        if (d.etat !== 'fissure' && d.etat !== 'mur') remettre(d);
        d.etat = 'fissure';
        d.groupe.visible = true;
        d.groupe.position.set(d.base.x, d.base.y, d.base.z);
        d.groupe.rotation.set(0, d.base.yaw, 0, 'XYZ');
        d.fissure.visible = true;
        var t = b.t || 0, k = U.clamp(t / (b.duree || 0.6), 0, 1);
        d.fissure.material.opacity = 0.25 + 0.75 * k;
        d.fissure.scale.set(0.6 + 0.4 * k, 0.6 + 0.4 * k, 1);
        // léger tremblement
        var tr = 0.012 * k;
        d.groupe.position.x += (Math.sin(t * 91) * tr); d.groupe.position.y += Math.cos(t * 77) * tr;
        cacherFragments(d.index);
      } else if (e === 'arrache' || e === 'levitation' || e === 'vol') {
        d.etat = e;
        d.groupe.visible = true;
        if (b.position) d.groupe.position.set(b.position.x, b.position.y, b.position.z);
        if (b.rotation) d.groupe.rotation.set(b.rotation.x || 0, b.rotation.y || 0, b.rotation.z || 0, 'XYZ');
        d.fissure.visible = true; d.fissure.material.opacity = 1;
        cacherFragments(d.index);
      } else if (e === 'impact' || e === 'absent') {
        d.etat = e;
        d.groupe.visible = false;
        cacherFragments(d.index);
      } else if (e === 'reconstruction') {
        d.etat = e;
        var du = b.duree || 2.0, kk = U.clamp((b.t || 0) / du, 0, 1);
        reconstruire(d, kk);
      }
    }
    function cacherFragments(i) {
      _m4.makeScale(0, 0, 0);
      for (var f = 0; f < 6; f++) fragments.setMatrixAt(i * 6 + f, _m4);
      fragments.instanceMatrix.needsUpdate = true;
    }
    function reconstruire(d, k) {
      // les fragments reviennent du sol vers la dalle (0 → 0,85), puis la dalle réapparaît (0,85 → 1)
      var bx = d.base.x, by = d.base.y, bz = d.base.z, yaw = d.base.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw);
      var kf = U.smooth(0, 0.85, k);
      for (var f = 0; f < 6; f++) {
        var I = fragInfo[d.index * 6 + f];
        var lx = I.dx, ly = I.dy;                          // position finale locale
        var sx0 = lx + I.ox, sz0 = I.oz, sy0 = -by + 0.3;  // départ au sol, devant le mur
        var x = U.lerp(sx0, lx, kf), y = U.lerp(sy0, ly, kf) + Math.sin(kf * PI) * 1.2, z = U.lerp(sz0, 0, kf);
        _v.set(bx + x * cy + z * sy, by + y, bz - x * sy + z * cy);
        _e.set(I.rot * (1 - kf), yaw + I.rot * 0.5 * (1 - kf), 0, 'XYZ'); _q.setFromEuler(_e);
        var sc = k < 0.98 ? 1 : 0;
        _s.set(I.sx * 0.9 * sc, I.sy * 0.9 * sc, 0.5 * sc);
        _m4.compose(_v, _q, _s);
        fragments.setMatrixAt(d.index * 6 + f, _m4);
      }
      fragments.instanceMatrix.needsUpdate = true;
      d.groupe.visible = k > 0.8;
      d.groupe.position.set(d.base.x, d.base.y, d.base.z);
      d.groupe.rotation.set(0, d.base.yaw, 0, 'XYZ');
      var sc2 = U.smooth(0.8, 1.0, k);
      d.groupe.scale.set(1, 1, Math.max(0.05, sc2));
      d.fissure.visible = k < 1; d.fissure.material.opacity = 1 - sc2;
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // MAQUETTE DE BUNKER 7 (centrée en x = +200)
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    function construireBunker() {
      var scene = new THREE.Scene();
      scene.name = 'bunker';
      scene.background = C.couleur(0x030304);
      scene.fog = new THREE.FogExp2(C.couleur(0x060607).getHex(), 0.03);
      monde.scenes.bunker = scene;
      var racine = new THREE.Group(); racine.position.set(OX_BUNKER, 0, 0); scene.add(racine);
      monde.racineBunker = racine;
      var HB = 3.4;
      // pièces et couloirs (rectangles x0, z0, x1, z1) — repère local de la maquette
      var ZONES = [
        { nom: 'Hall central', r: [-9, -7, 9, 7] },
        { nom: 'Salle des machines', r: [-12, 13, 12, 22] },
        { nom: 'Dortoir', r: [-12, -22, 12, -13] },
        { nom: 'Armurerie', r: [16, -10, 29, 10] },
        { nom: 'Infirmerie', r: [-29, -10, -16, 10] },
        { nom: 'Couloir N', r: [-1.5, 7, 1.5, 13] },
        { nom: 'Couloir S', r: [-1.5, -13, 1.5, -7] },
        { nom: 'Couloir E', r: [9, -1.5, 16, 1.5] },
        { nom: 'Couloir O', r: [-16, -1.5, -9, 1.5] },
        { nom: 'Boucle NE', r: [12, 16, 25, 19] }, { nom: 'Boucle NE2', r: [22, 10, 25, 16] },
        { nom: 'Boucle SE', r: [12, -19, 25, -16] }, { nom: 'Boucle SE2', r: [22, -16, 25, -10] },
        { nom: 'Boucle SO', r: [-25, -19, -12, -16] }, { nom: 'Boucle SO2', r: [-25, -16, -22, -10] },
        { nom: 'Boucle NO', r: [-25, 16, -12, 19] }, { nom: 'Boucle NO2', r: [-25, 10, -22, 16] }
      ];
      monde.zonesBunker = ZONES;
      var pas = 0.5, X0 = -30, Z0 = -23, NX = 120, NZ = 92;
      var solG = new Uint8Array(NX * NZ);
      ZONES.forEach(function (zn) {
        var r = zn.r;
        for (var z = Math.round((r[1] - Z0) / pas); z < Math.round((r[3] - Z0) / pas); z++)
          for (var x = Math.round((r[0] - X0) / pas); x < Math.round((r[2] - X0) / pas); x++) solG[z * NX + x] = 1;
      });
      var estSol = function (x, z) { return x >= 0 && z >= 0 && x < NX && z < NZ && solG[z * NX + x] === 1; };
      // segments de murs (bords sol / vide) fusionnés
      var segsH = [], segsV = [];
      for (var z = 0; z <= NZ; z++) {
        var debut = -1, sens = 0;
        for (var x = 0; x <= NX; x++) {
          var a = estSol(x, z - 1), b = estSol(x, z), s = (a !== b) ? (b ? 1 : -1) : 0;   // s=1 : sol au-dessus (z+), mur au sud de la cellule
          if (s !== sens || s === 0) {
            if (sens !== 0 && debut >= 0) segsH.push({ z: Z0 + z * pas, x0: X0 + debut * pas, x1: X0 + x * pas, sens: sens });
            debut = s !== 0 ? x : -1; sens = s;
          }
        }
      }
      for (var x2 = 0; x2 <= NX; x2++) {
        var debut2 = -1, sens2 = 0;
        for (var z2 = 0; z2 <= NZ; z2++) {
          var a2 = estSol(x2 - 1, z2), b2 = estSol(x2, z2), s2 = (a2 !== b2) ? (b2 ? 1 : -1) : 0;
          if (s2 !== sens2 || s2 === 0) {
            if (sens2 !== 0 && debut2 >= 0) segsV.push({ x: X0 + x2 * pas, z0: Z0 + debut2 * pas, z1: Z0 + z2 * pas, sens: sens2 });
            debut2 = s2 !== 0 ? z2 : -1; sens2 = s2;
          }
        }
      }
      var accM = new Accu(), accS = new Accu(), accPl = new Accu(), accF = new Accu(), accB = new Accu(), accFr = new Accu(), accT = new Accu();
      var E = 3.0, colM = [1, 1, 1];
      var col = monde.collisions.bunker = new Collisions({ x: OX_BUNKER - 31, z: -24 }, { x: OX_BUNKER + 31, z: 24 });
      segsH.forEach(function (sg) {
        // face visible depuis le sol : si sens=1 le sol est en z+, la face regarde vers +z
        var z = sg.z, x0 = sg.x0, x1 = sg.x1;
        if (sg.sens === 1) accM.quad([x0, 0, z], [x1, 0, z], [x1, HB, z], [x0, HB, z], [x0 / E, 0, x1 / E, 0, x1 / E, HB / E, x0 / E, HB / E], colM);
        else accM.quad([x1, 0, z], [x0, 0, z], [x0, HB, z], [x1, HB, z], [x1 / E, 0, x0 / E, 0, x0 / E, HB / E, x1 / E, HB / E], colM);
        col.segment(OX_BUNKER + x0, z, OX_BUNKER + x1, z);
      });
      segsV.forEach(function (sg) {
        var x = sg.x, z0 = sg.z0, z1 = sg.z1;
        if (sg.sens === 1) accM.quad([x, 0, z1], [x, 0, z0], [x, HB, z0], [x, HB, z1], [z1 / E, 0, z0 / E, 0, z0 / E, HB / E, z1 / E, HB / E], colM);
        else accM.quad([x, 0, z0], [x, 0, z1], [x, HB, z1], [x, HB, z0], [z0 / E, 0, z1 / E, 0, z1 / E, HB / E, z0 / E, HB / E], colM);
        col.segment(OX_BUNKER + x, z0, OX_BUNKER + x, z1);
      });
      // sols et plafonds (par zone) + plinthes sombres
      ZONES.forEach(function (zn) {
        var r = zn.r, c1 = [1, 1, 1];
        accS.quad([r[0], 0, r[3]], [r[2], 0, r[3]], [r[2], 0, r[1]], [r[0], 0, r[1]], [r[0] / 4, r[3] / 4, r[2] / 4, r[3] / 4, r[2] / 4, r[1] / 4, r[0] / 4, r[1] / 4], c1);
        accPl.quad([r[0], HB, r[1]], [r[2], HB, r[1]], [r[2], HB, r[3]], [r[0], HB, r[3]], [r[0] / 4, r[1] / 4, r[2] / 4, r[1] / 4, r[2] / 4, r[3] / 4, r[0] / 4, r[3] / 4], [0.55, 0.55, 0.55]);
      });
      // poutres au plafond des grandes pièces, tuyaux le long des couloirs
      var R = U.rng(1907);
      ZONES.slice(0, 5).forEach(function (zn) {
        var r = zn.r, longX = (r[2] - r[0]) > (r[3] - r[1]);
        var n = Math.floor((longX ? r[2] - r[0] : r[3] - r[1]) / 3);
        for (var i = 1; i < n; i++) {
          if (longX) { var xb = r[0] + i * (r[2] - r[0]) / n; accM.geo(THREE, new THREE.BoxGeometry(0.35, 0.4, r[3] - r[1]), matTRS(THREE, xb, HB - 0.2, (r[1] + r[3]) / 2), [0.7, 0.7, 0.7], E); }
          else { var zb = r[1] + i * (r[3] - r[1]) / n; accM.geo(THREE, new THREE.BoxGeometry(r[2] - r[0], 0.4, 0.35), matTRS(THREE, (r[0] + r[2]) / 2, HB - 0.2, zb), [0.7, 0.7, 0.7], E); }
        }
      });
      // tuyaux : longent certains murs à 2,9 m
      segsH.concat(segsV).forEach(function (sg, i) {
        if (i % 3 !== 0) return;
        var horiz = sg.z !== undefined, L = horiz ? sg.x1 - sg.x0 : sg.z1 - sg.z0;
        if (L < 3) return;
        var off = 0.18 * sg.sens;
        var m = horiz ? matTRS(THREE, (sg.x0 + sg.x1) / 2, 2.95, sg.z + off, 0, 0, PI / 2) : matTRS(THREE, sg.x + off, 2.95, (sg.z0 + sg.z1) / 2, PI / 2, 0, 0);
        accF.geo(THREE, new THREE.CylinderGeometry(0.07, 0.07, L, 8, 1, true), m, [0.55, 0.6, 0.55], 1);
        var m2 = horiz ? matTRS(THREE, (sg.x0 + sg.x1) / 2, 3.12, sg.z + off * 1.4, 0, 0, PI / 2) : matTRS(THREE, sg.x + off * 1.4, 3.12, (sg.z0 + sg.z1) / 2, PI / 2, 0, 0);
        accF.geo(THREE, new THREE.CylinderGeometry(0.045, 0.045, L, 6, 1, true), m2, [0.75, 0.5, 0.35], 1);
      });
      // encadrements de portes aux jonctions couloir / pièce
      var portes = [
        [0, 7, 'x'], [0, 13, 'x'], [0, -7, 'x'], [0, -13, 'x'], [9, 0, 'z'], [16, 0, 'z'], [-9, 0, 'z'], [-16, 0, 'z'],
        [12, 17.5, 'z'], [23.5, 10, 'x'], [12, -17.5, 'z'], [23.5, -10, 'x'], [-12, -17.5, 'z'], [-23.5, -10, 'x'], [-12, 17.5, 'z'], [-23.5, 10, 'x']
      ];
      portes.forEach(function (p) {
        var largeur = 3.0, ex = p[2] === 'x';
        var cx = p[0], cz = p[1];
        // montants et linteau en acier
        var mts = ex ? [[cx - largeur / 2, cz], [cx + largeur / 2, cz]] : [[cx, cz - largeur / 2], [cx, cz + largeur / 2]];
        mts.forEach(function (m) { accFr.geo(THREE, new THREE.BoxGeometry(0.2, 2.5, 0.2), matTRS(THREE, m[0], 1.25, m[1]), [0.6, 0.6, 0.6], 1); });
        accFr.geo(THREE, ex ? new THREE.BoxGeometry(largeur + 0.2, 0.2, 0.25) : new THREE.BoxGeometry(0.25, 0.2, largeur + 0.2), matTRS(THREE, cx, 2.55, cz), [0.6, 0.6, 0.6], 1);
        accM.geo(THREE, ex ? new THREE.BoxGeometry(largeur, HB - 2.65, 0.3) : new THREE.BoxGeometry(0.3, HB - 2.65, largeur), matTRS(THREE, cx, 2.65 + (HB - 2.65) / 2, cz), [0.8, 0.8, 0.8], E);
      });
      // mobilier : caisses, fûts, sacs de sable, lits, armoires, établis, générateurs
      function caisse(x, z, s, yaw, empile) {
        accB.geo(THREE, new THREE.BoxGeometry(s, s, s), matTRS(THREE, x, s / 2, z, 0, yaw, 0), [0.85, 0.8, 0.75], 1);
        if (empile) accB.geo(THREE, new THREE.BoxGeometry(s * 0.8, s * 0.8, s * 0.8), matTRS(THREE, x + 0.05, s + s * 0.4, z - 0.04, 0, yaw + 0.3, 0), [0.75, 0.7, 0.65], 1);
        col.boite(OX_BUNKER + x, z, s / 2, s / 2, yaw);
      }
      function fut(x, z) {
        accF.geo(THREE, new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), matTRS(THREE, x, 0.45, z), R() < 0.5 ? [0.5, 0.6, 0.45] : [0.75, 0.35, 0.25], 1);
        col.cercle(OX_BUNKER + x, z, 0.32);
      }
      function sacs(x, z, L, yaw) {
        for (var i = 0; i < L / 0.6; i++) for (var j = 0; j < 3; j++) {
          var off = (i - (L / 0.6 - 1) / 2) * 0.6 + (j % 2) * 0.3;
          accT.geo(THREE, new THREE.SphereGeometry(0.3, 8, 5), matTRS(THREE, x + Math.cos(yaw) * off, 0.14 + j * 0.24, z - Math.sin(yaw) * off, 0, yaw, 0, 1, 0.45, 0.6), U.lin(0xb09a74), 1);
        }
        col.boite(OX_BUNKER + x, z, L / 2, 0.32, yaw);
      }
      function lit(x, z, yaw) {
        accF.geo(THREE, new THREE.BoxGeometry(0.9, 0.06, 2.0), matTRS(THREE, x, 0.45, z, 0, yaw, 0), [0.6, 0.6, 0.6], 1);
        accF.geo(THREE, new THREE.BoxGeometry(0.9, 0.06, 2.0), matTRS(THREE, x, 1.45, z, 0, yaw, 0), [0.6, 0.6, 0.6], 1);
        accB.geo(THREE, new THREE.BoxGeometry(0.85, 0.12, 1.9), matTRS(THREE, x, 0.54, z, 0, yaw, 0), [1.3, 1.25, 1.1], 1);
        accB.geo(THREE, new THREE.BoxGeometry(0.85, 0.12, 1.9), matTRS(THREE, x, 1.54, z, 0, yaw, 0), [1.3, 1.25, 1.1], 1);
        for (var c = 0; c < 4; c++) {
          var lx = (c % 2 ? 0.42 : -0.42), lz = (c < 2 ? 0.97 : -0.97);
          accF.geo(THREE, new THREE.BoxGeometry(0.05, 1.8, 0.05), matTRS(THREE, x + lx * Math.cos(yaw) + lz * Math.sin(yaw), 0.9, z - lx * Math.sin(yaw) + lz * Math.cos(yaw)), [0.5, 0.5, 0.5], 1);
        }
        col.boite(OX_BUNKER + x, z, 0.47, 1.02, yaw);
      }
      function armoire(x, z, yaw) {
        accF.geo(THREE, new THREE.BoxGeometry(0.9, 2.0, 0.5), matTRS(THREE, x, 1.0, z, 0, yaw, 0), [0.45, 0.55, 0.45], 1);
        col.boite(OX_BUNKER + x, z, 0.46, 0.27, yaw);
      }
      function etabli(x, z, yaw, L) {
        L = L || 2.2;
        accB.geo(THREE, new THREE.BoxGeometry(L, 0.08, 0.8), matTRS(THREE, x, 0.9, z, 0, yaw, 0), [1, 1, 1], 1);
        [-1, 1].forEach(function (s) { accF.geo(THREE, new THREE.BoxGeometry(0.06, 0.88, 0.7), matTRS(THREE, x + Math.cos(yaw) * s * (L / 2 - 0.1), 0.44, z - Math.sin(yaw) * s * (L / 2 - 0.1), 0, yaw, 0), [0.5, 0.5, 0.5], 1); });
        col.boite(OX_BUNKER + x, z, L / 2, 0.42, yaw);
      }
      function generateur(x, z, yaw) {
        accF.geo(THREE, new THREE.BoxGeometry(2.4, 1.5, 1.2), matTRS(THREE, x, 0.75, z, 0, yaw, 0), [0.5, 0.58, 0.48], 1);
        accF.geo(THREE, new THREE.CylinderGeometry(0.45, 0.45, 1.3, 16), matTRS(THREE, x + Math.cos(yaw) * 0.4, 1.6, z - Math.sin(yaw) * 0.4, PI / 2, yaw, 0), [0.45, 0.45, 0.42], 1);
        accF.geo(THREE, new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), matTRS(THREE, x - Math.cos(yaw) * 0.8, 2.4, z + Math.sin(yaw) * 0.8), [0.4, 0.4, 0.4], 1);
        col.boite(OX_BUNKER + x, z, 1.25, 0.65, yaw);
      }
      // hall : sacs de sable, caisses, table
      sacs(-5, 3.5, 3, 0); sacs(5, -3.5, 3, 0); caisse(-7.5, -5.5, 0.9, 0.2, true); caisse(7.6, 5.4, 0.8, -0.3, true); fut(-7.8, 5.6); fut(-7.2, 6.1); etabli(6.5, -6.2, 0, 2.4);
      // salle des machines
      generateur(-7, 19.5, 0); generateur(0, 19.8, 0); generateur(7, 19.5, 0); fut(10.5, 14.5); fut(11, 15.3); caisse(-10.6, 14.6, 1.0, 0.1, true); etabli(-4, 15.2, 0, 2.0);
      // dortoir
      for (var bb = 0; bb < 5; bb++) { lit(-10 + bb * 2.4, -20.5, 0); }
      for (var bb2 = 0; bb2 < 3; bb2++) { lit(4 + bb2 * 2.4, -20.5, 0); }
      armoire(10.8, -14.2, 0); armoire(9.7, -14.2, 0); caisse(-11, -14.5, 0.8, 0.4, false);
      // armurerie
      for (var ar = 0; ar < 4; ar++) armoire(28.4, -7.5 + ar * 1.2, -PI / 2);
      caisse(19, 8.5, 1.0, 0, true); caisse(20.4, 8.3, 0.9, 0.5, false); etabli(22.5, -8.9, 0, 3.0); fut(17, -9); sacs(22.5, 2.5, 3.6, PI / 2);
      // infirmerie
      lit(-26.5, 7, PI / 2); lit(-26.5, 3, PI / 2); lit(-26.5, -1, PI / 2); etabli(-18, 8.6, 0, 2.2); armoire(-17, -9.4, 0); caisse(-27.8, -8.6, 0.8, 0.2, true);
      // boucles : quelques caisses, jamais en travers du passage
      caisse(24.2, 18.3, 0.7, 0.3, false); caisse(-24.2, -18.3, 0.7, 0.2, false); fut(-13, 18.4); fut(13, -18.4);
      // lampes murales (une sur deux allumée, certaines vacillent)
      var lampes = [
        [-4.5, 6.8, PI, 1], [-8.8, -4, PI / 2, 1], [8.8, 4, -PI / 2, 0], [4.5, -6.8, 0, 1], [0, 21.8, PI, 1], [-11.8, 14.5, PI / 2, 2], [11.8, 14.5, -PI / 2, 0],
        [0, -21.8, 0, 1], [11.8, -14.5, -PI / 2, 2], [28.8, 0, -PI / 2, 1], [16.2, 8, PI / 2, 0], [-28.8, 0, PI / 2, 1], [-16.2, -8, -PI / 2, 2],
        [24.8, 14.5, -PI / 2, 1], [24.8, -14.5, -PI / 2, 0], [-24.8, -14.5, PI / 2, 1], [-24.8, 14.5, PI / 2, 2]
      ];
      lampes.forEach(function (l) {
        var x = l[0], z = l[1], yaw = l[2], et = l[3];
        accF.geo(THREE, new THREE.BoxGeometry(0.28, 0.2, 0.14), matTRS(THREE, x, 2.6, z, 0, yaw, 0), [0.5, 0.5, 0.5], 1);
        if (et > 0) {
          var bulbe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat.lampe);
          bulbe.position.set(OX_BUNKER + x + Math.sin(yaw) * 0.1, 2.55, z + Math.cos(yaw) * 0.1); scene.add(bulbe);
          var L = lumiere(racine, 'bunker', 0xffc27a, 90, 18, x + Math.sin(yaw) * 0.35, 2.45, z + Math.cos(yaw) * 0.35, et === 2 ? 0.9 : 0.05);
          if (et === 2) L.panne = true;
        }
      });
      // marquages au pochoir (texte neutre)
      var marques = [['B7', 4.5, 6.98, PI], ['HALL', -8.98, 3, PI / 2], ['07', 0, 21.98, PI], ['DORTOIR', 0, -21.98, 0], ['ARMURERIE', 28.98, 4, -PI / 2], ['INFIRMERIE', -28.98, 4, PI / 2], ['MACHINES', 6, 21.98, PI], ['HALL →', 16.02, -4.5, PI / 2]];
      marques.forEach(function (mq) {
        var cv = U.canvas(512, 128), g = cv.getContext('2d');
        g.clearRect(0, 0, 512, 128); g.fillStyle = 'rgba(230,226,215,0.85)'; g.font = 'bold 78px "Arial Narrow", Arial, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mq[0], 256, 66);
        var t = T(cv, { clamp: true });
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        pl.position.set(OX_BUNKER + mq[1] + Math.sin(mq[3]) * 0.01, 1.9, mq[2] + Math.cos(mq[3]) * 0.01); pl.rotation.y = mq[3];
        scene.add(pl);
      });
      function ajouter(acc, m) {
        if (acc.vide()) return;
        var me = new THREE.Mesh(acc.construire(THREE), m);
        me.receiveShadow = true;
        racine.add(me);
        if (me.geometry.index.count / 3 > 1500) Array.prototype.push.apply(monde.solides.bunker, decouperPourTir(THREE, me, racine, 6));
        else monde.solides.bunker.push(me);
      }
      ajouter(accM, mat.beton); ajouter(accS, mat.betonSol); ajouter(accPl, mat.beton); ajouter(accF, mat.fer); ajouter(accB, mat.bois); ajouter(accFr, mat.ferRouge); ajouter(accT, mat.crasse);
      var hemi = new THREE.HemisphereLight(C.couleur(0x5a6470), C.couleur(0x1e1912), 2.2);
      racine.add(hemi); monde.lumieres.bunker.push(hemi);
      // navigation
      var gr = new NAV.Grille({ lieu: 'bunker', min: { x: OX_BUNKER + X0, z: Z0 }, max: { x: OX_BUNKER + X0 + NX * pas, z: Z0 + NZ * pas }, pas: 0.5, rayonAgent: 0.4 });
      gr.horsSolSi(function (x, z) { return !estSol(Math.floor((x - OX_BUNKER - X0) / pas), Math.floor((z - Z0) / pas)); });
      col.prims.forEach(function (p) {
        if (p.t === 2) gr.solideBoite(p.x, p.z, p.hx, p.hz, Math.atan2(p.s, p.c), false);
        else if (p.t === 1) gr.solideCercle(p.x, p.z, p.r, false);
      });
      monde.grilles.bunker = gr.finaliser();
      var P = function (x, z, lacet) { return { x: OX_BUNKER + x, y: 0, z: z, lacet: lacet || 0 }; };
      monde.points.bunker = {
        arrivee: [P(-2, -2, 0), P(2, -2, 0), P(-2, 2, PI), P(2, 2, PI)],
        boss: [P(0, 18, PI), P(0, -18, 0), P(23, 0, -PI / 2), P(-23, 0, PI / 2), P(23.5, 15, PI), P(-23.5, -15, 0), P(23.5, -15, 0), P(-23.5, 15, PI)],
        retour: [P(-3, 0, PI / 2), P(3, 0, -PI / 2), P(0, -4, 0), P(0, 4, PI)],
        zombies: [P(-11, 21, 0), P(11, 21, 0), P(-11, -21, 0), P(11, -21, 0), P(28, 9, 0), P(28, -9, 0), P(-28, 9, 0), P(-28, -9, 0), P(18.5, 17.5, 0), P(-18.5, -17.5, 0)]
      };
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // Éléments de décor
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    function chaine(acc, a, b, ep) {
      var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
      var n = Math.max(2, Math.floor(L / (ep * 2.6)));
      var link = new THREE.TorusGeometry(ep, ep * 0.28, 4, 8);
      for (var i = 0; i < n; i++) {
        var t = (i + 0.5) / n, x = a[0] + dx * t, y = a[1] + dy * t, z = a[2] + dz * t;
        var m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(dx, dy, dz), new THREE.Vector3(0, 0, 1));
        var r = new THREE.Matrix4().makeRotationY(i % 2 ? PI / 2 : 0);
        var s = new THREE.Matrix4().makeScale(1, 1.6, 1);
        var rx = new THREE.Matrix4().makeRotationX(PI / 2);
        m.multiply(rx).multiply(r).multiply(s);
        m.setPosition(x, y, z);
        acc.geo(THREE, link, m, [0.62, 0.6, 0.58], 0.3);
      }
    }
    function tableLabo(accB, accF, racine, c, col, graine) {
      var R = U.rng(graine * 31), yaw = c.yaw;
      var m = function (lx, ly, lz) { return matTRS(THREE, c.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), ly, c.z - lx * Math.sin(yaw) + lz * Math.cos(yaw), 0, yaw, 0); };
      accB.geo(THREE, new THREE.BoxGeometry(1.5, 0.07, 0.75), m(0, 0.92, 0), [0.8, 0.75, 0.7], 1);
      [[-0.68, -0.32], [0.68, -0.32], [-0.68, 0.32], [0.68, 0.32]].forEach(function (p) { accF.geo(THREE, new THREE.BoxGeometry(0.05, 0.9, 0.05), m(p[0], 0.45, p[1]), [0.6, 0.6, 0.6], 1); });
      accB.geo(THREE, new THREE.BoxGeometry(1.4, 0.04, 0.65), m(0, 0.3, 0), [0.6, 0.55, 0.5], 1);
      // flacons, bocaux (liquides lumineux), feuilles
      var mats = [mat.liquideVert, mat.liquideAmbre, mat.liquideRouge];
      for (var i = 0; i < 6; i++) {
        var lx = -0.6 + i * 0.24 + R.entre(-0.04, 0.04), lz = R.entre(-0.2, 0.2), hh = R.entre(0.14, 0.32), rr = R.entre(0.04, 0.08);
        var verre = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, hh, 10, 1, true), mat.verre);
        var p = m(lx, 0.955 + hh / 2, lz); verre.applyMatrix4(p); racine.add(verre);
        var liq = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.9, rr * 0.9, hh * R.entre(0.3, 0.8), 10), mats[i % 3]);
        liq.applyMatrix4(m(lx, 0.955 + hh * 0.3, lz)); racine.add(liq);
      }
      var feuille = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), matStd({ couleur: 0x8a8070, rough: 1 }));
      feuille.rotation.x = -PI / 2; feuille.applyMatrix4(m(0.35, 0.96, 0.12)); racine.add(feuille);
      col.boite(c.x, c.z, 0.78, 0.4, yaw);
    }
    function tableOperation(accF, racine, c, col) {
      var yaw = c.yaw;
      var m = function (lx, ly, lz, rx) { return matTRS(THREE, c.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), ly, c.z - lx * Math.sin(yaw) + lz * Math.cos(yaw), rx || 0, yaw, 0); };
      accF.geo(THREE, new THREE.BoxGeometry(0.75, 0.08, 1.9), m(0, 0.92, 0), [0.75, 0.75, 0.72], 1);
      accF.geo(THREE, new THREE.CylinderGeometry(0.12, 0.25, 0.88, 12), m(0, 0.44, 0), [0.55, 0.55, 0.52], 1);
      [-0.55, 0, 0.55].forEach(function (z) { accF.geo(THREE, new THREE.BoxGeometry(0.8, 0.02, 0.08), m(0, 0.97, z), [0.35, 0.22, 0.14], 1); });
      accF.geo(THREE, new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), m(0.55, 1.0, -0.95), [0.6, 0.6, 0.6], 1);
      accF.geo(THREE, new THREE.BoxGeometry(0.04, 0.04, 1.0), m(0.55, 1.95, -0.45), [0.6, 0.6, 0.6], 1);
      accF.geo(THREE, new THREE.CylinderGeometry(0.06, 0.22, 0.2, 14, 1, true), m(0.55, 1.85, 0.05), [0.5, 0.5, 0.48], 1);
      var tache = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), matStd({ couleur: 0x2a0503, rough: 0.4, decal: true }));
      tache.rotation.x = -PI / 2; tache.scale.set(1, 1.6, 1); tache.position.set(c.x, 0.004, c.z); racine.add(tache);
      col.boite(c.x, c.z, 0.42, 1.0, yaw);
    }
    function caisses(accB, accF, c, col, graine) {
      var R = U.rng(graine * 13);
      var m = function (lx, ly, lz, ry) { return matTRS(THREE, c.x + lx * Math.cos(c.yaw) + lz * Math.sin(c.yaw), ly, c.z - lx * Math.sin(c.yaw) + lz * Math.cos(c.yaw), 0, c.yaw + (ry || 0), 0); };
      accB.geo(THREE, new THREE.BoxGeometry(0.85, 0.85, 0.85), m(-0.3, 0.425, 0.1, R.entre(-0.2, 0.2)), [0.85, 0.8, 0.75], 1);
      accB.geo(THREE, new THREE.BoxGeometry(0.65, 0.65, 0.65), m(-0.25, 1.175, 0.05, R.entre(-0.4, 0.4)), [0.75, 0.7, 0.65], 1);
      accF.geo(THREE, new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), m(0.55, 0.45, -0.2), [0.5, 0.3, 0.22], 1);
      col.boite(c.x, c.z, 0.85, 0.55, c.yaw);
    }
    function cage(accF, c, col) {
      var m = function (lx, ly, lz, rx) { return matTRS(THREE, c.x + lx * Math.cos(c.yaw) + lz * Math.sin(c.yaw), ly, c.z - lx * Math.sin(c.yaw) + lz * Math.cos(c.yaw), rx || 0, c.yaw, 0); };
      var w = 1.2, hh = 2.0;
      for (var i = 0; i <= 6; i++) {
        var t = -w / 2 + i * w / 6;
        accF.geo(THREE, new THREE.CylinderGeometry(0.02, 0.02, hh, 5), m(t, hh / 2, -w / 2), [0.6, 0.6, 0.6], 1);
        accF.geo(THREE, new THREE.CylinderGeometry(0.02, 0.02, hh, 5), m(t, hh / 2, w / 2), [0.6, 0.6, 0.6], 1);
        accF.geo(THREE, new THREE.CylinderGeometry(0.02, 0.02, hh, 5), m(-w / 2, hh / 2, t), [0.6, 0.6, 0.6], 1);
        if (i !== 3) accF.geo(THREE, new THREE.CylinderGeometry(0.02, 0.02, hh, 5), m(w / 2, hh / 2, t), [0.6, 0.6, 0.6], 1);
      }
      accF.geo(THREE, new THREE.BoxGeometry(w + 0.1, 0.06, w + 0.1), m(0, hh, 0), [0.6, 0.6, 0.6], 1);
      accF.geo(THREE, new THREE.BoxGeometry(w + 0.1, 0.06, w + 0.1), m(0, 0.03, 0), [0.6, 0.6, 0.6], 1);
      col.boite(c.x, c.z, w / 2 + 0.05, w / 2 + 0.05, c.yaw);
    }
    function cablesSol(accF, T0, ii, breches) {
      var d0 = h2(T0.x, T0.z) || 1, ux = -T0.x / d0, uz = -T0.z / d0, gene = false;
      for (var b = 0; b < breches.length; b++) {                      // une brèche devant la cuve (moins de 1,6 m du tracé vers le centre) ?
        var bx = breches[b].x - T0.x, bz = breches[b].z - T0.z, t = bx * ux + bz * uz;
        if (t > 0 && t < 4.5 && Math.abs(bx * uz - bz * ux) < 1.6) gene = true;
      }
      for (var cbl = 0; cbl < 3; cbl++) {
        var pts = [];
        for (var k = 0; k <= 12; k++) {
          var f = k / 12;
          if (!gene) {
            var rr2 = d0 - 0.4 - f * 3.5, aa = Math.atan2(T0.x, T0.z) + (cbl - 1) * 0.05 + Math.sin(f * 7 + ii + cbl) * 0.03;
            pts.push(new THREE.Vector3(Math.sin(aa) * rr2, 0.035, Math.cos(aa) * rr2));
          } else {
            // le long du mur : deux câbles d'un côté, un de l'autre, du socle vers les coins
            var cote = cbl < 2 ? 1 : -1, lat = cote * (0.95 + f * (2.4 + cbl * 0.35)), recul = 0.55 + 0.35 * Math.sin(PI * f) + cbl * 0.09 + Math.sin(f * 6 + cbl) * 0.04;
            var tx = -uz, tz = ux;                                       // tangente au mur
            pts.push(new THREE.Vector3(T0.x + tx * lat - ux * recul, 0.035, T0.z + tz * lat - uz * recul));
          }
        }
        accF.geo(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.03, 5), null, [0.25, 0.25, 0.25], 0.3);
      }
    }
    function setUvCellule(g, i) {
      var uv = g.attributes.uv.array, cx = (i % 4) / 4, cy = 1 - (Math.floor(i / 4) + 1) / 4;
      for (var k = 0; k < uv.length; k += 2) { uv[k] = cx + uv[k] / 4; uv[k + 1] = cy + uv[k + 1] / 4; }
      g.attributes.uv.needsUpdate = true;
    }
    function lumiere(racine, lieu, coul, intensite, portee, x, y, z, vacille) {
      var L = new THREE.PointLight(C.couleur(coul), intensite, portee, 2);
      L.position.set(x, y, z);
      racine.add(L);
      monde.lumieres[lieu].push(L);
      L.userData.base = intensite; L.userData.vacille = vacille || 0; L.userData.phase = Math.random() * 100;
      lumieresVacillantes.push(L);
      return L;
    }
    function flammeEn(racine, x, y, z, taille, nb) {
      var mt = new THREE.SpriteMaterial({ map: texFlamme, color: C.couleur(0xffa040), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      var liste = [];
      for (var i = 0; i < (nb || 1); i++) {
        var s = new THREE.Sprite(mt);
        s.position.set(x + (i ? (Math.random() - 0.5) * taille * 0.4 : 0), y + taille * 0.45, z + (i ? (Math.random() - 0.5) * taille * 0.4 : 0));
        s.scale.set(taille * 0.7, taille, 1);
        s.userData = { x: s.position.x, y: s.position.y, z: s.position.z, t: taille, ph: Math.random() * 10 };
        racine.add(s);
        flammes.push(s); liste.push(s);
      }
      return liste;
    }
    function braisesEn(racine, x, y, z, rayon, n) {
      var g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), V = [];
      for (var i = 0; i < n; i++) { P[i * 3] = x; P[i * 3 + 1] = y - 10; P[i * 3 + 2] = z; V.push({ vie: Math.random() * 2, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }); }
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      var m = new THREE.PointsMaterial({ map: texBraise, color: C.couleur(0xff7a2a), size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
      var pts = new THREE.Points(g, m); pts.frustumCulled = false;
      racine.add(pts);
      var sys = { pts: pts, P: P, V: V, x: x, y: y, z: z, r: rayon };
      braiseSystemes.push(sys);
      return sys;
    }
    function puitsDeLumiere(rc, yV, rBas) {
      var g = new THREE.CylinderGeometry(rc * 0.95, rBas, yV, 32, 1, true);
      var m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uCouleur: { value: new THREE.Color(0.32, 0.38, 0.5) }, uTemps: { value: 0 }, uIntensite: { value: 0.22 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-w.xyz); vY = uv.y; gl_Position = projectionMatrix*w; }',
        fragmentShader: 'uniform vec3 uCouleur; uniform float uTemps; uniform float uIntensite; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.2) * smoothstep(0.0, 0.3, vY) * (0.55 + 0.45*vY) * (0.85 + 0.15*sin(uTemps*0.7 + vY*6.0)); gl_FragColor = vec4(uCouleur * a * uIntensite, 1.0); }'
      });
      var me = new THREE.Mesh(g, m); me.position.y = yV / 2; me.renderOrder = 5;
      monde.puits = me;
      return me;
    }
    function poussiere(n, rayon, hauteur) {
      var g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), R = U.rng(5);
      for (var i = 0; i < n; i++) { var a = R() * TAU, r = Math.sqrt(R()) * rayon; P[i * 3] = Math.cos(a) * r; P[i * 3 + 1] = R() * hauteur; P[i * 3 + 2] = Math.sin(a) * r; }
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      var m = new THREE.PointsMaterial({ map: texBraise, color: C.couleur(0x7a8aa0), size: 0.035, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
      var pts = new THREE.Points(g, m); pts.frustumCulled = false;
      monde.poussiere = { pts: pts, P: P, n: n, h: hauteur, r: rayon };
      return pts;
    }

    // ── textures dessinées ──
    function dessinerFissures(n) {
      var c = U.canvas(n, n * 0.8 | 0), g = c.getContext('2d'), R = U.rng(404), W = c.width, H = c.height;
      g.clearRect(0, 0, W, H);
      function branche(x, y, a, L, ep, prof) {
        var enfants = [];
        g.beginPath(); g.moveTo(x, y);
        var pasL = 3 * W / 256, nL = Math.round(L / (W / 256));
        for (var i = 0; i < nL; i++) { a += (R() - 0.5) * 0.7; x += Math.cos(a) * pasL; y += Math.sin(a) * pasL; g.lineTo(x, y); if (prof < 3 && R() < 0.04) enfants.push([x, y, a + (R() - 0.5) * 1.6]); }
        g.lineWidth = ep; g.stroke();
        for (var e = 0; e < enfants.length; e++) branche(enfants[e][0], enfants[e][1], enfants[e][2], L * 0.5, ep * 0.6, prof + 1);
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      var s = W / 256;   // épaisseurs exprimées pour une texture de 256 px
      // 1) suie / éclats autour des fissures (large, peu opaque), 2) fissure sombre, 3) cœur rougeoyant
      var passes = [['rgba(10,6,4,0.35)', 13 * s], ['rgba(6,3,2,0.97)', 6.5 * s], ['rgba(255,92,40,1)', 2.4 * s]];
      passes.forEach(function (ps) {
        R = U.rng(404);
        g.strokeStyle = ps[0];
        for (var k = 0; k < 9; k++) { var a = k / 9 * TAU + R() * 0.3; branche(W / 2, H / 2, a, (26 + R() * 14) * s, ps[1], 0); }
      });
      // point d'impact central
      var gc = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 18 * s);
      gc.addColorStop(0, 'rgba(255,120,60,1)'); gc.addColorStop(0.35, 'rgba(120,20,8,0.9)'); gc.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gc; g.beginPath(); g.arc(W / 2, H / 2, 18 * s, 0, TAU); g.fill();
      return c;
    }
    function dessinerFlamme(n) {
      var c = U.canvas(n, n), g = c.getContext('2d');
      var gr = g.createRadialGradient(n / 2, n * 0.68, 0, n / 2, n * 0.62, n * 0.45);
      gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,190,80,0.9)'); gr.addColorStop(0.6, 'rgba(230,80,20,0.45)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(n / 2, n * 0.05);
      g.bezierCurveTo(n * 0.78, n * 0.35, n * 0.85, n * 0.75, n / 2, n * 0.95);
      g.bezierCurveTo(n * 0.15, n * 0.75, n * 0.22, n * 0.35, n / 2, n * 0.05);
      g.fill();
      return c;
    }
    function dessinerPoint(n) {
      var c = U.canvas(n, n), g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
      return c;
    }
    function dessinerFosse(n) {
      var c = U.canvas(n, n), g = c.getContext('2d');
      g.clearRect(0, 0, n, n);
      var gr = g.createRadialGradient(n / 2, n / 2, n * 0.1, n / 2, n / 2, n * 0.5);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.92)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(n * 0.08, n * 0.08, n * 0.84, n * 0.84);
      g.strokeStyle = 'rgba(20,16,14,1)'; g.lineWidth = n * 0.05; g.strokeRect(n * 0.1, n * 0.1, n * 0.8, n * 0.8);
      return c;
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // API
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    monde.lieuDe = function (x) { return x > OX_BUNKER / 2 ? 'bunker' : 'salle'; };
    monde.resoudre = function (lieu, pos, r) {
      var c = monde.collisions[lieu];
      monde.contactMur = false;
      if (!c) return false;
      var t;
      if (lieu === 'salle') {                       // collisions de la salle en repère local
        var O = ARENE.salle.origine || { x: 0, z: 0 };
        pos.x -= O.x; pos.z -= O.z;
        t = c.resoudre(pos, r);
        pos.x += O.x; pos.z += O.z;
      } else t = c.resoudre(pos, r);
      // v1.5 : après chaque appel, monde.contactMur dit si un mur de la salle (plan de l'octogone, pas un pilier ni un décor) a
      // repoussé le cercle, et monde.normaleMur sa normale sortante (projections contre les murs)
      if (c.contactPlan) { monde.contactMur = true; monde.normaleMur.x = c.planNx; monde.normaleMur.z = c.planNz; }
      return t;
    };
    monde.contactMur = false; monde.normaleMur = { x: 0, z: 0 };
    /** v1.5 : distance (m) de (x, z) au plan du mur le plus proche de la salle (apothème le long de la normale du mur) ; `out`
     *  facultatif reçoit la normale sortante { x, z }. Hors de la salle : Infinity. */
    monde.distanceMur = function (lieu, x, z, out) {
      if (lieu !== 'salle') return Infinity;
      var O = ARENE.salle.origine || { x: 0, z: 0 }, A = ARENE.salle.apotheme || 15, best = Infinity, bx = 0, bz = 0;
      for (var k = 0; k < 8; k++) {
        var th = k * PI / 4, nx = Math.sin(th), nz = Math.cos(th), d = A - ((x - O.x) * nx + (z - O.z) * nz);
        if (d < best) { best = d; bx = nx; bz = nz; }
      }
      if (out) { out.x = bx; out.z = bz; }
      return best;
    };
    monde.positionValide = function (p, lieu) { var g = monde.grilles[lieu || monde.lieuDe(p.x)]; return !!g && g.libre(p.x, p.z); };
    monde.visible = function (a, b, lieu) { var g = monde.grilles[lieu || monde.lieuDe(a.x)]; return !g || g.visible(a.x, a.z, b.x, b.z); };
    monde.chemin = function (a, b, lieu) {
      var g = monde.grilles[lieu || monde.lieuDe(a.x)];
      if (!g) return null;
      var c = g.astar(a.x, a.z, b.x, b.z);
      if (!c) return null;
      for (var i = 0; i < c.length; i++) c[i].y = 0;
      return c;
    };
    var _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _hits = [];
    /** Tir contre le décor (murs, sol, plafond, meubles, dalles en place). */
    monde.tir = function (lieu, o, d, max) {
      _o.set(o.x, o.y, o.z); _d.set(d.x, d.y, d.z).normalize();
      _ray.set(_o, _d); _ray.far = max || 200; _ray.near = 0;
      _hits.length = 0;
      var liste = monde.solides[lieu] || [];
      _ray.intersectObjects(liste, false, _hits);
      for (var i = 0; i < _hits.length; i++) {
        var h = _hits[i];
        if ((!h.object.visible && !h.object.userData.proxy) || (h.object.parent && !h.object.parent.visible)) continue;
        var n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        if (n.dot(_d) > 0) n.negate();
        return { distance: h.distance, point: { x: h.point.x, y: h.point.y, z: h.point.z }, normale: { x: n.x, y: n.y, z: n.z }, surface: h.object.material === mat.fer || h.object.material === mat.ferRouge ? 'metal' : h.object.material === mat.bois ? 'bois' : 'pierre' };
      }
      return null;
    };
    monde.ouvrirBreche = function (i, duree) {
      var b = monde.breches && monde.breches[i];
      if (!b) return;
      b.cible = 1; b.minuteur = duree || 2.2;
    };
    monde.brecheProche = function (x, z) {
      var best = -1, bd = 2.0;
      (monde.breches || []).forEach(function (b, i) { var d = h2(b.x - x, b.z - z); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    // autel : récompenses déposées, visibles (silhouette lumineuse qui tourne + étiquette)
    monde.autel = {
      deposer: function (o) {
        var g = new THREE.Group();
        var couleur = o.type === 'arme' ? 0xffc040 : o.type === 'atout' ? 0x40c0ff : 0xff6040;
        var corps = new THREE.Mesh(o.type === 'arme' ? new THREE.BoxGeometry(0.9, 0.12, 0.18) : new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: C.couleur(couleur) }));
        g.add(corps);
        var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBraise, color: C.couleur(couleur), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.set(1.2, 1.2, 1); g.add(halo);
        var cv = U.canvas(512, 96), gg = cv.getContext('2d');
        gg.fillStyle = 'rgba(0,0,0,0.55)'; gg.fillRect(0, 0, 512, 96);
        gg.fillStyle = '#ffe7b0'; gg.font = 'bold 40px Arial, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
        gg.fillText((o.id || '?') + (o.pap ? '  PaP ' + o.pap : ''), 256, 50);
        var lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T(cv, { clamp: true }), transparent: true, depthWrite: false }));
        lbl.scale.set(1.6, 0.3, 1); lbl.position.y = 0.45; g.add(lbl);
        var n = objetsAutel.length, a = monde.autelSalle;
        g.position.set(a.x - 0.6 + (n % 3) * 0.6, a.y + 0.35 + Math.floor(n / 3) * 0.6, a.z - 0.1);
        monde.racineSalle.add(g);
        var obj = { groupe: g, donnees: o, t: Math.random() * 6 };
        objetsAutel.push(obj);
        return obj;
      },
      retirer: function (obj) {
        var i = objetsAutel.indexOf(obj);
        if (i >= 0) objetsAutel.splice(i, 1);
        if (obj && obj.groupe && obj.groupe.parent) obj.groupe.parent.remove(obj.groupe);
      },
      liste: function () { return objetsAutel; }
    };

    /** Animations du décor : flammes, braises, lumières, grilles des brèches, poussière, puits de lumière. */
    monde.mettreAJour = function (dt, temps) {
      for (var i = 0; i < flammes.length; i++) {
        var f = flammes[i], u = f.userData, k = 0.75 + 0.25 * Math.sin(temps * 13 + u.ph) * Math.sin(temps * 7.3 + u.ph * 2);
        f.scale.set(u.t * 0.7 * (0.9 + 0.1 * Math.sin(temps * 9 + u.ph)), u.t * k * 1.1, 1);
        f.position.y = u.y + (k - 0.8) * u.t * 0.2;
      }
      for (var j = 0; j < lumieresVacillantes.length; j++) {
        var L = lumieresVacillantes[j], d = L.userData;
        if (d.panne) {                      // lampe en panne : coupures aléatoires
          var on = Math.sin(temps * 3.1 + d.phase) + Math.sin(temps * 17.7 + d.phase * 3) > -0.6;
          L.intensity = on ? d.base * (0.8 + 0.2 * alea()) : d.base * 0.05;
        } else if (d.vacille > 0) {
          L.intensity = d.base * (1 - d.vacille * 0.5 + d.vacille * 0.5 * (Math.sin(temps * 11 + d.phase) * 0.5 + Math.sin(temps * 23.4 + d.phase) * 0.3 + 0.2 * alea()));
        }
        if (d.multiplicateur != null) L.intensity *= d.multiplicateur;
        if (d.extinction != null) L.intensity *= d.extinction;     // brasero d'un pilier effondré
      }
      for (var b = 0; b < braiseSystemes.length; b++) {
        var s = braiseSystemes[b];
        if (!s.pts.visible) continue;
        for (var k2 = 0; k2 < s.V.length; k2++) {
          var e = s.V[k2];
          e.vie -= dt;
          if (e.vie <= 0) {
            e.vie = 1.2 + alea() * 1.6; e.x = s.x + (alea() - 0.5) * s.r * 2; e.y = s.y; e.z = s.z + (alea() - 0.5) * s.r * 2;
            e.vx = (alea() - 0.5) * 0.3; e.vy = 0.6 + alea() * 0.9; e.vz = (alea() - 0.5) * 0.3;
          }
          e.x += e.vx * dt + Math.sin(temps * 3 + k2) * 0.002; e.y += e.vy * dt; e.z += e.vz * dt;
          s.P[k2 * 3] = e.x; s.P[k2 * 3 + 1] = e.y; s.P[k2 * 3 + 2] = e.z;
        }
        s.pts.geometry.attributes.position.needsUpdate = true;
      }
      if (monde.breches) for (var q = 0; q < monde.breches.length; q++) {
        var br = monde.breches[q];
        if (br.minuteur > 0) { br.minuteur -= dt; if (br.minuteur <= 0) br.cible = 0; }
        br.ouverture += (br.cible - br.ouverture) * Math.min(1, dt * 6);
        br.grille.rotation.x = -br.ouverture * 1.75;
      }
      if (monde.poussiere) {
        var Pp = monde.poussiere.P;
        for (var n2 = 0; n2 < monde.poussiere.n; n2++) {
          Pp[n2 * 3 + 1] -= dt * 0.05; Pp[n2 * 3] += Math.sin(temps * 0.3 + n2) * dt * 0.02;
          if (Pp[n2 * 3 + 1] < 0) Pp[n2 * 3 + 1] += monde.poussiere.h;
        }
        monde.poussiere.pts.geometry.attributes.position.needsUpdate = true;
      }
      if (monde.puits) monde.puits.material.uniforms.uTemps.value = temps;
      majTousBonus(dt);
      majCuves(dt, temps);
      for (var o2 = 0; o2 < objetsAutel.length; o2++) { var ob = objetsAutel[o2]; ob.t += dt; ob.groupe.children[0].rotation.y = ob.t * 1.5; ob.groupe.position.y += Math.sin(ob.t * 2) * 0.002; }
    };
    /** Multiplie l'intensité de toutes les lumières d'un lieu (obscurité de la phase 5, coupures). */
    monde.intensiteLumieres = function (lieu, k) {
      monde.lumieres[lieu].forEach(function (L) { if (L.userData.base != null) L.userData.multiplicateur = k; else { if (L.userData.base0 == null) L.userData.base0 = L.intensity; L.intensity = L.userData.base0 * k; } });
    };
    monde.OX_BUNKER = OX_BUNKER;
    return monde;
  }

  var API = { creer: creer, OX_BUNKER: OX_BUNKER, Collisions: Collisions, Accu: Accu };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Monde = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
