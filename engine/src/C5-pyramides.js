/* ------------------------------------------------ Intérieur des pyramides (jeu 2.0.3) --
   Les trois pyramides du plateau (B) se visitent. Au pied de la face nord de chacune, un portail
   fermé par une herse de granit payante (Khéops 2 500, Khéphren 2 000, Mykérinos 1 500 points ;
   prix réglable dans les Mod Tools), puis des salles inspirées des vraies, élargies pour le jeu
   (couloirs de 3 m, pentes de 26°), toutes au-dessus du plateau :
     Khéops     passage du portail, tunnel d'al-Mamoun, carrefour (bouchons de granit, couloir
                descendant fermé), couloir ascendant, pied de la Grande Galerie, couloir et chambre
                de la Reine (toit en chevrons, niche), Grande Galerie (voûte en encorbellement),
                Grande Marche, antichambre (herses dans leurs rainures), chambre du Roi (granit,
                sarcophage, conduits) : la boîte mystère peut s'y poser.
     Khéphren   couloir inférieur, chambre annexe, couloir remontant, couloir horizontal (herse),
                chambre funéraire de Belzoni (sarcophage enfoncé dans le sol, inscription de 1818).
     Mykérinos  couloir d'entrée, chambre aux panneaux, passage des trois herses, antichambre,
                couloir descendant, salle aux six niches, caveau de granit (voûte en berceau).
   Le monde : chaque salle est faite de cases de la grille des solides (sols, rampes, plafonds,
   toit : la pente de la pyramide au-dessus, sur laquelle on marche encore) taillées dans les cases
   pleines de la pyramide ; un maillage suit ces cases (sols, murs, contremarches, linteaux,
   plafonds plats, en chevrons, en encorbellement ou en berceau). La face nord est échancrée
   derrière chaque portail. Dedans : lumière des lampes du chantier (pas de soleil), pas de tempête ;
   les zombies sortent du sable des salles ouvertes autour du joueur, ceux du dehors entrent par la
   porte. Tout est dans le décor des lieux : « Intérieur de … » (surfaces : sol, murs, plafond de
   chaque salle, lampes, sable), son portail, sa herse (porte payante), sarcophages, bouchons… ;
   les Mod Tools les retouchent comme le reste et le jeu suit. Coordonnées des plans : u vers l'est,
   v vers le sud depuis le centre de la pyramide, hauteurs depuis le pied (y0). */
(function khPyrTextures() {
  defTex('kh_limestone', 'Calcaire fin (Khamsin)', 'brique', { size: [4, 4] }, tgBrick({ tile: 4, colors: [[222, 208, 180], [214, 200, 172], [228, 216, 190]], bw: 1.6, bh: 0.8, mortar: 0.005, mortarColor: [176, 162, 136], stains: 7 }));
  defTex('kh_pyrstone', 'Pierre des pyramides (Khamsin)', 'brique', { size: [4, 4] }, tgBrick({ tile: 4, colors: [[208, 184, 150], [198, 174, 140], [216, 192, 158]], bw: 1.7, bh: 1.0, mortar: 0.012, mortarColor: [150, 128, 100], stains: 8 }));
  defTex('kh_granite', 'Granit rose (Khamsin)', 'brique', { size: [3, 3], rough: 0.55 }, (g, w, h, R) => {
    const n = vnoise(w, h, [[5, 5, 1], [20, 20, 0.5], [80, 80, 0.3]], 1.6, R);
    paintPixels(g, w, h, (x, y, c) => { const k = 0.84 + 0.22 * n[y * w + x]; c[0] = 172 * k; c[1] = 108 * k; c[2] = 96 * k; });
    // grains : mica noir, quartz gris, feldspath rose
    const s = w / 512, N = Math.round((w * h) / 36);
    for (let i = 0; i < N; i++) {
      const r = R(), sz = (0.8 + R() * 2.4) * s;
      g.fillStyle = r < 0.42 ? `rgba(28,22,24,${0.45 + R() * 0.45})` : r < 0.72 ? `rgba(214,206,200,${0.3 + R() * 0.4})` : `rgba(200,110,92,${0.35 + R() * 0.4})`;
      g.fillRect(R() * w, R() * h, sz, sz * (0.5 + R()));
    }
    // joints des blocs (1,5 × 1 m, décalés d'une assise à l'autre)
    const ppm = w / 3, jw = Math.max(1, 1.2 * s);
    g.fillStyle = 'rgba(48,26,22,0.6)';
    for (let r = 0; r < 3; r++) {
      g.fillRect(0, r * ppm, w, jw);
      for (let x = (r % 2) * 0.75 * ppm; x < w; x += 1.5 * ppm) g.fillRect(x, r * ppm, jw, ppm);
    }
    grime(g, w, h, R, { stains: 3, specks: 40 });
  });
  defTex('kh_sand', 'Sable (Khamsin)', 'sol', { size: [3, 3] }, tgConcrete({ base: [214, 178, 128], stains: 2, cracks: 0 }));
})();

/* Plans. Une salle : parts [{ r: [u0, v0, u1, v1], f (sol plat) | ramp: [axe 'u' ou 'v', sol au bord
   u0/v0, sol au bord u1/v1], open: 'n' (côté sans mur : la bouche du portail) }], h (hauteur sous
   plafond plat) ou vault { kind: 'gable-u' (faîtage est-ouest), 'gable-v', 'corbel-v' (encorbellement,
   couloir nord-sud), 'vault-u' (berceau est-ouest), hw (murs droits), top (sommet), steps }, tex
   { w, f, c } (murs, sol, plafond), hex (teintes), sand (tas de sable : les zombies en sortent),
   lamps [[u, v]] (ampoules suspendues). */
