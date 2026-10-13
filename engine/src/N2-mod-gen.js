/* =====================================================================================================
   Jeu 2.0.4 : grande bibliothèque de modèles (« des milliers de modèles, des tables, des chaises ou
   autre… vraiment de tout », demande d'Anthony du 12 octobre 2026). Familles paramétriques (tailles,
   styles, matières, couleurs) × états (neuf, usé, cassé, renversé, brûlé, ensanglanté, rouillé,
   moussu, enneigé, éteint) ; identifiants stables gm_<famille>_<variante…>[_<état>] que les cartes
   enregistrent (ne jamais renommer une clé). Les états sont des transformations des pièces du
   modèle neuf (mdState), toujours reproductibles (P.R).
   Métadonnées pour le navigateur des Mod Tools : src 'gen', fam / famName, state, mat, tags.
   ===================================================================================================== */
MODEL_CATS.push(['cuisine', 'Cuisine & salle de bain'], ['decor', 'Décoration & objets'], ['electro', 'Électronique & machines'], ['structure', 'Structures (murs, clôtures, portes)'],
  ['vehicule', 'Véhicules & épaves'], ['antique', 'Antiquité & Égypte'], ['scifi', 'Science-fiction & Lune']);

/* ------------------------------------------------------------- couleurs -- */
const mdRGB = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mdHex = (c) => (clamp(Math.round(c[0]), 0, 255) << 16) | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[2]), 0, 255);
const mdMix = (a, b, t) => mdHex([0, 1, 2].map((i) => mdRGB(a)[i] + (mdRGB(b)[i] - mdRGB(a)[i]) * t));
const mdShade = (a, k) => mdHex(mdRGB(a).map((v) => v * k));

/* ------------------------------------------------------- boîtes des pièces -- */
function mdPartBox(q, out = new THREE.Box3()) {
  const g = unitGeo(q.key);
  if (!g.boundingBox) g.computeBoundingBox();
  return out.copy(g.boundingBox).applyMatrix4(q.m);
}
function mdBoxOf(list) {
  const b = new THREE.Box3(), t = new THREE.Box3();
  for (const q of list) b.union(mdPartBox(q, t));
  if (b.isEmpty()) b.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  return b;
}
/* Toutes les pièces passent par la matrice m (à gauche). */
const mdXf = (list, m) => { for (const q of list) q.m = m.clone().multiply(q.m); };
/* Repose le modèle au sol, centré (après une rotation). */
function mdGround(list, sink = 0) {
  const b = mdBoxOf(list);
  mdXf(list, new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y - sink, -(b.min.z + b.max.z) / 2));
}
const mdVol = (q) => { const b = mdPartBox(q); return (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z); };
const MD_SOFT = new Set(['fabric', 'paper', 'foliage', 'vine', 'ivy', 'moss', 'fern']);

