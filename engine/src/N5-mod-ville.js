/* =====================================================================================================
   Jeu 2.0.4 : modèles de la ville et de l'industrie — stockage, industriel, militaire, rue,
   structures (murs, clôtures, piliers, portes), véhicules et épaves.
   ===================================================================================================== */
const MD_PAINT_MET = [['bleu', 'bleu', 0x2c4a7a], ['rouge', 'rouge', 0x8a2620], ['vert', 'vert', 0x3e5a32], ['jaune', 'jaune', 0xb89a28], ['noir', 'noir', 0x262628], ['gris', 'gris', 0x6a6e6e],
  ['orange', 'orange', 0xb8642a], ['blanc', 'blanc', 0xd0d0ca]];
const mdPM = (...keys) => MD_PAINT_MET.filter((c) => keys.includes(c[0]));

/* ================================================================= stockage */
mdFam({
  key: 'cai', famName: 'Caisses en bois', cat: 'stockage', g: 'f',
  axes: [[['petite', 'petite', [0.5, 0.5, 0.5]], ['moyenne', 'moyenne', [0.8, 0.8, 0.8]], ['grande', 'grande', [1.1, 1.0, 1.1]], ['longue', 'longue', [1.6, 0.55, 0.6]]],
    [['claire', 'claire', 0xd0bc98], ['sombre', 'sombre', 0x8a7458], ['militaire', 'militaire', 0x6a7a50], ['rouge', 'rouge', 0x9a4a36]], [['fermee', ''], ['ouverte', 'ouverte']]],
  nm: ([s, c, o]) => `Caisse ${s[1]} ${c[1]}${o[1] ? ` ${o[1]}` : ''}`, states: ['n', 'c', 'b', 'g'], mat: () => 'bois',
  build: ([s, c, o]) => (P) => {
    const [w, h, d] = s[2], R = P.R, fr = mdShade(c[2], 0.72);
    if (o[0] === 'fermee') P.b(w, h, d, 0, h / 2, 0, 'crate', c[2]);
    else { P.b(w, 0.03, d, 0, 0.015, 0, 'crate', c[2]); for (const x of [-1, 1]) P.b(0.03, h, d, x * (w / 2 - 0.015), h / 2, 0, 'crate', c[2]); for (const z of [-1, 1]) P.b(w, h, 0.03, 0, h / 2, z * (d / 2 - 0.015), 'crate', c[2]); P.b(w * 0.9, h * 0.6, d * 0.9, 0, h * 0.3, 0, 'paper', 0xb09868); P.b(w, 0.03, d, w * 0.3, h + 0.25, -d * 0.45, 'crate', c[2], -1.0, 0.25, 0); }
    for (const y of [0.04, h - 0.04]) { for (const z of [-1, 1]) P.b(w + 0.02, 0.07, 0.03, 0, y, z * d / 2, 'wood', fr); for (const x of [-1, 1]) P.b(0.03, 0.07, d + 0.02, x * w / 2, y, 0, 'wood', fr); }
    if (c[0] === 'militaire') P.b(w * 0.4, h * 0.2, 0.005, 0, h * 0.55, d / 2 + 0.017, 'paint', 0xd8d0b0);
    if (s[0] === 'longue' && R() < 2) for (const x of [-0.5, 0.5]) P.b(0.04, h + 0.02, d + 0.02, x, h / 2, 0, 'wood', fr);
  },
});
mdFam({
  key: 'fut', famName: 'Fûts métalliques', cat: 'stockage', g: 'm', axes: [MD_PAINT_MET],
  nm: ([c]) => `Fût métallique ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'r', 'x', 'c', 'b'], mat: () => 'metal',
  build: ([c]) => (P) => { P.c(0.29, 0.86, 0, 0.43, 0, 'metal', c[2], 0, 0, 0, 16); for (const y of [0.04, 0.3, 0.58, 0.84]) P.c(0.3, 0.035, 0, y, 0, 'metal', mdShade(c[2], 0.9), 0, 0, 0, 16); P.c(0.06, 0.02, 0.15, 0.87, 0.1, 'metal', 0x303030); P.c(0.03, 0.02, -0.16, 0.87, -0.08, 'metal', 0x303030); },
});
mdFam({
  key: 'futp', famName: 'Fûts en plastique', cat: 'stockage', g: 'm', axes: [mdC('bleu', 'blanc', 'noir', 'vert')],
  nm: ([c]) => `Fût en plastique ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'x'], mat: () => 'plastique',
  build: ([c]) => (P) => { P.c(0.28, 0.9, 0, 0.45, 0, 'plastic', c[2], 0, 0, 0, 16); for (const y of [0.3, 0.6]) P.c(0.285, 0.04, 0, y, 0, 'plastic', mdShade(c[2], 0.85), 0, 0, 0, 16); for (const x of [-0.12, 0.12]) P.c(0.04, 0.03, x, 0.91, 0, 'plastic', mdShade(c[2], 0.7), 0, 0, 0, 10); },
});
mdFam({
  key: 'ton', famName: 'Tonneaux', cat: 'stockage', g: 'm', axes: [mdW('chene', 'noyer', 'pin')],
  nm: ([w]) => `Tonneau ${mdCol(w, false, false)}`, states: ['n', 'u', 'x', 'c'], mat: () => 'bois',
  build: ([w]) => (P) => { P.t(0.3, 0.3, 0.9, 0, 0.45, 0, 'wood', w[2], 0, 0, 0, 14); P.c(0.34, 0.5, 0, 0.45, 0, 'wood', mdShade(w[2], 0.95), 0, 0, 0, 14); for (const y of [0.1, 0.32, 0.58, 0.8]) P.c(0.335, 0.04, 0, y, 0, 'metal', 0x3a3a38, 0, 0, 0, 14); P.c(0.03, 0.05, 0, 0.45, 0.33, 'wood', 0x3a2414, Math.PI / 2, 0, 0, 8); },
});
mdFam({
  key: 'futx', famName: 'Fûts toxiques', cat: 'stockage', g: 'm', axes: [[['jaune', 'jaune', 0xc8a020, 0x9ae040], ['vert', 'vert', 0x4a6a2a, 0xb0ff40], ['orange', 'orange', 0xc8642a, 0xe0ff60]]],
  nm: ([c]) => `Fût toxique ${c[1]}`, states: ['n', 'x', 'r'], mat: () => 'metal',
  build: ([c]) => (P) => {
    P.c(0.29, 0.86, 0, 0.43, 0, 'metal', c[2], 0, 0, 0, 16); P.c(0.292, 0.22, 0, 0.45, 0, 'paint', 0x1a1a1a, 0, 0, 0, 16);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; P.b(0.12, 0.12, 0.01, Math.cos(a) * 0.29, 0.45, Math.sin(a) * 0.29, 'paint', 0xe8c020, 0, -a + Math.PI / 2, Math.PI / 4); }
    P.c(0.2, 0.02, 0, 0.87, 0, 'glow', c[3], 0, 0, 0, 14); P.p(0.9, 0.7, 0.35, 0.008, 0.3, 'glow', mdShade(c[3], 0.6), 0, 0.7, 0);
  },
});
mdFam({
  key: 'crt', famName: 'Cartons', cat: 'stockage', g: 'm',
  axes: [[['petit', 'petit', [0.35, 0.3, 0.3]], ['moyen', 'moyen', [0.55, 0.42, 0.42]], ['grand', 'grand', [0.8, 0.6, 0.6]], ['pile', 'empilés', null]], [['ferme', 'fermé'], ['ouvert', 'ouvert'], ['ecrase', 'écrasé']]],
  nm: ([s, o]) => (s[0] === 'pile' ? `Cartons empilés (${o[1].replace('é', 'és')})` : `Carton ${s[1]} ${o[1]}`), gp: ([s]) => ['m', s[0] === 'pile'], states: ['n', 'u', 'x'], mat: () => 'papier',
  opts: ([s]) => ({ solid: s[0] !== 'petit' }),
  build: ([s, o]) => (P) => {
    const R = P.R, box = (w, h, d, x, y, z, ry) => {
      const hh = o[0] === 'ecrase' ? h * 0.55 : h, col = pk(R, [0xa68a60, 0x9a7e56, 0xb09468]);
      P.b(w, hh, d, x, y + hh / 2, z, 'paper', col, 0, ry, o[0] === 'ecrase' ? 0.06 : 0);
      if (o[0] === 'ouvert') for (const sz of [-1, 1]) P.b(w, 0.01, d * 0.45, x, y + hh + d * 0.18, z + sz * d * 0.45, 'paper', col, sz * -0.9, ry, 0);
      else P.b(w * 0.15, 0.004, d * 1.01, x, y + hh + 0.002, z, 'plastic', 0xc8b490, 0, ry, 0);
    };
    if (s[0] === 'pile') { box(0.6, 0.45, 0.45, 0, 0, 0, 0); box(0.5, 0.35, 0.4, 0.05, 0.45 * (o[0] === 'ecrase' ? 0.55 : 1), 0.02, 0.3); box(0.4, 0.3, 0.35, 0.5, 0, 0.3, -0.4); box(0.45, 0.4, 0.4, -0.55, 0, -0.1, 0.2); return; }
    const [w, h, d] = s[2]; box(w, h, d, 0, 0, 0, 0);
  },
});
mdFam({
  key: 'pal', famName: 'Palettes', cat: 'stockage', g: 'f',
  axes: [[['vide', 'vide'], ['sacs', 'de sacs'], ['cartons', 'de cartons'], ['briques', 'de briques'], ['parpaings', 'de parpaings'], ['bidons', 'de bidons'], ['planches', 'de planches']]],
  nm: ([l]) => (l[0] === 'vide' ? 'Palette vide' : `Palette chargée ${l[1]}`), states: ['n', 'u', 'c'], mat: ([l]) => (l[0] === 'vide' || l[0] === 'planches' ? 'bois' : 'papier'), opts: ([l]) => ({ solid: l[0] !== 'vide' }),
  build: ([l]) => (P) => {
    const R = P.R;
    for (const z of [-0.45, 0, 0.45]) P.b(1.2, 0.1, 0.1, 0, 0.05, z, 'wood', 0xb09068);
    for (let i = 0; i < 7; i++) P.b(0.13, 0.025, 1.0, -0.55 + i * 0.183, 0.112, 0, 'wood', 0xa48458);
    const y = 0.125;
    switch (l[0]) {
      case 'sacs': for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) P.b(0.55, 0.14, 0.38, (i % 2) * 0.58 - 0.29, y + 0.07 + k * 0.14, (i >> 1) * 0.42 - 0.21, 'fabric', pk(R, [0xd8d0c0, 0xc8c0b0]), 0, 0, 0); break;
      case 'cartons': for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) P.b(0.56, 0.38, 0.46, (i % 2) * 0.58 - 0.29, y + 0.19 + k * 0.38, (i >> 1) * 0.48 - 0.24, 'paper', pk(R, [0xa68a60, 0x9a7e56])); P.b(1.18, 0.78, 0.96, 0, y + 0.39, 0, 'glass', 0xc8d0d4); break;
      case 'briques': P.b(1.1, 0.6, 0.9, 0, y + 0.3, 0, 'tex:brick_red', 0xffffff); P.b(1.12, 0.62, 0.92, 0, y + 0.31, 0, 'glass', 0xd0d8dc); break;
      case 'parpaings': for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) P.b(0.38, 0.19, 0.48, (i % 3 - 1) * 0.39, y + 0.1 + k * 0.2, (i < 3 ? -0.25 : 0.25), 'concrete', 0x9a9890); break;
      case 'bidons': for (let i = 0; i < 4; i++) { const x = (i % 2) * 0.56 - 0.28, z = (i >> 1) * 0.48 - 0.24; P.b(0.4, 0.5, 0.35, x, y + 0.25, z, 'plastic', pk(R, [0x2a4a8a, 0xd8d8d0, 0x3a6a3a])); P.c(0.04, 0.05, x + 0.1, y + 0.53, z, 'plastic', 0x1a1a1a, 0, 0, 0, 8); } break;
      case 'planches': for (let k = 0; k < 6; k++) for (let i = 0; i < 6; i++) P.b(0.16, 0.05, 1.6, -0.45 + i * 0.18, y + 0.03 + k * 0.055, 0, 'wood', pk(R, [0xc8a46c, 0xb89460, 0xd0ac74])); break;
      default:
    }
  },
});
mdFam({
  key: 'ray', famName: 'Rayonnages', cat: 'stockage', g: 'm',
  axes: [[['court', 'de 1,2 m', 1.2], ['long', 'de 2,4 m', 2.4]], [['vide', 'vide'], ['cartons', 'de cartons'], ['mixte', 'en vrac'], ['plein', 'plein']], [['orange', 'orange et bleu', 0xc8642a, 0x2c4a7a], ['gris', 'gris', 0x6a6e6e, 0x6a6e6e], ['vert', 'vert', 0x3e5a32, 0x3e5a32]]],
  nm: ([s, l, c]) => `Rayonnage ${c[1]} ${s[1]} ${l[0] === 'vide' ? 'vide' : l[0] === 'plein' ? 'plein' : `chargé ${l[1]}`}`, states: ['n', 'x', 'r'], mat: () => 'metal',
  build: ([s, l, c]) => (P) => {
    const R = P.R, L = s[2], H = 2.6, D = 0.9, lv = [0.15, 1.0, 1.85];
    for (const x of [-L / 2, L / 2]) for (const z of [-D / 2, D / 2]) P.b(0.08, H, 0.08, x, H / 2, z, 'metal', c[3]);
    for (const x of [-L / 2, L / 2]) for (let i = 0; i < 5; i++) boxBetween(P, 'metal', c[3], [x, 0.2 + i * 0.5, -D / 2], [x, 0.45 + i * 0.5, D / 2], 0.025);
    for (const y of lv) for (const z of [-D / 2, D / 2]) P.b(L, 0.1, 0.06, 0, y, z, 'metal', c[2]);
    if (l[0] === 'vide') return;
    for (const y of lv) {
      let x = -L / 2 + 0.1;
      while (x < L / 2 - 0.3) {
        const w = rr(R, 0.4, 0.8), h = rr(R, 0.3, 0.7), full = l[0] === 'plein' || (l[0] === 'cartons' && R() < 0.85) || (l[0] === 'mixte' && R() < 0.6);
        if (full && x + w < L / 2 - 0.05) {
          if (l[0] === 'mixte' && R() < 0.4) P.c(0.28, 0.82, x + 0.3, y + 0.46, 0, 'metal', pk(R, [0x2c4a7a, 0x8a2620, 0x3e5a32]), 0, 0, 0, 12);
          else P.b(w, h, D * 0.85, x + w / 2, y + 0.05 + h / 2, 0, 'paper', pk(R, [0xa68a60, 0x9a7e56, 0xb09468]));
        }
        x += w + 0.05;
      }
    }
  },
});
mdFam({
  key: 'cnt', famName: 'Conteneurs maritimes', cat: 'stockage', g: 'm',
  axes: [[['20', '20 pieds', 6.06], ['40', '40 pieds', 12.2]], [['rouge', 'rouge', 0x8a3a2a], ['bleu', 'bleu', 0x2a4a7a], ['vert', 'vert', 0x3a5a3a], ['orange', 'orange', 0xb8642a], ['gris', 'gris', 0x7a7e80], ['blanc', 'blanc', 0xc8c8c2], ['jaune', 'jaune', 0xb8962a], ['marron', 'marron', 0x5a3a2a]],
    [['ferme', 'fermé'], ['ouvert', 'ouvert']]],
  nm: ([s, c, o]) => `Conteneur ${s[1]} ${gxAcc(c[1], false, false)} ${o[1]}`, states: ['n', 'r', 'b'], mat: () => 'metal',
  build: ([s, c, o]) => (P) => {
    const L = s[2], W = 2.44, H = 2.6;
    P.b(L, H, W, 0, H / 2, 0, 'metal', c[2]);
    for (let i = 0; i < Math.round(L / 0.25); i++) { const x = -L / 2 + 0.15 + i * 0.25; for (const z of [-1, 1]) P.b(0.07, H - 0.25, 0.05, x, H / 2, z * (W / 2 + 0.015), 'metal', mdShade(c[2], 0.88)); }
    for (const x of [-L / 2, L / 2]) for (const z of [-W / 2, W / 2]) P.b(0.18, H + 0.02, 0.18, x, H / 2, z, 'metal', 0x3a3a3a);
    if (o[0] === 'ouvert') { P.b(0.02, H - 0.1, W - 0.1, L / 2 + 0.005, H / 2, 0, 'paint', 0x1a1a1a); for (const sz of [-1, 1]) P.b(W / 2 - 0.05, H - 0.15, 0.05, L / 2 + W / 4, H / 2, sz * (W / 2 + 0.3), 'metal', c[2], 0, sz * 1.3, 0); }
    else for (const z of [-0.5, 0.5]) P.b(0.04, H - 0.3, 0.04, L / 2 + 0.03, H / 2, z, 'metal', 0x6a6a68);
  },
});
mdFam({
  key: 'sac', famName: 'Sacs', cat: 'stockage', g: 'm', o: { solid: false },
  axes: [[['ciment', 'Sacs de ciment', 0xb8b4a8, 'paper'], ['farine', 'Sacs de farine', 0xe0d8c8, 'fabric'], ['grain', 'Sacs de grain en jute', 0xa88a5a, 'fabric'], ['poubelle', 'Sacs-poubelle', 0x1a1a1c, 'plastic'], ['engrais', 'Sacs d’engrais', 0x3a6a3a, 'plastic']]],
  nm: ([t]) => t[1], gp: () => ['m', true], states: ['n', 'g'], mat: ([t]) => (t[3] === 'plastic' ? 'plastique' : t[3] === 'paper' ? 'papier' : 'tissu'),
  build: ([t]) => (P) => {
    const R = P.R;
    for (let i = 0; i < 6; i++) {
      if (t[0] === 'poubelle') { P.s(0.25, rr(R, -0.4, 0.4), 0.22, rr(R, -0.3, 0.3), 'plastic', mdShade(t[2], 0.9 + R() * 0.3), 1, 1.1, 0.9, 10); P.c(0.04, 0.08, rr(R, -0.3, 0.3), 0.48, rr(R, -0.2, 0.2), 'plastic', t[2], 0, 0, 0, 6); continue; }
      P.b(0.55, 0.14, 0.38, (i % 2) * 0.58 - 0.29, 0.07 + Math.floor(i / 4) * 0.14, ((i >> 1) % 2) * 0.42 - 0.21, t[3], mdShade(t[2], 0.9 + R() * 0.15), 0, (R() - 0.5) * 0.2, 0);
    }
  },
});
mdFam({
  key: 'bid', famName: 'Bidons, bouteilles de gaz, extincteurs', cat: 'stockage', g: 'm', o: { solid: false },
  axes: [[['jerrican', 'Jerrican militaire', 'm', 0x4a5a34], ['jerrouge', 'Jerrican rouge', 'm', 0xa82a20], ['huile', 'Bidon d’huile', 'm', 0x2a4a8a], ['gazbleu', 'Bouteille de gaz bleue', 'f', 0x2a5ab0], ['gazorange', 'Bouteille de gaz orange', 'f', 0xd06a20],
    ['cadre', 'Cadre de bouteilles de gaz', 'm', 0x3a6a3a], ['extincteur', 'Extincteur', 'm', 0xc02020]]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'u', 'x'], mat: () => 'metal', opts: ([t]) => ({ solid: t[0] === 'cadre' }),
  build: ([t]) => (P) => {
    const c = t[3];
    switch (t[0]) {
      case 'jerrican': case 'jerrouge': P.b(0.34, 0.46, 0.17, 0, 0.23, 0, 'metal', c); P.b(0.12, 0.06, 0.05, 0.08, 0.49, 0, 'metal', mdShade(c, 0.8)); P.c(0.03, 0.06, -0.1, 0.49, 0, 'metal', 0x2a2a2a); for (const z of [-1, 1]) P.b(0.3, 0.012, 0.01, 0, 0.3, z * 0.088, 'metal', mdShade(c, 0.85), 0, 0, 0.6); break;
      case 'huile': P.b(0.3, 0.42, 0.22, 0, 0.21, 0, 'metal', c); P.c(0.03, 0.04, 0.08, 0.44, 0, 'metal', 0xc8c8c0); P.b(0.2, 0.18, 0.005, 0, 0.22, 0.112, 'paint', 0xe8c030); break;
      case 'gazbleu': case 'gazorange': P.c(0.15, 0.55, 0, 0.3, 0, 'metal', c, 0, 0, 0, 14); P.s(0.15, 0, 0.58, 0, 'metal', c, 1, 0.6, 1, 14); P.c(0.03, 0.08, 0, 0.7, 0, 'metal', 0xb09040, 0, 0, 0, 8); P.o(0.08, 0.012, 0, 0.73, 0, 'metal', 0x6a6a6a, Math.PI / 2, 0, 0); P.c(0.16, 0.04, 0, 0.02, 0, 'metal', 0x3a3a3a, 0, 0, 0, 14); break;
      case 'cadre': P.b(1.0, 0.04, 0.5, 0, 0.02, 0, 'metal', 0x3a3a3a); for (const x of [-0.5, 0.5]) P.b(0.04, 1.8, 0.04, x, 0.9, -0.25, 'metal', 0x3a3a3a); P.b(1.0, 0.04, 0.04, 0, 1.3, -0.25, 'metal', 0x3a3a3a); for (let i = 0; i < 4; i++) { const x = -0.36 + i * 0.24; P.c(0.11, 1.4, x, 0.74, 0, 'metal', [0x3a6a3a, 0x8a8a8a, 0x2a2a2a, 0x3a6a3a][i], 0, 0, 0, 12); P.s(0.11, x, 1.44, 0, 'metal', [0x3a6a3a, 0x8a8a8a, 0x2a2a2a, 0x3a6a3a][i], 1, 0.5, 1, 12); } break;
      default: P.c(0.08, 0.5, 0, 0.27, 0, 'metal', c, 0, 0, 0, 12); P.s(0.08, 0, 0.52, 0, 'metal', c, 1, 0.5, 1, 12); P.b(0.12, 0.05, 0.04, 0.03, 0.6, 0, 'metal', 0x1a1a1a); P.c(0.015, 0.3, 0.1, 0.42, 0, 'rubber', 0x1a1a1a, 0, 0, 0.3, 6);
    }
  },
});
mdFam({
  key: 'pbl', famName: 'Poubelles et bennes', cat: 'stockage', g: 'f',
  axes: [[['roulettes', 'Poubelle à roulettes', 'f'], ['rue', 'Poubelle de rue', 'f'], ['benne', 'Benne à ordures', 'f'], ['bureau', 'Corbeille à papier', 'f'], ['tri', 'Conteneur de tri', 'm']], mdC('vert', 'gris', 'jaune', 'bleu')],
  nm: ([t, c]) => `${t[1]} ${gxAcc(c[1], t[2] === 'f', false)}`, gp: ([t]) => [t[2], false], states: ['n', 'u', 'x', 'b'], mat: () => 'plastique', opts: ([t]) => ({ solid: t[0] !== 'bureau' }),
  build: ([t, c]) => (P) => {
    const col = c[2];
    switch (t[0]) {
      case 'roulettes': P.t(0.3, 0.26, 0.95, 0, 0.5, 0, 'plastic', col, 0, Math.PI / 4, 0, 4); P.b(0.62, 0.05, 0.7, 0, 1.0, 0.02, 'plastic', mdShade(col, 0.85), -0.04, 0, 0); for (const x of [-0.24, 0.24]) P.c(0.1, 0.06, x, 0.1, -0.3, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 12); break;
      case 'rue': P.c(0.25, 0.8, 0, 0.4, 0, 'metal', col, 0, 0, 0, 14); P.c(0.27, 0.05, 0, 0.82, 0, 'metal', mdShade(col, 0.8), 0, 0, 0, 14); P.c(0.12, 0.02, 0, 0.85, 0, 'paint', 0x1a1a1a, 0, 0, 0, 12); break;
      case 'benne': P.t(1, 0.85, 1.2, 0, 0.7, 0, 'metal', col, 0, Math.PI / 4, 0, 4); P.b(1.9, 0.08, 1.4, 0, 1.32, -0.05, 'metal', mdShade(col, 0.85), -0.08, 0, 0); for (const x of [-0.7, 0.7]) P.c(0.08, 0.06, x, 0.08, 0.55, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2); break;
      case 'bureau': P.t(0.15, 0.12, 0.32, 0, 0.16, 0, 'plastic', col, 0, 0, 0, 14); P.p(0.25, 0.25, 0.1, 0.33, 0, 'paper', 0xe8e4d8, 0, 0.5, 0); break;
      default: P.b(1.5, 1.5, 1.2, 0, 0.75, 0, 'plastic', col); P.c(0.18, 0.02, -0.4, 1.3, 0.6, 'paint', 0x1a1a1a, Math.PI / 2, 0, 0, 14); P.c(0.18, 0.02, 0.4, 1.3, 0.6, 'paint', 0x1a1a1a, Math.PI / 2, 0, 0, 14);
    }
  },
});

