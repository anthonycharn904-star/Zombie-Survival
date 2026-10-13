/* ============================================================ 13 LA LUNE ==
   « Ombre éternelle » (jeu 2.0.0) : demande d'Anthony du 9 octobre 2026, 19 h 43, d'après sa planche
   « Survival Zombie — Ombre éternelle (anomalie) » (3 pages) : une mine de glace en gradins près du
   pôle Sud (~76° S), 1,4 × 1,4 km, environ 200 m de dénivelé jouable, valeurs physiques réelles
   (g = 1,62 m/s²) sauf l'anomalie, fictive. Troisième carte du menu Jouer.
   Repère : x vers l'est (0 à 1 400 m), z vers le sud (0 à 1 400 m), y en haut ; nord en haut du plan.
   Positions relevées sur le plan (page 3, 1,13 px/m) et la coupe ouest–est (1 m = 3,6 px) :
     fosse      centre (680, 1007) ; fond à −80 m sur 43,2 m de rayon ; cinq gradins de 15,9 m (N5 −66 …
                N1 −10), parois de 7,2 m en plan pour 14 m (63°) ; bord à +7 m (rayon 172 m), qui
                redescend vers la plaine (±0) sur 70 m
     soleil     rasant, 15° au-dessus de l'horizon, venant de l'est (azimut 105° : les ombres filent
                vers l'ouest-nord-ouest, comme les ombres des mâts sur le plan)
   ============================================================================ */
