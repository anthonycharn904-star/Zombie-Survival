
/* ================================================================== 21 LES MARÉCAGES MAUDITS ==
   Quatrième carte intégrée (kit MM 2.1.0) : un marais immense, noyé de brume, la nuit. Cinq îles
   proches (traversées de 15 à 30 s en barque à moteur), des hauts-fonds où l'on patauge, des
   chenaux profonds, et ce qui vit dedans : la Mère-Vase (mere-vase.js, inséré avant le jeu).

   Repère : x vers l'est (0 à 1 000 m), z vers le sud (0 à 1 000 m), y en haut, eau à y = 0 ; le
   champ de hauteurs déborde de 300 m tout autour (eau et forêt morte dans la brume).

     A  Le Bourg noyé      village de pêcheurs sur pilotis, chapelle, pontons ; départ
     B  La Futaie          île haute, forêt de cyprès chauves, cabane de trappeur, scierie
     C  Station Héron      station de pompage et laboratoire sur pilotis ; le courant
     D  L'Enlisée          île à moitié noyée : vase, mares, arbres morts, péniche échouée
     E  Îlot des Pierres   tertre et cercle de pierres levées (Le Glas) ; lieu à secrets
        La Fosse           trou d'eau de 16 m au milieu de l'archipel : le repaire

   Ce qui est fait ici : le relief, l'eau, la lumière, le décor, les éléments de jeu, la barque
   (véhicule « barque »), la nage, la menace de la Mère-Vase et ses attaques, son combat de boss
   (architecture et paramètres, sans mécanique définitive), des crochets pour les quêtes à venir.
   Pas de quête, d'énigme, de secret ni de scénario : ils viendront des Mod Tools.
   ============================================================================================= */
const MA = {
  water: 0,                                            // surface de l'eau (m)
  wade: 0.9,                                           // au-delà de 0,9 m d'eau : on ne marche plus (eau profonde)
  boatDraft: 0.32,                                     // tirant d'eau de la barque (avec la marge de l'hélice)
  islands: [
    { id: 'A', name: 'Le Bourg noyé', sub: 'Village sur pilotis · départ', x: 520, z: 700, r: 62, h: 1.7, kind: 'village', seed: 11, ex: 1.15, ez: 0.92 },
    { id: 'B', name: 'La Futaie', sub: 'Forêt de cyprès · scierie', x: 262, z: 562, r: 68, h: 3.3, kind: 'forest', seed: 23, ex: 0.9, ez: 1.12 },
    { id: 'C', name: 'Station Héron', sub: 'Pompage · laboratoire · courant', x: 738, z: 498, r: 58, h: 2.3, kind: 'station', seed: 37, ex: 1.05, ez: 1.0 },
    { id: 'D', name: 'L’Enlisée', sub: 'Île noyée · péniche', x: 468, z: 446, r: 56, h: 1.0, kind: 'wild', seed: 41, ex: 1.2, ez: 0.85, ponds: 1 },
    { id: 'E', name: 'Îlot des Pierres', sub: 'Pierres levées · Le Glas', x: 566, z: 228, r: 36, h: 3.4, kind: 'stones', seed: 53, ex: 1, ez: 1 },
  ],
  fosse: { id: 'F', name: 'La Fosse', sub: 'Eau noire · 16 m', x: 598, z: 588, r: 58, depth: -16 },
  // bancs (1 à 1,4 m d'eau, roseaux) : trop profonds pour marcher, assez pour la barque (qui y
  // ralentit) ; la bête n'y entre pas : la route sûre, mais plus longue
  bars: [
    { w: 13, pts: [[470, 650], [448, 610], [440, 566], [446, 526], [458, 500]] },
    { w: 11, pts: [[690, 540], [664, 590], [640, 640], [600, 668], [580, 680]] },
  ],
  // chenaux : eau plus profonde où la Mère-Vase circule
  channels: [
    { w: 34, d: -8.5, pts: [[598, 588], [660, 520], [700, 470], [690, 400], [640, 320], [590, 268]] },
    { w: 30, d: -7.5, pts: [[598, 588], [530, 560], [420, 600], [360, 640], [300, 640]] },
    { w: 28, d: -7, pts: [[598, 588], [640, 700], [700, 760], [780, 800]] },
    { w: 26, d: -7, pts: [[468, 446], [520, 360], [560, 300]] },
  ],
  bound: [70, 70, 930, 930],                           // au-delà : forêt morte dans un mètre d'eau, puis la brume
  spawn: { pos: [516.5, 704.5], yaw: 0.35 },
  moon: { az: 208, el: 21 },                           // lune voilée, basse, au sud-sud-ouest
  fog: { d: 0.0092, col: 0x1d2621, sky: 0x24302a },
  locs: [],
};
MA.locs = MA.islands.map((I) => ({ id: I.id, name: I.name, sub: I.sub, x: I.x, z: I.z, r: Math.round(I.r * 1.25) }))
  .concat([{ id: MA.fosse.id, name: MA.fosse.name, sub: MA.fosse.sub, x: MA.fosse.x, z: MA.fosse.z, r: MA.fosse.r }]);