/* ================================================================ industriel */
mdFam({
  key: 'tuy', famName: 'Tuyauteries', cat: 'industriel', g: 'm',
  axes: [[['droit', 'Tuyau droit'], ['vertical', 'Tuyau vertical'], ['coude', 'Coude de tuyau'], ['vanne', 'Tuyau à vanne']], [['fin', 'fin', 0.06], ['moyen', 'moyen', 0.12], ['gros', 'gros', 0.3]], mdPM('gris', 'rouge', 'jaune', 'vert')],
  nm: ([t, s, c]) => `${t[1]} ${s[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'r'], mat: () => 'metal', opts: ([t, s]) => ({ solid: s[0] !== 'fin' }),
  build: ([t, s, c]) => (P) => {
    const r = s[2] / 2, y = Math.max(0.4, r + 0.15), col = c[2];
    const flange = (x, yy, z, rx, rz) => P.c(r * 1.4, 0.04, x, yy, z, 'metal', mdShade(col, 0.85), rx, 0, rz, 12);
    if (t[0] === 'vertical') { P.c(r, 3, 0, 1.5, 0, 'metal', col, 0, 0, 0, 12); flange(0, 0.02, 0, 0, 0); flange(0, 1.5, 0, 0, 0); P.b(r * 3, 0.04, r * 3, 0, 1.0, -r * 1.5, 'metal', 0x3a3a3a); return; }
    P.c(r, 2, 0, y, 0, 'metal', col, 0, 0, Math.PI / 2, 12); for (const x of [-1, 0.98]) flange(x, y, 0, 0, Math.PI / 2);
    for (const x of [-0.6, 0.6]) { P.b(0.04, y - r, 0.04, x, (y - r) / 2, 0, 'metal', 0x3a3a3a); P.b(r * 2.6, 0.03, 0.06, x, y - r - 0.01, 0, 'metal', 0x3a3a3a); }
    if (t[0] === 'coude') { P.o(0.3, r, 1.0, y + 0.3, 0, 'metal', col, 0, 0, Math.PI); P.c(r, 1.2, 1.3, y + 0.9, 0, 'metal', col, 0, 0, 0, 12); }
    if (t[0] === 'vanne') { P.s(r * 1.5, 0, y, 0, 'metal', mdShade(col, 0.9), 1, 1, 1, 10); P.c(0.02, r + 0.2, 0, y + r + 0.1, 0, 'metal', 0x6a6a6a); P.o(0.12, 0.015, 0, y + r + 0.22, 0, 'metal', 0xb02020, Math.PI / 2, 0, 0); }
  },
});
const MD_MACH = [
  ['generateur', 'Groupe électrogène', 'm'], ['compresseur', 'Compresseur', 'm'], ['tour', 'Tour d’usinage', 'm'], ['perceuse', 'Perceuse à colonne', 'f'], ['presse', 'Presse hydraulique', 'f'],
  ['pompe', 'Pompe', 'f'], ['moteur', 'Moteur industriel', 'm'], ['clim', 'Groupe de climatisation', 'm'], ['chaudiere', 'Chaudière', 'f'], ['soudure', 'Poste à souder', 'm'],
];
mdFam({
  key: 'mach', famName: 'Machines', cat: 'industriel', g: 'm', axes: [MD_MACH, mdPM('vert', 'gris', 'jaune')],
  nm: ([t, c]) => `${t[1]} ${gxAcc(c[1], t[2] === 'f', false)}`, gp: ([t]) => [t[2], false], states: ['n', 'u', 'r', 'b'], mat: () => 'metal',
  build: ([t, c]) => (P) => {
    const col = c[2], dk = 0x2a2a2a;
    switch (t[0]) {
      case 'generateur': P.b(1.6, 0.12, 0.8, 0, 0.06, 0, 'metal', dk); P.b(1.2, 0.8, 0.7, 0, 0.52, 0, 'metal', col); for (let i = 0; i < 6; i++) P.b(0.012, 0.6, 0.6, -0.4 + i * 0.12, 0.52, 0, 'metal', mdShade(col, 0.7)); P.c(0.06, 0.4, 0.5, 1.1, 0.2, 'metal', dk); P.b(0.25, 0.3, 0.02, -0.4, 0.55, 0.36, 'metal', 0xb0b0ac); break;
      case 'compresseur': P.c(0.3, 1.2, 0, 0.35, 0, 'metal', col, 0, 0, Math.PI / 2, 16); for (const x of [-0.45, 0.45]) P.b(0.08, 0.1, 0.5, x, 0.05, 0, 'metal', dk); P.b(0.45, 0.35, 0.35, -0.2, 0.83, 0, 'metal', dk); P.c(0.1, 0.06, 0.25, 0.75, 0.15, 'metal', 0xc8c8c0, Math.PI / 2, 0, 0, 12); break;
      case 'tour': P.b(1.8, 0.8, 0.5, 0, 0.4, 0, 'metal', col); P.b(1.7, 0.12, 0.3, 0, 0.86, -0.05, 'metal', 0x8a8c8e); P.b(0.4, 0.4, 0.4, -0.65, 1.12, -0.05, 'metal', col); P.c(0.12, 0.15, -0.38, 1.12, -0.05, 'metal', 0x6a6c6e, 0, 0, Math.PI / 2, 14); P.b(0.25, 0.3, 0.3, 0.55, 1.07, -0.05, 'metal', mdShade(col, 0.9)); break;
      case 'perceuse': P.b(0.5, 0.06, 0.5, 0, 0.03, 0, 'metal', dk); P.c(0.05, 1.6, 0, 0.83, -0.15, 'metal', 0x8a8c8e); P.b(0.32, 0.06, 0.3, 0, 0.8, 0.05, 'metal', col); P.b(0.3, 0.35, 0.45, 0, 1.55, 0, 'metal', col); P.c(0.02, 0.2, 0, 1.28, 0.12, 'metal', 0x9a9c9e); break;
      case 'presse': for (const x of [-0.5, 0.5]) P.b(0.25, 2.4, 0.6, x, 1.2, 0, 'metal', col); P.b(1.3, 0.4, 0.7, 0, 2.3, 0, 'metal', col); P.b(1.3, 0.5, 0.7, 0, 0.25, 0, 'metal', col); P.c(0.12, 0.8, 0, 1.6, 0, 'metal', 0xb0b2b4); P.b(0.8, 0.15, 0.5, 0, 1.15, 0, 'metal', mdShade(col, 0.8)); break;
      case 'pompe': P.b(1.0, 0.1, 0.5, 0, 0.05, 0, 'metal', dk); P.c(0.2, 0.45, -0.2, 0.3, 0, 'metal', col, 0, 0, Math.PI / 2, 14); P.s(0.22, 0.25, 0.32, 0, 'metal', col, 1, 1, 0.8, 12); P.c(0.08, 0.6, 0.25, 0.32, 0.35, 'metal', 0x8a8c8e, Math.PI / 2, 0, 0, 10); P.c(0.08, 0.5, 0.25, 0.75, 0, 'metal', 0x8a8c8e, 0, 0, 0, 10); break;
      case 'moteur': P.c(0.35, 0.9, 0, 0.45, 0, 'metal', col, 0, 0, Math.PI / 2, 18); for (let i = 0; i < 8; i++) P.b(0.85, 0.03, 0.03, 0, 0.45 + Math.sin((i / 8) * TAU) * 0.36, Math.cos((i / 8) * TAU) * 0.36, 'metal', mdShade(col, 0.8)); P.c(0.08, 0.2, 0.55, 0.45, 0, 'metal', 0xb0b2b4, 0, 0, Math.PI / 2, 10); P.b(0.8, 0.12, 0.6, 0, 0.06, 0, 'metal', dk); break;
      case 'clim': P.b(1.0, 0.8, 0.45, 0, 0.42, 0, 'metal', mdMix(col, 0xd0d0ca, 0.5)); P.c(0.3, 0.02, -0.15, 0.45, 0.23, 'metal', 0x2a2a2a, Math.PI / 2, 0, 0, 18); for (let i = 0; i < 3; i++) P.b(0.04, 0.5, 0.012, -0.15, 0.45, 0.242, 'metal', 0x6a6a6a, 0, 0, (i * Math.PI) / 3); P.b(1.0, 0.04, 0.45, 0, 0.02, 0, 'metal', dk); break;
      case 'chaudiere': P.c(0.6, 1.8, 0, 0.95, 0, 'metal', col, 0, 0, 0, 18); P.c(0.62, 0.06, 0, 1.85, 0, 'metal', mdShade(col, 0.8), 0, 0, 0, 18); P.c(0.12, 1.2, 0.3, 2.4, 0, 'metal', dk); P.b(0.4, 0.4, 0.05, 0, 0.6, 0.6, 'metal', dk); P.c(0.12, 0.04, 0, 1.3, 0.6, 'metal', 0xe8e4d8, Math.PI / 2, 0, 0, 14); break;
      default: P.b(0.6, 0.7, 0.45, 0, 0.35 + 0.1, 0, 'metal', col); for (const x of [-0.22, 0.22]) for (const z of [-0.16, 0.16]) P.c(0.05, 0.04, x, 0.05, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 10); P.c(0.012, 0.6, 0.35, 0.5, 0.1, 'rubber', 0x1a1a1a, 0.6, 0, 0.4, 6); P.b(0.12, 0.12, 0.02, -0.15, 0.6, 0.23, 'metal', 0xb0b0ac);
    }
  },
});
mdFam({
  key: 'cuve', famName: 'Cuves et citernes', cat: 'industriel', g: 'f',
  axes: [[['verticale', 'Cuve verticale'], ['horizontale', 'Citerne horizontale'], ['silo', 'Silo'], ['inox', 'Cuve en inox'], ['eau', 'Réservoir d’eau']], [['petit', 'petite', 1], ['grand', 'grande', 1.8]]],
  nm: ([t, s]) => `${t[1]} (${s[1]})`, states: ['n', 'r'], mat: () => 'metal',
  build: ([t, s]) => (P) => {
    const k = s[2];
    switch (t[0]) {
      case 'verticale': P.c(0.8 * k, 2.4 * k, 0, 1.2 * k + 0.3, 0, 'metal', 0x8a8e8e, 0, 0, 0, 20); P.t(0.1, 0.8 * k, 0.3 * k, 0, 2.55 * k + 0.3, 0, 'metal', 0x8a8e8e, 0, 0, 0, 20); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; P.b(0.08, 0.5, 0.08, Math.cos(a) * 0.7 * k, 0.25, Math.sin(a) * 0.7 * k, 'metal', 0x3a3a3a); } break;
      case 'horizontale': P.c(0.75 * k, 3 * k, 0, 0.9 * k + 0.2, 0, 'metal', 0xd0d0ca, 0, 0, Math.PI / 2, 20); for (const x of [-1.5 * k, 1.5 * k]) P.s(0.75 * k, x, 0.9 * k + 0.2, 0, 'metal', 0xd0d0ca, 0.3, 1, 1, 16); for (const x of [-1, 1]) P.b(0.3, 0.9 * k, 1.2 * k, x * k, 0.45 * k, 0, 'concrete', 0x8a8680); break;
      case 'silo': P.c(1.2 * k, 5 * k, 0, 2.5 * k + 1, 0, 'metal', 0xb0b4b4, 0, 0, 0, 20); P.t(0.15, 1.2 * k, 1.2 * k, 0, 5.6 * k + 1, 0, 'metal', 0xb0b4b4, 0, 0, 0, 20); P.t(1.2 * k, 0.2, 1, 0, 0.5, 0, 'metal', 0x9a9e9e, 0, 0, 0, 20); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; P.b(0.12, 1.5, 0.12, Math.cos(a) * 1.1 * k, 0.75, Math.sin(a) * 1.1 * k, 'metal', 0x3a3a3a); } break;
      case 'inox': P.c(0.6 * k, 1.8 * k, 0, 0.9 * k + 0.25, 0, 'metal', 0xc8cacc, 0, 0, 0, 20); P.s(0.6 * k, 0, 1.8 * k + 0.25, 0, 'metal', 0xc8cacc, 1, 0.4, 1, 18); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; P.c(0.03, 0.3, Math.cos(a) * 0.5 * k, 0.15, Math.sin(a) * 0.5 * k, 'metal', 0xb0b2b4); } P.c(0.15, 0.04, 0, 1.0 * k, 0.6 * k, 'metal', 0xb0b2b4, Math.PI / 2, 0, 0, 14); break;
      default: P.c(1.0 * k, 1.6 * k, 0, 0.8 * k + 2.5, 0, 'wood', 0x7a5a3a, 0, 0, 0, 18); for (let i = 0; i < 4; i++) P.c(1.02 * k, 0.05, 0, 2.6 + i * 0.4 * k, 0, 'metal', 0x3a3a3a, 0, 0, 0, 18); P.t(0.05, 1.1 * k, 0.5 * k, 0, 1.6 * k + 2.75, 0, 'metal', 0x6a3a2a, 0, 0, 0, 18); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; P.b(0.12, 2.5, 0.12, Math.cos(a) * 0.8 * k, 1.25, Math.sin(a) * 0.8 * k, 'wood', 0x5a4030); }
    }
  },
});
mdFam({
  key: 'charp', famName: 'Charpentes métalliques et échafaudages', cat: 'industriel', g: 'f',
  axes: [[['ipn2', 'Poutrelle de 2 m', 'f'], ['ipn4', 'Poutrelle de 4 m', 'f'], ['tas', 'Tas de poutrelles', 'm'], ['treillis', 'Pylône en treillis', 'm'], ['echaf1', 'Échafaudage (1 étage)', 'm'], ['echaf2', 'Échafaudage (2 étages)', 'm'],
    ['passerelle', 'Passerelle métallique', 'f'], ['echelle', 'Échelle à crinoline', 'f'], ['escalier', 'Escalier métallique', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'r', 'x'], mat: () => 'metal',
  build: ([t]) => (P) => {
    const col = 0x6a6e6e, ipn = (L, x, y, z, ry = 0, rz = 0) => partsUnder(P, mtx(x, y, z, 0, ry, rz), (Q) => { Q.b(L, 0.012, 0.2, 0, 0.144, 0, 'metal', col); Q.b(L, 0.012, 0.2, 0, -0.144, 0, 'metal', col); Q.b(L, 0.28, 0.012, 0, 0, 0, 'metal', col); });
    switch (t[0]) {
      case 'ipn2': ipn(2, 0, 0.15, 0); break;
      case 'ipn4': ipn(4, 0, 0.15, 0); break;
      case 'tas': for (let i = 0; i < 5; i++) ipn(3, 0, 0.15 + Math.floor(i / 3) * 0.3, (i % 3) * 0.22 - 0.22 + Math.floor(i / 3) * 0.11, (i % 2) * 0.05); break;
      case 'treillis': for (const x of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) P.b(0.06, 6, 0.06, x, 3, z, 'metal', col); for (let i = 0; i < 12; i++) { const y = i * 0.5; for (const [a, b] of [[[-0.4, y, -0.4], [0.4, y + 0.5, -0.4]], [[0.4, y, 0.4], [-0.4, y + 0.5, 0.4]], [[-0.4, y, 0.4], [-0.4, y + 0.5, -0.4]], [[0.4, y, -0.4], [0.4, y + 0.5, 0.4]]]) boxBetween(P, 'metal', col, a, b, 0.03); } break;
      case 'echaf1': case 'echaf2': { const n = t[0] === 'echaf1' ? 1 : 2; for (let k = 0; k < n; k++) { const y0 = k * 2; for (const x of [-1, 1]) for (const z of [-0.4, 0.4]) P.c(0.024, 2, x, y0 + 1, z, 'metal', 0xb0b2b4, 0, 0, 0, 8); for (const z of [-0.4, 0.4]) { P.c(0.02, 2, 0, y0 + 1.95, z, 'metal', 0xb0b2b4, 0, 0, Math.PI / 2, 8); boxBetween(P, 'metal', 0xb0b2b4, [-1, y0 + 0.1, z], [1, y0 + 1.9, z], 0.03); } P.b(2.0, 0.04, 0.8, 0, y0 + 2.0, 0, 'wood', 0xb89460); } break; }
      case 'passerelle': P.b(3, 0.04, 0.9, 0, 2.5, 0, 'tex:metal_grating', 0xffffff); for (const z of [-0.45, 0.45]) { P.b(3, 0.04, 0.04, 0, 3.5, z, 'metal', 0xc8a030); P.b(3, 0.04, 0.04, 0, 3.0, z, 'metal', 0xc8a030); for (const x of [-1.4, 0, 1.4]) P.b(0.04, 1.0, 0.04, x, 3.0, z, 'metal', 0xc8a030); } for (const x of [-1.4, 1.4]) for (const z of [-0.4, 0.4]) P.b(0.1, 2.5, 0.1, x, 1.25, z, 'metal', col); break;
      case 'echelle': for (const x of [-0.22, 0.22]) P.b(0.05, 5, 0.05, x, 2.5, 0, 'metal', col); for (let i = 0; i < 16; i++) P.c(0.012, 0.44, 0, 0.3 + i * 0.3, 0, 'metal', col, 0, 0, Math.PI / 2, 6); for (let i = 0; i < 6; i++) P.o(0.36, 0.015, 0, 2.2 + i * 0.5, 0.36, 'metal', col, Math.PI / 2, 0, 0); break;
      default: { const H = 3, L = 3.2; boxBetween(P, 'metal', col, [-0.45, 0, L / 2], [-0.45, H, -L / 2], 0.05, 0.25); boxBetween(P, 'metal', col, [0.45, 0, L / 2], [0.45, H, -L / 2], 0.05, 0.25); for (let i = 0; i < 14; i++) P.b(0.88, 0.03, 0.22, 0, (i + 0.5) * (H / 14), L / 2 - (i + 0.5) * (L / 14), 'tex:metal_diamond', 0xffffff); for (const x of [-0.5, 0.5]) boxBetween(P, 'metal', 0xc8a030, [x, 1, L / 2], [x, H + 1, -L / 2], 0.04); }
    }
  },
});
mdFam({
  key: 'elec', famName: 'Matériel électrique', cat: 'industriel', g: 'f',
  axes: [[['armoire1', 'Armoire électrique (1 porte)', 'f'], ['armoire3', 'Armoire électrique (3 portes)', 'f'], ['transfo', 'Transformateur', 'm'], ['poteau', 'Transformateur sur poteau', 'm'], ['compteur', 'Tableau de compteurs', 'm'],
    ['touret', 'Touret de câble', 'm'], ['disjoncteur', 'Disjoncteur mural', 'm'], ['borne', 'Borne de recharge', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'r', 'b'], mat: () => 'metal', opts: ([t]) => ({ wall: t[0] === 'compteur' || t[0] === 'disjoncteur', solid: t[0] !== 'disjoncteur' }),
  build: ([t]) => (P) => {
    const g = 0x8a8e8a;
    switch (t[0]) {
      case 'armoire1': case 'armoire3': { const n = t[0] === 'armoire1' ? 1 : 3, w = 0.65 * n; P.b(w, 2.0, 0.45, 0, 1.0, 0, 'metal', g); for (let i = 0; i < n; i++) { const x = -w / 2 + 0.65 * (i + 0.5); P.b(0.6, 1.9, 0.02, x, 1.0, 0.23, 'metal', mdShade(g, 1.05)); P.b(0.2, 0.2, 0.005, x, 1.6, 0.242, 'paint', 0xe8c020); P.b(0.03, 0.15, 0.03, x + 0.24, 1.0, 0.25, 'metal', 0x2a2a2a); } P.b(w, 0.1, 0.45, 0, 0.05, 0, 'paint', 0x2a2a2a); break; }
      case 'transfo': P.b(1.4, 1.6, 1.0, 0, 0.8, 0, 'metal', 0x6a7a6a); for (let i = 0; i < 10; i++) P.b(0.02, 1.2, 0.2, -0.6 + i * 0.13, 0.8, 0.6, 'metal', 0x5a6a5a); for (const x of [-0.4, 0, 0.4]) { P.c(0.06, 0.4, x, 1.8, 0, 'plastic', 0x8a5030, 0, 0, 0, 10); for (let k = 0; k < 3; k++) P.c(0.09, 0.03, x, 1.65 + k * 0.1, 0, 'plastic', 0x8a5030, 0, 0, 0, 10); } P.b(0.3, 0.3, 0.005, 0, 1.0, 0.505, 'paint', 0xe8c020); break;
      case 'poteau': P.c(0.14, 9, 0, 4.5, 0, 'wood', 0x4a3a2a); P.c(0.35, 1.1, 0.4, 5.5, 0, 'metal', 0x8a8e8e, 0, 0, 0, 14); P.b(2.2, 0.12, 0.12, 0, 8.4, 0, 'wood', 0x4a3a2a); for (const x of [-0.9, 0, 0.9]) P.c(0.04, 0.2, x, 8.55, 0, 'plastic', 0x5a6a7a, 0, 0, 0, 8); break;
      case 'compteur': P.b(1.2, 0.9, 0.18, 0, 1.5, 0.09, 'wood', 0x6a5a40); for (let i = 0; i < 6; i++) { const x = -0.4 + (i % 3) * 0.4, y = 1.3 + Math.floor(i / 3) * 0.4; P.b(0.22, 0.28, 0.12, x, y, 0.22, 'plastic', 0x1a1a1a); P.c(0.07, 0.01, x, y + 0.04, 0.285, 'glass', 0xd8d8d0, Math.PI / 2, 0, 0, 12); } break;
      case 'touret': for (const z of [-0.4, 0.4]) P.c(0.7, 0.06, 0, 0.7, z, 'wood', 0xa07a50, Math.PI / 2, 0, 0, 20); P.c(0.4, 0.74, 0, 0.7, 0, 'rubber', 0x1a1a1a, Math.PI / 2, 0, 0, 16); break;
      case 'disjoncteur': P.b(0.5, 0.7, 0.15, 0, 1.6, 0.075, 'metal', 0xb0b4b0); P.b(0.12, 0.2, 0.08, 0.3, 1.6, 0.1, 'metal', 0x2a2a2a); P.b(0.04, 0.1, 0.1, 0.3, 1.65, 0.18, 'plastic', 0xc02020, 0.5, 0, 0); P.b(0.2, 0.2, 0.005, 0, 1.75, 0.152, 'paint', 0xe8c020); break;
      default: P.b(0.4, 1.4, 0.3, 0, 0.7, 0, 'plastic', 0xd8d8d2); P.b(0.25, 0.2, 0.01, 0, 1.15, 0.155, 'glow', 0x40a0e0); P.c(0.02, 0.6, 0.25, 0.8, 0.1, 'rubber', 0x1a1a1a, 0, 0, 0.4, 6);
    }
  },
});
mdFam({
  key: 'atel', famName: 'Équipement d’atelier', cat: 'industriel', g: 'm',
  axes: [[['etabli', 'Établi en bois', 'm'], ['etabli_outils', 'Établi garni d’outils', 'm'], ['etau', 'Établi à étau', 'm'], ['servante', 'Servante d’atelier', 'f'], ['enclume', 'Enclume sur billot', 'f'], ['convoyeur', 'Convoyeur à rouleaux', 'm'], ['tapis', 'Tapis roulant', 'm'], ['chariot', 'Chariot de manutention', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'u', 'r'], mat: ([t]) => (t[0].startsWith('etabli') ? 'bois' : 'metal'),
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'etabli': case 'etabli_outils': case 'etau':
        P.b(2.0, 0.08, 0.75, 0, 0.88, 0, 'wood', 0xa07a50); mdLegs(P, 2.0, 0.75, 0.84, 0.08, 'wood', 0x7a5a3a, 0.06); P.b(1.8, 0.03, 0.6, 0, 0.2, 0, 'wood', 0x7a5a3a);
        if (t[0] === 'etau') { P.b(0.25, 0.15, 0.12, 0.75, 1.0, 0.35, 'metal', 0x3a5a7a); P.c(0.012, 0.3, 0.75, 1.0, 0.48, 'metal', 0xb0b2b4, 0, 0, Math.PI / 2, 6); }
        if (t[0] !== 'etabli') { P.b(1.8, 1.0, 0.03, 0, 1.6, -0.36, 'wood', 0x9a8a6a); for (let i = 0; i < 9; i++) P.b(rr(R, 0.03, 0.06), rr(R, 0.2, 0.4), 0.03, -0.8 + i * 0.2, 1.65, -0.33, 'metal', pk(R, [0x5a5c5e, 0xa02020, 0x2a2a2a, 0x8a6a40])); }
        break;
      case 'servante': P.b(0.7, 0.9, 0.45, 0, 0.55, 0, 'metal', 0xb02020); for (let i = 0; i < 5; i++) { P.b(0.66, 0.15, 0.02, 0, 0.25 + i * 0.17, 0.23, 'metal', 0xc02a2a); P.b(0.3, 0.02, 0.03, 0, 0.3 + i * 0.17, 0.245, 'metal', 0xb0b2b4); } for (const x of [-0.3, 0.3]) for (const z of [-0.18, 0.18]) P.c(0.05, 0.04, x, 0.05, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 10); break;
      case 'enclume': P.c(0.25, 0.6, 0, 0.3, 0, 'wood', 0x6a4a30, 0, 0, 0, 14); P.b(0.4, 0.14, 0.14, 0, 0.67, 0, 'metal', 0x2a2a2c); P.b(0.2, 0.08, 0.12, 0, 0.56, 0, 'metal', 0x2a2a2c); P.t(0.02, 0.07, 0.2, 0.29, 0.69, 0, 'metal', 0x2a2a2c, 0, 0, Math.PI / 2, 8); break;
      case 'convoyeur': for (const z of [-0.35, 0.35]) P.b(3, 0.12, 0.05, 0, 0.8, z, 'metal', 0xc8a030); for (let i = 0; i < 15; i++) P.c(0.04, 0.68, -1.4 + i * 0.2, 0.82, 0, 'metal', 0xb0b2b4, Math.PI / 2, 0, 0, 10); for (const x of [-1.3, 1.3]) for (const z of [-0.35, 0.35]) P.b(0.06, 0.78, 0.06, x, 0.39, z, 'metal', 0x3a3a3a); break;
      case 'tapis': P.b(4, 0.1, 0.8, 0, 0.85, 0, 'rubber', 0x1e1e1e); for (const z of [-0.42, 0.42]) P.b(4, 0.2, 0.05, 0, 0.85, z, 'metal', 0x6a6e6e); for (const x of [-2, 2]) P.c(0.08, 0.84, x, 0.85, 0, 'metal', 0x8a8c8e, Math.PI / 2, 0, 0, 12); for (const x of [-1.6, 0, 1.6]) for (const z of [-0.4, 0.4]) P.b(0.06, 0.8, 0.06, x, 0.4, z, 'metal', 0x3a3a3a); break;
      default: P.b(1.2, 0.05, 0.7, 0, 0.3, 0, 'metal', 0x2a4a8a); for (const x of [-0.5, 0.5]) for (const z of [-0.3, 0.3]) P.c(0.08, 0.05, x, 0.08, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 10); P.b(0.04, 0.8, 0.6, -0.6, 0.7, 0, 'metal', 0x2a4a8a); P.b(0.04, 0.04, 0.6, -0.62, 1.1, 0, 'rubber', 0x1a1a1a);
    }
  },
});

/* ================================================================= militaire */
mdFam({
  key: 'msac', famName: 'Murets de sacs de sable', cat: 'militaire', g: 'm',
  axes: [[['droit1', 'droit de 1 m'], ['droit2', 'droit de 2 m'], ['angle', 'd’angle'], ['arc', 'en arc'], ['nid', 'en U (nid de tir)']], [['bas', 'bas', 3], ['haut', 'haut', 6]], [['kaki', 'kaki', 0x968c64], ['sable', 'sable', 0xbea882], ['jute', 'en jute', 0xa08258]]],
  nm: ([s, h, c]) => `Muret de sacs de sable ${s[1]} ${h[1]} (${c[1]})`, states: ['n', 'g', 's'], mat: () => 'tissu',
  build: ([s, h, c]) => (P) => {
    const R = P.R, bag = (x, y, z, ry) => P.b(0.5, 0.14, 0.3, x, y, z, 'fabric', mdShade(c[2], 0.88 + R() * 0.2), (R() - 0.5) * 0.06, ry, (R() - 0.5) * 0.06);
    const pts = [];
    if (s[0] === 'droit1' || s[0] === 'droit2') { const n = s[0] === 'droit1' ? 2 : 4; for (let i = 0; i < n; i++) pts.push([-(n - 1) * 0.25 + i * 0.5, 0, 0]); }
    else if (s[0] === 'angle') { for (let i = 0; i < 3; i++) pts.push([-0.5 + i * 0.5, 0, 0]); for (let i = 1; i < 3; i++) pts.push([0.5 + 0.1, -i * 0.5 + 0.1, Math.PI / 2]); }
    else if (s[0] === 'arc') for (let i = 0; i < 6; i++) { const a = -Math.PI / 2.4 + (i / 5) * (Math.PI / 1.2); pts.push([Math.sin(a) * 1.4, Math.cos(a) * 1.4 - 1.2, -a]); }
    else { for (let i = 0; i < 3; i++) pts.push([-0.5 + i * 0.5, 0.5, 0]); for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) pts.push([sx * 0.85, 0.1 - i * 0.5, Math.PI / 2]); }
    for (let r = 0; r < h[2]; r++) for (const [x, z, ry] of pts) { const o = r % 2 ? 0.12 : -0.12, dx = Math.cos(ry) * o, dz = -Math.sin(ry) * o; bag(x + dx, 0.07 + r * 0.14, z + dz, ry); }
  },
});
mdFam({
  key: 'mun', famName: 'Caisses militaires', cat: 'militaire', g: 'f',
  axes: [[['petite', 'Caisse de munitions', 'f'], ['grande', 'Grande caisse militaire', 'f'], ['ouverte', 'Caisse de munitions ouverte', 'f'], ['pile', 'Pile de caisses militaires', 'f'], ['obus', 'Caisse d’obus', 'f']], [['olive', 'vert olive', 0x4c5a3c], ['kaki', 'kaki', 0x7a7050], ['gris', 'gris', 0x5a5e60], ['bois', 'en bois', 0x8a7458]]],
  nm: ([t, c]) => `${t[1]} ${c[1]}`, states: ['n', 'u', 'b'], mat: ([, c]) => (c[0] === 'bois' ? 'bois' : 'metal'), opts: ([t]) => ({ solid: t[0] !== 'petite' }),
  build: ([t, c]) => (P) => {
    const f = c[0] === 'bois' ? 'wood' : 'metal', col = c[2], R = P.R;
    const box = (w, h, d, x, y, z, ry = 0) => { P.b(w, h, d, x, y + h / 2, z, f, col, 0, ry, 0); P.b(w + 0.02, 0.03, d + 0.02, x, y + h, z, f, mdShade(col, 0.8), 0, ry, 0); P.b(w * 0.4, h * 0.25, 0.005, x + Math.sin(ry) * (d / 2 + 0.003), y + h * 0.5, z + Math.cos(ry) * (d / 2 + 0.003), 'paint', 0xd8c870, 0, ry, 0); };
    switch (t[0]) {
      case 'petite': box(0.5, 0.26, 0.24, 0, 0, 0); P.b(0.12, 0.03, 0.04, 0, 0.29, 0, 'metal', 0x2a2a2a); break;
      case 'grande': box(1.2, 0.5, 0.6, 0, 0, 0); for (const x of [-0.62, 0.62]) P.b(0.03, 0.06, 0.2, x, 0.35, 0, 'metal', 0x2a2a2a); break;
      case 'ouverte': P.b(0.8, 0.35, 0.45, 0, 0.175, 0, f, col); P.b(0.76, 0.02, 0.41, 0, 0.34, 0, 'paint', 0x1a1a1a); for (let i = 0; i < 5; i++) P.c(0.035, 0.36, -0.3 + i * 0.15, 0.36, 0, 'metal', 0xb09040, 0, 0, Math.PI / 2, 8); P.b(0.8, 0.03, 0.45, 0, 0.55, -0.3, f, col, -1.1, 0, 0); break;
      case 'pile': for (let i = 0; i < 6; i++) box(0.5, 0.26, 0.24, (i % 2) * 0.52 - 0.26, Math.floor(i / 2) * 0.29, rr(R, -0.03, 0.03), rr(R, -0.08, 0.08)); break;
      default: box(1.0, 0.3, 0.45, 0, 0, 0); for (let i = 0; i < 4; i++) { P.c(0.06, 0.6, -0.36 + i * 0.24, 0.42, 0.05, 'metal', 0xa08040, 0, 0, Math.PI / 2, 10); }
    }
  },
});
mdFam({
  key: 'obst', famName: 'Obstacles et barricades', cat: 'militaire', g: 'm',
  axes: [[['herisson', 'Hérisson tchèque', 'm'], ['frise', 'Cheval de frise', 'm'], ['barbeles', 'Rouleau de barbelés', 'm'], ['dents', 'Dents de dragon', 'f'], ['beton', 'Séparateur en béton', 'm'], ['barricade', 'Barricade de fortune', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'dents'], states: ['n', 'r', 'm'], mat: ([t]) => (t[0] === 'dents' || t[0] === 'beton' ? 'pierre' : 'metal'),
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'herisson': for (const [rx, rz] of [[0.75, 0], [-0.75, 0], [0, 1.57]]) P.b(0.12, 1.8, 0.12, 0, 0.65, 0, 'metal', 0x5a5a58, rx, rz ? 0 : 0.78, rz); break;
      case 'frise': P.b(3, 0.15, 0.15, 0, 0.8, 0, 'wood', 0x6a5038); for (let i = 0; i < 6; i++) { const x = -1.25 + i * 0.5; P.b(0.08, 1.8, 0.08, x, 0.8, 0, 'wood', 0x6a5038, 0.75, 0, 0); P.b(0.08, 1.8, 0.08, x, 0.8, 0, 'wood', 0x6a5038, -0.75, 0, 0); } for (let i = 0; i < 4; i++) P.o(0.4, 0.008, rr(R, -1.2, 1.2), 0.8, 0, 'metal', 0x6a6a68, 0, Math.PI / 2, 0); break;
      case 'barbeles': for (let i = 0; i < 9; i++) P.o(0.45, 0.01, -1.6 + i * 0.4, 0.45, 0, 'metal', 0x7a7a78, R() * 0.3, Math.PI / 2 + R() * 0.3, 0); for (const x of [-1.8, 1.8]) P.b(0.05, 0.9, 0.05, x, 0.45, 0, 'metal', 0x4a4a48); break;
      case 'dents': for (let i = 0; i < 3; i++) P.t(0.15, 0.5, 1.0, (i - 1) * 1.2, 0.5, 0, 'concrete', 0x9a968c, 0, Math.PI / 4, 0, 4); break;
      case 'beton': P.t(0.12, 0.3, 0.8, 0, 0.4, 0, 'concrete', 0xb0aca2, 0, Math.PI / 4, 0, 4); P.b(2.0, 0.8, 0.3, 0, 0.4, 0, 'concrete', 0xb0aca2); P.b(2.0, 0.25, 0.6, 0, 0.125, 0, 'concrete', 0xa8a49a); for (let i = 0; i < 4; i++) P.b(0.45, 0.06, 0.006, -0.7 + i * 0.48, 0.65, 0.152, 'paint', i % 2 ? 0xd8d8d0 : 0xb02020); break;
      default: P.b(1.8, 0.8, 0.5, 0, 0.4, 0, 'wood', 0x7a6040, 0, 0.1, 0.05); P.b(1.0, 0.9, 0.7, 0.9, 0.45, 0.3, 'metal', 0x6a3a2a, 0, 0.6, 0); P.c(0.29, 0.86, -0.9, 0.43, 0.4, 'rust', 0xffffff, 0, 0, 0, 14); for (let i = 0; i < 5; i++) P.b(0.15, 0.03, 2.0, rr(R, -0.8, 0.8), 0.85 + i * 0.05, 0, 'wood', 0x8a6a48, 0, rr(R, -0.3, 0.3), rr(R, -0.2, 0.2));
    }
  },
});
mdFam({
  key: 'tente', famName: 'Tentes', cat: 'militaire', g: 'f',
  axes: [[['canadienne', 'Tente canadienne', 'f'], ['modulaire', 'Tente modulaire', 'f'], ['hopital', 'Tente d’hôpital de campagne', 'f'], ['filet', 'Filet de camouflage', 'm']], [['kaki', 'kaki', 0x6a6a48], ['sable', 'sable', 0xb8a47a], ['gris', 'gris', 0x7a7c7a]]],
  nm: ([t, c]) => `${t[1]} ${c[1]}`, gp: ([t]) => [t[2], false], states: ['n', 'c', 'b'], mat: () => 'tissu',
  build: ([t, c]) => (P) => {
    const col = t[0] === 'hopital' ? 0xd8d4c4 : c[2];
    if (t[0] === 'canadienne') { for (const s of [-1, 1]) P.b(1.4, 0.03, 2.2, s * 0.5, 0.6, 0, 'fabric', col, 0, 0, s * -0.7); gable(P, 'fabric', mdShade(col, 0.9), 0, 0, 1.1, 1.9, 1.2, 0.03); gable(P, 'fabric', mdShade(col, 0.9), 0, 0, -1.1, 1.9, 1.2, 0.03); P.p(0.6, 0.9, 0, 0.45, 1.12, 'paint', 0x1a1a14, -Math.PI / 2, 0, 0); return; }
    if (t[0] === 'filet') { for (const [x, z] of [[-1.8, -1.2], [1.8, -1.2], [-1.8, 1.2], [1.8, 1.2]]) P.b(0.06, 2.2, 0.06, x, 1.1, z, 'wood', 0x6a5038); P.b(4.2, 0.04, 3.0, 0, 2.25, 0, 'foliage', col, 0.02, 0, 0.03); for (let i = 0; i < 10; i++) P.b(0.5, 0.6, 0.02, -1.9 + (i % 5) * 0.95, 1.9, i < 5 ? -1.45 : 1.45, 'foliage', mdShade(col, 0.9), 0.2, 0, 0); return; }
    const L = t[0] === 'hopital' ? 6 : 4.5, W = 4;
    P.b(L, 1.6, W, 0, 0.8, 0, 'fabric', col); for (const s of [-1, 1]) P.b(L + 0.1, 0.04, W * 0.62, 0, 2.15, s * W * 0.27, 'fabric', mdShade(col, 0.95), s * -0.42, 0, 0);
    gable(P, 'fabric', col, -L / 2, 1.6, 0, W, 1.1, 0.04, Math.PI / 2); gable(P, 'fabric', col, L / 2, 1.6, 0, W, 1.1, 0.04, Math.PI / 2);
    P.b(0.04, 1.5, 1.2, L / 2 + 0.01, 0.75, 0, 'paint', 0x1a1a14);
    if (t[0] === 'hopital') for (const z of [-W / 2 - 0.01, W / 2 + 0.01]) { P.b(0.8, 0.25, 0.01, 0, 1.0, z, 'paint', 0xc02020); P.b(0.25, 0.8, 0.01, 0, 1.0, z, 'paint', 0xc02020); }
  },
});
mdFam({
  key: 'mil', famName: 'Équipement militaire', cat: 'militaire', g: 'm',
  axes: [[['casques', 'Pile de casques', 'f'], ['obus', 'Obus inertes', 'm'], ['civiere', 'Civière militaire', 'f'], ['jumelles', 'Longue-vue sur trépied', 'f'], ['projecteur', 'Projecteur de DCA', 'm'], ['table', 'Table de cartes', 'f'], ['mat', 'Mât et drapeau', 'm'], ['guerite', 'Guérite', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'obus'], states: ['n', 'u', 'r'], mat: () => 'metal', opts: ([t]) => ({ solid: !['casques', 'civiere', 'obus'].includes(t[0]) }),
  build: ([t]) => (P) => {
    const R = P.R, ol = 0x4c5a3c;
    switch (t[0]) {
      case 'casques': for (let i = 0; i < 6; i++) P.s(0.15, rr(R, -0.3, 0.3), 0.06 + (i > 3 ? 0.12 : 0), rr(R, -0.25, 0.25), 'metal', mdShade(ol, 0.9 + R() * 0.2), 1, 0.6, 1.1, 12); break;
      case 'obus': for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.16; P.c(0.06, 0.4, x, 0.2, 0, 'metal', 0xa08040, 0, 0, 0, 12); P.t(0.01, 0.06, 0.16, x, 0.48, 0, 'metal', 0x6a6a6a, 0, 0, 0, 12); } break;
      case 'civiere': for (const z of [-0.28, 0.28]) P.c(0.02, 2.2, 0, 0.3, z, 'wood', 0x6a5038, 0, 0, Math.PI / 2, 8); P.b(1.8, 0.02, 0.56, 0, 0.3, 0, 'fabric', ol); for (const x of [-0.8, 0.8]) for (const z of [-0.28, 0.28]) P.b(0.03, 0.3, 0.03, x, 0.15, z, 'metal', 0x3a3a3a); break;
      case 'jumelles': for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; boxBetween(P, 'metal', 0x3a3a3a, [0, 1.3, 0], [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4], 0.025); } P.c(0.05, 0.6, 0, 1.4, 0.1, 'metal', ol, Math.PI / 2 - 0.1, 0, 0, 12); break;
      case 'projecteur': P.c(0.5, 0.1, 0, 0.05, 0, 'metal', 0x3a3a3a, 0, 0, 0, 16); P.b(0.1, 0.8, 0.5, -0.4, 0.5, 0, 'metal', ol); P.b(0.1, 0.8, 0.5, 0.4, 0.5, 0, 'metal', ol); P.c(0.42, 0.7, 0, 1.0, 0, 'metal', ol, Math.PI / 2 - 0.4, 0, 0, 18); P.c(0.38, 0.02, 0, 1.13, 0.33, 'glow', 0xf0f0e0, Math.PI / 2 - 0.4, 0, 0, 18); break;
      case 'table': P.b(1.6, 0.04, 1.0, 0, 0.8, 0, 'wood', 0x7a6040); mdLegs(P, 1.6, 1.0, 0.78, 0.06, 'wood', 0x5a4030, 0.05); P.b(1.4, 0.005, 0.85, 0, 0.823, 0, 'paper', 0xd8ccaa); for (let i = 0; i < 5; i++) P.c(0.012, 0.04, rr(R, -0.6, 0.6), 0.84, rr(R, -0.35, 0.35), 'plastic', pk(R, [0xc02020, 0x2040c0]), 0, 0, 0, 6); break;
      case 'mat': P.c(0.04, 6, 0, 3, 0, 'metal', 0xb0b2b4); P.b(1.4, 0.9, 0.01, 0.72, 5.4, 0, 'fabric', 0x2a3a6a); P.b(1.4, 0.3, 0.012, 0.72, 5.4, 0, 'fabric', 0xc8c4b8); P.c(0.3, 0.2, 0, 0.1, 0, 'concrete', 0x8a8680, 0, 0, 0, 14); break;
      default: P.b(1.2, 2.3, 1.2, 0, 1.15, 0, 'wood', 0x6a6040); P.b(1.0, 2.0, 0.02, 0, 1.05, 0.6, 'paint', 0x1a1a14); P.t(0.1, 0.95, 0.5, 0, 2.55, 0, 'wood', 0x5a5030, 0, Math.PI / 4, 0, 4); for (const x of [-0.6, 0.6]) P.b(0.04, 2.3, 0.04, x, 1.15, 0.62, 'paint', [0xc02020, 0xe8e4d8][(x > 0) | 0]);
    }
  },
});

/* ======================================================================== rue */
mdFam({
  key: 'lamp', famName: 'Lampadaires', cat: 'urbain', g: 'm',
  axes: [[['moderne', 'moderne'], ['ancien', 'ancien en fonte'], ['double', 'double'], ['parc', 'de parc']]],
  nm: ([t]) => `Lampadaire ${t[1]}`, states: ['n', 'e', 'pe', 'c'], mat: () => 'metal',
  build: ([t]) => (P) => {
    if (t[0] === 'moderne') { P.c(0.08, 7, 0, 3.5, 0, 'metal', 0x6a6e6e); P.b(1.4, 0.08, 0.1, 0.6, 6.95, 0, 'metal', 0x6a6e6e); P.b(0.6, 0.12, 0.3, 1.3, 6.9, 0, 'metal', 0x4a4e4e); P.b(0.5, 0.02, 0.24, 1.3, 6.83, 0, 'glow', 0xffe8b0); return; }
    if (t[0] === 'double') { P.c(0.08, 8, 0, 4, 0, 'metal', 0x5a5e5e); for (const s of [-1, 1]) { P.b(1.6, 0.08, 0.1, s * 0.75, 7.9, 0, 'metal', 0x5a5e5e); P.b(0.6, 0.12, 0.3, s * 1.5, 7.85, 0, 'metal', 0x3a3e3e); P.b(0.5, 0.02, 0.24, s * 1.5, 7.78, 0, 'glow', 0xffe8b0); } return; }
    if (t[0] === 'parc') { P.c(0.05, 3.4, 0, 1.7, 0, 'metal', 0x2a3a2a); P.s(0.25, 0, 3.6, 0, 'glow', 0xfff0d0, 1, 1, 1, 14); P.c(0.12, 0.08, 0, 3.4, 0, 'metal', 0x2a3a2a, 0, 0, 0, 12); return; }
    P.c(0.18, 0.6, 0, 0.3, 0, 'metal', 0x1e2420, 0, 0, 0, 12); P.t(0.06, 0.12, 3.4, 0, 2.3, 0, 'metal', 0x1e2420, 0, 0, 0, 10); P.c(0.04, 0.6, 0, 4.2, 0, 'metal', 0x1e2420);
    P.t(0.22, 0.12, 0.5, 0, 4.7, 0, 'glow', 0xffd890, 0, Math.PI / 4, 0, 4); P.t(0.05, 0.3, 0.2, 0, 5.05, 0, 'metal', 0x1e2420, 0, Math.PI / 4, 0, 4); P.b(0.36, 0.04, 0.36, 0, 4.45, 0, 'metal', 0x1e2420);
  },
});
mdFam({
  key: 'banc', famName: 'Bancs publics', cat: 'urbain', g: 'm',
  axes: [[['fonte', 'en bois et fonte'], ['beton', 'en béton'], ['metal', 'en métal perforé'], ['parc', 'de parc vert'], ['gare', 'de gare']]],
  nm: ([t]) => `Banc public ${t[1]}`, states: ['n', 'u', 'c', 'b', 's'], mat: ([t]) => (t[0] === 'beton' ? 'pierre' : t[0] === 'metal' ? 'metal' : 'bois'),
  build: ([t]) => (P) => {
    if (t[0] === 'beton') { P.b(2.0, 0.12, 0.5, 0, 0.42, 0, 'concrete', 0xb0aca2); for (const x of [-0.7, 0.7]) P.b(0.15, 0.36, 0.45, x, 0.18, 0, 'concrete', 0xa8a49a); return; }
    if (t[0] === 'metal') { P.b(1.8, 0.04, 0.45, 0, 0.45, 0, 'tex:gx_tp_ronds_acier', 0xffffff); P.b(1.8, 0.4, 0.04, 0, 0.7, -0.22, 'tex:gx_tp_ronds_acier', 0xffffff, -0.15, 0, 0); for (const x of [-0.8, 0.8]) { P.b(0.05, 0.45, 0.05, x, 0.22, 0.15, 'metal', 0x3a3a3a); P.b(0.05, 0.9, 0.05, x, 0.45, -0.2, 'metal', 0x3a3a3a); } return; }
    const wood = t[0] === 'parc' ? 0x3a6a3a : t[0] === 'gare' ? 0x7a5a3a : 0x8a6a48, iron = t[0] === 'parc' ? 0x2a3a2a : 0x1e1e20;
    for (let i = 0; i < 4; i++) P.b(1.8, 0.035, 0.09, 0, 0.45, -0.18 + i * 0.12, 'wood', wood);
    for (let i = 0; i < 3; i++) P.b(1.8, 0.09, 0.035, 0, 0.62 + i * 0.13, -0.27 - i * 0.03, 'wood', wood, -0.2, 0, 0);
    for (const x of [-0.75, 0.75]) { P.b(0.06, 0.45, 0.5, x, 0.22, 0, 'metal', iron); boxBetween(P, 'metal', iron, [x, 0.45, -0.25], [x, 0.95, -0.36], 0.06); P.b(0.06, 0.04, 0.45, x, 0.66, 0.02, 'metal', iron); }
  },
});
const MD_SIGNS = [['stop', 'Panneau stop'], ['danger', 'Panneau de danger'], ['interdit', 'Panneau d’interdiction'], ['sensinterdit', 'Panneau sens interdit'], ['obligation', 'Panneau d’obligation'], ['info', 'Panneau d’indication'],
  ['direction', 'Panneau de direction'], ['zombie', 'Panneau « zone contaminée »']];
mdFam({
  key: 'sig', famName: 'Panneaux routiers', cat: 'urbain', g: 'm', axes: [MD_SIGNS],
  nm: ([t]) => t[1], states: ['n', 'pe', 'r', 'g'], mat: () => 'metal', opts: () => ({ solid: true, foot: [0.2, 0.2] }),
  build: ([t]) => (P) => {
    const y = 2.3;
    P.c(0.03, y + 0.4, 0, (y + 0.4) / 2, 0, 'metal', 0x9a9c9e);
    switch (t[0]) {
      case 'stop': P.c(0.32, 0.02, 0, y, 0.04, 'paint', 0xb81a14, Math.PI / 2, Math.PI / 8, 0, 8); P.b(0.42, 0.1, 0.022, 0, y, 0.052, 'paint', 0xf0f0f0); break;
      case 'danger': P._add('cyl:1:3', mtx(0, y, 0.04, Math.PI / 2, 0, Math.PI, 0.42, 0.02, 0.42), 'paint', 0xb81a14); P._add('cyl:1:3', mtx(0, y - 0.02, 0.051, Math.PI / 2, 0, Math.PI, 0.3, 0.02, 0.3), 'paint', 0xf0f0f0); P.b(0.04, 0.14, 0.022, 0, y, 0.062, 'paint', 0x1a1a1a); break;
      case 'interdit': P.c(0.32, 0.02, 0, y, 0.04, 'paint', 0xb81a14, Math.PI / 2, 0, 0, 24); P.c(0.25, 0.022, 0, y, 0.045, 'paint', 0xf0f0f0, Math.PI / 2, 0, 0, 24); break;
      case 'sensinterdit': P.c(0.32, 0.02, 0, y, 0.04, 'paint', 0xb81a14, Math.PI / 2, 0, 0, 24); P.b(0.42, 0.1, 0.022, 0, y, 0.052, 'paint', 0xf0f0f0); break;
      case 'obligation': P.c(0.32, 0.02, 0, y, 0.04, 'paint', 0x1a4ab0, Math.PI / 2, 0, 0, 24); P.b(0.06, 0.32, 0.022, 0, y - 0.02, 0.052, 'paint', 0xf0f0f0); P._add('cyl:1:3', mtx(0, y + 0.14, 0.052, Math.PI / 2, 0, 0, 0.12, 0.02, 0.12), 'paint', 0xf0f0f0); break;
      case 'info': P.b(0.6, 0.6, 0.02, 0, y, 0.04, 'paint', 0x1a4ab0); P.b(0.3, 0.32, 0.022, 0, y, 0.05, 'paint', 0xf0f0f0); break;
      case 'direction': P.b(1.2, 0.3, 0.02, 0.4, y, 0.04, 'paint', 0xf0f0f0); P._add('cyl:1:3', mtx(1.05, y, 0.04, Math.PI / 2, 0, -Math.PI / 2, 0.17, 0.02, 0.17), 'paint', 0xf0f0f0); P.b(0.8, 0.05, 0.022, 0.4, y, 0.05, 'paint', 0x1a1a1a); P.c(0.03, 0.4, 0, y, 0, 'metal', 0x9a9c9e); break;
      default: P._add('cyl:1:3', mtx(0, y, 0.04, Math.PI / 2, 0, Math.PI, 0.45, 0.02, 0.45), 'paint', 0x1a1a1a); P._add('cyl:1:3', mtx(0, y - 0.02, 0.051, Math.PI / 2, 0, Math.PI, 0.36, 0.02, 0.36), 'paint', 0xe8c020); P.s(0.06, 0, y - 0.02, 0.06, 'paint', 0x1a1a1a, 1, 1, 0.2, 10); for (const a of [0, 2.1, 4.2]) P.b(0.03, 0.12, 0.01, Math.cos(a) * 0.09, y - 0.02 + Math.sin(a) * 0.09, 0.062, 'paint', 0x1a1a1a, 0, 0, a);
    }
  },
});
mdFam({
  key: 'feu', famName: 'Feux de signalisation', cat: 'urbain', g: 'm', axes: [[['poteau', 'sur poteau'], ['potence', 'sur potence'], ['pieton', 'pour piétons']]],
  nm: ([t]) => `Feu tricolore ${t[1]}`.replace('Feu tricolore pour piétons', 'Feu pour piétons'), states: ['n', 'e', 'pe'], mat: () => 'metal',
  build: ([t]) => (P) => {
    const head = (x, y, z, n = 3) => { P.b(0.32, 0.3 * n + 0.1, 0.25, x, y, z, 'metal', 0x2a2a2a); for (let i = 0; i < n; i++) { const yy = y + (i - (n - 1) / 2) * 0.3; P.c(0.1, 0.03, x, yy, z + 0.13, i === n - 1 ? 'glow' : 'plastic', [0x3a1a1a, 0x3a3a1a, 0x30ff60][n === 3 ? i : i + 1] || 0x30ff60, Math.PI / 2, 0, 0, 14); P.b(0.24, 0.04, 0.12, x, yy + 0.12, z + 0.17, 'metal', 0x2a2a2a); } };
    P.c(0.06, t[0] === 'potence' ? 6 : 3, 0, t[0] === 'potence' ? 3 : 1.5, 0, 'metal', 0x6a6e6e);
    if (t[0] === 'potence') { P.c(0.05, 4, 2, 5.8, 0, 'metal', 0x6a6e6e, 0, 0, Math.PI / 2); head(3.5, 5.2, 0); head(0, 3.4, 0.15); }
    else if (t[0] === 'pieton') head(0, 2.6, 0.15, 2);
    else head(0, 2.9, 0.15);
  },
});
mdFam({
  key: 'barr', famName: 'Barrières et plots', cat: 'urbain', g: 'f',
  axes: [[['chantier', 'Barrière de chantier', 'f'], ['vauban', 'Barrière Vauban', 'f'], ['plot', 'Plot en béton', 'm'], ['potelet', 'Potelets', 'm'], ['cone', 'Cônes de signalisation', 'm'], ['passage', 'Barrière de passage à niveau', 'f'], ['herse', 'Herse de police', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'potelet' || t[0] === 'cone'], states: ['n', 'x', 'r'], mat: () => 'metal', opts: ([t]) => ({ solid: t[0] !== 'herse' && t[0] !== 'cone' }),
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'chantier': for (const x of [-0.9, 0.9]) { P.b(0.05, 1.1, 0.05, x, 0.55, 0, 'metal', 0x2a2a2a); P.b(0.05, 0.05, 0.5, x, 0.03, 0, 'metal', 0x2a2a2a); } for (const y of [0.75, 1.0]) { P.b(1.8, 0.18, 0.03, 0, y, 0, 'paint', 0xe8e4dc); for (let i = 0; i < 5; i++) P.b(0.18, 0.181, 0.032, -0.72 + i * 0.36, y, 0, 'paint', 0xc01a14, 0, 0, 0.5); } P.c(0.06, 0.08, 0.9, 1.15, 0, 'glow', 0xffa020, 0, 0, 0, 10); break;
      case 'vauban': P.b(2.0, 0.04, 0.04, 0, 1.05, 0, 'metal', 0xb0b2b4); P.b(2.0, 0.04, 0.04, 0, 0.12, 0, 'metal', 0xb0b2b4); for (let i = 0; i < 17; i++) P.c(0.012, 0.93, -0.96 + i * 0.12, 0.58, 0, 'metal', 0xb0b2b4, 0, 0, 0, 6); for (const x of [-1, 1]) { P.b(0.04, 1.1, 0.04, x, 0.55, 0, 'metal', 0xb0b2b4); P.b(0.04, 0.04, 0.6, x * 0.85, 0.02, 0, 'metal', 0xb0b2b4); } break;
      case 'plot': P.b(0.5, 0.5, 0.5, 0, 0.25, 0, 'concrete', 0xb0aca2); P.b(0.52, 0.08, 0.52, 0, 0.42, 0, 'paint', 0xe8e4dc); break;
      case 'potelet': for (let i = 0; i < 3; i++) { P.c(0.05, 0.9, (i - 1) * 1.2, 0.45, 0, 'metal', 0x3a3a3a, 0, 0, 0, 10); P.c(0.052, 0.06, (i - 1) * 1.2, 0.8, 0, 'paint', 0xe8e4dc, 0, 0, 0, 10); } break;
      case 'cone': for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.7; P.b(0.36, 0.03, 0.36, x, 0.015, 0, 'rubber', 0x1a1a1a); P.t(0.03, 0.15, 0.68, x, 0.37, 0, 'plastic', 0xe0601a, 0, 0, 0, 12); P.t(0.075, 0.1, 0.1, x, 0.45, 0, 'paint', 0xf0f0f0, 0, 0, 0, 12); } break;
      case 'passage': P.b(0.4, 1.0, 0.4, -2.2, 0.5, 0, 'metal', 0xe8e4dc); P.b(4.5, 0.1, 0.08, 0.1, 1.0, 0, 'paint', 0xe8e4dc); for (let i = 0; i < 6; i++) P.b(0.35, 0.102, 0.082, -1.5 + i * 0.7, 1.0, 0, 'paint', 0xc01a14); P.c(0.08, 0.06, -2.2, 1.1, 0.2, 'glow', 0xff3020, Math.PI / 2, 0, 0, 10); break;
      default: P.b(2.2, 0.04, 0.2, 0, 0.02, 0, 'metal', 0x3a3a3a); for (let i = 0; i < 14; i++) P.t(0.002, 0.02, 0.07, -1.0 + i * 0.155, 0.07, 0, 'metal', 0xb0b2b4, 0, 0, 0, 4);
    }
  },
});
mdFam({
  key: 'mobu', famName: 'Mobilier urbain', cat: 'urbain', g: 'f',
  axes: [[['boitelettres', 'Boîte aux lettres', 'f'], ['cabine', 'Cabine téléphonique', 'f'], ['borne', 'Borne incendie', 'f'], ['parcmetre', 'Parcmètre', 'm'], ['colonne', 'Colonne d’affichage', 'f'], ['fontaine', 'Fontaine publique', 'f'],
    ['kiosque', 'Kiosque à journaux', 'm'], ['velos', 'Arceaux à vélos', 'm'], ['jardiniere', 'Jardinière en béton', 'f'], ['horloge', 'Horloge sur colonne', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'velos'], states: ['n', 'u', 'c'], mat: () => 'metal', opts: ([t]) => ({ solid: t[0] !== 'velos' }),
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'boitelettres': P.c(0.04, 1.0, 0, 0.5, 0, 'metal', 0x3a3a3a); P.b(0.4, 0.5, 0.35, 0, 1.2, 0, 'metal', 0xe0b020); P.c(0.2, 0.4, 0, 1.45, 0, 'metal', 0xe0b020, 0, 0, Math.PI / 2, 14); P.b(0.25, 0.03, 0.02, 0, 1.3, 0.18, 'paint', 0x1a1a1a); break;
      case 'cabine': P.b(1.0, 2.4, 1.0, 0, 1.2, 0, 'glass', 0xa8c0c8); for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) P.b(0.06, 2.5, 0.06, x, 1.25, z, 'metal', 0x6a6e6e); P.b(1.06, 0.15, 1.06, 0, 2.5, 0, 'metal', 0x2a4a8a); P.b(0.3, 0.4, 0.15, 0, 1.4, -0.4, 'metal', 0x3a3a3a); P.b(0.9, 0.12, 0.01, 0, 2.45, 0.535, 'glow', 0xe8f0ff); break;
      case 'borne': P.c(0.14, 0.7, 0, 0.35, 0, 'metal', 0xc02020, 0, 0, 0, 14); P.s(0.14, 0, 0.7, 0, 'metal', 0xc02020, 1, 0.6, 1, 14); for (const s of [-1, 1]) P.c(0.06, 0.12, s * 0.17, 0.45, 0, 'metal', 0xc02020, 0, 0, Math.PI / 2, 10); P.c(0.18, 0.06, 0, 0.03, 0, 'metal', 0x8a1a14, 0, 0, 0, 14); break;
      case 'parcmetre': P.c(0.04, 1.1, 0, 0.55, 0, 'metal', 0x3a3a3a); P.b(0.22, 0.4, 0.16, 0, 1.3, 0, 'metal', 0x6a6e6e); P.s(0.12, 0, 1.55, 0, 'metal', 0x6a6e6e, 1, 0.6, 0.8, 12); P.b(0.12, 0.08, 0.01, 0, 1.4, 0.085, 'glass', 0xd0d8d0); break;
      case 'colonne': P.c(0.55, 3, 0, 1.5, 0, 'tex:poster_wall', 0xffffff, 0, 0, 0, 18); P.c(0.6, 0.12, 0, 0.06, 0, 'metal', 0x2a3a2a, 0, 0, 0, 18); P.t(0.1, 0.62, 0.5, 0, 3.25, 0, 'metal', 0x2a3a2a, 0, 0, 0, 18); break;
      case 'fontaine': P.c(0.9, 0.4, 0, 0.2, 0, 'stone', 0x9a948a, 0, 0, 0, 20); P.c(0.8, 0.02, 0, 0.38, 0, 'liquid', 0x3a5a6a, 0, 0, 0, 20); P.c(0.12, 1.2, 0, 0.8, 0, 'stone', 0x9a948a, 0, 0, 0, 12); P.c(0.4, 0.15, 0, 1.4, 0, 'stone', 0x9a948a, 0, 0, 0, 16); break;
      case 'kiosque': P.b(2.0, 2.4, 1.6, 0, 1.2, 0, 'metal', 0x2a4a3a); P.t(0.2, 1.4, 0.6, 0, 2.7, 0, 'metal', 0x2a3a2a, 0, Math.PI / 4, 0, 4); P.b(1.6, 1.0, 0.05, 0, 1.4, 0.81, 'paint', 0x1a1a1a); P.b(1.8, 0.05, 0.4, 0, 0.9, 0.95, 'wood', 0x6a5038); for (let i = 0; i < 8; i++) P.b(0.2, 0.28, 0.01, -0.7 + i * 0.2, 2.0, 0.81, 'paper', pk(P.R, [0xe8e4d8, 0xd8c8a0, 0xe8d0d0])); break;
      case 'velos': for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.7; for (const s of [-1, 1]) P.c(0.025, 0.8, x + s * 0.3, 0.4, 0, 'metal', 0x6a6e6e, 0, 0, 0, 8); P.o(0.3, 0.025, x, 0.8, 0, 'metal', 0x6a6e6e, 0, 0, 0); } break;
      case 'jardiniere': P.b(1.6, 0.6, 0.8, 0, 0.3, 0, 'concrete', 0xb0aca2); P.b(1.5, 0.05, 0.7, 0, 0.58, 0, 'paper', 0x3a2a1a); for (let i = 0; i < 6; i++) P.s(0.18, -0.6 + i * 0.24, 0.72, 0, 'foliage', 0x3e6a32, 1, 0.8, 1, 8); break;
      default: P.c(0.1, 3.2, 0, 1.6, 0, 'metal', 0x1e2a20); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; P.c(0.22, 0.05, Math.sin(a) * 0.15, 3.4, Math.cos(a) * 0.15, 'metal', 0x1e2a20, Math.PI / 2, a, 0, 16); P.c(0.18, 0.052, Math.sin(a) * 0.15, 3.4, Math.cos(a) * 0.15, 'glow', 0xf0ecd8, Math.PI / 2, a, 0, 16); }
    }
  },
});

/* ============================================================== structures */
const MD_WALLMAT = [['brique', 'de briques', 'gx_br_std_rouge'], ['ancien', 'de briques anciennes', 'gx_br_std_ancien_u'], ['pierre', 'de pierres', 'gx_pt_moellons_calcaire'], ['beton', 'de béton', 'gx_bt_brut_gris'],
  ['parpaing', 'de parpaings', 'gx_pa_gris'], ['crepi', 'crépi', 'gx_en_crepi_ocre']];
mdFam({
  key: 'mur', famName: 'Murs et murets', cat: 'structure', g: 'm',
  axes: [[['muret', 'Muret', 0.7], ['mur', 'Mur', 2.2]], [['1', 'de 1 m', 1], ['2', 'de 2 m', 2], ['4', 'de 4 m', 4]], MD_WALLMAT, [['entier', ''], ['ruine', 'en ruine']]],
  nm: ([h, l, m, e]) => `${h[1]} ${m[1]} ${l[1]}${e[1] ? ` ${e[1]}` : ''}`, states: ['n', 'm', 'g'], mat: () => 'pierre',
  build: ([h, l, m, e]) => (P) => {
    const R = P.R, L = l[2], H = h[2], T = 0.25, n = Math.max(1, Math.round(L / 0.5)), sw = L / n, tex = `tex:${m[2]}`;
    for (let i = 0; i < n; i++) {
      const top = e[0] === 'ruine' ? H * (0.35 + R() * 0.65) : H, x = -L / 2 + sw * (i + 0.5);
      P.b(sw, top, T, x, top / 2, 0, tex, 0xffffff);
      if (e[0] !== 'ruine') P.b(sw + 0.002, 0.06, T + 0.06, x, top + 0.03, 0, 'concrete', 0x9a968c);
    }
    if (e[0] === 'ruine') for (let i = 0; i < 6; i++) P.b(rr(R, 0.15, 0.3), rr(R, 0.06, 0.12), rr(R, 0.1, 0.2), rr(R, -L / 2, L / 2), 0.05, rr(R, 0.25, 0.7), tex, 0xffffff, 0, R() * 3, rr(R, -0.3, 0.3));
  },
});
mdFam({
  key: 'pil', famName: 'Piliers et poteaux', cat: 'structure', g: 'm',
  axes: [[['betcarre', 'Pilier en béton carré', 'm'], ['betrond', 'Pilier en béton rond', 'm'], ['brique', 'Pilier de briques', 'm'], ['bois', 'Poteau de bois', 'm'], ['ipn', 'Poteau métallique', 'm'], ['fonte', 'Colonne en fonte', 'f']], [['2', 'de 2,5 m', 2.5], ['4', 'de 4 m', 4]]],
  nm: ([t, h]) => `${t[1]} ${h[1]}`, gp: ([t]) => [t[2], false], states: ['n', 'c', 'm'], mat: ([t]) => (t[0] === 'bois' ? 'bois' : t[0] === 'ipn' || t[0] === 'fonte' ? 'metal' : 'pierre'),
  build: ([t, h]) => (P) => {
    const H = h[2];
    switch (t[0]) {
      case 'betcarre': P.b(0.4, H, 0.4, 0, H / 2, 0, 'tex:gx_bt_coffre_gris', 0xffffff); break;
      case 'betrond': P.c(0.22, H, 0, H / 2, 0, 'concrete', 0xa8a49a, 0, 0, 0, 16); break;
      case 'brique': P.b(0.5, H, 0.5, 0, H / 2, 0, 'tex:gx_br_std_rouge', 0xffffff); P.b(0.58, 0.08, 0.58, 0, H + 0.04, 0, 'concrete', 0x9a968c); break;
      case 'bois': P.b(0.2, H, 0.2, 0, H / 2, 0, 'wood', 0x7a5a3a); for (const s of [-1, 1]) boxBetween(P, 'wood', 0x7a5a3a, [0, H - 0.6, 0], [s * 0.6, H, 0], 0.1); break;
      case 'ipn': P.b(0.2, H, 0.012, 0, H / 2, 0, 'metal', 0x5a6a7a); for (const z of [-0.1, 0.1]) P.b(0.2, H, 0.012, 0, H / 2, z, 'metal', 0x5a6a7a); P.b(0.3, 0.02, 0.3, 0, 0.01, 0, 'metal', 0x4a5a6a); break;
      default: P.c(0.1, H, 0, H / 2, 0, 'metal', 0x2a3a3a, 0, 0, 0, 12); P.c(0.18, 0.3, 0, 0.15, 0, 'metal', 0x2a3a3a, 0, 0, 0, 12); P.t(0.22, 0.1, 0.3, 0, H - 0.15, 0, 'metal', 0x2a3a3a, 0, 0, 0, 12);
    }
  },
});
const MD_FENCES = [['piquets', 'Clôture à piquets', 'f'], ['palissade', 'Palissade en planches', 'f'], ['grillage', 'Clôture grillagée', 'f'], ['ferforge', 'Grille en fer forgé', 'f'], ['plaques', 'Clôture en plaques de béton', 'f'], ['barbelee', 'Clôture barbelée', 'f'], ['ganivelle', 'Ganivelle', 'f'], ['tole', 'Palissade de tôle', 'f']];
mdFam({
  key: 'clot', famName: 'Clôtures', cat: 'structure', g: 'f', axes: [MD_FENCES, [['2', 'de 2 m', 2], ['4', 'de 4 m', 4]]],
  nm: ([t, l]) => `${t[1]} ${l[1]}`, states: ['n', 'u', 'c', 's'], mat: ([t]) => (['piquets', 'palissade', 'ganivelle'].includes(t[0]) ? 'bois' : t[0] === 'plaques' ? 'pierre' : 'metal'),
  build: ([t, l]) => (P) => {
    const L = l[2], R = P.R;
    switch (t[0]) {
      case 'piquets': for (let i = 0; i <= L * 6; i++) { const x = -L / 2 + i / 6; P.b(0.08, 1.0, 0.025, x, 0.5, 0, 'wood', 0xe0dcd0); P._add('cyl:1:3', mtx(x, 1.03, 0, Math.PI / 2, 0, 0, 0.047, 0.025, 0.06), 'wood', 0xe0dcd0); } for (const y of [0.25, 0.75]) P.b(L, 0.07, 0.025, 0, y, -0.025, 'wood', 0xd0ccc0); break;
      case 'palissade': for (let i = 0; i < L * 6; i++) P.b(0.15, 1.8 + R() * 0.15, 0.025, -L / 2 + (i + 0.5) / 6, 0.9, 0, 'wood', pk(R, [0x8a6a48, 0x7a5a3a, 0x9a7a58])); for (const y of [0.3, 1.5]) P.b(L, 0.1, 0.04, 0, y, -0.03, 'wood', 0x6a4a2e); break;
      case 'grillage': for (let i = 0; i <= L / 2; i++) P.c(0.03, 2.0, -L / 2 + i * 2, 1.0, 0, 'metal', 0x6a6e6e, 0, 0, 0, 8); P.b(L, 1.9, 0.01, 0, 1.0, 0, 'tex:gx_gl_noir', 0xffffff); P.b(L, 0.03, 0.03, 0, 2.0, 0, 'metal', 0x6a6e6e); break;
      case 'ferforge': for (let i = 0; i <= L * 8; i++) { const x = -L / 2 + i / 8; P.c(0.012, 1.8, x, 0.9, 0, 'metal', 0x1e1e20, 0, 0, 0, 6); P.t(0.002, 0.03, 0.1, x, 1.85, 0, 'metal', 0x1e1e20, 0, 0, 0, 4); } for (const y of [0.2, 1.6]) P.b(L, 0.04, 0.03, 0, y, 0, 'metal', 0x1e1e20); for (const x of [-L / 2, L / 2]) P.b(0.4, 2.0, 0.4, x, 1.0, 0, 'stone', 0x9a948a); break;
      case 'plaques': for (let i = 0; i <= L / 2; i++) P.b(0.15, 2.0, 0.15, -L / 2 + i * 2, 1.0, 0, 'concrete', 0xa8a49a); for (let k = 0; k < 4; k++) P.b(L, 0.48, 0.05, 0, 0.25 + k * 0.5, 0, 'concrete', 0xb4b0a6); break;
      case 'barbelee': for (let i = 0; i <= L / 2; i++) P.b(0.08, 1.6, 0.08, -L / 2 + i * 2, 0.8, 0, 'wood', 0x5a4a38); for (const y of [0.4, 0.8, 1.2, 1.55]) P.c(0.005, L, 0, y, 0, 'metal', 0x7a7a78, 0, 0, Math.PI / 2, 4); break;
      case 'ganivelle': for (let i = 0; i < L * 10; i++) P.b(0.04, 1.2 + R() * 0.1, 0.02, -L / 2 + (i + 0.5) / 10, 0.6, 0, 'wood', 0xa8946e, 0, 0, (R() - 0.5) * 0.06); for (const y of [0.25, 0.95]) P.c(0.005, L, 0, y, 0.015, 'metal', 0x6a6a68, 0, 0, Math.PI / 2, 4); break;
      default: for (let i = 0; i < L; i++) P.b(1.0, 2.0, 0.02, -L / 2 + i + 0.5, 1.0, 0, 'tex:gx_to_galva_u', 0xffffff, 0, 0, (R() - 0.5) * 0.03); for (const y of [0.4, 1.6]) P.b(L, 0.08, 0.06, 0, y, -0.05, 'wood', 0x6a4a2e);
    }
  },
});
mdFam({
  key: 'porte', famName: 'Portes de décor', cat: 'structure', g: 'f',
  axes: [[['bois', 'Porte en bois', 'f'], ['blindee', 'Porte blindée', 'f'], ['garage', 'Porte de garage', 'f'], ['grille', 'Grille en fer forgé', 'f'], ['grange', 'Porte de grange', 'f'], ['vitree', 'Porte vitrée', 'f'], ['cellule', 'Porte de cellule', 'f'], ['barricadee', 'Porte barricadée', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'u', 'c'], mat: ([t]) => (['bois', 'grange', 'barricadee'].includes(t[0]) ? 'bois' : 'metal'),
  build: ([t]) => (P) => {
    const R = P.R, frame = (w, h, c, f = 'wood') => { for (const s of [-1, 1]) P.b(0.1, h + 0.1, 0.2, s * (w / 2 + 0.05), (h + 0.1) / 2, 0, f, c); P.b(w + 0.2, 0.1, 0.2, 0, h + 0.05, 0, f, c); };
    switch (t[0]) {
      case 'bois': frame(0.9, 2.1, 0x5a3e28); P.b(0.88, 2.08, 0.05, 0, 1.04, 0.02, 'wood', 0x6e4a30); for (const y of [0.55, 1.5]) P.b(0.7, 0.7, 0.012, 0, y, 0.05, 'wood', 0x60402a); P.s(0.03, 0.36, 1.05, 0.07, 'metal', 0xb09040); break;
      case 'blindee': frame(1.0, 2.1, 0x3a3e3c, 'metal'); P.b(0.98, 2.08, 0.08, 0, 1.04, 0.02, 'tex:gx_obj_blindee', 0xffffff); break;
      case 'garage': frame(2.6, 2.3, 0x8a8a86, 'metal'); for (let i = 0; i < 9; i++) P.b(2.58, 0.25, 0.04, 0, 0.13 + i * 0.255, 0.02, 'metal', 0xb0b0aa); break;
      case 'grille': frame(1.4, 2.4, 0x9a948a, 'stone'); for (let i = 0; i < 10; i++) { P.c(0.015, 2.3, -0.65 + i * 0.145, 1.15, 0, 'metal', 0x1e1e20, 0, 0, 0, 6); P.t(0.002, 0.04, 0.12, -0.65 + i * 0.145, 2.36, 0, 'metal', 0x1e1e20, 0, 0, 0, 4); } for (const y of [0.3, 1.2, 2.1]) P.b(1.4, 0.04, 0.03, 0, y, 0, 'metal', 0x1e1e20); break;
      case 'grange': frame(2.4, 2.6, 0x5a3a24); for (const s of [-1, 1]) { P.b(1.18, 2.58, 0.06, s * 0.6, 1.29, 0.03, 'tex:gx_ba_chene_u', 0xffffff); boxBetween(P, 'wood', 0x5a3a24, [s * 0.1, 0.2, 0.08], [s * 1.1, 2.4, 0.08], 0.12, 0.04); P.b(1.1, 0.12, 0.04, s * 0.6, 0.2, 0.08, 'wood', 0x5a3a24); P.b(1.1, 0.12, 0.04, s * 0.6, 2.4, 0.08, 'wood', 0x5a3a24); } break;
      case 'vitree': frame(0.9, 2.1, 0x8a8c8e, 'metal'); P.b(0.88, 2.08, 0.04, 0, 1.04, 0.02, 'glass', 0xa8c0c8); P.b(0.04, 0.6, 0.06, 0.36, 1.05, 0.05, 'metal', 0xb0b2b4); break;
      case 'cellule': frame(1.0, 2.1, 0x4a4e4c, 'metal'); for (let i = 0; i < 8; i++) P.c(0.018, 2.0, -0.42 + i * 0.12, 1.05, 0.02, 'metal', 0x3a3e3c, 0, 0, 0, 8); for (const y of [0.4, 1.05, 1.7]) P.b(0.98, 0.06, 0.04, 0, y, 0.02, 'metal', 0x3a3e3c); P.b(0.12, 0.16, 0.06, 0.38, 1.05, 0.05, 'metal', 0x2a2a2a); break;
      default: frame(0.9, 2.1, 0x5a3e28); P.b(0.88, 2.08, 0.05, 0, 1.04, 0.02, 'wood', 0x6e4a30); for (let i = 0; i < 5; i++) P.b(1.1, 0.16, 0.04, 0, 0.3 + i * 0.4 + rr(R, -0.05, 0.05), 0.08, 'wood', pk(R, [0x8a6a48, 0x9a7a58, 0x7a5a3a]), 0, 0, rr(R, -0.25, 0.25));
    }
  },
});
mdFam({
  key: 'fen', famName: 'Fenêtres de décor', cat: 'structure', g: 'f', o: { wall: true, solid: false },
  axes: [[['croisillons', 'Fenêtre à croisillons', 'f'], ['barricadee', 'Fenêtre barricadée', 'f'], ['atelier', 'Fenêtre d’atelier', 'f'], ['hublot', 'Hublot', 'm'], ['volets', 'Fenêtre à volets', 'f'], ['barreaux', 'Fenêtre à barreaux', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'c', 'e'], mat: () => 'verre',
  build: ([t]) => (P) => {
    const R = P.R, y = 1.5, glass = () => P.b(1.0, 1.2, 0.012, 0, y, 0.01, 'glow', 0x8aa8c0);
    if (t[0] === 'hublot') { P.o(0.35, 0.06, 0, y, 0.03, 'metal', 0xb09040, 0, 0, 0); P.c(0.33, 0.02, 0, y, 0.02, 'glow', 0x8aa8c0, Math.PI / 2, 0, 0, 20); return; }
    glass();
    for (const s of [-1, 1]) { P.b(0.08, 1.36, 0.08, s * 0.54, y, 0.03, 'wood', 0xd8d4c8); P.b(1.16, 0.08, 0.08, 0, y + s * 0.64, 0.03, 'wood', 0xd8d4c8); }
    if (t[0] === 'croisillons' || t[0] === 'volets') { P.b(0.04, 1.2, 0.03, 0, y, 0.025, 'wood', 0xd8d4c8); for (const dy of [-0.3, 0.1, 0.4]) P.b(1.0, 0.03, 0.03, 0, y + dy, 0.025, 'wood', 0xd8d4c8); }
    if (t[0] === 'volets') for (const s of [-1, 1]) { P.b(0.56, 1.3, 0.04, s * 0.85, y, 0.06, 'wood', 0x3a6a4a); for (let i = 0; i < 12; i++) P.b(0.5, 0.02, 0.02, s * 0.85, y - 0.6 + i * 0.1, 0.085, 'wood', 0x2e5a3c); }
    if (t[0] === 'atelier') { for (let i = 1; i < 4; i++) P.b(0.03, 1.2, 0.03, -0.5 + i * 0.25, y, 0.025, 'metal', 0x3a3e3c); for (let i = 1; i < 4; i++) P.b(1.0, 0.03, 0.03, 0, y - 0.6 + i * 0.3, 0.025, 'metal', 0x3a3e3c); }
    if (t[0] === 'barricadee') for (let i = 0; i < 4; i++) P.b(1.3, 0.16, 0.04, 0, y - 0.45 + i * 0.3, 0.09, 'wood', pk(R, [0x8a6a48, 0x9a7a58, 0x7a5a3a]), 0, 0, rr(R, -0.2, 0.2));
    if (t[0] === 'barreaux') for (let i = 0; i < 7; i++) P.c(0.015, 1.3, -0.42 + i * 0.14, y, 0.08, 'metal', 0x2a2a2a, 0, 0, 0, 6);
  },
});
mdFam({
  key: 'arch', famName: 'Arches et portails', cat: 'structure', g: 'f',
  axes: [[['pierre', 'Arche de pierre', 'f'], ['portique', 'Portique métallique', 'm'], ['portail', 'Portail d’entrée', 'm'], ['torii', 'Portique de bois', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'm', 'c'], mat: ([t]) => (t[0] === 'portique' ? 'metal' : t[0] === 'torii' ? 'bois' : 'pierre'),
  build: ([t]) => (P) => {
    if (t[0] === 'pierre') { for (const s of [-1, 1]) P.b(0.6, 3.0, 0.7, s * 1.3, 1.5, 0, 'tex:gx_pt_taille_calcaire', 0xffffff); for (let i = 0; i <= 8; i++) { const a = Math.PI - (i / 8) * Math.PI; P.b(0.35, 0.5, 0.7, Math.cos(a) * 1.3, 3.0 + Math.sin(a) * 1.0, 0, 'tex:gx_pt_taille_calcaire', 0xffffff, 0, 0, a - Math.PI / 2); } return; }
    if (t[0] === 'portique') { for (const s of [-1, 1]) P.b(0.25, 4.5, 0.25, s * 2.5, 2.25, 0, 'metal', 0xc8a030); P.b(5.3, 0.4, 0.25, 0, 4.6, 0, 'metal', 0xc8a030); P.b(3, 0.5, 0.02, 0, 4.0, 0.14, 'paint', 0xe8e4d8); return; }
    if (t[0] === 'torii') { for (const s of [-1, 1]) P.c(0.18, 4, s * 1.8, 2, 0, 'wood', 0xb03020, 0, 0, 0, 12); P.b(5, 0.3, 0.4, 0, 4.1, 0, 'wood', 0x2a2a2a, 0, 0, 0); P.b(4.2, 0.2, 0.25, 0, 3.4, 0, 'wood', 0xb03020); return; }
    for (const s of [-1, 1]) { P.b(0.6, 2.6, 0.6, s * 2.2, 1.3, 0, 'tex:gx_br_std_rouge', 0xffffff); P.b(0.7, 0.12, 0.7, s * 2.2, 2.66, 0, 'stone', 0x9a948a); P.s(0.2, s * 2.2, 2.9, 0, 'stone', 0x9a948a, 1, 1, 1, 12); }
    for (let i = 0; i < 26; i++) { const x = -1.85 + i * 0.148, h = 2.0 + Math.sin((i / 25) * Math.PI) * 0.4; P.c(0.014, h, x, h / 2, 0, 'metal', 0x1e1e20, 0, 0, 0, 6); } for (const y of [0.3, 1.8]) P.b(3.8, 0.04, 0.03, 0, y, 0, 'metal', 0x1e1e20);
  },
});

/* =============================================================== véhicules */
const MD_CARS = [['berline', 'Berline', 'f'], ['break', 'Break', 'm'], ['coupe', 'Coupé', 'm'], ['citadine', 'Citadine', 'f'], ['pickup', 'Pick-up', 'm'], ['fourgon', 'Fourgon', 'm'], ['jeep', 'Jeep', 'f']];
const MD_CARCOL = [['rouge', 'rouge', 0x8a2620], ['bleu', 'bleu', 0x2a4a7a], ['blanc', 'blanc', 0xd8d8d2], ['noir', 'noir', 0x1e1e20], ['gris', 'gris', 0x7a7e80], ['vert', 'vert', 0x3a5a3a], ['jaune', 'jaune', 0xc8a030], ['beige', 'beige', 0xc8b48a]];
mdFam({
  key: 'voit', famName: 'Voitures abandonnées', cat: 'vehicule', g: 'f', axes: [MD_CARS, MD_CARCOL],
  nm: ([t, c]) => `${t[1]} ${gxAcc(c[1], t[2] === 'f', false)}`, gp: ([t]) => [t[2], false], states: ['n', 'r', 'b', 'x', 's', 'g'], mat: () => 'metal',
  build: ([t, c]) => (P) => mdCar(P, t[0], c[2]),
});
mdFam({
  key: 'cam', famName: 'Camions et cars', cat: 'vehicule', g: 'm',
  axes: [[['benne', 'Camion-benne', 'm', 0xc8a030], ['citerne', 'Camion-citerne', 'm', 0xd8d8d2], ['bache', 'Camion militaire bâché', 'm', 0x4c5a3c], ['bus', 'Car scolaire', 'm', 0xd8a020], ['autobus', 'Autobus', 'm', 0x2a6a4a], ['ambulance', 'Ambulance', 'f', 0xe8e8e2], ['pompiers', 'Camion de pompiers', 'm', 0xb82018]]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'r', 'b', 's'], mat: () => 'metal',
  build: ([t]) => (P) => {
    const col = t[3], bus = t[0] === 'bus' || t[0] === 'autobus', L = bus ? 10 : 7, W = 2.4, wr = 0.5;
    for (const sx of [-1, 1]) for (const z of bus ? [L * 0.33, -L * 0.3] : [L * 0.33, -L * 0.15, -L * 0.33]) { P.c(wr, 0.35, sx * (W / 2 - 0.2), wr, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 14); P.c(wr * 0.5, 0.36, sx * (W / 2 - 0.2), wr, z, 'metal', 0x8a8c8e, 0, 0, Math.PI / 2, 10); }
    if (bus) {
      P.b(W, 2.4, L, 0, 1.75, 0, 'metal', col); P.b(W + 0.01, 0.9, L - 1.2, 0, 2.2, -0.3, 'glass', 0x3a4a54); P.b(W - 0.2, 1.2, 0.02, 0, 2.1, L / 2 + 0.005, 'glass', 0x3a4a54);
      P.b(W + 0.02, 0.12, L, 0, 1.6, 0, 'paint', t[0] === 'bus' ? 0x1a1a1a : 0xe8e8e2); P.b(W, 0.4, 0.15, 0, 0.75, L / 2 + 0.05, 'metal', 0x6a6c6e);
      return;
    }
    P.b(W, 0.4, L, 0, 0.9, 0, 'metal', 0x2a2a2a);
    P.b(W, 1.9, 2.0, 0, 1.95, L / 2 - 1.0, 'metal', col); P.b(W - 0.2, 0.8, 0.02, 0, 2.3, L / 2 + 0.005, 'glass', 0x3a4a54, -0.1, 0, 0); for (const sx of [-1, 1]) P.b(0.02, 0.6, 1.2, sx * (W / 2 + 0.005), 2.3, L / 2 - 0.9, 'glass', 0x3a4a54);
    P.b(W - 0.1, 0.6, 0.2, 0, 1.3, L / 2 + 0.05, 'metal', 0x6a6c6e);
    const bl = L - 2.2, bz = -1.1;
    switch (t[0]) {
      case 'benne': P.b(W, 1.2, bl, 0, 1.75, bz, 'metal', mdShade(col, 0.9), 0.05, 0, 0); break;
      case 'citerne': P.c(1.05, bl, 0, 2.15, bz, 'metal', col, Math.PI / 2, 0, 0, 18); for (const z of [bz - bl / 2, bz + bl / 2]) P.s(1.05, 0, 2.15, z, 'metal', col, 1, 1, 0.25, 16); P.b(0.5, 0.15, 0.5, 0, 3.25, bz, 'metal', 0x6a6c6e); break;
      case 'bache': P.b(W, 0.5, bl, 0, 1.35, bz, 'wood', 0x5a5038); P.c(W / 2, bl, 0, 2.3, bz, 'fabric', 0x5a6040, Math.PI / 2, 0, 0, 12); P.b(W, 0.9, bl, 0, 1.95, bz, 'fabric', 0x5a6040); break;
      case 'ambulance': P.b(W, 2.2, bl, 0, 2.2, bz, 'metal', col); for (const s of [-1, 1]) { P.b(0.01, 0.25, bl, s * (W / 2 + 0.006), 1.8, bz, 'paint', 0xc02020); P.b(0.01, 0.5, 0.15, s * (W / 2 + 0.008), 2.5, bz, 'paint', 0xc02020); P.b(0.01, 0.15, 0.5, s * (W / 2 + 0.008), 2.5, bz, 'paint', 0xc02020); } P.b(0.6, 0.12, 0.25, 0, 3.0, L / 2 - 1.2, 'glow', 0x3060ff); break;
      default: P.b(W, 1.6, bl, 0, 1.9, bz, 'metal', col); for (let i = 0; i < 4; i++) P.b(0.6, 0.6, 0.02, (i % 2 - 0.5) * 1.0, 2.0, bz + bl / 2 + 0.01 - (i >> 1) * 0.01, 'metal', 0x8a8c8e); for (const x of [-0.5, 0.5]) P.b(0.06, 0.08, bl + 1.5, x, 2.85, bz + 0.7, 'metal', 0xb0b2b4); for (let i = 0; i < 12; i++) P.b(1.06, 0.04, 0.04, 0, 2.85, bz - bl / 2 + i * 0.6, 'metal', 0xb0b2b4); P.b(0.8, 0.12, 0.25, 0, 3.0, L / 2 - 1.2, 'glow', 0x3060ff);
    }
  },
});
mdFam({
  key: 'deux', famName: 'Deux-roues', cat: 'vehicule', g: 'm', o: { solid: false },
  axes: [[['velo', 'Vélo', 'm'], ['moto', 'Moto', 'f'], ['scooter', 'Scooter', 'm'], ['sidecar', 'Moto à side-car', 'f']], mdC('rouge', 'noir', 'bleu')],
  nm: ([t, c]) => `${t[1]} ${gxAcc(c[1], t[2] === 'f', false)}`, gp: ([t]) => [t[2], false], states: ['n', 'x', 'r'], mat: () => 'metal',
  build: ([t, c]) => (P) => {
    const col = c[2];
    if (t[0] === 'velo') { for (const z of [-0.5, 0.5]) P.o(0.33, 0.02, 0, 0.35, z, 'rubber', 0x1a1a1a, 0, Math.PI / 2, 0); boxBetween(P, 'metal', col, [0, 0.35, -0.5], [0, 0.85, -0.05], 0.03); boxBetween(P, 'metal', col, [0, 0.35, -0.5], [0, 0.38, 0.15], 0.03); boxBetween(P, 'metal', col, [0, 0.38, 0.15], [0, 0.85, -0.05], 0.03); boxBetween(P, 'metal', col, [0, 0.85, 0.3], [0, 0.35, 0.5], 0.03); P.b(0.1, 0.04, 0.2, 0, 0.9, -0.08, 'plastic', 0x1a1a1a); P.c(0.012, 0.5, 0, 0.98, 0.3, 'metal', 0x9a9c9e, 0, 0, Math.PI / 2, 6); return; }
    const wr = t[0] === 'scooter' ? 0.22 : 0.32;
    for (const z of [-0.65, 0.65]) { P.c(wr, 0.12, 0, wr, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 14); P.c(wr * 0.5, 0.13, 0, wr, z, 'metal', 0x8a8c8e, 0, 0, Math.PI / 2, 10); }
    if (t[0] === 'scooter') { P.b(0.35, 0.3, 1.1, 0, 0.45, -0.1, 'plastic', col); P.b(0.3, 0.8, 0.2, 0, 0.75, 0.5, 'plastic', col, 0.2, 0, 0); P.b(0.3, 0.1, 0.5, 0, 0.66, -0.3, 'plastic', 0x1a1a1a); P.c(0.015, 0.6, 0, 1.15, 0.58, 'metal', 0x9a9c9e, 0, 0, Math.PI / 2, 6); return; }
    P.b(0.25, 0.3, 0.9, 0, 0.55, 0, 'metal', 0x3a3a3a); P.b(0.3, 0.25, 0.45, 0, 0.82, 0.15, 'metal', col); P.b(0.28, 0.1, 0.55, 0, 0.84, -0.3, 'plastic', 0x1a1a1a); boxBetween(P, 'metal', 0x9a9c9e, [0, 0.33, 0.65], [0, 1.05, 0.45], 0.04); P.c(0.015, 0.7, 0, 1.08, 0.45, 'metal', 0x9a9c9e, 0, 0, Math.PI / 2, 6); P.c(0.08, 0.06, 0, 0.88, 0.55, 'glass', 0xe8e8d8, Math.PI / 2, 0, 0, 10);
    if (t[0] === 'sidecar') { P.s(0.4, 0.75, 0.55, -0.05, 'metal', col, 0.9, 0.6, 1.7, 12); P.c(0.25, 0.1, 0.85, 0.25, 0, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 12); boxBetween(P, 'metal', 0x3a3a3a, [0.1, 0.4, 0], [0.75, 0.35, 0], 0.04); }
  },
});
mdFam({
  key: 'eng', famName: 'Engins et chariots', cat: 'vehicule', g: 'm',
  axes: [[['elevateur', 'Chariot élévateur', 'm'], ['tracteur', 'Tracteur agricole', 'm'], ['rouleau', 'Rouleau compresseur', 'm'], ['golf', 'Voiturette de golf', 'f'], ['wagonnet', 'Wagonnet de mine', 'm'], ['caddie', 'Chariot de supermarché', 'm'], ['brouette', 'Brouette', 'f'], ['remorque', 'Remorque agricole', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'r', 'x', 'b'], mat: () => 'metal', opts: ([t]) => ({ solid: !['caddie', 'brouette'].includes(t[0]) }),
  build: ([t]) => (P) => {
    const wheel = (x, y, z, r, w = 0.2) => { P.c(r, w, x, y, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 14); P.c(r * 0.55, w + 0.01, x, y, z, 'metal', 0x8a8c8e, 0, 0, Math.PI / 2, 10); };
    switch (t[0]) {
      case 'elevateur': for (const s of [-1, 1]) { wheel(s * 0.5, 0.25, 0.5, 0.25); wheel(s * 0.5, 0.22, -0.6, 0.22); } P.b(1.1, 0.6, 1.6, 0, 0.6, -0.1, 'metal', 0xd8a020); P.b(1.0, 0.5, 0.5, 0, 0.7, -0.7, 'metal', 0x3a3a3a); for (const s of [-1, 1]) P.b(0.06, 2.2, 0.1, s * 0.4, 1.1, 0.75, 'metal', 0x3a3a3a); for (const s of [-1, 1]) P.b(0.12, 0.05, 1.0, s * 0.25, 0.1, 1.3, 'metal', 0x3a3a3a); for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.35]) P.b(0.04, 1.2, 0.04, x, 1.5, z, 'metal', 0x3a3a3a); P.b(1.0, 0.04, 0.9, 0, 2.1, -0.05, 'metal', 0x3a3a3a); P.b(0.5, 0.1, 0.5, 0, 0.95, -0.1, 'plastic', 0x1a1a1a); break;
      case 'tracteur': for (const s of [-1, 1]) { wheel(s * 0.8, 0.65, -0.7, 0.65, 0.4); wheel(s * 0.7, 0.38, 1.0, 0.38, 0.25); } P.b(0.9, 0.8, 2.2, 0, 1.0, 0.3, 'metal', 0x3a7a3a); P.b(1.2, 1.4, 1.0, 0, 1.9, -0.6, 'metal', 0x3a7a3a); P.b(1.1, 0.9, 0.9, 0, 2.05, -0.6, 'glass', 0x4a5a64); P.c(0.06, 1.0, 0.3, 1.9, 1.0, 'metal', 0x2a2a2a); break;
      case 'rouleau': P.c(0.6, 1.6, 0, 0.6, 1.2, 'metal', 0x8a8c8e, 0, 0, Math.PI / 2, 18); P.c(0.5, 1.4, 0, 0.5, -1.0, 'metal', 0x8a8c8e, 0, 0, Math.PI / 2, 18); P.b(1.4, 0.8, 2.0, 0, 1.3, 0, 'metal', 0xd8a020); P.b(1.2, 1.2, 0.9, 0, 2.2, -0.3, 'metal', 0xd8a020); P.b(1.1, 0.7, 0.8, 0, 2.3, -0.3, 'glass', 0x4a5a64); break;
      case 'golf': for (const s of [-1, 1]) for (const z of [-0.8, 0.8]) wheel(s * 0.55, 0.2, z, 0.2, 0.15); P.b(1.2, 0.4, 2.2, 0, 0.5, 0, 'metal', 0xe8e8e2); P.b(1.0, 0.1, 0.7, 0, 0.8, -0.2, 'plastic', 0x3a3a3a); P.b(1.0, 0.5, 0.1, 0, 1.05, -0.55, 'plastic', 0x3a3a3a); for (const x of [-0.55, 0.55]) for (const z of [-0.6, 0.6]) P.c(0.02, 1.2, x, 1.3, z, 'metal', 0xb0b2b4); P.b(1.3, 0.05, 1.6, 0, 1.9, 0, 'plastic', 0xe8e8e2); break;
      case 'wagonnet': for (const s of [-1, 1]) for (const z of [-0.35, 0.35]) P.c(0.15, 0.06, s * 0.35, 0.15, z, 'metal', 0x3a3a3a, 0, 0, Math.PI / 2, 12); P.t(0.55, 0.42, 0.6, 0, 0.6, 0, 'rust', 0xffffff, 0, Math.PI / 4, 0, 4); P.b(0.7, 0.4, 0.7, 0, 0.75, 0, 'stone', 0x5a5650); break;
      case 'caddie': for (const x of [-0.25, 0.25]) for (const z of [-0.35, 0.35]) P.c(0.05, 0.03, x, 0.05, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 10); P.b(0.55, 0.5, 0.85, 0, 0.75, 0, 'tex:gx_gl_noir', 0xffffff); boxBetween(P, 'metal', 0xb0b2b4, [0, 1.0, -0.42], [0, 1.1, -0.6], 0.03); P.c(0.015, 0.5, 0, 1.12, -0.6, 'plastic', 0xc02020, 0, 0, Math.PI / 2, 8); for (const x of [-0.25, 0.25]) boxBetween(P, 'metal', 0xb0b2b4, [x, 0.08, 0.35], [x, 0.5, 0.42], 0.025); break;
      case 'brouette': P.c(0.18, 0.08, 0, 0.18, 0.55, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 12); P.t(0.35, 0.22, 0.3, 0, 0.5, 0.1, 'metal', 0x3a6a3a, 0, Math.PI / 4, 0, 4); for (const s of [-1, 1]) { boxBetween(P, 'wood', 0x7a5a3a, [s * 0.15, 0.2, 0.55], [s * 0.28, 0.55, -0.8], 0.04); P.b(0.04, 0.4, 0.04, s * 0.2, 0.2, -0.3, 'metal', 0x2a2a2a); } break;
      default: for (const s of [-1, 1]) wheel(s * 1.0, 0.4, -0.3, 0.4, 0.25); P.b(2.0, 0.1, 3.5, 0, 0.9, 0, 'wood', 0x8a6a48); for (const s of [-1, 1]) P.b(0.06, 0.5, 3.5, s * 1.0, 1.2, 0, 'wood', 0x7a5a3a); P.b(2.0, 0.5, 0.06, 0, 1.2, -1.75, 'wood', 0x7a5a3a); boxBetween(P, 'metal', 0x3a3a3a, [0, 0.8, 1.75], [0, 0.5, 2.6], 0.08);
    }
  },
});
mdFam({
  key: 'epave', famName: 'Épaves', cat: 'vehicule', g: 'f',
  axes: [[['cales', 'Carcasse sur cales', 'f'], ['empilees', 'Voitures empilées', 'f'], ['barque', 'Barque échouée', 'f'], ['canot', 'Canot à moteur', 'm'], ['avion', 'Carlingue d’avion', 'f'], ['wagon', 'Wagon de marchandises', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'empilees'], states: ['n', 'r', 'b', 'm'], mat: ([t]) => (t[0] === 'barque' ? 'bois' : 'metal'),
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'cales': mdCar(P, 'berline', 0x6a5a4a, { noWheels: true }); for (const z of [-1.3, 1.3]) for (const x of [-0.7, 0.7]) P.b(0.3, 0.3, 0.3, x, 0.15, z, 'concrete', 0x8a8680); mdXf(P.list, new THREE.Matrix4().makeTranslation(0, 0.05, 0)); break;
      case 'empilees': mdCar(P, 'berline', 0x6a2a24); partsUnder(P, mtx(0.2, 1.42, 0.1, 0.04, 0.25, 0.03), (Q) => mdCar(Q, 'citadine', 0x2a4a6a)); break;
      case 'barque': P.s(0.7, 0, 0.3, 0, 'wood', 0x7a5a3a, 1, 0.5, 2.8, 14); P.s(0.62, 0, 0.36, 0, 'paint', 0x3a2a1a, 1, 0.45, 2.7, 14); for (const z of [-0.7, 0, 0.7]) P.b(1.2, 0.05, 0.2, 0, 0.5, z, 'wood', 0x8a6a48); P.b(0.06, 0.04, 1.8, 0.4, 0.55, 0.3, 'wood', 0x8a6a48, 0, 0.3, 0); break;
      case 'canot': P.s(0.9, 0, 0.45, 0, 'metal', 0xe8e8e2, 1, 0.5, 3.0, 14); P.b(1.6, 0.4, 1.0, 0, 0.75, 0.6, 'glass', 0x4a5a64); P.b(0.4, 0.6, 0.4, 0, 0.6, -2.4, 'metal', 0x2a2a2a); P.b(1.6, 0.08, 4.0, 0, 0.72, -0.4, 'wood', 0x8a6a48); break;
      case 'avion': P.c(1.3, 8, 0, 1.3, 0, 'metal', 0xb8bab8, Math.PI / 2, 0, 0, 16); P.s(1.3, 0, 1.3, 4, 'metal', 0xb8bab8, 1, 1, 1.4, 14); for (let i = 0; i < 8; i++) for (const s of [-1, 1]) P.c(0.15, 0.02, s * 1.29, 1.8, 3 - i * 0.8, 'glass', 0x2a3a44, 0, 0, Math.PI / 2, 10); P.b(6, 0.2, 2, 3.5, 0.6, -0.5, 'metal', 0xa8aaa8, 0, 0.1, 0.12); break;
      default: for (const z of [-4.5, 4.5]) for (const s of [-1, 1]) P.c(0.45, 0.12, s * 0.75, 0.45, z, 'metal', 0x2a2a2a, 0, 0, Math.PI / 2, 14); P.b(2.8, 2.6, 12, 0, 2.3, 0, 'tex:gx_tr_marine_rr', 0xffffff); P.b(3.0, 0.2, 12.2, 0, 3.7, 0, 'metal', 0x5a3a2a); P.b(0.04, 2.2, 3, 1.42, 2.2, 0, 'paint', 0x1a1a1a);
    }
  },
});