const LU = {
  g: 1.62,                                             // pesanteur lunaire (m/s²)
  R: 1737400,                                          // rayon de la Lune (m) : courbure de l'horizon
  sun: { az: 105, el: 15 },                            // soleil (degrés ; azimut depuis le nord, sens horaire)
  earth: { az: 352, el: 14, size: 1.9 },              // la Terre au nord, 14° (pôle Sud, face visible), 1,9°
  pit: { x: 680, z: 1007, rf: 43.2, tw: 15.9, ww: 7.2, rim: 172, crest: 7, berm: 70, fond: -80 },
  levels: [-10, -24, -38, -52, -66, -80],              // N1 … N5, fond
  // les lieux (A à J) : centre, rayon d'influence
  locs: [
    { id: 'A', name: 'Base Séléné', sub: 'Départ · air · oxygène', x: 893, z: 861, r: 90 },
    { id: 'B', name: 'La Fosse', sub: 'Six niveaux en gradins', x: 680, z: 1007, r: 175 },
    { id: 'C', name: 'Pont suspendu', sub: 'Niveau −24 m', x: 680, z: 975, r: 40 },
    { id: 'D', name: 'Catapulte électromagnétique', sub: 'Capsules à 60 m/s', x: 760, z: 470, r: 70 },
    { id: 'E', name: 'Crête solaire', sub: 'Cinq mâts de 46 m · courant', x: 380, z: 710, r: 150 },
    { id: 'F', name: 'Tour relais', sub: 'Point culminant', x: 487, z: 371, r: 70 },
    { id: 'G', name: 'Plateau d’extraction', sub: 'Atterrisseur', x: 997, z: 396, r: 75 },
    { id: 'H', name: 'Dépôt d’oxygène', sub: 'Une seule explosion', x: 760, z: 1170, r: 45 },
    { id: 'I', name: 'Convoyeur', sub: 'Raccourci du fond', x: 515, z: 1031, r: 30 },
    { id: 'J', name: 'Fond d’ombre éternelle', sub: '−80 m · glace d’eau', x: 683, z: 1007, r: 43 },
  ],
  // crête solaire : ligne de crête du nord au sud (les cinq mâts sur la crête) ; hauteur de la crête
  crest: [[575, 140], [530, 260], [492, 370], [462, 452], [441, 530], [410, 620], [376, 709], [345, 799], [311, 890], [286, 975], [272, 1065]],
  crestH: [[0, 22], [0.25, 34], [0.35, 25], [0.42, 24], [0.84, 24], [1, 8]],   // butte de la tour vers t = 0,25
  masts: [[441, 530], [410, 620], [376, 709], [345, 799], [311, 890]],
  tower: { x: 487, z: 371 },
  base: { x: 893, z: 861, r: 80 },                    // aire de la base (rayon), au ras de la plaine
  pad: { x: 997, z: 396, r: 56, h: 9 },                // plateau d'extraction : +9 m (son ombre à l'ouest)
  depot: { x: 760, z: 1170, r: 26 },
  // catapulte : départ dans la base, voie vers le nord-nord-ouest jusqu'au bord de la carte (+46 m)
  cata: { x0: 868, z0: 799, x1: 601, z1: 53, top: 46 },
  // pont : au niveau N2 (−24 m), d'ouest en est, à 32 m au nord du centre : son milieu passe au-dessus
  // du fond (56 m de chute, mortelle), ses bouts reposent sur le N2 ; tablier de 6 m, garde-corps en treillis
  bridge: { z: 975, w: 6, x0: 556, x1: 804, y: -24 },
  // convoyeur : du bord ouest (r 172, +7,2 m) au fond (r 32,8, −80 m), une pente de 32° ; il entaille
  // le coin de chaque gradin (coupe ouest–est) ; on y marche, la bande monte à 2,5 m/s
  conv: { a: 172, r0: 172, y0: 7.2, r1: 32.8, y1: -80, w: 3, belt: 2.5 },
  drill: { x: 683, z: 1007 },
  // rampes en spirale : bas → haut dans le sens horaire (degrés, depuis l'est vers le sud) ; pente 12,5 à 15 %
  // (à l'écart du convoyeur, 166 à 178°, et des bouts du pont, −172 à −158° et −22 à −8°)
  ramps: [
    { lo: -10, hi: 7, top: -50 },           // N1 → bord (accès près de la base)
    { lo: -24, hi: -10, top: -105 },        // N2 → N1
    { lo: -38, hi: -24, top: 160 },         // N3 → N2
    { lo: -52, hi: -38, top: 95 },          // N4 → N3
    { lo: -66, hi: -52, top: 15 },          // N5 → N4
    { lo: -80, hi: -66, top: 150 },         // fond → N5
  ],
  // propulseurs (points bleus du plan) : angle autour du centre, niveau (0 : N1 … 5 : fond)
  pads: [[-112.9, 0], [-133.4, 0], [-166, 0], [131.2, 0], [112.6, 0], [-104, 1], [155.2, 1], [64.5, 1],
    [-145, 2], [-31.3, 2], [-125.9, 3], [114.4, 3], [-77.1, 4], [177.3, 4], [20, 5], [-100, 5]],
  spawn: { pos: [891.4, 858.3], yaw: 2.743 },           // dans le moyeu, face à la baie : le dépôt dans l’axe (il saute à la manche 1)
};
Object.assign(OWB, { ICE: 13, BENCH: 14, EJECTA: 15, DARKSOIL: 16 });
const luDeg = (d) => (d * Math.PI) / 180;
/* Direction vers le soleil (unitaire) et vers la Terre. */
function luDir(az, el, out = new THREE.Vector3()) {
  const a = luDeg(az), e = luDeg(el);
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

/* ------------------------------------------------------------- La fosse --
   Profil en fonction de la distance au centre : fond, cinq gradins, bord, talus extérieur. */
function luPitProfile(r) {
  const P = LU.pit;
  if (r <= P.rf) return P.fond;
  let rIn = P.rf, h = P.fond;
  for (let k = 5; k >= 1; k--) {
    const hk = -10 - 14 * (k - 1), w1 = rIn + P.ww;
    if (r < w1) return lerp(h, hk, (r - rIn) / P.ww);
    const t1 = w1 + P.tw;
    if (r < t1) return hk;
    h = hk; rIn = t1;
  }
  if (r < P.rim) return lerp(-10, P.crest, (r - rIn) / (P.rim - rIn));
  const t = clamp((r - P.rim) / P.berm, 0, 1);
  return P.crest * (1 - t) * (1 - t * 0.35) * (1 - owSmoothstep(0.6, 1, t));
}
/* Bandes des gradins : rayon intérieur et extérieur du niveau i (0 : N1 … 4 : N5 ; 5 : le fond). */
function luBench(i) {
  const P = LU.pit;
  if (i >= 5) return { r0: 0, r1: P.rf, y: P.fond };
  const k = 5 - i, rIn = P.rf + (k - 1) * (P.ww + P.tw) + P.ww;
  return { r0: rIn, r1: rIn + P.tw, y: LU.levels[i] };
}
/* Rampes : bande (rayons), angles du bas et du haut, rayon moyen. */
function luRampGeo() {
  if (LU._ramps) return LU._ramps;
  const P = LU.pit;
  LU._ramps = LU.ramps.map((R) => {
    const iLo = LU.levels.indexOf(R.lo);
    const lower = luBench(iLo);
    const r0 = lower.r1 - 5;                                      // 5 m pris au gradin du bas
    const r1 = R.hi > -10 ? P.rim : luBench(iLo - 1).r0;          // jusqu'au bord du gradin du haut
    const rm = (r0 + r1) / 2, grade = rm < 80 ? 0.15 : 0.125;
    const da = (R.hi - R.lo) / grade / rm;                         // angle parcouru (radians)
    const a1 = luDeg(R.top), a0 = a1 - da;
    return { lo: R.lo, hi: R.hi, r0, r1, rm, a0, a1, da, grade };
  });
  return LU._ramps;
}
/* Convoyeur : position le long de la bande (r depuis le centre de la fosse), écart latéral, hauteur de la bande. */
function luConvAt(x, z, out) {
  const C = LU.conv, a = luDeg(C.a), ux = Math.cos(a), uz = Math.sin(a), dx = x - LU.pit.x, dz = z - LU.pit.z;
  const r = dx * ux + dz * uz;
  out.r = r; out.lat = -dx * uz + dz * ux; out.h = C.y1 + ((C.y0 - C.y1) * (r - C.r1)) / (C.r0 - C.r1);
  out.on = r >= C.r1 && r <= C.r0 && Math.abs(out.lat) <= C.w / 2;
  return out;
}
/* Hauteur de la fosse en (x, z), rampes comprises (sans le talus extérieur au-delà du bord). */
function luPitH(x, z) {
  const P = LU.pit, dx = x - P.x, dz = z - P.z, r = Math.hypot(dx, dz);
  let h = luPitProfile(r);
  if (r > P.rim + 2) return h;
  const a = Math.atan2(dz, dx);
  for (const R of luRampGeo()) {
    if (r < R.r0 - 2.2 || r > R.r1 + 2.2) continue;
    // progression le long de la rampe (0 en bas, 1 en haut), angle ramené près de a0
    let d = a - R.a0;
    d -= Math.round((d - R.da / 2) / TAU) * TAU;
    const s = (d * R.rm);                                       // m depuis le bas, le long de la rampe
    const L = R.da * R.rm;
    if (s < -1.5 || s > L + 1.5) continue;
    const t = clamp(s / L, 0, 1), hr = R.lo + (R.hi - R.lo) * t;
    // bords : 2 m de talus raide côté fosse, et côté paroi ; bouts fondus sur 1,5 m
    const wIn = clamp((r - (R.r0 - 2)) / 2, 0, 1), wOut = clamp((R.r1 + 2 - r) / 2, 0, 1);
    const wEnd = clamp((s + 1.5) / 1.5, 0, 1) * clamp((L + 1.5 - s) / 1.5, 0, 1);
    const w = Math.min(wIn, wOut, wEnd);
    if (w <= 0) continue;
    // la rampe ne remplace que ce qui est plus bas qu'elle côté fosse, plus haut côté paroi
    h = lerp(h, hr, w);
  }
  return h;
}

/* ------------------------------------------------------------ Le relief --
   Plaine ondulée, cratères de toutes tailles, crête solaire (pente douce à l'est, escarpement à
   l'ouest), butte de la tour, fosse, aires aplanies (base, plateau d'extraction, dépôt), courbure. */
const _luCrestOut = { d: 0, s: 0, x: 0, z: 0, side: 1 };
function luCrestInfo() {
  if (LU._crest) return LU._crest;
  const pts = LU.crest, cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  LU._crest = { pts, cum, len: cum[cum.length - 1] };
  return LU._crest;
}
function luCrestH(t) {
  const K = LU.crestH;
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) return lerp(K[i - 1][1], K[i][1], smooth((t - K[i - 1][0]) / (K[i][0] - K[i - 1][0])));
  return K[K.length - 1][1];
}
/* Crête : hauteur ajoutée en (x, z) (versant est en pente douce, escarpement ouest à l'ombre). */
function luRidge(x, z) {
  const C = luCrestInfo();
  owPolylineNear(C.pts, C.cum, x, z, _luCrestOut);
  const o = _luCrestOut, t = o.s / C.len;
  // le bout des lignes : la crête s'efface au-delà de ses extrémités
  const endN = Math.hypot(x - C.pts[0][0], z - C.pts[0][1]), endS = Math.hypot(x - C.pts[C.pts.length - 1][0], z - C.pts[C.pts.length - 1][1]);
  let Hc = luCrestH(t) + (owFbm(x / 90, z / 90, 2) - 0.5) * 3;
  if (t <= 0.001) Hc *= 1 - owSmoothstep(0, 160, endN);
  if (t >= 0.999) Hc *= 1 - owSmoothstep(0, 140, endS);
  // côté : la polyligne va du nord au sud ; side < 0 : à l'ouest
  const west = o.side < 0, d = o.d + (owFbm(x / 40, z / 40, 2) - 0.5) * 8;
  if (!west) return Hc * Math.pow(1 - owSmoothstep(0, 175, d), 1.15);
  // escarpement : 6 m de rebord, puis la paroi (~42°), puis le pied qui s'adoucit vers la plaine basse
  const low = -9 + (owFbm(x / 160, z / 160, 2) - 0.5) * 4;
  if (d < 5) return Hc - (d / 5) * 1.5;
  const drop = Hc - 1.5 - low, wall = drop / 0.95;
  if (d < 5 + wall) return Hc - 1.5 - drop * owSmoothstep(0, 1, (d - 5) / wall) ** 0.9;
  return low * (1 - owSmoothstep(5 + wall + 60, 5 + wall + 420, d));
}
/* Cratères : liste fixe (graine), du plus grand au plus petit ; quelques grands relevés sur le plan. */
function luCraters() {
  if (LU._craters) return LU._craters;
  const rnd = mulberry32(76);
  const out = [];
  // grands cratères du plan (centre, diamètre, fraîcheur)
  for (const [x, z, D, f] of [[325, 764, 58, 0.9], [338, 1255, 92, 0.7], [1219, 945, 72, 0.8], [904, 511, 66, 0.6], [128, 330, 80, 0.6],
    [1290, 190, 60, 0.7], [470, 1560, 110, 0.5], [1180, 1290, 64, 0.8], [210, 980, 44, 0.9], [1060, 1110, 38, 1], [600, 240, 46, 0.8], [96, 1210, 70, 0.6]]) out.push({ x, z, D, f });
  const classes = [[64, 96, 10], [32, 64, 60], [16, 32, 260], [8, 16, 900], [4, 8, 2600]];
  for (const [d0, d1, n] of classes) {
    for (let i = 0; i < n; i++) {
      const x = -560 + rnd() * 2520, z = -560 + rnd() * 2520, D = d0 + rnd() * (d1 - d0), f = 0.35 + rnd() * 0.65;
      out.push({ x, z, D, f });
    }
  }
  LU._craters = out;
  return out;
}
/* Écart d'un cratère (forme d'un bol, rebord relevé, éjectas) à la distance r de son centre. */
function luCraterH(c, r) {
  const R = c.D / 2, q = r / R;
  const depth = c.D * (0.07 + 0.07 * c.f), rim = c.D * (0.012 + 0.016 * c.f);
  if (q < 1) return -depth + (depth + rim) * Math.pow(q, 2.1);
  if (q > 2.6) return 0;
  return rim * Math.pow(q, -3) * (1 - owSmoothstep(1.8, 2.6, q));
}
/* Atténuation des cratères autour des lieux (la fosse, les aires, les mâts, la tour). */
function luCraterKeep(x, z) {
  const P = LU.pit;
  let k = owSmoothstep(P.rim + 20, P.rim + 90, Math.hypot(x - P.x, z - P.z));
  k *= owSmoothstep(LU.base.r + 10, LU.base.r + 60, Math.hypot(x - LU.base.x, z - LU.base.z));
  k *= owSmoothstep(LU.pad.r + 30, LU.pad.r + 70, Math.hypot(x - LU.pad.x, z - LU.pad.z));
  k *= owSmoothstep(30, 60, Math.hypot(x - LU.depot.x, z - LU.depot.z));
  k *= owSmoothstep(28, 60, Math.hypot(x - LU.tower.x, z - LU.tower.z));
  for (const [mx, mz] of LU.masts) k *= owSmoothstep(14, 34, Math.hypot(x - mx, z - mz));
  return k;
}
function luNatural(x, z) {
  let h = (owFbm(x / 620, z / 620, 3) - 0.5) * 6 + (owFbm(x / 170, z / 170, 3) - 0.5) * 2.2 + (owFbm(x / 31, z / 31, 2) - 0.5) * 0.35;
  return h;
}
function luGenTerrain() {
  const { NX, NZ, X0, Z0, STEP } = OW;
  const n = NX * NZ, H = new Float32Array(n), bio = new Uint8Array(n);
  const P = LU.pit;
  // 1. plaine, crête, butte de la tour
  for (let j = 0; j < NZ; j++) {
    const z = Z0 + j * STEP;
    for (let i = 0; i < NX; i++) {
      const x = X0 + i * STEP, k = j * NX + i;
      H[k] = luNatural(x, z) + luRidge(x, z);
      bio[k] = OWB.SAND;
    }
  }
  // 2. cratères (atténués près des lieux)
  for (const c of luCraters()) {
    const reach = c.D * 1.3, keep = luCraterKeep(c.x, c.z);
    if (keep < 0.02) continue;
    owEachPoint(c.x - reach, c.z - reach, c.x + reach, c.z + reach, (k, x, z) => {
      const dh = luCraterH(c, Math.hypot(x - c.x, z - c.z));
      if (dh) H[k] += dh * keep * luCraterKeep(x, z);
      // éjectas clairs autour des cratères frais : rayons doux (bruit angulaire), plus rares au loin
      if (c.f > 0.8 && c.D > 8 && c.D < 40) {
        const q = Math.hypot(x - c.x, z - c.z) / (c.D / 2);
        if (q > 0.85 && q < 1.9) {
          const a = Math.atan2(z - c.z, x - c.x), ray = owNoise(a * 4 + c.x * 0.01, c.z * 0.01) * 0.75 + owNoise(x / 4, z / 4) * 0.25;
          if (ray > 0.52 + (q - 0.85) * 0.3) bio[k] = OWB.EJECTA;
        }
      }
    });
  }
  // 3. la fosse : profil anti-crénelé (quatre échantillons par point), rampes ; plaine raccordée au talus
  owEachPoint(P.x - P.rim - P.berm - 10, P.z - P.rim - P.berm - 10, P.x + P.rim + P.berm + 10, P.z + P.rim + P.berm + 10, (k, x, z) => {
    const r = Math.hypot(x - P.x, z - P.z);
    if (r > P.rim + P.berm + 8) return;
    let h = 0;
    for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) h += luPitH(x + ox, z + oz);
    h /= 4;
    if (r < P.rim) { H[k] = h; bio[k] = r < P.rf + 0.5 ? OWB.ICE : OWB.BENCH; }
    else {
      // talus : le bord ajouté à la plaine, qui reprend la main au-delà
      const w = 1 - owSmoothstep(P.rim + P.berm * 0.5, P.rim + P.berm + 8, r);
      H[k] = lerp(H[k], Math.max(H[k], 0) * 0.3 + h, w);
    }
  });
  // tranchée du convoyeur : le coin des gradins entaillé jusque sous la bande (le sol suit la bande)
  {
    const C = LU.conv, cv = {}, a = luDeg(C.a), x0 = P.x + Math.cos(a) * C.r1, z0 = P.z + Math.sin(a) * C.r1, x1 = P.x + Math.cos(a) * C.r0, z1 = P.z + Math.sin(a) * C.r0;
    owEachPoint(Math.min(x0, x1) - 8, Math.min(z0, z1) - 8, Math.max(x0, x1) + 8, Math.max(z0, z1) + 8, (k, x, z) => {
      luConvAt(x, z, cv);
      if (cv.r < C.r1 - 1 || cv.r > C.r0 + 1) return;
      const m = 1 - owSmoothstep(C.w / 2 + 0.3, C.w / 2 + 2.4, Math.abs(cv.lat));
      const t = cv.h - 0.06;
      if (m > 0 && H[k] > t) H[k] = lerp(H[k], t, m);
    });
  }
  OW.H = H; OW.bio = bio;
  // 4. aires aplanies : base (au ras de la plaine), plateau d'extraction (+9 m), dépôt d'oxygène
  const pads = [
    { x: LU.base.x, z: LU.base.z, r: LU.base.r, b: 34, y: 0.6 },
    { x: LU.pad.x, z: LU.pad.z, r: LU.pad.r, b: 30, y: LU.pad.h },
    { x: LU.depot.x, z: LU.depot.z, r: LU.depot.r, b: 18 },
    { x: LU.tower.x, z: LU.tower.z, r: 13, b: 16 },
  ];
  for (const [mx, mz] of LU.masts) pads.push({ x: mx, z: mz, r: 6, b: 10 });
  for (const p of pads) owFlattenPad(p);
  OW.pads = pads;
  luShapeTerrain();
  // le dessus des aires : sol damé (plus sombre, plus lisse)
  owEachPoint(LU.base.x - LU.base.r, LU.base.z - LU.base.r, LU.base.x + LU.base.r, LU.base.z + LU.base.r, (k, x, z) => { if (Math.hypot(x - LU.base.x, z - LU.base.z) < LU.base.r - 4) bio[k] = OWB.PAD; });
  owEachPoint(LU.pad.x - LU.pad.r, LU.pad.z - LU.pad.r, LU.pad.x + LU.pad.r, LU.pad.z + LU.pad.r, (k, x, z) => { if (Math.hypot(x - LU.pad.x, z - LU.pad.z) < LU.pad.r - 3) bio[k] = OWB.PAD; });
  // 5. courbure : la Lune s'arrondit (1 m à 1,8 km du centre de la carte ; l'anneau lointain continue)
  owEachPoint(X0, Z0, X0 + (NX - 1) * STEP, Z0 + (NZ - 1) * STEP, (k, x, z) => { const d2 = (x - 700) ** 2 + (z - 700) ** 2; H[k] -= d2 / (2 * LU.R); });
  OW.roads = [];
  OW.oasisWater = -1e9;
  OW.pit = null;
  // 6. pentes : parois, escarpement, flancs des cratères raides ; pas d'eau
  const steep = new Uint8Array(n), water = new Uint8Array(n);
  for (let j = 1; j < NZ - 1; j++) {
    for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i;
      const s = Math.max(Math.abs(H[k + 1] - H[k - 1]) / (2 * STEP), Math.abs(H[k + NX] - H[k - NX]) / (2 * STEP), Math.abs(H[k + 1] - H[k]) / STEP, Math.abs(H[k + NX] - H[k]) / STEP, Math.abs(H[k] - H[k - 1]) / STEP, Math.abs(H[k] - H[k - NX]) / STEP);
      steep[k] = luSteepRule(k, s, bio[k]);
    }
  }
  OW.steep = steep; OW.water = water;
  luSunMap();
}
/* Pente trop raide pour marcher (pente maximale autour du point) ; la roche nue apparaît. */
function luSteepRule(k, s, b) {
  if (s > 0.78) { if (OW.bio[k] === OWB.SAND || OW.bio[k] === OWB.EJECTA || OW.bio[k] === OWB.BENCH) OW.bio[k] = OWB.ROCK; return 1; }
  return 0;
}

