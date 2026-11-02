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
