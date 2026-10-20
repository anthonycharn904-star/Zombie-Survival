/*
 * survivant.js — Anthony, personnage principal de Zombie Survival, pour Three.js, sans fichier externe.
 * Homme de 20-30 ans, rasé, 1,80 m, carrure et posture de combattant ; tenue « civil + récup » : veste de toile
 * déchirée (manche droite retroussée), t-shirt sali, jean troué, bottes, mitaines à coques, bandana, ceinturon
 * militaire avec porte-chargeurs, gourde, trousse, musette et couteau de combat. Cicatrices au visage.
 * Compatible Three.js r128 (artefacts Claude) et les versions récentes (testé r186). Tout est généré en code.
 *
 * Corps animé (troisième personne, coop, menus, ombre du joueur) :
 *   const hero = createSurvivor(THREE, { renderer });   // renderer : pour caler les couleurs (sRGB ou linéaire)
 *   scene.add(hero.object);                              // pieds en y = 0, regard vers +Z, gauche = +X
 *   // à chaque image :
 *   hero.update(dt, { speed, crouch, armed, aim, onGround, lookPitch, turn });
 *   //   speed m/s (marche ≈ 1,4, course ≈ 4,8), crouch/armed/aim/onGround booléens,
 *   //   lookPitch rad (+ = regarde en haut), turn rad/s (inclinaison en virage)
 *   hero.setWeapon(armeObject3D, ancreGardeMain);        // l'arme pointe vers +Z, poignée à l'origine
 *   hero.hit(dirX, dirZ, force); hero.die(); hero.revive(); hero.reset();
 *   hero.setFirstPerson(true);                          // vue FPS : corps invisible, ombre conservée
 *   hero.anchors : rightHand, leftHand, head, back, hip (Object3D où accrocher des objets)
 *
 * Bras en vue FPS (mêmes manches et mitaines) :
 *   const arms = createSurvivorArms(THREE, { renderer });
 *   camera.add(arms.object);                             // repère caméra (la caméra regarde vers -Z)
 *   arms.update(dt, { right: ancrePoignee, left: ancreGardeMain, gripRight: 'rifle', gripLeft: 'support' });
 *   //   ancres = Object3D posés sur l'arme : origine au centre de la prise, +Z vers l'avant de l'arme, +Y en haut
 *   //   prises : relaxed, rifle, support, pistol, fist, open ; une main sans ancre se range hors champ
 */
