/* --------------------------------------------------------------- Ennemis --
   Planche « Ce qui marche dans la poussière » (page 7).
   Desséchés : l'équipe de fouilles (l'Archéologue : chemise kaki, chapeau de brousse, foulard,
   besace ; il lâche parfois un chargeur), les ouvriers (tunique, turban) et les villageois de
   Sekhet (galabeya bleue, calotte blanche). Peau tannée, maigres ; yeux turquoise visibles à 150 m
   dans la poussière. 150 PV en manche 1, +100 par manche jusqu'à la 10, puis ×1,1 ; ils marchent,
   puis courent à partir de la manche 6. Tir à la tête : dégâts doublés.
   Rôdeur des sables : seulement dans la Tempête et le Khamsin, il sort du sable ; deux fois les PV
   d'un Desséché ; très rapide en ligne droite, lent dans les virages ; il agrippe un joueur à pied
   2 s (seul, on s'en libère au corps-à-corps : le khépesh depuis le jeu 2.0.4, avant lui le couteau),
   immobilise 3 s un véhicule qui roule à moins de 20 km/h ; les phares braqués sur lui le font
   replonger sous le sable 5 s. Squelette du Molosse (allures,
   pattes posées au sol) avec ses propres os : côtes, longue queue d'échine, crâne aux yeux turquoise. */
const KH_EYE = 0x5ff2e2;                        // turquoise : réservé au surnaturel (planche « La couleur dit qui est qui »)
const KH_EYE_LIN = new THREE.Color(KH_EYE).convertSRGBToLinear().getHex();   // teinte d'instance (paintZombieSlot ne convertit pas celle des yeux)
const KH_TYPES = [
  {
    id: 'kh_arch', num: 'K-01', name: 'L’Archéologue', cls: 'Desséché (Khamsin)', from: 1, model: 'kh_arch', facts: 'kh', maps: ['khamsin'], kh: true,
    desc: 'L’équipe de fouilles du Km 47. Il a ouvert le sceau du sanctuaire ; le sable l’a séché sur pied.',
    sign: 'Chemise kaki, chapeau de brousse, foulard rouge et besace : il lâche parfois un chargeur.',
    mult: { hp: 1, speed: 1, damage: 1 }, headMult: 2, helmet: false, ability: 'Horde', drop: { item: 'mag', chance: 0.3 },
  },
  {
    id: 'kh_ouvrier', num: 'K-02', name: 'L’Ouvrier', cls: 'Desséché (Khamsin)', from: 1, model: 'kh_ouvrier', facts: 'kh', maps: ['khamsin'], kh: true,
    desc: 'Un terrassier du chantier de fouilles. Il creusait encore quand la tempête est passée.',
    sign: 'Tunique olive serrée d’une ceinture d’étoffe, turban clair, jambes nues.',
    mult: { hp: 1, speed: 1, damage: 1 }, headMult: 2, helmet: false, ability: 'Horde',
  },
  {
    id: 'kh_villageois', num: 'K-03', name: 'Le Villageois', cls: 'Desséché (Khamsin)', from: 1, model: 'kh_villageois', facts: 'kh', maps: ['khamsin'], kh: true,
    desc: 'Un habitant de Sekhet. L’oasis n’a pas suffi à le garder de la poussière.',
    sign: 'Longue galabeya bleue jusqu’aux chevilles, calotte blanche.',
    mult: { hp: 1, speed: 1, damage: 1 }, headMult: 2, helmet: false, ability: 'Horde',
  },
];
/* Le pilote du KH-47 : un Desséché à part, unique ; il erre autour du bassin de l'oasis et garde la clé de contact. */
const KH_PILOTE_TYPE = {
  id: 'kh_pilote', num: 'K-06', name: 'Le Pilote', cls: 'Desséché (Khamsin)', tag: 'Oasis de Sekhet', model: 'kh_pilote', facts: 'kh', maps: ['khamsin'], kh: true, pilot: true,
  desc: 'Le pilote du KH-47. Il s’est posé à l’aérodrome la veille de la tempête ; il erre depuis autour du bassin, la clé de contact dans la poche.',
  sign: 'Blouson de cuir à col de mouton, serre-tête et lunettes de vol, écharpe blanche. Il porte la clé de contact (pièce ③).',
  mult: { hp: 4, speed: 1, damage: 1 }, headMult: 2, helmet: false, ability: 'Horde',
};
/* Le Rôdeur des sables : squelette du Molosse, ses propres os ; il n'est pas un type de pièce. */
const RODEUR_TYPE = {
  id: 'kh_rodeur', num: 'K-04', name: 'Le Rôdeur des sables', cls: 'Piège de la tempête (Khamsin)', tag: 'Tempête et Khamsin', model: 'kh_rodeur', facts: 'rodeur',
  maps: ['khamsin'], dog: true, kh: true,
  desc: 'Une chose faite d’os et de sable, longue comme une voiture. Elle ne sort du sol que lorsque la tempête couvre tout.',
  mult: { hp: 2, speed: 3, damage: 0.7 }, headMult: 2, ability: 'Embuscade',
};
/* Fiches de l'écran « Modèles » et compteurs d'éliminations, après celles de Bunker 7. Les Desséchés
   ne sont pas dans ZOMBIE_TYPES : les cartes et les Mod Tools ne les proposent pas (leurs règles,
   PV et allures, sont celles de Khamsin). */
SPECIMEN_TYPES.push(...KH_TYPES, RODEUR_TYPE);       // puis le Gardien (K-05) et le pilote (K-06) : voir le Gardien

/* Points de vie et allures des Desséchés (planche). */
const khHp = (r) => Math.round(r <= 10 ? 150 + 100 * (r - 1) : 1050 * Math.pow(1.1, r - 10));
function khSpeedType(r) {
  if (OW.worldId === 'lune') return luSpeedType(r);
  const x = Math.random();
  if (r < 6) return 'walk';
  if (r < 8) return x < 0.35 ? 'walk' : x < 0.6 ? 'jog' : 'run';
  if (r < 12) return x < 0.15 ? 'walk' : x < 0.4 ? 'jog' : 'run';
  return x < 0.25 ? 'jog' : 'run';
}
/* Type selon le lieu le plus proche : archéologues au camp et au plateau, villageois à l'oasis, ouvriers ailleurs. */
const KH_MIX = { A: [0.6, 0.3, 0.1], B: [0.45, 0.4, 0.15], C: [0.2, 0.5, 0.3], D: [0.1, 0.2, 0.7], E: [0.1, 0.7, 0.2], F: [0.35, 0.35, 0.3], G: [0.2, 0.6, 0.2] };
function khZombieType(zi) {
  if (OW.worldId === 'lune') return luZombieType();     // Lune : astronautes et mineurs
  const L = KH.locs[zi] || KH.locs[0], w = KH_MIX[L.id], x = Math.random();
  return KH_TYPES[x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2];
}
/* Teintes : peau tannée, étoffes délavées, yeux turquoise. */
function khLook(look, type) {
  if (type && type.lu) return luLook(look, type);
  look.eyes = KH_EYE_LIN;
  look.skin = pick([0xffffff, 0xf2e8dc, 0xfff4e6, 0xe8dccc]);
  look.cloth = pick([0xffffff, 0xf4eadc, 0xe6e2d8, 0xfaf0e2]);
  look.helmet = false;
  return look;
}

