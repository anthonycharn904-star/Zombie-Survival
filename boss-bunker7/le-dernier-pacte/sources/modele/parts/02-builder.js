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