const KHPY_LIME = { w: 'kh_limestone', f: 'kh_limestone', c: 'kh_limestone' };
const KHPY_LIME_HEX = { w: 0xffffff, f: 0xd8c8a8, c: 0xe8dcc4 };
const KHPY_GRAN = { w: 'kh_granite', f: 'kh_granite', c: 'kh_granite' };
const KHPY_GRAN_HEX = { w: 0xffffff, f: 0xd8c0b8, c: 0xe0ccc4 };
const KHPY_PORCH = { w: 'kh_pyrstone', f: 'kh_limestone', c: 'kh_pyrstone' };
const KHPY_DEFS = [
  {
    key: 'kheops', name: 'Khéops', pi: 0, cost: 2500,
    portal: { u0: 2, u1: 13, open: [6, 9], oh: 4, top: 9.2, tex: 'kh_pyrstone', hex: 0xcdb08c, frame: 'kh_pyrstone', chevron: true, sign: 'PYRAMIDE DE KHÉOPS' },
    rooms: [
      { id: 'porche', name: 'Passage du portail', parts: [{ r: [6, -103, 9, -95], f: 0.3, open: 'n' }], h: 4, tex: KHPY_PORCH, hex: { w: 0xead8bc, f: 0xd8c8a8, c: 0xe0ccb0 } },
      { id: 'tunnel', name: 'Tunnel d’al-Mamoun', parts: [{ r: [6, -95, 9, -78], f: 0.3 }], h: 4, tex: { w: 'kh_rock', f: 'kh_rock', c: 'kh_rock' }, hex: { w: 0xead2b0, f: 0xd0b894, c: 0xdcc4a2 }, sand: [[7.5, -86]], lamps: [[7.5, -92], [7.5, -82]] },
      { id: 'carrefour', name: 'Carrefour', parts: [{ r: [4, -78, 11, -71], f: 0.3 }], h: 4.4, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[5.5, -73.5], [7.2, -76]], lamps: [[7, -74.5]] },
      { id: 'montant', name: 'Couloir ascendant', parts: [{ r: [6, -71, 9, -41], ramp: ['v', 0.3, 15.3] }], h: 3.6, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[7.5, -56]], lamps: [[7.5, -66], [7.5, -56], [7.5, -46]] },
      { id: 'palier', name: 'Pied de la Grande Galerie', parts: [{ r: [4, -41, 11, -35], f: 15.3 }], h: 3.6, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[5.5, -37]], lamps: [[7.5, -38]] },
      { id: 'reine-c', name: 'Couloir de la chambre de la Reine', parts: [{ r: [-4, -40, 4, -37], f: 15.3 }, { r: [-4, -37, -1, -12], f: 15.3 }], h: 3.2, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[-2.5, -24]], lamps: [[0, -38.5], [-2.5, -30], [-2.5, -18]] },
      { id: 'reine', name: 'Chambre de la Reine', parts: [{ r: [-7, -12, 2, -4], f: 15.3 }], vault: { kind: 'gable-u', hw: 4, top: 7 }, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[-5, -6], [0, -10]], lamps: [[-2.5, -8]] },
      { id: 'niche', name: 'Niche de la chambre de la Reine', parts: [{ r: [2, -10, 3, -7], f: 15.3 }], h: 3, tex: KHPY_LIME, hex: KHPY_LIME_HEX },
      { id: 'galerie', name: 'Grande Galerie', parts: [{ r: [6, -35, 10, -3], ramp: ['v', 15.3, 31.3] }], vault: { kind: 'corbel-v', hw: 3.6, top: 8.7, steps: 6 }, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[8, -27], [8, -12]], lamps: [[8, -31], [8, -23], [8, -15], [8, -7]] },
      { id: 'marche', name: 'Grande Marche', parts: [{ r: [6, -3, 10, 0], f: 31.3 }], h: 3.6, tex: KHPY_LIME, hex: KHPY_LIME_HEX },
      { id: 'ante', name: 'Antichambre', parts: [{ r: [5, 0, 11, 6], f: 31.3 }], h: 4.2, tex: { w: 'kh_granite', f: 'kh_limestone', c: 'kh_limestone' }, hex: { w: 0xffffff, f: 0xd8c8a8, c: 0xe8dcc4 }, sand: [[6, 4.5]], lamps: [[8, 1.2]] },
      { id: 'roi', name: 'Chambre du Roi', parts: [{ r: [-9, 6, 11, 15], f: 31.3 }], h: 6, tex: KHPY_GRAN, hex: KHPY_GRAN_HEX, sand: [[-7, 13], [1, 8], [8.5, 13], [4.5, 13.5], [-4, 7.2]], lamps: [[-4, 10.5], [5, 10.5]] },
    ],
  },
  {
    key: 'khephren', name: 'Khéphren', pi: 1, cost: 2000,
    portal: { u0: 6, u1: 17, open: [10, 13], oh: 3.8, top: 8.8, tex: 'kh_pyrstone', hex: 0xcdb08c, frame: 'kh_granite', sign: 'PYRAMIDE DE KHÉPHREN' },
    rooms: [
      { id: 'porche', name: 'Passage du portail', parts: [{ r: [10, -88, 13, -80], f: 0.3, open: 'n' }], h: 3.8, tex: KHPY_PORCH, hex: { w: 0xead8bc, f: 0xd8c8a8, c: 0xe0ccb0 } },
      { id: 'bas', name: 'Couloir inférieur', parts: [{ r: [10, -80, 13, -62], f: 0.3 }], h: 3.8, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[11.5, -72]], lamps: [[11.5, -76], [11.5, -66]] },
      { id: 'annexe-c', name: 'Passage de la chambre annexe', parts: [{ r: [3, -70, 10, -67], f: 0.3 }], h: 3.2, tex: KHPY_LIME, hex: KHPY_LIME_HEX },
      { id: 'annexe', name: 'Chambre annexe', parts: [{ r: [-9, -73, 3, -64], f: 0.3 }], vault: { kind: 'gable-u', hw: 3.6, top: 6 }, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[-7, -68.5], [0, -66]], lamps: [[-3, -68.5]] },
      { id: 'remontee', name: 'Couloir remontant', parts: [{ r: [10, -62, 13, -46], ramp: ['v', 0.3, 8.3] }], h: 3.8, tex: KHPY_LIME, hex: KHPY_LIME_HEX, lamps: [[11.5, -54]] },
      { id: 'haut', name: 'Couloir horizontal', parts: [{ r: [10, -46, 13, -12], f: 8.3 }], h: 3.8, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[11.5, -33], [11.5, -18]], lamps: [[11.5, -43], [11.5, -33], [11.5, -23], [11.5, -14]] },
      { id: 'belzoni', name: 'Chambre funéraire (Belzoni)', parts: [{ r: [-10, -12, 14, -2], f: 8.3 }], vault: { kind: 'gable-u', hw: 4.5, top: 8.5 }, tex: KHPY_LIME, hex: { w: 0xf0e4cc, f: 0xd0c0a0, c: 0xe8dcc4 }, sand: [[-2, -9.5], [3, -4], [10, -9]], lamps: [[-4, -7], [6, -7]] },
    ],
  },
  {
    key: 'mykerinos', name: 'Mykérinos', pi: 2, cost: 1500,
    portal: { u0: -5, u1: 6, open: [-1, 2], oh: 3.6, top: 8.4, tex: 'kh_granite', hex: 0xffffff, frame: 'kh_granite', sign: 'PYRAMIDE DE MYKÉRINOS' },
    rooms: [
      { id: 'porche', name: 'Passage du portail', parts: [{ r: [-1, -48, 2, -40], f: 0.3, open: 'n' }], h: 3.6, tex: { w: 'kh_granite', f: 'kh_limestone', c: 'kh_granite' }, hex: { w: 0xffffff, f: 0xd8c8a8, c: 0xe8d4cc } },
      { id: 'pente', name: 'Couloir d’entrée', parts: [{ r: [-1, -40, 2, -32], ramp: ['v', 0.3, 4.3] }], h: 3.6, tex: KHPY_LIME, hex: KHPY_LIME_HEX, lamps: [[0.5, -36]] },
      { id: 'panneaux', name: 'Chambre aux panneaux', parts: [{ r: [-3, -32, 4, -26], f: 4.3 }], h: 4, tex: KHPY_LIME, hex: { w: 0xf2e6d0, f: 0xd8c8a8, c: 0xe8dcc4 }, sand: [[0.5, -28.4]], lamps: [[0.5, -29]] },
      { id: 'herses', name: 'Passage des herses', parts: [{ r: [-1, -26, 2, -14], f: 4.3 }], h: 3.6, tex: KHPY_LIME, hex: KHPY_LIME_HEX, lamps: [[0.5, -21.5]] },
      { id: 'ante', name: 'Antichambre', parts: [{ r: [-8, -14, 9, -8], f: 4.3 }], h: 4.5, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[-6, -11], [7, -10]], lamps: [[-3, -11], [5, -11]] },
      { id: 'descente', name: 'Couloir descendant', parts: [{ r: [-16, -12, -8, -9], ramp: ['u', 0.3, 4.3] }], h: 3.4, tex: KHPY_LIME, hex: KHPY_LIME_HEX, lamps: [[-12, -10.5]] },
      { id: 'bas', name: 'Couloir inférieur', parts: [{ r: [-19, -12, -16, 6], f: 0.3 }], h: 3.4, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[-17.5, -3]], lamps: [[-17.5, -8], [-17.5, 2]] },
      { id: 'niches-c', name: 'Passage de la salle aux niches', parts: [{ r: [-16, -1, -14, 1], f: 0.3 }], h: 3, tex: KHPY_LIME, hex: KHPY_LIME_HEX },
      { id: 'niches', name: 'Salle aux six niches', parts: [{ r: [-14, -4, -8, 3], f: 0.3 }], h: 3.4, tex: KHPY_LIME, hex: KHPY_LIME_HEX, sand: [[-11, 1.5], [-12.5, -4.5, 0.42], [-7.5, -1.5, 0.42], [-7.5, 2.5, 0.42]], lamps: [[-11, -0.5]] },
      { id: 'niches-n', name: 'Niches', parts: [[-8, -4, -7, -3], [-8, -2, -7, -1], [-8, 0, -7, 1], [-8, 2, -7, 3], [-13, -5, -12, -4], [-10, -5, -9, -4]].map((r) => ({ r, f: 0.3 })), h: 2.2, tex: KHPY_LIME, hex: { w: 0xe8d8bc, f: 0xd0c0a0, c: 0xe0d4bc } },
      { id: 'caveau', name: 'Caveau de granit', parts: [{ r: [-22, 6, -10, 12], f: 0.3 }], vault: { kind: 'vault-u', hw: 3.4, top: 6.4 }, tex: KHPY_GRAN, hex: KHPY_GRAN_HEX, sand: [[-14, 8], [-12, 10.5]], lamps: [[-16, 9]] },
    ],
  },
];
const KHPY = { on: false, doors: [], spawns: [], items: [], view: 0, pz: null, cz: null, lastZone: null, meshes: [], g: {} };
/* Points d'un plan → monde. */
const khPyrP = (d) => KH.pyramids[d.pi];
const khPyrKey = (u, v) => (v + 512) * 1024 + (u + 512);
/* Sol d'une partie en (u, v) (relatif au pied). */
function khPyrF(pt, u, v) {
  if (!pt.ramp) return pt.f;
  const [ax, fa, fb] = pt.ramp, r = pt.r;
  const t = ax === 'v' ? (v - r[1]) / (r[3] - r[1]) : (u - r[0]) / (r[2] - r[0]);
  return fa + (fb - fa) * clamp(t, 0, 1);
}
/* Hauteur des murs droits d'une salle ; hauteur du plafond au point (u, v) d'une partie (au-dessus du sol). */
const khPyrHw = (room) => (room.vault ? room.vault.hw : room.h);
function khPyrCeilH(room, pt, u, v) {
  const V = room.vault;
  if (!V) return room.h;
  const [u0, v0, u1, v1] = pt.r;
  if (V.kind === 'corbel-v') return V.top;
  if (V.kind === 'gable-u' || V.kind === 'gable-v') {
    const half = V.kind === 'gable-u' ? (v1 - v0) / 2 : (u1 - u0) / 2, m = V.kind === 'gable-u' ? (v0 + v1) / 2 : (u0 + u1) / 2;
    const d = Math.abs((V.kind === 'gable-u' ? v : u) - m);
    return V.hw + (V.top - V.hw) * clamp(1 - d / half, 0, 1);
  }
  const R = (v1 - v0) / 2, d = Math.abs(v - (v0 + v1) / 2);      // berceau est-ouest
  return V.hw + Math.sqrt(Math.max(0, R * R - d * d));
}
/* Toutes les cases d'un plan : clé → { room, pt }. */
function khPyrCellMap(d) {
  if (d._M) return d._M;
  const M = new Map();
  for (const room of d.rooms) for (const pt of room.parts) {
    const [u0, v0, u1, v1] = pt.r;
    for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) M.set(khPyrKey(u, v), { room, pt });
  }
  d._M = M;
  return M;
}
/* Dessus des cases pleines de la pyramide (comme owRasterPyramids) au centre d'une case. */
function khPyrRasterTop(P, cx, cz) {
  const m = Math.max(Math.abs(cx + 0.5 - P.x), Math.abs(cz + 0.5 - P.z)) / (P.side / 2);
  return m > 1 ? -Infinity : P.y0 + P.h * (1 - m) + 0.2;
}

