/* --------------------------------------------------------------- Terrain --
   Champ de hauteurs (un point tous les 4 m, de -1024 à 5120 m en x et de -1024 à 4096 m en z) :
   collines et dunes, mer de sable et ses crêtes nord-sud à l'ouest, mur de sable au bord ouest,
   plateau des pyramides (+32 m, escarpement raide au sud et à l'est), oued et falaises de la
   nécropole, vallée du Nil (champs, berge, fleuve), oasis ; puis lieux aplanis et routes posées
   avec une pente bornée. La hauteur entre les points suit les deux triangles du maillage dessiné. */
/* Distance signée à un polygone (négative dedans) et normale extérieure du bord le plus proche. */
function owPolySd(poly, x, z, out) {
  let d2 = Infinity, inside = false, nx = 0, nz = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], bx = poly[i][0], bz = poly[i][1];
    if ((bz > z) !== (az > z) && x < ((ax - bx) * (z - bz)) / (az - bz) + bx) inside = !inside;
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1);
    const qx = ax + ex * t - x, qz = az + ez * t - z, q2 = qx * qx + qz * qz;
    if (q2 < d2) { d2 = q2; nx = ez; nz = -ex; }
  }
  if (out) { const l = Math.hypot(nx, nz) || 1; out.nx = nx / l; out.nz = nz / l; }
  return (inside ? -1 : 1) * Math.sqrt(d2);
}
/* Distance d'un point à une polyligne : t (abscisse curviligne), côté (+1 à droite), point le plus proche. */
function owPolylineNear(pts, cum, x, z, out) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], ex = pts[i + 1][0] - ax, ez = pts[i + 1][1] - az, l2 = ex * ex + ez * ez;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1);
    const qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(x - qx, z - qz);
    if (d < best) {
      best = d;
      out.d = d; out.s = cum[i] + Math.sqrt(l2) * t; out.x = qx; out.z = qz;
      out.side = (x - ax) * ez - (z - az) * ex >= 0 ? 1 : -1;
    }
  }
  return out;
}
/* Polyligne lissée (Catmull-Rom), un point tous les `step` m ; longueurs cumulées. */
function owSmoothLine(pts, step) {
  const out = [];
  const P = (i) => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  const cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out, cum, len: cum[cum.length - 1] };
}

/* Relief naturel (avant plateau, oued, Nil, lieux et routes). */
function owNatural(x, z) {
  // collines larges
  let h = 8 + (owFbm(x / 700, z / 700, 3) - 0.5) * 7;
  // dunes ordinaires : crêtes allongées, orientées par le vent du nord-ouest
  const u = x * 0.8 + z * 0.6, v = -x * 0.6 + z * 0.8;
  const r = 1 - Math.abs(2 * owNoise(u / 62, v / 150) - 1);
  h += (r * r - 0.33) * 3.2 + (owFbm(x / 38, z / 38, 2) - 0.5) * 1.6;
  // mer de sable : longues crêtes nord-sud (seifs), plus hautes vers le mur de sable
  const sea = 1 - owSmoothstep(760, 1180, x);
  if (sea > 0) {
    const ph = x / 120 + 0.45 * Math.sin(z / 230 + 1.3) + (owFbm(x / 300, z / 300, 2) - 0.5) * 1.2;
    const crest = Math.pow(1 - Math.abs(Math.sin(Math.PI * ph)), 2.2);
    const amp = lerp(13, 6, clamp((x - 200) / 900, 0, 1));
    h += sea * (crest * amp - amp * 0.28);
  }
  // le mur de sable : dunes qui montent à l'ouest ; dunes hors de la carte au nord et au sud
  h += owSmoothstep(260, -260, x) * 18;
  h += owSmoothstep(-30, -320, z) * 9 + owSmoothstep(3030, 3320, z) * 9;
  return h;
}

/* Oued de la nécropole : cuvette ouest-est sous les falaises, vallée jusqu'au relais Km 47.
   Renvoie la distance signée (négative dedans) ; out.north : côté nord (falaise). */