/* --------------------------------------------------------------- Le soleil --
   Soleil fixe, rasant : la hauteur au-dessus de laquelle un point voit le soleil (ombre portée par
   le relief) est calculée une fois, colonne par colonne depuis l'est (chaque point regarde son
   voisin côté soleil : ys = max(H, ys) du voisin, moins la descente du rayon sur la distance).
   Le terrain, les lieux, les zombies s'éteignent dessous (luSunify) ; le plan l'ombre comme la planche. */
function luSunMap() {
  const { NX, NZ, STEP, H } = OW;
  const az = luDeg(LU.sun.az), T = Math.tan(luDeg(LU.sun.el));
  const sx = Math.sin(az), sz = -Math.cos(az);              // vers le soleil, à plat
  const ys = new Float32Array(NX * NZ).fill(-1e4);
  // un pas d'une colonne vers l'est (sx > 0) ; la ligne d'à côté en z, interpolée
  const d = STEP / sx, dz = (d * sz) / STEP, drop = d * T;
  const j0 = Math.floor(dz), f = dz - j0;
  for (let i = NX - 2; i >= 0; i--) {
    for (let j = 0; j < NZ; j++) {
      const ja = clamp(j + j0, 0, NZ - 1), jb = clamp(j + j0 + 1, 0, NZ - 1);
      const ka = ja * NX + i + 1, kb = jb * NX + i + 1;
      const occ = Math.max(H[ka], ys[ka]) * (1 - f) + Math.max(H[kb], ys[kb]) * f;
      ys[j * NX + i] = occ - drop;
    }
  }
  OW.sunVis = ys;
  // textures refaites au prochain chargement (luSunTexture) ; les anciennes sont libérées
  if (LU.sunTex) { LU.sunTex.dispose(); LU.sunTex = null; }
  if (LU.sunGTex) { LU.sunGTex.dispose(); LU.sunGTex = null; }
}
/* Au soleil en (x, y, z) : 1 au soleil, 0 à l'ombre du relief (fondu sur 1 m). */
function luSunAt(x, y, z) {
  if (!OW.sunVis) return 1;
  const ys = OW.sunVis[owPointIndex(x, z)];
  return owSmoothstep(ys - 0.5, ys + 0.5, y);
}
function luSunH(x, z) { return OW.sunVis ? OW.sunVis[owPointIndex(x, z)] : -1e4; }