/* ---- Maillage : faces orientées (normale de Newell, sens corrigé vers « want »), texture en mètres */
function khFace(K, tex, hex, pts, want, uvOf) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const L = Math.hypot(nx, ny, nz);
  if (L < 1e-6) return;
  nx /= L; ny /= L; nz /= L;
  let P = pts;
  if (nx * want[0] + ny * want[1] + nz * want[2] < 0) { P = pts.slice().reverse(); nx = -nx; ny = -ny; nz = -nz; }
  if (P.length === 4) K.quad(tex, hex, P[0], P[1], P[2], P[3], [nx, ny, nz], uvOf);
  else K.tri(tex, hex, P[0], P[1], P[2], [nx, ny, nz], uvOf);
}
const KHPY_UV = { xz: (p) => [p[0], p[2]], xy: (p) => [p[0], p[1]], zy: (p) => [p[2], p[1]] };
/* Boîte orientée : centre c, axes X, Y, Z (unitaires), demi-tailles ex, ey, ez ; skip : faces omises. */
function khOBox(K, tex, hex, c, X, Y, Z, ex, ey, ez, skip = []) {
  const pt = (a, b, d) => [c[0] + X[0] * a + Y[0] * b + Z[0] * d, c[1] + X[1] * a + Y[1] * b + Z[1] * d, c[2] + X[2] * a + Y[2] * b + Z[2] * d];
  const F = [
    ['px', [ex, -ey, -ez], [ex, ey, -ez], [ex, ey, ez], [ex, -ey, ez], X, (q) => [q[1], q[2]]],
    ['nx', [-ex, -ey, -ez], [-ex, ey, -ez], [-ex, ey, ez], [-ex, -ey, ez], X.map((v) => -v), (q) => [q[1], q[2]]],
    ['py', [-ex, ey, -ez], [ex, ey, -ez], [ex, ey, ez], [-ex, ey, ez], Y, (q) => [q[0], q[2]]],
    ['ny', [-ex, -ey, -ez], [ex, -ey, -ez], [ex, -ey, ez], [-ex, -ey, ez], Y.map((v) => -v), (q) => [q[0], q[2]]],
    ['pz', [-ex, -ey, ez], [ex, -ey, ez], [ex, ey, ez], [-ex, ey, ez], Z, (q) => [q[0], q[1]]],
    ['nz', [-ex, -ey, -ez], [ex, -ey, -ez], [ex, ey, -ez], [-ex, ey, -ez], Z.map((v) => -v), (q) => [q[0], q[1]]],
  ];
  for (const [id, a, b, cc, dd, n, uvl] of F) {
    if (skip.includes(id)) continue;
    const loc = [a, b, cc, dd];
    const P = loc.map((q) => pt(q[0], q[1], q[2]));
    const map = new Map(P.map((p, i) => [p, loc[i]]));
    khFace(K, tex, hex, P, n, (p) => { const q = map.get(p); return q ? uvl(q) : [0, 0]; });
  }
}
/* Fosse (sarcophage) : caisse ouverte de x0..x1 × z0..z1, de y à y + h, parois d'épaisseur t. */
function khTrough(K, tex, hex, x0, z0, x1, z1, y, h, t) {
  K.box(tex, hex, x0, y, z0, x1, y + h, z1, { skip: ['top', 'bottom'] });
  K.box(tex, hex, x0, y + h - 0.02, z0, x1, y + h, z0 + t, { skip: ['bottom', 'nz', 'px', 'nx'] }).box(tex, hex, x0, y + h - 0.02, z1 - t, x1, y + h, z1, { skip: ['bottom', 'pz', 'px', 'nx'] });
  K.box(tex, hex, x0, y + h - 0.02, z0 + t, x0 + t, y + h, z1 - t, { skip: ['bottom', 'nx', 'pz', 'nz'] }).box(tex, hex, x1 - t, y + h - 0.02, z0 + t, x1, y + h, z1 - t, { skip: ['bottom', 'px', 'pz', 'nz'] });
  const a = x0 + t, b = x1 - t, c = z0 + t, e = z1 - t, f = y + 0.25, top = y + h - 0.02, dk = 0x6a5048;
  khFace(K, tex, dk, [[a, f, c], [b, f, c], [b, f, e], [a, f, e]], [0, 1, 0], KHPY_UV.xz);
  khFace(K, tex, dk, [[a, f, c], [b, f, c], [b, top, c], [a, top, c]], [0, 0, 1], KHPY_UV.xy);
  khFace(K, tex, dk, [[a, f, e], [b, f, e], [b, top, e], [a, top, e]], [0, 0, -1], KHPY_UV.xy);
  khFace(K, tex, dk, [[a, f, c], [a, f, e], [a, top, e], [a, top, c]], [1, 0, 0], KHPY_UV.zy);
  khFace(K, tex, dk, [[b, f, c], [b, f, e], [b, top, e], [b, top, c]], [-1, 0, 0], KHPY_UV.zy);
}