function owWadiSd(x, z, out) {
  // cuvette
  const ex = (x - 520) / 470, ez = (z - 2300) / 175;
  const de = (Math.sqrt(ex * ex + ez * ez) - 1) * 175;
  // vallée vers le relais (capsule)
  const ax = 860, az = 2320, bx = 1310, bz = 2560, vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1);
  const dc = Math.hypot(x - (ax + vx * t), z - (az + vz * t)) - 62;
  let sd, north;
  if (de < dc) { sd = de; north = owSmoothstep(40, -40, z - 2300); }
  else { sd = dc; north = owSmoothstep(-40, 40, (x - ax) * 0.48 + (z - az) * -0.877); }
  // bords irréguliers
  sd += (owFbm(x / 70, z / 70, 2) - 0.5) * 18;
  out.north = north; out.t = t; out.inBasin = de < dc;
  return sd;
}

function owGenTerrain() {
  const { NX, NZ, X0, Z0, STEP } = OW;
  const n = NX * NZ;
  const H = new Float32Array(n), bio = new Uint8Array(n);
  const pe = { nx: 0, nz: 0 }, wo = { north: false, t: 0, inBasin: false };
  const PT = KH.plateauTop;
  for (let j = 0; j < NZ; j++) {
    const z = Z0 + j * STEP;
    const xb = KH.nileBank(z), xf = xb + 380 + 30 * Math.sin(z / 400);
    for (let i = 0; i < NX; i++) {
      const x = X0 + i * STEP, k = j * NX + i;
      let h = owNatural(x, z), b = x < 1100 && x > 200 ? OWB.SEA : OWB.SAND;
      // plateau : escarpement raide au sud et à l'est, pente douce au nord et à l'ouest
      if (x > 1200 && x < 2800 && z > 700 && z < 2050) {
        let ps = owPolySd(KH.plateau, x, z, pe);
        ps += (owFbm(x / 90, z / 90, 2) - 0.5) * 46;
        const steep = pe.nx + pe.nz > 0.35;
        const w = steep ? 24 : 85;
        if (ps < w) {
          const top = PT + (owFbm(x / 180, z / 180, 2) - 0.5) * 3.2 + (owFbm(x / 25, z / 25, 2) - 0.5) * 0.6;
          const q = clamp((w - ps) / (1.3 * w), 0, 1);
          const shape = steep ? (q < 0.68 ? 0.32 * Math.pow(q / 0.68, 1.4) : 0.32 + 0.68 * smooth((q - 0.68) / 0.32)) : smooth(q);
          h = lerp(h, top, shape);
          if (q > 0.85) b = OWB.PLATEAU;
        }
      }
      // oued et falaises de la nécropole
      if (x < 1720 && z > 1780 && z < 2960) {
        const sd = owWadiSd(x, z, wo);
        const floorH = 2.5 + (owFbm(x / 120, z / 120, 2) - 0.5) * 2 + (wo.inBasin ? 0 : wo.t * 4.5);
        const nw = wo.north;      // 1 au nord (falaise), 0 au sud (pente douce), fondu entre les deux
        if (sd > 0) {
          // corniche : la terre se relève au nord de l'oued (13 m au bord, rien à 280 m)
          h += nw * 18 * (1 - owSmoothstep(0, 300, sd));
          if (sd < 70 && nw < 1) { const k2 = owSmoothstep(70, -20, sd) * (1 - nw); h = lerp(h, floorH, k2); if (k2 > 0.6) b = OWB.WADI; }
        } else {
          // dans l'oued : à pic sous la corniche, en pente douce ailleurs
          const cliff = lerp(h + 18 * nw, floorH, 1 - owSmoothstep(-5, 0, sd));
          const soft = lerp(h, floorH, owSmoothstep(70, -20, sd));
          h = lerp(soft, cliff, nw);
          b = nw > 0.5 && sd > -4.8 ? OWB.ROCK : OWB.WADI;
        }
      }
      // vallée du Nil : champs, berge, fleuve, rive d'en face
      if (x > 3150) {
        const v = owSmoothstep(3225, 3335, x);
        const fieldsH = 3 + (owNoise(x / 50, z / 50) - 0.5) * 0.35;
        if (v > 0) { h = lerp(h, fieldsH, v); if (v > 0.5) b = OWB.FIELD; }
        if (x > xb - 26) { h = lerp(h, 0.5, owSmoothstep(xb - 26, xb, x)); b = OWB.MUD; }
        if (x > xb) {
          h = lerp(0.5, -3.2, owSmoothstep(xb, xb + 40, x));
          b = OWB.RIVER;
          if (x > xf - 40) { h = lerp(-3.2, 2.6, owSmoothstep(xf - 40, xf + 10, x)); b = x > xf ? OWB.FIELD : OWB.MUD; }
          // île
          const ie = Math.hypot((x - 3935) / 62, (z - 2200) / 24);
          if (ie < 1.2) { h = Math.max(h, lerp(1.6, -3.2, owSmoothstep(0.8, 1.2, ie))); if (ie < 1) b = OWB.MUD; }
        }
      }
      H[k] = h; bio[k] = b;
    }
  }
  OW.H = H; OW.bio = bio;
  // lieux aplanis (hauteur moyenne du terrain sous chacun)
  const pads = [
    { x: 2320, z: 1965, r: 125, b: 60 },     // A camp de fouilles
    { x: 1395, z: 2585, r: 88, b: 50 },      // C relais Km 47
    { x: 840, z: 745, r: 230, b: 100 },      // D oasis
    { x: 3515, z: 1620, r: 140, b: 40 },     // E centrale
    { x: 2990, z: 445, r: 210, b: 70, rect: [2770, 320, 3210, 570] },   // G aérodrome
  ];
  for (const p of KH.pyramids) pads.push({ x: p.x, z: p.z, r: p.side * 0.72, b: 30, keep: true });
  for (const p of pads) owFlattenPad(p);
  // routes : profil le long de chaque route, pente bornée, puis terrain aplani de part et d'autre
  OW.roads = KH.roads.map((r) => owLayRoad(r));
  OW._bestD = OW._bestS = null;          // tableaux de travail des routes (16 Mo) rendus
  // oasis : le bassin, son eau et l'herbe autour
  const O = KH.oasis, oasisH = owHeightAtGrid(O.x, O.z);
  OW.oasisWater = oasisH - 0.55;
  owEachPoint(O.x - 160, O.z - 120, O.x + 160, O.z + 120, (k, x, z) => {
    const e = Math.hypot((x - O.x) / O.rx, (z - O.z) / O.rz);
    if (e < 1.05) { H[k] = lerp(oasisH - 1.9, oasisH, owSmoothstep(0.75, 1.05, e)); bio[k] = OWB.MUD; }
    else if (e < 3.4 && bio[k] !== OWB.ROAD && bio[k] !== OWB.TRACK) bio[k] = OWB.OASIS;
  });
  OW.pads = pads;
  khShapeTerrain();
  // pentes trop raides (falaises, escarpement) et eau : on n'y marche pas
  const steep = new Uint8Array(n), water = new Uint8Array(n);
  for (let j = 1; j < NZ - 1; j++) {
    for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i;
      const sx = Math.abs(H[k + 1] - H[k - 1]) / (2 * STEP), sz = Math.abs(H[k + NX] - H[k - NX]) / (2 * STEP);
      const s = Math.max(sx, sz, Math.abs(H[k + 1] - H[k]) / STEP, Math.abs(H[k + NX] - H[k]) / STEP, Math.abs(H[k] - H[k - 1]) / STEP, Math.abs(H[k] - H[k - NX]) / STEP);
      const paved = bio[k] === OWB.ROAD || bio[k] === OWB.TRACK || bio[k] === OWB.RUNWAY;
      if (s > 0.82 && !paved) { steep[k] = 1; if (bio[k] === OWB.SAND || bio[k] === OWB.SEA || bio[k] === OWB.PLATEAU || bio[k] === OWB.WADI) bio[k] = OWB.ROCK; }
      if (bio[k] === OWB.RIVER) water[k] = 1;
    }
  }
  owEachPoint(O.x - 60, O.z - 30, O.x + 60, O.z + 30, (k, x, z) => { if (Math.hypot((x - O.x) / O.rx, (z - O.z) / O.rz) < 0.97) water[k] = 1; });
  OW.steep = steep; OW.water = water;
}
/* Appelle fn(k, x, z) pour chaque point du champ de hauteurs dans le rectangle. */
function owEachPoint(x0, z0, x1, z1, fn) {
  const { NX, NZ, X0, Z0, STEP } = OW;
  const i0 = clamp(Math.floor((x0 - X0) / STEP), 0, NX - 1), i1 = clamp(Math.ceil((x1 - X0) / STEP), 0, NX - 1);
  const j0 = clamp(Math.floor((z0 - Z0) / STEP), 0, NZ - 1), j1 = clamp(Math.ceil((z1 - Z0) / STEP), 0, NZ - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * NX + i, X0 + i * STEP, Z0 + j * STEP);
}
function owHeightAtGrid(x, z) {
  const i = clamp(Math.round((x - OW.X0) / OW.STEP), 0, OW.NX - 1), j = clamp(Math.round((z - OW.Z0) / OW.STEP), 0, OW.NZ - 1);
  return OW.H[j * OW.NX + i];
}
function owFlattenPad(p) {
  const H = OW.H, bio = OW.bio;
  // hauteur visée : moyenne du terrain sous le lieu
  let s = 0, c = 0;
  const inPad = (x, z) => (p.rect ? x >= p.rect[0] && x <= p.rect[2] && z >= p.rect[1] && z <= p.rect[3] : Math.hypot(x - p.x, z - p.z) <= p.r);
  const R = p.rect ? Math.max(p.rect[2] - p.rect[0], p.rect[3] - p.rect[1]) : p.r;
  owEachPoint(p.x - R - p.b, p.z - R - p.b, p.x + R + p.b, p.z + R + p.b, (k, x, z) => { if (inPad(x, z)) { s += H[k]; c++; } });
  const target = p.y !== undefined ? p.y : c ? s / c : owHeightAtGrid(p.x, p.z);
  p.y = target;
  owEachPoint(p.x - R - p.b, p.z - R - p.b, p.x + R + p.b, p.z + R + p.b, (k, x, z) => {
    let d;
    if (p.rect) {
      const dx = Math.max(p.rect[0] - x, 0, x - p.rect[2]), dz = Math.max(p.rect[1] - z, 0, z - p.rect[3]);
      d = Math.hypot(dx, dz);
    } else d = Math.max(0, Math.hypot(x - p.x, z - p.z) - p.r);
    const w = 1 - owSmoothstep(0, p.b, d);
    if (w <= 0) return;
    H[k] = lerp(H[k], target, w);
    if (w > 0.9 && !p.keep) bio[k] = OWB.PAD;
  });
}
/* Pose une route : ligne lissée, profil en long (moyenne glissante, pente bornée), terrain aplani.
   mask (routes des Mod Tools) : 0 là où le terrain ne doit pas bouger (lieux, routes du jeu). */