Object.assign(OWB, { MOSS: 17, PEAT: 18, SILT: 19, REEDS: 20, STONE_MA: 21, BOARDS_MA: 22 });
// couleurs du sol (sRGB) : vase mouillée, mousse, tourbe, limon du fond, roselière, pierre moussue
const MAC = {
  mud: 0x443a2b, mudWet: 0x30291f, moss: 0x3b4229, mossLight: 0x4e5634, peat: 0x302a20, peatLight: 0x433a2c,
  silt: 0x3a372a, siltDeep: 0x25241c, reeds: 0x5c5c3a, stone: 0x6a6e62, stoneDark: 0x4a4e45, boards: 0x5a4d3a,
};

/* ------------------------------------------------------------ Monde, base, carte -- */
OW_WORLDS.marais = {
  W: 1000, D: 1000, X0: -300, Z0: -300, STEP: 2, NX: 801, NZ: 801, walk: [MA.bound[0] - 10, MA.bound[1] - 10, MA.bound[2] + 10, MA.bound[3] + 10],
  lod: [[100, 300, 640], [140, 420, 900], [200, 600, 1300]], base: 'marais', edge: [80, 80, 920, 920],
  gen: () => maGenTerrain(), locs: () => MA.locs,
};
const MARAIS = {
  id: 'marais', open: true, format: OPEN_FORMAT, base: 'marais', name: 'Les Marécages Maudits',
  description: 'Un marais sans bord sous une lune voilée : cinq îles dans la brume, des pontons, des barques à moteur, et quelque chose de très grand sous l’eau noire.',
  eyebrow: 'Rapport d’incident · Les Marécages Maudits · nuit',
  lead: 'Survivez d’île en île le plus longtemps possible. Traversez vite : plus vous restez sur l’eau, plus elle vous entend.',
  w: 1000, h: 1000,
  rules: { startPoints: 500, startWeapon: 'm1911', powerOn: false, boxWeapons: null, storms: 0 },
  spawn: { pos: MA.spawn.pos.slice(), yaw: MA.spawn.yaw, lv: 0 },
  ambiance: { sky: '#1d2621', fog: '#1d2621', fogDensity: MA.fog.d, hemiSky: '#55665c', hemiGround: '#2a241b', hemi: 0.3, exposure: 1.1, moon: false, trees: 0, pipes: false, wallHeight: 3.5 },
  wallbuys: [], perks: [], boxes: [], boxStart: 0, vehicles: [], fuel: [], breakers: [], props: [], oxy: [], glas: null,
  roads: [], buildings: [], locs: [], terrain: null, ground: null, custom: { models: {} },
  doors: [], lights: [], signs: [], zones: [], risers: [], power: null, amp: null, digipass: null, altar: false,
  thumb: null, menuCam: null, seed: 1931, author: '', updated: '2026-10-28',
  dev: true,                                           // kit 2.0.7 : publiée en développement (tampon dans le choix des maps)
};
// le marais sans ses lieux (Mod Tools) : relief, eau, végétation ; ni bâtiments, ni éléments
const MARAIS_VIERGE = {
  id: 'marais_vierge', open: true, format: OPEN_FORMAT, base: 'marais_vierge', name: 'Marais vierge', w: 1000, h: 1000,
  description: 'Le relief et l’eau des Marécages Maudits, sans leurs lieux : les îles, les hauts-fonds, les chenaux, la forêt. Le reste est à construire.',
  eyebrow: 'Rapport d’incident · un marais', lead: 'Survivez le plus longtemps possible.',
  rules: { startPoints: 500, startWeapon: 'm1911', powerOn: false, boxWeapons: null, storms: 0 },
  spawn: { pos: MA.spawn.pos.slice(), yaw: MA.spawn.yaw, lv: 0 }, ambiance: { ...MARAIS.ambiance },
  wallbuys: [], perks: [], boxes: [], boxStart: 0, vehicles: [], fuel: [], breakers: [], props: [], oxy: [], glas: null,
  roads: [], buildings: [], locs: [], terrain: null, ground: null, custom: { models: {} },
  doors: [], lights: [], signs: [], zones: [], risers: [], power: null, amp: null, digipass: null, altar: false,
  thumb: null, menuCam: null, seed: 1931, author: '', updated: '',
};
Object.assign(OW_BASES, {
  marais: { name: 'Les Marécages Maudits', places: true, world: 'marais' },
  marais_vierge: { name: 'Marais vierge', places: false, world: 'marais' },
});
Object.assign(OPEN_BASES, { marais: MARAIS, marais_vierge: MARAIS_VIERGE });