/* ---- Salles d'une pyramide : cases (sols, rampes, plafonds, toit) et surfaces de chaque salle. */
function khPyrRooms(K, d) {
  const P = khPyrP(d), y0 = P.y0, M = khPyrCellMap(d), half = P.side / 2;
  const portalTop = y0 + d.portal.top, zBack = P.z - half + 5;
  const X = (u) => P.x + u, Z = (v) => P.z + v, Y = (f) => y0 + f;
  // cases : sol plat ou rampe, plafond au centre, toit (la pente de la pyramide, ou le portail)
  for (const room of d.rooms) for (const pt of room.parts) {
    const [u0, v0, u1, v1] = pt.r;
    for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
      const cx = X(u), cz = Z(v), mid = khPyrF(pt, u + 0.5, v + 0.5), ceil = Y(mid + khPyrCeilH(room, pt, u + 0.5, v + 0.5));
      let roof = Math.max(khPyrRasterTop(P, cx, cz), ceil + 0.6);
      if (cz < zBack) roof = Math.max(roof, portalTop);
      const o = { ceil, roof, mat: OWM.STONE };
      if (pt.ramp) {
        const [ax] = pt.ramp;
        const a = khPyrF(pt, u, v), b = ax === 'v' ? khPyrF(pt, u, v + 1) : khPyrF(pt, u + 1, v);
        const up = b >= a;
        o.base = Y(Math.min(a, b)); o.top = Y(Math.max(a, b));
        o.dir = ax === 'v' ? (up ? 2 : 3) : (up ? 0 : 1);
        owSet(OW.surf, cx, cz, OWK.RAMP, o);
      } else { o.base = Y(pt.f); owSet(OW.surf, cx, cz, OWK.FLOOR, o); }
    }
  }
  const SIDES = [
    { du: 0, dv: -1, e: (u, v) => [[u, v], [u + 1, v]], want: [0, 0, 1], uv: KHPY_UV.xy, side: 'n' },
    { du: 0, dv: 1, e: (u, v) => [[u, v + 1], [u + 1, v + 1]], want: [0, 0, -1], uv: KHPY_UV.xy, side: 's' },
    { du: -1, dv: 0, e: (u, v) => [[u, v], [u, v + 1]], want: [1, 0, 0], uv: KHPY_UV.zy, side: 'w' },
    { du: 1, dv: 0, e: (u, v) => [[u + 1, v], [u + 1, v + 1]], want: [-1, 0, 0], uv: KHPY_UV.zy, side: 'e' },
  ];
  const wp = (e, f) => [X(e[0]), Y(f), Z(e[1])];
  for (const room of d.rooms) {
    const T = room.tex, H = room.hex, hw = khPyrHw(room);
    // sol (rampes : texture le long de la pente)
    K.group(`${room.name} · sol`, () => {
      for (const pt of room.parts) {
        const [u0, v0, u1, v1] = pt.r;
        const sl = pt.ramp ? Math.hypot(1, (pt.ramp[2] - pt.ramp[1]) / (pt.ramp[0] === 'v' ? v1 - v0 : u1 - u0)) : 1;
        const uv = !pt.ramp ? KHPY_UV.xz : pt.ramp[0] === 'v' ? (p) => [p[0], p[2] * sl] : (p) => [p[0] * sl, p[2]];
        for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
          const c = [[u, v], [u + 1, v], [u + 1, v + 1], [u, v + 1]];
          khFace(K, T.f, H.f, c.map((e) => wp(e, khPyrF(pt, e[0], e[1]))), [0, 1, 0], uv);
        }
      }
    });
    // murs, contremarches (sol voisin plus haut), linteaux (plafond voisin plus bas)
    K.group(`${room.name} · murs`, () => {
      for (const pt of room.parts) {
        const [u0, v0, u1, v1] = pt.r;
        for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
          for (const S of SIDES) {
            const N = M.get(khPyrKey(u + S.du, v + S.dv)), [e1, e2] = S.e(u, v);
            const f1 = khPyrF(pt, e1[0], e1[1]), f2 = khPyrF(pt, e2[0], e2[1]);
            if (!N) {
              if (pt.open === S.side && ((S.side === 'n' && v === v0) || (S.side === 's' && v === v1 - 1))) continue;
              khFace(K, T.w, H.w, [wp(e1, f1), wp(e2, f2), wp(e2, f2 + hw), wp(e1, f1 + hw)], S.want, S.uv);
              continue;
            }
            const g1 = khPyrF(N.pt, e1[0], e1[1]), g2 = khPyrF(N.pt, e2[0], e2[1]);
            if (g1 > f1 + 0.01 || g2 > f2 + 0.01) khFace(K, T.w, H.w, [wp(e1, f1), wp(e2, f2), wp(e2, Math.max(f2, g2)), wp(e1, Math.max(f1, g1))], S.want, S.uv);
            const nh = khPyrHw(N.room), c1 = g1 + nh, c2 = g2 + nh;
            if (c1 < f1 + hw - 0.01 || c2 < f2 + hw - 0.01) khFace(K, T.w, H.w, [wp(e1, Math.min(c1, f1 + hw)), wp(e2, Math.min(c2, f2 + hw)), wp(e2, f2 + hw), wp(e1, f1 + hw)], S.want, S.uv);
          }
        }
      }
    });
    // plafond : plat (suit les rampes), en chevrons, en encorbellement, en berceau
    K.group(`${room.name} · plafond`, () => {
      const V = room.vault;
      for (const pt of room.parts) {
        const [u0, v0, u1, v1] = pt.r;
        if (!V) {
          for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
            const c = [[u, v], [u + 1, v], [u + 1, v + 1], [u, v + 1]];
            khFace(K, T.c, H.c, c.map((e) => wp(e, khPyrF(pt, e[0], e[1]) + room.h)), [0, -1, 0], KHPY_UV.xz);
          }
          continue;
        }
        const x0 = X(u0), x1 = X(u1), z0 = Z(v0), z1 = Z(v1);
        if (V.kind === 'gable-u' || V.kind === 'gable-v') {
          const F = Y(pt.f), e = F + V.hw, r = F + V.top, alongU = V.kind === 'gable-u';
          if (alongU) {
            const zm = (z0 + z1) / 2;
            khFace(K, T.c, H.c, [[x0, e, z0], [x1, e, z0], [x1, r, zm], [x0, r, zm]], [0, -(zm - z0), V.top - V.hw], (p) => [p[0], Math.hypot(p[1] - e, p[2] - z0)]);
            khFace(K, T.c, H.c, [[x0, e, z1], [x1, e, z1], [x1, r, zm], [x0, r, zm]], [0, -(z1 - zm), -(V.top - V.hw)], (p) => [p[0], Math.hypot(p[1] - e, p[2] - z1)]);
            khFace(K, T.w, H.w, [[x0, e, z0], [x0, e, z1], [x0, r, zm]], [1, 0, 0], KHPY_UV.zy);
            khFace(K, T.w, H.w, [[x1, e, z0], [x1, e, z1], [x1, r, zm]], [-1, 0, 0], KHPY_UV.zy);
          } else {
            const xm = (x0 + x1) / 2;
            khFace(K, T.c, H.c, [[x0, e, z0], [x0, e, z1], [xm, r, z1], [xm, r, z0]], [V.top - V.hw, -(xm - x0), 0], (p) => [p[2], Math.hypot(p[1] - e, p[0] - x0)]);
            khFace(K, T.c, H.c, [[x1, e, z0], [x1, e, z1], [xm, r, z1], [xm, r, z0]], [-(V.top - V.hw), -(x1 - xm), 0], (p) => [p[2], Math.hypot(p[1] - e, p[0] - x1)]);
            khFace(K, T.w, H.w, [[x0, e, z0], [x1, e, z0], [xm, r, z0]], [0, 0, 1], KHPY_UV.xy);
            khFace(K, T.w, H.w, [[x0, e, z1], [x1, e, z1], [xm, r, z1]], [0, 0, -1], KHPY_UV.xy);
          }
        } else if (V.kind === 'corbel-v') {
          // Grande Galerie : murs droits jusqu'à hw, puis « steps » assises en encorbellement
          const n = V.steps, dh = (V.top - V.hw) / n, ins = Math.min(0.15, ((x1 - x0) / 2 - 0.6) / n);
          const Fa = Y(khPyrF(pt, u0, v0)), Fb = Y(khPyrF(pt, u0, v1));
          for (let j = 1; j <= n; j++) {
            const yb = V.hw + (j - 1) * dh, yt = V.hw + j * dh;
            for (const s of [1, -1]) {
              const xw = s > 0 ? x0 : x1, xa = xw + s * (j - 1) * ins, xb = xw + s * j * ins;
              khFace(K, T.c, H.c, [[xa, Fa + yb, z0], [xb, Fa + yb, z0], [xb, Fb + yb, z1], [xa, Fb + yb, z1]], [0, -1, 0], KHPY_UV.xz);
              khFace(K, T.w, H.w, [[xb, Fa + yb, z0], [xb, Fb + yb, z1], [xb, Fb + yt, z1], [xb, Fa + yt, z0]], [s, 0, 0], KHPY_UV.zy);
            }
            const xa = x0 + j * ins, xb = x1 - j * ins;
            khFace(K, T.w, H.w, [[xa, Fa + yb, z0], [xb, Fa + yb, z0], [xb, Fa + yt, z0], [xa, Fa + yt, z0]], [0, 0, 1], KHPY_UV.xy);
            khFace(K, T.w, H.w, [[xa, Fb + yb, z1], [xb, Fb + yb, z1], [xb, Fb + yt, z1], [xa, Fb + yt, z1]], [0, 0, -1], KHPY_UV.xy);
          }
          const xa = x0 + n * ins, xb = x1 - n * ins;
          khFace(K, T.c, H.c, [[xa, Fa + V.top, z0], [xb, Fa + V.top, z0], [xb, Fb + V.top, z1], [xa, Fb + V.top, z1]], [0, -1, 0], KHPY_UV.xz);
        } else if (V.kind === 'vault-u') {
          // berceau : demi-cylindre est-ouest au-dessus des murs droits, fonds en demi-disques
          const F = Y(pt.f), e = F + V.hw, R = (z1 - z0) / 2, zm = (z0 + z1) / 2, N = 12;
          const at = (k) => { const t = (Math.PI * k) / N; return [zm - R * Math.cos(t), e + R * Math.sin(t), t]; };
          for (let k = 0; k < N; k++) {
            const [za, ya, ta] = at(k), [zb, yb, tb] = at(k + 1), tm = (ta + tb) / 2;
            khFace(K, T.c, H.c, [[x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb]], [0, -Math.sin(tm), Math.cos(tm)], (p) => [p[0], R * Math.acos(clamp((zm - p[2]) / R, -1, 1))]);
            khFace(K, T.w, H.w, [[x0, e, zm], [x0, ya, za], [x0, yb, zb]], [1, 0, 0], KHPY_UV.zy);
            khFace(K, T.w, H.w, [[x1, e, zm], [x1, ya, za], [x1, yb, zb]], [-1, 0, 0], KHPY_UV.zy);
          }
        }
      }
    });
  }
}

/* ---- Pièces du décor d'une pyramide : intérieur (salles, lampes, sable), portail et herse,
   sarcophages, bouchons, herses dans leurs rainures… Appelé par le plateau (lieu B). */