(function (root) {
  'use strict';

  // ============================================================================================
  // Outils communs : bruit, couleurs, constructeur de maillages skinnés (lofts + pièces rigides).
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
      // Catmull-Rom « centripète » simplifiée, bornée pour éviter les dépassements
      let v = 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const lo = Math.min(b, c), hi = Math.max(b, c), m = (hi - lo) * 0.35;
      out[k] = clamp(v, lo - m, hi + m);
    }
    return out;
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
  // Mélange entre deux os le long d'un membre : 0 → a, 1 → b
  const blend2 = (a, b, t) => [[a, 1 - t], [b, t]];

  function Builder(THREE) {
    this.THREE = THREE;
    this.G = {};
  }
  Builder.prototype.g = function (mat) {
    return this.G[mat] || (this.G[mat] = { p: [], n: [], c: [], si: [], sw: [], ix: [], uv: [] });
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
  // Périmètre approché d'un anneau (Ramanujan) : densité de texture homogène autour des lofts
  const ringPerim = (r) => {
    const a = (r.wL + r.wR) / 2, b = (r.dF + r.dB) / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) * (1 + 0.04 * (r.n - 2));
  };

  /**
   * Loft le long d'un axe droit a → b. Sections superellipse : demi-largeurs wL (côté +S) / wR,
   * demi-profondeurs dF (côté « front ») / dB, exposant n (2 = ellipse, 4 = carré arrondi), décalages ox/oz.
   * o.gap : demi-angle d'ouverture à l'avant (nombre ou fonction de s) pour une coque ouverte (veste).
   * o.hem1 / o.hem0 : déchirures des bords (fonction de l'angle → recul en m), o.hemDepth1/0 : recul maxi.
   * o.radius(s, ang, ring) : multiplicateur de rayon ; o.weights(s, ang, P) ; o.color(P, s, ang, ring).
   * o.rim0 / o.rim1 / o.rimGap : épaisseur (m) des bords libres (ourlets, bords de l'ouverture) ;
   * o.rimColor(c) : teinte de la tranche. UV : u = longueur autour (m), v = s (m).
   */
  Builder.prototype.loft = function (mat, o) {
    const g = this.g(mat), base = g.p.length / 3, ix0 = g.ix.length;
    const A = vnorm(vsub(o.b, o.a));
    let F = o.front || [0, 0, 1];
    F = vnorm(vsub(F, vscale(A, vdot(F, A))));
    const S = vcross(A, F);
    const R = prepRings(o.rings);
    const s0 = o.s0 != null ? o.s0 : R[0].s, s1 = o.s1 != null ? o.s1 : R[R.length - 1].s;
    const seg = o.seg || 16, open = o.gap != null;
    let sl = o.sList ? o.sList.filter((v) => v >= Math.min(s0, s1) - 1e-9 && v <= Math.max(s0, s1) + 1e-9) : null;
    if (sl && sl.length < 2) sl = null;
    const nr = sl ? sl.length : Math.max(2, Math.ceil(Math.abs(s1 - s0) / (o.step || 0.02)) + 1);
    let spacing = Math.abs(s1 - s0) / (nr - 1);
    if (sl) for (let i = 1; i < sl.length; i++) spacing = Math.min(spacing, Math.abs(sl[i] - sl[i - 1]));
    const warp = o.angWarp || 0;
    // couture (colonne dupliquée des UV) à l'arrière : ang = π pour u = 0
    const angAt = (u) => TAU * (u + 0.5) - warp * Math.sin(TAU * (u + 0.5));
    const K0 = o.hem0 ? Math.ceil((o.hemDepth0 || 0.03) / spacing) + 1 : 0;
    const K1 = o.hem1 ? Math.ceil((o.hemDepth1 || 0.03) / spacing) + 1 : 0;
    const cols = seg + 1;            // colonne de couture dupliquée (UV), normales recousues ensuite
    const radials = [];
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
      const ci = g.p.length / 3;
      g.p.push(cx / seg, cy / seg, cz / seg);
      g.uv.push(g.uv[first * 2], g.uv[first * 2 + 1]);
      const k0 = first * 3; g.c.push(g.c[k0], g.c[k0 + 1], g.c[k0 + 2]);
      for (let q = 0; q < 4; q++) { g.si.push(g.si[first * 4 + q]); g.sw.push(g.sw[first * 4 + q]); }
      for (let j = 0; j < seg; j++) {
        if ((sgn > 0) !== flip) g.ix.push(ci, first + j, first + j + 1); else g.ix.push(ci, first + j + 1, first + j);
      }
    };
    if (o.cap0) cap(0, -1);
    if (o.cap1) cap(nr - 1, 1);
    this._normals(g, base, ix0);
    // couture : mêmes normales des deux côtés (anneaux fermés)
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
        g.uv.push(g.uv[vi * 2] , g.uv[vi * 2 + 1] + th);
        const cc = rimCol([g.c[k], g.c[k + 1], g.c[k + 2]]);
        g.c.push(cc[0], cc[1], cc[2]);
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

  /** Pièce rigide (géométrie Three.js placée par une Matrix4), attachée à un os ou à une liste de poids.
   *  UV : projection plane selon l'axe dominant de la normale (densité en mètres, comme les lofts). */
  Builder.prototype.rigid = function (mat, geo, M, bone, color) {
    const THREE = this.THREE, g = this.g(mat), base = g.p.length / 3;
    const pos = geo.attributes.position, nrm = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(M);
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      nv.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      g.p.push(v.x, v.y, v.z);
      g.n.push(nv.x, nv.y, nv.z);
      const ax = Math.abs(nv.x), ay = Math.abs(nv.y), az = Math.abs(nv.z);
      if (ay >= ax && ay >= az) g.uv.push(v.x, v.z); else if (ax >= az) g.uv.push(v.z, v.y); else g.uv.push(v.x, v.y);
      const col = typeof color === 'function' ? color([v.x, v.y, v.z], [nv.x, nv.y, nv.z]) : color;
      g.c.push(col[0], col[1], col[2]);
      if (Array.isArray(bone)) packWeights(typeof bone[0] === 'number' ? [[bone[0], 1]] : bone, g.si, g.sw);
      else if (typeof bone === 'function') packWeights(bone([v.x, v.y, v.z]), g.si, g.sw);
      else { g.si.push(bone, 0, 0, 0); g.sw.push(1, 0, 0, 0); }
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) g.ix.push(base + geo.index.getX(i));
    else for (let i = 0; i < pos.count; i++) g.ix.push(base + i);
    geo.dispose();
  };

  /** Ruban (bretelle, sangle) le long d'une polyligne, épaisseur réelle, normales vers l'extérieur via « out ».
   *  UV : u à travers la largeur, v le long du ruban (m). */
  Builder.prototype.ribbon = function (mat, pts, width, thick, outFn, weightFn, color) {
    const wAt = typeof width === 'function' ? width : () => width;
    const tAt = typeof thick === 'function' ? thick : () => thick;
    const g = this.g(mat), base = g.p.length / 3, ix0 = g.ix.length;
    const n = pts.length;
    let along = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], t = vnorm(vsub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      if (i > 0) along += vlen(vsub(p, pts[i - 1]));
      const out = vnorm(outFn(p, i));
      const side = vnorm(vcross(t, out));
      const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]]; // (côté, extérieur)
      const wi = wAt(i / (n - 1)), th = tAt(i / (n - 1));
      for (const [a, b] of corners) {
        const P = vadd(p, vadd(vscale(side, a * wi / 2), vscale(out, b * th / 2 + th / 2)));
        g.p.push(P[0], P[1], P[2]);
        g.uv.push((a + 1) * wi / 2, along);
        const col = typeof color === 'function' ? color(P, i / (n - 1)) : color;
        g.c.push(col[0], col[1], col[2]);
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

  /** Assemble un SkinnedMesh par matériau, tous liés au même squelette. */
  Builder.prototype.build = function (materials, linear) {
    const THREE = this.THREE, out = {};
    for (const key in this.G) {
      const g = this.G[key];
      if (!g.ix.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(linear ? g.c.map(toLin) : g.c, 3));
      if (g.uv.length === g.p.length / 3 * 2) geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(g.si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(g.sw, 4));
      geo.setIndex(g.ix.length / 3 * 3 > 65535 || g.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(g.ix, 1) : new THREE.Uint16BufferAttribute(g.ix, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.SkinnedMesh(geo, materials[key]);
      mesh.name = key;
      mesh.frustumCulled = false; // les poses (chute, saut) sortent de la sphère de la pose de référence
      out[key] = mesh;
    }
    return out;
  };

  // Faut-il convertir les couleurs en linéaire ? Oui si le rendu encode la sortie en sRGB.
  function wantsLinear(THREE, renderer) {
    const rev = parseInt(THREE.REVISION, 10);
    if (renderer) {
      if ('outputColorSpace' in renderer) return renderer.outputColorSpace === (THREE.SRGBColorSpace || 'srgb');
      if ('outputEncoding' in renderer) return renderer.outputEncoding === THREE.sRGBEncoding;
    }
    return rev >= 152;
  }

  // Textures de détail en mosaïque (survivant-matieres.js) : partagées entre instances.
  const DETAIL_CACHE = {};
  function matieresData(opts) {
    if (opts && opts.matieres === false) return null;
    if (opts && opts.matieres) return opts.matieres;
    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
    return g.SURVIVANT_MATIERES || null;
  }
  function detailTexture(THREE, TD, key, kind, tile, renderer) {
    const ck = key + kind + tile.toFixed(4);
    if (DETAIL_CACHE[ck]) return DETAIL_CACHE[ck];
    const src = TD.mats[key][kind];
    const tex = typeof document !== 'undefined' ? new THREE.TextureLoader().load(src) : new THREE.Texture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / tile, 1 / tile);
    if ('colorSpace' in tex) tex.colorSpace = THREE.NoColorSpace || ''; else tex.encoding = THREE.LinearEncoding;
    tex.anisotropy = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
    DETAIL_CACHE[ck] = tex;
    return tex;
  }

  /** Matériaux PBR à couleurs de sommets (teinte, usure, taches) × texture de détail de la matière
   *  (trame du tissu, grain du cuir, pores de la peau) avec sa carte de normales. */
  function makeMaterials(THREE, defs, opts) {
    const rev = parseInt(THREE.REVISION, 10), out = {};
    const TD = opts ? matieresData(opts) : null;
    for (const k in defs) {
      const d = defs[k];
      const m = new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, roughness: d.r, metalness: d.m || 0,
        side: d.double ? THREE.DoubleSide : THREE.FrontSide, flatShading: !!d.flat
      });
      if (TD && d.tex && TD.mats[d.tex]) {
        const T = TD.mats[d.tex], tile = T.tile * (d.texScale || 1);
        m.map = detailTexture(THREE, TD, d.tex, 'd', tile, opts.renderer);
        m.roughnessMap = m.map;
        m.normalMap = detailTexture(THREE, TD, d.tex, 'n', tile, opts.renderer);
        const ns = d.ns != null ? d.ns : 1;
        m.normalScale.set(ns, ns);
        m.color.setScalar(1 / 0.8);                 // le détail est centré sur 0,8
        m.roughness = Math.min(1, d.r / 0.8);
      }
      if (d.sss && typeof skinShaderPatch === 'function') m.onBeforeCompile = skinShaderPatch(THREE);
      if (rev < 129) m.skinning = true; // Three.js r128 : obligatoire pour les SkinnedMesh
      m.name = k;
      out[k] = m;
    }
    return out;
  }

  // Squelette : table { nom: [parent, x, y, z] } en coordonnées monde de la pose de référence.
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

  // ============================================================================================
  // Corps du survivant : squelette, tenue « civil + récup », tête (voir head.js), animation (anim.js).
  // ============================================================================================
  const PAL = {
    skin: hexc(0xc08f75), skinShade: hexc(0x9a6c58), skinRed: hexc(0xbb7b68),
    lip: hexc(0xa66d61), brow: hexc(0x2c1f17), hair: hexc(0x2f2219), hairLight: hexc(0x4a3626),
    jacket: hexc(0x6c5a40), jacketDark: hexc(0x4b3d2a), jacketLight: hexc(0x857153), seam: hexc(0x3f3324),
    shirt: hexc(0xb4ad9d), shirtDark: hexc(0x8f8878),
    denim: hexc(0x3f546d), denimLight: hexc(0x667b93), denimDark: hexc(0x2d3c4f), thread: hexc(0xd9d4c6),
    mud: hexc(0x5c4a36), dust: hexc(0x9c8b70), blood: hexc(0x6e1f17), bloodDry: hexc(0x4a1a14),
    olive: hexc(0x5a5a3a), oliveDark: hexc(0x45452c), khaki: hexc(0x857a58), khakiDark: hexc(0x665c40),
    leather: hexc(0x3c2a1e), leatherLight: hexc(0x56402e), sole: hexc(0x1f1c1a), glove: hexc(0x2a2522),
    brass: hexc(0xa08348), steel: hexc(0x8a8a84), alu: hexc(0xa3a39b),
    bandage: hexc(0xd6ccb8), bandana: hexc(0x7c2a22), bandanaLight: hexc(0x9a3a2e),
    eyeWhite: hexc(0xe6ddd0), iris: hexc(0x6c8290), pupil: hexc(0x111111)
  };

  // Pose de référence : debout, bras écartés de 20°, regard vers +Z. Taille 1,80 m.
  const ARM_ANGLE = 20 * Math.PI / 180;
  const ARM_DIR = [Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0];
  const L_UPPER = 0.29, L_FORE = 0.255, L_PALM = 0.088, L_FING = 0.095;
  function skeletonTable() {
    const T = {
      root: [null, 0, 0, 0],
      hips: ['root', 0, 0.985, 0],
      spine: ['hips', 0, 1.10, -0.012],
      chest: ['spine', 0, 1.27, -0.02],
      neck: ['chest', 0, 1.478, -0.035],
      head: ['neck', 0, 1.588, -0.012],
      oeilG: ['head', 0.0315, 1.6672, 0.0655],
      oeilD: ['head', -0.0315, 1.6672, 0.0655]
    };
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const sh = [0.185 * sx, 1.418, -0.035];
      const el = vadd(sh, vscale([ARM_DIR[0] * sx, ARM_DIR[1], 0], L_UPPER));
      const wr = vadd(el, vscale([ARM_DIR[0] * sx, ARM_DIR[1], 0], L_FORE));
      const kn = vadd(wr, vscale([ARM_DIR[0] * sx, ARM_DIR[1], 0], L_PALM));
      const f2 = vadd(kn, vscale([ARM_DIR[0] * sx, ARM_DIR[1], 0], 0.045));
      const tb = vadd(wr, [ARM_DIR[0] * sx * 0.022 - 0.012 * sx, ARM_DIR[1] * 0.022, 0.026]);
      const t2 = vadd(tb, vscale(thumbDir(sx), 0.032));
      T['clav' + S] = ['chest', 0.03 * sx, 1.428, 0.005];
      T['arm' + S] = ['clav' + S, sh[0], sh[1], sh[2]];
      T['fore' + S] = ['arm' + S, el[0], el[1], el[2]];
      T['hand' + S] = ['fore' + S, wr[0], wr[1], wr[2]];
      T['fing' + S] = ['hand' + S, kn[0], kn[1], kn[2]];
      T['fing2' + S] = ['fing' + S, f2[0], f2[1], f2[2]];
      T['thumb' + S] = ['hand' + S, tb[0], tb[1], tb[2]];
      T['thumb2' + S] = ['thumb' + S, t2[0], t2[1], t2[2]];
      T['thigh' + S] = ['hips', 0.092 * sx, 0.925, 0.0];
      T['shin' + S] = ['thigh' + S, 0.098 * sx, 0.505, 0.012];
      T['foot' + S] = ['shin' + S, 0.104 * sx, 0.088, -0.022];
      T['toes' + S] = ['foot' + S, 0.11 * sx, 0.022, 0.12];
    }
    return T;
  }
  function thumbDir(sx) { return vnorm([ARM_DIR[0] * sx * 0.55 - 0.28 * sx, ARM_DIR[1] * 0.55, 0.62]); }

  // Taches réparties sur le corps : [x, y, z, rayon, type] ; type 0 = sang, 1 = boue, 2 = poussière claire
  const STAINS = [
    [-0.09, 1.30, 0.15, 0.035, 0], [-0.06, 1.24, 0.15, 0.02, 0], [-0.12, 1.20, 0.13, 0.015, 0],
    [0.16, 1.12, 0.10, 0.03, 1], [-0.17, 1.38, -0.09, 0.05, 2], [0.05, 1.32, -0.13, 0.06, 2],
    [-0.30, 1.05, 0.0, 0.03, 0], [0.12, 0.70, 0.08, 0.025, 0], [-0.12, 0.62, 0.07, 0.04, 1],
    [0.11, 0.30, 0.06, 0.05, 1], [-0.10, 0.25, -0.05, 0.06, 1], [0.05, 1.12, 0.13, 0.02, 0]
  ];
  function stainAt(P, kinds) {
    let best = null, bw = 0;
    for (const s of STAINS) {
      if (kinds.indexOf(s[4]) < 0) continue;
      const d = Math.hypot(P[0] - s[0], P[1] - s[1], P[2] - s[2]);
      const edge = s[3] * (0.75 + 0.5 * vnoise(P[0] * 90, P[1] * 90, P[2] * 90, 7));
      const w = 1 - smooth(edge * 0.6, edge, d);
      if (w > bw) { bw = w; best = s[4]; }
    }
    return [best, bw];
  }
  function applyStains(c, P, kinds, strength) {
    const [kind, w] = stainAt(P, kinds);
    if (!w) return c;
    const target = kind === 0 ? mixc(PAL.bloodDry, hexc(0x2e1a14), 0.3 + 0.4 * vnoise(P[0] * 60, P[1] * 60, P[2] * 60, 3)) : kind === 1 ? PAL.mud : PAL.dust;
    return mixc(c, target, w * (strength == null ? 0.85 : strength) * (kind === 0 ? 0.7 : 1));
  }

  function createSurvivor(THREE, options) {
    const O = Object.assign({ shadows: true, renderer: null }, options || {});
    const linear = O.linearColors != null ? O.linearColors : wantsLinear(THREE, O.renderer);
    const SKT = skeletonTable();
    const sk = makeSkeleton(THREE, SKT);
    const I = sk.index, W = sk.world;
    const bd = new Builder(THREE);

    // ---------------------------------------------------------------- tronc : t-shirt (sous la veste)
    const torsoAxis = { a: [0, 0.95, 0], b: [0, 1.6, 0] };
    const torsoWeights = (y, x, extraHeadNeck) => {
      const tHS = smooth(1.0, 1.13, y), tSC = smooth(1.17, 1.31, y), tCN = smooth(1.455, 1.50, y);
      const wh = 1 - tHS, ws = tHS * (1 - tSC), wc = tSC * (1 - tCN), wn = tCN;
      const cl = smooth(0.07, 0.16, Math.abs(x)) * smooth(1.33, 1.42, y) * 0.75;
      const clav = x >= 0 ? I.clavL : I.clavR;
      return [[I.hips, wh], [I.spine, ws], [I.chest, wc * (1 - cl)], [clav, wc * cl], [I.neck, wn]];
    };
    bd.loft('tshirt', {
      a: torsoAxis.a, b: torsoAxis.b, seg: 36, step: 0.02,
      rings: [
        { s: 0.03, w: 0.162, dF: 0.1, dB: 0.104, n: 2.3 },
        { s: 0.10, w: 0.153, dF: 0.098, dB: 0.098, n: 2.3 },
        { s: 0.17, w: 0.156, dF: 0.103, dB: 0.098, n: 2.3 },
        { s: 0.25, w: 0.168, dF: 0.118, dB: 0.106, n: 2.35 },
        { s: 0.33, w: 0.181, dF: 0.132, dB: 0.112, n: 2.45, oz: 0.006 },
        { s: 0.40, w: 0.179, dF: 0.124, dB: 0.114, n: 2.45 },
        { s: 0.46, w: 0.164, dF: 0.096, dB: 0.1, n: 2.35, oz: -0.01 },
        { s: 0.50, w: 0.122, dF: 0.075, dB: 0.081, n: 2.3, oz: -0.016 },
        { s: 0.528, w: 0.084, dF: 0.068, dB: 0.075, n: 2.1, oz: -0.023 },
        { s: 0.556, w: 0.066, dF: 0.062, dB: 0.067, n: 2.0, oz: -0.027 }
      ],
      displace: (P, s, ang, r, radial) => radialD(radial, 0.0028 * Math.sin(ang * 11 + s * 20) * gauss(s, 0.2, 0.08) * gauss(wrapPi(ang), 0, 0.5) +
        ripple(s, ang, 0.06, 0.03, 0.02, 0.0025, 0, 3.5)),
      weights: (s, ang, P) => torsoWeights(P[1], P[0]),
      color: (P) => {
        let c = mixc(PAL.shirt, PAL.shirtDark, fbm(P[0] * 14, P[1] * 14, P[2] * 14, 11) * 0.8);
        c = applyStains(c, P, [0], 0.9);
        return c;
      }
    });

    // ---------------------------------------------------------------- veste de toile ouverte
    const jacketGap = (s) => { const y = 0.95 + s; return y < 1.25 ? lerp(0.40, 0.27, smooth(1.05, 1.25, y)) : lerp(0.27, 0.95, smooth(1.33, 1.52, y)); };
    const jacketHem = (ang) => {
      // ourlet effiloché par endroits, déchirure franche côté droit
      const a = wrapPi(ang);
      const rip = gauss(a, -2.2, 0.16) * 0.045 + gauss(a, 1.3, 0.1) * 0.02;
      return Math.max(0, (vnoise(ang * 9, 3, 1, 5) - 0.55) * 0.03) + rip;
    };
    const jacketColor = (P, s, ang) => {
      const y = P[1];
      let c = mixc(PAL.jacket, PAL.jacketLight, fbm(P[0] * 9, P[1] * 9, P[2] * 9, 21) * 0.7);
      c = mixc(c, PAL.jacketDark, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 23) * 0.35);
      // coutures : empiècement d'épaule, côtés, dos
      const a = wrapPi(ang);
      const seam = Math.max(gauss(y, 1.40, 0.004), gauss(Math.abs(a), Math.PI / 2 + 0.05, 0.02), gauss(Math.abs(a), Math.PI, 0.012) * smooth(1.2, 1.25, y));
      c = mixc(c, PAL.seam, seam * 0.28);
      // ourlet sali, bords de l'ouverture usés
      c = mixc(c, PAL.mud, smooth(1.12, 1.05, y) * 0.35);
      const edge = gauss(Math.abs(a), jacketGap(s) + 0.01, 0.03);
      c = mixc(c, PAL.jacketLight, edge * 0.5);
      return applyStains(c, P, [0, 1, 2], 0.8);
    };
    // plis de la veste : tassement au-dessus du ceinturon, tension sous les bras, drapé du dos ; coutures
    const jacketFolds = (P, s, ang, r, radial) => {
      const y = 0.95 + s, a = wrapPi(ang);
      let d = ripple(s, ang + 0.4, 0.13, 0.035, 0.026, 0.0045, Math.PI, 2.2);
      d += diagFold(s, a, 0.34, Math.PI / 2, 2.5, 0.03, 0.004, 0.05, 0.45) + diagFold(s, a, 0.34, -Math.PI / 2, -2.5, 0.03, 0.004, 0.05, 0.45);
      d += 0.0035 * Math.sin(ang * 9 + 1.3) * gauss(a, Math.PI, 0.5) * gauss(y, 1.2, 0.07);
      d += 0.003 * Math.sin(s * 140 + ang * 2) * gauss(Math.abs(a), jacketGap(s) + 0.12, 0.1) * smooth(1.1, 1.3, y);
      d += seamAt(ang, Math.PI / 2 + 0.05, 0.0012) + seamAt(ang, -Math.PI / 2 - 0.05, 0.0012) + seamAt(ang, Math.PI, 0.001) * smooth(1.2, 1.26, y);
      d -= 0.0012 * gauss(y, 1.405, 0.004);                  // couture de l'empiècement d'épaule
      return radialD(radial, d);
    };
    bd.loft('veste', {
      a: torsoAxis.a, b: torsoAxis.b, seg: 48, step: 0.014, gap: jacketGap,
      rings: JACKET_RINGS, displace: jacketFolds, rim0: 0.005, rimGap: 0.005,
      hem0: jacketHem, hemDepth0: 0.05,
      weights: (s, ang, P) => torsoWeights(P[1], P[0]),
      color: jacketColor
    });
    // col rabattu
    bd.loft('veste', {
      a: [0, 1.462, -0.026], b: [0, 1.53, -0.026], seg: 40, step: 0.008, gap: 0.6, rim1: 0.004, rimGap: 0.004,
      rings: [{ s: 0.0, w: 0.098, dF: 0.08, dB: 0.09, n: 2.2 }, { s: 0.02, w: 0.093, dF: 0.076, dB: 0.087, n: 2.2 }, { s: 0.038, w: 0.099, dF: 0.081, dB: 0.092, n: 2.2 },
        { s: 0.053, w: 0.117, dF: 0.092, dB: 0.106, n: 2.2 }, { s: 0.066, w: 0.134, dF: 0.101, dB: 0.118, n: 2.2 }],
      displace: (P, s, ang, r, radial) => radialD(radial, 0.003 * Math.sin(ang * 5 + 0.7) * smooth(0.03, 0.066, s)),
      weights: (s, ang, P) => torsoWeights(P[1] - 0.03, P[0]),
      color: (P, s, ang) => mixc(jacketColor(P, s, ang), PAL.jacketDark, 0.25 + 0.4 * smooth(0.04, 0.06, s))
    });

    // ---------------------------------------------------------------- jean : bassin + jambes
    const jeansColor = (P, s, ang, legSide) => {
      const y = P[1];
      let c = mixc(PAL.denim, PAL.denimDark, fbm(P[0] * 25, P[1] * 60, P[2] * 25, 31) * 0.6);
      // usure claire : haut des cuisses, genoux
      const front = Math.max(0, Math.cos(ang));
      c = mixc(c, PAL.denimLight, front * (gauss(y, 0.78, 0.07) * 0.45 + gauss(y, 0.5, 0.05) * 0.4));
      // trame verticale
      c = mulc(c, 0.94 + 0.08 * vnoise(ang * 40, y * 300, 1, 33));
      // boue en bas
      c = mixc(c, PAL.mud, smooth(0.42, 0.12, y) * (0.35 + 0.4 * fbm(P[0] * 20, y * 20, P[2] * 20, 35)));
      return applyStains(c, P, [0, 1], 0.85);
    };
    bd.loft('jean', {
      a: [0, 0.80, -0.008], b: [0, 1.1, -0.008], seg: 36, step: 0.02,
      rings: [
        { s: 0.03, w: 0.128, dF: 0.07, dB: 0.08, n: 2.4 },
        { s: 0.08, w: 0.162, dF: 0.094, dB: 0.113, n: 2.4 },
        { s: 0.14, w: 0.172, dF: 0.1, dB: 0.118, n: 2.4 },
        { s: 0.20, w: 0.167, dF: 0.104, dB: 0.106, n: 2.4 },
        { s: 0.245, w: 0.160, dF: 0.103, dB: 0.101, n: 2.4 }
      ],
      weights: (s, ang, P) => {
        const sideB = P[0] >= 0 ? I.thighL : I.thighR;
        const low = smooth(0.92, 0.84, P[1]) * smooth(0.04, 0.12, Math.abs(P[0])) * 0.6;
        return [[I.hips, 1 - low], [sideB, low]];
      },
      color: (P, s, ang) => {
        let c = jeansColor(P, s, ang);
        c = mixc(c, PAL.denimDark, smooth(0.22, 0.245, s) * 0.5); // ceinture du jean
        return c;
      }
    });
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const hipP = [0.092, 1.0, 0.0], ank = W.footL;
      const legLen = vlen(vsub(ank, hipP));
      const kneeS = vlen(vsub(W.shinL, hipP));
      // déchirures : genou gauche, cuisse droite
      const hole = (s, ang) => {
        if (S === 'L') return gauss(s, kneeS - 0.005, 0.03) * gauss(wrapPi(ang), 0.05, 0.42);
        return gauss(s, 0.25, 0.022) * gauss(wrapPi(ang), -0.45, 0.3);
      };
      bd.loft('jean', {
        a: hipP, b: ank, mirror: sx < 0, seg: 28, step: 0.018,
        rings: [
          { s: 0.0, wL: 0.088, wR: 0.106, dF: 0.094, dB: 0.109, n: 2.3 },
          { s: 0.12, wL: 0.082, wR: 0.098, dF: 0.09, dB: 0.097, n: 2.2, ox: -0.004 },
          { s: 0.25, wL: 0.072, wR: 0.087, dF: 0.083, dB: 0.085, n: 2.2 },
          { s: 0.40, wL: 0.06, wR: 0.07, dF: 0.068, dB: 0.066 },
          { s: kneeS - 0.01, w: 0.058, dF: 0.066, dB: 0.06 },
          { s: 0.56, w: 0.055, dF: 0.058, dB: 0.064 },
          { s: 0.66, w: 0.056, dF: 0.056, dB: 0.068 },
          { s: 0.78, w: 0.053, dF: 0.053, dB: 0.058 },
          { s: 0.86, w: 0.058, dF: 0.062, dB: 0.062 },
          { s: 0.885, w: 0.061, dF: 0.067, dB: 0.066 }
        ],
        displace: (P, s, ang, r, radial) => {
          const h = hole(s, ang), a = wrapPi(ang);
          let d = ripple(s, ang, kneeS + 0.035, 0.035, 0.024, 0.003, 0, 0.9);                    // genou
          d += ripple(s, ang, kneeS - 0.012, 0.028, 0.017, 0.0042, Math.PI, 0.7, 0.8);           // nid d'abeille
          d += ripple(s, ang, 0.835, 0.04, 0.021, 0.0055, 0, 3.5) + 0.003 * Math.sin(ang * 3 + s * 40) * gauss(s, 0.85, 0.03); // tassement
          d += diagFold(s, a, 0.1, 0.55, 3.0, 0.024, 0.0026, 0.035, 0.45);                       // moustaches de l'entrejambe
          d += seamAt(ang, Math.PI / 2, 0.0009) + seamAt(ang, -Math.PI / 2, 0.0013);           // entrejambe, couture latérale
          d -= 0.004 * smooth(0.45, 0.8, h);
          return radialD(radial, d);
        },
        hem1: (ang) => Math.max(0, (vnoise(ang * 19, 1, 2, 41 + sx) - 0.45) * 0.008), hemDepth1: 0.008, rim1: 0.003,
        weights: (s, ang, P) => {
          const t1 = smooth(0.0, 0.16, s), t2 = smooth(kneeS - 0.05, kneeS + 0.05, s), t3 = smooth(0.82, 0.9, s) * 0.4;
          return [[I.hips, 1 - t1], [I['thigh' + S], t1 * (1 - t2)], [I['shin' + S], t2 * (1 - t3)], [I['foot' + S], t2 * t3]];
        },
        color: (P, s, ang) => {
          let c = jeansColor(P, s, ang);
          const h = hole(s, ang);
          if (h > 0.15) {
            const rimT = smooth(0.15, 0.45, h) * smooth(0.8, 0.55, h);
            const inside = smooth(0.55, 0.8, h);
            c = mixc(c, PAL.thread, rimT * 0.75);
            c = mixc(c, mulc(mixc(PAL.skin, PAL.skinShade, 0.5), 0.55), inside);
            c = mixc(c, mulc(PAL.thread, 0.9), inside * (Math.sin(s * 700) > 0.2 ? 0.7 : 0));
          }
          return c;
        }
      });

      // ------------------------------------------------------------ bottes de cuir
      const fx = 0.104;          // côté gauche ; le droit vient par symétrie (mirror)
      const fxs = 0.104 * sx;    // pièces non symétrisées
      const footW = (s) => { const t = smooth(0.19, 0.25, s); return [[I['foot' + S], 1 - t], [I['toes' + S], t]]; };
      // semelle crantée en caoutchouc (fond plat, talon plus haut, trépointe débordante)
      bd.loft('cuir', {
        a: [fx, 0.016, -0.093], b: [fx, 0.016, 0.226], front: [0, 1, 0], mirror: sx < 0, seg: 32, step: 0.008,
        rings: [
          { s: 0.0, w: 0.024, dF: 0.019, dB: 0.016, n: 3.2 }, { s: 0.02, w: 0.039, dF: 0.021, dB: 0.016, n: 3.6 },
          { s: 0.085, w: 0.043, dF: 0.02, dB: 0.016, n: 3.6 }, { s: 0.105, w: 0.041, dF: 0.012, dB: 0.016, n: 3.6 },
          { s: 0.14, wL: 0.038, wR: 0.044, dF: 0.011, dB: 0.016, n: 3.6 }, { s: 0.2, wL: 0.053, wR: 0.056, dF: 0.011, dB: 0.016, n: 3.6 },
          { s: 0.262, w: 0.05, dF: 0.011, dB: 0.016, n: 3.4 }, { s: 0.3, w: 0.039, dF: 0.011, dB: 0.016, n: 3 }, { s: 0.319, w: 0.018, dF: 0.009, dB: 0.014, n: 2.4 }
        ],
        cap0: true, cap1: true,
        // crampons sur la tranche, rainure de la trépointe
        displace: (P, s, ang, r, radial) => {
          const side = gauss(Math.cos(ang), -0.2, 0.35);
          return radialD(radial, -0.0016 * side * (Math.sin(s * 520) > 0.35 ? 1 : 0) * smooth(0.0, 0.02, s) - 0.0008 * gauss(Math.cos(ang), 0.55, 0.06));
        },
        weights: footW,
        color: (P, s, ang) => {
          let c = mixc(PAL.sole, hexc(0x3a332c), fbm(P[0] * 60, P[1] * 60, P[2] * 60, 55) * 0.4);
          c = mixc(c, PAL.mud, smooth(0.45, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 57)) * 0.55);
          return mixc(c, PAL.dust, smooth(0.3, -0.6, Math.cos(ang)) * 0.15);
        }
      });
      // empeigne : contrefort du talon, cou-de-pied, bout renforcé, plis de marche
      const bootColor = (P, s, ang) => {
        let c = mixc(PAL.leather, PAL.leatherLight, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 51) * 0.55);
        c = mixc(c, PAL.dust, smooth(0.35, 0.85, fbm(P[0] * 15, P[1] * 15, P[2] * 15, 53)) * 0.4 + smooth(0.07, 0.03, P[1]) * 0.25);
        c = mixc(c, hexc(0x8c7a64), gauss(s, 0.27, 0.02) * smooth(0.2, 0.9, Math.cos(ang)) * 0.35);       // bout éraflé
        c = mixc(c, mulc(PAL.leather, 0.6), gauss(s, 0.235, 0.004) * smooth(-0.1, 0.4, Math.cos(ang)) * 0.6); // couture du bout
        return c;
      };
      bd.loft('cuir', {
        a: [fx, 0.06, -0.09], b: [fx, 0.06, 0.222], front: [0, 1, 0], mirror: sx < 0, seg: 32, step: 0.008,
        rings: [
          { s: 0.0, w: 0.022, dF: 0.04, dB: 0.026, n: 2.6 }, { s: 0.025, w: 0.038, dF: 0.055, dB: 0.026, n: 2.8 },
          { s: 0.07, w: 0.043, dF: 0.062, dB: 0.03, n: 2.8 }, { s: 0.13, wL: 0.042, wR: 0.046, dF: 0.064, dB: 0.034, n: 2.8 },
          { s: 0.19, wL: 0.048, wR: 0.05, dF: 0.04, dB: 0.034, n: 2.9 }, { s: 0.24, w: 0.046, dF: 0.029, dB: 0.034, n: 2.9 },
          { s: 0.285, w: 0.037, dF: 0.023, dB: 0.033, n: 2.7 }, { s: 0.305, w: 0.021, dF: 0.015, dB: 0.03, n: 2.3 }
        ],
        cap0: true, cap1: true,
        displace: (P, s, ang, r, radial) => {
          const top = smooth(-0.1, 0.6, Math.cos(ang));
          let d = 0.0022 * top * smooth(0.235, 0.25, s) * smooth(0.305, 0.28, s);           // bout renforcé
          d -= 0.001 * gauss(s, 0.236, 0.003) * smooth(-0.2, 0.3, Math.cos(ang));
          d += ripple(s, ang, 0.2, 0.014, 0.008, 0.0018, 0, 0.9);                         // plis de flexion
          d -= 0.0009 * gauss(s, 0.05, 0.003) * gauss(Math.abs(Math.cos(ang)), 0.2, 0.3);  // couture du contrefort
          return radialD(radial, d);
        },
        weights: footW,
        color: bootColor
      });
      // tige : col rembourré, languette, œillets et laçage croisé (le bas reste visible sous le jean)
      bd.loft('cuir', {
        a: [fxs, 0.068, -0.03], b: [fxs, 0.155, -0.027], seg: 28, step: 0.01, rim1: 0.004,
        rings: [{ s: 0.0, w: 0.046, dF: 0.038, dB: 0.05 }, { s: 0.04, w: 0.043, dF: 0.04, dB: 0.047 }, { s: 0.07, w: 0.043, dF: 0.044, dB: 0.046 }, { s: 0.087, w: 0.046, dF: 0.048, dB: 0.049 }],
        displace: (P, s, ang, r, radial) => radialD(radial, 0.0015 * gauss(s, 0.083, 0.008)),
        weights: (s) => { const t = smooth(0.04, 0.1, s); return [[I['foot' + S], 1 - t], [I['shin' + S], t]]; },
        color: (P, s) => mixc(bootColor(P, 0.1, 0), PAL.leather, 0.3 + 0.3 * smooth(0.07, 0.087, s))
      });
      // laçage sur le cou-de-pied : hauteur de la surface supérieure de l'empeigne à la profondeur z
      const instepTop = (z, xo) => {
        const sv = z + 0.09;
        const dF = sv < 0.07 ? lerp(0.055, 0.062, smooth(0.025, 0.07, sv)) : sv < 0.13 ? lerp(0.062, 0.064, (sv - 0.07) / 0.06) : lerp(0.064, 0.04, smooth(0.13, 0.19, sv));
        return 0.06 + dF * Math.pow(1 - Math.pow(Math.abs(xo) / 0.045, 2.8), 1 / 2.8);
      };
      const lw = (P) => footW(P[2] + 0.09);
      const eyelets = [];
      for (let k = 0; k < 5; k++) {
        const z = -0.014 + k * 0.019;
        for (const e of [1, -1]) {
          const xo = e * (0.0135 - k * 0.0006), p = [fxs + xo, instepTop(z, xo) + 0.0012, z];
          eyelets.push(p);
          bd.rigid('metal', new THREE.TorusGeometry(0.0028, 0.001, 5, 10), new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.5).setPosition(p[0], p[1], p[2]), lw, PAL.brass);
        }
      }
      // languette
      const tg = [];
      for (let k = 0; k <= 6; k++) { const z = -0.024 + k * 0.016; tg.push([fxs, instepTop(z, 0) + 0.0018, z]); }
      bd.ribbon('cuir', tg, 0.02, 0.0025, () => [0, 1, 0.3], lw, mulc(PAL.leather, 0.85));
      for (let k = 0; k < 4; k++) {
        for (const e of [0, 1]) {
          const a = eyelets[k * 2 + e], b = eyelets[(k + 1) * 2 + (1 - e)];
          const mid = vadd(vlerp(a, b, 0.5), [0, 0.0045, 0]);
          bd.ribbon('sangle', [vadd(a, [0, 0.0015, 0]), mid, vadd(b, [0, 0.0015, 0])], 0.0034, 0.0016, () => [0, 1, 0.2], lw, hexc(0x4a3a2b));
        }
      }
    }

    // ---------------------------------------------------------------- manches, avant-bras, mains
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const sh = [0.185, 1.418, -0.035];            // épaule gauche ; le côté droit est obtenu par miroir
      const wr = W.handL;
      const armEnd = vadd(sh, vscale(ARM_DIR, 0.62));
      const elbowS = L_UPPER, wristS = L_UPPER + L_FORE;
      const torn = S === 'L';                         // manche gauche arrachée, manche droite retroussée au coude
      const sleeveEnd = torn ? 0.37 : elbowS + 0.026;
      const armW = (s) => {
        const t0 = smooth(-0.05, 0.07, s), t1 = smooth(elbowS - 0.05, elbowS + 0.05, s), t2 = smooth(wristS - 0.03, wristS + 0.03, s);
        return [[I['clav' + S], 1 - t0], [I['arm' + S], t0 * (1 - t1)], [I['fore' + S], t1 * (1 - t2)], [I['hand' + S], t2]];
      };
      bd.loft('veste', {
        a: sh, b: armEnd, mirror: sx < 0, seg: 32, step: 0.011, s0: -0.01, s1: sleeveEnd, rim1: torn ? 0.0025 : 0.004,
        rings: [
          { s: -0.01, wL: 0.056, wR: 0.032, d: 0.058 }, { s: 0.03, wL: 0.057, wR: 0.046, d: 0.062 }, { s: 0.07, wL: 0.057, wR: 0.058, d: 0.063 }, { s: 0.11, wL: 0.056, wR: 0.061, d: 0.061 },
          { s: 0.15, w: 0.057, dF: 0.061, dB: 0.057 }, { s: 0.24, w: 0.054, d: 0.055 }, { s: elbowS, w: 0.053, d: 0.054 },
          { s: 0.36, w: 0.051, d: 0.05 }, { s: 0.48, w: 0.047, d: 0.044 }, { s: wristS - 0.02, w: 0.046, d: 0.043 }
        ],
        // plis : pli du coude (face interne, vers l'avant), tassement à l'aisselle, couture arrière
        displace: (P, s, ang, r, radial) => radialD(radial,
          ripple(s, ang, elbowS - 0.005, 0.03, 0.016, 0.0055, 0.0, 1.1) + ripple(s, ang, elbowS + 0.01, 0.025, 0.021, 0.0025, Math.PI, 0.9, 1.2) +
          ripple(s, ang, 0.04, 0.03, 0.022, 0.003, Math.PI / 2, 0.8) + 0.002 * Math.sin(ang * 4 + s * 25) * gauss(s, 0.16, 0.06) +
          seamAt(ang, Math.PI - 0.3, 0.001)),
        hem1: torn ? (ang) => 0.012 + 0.03 * Math.abs(Math.sin(ang * 2.5 + 0.7)) * vnoise(ang * 5, 2, 3, 61) + 0.025 * gauss(wrapPi(ang), -1.6, 0.4) : undefined,
        hemDepth1: 0.06,
        weights: (s) => armW(s),
        color: (P, s, ang) => {
          let c = jacketColor(P, s + 0.3, ang + 1.0);
          c = mixc(c, PAL.jacketLight, gauss(s, elbowS, 0.03) * Math.max(0, -Math.cos(ang)) * 0.6); // coude usé
          c = mixc(c, PAL.jacketDark, smooth(sleeveEnd - 0.06, sleeveEnd, s) * 0.45);
          return c;
        }
      });
      if (!torn) {
        // manche retroussée : revers épais, doublure plus claire
        bd.loft('veste', {
          a: sh, b: armEnd, mirror: sx < 0, seg: 30, step: 0.006, s0: elbowS - 0.006, s1: elbowS + 0.046, rim0: 0.004, rim1: 0.004,
          rings: [{ s: elbowS - 0.006, w: 0.064, d: 0.064 }, { s: elbowS + 0.02, w: 0.07, d: 0.069 }, { s: elbowS + 0.046, w: 0.063, d: 0.062 }],
          radius: (s, ang) => 1 + 0.07 * Math.sin(ang * 4 + s * 50) * 0.5 + 0.04 * Math.sin(ang * 7 + 1.3),
          weights: (s) => armW(s),
          color: (P, s, ang) => mixc(mixc(PAL.jacketLight, PAL.khaki, 0.35), PAL.jacketDark, gauss(s, elbowS + 0.02, 0.006) * 0.5 + fbm(P[0] * 40, P[1] * 40, P[2] * 40, 63) * 0.25)
        });
      }
      // avant-bras nus et musclés (veines, éraflures, longue cicatrice sur le droit)
      bd.loft('skin', {
        a: sh, b: armEnd, mirror: sx < 0, seg: 20, step: 0.013, s0: elbowS - 0.02, s1: wristS + 0.012,
        rings: [{ s: elbowS - 0.02, w: 0.053, d: 0.053 }, { s: 0.35, w: 0.051, d: 0.047 }, { s: 0.43, w: 0.043, d: 0.037 }, { s: 0.5, w: 0.036, d: 0.029 }, { s: wristS + 0.012, w: 0.032, d: 0.025 }],
        weights: (s) => armW(s),
        color: (P, s, ang) => {
          let c = mixc(PAL.skin, PAL.skinShade, fbm(P[0] * 50, P[1] * 50, P[2] * 50, 71) * 0.4);
          const inner = smooth(-0.2, 0.6, Math.cos(ang - 0.9));
          const vein = 1 - smooth(0.0, 0.06, Math.abs(vnoise(s * 32, ang * 2.3, sx, 77) - 0.5));
          c = mixc(c, hexc(0x8a7a86), vein * inner * smooth(0.33, 0.4, s) * 0.3);
          c = mixc(c, PAL.mud, smooth(0.5, 0.8, fbm(P[0] * 20, P[1] * 20, P[2] * 20, 73)) * 0.35);
          c = mixc(c, PAL.skinRed, smooth(0.65, 0.8, vnoise(s * 120, ang * 3, 1, 75)) * gauss(s, 0.38, 0.03) * 0.8);
          if (!torn) c = mixc(c, hexc(0xe0b2a2), (1 - smooth(0.04, 0.09, Math.abs(wrapPi(ang - (0.45 + (s - 0.36) * 3))))) * smooth(0.355, 0.365, s) * smooth(0.475, 0.465, s) * 0.85);
          return c;
        }
      });
      if (torn) {
        // bandage spiralé taché
        bd.loft('tissu', {
          a: sh, b: armEnd, mirror: sx < 0, seg: 18, step: 0.008, s0: 0.43, s1: 0.505,
          rings: [{ s: 0.43, w: 0.048, d: 0.042 }, { s: 0.47, w: 0.0445, d: 0.037 }, { s: 0.505, w: 0.04, d: 0.033 }],
          radius: (s, ang) => 1 + 0.03 * Math.sin((s * 70 + ang / TAU) * TAU),
          weights: (s) => armW(s),
          color: (P, s, ang) => {
            let c = mixc(PAL.bandage, mulc(PAL.bandage, 0.8), fbm(s * 60, ang * 2, 1, 81) * 0.6);
            const wrap = ((s * 70 + ang / TAU) % 1 + 1) % 1;
            c = mixc(c, mulc(PAL.bandage, 0.72), smooth(0.9, 0.97, wrap));
            const bl = gauss(wrapPi(ang), -2.4, 0.5) * gauss(s, 0.465, 0.015);
            c = mixc(c, PAL.blood, smooth(0.25, 0.6, bl * (0.7 + 0.6 * vnoise(s * 200, ang * 8, 2, 83))));
            return c;
          }
        });
      }
      // main : mitaine de cuir + doigts
      buildHand(bd, THREE, I, S, sx, sh, armEnd, wristS);
    }

    // ---------------------------------------------------------------- cou (inclus dans la tête cuite)
    const HD = headData(O);
    if (!HD) {
    bd.loft('skin', {
      a: [0, 1.43, -0.03], b: [0, 1.66, -0.03], seg: 20, step: 0.015,
      rings: [{ s: 0.0, w: 0.081, dF: 0.07, dB: 0.081 }, { s: 0.07, w: 0.075, dF: 0.065, dB: 0.074 }, { s: 0.15, w: 0.067, dF: 0.057, dB: 0.067, oz: 0.004 }, { s: 0.2, w: 0.064, dF: 0.055, dB: 0.062, oz: 0.006 }],
      weights: (s, ang, P) => { const y = P[1]; const t0 = smooth(1.44, 1.49, y), t1 = smooth(1.57, 1.62, y); return [[I.chest, 1 - t0], [I.neck, t0 * (1 - t1)], [I.head, t1]]; },
      color: (P) => mixc(PAL.skin, PAL.skinShade, 0.25 + fbm(P[0] * 40, P[1] * 40, P[2] * 40, 91) * 0.3)
    });
    }
    // bandana rouge noué au cou
    bd.loft('tissu', {
      a: [0, 1.476, -0.029], b: [0, 1.536, -0.027], seg: 36, step: 0.008, rim0: 0.002, rim1: 0.002,
      rings: [{ s: 0.0, w: 0.073, dF: 0.068, dB: 0.074 }, { s: 0.03, w: 0.066, dF: 0.061, dB: 0.068 }, { s: 0.06, w: 0.062, dF: 0.058, dB: 0.064 }],
      radius: (s, ang) => 1 + 0.04 * Math.sin(ang * 5 + s * 80),
      weights: (s, ang, P) => [[I.chest, 0.4], [I.neck, 0.6]],
      color: (P, s, ang) => mixc(PAL.bandana, PAL.bandanaLight, smooth(0.5, 0.8, vnoise(ang * 14, s * 120, 1, 95)) * 0.6)
    });
    {
      // nœud froissé sur l'avant gauche et ses deux pans posés sur la poitrine
      const kn = new THREE.SphereGeometry(0.0105, 14, 10);
      const kp = kn.attributes.position;
      for (let i = 0; i < kp.count; i++) {
        const x = kp.getX(i), y = kp.getY(i), z = kp.getZ(i);
        const k = 1 + 0.18 * Math.sin(x * 900 + y * 500) * Math.sin(z * 700) + 0.12 * Math.sin(Math.atan2(y, x) * 5);
        kp.setXYZ(i, x * 1.35 * k, y * 0.9 * k, z * 0.95 * k);
      }
      kn.computeVertexNormals();
      const nw = [[I.chest, 0.45], [I.neck, 0.55]];
      bd.rigid('tissu', kn, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.2, 0.3, 0.45)).setPosition(0.027, 1.489, 0.038), nw, PAL.bandana);
      const tailCol = (P, t) => mixc(PAL.bandana, PAL.bandanaLight, 0.25 + 0.35 * vnoise(P[0] * 300, P[1] * 300, 1, 97));
      bd.ribbon('tissu', [[0.03, 1.484, 0.042], [0.035, 1.465, 0.055], [0.039, 1.443, 0.066], [0.041, 1.42, 0.074]], (t) => lerp(0.02, 0.011, t), 0.0018,
        () => [0, 0.25, 1], (P, t) => [[I.neck, 0.4 * (1 - t)], [I.chest, 0.6 + 0.4 * t]], tailCol);
      bd.ribbon('tissu', [[0.022, 1.483, 0.042], [0.019, 1.466, 0.056], [0.015, 1.447, 0.067]], (t) => lerp(0.018, 0.01, t), 0.0018,
        () => [0, 0.25, 1], (P, t) => [[I.neck, 0.4 * (1 - t)], [I.chest, 0.6 + 0.4 * t]], tailCol);
    }

    // ---------------------------------------------------------------- tête : cuite si les données sont chargées, sinon procédurale
    if (!HD) buildHead(bd, THREE, I, W);

    // ---------------------------------------------------------------- équipement de récup
    buildGear(bd, THREE, I, W, torsoWeights);

    // ---------------------------------------------------------------- assemblage
    const MAT = makeMaterials(THREE, Object.assign({
      skin: { r: 0.5, tex: 'peau', ns: 1.4, sss: true },
      tshirt: { r: 0.95, double: true, tex: 'jersey', ns: 0.9 },
      veste: { r: 0.92, double: true, tex: 'toile' },
      jean: { r: 0.9, double: true, tex: 'denim' },
      tissu: { r: 0.9, double: true, tex: 'toile', texScale: 0.55, ns: 0.7 },
      cuir: { r: 0.58, tex: 'cuir', ns: 0.9 },
      sangle: { r: 0.85, double: true, tex: 'sangle' },
      metal: { r: 0.38, m: 0.85, tex: 'metal', ns: 0.5 }
    }, HD ? {} : { hair: { r: 0.8 }, eye: { r: 0.3 } }), { renderer: O.renderer, matieres: O.matieres });
    const meshes = bd.build(MAT, linear);
    let HEAD = null;
    if (HD) {
      HEAD = buildBakedHead(THREE, HD, I, { renderer: O.renderer, linear: linear, shadows: O.shadows, hairLayers: O.hairLayers, quality: O.quality });
      for (const k in HEAD.meshes) meshes[k] = HEAD.meshes[k];
      for (const k in HEAD.materials) MAT[k] = HEAD.materials[k];
    }
    const object = new THREE.Group();
    object.name = 'Anthony';
    object.add(sk.bones[0]);
    for (const k in meshes) {
      if (!HEAD || !HEAD.meshes[k]) { meshes[k].castShadow = O.shadows; meshes[k].receiveShadow = O.shadows; }
      object.add(meshes[k]);
    }
    object.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(sk.bones);
    for (const k in meshes) meshes[k].bind(skeleton);

    let tris = 0, draws = 0;
    for (const k in meshes) { draws++; tris += meshes[k].geometry.index.count / 3; }
    const api = {
      object: object, skeleton: skeleton, bones: sk.byName, meshes: meshes, materials: MAT,
      stats: { triangles: Math.round(tris), drawCalls: draws, bones: sk.bones.length },
      height: 1.80,
      setBlink: HEAD ? HEAD.setBlink : null,
      headVersion: HEAD ? 'cuite' : 'procédurale',
      dispose() { for (const k in meshes) meshes[k].geometry.dispose(); for (const k in MAT) MAT[k].dispose(); }
    };
    if (typeof attachAnimation === 'function') attachAnimation(THREE, api, sk);
    return api;
  }

  // ============================================================================================
  // Tête d'Anthony (homme de 20-30 ans, rasé, traits de combattant) : crâne et visage en un seul
  // maillage à résolution resserrée sur l'avant, yeux dans de vraies ouvertures de paupières,
  // oreilles, coupe courte dégradée.
  // ============================================================================================
  // Anneaux de la tête : [y, demi-largeur, avant z, arrière z, exposant] — mâchoire large et carrée
  const HEAD_RINGS = [
    [1.556, 0.027, 0.087, 0.045, 2.3],
    [1.565, 0.048, 0.094, 0.012, 2.6],
    [1.578, 0.0585, 0.097, -0.020, 3.1],
    [1.595, 0.0626, 0.098, -0.050, 3.3],
    [1.615, 0.0668, 0.099, -0.085, 3.0],
    [1.640, 0.0718, 0.097, -0.105, 2.8],
    [1.665, 0.0742, 0.094, -0.113, 2.55],
    [1.690, 0.0762, 0.0958, -0.116, 2.35],
    [1.715, 0.0765, 0.0895, -0.116, 2.25],
    [1.740, 0.074, 0.078, -0.110, 2.2],
    [1.765, 0.064, 0.058, -0.094, 2.1],
    [1.782, 0.045, 0.034, -0.070, 2.0],
    [1.790, 0.020, 0.010, -0.030, 2.0]
  ];
  const HEAD_Y0 = 1.556;
  function headRings(grow) {
    return HEAD_RINGS.map(([y, w, f, b, n]) => {
      const oz = (f + b) / 2, d = (f - b) / 2;
      return { s: y - HEAD_Y0, w: w + grow, dF: d + grow, dB: d + grow, n: n, oz: oz };
    });
  }
  const HEAD_R = prepRings(headRings(0));
  // anneaux serrés sur le visage, plus lâches sur le crâne
  const HEAD_S = (() => {
    const out = [], band = (y0, y1, st) => { for (let y = y0; y < y1 - 1e-6; y += st) out.push(y - HEAD_Y0); };
    band(1.556, 1.585, 0.003);
    band(1.585, 1.615, 0.002);   // bouche
    band(1.615, 1.655, 0.0025);  // nez
    band(1.655, 1.683, 0.002);   // yeux
    band(1.683, 1.711, 0.003);   // sourcils
    band(1.711, 1.771, 0.006);
    band(1.771, 1.79, 0.004);
    out.push(1.79 - HEAD_Y0);
    return out;
  })();
  const EYE_C = [0.0318, 1.6672];      // centre de l'œil gauche (x, y)
  const EYE_R = 0.0118;                 // rayon du globe
  const EYE_W = 0.0141, EYE_UP = 0.0049, EYE_LO = 0.0042;   // amande plissée : regard dur
  // distance d'un point (x, y) à un segment, pour les plis et cicatrices
  const segDist = (x, y, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, t = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
  };
  // cicatrices : [x0, y0, x1, y1, largeur]
  const SCARS = [[0.0392, 1.7015, 0.0338, 1.6838, 0.0011], [-0.0565, 1.6462, -0.0418, 1.6318, 0.001], [0.0125, 1.5728, 0.0042, 1.5662, 0.0009]];
  const scarMask = (x, y) => { let m = 0; for (const s of SCARS) m = Math.max(m, 1 - smooth(s[4] * 0.6, s[4] * 1.8, segDist(x, y, s[0], s[1], s[2], s[3]))); return m; };

  // Relief du visage (m, le long de la normale radiale) d'après la position (x, y) et l'angle.
  function faceDisp(x, y, ang, withEyes) {
    const front = smooth(0.05, 0.55, Math.cos(ang));
    if (front <= 0) return 0;
    const ax = Math.abs(x), aa = Math.abs(wrapPi(ang));
    let d = 0;
    // nez cassé : dos légèrement dévié, bosse sur l'arête, pointe et ailes plus larges
    const tN = clamp((1.686 - y) / (1.686 - 1.637), 0, 1);
    const xn = x - 0.0009 * tN, axn = Math.abs(xn);
    const top = lerp(0.003, 0.0046, tN), base = lerp(0.008, 0.0112, tN);
    const prof = 1 - smooth(top, base, axn);
    if (y < 1.692 && y > 1.626) d += lerp(0.0022, 0.0165, Math.pow(tN, 1.1)) * prof * smooth(1.692, 1.682, y) * smooth(1.626, 1.636, y);
    d += 0.0017 * gauss(y, 1.6645, 0.0042) * (1 - smooth(0.0028, 0.0075, axn));
    d += 0.0042 * gauss(y, 1.6372, 0.0044) * (1 - smooth(0.0045, 0.0102, axn));
    d += 0.0078 * smooth(1.6245, 1.631, y) * smooth(1.6375, 1.6305, y) * (1 - smooth(0.002, 0.0062, axn));
    d += 0.0062 * gauss(y, 1.6326, 0.0042) * (gauss(xn, 0.0138, 0.0045) + gauss(xn, -0.0138, 0.0045));
    d -= 0.0017 * gauss(y, 1.6315, 0.006) * (gauss(x, 0.0198, 0.003) + gauss(x, -0.0198, 0.003));
    // arcades lourdes, glabelle et rides du lion, orbites profondes
    d += 0.0056 * gauss(y, 1.6895, 0.0058) * gauss(ax, 0.027, 0.022);
    d += 0.0028 * gauss(y, 1.6872, 0.006) * gauss(x, 0, 0.011);
    d -= 0.0008 * smooth(1.6825, 1.6855, y) * smooth(1.6965, 1.6935, y) * (gauss(x, 0.0056, 0.0012) + gauss(x, -0.0056, 0.0012));
    d -= 0.0068 * gauss(y, 1.6675, 0.0095) * gauss(ax, 0.032, 0.0155);
    // pommettes saillantes, joues creusées, sillons nasogéniens
    d += 0.0046 * gauss(y, 1.648, 0.011) * gauss(ax, 0.053, 0.014);
    d -= 0.0042 * gauss(y, 1.618, 0.012) * gauss(ax, 0.048, 0.013);
    const nl = Math.min(segDist(x, y, 0.0205, 1.6322, 0.0292, 1.6005), segDist(x, y, -0.0205, 1.6322, -0.0292, 1.6005));
    d -= 0.0011 * (1 - smooth(0.0008, 0.0028, nl));
    // bouche ferme : lèvres fines, commissures qui tombent
    const mw = 0.0238, mx = clamp(ax / mw, 0, 1.2), shape = Math.sqrt(Math.max(0, 1 - mx * mx));
    const yl = 1.5998 - 0.0012 * mx * mx;
    d += 0.0009 * gauss(y, yl + 0.0029, 0.0019) * Math.pow(shape, 1.3);
    d += 0.0016 * gauss(y, yl - 0.0037, 0.0024) * Math.pow(shape, 1.0);
    d -= 0.0013 * gauss(y, yl, 0.0009) * smooth(1.15, 0.9, mx);
    d += 0.0012 * gauss(y, 1.6125, 0.0042) * smooth(0.007, 0.002, ax);
    d -= 0.0012 * gauss(y, 1.5875, 0.003) * smooth(0.018, 0.005, ax);
    // menton large et carré, petite fossette ; angle de la mâchoire marqué
    d += 0.0086 * gauss(y, 1.5702, 0.0088) * gauss(x, 0, 0.02);
    d -= 0.0007 * gauss(x, 0, 0.0018) * gauss(y, 1.5715, 0.0045);
    d += 0.0055 * gauss(y, 1.586, 0.011) * gauss(aa, 1.25, 0.25);
    // cicatrices légèrement en relief
    d += 0.0004 * scarMask(x, y);
    // yeux : ouverture en amande plissée, bord des paupières, paupière supérieure lourde
    if (withEyes !== false) {
      for (const sx of [1, -1]) {
        const u = (x - EYE_C[0] * sx) / EYE_W, vy = y - EYE_C[1];
        const v = vy / (vy > 0 ? EYE_UP : EYE_LO);
        const dd = u * u + v * v;
        if (dd < 3.5) {
          d -= 0.0135 * smooth(1.12, 0.6, dd);
          d += 0.0012 * gauss(dd, 1.08, 0.2);
          d -= 0.0016 * gauss(v, 1.85, 0.4) * smooth(1.45, 0.6, Math.abs(u));
          d += 0.0007 * gauss(v, -1.7, 0.45) * smooth(1.3, 0.5, Math.abs(u));   // poches sous les yeux
        }
      }
    }
    return d * front;
  }
  // Point de base (sans relief) de la tête à la hauteur y et à l'angle ang
  function headBase(y, ang, grow) {
    const r = interpRing(HEAD_R, y - HEAD_Y0);
    const c = Math.cos(ang), sn = Math.sin(ang), ex = 2 / r.n;
    const x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (r.wL + (grow || 0));
    const z = Math.sign(c) * Math.pow(Math.abs(c), ex) * (r.dF + (grow || 0)) + r.oz;
    return { x: x, z: z, oz: r.oz };
  }
  // Surface du visage au point (x, y) côté avant : renvoie z (relief compris, sans les ouvertures des yeux)
  function faceZ(x, y) {
    let lo = 0, hi = Math.PI / 2 * Math.sign(x || 1);
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (Math.abs(headBase(y, mid).x) < Math.abs(x)) lo = mid; else hi = mid; }
    const ang = (lo + hi) / 2, b = headBase(y, ang);
    const rl = Math.hypot(b.x, b.z - b.oz) || 1;
    return b.z + (b.z - b.oz) / rl * faceDisp(b.x, y, ang, false);
  }

  function buildHead(bd, THREE, I, W) {
    const skinCol = (P, s, ang) => {
      const x = P[0], y = P[1], ax = Math.abs(x), fr = Math.cos(ang) > 0 ? 1 : 0;
      let c = mixc(PAL.skin, PAL.skinShade, fbm(P[0] * 60, P[1] * 60, P[2] * 60, 101) * 0.36);
      c = mulc(c, 0.96 + 0.06 * vnoise(P[0] * 700, P[1] * 700, P[2] * 700, 105));                     // grain de peau
      c = mixc(c, PAL.skinRed, gauss(y, 1.642, 0.016) * gauss(ax, 0.052, 0.016) * 0.22);
      c = mixc(c, PAL.skinRed, gauss(y, 1.638, 0.006) * gauss(x, 0, 0.009) * 0.3);
      // rasé de près : ombre de barbe à peine visible sur la mâchoire et la lèvre supérieure
      c = mixc(c, hexc(0x7d6b62), (gauss(y, 1.58, 0.02) * smooth(0.018, 0.045, ax) * smooth(0.075, 0.06, ax) + gauss(y, 1.6125, 0.005) * smooth(0.024, 0.012, ax) + gauss(y, 1.571, 0.008) * smooth(0.02, 0.0, ax)) * 0.16 * fr);
      // lèvres fines
      const mw = 0.0238, mx = clamp(ax / mw, 0, 1.2), shp = Math.sqrt(Math.max(0, 1 - mx * mx)), yl = 1.5998 - 0.0012 * mx * mx;
      const upTop = yl + (0.0008 + 0.0036 * Math.pow(shp, 1.3)), loBot = yl - (0.001 + 0.0058 * Math.pow(shp, 1.1));
      const inLip = smooth(1.06, 0.9, mx);
      const upM = smooth(upTop + 0.001, upTop - 0.0006, y) * smooth(yl - 0.0006, yl + 0.0004, y) * inLip;
      const loM = smooth(loBot - 0.001, loBot + 0.0006, y) * smooth(yl + 0.0006, yl - 0.0004, y) * inLip;
      c = mixc(c, mulc(PAL.lip, 0.86), upM * 0.62);
      c = mixc(c, mixc(PAL.lip, PAL.skinRed, 0.3), loM * 0.52);
      c = mixc(c, mulc(PAL.lip, 0.48), gauss(y, yl, 0.0007) * smooth(1.12, 0.8, mx) * 0.8);
      // narines
      c = mixc(c, hexc(0x5e4136), gauss(y, 1.6298, 0.0014) * (gauss(x, 0.0068, 0.002) + gauss(x, -0.0068, 0.002)) * 0.6);
      if (Math.cos(ang) > 0.3) {
        // cils, bords des paupières, cernes, pli de la paupière lourde
        const u = (ax - EYE_C[0]) / EYE_W, vy = y - EYE_C[1], v = vy / (vy > 0 ? EYE_UP : EYE_LO);
        const dd = u * u + v * v;
        c = mixc(c, hexc(0x24180f), gauss(dd, 1.02, 0.22) * smooth(-0.3, 0.25, v) * (0.55 + 0.35 * smooth(-0.4, 0.8, u)));
        c = mixc(c, PAL.skinRed, gauss(dd, 1.0, 0.22) * smooth(0.1, -0.4, v) * 0.3);
        c = mixc(c, mulc(PAL.skinShade, 0.85), gauss(v, 1.85, 0.5) * smooth(1.5, 0.5, Math.abs(u)) * 0.38);
        c = mixc(c, mixc(PAL.skinShade, hexc(0x6e5a63), 0.35), gauss(v, -1.9, 0.6) * smooth(1.4, 0.4, Math.abs(u)) * 0.3);
        // rides du lion
        c = mixc(c, PAL.skinShade, smooth(1.6825, 1.6855, y) * smooth(1.6965, 1.6935, y) * (gauss(x, 0.0056, 0.0011) + gauss(x, -0.0056, 0.0011)) * 0.5);
        // sillons nasogéniens
        const nl = Math.min(segDist(x, y, 0.0205, 1.6322, 0.0292, 1.6005), segDist(x, y, -0.0205, 1.6322, -0.0292, 1.6005));
        c = mixc(c, PAL.skinShade, (1 - smooth(0.0008, 0.0028, nl)) * 0.35);
      }
      // cicatrices claires (sourcil gauche, joue droite, menton)
      c = mixc(c, hexc(0xe3b5a6), scarMask(x, y) * 0.8);
      // crasse, sang séché à la lisière, éraflure sur la pommette gauche
      c = mixc(c, PAL.mud, smooth(0.6, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 103)) * 0.38);
      c = mixc(c, PAL.bloodDry, gauss(y, 1.727, 0.009) * gauss(x, 0.035, 0.013) * 0.55);
      c = mixc(c, PAL.skinRed, gauss(y, 1.651, 0.004) * gauss(x, 0.056, 0.006) * smooth(0.45, 0.7, vnoise(x * 900, y * 900, 1, 107)) * 0.7);
      return c;
    };
    bd.loft('skin', {
      a: [0, HEAD_Y0, 0], b: [0, 1.9, 0], seg: 112, angWarp: 0.66, sList: HEAD_S, rings: headRings(0), cap0: true, cap1: true,
      displace: (P, s, ang, r, radial) => {
        const d = faceDisp(P[0], P[1], ang, true);
        return [radial[0] * d, radial[1] * d, radial[2] * d];
      },
      weights: (s, ang, P) => {
        const backLow = smooth(1.62, 1.575, P[1]) * smooth(-0.01, -0.06, P[2]);
        return [[I.head, 1 - backLow * 0.6], [I.neck, backLow * 0.6]];
      },
      color: skinCol
    });

    // yeux : globes placés juste derrière le bord des paupières, regard droit devant
    for (const sx of [1, -1]) {
      const cx = EYE_C[0] * sx, cy = EYE_C[1];
      const rim = faceZ(cx, cy) + 0.0011;
      const cz = rim - 0.0016 - EYE_R;
      const look = vnorm([0.02 * sx, -0.01, 1]);
      const g = new THREE.SphereGeometry(EYE_R, 20, 14);
      bd.rigid('eye', g, new THREE.Matrix4().makeTranslation(cx, cy, cz), I.head, (P, N) => mixc(PAL.eyeWhite, hexc(0xd4b6a8), smooth(0.5, -0.1, vdot(N, look)) * 0.45));
      const iris = new THREE.SphereGeometry(EYE_R * 1.004, 28, 7, 0, TAU, 0, 0.53);
      iris.rotateX(Math.PI / 2);
      const qi = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(look[0], look[1], look[2]));
      const mi = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), qi, new THREE.Vector3(1, 1, 1));
      bd.rigid('eye', iris, mi, I.head, (P, N) => {
        const dz = vdot(N, look);
        if (dz > 0.982) return PAL.pupil;
        if (dz > 0.975) return mixc(PAL.pupil, mulc(PAL.iris, 0.7), 0.5);
        return mixc(mulc(PAL.iris, 0.38), mixc(PAL.iris, hexc(0xa3b0b4), smooth(0.975, 0.93, dz) * 0.3), smooth(0.862, 0.9, dz));
      });
      // bord des paupières (cils sur le dessus)
      const lid = [];
      for (let k = 0; k <= 36; k++) {
        const t = k / 36 * TAU, u = Math.cos(t), up = Math.sin(t) >= 0;
        const ly = cy + Math.sin(t) * (up ? EYE_UP : EYE_LO) * 0.97;
        lid.push([cx + u * (EYE_W - 0.0003), ly, faceZ(cx + u * (EYE_W - 0.0003), ly) - 0.0012]);
      }
      bd.ribbon('skin', lid, (t) => (Math.sin(t * TAU) >= 0 ? 0.0028 : 0.0019), 0.0017,
        (pp) => vnorm([(pp[0] - cx) * 0.6, (pp[1] - cy) * 0.6, 1]), () => [[I.head, 1]],
        (P, t) => {
          const up = Math.sin(t * TAU);
          return up > 0 ? mixc(mixc(PAL.skin, PAL.skinShade, 0.45), hexc(0x20150d), smooth(0.0, 0.5, up) * 0.88) : mixc(PAL.skin, PAL.skinRed, 0.35);
        });
      // sourcils épais et froncés (bout intérieur abaissé) ; le gauche est coupé par une cicatrice
      const browY = (t) => 1.6886 + 0.003 * Math.sin(Math.PI * Math.min(1, t * 1.1)) - 0.0012 * t - 0.0017 * (1 - t) * (1 - t);
      const pieces = sx > 0 ? [[0, 0.47], [0.62, 1]] : [[0, 1]];
      for (const [t0, t1] of pieces) {
        const pts = [];
        const n = Math.max(3, Math.round((t1 - t0) * 9));
        for (let k = 0; k <= n; k++) {
          const t = lerp(t0, t1, k / n), x = sx * lerp(0.0102, 0.056, t), y = browY(t);
          pts.push([x, y, faceZ(x, y) + 0.0007]);
        }
        bd.ribbon('hair', pts, (tt) => { const t = lerp(t0, t1, tt); return lerp(0.0086, 0.0036, t * t) * (0.9 + 0.2 * vnoise(t * 9, sx, 1, 129)); }, 0.0007,
          (p) => [p[0] * 0.8, 0.3, 1], () => [[I.head, 1]], (P, tt) => mixc(mulc(PAL.brow, 0.85), PAL.hair, 0.1 + 0.3 * lerp(t0, t1, tt)));
      }
    }

    // oreilles : pavillon et bordure
    for (const sx of [1, -1]) {
      const ear = new THREE.SphereGeometry(0.031, 16, 12);
      ear.scale(0.34, 0.95, 0.58);
      const me = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.22, -0.16 * sx, 0.05 * sx)).setPosition(0.0738 * sx, 1.657, -0.031);
      bd.rigid('skin', ear, me, I.head, (P, N) => mixc(mixc(PAL.skin, PAL.skinRed, 0.22), PAL.skinShade, smooth(0.1, 0.8, N[0] * sx) * 0.55));
      const rimG = new THREE.TorusGeometry(0.0242, 0.0046, 6, 16, Math.PI * 1.25);
      rimG.rotateZ(-Math.PI * 0.45);
      rimG.scale(1, 1.18, 1);
      const mr = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.22, -0.16 * sx + Math.PI / 2 * sx, 0.05 * sx)).setPosition(0.0762 * sx, 1.66, -0.033);
      bd.rigid('skin', rimG, mr, I.head, mixc(PAL.skin, PAL.skinRed, 0.3));
    }

    buildHair(bd, THREE, I);
  }

  // Coupe courte dégradée : calotte près du crâne (le cuir chevelu transparaît sur les côtés)
  // et mèches courtes et drues sur le dessus, posées sur un ellipsoïde qui épouse le crâne.
  const HAIR_C = [0, 1.69, -0.013], HAIR_E = [0.0785, 0.1, 0.1045];
  function buildHair(bd, THREE, I) {
    const hairCol = (P, k) => {
      const v = fbm(P[0] * 80, P[1] * 80, P[2] * 80, 111);
      return mixc(mixc(PAL.hair, PAL.hairLight, v * 0.45 + (k || 0)), PAL.dust, smooth(0.74, 0.9, fbm(P[0] * 20, P[1] * 20, P[2] * 20, 113)) * 0.2);
    };
    // lisière : profil continu selon l'angle (0 = front, π/2 = au-dessus de l'oreille, π = nuque)
    const HL = [[0, 0.108], [0.42, 0.106], [0.68, 0.113], [1.0, 0.1], [1.2, 0.062], [1.36, 0.046], [1.57, 0.072], [1.82, 0.05], [2.25, 0.012], [3.1416, 0.0]];
    const hairline = (ang) => {
      const a = Math.abs(wrapPi(ang));
      let i = 0;
      while (i < HL.length - 2 && a > HL[i + 1][0]) i++;
      const t = clamp((a - HL[i][0]) / (HL[i + 1][0] - HL[i][0]), 0, 1);
      return lerp(HL[i][1], HL[i + 1][1], (1 - Math.cos(t * Math.PI)) / 2) + 0.0015 * vnoise(ang * 30, 1, 1, 117);
    };
    bd.loft('hair', {
      a: [0, HEAD_Y0, 0], b: [0, 1.9, 0], seg: 72, step: 0.005, rings: headRings(0.0012),
      s0: 1.614 - HEAD_Y0, s1: 1.794 - HEAD_Y0, cap1: true, hem0: hairline, hemDepth0: 0.115,
      radius: (s, ang, r) => {
        // ras sur les côtés et la nuque, plus épais sur le dessus
        const y = HEAD_Y0 + s, rad = Math.hypot(Math.sin(ang) * r.wL, Math.cos(ang) * r.dF) || 0.05;
        const a = Math.abs(wrapPi(ang)), topK = Math.max(smooth(1.69, 1.75, y), (1 - smooth(0.6, 1.0, a)) * smooth(1.70, 1.73, y));
        return 1 + (0.0004 + 0.0034 * topK + 0.0015 * topK * fbm(ang * 4, y * 50, 1, 119)) / rad;
      },
      weights: () => [[I.head, 1]],
      color: (P, s, ang) => {
        // dégradé : sur les côtés et la nuque, le cuir chevelu transparaît de plus en plus vers le bas
        const a = Math.abs(wrapPi(ang)), sideK = smooth(0.8, 1.15, a);
        const fade = sideK * (1 - smooth(1.655, 1.725, P[1]));
        const scalp = mixc(mixc(PAL.skin, PAL.skinShade, 0.55), PAL.hair, 0.28);
        // lisière adoucie : les derniers millimètres laissent voir la peau
        const edge = 1 - smooth(0.0, 0.007, s - (1.614 - HEAD_Y0 + hairline(ang)));
        return mixc(mulc(hairCol(P), 0.82), scalp, Math.max(fade * 0.85, edge * 0.7));
      }
    });
    const proj = (P, lift) => {
      const q = [(P[0] - HAIR_C[0]) / HAIR_E[0], (P[1] - HAIR_C[1]) / HAIR_E[1], (P[2] - HAIR_C[2]) / HAIR_E[2]];
      const l = vlen(q) || 1;
      const base = [HAIR_C[0] + q[0] / l * HAIR_E[0], HAIR_C[1] + q[1] / l * HAIR_E[1], HAIR_C[2] + q[2] / l * HAIR_E[2]];
      const n = vnorm([(base[0] - HAIR_C[0]) / (HAIR_E[0] * HAIR_E[0]), (base[1] - HAIR_C[1]) / (HAIR_E[1] * HAIR_E[1]), (base[2] - HAIR_C[2]) / (HAIR_E[2] * HAIR_E[2])]);
      return { p: vadd(base, vscale(n, lift)), n: n };
    };
    const sph = (theta, phi) => [HAIR_C[0] + HAIR_E[0] * Math.sin(theta) * Math.sin(phi), HAIR_C[1] + HAIR_E[1] * Math.cos(theta), HAIR_C[2] + HAIR_E[2] * Math.sin(theta) * Math.cos(phi)];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const clump = (theta, phi, dirFn, len, w0, lift0, vol, tint) => {
      let P = proj(sph(theta, phi), lift0).p;
      const pts = [], outs = [], n = 6, step = len / (n - 1);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const pr = proj(P, lift0 + vol * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.003 * t * t);
        pts.push(pr.p); outs.push(pr.n);
        let D = dirFn(pr.p, t);
        D = vnorm(vsub(D, vscale(pr.n, vdot(D, pr.n))));
        P = vadd(pr.p, vscale(D, step));
      }
      bd.ribbon('hair', pts, (t) => w0 * lerp(1, 0.15, Math.pow(t, 1.1)), (t) => lerp(0.0036, 0.0012, t), (p, i) => outs[i], () => [[I.head, 1]],
        (Pp, t) => mixc(hairCol(Pp, tint), PAL.hairLight, t * 0.15));
    };
    // dessus : mèches courtes et drues, légèrement relevées vers l'avant, plaquées vers l'arrière derrière
    for (let k = 0; k < 150; k++) {
      const phi = lerp(-Math.PI, Math.PI, rnd()), theta = Math.pow(rnd(), 0.7) * 0.92;
      const frontish = Math.cos(phi) > 0.2 && theta > 0.35;
      clump(theta, phi, (p, t) => frontish ? [(rnd() - 0.5) * 0.3 + p[0] * 2, 0.6, 0.55] : [(p[0] / 0.08) * 0.35 + (rnd() - 0.5) * 0.3, 0.3, -1],
        0.018 + rnd() * 0.016, 0.009 + rnd() * 0.005, 0.0018, 0.0028 + rnd() * 0.0035, (rnd() - 0.5) * 0.22);
    }
    // haut des côtés, au-dessus du dégradé
    for (let k = 0; k < 40; k++) {
      const sx = k % 2 ? 1 : -1, phi = sx * lerp(0.9, 2.3, rnd()), theta = lerp(0.85, 1.12, rnd());
      clump(theta, phi, () => [sx * 0.1, -0.5, -0.8], 0.012 + rnd() * 0.008, 0.008 + rnd() * 0.004, 0.0012, 0.0012, (rnd() - 0.5) * 0.2);
    }
  }

  // Main gauche (le côté droit est obtenu par symétrie) : mitaine de cuir, doigts nus au-delà de la 1re phalange.
  function buildHand(bd, THREE, I, S, sx, sh, armEnd, wristS) {
    const mir = sx < 0;
    const wr = vadd(sh, vscale(ARM_DIR, wristS));
    const gloveCol = (P) => {
      let c = mixc(PAL.glove, hexc(0x433a33), fbm(P[0] * 90, P[1] * 90, P[2] * 90, 121) * 0.6);
      return mixc(c, PAL.dust, smooth(0.65, 0.85, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 123)) * 0.3);
    };
    const handW = (s) => { const t = smooth(-0.02, 0.015, s); return [[I['fore' + S], 1 - t], [I['hand' + S], t]]; };
    bd.loft('cuir', {
      a: wr, b: vadd(wr, vscale(ARM_DIR, 0.2)), mirror: mir, seg: 20, step: 0.01, s0: -0.014, s1: L_PALM + 0.004,
      rings: [
        { s: -0.014, w: 0.031, d: 0.031, n: 2.2 }, { s: 0.006, w: 0.03, d: 0.033, n: 2.4 }, { s: 0.016, w: 0.024, d: 0.037, n: 2.8 },
        { s: 0.045, wL: 0.017, wR: 0.016, d: 0.042, n: 3.2 }, { s: 0.078, wL: 0.016, wR: 0.015, d: 0.044, n: 3.2 }, { s: L_PALM + 0.004, w: 0.013, d: 0.042, n: 3 }
      ],
      cap1: true,
      weights: (s) => handW(s),
      color: (P, s) => mixc(gloveCol(P), mulc(PAL.glove, 0.7), gauss(s, 0.008, 0.004))
    });
    const FING = [[0.0305, 0.083, 0.0093, -0.004], [0.0105, 0.092, 0.0097, 0], [-0.0105, 0.086, 0.0091, -0.003], [-0.029, 0.067, 0.0081, -0.012]];
    // coques de jointures sur le dos de la mitaine
    {
      const dirL = ARM_DIR, backL = [-ARM_DIR[1], ARM_DIR[0], 0];
      const dir = mir ? [-dirL[0], dirL[1], 0] : dirL, back = mir ? [-backL[0], backL[1], 0] : backL;
      const third = vcross(back, dir);
      for (const [dz, len, r0, bk] of FING) {
        let p = vadd(vadd(wr, vscale(ARM_DIR, L_PALM + bk - 0.006)), [0, 0, dz]);
        p = vadd(p, vscale(backL, 0.0148));
        if (mir) p = [-p[0], p[1], p[2]];
        const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...back), new THREE.Vector3(...dir), new THREE.Vector3(...third)).setPosition(p[0], p[1], p[2]).multiply(new THREE.Matrix4().makeScale(0.0045, 0.0095, r0 * 0.95));
        bd.rigid('cuir', new THREE.SphereGeometry(1, 10, 8), M, I['hand' + S], (P) => mixc(mixc(PAL.glove, hexc(0x5c5148), 0.35), PAL.dust, smooth(0.6, 0.85, fbm(P[0] * 90, P[1] * 90, P[2] * 90, 125)) * 0.3));
      }
    }
    for (const [dz, len, r0, back] of FING) {
      const k = vadd(vadd(wr, vscale(ARM_DIR, L_PALM + back)), [0, 0, dz]);
      bd.loft('skin', {
        a: k, b: vadd(k, vscale(ARM_DIR, len)), mirror: mir, seg: 10, step: 0.006, s0: -0.008, s1: len,
        rings: [
          { s: -0.008, w: r0 * 1.15, d: r0 * 1.1 }, { s: 0.0, w: r0 * 1.12, d: r0 * 1.12 }, { s: 0.026, w: r0 * 1.12, d: r0 * 1.1 },
          { s: 0.029, w: r0 * 0.95, d: r0 * 0.95 }, { s: 0.046, w: r0 * 0.98, d: r0 * 0.98 }, { s: len - 0.012, w: r0 * 0.82, d: r0 * 0.85 },
          { s: len - 0.003, w: r0 * 0.6, d: r0 * 0.62 }, { s: len, w: r0 * 0.2, d: r0 * 0.25 }
        ],
        cap0: true, cap1: true,
        weights: (s) => { const t0 = smooth(-0.006, 0.008, s), t1 = smooth(0.038, 0.052, s); return [[I['hand' + S], 1 - t0], [I['fing' + S], t0 * (1 - t1)], [I['fing2' + S], t1]]; },
        color: (P, s) => s < 0.0275 ? gloveCol(P) : mixc(mixc(PAL.skin, PAL.skinShade, 0.3), PAL.mud, smooth(len - 0.02, len, s) * 0.3)
      });
    }
    const tb = vadd(wr, [ARM_DIR[0] * 0.022 - 0.012, ARM_DIR[1] * 0.022, 0.026]);
    const td = thumbDir(1);
    bd.loft('skin', {
      a: tb, b: vadd(tb, vscale(td, 0.07)), mirror: mir, seg: 10, step: 0.006, s0: -0.01, s1: 0.064,
      rings: [{ s: -0.01, w: 0.014, d: 0.013 }, { s: 0.0, w: 0.0128, d: 0.0122 }, { s: 0.022, w: 0.0118, d: 0.0112 }, { s: 0.025, w: 0.0102, d: 0.0098 }, { s: 0.05, w: 0.0095, d: 0.009 }, { s: 0.06, w: 0.007, d: 0.0068 }, { s: 0.064, w: 0.003, d: 0.003 }],
      cap0: true, cap1: true,
      weights: (s) => { const t0 = smooth(-0.008, 0.01, s), t1 = smooth(0.026, 0.038, s); return [[I['hand' + S], 1 - t0], [I['thumb' + S], t0 * (1 - t1)], [I['thumb2' + S], t1]]; },
      color: (P, s) => s < 0.0235 ? gloveCol(P) : mixc(PAL.skin, PAL.skinShade, 0.3)
    });
  }

  // ============================================================================================
  // Tête d'Anthony, version réaliste : sculpture anatomique (SDF) cuite hors ligne en un maillage
  // UV avec textures (albédo, normales, AO/rugosité), yeux à cornée brillante, cils, cheveux
  // courts en coques et clignement des paupières (cible de morphing). Données : survivant-tete.js.
  // ============================================================================================
  const TEX_CACHE = {};
  const RR_EYE = 15.5, CM_EYE = [-14.6, -0.7], CL_EYE = [13.6, 1.3], HUP_EYE = 3.9, HLO_EYE = 6.6;

  function headData(opts) {
    if (opts && opts.headData === false) return null;     // forcer la tête procédurale (sans données)
    if (opts && opts.headData) return opts.headData;
    const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
    return g.SURVIVANT_TETE || null;
  }
  function b64bytes(s) {
    let bin;
    if (typeof atob === 'function') bin = atob(s);
    else bin = Buffer.from(s, 'base64').toString('binary');
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function setTexColorSpace(THREE, tex, srgb) {
    if ('colorSpace' in tex) tex.colorSpace = srgb ? (THREE.SRGBColorSpace || 'srgb') : (THREE.NoColorSpace || '');
    else tex.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  }
  // maxSize : réduit les textures de la tête au chargement (qualité « moyenne » / « basse » : 1024 px)
  function bakedTexture(THREE, D, key, srgb, renderer, maxSize) {
    const ck = key + (srgb ? ':s' : ':l') + (maxSize || 0);
    if (TEX_CACHE[ck]) return TEX_CACHE[ck];
    const src = D.texPath ? D.texPath + ((D.texFiles && D.texFiles[key]) || key + '.webp') : D.tex[key];
    // hors navigateur (tests Node) : texture vide, la géométrie reste utilisable
    let tex;
    if (typeof document === 'undefined') tex = new THREE.Texture();
    else {
      tex = new THREE.TextureLoader().load(src, (t) => {
        const im = t.image;
        if (maxSize && im && im.width > maxSize) {
          const c = document.createElement('canvas');
          c.width = c.height = maxSize;
          c.getContext('2d').drawImage(im, 0, 0, maxSize, maxSize);
          t.image = c; t.needsUpdate = true;
        }
      });
    }
    setTexColorSpace(THREE, tex, srgb);
    tex.anisotropy = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
    TEX_CACHE[ck] = tex;
    return tex;
  }
  function almondEye(ex, ey) {
    const L = CL_EYE[0] - CM_EYE[0], t = (ex - CM_EYE[0]) / L, tc = clamp(t, 0, 1);
    const yc = CM_EYE[1] + (CL_EYE[1] - CM_EYE[1]) * tc;
    const su = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(tc, 0.8)), 0), 0.85);
    const sl = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(tc, 1.27)), 0), 0.9);
    return Math.max(Math.max(ey - (yc + HUP_EYE * su), (yc - HLO_EYE * sl) - ey), Math.max(-t, t - 1) * L);
  }

  // Peau : lumière enveloppante + rougeur au terminateur (diffusion sous la surface approchée).
  // Fonctionne avec les blocs de shader de r128 (geometry.normal) comme des versions récentes (geometryNormal).
  function skinShaderPatch(THREE) {
    return function (shader) {
      let chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
      const wrap = (nrm, brdf) => '{ float wNdL = dot( ' + nrm + ', directLight.direction );\n' +
        '  vec3 wrapI = directLight.color * ( max( ( wNdL + 0.45 ) / 1.45, 0.0 ) * 0.7 + max( wNdL, 0.0 ) * 0.3 );\n' +
        '  vec3 scat = directLight.color * vec3( 0.36, 0.11, 0.06 ) * max( 0.0, 1.0 - abs( wNdL * 1.8 - 0.15 ) ) * 0.55;\n' +
        '  reflectedLight.directDiffuse += ( wrapI + scat ) * ' + brdf + '( material.diffuseColor ); }';
      const a = 'reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );';
      const b = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
      if (chunk.indexOf(a) >= 0) chunk = chunk.replace(a, wrap('geometry.normal', 'BRDF_Diffuse_Lambert'));
      else if (chunk.indexOf(b) >= 0) chunk = chunk.replace(b, wrap('geometryNormal', 'BRDF_Lambert'));
      else return;
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk);
    };
  }
  // Coques de cheveux : seuil alpha par couche (attribut hlayer), un seul appel de dessin.
  function hairShaderPatch() {
    return function (shader) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float hlayer;\nvarying float vHL;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHL = hlayer;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHL;')
        .replace('#include <alphatest_fragment>', 'if ( diffuseColor.a < vHL * 0.9 + 0.06 ) discard;');
    };
  }

  /**
   * Construit les maillages de la tête cuite. I : index des os. Renvoie { meshes, materials, setBlink, stats }.
   * opts : { renderer, linear, shadows, hairLayers (défaut 10), quality }
   */
  function buildBakedHead(THREE, D, I, opts) {
    const rev = parseInt(THREE.REVISION, 10);
    const O = Object.assign({ shadows: true, quality: 'haute' }, opts || {});
    const Q = { haute: { tex: 0, layers: 8 }, moyenne: { tex: 1024, layers: 6 }, basse: { tex: 1024, layers: 4 } }[O.quality] || { tex: 0, layers: 8 };
    if (O.hairLayers == null) O.hairLayers = Q.layers;
    const nv = D.nv, bb = D.bbox;
    const q = new Uint16Array(b64bytes(D.pos).buffer);
    const nq = new Int8Array(b64bytes(D.nrm).buffer);
    const uq = new Uint16Array(b64bytes(D.uv).buffer);
    const iq = nv < 65536 ? new Uint16Array(b64bytes(D.idx).buffer) : new Uint32Array(b64bytes(D.idx).buffer);
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    const O3 = D.origin;
    for (let i = 0; i < nv; i++) {
      for (let k = 0; k < 3; k++) pos[i * 3 + k] = bb[k] + (bb[k + 3] - bb[k]) * q[i * 3 + k] / 65535;
      const nx = nq[i * 3] / 127, ny = nq[i * 3 + 1] / 127, nz = nq[i * 3 + 2] / 127, nl = Math.hypot(nx, ny, nz) || 1;
      nrm[i * 3] = nx / nl; nrm[i * 3 + 1] = ny / nl; nrm[i * 3 + 2] = nz / nl;
      uv[i * 2] = uq[i * 2] / 65535; uv[i * 2 + 1] = uq[i * 2 + 1] / 65535;
      // poids : visage et crâne → tête ; cou sous la ligne de la mâchoire → cou puis poitrine
      const y = pos[i * 3 + 1];
      const hy = (y - O3[1]) * 1000, hz = (pos[i * 3 + 2] - O3[2]) * 1000;
      const s = hy - (-114 + 0.38 * Math.max(15 - hz, 0));
      const wh = smooth(-18, 4, s), wc = (1 - wh) * (1 - smooth(1.44, 1.50, y)), wn = 1 - wh - wc;
      const ws = [[I.head, wh], [I.neck, wn], [I.chest, wc]].filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]);
      let tot = 0;
      for (const e of ws) tot += e[1];
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = k < ws.length ? ws[k][0] : 0; sw[i * 4 + k] = k < ws.length ? ws[k][1] / tot : 0; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('uv2', new THREE.BufferAttribute(uv, 2));        // aoMap en r128
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(iq, 1));
    // cible de morphing : fermeture des paupières
    const bi = new Uint16Array(b64bytes(D.blinkIdx).buffer), bd = new Int16Array(b64bytes(D.blink).buffer);
    const blink = new Float32Array(nv * 3);
    for (let j = 0; j < bi.length; j++) for (let k = 0; k < 3; k++) blink[bi[j] * 3 + k] = bd[j * 3 + k] / 100000;
    geo.morphAttributes.position = [new THREE.BufferAttribute(blink, 3)];
    geo.morphTargetsRelative = true;          // deltas (et non positions absolues)
    geo.computeBoundingSphere();

    // ---- matériaux
    const srgb = O.linear;      // textures de couleur décodées en linéaire si la sortie est sRGB
    const T = (k, s) => bakedTexture(THREE, D, k, s, O.renderer, (k === 'eye' || k === 'lash' || k === 'orm') ? 0 : Q.tex);
    const skinM = new THREE.MeshStandardMaterial({ map: T('albedo', srgb), normalMap: T('normal', false), aoMap: T('orm', false),
      roughnessMap: T('orm', false), roughness: 1.0, metalness: 0.0, aoMapIntensity: 0.9 });
    skinM.normalScale.set(1, 1);
    skinM.onBeforeCompile = skinShaderPatch(THREE);
    skinM.name = 'peau';
    const hairM = new THREE.MeshStandardMaterial({ map: T('hair', srgb), vertexColors: true, roughness: 0.72, metalness: 0, alphaTest: 0.5 });
    hairM.onBeforeCompile = hairShaderPatch();
    hairM.name = 'cheveux';
    const eyeM = new THREE.MeshStandardMaterial({ map: T('eye', srgb), roughness: 0.32, metalness: 0 });
    eyeM.name = 'yeux';
    const corneaM = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false });
    corneaM.name = 'cornee';
    const ramp = new Uint8Array(64 * 4);
    for (let i = 0; i < 64; i++) { ramp[i * 4] = ramp[i * 4 + 1] = ramp[i * 4 + 2] = Math.round(i / 63 * 255); ramp[i * 4 + 3] = 255; }
    const rampTex = new THREE.DataTexture(ramp, 64, 1, THREE.RGBAFormat);
    rampTex.needsUpdate = true;
    const occM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, alphaMap: rampTex, opacity: 0.85 });
    occM.name = 'ombre_yeux';
    const lashM = new THREE.MeshStandardMaterial({ map: T('lash', srgb), roughness: 0.6, metalness: 0, alphaTest: 0.35, side: THREE.DoubleSide });
    lashM.name = 'cils';
    const mats = { tete: skinM, cheveux: hairM, yeux: eyeM, cornee: corneaM, ombre_yeux: occM, cils: lashM };
    if (rev < 129) for (const k in mats) mats[k].skinning = true;
    if (rev < 129) { skinM.morphTargets = true; lashM.morphTargets = true; }

    const meshes = {};
    const mk = (name, g, m) => {
      const mesh = new THREE.SkinnedMesh(g, m);
      mesh.name = name; mesh.frustumCulled = false;
      meshes[name] = mesh;
      return mesh;
    };
    const skinMesh = mk('tete', geo, skinM);
    skinMesh.castShadow = O.shadows; skinMesh.receiveShadow = O.shadows;

    // ---- coques de cheveux (sous-ensemble des triangles chevelus, décalés le long de la normale)
    {
      const L = new Uint8Array(b64bytes(D.hairL).buffer), fl = new Int8Array(b64bytes(D.flow).buffer);
      const tris = [];
      for (let t = 0; t < iq.length; t += 3) {
        const a = iq[t], b = iq[t + 1], c = iq[t + 2];
        if (Math.max(L[a], L[b], L[c]) > 6) tris.push(a, b, c);
      }
      const used = new Map();
      for (const v of tris) if (!used.has(v)) used.set(v, used.size);
      const nl = Math.max(2, O.hairLayers | 0), nu = used.size;
      const P = new Float32Array(nl * nu * 3), Nn = new Float32Array(nl * nu * 3), U = new Float32Array(nl * nu * 2);
      const C = new Float32Array(nl * nu * 3), HL = new Float32Array(nl * nu);
      const SI = new Uint16Array(nl * nu * 4), SW = new Float32Array(nl * nu * 4);
      const IX = [];
      for (let l = 0; l < nl; l++) {
        const t = (l + 1) / nl;
        for (const [v, j] of used) {
          const o = l * nu + j, len = L[v] / 10000;    // m
          const fx = fl[v * 3] / 127, fy = fl[v * 3 + 1] / 127, fz = fl[v * 3 + 2] / 127;
          const tt = Math.pow(t, 0.85), off = 0.0003 + len * tt, lean = len * tt * tt * 0.5;
          for (let k = 0; k < 3; k++) {
            P[o * 3 + k] = pos[v * 3 + k] + nrm[v * 3 + k] * off + [fx, fy, fz][k] * lean;
            Nn[o * 3 + k] = nrm[v * 3 + k];
          }
          U[o * 2] = uv[v * 2]; U[o * 2 + 1] = uv[v * 2 + 1];
          const g = 0.42 + 0.58 * t;
          C[o * 3] = C[o * 3 + 1] = C[o * 3 + 2] = g;
          HL[o] = t;
          for (let k = 0; k < 4; k++) { SI[o * 4 + k] = si[v * 4 + k]; SW[o * 4 + k] = sw[v * 4 + k]; }
        }
        for (const v of tris) IX.push(l * nu + used.get(v));
      }
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.BufferAttribute(P, 3));
      hg.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
      hg.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      hg.setAttribute('color', new THREE.BufferAttribute(srgb ? C.map(toLin) : C, 3));
      hg.setAttribute('hlayer', new THREE.BufferAttribute(HL, 1));
      hg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
      hg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
      hg.setIndex(IX.length > 65535 ? new THREE.Uint32BufferAttribute(IX, 1) : new THREE.Uint16BufferAttribute(IX, 1));
      const hm = mk('cheveux', hg, hairM);
      hm.castShadow = false; hm.receiveShadow = O.shadows;
    }

    // ---- yeux : globe (iris aplati sous la cornée), cornée brillante additive, ombre des paupières
    {
      const r = D.eye.r, ex = D.eye.x, ri = 0.0059, zi = Math.sqrt(r * r - ri * ri);
      const eyes = [], corneas = [], occs = [];
      for (const sx of [1, -1]) {
        const c = [sx * ex, O3[1], O3[2]], bone = sx > 0 ? I.oeilG : I.oeilD;
        // globe
        const g = new THREE.SphereGeometry(r, 40, 28);
        g.rotateX(Math.PI / 2);
        const p = g.attributes.position, uvs = g.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const rr = Math.hypot(x, y);
          if (z > 0 && rr < ri) z = zi + 0.00025 * (1 - (rr / ri) * (rr / ri));
          p.setXYZ(i, x + c[0], y + c[1], z + c[2]);
          uvs.setXY(i, 0.5 + x / 0.0248, 0.5 + y / 0.0248);
        }
        g.computeVertexNormals();
        eyes.push([g, bone]);
        // cornée : calotte sphérique (rayon 7,8 mm) raccordée au limbe
        const rc = 0.0078, th = Math.asin(ri / rc) * 1.04, z0 = zi - rc * Math.cos(Math.asin(ri / rc));
        const cg = new THREE.SphereGeometry(rc, 32, 10, 0, Math.PI * 2, 0, th);
        cg.rotateX(Math.PI / 2);
        cg.translate(c[0], c[1], c[2] + z0);
        corneas.push([cg, bone]);
        // ombre portée des paupières et des coins (coque fixe, transparente au centre)
        const og = new THREE.SphereGeometry(r + 0.0003, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.5);
        og.rotateX(Math.PI / 2);
        const op = og.attributes.position, ou = og.attributes.uv;
        for (let i = 0; i < op.count; i++) {
          const x = op.getX(i), y = op.getY(i), z = op.getZ(i), l = Math.hypot(x, y, z) || 1;
          const ad = almondEye(RR_EYE * x * sx / l, RR_EYE * y / l);
          let a = smooth(-3.6, -0.2, ad) * 0.8 + smooth(-7.5, 0.5, ad) * (y > 0 ? 0.35 : 0.12);
          ou.setXY(i, clamp(a, 0, 1), 0.5);
          op.setXYZ(i, x + c[0], y + c[1], z + c[2]);
        }
        occs.push([og, I.head]);
      }
      const merge = (list, name, mat, morph) => {
        let n = 0, ni = 0;
        for (const [g] of list) { n += g.attributes.position.count; ni += g.index.count; }
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), IX = new Uint16Array(ni);
        const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
        let o = 0, oi = 0;
        for (const [g, bone] of list) {
          const c = g.attributes.position.count;
          P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2);
          for (let i = 0; i < g.index.count; i++) IX[oi + i] = g.index.array[i] + o;
          for (let i = 0; i < c; i++) { SI[(o + i) * 4] = bone; SW[(o + i) * 4] = 1; }
          o += c; oi += g.index.count; g.dispose();
        }
        const m = new THREE.BufferGeometry();
        m.setAttribute('position', new THREE.BufferAttribute(P, 3));
        m.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        m.setAttribute('uv', new THREE.BufferAttribute(U, 2));
        m.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
        m.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
        m.setIndex(new THREE.BufferAttribute(IX, 1));
        return mk(name, m, mat);
      };
      const em = merge(eyes, 'yeux', eyeM); em.receiveShadow = O.shadows;
      const cm = merge(corneas, 'cornee', corneaM); cm.renderOrder = 2;
      const om = merge(occs, 'ombre_yeux', occM); om.renderOrder = 1;
    }

    // ---- cils (œil gauche dans les données, œil droit en miroir), avec leur propre clignement
    {
      const lv = D.lash.v, luv = D.lash.uv, li = D.lash.i, lb = D.lash.blink, n = lv.length / 3;
      const P = new Float32Array(n * 6), U = new Float32Array(n * 4), MB = new Float32Array(n * 6), IX = [];
      const SI = new Uint16Array(n * 8), SW = new Float32Array(n * 8), N = new Float32Array(n * 6);
      for (let s = 0; s < 2; s++) {
        const sx = s === 0 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const o = s * n + i;
          P[o * 3] = O3[0] + sx * lv[i * 3] / 1000; P[o * 3 + 1] = O3[1] + lv[i * 3 + 1] / 1000; P[o * 3 + 2] = O3[2] + lv[i * 3 + 2] / 1000;
          MB[o * 3] = sx * lb[i * 3] / 100000; MB[o * 3 + 1] = lb[i * 3 + 1] / 100000; MB[o * 3 + 2] = lb[i * 3 + 2] / 100000;
          U[o * 2] = luv[i * 2]; U[o * 2 + 1] = luv[i * 2 + 1];
          N[o * 3 + 1] = 0.3; N[o * 3 + 2] = 0.95;
          SI[o * 4] = I.head; SW[o * 4] = 1;
        }
        for (let t = 0; t < li.length; t += 3) {
          if (s === 0) IX.push(li[t], li[t + 1], li[t + 2]);
          else IX.push(n + li[t], n + li[t + 2], n + li[t + 1]);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
      g.setIndex(IX);
      g.morphAttributes.position = [new THREE.BufferAttribute(MB, 3)];
      g.morphTargetsRelative = true;
      mk('cils', g, lashM);
    }
    for (const k of ['tete', 'cils']) meshes[k].morphTargetInfluences = [0];
    const setBlink = (v) => { meshes.tete.morphTargetInfluences[0] = v; meshes.cils.morphTargetInfluences[0] = v; };
    return { meshes: meshes, materials: mats, setBlink: setBlink };
  }

  /**
   * Environnement d'éclairage procédural (ciel couvert, sol chaud, deux grandes sources douces),
   * filtré par PMREMGenerator : reflets des yeux et de la peau, lumière ambiante plus crédible.
   * Renvoie une texture à placer dans scene.environment (ou material.envMap).
   */
  function createEnvironment(THREE, renderer, opts) {
    const O = Object.assign({ sky: 0xb9c4cc, horizon: 0x8d8f88, ground: 0x4a4038, sun: 0xfff0dc, intensity: 1 }, opts || {});
    const sc = new THREE.Scene();
    const g = new THREE.SphereGeometry(10, 32, 16);
    const col = [], p = g.attributes.position;
    const cs = new THREE.Color(O.sky), ch = new THREE.Color(O.horizon), cg = new THREE.Color(O.ground), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 10;
      if (y > 0) c.copy(ch).lerp(cs, Math.pow(y, 0.6)); else c.copy(ch).lerp(cg, Math.pow(-y, 0.5));
      c.multiplyScalar(O.intensity);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, k, color) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k * O.intensity), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
    };
    panel(5, 4, 4, 6, 5, 4.0, O.sun);         // grande source chaude (soleil voilé)
    panel(6, 3, -6, 3, -3, 1.2, 0xcfdcff);    // contre-jour froid
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(sc, 0.03);
    pm.dispose();
    g.dispose();
    return rt.texture;
  }

  // ============================================================================================
  // Équipement de récup : ceinturon militaire, boucle, porte-chargeurs, trousse, gourde, musette et
  // sa sangle en bandoulière ; poches et fermeture éclair de la veste.
  // ============================================================================================
  // Point à la surface d'un loft vertical (anneaux bruts, sans les modulations de rayon).
  function surfPoint(rings, y0, y, ang, grow) {
    const r = interpRing(prepRings(rings), y - y0);
    const c = Math.cos(ang), sn = Math.sin(ang), ex = 2 / r.n;
    const x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ((sn >= 0 ? r.wL : r.wR) + grow);
    const z = Math.sign(c) * Math.pow(Math.abs(c), ex) * ((c >= 0 ? r.dF : r.dB) + grow);
    return [x + r.ox, y, z + r.oz];
  }
  // Veste : épaules tombantes (trapèzes), poitrine, taille, ourlet aux hanches
  const JACKET_RINGS = [
    { s: 0.10, w: 0.178, dF: 0.121, dB: 0.123, n: 2.3 }, { s: 0.16, w: 0.174, dF: 0.121, dB: 0.12, n: 2.3 },
    { s: 0.24, w: 0.182, dF: 0.132, dB: 0.122, n: 2.35 }, { s: 0.32, w: 0.196, dF: 0.146, dB: 0.13, n: 2.45, oz: 0.005 },
    { s: 0.39, w: 0.202, dF: 0.142, dB: 0.134, n: 2.5 }, { s: 0.44, w: 0.199, dF: 0.124, dB: 0.126, n: 2.45, oz: -0.006 },
    { s: 0.47, w: 0.186, dF: 0.106, dB: 0.114, n: 2.35, oz: -0.012 }, { s: 0.495, w: 0.143, dF: 0.092, dB: 0.1, n: 2.3, oz: -0.017 },
    { s: 0.515, w: 0.112, dF: 0.083, dB: 0.09, n: 2.2, oz: -0.021 }, { s: 0.535, w: 0.094, dF: 0.078, dB: 0.086, n: 2.1, oz: -0.024 }
  ];
  const BELT_RINGS = [{ s: 0.0, w: 0.176, dF: 0.112, dB: 0.12, n: 2.4, oz: -0.008 }, { s: 0.052, w: 0.175, dF: 0.111, dB: 0.118, n: 2.4, oz: -0.008 }];

  // Boîte souple : arêtes arrondies (rayon r) et faces légèrement bombées (toile rembourrée, cuir)
  function softBox(THREE, w, h, d, r, bulge, seg) {
    const n = seg || 6;
    const g = new THREE.BoxGeometry(w, h, d, n, Math.max(2, Math.round(n * h / w)), Math.max(2, Math.round(n * d / w)));
    const p = g.attributes.position, hx = w / 2, hy = h / 2, hz = d / 2;
    const ix = Math.max(hx - r, 1e-4), iy = Math.max(hy - r, 1e-4), iz = Math.max(hz - r, 1e-4);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const qx = clamp(x, -ix, ix), qy = clamp(y, -iy, iy), qz = clamp(z, -iz, iz);
      let dx = x - qx, dy = y - qy, dz = z - qz;
      const l = Math.hypot(dx, dy, dz);
      if (l > 1e-7) { x = qx + dx / l * r; y = qy + dy / l * r; z = qz + dz / l * r; }
      // bombé au centre des grandes faces (± x et ± z)
      const kz = Math.max(0, 1 - (x / hx) * (x / hx)) * Math.max(0, 1 - (y / hy) * (y / hy));
      const kx = Math.max(0, 1 - (z / hz) * (z / hz)) * Math.max(0, 1 - (y / hy) * (y / hy));
      z += Math.sign(z) * bulge * kz; x += Math.sign(x) * bulge * 0.6 * kx;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }

  function buildGear(bd, THREE, I, W, torsoWeights) {
    const webbing = (P) => mixc(mixc(PAL.olive, PAL.oliveDark, fbm(P[0] * 50, P[1] * 50, P[2] * 50, 131) * 0.6), PAL.dust, smooth(0.6, 0.85, fbm(P[0] * 18, P[1] * 18, P[2] * 18, 133)) * 0.3);
    const canvasKhaki = (P) => mixc(mixc(PAL.khaki, PAL.khakiDark, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 135) * 0.7), PAL.mud, smooth(0.55, 0.8, fbm(P[0] * 14, P[1] * 14, P[2] * 14, 137)) * 0.35);
    const hipW = () => [[I.hips, 1]];
    const at = (x, y, z, ry, rx, rz) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')).setPosition(x, y, z);

    // --- ceinturon (sangle de coton tissé) ---
    bd.loft('sangle', {
      a: [0, 0.975, 0], b: [0, 1.1, 0], seg: 64, step: 0.013, rings: BELT_RINGS,
      radius: (s) => 1 + 0.02 * gauss(s, 0.026, 0.015),
      weights: hipW,
      color: (P, s) => mixc(webbing(P), PAL.oliveDark, Math.max(gauss(s, 0.003, 0.004), gauss(s, 0.049, 0.004)) * 0.6)
    });
    // boucle à deux pièces
    const bz = surfPoint(BELT_RINGS, 0.975, 1.001, 0, 0.004)[2];
    for (const [w, h, x, y] of [[0.058, 0.007, 0, 0.022], [0.058, 0.007, 0, -0.022], [0.007, 0.05, 0.026, 0], [0.007, 0.05, -0.026, 0], [0.006, 0.05, 0.004, 0]]) {
      bd.rigid('metal', new THREE.BoxGeometry(w, h, 0.006), at(x, 1.001 + y, bz + 0.002), hipW(), PAL.steel);
    }
    // porte-chargeurs double (hanche avant gauche) et trousse de secours (dos droit)
    const pouch = (ang, w, h, d, yTop, col, flapCol) => {
      const p = surfPoint(BELT_RINGS, 0.975, 1.0, ang, 0.0);
      const nrm = Math.atan2(p[0], p[2] + 0.008);
      const out = [Math.sin(nrm), 0, Math.cos(nrm)];
      const c = vadd(p, vscale(out, d / 2 + 0.004));
      bd.rigid('veste', softBox(THREE, w, h, d, 0.009, 0.004, 6), at(c[0], yTop - h / 2, c[2], nrm), hipW(), col);
      const fl = vadd(p, vscale(out, d / 2 + 0.006));
      bd.rigid('veste', softBox(THREE, w + 0.006, h * 0.36, d + 0.007, 0.004, 0.002, 6), at(fl[0], yTop - h * 0.16, fl[2], nrm, 0.04), hipW(), flapCol);
      const sn = vadd(p, vscale(out, d + 0.0115));
      bd.rigid('metal', new THREE.SphereGeometry(0.004, 6, 4), at(sn[0], yTop - h * 0.27, sn[2]), hipW(), PAL.brass);
    };
    pouch(0.62, 0.075, 0.095, 0.036, 1.03, webbing([0.1, 1, 0.1]), mulc(PAL.olive, 0.92));
    pouch(1.02, 0.07, 0.09, 0.034, 1.028, webbing([0.15, 1, 0.05]), mulc(PAL.olive, 0.9));
    pouch(-2.55, 0.065, 0.08, 0.03, 1.025, webbing([-0.1, 1, -0.1]), mulc(PAL.oliveDark, 1.05));

    // --- gourde dans sa housse (hanche droite) ---
    {
      const p = surfPoint(BELT_RINGS, 0.975, 0.95, -1.62, 0.0);
      const nrm = Math.atan2(p[0], p[2] + 0.008);
      const out = [Math.sin(nrm), 0, Math.cos(nrm)];
      const c = vadd(p, vscale(out, 0.04));
      const g = new THREE.SphereGeometry(1, 18, 14);
      g.scale(0.066, 0.092, 0.036);
      bd.rigid('sangle', g, at(c[0], 0.925, c[2], nrm), hipW(), (P, N) => mixc(webbing(P), PAL.oliveDark, smooth(0.2, -0.6, N[1]) * 0.4));
      const flap = new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2.2);
      flap.scale(0.07, 0.04, 0.04);
      bd.rigid('veste', flap, at(c[0], 0.985, c[2], nrm), hipW(), mulc(PAL.olive, 0.85));
      const cap = vadd(p, vscale(out, 0.045));
      bd.rigid('metal', new THREE.CylinderGeometry(0.014, 0.015, 0.02, 12), at(cap[0] + 0.0, 1.012, cap[2], nrm), hipW(), PAL.alu);
    }

    // --- musette en toile (hanche gauche) + sangle en bandoulière ---
    {
      const p = surfPoint(BELT_RINGS, 0.975, 0.95, 1.72, 0.0);
      const nrm = Math.atan2(p[0], p[2] + 0.008);
      const out = [Math.sin(nrm), 0, Math.cos(nrm)];
      const c = vadd(p, vscale(out, 0.05));
      const bag = softBox(THREE, 0.07, 0.2, 0.25, 0.022, 0.0, 8);
      { // sac rempli : flancs gonflés, fond affaissé
        const bp = bag.attributes.position;
        for (let i = 0; i < bp.count; i++) {
          const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
          const k = Math.max(0, 1 - (z / 0.125) * (z / 0.125)) * Math.max(0, 1 - ((y + 0.02) / 0.11) * ((y + 0.02) / 0.11));
          bp.setX(i, x * (1 + 0.45 * k) + 0.004 * Math.sin(z * 60 + y * 30) * k);
          bp.setY(i, y - 0.008 * k * smooth(0.0, -0.1, y));
        }
        bag.computeVertexNormals();
      }
      const mBag = new THREE.Matrix4().makeRotationY(nrm - Math.PI / 2).setPosition(c[0], 0.915, c[2] - 0.02);
      bd.rigid('veste', bag, mBag, hipW(), (P) => canvasKhaki(P));
      const flap = softBox(THREE, 0.086, 0.12, 0.258, 0.01, 0.003, 8);
      const mFlap = new THREE.Matrix4().makeRotationY(nrm - Math.PI / 2).multiply(new THREE.Matrix4().makeRotationZ(-0.04));
      mFlap.setPosition(c[0] + out[0] * 0.006, 0.965, c[2] + out[2] * 0.006 - 0.02);
      bd.rigid('veste', flap, mFlap, hipW(), (P) => mixc(canvasKhaki(P), PAL.khakiDark, 0.35));
      for (const dz of [-0.07, 0.07]) {
        const b = vadd(c, vscale(out, 0.047));
        bd.rigid('cuir', new THREE.BoxGeometry(0.004, 0.06, 0.016), at(b[0], 0.925, b[2] - 0.02 + dz, nrm), hipW(), PAL.leatherLight);
      }
      // sangle : avant du sac → épaule droite → dos → arrière du sac
      const path = [[1.07, 1.30], [1.13, 1.0], [1.2, 0.72], [1.28, 0.38], [1.35, 0.08], [1.41, -0.25], [1.455, -0.65], [1.475, -1.15], [1.46, -1.75],
        [1.40, -2.3], [1.33, -2.75], [1.24, 3.0], [1.16, 2.6], [1.09, 2.2]];
      const pts = [];
      for (let k = 0; k < path.length - 1; k++) {
        for (let t = 0; t < 1; t += 0.25) {
          const y = lerp(path[k][0], path[k + 1][0], t);
          let a0 = path[k][1], a1 = path[k + 1][1];
          if (Math.abs(a1 - a0) > Math.PI) a1 += a1 < a0 ? TAU : -TAU;
          const ang = lerp(a0, a1, t);
          pts.push(surfPoint(JACKET_RINGS, 0.95, y, ang, 0.006 + 0.004 * smooth(1.42, 1.47, y)));
        }
      }
      pts.push(surfPoint(JACKET_RINGS, 0.95, path[path.length - 1][0], path[path.length - 1][1], 0.006));
      bd.ribbon('sangle', pts, 0.038, 0.004, (P) => [P[0], 0.15, P[2] + 0.01],
        (P) => torsoWeights(P[1], P[0]), (P) => webbing(P));
    }

    // --- couteau de combat dans son étui, sur la sangle (poitrine gauche), manche vers l'épaule droite ---
    {
      const p0 = surfPoint(JACKET_RINGS, 0.95, 1.19, 0.76, 0.014), p1 = surfPoint(JACKET_RINGS, 0.95, 1.32, 0.3, 0.014);
      const dir = vnorm(vsub(p1, p0)), mid = vlerp(p0, p1, 0.42);
      const out = vnorm([mid[0], 0.12, mid[2] + 0.01]);
      const side = vnorm(vcross(dir, out)), out2 = vcross(side, dir);
      const M = (pos, sc) => new THREE.Matrix4().makeBasis(new THREE.Vector3(...side), new THREE.Vector3(...dir), new THREE.Vector3(...out2)).setPosition(pos[0], pos[1], pos[2]).multiply(new THREE.Matrix4().makeScale(sc[0], sc[1], sc[2]));
      const tw = (P) => torsoWeights(P[1], P[0]);
      const sheath = new THREE.CylinderGeometry(0.5, 0.36, 1, 10, 1);
      bd.rigid('cuir', sheath, M(vadd(mid, vscale(out2, 0.007)), [0.036, 0.165, 0.016]), tw, (P) => mixc(PAL.leatherLight, PAL.leather, 0.3 + fbm(P[0] * 60, P[1] * 60, P[2] * 60, 143) * 0.4));
      const top = vadd(mid, vscale(dir, 0.0825));
      bd.rigid('metal', new THREE.BoxGeometry(1, 1, 1), M(vadd(vadd(top, vscale(dir, 0.005)), vscale(out2, 0.007)), [0.046, 0.008, 0.016]), tw, PAL.steel);
      bd.rigid('cuir', new THREE.CylinderGeometry(0.5, 0.5, 1, 10), M(vadd(vadd(top, vscale(dir, 0.05)), vscale(out2, 0.008)), [0.02, 0.085, 0.018]), tw,
        (P) => mixc(hexc(0x2a2420), hexc(0x4a3f36), (Math.sin(vdot(vsub(P, top), dir) * 260) > 0.3 ? 1 : 0) * 0.5));
      bd.rigid('metal', new THREE.SphereGeometry(1, 8, 6), M(vadd(vadd(top, vscale(dir, 0.096)), vscale(out2, 0.008)), [0.012, 0.009, 0.012]), tw, PAL.steel);
    }

    // --- poches plaquées (épousent la veste, rembourrage au centre, tranche visible) et rabats boutonnés ---
    const surfPatch = (mat, cAng, cY, w, h, grow, bulge, color, nu, nv) => {
      const c0 = surfPoint(JACKET_RINGS, 0.95, cY, cAng, 0);
      const R = Math.hypot(c0[0], c0[2] + 0.005) || 0.15;
      const da = (w / 2) / R;
      const tw = (P) => torsoWeights(P[1], P[0]);
      const grid = [];
      for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
          const u = i / nu * 2 - 1, v = j / nv * 2 - 1;
          const b = bulge * (1 - u * u) * (1 - v * v);
          grid.push(surfPoint(JACKET_RINGS, 0.95, cY + v * h / 2, cAng + u * da, grow + b));
        }
      }
      // face avant
      const g = new THREE.BufferGeometry();
      const pos = [], idx = [];
      for (const p of grid) pos.push(p[0], p[1], p[2]);
      const ring = [];
      for (let i = 0; i <= nu; i++) ring.push(i);
      for (let j = 1; j <= nv; j++) ring.push(j * (nu + 1) + nu);
      for (let i = nu - 1; i >= 0; i--) ring.push(nv * (nu + 1) + i);
      for (let j = nv - 1; j >= 1; j--) ring.push(j * (nu + 1));
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
        idx.push(a, b, c, a, c, d);
      }
      // tranche : anneau de bord ramené contre la veste
      const base = grid.length;
      for (const k of ring) {
        const i = k % (nu + 1), j = Math.floor(k / (nu + 1));
        const p = surfPoint(JACKET_RINGS, 0.95, cY + (j / nv * 2 - 1) * h / 2, cAng + (i / nu * 2 - 1) * da, grow * 0.3);
        pos.push(p[0], p[1], p[2]);
      }
      for (let q = 0; q < ring.length; q++) {
        const a = ring[q], b = ring[(q + 1) % ring.length], c = base + (q + 1) % ring.length, d = base + q;
        idx.push(a, d, c, a, c, b);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      bd.rigid(mat, g, new THREE.Matrix4(), tw, color);
    };
    const pocketCol = (P) => mixc(mixc(PAL.jacket, PAL.jacketDark, 0.2 + fbm(P[0] * 30, P[1] * 30, P[2] * 30, 141) * 0.3), PAL.mud, 0.08);
    const pocket = (ang, y, w, h) => {
      surfPatch('veste', ang, y, w, h, 0.004, 0.006, pocketCol, 8, 8);
      surfPatch('veste', ang, y + h / 2 - 0.016, w + 0.008, 0.036, 0.0105, 0.003, (P) => mixc(pocketCol(P), PAL.jacketDark, 0.3), 8, 3);
      const bt = surfPoint(JACKET_RINGS, 0.95, y + h / 2 - 0.026, ang, 0.0165);
      const nrm = Math.atan2(bt[0], bt[2]);
      bd.rigid('metal', new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 10).rotateX(Math.PI / 2), at(bt[0], y + h / 2 - 0.026, bt[2], nrm), (P) => torsoWeights(P[1], P[0]), PAL.steel);
    };
    pocket(0.66, 1.30, 0.095, 0.11);
    pocket(-0.66, 1.30, 0.095, 0.11);
    pocket(0.84, 1.13, 0.12, 0.11);
    pocket(-0.84, 1.13, 0.12, 0.11);
    for (const side of [1, -1]) {
      const pts = [];
      for (let y = 1.06; y <= 1.455; y += 0.015) {
        const s = y - 0.95;
        const gap = y < 1.25 ? lerp(0.40, 0.27, smooth(1.05, 1.25, y)) : lerp(0.27, 0.95, smooth(1.33, 1.52, y));
        pts.push(surfPoint(JACKET_RINGS, 0.95, y, side * (gap + 0.03), 0.001));
      }
      bd.ribbon('metal', pts, 0.009, 0.0025, (P) => [P[0], 0, P[2]], (P) => torsoWeights(P[1], P[0]), (P) => mixc(PAL.steel, PAL.jacketDark, 0.45));
    }
  }

  // ============================================================================================
  // Animation procédurale du corps : repos, marche, course, sprint, sprint tactique, glissade, accroupi,
  // arme basse, visée (IK des bras), saut, touché, mort. Tout est calculé à chaque image à partir de quelques paramètres.
  // Conventions des os (orientation de référence = identité) : rotation.x > 0 envoie un membre
  // pendant vers l'arrière ; rotation.z > 0 lève le bras gauche sur le côté (le droit : signe inverse).
  // ============================================================================================
  // Interpolation périodique d'une table [[phase, valeur], ...] (phase dans [0, 1))
  function cyc(table, ph) {
    ph = ((ph % 1) + 1) % 1;
    const n = table.length;
    for (let i = 0; i < n; i++) {
      const a = table[i], b = table[(i + 1) % n];
      const pb = b[0] <= a[0] ? b[0] + 1 : b[0];
      let p = ph;
      if (p < a[0]) p += 1;
      if (p >= a[0] && p <= pb) {
        const t = (p - a[0]) / (pb - a[0] || 1);
        return lerp(a[1], b[1], (1 - Math.cos(t * Math.PI)) / 2);
      }
    }
    return table[0][1];
  }
  const g1 = (ph, c, w) => { let d = ((ph - c) % 1 + 1.5) % 1 - 0.5; return Math.exp(-(d * d) / (2 * w * w)); };
  // Courbes de marche et de course, jambe gauche, phase 0 = attaque du talon gauche
  const GAIT = {
    walk: {
      hip: (p) => 0.40 * Math.cos(TAU * p) + 0.06,
      knee: (p) => 0.22 * g1(p, 0.1, 0.06) + 1.0 * g1(p, 0.7, 0.1) + 0.07,
      foot: [[0, -0.22], [0.12, 0.0], [0.42, 0.05], [0.58, 0.42], [0.72, 0.15], [0.9, -0.12]],
      toe: (p) => -0.35 * g1(p, 0.56, 0.06),
      bob: 0.016, sway: 0.018, yaw: 0.095, roll: 0.035, arm: 0.34, elbow: 0.34, elbowSwing: 0.25, lean: 0.06
    },
    run: {
      hip: (p) => 0.62 * Math.cos(TAU * p) + 0.17,
      knee: (p) => 0.5 * g1(p, 0.12, 0.06) + 1.85 * g1(p, 0.66, 0.11) + 0.22,
      foot: [[0, -0.05], [0.1, 0.05], [0.4, 0.55], [0.55, 0.45], [0.75, 0.2], [0.92, -0.05]],
      toe: (p) => -0.45 * g1(p, 0.42, 0.06),
      bob: 0.03, sway: 0.012, yaw: 0.13, roll: 0.04, arm: 0.64, elbow: 1.35, elbowSwing: 0.3, lean: 0.24, armOff: 0.12
    },
    // sprint : foulée plus longue, talon qui remonte haut, buste penché, bras qui pompent
    sprint: {
      hip: (p) => 0.8 * Math.cos(TAU * p) + 0.26,
      knee: (p) => 0.55 * g1(p, 0.12, 0.06) + 2.2 * g1(p, 0.63, 0.12) + 0.25,
      foot: [[0, -0.02], [0.1, 0.1], [0.38, 0.65], [0.55, 0.52], [0.75, 0.15], [0.92, -0.04]],
      toe: (p) => -0.5 * g1(p, 0.4, 0.06),
      bob: 0.034, sway: 0.01, yaw: 0.16, roll: 0.035, arm: 0.88, elbow: 1.55, elbowSwing: 0.22, lean: 0.46, armOff: 0.16
    }
  };
  GAIT.walk.armOff = 0;
  // cadence (pas/s) selon la vitesse, d'après les mesures de biomécanique de la course (homme de 1,80 m)
  const CADENCE = [[0, 1.4], [1.4, 1.85], [2.5, 2.5], [3.5, 2.8], [5.0, 2.95], [6.65, 3.25], [8.2, 3.6], [10, 4.0]];
  function cadenceAt(v) {
    if (v <= CADENCE[0][0]) return CADENCE[0][1];
    for (let i = 1; i < CADENCE.length; i++) if (v <= CADENCE[i][0]) { const a = CADENCE[i - 1], b = CADENCE[i]; return lerp(a[1], b[1], (v - a[0]) / (b[0] - a[0])); }
    return CADENCE[CADENCE.length - 1][1];
  }
  // Glissade : jambe droite tendue devant, jambe gauche repliée dessous, buste penché en arrière sur la hanche gauche.
  // Rotations locales [x, y, z] ; mêmes conventions que le reste du fichier.
  const SLIDE_POSE = {
    hips: [-1.1, 0.15, 0.1],
    spine: [0.12, -0.1, -0.05], chest: [0.08, -0.08, -0.03], neck: [0.3, 0.06, 0.0], head: [0.36, 0.08, 0.04],
    footR: [0.42, 0, 0.04], toesR: [0, 0, 0], footL: [0.55, 0, 0.35], toesL: [0.25, 0, 0],
    // bras libres (sans arme) : main gauche en appui derrière, bras droit en avant pour l'équilibre
    armL: [0.55, 0, 0.35], foreL: [-0.1, 0, 0], handL: [-0.5, 0, 0.15],
    armR: [-0.45, 0, -0.22], foreR: [-0.5, 0, 0], handR: [0.15, 0, 0],
    clavL: [0, 0, 0.12], clavR: [0, 0, -0.05]
  };
  const SLIDE_HIP = { y: -0.79, z: 0.33 };   // bassin à ~20 cm du sol, avancé pour que la tête reste au-dessus des pieds
  // Jambes de la glissade, en directions dans le repère du personnage (x gauche, y haut, z avant) :
  // droite tendue vers l'avant, talon au sol ; gauche repliée en « 4 », genou au sol, tibia sous la cuisse droite.
  const SLIDE_LEGS = {
    R: { thigh: [-0.06, -0.18, 0.98], shin: [-0.04, -0.24, 0.97] },
    L: { thigh: [0.5, -0.29, 0.82], shin: [-0.8, -0.06, -0.56] }
  };
  const SLIDE_HAND_L = [0.36, 0.035, -0.22];   // main gauche à plat au sol derrière la hanche (sans arme)

  function attachAnimation(THREE, api, sk) {
    const B = sk.byName, W = sk.world;
    const bindPos = {};
    for (const k in B) bindPos[k] = B[k].position.clone();
    const e = new THREE.Euler(), q = new THREE.Quaternion();
    const R = {}; // rotations voulues : nom → [x, y, z]
    const set = (name, x, y, z) => { const r = R[name] || (R[name] = [0, 0, 0]); r[0] += x; r[1] += y; r[2] += z; };

    // --- ancres pour accrocher des objets ---
    const anchors = {};
    const mk = (name, bone, pos, rotZ) => {
      const o = new THREE.Object3D(); o.name = name;
      o.position.set(pos[0], pos[1], pos[2]);
      if (rotZ) o.rotation.z = rotZ;
      B[bone].add(o); anchors[name] = o; return o;
    };
    // main droite : origine au centre de la poignée tenue, +Z = avant de l'arme, +Y = haut de l'arme
    mk('rightHand', 'handR', vadd(vscale([-ARM_DIR[0], ARM_DIR[1], 0], 0.052), [0.012, 0, 0.004]), -ARM_ANGLE);
    // main gauche (soutien) : même convention, à placer sous le garde-main de l'arme
    mk('leftHand', 'handL', vadd(vscale(ARM_DIR, 0.05), [-0.018, 0, 0.0]), Math.PI / 2 + ARM_ANGLE);
    mk('head', 'head', [0, 0.1, 0.0]);
    mk('back', 'chest', [0, 0.06, -0.17]);
    mk('hip', 'hips', [-0.19, -0.02, 0.0]);

    const st = {
      phase: 0, time: 0, speed: 0, crouch: 0, armed: 0, aim: 0, air: 0, lookPitch: 0, lookYaw: 0, turn: 0, slide: 0, slideT: 0, sprint: 0, tac: 0,
      hit: 0, hitT: 9, hitDir: [0, 0], death: 0, dead: false, deathT: 0, weapon: null, foregrip: null,
      blinkT: 1.5, blinkPh: 0, sacT: 0, sac: [0, 0]
    };
    const P = { speed: 0, crouch: false, aim: false, armed: false, onGround: true, lookPitch: 0, lookYaw: 0, turn: 0, slide: 0, slideT: 0, sprint: 0, tac: 0 };
    const num = (x) => (x === true ? 1 : x === false || x == null ? 0 : +x || 0);

    // --- IK à deux os (bras) ---
    const tmp = { s: new THREE.Vector3(), e: new THREE.Vector3(), w: new THREE.Vector3(), v: new THREE.Vector3(), u: new THREE.Vector3(), n: new THREE.Vector3(), m0: new THREE.Matrix4(), m1: new THREE.Matrix4(), pq: new THREE.Quaternion(), wq: new THREE.Quaternion() };
    const basisQuat = (d0, n0, d1, n1, out) => {
      const b0 = vcross(d0, n0), b1 = vcross(d1, n1);
      tmp.m0.set(d0[0], n0[0], b0[0], 0, d0[1], n0[1], b0[1], 0, d0[2], n0[2], b0[2], 0, 0, 0, 0, 1);
      tmp.m1.set(d1[0], n1[0], b1[0], 0, d1[1], n1[1], b1[1], 0, d1[2], n1[2], b1[2], 0, 0, 0, 0, 1);
      tmp.m1.multiply(tmp.m0.transpose());
      return out.setFromRotationMatrix(tmp.m1);
    };
    const setWorldQuat = (bone, worldQ) => {
      bone.parent.getWorldQuaternion(tmp.pq);
      bone.quaternion.copy(tmp.pq.invert().multiply(worldQ));
      bone.updateMatrixWorld(true);
    };
    // Place le poignet en W (monde) ; pole = direction indicative du coude (monde)
    function solveArm(S, target, pole, handQ) {
      const sx = S === 'L' ? 1 : -1;
      const up = B['arm' + S], fo = B['fore' + S], ha = B['hand' + S];
      up.getWorldPosition(tmp.s);
      const a = L_UPPER, b = L_FORE;
      const sV = [tmp.s.x, tmp.s.y, tmp.s.z], wV = [target.x, target.y, target.z];
      let dv = vsub(wV, sV);
      let D = clamp(vlen(dv), Math.abs(a - b) + 1e-3, a + b - 1e-3);
      const u = vnorm(dv);
      let pv = vsub(pole, vscale(u, vdot(pole, u)));
      if (vlen(pv) < 1e-5) pv = [0, -1, 0];
      pv = vnorm(pv);
      const cosA = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
      const E = vadd(sV, vadd(vscale(u, a * cosA), vscale(pv, a * sinA)));
      const Wp = vadd(sV, vscale(u, D));
      const d0 = [ARM_DIR[0] * sx, ARM_DIR[1], 0];
      const n0 = vnorm(vsub([1, 0, 0], vscale(d0, d0[0])));
      const dUp = vnorm(vsub(E, sV)), dFo = vnorm(vsub(Wp, E));
      let n1 = vcross(dFo, dUp);
      if (vlen(n1) < 1e-5) n1 = vcross(dUp, pv);
      n1 = vnorm(n1);
      const nUp = vnorm(vsub(n1, vscale(dUp, vdot(n1, dUp)))), nFo = vnorm(vsub(n1, vscale(dFo, vdot(n1, dFo))));
      setWorldQuat(up, basisQuat(d0, n0, dUp, nUp, tmp.wq));
      setWorldQuat(fo, basisQuat(d0, n0, dFo, nFo, tmp.wq));
      if (handQ) setWorldQuat(ha, handQ);
    }
    // Cible d'une main exprimée par la pose voulue de son ancre (position + orientation monde)
    const anchorInv = (name) => { const a = anchors[name]; return { p: a.position.clone(), qi: a.quaternion.clone().invert() }; };
    const AR = anchorInv('rightHand'), AL = anchorInv('leftHand');
    function placeHand(S, anchorPos, anchorQuat, pole) {
      const A = S === 'R' ? AR : AL;
      const handQ = anchorQuat.clone().multiply(A.qi);
      const wrist = anchorPos.clone().sub(A.p.clone().applyQuaternion(handQ));
      solveArm(S, wrist, pole, handQ);
    }

    // Poses d'arme dans le repère du personnage (objet racine) : poignée de la main droite, tangage, lacet.
    // La visée verticale fait pivoter l'arme autour de l'épaule droite ; l'accroupissement la descend avec le bassin.
    const POSES = {
      low: { r: [-0.13, 1.14, 0.18], pitch: -0.55, yaw: 0.42 },
      aim: { r: [-0.072, 1.522, 0.27], pitch: 0.0, yaw: 0.03 },
      // sprint : arme en travers de la poitrine, canon vers le haut et la gauche (port d'arme)
      sprint: { r: [-0.15, 1.1, 0.22], pitch: 0.72, yaw: 0.62 },
      // sprint tactique : arme dans la main droite, canon vers le ciel, main gauche libre
      tac: { r: [-0.2, 1.33, 0.14], pitch: 1.25, yaw: -0.08 }
    };
    const PIVOT = [-0.1, 1.45, 0.0];
    const FOREGRIP_DEFAULT = [0.004, 0.014, 0.26];   // garde-main par défaut, devant la poignée (repère de l'arme)
    const rootM = new THREE.Matrix4(), rootQ = new THREE.Quaternion(), vA = new THREE.Vector3(), qB = new THREE.Quaternion(), eA = new THREE.Euler();
    function weaponPose(blendAim, look, hipOff, wSpr, wTac, pump) {
      const lo = POSES.low, ai = POSES.aim, t = blendAim;
      let r = vlerp(lo.r, ai.r, t);
      let pitch = lerp(lo.pitch, ai.pitch, t), yaw = lerp(lo.yaw, ai.yaw, t);
      if (wSpr > 0) { r = vlerp(r, POSES.sprint.r, wSpr); pitch = lerp(pitch, POSES.sprint.pitch, wSpr); yaw = lerp(yaw, POSES.sprint.yaw, wSpr); }
      if (wTac > 0) { r = vlerp(r, POSES.tac.r, wTac); pitch = lerp(pitch, POSES.tac.pitch, wTac); yaw = lerp(yaw, POSES.tac.yaw, wTac); }
      // l'arme suit le rythme de la course (pompage) en sprint
      r = vadd(r, [0, pump[0], 0]); pitch += pump[1]; yaw += pump[2];
      const lk = look * (0.35 + 0.65 * t) * (1 - wSpr) * (1 - wTac);
      // rotation de visée autour du pivot d'épaule
      const rel = vsub(r, PIVOT), cp = Math.cos(lk), sp = Math.sin(lk);
      const relR = [rel[0], rel[1] * cp + rel[2] * sp, -rel[1] * sp + rel[2] * cp];
      const loc = vadd(vadd(PIVOT, relR), hipOff);
      api.object.updateMatrixWorld(true);
      rootM.copy(api.object.matrixWorld);
      api.object.getWorldQuaternion(rootQ);
      eA.set(-(pitch + lk), yaw, 0, 'YXZ');
      qB.setFromEuler(eA);
      const wq = rootQ.clone().multiply(qB);
      vA.set(loc[0], loc[1], loc[2]).applyMatrix4(rootM);
      let lp;
      if (st.foregrip) { st.foregrip.updateMatrixWorld(true); lp = st.foregrip.getWorldPosition(new THREE.Vector3()); }
      else lp = vA.clone().add(new THREE.Vector3(FOREGRIP_DEFAULT[0], FOREGRIP_DEFAULT[1], FOREGRIP_DEFAULT[2]).applyQuaternion(wq));
      return { rp: vA.clone(), lp: lp, wq: wq };
    }

    // Oriente cuisse et tibia vers des directions voulues (repère du personnage) ; le genou plie autour de l'axe x local.
    const qT = new THREE.Quaternion(), qS = new THREE.Quaternion(), qSave = new THREE.Quaternion(), qSave2 = new THREE.Quaternion();
    function aimLeg(S, dThigh, dShin, w) {
      api.object.getWorldQuaternion(rootQ);
      const toW = (d) => { const v = new THREE.Vector3(d[0], d[1], d[2]).normalize().applyQuaternion(rootQ); return [v.x, v.y, v.z]; };
      const d1 = toW(dThigh), d2 = toW(dShin);
      let n = vcross(d1, d2);
      if (vlen(n) < 0.05) { const xw = toW([1, 0, 0]); n = vsub(xw, vscale(d1, vdot(xw, d1))); }
      n = vnorm(n);
      const n2 = vnorm(vsub(n, vscale(d2, vdot(n, d2))));
      const th = B['thigh' + S], sh = B['shin' + S];
      qSave.copy(th.quaternion); qSave2.copy(sh.quaternion);
      setWorldQuat(th, basisQuat([0, -1, 0], [1, 0, 0], d1, vnorm(vsub(n, vscale(d1, vdot(n, d1)))), qT));
      setWorldQuat(sh, basisQuat([0, -1, 0], [1, 0, 0], d2, n2, qS));
      if (w < 0.999) { th.quaternion.copy(qSave.slerp(th.quaternion, w)); sh.quaternion.copy(qSave2.slerp(sh.quaternion, w)); th.updateMatrixWorld(true); }
    }
    function slideLegs(w, T) {
      api.object.updateMatrixWorld(true);
      // la jambe tendue rebondit légèrement au contact du sol au début de la glissade
      const b = Math.exp(-T * 9) * Math.sin(T * 28) * 0.05;
      const R0 = SLIDE_LEGS.R, L0 = SLIDE_LEGS.L;
      aimLeg('R', [R0.thigh[0], R0.thigh[1] + b, R0.thigh[2]], [R0.shin[0], R0.shin[1] + b * 0.5, R0.shin[2]], w);
      aimLeg('L', L0.thigh, L0.shin, w);
    }

    function update(dt, params) {
      if (params) Object.assign(P, params);
      dt = clamp(dt || 0, 0, 0.25);   // lissages exponentiels : stables même à faible cadence
      st.time += dt;
      const k = (rate) => 1 - Math.exp(-dt * rate);
      const spd = Math.abs(P.speed || 0);
      st.speed += (spd - st.speed) * k(6);
      st.crouch += ((P.crouch ? 1 : 0) - st.crouch) * k(7);
      st.aim += ((P.aim ? 1 : 0) - st.aim) * k(9);
      st.armed += (((P.armed || P.aim) ? 1 : 0) - st.armed) * k(7);
      st.air += ((P.onGround === false ? 1 : 0) - st.air) * k(10);
      st.lookPitch += ((P.lookPitch || 0) - st.lookPitch) * k(12);
      st.lookYaw += (clamp(P.lookYaw || 0, -1.1, 1.1) - st.lookYaw) * k(12);
      st.slide += (clamp(num(P.slide), 0, 1) - st.slide) * k(30);
      st.slideT = P.slideT || 0;
      st.sprint += (clamp(num(P.sprint), 0, 1) - st.sprint) * k(20);
      st.tac += (clamp(num(P.tac), 0, 1) - st.tac) * k(20);
      st.turn += ((P.turn || 0) - st.turn) * k(5);
      st.hitT += dt;
      if (st.dead) st.deathT += dt;

      for (const n in R) { R[n][0] = 0; R[n][1] = 0; R[n][2] = 0; }
      const v = st.speed, c = st.crouch;
      const wWalk = smooth(0.05, 0.7, v) * (1 - smooth(2.3, 3.8, v)), wRunAll = smooth(2.3, 3.8, v);
      const wSpr = wRunAll * smooth(5.2, 7.0, v), wRun = wRunAll - wSpr, wMove = wWalk + wRunAll;
      const gaits = [[GAIT.walk, wWalk], [GAIT.run, wRun], [GAIT.sprint, wSpr]];
      // un cycle = deux pas ; la cadence suit la vitesse (2,95 pas/s à 5 m/s, 3,25 à 6,65, 3,6 à 8,2)
      st.phase = (st.phase + cadenceAt(v) * (1 + 0.05 * c) * 0.5 * dt * (1 - st.slide)) % 1;
      const amp = 1 - 0.45 * c;
      const t = st.time;

      // ----- jambes -----
      let hipY = 0, hipX = 0, hipYaw = 0, hipRoll = 0;
      const legs = {};
      for (const [S, off, sx] of [['L', 0, 1], ['R', 0.5, -1]]) {
        const ph = st.phase + off;
        let hip = 0, knee = 0.06, foot = 0, toe = 0;
        for (const [g, w] of gaits) {
          if (w <= 0) continue;
          hip += g.hip(ph) * w * amp; knee += (g.knee(ph) - 0.07) * w * amp; foot += cyc(g.foot, ph) * w * amp; toe += g.toe(ph) * w * amp;
        }
        // repos : genoux souples, léger transfert de poids
        const idle = 1 - wMove;
        hip += idle * 0.09; knee += idle * (0.17 + 0.02 * Math.sin(t * 0.7 + off * 3));
        // accroupi
        hip += c * 1.3; knee += c * 1.9;
        // en l'air : jambes repliées
        hip += st.air * (0.5 + (sx > 0 ? 0.25 : 0)); knee += st.air * (0.95 + (sx > 0 ? 0.3 : 0));
        legs[S] = { hip: hip, knee: knee, foot: foot, toe: toe, sx: sx };
      }
      for (const [g, w] of gaits) {
        if (w <= 0) continue;
        const ph = st.phase;
        hipY += -g.bob * Math.cos(2 * TAU * ph) * w * amp;
        hipX += g.sway * Math.sin(TAU * ph) * w * amp;
        hipYaw += -g.yaw * Math.cos(TAU * ph) * w * amp;
        hipRoll += g.roll * Math.sin(TAU * ph) * w * amp;
      }
      hipY += -0.04 * wRun - 0.055 * wSpr - 0.008 * wWalk - 0.335 * c - 0.016 * (1 - wMove) + 0.0025 * Math.sin(t * TAU / 3.6) * (1 - wMove);
      hipX += 0.008 * Math.sin(t * 0.7) * (1 - wMove);
      const stance = (1 - wMove) * 0.065 + 0.1 * c;       // appuis écartés au repos et accroupi
      for (const S of ['L', 'R']) {
        const L = legs[S];
        set('thigh' + S, -L.hip, 0, stance * L.sx);
        set('shin' + S, L.knee, 0, 0);
        set('foot' + S, L.foot + L.hip - L.knee, 0, -stance * L.sx);   // pied à plat, puis profil de pas
        set('toes' + S, L.toe, 0, 0);
      }

      // ----- bassin et colonne -----
      const lean = (GAIT.walk.lean * wWalk + GAIT.run.lean * wRun + GAIT.sprint.lean * wSpr) + 0.6 * c;
      const turnLean = clamp(-st.turn * v * 0.03, -0.18, 0.18);
      set('hips', 0, hipYaw, hipRoll + turnLean);
      const idleW = 1 - wMove, br = Math.sin(t * TAU / 3.6);
      set('spine', lean * 0.55 + idleW * (0.035 + 0.012 * br), -hipYaw * 0.8, -hipRoll * 0.6);
      set('chest', lean * 0.45 + idleW * -0.045 + 0.022 * br, -hipYaw * 0.9, -hipRoll * 0.4);   // poitrine sortie
      set('neck', -lean * 0.45 - idleW * 0.035, hipYaw * 0.4, 0);
      set('head', -lean * 0.45 + 0.055 * (1 - st.aim), hipYaw * 0.5, 0);   // menton légèrement rentré, regard droit
      // arme : buste de profil (épaule gauche en avant), tête qui revient dans l'axe et se pose sur la crosse
      const aw = st.armed * (st.dead ? 0 : 1), am = st.aim * aw;
      set('spine', 0, -0.06 * aw - 0.14 * am, 0);
      set('chest', 0, -0.08 * aw - 0.2 * am, 0);
      set('neck', 0.05 * am, 0.07 * aw + 0.15 * am, 0.06 * am);
      set('head', 0.08 * am, 0.07 * aw + 0.19 * am, 0.07 * am);
      set('clavL', 0, -0.12 * am, 0);

      // ----- bras libres (balancement) ; en sprint tactique la main gauche lâche l'arme et pompe -----
      const tacW = st.tac * st.armed * (1 - st.aim);
      const freeS = { L: 1 - st.armed * (1 - tacW), R: 1 - st.armed };
      for (const [S, off, sx] of [['L', 0, 1], ['R', 0.5, -1]]) {
        const ph = st.phase + off, free = freeS[S];
        let ax = 0, fx = 0;
        for (const [g, w] of gaits) {
          if (w <= 0) continue;
          const fwd = (1 - Math.cos(TAU * ph)) / 2;
          ax += (g.arm * Math.cos(TAU * ph) - g.armOff) * w;
          fx += -(g.elbow + g.elbowSwing * fwd) * w;
        }
        const idle = 1 - wMove;
        ax += idle * (-0.05 + 0.012 * Math.sin(t * TAU / 3.6 + off));
        fx += idle * -0.44;
        fx += -0.5 * c;
        const abd = -0.165 * sx * (1 - 0.3 * wRun) + st.air * 0.35 * sx;
        set('arm' + S, ax * free, 0, abd * free);
        set('fore' + S, fx * free, 0, 0);
        // épaules un peu en avant et basses, qui montent à l'inspiration
        set('clav' + S, 0, -0.035 * sx * idle, (-0.03 * idle + 0.018 * Math.sin(t * TAU / 3.6)) * sx);
        // poings serrés
        const curl = lerp(1.0, 1.25, wRun);
        set('fing' + S, 0, 0, -curl * sx);
        set('fing2' + S, 0, 0, -(curl + 0.1) * sx);
        set('thumb' + S, 0, 0.25 * sx, -0.3 * sx);
      }

      // ----- touché (secousse amortie) -----
      if (st.hitT < 0.8) {
        const h = Math.exp(-st.hitT * 7) * (1 - Math.exp(-st.hitT * 45)) * st.hit;
        set('spine', -h * 0.18 * st.hitDir[1], 0, h * 0.12 * st.hitDir[0]);
        set('chest', -h * 0.25 * st.hitDir[1], h * 0.2 * st.hitDir[0], 0);
        set('head', -h * 0.35 * st.hitDir[1], h * 0.3 * st.hitDir[0], 0);
      }

      // ----- glissade : on tire toute la pose vers la pose de glissade -----
      const sw = st.slide * (st.dead ? 0 : 1);
      let hipZ = -0.07 * c;
      if (sw > 0.001) {
        const jit = (0.012 * Math.sin(t * 71) + 0.008 * Math.sin(t * 113)) * sw;   // vibrations du contact au sol
        for (const n in SLIDE_POSE) {
          const isArm = /^(arm|fore|hand|clav)/.test(n);
          const w = isArm ? sw * freeS[n.slice(-1)] : sw;
          if (w <= 0) continue;
          const r = R[n] || (R[n] = [0, 0, 0]), q0 = SLIDE_POSE[n];
          r[0] = lerp(r[0], q0[0], w); r[1] = lerp(r[1], q0[1], w); r[2] = lerp(r[2], q0[2], w);
        }
        set('spine', jit, 0, 0); set('head', -jit * 0.6, 0, 0);
        hipY = lerp(hipY, SLIDE_HIP.y + jit * 0.15, sw); hipX = lerp(hipX, 0, sw); hipZ = lerp(hipZ, SLIDE_HIP.z, sw);
      }
      // regard : haut/bas et côté (la caméra peut tourner pendant que le corps glisse droit devant)
      const lp = st.lookPitch, ly = st.lookYaw;
      set('chest', -lp * 0.3 * (0.4 + 0.6 * st.aim), ly * 0.25, 0);
      set('neck', -lp * 0.3, ly * 0.3, 0);
      set('head', -lp * 0.4, ly * 0.45, 0);

      // ----- mort : genoux qui lâchent puis chute sur le dos -----
      let dw = 0;
      if (st.dead) {
        const T = st.deathT;
        const buckle = smooth(0, 0.35, T), fall = clamp((T - 0.25) / 0.6, 0, 1), f2 = fall * fall;
        dw = smooth(0, 0.15, T);
        const settle = T > 0.85 ? Math.exp(-(T - 0.85) * 9) * Math.sin((T - 0.85) * 30) * 0.04 : 0;
        const deadPose = {
          hips: [-1.42 * f2 + settle, 0.15 * fall, 0.08 * fall], spine: [-0.1 * fall, 0, 0], chest: [-0.1 * fall, 0.1 * fall, 0],
          neck: [0.15 * fall, 0.35 * fall, 0], head: [0.1 * fall, 0.4 * fall, 0.1 * fall],
          thighL: [-0.6 * buckle * (1 - f2) - 0.35 * f2, 0, 0.12 * fall], thighR: [-0.4 * buckle * (1 - f2) - 0.12 * f2, 0, -0.18 * fall],
          shinL: [0.9 * buckle * (1 - f2) + 0.75 * f2, 0, 0], shinR: [0.7 * buckle * (1 - f2) + 0.35 * f2, 0, 0],
          footL: [0.3 * fall, 0, 0.2 * fall], footR: [0.35 * fall, 0, -0.3 * fall],
          armL: [-0.4 * fall, 0, 0.75 * fall], armR: [-0.2 * fall, 0, -1.0 * fall], foreL: [-0.6 * fall, 0, 0], foreR: [-0.3 * fall, 0, 0],
          fingL: [0, 0, -0.5], fing2L: [0, 0, -0.6], fingR: [0, 0, 0.5], fing2R: [0, 0, 0.6]
        };
        for (const n in R) { R[n][0] *= 1 - dw; R[n][1] *= 1 - dw; R[n][2] *= 1 - dw; }
        for (const n in deadPose) { const d = deadPose[n]; set(n, d[0] * dw, d[1] * dw, d[2] * dw); }
        hipY = hipY * (1 - dw) + dw * (-0.33 * buckle - 0.52 * f2 + Math.abs(settle) * 0.5);
        hipX *= 1 - dw;
        B.hips.position.z = bindPos.hips.z - 0.55 * f2 * dw;
      } else B.hips.position.z = bindPos.hips.z + hipZ;

      // ----- application -----
      B.hips.position.y = bindPos.hips.y + hipY;
      B.hips.position.x = bindPos.hips.x + hipX;
      for (const n in R) { const r = R[n]; B[n].quaternion.setFromEuler(e.set(r[0], r[1], r[2], 'XYZ')); }
      for (const n in B) if (!R[n] && n !== 'root') B[n].quaternion.identity();
      if (sw > 0.001) slideLegs(sw, st.slideT);

      // ----- glissade sans arme : main gauche posée au sol derrière la hanche -----
      const plantW = sw * freeS.L * (st.dead ? 0 : 1);
      if (plantW > 0.01) {
        api.object.updateMatrixWorld(true);
        const hp = new THREE.Vector3(SLIDE_HAND_L[0], SLIDE_HAND_L[1], SLIDE_HAND_L[2]).applyMatrix4(api.object.matrixWorld);
        api.object.getWorldQuaternion(rootQ);
        const pole = new THREE.Vector3(0.6, 0.2, -0.8).applyQuaternion(rootQ);
        const hq = rootQ.clone().multiply(qB.setFromEuler(eA.set(0, 0, 0)));
        const save = {}; for (const n of ['armL', 'foreL', 'handL']) save[n] = B[n].quaternion.clone();
        solveArm('L', hp, [pole.x, pole.y, pole.z], null);
        for (const n in save) B[n].quaternion.copy(save[n].slerp(B[n].quaternion, plantW));
      }
      // ----- arme : IK des deux bras vers la poignée et le garde-main -----
      const armedW = st.armed * (1 - dw);
      if (armedW > 0.01) {
        api.object.updateMatrixWorld(true);
        const wSprA = st.sprint * (1 - st.aim) * (1 - tacW) * (1 - sw), wTacA = tacW * (1 - sw);
        const cyc = TAU * st.phase, pumpA = clamp(v / 6.65, 0, 1.3);
        const pump = [0.018 * Math.abs(Math.sin(cyc)) * pumpA * (wSprA + wTacA), 0.05 * Math.sin(cyc) * pumpA * wSprA, 0.06 * Math.sin(cyc) * pumpA * (wSprA + 0.6 * wTacA)];
        const hipOff = [B.hips.position.x - bindPos.hips.x, (B.hips.position.y - bindPos.hips.y) * (1 - sw), (B.hips.position.z - bindPos.hips.z) * (1 - sw)];
        const wp = weaponPose(st.aim, st.lookPitch, hipOff, wSprA, wTacA, pump);
        if (sw > 0.001) {
          // glissade : arme tenue devant la poitrine (repère du buste), canon droit devant, légèrement relevé
          B.chest.updateMatrixWorld(true);
          const cp = new THREE.Vector3(-0.11, -0.04, 0.34).applyMatrix4(B.chest.matrixWorld);
          api.object.getWorldQuaternion(rootQ);
          const sq = rootQ.clone().multiply(qB.setFromEuler(eA.set(-(0.12 + st.lookPitch * 0.5), 0.05, 0, 'YXZ')));
          wp.rp.lerp(cp, sw); wp.wq.slerp(sq, sw);
          if (!st.foregrip) wp.lp.copy(wp.rp).add(new THREE.Vector3(FOREGRIP_DEFAULT[0], FOREGRIP_DEFAULT[1], FOREGRIP_DEFAULT[2]).applyQuaternion(wp.wq));
        }
        const poleR = new THREE.Vector3(-0.9, -0.6 + 0.3 * st.aim, -0.35), poleL = new THREE.Vector3(0.35, -1, -0.15);
        api.object.getWorldQuaternion(rootQ);
        poleR.applyQuaternion(rootQ); poleL.applyQuaternion(rootQ);
        // mélange avec la pose libre : on interpole les quaternions des os du bras
        const save = {};
        for (const n of ['armR', 'foreR', 'handR', 'armL', 'foreL', 'handL']) save[n] = B[n].quaternion.clone();
        placeHand('R', wp.rp, wp.wq, [poleR.x, poleR.y, poleR.z]);
        if (st.weapon) { st.weapon.updateMatrixWorld(true); }
        const lq = wp.wq.clone();
        if (st.foregrip) { const fp = st.weapon ? st.foregrip.getWorldPosition(new THREE.Vector3()) : wp.lp; placeHand('L', fp, lq, [poleL.x, poleL.y, poleL.z]); }
        else placeHand('L', wp.lp, lq, [poleL.x, poleL.y, poleL.z]);
        const wL = armedW * (1 - tacW);
        for (const n in save) { const w = n.endsWith('L') ? wL : armedW; if (w < 0.999) B[n].quaternion.copy(save[n].slerp(B[n].quaternion, w)); }
        // prise : doigts serrés sur la poignée et le garde-main
        const gR = B.fingR.quaternion.clone().setFromEuler(e.set(0, 0, 1.15)), g2R = B.fing2R.quaternion.clone().setFromEuler(e.set(0, 0, 1.25));
        const gL = B.fingL.quaternion.clone().setFromEuler(e.set(0, 0, -1.0)), g2L = B.fing2L.quaternion.clone().setFromEuler(e.set(0, 0, -1.1));
        B.fingR.quaternion.slerp(gR, armedW); B.fing2R.quaternion.slerp(g2R, armedW);
        B.fingL.quaternion.slerp(gL, armedW * (1 - tacW)); B.fing2L.quaternion.slerp(g2L, armedW * (1 - tacW));
      }
      // ----- clignements et regard (tête cuite : paupières en morphing, os des yeux) -----
      if (api.setBlink) {
        st.blinkT -= dt;
        if (st.blinkT <= 0) { st.blinkPh = 1e-4; st.blinkT = 2.0 + 4.5 * Math.random(); }
        let bl = 0;
        if (st.blinkPh > 0) {
          st.blinkPh += dt / 0.17;
          const p = st.blinkPh;
          bl = p < 0.4 ? smooth(0, 0.4, p) : 1 - smooth(0.4, 1, p);
          if (p >= 1) st.blinkPh = 0;
        }
        bl = Math.max(bl, 0.14 * wRun + 0.55 * Math.max(0, 1 - st.hitT * 3.5) * st.hit, 0.1 * st.aim);
        if (st.dead) bl = lerp(bl, 0.78, smooth(0.15, 0.7, st.deathT));
        api.setBlink(clamp(bl, 0, 1));
      }
      if (B.oeilG) {
        st.sacT -= dt;
        if (st.sacT <= 0) { st.sac = [(Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.07]; st.sacT = 0.5 + Math.random() * 2.0; }
        const yaw = st.sac[0] * (1 - 0.7 * st.aim), pit = st.sac[1] * (1 - 0.7 * st.aim) - st.lookPitch * 0.25;
        for (const n of ['oeilG', 'oeilD']) B[n].quaternion.setFromEuler(e.set(-pit, yaw, 0));
      }
      api.object.updateMatrixWorld(true);
      return st;
    }

    api.update = update;
    api.anchors = anchors;
    api.poses = { slide: SLIDE_POSE, slideHip: SLIDE_HIP, weapon: POSES };   // réglages des poses (lecture et retouche)
    api.state = st;
    api.params = P;
    /** Arme tenue : objet attaché à anchors.rightHand ; foregrip = Object3D placé sur le garde-main (facultatif) */
    // Vue FPS : les objets accrochés au corps (arme tenue, casque, sac…) doivent disparaître pour la caméra
    // tout en gardant leur ombre. On travaille sur des copies de leurs matériaux : un matériau partagé avec
    // l'arme vue en FPS (modèle cloné, par exemple) n'est jamais touché.
    let firstPerson = false;
    const fpClone = (m) => { const c = m.clone(); c.colorWrite = false; c.depthWrite = false; return c; };
    function hideForCamera(obj, on) {
      if (!obj) return;
      obj.traverse((o) => {
        if (!o.material) return;
        if (on) {
          if (!o.userData.mat3p) { o.userData.mat3p = o.material; o.material = Array.isArray(o.material) ? o.material.map(fpClone) : fpClone(o.material); }
        } else if (o.userData.mat3p) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
          o.material = o.userData.mat3p; delete o.userData.mat3p;
        }
      });
    }
    function attachedObjects() {
      const list = [];
      for (const k in anchors) for (const c of anchors[k].children) list.push(c);
      return list;
    }
    api.setWeapon = function (obj, foregrip) {
      if (st.weapon && st.weapon.parent === anchors.rightHand) { hideForCamera(st.weapon, false); anchors.rightHand.remove(st.weapon); }
      st.weapon = obj || null; st.foregrip = foregrip || null;
      if (obj) { anchors.rightHand.add(obj); if (firstPerson) hideForCamera(obj, true); }
    };
    api.hit = function (dirX, dirZ, strength) {
      // direction d'où vient le coup, dans le repère du personnage (x gauche, z avant)
      const l = Math.hypot(dirX || 0, dirZ || 1) || 1;
      st.hitDir = [(dirX || 0) / l, (dirZ == null ? 1 : dirZ) / l];
      st.hit = strength == null ? 1 : strength; st.hitT = 0;
    };
    /** Vue FPS du joueur : corps invisible pour la caméra mais toujours projeté dans l'ombre (le rendu des ombres ignore colorWrite). */
    api.setFirstPerson = function (on) {
      firstPerson = !!on;
      for (const k in api.materials) {
        const m = api.materials[k];
        if (m.userData.dw0 === undefined) m.userData.dw0 = m.depthWrite;
        m.colorWrite = !on; m.depthWrite = on ? false : m.userData.dw0;
      }
      // arme tenue et tout objet accroché aux ancres (rappeler setFirstPerson(true) après en avoir accroché un nouveau)
      for (const o of attachedObjects()) hideForCamera(o, firstPerson);
    };
    api.die = function () { if (!st.dead) { st.dead = true; st.deathT = 0; } };
    api.revive = function () { st.dead = false; st.deathT = 0; };
    api.reset = function () {
      st.phase = 0; st.speed = 0; st.crouch = 0; st.aim = 0; st.armed = 0; st.air = 0; st.dead = false; st.deathT = 0; st.hitT = 9;
      st.slide = 0; st.slideT = 0; st.sprint = 0; st.tac = 0; st.lookYaw = 0;
      Object.assign(P, { speed: 0, crouch: false, aim: false, armed: false, onGround: true, lookPitch: 0, lookYaw: 0, turn: 0, slide: 0, slideT: 0, sprint: 0, tac: 0 });
      update(0);
    };
    update(0);
  }

  // ============================================================================================
  // Bras en vue FPS : mêmes manches de veste (gauche arrachée, bandage) et mêmes mitaines,
  // 15 phalanges par main, préréglages de prise, IK à deux os vers des ancres posées sur l'arme.
  // Repère caméra : X à droite, Y en haut, la caméra regarde vers -Z. À ajouter comme enfant de la caméra.
  // ============================================================================================
  // Doigts : [nom, décalage vertical, recul de l'articulation, longueurs des 3 phalanges, rayon]
  const FPS_FINGERS = [
    ['index', 0.031, -0.004, [0.040, 0.025, 0.020], 0.0094],
    ['middle', 0.0105, 0.0, [0.044, 0.028, 0.021], 0.0098],
    ['ring', -0.0105, -0.003, [0.041, 0.026, 0.020], 0.0092],
    ['pinky', -0.029, -0.012, [0.032, 0.020, 0.017], 0.0082]
  ];
  // Prises : angles de flexion (rad) des phalanges [p1, p2, p3] par doigt ; pouce [flexion, opposition, p2, p3]
  // Prises : flexion (rad) des phalanges [p1, p2, p3] par doigt ; pouce [flexion à la base, opposition, p2, p3]
  const GRIPS = {
    relaxed: { index: [0.25, 0.35, 0.2], middle: [0.3, 0.45, 0.25], ring: [0.35, 0.5, 0.3], pinky: [0.4, 0.55, 0.3], thumb: [0.15, 0.45, 0.15, 0.1] },
    rifle: { index: [0.55, 0.75, 0.35], middle: [1.35, 1.45, 0.8], ring: [1.4, 1.45, 0.8], pinky: [1.45, 1.4, 0.75], thumb: [0.45, 1.0, 0.5, 0.35] },
    support: { index: [0.85, 0.9, 0.5], middle: [0.95, 0.95, 0.55], ring: [1.0, 1.0, 0.55], pinky: [1.05, 1.0, 0.5], thumb: [0.0, 0.3, 0.1, 0.05] },
    pistol: { index: [0.45, 0.6, 0.3], middle: [1.4, 1.5, 0.85], ring: [1.45, 1.5, 0.85], pinky: [1.5, 1.45, 0.8], thumb: [0.5, 1.05, 0.4, 0.3] },
    fist: { index: [1.5, 1.6, 0.9], middle: [1.55, 1.6, 0.9], ring: [1.55, 1.6, 0.9], pinky: [1.55, 1.55, 0.85], thumb: [0.65, 1.15, 0.75, 0.6] },
    open: { index: [0.05, 0.05, 0.02], middle: [0.05, 0.05, 0.02], ring: [0.06, 0.06, 0.02], pinky: [0.08, 0.06, 0.03], thumb: [-0.1, 0.1, 0.05, 0.02] }
  };

  function createSurvivorArms(THREE, options) {
    const O = Object.assign({ shadows: false, renderer: null, shoulderL: [-0.17, -0.235, -0.03], shoulderR: [0.19, -0.25, 0.05] }, options || {});
    const linear = O.linearColors != null ? O.linearColors : wantsLinear(THREE, O.renderer);
    const SW = 0.19, SD = 0.24, SB = 0.0;  // pose de référence symétrique ; épaules réelles réglées après liaison
    // squelette de référence (côté gauche x < 0 ; le droit par symétrie), bras tendus vers -Z, pouces en haut
    const T = { root: [null, 0, 0, 0] };
    const thumbD1 = vnorm([0.32, 0.38, -0.87]), thumbD2 = vnorm([0.18, 0.2, -0.96]);
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const X = -SW * sx;
      const sh = [X, -SD, SB], el = [X, -SD, SB - L_UPPER], wr = [X, -SD, SB - L_UPPER - L_FORE];
      T['arm' + S] = ['root', sh[0], sh[1], sh[2]];
      T['fore' + S] = ['arm' + S, el[0], el[1], el[2]];
      T['hand' + S] = ['fore' + S, wr[0], wr[1], wr[2]];
      for (const [f, dy, back, len] of FPS_FINGERS) {
        let z = wr[2] - (L_PALM + back);
        T[f + '1' + S] = ['hand' + S, X, wr[1] + dy, z];
        z -= len[0]; T[f + '2' + S] = [f + '1' + S, X, wr[1] + dy, z];
        z -= len[1]; T[f + '3' + S] = [f + '2' + S, X, wr[1] + dy, z];
      }
      const cmc = vadd(wr, [0.012 * sx, 0.024, -0.022]);
      const mcp = vadd(cmc, vscale([thumbD1[0] * sx, thumbD1[1], thumbD1[2]], 0.04));
      const ip = vadd(mcp, vscale([thumbD2[0] * sx, thumbD2[1], thumbD2[2]], 0.032));
      T['thumb1' + S] = ['hand' + S, cmc[0], cmc[1], cmc[2]];
      T['thumb2' + S] = ['thumb1' + S, mcp[0], mcp[1], mcp[2]];
      T['thumb3' + S] = ['thumb2' + S, ip[0], ip[1], ip[2]];
    }
    const sk = makeSkeleton(THREE, T);
    const I = sk.index, Wd = sk.world;
    const bd = new Builder(THREE);

    const sleeveColor = (P, s, ang, torn, end) => {
      let c = mixc(PAL.jacket, PAL.jacketLight, fbm(P[0] * 9 + 3, P[1] * 9, P[2] * 9, 21) * 0.7);
      c = mixc(c, PAL.jacketDark, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 23) * 0.35);
      c = mixc(c, PAL.seam, gauss(wrapPi(ang), Math.PI, 0.03) * 0.6);            // couture sous la manche
      c = mixc(c, PAL.jacketLight, gauss(s, L_UPPER, 0.03) * 0.45);              // coude usé
      c = mixc(c, PAL.jacketDark, smooth(end - 0.06, end, s) * (torn ? 0.5 : 0.45));
      c = mixc(c, PAL.mud, smooth(0.6, 0.85, fbm(P[0] * 14, P[1] * 14, P[2] * 14, 25)) * 0.3);
      if (!torn) c = mixc(c, PAL.blood, smooth(0.25, 0.6, gauss(s, 0.39, 0.02) * gauss(wrapPi(ang), 0.8, 0.3) * vnoise(s * 90, ang * 6, 1, 27) * 2) * 0.8);
      return c;
    };
    const gloveCol = (P) => mixc(mixc(PAL.glove, hexc(0x433a33), fbm(P[0] * 90, P[1] * 90, P[2] * 90, 121) * 0.6), PAL.dust, smooth(0.65, 0.85, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 123)) * 0.3);
    const skinCol = (P, k) => mixc(mixc(mixc(PAL.skin, PAL.skinShade, 0.1 + fbm(P[0] * 60, P[1] * 60, P[2] * 60, 71) * 0.5), PAL.skinRed, smooth(0.5, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 72)) * 0.35), PAL.mud, (k || 0) + smooth(0.55, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 73)) * 0.3);

    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const mir = sx < 0;
      const sh = [-SW, -SD, SB], end = vadd(sh, [0, 0, -0.7]);
      const wristS = L_UPPER + L_FORE, torn = S === 'L', sleeveEnd = torn ? 0.37 : L_UPPER + 0.026;   // gauche arrachée, droite retroussée
      const armW = (s) => {
        const t1 = smooth(L_UPPER - 0.05, L_UPPER + 0.05, s), t2 = smooth(wristS - 0.03, wristS + 0.03, s);
        return [[I['arm' + S], 1 - t1], [I['fore' + S], t1 * (1 - t2)], [I['hand' + S], t2]];
      };
      // manche (le haut du bras reste hors champ ; on la garde pour les gestes amples)
      bd.loft('veste', {
        a: sh, b: end, front: [0, 1, 0], mirror: mir, seg: 28, step: 0.014, s0: -0.06, s1: sleeveEnd,
        rings: [{ s: -0.06, w: 0.075, d: 0.077 }, { s: 0.06, w: 0.073, d: 0.072 }, { s: 0.15, w: 0.07, d: 0.068 }, { s: 0.26, w: 0.063, d: 0.061 },
          { s: L_UPPER, w: 0.061, d: 0.062 }, { s: 0.36, w: 0.059, d: 0.057 }, { s: 0.48, w: 0.052, d: 0.048 }, { s: wristS - 0.02, w: 0.052, d: 0.049 }],
        radius: (s, ang) => 1 + 0.06 * Math.sin(ang * 3 + s * 45) * gauss(s, L_UPPER, 0.035) + 0.025 * Math.sin(ang * 2 + s * 30) * gauss(s, 0.45, 0.04),
        hem1: torn ? (ang) => 0.012 + 0.03 * Math.abs(Math.sin(ang * 2.5 + 0.7)) * vnoise(ang * 5, 2, 3, 61) + 0.025 * gauss(wrapPi(ang), -1.6, 0.4) : undefined,
        hemDepth1: 0.06,
        weights: (s) => armW(s),
        color: (P, s, ang) => sleeveColor(P, s, ang, torn, sleeveEnd)
      });
      if (!torn) {
        // revers de la manche retroussée
        bd.loft('veste', {
          a: sh, b: end, front: [0, 1, 0], mirror: mir, seg: 26, step: 0.007, s0: L_UPPER - 0.006, s1: L_UPPER + 0.046,
          rings: [{ s: L_UPPER - 0.006, w: 0.064, d: 0.065 }, { s: L_UPPER + 0.02, w: 0.07, d: 0.07 }, { s: L_UPPER + 0.046, w: 0.063, d: 0.063 }],
          radius: (s, ang) => 1 + 0.035 * Math.sin(ang * 4 + s * 50) + 0.04 * Math.sin(ang * 7 + 1.3),
          weights: (s) => armW(s),
          color: (P, s) => mixc(mixc(PAL.jacketLight, PAL.khaki, 0.35), PAL.jacketDark, gauss(s, L_UPPER + 0.02, 0.006) * 0.5 + fbm(P[0] * 40, P[1] * 40, P[2] * 40, 63) * 0.25)
        });
      }
      // avant-bras nus et musclés : veines, éraflures, longue cicatrice sur le droit
      bd.loft('skin', {
        a: sh, b: end, front: [0, 1, 0], mirror: mir, seg: 36, step: 0.007, s0: L_UPPER - 0.02, s1: wristS + 0.012,
        rings: [{ s: L_UPPER - 0.02, w: 0.051, d: 0.051 }, { s: 0.34, w: 0.047, d: 0.05 }, { s: 0.42, w: 0.038, d: 0.043 }, { s: 0.49, w: 0.03, d: 0.036 }, { s: wristS + 0.012, w: 0.026, d: 0.032 }],
        // relief : masse des extenseurs et du long supinateur, fléchisseurs, tendons du poignet, tête de l'ulna, veines
        displace: (P, s, ang, r, radial) => {
          const a = wrapPi(ang);
          let d = 0.0042 * gauss(s, 0.335, 0.04) * gauss(a, 0.85, 0.55) + 0.003 * gauss(s, 0.35, 0.05) * gauss(a, 2.4, 0.6);
          d += 0.0016 * gauss(s, 0.44, 0.05) * gauss(a, -0.3, 0.5);
          let ten = 0;
          for (let k = -1; k <= 1; k++) ten += gauss(wrapPi(a - (Math.PI + k * 0.28)), 0, 0.05);
          d += 0.0008 * ten * smooth(0.46, 0.51, s) * smooth(wristS + 0.01, wristS - 0.01, s);
          d += 0.0016 * gauss(s, wristS - 0.012, 0.009) * gauss(a, -1.25, 0.3);
          const vein = 1 - smooth(0.0, 0.05, Math.abs(vnoise(s * 32, ang * 2.3, mir ? -1 : 1, 77) - 0.5));
          d += 0.0006 * vein * smooth(-0.2, 0.6, Math.cos(ang - 1.2)) * smooth(0.33, 0.4, s);
          return radialD(radial, d);
        },
        weights: (s) => armW(s),
        color: (P, s, ang) => {
          let c = mixc(skinCol(P), PAL.skinRed, smooth(0.65, 0.8, vnoise(s * 120, ang * 3, 1, 75)) * gauss(s, 0.37, 0.025) * 0.8);
          c = mixc(c, mulc(PAL.skinShade, 0.92), smooth(0.2, 0.9, Math.cos(ang)) * 0.22);                       // dessus plus hâlé
          c = mixc(c, hexc(0xd2a690), smooth(-0.3, -0.9, Math.cos(ang)) * 0.25);                                 // face interne plus pâle
          c = mixc(c, mulc(PAL.skinShade, 0.7), smooth(0.55, 0.9, vnoise(s * 500, ang * 18, 3, 79)) * smooth(0.3, 0.9, Math.cos(ang)) * 0.25); // pilosité
          const inner = smooth(-0.2, 0.6, Math.cos(ang - 1.2));
          const vein = 1 - smooth(0.0, 0.06, Math.abs(vnoise(s * 32, ang * 2.3, mir ? -1 : 1, 77) - 0.5));
          c = mixc(c, hexc(0x8a7a86), vein * inner * smooth(0.33, 0.4, s) * 0.3);
          if (!torn) c = mixc(c, hexc(0xe0b2a2), (1 - smooth(0.04, 0.09, Math.abs(wrapPi(ang - (0.9 + (s - 0.36) * 3))))) * smooth(0.355, 0.365, s) * smooth(0.475, 0.465, s) * 0.85);
          return c;
        }
      });
      if (torn) {
        bd.loft('veste', {
          a: sh, b: end, front: [0, 1, 0], mirror: mir, seg: 20, step: 0.007, s0: 0.43, s1: 0.505,
          rings: [{ s: 0.43, w: 0.042, d: 0.048 }, { s: 0.47, w: 0.037, d: 0.0445 }, { s: 0.505, w: 0.033, d: 0.04 }],
          radius: (s, ang) => 1 + 0.03 * Math.sin((s * 70 + ang / TAU) * TAU),
          weights: (s) => armW(s),
          color: (P, s, ang) => {
            let c = mixc(PAL.bandage, mulc(PAL.bandage, 0.8), fbm(s * 60, ang * 2, 1, 81) * 0.6);
            const wrap = ((s * 70 + ang / TAU) % 1 + 1) % 1;
            c = mixc(c, mulc(PAL.bandage, 0.72), smooth(0.9, 0.97, wrap));
            const bl = gauss(wrapPi(ang), -2.4, 0.5) * gauss(s, 0.465, 0.015);
            return mixc(c, PAL.blood, smooth(0.25, 0.6, bl * (0.7 + 0.6 * vnoise(s * 200, ang * 8, 2, 83))));
          }
        });
      }
      // paume (mitaine)
      const wr = [-SW, -SD, SB - wristS];
      const hw = (s) => { const t = smooth(-0.02, 0.015, s); return [[I['fore' + S], 1 - t], [I['hand' + S], t]]; };
      bd.loft('cuir', {
        a: wr, b: vadd(wr, [0, 0, -0.2]), front: [0, 1, 0], mirror: mir, seg: 24, step: 0.008, s0: -0.016, s1: L_PALM + 0.004,
        rings: [{ s: -0.016, w: 0.03, d: 0.032, n: 2.2 }, { s: 0.004, w: 0.029, d: 0.034, n: 2.4 }, { s: 0.016, w: 0.023, d: 0.038, n: 2.8 },
          { s: 0.045, wL: 0.018, wR: 0.016, d: 0.043, n: 3.2 }, { s: 0.078, wL: 0.017, wR: 0.015, d: 0.045, n: 3.2 }, { s: L_PALM + 0.004, w: 0.013, d: 0.043, n: 3 }],
        cap1: true,
        weights: (s) => hw(s),
        color: (P, s) => mixc(gloveCol(P), mulc(PAL.glove, 0.65), gauss(s, 0.006, 0.004) + gauss(s, 0.03, 0.002) * 0.4)
      });
      // coques de jointures sur le dos de la mitaine
      for (const [f, dy, back, len, r0] of FPS_FINGERS) {
        const k0 = Wd[f + '1L'];
        let p = [k0[0] - 0.0152, k0[1], k0[2] + 0.006];
        const bk = [-1, 0, 0], dirF = [0, 0, -1];
        let X = bk, Z = vcross(bk, dirF);
        if (mir) { p = [-p[0], p[1], p[2]]; X = [1, 0, 0]; Z = vcross(X, dirF); }
        const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...X), new THREE.Vector3(...dirF), new THREE.Vector3(...Z)).setPosition(p[0], p[1], p[2]).multiply(new THREE.Matrix4().makeScale(0.003, 0.0095, r0 * 0.8));
        bd.rigid('cuir', new THREE.SphereGeometry(1, 12, 8), M, I['hand' + S], (P) => mixc(mixc(PAL.glove, hexc(0x5c5148), 0.35), PAL.dust, smooth(0.6, 0.85, fbm(P[0] * 90, P[1] * 90, P[2] * 90, 125)) * 0.3));
      }
      // doigts
      for (const [f, dy, back, len, r0] of FPS_FINGERS) {
        const k0 = Wd[f + '1L'];
        const L1 = len[0], L2 = len[1], L3 = len[2], Lt = L1 + L2 + L3;
        bd.loft('skin', {
          a: k0, b: vadd(k0, [0, 0, -Lt]), front: [0, 1, 0], mirror: mir, seg: 14, step: 0.004, s0: -0.009, s1: Lt,
          rings: [{ s: -0.009, w: r0 * 1.2, d: r0 * 1.12 }, { s: 0.0, w: r0 * 1.14, d: r0 * 1.14 }, { s: 0.027, w: r0 * 1.12, d: r0 * 1.1 },
            { s: 0.031, w: r0 * 0.96, dF: r0 * 0.9, dB: r0 * 1.0 }, { s: L1 * 0.6, w: r0 * 0.94, dF: r0 * 0.88, dB: r0 * 1.02 }, { s: L1, w: r0 * 1.04, d: r0 * 1.0 },
            { s: L1 + L2 * 0.5, w: r0 * 0.88, dF: r0 * 0.84, dB: r0 * 0.96 }, { s: L1 + L2, w: r0 * 0.92, d: r0 * 0.9 }, { s: Lt - 0.008, w: r0 * 0.84, dF: r0 * 0.78, dB: r0 * 0.9 },
            { s: Lt - 0.002, w: r0 * 0.62, d: r0 * 0.62 }, { s: Lt, w: r0 * 0.2, d: r0 * 0.24 }],
          cap0: true, cap1: true,
          // bord épais de la mitaine, rides des jointures, ongle bombé et ses replis
          displace: (P, s, ang, r, radial) => {
            const top = Math.cos(ang);
            let d = 0.0009 * smooth(0.022, 0.026, s) * smooth(0.0295, 0.0275, s);
            d -= 0.00035 * (gauss(s, L1 - 0.002, 0.0008) + gauss(s, L1 + 0.0015, 0.0008) + gauss(s, L1 + L2, 0.0007)) * smooth(0.2, 0.7, top);
            const nailR = smooth(Lt - 0.0165, Lt - 0.0145, s) * smooth(Lt + 0.0005, Lt - 0.0015, s);
            d += 0.00055 * nailR * smooth(0.45, 0.8, top) - 0.00035 * nailR * gauss(top, 0.42, 0.07);
            return radialD(radial, d);
          },
          weights: (s) => {
            const a = smooth(-0.007, 0.006, s), b = smooth(L1 - 0.006, L1 + 0.006, s), c = smooth(L1 + L2 - 0.005, L1 + L2 + 0.005, s);
            return [[I['hand' + S], 1 - a], [I[f + '1' + S], a * (1 - b)], [I[f + '2' + S], b * (1 - c)], [I[f + '3' + S], c]];
          },
          color: (P, s, ang) => {
            if (s < 0.0285) return gloveCol(P);
            let c = skinCol(P, smooth(Lt - 0.02, Lt, s) * 0.25);
            const nail = smooth(Lt - 0.0165, Lt - 0.0145, s) * smooth(0.45, 0.8, Math.cos(ang));     // ongle sur le dessus
            c = mixc(c, mixc(hexc(0xe0aa9c), hexc(0xf0e2d4), smooth(Lt - 0.004, Lt - 0.0012, s)), nail * 0.85);
            c = mixc(c, mulc(PAL.skinShade, 0.8), gauss(s, Lt - 0.0158, 0.0007) * smooth(0.45, 0.8, Math.cos(ang)) * 0.6);   // cuticule
            c = mixc(c, PAL.mud, nail * smooth(Lt - 0.0025, Lt - 0.0005, s) * 0.55);                      // crasse sous l'ongle
            c = mixc(c, mixc(PAL.skinShade, PAL.skinRed, 0.4), (gauss(s, L1, 0.003) + gauss(s, L1 + L2, 0.0025)) * 0.45 * smooth(0.0, 0.6, Math.cos(ang)));  // jointures
            c = mixc(c, PAL.skinRed, smooth(Lt - 0.012, Lt, s) * 0.25);                                     // bout des doigts
            return c;
          }
        });
      }
      // pouce
      const cmc = Wd.thumb1L, mcp = Wd.thumb2L, ipj = Wd.thumb3L;
      const tw = (P) => {
        const s1 = vdot(vsub(P, cmc), thumbD1), s2 = vdot(vsub(P, mcp), thumbD2);
        const a = smooth(-0.01, 0.01, s1), b = smooth(-0.006, 0.006, s1 - 0.04), c = smooth(-0.005, 0.005, s2 - 0.032);
        return [[I['hand' + S], 1 - a], [I['thumb1' + S], a * (1 - b)], [I['thumb2' + S], b * (1 - c)], [I['thumb3' + S], c]];
      };
      bd.loft('cuir', {
        a: cmc, b: vadd(cmc, vscale(thumbD1, 0.06)), front: [0.6, 0.0, 0.8], mirror: mir, seg: 14, step: 0.006, s0: -0.012, s1: 0.044,
        rings: [{ s: -0.012, w: 0.017, d: 0.016 }, { s: 0.0, w: 0.0165, d: 0.016 }, { s: 0.02, w: 0.0145, d: 0.0135 }, { s: 0.044, w: 0.0122, d: 0.0118 }],
        cap0: true, weights: (s, ang, P) => tw(mir ? [-P[0], P[1], P[2]] : P), color: (P) => gloveCol(P)
      });
      bd.loft('skin', {
        a: mcp, b: vadd(mcp, vscale(thumbD2, 0.07)), front: [0.6, 0.0, 0.8], mirror: mir, seg: 12, step: 0.004, s0: -0.004, s1: 0.059,
        rings: [{ s: -0.004, w: 0.0118, d: 0.0112 }, { s: 0.016, w: 0.0108, d: 0.0102 }, { s: 0.032, w: 0.0104, d: 0.0098 }, { s: 0.05, w: 0.0092, d: 0.0088 }, { s: 0.056, w: 0.0062, d: 0.006 }, { s: 0.059, w: 0.0025, d: 0.0025 }],
        cap1: true, weights: (s, ang, P) => tw(mir ? [-P[0], P[1], P[2]] : P),
        color: (P, s, ang) => mixc(skinCol(P), mixc(hexc(0xd9b9a8), PAL.mud, 0.35), smooth(0.044, 0.048, s) * 0.5)
      });
    }

    const MAT = makeMaterials(THREE, {
      skin: { r: 0.5, tex: 'peau', ns: 1.4, sss: true }, veste: { r: 0.92, double: true, tex: 'toile' }, cuir: { r: 0.58, tex: 'cuir', ns: 0.9 }
    }, { renderer: O.renderer, matieres: O.matieres });
    const meshes = bd.build(MAT, linear);
    const object = new THREE.Group();
    object.name = "bras FPS d'Anthony";
    object.add(sk.bones[0]);
    for (const k in meshes) { meshes[k].castShadow = O.shadows; meshes[k].receiveShadow = false; object.add(meshes[k]); }
    object.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(sk.bones);
    for (const k in meshes) meshes[k].bind(skeleton);
    const B = sk.byName;
    // épaules : position réelle (posture « de profil » : épaule gauche plus avancée et rentrée)
    B.armL.position.set(O.shoulderL[0], O.shoulderL[1], O.shoulderL[2]);
    B.armR.position.set(O.shoulderR[0], O.shoulderR[1], O.shoulderR[2]);

    // ancres de prise (même convention que le corps : +Z = avant de l'arme, +Y = haut, origine = poignée / garde-main)
    const anchors = {};
    {
      const r = new THREE.Object3D(); r.name = 'prise main droite';
      r.position.set(-0.016, -0.004, -0.052); r.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      B.handR.add(r); anchors.right = r;
      const l = new THREE.Object3D(); l.name = 'prise main gauche';
      l.position.set(0.02, -0.002, -0.058);
      l.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
      B.handL.add(l); anchors.left = l;
    }
    const AR = { p: anchors.right.position.clone(), qi: anchors.right.quaternion.clone().invert() };
    const AL = { p: anchors.left.position.clone(), qi: anchors.left.quaternion.clone().invert() };

    // IK (repère monde) : direction de référence -Z, charnière du coude ≈ -X (l'avant-bras se replie vers le haut)
    const tmpQ = new THREE.Quaternion(), m0 = new THREE.Matrix4(), m1 = new THREE.Matrix4(), vS = new THREE.Vector3();
    const basisQuat = (d0, n0, d1, n1, out) => {
      const b0 = vcross(d0, n0), b1 = vcross(d1, n1);
      m0.set(d0[0], n0[0], b0[0], 0, d0[1], n0[1], b0[1], 0, d0[2], n0[2], b0[2], 0, 0, 0, 0, 1);
      m1.set(d1[0], n1[0], b1[0], 0, d1[1], n1[1], b1[1], 0, d1[2], n1[2], b1[2], 0, 0, 0, 0, 1);
      return out.setFromRotationMatrix(m1.multiply(m0.transpose()));
    };
    const setWorldQuat = (bone, q) => { bone.parent.getWorldQuaternion(tmpQ); bone.quaternion.copy(tmpQ.invert().multiply(q)); bone.updateMatrixWorld(true); };
    // les directions de référence sont exprimées dans le repère de l'objet : on les passe en monde
    const objQ = new THREE.Quaternion();
    const toWorldDir = (v) => { const t = new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(objQ); return [t.x, t.y, t.z]; };
    function solve(S, wristW, poleW, handQ) {
      const up = B['arm' + S], fo = B['fore' + S], ha = B['hand' + S];
      up.getWorldPosition(vS);
      const sV = [vS.x, vS.y, vS.z], wV = [wristW.x, wristW.y, wristW.z];
      const a = L_UPPER, b = L_FORE;
      const dv = vsub(wV, sV), D = clamp(vlen(dv), Math.abs(a - b) + 1e-3, a + b - 1e-3), u = vnorm(dv);
      let pv = vsub(poleW, vscale(u, vdot(poleW, u)));
      if (vlen(pv) < 1e-6) pv = toWorldDir([0, -1, 0]);
      pv = vnorm(pv);
      const cosA = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
      const E = vadd(sV, vadd(vscale(u, a * cosA), vscale(pv, a * sinA))), Wp = vadd(sV, vscale(u, D));
      const d0 = toWorldDir([0, 0, -1]), n0 = toWorldDir([-1, 0, 0]);
      const dUp = vnorm(vsub(E, sV)), dFo = vnorm(vsub(Wp, E));
      let n1 = vcross(dFo, dUp);
      if (vlen(n1) < 1e-6) n1 = vcross(dUp, pv);
      n1 = vnorm(n1);
      const nUp = vnorm(vsub(n1, vscale(dUp, vdot(n1, dUp)))), nFo = vnorm(vsub(n1, vscale(dFo, vdot(n1, dFo))));
      // référence : les os ont une orientation identité dans le repère de l'objet
      setWorldQuat(up, basisQuat(d0, n0, dUp, nUp, new THREE.Quaternion()).multiply(objQ));
      setWorldQuat(fo, basisQuat(d0, n0, dFo, nFo, new THREE.Quaternion()).multiply(objQ));
      if (handQ) setWorldQuat(ha, handQ);
    }
    const tv = new THREE.Vector3(), tq = new THREE.Quaternion();
    function placeHand(S, target) {
      const A = S === 'R' ? AR : AL;
      target.updateMatrixWorld(true);
      target.getWorldPosition(tv); target.getWorldQuaternion(tq);
      const handQ = tq.clone().multiply(A.qi);
      const wrist = tv.clone().sub(A.p.clone().applyQuaternion(handQ));
      const sx = S === 'L' ? 1 : -1;
      solve(S, wrist, toWorldDir([-0.55 * sx, -1, 0.25]), handQ);
    }
    // doigts
    function applyGrip(S, grip, w) {
      const sx = S === 'L' ? 1 : -1, G = GRIPS[grip] || GRIPS.relaxed;
      for (const [f] of FPS_FINGERS) {
        const a = G[f];
        for (let k = 0; k < 3; k++) { const bn = B[f + (k + 1) + S]; tq.setFromEuler(new THREE.Euler(0, -a[k] * sx * w, 0)); bn.quaternion.slerp(tq, 1); }
      }
      const t = G.thumb;
      // opposition d'abord (vers la paume, autour de l'axe de l'avant-bras), puis flexion
      B['thumb1' + S].quaternion.setFromEuler(new THREE.Euler(0, -t[0] * 0.6 * sx * w, -t[1] * sx * w, 'XYZ'));
      B['thumb2' + S].quaternion.setFromEuler(new THREE.Euler(0, -t[2] * sx * w, 0));
      B['thumb3' + S].quaternion.setFromEuler(new THREE.Euler(0, -t[3] * sx * w, 0));
    }
    // poses de repos (sans arme dans cette main) : bras abaissé hors champ ou main ouverte devant
    const REST = { L: { p: [-0.24, -0.5, -0.12] }, R: { p: [0.24, -0.5, -0.12] } };
    const restTarget = new THREE.Object3D(); object.add(restTarget);
    const state = { left: null, right: null, gripL: 'support', gripR: 'rifle', time: 0 };

    function update(dt, o) {
      o = o || {};
      state.time += dt || 0;
      if ('right' in o) state.right = o.right; if ('left' in o) state.left = o.left;
      if (o.gripRight) state.gripR = o.gripRight; if (o.gripLeft) state.gripL = o.gripLeft;
      object.updateMatrixWorld(true);
      object.getWorldQuaternion(objQ);
      for (const b of sk.bones) b.quaternion.identity();
      object.updateMatrixWorld(true);
      for (const S of ['R', 'L']) {
        const tgt = S === 'R' ? state.right : state.left;
        if (tgt) { placeHand(S, tgt); applyGrip(S, S === 'R' ? state.gripR : state.gripL, 1); }
        else {
          // main libre : poignet ramené bas et sur le côté (hors du champ de vision)
          const p = REST[S].p;
          restTarget.position.set(p[0], p[1] + 0.005 * Math.sin(state.time * 1.7), p[2]);
          restTarget.quaternion.setFromEuler(new THREE.Euler(-0.9, S === 'R' ? 0.25 : -0.25, 0));
          placeHand(S, restTarget);
          applyGrip(S, 'relaxed', 1);
        }
      }
      object.updateMatrixWorld(true);
    }
    let tris = 0;
    for (const k in meshes) tris += meshes[k].geometry.index.count / 3;
    update(0, {});
    return {
      object: object, skeleton: skeleton, bones: B, meshes: meshes, materials: MAT, anchors: anchors,
      grips: Object.keys(GRIPS), update: update,
      setGrip(side, name) { if (side === 'right') state.gripR = name; else state.gripL = name; },
      setTargets(right, left) { state.right = right || null; state.left = left || null; },
      stats: { triangles: Math.round(tris), drawCalls: Object.keys(meshes).length, bones: sk.bones.length },
      dispose() { for (const k in meshes) meshes[k].geometry.dispose(); for (const k in MAT) MAT[k].dispose(); }
    };
  }

  const api = { createSurvivor: createSurvivor };
  if (typeof createEnvironment === 'function') api.createEnvironment = createEnvironment;
  if (typeof createSurvivorArms === 'function') api.createSurvivorArms = createSurvivorArms;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.createSurvivor = createSurvivor; if (api.createSurvivorArms) root.createSurvivorArms = api.createSurvivorArms; root.Survivant = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
