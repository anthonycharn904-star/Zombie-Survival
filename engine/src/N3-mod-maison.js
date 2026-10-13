/* =====================================================================================================
   Jeu 2.0.4 : modèles de la maison — mobilier, cuisine, salle de bain, décoration, bureau, électronique.
   ===================================================================================================== */
/* Bois et finitions : [clé, libellé(genre, pluriel), couleur, matière]. */
const MD_WOODS = [
  ['chene', () => 'en chêne', 0x8a6a48], ['noyer', () => 'en noyer', 0x5a3f28], ['pin', () => 'en pin', 0xc8a46c], ['acajou', () => 'en acajou', 0x6e3a26],
  ['merisier', () => 'en merisier', 0x8e4e34], ['wenge', () => 'en wengé', 0x3e2c22], ['blanc', (f, pl) => `${gxAcc('peint', f, pl)} en blanc`, 0xd8d4c8],
  ['vert', (f, pl) => `${gxAcc('peint', f, pl)} en vert`, 0x4e6e56], ['bleu', (f, pl) => `${gxAcc('peint', f, pl)} en bleu`, 0x4a6080], ['gris', (f, pl) => `${gxAcc('peint', f, pl)} en gris`, 0x8a8a86],
  ['noir', (f, pl) => `${gxAcc('laqué', f, pl)} noir`, 0x2a2a2c],
];
const mdW = (...keys) => MD_WOODS.filter((w) => keys.includes(w[0]));
/* Tissus d'ameublement. */
const MD_FAB = [['rouge', 'rouge', 0x6a2a2a], ['vert', 'vert', 0x3a5a3a], ['bleu', 'bleu', 0x2a3a5a], ['brun', 'brun', 0x5a3a2e], ['beige', 'beige', 0xc8b898], ['gris', 'gris', 0x7a7a72],
  ['moutarde', 'moutarde', 0xa88a40], ['violet', 'violet', 0x5a3a6a], ['noir', 'noir', 0x2a2826], ['creme', 'crème', 0xd8d0b8]];
const mdF = (...keys) => MD_FAB.filter((w) => keys.includes(w[0]));
/* Couleurs franches (métal peint, plastique, électroménager). */
const MD_COL = [['blanc', 'blanc', 0xdcdcd6], ['creme', 'crème', 0xe0d4b4], ['gris', 'gris', 0x8a8e8e], ['noir', 'noir', 0x2a2c2e], ['rouge', 'rouge', 0x9a2a24], ['bleu', 'bleu', 0x2c4a7a],
  ['vert', 'vert', 0x3e6a42], ['jaune', 'jaune', 0xc8a030], ['orange', 'orange', 0xc86a28], ['kaki', 'kaki', 0x5a6040], ['turquoise', 'turquoise', 0x3a9a96], ['rose', 'rose', 0xd890a0],
  ['inox', 'inox', 0xb8babc], ['marron', 'marron', 0x5a3e2a]];
const mdC = (...keys) => MD_COL.filter((w) => keys.includes(w[0]));
const mdCol = (v, f, pl) => (typeof v[1] === 'function' ? v[1](f, pl) : gxAcc(v[1], f, pl));