/* ------------------------------------------------------------------ Relief -- */
/* Distance normalisée au bord d'une île (< 1 dedans) : rive irrégulière (bruit angulaire), île
   allongée (ex, ez). */
function maIslandQ(I, x, z) {
  const dx = (x - I.x) / (I.ex || 1), dz = (z - I.z) / (I.ez || 1), d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  const wob = 1 + 0.5 * (owFbm(Math.cos(a) * 1.7 + I.seed, Math.sin(a) * 1.7 - I.seed * 0.7, 3) - 0.5) + 0.07 * Math.sin(a * 5 + I.seed) + 0.04 * Math.sin(a * 11 + I.seed * 2.3);
  return d / (I.r * wob);
}
/* Distance d'un point à une polyligne (et position le long : t de 0 à 1). */
function maPolyDist(pts, x, z, out) {
  let best = 1e9, bt = 0, acc = 0, total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], ex = pts[i + 1][0] - ax, ez = pts[i + 1][1] - az, l2 = ex * ex + ez * ez || 1e-6, L = Math.sqrt(l2);
    const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1), d = Math.hypot(x - ax - ex * t, z - az - ez * t);
    if (d < best) { best = d; bt = (acc + t * L) / (total || 1); }
    acc += L;
  }
  if (out) out.t = bt;
  return best;
}
/* Eau libre : fond de 3,5 à 7 m (vase), plus creux dans les chenaux et La Fosse. Les grandes ondulations
   sont calculées tous les 8 m puis interpolées (le relief fin vient d'un seul bruit). */