/* ---- Modèles (pièces des os du squelette humain, comme les variantes du Fantassin) */
const KH_DK = (C) => ({ ...zCommonK(C), skin: C(0x8c6e50, 1.0), skinD: C(0x4e3826, 1.0), teeth: C(0xb8a888), mouth: C(0x120a06), socket: C(0x0a0806) });
const ZP_HUMAN = (extra) => [
  { geo: 'torso', bone: 'hips', mat: 'zCloth', tint: 'cloth' },
  { geo: 'head', bone: 'neck', mat: 'zSkin', tint: 'skin', head: true },
  { geo: 'eyes', bone: 'neck', mat: 'khEyes', tint: 'eyes', head: true },
  { geo: 'hat', bone: 'neck', mat: 'zCloth', tint: 'cloth', head: true },
  { geo: 'upper', bone: 'sh', mat: 'zCloth', tint: 'cloth' },
  { geo: 'fore', bone: 'el', mat: 'zCloth', tint: 'cloth' },
  { geo: 'hand', bone: 'el', mat: 'zSkin', tint: 'skin' },
  { geo: 'thigh', bone: 'hip', mat: 'zCloth', tint: 'cloth' },
  { geo: 'shin', bone: 'kn', mat: 'zCloth', tint: 'cloth', legs: true },
  { geo: 'stump', bone: 'kn', mat: 'zSkin', tint: 'skin', stump: true },
  { geo: 'armStump', bone: 'sh', mat: 'zSkin', tint: 'skin', stump: 'arm' },
  ...extra,
];
ZPARTS.kh_arch = ZP_HUMAN([]);
ZPARTS.kh_ouvrier = ZP_HUMAN([]);
ZPARTS.kh_villageois = ZP_HUMAN([]);
ZPARTS.kh_pilote = ZP_HUMAN([]);
/* Avant-bras décharné et main griffue (peau tannée) ; sleeve : bout de manche jusqu'à sleeveTo (m sous le coude). */
function khForearm(k, K, sleeve, sleeveTo = 0) {
  const { cyl, ell } = k, cloth = [], skin = [];
  if (sleeve && sleeveTo < 0) cloth.push(cyl(0.05, 0.048, -sleeveTo, 0, sleeveTo / 2, 0, sleeve), cyl(0.051, 0.051, 0.015, 0, sleeveTo, 0, sleeve));
  skin.push(cyl(0.036, 0.03, 0.25 + sleeveTo * 0.2, 0, -0.125, 0, K.skin), ell(0.03, 0.022, 0.026, 0, -0.255, 0.004, K.skinD));
  return { cloth, skin: skin.concat(zClawHand(k, K, -0.29)) };
}
function khDesseche(model) {
  const k = zKit(), { C, V, box, cyl, ell, tor, cap, seg, on } = k, H = ZRIG.head;
  const merge = (o) => { const out = {}; for (const key in o) out[key] = mergeGeometries(o[key]); return out; };
  const K = KH_DK(C);
  const head = zHeadCore(k, K).concat(zMouthBlood(k, K, 0.05), [
    // joues creusées, peau tirée sur les pommettes
    ell(0.022, 0.03, 0.01, -0.07, H - 0.035, 0.07, K.skinD, 0, -0.6, 0), ell(0.022, 0.03, 0.01, 0.07, H - 0.035, 0.07, K.skinD, 0, 0.6, 0),
  ]);
  const eyes = zombieGeometries().eyes;
  let G;
  if (model === 'kh_arch') {
    const sh = C(0xa8956a), shD = C(0x8a7a54), tr = C(0x8a7a58), belt = C(0x4a3424), red = C(0xa8432a), bag = C(0x5a3e26), hat = C(0xc8b48a), band = C(0x5a4632);
    const R = (y) => lerp(0.185, 0.205, clamp((y - 0.06) / 0.42, 0, 1)), sT = (x, y, o = 0) => on(x, R(y), 0.6, o);
    const T = [cyl(0.205, 0.185, 0.42, 0, 0.27, 0, sh, 0.6, 0, 0, 0, 14), ell(0.225, 0.08, 0.125, 0, 0.45, 0, sh, 0, 0, 0, 14, 8),
      cyl(0.185, 0.2, 0.18, 0, -0.06, 0, tr, 0.64, 0, 0, 0, 14), cyl(0.192, 0.192, 0.05, 0, 0.035, 0, belt, 0.645, 0, 0, 0, 16)];
    // poches de poitrine à rabat, boutonnage, col ouvert
    for (const s of [-1, 1]) { const p = sT(s * 0.09, 0.34, 0.004); T.push(box(0.075, 0.08, 0.008, p.x, 0.34, p.z, shD, 0, p.ry, 0), box(0.078, 0.022, 0.01, p.x, 0.375, p.z + 0.001, sh, 0, p.ry, 0)); }
    for (const y of [0.42, 0.3, 0.18, 0.08]) { const p = sT(0, y, 0.005); T.push(ell(0.009, 0.009, 0.005, 0, y, p.z, shD, 0, 0, 0, 6, 4)); }
    // foulard rouge noué au cou, pointe sur la poitrine
    T.push(tor(0.082, 0.02, 0, 0.5, 0.0, red, Math.PI / 2 - 0.25, 0, 0, 1, 1, 0.85), box(0.06, 0.07, 0.012, 0, 0.45, sT(0, 0.45).z + 0.012, red, 0.1, 0, Math.PI / 4));
    // besace : courroie de l'épaule gauche à la hanche droite, sac sur la hanche
    T.push(seg(V(0.17, 0.5, 0.0), V(-0.15, 0.04, 0.12), bag, 0.035, 0.008));
    T.push(seg(V(0.17, 0.5, -0.0), V(-0.17, 0.06, -0.1), bag, 0.035, 0.008));
    T.push(box(0.17, 0.14, 0.06, -0.21, -0.03, 0.06, bag, 0, 0.4, 0.05), box(0.172, 0.05, 0.065, -0.21, 0.02, 0.062, C(0x4a3220), 0, 0.4, 0.05));
    // poussière et sang
    for (const [x, y, a] of [[0.1, 0.22, 0.03], [-0.06, 0.12, 0.022], [0.14, 0.4, 0.016]]) { const p = sT(x, y, 0.003); T.push(ell(a, a * 0.9, 0.006, p.x, y, p.z, K.blood, 0, p.ry, 0, 8, 5)); }
    const hatG = [cyl(0.21, 0.21, 0.012, 0, H + 0.07, -0.01, hat, 1, -0.06, 0, 0.05, 22), cyl(0.098, 0.112, 0.1, 0, H + 0.125, -0.012, hat, 1, -0.06, 0, 0.05, 18),
      cyl(0.113, 0.113, 0.024, 0, H + 0.088, -0.011, band, 1, -0.06, 0, 0.05, 18), ell(0.098, 0.03, 0.1, 0, H + 0.175, -0.014, hat, -0.06, 0, 0.05, 14, 6)];
    // manches retroussées au-dessus du coude
    const upper = [ell(0.064, 0.062, 0.064, 0, -0.005, 0, sh), cyl(0.06, 0.055, 0.17, 0, -0.085, 0, sh), tor(0.056, 0.014, 0, -0.17, 0, shD, Math.PI / 2),
      cyl(0.04, 0.036, 0.15, 0, -0.245, 0, K.skin)];
    const F = khForearm(k, K, null), fore = [cyl(0.034, 0.031, 0.05, 0, -0.215, 0, C(0xcfc2a0)), tor(0.033, 0.006, 0, -0.195, 0, C(0xa89a78), Math.PI / 2)], hand = F.skin;   // bande de toile au poignet
    const thigh = [cyl(0.084, 0.064, 0.44, 0, -0.22, 0, tr), ell(0.092, 0.12, 0.088, 0, -0.13, 0, tr), box(0.07, 0.07, 0.01, 0.0, -0.2, 0.07, shD)];
    const shin = [cyl(0.064, 0.058, 0.26, 0, -0.13, 0, tr), cyl(0.064, 0.064, 0.016, 0, -0.26, 0, shD),
      cyl(0.06, 0.056, 0.14, 0, -0.33, 0, C(0x4a3424)), box(0.1, 0.07, 0.24, 0, -0.39, 0.045, C(0x4a3424)), ell(0.05, 0.036, 0.05, 0, -0.395, 0.158, C(0x4a3424)),
      box(0.105, 0.018, 0.262, 0, -0.432, 0.048, C(0x1a120c))];
    G = merge({ torso: T, head, hat: hatG, upper, fore, hand, thigh, shin });
    Object.assign(G, zStumps(k, { ...K, flesh: C(0x6a2a1c), fleshD: C(0x2e0d08) }, tr, sh));
  } else if (model === 'kh_ouvrier') {
    const tu = C(0x6e6f58), tuD = C(0x55573f), sash = C(0x9a8460), wrap = C(0xd8d0bc), wrapD = C(0xb8b09a), sole = C(0x3a2a1c);
    const R = (y) => lerp(0.18, 0.2, clamp((y - 0.06) / 0.42, 0, 1)), sT = (x, y, o = 0) => on(x, R(y), 0.6, o);
    const T = [cyl(0.2, 0.18, 0.42, 0, 0.27, 0, tu, 0.6, 0, 0, 0, 14), ell(0.22, 0.08, 0.125, 0, 0.45, 0, tu, 0, 0, 0, 14, 8),
      cyl(0.18, 0.21, 0.2, 0, -0.07, 0, tu, 0.66, 0, 0, 0, 14), cyl(0.188, 0.19, 0.07, 0, 0.04, 0, sash, 0.64, 0, 0, 0, 16)];
    // encolure fendue, pan de ceinture qui pend, plis
    { const z = sT(0, 0.44).z; T.push(box(0.016, 0.12, 0.008, 0, 0.44, z + 0.003, K.skinD)); }
    T.push(box(0.05, 0.16, 0.012, 0.12, -0.04, sT(0.12, 0.04).z + 0.01, sash, 0.05, 0.4, 0.1));
    for (const x of [-0.12, -0.04, 0.06, 0.14]) { const p = sT(x, 0.2, 0.002); T.push(box(0.006, 0.3, 0.004, p.x, 0.2, p.z, tuD, 0, p.ry, 0)); }
    const hatG = [tor(0.1, 0.034, 0, H + 0.055, -0.008, wrap, Math.PI / 2 + 0.08, 0, 0, 1, 1.05, 0.95), tor(0.088, 0.03, 0, H + 0.09, -0.012, wrapD, Math.PI / 2 + 0.12, 0.3, 0, 1, 1.05, 0.95),
      cap(Math.PI * 0.45, 0.092, 0.085, 0.096, 0, H + 0.075, -0.01, wrap, -0.1), seg(V(-0.07, H + 0.05, -0.08), V(-0.09, H - 0.12, -0.11), wrap, 0.04, 0.01)];
    const upper = [ell(0.062, 0.06, 0.062, 0, -0.005, 0, tu), cyl(0.058, 0.054, 0.31, 0, -0.155, 0, tu), cyl(0.055, 0.055, 0.02, 0, -0.3, 0, tuD)];
    const F = khForearm(k, K, tu, -0.2), fore = F.cloth, hand = F.skin;
    const thigh = [cyl(0.08, 0.064, 0.44, 0, -0.22, 0, tuD), cyl(0.13, 0.155, 0.42, 0, -0.24, 0, tu, 1, 0, 0, 0, 14), cyl(0.156, 0.157, 0.02, 0, -0.44, 0, tuD, 1, 0, 0, 0, 14)];
    const shin = [cyl(0.044, 0.036, 0.36, 0, -0.18, 0, K.skin), ell(0.04, 0.03, 0.04, 0, -0.36, 0.0, K.skinD),
      box(0.085, 0.03, 0.2, 0, -0.395, 0.05, K.skin), box(0.1, 0.014, 0.26, 0, -0.42, 0.05, sole), box(0.08, 0.008, 0.02, 0, -0.39, 0.08, sole)];
    G = merge({ torso: T, head, hat: hatG, upper, fore, hand, thigh, shin });
    Object.assign(G, zStumps(k, { ...K, flesh: C(0x6a2a1c), fleshD: C(0x2e0d08) }, K.skin, tu));
  } else if (model === 'kh_pilote') {
    const lea = C(0x5e3c22), leaD = C(0x3e2614), wool = C(0xdcd0b4), scarf = C(0xece6da), kh = C(0x8e7c58), khD = C(0x6e5e40), boot = C(0x3a2414), brass = C(0xb08a40), glass = C(0x1c2a2a);
    const R = (y) => lerp(0.19, 0.212, clamp((y - 0.06) / 0.42, 0, 1)), sT = (x, y, o = 0) => on(x, R(y), 0.6, o);
    const T = [cyl(0.212, 0.19, 0.42, 0, 0.27, 0, lea, 0.6, 0, 0, 0, 14), ell(0.232, 0.084, 0.13, 0, 0.45, 0, lea, 0, 0, 0, 14, 8),
      cyl(0.19, 0.2, 0.14, 0, 0.0, 0, lea, 0.62, 0, 0, 0, 14), cyl(0.2, 0.2, 0.06, 0, 0.06, 0, leaD, 0.63, 0, 0, 0, 16),
      cyl(0.185, 0.2, 0.16, 0, -0.1, 0, kh, 0.64, 0, 0, 0, 14)];
    // col de mouton, fermeture, poches, écharpe dont le pan flotte sur l'épaule
    T.push(tor(0.105, 0.04, 0, 0.5, 0.0, wool, Math.PI / 2 - 0.2, 0, 0, 1.15, 1, 0.9));
    { const z = sT(0, 0.3).z; T.push(box(0.012, 0.4, 0.008, 0.02, 0.28, z + 0.004, leaD)); }
    for (const s of [-1, 1]) { const p = sT(s * 0.1, 0.16, 0.004); T.push(box(0.08, 0.07, 0.01, p.x, 0.16, p.z, leaD, 0, p.ry, 0)); }
    T.push(tor(0.085, 0.022, 0, 0.53, 0.01, scarf, Math.PI / 2 - 0.15, 0, 0, 1, 1, 0.9), seg(V(0.06, 0.52, 0.08), V(0.17, 0.32, 0.16), scarf, 0.06, 0.012));
    for (const [x, y, a] of [[0.12, 0.25, 0.022], [-0.08, 0.36, 0.018]]) { const p = sT(x, y, 0.003); T.push(ell(a, a * 0.9, 0.006, p.x, y, p.z, K.blood, 0, p.ry, 0, 8, 5)); }
    // serre-tête de cuir (couvre-oreilles), lunettes relevées sur le front
    const hatG = [cap(Math.PI * 0.55, 0.104, 0.108, 0.112, 0, H + 0.006, -0.004, lea, -0.1)];
    for (const s of [-1, 1]) hatG.push(ell(0.022, 0.05, 0.04, s * 0.1, H - 0.03, -0.005, lea), cyl(0.026, 0.026, 0.022, s * 0.042, H + 0.072, 0.092, brass, 1, Math.PI / 2 - 0.5, 0, 0, 12), cyl(0.02, 0.02, 0.024, s * 0.042, H + 0.072, 0.094, glass, 1, Math.PI / 2 - 0.5, 0, 0, 12));
    hatG.push(box(0.21, 0.014, 0.012, 0, H + 0.07, 0.07, leaD, -0.5));
    const upper = [ell(0.066, 0.064, 0.066, 0, -0.005, 0, lea), cyl(0.062, 0.058, 0.31, 0, -0.155, 0, lea)];
    const F = khForearm(k, K, lea, -0.2), fore = [...F.cloth, cyl(0.054, 0.054, 0.03, 0, -0.2, 0, wool)], hand = F.skin;
    // culotte de cheval (évasée à la cuisse), bottes hautes lacées
    const thigh = [cyl(0.084, 0.064, 0.44, 0, -0.22, 0, kh), ell(0.1, 0.13, 0.095, 0, -0.16, 0.0, kh), box(0.06, 0.07, 0.01, 0.0, -0.2, 0.075, khD)];
    const shin = [cyl(0.06, 0.054, 0.12, 0, -0.06, 0, kh), cyl(0.07, 0.06, 0.3, 0, -0.24, 0, boot), cyl(0.072, 0.072, 0.02, 0, -0.1, 0, C(0x2a1a0e)),
      box(0.1, 0.07, 0.24, 0, -0.39, 0.045, boot), ell(0.05, 0.036, 0.05, 0, -0.395, 0.158, boot), box(0.105, 0.018, 0.262, 0, -0.432, 0.048, C(0x1a120c))];
    G = merge({ torso: T, head, hat: hatG, upper, fore, hand, thigh, shin });
    Object.assign(G, zStumps(k, { ...K, flesh: C(0x6a2a1c), fleshD: C(0x2e0d08) }, kh, lea));
  } else {
    const ga = C(0x3e5f8a), gaD = C(0x2e4a6e), cap0 = C(0xe8e4da), sole = C(0x3a2a1c);
    const R = (y) => lerp(0.185, 0.205, clamp((y - 0.06) / 0.42, 0, 1)), sT = (x, y, o = 0) => on(x, R(y), 0.6, o);
    const T = [cyl(0.205, 0.185, 0.42, 0, 0.27, 0, ga, 0.6, 0, 0, 0, 14), ell(0.225, 0.08, 0.125, 0, 0.45, 0, ga, 0, 0, 0, 14, 8),
      cyl(0.185, 0.225, 0.22, 0, -0.08, 0, ga, 0.66, 0, 0, 0, 14)];
    { const z = sT(0, 0.4).z; T.push(box(0.018, 0.16, 0.008, 0, 0.42, z + 0.004, gaD), ell(0.05, 0.03, 0.01, 0, 0.5, z - 0.01, K.skinD)); }
    for (const x of [-0.13, -0.05, 0.05, 0.13]) { const p = sT(x, 0.15, 0.002); T.push(box(0.006, 0.42, 0.004, p.x, 0.15, p.z, gaD, 0, p.ry, 0)); }
    for (const [x, y, a] of [[-0.09, 0.3, 0.026], [0.11, 0.1, 0.02]]) { const p = sT(x, y, 0.003); T.push(ell(a, a * 1.2, 0.006, p.x, y, p.z, K.blood, 0, p.ry, 0, 8, 5)); }
    const hatG = [cap(Math.PI * 0.42, 0.106, 0.1, 0.108, 0, H + 0.012, -0.006, cap0, -0.18)];
    // manches larges de la galabeya
    const upper = [ell(0.066, 0.064, 0.066, 0, -0.005, 0, ga), cyl(0.062, 0.07, 0.31, 0, -0.155, 0, ga)];
    const F = khForearm(k, K, ga, -0.17), fore = [cyl(0.074, 0.082, 0.06, 0, -0.03, 0, ga), ...F.cloth], hand = F.skin;
    // la robe descend jusqu'aux chevilles (cuisses et tibias)
    const thigh = [cyl(0.08, 0.062, 0.44, 0, -0.22, 0, gaD), cyl(0.15, 0.17, 0.46, 0, -0.23, 0, ga, 1, 0, 0, 0, 14)];
    const shin = [cyl(0.17, 0.18, 0.34, 0, -0.17, 0, ga, 1, 0, 0, 0, 14), cyl(0.181, 0.182, 0.02, 0, -0.34, 0, gaD, 1, 0, 0, 0, 14),
      cyl(0.04, 0.036, 0.08, 0, -0.38, 0, K.skin), box(0.085, 0.03, 0.2, 0, -0.405, 0.05, K.skin), box(0.1, 0.014, 0.26, 0, -0.428, 0.05, sole)];
    G = merge({ torso: T, head, hat: hatG, upper, fore, hand, thigh, shin });
    Object.assign(G, zStumps(k, { ...K, flesh: C(0x6a2a1c), fleshD: C(0x2e0d08) }, ga, ga));
  }
  G.eyes = eyes;
  return G;
}
for (const m of ['kh_arch', 'kh_ouvrier', 'kh_villageois', 'kh_pilote']) Object.defineProperty(ZVGEO, m, { configurable: true, enumerable: true, get() { const g = khDesseche(m); Object.defineProperty(ZVGEO, m, { value: g, enumerable: true }); return g; } });

