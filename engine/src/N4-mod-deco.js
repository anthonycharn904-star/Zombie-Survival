/* =====================================================================================================
   Jeu 2.0.4 : modèles de décoration, de bureau et d'électronique.
   ===================================================================================================== */
const MD_FRAMES = [['dore', 'à cadre doré', 0xb8963c, 'metal'], ['noir', 'à cadre noir', 0x1e1e20, 'wood'], ['bois', 'à cadre de bois', 0x6a4a2e, 'wood']];
/* Cadre w × h au mur (face +z, centre à la hauteur y). */
function mdFrame(P, w, h, y, fr, depth = 0.04) {
  const t = 0.06;
  for (const s of [-1, 1]) { P.b(w + t * 2, t, depth, 0, y + s * (h / 2 + t / 2), 0.02, fr[3], fr[2]); P.b(t, h, depth, s * (w / 2 + t / 2), y, 0.02, fr[3], fr[2]); }
}

/* ================================================================ décoration */
mdFam({
  key: 'tabl', famName: 'Tableaux', cat: 'decor', g: 'm', o: { wall: true, solid: false },
  axes: [[['paysage', 'paysage'], ['mer', 'marine'], ['nuit', 'nocturne'], ['portrait', 'portrait'], ['abstrait', 'abstrait'], ['fleurs', 'bouquet']], MD_FRAMES],
  nm: ([s, fr]) => `Tableau (${s[1]}) ${fr[1]}`, states: ['n', 'u', 'g'], mat: () => 'peint',
  build: ([s, fr]) => (P) => {
    const port = s[0] === 'portrait' || s[0] === 'fleurs', w = port ? 0.5 : 0.8, h = port ? 0.68 : 0.56, y = 1.6, z = 0.012, R = P.R;
    mdFrame(P, w, h, y, fr);
    const band = (y0, y1, c, zz = z) => P.b(w, y1 - y0, 0.006, 0, y - h / 2 + (y0 + y1) / 2 * h, zz, 'paint', c);
    if (s[0] === 'paysage') { band(0, 1, 0x8ab0c8); band(0, 0.45, 0x5a7a3a, z + 0.002); band(0.3, 0.55, 0x4a6a8a, z + 0.001); P.c(0.05, 0.006, w * 0.25, y + h * 0.28, z + 0.004, 'paint', 0xf0d080, Math.PI / 2, 0, 0, 12); }
    else if (s[0] === 'mer') { band(0, 1, 0xc8b490); band(0, 0.45, 0x2a4a6a, z + 0.002); band(0.4, 0.47, 0xe8e8e0, z + 0.003); P.b(0.12, 0.16, 0.006, -w * 0.15, y + h * 0.05, z + 0.004, 'paint', 0xe8e4d8); }
    else if (s[0] === 'nuit') { band(0, 1, 0x101830); band(0, 0.3, 0x1a2414, z + 0.002); P.c(0.06, 0.006, w * 0.22, y + h * 0.25, z + 0.004, 'paint', 0xe8e8d0, Math.PI / 2, 0, 0, 14); for (let i = 0; i < 8; i++) P.b(0.008, 0.008, 0.006, rr(R, -w / 2.2, w / 2.2), y + rr(R, 0, h / 2.2), z + 0.003, 'paint', 0xf0f0e0); }
    else if (s[0] === 'portrait') { band(0, 1, 0x2a2018); P.s(0.1, 0, y + h * 0.12, z + 0.002, 'paint', 0xc8a080, 0.85, 1.1, 0.06, 12); P.b(0.32, 0.2, 0.006, 0, y - h * 0.32, z + 0.003, 'paint', 0x1a1a24); }
    else if (s[0] === 'abstrait') { band(0, 1, 0xe8e4d8); for (let i = 0; i < 6; i++) P.b(rr(R, 0.1, 0.3), rr(R, 0.06, 0.25), 0.006, rr(R, -w / 3, w / 3), y + rr(R, -h / 3, h / 3), z + 0.002 + i * 0.0008, 'paint', pk(R, [0xc83a2a, 0x2a4a9a, 0xe8c030, 0x1a1a1a, 0x3a8a4a])); }
    else { band(0, 1, 0x3a3a30); P.t(0.05, 0.08, 0.16, 0, y - h * 0.32, z + 0.03, 'paint', 0x6a5a4a); for (let i = 0; i < 9; i++) P.s(0.04, rr(R, -0.12, 0.12), y + rr(R, -0.1, 0.15), z + 0.004, 'paint', pk(R, [0xc83a3a, 0xe8d050, 0xe8e8e0, 0x9a4ac8]), 1, 1, 0.2, 8); }
  },
});
mdFam({
  key: 'mir', famName: 'Miroirs', cat: 'decor', g: 'm', o: { wall: true, solid: false },
  axes: [[['rect', 'rectangulaire'], ['rond', 'rond'], ['psyche', 'sur pied']], MD_FRAMES],
  nm: ([s, fr]) => `Miroir ${s[1]} ${fr[1]}`, states: ['n', 'c'], mat: () => 'verre', opts: ([s]) => ({ wall: s[0] !== 'psyche', solid: false }),
  build: ([s, fr]) => (P) => {
    if (s[0] === 'rond') { P.c(0.34, 0.03, 0, 1.6, 0.02, fr[3], fr[2], Math.PI / 2, 0, 0, 24); P.c(0.3, 0.032, 0, 1.6, 0.022, 'metal', 0xd0d8dc, Math.PI / 2, 0, 0, 24); return; }
    if (s[0] === 'psyche') { for (const x of [-0.32, 0.32]) { P.b(0.05, 1.6, 0.05, x, 0.8, 0, fr[3], fr[2]); P.b(0.05, 0.05, 0.4, x, 0.025, 0, fr[3], fr[2]); } P.b(0.56, 1.3, 0.03, 0, 0.95, 0, fr[3], fr[2], -0.1, 0, 0); P.b(0.5, 1.22, 0.032, 0, 0.95, 0.004, 'metal', 0xd0d8dc, -0.1, 0, 0); return; }
    mdFrame(P, 0.6, 0.9, 1.5, fr); P.b(0.6, 0.9, 0.012, 0, 1.5, 0.015, 'metal', 0xd0d8dc);
  },
});
mdFam({
  key: 'horl', famName: 'Horloges', cat: 'decor', g: 'f',
  axes: [[['murale', 'murale ronde'], ['comtoise', 'comtoise'], ['gare', 'de gare'], ['coucou', 'à coucou']], mdW('chene', 'noyer', 'noir')],
  nm: ([t, w]) => `Horloge ${t[1]} ${t[0] === 'gare' ? '' : mdCol(w, true, false)}`.trim(), states: ['n', 'c'], mat: () => 'bois',
  opts: ([t]) => ({ wall: t[0] === 'murale' || t[0] === 'coucou' || t[0] === 'gare', solid: t[0] === 'comtoise' }),
  build: ([t, w]) => (P) => {
    const c = w[2], face = (x, y, z, r) => { P.c(r, 0.02, x, y, z, 'paint', 0xece6d4, Math.PI / 2, 0, 0, 20); P.b(0.008, r * 0.6, 0.006, x, y + r * 0.25, z + 0.012, 'paint', 0x1a1a1a, 0, 0, 0.4); P.b(0.008, r * 0.8, 0.006, x, y + r * 0.35, z + 0.013, 'paint', 0x1a1a1a, 0, 0, -1.2); };
    if (t[0] === 'murale') { P.c(0.2, 0.05, 0, 1.8, 0.025, 'wood', c, Math.PI / 2, 0, 0, 20); face(0, 1.8, 0.05, 0.17); return; }
    if (t[0] === 'gare') { P.c(0.32, 0.08, 0, 2.2, 0.04, 'metal', 0x2a2c2e, Math.PI / 2, 0, 0, 22); face(0, 2.2, 0.085, 0.28); P.b(0.06, 0.25, 0.06, 0, 2.6, 0, 'metal', 0x2a2c2e); return; }
    if (t[0] === 'coucou') { P.b(0.3, 0.36, 0.16, 0, 1.75, 0.08, 'wood', c); gable(P, 'wood', mdShade(c, 0.8), 0, 1.93, 0.08, 0.42, 0.18, 0.2); face(0, 1.72, 0.17, 0.09); for (const x of [-0.06, 0.06]) { P.c(0.004, 0.5, x, 1.3, 0.1, 'metal', 0xb09040); P.t(0.02, 0.03, 0.12, x, 1.0, 0.1, 'metal', 0xb09040, 0, 0, 0, 8); } return; }
    P.b(0.5, 2.0, 0.3, 0, 1.0, 0, 'wood', c); P.b(0.56, 0.1, 0.34, 0, 2.05, 0, 'wood', mdShade(c, 0.85)); P.b(0.56, 0.12, 0.34, 0, 0.06, 0, 'wood', mdShade(c, 0.85));
    face(0, 1.68, 0.16, 0.18); P.b(0.3, 0.9, 0.01, 0, 0.9, 0.152, 'glass', 0x6a5a40); P.c(0.008, 0.6, 0, 0.95, 0.12, 'metal', 0xb09040); P.c(0.06, 0.012, 0, 0.62, 0.12, 'metal', 0xb09040, Math.PI / 2, 0, 0, 14);
  },
});
const MD_VASE_COL = [['blanc', 'blanc', 0xe8e4dc, 'plastic'], ['bleu', 'bleu', 0x2a4a8a, 'plastic'], ['terre', 'en terre cuite', 0xa8603a, 'stone'], ['vert', 'vert', 0x3a6a4a, 'plastic'], ['noir', 'noir', 0x1e1e20, 'plastic'], ['dore', 'doré', 0xc8a040, 'metal']];
mdFam({
  key: 'vase', famName: 'Vases et jarres', cat: 'decor', g: 'm',
  axes: [[['amphore', 'Amphore', 'f'], ['boule', 'Vase boule', 'm'], ['haut', 'Grand vase', 'm'], ['evase', 'Vase évasé', 'm'], ['jarre', 'Jarre', 'f'], ['urne', 'Urne', 'f']], MD_VASE_COL],
  nm: ([t, c]) => `${t[1]} ${gxAcc(c[1], t[2] === 'f', false)}`, gp: ([t]) => [t[2], false], states: ['n', 'c'], mat: ([, c]) => (c[0] === 'terre' ? 'pierre' : c[0] === 'dore' ? 'metal' : 'plastique'),
  opts: ([t]) => ({ solid: t[0] === 'jarre' || t[0] === 'haut' }),
  build: ([t, c]) => (P) => {
    const f = c[3], col = c[2];
    switch (t[0]) {
      case 'amphore': P.t(0.12, 0.05, 0.12, 0, 0.06, 0, f, col, 0, 0, 0, 14); P.s(0.17, 0, 0.3, 0, f, col, 1, 1.35, 1, 14); P.t(0.06, 0.1, 0.18, 0, 0.6, 0, f, col, 0, 0, 0, 12); for (const x of [-1, 1]) P.o(0.07, 0.015, x * 0.1, 0.6, 0, f, col, 0, 0, 0); break;
      case 'boule': P.s(0.15, 0, 0.15, 0, f, col, 1, 1, 1, 14); P.c(0.06, 0.08, 0, 0.32, 0, f, col, 0, 0, 0, 12); break;
      case 'haut': P.t(0.14, 0.1, 0.9, 0, 0.45, 0, f, col, 0, 0, 0, 14); P.t(0.18, 0.13, 0.12, 0, 0.94, 0, f, col, 0, 0, 0, 14); break;
      case 'evase': P.t(0.16, 0.07, 0.38, 0, 0.19, 0, f, col, 0, 0, 0, 14); break;
      case 'jarre': P.s(0.3, 0, 0.42, 0, f, col, 1, 1.35, 1, 16); P.t(0.16, 0.2, 0.12, 0, 0.84, 0, f, col, 0, 0, 0, 14); P.c(0.15, 0.1, 0, 0.05, 0, f, mdShade(col, 0.9), 0, 0, 0, 14); break;
      default: P.c(0.12, 0.04, 0, 0.02, 0, f, col, 0, 0, 0, 14); P.s(0.14, 0, 0.22, 0, f, col, 1, 1.2, 1, 14); P.c(0.1, 0.06, 0, 0.42, 0, f, col, 0, 0, 0, 14); P.s(0.06, 0, 0.48, 0, f, col, 1, 0.6, 1, 10);
    }
  },
});
const MD_POTS = [['terre', 'en terre cuite', 0xa8603a, 'stone'], ['blanc', 'blanc', 0xe0ddd4, 'plastic'], ['noir', 'noir', 0x24262a, 'plastic']];
mdFam({
  key: 'plt', famName: 'Plantes en pot', cat: 'decor', g: 'f',
  axes: [[['ficus', 'Ficus'], ['fougere', 'Fougère'], ['cactus', 'Cactus'], ['palmier', 'Palmier nain'], ['sansev', 'Langue de belle-mère'], ['fleurs', 'Fleurs']], MD_POTS],
  nm: ([t, p]) => `${t[1]} en pot ${p[0] === 'terre' ? 'de terre cuite' : gxAcc(p[1], false, false)}`, gp: ([t]) => [t[0] === 'cactus' || t[0] === 'ficus' || t[0] === 'palmier' ? 'm' : 'f', t[0] === 'fleurs'],
  states: ['n', 'u', 'x'], mat: () => 'vegetal', opts: ([t]) => ({ solid: t[0] === 'ficus' || t[0] === 'palmier' }),
  build: ([t, p]) => (P) => {
    const R = P.R, big = t[0] === 'ficus' || t[0] === 'palmier', pr = big ? 0.22 : 0.14, ph = big ? 0.36 : 0.22;
    P.t(pr, pr * 0.75, ph, 0, ph / 2, 0, p[3], p[2], 0, 0, 0, 14); P.c(pr * 0.95, 0.02, 0, ph - 0.01, 0, 'paper', 0x3a2a1a, 0, 0, 0, 14);
    const lc = 0x3e6e32;
    switch (t[0]) {
      case 'ficus': P.c(0.025, 1.0, 0, ph + 0.5, 0, 'bark', 0x5a4030); for (let i = 0; i < 7; i++) P.s(0.22, rr(R, -0.18, 0.18), ph + 0.9 + rr(R, -0.15, 0.35), rr(R, -0.18, 0.18), 'foliage', mdShade(lc, rr(R, 0.8, 1.15)), 1, 0.8, 1, 10); break;
      case 'fougere': for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; card(P, 'fern', 0x4e7e3a, 0.25, 0.5, Math.cos(a) * 0.14, ph + 0.18, Math.sin(a) * 0.14, -a + Math.PI / 2, 0.7); } break;
      case 'cactus': P.c(0.07, 0.5, 0, ph + 0.25, 0, 'foliage', 0x4a7a3a, 0, 0, 0, 10); P.s(0.07, 0, ph + 0.5, 0, 'foliage', 0x4a7a3a, 1, 1, 1, 10); for (const s of [-1, 1]) { P.c(0.04, 0.12, s * 0.1, ph + 0.28, 0, 'foliage', 0x4a7a3a, 0, 0, Math.PI / 2, 8); P.c(0.04, 0.2, s * 0.16, ph + 0.38, 0, 'foliage', 0x4a7a3a, 0, 0, 0, 8); } break;
      case 'palmier': P.c(0.04, 0.6, 0, ph + 0.3, 0, 'bark', 0x6a5a40); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; card(P, 'fern', 0x4a7a3a, 0.3, 0.8, Math.cos(a) * 0.3, ph + 0.75, Math.sin(a) * 0.3, -a + Math.PI / 2, 1.0); } break;
      case 'sansev': for (let i = 0; i < 9; i++) P.b(0.05, rr(R, 0.4, 0.7), 0.012, rr(R, -0.08, 0.08), ph + 0.25, rr(R, -0.08, 0.08), 'foliage', mdMix(0x3a6a2a, 0xa8a040, R() * 0.3), rr(R, -0.15, 0.15), R() * 3, rr(R, -0.15, 0.15)); break;
      default: P.c(0.01, 0.25, 0, ph + 0.12, 0, 'foliage', lc); for (let i = 0; i < 7; i++) P.s(0.04, rr(R, -0.1, 0.1), ph + rr(R, 0.2, 0.32), rr(R, -0.1, 0.1), 'plastic', pk(R, [0xc83a4a, 0xe8d040, 0xe8e8e8, 0x9a5ac8]), 1, 0.6, 1, 8);
    }
  },
});
const MD_RUGS = [['rouge', 'rouge et or', 'gx_mqm_rouge'], ['bleu', 'bleu et crème', 'gx_mqm_bleu'], ['vert', 'vert et beige', 'gx_mqm_vert'], ['brun', 'brun et ocre', 'gx_mqm_brun'], ['tartan', 'écossais', 'gx_ta_rouge'], ['gris', 'gris et noir', 'gx_mqm_gris']];
mdFam({
  key: 'tap', famName: 'Tapis', cat: 'decor', g: 'm', o: { solid: false },
  axes: [[['petit', 'petit', [1.2, 0.8]], ['moyen', 'moyen', [2.0, 1.4]], ['grand', 'grand', [3.0, 2.2]], ['couloir', 'de couloir', [3.0, 0.8]]], MD_RUGS],
  nm: ([s, m]) => `Tapis ${s[1]} ${m[1]}`, states: ['n', 'u', 'g'], mat: () => 'tissu',
  build: ([s, m]) => (P) => {
    const [L, W] = s[2];
    P.b(L, 0.012, W, 0, 0.006, 0, `tex:${m[2]}`, 0xffffff);
    for (const z of [-1, 1]) P.b(L - 0.04, 0.014, 0.06, 0, 0.007, z * (W / 2 - 0.03), 'fabric', 0x3a2a20);
    for (const x of [-1, 1]) for (let i = 0; i < 12; i++) P.b(0.06, 0.004, 0.012, x * (L / 2 + 0.03), 0.003, -W / 2 + (W * (i + 0.5)) / 12, 'fabric', 0xd8ccb0);
  },
});
mdFam({
  key: 'stat', famName: 'Statues et bustes', cat: 'decor', g: 'f',
  axes: [[['buste', 'Buste sur colonne', 'm'], ['statue', 'Statue', 'f'], ['ange', 'Ange funéraire', 'm'], ['lion', 'Lion couché', 'm']], [['marbre', 'en marbre', 0xe4e0d8, 'stone'], ['bronze', 'en bronze', 0x6a5030, 'metal'], ['pierre', 'en pierre', 0x9a948a, 'stone']]],
  nm: ([t, m]) => `${t[1]} ${m[1]}`, gp: ([t]) => [t[2], false], states: ['n', 'c', 'm'], mat: ([, m]) => (m[0] === 'bronze' ? 'metal' : 'pierre'),
  build: ([t, m]) => (P) => {
    const f = m[3], c = m[2], ped = (h) => { P.b(0.5, 0.1, 0.5, 0, 0.05, 0, 'stone', 0x8a8680); P.b(0.4, h, 0.4, 0, 0.1 + h / 2, 0, 'stone', 0xa8a49c); P.b(0.48, 0.06, 0.48, 0, 0.13 + h, 0, 'stone', 0x8a8680); return 0.16 + h; };
    if (t[0] === 'buste') { const y = ped(1.0); P.b(0.42, 0.22, 0.24, 0, y + 0.11, 0, f, c); P.c(0.07, 0.1, 0, y + 0.27, 0, f, c); P.s(0.12, 0, y + 0.42, 0, f, c, 0.85, 1.05, 0.95, 12); return; }
    if (t[0] === 'lion') { const y = ped(0.5); P.b(0.9, 0.3, 0.38, 0, y + 0.15, 0, f, c); P.s(0.2, 0.4, y + 0.4, 0, f, c, 1, 1.1, 1, 12); P.b(0.3, 0.08, 0.12, 0.55, y + 0.04, 0.1, f, c); P.b(0.3, 0.08, 0.12, 0.55, y + 0.04, -0.1, f, c); P.c(0.03, 0.5, -0.6, y + 0.1, 0, f, c, 0, 0, Math.PI / 2.3, 8); return; }
    const y = ped(0.6);
    P.b(0.36, 0.95, 0.24, 0, y + 0.48, 0, f, c); P.t(0.18, 0.3, 0.55, 0, y + 0.27, 0, f, c, 0, 0, 0, 12); P.s(0.11, 0, y + 1.08, 0, f, c, 0.9, 1.1, 1, 12);
    for (const s of [-1, 1]) P.b(0.08, 0.6, 0.08, s * 0.24, y + 0.65, 0.03, f, c, 0, 0, s * 0.15);
    if (t[0] === 'ange') for (const s of [-1, 1]) P.b(0.04, 0.8, 0.4, s * 0.12, y + 0.95, -0.25, f, c, 0.3, s * 0.5, 0);
  },
});
mdFam({
  key: 'liv', famName: 'Livres', cat: 'decor', g: 'm', o: { solid: false },
  axes: [[['pile', 'Pile de livres', 'f'], ['grande', 'Grande pile de livres', 'f'], ['epars', 'Livres éparpillés', 'm'], ['ouvert', 'Livre ouvert', 'm'], ['grimoire', 'Grimoire sur lutrin', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'epars'], states: ['n', 'b', 'g'], mat: () => 'papier',
  build: ([t]) => (P) => {
    const R = P.R, cols = [0x6a1e18, 0x24402a, 0x22304e, 0x5a3a20, 0x1a1a1a, 0x8a6a30];
    if (t[0] === 'pile' || t[0] === 'grande') { let y = 0; for (let i = 0; i < (t[0] === 'pile' ? 5 : 11); i++) { const h = rr(R, 0.03, 0.06); P.b(rr(R, 0.18, 0.26), h, rr(R, 0.24, 0.32), rr(R, -0.02, 0.02), y + h / 2, 0, 'paper', pk(R, cols), 0, rr(R, -0.3, 0.3), 0); y += h; } return; }
    if (t[0] === 'epars') { for (let i = 0; i < 7; i++) P.b(rr(R, 0.16, 0.24), 0.04, rr(R, 0.22, 0.3), rr(R, -0.5, 0.5), 0.02 + (i % 2) * 0.03, rr(R, -0.4, 0.4), 'paper', pk(R, cols), 0, R() * 3, 0); return; }
    const y = t[0] === 'grimoire' ? 1.0 : 0;
    if (t[0] === 'grimoire') { P.c(0.04, 1.0, 0, 0.5, 0, 'wood', 0x3e2a1c); P.b(0.4, 0.03, 0.3, 0, 1.0, 0, 'wood', 0x3e2a1c, -0.4, 0, 0); P.c(0.2, 0.04, 0, 0.02, 0, 'wood', 0x3e2a1c, 0, 0, 0, 14); }
    for (const s of [-1, 1]) P.b(0.2, 0.025, 0.28, s * 0.105, y + 0.03, 0, 'paper', 0xe8e0c8, t[0] === 'grimoire' ? -0.4 : 0, 0, s * -0.06);
    P.b(0.42, 0.012, 0.3, 0, y + 0.012, 0, 'paper', 0x4a1a14, t[0] === 'grimoire' ? -0.4 : 0, 0, 0);
  },
});
mdFam({
  key: 'jou', famName: 'Jouets', cat: 'decor', g: 'm', o: { solid: false },
  axes: [[['ours', 'Ours en peluche', 'm'], ['poupee', 'Poupée de porcelaine', 'f'], ['cheval', 'Cheval à bascule', 'm'], ['train', 'Petit train en bois', 'm'], ['ballon', 'Ballon', 'm'], ['cubes', 'Cubes de bois', 'm'], ['landau', 'Landau', 'm'], ['boite', 'Boîte à musique', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'cubes'], states: ['n', 'u', 'g'], mat: ([t]) => (t[0] === 'ours' ? 'tissu' : 'bois'),
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'ours': P.s(0.12, 0, 0.13, 0, 'fabric', 0x8a5a30, 1, 1.1, 0.9, 12); P.s(0.09, 0, 0.32, 0.02, 'fabric', 0x8a5a30, 1, 1, 1, 12); for (const s of [-1, 1]) { P.s(0.035, s * 0.07, 0.4, 0.01, 'fabric', 0x7a4a24, 1, 1, 0.6, 8); P.s(0.05, s * 0.1, 0.04, 0.07, 'fabric', 0x8a5a30, 1, 0.8, 1.4, 8); P.s(0.045, s * 0.13, 0.18, 0.03, 'fabric', 0x8a5a30, 1, 1.4, 1, 8); } P.s(0.035, 0, 0.3, 0.09, 'fabric', 0xc8a070, 1, 0.8, 0.8, 8); break;
      case 'poupee': P.t(0.06, 0.13, 0.22, 0, 0.11, 0, 'fabric', 0x8a2a3a, 0, 0, 0, 12); P.s(0.06, 0, 0.28, 0, 'plastic', 0xe8d8c8, 1, 1.05, 1, 12); P.s(0.065, 0, 0.3, -0.01, 'paper', 0x6a4020, 1, 1, 1, 10); for (const s of [-1, 1]) P.s(0.01, s * 0.022, 0.29, 0.055, 'paint', 0x1a2a4a, 1, 1, 0.5, 6); break;
      case 'cheval': for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a0 = -0.6 + i * 0.2, a1 = a0 + 0.2; boxBetween(P, 'wood', 0x6a4a2e, [Math.sin(a0) * 0.9, 0.95 - Math.cos(a0) * 0.9 + 0.02, s * 0.14], [Math.sin(a1) * 0.9, 0.95 - Math.cos(a1) * 0.9 + 0.02, s * 0.14], 0.03, 0.04); } P.b(0.5, 0.18, 0.16, 0, 0.5, 0, 'wood', 0xd8d0c0); P.b(0.12, 0.3, 0.12, 0.28, 0.66, 0, 'wood', 0xd8d0c0, 0, 0, -0.4); P.b(0.22, 0.1, 0.1, 0.38, 0.78, 0, 'wood', 0xd8d0c0); for (const x of [-0.18, 0.18]) for (const s of [-1, 1]) P.b(0.04, 0.4, 0.04, x, 0.3, s * 0.12, 'wood', 0xd8d0c0); P.b(0.2, 0.03, 0.18, -0.05, 0.6, 0, 'fabric', 0x8a2a2a); break;
      case 'train': for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.22, c = [0xc83a2a, 0x2a5a9a, 0xe8b030][i]; P.b(0.18, 0.1, 0.1, x, 0.09, 0, 'wood', c); for (const dx of [-0.05, 0.05]) for (const s of [-1, 1]) P.c(0.035, 0.02, x + dx, 0.035, s * 0.055, 'wood', 0x2a2a2a, Math.PI / 2, 0, 0, 10); } P.c(0.025, 0.08, 0.28, 0.18, 0, 'wood', 0x2a2a2a); break;
      case 'ballon': P.s(0.11, 0, 0.11, 0, 'plastic', pk(R, [0xc83a2a, 0x2a5a9a, 0xe8b030]), 1, 1, 1, 14); break;
      case 'cubes': for (let i = 0; i < 6; i++) P.b(0.07, 0.07, 0.07, rr(R, -0.15, 0.15), 0.035 + (i > 3 ? 0.07 : 0), rr(R, -0.15, 0.15), 'wood', pk(R, [0xc83a2a, 0x2a5a9a, 0xe8b030, 0x3a8a4a]), 0, R() * 3, 0); break;
      case 'landau': for (const x of [-0.25, 0.25]) for (const s of [-1, 1]) P.o(0.12, 0.012, x, 0.12, s * 0.22, 'metal', 0x2a2a2a, 0, 0, 0); P.b(0.6, 0.3, 0.36, 0, 0.45, 0, 'fabric', 0x2a2a3a); P.s(0.2, -0.2, 0.62, 0, 'fabric', 0x2a2a3a, 1, 0.8, 0.9, 12); boxBetween(P, 'metal', 0x2a2a2a, [0.3, 0.55, 0], [0.5, 0.95, 0], 0.02); P.b(0.02, 0.02, 0.3, 0.5, 0.95, 0, 'metal', 0x2a2a2a); break;
      default: P.b(0.2, 0.12, 0.14, 0, 0.06, 0, 'wood', 0x6a3a24); P.b(0.2, 0.012, 0.14, 0, 0.14, -0.06, 'wood', 0x6a3a24, -1.2, 0, 0); P.c(0.03, 0.05, 0, 0.15, 0, 'plastic', 0xe8d0c0, 0, 0, 0, 10);
    }
  },
});
mdFam({
  key: 'anc', famName: 'Objets anciens', cat: 'decor', g: 'm',
  axes: [[['gramophone', 'Gramophone', 'm'], ['globe', 'Globe terrestre', 'm'], ['couture', 'Machine à coudre', 'f'], ['valise', 'Valise en cuir', 'f'], ['malle', 'Malle de voyage', 'f'], ['telephone', 'Téléphone à cadran', 'm'], ['appareil', 'Appareil photo à soufflet', 'm'], ['lanterne', 'Lanterne magique', 'f'], ['coffre', 'Coffre au trésor', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'u'], mat: ([t]) => (['valise', 'malle', 'coffre'].includes(t[0]) ? 'bois' : 'metal'), opts: ([t]) => ({ solid: ['malle', 'coffre'].includes(t[0]) }),
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'gramophone': P.b(0.36, 0.14, 0.36, 0, 0.07, 0, 'wood', 0x5a3a24); P.c(0.15, 0.01, 0, 0.145, 0, 'paint', 0x1a1a1a, 0, 0, 0, 20); P.c(0.012, 0.2, 0.12, 0.25, -0.1, 'metal', 0xb09040); P.t(0.22, 0.02, 0.35, 0.12, 0.45, 0.05, 'metal', 0xc8a040, 1.1, 0, 0, 16); break;
      case 'globe': P.c(0.12, 0.03, 0, 0.015, 0, 'wood', 0x5a3a24, 0, 0, 0, 14); P.c(0.015, 0.3, 0, 0.17, 0, 'wood', 0x5a3a24); P.s(0.17, 0, 0.5, 0, 'paint', 0x6a8aa0, 1, 1, 1, 16); P.o(0.19, 0.008, 0, 0.5, 0, 'metal', 0xb09040, 0, 0, 0.4); break;
      case 'couture': P.b(0.8, 0.04, 0.45, 0, 0.75, 0, 'wood', 0x5a3a24); for (const x of [-0.35, 0.35]) P.b(0.04, 0.73, 0.4, x, 0.37, 0, 'metal', 0x2a2a2a); P.b(0.35, 0.08, 0.14, 0, 0.81, 0, 'metal', 0x1a1a1a); P.b(0.08, 0.2, 0.12, 0.13, 0.92, 0, 'metal', 0x1a1a1a); P.b(0.3, 0.08, 0.1, 0, 1.0, 0, 'metal', 0x1a1a1a); P.c(0.08, 0.02, -0.2, 0.92, 0, 'metal', 0x9a9c9e, 0, 0, Math.PI / 2, 14); break;
      case 'valise': P.b(0.62, 0.42, 0.2, 0, 0.21, 0, 'fabric', 0x6a3a20); for (const x of [-0.2, 0.2]) P.b(0.04, 0.43, 0.21, x, 0.21, 0, 'fabric', 0x3a2010); P.o(0.06, 0.012, 0, 0.45, 0, 'fabric', 0x3a2010, 0, 0, 0); break;
      case 'malle': P.b(0.9, 0.5, 0.5, 0, 0.25, 0, 'wood', 0x4a3220); P.c(0.25, 0.9, 0, 0.5, 0, 'wood', 0x4a3220, 0, 0, Math.PI / 2, 14); for (const x of [-0.35, 0, 0.35]) { P.b(0.05, 0.52, 0.52, x, 0.26, 0, 'metal', 0x2a2a2a); P.c(0.255, 0.05, x, 0.5, 0, 'metal', 0x2a2a2a, 0, 0, Math.PI / 2, 14); } P.b(0.1, 0.12, 0.03, 0, 0.42, 0.26, 'metal', 0xb09040); break;
      case 'telephone': P.b(0.2, 0.1, 0.22, 0, 0.05, 0, 'plastic', 0x1a1a1a); P.c(0.07, 0.015, 0, 0.1, 0.04, 'plastic', 0xd8d4c8, 0.35, 0, 0, 14); P.b(0.24, 0.05, 0.06, 0, 0.14, -0.04, 'plastic', 0x1a1a1a); for (const x of [-0.1, 0.1]) P.s(0.035, x, 0.14, -0.04, 'plastic', 0x1a1a1a, 1, 0.8, 1, 8); break;
      case 'appareil': for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; boxBetween(P, 'wood', 0x6a4a2e, [0, 1.2, 0], [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4], 0.03); } P.b(0.22, 0.22, 0.2, 0, 1.32, -0.1, 'wood', 0x6a4a2e); P.t(0.06, 0.11, 0.3, 0, 1.32, 0.1, 'fabric', 0x1a1a1a, Math.PI / 2, 0, 0, 4); P.c(0.05, 0.06, 0, 1.32, 0.28, 'metal', 0xb09040, Math.PI / 2, 0, 0, 12); break;
      case 'lanterne': P.b(0.3, 0.3, 0.25, 0, 0.15, 0, 'metal', 0x2a2a2a); P.c(0.05, 0.25, 0, 0.36, 0, 'metal', 0x2a2a2a); P.c(0.06, 0.18, 0, 0.15, 0.2, 'metal', 0xb09040, Math.PI / 2, 0, 0, 12); break;
      default: P.b(0.7, 0.4, 0.42, 0, 0.2, 0, 'wood', 0x5a3a20); P.c(0.21, 0.7, 0, 0.4, 0, 'wood', 0x5a3a20, 0, 0, Math.PI / 2, 14); for (const x of [-0.25, 0.25]) P.b(0.05, 0.42, 0.44, x, 0.21, 0, 'metal', 0xb09040); P.b(0.7, 0.04, 0.2, 0, 0.52, 0.12, 'metal', 0xd8b040);
    }
  },
});
mdFam({
  key: 'ins', famName: 'Instruments de musique', cat: 'decor', g: 'm',
  axes: [[['guitare', 'Guitare sur pied', 'f'], ['violon', 'Violon dans son étui', 'm'], ['tambour', 'Tambour', 'm'], ['contrebasse', 'Contrebasse', 'f'], ['accordeon', 'Accordéon', 'm'], ['harpe', 'Harpe', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'c'], mat: () => 'bois', opts: ([t]) => ({ solid: ['contrebasse', 'harpe'].includes(t[0]) }),
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'guitare': for (const s of [-1, 1]) boxBetween(P, 'metal', 0x1a1a1a, [s * 0.15, 0, 0.1], [0, 0.6, -0.05], 0.015); P.s(0.17, 0, 0.32, 0, 'wood', 0x9a5a2a, 1.1, 1.3, 0.3, 14); P.s(0.13, 0, 0.6, 0, 'wood', 0x9a5a2a, 1.05, 1.1, 0.3, 14); P.b(0.05, 0.55, 0.03, 0, 0.98, 0, 'wood', 0x3a2414); P.c(0.04, 0.02, 0, 0.42, 0.05, 'paint', 0x1a1a1a, Math.PI / 2, 0, 0, 12); break;
      case 'violon': P.b(0.75, 0.1, 0.26, 0, 0.05, 0, 'fabric', 0x1a1a1a); P.s(0.13, -0.15, 0.1, 0, 'fabric', 0x1a1a1a, 1.4, 0.5, 1, 12); break;
      case 'tambour': P.c(0.3, 0.35, 0, 0.18, 0, 'paint', 0x8a2020, 0, 0, 0, 18); for (const y of [0.01, 0.35]) P.c(0.31, 0.03, 0, y, 0, 'wood', 0xc8a040, 0, 0, 0, 18); P.c(0.29, 0.005, 0, 0.36, 0, 'paper', 0xe8e0c8, 0, 0, 0, 18); break;
      case 'contrebasse': P.s(0.36, 0, 0.55, 0, 'wood', 0x7a3a1a, 1, 1.25, 0.32, 14); P.s(0.28, 0, 1.05, 0, 'wood', 0x7a3a1a, 1, 1.1, 0.32, 14); P.b(0.07, 0.8, 0.05, 0, 1.6, 0, 'wood', 0x2a1a10); P.c(0.01, 0.12, 0, 0.06, 0, 'metal', 0x8a8c8e); break;
      case 'accordeon': P.b(0.36, 0.38, 0.16, 0, 0.19, 0, 'plastic', 0x8a1a1a); P.b(0.36, 0.38, 0.06, 0, 0.19, 0.11, 'paper', 0x2a2a2a); P.b(0.08, 0.36, 0.17, -0.14, 0.19, 0, 'plastic', 0xe8e4d8); break;
      default: P.b(0.25, 0.12, 0.5, 0, 0.06, 0, 'wood', 0x8a5a2a); boxBetween(P, 'wood', 0xc8a040, [0, 0.1, -0.2], [0, 1.6, -0.15], 0.06); P.b(0.06, 0.4, 0.8, 0, 1.45, 0.15, 'wood', 0xc8a040, -0.4, 0, 0); for (let i = 0; i < 9; i++) boxBetween(P, 'metal', 0xe8e4d8, [0, 0.12, -0.18 + i * 0.05], [0, 1.25 + i * 0.05, -0.12 + i * 0.07], 0.004);
    }
  },
});

