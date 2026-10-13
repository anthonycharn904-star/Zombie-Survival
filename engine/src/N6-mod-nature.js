/* =====================================================================================================
   Jeu 2.0.4 : modèles de la nature, de l'éclairage, de l'horreur, de l'Antiquité (Égypte) et de la
   science-fiction (Lune).
   ===================================================================================================== */
/* Tronc effilé et branches (repris des arbres des abords) ; feuillage en boules (famille foliage). */
function mdTree(P, o) {
  const R = P.R, H = o.h, tr = o.trunk || 0x4a3a2a, bark = o.bark || 'bark';
  cylBetween(P, bark, tr, [0, 0, 0], [rr(R, -0.1, 0.1) * H * 0.1, H * 0.55, rr(R, -0.1, 0.1) * H * 0.1], o.r, o.r * 0.6, 10);
  const top = [0, H * 0.55, 0];
  const nb = o.branches || 5;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * TAU + R() * 0.8, l = H * rr(R, 0.25, 0.4), up = rr(R, 0.4, 0.9);
    const end = [Math.cos(a) * l * (1 - up * 0.5), top[1] + l * up, Math.sin(a) * l * (1 - up * 0.5)];
    cylBetween(P, bark, tr, [top[0], top[1] - R() * H * 0.1, top[2]], end, o.r * 0.45, o.r * 0.15, 8);
    if (o.leaves) for (let k = 0; k < (o.puffs || 2); k++) P.s(H * rr(R, 0.13, 0.2) * (o.leafK || 1), end[0] + rr(R, -0.3, 0.3), end[1] + rr(R, -0.2, 0.4), end[2] + rr(R, -0.3, 0.3), 'foliage', mdShade(pk(R, o.leaves), rr(R, 0.85, 1.15)), 1, rr(R, 0.7, 0.95), 1, 10);
  }
  if (o.leaves && o.crown !== false) P.s(H * 0.26 * (o.leafK || 1), 0, H * 0.82, 0, 'foliage', mdShade(pk(R, o.leaves), 0.95), 1.1, 0.85, 1.1, 12);
}
const MD_SEASON = [['ete', 'en été', [0x3e6a32, 0x4a7a3a, 0x35602c]], ['automne', 'en automne', [0xb8602a, 0xd0902a, 0x9a3a1e, 0x8a7a2a]], ['mort', 'mort', null]];