/* ---- Le Rôdeur : os du Molosse (cage thoracique, échine, crâne, longues pattes) */
ZPARTS.kh_rodeur = [
  { geo: 'rChest', bone: 'chest', mat: 'khBone', tint: 'skin' },
  { geo: 'rPelvis', bone: 'pelvis', mat: 'khBone', tint: 'skin' },
  { geo: 'rNeck', bone: 'neck', mat: 'khBone', tint: 'skin' },
  { geo: 'rHead', bone: 'head', mat: 'khBone', tint: 'skin' },
  { geo: 'rEyes', bone: 'head', mat: 'khEyes', tint: 'eyes' },
  { geo: 'rJaw', bone: 'jaw', mat: 'khBone', tint: 'skin' },
  { geo: 'rTail', bone: 'tail', mat: 'khBone', tint: 'skin' },
  { geo: 'rArm', bone: 'f1', mat: 'khBone', tint: 'skin' },
  { geo: 'rFore', bone: 'f2', mat: 'khBone', tint: 'skin' },
  { geo: 'rPawF', bone: 'f3', mat: 'khBone', tint: 'skin' },
  { geo: 'rThigh', bone: 'h1', mat: 'khBone', tint: 'skin' },
  { geo: 'rShin', bone: 'h2', mat: 'khBone', tint: 'skin' },
  { geo: 'rPawH', bone: 'h3', mat: 'khBone', tint: 'skin' },
];
function khRodeurGeometries() {
  const k = zKit(), { C, V, box, cyl, ell, tor, seg } = k;
  const bone = C(0xd6c6a0), boneD = C(0xa08c66), boneS = C(0xbca57a), crust = C(0xb08a5e), dark = C(0x0e0a07), tooth = C(0xcbbb92), claw = C(0x2a1e14);
  const merge = (o) => { const out = {}; for (const key in o) out[key] = mergeGeometries(o[key]); return out; };
  // vertèbre : corps, apophyses, épine dorsale penchée vers l'arrière
  const vert = (out, z, y, s = 1, spine = 1) => {
    out.push(box(0.05 * s, 0.05 * s, 0.045, 0, y, z, bone), box(0.09 * s, 0.012, 0.016, 0, y, z, boneD));
    if (spine) out.push(box(0.016 * s, 0.085 * s * spine, 0.018, 0, y + 0.06 * s * spine, z - 0.012, boneS, -0.5));
  };
  // cage : échine à épines, côtes en arcs, sternum, lambeaux de peau séchée croûtés de sable
  const chest = [];
  for (let i = 0; i < 8; i++) vert(chest, -0.04 + i * 0.065, 0.06, 1, 1 + 0.25 * Math.sin((i / 7) * Math.PI));
  for (let i = 0; i < 7; i++) {
    const z = i * 0.062, r = 0.155 - Math.abs(i - 2.6) * 0.011;
    chest.push(tor(r, 0.0105, 0, 0.06 - r * 1.08, z, i % 2 ? bone : boneS, 0.12, 0, 0, 1, 1.12, 1, 16));
  }
  chest.push(box(0.028, 0.018, 0.4, 0, -0.27, 0.2, boneD, 0.08));
  chest.push(ell(0.06, 0.03, 0.09, 0.12, -0.05, 0.14, crust, 0, 0, 0.8, 9, 6), ell(0.05, 0.025, 0.07, -0.125, -0.11, 0.3, crust, 0, 0.2, -0.7, 9, 6));
  // bassin : ailes de l'os iliaque, sacrum qui prolonge l'échine
  const pelvis = [ell(0.06, 0.07, 0.03, 0.08, -0.04, -0.2, bone, 0.3, 0.4, 0, 9, 6), ell(0.06, 0.07, 0.03, -0.08, -0.04, -0.2, bone, 0.3, -0.4, 0, 9, 6),
    ell(0.05, 0.04, 0.09, 0, -0.06, -0.22, boneD), ell(0.03, 0.03, 0.03, 0.1, -0.1, -0.19, boneD), ell(0.03, 0.03, 0.03, -0.1, -0.1, -0.19, boneD)];
  for (let i = 0; i < 3; i++) vert(pelvis, -0.06 - i * 0.065, 0.05, 0.95, 0.8);
  // cou : vertèbres à épines
  const neck = [];
  for (let i = 0; i < 4; i++) vert(neck, -0.03 + i * 0.048, -0.03 + i * 0.006, 0.85, 0.6);
  // crâne humain étiré : voûte allongée, arcades en V, face qui avance, pommettes saillantes, orbites obliques
  const head = [ell(0.072, 0.07, 0.1, 0, 0.03, -0.012, bone, 0.1, 0, 0, 14, 10), ell(0.052, 0.042, 0.075, 0, -0.035, 0.083, bone, 0.15, 0, 0, 12, 8),
    box(0.058, 0.017, 0.03, -0.033, 0.021, 0.086, boneD, 0, 0.25, -0.32), box(0.058, 0.017, 0.03, 0.033, 0.021, 0.086, boneD, 0, -0.25, 0.32),
    ell(0.021, 0.016, 0.045, -0.057, -0.016, 0.07, boneD, 0, -0.3, 0), ell(0.021, 0.016, 0.045, 0.057, -0.016, 0.07, boneD, 0, 0.3, 0),
    ell(0.028, 0.02, 0.02, -0.034, 0.0, 0.106, dark, 0, 0, -0.4), ell(0.028, 0.02, 0.02, 0.034, 0.0, 0.106, dark, 0, 0, 0.4),
    box(0.02, 0.03, 0.02, 0, -0.04, 0.138, dark, 0.3)];
  for (let i = 0; i < 8; i++) { const x = (i - 3.5) * 0.0118, fang = i === 1 || i === 6; head.push(box(0.0098, fang ? 0.036 : 0.022, 0.009, x, fang ? -0.089 : -0.083, 0.112 - Math.abs(x) * 0.8, tooth)); }
  // yeux : fentes au fond des orbites (turquoise de l'instance)
  const eyes = [ell(0.019, 0.011, 0.012, -0.034, 0.0, 0.117, null, 0, 0, -0.4, 10, 6), ell(0.019, 0.011, 0.012, 0.034, 0.0, 0.117, null, 0, 0, 0.4, 10, 6)];
  // mâchoire : mandibule, branches montantes, dents du bas (pivot de la mâchoire du Molosse)
  const jaw = [box(0.078, 0.016, 0.085, 0, -0.036, 0.0, bone), box(0.012, 0.05, 0.026, 0.042, -0.012, -0.045, bone, -0.3), box(0.012, 0.05, 0.026, -0.042, -0.012, -0.045, bone, -0.3)];
  for (let i = 0; i < 8; i++) { const x = (i - 3.5) * 0.011; jaw.push(box(0.0092, 0.02, 0.009, x, -0.022, 0.03 - Math.abs(x) * 0.8, tooth)); }
  // queue d'échine : 20 vertèbres de plus en plus fines (1,45 m)
  const tail = [];
  for (let i = 0; i < 20; i++) { const s = 1 - i / 23; vert(tail, -0.03 - i * 0.072, -i * 0.01, 0.95 * s, i < 14 ? 0.7 * s : 0); }
  // pattes d'araignée : os longs et fins, articulations noueuses à éperon, trois griffes
  const limb = (L, r, spur) => {
    const out = [cyl(r, r * 0.75, L, 0, -L / 2, 0, bone, 1, 0, 0, 0, 8), ell(r * 1.7, r * 1.7, r * 1.7, 0, 0, 0, boneD, 0, 0, 0, 8, 6)];
    if (spur) out.push(seg(V(0, -L * 0.98, 0), V(0, -L * 0.98 + spur, -spur * 0.9), boneS, r * 0.8, 0, true, 0.003));
    return out;
  };
  const paw = (L) => {
    const out = [ell(0.026, 0.024, 0.026, 0, 0, 0, boneD, 0, 0, 0, 8, 6), cyl(0.013, 0.011, L, 0, -L / 2, 0, bone, 1, 0, 0, 0, 6)];
    for (const a of [-0.4, 0, 0.4]) out.push(seg(V(0, -L, 0.005), V(Math.sin(a) * 0.07, -L - 0.035, 0.09), claw, 0.009, 0, true, 0.0015));
    return out;
  };
  return merge({ rChest: chest, rPelvis: pelvis, rNeck: neck, rHead: head, rEyes: eyes, rJaw: jaw, rTail: tail,
    rArm: limb(DRIG.f[0], 0.024, 0.07), rFore: limb(DRIG.f[1], 0.02, 0), rPawF: paw(DRIG.f[2]), rThigh: limb(DRIG.h[0], 0.028, 0), rShin: limb(DRIG.h[1], 0.021, 0.08), rPawH: paw(DRIG.h[2]) });
}
Object.defineProperty(ZVGEO, 'kh_rodeur', { configurable: true, enumerable: true, get() { const g = khRodeurGeometries(); Object.defineProperty(ZVGEO, 'kh_rodeur', { value: g, enumerable: true }); return g; } });