function owLayRoad(r, mask = null) {
  const line = owSmoothLine(r.pts, 4);
  const N = line.pts.length;
  const raw = new Float32Array(N), prof = new Float32Array(N);
  for (let i = 0; i < N; i++) raw[i] = owHeightAtGrid(line.pts[i][0], line.pts[i][1]);
  // moyenne glissante sur ±(15 à 40) m
  const win = r.kind === 'runway' ? 60 : r.kind === 'road' ? 10 : 6;
  for (let i = 0; i < N; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(N - 1, i + win); j++) { s += raw[j]; c++; }
    prof[i] = s / c;
  }
  // pente bornée (deux passes)
  const maxG = r.kind === 'road' ? 0.075 : r.kind === 'runway' ? 0.01 : 0.11;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < N; i++) { const dl = line.cum[i] - line.cum[i - 1]; prof[i] = clamp(prof[i], prof[i - 1] - maxG * dl, prof[i - 1] + maxG * dl); }
    for (let i = N - 2; i >= 0; i--) { const dl = line.cum[i + 1] - line.cum[i]; prof[i] = clamp(prof[i], prof[i + 1] - maxG * dl, prof[i + 1] + maxG * dl); }
  }
  // plat sur toute la chaussée et un peu au-delà (le maillage est de 4 m), talus d'au plus ~0,75 :
  // la largeur du talus grandit avec la hauteur du déblai ou du remblai
  const half = r.w / 2 + (r.kind === 'road' ? 1.6 : r.kind === 'runway' ? 6 : 1.6);
  const blend = r.kind === 'road' ? 16 : r.kind === 'runway' ? 45 : 11;
  const bioK = r.kind === 'road' ? OWB.ROAD : r.kind === 'runway' ? OWB.RUNWAY : OWB.TRACK;
  const H = OW.H, bio = OW.bio, NX = OW.NX, reach = half + blend + 60;
  const profAt = (s) => {
    let lo = 0, hi = N - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (line.cum[m] <= s) lo = m; else hi = m; }
    const t = clamp((s - line.cum[lo]) / Math.max(1e-6, line.cum[hi] - line.cum[lo]), 0, 1);
    return lerp(prof[lo], prof[hi], t);
  };
  // segment par segment : chaque point garde la distance au segment le plus proche
  if (!OW._bestD || OW._bestD.length !== H.length) { OW._bestD = new Float32Array(H.length).fill(Infinity); OW._bestS = new Float32Array(H.length); }
  const bestD = OW._bestD, bestS = OW._bestS, touched = [];
  for (let i = 0; i < N - 1; i++) {
    const ax = line.pts[i][0], az = line.pts[i][1], ex = line.pts[i + 1][0] - ax, ez = line.pts[i + 1][1] - az, l2 = ex * ex + ez * ez || 1e-6;
    owEachPoint(Math.min(ax, ax + ex) - reach, Math.min(az, az + ez) - reach, Math.max(ax, ax + ex) + reach, Math.max(az, az + ez) + reach, (k, x, z) => {
      const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1);
      const d = Math.hypot(x - ax - ex * t, z - az - ez * t);
      if (d >= reach || d >= bestD[k]) return;
      if (bestD[k] === Infinity) touched.push(k);
      bestD[k] = d; bestS[k] = line.cum[i] + Math.sqrt(l2) * t;
    });
  }
  for (const k of touched) {
    const d = bestD[k], py = profAt(bestS[k]), bl = blend + Math.abs(py - H[k]) * 2;
    bestD[k] = Infinity;
    if (d >= half + bl) continue;
    const m = mask ? mask[k] / 255 : 1;
    H[k] = lerp(H[k], py, (1 - owSmoothstep(half, half + bl, d)) * m);
    if (d < r.w / 2 + 0.5 && bio[k] !== OWB.RIVER && m > 0.5) bio[k] = bioK;
  }
  return { id: r.id, kind: r.kind, w: r.w, line, prof, profAt };
}

