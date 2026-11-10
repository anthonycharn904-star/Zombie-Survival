/*!
 * boss-modele.js — Zombie Survival, Bunker 7 : modèle 3D animé du boss final (antagoniste surnaturel et monstrueux).
 * Corps skinné (long manteau d'officier usé aux pans en lambeaux animés par une physique de ressorts, tunique,
 * ceinturon, baudrier, culotte, bottes hautes, gants de cuir noir), tête cuite (BOSS_B7_TETE) ou tête de
 * remplacement, ailes d'énergie (phase 2), Lames du Pacte (phase 5, création originale), voile d'immunité, aura,
 * dissolution, et une bibliothèque de poses pour chaque action et étape du combat.
 * Aucun symbole réel : aucun insigne, brassard, aigle, croix ni rune. Les sceaux brûlés dans le tissu et la broche
 * sont des motifs occultes inventés (anneaux, heptagone, sept rayons, glyphes imaginaires).
 *
 * Utilisation (three.js r128 en script global, ou r150+ en module : THREE est toujours passé en paramètre) :
 *   const modele = BossB7Modele.creer(THREE, { renderer, tete: globalThis.BOSS_B7_TETE || null, qualite: 'haute' });
 *   scene.add(modele.object);          // origine aux pieds, regarde vers +Z
 *   modele.update(dt, vue);             // vue = combat.etat().boss (+ vue.temps) : place, oriente et anime tout
 *   modele.reagir(dirX, dirZ, force);   // sursaut à l'impact (direction de la balle, repère monde)
 *   modele.flash(couleur, intensite);   // éclair d'émission bref
 *   modele.points.mainG … pointeLameD;  // ancres (Object3D) pour les effets
 *   modele.hitboxes();                  // [{ zone: 'tete'|'corps', type: 'sphere', centre, rayon }] en monde
 *   modele.couleurLames('bleu');        // v2.2 : 'bleu' | 'rouge' | 'vert' (ou vue.couleurLames ; null = rouge)
 *   modele.dispose();
 * Contrat complet : boss/API.md §2, §5, §6, §16.6. Options supplémentaires : solY (hauteur du sol, nombre ou fonction
 * (x, z)) pour les poses au sol, ombres (true), gouttes (true : gouttes de sang des lames gérées ici), couleursLineaires,
 * couleurLames ('rouge'), allege (false : instance légère pour les illusions de la phase 5, voir src/modele/README.md).
 *
 * Fichier assemblé depuis boss/src/modele/parts/*.js (boss/src/modele/outils/assembler.py). Code original ; les
 * outils de maillage (lofts, poids de peau, squelette) reprennent le modèle « survivant » de la même session.
 */
(function (root) {
  'use strict';

  // ============================================================================================
  // Outils communs : bruit, couleurs, petits vecteurs, anneaux de lofts, poids de peau.
  // Origine : repris (et adapté) de ../survivant/src/core.js (modèle « Anthony », même session).
  // Repère du personnage : mètres, Y vers le haut, avant = +Z, gauche = +X, pieds au sol en y = 0.
  // ============================================================================================
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  // Plis de tissu : rides de compression autour d'un anneau s0 (largeur w, pas spacing), secteur angulaire
  const ripple = (s, ang, s0, w, spacing, amp, angC, angW, ph) =>
    amp * Math.sin(TAU * (s - s0) / spacing + (ph || 0) + 0.8 * Math.sin(ang * 2.3 + s * 17)) *
    gauss(s, s0, w) * (angW >= 3 ? 1 : gauss(wrapPi(ang - angC), 0, angW));
  // Plis de tension diagonaux dans le plan (s, angle)
  const diagFold = (s, ang, s0, a0, slope, spacing, amp, ws, wa) => {
    const u = (s - s0) + slope * wrapPi(ang - a0) * 0.05;
    return amp * Math.sin(TAU * u / spacing) * gauss(s, s0, ws) * gauss(wrapPi(ang - a0), 0, wa);
  };
  // Couture : petit sillon bordé de deux bourrelets, le long d'un angle fixe
  const seamAt = (ang, a0, amp) => { const d = wrapPi(ang - a0); return -amp * gauss(d, 0, 0.018) + amp * 0.45 * (gauss(d, 0.05, 0.02) + gauss(d, -0.05, 0.02)); };
  const radialD = (radial, d) => [radial[0] * d, radial[1] * d, radial[2] * d];

  // --- bruit de valeur 3D (déterministe) ---
  function hash3(ix, iy, iz, seed) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(iz | 0, 1274126177) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, z, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const h = (a, b, c) => hash3(ix + a, iy + b, iz + c, seed);
    const x00 = lerp(h(0, 0, 0), h(1, 0, 0), ux), x10 = lerp(h(0, 1, 0), h(1, 1, 0), ux);
    const x01 = lerp(h(0, 0, 1), h(1, 0, 1), ux), x11 = lerp(h(0, 1, 1), h(1, 1, 1), ux);
    return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
  }
  function fbm(x, y, z, seed, oct) {
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < (oct || 4); i++) { s += a * vnoise(x * f, y * f, z * f, seed + i * 31); n += a; a *= 0.5; f *= 2.07; }
    return s / n;
  }
  // bruit 1D lisse (animation procédurale déterministe)
  function bruit1(t, seed) {
    const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    return lerp(hash3(i, 0, 0, seed), hash3(i + 1, 0, 0, seed), u) * 2 - 1;
  }
  // générateur pseudo-aléatoire reproductible
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6D2B79F5 | 0; s ^= s >>> 13; return ((s >>> 0) % 1000003) / 1000003; }; }

  // --- couleurs (sRGB 0..1 ; converties en linéaire à la construction si le rendu encode en sRGB) ---
  const hexc = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  // --- petits vecteurs [x, y, z] ---
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vscale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
  const vnorm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // rotation d'un vecteur autour d'un axe unitaire (Rodrigues)
  const vrot = (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a), d = vdot(k, v), x = vcross(k, v);
    return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
  };

  // Interpolation Catmull-Rom des paramètres d'anneaux (profils organiques sans cassure).
  const RING_KEYS = ['wL', 'wR', 'dF', 'dB', 'n', 'ox', 'oz'];
  function prepRings(rings) {
    return rings.map((r) => {
      const w = r.w != null ? r.w : 0.05, d = r.d != null ? r.d : w;
      return {
        s: r.s, wL: r.wL != null ? r.wL : w, wR: r.wR != null ? r.wR : w,
        dF: r.dF != null ? r.dF : d, dB: r.dB != null ? r.dB : d,
        n: r.n != null ? r.n : 2, ox: r.ox || 0, oz: r.oz || 0, tag: r.tag
      };
    }).sort((a, b) => a.s - b.s);
  }
  function interpRing(R, s) {
    const n = R.length;
    if (s <= R[0].s) return R[0];
    if (s >= R[n - 1].s) return R[n - 1];
    let i = 0;
    while (i < n - 2 && s > R[i + 1].s) i++;
    const p0 = R[Math.max(0, i - 1)], p1 = R[i], p2 = R[i + 1], p3 = R[Math.min(n - 1, i + 2)];
    const t = (s - p1.s) / (p2.s - p1.s), t2 = t * t, t3 = t2 * t;
    const out = { s: s };
    for (const k of RING_KEYS) {
      const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
      let v = 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const lo = Math.min(b, c), hi = Math.max(b, c), m = (hi - lo) * 0.35;
      out[k] = clamp(v, lo - m, hi + m);
    }
    return out;
  }
  // Point à la surface d'un loft vertical (anneaux bruts), utile pour poser boutons, poches, sangles.
  function surfPoint(rings, y0, y, ang, grow) {
    const r = interpRing(prepRings(rings), y - y0);
    const c = Math.cos(ang), sn = Math.sin(ang), ex = 2 / r.n;
    const x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ((sn >= 0 ? r.wL : r.wR) + grow);
    const z = Math.sign(c) * Math.pow(Math.abs(c), ex) * ((c >= 0 ? r.dF : r.dB) + grow);
    return [x + r.ox, y, z + r.oz];
  }

  // Poids de peau : fusion des doublons, 4 meilleurs, normalisés.
  function packWeights(list, si, sw) {
    const acc = {};
    for (const e of list) if (e[1] > 1e-5) acc[e[0]] = (acc[e[0]] || 0) + e[1];
    const arr = Object.keys(acc).map((k) => [+k, acc[k]]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    let tot = 0;
    for (const e of arr) tot += e[1];
    if (!arr.length) { arr.push([0, 1]); tot = 1; }
    for (let k = 0; k < 4; k++) { si.push(k < arr.length ? arr[k][0] : 0); sw.push(k < arr.length ? arr[k][1] / tot : 0); }
  }

  // ============================================================================================
  // Constructeur de maillages skinnés : lofts à sections superellipses, pièces rigides, rubans.
  // Origine : ../survivant/src/core.js (Builder), étendu ici : densité selon la qualité, attribut
  // supplémentaire « aBoss » (x = poids de flottement du tissu, y = trou de la bouche, z = lueur des
  // veines et fissures) utilisé par les retouches de shader du boss.
  // ============================================================================================
  function Builder(THREE, q) {
    this.THREE = THREE;
    this.G = {};
    this.q = q || 1;            // densité : 1 = haute, 0,72 = moyenne, 0,5 = basse
    this.cur = [0, 0, 0];       // valeur courante de aBoss pour rigid / ribbon
  }
  Builder.prototype.n = function (k, min) { return Math.max(min || 3, Math.round(k * this.q)); };
  Builder.prototype.g = function (mat) {
    return this.G[mat] || (this.G[mat] = { p: [], n: [], c: [], si: [], sw: [], ix: [], uv: [], x: [], mo: null });
  };
  // Cible de morphose (relative) nommée « cle » pour les sommets [v0, v1) du matériau : fn(P) → déplacement.
  Builder.prototype.morph = function (mat, cle, v0, v1, fn) {
    const g = this.g(mat);
    if (!g.mo) g.mo = {};
    const M = g.mo[cle] || (g.mo[cle] = new Map());
    for (let v = v0; v < v1; v++) M.set(v, fn([g.p[v * 3], g.p[v * 3 + 1], g.p[v * 3 + 2]]));
  };
  // Normales lissées des triangles ajoutés depuis ixStart, pour les sommets à partir de base.
  Builder.prototype._normals = function (g, base, ixStart) {
    const nv = g.p.length / 3;
    for (let i = g.n.length / 3; i < nv; i++) g.n.push(0, 0, 0);
    const P = g.p, N = g.n, I = g.ix;
    for (let t = ixStart; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
    }
    for (let i = base; i < nv; i++) {
      const k = i * 3, l = Math.hypot(N[k], N[k + 1], N[k + 2]) || 1;
      N[k] /= l; N[k + 1] /= l; N[k + 2] /= l;
    }
  };
  const ringPerim = (r) => {
    const a = (r.wL + r.wR) / 2, b = (r.dF + r.dB) / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) * (1 + 0.04 * (r.n - 2));
  };

  /**
   * Loft le long d'un axe droit a → b. Sections superellipse : demi-largeurs wL (côté +S) / wR,
   * demi-profondeurs dF (côté « front ») / dB, exposant n, décalages ox/oz.
   * o.gap : demi-angle d'ouverture à l'avant (nombre ou fonction de s) pour une coque ouverte (manteau).
   * o.hem1 / o.hem0 : déchirures des bords (fonction de l'angle → recul en m), o.hemDepth1/0 : recul maxi.
   * o.radius(s, ang, ring) : multiplicateur de rayon ; o.weights(s, ang, P) ; o.color(P, s, ang, ring) ;
   * o.extra(P, s, ang) → [flottement, trou, lueur] ; o.rim0 / o.rim1 / o.rimGap : épaisseur des bords libres.
   */
  Builder.prototype.loft = function (mat, o) {
    const g = this.g(mat), base = g.p.length / 3, ix0 = g.ix.length;
    const A = vnorm(vsub(o.b, o.a));
    let F = o.front || [0, 0, 1];
    F = vnorm(vsub(F, vscale(A, vdot(F, A))));
    const S = vcross(A, F);
    const R = prepRings(o.rings);
    const s0 = o.s0 != null ? o.s0 : R[0].s, s1 = o.s1 != null ? o.s1 : R[R.length - 1].s;
    let seg = Math.max(4, Math.round((o.seg || 16) * this.q));
    if (seg % 2) seg++;
    const open = o.gap != null;
    let sl = o.sList ? o.sList.filter((v) => v >= Math.min(s0, s1) - 1e-9 && v <= Math.max(s0, s1) + 1e-9) : null;
    if (sl && sl.length < 2) sl = null;
    const step = (o.step || 0.02) / (o.fixedStep ? 1 : this.q);
    const nr = sl ? sl.length : Math.max(2, Math.ceil(Math.abs(s1 - s0) / step) + 1);
    let spacing = Math.abs(s1 - s0) / (nr - 1);
    if (sl) for (let i = 1; i < sl.length; i++) spacing = Math.min(spacing, Math.abs(sl[i] - sl[i - 1]));
    const warp = o.angWarp || 0;
    const angAt = (u) => TAU * (u + 0.5) - warp * Math.sin(TAU * (u + 0.5));
    const K0 = o.hem0 ? Math.ceil((o.hemDepth0 || 0.03) / spacing) + 1 : 0;
    const K1 = o.hem1 ? Math.ceil((o.hemDepth1 || 0.03) / spacing) + 1 : 0;
    const cols = seg + 1;
    const radials = [];
    const ex0 = this.cur;
    for (let i = 0; i < nr; i++) {
      const sBase = sl ? sl[i] : s0 + (s1 - s0) * i / (nr - 1);
      const gap = open ? (typeof o.gap === 'function' ? o.gap(sBase) : o.gap) : 0;
      const per = ringPerim(interpRing(R, sBase)) * (open ? (TAU - 2 * gap) / TAU : 1);
      for (let j = 0; j < cols; j++) {
        const ang = open ? gap + (TAU - 2 * gap) * j / seg : angAt(j / seg);
        let s = sBase;
        if (K1 && i >= nr - K1) s -= o.hem1(ang) * (1 - (nr - 1 - i) / K1);
        if (K0 && i < K0) s += o.hem0(ang) * (1 - i / K0);
        const r = interpRing(R, s);
        const c = Math.cos(ang), sn = Math.sin(ang), ex = 2 / r.n;
        let x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (sn >= 0 ? r.wL : r.wR);
        let z = Math.sign(c) * Math.pow(Math.abs(c), ex) * (c >= 0 ? r.dF : r.dB);
        const m = o.radius ? o.radius(s, ang, r) : 1;
        x = x * m + r.ox; z = z * m + r.oz;
        const P = [o.a[0] + A[0] * s + S[0] * x + F[0] * z, o.a[1] + A[1] * s + S[1] * x + F[1] * z, o.a[2] + A[2] * s + S[2] * x + F[2] * z];
        const rl = Math.hypot(x - r.ox, z - r.oz) || 1;
        const radial = [(S[0] * (x - r.ox) + F[0] * (z - r.oz)) / rl, (S[1] * (x - r.ox) + F[1] * (z - r.oz)) / rl, (S[2] * (x - r.ox) + F[2] * (z - r.oz)) / rl];
        if (o.displace) {
          const d = o.displace(P, s, ang, r, radial);
          P[0] += d[0]; P[1] += d[1]; P[2] += d[2];
        }
        if (o.mirror) { P[0] = -P[0]; radial[0] = -radial[0]; }
        radials.push(radial);
        g.p.push(P[0], P[1], P[2]);
        g.uv.push(per * j / seg, s);
        const col = o.color(P, s, ang, r);
        g.c.push(col[0], col[1], col[2]);
        const xx = o.extra ? o.extra(P, s, ang) : ex0;
        g.x.push(xx[0], xx[1], xx[2]);
        packWeights(o.weights(s, ang, P), g.si, g.sw);
      }
    }
    const flip = !!o.flip !== !!o.mirror;
    for (let i = 0; i < nr - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * cols + j, b = base + i * cols + j + 1, c = base + (i + 1) * cols + j + 1, d = base + (i + 1) * cols + j;
        if (flip) g.ix.push(a, c, b, a, d, c); else g.ix.push(a, b, c, a, c, d);
      }
    }
    const cap = (ring, sgn) => {
      const first = base + ring * cols;
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < seg; j++) { const k = (first + j) * 3; cx += g.p[k]; cy += g.p[k + 1]; cz += g.p[k + 2]; }
      g.p.push(cx / seg, cy / seg, cz / seg);
      g.uv.push(g.uv[first * 2], g.uv[first * 2 + 1]);
      const k0 = first * 3; g.c.push(g.c[k0], g.c[k0 + 1], g.c[k0 + 2]);
      g.x.push(g.x[k0], g.x[k0 + 1], g.x[k0 + 2]);
      for (let q = 0; q < 4; q++) { g.si.push(g.si[first * 4 + q]); g.sw.push(g.sw[first * 4 + q]); }
      const ci = g.p.length / 3 - 1;
      for (let j = 0; j < seg; j++) {
        if ((sgn > 0) !== flip) g.ix.push(ci, first + j, first + j + 1); else g.ix.push(ci, first + j + 1, first + j);
      }
    };
    if (o.cap0) cap(0, -1);
    if (o.cap1) cap(nr - 1, 1);
    this._normals(g, base, ix0);
    if (!open) {
      for (let i = 0; i < nr; i++) {
        const a = (base + i * cols) * 3, b = (base + i * cols + seg) * 3;
        let nx = g.n[a] + g.n[b], ny = g.n[a + 1] + g.n[b + 1], nz = g.n[a + 2] + g.n[b + 2];
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        g.n[a] = g.n[b] = nx; g.n[a + 1] = g.n[b + 1] = ny; g.n[a + 2] = g.n[b + 2] = nz;
      }
    }
    // tranches des bords libres : bande repliée vers l'intérieur (épaisseur visible du tissu)
    const rimCol = o.rimColor || ((c) => [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78]);
    const strip = (idxList, th, back) => {
      const b2 = g.p.length / 3, i2 = g.ix.length;
      for (let q = 0; q < idxList.length; q++) {
        const vi = idxList[q], rd = radials[vi - base], k = vi * 3;
        g.p.push(g.p[k] - rd[0] * th + back[0], g.p[k + 1] - rd[1] * th + back[1], g.p[k + 2] - rd[2] * th + back[2]);
        g.uv.push(g.uv[vi * 2], g.uv[vi * 2 + 1] + th);
        const cc = rimCol([g.c[k], g.c[k + 1], g.c[k + 2]]);
        g.c.push(cc[0], cc[1], cc[2]);
        g.x.push(g.x[k], g.x[k + 1], g.x[k + 2]);
        for (let t = 0; t < 4; t++) { g.si.push(g.si[vi * 4 + t]); g.sw.push(g.sw[vi * 4 + t]); }
      }
      for (let q = 0; q < idxList.length - 1; q++) {
        const a = idxList[q], b = idxList[q + 1], c = b2 + q + 1, d = b2 + q;
        if (flip) g.ix.push(a, b, c, a, c, d); else g.ix.push(a, c, b, a, d, c);
      }
      this._normals(g, b2, i2);
    };
    const ringIdx = (i) => { const out = []; for (let j = 0; j < cols; j++) out.push(base + i * cols + j); return out; };
    if (o.rim0) strip(ringIdx(0), o.rim0, vscale(A, o.rim0 * 0.6));
    if (o.rim1) strip(ringIdx(nr - 1).reverse(), o.rim1, vscale(A, -o.rim1 * 0.6));
    if (open && o.rimGap) {
      const c0 = [], c1 = [];
      for (let i = 0; i < nr; i++) { c0.push(base + i * cols); c1.push(base + i * cols + seg); }
      strip(c0.reverse(), o.rimGap, [0, 0, 0]);
      strip(c1, o.rimGap, [0, 0, 0]);
    }
    return { base: base, rings: nr, cols: cols, A: A, F: F, S: S };
  };

  /** Pièce rigide (géométrie Three.js placée par une Matrix4), attachée à un os ou à une liste de poids. */
  Builder.prototype.rigid = function (mat, geo, M, bone, color) {
    const THREE = this.THREE, g = this.g(mat), base = g.p.length / 3;
    const pos = geo.attributes.position, nrm = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(M);
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    const ex = this.cur;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      nv.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      g.p.push(v.x, v.y, v.z);
      g.n.push(nv.x, nv.y, nv.z);
      const ax = Math.abs(nv.x), ay = Math.abs(nv.y), az = Math.abs(nv.z);
      if (ay >= ax && ay >= az) g.uv.push(v.x, v.z); else if (ax >= az) g.uv.push(v.z, v.y); else g.uv.push(v.x, v.y);
      const col = typeof color === 'function' ? color([v.x, v.y, v.z], [nv.x, nv.y, nv.z]) : color;
      g.c.push(col[0], col[1], col[2]);
      const xx = typeof ex === 'function' ? ex([v.x, v.y, v.z]) : ex;
      g.x.push(xx[0], xx[1], xx[2]);
      if (Array.isArray(bone)) packWeights(typeof bone[0] === 'number' ? [[bone[0], 1]] : bone, g.si, g.sw);
      else if (typeof bone === 'function') packWeights(bone([v.x, v.y, v.z]), g.si, g.sw);
      else { g.si.push(bone, 0, 0, 0); g.sw.push(1, 0, 0, 0); }
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) g.ix.push(base + geo.index.getX(i));
    else for (let i = 0; i < pos.count; i++) g.ix.push(base + i);
    geo.dispose();
  };

  /** Ruban (sangle, lambeau) le long d'une polyligne, épaisseur réelle ; « out » donne la normale extérieure. */
  Builder.prototype.ribbon = function (mat, pts, width, thick, outFn, weightFn, color) {
    const wAt = typeof width === 'function' ? width : () => width;
    const tAt = typeof thick === 'function' ? thick : () => thick;
    const g = this.g(mat), base = g.p.length / 3, ix0 = g.ix.length;
    const n = pts.length;
    const ex = this.cur;
    let along = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], t = vnorm(vsub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      if (i > 0) along += vlen(vsub(p, pts[i - 1]));
      const out = vnorm(outFn(p, i));
      const side = vnorm(vcross(t, out));
      const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
      const wi = wAt(i / (n - 1)), th = tAt(i / (n - 1));
      for (const [a, b] of corners) {
        const P = vadd(p, vadd(vscale(side, a * wi / 2), vscale(out, b * th / 2 + th / 2)));
        g.p.push(P[0], P[1], P[2]);
        g.uv.push((a + 1) * wi / 2, along);
        const col = typeof color === 'function' ? color(P, i / (n - 1)) : color;
        g.c.push(col[0], col[1], col[2]);
        const xx = typeof ex === 'function' ? ex(P, i / (n - 1), a, b, i, along) : ex;
        g.x.push(xx[0], xx[1], xx[2]);
        packWeights(weightFn(P, i / (n - 1)), g.si, g.sw);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const a = base + i * 4 + k, b = base + i * 4 + (k + 1) % 4, c = base + (i + 1) * 4 + (k + 1) % 4, d = base + (i + 1) * 4 + k;
        g.ix.push(a, d, c, a, c, b);
      }
    }
    this._normals(g, base, ix0);
  };

  /** Regroupe les sommets du matériau src dans le maillage du matériau dst (même squelette), puis retire src. */
  Builder.prototype.fusionner = function (dst, src) {
    const a = this.G[src];
    if (!a || !a.ix.length) { delete this.G[src]; return; }
    const g = this.g(dst), base = g.p.length / 3;
    for (const k of ['p', 'n', 'c', 'si', 'sw', 'x', 'uv']) { const A = a[k], D = g[k]; for (let i = 0; i < A.length; i++) D.push(A[i]); }
    for (let i = 0; i < a.ix.length; i++) g.ix.push(base + a.ix[i]);
    if (a.mo) {
      if (!g.mo) g.mo = {};
      for (const cle in a.mo) { const M = g.mo[cle] || (g.mo[cle] = new Map()); a.mo[cle].forEach((d, v) => M.set(base + v, d)); }
    }
    delete this.G[src];
  };
  /** Retire tous les sommets d'un matériau (pièce omise). */
  Builder.prototype.retirer = function (cle) { delete this.G[cle]; };

  /** Géométries finales, une par matériau : { cle: { geo, morph: { nom: indice } | null } }. */
  Builder.prototype.geometries = function (linear) {
    const THREE = this.THREE, out = {};
    for (const key in this.G) {
      const g = this.G[key];
      if (!g.ix.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(linear ? g.c.map(toLin) : g.c, 3));
      if (g.uv.length === g.p.length / 3 * 2) geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('aBoss', new THREE.Float32BufferAttribute(g.x, 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(g.si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(g.sw, 4));
      geo.setIndex(g.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(g.ix, 1) : new THREE.Uint16BufferAttribute(g.ix, 1));
      let morph = null;
      if (g.mo) {
        const nv = g.p.length / 3, cibles = [];
        morph = {};
        for (const cle in g.mo) {
          const arr = new Float32Array(nv * 3);
          g.mo[cle].forEach((d, v) => { arr[v * 3] = d[0]; arr[v * 3 + 1] = d[1]; arr[v * 3 + 2] = d[2]; });
          const at = new THREE.Float32BufferAttribute(arr, 3); at.name = cle;
          morph[cle] = cibles.length; cibles.push(at);
        }
        geo.morphAttributes.position = cibles;
        geo.morphTargetsRelative = true;
      }
      geo.computeBoundingSphere();
      out[key] = { geo: geo, morph: morph };
    }
    return out;
  };
  /** SkinnedMesh d'une géométrie (éventuellement partagée entre instances) avec le matériau de l'instance. */
  function maillageSkinne(THREE, g, mat, key) {
    const mesh = new THREE.SkinnedMesh(g.geo, mat);
    if (g.morph) { mesh.updateMorphTargets(); mesh.userData.morph = Object.assign({}, g.morph); }
    mesh.name = 'boss-' + key;
    mesh.frustumCulled = false;
    return mesh;
  }
  /** Assemble un SkinnedMesh par matériau, tous liés au même squelette. */
  Builder.prototype.build = function (materials, linear) {
    const G = this.geometries(linear), out = {};
    for (const key in G) out[key] = maillageSkinne(this.THREE, G[key], materials[key], key);
    return out;
  };

  // ---------------------------------------------------------------- ressources partagées entre instances (v2.2)
  // Géométries du corps et de la tête cuite, textures de la tête : identiques pour des instances de même configuration
  // (les illusions de la phase 5) ; un compteur de références les libère avec la dernière instance (dispose). Ni
  // matériau, ni uniforme, ni géométrie modifiée en cours de jeu (lames, ailes, particules) n'est partagé.
  const RESSOURCES = new WeakMap();      // THREE → Map(clé → ressource)
  const IDS_DONNEES = new WeakMap();     // données (BOSS_B7_TETE) → numéro
  let nIdsDonnees = 0;
  function idDonnees(D) { let n = IDS_DONNEES.get(D); if (!n) { n = ++nIdsDonnees; IDS_DONNEES.set(D, n); } return n; }
  function prendreRessource(THREE, cle, fabrique) {
    let M = RESSOURCES.get(THREE);
    if (!M) { M = new Map(); RESSOURCES.set(THREE, M); }
    let e = M.get(cle);
    if (!e) { e = fabrique(); e.refs = 0; M.set(cle, e); }
    e.refs++;
    let rendue = false;
    return { valeur: e, rendre: () => { if (rendue) return; rendue = true; if (--e.refs <= 0) { if (M.get(cle) === e) M.delete(cle); if (e.liberer) e.liberer(e); } } };
  }
  function nbRessources(THREE) { const M = RESSOURCES.get(THREE); return M ? M.size : 0; }

  // Faut-il convertir les couleurs en linéaire ? Oui si le rendu encode la sortie en sRGB (repris de core.js).
  function wantsLinear(THREE, renderer) {
    const rev = parseInt(THREE.REVISION, 10);
    if (renderer) {
      if ('outputColorSpace' in renderer) return renderer.outputColorSpace === (THREE.SRGBColorSpace || 'srgb');
      if ('outputEncoding' in renderer) return renderer.outputEncoding === THREE.sRGBEncoding;
    }
    return rev >= 152;
  }

  // Squelette : table { nom: [parent, x, y, z] } en coordonnées de la pose de référence (repris de core.js).
  function makeSkeleton(THREE, table) {
    const bones = [], byName = {}, index = {}, world = {};
    for (const name in table) {
      const [parent, x, y, z] = table[name];
      const b = new THREE.Bone();
      b.name = name;
      world[name] = [x, y, z];
      if (parent) {
        const pw = world[parent];
        b.position.set(x - pw[0], y - pw[1], z - pw[2]);
        byName[parent].add(b);
      } else b.position.set(x, y, z);
      index[name] = bones.length;
      bones.push(b);
      byName[name] = b;
    }
    return { bones: bones, byName: byName, index: index, world: world };
  }

  // Boîte souple : arêtes arrondies et faces légèrement bombées (repris de ../survivant/src/gear.js)
  function softBox(THREE, w, h, d, r, bulge, seg) {
    const n = seg || 6;
    const g = new THREE.BoxGeometry(w, h, d, n, Math.max(2, Math.round(n * h / w)), Math.max(2, Math.round(n * d / w)));
    const p = g.attributes.position, hx = w / 2, hy = h / 2, hz = d / 2;
    const ix = Math.max(hx - r, 1e-4), iy = Math.max(hy - r, 1e-4), iz = Math.max(hz - r, 1e-4);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const qx = clamp(x, -ix, ix), qy = clamp(y, -iy, iy), qz = clamp(z, -iz, iz);
      const dx = x - qx, dy = y - qy, dz = z - qz;
      const l = Math.hypot(dx, dy, dz);
      if (l > 1e-7) { x = qx + dx / l * r; y = qy + dy / l * r; z = qz + dz / l * r; }
      const kz = Math.max(0, 1 - (x / hx) * (x / hx)) * Math.max(0, 1 - (y / hy) * (y / hy));
      const kx = Math.max(0, 1 - (z / hz) * (z / hz)) * Math.max(0, 1 - (y / hy) * (y / hy));
      z += Math.sign(z) * bulge * kz; x += Math.sign(x) * bulge * 0.6 * kx;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }

  // ============================================================================================
  // Squelette du boss. Base : squelette de 1,80 m du survivant (../survivant/src/body.js,
  // skeletonTable) — mêmes articulations, pose de référence identique (debout, bras écartés de 20°,
  // regard vers +Z) ; l'ensemble est mis à l'échelle 1,75 / 1,80 par le modèle.
  // Ajouts : os de torsion de l'avant-bras, 5 doigts articulés à 3 phalanges, mâchoire, chaînes
  // d'os du bas du manteau et des deux pans de l'étole (physique de ressorts), charpentes des ailes.
  // ============================================================================================
  const ECHELLE = 1.75 / 1.80;
  const ARM_ANGLE = 20 * Math.PI / 180;
  const ARM_DIR = [Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0];
  const L_UPPER = 0.29, L_FORE = 0.255, L_PALM = 0.092;
  // doigts : [nom, décalage vers le pouce (z), recul de l'articulation, longueurs des 3 phalanges, rayon]
  const DOIGTS = [
    ['index', 0.0275, -0.004, [0.047, 0.030, 0.025], 0.0080],
    ['majeur', 0.0092, 0.0, [0.051, 0.033, 0.027], 0.0084],
    ['annulaire', -0.0092, -0.003, [0.048, 0.031, 0.025], 0.0079],
    ['auriculaire', -0.0262, -0.012, [0.038, 0.025, 0.021], 0.0069]
  ];
  const POUCE_L = [0.046, 0.035, 0.029];
  // repère de la main gauche en pose de référence (le droit par symétrie x → −x)
  const N0L = vnorm(vsub([1, 0, 0], vscale(ARM_DIR, ARM_DIR[0])));   // normale « extérieure » du bras
  const PAUME_L = vscale(N0L, -1);                                     // la paume regarde le corps
  const POUCE_DIR_L = vnorm(vadd(vadd(vscale(ARM_DIR, 0.5), [0, 0, 0.66]), vscale(PAUME_L, 0.32)));

  // ---------------------------------------------------------------- manteau : jupe et chaînes d'os
  const JUPE_Y0 = 0.14;      // bas des lambeaux les plus longs
  const JUPE_RINGS = [
    { s: 0.0, w: 0.300, dF: 0.215, dB: 0.268, n: 2.25 },
    { s: 0.11, w: 0.292, dF: 0.21, dB: 0.258, n: 2.25 },
    { s: 0.26, w: 0.272, dF: 0.196, dB: 0.236, n: 2.25 },
    { s: 0.41, w: 0.247, dF: 0.176, dB: 0.210, n: 2.3 },
    { s: 0.56, w: 0.222, dF: 0.156, dB: 0.184, n: 2.35 },
    { s: 0.71, w: 0.196, dF: 0.138, dB: 0.158, n: 2.4 },
    { s: 0.84, w: 0.176, dF: 0.122, dB: 0.134, n: 2.4, oz: -0.004 },
    { s: 0.93, w: 0.168, dF: 0.116, dB: 0.124, n: 2.4, oz: -0.006 }
  ];
  // demi-angle de l'ouverture de la jupe : le manteau est fermé jusqu'à la ceinture, la jupe s'ouvre en dessous
  const ouvertureJupe = (y) => lerp(0.07, 0.8, smooth(0.98, 0.32, y));
  const PAN_N = 12;                                  // chaînes réparties du bord avant gauche au bord avant droit
  const PAN_Y = [0.985, 0.80, 0.605, 0.41, 0.18];    // niveaux : racine fixe, articulations, bout des lambeaux
  const angPan = (f, y) => { const g = ouvertureJupe(y); return g + (TAU - 2 * g) * f; };
  function pointJupe(f, y, grow) {
    const a = angPan(f, y);
    return surfPoint(JUPE_RINGS, JUPE_Y0, y, a, grow || 0);
  }

  // ---------------------------------------------------------------- étole : deux pans qui pendent sur le devant
  // Le haut de l'étole fait le tour de la base du col (rigide), chaque pan pend de la poitrine aux genoux,
  // porté par une chaîne de 6 os (racine fixée à la poitrine). x = ±ETO_X (centre du pan).
  const ETO_X = 0.072, ETO_L = 0.088;                                   // demi-écart des pans, largeur
  const ETO_Y = [1.36, 1.215, 1.07, 0.925, 0.78, 0.635, 0.49];         // racine puis articulations ; bout à 0,49 m
  // profondeur (z) du devant du pan à la hauteur y : posé sur le manteau, il tombe ensuite à l'aplomb
  function zEtole(y) {
    const zb = (yy) => {
      // demi-largeur du buste ou de la jupe à x = ETO_X → z de la surface (par dichotomie sur l'angle)
      const buste = yy >= 0.985;
      const R = buste ? MANTEAU_RINGS : JUPE_RINGS, y0 = buste ? MANTEAU_Y0 : JUPE_Y0;
      let lo = 0, hi = Math.PI / 2;
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (surfPoint(R, y0, yy, m, 0)[0] < ETO_X) lo = m; else hi = m; }
      const a = (lo + hi) / 2;
      if (!buste && a < ouvertureJupe(yy)) return -1;          // devant ouvert de la jupe : pas de surface
      return surfPoint(R, y0, yy, a, 0)[2];
    };
    let z = 0;
    for (let yy = 1.40; yy >= y - 1e-6; yy -= 0.01) z = Math.max(z, zb(yy) + (yy > 0.985 && yy < 1.045 ? 0.007 : 0));
    return z + 0.011;
  }
  const pointEtole = (sx, y) => [sx * ETO_X, y, zEtole(y)];

  // ---------------------------------------------------------------- ailes : charpente (côté gauche)
  const AILE = (() => {
    const u = vnorm([1, 0, -0.26]), v = [0, 1, 0];
    const dirA = (deg) => { const a = deg * Math.PI / 180; return vnorm(vadd(vscale(u, Math.cos(a)), vscale(v, Math.sin(a)))); };
    const R0 = [0.072, 1.355, -0.118];
    const S1 = vadd(R0, [0.10, 0.065, -0.07]);
    const E = vadd(S1, vscale(dirA(36), 0.55));
    const Wr = vadd(E, vscale(dirA(-12), 0.78));
    const doigts = [[38, [0.74, 0.60]], [7, [0.76, 0.64]], [-27, [0.66, 0.54]], [-60, [0.54, 0.44]]].map(([deg, L]) => {
      const d = dirA(deg), m = vadd(Wr, vscale(d, L[0])), t = vadd(m, vscale(d, L[1]));
      return { deg: deg, dir: d, L: L, mid: m, tip: t };
    });
    const pouce = { dir: dirA(98), tip: vadd(Wr, vscale(dirA(98), 0.21)) };
    const corps = [[0.085, 1.30, -0.135], [0.105, 1.16, -0.150], [0.115, 1.03, -0.152]];   // attache du plagiopatagium
    return { u: u, v: v, n: vnorm(vcross(u, v)), R0: R0, S1: S1, E: E, Wr: Wr, doigts: doigts, pouce: pouce, corps: corps };
  })();
  const miroir = (p) => [-p[0], p[1], p[2]];

  function tableSquelette() {
    const T = {
      root: [null, 0, 0, 0],
      hips: ['root', 0, 0.985, 0],
      spine: ['hips', 0, 1.10, -0.012],
      chest: ['spine', 0, 1.27, -0.02],
      neck: ['chest', 0, 1.478, -0.035],
      head: ['neck', 0, 1.588, -0.012],
      oeilG: ['head', 0.0315, 1.6672, 0.0655],
      oeilD: ['head', -0.0315, 1.6672, 0.0655],
      machoire: ['head', 0, 1.629, -0.008]
    };
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const ad = [ARM_DIR[0] * sx, ARM_DIR[1], 0];
      const sh = [0.185 * sx, 1.418, -0.035];
      const el = vadd(sh, vscale(ad, L_UPPER));
      const tw = vadd(el, vscale(ad, L_FORE * 0.58));
      const wr = vadd(el, vscale(ad, L_FORE));
      T['clav' + S] = ['chest', 0.03 * sx, 1.428, 0.005];
      T['arm' + S] = ['clav' + S, sh[0], sh[1], sh[2]];
      T['fore' + S] = ['arm' + S, el[0], el[1], el[2]];
      T['tors' + S] = ['fore' + S, tw[0], tw[1], tw[2]];
      T['hand' + S] = ['tors' + S, wr[0], wr[1], wr[2]];
      for (const [f, dz, back, len] of DOIGTS) {
        let p = vadd(vadd(wr, vscale(ad, L_PALM + back)), [0, 0, dz]);
        T[f + '1' + S] = ['hand' + S, p[0], p[1], p[2]];
        p = vadd(p, vscale(ad, len[0])); T[f + '2' + S] = [f + '1' + S, p[0], p[1], p[2]];
        p = vadd(p, vscale(ad, len[1])); T[f + '3' + S] = [f + '2' + S, p[0], p[1], p[2]];
      }
      const pl = sx > 0 ? PAUME_L : miroir(PAUME_L), td = sx > 0 ? POUCE_DIR_L : miroir(POUCE_DIR_L);
      let c = vadd(vadd(vadd(wr, vscale(ad, 0.016)), [0, 0, 0.019]), vscale(pl, 0.010));
      T['pouce1' + S] = ['hand' + S, c[0], c[1], c[2]];
      c = vadd(c, vscale(td, POUCE_L[0])); T['pouce2' + S] = ['pouce1' + S, c[0], c[1], c[2]];
      c = vadd(c, vscale(td, POUCE_L[1])); T['pouce3' + S] = ['pouce2' + S, c[0], c[1], c[2]];
      T['thigh' + S] = ['hips', 0.092 * sx, 0.925, 0.0];
      T['shin' + S] = ['thigh' + S, 0.098 * sx, 0.505, 0.012];
      T['foot' + S] = ['shin' + S, 0.104 * sx, 0.088, -0.022];
      T['toes' + S] = ['foot' + S, 0.11 * sx, 0.022, 0.12];
      // ailes
      const m = sx > 0 ? (p) => p : miroir;
      const A = AILE;
      T['aileRac' + S] = ['chest'].concat(m(A.R0));
      T['aileHum' + S] = ['aileRac' + S].concat(m(A.S1));
      T['aileAvb' + S] = ['aileHum' + S].concat(m(A.E));
      T['aileMain' + S] = ['aileAvb' + S].concat(m(A.Wr));
      A.doigts.forEach((d, i) => {
        T['aileD' + (i + 1) + 'a' + S] = ['aileMain' + S].concat(m(A.Wr));
        T['aileD' + (i + 1) + 'b' + S] = ['aileD' + (i + 1) + 'a' + S].concat(m(d.mid));
      });
      T['ailePou' + S] = ['aileMain' + S].concat(m(A.Wr));
    }
    // pans de l'étole : os etoG_i / etoD_i de ETO_Y[i] à ETO_Y[i+1], la racine suit la poitrine
    for (const [G, sx] of [['G', 1], ['D', -1]]) {
      let parent = 'chest';
      for (let i = 0; i < ETO_Y.length - 1; i++) {
        const p = pointEtole(sx, ETO_Y[i]);
        const nm = 'eto' + G + '_' + i;
        T[nm] = [parent, p[0], p[1], p[2]];
        parent = nm;
      }
    }
    // chaînes du manteau : os k_i de PAN_Y[i] à PAN_Y[i+1], la racine suit le bassin
    for (let k = 0; k < PAN_N; k++) {
      const f = k / (PAN_N - 1);
      let parent = 'hips';
      for (let i = 0; i < PAN_Y.length - 1; i++) {
        const p = pointJupe(f, PAN_Y[i], -0.012);
        const nm = 'pan' + k + '_' + i;
        T[nm] = [parent, p[0], p[1], p[2]];
        parent = nm;
      }
    }
    return T;
  }

  // ============================================================================================
  // Palette du Septième, textures de détail procédurales (drap, grain du cuir, pores) et retouches de
  // shader communes : dissolution (cendres / brume de sang), sceaux occultes brûlés dans le cuir (motif
  // inventé : anneaux, sceau à sept branches courbes, points, cercles, arcs, spirales), doublure, déchirures,
  // flottement, trou de la bouche, veines lumineuses ; glyphes brodés de l'étole ; sur la tête de
  // remplacement : sceau à sept branches gravé en cicatrices lumineuses et cicatrice agrafée.
  // ============================================================================================
  const PAL = {
    peau: hexc(0x929aa6), peauOmbre: hexc(0x636b78), peauFroide: hexc(0x8190a3), peauRose: hexc(0x958a8f),
    veine: hexc(0x2b2537), ongle: hexc(0x171214), levre: hexc(0x4c3f47), chaume: hexc(0x6f7276),
    manteau: hexc(0x2a221d), manteauClair: hexc(0x4d3e33), manteauSombre: hexc(0x14100e), doublure: hexc(0x2c1816),
    tunique: hexc(0x2e2a27), tuniqueSombre: hexc(0x1d1a18), tuniqueClair: hexc(0x433d37),
    pantalon: hexc(0x262422), pantalonSombre: hexc(0x171615),
    botte: hexc(0x1b1613), botteReflet: hexc(0x3b2f27), semelle: hexc(0x0d0b0a),
    cuir: hexc(0x2b1d15), cuirClair: hexc(0x4a3324),
    metal: hexc(0x5f5b55), rouille: hexc(0x5a3824), fer: hexc(0x34312e),
    etole: hexc(0x6a1114), etoleSombre: hexc(0x3a080a), broderie: hexc(0x8e6c2e),
    bandage: hexc(0xb1ab98), bandageSale: hexc(0x5e5444), verre: hexc(0x50675f), ame: hexc(0x2f6a5e),
    cendre: hexc(0x75706a), poussiere: hexc(0x625a4d), sangSec: hexc(0x3c0f0c), brule: hexc(0x120d0b),
    os: hexc(0x39332e), osClair: hexc(0x625950), membrane: hexc(0x1a0605),
    gant: hexc(0x15110f), gantSombre: hexc(0x0b0909), gantUse: hexc(0x3b332d)
  };

  // ---------------------------------------------------------------- textures de détail (CPU, 256²)
  const DETAIL_CACHE = new Map();
  function texturesDetail(THREE) {
    const key = THREE.REVISION;
    if (DETAIL_CACHE.has(key)) return DETAIL_CACHE.get(key);
    const S = 256;
    const make = (heightFn, albedoFn, strength) => {
      const H = new Float32Array(S * S), A = new Float32Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { H[y * S + x] = heightFn(x, y); A[y * S + x] = albedoFn(x, y, H[y * S + x]); }
      const dN = new Uint8Array(S * S * 4), dA = new Uint8Array(S * S * 4);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const hx = H[y * S + ((x + 1) % S)] - H[y * S + ((x + S - 1) % S)];
        const hy = H[((y + 1) % S) * S + x] - H[((y + S - 1) % S) * S + x];
        let nx = -hx * strength, ny = -hy * strength, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * S + x) * 4;
        dN[i] = (nx * 0.5 + 0.5) * 255; dN[i + 1] = (ny * 0.5 + 0.5) * 255; dN[i + 2] = (nz * 0.5 + 0.5) * 255; dN[i + 3] = 255;
        const a = clamp(A[y * S + x], 0, 1) * 255;
        dA[i] = dA[i + 1] = dA[i + 2] = a; dA[i + 3] = 255;
      }
      const tex = (data) => {
        const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
        t.anisotropy = 4;
        if ('colorSpace' in t) t.colorSpace = THREE.NoColorSpace || ''; else t.encoding = THREE.LinearEncoding;
        t.needsUpdate = true;
        return t;
      };
      return { d: tex(dA), n: tex(dN) };
    };
    const per = (x, y, f, seed) => {   // bruit de valeur périodique (période S / f)
      const P = f, u = x / S * P, v = y / S * P, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      const h = (a, b) => hash3(((a % P) + P) % P, ((b % P) + P) % P, 0, seed);
      const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
      return lerp(lerp(h(i, j), h(i + 1, j), su), lerp(h(i, j + 1), h(i + 1, j + 1), su), sv);
    };
    const T = {
      // sergé de laine (côtes diagonales serrées, fibres, petites bouloches)
      laine: make((x, y) => 0.5 + 0.32 * Math.sin(TAU * (x + y) / 8) + 0.18 * (per(x, y, 64, 3) - 0.5) + 0.12 * per(x, y, 16, 5),
        (x, y, h) => 0.78 + 0.06 * (h - 0.5) + 0.1 * (per(x, y, 32, 7) - 0.5) - 0.06 * Math.max(0, per(x, y, 128, 9) - 0.7), 2.2),
      // drap fin (toile : fils croisés)
      drap: make((x, y) => 0.5 + 0.22 * Math.sin(TAU * x / 4) * Math.sin(TAU * y / 4) + 0.2 * (per(x, y, 64, 11) - 0.5),
        (x, y, h) => 0.8 + 0.05 * (h - 0.5) + 0.08 * (per(x, y, 32, 13) - 0.5), 1.6),
      // cuir : grain grumeleux et petites rides
      cuir: make((x, y) => { const a = per(x, y, 32, 17), b = per(x, y, 64, 19); return 0.6 * (1 - Math.abs(a - 0.5) * 2) + 0.4 * b + 0.25 * Math.abs(Math.sin(TAU * (x * 0.3 + y) / 64 + per(x, y, 8, 23) * 3)) ; },
        (x, y, h) => 0.8 + 0.06 * (h - 0.6) + 0.06 * (per(x, y, 16, 21) - 0.5), 2.6),
      // peau : pores et ridules
      peau: make((x, y) => 0.5 + 0.25 * per(x, y, 32, 29) + 0.25 * per(x, y, 128, 31) - 0.4 * Math.max(0, per(x, y, 96, 37) - 0.75),
        (x, y, h) => 0.8 + 0.05 * (h - 0.5) - 0.05 * Math.max(0, per(x, y, 96, 37) - 0.72), 1.8)
    };
    DETAIL_CACHE.set(key, T);
    return T;
  }

  // ---------------------------------------------------------------- GLSL commun
  const GLSL_BRUIT = `
float bH3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bN3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bH3(i), bH3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(bH3(i + vec3(0.0, 1.0, 0.0)), bH3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(bH3(i + vec3(0.0, 0.0, 1.0)), bH3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(bH3(i + vec3(0.0, 1.0, 1.0)), bH3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float bF3(vec3 p){ return bN3(p) * 0.5 + bN3(p * 2.03 + 3.1) * 0.3 + bN3(p * 4.11 + 7.7) * 0.2; }
`;
  const GLSL_SCEAUX = `
// Motifs occultes INVENTÉS, faits uniquement de cercles, arcs, points et spirales (aucune lettre, rune, croix,
// roue à rayons droits ni symbole réel). Distances dans le repère du motif (rayon ≈ 1).
float bArc(vec2 p, vec2 c, float r, float a0, float a1){
  vec2 d = p - c;
  float t = mod(atan(d.y, d.x) - a0, 6.2831853);
  if (t <= a1 - a0) return abs(length(d) - r);
  vec2 e0 = c + r * vec2(cos(a0), sin(a0)), e1 = c + r * vec2(cos(a1), sin(a1));
  return min(length(p - e0), length(p - e1));
}
float bPoint(vec2 p, vec2 c, float r){ return max(length(p - c) - r, 0.0); }
float bSpirale(vec2 p, vec2 c, float r, float tours){
  vec2 d = p - c; float rr = length(d), a = atan(d.y, d.x); if (a < 0.0) a += 6.2831853;
  float tot = tours * 6.2831853, k = r * 0.88 / tot, r0 = r * 0.12, best = 9.0;
  for (int i = 0; i < 4; i++) { float th = a + 6.2831853 * float(i); if (th <= tot) best = min(best, abs(rr - (r0 + k * th))); }
  return best;
}
// sceau à sept branches COURBES de Bunker 7 : anneau central, sept branches incurvées de longueurs inégales et de
// sens alternés, terminées par un point (création)
float bSceau7c(vec2 q){
  float r = length(q);
  if (r > 1.15) return 9.0;
  float a = atan(q.y, q.x);
  float d = abs(r - 0.17);
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float th0 = 1.5707963 + fk * 0.8975979;
    float sk = mod(fk, 2.0) < 0.5 ? 1.0 : -1.0;
    float L = 0.62 + 0.05 * mod(fk * 3.0, 5.0);
    float kc = sk * (0.55 + 0.35 * mod(fk * 2.0, 3.0) / 2.0);
    float rc = clamp(r, 0.17, L);
    float th = th0 + kc * (rc - 0.17) * (rc - 0.17);
    float da = a - th; da = da - 6.2831853 * floor((da + 3.1415927) / 6.2831853);
    if (r >= 0.17 && r <= L && cos(da) > 0.0) d = min(d, abs(sin(da)) * r);
    float thL = th0 + kc * (L - 0.17) * (L - 0.17);
    d = min(d, bPoint(q, L * vec2(cos(thL), sin(thL)), 0.055));
  }
  return d;
}
// sceau des vêtements : deux anneaux, sceau à sept branches courbes, couronne de points, cercles et petits arcs
float bSceauD(vec2 p, float graine){
  float r = length(p);
  if (r > 1.15) return 9.0;
  float a = atan(p.y, p.x);
  float d = min(abs(r - 1.0), abs(r - 0.885));
  d = min(d, bSceau7c(p / 0.8) * 0.8);
  float n = 21.0, cell = floor((a + 3.1415927) / 6.2831853 * n);
  float ac = (cell + 0.5) / n * 6.2831853 - 3.1415927;
  vec2 c = 0.9425 * vec2(cos(ac), sin(ac));
  float h = fract(sin((cell + 1.0) * 12.9898 + graine * 4.1414) * 43758.5453);
  if (h < 0.45) d = min(d, bPoint(p, c, 0.02));
  else if (h < 0.8) d = min(d, abs(length(p - c) - 0.028));
  else d = min(d, bArc(p, c, 0.034, ac + 0.6, ac + 3.6));
  return d;
}
// glyphes brodés de l'étole (une case = un glyphe, choisi par la graine de la case)
float bGlyphe(vec2 q, float cel){
  float h = fract(sin(cel * 12.9898 + 7.13) * 43758.5453), h2 = fract(sin(cel * 39.3468 + 1.7) * 24634.6345);
  float rt = (h2 - 0.5) * 1.4, cs = cos(rt), sn = sin(rt);
  vec2 p = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
  float t = floor(h * 9.0), d = 9.0;
  if (t < 1.0) { d = min(bArc(p, vec2(0.0), 0.8, 0.5, 5.2), abs(length(p) - 0.28)); d = min(d, bPoint(p, vec2(0.66, 0.36), 0.09)); }
  else if (t < 2.0) { d = min(bSpirale(p, vec2(0.0), 0.8, 2.2), bPoint(p, vec2(0.62, -0.6), 0.09)); }
  else if (t < 3.0) { d = min(bArc(p, vec2(-0.25, 0.0), 0.6, 1.05, 5.24), bArc(p, vec2(0.25, 0.0), 0.6, -2.09, 2.09)); d = min(d, min(bPoint(p, vec2(0.0, 0.72), 0.09), bPoint(p, vec2(0.0, -0.72), 0.09))); }
  else if (t < 4.0) { d = min(abs(length(p) - 0.3), bArc(p, vec2(0.0), 0.62, 1.75, 4.54)); d = min(d, min(bArc(p, vec2(0.0), 0.62, 4.89, 7.68), bArc(p, vec2(0.0), 0.88, 3.49, 5.93))); }
  else if (t < 5.0) { d = min(abs(length(p - vec2(-0.25, -0.15)) - 0.5), abs(length(p - vec2(0.48, 0.45)) - 0.2)); d = min(d, min(bArc(p, vec2(0.48, 0.45), 0.38, 3.49, 7.5), bPoint(p, vec2(-0.25, -0.15), 0.1))); }
  else if (t < 6.0) { d = min(min(bArc(p, vec2(-0.5, 0.1), 0.25, 0.0, 3.1416), bArc(p, vec2(0.0, 0.1), 0.25, 3.1416, 6.2832)), bArc(p, vec2(0.5, 0.1), 0.25, 0.0, 3.1416)); d = min(d, min(min(bPoint(p, vec2(-0.5, -0.32), 0.09), bPoint(p, vec2(0.5, -0.32), 0.09)), bPoint(p, vec2(0.0, 0.6), 0.09))); }
  else if (t < 7.0) { d = min(bSpirale(p, vec2(-0.2, 0.15), 0.55, 1.6), bArc(p, vec2(0.2, -0.2), 0.62, 4.71, 6.98)); d = min(d, bPoint(p, vec2(0.55, 0.6), 0.08)); }
  else if (t < 8.0) { d = min(abs(length(p) - 0.85), abs(length(p) - 0.55)); d = min(d, min(bPoint(p, vec2(0.3, 0.3), 0.1), bPoint(p, vec2(-0.32, -0.3), 0.06))); }
  else { d = min(bArc(p, vec2(0.0, -0.4), 1.0, 0.61, 2.53), abs(length(p) - 0.12)); d = min(d, min(min(bPoint(p, vec2(-0.55, -0.35), 0.09), bPoint(p, vec2(0.0, -0.58), 0.09)), bPoint(p, vec2(0.55, -0.35), 0.09))); }
  return d;
}
`;

  /**
   * Retouche de shader commune. flags : { FLOT, TROU, SCEAUX, DOUBLURE, DECHIRURES, LUEUR, EMISMASQUE,
   * MEMBRANE, DEPTH }. U : objet d'uniformes partagés (mêmes objets { value } pour tous les matériaux).
   */
  function patchBoss(THREE, mat, flags, U, tag) {
    const defs = Object.keys(flags).filter((k) => flags[k]).map((k) => '#define BOSS_' + k + '\n').join('');
    mat.customProgramCacheKey = () => 'boss-' + (tag || '') + '-' + Object.keys(flags).filter((k) => flags[k]).join('-');
    mat.onBeforeCompile = (sh) => {
      for (const k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
${defs}
attribute vec3 aBoss;
varying vec3 vPosB;
varying vec3 vNorB;
varying vec3 vBoss;
uniform float uTemps;
uniform float uFlotAmp;
`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vPosB = position; vNorB = normal; vBoss = aBoss;
#ifdef BOSS_FLOT
if (aBoss.x > 0.0) {
  float ph = position.x * 11.0 + position.z * 9.0 + position.y * 4.0;
  transformed += normal * (sin(uTemps * 3.3 + ph) * 0.6 + sin(uTemps * 5.9 + ph * 1.73) * 0.4) * aBoss.x * uFlotAmp;
}
#endif
`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
${defs}
varying vec3 vPosB;
varying vec3 vNorB;
varying vec3 vBoss;
uniform float uTemps;
uniform float uDissol;
uniform vec3 uDissolCoul;
uniform float uPuis;
uniform vec3 uSceauCoul;
uniform float uVeine;
uniform vec3 uVeineCoul;
uniform vec3 uDoublure;
uniform vec3 uFlash;
${GLSL_BRUIT}
#if defined(BOSS_MEMBRANE) || defined(BOSS_LAME) || defined(BOSS_LAMEPOI)
uniform float uForm;
#endif
#if defined(BOSS_LAME) || defined(BOSS_LAMEPOI)
uniform float uFiss;
uniform float uEffrit;
uniform float uPouls;
uniform vec3 uLameReg;
float bossEffrit(){ return bF3(vPosB * 16.0) * 0.7 + (1.0 - clamp(vBoss.x, 0.0, 1.0)) * 0.3; }
#endif
#ifdef BOSS_MEMBRANE
float bossTrouMem(){ return bF3(vPosB * 6.5 + vec3(0.0, uTemps * 0.04, 0.0)) * 0.72 + bF3(vPosB * 19.0) * 0.28 + (1.0 - clamp(vBoss.y, 0.0, 1.0)) * 0.22; }
#endif
#if defined(BOSS_SCEAUX) || defined(BOSS_ETOLE) || defined(BOSS_TETE7)
${GLSL_SCEAUX}
#endif
#ifdef BOSS_TETE7
uniform vec3 uCicatrice[6];
#endif
float bossDissVal(){
  float d = length((vPosB - vec3(0.0, 1.22, -0.02)) * vec3(1.0, 0.8, 1.0));
  return clamp(0.6 * bF3(vPosB * 9.0) + 0.4 * (1.0 - clamp(d / 1.25, 0.0, 1.0)), 0.0, 1.0);
}
`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float bossDv = 1.0;
if (uDissol > 0.0) { bossDv = bossDissVal() - (uDissol * 1.08 - 0.04); if (bossDv < 0.0) discard; }
#ifdef BOSS_TROU
if (vBoss.y > 0.5) discard;
#endif
#ifdef BOSS_ETOLE
if (vBoss.z < 0.04 && fract(vBoss.x * 15.0 + 0.25) < 0.42 + 6.0 * (0.04 - vBoss.z)) discard;   // frange au bout de l'étole
#endif
#ifdef BOSS_LAME
float bossLf = uForm * 1.1 - 0.02 - vBoss.x;
if (bossLf < 0.0) discard;
float bossLe = bossEffrit() - (uEffrit * 1.08 - 0.03);
if (uEffrit > 0.0 && bossLe < 0.0) discard;
#endif
#ifdef BOSS_LAMEPOI
if (uEffrit > 0.0 && bF3(vPosB * 60.0) * 0.8 + 0.25 - uEffrit * 1.1 < 0.0) discard;
#endif
#ifdef BOSS_MEMBRANE
float bossTm = bossTrouMem();
if (bossTm > 0.655) discard;
float bossFormBord = uForm * 1.12 - vBoss.x;
if (bossFormBord < 0.0) discard;
#endif
#ifdef BOSS_DECHIRURES
float bossTrou = 9.0;
{
  vec3 c0 = vec3(0.262, 0.52, 0.06); vec3 c1 = vec3(-0.15, 0.40, -0.22); vec3 c2 = vec3(0.12, 1.06, -0.17); vec3 c3 = vec3(-0.27, 0.70, 0.10); vec3 c4 = vec3(0.05, 0.30, -0.28);
  float n = (bF3(vPosB * 26.0) - 0.5) * 0.55;
  bossTrou = min(bossTrou, length(vPosB - c0) / 0.045 + n);
  bossTrou = min(bossTrou, length(vPosB - c1) / 0.06 + n);
  bossTrou = min(bossTrou, length(vPosB - c2) / 0.03 + n);
  bossTrou = min(bossTrou, length(vPosB - c3) / 0.05 + n);
  bossTrou = min(bossTrou, length(vPosB - c4) / 0.07 + n);
  if (bossTrou < 1.0) discard;
}
#endif
`)
        .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef BOSS_DOUBLURE
if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, uDoublure * (0.75 + 0.5 * bN3(vPosB * 40.0)), 0.85);
#endif
#ifdef BOSS_DECHIRURES
diffuseColor.rgb *= mix(0.35, 1.0, smoothstep(1.0, 1.35, bossTrou));
#endif
#ifdef BOSS_ETOLE
float bossBrod = 0.0;
{
  float eu = vBoss.x, ev = vBoss.y;
  float bord = min(eu, 1.0 - eu);
  float lis = 1.0 - smoothstep(0.016, 0.026, abs(bord - 0.08));
  float cel = floor(ev / 0.078);
  vec2 q = vec2((eu - 0.5) * 0.088, (fract(ev / 0.078) - 0.5) * 0.078) / 0.026;
  float d = abs(q.x) < 1.4 ? bGlyphe(q, cel) : 9.0;
  float gl = 1.0 - smoothstep(0.075, 0.13, d);
  bossBrod = max(lis, gl);
  float fil = 0.72 + 0.5 * bN3(vPosB * 420.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.21, 0.09) * fil, bossBrod * 0.9);
}
#endif
#ifdef BOSS_BANDAGE
{
  // bandes enroulées en spirale autour de l'axe de l'avant-bras (pose de référence)
  float sxB = vPosB.x >= 0.0 ? 1.0 : -1.0;
  vec3 shB = vec3(0.185 * sxB, 1.418, -0.035), adB = vec3(0.34202 * sxB, -0.93969, 0.0);
  vec3 rB = vPosB - shB;
  float sB = dot(rB, adB);
  vec3 radB = rB - adB * sB;
  vec3 e1B = normalize(cross(adB, vec3(0.0, 0.0, 1.0)));
  float angB = atan(dot(radB, cross(adB, e1B)), dot(radB, e1B));
  float fB = fract(sB / 0.019 + sxB * angB / 6.2831853);
  float bordB = smoothstep(0.78, 0.97, fB);
  float clairB = 1.0 - smoothstep(0.0, 0.18, fB);
  float trameB = 0.9 + 0.1 * sin(sB * 1400.0 + angB * 40.0) * sin(angB * 90.0 - sB * 900.0);
  diffuseColor.rgb *= trameB * (1.0 - 0.55 * bordB) * (1.0 + 0.18 * clairB);
}
#endif
#ifdef BOSS_TETE7
float bossT7c = 0.0, bossT7r = 0.0, bossAgr = 0.0;
{
  vec3 dp = vPosB - vec3(0.0, 1.786, 0.008);
  if (vPosB.y > 1.70 && dot(normalize(vNorB), vec3(0.0, 0.928, 0.372)) > 0.05) {
    vec2 q = vec2(dp.x, dot(dp, vec3(0.0, -0.372, 0.928))) / 0.058;
    float wob = (bN3(vPosB * 380.0) - 0.5) * 0.014;
    float d = bSceau7c(q) + wob;
    bossT7c = 1.0 - smoothstep(0.018, 0.036, d);
    bossT7r = (1.0 - smoothstep(0.036, 0.075, d)) * (1.0 - bossT7c);
  }
  float dmin = 9.0, sAt = 0.0, acc = 0.0;
  for (int i = 0; i < 5; i++) {
    vec3 a = uCicatrice[i], ba = uCicatrice[i + 1] - uCicatrice[i];
    float L = max(length(ba), 1e-5);
    float h = clamp(dot(vPosB - a, ba) / (L * L), 0.0, 1.0);
    float dd = length(vPosB - a - ba * h);
    if (dd < dmin) { dmin = dd; sAt = acc + h * L; }
    acc += L;
  }
  float cic = 1.0 - smoothstep(0.0007, 0.0015, dmin);
  float bour = (1.0 - smoothstep(0.0015, 0.0032, dmin)) * (1.0 - cic);
  float stp = abs(fract(sAt / 0.0088) - 0.5);
  bossAgr = (1.0 - smoothstep(0.07, 0.1, stp)) * (1.0 - smoothstep(0.0036, 0.0044, dmin)) * step(0.005, sAt) * step(sAt, acc - 0.005);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 0.9, 0.92) + vec3(0.04, 0.0, 0.0), bour * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.05, 0.05), cic * 0.85);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.05, 0.03), bossT7c * 0.92);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 0.86, 0.86), bossT7r * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.33, 0.32), bossAgr);
}
#endif
#ifdef BOSS_SCEAUX
float bossSc = 0.0;
{
  float ds = 9.0;
  if (vNorB.z < -0.2 && vPosB.z < -0.03) {
    ds = min(ds, bSceauD(vec2(vPosB.x, vPosB.y - 1.265) / 0.15, 1.0) * 0.15);
    ds = min(ds, bSceauD(vec2(vPosB.x - 0.155, vPosB.y - 0.64) / 0.095, 2.0) * 0.095);
    ds = min(ds, bSceauD(vec2(vPosB.x + 0.155, vPosB.y - 0.64) / 0.095, 3.0) * 0.095);
  }
  if (vNorB.z > 0.25 && vPosB.z > 0.02) {
    ds = min(ds, bSceauD(vec2(vPosB.x - 0.235, vPosB.y - 0.56) / 0.062, 5.0) * 0.062);
    ds = min(ds, bSceauD(vec2(vPosB.x + 0.235, vPosB.y - 0.56) / 0.062, 6.0) * 0.062);
  }
  float wob = (bN3(vPosB * 90.0) - 0.5) * 0.0012;
  float ch = 1.0 - smoothstep(0.0024, 0.0062, ds + wob);
  bossSc = 1.0 - smoothstep(0.0007, 0.0024, ds + wob);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.22 + vec3(0.03, 0.012, 0.006), ch * 0.9);
}
#endif
`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#ifdef BOSS_LAME
roughnessFactor = mix(roughnessFactor, 0.85, vBoss.z);
#endif
#ifdef BOSS_TETE7
roughnessFactor = mix(roughnessFactor, 0.32, bossAgr);
#endif
#ifdef BOSS_ETOLE
roughnessFactor = mix(roughnessFactor, 0.72, bossBrod);
#endif
`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
#ifdef BOSS_TETE7
metalnessFactor = mix(metalnessFactor, 0.85, bossAgr);
#endif
#ifdef BOSS_ETOLE
metalnessFactor = mix(metalnessFactor, 0.06, bossBrod);
#endif
`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef BOSS_EMISMASQUE
totalEmissiveRadiance *= vBoss.z;
#endif
#ifdef BOSS_SCEAUX
if (gl_FrontFacing) totalEmissiveRadiance += uSceauCoul * bossSc * (0.025 + uPuis * uPuis * 1.3 * (0.8 + 0.2 * sin(uTemps * 6.0 + vPosB.y * 23.0)));
#endif
#ifdef BOSS_LUEUR
totalEmissiveRadiance += uVeineCoul * vBoss.z * uVeine * (0.75 + 0.25 * sin(uTemps * 4.0 + vPosB.y * 30.0 + vPosB.x * 20.0));
#endif
#ifdef BOSS_TETE7
totalEmissiveRadiance += vec3(1.5, 0.36, 0.07) * bossT7c * (0.35 + 0.9 * clamp(uPuis + uVeine, 0.0, 1.2)) * (0.85 + 0.15 * sin(uTemps * 2.7));
#endif
#ifdef BOSS_ETOLE
totalEmissiveRadiance += uSceauCoul * bossBrod * (0.003 + uPuis * uPuis * 0.06) * (0.8 + 0.2 * sin(uTemps * 5.0 + vBoss.y * 9.0));
#endif
#ifdef BOSS_LAME
{
  float sangL = 1.0 - vBoss.z;
  float vnL = abs(bF3(vPosB * 6.0 + vec3(0.0, uTemps * 0.12, 0.0)) - 0.5);
  float veL = 1.0 - smoothstep(0.0, 0.014, vnL);
  float finL = 1.0 - clamp(vBoss.y, 0.0, 1.0);
  float fresL = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
  float frontL = 1.0 - smoothstep(0.0, 0.07, bossLf);
  float fissL = uFiss * (1.0 - smoothstep(0.0, 0.025, abs(bF3(vPosB * 20.0 + 3.3) - 0.5))) * smoothstep(0.0, 0.3, uFiss * 1.3 - bF3(vPosB * 3.0) * 0.8);
  // uLameReg (palette, v2.2) : x = lueur de base du verre, y = reflet de bord, z = force des veines ; rouge : (0, 0,1, 1)
  totalEmissiveRadiance += uVeineCoul * sangL * (veL * (0.12 + 0.6 * uPouls) * (0.6 + 0.6 * uVeine) * uLameReg.z + finL * finL * finL * 0.1 + fresL * uLameReg.y + uLameReg.x + frontL * 3.0 + fissL * 5.0);
  if (uEffrit > 0.0) totalEmissiveRadiance += uVeineCoul * (1.0 - smoothstep(0.0, 0.05, bossLe)) * 3.0;
}
#endif
#ifdef BOSS_MEMBRANE
{
  float vn = abs(bF3(vPosB * 9.0 + 1.7) - 0.5);
  float ve = 1.0 - smoothstep(0.0, 0.018, vn);
  float ve2 = 1.0 - smoothstep(0.0, 0.012, abs(bF3(vPosB * 23.0 + 4.1) - 0.5));
  float bord = 1.0 - smoothstep(0.0, 0.22, vBoss.y);
  float bt = smoothstep(0.6, 0.655, bossTm);
  float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
  float fb = 1.0 - smoothstep(0.0, 0.06, bossFormBord);
  float pulse = 0.65 + 0.35 * sin(uTemps * 4.5 + vPosB.x * 7.0 + vPosB.y * 3.0);
  diffuseColor.rgb *= 1.0 - 0.6 * bt;
  totalEmissiveRadiance += uVeineCoul * ((ve * 0.55 + ve2 * 0.25) * (0.08 + 0.35 * uVeine) * pulse + bord * 0.22 + bt * 0.45 + fres * 0.06 + fb * 2.0);
}
#endif
if (uDissol > 0.0) totalEmissiveRadiance += uDissolCoul * ((1.0 - smoothstep(0.0, 0.035, bossDv)) * 3.2 + (1.0 - smoothstep(0.0, 0.12, bossDv)) * 0.6);
totalEmissiveRadiance += uFlash;
`);
    };
    return mat;
  }
  // matériau de profondeur (ombres) qui suit la dissolution et le flottement
  function depthBoss(THREE, flags, U, tag) {
    const rev = parseInt(THREE.REVISION, 10);
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    if (rev < 129) m.skinning = true;
    const f = { FLOT: !!flags.FLOT, DEPTH: true };
    const defs = Object.keys(f).filter((k) => f[k]).map((k) => '#define BOSS_' + k + '\n').join('');
    m.customProgramCacheKey = () => 'bossdepth-' + (tag || '') + (f.FLOT ? '-flot' : '');
    m.onBeforeCompile = (sh) => {
      for (const k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
${defs}
attribute vec3 aBoss;
varying vec3 vPosB;
uniform float uTemps;
uniform float uFlotAmp;
`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vPosB = position;
#ifdef BOSS_FLOT
if (aBoss.x > 0.0) {
  float ph = position.x * 11.0 + position.z * 9.0 + position.y * 4.0;
  transformed += normal * (sin(uTemps * 3.3 + ph) * 0.6 + sin(uTemps * 5.9 + ph * 1.73) * 0.4) * aBoss.x * uFlotAmp;
}
#endif
`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vPosB;
uniform float uDissol;
${GLSL_BRUIT}
float bossDissVal(){
  float d = length((vPosB - vec3(0.0, 1.22, -0.02)) * vec3(1.0, 0.8, 1.0));
  return clamp(0.6 * bF3(vPosB * 9.0) + 0.4 * (1.0 - clamp(d / 1.25, 0.0, 1.0)), 0.0, 1.0);
}
`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uDissol > 0.0 && bossDissVal() - (uDissol * 1.08 - 0.04) < 0.0) discard;
`);
    };
    return m;
  }

  /** Matériaux PBR du corps : couleurs de sommets × texture de détail, retouches communes. */
  function materiauxCorps(THREE, U, opts) {
    const rev = parseInt(THREE.REVISION, 10);
    const TD = texturesDetail(THREE);
    const defs = {
      peau: { r: 0.6, tex: 'peau', tile: 0.035, ns: 0.55, f: { LUEUR: true, TROU: true, TETE7: !!(opts && opts.teteRemplacement) } },
      manteau: { r: 0.66, tex: 'cuir', tile: 0.05, ns: 0.75, double: true, morph: true, f: { SCEAUX: true, DOUBLURE: true, DECHIRURES: true, FLOT: true } },
      tunique: { r: 0.93, tex: 'drap', tile: 0.03, ns: 0.7, f: {} },
      pantalon: { r: 0.92, tex: 'drap', tile: 0.035, ns: 0.6, double: true, f: {} },
      botte: { r: 0.55, tex: 'cuir', tile: 0.06, ns: 0.55, f: {} },
      cuir: { r: 0.62, tex: 'cuir', tile: 0.04, ns: 0.6, f: {} },
      gant: { r: 0.5, tex: 'cuir', tile: 0.022, ns: 0.45, f: {} },
      metal: { r: 0.48, m: 0.75, tex: 'cuir', tile: 0.02, ns: 0.25, f: {} },
      yeux: { r: 0.22, f: { EMISMASQUE: true }, emis: 0xff2a12 },
      bouche: { r: 0.75, f: {} },
      lambeaux: { r: 0.7, tex: 'cuir', tile: 0.05, ns: 0.75, double: true, f: { DOUBLURE: true, FLOT: true } },
      etole: { r: 0.88, tex: 'drap', tile: 0.012, ns: 0.6, double: true, f: { ETOLE: true } },
      ame: { r: 0.3, f: { EMISMASQUE: true }, emis: 0x34e6c2, emisI: 1.15 },
      verre: { r: 0.06, f: {}, transparent: 0.32 },
      bandage: { r: 0.95, tex: 'drap', tile: 0.008, ns: 0.8, f: { BANDAGE: true } }
    };
    const out = {};
    for (const k in defs) {
      const d = defs[k];
      const m = new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, roughness: d.r, metalness: d.m || 0,
        side: d.double ? THREE.DoubleSide : THREE.FrontSide
      });
      if (d.transparent) { m.transparent = true; m.opacity = d.transparent; m.depthWrite = false; }
      if (d.morph && rev < 129) m.morphTargets = true;
      if (d.tex && TD[d.tex]) {
        const T = TD[d.tex];
        const rep = 1 / d.tile;
        const td = T.d.clone(), tn = T.n.clone();
        td.needsUpdate = true; tn.needsUpdate = true;
        td.repeat.set(rep, rep); tn.repeat.set(rep, rep);
        m.map = td; m.roughnessMap = td; m.normalMap = tn;
        m.normalScale.set(d.ns, d.ns);
        m.color.setScalar(1 / 0.8);
        m.roughness = Math.min(1, d.r / 0.8);
      }
      if (d.emis) { m.emissive.setHex(d.emis); m.emissiveIntensity = d.emisI || 2.5; }
      if (rev < 129) m.skinning = true;
      patchBoss(THREE, m, d.f, U, k);
      m.name = 'boss-' + k;
      m.userData.flags = d.f;
      out[k] = m;
    }
    return out;
  }

  // ============================================================================================
  // Corps du Septième sous et sur le manteau : col de chemise sombre (visible dans l'échancrure du col),
  // ceinture de cuir portée SUR le manteau (boucle simple sans emblème) avec trois fioles de verre à lueur
  // d'âme et une chaîne, pantalon sombre droit, bottes hautes usées, avant-bras bandés (visibles quand la
  // manche remonte), cou décharné. Aucune pièce d'uniforme. Lofts et plis repris de ../survivant/src/body.js.
  // ============================================================================================
  const CEINTURE_Y = [0.985, 1.033];

  // anneaux de la ceinture : au-dessus du buste et du haut de la jupe du manteau, plus l'épaisseur
  function anneauxCeinture() {
    const RB = prepRings(MANTEAU_RINGS), RJ = prepRings(JUPE_RINGS);
    return [0, 0.5, 1].map((t) => {
      const y = lerp(CEINTURE_Y[0], CEINTURE_Y[1], t);
      const b = interpRing(RB, y - MANTEAU_Y0), j = interpRing(RJ, y - JUPE_Y0), e = 0.0075;
      return { s: y - CEINTURE_Y[0], wL: Math.max(b.wL, j.wL) + e, wR: Math.max(b.wR, j.wR) + e, dF: Math.max(b.dF, j.dF) + e, dB: Math.max(b.dB, j.dB) + e, n: 2.35, oz: lerp(b.oz, j.oz, 0.5) };
    });
  }

  function construireCorps(bd, THREE, I, W, Q) {
    // poids du tronc : bassin → colonne → poitrine → cou (+ clavicules sur les épaules)
    const torsoWeights = (y, x) => {
      const tHS = smooth(1.0, 1.13, y), tSC = smooth(1.17, 1.31, y), tCN = smooth(1.455, 1.50, y);
      const wh = 1 - tHS, ws = tHS * (1 - tSC), wc = tSC * (1 - tCN), wn = tCN;
      const cl = smooth(0.07, 0.16, Math.abs(x)) * smooth(1.33, 1.42, y) * 0.75;
      const clav = x >= 0 ? I.clavL : I.clavR;
      return [[I.hips, wh], [I.spine, ws], [I.chest, wc * (1 - cl)], [clav, wc * cl], [I.neck, wn]];
    };
    Q.torsoWeights = torsoWeights;
    const R = rng(1203);

    // ---------------------------------------------------------------- col de chemise sombre (dans l'échancrure du col)
    const chemiseCol = (P) => mixc(mixc(PAL.tunique, PAL.tuniqueSombre, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 201) * 0.6), PAL.sangSec, smooth(0.66, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 203)) * 0.5);
    bd.loft('tunique', {
      a: [0, 1.43, -0.03], b: [0, 1.53, -0.03], seg: 20, step: 0.03, rim1: 0.002,
      rings: [{ s: 0.0, w: 0.086, dF: 0.080, dB: 0.086 }, { s: 0.05, w: 0.068, dF: 0.063, dB: 0.072 }, { s: 0.085, w: 0.064, dF: 0.059, dB: 0.068 }],
      hem1: (ang) => 0.02 * Math.pow(Math.max(0, Math.cos(ang)), 4), hemDepth1: 0.022,
      weights: (s, ang, P) => { const t = smooth(1.45, 1.52, P[1]); return [[I.chest, 0.6 * (1 - t) + 0.25 * t], [I.neck, 0.4 * (1 - t) + 0.75 * t]]; },
      color: chemiseCol
    });

    // ---------------------------------------------------------------- ceinture de cuir sur le manteau
    const cuirCol = (P) => mixc(mixc(PAL.cuir, PAL.cuirClair, fbm(P[0] * 50, P[1] * 50, P[2] * 50, 211) * 0.5), PAL.poussiere, smooth(0.65, 0.85, fbm(P[0] * 18, P[1] * 18, P[2] * 18, 213)) * 0.3);
    const BELT = anneauxCeinture();
    bd.loft('cuir', {
      a: [0, CEINTURE_Y[0], 0], b: [0, CEINTURE_Y[1], 0], seg: 44, step: 0.024, rings: BELT, rim0: 0.002, rim1: 0.002,
      radius: (s) => 1 + 0.02 * gauss(s, 0.024, 0.016),
      weights: () => [[I.hips, 1]],
      color: (P, s) => mixc(cuirCol(P), mulc(PAL.cuir, 0.55), Math.max(gauss(s, 0.003, 0.003), gauss(s, 0.045, 0.003)) * 0.7)
    });
    const surfCeinture = (y, ang, grow) => surfPoint(BELT, CEINTURE_Y[0], y, ang, grow);
    {
      // boucle à cadre rectangulaire et ardillon (aucun emblème), un peu décalée sur la gauche
      const c = surfCeinture(1.009, 0.12, 0.004);
      const n = vnorm([Math.sin(0.12), 0, Math.cos(0.12)]), tg = [n[2], 0, -n[0]];
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(tg[0], tg[1], tg[2]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2])).setPosition(c[0], c[1], c[2]);
      for (const [w, h, x, y] of [[0.046, 0.006, 0, 0.022], [0.046, 0.006, 0, -0.022], [0.006, 0.05, 0.02, 0], [0.006, 0.05, -0.02, 0], [0.004, 0.044, -0.003, 0]]) {
        bd.rigid('metal', new THREE.BoxGeometry(w, h, 0.005), new THREE.Matrix4().makeTranslation(x, y, 0.002).premultiply(M), [[I.hips, 1]], (P, N) => mixc(PAL.metal, PAL.rouille, 0.25 + 0.4 * fbm(P[0] * 300, P[1] * 300, P[2] * 300, 215)));
      }
    }
    // fioles de verre suspendues sur la hanche gauche (vers l'arrière) : lueur d'âme bleu-vert pâle
    {
      const profilVerre = [[0.0001, -0.031], [0.0105, -0.03], [0.0124, -0.018], [0.0124, 0.014], [0.0056, 0.025], [0.0052, 0.033], [0.0066, 0.036]];
      const profilAme = [[0.0001, -0.027], [0.0095, -0.026], [0.0102, 0.006], [0.0001, 0.012]];
      const lathe = (prof, n) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), n);
      for (const [ang, dy, rot] of [[1.82, 0.0, 0.05], [2.12, -0.008, -0.08], [2.42, 0.004, 0.1]]) {
        const top = surfCeinture(0.985, ang, 0.0);
        const n = vnorm([Math.sin(ang), 0, Math.cos(ang)]);
        const c = vadd(vadd(top, vscale(n, 0.018)), [0, -0.05 + dy, 0]);
        const M = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot, ang, -rot * 0.5)).setPosition(c[0], c[1], c[2]);
        bd.rigid('verre', lathe(profilVerre, bd.n(8, 6)), M, [[I.hips, 1]], PAL.verre);
        bd.cur = [0, 0, 1];
        bd.rigid('ame', lathe(profilAme, bd.n(7, 5)), M, [[I.hips, 1]], PAL.ame);
        bd.cur = [0, 0, 0];
        // bouchon de cuir et lanière qui la retient à la ceinture
        bd.rigid('cuir', new THREE.CylinderGeometry(0.0062, 0.0058, 0.009, 6, 1), new THREE.Matrix4().makeTranslation(0, 0.039, 0).premultiply(M), [[I.hips, 1]], (P) => cuirCol(P));
        const pts = [vadd(top, vscale(n, 0.004)), vadd(vadd(top, vscale(n, 0.012)), [0, -0.02, 0]), vadd(c, [0, 0.042, 0])];
        bd.ribbon('cuir', pts, 0.008, 0.0025, () => n, () => [[I.hips, 1]], (P) => cuirCol(P));
      }
    }
    // chaîne de fer qui pend de l'avant droit de la ceinture vers la hanche droite
    {
      const a0 = -0.5, a1 = -1.95, nl = Math.max(8, Math.round(13 * bd.q));
      const pts = [];
      for (let i = 0; i <= nl; i++) {
        const t = i / nl, a = lerp(a0, a1, t), sag = 0.075 * Math.sin(Math.PI * t);
        const y = CEINTURE_Y[0] + 0.002 - sag;
        // sous la ceinture la chaîne s'écarte de la jupe du manteau
        const P = surfPoint(JUPE_RINGS, JUPE_Y0, Math.min(y, 1.02), a, 0.012);
        const B0 = surfCeinture(Math.max(y, CEINTURE_Y[0]), a, 0.006);
        pts.push([lerp(B0[0], P[0], smooth(0.0, 0.03, sag)), y, lerp(B0[2], P[2], smooth(0.0, 0.03, sag))]);
      }
      for (let i = 0; i < nl; i++) {
        const p0 = pts[i], p1 = pts[i + 1], mid = vlerp(p0, p1, 0.5), d = vnorm(vsub(p1, p0));
        const g = new THREE.TorusGeometry(0.0072, 0.0017, bd.n(4, 3), bd.n(7, 5));
        g.scale(1.35, 1, 1);
        const out = vnorm([mid[0], 0, mid[2]]);
        const up = i % 2 ? out : vnorm(vcross(d, out));
        const X = d, Z = vnorm(vcross(X, up)), Y = vcross(Z, X);
        const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2])).setPosition(mid[0], mid[1], mid[2]);
        bd.rigid('metal', g, M, [[I.hips, 1]], (P) => mixc(PAL.fer, PAL.rouille, 0.3 + 0.5 * fbm(P[0] * 200, P[1] * 200, P[2] * 200, 217)));
      }
    }

    // ---------------------------------------------------------------- avant-bras bandés (sous la manche, visibles quand elle remonte)
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const sh = [0.185, 1.418, -0.035], armEnd = vadd(sh, vscale(ARM_DIR, 0.62));
      const elbowS = L_UPPER, wristS = L_UPPER + L_FORE;
      const armW = (s) => {
        const t1 = smooth(elbowS - 0.05, elbowS + 0.05, s), t2 = smooth(elbowS + 0.06, wristS, s) * 0.55;
        return [[I['arm' + S], 1 - t1], [I['fore' + S], t1 * (1 - t2)], [I['tors' + S], t1 * t2]];
      };
      const spire = 0.019;
      bd.loft('bandage', {
        a: sh, b: armEnd, mirror: sx < 0, seg: 12, step: 0.012, s0: wristS - 0.2, s1: wristS - 0.022,
        rings: [{ s: wristS - 0.2, w: 0.037, d: 0.04 }, { s: wristS - 0.13, w: 0.032, d: 0.036 }, { s: wristS - 0.07, w: 0.027, d: 0.0325 }, { s: wristS - 0.022, w: 0.021, d: 0.0285 }],
        displace: (P, s, ang, r, radial) => {
          const f = (s / spire + ang / TAU * (sx > 0 ? 1 : -1)) % 1, fr = f < 0 ? f + 1 : f;
          const d = 0.0016 * smooth(0.0, 0.1, fr) - 0.0012 * smooth(0.8, 1.0, fr) + 0.0005 * vnoise(s * 300, ang * 4, sx, 219);
          return radialD(radial, d);
        },
        weights: (s) => armW(s),
        color: (P, s, ang) => {
          const f = (s / spire + ang / TAU * (sx > 0 ? 1 : -1)) % 1, fr = f < 0 ? f + 1 : f;
          let c = mixc(PAL.bandage, PAL.bandageSale, 0.2 + 0.6 * fbm(P[0] * 60, P[1] * 60, P[2] * 60, 221));
          c = mixc(c, mulc(PAL.bandageSale, 0.45), smooth(0.78, 0.98, fr) * 0.85);                  // bord sombre de chaque tour
          c = mixc(c, mulc(PAL.bandage, 1.12), smooth(0.25, 0.0, fr) * 0.3);                        // arête claire du tour suivant
          c = mixc(c, PAL.sangSec, smooth(0.62, 0.78, fbm(P[0] * 35 + sx, P[1] * 35, P[2] * 35, 223)) * 0.75);
          return mixc(c, PAL.cendre, smooth(0.7, 0.9, fbm(P[0] * 80, P[1] * 80, P[2] * 80, 225)) * 0.3);
        }
      });
    }
    void R;

    // ---------------------------------------------------------------- pantalon sombre, droit, rentré dans les bottes
    const culCol = (P, s, ang) => {
      let c = mixc(PAL.pantalon, PAL.pantalonSombre, fbm(P[0] * 20, P[1] * 40, P[2] * 20, 227) * 0.55);
      c = mixc(c, PAL.poussiere, smooth(0.6, 0.85, fbm(P[0] * 14, P[1] * 14, P[2] * 14, 229)) * 0.25);
      return mixc(c, PAL.cendre, smooth(0.45, 0.2, P[1]) * 0.15);
    };
    bd.loft('pantalon', {
      a: [0, 0.80, -0.008], b: [0, 1.0, -0.008], seg: 24, step: 0.04,
      rings: [{ s: 0.0, w: 0.118, dF: 0.07, dB: 0.08, n: 2.4 }, { s: 0.06, w: 0.142, dF: 0.088, dB: 0.104, n: 2.4 },
        { s: 0.13, w: 0.148, dF: 0.092, dB: 0.106, n: 2.4 }, { s: 0.2, w: 0.146, dF: 0.094, dB: 0.1, n: 2.4 }],
      weights: (s, ang, P) => {
        const sideB = P[0] >= 0 ? I.thighL : I.thighR;
        const low = smooth(0.92, 0.84, P[1]) * smooth(0.04, 0.12, Math.abs(P[0])) * 0.6;
        return [[I.hips, 1 - low], [sideB, low]];
      },
      color: culCol
    });
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const hipP = [0.092, 1.0, 0.0], ank = W.footL;
      const kneeS = vlen(vsub(W.shinL, hipP));
      bd.loft('pantalon', {
        a: hipP, b: ank, mirror: sx < 0, seg: 18, step: 0.03, s0: 0.0, s1: 0.56,
        rings: [
          { s: 0.0, wL: 0.084, wR: 0.1, dF: 0.092, dB: 0.104, n: 2.3 },
          { s: 0.10, wL: 0.077, wR: 0.092, dF: 0.087, dB: 0.094, n: 2.25 },
          { s: 0.20, wL: 0.071, wR: 0.084, dF: 0.082, dB: 0.085, n: 2.2 },
          { s: 0.29, wL: 0.066, wR: 0.077, dF: 0.076, dB: 0.077, n: 2.2 },
          { s: 0.38, wL: 0.061, wR: 0.068, dF: 0.07, dB: 0.068 },
          { s: kneeS - 0.04, w: 0.058, dF: 0.064, dB: 0.062 },
          { s: 0.53, w: 0.056, dF: 0.06, dB: 0.06 }
        ],
        displace: (P, s, ang, r, radial) => {
          let d = ripple(s, ang, kneeS - 0.01, 0.03, 0.02, 0.0035, 0, 1.0) + ripple(s, ang, 0.5, 0.025, 0.018, 0.003, 0, 3.5);
          d += 0.0018 * Math.sin(ang * 2 + s * 21) * gauss(s, 0.25, 0.08);
          d += seamAt(ang, -Math.PI / 2, 0.0012) + seamAt(ang, Math.PI / 2, 0.0009);
          return radialD(radial, d);
        },
        weights: (s) => {
          const t1 = smooth(0.0, 0.16, s), t2 = smooth(kneeS - 0.05, kneeS + 0.05, s);
          return [[I.hips, 1 - t1], [I['thigh' + S], t1 * (1 - t2)], [I['shin' + S], t2]];
        },
        color: culCol
      });

      // ------------------------------------------------------------ bottes hautes usées (cuir éraflé, plis, poussière)
      const fx = 0.104, fxs = 0.104 * sx;
      const knee = W.shinL;
      const bootCol = (P, s, ang) => {
        let c = mixc(PAL.botte, PAL.botteReflet, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 231) * 0.45);
        c = mixc(c, PAL.poussiere, smooth(0.55, 0.85, fbm(P[0] * 16, P[1] * 16, P[2] * 16, 233)) * 0.4 + smooth(0.08, 0.02, P[1]) * 0.3);
        c = mixc(c, PAL.cendre, smooth(0.7, 0.9, fbm(P[0] * 60, P[1] * 60, P[2] * 60, 235)) * 0.2);
        const raye = 1 - smooth(0.0, 0.03, Math.abs(vnoise(P[0] * 60, P[1] * 9, P[2] * 60, 237) - 0.5));   // éraflures claires
        return mixc(c, PAL.botteReflet, raye * 0.5 * smooth(0.6, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 239)));
      };
      // tige : du dessous du genou à la cheville
      const shaftLen = vlen(vsub(ank, knee));
      bd.loft('botte', {
        a: knee, b: ank, mirror: sx < 0, seg: 16, step: 0.034, s0: 0.022, s1: shaftLen + 0.03, rim0: 0.004,
        rings: [
          { s: 0.022, w: 0.061, dF: 0.066, dB: 0.068 }, { s: 0.06, w: 0.058, dF: 0.061, dB: 0.066 },
          { s: 0.15, w: 0.056, dF: 0.058, dB: 0.069 }, { s: 0.25, w: 0.05, dF: 0.051, dB: 0.059 },
          { s: 0.34, w: 0.044, dF: 0.046, dB: 0.048 }, { s: shaftLen - 0.01, w: 0.045, dF: 0.05, dB: 0.047 },
          { s: shaftLen + 0.03, w: 0.047, dF: 0.06, dB: 0.05 }
        ],
        hem0: (ang) => 0.022 * Math.pow(Math.max(0, -Math.cos(ang)), 2), hemDepth0: 0.025,   // échancrure à l'arrière du genou
        displace: (P, s, ang, r, radial) => {
          let d = ripple(s, ang, shaftLen - 0.045, 0.03, 0.016, 0.0028, 0, 1.4) + ripple(s, ang, shaftLen - 0.02, 0.02, 0.012, 0.002, Math.PI, 1.0);
          d += 0.0015 * Math.sin(ang * 5 + s * 23) * gauss(s, shaftLen - 0.08, 0.04);
          return radialD(radial, d);
        },
        weights: (s) => { const t = smooth(shaftLen - 0.04, shaftLen + 0.02, s); return [[I['shin' + S], 1 - t], [I['foot' + S], t]]; },
        color: bootCol
      });
      const footW = (s) => { const t = smooth(0.17, 0.24, s); return [[I['foot' + S], 1 - t], [I['toes' + S], t]]; };
      // semelle fine et talon
      bd.loft('botte', {
        a: [fx, 0.014, -0.088], b: [fx, 0.014, 0.21], front: [0, 1, 0], mirror: sx < 0, seg: 14, step: 0.022,
        rings: [
          { s: 0.0, w: 0.026, dF: 0.016, dB: 0.014, n: 3.2 }, { s: 0.02, w: 0.034, dF: 0.017, dB: 0.014, n: 3.4 },
          { s: 0.07, w: 0.036, dF: 0.016, dB: 0.014, n: 3.4 }, { s: 0.085, w: 0.034, dF: 0.008, dB: 0.006, n: 3.4 },
          { s: 0.15, wL: 0.034, wR: 0.039, dF: 0.006, dB: 0.006, n: 3.4 }, { s: 0.22, w: 0.04, dF: 0.006, dB: 0.006, n: 3.2 },
          { s: 0.27, w: 0.032, dF: 0.006, dB: 0.006, n: 2.8 }, { s: 0.298, w: 0.012, dF: 0.005, dB: 0.005, n: 2.4 }
        ],
        cap0: true, cap1: true,
        weights: footW,
        color: (P) => mixc(PAL.semelle, PAL.poussiere, smooth(0.5, 0.8, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 237)) * 0.35)
      });
      // empeigne effilée
      bd.loft('botte', {
        a: [fx, 0.05, -0.085], b: [fx, 0.05, 0.205], front: [0, 1, 0], mirror: sx < 0, seg: 18, step: 0.017,
        rings: [
          { s: 0.0, w: 0.022, dF: 0.045, dB: 0.03, n: 2.6 }, { s: 0.025, w: 0.036, dF: 0.056, dB: 0.03, n: 2.7 },
          { s: 0.07, w: 0.04, dF: 0.06, dB: 0.032, n: 2.8 }, { s: 0.13, wL: 0.039, wR: 0.043, dF: 0.054, dB: 0.034, n: 2.8 },
          { s: 0.19, wL: 0.042, wR: 0.044, dF: 0.034, dB: 0.034, n: 2.8 }, { s: 0.24, w: 0.039, dF: 0.022, dB: 0.034, n: 2.7 },
          { s: 0.275, w: 0.028, dF: 0.016, dB: 0.033, n: 2.4 }, { s: 0.293, w: 0.012, dF: 0.01, dB: 0.03, n: 2.2 }
        ],
        cap0: true, cap1: true,
        displace: (P, s, ang, r, radial) => radialD(radial, ripple(s, ang, 0.17, 0.014, 0.009, 0.0016, 0, 0.9)),
        weights: footW,
        color: bootCol
      });
      // cou-de-pied : raccord entre la tige et l'empeigne
      bd.loft('botte', {
        a: [fxs, 0.06, -0.035], b: [fxs, 0.14, -0.03], seg: 14, step: 0.03,
        rings: [{ s: 0.0, w: 0.044, dF: 0.05, dB: 0.046 }, { s: 0.05, w: 0.045, dF: 0.052, dB: 0.046 }, { s: 0.08, w: 0.046, dF: 0.054, dB: 0.047 }],
        weights: (s) => { const t = smooth(0.03, 0.08, s); return [[I['foot' + S], 1 - t * 0.5], [I['shin' + S], t * 0.5]]; },
        color: bootCol
      });
    }

    // ---------------------------------------------------------------- cou décharné (tendons, pomme d'Adam, veines)
    // (absent si un module de tête est fourni : son cou descend jusqu'à y = 1,431 m, sous le col)
    if (!Q.sansCou) bd.loft('peau', {
      a: [0, 1.43, -0.032], b: [0, 1.655, -0.03], seg: 18, step: 0.02,
      rings: [{ s: 0.0, w: 0.072, dF: 0.062, dB: 0.074 }, { s: 0.06, w: 0.058, dF: 0.052, dB: 0.062 }, { s: 0.13, w: 0.052, dF: 0.048, dB: 0.056, oz: 0.004 }, { s: 0.2, w: 0.055, dF: 0.05, dB: 0.056, oz: 0.008 }, { s: 0.225, w: 0.058, dF: 0.048, dB: 0.054, oz: 0.01 }],
      displace: (P, s, ang, r, radial) => {
        const a = wrapPi(ang);
        let d = 0.004 * gauss(a, 0, 0.18) * gauss(s, 0.09, 0.025);                      // pomme d'Adam
        d += 0.004 * (gauss(a, 0.75, 0.16) + gauss(a, -0.75, 0.16)) * gauss(s, 0.08, 0.06);  // sterno-cléido-mastoïdiens
        d -= 0.003 * (gauss(a, 0.38, 0.12) + gauss(a, -0.38, 0.12)) * gauss(s, 0.06, 0.05);
        return radialD(radial, d);
      },
      weights: (s, ang, P) => { const y = P[1]; const t0 = smooth(1.44, 1.49, y), t1 = smooth(1.57, 1.63, y); return [[I.chest, 1 - t0], [I.neck, t0 * (1 - t1)], [I.head, t1]]; },
      color: (P, s, ang) => {
        let c = mixc(PAL.peau, PAL.peauOmbre, 0.25 + fbm(P[0] * 40, P[1] * 40, P[2] * 40, 241) * 0.3);
        const v = 1 - smooth(0.0, 0.05, Math.abs(vnoise(s * 30, ang * 2.5, 3, 243) - 0.5));
        return mixc(c, PAL.veine, v * 0.45 * smooth(-0.3, 0.6, Math.abs(Math.sin(ang))));
      },
      extra: (P, s, ang) => [0, 0, (1 - smooth(0.0, 0.04, Math.abs(vnoise(s * 30, ang * 2.5, 3, 243) - 0.5))) * 0.5]
    });
  }

  // ============================================================================================
  // Long manteau de cuir noir-brun du Septième (mi-mollet), fermé sur le buste par des attaches de cuir à
  // crochets de fer, col montant sans revers, broche occulte à gemme rouge au col ; manches de cuir à
  // sangle de poignet, qui remontent quand l'avant-bras se lève (cibles de morphose) et découvrent les
  // bandages ; jupe fendue (devant, dos, côtés) aux ourlets en lambeaux portés par des chaînes d'os animées
  // (physique de ressorts) ; éraflures, brûlures, cendre. Aucune pièce d'uniforme (ni revers, ni pattes
  // d'épaule, ni boutons, ni baudrier).
  // ============================================================================================
  const MANTEAU_Y0 = 0.95;
  const MANTEAU_RINGS = [
    { s: 0.0, w: 0.178, dF: 0.121, dB: 0.13, n: 2.35 }, { s: 0.04, w: 0.173, dF: 0.118, dB: 0.127, n: 2.35 },
    { s: 0.12, w: 0.171, dF: 0.117, dB: 0.122, n: 2.35 }, { s: 0.21, w: 0.176, dF: 0.121, dB: 0.122, n: 2.35 },
    { s: 0.30, w: 0.187, dF: 0.131, dB: 0.127, n: 2.4, oz: 0.003 }, { s: 0.38, w: 0.197, dF: 0.135, dB: 0.133, n: 2.45 },
    { s: 0.44, w: 0.207, dF: 0.125, dB: 0.134, n: 2.55, oz: -0.006 }, { s: 0.48, w: 0.200, dF: 0.109, dB: 0.12, n: 2.5, oz: -0.012 },
    { s: 0.505, w: 0.162, dF: 0.095, dB: 0.106, n: 2.4, oz: -0.017 }, { s: 0.525, w: 0.12, dF: 0.085, dB: 0.096, n: 2.3, oz: -0.021 },
    { s: 0.545, w: 0.092, dF: 0.079, dB: 0.09, n: 2.2, oz: -0.025 }
  ];
  // ouverture du buste : bords jointifs (manteau fermé), petite échancrure sous le col
  const ouvertureBuste = (y) => lerp(0.03, 0.17, smooth(1.40, 1.48, y));
  const MANCHE_RETRAIT = 0.085;      // la manche remonte au plus de 8,5 cm le long de l'avant-bras

  // poids de peau de la jupe : chaînes voisines (fraction f autour du manteau) × os le long de la chaîne
  function poidsJupe(I, f, y) {
    const fk = clamp(f, 0, 1) * (PAN_N - 1), k0 = Math.min(PAN_N - 2, Math.floor(fk)), t = fk - k0;
    const below = [smooth(PAN_Y[0] + 0.045, PAN_Y[0] - 0.08, y)];
    for (let j = 1; j < PAN_Y.length - 1; j++) below.push(smooth(PAN_Y[j] + 0.05, PAN_Y[j] - 0.05, y));
    below.push(0);
    const out = [[I.hips, 1 - below[0]]];
    for (const [k, wk] of [[k0, 1 - t], [k0 + 1, t]]) {
      if (wk < 1e-4) continue;
      for (let i = 0; i < PAN_Y.length - 1; i++) {
        const w = below[i] - below[i + 1];
        if (w > 1e-4) out.push([I['pan' + k + '_' + i], w * wk]);
      }
    }
    return out;
  }
  const fJupe = (ang, y) => { const g = ouvertureJupe(y); return clamp((ang - g) / (TAU - 2 * g), 0, 1); };

  function construireManteau(bd, THREE, I, W, Q) {
    const torsoWeights = Q.torsoWeights;
    const R = rng(977);
    // cuir noir-brun : nuances, usure éclaircie, éraflures, cendre et poussière en bas, brûlures, sang séché
    const manteauCol = (P, ang, edge) => {
      const y = P[1];
      let c = mixc(PAL.manteau, PAL.manteauSombre, fbm(P[0] * 9, P[1] * 9, P[2] * 9, 301) * 0.55);
      c = mixc(c, PAL.manteauClair, smooth(0.6, 0.85, fbm(P[0] * 22, P[1] * 22, P[2] * 22, 303)) * 0.35);
      c = mixc(c, PAL.manteauClair, (edge || 0) * 0.5);
      const raye = 1 - smooth(0.0, 0.025, Math.abs(vnoise(P[0] * 45, P[1] * 12, P[2] * 45, 305) - 0.5));
      c = mixc(c, PAL.manteauClair, raye * 0.45 * smooth(0.55, 0.75, fbm(P[0] * 14, P[1] * 14, P[2] * 14, 307)));
      c = mixc(c, PAL.cendre, smooth(0.62, 0.22, y) * (0.16 + 0.3 * fbm(P[0] * 12, y * 12, P[2] * 12, 309)));
      const br = fbm(P[0] * 8 + 3, P[1] * 8, P[2] * 8, 311);
      c = mixc(c, mixc(PAL.brule, hexc(0x4a2412), smooth(0.79, 0.7, br) * 0.6), smooth(0.68, 0.74, br) * 0.85);
      c = mixc(c, PAL.sangSec, smooth(0.72, 0.84, fbm(P[0] * 20 + 5, P[1] * 20, P[2] * 20, 313)) * 0.6);
      return mulc(c, 0.94 + 0.08 * vnoise(P[0] * 300, P[1] * 300, P[2] * 300, 315));
    };
    const ferCol = (P) => mixc(PAL.fer, PAL.rouille, 0.25 + 0.5 * fbm(P[0] * 250, P[1] * 250, P[2] * 250, 317));

    // ---------------------------------------------------------------- buste du manteau (fermé)
    const plisBuste = (P, s, ang, r, radial) => {
      const y = MANTEAU_Y0 + s, a = wrapPi(ang);
      let d = ripple(s, ang, 0.075, 0.04, 0.028, 0.004, 0, 3.5) + ripple(s, ang, 0.03, 0.025, 0.02, 0.003, 0, 3.5);   // fronces sous la ceinture
      d += diagFold(s, a, 0.32, Math.PI / 2, 2.5, 0.05, 0.004, 0.07, 0.45) + diagFold(s, a, 0.32, -Math.PI / 2, -2.5, 0.05, 0.004, 0.07, 0.45);
      d += 0.0035 * Math.sin(ang * 5 + 1.3) * gauss(a, Math.PI, 0.6) * gauss(y, 1.16, 0.08);           // pli du dos
      d += seamAt(ang, Math.PI / 2 + 0.12, 0.0016) + seamAt(ang, -Math.PI / 2 - 0.12, 0.0016) + seamAt(ang, Math.PI, 0.0014);
      d += seamAt(ang, 0.55, 0.0011) + seamAt(ang, -0.55, 0.0011);                                       // découpes du devant
      d += 0.0012 * gauss(Math.abs(a), ouvertureBuste(y) + 0.025, 0.02);                                // bords repliés
      return radialD(radial, d);
    };
    bd.loft('manteau', {
      a: [0, MANTEAU_Y0, 0], b: [0, 1.50, 0], seg: 46, step: 0.023, s0: 0.01, gap: ouvertureBuste,
      rings: MANTEAU_RINGS, displace: plisBuste, rimGap: 0.006, rim0: 0.004,
      weights: (s, ang, P) => torsoWeights(P[1], P[0]),
      color: (P, s, ang) => manteauCol(P, ang, gauss(Math.abs(wrapPi(ang)), ouvertureBuste(P[1]) + 0.02, 0.03) + gauss(P[1], 1.43, 0.02) * 0.3)
    });
    // attaches de cuir (pattes cousues sur le pan droit) et crochets de fer pris dans des anneaux du pan gauche
    for (const y of [1.075, 1.155, 1.235, 1.315, 1.392]) {
      const pts = [];
      for (let k = 0; k <= 5; k++) pts.push(surfPoint(MANTEAU_RINGS, MANTEAU_Y0, y + 0.002 * Math.sin(k), lerp(-0.25, 0.13, k / 5), 0.0042));
      bd.ribbon('cuir', pts, (t) => lerp(0.024, 0.018, t), 0.003, (P) => vnorm([P[0], 0, P[2] + 0.02]), (P) => torsoWeights(P[1], P[0]),
        (P, t) => mixc(mixc(mulc(PAL.cuir, 0.8), PAL.cuir, fbm(P[0] * 60, P[1] * 60, P[2] * 60, 319)), PAL.cuirClair, gauss(t, 1, 0.12) * 0.35));
      const ac = 0.19, c = surfPoint(MANTEAU_RINGS, MANTEAU_Y0, y, ac, 0.0075), n = vnorm([Math.sin(ac), 0, Math.cos(ac)]), tg = [n[2], 0, -n[0]];
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(tg[0], tg[1], tg[2]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2])).setPosition(c[0], c[1], c[2]);
      const anneau = new THREE.TorusGeometry(0.0062, 0.0015, bd.n(4, 3), bd.n(8, 6));
      bd.rigid('metal', anneau, M, (P) => torsoWeights(P[1], P[0]), ferCol);
      // crochet : tige et bec recourbé qui passe dans l'anneau
      bd.rigid('metal', new THREE.BoxGeometry(0.014, 0.0032, 0.0032), new THREE.Matrix4().makeTranslation(-0.009, 0, 0.001).premultiply(M), (P) => torsoWeights(P[1], P[0]), ferCol);
      bd.rigid('metal', new THREE.BoxGeometry(0.0032, 0.008, 0.0032), new THREE.Matrix4().makeTranslation(-0.0005, -0.003, 0.0035).premultiply(M), (P) => torsoWeights(P[1], P[0]), ferCol);
    }

    // ---------------------------------------------------------------- col montant (sans revers)
    bd.loft('manteau', {
      a: [0, 1.445, -0.03], b: [0, 1.62, -0.03], seg: 32, step: 0.02, gap: 0.17, rim1: 0.006, rimGap: 0.005,
      rings: [{ s: 0.0, w: 0.098, dF: 0.09, dB: 0.096, n: 2.2 }, { s: 0.04, w: 0.085, dF: 0.079, dB: 0.087, n: 2.2 },
        { s: 0.09, w: 0.083, dF: 0.077, dB: 0.086, n: 2.2 }, { s: 0.145, w: 0.088, dF: 0.082, dB: 0.091, n: 2.2 }],
      s1: 0.145,
      hem1: (ang) => 0.052 * Math.pow(Math.max(0, Math.cos(ang)), 3) + 0.004 * vnoise(ang * 12, 1, 1, 321), hemDepth1: 0.06,
      displace: (P, s, ang, r, radial) => radialD(radial, 0.0018 * Math.sin(ang * 5 + 0.5) * smooth(0.05, 0.14, s) + seamAt(ang, Math.PI, 0.001)),
      weights: (s, ang, P) => { const t = smooth(1.46, 1.56, P[1]); return [[I.chest, 0.55 * (1 - t) + 0.25 * t], [I.neck, 0.45 * (1 - t) + 0.75 * t]]; },
      color: (P, s, ang) => mixc(manteauCol(P, ang, gauss(s, 0.145, 0.01) * 0.6), PAL.manteauSombre, 0.12)
    });
    // broche occulte au col (création) : plaque ovale de fer, trois griffes d'os qui tiennent une gemme rouge,
    // anneau pendant
    {
      const c = [0, 1.461, 0.0745], nrm = vnorm([0, 0.36, 0.93]);
      const X = [1, 0, 0], Y = vnorm(vcross(nrm, X)), Z = nrm;
      const B0 = new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2])).setPosition(c[0], c[1], c[2]);
      const wB = (P) => torsoWeights(P[1], P[0]);
      const pl = new THREE.SphereGeometry(1, bd.n(10, 7), bd.n(5, 4)); pl.scale(0.018, 0.023, 0.0042);
      bd.rigid('metal', pl, B0, wB, ferCol);
      const rim = new THREE.TorusGeometry(0.0195, 0.0021, bd.n(4, 3), bd.n(12, 8)); rim.scale(1, 1.22, 1);
      bd.rigid('metal', rim, B0, wB, (P) => mulc(ferCol(P), 0.8));
      const osC = (P) => mixc(PAL.osClair, PAL.os, fbm(P[0] * 300, P[1] * 300, P[2] * 300, 323) * 0.6);
      for (const a of [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + 2 * TAU / 3]) {
        const g = new THREE.ConeGeometry(0.0021, 0.013, 5, 2);
        g.translate(0, 0.0065, 0);
        const gp = g.attributes.position;
        for (let v = 0; v < gp.count; v++) { const yy = gp.getY(v) / 0.013; gp.setZ(v, gp.getZ(v) + 0.006 * yy * yy); }
        g.computeVertexNormals();
        const M = new THREE.Matrix4().makeRotationZ(a - Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.0135, Math.sin(a) * 0.0165, 0.002));
        bd.rigid('metal', g, M.premultiply(B0), wB, osC);
      }
      bd.cur = [0, 0, 0.6];
      const gem = new THREE.SphereGeometry(1, bd.n(10, 7), bd.n(7, 5)); gem.scale(0.0092, 0.0122, 0.0072);
      bd.rigid('yeux', gem, new THREE.Matrix4().makeTranslation(0, 0, 0.004).premultiply(B0), wB, (P, N) => mixc(hexc(0x5a0608), hexc(0xb01410), smooth(0.2, 0.9, vdot(N, nrm))));
      bd.cur = [0, 0, 0];
      const ann = new THREE.TorusGeometry(0.0052, 0.0012, bd.n(4, 3), bd.n(8, 6));
      bd.rigid('metal', ann, new THREE.Matrix4().makeTranslation(0, -0.031, 0.001).premultiply(B0), wB, ferCol);
    }

    // ---------------------------------------------------------------- manches de cuir, sangle de poignet ; remontent (morphose)
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const sh = [0.185, 1.418, -0.035];
      const armEnd = vadd(sh, vscale(ARM_DIR, 0.62));
      const elbowS = L_UPPER, wristS = L_UPPER + L_FORE;
      const armW = (s) => {
        const t0 = smooth(-0.04, 0.08, s), t1 = smooth(elbowS - 0.05, elbowS + 0.05, s), t2 = smooth(elbowS + 0.06, wristS, s) * 0.55;
        return [[I['clav' + S], 1 - t0], [I['arm' + S], t0 * (1 - t1)], [I['fore' + S], t1 * (1 - t2)], [I['tors' + S], t1 * t2]];
      };
      const g = bd.g('manteau'), v0 = g.p.length / 3;
      bd.loft('manteau', {
        a: sh, b: armEnd, mirror: sx < 0, seg: 22, step: 0.022, s0: -0.035, s1: wristS + 0.005, rim1: 0.005,
        rings: [
          { s: -0.035, wL: 0.074, wR: 0.046, d: 0.072 }, { s: 0.02, wL: 0.075, wR: 0.062, d: 0.073 }, { s: 0.08, wL: 0.071, wR: 0.068, d: 0.07 },
          { s: 0.16, w: 0.068, dF: 0.068, dB: 0.065 }, { s: elbowS, w: 0.065, d: 0.063 }, { s: 0.4, w: 0.062, d: 0.059 },
          { s: 0.48, w: 0.06, d: 0.057 }, { s: wristS - 0.03, w: 0.059, d: 0.056 }, { s: wristS + 0.005, w: 0.062, d: 0.059 }
        ],
        displace: (P, s, ang, r, radial) => radialD(radial,
          ripple(s, ang, elbowS - 0.01, 0.035, 0.022, 0.0055, 0.0, 1.1) + ripple(s, ang, elbowS + 0.015, 0.03, 0.026, 0.003, Math.PI, 0.9, 1.2) +
          ripple(s, ang, 0.05, 0.035, 0.026, 0.003, Math.PI / 2, 0.8) + 0.002 * Math.sin(ang * 3 + s * 21) * gauss(s, 0.18, 0.06) +
          ripple(s, ang, 0.44, 0.03, 0.024, 0.0028, 0, 3.5) + seamAt(ang, Math.PI - 0.3, 0.0013)),
        weights: (s) => armW(s),
        color: (P, s, ang) => manteauCol(P, ang, gauss(s, elbowS, 0.03) * Math.max(0, -Math.cos(ang)) * 0.8 + gauss(s, wristS + 0.005, 0.008) * 0.6)
      });
      // sangle de poignet et sa petite boucle (même maillage que la manche : elles remontent avec elle)
      const ad = sx > 0 ? ARM_DIR : miroir(ARM_DIR), shS = sx > 0 ? sh : miroir(sh);
      const sS = wristS - 0.035, cS = vadd(shS, vscale(ad, sS));
      const e1 = vnorm(vcross(ad, [0, 0, 1])), e2 = vnorm(vcross(e1, ad));
      const pts = [];
      for (let k = 0; k <= 14; k++) { const a = k / 14 * TAU; pts.push(vadd(cS, vadd(vscale(e1, Math.cos(a) * 0.0615), vscale(e2, Math.sin(a) * 0.0585)))); }
      bd.ribbon('manteau', pts, 0.016, 0.0028, (P) => vnorm(vsub(vsub(P, cS), vscale(ad, vdot(vsub(P, cS), ad)))), () => armW(sS), (P) => mixc(PAL.cuir, PAL.cuirClair, 0.3 * fbm(P[0] * 80, P[1] * 80, P[2] * 80, 325)));
      {
        const bc = vadd(cS, vscale(e2, -0.062)), M = new THREE.Matrix4().makeBasis(new THREE.Vector3(ad[0], ad[1], ad[2]), new THREE.Vector3(e1[0], e1[1], e1[2]), new THREE.Vector3(-e2[0], -e2[1], -e2[2])).setPosition(bc[0], bc[1], bc[2]);
        for (const [w, h, x, y] of [[0.019, 0.003, 0, 0.009], [0.019, 0.003, 0, -0.009], [0.003, 0.02, 0.008, 0], [0.003, 0.02, -0.008, 0]]) {
          bd.rigid('manteau', new THREE.BoxGeometry(w, h, 0.0035), new THREE.Matrix4().makeTranslation(x, y, 0.002).premultiply(M), () => armW(sS), PAL.fer);
        }
      }
      // cible de morphose : la manche remonte vers le coude (compression et bourrelets près du poignet)
      const v1 = g.p.length / 3;
      bd.morph('manteau', S, v0, v1, (P) => {
        const rel = vsub(P, shS), s = vdot(rel, ad);
        const k = MANCHE_RETRAIT * smooth(wristS - 0.21, wristS, s);
        const radial = vnorm(vsub(rel, vscale(ad, s)));
        const bour = 0.006 * gauss(s, wristS - 0.11, 0.045) * (0.7 + 0.3 * Math.sin(s * 160 + Math.atan2(radial[1], radial[0]) * 3));
        return vadd(vscale(ad, -k), vscale(radial, bour));
      });
    }

    // ---------------------------------------------------------------- jupe du manteau : plis, fente, lambeaux
    const crans = [];   // découpe du bas : entailles irrégulières entre des bandes de tissu
    {
      let a = ouvertureJupe(0.3) + 0.08;
      while (a < TAU - ouvertureJupe(0.3) - 0.08) {
        crans.push([a, 0.07 + 0.16 * R(), 0.03 + 0.03 * R()]);
        a += 0.16 + 0.2 * R();
      }
    }
    const bandes = [];
    for (let i = 0; i < 24; i++) bandes.push(0.05 * R());
    const hemJupe = (ang) => {
      let d = 0.012 * vnoise(ang * 14, 2, 3, 317) + 0.01 * vnoise(ang * 40, 5, 1, 319);
      for (const [c, dep, w] of crans) { const x = Math.abs(ang - c) / w; if (x < 1) d = Math.max(d, dep * Math.pow(1 - x, 0.8)); }
      d += bandes[Math.floor(clamp((ang - 0.8) / 0.2, 0, 23))];
      const xv = Math.abs(wrapPi(ang - Math.PI)) / 0.045;                       // fente du dos
      if (xv < 1) d = Math.max(d, 0.40 * Math.pow(1 - xv, 0.6));
      for (const ac of [Math.PI / 2 + 0.16, 1.5 * Math.PI - 0.16]) {               // fentes des côtés
        const xc = Math.abs(wrapPi(ang - ac)) / 0.038;
        if (xc < 1) d = Math.max(d, 0.31 * Math.pow(1 - xc, 0.6));
      }
      return d;
    };
    const plisJupe = (P, s, ang, r, radial) => {
      const y = P[1], a = wrapPi(ang);
      const k = smooth(0.98, 0.35, y);
      let d = 0.012 * k * (0.65 * Math.sin(ang * 7 + 2 * Math.sin(ang * 2.3)) + 0.35 * Math.sin(ang * 13 + 1.7));
      d += 0.0045 * Math.sin(ang * 21) * smooth(0.86, 0.97, y) * smooth(1.03, 0.97, y);                         // fronces sous la ceinture
      d += seamAt(ang, Math.PI / 2 + 0.15, 0.0015) + seamAt(ang, -Math.PI / 2 - 0.15, 0.0015);
      return radialD(radial, d);
    };
    bd.loft('manteau', {
      a: [0, JUPE_Y0, 0], b: [0, JUPE_Y0 + 0.89, 0], gap: (s) => ouvertureJupe(JUPE_Y0 + s), seg: 68, step: 0.029,
      rings: JUPE_RINGS, hem0: hemJupe, hemDepth0: 0.42, rim0: 0.004, rimGap: 0.006, displace: plisJupe,
      weights: (s, ang, P) => poidsJupe(I, fJupe(ang, P[1]), P[1]),
      color: (P, s, ang) => {
        const g = ouvertureJupe(P[1]);
        let c = manteauCol(P, ang, gauss(ang, g, 0.03) + gauss(TAU - ang, g, 0.03));
        return mixc(c, PAL.cendre, smooth(0.36, 0.16, P[1]) * 0.25);
      },
      extra: (P) => [smooth(0.62, 0.2, P[1]), 0, 0]
    });
    // lambeaux libres sous l'ourlet (bandes effilochées)
    {
      const n = Math.max(6, Math.round(14 * bd.q));
      for (let i = 0; i < n; i++) {
        const f = 0.04 + 0.92 * (i + 0.5 * R()) / n;
        const yTop = 0.40 + 0.06 * R(), yBot = 0.10 + 0.12 * R();
        const w0 = 0.035 + 0.035 * R(), twist = (R() - 0.5) * 0.8;
        const pts = [];
        const nseg = 7;
        for (let k = 0; k <= nseg; k++) {
          const t = k / nseg, y = lerp(yTop, yBot, t);
          const p = pointJupe(f + 0.01 * Math.sin(t * 3 + i), y, 0.004 + 0.006 * t);
          pts.push(p);
        }
        bd.ribbon('lambeaux', pts, (t) => w0 * (1 - 0.75 * t) * (0.8 + 0.4 * vnoise(t * 9, i, 1, 321)), 0.003,
          (P, k) => { const a = angPan(f, P[1]); return [Math.sin(a + twist * k / nseg), 0, Math.cos(a + twist * k / nseg)]; },
          (P) => poidsJupe(I, f, P[1]),
          (P, t) => mixc(manteauCol(P, 0, 0.1 * t), PAL.cendre, t * 0.3));
      }
      // les lambeaux flottent davantage
      const g = bd.g('lambeaux');
      for (let v = 0; v < g.x.length / 3; v++) g.x[v * 3] = clamp(smooth(0.45, 0.1, g.p[v * 3 + 1]) * 1.6, 0, 1.6);
    }
  }

  // ============================================================================================
  // Étole rituelle rouge sombre du Septième : une bande de drap épais qui fait le tour de la base du col
  // (posée sur les épaules et la nuque) et dont les deux pans pendent sur le devant du manteau jusqu'aux
  // genoux. Glyphes brodés inventés et liserés (shader, drapeau ETOLE : aBoss = [travers 0..1, longueur
  // depuis le bout gauche (m), distance au bout le plus proche (m)]), frange aux deux bouts.
  // Chaque pan est porté par une chaîne de 6 os simulée (ressorts, collisions avec le torse et les jambes).
  // ============================================================================================
  function poidsEtole(I, G, y) {
    const n = ETO_Y.length;
    const below = [];
    for (let j = 0; j < n - 1; j++) below.push(smooth(ETO_Y[j] + 0.03, ETO_Y[j] - 0.03, y));
    below.push(0);
    const out = [[I.chest, 1 - below[0]]];
    for (let j = 0; j < n - 1; j++) { const w = below[j] - below[j + 1]; if (w > 1e-4) out.push([I['eto' + G + '_' + j], w]); }
    return out;
  }

  function construireEtole(bd, THREE, I, W, Q) {
    const torsoWeights = Q.torsoWeights;
    // tour du col (côté gauche, de la racine du pan vers la nuque) ; le côté droit par symétrie
    const COL = [[0.074, 1.392, 0.136], [0.082, 1.424, 0.116], [0.094, 1.452, 0.084], [0.107, 1.475, 0.04], [0.114, 1.487, -0.008],
      [0.108, 1.491, -0.058], [0.085, 1.492, -0.098], [0.045, 1.4925, -0.121]];
    const pan = (sx) => {
      const out = [];
      for (let y = ETO_Y[ETO_Y.length - 1]; y < ETO_Y[0] - 1e-6; y += 0.05) out.push(pointEtole(sx, y));
      out.push(pointEtole(sx, ETO_Y[0]));
      return out;   // du bas vers la racine
    };
    // chemin complet : bout du pan gauche → racine → tour du col → nuque → côté droit → bout du pan droit
    const pts = [], tags = [];
    for (const p of pan(1)) { pts.push(p); tags.push('G'); }
    for (const p of COL) { pts.push(p); tags.push('C'); }
    pts.push([0, 1.4925, -0.128]); tags.push('C');
    for (let k = COL.length - 1; k >= 0; k--) { pts.push(miroir(COL[k])); tags.push('C'); }
    const panD = pan(-1).reverse();
    for (const p of panD) { pts.push(p); tags.push('D'); }
    // longueurs cumulées (même calcul que le ruban) : glyphes et frange
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + vlen(vsub(pts[i], pts[i - 1])));
    const total = cum[cum.length - 1];
    // normale extérieure : vers l'avant sur la poitrine, vers le haut et le dehors sur les épaules
    const dehors = (P) => {
      const k = smooth(1.39, 1.47, P[1]);
      return vnorm(vlerp([P[0] * 0.15, 0.12, 1], [P[0] * 1.1, 0.95, (P[2] + 0.03) * 1.1], k));
    };
    const coulEtole = (P) => {
      let c = mixc(PAL.etole, PAL.etoleSombre, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 341) * 0.6);
      c = mixc(c, PAL.sangSec, smooth(0.66, 0.8, fbm(P[0] * 18 + 2, P[1] * 18, P[2] * 18, 343)) * 0.5);
      return mixc(c, PAL.cendre, smooth(0.62, 0.48, P[1]) * 0.18 * fbm(P[0] * 40, P[1] * 40, P[2] * 40, 345));
    };
    bd.cur = (P, t, a, b, i) => [(a + 1) / 2, cum[i], Math.min(cum[i], total - cum[i])];
    bd.ribbon('etole', pts, ETO_L, 0.0042, (P) => dehors(P),
      (P) => {
        // poids : chaîne de chaque pan, tronc pour le tour du col (raccord progressif sous la racine)
        if (P[1] > ETO_Y[0] + 0.03 || Math.abs(P[0]) > ETO_X + ETO_L) return torsoWeights(P[1], P[0]);
        return poidsEtole(I, P[0] >= 0 ? 'G' : 'D', P[1]);
      },
      (P) => coulEtole(P));
    bd.cur = [0, 0, 0];
    void tags;
  }

  // ============================================================================================
  // Mains gantées de cuir noir, longues et osseuses : cuir tendu sur les jointures, plis de flexion, coutures
  // sur les côtés des doigts, usure plus claire aux arêtes. Le bout de l'index et du majeur est déchiré :
  // la peau grise et un ongle noir en griffe dépassent. Cinq doigts à trois phalanges (griffes, désignation).
  // Main gauche construite, droite en miroir. Structure des doigts reprise de ../survivant/src/arms.js.
  // ============================================================================================
  function construireMains(bd, THREE, I, W) {
    const ad = ARM_DIR;
    const peauMain = (P, k) => {
      let c = mixc(PAL.peau, PAL.peauOmbre, 0.12 + fbm(P[0] * 70, P[1] * 70, P[2] * 70, 401) * 0.45);
      c = mixc(c, PAL.peauFroide, fbm(P[0] * 20, P[1] * 20, P[2] * 20, 403) * 0.35);
      return mixc(c, PAL.cendre, (k || 0) + smooth(0.62, 0.85, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 405)) * 0.25);
    };
    // cuir noir : légères variations, usure plus claire (k), sillons plus sombres (creux)
    const cuirGant = (P, k, creux) => {
      let c = mixc(PAL.gant, PAL.gantSombre, 0.25 + fbm(P[0] * 90, P[1] * 90, P[2] * 90, 421) * 0.5);
      c = mixc(c, PAL.gantUse, clamp((k || 0) + smooth(0.68, 0.9, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 423)) * 0.3, 0, 1));
      return mixc(c, mulc(PAL.gantSombre, 0.55), clamp(creux || 0, 0, 1));
    };
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const mir = sx < 0;
      const wr = W.handL;                          // côté gauche ; la droite par miroir
      const handW = (s) => { const t = smooth(-0.022, 0.012, s); return [[I['tors' + S], (1 - t) * 0.5], [I['fore' + S], (1 - t) * 0.5], [I['hand' + S], t]]; };
      const veineDos = (P, s, ang) => {
        const dorsal = smooth(-0.15, -0.55, Math.sin(ang));
        const v = 1 - smooth(0.0, 0.06, Math.abs(vnoise(s * 28, P[2] * 60, 7 + sx, 407) - 0.5));
        const v2 = 1 - smooth(0.0, 0.05, Math.abs(vnoise(s * 45 + 3, P[2] * 90, 9 + sx, 409) - 0.5));
        return Math.max(v, v2 * 0.7) * dorsal;
      };
      // paume et dos de la main (gant)
      bd.loft('gant', {
        a: wr, b: vadd(wr, vscale(ad, 0.2)), mirror: mir, seg: 14, step: 0.011, s0: -0.03, s1: L_PALM + 0.006,
        rings: [
          { s: -0.03, w: 0.0215, d: 0.029, n: 2.2 }, { s: 0.0, w: 0.019, d: 0.0305, n: 2.3 },
          { s: 0.022, wL: 0.0178, wR: 0.0158, d: 0.0365, n: 2.6 }, { s: 0.05, wL: 0.0171, wR: 0.0139, d: 0.0398, n: 3.0 },
          { s: 0.078, wL: 0.015, wR: 0.0122, d: 0.041, n: 3.0 }, { s: L_PALM + 0.006, w: 0.0112, d: 0.039, n: 2.8 }
        ],
        cap1: true,
        displace: (P, s, ang, r, radial) => {
          const dorsal = smooth(-0.2, -0.6, Math.sin(ang));
          let d = 0;
          for (const [f, dz, back] of DOIGTS) {
            d += 0.0011 * gauss(P[2] - dz, 0, 0.0032) * smooth(0.012, 0.03, s) * smooth(L_PALM + back, L_PALM + back - 0.02, s) * dorsal;   // tendons
            d += 0.0026 * gauss(P[2] - dz, 0, 0.0055) * gauss(s, L_PALM + back - 0.004, 0.0055) * dorsal;                                     // jointures
          }
          d += 0.0005 * gauss(s, -0.012, 0.004);                                                                                               // bord du revers du gant
          return radialD(radial, d);
        },
        weights: (s) => handW(s),
        color: (P, s, ang) => {
          let kn = 0;
          for (const [f, dz, back] of DOIGTS) kn += gauss(P[2] - dz, 0, 0.006) * gauss(s, L_PALM + back - 0.004, 0.006);
          const dorsal = smooth(-0.2, -0.6, Math.sin(ang));
          const couture = Math.max(0, seamAt(ang, 0.05, 1)) * smooth(-0.01, 0.01, s);                    // couture du dos
          const revers = gauss(s, -0.018, 0.003);                                                          // bord roulé du revers
          let c = cuirGant(P, kn * 0.7 * dorsal + revers * 0.5, smooth(0.25, 0.75, Math.sin(ang)) * 0.15);
          return mixc(c, PAL.gantUse, couture * 0.35);
        },
        extra: () => [0, 0, 0]
      });
      // éminence thénar (gras du pouce)
      {
        const pl = PAUME_L, td = POUCE_DIR_L;
        let c = vadd(vadd(vadd(wr, vscale(ad, 0.03)), [0, 0, 0.016]), vscale(pl, 0.0085));
        const g = new THREE.SphereGeometry(1, bd.n(12, 6), bd.n(8, 4));
        const X = vnorm(td), Y = vnorm(vcross(pl, X)), Z = vcross(X, Y);
        const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2]))
          .multiply(new THREE.Matrix4().makeScale(0.032, 0.0185, 0.0145));
        if (mir) { c = miroir(c); M.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1)); }
        M.setPosition(c[0], c[1], c[2]);
        if (mir) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } }
        bd.rigid('gant', g, M, [[I['hand' + S], 0.65], [I['pouce1' + S], 0.35]], (P) => cuirGant(P, 0.05, 0.1));
      }
      // doigts : trois phalanges, jointures osseuses, ongle sombre effilé en griffe
      const doigt = (K, dir, front, L, r0, bones, isThumb, dechire) => {
        const L1 = L[0], L2 = L[1], L3 = L[2], Lt = L1 + L2 + L3;
        r0 *= 1.12;                                           // épaisseur du cuir
        const nail = (s, ang) => smooth(Lt - 0.0165, Lt - 0.0135, s) * smooth(-0.35, -0.7, Math.sin(ang)) + smooth(Lt - 0.001, Lt + 0.001, s);
        // bord déchiré du gant (doigts « dechire ») : au-delà, peau grise et ongle noir pointu
        const bordDechire = (s, ang) => Lt - 0.0185 + 0.0035 * Math.sin(ang * 3 + 1.3) + 0.0025 * Math.sin(ang * 7 + 0.4);
        // bout : griffe (peau et ongle) qui perce le cuir sur les doigts déchirés, bout de gant arrondi sinon
        const bout = dechire
          ? [{ s: Lt - 0.002, wL: r0 * 0.6, wR: r0 * 0.66, d: r0 * 0.64 }, { s: Lt + 0.003, wL: r0 * 0.16, wR: r0 * 0.36, d: r0 * 0.36, ox: r0 * 0.2 }, { s: Lt + 0.0075, w: r0 * 0.05, d: r0 * 0.06, ox: r0 * 0.34 }]
          : [{ s: Lt - 0.003, wL: r0 * 0.8, wR: r0 * 0.8, d: r0 * 0.78 }, { s: Lt + 0.0012, wL: r0 * 0.64, wR: r0 * 0.66, d: r0 * 0.6 }, { s: Lt + 0.0042, wL: r0 * 0.26, wR: r0 * 0.28, d: r0 * 0.24 }];
        bd.loft('gant', {
          a: K, b: vadd(K, vscale(dir, Lt)), front: front, mirror: mir, seg: 8, step: 0.0072, s0: isThumb ? -0.016 : -0.012, s1: bout[bout.length - 1].s,
          rings: [
            { s: isThumb ? -0.016 : -0.012, w: r0 * 1.3, d: r0 * 1.25 }, { s: 0.0, wL: r0 * 1.12, wR: r0 * 1.2, d: r0 * 1.16 },
            { s: L1 * 0.5, wL: r0 * 0.95, wR: r0 * 0.86, d: r0 * 0.92 }, { s: L1, wL: r0 * 0.98, wR: r0 * 1.04, d: r0 * 1.04 },
            { s: L1 + L2 * 0.5, wL: r0 * 0.88, wR: r0 * 0.8, d: r0 * 0.86 }, { s: L1 + L2, wL: r0 * 0.9, wR: r0 * 0.94, d: r0 * 0.92 },
            { s: Lt - 0.009, wL: r0 * 0.84, wR: r0 * 0.78, d: r0 * 0.8 }
          ].concat(bout),
          cap0: true, cap1: true,
          displace: (P, s, ang, r, radial) => {
            const dorsal = smooth(-0.2, -0.7, Math.sin(ang));
            let d = 0.0012 * (gauss(s, L1, 0.0032) + gauss(s, L1 + L2, 0.0028)) * dorsal;
            d -= 0.0004 * (gauss(s, L1 - 0.003, 0.001) + gauss(s, L1 + 0.003, 0.001) + gauss(s, L1 + L2 + 0.002, 0.001)) * dorsal;
            if (dechire) d += 0.0005 * nail(s, ang) * (s < Lt ? 1 : 0);
            return radialD(radial, d);
          },
          weights: (s) => {
            const a = smooth(-0.006, 0.004, s), b = smooth(L1 - 0.005, L1 + 0.005, s), c = smooth(L1 + L2 - 0.0045, L1 + L2 + 0.0045, s);
            return [[bones[0], 1 - a], [bones[1], a * (1 - b)], [bones[2], b * (1 - c)], [bones[3], c]];
          },
          color: (P, s, ang) => {
            const dorsal = smooth(-0.2, -0.7, Math.sin(ang));
            const jointures = (gauss(s, L1, 0.003) + gauss(s, L1 + L2, 0.0026)) * dorsal;
            const plis = (gauss(s, L1, 0.0012) + gauss(s, L1 + L2, 0.001)) * (1 - dorsal);
            const couture = Math.max(0, seamAt(ang, Math.PI * 0.5, 1)) + Math.max(0, seamAt(ang, -Math.PI * 0.5, 1));
            let c = cuirGant(P, jointures * 0.55 + smooth(Lt - 0.012, Lt, s) * 0.25, plis * 0.7);
            c = mixc(c, PAL.gantUse, clamp(couture, 0, 1) * 0.3 * smooth(0.002, 0.01, s) * smooth(Lt - 0.004, Lt - 0.012, s));
            if (dechire) {
              const bd0 = bordDechire(s, ang);
              if (s > bd0) {
                c = peauMain(P, 0.1);
                const nl = nail(s, ang);
                c = mixc(c, mixc(PAL.ongle, PAL.sangSec, 0.25 * vnoise(s * 400, ang, 1, 413)), clamp(nl, 0, 1) * 0.97);
              } else c = mixc(c, mulc(PAL.gantSombre, 0.5), smooth(bd0 - 0.002, bd0, s) * 0.8);   // bord effiloché
            }
            return c;
          },
          extra: () => [0, 0, 0]
        });
      };
      for (const [f, dz, back, len, r0] of DOIGTS) {
        const K = W[f + '1L'];
        doigt(K, ad, [0, 0, 1], len, r0, [I['hand' + S], I[f + '1' + S], I[f + '2' + S], I[f + '3' + S]], false, f === 'index' || f === 'majeur');
      }
      doigt(W.pouce1L, POUCE_DIR_L, vcross(PAUME_L, POUCE_DIR_L), POUCE_L, 0.0102, [I['hand' + S], I['pouce1' + S], I['pouce2' + S], I['pouce3' + S]], true, false);
    }
  }

  // ============================================================================================
  // Tête de remplacement du Septième (utilisée seulement si aucune donnée BOSS_B7_TETE n'est fournie) :
  // homme d'environ 55 ans, émacié, crâne entièrement rasé et un peu allongé ; sur le crâne et le haut du
  // front, le sceau à sept branches de Bunker 7 gravé en cicatrices qui luisent rouge-orangé (shader,
  // drapeau TETE7) ; longue cicatrice chirurgicale agrafée de la tempe droite à la mâchoire ; orbites
  // profondes, pommettes saillantes, joues creuses, nez long et mince un peu busqué, lèvres minces et
  // sombres, menton anguleux, chaume gris très court sur la mâchoire ; ni cheveux, ni moustache, ni barbe ;
  // oreilles normales ; peau très pâle gris-bleuté, veines sombres autour des yeux et aux tempes ; iris
  // incandescent rouge, sclère sombre. Ne ressemble à aucune personne réelle.
  // Mâchoire articulée (os « machoire ») : la bouche s'ouvre vraiment (couture découpée dans le shader,
  // cavité, dents). Méthode reprise de ../survivant/src/head.js (loft du crâne + relief).
  // ============================================================================================
  const TETE_RINGS = [
    [1.556, 0.024, 0.083, 0.046, 2.3],
    [1.565, 0.043, 0.090, 0.014, 2.5],
    [1.578, 0.053, 0.093, -0.018, 2.9],
    [1.595, 0.0575, 0.095, -0.049, 3.1],
    [1.615, 0.062, 0.096, -0.084, 2.9],
    [1.640, 0.0665, 0.095, -0.104, 2.7],
    [1.665, 0.0700, 0.093, -0.113, 2.5],
    [1.690, 0.0722, 0.0945, -0.119, 2.35],
    [1.715, 0.0726, 0.089, -0.124, 2.25],
    [1.740, 0.0705, 0.080, -0.126, 2.2],
    [1.765, 0.0640, 0.064, -0.119, 2.1],
    [1.785, 0.0520, 0.044, -0.100, 2.0],
    [1.800, 0.0320, 0.021, -0.066, 2.0],
    [1.808, 0.012, 0.004, -0.028, 2.0]
  ];
  const TETE_Y0 = 1.556;
  const teteRings = (grow) => TETE_RINGS.map(([y, w, f, b, n]) => ({ s: y - TETE_Y0, w: w + grow, dF: (f - b) / 2 + grow, dB: (f - b) / 2 + grow, n: n, oz: (f + b) / 2 }));
  const TETE_R = prepRings(teteRings(0));
  const OEIL_C = [0.0316, 1.6668], OEIL_R = 0.0118, OEIL_W = 0.0136, OEIL_UP = 0.0052, OEIL_LO = 0.0046;
  const BOUCHE_Y = 1.6005, BOUCHE_W = 0.0225;
  const segDist = (x, y, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, t = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
  };
  // fissures de braise (aucune sur ce visage : le sceau gravé et la cicatrice sont dessinés par le shader)
  const FISSURES = [];
  const fissure = (x, y) => { let m = 0; for (const s of FISSURES) m = Math.max(m, 1 - smooth(0.0004, 0.0016, segDist(x, y, s[0], s[1], s[2], s[3]))); return m; };

  // relief du visage (m, le long de la normale radiale)
  function reliefVisage(x, y, ang, avecYeux) {
    const front = smooth(0.05, 0.55, Math.cos(ang));
    if (front <= 0) return 0;
    const ax = Math.abs(x), aa = Math.abs(wrapPi(ang));
    const asym = x > 0 ? 1.12 : 0.92;                      // déformation asymétrique (joue gauche plus creuse)
    let d = 0;
    // nez long et mince, légèrement busqué : arête étroite, bosse au tiers supérieur, pointe un peu tombante
    const tN = clamp((1.690 - y) / (1.690 - 1.627), 0, 1);
    const top = lerp(0.0030, 0.0042, tN), base = lerp(0.0068, 0.0094, tN);
    const prof = 1 - smooth(top, base, ax);
    if (y < 1.696 && y > 1.618) d += (lerp(0.0028, 0.0188, Math.pow(tN, 1.0)) + 0.0021 * gauss(y, 1.668, 0.006)) * prof * smooth(1.696, 1.686, y) * smooth(1.618, 1.628, y);
    d += 0.0036 * gauss(y, 1.629, 0.0038) * (1 - smooth(0.003, 0.0082, ax));
    d += 0.0068 * smooth(1.6185, 1.625, y) * smooth(1.6315, 1.6245, y) * (1 - smooth(0.002, 0.0052, ax));
    d += 0.0042 * gauss(y, 1.6255, 0.0034) * (gauss(x, 0.0108, 0.0036) + gauss(x, -0.0108, 0.0036));
    d -= 0.0017 * gauss(y, 1.6245, 0.005) * (gauss(x, 0.0158, 0.0025) + gauss(x, -0.0158, 0.0025));
    // arcades, glabelle, orbites profondément creusées
    d += 0.0052 * gauss(y, 1.6905, 0.006) * gauss(ax, 0.027, 0.022);
    d += 0.0024 * gauss(y, 1.6885, 0.006) * gauss(x, 0, 0.01);
    d -= 0.0011 * smooth(1.683, 1.6865, y) * smooth(1.6975, 1.6945, y) * (gauss(x, 0.0052, 0.0011) + gauss(x, -0.0052, 0.0011));
    d -= 0.0072 * gauss(y, 1.6665, 0.0105) * gauss(ax, 0.032, 0.0165) * (x < 0 ? 1.1 : 1);
    // pommettes saillantes, joues très creuses, sillons
    d += 0.0064 * gauss(y, 1.6485, 0.0095) * gauss(ax, 0.053, 0.012);
    d -= 0.0082 * gauss(y, 1.617, 0.014) * gauss(ax, 0.047, 0.013) * asym;
    const nl = Math.min(segDist(x, y, 0.0195, 1.6305, 0.0285, 1.6005), segDist(x, y, -0.0195, 1.6305, -0.0285, 1.6005));
    d -= 0.0013 * (1 - smooth(0.0008, 0.003, nl));
    // tempes creusées
    d -= 0.004 * gauss(y, 1.70, 0.02) * gauss(aa, 1.15, 0.2);
    // bouche : lèvres très minces, commissure droite qui tombe
    const mw = BOUCHE_W, mx = clamp(ax / mw, 0, 1.2), shape = Math.sqrt(Math.max(0, 1 - mx * mx));
    const yl = BOUCHE_Y - 0.0013 * mx * mx - (x < 0 ? 0.0009 * mx : 0);
    d += 0.0004 * gauss(y, yl + 0.0022, 0.0013) * Math.pow(shape, 1.3);
    d += 0.0006 * gauss(y, yl - 0.0026, 0.0016) * shape;
    d -= 0.0011 * gauss(y, yl, 0.0008) * smooth(1.15, 0.9, mx);
    d += 0.0010 * gauss(y, 1.6125, 0.0042) * smooth(0.007, 0.002, ax);
    d -= 0.0010 * gauss(y, 1.5875, 0.003) * smooth(0.018, 0.005, ax);
    // menton anguleux (méplat et coins nets), angle de la mâchoire marqué
    d += 0.0062 * gauss(y, 1.5705, 0.0075) * (1 - smooth(0.014, 0.024, ax));
    d += 0.0016 * gauss(y, 1.5745, 0.004) * gauss(ax, 0.017, 0.004);
    d += 0.0052 * gauss(y, 1.583, 0.0095) * gauss(aa, 1.2, 0.22);
    d += 0.0003 * fissure(x, y);
    if (avecYeux !== false) {
      for (const sx of [1, -1]) {
        const cy = OEIL_C[1] - (sx < 0 ? 0.0008 : 0);
        const u = (x - OEIL_C[0] * sx) / OEIL_W, vy = y - cy;
        const v = vy / (vy > 0 ? OEIL_UP : OEIL_LO);
        const dd = u * u + v * v;
        if (dd < 3.5) {
          d -= 0.0118 * smooth(1.12, 0.6, dd);
          d += 0.0011 * gauss(dd, 1.08, 0.2);
          d -= 0.0018 * gauss(v, 1.9, 0.4) * smooth(1.45, 0.6, Math.abs(u));
          d -= 0.0012 * gauss(v, -1.8, 0.45) * smooth(1.3, 0.5, Math.abs(u));    // cernes creusés
        }
      }
    }
    return d * front;
  }
  function baseTete(y, ang, grow) {
    const r = interpRing(TETE_R, y - TETE_Y0);
    const c = Math.cos(ang), sn = Math.sin(ang), ex = 2 / r.n;
    return { x: Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (r.wL + (grow || 0)), z: Math.sign(c) * Math.pow(Math.abs(c), ex) * (r.dF + (grow || 0)) + r.oz, oz: r.oz };
  }
  function zVisage(x, y) {
    let lo = 0, hi = Math.PI / 2 * Math.sign(x || 1);
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (Math.abs(baseTete(y, mid).x) < Math.abs(x)) lo = mid; else hi = mid; }
    const ang = (lo + hi) / 2, b = baseTete(y, ang);
    const rl = Math.hypot(b.x, b.z - b.oz) || 1;
    return b.z + (b.z - b.oz) / rl * reliefVisage(b.x, y, ang, false);
  }

  function construireTete(bd, THREE, I, W, Q) {
    const q = bd.q;
    // anneaux : serrés sur le visage, couture de la bouche (4 anneaux), plus lâches sur le crâne
    const sl = [];
    const band = (y0, y1, st) => { for (let y = y0; y < y1 - 1e-6; y += 1.3 * st / Math.max(0.55, q)) sl.push(y - TETE_Y0); };
    band(1.556, 1.592, 0.004);
    band(1.592, 1.5994, 0.0022);
    sl.push(BOUCHE_Y - 0.0007 - TETE_Y0, BOUCHE_Y - 0.0003 - TETE_Y0, BOUCHE_Y + 0.0003 - TETE_Y0, BOUCHE_Y + 0.0007 - TETE_Y0);
    band(1.6015, 1.615, 0.0024);
    band(1.615, 1.655, 0.0028);
    band(1.655, 1.683, 0.0022);
    band(1.683, 1.711, 0.0032);
    band(1.711, 1.771, 0.007);
    band(1.771, 1.79, 0.005);
    sl.push(1.79 - TETE_Y0);
    sl.sort((a, b) => a - b);
    // zone de la mâchoire : sous la ligne de la bouche à l'avant, remonte vers l'oreille ; joues en fondu
    const poidsMach = (P) => {
      const x = P[0], y = P[1], z = P[2], ax = Math.abs(x);
      const front = smooth(0.035, 0.07, z);
      const inMouth = smooth(BOUCHE_W + 0.004, BOUCHE_W - 0.002, ax);
      const ySeam = BOUCHE_Y - 0.0013 * Math.min(1.2, ax / BOUCHE_W) ** 2;
      const lipCut = 1 - smooth(ySeam - 0.0001, ySeam + 0.0001, y);       // net à la lèvre
      const yJaw = lerp(1.612, 1.632, smooth(0.07, -0.01, z)) - 0.012 * smooth(0.02, 0.06, ax) * front;
      const soft = 1 - smooth(yJaw - 0.02, yJaw + 0.004, y);               // fondu sur les joues
      let w = lerp(soft * 0.85, lipCut, inMouth * front);
      w *= smooth(-0.07, -0.02, z) * smooth(1.66, 1.62, y);
      return clamp(w, 0, 1);
    };
    const peauTete = (P, s, ang) => {
      const x = P[0], y = P[1], ax = Math.abs(x);
      let c = mixc(PAL.peau, PAL.peauOmbre, fbm(P[0] * 55, P[1] * 55, P[2] * 55, 501) * 0.38);
      c = mixc(c, PAL.peauFroide, fbm(P[0] * 18, P[1] * 18, P[2] * 18, 503) * 0.45);
      c = mulc(c, 0.95 + 0.07 * vnoise(P[0] * 700, P[1] * 700, P[2] * 700, 505));
      // crâne rasé : ombre bleutée très légère de la repousse sur le haut et l'arrière
      c = mixc(c, mixc(PAL.peauOmbre, PAL.chaume, 0.4), smooth(1.70, 1.76, y) * 0.12 * (0.6 + 0.4 * vnoise(P[0] * 900, P[1] * 900, P[2] * 900, 509)));
      // orbites et joues assombries (cernes violacés), lèvres sombres et minces
      const u = (ax - OEIL_C[0]) / OEIL_W, vy = y - OEIL_C[1], v = vy / (vy > 0 ? OEIL_UP : OEIL_LO), dd = u * u + v * v;
      if (Math.cos(ang) > 0.25) {
        c = mixc(c, mixc(PAL.peauOmbre, hexc(0x4a4258), 0.5), smooth(5.5, 1.2, dd) * 0.38);
        c = mixc(c, hexc(0x221a24), gauss(dd, 1.02, 0.25) * smooth(-0.3, 0.3, v) * 0.55);
        c = mixc(c, mulc(PAL.peauOmbre, 0.82), gauss(y, 1.616, 0.012) * gauss(ax, 0.046, 0.012) * 0.45);
        const mw = BOUCHE_W, mx = clamp(ax / mw, 0, 1.2), yl = BOUCHE_Y - 0.0013 * mx * mx;
        c = mixc(c, PAL.levre, smooth(1.05, 0.85, mx) * gauss(y, yl, 0.0034) * 0.85);
        c = mixc(c, mulc(PAL.levre, 0.4), gauss(y, yl, 0.0008) * smooth(1.12, 0.8, mx) * 0.8);
        c = mixc(c, hexc(0x2e262a), gauss(y, 1.6262, 0.0013) * (gauss(x, 0.0058, 0.0018) + gauss(x, -0.0058, 0.0018)) * 0.7);   // narines
        const nl = Math.min(segDist(x, y, 0.0185, 1.6265, 0.0285, 1.6005), segDist(x, y, -0.0185, 1.6265, -0.0285, 1.6005));
        c = mixc(c, PAL.peauOmbre, (1 - smooth(0.0008, 0.003, nl)) * 0.45);
        // sourcils clairsemés gris, très fins (couleur seulement)
        const browY = 1.6898 + 0.0024 * Math.sin(Math.PI * clamp((ax - 0.01) / 0.044, 0, 1)) - 0.0012;
        c = mixc(c, mixc(PAL.chaume, PAL.peauOmbre, 0.4), gauss(y, browY, 0.0013) * smooth(0.008, 0.013, ax) * smooth(0.056, 0.046, ax) * 0.55 * (0.6 + 0.4 * vnoise(x * 2000, y * 600, 1, 511)));
        // chaume gris très court sur la mâchoire et le menton
        const mach = smooth(1.612, 1.598, y) * smooth(1.556, 1.568, y) * (1 - gauss(y, yl, 0.0035) * smooth(1.1, 0.8, mx));
        c = mixc(c, PAL.chaume, mach * 0.22 * (0.4 + 0.6 * hash3(Math.floor(x * 2600), Math.floor(y * 2600), Math.floor(P[2] * 2600), 513)));
      }
      // veines sombres autour des yeux, aux tempes et sur les côtés du crâne
      const vt = (1 - smooth(0.0, 0.05, Math.abs(vnoise(y * 90, ang * 7, 3, 507) - 0.5))) * gauss(Math.abs(wrapPi(ang)), 1.05, 0.38) * gauss(y, 1.69, 0.045);
      const ve = (1 - smooth(0.0, 0.06, Math.abs(vnoise(x * 160, y * 160, 7, 515) - 0.5))) * smooth(6.5, 2.0, dd) * smooth(1.2, 1.8, dd) * (Math.cos(ang) > 0.3 ? 1 : 0);
      c = mixc(c, PAL.veine, Math.max(vt * 0.65, ve * 0.55));
      return c;
    };
    bd.loft('peau', {
      a: [0, TETE_Y0, 0], b: [0, 1.9, 0], seg: 56, angWarp: 0.6, sList: sl, rings: teteRings(0), cap0: true, cap1: true, fixedStep: true,
      displace: (P, s, ang, r, radial) => { const d = reliefVisage(P[0], P[1], ang, true); return [radial[0] * d, radial[1] * d, radial[2] * d]; },
      weights: (s, ang, P) => {
        const m = poidsMach(P);
        const backLow = smooth(1.615, 1.575, P[1]) * smooth(-0.01, -0.06, P[2]);
        return [[I.head, (1 - m) * (1 - backLow * 0.6)], [I.machoire, m], [I.neck, (1 - m) * backLow * 0.6]];
      },
      color: peauTete,
      extra: (P, s, ang) => {
        const ax = Math.abs(P[0]);
        const front = Math.cos(ang) > 0.55 ? 1 : 0;
        const dy = Math.abs(P[1] - BOUCHE_Y);
        const mx = ax / BOUCHE_W;
        const hole = (dy < 0.00045 && mx < 1.0 && front) ? 1 : 0;
        return [0, hole, fissure(P[0], P[1]) * (Math.cos(ang) > 0 ? 1 : 0)];
      }
    });

    // cavité buccale (sombre), dents abîmées
    {
      const g = new THREE.SphereGeometry(1, bd.n(14, 8), bd.n(10, 6));
      const M = new THREE.Matrix4().makeTranslation(0, BOUCHE_Y - 0.004, 0.062).multiply(new THREE.Matrix4().makeScale(0.021, 0.016, 0.024));
      bd.rigid('bouche', g, M, (P) => { const m = smooth(BOUCHE_Y + 0.004, BOUCHE_Y - 0.006, P[1]); return [[I.head, 1 - m], [I.machoire, m]]; },
        (P) => mixc(hexc(0x1a0606), hexc(0x3a0c0a), smooth(BOUCHE_Y - 0.012, BOUCHE_Y - 0.018, P[1]) * 0.6));
      for (const [row, y0, bone] of [[0, BOUCHE_Y + 0.0035, I.head], [1, BOUCHE_Y - 0.0035, I.machoire]]) {
        for (let k = -3; k <= 3; k++) {
          const x = k * 0.0052, z = zVisage(x * 0.9, BOUCHE_Y) - 0.0085 - 0.0008 * k * k;
          const h = 0.0062 - Math.abs(k) * 0.0004 + (k === 1 || k === -2 ? -0.0015 : 0);
          const tg = new THREE.BoxGeometry(0.0047, h, 0.0035, 1, 2, 1);
          bd.rigid('bouche', tg, new THREE.Matrix4().makeRotationY(-x * 6).setPosition(x, y0 + (row ? -h / 2 + 0.003 : h / 2 - 0.003), z), [[bone, 1]],
            (P) => mixc(hexc(0xb6ab8c), hexc(0x5a4a32), 0.25 + 0.5 * vnoise(P[0] * 900, P[1] * 900, 1, 509)));
        }
      }
    }

    // yeux : globe sombre, iris rouge-orangé lumineux (masque d'émission), suivent les os des yeux
    for (const sx of [1, -1]) {
      const cx = OEIL_C[0] * sx, cy = OEIL_C[1] - (sx < 0 ? 0.0008 : 0);
      const rim = zVisage(cx, cy) + 0.0011;
      const cz = rim - 0.0018 - OEIL_R;
      const look = vnorm([0.02 * sx, -0.01, 1]);
      const bone = sx > 0 ? I.oeilG : I.oeilD;
      const g = new THREE.SphereGeometry(OEIL_R, bd.n(16, 10), bd.n(10, 7));
      bd.cur = (P) => { const n = vnorm(vsub(P, [cx, cy, cz])), dz = vdot(n, look); return [0, 0, dz > 0.975 ? 0.05 : dz > 0.86 ? 1.0 - 0.4 * smooth(0.93, 0.86, dz) : 0.035]; };
      bd.rigid('yeux', g, new THREE.Matrix4().makeTranslation(cx, cy, cz), [[bone, 1]], (P, N) => {
        const dz = vdot(N, look);
        if (dz > 0.975) return hexc(0x080303);
        if (dz > 0.86) return mixc(hexc(0xff3a1a), hexc(0xffa060), smooth(0.9, 0.97, dz));
        return mixc(hexc(0x1c1416), hexc(0x3a0e10), 0.3 + 0.5 * vnoise(N[0] * 30, N[1] * 30, N[2] * 30, 517));
      });
      bd.cur = [0, 0, 0];
      // bord des paupières sombre
      const lid = [];
      for (let k = 0; k <= 28; k++) {
        const t = k / 28 * TAU, u = Math.cos(t), up = Math.sin(t) >= 0;
        const ly = cy + Math.sin(t) * (up ? OEIL_UP : OEIL_LO) * 0.97;
        lid.push([cx + u * (OEIL_W - 0.0003), ly, zVisage(cx + u * (OEIL_W - 0.0003), ly) - 0.0012]);
      }
      bd.ribbon('peau', lid, (t) => (Math.sin(t * TAU) >= 0 ? 0.0024 : 0.0016), 0.0015,
        (pp) => vnorm([(pp[0] - cx) * 0.6, (pp[1] - cy) * 0.6, 1]), () => [[I.head, 1]],
        (P, t) => mixc(mixc(PAL.peau, PAL.peauOmbre, 0.6), hexc(0x120a0a), smooth(-0.2, 0.6, Math.sin(t * TAU)) * 0.8));
    }
    // oreilles normales (proches du crâne), pâles
    for (const sx of [1, -1]) {
      const ear = new THREE.SphereGeometry(0.0275, bd.n(12, 8), bd.n(9, 6));
      ear.scale(0.3, 0.98, 0.56);
      const me = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.18, -0.06 * sx, 0.05 * sx)).setPosition(0.0688 * sx, 1.654, -0.03);
      bd.rigid('peau', ear, me, [[I.head, 1]], (P, N) => mixc(mixc(PAL.peau, PAL.peauRose, 0.25), PAL.peauOmbre, smooth(0.1, 0.8, N[0] * sx) * 0.5));
      const rimG = new THREE.TorusGeometry(0.0216, 0.0038, 5, bd.n(12, 8), Math.PI * 1.25);
      rimG.rotateZ(-Math.PI * 0.45); rimG.scale(1, 1.18, 1);
      const mr = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.18, -0.06 * sx + Math.PI / 2 * sx, 0.05 * sx)).setPosition(0.0708 * sx, 1.657, -0.032);
      bd.rigid('peau', rimG, mr, [[I.head, 1]], mixc(PAL.peau, PAL.peauRose, 0.3));
    }

    // cicatrice chirurgicale agrafée : de la tempe droite (x < 0) à la mâchoire, en avant de l'oreille ;
    // polyligne posée sur la surface (le shader dessine la couture, le bourrelet et les agrafes)
    {
      const pts = [[1.722, -1.08], [1.688, -1.2], [1.652, -1.22], [1.618, -1.16], [1.592, -1.02], [1.572, -0.8]];
      Q.cicatrice = pts.map(([y, ang]) => {
        const b = baseTete(y, -Math.abs(ang));
        const rl = Math.hypot(b.x, b.z - b.oz) || 1;
        const d = reliefVisage(b.x, y, -Math.abs(ang), false);
        return [b.x + b.x / rl * d, y, b.z + (b.z - b.oz) / rl * d];
      });
    }

  }

  // ============================================================================================
  // Tête cuite BOSS_B7_TETE (contrat : boss/DESIGN.md). Décodage du maillage quantifié, des textures (albédo,
  // normales, ORM, émission), de la morphose « bouche » (mâchoire ouverte), des dents (l'arcade du bas tourne
  // avec la mâchoire), de la cavité buccale, des yeux (iris incandescent, cornée) et des extensions facultatives
  // (« cligne », cils). Les positions du contrat sont dans le repère du CORPS (1,75 m). La peau (avec le cou)
  // est un SkinnedMesh du squelette du boss, pondéré par les poids « peau » du contrat (head / neck / chest) :
  // le bas du cou suit la poitrine et reste dans le col quand la tête bascule. Yeux, dents et cavité sont
  // rigides sur l'os « head » (repère local du squelette de 1,80 m, groupe du corps à l'échelle 1,75 / 1,80).
  // Méthode de rendu de la peau reprise de la tête du survivant (lumière enveloppante, occlusion cuite).
  // ============================================================================================
  // émission (sceau, iris) : ≈ 2 au repos, ≈ 3,2 au plus fort (rugissements), 0 à la mort
  const LUEUR_PEAU_B7 = 2.0, LUEUR_PEAU_B7_MAX = 3.2, LUEUR_YEUX_B7 = 2.6, LUEUR_YEUX_B7_MAX = 3.6, LUEUR_REPOS = 0.385;
  function b64octets(s) {
    let bin;
    if (typeof atob === 'function') bin = atob(s);
    else bin = Buffer.from(s, 'base64').toString('binary');
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  const b64u16 = (s) => new Uint16Array(b64octets(s).buffer);
  const b64u32 = (s) => new Uint32Array(b64octets(s).buffer);
  const b64i16 = (s) => new Int16Array(b64octets(s).buffer);
  const b64i8 = (s) => new Int8Array(b64octets(s).buffer);

  function couleurTete(THREE, hex, linear) {
    const c = new THREE.Color(hex);
    const auto = THREE.ColorManagement && (THREE.ColorManagement.enabled === true || THREE.ColorManagement.legacyMode === false);
    if (linear && !auto && c.convertSRGBToLinear) c.convertSRGBToLinear();
    return c;
  }
  function espaceTexture(THREE, tex, srgb) {
    if ('colorSpace' in tex) tex.colorSpace = srgb ? (THREE.SRGBColorSpace || 'srgb') : (THREE.NoColorSpace || '');
    else tex.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  }
  // Peau : lumière enveloppante (cire translucide) + diffusion au terminateur, occlusion cuite sur la lumière
  // directe dans les creux. Compatible r128 (geometry.normal) et r150+ (geometryNormal). Ajoute l'éclair uFlash.
  function retoucheePeauB7(THREE, U) {
    return function (shader) {
      shader.uniforms.uFlash = U.uFlash;
      shader.uniforms.uDissol = U.uDissol; shader.uniforms.uDissolCoul = U.uDissolCoul;
      // dissolution du corps (apparition, téléportations) : même bruit que les vêtements, position du repère du corps
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPosT;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosT = position;');
      let chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
      const wrap = (nrm, brdf) => '{ float wNdL = dot( ' + nrm + ', directLight.direction );\n' +
        '  vec3 wrapI = directLight.color * ( max( ( wNdL + 0.4 ) / 1.4, 0.0 ) * 0.65 + max( wNdL, 0.0 ) * 0.35 );\n' +
        '  vec3 scat = directLight.color * vec3( 0.10, 0.08, 0.085 ) * max( 0.0, 1.0 - abs( wNdL * 1.8 - 0.15 ) ) * 0.5;\n' +
        '  #ifndef PHYSICALLY_CORRECT_LIGHTS\n  wrapI *= PI; scat *= PI;\n  #endif\n' +
        '  reflectedLight.directDiffuse += ( wrapI + scat ) * ' + brdf + '( material.diffuseColor ); }';
      const a = 'reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );';
      const b = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
      if (chunk.indexOf(a) >= 0) chunk = chunk.replace(a, wrap('geometry.normal', 'BRDF_Diffuse_Lambert'));
      else if (chunk.indexOf(b) >= 0) chunk = chunk.replace(b, wrap('geometryNormal', 'BRDF_Lambert'));
      else chunk = null;
      if (chunk) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uFlash;\nuniform float uDissol;\nuniform vec3 uDissolCoul;\nvarying vec3 vPosT;\n' + GLSL_BRUIT +
          'float bossDissT(){ float d = length((vPosT - vec3(0.0, 1.22, -0.02)) * vec3(1.0, 0.8, 1.0)); return clamp(0.6 * bF3(vPosT * 9.0) + 0.4 * (1.0 - clamp(d / 1.25, 0.0, 1.0)), 0.0, 1.0); }')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat bossDvT = 1.0;\nif (uDissol > 0.0) { bossDvT = bossDissT() - (uDissol * 1.08 - 0.04); if (bossDvT < 0.0) discard; }')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' +
          '#ifdef USE_AOMAP\n  { float occD = smoothstep( 0.2, 0.72, ambientOcclusion );\n' +
          '    reflectedLight.directDiffuse *= mix( 0.1, 1.0, occD );\n    reflectedLight.directSpecular *= mix( 0.03, 1.0, occD ); }\n#endif')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uFlash;\n' +
          'if (uDissol > 0.0) totalEmissiveRadiance += uDissolCoul * ((1.0 - smoothstep(0.0, 0.035, bossDvT)) * 3.2 + (1.0 - smoothstep(0.0, 0.12, bossDvT)) * 0.6);');
    };
  }
  // texture de repli dessinée (œil incandescent) quand les données n'en fournissent pas
  function texOeilRepli(THREE, emission) {
    if (typeof document === 'undefined') return new THREE.Texture();
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = emission ? '#000' : '#2a1412'; g.fillRect(0, 0, 128, 128);
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 30);
    gr.addColorStop(0, emission ? '#000' : '#050101');
    gr.addColorStop(0.25, emission ? '#ff6a10' : '#c2380c');
    gr.addColorStop(0.8, emission ? '#a01800' : '#5e1206');
    gr.addColorStop(1, emission ? '#000' : '#2a1412');
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 30, 0, TAU); g.fill();
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  // Ressources de la tête partagées par les instances de même configuration (données, version de three, qualité des
  // textures, espace de couleur, allègement, anisotropie) : géométries (peau et morphoses, dents, cavité, yeux, cornée,
  // cils), textures, promesse de chargement, position de repos de l'ancre de la bouche. Rien n'y est modifié en cours de
  // jeu : matériaux, maillages, morphoses actives et ancres appartiennent à chaque instance (creerTeteB7).
  function ressourcesTeteB7(THREE, D, O, osTete, linear, I, aniso) {
    const rev = parseInt(THREE.REVISION, 10);
    const basse = O.qualite === 'basse';
    const geoms = [], texs = [], promesses = [];
    // repère du corps (1,75 m) → repère local de l'os de la tête (squelette de 1,80 m)
    const vl = (x, y, z, out, k) => { out[k] = x / ECHELLE - osTete[0]; out[k + 1] = y / ECHELLE - osTete[1]; out[k + 2] = z / ECHELLE - osTete[2]; };
    const pl = (p) => [p[0] / ECHELLE - osTete[0], p[1] / ECHELLE - osTete[1], p[2] / ECHELLE - osTete[2]];
    const maxTex = basse ? 512 : 0;
    function texture(cles, srgb, repli) {
      let src = null;
      for (const k of cles) if (D.tex && D.tex[k]) { src = D.tex[k]; break; }
      let tex;
      if (!src || typeof document === 'undefined') tex = repli ? repli() : new THREE.Texture();
      else {
        let res;
        promesses.push(new Promise((r) => { res = r; }));
        tex = new THREE.TextureLoader().load(src, (t) => {
          const im = t.image;
          if (maxTex && im && im.width > maxTex) {
            const c = document.createElement('canvas'); c.width = c.height = maxTex;
            c.getContext('2d').drawImage(im, 0, 0, maxTex, maxTex);
            t.image = c; t.needsUpdate = true;
          }
          res();
        }, undefined, () => res());
      }
      espaceTexture(THREE, tex, srgb && linear);
      tex.anisotropy = aniso;
      texs.push(tex);
      return tex;
    }

    // ---------------------------------------------------------------- peau
    const nv = D.nv, bb = D.bbox;
    const q = b64u16(D.pos), nq = b64i8(D.nrm), uq = b64u16(D.uv);
    const iq = nv >= 65536 ? b64u32(D.idx) : b64u16(D.idx);
    const pos = new Float32Array(nv * 3), posC = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++) {
      const x = bb[0] + (bb[3] - bb[0]) * q[i * 3] / 65535, y = bb[1] + (bb[4] - bb[1]) * q[i * 3 + 1] / 65535, z = bb[2] + (bb[5] - bb[2]) * q[i * 3 + 2] / 65535;
      vl(x, y, z, pos, i * 3);
      posC[i * 3] = x / ECHELLE; posC[i * 3 + 1] = y / ECHELLE; posC[i * 3 + 2] = z / ECHELLE;   // repère du groupe « corps »
      const nx = nq[i * 3] / 127, ny = nq[i * 3 + 1] / 127, nz = nq[i * 3 + 2] / 127, nl = Math.hypot(nx, ny, nz) || 1;
      nrm[i * 3] = nx / nl; nrm[i * 3 + 1] = ny / nl; nrm[i * 3 + 2] = nz / nl;
      uv[i * 2] = uq[i * 2] / 65535; uv[i * 2 + 1] = uq[i * 2 + 1] / 65535;
    }
    // peau skinnée (poids du contrat) si possible, sinon rigide sur l'os de la tête
    const W8 = D.peau && D.peau.poids && D.peau.os && I ? b64octets(D.peau.poids) : null;
    const skinnee = !!(W8 && W8.length >= nv * 3 && D.peau.os.every((n) => I[n] != null));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(skinnee ? posC : pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    if (skinnee) {
      const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), os = D.peau.os.map((n) => I[n]);
      for (let i = 0; i < nv; i++) {
        let t = 0;
        for (let k = 0; k < 3; k++) { si[i * 4 + k] = os[k]; sw[i * 4 + k] = W8[i * 3 + k]; t += W8[i * 3 + k]; }
        for (let k = 0; k < 3; k++) sw[i * 4 + k] = t > 0 ? sw[i * 4 + k] / t : (k === 0 ? 1 : 0);
      }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('uv2', new THREE.BufferAttribute(uv, 2));        // aoMap en r128
    if (rev >= 151) geo.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(iq, 1));
    // morphoses : deltas en 1/100 mm (repère du corps) → mètres du repère local ; normales recalculées
    const morphs = [], noms = [];
    const normalesMorph = (dp) => {
      const tmp = new THREE.BufferGeometry();
      const p2 = new Float32Array(pos.length);
      for (let i = 0; i < p2.length; i++) p2[i] = pos[i] + dp[i];   // (repère local : mêmes axes et même échelle que le corps)
      tmp.setAttribute('position', new THREE.BufferAttribute(p2, 3));
      tmp.setIndex(new THREE.BufferAttribute(iq, 1));
      tmp.computeVertexNormals();
      const n2 = tmp.attributes.normal.array, dn = new Float32Array(n2.length);
      // seuls les sommets déplacés changent de normale (évite les écarts de lissage ailleurs)
      for (let i = 0; i < nv; i++) {
        const m = Math.abs(dp[i * 3]) + Math.abs(dp[i * 3 + 1]) + Math.abs(dp[i * 3 + 2]);
        if (m < 1e-6) continue;
        const w = Math.min(1, m / 0.0015);
        for (let k = 0; k < 3; k++) dn[i * 3 + k] = (n2[i * 3 + k] - nrm[i * 3 + k]) * w;
      }
      tmp.dispose();
      return dn;
    };
    const ajouterMorph = (M, nom) => {
      if (!M || !M.idx || !M.delta) return -1;
      const idx = b64u16(M.idx), d = b64i16(M.delta), dp = new Float32Array(nv * 3);
      for (let j = 0; j < idx.length; j++) for (let k = 0; k < 3; k++) dp[idx[j] * 3 + k] = d[j * 3 + k] * 1e-5 / ECHELLE;
      morphs.push({ p: dp, n: normalesMorph(dp) }); noms.push(nom);
      return morphs.length - 1;
    };
    const iBouche = ajouterMorph(D.bouche, 'bouche');
    const iCligne = ajouterMorph(D.cligne, 'cligne');
    if (morphs.length) {
      geo.morphAttributes.position = morphs.map((m, i) => { const a = new THREE.BufferAttribute(m.p, 3); a.name = noms[i]; return a; });
      geo.morphAttributes.normal = morphs.map((m, i) => { const a = new THREE.BufferAttribute(m.n, 3); a.name = noms[i]; return a; });
      geo.morphTargetsRelative = true;
    }
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += 0.05;
    geoms.push(geo);
    const tex = { albedo: texture(['albedo'], true), normal: texture(['normal'], false), emission: texture(['emission', 'emissif'], true), orm: texture(['orm'], false) };

    // ---------------------------------------------------------------- mâchoire, dents, cavité
    const J = D.machoire || { pivot: [0, 1.5995, 0.0015], axe: [1, 0, 0], angle: 0.42 };
    const pivotL = pl(J.pivot), axeJ = vnorm([J.axe[0], J.axe[1], J.axe[2]]), angMax = J.angle != null ? J.angle : 0.42;
    const geoSimple = (V, Ix, decal) => {
      const n = V.length / 3, a = new Float32Array(V.length);
      for (let i = 0; i < n; i++) vl(V[i * 3], V[i * 3 + 1], V[i * 3 + 2], a, i * 3);
      if (decal) for (let i = 0; i < n; i++) { a[i * 3] -= decal[0]; a[i * 3 + 1] -= decal[1]; a[i * 3 + 2] -= decal[2]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      g.setIndex(Ix);
      g.computeVertexNormals();
      geoms.push(g);
      return g;
    };
    let geoDentsHaut = null, geoDentsBas = null, geoCavite = null;
    if (D.dents && !O.allege) {           // allégé (illusions) : pas de dents (invisibles à distance, 2 appels de dessin)
      if (D.dents.haut && D.dents.haut.v && D.dents.haut.v.length) geoDentsHaut = geoSimple(D.dents.haut.v, D.dents.haut.i);
      if (D.dents.bas && D.dents.bas.v && D.dents.bas.v.length) geoDentsBas = geoSimple(D.dents.bas.v, D.dents.bas.i, pivotL);
    }
    // cavité buccale : rouge très sombre ; les sommets de « caviteBas » suivent la mâchoire (morphose calculée)
    if (D.cavite && D.cavite.v && D.cavite.v.length) {
      const g = geoSimple(D.cavite.v, D.cavite.i);
      if (D.caviteBas && D.caviteBas.length) {
        const P2 = g.attributes.position.array, dp = new Float32Array(P2.length);
        const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axeJ[0], axeJ[1], axeJ[2]), angMax), v = new THREE.Vector3();
        for (const i of D.caviteBas) {
          v.set(P2[i * 3] - pivotL[0], P2[i * 3 + 1] - pivotL[1], P2[i * 3 + 2] - pivotL[2]).applyQuaternion(qa);
          dp[i * 3] = v.x + pivotL[0] - P2[i * 3]; dp[i * 3 + 1] = v.y + pivotL[1] - P2[i * 3 + 1]; dp[i * 3 + 2] = v.z + pivotL[2] - P2[i * 3 + 2];
        }
        const a = new THREE.BufferAttribute(dp, 3); a.name = 'bouche';
        g.morphAttributes.position = [a]; g.morphTargetsRelative = true;
      }
      geoCavite = g;
    }

    // ---------------------------------------------------------------- yeux : globe à iris émissif, cornée
    const Y = D.yeux || {};
    const er = (Y.rayon || (D.eye && D.eye.r) || 0.0117) / ECHELLE;
    const centres = [Y.gauche || [0.0306, 1.6209, 0.0637], Y.droit || [-0.0306, 1.6209, 0.0637]];
    tex.oeil = texture(['oeil'], true, () => texOeilRepli(THREE, false));
    tex.oeilEmission = texture(['oeilEmission', 'oeilEmissif'], true, () => texOeilRepli(THREE, true));
    const ri = er * 0.5, zi = Math.sqrt(er * er - ri * ri);
    const oeilGeo = new THREE.SphereGeometry(er, basse ? 18 : 26, basse ? 12 : 16);
    oeilGeo.rotateX(Math.PI / 2);
    {
      const p = oeilGeo.attributes.position, uvs = oeilGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i); let z = p.getZ(i); const rr = Math.hypot(x, y);
        if (z > 0 && rr < ri) z = zi + er * 0.019 * (1 - (rr / ri) * (rr / ri));
        p.setXYZ(i, x, y, z);
        uvs.setXY(i, 0.5 + x / (2.1 * er), 0.5 + y / (2.1 * er));
      }
      oeilGeo.computeVertexNormals();
    }
    geoms.push(oeilGeo);
    const rc = er * 0.66, th = Math.asin(Math.min(0.99, ri / rc)) * 1.04, z0 = zi - rc * Math.cos(Math.asin(Math.min(0.99, ri / rc)));
    const corneeGeo = new THREE.SphereGeometry(rc, 22, 8, 0, TAU, 0, th);
    corneeGeo.rotateX(Math.PI / 2); corneeGeo.translate(0, 0, z0);
    geoms.push(corneeGeo);

    // ---------------------------------------------------------------- cils (extension facultative, ancien format)
    let geoCils = null;
    if (!basse && D.cils && D.cils.v && D.tex && D.tex.cils) {
      const L = D.cils, lv = L.v, n = lv.length / 3;
      const LP = new Float32Array(n * 6), LU = new Float32Array(n * 4), LB = new Float32Array(n * 6), LN = new Float32Array(n * 6), LI = [];
      for (let s = 0; s < 2; s++) {
        const sx = s === 0 ? 1 : -1, c = pl(centres[s]);
        for (let v = 0; v < n; v++) {
          const o = s * n + v;
          LP[o * 3] = c[0] + sx * lv[v * 3] / 1000; LP[o * 3 + 1] = c[1] + lv[v * 3 + 1] / 1000; LP[o * 3 + 2] = c[2] + lv[v * 3 + 2] / 1000;
          if (L.cligne) { LB[o * 3] = sx * L.cligne[v * 3] / 100000; LB[o * 3 + 1] = L.cligne[v * 3 + 1] / 100000; LB[o * 3 + 2] = L.cligne[v * 3 + 2] / 100000; }
          LU[o * 2] = L.uv[v * 2]; LU[o * 2 + 1] = L.uv[v * 2 + 1];
          LN[o * 3 + 1] = 0.3; LN[o * 3 + 2] = 0.95;
        }
        for (let t = 0; t < L.i.length; t += 3) {
          if (s === 0) LI.push(L.i[t], L.i[t + 1], L.i[t + 2]); else LI.push(n + L.i[t], n + L.i[t + 2], n + L.i[t + 1]);
        }
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(LP, 3));
      lg.setAttribute('normal', new THREE.BufferAttribute(LN, 3));
      lg.setAttribute('uv', new THREE.BufferAttribute(LU, 2));
      lg.setIndex(LI);
      if (L.cligne) { const a = new THREE.BufferAttribute(LB, 3); a.name = 'cligne'; lg.morphAttributes.position = [a]; lg.morphTargetsRelative = true; }
      lg.computeBoundingSphere();
      geoms.push(lg);
      geoCils = lg;
      tex.cils = texture(['cils'], true);
    }

    // ---------------------------------------------------------------- ancre de la bouche (centre des lèvres), bouche fermée
    const bL = pl([0, (J.pivot[1] || 1.5995) + 0.0045 * ECHELLE, 0.086]);
    let boucheRepos;
    {
      // la bouche se trouve devant le pivot de la mâchoire : on prend le point le plus en avant du bas du visage
      let best = -Infinity, by = bL[1], bz = bL[2];
      const yRef = pivotL[1] + 0.004;
      for (let i = 0; i < nv; i++) {
        const y = pos[i * 3 + 1], x = pos[i * 3];
        if (Math.abs(x) < 0.006 && Math.abs(y - yRef) < 0.012 && pos[i * 3 + 2] > best) { best = pos[i * 3 + 2]; by = y; bz = pos[i * 3 + 2]; }
      }
      boucheRepos = [0, by, Number.isFinite(best) ? bz - 0.004 : bL[2]];
    }
    return {
      geo: geo, skinnee: skinnee, nv: nv, noms: noms, iBouche: iBouche, iCligne: iCligne, pivotL: pivotL, axe: axeJ, angMax: angMax,
      geoDentsHaut: geoDentsHaut, geoDentsBas: geoDentsBas, geoCavite: geoCavite, oeilGeo: oeilGeo, corneeGeo: corneeGeo, geoCils: geoCils,
      centres: centres.map(pl), tex: tex, boucheRepos: boucheRepos,
      pret: promesses.length ? Promise.all(promesses) : Promise.resolve(),
      liberer: () => { geoms.forEach((g) => g.dispose()); texs.forEach((t) => t.dispose()); }
    };
  }

  function creerTeteB7(THREE, D, O, U, osTete, linear, I) {
    const rev = parseInt(THREE.REVISION, 10);
    const basse = O.qualite === 'basse';
    const ombres = O.ombres !== false;
    const aniso = O.renderer && O.renderer.capabilities ? Math.min(8, O.renderer.capabilities.getMaxAnisotropy()) : 4;
    // géométries et textures : partagées entre instances de même configuration (illusions) ; le reste est à l'instance
    const cle = ['tete', idDonnees(D), THREE.REVISION, basse ? 'basse' : 'haute', linear ? 1 : 0, O.allege ? 'allege' : 'complet', aniso].join('|');
    const res = prendreRessource(THREE, cle, () => ressourcesTeteB7(THREE, D, O, osTete, linear, I, aniso));
    const R = res.valeur, T = R.tex;
    const objet = new THREE.Group();
    objet.name = 'boss-tete';
    const mats = {}, meshes = {};

    // ---------------------------------------------------------------- peau
    const peauM = new THREE.MeshStandardMaterial({
      map: T.albedo, normalMap: T.normal, roughness: 1.0, metalness: 0.0, aoMapIntensity: 0.85,
      emissive: new THREE.Color(1, 1, 1), emissiveMap: T.emission, emissiveIntensity: LUEUR_PEAU_B7
    });
    peauM.aoMap = T.orm; peauM.roughnessMap = T.orm;
    peauM.onBeforeCompile = retoucheePeauB7(THREE, U);
    peauM.customProgramCacheKey = () => 'boss-b7-peau';
    peauM.name = 'boss-tete-peau';
    if (rev < 129 && R.noms.length) { peauM.morphTargets = true; peauM.morphNormals = true; }
    if (rev < 129 && R.skinnee) peauM.skinning = true;
    mats.peau = peauM;
    const peau = R.skinnee ? new THREE.SkinnedMesh(R.geo, peauM) : new THREE.Mesh(R.geo, peauM);
    peau.name = 'boss-tete-peau';
    peau.castShadow = ombres; peau.receiveShadow = ombres;
    if (R.skinnee) peau.frustumCulled = false; else objet.add(peau);   // la peau skinnée va dans le groupe du corps (voir creer)
    meshes.peau = peau;

    // ---------------------------------------------------------------- mâchoire : pivot qui porte l'arcade du bas
    const pivotL = R.pivotL, axe = new THREE.Vector3(R.axe[0], R.axe[1], R.axe[2]), angMax = R.angMax;
    const machoire = new THREE.Object3D();
    machoire.name = 'boss-machoire';
    machoire.position.set(pivotL[0], pivotL[1], pivotL[2]);
    objet.add(machoire);
    if (R.geoDentsHaut || R.geoDentsBas) {
      const dentsM = new THREE.MeshStandardMaterial({ color: couleurTete(THREE, 0xa89c84, linear), roughness: 0.55, metalness: 0.0 });
      dentsM.name = 'boss-dents';
      mats.dents = dentsM;
      if (R.geoDentsHaut) { const m = new THREE.Mesh(R.geoDentsHaut, dentsM); m.name = 'boss-dents-haut'; m.receiveShadow = ombres; objet.add(m); meshes.dentsHaut = m; }
      if (R.geoDentsBas) { const m = new THREE.Mesh(R.geoDentsBas, dentsM); m.name = 'boss-dents-bas'; m.receiveShadow = ombres; machoire.add(m); meshes.dentsBas = m; }
    }
    if (R.geoCavite) {
      const cavM = new THREE.MeshStandardMaterial({ color: couleurTete(THREE, 0x2a0606, linear), roughness: 0.7, metalness: 0, emissive: couleurTete(THREE, 0x3a0400, linear), emissiveIntensity: 0.6 });
      if (rev < 129 && R.geoCavite.morphAttributes.position) cavM.morphTargets = true;
      cavM.name = 'boss-cavite';
      mats.cavite = cavM;
      const m = new THREE.Mesh(R.geoCavite, cavM); m.name = 'boss-cavite'; objet.add(m); meshes.cavite = m;
    }

    // ---------------------------------------------------------------- yeux : globe à iris émissif, cornée
    const oeilM = new THREE.MeshStandardMaterial({
      map: T.oeil, roughness: 0.3, metalness: 0, emissive: new THREE.Color(1, 1, 1), emissiveMap: T.oeilEmission, emissiveIntensity: LUEUR_YEUX_B7
    });
    oeilM.name = 'boss-yeux';
    mats.yeux = oeilM;
    let corneeM = null;
    if (!basse) {
      corneeM = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      corneeM.name = 'boss-cornee';
      mats.cornee = corneeM;
    }
    const ancres = {};
    R.centres.forEach((L, k) => {
      const piv = new THREE.Object3D(); piv.name = k === 0 ? 'boss-oeilG' : 'boss-oeilD';
      piv.position.set(L[0], L[1], L[2]);
      const globe = new THREE.Mesh(R.oeilGeo, oeilM); globe.name = 'boss-globe'; globe.receiveShadow = ombres; piv.add(globe);
      if (corneeM) { const co = new THREE.Mesh(R.corneeGeo, corneeM); co.name = 'boss-cornee'; co.renderOrder = 2; piv.add(co); }
      objet.add(piv);
      ancres[k === 0 ? 'oeilG' : 'oeilD'] = piv;
    });

    // ---------------------------------------------------------------- cils (extension facultative, ancien format)
    if (R.geoCils) {
      const cilsM = new THREE.MeshStandardMaterial({ map: T.cils, roughness: 0.6, metalness: 0, alphaTest: 0.35, side: THREE.DoubleSide });
      if (rev < 129 && R.geoCils.morphAttributes.position) cilsM.morphTargets = true;
      cilsM.name = 'boss-cils';
      mats.cils = cilsM;
      const m = new THREE.Mesh(R.geoCils, cilsM); m.name = 'boss-tete-cils'; objet.add(m); meshes.cils = m;
    }

    // ---------------------------------------------------------------- ancre de la bouche (centre des lèvres)
    const bouche = new THREE.Object3D(); bouche.name = 'boss-bouche';
    bouche.position.set(R.boucheRepos[0], R.boucheRepos[1], R.boucheRepos[2]);
    objet.add(bouche);
    ancres.bouche = bouche;
    const boucheFermee = bouche.position.clone();

    // ---------------------------------------------------------------- commandes
    const iBouche = R.iBouche, iCligne = R.iCligne;
    const etat = { machoire: 0, cligne: 0, lueur: 1 };
    const oeilBase = new THREE.Color(1, 1, 1), oeilMort = linear ? new THREE.Color(toLin(0.6), toLin(0.56), toLin(0.55)) : new THREE.Color(0.6, 0.56, 0.55);
    const qj = new THREE.Quaternion(), vj = new THREE.Vector3();
    function setMachoire(v) {
      v = clamp(+v || 0, 0, 1);
      etat.machoire = v;
      if (iBouche >= 0) peau.morphTargetInfluences[iBouche] = v;
      if (meshes.cavite && meshes.cavite.morphTargetInfluences) meshes.cavite.morphTargetInfluences[0] = v;
      machoire.quaternion.setFromAxisAngle(axe, angMax * v);
      // l'ancre suit la lèvre inférieure à mi-ouverture
      qj.setFromAxisAngle(axe, angMax * v * 0.5);
      vj.copy(boucheFermee).sub(machoire.position).applyQuaternion(qj).add(machoire.position);
      bouche.position.copy(vj);
    }
    function setCligne(v) {
      v = clamp(+v || 0, 0, 1);
      etat.cligne = v;
      if (iCligne >= 0) peau.morphTargetInfluences[iCligne] = v;
      if (meshes.cils && meshes.cils.morphTargetInfluences) meshes.cils.morphTargetInfluences[0] = v;
    }
    function setLueur(v) {
      // v = lueur / 2,6 (≈ 0,385 au repos, 1 au plus fort, 0 à la mort)
      v = Math.max(0, +v || 0);
      etat.lueur = v;
      const r = v <= LUEUR_REPOS ? v / LUEUR_REPOS : 1, h = v > LUEUR_REPOS ? clamp((v - LUEUR_REPOS) / (1 - LUEUR_REPOS), 0, 1.2) : 0;
      peauM.emissiveIntensity = LUEUR_PEAU_B7 * r + (LUEUR_PEAU_B7_MAX - LUEUR_PEAU_B7) * h;
      oeilM.emissiveIntensity = LUEUR_YEUX_B7 * r + (LUEUR_YEUX_B7_MAX - LUEUR_YEUX_B7) * h;
      oeilM.color.copy(oeilMort).lerp(oeilBase, r);
    }
    if (peau.morphTargetInfluences) for (let i = 0; i < peau.morphTargetInfluences.length; i++) peau.morphTargetInfluences[i] = 0;
    setMachoire(0); setCligne(0); setLueur(1);
    let tris = R.skinnee ? R.geo.index.count / 3 : 0;
    objet.traverse((m) => { if (m.isMesh && m.geometry.index) tris += m.geometry.index.count / 3; });
    let libere = false;
    return {
      objet: objet, peauSkinnee: R.skinnee ? peau : null, ancres: ancres, maillages: meshes, materiaux: mats, etat: etat, pret: R.pret,
      stats: { triangles: Math.round(tris), sommetsPeau: R.nv, morphoses: R.noms.slice() },
      setMachoire: setMachoire, setCligne: setCligne, setLueur: setLueur,
      dispose: () => {
        if (libere) return;
        libere = true;
        if (objet.parent) objet.parent.remove(objet); if (R.skinnee && peau.parent) peau.parent.remove(peau);
        for (const k in mats) mats[k].dispose();
        res.rendre();   // géométries et textures : libérées avec la dernière instance qui les utilise
      }
    };
  }

  // ============================================================================================
  // Ailes de la phase 2 (création originale) : charpente d'os noueux (racine, humérus, avant-bras,
  // poignet hérissé, pouce-griffe, quatre longs doigts osseux à deux phalanges terminées en griffes)
  // et membranes déchirées d'énergie rouge-noir (shader : trous de bruit, veines émissives, bords
  // incandescents, apparition depuis les os, dissolution en braises). Envergure ≈ 5,4 m.
  // États : apparition (les os percent le dos et se déplient), déployées (battements, frémissement),
  // repliées en flèche pendant le piqué (paramètres de pose « ail »), disparition (cendres et braises).
  // ============================================================================================
  // angles des articulations (radians) : [plan de l'aile (+ = vers le haut), balayage (+ = vers l'arrière)]
  const AILE_FERMEE = { hum: [0.78, 0.28], avb: [-1.8, 0.05], d: [[1.85, 0], [2.38, 0], [2.95, 0], [3.5, 0]], pou: [1.2, 0] };
  const AILE_FLECHE = { hum: [-0.2, 1.0], avb: [-0.75, 0.25], d: [[-0.3, 0.05], [0.05, 0.08], [0.38, 0.1], [0.66, 0.12]], pou: [0.4, 0] };

  function creerAiles(THREE, C) {
    const B = C.B, I = C.I, q = C.q;
    const bd = new Builder(THREE, q);
    const A = AILE;
    const osCol = (P, k) => {
      let c = mixc(PAL.os, PAL.osClair, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 601) * 0.5);
      c = mixc(c, hexc(0x0d0a09), smooth(0.55, 0.75, fbm(P[0] * 60, P[1] * 60, P[2] * 60, 603)) * 0.6);
      return mixc(c, PAL.sangSec, (k || 0) * 0.5);
    };
    const fissOs = (P) => { const v = Math.abs(fbm(P[0] * 40, P[1] * 40, P[2] * 40, 605) - 0.5); return 1 - smooth(0.0, 0.035, v); };
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const mir = sx < 0;
      // segment osseux : nœuds aux articulations, bosses, griffe au bout si r1 = 0
      const os = (p0, p1, r0, r1, wFn, knot0, knot1, seg) => {
        const L = vlen(vsub(p1, p0));
        const rings = [
          { s: -r0 * 0.6, w: r0 * 0.6 }, { s: 0, w: r0 * (knot0 || 1.25) }, { s: L * 0.12, w: r0 * 0.95 }, { s: L * 0.5, w: lerp(r0, Math.max(r1, r0 * 0.25), 0.5) * 0.78 },
          { s: L * 0.85, w: Math.max(r1, r0 * 0.2) * (r1 > 0 ? 0.95 : 0.8) }, { s: L, w: r1 > 0 ? r1 * (knot1 || 1.2) : r0 * 0.05 }
        ];
        if (r1 > 0) rings.push({ s: L + r1 * 0.6, w: r1 * 0.55 });
        bd.loft('aileOs', {
          a: p0, b: p1, front: [0, 0, 1], mirror: mir, seg: Math.max(5, (seg || 8) - 1), step: Math.max(0.035, L / 7), s0: rings[0].s, s1: rings[rings.length - 1].s, cap0: true, cap1: true, rings: rings,
          displace: (P, s, ang, r, radial) => radialD(radial, (fbm(P[0] * 25, P[1] * 25, P[2] * 25, 607) - 0.5) * r0 * 0.5 + r0 * 0.25 * Math.max(0, Math.sin(s * 37 + ang * 2) - 0.6)),
          weights: (s, ang, P) => wFn(s / L),
          color: (P) => osCol(P), extra: (P) => [0, 0, fissOs(mir ? miroir(P) : P)]
        });
      };
      const W1 = (n) => () => [[I[n + S], 1]];
      const W2 = (n0, n1, t0) => (t) => { const k = smooth(t0 - 0.06, t0 + 0.06, t); return [[I[n0 + S], 1 - k], [I[n1 + S], k]]; };
      os(A.R0, A.S1, 0.042, 0.038, W1('aileRac'), 1.0, 1.3, 8);
      os(A.S1, A.E, 0.04, 0.031, W2('aileRac', 'aileHum', 0.02), 1.35, 1.45, 9);
      os(A.E, A.Wr, 0.031, 0.022, W2('aileHum', 'aileAvb', 0.02), 1.3, 1.6, 8);
      // éperon osseux au coude, griffe du pouce
      os(A.E, vadd(A.E, vscale(vnorm(vsub(A.E, A.Wr)), 0.16)).map((v, i) => v + (i === 1 ? 0.05 : 0)), 0.024, 0, W1('aileAvb'), 1.2, 0, 6);
      os(A.Wr, A.pouce.tip, 0.02, 0, W1('ailePou'), 1.4, 0, 6);
      A.doigts.forEach((d, i) => {
        const n = 'aileD' + (i + 1);
        os(A.Wr, d.mid, 0.02 - i * 0.0015, 0.0145 - i * 0.001, W2('aileMain', n + 'a', 0.04), 1.5, 1.35, 7);
        os(d.mid, d.tip, 0.0145 - i * 0.001, 0, W1(n + 'b'), 1.3, 0, 6);
      });
      // membranes : secteurs entre rayons partant du poignet (bord d'attaque, doigts), puis plagiopatagium
      const rayon = (pts) => {
        const L = [0];
        for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + vlen(vsub(pts[i], pts[i - 1])));
        const T = L[L.length - 1];
        return { pts: pts, L: L, T: T, at: (s) => { const d = clamp(s, 0, 1) * T; let i = 1; while (i < pts.length - 1 && L[i] < d) i++; const t = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return vlerp(pts[i - 1], pts[i], clamp(t, 0, 1)); } };
      };
      const rays = [rayon([A.Wr, A.E, A.S1])].concat(A.doigts.map((d) => rayon([A.Wr, d.mid, d.tip])));
      const wRay = (k, s) => {
        if (k === 0) { const j = rays[0].L[1] / rays[0].T; const t = smooth(j - 0.05, j + 0.05, s); return [[I['aileAvb' + S], 1 - t], [I['aileHum' + S], t]]; }
        const j = rays[k].L[1] / rays[k].T, n = 'aileD' + k;
        const a = smooth(0.0, 0.12, s), b = smooth(j - 0.05, j + 0.05, s);
        return [[I['aileMain' + S], 1 - a], [I[n + 'a' + S], a * (1 - b)], [I[n + 'b' + S], a * b]];
      };
      const memCol = (P) => mixc(PAL.membrane, hexc(0x2a0806), fbm(P[0] * 9, P[1] * 9, P[2] * 9, 611) * 0.8);
      const secteur = (k0, k1, creux, ns, nt) => {
        const pos = [], ix = [], wts = [], ex = [];
        for (let j = 0; j <= nt; j++) {
          const t = j / nt, smax = 1 - creux * Math.sin(Math.PI * t);
          for (let i = 0; i <= ns; i++) {
            const s = i / ns * smax;
            const p = vlerp(rays[k0].at(s), rays[k1].at(s), t);
            const bow = 0.02 * Math.sin(Math.PI * t) * smooth(0, 0.3, s);   // légère poche de la membrane
            const pp = vadd(p, vscale(A.n, -bow));
            pos.push(pp);
            const w = wRay(k0, s).map(([b, x]) => [b, x * (1 - t)]).concat(wRay(k1, s).map(([b, x]) => [b, x * t]));
            wts.push(w);
            ex.push([clamp(Math.min(t, 1 - t) * 2.2, 0, 1) * smooth(0.0, 0.15, s), clamp((smax - s) / 0.14, 0, 1), 0]);
          }
        }
        for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) { const a = j * (ns + 1) + i, b = a + 1, c = a + ns + 2, d = a + ns + 1; ix.push(a, b, c, a, c, d); }
        poserMembrane(pos, ix, wts, ex);
      };
      const poserMembrane = (pos, ix, wts, ex) => {
        const g = new THREE.BufferGeometry();
        const arr = [];
        for (const p of pos) { const pp = mir ? miroir(p) : p; arr.push(pp[0], pp[1], pp[2]); }
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        if (mir) for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
        g.setIndex(ix); g.computeVertexNormals();
        let vi = 0;
        bd.cur = () => ex[vi] || [0, 0, 0];
        bd.rigid('membrane', g, new THREE.Matrix4(), () => wts[vi++] || [[I['aileMain' + S], 1]], (P) => memCol(P));
        bd.cur = [0, 0, 0];
      };
      const ns = bd.n(12, 6), nt = bd.n(7, 4);
      secteur(0, 1, 0.42, ns, nt);
      secteur(1, 2, 0.24, ns, nt);
      secteur(2, 3, 0.26, ns, nt);
      secteur(3, 4, 0.28, ns, nt);
      // plagiopatagium : carreau de Coons entre le doigt 4, le bras, le dos et le bord de fuite
      {
        const top = rayon([A.Wr, A.E, A.S1, A.R0]), left = rays[4], right = rayon([A.R0].concat(A.corps));
        const P00 = A.Wr, P10 = A.R0, P01 = A.doigts[3].tip, P11 = A.corps[A.corps.length - 1];
        const bot = (a) => { const p = vlerp(P01, P11, a); return vadd(p, vscale(vnorm(vsub(A.Wr, p)), 0.3 * Math.sin(Math.PI * a))); };
        const na = bd.n(11, 6), nb = bd.n(8, 4);
        const pos = [], ix = [], wts = [], ex = [];
        for (let j = 0; j <= nb; j++) {
          const b = j / nb;
          for (let i = 0; i <= na; i++) {
            const a = i / na;
            const ct = top.at(a), cb = bot(a), cl = left.at(b), cr = right.at(b);
            const p = [0, 1, 2].map((k) => (1 - b) * ct[k] + b * cb[k] + (1 - a) * cl[k] + a * cr[k] - ((1 - a) * (1 - b) * P00[k] + a * (1 - b) * P10[k] + (1 - a) * b * P01[k] + a * b * P11[k]));
            pos.push(p);
            const wb = smooth(1.36, 1.1, p[1]);
            const wBody = [[I.chest, 1 - wb], [I.spine, wb]];
            const wTop = a < 0.55 ? [[I['aileAvb' + S], 1]] : [[I['aileHum' + S], smooth(0.95, 0.55, a)], [I['aileRac' + S], smooth(0.55, 0.95, a)]];
            const kT = Math.pow(1 - b, 3), kL = (1 - a) * (1 - kT), kR = a * (1 - kT);
            wts.push(wRay(4, b).map(([bb, x]) => [bb, x * kL]).concat(wBody.map(([bb, x]) => [bb, x * kR])).concat(wTop.map(([bb, x]) => [bb, x * kT])));
            ex.push([clamp(Math.min(a, 1 - a) * 2 * Math.min(1, b * 3), 0, 1), clamp((1 - b) / 0.18, 0, 1), 0]);
          }
        }
        for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) { const a = j * (na + 1) + i, b = a + 1, c = a + na + 2, d = a + na + 1; ix.push(a, c, b, a, d, c); }
        poserMembrane(pos, ix, wts, ex);
      }
    }
    // matériaux : os (fissures de braise), membrane (shader dédié)
    const rev = parseInt(THREE.REVISION, 10);
    const UA = {
      uTemps: C.U.uTemps, uDissol: { value: 0 }, uDissolCoul: { value: new THREE.Color(1.0, 0.3, 0.05) }, uPuis: { value: 0 }, uSceauCoul: C.U.uSceauCoul,
      uVeine: { value: 0.4 }, uVeineCoul: { value: new THREE.Color(1.6, 0.12, 0.03) }, uDoublure: C.U.uDoublure, uFlotAmp: { value: 0.02 }, uForm: { value: 1 }, uFlash: C.U.uFlash
    };
    const matOs = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.72, metalness: 0.05 });
    const matMem = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    matMem.envMapIntensity = 0.25;
    if (rev < 129) { matOs.skinning = true; matMem.skinning = true; }
    patchBoss(THREE, matOs, { LUEUR: true }, UA, 'aileOs');
    patchBoss(THREE, matMem, { FLOT: true, MEMBRANE: true }, UA, 'membrane');
    const MAT = { aileOs: matOs, membrane: matMem };
    const meshes = bd.build(MAT, C.linear);
    let tris = 0;
    for (const k in meshes) {
      const m = meshes[k];
      m.castShadow = !!C.opts.ombres; m.receiveShadow = false;
      m.customDepthMaterial = depthBoss(THREE, { FLOT: k === 'membrane' }, UA, 'aile-' + k);
      m.visible = false;
      C.corps.add(m);
      m.bind(C.skeleton, m.matrixWorld.clone().identity().copy(C.corps.matrixWorld));
      tris += m.geometry.index.count / 3;
    }
    // ---- animation des articulations (axes de la pose de référence ; même convention que le squelette)
    const axes = {};
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const u = sx > 0 ? A.u : miroir(A.u);
      const n = vnorm(vcross(u, A.v));
      axes[S] = { n: new THREE.Vector3(n[0], n[1], n[2]), y: new THREE.Vector3(0, 1, 0), sx: sx };
    }
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const poser = (bone, S, plan, bal) => {
      const X = axes[S];
      qa.setFromAxisAngle(X.y, bal * X.sx); qb.setFromAxisAngle(X.n, plan); qa.multiply(qb);
      bone.quaternion.copy(qa);
    };
    const st = { phase: 0, vis: false };
    // os des ailes par côté (évite de composer les noms à chaque image) et pose repliée courante
    const OS_AILE = {};
    for (const S of ['L', 'R']) {
      OS_AILE[S] = { rac: B['aileRac' + S], hum: B['aileHum' + S], avb: B['aileAvb' + S], main: B['aileMain' + S], pou: B['ailePou' + S],
        da: [1, 2, 3, 4].map((i) => B['aileD' + i + 'a' + S]), db: [1, 2, 3, 4].map((i) => B['aileD' + i + 'b' + S]) };
    }
    const RP = [0, 0];
    const replier = (C0, F0, ouv, fl) => { RP[0] = lerp(lerp(C0[0], 0, ouv), F0[0], fl); RP[1] = lerp(lerp(C0[1], 0, ouv), F0[1], fl); };
    function maj(ailes, ctx) {
      const etat = ailes && ailes.etat ? ailes.etat : 'aucune', t = clamp(ailes && ailes.t != null ? ailes.t : 1, 0, 1);
      const vis = etat !== 'aucune' && ctx.dissol < 0.999;
      if (vis !== st.vis) { for (const k in meshes) meshes[k].visible = vis; st.vis = vis; }
      if (!vis) { B.aileRacL.scale.setScalar(0.001); B.aileRacR.scale.setScalar(0.001); return; }
      const a = ctx.A, o0 = ctx.OFF.ail;
      let ouv = a[o0], amp = a[o0 + 1], fr = a[o0 + 2], fl = a[o0 + 3], rel = a[o0 + 4];
      let g = 1, form = 1, dis = 0, glow = 0.35 + 0.6 * ctx.puis;
      if (etat === 'apparition') {
        g = smooth(0.0, 0.42, t);
        const k = clamp((t - 0.42) / 0.38, 0, 1);
        ouv = k <= 0 ? 0 : Math.min(ouv, ease.b(k));
        form = smooth(0.32, 0.92, t);
        amp *= smooth(0.8, 1.0, t);
        glow += 1.6 * gauss(t, 0.82, 0.08) + 0.6 * (1 - t);
      } else if (etat === 'disparition') {
        dis = smooth(0.0, 0.95, t);
        ouv *= 1 - 0.35 * t; rel -= 0.35 * t; amp *= 1 - t;
        glow += 0.8 * t;
      }
      dis = Math.max(dis, ctx.dissol);
      UA.uDissol.value = dis; UA.uForm.value = form; UA.uVeine.value = glow;
      UA.uDissolCoul.value.copy(C.U.uDissolCoul.value);
      UA.uFlotAmp.value = 0.012 + 0.02 * (1 - fl);
      st.phase += TAU * fr * ctx.dt;
      const T = ctx.temps;
      for (let si = 0; si < 2; si++) {
        const S = si === 0 ? 'L' : 'R', OS = OS_AILE[S];
        const ph = st.phase + (si === 1 ? 0.05 : 0), jo = si === 1 ? 9 : 0;
        const fH = amp * Math.sin(ph), fA = amp * Math.sin(ph - 0.7), fD = amp * Math.sin(ph - 1.3);
        OS.rac.scale.setScalar(Math.max(0.001, g));
        OS.rac.quaternion.setFromAxisAngle(axes[S].n, rel * 0.4);
        // repliement : pose ouverte → fermée (ouv) puis → flèche du piqué (fl), sans allocation
        replier(AILE_FERMEE.hum, AILE_FLECHE.hum, ouv, fl);
        poser(OS.hum, S, RP[0] + fH + rel, RP[1] - fH * 0.35);
        replier(AILE_FERMEE.avb, AILE_FLECHE.avb, ouv, fl);
        poser(OS.avb, S, RP[0] + fA * 0.4 + bruit1(T * 5 + 1.7 + jo, 621) * 0.025, RP[1]);
        OS.main.quaternion.identity();
        for (let i = 0; i < 4; i++) {
          replier(AILE_FERMEE.d[i], AILE_FLECHE.d[i], ouv, fl);
          poser(OS.da[i], S, RP[0] + fD * 0.3 + bruit1(T * 5 + (2 + i) * 1.7 + jo, 621) * 0.025, RP[1]);
          OS.db[i].quaternion.setFromAxisAngle(axes[S].n, -fD * 0.15 * (1 - fl) + bruit1(T * 5 + (6 + i) * 1.7 + jo, 621) * 0.025 - 0.12 * (1 - ouv));
        }
        replier(AILE_FERMEE.pou, AILE_FLECHE.pou, ouv, fl);
        poser(OS.pou, S, RP[0], RP[1]);
      }
    }
    return {
      maj: maj, meshes: meshes, materiaux: MAT, uniformes: UA, triangles: Math.round(tris), reinitialiser: () => { st.phase = 0; },
      dispose: () => { for (const k in meshes) { meshes[k].geometry.dispose(); if (meshes[k].customDepthMaterial) meshes[k].customDepthMaterial.dispose(); } matOs.dispose(); matMem.dispose(); }
    };
  }

  // ============================================================================================
  // Lames du Pacte (phase 5) — création originale : une SEULE lame très courbe et asymétrique, tenue par une
  // extrémité (aucune lame de l'autre côté de la poignée, pas de double croissant), en sang coagulé translucide ;
  // tranchant extérieur fin comme du verre, bord intérieur hérissé d'éclats d'os en forme de dents ; garde
  // d'éclats d'os liés par des tendons, avec un cœur noirâtre qui bat ; poignée de vertèbres soudées gainée de
  // tendons, éperon d'os et bague de fer au pommeau ; veines qui battent (émissif), fumée rouge, gouttes de sang
  // qui tombent et s'écrasent au sol, traînée lumineuse pendant les coups ; frémissement propre à chaque lame.
  // États : formation (le sang coule des mains puis se fige depuis la poignée, première torsion),
  // actives, destruction (fissures incandescentes puis effritement en sang).
  // Repère d'une lame : origine au centre de la poignée, +Y = côté du pouce (grand arc), +Z = tranchant
  // (direction de l'avant-bras quand la main est ouverte), X = épaisseur.
  // ============================================================================================
  const LAME_ARC = { cz: -0.52, cy: 0.44, r: 0.62, a0: -28 * Math.PI / 180, a1: 70 * Math.PI / 180 };
  const LAME_CROC = { cz: 0.17, cy: -0.12, r: 0.19, a0: Math.PI, a1: Math.PI + 125 * Math.PI / 180 };
  // bord extérieur, bord intérieur et épaisseur d'une partie de la lame, s ∈ [0, 1] depuis la poignée
  function profilLame(P, s, largeurMax, base, epais) {
    const a = lerp(P.a0, P.a1, s), oz = P.cz + P.r * Math.cos(a), oy = P.cy + P.r * Math.sin(a);
    const w = largeurMax * Math.pow(Math.max(0, Math.sin(Math.PI * (base + (1 - base) * s))), 0.8);
    const k = w / P.r;
    return { o: [oz, oy], n: [oz + (P.cz - oz) * k, oy + (P.cy - oy) * k], w: w, t: lerp(epais, 0.0035, Math.pow(s, 0.8)), a: a };
  }
  function pointLameBrut(part, s, w, side) {
    const P = part === 0 ? LAME_ARC : LAME_CROC;
    const pr = part === 0 ? profilLame(P, s, 0.155, 0.12, 0.017) : profilLame(P, s, 0.075, 0.18, 0.013);
    const z = lerp(pr.o[0], pr.n[0], w), y = lerp(pr.o[1], pr.n[1], w);
    const t = pr.t * Math.pow(w, 0.55) * (1 + 0.15 * Math.sin(s * 40 + w * 6) * w);
    return [side * t * 0.5, y, z];
  }
  // le grand arc sort de la bague en s'inclinant de 70° vers le tranchant (axe de l'avant-bras) : la lame prolonge
  // le bras (traîne derrière en traque, se croise au-dessus de la tête) tandis que la poignée reste dans le poing
  const LAME_INCL = 70 * Math.PI / 180, LAME_PIVOT = 0.128;
  const inclinerArc = (p) => { const dy = p[1] - LAME_PIVOT, dz = p[2], c = Math.cos(LAME_INCL), sn = Math.sin(LAME_INCL); return [p[0], LAME_PIVOT - dz * sn + dy * c, dz * c + dy * sn]; };
  const inclinerDir = (d) => { const c = Math.cos(LAME_INCL), sn = Math.sin(LAME_INCL); return [d[0], -d[2] * sn + d[1] * c, d[2] * c + d[1] * sn]; };
  function pointLame(part, s, w, side) {
    const p = pointLameBrut(part, s, w, side);
    return part === 0 ? inclinerArc(p) : p;
  }

  // ---------------------------------------------------------------- palettes (v2.2, API.md §16.6)
  // rouge = couleurs d'origine (verre de sang coagulé) ; bleu = « bleu très clair » (choix d'Anthony, palier 0) : verre
  // glacé translucide, veines et lueur cyan pâle presque blanches, cœur bleu clair ; vert = vert spectral (illusions).
  // verre / coeur / tendon : couleurs de sommets (hex sRGB) ; bord : renfort du tranchant par canal ; coeurVeine : veines
  // du cœur (ajout) ; veine : émission des veines, du front de formation et des fissures (uVeineCoul, linéaire HDR) ;
  // reg : [lueur de base, reflet de bord, force des veines] (uLameReg) ; dissol : dissolution du corps quand les lames
  // sont là (apparitions, téléportations : brume de sang à l'origine) ; aura : halo de l'aura dans ces mêmes moments ;
  // trainee, fumee, goutte, eclab, reflet : particules (linéaire, comme à l'origine) ; opacite, rugosite, env : verre.
  // Les os de la poignée et les dents d'os ne changent pas ; les tendons de la poignée suivent la teinte.
  const PALETTES_LAMES = {
    rouge: { verre: [0x3a0606, 0x240303], bord: [1, 0, 0], coeur: [0x2e0a08, 0x1a0504], coeurVeine: [0.12, 0, 0], coeurEmis: 0xff2410,
      tendon: [0x5a1812, 0x3e100c, 0x2a0a08], veine: [1.5, 0.05, 0.02], reg: [0, 0.1, 1], dissolLame: [1.2, 0.03, 0.01], dissol: [0.9, 0.02, 0.01],
      aura: [0.8, 0.03, 0.02], trainee: [1.0, 0.12, 0.05], fumee: [0.22, 0.015, 0.01], goutte: [0.16, 0.004, 0.004], eclab: [0.11, 0.003, 0.003],
      reflet: [0.12, 0.02, 0.02], opacite: 0.93, rugosite: 0.14, env: 0.8 },
    bleu: { verre: [0x4f8fbf, 0x2f6a9c], bord: [0.3, 0.55, 0.85], coeur: [0x3a6488, 0x24425e], coeurVeine: [0.1, 0.16, 0.2], coeurEmis: 0xa8e2ff,
      tendon: [0x5d7f98, 0x45627a, 0x2e4558], veine: [0.78, 1.12, 1.4], reg: [0.035, 0.24, 1.0], dissolLame: [0.6, 0.9, 1.15], dissol: [0.55, 0.85, 1.1],
      aura: [0.3, 0.52, 0.75], trainee: [0.36, 0.56, 0.72], fumee: [0.06, 0.1, 0.14], goutte: [0.42, 0.62, 0.8], eclab: [0.28, 0.42, 0.56],
      reflet: [0.3, 0.38, 0.42], opacite: 0.8, rugosite: 0.08, env: 1.05 },
    vert: { verre: [0x0f3a1a, 0x08240f], bord: [0.25, 1, 0.35], coeur: [0x103a18, 0x08200c], coeurVeine: [0.03, 0.12, 0.04], coeurEmis: 0x44ff70,
      tendon: [0x24502c, 0x1a3a20, 0x102814], veine: [0.3, 1.35, 0.42], reg: [0.03, 0.18, 1], dissolLame: [0.3, 1.2, 0.4], dissol: [0.25, 1.0, 0.35],
      aura: [0.1, 0.55, 0.16], trainee: [0.26, 0.85, 0.34], fumee: [0.03, 0.15, 0.05], goutte: [0.03, 0.2, 0.06], eclab: [0.02, 0.13, 0.04],
      reflet: [0.05, 0.2, 0.08], opacite: 0.88, rugosite: 0.12, env: 0.8 }
  };
  const NOMS_PALETTES = ['rouge', 'bleu', 'vert'];
  const nomPalette = (n) => (n && PALETTES_LAMES[n] ? n : 'rouge');

  function creerLames(THREE, C) {
    const q = C.q, rev = parseInt(THREE.REVISION, 10);
    const lin = C.linear;
    const cl = (h) => { const c = hexc(h); return lin ? c.map(toLin) : c; };
    const PL = PALETTES_LAMES;
    const R = rng(1771);
    // ---------------------------------------------------------------- géométrie de la lame (+ dents d'os)
    // couleurs de sommets calculées pour chaque palette (cf : couleur fixe, ou fonction de la palette)
    const pos = [], cols = { rouge: [], bleu: [], vert: [] }, ex = [], idx = [];
    const add = (p, cf, e) => {
      pos.push(p[0], p[1], p[2]);
      for (const n of NOMS_PALETTES) { const c = typeof cf === 'function' ? cf(PL[n]) : cf; cols[n].push(c[0], c[1], c[2]); }
      ex.push(e[0], e[1], e[2]); return pos.length / 3 - 1;
    };
    const sangCol = (s, w, k) => { const v = vnoise(s * 30, w * 5, 1, 701); return (P) => cl(v > 0.6 ? P.verre[0] : P.verre[1]).map((x, i) => x * (0.8 + 0.4 * v) * (1 + 0.4 * (1 - w) * P.bord[i]) * (k || 1)); };
    const longueurs = [1.0, 0.33];
    for (let part = 0; part < 1; part++) {          // une seule lame (l'ancien crochet inférieur est supprimé)
      const ns = Math.max(8, Math.round((part === 0 ? 24 : 10) * q)), nw = Math.max(3, Math.round(4 * q));
      for (const side of [1, -1]) {
        const base = pos.length / 3;
        for (let i = 0; i <= ns; i++) for (let j = 0; j <= nw; j++) {
          const s = i / ns, w = j / nw;
          add(pointLame(part, s, w, side), sangCol(s, w), [part === 0 ? s : s * longueurs[1], w, 0]);
        }
        for (let i = 0; i < ns; i++) for (let j = 0; j < nw; j++) {
          const a = base + i * (nw + 1) + j, b = a + 1, c = a + nw + 2, d = a + nw + 1;
          if (side > 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
        }
      }
      // dos de la lame (bord intérieur épais) et base
      const b0 = pos.length / 3;
      for (let i = 0; i <= ns; i++) { const s = i / ns; for (const side of [1, -1]) add(pointLame(part, s, 1, side), sangCol(s, 1, 0.8), [part === 0 ? s : s * longueurs[1], 1, 0]); }
      for (let i = 0; i < ns; i++) { const a = b0 + i * 2, b = a + 1, c = a + 3, d = a + 2; idx.push(a, d, c, a, c, b); }
      const b1 = pos.length / 3;
      for (let j = 0; j <= nw; j++) for (const side of [1, -1]) add(pointLame(part, 0, j / nw, side), sangCol(0, j / nw), [0, j / nw, 0]);
      for (let j = 0; j < nw; j++) { const a = b1 + j * 2, b = a + 1, c = a + 3, d = a + 2; idx.push(a, c, d, a, b, c); }
      // dents d'os sur le bord intérieur, inclinées vers la pointe
      const nd = part === 0 ? Math.max(6, Math.round(11 * q)) : 4;
      for (let k = 0; k < nd; k++) {
        const s = (part === 0 ? 0.07 : 0.12) + (part === 0 ? 0.8 : 0.66) * (k + 0.3 * R()) / nd;
        const P = part === 0 ? LAME_ARC : LAME_CROC;
        const b0 = pointLameBrut(part, s, 1, 0), b1 = pointLameBrut(part, Math.min(1, s + 0.02), 1, 0);
        const tg = vnorm(vsub(b1, b0));
        const inw = vnorm([0, P.cy - b0[1], P.cz - b0[2]]);
        let dir = vnorm(vadd(vscale(inw, 0.8), vscale(tg, 0.45)));
        const p0 = part === 0 ? inclinerArc(b0) : b0;
        if (part === 0) dir = inclinerDir(dir);
        const h = (0.022 + 0.022 * R()) * (1 - 0.5 * s) * (part === 0 ? 1 : 0.8), r = 0.0075 + 0.003 * R();
        const g = new THREE.ConeGeometry(r, h, 5, 2);
        g.translate(0, h / 2, 0);
        const gp = g.attributes.position;
        for (let v = 0; v < gp.count; v++) { const yy = gp.getY(v); gp.setZ(v, gp.getZ(v) + 0.25 * (yy / h) * (yy / h) * h); }   // légère courbure
        g.computeVertexNormals();
        const M = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir[0], dir[1], dir[2])));
        M.setPosition(p0[0], p0[1], p0[2]);
        const gi = g.index.array, ga = g.attributes.position, base = pos.length / 3;
        const vv = new THREE.Vector3();
        for (let v = 0; v < ga.count; v++) {
          vv.fromBufferAttribute(ga, v).applyMatrix4(M);
          const tint = vnoise(vv.x * 300, vv.y * 300, vv.z * 300, 703);
          add([vv.x, vv.y, vv.z], cl(tint > 0.5 ? 0xb3a382 : 0x7d6b4c), [part === 0 ? s : s * longueurs[1], 1, 1]);
        }
        for (let v = 0; v < gi.length; v++) idx.push(base + gi[v]);
        g.dispose();
      }
    }
    const geoLame = new THREE.BufferGeometry();
    geoLame.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geoLame.setAttribute('color', new THREE.Float32BufferAttribute(cols.rouge, 3));
    const TAB_LAME = {};
    for (const n of NOMS_PALETTES) TAB_LAME[n] = new Float32Array(cols[n]);
    geoLame.setAttribute('aBoss', new THREE.Float32BufferAttribute(ex, 3));
    geoLame.setIndex(idx);
    geoLame.computeVertexNormals();
    geoLame.computeBoundingSphere();

    // ---------------------------------------------------------------- poignée : vertèbres, barbelé rouillé, bague de fer
    const gp = [], gcs = { rouge: [], bleu: [], vert: [] }, gi = [];
    const fusion = (g, M, colFn) => {   // colFn(P, palette) : seuls les tendons dépendent de la palette
      const p = g.attributes.position, n = g.attributes.normal, base = gp.length / 6;
      const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(M);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(M); nv.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        gp.push(v.x, v.y, v.z, nv.x, nv.y, nv.z);
        for (const nm2 of NOMS_PALETTES) { const c = colFn([v.x, v.y, v.z], PL[nm2]); gcs[nm2].push(c[0], c[1], c[2]); }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) gi.push(base + g.index.getX(i)); else for (let i = 0; i < p.count; i++) gi.push(base + i);
      g.dispose();
    };
    const osC = (P) => cl(vnoise(P[0] * 200, P[1] * 200, P[2] * 200, 707) > 0.55 ? 0xa8977a : 0x6e5d45);
    const rouille = (P) => { const v = vnoise(P[0] * 400, P[1] * 400, P[2] * 400, 709); return cl(v > 0.6 ? 0x7a4320 : v > 0.3 ? 0x4a2a16 : 0x2a1a12); };
    const nv = 5, seg = Math.max(5, Math.round(6 * q));
    for (let k = 0; k < nv; k++) {
      const y = -0.1 + k * 0.05;
      const body = new THREE.CylinderGeometry(0.0185, 0.0185, 0.034, seg, 2);
      const bp = body.attributes.position;
      for (let i = 0; i < bp.count; i++) { const yy = bp.getY(i); const s = 1 - 0.16 * (1 - Math.pow(yy / 0.017, 2)); bp.setX(i, bp.getX(i) * s); bp.setZ(i, bp.getZ(i) * s * 0.9); }
      body.computeVertexNormals();
      fusion(body, new THREE.Matrix4().makeTranslation(0, y, 0), osC);
      const disc = new THREE.CylinderGeometry(0.0155, 0.0155, 0.016, seg, 1);
      fusion(disc, new THREE.Matrix4().makeTranslation(0, y + 0.025, 0), () => cl(0x2a0c08));
      const spin = new THREE.ConeGeometry(0.0075, 0.038, 5);
      fusion(spin, new THREE.Matrix4().makeRotationX(-Math.PI / 2 - 0.35).setPosition(0, y - 0.004, -0.03), osC);
      for (const sx of [1, -1]) {
        const tr = new THREE.ConeGeometry(0.0055, 0.024, 4);
        fusion(tr, new THREE.Matrix4().makeRotationZ(-sx * Math.PI / 2 + sx * 0.25).setPosition(sx * 0.024, y, -0.004), osC);
      }
    }
    {
      // tendons qui gainent la poignée (trois brins en spirale, rouge sombre luisant)
      const tendon = (P, pal) => { const v = vnoise(P[0] * 300, P[1] * 300, P[2] * 300, 711); return cl(v > 0.55 ? pal.tendon[0] : v > 0.25 ? pal.tendon[1] : pal.tendon[2]); };
      const n = Math.max(12, Math.round(20 * q));
      for (let b = 0; b < 3; b++) {
        const pts = [];
        for (let i = 0; i <= n; i++) { const t = i / n, a = t * 2.6 * TAU + b * TAU / 3; const r = 0.0215 + 0.002 * Math.sin(t * 40 + b); pts.push(new THREE.Vector3(Math.cos(a) * r, -0.112 + 0.235 * t, Math.sin(a) * r * 0.95)); }
        fusion(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.0034, 4, false), new THREE.Matrix4(), tendon);
      }
      // garde : éclats d'os en couronne inclinés vers l'arrière, liés par des tendons
      const R2 = rng(2207);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + 0.3 * R2(), h = 0.05 + 0.04 * R2();
        const g = new THREE.ConeGeometry(0.0085, h, 5);
        g.translate(0, h / 2, 0);
        const dir = new THREE.Vector3(Math.cos(a) * 0.85, -0.55 - 0.2 * R2(), Math.sin(a) * 0.85).normalize();
        const M = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        M.setPosition(Math.cos(a) * 0.022, 0.118, Math.sin(a) * 0.022);
        fusion(g, M, osC);
        const pts = [new THREE.Vector3(Math.cos(a) * 0.02, 0.112, Math.sin(a) * 0.02), new THREE.Vector3(Math.cos(a + 0.6) * 0.03, 0.1, Math.sin(a + 0.6) * 0.03),
          new THREE.Vector3(Math.cos(a + 1.1) * 0.024, 0.085, Math.sin(a + 1.1) * 0.024)];
        fusion(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.0022, 3, false), new THREE.Matrix4(), tendon);
      }
      // collier de la garde (os poreux)
      const col = new THREE.TorusGeometry(0.026, 0.0085, 5, Math.max(9, Math.round(12 * q)));
      fusion(col, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.124, -0.002), osC);
      // pommeau : éperon d'os recourbé et bague de fer
      const ep = new THREE.ConeGeometry(0.011, 0.07, 6, 2);
      ep.translate(0, 0.035, 0);
      const epp = ep.attributes.position;
      for (let v = 0; v < epp.count; v++) { const yy = epp.getY(v); epp.setZ(v, epp.getZ(v) + 0.35 * (yy / 0.07) * (yy / 0.07) * 0.07); }
      ep.computeVertexNormals();
      fusion(ep, new THREE.Matrix4().makeRotationX(Math.PI).setPosition(0, -0.128, 0.0), osC);
      const bague2 = new THREE.TorusGeometry(0.021, 0.0045, 4, Math.max(8, Math.round(10 * q)));
      fusion(bague2, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, -0.122, 0.0), () => cl(0x3a2a20));
    }
    const geoPoi = new THREE.BufferGeometry();
    const P6 = new Float32Array(gp);
    geoPoi.setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(P6, 6), 3, 0));
    geoPoi.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(P6, 6), 3, 3));
    geoPoi.setAttribute('color', new THREE.Float32BufferAttribute(gcs.rouge, 3));
    geoPoi.setIndex(gi);
    geoPoi.computeBoundingSphere();
    const TAB_POI = {};
    for (const n of NOMS_PALETTES) TAB_POI[n] = new Float32Array(gcs[n]);

    // ---------------------------------------------------------------- matériaux
    // uniformes propres à cette instance (uTemps, uSceauCoul, uDoublure et uFlash sont ceux du corps de la même instance)
    const UL = {
      uTemps: C.U.uTemps, uDissol: { value: 0 }, uDissolCoul: { value: new THREE.Color(1.2, 0.03, 0.01) }, uPuis: { value: 0 }, uSceauCoul: C.U.uSceauCoul,
      uVeine: { value: 0.5 }, uVeineCoul: { value: new THREE.Color(1.5, 0.05, 0.02) }, uDoublure: C.U.uDoublure, uFlotAmp: { value: 0 },
      uForm: { value: 1 }, uFiss: { value: 0 }, uEffrit: { value: 0 }, uPouls: { value: 0 }, uFlash: C.U.uFlash,
      uLameReg: { value: new THREE.Vector3(0, 0.1, 1) }
    };
    const matLame = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.14, metalness: 0.0, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
    matLame.envMapIntensity = 0.8;
    patchBoss(THREE, matLame, { LAME: true }, UL, 'lame');
    const matPoi = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, metalness: 0.15 });
    patchBoss(THREE, matPoi, { LAMEPOI: true }, UL, 'poignee');
    // chaque lame bat à son propre rythme : seconde copie du matériau avec sa propre pulsation
    const UL2 = Object.assign({}, UL, { uPouls: { value: 0 } });
    const matLame2 = matLame.clone();
    patchBoss(THREE, matLame2, { LAME: true }, UL2, 'lame');
    // cœur de la garde : masse organique noirâtre veinée de rouge, qui bat (échelle et émission)
    // deux lobes inégaux, bosselé, un moignon de vaisseau ; couleur noirâtre, veines (aBoss.z) seules lumineuses
    const geoCoeur = new THREE.SphereGeometry(1, Math.max(12, Math.round(16 * q)), Math.max(9, Math.round(12 * q)));
    const TAB_COEUR = {};
    {
      const pc = geoCoeur.attributes.position, nC = pc.count;
      const eC = new Float32Array(nC * 3);
      for (const n of NOMS_PALETTES) TAB_COEUR[n] = new Float32Array(nC * 3);
      for (let i = 0; i < nC; i++) {
        const x = pc.getX(i), y = pc.getY(i), z = pc.getZ(i);
        // lobes : renflement à gauche en haut, pointe en bas décalée ; bosses irrégulières
        let k = 1 + 0.22 * Math.exp(-((x - 0.45) * (x - 0.45) + (y - 0.35) * (y - 0.35)) * 3) + 0.16 * Math.exp(-((x + 0.5) * (x + 0.5) + (y - 0.2) * (y - 0.2)) * 4);
        k += 0.09 * (vnoise(x * 3.2, y * 3.2, z * 3.2, 731) - 0.5) + 0.05 * (vnoise(x * 7, y * 7, z * 7, 733) - 0.5);
        k *= 1 - 0.32 * smooth(-0.2, -1, y) * (1 - Math.abs(x) * 0.4);
        // moignon de vaisseau en haut
        k += 0.35 * Math.exp(-((x + 0.15) * (x + 0.15) + z * z) * 14) * smooth(0.6, 1, y);
        pc.setXYZ(i, x * k * 0.024, (y * k + 0.08) * 0.028, z * k * 0.019);
        const v1 = 1 - smooth(0, 0.07, Math.abs(vnoise(x * 2.4 + 3, y * 2.4, z * 2.4, 735) - 0.5));
        const v2 = 1 - smooth(0, 0.05, Math.abs(vnoise(x * 5 + 1, y * 5, z * 5, 737) - 0.5));
        const ve = Math.max(v1, v2 * 0.7);
        const clair = vnoise(x * 6, y * 6, z * 6, 739) > 0.55;
        for (const n of NOMS_PALETTES) {
          const P = PL[n], base = cl(clair ? P.coeur[0] : P.coeur[1]), T = TAB_COEUR[n];
          T[i * 3] = base[0] + ve * P.coeurVeine[0]; T[i * 3 + 1] = base[1] + ve * P.coeurVeine[1]; T[i * 3 + 2] = base[2] + ve * P.coeurVeine[2];
        }
        eC[i * 3] = 1; eC[i * 3 + 1] = 0; eC[i * 3 + 2] = 0.08 + 0.92 * ve;
      }
      geoCoeur.setAttribute('color', new THREE.BufferAttribute(TAB_COEUR.rouge.slice(), 3));
      geoCoeur.setAttribute('aBoss', new THREE.BufferAttribute(eC, 3));
      geoCoeur.computeVertexNormals();
    }
    const matCoeur = [UL, UL2].map((u, i) => patchBoss(THREE, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0,
      emissive: new THREE.Color().fromArray(cl(0xff2410)), emissiveIntensity: 1 }), { EMISMASQUE: true }, u, 'coeur' + i));

    // ---------------------------------------------------------------- deux lames attachées aux mains
    const lames = [];
    const NT = 14;                                   // longueur de la traînée (images)
    let tris = 0;
    for (const [S, G, sx] of [['L', 'G', 1], ['R', 'D', -1]]) {
      const d = [ARM_DIR[0] * sx, ARM_DIR[1], 0], pl = sx > 0 ? PAUME_L : miroir(PAUME_L);
      const racine = new THREE.Object3D(); racine.name = 'lame-' + G;
      const w = C.W['hand' + S];
      const c = vadd(vadd(w, vscale(d, 0.062)), vscale(pl, 0.03));
      racine.position.set(c[0] - w[0], c[1] - w[1], c[2] - w[2] + 0.004);
      const Yb = [0, 0, 1], Zb = d, Xb = vnorm(vcross(Yb, Zb));
      racine.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(Xb[0], Xb[1], Xb[2]), new THREE.Vector3(Yb[0], Yb[1], Yb[2]), new THREE.Vector3(Zb[0], Zb[1], Zb[2])));
      const frem = new THREE.Object3D();
      racine.add(frem);
      const mL = new THREE.Mesh(geoLame, G === 'G' ? matLame : matLame2); mL.castShadow = !!C.opts.ombres; mL.renderOrder = 2;
      const mP = new THREE.Mesh(geoPoi, matPoi); mP.castShadow = !!C.opts.ombres;
      const mC = new THREE.Mesh(geoCoeur, matCoeur[G === 'G' ? 0 : 1]); mC.position.set(0.0, 0.124, 0.03); mC.castShadow = false;
      frem.add(mL); frem.add(mP); frem.add(mC);
      C.B['hand' + S].add(racine);
      racine.visible = false;
      // ancres : garde (lameG / lameD) et pointe de la lame (pointeLameG / pointeLameD)
      const tip = pointLame(0, 1, 0, 0);
      for (const [nom, p] of [['lame' + G, [0, 0.124, 0]], ['pointeLame' + G, tip]]) {
        const anc = C.ancres[nom];
        if (anc.parent) anc.parent.remove(anc);
        anc.position.set(p[0], p[1], p[2]);
        frem.add(anc);
      }
      tris += (geoLame.index.count + geoPoi.index.count + geoCoeur.index.count) / 3;
      const hist = [];
      for (let i = 0; i < NT; i++) hist.push([new THREE.Vector3(), new THREE.Vector3()]);
      lames.push({ S: S, G: G, ancreMain: C.ancres['main' + G], racine: racine, frem: frem, mL: mL, mP: mP, mC: mC, ph: R() * 10, f1: 9 + 4 * R(), f2: 0.35 + 0.2 * R(), per: 0.98 + 0.16 * R(),
        U: G === 'G' ? UL : UL2, prev: new THREE.Vector3(), vit: new THREE.Vector3(), aPrev: false, hist: hist, nHist: 0, iHist: 0 });
    }

    // ---------------------------------------------------------------- particules : gouttes, éclaboussures au sol, traînées, fumée
    const monde = new THREE.Group(); monde.name = 'boss-lames-monde'; monde.matrixAutoUpdate = false;
    C.objet.add(monde);
    // uCoul (et uReflet, reflet des gouttes) : couleur de la palette courante, changée sans recompiler
    const shaderPart = (additif, couleur) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uCoul: { value: new THREE.Color(couleur[0], couleur[1], couleur[2]) }, uReflet: { value: new THREE.Color(0.12, 0.02, 0.02) }, uTemps: C.U.uTemps },
        vertexShader: 'attribute vec2 aUV; attribute float aAlpha; varying vec2 vUV; varying float vA; void main(){ vUV = aUV; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: additif
          ? 'uniform vec3 uCoul; varying vec2 vUV; varying float vA; void main(){ float e = 1.0 - abs(vUV.y * 2.0 - 1.0); float a = vA * e * e; if (a < 0.003) discard; gl_FragColor = vec4(uCoul * a, a); }'
          : 'uniform vec3 uCoul; uniform vec3 uReflet; varying vec2 vUV; varying float vA; void main(){ vec2 c = vUV * 2.0 - 1.0; float r = length(c); float n = sin(atan(c.y, c.x) * 7.0 + vUV.x * 3.0) * 0.08; float a = vA * (1.0 - smoothstep(0.55 + n, 1.0 + n, r)); if (a < 0.02) discard; vec3 col = uCoul * (0.7 + 0.6 * (1.0 - r)) + uReflet * pow(max(0.0, 1.0 - length(c - vec2(-0.3, 0.35)) * 2.2), 3.0); gl_FragColor = vec4(col, a); }',
        transparent: true, depthWrite: false, blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide
      });
      return m;
    };
    const mkDyn = (nQuads, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nQuads * 12), 3));
      g.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(nQuads * 8), 2));
      g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(nQuads * 4), 1));
      const ix = new Uint16Array(nQuads * 6);
      for (let i = 0; i < nQuads; i++) { ix.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
      g.setIndex(new THREE.BufferAttribute(ix, 1));
      const uv = g.attributes.aUV.array;
      for (let i = 0; i < nQuads; i++) uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
      monde.add(m);
      return m;
    };
    const lin3 = (r, g, b) => lin ? [r, g, b] : [Math.pow(r, 1 / 2.2), Math.pow(g, 1 / 2.2), Math.pow(b, 1 / 2.2)];
    const NG = 72, NE = 40;
    const mGouttes = mkDyn(NG * 2, shaderPart(false, lin3(0.16, 0.004, 0.004)));
    const mEclab = mkDyn(NE, shaderPart(false, lin3(0.11, 0.003, 0.003)));
    const mTrainee = mkDyn(2 * (NT - 1), shaderPart(true, lin3(1.0, 0.12, 0.05)));
    const mFumee = mkDyn(24, shaderPart(true, lin3(0.22, 0.015, 0.01)));
    mEclab.renderOrder = 1;
    // option « gouttes : false » : le jeu dessine lui-même le sang (src/fx.js) → aucune goutte ni éclaboussure ici
    const avecGouttes = !(C.opts && C.opts.gouttes === false);
    mGouttes.visible = avecGouttes; mEclab.visible = avecGouttes;
    // coordonnées de texture fixes des traînées et de la fumée (posées une fois)
    for (const m of [mTrainee, mFumee]) { const uv = m.geometry.attributes.aUV.array; for (let i = 0; i < uv.length; i += 8) { uv[i] = 0; uv[i + 1] = 0; uv[i + 2] = 0; uv[i + 3] = 1; uv[i + 4] = 1; uv[i + 5] = 1; uv[i + 6] = 1; uv[i + 7] = 0; } }
    const gouttes = [], eclab = [], fumees = [];
    for (let i = 0; i < NG; i++) gouttes.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3() });
    for (let i = 0; i < NE; i++) eclab.push({ vie: 0, p: new THREE.Vector3(), r: 0, a: 0 });
    for (let i = 0; i < 24; i++) fumees.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0 });
    let iG = 0, iE = 0, iF = 0, accG = 0, accF = 0;
    const tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), tvBest = new THREE.Vector3();
    const pointMonde = (L, part, s, w, out) => { const p = pointLame(part, s, w, 0); out.set(p[0], p[1], p[2]); L.mL.updateMatrixWorld(); return out.applyMatrix4(L.mL.matrixWorld); };
    const emettreGoutte = (p, v) => { const g = gouttes[iG]; iG = (iG + 1) % NG; g.vie = 1; g.p.copy(p); g.v.copy(v); };
    const st = { vis: false, trainee: 0, palette: null };

    // ---------------------------------------------------------------- palette courante (instantané, sans recompilation)
    // Couleurs prêtes pour chaque palette (une fois) ; au changement : recopie des couleurs de sommets (verre, cœur,
    // tendons) préparées plus haut, uniformes, couleurs de matériau. Rien de partagé avec une autre instance.
    const col3 = (a) => new THREE.Color(a[0], a[1], a[2]);
    const PC = {};
    for (const n of NOMS_PALETTES) {
      const P = PL[n];
      PC[n] = { veine: col3(P.veine), reg: new THREE.Vector3(P.reg[0], P.reg[1], P.reg[2]), dissolLame: col3(P.dissolLame), coeurEmis: new THREE.Color().fromArray(cl(P.coeurEmis)),
        trainee: col3(lin3(P.trainee[0], P.trainee[1], P.trainee[2])), fumee: col3(lin3(P.fumee[0], P.fumee[1], P.fumee[2])),
        goutte: col3(lin3(P.goutte[0], P.goutte[1], P.goutte[2])), eclab: col3(lin3(P.eclab[0], P.eclab[1], P.eclab[2])), reflet: col3(lin3(P.reflet[0], P.reflet[1], P.reflet[2])),
        dissol: col3(P.dissol), aura: col3(lin3(P.aura[0], P.aura[1], P.aura[2])) };
    }
    function palette(nom) {
      const n = nomPalette(nom);
      if (n === st.palette) return n;
      st.palette = n;
      const P = PL[n], K = PC[n];
      const recopier = (geo, tab) => { const a = geo.attributes.color; a.array.set(tab); a.needsUpdate = true; };
      recopier(geoLame, TAB_LAME[n]); recopier(geoPoi, TAB_POI[n]); recopier(geoCoeur, TAB_COEUR[n]);
      UL.uVeineCoul.value.copy(K.veine); UL.uDissolCoul.value.copy(K.dissolLame); UL.uLameReg.value.copy(K.reg);   // UL2 partage ces objets
      for (let i = 0; i < matCoeur.length; i++) matCoeur[i].emissive.copy(K.coeurEmis);
      matLame.opacity = matLame2.opacity = P.opacite; matLame.roughness = matLame2.roughness = P.rugosite; matLame.envMapIntensity = matLame2.envMapIntensity = P.env;
      mTrainee.material.uniforms.uCoul.value.copy(K.trainee); mFumee.material.uniforms.uCoul.value.copy(K.fumee);
      mGouttes.material.uniforms.uCoul.value.copy(K.goutte); mGouttes.material.uniforms.uReflet.value.copy(K.reflet);
      mEclab.material.uniforms.uCoul.value.copy(K.eclab); mEclab.material.uniforms.uReflet.value.copy(K.reflet);
      // teinte de la dissolution du corps et du halo de l'aura quand les lames sont là (lue par l'animateur et l'aura)
      if (C.teinte) { C.teinte.nom = n; C.teinte.dissol.copy(K.dissol); C.teinte.aura.copy(K.aura); }
      return n;
    }
    function maj(etatL, ctx) {
      const etat = etatL && etatL.etat ? etatL.etat : 'aucune', t = clamp(etatL && etatL.t != null ? etatL.t : 1, 0, 1);
      const dt = ctx.dt, T = ctx.temps;
      monde.matrix.copy(C.objet.matrixWorld).invert();
      monde.matrixWorldNeedsUpdate = true;
      const vis = etat !== 'aucune' && ctx.dissol < 0.98;
      let form = 1, fiss = 0, effr = 0, echP = 1, tors = 0, debit = 4.5, debitMain = 0;
      if (etat === 'formation') {
        form = smooth(0.3, 0.86, t); echP = smooth(0.22, 0.5, t);
        const k = clamp((t - 0.74) / 0.26, 0, 1); tors = k > 0 ? Math.sin(k * Math.PI * 2.5) * Math.exp(-k * 3) * 0.7 : 0;
        debitMain = t < 0.55 ? 18 : 0; debit = t > 0.5 ? 6 : 0;
      } else if (etat === 'destruction') {
        fiss = smooth(0.0, 0.45, t); effr = smooth(0.4, 1.0, t); debit = t > 0.4 && t < 0.95 ? 30 : 3;
        echP = 1 - smooth(0.82, 1.0, t);
      }
      if (ctx.dissol > 0) effr = Math.max(effr, ctx.dissol);
      // dissolution du corps (téléportations, apparitions) : le cœur et la poignée fondent avec la lame au lieu de rester
      // entiers jusqu'à la disparition (v2.2)
      const kDis = ctx.dissol > 0 ? 1 - smooth(0.2, 0.85, ctx.dissol) : 1;
      UL.uForm.value = form; UL.uFiss.value = fiss; UL.uEffrit.value = effr;
      UL.uVeine.value = 0.5 + ctx.puis * 0.5;
      // traînée pendant les coups
      const frappe = ctx.action === 'frappe' || (ctx.action === 'frappe-ratee' && ctx.u < 0.35) || (ctx.action === 'frappe-preparation' && ctx.u > 0.9);
      st.trainee += ((frappe && vis ? 1 : 0) - st.trainee) * (1 - Math.exp(-dt * (frappe ? 30 : 6)));
      for (let il = 0; il < lames.length; il++) {
        const L = lames[il];
        L.racine.visible = vis;
        if (!vis) { L.aPrev = false; L.nHist = 0; continue; }
        // battement de cœur propre à chaque lame (période ≈ 1 s, deux coups rapprochés)
        const cyc = ((T + L.ph) % L.per) / L.per;
        const pouls = Math.exp(-Math.pow(cyc - 0.06, 2) / 0.0025) + 0.6 * Math.exp(-Math.pow(cyc - 0.3, 2) / 0.004);
        L.U.uPouls.value = pouls + 0.3 * ctx.rage;
        L.mC.scale.setScalar(Math.max(0.001, echP * kDis * (1 + 0.16 * pouls)));
        L.mC.material.emissiveIntensity = (0.5 + 2.6 * pouls) * (1 - effr);
        // frémissement indépendant de chaque lame, torsion de formation
        const a1 = bruit1(T * L.f1 + L.ph, 711) * 0.012, a2 = bruit1(T * L.f1 * 1.3 + L.ph * 2, 713) * 0.01;
        const tw = Math.sin(T * L.f2 * TAU + L.ph) * 0.035 + tors * (L.G === 'G' ? 1 : -1);
        L.frem.rotation.set(a1, tw, a2);
        L.mP.scale.setScalar(Math.max(0.001, echP * (0.35 + 0.65 * kDis)));
        L.frem.updateMatrixWorld(true);
        // vitesse de la lame (gouttes projetées pendant les gestes)
        pointMonde(L, 0, 0.6, 0.5, tv);
        if (L.aPrev && dt > 0) { L.vit.subVectors(tv, L.prev).divideScalar(dt); if (L.vit.length() > 30) L.vit.set(0, 0, 0); } else L.vit.set(0, 0, 0);
        L.prev.copy(tv); L.aPrev = true;
        // gouttes : depuis les points les plus bas de la lame, ou depuis la paume pendant la formation
        accG += avecGouttes ? dt * (debit + debitMain) : 0;
        while (accG >= 1) {
          accG -= 1;
          if (debitMain > 0 && R() < debitMain / (debit + debitMain)) {
            L.ancreMain.getWorldPosition(tv2);
            tv2.x += (R() - 0.5) * 0.05; tv2.z += (R() - 0.5) * 0.05;
            emettreGoutte(tv2, tv.set((R() - 0.5) * 0.2, -0.3 * R(), (R() - 0.5) * 0.2));
          } else {
            let aBest = false;
            for (let k = 0; k < 3; k++) {
              const s = R() * Math.min(1, form * 1.05), w = R() < 0.5 ? 0 : 1;
              pointMonde(L, 0, s, w, tv2);
              if (!aBest || tv2.y < tvBest.y) { tvBest.copy(tv2); aBest = true; }
            }
            emettreGoutte(tvBest, tv.copy(L.vit).multiplyScalar(0.55).add(tv2.set((R() - 0.5) * 0.15, -0.1, (R() - 0.5) * 0.15)));
          }
        }
        // fumée rouge qui s'élève de la lame
        accF += dt * 3.2;
        while (accF >= 1) {
          accF -= 1;
          const f = fumees[iF]; iF = (iF + 1) % fumees.length;
          pointMonde(L, 0, R() * form, R(), f.p);
          f.v.set((R() - 0.5) * 0.12, 0.18 + 0.15 * R(), (R() - 0.5) * 0.12); f.vie = 1; f.r = 0.05 + 0.06 * R();
        }
        // historique pour la traînée : base et pointe du grand arc
        if (st.trainee > 0.01) {
          // tampon circulaire : L.iHist = case la plus récente
          L.iHist = (L.iHist + NT - 1) % NT;
          const h = L.hist[L.iHist];
          pointMonde(L, 0, 0.25, 0, h[0]); pointMonde(L, 0, 1.0, 0, h[1]);
          L.nHist = Math.min(NT, L.nHist + 1);
        } else L.nHist = 0;
      }
      // intégration des gouttes et éclaboussures au sol
      const sol = ctx.solMonde;
      let nG = 0, nE = 0, nF = 0;
      if (avecGouttes) for (let ig = 0; ig < NG; ig++) {
        const g = gouttes[ig];
        if (g.vie <= 0) continue;
        g.v.y -= 9.8 * dt;
        g.p.addScaledVector(g.v, dt);
        g.vie -= dt * 0.25;
        if (g.p.y <= sol + 0.003) {
          const e = eclab[iE]; iE = (iE + 1) % NE;
          e.vie = 1; e.p.set(g.p.x, sol + 0.004 + iE * 0.00005, g.p.z); e.r = 0.012 + 0.03 * Math.min(1, g.v.length() / 5) * (0.6 + 0.8 * R()); e.a = R() * TAU;
          g.vie = 0;
        }
        if (g.vie > 0) nG++;
      }
      if (avecGouttes) for (let ie = 0; ie < NE; ie++) { const e = eclab[ie]; if (e.vie > 0) { e.vie -= dt / 6; nE++; } }
      for (let jf = 0; jf < fumees.length; jf++) { const f = fumees[jf]; if (f.vie > 0) { f.vie -= dt / 1.6; f.p.addScaledVector(f.v, dt); f.r += dt * 0.05; nF++; } }
      // écriture des sommets (repère du monde : le groupe « monde » annule la transformation du boss), seulement quand
      // quelque chose est visible : sinon le maillage est caché (ni envoi au GPU, ni appel de dessin)
      mGouttes.visible = avecGouttes && nG > 0;
      mEclab.visible = avecGouttes && nE > 0;
      mTrainee.visible = vis && st.trainee > 0.004;
      mFumee.visible = vis && nF > 0;
      if (mGouttes.visible) {
        const P = mGouttes.geometry.attributes.position.array, Al = mGouttes.geometry.attributes.aAlpha.array;
        let k = 0;
        for (let ig = 0; ig < NG; ig++) {
          const g = gouttes[ig];
          const a = g.vie > 0 ? 1 : 0;
          const len = 0.014 + Math.min(0.05, g.v.length() * 0.01), wd = 0.0055;
          tv.copy(g.v); if (tv.lengthSq() < 1e-6) tv.set(0, -1, 0); tv.normalize();
          for (let sd = 0; sd < 2; sd++) {
            tv2.set(sd === 0 ? 1 : 0, 0, sd === 0 ? 0 : 1).cross(tv);
            if (tv2.lengthSq() < 1e-8) tv2.set(0, 1, 0);
            tv2.normalize().multiplyScalar(wd);
            const o = k * 12;
            P[o] = g.p.x - tv2.x; P[o + 1] = g.p.y - tv2.y; P[o + 2] = g.p.z - tv2.z;
            P[o + 3] = g.p.x + tv2.x; P[o + 4] = g.p.y + tv2.y; P[o + 5] = g.p.z + tv2.z;
            P[o + 6] = g.p.x + tv2.x - tv.x * len; P[o + 7] = g.p.y + tv2.y - tv.y * len; P[o + 8] = g.p.z + tv2.z - tv.z * len;
            P[o + 9] = g.p.x - tv2.x - tv.x * len; P[o + 10] = g.p.y - tv2.y - tv.y * len; P[o + 11] = g.p.z - tv2.z - tv.z * len;
            Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = a;
            k++;
          }
        }
        mGouttes.geometry.attributes.position.needsUpdate = true; mGouttes.geometry.attributes.aAlpha.needsUpdate = true;
      }
      if (mEclab.visible) {
        const P = mEclab.geometry.attributes.position.array, Al = mEclab.geometry.attributes.aAlpha.array;
        for (let k = 0; k < NE; k++) {
          const e = eclab[k];
          const r = e.r * (e.vie > 0 ? Math.min(1, (1 - e.vie) * 30 + 0.3) : 0), c = Math.cos(e.a) * r, s = Math.sin(e.a) * r;
          const o = k * 12;
          P[o] = e.p.x - c + s; P[o + 1] = e.p.y; P[o + 2] = e.p.z - s - c;
          P[o + 3] = e.p.x + c + s; P[o + 4] = e.p.y; P[o + 5] = e.p.z + s - c;
          P[o + 6] = e.p.x + c - s; P[o + 7] = e.p.y; P[o + 8] = e.p.z + s + c;
          P[o + 9] = e.p.x - c - s; P[o + 10] = e.p.y; P[o + 11] = e.p.z - s + c;
          const a = e.vie > 0 ? Math.min(1, e.vie * 2.5) * 0.92 : 0;
          Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = a;
        }
        mEclab.geometry.attributes.position.needsUpdate = true; mEclab.geometry.attributes.aAlpha.needsUpdate = true;
      }
      if (mTrainee.visible) {
        const P = mTrainee.geometry.attributes.position.array, Al = mTrainee.geometry.attributes.aAlpha.array;
        let k = 0;
        for (let l = 0; l < lames.length; l++) {
          const L = lames[l];
          for (let i = 0; i < NT - 1; i++, k++) {
            const o = k * 12;
            if (!vis || i + 1 >= L.nHist) { Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = 0; continue; }
            // i = 0 : case la plus récente ; quadrilatère base/pointe récentes → pointe/base plus anciennes
            const h0 = L.hist[(L.iHist + i) % NT], h1 = L.hist[(L.iHist + i + 1) % NT];
            P[o] = h0[0].x; P[o + 1] = h0[0].y; P[o + 2] = h0[0].z;
            P[o + 3] = h0[1].x; P[o + 4] = h0[1].y; P[o + 5] = h0[1].z;
            P[o + 6] = h1[1].x; P[o + 7] = h1[1].y; P[o + 8] = h1[1].z;
            P[o + 9] = h1[0].x; P[o + 10] = h1[0].y; P[o + 11] = h1[0].z;
            const a0 = (1 - i / (NT - 1)) * st.trainee * 0.85, a1 = (1 - (i + 1) / (NT - 1)) * st.trainee * 0.85;
            Al[k * 4] = a0; Al[k * 4 + 1] = a0; Al[k * 4 + 2] = a1; Al[k * 4 + 3] = a1;
          }
        }
        mTrainee.geometry.attributes.position.needsUpdate = true; mTrainee.geometry.attributes.aAlpha.needsUpdate = true;
      }
      if (mFumee.visible) {
        const P = mFumee.geometry.attributes.position.array, Al = mFumee.geometry.attributes.aAlpha.array;
        for (let k = 0; k < fumees.length; k++) {
          const f = fumees[k];
          const r = f.r, o = k * 12, a = f.vie > 0 && vis ? Math.sin(Math.PI * f.vie) * 0.5 : 0;
          const ang = k * 1.3;
          const cx = Math.cos(ang) * r, cz = Math.sin(ang) * r;
          P[o] = f.p.x - cx; P[o + 1] = f.p.y - r; P[o + 2] = f.p.z - cz;
          P[o + 3] = f.p.x + cx; P[o + 4] = f.p.y - r; P[o + 5] = f.p.z + cz;
          P[o + 6] = f.p.x + cx; P[o + 7] = f.p.y + r; P[o + 8] = f.p.z + cz;
          P[o + 9] = f.p.x - cx; P[o + 10] = f.p.y + r; P[o + 11] = f.p.z - cz;
          Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = a;
        }
        mFumee.geometry.attributes.position.needsUpdate = true; mFumee.geometry.attributes.aAlpha.needsUpdate = true;
      }
    }
    function reinitialiser() {
      for (const g of gouttes) g.vie = 0;
      for (const e of eclab) e.vie = 0;
      for (const f of fumees) f.vie = 0;
      for (const L of lames) { L.aPrev = false; L.nHist = 0; L.iHist = 0; }
      st.trainee = 0;
    }
    palette(C.opts && C.opts.couleurLames);
    return {
      maj: maj, reinitialiser: reinitialiser, lames: lames, uniformes: UL, triangles: Math.round(tris), monde: monde, gouttes: avecGouttes,
      palette: palette, paletteCourante: () => st.palette, materiaux: { lame: matLame, lame2: matLame2, poignee: matPoi, coeur: matCoeur },
      dispose: () => { geoLame.dispose(); geoPoi.dispose(); geoCoeur.dispose(); matLame.dispose(); matLame2.dispose(); matPoi.dispose(); for (const m of matCoeur) m.dispose(); for (const m of [mGouttes, mEclab, mTrainee, mFumee]) { m.geometry.dispose(); m.material.dispose(); } }
    };
  }

  // ============================================================================================
  // Voile protecteur (bouclier ∈ [0, 1]) : coque translucide à effet de bord qui suit le corps et
  // s'allume en éclats là où elle est touchée (impactVoile(pointMonde), et automatiquement à chaque
  // touche quand le voile est levé). Aura intégrée : halo additif, braises qui montent, fumée légère,
  // étincelles instables quand il est affaibli. Les grands effets restent au module d'effets.
  // ============================================================================================
  function creerVoile(THREE, C) {
    const N_IMP = 8;
    const UV = { uTemps: C.U.uTemps, uForce: { value: 0 }, uCoul: { value: new THREE.Color(0.85, 0.16, 0.12) }, uCoulImp: { value: new THREE.Color(1.0, 0.55, 0.25) }, uImp: { value: [] } };
    for (let i = 0; i < N_IMP; i++) UV.uImp.value.push(new THREE.Vector4(0, -10, 0, -100));
    const mat = new THREE.ShaderMaterial({
      uniforms: UV, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vL;
        void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTemps; uniform float uForce; uniform vec3 uCoul; uniform vec3 uCoulImp; uniform vec4 uImp[${N_IMP}];
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float bord = pow(f, 2.6);
          float flux = n3(vL * 5.0 + vec3(0.0, -uTemps * 0.6, 0.0)) * 0.6 + n3(vL * 13.0 + vec3(uTemps * 0.3, 0.0, 0.0)) * 0.4;
          float cell = abs(fract(vL.y * 9.0 + n3(vL * 3.0) * 2.0) - 0.5);
          float base = uForce * (bord * (0.55 + 0.6 * flux) + 0.035 * flux + 0.05 * (1.0 - smoothstep(0.0, 0.04, cell)) * bord);
          float imp = 0.0;
          for (int i = 0; i < ${N_IMP}; i++) {
            float age = uTemps - uImp[i].w;
            if (age < 0.0 || age > 0.9) continue;
            float d = distance(vL, uImp[i].xyz);
            float onde = exp(-pow(d - age * 1.6, 2.0) / 0.0025) * exp(-age * 4.0);
            float eclat = (1.0 - smoothstep(0.0, 0.16 + age * 0.3, d)) * exp(-age * 9.0);
            float fissure = (1.0 - smoothstep(0.0, 0.06, abs(n3(vL * 22.0 + uImp[i].xyz * 7.0) - 0.5))) * (1.0 - smoothstep(0.0, 0.32, d)) * exp(-age * 5.0);
            imp += onde * 0.9 + eclat * 1.6 + fissure * 1.4;
          }
          vec3 c = uCoul * base + uCoulImp * imp * (0.35 + 0.65 * max(uForce, 0.4));
          float a = clamp(base + imp, 0.0, 1.0);
          if (a < 0.002) discard;
          gl_FragColor = vec4(c, a);
        }`
    });
    const R = [0.6, 1.02, 0.52], CY = 1.0;
    const geo = new THREE.SphereGeometry(1, Math.max(16, Math.round(28 * C.q)), Math.max(10, Math.round(18 * C.q)));
    geo.scale(R[0], R[1], R[2]);
    const m = new THREE.Mesh(geo, mat);
    m.name = 'boss-voile';
    m.position.set(0, CY, 0.02);
    m.renderOrder = 5; m.frustumCulled = false; m.visible = false;
    C.B.root.add(m);
    let iImp = 0;
    const tv = new THREE.Vector3();
    const poser = (local) => {
      // ramène le point sur la coque (ellipsoïde)
      const l = Math.hypot(local.x / R[0], local.y / R[1], local.z / R[2]) || 1;
      local.set(local.x / l, local.y / l, local.z / l);
      UV.uImp.value[iImp].set(local.x, local.y, local.z, C.U.uTemps.value);
      iImp = (iImp + 1) % N_IMP;
    };
    return {
      mesh: m, uniformes: UV, triangles: geo.index.count / 3,
      impact(p) { m.updateMatrixWorld(true); tv.set(p.x, p.y, p.z); m.worldToLocal(tv); poser(tv); },
      impactDirection(dirLocal, force, n) {
        // dirLocal : direction de la balle dans le repère du boss ; l'impact est du côté d'où elle vient
        const k = n || iImp + 1;
        tv.set(-dirLocal.x + (hash3(k, 1, 7, 951) - 0.5) * 0.4, -dirLocal.y + 0.3 + (hash3(k, 2, 7, 951) - 0.5) * 0.5, -dirLocal.z + (hash3(k, 3, 7, 951) - 0.5) * 0.4);
        poser(tv);
      },
      maj(ctx) {
        const f = ctx.bouclier * (1 - ctx.dissol);
        UV.uForce.value = f * (0.85 + 0.15 * Math.sin(ctx.temps * 3.1));
        let actif = f > 0.005;
        if (!actif) for (let i = 0; i < N_IMP; i++) if (ctx.temps - UV.uImp.value[i].w < 0.9) { actif = true; break; }
        m.visible = actif;
      },
      reinitialiser() { for (const v of UV.uImp.value) v.set(0, -10, 0, -100); },
      dispose() { geo.dispose(); mat.dispose(); }
    };
  }

  function creerAura(THREE, C) {
    const lin = C.linear;
    const L3 = (r, g, b) => lin ? [r, g, b] : [Math.pow(r, 1 / 2.2), Math.pow(g, 1 / 2.2), Math.pow(b, 1 / 2.2)];
    const grp = new THREE.Group(); grp.name = 'boss-aura';
    C.B.root.add(grp);
    // halo : trois plans croisés autour de l'axe du corps, dégradé radial additif
    const UH = { uTemps: C.U.uTemps, uInt: { value: 0 }, uCoul: { value: new THREE.Color().fromArray(L3(0.75, 0.12, 0.05)) }, uInstable: { value: 0 } };
    const matH = new THREE.ShaderMaterial({
      uniforms: UH, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUV; void main(){ vUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTemps; uniform float uInt; uniform vec3 uCoul; uniform float uInstable; varying vec2 vUV;
        void main(){ vec2 c = (vUV - 0.5) * vec2(2.0, 2.0); float r = length(c * vec2(1.0, 0.72));
          float n = sin(atan(c.y, c.x) * 5.0 + uTemps * 1.3) * 0.06 + sin(atan(c.y, c.x) * 11.0 - uTemps * 2.1) * 0.04;
          float a = pow(max(0.0, 1.0 - r + n), 2.2) * uInt;
          float fl = 1.0 - uInstable * step(0.62, fract(sin(floor(uTemps * 14.0) * 12.9898) * 43758.5453));
          a *= fl;
          if (a < 0.003) discard; gl_FragColor = vec4(uCoul * a, a); }`
    });
    // les trois plans (1,7 × 2,5 m, tournés de 60°) forment une seule géométrie : un seul appel de dessin (v2.2)
    const gH = new THREE.BufferGeometry();
    {
      const P = [], UVh = [], IX = [];
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a), b = i * 4;
        for (const [x, y, u, v] of [[-0.85, 1.25, 0, 1], [0.85, 1.25, 1, 1], [-0.85, -1.25, 0, 0], [0.85, -1.25, 1, 0]]) { P.push(x * c, y, -x * s); UVh.push(u, v); }
        IX.push(b, b + 2, b + 1, b + 2, b + 3, b + 1);
      }
      gH.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      gH.setAttribute('uv', new THREE.Float32BufferAttribute(UVh, 2));
      gH.setIndex(IX);
    }
    { const m = new THREE.Mesh(gH, matH); m.name = 'boss-aura-halo'; m.position.set(0, 1.05, -0.02); m.frustumCulled = false; m.renderOrder = 3; grp.add(m); }
    // braises et étincelles (points) dans le repère du monde
    const NB = Math.max(16, Math.round(44 * C.q));
    const geoB = new THREE.BufferGeometry();
    geoB.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3));
    geoB.setAttribute('aVie', new THREE.BufferAttribute(new Float32Array(NB), 1));
    geoB.setAttribute('aTaille', new THREE.BufferAttribute(new Float32Array(NB), 1));
    const hauteur = C.opts.renderer && C.opts.renderer.domElement ? C.opts.renderer.domElement.height || 800 : 800;
    const UB = { uEchelle: { value: hauteur * 0.9 }, uCoul: { value: new THREE.Color().fromArray(L3(1.0, 0.42, 0.12)) } };
    const matB = new THREE.ShaderMaterial({
      uniforms: UB, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aVie; attribute float aTaille; uniform float uEchelle; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aVie; gl_PointSize = max(1.0, aTaille * uEchelle / max(0.2, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCoul; varying float vA; void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); float a = vA * max(0.0, 1.0 - r) ; if (a < 0.01) discard; gl_FragColor = vec4(uCoul * a * (1.0 + 1.5 * (1.0 - r)), a); }'
    });
    const pts = new THREE.Points(geoB, matB); pts.frustumCulled = false; pts.matrixAutoUpdate = false; pts.renderOrder = 4;
    C.objet.add(pts);
    const braises = [];
    for (let i = 0; i < NB; i++) braises.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0.02 });
    // fumée légère au bas du manteau (quads croisés, mélange normal sombre)
    const NF = 14;
    const geoF = new THREE.BufferGeometry();
    geoF.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 12), 3));
    geoF.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(NF * 8), 2));
    geoF.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(NF * 4), 1));
    const ixF = new Uint16Array(NF * 6);
    for (let i = 0; i < NF; i++) ixF.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    geoF.setIndex(new THREE.BufferAttribute(ixF, 1));
    for (let i = 0; i < NF; i++) geoF.attributes.aUV.array.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    const matF = new THREE.ShaderMaterial({
      uniforms: { uCoul: { value: new THREE.Color().fromArray(L3(0.03, 0.012, 0.012)) }, uTemps: C.U.uTemps },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'attribute vec2 aUV; attribute float aAlpha; varying vec2 vUV; varying float vA; void main(){ vUV = aUV; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCoul; uniform float uTemps; varying vec2 vUV; varying float vA; void main(){ vec2 c = vUV * 2.0 - 1.0; float r = length(c); float n = sin(c.x * 6.0 + uTemps) * sin(c.y * 5.0 - uTemps * 0.7) * 0.15; float a = vA * pow(max(0.0, 1.0 - r + n), 1.6); if (a < 0.004) discard; gl_FragColor = vec4(uCoul, a); }'
    });
    const fum = new THREE.Mesh(geoF, matF); fum.frustumCulled = false; fum.matrixAutoUpdate = false; fum.renderOrder = 2;
    C.objet.add(fum);
    const fumees = [];
    for (let i = 0; i < NF; i++) fumees.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0.2, a: 0 });
    const R = rng(9091);
    let accB = 0, accF = 0, iB = 0, iF = 0, accE = 0;
    const tv = new THREE.Vector3();
    const COUL_SANG = L3(0.8, 0.03, 0.02), COUL_RAGE = L3(0.95, 0.12, 0.04), COUL_CALME = L3(0.75, 0.14, 0.05);
    const spawnCorps = (out, y0, y1, r) => { const a = R() * TAU, rr = r * (0.5 + 0.5 * R()); out.set(Math.sin(a) * rr, lerp(y0, y1, R()), Math.cos(a) * rr); C.corps.localToWorld(out); return out; };
    return {
      triangles: 6 + NF * 2,
      maj(ctx) {
        const A = ctx.A, au = Math.max(0, A[ctx.OFF.au]);
        const intens = au * (0.35 + 0.75 * ctx.puis) * (1 + 0.6 * ctx.rage) * (1 - 0.5 * ctx.faib) * (1 - ctx.dissol);
        UH.uInt.value = 0.16 * intens * (0.85 + 0.15 * Math.sin(ctx.temps * 2.3));
        UH.uInstable.value = clamp(ctx.faib * 1.4 - 0.4, 0, 0.8);
        // lames présentes : halo à la teinte des lames (C.teinte, palette de l'instance) ; sinon énergie du boss
        if (ctx.sang && C.teinte) UH.uCoul.value.copy(C.teinte.aura);
        else UH.uCoul.value.fromArray(ctx.sang ? COUL_SANG : ctx.rage > 0.5 ? COUL_RAGE : COUL_CALME);
        grp.visible = UH.uInt.value > 0.002;
        pts.matrix.copy(C.objet.matrixWorld).invert(); pts.matrixWorldNeedsUpdate = true;
        fum.matrix.copy(pts.matrix); fum.matrixWorldNeedsUpdate = true;
        const dt = ctx.dt;
        // braises montantes ; étincelles instables quand il est affaibli
        accB += dt * (6 + 18 * intens);
        while (accB >= 1 && intens > 0.02) {
          accB -= 1;
          const b = braises[iB]; iB = (iB + 1) % NB;
          spawnCorps(b.p, 0.25, 1.7, 0.42);
          b.v.set((R() - 0.5) * 0.25, 0.3 + 0.5 * R(), (R() - 0.5) * 0.25); b.vie = 1; b.t = 0.012 + 0.018 * R();
        }
        if (ctx.faib > 0.4) {
          accE += dt * ctx.faib * 3;
          if (accE >= 1 && R() < 0.5) {
            accE = 0;
            spawnCorps(tv, 0.6, 1.5, 0.3);
            for (let k = 0; k < 6; k++) { const b = braises[iB]; iB = (iB + 1) % NB; b.p.copy(tv); b.v.set((R() - 0.5) * 2.5, R() * 2, (R() - 0.5) * 2.5); b.vie = 0.6; b.t = 0.01; }
          }
        }
        const P = geoB.attributes.position.array, V = geoB.attributes.aVie.array, Tl = geoB.attributes.aTaille.array;
        for (let i = 0; i < NB; i++) {
          const b = braises[i];
          if (b.vie > 0) {
            b.vie -= dt * 0.7; b.v.y -= (b.t < 0.011 ? 4 : -0.1) * dt;
            b.v.x += bruit1(ctx.temps * 2 + i, 931) * dt * 0.6; b.v.z += bruit1(ctx.temps * 2 + i + 50, 933) * dt * 0.6;
            b.p.addScaledVector(b.v, dt);
          }
          P[i * 3] = b.p.x; P[i * 3 + 1] = b.p.y; P[i * 3 + 2] = b.p.z;
          V[i] = b.vie > 0 ? Math.min(1, b.vie * 2) * Math.min(1, (1 - b.vie) * 8) * (0.4 + 0.6 * clamp(intens, 0, 1.5)) : 0;
          Tl[i] = b.t;
        }
        geoB.attributes.position.needsUpdate = true; geoB.attributes.aVie.needsUpdate = true; geoB.attributes.aTaille.needsUpdate = true;
        // fumée sombre qui s'échappe du bas du manteau en lévitation
        accF += dt * 3 * ctx.lev * (0.5 + 0.5 * Math.min(1, au));
        while (accF >= 1) {
          accF -= 1;
          const f = fumees[iF]; iF = (iF + 1) % NF;
          spawnCorps(f.p, 0.15, 0.55, 0.3);
          f.v.set((R() - 0.5) * 0.15, 0.06 + 0.12 * R(), (R() - 0.5) * 0.15); f.vie = 1; f.r = 0.18 + 0.15 * R(); f.a = R() * TAU;
        }
        const PF = geoF.attributes.position.array, AF = geoF.attributes.aAlpha.array;
        for (let k = 0; k < NF; k++) {
          const f = fumees[k];
          if (f.vie > 0) { f.vie -= dt / 2.6; f.p.addScaledVector(f.v, dt); f.r += dt * 0.08; }
          const r = f.r, o = k * 12, cx = Math.cos(f.a) * r, cz = Math.sin(f.a) * r;
          PF[o] = f.p.x - cx; PF[o + 1] = f.p.y - r; PF[o + 2] = f.p.z - cz;
          PF[o + 3] = f.p.x + cx; PF[o + 4] = f.p.y - r; PF[o + 5] = f.p.z + cz;
          PF[o + 6] = f.p.x + cx; PF[o + 7] = f.p.y + r; PF[o + 8] = f.p.z + cz;
          PF[o + 9] = f.p.x - cx; PF[o + 10] = f.p.y + r; PF[o + 11] = f.p.z - cz;
          const a = f.vie > 0 ? Math.sin(Math.PI * f.vie) * 0.35 * (1 - ctx.dissol) : 0;
          AF[k * 4] = AF[k * 4 + 1] = AF[k * 4 + 2] = AF[k * 4 + 3] = a;
        }
        geoF.attributes.position.needsUpdate = true; geoF.attributes.aAlpha.needsUpdate = true;
      },
      reinitialiser() { for (const b of braises) b.vie = 0; for (const f of fumees) f.vie = 0; },
      dispose() { gH.dispose(); matH.dispose(); geoB.dispose(); matB.dispose(); geoF.dispose(); matF.dispose(); }
    };
  }

  // ============================================================================================
  // Format des poses : un tableau de nombres à disposition fixe (fondus et interpolations triviaux).
  // Repère du buste (« chest ») pour les cibles des mains ; angles en radians.
  // Conventions des os (pose de référence = identité, repris de ../survivant/src/anim.js) :
  //  colonne / tête : x > 0 penche en avant, y > 0 tourne vers la gauche, z > 0 incline vers la droite ;
  //  jambes : cuisse x < 0 = flexion vers l'avant, genou > 0 = flexion, pied > 0 = pointe tendue.
  // ============================================================================================
  const CHAMPS = [
    ['h', 3], ['hr', 3], ['sp', 3], ['ch', 3], ['nk', 3], ['hd', 3],
    ['cG', 2], ['cD', 2],                       // clavicules : élévation, protraction
    ['mG', 3], ['mD', 3],                       // poignets (repère du buste)
    ['pG', 3], ['pD', 3],                       // pôles des coudes (direction, repère du buste)
    ['paG', 3], ['paD', 3],                     // direction voulue de la paume (repère du buste)
    ['fG', 2], ['fD', 2],                       // poignet : flexion (+ vers la paume), déviation (+ vers le pouce)
    ['dG', 7], ['dD', 7],                       // formes de main (poids) : detendue, ouverte, griffe, crochue, poing, index, tenir
    ['jG', 5], ['jD', 5],                       // jambes : cuisse x, abduction, genou, pointe, rotation
    ['mach', 1], ['lu', 1], ['rg', 1], ['vG', 1], ['vD', 1], ['ext', 1], ['tr', 1], ['au', 1], ['sol', 1], ['rs', 1],
    ['msG', 3], ['msD', 3],                     // main posée au sol : x, z (repère du corps), poids
    ['ail', 5],                                 // ailes : ouverture, amplitude des battements, fréquence, flèche, relèvement
    ['rp', 1], ['rr', 1],                       // rotation de tout le corps (tangage, roulis) autour du bassin
    ['cl', 1]                                   // clignement (paupières, module de tête)
  ];
  const OFF = {};
  let NPOSE = 0;
  for (const [k, n] of CHAMPS) { OFF[k] = NPOSE; NPOSE += n; }
  const MAINS = ['detendue', 'ouverte', 'griffe', 'crochue', 'poing', 'index', 'tenir'];
  // formes de main : par doigt [écartement (+ vers le pouce), flexion MCP, PIP, DIP] ; pouce [opposition, flexion CMC, MCP, IP]
  const FORMES = {
    detendue: { index: [0.06, 0.28, 0.38, 0.26], majeur: [0, 0.32, 0.46, 0.3], annulaire: [-0.05, 0.38, 0.5, 0.32], auriculaire: [-0.12, 0.44, 0.55, 0.34], pouce: [0.35, 0.12, 0.22, 0.18] },
    ouverte: { index: [0.22, 0.06, 0.12, 0.08], majeur: [0.05, 0.07, 0.12, 0.08], annulaire: [-0.12, 0.09, 0.14, 0.09], auriculaire: [-0.3, 0.12, 0.16, 0.1], pouce: [0.12, -0.15, 0.1, 0.08] },
    griffe: { index: [0.22, -0.12, 1.12, 0.92], majeur: [0.05, -0.1, 1.18, 0.98], annulaire: [-0.13, -0.08, 1.18, 0.98], auriculaire: [-0.3, -0.02, 1.12, 0.92], pouce: [0.55, 0.15, 0.55, 0.7] },
    crochue: { index: [0.1, 0.62, 1.0, 0.72], majeur: [0.02, 0.68, 1.05, 0.76], annulaire: [-0.07, 0.74, 1.1, 0.76], auriculaire: [-0.15, 0.8, 1.1, 0.74], pouce: [0.75, 0.35, 0.5, 0.5] },
    poing: { index: [0.0, 1.45, 1.6, 0.95], majeur: [0, 1.5, 1.62, 0.95], annulaire: [-0.02, 1.52, 1.62, 0.92], auriculaire: [-0.05, 1.52, 1.58, 0.88], pouce: [1.05, 0.55, 0.75, 0.62] },
    index: { index: [0.06, -0.02, 0.04, 0.03], majeur: [0, 1.42, 1.5, 0.9], annulaire: [-0.02, 1.5, 1.55, 0.9], auriculaire: [-0.05, 1.5, 1.5, 0.85], pouce: [0.85, 0.45, 0.6, 0.45] },
    tenir: { index: [0.04, 1.12, 1.28, 0.72], majeur: [0, 1.22, 1.32, 0.76], annulaire: [-0.02, 1.28, 1.36, 0.76], auriculaire: [-0.06, 1.32, 1.36, 0.72], pouce: [1.0, 0.42, 0.45, 0.35] }
  };

  // pose de base : lévitation au repos, raide et autoritaire (menton levé, poitrine sortie), mains en demi-griffes
  const POSE_BASE = {
    h: [0, 0, 0], hr: [0.03, 0, 0], sp: [-0.03, 0, 0], ch: [-0.07, 0, 0], nk: [0.03, 0, 0], hd: [-0.05, 0, 0],
    cG: [-0.03, -0.05], cD: [-0.03, -0.05],
    mG: [0.235, -0.36, 0.055], mD: [-0.235, -0.36, 0.055],
    pG: [0.55, -0.25, -0.8], pD: [-0.55, -0.25, -0.8],
    paG: [-0.85, 0.0, 0.45], paD: [0.85, 0.0, 0.45],
    fG: [0.12, 0.0], fD: [0.12, 0.0],
    dG: { detendue: 0.55, griffe: 0.45 }, dD: { detendue: 0.55, griffe: 0.45 },
    jG: [-0.1, 0.035, 0.24, 0.55, 0.06], jD: [-0.19, 0.02, 0.36, 0.5, 0.04],
    mach: 0, lu: 1, rg: 1, vG: 0, vD: 0, ext: 0.96, tr: 0, au: 1, sol: 0, rs: 1,
    msG: [0.3, 0.2, 0], msD: [-0.3, 0.2, 0],
    ail: [0.9, 0.18, 0.45, 0, 0], rp: 0, rr: 0, cl: 0
  };

  function versTableau(o, base) {
    const a = base ? Float32Array.from(base) : new Float32Array(NPOSE);
    for (const k in o) {
      if (!(k in OFF)) continue;
      const v = o[k], off = OFF[k];
      if (k === 'dG' || k === 'dD') {
        const w = typeof v === 'string' ? { [v]: 1 } : v;
        let tot = 0; for (const n in w) tot += w[n];
        for (let i = 0; i < MAINS.length; i++) a[off + i] = (w[MAINS[i]] || 0) / (tot || 1);
      } else if (typeof v === 'number') a[off] = v;
      else for (let i = 0; i < v.length; i++) if (v[i] != null) a[off + i] = v[i];
    }
    return a;
  }
  const BASE_T = versTableau(POSE_BASE);

  // miroir gauche ↔ droite d'une pose (pour main = 'gauche')
  function miroirPose(src, dst) {
    dst.set(src);
    const negX = (k) => { dst[OFF[k]] = -src[OFF[k]]; };
    for (const k of ['hr', 'sp', 'ch', 'nk', 'hd']) { dst[OFF[k] + 1] = -src[OFF[k] + 1]; dst[OFF[k] + 2] = -src[OFF[k] + 2]; }
    negX('h');
    const swap = (a, b, n, neg) => { for (let i = 0; i < n; i++) { const va = src[OFF[a] + i], vb = src[OFF[b] + i]; dst[OFF[a] + i] = neg && i === 0 ? -vb : vb; dst[OFF[b] + i] = neg && i === 0 ? -va : va; } };
    swap('cG', 'cD', 2); swap('mG', 'mD', 3, true); swap('pG', 'pD', 3, true); swap('paG', 'paD', 3, true); swap('fG', 'fD', 2);
    swap('dG', 'dD', 7); swap('jG', 'jD', 5); swap('vG', 'vD', 1); swap('msG', 'msD', 3, true);
    dst[OFF.rr] = -src[OFF.rr];
    return dst;
  }
  const ease = {
    s: (t) => t * t * (3 - 2 * t),
    i: (t) => t * t,
    o: (t) => 1 - (1 - t) * (1 - t),
    l: (t) => t,
    // élan : dépasse légèrement puis revient (retombée)
    b: (t) => { const s = 1.70158 * 0.8; t -= 1; return t * t * ((s + 1) * t + s) + 1; }
  };

  // ============================================================================================
  // Vocabulaire des actions (SPEC §7), durées par défaut (valeurs de boss-config.js, utilisées seulement
  // si etat.dureeAction est absent) et bibliothèque de clips : poses clés [u, retouches, courbe] où chaque
  // clé hérite de la précédente. Courbes : s = douce (arrêt aux clés), o = départ sec puis amorti,
  // i = accélère, l = linéaire, b = dépassement puis retombée. Les actions « boucle » utilisent tAction (s).
  // Règles de représentation : bras levés AU-DESSUS de la tête ou en V, griffes, désignation vers le SOL ;
  // jamais de bras tendu vers l'avant paume vers le bas.
  // ============================================================================================
  const ACTIONS = ['apparition', 'flotte', 'incantation', 'projection', 'retour-incantation', 'double-incantation', 'double-projection',
    'vacille', 'souffrance-colere', 'meditation', 'absorption', 'transformation-ailes', 'envol', 'verrouillage', 'pique', 'impact-pique',
    'etourdi', 'remontee', 'souffrance', 'teleport-sortie', 'teleport-entree', 'retour-rage', 'rage', 'designation-mur', 'saisie-mur',
    'lancer', 'repulsion', 'affaiblissement', 'disparition', 'ramene', 'faible', 'reprise', 'rituel-ames', 'formation-lames', 'traque',
    'frappe-preparation', 'frappe', 'frappe-ratee', 'reapparition', 'defaite', 'cadavre', 'crochet-visee', 'crochet-lancer', 'crochet-traction'];
  const DUREES_DEFAUT = {
    'apparition': 2.0, 'flotte': 0, 'incantation': 1.1, 'projection': 0.25, 'retour-incantation': 0.8, 'double-incantation': 1.1,
    'double-projection': 0.25, 'vacille': 1.0, 'souffrance-colere': 2.6, 'meditation': 0, 'absorption': 3.5, 'transformation-ailes': 2.2,
    'envol': 1.0, 'verrouillage': 1.4, 'pique': 0.6, 'impact-pique': 0.5, 'etourdi': 3.0, 'remontee': 1.5, 'souffrance': 2.5,
    'teleport-sortie': 1.5, 'teleport-entree': 0.6, 'retour-rage': 4.0, 'rage': 0, 'designation-mur': 0.5, 'saisie-mur': 2.2, 'lancer': 0.35,
    'repulsion': 1.0, 'affaiblissement': 3.0, 'disparition': 1.5, 'ramene': 2.0, 'faible': 0, 'reprise': 2.5, 'rituel-ames': 7.0,
    'formation-lames': 3.0, 'traque': 0, 'frappe-preparation': 0.65, 'frappe': 0.25, 'frappe-ratee': 0.8, 'reapparition': 0.6, 'defaite': 5.0, 'cadavre': 0
  };

  // ---------------------------------------------------------------- poses de référence réutilisées
  const BRAS_HAUT = { // incantation : bras levés en V au-dessus de la tête, griffes vers le ciel
    mG: [0.33, 0.6, 0.11], mD: [-0.33, 0.6, 0.11], pG: [0.9, -0.1, -0.4], pD: [-0.9, -0.1, -0.4],
    paG: [-0.45, 0.35, 0.82], paD: [0.45, 0.35, 0.82], fG: [-0.35, 0], fD: [-0.35, 0], dG: 'griffe', dD: 'griffe',
    cG: [0.28, 0.05], cD: [0.28, 0.05], ch: [-0.14, 0, 0], sp: [-0.06, 0, 0], hd: [-0.2, 0, 0], nk: [-0.04, 0, 0]
  };
  const JAMBES_REPLIEES = { jG: [-1.05, 0.12, 1.65, 0.55, 0.1], jD: [-1.15, 0.08, 1.75, 0.5, 0.06] };
  const JAMBES_PENDANTES = { jG: [-0.1, 0.035, 0.24, 0.55, 0.06], jD: [-0.19, 0.02, 0.36, 0.5, 0.04] };
  const A_GENOUX_AIR = { jG: [-0.12, 0.1, 1.55, 0.35, 0.05], jD: [-0.2, 0.08, 1.62, 0.35, 0.02] };
  const POINGS_BAS = { mG: [0.25, -0.33, 0.05], mD: [-0.25, -0.33, 0.05], dG: 'poing', dD: 'poing', paG: [-0.95, 0, 0.2], paD: [0.95, 0, 0.2], fG: [0.05, 0], fD: [0.05, 0], pG: [0.85, -0.2, -0.5], pD: [-0.85, -0.2, -0.5] };
  const RAGE = Object.assign({}, POINGS_BAS, { mG: [0.3, -0.26, 0.14], mD: [-0.3, -0.26, 0.14], pG: [0.95, -0.15, -0.25], pD: [-0.95, -0.15, -0.25], paG: [-0.8, -0.3, 0.5], paD: [0.8, -0.3, 0.5],
    cG: [0.24, 0.16], cD: [0.24, 0.16], ch: [0.16, 0, 0], sp: [0.14, 0, 0], nk: [0.2, 0, 0], hd: [-0.16, 0, 0], h: [0, 0.03, 0.02],
    jG: [-0.45, 0.09, 0.85, 0.3, 0.06], jD: [-0.55, 0.07, 1.0, 0.28, 0.04], tr: 0.9, rs: 1.8, lu: 1.8, au: 1.5, mach: 0.12 });
  const LAMES_BAS = { // traque : lames basses qui traînent derrière
    mG: [0.27, -0.36, -0.2], mD: [-0.27, -0.36, -0.2], pG: [0.9, 0.15, -0.3], pD: [-0.9, 0.15, -0.3],
    paG: [0.95, 0.15, 0.1], paD: [-0.95, 0.15, 0.1], fG: [0.1, 0.25], fD: [0.1, 0.25], dG: 'tenir', dD: 'tenir'
  };
  const COUCHE = { // allongé face au sol (cadavre)
    rp: 1.5, sol: 1, h: [0, -0.875, -0.08], hr: [0, 0, 0], sp: [-0.04, 0.1, 0.03], ch: [-0.05, 0.12, 0.0], nk: [-0.12, 0.45, 0.1], hd: [-0.1, 0.65, 0.15],
    mG: [0.42, 0.22, 0.14], pG: [0.3, 0.4, -0.8], paG: [0, 0, 1], mD: [-0.25, -0.38, 0.0], pD: [-0.6, 0.2, -0.7], paD: [0.4, 0, 0.9],
    fG: [0.25, 0], fD: [0.3, 0], dG: { detendue: 0.7, griffe: 0.3 }, dD: { detendue: 0.8, crochue: 0.2 },
    jG: [0.04, 0.1, 0.1, 1.15, 0.45], jD: [0.02, 0.2, 0.22, 1.1, 0.85], cG: [0.25, 0.2], cD: [-0.05, 0], lu: 0, au: 0, rs: 0, rg: 0, cl: 0.85, mach: 0.25
  };

  // ---------------------------------------------------------------- clips
  const CLIPS = {
    flotte: { boucle: true, periode: 7.0, fondu: 0.35, cles: [
      [0, {}],
      [0.5, { hd: [-0.05, 0.03, 0.06], ch: [-0.07, 0.035, 0], dG: { detendue: 0.35, griffe: 0.65 }, dD: { detendue: 0.7, griffe: 0.3 }, mD: [-0.24, -0.355, 0.07], fD: [0.2, 0.05] }],
      [1, {}]
    ] },
    apparition: { fondu: 0.05, cles: [
      [0, { sp: [0.45, 0, 0], ch: [0.35, 0, 0], nk: [0.3, 0, 0], hd: [0.38, 0, 0], hr: [0.25, 0, 0], h: [0, 0.12, 0.05],
        mG: [-0.04, -0.03, 0.2], mD: [0.05, -0.08, 0.21], paG: [0.3, 0, -1], paD: [-0.3, 0, -1], pG: [0.9, -0.3, 0], pD: [-0.9, -0.3, 0],
        cG: [0.15, 0.25], cD: [0.15, 0.25], dG: 'poing', dD: 'poing', jG: [-1.35, 0.1, 2.05, 0.6, 0.1], jD: [-1.3, 0.06, 2.0, 0.55, 0.05], lu: 0, cl: 1, au: 0.2, rg: 0 }],
      [0.45, { sp: [0.38, 0, 0], ch: [0.3, 0, 0], hd: [0.32, 0, 0], au: 0.6 }, 's'],
      [0.74, { sp: [-0.12, 0, 0], ch: [-0.2, 0, 0], nk: [-0.05, 0, 0], hd: [-0.12, 0, 0], hr: [0.02, 0, 0], h: [0, 0, 0],
        mG: [0.4, -0.22, 0.1], mD: [-0.4, -0.22, 0.1], paG: [0, 0, 1], paD: [0, 0, 1], pG: [0.8, -0.3, -0.5], pD: [-0.8, -0.3, -0.5], cG: [0.05, -0.05], cD: [0.05, -0.05],
        dG: 'ouverte', dD: 'ouverte', jG: [-0.15, 0.05, 0.3, 0.6, 0.05], jD: [-0.25, 0.03, 0.4, 0.55, 0.04], lu: 0.4, cl: 0.3, rg: 0.5 }, 'o'],
      [0.86, { lu: 2.2, cl: 0, hd: [-0.08, 0.02, 0.05], au: 1.4, rg: 1 }, 's'],
      [1, Object.assign({}, POSE_BASE), 's']
    ] },
    incantation: { fondu: 0.2, cles: [
      [0, {}],
      [0.13, { mG: [0.27, -0.4, -0.03], mD: [-0.27, -0.4, -0.03], ch: [0.06, 0, 0], hd: [0.06, 0, 0], cG: [-0.08, 0.1], cD: [-0.08, 0.1], dG: 'detendue', dD: 'detendue' }, 's'],
      [0.58, Object.assign({}, BRAS_HAUT, { h: [0, 0.02, 0.01], tr: 0.1 }), 'b'],
      [0.82, { mG: [0.36, 0.63, 0.1], mD: [-0.36, 0.63, 0.1], tr: 0.45, lu: 1.4, au: 1.3 }, 's'],
      [1, { mG: [0.37, 0.64, 0.1], mD: [-0.37, 0.64, 0.1], tr: 0.6 }, 's']
    ] },
    projection: { fondu: 0.06, cles: [
      [0, Object.assign({}, BRAS_HAUT, { mG: [0.37, 0.64, 0.1], mD: [-0.37, 0.64, 0.1], tr: 0.6, lu: 1.4, au: 1.3 })],
      [0.42, { vD: 1, ext: 1.0, dD: { ouverte: 0.7, griffe: 0.3 }, paD: [0, -0.6, 0.8], ch: [0.17, -0.18, 0], sp: [0.08, -0.08, 0], nk: [0.05, 0, 0], hd: [0.12, 0, 0], cD: [0.0, 0.25],
        mG: [0.44, 0.34, -0.06], dG: 'griffe', tr: 0.2, h: [0, 0, 0.02], jG: [-0.22, 0.04, 0.4, 0.5, 0.06], jD: [-0.05, 0.02, 0.2, 0.6, 0.04] }, 'o'],
      [1, { vD: 1, ext: 0.98, ch: [0.14, -0.15, 0], tr: 0.1 }, 's']
    ] },
    'retour-incantation': { fondu: 0.08, cles: [
      [0, { vD: 1, ext: 0.98, dD: 'ouverte', paD: [0, -0.4, 1], ch: [0.14, -0.15, 0], sp: [0.08, -0.08, 0], hd: [0.12, 0, 0], cD: [0.0, 0.25], mG: [0.44, 0.34, -0.06], dG: 'griffe', cG: [0.28, 0.05] }],
      [0.32, { vD: 0.2, mD: [-0.27, -0.32, 0.16], mG: [0.26, -0.35, 0.1], paG: [-0.85, 0, 0.5], pG: [0.5, -0.5, -0.7], cG: [0.22, 0.28], cD: [0.2, 0.3], ch: [0.1, -0.05, 0], sp: [0.05, 0, 0], hd: [0.1, 0, 0.14], dD: 'detendue', dG: 'detendue' }, 's'],
      [0.62, { vD: 0, cG: [-0.08, -0.15], cD: [-0.08, -0.15], ch: [-0.1, 0, 0], hd: [-0.08, 0, -0.04] }, 's'],
      [1, Object.assign({}, POSE_BASE), 's']
    ] },
    'double-incantation': { fondu: 0.2, cles: [
      [0, {}],
      [0.13, { mG: [0.28, -0.42, -0.04], mD: [-0.28, -0.42, -0.04], ch: [0.08, 0, 0], hd: [0.08, 0, 0], cG: [-0.1, 0.12], cD: [-0.1, 0.12], dG: 'detendue', dD: 'detendue', jG: [-0.3, 0.05, 0.6, 0.5, 0.06], jD: [-0.35, 0.03, 0.7, 0.5, 0.04] }, 's'],
      [0.58, Object.assign({}, BRAS_HAUT, { mG: [0.42, 0.56, 0.06], mD: [-0.42, 0.56, 0.06], h: [0, 0.03, 0.01], ch: [-0.2, 0, 0], tr: 0.15, jG: [-0.05, 0.08, 0.15, 0.65, 0.06], jD: [-0.1, 0.06, 0.2, 0.6, 0.04] }), 'b'],
      [0.82, { mG: [0.45, 0.58, 0.05], mD: [-0.45, 0.58, 0.05], tr: 0.55, lu: 1.6, au: 1.5 }, 's'],
      [1, { tr: 0.7 }, 's']
    ] },
    'double-projection': { fondu: 0.06, cles: [
      [0, Object.assign({}, BRAS_HAUT, { mG: [0.45, 0.58, 0.05], mD: [-0.45, 0.58, 0.05], ch: [-0.2, 0, 0], tr: 0.7, lu: 1.6, au: 1.5 })],
      [0.42, { vG: 1, vD: 1, ext: 1.0, dG: 'ouverte', dD: 'ouverte', paG: [0, -0.4, 1], paD: [0, -0.4, 1], ch: [0.2, 0, 0], sp: [0.1, 0, 0], hd: [0.14, 0, 0], cG: [0.0, 0.25], cD: [0.0, 0.25], tr: 0.2,
        jG: [-0.3, 0.06, 0.5, 0.5, 0.06], jD: [-0.3, 0.05, 0.5, 0.5, 0.04] }, 'o'],
      [1, { ch: [0.16, 0, 0], tr: 0.1 }, 's']
    ] },
    vacille: { fondu: 0.06, cles: [
      [0, {}],
      [0.12, { ch: [-0.32, 0.06, 0.05], sp: [-0.16, 0, 0], nk: [-0.15, 0, 0], hd: [-0.38, 0.1, 0.1], h: [0, 0.03, -0.06], mG: [0.52, 0.08, -0.1], mD: [-0.48, 0.0, -0.06],
        paG: [0, 0.2, 1], paD: [0, 0.2, 1], dG: 'ouverte', dD: 'ouverte', cG: [0.2, -0.1], cD: [0.15, -0.1], jG: [-0.55, 0.12, 0.7, 0.4, 0.1], jD: [-0.35, 0.08, 0.45, 0.45, 0.05], mach: 0.55, lu: 0.6, au: 0.5 }, 'o'],
      [0.36, { rr: 0.22, ch: [-0.12, 0.12, 0.1], hd: [0.05, -0.15, 0.2], mD: [-0.42, 0.42, 0.06], mG: [0.36, -0.28, 0.12], dG: 'griffe', jG: [-0.2, 0.18, 0.35, 0.5, 0.1], jD: [-0.6, 0.02, 0.9, 0.4, 0.05], mach: 0.2 }, 's'],
      [0.62, { rr: -0.1, ch: [0.08, -0.05, -0.04], hd: [0.1, 0.05, -0.08], mD: [-0.3, -0.25, 0.12], mG: [0.3, -0.3, 0.08], dD: 'griffe', lu: 1.0, au: 0.9 }, 's'],
      [1, Object.assign({}, POSE_BASE, { ch: [0.04, 0, 0], hd: [0.03, 0, 0] }), 's']
    ] },
    'souffrance-colere': { fondu: 0.12, cles: [
      [0, {}],
      [0.1, { sp: [0.25, 0.05, 0], ch: [0.26, 0, 0], nk: [0.15, 0, 0], hd: [0.25, 0.1, 0.05], mD: [-0.07, 0.25, 0.18], paD: [0.2, 0, -1], pD: [-0.9, -0.3, -0.2], fD: [-0.2, 0],
        mG: [0.07, 0.04, 0.17], paG: [-0.2, 0, -1], pG: [0.9, -0.4, -0.1], dG: 'griffe', dD: 'griffe', jG: [-0.55, 0.1, 0.95, 0.4, 0.1], jD: [-0.4, 0.06, 0.8, 0.45, 0.05], mach: 0.25, tr: 0.6, rg: 0.2 }, 'o'],
      [0.28, { sp: [0.28, 0.25, 0.05], ch: [0.25, 0.2, 0.06], rr: 0.12, hd: [0.18, -0.25, 0.2], mD: [-0.05, 0.17, 0.18], mach: 0.45, tr: 0.8 }, 's'],
      [0.43, { sp: [0.42, 0, 0], ch: [0.32, 0, 0], rr: 0, nk: [0.25, 0, 0], hd: [0.32, 0, 0], mG: [-0.03, 0.0, 0.16], mD: [0.04, 0.03, 0.16], paG: [0.6, 0, -0.8], paD: [-0.6, 0, -0.8],
        pG: [0.9, -0.4, 0], pD: [-0.9, -0.4, 0], dG: 'poing', dD: 'poing', jG: [-0.85, 0.1, 1.35, 0.4, 0.1], jD: [-0.8, 0.06, 1.3, 0.4, 0.05], cG: [0.2, 0.3], cD: [0.2, 0.3], mach: 0.2, tr: 1.0, au: 0.6, lu: 0.6 }, 's'],
      [0.55, { sp: [-0.2, 0, 0], ch: [-0.36, 0, 0], nk: [-0.3, 0, 0], hd: [-0.48, 0, 0], h: [0, 0.04, 0], mG: [0.6, 0.44, 0.06], mD: [-0.6, 0.44, 0.06], paG: [0.1, 0.4, 1], paD: [-0.1, 0.4, 1],
        pG: [0.6, -0.6, -0.5], pD: [-0.6, -0.6, -0.5], dG: 'griffe', dD: 'griffe', fG: [-0.4, 0], fD: [-0.4, 0], cG: [0.25, -0.1], cD: [0.25, -0.1],
        jG: [0.08, 0.16, 0.1, 0.85, 0.1], jD: [0.05, 0.14, 0.12, 0.8, 0.08], mach: 1, lu: 2.6, au: 2.2, tr: 0.5 }, 'o'],
      [0.76, { mG: [0.62, 0.46, 0.04], mD: [-0.62, 0.46, 0.04], hd: [-0.45, 0.05, 0.03], mach: 1, tr: 1.2 }, 's'],
      [0.9, { mach: 0.3, mG: [0.45, 0.0, 0.08], mD: [-0.45, 0.0, 0.08], hd: [-0.1, 0, 0], ch: [-0.15, 0, 0], tr: 0.4, lu: 1.4, au: 1.4 }, 's'],
      [1, Object.assign({}, POSE_BASE, { ch: [0.05, 0, 0], hd: [0.08, 0, 0], rs: 1.6 }), 's']
    ] },
    meditation: { boucle: true, periode: 5.0, fondu: 0.6, cles: [
      [0, { mG: [0.31, -0.33, 0.07], mD: [-0.31, -0.33, 0.07], paG: [0.0, 0.1, 1], paD: [0.0, 0.1, 1], pG: [0.7, -0.4, -0.6], pD: [-0.7, -0.4, -0.6], fG: [-0.15, 0], fD: [-0.15, 0],
        dG: { ouverte: 0.75, detendue: 0.25 }, dD: { ouverte: 0.75, detendue: 0.25 }, hd: [-0.1, 0, 0], ch: [-0.1, 0, 0], cG: [-0.05, -0.08], cD: [-0.05, -0.08],
        jG: [-0.04, 0.0, 0.12, 0.75, 0.02], jD: [-0.06, 0.0, 0.14, 0.72, 0.0], rs: 0.7, au: 0.9, lu: 1.2 }],
      [0.5, { mG: [0.33, -0.3, 0.07], mD: [-0.33, -0.3, 0.07], hd: [-0.14, 0, 0], ch: [-0.13, 0, 0], au: 1.6, lu: 1.5 }, 's'],
      [1, { mG: [0.31, -0.33, 0.07], mD: [-0.31, -0.33, 0.07], hd: [-0.1, 0, 0], ch: [-0.1, 0, 0], au: 0.9, lu: 1.2 }, 's']
    ] },
    absorption: { fondu: 0.2, cles: [
      [0, {}],
      [0.1, { mG: [0.12, -0.08, 0.15], mD: [-0.12, -0.08, 0.15], dG: 'poing', dD: 'poing', paG: [0, 0.5, -0.8], paD: [0, 0.5, -0.8], ch: [0.12, 0, 0], sp: [0.06, 0, 0], hd: [0.1, 0, 0], cG: [0.1, 0.2], cD: [0.1, 0.2],
        jG: [-0.4, 0.06, 0.7, 0.45, 0.06], jD: [-0.45, 0.05, 0.75, 0.45, 0.04] }, 's'],
      [0.22, { mG: [0.31, -0.13, 0.43], mD: [-0.31, -0.13, 0.43], paG: [-0.2, 1, 0.25], paD: [0.2, 1, 0.25], pG: [0.8, -0.5, -0.3], pD: [-0.8, -0.5, -0.3], dG: 'ouverte', dD: 'ouverte', fG: [-0.25, 0], fD: [-0.25, 0],
        ch: [0.0, 0, 0], sp: [-0.04, 0, 0], hd: [0.0, 0, 0], cG: [0.05, 0.25], cD: [0.05, 0.25], jG: [-0.1, 0.06, 0.25, 0.6, 0.06], jD: [-0.18, 0.04, 0.35, 0.55, 0.04] }, 'o'],
      [0.36, { mG: [0.34, -0.14, 0.42], mD: [-0.34, -0.14, 0.42], dG: 'crochue', dD: 'crochue', fG: [0.3, 0], fD: [0.3, 0], sp: [-0.16, 0, 0], ch: [-0.22, 0, 0], hd: [-0.18, 0, 0], nk: [-0.05, 0, 0], mach: 0.55, tr: 0.55, lu: 1.6, au: 1.4 }, 's'],
      [0.6, { mG: [0.33, -0.1, 0.39], mD: [-0.33, -0.1, 0.39], ch: [-0.27, 0, 0], hd: [-0.22, 0, 0], mach: 0.7, tr: 0.7 }, 's'],
      [0.82, { mG: [0.3, -0.06, 0.34], mD: [-0.3, -0.06, 0.34], ch: [-0.3, 0, 0], mach: 0.75, tr: 0.8, lu: 2.0, au: 1.8 }, 's'],
      [0.93, { mG: [0.13, 0.04, 0.19], mD: [-0.13, 0.04, 0.19], paG: [0, 0, -1], paD: [0, 0, -1], dG: 'griffe', dD: 'griffe', ch: [-0.32, 0, 0], hd: [-0.3, 0, 0], mach: 0.9, tr: 0.4 }, 's'],
      [1, { mG: [0.2, -0.2, 0.12], mD: [-0.2, -0.2, 0.12], ch: [-0.15, 0, 0], hd: [-0.1, 0, 0], mach: 0.2, tr: 0.2 }, 's']
    ] },
    'transformation-ailes': { fondu: 0.15, cles: [
      [0, {}],
      [0.24, { sp: [0.45, 0, 0], ch: [0.36, 0, 0], nk: [0.22, 0, 0], hd: [0.3, 0, 0], mG: [-0.06, -0.06, 0.18], mD: [0.06, -0.04, 0.18], paG: [0.6, 0, -0.8], paD: [-0.6, 0, -0.8],
        pG: [0.9, -0.3, 0.1], pD: [-0.9, -0.3, 0.1], dG: 'griffe', dD: 'griffe', cG: [0.25, 0.35], cD: [0.25, 0.35], jG: [-0.9, 0.08, 1.45, 0.45, 0.08], jD: [-0.95, 0.06, 1.5, 0.45, 0.05], mach: 0.3, tr: 0.8, au: 0.8, rg: 0.3 }, 's'],
      [0.56, { sp: [0.5, 0, 0], ch: [0.4, 0, 0], tr: 1.3, mach: 0.5, cG: [0.32, 0.4], cD: [0.32, 0.4] }, 's'],
      [0.74, { sp: [-0.18, 0, 0], ch: [-0.36, 0, 0], nk: [-0.2, 0, 0], hd: [-0.36, 0, 0], mG: [0.56, -0.12, -0.16], mD: [-0.56, -0.12, -0.16], paG: [0, 0, 1], paD: [0, 0, 1], pG: [0.6, -0.5, -0.6], pD: [-0.6, -0.5, -0.6],
        dG: 'ouverte', dD: 'ouverte', cG: [0.1, -0.2], cD: [0.1, -0.2], jG: [0.05, 0.12, 0.15, 0.8, 0.08], jD: [0.0, 0.1, 0.2, 0.75, 0.06], mach: 1, tr: 0.5, lu: 2.4, au: 2.0, rg: 0.6 }, 'o'],
      [1, { sp: [-0.04, 0, 0], ch: [-0.12, 0, 0], nk: [0, 0, 0], hd: [-0.08, 0, 0], mG: [0.34, -0.3, -0.02], mD: [-0.34, -0.3, -0.02], paG: [-0.4, 0, 0.9], paD: [0.4, 0, 0.9], dG: 'griffe', dD: 'griffe', cG: [0, 0], cD: [0, 0],
        jG: [-0.06, 0.06, 0.25, 0.7, 0.06], jD: [-0.12, 0.05, 0.3, 0.65, 0.04], mach: 0.1, tr: 0.15, lu: 1.6, au: 1.4, rg: 1, ail: [1, 0.25, 0.5, 0, 0] }, 's']
    ] },
    envol: { fondu: 0.2, cles: [
      [0, { mG: [0.3, -0.32, -0.08], mD: [-0.3, -0.32, -0.08], dG: 'griffe', dD: 'griffe', ch: [0.08, 0, 0], sp: [0.06, 0, 0], hd: [-0.1, 0, 0], jG: [0.05, 0.05, 0.3, 0.7, 0.05], jD: [0.0, 0.04, 0.4, 0.65, 0.03], ail: [1, 0.55, 1.6, 0, 0.05], lu: 1.5 }],
      [0.5, { ch: [0.12, 0, 0], ail: [1, 0.6, 1.7, 0, 0.1] }, 's'],
      [1, { ch: [0.08, 0, 0], ail: [1, 0.45, 1.5, 0, 0.05] }, 's']
    ] },
    verrouillage: { fondu: 0.25, cles: [
      [0, { rp: 0.2, mG: [0.26, -0.28, -0.22], mD: [-0.26, -0.28, -0.22], paG: [-0.3, 0, -1], paD: [0.3, 0, -1], pG: [0.6, 0.2, -0.8], pD: [-0.6, 0.2, -0.8], dG: 'griffe', dD: 'griffe',
        ch: [-0.05, 0, 0], nk: [-0.2, 0, 0], hd: [-0.25, 0, 0], jG: [0.25, 0.06, 0.35, 0.8, 0.05], jD: [0.2, 0.05, 0.45, 0.75, 0.03], ail: [1, 0.08, 3.5, 0, 0.2], lu: 2.0, au: 1.6, tr: 0.2 }],
      [0.7, { rp: 0.42, nk: [-0.32, 0, 0], hd: [-0.35, 0, 0], ail: [1, 0.06, 4.5, 0, 0.3], tr: 0.35 }, 's'],
      [1, { rp: 0.3, ch: [-0.12, 0, 0], ail: [1, 0.03, 5, 0.1, 0.42], tr: 0.5 }, 's']
    ] },
    pique: { fondu: 0.12, cles: [
      [0, { rp: 1.3, mG: [0.17, -0.34, -0.07], mD: [-0.17, -0.34, -0.07], paG: [-1, 0, 0], paD: [1, 0, 0], pG: [0.9, 0, -0.4], pD: [-0.9, 0, -0.4], dG: 'poing', dD: 'poing', fG: [0, 0], fD: [0, 0],
        sp: [-0.05, 0, 0], ch: [-0.1, 0, 0], nk: [-0.4, 0, 0], hd: [-0.55, 0, 0], jG: [0.04, 0.0, 0.05, 0.95, 0.0], jD: [0.04, 0.0, 0.08, 0.95, 0.0], cG: [0.05, -0.1], cD: [0.05, -0.1],
        ail: [0.5, 0.0, 0, 1, -0.1], mach: 0.6, lu: 2.4, au: 1.8, rg: 0.5 }],
      [1, { rp: 1.35, mach: 0.8 }, 's']
    ] },
    'impact-pique': { fondu: 0.04, cles: [
      [0, { rp: 1.2, sp: [-0.05, 0, 0], ch: [-0.1, 0, 0], nk: [-0.4, 0, 0], hd: [-0.5, 0, 0], dG: 'poing', dD: 'poing', jG: [0.04, 0, 0.05, 0.95, 0], jD: [0.04, 0, 0.08, 0.95, 0], ail: [0.5, 0, 0, 1, -0.1] }],
      [0.2, { rp: 0, sol: 1, h: [0, -0.52, 0.06], sp: [0.42, 0, 0], ch: [0.3, 0, 0], nk: [0.1, 0, 0], hd: [0.18, 0, 0], jG: [-1.5, 0.15, 1.45, 0.3, 0.2], jD: [-0.1, 0.1, 1.6, 0.6, 0.1],
        msD: [-0.24, 0.34, 1], mG: [0.32, -0.25, 0.2], paG: [0, -1, 0.3], dD: 'ouverte', dG: 'griffe', mach: 1, lu: 2.0, ail: [0.3, 0, 0, 0.3, -0.5] }, 'o'],
      [0.6, { h: [0, -0.48, 0.05], sp: [0.35, 0, 0], ch: [0.22, 0, 0], hd: [0.05, 0, 0], mach: 0.6 }, 's'],
      [1, { h: [0, -0.47, 0.05], sp: [0.32, 0, 0], ch: [0.22, 0, 0], mach: 0.4 }, 's']
    ] },
    etourdi: { fondu: 0.25, cles: [
      [0, Object.assign({}, A_GENOUX_AIR, { h: [0, -0.32, 0.04], sp: [0.25, 0, 0], ch: [0.18, 0, 0], nk: [0.15, 0, 0], hd: [0.3, 0, 0], mD: [-0.06, 0.22, 0.17], paD: [0.2, 0, -1], pD: [-0.9, -0.3, 0], fD: [-0.1, 0], dD: 'griffe',
        mG: [0.18, -0.42, 0.22], paG: [-0.2, -1, 0.2], dG: { detendue: 0.6, griffe: 0.4 }, cG: [0.0, 0.15], cD: [0.15, 0.2], mach: 0.3, lu: 0.7, au: 0.5, rg: 0.2, tr: 0.3 })],
      [0.5, { sp: [0.3, 0, 0], hd: [0.35, 0, 0], mD: [-0.07, 0.18, 0.18] }, 's'],
      [1, { sp: [0.18, 0, 0], hd: [0.15, 0, 0], mD: [-0.22, -0.2, 0.18], paD: [0.6, -0.4, 0.6], dD: 'detendue', lu: 1.0, rg: 0.6 }, 's']
    ] },
    remontee: { fondu: 0.15, cles: [
      [0, Object.assign({}, A_GENOUX_AIR, { h: [0, -0.32, 0.04], sp: [0.18, 0, 0], ch: [0.18, 0, 0], nk: [0.15, 0, 0], hd: [0.15, 0, 0], mD: [-0.22, -0.2, 0.18], mG: [0.18, -0.42, 0.22], dD: 'detendue', dG: 'detendue', lu: 1.0 })],
      [0.25, { h: [0, -0.38, 0.04], sp: [0.32, 0, 0], ch: [0.22, 0, 0], hd: [0.25, 0, 0], mG: [0.2, -0.45, 0.2], mD: [-0.2, -0.45, 0.2] }, 's'],
      [0.62, { h: [0, 0.03, 0], sp: [-0.08, 0, 0], ch: [-0.14, 0, 0], nk: [-0.02, 0, 0], hd: [-0.15, 0, 0], mG: [0.38, -0.22, 0.04], mD: [-0.38, -0.22, 0.04], paG: [0, 0, 1], paD: [0, 0, 1],
        dG: 'griffe', dD: 'griffe', jG: [-0.05, 0.05, 0.2, 0.7, 0.05], jD: [-0.1, 0.04, 0.25, 0.65, 0.04], lu: 1.6, au: 1.4 }, 'o'],
      [1, Object.assign({}, POSE_BASE), 's']
    ] },
    souffrance: { fondu: 0.12, cles: [
      [0, {}],
      [0.14, { sp: [0.5, 0, 0], ch: [0.36, 0, 0], nk: [0.2, 0, 0], hd: [0.26, 0, 0], mG: [0.04, -0.2, 0.17], mD: [-0.07, -0.13, 0.17], paG: [-0.3, 0, -1], paD: [0.3, 0.2, -1], pG: [0.9, -0.3, 0], pD: [-0.9, -0.3, 0],
        dG: 'crochue', dD: 'griffe', cG: [0.2, 0.3], cD: [0.2, 0.3], jG: [-0.9, 0.08, 1.25, 0.4, 0.08], jD: [-0.75, 0.05, 1.1, 0.45, 0.05], mach: 0.5, tr: 0.7, rg: 0.1, au: 0.6, lu: 0.8 }, 'o'],
      [0.42, { sp: [0.22, 0, 0], ch: [-0.08, 0, 0], nk: [-0.1, 0, 0], hd: [-0.25, 0.1, 0.08], mach: 0.95, tr: 1.0 }, 'o'],
      [0.62, { sp: [0.55, 0, 0], ch: [0.38, 0, 0], nk: [0.22, 0, 0], hd: [0.3, -0.1, -0.05], mach: 0.4, tr: 0.8, jG: [-1.0, 0.08, 1.4, 0.4, 0.08], jD: [-0.9, 0.05, 1.3, 0.45, 0.05] }, 's'],
      [1, { sp: [0.52, 0, 0], ch: [0.36, 0, 0], mach: 0.3, tr: 0.9 }, 's']
    ] },
    'teleport-sortie': { fondu: 0.15, cles: [
      [0, {}],
      [0.3, { mG: [0.14, 0.58, 0.06], mD: [-0.14, 0.58, 0.06], paG: [-1, 0, 0], paD: [1, 0, 0], pG: [0.9, 0, -0.3], pD: [-0.9, 0, -0.3], dG: 'ouverte', dD: 'ouverte', cG: [0.35, 0.05], cD: [0.35, 0.05],
        ch: [-0.15, 0, 0], hd: [-0.4, 0, 0], jG: [0.02, -0.02, 0.05, 0.9, 0], jD: [0.02, -0.02, 0.05, 0.9, 0], mach: 0.9, lu: 2.0, rg: 0 }, 's'],
      [1, { mG: [0.1, 0.6, 0.06], mD: [-0.1, 0.6, 0.06], hd: [-0.5, 0, 0], mach: 1 }, 's']
    ] },
    'teleport-entree': { fondu: 0.04, cles: [
      [0, { mG: [0.1, 0.6, 0.06], mD: [-0.1, 0.6, 0.06], paG: [-1, 0, 0], paD: [1, 0, 0], pG: [0.9, 0, -0.3], pD: [-0.9, 0, -0.3], dG: 'ouverte', dD: 'ouverte', cG: [0.35, 0.05], cD: [0.35, 0.05],
        ch: [-0.15, 0, 0], hd: [-0.45, 0, 0], jG: [0.02, -0.02, 0.05, 0.9, 0], jD: [0.02, -0.02, 0.05, 0.9, 0], mach: 0.8, lu: 2.0, rg: 0 }],
      [0.55, { mG: [0.42, -0.1, 0.05], mD: [-0.42, -0.1, 0.05], paG: [0, 0, 1], paD: [0, 0, 1], dG: 'griffe', dD: 'griffe', cG: [0.05, 0], cD: [0.05, 0], ch: [-0.1, 0, 0], hd: [-0.05, 0, 0], mach: 0.2, rg: 0.8,
        jG: [-0.15, 0.05, 0.3, 0.6, 0.05], jD: [-0.22, 0.04, 0.38, 0.55, 0.04] }, 'o'],
      [1, Object.assign({}, POSE_BASE), 's']
    ] },
    'retour-rage': { fondu: 0.05, cles: [
      [0, Object.assign({}, JAMBES_REPLIEES, { sp: [0.45, 0, 0], ch: [0.3, 0, 0], nk: [0.2, 0, 0], hd: [0.38, 0, 0], h: [0, 0.18, 0.04], mG: [0.15, -0.28, 0.24], mD: [-0.15, -0.28, 0.24], paG: [0, -1, 0], paD: [0, -1, 0],
        pG: [0.9, -0.2, -0.2], pD: [-0.9, -0.2, -0.2], dG: 'poing', dD: 'poing', cG: [0.25, 0.25], cD: [0.25, 0.25], lu: 2.2, au: 1.8, tr: 0.9, rg: 0.2 })],
      [0.26, { hd: [0.1, 0, 0], tr: 1.2, lu: 2.6 }, 's'],
      [0.42, { h: [0, 0.02, 0], sp: [-0.12, 0, 0], ch: [-0.3, 0, 0], nk: [-0.1, 0, 0], hd: [-0.3, 0, 0], mG: [0.66, 0.22, 0.04], mD: [-0.66, 0.22, 0.04], paG: [0.1, 0.3, 1], paD: [-0.1, 0.3, 1],
        pG: [0.5, -0.7, -0.5], pD: [-0.5, -0.7, -0.5], dG: 'griffe', dD: 'griffe', fG: [-0.35, 0], fD: [-0.35, 0], cG: [0.15, -0.1], cD: [0.15, -0.1],
        jG: [-0.05, 0.14, 0.15, 0.7, 0.08], jD: [-0.08, 0.12, 0.2, 0.65, 0.06], mach: 1, tr: 0.7, lu: 3.0, au: 2.6, rg: 0.6 }, 'o'],
      [0.72, { mG: [0.67, 0.25, 0.03], mD: [-0.67, 0.25, 0.03], mach: 0.7, tr: 0.9 }, 's'],
      [1, Object.assign({}, RAGE, { mach: 0.1 }), 's']
    ] },
    rage: { boucle: true, periode: 3.2, fondu: 0.3, cles: [
      [0, Object.assign({}, RAGE)],
      [0.45, { cG: [0.22, 0.1], cD: [0.2, 0.1], ch: [0.1, 0.03, 0], mG: [0.26, -0.31, 0.07], mD: [-0.26, -0.31, 0.07], mach: 0.15 }, 's'],
      [1, Object.assign({}, RAGE), 's']
    ] },
    'designation-mur': { fondu: 0.08, cles: [
      [0, Object.assign({}, RAGE)],
      [0.45, { vD: 1, ext: 0.84, dD: 'griffe', paD: [0.95, 0.15, 0.25], fD: [-0.2, 0.1], cD: [0.1, 0.2], ch: [0.12, -0.2, 0], sp: [0.06, -0.08, 0], hd: [0.0, 0, 0], tr: 0.4, mach: 0.3 }, 'o'],
      [1, { vD: 1, ext: 0.82, dD: { griffe: 0.6, crochue: 0.4 }, paD: [0.9, 0.1, 0.35], tr: 0.7 }, 's']
    ] },
    'saisie-mur': { fondu: 0.08, cles: [
      [0, Object.assign({}, RAGE, { vD: 1, ext: 0.84, dD: { griffe: 0.6, crochue: 0.4 }, paD: [0.9, 0.1, 0.35], fD: [-0.2, 0.1], cD: [0.1, 0.2], ch: [0.12, -0.2, 0], sp: [0.06, -0.08, 0], tr: 0.7 })],
      [0.36, { vD: 0.9, dD: 'poing', ch: [0.0, -0.22, 0], sp: [-0.02, -0.1, 0], tr: 1.4, mach: 0.45, lu: 2.0 }, 's'],
      [0.5, { vD: 0, mD: [-0.25, 0.02, 0.06], pD: [-0.7, -0.6, -0.4], paD: [0.6, 0.2, -0.8], fD: [0, 0], ch: [-0.22, -0.32, 0], sp: [-0.1, -0.18, 0], hd: [-0.08, 0, 0], cD: [0.25, -0.2], tr: 0.6, mach: 0.85,
        mG: [0.34, -0.12, 0.32], paG: [-0.3, -0.2, 1], dG: 'griffe', h: [0, 0.03, -0.05] }, 'o'],
      [0.84, { mD: [-0.43, 0.54, 0.03], pD: [-0.9, 0.1, -0.4], paD: [0.2, 1, 0.1], fD: [-0.5, 0], dD: 'griffe', ch: [-0.24, -0.22, 0.05], sp: [-0.1, -0.12, 0], hd: [-0.18, 0.12, 0], cD: [0.4, 0.0],
        mG: [0.31, -0.22, 0.27], mach: 0.3, tr: 0.7, h: [0, 0.02, -0.03] }, 's'],
      [1, { mD: [-0.44, 0.56, 0.02], tr: 0.8 }, 's']
    ] },
    lancer: { fondu: 0.05, cles: [
      [0, Object.assign({}, RAGE, { mD: [-0.44, 0.56, 0.02], jG: [-0.24, 0.07, 0.5, 0.3, 0.05], jD: [-0.32, 0.06, 0.6, 0.28, 0.03], pD: [-0.9, 0.1, -0.4], paD: [0.2, 1, 0.1], fD: [-0.5, 0], dD: 'griffe', ch: [-0.24, -0.22, 0.05], sp: [-0.1, -0.12, 0], hd: [-0.18, 0.12, 0], cD: [0.4, 0.0], mG: [0.31, -0.22, 0.27], paG: [-0.3, -0.2, 1], dG: 'griffe' })],
      [0.18, { mD: [-0.38, 0.5, -0.22], ch: [-0.32, -0.3, 0.05], sp: [-0.14, -0.16, 0], mG: [0.4, -0.02, 0.3], tr: 0.2, h: [0, 0.02, -0.04] }, 's'],
      [0.5, { vD: 1, ext: 1.0, dD: 'ouverte', paD: [0, -0.2, 1], fD: [-0.3, 0], ch: [0.2, 0.3, 0], sp: [0.14, 0.12, 0], hd: [0.08, 0, 0], cD: [0.0, 0.3], mG: [0.34, -0.22, -0.18], paG: [-0.8, 0, -0.5],
        mach: 0.8, jG: [-0.35, 0.05, 0.6, 0.45, 0.06], jD: [0.05, 0.03, 0.2, 0.6, 0.04] }, 'o'],
      [1, { vD: 0, mD: [0.06, -0.3, 0.28], pD: [-0.7, -0.5, -0.4], paD: [0.6, -0.5, 0.6], dD: 'detendue', ch: [0.26, 0.32, 0], sp: [0.18, 0.12, 0], hd: [0.1, 0, 0], mach: 0.2 }, 's']
    ] },
    repulsion: { fondu: 0.1, cles: [
      [0, Object.assign({}, RAGE)],
      [0.52, { mG: [-0.07, 0.06, 0.17], mD: [0.08, 0.03, 0.17], paG: [0.6, 0, -0.8], paD: [-0.6, 0, -0.8], pG: [0.9, -0.3, 0], pD: [-0.9, -0.3, 0], dG: 'poing', dD: 'poing', sp: [0.26, 0, 0], ch: [0.3, 0, 0],
        hd: [0.2, 0, 0], cG: [0.25, 0.3], cD: [0.25, 0.3], jG: [-0.65, 0.05, 1.05, 0.4, 0.06], jD: [-0.6, 0.04, 1.0, 0.4, 0.04], tr: 1.3, au: 1.7, lu: 2.0, mach: 0.3 }, 's'],
      [0.64, { mG: [0.68, 0.06, -0.04], mD: [-0.68, 0.06, -0.04], paG: [1, 0.1, 0.2], paD: [-1, 0.1, 0.2], pG: [0.3, -0.9, -0.3], pD: [-0.3, -0.9, -0.3], dG: 'ouverte', dD: 'ouverte', fG: [-0.6, 0], fD: [-0.6, 0],
        sp: [-0.12, 0, 0], ch: [-0.3, 0, 0], hd: [-0.25, 0, 0], cG: [0.1, -0.2], cD: [0.1, -0.2], jG: [0.05, 0.3, 0.1, 0.75, 0.1], jD: [0.05, 0.28, 0.12, 0.7, 0.08], mach: 1, tr: 0.4, au: 2.4, lu: 2.6 }, 'o'],
      [1, { mG: [0.5, -0.12, 0.0], mD: [-0.5, -0.12, 0.0], dG: 'griffe', dD: 'griffe', ch: [-0.1, 0, 0], hd: [-0.05, 0, 0], mach: 0.2, tr: 0.5, au: 1.5, lu: 1.6, jG: [-0.2, 0.08, 0.4, 0.4, 0.05], jD: [-0.25, 0.06, 0.5, 0.35, 0.03] }, 's']
    ] },
    affaiblissement: { fondu: 0.2, cles: [
      [0, {}],
      [0.18, { rr: 0.17, sp: [0.15, 0.1, 0.05], ch: [0.1, 0, 0], hd: [0.15, 0.1, 0.12], mG: [0.42, -0.15, 0.1], mD: [-0.25, -0.38, 0.1], dG: 'ouverte', dD: 'detendue', jG: [-0.4, 0.15, 0.8, 0.3, 0.1], jD: [-0.2, 0.05, 0.5, 0.35, 0.04], au: 0.5, lu: 0.7, tr: 0.4 }, 's'],
      [0.38, { rr: -0.15, sp: [0.3, -0.08, -0.04], ch: [0.18, 0, 0], hd: [0.25, -0.1, -0.1], mG: [0.25, -0.38, 0.12], mD: [-0.42, -0.12, 0.12], dG: 'detendue', dD: 'ouverte', au: 0.9, lu: 1.0, jG: [-0.6, 0.06, 1.0, 0.3, 0.06], jD: [-0.5, 0.1, 0.9, 0.3, 0.06] }, 's'],
      [0.55, { au: 0.15, lu: 0.4 }, 's'],
      [0.72, { rr: 0, sol: 1, h: [0, -0.43, 0.02], sp: [0.4, 0, 0], ch: [0.22, 0, 0], nk: [0.2, 0, 0], hd: [0.35, 0, 0], jG: [-1.5, 0.12, 1.5, 0.3, 0.15], jD: [-0.05, 0.08, 1.55, 0.55, 0.05],
        msD: [-0.24, 0.36, 1], mG: [0.15, -0.28, 0.25], paG: [-0.5, -0.6, 0.4], dD: 'ouverte', dG: 'detendue', au: 0.7, lu: 0.9, tr: 0.6, rg: 0.2 }, 'o'],
      [0.85, { au: 0.1, lu: 0.3, h: [0, -0.45, 0.02] }, 's'],
      [1, { au: 0.25, lu: 0.5, sp: [0.45, 0, 0], hd: [0.42, 0, 0] }, 's']
    ] },
    disparition: { fondu: 0.6, cles: [
      [0, { hd: [-0.15, 0, 0], ch: [-0.12, 0, 0], mG: [0.4, -0.3, 0.12], mD: [-0.4, -0.3, 0.12], pG: [0.8, -0.5, -0.3], pD: [-0.8, -0.5, -0.3], paG: [0, 0.6, 0.8], paD: [0, 0.6, 0.8], dG: 'ouverte', dD: 'ouverte', mach: 0.4, rg: 0.3, au: 1.4 }],
      [1, { hd: [-0.38, 0, 0], ch: [-0.24, 0, 0], mG: [0.52, -0.12, 0.08], mD: [-0.52, -0.12, 0.08], mach: 0.7, au: 0.3, lu: 0.4 }, 's']
    ] },
    ramene: { fondu: 0.1, cles: [
      [0, { mG: [0.2, -0.36, -0.16], mD: [-0.2, -0.36, -0.16], paG: [-0.3, 0, -1], paD: [0.3, 0, -1], pG: [0.7, 0.2, -0.7], pD: [-0.7, 0.2, -0.7], dG: 'griffe', dD: 'griffe', sp: [0.2, 0, 0], ch: [0.12, 0, 0],
        hd: [-0.1, 0, 0], cG: [0.1, -0.25], cD: [0.1, -0.25], jG: [-0.5, 0.15, 0.8, 0.4, 0.1], jD: [-0.2, 0.1, 0.5, 0.5, 0.05], mach: 0.8, tr: 1.0, lu: 1.8, au: 1.2, rg: 0.2 }],
      [0.5, { sp: [0.28, 0, 0], hd: [0.05, 0, 0], jG: [-0.2, 0.1, 0.5, 0.5, 0.1], jD: [-0.6, 0.15, 0.9, 0.4, 0.05], mach: 1 }, 's'],
      [1, Object.assign({}, A_GENOUX_AIR, { sp: [0.35, 0, 0], ch: [0.2, 0, 0], nk: [0.2, 0, 0], hd: [0.4, 0, 0], mG: [0.13, -0.45, 0.2], mD: [-0.13, -0.45, 0.2], paG: [-0.6, -0.2, 0.6], paD: [0.6, -0.2, 0.6], dG: 'detendue', dD: 'detendue', mach: 0.2, tr: 0.4, lu: 0.6, au: 0.4 }), 's']
    ] },
    faible: { boucle: true, periode: 6.0, fondu: 0.5, cles: [
      [0, Object.assign({}, A_GENOUX_AIR, { h: [0, -0.3, 0.02], sp: [0.35, 0, 0], ch: [0.2, 0, 0], nk: [0.2, 0, 0], hd: [0.42, 0.05, 0.05], mG: [0.13, -0.45, 0.2], mD: [-0.13, -0.45, 0.2], paG: [-0.6, -0.2, 0.6], paD: [0.6, -0.2, 0.6],
        pG: [0.6, -0.3, -0.6], pD: [-0.6, -0.3, -0.6], dG: 'detendue', dD: 'detendue', cG: [-0.15, 0.1], cD: [-0.15, 0.1], tr: 0.45, lu: 0.55, au: 0.35, rg: 0.25, rs: 1.4 })],
      [0.48, { h: [0, -0.34, 0.02], sp: [0.42, 0, 0], hd: [0.48, 0.0, -0.04], mG: [0.12, -0.48, 0.18], mD: [-0.12, -0.48, 0.18], lu: 0.35 }, 's'],
      [0.6, { h: [0, -0.27, 0.02], sp: [0.18, 0, 0], ch: [0.12, 0, 0], hd: [0.12, -0.1, 0], mG: [0.26, -0.25, 0.34], paG: [0, -0.5, 1], dG: 'griffe', lu: 1.1, au: 0.8, rg: 0.6 }, 'o'],
      [0.8, { h: [0, -0.3, 0.02], sp: [0.33, 0, 0], ch: [0.2, 0, 0], hd: [0.4, 0.05, 0.05], mG: [0.13, -0.45, 0.2], paG: [-0.6, -0.2, 0.6], dG: 'detendue', lu: 0.5, au: 0.35, rg: 0.25 }, 's'],
      [1, {}, 's']
    ] },
    reprise: { fondu: 0.3, cles: [
      [0, Object.assign({}, A_GENOUX_AIR, { h: [0, -0.3, 0.02], sp: [0.35, 0, 0], ch: [0.2, 0, 0], nk: [0.2, 0, 0], hd: [0.42, 0, 0], mG: [0.13, -0.45, 0.2], mD: [-0.13, -0.45, 0.2], paG: [-0.6, -0.2, 0.6], paD: [0.6, -0.2, 0.6], dG: 'detendue', dD: 'detendue', lu: 0.5, au: 0.3 })],
      [0.45, Object.assign({}, POINGS_BAS, JAMBES_PENDANTES, { h: [0, 0, 0], sp: [-0.05, 0, 0], ch: [-0.15, 0, 0], nk: [0, 0, 0], hd: [-0.12, 0, 0], cG: [0.1, -0.05], cD: [0.1, -0.05], lu: 2.0, au: 2.0, tr: 0.6 }), 'o'],
      [0.7, { mG: [0.4, -0.2, 0.04], mD: [-0.4, -0.2, 0.04], dG: 'griffe', dD: 'griffe', au: 2.4, lu: 2.4 }, 's'],
      [1, { mG: [0.44, -0.1, 0.04], mD: [-0.44, -0.1, 0.04], hd: [-0.25, 0, 0], au: 1.0 }, 's']
    ] },
    'rituel-ames': { fondu: 0.3, cles: [
      [0, {}],
      [0.1, Object.assign({}, BRAS_HAUT, { mG: [0.55, 0.38, 0.08], mD: [-0.55, 0.38, 0.08], paG: [0, 0.3, 1], paD: [0, 0.3, 1], dG: 'ouverte', dD: 'ouverte', hd: [-0.3, 0, 0], ch: [-0.25, 0, 0], lu: 2.0, au: 1.8 }), 's'],
      [0.2, { mG: [0.56, 0.5, 0.06], mD: [-0.56, 0.5, 0.06], pG: [0.5, -0.8, -0.3], pD: [-0.5, -0.8, -0.3], dG: 'crochue', dD: 'crochue', ch: [-0.42, 0, 0], sp: [-0.18, 0, 0], hd: [-0.5, 0, 0], mach: 0.8, tr: 0.6, lu: 2.6, au: 2.2,
        jG: [0.02, 0.12, 0.15, 0.8, 0.08], jD: [0.0, 0.1, 0.2, 0.75, 0.06] }, 's'],
      [0.45, { mG: [0.58, 0.47, 0.09], mD: [-0.58, 0.47, 0.09], tr: 0.9, mach: 0.9 }, 's'],
      [0.66, { mG: [0.55, 0.42, 0.13], mD: [-0.55, 0.42, 0.13], tr: 1.1, mach: 1, lu: 3.0, au: 2.6 }, 's'],
      [0.88, { mG: [0.34, 0.14, 0.2], mD: [-0.34, 0.14, 0.2], paG: [-0.5, 0, -0.8], paD: [0.5, 0, -0.8], ch: [-0.45, 0, 0], tr: 1.5 }, 's'],
      [1, { mG: [0.22, 0.1, 0.18], mD: [-0.22, 0.1, 0.18], tr: 1.6 }, 's']
    ] },
    'formation-lames': { fondu: 0.2, cles: [
      [0, {}],
      [0.16, { mG: [0.42, -0.31, 0.15], mD: [-0.42, -0.31, 0.15], paG: [0.2, -1, 0.2], paD: [-0.2, -1, 0.2], pG: [0.8, -0.2, -0.5], pD: [-0.8, -0.2, -0.5], dG: 'ouverte', dD: 'ouverte', fG: [0.1, 0], fD: [0.1, 0],
        hd: [0.28, 0, 0], nk: [0.12, 0, 0], ch: [0.05, 0, 0], tr: 0.3, rg: 0.2, lu: 1.6, au: 1.2 }, 's'],
      [0.5, { dG: 'griffe', dD: 'griffe', tr: 0.9, mG: [0.43, -0.29, 0.17], mD: [-0.43, -0.29, 0.17], mach: 0.35 }, 's'],
      [0.74, { dG: 'tenir', dD: 'tenir', paG: [-0.6, -0.6, 0.4], paD: [0.6, -0.6, 0.4], fG: [0.1, -0.4], fD: [0.1, -0.4], mG: [0.36, -0.28, 0.2], mD: [-0.36, -0.28, 0.2], tr: 0.5, hd: [0.12, 0, 0], mach: 0.6, lu: 2.4 }, 'o'],
      [0.86, { fG: [0.15, 0.45], fD: [0.15, 0.45], tr: 0.3 }, 's'],
      [1, Object.assign({}, LAMES_BAS, { sp: [0.2, 0, 0], ch: [0.12, 0, 0], nk: [-0.12, 0, 0], hd: [-0.1, 0, 0], rg: 1, tr: 0.15, mach: 0.1, lu: 2.0 }), 's']
    ] },
    traque: { boucle: true, periode: 1.6, fondu: 0.3, cles: [
      [0, Object.assign({}, LAMES_BAS, { sp: [0.32, 0, 0], ch: [0.2, 0, 0], nk: [-0.22, 0, 0], hd: [-0.22, 0, 0], rp: 0.12, cG: [0.05, 0.1], cD: [0.05, 0.1],
        jG: [0.28, 0.04, 0.55, 0.8, 0.04], jD: [0.2, 0.03, 0.7, 0.75, 0.03], lu: 2.2, au: 1.4, rs: 1.3 })],
      [0.5, { mG: [0.28, -0.35, -0.24], mD: [-0.26, -0.37, -0.17], ch: [0.21, 0.04, 0], jG: [0.22, 0.04, 0.65, 0.78, 0.04], jD: [0.26, 0.03, 0.6, 0.78, 0.03] }, 's'],
      [1, {}, 's']
    ] },
    'frappe-preparation': { fondu: 0.08, cles: [
      [0, Object.assign({}, LAMES_BAS, { sp: [0.32, 0, 0], ch: [0.2, 0, 0], nk: [-0.22, 0, 0], hd: [-0.22, 0, 0], rp: 0.12, jG: [0.28, 0.04, 0.55, 0.8, 0.04], jD: [0.2, 0.03, 0.7, 0.75, 0.03] })],
      [0.6, { mG: [-0.08, 0.62, 0.12], mD: [0.07, 0.66, 0.1], pG: [0.9, -0.1, -0.3], pD: [-0.9, -0.1, -0.3], paG: [0.0, 0.25, -1], paD: [0.0, 0.25, -1], fG: [0.0, 0.35], fD: [0.0, 0.35],
        sp: [-0.06, 0, 0], ch: [-0.24, 0, 0], nk: [0.0, 0, 0], hd: [0.05, 0, 0], rp: 0.05, cG: [0.3, 0.15], cD: [0.3, 0.15], jG: [-0.35, 0.06, 0.7, 0.6, 0.05], jD: [-0.25, 0.05, 0.6, 0.6, 0.04], tr: 0.3, mach: 0.5, lu: 2.6 }, 'o'],
      [1, { ch: [-0.3, 0, 0], sp: [-0.1, 0, 0], mG: [-0.09, 0.64, 0.12], mD: [0.08, 0.68, 0.11], tr: 0.6, mach: 0.6 }, 's']
    ] },
    frappe: { fondu: 0.04, cles: [
      [0, { mG: [-0.09, 0.64, 0.12], mD: [0.08, 0.68, 0.11], pG: [0.9, -0.1, -0.3], pD: [-0.9, -0.1, -0.3], paG: [0.0, 0.25, -1], paD: [0.0, 0.25, -1], fG: [0.0, 0.35], fD: [0.0, 0.35], dG: 'tenir', dD: 'tenir',
        sp: [-0.1, 0, 0], ch: [-0.3, 0, 0], hd: [0.05, 0, 0], rp: 0.05, cG: [0.3, 0.15], cD: [0.3, 0.15], jG: [-0.35, 0.06, 0.7, 0.6, 0.05], jD: [-0.25, 0.05, 0.6, 0.6, 0.04], tr: 0.6, mach: 0.6, lu: 2.6 }],
      // v2.2 : les poings décroisés passent devant le front (z 0,28) : la lame droite ne traverse plus le visage
      [0.16, { mG: [0.07, 0.46, 0.28], mD: [-0.06, 0.48, 0.27] }, 'l'],
      [0.55, { mG: [0.36, -0.28, 0.32], mD: [-0.36, -0.28, 0.32], pG: [0.8, -0.2, -0.5], pD: [-0.8, -0.2, -0.5], paG: [-0.9, -0.2, 0.25], paD: [0.9, -0.2, 0.25], fG: [0.1, 0.2], fD: [0.1, 0.2],
        sp: [0.42, 0, 0], ch: [0.32, 0, 0], hd: [-0.1, 0, 0], rp: 0.22, cG: [0.0, 0.3], cD: [0.0, 0.3], jG: [0.25, 0.06, 0.4, 0.75, 0.05], jD: [0.3, 0.05, 0.5, 0.75, 0.04], mach: 1, tr: 0 }, 'o'],
      [1, { mG: [0.38, -0.32, 0.26], mD: [-0.38, -0.32, 0.26], sp: [0.38, 0, 0], ch: [0.28, 0, 0], rp: 0.2, mach: 0.5 }, 's']
    ] },
    'frappe-ratee': { fondu: 0.05, cles: [
      [0, { mG: [0.38, -0.32, 0.26], mD: [-0.38, -0.32, 0.26], pG: [0.8, -0.2, -0.5], pD: [-0.8, -0.2, -0.5], paG: [-0.9, -0.2, 0.25], paD: [0.9, -0.2, 0.25], dG: 'tenir', dD: 'tenir', sp: [0.38, 0, 0], ch: [0.28, 0, 0], rp: 0.2, mach: 0.5,
        jG: [0.25, 0.06, 0.4, 0.75, 0.05], jD: [0.3, 0.05, 0.5, 0.75, 0.04] }],
      [0.3, { rp: 0.42, rr: 0.16, sp: [0.5, 0.15, 0.05], ch: [0.35, 0.1, 0], mG: [0.32, -0.38, -0.05], mD: [-0.4, -0.25, 0.15], hd: [0.05, 0.2, 0.15], jG: [0.5, 0.15, 0.3, 0.7, 0.08], jD: [-0.3, 0.1, 0.9, 0.5, 0.05], mach: 0.3 }, 'o'],
      [0.62, { rp: 0.08, rr: -0.08, sp: [0.2, -0.05, -0.03], ch: [0.12, 0, 0], mG: [0.34, -0.3, -0.12], mD: [-0.34, -0.32, -0.1], hd: [-0.15, -0.05, -0.05] }, 's'],
      [1, Object.assign({}, LAMES_BAS, { sp: [0.32, 0, 0], ch: [0.2, 0, 0], nk: [-0.22, 0, 0], hd: [-0.22, 0, 0], rp: 0.12, rr: 0, jG: [0.28, 0.04, 0.55, 0.8, 0.04], jD: [0.2, 0.03, 0.7, 0.75, 0.03], mach: 0 }), 's']
    ] },
    reapparition: { fondu: 0.04, cles: [
      [0, Object.assign({}, JAMBES_REPLIEES, LAMES_BAS, { sp: [0.5, 0, 0], ch: [0.3, 0, 0], nk: [0.0, 0, 0], hd: [0.1, 0, 0], h: [0, 0.15, 0.05], mG: [0.32, -0.25, 0.1], mD: [-0.32, -0.25, 0.1], mach: 0.6, lu: 2.6, au: 2.0 })],
      [0.6, Object.assign({}, LAMES_BAS, { sp: [0.25, 0, 0], ch: [0.12, 0, 0], nk: [-0.2, 0, 0], hd: [-0.25, 0, 0], h: [0, 0, 0], rp: 0.1, mG: [0.4, -0.2, -0.12], mD: [-0.4, -0.2, -0.12], jG: [0.2, 0.06, 0.45, 0.75, 0.05], jD: [0.15, 0.05, 0.55, 0.7, 0.04], mach: 1 }), 'o'],
      [1, Object.assign({}, LAMES_BAS, { sp: [0.32, 0, 0], ch: [0.2, 0, 0], nk: [-0.22, 0, 0], hd: [-0.22, 0, 0], rp: 0.12, jG: [0.28, 0.04, 0.55, 0.8, 0.04], jD: [0.2, 0.03, 0.7, 0.75, 0.03], mach: 0.2, lu: 2.2 }), 's']
    ] },
    defaite: { fondu: 0.1, cles: [
      [0, Object.assign({}, LAMES_BAS, { sp: [0.32, 0, 0], ch: [0.2, 0, 0], nk: [-0.22, 0, 0], hd: [-0.22, 0, 0], rp: 0.12, jG: [0.28, 0.04, 0.55, 0.8, 0.04], jD: [0.2, 0.03, 0.7, 0.75, 0.03], lu: 2.2 })],
      [0.08, { rp: -0.05, sp: [-0.15, 0, 0], ch: [-0.3, 0, 0], hd: [-0.4, 0.1, 0.05], mG: [0.5, -0.05, -0.1], mD: [-0.5, -0.05, -0.1], mach: 0.8, tr: 1.0, jG: [-0.3, 0.1, 0.5, 0.5, 0.06], jD: [-0.1, 0.08, 0.4, 0.55, 0.04] }, 'o'],
      [0.3, { rp: 0, sp: [0.1, 0, 0], ch: [0.0, 0, 0], nk: [0.15, 0, 0], hd: [0.35, 0, 0], mG: [0.1, 0.0, 0.32], mD: [-0.1, 0.0, 0.32], paG: [0, 0.8, -0.6], paD: [0, 0.8, -0.6], pG: [0.8, -0.5, -0.3], pD: [-0.8, -0.5, -0.3],
        fG: [-0.2, 0], fD: [-0.2, 0], dG: 'griffe', dD: 'griffe', mach: 0.4, tr: 1.4, lu: 1.6, au: 1.0 }, 's'],
      [0.48, { sol: 1, h: [0, -0.505, 0.0], sp: [-0.12, 0, 0], ch: [-0.3, 0, 0], nk: [-0.25, 0, 0], hd: [-0.55, 0, 0], jG: [-0.08, 0.1, 1.62, 0.9, 0.05], jD: [-0.1, 0.08, 1.6, 0.9, 0.03],
        mG: [0.42, 0.1, 0.05], mD: [-0.42, 0.1, 0.05], paG: [0, 0.6, 0.8], paD: [0, 0.6, 0.8], dG: 'ouverte', dD: 'ouverte', mach: 1, tr: 0.9, lu: 2.0, au: 1.2 }, 'o'],
      [0.64, { sp: [0.4, 0, 0], ch: [0.25, 0, 0], nk: [0.2, 0, 0], hd: [0.3, 0, 0], h: [0, -0.53, 0.04], mG: [0.2, -0.42, 0.25], mD: [-0.2, -0.42, 0.25], paG: [-0.6, -0.4, 0.6], paD: [0.6, -0.4, 0.6], dG: 'detendue', dD: 'detendue', mach: 0.3, tr: 0.5, lu: 0.6, au: 0.4 }, 's'],
      [0.76, { rp: 0.55, h: [0, -0.62, 0.15], sp: [0.35, 0, 0], ch: [0.2, 0, 0], msG: [0.28, 0.55, 1], msD: [-0.28, 0.55, 1], dG: 'ouverte', dD: 'ouverte', jG: [-0.3, 0.1, 1.5, 0.9, 0.05], jD: [-0.3, 0.08, 1.5, 0.9, 0.03], lu: 0.3, au: 0.2, tr: 0.3 }, 's'],
      [0.88, Object.assign({}, COUCHE, { rp: 1.62, h: [0, -0.86, -0.02], msG: [0.3, 0.55, 0], msD: [-0.3, 0.55, 0], lu: 0.1, au: 0.05, cl: 0.6 }), 'i'],
      [0.94, { rp: 1.46, h: [0, -0.87, -0.06] }, 'o'],
      [1, Object.assign({}, COUCHE), 's']
    ] },
    cadavre: { boucle: true, periode: 10, fondu: 0.3, cles: [
      [0, Object.assign({}, COUCHE)],
      [1, Object.assign({}, COUCHE)]
    ] }
  };
  // ---------------------------------------------------------------- clips ajoutés pour le vocabulaire de l'API (§5)
  const TRAQUE_POSE = Object.assign({}, LAMES_BAS, { sp: [0.32, 0, 0], ch: [0.2, 0, 0], nk: [-0.22, 0, 0], hd: [-0.22, 0, 0], rp: 0.12, cG: [0.05, 0.1], cD: [0.05, 0.1],
    jG: [0.28, 0.04, 0.55, 0.8, 0.04], jD: [0.2, 0.03, 0.7, 0.75, 0.03], lu: 2.2, au: 1.4, rs: 1.3, mach: 0.05 });
  const TRAIT_ARME = { mD: [-0.27, 0.19, -0.03], pD: [-0.55, -0.8, -0.35], paD: [0.15, 0.45, 1], fD: [-0.25, 0], dD: 'crochue', cD: [0.16, -0.1],
    mG: [0.3, -0.14, 0.24], pG: [0.8, -0.4, -0.4], paG: [-0.4, -0.2, 0.9], dG: 'griffe', cG: [0.05, 0.15],
    ch: [-0.06, -0.26, 0], sp: [0.0, -0.12, 0], hd: [0.0, 0.0, 0], jG: [-0.2, 0.06, 0.4, 0.55, 0.06], jD: [-0.35, 0.04, 0.6, 0.5, 0.04], tr: 0.35, lu: 1.8, au: 1.4 };
  Object.assign(CLIPS, {
    // présentation : rugissement bras ouverts en V, puis regard qui s'abaisse sur les joueurs
    presentation: { fondu: 0.25, cles: [
      [0, {}],
      [0.12, { mG: [0.42, 0.05, 0.12], mD: [-0.42, 0.05, 0.12], pG: [0.7, -0.5, -0.5], pD: [-0.7, -0.5, -0.5], paG: [0.2, 0.6, 0.75], paD: [-0.2, 0.6, 0.75], dG: 'ouverte', dD: 'ouverte',
        ch: [-0.18, 0, 0], hd: [-0.2, 0, 0], tr: 0.2, au: 1.4, lu: 1.6, rg: 0.3 }, 's'],
      [0.3, { mG: [0.6, 0.38, 0.05], mD: [-0.6, 0.38, 0.05], pG: [0.5, -0.8, -0.4], pD: [-0.5, -0.8, -0.4], paG: [0.1, 0.4, 1], paD: [-0.1, 0.4, 1], dG: 'griffe', dD: 'griffe',
        fG: [-0.4, 0], fD: [-0.4, 0], cG: [0.25, -0.1], cD: [0.25, -0.1], sp: [-0.15, 0, 0], ch: [-0.35, 0, 0], nk: [-0.15, 0, 0], hd: [-0.42, 0, 0],
        jG: [0.05, 0.14, 0.12, 0.8, 0.08], jD: [0.03, 0.12, 0.14, 0.78, 0.06], mach: 1, tr: 0.9, lu: 2.8, au: 2.4, rg: 0 }, 'o'],
      [0.55, { mG: [0.61, 0.4, 0.04], mD: [-0.61, 0.4, 0.04], hd: [-0.4, 0.04, 0.03], mach: 0.92, tr: 1.1 }, 's'],
      [0.74, { mG: [0.36, -0.2, 0.12], mD: [-0.36, -0.2, 0.12], pG: [0.8, -0.3, -0.5], pD: [-0.8, -0.3, -0.5], paG: [-0.6, -0.2, 0.7], paD: [0.6, -0.2, 0.7], fG: [0.1, 0], fD: [0.1, 0],
        cG: [0.05, 0.05], cD: [0.05, 0.05], sp: [0.0, 0, 0], ch: [0.05, 0, 0], nk: [0.05, 0, 0], hd: [0.12, 0, 0], jG: [-0.1, 0.05, 0.25, 0.6, 0.06], jD: [-0.18, 0.03, 0.35, 0.55, 0.04],
        mach: 0.15, tr: 0.3, lu: 2.0, au: 1.6, rg: 1 }, 's'],
      [1, Object.assign({}, POSE_BASE, { hd: [-0.09, 0, 0], ch: [-0.09, 0, 0], lu: 1.4, au: 1.2 }), 's']
    ] },
    // trait maudit : la main droite se charge près de l'épaule, puis pousse le projectile vers le joueur (paume en avant)
    'trait-preparation': { fondu: 0.12, cles: [
      [0, {}],
      [0.55, Object.assign({}, TRAIT_ARME), 'o'],
      [1, { mD: [-0.29, 0.2, -0.07], ch: [-0.08, -0.3, 0], tr: 0.65, lu: 2.2, au: 1.7, mach: 0.3 }, 's']
    ] },
    'trait-lancer': { fondu: 0.04, cles: [
      [0, Object.assign({}, TRAIT_ARME, { mD: [-0.29, 0.2, -0.07], ch: [-0.08, -0.3, 0], tr: 0.65, lu: 2.2, au: 1.7, mach: 0.3 })],
      [0.45, { vD: 1, ext: 0.88, dD: 'griffe', paD: [0.25, 0.3, 1], fD: [-0.45, 0.1], cD: [0.0, 0.25], ch: [0.12, 0.25, 0], sp: [0.08, 0.12, 0], hd: [0.06, 0, 0],
        mG: [0.34, -0.22, -0.16], pG: [0.8, -0.2, -0.5], paG: [-0.8, 0, -0.5], dG: 'griffe', jG: [-0.35, 0.05, 0.6, 0.45, 0.06], jD: [-0.05, 0.03, 0.2, 0.6, 0.04], mach: 0.6, tr: 0.1, lu: 2.4 }, 'o'],
      [1, { vD: 1, ext: 0.86, ch: [0.1, 0.22, 0], tr: 0.05 }, 's']
    ] },
    // lévitation avec les ailes déployées : poitrine sortie, bras un peu écartés, battements amples et lents
    'flotte-ailes': { boucle: true, periode: 5.0, fondu: 0.4, cles: [
      [0, { mG: [0.29, -0.31, 0.03], mD: [-0.29, -0.31, 0.03], ch: [-0.1, 0, 0], hd: [-0.08, 0, 0], dG: 'griffe', dD: { griffe: 0.6, detendue: 0.4 },
        jG: [-0.02, 0.04, 0.18, 0.75, 0.05], jD: [-0.08, 0.03, 0.26, 0.7, 0.04], ail: [1, 0.3, 0.55, 0, 0.06], au: 1.3, lu: 1.4 }],
      [0.5, { mG: [0.3, -0.29, 0.05], mD: [-0.3, -0.3, 0.05], ch: [-0.12, 0.03, 0], hd: [-0.1, 0.03, 0.04], ail: [1, 0.34, 0.55, 0, 0.1] }, 's'],
      [1, { mG: [0.29, -0.31, 0.03], mD: [-0.29, -0.31, 0.03], ch: [-0.1, 0, 0], hd: [-0.08, 0, 0], ail: [1, 0.3, 0.55, 0, 0.06] }, 's']
    ] },
    // frappe spéciale réussie : il se redresse au-dessus de sa victime, lames basses
    'frappe-recuperation': { fondu: 0.05, cles: [
      [0, { mG: [0.38, -0.32, 0.26], mD: [-0.38, -0.32, 0.26], pG: [0.8, -0.2, -0.5], pD: [-0.8, -0.2, -0.5], paG: [-0.9, -0.2, 0.25], paD: [0.9, -0.2, 0.25], dG: 'tenir', dD: 'tenir',
        sp: [0.38, 0, 0], ch: [0.28, 0, 0], rp: 0.2, mach: 0.5, jG: [0.25, 0.06, 0.4, 0.75, 0.05], jD: [0.3, 0.05, 0.5, 0.75, 0.04] }],
      [0.4, { sp: [0.2, 0, 0], ch: [0.05, 0, 0], hd: [0.2, 0, 0], rp: 0.08, mach: 0.25, mG: [0.36, -0.3, 0.1], mD: [-0.36, -0.3, 0.1] }, 's'],
      [1, Object.assign({}, TRAQUE_POSE), 's']
    ] },
    // frappe ordinaire : une seule lame, diagonale de l'épaule gauche vers le bas à droite
    'frappe-ord-preparation': { fondu: 0.08, cles: [
      [0, Object.assign({}, TRAQUE_POSE)],
      [0.7, { mD: [0.2, 0.5, -0.03], pD: [-0.9, 0.25, -0.3], paD: [0.35, 0.2, -1], fD: [0.0, 0.4], dD: 'tenir', ch: [-0.1, 0.38, 0], sp: [0.02, 0.16, 0], hd: [0.0, -0.25, 0],
        mG: [0.3, -0.3, -0.22], pG: [0.9, 0.15, -0.3], dG: 'tenir', rp: 0.05, jG: [-0.3, 0.06, 0.6, 0.6, 0.05], jD: [-0.15, 0.05, 0.45, 0.65, 0.04], mach: 0.4, lu: 2.4 }, 'o'],
      [1, { mD: [0.21, 0.52, -0.04], ch: [-0.12, 0.42, 0], tr: 0.4 }, 's']
    ] },
    'frappe-ord': { fondu: 0.03, cles: [
      [0, { mD: [0.21, 0.52, -0.04], pD: [-0.9, 0.25, -0.3], paD: [0.35, 0.2, -1], fD: [0.0, 0.4], dD: 'tenir', ch: [-0.12, 0.42, 0], sp: [0.02, 0.16, 0], hd: [0.0, -0.25, 0],
        mG: [0.3, -0.3, -0.22], pG: [0.9, 0.15, -0.3], dG: 'tenir', rp: 0.05, mach: 0.4 }],
      [0.6, { mD: [-0.38, -0.3, 0.3], pD: [-0.8, -0.3, -0.5], paD: [0.9, -0.2, 0.2], fD: [0.1, 0.2], ch: [0.22, -0.32, 0], sp: [0.16, -0.14, 0], hd: [0.05, 0.2, 0],
        mG: [0.32, -0.34, -0.25], rp: 0.15, mach: 0.9, jG: [0.1, 0.06, 0.35, 0.7, 0.05], jD: [-0.25, 0.05, 0.6, 0.6, 0.04] }, 'o'],
      [1, { mD: [-0.39, -0.33, 0.27], ch: [0.2, -0.3, 0], mach: 0.6 }, 's']
    ] },
    'frappe-ord-recuperation': { fondu: 0.05, cles: [
      [0, { mD: [-0.39, -0.33, 0.27], pD: [-0.8, -0.3, -0.5], paD: [0.9, -0.2, 0.2], dD: 'tenir', ch: [0.2, -0.3, 0], sp: [0.16, -0.14, 0], hd: [0.05, 0.2, 0], mG: [0.32, -0.34, -0.25], dG: 'tenir', rp: 0.15, mach: 0.6 }],
      [1, Object.assign({}, TRAQUE_POSE), 's']
    ] }
  });
  Object.assign(DUREES_DEFAUT, { presentation: 3.4, 'trait-preparation': 0.7, 'trait-lancer': 0.25, 'flotte-ailes': 0, 'frappe-recuperation': 0.5,
    'frappe-ord-preparation': 0.45, 'frappe-ord': 0.15, 'frappe-ord-recuperation': 0.5 });

  // ---------------------------------------------------------------- crochet (v1.4 : palier 3 de la phase 5, lames actives)
  // Trois clips propres, faits des clés de clips existants : les gestes de visée des phases 1 à 3 ('designation-mur',
  // 'trait-preparation', 'lancer') partent de la posture de rage et d'une main ouverte, alors qu'ici le Septième glisse en
  // traque et serre ses deux lames (forme « tenir », imposée tant qu'elles sont là) : la lame droite prolonge le bras
  // tendu vers le joueur. Visée reprise de 'designation-mur' (paume de côté, pouce en haut), armé puis jeté repris de
  // 'lancer', traction à deux mains par à-coups reprise d'« absorption ». Le bras qui vise reste sous l'horizontale
  // (MIN_VISEE, 9°), coude un peu fléchi, poing de côté : aucune pose de salut (outils/audit_salut.js).
  const CROCHET_VISE = { vD: 1, ext: 0.9, mD: [-0.2, -0.02, 0.44], dD: 'poing', paD: [0.85, 0.3, 0.35], pD: [-0.7, -0.6, -0.35], fD: [-0.1, 0.12], cD: [0.12, 0.3],
    ch: [0.06, 0.24, 0], sp: [0.12, 0.1, 0], nk: [-0.06, 0, 0], hd: [-0.06, 0, 0], rp: 0.05,
    mG: [0.3, -0.32, -0.22], pG: [0.9, 0.12, -0.3], paG: [0.95, 0.15, 0.1], fG: [0.1, 0.25], dG: 'tenir', cG: [0.04, 0.05],
    jG: [-0.28, 0.06, 0.55, 0.55, 0.05], jD: [0.16, 0.04, 0.6, 0.7, 0.03], mach: 0.3, tr: 0.3, lu: 2.4, au: 1.5 };
  const CROCHET_SAISIE = { vD: 0, vG: 0, mD: [-0.12, -0.1, 0.36], mG: [0.1, -0.07, 0.42], pD: [-0.85, -0.45, -0.3], pG: [0.85, -0.45, -0.3],
    paD: [0.95, 0.1, 0.2], paG: [-0.95, 0.1, 0.2], fD: [0, 0], fG: [0, 0], dD: 'poing', dG: 'poing', cG: [0.08, 0.32], cD: [0.08, 0.32],
    ch: [0.2, 0.1, 0], sp: [0.15, 0.06, 0], nk: [-0.08, 0, 0], hd: [-0.06, 0, 0], rp: 0.08, rr: 0,
    jG: [-0.5, 0.08, 0.75, 0.45, 0.05], jD: [-0.15, 0.05, 0.55, 0.5, 0.03], mach: 0.5, tr: 0.45, lu: 2.4, au: 1.5 };
  Object.assign(CLIPS, {
    // preparation : le bras droit se tend vers le joueur visé, poing serré, épaule droite en avant
    'crochet-visee': { fondu: 0.1, cles: [
      [0, Object.assign({}, TRAQUE_POSE)],
      [0.45, Object.assign({}, CROCHET_VISE), 'o'],
      [1, { ext: 0.92, ch: [0.08, 0.26, 0], tr: 0.5, mach: 0.4, lu: 2.6 }, 's']
    ] },
    // lancer : armé (main au-dessus de l'épaule, en arrière, paume vers la tête : pouce et lame vers l'arrière, loin du crâne),
    // jeté vers la cible, puis bras tendu qui tient la chaîne
    'crochet-lancer': { fondu: 0.04, cles: [
      [0, Object.assign({}, CROCHET_VISE, { ext: 0.92, ch: [0.08, 0.26, 0], tr: 0.5, mach: 0.4, lu: 2.6 })],
      [0.3, { vD: 0.15, mD: [-0.41, 0.37, -0.2], pD: [-0.9, 0.25, -0.35], paD: [0.9, 0.1, -0.3], fD: [-0.45, 0], cD: [0.38, -0.05],
        ch: [-0.16, -0.3, 0.04], sp: [-0.06, -0.14, 0], hd: [-0.12, -0.08, 0], rp: 0.0, mach: 0.65, tr: 0.25 }, 'o'],
      [0.62, { vD: 1, ext: 1.0, mD: [-0.18, 0.0, 0.47], paD: [0.8, 0.25, 0.5], fD: [-0.15, 0.1], cD: [0.0, 0.38], ch: [0.22, 0.34, 0], sp: [0.16, 0.14, 0], hd: [0.04, 0.06, 0], rp: 0.12,
        jG: [-0.42, 0.06, 0.65, 0.5, 0.05], jD: [0.3, 0.04, 0.45, 0.75, 0.03], mach: 1, tr: 0.1, lu: 2.8 }, 'o'],
      [1, { ext: 0.96, ch: [0.16, 0.3, 0], sp: [0.12, 0.12, 0], mach: 0.55, tr: 0.4 }, 's']
    ] },
    // traction (boucle depuis le début de l'étape) : les deux poings saisissent la chaîne devant lui et la ramènent à la
    // hanche droite, buste rejeté en arrière, jambes en appui vers l'avant ; un à-coup toutes les 0,8 s
    'crochet-traction': { boucle: true, periode: 0.8, fondu: 0.12, cles: [
      [0, Object.assign({}, CROCHET_SAISIE)],
      [0.42, { mD: [-0.2, -0.26, 0.13], mG: [0.02, -0.2, 0.2], ch: [-0.2, 0.18, 0], sp: [-0.1, 0.1, 0], rp: -0.06, hd: [-0.16, 0, 0],
        cG: [0.12, -0.15], cD: [0.12, -0.2], jG: [-0.65, 0.08, 0.6, 0.5, 0.05], jD: [-0.3, 0.05, 0.4, 0.55, 0.03], mach: 0.95, tr: 1.0, lu: 2.8 }, 'o'],
      [0.62, { mD: [-0.21, -0.27, 0.11], mG: [0.03, -0.21, 0.18], tr: 0.8 }, 's'],
      [1, Object.assign({}, CROCHET_SAISIE), 's']
    ] }
  });
  Object.assign(DUREES_DEFAUT, { 'crochet-visee': 0.7, 'crochet-lancer': 0.42, 'crochet-traction': 0 });

  // mouvements procéduraux ajoutés par-dessus certains clips (t : secondes depuis le début de l'action)
  const sec = (t, p) => Math.exp(-p * t);
  CLIPS.etourdi.extra = (A, t, u) => {   // secoue la tête, de moins en moins
    const k = sec(t, 0.5) * (1 - smooth(0.75, 1, u));
    A[OFF.hd + 1] += 0.34 * Math.sin(t * 10.5) * k; A[OFF.nk + 1] += 0.14 * Math.sin(t * 10.5 - 0.6) * k; A[OFF.hd + 2] += 0.08 * Math.sin(t * 7.3) * k;
  };
  CLIPS.ramene.extra = (A, t, u) => {    // se débat dans les liens de lumière
    const k = 1 - smooth(0.7, 1, u);
    A[OFF.sp + 1] += 0.3 * Math.sin(t * 6.8) * k; A[OFF.ch + 1] += 0.2 * Math.sin(t * 6.8 + 0.7) * k; A[OFF.rr] += 0.14 * Math.sin(t * 5.1 + 1) * k;
    A[OFF.hd + 1] += 0.4 * Math.sin(t * 5.9 + 2) * k; A[OFF.hd] += 0.14 * Math.sin(t * 8.7) * k;
    A[OFF.jG] += 0.45 * Math.sin(t * 7.7) * k; A[OFF.jD] += 0.45 * Math.sin(t * 7.7 + 2.6) * k; A[OFF.jG + 2] += 0.5 * Math.max(0, Math.sin(t * 7.7 + 1)) * k;
    for (let i = 0; i < 3; i++) { A[OFF.mG + i] += 0.04 * Math.sin(t * 9 + i) * k; A[OFF.mD + i] += 0.04 * Math.sin(t * 9.4 + i + 2) * k; }
  };
  CLIPS.absorption.extra = (A, t, u) => {   // les mains tirent par saccades (les secousses d'âmes viennent de vue.ames)
    const k = u > 0.3 && u < 0.9 ? 1 : 0, j = Math.pow(Math.max(0, Math.sin(t * 4.2)), 3);
    A[OFF.mG + 2] += (0.03 * Math.sin(t * 13) - 0.04 * j) * k; A[OFF.mD + 2] += (0.03 * Math.sin(t * 13 + 1.5) - 0.04 * j) * k;
    A[OFF.ch] -= 0.04 * j * k;
  };
  CLIPS.rage.extra = (A, t) => {         // épaules qui se soulèvent, souffle rauque
    const h = Math.max(0, Math.sin(t * 2.3)), h2 = Math.max(0, Math.sin(t * 2.3 + 0.4));
    A[OFF.cG] += 0.07 * h; A[OFF.cD] += 0.07 * h2; A[OFF.ch] -= 0.04 * h; A[OFF.mach] += 0.12 * h;
  };
  CLIPS.faible.extra = (A, t) => {       // tremble, la tête dodeline
    A[OFF.hd + 2] += 0.06 * Math.sin(t * 0.9); A[OFF.hd + 1] += 0.05 * Math.sin(t * 0.63 + 1);
  };
  CLIPS['rituel-ames'].extra = (A, t, u) => {   // tire les âmes par à-coups
    const k = u > 0.15 && u < 0.85 ? 1 : 0, j = Math.max(0, Math.sin(t * 3.4)) ** 3;
    A[OFF.mG + 2] -= 0.05 * j * k; A[OFF.mD + 2] -= 0.05 * j * k; A[OFF.ch] -= 0.06 * j * k; A[OFF.lu] += 0.5 * j * k;
  };
  // les actions sans clip propre réutilisent un clip voisin
  const CLIP_ALIAS = { inactif: 'flotte' };

  // compile les clés (héritage) en tableaux
  function compilerClips() {
    const out = {};
    for (const nom in CLIPS) {
      const c = CLIPS[nom];
      let prev = BASE_T;
      const cles = c.cles.map(([u, o, e]) => { const a = versTableau(o, prev); prev = a; return { u: u, p: a, e: e || 's' }; });
      out[nom] = { boucle: !!c.boucle, periode: c.periode || 1, fondu: c.fondu != null ? c.fondu : 0.25, cles: cles, extra: c.extra || null };
    }
    return out;
  }
  // évalue un clip compilé à u ∈ [0, 1] (dans out)
  function evaluerClip(clip, u, out) {
    const K = clip.cles;
    if (u <= K[0].u) { out.set(K[0].p); return out; }
    if (u >= K[K.length - 1].u) { out.set(K[K.length - 1].p); return out; }
    let i = 0;
    while (i < K.length - 2 && u > K[i + 1].u) i++;
    const a = K[i], b = K[i + 1];
    const t = (u - a.u) / Math.max(1e-6, b.u - a.u);
    const w = (ease[b.e] || ease.s)(t);
    const pa = a.p, pb = b.p;
    for (let k = 0; k < NPOSE; k++) out[k] = pa[k] + (pb[k] - pa[k]) * w;
    return out;
  }

  // ============================================================================================
  // Moteur d'animation : pose = f(action, tAction / dureeAction) (déterministe), fondu de pose au
  // changement d'action, couches secondaires (respiration, flottement, regard, visée, sursauts,
  // affaiblissement, tremblement de rage, inclinaison selon la vitesse), IK à deux os des bras
  // (méthode reprise de ../survivant/src/anim.js, solveArm), poignets, doigts, mâchoire, yeux, et
  // physique de ressorts des pans du manteau et de l'étole (Verlet, collisions avec le torse et les
  // jambes), manches qui remontent quand l'avant-bras se lève (cibles de morphose).
  // ============================================================================================
  // inclinaison minimale sous l'horizontale (rad) des bras qui visent : jamais de bras tendu vers l'avant et le haut
  const MIN_VISEE = { projection: 0.72, 'double-projection': 0.72, 'designation-mur': 0.34, 'saisie-mur': 0.3, lancer: 0.25, 'trait-preparation': 0.16, 'trait-lancer': 0.2,
    'crochet-visee': 0.16, 'crochet-lancer': 0.16 };
  const DISSOL_ACTIONS = {
    apparition: (u) => 1 - smooth(0.0, 0.6, u),
    disparition: (u) => smooth(0.12, 0.95, u),
    'teleport-sortie': (u) => smooth(0.35, 0.92, u),
    'teleport-entree': (u) => 1 - smooth(0.0, 0.62, u),
    reapparition: (u) => 1 - smooth(0.0, 0.7, u),
    reprise: (u) => smooth(0.72, 1.0, u),
    'retour-rage': (u) => 1 - smooth(0.0, 0.07, u)
  };
  const PHASE5 = { 'formation-lames': 1, traque: 1, 'frappe-preparation': 1, frappe: 1, 'frappe-ratee': 1, reapparition: 1, defaite: 1, 'frappe-recuperation': 1, 'frappe-ord-preparation': 1, 'frappe-ord': 1, 'frappe-ord-recuperation': 1,
    'crochet-visee': 1, 'crochet-lancer': 1, 'crochet-traction': 1 };

  function creerAnimateur(THREE, M) {
    const B = M.B, objet = M.objet, corps = M.corps, U = M.U;
    const leger = !!(M.opts && M.opts.allege);
    const CL = compilerClips();
    const P = new Float32Array(NPOSE), Pc = new Float32Array(NPOSE), Pm = new Float32Array(NPOSE), Pfrom = new Float32Array(NPOSE), A = new Float32Array(NPOSE);
    P.set(BASE_T); Pfrom.set(BASE_T);
    const bindPos = {};
    for (const k in B) bindPos[k] = B[k].position.clone();
    const e = new THREE.Euler(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m1 = new THREE.Matrix4(), mInv = new THREE.Matrix4();
    const qCorps = new THREE.Quaternion(), qCorpsInv = new THREE.Quaternion(), sCorps = new THREE.Vector3(), pCorps = new THREE.Vector3();
    const axe = (a) => new THREE.Vector3(a[0], a[1], a[2]).normalize();
    // repères de référence des bras et des mains
    const COTE = {};
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const d0 = [ARM_DIR[0] * sx, ARM_DIR[1], 0];
      const n0 = vnorm(vsub([1, 0, 0], vscale(d0, d0[0])));
      const palm = sx > 0 ? PAUME_L : miroir(PAUME_L);
      const td = sx > 0 ? POUCE_DIR_L : miroir(POUCE_DIR_L);
      const flex = vnorm(vcross(d0, palm)), ecart = vnorm(vcross(d0, [0, 0, 1]));
      const pflex = vnorm(vcross(td, palm));
      let opp = d0.slice(); if (vdot(vcross(opp, td), palm) < 0) opp = vscale(opp, -1);
      COTE[S] = { sx: sx, d0: d0, n0: n0, palm: palm, td: td, aD0: axe(d0), aFlex: axe(flex), aEcart: axe(ecart), aPflex: axe(pflex), aOpp: axe(opp),
        os: { arm: B['arm' + S], fore: B['fore' + S], tors: B['tors' + S], hand: B['hand' + S], clav: B['clav' + S],
          doigts: DOIGTS.map(([f]) => [B[f + '1' + S], B[f + '2' + S], B[f + '3' + S]]), pouce: [B['pouce1' + S], B['pouce2' + S], B['pouce3' + S]] } };
    }
    const st = {
      temps: 0, action: null, tPrec: -1, fondu: 1, fonduT: 0, init: false,
      toucheN: null, ressort: [0, 0, 0], ressortV: [0, 0, 0],
      regardY: 0, regardP: 0, vitF: 0, vitL: 0, puis: 0, rage: 0, faib: 0, bouclier: 0,
      posPrec: new THREE.Vector3(), aPos: false, panInit: false, acc: 0, mach: 0, lueur: 1, cligne: 0,
      dissol: 0, viseeLiss: null, pulse: 0, solPose: 0, nSursaut: 1
    };
    // --------------------------------------------------------------- outils repère du modèle (espace « corps »)
    const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
    const majRepere = () => {
      corps.matrixWorld.decompose(pCorps, qCorps, sCorps);
      qCorpsInv.copy(qCorps).invert();
      mInv.copy(corps.matrixWorld).invert();
    };
    const pM = (bone, out) => out.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(mInv);
    const qM = (bone, out) => { bone.matrixWorld.decompose(tmpP, out, tmpS); return out.premultiply(qCorpsInv); };
    const setQM = (bone, qModel) => { qM(bone.parent, q3); bone.quaternion.copy(q3.invert().multiply(qModel)); bone.updateMatrixWorld(true); };
    // petits vecteurs [x, y, z] SANS allocation (tampons réutilisés) pour tout ce qui tourne à chaque image
    const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
    const sub3 = (o, a, b) => set3(o, a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const madd3 = (o, a, b, k) => set3(o, a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k);
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const len3 = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    const nrm3 = (o, a) => { const l = len3(a) || 1; return set3(o, a[0] / l, a[1] / l, a[2] / l); };
    const crs3 = (o, a, b) => set3(o, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
    const lerp3 = (o, a, b, t) => set3(o, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    const vrot3 = (o, v, k, a) => {
      const c = Math.cos(a), s = Math.sin(a), d = dot3(k, v);
      const cx = k[1] * v[2] - k[2] * v[1], cy = k[2] * v[0] - k[0] * v[2], cz = k[0] * v[1] - k[1] * v[0];
      return set3(o, v[0] * c + cx * s + k[0] * d * (1 - c), v[1] * c + cy * s + k[1] * d * (1 - c), v[2] * c + cz * s + k[2] * d * (1 - c));
    };
    const m0 = new THREE.Matrix4(), mm1 = new THREE.Matrix4(), _b0 = [0, 0, 0], _b1 = [0, 0, 0];
    const basisQuat = (d0, n0, d1, n1, out) => {
      crs3(_b0, d0, n0); crs3(_b1, d1, n1);
      m0.set(d0[0], n0[0], _b0[0], 0, d0[1], n0[1], _b0[1], 0, d0[2], n0[2], _b0[2], 0, 0, 0, 0, 1);
      mm1.set(d1[0], n1[0], _b1[0], 0, d1[1], n1[1], _b1[1], 0, d1[2], n1[2], _b1[2], 0, 0, 0, 0, 1);
      mm1.multiply(m0.transpose());
      return out.setFromRotationMatrix(mm1);
    };
    const rotV3 = (o, v, q) => { v1.set(v[0], v[1], v[2]).applyQuaternion(q); return set3(o, v1.x, v1.y, v1.z); };
    const g3 = (k, i) => A[OFF[k] + i];

    // --------------------------------------------------------------- IK du bras (espace du modèle)
    const _s = [0, 0, 0], _dv = [0, 0, 0], _u = [0, 0, 0], _pv = [0, 0, 0], _E = [0, 0, 0], _Wp = [0, 0, 0], _dUp = [0, 0, 0], _dFo = [0, 0, 0], _n1 = [0, 0, 0], _nUp = [0, 0, 0], _nFo = [0, 0, 0];
    function resoudreBras(S, cible, pole) {
      const C = COTE[S], up = C.os.arm, fo = C.os.fore;
      pM(up, v2);
      set3(_s, v2.x, v2.y, v2.z);
      const a = L_UPPER, b = L_FORE;
      sub3(_dv, cible, _s);
      const D = clamp(len3(_dv), Math.abs(a - b) + 1e-3, a + b - 2e-3);
      nrm3(_u, _dv);
      madd3(_pv, pole, _u, -dot3(pole, _u));
      if (len3(_pv) < 1e-5) set3(_pv, 0, -1, 0);
      nrm3(_pv, _pv);
      const cosA = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
      madd3(_E, _s, _u, a * cosA); madd3(_E, _E, _pv, a * sinA);
      madd3(_Wp, _s, _u, D);
      nrm3(_dUp, sub3(_dUp, _E, _s)); nrm3(_dFo, sub3(_dFo, _Wp, _E));
      crs3(_n1, _dFo, _dUp);
      if (len3(_n1) < 1e-5) crs3(_n1, _dUp, _pv);
      nrm3(_n1, _n1);
      nrm3(_nUp, madd3(_nUp, _n1, _dUp, -dot3(_n1, _dUp)));
      nrm3(_nFo, madd3(_nFo, _n1, _dFo, -dot3(_n1, _dFo)));
      setQM(up, basisQuat(C.d0, C.n0, _dUp, _nUp, q1));
      setQM(fo, basisQuat(C.d0, C.n0, _dFo, _nFo, q1));
    }
    // torsion de l'avant-bras et orientation de la main pour présenter la paume dans la direction voulue
    const _a = [0, 0, 0], _pn = [0, 0, 0], _pdp = [0, 0, 0], _pnp = [0, 0, 0], _x = [0, 0, 0], _y = [0, 0, 0], _c = [0, 0, 0], _pn2 = [0, 0, 0];
    function orienterMain(S, pd, flexClip, devClip) {
      const C = COTE[S], fo = C.os.fore;
      qM(fo, q1);
      rotV3(_a, C.d0, q1); rotV3(_pn, C.palm, q1);
      madd3(_pdp, pd, _a, -dot3(pd, _a)); madd3(_pnp, _pn, _a, -dot3(_pn, _a));
      let tau = 0;
      if (len3(_pdp) > 1e-3 && len3(_pnp) > 1e-3) { nrm3(_x, _pnp); nrm3(_y, _pdp); tau = Math.atan2(dot3(_a, crs3(_c, _x, _y)), dot3(_x, _y)); }
      tau = clamp(tau, -1.8, 1.8);
      C.os.tors.quaternion.setFromAxisAngle(C.aD0, tau * 0.55);
      vrot3(_pn2, _pn, _a, tau);
      const flexAuto = clamp(-Math.atan2(dot3(pd, _a), Math.max(0.05, dot3(pd, _pn2))), -1.15, 1.0);
      const fl = clamp(flexAuto + flexClip, -1.25, 1.15);
      q1.setFromAxisAngle(C.aD0, tau * 0.45);
      q2.setFromAxisAngle(C.aFlex, fl); q1.multiply(q2);
      q2.setFromAxisAngle(C.aEcart, clamp(devClip, -0.5, 0.5)); q1.multiply(q2);
      C.os.hand.quaternion.copy(q1);
    }
    // formes de main pré-indexées : FORMES_T[k][d] = [4 valeurs] pour la forme k et le doigt d (4 doigts puis pouce)
    const NOMS_DOIGTS = DOIGTS.map((d) => d[0]).concat(['pouce']);
    const FORMES_T = MAINS.map((m) => NOMS_DOIGTS.map((f) => FORMES[m][f]));
    const I_TENIR = MAINS.indexOf('tenir');
    const formeTmp = NOMS_DOIGTS.map(() => [0, 0, 0, 0]);
    function appliquerDoigts(S, off, tenir, tremb, twitch) {
      for (let d = 0; d < formeTmp.length; d++) { const t = formeTmp[d]; t[0] = t[1] = t[2] = t[3] = 0; }
      let tot = 0;
      for (let k = 0; k < MAINS.length; k++) {
        let w = A[off + k] * (1 - tenir);
        if (k === I_TENIR) w += tenir;
        if (w <= 1e-4) continue;
        tot += w;
        const F = FORMES_T[k];
        for (let d = 0; d < formeTmp.length; d++) { const t = formeTmp[d], fd = F[d]; t[0] += fd[0] * w; t[1] += fd[1] * w; t[2] += fd[2] * w; t[3] += fd[3] * w; }
      }
      tot = tot || 1;
      const C = COTE[S], osD = C.os.doigts, dec = S === 'L' ? 0 : 11;
      for (let fi = 0; fi < osD.length; fi++) {
        const a = formeTmp[fi], o = osD[fi];
        const tw = twitch ? Math.max(0, bruit1(st.temps * 1.6 + fi * 3.7 + dec, 71) - 0.45) * 1.1 * twitch : 0;
        const tr = tremb ? bruit1(st.temps * 15 + fi * 5.1, 73) * 0.12 * tremb : 0;
        q1.setFromAxisAngle(C.aEcart, a[0] / tot); q2.setFromAxisAngle(C.aFlex, a[1] / tot + tw * 0.5 + tr); q1.multiply(q2);
        o[0].quaternion.copy(q1);
        o[1].quaternion.setFromAxisAngle(C.aFlex, a[2] / tot + tw + tr);
        o[2].quaternion.setFromAxisAngle(C.aFlex, a[3] / tot + tw * 0.7);
      }
      const t = formeTmp[formeTmp.length - 1], op = C.os.pouce;
      q1.setFromAxisAngle(C.aOpp, t[0] / tot); q2.setFromAxisAngle(C.aPflex, t[1] / tot); q1.multiply(q2);
      op[0].quaternion.copy(q1);
      op[1].quaternion.setFromAxisAngle(C.aPflex, t[2] / tot);
      op[2].quaternion.setFromAxisAngle(C.aPflex, t[3] / tot);
    }

    // --------------------------------------------------------------- physique des pans du manteau (espace monde)
    const PAN = [];
    {
      for (let k = 0; k < PAN_N; k++) {
        const f = k / (PAN_N - 1), pts = [];
        for (let i = 0; i < PAN_Y.length; i++) pts.push(pointJupe(f, PAN_Y[i], -0.012));
        const L = [], dirs = [];
        for (let i = 0; i < pts.length - 1; i++) { L.push(vlen(vsub(pts[i + 1], pts[i]))); dirs.push(axe(vsub(pts[i + 1], pts[i]))); }
        const hip = [0, 0.985, 0];
        PAN.push({ f: f, rest: pts.map((p) => vsub(p, hip)), L: L, dirs: dirs, x: pts.map(() => new THREE.Vector3()), xp: pts.map(() => new THREE.Vector3()), bones: [0, 1, 2, 3].map((i) => B['pan' + k + '_' + i]) });
      }
    }
    // distances de repos entre chaînes voisines (même niveau), calculées une fois
    for (let k = 0; k < PAN.length; k++) { const C0 = PAN[k], C1 = PAN[Math.min(PAN.length - 1, k + 1)]; C0.rn = C0.rest.map((r, i) => vlen(vsub(r, C1.rest[i]))); }
    const hipM = new THREE.Matrix4(), capA = new THREE.Vector3(), capB = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
    const capsules = [];
    for (let i = 0; i < 7; i++) capsules.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 });
    const STIF = [0, 0.11, 0.045, 0.02, 0.009];
    const CAPS = [[B.thighL, B.shinL, 0.125], [B.thighR, B.shinR, 0.125], [B.shinL, B.footL, 0.085], [B.shinR, B.footR, 0.085], [B.thighL, B.thighR, 0.15], [B.hips, B.spine, 0.17]];
    function capsulesJambes(echelle) {
      for (let n = 0; n < CAPS.length; n++) {
        const c = CAPS[n];
        capsules[n].a.setFromMatrixPosition(c[0].matrixWorld); capsules[n].b.setFromMatrixPosition(c[1].matrixWorld); capsules[n].r = c[2] * echelle;
      }
      return CAPS.length;
    }
    function pousserHors(p, nCap) {
      for (let c = 0; c < nCap; c++) {
        const C = capsules[c];
        tmpV.subVectors(C.b, C.a);
        const l2 = tmpV.lengthSq();
        let t = l2 > 1e-8 ? tmpW.subVectors(p, C.a).dot(tmpV) / l2 : 0;
        t = clamp(t, 0, 1);
        tmpW.copy(C.a).addScaledVector(tmpV, t);
        const d = p.distanceTo(tmpW);
        if (d < C.r && d > 1e-6) p.sub(tmpW).multiplyScalar(C.r / d).add(tmpW);
      }
    }
    function physiqueManteau(dt, lev, solW, solY) {
      const echelle = sCorps.x;
      hipM.copy(B.hips.matrixWorld);
      const reset = !st.panInit;
      st.panInit = true;
      const nCap = capsulesJambes(echelle);
      st.nCap = nCap;
      const steps = reset ? 1 : Math.min(3, Math.max(1, Math.round(dt * 60)));
      const h = reset ? 0 : dt / steps;
      const g = -9.8 * 0.5, up = 4.2 * lev, t = st.temps;
      for (let s = 0; s < steps; s++) {
        for (let k = 0; k < PAN.length; k++) {
          const C = PAN[k];
          for (let i = 0; i < C.x.length; i++) {
            tmpV.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(hipM);
            if (i === 0 || reset) { C.x[i].copy(tmpV); C.xp[i].copy(tmpV); continue; }
            const x = C.x[i], xp = C.xp[i];
            // amortissement + traînée de l'air (le drap traîne derrière quand il file)
            const ax0 = x.x - xp.x, ay0 = x.y - xp.y, az0 = x.z - xp.z;
            const vit = Math.hypot(ax0, ay0, az0) / Math.max(1e-4, h);
            const dr = Math.max(0.86, 1 - h * (2.0 + 0.55 * vit));
            const vx = ax0 * dr, vy = ay0 * dr, vz = az0 * dr;
            xp.copy(x);
            // courant ascendant de la lévitation, poussée vers l'extérieur, vent surnaturel
            const a = angPan(C.f, PAN_Y[i]);
            v3.set(Math.sin(a), 0, Math.cos(a)).applyQuaternion(qCorps);
            const wind = 1.4 * lev + 0.4;
            const nx = bruit1(t * 0.8 + k * 0.37 + i * 0.21, 81) * wind, nz = bruit1(t * 0.7 + k * 0.29 + i * 0.17, 83) * wind, ny = bruit1(t * 0.9 + k * 0.33, 85) * wind * 0.6;
            const lift = up * (0.55 + 0.45 * bruit1(t * 0.6 + k * 0.5, 87)) * (i / 4);
            x.x += vx + (v3.x * 1.1 * lev * (i / 4) + nx) * h * h;
            x.y += vy + (g + lift + ny) * h * h;
            x.z += vz + (v3.z * 1.1 * lev * (i / 4) + nz) * h * h;
            x.lerp(tmpV, STIF[i]);
          }
        }
        // contraintes : longueur des segments, voisins au même niveau, collisions jambes et sol
        for (let it = 0; it < 2; it++) {
          for (let k = 0; k < PAN.length; k++) {
            const C = PAN[k];
            for (let i = 1; i < C.x.length; i++) {
              const p0 = C.x[i - 1], p1 = C.x[i], L = C.L[i - 1] * echelle;
              tmpV.subVectors(p1, p0); const d = tmpV.length() || 1e-6;
              p1.copy(p0).addScaledVector(tmpV, L / d);
            }
          }
          for (let k = 0; k < PAN.length - 1; k++) {
            const C0 = PAN[k], C1 = PAN[k + 1];
            for (let i = 1; i < C0.x.length; i++) {
              const r0 = C0.rn[i] * echelle;
              tmpV.subVectors(C1.x[i], C0.x[i]); const d = tmpV.length() || 1e-6;
              const tgt = clamp(d, r0 * 0.55, r0 * 1.25);
              if (tgt !== d) { const c = (d - tgt) / d * 0.5; C0.x[i].addScaledVector(tmpV, c); C1.x[i].addScaledVector(tmpV, -c); }
            }
          }
          for (let k = 0; k < PAN.length; k++) {
            const C = PAN[k];
            for (let i = 1; i < C.x.length; i++) {
              pousserHors(C.x[i], nCap);
              if (solW > 0 && C.x[i].y < solY + 0.01) C.x[i].y = solY + 0.01;
            }
          }
        }
      }
      orienterPans();
    }
    // orientation des os : direction p_i → p_i+1 exprimée dans le repère du parent
    function orienterPans() {
      for (let k = 0; k < PAN.length; k++) {
        const C = PAN[k];
        qM(B.hips, q2); q2.premultiply(qCorps);   // orientation monde du bassin
        for (let i = 0; i < 4; i++) {
          tmpV.subVectors(C.x[i + 1], C.x[i]).normalize();
          tmpV.applyQuaternion(q3.copy(q2).invert());
          q1.setFromUnitVectors(C.dirs[i], tmpV);
          C.bones[i].quaternion.copy(q1);
          q2.multiply(q1);
        }
      }
    }

    // --------------------------------------------------------------- physique des deux pans de l'étole (espace monde)
    const ETO = [];
    {
      const Wc = M.W.chest;
      for (const [G, sx] of [['G', 1], ['D', -1]]) {
        const pts = ETO_Y.map((y) => pointEtole(sx, y));
        const L = [], dirs = [];
        for (let i = 0; i < pts.length - 1; i++) { L.push(vlen(vsub(pts[i + 1], pts[i]))); dirs.push(axe(vsub(pts[i + 1], pts[i]))); }
        // position de repos de chaque point : liée à la poitrine en haut, à la colonne puis au bassin plus bas, pour que
        // le pan reste couché sur le devant du manteau quand le corps se penche ou se cambre
        const osRepos = pts.map((p) => (p[1] > 1.16 ? 0 : p[1] > 0.98 ? 1 : 2));
        const Wr = [M.W.chest, M.W.spine, M.W.hips];
        ETO.push({ G: G, rest: pts.map((p, i) => vsub(p, Wr[osRepos[i]])), osRepos: osRepos, L: L, dirs: dirs, x: pts.map(() => new THREE.Vector3()), xp: pts.map(() => new THREE.Vector3()),
          bones: L.map((_, i) => B['eto' + G + '_' + i]) });
      }
    }
    // gabarit du torse (buste du manteau + ceinture) tous les centimètres, pour pousser l'étole hors du corps
    const GAB = { y0: 0.95, n: 56, wL: new Float32Array(56), wR: new Float32Array(56), dF: new Float32Array(56), dB: new Float32Array(56), oz: new Float32Array(56) };
    {
      const RB = prepRings(MANTEAU_RINGS);
      for (let i = 0; i < GAB.n; i++) {
        const y = GAB.y0 + i * 0.01, r = interpRing(RB, y - MANTEAU_Y0), e = 0.007 + (y > 0.98 && y < 1.04 ? 0.0075 : 0);
        GAB.wL[i] = r.wL + e; GAB.wR[i] = r.wR + e; GAB.dF[i] = r.dF + e; GAB.dB[i] = r.dB + e; GAB.oz[i] = r.oz;
      }
    }
    const mInvT = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()], osT = [B.chest, B.spine, B.hips];
    const yBindT = [M.W.chest, M.W.spine, M.W.hips];
    const chestM = new THREE.Matrix4(), vT = new THREE.Vector3();
    function pousserTorse(p) {
      // contrainte d'un seul côté : l'étole reste DEVANT le torse (jamais poussée vers le dos, pas de traversée),
      // dans le repère de la poitrine, de la colonne ou du bassin selon la hauteur (pose de référence)
      for (let b = 0; b < 3; b++) {
        vT.copy(p).applyMatrix4(mInvT[b]);
        const W0 = yBindT[b];
        const y = vT.y + W0[1];
        if (b === 0 && y < 1.14) continue;
        if (b === 1 && y < 0.98) continue;
        if (y < GAB.y0 || y > GAB.y0 + (GAB.n - 1) * 0.01) return;
        const i = Math.min(GAB.n - 1, Math.max(0, Math.round((y - GAB.y0) / 0.01)));
        const x = vT.x + W0[0], z = vT.z + W0[2];
        const w = x >= 0 ? GAB.wL[i] : GAB.wR[i], u = x / w;
        if (Math.abs(u) >= 1) return;
        const zf = GAB.oz[i] + GAB.dF[i] * Math.sqrt(1 - u * u);
        if (z < zf) { vT.z = zf - W0[2]; p.copy(vT).applyMatrix4(osT[b].matrixWorld); }
        return;
      }
    }
    const STIF_E = [0, 0.26, 0.2, 0.16, 0.13, 0.11, 0.09];
    function physiqueEtole(dt, lev, solW, solY) {
      const echelle = sCorps.x, nCap = st.nCap || 0;
      chestM.copy(B.chest.matrixWorld);
      for (let b = 0; b < 3; b++) mInvT[b].copy(osT[b].matrixWorld).invert();
      const reset = !st.etoInit;
      st.etoInit = true;
      const steps = reset ? 1 : Math.min(3, Math.max(1, Math.round(dt * 60)));
      const h = reset ? 0 : dt / steps;
      const g = -9.8 * 0.55, up = 1.1 * lev, t = st.temps;
      for (let s = 0; s < steps; s++) {
        for (let k = 0; k < ETO.length; k++) {
          const C = ETO[k];
          for (let i = 0; i < C.x.length; i++) {
            tmpV.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(osT[C.osRepos[i]].matrixWorld);
            if (i === 0 || reset) { C.x[i].copy(tmpV); C.xp[i].copy(tmpV); continue; }
            const x = C.x[i], xp = C.xp[i];
            const ax0 = x.x - xp.x, ay0 = x.y - xp.y, az0 = x.z - xp.z;
            const vit = Math.hypot(ax0, ay0, az0) / Math.max(1e-4, h);
            const dr = Math.max(0.8, 1 - h * (3.2 + 0.8 * vit));
            xp.copy(x);
            const wind = 0.22 * lev + 0.06;
            const nx = bruit1(t * 0.9 + k * 1.7 + i * 0.23, 181) * wind, nz = bruit1(t * 0.8 + k * 1.3 + i * 0.19, 183) * wind;
            const lift = up * (0.5 + 0.5 * bruit1(t * 0.7 + k * 0.9, 185)) * (i / 6);
            x.x += ax0 * dr + nx * h * h;
            x.y += ay0 * dr + (g + lift) * h * h;
            x.z += az0 * dr + nz * h * h;
            x.lerp(tmpV, STIF_E[i]);
          }
        }
        for (let it = 0; it < 2; it++) {
          for (let k = 0; k < ETO.length; k++) {
            const C = ETO[k];
            for (let i = 1; i < C.x.length; i++) {
              const p0 = C.x[i - 1], p1 = C.x[i], L = C.L[i - 1] * echelle;
              tmpV.subVectors(p1, p0); const d = tmpV.length() || 1e-6;
              p1.copy(p0).addScaledVector(tmpV, L / d);
            }
            for (let i = 1; i < C.x.length; i++) {
              pousserTorse(C.x[i]);
              pousserHors(C.x[i], nCap);
              if (solW > 0 && C.x[i].y < solY + 0.012) C.x[i].y = solY + 0.012;
            }
          }
          // les deux pans ne se traversent pas (écart minimal entre points de même rang)
          const A0 = ETO[0], A1 = ETO[1];
          for (let i = 1; i < A0.x.length; i++) {
            tmpV.subVectors(A1.x[i], A0.x[i]); const d = tmpV.length() || 1e-6, mn = 0.09 * echelle;
            if (d < mn) { const c = (d - mn) / d * 0.5; A0.x[i].addScaledVector(tmpV, c); A1.x[i].addScaledVector(tmpV, -c); }
          }
        }
      }
      orienterEtole();
    }
    function orienterEtole() {
      for (let k = 0; k < ETO.length; k++) {
        const C = ETO[k];
        qM(B.chest, q2); q2.premultiply(qCorps);
        for (let i = 0; i < C.bones.length; i++) {
          tmpV.subVectors(C.x[i + 1], C.x[i]).normalize();
          tmpV.applyQuaternion(q3.copy(q2).invert());
          q1.setFromUnitVectors(C.dirs[i], tmpV);
          C.bones[i].quaternion.copy(q1);
          q2.multiply(q1);
        }
      }
    }

    // --------------------------------------------------------------- tissus allégés (option allege, illusions)
    // Ni intégration ni contraintes itérées : chaque point des pans du manteau et de l'étole prend la position
    // d'équilibre qu'atteint la simulation : repos lié au bassin (ou à la colonne, à la poitrine pour l'étole), évasement
    // et affaissement selon la lévitation, traînée derrière selon la vitesse lissée du boss (même loi que la simulation à
    // 60 i/s), même souffle ; longueurs des segments conservées, bas des pans écarté des jambes, étole gardée devant le
    // torse. Même silhouette à distance pour une fraction du coût.
    const EVASE_P = [0, 0.003, 0.008, 0.015, 0.034], AFF_P0 = [0, 0.012, 0.03, 0.068, 0.15], AFF_P1 = [0, 0.004, 0.012, 0.034, 0.051];
    const TRAIN_P = [0, 0.0106, 0.026, 0.058, 0.13], SOUF_P = [0, 0.0025, 0.0062, 0.014, 0.031];
    const AFF_E = [0, 0.004, 0.006, 0.008, 0.01, 0.012, 0.014], TRAIN_E = [0, 0.0068, 0.0089, 0.011, 0.0137, 0.0162, 0.0198];
    const leg = { init: false, pos: new THREE.Vector3(), vit: new THREE.Vector3(), tmp: new THREE.Vector3() };
    function tissusLegers(dt, lev, solW, solY) {
      const echelle = sCorps.x, t = st.temps;
      // vitesse lissée du boss (monde) ; remise au repos après une téléportation (st.panInit)
      if (!leg.init || !st.panInit) { leg.pos.copy(objet.position); leg.vit.set(0, 0, 0); leg.init = true; }
      else if (dt > 0) {
        leg.tmp.subVectors(objet.position, leg.pos).divideScalar(dt);
        if (leg.tmp.lengthSq() > 900) leg.tmp.set(0, 0, 0);
        leg.vit.lerp(leg.tmp, 1 - Math.exp(-dt * 6)); leg.pos.copy(objet.position);
      }
      st.panInit = true; st.etoInit = true;
      const vx = leg.vit.x, vy = leg.vit.y, vz = leg.vit.z, vit = Math.hypot(vx, vy, vz);
      const kP = (2 + 0.55 * vit) / 4.2, kE = (3.2 + 0.8 * vit) / 6.4, wind = 1.4 * lev + 0.4;
      hipM.copy(B.hips.matrixWorld);
      const nCap = capsulesJambes(echelle);
      st.nCap = nCap;
      for (let k = 0; k < PAN.length; k++) {
        const C = PAN[k];
        const a = angPan(C.f, PAN_Y[3]);
        v3.set(Math.sin(a), 0, Math.cos(a)).applyQuaternion(qCorps);   // vers l'extérieur de la jupe (monde)
        for (let i = 0; i < C.x.length; i++) {
          const x = C.x[i];
          x.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(hipM);
          if (i > 0) {
            const ev = EVASE_P[i] * lev * echelle, af = lerp(AFF_P0[i], AFF_P1[i], lev) * echelle, tr = TRAIN_P[i] * kP, so = SOUF_P[i] * wind * echelle;
            x.x += v3.x * ev - vx * tr + bruit1(t * 0.8 + k * 0.37 + i * 0.21, 81) * so;
            x.y += -af - vy * tr + bruit1(t * 0.9 + k * 0.33, 85) * so * 0.6;
            x.z += v3.z * ev - vz * tr + bruit1(t * 0.7 + k * 0.29 + i * 0.17, 83) * so;
            const p0 = C.x[i - 1], L = C.L[i - 1] * echelle;
            tmpV.subVectors(x, p0); const d = tmpV.length() || 1e-6;
            x.copy(p0).addScaledVector(tmpV, L / d);
            if (i >= 2) pousserHors(x, nCap);
            if (solW > 0 && x.y < solY + 0.01) x.y = solY + 0.01;
          }
          C.xp[i].copy(x);
        }
      }
      orienterPans();
      for (let b = 0; b < 3; b++) mInvT[b].copy(osT[b].matrixWorld).invert();
      for (let k = 0; k < ETO.length; k++) {
        const C = ETO[k];
        for (let i = 0; i < C.x.length; i++) {
          const x = C.x[i];
          x.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(osT[C.osRepos[i]].matrixWorld);
          if (i > 0) {
            const tr = TRAIN_E[i] * kE;
            x.x -= vx * tr; x.y -= AFF_E[i] * echelle + vy * tr; x.z -= vz * tr;
            const p0 = C.x[i - 1], L = C.L[i - 1] * echelle;
            tmpV.subVectors(x, p0); const d = tmpV.length() || 1e-6;
            x.copy(p0).addScaledVector(tmpV, L / d);
            pousserTorse(x);
            if (solW > 0 && x.y < solY + 0.012) x.y = solY + 0.012;
          }
          C.xp[i].copy(x);
        }
      }
      orienterEtole();
    }
    // --------------------------------------------------------------- manches qui remontent (cibles de morphose « L » / « R »)
    const mManteau = M.maillages && M.maillages.manteau, iMorph = mManteau && mManteau.userData.morph ? mManteau.userData.morph : null;
    const vF = new THREE.Vector3(), vH = new THREE.Vector3();
    function majManches(dt) {
      if (!iMorph || !mManteau.morphTargetInfluences) return;
      for (let k = 0; k < 2; k++) {
        const S = k === 0 ? 'L' : 'R';
        if (iMorph[S] == null) continue;
        pM(B['fore' + S], vF); pM(B['hand' + S], vH);
        vH.sub(vF);
        const dy = vH.y / (vH.length() || 1);
        const cible = smooth(-0.12, 0.6, dy);
        const cur = mManteau.morphTargetInfluences[iMorph[S]];
        mManteau.morphTargetInfluences[iMorph[S]] = cur + (cible - cur) * (1 - Math.exp(-dt * (cible > cur ? 6 : 3.5)));
      }
    }

    // --------------------------------------------------------------- application d'une frame
    let dtK = 0;
    const kk = (r) => 1 - Math.exp(-dtK * r);
    const bruitTr = (s2, T, trA) => bruit1(T * 16 + s2 * 7.3, 97 + s2) * trA;
    const CTX = { E: null, A: A, OFF: OFF, action: '', u: 0, t: 0, temps: 0, dt: 0, lev: 0, sol: 0, solMonde: 0, puis: 0, rage: 0, faib: 0, bouclier: 0, dissol: 0, sang: false, qCorps: qCorps, mInv: mInv };
    const PISTE = { m: [0, 0, 0], pole: [0, 0, 0], pd: [0, 0, 0], vP: [0, 0, 0], sh: [0, 0, 0], tgt: [0, 0, 0], dir: [0, 0, 0], d2: [0, 0, 0], side: [0, 0, 0], aim: [0, 0, 0], upv: [0, 0, 0], sd: [0, 0, 0], pAim: [0, 0, 0], pl: [0, 0, 0], tmp: [0, 0, 0] };
    const SIDES = [['L', 'G', OFF.mG, OFF.pG, OFF.paG, OFF.vG, OFF.msG, OFF.fG, OFF.dG], ['R', 'D', OFF.mD, OFF.pD, OFF.paD, OFF.vD, OFF.msD, OFF.fD, OFF.dD]];
    const JAMBES = [['L', OFF.jG, 1, 0], ['R', OFF.jD, -1, 2.1]];
    const OSJ = { L: { thigh: B.thighL, shin: B.shinL, foot: B.footL, toes: B.toesL }, R: { thigh: B.thighR, shin: B.shinR, foot: B.footR, toes: B.toesR } };
    function appliquer(E, dt) {
      dt = clamp(dt || 0, 0, 0.1);
      E = E || {};
      const present = E.present !== false;
      objet.visible = present;
      st.temps += dt;
      U.uTemps.value = st.temps;
      // placement : position = point au sol sous les semelles, altitude = hauteur des semelles (SPEC §2)
      const alt = E.altitude || 0;
      if (E.position) objet.position.set(E.position.x, E.position.y + (M.opts.altitudeIncluse ? 0 : alt), E.position.z);
      if (E.cap != null) objet.rotation.set(0, E.cap, 0);
      // v2.2 : seuls l'objet et le groupe du corps servent avant les bras (le reste est recalculé plus loin)
      objet.updateWorldMatrix(true, false); corps.updateWorldMatrix(false, false);
      majRepere();
      if (st.aPos && objet.position.distanceTo(st.posPrec) > 2.0) { st.panInit = false; st.etoInit = false; }   // téléportation : tissus au repos
      st.posPrec.copy(objet.position); st.aPos = true;

      // ---- action et temps normalisé
      const action = (E.action && CL[E.action]) ? E.action : 'flotte';
      const clip = CL[action];
      const tA = Math.max(0, E.tAction || 0);
      const duree = E.dureeAction > 0 ? E.dureeAction : (DUREES_DEFAUT[action] || 1);
      // u imposé par le séquenceur (étape d'une action), sinon temps / durée ; boucles : horloge du modèle
      let u = clip.boucle ? (tA / clip.periode) % 1 : (E.u != null ? clamp(E.u, 0, 1) : clamp(tA / duree, 0, 1));
      const uCmp = clip.boucle ? tA : u;
      if (action !== st.action || uCmp + 1e-4 < st.tPrec) {
        if (st.init) { Pfrom.set(P); st.fondu = 0; st.fonduT = Math.max(0.03, clip.fondu); } else st.fondu = 1;
        st.action = action;
      }
      st.tPrec = uCmp; st.init = true;
      evaluerClip(clip, u, Pc);
      if (clip.extra) clip.extra(Pc, tA, u, duree);
      const mainG = E.main === 'gauche' && action.indexOf('double') !== 0;
      if (mainG) { miroirPose(Pc, Pm); Pc.set(Pm); }
      if (st.fondu < 1) {
        st.fondu = Math.min(1, st.fondu + dt / st.fonduT);
        const w = ease.s(st.fondu);
        for (let k = 0; k < NPOSE; k++) P[k] = Pfrom[k] + (Pc[k] - Pfrom[k]) * w;
      } else P.set(Pc);
      A.set(P);

      // ---- grandeurs lissées
      dtK = dt;
      st.puis += ((E.puissance || 0) - st.puis) * kk(3);
      st.rage += (((E.rage === true ? 1 : +E.rage) || 0) - st.rage) * kk(4);
      st.faib += ((E.faiblesse || 0) - st.faib) * kk(2);
      st.bouclier += ((E.bouclier || 0) - st.bouclier) * kk(8);
      const lames = E.lames || { etat: 'aucune', t: 0 }, ailes = E.ailes || { etat: 'aucune', t: 0 };
      const tenir = lames.etat === 'actives' ? 1 : lames.etat === 'formation' ? smooth(0.55, 0.8, lames.t) : lames.etat === 'destruction' ? 1 - smooth(0.3, 0.75, lames.t) : 0;
      const sol = A[OFF.sol], lev = 1 - sol;
      st.solPose = sol;
      const T = st.temps;
      // secousse de la poitrine à chaque âme absorbée (vue.ames augmente)
      st.pulse = Math.max(st.pulse * Math.exp(-dt * 5.5), E.pulseAme ? 1 : 0);
      if (st.pulse > 0.01) {
        const pa = st.pulse;
        A[OFF.ch] -= 0.13 * pa; A[OFF.hd] -= 0.1 * pa; A[OFF.mach] += 0.3 * pa; A[OFF.lu] += 0.8 * pa; A[OFF.au] += 0.6 * pa;
      }

      // ---- couches : respiration, flottement, faiblesse, rage, vitesse, sursaut
      const fa = st.faib;
      const perR = lerp(4.4, 2.6, fa) / (1 + 0.25 * st.rage), br = Math.sin(T * TAU / perR) * A[OFF.rs] * (1 + 0.6 * fa);
      A[OFF.ch] += -0.028 * br; A[OFF.sp] += -0.01 * br; A[OFF.hd] += 0.014 * br;
      A[OFF.cG] += 0.022 * br; A[OFF.cD] += 0.022 * br;
      A[OFF.h + 1] += (0.011 * Math.sin(T * 1.27) + 0.004 * Math.sin(T * 2.9)) * lev;
      A[OFF.hr + 2] += 0.018 * Math.sin(T * 1.19) * lev; A[OFF.hr] += 0.012 * Math.sin(T * 0.97 + 1) * lev;
      for (let j = 0; j < 2; j++) {
        const o = JAMBES[j][1], ph = JAMBES[j][3];
        A[o] += 0.06 * Math.sin(T * 0.83 + ph) * lev;
        A[o + 2] += 0.08 * Math.sin(T * 0.71 + ph + 0.5) * lev;
        A[o + 3] += 0.06 * Math.sin(T * 1.13 + ph) * lev;
      }
      if (fa > 0.01) {
        A[OFF.sp] += 0.1 * fa; A[OFF.ch] += 0.1 * fa; A[OFF.nk] += 0.08 * fa; A[OFF.hd] += 0.14 * fa;
        A[OFF.cG] -= 0.1 * fa; A[OFF.cD] -= 0.1 * fa;
        A[OFF.mG + 1] -= 0.05 * fa; A[OFF.mD + 1] -= 0.05 * fa;
        A[OFF.hr + 2] += 0.05 * fa * bruit1(T * 0.5, 91);
        A[OFF.lu] *= 1 - 0.5 * fa; A[OFF.au] *= 1 - 0.6 * fa;
      }
      const trA = Math.max(A[OFF.tr], st.rage * 0.55) + fa * 0.25;
      if (trA > 0.001) {
        A[OFF.sp] += 0.008 * bruitTr(1, T, trA); A[OFF.ch] += 0.012 * bruitTr(2, T, trA); A[OFF.ch + 2] += 0.008 * bruitTr(3, T, trA);
        A[OFF.nk + 1] += 0.012 * bruitTr(4, T, trA); A[OFF.hd] += 0.015 * bruitTr(5, T, trA); A[OFF.hd + 1] += 0.015 * bruitTr(6, T, trA); A[OFF.hd + 2] += 0.01 * bruitTr(7, T, trA);
        for (let i = 0; i < 3; i++) { A[OFF.mG + i] += 0.0045 * bruitTr(8 + i, T, trA); A[OFF.mD + i] += 0.0045 * bruitTr(11 + i, T, trA); }
      }
      if (st.rage > 0.01) { A[OFF.lu] *= 1 + 0.5 * st.rage; A[OFF.au] *= 1 + 0.4 * st.rage; A[OFF.cG] += 0.06 * st.rage; A[OFF.cD] += 0.06 * st.rage; }
      // inclinaison selon la vitesse (repère du boss)
      if (E.vitesse) {
        v1.set(E.vitesse.x || 0, 0, E.vitesse.z || 0).applyQuaternion(q1.copy(qCorps).invert());
        st.vitF += (v1.z - st.vitF) * kk(4); st.vitL += (v1.x - st.vitL) * kk(4);
      } else { st.vitF *= 1 - kk(4); st.vitL *= 1 - kk(4); }
      A[OFF.sp] += clamp(st.vitF * 0.03, -0.12, 0.2) * lev;
      A[OFF.rr] += clamp(-st.vitL * 0.03, -0.14, 0.14) * lev;
      // sursaut à chaque impact (ressort amorti)
      const to = E.touche;
      if (to && to.compteur != null) {
        if (st.toucheN != null && to.compteur !== st.toucheN) {
          const d = to.direction || { x: 0, y: 0, z: -1 };
          v1.set(d.x || 0, d.y || 0, d.z || 0).applyQuaternion(q1.copy(qCorps).invert());
          if (v1.lengthSq() < 1e-6) v1.set(0, 0, -1);
          v1.normalize();
          const f = clamp(to.force == null ? 0.6 : to.force, 0, 1.5) * (1 - 0.6 * sol);
          st.ressortV[0] += v1.z * 5.4 * f; st.ressortV[1] += -v1.x * 5.0 * f; st.ressortV[2] += (hash3(to.compteur, 3, 1, 5) - 0.5) * 3.4 * f;
          if (M.voile && st.bouclier > 0.3) M.voile.impactDirection(v1, f);
        }
        st.toucheN = to.compteur;
      }
      for (let i = 0; i < 3; i++) {
        const w0 = 15, z0 = 0.38;
        const acc = -w0 * w0 * st.ressort[i] - 2 * z0 * w0 * st.ressortV[i];
        st.ressortV[i] += acc * dt; st.ressort[i] += st.ressortV[i] * dt;
      }
      const rp = st.ressort[0], rr = st.ressort[1], ry = st.ressort[2];
      A[OFF.sp] += rp * 0.3; A[OFF.ch] += rp * 0.45; A[OFF.hd] += rp * 0.45; A[OFF.nk] += rp * 0.15;
      A[OFF.sp + 2] += rr * 0.3; A[OFF.ch + 2] += rr * 0.4; A[OFF.hd + 2] += rr * 0.3; A[OFF.ch + 1] += ry * 0.5; A[OFF.hd + 1] += ry * 0.3;
      A[OFF.h] += -rr * 0.1; A[OFF.h + 2] += rp * 0.1;   // le corps entier est un peu repoussé par l'impact

      // ---- regard (tête et cou, limites), l'excédent passe au buste
      let rgW = A[OFF.rg];
      if (E.regard && rgW > 0.001) {
        v1.set(E.regard.x, E.regard.y, E.regard.z);
        v2.set(0, 1.62, 0.02); corps.localToWorld(v2);
        v1.sub(v2).applyQuaternion(q1.copy(qCorps).invert());
        const yaw = Math.atan2(v1.x, v1.z), pit = Math.atan2(v1.y, Math.hypot(v1.x, v1.z));
        let dy = wrapPi(yaw - (A[OFF.hr + 1] + A[OFF.sp + 1] + A[OFF.ch + 1]));
        if (Math.abs(dy) > 2.4) rgW *= smooth(3.1, 2.4, Math.abs(dy));
        dy = clamp(dy, -1.35, 1.35);
        const dp = clamp(-pit - (A[OFF.hr] + A[OFF.sp] + A[OFF.ch] + A[OFF.rp]), -0.75, 0.7);
        st.regardY += (dy - st.regardY) * kk(6); st.regardP += (dp - st.regardP) * kk(6);
        const exc = st.regardY - clamp(st.regardY, -0.95, 0.95);
        A[OFF.ch + 1] += exc * 0.8 * rgW;
        const ry2 = clamp(st.regardY, -0.95, 0.95);
        A[OFF.nk + 1] = lerp(A[OFF.nk + 1], ry2 * 0.42, rgW); A[OFF.hd + 1] = lerp(A[OFF.hd + 1], ry2 * 0.58, rgW);
        A[OFF.nk] = lerp(A[OFF.nk], st.regardP * 0.4, rgW); A[OFF.hd] = lerp(A[OFF.hd], st.regardP * 0.6, rgW);
      }

      // ---- racine (rotation de tout le corps autour du bassin), bassin, colonne, tête
      let rpT = A[OFF.rp];
      if (action === 'pique' && E.vitesse) {
        const vh = Math.hypot(E.vitesse.x || 0, E.vitesse.z || 0), vy = E.vitesse.y || 0;
        if (vh + Math.abs(vy) > 1) rpT += clamp(Math.atan2(-vy, Math.max(0.1, vh)), -0.3, 1.1) * (st.fondu);
      }
      const sol0 = -alt / Math.max(1e-6, sCorps.y / (corps.parent ? 1 : 1)) / ECHELLE * ECHELLE;
      const solLocal = -alt / ECHELLE;
      e.set(rpT, 0, A[OFF.rr], 'XYZ'); q1.setFromEuler(e);
      B.root.quaternion.copy(q1);
      v1.set(0, 1.0, 0); v2.copy(v1).applyQuaternion(q1);
      B.root.position.set(v1.x - v2.x + A[OFF.h], v1.y - v2.y + A[OFF.h + 1] + sol * solLocal, v1.z - v2.z + A[OFF.h + 2]);
      B.hips.quaternion.setFromEuler(e.set(A[OFF.hr], A[OFF.hr + 1], A[OFF.hr + 2], 'XYZ'));
      B.spine.quaternion.setFromEuler(e.set(A[OFF.sp], A[OFF.sp + 1], A[OFF.sp + 2], 'XYZ'));
      B.chest.quaternion.setFromEuler(e.set(A[OFF.ch], A[OFF.ch + 1], A[OFF.ch + 2], 'XYZ'));
      if (M.tete && !M.tete.peauSkinnee) {
        // tête fournie rigide (cou lié à l'os de la tête) : la rotation passe surtout par l'os du cou pour que le cou
        // reste dans le col ; l'os de la tête ne garde qu'une petite part (hochements fins)
        for (let i = 0; i < 3; i++) { const h = A[OFF.hd + i]; A[OFF.nk + i] += h * 0.72; A[OFF.hd + i] = h * 0.28; }
      }
      B.neck.quaternion.setFromEuler(e.set(A[OFF.nk], A[OFF.nk + 1], A[OFF.nk + 2], 'XYZ'));
      B.head.quaternion.setFromEuler(e.set(A[OFF.hd], A[OFF.hd + 1], A[OFF.hd + 2], 'XYZ'));
      B.clavL.quaternion.setFromEuler(e.set(0, -A[OFF.cG + 1], A[OFF.cG], 'XYZ'));
      B.clavR.quaternion.setFromEuler(e.set(0, A[OFF.cD + 1], -A[OFF.cD], 'XYZ'));
      for (let j = 0; j < 2; j++) {
        const J = JAMBES[j], o = J[1], sx = J[2], OJ = OSJ[J[0]];
        OJ.thigh.quaternion.setFromEuler(e.set(A[o], A[o + 4] * sx, A[o + 1] * sx, 'XYZ'));
        OJ.shin.quaternion.setFromEuler(e.set(Math.max(0, A[o + 2]), 0, 0, 'XYZ'));
        OJ.foot.quaternion.setFromEuler(e.set(A[o + 3], 0, 0, 'XYZ'));
        OJ.toes.quaternion.setFromEuler(e.set(-0.15 * A[o + 3], 0, 0, 'XYZ'));
      }
      // mâchoire et yeux
      st.mach += (A[OFF.mach] - st.mach) * kk(18);
      const mach = M.machoireForcee != null ? M.machoireForcee : st.mach;
      B.machoire.quaternion.setFromEuler(e.set(0.4 * mach, 0, 0, 'XYZ'));
      const sac = bruit1(T * 0.9, 61) * 0.12, sac2 = bruit1(T * 0.7 + 3, 63) * 0.06;
      B.oeilG.quaternion.setFromEuler(e.set(-sac2 - (rgW > 0 ? (st.regardP - clamp(st.regardP, -0.6, 0.6)) * 0.5 : 0), sac + (rgW > 0 ? (st.regardY - clamp(st.regardY, -0.95, 0.95)) * 0.4 : 0), 0, 'XYZ'));
      B.oeilD.quaternion.copy(B.oeilG.quaternion);
      if (M.tete && M.tete.ancres) {          // tête cuite : ses globes tournent comme les os des yeux
        if (M.tete.ancres.oeilG) M.tete.ancres.oeilG.quaternion.copy(B.oeilG.quaternion);
        if (M.tete.ancres.oeilD) M.tete.ancres.oeilD.quaternion.copy(B.oeilD.quaternion);
      }
      // v2.2 : l'IK des bras ne lit que la chaîne racine → bassin → colonne → poitrine → clavicules → épaules ; chaque
      // bras met ensuite son sous-arbre à jour (setQM). Le reste de l'arbre est recalculé avant les tissus.
      B.armL.updateWorldMatrix(true, false); B.clavR.updateWorldMatrix(false, false); B.armR.updateWorldMatrix(false, false);

      // ---- bras : cibles du buste, visée, mains posées au sol ; IK, poignets, doigts
      qM(B.chest, q2);
      m1.copy(mInv).multiply(B.chest.matrixWorld);
      const visee = E.visee, P_ = PISTE, double = action.indexOf('double') === 0;
      let aVisee = false;
      if (visee) { v3.set(visee.x, visee.y, visee.z).applyMatrix4(mInv); set3(P_.vP, v3.x, v3.y, v3.z); aVisee = true; }
      for (let si = 0; si < 2; si++) {
        const SD = SIDES[si], S = SD[0], C = COTE[S], oM = SD[2], oP = SD[3], oPa = SD[4], oV = SD[5], oMs = SD[6], oF = SD[7], oD = SD[8];
        v1.set(A[oM], A[oM + 1], A[oM + 2]).applyMatrix4(m1);
        const cible = set3(P_.m, v1.x, v1.y, v1.z);
        const pole = rotV3(P_.pole, set3(P_.tmp, A[oP], A[oP + 1], A[oP + 2]), q2);
        const pd = rotV3(P_.pd, set3(P_.tmp, A[oPa], A[oPa + 1], A[oPa + 2]), q2);
        const wv = A[oV];
        if (wv > 0.001 && aVisee) {
          pM(C.os.arm, v2);
          const sh = set3(P_.sh, v2.x, v2.y, v2.z);
          const tgt = set3(P_.tgt, P_.vP[0], P_.vP[1], P_.vP[2]);
          if (double) {   // deux mains, deux cibles écartées
            nrm3(P_.d2, set3(P_.d2, P_.vP[0] - sh[0], 0, P_.vP[2] - sh[2]));
            madd3(tgt, tgt, set3(P_.side, P_.d2[2], 0, -P_.d2[0]), C.sx * 1.4);
          }
          const dir = nrm3(P_.dir, sub3(P_.dir, tgt, sh));
          // jamais de bras tendu vers l'avant au-dessus de l'horizontale : inclinaison minimale sous l'horizontale
          const minE = Math.sin(MIN_VISEE[action] != null ? MIN_VISEE[action] : 0.3);
          if (dir[1] > -minE) { const hz = Math.hypot(dir[0], dir[2]) || 1; const k = Math.sqrt(1 - minE * minE) / hz; set3(dir, dir[0] * k, -minE, dir[2] * k); }
          // lacet borné : le bras ne passe pas derrière le dos ni loin en travers du corps
          const yawB = A[OFF.hr + 1] + A[OFF.sp + 1] + A[OFF.ch + 1];
          let yw = wrapPi(Math.atan2(dir[0], dir[2]) - yawB);
          yw = C.sx > 0 ? clamp(yw, -0.55, 1.5) : clamp(yw, -1.5, 0.55);
          const hz = Math.hypot(dir[0], dir[2]);
          set3(dir, Math.sin(yw + yawB) * hz, dir[1], Math.cos(yw + yawB) * hz);
          const reach = (L_UPPER + L_FORE) * A[OFF.ext] * 0.97;
          lerp3(cible, cible, madd3(P_.aim, sh, dir, reach), wv);
          const upv = nrm3(P_.upv, set3(P_.upv, -dir[0] * dir[1], 1 - dir[1] * dir[1], -dir[2] * dir[1]));
          const sd = crs3(P_.sd, upv, dir);
          const pAim = set3(P_.pAim, sd[0] * A[oPa] + upv[0] * A[oPa + 1] + dir[0] * A[oPa + 2], sd[1] * A[oPa] + upv[1] * A[oPa + 1] + dir[1] * A[oPa + 2], sd[2] * A[oPa] + upv[2] * A[oPa + 1] + dir[2] * A[oPa + 2]);
          lerp3(pd, pd, pAim, wv);
          lerp3(pole, pole, set3(P_.tmp, C.sx * 0.7, -0.7, -0.2), wv * 0.6);
        }
        if (A[oMs + 2] > 0.001) {
          const wg = clamp(A[oMs + 2], 0, 1);
          lerp3(cible, cible, set3(P_.tmp, A[oMs], solLocal + 0.05, A[oMs + 1]), wg);
          lerp3(pd, pd, set3(P_.tmp, 0, -1, 0.1), wg);
        }
        resoudreBras(S, cible, pole);
        orienterMain(S, nrm3(pd, pd), A[oF], A[oF + 1]);
        const idle = (action === 'flotte' || action === 'meditation' || action === 'rage' || action === 'faible') ? 1 : 0.25;
        appliquerDoigts(S, oD, tenir, trA, idle * (1 - tenir));
      }

      // ---- tête : mâchoire, lueur, clignement (module de tête ou tête provisoire)
      const lu = A[OFF.lu] * (0.7 + 0.6 * st.puis);
      st.lueur += (lu - st.lueur) * kk(10);
      const lueur = M.lueurForcee != null ? M.lueurForcee : st.lueur;
      const cyc = (T % 5.3) / 5.3, blink = smooth(0.0, 0.03, cyc) * (1 - smooth(0.03, 0.07, cyc));
      const cl = Math.max(A[OFF.cl], blink * 0.9);
      if (M.tete) {
        if (M.tete.setMachoire) M.tete.setMachoire(mach);
        if (M.tete.setLueur) M.tete.setLueur(clamp(lueur / 2.6, 0, 1));
        if (M.tete.setCligne) M.tete.setCligne(cl);
      }
      if (M.MAT.yeux) M.MAT.yeux.emissiveIntensity = 2.2 * lueur * (1 - 0.85 * A[OFF.cl]);
      U.uVeine.value = clamp(0.15 * st.puis + 0.25 * st.rage + 0.3 * Math.max(0, lueur - 1.2), 0, 1.2);
      U.uPuis.value = clamp(st.puis * 0.9 + 0.35 * Math.max(0, A[OFF.au] - 1) + 0.3 * st.rage, 0, 1.6) * (1 - 0.7 * fa);

      // ---- dissolution (apparition, disparitions, téléportations), tourbillon
      const fd = DISSOL_ACTIONS[action];
      let dis = fd ? fd(u) : 0;
      if (st.fondu < 1 && !fd) dis *= 0;
      st.dissol = dis;
      U.uDissol.value = dis;
      if (M.tete && M.tete.objet) M.tete.objet.visible = dis < 0.55;   // yeux, dents : disparaissent avec la peau
      const sang = PHASE5[action] || lames.etat !== 'aucune';
      // lames présentes (phase 5) : brume à la teinte des lames de CETTE instance (rouge : sang ; bleu : glace ; vert : spectre)
      if (sang) { if (M.teinte) U.uDissolCoul.value.copy(M.teinte.dissol); else U.uDissolCoul.value.setRGB(0.9, 0.02, 0.01); }
      else U.uDissolCoul.value.setRGB(1.0, 0.32, 0.06);
      let sxz = 1, sy = 1, spin = 0;
      if (action === 'teleport-sortie') { const k = smooth(0.25, 1.0, u); sxz = 1 - 0.75 * k; sy = 1 + 0.35 * k; spin = 7 * k * k; }
      else if (action === 'teleport-entree') { const k = 1 - smooth(0.0, 0.6, u); sxz = 1 - 0.75 * k; sy = 1 + 0.35 * k; spin = -5 * k * k; }
      corps.scale.set(ECHELLE * sxz, ECHELLE * sy, ECHELLE * sxz);
      if (spin) { B.root.quaternion.premultiply(q1.setFromAxisAngle(v1.set(0, 1, 0), spin)); }

      // ---- manteau, ailes, lames, voile, aura
      objet.updateMatrixWorld(true);
      majRepere();
      const solMonde = M.solCourant != null && Number.isFinite(M.solCourant) ? M.solCourant : objet.position.y - alt;
      if (leger) tissusLegers(dt, lev * (action === 'cadavre' ? 0 : 1), sol, solMonde);
      else {
        physiqueManteau(dt, lev * (action === 'cadavre' ? 0 : 1), sol, solMonde);
        physiqueEtole(dt, lev * (action === 'cadavre' ? 0 : 1), sol, solMonde);
      }
      majManches(dt);
      U.uFlotAmp.value = 0.008 + 0.01 * lev;
      const ctx = CTX;
      ctx.E = E; ctx.action = action; ctx.u = u; ctx.t = tA; ctx.temps = T; ctx.dt = dt; ctx.lev = lev; ctx.sol = sol; ctx.solMonde = solMonde;
      ctx.puis = st.puis; ctx.rage = st.rage; ctx.faib = fa; ctx.bouclier = st.bouclier; ctx.dissol = dis; ctx.sang = !!sang;
      if (M.ailes) M.ailes.maj(ailes, ctx);
      if (M.lames) M.lames.maj(lames, ctx);
      if (M.voile) M.voile.maj(ctx);
      if (M.aura) M.aura.maj(ctx);
      // allégé : les matrices monde finales sont celles que le rendu recalcule (scene.matrixWorldAutoUpdate, par défaut) ;
      // les points (getWorldPosition) et hitboxes() se mettent à jour d'eux-mêmes
      if (!leger) objet.updateMatrixWorld(true);
      return st;
    }
    function reinitialiser() {
      st.temps = 0; st.action = null; st.tPrec = -1; st.fondu = 1; st.init = false; st.toucheN = null;
      st.ressort = [0, 0, 0]; st.ressortV = [0, 0, 0]; st.regardY = 0; st.regardP = 0; st.vitF = 0; st.vitL = 0;
      st.panInit = false; st.etoInit = false; st.aPos = false; st.mach = 0; st.lueur = 1; st.pulse = 0;
      if (iMorph && mManteau.morphTargetInfluences) for (let i = 0; i < mManteau.morphTargetInfluences.length; i++) mManteau.morphTargetInfluences[i] = 0;
      P.set(BASE_T); Pfrom.set(BASE_T);
      if (M.lames && M.lames.reinitialiser) M.lames.reinitialiser();
      if (M.ailes && M.ailes.reinitialiser) M.ailes.reinitialiser();
      if (M.aura && M.aura.reinitialiser) M.aura.reinitialiser();
      if (M.voile && M.voile.reinitialiser) M.voile.reinitialiser();
    }
    // sursaut à l'impact : (dx, dy, dz) = direction de la balle dans le monde (du tireur vers le boss)
    function sursaut(dx, dy, dz, force) {
      majRepere();
      v1.set(dx, dy, dz).applyQuaternion(q1.copy(qCorps).invert());
      if (v1.lengthSq() < 1e-6) v1.set(0, 0, -1);
      v1.normalize();
      const f = clamp(force, 0, 1.5) * (1 - 0.6 * st.solPose);
      st.ressortV[0] += v1.z * 5.4 * f; st.ressortV[1] += -v1.x * 5.0 * f; st.ressortV[2] += (hash3(st.nSursaut++, 3, 1, 5) - 0.5) * 3.4 * f;
      if (M.voile && st.bouclier > 0.12) M.voile.impactDirection(v1, f, st.nSursaut);
    }
    return { appliquer: appliquer, reinitialiser: reinitialiser, sursaut: sursaut, etat: st, pose: P, tissus: { pans: PAN, etole: ETO } };
  }

  // ============================================================================================
  // Séquenceur : traduit la vue publique (combat.etat().boss, API.md §2 et §5) en commande interne de
  // l'animateur : clip de poses, temps normalisé u, temps de l'étape, visée, couches (rage, faiblesse,
  // voile, puissance), états des ailes et des lames avec leur avancement. Aucune allocation par image :
  // la commande est un objet unique réutilisé.
  // Chaque étape → [clip, u0, u1, options, duréeNominale] : u = u0 + (u1 − u0) × progression de l'étape ; une étape sans
  // durée connue (duree null, progression 0 : crochet « lancer ») avance avec action.t / duréeNominale puis tient la fin.
  // 'boucle' : clip en boucle sur l'horloge du modèle ; 'cycle' : clip en boucle depuis le début de l'étape (crochet
  // « traction », durée inconnue) ; 'extraction' : prise qui se resserre puis tient.
  // ============================================================================================
  const ACTIONS_API = ['apparition', 'invocation', 'trait', 'souffrance', 'recharge', 'absorption', 'transformation_ailes', 'pique',
    'effondrement', 'teleport_depart', 'teleport_arrivee', 'retour_rage', 'arrachement', 'onde_choc', 'faiblesse', 'rituel_ames',
    'transformation_lames', 'frappe', 'frappe_ordinaire', 'defaite', 'siphon', 'crochet', 'evanouissement', 'resurgissement'];
  const LOCOMOTIONS_API = ['aucune', 'levitation', 'ailes', 'rage', 'affaibli', 'traque', 'mort'];
  const SEQ_V = 1, SEQ_J = 2;   // options : V = la main droite vise action.cible ; J = cible = un joueur (viser la poitrine)
  const SEQ = {
    apparition: { formation: ['apparition', 0, 0.86], presentation: ['presentation', 0, 1] },
    invocation: { preparation: ['incantation', 0, 1], lancer: ['projection', 0, 1, SEQ_V], recuperation: ['retour-incantation', 0, 1] },
    trait: { preparation: ['trait-preparation', 0, 1, SEQ_V | SEQ_J], lancer: ['trait-lancer', 0, 1, SEQ_V | SEQ_J], recuperation: ['retour-incantation', 0.2, 1] },
    souffrance: { souffrance: ['souffrance-colere', 0, 0.45], colere: ['souffrance-colere', 0.45, 1] },
    recharge: { boucle: ['meditation', 'boucle'] },
    absorption: { saisie: ['absorption', 0, 0.22], extraction: ['absorption', 'extraction'], fin: ['absorption', 0.9, 1] },
    transformation_ailes: { cambrure: ['transformation-ailes', 0, 0.56], deploiement: ['transformation-ailes', 0.56, 0.74], rugissement: ['transformation-ailes', 0.74, 1] },
    pique: { montee: ['envol', 0, 1], visee: ['verrouillage', 0, 1], charge: ['pique', 0, 1], impact: ['impact-pique', 0, 1], etourdi: ['etourdi', 0, 1], retour: ['remontee', 0, 1] },
    effondrement: { souffrance: ['souffrance', 0, 1] },
    teleport_depart: { implosion: ['teleport-sortie', 0, 1] },
    teleport_arrivee: { apparition: ['teleport-entree', 0, 1] },
    retour_rage: { descente: ['retour-rage', 0, 0.3], deflagration: ['retour-rage', 0.3, 0.5], rugissement: ['retour-rage', 0.5, 1] },
    arrachement: { designation: ['designation-mur', 0, 1, SEQ_V], fracture: ['saisie-mur', 0, 0.5, SEQ_V], levitation: ['saisie-mur', 0.5, 1], projection: ['lancer', 0, 0.62, SEQ_V | SEQ_J], recuperation: ['lancer', 0.62, 1] },
    onde_choc: { preparation: ['repulsion', 0, 0.52], frappe: ['repulsion', 0.52, 0.64], recuperation: ['repulsion', 0.64, 1] },
    faiblesse: { chute: ['ramene', 0, 1], boucle: ['faible', 'boucle'] },
    rituel_ames: { elevation: ['rituel-ames', 0, 0.2], incantation: ['rituel-ames', 0.2, 0.8], capture: ['rituel-ames', 0.8, 1] },
    transformation_lames: { formation: ['formation-lames', 0, 1] },
    frappe: { preparation: ['frappe-preparation', 0, 1], frappe: ['frappe', 0, 1], recuperation: ['frappe-recuperation', 0, 1] },
    frappe_ordinaire: { preparation: ['frappe-ord-preparation', 0, 1], frappe: ['frappe-ord', 0, 1], recuperation: ['frappe-ord-recuperation', 0, 1] },
    defaite: { chancelle: ['defaite', 0, 0.3], genoux: ['defaite', 0.3, 0.64], chute: ['defaite', 0.64, 1], mort: ['cadavre', 'boucle'] },
    // v1.3 (API.md §15.2) : siphon d'une cuve à distance (le boss est déjà tourné vers elle) : les bras se lèvent et s'ouvrent,
    // les doigts crochus tirent le liquide par saccades, puis ramènent l'énergie à la poitrine quand la cuve éclate
    siphon: { approche: ['absorption', 0, 0.22], aspiration: ['absorption', 0.22, 0.82], eclatement: ['absorption', 0.82, 0.93], recuperation: ['absorption', 0.93, 1] },
    // v1.4 (API.md §16.5, §16.6) : crochet (palier 3), lames actives. preparation : bras droit tendu vers le joueur visé
    // (cible = ses pieds, visée à hauteur de poitrine), poing serré ; lancer (durée inconnue : geste en 0,42 s puis bras
    // tendu qui tient la chaîne) ; traction (durée inconnue) : il tire à deux mains vers lui, par à-coups, en boucle
    crochet: { preparation: ['crochet-visee', 0, 1, SEQ_V | SEQ_J], lancer: ['crochet-lancer', 0, 1, SEQ_V | SEQ_J, 0.42], traction: ['crochet-traction', 'cycle'] },
    // v1.5 (API.md §17.3) : intangibilité de la phase 5 : il s'efface (fondu de « disparition », sans la vrille de la téléportation),
    // puis resurgit (fondu de « reapparition », lames comprises)
    evanouissement: { fondu: ['disparition', 0, 1] },
    resurgissement: { apparition: ['reapparition', 0, 1] }
  };
  const LOCO = { aucune: 'flotte', levitation: 'flotte', ailes: 'flotte-ailes', rage: 'rage', affaibli: 'faible', traque: 'traque', mort: 'cadavre' };
  const RAGE_ACTIONS = { retour_rage: 1, arrachement: 1, onde_choc: 1 };
  const SANS_VOILE = { apparition: 1, teleport_depart: 1, teleport_arrivee: 1, defaite: 1, evanouissement: 1, resurgissement: 1 };
  // part de chaque étape dans l'avancement global des ailes / lames quand l'action les fait apparaître
  const AILES_ETAPES = { cambrure: [0, 0.35], deploiement: [0.35, 0.85], rugissement: [0.85, 1] };
  const DUREE_AILES_APPARITION = 2.1, DUREE_AILES_DISSIPATION = 1.2, DUREE_LAMES_FORMATION = 2.0, DUREE_LAMES_DESINTEGRATION = 2.0;
  const ETAT_AILES = { absentes: 'aucune', apparition: 'apparition', deployees: 'deployees', dissipation: 'disparition' };
  const ETAT_LAMES = { absentes: 'aucune', formation: 'formation', actives: 'actives', desintegration: 'destruction' };

  function creerSequenceur() {
    const E = {
      present: true, position: { x: 0, y: 0, z: 0 }, cap: 0, altitude: 0,
      action: 'flotte', u: null, tAction: 0, dureeAction: 1,
      main: 'droite', puissance: 0, rage: 0, faiblesse: 0, bouclier: 0,
      ailes: { etat: 'aucune', t: 1 }, lames: { etat: 'aucune', t: 1 },
      vitesse: { x: 0, y: 0, z: 0 }, regard: null, visee: null, pulseAme: 0
    };
    const visee = { x: 0, y: 0, z: 0 }, regard = { x: 0, y: 0, z: 0 };
    const st = { ailes: 'absentes', tAiles: 0, lames: 'absentes', tLames: 0, ames: -1, tAction: 0, idAction: null, etAction: null };
    return function traduire(vue, temps, dt, solY) {
      const a = vue.action || null;
      E.present = vue.present !== false && vue.visible !== false;
      const p = vue.position || E.position;
      E.position.x = p.x || 0; E.position.y = p.y || 0; E.position.z = p.z || 0;
      E.cap = vue.lacet || 0;
      // hauteur au-dessus du sol (seulement utile aux poses posées au sol)
      E.altitude = solY != null && Number.isFinite(solY) ? Math.max(0, E.position.y - solY) : 0;
      const v = vue.vitesse;
      E.vitesse.x = v ? v.x || 0 : 0; E.vitesse.y = v ? v.y || 0 : 0; E.vitesse.z = v ? v.z || 0 : 0;
      if (vue.regard) { regard.x = vue.regard.x; regard.y = vue.regard.y; regard.z = vue.regard.z; E.regard = regard; } else E.regard = null;
      // temps passé dans l'étape (si la vue ne le donne pas, on le mesure)
      const id = a ? a.id : null, et = a ? a.etape : null;
      if (id !== st.idAction || et !== st.etAction) { st.idAction = id; st.etAction = et; st.tAction = 0; } else st.tAction += dt;
      const tEt = a && a.t != null ? a.t : st.tAction;
      const dEt = a && a.duree > 0 ? a.duree : 1;
      const prog = a ? clamp(a.progression != null ? a.progression : tEt / dEt, 0, 1) : 0;
      // ---- clip et u
      const def = a && SEQ[a.id] ? SEQ[a.id][a.etape] : null;
      E.visee = null; E.u = null;
      if (def) {
        let clip = def[0];
        if (a.id === 'frappe' && a.etape === 'recuperation' && a.donnees && a.donnees.reussie === false) clip = 'frappe-ratee';
        if (a.id === 'teleport_arrivee' && (vue.lames === 'actives' || vue.lames === 'formation')) clip = 'reapparition';
        E.action = clip;
        if (def[1] === 'boucle') { E.tAction = temps; E.dureeAction = 0; }
        else if (def[1] === 'cycle') { E.tAction = tEt; E.dureeAction = 0; }
        else if (def[1] === 'extraction') { E.u = 0.36 + 0.46 * smooth(0, 1, Math.min(1, tEt / 1.4)); E.tAction = tEt; E.dureeAction = dEt; }
        else {
          const sansDuree = !(a.duree > 0) || !Number.isFinite(a.duree);
          const p = sansDuree && def[4] > 0 ? clamp(tEt / def[4], 0, 1) : prog;
          E.u = def[1] + (def[2] - def[1]) * p; E.tAction = tEt; E.dureeAction = sansDuree && def[4] > 0 ? def[4] : dEt;
        }
        const opt = def[3] || 0;
        if ((opt & SEQ_V) && a.cible) {
          visee.x = a.cible.x; visee.y = a.cible.y + ((opt & SEQ_J) && a.cibleJoueur != null ? 1.15 : 0); visee.z = a.cible.z;
          E.visee = visee;
        }
      } else {
        E.action = LOCO[vue.locomotion] || 'flotte';
        E.tAction = temps; E.dureeAction = 0;
      }
      // ---- couches
      E.puissance = clamp(vue.puissance || 0, 0, 1);
      if (vue.lames === 'actives') E.puissance = Math.max(E.puissance, 0.75);
      E.rage = vue.locomotion === 'rage' || (a && RAGE_ACTIONS[a.id]) ? 1 : 0;
      E.faiblesse = vue.locomotion === 'affaibli' || (a && a.id === 'faiblesse') ? 1 : clamp(vue.affaiblissement || 0, 0, 1) * 0.45;
      if (vue.locomotion === 'mort' || (a && a.id === 'defaite')) E.faiblesse = 0;
      E.bouclier = E.present && vue.vulnerable === false && !(a && SANS_VOILE[a.id]) && vue.locomotion !== 'mort' ? 0.32 : 0;
      // ---- âmes absorbées : une secousse de la poitrine à chaque nouvelle âme
      const ames = vue.ames | 0;
      E.pulseAme = st.ames >= 0 && ames > st.ames ? 1 : 0;
      st.ames = ames;
      // ---- ailes
      const ea = vue.ailes || 'absentes';
      if (ea !== st.ailes) { st.ailes = ea; st.tAiles = 0; } else st.tAiles += dt;
      E.ailes.etat = ETAT_AILES[ea] || 'aucune';
      if (ea === 'apparition') {
        const r = a && a.id === 'transformation_ailes' ? AILES_ETAPES[a.etape] : null;
        E.ailes.t = r ? r[0] + (r[1] - r[0]) * prog : clamp(st.tAiles / DUREE_AILES_APPARITION, 0, 1);
      } else if (ea === 'dissipation') E.ailes.t = clamp(st.tAiles / DUREE_AILES_DISSIPATION, 0, 1);
      else E.ailes.t = 1;
      // ---- lames
      const el = vue.lames || 'absentes';
      if (el !== st.lames) { st.lames = el; st.tLames = 0; } else st.tLames += dt;
      E.lames.etat = ETAT_LAMES[el] || 'aucune';
      if (el === 'formation') E.lames.t = a && a.id === 'transformation_lames' ? prog : clamp(st.tLames / DUREE_LAMES_FORMATION, 0, 1);
      else if (el === 'desintegration') E.lames.t = clamp(st.tLames / DUREE_LAMES_DESINTEGRATION, 0, 1);
      else E.lames.t = 1;
      return E;
    };
  }

  // ============================================================================================
  // API publique (boss/API.md §6, §16.6) : BossB7Modele.creer(THREE, options) →
  //   { object, update(dt, vue), reagir(dirX, dirZ, force), flash(couleur, intensite), points, hitboxes(), dispose(),
  //     couleurLames(nom) }
  // options : renderer, tete (données BOSS_B7_TETE ; un ancien module « BossTete » est aussi accepté), qualite
  // ('haute' | 'moyenne' | 'basse'), ombres (true), gouttes (true), solY (nombre ou fonction (x, z) → y : sol sous le
  // boss, pour les poses au sol et les gouttes de sang ; à défaut vue.sol, sinon la hauteur des pieds), couleursLineaires,
  // v2.2 : couleurLames ('rouge' par défaut | 'bleu' | 'vert'), allege (false ; instance légère pour les illusions).
  // ============================================================================================
  const VERSION = '2.3.0';   // 2.3 : actions evanouissement et resurgissement (v1.5 du combat) ; 2.2 : couleur des lames, crochet, allégé ; 2.1 : siphon

  function creer(THREE, options) {
    const O = Object.assign({ qualite: 'haute', ombres: true, renderer: null, tete: null, gouttes: true, solY: null, couleurLames: null, allege: false }, options || {});
    O.altitudeIncluse = true;                 // vue.position = pieds du modèle (pas d'altitude séparée)
    O.allege = !!O.allege;
    // allégé : sans ombres sauf demande explicite (ni projection, ni réception, ni matériaux de profondeur)
    if (O.allege && !(options && options.ombres != null)) O.ombres = false;
    const q = { haute: 1, moyenne: 0.72, basse: 0.5 }[O.qualite] || 1;
    const linear = O.couleursLineaires != null ? O.couleursLineaires : wantsLinear(THREE, O.renderer);
    const T = tableSquelette();
    const sk = makeSkeleton(THREE, T);
    const I = sk.index, W = sk.world, B = sk.byName;
    const U = {
      uTemps: { value: 0 }, uDissol: { value: 0 }, uDissolCoul: { value: new THREE.Color(1.0, 0.32, 0.06) },
      uPuis: { value: 0 }, uSceauCoul: { value: new THREE.Color(1.6, 0.28, 0.05) },
      uVeine: { value: 0 }, uVeineCoul: { value: new THREE.Color(1.4, 0.18, 0.04) },
      uDoublure: { value: new THREE.Color().fromArray(linear ? PAL.doublure.map(toLin) : PAL.doublure) },
      uFlotAmp: { value: 0.012 }, uFlash: { value: new THREE.Color(0, 0, 0) },
      uCicatrice: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3(0, -10, 0)) }
    };
    // tête : données du contrat BOSS_B7_TETE, ancien module (creer), ou tête de remplacement procédurale
    let teteMod = null;
    try {
      if (O.tete && O.tete.pos && O.tete.idx && O.tete.bbox) teteMod = creerTeteB7(THREE, O.tete, O, U, W.head, linear, I);
      else if (O.tete && typeof O.tete.creer === 'function') teteMod = O.tete.creer(THREE, { renderer: O.renderer, qualite: O.qualite, donnees: O.teteDonnees });
    } catch (err) {
      teteMod = null;
      if (typeof console !== 'undefined') console.warn('BossB7Modele : tête inutilisable, tête de remplacement', err);
    }
    // géométries du corps : construites une fois par configuration (densité, espace de couleur, tête, allègement) et
    // partagées par les instances identiques (illusions) ; chaque instance a ses matériaux, son squelette, ses maillages
    const cleCorps = ['corps', THREE.REVISION, q, linear ? 1 : 0, teteMod ? 'b7' : 'remplacement', O.allege ? 'allege' : 'complet'].join('|');
    const resCorps = prendreRessource(THREE, cleCorps, () => {
      const bd = new Builder(THREE, q);
      const Q = { sansCou: !!teteMod };
      construireCorps(bd, THREE, I, W, Q);
      construireManteau(bd, THREE, I, W, Q);
      construireEtole(bd, THREE, I, W, Q);
      construireMains(bd, THREE, I, W);
      if (!teteMod) construireTete(bd, THREE, I, W, Q);
      if (O.allege) {
        // allégé : pièces métalliques fondues dans le cuir, bandages dans le drap (mêmes couleurs de sommets) ; fioles de
        // la ceinture et gemme de la broche omises (avec la tête cuite, « yeux » ne contient que la gemme) → 13 maillages
        // du corps ramenés à 8, même silhouette
        bd.fusionner('cuir', 'metal'); bd.fusionner('tunique', 'bandage'); bd.retirer('verre'); bd.retirer('ame');
        if (teteMod) bd.retirer('yeux');
      }
      return { geos: bd.geometries(linear), cicatrice: Q.cicatrice || null, liberer: (e) => { for (const k in e.geos) e.geos[k].geo.dispose(); } };
    });
    const GEO = resCorps.valeur;
    if (GEO.cicatrice) GEO.cicatrice.forEach((p, i) => U.uCicatrice.value[i].set(p[0], p[1], p[2]));

    const MAT = materiauxCorps(THREE, U, { teteRemplacement: !teteMod });
    const meshes = {};
    for (const k in GEO.geos) meshes[k] = maillageSkinne(THREE, GEO.geos[k], MAT[k], k);
    const object = new THREE.Group();
    object.name = 'BossB7Modele';
    const corps = new THREE.Group();
    corps.name = 'boss-corps';
    corps.scale.setScalar(ECHELLE);
    object.add(corps);
    corps.add(sk.bones[0]);
    let trisCorps = 0;
    for (const k in meshes) {
      const m = meshes[k];
      m.castShadow = !!O.ombres && k !== 'yeux' && k !== 'bouche' && k !== 'verre' && k !== 'ame';
      if (k === 'verre') m.renderOrder = 3;
      m.receiveShadow = !!O.ombres;
      if (O.ombres) m.customDepthMaterial = depthBoss(THREE, MAT[k].userData.flags || {}, U, k);
      corps.add(m);
      trisCorps += m.geometry.index.count / 3;
    }
    object.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(sk.bones);
    for (const k in meshes) meshes[k].bind(skeleton);
    if (teteMod) {
      B.head.add(teteMod.objet);
      if (teteMod.peauSkinnee) { corps.add(teteMod.peauSkinnee); corps.updateMatrixWorld(true); teteMod.peauSkinnee.bind(skeleton); }
    }

    // ---------------------------------------------------------------- ancres (Object3D qui suivent les os)
    const ancres = {};
    const local = (bone, p) => { const w = W[bone]; return [p[0] - w[0], p[1] - w[1], p[2] - w[2]]; };
    const ancre = (nom, bone, p, z, y) => {
      const o = new THREE.Object3D(); o.name = 'ancre-' + nom;
      const l = local(bone, p); o.position.set(l[0], l[1], l[2]);
      if (z) {
        const Z = vnorm(z), Y0 = y ? vnorm(y) : [0, 1, 0], X = vnorm(vcross(Y0, Z)), Y = vcross(Z, X);
        o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2])));
      }
      B[bone].add(o); ancres[nom] = o; return o;
    };
    for (const [S, G, sx] of [['L', 'G', 1], ['R', 'D', -1]]) {
      const d = [ARM_DIR[0] * sx, ARM_DIR[1], 0], pl = sx > 0 ? PAUME_L : miroir(PAUME_L);
      ancre('main' + G, 'hand' + S, vadd(vadd(W['hand' + S], vscale(d, 0.055)), vscale(pl, 0.02)), pl, d);
      ancre('oeil' + G, 'oeil' + G, vadd(W['oeil' + G], [0, 0, 0.012]), [0, 0, 1]);
      ancre('pied' + G, 'foot' + S, vadd(W['foot' + S], [0, -0.075, 0.05]), [0, 0, 1]);
      const A = AILE.doigts[1], tip = sx > 0 ? A.tip : miroir(A.tip);
      ancre('aile' + G, 'aileD2b' + S, tip, sx > 0 ? A.dir : miroir(A.dir));
    }
    ancre('poitrine', 'chest', [0, 1.33, 0.135], [0, 0, 1]);
    ancre('dos', 'chest', [0, 1.3, -0.15], [0, 0, -1]);
    ancre('tete', 'head', [0, 1.68, 0.0], [0, 0, 1]);
    ancre('bouche', 'head', [0, 1.599, 0.086], [0, 0, 1]);
    if (teteMod && teteMod.ancres) for (const k of ['bouche', 'oeilG', 'oeilD']) {
      const a = teteMod.ancres[k];
      if (a && ancres[k]) { ancres[k].parent.remove(ancres[k]); ancres[k].position.set(0, 0, 0); ancres[k].quaternion.identity(); a.add(ancres[k]); }
    }
    // lames : garde (lameG/lameD) et pointe (pointeLameG/pointeLameD), placées par le module des lames
    for (const G of ['G', 'D']) {
      ancres['lame' + G] = new THREE.Object3D(); ancres['lame' + G].name = 'ancre-lame' + G;
      ancres['pointeLame' + G] = new THREE.Object3D(); ancres['pointeLame' + G].name = 'ancre-pointeLame' + G;
      ancres['main' + G].add(ancres['lame' + G]); ancres['main' + G].add(ancres['pointeLame' + G]);
    }

    // ---------------------------------------------------------------- zones de tir : sphères qui suivent les os
    const SPHERES = [
      ['tete', 'head', [0, 1.675, 0.008], 0.125],
      ['corps', 'chest', [0, 1.31, 0.0], 0.215], ['corps', 'spine', [0, 1.13, 0.01], 0.2], ['corps', 'hips', [0, 0.93, 0.0], 0.215],
      ['corps', 'thighL', [0.095, 0.70, 0.012], 0.13], ['corps', 'thighR', [-0.095, 0.70, 0.012], 0.13],
      ['corps', 'shinL', [0.1, 0.3, 0.0], 0.1], ['corps', 'shinR', [-0.1, 0.3, 0.0], 0.1]
    ];
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const ad = [ARM_DIR[0] * sx, ARM_DIR[1], 0], sh = [0.185 * sx, 1.418, -0.035];
      SPHERES.push(['corps', 'arm' + S, vadd(sh, vscale(ad, L_UPPER * 0.55)), 0.085]);
      SPHERES.push(['corps', 'fore' + S, vadd(vadd(sh, vscale(ad, L_UPPER)), vscale(ad, L_FORE * 0.5)), 0.075]);
    }
    const hitAncres = [], hitListe = [];
    for (const [zone, bone, p, r] of SPHERES) {
      const o = new THREE.Object3D(); o.name = 'hitbox-' + zone + '-' + bone;
      const l = local(bone, p); o.position.set(l[0], l[1], l[2]);
      B[bone].add(o);
      hitAncres.push({ o: o, r: r });
      hitListe.push({ zone: zone, type: 'sphere', centre: { x: 0, y: 0, z: 0 }, rayon: r * ECHELLE, os: bone });
    }

    // ---------------------------------------------------------------- ailes, lames, voile, aura
    // teinte : couleurs liées à la palette des lames de CETTE instance (dissolution et halo quand les lames sont là)
    const teinte = { nom: 'rouge', dissol: new THREE.Color(0.9, 0.02, 0.01), aura: new THREE.Color(0.8, 0.03, 0.02) };
    const ctxM = { THREE: THREE, B: B, I: I, W: W, objet: object, corps: corps, U: U, MAT: MAT, opts: O, q: q, linear: linear, skeleton: skeleton, ancres: ancres, teinte: teinte };
    // allégé : pas d'ailes (les illusions n'en ont jamais) ; leurs os sortent de l'arbre mis à jour à chaque image
    const ailes = O.allege ? null : creerAiles(THREE, ctxM);
    if (O.allege) for (const S of ['L', 'R']) { const r = B['aileRac' + S]; if (r && r.parent) r.parent.remove(r); }
    const lames = creerLames(THREE, ctxM);
    const voile = creerVoile(THREE, ctxM);
    const aura = creerAura(THREE, ctxM);

    const M = { B: B, W: W, objet: object, corps: corps, U: U, MAT: MAT, maillages: meshes, opts: O, tete: teteMod, ailes: ailes, lames: lames, voile: voile, aura: aura, machoireForcee: null, lueurForcee: null, teinte: teinte };
    const anim = creerAnimateur(THREE, M);
    const traduire = creerSequenceur();

    let tris = trisCorps, trisTete = 0;
    for (const x of [ailes, lames, voile, aura]) if (x && x.triangles) tris += x.triangles;
    if (teteMod) {
      teteMod.objet.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.index) trisTete += o.geometry.index.count / 3; });
      if (teteMod.peauSkinnee) trisTete += teteMod.peauSkinnee.geometry.index.count / 3;
      tris += trisTete;
    }

    const flashCoul = new THREE.Color(0, 0, 0), vTmp = new THREE.Vector3(), sTmp = new THREE.Vector3(), qTmp = new THREE.Quaternion();
    const st = { horloge: 0, flash: 0, pret: false, libere: false };
    const modele = {
      version: VERSION,
      object: object,
      points: {
        mainG: ancres.mainG, mainD: ancres.mainD, tete: ancres.tete, bouche: ancres.bouche, poitrine: ancres.poitrine, dos: ancres.dos,
        piedG: ancres.piedG, piedD: ancres.piedD, lameG: ancres.lameG, lameD: ancres.lameD, pointeLameG: ancres.pointeLameG, pointeLameD: ancres.pointeLameD,
        oeilG: ancres.oeilG, oeilD: ancres.oeilD, aileG: ancres.aileG, aileD: ancres.aileD
      },
      /** vue = combat.etat().boss (+ vue.temps, vue.sol facultatif) ; dt en secondes */
      update: function (dt, vue) {
        dt = clamp(+dt || 0, 0, 0.1);
        st.horloge += dt;
        if (!vue) { object.visible = false; return; }
        // couleur des lames : vue.couleurLames ('bleu' | 'rouge' | 'vert' ; null = rouge) ; clé absente : couleur inchangée
        if (vue.couleurLames !== undefined) lames.palette(vue.couleurLames);
        let solY = vue.sol;
        if (solY == null && O.solY != null) solY = typeof O.solY === 'function' ? O.solY(vue.position ? vue.position.x : 0, vue.position ? vue.position.z : 0) : O.solY;
        const E = traduire(vue, st.horloge, dt, solY);
        M.solCourant = solY;
        anim.appliquer(E, dt);
        if (st.flash > 0.001) {
          st.flash *= Math.exp(-dt / 0.085);
          U.uFlash.value.copy(flashCoul).multiplyScalar(st.flash);
        } else if (st.flash !== 0) { st.flash = 0; U.uFlash.value.setRGB(0, 0, 0); }
      },
      /** sursaut à l'impact : (dirX, dirZ) = direction de la balle dans le monde (du tireur vers le boss) */
      reagir: function (dirX, dirZ, force) { anim.sursaut(+dirX || 0, 0, +dirZ || 0, force == null ? 0.6 : +force); },
      /** éclair d'émission bref sur tout le corps (dégâts, immunité) */
      flash: function (couleur, intensite) {
        if (couleur == null) flashCoul.setRGB(1.0, 0.25, 0.08);
        else if (couleur.isColor) flashCoul.copy(couleur);
        else if (typeof couleur === 'object') flashCoul.setRGB(couleur.r || 0, couleur.g || 0, couleur.b || 0);
        else flashCoul.set(couleur);
        if (linear && !(THREE.ColorManagement && THREE.ColorManagement.enabled) && flashCoul.convertSRGBToLinear && !(couleur && couleur.isColor)) flashCoul.convertSRGBToLinear();
        st.flash = Math.max(st.flash, intensite == null ? 1 : Math.max(0, +intensite));
        U.uFlash.value.copy(flashCoul).multiplyScalar(st.flash);
      },
      /** zones de tir à jour (repère monde). Le tableau et ses objets sont réutilisés d'un appel à l'autre. */
      hitboxes: function () {
        object.getWorldScale(sTmp);
        const ech = sTmp.x * corps.scale.x;
        for (let i = 0; i < hitAncres.length; i++) {
          hitAncres[i].o.getWorldPosition(vTmp);
          const h = hitListe[i];
          h.centre.x = vTmp.x; h.centre.y = vTmp.y; h.centre.z = vTmp.z;
          h.rayon = hitAncres[i].r * ech;
        }
        return hitListe;
      },
      /** remet la simulation (manteau, particules, fondus) à zéro */
      reinitialiser: function () { anim.reinitialiser(); },
      /** couleur des lames : couleurLames('bleu' | 'rouge' | 'vert') la change aussitôt (null ou inconnu = 'rouge') et la
       *  renvoie ; couleurLames() sans argument renvoie la couleur courante. Uniformes et couleurs de matériau seulement. */
      couleurLames: function (nom) { return arguments.length ? lames.palette(nom) : lames.paletteCourante(); },
      allege: O.allege,
      /** promesse résolue quand les textures de la tête sont chargées */
      pret: teteMod && teteMod.pret ? teteMod.pret : Promise.resolve(),
      // accès avancés (outils, débogage)
      os: B, squelette: skeleton, maillages: meshes, materiaux: MAT, uniformes: U, tete: teteMod, ailes: ailes, lames: lames, voile: voile, aura: aura, animateur: anim,
      teteType: teteMod ? (O.tete && O.tete.pos ? 'BOSS_B7_TETE' : 'module') : 'remplacement',
      stats: { triangles: Math.round(tris), trianglesCorps: Math.round(trisCorps), trianglesTete: Math.round(trisTete), trianglesAiles: ailes ? ailes.triangles : 0, trianglesLames: lames ? lames.triangles : 0, os: sk.bones.length, appelsDessin: 0, allege: O.allege },
      dispose: function () {
        if (st.libere) return;
        st.libere = true;
        resCorps.rendre();   // géométries du corps : libérées avec la dernière instance qui les utilise
        for (const k in meshes) { if (meshes[k].customDepthMaterial) meshes[k].customDepthMaterial.dispose(); }
        for (const k in MAT) { const m = MAT[k]; if (m.map) m.map.dispose(); if (m.normalMap) m.normalMap.dispose(); m.dispose(); }
        for (const x of [ailes, lames, voile, aura]) if (x && x.dispose) x.dispose();
        if (teteMod && teteMod.dispose) teteMod.dispose();
        if (skeleton.boneTexture) skeleton.boneTexture.dispose();
        if (object.parent) object.parent.remove(object);
      }
    };
    let dc = 0;
    object.traverse((o) => { if (o.isMesh && o.material && o.material.visible !== false) dc++; });
    modele.stats.appelsDessin = dc;
    void qTmp;
    modele.update(0, { present: true, visible: true, position: { x: 0, y: 0, z: 0 }, lacet: 0, locomotion: 'levitation', action: null, ailes: 'absentes', lames: 'absentes' });
    modele.reinitialiser();
    return modele;
  }

  const api = { version: VERSION, creer: creer, actions: ACTIONS_API.slice(), locomotions: LOCOMOTIONS_API.slice(), clips: Object.keys(CLIPS) };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.BossB7Modele = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