/* ---- Rôdeurs : apparition dans la tempête, poursuite, prise, plongée sous le sable */
const KHR = {
  t: 0, max: [0, 0, 2, 3],                  // à la fois : rien en vent de sable, 2 en Tempête, 3 en Khamsin
  every: [9, 15], dist: [14, 26],           // une sortie toutes les 9 à 15 s, à 14–26 m du joueur
  speed: [7, 8.5], scale: 1.2,              // m/s en ligne droite ; taille : 1 m au garrot, 2,5 m queue comprise
  grab: 2, bite: 10, dps: 5, cd: 4,         // prise : 2 s, une morsure de 10 puis 5 PV/s ; 4 s avant la suivante
  free: 1.5,                                // après une prise, 1,5 s sans qu'aucun Rôdeur ne vous reprenne
  stall: 3, stallKmh: 20,                   // véhicule à moins de 20 km/h : bloqué 3 s
  lights: 30, lightsCos: 0.92, dive: 5,     // phares : à moins de 30 m, à ±23° ; sous le sable 5 s
  depth: 1.25,                              // profondeur sous le sable (m, avant l'échelle)
};
const KHR_TINTS = [0xffffff, 0xf2e6d4, 0xe8dcc4];

/* Touches : capsules sur ses os (crâne court, échine, longue queue), comme DOG_HIT. */
const RODEUR_HIT = [
  ['head', 'head', [0, 0.03, -0.06], 'head', [0, -0.04, 0.12], 0.095],
  ['body', 'neck', [0, -0.04, -0.02], 'neck', [0, -0.02, 0.15], 0.07],
  ['body', 'chest', [0, -0.1, 0.42], 'pelvis', [0, -0.04, -0.27], 0.18],
  ['body', 'tail', [0, 0, 0], 'tail', [0, -0.15, -1.0], 0.05],
  ['body', 'f1L', [0, 0, 0], 'f3L', [0, -0.12, 0], 0.045], ['body', 'f1R', [0, 0, 0], 'f3R', [0, -0.12, 0], 0.045],
  ['body', 'h1L', [0, -0.05, 0], 'h3L', [0, -0.16, 0], 0.05], ['body', 'h1R', [0, -0.05, 0], 'h3R', [0, -0.16, 0], 0.05],
];
function khRodeurs(dt) {
  khGrabGuard(dt);
  KHR.t -= dt;
  const lvl = KHS.on ? (KHS.lv > 2.4 ? 3 : KHS.lv > 1.4 ? 2 : 0) : 0;
  if (lvl < 2) {
    // le vent tombe : ils replongent
    for (const z of Zombies.list) if (z.rodeur && z.alive && z.rstate !== 'dive' && z.rstate !== 'gone') khRodeurState(z, 'dive');
    return;
  }
  let n = 0;
  for (const z of Zombies.list) if (z.rodeur && z.alive) n++;
  if (KHR.t > 0 || n >= KHR.max[lvl] || G.state !== 'playing' || player.layer || player.down) return;
  KHR.t = rand(KHR.every[0], KHR.every[1]);
  const V = VEH.drive, px = V ? V.x : player.pos.x, pz = V ? V.z : player.pos.z;
  for (let tries = 0; tries < 24; tries++) {
    const a = rand(0, TAU), d = rand(KHR.dist[0], KHR.dist[1]), x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
    const cx = Math.floor(x), cz = Math.floor(z);
    if (owKind(OW.surf, cx, cz) !== OWK.TERRAIN || !owWalkCell(0, cx, cz)) continue;   // dans le sable, pas dans un lieu
    if (Math.abs(owGroundAt(0, x, z) - player.gy) > 6) continue;
    if (khSpawnRodeur(x, z)) return;
  }
}
/* Une prise ne survit pas à son Rôdeur (mort, retiré, replongé) ; 2,5 s au plus de toute façon. */
function khGrabGuard(dt) {
  if (player.grabFreeT > 0) player.grabFreeT -= dt;
  if (!(player.grabT > 0)) return;
  player.grabT -= dt;
  const z = player.grabbedBy;
  if (player.grabT <= -0.5 || !z || !z.alive || z.removed || z.rstate !== 'grab' || player.down) khRelease();
}
/* Le joueur est lâché : un court répit avant la prise suivante (un autre Rôdeur attendait). */
function khRelease() {
  if (player.grabbedBy || player.grabT > 0) player.grabFreeT = KHR.free;
  player.grabT = 0; player.grabbedBy = null;
}
function khEnemiesReset() {
  KHR.t = rand(2, 4);
  player.grabT = 0; player.grabbedBy = null; player.grabFreeT = 0;
}
function khSpawnRodeur(x, zz) {
  if (!ZR.free.length) { const c = Zombies.list.find((q) => !q.alive); if (!c) return null; removeZombie(c); }
  const slot = ZR.free.pop();
  const look = { skin: pick(KHR_TINTS), cloth: 0xffffff, eyes: KH_EYE_LIN, helmet: false, helmetColor: 0 };
  paintZombieSlot(slot, look, ZR, 'kh_rodeur');
  const hp = khHp(G.round) * 2, gy = owGroundAt(0, x, zz);
  const z = {
    id: ++Zombies.seq, slot, type: RODEUR_TYPE, model: 'kh_rodeur', dog: true, rodeur: true, rig: makeDogRig(), look, helmetOn: false, alive: true, outside: false,
    state: 'chase', dstate: 'spawn', rstate: 'rise', st: 0, t: 0, hp, maxHp: hp, pos: new THREE.Vector3(x, gy - KHR.depth * KHR.scale, zz), k: owLocate(x, zz, gy), gy,
    yaw: Math.atan2(player.pos.x - x, player.pos.z - zz), vx: 0, vz: 0, moving: 0, speedType: 'run', speed: rand(KHR.speed[0], KHR.speed[1]), win: null, gib: 0,
    headless: false, crawl: false, stagger: 0, flinch: 0, flinchSide: 1, knockX: 0, knockZ: 0, knockT: 0, knockDur: 0, knockDir: 1, knockK: 0, knockShift: false,
    reelT: 0, called: null, nukeT: 0, deathKind: null, losT: 0, los: false, stuckT: 0, lastX: x, lastZ: zz, farT: 0,
    flank: 1, leapCd: 0, leap: 0, leapFrom: null, leapTo: null, leapL: 0, leapHit: false,
    biteN: -1, biteHit: true, barkT: rand(1, 2.5), yelpT: 0, droolT: 99, pawU: 1, aim: 0, turn: 0, stunDur: 1.2, stunSide: 1, grabCd: 0, hideT: 0, layer: 0, biteAcc: 0,
  };
  z.rig.root.scale.setScalar(KHR.scale);
  owSandBurst(x, zz, gy);
  Sound.rise(z.pos);
  Zombies.list.push(z);
  animateDog(z, 0);
  return z;
}
function khRodeurState(z, s) {
  z.rstate = s; z.st = 0;
  z.dstate = s === 'grab' ? 'bite' : s === 'rise' ? 'spawn' : s === 'stun' ? 'stun' : 'chase';
  if (s === 'grab') { z.biteN = -1; z.biteHit = true; z.biteAcc = 0; }
  if (s === 'chase') { z.stuckT = 0; z.lastX = z.pos.x; z.lastZ = z.pos.z; }
  if (s === 'dive') { owSandBurst(z.pos.x, z.pos.z, z.gy); if (player.grabbedBy === z) khRelease(); }
}
function khRodeurUpdate(z, dt) {
  z.t += dt; z.st += dt;
  if (!z.alive) { removeZombie(z); return; }
  if (z.nukeT > 0) { z.nukeT -= dt; if (z.nukeT <= 0) { killZombie(z, { kind: 'nuke', dx: 0, dz: 0 }); return; } }
  z.flinch = damp(z.flinch, 0, 8, dt);
  if (z.stagger > 0) z.stagger -= dt;
  if (z.grabCd > 0) z.grabCd -= dt;
  if (z.yelpT > 0) z.yelpT -= dt;
  const V = VEH.drive, tx = V ? V.x : player.pos.x, tz = V ? V.z : player.pos.z;
  const dx = tx - z.pos.x, dz = tz - z.pos.z, d = Math.hypot(dx, dz) || 1e-3, deep = KHR.depth * KHR.scale;
  const yaw0 = z.yaw;
  switch (z.rstate) {
    case 'rise': {
      const k = clamp(z.st / 1.2, 0, 1);
      z.pos.y = z.gy - deep * (1 - smooth(k)); z.moving = 0;
      z.yaw = turnTo(z.yaw, Math.atan2(dx, dz), 2 * dt);
      if (k >= 1) khRodeurState(z, 'chase');
      break;
    }
    case 'chase': {
      // très rapide en ligne droite, lent dans les virages : il court dans l'axe de son corps
      const want = Math.atan2(dx, dz), off = Math.abs(wrapAngle(want - z.yaw));
      z.yaw = turnTo(z.yaw, want, (off > 0.6 ? 1.8 : 2.6) * dt);
      const sp = z.speed * (off < 0.45 ? 1 : off < 1.2 ? 0.45 : 0.25) * (z.stagger > 0 ? 0.3 : 1) * (d < 2.5 ? 0.5 : 1);
      z.vx = damp(z.vx, Math.sin(z.yaw) * sp, 4, dt); z.vz = damp(z.vz, Math.cos(z.yaw) * sp, 4, dt);
      z.pos.x += (z.vx + z.knockX) * dt; z.pos.z += (z.vz + z.knockZ) * dt;
      z.knockX = damp(z.knockX, 0, 5, dt); z.knockZ = damp(z.knockZ, 0, 5, dt);
      settleBody(z, 0.35); z.pos.y = z.gy;
      z.moving = Math.hypot(z.vx, z.vz);
      z.barkT -= dt;
      if (z.barkT <= 0) { z.barkT = rand(2.5, 5); Sound.dogGrowl(z.pos); }
      // bloqué contre un mur : il passe sous le sable et ressort plus loin
      z.stuckT += dt;
      if (z.stuckT > 1.5) {
        const moved = Math.hypot(z.pos.x - z.lastX, z.pos.z - z.lastZ);
        z.stuckT = 0; z.lastX = z.pos.x; z.lastZ = z.pos.z;
        if (moved < 1 && d > 3) { khRodeurState(z, 'dive'); z.hideT = 1.5; break; }
      }
      // phares braqués sur lui : il replonge 5 s
      if (V && V.lights) {
        const [fx, fz] = vehFwd(V.yaw), rx = z.pos.x - V.x, rz = z.pos.z - V.z, dd = Math.hypot(rx, rz) || 1;
        if (dd < KHR.lights && (rx * fx + rz * fz) / dd > KHR.lightsCos) { khRodeurState(z, 'dive'); z.hideT = KHR.dive; Sound.dogYelp(z.pos); break; }
      }
      // véhicule lent : il le bloque 3 s ; joueur à pied : il l'agrippe 2 s
      if (V) {
        if (d < V.T.len / 2 + 1.6 && Math.abs(V.v) * 3.6 < KHR.stallKmh && z.grabCd <= 0) {
          V.stuckT = KHR.stall; z.grabCd = KHR.stall + 3; Sound.dogSnarl(z.pos); FX.shake = Math.min(1, FX.shake + 0.4);
          HUD.hint('Un Rôdeur bloque le véhicule !', 2);
        }
      } else if (d < 1.5 && Math.abs(player.gy - z.gy) < 1.2 && !player.down && z.grabCd <= 0 && !(player.grabT > 0) && !(player.grabFreeT > 0)) {
        khRodeurState(z, 'grab'); player.grabT = KHR.grab; player.grabbedBy = z; Sound.dogSnarl(z.pos);
        playerDamage(KHR.bite); Sound.dogBite(z.pos);
        HUD.hint(`Agrippé ! ${meleeName()} (V) pour vous libérer`, 2);
      }
      break;
    }
    case 'grab': {
      z.yaw = turnTo(z.yaw, Math.atan2(dx, dz), 10 * dt);
      const want = d > 1.2 ? 1.5 : d < 0.9 ? -1 : 0;
      z.pos.x += (dx / d) * want * dt; z.pos.z += (dz / d) * want * dt;
      settleBody(z, 0.35); z.pos.y = z.gy; z.moving = 0;
      z.biteAcc += dt * KHR.dps;
      if (z.biteAcc >= 1) { const n = Math.floor(z.biteAcc); z.biteAcc -= n; playerDamage(n); }
      if (z.st >= KHR.grab || player.down || player.grabbedBy !== z) {
        if (player.grabbedBy === z) khRelease();
        z.grabCd = KHR.cd; khRodeurState(z, 'chase');
      }
      break;
    }
    case 'stun':
      z.moving = 0;
      if (z.st >= 1.2) khRodeurState(z, 'chase');
      break;
    case 'dive': {
      const k = clamp(z.st / 0.8, 0, 1);
      z.pos.y = z.gy - deep * smooth(k); z.moving = 0;
      if (k >= 1) { z.rstate = 'gone'; z.st = 0; if (!(z.hideT > 0)) z.hideT = KHR.dive; hideZombieSlot(z.slot); }
      break;
    }
    case 'gone':
      z.hideT -= dt;
      if (z.hideT <= 0) {
        if (!KHS.on || KHS.lv < 1.4) { z.alive = false; removeZombie(z); return; }   // la tempête est passée
        // il ressort plus loin, autour du joueur
        const a = rand(0, TAU), r = rand(12, 20), x = tx + Math.sin(a) * r, zz = tz + Math.cos(a) * r, cx = Math.floor(x), cz = Math.floor(zz);
        if (owKind(OW.surf, cx, cz) === OWK.TERRAIN && owWalkCell(0, cx, cz)) {
          z.gy = owGroundAt(0, x, zz); z.pos.set(x, z.gy - deep, zz); z.k = owLocate(x, zz, z.gy); z.vx = z.vz = 0; z.hideT = 0;
          z.yaw = Math.atan2(tx - x, tz - zz);
          owSandBurst(x, zz, z.gy); Sound.rise(z.pos); khRodeurState(z, 'rise');
        } else z.hideT = 0.3;
      }
      return;
    default: khRodeurState(z, 'chase');
  }
  if (!z.alive || z.removed) return;
  z.turn = dAng(z.yaw, yaw0) / Math.max(dt, 1e-4);
  z.aim = clamp(dAng(Math.atan2(dx, dz), z.yaw), -1.2, 1.2);
  animateDog(z, dt);
}
/* Mort : il s'effondre en sable et en os (pas d'explosion). Points comme un Desséché ; hors du décompte de la manche. */
function khKillRodeur(z, info) {
  z.alive = false; z.state = 'dead'; z.dstate = 'dead'; z.t = 0; z.deathKind = info.kind;
  if (player.grabbedBy === z) khRelease();
  let pts = RULES.pointsKill;
  if (info.kind === 'knife') pts = RULES.pointsKnife; else if (info.kind === 'nuke') pts = 0; else if (info.head) pts = RULES.pointsHead;
  if (pts) addPoints(pts);
  G.stats.kills++;
  if (info.head && info.kind === 'bullet') { G.stats.headshots++; Sound.headshot(); }
  Life.kill(info, RODEUR_TYPE);
  Rank.kill(info);
  glasOnKill(z, info);
  _khV.set(0, -0.05, 0.1).applyMatrix4(z.rig.chest.matrixWorld);
  const x = _khV.x, y = _khV.y, zz = _khV.z, dx = info.dx || 0, dz = info.dz || 0;
  owSandBurst(x, zz, z.gy);
  for (let i = 0; i < 9; i++) spawnDebris(MAT.dBone, rand(0.03, 0.06), rand(0.1, 0.24), rand(0.03, 0.06), x + rand(-0.3, 0.3), y, zz + rand(-0.3, 0.3),
    dx * rand(0.5, 2) + rand(-2, 2), rand(1.5, 4), dz * rand(0.5, 2) + rand(-2, 2), 3);
  for (let i = 0; i < 4; i++) spawnPuff(x + rand(-0.4, 0.4), y + rand(-0.2, 0.2), zz + rand(-0.4, 0.4), rand(0.9, 1.4), rand(1.2, 2), 0xb08a5c, 0.55, 0.5);
  Sound.zombie(z.pos, 'death');
  hideZombieSlot(z.slot);
}
const _khV = new THREE.Vector3();
/* Couteau ou khépesh (jeu 2.0.4) sur un Rôdeur qui vous tient : il lâche prise, sonné. */
function khKnifeRelease(z) {
  if (!z.rodeur || z.rstate !== 'grab') return;
  khRelease(); z.grabCd = KHR.cd;
  z.knockX = -Math.sin(z.yaw) * 4; z.knockZ = -Math.cos(z.yaw) * 4;
  khRodeurState(z, 'stun');
  HUD.hint('Libéré !', 1);
}