/* ==================================================================== nature */
mdFam({
  key: 'arb', famName: 'Arbres', cat: 'nature', g: 'm',
  axes: [[['feuillu', 'Arbre feuillu', 0x4a3a2a], ['chene', 'Chêne', 0x3e3226], ['bouleau', 'Bouleau', 0xd8d4c8], ['peuplier', 'Peuplier', 0x5a4a3a], ['saule', 'Saule pleureur', 0x4a3e30], ['fruitier', 'Arbre fruitier', 0x5a4632]],
    [['petit', 'petit', 4], ['moyen', 'moyen', 7], ['grand', 'grand', 11]], MD_SEASON],
  nm: ([t, s, se]) => `${t[1]} ${s[1]} ${se[1]}`, states: ['n', 's', 'b'], mat: () => 'vegetal',
  build: ([t, s, se]) => (P) => {
    const H = s[2], R = P.R;
    if (t[0] === 'peuplier') { cylBetween(P, 'bark', t[2], [0, 0, 0], [0, H, 0], H * 0.03, H * 0.008, 10); if (se[2]) for (let i = 0; i < 6; i++) P.s(H * 0.13, rr(R, -0.2, 0.2), H * (0.3 + i * 0.11), rr(R, -0.2, 0.2), 'foliage', pk(R, se[2]), 1, 1.6, 1, 10); return; }
    if (t[0] === 'saule') { mdTree(P, { h: H, r: H * 0.05, trunk: t[2], branches: 7, leaves: null }); if (se[2]) for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; card(P, 'vine', pk(R, se[2]), 0.8, H * 0.55, Math.cos(a) * H * 0.3, H * 0.55, Math.sin(a) * H * 0.3, -a + Math.PI / 2, 0.1); } P.s(H * 0.3, 0, H * 0.85, 0, 'foliage', se[2] ? se[2][0] : 0x5a4a3a, 1.2, 0.5, 1.2, 12); return; }
    mdTree(P, { h: H, r: H * (t[0] === 'chene' ? 0.06 : 0.04), trunk: t[2], bark: t[0] === 'bouleau' ? 'paint' : 'bark', branches: t[0] === 'chene' ? 7 : 5, leaves: se[2], leafK: t[0] === 'chene' ? 1.25 : 1, puffs: 2 });
    if (t[0] === 'fruitier' && se[0] === 'ete') for (let i = 0; i < 10; i++) P.s(0.06, rr(R, -H * 0.3, H * 0.3), rr(R, H * 0.6, H * 0.95), rr(R, -H * 0.3, H * 0.3), 'plastic', pk(R, [0xc02a1a, 0xd8a020]), 1, 1, 1, 8);
    if (t[0] === 'bouleau') for (let i = 0; i < 6; i++) P.b(H * 0.045, 0.04, H * 0.045, 0, rr(R, 0.3, H * 0.5), 0, 'paint', 0x1a1a1a, 0, R() * 3, 0);
  },
});
mdFam({
  key: 'sap', famName: 'Conifères', cat: 'nature', g: 'm',
  axes: [[['sapin', 'Sapin'], ['epicea', 'Épicéa'], ['pinparasol', 'Pin parasol'], ['cypres', 'Cyprès']], [['petit', 'petit', 3], ['moyen', 'moyen', 6], ['grand', 'grand', 10]]],
  nm: ([t, s]) => `${t[1]} ${s[1]}`, states: ['n', 's', 'b'], mat: () => 'vegetal',
  build: ([t, s]) => (P) => {
    const H = s[2], R = P.R;
    if (t[0] === 'pinparasol') { cylBetween(P, 'bark', 0x6a4a34, [0, 0, 0], [H * 0.06, H * 0.7, 0], H * 0.035, H * 0.02, 10); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; cylBetween(P, 'bark', 0x6a4a34, [H * 0.06, H * 0.65, 0], [Math.cos(a) * H * 0.25, H * 0.8, Math.sin(a) * H * 0.25], H * 0.015, H * 0.008, 8); } P.s(H * 0.38, H * 0.05, H * 0.86, 0, 'foliage', 0x3a5a2e, 1, 0.32, 1, 14); return; }
    if (t[0] === 'cypres') { cylBetween(P, 'bark', 0x4a3a2a, [0, 0, 0], [0, H * 0.3, 0], H * 0.03, H * 0.02, 8); P.s(H * 0.14, 0, H * 0.55, 0, 'foliage', 0x2a4a2a, 1, 3.4, 1, 12); return; }
    cylBetween(P, 'bark', 0x4a3a2a, [0, 0, 0], [0, H * 0.95, 0], H * 0.035, H * 0.006, 10);
    const n = t[0] === 'epicea' ? 7 : 5;
    for (let i = 0; i < n; i++) { const y = H * (0.18 + (i / n) * 0.72), r = H * 0.32 * (1 - i / (n + 0.5)); P.t(r * 0.15, r, H * 0.24, 0, y + H * 0.1, 0, 'foliage', mdShade(0x2e5230, rr(R, 0.85, 1.1)), 0, R() * 3, 0, 9); }
  },
});
mdFam({
  key: 'bui', famName: 'Buissons et haies', cat: 'nature', g: 'm',
  axes: [[['rond', 'Buisson rond', 'm'], ['haie', 'Haie taillée', 'f'], ['epineux', 'Buisson épineux', 'm'], ['fleuri', 'Buisson fleuri', 'm'], ['mort', 'Buisson mort', 'm']], [['petit', 'petit', 0.7], ['grand', 'grand', 1.4]]],
  nm: ([t, s]) => `${t[1]} ${gxAcc(s[1], t[2] === 'f', false)}`, gp: ([t]) => [t[2], false], states: ['n', 's', 'b'], mat: () => 'vegetal', opts: ([, s]) => ({ solid: s[0] === 'grand' }),
  build: ([t, s]) => (P) => {
    const k = s[2], R = P.R;
    switch (t[0]) {
      case 'haie': P.b(2.0, 1.2 * k, 0.7, 0, 0.6 * k, 0, 'foliage', 0x34582c); for (let i = 0; i < 6; i++) P.s(0.3, rr(R, -0.9, 0.9), 1.2 * k, rr(R, -0.2, 0.2), 'foliage', 0x3a602e, 1, 0.5, 1, 8); break;
      case 'mort': for (let i = 0; i < 12; i++) { const a = R() * TAU, l = k * rr(R, 0.5, 1); cylBetween(P, 'bark', 0x5a4a3a, [0, 0, 0], [Math.cos(a) * l * 0.6, l, Math.sin(a) * l * 0.6], 0.02 * k, 0.005, 5); } break;
      default: for (let i = 0; i < 7; i++) P.s(k * rr(R, 0.35, 0.5), rr(R, -k * 0.35, k * 0.35), k * rr(R, 0.35, 0.6), rr(R, -k * 0.35, k * 0.35), 'foliage', mdShade(t[0] === 'epineux' ? 0x3a4a2a : 0x3e6a32, rr(R, 0.85, 1.15)), 1, 0.85, 1, 10);
        if (t[0] === 'fleuri') for (let i = 0; i < 18; i++) P.s(0.05, rr(R, -k * 0.6, k * 0.6), k * rr(R, 0.5, 1.0), rr(R, -k * 0.6, k * 0.6), 'plastic', pk(R, [0xd83a5a, 0xe8e0e8, 0xe8c040]), 1, 1, 1, 6);
        if (t[0] === 'epineux') for (let i = 0; i < 10; i++) P.s(0.03, rr(R, -k * 0.5, k * 0.5), k * rr(R, 0.4, 0.9), rr(R, -k * 0.5, k * 0.5), 'plastic', 0x5a1a2a, 1, 1, 1, 6);
    }
  },
});
mdFam({
  key: 'roc', famName: 'Rochers', cat: 'nature', g: 'm',
  axes: [[['rond', 'Rocher rond'], ['plat', 'Rocher plat'], ['pointu', 'Rocher pointu'], ['amas', 'Amas de rochers']], [['petit', 'petit', 0.5], ['moyen', 'moyen', 1.2], ['grand', 'grand', 2.6]],
    [['gris', 'gris', 0x8a8680], ['brun', 'brun', 0x7a6a58], ['ocre', 'ocre', 0xb0906a], ['sombre', 'sombre', 0x4a4846]]],
  nm: ([t, s, c]) => `${t[1]} ${s[1]} ${gxAcc(c[1], false, false)}`.replace('Amas de rochers petit', 'Petit amas de rochers').replace('Amas de rochers moyen', 'Amas de rochers').replace('Amas de rochers grand', 'Grand amas de rochers'),
  states: ['n', 'm', 's'], mat: () => 'pierre', opts: ([, s]) => ({ solid: s[0] !== 'petit' }),
  build: ([t, s, c]) => (P) => {
    const k = s[2], R = P.R, col = c[2];
    switch (t[0]) {
      case 'plat': P.k(k, 0, k * 0.2, 0, 'stone', col, 1.3, 0.35, 1, (R() * 8) | 0, R() * 3); break;
      case 'pointu': P.k(k * 0.7, 0, k * 0.8, 0, 'stone', col, 0.8, 1.6, 0.7, (R() * 8) | 0, R() * 3); break;
      case 'amas': for (let i = 0; i < 5; i++) P.k(k * rr(R, 0.35, 0.6), rr(R, -k * 0.6, k * 0.6), k * 0.25, rr(R, -k * 0.6, k * 0.6), 'stone', mdShade(col, rr(R, 0.85, 1.1)), 1, rr(R, 0.6, 1), 1, i, R() * 3); break;
      default: P.k(k, 0, k * 0.55, 0, 'stone', col, 1, 0.75, 1, (R() * 8) | 0, R() * 3);
    }
  },
});
mdFam({
  key: 'bois', famName: 'Souches et troncs', cat: 'nature', g: 'f',
  axes: [[['souche', 'Souche', 'f'], ['tronc', 'Tronc couché', 'm'], ['creux', 'Tronc creux', 'm'], ['branches', 'Tas de branches mortes', 'm'], ['buches', 'Bûches empilées', 'f'], ['racines', 'Souche déracinée', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'buches'], states: ['n', 'm', 's'], mat: () => 'bois',
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'souche': P.c(0.35, 0.5, 0, 0.25, 0, 'bark', 0x4a3a2a, 0, 0, 0, 12); P.c(0.33, 0.02, 0, 0.5, 0, 'wood', 0xa8885a, 0, 0, 0, 12); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; cylBetween(P, 'bark', 0x4a3a2a, [Math.cos(a) * 0.25, 0.15, Math.sin(a) * 0.25], [Math.cos(a) * 0.7, -0.02, Math.sin(a) * 0.7], 0.08, 0.02, 6); } break;
      case 'tronc': case 'creux': cylBetween(P, 'bark', 0x4a3a2a, [-2, 0.35, 0], [2, 0.3, 0.2], 0.35, 0.28, 12); if (t[0] === 'creux') { P.c(0.26, 0.04, -2.01, 0.35, 0, 'paint', 0x1a1410, 0, 0, Math.PI / 2, 12); } else P.c(0.33, 0.02, -2.01, 0.35, 0, 'wood', 0xa8885a, 0, 0, Math.PI / 2, 12); for (let i = 0; i < 3; i++) cylBetween(P, 'bark', 0x4a3a2a, [rr(R, -1.5, 1.5), 0.4, 0], [rr(R, -1.5, 1.5), 1.2, rr(R, -0.8, 0.8)], 0.06, 0.02, 6); break;
      case 'branches': for (let i = 0; i < 14; i++) { const a = R() * TAU; cylBetween(P, 'bark', 0x5a4a3a, [rr(R, -1, 1), rr(R, 0, 0.4), rr(R, -0.8, 0.8)], [rr(R, -1.2, 1.2), rr(R, 0, 0.5), rr(R, -1, 1)], rr(R, 0.03, 0.07), 0.02, 6); } break;
      case 'buches': for (let r = 0; r < 4; r++) for (let i = 0; i < 6 - r; i++) { const x = (i - (5 - r) / 2) * 0.24; P.c(0.12, 1.0, x, 0.12 + r * 0.21, 0, 'bark', 0x5a4632, Math.PI / 2, 0, 0, 10); P.c(0.11, 1.01, x, 0.12 + r * 0.21, 0, 'wood', 0xb8986a, Math.PI / 2, 0, 0, 10); } break;
      default: P.c(0.3, 0.8, 0, 0.45, 0, 'bark', 0x4a3a2a, 0, 0, 1.2, 12); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; cylBetween(P, 'bark', 0x3a2e22, [0.3, 0.6, 0], [0.4 + Math.cos(a) * 0.3, 0.6 + Math.sin(a) * 0.9, rr(R, -0.8, 0.8)], 0.07, 0.015, 6); } P.c(0.6, 0.05, 0.3, 0.6, 0, 'paper', 0x4a3a28, 0, 0, Math.PI / 2 - 0.35, 14);
    }
  },
});
mdFam({
  key: 'veg', famName: 'Petite végétation', cat: 'nature', g: 'f', o: { solid: false },
  axes: [[['herbes', 'Herbes hautes', 'f'], ['fougeres', 'Fougères', 'f'], ['roseaux', 'Roseaux', 'm'], ['fleurs', 'Fleurs sauvages', 'f'], ['champignons', 'Champignons', 'm'], ['ronces', 'Ronces', 'f'], ['nenuphars', 'Nénuphars', 'm'], ['ble', 'Blé', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] !== 'ble'], states: ['n', 'u', 's'], mat: () => 'vegetal',
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'herbes': case 'ble': for (let i = 0; i < 14; i++) card(P, 'fern', t[0] === 'ble' ? 0xc8a85a : 0x6a8a3a, 0.4, rr(R, 0.5, 0.9), rr(R, -0.5, 0.5), 0.3, rr(R, -0.5, 0.5), R() * 3, rr(R, -0.1, 0.1)); break;
      case 'fougeres': for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; card(P, 'fern', 0x4e7e3a, 0.35, 0.7, Math.cos(a) * 0.25, 0.25, Math.sin(a) * 0.25, -a + Math.PI / 2, 0.8); } break;
      case 'roseaux': for (let i = 0; i < 20; i++) { const x = rr(R, -0.5, 0.5), z = rr(R, -0.5, 0.5), h = rr(R, 1.2, 2.0); P.c(0.008, h, x, h / 2, z, 'foliage', 0x7a8a4a, rr(R, -0.08, 0.08), 0, rr(R, -0.08, 0.08), 5); if (R() < 0.4) P.c(0.02, 0.2, x, h, z, 'fabric', 0x5a3a24, 0, 0, 0, 6); } break;
      case 'fleurs': for (let i = 0; i < 16; i++) { const x = rr(R, -0.5, 0.5), z = rr(R, -0.5, 0.5), h = rr(R, 0.2, 0.5); P.c(0.005, h, x, h / 2, z, 'foliage', 0x4a7a3a, 0, 0, 0, 4); P.s(0.035, x, h, z, 'plastic', pk(R, [0xd83a5a, 0xe8e0e8, 0xe8c040, 0x8a5ac8]), 1, 0.6, 1, 6); } break;
      case 'champignons': for (let i = 0; i < 7; i++) { const x = rr(R, -0.3, 0.3), z = rr(R, -0.3, 0.3), h = rr(R, 0.05, 0.15); P.c(0.015, h, x, h / 2, z, 'plastic', 0xe8e0c8, 0, 0, 0, 6); P.s(rr(R, 0.04, 0.08), x, h, z, 'plastic', pk(R, [0xb83a24, 0x8a6a40, 0xd8c8a0]), 1, 0.5, 1, 8); } break;
      case 'ronces': for (let i = 0; i < 16; i++) cylBetween(P, 'vine', 0x4a3a2a, [rr(R, -0.6, 0.6), 0, rr(R, -0.6, 0.6)], [rr(R, -0.8, 0.8), rr(R, 0.3, 0.8), rr(R, -0.8, 0.8)], 0.012, 0.006, 5); for (let i = 0; i < 6; i++) P.s(0.2, rr(R, -0.5, 0.5), rr(R, 0.2, 0.5), rr(R, -0.5, 0.5), 'foliage', 0x3a5a2a, 1, 0.6, 1, 8); break;
      default: for (let i = 0; i < 6; i++) { P.c(rr(R, 0.12, 0.25), 0.01, rr(R, -0.7, 0.7), 0.012, rr(R, -0.7, 0.7), 'foliage', 0x3e6a32, 0, 0, 0, 12); } P.s(0.05, 0.1, 0.05, 0.1, 'plastic', 0xe8b8c8, 1, 0.6, 1, 8);
    }
  },
});
mdFam({
  key: 'des', famName: 'Plantes et objets du désert', cat: 'nature', g: 'm',
  axes: [[['saguaro', 'Cactus saguaro', 'm'], ['raquette', 'Figuier de Barbarie', 'm'], ['dattier', 'Palmier dattier', 'm'], ['touffe', 'Touffe d’herbe sèche', 'f'], ['crane', 'Crâne de bovin', 'm'], ['epineux', 'Buisson d’épineux', 'm'], ['dune', 'Petite dune', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'b'], mat: () => 'vegetal', opts: ([t]) => ({ solid: ['saguaro', 'dattier'].includes(t[0]) }),
  build: ([t]) => (P) => {
    const R = P.R, cg = 0x4a7a3a;
    switch (t[0]) {
      case 'saguaro': P.c(0.25, 4, 0, 2, 0, 'foliage', cg, 0, 0, 0, 12); P.s(0.25, 0, 4, 0, 'foliage', cg, 1, 1, 1, 12); for (const s of [-1, 1]) { P.c(0.16, 0.6, s * 0.45, 1.8, 0, 'foliage', cg, 0, 0, Math.PI / 2, 10); P.c(0.16, 1.2, s * 0.75, 2.4, 0, 'foliage', cg, 0, 0, 0, 10); P.s(0.16, s * 0.75, 3.0, 0, 'foliage', cg, 1, 1, 1, 10); } break;
      case 'raquette': for (let i = 0; i < 7; i++) P.s(0.25, rr(R, -0.4, 0.4), rr(R, 0.3, 1.0), rr(R, -0.15, 0.15), 'foliage', cg, 1, 1.3, 0.25, 10); break;
      case 'dattier': { const H = 7; for (let i = 0; i < 14; i++) P.c(0.22 - i * 0.004, H / 14, Math.sin(i * 0.25) * 0.15, (i + 0.5) * (H / 14), 0, 'bark', 0x6a5a40, 0, 0, 0, 10); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; card(P, 'fern', 0x4a7a3a, 0.7, 2.6, Math.cos(a) * 1.1, H - 0.2, Math.sin(a) * 1.1, -a + Math.PI / 2, 1.2); } for (let i = 0; i < 6; i++) P.s(0.08, rr(R, -0.3, 0.3), H - 0.5, rr(R, -0.3, 0.3), 'plastic', 0x8a4a1a, 1, 1.3, 1, 6); break; }
      case 'touffe': for (let i = 0; i < 12; i++) card(P, 'fern', 0xb8a060, 0.3, rr(R, 0.3, 0.6), rr(R, -0.3, 0.3), 0.2, rr(R, -0.3, 0.3), R() * 3, rr(R, -0.3, 0.3)); break;
      case 'crane': P.s(0.18, 0, 0.15, 0, 'stone', 0xe0d8c4, 1.2, 0.8, 1.6, 10); P.b(0.12, 0.1, 0.25, 0, 0.1, 0.3, 'stone', 0xe0d8c4); for (const s of [-1, 1]) cylBetween(P, 'stone', 0xd8d0bc, [s * 0.2, 0.22, -0.05], [s * 0.6, 0.45, -0.15], 0.05, 0.015, 6); break;
      case 'epineux': for (let i = 0; i < 18; i++) { const a = R() * TAU, l = rr(R, 0.4, 0.9); cylBetween(P, 'bark', 0x6a5a40, [0, 0, 0], [Math.cos(a) * l, l * 0.7, Math.sin(a) * l], 0.015, 0.004, 5); } break;
      default: P.s(2.5, 0, 0, 0, 'tex:gx_kh_dune', 0xffffff, 1.6, 0.35, 1.2, 16);
    }
  },
});

/* ================================================================= éclairage */
mdFam({
  key: 'lmp', famName: 'Lampes et lustres', cat: 'eclairage', g: 'f',
  axes: [[['bureau', 'Lampe de bureau', 'f'], ['chevet', 'Lampe de chevet', 'f'], ['pied', 'Lampadaire à abat-jour', 'm'], ['petrole', 'Lampe à pétrole', 'f'], ['chantier', 'Baladeuse de chantier', 'f'], ['pampilles', 'Lustre à pampilles', 'm'],
    ['industriel', 'Suspension industrielle', 'f'], ['applique', 'Applique à abat-jour', 'f'], ['ampoule', 'Ampoule nue suspendue', 'f'], ['guirlande', 'Guirlande lumineuse', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'e', 'c'], mat: () => 'lumiere',
  opts: ([t]) => ({ solid: t[0] === 'pied', wall: t[0] === 'applique' }),
  build: ([t]) => (P) => {
    const R = P.R, warm = 0xffe0a0;
    switch (t[0]) {
      case 'bureau': P.c(0.09, 0.02, 0, 0.01, 0, 'metal', 0x2a4a3a, 0, 0, 0, 14); boxBetween(P, 'metal', 0xb09040, [0, 0.02, 0], [0.05, 0.3, 0], 0.015); boxBetween(P, 'metal', 0xb09040, [0.05, 0.3, 0], [0.15, 0.4, 0], 0.015); P.t(0.05, 0.11, 0.12, 0.18, 0.37, 0, 'metal', 0x2a4a3a, 0, 0, 0.6, 12); P.s(0.035, 0.2, 0.33, 0, 'glow', warm, 1, 1, 1, 8); break;
      case 'chevet': P.s(0.08, 0, 0.1, 0, 'plastic', 0xd8c8a8, 1, 1.2, 1, 12); P.c(0.012, 0.15, 0, 0.25, 0, 'metal', 0xb09040); P.t(0.09, 0.14, 0.16, 0, 0.36, 0, 'glow', 0xf0e0c0, 0, 0, 0, 14); break;
      case 'pied': P.c(0.15, 0.03, 0, 0.015, 0, 'metal', 0x2a2a2a, 0, 0, 0, 14); P.c(0.015, 1.5, 0, 0.77, 0, 'metal', 0xb09040); P.t(0.16, 0.25, 0.3, 0, 1.55, 0, 'glow', 0xf0dcb0, 0, 0, 0, 16); break;
      case 'petrole': P.c(0.07, 0.02, 0, 0.01, 0, 'metal', 0xb09040, 0, 0, 0, 12); P.s(0.07, 0, 0.1, 0, 'glass', 0xa8c0b8, 1, 0.9, 1, 12); P.c(0.04, 0.16, 0, 0.26, 0, 'glass', 0xe8e0d0, 0, 0, 0, 12); P.s(0.02, 0, 0.22, 0, 'glow', 0xffb050, 1, 1.5, 1, 8); P.o(0.05, 0.006, 0, 0.36, 0, 'metal', 0xb09040, Math.PI / 2, 0, 0); break;
      case 'chantier': P.o(0.06, 0.008, 0, 0.12, 0, 'metal', 0x2a2a2a, 0, 0, 0); P.o(0.06, 0.008, 0, 0.12, 0, 'metal', 0x2a2a2a, 0, Math.PI / 2, 0); P.s(0.04, 0, 0.12, 0, 'glow', warm, 1, 1.2, 1, 8); P.c(0.02, 0.1, 0, 0.24, 0, 'rubber', 0x1a1a1a); P.c(0.005, 1.6, 0.4, 0.01, 0, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 4); break;
      case 'pampilles': P.c(0.01, 0.5, 0, 2.75, 0, 'metal', 0xb09040); P.o(0.35, 0.02, 0, 2.4, 0, 'metal', 0xb09040, Math.PI / 2, 0, 0); P.o(0.2, 0.015, 0, 2.3, 0, 'metal', 0xb09040, Math.PI / 2, 0, 0); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; P.c(0.012, 0.08, Math.cos(a) * 0.35, 2.46, Math.sin(a) * 0.35, 'glow', 0xfff0d0, 0, 0, 0, 6); for (let k = 0; k < 3; k++) P.s(0.012, Math.cos(a + 0.2) * (0.28 - k * 0.04), 2.32 - k * 0.06, Math.sin(a + 0.2) * (0.28 - k * 0.04), 'glass', 0xe8f0f4, 1, 1.5, 1, 6); } break;
      case 'industriel': P.c(0.006, 0.8, 0, 2.6, 0, 'metal', 0x2a2a2a); P.t(0.06, 0.3, 0.2, 0, 2.1, 0, 'metal', 0x3a5a4a, 0, 0, 0, 16); P.s(0.07, 0, 2.0, 0, 'glow', warm, 1, 0.8, 1, 10); break;
      case 'applique': P.b(0.1, 0.16, 0.03, 0, 1.8, 0.015, 'metal', 0xb09040); boxBetween(P, 'metal', 0xb09040, [0, 1.8, 0.02], [0, 1.88, 0.18], 0.012); P.t(0.06, 0.1, 0.13, 0, 1.94, 0.18, 'glow', 0xf0dcb0, 0, 0, 0, 12); break;
      case 'ampoule': P.c(0.004, 1.0, 0, 2.5, 0, 'rubber', 0x1a1a1a); P.c(0.02, 0.04, 0, 1.98, 0, 'metal', 0x6a6a6a, 0, 0, 0, 8); P.s(0.04, 0, 1.92, 0, 'glow', warm, 1, 1.3, 1, 10); break;
      default: for (let i = 0; i < 12; i++) { const x = -2.2 + i * 0.4, y = 2.4 - Math.sin((i / 11) * Math.PI) * 0.35; P.s(0.03, x, y - 0.04, 0, 'glow', pk(R, [0xff5040, 0x50ff70, 0x5080ff, 0xffd050]), 1, 1.3, 1, 6); if (i < 11) boxBetween(P, 'rubber', 0x1a2a1a, [x, y, 0], [x + 0.4, 2.4 - Math.sin(((i + 1) / 11) * Math.PI) * 0.35, 0], 0.006); }
    }
  },
});
mdFam({
  key: 'feu2', famName: 'Bougies, torches et feux', cat: 'eclairage', g: 'f',
  axes: [[['bougie', 'Bougie', 'f'], ['bougeoir', 'Bougeoir à trois branches', 'm'], ['candelabre', 'Candélabre', 'm'], ['brasero', 'Brasero', 'm'], ['torche', 'Torche murale', 'f'], ['lanterne', 'Lanterne de tempête', 'f'], ['cercle', 'Cercle de bougies', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'e'], mat: () => 'lumiere', opts: ([t]) => ({ solid: t[0] === 'candelabre' || t[0] === 'brasero', wall: t[0] === 'torche' }),
  build: ([t]) => (P) => {
    const R = P.R, flame = (x, y, z, k = 1) => P.s(0.018 * k, x, y, z, 'glow', 0xffb040, 1, 2, 1, 6), candle = (x, y, z, h) => { P.c(0.02, h, x, y + h / 2, z, 'plastic', 0xe8e0c8, 0, 0, 0, 8); flame(x, y + h + 0.03, z); };
    switch (t[0]) {
      case 'bougie': candle(0, 0, 0, 0.15); P.c(0.05, 0.01, 0, 0.005, 0, 'plastic', 0xe8e0c8, 0, 0, 0, 10); break;
      case 'bougeoir': P.c(0.08, 0.02, 0, 0.01, 0, 'metal', 0xb09040, 0, 0, 0, 12); P.c(0.012, 0.25, 0, 0.14, 0, 'metal', 0xb09040); P.o(0.1, 0.01, 0, 0.27, 0, 'metal', 0xb09040, 0, 0, 0); for (const x of [-0.1, 0, 0.1]) candle(x, 0.28, 0, 0.12); break;
      case 'candelabre': P.c(0.18, 0.04, 0, 0.02, 0, 'metal', 0x1e1e1e, 0, 0, 0, 12); P.c(0.02, 1.5, 0, 0.77, 0, 'metal', 0x1e1e1e); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, x = Math.cos(a) * 0.2, z = Math.sin(a) * 0.2; boxBetween(P, 'metal', 0x1e1e1e, [0, 1.4, 0], [x, 1.5, z], 0.012); candle(x, 1.5, z, 0.18); } break;
      case 'brasero': for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; boxBetween(P, 'metal', 0x2a2a2a, [Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35], [Math.cos(a) * 0.2, 0.7, Math.sin(a) * 0.2], 0.03); } P.t(0.35, 0.2, 0.3, 0, 0.82, 0, 'metal', 0x2a2a2a, 0, 0, 0, 14); for (let i = 0; i < 6; i++) P.s(rr(R, 0.06, 0.12), rr(R, -0.15, 0.15), 1.0 + rr(R, 0, 0.15), rr(R, -0.15, 0.15), 'glow', pk(R, [0xff8020, 0xffb040, 0xff5010]), 1, 1.6, 1, 8); break;
      case 'torche': P.b(0.08, 0.2, 0.05, 0, 1.6, 0.025, 'metal', 0x2a2a2a); boxBetween(P, 'wood', 0x5a3a24, [0, 1.55, 0.05], [0, 1.95, 0.2], 0.04); P.s(0.07, 0, 2.05, 0.23, 'glow', 0xff9030, 1, 1.8, 1, 8); break;
      case 'lanterne': P.c(0.09, 0.03, 0, 0.015, 0, 'metal', 0xa02020, 0, 0, 0, 12); P.c(0.07, 0.18, 0, 0.12, 0, 'glass', 0xd0d8c0, 0, 0, 0, 12); P.s(0.03, 0, 0.12, 0, 'glow', 0xffc060, 1, 1.4, 1, 8); P.t(0.03, 0.09, 0.06, 0, 0.24, 0, 'metal', 0xa02020, 0, 0, 0, 12); P.o(0.07, 0.006, 0, 0.32, 0, 'metal', 0x2a2a2a, 0, 0, 0); break;
      default: for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; candle(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, rr(R, 0.08, 0.2)); } P.p(1.4, 1.4, 0, 0.004, 0, 'decal:decal_blood_pool', 0xffffff, 0, 0, 0);
    }
  },
});
mdFam({
  key: 'proj', famName: 'Projecteurs et signaux', cat: 'eclairage', g: 'm',
  axes: [[['chantier', 'Projecteur de chantier double', 'm'], ['stade', 'Mât de projecteurs', 'm'], ['gyro', 'Gyrophare', 'm'], ['mineur', 'Lampe de mineur', 'f'], ['sortie', 'Panneau de sortie de secours', 'm'], ['pharmacie', 'Croix de pharmacie', 'f'], ['enseigne', 'Enseigne lumineuse', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'e', 'c'], mat: () => 'lumiere', opts: ([t]) => ({ solid: t[0] === 'chantier' || t[0] === 'stade', wall: ['sortie', 'pharmacie', 'enseigne'].includes(t[0]) }),
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'chantier': for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; boxBetween(P, 'metal', 0xd8a020, [0, 1.5, 0], [Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6], 0.03); } P.b(0.9, 0.05, 0.05, 0, 1.55, 0, 'metal', 0xd8a020); for (const x of [-0.3, 0.3]) { P.b(0.35, 0.28, 0.15, x, 1.7, 0.05, 'metal', 0x2a2a2a, -0.2, 0, 0); P.b(0.3, 0.22, 0.02, x, 1.7, 0.13, 'glow', 0xfff4d8, -0.2, 0, 0); } break;
      case 'stade': P.c(0.15, 12, 0, 6, 0, 'metal', 0x8a8e8e); P.b(2.4, 1.6, 0.2, 0, 12.4, 0, 'metal', 0x5a5e5e, -0.3, 0, 0); for (let i = 0; i < 6; i++) P.c(0.28, 0.06, -0.8 + (i % 3) * 0.8, 12.0 + Math.floor(i / 3) * 0.75, 0.15, 'glow', 0xf8f8ff, Math.PI / 2 - 0.3, 0, 0, 14); break;
      case 'gyro': P.c(0.1, 0.05, 0, 0.025, 0, 'metal', 0x2a2a2a, 0, 0, 0, 12); P.c(0.08, 0.15, 0, 0.12, 0, 'glow', 0xff8020, 0, 0, 0, 12); P.s(0.08, 0, 0.2, 0, 'glow', 0xff8020, 1, 0.6, 1, 10); break;
      case 'mineur': P.c(0.06, 0.12, 0, 0.06, 0, 'metal', 0x6a6a5a, 0, 0, 0, 12); P.c(0.05, 0.1, 0, 0.17, 0, 'glass', 0xe0d8c0, 0, 0, 0, 12); P.s(0.02, 0, 0.17, 0, 'glow', 0xffc060, 1, 1.5, 1, 6); P.t(0.02, 0.05, 0.06, 0, 0.25, 0, 'metal', 0x6a6a5a, 0, 0, 0, 10); P.o(0.04, 0.005, 0, 0.3, 0, 'metal', 0x2a2a2a, 0, 0, 0); break;
      case 'sortie': P.b(0.4, 0.2, 0.08, 0, 2.3, 0.04, 'plastic', 0xe8e8e0); P.b(0.36, 0.16, 0.082, 0, 2.3, 0.041, 'glow', 0x30d060); P.b(0.06, 0.12, 0.084, -0.1, 2.3, 0.042, 'glow', 0xf0fff0); P._add('cyl:1:3', mtx(0.08, 2.3, 0.043, Math.PI / 2, 0, -Math.PI / 2, 0.06, 0.084, 0.06), 'glow', 0xf0fff0); break;
      case 'pharmacie': P.b(0.08, 0.5, 0.06, 0, 2.6, 0.2, 'metal', 0x6a6a6a); P.b(0.6, 0.2, 0.08, 0, 2.6, 0.3, 'glow', 0x30e060); P.b(0.2, 0.6, 0.08, 0, 2.6, 0.3, 'glow', 0x30e060); boxBetween(P, 'metal', 0x6a6a6a, [0, 2.6, 0], [0, 2.6, 0.25], 0.04); break;
      default: P.b(1.6, 0.5, 0.15, 0, 2.6, 0.08, 'metal', 0x2a2a2a); P.b(1.5, 0.4, 0.152, 0, 2.6, 0.081, 'glow', 0xff3060); for (let i = 0; i < 4; i++) P.b(0.22, 0.26, 0.154, -0.5 + i * 0.33, 2.6, 0.083, 'plastic', 0x3a0a14);
    }
  },
});