function maBedH(x, z) {
  const f = owFbm(x / 210 + 3.7, z / 210 - 1.3, 4), g = owFbm(x / 60 - 9.1, z / 60 + 2.2, 3);
  return -3.4 - 3.1 * f + 0.7 * (g - 0.5);
}
function maCoarse(fn) {
  const { NX, NZ, X0, Z0, STEP } = OW, C = 4, cx = Math.ceil((NX - 1) / C) + 1, cz = Math.ceil((NZ - 1) / C) + 1, A = new Float32Array(cx * cz);
  for (let j = 0; j < cz; j++) for (let i = 0; i < cx; i++) A[j * cx + i] = fn(X0 + i * C * STEP, Z0 + j * C * STEP);
  return (i, j) => {
    const fi = i / C, fj = j / C, i0 = Math.min(cx - 2, Math.floor(fi)), j0 = Math.min(cz - 2, Math.floor(fj)), tx = fi - i0, tz = fj - j0, k = j0 * cx + i0;
    return (A[k] * (1 - tx) + A[k + 1] * tx) * (1 - tz) + (A[k + cx] * (1 - tx) + A[k + cx + 1] * tx) * tz;
  };
}
function maGenTerrain() {
  const { NX, NZ, X0, Z0, STEP } = OW, n = NX * NZ;
  const H = new Float32Array(n), bio = new Uint8Array(n);
  // 1. fond du marais
  const bed = maCoarse((x, z) => -3.4 - 3.1 * owFbm(x / 210 + 3.7, z / 210 - 1.3, 4) + 0.55 * (owFbm(x / 60 - 9.1, z / 60 + 2.2, 2) - 0.5));
  for (let j = 0; j < NZ; j++) {
    const z = Z0 + j * STEP;
    for (let i = 0; i < NX; i++) {
      const x = X0 + i * STEP, k = j * NX + i;
      H[k] = bed(i, j) + 0.25 * (owNoise(x / 13 + 4.1, z / 13 - 2.7) - 0.5);
      bio[k] = OWB.SILT;
    }
  }
  OW.H = H; OW.bio = bio;
  // 2. chenaux profonds
  for (const C of MA.channels) {
    const xs = C.pts.map((p) => p[0]), zs = C.pts.map((p) => p[1]), m = C.w * 1.6;
    owEachPoint(Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m, (k, x, z) => {
      const d = maPolyDist(C.pts, x, z);
      if (d > m) return;
      const w = 1 - owSmoothstep(C.w * 0.35, m, d);
      H[k] = Math.min(H[k], lerp(H[k], C.d + 0.8 * (owNoise(x / 14, z / 14) - 0.5), w));
    });
  }
  // 3. La Fosse : cuvette à pente raide, fond à −16 m
  {
    const F = MA.fosse, m = F.r * 1.8;
    owEachPoint(F.x - m, F.z - m, F.x + m, F.z + m, (k, x, z) => {
      const d = Math.hypot(x - F.x, z - F.z) / F.r;
      if (d > 1.8) return;
      const prof = F.depth + 1.5 * (owNoise(x / 11, z / 11) - 0.5);
      H[k] = Math.min(H[k], lerp(prof, H[k], owSmoothstep(0.45, 1.8, d)));
    });
  }
  // 4. îles : plateau bosselé, berge de vase, banc peu profond (on y marche jusqu'à 0,9 m d'eau), talus
  for (const I of MA.islands) {
    const m = I.r * 2.6 * Math.max(I.ex || 1, I.ez || 1);
    owEachPoint(I.x - m, I.z - m, I.x + m, I.z + m, (k, x, z) => {
      const q = maIslandQ(I, x, z);
      if (q > 2.5) return;
      let p;
      if (q < 1) {
        const top = I.h * (0.55 + 0.45 * owFbm(x / 38 + I.seed, z / 38 - I.seed, 3)) + (I.kind === 'stones' ? 1.6 * owSmoothstep(0.55, 0.05, q) : 0);
        p = lerp(0.14, top, owSmoothstep(1.0, 0.42, q));
        if (I.ponds) p -= I.ponds * Math.max(0, owFbm(x / 24 + 5, z / 24 - 4, 3) - 0.5) * 7 * owSmoothstep(0.95, 0.6, q);   // mares
      } else if (q < 1.16) p = lerp(0.14, -0.85, owSmoothstep(1.0, 1.16, q)) + 0.2 * (owNoise(x / 9, z / 9) - 0.5);   // on patauge
      else if (q < 1.45) p = lerp(-0.85, -2.1, owSmoothstep(1.16, 1.45, q));          // la barque, pas la bête
      else p = lerp(-2.1, H[k], owSmoothstep(1.45, 2.2, q));
      if (p > H[k]) H[k] = p;
    });
  }
  // 5. hauts-fonds (bancs de vase) entre certaines îles
  for (const B of MA.bars) {
    const xs = B.pts.map((p) => p[0]), zs = B.pts.map((p) => p[1]), m = B.w * 2.2;
    owEachPoint(Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m, (k, x, z) => {
      const d = maPolyDist(B.pts, x, z);
      if (d > m) return;
      const top = -1.15 + 0.25 * (owNoise(x / 12, z / 12) - 0.5);
      const p = lerp(top, H[k], owSmoothstep(B.w * 0.45, m, d));
      if (p > H[k]) H[k] = p;
    });
  }
  // 6. bord du monde : la forêt morte dans un mètre d'eau (la barque n'y passe plus), puis le large
  {
    // bord arrondi (superellipse) et bruité : pas de carré visible d'en haut
    const edgeN = maCoarse((x, z) => owFbm(x / 30 + 7, z / 30 - 3, 3)), wob = maCoarse((x, z) => owFbm(x / 140 - 2, z / 140 + 6, 2));
    const cx = (MA.bound[0] + MA.bound[2]) / 2, cz = (MA.bound[1] + MA.bound[3]) / 2, R = (MA.bound[2] - MA.bound[0]) / 2;
    for (let j = 0; j < NZ; j++) {
      const z = Z0 + j * STEP;
      for (let i = 0; i < NX; i++) {
        const x = X0 + i * STEP, k = j * NX + i;
        const u = (x - cx) / R, v = (z - cz) / R, r = Math.pow(u * u * u * u + v * v * v * v, 0.25);
        const out = (r - 1) * R + 70 * (wob(i, j) - 0.5);             // > 0 : dehors
        if (out < -40) continue;
        const w = owSmoothstep(-40, 10, out) * (1 - owSmoothstep(160, 300, out));
        const p = -0.7 + 0.9 * (edgeN(i, j) - 0.45);
        if (w > 0) H[k] = lerp(H[k], Math.max(H[k], p), w);
      }
    }
  }
  // 7. sols
  for (let j = 0; j < NZ; j++) {
    const z = Z0 + j * STEP;
    for (let i = 0; i < NX; i++) {
      const x = X0 + i * STEP, k = j * NX + i, h = H[k];
      if (h < -0.05) { bio[k] = h > -0.9 && owNoise(x / 7, z / 7) > 0.45 ? OWB.REEDS : OWB.SILT; continue; }
      const I = maIslandAt(x, z), n1 = owFbm(x / 17, z / 17, 2);
      if (h < 0.4) { bio[k] = OWB.MUD; continue; }
      if (!I) { bio[k] = n1 > 0.55 ? OWB.MOSS : OWB.MUD; continue; }
      switch (I.kind) {
        case 'forest': bio[k] = n1 > 0.5 ? OWB.PEAT : OWB.MOSS; break;
        case 'stones': bio[k] = n1 > 0.62 ? OWB.STONE_MA : OWB.MOSS; break;
        case 'wild': bio[k] = n1 > 0.6 ? OWB.MOSS : OWB.MUD; break;
        default: bio[k] = n1 > 0.48 ? OWB.MOSS : OWB.MUD;
      }
    }
  }
  OW.roads = []; OW.pads = []; OW.oasisWater = -1e9; OW.pit = null;
  // 8. eau profonde (on n'y marche plus) et pentes
  const steep = new Uint8Array(n), water = new Uint8Array(n);
  for (let j = 1; j < NZ - 1; j++) {
    for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i;
      if (H[k] < MA.water - MA.wade) { water[k] = 1; continue; }
      const s = Math.max(Math.abs(H[k + 1] - H[k - 1]) / (2 * STEP), Math.abs(H[k + NX] - H[k - NX]) / (2 * STEP));
      steep[k] = maSteepRule(k, s, bio[k]);
    }
  }
  OW.steep = steep; OW.water = water;
}
/* Pente trop raide : la pierre apparaît (rare : seul le tertre des pierres est raide). */
function maSteepRule(k, s, b) {
  if (s > 0.85) { if (OW.bio[k] !== OWB.SILT) OW.bio[k] = OWB.STONE_MA; return 1; }
  return 0;
}
/* Île sous un point (la plus proche dont on est dans le rayon, avec la rive bruitée), ou null. */
function maIslandAt(x, z, slack = 1.15) {
  let best = null, bq = slack;
  for (const I of MA.islands) {
    if (Math.abs(x - I.x) > I.r * 2.2 || Math.abs(z - I.z) > I.r * 2.2) continue;
    const q = maIslandQ(I, x, z);
    if (q < bq) { bq = q; best = I; }
  }
  return best;
}
/* Profondeur d'eau (m, positive dans l'eau) ; hauteur du fond. */
const maDepth = (x, z) => MA.water - owH(x, z);
const maDeep = (x, z) => maDepth(x, z) > MA.wade;