/* ---- Écran « Modèles » : les Desséchés comme les variantes du Fantassin, le Rôdeur sur le modèle du Molosse */
const KH_SPEC_ANIMS = SPEC_ANIMS.filter((a) => a !== 'tear' && a !== 'climb');     // pas de barricades à Khamsin
for (const m of ['kh_arch', 'kh_ouvrier', 'kh_villageois', 'kh_pilote']) SPECIMEN_MODELS[m] = { anims: KH_SPEC_ANIMS, make: () => makeSpecimen(m) };
SPECIMEN_MODELS.kh_rodeur = { anims: ['idle', 'gallop', 'emerge', 'grab', 'dive', 'death'], dog: true, make: () => makeRodeurSpecimen() };
const khSpecLook = (look, type) => (type && (type.kh || type.lu) ? khLook(look, type) : look);
const _khSpecV = new THREE.Vector3();
function makeRodeurSpecimen() {
  const R = {};
  const root = zombieInstances(R, 1, ['kh_rodeur']);
  for (const m of R.parts) m.castShadow = true;
  const look = () => ({ skin: pick(KHR_TINTS), cloth: 0xffffff, eyes: KH_EYE_LIN, helmet: false, helmetColor: 0 });
  const z = {
    id: 11, slot: 0, R, model: 'kh_rodeur', type: RODEUR_TYPE, dog: true, rodeur: true, rig: makeDogRig(), look: look(), helmetOn: false, alive: true, spec: true,
    pos: new THREE.Vector3(), yaw: 0, gy: 0, dstate: 'idle', st: 0, moving: 0, flinch: 0, flinchSide: 1, aim: 0, turn: 0, leap: 0,
    stunDur: 1.2, stunSide: 1, gib: 0, headless: false, vx: 0, vz: 0,
  };
  z.rig.root.scale.setScalar(KHR.scale);
  paintZombieSlot(0, z.look, R, 'kh_rodeur');
  // sable soulevé, os qui retombent, lueur des yeux
  const fx = new THREE.Group();
  root.add(fx);
  const sand = [], bones = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.smoke, transparent: true, depthWrite: false }));
    setLin(s.material.color, 0xb48a5a);
    s.visible = false; fx.add(s);
    sand.push({ s, v: new THREE.Vector3(), t: 0, life: 1 });
  }
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(GEO.box, MAT.dBone);
    m.castShadow = true; m.visible = false; fx.add(m);
    bones.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() });
  }
  const eyeGlow = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: KH_EYE, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.09); fx.add(s); return s;
  });
  const S = { anim: null, loop: -1, phase: -1, sounds: 0, t: 0 };
  const loud = () => S.sounds < 2;
  const burst = (up) => {
    for (const p of sand) {
      const a = rand(0, TAU), r = rand(0.2, 1.0);
      p.s.position.set(Math.sin(a) * r, rand(0.05, 0.3), Math.cos(a) * r - 0.3);
      p.v.set(Math.sin(a) * rand(0.2, 0.6), rand(0.4, 1.1) * up, Math.cos(a) * rand(0.2, 0.6));
      p.t = 0; p.life = rand(1.1, 1.8); p.s.visible = true; p.s.material.opacity = 0; p.s.material.rotation = rand(0, TAU);
    }
  };
  const shatter = () => {
    const c = root.worldToLocal(_khSpecV.set(0, -0.05, 0.1).applyMatrix4(z.rig.chest.matrixWorld));
    for (const b of bones) {
      b.m.position.copy(c); b.m.scale.set(rand(0.03, 0.06), rand(0.1, 0.22), rand(0.03, 0.06)); b.m.rotation.set(rand(0, TAU), rand(0, TAU), 0);
      b.v.set(rand(-2, 2), rand(1.5, 3.5), rand(-2, 2)); b.w.set(rand(-8, 8), rand(-8, 8), rand(-8, 8)); b.m.visible = true;
    }
    burst(1);
  };
  const stepFx = (dt) => {
    for (const p of sand) {
      if (!p.s.visible) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.s.visible = false; continue; }
      p.s.position.addScaledVector(p.v, dt); p.v.y -= 0.6 * dt;
      p.s.scale.setScalar(0.5 + k * 1.3);
      p.s.material.opacity = 0.55 * Math.min(1, k * 6) * (1 - k);
    }
    for (const b of bones) {
      if (!b.m.visible) continue;
      b.v.y -= 9.8 * dt; b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
      if (b.m.position.y < 0.03) { b.m.position.y = 0.03; b.v.y = Math.abs(b.v.y) * 0.2; b.v.x *= 0.5; b.v.z *= 0.5; b.w.multiplyScalar(0.4); }
    }
  };
  const hideFx = () => { for (const p of sand) p.s.visible = false; for (const b of bones) b.m.visible = false; };
  const state = (s, t) => { z.dstate = s; z.st = t; };
  const deep = KHR.depth * KHR.scale;
  let hidden = false;
  return {
    root,
    restyle() { z.look = look(); paintZombieSlot(0, z.look, R, 'kh_rodeur'); },
    center: () => {
      _specC.setFromMatrixPosition(z.rig.chest.matrixWorld);
      _specC.y = 0.95 + (_specC.y - DRIG.mid[1] * KHR.scale);
      return _specC;
    },
    view: [0.6, 0.82],
    shot() {
      if (hidden || z.pos.y < -0.3) return false;
      z.flinch = 0.65; z.flinchSide = Math.random() < 0.5 ? 1 : -1;
      return true;
    },
    pose(anim, t, dt, yaw) {
      if (S.anim !== anim || t < S.t) { S.anim = anim; S.loop = -1; S.sounds = 0; S.phase = -1; hideFx(); hidden = false; z.dan = null; z.pos.set(0, 0, 0); z.flinch = 0; }
      S.t = t;
      z.yaw = yaw; z.moving = 0; z.aim = 0; z.leap = 0; z.pos.set(0, 0, 0);
      const loopOf = (len) => { const L = Math.floor(t / len); if (L !== S.loop) { if (S.loop >= 0) S.sounds++; S.loop = L; S.phase = -1; } return t - L * len; };
      const once = (ph, fn) => { if (S.phase < ph) { S.phase = ph; fn(); } };
      const rise = (p) => { const k = clamp(p / 1.2, 0, 1); z.pos.y = -deep * (1 - smooth(k)); state(k < 1 ? 'spawn' : 'idle', p); };
      switch (anim) {
        case 'gallop':
          state('chase', z.st + dt); z.moving = 7.5;
          break;
        case 'emerge': {
          // sous le sable 0,4 s, sortie en 1,2 s, puis repos
          const p = loopOf(3.6);
          if (p < 0.4) hidden = true;
          else if (p < 1.6) { hidden = false; once(1, () => { burst(1); if (loud()) Sound.rise(null); }); rise(p - 0.4); }
          else { hidden = false; state('idle', z.st + dt); }
          break;
        }
        case 'grab': {
          const p = loopOf(0.75);
          state('bite', p);
          once(1, () => { if (loud()) Sound.dogBite(null); });
          break;
        }
        case 'dive': {
          // les phares : il replonge (0,8 s), reste sous le sable, ressort
          const p = loopOf(4.4);
          if (p < 0.8) state('idle', z.st + dt);
          else if (p < 1.6) { once(1, () => { burst(0.6); if (loud()) Sound.dogYelp(null); }); z.pos.y = -deep * smooth((p - 0.8) / 0.8); state('chase', z.st + dt); }
          else if (p < 2.9) hidden = true;
          else { hidden = false; once(2, () => burst(1)); rise(p - 2.9); }
          break;
        }
        case 'death': {
          // il court, s'effondre en sable et en os, puis ressort du sol
          const p = loopOf(4.6);
          if (p < 1.4) { hidden = false; state('chase', z.st + dt); z.moving = 7.5; }
          else if (p < 3.3) once(1, () => { shatter(); hidden = true; if (loud()) Sound.zombie(null, 'death'); });
          else { once(2, () => { hidden = false; z.dan = null; burst(1); }); rise(p - 3.3); }
          break;
        }
        default:
          state('idle', z.st + dt);
          z.aim = Math.sin(t * 0.7) * 0.7;
          break;
      }
      z.flinch = damp(z.flinch, 0, 6, dt);
      animateDog(z, dt);
      if (hidden) hideZombieSlot(0, R);
      flushZombieMatrices(R);
      eyeGlow.forEach((e, i) => {
        e.visible = !hidden && z.pos.y > -0.35;
        if (e.visible) e.position.copy(root.worldToLocal(_khSpecV.set(i ? 0.034 : -0.034, 0.0, 0.126).applyMatrix4(z.rig.head.matrixWorld)));
      });
      stepFx(dt);
    },
  };
}
/* Libellés et fiches (MODEL_ANIMS et SPECIMEN_FACTS sont définis plus bas dans le fichier : appelé après eux). */
function khSpecimenSetup() {
  Object.assign(MODEL_ANIMS, { emerge: 'Sortie du sable', grab: 'Agrippe', dive: 'Plongée' });
  SPECIMEN_FACTS.kh = (type) => {
    const hit = RULES.zombieHit * type.mult.damage, mh = type.mult.hp, hp = (r) => fmtNum(khHp(r) * mh, 0), d = type.drop, pct = (x) => `${fmtNum(x * 100, 2)} %`;
    const sp = (k) => `${fmtNum(SPEEDS[k][0])} à ${fmtNum(SPEEDS[k][1])}`;
    const where = { kh_arch: 'Surtout au camp de fouilles et au plateau', kh_ouvrier: 'Surtout à la centrale, au relais Km 47 et à l’aérodrome', kh_villageois: 'Surtout à l’oasis de Sekhet', kh_pilote: 'Seul, autour du bassin de l’oasis de Sekhet' }[type.id] || 'Partout';
    const details = [
      ['Apparaît', 'Khamsin', '', `${where} ; ils sortent du sable autour de vous`],
      ['Points de vie', `${hp(1)} → ${hp(10)} → ${hp(20)}`, '', mh > 1 ? `Manches 1, 10 et 20 : ${fmtNum(mh, 0)} fois ceux d’un Desséché` : 'Manches 1, 10 et 20 : 150, +100 par manche jusqu’à la 10, puis ×1,1'],
      ['Vitesse', `${fmtNum(SPEEDS.walk[0])} à ${fmtNum(SPEEDS.run[1])} m/s`, '', `Marche ${sp('walk')} m/s jusqu’à la manche 5 ; dès la 6, trot ${sp('jog')} et course ${sp('run')} m/s`],
      ['Coup', `${fmtNum(hit, 0)} dégâts`, '', `${Math.ceil(RULES.playerHp / hit)} coups vous mettent à terre, ${Math.ceil(RULES.cuirasseHp / hit)} avec ${PERKS.cuirasse.name}`],
      ['Bruit', `${VEH_TYPES.jeep.noise} m`, '', `Un moteur qui tourne les attire jusqu’à ${VEH_TYPES.jeep.noise} m, ${VEH_TYPES.truck.noise} m pour le camion blindé`],
      ['Yeux', '150 m', '', 'Turquoise : on les voit dans la poussière avant la silhouette'],
      ['Tête', `dégâts ×${fmtNum(type.headMult)}`, '', 'Sans casque : rien n’arrête le premier tir à la tête'],
      ['Points rapportés', `+${RULES.pointsKill} à +${RULES.pointsKnife}`, '', `Élimination +${RULES.pointsKill}, tête +${RULES.pointsHead}, khépesh +${RULES.pointsKnife} · +${RULES.pointsHit} par touche`],
    ];
    if (type.pilot) details.push(['Clé de contact', 'pièce ③', '', 'Abattu, il lâche la clé de contact du KH-47 ; tant qu’il ne vous a pas vu, il fait le tour du bassin']);
    if (d && d.item === 'mag') details.push(['Chargeur', `${pct(d.chance)} des Archéologues`, '', `Un chargeur de plus pour l’arme en main (ou l’autre si sa réserve est pleine) · ${PICKUPS.mag.life} s au sol`]);
    return {
      bars: [['PV', (khHp(1) * mh) / zombieHpForRound(1)], ['Vitesse', type.mult.speed], ['Dégâts', type.mult.damage]],
      ref: `Référence ×1 du bestiaire : le Fantassin, ${fmtNum(zombieHpForRound(1), 0)} PV à la manche 1. Les Desséchés ont leur propre courbe : ${hp(1)} PV à la manche 1, ${hp(10)} à la 10.`,
      cards: [
        [`Capacité · ${type.ability}`, 'Ils marchent jusqu’à la manche 5 et courent dès la 6. Un moteur qui tourne les attire.'],
        ['Signe distinctif', type.sign],
      ],
      details,
    };
  };
  SPECIMEN_FACTS.rodeur = (type) => {
    const hp = (r) => fmtNum(khHp(r) * 2, 0), dmg = KHR.bite + KHR.dps * KHR.grab;
    return {
      bars: [['PV', (khHp(1) * 2) / zombieHpForRound(1)], ['Vitesse', KHR.speed[1] / SPEEDS.jog[1]], ['Dégâts', dmg / RULES.zombieHit]],
      ref: `Trait clair = zombie standard (×1) : ${fmtNum(zombieHpForRound(1), 0)} PV à la manche 1, trot de ${fmtNum(SPEEDS.jog[0])} à ${fmtNum(SPEEDS.jog[1])} m/s, ${fmtNum(RULES.zombieHit, 0)} dégâts par coup.`,
      cards: [
        [`Capacité · ${type.ability}`, `Il sort du sable pendant la Tempête et le Khamsin. Il agrippe un joueur à pied ${fmtNum(KHR.grab, 0)} s et bloque ${fmtNum(KHR.stall, 0)} s un véhicule qui roule à moins de ${KHR.stallKmh} km/h.`],
        ['Faiblesse', `Très rapide en ligne droite, lent dans les virages. Les phares braqués sur lui le renvoient ${fmtNum(KHR.dive, 0)} s sous le sable.`],
      ],
      details: [
        ['Apparition', 'Tempête et Khamsin', '', `Il sort du sable à ${KHR.dist[0]} à ${KHR.dist[1]} m de vous · ${KHR.max[2]} à la fois en Tempête, ${KHR.max[3]} en Khamsin · il replonge quand le vent tombe`],
        ['Points de vie', `${hp(1)} → ${hp(10)} → ${hp(20)}`, '', 'Manches 1, 10 et 20 : deux fois ceux d’un Desséché de la même manche'],
        ['Vitesse', `${fmtNum(KHR.speed[0])} à ${fmtNum(KHR.speed[1])} m/s`, '', 'En ligne droite ; moins de la moitié dans les virages'],
        ['Prise', `${fmtNum(KHR.grab, 0)} s`, '', `Joueur à pied : ${KHR.bite} dégâts, puis ${KHR.dps} par seconde · seul, un coup de khépesh (V) vous libère`],
        ['Véhicule', `${fmtNum(KHR.stall, 0)} s`, '', `Bloque un véhicule qui roule à moins de ${KHR.stallKmh} km/h`],
        ['Parade', 'Les phares', '', `À moins de ${KHR.lights} m, droit devant : il replonge ${fmtNum(KHR.dive, 0)} s sous le sable`],
        ['Taille', '1 m · 2,5 m', '', 'Au garrot · queue comprise'],
        ['Points rapportés', `+${RULES.pointsKill} à +${RULES.pointsKnife}`, '', `Élimination +${RULES.pointsKill}, tête +${RULES.pointsHead}, khépesh +${RULES.pointsKnife} · +${RULES.pointsHit} par touche · hors du décompte de la manche`],
      ],
    };
  };
}