/* =================================================================== tables */
mdFam({
  key: 'tab', famName: 'Tables rectangulaires', cat: 'mobilier', g: 'f',
  axes: [[['2p', '2 places', [0.8, 0.8]], ['4p', '4 places', [1.2, 0.8]], ['6p', '6 places', [1.6, 0.9]], ['8p', '8 places', [2.2, 1.0]], ['banquet', 'de banquet', [3.0, 1.1]]],
    [['droit', '', {}], ['tourne', 'à pieds tournés', {}], ['ferme', 'de ferme', {}], ['treteaux', 'sur tréteaux', {}]], mdW('chene', 'noyer', 'pin', 'blanc')],
  nm: ([s, st, w]) => `Table ${s[1]}${st[1] ? ` ${st[1]}` : ''} ${mdCol(w, true, false)}`,
  states: ([s, st]) => (s[0] === 'banquet' || st[0] === 'treteaux' ? ['n', 'u', 'x'] : ['n', 'u', 'c', 'x', 'g']),
  mat: ([, , w]) => (['blanc', 'vert', 'bleu', 'gris', 'noir'].includes(w[0]) ? 'peint' : 'bois'),
  build: ([s, st, w]) => (P) => {
    const [L, D] = s[2], c = w[2], cl = mdShade(c, 0.86), H = 0.76, th = st[0] === 'ferme' ? 0.07 : 0.045;
    P.b(L, th, D, 0, H - th / 2, 0, 'wood', c);
    if (st[0] === 'treteaux') {
      for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) { for (const sz of [-1, 1]) boxBetween(P, 'wood', cl, [x, 0, sz * D * 0.42], [x, H - th - 0.05, sz * 0.06], 0.05); P.b(0.08, 0.07, D * 0.8, x, H - th - 0.035, 0, 'wood', cl); }
      return;
    }
    const kind = st[0] === 'tourne' ? 'tourne' : 'carre', r = st[0] === 'ferme' ? 0.09 : st[0] === 'tourne' ? 0.1 : 0.06;
    mdLegs(P, L, D, H - th, r, 'wood', cl, 0.04, kind);
    for (const z of [-1, 1]) P.b(L - 0.2, 0.09, 0.025, 0, H - th - 0.045, z * (D / 2 - 0.07), 'wood', cl);
    for (const x of [-1, 1]) P.b(0.025, 0.09, D - 0.2, x * (L / 2 - 0.07), H - th - 0.045, 0, 'wood', cl);
    if (st[0] === 'ferme') P.b(L - 0.3, 0.06, 0.06, 0, 0.16, 0, 'wood', cl);
  },
});
mdFam({
  key: 'tabr', famName: 'Tables rondes', cat: 'mobilier', g: 'f',
  axes: [[['60', 'de 60 cm', 0.3], ['90', 'de 90 cm', 0.45], ['120', 'de 120 cm', 0.6], ['150', 'de 150 cm', 0.75]], [['pied', 'à pied central'], ['4p', 'à quatre pieds']], mdW('chene', 'noyer', 'pin', 'blanc', 'noir')],
  nm: ([s, b, w]) => `Table ronde ${s[1]} ${b[1]} ${mdCol(w, true, false)}`, states: ['n', 'u', 'x', 'g'],
  mat: ([, , w]) => (['blanc', 'noir'].includes(w[0]) ? 'peint' : 'bois'),
  build: ([s, b, w]) => (P) => {
    const r = s[2], c = w[2], cl = mdShade(c, 0.85);
    P.c(r, 0.04, 0, 0.74, 0, 'wood', c, 0, 0, 0, 24);
    if (b[0] === 'pied') { P.c(0.06, 0.66, 0, 0.38, 0, 'wood', cl, 0, 0, 0, 12); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; boxBetween(P, 'wood', cl, [0, 0.12, 0], [Math.cos(a) * r * 0.75, 0.02, Math.sin(a) * r * 0.75], 0.05, 0.04); } }
    else { for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; P.b(0.05, 0.72, 0.05, Math.cos(a) * r * 0.62, 0.36, Math.sin(a) * r * 0.62, 'wood', cl); } P.c(r * 0.62, 0.06, 0, 0.66, 0, 'wood', cl, 0, 0, 0, 16); }
  },
});
mdFam({
  key: 'tabb', famName: 'Tables basses', cat: 'mobilier', g: 'f',
  axes: [[['rect', 'rectangulaire'], ['ronde', 'ronde'], ['coffre', 'coffre'], ['verre', 'à plateau de verre']], mdW('chene', 'noyer', 'pin', 'blanc', 'noir')],
  nm: ([t, w]) => `Table basse ${t[1]} ${mdCol(w, true, false)}`, states: ['n', 'u', 'x'], mat: () => 'bois',
  build: ([t, w]) => (P) => {
    const c = w[2], cl = mdShade(c, 0.85);
    if (t[0] === 'ronde') { P.c(0.45, 0.04, 0, 0.42, 0, 'wood', c, 0, 0, 0, 22); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; P.b(0.05, 0.4, 0.05, Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3, 'wood', cl); } return; }
    if (t[0] === 'coffre') { P.b(1.0, 0.4, 0.55, 0, 0.2, 0, 'wood', c); P.b(1.04, 0.04, 0.59, 0, 0.42, 0, 'wood', cl); for (const x of [-0.4, 0.4]) P.b(0.04, 0.4, 0.57, x, 0.2, 0, 'metal', 0x3a3a3a); return; }
    if (t[0] === 'verre') { P.b(1.1, 0.02, 0.6, 0, 0.44, 0, 'glass', 0x9ab4bc); mdLegs(P, 1.1, 0.6, 0.43, 0.04, 'wood', c, 0.03); P.b(1.0, 0.03, 0.5, 0, 0.12, 0, 'wood', c); return; }
    P.b(1.1, 0.05, 0.6, 0, 0.42, 0, 'wood', c); mdLegs(P, 1.1, 0.6, 0.4, 0.05, 'wood', cl, 0.03); P.b(1.0, 0.03, 0.5, 0, 0.12, 0, 'wood', cl);
  },
});

