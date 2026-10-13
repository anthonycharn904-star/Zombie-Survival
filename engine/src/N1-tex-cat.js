/* =====================================================================================================
   Jeu 2.0.4 : catalogue de la grande bibliothèque de textures. Familles × teintes × formats × états,
   identifiants stables gx_<famille>[_<format>]_<teinte>[_<état>] (les cartes les enregistrent : ne
   jamais renommer une clé). Chaque texture porte ses métadonnées pour le navigateur des Mod Tools :
   src 'gen', fam / famName (famille), use (murs, sols, plafonds, toits, extérieur, décor), surf
   (genre de surface), state (état : neuf, usé, sale…), tint (teinte dominante, sRGB) et hue (famille
   de couleur), tags. Les textures du jeu 1.x, de Khamsin et de la Lune reçoivent les mêmes champs.
   ===================================================================================================== */
// nouvelles catégories (bibliothèque latérale des Mod Tools)
TEX_CATS.splice(TEX_CATS.findIndex((c) => c[0] === 'brique') + 1, 0, ['pierre', 'Pierre & roche']);
TEX_CATS.splice(TEX_CATS.findIndex((c) => c[0] === 'exterieur') + 1, 0, ['nature', 'Nature & végétal']);
TEX_CATS.push(['verre', 'Verre & eau'], ['scifi', 'Science-fiction'], ['lumineux', 'Lumineux & écrans'], ['horreur', 'Horreur'], ['objets', 'Objets du jeu']);

/* Listes des filtres du navigateur (les Mod Tools les lisent dans ZS.LIB_FACETS). */
const LIB_FACETS = {
  texUse: [['mur', 'Murs'], ['sol', 'Sols'], ['plafond', 'Plafonds'], ['toit', 'Toits'], ['ext', 'Extérieur'], ['deco', 'Décor, spécial']],
  texSurf: [['brique', 'Brique'], ['pierre', 'Pierre, marbre, roche'], ['beton', 'Béton, enduit'], ['peinture', 'Peinture'], ['carrelage', 'Carrelage'], ['bois', 'Bois'], ['metal', 'Métal'],
    ['tissu', 'Tissu, papier peint'], ['souple', 'Moquette, lino, résine'], ['terre', 'Terre, sable, gravier'], ['vegetal', 'Végétal'], ['toiture', 'Toiture'], ['verre', 'Verre, eau'],
    ['lumiere', 'Lumières, écrans'], ['special', 'Spécial'], ['image', 'Image importée']],
  texMat: [['mat', 'Mate'], ['satine', 'Satinée'], ['brillant', 'Brillante'], ['metal', 'Métallique'], ['lumineux', 'Lumineuse']],
  texSrc: [['bunker7', 'Bunker 7'], ['khamsin', 'Khamsin'], ['ombre', 'Ombre éternelle'], ['biblio', 'Bibliothèque (jeu 1.x)'], ['objets', 'Objets du jeu'], ['gen', 'Générées (jeu 2.0.4)'], ['import', 'Mes images'], ['variant', 'Variantes (carte)']],
  texState: [['neuf', 'Neuf, propre'], ['use', 'Usé, vieilli'], ['sale', 'Sale, taché'], ['abime', 'Fissuré, cassé, écaillé'], ['mousse', 'Moussu, pourri'], ['brule', 'Brûlé, suie'],
    ['sang', 'Ensanglanté'], ['eau', 'Humide, mouillé'], ['rouille', 'Rouillé, patiné'], ['gel', 'Gelé, enneigé']],
  texHue: [['blanc', 'Blanc'], ['gris', 'Gris'], ['noir', 'Noir'], ['beige', 'Beige, sable'], ['brun', 'Brun'], ['rouge', 'Rouge'], ['orange', 'Orange'], ['jaune', 'Jaune'],
    ['vert', 'Vert'], ['bleu', 'Bleu'], ['violet', 'Violet'], ['rose', 'Rose'], ['multi', 'Plusieurs couleurs']],
  modMat: [['bois', 'Bois'], ['metal', 'Métal'], ['plastique', 'Plastique, caoutchouc'], ['tissu', 'Tissu, cuir'], ['pierre', 'Pierre, béton'], ['verre', 'Verre'], ['papier', 'Papier, carton'],
    ['vegetal', 'Végétal'], ['organique', 'Organique'], ['peint', 'Peint'], ['lumiere', 'Lumineux']],
  modState: [['neuf', 'Neuf'], ['use', 'Usé'], ['abime', 'Abîmé, cassé'], ['renverse', 'Renversé, penché'], ['brule', 'Brûlé'], ['sang', 'Ensanglanté'], ['rouille', 'Rouillé'], ['mousse', 'Moussu'],
    ['neige', 'Enneigé'], ['eteint', 'Éteint']],
};

/* ------------------------------------------------------------- outils -- */
/* Famille de couleur d'une teinte sRGB (filtre « Teinte »). */
function gxHue(c) {
  if (!c) return 'multi';
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.14) return 'noir';
  if (s < 0.14 || d < 0.06) return l > 0.74 ? 'blanc' : l < 0.22 ? 'noir' : 'gris';
  let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hh = (hh * 60 + 360) % 360;
  if (hh < 14 || hh >= 345) return l > 0.62 ? 'rose' : l < 0.3 && s < 0.55 ? 'brun' : 'rouge';
  if (hh < 42) return l < 0.36 || (s < 0.4 && l < 0.5) ? 'brun' : s < 0.42 || l > 0.68 ? 'beige' : 'orange';
  if (hh < 66) return s < 0.34 || l > 0.74 ? 'beige' : l < 0.3 ? 'brun' : 'jaune';
  if (hh < 170) return 'vert';
  if (hh < 255) return 'bleu';
  if (hh < 295) return 'violet';
  return l < 0.3 ? 'violet' : 'rose';
}
/* Accord des adjectifs (couleurs, états) : forme masculine singulière → genre (f) et nombre (pl).
   Invariables : composés (« bleu nuit », « vert d'eau », « bleu-gris ») et noms de couleur. */
const GX_INV = new Set(['orange', 'marron', 'crème', 'kaki', 'bordeaux', 'turquoise', 'ocre', 'sable', 'chocolat', 'lilas', 'anthracite', 'saumon', 'ivoire', 'émeraude', 'olive',
  'moutarde', 'caramel', 'cuivre', 'bronze', 'or', 'argent', 'acier', 'tabac', 'paille', 'corail', 'prune', 'ardoise', 'aluminium', 'chrome', 'inox', 'titane', 'laiton', 'miel', 'citron',
  'ciment', 'jade', 'onyx', 'granit', 'calcaire', 'tuffeau', 'basalte', 'schiste', 'craie', 'meulière', 'silex', 'grès', 'chêne', 'noyer', 'acajou', 'merisier', 'pin', 'sapin', 'hêtre',
  'érable', 'bouleau', 'teck', 'wengé', 'ébène', 'frêne', 'mélèze']);
function gxAcc(word, f, pl) {
  if (!word) return '';
  if (word.startsWith('très ')) return `très ${gxAcc(word.slice(5), f, pl)}`;
  if (/[\s-]/.test(word) || GX_INV.has(word)) return word;
  let s = word;
  if (f) {
    if (s.endsWith('e')) { /* jaune, rouge, rose, beige, pâle, sale, humide */ }
    else if (s === 'blanc') s = 'blanche';
    else if (s === 'neuf') s = 'neuve';
    else if (s === 'sec') s = 'sèche';
    else if (s === 'vieux') s = 'vieille';
    else if (s.endsWith('et')) s += 'te';
    else if (s.endsWith('en')) s += 'ne';
    else if (s.endsWith('eux')) s = `${s.slice(0, -1)}se`;
    else if (s.endsWith('if')) s = `${s.slice(0, -1)}ve`;
    else s += 'e';
  }
  if (pl && !/[sx]$/.test(s)) s += 's';
  return s;
}
const gxMix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const gxAvg = (list) => { const s = [0, 0, 0]; for (const c of list) { s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; } return s.map((v) => Math.round(v / list.length)); };
/* États : [facette du navigateur, adjectif (masculin singulier), réglages par défaut du générateur]. */
const GX_WEAR = {
  n: ['neuf', '', { stains: 1, cracks: 0, drips: 0 }],
  u: ['use', 'usé', {}],
  v: ['use', 'très usé', {}],
  d: ['use', 'délavé', {}],
  a: ['use', 'vieilli', {}],
  ry: ['use', 'rayé', {}],
  s: ['sale', 'sale', { stains: 14, drips: 14 }],
  t: ['sale', 'taché', { stains: 14, drips: 18 }],
  f: ['abime', 'fissuré', { cracks: 16 }],
  c: ['abime', 'cassé', {}],
  e: ['abime', 'écaillé', {}],
  ev: ['abime', 'très écaillé', {}],
  x: ['abime', 'déchiré', {}],
  o: ['abime', 'éventré', {}],
  m: ['mousse', 'moussu', { moss: 0.8, stains: 8 }],
  p: ['mousse', 'pourri', { moss: 0.5, stains: 12 }],
  b: ['brule', 'brûlé', { soot: 1 }],
  g: ['sang', 'ensanglanté', { blood: 1.3 }],
  h: ['eau', 'humide', { water: 1, stains: 10 }],
  w: ['eau', 'mouillé', { wet: true }],
  r: ['rouille', 'rouillé', {}],
  rr: ['rouille', 'très rouillé', {}],
  z: ['rouille', 'patiné', {}],
  gl: ['gel', 'gelé', { frost: 0.6 }],
};
const GX = { n: 0, fams: new Map(), t0: performance.now(), ms: 0 };   // ms : temps d'enregistrement des bibliothèques (au chargement)
/* Une texture générée (defTex et métadonnées). */
function gxTex(id, name, cat, opts, gen, m) {
  if (TEXLIB[id]) console.warn(`Texture en double : ${id}`);
  // identifiant stable écrit dans les cartes : minuscules, chiffres et _ seulement
  if (!/^gx_[a-z0-9_]+$/.test(id)) console.error(`Identifiant de texture invalide : ${id}`);
  defTex(id, name, cat, opts, gen);
  const d = TEXLIB[id];
  d.src = m.src || 'gen';
  d.fam = m.fam; d.famName = m.famName; d.use = m.use; d.surf = m.surf; d.state = m.state || 'neuf';
  d.tint = m.tint || null; d.hue = m.hue || gxHue(m.tint);
  if (m.tags) d.tags = m.tags;
  if (opts.glow) { d.glow = opts.glow; d.mat = 'lumineux'; }
  if (opts.mat) d.mat = opts.mat;
  GX.n++;
  if (!GX.fams.has(m.fam)) GX.fams.set(m.fam, { name: m.famName, surf: m.surf, n: 0 });
  GX.fams.get(m.fam).n++;
  return d;
}
/* Une famille : colors × formats × états. sp :
   key, famName, cat, surf, use (liste ou fn(f)), size (liste ou fn(f, c)), fit, rough, metal, glow,
   colors [[clé, nom, teinte (rgb), extra…]], formats [[clé, libellé, extra…]] (facultatif),
   states (liste ou fn(f, c)), patch { état: réglages } (sinon ceux de GX_WEAR),
   nm(c, f) → nom de base, gp(f) → [genre 'f'|'m', pluriel] (accord de l'état), gen(c, f, réglages, état),
   tint(c, f) (sinon c[2]), tags. */
function gxFam(sp) {
  const fmts = sp.formats || [[null]];
  for (const f of fmts) {
    for (const c of sp.colors) {
      const states = typeof sp.states === 'function' ? sp.states(f, c) : sp.states || ['n'];
      for (const st of states) {
        const W = GX_WEAR[st];
        const [gg, pl] = sp.gp ? sp.gp(f, c) : [sp.g || 'm', !!sp.pl];
        const base = sp.nm(c, f);
        const name = !W[1] ? base : `${base} · ${gxAcc(W[1], gg === 'f', pl)}`;
        const famKey = f[0] ? `${sp.key}_${f[0]}` : sp.key;
        const id = `gx_${famKey}_${c[0]}${st === 'n' ? '' : `_${st}`}`;
        const patch = sp.patch && sp.patch[st] !== undefined ? sp.patch[st] : W[2];
        const size = typeof sp.size === 'function' ? sp.size(f, c) : sp.size || [2, 2];
        const tint0 = sp.tint ? sp.tint(c, f) : c[2];
        const famName = typeof sp.famName === 'function' ? sp.famName(f) : sp.famName;
        const glow = typeof sp.glow === 'function' ? sp.glow(f, c) : sp.glow;
        gxTex(id, name, sp.cat, { size, fit: !!sp.fit, rough: typeof sp.rough === 'function' ? sp.rough(f, c, st) : sp.rough === undefined ? 0.9 : sp.rough, metal: sp.metal || 0, glow, mat: sp.mat },
          sp.gen(c, f, patch, st), { fam: famKey, famName, use: typeof sp.use === 'function' ? sp.use(f) : sp.use, surf: typeof sp.surf === 'function' ? sp.surf(f, c) : sp.surf, state: W[0], tint: tint0 && tint0.length === 3 && typeof tint0[0] === 'number' ? tint0 : null, hue: sp.hue ? sp.hue(c) : null, src: sp.src, tags: sp.tags });
      }
    }
  }
}

/* ---------------------------------------------------------------- teintes -- */
const GX_PAINT = [
  ['blanc', 'blanc cassé', [214, 210, 198]], ['blancpur', 'blanc', [232, 232, 226]], ['creme', 'crème', [222, 208, 170]], ['beige', 'beige', [196, 178, 146]],
  ['sable', 'sable', [204, 182, 140]], ['ocre', 'ocre', [204, 160, 80]], ['moutarde', 'moutarde', [190, 156, 50]], ['jaune', 'jaune', [226, 190, 40]],
  ['orange', 'orange', [214, 120, 46]], ['terracotta', 'terre cuite', [168, 86, 58]], ['brique', 'rouge brique', [150, 58, 44]], ['rouge', 'rouge', [178, 36, 32]],
  ['bordeaux', 'bordeaux', [104, 30, 38]], ['rosepale', 'rose pâle', [214, 170, 166]], ['rose', 'rose', [208, 92, 130]], ['lilas', 'lilas', [160, 140, 180]],
  ['violet', 'violet', [96, 60, 120]], ['nuit', 'bleu nuit', [36, 44, 76]], ['marine', 'bleu marine', [40, 56, 96]], ['roi', 'bleu roi', [44, 80, 160]],
  ['ciel', 'bleu ciel', [140, 180, 210]], ['bleugris', 'bleu-gris', [100, 120, 136]], ['turquoise', 'turquoise', [46, 150, 150]], ['eau', 'vert d’eau', [150, 196, 176]],
  ['menthe', 'vert menthe', [150, 200, 150]], ['pomme', 'vert pomme', [130, 170, 60]], ['olive', 'vert olive', [110, 110, 60]], ['sapin', 'vert sapin', [40, 80, 54]],
  ['militaire', 'vert militaire', [86, 92, 60]], ['kaki', 'kaki', [140, 130, 92]], ['grisclair', 'gris clair', [176, 176, 172]], ['gris', 'gris', [128, 128, 124]],
  ['anthracite', 'anthracite', [62, 64, 66]], ['noir', 'noir', [30, 30, 32]], ['marron', 'marron', [100, 70, 48]], ['chocolat', 'chocolat', [70, 46, 34]],
];
const gxPaints = (...keys) => GX_PAINT.filter((p) => keys.includes(p[0]));
const GX_METAL = [
  ['acier', 'gris acier', [128, 132, 134]], ['sombre', 'gris foncé', [76, 80, 82]], ['galva', 'galvanisé', [160, 164, 166]], ['alu', 'aluminium', [190, 192, 194]],
  ['marine', 'gris marine', [96, 104, 110]], ['militaire', 'vert militaire', [70, 86, 62]], ['kaki', 'kaki', [120, 114, 80]], ['bleu', 'bleu industriel', [52, 82, 120]],
  ['rouge', 'rouge pompier', [150, 40, 32]], ['jaune', 'jaune engin', [204, 160, 40]], ['orange', 'orange', [196, 96, 36]], ['blanc', 'blanc', [200, 202, 198]],
  ['noir', 'noir', [40, 42, 44]], ['vert', 'vert', [60, 110, 70]], ['creme', 'crème', [214, 204, 176]], ['anthracite', 'anthracite', [58, 60, 62]],
];
const GX_WOOD = [
  ['chene', 'chêne', [150, 104, 62]], ['chenecl', 'chêne clair', [178, 138, 90]], ['chenefo', 'chêne foncé', [104, 70, 42]], ['noyer', 'noyer', [96, 64, 42]],
  ['acajou', 'acajou', [120, 52, 36]], ['merisier', 'merisier', [150, 80, 52]], ['pin', 'pin', [196, 160, 104]], ['sapin', 'sapin', [180, 150, 110]],
  ['hetre', 'hêtre', [190, 140, 100]], ['erable', 'érable', [214, 184, 140]], ['bouleau', 'bouleau', [222, 200, 160]], ['teck', 'teck', [150, 100, 52]],
  ['wenge', 'wengé', [62, 44, 34]], ['ebene', 'ébène', [40, 30, 26]], ['frene', 'frêne', [200, 176, 140]], ['grise', 'bois grisé', [140, 134, 122]],
  ['flotte', 'bois flotté', [176, 168, 150]], ['palette', 'bois de palette', [184, 156, 110]],
];
const gxWoodPal = (c) => [c, shadec(c, 0.88), shadec(c, 1.1), gxMix(c, [120, 90, 60], 0.2)];
const GX_TILE = [
  ['blanc', 'blanc', [216, 216, 210]], ['creme', 'crème', [222, 210, 180]], ['grisclair', 'gris clair', [180, 180, 176]], ['gris', 'gris', [130, 130, 128]],
  ['anthracite', 'anthracite', [64, 66, 68]], ['noir', 'noir', [30, 30, 32]], ['ciel', 'bleu ciel', [150, 190, 214]], ['bleu', 'bleu', [70, 120, 170]],
  ['nuit', 'bleu nuit', [36, 50, 90]], ['eau', 'vert d’eau', [150, 196, 176]], ['vert', 'vert', [70, 130, 90]], ['bouteille', 'vert bouteille', [30, 70, 50]],
  ['jaune', 'jaune', [222, 196, 90]], ['terracotta', 'terre cuite', [170, 86, 56]], ['rouge', 'rouge', [168, 40, 36]], ['rose', 'rose', [222, 170, 170]],
];
const gxLum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const gxGrout = (c) => (gxLum(c) > 110 ? [124, 122, 116] : [150, 148, 142]);

