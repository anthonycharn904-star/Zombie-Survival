/* ============================================================== 14 TAILLES ==
   Jeu 2.0.3 (demande d'Anthony du 10 octobre 2026, 13 h 22) : dans les Mod Tools, « dimensionner ou
   redimensionner tous les objets ou toutes les textures ». Ses choix : la taille d'une texture vaut
   pour toute la carte, avec des variantes (une copie d'une texture avec sa propre taille) ; objets et
   modèles importés, textures, bâtiments des cartes ouvertes et éléments de jeu.
     objets      s : un nombre (même facteur sur les trois axes) ou [sx, sy, sz] (largeur, hauteur,
                 profondeur du modèle) ; la collision suit la boîte du modèle mise à l'échelle
     textures    texSizes : { id: [largeur, hauteur] } (mètres d'une répétition) sur cette carte ;
                 hauteur 0 : sur les murs, la texture suit leur hauteur (comme les textures « ajustées »
                 de la bibliothèque) ; variantes : custom.textures[u_…] = { name, base, size } (même
                 image, autre taille ; même règle pour la hauteur 0)
     bâtiments   w, d (mètres entiers, avant rotation), h (hauteur des murs) : refaits à ces cotes
     éléments    k : facteur de taille (boîte, atouts, Le Glas, interrupteur et disjoncteurs, postes
                 d'oxygène, armes au mur, panneaux peints, jerricans) ; emprise, point d'achat et
                 hauteur sous plafond suivent. Les véhicules gardent leur taille (conduite et
                 collisions réglées pour elle).
   Un jeu plus ancien lit ces cartes sans les nouveautés (objets et éléments à leur taille d'origine,
   variantes en béton). */
const SIZE_RULES = { prop: [0.02, 50], tex: [0.05, 50], elem: [0.4, 3] };
const r3s = (v) => Math.round(v * 1000) / 1000;

/* Facteurs d'un objet posé : [sx, sy, sz]. */
function propScale(pr) {
  const s = pr && pr.s;
  if (Array.isArray(s)) return [s[0] > 0 ? s[0] : 1, s[1] > 0 ? s[1] : 1, s[2] > 0 ? s[2] : 1];
  const k = typeof s === 'number' && s > 0 ? s : 1;
  return [k, k, k];
}
/* Facteurs lus dans une carte : un nombre, ou trois (largeur, hauteur, profondeur) ; undefined pour 1. */
function normPropScale(v) {
  const [a, b] = SIZE_RULES.prop;
  const one = (x) => (typeof x === 'number' && Number.isFinite(x) ? r3s(clamp(x, a, b)) : null);
  if (Array.isArray(v)) {
    if (v.length !== 3) return undefined;
    const s = v.map(one);
    if (s.some((x) => x === null)) return undefined;
    if (s[0] === s[1] && s[1] === s[2]) return Math.abs(s[0] - 1) < 1e-3 ? undefined : s[0];
    return s;
  }
  const s = one(v);
  return s === null || Math.abs(s - 1) < 1e-3 ? undefined : s;
}

/* Facteur de taille d'un élément de jeu (1 : taille d'origine). */
function elemK(v) {
  const [a, b] = SIZE_RULES.elem;
  return typeof v === 'number' && Number.isFinite(v) ? r3s(clamp(v, a, b)) : 1;
}
/* Recopie le facteur k (s'il n'est pas 1) dans un élément normalisé. */
function withK(o, v) {
  const k = elemK(v);
  if (Math.abs(k - 1) > 1e-3) o.k = k;
  return o;
}

/* Taille d'une répétition de texture (mètres) : celle de la carte à grille en cours (texSizes), sinon
   celle de la bibliothèque (ou de la variante). Hauteur 0 (ajustée aux murs) : sur un sol, la
   hauteur garde les proportions de la texture. */