/* ==================================================================== bureau */
mdFam({
  key: 'cla', famName: 'Classeurs à tiroirs', cat: 'bureau', g: 'm',
  axes: [[['2', 'à 2 tiroirs', 2], ['3', 'à 3 tiroirs', 3], ['4', 'à 4 tiroirs', 4]], mdC('gris', 'vert', 'creme', 'noir', 'bleu')],
  nm: ([n, c]) => `Classeur ${n[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'c', 'x', 'r'], mat: () => 'metal',
  build: ([n, c]) => (P) => {
    const h = 0.36 * n[2] + 0.04, col = c[0] === 'vert' ? 0x5a6a52 : c[2];
    P.b(0.46, h, 0.62, 0, h / 2, 0, 'metal', col);
    for (let i = 0; i < n[2]; i++) { const y = 0.04 + 0.36 * i + 0.18; P.b(0.42, 0.32, 0.02, 0, y, 0.315, 'metal', mdShade(col, 1.06)); P.b(0.14, 0.03, 0.03, 0, y + 0.08, 0.335, 'metal', 0xb0b0ac); P.b(0.08, 0.04, 0.01, 0, y + 0.12, 0.327, 'paper', 0xe8e4d8); }
  },
});
mdFam({
  key: 'pail', famName: 'Paillasses de laboratoire', cat: 'bureau', g: 'f',
  axes: [[['courte', 'courte', 1.6], ['longue', 'longue', 3.0]], [['carrelee', 'carrelée', 'tex:tiles_white'], ['resine', 'en résine noire', 'tex:gx_rs_unie_anthracite']]],
  nm: ([l, t]) => `Paillasse ${l[1]} ${t[1]}`, states: ['n', 'u', 'g'], mat: () => 'pierre',
  build: ([l, t]) => (P) => {
    const L = l[2], R = P.R;
    P.b(L, 0.86, 0.75, 0, 0.43, 0, 'paint', 0xd8d4c8); P.b(L + 0.04, 0.05, 0.8, 0, 0.885, 0, t[2], 0xffffff);
    for (let i = 0; i < Math.round(L / 0.6); i++) P.b(0.5, 0.7, 0.02, -L / 2 + 0.6 * (i + 0.5) + 0.05, 0.43, 0.38, 'paint', 0xc8c4b8);
    P.b(0.4, 0.02, 0.35, L / 2 - 0.4, 0.915, 0, 'metal', 0x6a6c6e); P.c(0.012, 0.35, L / 2 - 0.4, 1.08, -0.3, 'metal', 0xc8cacc); P.c(0.01, 0.15, L / 2 - 0.4, 1.25, -0.23, 'metal', 0xc8cacc, Math.PI / 2, 0, 0, 8);
    for (let i = 0; i < Math.round(L * 3); i++) { const x = rr(R, -L / 2 + 0.1, L / 2 - 0.7), h = rr(R, 0.08, 0.25); P.c(rr(R, 0.025, 0.06), h, x, 0.91 + h / 2, rr(R, -0.25, 0.25), 'glass', pk(R, [0xb0d0c0, 0xc0b080, 0x90c0d0, 0xd0a0b0]), 0, 0, 0, 10); }
    P.b(L, 0.6, 0.25, 0, 1.55, -0.28, 'wood', 0x9a7a5a); P.b(L, 0.03, 0.27, 0, 1.25, -0.28, 'wood', 0x8a6a4a);
  },
});
mdFam({
  key: 'labo', famName: 'Matériel de laboratoire', cat: 'bureau', g: 'm', o: { solid: false },
  axes: [[['microscope', 'Microscope', 'm'], ['centrifugeuse', 'Centrifugeuse', 'f'], ['verrerie', 'Verrerie et bec Bunsen', 'f'], ['balance', 'Balance de précision', 'f'], ['incubateur', 'Incubateur', 'm'], ['bocaux', 'Bocaux de spécimens', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], t[0] === 'bocaux'], states: ['n', 'c'], mat: () => 'metal',
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'microscope': P.b(0.16, 0.03, 0.22, 0, 0.015, 0, 'metal', 0x2a2a2a); P.b(0.04, 0.3, 0.06, 0, 0.16, -0.08, 'metal', 0x2a2a2a, 0.2, 0, 0); P.c(0.02, 0.2, 0, 0.3, 0, 'metal', 0x1a1a1a, -0.4, 0, 0, 10); P.b(0.12, 0.012, 0.12, 0, 0.12, 0.02, 'metal', 0x6a6a6a); break;
      case 'centrifugeuse': P.b(0.4, 0.3, 0.45, 0, 0.15, 0, 'metal', 0xd8d8d4); P.c(0.16, 0.02, 0, 0.3, 0, 'plastic', 0x6a7a8a, 0, 0, 0, 16); P.b(0.12, 0.06, 0.02, 0.1, 0.2, 0.23, 'plastic', 0x1a2a1a); break;
      case 'verrerie': for (let i = 0; i < 6; i++) { const x = rr(R, -0.25, 0.25), z = rr(R, -0.12, 0.12), h = rr(R, 0.1, 0.22); if (i % 2) { P.t(0.02, 0.06, h, x, h / 2, z, 'glass', 0xa8c8c0, 0, 0, 0, 10); P.c(0.015, 0.06, x, h + 0.03, z, 'glass', 0xa8c8c0, 0, 0, 0, 8); } else P.c(0.03, h, x, h / 2, z, 'glass', pk(R, [0xa0d0a0, 0xd0a0c0, 0x90b0d0]), 0, 0, 0, 10); } P.c(0.04, 0.02, 0.3, 0.01, 0, 'metal', 0x3a3a3a, 0, 0, 0, 10); P.c(0.012, 0.14, 0.3, 0.09, 0, 'metal', 0x8a8c8e); break;
      case 'balance': P.b(0.25, 0.08, 0.3, 0, 0.04, 0, 'metal', 0xe0e0dc); P.b(0.22, 0.2, 0.22, 0, 0.18, -0.02, 'glass', 0xc0d0d4); P.b(0.2, 0.04, 0.02, 0, 0.05, 0.15, 'plastic', 0x1a3a1a); break;
      case 'incubateur': P.b(0.6, 0.7, 0.55, 0, 0.35, 0, 'metal', 0xe0e0dc); P.b(0.5, 0.55, 0.02, 0, 0.36, 0.28, 'glass', 0x9ab0b8); P.b(0.5, 0.012, 0.45, 0, 0.3, 0, 'metal', 0x9a9c9e); break;
      default: for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.16; P.c(0.065, 0.24, x, 0.12, 0, 'glass', 0xc8d8b8, 0, 0, 0, 12); P.s(0.04, x, 0.1, 0, 'skin', pk(R, [0xc89a8a, 0xa8b08a, 0x9a7a6a]), 1, 1.2, 1, 8); P.c(0.068, 0.02, x, 0.25, 0, 'metal', 0x8a8c8e, 0, 0, 0, 12); }
    }
  },
});
mdFam({
  key: 'tabn', famName: 'Tableaux de classe et d’affichage', cat: 'bureau', g: 'm', o: { wall: true, solid: false },
  axes: [[['noir', 'Tableau noir', 0x1e2a22], ['vert', 'Tableau vert', 0x234a32], ['blanc', 'Tableau blanc', 0xeceae4], ['liege', 'Panneau de liège', 0xb08a5a]], [['petit', 'petit', 1.2], ['grand', 'grand', 2.4]]],
  nm: ([t, s]) => `${t[1]} (${s[1]})`, states: ['n', 'u'], mat: () => 'bois',
  build: ([t, s]) => (P) => {
    const W = s[2], R = P.R;
    P.b(W + 0.08, 1.08, 0.04, 0, 1.5, 0.02, 'wood', t[0] === 'blanc' ? 0xb0b2b4 : 0x6a4a2e);
    P.b(W, 1.0, 0.042, 0, 1.5, 0.022, t[0] === 'liege' ? 'tex:gx_lg_naturel' : 'paint', t[0] === 'liege' ? 0xffffff : t[2]);
    P.b(W, 0.04, 0.08, 0, 0.98, 0.05, 'wood', 0x6a4a2e);
    if (t[0] === 'liege') for (let i = 0; i < Math.round(W * 5); i++) P.b(rr(R, 0.12, 0.22), rr(R, 0.15, 0.28), 0.004, rr(R, -W / 2 + 0.15, W / 2 - 0.15), 1.5 + rr(R, -0.3, 0.3), 0.045, 'paper', pk(R, [0xf0ece0, 0xe8d880, 0xd0e0f0, 0xf0c8c8]), 0, 0, rr(R, -0.15, 0.15));
    else for (let i = 0; i < Math.round(W * 4); i++) P.b(rr(R, 0.15, 0.5), 0.012, 0.003, rr(R, -W / 2 + 0.3, W / 2 - 0.3), 1.5 + rr(R, -0.35, 0.35), 0.045, 'paint', t[0] === 'blanc' ? 0x2a3a8a : 0xd8d8d0);
  },
});
mdFam({
  key: 'clo', famName: 'Cloisons de bureau', cat: 'bureau', g: 'f',
  axes: [[['basse', 'basse', 1.2], ['haute', 'haute', 1.8]], mdC('gris', 'bleu', 'creme')], nm: ([s, c]) => `Cloison de bureau ${s[1]} ${gxAcc(c[1], true, false)}`, states: ['n', 'x'], mat: () => 'tissu',
  build: ([s, c]) => (P) => { const H = s[2]; P.b(1.6, H, 0.06, 0, H / 2 + 0.03, 0, 'fabric', c[2]); P.b(1.62, 0.04, 0.07, 0, H + 0.04, 0, 'metal', 0x8a8c8e); for (const x of [-0.8, 0.8]) { P.b(0.04, H, 0.07, x, H / 2 + 0.03, 0, 'metal', 0x8a8c8e); P.b(0.05, 0.03, 0.4, x, 0.015, 0, 'metal', 0x6a6c6e); } },
});

/* ============================================================ électronique */
mdFam({
  key: 'tv', famName: 'Téléviseurs', cat: 'electro', g: 'm',
  axes: [[['tube', 'à tube'], ['console', 'meuble'], ['plat', 'à écran plat']], mdC('gris', 'noir', 'marron')],
  nm: ([t, c]) => `Téléviseur ${t[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'e', 'c'], mat: () => 'plastique',
  build: ([t, c]) => (P) => {
    const col = c[0] === 'marron' ? 0x5a3a24 : c[2], f = c[0] === 'marron' ? 'wood' : 'plastic';
    if (t[0] === 'plat') { P.b(1.1, 0.64, 0.05, 0, 1.0, 0, 'plastic', 0x1a1a1c); P.b(1.04, 0.58, 0.052, 0, 1.0, 0.002, 'glow', 0x3a6a9a); P.b(0.3, 0.02, 0.2, 0, 0.6, 0, 'plastic', 0x2a2a2a); P.b(0.05, 0.4, 0.05, 0, 0.78, -0.02, 'plastic', 0x2a2a2a); P.b(1.2, 0.58, 0.45, 0, 0.29, 0, 'wood', 0x3a3a3c); return; }
    if (t[0] === 'console') { P.b(0.9, 0.8, 0.5, 0, 0.5, 0, 'wood', 0x5a3a24); mdLegs(P, 0.9, 0.5, 0.12, 0.04, 'wood', 0x3a2414, 0.03, 'fuse'); P.b(0.5, 0.4, 0.02, -0.12, 0.62, 0.255, 'glow', 0x8ab0a0); P.b(0.2, 0.5, 0.02, 0.3, 0.55, 0.255, 'fabric', 0x3a2a1a); return; }
    P.b(0.55, 0.45, 0.45, 0, 0.225 + 0.75, 0, f, col); P.b(0.42, 0.33, 0.02, -0.04, 0.975, 0.23, 'glow', 0x8ab0a0); for (let i = 0; i < 2; i++) P.c(0.02, 0.02, 0.22, 1.05 - i * 0.08, 0.235, 'plastic', 0x1a1a1a, Math.PI / 2, 0, 0, 8);
    for (const s of [-1, 1]) boxBetween(P, 'metal', 0x9a9c9e, [s * 0.05, 1.2, 0], [s * 0.2, 1.45, -0.05], 0.006);
    P.b(0.6, 0.04, 0.5, 0, 0.73, 0, 'wood', 0x6a4a2e); mdLegs(P, 0.6, 0.5, 0.71, 0.04, 'wood', 0x5a3a24, 0.03);
  },
});
mdFam({
  key: 'ord', famName: 'Ordinateurs', cat: 'electro', g: 'm',
  axes: [[['ancien', 'Ordinateur ancien', 'm'], ['portable', 'Ordinateur portable', 'm'], ['serveur', 'Baie de serveurs', 'f'], ['terminal', 'Terminal à écran vert', 'm'], ['poste', 'Poste de travail double écran', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'e', 'c'], mat: () => 'plastique', opts: ([t]) => ({ solid: t[0] === 'serveur' || t[0] === 'poste' }),
  build: ([t]) => (P) => {
    const R = P.R;
    switch (t[0]) {
      case 'ancien': P.b(0.42, 0.38, 0.4, 0, 0.19 + 0.1, 0, 'plastic', 0xd0c8b0); P.b(0.32, 0.25, 0.02, 0, 0.3, 0.2, 'glow', 0x4a8a6a); P.b(0.45, 0.1, 0.42, 0, 0.05, 0, 'plastic', 0xc8c0a8); P.b(0.45, 0.03, 0.16, 0, 0.015, 0.36, 'plastic', 0xc8c0a8); break;
      case 'portable': P.b(0.34, 0.02, 0.24, 0, 0.01, 0, 'plastic', 0x2a2c2e); P.b(0.34, 0.22, 0.012, 0, 0.12, -0.12, 'plastic', 0x2a2c2e, -0.25, 0, 0); P.b(0.31, 0.19, 0.014, 0, 0.12, -0.115, 'glow', 0x5a8ac0, -0.25, 0, 0); break;
      case 'serveur': P.b(0.6, 2.0, 0.9, 0, 1.0, 0, 'metal', 0x1e2022); P.b(0.56, 1.9, 0.02, 0, 1.0, 0.45, 'glass', 0x3a4a52); for (let i = 0; i < 16; i++) { const y = 0.12 + i * 0.115; P.b(0.5, 0.09, 0.02, 0, y, 0.43, 'metal', 0x2e3032); for (let j = 0; j < 4; j++) P.b(0.01, 0.01, 0.01, -0.2 + j * 0.03, y, 0.445, 'glow', pk(R, [0x40ff60, 0xffa020, 0x40a0ff])); } break;
      case 'terminal': P.b(0.4, 0.36, 0.42, 0, 0.18 + 0.03, 0, 'plastic', 0x8a8478); P.b(0.3, 0.24, 0.02, 0, 0.22, 0.21, 'glow', 0x40d060); P.b(0.45, 0.04, 0.18, 0, 0.02, 0.36, 'plastic', 0x6a6458); break;
      default: P.b(1.4, 0.04, 0.7, 0, 0.75, 0, 'wood', 0xb8b0a0); mdLegs(P, 1.4, 0.7, 0.73, 0.04, 'metal', 0x4a4c4e, 0.04); for (const x of [-0.28, 0.28]) { P.b(0.52, 0.32, 0.04, x, 1.05, -0.15, 'plastic', 0x1a1a1c, 0, -x * 0.5, 0); P.b(0.48, 0.28, 0.042, x, 1.05, -0.148, 'glow', 0x4a7ab0, 0, -x * 0.5, 0); P.b(0.04, 0.18, 0.04, x, 0.86, -0.17, 'plastic', 0x2a2a2a); } P.b(0.45, 0.02, 0.15, 0, 0.78, 0.12, 'plastic', 0x2a2a2a); P.b(0.2, 0.42, 0.45, 0.55, 0.21, 0, 'plastic', 0x1a1a1c);
    }
  },
});
mdFam({
  key: 'rad', famName: 'Postes de radio', cat: 'electro', g: 'm', o: { solid: false },
  axes: [[['tsf', 'Poste de TSF', 'm'], ['transistor', 'Transistor', 'm'], ['militaire', 'Radio militaire', 'f'], ['stereo', 'Radiocassette', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'e', 'c'], mat: () => 'plastique',
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'tsf': P.b(0.5, 0.36, 0.25, 0, 0.18, 0, 'wood', 0x6a4226); P.c(0.25, 0.25, 0, 0.36, 0, 'wood', 0x6a4226, Math.PI / 2, 0, 0, 16); P.b(0.3, 0.2, 0.01, -0.06, 0.24, 0.126, 'fabric', 0xc8b088); P.b(0.08, 0.04, 0.012, 0.15, 0.1, 0.127, 'glow', 0xe8b050); for (const x of [-0.1, 0.05]) P.c(0.025, 0.03, x, 0.06, 0.13, 'wood', 0x2a1a10, Math.PI / 2, 0, 0, 10); break;
      case 'transistor': P.b(0.3, 0.18, 0.1, 0, 0.09, 0, 'plastic', 0xb83a2a); P.b(0.16, 0.12, 0.01, -0.05, 0.09, 0.052, 'metal', 0xb0b2b4); P.b(0.06, 0.03, 0.012, 0.09, 0.12, 0.052, 'glow', 0xe8e0a0); P.c(0.004, 0.35, 0.12, 0.35, -0.03, 'metal', 0xc8cacc, 0, 0, -0.3, 6); break;
      case 'militaire': P.b(0.45, 0.32, 0.3, 0, 0.16, 0, 'metal', 0x4c5a3c); P.b(0.4, 0.2, 0.01, 0, 0.18, 0.152, 'metal', 0x3a4630); for (let i = 0; i < 4; i++) P.c(0.025, 0.03, -0.14 + i * 0.09, 0.22, 0.16, 'plastic', 0x1a1a1a, Math.PI / 2, 0, 0, 10); P.b(0.06, 0.04, 0.012, 0.12, 0.12, 0.155, 'glow', 0xe8a040); P.c(0.005, 0.8, 0.18, 0.7, -0.1, 'metal', 0x3a3a3a); P.b(0.1, 0.08, 0.06, -0.15, 0.36, 0.05, 'plastic', 0x1a1a1a); break;
      default: P.b(0.55, 0.25, 0.14, 0, 0.125, 0, 'plastic', 0x2a2a2c); for (const x of [-0.18, 0.18]) P.c(0.08, 0.02, x, 0.12, 0.07, 'metal', 0x5a5c5e, Math.PI / 2, 0, 0, 16); P.b(0.16, 0.06, 0.012, 0, 0.17, 0.071, 'glow', 0x60c0e0); P.b(0.5, 0.02, 0.03, 0, 0.26, 0, 'metal', 0xb0b2b4);
    }
  },
});
mdFam({
  key: 'dist', famName: 'Distributeurs automatiques', cat: 'electro', g: 'm',
  axes: [[['boissons', 'de boissons'], ['friandises', 'de friandises'], ['cafe', 'de café']], mdC('rouge', 'bleu', 'noir')],
  nm: ([t, c]) => `Distributeur ${t[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'e', 'c', 'x'], mat: () => 'plastique',
  build: ([t, c]) => (P) => {
    const R = P.R, col = c[2];
    P.b(0.9, 1.85, 0.8, 0, 0.925, 0, 'metal', col);
    if (t[0] === 'boissons') { P.b(0.62, 1.2, 0.02, -0.08, 1.1, 0.405, 'glow', mdMix(col, 0xffffff, 0.45)); P.b(0.16, 0.5, 0.02, 0.33, 1.2, 0.405, 'plastic', 0x1a1a1a); P.b(0.5, 0.15, 0.03, -0.08, 0.3, 0.41, 'plastic', 0x1a1a1a); }
    else if (t[0] === 'friandises') { P.b(0.6, 1.25, 0.02, -0.1, 1.1, 0.405, 'glass', 0x9ab0b8); for (let r = 0; r < 5; r++) for (let i = 0; i < 5; i++) P.b(0.08, 0.12, 0.08, -0.34 + i * 0.12, 0.6 + r * 0.24, 0.3, 'paper', pk(R, [0xc83a2a, 0xe8b030, 0x3a6aa0, 0x8a4a2a, 0x3a8a4a])); P.b(0.6, 1.25, 0.02, -0.1, 1.1, 0.2, 'glow', 0xe0e8f0); P.b(0.18, 0.5, 0.02, 0.33, 1.1, 0.405, 'plastic', 0x2a2a2a); }
    else { P.b(0.5, 0.6, 0.02, -0.05, 1.3, 0.405, 'glow', 0xe8d8b0); P.b(0.3, 0.3, 0.15, -0.05, 0.6, 0.35, 'plastic', 0x1a1a1a); P.c(0.035, 0.08, -0.05, 0.52, 0.35, 'paper', 0xe8e4dc, 0, 0, 0, 10); }
  },
});
mdFam({
  key: 'arc', famName: 'Bornes d’arcade', cat: 'electro', g: 'f', axes: [mdC('rouge', 'bleu', 'noir', 'jaune')],
  nm: ([c]) => `Borne d’arcade ${gxAcc(c[1], true, false)}`, states: ['n', 'e', 'c', 'x'], mat: () => 'plastique',
  build: ([c]) => (P) => {
    P.b(0.62, 1.1, 0.75, 0, 0.55, 0, 'wood', 0x1a1a1c); P.b(0.62, 0.7, 0.45, 0, 1.45, -0.15, 'wood', 0x1a1a1c);
    for (const x of [-0.315, 0.315]) P.b(0.012, 1.8, 0.76, x, 0.9, 0, 'paint', c[2]);
    P.b(0.5, 0.42, 0.02, 0, 1.4, 0.08, 'glow', 0x6a8ae0, -0.25, 0, 0); P.b(0.56, 0.12, 0.02, 0, 1.75, 0.07, 'glow', mdMix(c[2], 0xffffff, 0.4));
    P.b(0.6, 0.06, 0.3, 0, 1.08, 0.2, 'plastic', 0x2a2a2a, -0.2, 0, 0); P.c(0.012, 0.06, -0.12, 1.14, 0.22, 'metal', 0x1a1a1a); for (let i = 0; i < 3; i++) P.c(0.02, 0.02, 0.05 + i * 0.06, 1.12, 0.22, 'plastic', [0xe02020, 0x2060e0, 0xe0c020][i], 0, 0, 0, 10);
  },
});
mdFam({
  key: 'juke', famName: 'Juke-box', cat: 'electro', g: 'm', axes: [mdC('rouge', 'creme')], nm: ([c]) => `Juke-box ${gxAcc(c[1], false, false)}`, states: ['n', 'e', 'c'], mat: () => 'plastique',
  build: ([c]) => (P) => { P.b(0.9, 1.1, 0.65, 0, 0.55, 0, 'wood', 0x6a3a1e); P.c(0.45, 0.65, 0, 1.1, 0, 'wood', 0x6a3a1e, Math.PI / 2, 0, 0, 20); P.c(0.38, 0.66, 0, 1.12, 0, 'glow', mdMix(c[2], 0xffd080, 0.5), Math.PI / 2, 0, 0, 20); P.b(0.6, 0.3, 0.02, 0, 0.75, 0.33, 'glass', 0x9ab0b8); P.b(0.7, 0.35, 0.02, 0, 0.3, 0.33, 'fabric', 0xc8a060); for (const x of [-0.42, 0.42]) P.b(0.06, 1.0, 0.04, x, 0.6, 0.33, 'glow', c[2]); },
});
mdFam({
  key: 'hp', famName: 'Sonorisation', cat: 'electro', g: 'f', axes: [[['enceinte', 'Enceinte', 'f'], ['sono', 'Sono de concert', 'f'], ['megaphone', 'Haut-parleur sur poteau', 'm'], ['sirene', 'Sirène d’alerte', 'f']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'c'], mat: () => 'plastique',
  build: ([t]) => (P) => {
    if (t[0] === 'enceinte') { P.b(0.4, 0.7, 0.35, 0, 0.35, 0, 'wood', 0x1a1a1c); P.c(0.14, 0.02, 0, 0.42, 0.18, 'plastic', 0x2a2a2a, Math.PI / 2, 0, 0, 16); P.c(0.06, 0.02, 0, 0.16, 0.18, 'plastic', 0x2a2a2a, Math.PI / 2, 0, 0, 12); return; }
    if (t[0] === 'sono') { for (let i = 0; i < 2; i++) for (const x of [-0.4, 0.4]) { P.b(0.7, 0.9, 0.6, x, 0.45 + i * 0.9, 0, 'wood', 0x1a1a1c); P.c(0.25, 0.02, x, 0.5 + i * 0.9, 0.3, 'plastic', 0x2a2a2a, Math.PI / 2, 0, 0, 16); } return; }
    P.c(0.06, 4, 0, 2, 0, 'wood', 0x5a4a3a); for (const a of [0.4, 2.5]) P.t(0.08, 0.25, 0.4, Math.cos(a) * 0.2, 3.7, Math.sin(a) * 0.2, 'metal', t[0] === 'sirene' ? 0xb8b8b4 : 0x6a6e6a, Math.PI / 2, -a + Math.PI / 2, 0, 12);
  },
});
mdFam({
  key: 'bur2', famName: 'Machines de bureau', cat: 'electro', g: 'f', axes: [[['copieur', 'Photocopieuse', 'f'], ['imprimante', 'Imprimante', 'f'], ['caisse', 'Caisse enregistreuse', 'f'], ['standard', 'Standard téléphonique', 'm'], ['fax', 'Télécopieur', 'm']]],
  nm: ([t]) => t[1], gp: ([t]) => [t[2], false], states: ['n', 'c'], mat: () => 'plastique', opts: ([t]) => ({ solid: t[0] === 'copieur' || t[0] === 'standard' }),
  build: ([t]) => (P) => {
    switch (t[0]) {
      case 'copieur': P.b(0.6, 0.9, 0.65, 0, 0.45, 0, 'plastic', 0xd8d8d2); P.b(0.6, 0.06, 0.65, 0, 0.93, 0, 'plastic', 0x6a6c6e); P.b(0.3, 0.04, 0.2, 0.4, 0.6, 0, 'plastic', 0xc8c8c2); P.b(0.12, 0.06, 0.012, -0.15, 0.85, 0.33, 'glow', 0x60c060); break;
      case 'imprimante': P.b(0.45, 0.2, 0.38, 0, 0.1, 0, 'plastic', 0xd0d0ca); P.b(0.3, 0.012, 0.2, 0, 0.21, -0.05, 'paper', 0xf0f0ec, 0.3, 0, 0); break;
      case 'caisse': P.b(0.35, 0.15, 0.4, 0, 0.075, 0, 'metal', 0x4a4a4c); P.b(0.32, 0.1, 0.25, 0, 0.2, -0.05, 'metal', 0x5a5a5c, -0.3, 0, 0); P.b(0.2, 0.06, 0.02, 0, 0.32, -0.15, 'glow', 0x60e080); break;
      case 'standard': P.b(1.0, 1.4, 0.5, 0, 0.7, 0, 'wood', 0x3a2a1e); P.b(0.9, 0.7, 0.02, 0, 1.0, 0.25, 'paint', 0x1a1a1a); for (let i = 0; i < 40; i++) P.c(0.012, 0.02, -0.4 + (i % 10) * 0.09, 0.8 + Math.floor(i / 10) * 0.12, 0.26, 'metal', 0xb09040, Math.PI / 2, 0, 0, 6); P.b(1.0, 0.04, 0.4, 0, 0.75, 0.4, 'wood', 0x5a3a24); break;
      default: P.b(0.35, 0.12, 0.3, 0, 0.06, 0, 'plastic', 0xd0ccc0); P.b(0.2, 0.04, 0.08, -0.06, 0.13, 0.1, 'plastic', 0x2a2a2a); P.b(0.25, 0.012, 0.15, 0, 0.14, -0.08, 'paper', 0xf0f0ec, 0.4, 0, 0);
    }
  },
});
mdFam({
  key: 'mon', famName: 'Écrans de contrôle', cat: 'electro', g: 'm', o: { wall: true, solid: false },
  axes: [[['1', 'Écran de contrôle', 1, 1], ['4', 'Quatre écrans de contrôle', 2, 2], ['9', 'Mur de neuf écrans', 3, 3]], [['vert', 'verts', 0x40c070], ['bleu', 'bleus', 0x4a8ae0], ['ambre', 'ambre', 0xe0a040]]],
  nm: ([n, c]) => `${n[1]} ${n[2] === 1 ? gxAcc(c[1].replace(/s$/, ''), false, false) : c[1]}`, gp: ([n]) => ['m', n[2] > 1], states: ['n', 'e', 'c'], mat: () => 'plastique',
  build: ([n, c]) => (P) => {
    const R = P.R, s = 0.55;
    for (let i = 0; i < n[2]; i++) for (let j = 0; j < n[3]; j++) {
      const x = (i - (n[2] - 1) / 2) * (s + 0.04), y = 1.5 + (j - (n[3] - 1) / 2) * (s * 0.78 + 0.04);
      P.b(s, s * 0.78, 0.1, x, y, 0.05, 'plastic', 0x1a1a1c); P.b(s - 0.06, s * 0.78 - 0.06, 0.102, x, y, 0.051, R() < 0.15 ? 'plastic' : 'glow', R() < 0.15 ? 0x0a0a0a : mdShade(c[2], 0.7 + R() * 0.3));
    }
  },
});