/* =================================================================== peintures */
gxFam({
  key: 'p2', famName: 'Murs deux tons à frise', cat: 'peint', surf: 'peinture', use: ['mur'], size: [2, 3.5], fit: true, rough: 0.92, g: 'm',
  colors: [
    ['vertcreme', 'vert et crème', [214, 204, 172], [70, 104, 80], [40, 60, 46]], ['bleublanc', 'bleu et blanc', [214, 214, 206], [56, 84, 124], [32, 48, 74]],
    ['rougegris', 'rouge et gris', [160, 158, 152], [130, 40, 34], [60, 20, 18]], ['brunbeige', 'brun et beige', [200, 186, 156], [96, 66, 44], [60, 40, 26]],
    ['grisblanc', 'gris et blanc', [214, 212, 206], [110, 112, 112], [60, 60, 62]], ['jaunegris', 'jaune et gris', [150, 150, 146], [190, 160, 60], [50, 50, 50]],
    ['noirblanc', 'noir et blanc', [206, 204, 198], [36, 36, 38], [120, 30, 30]], ['vertgris', 'vert et gris', [158, 160, 152], [70, 92, 72], [40, 56, 44]],
    ['bleugris', 'bleu et gris', [168, 172, 174], [70, 92, 116], [40, 52, 70]], ['bordeauxcreme', 'bordeaux et crème', [214, 200, 168], [100, 34, 40], [60, 20, 24]],
    ['ocreblanc', 'ocre et blanc', [218, 212, 196], [180, 134, 70], [110, 80, 40]], ['kakisable', 'kaki et sable', [196, 180, 140], [110, 106, 70], [70, 66, 44]],
    ['turquoiseblanc', 'turquoise et blanc', [216, 220, 214], [52, 140, 140], [30, 84, 84]], ['roseblanc', 'rose et blanc', [222, 214, 206], [196, 120, 130], [140, 70, 80]],
    ['violetgris', 'violet et gris', [170, 168, 170], [92, 64, 110], [56, 38, 66]], ['orangegris', 'orange et gris', [150, 150, 146], [200, 110, 46], [90, 50, 20]],
    ['sapinbeige', 'vert sapin et beige', [200, 186, 150], [42, 76, 54], [26, 46, 32]], ['nuitgris', 'bleu nuit et gris', [160, 162, 166], [36, 44, 76], [20, 24, 44]],
    ['anthrablanc', 'anthracite et blanc', [220, 220, 216], [62, 64, 66], [30, 30, 32]], ['terrecreme', 'terre cuite et crème', [222, 206, 170], [160, 84, 56], [100, 50, 30]],
  ].map(([k, n, top, bottom, band]) => [k, n, gxMix(top, bottom, 0.55), { top, bottom, band }]),
  nm: (c) => `Mur deux tons ${c[1]}`,
  states: ['n', 'u', 'v', 'b', 'g', 'h'],
  patch: { n: { wear: 0.3 }, u: { wear: 1 }, v: { wear: 1.8 }, b: { wear: 1.4, soot: 1 }, g: { wear: 1, blood: 1 }, h: { wear: 1.2, water: 1 } },
  gen: (c, f, p) => tgPaint2({ ...c[3], ...p }),
});
gxFam({
  key: 'pu', famName: 'Peintures unies', cat: 'peint', surf: 'peinture', use: ['mur', 'plafond'], rough: 0.86, g: 'f',
  colors: GX_PAINT, nm: (c) => `Peinture ${gxAcc(c[1], true, false)}`,
  states: ['n', 'e', 's', 'g', 'h', 'b'],
  patch: { n: { stains: 1, cracks: 0, drips: 0 }, e: { chips: 0.55, under: [150, 142, 128], stains: 4, cracks: 3 }, s: { stains: 14, drips: 16, cracks: 2 }, g: { blood: 1.3, stains: 3 }, h: { water: 1, stains: 8, drips: 8 }, b: { soot: 1, stains: 6 } },
  gen: (c, f, p) => tgPlaster({ color: c[2], ...p }),
});

/* ========================================================= béton, enduits, pisé */
gxFam({
  key: 'bt', famName: (f) => ({ brut: 'Béton brut', coffre: 'Béton coffré', dalle: 'Dalles de béton', poli: 'Béton poli' })[f[0]], cat: 'beton', surf: 'beton',
  use: (f) => (f[0] === 'dalle' || f[0] === 'poli' ? ['sol'] : ['mur', 'sol', 'plafond']), rough: (f) => (f[0] === 'poli' ? 0.55 : 0.95),
  colors: [['gris', 'gris', [128, 124, 116]], ['clair', 'clair', [170, 166, 158]], ['sombre', 'sombre', [82, 80, 76]], ['chaud', 'chaud', [140, 128, 112]], ['froid', 'froid', [114, 122, 128]],
    ['ocre', 'ocre', [160, 140, 104]], ['rose', 'rosé', [156, 130, 120]], ['vert', 'verdâtre', [110, 120, 108]], ['anthracite', 'anthracite', [64, 64, 66]], ['blanc', 'blanc', [196, 194, 186]]],
  formats: [['brut', 'brut', {}], ['coffre', 'coffré', { form: 4 }], ['dalle', null, { joints: true, cracks: 3 }], ['poli', 'poli', { polish: true, stains: 2, cracks: 1 }]],
  nm: (c, f) => (f[0] === 'dalle' ? `Dalles de béton ${gxAcc(c[1], false, false)}` : `Béton ${f[1]} ${gxAcc(c[1], false, false)}`),
  gp: (f) => (f[0] === 'dalle' ? ['f', true] : ['m', false]),
  states: (f) => (f[0] === 'poli' ? ['n', 't', 'f', 'g'] : f[0] === 'dalle' ? ['n', 't', 'f', 'm', 'h', 'g'] : ['n', 't', 'f', 'm', 'h', 'g', 'b']),
  patch: { n: { stains: 2, cracks: 1 }, t: { stains: 14, drips: 18 }, f: { cracks: 16 }, m: { moss: 0.8, stains: 8 }, h: { water: 1, stains: 10 }, g: { blood: 1.2 }, b: { soot: 1, stains: 8 } },
  gen: (c, f, p) => tgConcrete({ base: c[2], ...f[2], ...p }),
});
gxFam({
  key: 'en', famName: (f) => (f[0] === 'lisse' ? 'Enduits lisses' : 'Crépis'), cat: 'beton', surf: 'beton', use: ['mur'], rough: 0.93, g: 'm',
  colors: [['blanc', 'blanc', [214, 208, 194]], ['chaux', 'chaulé', [226, 218, 196]], ['creme', 'crème', [220, 204, 166]], ['sable', 'sable', [200, 176, 134]], ['ocre', 'ocre', [204, 160, 100]],
    ['ocrerouge', 'ocre rouge', [178, 104, 70]], ['terracotta', 'terre cuite', [176, 100, 70]], ['rose', 'rose', [206, 160, 150]], ['jaune', 'jaune paille', [216, 192, 120]], ['gris', 'gris', [158, 154, 146]],
    ['grisclair', 'gris clair', [188, 186, 180]], ['vert', 'vert pâle', [176, 190, 160]], ['bleu', 'bleu pâle', [170, 186, 196]], ['ciment', 'ciment', [140, 138, 132]], ['brun', 'brun', [140, 110, 80]], ['kaki', 'kaki', [150, 140, 104]]],
  formats: [['lisse', 'Enduit lisse', { rough: false }], ['crepi', 'Crépi', { rough: true }]],
  nm: (c, f) => `${f[1]} ${gxAcc(c[1], false, false)}`,
  states: ['n', 'e', 't', 'm', 'h'],
  patch: { n: { stains: 1, cracks: 1, drips: 0 }, e: { chips: 0.55, under: [130, 120, 106], cracks: 4 }, t: { stains: 14, drips: 16 }, m: { moss: 0.75, stains: 8 }, h: { water: 1, stains: 10, drips: 8 } },
  gen: (c, f, p) => tgPlaster({ color: c[2], ...f[2], ...p }),
});
gxFam({
  key: 'pise', famName: 'Pisé (terre crue)', cat: 'beton', surf: 'terre', use: ['mur'], rough: 0.97, g: 'm',
  colors: [['brun', 'brun', [[150, 112, 76], [136, 100, 68], [160, 124, 86], [124, 92, 62]]], ['ocre', 'ocre', [[184, 140, 90], [170, 126, 80], [196, 152, 100]]],
    ['rouge', 'rouge', [[160, 92, 64], [146, 82, 56], [172, 104, 72]]], ['gris', 'gris', [[140, 132, 120], [126, 120, 110], [152, 144, 130]]],
    ['jaune', 'jaune', [[200, 170, 110], [188, 158, 100], [210, 182, 120]]], ['sombre', 'sombre', [[96, 80, 64], [86, 72, 58], [106, 90, 72]]]],
  tint: (c) => gxAvg(c[2]), nm: (c) => `Pisé ${gxAcc(c[1], false, false)}`,
  states: ['n', 'm', 'h'], patch: { n: {}, m: { moss: 0.6 }, h: { water: 1 } },
  gen: (c, f, p) => gxStrata({ colors: c[2], layers: 14, warp: 0.5, joint: 0.04, pebbles: 260, forms: 3, cracks: 4, ...p }),
});

/* =================================================================== briques */
const GX_BRICK = [
  ['rouge', 'rouge', [[138, 59, 42], [122, 52, 36], [154, 70, 48], [110, 47, 34]]], ['fonce', 'rouge foncé', [[96, 40, 30], [84, 34, 26], [108, 46, 34]], { mortarColor: [70, 66, 60] }],
  ['orange', 'orangé', [[176, 96, 56], [162, 86, 48], [188, 108, 64]]], ['jaune', 'jaune', [[184, 149, 90], [168, 134, 80], [196, 162, 106]], { mortarColor: [120, 112, 100] }],
  ['brun', 'brun', [[110, 70, 48], [96, 60, 42], [124, 82, 56]]], ['gris', 'gris', [[120, 118, 112], [106, 104, 100], [134, 130, 124]], { mortarColor: [80, 78, 74] }],
  ['blanc', 'blanc', [[206, 200, 186], [194, 188, 174], [216, 210, 198]], { mortarColor: [150, 146, 136] }], ['noir', 'noir', [[52, 48, 46], [42, 40, 38], [62, 58, 54]], { mortarColor: [96, 92, 86] }],
  ['rose', 'rose', [[188, 130, 112], [176, 118, 102], [200, 142, 124]]], ['flamme', 'flammé', [[138, 59, 42], [96, 40, 30], [70, 40, 32], [160, 90, 60], [120, 70, 50]]],
  ['ancien', 'ancien', [[138, 90, 64], [122, 74, 52], [154, 106, 74], [106, 64, 48]]], ['sable', 'sable', [[198, 172, 128], [186, 160, 118], [208, 184, 140]]],
];
gxFam({
  key: 'br', famName: (f) => ({ std: 'Briques', long: 'Briques romaines', emp: 'Briques empilées' })[f[0]], cat: 'brique', surf: 'brique', use: ['mur'], rough: 0.92, g: 'f', pl: true,
  colors: GX_BRICK, tint: (c) => gxAvg(c[2]), hue: (c) => (c[0] === 'flamme' ? 'rouge' : null),
  formats: [['std', '', {}], ['long', 'romaines', { bw: 0.4, bh: 0.05 }], ['emp', 'empilées', { stack: true }]],
  nm: (c, f) => `Briques ${gxAcc(c[1], true, true)}${f[1] ? ` ${f[1]}` : ''}`,
  states: ['n', 'u', 's', 'm', 'b', 'g', 'h'],
  patch: { n: { stains: 1 }, u: { stains: 4 }, s: { stains: 12, drips: 12 }, m: { moss: 0.7, stains: 8 }, b: { burnt: true, soot: 0.9 }, g: { blood: 1.2 }, h: { water: 1, stains: 8 } },
  gen: (c, f, p) => tgBrick({ tile: 2, colors: c[2], ...(c[3] || {}), ...f[2], ...p }),
});
gxFam({
  key: 'brp', famName: 'Briques peintes', cat: 'brique', surf: 'brique', use: ['mur'], rough: 0.9, g: 'f', pl: true,
  colors: gxPaints('blanc', 'creme', 'grisclair', 'gris', 'eau', 'sapin', 'bleugris', 'marine', 'brique', 'ocre', 'noir', 'kaki'),
  nm: (c) => `Briques peintes ${gxAcc(c[1], true, true)}`,
  states: ['e', 'ev', 's'], patch: { e: { peel: 0.3 }, ev: { peel: 0.52, stains: 6 }, s: { peel: 0.25, stains: 12, drips: 12 } },
  gen: (c, f, p) => tgBrick({ tile: 2, colors: [[138, 59, 42], [122, 52, 36]], paint: c[2], ...p }),
});
gxFam({
  key: 'pa', famName: 'Parpaings', cat: 'brique', surf: 'brique', use: ['mur'], rough: 0.95, g: 'm', pl: true,
  colors: [['gris', 'gris', [140, 138, 132]], ['clair', 'clair', [168, 166, 160]], ['sombre', 'sombre', [100, 98, 94]], ['beige', 'beige', [160, 150, 128]], ['rouge', 'rouge', [170, 100, 70]]],
  nm: (c) => (c[0] === 'rouge' ? 'Briques creuses rouges' : `Parpaings ${gxAcc(c[1], false, true)}`), gp: (f, c) => (c[0] === 'rouge' ? ['f', true] : ['m', true]),
  states: ['n', 's', 'm', 'b', 'g', 'h'], patch: { n: { stains: 1 }, s: { stains: 12, drips: 12 }, m: { moss: 0.7, stains: 8 }, b: { soot: 1, burnt: true }, g: { blood: 1.2 }, h: { water: 1, stains: 8 } },
  gen: (c, f, p) => tgBrick({ tile: 2, colors: [c[2], shadec(c[2], 0.92), shadec(c[2], 1.06)], bw: 0.4, bh: 0.2, mortar: 0.012, mortarColor: shadec(c[2], 0.72), ...p }),
});
gxFam({
  key: 'pap', famName: 'Parpaings peints', cat: 'brique', surf: 'brique', use: ['mur'], rough: 0.92, g: 'm', pl: true,
  colors: gxPaints('blanc', 'creme', 'grisclair', 'gris', 'eau', 'sapin', 'bleugris', 'ciel', 'ocre', 'jaune', 'kaki', 'brique'),
  nm: (c) => `Parpaings peints ${gxAcc(c[1], false, true)}`,
  states: ['e', 's'], patch: { e: { peel: 0.22 }, s: { peel: 0.18, stains: 12, drips: 14 } },
  gen: (c, f, p) => tgBrick({ tile: 2, colors: [[140, 138, 132]], bw: 0.4, bh: 0.2, paint: c[2], mortarColor: [100, 98, 94], ...p }),
});
gxFam({
  key: 'cl', famName: 'Claustras', cat: 'brique', surf: 'beton', use: ['mur'], rough: 0.95, g: 'm',
  colors: [['gris', 'gris', [150, 148, 142]], ['blanc', 'blanc', [206, 204, 196]], ['ocre', 'ocre', [196, 160, 110]], ['rose', 'rose', [196, 150, 136]]],
  formats: [['ronds', 'à ronds'], ['losange', 'à losanges'], ['croix', 'à croix'], ['carres', 'à carrés']],
  nm: (c, f) => `Claustra ${f[1]} ${gxAcc(c[1], false, false)}`, states: ['n', 'm'],
  gen: (c, f, p) => gxBreeze({ tile: 2, color: c[2], motif: f[0], ...p }),
});