function khPyramidInteriors(K) {
  KHPY.doors = []; KHPY.spawns = []; KHPY.items = []; KHPY.on = true;
  const out = (KH.places.B.pyr = {});
  for (const d of KHPY_DEFS) {
    const P = khPyrP(d), y0 = P.y0, R = { d, node: null, portal: null, door: null, sand: [], lamps: [] };
    out[d.key] = R;
    K.item('pyramide', `Intérieur de ${d.name}`, P.x, y0, P.z, (K) => {
      khPyrRooms(K, d);
      khPyrLampsSand(K, d, R);
      khPyrDecor(K, d);
      khPyrPortal(K, d, R);
    }, { logic: `Les salles de ${d.name} : on y marche, les balles s’arrêtent à leurs murs et les zombies sortent du sable des salles ouvertes. Les armes au mur et la boîte posées dedans suivent.` });
    R.node = K.lastItem;
    KHPY.items.push(R);
  }
}
/* Ampoules suspendues (fil jusqu'au plafond) et tas de sable (points d'apparition). */
function khPyrLampsSand(K, d, R) {
  const P = khPyrP(d), y0 = P.y0, M = khPyrCellMap(d);
  const heap = khPyrHeapGeo();
  K.group('Tas de sable', () => {
    for (const room of d.rooms) for (const [u, v, k = 1] of room.sand || []) {
      const c = M.get(khPyrKey(Math.floor(u), Math.floor(v)));
      if (!c) continue;
      const y = y0 + khPyrF(c.pt, u, v), R0 = c.pt.r, ramp = c.pt.ramp;
      // sur une rampe : couché le long de la pente ; sur un sol plat : tourné au hasard (fixe)
      const sl = ramp ? (ramp[2] - ramp[1]) / (ramp[0] === 'v' ? R0[3] - R0[1] : R0[2] - R0[0]) : 0;
      const rx = ramp && ramp[0] === 'v' ? -Math.atan(sl) : 0, rz = ramp && ramp[0] === 'u' ? Math.atan(sl) : 0, rot = ramp ? 0 : (u * 7.3 + v * 3.1) % Math.PI;
      K.geo('kh_sand', 0xf4e2c0, heap, mtx(P.x + u, y - 0.03, P.z + v, rx, rot, rz, 1.5 * k, 0.32 * Math.sqrt(k), 1.1 * k));
      if (k >= 1) K.geo('kh_sand', 0xf4e2c0, heap, mtx(P.x + u + 0.7 * Math.cos(rot), y - 0.03, P.z + v + 0.7 * Math.sin(rot), rx, rot + 1, rz, 0.9, 0.2, 0.7));
      R.sand.push({ x: P.x + u, y, z: P.z + v });
    }
  });
  for (const room of d.rooms) for (const [u, v] of room.lamps || []) {
    const c = M.get(khPyrKey(Math.floor(u), Math.floor(v)));
    if (!c) continue;
    const f = khPyrF(c.pt, u, v), top = y0 + f + khPyrCeilH(c.room, c.pt, u, v), y = Math.min(top - 0.95, y0 + f + 2.7);
    K.group('Fil de l’ampoule', () => K.box('kh_sheet', 0x2a2622, P.x + u - 0.012, y + 0.08, P.z + v - 0.012, P.x + u + 0.012, top, P.z + v + 0.012));
    const L = owLamp(K, P.x + u, y, P.z + v, 0xffd6a0, false, 0.72);
    L.zone = d.key; L.range = 13;
    R.lamps.push(L);
  }
}
let _khHeap = null;
function khPyrHeapGeo() {
  if (_khHeap) return _khHeap;
  const pts = [];
  for (let i = 0; i <= 5; i++) { const r = i / 5; pts.push(new THREE.Vector2(Math.max(1e-3, r), (Math.cos(Math.PI * r) + 1) / 2)); }
  pts.reverse();
  _khHeap = new THREE.LatheGeometry(pts, 12);
  return _khHeap;
}
/* Portail (pierre de taille, encadrement, chevrons de Khéops, seuil, panneau, deux lampes) et herse. */
function khPyrPortal(K, d, R) {
  const P = khPyrP(d), y0 = P.y0, half = P.side / 2, Q = d.portal;
  const xa = P.x + Q.u0, xb = P.x + Q.u1, xo0 = P.x + Q.open[0], xo1 = P.x + Q.open[1], xm = (xo0 + xo1) / 2;
  const zf = P.z - half - 3, zb = P.z - half + 5, top = y0 + Q.top, oh = y0 + 0.3 + Q.oh, fl = y0 + 0.3;
  K.item('portail', `Portail de ${d.name}`, xm, y0, zf, (K) => {
    // blocs de part et d'autre du passage, linteau ; leurs faces du passage sont celles du couloir
    K.group('Bloc ouest', () => K.box(Q.tex, Q.hex, xa, y0 - 0.5, zf, xo0, top, zb, { skip: ['px', 'bottom'] }));
    K.group('Bloc est', () => K.box(Q.tex, Q.hex, xo1, y0 - 0.5, zf, xb, top, zb, { skip: ['nx', 'bottom'] }));
    K.group('Linteau', () => K.box(Q.tex, Q.hex, xo0, oh, zf, xo1, top, zb, { skip: ['bottom'] }));
    K.solid(xa, zf, xo0, zb, OWK.SOLID, { base: y0 - 0.5, top, mat: OWM.STONE });
    K.solid(xo1, zf, xb, zb, OWK.SOLID, { base: y0 - 0.5, top, mat: OWM.STONE });
    // encadrement de granit (ou de pierre) autour de l'ouverture
    K.group('Encadrement', () => {
      K.box(Q.frame, 0xffffff, xo0 - 0.7, y0 - 0.1, zf - 0.35, xo0, oh + 0.7, zf);
      K.box(Q.frame, 0xffffff, xo1, y0 - 0.1, zf - 0.35, xo1 + 0.7, oh + 0.7, zf);
      K.box(Q.frame, 0xffffff, xo0, oh, zf - 0.35, xo1, oh + 0.7, zf);
    });
    // chevrons (Khéops) : deux paires de grands blocs inclinés au-dessus du linteau
    if (Q.chevron) {
      K.group('Chevrons', () => {
        for (const [k, dz] of [[1, -0.3], [0.78, 0.9]]) {
          const ap = top + 1.6 * k, w = 3.2 * k;
          for (const s of [-1, 1]) {
            const ax = xm + s * w, ay = top - 1.1 * k, len = Math.hypot(w, ap - ay);
            const Xa = [(xm - ax) / len, (ap - ay) / len, 0], Ya = [-Xa[1], Xa[0], 0];
            if (Ya[1] < 0) { Ya[0] = -Ya[0]; Ya[1] = -Ya[1]; }
            khOBox(K, Q.tex, 0xdcc8a8, [(ax + xm) / 2, (ay + ap) / 2, zf + dz + 0.6], Xa, Ya, [0, 0, 1], len / 2 + 0.25, 0.42 * k, 0.6);
          }
        }
      });
    }
    // seuil (la marche du couloir, à 0,3 m)
    K.group('Seuil', () => K.box('kh_limestone', 0xd8c8a8, xo0 - 0.2, y0 - 0.25, zf - 0.45, xo1 + 0.2, fl, zf));
    // panneau du chantier, sur deux piquets
    K.group('Panneau', () => {
      const px = xa - 1.6, pz = zf - 2.2;
      K.box('kh_planks', 0x6b4a30, px - 0.85, y0, pz - 0.05, px - 0.75, y0 + 1.6, pz + 0.05).box('kh_planks', 0x6b4a30, px + 0.75, y0, pz - 0.05, px + 0.85, y0 + 1.6, pz + 0.05);
      K.box('kh_paint', 0xf2e8d2, px - 1, y0 + 1.0, pz - 0.04, px + 1, y0 + 1.75, pz + 0.04);
      const dec = vehDecal([[Q.sign, 0.3, 0.32, 800], ['Chantier de fouilles — entrée', 0.2, 0.72, 600]], 1.9, 0.68, '#2a2017');
      dec.position.set(px, y0 + 1.375, pz - 0.045); dec.rotation.y = Math.PI;
      K.add(dec);
    });
    // deux lampes sur trépied, de part et d'autre du portail
    for (const s of [-1, 1]) {
      const lx = s < 0 ? xo0 - 1.6 : xo1 + 1.6, lz = zf - 1.4;
      K.group('Trépied', () => { for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; K.geo('kh_sheet', 0x2e2a26, GEO.box, beamMtx(lx + Math.cos(a) * 0.45, y0, lz + Math.sin(a) * 0.45, lx, y0 + 2.1, lz, 0.04, 0.04)); } });
      const L = owLamp(K, lx, y0 + 2.25, lz, 0xffcf96, false, 0.9);
      L.range = 14;
    }
    khPyrDoor(K, d, R, { xo0, xo1, zd: P.z - half - 2, fl, oh, top });
  }, { logic: `Le portail de ${d.name} et sa herse : l’échancrure de la face nord suit le portail tant qu’il reste à sa place.` });
  R.portal = K.lastItem;
}
/* Herse de granit (porte payante) : une rangée de cases DOOR, une dalle qui monte dans le linteau. */
function khPyrDoor(K, d, R, o) {
  const P = khPyrP(d), id = `pyramide-${d.key}`;
  let di = OW.doors.findIndex((q) => q.id === id);
  if (di < 0) { di = OW.doors.length; OW.doors.push({ open: false, id }); }
  OW.doors[di].open = false;
  const cx = (o.xo0 + o.xo1) / 2, zc = o.zd + 0.5;
  K.item('herse', `Herse de ${d.name} (porte payante)`, cx, o.fl, zc, (K) => {
    K.solid(o.xo0, o.zd, o.xo1, o.zd + 1, OWK.DOOR, { base: o.fl, top: o.oh, ceil: o.oh, roof: o.top, door: di, mat: OWM.STONE });
    const g = new THREE.Group(), w = o.xo1 - o.xo0 + 0.5, hh = o.oh - o.fl + 0.35, Ks = owKit('herse');
    Ks.box('kh_granite', 0xffffff, -w / 2, -0.1, -0.21, w / 2, hh - 0.1, 0.21);
    for (const y of [0.25, hh - 0.45]) Ks.box('kh_granite', 0xc8a8a0, -w / 2 + 0.1, y, -0.24, w / 2 - 0.1, y + 0.08, -0.21);
    Ks.build(g);
    const seal = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.6, metalness: 0.3 }));
    seal.position.set(0, Math.min(1.7, hh * 0.45), -0.215); seal.rotation.y = Math.PI;
    g.add(seal);
    g.position.set(cx, o.fl, zc);
    g.name = 'herse';
    K.add(g);
    KHPY.doors.push({ key: d.key, name: d.name, d, i: di, slab: g, rest: null, t: 0, opening: false, cost: d.cost, node: null, at: [cx, o.fl, o.zd - 1.4], lift: o.oh - o.fl + 0.3, R });
  }, { logic: `Porte payante de ${d.name} (${khPts(d.cost)} points d’origine ; le prix se règle ci-dessous). Retirée, l’entrée est libre.` });
  const D = KHPY.doors[KHPY.doors.length - 1];
  D.node = K.lastItem;
  R.door = K.lastItem;
}
const khPts = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ---- Décor de chaque pyramide (pièces posées dans l'intérieur : elles le suivent). */
function khPyrDecor(K, d) {
  const P = khPyrP(d), y0 = P.y0;
  const X = (u) => P.x + u, Z = (v) => P.z + v, Y = (f) => y0 + f;
  // herse de granit levée dans ses rainures, en travers d'un couloir (u0..u1) en v, sol f, bas à b
  const slab = (title, u0, u1, v, f, b, top, t = 0.42) => K.item('herse-deco', title, X((u0 + u1) / 2), Y(f), Z(v), (K) => {
    K.group('Dalle de la herse', () => K.box('kh_granite', 0xffffff, X(u0) - 0.12, Y(f + b), Z(v) - t / 2, X(u1) + 0.12, Y(f + top) + 0.3, Z(v) + t / 2));
    K.group('Rainures', () => {
      for (const u of [u0, u1]) {
        const s = u === u0 ? 1 : -1;
        khFace(K, 'kh_granite', 0x3a2420, [[X(u) + s * 0.01, Y(f), Z(v) - t / 2 - 0.08], [X(u) + s * 0.01, Y(f), Z(v) + t / 2 + 0.08], [X(u) + s * 0.01, Y(f + b), Z(v) + t / 2 + 0.08], [X(u) + s * 0.01, Y(f + b), Z(v) - t / 2 - 0.08]], [s, 0, 0], KHPY_UV.zy);
      }
    });
  }, { logic: 'Décor : une herse levée, on passe dessous.' });
  // tableau de bois sombre derrière le dessin d'une arme au mur (la craie s'y lit) ; normale (nx, nz)
  const board = (u, v, f, nx, nz) => K.item('tableau', 'Tableau de l’arme', X(u) + nx * 0.03, Y(f), Z(v) + nz * 0.03, (K) => {
    const w = 1.05, a = Y(f) + 0.95, b = Y(f) + 2.25, t = 0.05;
    K.group('Tableau', () => {
      if (nx) K.box('kh_planks', 0x4a3626, X(u) + (nx > 0 ? 0 : -t), a, Z(v) - w, X(u) + (nx > 0 ? t : 0), b, Z(v) + w);
      else K.box('kh_planks', 0x4a3626, X(u) - w, a, Z(v) + (nz > 0 ? 0 : -t), X(u) + w, b, Z(v) + (nz > 0 ? t : 0));
    });
  }, { logic: 'Décor : le tableau où les fouilleurs ont dessiné l’arme (l’arme au mur est un élément de la carte, posée devant).' });
  const sarco = (title, u0, v0, u1, v1, f, tex = 'kh_granite', hex = 0xffffff, h = 1.05) => K.item('sarcophage', title, X((u0 + u1) / 2), Y(f), Z((v0 + v1) / 2), (K) => {
    K.group('Cuve', () => khTrough(K, tex, hex, X(u0), Z(v0), X(u1), Z(v1), Y(f), h, 0.16));
    K.solid(X(u0), Z(v0), X(u1), Z(v1), OWK.LOW, { base: Y(f), top: Y(f + h), mat: OWM.STONE });
  }, { logic: 'Décor : un obstacle bas (on tire par-dessus).' });
  if (d.key === 'kheops') {
    // tunnel d'al-Mamoun : étais de bois tous les 4 m
    K.item('etais', 'Étais du tunnel', X(7.5), Y(0.3), Z(-86.5), (K) => {
      for (let v = -93; v <= -80; v += 4.2) {
        K.group('Étai', () => {
          K.box('kh_planks', 0x7a5a3a, X(6.04), Y(0.3), Z(v) - 0.11, X(6.26), Y(4.1), Z(v) + 0.11);
          K.box('kh_planks', 0x7a5a3a, X(8.74), Y(0.3), Z(v) - 0.11, X(8.96), Y(4.1), Z(v) + 0.11);
          K.box('kh_planks', 0x6b4a30, X(6.04), Y(3.82), Z(v) - 0.13, X(8.96), Y(4.08), Z(v) + 0.13);
        });
      }
    }, { logic: 'Décor : étais le long des murs du tunnel.' });
    // carrefour : bouchons de granit (sortis du couloir ascendant), couloir descendant fermé, caisses
    K.item('bouchons', 'Bouchons de granit', X(10.1), Y(0.3), Z(-74.5), (K) => {
      for (const [v, h] of [[-77.2, 1.15], [-75.1, 1.2], [-72.9, 1.1]]) K.group('Bouchon', () => K.box('kh_granite', 0xffffff, X(9.45), Y(0.3), Z(v), X(10.75), Y(0.3 + h), Z(v + 1.75)));
      K.solid(X(9.45), Z(-77.2), X(10.75), Z(-71.15), OWK.LOW, { base: Y(0.3), top: Y(1.5), mat: OWM.STONE });
    }, { logic: 'Décor : trois blocs bas (on tire par-dessus).' });
    K.item('descendant', 'Couloir descendant (fermé)', X(4), Y(0.3), Z(-75), (K) => {
      K.group('Bouche du couloir', () => khFace(K, 'kh_rock', 0x0e0b09, [[X(4) + 0.02, Y(0.3), Z(-76.2)], [X(4) + 0.02, Y(0.3), Z(-73.8)], [X(4) + 0.02, Y(2.6), Z(-73.8)], [X(4) + 0.02, Y(2.6), Z(-76.2)]], [1, 0, 0], KHPY_UV.zy));
      K.group('Grille', () => {
        for (let z = -76.1; z <= -73.85; z += 0.3) K.box('kh_sheet', 0x3a3430, X(4) + 0.05, Y(0.3), Z(z) - 0.02, X(4) + 0.09, Y(2.6), Z(z) + 0.02);
        for (const y of [0.9, 1.8]) K.box('kh_sheet', 0x3a3430, X(4) + 0.05, Y(y), Z(-76.2), X(4) + 0.1, Y(y + 0.06), Z(-73.8));
      });
      const dec = vehDecal([['COULOIR DESCENDANT', 0.32, 0.36, 800], ['fermé · éboulement', 0.24, 0.74, 600]], 1.3, 0.42, '#efe4cc');
      dec.position.set(X(4) + 0.12, Y(2.95), Z(-75)); dec.rotation.y = Math.PI / 2;
      K.add(dec);
    }, { logic: 'Décor : la bouche du couloir descendant, fermée par une grille.' });
    K.item('caisse', 'Caisse', X(5), Y(0.3), Z(-77.2), (K) => owCrate(K, X(5), Y(0.3), Z(-77.2), 0.9));
    K.item('caisse', 'Caisse', X(5.1), Y(1.2), Z(-77.1), (K) => owCrate(K, X(5.1), Y(1.2), Z(-77.1), 0.6));
    board(11, -38, 15.3, -1, 0);                     // FG42 au pied de la Grande Galerie
    // antichambre : trois herses levées
    for (const v of [1.8, 3.0, 4.2]) slab('Herse de l’antichambre', 5, 11, v, 31.3, 3.0, 4.2, 0.36);
    // chambre du Roi : sarcophage, poutres de granit, conduits, matériel des fouilles
    sarco('Sarcophage de Khéops', -7.6, 8.6, -6.4, 11.2, 31.3);
    K.item('poutres', 'Poutres du plafond', X(1), Y(37.3), Z(10.5), (K) => {
      for (let u = -8.2; u < 10.5; u += 2.2) K.group('Poutre de granit', () => K.box('kh_granite', 0xe6d0c8, X(u), Y(37.3) - 0.14, Z(6) + 0.02, X(u + 0.08) + 1.9, Y(37.3) - 0.01, Z(15) - 0.02, { skip: ['top'] }));
    }, { logic: 'Décor : les neuf poutres du plafond.' });
    K.item('conduits', 'Conduits de la chambre du Roi', X(-1.5), Y(31.3), Z(10.5), (K) => {
      K.group('Conduit nord', () => khFace(K, 'kh_granite', 0x120c0a, [[X(-2.2), Y(32.2), Z(6) + 0.02], [X(-1.6), Y(32.2), Z(6) + 0.02], [X(-1.6), Y(32.7), Z(6) + 0.02], [X(-2.2), Y(32.7), Z(6) + 0.02]], [0, 0, 1], KHPY_UV.xy));
      K.group('Conduit sud', () => khFace(K, 'kh_granite', 0x120c0a, [[X(-1.4), Y(32.2), Z(15) - 0.02], [X(-0.8), Y(32.2), Z(15) - 0.02], [X(-0.8), Y(32.7), Z(15) - 0.02], [X(-1.4), Y(32.7), Z(15) - 0.02]], [0, 0, -1], KHPY_UV.xy));
    }, { logic: 'Décor : les deux conduits (nord et sud).' });
    K.item('table', 'Table des fouilles', X(-2), Y(31.3), Z(13.8), (K) => { owTable(K, X(-2), Y(31.3), Z(13.8), 1.8, 0.8, 0xb48c5c); K.solid(X(-2.9), Z(13.4), X(-1.1), Z(14.2), OWK.LOW, { base: Y(31.3), top: Y(32.1), mat: OWM.WOOD }); });
    K.item('caisse', 'Caisse', X(9.6), Y(31.3), Z(7.2), (K) => owCrate(K, X(9.6), Y(31.3), Z(7.2), 1));
    // chambre de la Reine : bloc tombé
    K.item('bloc', 'Bloc tombé', X(-5.6), Y(15.3), Z(-5.2), (K) => { K.group('Bloc', () => K.box('kh_limestone', 0xd8c8a8, X(-6.4), Y(15.3), Z(-5.8), X(-4.8), Y(16.2), Z(-4.6))); K.solid(X(-6.4), Z(-5.8), X(-4.8), Z(-4.6), OWK.LOW, { base: Y(15.3), top: Y(16.2), mat: OWM.STONE }); });
  } else if (d.key === 'khephren') {
    // chambre annexe : réserve des fouilles
    K.item('table', 'Table des trouvailles', X(-4), Y(0.3), Z(-71.6), (K) => {
      owTable(K, X(-4), Y(0.3), Z(-71.6), 2.2, 0.9, 0xb48c5c);
      for (const [dx, h] of [[-0.7, 0.42], [-0.2, 0.3], [0.4, 0.5], [0.85, 0.34]]) K.group('Jarre', () => K.cyl('kh_mudbrick', 0xb07850, X(-4 + dx), Y(1.08) + h / 2, Z(-71.6), 0.14 + h * 0.2, h, 10));
      K.solid(X(-5.1), Z(-72.05), X(-2.9), Z(-71.15), OWK.LOW, { base: Y(0.3), top: Y(1.1), mat: OWM.WOOD });
    });
    K.item('caisse', 'Caisse', X(1.6), Y(0.3), Z(-72.1), (K) => owCrate(K, X(1.6), Y(0.3), Z(-72.1), 1));
    K.item('caisse', 'Caisse', X(1.7), Y(1.3), Z(-72), (K) => owCrate(K, X(1.7), Y(1.3), Z(-72), 0.7));
    K.item('fut', 'Fût', X(-7.8), Y(0.3), Z(-64.8), (K) => owBarrel(K, X(-7.8), Y(0.3), Z(-64.8), 0x3c6a8a));
    // couloir horizontal : herse levée
    slab('Herse du couloir', 10, 13, -40, 8.3, 2.8, 3.8);
    board(14, -7, 8.3, -1, 0);                       // MG42 dans la chambre de Belzoni
    // chambre de Belzoni : sarcophage enfoncé dans le sol, couvercle à côté, inscription de 1818
    K.item('sarcophage', 'Sarcophage de Khéphren', X(-7.5), Y(8.3), Z(-7), (K) => {
      K.group('Cuve enfoncée', () => {
        K.box('kh_granite', 0xe8d8d0, X(-8.6), Y(8.3), Z(-8.5), X(-6.4), Y(8.42), Z(-8.3)).box('kh_granite', 0xe8d8d0, X(-8.6), Y(8.3), Z(-5.7), X(-6.4), Y(8.42), Z(-5.5));
        K.box('kh_granite', 0xe8d8d0, X(-8.6), Y(8.3), Z(-8.3), X(-8.4), Y(8.42), Z(-5.7)).box('kh_granite', 0xe8d8d0, X(-6.6), Y(8.3), Z(-8.3), X(-6.4), Y(8.42), Z(-5.7));
        khFace(K, 'kh_granite', 0x1a1210, [[X(-8.4), Y(8.33), Z(-8.3)], [X(-6.6), Y(8.33), Z(-8.3)], [X(-6.6), Y(8.33), Z(-5.7)], [X(-8.4), Y(8.33), Z(-5.7)]], [0, 1, 0], KHPY_UV.xz);
      });
      K.group('Couvercle', () => khOBox(K, 'kh_granite', 0xffffff, [X(-5.2), Y(8.3) + 0.28, Z(-7)], [Math.cos(0.18), Math.sin(0.18), 0], [-Math.sin(0.18), Math.cos(0.18), 0], [0, 0, 1], 1.0, 0.18, 1.35));
      K.solid(X(-6.3), Z(-8.4), X(-4.2), Z(-5.6), OWK.LOW, { base: Y(8.3), top: Y(8.95), mat: OWM.STONE });
    }, { logic: 'Décor : la cuve est au ras du sol ; le couvercle est un obstacle bas.' });
    K.item('inscription', 'Inscription de Belzoni', X(0), Y(10.3), Z(-2), (K) => {
      const dec = vehDecal([['SCOPERTA DA G. BELZONI', 0.34, 0.33, 700], ['2. MAR. 1818.', 0.3, 0.75, 700]], 3.2, 0.9, '#1c140e');
      dec.position.set(X(0), Y(10.6), Z(-2) - 0.03); dec.rotation.y = Math.PI;
      K.add(dec);
    }, { logic: 'Décor : l’inscription peinte par Belzoni en 1818.' });
  } else {
    // chambre aux panneaux : pilastres de la « façade de palais »
    K.item('panneaux', 'Façade de palais', X(0.5), Y(4.3), Z(-29), (K) => {
      for (const [ux, s] of [[-3, 1], [4, -1]]) {
        for (let v = -31.6; v < -26.3; v += 0.75) K.group('Pilastre', () => K.box('kh_limestone', 0xf4e8d2, X(ux) + (s > 0 ? 0 : -0.14), Y(4.3), Z(v), X(ux) + (s > 0 ? 0.14 : 0), Y(7.6), Z(v + 0.32), { skip: [s > 0 ? 'nx' : 'px'] }));
      }
    }, { logic: 'Décor : les panneaux sculptés des murs.' });
    for (const v of [-23, -20, -17]) slab('Herse du passage', -1, 2, v, 4.3, 2.7, 3.6, 0.38);
    board(4, -14, 4.3, 0, 1);                        // PPSh-41 dans l'antichambre
    K.item('caisse', 'Caisse', X(7.8), Y(4.3), Z(-13), (K) => owCrate(K, X(7.8), Y(4.3), Z(-13), 0.9));
    K.item('caisse', 'Caisse', X(-7), Y(4.3), Z(-9), (K) => owCrate(K, X(-7), Y(4.3), Z(-9), 0.8));
    // caveau : sarcophage de basalte à panneaux
    K.item('sarcophage', 'Sarcophage de Mykérinos', X(-19.3), Y(0.3), Z(9), (K) => {
      K.group('Cuve', () => khTrough(K, 'kh_rock', 0x7a7470, X(-20.5), Z(8.4), X(-18.1), Z(9.6), Y(0.3), 1.0, 0.15));
      K.group('Panneaux de la cuve', () => {
        for (let x = -20.35; x < -18.2; x += 0.42) for (const s of [-1, 1]) K.box('kh_rock', 0x5c5754, X(x), Y(0.42), Z(9) + s * 0.6 - (s > 0 ? 0 : 0.05), X(x + 0.16), Y(1.18), Z(9) + s * 0.6 + (s > 0 ? 0.05 : 0));
      });
      K.solid(X(-20.5), Z(8.4), X(-18.1), Z(9.6), OWK.LOW, { base: Y(0.3), top: Y(1.3), mat: OWM.STONE });
    }, { logic: 'Décor : un obstacle bas (on tire par-dessus).' });
  }
}

/* ---- Face nord échancrée derrière chaque portail (tant qu'il est à sa place). */
function khPyrNotch(pi) {
  if (!KHPY.on || !owBaseHasPlaces()) return null;
  const R = KHPY.items.find((q) => q.d.pi === pi);
  if (!R || !R.portal || !R.node) return null;
  if (R.portal.hidden || R.node.hidden || !R.portal.ident || !R.node.ident) return null;
  const P = khPyrP(R.d), half = P.side / 2;
  return { ta: R.d.portal.u0 + 0.6, tb: R.d.portal.u1 - 0.6, lam: Math.min(0.9, 5 / half) };
}
/* Géométrie d'une pyramide (quatre faces ; la face nord peut être échancrée au pied). */
function owPyramidGeometry(p, notch) {
  const half = p.side / 2, y0 = p.y0, h = p.h, slant = Math.hypot(half, h);
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const pos = [], uv = [], col = [];
  const c0 = new THREE.Color(0xc8a77e).convertSRGBToLinear(), c1 = new THREE.Color(0xe6cfa6).convertSRGBToLinear();
  const v3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (let f = 0; f < 4; f++) {
    const a = corners[f], b = corners[(f + 1) % 4];
    const ex = (b[0] - a[0]) / p.side, ez = (b[1] - a[1]) / p.side, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    // point de la face : (t le long de la base depuis son milieu, λ de la base au sommet)
    const at = (t, lam) => [p.x + mx * (1 - lam) + ex * t, y0 + lam * h - 1.5, p.z + mz * (1 - lam) + ez * t];
    const out = v3([-mx, h, -mz], [b[0] - a[0], 0, b[1] - a[1]]);       // normale extérieure : (sommet − a) × (b − a)
    let tris;
    if (f === 0 && notch) {
      const { ta, tb, lam } = notch, S = half;
      const ring = [[-half, 0], [ta, 0], [ta, lam], [tb, lam], [tb, 0], [half, 0], [0, 1]];
      const faces = THREE.ShapeUtils.triangulateShape(ring.map(([t, l]) => new THREE.Vector2(t, l * S)), []);
      tris = faces.map((q) => q.map((k) => ring[k]));
    } else tris = [[[-half, 0], [0, 1], [half, 0]]];
    for (const T of tris) {
      const P3 = T.map(([t, l]) => at(t, l));
      const n = v3([P3[1][0] - P3[0][0], P3[1][1] - P3[0][1], P3[1][2] - P3[0][2]], [P3[2][0] - P3[0][0], P3[2][1] - P3[0][1], P3[2][2] - P3[0][2]]);
      const Tt = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? [T[0], T[2], T[1]] : T;
      for (const [t, l] of Tt) {
        const q = at(t, l);
        pos.push(q[0], q[1], q[2]);
        uv.push((t + half) / 9, (l * slant) / 8);                      // une répétition : 9 m × 8 assises de 1 m
        col.push(c0.r + (c1.r - c0.r) * l, c0.g + (c1.g - c0.g) * l, c0.b + (c1.b - c0.b) * l);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/* Refait les faces (après les lieux, après une retouche du décor dans les Mod Tools). */
function khPyrFaces() {
  if (OW.worldId === 'lune') return;
  (OW.pyrMeshes || []).forEach((m, i) => {
    const N = khPyrNotch(i), sig = N ? `${N.ta},${N.tb},${N.lam}` : '';
    if (m.userData.notch === sig) return;
    m.userData.notch = sig;
    const old = m.geometry;
    m.geometry = owPyramidGeometry(KH.pyramids[i], N);
    old.dispose();
  });
}

/* ---- En partie : herses (achat, ouverture), vue de l'intérieur, nom de la pyramide en entrant */
function khPyrInteractables() {
  if (!KHPY.on) return;
  const E = owPlaceEdits();
  for (const D of KHPY.doors) {
    const n = D.node, e = n && E[n.id];
    D.cost = e && Number.isFinite(e.cost) ? Math.round(e.cost) : D.d.cost;
    D.rest = D.slab.position.clone();
    D.t = 0; D.opening = false;
    if (!n || n.hidden) continue;
    const q = owPt(n, D.at[0], D.at[1], D.at[2]), c = owPt(n, D.at[0], D.at[1], D.at[2] + 1.4);
    D.pos = { x: c.x, y: c.y, z: c.z };
    Features.interactables.push({
      kind: 'door', x: q.x, z: q.z, y: q.y, r: 2.6,
      prompt() { return OW.doors[D.i].open || D.opening ? null : { text: `Appuyez sur F pour ouvrir la pyramide de ${D.name}`, cost: D.cost }; },
      use() { if (!OW.doors[D.i].open && !D.opening && trySpend(D.cost)) khPyrOpen(D); },
    });
  }
}
function khPyrOpen(D) {
  D.opening = true; D.t = 0;
  G.stats.doors++;
  Life.add('doors');
  Sound.door('steel', D.pos);
  for (let i = 0; i < 6; i++) spawnPuff(D.pos.x + rand(-1.4, 1.4), D.pos.y + rand(0.2, 1.4), D.pos.z + rand(-0.6, 0.6), 1.6, 1.8, 0xb09070, 0.5, 0.3);
}
function khPyrUpdate(dt) {
  if (!KHPY.on) return;
  for (const D of KHPY.doors) {
    if (!D.opening) continue;
    D.t += dt;
    const k = clamp(D.t / 2.4, 0, 1);
    if (D.rest) D.slab.position.y = D.rest.y + D.lift * smooth(k);
    if (Math.random() < dt * 8 && k < 1 && D.pos) owSandBurst(D.pos.x + rand(-1.2, 1.2), D.pos.z + rand(-0.3, 0.3), D.pos.y);
    // la moitié levée : on passe (les zombies aussi)
    if (k >= 0.5 && !OW.doors[D.i].open) { OW.doors[D.i].open = true; OWNAV.ready = false; Zombies.flowT = 0; }
    if (k >= 1) D.opening = false;
  }
  // ampoules d'une pyramide : dessinées dedans ou près de sa porte (dehors, la pierre les cache)
  const cz = KHPY.cz ? KHPY.cz.d.key : null, C = camera.position;
  for (const R of KHPY.items) {
    const D = KHPY.doors.find((q) => q.key === R.d.key), show = cz === R.d.key || !!(D && D.pos && Math.hypot(D.pos.x - C.x, D.pos.z - C.z) < 40);
    if (R.shown === show) continue;
    R.shown = show;
    for (const L of R.lamps) { L.bulb.visible = show; L.halo.visible = show && L.on; }
  }
  // le joueur : dans quelle pyramide (nom en entrant ; la tempête ne l'atteint pas)
  KHPY.pz = khPyrAt(player.pos.x, player.pos.y + 1, player.pos.z);
  const key = KHPY.pz && KHPY.pz.w > 0.35 ? KHPY.pz.d.key : null;
  if (key && key !== KHPY.lastZone) HUD.zone(`Pyramide de ${KHPY.pz.d.name}`);
  if (key || !KHPY.pz) KHPY.lastZone = key;
}
/* Remise à zéro (nouvelle partie) : herses fermées. */
function khPyrReset() {
  for (const D of KHPY.doors) {
    D.opening = false; D.t = 0;
    if (OW.doors[D.i]) OW.doors[D.i].open = false;
    if (D.rest) D.slab.position.copy(D.rest);
  }
  KHPY.pz = null; KHPY.lastZone = null; KHPY.view = 0;
  OWNAV.ready = false;
}
/* Sauvegarde : herses ouvertes. */
const khPyrSave = () => KHPY.doors.map((D) => !!(OW.doors[D.i] && OW.doors[D.i].open));
function khPyrRestore(a) {
  if (!Array.isArray(a)) return;
  KHPY.doors.forEach((D, i) => {
    if (!a[i] || !OW.doors[D.i]) return;
    OW.doors[D.i].open = true; D.opening = false;
    if (D.rest) D.slab.position.y = D.rest.y + D.lift;
  });
  OWNAV.ready = false;
}
/* Dans une pyramide ? (x, y, z) dans une case de ses salles : { d, w } (w : de 0 à la porte à 1 à 9 m
   dedans), sinon null. */
function khPyrAt(x, y, z) {
  if (!KHPY.on) return null;
  for (const R of KHPY.items) {
    const P = khPyrP(R.d), half = P.side / 2;
    if (Math.abs(x - P.x) > half + 6 || Math.abs(z - P.z) > half + 6) continue;
    const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(OW.surf, cx, cz);
    if (!ch) return null;
    const i = owIdx(cx, cz), k = ch.kind[i];
    if (!((k === OWK.FLOOR || k === OWK.RAMP || k === OWK.DOOR) && ch.ceil[i] > 0)) return null;
    if (y > ch.ceil[i] + 0.4 || y < Math.min(ch.base[i], ch.top[i]) - 1) return null;
    // à quelle profondeur depuis la herse (le long de l'axe du portail, dans le sens de l'entrée)
    const D = KHPY.doors.find((q) => q.key === R.d.key), n = R.node;
    if (!D || !n) return null;
    const q = owLoc(n, x, y, z), dIn = q.z - (D.at[2] + 1.4);
    if (Math.abs(q.x - P.x) > half || q.z < P.z - half - 4) return null;
    return { d: R.d, R, w: clamp((dIn - 1) / 8, 0, 1) };
  }
  return null;
}
/* Réglage de lumière de l'intérieur : lumière du ciel faible et chaude (les lampes du chantier font le
   reste). Le soleil reste : une pyramide d'ombre en retrait de chaque face le cache aux salles (la
   sortie reste en plein jour) ; sans ombres portées (qualité basse), il s'éteint. */
OW_GRADES.P = { az: 0, el: 60, sun: 0x000000, sunI: 0, hemiSky: 0x8a6c4c, hemiGround: 0x3a3026, hemiI: 0.34, top: 0x0c0a08, horizon: 0x1a120c, ground: 0x0c0a08, haze: 0x1a140e, exp: 1.0, stars: 0, sunK: 0 };
/* Vue (appelé par owApplyGrade) : part de l'intérieur selon la caméra (lissée), mélange des réglages. */
function khPyrGrade(g, dt) {
  const z = KHPY.on && !KHSAN.under ? khPyrAt(camera.position.x, camera.position.y, camera.position.z) : null;
  const want = z ? z.w : 0;
  KHPY.view = dt > 0 ? damp(KHPY.view, want, 3.5, dt) : want;
  KHPY.cz = z;
  const k = KHPY.view;
  KHPY.dark = k > 0.002 && !renderer.shadowMap.enabled;
  if (k < 0.002) return g;
  const p = owGradePresets().P;
  g.hemiSky.lerp(p.hemiSky, k); g.hemiGround.lerp(p.hemiGround, k);
  g.hemiI += (p.hemiI - g.hemiI) * k;
  if (KHPY.dark) g.sunI *= 1 - k;
  return g;
}
/* Apparition dans une pyramide (le joueur dedans) : un tas de sable des salles, de 7 à 46 m de chemin,
   plutôt hors de vue. undefined : le joueur n'est pas dans une pyramide. */
function khPyrSpawn() {
  const Z = KHPY.pz;
  if (!Z || Z.w < 0.2) return undefined;
  const p = player, R = Z.R, n = R.node, others = Zombies.list.filter((q) => q.alive && q.state === 'rise');
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  // une case d'une salle (sol ou rampe sous un plafond), au niveau du tas de sable
  const inRoom = (x, z, y) => {
    const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(OW.surf, cx, cz);
    if (!ch) return false;
    const i = owIdx(cx, cz), k = ch.kind[i];
    return (k === OWK.FLOOR || k === OWK.RAMP) && ch.ceil[i] > 0 && Math.abs(owGroundAt(0, x, z) - y) < 0.8;
  };
  const cand = [];
  for (const s of R.sand) {
    const w = owPt(n, s.x, s.y, s.z), cx = Math.floor(w.x), cz = Math.floor(w.z);
    if (!inRoom(w.x, w.z, w.y)) continue;
    const f = owFlowAt(owK(0, cx, cz));
    if (f < 7 || f > 46) continue;
    const dx = w.x - p.pos.x, dz = w.z - p.pos.z, dd = Math.hypot(dx, dz) || 1;
    cand.push({ x: w.x, y: w.y, z: w.z, seen: (dx * fx + dz * fz) / dd > 0.35 });
  }
  if (!cand.length) return null;
  const hidden = cand.filter((c) => !c.seen), pool = hidden.length && Math.random() < 0.75 ? hidden : cand;
  for (let tries = 0; tries < 10; tries++) {
    const c = pool[Math.floor(Math.random() * pool.length)], j = tries < 6 ? 0.6 : 0, x = c.x + rand(-j, j), z = c.z + rand(-j, j);
    if (others.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 1.1)) continue;
    if (!inRoom(x, z, c.y)) continue;
    const cx = Math.floor(x), cz = Math.floor(z), near = khNearestLoc(x, z);
    return { riser: true, x, z, li: 0, k: owK(0, cx, cz), zone: OW.locs.indexOf(near.loc), layer: 0, y: owGroundAt(0, x, z) };
  }
  return null;
}
/* Emplacement de la boîte mystère derrière une herse fermée : la boîte n'y part pas. */
function khPyrLock(x, z, y) {
  const at = khPyrAt(x, y + 0.5, z);
  if (!at) return null;
  const D = KHPY.doors.find((q) => q.key === at.d.key);
  return D ? () => !(OW.doors[D.i] && OW.doors[D.i].open) : null;
}