/* =================================================================== sièges */
const MD_CHAIRS = [
  ['bistrot', 'bistrot', mdW('chene', 'noyer', 'noir', 'blanc', 'acajou')], ['paille', 'paillée', mdW('chene', 'noyer', 'pin', 'vert', 'bleu')],
  ['salon', 'de salon', MD_FAB.slice(0, 5).map((f) => [f[0], () => `en tissu ${f[1]}`, 0x5a3f28, f[2]])], ['ecole', 'd’écolier', mdC('rouge', 'bleu', 'vert', 'gris', 'jaune').map((c) => [c[0], (f, pl) => `${gxAcc('peint', f, pl)} en ${c[1]}`, c[2]])],
  ['cuisine', 'de cuisine en skaï', mdC('rouge', 'bleu', 'jaune', 'turquoise', 'noir').map((c) => [c[0], (f, pl) => gxAcc(c[1], f, pl), c[2]])],
  ['jardin', 'de jardin', mdC('blanc', 'vert', 'rouge', 'bleu', 'noir').map((c) => [c[0], (f, pl) => `en plastique ${gxAcc(c[1], false, false)}`, c[2]])],
  ['pliante', 'pliante', mdC('gris', 'noir', 'kaki', 'bleu', 'rouge').map((c) => [c[0], (f, pl) => gxAcc(c[1], f, pl), c[2]])],
];
for (const [s, label, cols] of MD_CHAIRS) {
  mdFam({
    key: `ch${s}`, famName: `Chaises ${label === 'paillée' ? 'paillées' : label === 'pliante' ? 'pliantes' : label}`, cat: 'mobilier', g: 'f', o: { solid: false },
    axes: [cols], nm: ([c]) => `Chaise ${label} ${mdCol(c, true, false)}`, states: ['n', 'u', 'c', 'x', 'b', 'g'],
    mat: () => (s === 'jardin' || s === 'cuisine' ? 'plastique' : s === 'salon' ? 'tissu' : s === 'pliante' || s === 'ecole' ? 'metal' : 'bois'),
    build: ([c]) => (P) => mdChair(P, s, c[2], c[3]),
  });
}
mdFam({
  key: 'tb', famName: 'Tabourets', cat: 'mobilier', g: 'm', o: { solid: false },
  axes: [[['bois', 'en bois'], ['bar', 'de bar'], ['atelier', 'd’atelier'], ['pouf', 'pouf']], mdC('rouge', 'noir', 'bleu', 'marron')],
  nm: ([t, c]) => (t[0] === 'pouf' ? `Pouf ${gxAcc(c[1], false, false)}` : `Tabouret ${t[1]} ${gxAcc(c[1], false, false)}`), states: ['n', 'u', 'x'],
  mat: ([t]) => (t[0] === 'pouf' ? 'tissu' : t[0] === 'bois' ? 'bois' : 'metal'),
  build: ([t, c]) => (P) => {
    if (t[0] === 'bois') { P.c(0.18, 0.05, 0, 0.62, 0, 'wood', mdMix(c[2], 0x8a6a48, 0.6), 0, 0, 0, 14); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; P.b(0.035, 0.62, 0.035, Math.cos(a) * 0.12, 0.31, Math.sin(a) * 0.12, 'wood', 0x5a3f28, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); } }
    else if (t[0] === 'bar') mdChair(P, 'bar', c[2]);
    else if (t[0] === 'atelier') { P.c(0.17, 0.04, 0, 0.66, 0, 'metal', c[2], 0, 0, 0, 14); P.c(0.025, 0.4, 0, 0.45, 0, 'metal', 0x6a6c6e); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; boxBetween(P, 'metal', 0x3a3c3e, [0, 0.27, 0], [Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24], 0.03); } }
    else { P.c(0.28, 0.42, 0, 0.21, 0, 'fabric', c[2], 0, 0, 0, 18); P.c(0.29, 0.03, 0, 0.42, 0, 'fabric', mdShade(c[2], 0.85), 0, 0, 0, 18); }
  },
});
mdFam({
  key: 'cnp', famName: 'Canapés et fauteuils', cat: 'mobilier', g: 'm',
  axes: [[['1', 1], ['2', 2], ['3', 3]], [['droit', ''], ['club', 'club'], ['chester', 'Chesterfield'], ['cuir', 'en cuir']], mdF('rouge', 'vert', 'bleu', 'brun', 'beige', 'gris')],
  nm: ([n, s, c]) => `${n[1] === 1 ? 'Fauteuil' : `Canapé ${n[1]} places`}${s[1] ? ` ${s[1]}` : ''} ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'b', 'g'],
  mat: ([, s]) => (s[0] === 'cuir' ? 'tissu' : 'tissu'),
  build: ([n, s, c]) => (P) => mdSofa(P, n[1], s[0] === 'cuir' ? mdShade(c[2], 0.7) : c[2], s[0] === 'chester' ? 'chesterfield' : s[0] === 'cuir' ? 'cuir' : s[0]),
});
mdFam({
  key: 'lit', famName: 'Lits', cat: 'mobilier', g: 'm',
  axes: [[['simple', '1 place', 0.9], ['double', '2 places', 1.4], ['grand', 'grand', 1.8]], [['bois', 'en bois', 0x5e3e26, 'wood'], ['fer', 'en fer', 0x3a3c40, 'metal'], ['blanc', 'blanc', 0xd8d4c8, 'wood']],
    [['blanc', 'aux draps blancs', 0xe0dcd2], ['bleu', 'aux draps bleus', 0x5a7090], ['rouge', 'aux draps rouges', 0x8a3a34]]],
  nm: ([s, f, d]) => `Lit ${s[1]} ${f[1]} ${d[1]}`, states: ['n', 'u', 'b', 'g'], mat: ([, f]) => (f[0] === 'fer' ? 'metal' : 'bois'),
  build: ([s, f, d]) => (P) => mdBed(P, s[2], d[2], f[2], f[3], true),
});
mdFam({
  key: 'litd', famName: 'Lits défaits', cat: 'mobilier', g: 'm',
  axes: [[['simple', '1 place', 0.9], ['double', '2 places', 1.4]], [['bois', 'en bois', 0x5e3e26, 'wood'], ['fer', 'en fer', 0x3a3c40, 'metal']]],
  nm: ([s, f]) => `Lit ${s[1]} ${f[1]} défait`, states: ['n', 'g'], mat: ([, f]) => (f[0] === 'fer' ? 'metal' : 'bois'),
  build: ([s, f]) => (P) => mdBed(P, s[2], 0xb8b0a0, f[2], f[3], false),
});
const MD_FURN = [
  ['armoire', 'Armoire', 'f', { w: 1.1, h: 2.0, d: 0.55, doors: 2, cornice: true }], ['armoire3', 'Grande armoire', 'f', { w: 1.6, h: 2.1, d: 0.6, doors: 3, cornice: true }],
  ['commode', 'Commode', 'f', { w: 1.0, h: 0.86, d: 0.5, drawers: 3, legs: 0.08, legKind: 'fuse' }], ['buffet', 'Buffet', 'm', { w: 1.6, h: 0.92, d: 0.5, drawers: 1, doors: 3 }],
  ['chevet', 'Table de chevet', 'f', { w: 0.45, h: 0.6, d: 0.4, drawers: 1, doors: 1, legs: 0.12 }], ['vitrine', 'Vitrine', 'f', { w: 0.9, h: 1.8, d: 0.45, doors: 2, glass: true, cornice: true }],
  ['secretaire', 'Secrétaire', 'm', { w: 0.9, h: 1.4, d: 0.45, drawers: 4 }], ['bahut', 'Bahut', 'm', { w: 1.3, h: 1.0, d: 0.55, doors: 2, drawers: 2 }],
];
mdFam({
  key: 'mb', famName: 'Armoires, commodes, buffets', cat: 'mobilier',
  axes: [MD_FURN.map(([k, n, g, o]) => [k, n, o, g]), mdW('chene', 'noyer', 'pin', 'acajou', 'blanc', 'vert')],
  nm: ([t, w]) => `${t[1]} ${mdCol(w, t[3] === 'f', false)}`, gp: ([t]) => [t[3], false], states: ['n', 'u', 'c', 'x', 'b'], mat: () => 'bois',
  build: ([t, w]) => (P) => mdCabinet(P, { ...t[2], c: w[2] }),
});
mdFam({
  key: 'bib', famName: 'Bibliothèques', cat: 'mobilier', g: 'f',
  axes: [[['basse', 'basse', 1.0], ['haute', 'haute', 2.0], ['large', 'large', 2.1]], [['pleine', 'pleine'], ['vide', 'vide'], ['desordre', 'en désordre']], mdW('chene', 'noyer', 'acajou', 'blanc')],
  nm: ([s, f, w]) => `Bibliothèque ${s[1]} ${f[1]} ${mdCol(w, true, false)}`, states: ['n', 'u', 'x', 'b'], mat: () => 'bois',
  build: ([s, f, w]) => (P) => {
    const R = P.R, W = s[0] === 'large' ? 1.8 : 1.0, H = s[2], c = w[2], sh = Math.round(H / 0.38);
    P.b(W, H, 0.03, 0, H / 2, -0.17, 'wood', mdShade(c, 0.8));
    for (const x of [-W / 2, W / 2]) P.b(0.04, H, 0.36, x, H / 2, 0, 'wood', c);
    if (s[0] === 'large') P.b(0.03, H, 0.34, 0, H / 2, 0, 'wood', c);
    for (let i = 0; i <= sh; i++) P.b(W, 0.03, 0.36, 0, 0.02 + (i * (H - 0.04)) / sh, 0, 'wood', c);
    if (f[0] === 'vide') return;
    for (let i = 0; i < sh; i++) {
      const y = 0.035 + (i * (H - 0.04)) / sh;
      let x = -W / 2 + 0.03;
      while (x < W / 2 - 0.06) {
        const bw = 0.025 + R() * 0.04, bh = 0.18 + R() * 0.14;
        if (f[0] === 'desordre' && R() < 0.25) { x += bw + 0.06; continue; }
        const tilt = f[0] === 'desordre' && R() < 0.3 ? (R() - 0.5) * 0.8 : 0;
        P.b(bw, bh, 0.24, x + bw / 2, y + bh / 2 + 0.01, 0.02, 'paper', pk(R, [0x6a1e18, 0x24402a, 0x22304e, 0x5a3a20, 0x1a1a1a, 0x8a6a30, 0x4a2236]), 0, 0, tilt);
        x += bw + 0.004;
      }
      if (f[0] === 'desordre' && R() < 0.5) P.b(0.3, 0.05, 0.22, rr(R, -0.3, 0.3), 0.025, 0.4, 'paper', 0x6a1e18, 0, R() * 3, 0);
    }
  },
});
mdFam({
  key: 'bur', famName: 'Bureaux', cat: 'mobilier', g: 'm',
  axes: [[['ministre', 'ministre'], ['ecolier', 'd’écolier'], ['metal', 'métallique'], ['dactylo', 'de dactylo']], mdW('chene', 'noyer', 'acajou', 'gris')],
  nm: ([t, w]) => `Bureau ${t[1]} ${t[0] === 'metal' ? '' : mdCol(w, false, false)}`.trim(), states: ([t]) => ['n', 'u', 'x', 'b', 'g'],
  mat: ([t]) => (t[0] === 'metal' ? 'metal' : 'bois'),
  build: ([t, w]) => (P) => {
    const c = w[2];
    if (t[0] === 'ministre') { P.b(1.8, 0.05, 0.9, 0, 0.76, 0, 'wood', c); for (const x of [-0.6, 0.6]) partsUnder(P, new THREE.Matrix4().makeTranslation(x, 0, 0), (Q) => mdCabinet(Q, { w: 0.5, h: 0.735, d: 0.84, drawers: 3, c, top: false })); P.b(0.7, 0.5, 0.03, 0, 0.48, -0.4, 'wood', mdShade(c, 0.85)); return; }
    if (t[0] === 'ecolier') { P.b(0.6, 0.03, 0.45, 0, 0.72, 0, 'wood', c, -0.12, 0, 0); P.b(0.6, 0.12, 0.42, 0, 0.64, 0, 'wood', mdShade(c, 0.85)); mdLegs(P, 0.56, 0.4, 0.6, 0.03, 'metal', 0x2a2c2e, 0.01, 'rond'); P.c(0.015, 0.03, 0.2, 0.75, -0.18, 'metal', 0x9a9c9e, Math.PI / 2, 0, 0, 8); return; }
    if (t[0] === 'metal') { P.b(1.4, 0.04, 0.75, 0, 0.75, 0, 'metal', 0x6a706c); P.b(0.42, 0.72, 0.7, 0.45, 0.37, 0, 'metal', 0x5e6460); for (let i = 0; i < 3; i++) { P.b(0.38, 0.2, 0.02, 0.45, 0.6 - i * 0.23, 0.36, 'metal', 0x6e7470); P.b(0.12, 0.02, 0.03, 0.45, 0.65 - i * 0.23, 0.38, 'metal', 0xb0b0ac); } P.b(0.04, 0.72, 0.7, -0.68, 0.37, 0, 'metal', 0x5e6460); P.b(0.9, 0.5, 0.02, -0.2, 0.47, -0.34, 'metal', 0x5e6460); return; }
    P.b(1.1, 0.04, 0.6, 0, 0.72, 0, 'wood', c); mdLegs(P, 1.1, 0.6, 0.7, 0.04, 'wood', mdShade(c, 0.85), 0.03); P.b(0.32, 0.12, 0.26, 0.1, 0.8, -0.05, 'metal', 0x2a2c2e); P.b(0.3, 0.02, 0.1, 0.1, 0.87, -0.15, 'paper', 0xe8e4d8, -0.4, 0, 0);
  },
});

/* =================================================================== cuisine */
const MD_FRONTS = [['blanc', 'blancs', 0xdcdad2], ['bois', 'en bois', 0x9a7450], ['vert', 'vert pâle', 0x9ab49a], ['bleu', 'bleus', 0x5a7aa0], ['rouge', 'rouges', 0x9a3a30], ['gris', 'gris', 0x8a8e8e]];
mdFam({
  key: 'cuib', famName: 'Éléments bas de cuisine', cat: 'cuisine', g: 'm', pl: true,
  axes: [[['1m', 'de 1 m', 1], ['2m', 'de 2 m', 2], ['3m', 'de 3 m', 3]], MD_FRONTS],
  nm: ([l, c]) => `Éléments bas ${c[1]} ${l[1]}`, states: ['n', 'u', 'g'], mat: ([, c]) => (c[0] === 'bois' ? 'bois' : 'peint'),
  build: ([l, c]) => (P) => {
    const L = l[2], n = Math.round(L / 0.5), f = c[0] === 'bois' ? 'wood' : 'paint';
    P.b(L, 0.1, 0.55, 0, 0.05, -0.02, 'paint', 0x2a2a2a);
    P.b(L, 0.76, 0.58, 0, 0.48, 0, f, mdShade(c[2], 0.92));
    for (let i = 0; i < n; i++) { const x = -L / 2 + 0.5 * (i + 0.5); P.b(0.48, 0.72, 0.02, x, 0.48, 0.3, f, c[2]); P.b(0.14, 0.015, 0.025, x, 0.78, 0.315, 'metal', 0xb0b2b4); }
    P.b(L + 0.02, 0.04, 0.62, 0, 0.88, 0.01, 'stone', 0x3a3634);
    if (L >= 2) { P.b(0.5, 0.03, 0.4, L / 2 - 0.6, 0.895, 0.02, 'metal', 0xb8babc); P.b(0.42, 0.02, 0.32, L / 2 - 0.6, 0.9, 0.02, 'metal', 0x5a5c5e); P.c(0.012, 0.25, L / 2 - 0.6, 1.02, -0.2, 'metal', 0xc8cacc); P.c(0.01, 0.15, L / 2 - 0.6, 1.14, -0.13, 'metal', 0xc8cacc, Math.PI / 2, 0, 0, 8); }
    if (L >= 3) { for (const [x, z] of [[-1.25, 0.1], [-1.05, 0.1], [-1.25, -0.1], [-1.05, -0.1]]) P.c(0.07, 0.02, x, 0.905, z, 'metal', 0x2a2a2a, 0, 0, 0, 12); }
  },
});
mdFam({
  key: 'cuih', famName: 'Éléments hauts de cuisine', cat: 'cuisine', g: 'm', pl: true, o: { wall: true },
  axes: [[['1m', 'de 1 m', 1], ['2m', 'de 2 m', 2]], MD_FRONTS], nm: ([l, c]) => `Éléments hauts ${c[1]} ${l[1]}`, states: ['n', 'u'], mat: ([, c]) => (c[0] === 'bois' ? 'bois' : 'peint'),
  build: ([l, c]) => (P) => {
    const L = l[2], n = Math.round(L / 0.5), f = c[0] === 'bois' ? 'wood' : 'paint';
    P.b(L, 0.7, 0.34, 0, 1.85, -0.03, f, mdShade(c[2], 0.92));
    for (let i = 0; i < n; i++) { const x = -L / 2 + 0.5 * (i + 0.5); P.b(0.48, 0.66, 0.02, x, 1.85, 0.15, f, c[2]); P.b(0.015, 0.12, 0.025, x + (i % 2 ? -0.2 : 0.2), 1.6, 0.165, 'metal', 0xb0b2b4); }
  },
});
mdFam({
  key: 'frigo', famName: 'Réfrigérateurs', cat: 'cuisine', g: 'm',
  axes: [[['ancien', 'des années 50'], ['moderne', 'moderne'], ['americain', 'américain']], mdC('blanc', 'creme', 'rouge', 'inox')],
  nm: ([t, c]) => `Réfrigérateur ${t[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'x', 'g'], mat: () => 'metal',
  build: ([t, c]) => (P) => {
    const col = c[2], ch = 0xc8cacc, fm = c[0] === 'inox' ? 'metal' : 'plastic';
    if (t[0] === 'ancien') { P.b(0.76, 1.42, 0.68, 0, 0.71 + 0.08, 0, fm, col); P.c(0.34, 0.76, 0, 1.5, 0, fm, col, 0, 0, Math.PI / 2, 16); P.b(0.76, 0.34, 0.68, 0, 1.5, 0, fm, col); P.b(0.7, 0.08, 0.6, 0, 0.04, 0, 'paint', 0x2a2a2a); P.b(0.06, 0.2, 0.05, 0.28, 1.15, 0.36, 'metal', ch); P.b(0.5, 0.05, 0.01, 0, 1.55, 0.345, 'metal', ch); return; }
    if (t[0] === 'moderne') { P.b(0.6, 1.85, 0.64, 0, 0.925, 0, fm, col); P.b(0.6, 0.012, 0.01, 0, 1.25, 0.322, 'paint', 0x3a3a3a); for (const y of [1.55, 0.9]) P.b(0.02, 0.3, 0.04, -0.25, y, 0.34, 'metal', ch); return; }
    P.b(0.92, 1.8, 0.74, 0, 0.9, 0, fm, col); P.b(0.012, 1.74, 0.01, 0, 0.92, 0.372, 'paint', 0x3a3a3a);
    for (const x of [-0.04, 0.04]) P.b(0.025, 0.7, 0.05, x, 1.1, 0.4, 'metal', ch); P.b(0.2, 0.28, 0.01, -0.22, 1.25, 0.372, 'paint', 0x2a2c2e);
  },
});
mdFam({
  key: 'cuis', famName: 'Cuisinières', cat: 'cuisine', g: 'f',
  axes: [[['gaz', 'à gaz', 0.6], ['fonte', 'en fonte à bois', 1.0], ['piano', 'de restaurant', 1.2]], mdC('blanc', 'noir', 'inox')],
  nm: ([t, c]) => `Cuisinière ${t[1]} ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 'b'], mat: () => 'metal',
  build: ([t, c]) => (P) => {
    const W = t[2], col = t[0] === 'fonte' && c[0] === 'blanc' ? 0xe0dccc : c[2], D = t[0] === 'piano' ? 0.75 : 0.62, fm = c[0] === 'inox' || t[0] === 'fonte' ? 'metal' : 'plastic';
    P.b(W, 0.86, D, 0, 0.43 + 0.04, 0, fm, col); P.b(W - 0.04, 0.08, D - 0.04, 0, 0.04, 0, 'paint', 0x1e1e1e);
    P.b(W, 0.03, D, 0, 0.92, 0, 'metal', t[0] === 'fonte' ? 0x2a2a2a : mdShade(col, 0.8));
    const nb = t[0] === 'gaz' ? 4 : 6;
    for (let i = 0; i < nb; i++) { const x = -W / 2 + W * ((i % (nb / 2)) + 0.5) / (nb / 2), z = i < nb / 2 ? -0.12 : 0.12; P.c(0.08, 0.02, x, 0.945, z, 'metal', 0x1a1a1a, 0, 0, 0, 12); }
    for (let i = 0; i < (t[0] === 'gaz' ? 1 : 2); i++) { const x = t[0] === 'gaz' ? 0 : (i - 0.5) * W / 2; P.b(W / (t[0] === 'gaz' ? 1.25 : 2.5), 0.42, 0.02, x, 0.45, D / 2 + 0.01, 'metal', mdShade(col, 0.9)); P.b(W / (t[0] === 'gaz' ? 2.2 : 4.5), 0.18, 0.022, x, 0.47, D / 2 + 0.012, 'glass', 0x1a1a1a); P.c(0.012, W / (t[0] === 'gaz' ? 1.5 : 3), x, 0.69, D / 2 + 0.05, 'metal', 0xc8cacc, 0, 0, Math.PI / 2, 8); }
    for (let i = 0; i < nb; i++) P.c(0.022, 0.03, -W / 2 + 0.08 + i * ((W - 0.16) / Math.max(1, nb - 1)), 0.8, D / 2 + 0.015, 'plastic', 0x1a1a1a, Math.PI / 2, 0, 0, 10);
    if (t[0] === 'fonte') { P.c(0.07, 1.6, W / 2 - 0.15, 1.75, -0.2, 'metal', 0x2a2a2a); }
  },
});
mdFam({
  key: 'lav', famName: 'Lave-linge et lave-vaisselle', cat: 'cuisine', g: 'm',
  axes: [[['linge', 'Lave-linge'], ['vaisselle', 'Lave-vaisselle'], ['seche', 'Sèche-linge']], mdC('blanc', 'gris')],
  nm: ([t, c]) => `${t[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'x'], mat: () => 'metal',
  build: ([t, c]) => (P) => {
    P.b(0.6, 0.85, 0.6, 0, 0.425, 0, 'plastic', c[2]); P.b(0.6, 0.1, 0.02, 0, 0.78, 0.31, 'plastic', mdShade(c[2], 0.9));
    for (let i = 0; i < 3; i++) P.c(0.018, 0.02, -0.2 + i * 0.08, 0.78, 0.32, 'plastic', 0x3a3a3a, Math.PI / 2, 0, 0, 8);
    if (t[0] === 'vaisselle') { P.b(0.56, 0.6, 0.02, 0, 0.38, 0.31, 'metal', mdShade(c[2], 0.95)); P.b(0.3, 0.025, 0.03, 0, 0.66, 0.33, 'metal', 0x9a9c9e); }
    else { P.c(0.2, 0.03, 0, 0.42, 0.31, 'metal', 0xb0b2b4, Math.PI / 2, 0, 0, 20); P.c(0.16, 0.035, 0, 0.42, 0.315, 'glass', t[0] === 'seche' ? 0x3a3a3a : 0x5a7a8a, Math.PI / 2, 0, 0, 20); }
  },
});
mdFam({
  key: 'ust', famName: 'Objets de cuisine', cat: 'cuisine', g: 'm', o: { solid: false },
  axes: [[['casseroles', 'Pile de casseroles', 'f'], ['assiettes', 'Piles d’assiettes', 'f'], ['bocaux', 'Bocaux', 'm'], ['bouteilles', 'Bouteilles', 'f'], ['conserves', 'Pyramide de conserves', 'f'],
    ['cafe', 'Cafetière et tasses', 'f'], ['pain', 'Pains sur une planche', 'm'], ['fruits', 'Corbeille de fruits', 'f'], ['vaisselle', 'Vaisselle sale', 'f'], ['marmite', 'Marmite', 'f'], ['grille', 'Grille-pain', 'm'], ['balance', 'Balance de cuisine', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], ['bocaux', 'bouteilles', 'pain'].includes(t[0])], states: ['n', 'g'], mat: ([t]) => (['bocaux', 'bouteilles'].includes(t[0]) ? 'verre' : 'metal'),
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'casseroles': for (let i = 0; i < 3; i++) { const r = 0.16 - i * 0.03; P.c(r, 0.12, 0, 0.06 + i * 0.12, 0, 'metal', 0xa0a2a4, 0, 0, 0, 16); P.b(0.2, 0.02, 0.03, r + 0.1, 0.1 + i * 0.12, 0, 'plastic', 0x1a1a1a); } break;
      case 'assiettes': for (const [x, n] of [[-0.14, 9], [0.14, 6]]) for (let i = 0; i < n; i++) P.c(0.12, 0.012, x, 0.006 + i * 0.013, 0, 'plastic', 0xe8e6e0, 0, 0, 0, 16); break;
      case 'bocaux': for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.12, h = 0.14 + R() * 0.1; P.c(0.05, h, x, h / 2, 0, 'glass', 0xb0c8c0, 0, 0, 0, 12); P.c(0.045, h * 0.7, x, h * 0.36, 0, 'paint', pk(R, [0xb83a2a, 0xd8a030, 0x6a8a3a, 0x7a3a5a]), 0, 0, 0, 12); P.c(0.052, 0.02, x, h + 0.01, 0, 'metal', 0xc0a040, 0, 0, 0, 12); } break;
      case 'bouteilles': for (let i = 0; i < 6; i++) { const x = (i % 3 - 1) * 0.1, z = i < 3 ? -0.05 : 0.06, c = pk(R, [0x2a5a2a, 0x5a3a1a, 0x3a3a3a, 0x8a9a8a]); P.c(0.035, 0.2, x, 0.1, z, 'glass', c, 0, 0, 0, 10); P.c(0.013, 0.08, x, 0.24, z, 'glass', c, 0, 0, 0, 8); } break;
      case 'conserves': { let y = 0; for (let row = 3; row >= 1; row--) { for (let i = 0; i < row; i++) P.c(0.04, 0.11, (i - (row - 1) / 2) * 0.085, y + 0.055, 0, 'metal', pk(R, [0xb83a2a, 0xc8a030, 0x3a6a8a, 0xd0d0c8]), 0, 0, 0, 12); y += 0.11; } break; }
      case 'cafe': P.c(0.07, 0.2, 0, 0.1, 0, 'metal', 0xa8aaac, 0, 0, 0, 12); P.t(0.03, 0.07, 0.08, 0, 0.24, 0, 'metal', 0xa8aaac, 0, 0, 0, 12); for (let i = 0; i < 3; i++) { const a = i * 2.1; P.c(0.04, 0.06, Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2, 'plastic', 0xe8e4dc, 0, 0, 0, 12); } break;
      case 'pain': P.b(0.6, 0.03, 0.3, 0, 0.015, 0, 'wood', 0x9a7450); for (let i = 0; i < 3; i++) P.s(0.07, -0.18 + i * 0.18, 0.07, 0, 'paper', 0xc89050, 1.6, 0.8, 1, 10); break;
      case 'fruits': P.t(0.2, 0.12, 0.1, 0, 0.05, 0, 'wood', 0x8a6a40, 0, 0, 0, 14); for (let i = 0; i < 8; i++) { const a = R() * TAU, d = R() * 0.12; P.s(0.045, Math.cos(a) * d, 0.11 + R() * 0.05, Math.sin(a) * d, 'plastic', pk(R, [0xb82a1a, 0xd8a020, 0x6a9a2a, 0xe87a20]), 1, 1, 1, 8); } break;
      case 'vaisselle': for (let i = 0; i < 9; i++) P.c(0.1 + R() * 0.04, 0.012, rr(R, -0.15, 0.15), 0.01 + i * 0.02, rr(R, -0.1, 0.1), 'plastic', mdMix(0xe8e6e0, 0x8a7a5a, R() * 0.4), (R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4, 14); for (let i = 0; i < 3; i++) P.c(0.035, 0.08, rr(R, -0.2, 0.2), 0.2, rr(R, -0.1, 0.1), 'plastic', 0xe8e4dc, R(), 0, R(), 10); break;
      case 'marmite': P.c(0.22, 0.28, 0, 0.14, 0, 'metal', 0x5a5c5e, 0, 0, 0, 18); P.c(0.23, 0.03, 0, 0.3, 0, 'metal', 0x4a4c4e, 0, 0, 0, 18); for (const x of [-1, 1]) P.o(0.04, 0.01, x * 0.24, 0.24, 0, 'metal', 0x3a3a3a, 0, Math.PI / 2, 0); break;
      case 'grille': P.b(0.28, 0.18, 0.16, 0, 0.09, 0, 'metal', 0xb8babc); for (const z of [-0.03, 0.03]) P.b(0.2, 0.01, 0.025, 0, 0.18, z, 'paint', 0x1a1a1a); P.b(0.02, 0.05, 0.03, 0.15, 0.12, 0, 'plastic', 0x1a1a1a); break;
      default: P.b(0.25, 0.08, 0.2, 0, 0.04, 0, 'metal', 0xe0dcd0); P.c(0.12, 0.02, 0, 0.09, 0, 'metal', 0xb8babc, 0, 0, 0, 16); P.c(0.06, 0.005, 0, 0.06, 0.1, 'glass', 0xf0f0f0, Math.PI / 2, 0, 0, 12);
    }
  },
});

/* ============================================================ salle de bain */
const MD_SAN = [['blanc', 'blanc', 0xe8e8e2], ['creme', 'crème', 0xe6dcc0], ['rose', 'rose', 0xe0b8b8], ['vert', 'vert pâle', 0xb8d0c0]];
mdFam({
  key: 'bain', famName: 'Baignoires', cat: 'cuisine', g: 'f', axes: [[['sabot', 'sur pieds'], ['encastree', 'encastrée']], MD_SAN],
  nm: ([t, c]) => `Baignoire ${t[1]} ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 'g'], mat: () => 'plastique',
  build: ([t, c]) => (P) => {
    const col = c[2];
    if (t[0] === 'sabot') {
      P.b(1.2, 0.5, 0.74, 0, 0.42, 0, 'plastic', col); for (const x of [-0.6, 0.6]) P.c(0.37, 0.5, x, 0.42, 0, 'plastic', col, 0, 0, 0, 18);
      P.b(1.2, 0.02, 0.6, 0, 0.66, 0, 'plastic', mdShade(col, 0.75)); for (const x of [-0.6, 0.6]) P.c(0.3, 0.02, x, 0.66, 0, 'plastic', mdShade(col, 0.75), 0, 0, 0, 18);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.s(0.06, sx * 0.62, 0.1, sz * 0.24, 'metal', 0xb09040, 1, 1.4, 1, 8);
      P.c(0.015, 0.25, -0.88, 0.8, 0, 'metal', 0xc8cacc); P.c(0.012, 0.12, -0.83, 0.92, 0, 'metal', 0xc8cacc, 0, 0, Math.PI / 2, 8);
    } else {
      P.b(1.7, 0.56, 0.75, 0, 0.28, 0, 'plastic', mdShade(col, 0.95)); P.b(1.6, 0.02, 0.62, 0, 0.565, 0, 'plastic', mdShade(col, 0.72));
      P.b(1.7, 0.56, 0.02, 0, 0.28, 0.38, 'tex:tiles_white', 0xffffff); P.c(0.015, 0.2, -0.78, 0.66, -0.3, 'metal', 0xc8cacc);
    }
  },
});
mdFam({
  key: 'lavab', famName: 'Lavabos', cat: 'cuisine', g: 'm', axes: [[['colonne', 'sur colonne'], ['meuble', 'sur meuble'], ['mural', 'mural']], MD_SAN.slice(0, 2)],
  nm: ([t, c]) => `Lavabo ${t[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'c', 'g'], mat: () => 'plastique',
  opts: ([t]) => ({ wall: t[0] === 'mural', solid: t[0] !== 'mural' }),
  build: ([t, c]) => (P) => {
    const col = c[2], y = 0.85;
    if (t[0] === 'colonne') P.t(0.09, 0.13, y - 0.1, 0, (y - 0.1) / 2, -0.05, 'plastic', col, 0, 0, 0, 14);
    if (t[0] === 'meuble') mdCabinet(P, { w: 0.7, h: 0.78, d: 0.45, doors: 2, c: 0xb8a888, top: false });
    P.b(0.6, 0.16, 0.45, 0, y - 0.04, 0, 'plastic', col); P.b(0.48, 0.02, 0.32, 0, y + 0.035, 0.02, 'plastic', mdShade(col, 0.75));
    P.c(0.014, 0.18, 0, y + 0.12, -0.18, 'metal', 0xc8cacc); P.c(0.01, 0.1, 0, y + 0.2, -0.13, 'metal', 0xc8cacc, Math.PI / 2, 0, 0, 8);
    if (t[0] === 'mural') P.b(0.5, 0.7, 0.02, 0, y + 0.55, -0.22, 'metal', 0xd0d8dc);
  },
});
mdFam({
  key: 'wc', famName: 'Toilettes', cat: 'cuisine', g: 'f', pl: true, axes: [[['moderne', ''], ['chasse', 'à chasse haute'], ['turc', 'à la turque']], MD_SAN.slice(0, 2)],
  nm: ([t, c]) => `Toilettes${t[1] ? ` ${t[1]}` : ''} ${gxAcc(c[1], true, true)}`, states: ['n', 'u', 'c'], mat: () => 'plastique', opts: ([t]) => ({ solid: t[0] !== 'turc' }),
  build: ([t, c]) => (P) => {
    const col = c[2];
    if (t[0] === 'turc') { P.b(0.7, 0.04, 0.8, 0, 0.02, 0, 'plastic', col); P.b(0.3, 0.02, 0.42, 0, 0.04, 0.08, 'plastic', mdShade(col, 0.6)); for (const x of [-0.2, 0.2]) P.b(0.12, 0.02, 0.26, x, 0.045, -0.2, 'plastic', mdShade(col, 0.9)); return; }
    P.t(0.16, 0.12, 0.38, 0, 0.19, 0.05, 'plastic', col, 0, 0, 0, 14); P.c(0.19, 0.04, 0, 0.4, 0.08, 'plastic', mdShade(col, 0.96), 0, 0, 0, 16); P.c(0.18, 0.02, 0, 0.43, 0.08, 'plastic', 0x2a2a2a, 0, 0, 0, 16);
    if (t[0] === 'chasse') { P.b(0.42, 0.22, 0.18, 0, 1.95, -0.2, 'wood', 0x5a3f28); P.c(0.015, 1.5, 0.12, 1.15, -0.2, 'metal', 0x8a8c8e); P.c(0.004, 0.5, -0.15, 1.6, -0.12, 'metal', 0x9a9c9e); P.b(0.42, 0.04, 0.38, 0, 0.45, 0.06, 'wood', 0x5a3f28); }
    else { P.b(0.4, 0.38, 0.18, 0, 0.62, -0.18, 'plastic', col); P.b(0.42, 0.03, 0.2, 0, 0.82, -0.18, 'plastic', mdShade(col, 0.95)); P.b(0.38, 0.03, 0.42, 0, 0.44, 0.06, 'plastic', col, -0.02, 0, 0); }
  },
});
mdFam({
  key: 'douche', famName: 'Douches', cat: 'cuisine', g: 'f', axes: [[['cabine', 'en cabine vitrée'], ['rideau', 'à rideau'], ['collective', 'collective']]],
  nm: ([t]) => `Douche ${t[1]}`, states: ['n', 'u', 'g'], mat: () => 'verre',
  build: ([t]) => (P) => {
    if (t[0] === 'collective') { P.b(2.4, 0.06, 1.0, 0, 0.03, 0, 'tex:tiles_white', 0xffffff); P.c(0.02, 2.2, 0, 1.1, -0.45, 'metal', 0xb0b2b4); P.b(2.2, 0.03, 0.03, 0, 2.0, -0.45, 'metal', 0xb0b2b4); for (const x of [-0.8, 0, 0.8]) { P.c(0.012, 0.25, x, 1.9, -0.35, 'metal', 0xb0b2b4, Math.PI / 2, 0, 0, 8); P.c(0.06, 0.03, x, 1.9, -0.22, 'metal', 0xb0b2b4, 0, 0, 0, 10); } return; }
    P.b(0.9, 0.12, 0.9, 0, 0.06, 0, 'plastic', 0xe8e8e2); P.c(0.012, 1.6, -0.35, 1.0, -0.4, 'metal', 0xc8cacc); P.c(0.06, 0.03, -0.35, 1.9, -0.32, 'metal', 0xc8cacc, 0.5, 0, 0, 10);
    if (t[0] === 'cabine') { for (const [x, z, w, d] of [[0, 0.45, 0.9, 0.02], [0.45, 0, 0.02, 0.9], [-0.45, 0, 0.02, 0.9], [0, -0.45, 0.9, 0.02]]) P.b(w, 1.9, d, x, 1.07, z, 'glass', 0xb8d0d4); for (const [x, z] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]]) P.b(0.03, 1.9, 0.03, x, 1.07, z, 'metal', 0xb0b2b4); }
    else { P.b(0.9, 0.02, 0.02, 0, 2.0, 0.45, 'metal', 0xb0b2b4); P.b(0.02, 0.02, 0.9, 0.45, 2.0, 0, 'metal', 0xb0b2b4); P.b(0.8, 1.75, 0.02, -0.02, 1.1, 0.45, 'fabric', 0xc8d0d4); P.b(0.02, 1.75, 0.5, 0.45, 1.1, -0.18, 'fabric', 0xc8d0d4); }
  },
});