/* =================================================================== pierre */
const GX_STONE = [
  ['calcaire', 'calcaire', [[200, 190, 166], [190, 180, 156], [210, 200, 176]]], ['tuffeau', 'tuffeau', [[226, 218, 196], [216, 208, 186], [232, 226, 206]]],
  ['gresrose', 'grès rose', [[176, 120, 100], [164, 110, 92], [188, 132, 110]]], ['gresjaune', 'grès jaune', [[196, 164, 112], [184, 152, 102], [208, 176, 124]]],
  ['gresrouge', 'grès rouge', [[140, 72, 52], [128, 64, 46], [152, 82, 60]]], ['granit', 'granit gris', [[128, 126, 124], [114, 112, 110], [140, 138, 134]]],
  ['granitrose', 'granit rose', [[176, 136, 124], [164, 124, 112], [188, 148, 134]]], ['ardoise', 'ardoise', [[64, 70, 78], [56, 62, 70], [74, 78, 86]]],
  ['basalte', 'basalte', [[52, 52, 54], [44, 44, 46], [62, 60, 60]]], ['meuliere', 'meulière', [[176, 140, 96], [160, 124, 84], [190, 154, 108], [140, 110, 80]]],
  ['silex', 'silex', [[120, 112, 100], [100, 94, 86], [140, 132, 118], [80, 76, 70]]], ['schiste', 'schiste', [[92, 90, 84], [82, 80, 76], [104, 100, 92]]],
];
gxFam({
  key: 'pt', famName: (f) => ({ taille: 'Pierre de taille', grand: 'Grand appareil', moellons: 'Moellons', opus: 'Opus incertum' })[f[0]], cat: 'pierre', surf: 'pierre', use: ['mur'], rough: 0.93,
  colors: GX_STONE, tint: (c) => gxAvg(c[2]),
  formats: [['taille', 'Pierre de taille'], ['grand', 'Grand appareil'], ['moellons', 'Moellons'], ['opus', 'Opus incertum']],
  nm: (c, f) => `${f[1]} (${c[1]})`, gp: (f) => ({ taille: ['f', false], grand: ['m', false], moellons: ['m', true], opus: ['m', false] })[f[0]],
  states: ['n', 'u', 'm', 'h', 'g'], patch: { n: { stains: 1 }, u: { stains: 6 }, m: { moss: 0.8, stains: 8 }, h: { water: 1, stains: 8 }, g: { blood: 1.2 } },
  gen: (c, f, p) => {
    const mc = shadec(gxAvg(c[2]), 0.62);
    if (f[0] === 'taille') return tgBrick({ tile: 2, colors: c[2], bw: 0.6, bh: 0.3, mortar: 0.01, mortarColor: mc, ...p });
    if (f[0] === 'grand') return tgBrick({ tile: 3, colors: c[2], bw: 1.1, bh: 0.55, mortar: 0.008, mortarColor: mc, ...p });
    if (f[0] === 'moellons') return tgStoneWall({ tile: 2, colors: c[2], mortarColor: mc, rowH: 0.2, ...p });
    return gxFlags({ cells: 5, colors: c[2], joint: mc, jw: 0.045, bevel: 0.14, ...p });
  },
  size: (f) => (f[0] === 'grand' ? [3, 3] : [2, 2]),
});
gxFam({
  key: 'dp', famName: (f) => (f[0] === 'dalles' ? 'Dalles de pierre' : 'Dallage irrégulier'), cat: 'pierre', surf: 'pierre', use: ['sol', 'ext'], rough: 0.85,
  colors: GX_STONE, tint: (c) => gxAvg(c[2]),
  formats: [['dalles', 'Dalles de pierre'], ['opus', 'Dallage irrégulier']],
  nm: (c, f) => `${f[1]} (${c[1]})`, gp: (f) => (f[0] === 'dalles' ? ['f', true] : ['m', false]),
  states: ['n', 'm', 'h', 'g'], patch: { n: { stains: 1 }, m: { moss: 0.7, stains: 6 }, h: { water: 1, stains: 8 }, g: { blood: 1.3 } },
  gen: (c, f, p) => (f[0] === 'dalles' ? tgTiles({ tile: 2, colors: c[2], size: 0.5, grout: 0.01, groutColor: shadec(gxAvg(c[2]), 0.55), var: 0.12, dirt: 0.35, ...p }) : gxFlags({ cells: 4, colors: c[2], joint: shadec(gxAvg(c[2]), 0.45), jw: 0.05, bevel: 0.08, ...p })),
});
const GX_ROCK = [
  ['calcaire', 'calcaire', [[196, 186, 160], [180, 170, 146], [206, 196, 172], [170, 160, 138]]], ['gresrouge', 'grès rouge', [[164, 92, 66], [150, 82, 58], [176, 104, 76], [140, 76, 54]]],
  ['gresjaune', 'grès jaune', [[204, 170, 116], [190, 156, 104], [214, 182, 128]]], ['granit', 'granit', [[136, 132, 128], [120, 118, 116], [150, 146, 140]]],
  ['basalte', 'basalte', [[58, 58, 60], [48, 48, 50], [70, 68, 68]]], ['ardoise', 'ardoise', [[70, 76, 84], [60, 66, 74], [82, 86, 92]]],
  ['schiste', 'schiste', [[100, 98, 90], [88, 86, 80], [112, 108, 98]]], ['craie', 'craie', [[226, 222, 210], [214, 210, 198], [236, 232, 222]]],
  ['volcan', 'roche volcanique', [[70, 52, 46], [56, 42, 38], [86, 64, 54]]], ['brune', 'roche brune', [[120, 96, 72], [106, 84, 62], [134, 108, 82]]],
];
gxFam({
  key: 'ro', famName: (f) => (f[0] === 'strates' ? 'Roche en strates' : 'Roche brute'), cat: 'pierre', surf: 'pierre', use: ['mur', 'ext'], rough: 0.96, g: 'f', size: [4, 4],
  colors: GX_ROCK, tint: (c) => gxAvg(c[2]),
  formats: [['strates', 'Roche en strates'], ['brute', 'Roche brute']], nm: (c, f) => `${f[1]} (${c[1]})`,
  states: ['n', 'm', 'h'], patch: { n: {}, m: { moss: 0.8 }, h: { water: 1 } },
  gen: (c, f, p) => (f[0] === 'strates' ? gxStrata({ colors: c[2], layers: 7, cracks: 14, ...p }) : tgConcrete({ base: gxAvg(c[2]), stains: 10, cracks: 18, ...p })),
});
gxFam({
  key: 'mb', famName: 'Marbres', cat: 'pierre', surf: 'pierre', use: ['sol', 'mur'], rough: 0.25, g: 'm',
  colors: [['carrare', 'blanc de Carrare', [222, 220, 214], [130, 130, 136]], ['blancor', 'blanc veiné d’or', [226, 220, 206], [190, 150, 80]], ['noir', 'noir', [34, 34, 38], [170, 170, 176]],
    ['noiror', 'noir et or', [30, 28, 26], [196, 160, 80]], ['vert', 'vert', [40, 70, 56], [190, 200, 190]], ['jade', 'vert jade', [80, 130, 100], [210, 226, 210]], ['rouge', 'rouge', [126, 40, 36], [220, 190, 180]],
    ['rose', 'rose', [210, 170, 160], [160, 110, 100]], ['gris', 'gris', [130, 132, 136], [210, 210, 214]], ['beige', 'beige', [210, 190, 160], [160, 130, 100]], ['brun', 'brun', [100, 70, 50], [190, 160, 120]],
    ['bleu', 'bleu', [60, 84, 120], [200, 214, 230]], ['sienne', 'jaune de Sienne', [204, 170, 100], [140, 100, 50]], ['onyx', 'onyx miel', [210, 150, 80], [240, 210, 150]]],
  formats: [['gd', 'en grandes dalles', 2], ['d', 'en dalles', 4], ['plein', '', 0]],
  nm: (c, f) => `Marbre ${c[1].startsWith('blanc de') || c[1].includes(' ') ? c[1] : gxAcc(c[1], false, false)}${f[1] ? ` ${f[1]}` : ''}`,
  states: ['n', 's'], patch: { n: {}, s: { water: 1 } },
  gen: (c, f, p) => tgMarble({ base: c[2], vein: c[3], tiles: f[2], ...p }),
});