/* Hauteur du terrain en (x, z) : interpolée sur les deux triangles du maillage (diagonale b–c). */
function owH(x, z) {
  const NX = OW.NX, inv = OW.INV;
  let fx = (x - OW.X0) * inv, fz = (z - OW.Z0) * inv;
  if (fx < 0) fx = 0; else if (fx > NX - 1.0001) fx = NX - 1.0001;
  if (fz < 0) fz = 0; else if (fz > OW.NZ - 1.0001) fz = OW.NZ - 1.0001;
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * NX + i, H = OW.H;
  if (tx + tz <= 1) { const a = H[k]; return a + (H[k + 1] - a) * tx + (H[k + NX] - a) * tz; }
  const d = H[k + NX + 1];
  return d + (H[k + NX] - d) * (1 - tx) + (H[k + 1] - d) * (1 - tz);
}
/* Normale du terrain (triangle sous le point). */
function owNormal(x, z, out) {
  const NX = OW.NX, inv = OW.INV;
  let fx = (x - OW.X0) * inv, fz = (z - OW.Z0) * inv;
  fx = clamp(fx, 0, NX - 1.0001); fz = clamp(fz, 0, OW.NZ - 1.0001);
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * NX + i, H = OW.H;
  let gx, gz;
  if (tx + tz <= 1) { gx = (H[k + 1] - H[k]) * inv; gz = (H[k + NX] - H[k]) * inv; }
  else { gx = (H[k + NX + 1] - H[k + NX]) * inv; gz = (H[k + NX + 1] - H[k + 1]) * inv; }
  const l = Math.hypot(gx, 1, gz);
  out.x = -gx / l; out.y = 1 / l; out.z = -gz / l;
  return out;
}
/* Point du champ de hauteurs le plus proche : matière, pente raide, eau. */
function owPointIndex(x, z) {
  const i = clamp(Math.round((x - OW.X0) * OW.INV), 0, OW.NX - 1), j = clamp(Math.round((z - OW.Z0) * OW.INV), 0, OW.NZ - 1);
  return j * OW.NX + i;
}
const owBioAt = (x, z) => OW.bio[owPointIndex(x, z)];
/* Terrain praticable en (x, z) : ni falaise, ni eau, ni hors des limites (mur de sable, fleuve ;
   bord de la carte lunaire). */
function owTerrainWalk(x, z) {
  const B = OW.walk;
  if (x < B[0] || x > B[2] || z < B[1] || z > B[3]) return false;
  const i = Math.floor((x - OW.X0) * OW.INV), j = Math.floor((z - OW.Z0) * OW.INV), NX = OW.NX, k = j * NX + i;
  // la case de 1 m est bloquée si l'un des quatre points qui l'entourent l'est (falaises nettes)
  const S = OW.steep, Wt = OW.water;
  return !(S[k] | S[k + 1] | S[k + NX] | S[k + NX + 1] | Wt[k] | Wt[k + 1] | Wt[k + NX] | Wt[k + NX + 1]);
}