/* =================================================================== horreur */
mdFam({
  key: 'tomb', famName: 'Tombes', cat: 'horreur', g: 'f',
  axes: [[['arrondie', 'Stèle arrondie', 'f'], ['croix', 'Croix de pierre', 'f'], ['dalle', 'Dalle funéraire', 'f'], ['obelisque', 'Obélisque funéraire', 'm'], ['caveau', 'Caveau', 'm']], [['gris', 'en granit gris', 0x8a8680], ['blanc', 'en marbre blanc', 0xd8d4cc], ['sombre', 'en pierre sombre', 0x4e4c4a]]],
  nm: ([t, c]) => `${t[1]} ${c[1]}`, gp: ([t]) => [t[2], false], states: ['n', 'pe', 'c', 'm'], mat: () => 'pierre',
  build: ([t, c]) => (P) => {
    const col = c[2];
    switch (t[0]) {
      case 'arrondie': P.b(0.6, 0.12, 0.3, 0, 0.06, 0, 'stone', mdShade(col, 0.85)); P.b(0.5, 0.75, 0.12, 0, 0.5, 0, 'stone', col); P.c(0.25, 0.12, 0, 0.875, 0, 'stone', col, Math.PI / 2, 0, 0, 16); P.b(0.3, 0.02, 0.005, 0, 0.7, 0.062, 'paint', mdShade(col, 0.6)); break;
      case 'croix': P.b(0.5, 0.25, 0.4, 0, 0.125, 0, 'stone', mdShade(col, 0.85)); P.b(0.12, 1.2, 0.12, 0, 0.85, 0, 'stone', col); P.b(0.6, 0.12, 0.12, 0, 1.15, 0, 'stone', col); break;
      case 'dalle': P.b(0.9, 0.25, 2.0, 0, 0.125, 0, 'stone', col); P.b(0.8, 0.05, 1.9, 0, 0.27, 0, 'stone', mdShade(col, 1.05)); P.b(0.5, 0.8, 0.12, 0, 0.6, -0.95, 'stone', col); break;
      case 'obelisque': P.b(0.7, 0.3, 0.7, 0, 0.15, 0, 'stone', mdShade(col, 0.85)); P.t(0.15, 0.25, 1.8, 0, 1.2, 0, 'stone', col, 0, Math.PI / 4, 0, 4); P.t(0.0, 0.15, 0.25, 0, 2.22, 0, 'stone', col, 0, Math.PI / 4, 0, 4); break;
      default: P.b(2.0, 2.4, 2.4, 0, 1.2, 0, 'stone', col); gable(P, 'stone', mdShade(col, 0.9), 0, 2.4, 0, 2.6, 0.8, 2.6, Math.PI / 2); P.b(0.9, 1.8, 0.05, 0, 0.9, 1.21, 'metal', 0x2a2a2a); P.b(0.3, 0.6, 0.12, 0, 3.0, 1.15, 'stone', col); P.b(0.6, 0.12, 0.12, 0, 3.1, 1.15, 'stone', col);
    }
  },
});
mdFam({
  key: 'cerc', famName: 'Cercueils et sarcophages', cat: 'horreur', g: 'm',
  axes: [[['ferme', 'Cercueil fermé', 'm'], ['ouvert', 'Cercueil ouvert', 'm'], ['squelette', 'Cercueil ouvert et son squelette', 'm'], ['pin', 'Cercueil en pin brut', 'm'], ['pierre', 'Sarcophage de pierre', 'm']]],
  nm: ([t]) => t[1], states: ['n', 'u', 'g'], mat: ([t]) => (t[0] === 'pierre' ? 'pierre' : 'bois'),
  build: ([t]) => (P) => {
    if (t[0] === 'pierre') { P.b(0.9, 0.7, 2.2, 0, 0.35, 0, 'stone', 0x8a8680); P.b(1.0, 0.15, 2.3, 0, 0.77, 0, 'stone', 0x7a7670); P.b(0.5, 0.06, 1.4, 0, 0.87, 0, 'stone', 0x6a6660); return; }
    const c = t[0] === 'pin' ? 0xb08a5c : 0x4a2a1a, lid = () => P.b(0.7, 0.08, 2.0, 0, 0.6, 0, 'wood', mdShade(c, 1.1));
    P.b(0.62, 0.5, 1.9, 0, 0.3, 0, 'wood', c); P.b(0.7, 0.06, 2.0, 0, 0.03, 0, 'wood', mdShade(c, 0.8));
    for (const s of [-1, 1]) for (const z of [-0.6, 0, 0.6]) P.b(0.02, 0.04, 0.12, s * 0.33, 0.35, z, 'metal', 0xb09040);
    if (t[0] === 'ferme' || t[0] === 'pin') { lid(); P.b(0.06, 0.012, 0.4, 0, 0.645, -0.3, 'metal', 0xb09040); P.b(0.25, 0.012, 0.06, 0, 0.645, -0.4, 'metal', 0xb09040); return; }
    P.b(0.56, 0.02, 1.84, 0, 0.5, 0, 'fabric', 0xd8d0c0); P.b(0.7, 0.08, 2.0, 0.55, 0.3, 0.1, 'wood', mdShade(c, 1.1), 0, 0.1, -1.2);
    if (t[0] === 'squelette') { P.s(0.09, 0, 0.6, -0.72, 'stone', 0xe0d8c4, 0.9, 1, 1.1, 10); P.b(0.3, 0.08, 0.5, 0, 0.56, -0.3, 'stone', 0xe0d8c4); for (const s of [-1, 1]) { P.b(0.04, 0.04, 0.7, s * 0.08, 0.55, 0.4, 'stone', 0xe0d8c4); P.b(0.03, 0.03, 0.5, s * 0.2, 0.55, -0.15, 'stone', 0xe0d8c4); } }
  },
});
mdFam({
  key: 'rest', famName: 'Restes humains', cat: 'horreur', g: 'm', o: { solid: false },
  axes: [[['drap', 'Corps sous un drap', 'm'], ['appuye', 'Squelette appuyé', 'm'], ['cranes', 'Tas de crânes', 'm'], ['housse', 'Housse mortuaire ouverte', 'f'], ['cage', 'Cage et son squelette', 'f'], ['os', 'Ossements épars', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'os'], states: ['n', 'g'], mat: () => 'organique', opts: ([t]) => ({ solid: t[0] === 'cage' }),
  build: ([t]) => (P) => {
    const R = P.R, bone = 0xe0d8c4, skull = (x, y, z, ry = 0) => { P.s(0.09, x, y, z, 'stone', bone, 0.9, 1, 1.1, 10); P.b(0.1, 0.05, 0.08, x + Math.sin(ry) * 0.05, y - 0.07, z + Math.cos(ry) * 0.05, 'stone', bone, 0, ry, 0); for (const s of [-1, 1]) P.s(0.022, x + Math.cos(ry) * s * 0.035 + Math.sin(ry) * 0.08, y, z - Math.sin(ry) * s * 0.035 + Math.cos(ry) * 0.08, 'paint', 0x1a1410, 1, 1, 0.5, 6); };
    switch (t[0]) {
      case 'drap': P.b(0.5, 0.18, 1.7, 0, 0.09, 0, 'skin', 0x8a8a7a); P.s(0.13, 0, 0.14, -0.85, 'skin', 0x8a8a7a, 1, 0.8, 1, 10); P.b(0.7, 0.04, 1.9, 0, 0.2, 0, 'fabric', 0xd8d4c8, 0, 0, 0.03); P.s(0.17, 0, 0.2, -0.9, 'fabric', 0xd8d4c8, 1.4, 0.7, 1, 10); for (const z of [0.6, 0.65]) P.s(0.07, z === 0.6 ? 0.12 : -0.12, 0.2, 0.9, 'fabric', 0xd8d4c8, 1, 1.2, 1, 8); break;
      case 'appuye': skull(0, 0.85, 0.05); P.b(0.3, 0.4, 0.15, 0, 0.55, 0, 'stone', bone, -0.2, 0, 0); for (let i = 0; i < 6; i++) P.o(0.12, 0.01, 0, 0.45 + i * 0.05, 0.02, 'stone', bone, Math.PI / 2, 0, 0); for (const s of [-1, 1]) { boxBetween(P, 'stone', bone, [s * 0.1, 0.32, 0.05], [s * 0.15, 0.12, 0.45], 0.04); boxBetween(P, 'stone', bone, [s * 0.15, 0.12, 0.45], [s * 0.15, 0.03, 0.85], 0.035); boxBetween(P, 'stone', bone, [s * 0.18, 0.7, 0], [s * 0.25, 0.3, 0.2], 0.03); } break;
      case 'cranes': for (let i = 0; i < 12; i++) skull(rr(R, -0.35, 0.35), 0.09 + (i > 7 ? 0.16 : 0) + (i > 10 ? 0.14 : 0), rr(R, -0.3, 0.3), R() * TAU); break;
      case 'housse': P.b(0.6, 0.12, 1.9, 0, 0.06, 0, 'plastic', 0x1a1a1c); P.b(0.62, 0.02, 0.9, 0.35, 0.14, -0.4, 'plastic', 0x1a1a1c, 0, 0, -1.1); P.s(0.1, 0, 0.18, -0.7, 'skin', 0x8a9a7a, 0.9, 0.8, 1, 10); P.b(0.3, 0.08, 0.5, 0, 0.15, -0.35, 'fabric', 0x4a3a3a); break;
      case 'cage': for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; P.c(0.012, 1.8, Math.cos(a) * 0.5, 0.9, Math.sin(a) * 0.5, 'metal', 0x2a2a2a, 0, 0, 0, 6); } for (const y of [0.05, 1.8]) P.o(0.5, 0.025, 0, y, 0, 'metal', 0x2a2a2a, Math.PI / 2, 0, 0); P.c(0.5, 0.03, 0, 0.02, 0, 'metal', 0x2a2a2a, 0, 0, 0, 16); skull(0, 0.6, 0); P.b(0.25, 0.3, 0.12, 0, 0.3, 0, 'stone', bone); break;
      default: for (let i = 0; i < 10; i++) P.c(0.025, rr(R, 0.25, 0.45), rr(R, -0.6, 0.6), 0.03, rr(R, -0.6, 0.6), 'stone', bone, Math.PI / 2, R() * 3, 0, 6); skull(rr(R, -0.3, 0.3), 0.09, rr(R, -0.3, 0.3), R() * TAU);
    }
  },
});
mdFam({
  key: 'occ', famName: 'Rituels et boucherie', cat: 'horreur', g: 'm',
  axes: [[['autel', 'Autel de pierre', 'm'], ['pique', 'Crâne sur une pique', 'm'], ['totem', 'Totem d’ossements', 'm'], ['chaudron', 'Chaudron', 'm'], ['crochets', 'Crochets à viande garnis', 'm'], ['billot', 'Billot de boucher', 'm'], ['table', 'Table de dissection', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'crochets'], states: ['n', 'g'], mat: ([t]) => (t[0] === 'autel' ? 'pierre' : t[0] === 'billot' ? 'bois' : 'metal'),
  build: ([t]) => (P) => {
    const R = P.R, bone = 0xe0d8c4;
    switch (t[0]) {
      case 'autel': P.b(2.0, 0.9, 1.0, 0, 0.45, 0, 'stone', 0x6a6660); P.b(2.2, 0.12, 1.2, 0, 0.96, 0, 'stone', 0x5a5650); for (const x of [-0.8, 0.8]) { P.c(0.02, 0.2, x, 1.12, 0.3, 'plastic', 0xe8e0c8, 0, 0, 0, 8); P.s(0.02, x, 1.25, 0.3, 'glow', 0xffb040, 1, 2, 1, 6); } break;
      case 'pique': P.c(0.025, 1.8, 0, 0.9, 0, 'wood', 0x5a4a3a); P.s(0.1, 0, 1.85, 0, 'stone', bone, 0.9, 1, 1.1, 10); P.b(0.11, 0.05, 0.08, 0, 1.77, 0.05, 'stone', bone); break;
      case 'totem': P.c(0.05, 2.2, 0, 1.1, 0, 'wood', 0x5a4a3a); for (let i = 0; i < 4; i++) P.s(0.1, 0, 0.9 + i * 0.32, 0.05, 'stone', bone, 0.9, 1, 1.1, 10); boxBetween(P, 'stone', bone, [-0.5, 2.0, 0], [0.5, 2.1, 0], 0.04); for (let i = 0; i < 6; i++) P.c(0.003, 0.4, rr(R, -0.45, 0.45), 1.8, 0, 'fabric', 0x3a2a1a); break;
      case 'chaudron': for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; P.b(0.05, 0.3, 0.05, Math.cos(a) * 0.35, 0.15, Math.sin(a) * 0.35, 'metal', 0x1a1a1a); } P.s(0.45, 0, 0.6, 0, 'metal', 0x1e1e1e, 1, 0.8, 1, 16); P.c(0.38, 0.02, 0, 0.85, 0, 'glow', 0x6aff40, 0, 0, 0, 16); P.o(0.4, 0.03, 0, 0.88, 0, 'metal', 0x1a1a1a, Math.PI / 2, 0, 0); break;
      case 'crochets': P.b(3, 0.08, 0.08, 0, 2.6, 0, 'metal', 0x6a6a6a); for (const x of [-1.4, 1.4]) P.b(0.08, 2.6, 0.08, x, 1.3, 0, 'metal', 0x6a6a6a); for (let i = 0; i < 4; i++) { const x = -1.0 + i * 0.66; P.c(0.008, 0.25, x, 2.45, 0, 'metal', 0xb0b2b4); P.s(0.2, x, 1.95, 0, 'skin', 0x8a3a34, 0.9, 2.2, 0.6, 10); } break;
      case 'billot': P.c(0.35, 0.85, 0, 0.425, 0, 'wood', 0x7a5a3a, 0, 0, 0, 14); P.c(0.34, 0.01, 0, 0.855, 0, 'wood', 0x5a3a24, 0, 0, 0, 14); P.b(0.3, 0.08, 0.02, 0.05, 0.92, 0, 'metal', 0xb0b2b4, 0, 0, 0.5); P.c(0.015, 0.2, 0.2, 1.0, 0, 'wood', 0x3a2414, 0, 0, 0.5); break;
      default: P.b(2.0, 0.08, 0.8, 0, 0.9, 0, 'metal', 0xb0b2b4); P.b(1.9, 0.02, 0.7, 0, 0.95, 0, 'metal', 0x9a9c9e); P.c(0.08, 0.86, 0, 0.43, 0, 'metal', 0x8a8c8e); P.c(0.3, 0.04, 0, 0.02, 0, 'metal', 0x6a6c6e, 0, 0, 0, 14); for (let i = 0; i < 4; i++) P.b(0.15, 0.01, 0.03, -0.6 + i * 0.15, 0.97, 0.3, 'metal', 0xd0d2d4);
    }
  },
});
mdFam({
  key: 'deb', famName: 'Débris', cat: 'horreur', g: 'm', o: { solid: false },
  axes: [[['planches', 'Planches cassées', 'f'], ['toles', 'Tôles tordues', 'f'], ['verre', 'Éclats de verre', 'm'], ['papiers', 'Papiers épars', 'm'], ['pneus', 'Pneus brûlés', 'm'], ['matelas', 'Vieux matelas', 'm'], ['meubles', 'Meubles brisés', 'm'], ['parpaings', 'Parpaings éboulés', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] !== 'matelas'], states: ['n', 'b'], mat: ([t]) => ({ planches: 'bois', meubles: 'bois', toles: 'metal', verre: 'verre', papiers: 'papier', pneus: 'plastique', matelas: 'tissu', parpaings: 'pierre' })[t[0]],
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'planches': for (let i = 0; i < 8; i++) P.b(0.14, 0.025, rr(R, 0.4, 1.4), rr(R, -0.7, 0.7), 0.015 + i * 0.012, rr(R, -0.6, 0.6), 'wood', pk(R, [0x8a6a48, 0x7a5a3a, 0x9a7a58]), 0, R() * 3, 0); break;
      case 'toles': for (let i = 0; i < 4; i++) P.b(rr(R, 0.6, 1.2), 0.01, rr(R, 0.5, 0.9), rr(R, -0.5, 0.5), 0.05 + i * 0.03, rr(R, -0.4, 0.4), 'rust', 0xffffff, rr(R, -0.3, 0.3), R() * 3, rr(R, -0.3, 0.3)); break;
      case 'verre': for (let i = 0; i < 16; i++) P.b(rr(R, 0.03, 0.12), 0.004, rr(R, 0.03, 0.12), rr(R, -0.6, 0.6), 0.004, rr(R, -0.6, 0.6), 'glass', 0xc8d8dc, 0, R() * 3, 0); break;
      case 'papiers': for (let i = 0; i < 14; i++) P.b(0.21, 0.002, 0.29, rr(R, -0.8, 0.8), 0.003 + i * 0.001, rr(R, -0.8, 0.8), 'paper', pk(R, [0xf0ece0, 0xe8e0c8, 0xd8d0b8]), 0, R() * 3, 0); break;
      case 'pneus': for (let i = 0; i < 4; i++) P.o(0.3, 0.11, rr(R, -0.5, 0.5), 0.11 + (i > 1 ? 0.2 : 0), rr(R, -0.4, 0.4), 'rubber', 0x141414, Math.PI / 2 + rr(R, -0.2, 0.2), 0, rr(R, -0.2, 0.2)); break;
      case 'matelas': P.b(0.9, 0.18, 1.9, 0, 0.09, 0, 'fabric', 0xb8ac90, 0, 0.2, 0.05); for (let i = 0; i < 4; i++) P.s(0.15, rr(R, -0.3, 0.3), 0.18, rr(R, -0.7, 0.7), 'fabric', 0x6a5a3a, 1, 0.15, 1.3, 8); break;
      case 'meubles': P.b(0.45, 0.04, 0.45, -0.4, 0.3, 0.2, 'wood', 0x8a6a48, 0.3, 0.4, 0.8); P.b(1.0, 0.04, 0.6, 0.3, 0.2, -0.1, 'wood', 0x6e4a30, 0, 0.6, 0.35); for (let i = 0; i < 4; i++) P.b(0.05, rr(R, 0.3, 0.7), 0.05, rr(R, -0.7, 0.7), 0.03, rr(R, -0.6, 0.6), 'wood', 0x5a3e28, Math.PI / 2, R() * 3, 0); break;
      default: for (let i = 0; i < 9; i++) P.b(0.4, 0.2, 0.2, rr(R, -0.7, 0.7), 0.1 + (i > 5 ? 0.2 : 0), rr(R, -0.6, 0.6), 'concrete', 0x9a9890, rr(R, -0.3, 0.3), R() * 3, rr(R, -0.3, 0.3));
    }
  },
});

/* ========================================================== Antiquité & Égypte */
const MD_ANTSTONE = [['marbre', 'en marbre blanc', 0xe0dcd2], ['calcaire', 'en calcaire', 0xd2c4a2], ['gres', 'en grès rose', 0xc49a84], ['granit', 'en granit rose', 0xa87a6a]];
mdFam({
  key: 'col', famName: 'Colonnes antiques', cat: 'antique', g: 'f',
  axes: [[['dorique', 'Colonne dorique', 'f'], ['ionique', 'Colonne ionique', 'f'], ['papyrus', 'Colonne égyptienne', 'f'], ['brisee', 'Colonne brisée', 'f'], ['troncons', 'Tronçons de colonne', 'm']], MD_ANTSTONE],
  nm: ([t, m]) => `${t[1]} ${m[1]}`, gp: ([t]) => [t[2], t[0] === 'troncons'], states: ['n', 'm', 'c'], mat: () => 'pierre',
  build: ([t, m]) => (P) => {
    const c = m[2], R = P.R;
    if (t[0] === 'troncons') { for (let i = 0; i < 3; i++) P.c(0.38, rr(R, 0.6, 1.0), rr(R, -1.2, 1.2), 0.38, rr(R, -0.8, 0.8), 'stone', c, Math.PI / 2, R() * 3, 0, 16); return; }
    const H = t[0] === 'brisee' ? 2.2 : 4.5;
    P.b(1.0, 0.25, 1.0, 0, 0.125, 0, 'stone', mdShade(c, 0.9));
    if (t[0] === 'papyrus') { P.t(0.4, 0.5, H - 0.8, 0, 0.25 + (H - 0.8) / 2, 0, 'stone', c, 0, 0, 0, 16); P.t(0.75, 0.42, 0.6, 0, H - 0.25, 0, 'stone', c, 0, 0, 0, 16); P.b(1.0, 0.2, 1.0, 0, H + 0.1, 0, 'stone', mdShade(c, 0.9)); for (let i = 0; i < 4; i++) P.b(0.02, 0.4, 0.02, Math.cos(i * 1.57) * 0.47, 1.0, Math.sin(i * 1.57) * 0.47, 'paint', 0x3a6a8a); return; }
    P.c(0.4, H - 0.55, 0, 0.25 + (H - 0.55) / 2, 0, 'stone', c, 0, 0, 0, 16);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; P.b(0.04, H - 0.6, 0.04, Math.cos(a) * 0.4, 0.25 + (H - 0.55) / 2, Math.sin(a) * 0.4, 'stone', mdShade(c, 0.92)); }
    if (t[0] === 'brisee') { for (let i = 0; i < 4; i++) P.b(rr(R, 0.15, 0.35), rr(R, 0.1, 0.25), rr(R, 0.15, 0.3), rr(R, -1, 1), 0.1, rr(R, 0.6, 1.4), 'stone', c, 0, R() * 3, rr(R, -0.3, 0.3)); return; }
    if (t[0] === 'ionique') { for (const s of [-1, 1]) P.c(0.12, 0.9, s * 0.4, H - 0.15, 0, 'stone', c, Math.PI / 2, 0, 0, 12); P.b(0.9, 0.12, 0.85, 0, H - 0.06, 0, 'stone', c); }
    else { P.t(0.55, 0.42, 0.18, 0, H - 0.21, 0, 'stone', c, 0, 0, 0, 16); P.b(1.0, 0.12, 1.0, 0, H - 0.06, 0, 'stone', c); }
  },
});
mdFam({
  key: 'egy', famName: 'Monuments égyptiens', cat: 'antique', g: 'm',
  axes: [[['obelisque', 'Obélisque', 'm'], ['petitob', 'Petit obélisque', 'm'], ['sphinx', 'Sphinx', 'm'], ['pharaon', 'Statue de pharaon assis', 'f'], ['anubis', 'Statue d’Anubis', 'f'], ['sarcophage', 'Sarcophage peint', 'm'], ['autel', 'Table d’offrandes', 'f']],
    [['calcaire', 'en calcaire', 0xd2c4a2], ['granit', 'en granit rose', 0xa87a6a], ['basalte', 'en basalte', 0x3e3c3e]]],
  nm: ([t, m]) => `${t[1]} ${m[1]}`, gp: ([t]) => [t[2], false], states: ['n', 'c', 'm'], mat: () => 'pierre',
  build: ([t, m]) => (P) => {
    const c = m[2], gold = 0xc8a040, blue = 0x2a4a8a;
    switch (t[0]) {
      case 'obelisque': case 'petitob': { const H = t[0] === 'obelisque' ? 8 : 3; P.b(H * 0.2, H * 0.06, H * 0.2, 0, H * 0.03, 0, 'stone', mdShade(c, 0.85)); P.t(H * 0.055, H * 0.08, H * 0.85, 0, H * 0.06 + H * 0.425, 0, 'stone', c, 0, Math.PI / 4, 0, 4); P.t(0, H * 0.055, H * 0.08, 0, H * 0.95, 0, 'metal', gold, 0, Math.PI / 4, 0, 4); break; }
      case 'sphinx': P.b(1.6, 0.4, 4.2, 0, 0.2, 0, 'stone', mdShade(c, 0.85)); P.b(1.2, 1.0, 2.6, 0, 0.9, -0.4, 'stone', c); for (const s of [-1, 1]) P.b(0.35, 0.35, 1.3, s * 0.4, 0.58, 1.4, 'stone', c); P.b(0.8, 1.2, 0.8, 0, 1.7, 0.95, 'stone', c); P.b(0.95, 0.8, 0.5, 0, 1.9, 0.75, 'stone', mdShade(c, 0.95)); P.b(0.5, 0.6, 0.4, 0, 1.75, 1.35, 'stone', c); break;
      case 'pharaon': P.b(1.0, 0.8, 1.2, 0, 0.4, 0, 'stone', mdShade(c, 0.9)); P.b(0.8, 0.9, 0.9, 0, 1.25, -0.15, 'stone', c); P.b(0.7, 0.55, 0.5, 0, 1.0, 0.45, 'stone', c); for (const s of [-1, 1]) P.b(0.2, 0.75, 0.25, s * 0.22, 0.38, 0.65, 'stone', c); P.b(0.5, 0.55, 0.5, 0, 2.0, -0.1, 'stone', c); P.b(0.75, 0.6, 0.35, 0, 1.95, -0.2, 'stone', mdShade(c, 0.95)); P.b(0.1, 0.3, 0.08, 0, 1.65, 0.2, 'stone', c); break;
      case 'anubis': P.b(0.8, 0.3, 0.8, 0, 0.15, 0, 'stone', mdShade(c, 0.85)); P.b(0.5, 1.4, 0.35, 0, 1.0, 0, 'stone', c); P.b(0.2, 0.6, 0.3, 0, 1.95, 0, 'stone', c); P.b(0.18, 0.18, 0.45, 0, 2.2, 0.15, 'stone', c); for (const s of [-1, 1]) P.t(0.0, 0.06, 0.3, s * 0.07, 2.42, 0, 'stone', c, 0, 0, 0, 4); P.b(0.52, 0.12, 0.37, 0, 1.4, 0, 'metal', gold); break;
      case 'sarcophage': P.b(0.8, 0.7, 2.1, 0, 0.35, 0, 'stone', c); P.s(0.42, 0, 0.75, 0, 'metal', gold, 0.95, 0.35, 2.4, 14); P.s(0.22, 0, 0.92, -0.75, 'paint', blue, 1, 0.6, 0.8, 12); P.b(0.3, 0.1, 0.6, 0, 0.95, 0.1, 'paint', blue); break;
      default: P.b(1.4, 0.8, 0.8, 0, 0.4, 0, 'stone', c); P.b(1.5, 0.08, 0.9, 0, 0.84, 0, 'stone', mdShade(c, 0.9)); for (const x of [-0.4, 0, 0.4]) P.c(0.12, 0.2, x, 0.98, 0, 'stone', 0xb88a5a, 0, 0, 0, 10);
    }
  },
});
mdFam({
  key: 'ant', famName: 'Vases et trésors antiques', cat: 'antique', g: 'm', o: { solid: false },
  axes: [[['canopes', 'Vases canopes', 'm'], ['amphores', 'Amphores', 'f'], ['jarres', 'Jarres de stockage', 'f'], ['pieces', 'Tas de pièces d’or', 'm'], ['lingots', 'Pile de lingots', 'f'], ['coffre', 'Coffre d’or', 'm'], ['masque', 'Masque d’or sur socle', 'm'], ['brasero', 'Vasque à feu', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], ['canopes', 'amphores', 'jarres'].includes(t[0])], states: ['n', 'c'], mat: ([t]) => (['pieces', 'lingots', 'coffre', 'masque'].includes(t[0]) ? 'metal' : 'pierre'),
  opts: ([t]) => ({ solid: ['jarres', 'coffre', 'masque', 'brasero'].includes(t[0]) }),
  build: ([t]) => (P) => {
    const R = P.R, gold = 0xd0a838;
    switch (t[0]) {
      case 'canopes': for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.28; P.t(0.1, 0.08, 0.32, x, 0.16, 0, 'stone', 0xe0d8c0, 0, 0, 0, 12); P.s(0.08, x, 0.38, 0, 'stone', [0xd8b880, 0x6a5a4a, 0xc89a7a, 0x8a7a5a][i], 1, 1.1, 1, 10); } break;
      case 'amphores': for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.4; P.s(0.16, x, 0.35, 0, 'stone', 0xa8603a, 1, 1.5, 1, 12); P.t(0.04, 0.08, 0.18, x, 0.68, 0, 'stone', 0xa8603a, 0, 0, 0, 10); P.t(0.01, 0.06, 0.15, x, 0.08, 0, 'stone', 0xa8603a, Math.PI, 0, 0, 10); } break;
      case 'jarres': for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.7; P.s(0.32, x, 0.45, 0, 'stone', 0xb88a5a, 1, 1.4, 1, 14); P.c(0.18, 0.12, x, 0.92, 0, 'stone', 0xb88a5a, 0, 0, 0, 12); } break;
      case 'pieces': for (let i = 0; i < 40; i++) P.c(0.025, 0.006, rr(R, -0.35, 0.35) * (1 - i / 60), 0.003 + (i / 40) * 0.2, rr(R, -0.35, 0.35) * (1 - i / 60), 'metal', gold, rr(R, -0.4, 0.4), 0, rr(R, -0.4, 0.4), 10); P.s(0.3, 0, 0, 0, 'metal', gold, 1, 0.45, 1, 12); break;
      case 'lingots': for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) P.t(0.06, 0.08, 0.06, (i - (3 - r) / 2) * 0.2, 0.03 + r * 0.06, 0, 'metal', gold, 0, Math.PI / 4, 0, 4); break;
      case 'coffre': P.b(0.8, 0.45, 0.5, 0, 0.225, 0, 'metal', gold); P.c(0.25, 0.8, 0, 0.45, 0, 'metal', gold, 0, 0, Math.PI / 2, 14); for (const x of [-0.3, 0.3]) P.b(0.05, 0.47, 0.52, x, 0.23, 0, 'paint', 0x2a4a8a); break;
      case 'masque': P.b(0.4, 1.0, 0.4, 0, 0.5, 0, 'stone', 0x3e3c3e); P.b(0.32, 0.38, 0.12, 0, 1.2, 0, 'metal', gold); P.b(0.42, 0.3, 0.08, 0, 1.1, -0.02, 'paint', 0x2a4a8a); P.b(0.06, 0.18, 0.06, 0, 1.0, 0.04, 'metal', gold); break;
      default: P.c(0.1, 0.9, 0, 0.45, 0, 'stone', 0xd2c4a2, 0, 0, 0, 12); P.t(0.4, 0.15, 0.25, 0, 1.0, 0, 'metal', 0xb08a40, 0, 0, 0, 16); for (let i = 0; i < 5; i++) P.s(0.08, rr(R, -0.15, 0.15), 1.18 + rr(R, 0, 0.12), rr(R, -0.15, 0.15), 'glow', pk(R, [0xff8020, 0xffb040]), 1, 1.6, 1, 8);
    }
  },
});
mdFam({
  key: 'ruin', famName: 'Ruines antiques', cat: 'antique', g: 'm',
  axes: [[['mur', 'Pan de mur antique', 'm'], ['linteau', 'Linteau tombé', 'm'], ['marches', 'Marches de temple', 'f'], ['socle', 'Socle vide', 'm'], ['chapiteau', 'Chapiteau tombé', 'm'], ['porte', 'Porte de temple', 'f']], [['calcaire', 'en calcaire', 0xd2c4a2, 'gx_pt_grand_calcaire'], ['gres', 'en grès', 0xc49a84, 'gx_pt_grand_gresrose']]],
  nm: ([t, m]) => `${t[1]} ${m[1]}`, gp: ([t]) => [t[2], t[0] === 'marches'], states: ['n', 'm'], mat: () => 'pierre',
  build: ([t, m]) => (P) => {
    const c = m[2], tex = `tex:${m[3]}`, R = P.R;
    switch (t[0]) {
      case 'mur': for (let i = 0; i < 5; i++) { const h = rr(R, 1.2, 3.2); P.b(0.8, h, 0.8, -1.6 + i * 0.8, h / 2, 0, tex, 0xffffff); } for (let i = 0; i < 4; i++) P.b(rr(R, 0.3, 0.6), rr(R, 0.25, 0.4), rr(R, 0.3, 0.5), rr(R, -2, 2), 0.15, rr(R, 0.6, 1.4), 'stone', c, 0, R() * 3, rr(R, -0.3, 0.3)); break;
      case 'linteau': P.b(3.2, 0.6, 0.8, 0, 0.3, 0, 'stone', c, 0, 0.2, 0.08); P.b(0.8, 1.8, 0.8, -2.0, 0.9, 0.6, tex, 0xffffff); break;
      case 'marches': for (let i = 0; i < 5; i++) P.b(4 - i * 0.2, 0.25, 3 - i * 0.55, 0, 0.125 + i * 0.25, -i * 0.27, tex, 0xffffff); break;
      case 'socle': P.b(1.2, 0.3, 1.2, 0, 0.15, 0, 'stone', mdShade(c, 0.9)); P.b(0.9, 1.1, 0.9, 0, 0.85, 0, 'stone', c); P.b(1.1, 0.18, 1.1, 0, 1.49, 0, 'stone', mdShade(c, 0.9)); break;
      case 'chapiteau': P.t(0.55, 0.42, 0.35, 0, 0.3, 0, 'stone', c, 0.4, 0, 0.5, 16); P.b(1.0, 0.18, 1.0, 0.1, 0.12, 0.2, 'stone', c, 0, 0.5, 0.1); break;
      default: for (const s of [-1, 1]) P.b(0.9, 4, 1.0, s * 1.4, 2, 0, tex, 0xffffff); P.b(3.8, 0.9, 1.1, 0, 4.45, 0, 'stone', c); P.b(4.0, 0.2, 1.2, 0, 4.9, 0, 'stone', mdShade(c, 0.9)); P.b(1.2, 0.5, 0.05, 0, 4.45, 0.56, 'paint', 0xc8a040);
    }
  },
});