/* =================================================================== toitures */
gxFam({
  key: 'tu', famName: 'Tuiles', cat: 'toit', surf: 'toiture', use: ['toit'], rough: 0.85, g: 'f', pl: true,
  colors: [['rouge', 'rouge', [[126, 62, 42], [108, 52, 36], [138, 72, 48], [96, 48, 34]]], ['brun', 'brun', [[96, 62, 44], [84, 54, 38], [108, 72, 50]]],
    ['orange', 'orangé', [[176, 96, 56], [160, 86, 48], [188, 108, 64]]], ['ocre', 'ocre', [[184, 140, 88], [170, 126, 78], [196, 152, 98]]], ['noir', 'noir', [[48, 46, 46], [40, 38, 38], [58, 56, 54]]],
    ['gris', 'gris', [[110, 108, 104], [96, 94, 92], [124, 120, 116]]], ['vert', 'vert', [[52, 96, 70], [44, 84, 60], [62, 108, 80]]], ['flamme', 'flammé', [[126, 62, 42], [90, 50, 36], [150, 84, 54], [70, 44, 34]]]],
  tint: (c) => gxAvg(c[2]), nm: (c) => `Tuiles ${gxAcc(c[1], true, true)}`,
  states: ['n', 'u', 'm', 's'], patch: { n: { stains: 1 }, u: { stains: 6 }, m: { moss: 0.6, stains: 10 }, s: { stains: 12, drips: 10, soot: 0.4 } },
  gen: (c, f, p) => tgBrick({ tile: 2, colors: c[2], bw: 0.25, bh: 0.2, mortar: 0.014, mortarColor: shadec(gxAvg(c[2]), 0.3), ...p }),
});
gxFam({
  key: 'ar', famName: (f) => (f[0] === 'rect' ? 'Ardoises' : 'Ardoises en écailles'), cat: 'toit', surf: 'toiture', use: ['toit', 'mur'], rough: 0.7, g: 'f', pl: true,
  colors: [['bleue', 'bleu-gris', [[66, 72, 80], [56, 60, 68], [74, 78, 86], [50, 54, 60]]], ['noire', 'noir', [[40, 40, 44], [34, 34, 38], [48, 48, 52]]], ['grise', 'gris', [[96, 98, 100], [86, 88, 90], [108, 110, 112]]],
    ['verte', 'vert', [[64, 84, 76], [56, 74, 68], [74, 94, 84]]], ['violette', 'violet', [[78, 66, 84], [68, 58, 74], [88, 76, 94]]]],
  tint: (c) => gxAvg(c[2]), formats: [['rect', ''], ['ecaille', 'en écailles']],
  nm: (c, f) => `Ardoises ${gxAcc(c[1], true, true)}${f[1] ? ` ${f[1]}` : ''}`,
  states: (f) => (f[0] === 'rect' ? ['n', 'u', 'm', 's'] : ['n', 'm']), patch: { n: { stains: 1 }, u: { stains: 6 }, m: { moss: 0.5, stains: 8 }, s: { stains: 12, drips: 10 } },
  gen: (c, f, p) => (f[0] === 'rect' ? tgBrick({ tile: 2, colors: c[2], bw: 0.3, bh: 0.15, mortar: 0.01, mortarColor: [22, 24, 28], ...p }) : gxShingles({ tile: 2, colors: c[2], tw: 0.22, th: 0.14, shape: 'rond', ...p })),
});
gxFam({
  key: 'bd', famName: (f) => (f[0] === 'carre' ? 'Bardeaux' : 'Bardeaux à pointe'), cat: 'toit', surf: 'toiture', use: ['toit', 'mur'], rough: 0.88, g: 'm', pl: true,
  colors: [['bois', 'en bois', [[150, 110, 70], [138, 100, 64], [162, 122, 80]]], ['boisgris', 'en bois grisé', [[130, 126, 118], [118, 114, 108], [142, 138, 128]]],
    ['bitnoir', 'bitumés noirs', [[46, 46, 48], [38, 38, 40], [56, 56, 58]]], ['bitgris', 'bitumés gris', [[96, 96, 98], [84, 84, 86], [108, 108, 110]]],
    ['rouge', 'rouges', [[128, 50, 40], [114, 44, 36], [140, 58, 46]]], ['vert', 'verts', [[60, 90, 64], [52, 80, 56], [70, 100, 72]]], ['bleu', 'bleus', [[60, 80, 110], [52, 70, 98], [70, 90, 120]]],
    ['brun', 'bruns', [[100, 70, 50], [88, 62, 44], [112, 80, 58]]], ['beige', 'beiges', [[176, 160, 130], [164, 148, 120], [188, 172, 140]]], ['ardoise', 'gris ardoise', [[70, 76, 84], [62, 66, 74], [80, 84, 92]]]],
  tint: (c) => gxAvg(c[2]), formats: [['carre', ''], ['pointe', 'à pointe']],
  nm: (c, f) => `Bardeaux ${c[1]}${f[1] ? ` ${f[1]}` : ''}`,
  states: (f) => (f[0] === 'carre' ? ['n', 'u', 'm'] : ['n', 'm']), patch: { n: { stains: 1 }, u: { stains: 8, soot: 0.3 }, m: { moss: 0.7, stains: 8 } },
  gen: (c, f, p) => gxShingles({ tile: 2, colors: c[2], tw: 0.24, th: 0.17, shape: f[0], ...p }),
});
gxFam({
  key: 'ch', famName: 'Chaume', cat: 'toit', surf: 'toiture', use: ['toit'], rough: 1, g: 'm',
  colors: [['blond', 'blond', [196, 166, 100]], ['dore', 'doré', [180, 140, 70]], ['gris', 'gris', [150, 140, 120]], ['brun', 'brun', [130, 100, 64]]],
  nm: (c) => `Chaume ${gxAcc(c[1], false, false)}`, states: ['n', 'm', 's'], patch: { n: {}, m: { moss: 0.7 }, s: { stains: 10, soot: 0.4 } },
  gen: (c, f, p) => gxThatch({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'bk', famName: 'Bac acier', cat: 'toit', surf: 'metal', use: ['toit', 'mur'], rough: 0.55, metal: 0.35, g: 'm',
  colors: GX_METAL.filter((c) => !['creme', 'kaki', 'orange', 'jaune'].includes(c[0])),
  nm: (c) => `Bac acier ${gxAcc(c[1], false, false)}`, states: ['n', 'u', 'r'], patch: { n: {}, u: { rust: 0.15, soot: 0.2 }, r: { rust: 0.6 } },
  gen: (c, f, p) => gxTrapez({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'bi', famName: 'Membranes bitumées', cat: 'toit', surf: 'toiture', use: ['toit'], rough: 0.85, g: 'f',
  colors: [['noir', 'noir', [46, 44, 42]], ['gris', 'gris', [86, 86, 84]], ['brun', 'brun', [76, 60, 46]], ['vert', 'vert ardoisé', [60, 74, 66]]],
  nm: (c) => `Membrane bitumée ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 'm'], patch: { n: { stains: 2 }, u: { stains: 10 }, m: { moss: 0.4, stains: 10 } },
  gen: (c, f, p) => tgPlanks({ tile: 2, color: c[2], width: 0.9, ...p }),
});

/* ================================================================= carrelage */
gxFam({
  key: 'ca', famName: (f) => ({ 10: 'Carrelage 10 × 10', 20: 'Carrelage 20 × 20', 30: 'Carrelage 30 × 30', 60: 'Carrelage 60 × 60', metro: 'Carrelage métro', mosa: 'Mosaïques' })[f[0]],
  cat: 'carrelage', surf: 'carrelage', use: (f) => (f[0] === '60' || f[0] === '30' ? ['sol', 'mur'] : ['mur', 'sol']), rough: 0.45,
  colors: GX_TILE,
  formats: [['10', '10 × 10', { size: 0.1 }], ['20', '20 × 20', { size: 0.2 }], ['30', '30 × 30', { size: 0.3, grout: 0.005 }], ['60', '60 × 60', { size: 0.6, grout: 0.004 }],
    ['metro', 'métro', { tw: 0.15, th: 0.075, offset: 0.5 }], ['mosa', '', { size: 1 / 30, grout: 0.003, var: 0.14 }]],
  nm: (c, f) => (f[0] === 'mosa' ? `Mosaïque ${gxAcc(c[1], true, false)}` : `Carrelage ${f[1]} ${gxAcc(c[1], false, false)}`),
  gp: (f) => (f[0] === 'mosa' ? ['f', false] : ['m', false]),
  states: ['n', 's', 'f', 'c', 'g'],
  patch: { n: { dirt: 0.1, stains: 1 }, s: { dirt: 0.6, stains: 10 }, f: { cracked: 0.25, stains: 4 }, c: { cracked: 0.35, missing: 0.1, stains: 6 }, g: { blood: 1.4 } },
  gen: (c, f, p) => tgTiles({ tile: 2, color: c[2], groutColor: gxGrout(c[2]), ...f[2], ...p }),
});
gxFam({
  key: 'dm', famName: 'Damiers', cat: 'carrelage', surf: 'carrelage', use: ['sol'], rough: 0.45, g: 'm',
  colors: [['noirblanc', 'noir et blanc', [214, 212, 204], [30, 30, 32]], ['rougeblanc', 'rouge et blanc', [210, 206, 196], [150, 40, 34]], ['bleublanc', 'bleu et blanc', [214, 214, 208], [50, 80, 140]],
    ['vertblanc', 'vert et blanc', [214, 214, 208], [50, 110, 70]], ['noirjaune', 'noir et jaune', [220, 190, 60], [30, 30, 32]], ['grisblanc', 'gris et blanc', [214, 214, 208], [120, 120, 118]],
    ['bordeauxcreme', 'bordeaux et crème', [222, 210, 180], [100, 34, 40]], ['terrecreme', 'terre cuite et crème', [222, 210, 180], [168, 86, 56]], ['nuitgris', 'bleu nuit et gris', [170, 170, 168], [36, 50, 90]],
    ['sapincreme', 'vert sapin et crème', [222, 210, 180], [40, 76, 54]], ['noirrouge', 'noir et rouge', [160, 36, 32], [30, 30, 32]], ['anthragris', 'anthracite et gris clair', [180, 180, 176], [64, 66, 68]]]
    .map(([k, n, a, b]) => [k, n, gxMix(a, b, 0.5), a, b]),
  hue: () => 'multi', nm: (c) => `Damier ${c[1]}`,
  states: ['n', 's', 'f', 'g'], patch: { n: { dirt: 0.1, stains: 1 }, s: { dirt: 0.6, stains: 10 }, f: { cracked: 0.3, stains: 4 }, g: { blood: 1.4 } },
  gen: (c, f, p) => tgTiles({ tile: 2, color: c[3], checker: c[4], size: 0.3, grout: 0.003, ...p }),
});
gxFam({
  key: 'hx', famName: 'Carreaux hexagonaux', cat: 'carrelage', surf: 'carrelage', use: ['sol', 'mur'], rough: 0.45, g: 'm', pl: true, size: [1.2, 1.2 * gxHexAspect(8)],
  colors: [['blanc', 'blancs', [216, 216, 210], [[216, 216, 210]]], ['noir', 'noirs', [34, 34, 36], [[34, 34, 36]]], ['noirblanc', 'noirs et blancs', [120, 120, 120], [[216, 216, 210], [34, 34, 36]]],
    ['terre', 'en terre cuite', [160, 80, 52], [[160, 78, 50], [148, 70, 44], [172, 90, 60]]], ['gris', 'gris', [130, 130, 128], [[130, 130, 128], [120, 120, 118]]],
    ['vert', 'verts', [70, 130, 90], [[70, 130, 90], [80, 140, 100]]], ['bleu', 'bleus', [70, 110, 160], [[70, 110, 160], [80, 124, 176]]],
    ['fleur', 'à fleurs noires', [190, 190, 186], [[216, 216, 210]], { flower: 1, flowerColor: [34, 34, 36] }], ['rosace', 'à rosaces bleues', [190, 196, 204], [[216, 216, 210]], { flower: 2, flowerColor: [50, 80, 140] }],
    ['ocre', 'ocre', [190, 150, 90], [[190, 150, 90], [176, 138, 80]]]],
  nm: (c) => `Hexagones ${c[1]}`, states: ['n', 's', 'c'], patch: { n: { stains: 1 }, s: { stains: 10, water: 1 }, c: { missing: 0.08, stains: 6 } },
  gen: (c, f, p) => gxHex({ n: 8, colors: c[3], groutColor: gxGrout(c[2]), ...(c[4] || {}), ...p }),
});
gxFam({
  key: 'cb', famName: 'Carrelages à cabochons', cat: 'carrelage', surf: 'carrelage', use: ['sol'], rough: 0.5, g: 'm', size: [1, 1],
  colors: [['blancnoir', 'blanc et noir', [200, 200, 196], [218, 216, 208], [30, 30, 32]], ['cremebleu', 'crème et bleu', [210, 206, 190], [222, 210, 180], [50, 80, 140]],
    ['blancrouge', 'blanc et rouge', [206, 196, 188], [218, 216, 208], [150, 40, 34]], ['terrenoir', 'terre cuite et noir', [150, 76, 52], [168, 86, 56], [30, 30, 32]],
    ['grisnoir', 'gris et noir', [130, 130, 128], [150, 150, 148], [30, 30, 32]], ['blancvert', 'blanc et vert', [200, 206, 198], [218, 216, 208], [50, 110, 70]],
    ['ocrebrun', 'ocre et brun', [180, 140, 90], [196, 156, 100], [80, 56, 40]], ['marbre', 'blanc et gris', [208, 208, 206], [222, 220, 214], [110, 110, 112]]],
  hue: () => 'multi', nm: (c) => `Carrelage à cabochons ${c[1]}`,
  states: ['n', 's', 'f'], patch: { n: { stains: 1 }, s: { stains: 10, water: 1 }, f: { cracks: 10, stains: 4 } },
  gen: (c, f, p) => gxCabochon({ tile: 1, size: 0.2, c1: c[3], c2: c[4], ...p }),
});
gxFam({
  key: 'cc', famName: 'Carreaux de ciment', cat: 'carrelage', surf: 'carrelage', use: ['sol', 'mur'], rough: 0.6, g: 'm', pl: true, size: [1, 1],
  colors: [['bleu', 'bleu et blanc', [140, 150, 170], [[220, 214, 200], [50, 80, 130], [160, 60, 50]]], ['rouge', 'rouge et crème', [190, 140, 120], [[214, 200, 176], [150, 50, 40], [40, 40, 40]]],
    ['vert', 'vert et ocre', [150, 160, 120], [[214, 206, 186], [50, 100, 70], [190, 150, 60]]], ['noir', 'noir et blanc', [130, 130, 128], [[220, 218, 210], [34, 34, 36], [140, 140, 140]]],
    ['ocre', 'ocre et brun', [170, 130, 90], [[200, 170, 120], [120, 60, 40], [230, 220, 196]]], ['gris', 'gris et blanc', [170, 172, 174], [[150, 150, 148], [226, 224, 218], [60, 90, 110]]]],
  formats: [['etoile', 'à étoiles'], ['rosace', 'à rosaces'], ['fleur', 'à fleurs'], ['losanges', 'à losanges'], ['cercles', 'à cercles'], ['croix', 'à croix']],
  hue: () => 'multi', nm: (c, f) => `Carreaux de ciment ${f[1]} (${c[1]})`, states: ['n', 'u'], patch: { n: { stains: 2 }, u: { stains: 10, cracks: 6 } },
  gen: (c, f, p) => gxCementTile({ tile: 1, size: 0.2, colors: c[3], motif: f[0], ...p }),
});
gxFam({
  key: 'mx', famName: 'Mosaïques mélangées', cat: 'carrelage', surf: 'carrelage', use: ['mur', 'sol'], rough: 0.4, g: 'f',
  colors: [['bleu', 'bleue', [100, 150, 190], [[90, 140, 190], [120, 170, 210], [60, 110, 160], [200, 210, 220]]], ['vert', 'verte', [90, 150, 110], [[80, 140, 100], [110, 170, 120], [50, 110, 80], [190, 210, 190]]],
    ['ocre', 'ocre', [190, 150, 90], [[200, 160, 90], [180, 130, 70], [220, 190, 130], [150, 100, 60]]], ['gris', 'grise', [150, 150, 150], [[180, 180, 178], [140, 140, 140], [100, 100, 102], [210, 210, 206]]],
    ['noir', 'noire et dorée', [80, 70, 50], [[30, 30, 32], [50, 48, 46], [190, 150, 70], [30, 30, 32]]], ['rose', 'rose', [210, 160, 160], [[220, 170, 170], [200, 140, 150], [230, 200, 196], [180, 110, 120]]],
    ['turquoise', 'turquoise', [70, 160, 160], [[60, 160, 160], [90, 190, 186], [40, 120, 130], [200, 226, 220]]], ['rouge', 'rouge', [170, 60, 50], [[170, 50, 40], [190, 80, 60], [140, 40, 34], [220, 200, 190]]],
    ['piscine', 'de piscine', [90, 160, 200], [[80, 160, 210], [60, 140, 190], [110, 190, 220], [230, 236, 240]]], ['arc', 'arc-en-ciel', [150, 150, 150], [[200, 60, 50], [230, 170, 40], [70, 150, 80], [60, 110, 180], [140, 80, 160]]]],
  hue: (c) => (c[0] === 'arc' ? 'multi' : null), nm: (c) => `Mosaïque ${c[1]}`, states: ['n', 's'], patch: { n: { stains: 1 }, s: { dirt: 0.55, stains: 10 } },
  gen: (c, f, p) => tgTiles({ tile: 2, colors: c[3], size: 1 / 30, grout: 0.003, groutColor: [140, 138, 132], var: 0.1, ...p }),
});
gxFam({
  key: 'tz', famName: 'Terrazzo', cat: 'sol', surf: 'souple', use: ['sol'], rough: 0.35, g: 'm',
  colors: [['blanc', 'blanc', [214, 210, 200], [[60, 60, 60], [150, 140, 130], [190, 120, 90], [120, 120, 120]]], ['gris', 'gris', [150, 148, 144], [[40, 40, 40], [220, 216, 210], [110, 100, 90]]],
    ['noir', 'noir', [50, 50, 52], [[220, 220, 216], [150, 150, 146], [190, 160, 100]]], ['rose', 'rose', [214, 180, 170], [[160, 60, 60], [240, 230, 220], [120, 100, 90]]],
    ['vert', 'vert', [130, 160, 140], [[40, 80, 60], [220, 220, 210], [180, 150, 100]]], ['ocre', 'ocre', [204, 170, 120], [[120, 70, 40], [230, 220, 200], [80, 70, 60]]],
    ['bleu', 'bleu', [150, 170, 190], [[40, 60, 100], [220, 220, 216], [180, 120, 90]]], ['beige', 'beige', [200, 186, 160], [[110, 80, 60], [60, 56, 52], [230, 220, 200]]],
    ['rouge', 'rouge', [160, 70, 60], [[230, 220, 210], [60, 30, 30], [200, 160, 100]]], ['creme', 'crème', [226, 214, 186], [[160, 120, 80], [90, 90, 90], [200, 80, 60]]],
    ['anthracite', 'anthracite', [70, 70, 72], [[200, 200, 196], [140, 110, 80], [100, 120, 140]]], ['venitien', 'vénitien', [200, 180, 160], [[150, 40, 40], [40, 90, 60], [220, 200, 160], [40, 40, 40]]]],
  nm: (c) => `Terrazzo ${gxAcc(c[1], false, false)}`, states: ['n', 's'], patch: { n: { stains: 1 }, s: { stains: 10, cracks: 3 } },
  gen: (c, f, p) => gxTerrazzo({ base: c[2], colors: c[3], chips: 2600, size: 5, ...p }),
});
gxFam({
  key: 'pi', famName: 'Fonds de piscine', cat: 'carrelage', surf: 'carrelage', use: ['sol', 'mur'], rough: 0.3, g: 'm',
  colors: [['bleu', 'bleu', [70, 140, 190]], ['turquoise', 'turquoise', [60, 170, 170]], ['blanc', 'blanc', [200, 214, 220]], ['croupi', 'croupi', [70, 110, 80]]],
  nm: (c) => `Fond de piscine ${gxAcc(c[1], false, false)}`, states: ['n'],
  gen: (c) => gxCaustics(tgTiles({ tile: 2, color: c[2], size: 0.2, groutColor: gxMix(c[2], [255, 255, 255], 0.3), stains: c[0] === 'croupi' ? 10 : 1, dirt: c[0] === 'croupi' ? 0.6 : 0.1 }), { light: c[0] === 'croupi' ? [150, 190, 120] : [210, 245, 255] }),
});

/* ====================================================================== bois */
const gxWoodPatch = (c) => ({
  n: { stains: 1, wear: 0 }, u: { wear: 0.5, stains: 4 }, s: { stains: 14 }, p: { moss: 0.5, stains: 12, color: shadec(c[2], 0.72), colors: null }, g: { blood: 1.2 },
  b: { soot: 1, color: shadec(c[2], 0.55), colors: null }, d: { wear: 0.6, stains: 6, color: gxMix(c[2], [156, 150, 140], 0.55), colors: null }, m: { moss: 0.8, stains: 8 },
});
const gxPlankFam = (key, famName, nm, gp, use, base, states) => gxFam({
  key, famName, cat: 'bois', surf: 'bois', use, rough: 0.8, colors: GX_WOOD, nm, gp, states,
  gen: (c, f, p, st) => { const P = gxWoodPatch(c)[st] || {}; const o = { tile: 2, colors: gxWoodPal(c[2]), ...base, ...P }; if (o.colors === null) delete o.colors; if (!o.colors) o.color = P.color || c[2]; return tgPlanks(o); },
  tint: (c) => c[2],
});
gxPlankFam('pq', 'Parquets', (c) => `Parquet en ${c[1]}`, () => ['m', false], ['sol'], { width: 0.12, len: 1.2 }, ['n', 'u', 's', 'g', 'b']);
gxPlankFam('pl', 'Planchers', (c) => `Plancher en ${c[1]}`, () => ['m', false], ['sol', 'mur'], { width: 0.2, nails: true }, ['n', 'u', 's', 'p', 'g', 'b']);
gxPlankFam('lb', 'Lambris', (c) => `Lambris en ${c[1]}`, () => ['m', false], ['mur', 'plafond'], { width: 0.1, vertical: true }, ['n', 'u', 's', 'b']);
gxPlankFam('ba', 'Bardages', (c) => `Bardage en ${c[1]}`, () => ['m', false], ['mur', 'ext'], { width: 0.2, vertical: true, nails: true }, ['n', 'u', 'd', 'p', 'm']);
gxFam({
  key: 'bp', famName: (f) => (f[0] === 'h' ? 'Planches peintes' : 'Bardages peints'), cat: 'bois', surf: 'bois', use: ['mur', 'sol'], rough: 0.85,
  colors: gxPaints('blanc', 'creme', 'jaune', 'ocre', 'brique', 'rouge', 'bordeaux', 'ciel', 'marine', 'bleugris', 'eau', 'sapin', 'olive', 'gris', 'noir', 'turquoise'),
  formats: [['h', 'Planches peintes', { width: 0.15 }], ['v', 'Bardage peint', { width: 0.2, vertical: true, nails: true }]],
  nm: (c, f) => (f[0] === 'h' ? `Planches peintes ${gxAcc(c[1], true, true)}` : `Bardage peint ${gxAcc(c[1], false, false)}`), gp: (f) => (f[0] === 'h' ? ['f', true] : ['m', false]),
  states: ['e', 'ev'], patch: { e: { peel: 0.3 }, ev: { peel: 0.52, stains: 8 } },
  gen: (c, f, p) => tgPlanks({ tile: 2, color: [128, 98, 66], paint: c[2], ...f[2], ...p }),
});
const GX_WOOD10 = GX_WOOD.filter((c) => ['chene', 'chenecl', 'chenefo', 'noyer', 'acajou', 'merisier', 'pin', 'erable', 'teck', 'wenge'].includes(c[0]));
gxFam({
  key: 'hb', famName: 'Bâtons rompus', cat: 'bois', surf: 'bois', use: ['sol'], rough: 0.6, g: 'm', pl: true, colors: GX_WOOD10,
  nm: (c) => `Bâtons rompus en ${c[1]}`, states: ['n', 'u'], patch: { n: { stains: 1 }, u: { stains: 8, water: 1 } },
  gen: (c, f, p) => gxHerring({ n: 5, k: 4, colors: gxWoodPal(c[2]), ...p }),
});
gxFam({
  key: 'hg', famName: 'Point de Hongrie', cat: 'bois', surf: 'bois', use: ['sol'], rough: 0.6, g: 'm', colors: GX_WOOD10,
  nm: (c) => `Point de Hongrie en ${c[1]}`, states: ['n', 'u'], patch: { n: { stains: 1 }, u: { stains: 8, water: 1 } },
  gen: (c, f, p) => gxChevron({ cols: 4, rows: 16, colors: gxWoodPal(c[2]), ...p }),
});
gxFam({
  key: 'pan', famName: 'Panneaux de bois (OSB, contreplaqué)', cat: 'bois', surf: 'bois', use: ['mur', 'sol'], rough: 0.85, g: 'm',
  colors: [['osb', 'OSB', [196, 162, 108], 'osb', {}], ['osbsale', 'OSB sale', [170, 140, 96], 'osb', { stains: 14, water: 1 }], ['osbpeint', 'OSB peint en blanc', [210, 206, 196], 'osb', { paint: [214, 210, 198], peel: 0.35 }],
    ['cp', 'contreplaqué', [198, 160, 112], 'cp', { sheets: 2 }], ['cpsombre', 'contreplaqué sombre', [140, 104, 70], 'cp', { color: [140, 104, 70], sheets: 2 }],
    ['cpgris', 'contreplaqué peint en gris', [150, 150, 146], 'cp', { sheets: 2, paint: [150, 150, 146], peel: 0.4 }], ['cpmouille', 'contreplaqué gondolé', [170, 136, 96], 'cp', { color: [170, 136, 96], sheets: 2, stains: 14, water: 1, drips: 10 }]],
  nm: (c) => `Panneau ${c[1]}`, states: ['n'],
  gen: (c) => (c[3] === 'osb' ? gxOSB({ ...c[4] }) : gxPlywood({ ...c[4] })),
});
gxFam({
  key: 'rd', famName: 'Rondins', cat: 'bois', surf: 'bois', use: ['mur'], rough: 0.9, g: 'm', pl: true,
  colors: GX_WOOD.filter((c) => ['chene', 'pin', 'sapin', 'noyer', 'grise', 'flotte'].includes(c[0])),
  nm: (c) => `Rondins de ${c[1]}`, states: ['n', 'm', 'b'], patch: { n: {}, m: { moss: 0.7 }, b: { soot: 1 } },
  gen: (c, f, p, st) => tgLogs({ tile: 2, color: st === 'b' ? shadec(c[2], 0.5) : c[2], ...p }),
});
gxFam({
  key: 'bu', famName: 'Tas de bûches', cat: 'bois', surf: 'bois', use: ['mur'], rough: 0.95, g: 'm',
  colors: [['chene', 'de chêne', [176, 136, 90], [70, 50, 34]], ['bouleau', 'de bouleau', [214, 190, 150], [200, 196, 186]], ['pin', 'de pin', [200, 166, 110], [96, 64, 40]], ['sombre', 'sombres', [120, 90, 60], [50, 36, 26]]],
  nm: (c) => `Tas de bûches ${c[1]}`, states: ['n'], gen: (c) => gxWoodpile({ tile: 2, color: c[2], bark: c[3] }),
});
gxFam({
  key: 'er', famName: 'Écorces', cat: 'nature', surf: 'vegetal', use: ['mur', 'ext'], rough: 0.95, g: 'f',
  colors: [['chene', 'de chêne', [96, 80, 64]], ['pin', 'de pin', [110, 76, 56]], ['sombre', 'sombre', [60, 50, 42]], ['grise', 'grise', [120, 116, 108]],
    ['rousse', 'rousse', [130, 80, 50]], ['lichen', 'à lichen', [100, 96, 84], { lichen: true }], ['moussue', 'moussue', [90, 80, 60], { moss: 0.8 }], ['brulee', 'brûlée', [40, 34, 30], { soot: 1 }]],
  nm: (c) => `Écorce ${c[1]}`, states: ['n'], gen: (c) => gxBark({ color: c[2], ...(c[3] || {}) }),
});

/* ===================================================================== métal */
gxFam({
  key: 'tr', famName: 'Tôles rivetées', cat: 'metal', surf: 'metal', use: ['mur', 'sol'], rough: 0.5, metal: 0.4, g: 'f', colors: GX_METAL,
  nm: (c) => `Tôle rivetée ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 'r', 'rr', 'g'],
  patch: { n: {}, u: { rust: 0.15 }, r: { rust: 0.6 }, rr: { rust: 1 }, g: { blood: 1.2, rust: 0.2 } },
  gen: (c, f, p) => tgMetalPlates({ tile: 2, color: c[2], plate: 1, rivets: true, ...p }),
});
gxFam({
  key: 'tl', famName: 'Tôles lisses', cat: 'metal', surf: 'metal', use: ['mur', 'sol'], rough: 0.45, metal: 0.45, g: 'f', colors: GX_METAL,
  nm: (c) => `Tôle lisse ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 'r'], patch: { n: {}, u: { rust: 0.15, soot: 0.2 }, r: { rust: 0.65 } },
  gen: (c, f, p) => tgMetalPlates({ tile: 2, color: c[2], plate: 2, ...p }),
});
gxFam({
  key: 'tm', famName: 'Tôles larmées', cat: 'metal', surf: 'metal', use: ['sol'], rough: 0.45, metal: 0.55, g: 'f',
  colors: GX_METAL.filter((c) => ['acier', 'alu', 'galva', 'sombre', 'jaune', 'noir'].includes(c[0])),
  nm: (c) => `Tôle larmée ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 'r', 'g'], patch: { n: {}, u: { rust: 0.2, soot: 0.3 }, r: { rust: 0.8 }, g: { blood: 1.3 } },
  gen: (c, f, p) => tgDiamondPlate({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'to', famName: 'Tôles ondulées', cat: 'metal', surf: 'metal', use: ['mur', 'toit'], rough: 0.5, metal: 0.4, g: 'f', colors: GX_METAL,
  nm: (c) => `Tôle ondulée ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 'r', 'rr'], patch: { n: { seams: true }, u: { seams: true, rust: 0.2 }, r: { rust: 0.6 }, rr: { rust: 1 } },
  gen: (c, f, p) => tgCorrugated({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'cg', famName: 'Caillebotis', cat: 'metal', surf: 'metal', use: ['sol'], rough: 0.5, metal: 0.5, g: 'm',
  colors: GX_METAL.filter((c) => ['acier', 'galva', 'sombre', 'jaune', 'noir', 'rouge'].includes(c[0])),
  nm: (c) => `Caillebotis ${gxAcc(c[1], false, false)}`, states: ['n', 'r'], patch: { n: {}, r: { rust: 0.8 } },
  gen: (c, f, p) => tgGrating({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'pv', famName: 'Panneaux métalliques', cat: 'metal', surf: 'metal', use: ['mur'], rough: 0.5, metal: 0.25, g: 'm', pl: true, colors: GX_METAL,
  nm: (c) => `Panneaux métalliques ${gxAcc(c[1], false, true)}`, states: ['n', 'u', 's'], patch: { n: {}, u: { soot: 0.3 }, s: { water: 1, blood: 0.3 } },
  gen: (c, f, p) => tgPanels({ tile: 2, color: c[2], panel: 0.66, screws: true, ...p }),
});
const GX_SHINY = [['acier', 'acier brossé', [150, 154, 156]], ['inox', 'inox', [186, 188, 190]], ['alu', 'aluminium', [200, 202, 204]], ['laiton', 'laiton', [196, 164, 84]],
  ['cuivre', 'cuivre', [190, 112, 72]], ['bronze', 'bronze', [140, 100, 60]], ['or', 'or', [214, 172, 72]], ['titane', 'titane', [130, 132, 140]], ['noir', 'acier noirci', [52, 54, 56]], ['chrome', 'chrome', [214, 216, 220]]];
gxFam({
  key: 'mbr', famName: 'Métaux brossés', cat: 'metal', surf: 'metal', use: ['mur', 'sol'], rough: (f, c) => (c[0] === 'chrome' ? 0.18 : 0.32), metal: 0.85, g: 'm', colors: GX_SHINY,
  nm: (c) => `Métal brossé (${c[1]})`, states: ['n', 'ry'], patch: { n: {}, ry: { scratches: 140, stains: 4 } },
  gen: (c, f, p) => gxBrushed({ color: c[2], ...p }),
});
gxFam({
  key: 'cu', famName: 'Cuivre, laiton, bronze', cat: 'metal', surf: 'metal', use: ['mur', 'toit'], rough: 0.4, metal: 0.8, g: 'm',
  colors: GX_SHINY.filter((c) => ['cuivre', 'laiton', 'bronze'].includes(c[0])),
  nm: (c) => `Plaques de ${c[1]}`, gp: () => ['f', true], states: ['n', 'z'], patch: { n: { plates: 2 }, z: { plates: 2, patina: 0.85 } },
  gen: (c, f, p) => gxBrushed({ color: c[2], ...p }),
});
gxFam({
  key: 'tp', famName: (f) => (f[0] === 'ronds' ? 'Tôles perforées' : 'Tôles perforées carrées'), cat: 'metal', surf: 'metal', use: ['mur', 'sol', 'plafond'], rough: 0.45, metal: 0.5, g: 'f',
  colors: GX_METAL.filter((c) => ['acier', 'alu', 'sombre', 'noir', 'blanc', 'jaune'].includes(c[0])),
  formats: [['ronds', 'à trous ronds', {}], ['carres', 'à trous carrés', { square: true, stagger: false, hole: 0.3 }]],
  nm: (c, f) => `Tôle perforée ${gxAcc(c[1], true, false)} ${f[1]}`, states: ['n'],
  gen: (c, f) => gxPerforated({ tile: 1, color: c[2], ...f[2] }), size: [1, 1],
});
gxFam({
  key: 'gr', famName: 'Grilles d’aération', cat: 'metal', surf: 'metal', use: ['mur', 'plafond'], rough: 0.5, metal: 0.45, g: 'f',
  colors: GX_METAL.filter((c) => ['acier', 'galva', 'sombre', 'noir', 'blanc', 'creme', 'militaire', 'bleu'].includes(c[0])),
  nm: (c) => `Grille d’aération ${gxAcc(c[1], true, false)}`, states: ['n', 'r'], patch: { n: {}, r: { rust: 0.7 } },
  gen: (c, f, p) => gxLouvre({ tile: 1, color: c[2], frame: 0.5, ...p }), size: [1, 1],
});
gxFam({
  key: 'ru', famName: 'Rouilles', cat: 'metal', surf: 'metal', use: ['mur', 'sol'], rough: 0.85, metal: 0.25, g: 'f',
  colors: [['rousse', 'rousse', [110, 56, 28]], ['brune', 'brune', [80, 46, 26]], ['orange', 'orangée', [140, 70, 30]], ['noire', 'noirâtre', [56, 36, 26]], ['ecaillee', 'écaillée', [96, 52, 28]], ['peinte', 'sous peinture verte', [96, 52, 28], { paintRest: [70, 92, 72] }]],
  nm: (c) => `Rouille ${c[1]}`, states: ['n'],
  gen: (c) => (c[3] ? (g, w, h, R) => { tgRustHeavy({ color: c[2] })(g, w, h, R); paintOver(g, w, h, R, c[3].paintRest, 0.55); } : tgRustHeavy({ color: c[2] })),
});
gxFam({
  key: 'dg', famName: 'Bandes de danger', cat: 'metal', surf: 'metal', use: ['mur', 'sol'], rough: 0.7, g: 'f', pl: true,
  colors: [['jaunenoir', 'jaunes et noires', [200, 160, 30], [26, 26, 24]], ['rougeblanc', 'rouges et blanches', [176, 36, 30], [214, 212, 204]], ['noirblanc', 'noires et blanches', [30, 30, 30], [214, 212, 204]],
    ['orangenoir', 'orange et noires', [210, 110, 30], [26, 26, 24]], ['bleublanc', 'bleues et blanches', [40, 80, 150], [214, 212, 204]], ['vertblanc', 'vertes et blanches', [40, 130, 70], [214, 212, 204]],
    ['jaunegris', 'jaunes et grises', [200, 160, 30], [100, 100, 98]], ['rougenoir', 'rouges et noires', [176, 36, 30], [26, 26, 24]]],
  tint: (c) => gxMix(c[2], c[3], 0.4), hue: () => 'multi', nm: (c) => `Bandes ${c[1]}`, states: ['n', 'u'], patch: { n: {}, u: { soot: 0.5, water: 1 } },
  gen: (c, f, p) => tgHazard({ c1: c[2], c2: c[3], ...p }),
});
gxFam({
  key: 'ty', famName: 'Tuyauteries', cat: 'metal', surf: 'metal', use: ['mur'], rough: 0.55, metal: 0.4, g: 'f',
  colors: [['couleurs', 'en couleurs', [140, 100, 70], [[150, 40, 32], [200, 160, 40], [60, 100, 60], [60, 80, 120]]], ['grises', 'grises', [120, 122, 124], [[120, 122, 124], [96, 100, 104], [150, 152, 154]]],
    ['cuivre', 'en cuivre', [180, 110, 70], [[190, 112, 72], [170, 100, 64]]], ['vertes', 'vertes', [70, 100, 70], [[60, 100, 60], [70, 110, 74]]], ['rouges', 'rouges', [150, 40, 32], [[150, 40, 32], [130, 34, 28]]],
    ['noires', 'noires', [40, 40, 42], [[40, 40, 42], [56, 56, 58]]]],
  nm: (c) => `Tuyauterie ${c[1]}`, states: ['n', 'r'], patch: { n: {}, r: { rust: 0.7 } },
  gen: (c, f, p) => gxPipes({ tile: 2, colors: c[3], ...p }),
});
gxFam({
  key: 'gl', famName: 'Grillages', cat: 'metal', surf: 'metal', use: ['mur', 'ext'], rough: 0.6, metal: 0.4, g: 'm',
  colors: [['beton', 'sur béton', [120, 118, 112], (g, w, h, R) => tgConcrete({ base: [128, 124, 116] })(g, w, h, R)], ['terre', 'sur terre', [90, 74, 56], (g, w, h, R) => tgGround({ c1: [74, 58, 40], c2: [96, 76, 52], pebbles: 120 })(g, w, h, R)],
    ['herbe', 'sur herbe', [70, 90, 50], (g, w, h, R) => tgGround({ c1: [52, 70, 34], c2: [70, 90, 44], blades: 1400, bladeColor: [70, 96, 44] })(g, w, h, R)], ['noir', 'sur fond noir', [30, 30, 30], null],
    ['brique', 'sur briques', [130, 70, 50], (g, w, h, R) => tgBrick({ tile: 2, colors: GX_BRICK[0][2] })(g, w, h, R)], ['rouille', 'rouillé', [100, 70, 50], null, { rust: 0.8 }]],
  nm: (c) => `Grillage ${c[1]}`, states: ['n'],
  gen: (c) => gxChainLink({ tile: 2, under: c[3], bg: [24, 24, 24], mesh: 0.06, ...(c[4] || {}) }),
});

/* ====================================================== papiers peints, tissus */
const GX_WP = [
  ['creme', 'crème et brun', [214, 200, 160], [140, 100, 60]], ['vert', 'vert et doré', [80, 110, 80], [196, 170, 100]], ['rouge', 'rouge et or', [130, 36, 36], [200, 160, 80]],
  ['bleu', 'bleu et blanc', [70, 100, 140], [220, 220, 210]], ['rose', 'rose et vert', [216, 180, 176], [90, 130, 90]], ['jaune', 'jaune et gris', [220, 200, 130], [120, 120, 116]],
  ['gris', 'gris et noir', [170, 170, 166], [50, 50, 52]], ['beige', 'beige et bordeaux', [206, 190, 160], [110, 40, 46]], ['turquoise', 'turquoise et crème', [70, 150, 150], [226, 214, 180]],
  ['violet', 'violet et lilas', [90, 60, 110], [180, 160, 200]],
];
gxFam({
  key: 'pw', famName: (f) => ({ stripes: 'Papiers peints rayés', damask: 'Papiers peints damassés', floral: 'Papiers peints fleuris', dots: 'Papiers peints à pois', chevron: 'Papiers peints à chevrons', squares: 'Papiers peints géométriques' })[f[0]], cat: 'papier', surf: 'tissu', use: ['mur'], rough: 0.95, g: 'm',
  colors: GX_WP.map(([k, n, bg, fg]) => [k, n, gxMix(bg, fg, 0.3), bg, fg]),
  formats: [['stripes', 'rayé', 0.25], ['damask', 'damassé', 0.3], ['floral', 'fleuri', 0.2], ['dots', 'à pois', 0.15], ['chevron', 'à chevrons', 0.3], ['squares', 'géométrique', 0.25]],
  nm: (c, f) => `Papier peint ${f[1]} ${c[1]}`, states: ['n', 'a', 'x', 'g'],
  patch: { n: { age: 0.15, drips: 0 }, a: { age: 1, water: 1, drips: 14 }, x: { torn: 8, age: 0.8 }, g: { blood: 1.4, age: 0.6 } },
  gen: (c, f, p) => tgWallpaper({ tile: 2, bg: c[3], fg: c[4], fg2: shadec(c[4], 0.6), pattern: f[0], scale: f[2], ...p }),
});
gxFam({
  key: 'cap', famName: 'Capitonnés', cat: 'papier', surf: 'tissu', use: ['mur'], rough: 1, g: 'm',
  colors: [['blanc', 'blanc', [206, 202, 190]], ['creme', 'crème', [222, 208, 170]], ['gris', 'gris', [140, 140, 138]], ['rouge', 'rouge velours', [120, 30, 34]], ['vert', 'vert', [50, 80, 60]],
    ['bleu', 'bleu', [50, 70, 110]], ['noir', 'cuir noir', [36, 34, 34]], ['marron', 'cuir marron', [96, 62, 40]]],
  nm: (c) => `Capitonné ${c[1]}`, states: ['n', 's', 'g'], patch: { n: {}, s: { water: 1 }, g: { blood: 1.2 } },
  gen: (c, f, p) => tgPadded({ tile: 2, color: c[2], ...p }),
});
const GX_FAB = [['blanc', 'blanc', [214, 212, 204]], ['ecru', 'écru', [210, 196, 164]], ['beige', 'beige', [186, 166, 130]], ['gris', 'gris', [130, 130, 128]], ['noir', 'noir', [40, 40, 42]],
  ['rouge', 'rouge', [150, 34, 34]], ['bordeaux', 'bordeaux', [100, 30, 40]], ['orange', 'orange', [200, 110, 40]], ['jaune', 'jaune', [210, 180, 60]], ['vert', 'vert', [60, 110, 64]],
  ['kaki', 'kaki', [120, 116, 80]], ['bleu', 'bleu', [50, 80, 140]], ['marine', 'bleu marine', [36, 48, 80]], ['ciel', 'bleu ciel', [140, 176, 210]], ['violet', 'violet', [100, 60, 120]], ['rose', 'rose', [210, 140, 160]]];
gxFam({
  key: 'ti', famName: (f) => (f[0] === 'toile' ? 'Toiles' : 'Sergés'), cat: 'papier', surf: 'tissu', use: ['mur', 'sol'], rough: 1, g: 'f', size: [0.5, 0.5], colors: GX_FAB,
  formats: [['toile', 'Toile', { twill: false, thread: 0.003 }], ['serge', 'Sergé', { twill: true, thread: 0.0028 }]],
  nm: (c, f) => (f[0] === 'toile' ? `Toile ${gxAcc(c[1], true, false)}` : `Sergé ${gxAcc(c[1], false, false)}`), gp: (f) => (f[0] === 'toile' ? ['f', false] : ['m', false]),
  states: ['n'], gen: (c, f) => gxWeave({ tile: 0.5, color: c[2], weft: shadec(c[2], 0.86), ...f[2] }),
});
const R_ = [150, 30, 34], G_ = [30, 80, 50], B_ = [30, 44, 90], K_ = [24, 24, 26], Y_ = [214, 180, 60], W_ = [222, 218, 206];
gxFam({
  key: 'ta', famName: 'Tartans', cat: 'papier', surf: 'tissu', use: ['mur', 'sol'], rough: 1, g: 'm', size: [0.6, 0.6],
  colors: [['rouge', 'rouge', R_, [[R_, 24], [K_, 6], [R_, 4], [K_, 2], [Y_, 2], [G_, 10]]], ['vert', 'vert', G_, [[G_, 24], [K_, 8], [B_, 12], [K_, 2], [Y_, 2]]],
    ['bleu', 'bleu', B_, [[B_, 22], [K_, 8], [G_, 12], [K_, 2], [W_, 2]]], ['noir', 'noir et blanc', K_, [[K_, 16], [W_, 16]]], ['jaune', 'jaune', Y_, [[Y_, 20], [K_, 4], [R_, 6], [K_, 2]]],
    ['gris', 'gris', [120, 120, 118], [[[120, 120, 118], 20], [K_, 6], [[180, 180, 176], 8], [R_, 2]]], ['brun', 'brun', [110, 76, 50], [[[110, 76, 50], 20], [K_, 6], [[180, 150, 100], 8], [G_, 4]]],
    ['bucheron', 'bûcheron', R_, [[R_, 16], [K_, 16]]]],
  hue: () => 'multi', nm: (c) => `Tartan ${gxAcc(c[1], false, false)}`, states: ['n'],
  gen: (c) => gxWeave({ tile: 0.6, sett: gxSett(c[3]), twill: true, thread: 0.0025 }),
});
gxFam({
  key: 'ju', famName: 'Toiles de jute', cat: 'papier', surf: 'tissu', use: ['mur', 'sol'], rough: 1, g: 'f', size: [1, 1],
  colors: [['naturel', 'naturelle', [176, 146, 100]], ['sombre', 'sombre', [120, 96, 64]], ['verte', 'verte', [100, 110, 70]]],
  nm: (c) => `Toile de jute ${c[1]}`, states: ['n', 's'], patch: { n: {}, s: { stains: 12, water: 1 } },
  gen: (c, f, p) => gxWeave({ tile: 1, color: c[2], weft: shadec(c[2], 0.82), thread: 0.008, ...p }),
});
gxFam({
  key: 'cr', famName: 'Cuirs', cat: 'papier', surf: 'tissu', use: ['mur', 'sol'], rough: 0.6, g: 'm', size: [1, 1],
  colors: [['noir', 'noir', [36, 34, 34]], ['marron', 'marron', [96, 62, 40]], ['fauve', 'fauve', [160, 104, 56]], ['rouge', 'rouge', [120, 30, 30]], ['vert', 'vert anglais', [36, 66, 46]],
    ['bleu', 'bleu nuit', [30, 40, 70]], ['blanc', 'blanc', [214, 208, 196]], ['cognac', 'cognac', [140, 70, 34]]],
  nm: (c) => `Cuir ${gxAcc(c[1], false, false)}`, states: ['n', 'u'], patch: { n: {}, u: { stains: 10, specks: 300 } },
  gen: (c, f, p) => gxFlags({ cells: 26, colors: [c[2]], var: 0.05, jw: 0.012, bevel: 0.25, joint: shadec(c[2], 0.55), noise: [[4, 4, 1], [16, 16, 0.5]], ...p }),
});
gxFam({
  key: 'ma', famName: 'Mousses acoustiques', cat: 'papier', surf: 'tissu', use: ['mur', 'plafond'], rough: 1, g: 'f', size: [1, 1],
  colors: [['anthracite', 'anthracite', [56, 58, 60]], ['noir', 'noire', [30, 30, 32]], ['bleu', 'bleue', [50, 70, 120]], ['rouge', 'rouge', [140, 36, 36]], ['brun', 'brune', [90, 66, 46]]],
  nm: (c) => `Mousse acoustique ${c[1]}`, states: ['n'], gen: (c) => gxFoam({ tile: 1, color: c[2], cell: 0.1 }),
});
gxFam({
  key: 'lg', famName: 'Liège', cat: 'papier', surf: 'tissu', use: ['mur', 'sol'], rough: 0.9, g: 'm', size: [1, 1],
  colors: [['naturel', 'naturel', [168, 120, 76]], ['sombre', 'sombre', [110, 74, 46]], ['dalles', 'en dalles', [176, 128, 84], { tiles: 3 }]],
  nm: (c) => `Liège ${c[1]}`, states: ['n'], gen: (c) => gxCork({ color: c[2], ...(c[3] || {}) }),
});
gxFam({
  key: 'ct', famName: 'Cartons', cat: 'papier', surf: 'tissu', use: ['mur', 'sol'], rough: 1, g: 'm',
  colors: [['brun', 'brun', [176, 138, 92]], ['clair', 'clair', [200, 170, 126]], ['humide', 'détrempé', [140, 106, 70], { water: 1, stains: 14 }]],
  nm: (c) => `Carton ${c[1]}`, states: ['n'], gen: (c) => gxCardboard({ color: c[2], seams: 2, ...(c[3] || {}) }),
});
gxFam({
  key: 'bc', famName: 'Bâches', cat: 'papier', surf: 'tissu', use: ['mur', 'sol', 'toit'], rough: 0.7, g: 'f',
  colors: [['bleu', 'bleue', [40, 90, 170]], ['vert', 'verte', [60, 110, 60]], ['orange', 'orange', [220, 110, 30]], ['marron', 'marron', [110, 76, 46]], ['grise', 'grise', [130, 132, 134]], ['kaki', 'kaki', [110, 110, 70]]],
  nm: (c) => `Bâche ${c[1]}`, states: ['n', 's'], patch: { n: { eyelets: true }, s: { eyelets: true, stains: 14, water: 1 } },
  gen: (c, f, p) => gxTarp({ color: c[2], ...p }),
});
gxFam({
  key: 'sb', famName: 'Sacs de sable', cat: 'papier', surf: 'tissu', use: ['mur'], rough: 1, g: 'm', pl: true,
  colors: [['kaki', 'kaki', [[150, 140, 100], [140, 130, 92], [160, 150, 108]]], ['sable', 'sable', [[190, 170, 130], [180, 160, 120], [200, 180, 140]]],
    ['olive', 'vert olive', [[100, 104, 66], [92, 96, 60], [110, 114, 72]]], ['blanc', 'blanc', [[200, 196, 184], [188, 184, 172], [210, 206, 194]]], ['jute', 'en jute', [[160, 130, 90], [150, 120, 84], [170, 140, 98]]]],
  tint: (c) => gxAvg(c[2]), nm: (c) => `Sacs de sable ${c[1]}`, states: ['n', 's'], patch: { n: {}, s: { stains: 14, blood: 0.5 } },
  gen: (c, f, p) => gxSandbags({ tile: 2, colors: c[2], ...p }),
});
gxFam({
  key: 'cm', famName: 'Camouflages', cat: 'papier', surf: 'tissu', use: ['mur', 'sol'], rough: 0.95, g: 'm',
  colors: [['foret', 'forêt', [70, 80, 50], [[86, 96, 60], [50, 66, 40], [104, 84, 56], [30, 30, 26]]], ['desert', 'désert', [190, 166, 120], [[200, 176, 130], [170, 140, 96], [140, 110, 76]]],
    ['urbain', 'urbain', [130, 130, 130], [[150, 150, 148], [100, 100, 100], [60, 60, 62], [190, 190, 186]]], ['neige', 'neige', [210, 214, 216], [[226, 228, 230], [170, 174, 178], [110, 114, 118]]],
    ['numforet', 'numérique forêt', [80, 90, 60], [[96, 106, 70], [60, 76, 46], [120, 100, 70], [40, 40, 36]], 48], ['numdesert', 'numérique désert', [190, 170, 130], [[204, 184, 140], [170, 150, 110], [130, 110, 80]], 48],
    ['numurbain', 'numérique urbain', [120, 124, 130], [[140, 144, 150], [100, 104, 110], [70, 72, 78], [180, 184, 188]], 48], ['nuit', 'nuit', [40, 46, 60], [[50, 56, 74], [30, 36, 50], [70, 80, 100]]]],
  hue: () => 'multi', nm: (c) => `Camouflage ${c[1]}`, states: ['n'], gen: (c) => gxCamo({ colors: c[3], digital: c[4] || 0 }),
});

/* ========================================================== sols intérieurs */
gxFam({
  key: 'mq', famName: 'Moquettes unies', cat: 'sol', surf: 'souple', use: ['sol'], rough: 1, g: 'f', colors: GX_FAB,
  nm: (c) => `Moquette ${gxAcc(c[1], true, false)}`, states: ['n', 'u', 's', 'b', 'g'],
  patch: { n: { stains: 1 }, u: { stains: 6 }, s: { stains: 16, water: 1 }, b: { soot: 1, stains: 8 }, g: { blood: 1.3 } },
  gen: (c, f, p) => tgCarpet({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'mqm', famName: 'Moquettes à motif', cat: 'sol', surf: 'souple', use: ['sol'], rough: 1, g: 'f',
  colors: [['rouge', 'rouge et or', [130, 40, 34], [200, 160, 70]], ['vert', 'verte et beige', [50, 80, 56], [190, 170, 130]], ['bleu', 'bleue et crème', [40, 54, 96], [220, 206, 170]],
    ['brun', 'brune et ocre', [90, 60, 40], [196, 150, 80]], ['violet', 'violette et rose', [80, 50, 96], [210, 150, 170]], ['gris', 'grise et noire', [120, 120, 118], [40, 40, 42]],
    ['bordeaux', 'bordeaux et vert', [100, 30, 40], [80, 120, 80]], ['casino', 'de casino', [60, 20, 40], [220, 180, 60]]],
  hue: () => 'multi', nm: (c) => `Moquette ${c[1]}`, states: ['n', 's'], patch: { n: { stains: 2 }, s: { stains: 16, water: 1 } },
  gen: (c, f, p) => tgCarpet({ tile: 2, color: c[2], pattern: true, fg: c[3], scale: 0.4, border: true, ...p }),
});
gxFam({
  key: 'ln', famName: 'Linos', cat: 'sol', surf: 'souple', use: ['sol'], rough: 0.5, g: 'm',
  colors: [['vertpale', 'vert pâle', [150, 170, 160], [136, 156, 146]], ['beigebrun', 'beige et brun', [180, 176, 160], [80, 64, 50]], ['cremerouge', 'crème et rouge', [200, 196, 180], [150, 60, 50]],
    ['gris', 'gris', [150, 150, 148], [136, 136, 134]], ['bleu', 'bleu', [120, 150, 180], [100, 130, 160]], ['jaune', 'jaune et gris', [210, 190, 110], [130, 130, 128]],
    ['noirblanc', 'noir et blanc', [210, 208, 200], [40, 40, 42]], ['rose', 'rose', [210, 170, 170], [190, 150, 150]], ['bleublanc', 'bleu et blanc', [210, 210, 206], [60, 90, 150]],
    ['brun', 'brun', [130, 100, 70], [116, 88, 62]], ['vert', 'vert et blanc', [210, 210, 204], [60, 110, 70]], ['ocre', 'ocre', [190, 150, 90], [176, 136, 80]]].map(([k, n, a, b]) => [k, n, gxMix(a, b, 0.5), a, b]),
  nm: (c) => `Lino ${c[1]}`, states: ['n', 'u', 's'], patch: { n: { stains: 1 }, u: { stains: 6, cracks: 3 }, s: { stains: 14, cracks: 4, water: 1 } },
  gen: (c, f, p) => tgChecker({ tile: 2, size: 0.3, c1: c[3], c2: c[4], ...p }),
});
gxFam({
  key: 'cs', famName: 'Caoutchouc à pastilles', cat: 'sol', surf: 'souple', use: ['sol'], rough: 0.85, g: 'm',
  colors: [['noir', 'noir', [44, 46, 48]], ['gris', 'gris', [100, 100, 102]], ['rouge', 'rouge', [130, 40, 34]], ['bleu', 'bleu', [40, 60, 110]], ['vert', 'vert', [40, 90, 56]],
    ['jaune', 'jaune', [200, 160, 40]], ['blanc', 'blanc', [200, 200, 196]], ['brun', 'brun', [90, 66, 46]]],
  nm: (c) => `Caoutchouc à pastilles ${gxAcc(c[1], false, false)}`, states: ['n', 'u'], patch: { n: {}, u: { water: 1 } },
  gen: (c, f, p) => tgRubber({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'ep', famName: 'Sols de granulés', cat: 'sol', surf: 'souple', use: ['sol', 'ext'], rough: 0.95, g: 'm',
  colors: [['noir', 'noir', [40, 40, 42], [[200, 60, 50], [60, 120, 200], [230, 190, 50]]], ['rouge', 'rouge', [150, 50, 40], [[40, 40, 40], [200, 80, 60]]], ['bleu', 'bleu', [50, 90, 160], [[230, 230, 226], [40, 40, 42]]],
    ['vert', 'vert', [60, 120, 70], [[230, 200, 60], [40, 40, 42]]], ['gris', 'gris', [110, 110, 112], [[60, 60, 62], [200, 200, 196]]], ['multi', 'multicolore', [100, 100, 100], [[200, 60, 50], [60, 140, 220], [240, 200, 50], [80, 180, 90]]]],
  nm: (c) => `Sol de granulés ${gxAcc(c[1], false, false)}`, states: ['n'], gen: (c) => gxFlecks({ base: c[2], colors: c[3] }),
});
gxFam({
  key: 'rs', famName: (f) => (f[0] === 'unie' ? 'Résines de sol' : 'Résines marquées'), cat: 'sol', surf: 'souple', use: ['sol'], rough: 0.3, g: 'f',
  colors: [['gris', 'grise', [130, 132, 134]], ['grisclair', 'gris clair', [176, 178, 178]], ['vert', 'verte', [70, 120, 90]], ['bleu', 'bleue', [60, 90, 130]], ['rouge', 'rouge', [140, 50, 40]],
    ['beige', 'beige', [200, 186, 156]], ['anthracite', 'anthracite', [60, 62, 64]], ['blanc', 'blanche', [214, 214, 210]], ['jaune', 'jaune', [210, 180, 70]], ['ocre', 'ocre', [190, 140, 80]]],
  formats: [['unie', '', {}], ['marquee', 'marquée', { lines: 2 }]],
  nm: (c, f) => `Résine ${c[1]}${f[1] ? ` ${f[1]}` : ''}`, states: ['n'],
  gen: (c, f) => gxEpoxy({ color: c[2], ...f[2] }),
});

/* ================================================================== plafonds */
gxFam({
  key: 'fp', famName: 'Faux plafonds', cat: 'plafond', surf: 'beton', use: ['plafond'], rough: 0.95, g: 'm', size: [2.4, 2.4],
  colors: [['blanc', 'blanc', [206, 204, 196]], ['creme', 'crème', [214, 204, 180]], ['gris', 'gris', [160, 160, 158]], ['jauni', 'jauni', [196, 184, 150]], ['noir', 'noir', [50, 50, 52]], ['bleu', 'bleuté', [180, 190, 200]]],
  nm: (c) => `Faux plafond ${gxAcc(c[1], false, false)}`, states: ['n', 't', 'o'], patch: { n: {}, t: { stain: true }, o: { stain: true, missing: 0.18 } },
  gen: (c, f, p) => tgCeilTiles({ tile: 2.4, color: c[2], size: 0.6, ...p }),
});
gxFam({
  key: 'pb', famName: 'Plafonds à poutres', cat: 'plafond', surf: 'bois', use: ['plafond'], rough: 0.85, g: 'm',
  colors: GX_WOOD.filter((c) => ['chene', 'chenefo', 'noyer', 'pin', 'sapin', 'grise', 'wenge', 'teck'].includes(c[0])),
  nm: (c) => `Plafond à poutres en ${c[1]}`, states: ['n'], gen: (c) => tgPlanks({ tile: 2, color: c[2], width: 0.33, gap: 0.95 }),
});
gxFam({
  key: 'pf', famName: 'Plafonds en plâtre', cat: 'plafond', surf: 'beton', use: ['plafond'], rough: 0.95, g: 'm',
  colors: [['blanc', 'blanc', [206, 202, 192]], ['creme', 'crème', [214, 202, 174]], ['gris', 'gris', [160, 158, 152]], ['jaune', 'jauni', [196, 180, 140]], ['bleu', 'bleu pâle', [180, 192, 200]], ['rose', 'rose pâle', [210, 186, 180]]],
  nm: (c) => `Plafond en plâtre ${gxAcc(c[1], false, false)}`, states: ['n', 't', 'f'], patch: { n: { stains: 1, cracks: 1 }, t: { stains: 10, water: 1 }, f: { cracks: 12, chips: 0.3, under: [120, 110, 98] } },
  gen: (c, f, p) => tgPlaster({ color: c[2], ...p }),
});
gxFam({
  key: 'ci', famName: 'Plafonds à caissons', cat: 'plafond', surf: 'bois', use: ['plafond'], rough: 0.85, g: 'm',
  colors: [['chene', 'en chêne', [150, 104, 62], true], ['sombre', 'en bois sombre', [80, 54, 36], true], ['blanc', 'en plâtre blanc', [210, 206, 196], false], ['creme', 'en plâtre crème', [220, 206, 170], false],
    ['beton', 'en béton', [140, 138, 132], false], ['dore', 'doré', [200, 160, 80], false]],
  nm: (c) => `Plafond à caissons ${c[1]}`, states: ['n'], gen: (c) => gxCoffer({ tile: 2, color: c[2], wood: c[3] }),
});

/* ================================================================ extérieur */
const GX_GROUND = [
  ['herbe', 'Herbe verte', 'f', 0, { c1: [52, 70, 34], c2: [70, 90, 44], blades: 1400, bladeColor: [70, 96, 44] }],
  ['herbehaute', 'Herbe haute', 'f', 0, { c1: [44, 62, 30], c2: [64, 86, 40], blades: 2600, bladeColor: [76, 104, 48] }],
  ['herbeseche', 'Herbe sèche', 'f', 0, { c1: [104, 92, 56], c2: [126, 112, 70], blades: 1200, bladeColor: [140, 124, 76] }],
  ['herbejaune', 'Herbe jaunie', 'f', 0, { c1: [120, 110, 60], c2: [140, 128, 72], blades: 1600, bladeColor: [160, 146, 80] }],
  ['gazon', 'Gazon', 'm', 0, { c1: [60, 92, 40], c2: [72, 106, 48], blades: 3000, bladeColor: [80, 116, 52] }],
  ['prairie', 'Prairie', 'f', 0, { c1: [56, 76, 36], c2: [80, 100, 46], blades: 1800, bladeColor: [96, 120, 56], pebbles: 30 }],
  ['mousse', 'Tapis de mousse', 'm', 0, { c1: [50, 70, 30], c2: [70, 96, 40], c3: [90, 110, 50] }],
  ['terre', 'Terre brune', 'f', 0, { c1: [74, 58, 40], c2: [96, 76, 52], pebbles: 120 }],
  ['terrerouge', 'Terre rouge', 'f', 0, { c1: [120, 60, 40], c2: [146, 78, 52], pebbles: 80 }],
  ['terrenoire', 'Terre noire', 'f', 0, { c1: [44, 36, 30], c2: [60, 50, 40], pebbles: 60 }],
  ['argile', 'Argile', 'f', 0, { c1: [150, 120, 90], c2: [170, 140, 104], pebbles: 30 }],
  ['boue', 'Boue', 'f', 0, { c1: [52, 42, 30], c2: [70, 56, 38], wet: true, pebbles: 40 }],
  ['sable', 'Sable fin', 'm', 0, { c1: [196, 172, 124], c2: [210, 186, 138], pebbles: 30 }],
  ['sablesombre', 'Sable sombre', 'm', 0, { c1: [120, 108, 90], c2: [140, 126, 104], pebbles: 60 }],
  ['gravier', 'Gravier clair', 'm', 0, { c1: [120, 116, 108], c2: [140, 136, 128], pebbles: 2600, pebbleSize: 3, pebbleColor: [170, 166, 158] }],
  ['graviersombre', 'Gravier sombre', 'm', 0, { c1: [60, 58, 56], c2: [76, 74, 70], pebbles: 2600, pebbleSize: 3, pebbleColor: [100, 98, 94] }],
  ['cailloux', 'Cailloux', 'm', 1, { c1: [90, 86, 80], c2: [110, 104, 96], pebbles: 700, pebbleSize: 8, pebbleColor: [150, 144, 136] }],
  ['sousbois', 'Sous-bois', 'm', 0, { c1: [58, 44, 30], c2: [80, 60, 36], c3: [60, 70, 34], pebbles: 200, pebbleSize: 5, pebbleColor: [110, 80, 40], blades: 300 }],
  ['aiguilles', 'Aiguilles de pin', 'f', 1, { c1: [90, 60, 36], c2: [110, 76, 44], blades: 2200, bladeColor: [130, 90, 50] }],
  ['cendres', 'Cendres', 'f', 1, { c1: [70, 68, 66], c2: [96, 94, 90], pebbles: 300, pebbleColor: [30, 28, 26] }],
];
gxFam({
  key: 'sn', famName: 'Sols naturels', cat: 'exterieur', surf: 'terre', use: ['ext', 'sol'], rough: 1, size: [4, 4],
  colors: GX_GROUND.map(([k, n, g, pl, o]) => [k, n, gxMix(o.c1, o.c2, 0.5), g, pl, o]),
  nm: (c) => c[1], gp: (f, c) => [c[3], !!c[4]],
  states: (f, c) => (c[0] === 'boue' ? ['n', 'gl', 'g'] : ['n', 'w', 'gl', 'g']), patch: { n: {}, w: { wet: true }, gl: { frost: 0.6 }, g: { blood: 1.2 } },
  gen: (c, f, p) => tgGround({ ...c[5], ...p }),
});
gxFam({
  key: 'ne', famName: 'Neiges', cat: 'exterieur', surf: 'terre', use: ['ext', 'sol', 'toit'], rough: 0.7, g: 'f', size: [4, 4],
  colors: [['fraiche', 'fraîche', [214, 222, 232]], ['pietinee', 'piétinée', [200, 208, 220], { tracks: true }], ['sale', 'sale', [170, 172, 170], { tracks: true, soot: 0.4, water: 1 }],
    ['sang', 'ensanglantée', [200, 200, 206], { tracks: true, blood: 1.4 }], ['fonte', 'fondante', [180, 184, 186], { water: 1 }], ['nuit', 'bleutée', [170, 186, 214]]],
  nm: (c) => `Neige ${c[1]}`, states: ['n'], gen: (c) => tgSnow({ ...(c[3] || {}) }),
});
gxFam({
  key: 'gc', famName: 'Glaces', cat: 'exterieur', surf: 'verre', use: ['sol', 'ext', 'mur'], rough: 0.15, g: 'f', size: [4, 4],
  colors: [['claire', 'claire', [190, 220, 232]], ['bleue', 'bleue', [140, 190, 220]], ['sale', 'sale', [150, 170, 176], { soot: 0.4 }], ['neige', 'enneigée', [200, 220, 232], { snow: true }]],
  nm: (c) => `Glace ${c[1]}`, states: ['n'], gen: (c) => gxIce({ color: c[2], ...(c[3] || {}) }),
});
gxFam({
  key: 'as', famName: 'Asphaltes et routes', cat: 'exterieur', surf: 'terre', use: ['sol', 'ext'], rough: 0.9, g: 'm', size: [4, 4],
  colors: [['noir', 'noir', [44, 44, 46]], ['gris', 'gris', [58, 58, 60]], ['clair', 'clair', [84, 84, 86]], ['brun', 'brun', [64, 58, 52]]],
  formats: [['uni', 'Asphalte', (c) => tgAsphalt({ tile: 4, color: c[2] })], ['fissure', 'Asphalte fissuré', (c) => tgAsphalt({ tile: 4, color: c[2], cracks: 14, patches: 3 })],
    ['ligne', 'Route à ligne blanche', (c) => tgAsphalt({ tile: 4, color: c[2], line: [220, 220, 210] })], ['tirets', 'Route à tirets blancs', (c) => tgAsphalt({ tile: 4, color: c[2], line: [220, 220, 210], dashed: true })],
    ['jaune', 'Route à ligne jaune', (c) => tgAsphalt({ tile: 4, color: c[2], line: [210, 170, 40] })], ['zebra', 'Passage piéton', (c) => gxRoadMark({ tile: 4, color: c[2], kind: 'zebra' })],
    ['parking', 'Places de parking', (c) => gxRoadMark({ tile: 4, color: c[2], kind: 'parking' })], ['stop', 'Ligne d’arrêt', (c) => gxRoadMark({ tile: 4, color: c[2], kind: 'stop' })]],
  nm: (c, f) => `${f[1]} (asphalte ${c[1]})`, states: ['n'], gen: (c, f) => f[2](c),
});
gxFam({
  key: 'pav', famName: 'Pavés', cat: 'exterieur', surf: 'pierre', use: ['sol', 'ext'], rough: 0.85, g: 'm', pl: true,
  colors: GX_STONE.filter((c) => !['tuffeau', 'meuliere'].includes(c[0])), tint: (c) => gxAvg(c[2]),
  nm: (c) => `Pavés (${c[1]})`, states: ['n', 'w', 'm', 'g'], patch: { n: {}, w: { wet: true }, m: { moss: 0.7 }, g: { blood: 1.3 } },
  gen: (c, f, p) => tgCobble({ tile: 2, colors: c[2], ...p }), rough: (f, c, st) => (st === 'w' ? 0.4 : 0.85),
});
gxFam({
  key: 'ph', famName: 'Pavés en chevrons', cat: 'exterieur', surf: 'brique', use: ['sol', 'ext'], rough: 0.85, g: 'm', pl: true,
  colors: [['rouge', 'rouges', [[138, 59, 42], [122, 52, 36], [154, 70, 48]]], ['gris', 'gris', [[120, 118, 112], [106, 104, 100], [134, 130, 124]]], ['ocre', 'ocre', [[184, 149, 90], [168, 134, 80]]],
    ['anthracite', 'anthracite', [[64, 64, 66], [56, 56, 58], [74, 72, 72]]], ['brun', 'bruns', [[110, 70, 48], [96, 60, 42]]], ['mixte', 'mélangés', [[138, 59, 42], [120, 118, 112], [184, 149, 90]]]],
  tint: (c) => gxAvg(c[2]), nm: (c) => `Pavés en chevrons ${c[1]}`, states: ['n', 'm'], patch: { n: { stains: 2 }, m: { moss: 0.7, stains: 6 } },
  gen: (c, f, p) => gxHerring({ n: 2, k: 8, colors: c[2], gap: 0.06, jointK: 0.35, shade: 0.3, grain: 0.15, dark: [30, 26, 20], ...p }),
});
gxFam({
  key: 'dj', famName: 'Dalles de jardin', cat: 'exterieur', surf: 'beton', use: ['sol', 'ext'], rough: 0.9, g: 'f', pl: true,
  colors: [['gris', 'grises', [140, 138, 132]], ['beige', 'beiges', [190, 176, 150]], ['rose', 'roses', [180, 140, 126]], ['anthracite', 'anthracite', [70, 70, 72]], ['ocre', 'ocre', [190, 150, 100]], ['blanc', 'blanches', [206, 204, 196]]],
  nm: (c) => `Dalles de jardin ${c[1]}`, states: ['n', 'm'], patch: { n: { stains: 2 }, m: { moss: 0.8, stains: 8 } },
  gen: (c, f, p) => tgTiles({ tile: 2, color: c[2], size: 0.4, grout: 0.02, groutColor: [50, 46, 40], offset: 0.5, var: 0.1, dirt: 0.4, ...p }),
});
gxFam({
  key: 'bq', famName: 'Terres craquelées', cat: 'exterieur', surf: 'terre', use: ['sol', 'ext'], rough: 1, g: 'f', size: [3, 3],
  colors: [['brune', 'brune', [130, 100, 70]], ['ocre', 'ocre', [190, 150, 100]], ['rouge', 'rouge', [150, 80, 56]], ['grise', 'grise', [140, 136, 126]], ['blanche', 'saline', [214, 208, 196]], ['sombre', 'sombre', [80, 66, 52]]],
  nm: (c) => `Terre craquelée ${c[1]}`, states: ['n'],
  gen: (c) => gxFlags({ cells: 9, colors: [c[2], shadec(c[2], 0.94), shadec(c[2], 1.05)], joint: shadec(c[2], 0.32), jw: 0.035, bevel: 0.06, var: 0.06, jit: 0.8, specks: 300 }),
});
gxFam({
  key: 'fe', famName: 'Feuillages', cat: 'nature', surf: 'vegetal', use: ['mur', 'ext', 'sol'], rough: 0.9, g: 'm',
  colors: [['buis', 'Haie de buis', [56, 86, 40], { color: [56, 86, 40], size: 8, count: 4600 }], ['sombre', 'Haie sombre', [36, 60, 34], { color: [36, 60, 34], size: 12, count: 2600 }],
    ['laurier', 'Haie de laurier', [50, 80, 46], { color: [50, 80, 46], size: 17, count: 1500 }], ['clair', 'Feuillage clair', [90, 130, 56], { color: [90, 130, 56], size: 13, count: 2400 }],
    ['automne', 'Feuillage d’automne', [180, 100, 40], { colors: [[190, 100, 40], [200, 150, 50], [150, 50, 30], [120, 90, 40]], color: [150, 80, 40], size: 13, count: 2400 }],
    ['fleurie', 'Haie fleurie', [70, 100, 50], { color: [60, 96, 46], size: 10, count: 3200, flowers: 700 }],
    ['mortes', 'Feuilles mortes', [140, 90, 50], { colors: [[150, 90, 40], [130, 76, 36], [170, 120, 60], [110, 70, 40]], color: [110, 76, 46], size: 15, count: 7000, round: true, under: tgGround({ c1: [58, 44, 30], c2: [80, 60, 36], pebbles: 60 }) }],
    ['lierre', 'Lierre dense', [50, 80, 40], { colors: [[52, 84, 40], [66, 100, 46], [40, 66, 32]], color: [50, 80, 40], size: 11, count: 3000, round: true }]],
  nm: (c) => c[1], gp: (f, c) => (['mortes'].includes(c[0]) ? ['f', true] : ['m', false]), states: ['n'], gen: (c) => gxLeaves({ ...c[3] }),
});
gxFam({
  key: 'ie', famName: 'Murs envahis de lierre', cat: 'nature', surf: 'vegetal', use: ['mur', 'ext'], rough: 0.92, g: 'm',
  colors: [['brique', 'de briques', [110, 80, 50], tgBrick({ tile: 2, colors: GX_BRICK[0][2], stains: 6 })], ['pierre', 'de pierres', [110, 110, 90], tgStoneWall({ tile: 2, colors: GX_STONE[0][2] })],
    ['beton', 'de béton', [110, 116, 96], tgConcrete({ base: [128, 124, 116], stains: 8 })], ['enduit', 'enduit', [150, 150, 120], tgPlaster({ color: [214, 208, 194], stains: 6 })],
    ['bois', 'de planches', [100, 90, 60], tgPlanks({ tile: 2, color: [128, 98, 66], width: 0.2, vertical: true, nails: true })], ['tole', 'de tôle', [100, 96, 80], tgCorrugated({ tile: 2, color: [130, 128, 124], rust: 0.6 })]],
  nm: (c) => `Mur ${c[1]} envahi de lierre`, states: ['n'], gen: (c) => gxIvy(c[3], { cover: 0.55 }),
});
gxFam({
  key: 'fl', famName: 'Parterres fleuris', cat: 'nature', surf: 'vegetal', use: ['sol', 'ext'], rough: 1, g: 'm',
  colors: [['multi', 'multicolore', [90, 110, 60], null], ['rouge', 'rouge', [110, 80, 50], [[200, 40, 50], [220, 80, 80]]], ['jaune', 'jaune', [130, 120, 50], [[230, 210, 60], [240, 180, 40]]], ['blanc', 'blanc', [150, 160, 130], [[240, 240, 236], [230, 230, 210]]]],
  nm: (c) => `Parterre fleuri ${gxAcc(c[1], false, false)}`, states: ['n'],
  gen: (c) => gxLeaves({ color: [60, 96, 46], size: 9, count: 3000, flowers: 1400, flowerColors: c[3] || undefined }),
});

/* ====================================== sols de Khamsin et de la Lune (mondes ouverts) */
const gxHex3 = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
gxFam({
  key: 'kh', famName: 'Sols de Khamsin', cat: 'exterieur', surf: 'terre', use: ['sol', 'ext'], rough: 0.97, g: 'm', size: [8, 8], src: 'khamsin',
  colors: [['dune', 'Sable des dunes (Khamsin)', gxHex3(0xe5b685), (c) => gxDune({ color: c[2] })], ['sombre', 'Sable sombre des creux (Khamsin)', gxHex3(0xc99662), (c) => gxDune({ color: c[2] })],
    ['plateau', 'Plateau caillouteux (Khamsin)', gxHex3(0xd9c4a0), (c) => tgGround({ c1: c[2], c2: shadec(c[2], 0.9), pebbles: 600, pebbleColor: [190, 170, 140] })],
    ['falaise', 'Roche des falaises (Khamsin)', gxHex3(0xae8c6b), () => gxStrata({ colors: [gxHex3(0xae8c6b), gxHex3(0x8a6a4e), [190, 156, 120]], layers: 6, cracks: 16 })],
    ['oued', 'Lit d’oued (Khamsin)', gxHex3(0xb08560), (c) => tgGround({ c1: c[2], c2: shadec(c[2], 0.86), pebbles: 900, pebbleSize: 5, pebbleColor: [150, 130, 110] })],
    ['boue', 'Boue de l’oasis (Khamsin)', gxHex3(0x7d6a4c), (c) => tgGround({ c1: c[2], c2: gxHex3(0x5b4a35), wet: true, pebbles: 40 })],
    ['oasis', 'Herbe de l’oasis (Khamsin)', gxHex3(0x7c8f45), (c) => tgGround({ c1: c[2], c2: shadec(c[2], 0.85), blades: 1800, bladeColor: [110, 130, 60] })],
    ['piste', 'Piste de sable tassé (Khamsin)', gxHex3(0xcda678), (c) => gxDune({ color: c[2], ripples: 0.01 })],
    ['route', 'Route du désert (Khamsin)', gxHex3(0x585a5e), (c) => tgAsphalt({ tile: 8, color: c[2], line: [232, 226, 210], dashed: true })],
    ['aviation', 'Piste d’aviation (Khamsin)', gxHex3(0x8d8984), (c) => tgConcrete({ base: c[2], joints: true, stains: 8 })]],
  nm: (c) => c[1], states: ['n'], gen: (c) => c[3](c),
});
gxFam({
  key: 'lu', famName: 'Sols de la Lune', cat: 'exterieur', surf: 'terre', use: ['sol', 'ext'], rough: 1, g: 'm', size: [8, 8], src: 'ombre',
  colors: [['regolithe', 'Régolithe (Lune)', gxHex3(0x8e8b86), {}], ['sombre', 'Régolithe sombre (Lune)', gxHex3(0x6f6c68), {}], ['ejectas', 'Éjectas clairs (Lune)', gxHex3(0xb4b1ab), { pebbles: 900 }],
    ['roche', 'Roche lunaire (Lune)', gxHex3(0x5d5a56), { pebbles: 1400, craters: 3 }], ['glace', 'Glace des cratères (Lune)', gxHex3(0xc6d3dc), { pebbles: 160 }], ['tasse', 'Sol tassé des bases (Lune)', gxHex3(0x77746f), { pebbles: 120 }]],
  nm: (c) => c[1], states: ['n'], gen: (c) => gxRegolith({ color: c[2], craters: 2, ...c[3] }),
});

/* ====================================================== textures des objets du jeu */
gxFam({
  key: 'obj', famName: 'Textures des objets du jeu', cat: 'objets', surf: (f, c) => c[5], use: ['mur', 'deco'], rough: 0.8, g: 'f', src: 'objets',
  colors: [['planche', 'Planche de barricade', [128, 90, 54], () => genWood(256, 48, [128, 90, 54]), [2, 0.375], 'bois'], ['porte', 'Porte en planches', [104, 72, 44], () => genPlanks(256, 512, 5, [104, 72, 44], true), [1, 2], 'bois'],
    ['blindee', 'Porte blindée « Accès restreint »', [64, 70, 66], () => genSteelDoor(), [1, 2], 'metal'], ['caisse', 'Caisse de munitions 7,92 mm', [128, 98, 60], () => genCrate(), [1, 1], 'bois'],
    ['metal', 'Métal du jeu', [70, 78, 72], () => genMetal(), [2, 2], 'metal'], ['metalsombre', 'Métal sombre du jeu', [46, 48, 46], () => genMetal([46, 48, 46]), [2, 2], 'metal'],
    ['boite', 'Flanc de la boîte mystère', [70, 46, 30], () => genBoxSide(false), [2, 1], 'bois']],
  nm: (c) => c[1], states: ['n'], size: (f, c) => c[4], gen: (c) => gxLegacy(c[3]),
});

/* ============================================================== science-fiction */
gxFam({
  key: 'sf', famName: (f) => ({ simple: 'Panneaux de science-fiction', lum: 'Panneaux lumineux', danger: 'Panneaux de sas' })[f[0]], cat: 'scifi', surf: 'metal', use: ['mur', 'sol', 'plafond'], rough: 0.5, metal: 0.3, g: 'm', pl: true,
  glow: (f) => (f[0] === 'lum' ? 1.2 : 0),
  colors: [['blanc', 'blancs', [214, 214, 210]], ['grisclair', 'gris clair', [170, 172, 174]], ['gris', 'gris', [120, 122, 126]], ['anthracite', 'anthracite', [62, 64, 68]], ['bleu', 'bleu acier', [70, 90, 116]],
    ['vert', 'verts', [70, 100, 80]], ['jaune', 'jaunes', [200, 160, 50]], ['orange', 'orange', [196, 100, 40]], ['noir', 'noirs', [36, 36, 40]], ['beige', 'beiges', [190, 178, 150]]],
  formats: [['simple', '', { lights: false }], ['lum', 'lumineux', { lights: true }], ['danger', 'de sas', { lights: false, hazard: true }]],
  nm: (c, f) => `Panneaux ${c[1]}${f[1] ? ` ${f[1]}` : ''}`, states: ['n', 's'], patch: { n: {}, s: { stains: 8, soot: 0.4, drips: 6 } },
  gen: (c, f, p) => gxSciFi({ color: c[2], glow: [120, 220, 255], ...f[2], ...p }),
});
gxFam({
  key: 'pc', famName: 'Circuits imprimés', cat: 'scifi', surf: 'special', use: ['mur', 'sol'], rough: 0.4, g: 'm',
  colors: [['vert', 'vert', [22, 70, 40], {}], ['bleu', 'bleu', [20, 40, 90], {}], ['rouge', 'rouge', [90, 20, 20], {}], ['noir', 'noir', [24, 24, 26], { trace: [210, 200, 180] }],
    ['violet', 'violet', [50, 24, 70], {}], ['vertdiodes', 'vert à diodes', [22, 70, 40], { leds: 40 }], ['noirdiodes', 'noir à diodes', [24, 24, 26], { leds: 50, trace: [190, 160, 80] }]],
  nm: (c) => `Circuit imprimé ${c[1]}`, states: ['n'], glow: (f, c) => (c[3].leds ? 1.3 : 0),
  gen: (c) => gxCircuit({ board: c[2], ...c[3] }),
});
gxFam({
  key: 'nh', famName: 'Nids d’abeille', cat: 'scifi', surf: 'metal', use: ['mur', 'sol'], rough: 0.4, metal: 0.5, g: 'm', size: [1, gxHexAspect(10)],
  colors: [['acier', 'en acier', [140, 144, 148], {}], ['bleu', 'bleu', [70, 100, 140], {}], ['noir', 'noir', [40, 42, 46], {}], ['dore', 'doré', [200, 160, 70], {}], ['blanc', 'blanc', [214, 214, 210], {}],
    ['miel', 'de cire (ruche)', [214, 160, 50], { groutColor: [150, 100, 30] }]],
  nm: (c) => `Nid d’abeille ${c[1]}`, states: ['n'],
  gen: (c) => gxHex({ n: 10, colors: [c[2], shadec(c[2], 0.9)], groutColor: shadec(c[2], 0.3), grout: 0.1, bevel: 0.2, dome: true, ...c[3] }),
});

/* ======================================================= lumineux (lumière propre) */
gxFam({
  key: 'led', famName: 'Dalles lumineuses', cat: 'lumineux', surf: 'lumiere', use: ['plafond', 'mur'], rough: 0.6, g: 'f', pl: true, glow: 1.4,
  colors: [['froid', 'blanc froid', [236, 244, 255], { light: [236, 244, 255] }], ['chaud', 'blanc chaud', [255, 236, 200], { light: [255, 236, 200] }], ['toutes', 'toutes allumées', [236, 244, 255], { every: 1 }],
    ['rares', 'une sur trois', [200, 206, 214], { every: 3 }], ['vertes', 'vertes (labo)', [180, 255, 200], { light: [180, 255, 200] }], ['rouges', 'rouges (alerte)', [255, 90, 70], { light: [255, 90, 70] }]],
  nm: (c) => `Dalles lumineuses ${c[1]}`, states: ['n'], gen: (c) => gxLights({ kind: 'dalles', n: 3, base: [60, 62, 66], ...c[3] }),
});
gxFam({
  key: 'neo', famName: 'Néons', cat: 'lumineux', surf: 'lumiere', use: ['mur', 'plafond'], rough: 0.5, g: 'm', pl: true, glow: 1.6,
  colors: [['blanc', 'blancs', [240, 246, 255]], ['bleu', 'bleus', [80, 160, 255]], ['rose', 'roses', [255, 80, 200]], ['vert', 'verts', [80, 255, 140]], ['rouge', 'rouges', [255, 60, 50]], ['violet', 'violets', [170, 90, 255]], ['jaune', 'jaunes', [255, 220, 90]]],
  nm: (c) => `Néons ${c[1]}`, states: ['n'], gen: (c) => gxLights({ kind: 'tubes', n: 4, light: c[2], base: [30, 30, 34] }),
});
gxFam({
  key: 'ecr', famName: 'Murs d’écrans', cat: 'lumineux', surf: 'lumiere', use: ['mur'], rough: 0.3, g: 'm', glow: 1.3,
  colors: [['vert', 'verts', [90, 255, 120]], ['ambre', 'ambre', [255, 180, 60]], ['bleu', 'bleus', [90, 170, 255]], ['rouge', 'rouges', [255, 70, 60]], ['blanc', 'blancs', [220, 230, 240]], ['cyan', 'cyan', [80, 240, 240]]],
  nm: (c) => `Mur d’écrans ${c[1]}`, states: ['n'], gen: (c) => gxLights({ kind: 'ecrans', n: 2, light: c[2], base: [40, 40, 44] }),
});
gxFam({
  key: 'cmd', famName: 'Pupitres de commande', cat: 'lumineux', surf: 'lumiere', use: ['mur'], rough: 0.5, metal: 0.2, g: 'm', glow: 1.2,
  colors: [['gris', 'gris', [110, 112, 116]], ['beige', 'beige', [180, 170, 146]], ['noir', 'noir', [40, 40, 44]], ['militaire', 'vert militaire', [80, 94, 70]]],
  nm: (c) => `Pupitre de commande ${gxAcc(c[1], false, false)}`, states: ['n'], gen: (c) => gxLights({ kind: 'commandes', n: 4, base: c[2], light: [230, 220, 180] }),
});
gxFam({
  key: 'dio', famName: 'Murs de diodes', cat: 'lumineux', surf: 'lumiere', use: ['mur', 'plafond'], rough: 0.5, g: 'm', glow: 1.5,
  colors: [['rouge', 'rouges', [255, 60, 50]], ['vert', 'vertes', [80, 255, 120]], ['bleu', 'bleues', [80, 150, 255]], ['blanc', 'blanches', [240, 240, 250]], ['ambre', 'ambre', [255, 170, 50]], ['multi', 'multicolores', [200, 160, 160], { colors: [[255, 60, 50], [80, 255, 120], [80, 150, 255], [255, 220, 80]] }]],
  hue: (c) => (c[0] === 'multi' ? 'multi' : null), nm: (c) => `Mur de diodes ${c[1]}`, states: ['n'], gen: (c) => gxLights({ kind: 'leds', light: c[2], base: [26, 26, 28], ...(c[3] || {}) }),
});
gxFam({
  key: 'vit', famName: 'Vitraux', cat: 'lumineux', surf: 'verre', use: ['mur'], rough: 0.2, g: 'm', glow: 0.9,
  colors: [['rougebleu', 'rouge et bleu', [140, 60, 120], [[190, 30, 40], [40, 70, 180], [220, 180, 60], [40, 140, 80]]], ['vertor', 'vert et or', [120, 150, 70], [[40, 140, 70], [220, 180, 60], [80, 170, 120]]],
    ['bleu', 'bleu', [60, 100, 190], [[40, 70, 180], [70, 120, 220], [30, 50, 140], [140, 180, 240]]], ['multi', 'multicolore', [160, 120, 120], [[190, 30, 40], [40, 70, 180], [220, 180, 60], [40, 140, 80], [140, 60, 170], [230, 120, 40]]],
    ['ambre', 'ambre', [220, 150, 60], [[230, 160, 50], [200, 120, 40], [240, 200, 100]]], ['violet', 'violet', [130, 70, 170], [[140, 60, 170], [90, 50, 140], [190, 120, 210]]],
    ['rose', 'rose', [220, 120, 160], [[230, 120, 160], [200, 80, 120], [240, 180, 200]]], ['sombre', 'sombre', [60, 50, 70], [[60, 30, 40], [30, 40, 70], [80, 70, 30]]]],
  hue: (c) => (c[0] === 'multi' ? 'multi' : null), nm: (c) => `Vitrail ${gxAcc(c[1], false, false)}`, states: ['n'],
  gen: (c) => gxFlags({ cells: 7, colors: c[3], joint: [20, 18, 16], jw: 0.05, bevel: 0, glass: true, var: 0.1, stains: 1, specks: 20 }),
});
gxFam({
  key: 'lav', famName: 'Laves', cat: 'lumineux', surf: 'lumiere', use: ['sol', 'mur', 'ext'], rough: 0.9, g: 'f', glow: 1.8, size: [3, 3],
  colors: [['orange', 'orangée', [60, 40, 34], [[52, 40, 36], [62, 46, 40], [44, 34, 30]]], ['rouge', 'rougeoyante', [70, 36, 30], [[60, 30, 26], [70, 36, 30], [50, 26, 24]]],
    ['jaune', 'vive', [80, 60, 40], [[70, 54, 40], [84, 64, 46]]], ['sombre', 'refroidie', [40, 36, 34], [[36, 34, 32], [44, 40, 38], [30, 28, 28]]]],
  tint: () => [200, 80, 30], nm: (c) => `Lave ${c[1]}`, states: ['n'],
  gen: (c) => gxFlags({ cells: 6, colors: c[3], jw: c[0] === 'sombre' ? 0.025 : c[0] === 'jaune' ? 0.08 : 0.05, bevel: 0.1, hot: true, var: 0.2, stains: 0, specks: 200 }),
});

/* ============================================================== verre et eau */
gxFam({
  key: 'eau', famName: 'Eaux et liquides', cat: 'verre', surf: 'verre', use: ['sol'], rough: 0.08, metal: 0.2, g: 'f', size: [4, 4],
  colors: [['claire', 'Eau claire', [40, 70, 80]], ['croupie', 'Eau croupie', [26, 34, 30]], ['boueuse', 'Eau boueuse', [70, 60, 40]], ['verte', 'Eau verte', [40, 80, 50]],
    ['toxique', 'Boue toxique fluo', [70, 130, 30]], ['sang', 'Sang', [70, 6, 8]], ['huile', 'Nappe d’huile', [20, 18, 16]], ['egout', 'Eau d’égout', [50, 46, 30]], ['mer', 'Eau de mer', [30, 60, 80]], ['acide', 'Acide', [120, 160, 30]]],
  nm: (c) => c[1], states: ['n'], gen: (c) => tgWater({ color: c[2] }),
});
gxFam({
  key: 'pvv', famName: 'Pavés de verre', cat: 'verre', surf: 'verre', use: ['mur'], rough: 0.15, g: 'm', pl: true,
  colors: [['eau', 'vert d’eau', [150, 190, 186]], ['bleu', 'bleus', [130, 170, 210]], ['clair', 'clairs', [200, 210, 214]], ['ambre', 'ambre', [210, 160, 80]], ['fume', 'fumés', [100, 104, 110]], ['rose', 'roses', [214, 170, 180]]],
  nm: (c) => `Pavés de verre ${c[1]}`, states: ['n', 's'], patch: { n: {}, s: { stains: 10, water: 1 } },
  gen: (c, f, p) => gxGlassBlock({ tile: 2, color: c[2], ...p }),
});
gxFam({
  key: 'vd', famName: 'Verres et miroirs', cat: 'verre', surf: 'verre', use: ['mur'], rough: 0.1, metal: 0.3, g: 'm',
  colors: [['depoli', 'Verre dépoli', [196, 206, 210], { frost: true }], ['depolivert', 'Verre dépoli vert', [160, 190, 170], { frost: true }], ['depolibleu', 'Verre dépoli bleu', [160, 180, 210], { frost: true }],
    ['fume', 'Verre fumé', [70, 74, 80], {}], ['vitre', 'Vitrage à petits carreaux', [150, 170, 180], { frame: 4 }], ['verriere', 'Verrière d’atelier', [130, 150, 160], { frame: 2, frost: true }],
    ['miroir', 'Miroir', [200, 206, 212], {}], ['miroirpique', 'Miroir piqué', [180, 184, 186], { stains: 12, water: 1 }]],
  nm: (c) => c[1], states: ['n'], gen: (c) => gxGlassPlain({ color: c[2], ...c[3] }),
});

/* =================================================================== horreur */
gxFam({
  key: 'os', famName: 'Ossuaires', cat: 'horreur', surf: 'special', use: ['mur'], rough: 0.9, g: 'm',
  colors: [['ivoire', 'ivoire', [210, 196, 160], {}], ['jauni', 'jauni', [196, 170, 110], {}], ['gris', 'gris', [170, 166, 156], { bg: [16, 16, 18] }], ['brun', 'brun', [150, 120, 84], {}],
    ['cranes', 'de crânes seuls', [200, 186, 150], { pattern: ['c'] }], ['sang', 'ensanglanté', [190, 170, 140], { blood: 1.4 }]],
  nm: (c) => `Ossuaire ${c[1]}`, states: ['n'], gen: (c) => gxOssuary({ tile: 2, bone: c[2], ...c[3] }),
});
gxFam({
  key: 'org', famName: 'Parois organiques', cat: 'horreur', surf: 'special', use: ['mur', 'sol'], rough: 0.5, g: 'f',
  colors: [['rose', 'rose', [190, 110, 110], {}], ['sombre', 'sombre', [110, 50, 50], {}], ['pourrie', 'pourrie', [110, 120, 70], { vein: [60, 40, 30], pus: [180, 190, 80] }], ['violacee', 'violacée', [130, 70, 110], {}],
    ['brulee', 'brûlée', [80, 50, 40], { soot: 0.8 }], ['vif', 'à vif', [170, 40, 40], { blood: 1 }], ['grise', 'grise (chair morte)', [150, 146, 140], { vein: [70, 70, 90] }], ['pustules', 'à pustules', [180, 120, 100], { pus: [220, 200, 90] }]],
  nm: (c) => `Paroi organique ${c[1]}`, states: ['n'], gen: (c) => gxOrganic({ color: c[2], ...c[3] }),
});
gxFam({
  key: 'gf', famName: 'Graffitis', cat: 'horreur', surf: 'special', use: ['mur'], rough: 0.9, g: 'm', pl: true,
  colors: [['beton', 'sur béton', [128, 124, 116], tgConcrete({ base: [128, 124, 116], stains: 8 })], ['brique', 'sur briques', [130, 64, 46], tgBrick({ tile: 2, colors: GX_BRICK[0][2] })],
    ['tole', 'sur tôle ondulée', [130, 130, 128], tgCorrugated({ tile: 2, color: [140, 144, 146], rust: 0.3 })], ['enduit', 'sur enduit', [210, 204, 190], tgPlaster({ color: [214, 208, 194] })],
    ['parpaing', 'sur parpaings', [140, 138, 132], tgBrick({ tile: 2, colors: [[140, 138, 132]], bw: 0.4, bh: 0.2 })], ['bois', 'sur planches', [128, 98, 66], tgPlanks({ tile: 2, color: [128, 98, 66], width: 0.2, vertical: true })]],
  formats: [['a', ''], ['b', 'en couleurs vives', { colors: [[255, 60, 160], [60, 220, 255], [255, 230, 40], [120, 255, 80]] }]],
  hue: () => 'multi', nm: (c, f) => `Graffitis ${c[1]}${f[1] ? ` ${f[1]}` : ''}`, states: ['n'], gen: (c, f) => gxGraffiti(c[3], { tags: 4, ...(f[2] || {}) }),
});
gxFam({
  key: 'sg', famName: 'Murs ensanglantés', cat: 'horreur', surf: 'special', use: ['mur'], rough: 0.85, g: 'm',
  colors: [['beton', 'de béton', [120, 90, 86], tgConcrete({ base: [128, 124, 116], blood: 0.8 })], ['carrelage', 'carrelé', [190, 160, 156], tgTiles({ tile: 2, color: [214, 214, 208], size: 0.2, blood: 0.6 })],
    ['enduit', 'enduit', [200, 170, 160], tgPlaster({ color: [210, 204, 190], blood: 0.6 })], ['bois', 'de planches', [120, 80, 60], tgPlanks({ tile: 2, color: [128, 98, 66], width: 0.2, vertical: true, blood: 0.6 })]],
  tint: (c) => c[2], hue: () => 'rouge', nm: (c) => `Mur ${c[1]} aux mains sanglantes`, states: ['n'], gen: (c) => gxHands(c[3], { hands: 7 }),
});

/* ==================================== métadonnées des textures du jeu 1.x, de Khamsin et de la Lune */
/* teinte relevée sur les vignettes (moyenne de la vignette, éclaircie : l'ombre du relief l'assombrit),
   état et surface quand le nom les dit */
const GX_LEGACY_TINT = (
  'bunker_wall:6e6d63 paint_hospital:919b8e paint_school:98876d paint_factory:827a63 paint_army:706f56 paint_cell:93938f paint_red:56231f ' +
  'paint_blue:737c86 paint_lab:aeb2b0 paint_rust:625043 paint_bloody:646057 paint_sooty:4d4943 concrete:706c65 concrete_light:928f88 concrete_dark:44423f ' +
  'concrete_stained:69645b concrete_cracked:65625b concrete_form:706d66 concrete_slab:716d66 concrete_polished:7d7b78 concrete_blood:5f554f ' +
  'concrete_moss:525749 concrete_wet:535451 plaster_white:bcb8af plaster_peeling:90877b plaster_yellow:b19e76 stucco:97938b stucco_ochre:a47e56 ' +
  'plaster_bloody:998d82 brick_red:654a40 brick_dark:41342d brick_yellow:87775d brick_white:a2958b brick_burnt:4d3d35 brick_old:615143 brick_green:4e5544 ' +
  'brick_bloody:62463d roof_tiles:512d1f roof_slate:2c2f33 cinder_block:787670 cinder_painted:a0a398 stone_blocks:867e6c stone_wall:5f5b53 ' +
  'stone_dark:3a3734 stone_moss:535347 stone_rubble:706859 tiles_white:878782 tiles_hospital:607066 tiles_blue:8099a7 tiles_checker:5a5956 ' +
  'tiles_dirty:646158 tiles_broken:7c7b76 tiles_subway:61605c tiles_subway_green:3f4a3f tiles_mosaic:353330 tiles_terracotta:7a4837 ' +
  'tiles_red_white:785953 tiles_large_grey:646462 tiles_bloody:7f7a75 wood_oak:553b23 wood_dark:301f12 wood_light:6d583c wood_rough:58432c ' +
  'wood_rotten:3e3324 wood_painted:495240 wood_painted_white:a29b8e wood_panel:4e3520 wood_panel_dark:312013 wood_barn:6e2f21 wood_bloody:573c28 ' +
  'wood_weathered:444139 roof_tar:22211e wood_logs:45301e metal_plates:555a58 metal_plates_rust:605146 metal_green:3e4b36 metal_ship:514e4e ' +
  'metal_diamond:7a7c7c metal_diamond_rust:766357 metal_corrugated:707375 metal_corrugated_rust:725444 metal_corrugated_red:732c20 metal_grating:545555 ' +
  'metal_grating_rust:604636 metal_rust:69361b metal_panels:bcc0be metal_panels_blue:495e75 hazard_yellow:5c4b16 hazard_red:ac6e67 ' +
  'wallpaper_stripes:8d6f4c wallpaper_damask:762f23 wallpaper_floral:ad9c73 wallpaper_dots:8c9a83 wallpaper_chevron:606e69 wallpaper_squares:91774f ' +
  'wallpaper_old:847250 wallpaper_torn:7f8068 wallpaper_bloody:8a6f4c padded_white:c1beb3 padded_dirty:968773 poster_wall:79685c bunker_floor:44413b ' +
  'lino_hospital:899c93 lino_checker:7b7263 lino_kitchen:a1766a carpet_red:691b1b carpet_blue:283453 carpet_hotel:57291d carpet_green:30462e ' +
  'rubber_floor:2a2b2d marble_white:c1bfba marble_black:2b2b2f marble_green:2d483b bunker_ceiling:2b2b2a ceiling_tiles:bab8b0 ' +
  'ceiling_tiles_stained:aea89b ceiling_tiles_broken:6c685f ceiling_beams:463320 ceiling_metal:595a59 ceiling_plaster:aba79c frost_ground:424141 ' +
  'grass:344421 grass_dry:5a5031 grass_frost:4d574b dirt:433424 mud:2f261b gravel:5d5a54 gravel_dark:383734 sand:978662 forest_floor:3b301d ash:464442 ' +
  'snow:c2cad3 snow_tracks:c2c9d3 asphalt:333335 asphalt_cracked:323234 road_line:333335 road_yellow:363533 cobble:47443f cobble_wet:363431 ' +
  'cobble_moss:414039 water_dark:171e1a blood_pool:3f0507 toxic:33561a flesh:6a2928 black:060606 kh_mudbrick:ccb695 kh_whitewash:d9ceb6 kh_ochre:bb9466 ' +
  'kh_concrete:9c978d kh_sheet:95938c kh_sheet_red:803b28 kh_sandstone:b39973 kh_rock:967458 kh_canvas:c8b995 kh_planks:5e462c kh_paint:d1cbc0 ' +
  'kh_floor:9b896f kh_slab:9d8664 kh_relief:a99270 kh_stars:272e4d kh_basalt:252325 kh_gold:c99f44 kh_faience:35867e kh_limestone:c9bca3 ' +
  'kh_pyrstone:b29d80 kh_granite:9b6156 kh_sand:b6986d lu_panel:d5d5cf lu_ceil:e0e0dc lu_panel_dark:6e7276 lu_metal:939597 lu_grate:434446 ' +
  'lu_floor:5c6064 lu_yellow:d2a527 lu_hazard:685118 lu_solar:303c53 lu_foil:98732f lu_glass:455463 '
).trim().split(' ');
(function gxLegacyMeta() {
  for (const kv of GX_LEGACY_TINT) {
    const [id, hex] = kv.split(':'), d = TEXLIB[id];
    if (!d || d.tint) continue;
    const v = parseInt(hex, 16);
    d.tint = [Math.min(255, Math.round(((v >> 16) & 255) * 1.2)), Math.min(255, Math.round(((v >> 8) & 255) * 1.2)), Math.min(255, Math.round((v & 255) * 1.2))];
    d.hue = gxHue(d.tint);
  }
  const ST = [[/ensanglant|mare de sang/i, 'sang'], [/brûl|suie/i, 'brule'], [/mouss|pourri/i, 'mousse'], [/fissur|cassé|éventr|déchir|écaill/i, 'abime'], [/rouill/i, 'rouille'], [/tach|sale|jauni/i, 'sale'],
    [/humide|mouill|croupi/i, 'eau'], [/gelé|neige/i, 'gel'], [/vieill|délav|anciennes|usé/i, 'use']];
  for (const d of Object.values(TEXLIB)) {
    if (d.src || d.custom) continue;
    const nm = d.name.replace(/blanc cassé/g, '');
    const st = ST.find(([re]) => re.test(nm));
    d.state = st ? st[1] : 'neuf';
    if (d.cat === 'verre') d.surf = 'verre';
  }
})();