/* Couleur du sol (linéaire) : vase, mousse, tourbe ; plus sombre et plus brillante près de l'eau ;
   sous l'eau, le limon (la couleur de l'eau fait le reste). */
const _maCol = new THREE.Color(), _maCol2 = new THREE.Color();
function maGroundColor(k, x, z, out) {
  const b = OW.bio[k], h = OW.H[k];
  const n = owNoise(x / 7, z / 7), n2 = owNoise(x / 43 + 3, z / 43 - 7), n3 = owNoise(x / 2.3, z / 2.3);
  switch (b) {
    case OWB.MOSS: {
      // mousse en plaques, tourbe et feuilles mortes entre elles (pas une pelouse)
      _maCol.setHex(MAC.moss).lerp(_maCol2.setHex(MAC.mossLight), clamp(n * 0.7 + (n2 - 0.5) * 0.5 + (n3 - 0.5) * 0.25, 0, 1));
      const p = owNoise(x / 9 + 5, z / 9 + 1) * 0.7 + owNoise(x / 3.1 - 2, z / 3.1 + 4) * 0.3;
      _maCol.lerp(_maCol2.setHex(MAC.peatLight), owSmoothstep(0.5, 0.72, p) * 0.75);
      break;
    }
    case OWB.PEAT: _maCol.setHex(MAC.peat).lerp(_maCol2.setHex(MAC.peatLight), clamp(n * 0.6 + (n3 - 0.5) * 0.3, 0, 1)); break;
    case OWB.STONE_MA: _maCol.setHex(MAC.stone).lerp(_maCol2.setHex(MAC.stoneDark), clamp(n * 0.8 + (n2 - 0.5) * 0.3, 0, 1)); break;
    case OWB.REEDS: _maCol.setHex(MAC.reeds).lerp(_maCol2.setHex(MAC.silt), clamp(0.4 + (n - 0.5) * 0.8, 0, 1)); break;
    case OWB.SILT: _maCol.setHex(MAC.silt).lerp(_maCol2.setHex(MAC.siltDeep), clamp(-h / 6 + (n2 - 0.5) * 0.4, 0, 1)); break;
    case OWB.BOARDS_MA: _maCol.setHex(MAC.boards); break;
    default: _maCol.setHex(MAC.mud).lerp(_maCol2.setHex(MAC.mudWet), clamp(0.3 + (n - 0.5) * 0.6 + (n3 - 0.5) * 0.3, 0, 1));
  }
  // berge détrempée : plus sombre juste au-dessus de l'eau
  if (h > -0.3 && h < 0.5) _maCol.multiplyScalar(lerp(0.72, 1, owSmoothstep(-0.1, 0.5, h)));
  out.copy(_maCol).convertSRGBToLinear();
  return out;
}
/* Grain du sol : vase craquelée, feuilles mortes, brindilles ; répété tous les 8 m (UV du terrain). */
function maGroundTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const n = valueNoise(S, S, [[8, 8, 1], [32, 32, 0.6], [96, 96, 0.3]], 1.6);
  const rnd = mulberry32(1931);
  paintPixels(g, S, S, (x, y, col) => {
    const v = 226 + (n[y * S + x] - 0.5) * 46 + (rnd() - 0.5) * 14;
    col[0] = v; col[1] = v * 0.98; col[2] = v * 0.93;
  });
  // feuilles mortes et brindilles
  for (let i = 0; i < 180; i++) {
    const x = rnd() * S, y = rnd() * S, r = 1.2 + rnd() * 3, a = rnd() * TAU;
    const v = 150 + rnd() * 60;
    g.fillStyle = `rgba(${v | 0},${(v * 0.88) | 0},${(v * 0.66) | 0},0.55)`;
    g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.8, a, 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(70,60,48,0.5)';
  for (let i = 0; i < 60; i++) { const x = rnd() * S, y = rnd() * S, a = rnd() * TAU, l = 4 + rnd() * 12; g.lineWidth = 0.6 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const t = toTex(c);
  t.anisotropy = 8;
  return t;
}
function maTerrainMat() {
  if (MA.terMat) return MA.terMat;
  MA.terMat = share(new THREE.MeshStandardMaterial({ vertexColors: true, map: (MA.groundTex || (MA.groundTex = share(maGroundTexture()))), roughness: 0.93, metalness: 0 }));
  // le reflet de la lune en incidence rasante (Fresnel) blanchissait la vase : atténué
  // kit 2.0.7 : sol mouillé par la pluie (ma17 : MA.terWet de 0 à 1) : plus sombre, plus lisse, il brille
  // (lanternes, projecteur, éclairs) ; le creux des bosses garde l'eau plus longtemps (bruit de la texture)
  MA.terWet = MA.terWet || { value: 0 };
  MA.terMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = MA.terWet;
    sh.fragmentShader = 'uniform float uWet;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float maWet = uWet * (0.75 + 0.25 * smoothstep(0.55, 0.25, dot(diffuseColor.rgb, vec3(0.33))));\n  diffuseColor.rgb *= 1.0 - 0.34 * maWet;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.42, maWet);')
      .replace('#include <aomap_fragment>', 'reflectedLight.directSpecular *= mix(0.4, 0.95, maWet);\n  reflectedLight.indirectSpecular *= mix(0.6, 0.85, maWet);\n#include <aomap_fragment>');
  };
  MA.terMat.customProgramCacheKey = () => 'marais-terrain-2';
  return MA.terMat;
}