/* ======================================================= science-fiction & Lune */
const MD_SFCOL = [['blanc', 'blanc', 0xe0e0dc], ['gris', 'gris', 0x8a8e94], ['noir', 'noir', 0x2a2c30], ['orange', 'orange', 0xd8782a]];
mdFam({
  key: 'sfc', famName: 'Caissons de science-fiction', cat: 'scifi', g: 'm',
  axes: [[['lumineux', 'Caisson lumineux', 'm'], ['energie', 'Conteneur d’énergie', 'm'], ['blinde', 'Caisson blindé', 'm'], ['cryo', 'Fût cryogénique', 'm']], MD_SFCOL],
  nm: ([t, c]) => `${t[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'e', 'c'], mat: () => 'metal',
  build: ([t, c]) => (P) => {
    const col = c[2], glow = 0x60d8ff;
    switch (t[0]) {
      case 'lumineux': P.b(1.0, 0.7, 0.7, 0, 0.35, 0, 'metal', col); for (const z of [-1, 1]) P.b(0.8, 0.05, 0.01, 0, 0.5, z * 0.355, 'glow', glow); P.b(1.04, 0.08, 0.74, 0, 0.04, 0, 'metal', mdShade(col, 0.7)); P.b(1.04, 0.06, 0.74, 0, 0.67, 0, 'metal', mdShade(col, 0.8)); break;
      case 'energie': P.c(0.3, 1.0, 0, 0.55, 0, 'glass', 0x7ad0ff, 0, 0, 0, 16); P.c(0.18, 0.95, 0, 0.55, 0, 'glow', 0x40c8ff, 0, 0, 0, 12); for (const y of [0.05, 1.05]) P.c(0.36, 0.1, 0, y, 0, 'metal', col, 0, 0, 0, 16); for (let i = 0; i < 4; i++) P.b(0.04, 1.0, 0.04, Math.cos(i * 1.57) * 0.33, 0.55, Math.sin(i * 1.57) * 0.33, 'metal', col); break;
      case 'blinde': P.b(1.2, 0.9, 0.9, 0, 0.45, 0, 'metal', col); for (const x of [-0.45, 0.45]) P.b(0.1, 0.92, 0.92, x, 0.46, 0, 'metal', mdShade(col, 0.75)); P.b(0.3, 0.12, 0.01, 0, 0.6, 0.455, 'glow', 0xff5030); P.b(0.5, 0.3, 0.01, 0, 0.35, 0.455, 'paint', 0xe8c020); break;
      default: P.c(0.32, 1.4, 0, 0.75, 0, 'metal', col, 0, 0, 0, 16); P.c(0.2, 0.9, 0, 0.75, 0.15, 'glass', 0xa0e8ff, 0, 0, 0, 12); P.b(0.2, 0.6, 0.02, 0, 0.75, 0.31, 'glow', 0x80e0ff); P.c(0.34, 0.08, 0, 0.04, 0, 'metal', mdShade(col, 0.7), 0, 0, 0, 16);
    }
  },
});
mdFam({
  key: 'sfm', famName: 'Machines de science-fiction', cat: 'scifi', g: 'f',
  axes: [[['holo', 'Console holographique', 'f'], ['reacteur', 'Réacteur à fusion', 'm'], ['arcs', 'Générateur à arcs', 'm'], ['cuve', 'Cuve de stase', 'f'], ['robot', 'Robot de maintenance', 'm'], ['drone', 'Drone posé', 'm'], ['parabole', 'Antenne parabolique', 'f'], ['solaire', 'Panneau solaire', 'm'], ['foreuse', 'Foreuse', 'f'], ['teleporteur', 'Plate-forme de téléportation', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'e', 'c'], mat: () => 'metal',
  build: ([t]) => (P) => {
    const R = P.R, w = 0xd8dadc, d = 0x3a3c40, g = 0x60d8ff;
    switch (t[0]) {
      case 'holo': P.c(0.6, 0.9, 0, 0.45, 0, 'metal', d, 0, 0, 0, 18); P.c(0.62, 0.05, 0, 0.92, 0, 'metal', w, 0, 0, 0, 18); P.c(0.5, 0.01, 0, 0.95, 0, 'glow', g, 0, 0, 0, 18); P.s(0.35, 0, 1.4, 0, 'glass', 0x80e8ff, 1, 1, 1, 14); for (let i = 0; i < 3; i++) P.o(0.25, 0.006, 0, 1.25 + i * 0.15, 0, 'glow', g, Math.PI / 2, 0, 0); break;
      case 'reacteur': P.c(1.2, 0.5, 0, 0.25, 0, 'metal', d, 0, 0, 0, 20); P.c(0.6, 2.4, 0, 1.7, 0, 'glass', 0x80c8ff, 0, 0, 0, 18); P.c(0.3, 2.3, 0, 1.7, 0, 'glow', 0x40a0ff, 0, 0, 0, 14); P.c(0.9, 0.4, 0, 3.0, 0, 'metal', d, 0, 0, 0, 20); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; P.b(0.12, 2.6, 0.12, Math.cos(a) * 0.75, 1.55, Math.sin(a) * 0.75, 'metal', w); } break;
      case 'arcs': for (const x of [-0.8, 0.8]) { P.c(0.15, 2.2, x, 1.1, 0, 'metal', d, 0, 0, 0, 12); P.s(0.28, x, 2.35, 0, 'metal', 0xb0b4b8, 1, 1, 1, 14); } for (let i = 0; i < 5; i++) boxBetween(P, 'glow', 0xc0e8ff, [-0.6, 2.3 + rr(R, -0.15, 0.15), rr(R, -0.1, 0.1)], [0.6, 2.3 + rr(R, -0.15, 0.15), rr(R, -0.1, 0.1)], 0.015); P.b(2.2, 0.2, 0.8, 0, 0.1, 0, 'metal', d); break;
      case 'cuve': P.c(0.6, 0.3, 0, 0.15, 0, 'metal', d, 0, 0, 0, 18); P.c(0.5, 2.0, 0, 1.3, 0, 'glass', 0x60c0a0, 0, 0, 0, 18); P.c(0.48, 1.9, 0, 1.28, 0, 'liquid', 0x40a888, 0, 0, 0, 16); P.s(0.13, 0, 1.75, 0, 'skin', 0x6a8a7a, 0.9, 1.1, 1, 10); P.b(0.35, 0.6, 0.2, 0, 1.25, 0, 'skin', 0x6a8a7a); for (const s of [-1, 1]) P.b(0.1, 0.7, 0.1, s * 0.1, 0.65, 0, 'skin', 0x6a8a7a); P.c(0.6, 0.3, 0, 2.45, 0, 'metal', d, 0, 0, 0, 18); break;
      case 'robot': P.b(0.6, 0.15, 0.6, 0, 0.18, 0, 'metal', d); for (const x of [-0.25, 0.25]) for (const z of [-0.25, 0.25]) P.c(0.1, 0.08, x, 0.1, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 10); P.b(0.5, 0.6, 0.45, 0, 0.6, 0, 'metal', 0xd8a030); P.b(0.3, 0.2, 0.3, 0, 1.05, 0, 'metal', d); P.b(0.2, 0.06, 0.02, 0, 1.08, 0.16, 'glow', 0xff4030); for (const s of [-1, 1]) { boxBetween(P, 'metal', d, [s * 0.3, 0.8, 0], [s * 0.5, 0.55, 0.3], 0.06); P.b(0.08, 0.12, 0.05, s * 0.5, 0.5, 0.35, 'metal', 0xb0b2b4); } break;
      case 'drone': P.b(0.4, 0.12, 0.4, 0, 0.15, 0, 'metal', d); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; boxBetween(P, 'metal', d, [0, 0.18, 0], [Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45], 0.03); P.c(0.18, 0.01, Math.cos(a) * 0.45, 0.24, Math.sin(a) * 0.45, 'plastic', 0x2a2a2a, 0, 0, 0, 12); } P.s(0.05, 0, 0.08, 0.15, 'glass', 0x1a1a1a, 1, 1, 1, 8); for (const x of [-0.15, 0.15]) P.b(0.02, 0.12, 0.3, x, 0.05, 0, 'metal', d); break;
      case 'parabole': P.c(0.15, 1.5, 0, 0.75, 0, 'metal', w, 0, 0, 0, 12); P.s(1.2, 0, 2.0, 0.3, 'metal', w, 1, 1, 0.3, 18); P.c(0.02, 0.9, 0, 2.0, 0.75, 'metal', d, Math.PI / 2 - 0.5, 0, 0, 6); break;
      case 'solaire': P.c(0.06, 1.2, 0, 0.6, 0, 'metal', w); P.b(2.4, 0.04, 1.4, 0, 1.25, 0, 'tex:lu_solar', 0xffffff, -0.5, 0, 0); P.b(2.44, 0.03, 1.44, 0, 1.24, -0.01, 'metal', w, -0.5, 0, 0); break;
      case 'foreuse': P.b(1.6, 0.4, 1.6, 0, 0.2, 0, 'metal', d); for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 1.2, z = ((i >> 1) - 0.5) * 1.2; boxBetween(P, 'metal', 0xd8a030, [x, 0.4, z], [0, 3.6, 0], 0.08); } P.c(0.25, 3.0, 0, 1.5, 0, 'metal', 0x8a8c8e, 0, 0, 0, 12); P.t(0.0, 0.25, 0.5, 0, -0.1, 0, 'metal', 0x6a6c6e, 0, 0, 0, 12); P.b(0.6, 0.6, 0.6, 0, 3.4, 0, 'metal', 0xd8a030); break;
      default: P.c(1.4, 0.2, 0, 0.1, 0, 'metal', d, 0, 0, 0, 24); P.c(1.2, 0.02, 0, 0.21, 0, 'glow', g, 0, 0, 0, 24); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; P.b(0.15, 2.8, 0.15, Math.cos(a) * 1.35, 1.4, Math.sin(a) * 1.35, 'metal', w); P.s(0.12, Math.cos(a) * 1.35, 2.85, Math.sin(a) * 1.35, 'glow', g, 1, 1, 1, 10); }
    }
  },
});
mdFam({
  key: 'lune', famName: 'Matériel lunaire', cat: 'scifi', g: 'm',
  axes: [[['rover', 'Rover lunaire', 'm'], ['module', 'Module d’atterrissage', 'm'], ['drapeau', 'Drapeau planté', 'm'], ['combinaison', 'Combinaison spatiale sur support', 'f'], ['oxygene', 'Bouteilles d’oxygène', 'f'], ['ravitaillement', 'Caisse de ravitaillement', 'f'], ['sismo', 'Sismographe', 'm'], ['habitat', 'Module d’habitation gonflable', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'oxygene'], states: ['n', 'c'], mat: () => 'metal',
  build: ([t]) => (P) => {
    const w = 0xd8dadc, d = 0x3a3c40, gold = 0xc8a040;
    switch (t[0]) {
      case 'rover': for (const x of [-0.9, 0.9]) for (const z of [-1.1, 1.1]) P.c(0.4, 0.25, x, 0.4, z, 'metal', 0x8a8c8e, 0, 0, Math.PI / 2, 14); P.b(1.6, 0.1, 2.8, 0, 0.6, 0, 'metal', w); for (const x of [-0.35, 0.35]) { P.b(0.5, 0.08, 0.5, x, 0.85, -0.2, 'fabric', 0x4a4c50); P.b(0.5, 0.5, 0.06, x, 1.1, -0.45, 'metal', w); } P.c(0.5, 0.02, 0, 1.6, 0.9, 'metal', w, -0.6, 0, 0, 14); P.c(0.02, 0.8, 0, 1.2, 0.9, 'metal', d); P.b(0.4, 0.3, 0.3, 0, 0.8, 1.0, 'metal', gold); break;
      case 'module': for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; boxBetween(P, 'metal', w, [Math.cos(a) * 1.1, 1.2, Math.sin(a) * 1.1], [Math.cos(a) * 2.0, 0.05, Math.sin(a) * 2.0], 0.08); P.c(0.3, 0.05, Math.cos(a) * 2.0, 0.03, Math.sin(a) * 2.0, 'metal', w, 0, 0, 0, 12); } P.c(1.4, 1.2, 0, 1.6, 0, 'metal', gold, 0, Math.PI / 8, 0, 8); P.b(1.8, 1.4, 1.8, 0, 2.9, 0, 'metal', 0xb8babc, 0, Math.PI / 4, 0); P.t(0.5, 0.7, 0.4, 0, 0.9, 0, 'metal', d, 0, 0, 0, 14); break;
      case 'drapeau': P.c(0.02, 1.8, 0, 0.9, 0, 'metal', w); P.b(0.9, 0.6, 0.008, 0.46, 1.5, 0, 'fabric', 0xe8e8e2); P.b(0.9, 0.2, 0.01, 0.46, 1.5, 0, 'fabric', 0x2a4a9a); P.c(0.012, 0.92, 0.46, 1.8, 0, 'metal', w, 0, 0, Math.PI / 2, 6); break;
      case 'combinaison': P.c(0.25, 0.05, 0, 0.025, 0, 'metal', d, 0, 0, 0, 14); P.c(0.03, 1.2, 0, 0.6, -0.15, 'metal', d); for (const s of [-1, 1]) { P.c(0.09, 0.75, s * 0.12, 0.45, 0, 'fabric', 0xe8e8e2, 0, 0, 0, 10); P.c(0.07, 0.6, s * 0.3, 1.15, 0, 'fabric', 0xe8e8e2, 0, 0, s * 0.2, 10); } P.b(0.45, 0.6, 0.3, 0, 1.15, 0, 'fabric', 0xe8e8e2); P.b(0.4, 0.5, 0.2, 0, 1.2, -0.22, 'metal', w); P.s(0.17, 0, 1.65, 0, 'fabric', 0xe8e8e2, 1, 1.1, 1, 12); P.s(0.13, 0, 1.66, 0.06, 'glass', gold, 1, 0.9, 0.7, 12); break;
      case 'oxygene': for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.3; P.c(0.12, 1.1, x, 0.55, 0, 'metal', i === 1 ? w : 0x3a6a3a, 0, 0, 0, 12); P.s(0.12, x, 1.1, 0, 'metal', i === 1 ? w : 0x3a6a3a, 1, 0.5, 1, 12); P.c(0.025, 0.1, x, 1.2, 0, 'metal', gold); } break;
      case 'ravitaillement': P.b(1.0, 0.7, 0.7, 0, 0.35, 0, 'metal', w); P.b(1.02, 0.1, 0.72, 0, 0.66, 0, 'metal', 0xd8782a); P.b(0.4, 0.2, 0.01, 0, 0.4, 0.355, 'paint', 0x2a4a9a); for (const x of [-0.45, 0.45]) P.b(0.06, 0.06, 0.4, x, 0.75, 0, 'metal', d); break;
      case 'sismo': for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; boxBetween(P, 'metal', w, [0, 0.35, 0], [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4], 0.02); } P.c(0.15, 0.25, 0, 0.45, 0, 'metal', gold, 0, 0, 0, 12); P.c(0.008, 0.6, 0.1, 0.85, 0, 'metal', w); break;
      default: P.s(2.2, 0, 0.4, 0, 'fabric', 0xe0e0dc, 1, 0.75, 1.5, 18); P.c(0.8, 1.6, 0, 1.0, 3.2, 'metal', w, Math.PI / 2, 0, 0, 14); P.b(1.0, 1.4, 0.05, 0, 1.0, 4.0, 'metal', 0x8a8e94); P.b(0.6, 0.6, 0.06, 0, 1.2, 4.03, 'glass', 0x3a4a54); for (let i = 0; i < 4; i++) P.o(2.2 * Math.cos((i / 8) * Math.PI), 0.04, 0, 0.4, (i - 1.5) * 0.8, 'metal', 0xb0b2b4, 0, 0, 0);
    }
  },
});

GX.ms = Math.round(performance.now() - GX.t0);