/* ----------------------------------------------------------------- états -- */
/* [facette du navigateur, adjectif (masculin singulier)] */
const MD_WEAR = {
  n: ['neuf', ''], u: ['use', 'usé'], c: ['abime', 'cassé'], a: ['abime', 'abîmé'], x: ['renverse', 'renversé'], pe: ['renverse', 'penché'],
  b: ['brule', 'brûlé'], g: ['sang', 'ensanglanté'], r: ['rouille', 'rouillé'], m: ['mousse', 'moussu'], s: ['neige', 'enneigé'], e: ['eteint', 'éteint'],
};
function mdState(P, st) {
  const R = P.R, L = P.list;
  if (!st || st === 'n') return;
  if (st === 'u') {
    for (const q of L) {
      if (q.f.startsWith('decal:') || q.f === 'glow') continue;
      q.c = mdShade(mdMix(q.c, 0x8a8478, 0.2), 0.84);
      if (q.f === 'metal' && R() < 0.35) { q.f = 'rust'; q.c = mdMix(q.c, 0xe0c0a0, 0.6); }
    }
    return;
  }
  if (st === 'r') {
    for (const q of L) if (q.f === 'metal' || (q.f === 'paint' && R() < 0.6)) { q.f = 'rust'; q.c = mdMix(q.c, 0xe8c8a8, 0.55); }
    return;
  }
  if (st === 'e') { for (const q of L) if (q.f === 'glow') { q.f = 'plastic'; q.c = mdShade(q.c, 0.32); } return; }
  if (st === 'b') {
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      if (q.f === 'glow' || q.f === 'glass' || q.f === 'liquid') { L.splice(i, 1); continue; }
      if (MD_SOFT.has(q.f) && R() < 0.55 && L.length > 3) { L.splice(i, 1); continue; }
      if (q.f.startsWith('decal:')) continue;
      q.c = mdMix(q.c, 0x15110d, q.f === 'metal' || q.f === 'rust' ? 0.62 : 0.84);
      if (q.f === 'metal') { q.f = 'rust'; q.c = mdMix(q.c, 0x3a2a20, 0.3); }
    }
    const b = mdBoxOf(L);
    P.p(Math.max(1, (b.max.x - b.min.x) * 1.3), Math.max(1, (b.max.z - b.min.z) * 1.3), (b.min.x + b.max.x) / 2, 0.006, (b.min.z + b.max.z) / 2, 'decal:decal_scorch', 0xffffff, 0, R() * TAU, 0);
    return;
  }
  if (st === 'g') {
    const b = mdBoxOf(L), t = new THREE.Box3();
    // éclaboussures sur les faces du dessus des grandes pièces
    const tops = L.filter((q) => !q.f.startsWith('decal:') && q.f !== 'glow').map((q) => [q, mdPartBox(q, new THREE.Box3())]).filter(([, bb]) => (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z) > 0.04 && bb.max.y > 0.25);
    for (let i = 0; i < Math.min(4, tops.length); i++) {
      const [, bb] = tops[(R() * tops.length) | 0], s = Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * (0.3 + R() * 0.4);
      P.b(s, 0.006, s * (0.6 + R() * 0.6), rr(R, bb.min.x + s / 2, Math.max(bb.min.x + s / 2, bb.max.x - s / 2)), bb.max.y + 0.004, rr(R, bb.min.z + s / 2, Math.max(bb.min.z + s / 2, bb.max.z - s / 2)), 'paint', 0x4a0606, 0, R() * 3, 0);
    }
    t.copy(b);
    P.p(Math.max(0.9, (b.max.x - b.min.x) * 1.1), Math.max(0.9, (b.max.z - b.min.z) * 1.1), (b.min.x + b.max.x) / 2 + rr(R, -0.15, 0.15), 0.008, (b.min.z + b.max.z) / 2 + rr(R, -0.15, 0.15), 'decal:decal_blood_pool', 0xffffff, 0, R() * TAU, 0);
    return;
  }
  if (st === 'm') {
    for (const q of L) if (['stone', 'concrete', 'wood', 'bark', 'metal', 'rust', 'paint', 'crate'].includes(q.f)) q.c = mdMix(q.c, 0x4f6a38, 0.28);
    const tops = L.map((q) => mdPartBox(q)).filter((bb) => (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z) > 0.03);
    for (let i = 0; i < Math.min(5, tops.length); i++) {
      const bb = tops[(R() * tops.length) | 0];
      P.p((bb.max.x - bb.min.x) * (0.5 + R() * 0.5), (bb.max.z - bb.min.z) * (0.5 + R() * 0.5), (bb.min.x + bb.max.x) / 2, bb.max.y + 0.006, (bb.min.z + bb.max.z) / 2, 'moss', 0x6a8a48, 0, R() * 3, 0);
    }
    return;
  }
  if (st === 's') {
    // neige : chapeaux sur les dessus plats (boîtes, cylindres debout) ; formes rondes (feuillage, rochers,
    // cônes) blanchies
    const caps = [];
    for (const q of L) {
      if (q.f === 'glow' || q.f.startsWith('decal:')) continue;
      const e = q.m.elements, ly = Math.hypot(e[4], e[5], e[6]) || 1, up = e[5] / ly;
      if (q.key === 'box') { const bb = mdPartBox(q); if ((bb.max.x - bb.min.x) * (bb.max.z - bb.min.z) > 0.02 && bb.max.y > 0.15 && Math.abs(up) > 0.97) caps.push(['b', bb]); }
      else if (q.key.startsWith('cyl:1:') && Math.abs(up) > 0.97) { const bb = mdPartBox(q); if (bb.max.y > 0.15) caps.push(['c', bb, Math.hypot(e[0], e[1], e[2])]); }
      else if (q.f === 'foliage' || q.f === 'fern' || q.f === 'vine' || q.f === 'stone' || q.key.startsWith('sph') || q.key.startsWith('rock') || q.key.startsWith('cyl')) q.c = mdMix(q.c, 0xdfe6ee, 0.55);
    }
    const seen = new Set();
    for (const [k, bb, r] of caps.sort((a, b) => b[1].max.y - a[1].max.y).slice(0, 16)) {
      const key = `${bb.max.y.toFixed(2)}|${bb.min.x.toFixed(1)}|${bb.min.z.toFixed(1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const x = (bb.min.x + bb.max.x) / 2, z = (bb.min.z + bb.max.z) / 2;
      if (k === 'b') P.b((bb.max.x - bb.min.x) * 0.96, 0.05, (bb.max.z - bb.min.z) * 0.96, x, bb.max.y + 0.022, z, 'paint', 0xe6ecf2);
      else P.c(r * 0.96, 0.05, x, bb.max.y + 0.022, z, 'paint', 0xe6ecf2, 0, 0, 0, 12);
    }
    return;
  }
  if (st === 'x') {
    mdXf(L, new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    mdGround(L);
    return;
  }
  if (st === 'pe') {
    mdXf(L, new THREE.Matrix4().makeRotationZ((R() < 0.5 ? -1 : 1) * (0.14 + R() * 0.12)));
    mdGround(L, 0.04);
    return;
  }
  if (st === 'c' || st === 'a') {
    // cassé : une ou deux pièces moyennes tombent à côté, le reste de travers ; débris au sol
    const order = L.map((q, i) => [i, mdVol(q)]).filter(([i]) => !L[i].f.startsWith('decal:')).sort((a, b) => b[1] - a[1]);
    const cand = order.slice(1, Math.max(2, Math.min(order.length, 8)));
    const n = st === 'c' ? 1 + (R() < 0.5 ? 1 : 0) : 1, b0 = mdBoxOf(L);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), e = new THREE.Euler();
    for (let k = 0; k < n && cand.length; k++) {
      const [i] = cand.splice((R() * cand.length) | 0, 1)[0], q = L[i];
      q.m.decompose(pos, quat, scl);
      const bb = mdPartBox(q);
      e.set(R() < 0.5 ? Math.PI / 2 : 0, R() * TAU, (R() - 0.5) * 0.3);
      quat.setFromEuler(e);
      pos.set(rr(R, b0.min.x - 0.3, b0.max.x + 0.3), Math.max(0.03, Math.min(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) / 2), b0.max.z + rr(R, 0.05, 0.4));
      q.m.compose(pos, quat, scl);
      q.loose = true;
    }
    const rest = L.filter((q) => !q.loose);
    if (rest.length) { mdXf(rest, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((R() - 0.5) * 0.12, 0, (R() - 0.5) * 0.14))); }
    for (const q of L) delete q.loose;
    for (let i = 0; i < 4; i++) {
      const src = L[(R() * L.length) | 0];
      if (src.f.startsWith('decal:')) continue;
      P.b(rr(R, 0.04, 0.14), rr(R, 0.01, 0.04), rr(R, 0.04, 0.2), rr(R, b0.min.x - 0.2, b0.max.x + 0.2), 0.015, rr(R, b0.min.z - 0.2, b0.max.z + 0.3), src.f, src.c, 0, R() * 3, 0);
    }
    mdGround(L);
  }
}

/* ------------------------------------------------------------- familles -- */
const MD = { n: 0, fams: new Map() };
/* Famille de modèles. sp :
   key, famName, cat, axes [[[clé, libellé, params], …], …] (une à trois listes), states (liste ou fn(vars)),
   nm(vars) → nom de base, gp(vars) → [genre 'f'|'m', pluriel], build(vars) → (P) => …, opts(vars) →
   { solid, wall, foot }, mat(vars) → matière dominante (filtre Matière), tags. */
function mdFam(sp) {
  const axes = sp.axes || [[[null, '', {}]]];
  const combos = [[]];
  for (const ax of axes) { const next = []; for (const c of combos) for (const v of ax) next.push(c.concat([v])); combos.splice(0, combos.length, ...next); }
  for (const vars of combos) {
    const states = typeof sp.states === 'function' ? sp.states(vars) : sp.states || ['n'];
    for (const st of states) {
      const W = MD_WEAR[st];
      const [g, pl] = sp.gp ? sp.gp(vars) : [sp.g || 'm', !!sp.pl];
      const base = sp.nm(vars);
      const name = W[1] ? `${base} · ${gxAcc(W[1], g === 'f', pl)}` : base;
      const id = `gm_${sp.key}${vars.map((v) => (v[0] ? `_${v[0]}` : '')).join('')}${st === 'n' ? '' : `_${st}`}`;
      if (MODELS[id]) console.warn(`Modèle en double : ${id}`);
      // identifiant stable écrit dans les cartes : minuscules, chiffres et _ seulement
      if (!/^gm_[a-z0-9_]+$/.test(id)) console.error(`Identifiant de modèle invalide : ${id}`);
      const build = sp.build(vars), o = (sp.opts ? sp.opts(vars, st) : sp.o) || {};
      const solid = st === 'x' && o.solid !== false ? true : o.solid;
      defModel(id, name, sp.cat, { solid, wall: st === 'x' ? false : o.wall, foot: st === 'x' || st === 'c' ? null : o.foot }, (P) => { build(P); mdState(P, st); });
      const d = MODELS[id];
      d.src = 'gen'; d.fam = sp.key; d.famName = sp.famName; d.state = W[0]; d.mat = sp.mat ? sp.mat(vars) : sp.m || null;
      if (sp.tags) d.tags = typeof sp.tags === 'function' ? sp.tags(vars) : sp.tags;
      MD.n++;
      if (!MD.fams.has(sp.key)) MD.fams.set(sp.key, { name: sp.famName, cat: sp.cat, n: 0 });
      MD.fams.get(sp.key).n++;
    }
  }
}

/* --------------------------------------------------- pièces de mobilier -- */
/* Quatre pieds (carrés, ronds ou tournés) sous un plateau w × d à la hauteur h. */
function mdLegs(P, w, d, h, r, f, c, inset = 0.05, kind = 'carre') {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset - r / 2), z = sz * (d / 2 - inset - r / 2);
    if (kind === 'rond') P.c(r / 2, h, x, h / 2, z, f, c, 0, 0, 0, 10);
    else if (kind === 'tourne') { P.t(r * 0.32, r * 0.5, h * 0.55, x, h * 0.275, z, f, c, 0, 0, 0, 10); P.s(r * 0.55, x, h * 0.6, z, f, c, 1, 1.1, 1, 10); P.t(r * 0.5, r * 0.36, h * 0.38, x, h * 0.81, z, f, c, 0, 0, 0, 10); }
    else if (kind === 'fuse') P.t(r * 0.5, r * 0.28, h, x, h / 2, z, f, c, 0, 0, 0, 10);
    else P.b(r, h, r, x, h / 2, z, f, c);
  }
}
/* Meuble en caisse : w × h × d, pieds (legs) ou socle, portes (doors), tiroirs (drawers), corniche,
   vitrine (glass), poignées. Façade vers +z. */
function mdCabinet(P, o) {
  const { w, h, d, f = 'wood', c } = o, c2 = o.c2 || mdShade(c, 1.08), legs = o.legs || 0, y0 = legs, H = h - legs, k = o.knob || 0xb09060;
  if (legs) mdLegs(P, w, d, legs, 0.05, f, mdShade(c, 0.85), 0.02, o.legKind || 'carre');
  else P.b(w - 0.04, 0.06, d - 0.04, 0, 0.03, 0, f, mdShade(c, 0.7));
  P.b(w, H - (legs ? 0 : 0.06), d, 0, y0 + (legs ? 0 : 0.06) + (H - (legs ? 0 : 0.06)) / 2, 0, f, c);
  if (o.top !== false) P.b(w + 0.04, 0.035, d + 0.03, 0, h + 0.0175, 0.005, f, mdShade(c, 0.9));
  if (o.cornice) P.b(w + 0.08, 0.07, d + 0.05, 0, h + 0.07, 0.01, f, mdShade(c, 0.8));
  const fz = d / 2 + 0.008;
  let y = y0 + 0.08;
  const top = h - 0.05;
  const rows = o.drawers || 0, dh = rows ? Math.min(0.24, (top - y) / (rows + (o.doors ? 1.6 : 0))) : 0;
  for (let i = 0; i < rows; i++) {
    const yy = top - (i + 0.5) * dh;
    P.b(w - 0.06, dh - 0.03, 0.02, 0, yy, fz, f, c2);
    if (w > 0.7) for (const x of [-w / 4, w / 4]) P.b(0.1, 0.018, 0.02, x, yy, fz + 0.015, 'metal', k); else P.s(0.018, 0, yy, fz + 0.015, 'metal', k);
  }
  const dTop = top - rows * dh, n = o.doors || 0;
  if (n) {
    const dw = (w - 0.06) / n, dhh = dTop - y - 0.02;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.03 + dw * (i + 0.5);
      if (o.glass) { P.b(dw - 0.03, dhh, 0.02, x, y + dhh / 2, fz, f, c2); P.b(dw - 0.11, dhh - 0.11, 0.022, x, y + dhh / 2, fz + 0.003, 'glass', 0x9fb8c0); }
      else { P.b(dw - 0.03, dhh, 0.02, x, y + dhh / 2, fz, f, c2); P.b(dw - 0.1, dhh - 0.1, 0.006, x, y + dhh / 2, fz + 0.012, f, mdShade(c2, 0.92)); }
      P.b(0.02, 0.1, 0.02, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), y + dhh * 0.55, fz + 0.02, 'metal', k);
    }
  }
}
/* Chaise : style 'bistrot', 'paille', 'salon' (bois c, tissu c2) ; 'ecole', 'pliante' (cadre de métal c) ;
   'cuisine', 'bar' (chrome, assise de skaï c) ; 'jardin' (plastique c). */
function mdChair(P, s, c, c2) {
  const W = mdShade(c, 0.85), CH = 0xb4b6b8;
  if (s === 'bistrot') {
    P.c(0.2, 0.04, 0, 0.46, 0, 'wood', c, 0, 0, 0, 16);
    for (const a of [0.6, 2.2, 3.8, 5.4]) P.c(0.014, 0.46, Math.cos(a) * 0.15, 0.23, Math.sin(a) * 0.15, 'wood', W, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12, 8);
    P.o(0.12, 0.012, 0, 0.18, 0, 'wood', W, Math.PI / 2, 0, 0);
    P.o(0.19, 0.016, 0, 0.82, -0.08, 'wood', W, 0.25, 0, 0);
    for (const x of [-0.17, 0.17]) P.c(0.014, 0.4, x, 0.66, -0.15, 'wood', W, -0.15, 0, 0, 8);
    return;
  }
  if (s === 'bar') {
    P.c(0.19, 0.06, 0, 0.76, 0, 'plastic', c, 0, 0, 0, 14); P.c(0.03, 0.72, 0, 0.38, 0, 'metal', CH);
    P.c(0.2, 0.03, 0, 0.015, 0, 'metal', 0x6a6c6e, 0, 0, 0, 16); P.o(0.15, 0.012, 0, 0.3, 0, 'metal', CH, Math.PI / 2, 0, 0);
    return;
  }
  if (s === 'pliante') {
    for (const x of [-0.19, 0.19]) { boxBetween(P, 'metal', c, [x, 0, 0.2], [x, 0.85, -0.18], 0.025); boxBetween(P, 'metal', c, [x, 0, -0.2], [x, 0.45, 0.18], 0.025); }
    P.b(0.42, 0.03, 0.38, 0, 0.45, 0.01, 'wood', 0xa07a50); P.b(0.4, 0.2, 0.02, 0, 0.75, -0.15, 'wood', 0xa07a50, -0.15, 0, 0);
    return;
  }
  const metal = s === 'ecole' || s === 'cuisine', f = metal ? 'metal' : s === 'jardin' ? 'plastic' : 'wood';
  const lc = s === 'ecole' ? c : s === 'cuisine' ? CH : s === 'jardin' ? c : W, r = metal ? 0.024 : 0.04;
  mdLegs(P, 0.44, 0.42, 0.45, r, f, lc, 0.01, metal ? 'rond' : s === 'salon' ? 'fuse' : 'carre');
  const seatF = s === 'salon' ? 'fabric' : s === 'paille' ? 'paper' : s === 'ecole' ? 'wood' : s === 'cuisine' ? 'plastic' : f;
  const seatC = s === 'paille' ? 0xc8a860 : s === 'salon' ? c2 || 0x6a2a2a : s === 'ecole' ? 0xb08a5c : c;
  P.b(0.45, s === 'salon' || s === 'cuisine' ? 0.07 : 0.035, 0.43, 0, 0.465, 0, seatF, seatC);
  if (s === 'paille') for (const z of [-0.18, 0.18]) P.b(0.42, 0.02, 0.02, 0, 0.2, z, 'wood', W);
  const bh = s === 'salon' ? 0.5 : 0.45;
  for (const x of [-0.2, 0.2]) P.b(r, bh, r, x, 0.47 + bh / 2, -0.195, f, lc);
  if (s === 'ecole') P.b(0.4, 0.16, 0.02, 0, 0.8, -0.2, 'wood', 0xb08a5c);
  else if (s === 'cuisine') P.b(0.4, 0.22, 0.05, 0, 0.78, -0.2, 'plastic', c);
  else if (s === 'paille') for (const y of [0.68, 0.8, 0.9]) P.b(0.4, 0.04, 0.02, 0, y, -0.195, 'wood', c);
  else if (s === 'salon') P.b(0.38, 0.38, 0.05, 0, 0.72, -0.19, 'fabric', c2 || 0x6a2a2a);
  else if (s === 'jardin') { P.b(0.44, 0.4, 0.02, 0, 0.7, -0.19, 'plastic', c, -0.12, 0, 0); for (const y of [0.62, 0.72, 0.82]) P.b(0.32, 0.03, 0.025, 0, y, -0.185, 'plastic', mdShade(c, 0.8), -0.12, 0, 0); }
  else for (const y of [0.62, 0.86]) P.b(0.4, 0.07, 0.02, 0, y, -0.195, f, c);
}
/* Canapé / fauteuil : places, couleur du tissu, style ('club', 'droit', 'chesterfield'). */
function mdSofa(P, n, c, style, wood = 0x3e2a1c) {
  const w = n * 0.68 + 0.3, d = 0.9, fab = style === 'cuir' ? 'plastic' : 'fabric';
  mdLegs(P, w - 0.1, d - 0.1, 0.1, 0.06, 'wood', wood, 0.02, 'fuse');
  P.b(w, 0.3, d, 0, 0.25, 0, fab, c);
  P.b(w, style === 'club' ? 0.42 : 0.5, 0.22, 0, 0.62, -0.34, fab, mdShade(c, 0.94), style === 'club' ? -0.08 : 0, 0, 0);
  for (const x of [-1, 1]) {
    if (style === 'chesterfield') { P.b(0.18, 0.42, d, x * (w / 2 - 0.09), 0.5, 0, fab, mdShade(c, 0.9)); P.c(0.11, d, x * (w / 2 - 0.09), 0.72, 0, fab, mdShade(c, 0.9), Math.PI / 2, 0, 0, 12); }
    else P.b(0.18, style === 'club' ? 0.5 : 0.36, d, x * (w / 2 - 0.09), style === 'club' ? 0.5 : 0.46, 0, fab, mdShade(c, 0.9));
  }
  for (let i = 0; i < n; i++) P.b(0.64, 0.13, 0.62, -w / 2 + 0.18 + 0.66 * (i + 0.5), 0.465, 0.08, fab, mdShade(c, 1.06));
  if (style === 'chesterfield') for (let i = 0; i < n * 3; i++) P.s(0.012, -w / 2 + 0.25 + (i * (w - 0.5)) / Math.max(1, n * 3 - 1), 0.75, -0.225, 'fabric', mdShade(c, 0.6));
}
/* Lit : largeur, couleur des draps, cadre (bois ou métal). */
function mdBed(P, wd, sheet, frame, f = 'wood', made = true) {
  const L = 2.0;
  if (f === 'metal') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.c(0.02, sz < 0 ? 1.0 : 0.75, sx * wd / 2, sz < 0 ? 0.5 : 0.375, sz * L / 2, 'metal', frame); for (const z of [-L / 2, L / 2]) for (let i = 0; i < 6; i++) P.c(0.01, z < 0 ? 0.55 : 0.32, -wd / 2 + (wd * (i + 0.5)) / 6, z < 0 ? 0.7 : 0.55, z, 'metal', frame); }
  else { P.b(wd + 0.06, 1.0, 0.06, 0, 0.5, -L / 2, 'wood', frame); P.b(wd + 0.06, 0.55, 0.06, 0, 0.275, L / 2, 'wood', frame); for (const x of [-1, 1]) P.b(0.05, 0.2, L, x * (wd / 2 + 0.005), 0.3, 0, 'wood', mdShade(frame, 0.9)); }
  P.b(wd, 0.06, L - 0.04, 0, 0.3, 0, f, mdShade(frame, 0.85));
  P.b(wd - 0.04, 0.18, L - 0.08, 0, 0.42, 0, 'fabric', 0xd8d2c4);
  for (let i = 0; i < (wd > 1.2 ? 2 : 1); i++) P.b(wd > 1.2 ? wd / 2 - 0.08 : wd - 0.2, 0.12, 0.36, wd > 1.2 ? (i - 0.5) * wd / 2 : 0, 0.57, -L / 2 + 0.3, 'fabric', 0xe8e2d4);
  if (made) P.b(wd + 0.02, 0.05, L * 0.66, 0, 0.53, L * 0.15, 'fabric', sheet);
  else P.b(wd * 0.9, 0.08, L * 0.5, 0.1, 0.55, L * 0.12, 'fabric', sheet, 0.05, 0.25, 0.04);
}

/* --------------------------------------------------------- véhicules -- */
/* Carrosserie simple (épaves) : type 'berline', 'break', 'coupe', 'pickup', 'fourgon', 'citadine', 'jeep'. */
function mdCar(P, type, col, o = {}) {
  const R = P.R, T = {
    berline: [4.4, 1.75, 0.72, 0.62, [-0.35, 0.95]], break: [4.6, 1.78, 0.72, 0.66, [-1.25, 0.95]], coupe: [4.2, 1.76, 0.66, 0.52, [-0.25, 0.75]],
    citadine: [3.6, 1.62, 0.74, 0.66, [-0.95, 0.7]], pickup: [5.0, 1.9, 0.86, 0.72, [0.15, 1.35]], fourgon: [4.9, 1.95, 0.9, 1.15, [-2.3, 1.6]], jeep: [3.8, 1.7, 0.8, 0.6, [-0.9, 0.55]],
  }[type];
  const [L, W, bh, ch, [c0, c1]] = T, y0 = 0.32;
  const paint = o.f || 'metal';
  // roues
  const wr = type === 'jeep' || type === 'pickup' ? 0.38 : 0.33;
  for (const sx of [-1, 1]) for (const z of [L * 0.31, -L * 0.31]) {
    if (o.noWheels && R() < 0.5) continue;
    P.c(wr, 0.24, sx * (W / 2 - 0.12), wr, z, 'rubber', 0x1a1a1a, 0, 0, Math.PI / 2, 14);
    P.c(wr * 0.55, 0.25, sx * (W / 2 - 0.12), wr, z, 'metal', 0x8a8c8e, 0, 0, Math.PI / 2, 10);
  }
  // caisse : bas de caisse, capot, coffre
  P.b(W, bh, L, 0, y0 + bh / 2, 0, paint, col);
  P.b(W * 0.98, 0.06, L * 0.995, 0, y0 + bh + 0.01, 0, paint, mdShade(col, 0.92));
  // habitacle
  const cl = c1 - c0, cz = (c0 + c1) / 2;
  if (type === 'pickup' || type === 'jeep') {
    if (type === 'jeep') { for (const sx of [-1, 1]) boxBetween(P, 'metal', 0x2a2a2a, [sx * W * 0.44, y0 + bh, c1], [sx * W * 0.44, y0 + bh + ch, c1 - 0.1], 0.04); P.b(W * 0.9, 0.04, 0.06, 0, y0 + bh + ch, c1 - 0.1, 'metal', 0x2a2a2a); P.b(W * 0.86, 0.36, 0.04, 0, y0 + bh + 0.2, c1 - 0.05, 'glass', 0x6a8090, -0.2, 0, 0); }
    else { P.b(W * 0.92, ch, cl, 0, y0 + bh + ch / 2, cz, paint, col); P.b(W * 0.86, ch * 0.7, 0.02, 0, y0 + bh + ch * 0.5, c1 + 0.005, 'glass', 0x40505a, -0.3, 0, 0); for (const sx of [-1, 1]) P.b(0.02, ch * 0.6, cl * 0.8, sx * W * 0.46, y0 + bh + ch * 0.55, cz, 'glass', 0x40505a); }
    if (type === 'pickup') { const bl = c0 - 0.05 - (-L / 2 + 0.05), bz = (c0 - 0.05 + (-L / 2 + 0.05)) / 2; for (const sx of [-1, 1]) P.b(0.06, 0.4, bl, sx * (W / 2 - 0.03), y0 + bh + 0.2, bz, paint, col); P.b(W, 0.4, 0.06, 0, y0 + bh + 0.2, -L / 2 + 0.05, paint, col); }
  } else {
    const top = ch, inset = type === 'fourgon' ? 0.02 : 0.12;
    P.b(W - inset * 2, top, cl, 0, y0 + bh + top / 2 + 0.03, cz, paint, col);
    P.b(W - inset * 2 - 0.04, top * 0.62, 0.02, 0, y0 + bh + top * 0.55, c1 + (type === 'fourgon' ? 0.005 : 0.02), 'glass', 0x3a4a54, type === 'fourgon' ? -0.15 : -0.5, 0, 0);
    P.b(W - inset * 2 - 0.04, top * 0.6, 0.02, 0, y0 + bh + top * 0.55, c0 - 0.01, 'glass', 0x3a4a54, 0.35, 0, 0);
    for (const sx of [-1, 1]) P.b(0.02, top * 0.55, cl * 0.88, sx * (W / 2 - inset + 0.005), y0 + bh + top * 0.6, cz, 'glass', 0x3a4a54);
  }
  // phares, calandre, pare-chocs
  for (const sx of [-1, 1]) { P.c(0.08, 0.04, sx * W * 0.34, y0 + bh * 0.62, L / 2 + 0.01, 'glass', 0xd8dcd0, Math.PI / 2, 0, 0, 10); P.b(0.14, 0.06, 0.03, sx * W * 0.36, y0 + bh * 0.6, -L / 2 - 0.005, 'plastic', 0x8a1a14); }
  P.b(W * 0.4, bh * 0.35, 0.02, 0, y0 + bh * 0.55, L / 2 + 0.006, 'metal', 0x3a3a3a);
  for (const z of [L / 2 + 0.05, -L / 2 - 0.05]) P.b(W * 1.0, 0.12, 0.08, 0, y0 + 0.08, z, 'metal', 0x6a6c6e);
}