/* --------------------------------------------------------------- Textures -- */
/* Bardage : planches verticales de bois gris, restes de peinture vert-de-gris en longues écailles,
   pied noirci par l'humidité, clous et coulures de rouille. */
function maTgSiding(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, n = Math.max(1, Math.round(w / (0.22 * ppm))), cw = w / n;
    const img = g.createImageData(w, h), d = img.data;
    const grain = vnoise(w, h, [[Math.max(8, (w / 3) | 0), 6, 1], [Math.max(4, (w / 9) | 0), 3, 0.5]], 1.3, R);
    const paint = vnoise(w, h, [[40, 6, 1], [80, 12, 0.45]], 1.8, R);   // longues écailles verticales
    const stain = vnoise(w, h, [[6, 4, 1], [16, 10, 0.4]], 1.4, R);
    const tones = []; for (let i = 0; i < n; i++) tones.push(0.8 + R() * 0.32);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, q = i * 4, b = Math.min(n - 1, Math.floor(x / cw)), bx = (x - b * cw) / cw;
      let c = shadec([96, 87, 74], tones[b] * (0.76 + 0.42 * grain[i]));
      const pv = paint[i] - (y / h) * 0.12;
      if (pv > 0.6) c = mixc(c, [116, 122, 110], clamp((pv - 0.6) * 4, 0, 0.5));
      const wet = clamp((y / h - 0.7) / 0.3, 0, 1) * (0.55 + 0.45 * stain[i]);
      c = mixc(c, [46, 52, 38], wet * 0.75);
      if (bx < 0.035) c = shadec(c, 0.32); else if (bx < 0.06) c = shadec(c, 0.68); else if (bx > 0.965) c = shadec(c, 1.12);
      d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let b = 0; b < n; b++) for (const yy of [0.08, 0.56]) {
      const x = b * cw + cw * 0.5, y = h * yy + (R() - 0.5) * 6, L = 10 + R() * 60;
      g.fillStyle = 'rgba(34,26,20,0.9)'; g.fillRect(x - 1.5, y - 1.5, 3, 3);
      const grd = g.createLinearGradient(0, y, 0, y + L);
      grd.addColorStop(0, 'rgba(96,52,26,0.45)'); grd.addColorStop(1, 'rgba(96,52,26,0)');
      g.fillStyle = grd; g.fillRect(x - 1, y, 2, L);
    }
  };
}
/* Écorce de cyprès chauve : fibres verticales, sillons sombres, crêtes gris-brun, taches rousses et
   lichens pâles. */