/* ---- Yeux qui percent la poussière (points turquoise, sans brouillard, taille fixe) */
const KHE = { pts: null, pos: null };
const _khEye = new THREE.Vector3();
function khEyes() {
  if (!KHE.pts) {
    const n = ZR.N * 2;
    KHE.pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(KHE.pos, 3));
    g.setDrawRange(0, 0);
    KHE.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(KH_EYE).convertSRGBToLinear(), size: 4, sizeAttenuation: false, map: TEX.glow, transparent: true, depthWrite: false, fog: false }));
    KHE.pts.frustumCulled = false; KHE.pts.renderOrder = 8;
    scene.add(KHE.pts);
  }
  let n = 0;
  const P = KHE.pos, H = ZRIG.head, cx = camera.position.x, cz = camera.position.z;
  for (const z of Zombies.list) {
    if (z.boss) continue;
    if (!z.alive || z.removed || z.rstate === 'gone' || (z.headless && !z.rodeur) || ((z.rodeur || z.state === 'rise') && z.pos.y < z.gy - 0.6)) continue;
    const d = Math.hypot(z.pos.x - cx, z.pos.z - cz);
    if (d < 12 || d > 150 || n >= ZR.N * 2 - 2) continue;
    const bone = z.rodeur ? z.rig.head : z.rig.neck;
    for (const s of [-1, 1]) {
      if (z.rodeur) _khEye.set(s * 0.034, 0.0, 0.124); else _khEye.set(s * 0.04, H - 0.004, 0.106);
      _khEye.applyMatrix4(bone.matrixWorld);
      P[n * 3] = _khEye.x; P[n * 3 + 1] = _khEye.y; P[n * 3 + 2] = _khEye.z; n++;
    }
  }
  KHE.pts.geometry.setDrawRange(0, n);
  KHE.pts.geometry.attributes.position.needsUpdate = true;
  KHE.pts.visible = OW.on;
  const k = clamp(KHS.lv / 3, 0, 1);
  KHE.pts.material.opacity = 0.7 + 0.3 * k;
  KHE.pts.material.size = 4 + 2.5 * k;            // pixels : plus gros quand la poussière cache tout
}