function texSizeOver(id) {
  const m = CUR.map;
  return m && !m.open && m.texSizes ? m.texSizes[id] || null : null;
}
function texDims(id) {
  const o = texSizeOver(id), d = TEXLIB[id] || TEXLIB.concrete;
  if (!o) return d.size;
  return o[1] > 0 ? o : [o[0], r3s((o[0] * d.size[1]) / d.size[0])];
}
/* Sur les murs, la texture suit-elle leur hauteur ? (réglage de la carte, sinon celui de la texture) */
function texFit(id) {
  const o = texSizeOver(id);
  return o ? o[1] === 0 : !!(TEXLIB[id] || TEXLIB.concrete).fit;
}
/* Tailles de textures lues dans une carte : { id: [l, h] } (h = 0 : ajustée à la hauteur des murs). */
function normTexSizes(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const [a, b] = SIZE_RULES.tex;
  for (const id of Object.keys(v).slice(0, 400)) {
    const s = v[id];
    if (!/^[\w-]{1,60}$/.test(id) || !Array.isArray(s) || s.length !== 2 || !s.every((x) => typeof x === 'number' && Number.isFinite(x))) continue;
    out[id] = [r3s(clamp(s[0], a, b)), s[1] === 0 ? 0 : r3s(clamp(s[1], a, b))];
  }
  return out;
}
/* Variante de texture lue dans une carte (sans image : celle de sa base) ; null si illisible. */
function normTexVariant(t, hasBase) {
  if (!t || typeof t.base !== 'string' || !/^[\w-]{1,60}$/.test(t.base) || !hasBase(t.base)) return null;
  const [a, b] = SIZE_RULES.tex;
  const sz = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? r3s(clamp(x, a, b)) : d);
  const size = Array.isArray(t.size) ? [sz(t.size[0], 2), t.size[1] === 0 ? 0 : sz(t.size[1], 2)] : [2, 2];
  return { name: (typeof t.name === 'string' ? t.name.slice(0, 60).trim() : '') || 'Variante', base: t.base, size };
}
/* Variantes de textures d'une carte : enregistrées dans la bibliothèque (même image ou même dessin
   que leur base, leur propre taille) ; celles d'une autre carte sont retirées. */
function registerTextureVariants(map) {
  const ct = (map && map.custom && map.custom.textures) || {};
  for (const id of Object.keys(TEXLIB)) {
    const d = TEXLIB[id];
    if (!d.variant) continue;
    const t = ct[id];
    if (!t || t.base !== d.variant || !TEXLIB[t.base]) { delete TEXLIB[id]; texVariantForget(id); }
  }
  for (const id of Object.keys(ct)) {
    const t = ct[id];
    if (!t || typeof t.base !== 'string' || typeof t.data === 'string') continue;
    const B = TEXLIB[t.base];
    if (!B || B.variant) continue;
    // hauteur 0 : ajustée aux murs (sur un sol, proportions de la base)
    const fit = t.size[1] === 0, size = fit ? [t.size[0], r3s((t.size[0] * B.size[1]) / B.size[0])] : t.size.slice();
    const old = TEXLIB[id];
    if (old && old.variant === t.base && old.size[0] === size[0] && old.size[1] === size[1] && old.fit === fit && old.name === t.name) continue;
    TEXLIB[id] = { ...B, id, name: t.name, cat: 'variant', size, fit, custom: true, variant: t.base };
    texVariantForget(id);
  }
}
function texVariantForget(id) {
  for (const k of Object.keys(THUMBS)) if (k === id || k.startsWith(`${id}@`)) delete THUMBS[k];
  delete LEVEL_TEX[id]; delete LEVEL_MAT[id];      // ce sont ceux de la base : rien à libérer
}

/* Boîte mystère agrandie ou réduite : son dos reste où il était (contre le mur), elle grandit vers
   le joueur. boxShift : déplacement de son centre vers la face ; boxReach : du centre au point d'achat
   (1 m à la taille d'origine). */
const boxShift = (k) => 0.42 * (k - 1);
const boxReach = (k) => 0.58 + 0.42 * k;
/* Boîte mystère : cases sous la boîte (2 de long sur 1 de profondeur à la taille d'origine), avec
   son facteur k ; centre (x, z) (déjà déplacé de boxShift), face vers le joueur. */
function boxFootCells(x, z, face, k) {
  const fx = face[0], fz = face[1], rx = -fz, rz = fx;
  const hw = 0.82 * k, hd = 0.42 * k, out = [], seen = new Set();
  for (let a = -hw + 0.1; a <= hw - 0.1 + 1e-6; a += Math.max(0.25, (2 * hw - 0.2) / 8)) {
    for (let b = -hd + 0.1; b <= hd - 0.1 + 1e-6; b += Math.max(0.25, (2 * hd - 0.2) / 4)) {
      const cx = Math.floor(x + rx * a + fx * b), cz = Math.floor(z + rz * a + fz * b), key = `${cx},${cz}`;
      if (!seen.has(key)) { seen.add(key); out.push([cx, cz]); }
    }
  }
  return out;
}
/* Glas : rectangle occupé (repère de la machine : x en largeur, z vers le joueur), 6 × 3 m × k. */
const glasHalf = (k) => [3 * k, 1.5 * k];
/* Cases tenues par la boîte à un emplacement d'une carte à grille : ses deux cases, ou davantage si
   elle est agrandie (les cartes ouvertes passent par owBoxProp). */
function boxCellsOf(L) {
  const k = L.k || 1;
  return !OW.on && Math.abs(k - 1) > 1e-3 ? boxFootCells(L.x, L.z, L.face, k) : L.cells;
}