function maTgBark() {
  return (g, w, h, R) => {
    const img = g.createImageData(w, h), d = img.data;
    const ridge = vnoise(w, h, [[48, 3, 1], [96, 6, 0.5], [24, 2, 0.6]], 1.5, R);
    const fine = vnoise(w, h, [[160, 12, 1]], 1.2, R);
    const patch = vnoise(w, h, [[16, 4, 1], [40, 10, 0.5]], 1.6, R);
    for (let i = 0; i < w * h; i++) {
      const q = i * 4, r = ridge[i];
      let c = r < 0.42 ? mixc([34, 27, 23], [68, 56, 46], r / 0.42) : mixc([82, 68, 56], [126, 112, 96], clamp((r - 0.42) / 0.5, 0, 1));
      c = shadec(c, 0.8 + 0.32 * fine[i]);
      if (patch[i] > 0.72) c = mixc(c, [108, 114, 96], clamp((patch[i] - 0.72) * 3, 0, 0.35));
      else if (patch[i] < 0.24) c = mixc(c, [100, 70, 52], 0.22);
      d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };
}
/* Kit MM 2.1.5 : métaux et toitures retravaillés (la rouille d'avant, orange vif en taches, se lisait mal
   et s'étirait sur les grandes pièces). Tôle ondulée galvanisée, rouille qui coule dans les creux ;
   rouille brune piquée ; acier peint (gris-vert, coque presque noire) en tôles rivetées, coulures
   sous les rivets ; bardeaux de bois ; béton coffré gris, coulures, peu de mousse. */
function maStreak(g, w, h, x, y0, len, wd, rgb, a) {
  for (const oy of [0, -h]) {
    const gr = g.createLinearGradient(0, y0 + oy, 0, y0 + oy + len);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - wd / 2, y0 + oy, wd, len);
  }
}
function maTgTin() {
  return (g, w, h, R) => {
    tgCorrugated({ tile: 2, color: [118, 112, 100], rust: 0.5, seams: true })(g, w, h, R);
    const ppm = w / 2, pitch = 0.076 * ppm, k = w / 512;
    for (let i = 0; i < 52; i++) {
      const x = (Math.floor(R() * (w / pitch)) + 0.75) * pitch;
      maStreak(g, w, h, x, R() * h, (60 + R() * 300) * k, (2 + R() * 3.5) * k, '108,50,22', 0.3 + R() * 0.3);
    }
    grime(g, w, h, R, { stains: 5, specks: 80, dark: [30, 26, 20] });
  };
}
function maTgRust() {
  return (g, w, h, R) => {
    fillBase(g, w, h, [72, 52, 40], R, [[4, 4, 1], [16, 16, 0.7], [64, 64, 0.5]], 0.45, 2.0);
    rustify(g, w, h, R, 0.62);
    const k = w / 512;
    for (let i = 0; i < 18; i++) maStreak(g, w, h, R() * w, R() * h, (60 + R() * 220) * k, (2 + R() * 5) * k, '40,24,14', 0.25 + R() * 0.25);
    grime(g, w, h, R, { stains: 8, specks: 300, dark: [28, 16, 10] });
  };
}
function maTgSteel(o) {
  return (g, w, h, R) => {
    const ppm = w / 2, k = w / 512;
    fillBase(g, w, h, o.color, R, [[4, 8, 1], [16, 32, 0.4], [64, 64, 0.25]], 0.2, 1.8);
    // tôles d'un mètre de haut, joints décalés, rangs de rivets
    g.fillStyle = 'rgba(0,0,0,0.38)';
    for (const yy of [0, h / 2]) g.fillRect(0, yy, w, 2.2 * k);
    g.fillRect(0, 0, 2.2 * k, h / 2); g.fillRect(w / 2, h / 2, 2.2 * k, h / 2);
    for (const yy of [6 * k, h / 2 + 6 * k]) for (let x = 0.06 * ppm; x < w; x += 0.12 * ppm) {
      g.fillStyle = 'rgba(16,14,12,0.6)'; g.beginPath(); g.arc(x, yy, 2.6 * k, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,250,240,0.12)'; g.beginPath(); g.arc(x - 0.8 * k, yy - 0.8 * k, 1.2 * k, 0, TAU); g.fill();
    }
    rustify(g, w, h, R, o.rust);
    for (let i = 0; i < o.streaks; i++) {
      const row = R() < 0.5 ? 0 : 0.5;
      maStreak(g, w, h, (Math.floor(R() * 16.6) + 0.5) * 0.12 * ppm, h * row + 7 * k, (80 + R() * 320) * k, (2 + R() * 4) * k, '106,46,18', 0.35 + R() * 0.3);
    }
    grime(g, w, h, R, { stains: 6, specks: 140, drips: 6, dark: [20, 18, 14] });
  };
}
function maTgShingle() {
  return (g, w, h, R) => {
    const ppm = w / 2, k = w / 512, rows = Math.round(h / (0.19 * ppm)), rh = h / rows;
    g.fillStyle = 'rgb(24,20,16)'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      let x = -R() * 0.2 * ppm;
      const y0 = r * rh;
      while (x < w) {
        const sw = (0.1 + R() * 0.2) * ppm, base = shadec([96, 86, 72], 0.66 + R() * 0.45);
        const gr = g.createLinearGradient(0, y0, 0, y0 + rh);
        gr.addColorStop(0, rgbS(shadec(base, 1.08))); gr.addColorStop(0.6, rgbS(base)); gr.addColorStop(1, rgbS(shadec(base, 0.5)));
        g.fillStyle = gr; g.fillRect(x + k, y0 + 1.5 * k, sw - 2 * k, rh - 1.5 * k);
        g.strokeStyle = rgbS(shadec(base, 0.62), 0.5); g.lineWidth = k;
        for (let j = 0; j < 3; j++) { const xx = x + R() * sw; g.beginPath(); g.moveTo(xx, y0 + 2 * k); g.lineTo(xx + (R() - 0.5) * 2 * k, y0 + rh * 0.8); g.stroke(); }
        x += sw;
      }
    }
    overlay(g, w, h, R, { moss: 0.5 });
    grime(g, w, h, R, { stains: 8, specks: 120 });
  };
}
(function maTextures() {
  defTex('ma_planks', 'Planches pourries (Marais)', 'bois', { size: [2, 2] }, tgPlanks({ tile: 2, colors: [[92, 80, 62], [84, 74, 58], [100, 88, 70]], width: 0.2, len: 1.7, nails: true, gap: 0.85, stains: 12, moss: 0.5 }));
  defTex('ma_siding', 'Bardage délavé (Marais)', 'bois', { size: [2, 2] }, maTgSiding({ tile: 2 }));
  defTex('ma_deck', 'Ponton (Marais)', 'exterieur', { size: [2, 2] }, tgPlanks({ tile: 2, colors: [[78, 68, 54], [70, 62, 50], [88, 76, 60]], width: 0.18, len: 2.2, nails: true, gap: 0.95, stains: 10, moss: 0.4 }));
  defTex('ma_tin', 'Tôle rouillée (Marais)', 'toit', { size: [2, 2], rough: 0.68, metal: 0.3 }, maTgTin());
  defTex('ma_logs', 'Rondins (Marais)', 'bois', { size: [2, 2] }, tgLogs({ tile: 2, color: [70, 58, 44], log: 0.26, moss: 0.4 }));
  defTex('ma_concrete', 'Béton taché (Marais)', 'beton', { size: [3, 3] }, tgConcrete({ base: [120, 118, 108], form: 3, stains: 12, cracks: 5, drips: 22, moss: 0.14 }));
  defTex('ma_rust', 'Acier rouillé (Marais)', 'metal', { size: [2, 2], rough: 0.78, metal: 0.35 }, maTgRust());
  defTex('ma_steel', 'Acier peint rouillé (Marais)', 'metal', { size: [2, 2], rough: 0.62, metal: 0.3 }, maTgSteel({ color: [100, 106, 98], rust: 0.42, streaks: 26 }));
  defTex('ma_hull', 'Coque goudronnée (Marais)', 'metal', { size: [2, 2], rough: 0.7, metal: 0.25 }, maTgSteel({ color: [50, 56, 50], rust: 0.4, streaks: 30 }));
  defTex('ma_shingle', 'Bardeaux (Marais)', 'toit', { size: [2, 2] }, maTgShingle());
  defTex('ma_panel', 'Panneaux du laboratoire (Marais)', 'metal', { size: [2, 2], rough: 0.6, metal: 0.2 }, tgPanels({ tile: 2, color: [150, 152, 138], panel: 1, screws: true, stripe: [120, 64, 40], moss: 0.3 }));
  defTex('ma_stone', 'Pierre levée (Marais)', 'brique', { size: [2, 2] }, tgConcrete({ base: [96, 98, 88], stains: 6, cracks: 6, moss: 0.9 }));
  defTex('ma_bark', 'Écorce de cyprès (Marais)', 'bois', { size: [1, 2] }, maTgBark());
})();
