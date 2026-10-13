'use strict';
/* =========================================================================
   Mod Tools — navigateurs de textures et de modèles (launcher 1.3.3)
   Demande d'Anthony du 12 octobre 2026 au soir, avec une capture du
   navigateur de textures de Radiant : une fenêtre qui reste ouverte pendant
   le travail, des milliers de vignettes, « Toutes · Sur la carte · Favoris ·
   Récentes », recherche par nom, filtres (textures : usage, origine, surface,
   matière ; modèles : catégorie, famille, matière, taille, état), taille des
   vignettes, et sous chaque vignette son nom, sa résolution (ou ses cotes) et
   son genre. Clic : choisir ; double-clic : peindre avec (textures) ou poser
   (modèles) ; boutons : appliquer à la sélection, remplacer, favori. Liste
   virtuelle : seules les vignettes visibles existent dans la page ; les
   vignettes viennent de thumbs.js (cache IndexedDB).
   Métadonnées : celles du moteur (jeu 2.0.4 : use, surf, mat, src, fam, state,
   dims), sinon déduites de la catégorie, de la rugosité, de l'identifiant.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS;
  const { h, clamp, debounce, slug, round } = MT.util;
  const S = MT.state, UI = MT.ui;
  const B = (MT.browser = { win: {} });
  const PREF = 'mt.browser';
  const decFr = (v, d = 2) => String(round(v, d)).replace('.', ',');
  const norm = (t) => slug(t, 200).replace(/-/g, ' ');

  /* ---------------------------------------------------------- facettes -- */
  const F = () => ZS.LIB_FACETS || {};
  const TEX_USE = () => F().texUse || [['mur', 'Murs'], ['sol', 'Sols'], ['plafond', 'Plafonds'], ['toit', 'Toits'], ['ext', 'Extérieur'], ['deco', 'Décor, spécial']];
  const TEX_SURF = () => F().texSurf || [['brique', 'Brique'], ['pierre', 'Pierre'], ['beton', 'Béton, enduit'], ['peinture', 'Peinture'], ['carrelage', 'Carrelage'], ['bois', 'Bois'], ['metal', 'Métal'], ['tissu', 'Tissu, papier peint'], ['souple', 'Moquette, lino, caoutchouc'], ['terre', 'Terre, sable, roche'], ['vegetal', 'Végétal'], ['toiture', 'Toiture'], ['verre', 'Verre, eau'], ['special', 'Spécial'], ['image', 'Image importée']];
  const TEX_MAT = () => F().texMat || [['mat', 'Mate'], ['satine', 'Satinée'], ['brillant', 'Brillante'], ['metal', 'Métallique'], ['lumineux', 'Lumineuse']];
  const TEX_SRC = () => F().texSrc || [['bunker7', 'Bunker 7'], ['khamsin', 'Khamsin'], ['ombre', 'Ombre éternelle'], ['biblio', 'Bibliothèque'], ['gen', 'Générées (jeu 2.0.4)'], ['import', 'Mes images'], ['variant', 'Variantes (carte)']];
  const MOD_MAT = () => F().modMat || [['bois', 'Bois'], ['metal', 'Métal'], ['plastique', 'Plastique, caoutchouc'], ['tissu', 'Tissu, cuir'], ['pierre', 'Pierre, béton'], ['verre', 'Verre'], ['papier', 'Papier, carton'], ['vegetal', 'Végétal'], ['organique', 'Organique'], ['peint', 'Peint'], ['lumiere', 'Lumineux']];
  const MOD_SIZE = [['s', 'Petit (moins de 0,6 m)'], ['m', 'Moyen (0,6 à 1,6 m)'], ['l', 'Grand (1,6 à 4 m)'], ['xl', 'Très grand (plus de 4 m)']];
  const MOD_STATE = () => F().modState || [['neuf', 'Neuf'], ['use', 'Usé'], ['abime', 'Abîmé, cassé'], ['renverse', 'Renversé, penché'], ['brule', 'Brûlé'], ['sang', 'Ensanglanté'], ['rouille', 'Rouillé'], ['mousse', 'Moussu'], ['neige', 'Enneigé'], ['eteint', 'Éteint']];
  const TEX_STATE = () => F().texState || [['neuf', 'Neuf, propre'], ['use', 'Usé, vieilli'], ['sale', 'Sale, taché'], ['abime', 'Fissuré, cassé, écaillé'], ['mousse', 'Moussu, pourri'], ['brule', 'Brûlé, suie'], ['sang', 'Ensanglanté'], ['eau', 'Humide, mouillé'], ['rouille', 'Rouillé, patiné'], ['gel', 'Gelé, enneigé']];
  const TEX_HUE = () => F().texHue || [['blanc', 'Blanc'], ['gris', 'Gris'], ['noir', 'Noir'], ['beige', 'Beige, sable'], ['brun', 'Brun'], ['rouge', 'Rouge'], ['orange', 'Orange'], ['jaune', 'Jaune'], ['vert', 'Vert'], ['bleu', 'Bleu'], ['violet', 'Violet'], ['rose', 'Rose'], ['multi', 'Plusieurs couleurs']];
  const CAT_SURF = { peint: 'peinture', beton: 'beton', brique: 'brique', toit: 'toiture', carrelage: 'carrelage', bois: 'bois', metal: 'metal', papier: 'tissu', sol: 'souple', plafond: 'beton', exterieur: 'terre', special: 'special', verre: 'verre', import: 'image' };
  const CAT_USE = { peint: ['mur'], beton: ['mur', 'sol'], brique: ['mur'], toit: ['toit'], carrelage: ['mur', 'sol'], bois: ['mur', 'sol'], metal: ['mur', 'sol'], papier: ['mur'], sol: ['sol'], plafond: ['plafond'], exterieur: ['ext', 'sol'], special: ['deco'], verre: ['deco'], import: ['mur', 'sol'] };
  const FAMILY_MAT = { wood: 'bois', crate: 'bois', bark: 'vegetal', metal: 'metal', rust: 'metal', fabric: 'tissu', stone: 'pierre', concrete: 'pierre', plastic: 'plastique', rubber: 'plastique', paper: 'papier', foliage: 'vegetal', vine: 'vegetal', ivy: 'vegetal', moss: 'vegetal', fern: 'vegetal', glass: 'verre', liquid: 'verre', skin: 'organique', glow: 'lumiere', paint: 'peint' };
  const META = new WeakMap();
  let bunkerTex = null;
  function bunkerSet() {
    if (bunkerTex) return bunkerTex;
    bunkerTex = new Set();
    try {
      const m = ZS.BUNKER7;
      for (const id of Object.values(m.textures || {})) bunkerTex.add(id);
      for (const id of m.palette || []) bunkerTex.add(id);
      for (const z of m.zones || []) for (const L of ['floor', 'wall', 'ceil']) if (z[L]) bunkerTex.add(z[L]);
    } catch (e) { /* rien */ }
    return bunkerTex;
  }
  function texMeta(d) {
    let q = META.get(d);
    if (q) return q;
    const id = d.id || '';
    const src = d.variant ? 'variant' : d.custom ? 'import' : d.src || (id.startsWith('kh_') ? 'khamsin' : id.startsWith('lu_') ? 'ombre' : bunkerSet().has(id) ? 'bunker7' : 'biblio');
    const surf = d.surf || (d.image ? 'image' : /stone|pierre|granit|cobble|rock|slate|marble|basalt|sandstone|limestone|pyrstone/.test(id) && d.cat !== 'exterieur' ? 'pierre' : CAT_SURF[d.cat] || 'special');
    const use = d.use || CAT_USE[d.cat] || ['mur'];
    const mat = d.mat || ((d.metal || 0) >= 0.45 ? 'metal' : d.rough < 0.35 ? 'brillant' : d.rough < 0.7 ? 'satine' : 'mat');
    const px = d.px || 512, pxh = Math.max(1, Math.round((px * (d.size ? d.size[1] : 1)) / (d.size ? d.size[0] : 1)));
    q = { src, surf, use, mat, state: d.state || null, hue: d.hue || null, fam: d.fam || null, famName: d.famName || null, res: d.image ? 'image importée' : `${px} × ${pxh}`, text: norm(`${d.name} ${id} ${d.famName || ''} ${d.tags || ''}`) };
    META.set(d, q);
    return q;
  }
  function modMeta(d) {
    let q = META.get(d);
    if (q && q.full) return q;
    if (!q) {
      // objets d'avant le jeu 2.0.4 (sans famille) : une famille par catégorie, « jeu 1.x » ; modèles importés : « Mes modèles »
      const fam = d.fam || (d.glb ? 'import' : `jeu1_${d.cat}`);
      q = { cat: d.cat, fam, famName: d.famName || null, glb: !!d.glb, state: d.state || null, mat: d.mat || null, dims: d.dims || null, text: norm(`${d.name} ${d.id} ${d.famName || ''} ${d.tags || ''}`) };
      META.set(d, q);
    }
    return q;
  }
  /* Ce qui demande les pièces du modèle (cotes, matière dominante) : à la demande seulement. */
  function modFull(d) {
    const q = modMeta(d);
    if (q.full) return q;
    q.full = true;
    try {
      if (!q.dims) {
        const b = MT.modelBox(d.id);
        q.dims = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      }
      if (!q.mat && !d.glb) {
        const info = ZS.modelParts(d.id), count = {};
        for (const p of (info && info.parts) || []) { const k = FAMILY_MAT[p.f] || 'peint'; count[k] = (count[k] || 0) + 1; }
        q.mat = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || 'peint';
      }
    } catch (e) { /* modèle illisible */ }
    if (!q.mat) q.mat = 'plastique';
    return q;
  }
  const sizeOf = (dims) => { const m = Math.max(...(dims || [1, 1, 1])); return m < 0.6 ? 's' : m < 1.6 ? 'm' : m < 4 ? 'l' : 'xl'; };
  const labelOf = (list, k) => { const r = list.find((x) => x[0] === k); return r ? r[1] : k; };
  const catLabel = (k) => (ZS.MODEL_CATS.find((c) => c[0] === k) || [k, k])[1];
  const famLabel = (q) => q.famName || (q.glb ? 'Mes modèles' : `${catLabel(q.cat)} · jeu 1.x`);

  /* ------------------------------------------------------- préférences -- */
  const FAV = { tex: new Set(), model: new Set() };
  const ST = {
    tex: { view: 'all', q: '', f: { use: '', src: '', surf: '', fam: '', mat: '', hue: '', state: '' }, size: 112, sel: null, pos: null },
    model: { view: 'all', q: '', f: { cat: '', fam: '', mat: '', size: '', state: '' }, size: 120, sel: null, pos: null },
  };
  try {
    const p = JSON.parse(localStorage.getItem(PREF) || '{}');
    for (const k of ['tex', 'model']) {
      if (p[k]) { Object.assign(ST[k].f, p[k].f || {}); if (['all', 'map', 'fav', 'recent'].includes(p[k].view)) ST[k].view = p[k].view; if (Number.isFinite(p[k].size)) ST[k].size = clamp(p[k].size, 64, 256); if (p[k].pos) ST[k].pos = p[k].pos; }
      const fav = JSON.parse(localStorage.getItem(`mt.fav.${k}`) || '[]');
      if (Array.isArray(fav)) for (const id of fav) if (typeof id === 'string') FAV[k].add(id);
    }
  } catch (e) { /* réglages par défaut */ }
  const savePref = debounce(() => {
    try {
      const o = {};
      for (const k of ['tex', 'model']) o[k] = { view: ST[k].view, f: ST[k].f, size: ST[k].size, pos: ST[k].pos };
      localStorage.setItem(PREF, JSON.stringify(o));
      for (const k of ['tex', 'model']) localStorage.setItem(`mt.fav.${k}`, JSON.stringify([...FAV[k]]));
    } catch (e) { /* rien */ }
  }, 400);
  B.isFav = (kind, id) => FAV[kind].has(id);
  B.toggleFav = (kind, id) => { if (FAV[kind].has(id)) FAV[kind].delete(id); else FAV[kind].add(id); savePref(); refresh(kind, false); };

  /* --------------------------------------------- ce qui est sur la carte -- */
  function usedTex() {
    const m = S.map, out = new Set();
    if (!m) return out;
    if (!m.open) { try { for (const id of MT.usedTextures(m)) out.add(id); } catch (e) { /* rien */ } return out; }
    try { for (const d of MT.ow.placeDesc()) for (const t of d.mats || []) out.add(t); } catch (e) { /* rien */ }
    for (const e of Object.values(m.placeEdits || {})) for (const q of Object.values((e && e.m) || {})) if (q && q.t) out.add(q.t);
    return out;
  }
  const usedModels = () => new Set(((S.map && S.map.props) || []).map((p) => p.m));

  /* ------------------------------------------------------------- liste -- */
  function items(kind) {
    const st = ST[kind], q = norm(st.q).trim(), words = q ? q.split(' ').filter(Boolean) : [];
    let list;
    if (kind === 'tex') {
      list = Object.values(ZS.TEXLIB);
      if (st.view === 'map') { const u = usedTex(); list = list.filter((d) => u.has(d.id)); }
      else if (st.view === 'fav') list = list.filter((d) => FAV.tex.has(d.id));
      else if (st.view === 'recent') list = S.recent.tex.map((id) => ZS.TEXLIB[id]).filter(Boolean);
      const f = st.f;
      list = list.filter((d) => {
        const m = texMeta(d);
        if (f.use && !m.use.includes(f.use)) return false;
        if (f.src && m.src !== f.src) return false;
        if (f.surf && m.surf !== f.surf) return false;
        if (f.mat && m.mat !== f.mat) return false;
        if (f.fam && m.fam !== f.fam) return false;
        if (f.hue && m.hue !== f.hue) return false;
        if (f.state && m.state !== f.state) return false;
        return !words.length || words.every((w) => m.text.includes(w));
      });
    } else {
      list = Object.values(ZS.MODELS);
      if (st.view === 'map') { const u = usedModels(); list = list.filter((d) => u.has(d.id)); }
      else if (st.view === 'fav') list = list.filter((d) => FAV.model.has(d.id));
      else if (st.view === 'recent') list = S.recent.model.map((id) => ZS.MODELS[id]).filter(Boolean);
      const f = st.f;
      list = list.filter((d) => {
        const m = modMeta(d);
        if (f.cat && m.cat !== f.cat) return false;
        if (f.fam && m.fam !== f.fam) return false;
        if (f.state && m.state !== f.state) return false;
        if (words.length && !words.every((w) => m.text.includes(w))) return false;
        if (f.mat || f.size) {
          const full = modFull(d);
          if (f.mat && full.mat !== f.mat) return false;
          if (f.size && sizeOf(full.dims) !== f.size) return false;
        }
        return true;
      });
    }
    return list;
  }
  /* Familles proposées (textures) : celles de la surface choisie (bibliothèque du jeu 2.0.4). */
  function texFamilies() {
    const st = ST.tex, seen = new Map();
    for (const d of Object.values(ZS.TEXLIB)) {
      const m = texMeta(d);
      if (!m.fam || (st.f.surf && m.surf !== st.f.surf)) continue;
      if (!seen.has(m.fam)) seen.set(m.fam, { label: m.famName || m.fam, n: 0 });
      seen.get(m.fam).n++;
    }
    return [...seen.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'fr')).map(([k, v]) => [k, `${v.label} (${v.n})`]);
  }
  /* Familles proposées (modèles) : celles de la catégorie choisie. */
  function families() {
    const st = ST.model, seen = new Map();
    for (const d of Object.values(ZS.MODELS)) {
      const m = modMeta(d);
      if (st.f.cat && m.cat !== st.f.cat) continue;
      if (!seen.has(m.fam)) seen.set(m.fam, { label: famLabel(m), n: 0 });
      seen.get(m.fam).n++;
    }
    return [...seen.entries()].filter(([, v]) => v.n > 1 || st.f.fam).sort((a, b) => a[1].label.localeCompare(b[1].label, 'fr')).map(([k, v]) => [k, `${v.label} (${v.n})`]);
  }

  /* ---------------------------------------------------------- fenêtre -- */
  const sel = (value, options, onChange, all = 'Tous') => {
    const e = h('select', { class: 'f-select br-sel', onchange: () => onChange(e.value) }, h('option', { value: '' }, all), options.map(([k, l]) => h('option', { value: k, selected: k === value }, l)));
    return e;
  };
  function build(kind) {
    const st = ST[kind], tex = kind === 'tex';
    const W = { kind, el: null, grid: null, spacer: null, list: [], pool: new Map(), cols: 1, tileW: 0, tileH: 0, raf: 0 };
    const count = h('span', { class: 'br-count' });
    const search = h('input', { type: 'search', class: 'f-text br-search', placeholder: tex ? 'Filtrer par nom (brique rouge, carrelage, rouille…)' : 'Filtrer par nom (table, chaise, baril…)', value: st.q, spellcheck: false });
    search.addEventListener('input', debounce(() => { st.q = search.value; refresh(kind); }, 140));
    const views = h('div', { class: 'br-views', role: 'radiogroup' }, [['all', tex ? 'Toutes' : 'Tous'], ['map', 'Sur la carte'], ['fav', 'Favoris'], ['recent', tex ? 'Récentes' : 'Récents']].map(([v, l]) =>
      h('label', { class: 'br-radio' }, h('input', { type: 'radio', name: `br-view-${kind}`, value: v, checked: st.view === v, onchange: () => { st.view = v; savePref(); refresh(kind); } }), h('span', null, l))));
    const filters = h('div', { class: 'br-filters' });
    const drawFilters = () => {
      filters.textContent = '';
      const lab = (t, e) => h('label', { class: 'br-f' }, h('span', null, t), e);
      const set = (k) => (v) => { st.f[k] = v; if (k === 'cat' || (tex && k === 'surf')) st.f.fam = ''; savePref(); if (k === 'cat' || (tex && k === 'surf')) drawFilters(); refresh(kind); };
      if (tex) {
        filters.append(
          lab('Usage', sel(st.f.use, TEX_USE(), set('use'))), lab('Origine', sel(st.f.src, TEX_SRC(), set('src'), 'Toutes')),
          lab('Surface', sel(st.f.surf, TEX_SURF(), set('surf'), 'Toutes')), lab('Famille', sel(st.f.fam, texFamilies(), set('fam'), 'Toutes')),
          lab('Teinte', sel(st.f.hue, TEX_HUE(), set('hue'), 'Toutes')), lab('État', sel(st.f.state, TEX_STATE(), set('state'))), lab('Matière', sel(st.f.mat, TEX_MAT(), set('mat'), 'Toutes')));
      } else {
        filters.append(
          lab('Catégorie', sel(st.f.cat, ZS.MODEL_CATS.map(([k, l]) => [k, l]), set('cat'), 'Toutes')), lab('Famille', sel(st.f.fam, families(), set('fam'), 'Toutes')),
          lab('Matière', sel(st.f.mat, MOD_MAT(), set('mat'), 'Toutes')), lab('Taille', sel(st.f.size, MOD_SIZE, set('size'), 'Toutes')), lab('État', sel(st.f.state, MOD_STATE(), set('state'))));
      }
      filters.append(
        lab('Vignettes', h('input', { type: 'range', class: 'br-zoom', min: 64, max: 256, step: 8, value: st.size, oninput: (e) => { st.size = +e.target.value; savePref(); layout(W, true); } })),
        h('button', { type: 'button', class: 'mt-btn sm br-reset', title: 'Tous les filtres à « Tous » (la recherche aussi)', onclick: () => { for (const k of Object.keys(st.f)) st.f[k] = ''; st.q = ''; search.value = ''; savePref(); drawFilters(); refresh(kind); } }, 'Effacer les filtres'));
    };
    drawFilters();
    W.drawFilters = drawFilters;
    W.grid = h('div', { class: 'br-grid', tabindex: '0' });
    W.spacer = h('div', { class: 'br-spacer' });
    W.grid.append(W.spacer);
    W.grid.addEventListener('scroll', () => schedule(W), { passive: true });
    W.grid.addEventListener('keydown', (e) => onGridKey(W, e));
    const foot = h('footer', { class: 'br-foot' });
    W.foot = foot;
    const close = h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Fermer (Échap)', onclick: () => B.close(kind) }, UI.icon('close'));
    const head = h('header', { class: 'br-head' },
      UI.icon(tex ? 'texlib' : 'books'), h('h2', null, tex ? 'Textures' : 'Modèles'), count, h('span', { class: 'br-spacer-x' }),
      h('button', { type: 'button', class: 'mt-btn sm', title: 'Refaire les vignettes (après une mise à jour du jeu)', onclick: async () => { await MT.thumbs.clear(); for (const t of W.pool.values()) t.remove(); W.pool.clear(); schedule(W); MT.toast('Vignettes refaites à la demande.'); } }, 'Vignettes'),
      close);
    W.count = count;
    const el = h('section', { class: `br br-${kind}`, role: 'dialog', 'aria-label': tex ? 'Navigateur de textures' : 'Navigateur de modèles', tabindex: '-1' },
      head, h('div', { class: 'br-bar' }, views, search), filters, W.grid, foot);
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); B.close(kind); } });
    // déplacer par la barre de titre ; taille par le coin (CSS resize)
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      head.setPointerCapture(e.pointerId);
      const mv = (ev) => { el.style.left = `${clamp(ev.clientX - dx, 0, innerWidth - 120)}px`; el.style.top = `${clamp(ev.clientY - dy, 0, innerHeight - 60)}px`; };
      const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); remember(W); };
      head.addEventListener('pointermove', mv);
      head.addEventListener('pointerup', up);
    });
    new ResizeObserver(() => { layout(W, true); remember(W); }).observe(el);
    W.el = el;
    W.search = search;
    return W;
  }
  function remember(W) {
    const r = W.el.getBoundingClientRect();
    if (r.width > 50) { ST[W.kind].pos = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; savePref(); }
  }
  B.open = (kind = 'tex') => {
    if (!S.map) return;
    let W = B.win[kind];
    if (!W) {
      W = B.win[kind] = build(kind);
      document.body.append(W.el);
      const p = ST[kind].pos, vw = innerWidth, vh = innerHeight;
      const [x, y, w, hh] = p && p[2] > 200 ? p : kind === 'tex' ? [64, 70, Math.min(1080, vw - 420), Math.min(700, vh - 120)] : [96, 90, Math.min(1080, vw - 420), Math.min(700, vh - 130)];
      Object.assign(W.el.style, { left: `${clamp(x, 0, vw - 200)}px`, top: `${clamp(y, 0, vh - 120)}px`, width: `${clamp(w, 520, vw)}px`, height: `${clamp(hh, 360, vh)}px` });
    }
    W.el.hidden = false;
    W.el.style.zIndex = String(++B.z);
    document.body.classList.add(`mt-br-${kind}`);
    refresh(kind);
    requestAnimationFrame(() => W.search.focus({ preventScroll: true }));
    return W;
  };
  B.z = 80;
  B.close = (kind) => { const W = B.win[kind]; if (W) W.el.hidden = true; document.body.classList.remove(`mt-br-${kind}`); };
  B.toggle = (kind) => { const W = B.win[kind]; if (W && !W.el.hidden) B.close(kind); else B.open(kind); };
  B.isOpen = (kind) => !!(B.win[kind] && !B.win[kind].el.hidden);
  function refresh(kind, resetScroll = true) {
    const W = B.win[kind];
    if (!W || W.el.hidden) return;
    W.list = items(kind);
    W.count.textContent = `${W.list.length.toLocaleString('fr-BE')} ${kind === 'tex' ? 'texture' : 'modèle'}${W.list.length > 1 ? 's' : ''}${ST[kind].view === 'map' ? ' sur la carte' : ''} · ${(kind === 'tex' ? Object.keys(ZS.TEXLIB).length : Object.keys(ZS.MODELS).length).toLocaleString('fr-BE')} en tout`;
    for (const t of W.pool.values()) t.remove();
    W.pool.clear();
    if (resetScroll) W.grid.scrollTop = 0;
    layout(W, true);
    drawFoot(kind);
  }
  B.refresh = refresh;

  /* --------------------------------------------------- liste virtuelle -- */
  function layout(W, force) {
    const st = ST[W.kind], gw = W.grid.clientWidth - 12, gap = 6;
    const tileW = st.size + 8, tileH = st.size + (W.kind === 'tex' ? 58 : 58);
    const cols = Math.max(1, Math.floor((gw + gap) / (tileW + gap)));
    if (force || cols !== W.cols || tileW !== W.tileW) {
      if (tileW !== W.tileW || tileH !== W.tileH) { for (const t of W.pool.values()) t.remove(); W.pool.clear(); }
      W.cols = cols; W.tileW = tileW; W.tileH = tileH; W.gap = gap;
      W.spacer.style.height = `${Math.ceil(W.list.length / cols) * (tileH + gap) + 8}px`;
    }
    draw(W);
  }
  function schedule(W) { if (!W.raf) W.raf = requestAnimationFrame(() => { W.raf = 0; draw(W); }); }
  function draw(W) {
    const { cols, tileW, tileH, gap } = W, top = W.grid.scrollTop, hgt = W.grid.clientHeight;
    const r0 = Math.max(0, Math.floor(top / (tileH + gap)) - 2), r1 = Math.ceil((top + hgt) / (tileH + gap)) + 2;
    const i0 = r0 * cols, i1 = Math.min(W.list.length, (r1 + 1) * cols);
    for (const [i, t] of W.pool) if (i < i0 || i >= i1) { t.remove(); W.pool.delete(i); }
    for (let i = i0; i < i1; i++) {
      if (W.pool.has(i)) continue;
      const d = W.list[i];
      if (!d) continue;
      const t = tile(W, d, i);
      t.style.transform = `translate(${6 + (i % cols) * (tileW + gap)}px, ${6 + Math.floor(i / cols) * (tileH + gap)}px)`;
      t.style.width = `${tileW}px`; t.style.height = `${tileH}px`;
      W.spacer.append(t);
      W.pool.set(i, t);
    }
  }
  function tile(W, d, i) {
    const kind = W.kind, st = ST[kind], tex = kind === 'tex', px = st.size > 140 ? (tex ? 256 : 224) : tex ? 128 : 160;
    const on = st.sel === d.id;
    let info = '', type = '';
    if (tex) {
      const q = texMeta(d);
      info = `${q.res}${d.size ? ` · ${decFr(d.size[0])} × ${decFr(d.size[1])} m` : ''}`;
      type = `${labelOf(TEX_SURF(), q.surf)} · ${q.state && q.state !== 'neuf' ? labelOf(TEX_STATE(), q.state).split(',')[0].toLowerCase() : labelOf(TEX_MAT(), q.mat).toLowerCase()}`;
    } else {
      const q = modMeta(d);
      const dims = q.dims || (q.full ? q.dims : null);
      info = dims ? `${decFr(dims[0])} × ${decFr(dims[1])} × ${decFr(dims[2])} m` : '';
      type = `${famLabel(q)}${q.state ? ` · ${labelOf(MOD_STATE(), q.state).toLowerCase()}` : ''}`;
    }
    const img = h('span', { class: 'br-img', style: { width: `${st.size}px`, height: `${st.size}px` } });
    const t = h('button', {
      type: 'button', class: `br-tile ${on ? 'on' : ''}`, title: `${d.name}\n${d.id}${info ? `\n${info}` : ''}`, dataset: { id: d.id, i: String(i) },
      onclick: () => choose(kind, d.id), ondblclick: () => primary(kind, d.id),
    }, img, FAV[kind].has(d.id) ? h('i', { class: 'br-star', title: 'Favori' }, '★') : null,
    h('span', { class: 'br-name' }, d.name), h('span', { class: 'br-info' }, info || (tex ? '' : '…')), h('span', { class: 'br-type' }, type));
    // glisser une vignette vers le plan ou la 3D : poser l'objet là (modèles) ; peindre ou appliquer (textures)
    t.draggable = true;
    t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/zs-lib', `${kind}:${d.id}`); e.dataTransfer.effectAllowed = 'copy'; });
    // fenêtre fermée : les vignettes en attente ne sont plus faites (elles le seront à la réouverture)
    MT.thumbs.get(tex ? 'tex' : 'model', d.id, px, () => t.isConnected && !W.el.hidden).then((url) => {
      if (url) img.style.backgroundImage = `url(${url})`;
      if (!tex && !info && t.isConnected) { const q = modFull(d); if (q.dims) t.querySelector('.br-info').textContent = `${decFr(q.dims[0])} × ${decFr(q.dims[1])} × ${decFr(q.dims[2])} m`; }
    });
    return t;
  }
  function choose(kind, id) {
    ST[kind].sel = id;
    const W = B.win[kind];
    if (W) for (const t of W.pool.values()) t.classList.toggle('on', t.dataset.id === id);
    drawFoot(kind);
  }
  function onGridKey(W, e) {
    const st = ST[W.kind];
    const i = W.list.findIndex((d) => d.id === st.sel);
    let j = -1;
    if (e.key === 'ArrowRight') j = i + 1; else if (e.key === 'ArrowLeft') j = i - 1;
    else if (e.key === 'ArrowDown') j = i + W.cols; else if (e.key === 'ArrowUp') j = i - W.cols;
    else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); primary(W.kind, st.sel); return; }
    else return;
    e.preventDefault();
    e.stopPropagation();
    j = clamp(j < 0 && i < 0 ? 0 : j, 0, W.list.length - 1);
    if (!W.list[j]) return;
    choose(W.kind, W.list[j].id);
    const rowTop = Math.floor(j / W.cols) * (W.tileH + W.gap);
    if (rowTop < W.grid.scrollTop) W.grid.scrollTop = rowTop;
    else if (rowTop + W.tileH > W.grid.scrollTop + W.grid.clientHeight) W.grid.scrollTop = rowTop + W.tileH - W.grid.clientHeight + 12;
  }

  /* --------------------------------------------------------- actions -- */
  const isOpen = () => !!(S.map && S.map.open);
  const placeSel = () => (isOpen() && S.sel && S.sel.kind === 'place' ? MT.ow.get(S.sel) : null);
  /* Textures : peindre avec (outil Textures, carte en grille). */
  B.paintWith = (id) => {
    if (isOpen()) { MT.toast('Une carte ouverte ne se peint pas case par case : sélectionnez une pièce ou une surface du décor, puis « Appliquer à la sélection ».', 'info'); return false; }
    S.opts.paint.tex = id;
    MT.pushRecent('tex', id);
    if (S.tool !== 'paint') MT.setTool('paint'); else MT.emit('tool-opts');
    MT.toast(`Peindre avec : ${MT.texName(id)} (calque : ${{ floor: 'sol', wall: 'murs', ceil: 'plafond' }[S.opts.paint.layer] || S.opts.paint.layer})`);
    return true;
  };
  /* Textures : appliquer à la sélection — une case ou une pièce (calque de l'outil Textures), une pièce ou
     une surface du décor (toutes ses matières, ou celle choisie). */
  B.applyTex = (id, matKey = '') => {
    const s = S.sel, m = S.map;
    if (!s || !m) { MT.toast('Sélectionnez d’abord ce qui recevra la texture (une case, une pièce, une surface du décor).', 'warn'); return false; }
    if (isOpen()) {
      const e = placeSel();
      if (!e || !e.mats || !e.mats.length) { MT.toast('Sélectionnez une pièce ou une surface du décor de la base.', 'warn'); return false; }
      const targets = matKey ? [matKey] : e.mats;
      const inh = MT.ow.placeInheritedMats(s.i);
      // un seul geste annulable pour toutes les matières visées (teinte gardée)
      const ok = MT.ow.placeEdit(s.i, `Texture : ${MT.texName(id)}`, (x) => {
        const mo = { ...(x.m || {}) };
        for (const tex of targets) { const base = mo[tex] || (inh[tex] ? { t: inh[tex].t, c: inh[tex].c } : {}); mo[tex] = { ...base, t: id }; for (const k of Object.keys(mo[tex])) if (mo[tex][k] === undefined || mo[tex][k] === null) delete mo[tex][k]; }
        x.m = mo;
      }, { follow: false });
      MT.pushRecent('tex', id);
      if (ok) MT.toast(`${MT.texName(id)} sur « ${e.name} »${targets.length > 1 ? ` (${targets.length} matières)` : ''}.`);
      return ok;
    }
    const layer = S.opts.paint.layer;
    const lname = { floor: 'sol', wall: 'murs', ceil: 'plafond' }[layer] || layer;
    if (s.kind === 'cell') {
      try { MT.edit(`Peindre (${lname})`, () => MT.paintCells(layer, [[s.x, s.z]], id) || false, 'layers'); } catch (e) { MT.toast(e.message, 'error'); return false; }
      MT.pushRecent('tex', id);
      return true;
    }
    if (s.kind === 'zone') {
      MT.edit(`Texture de la pièce (${lname})`, (mm) => { mm.zones[s.i][layer] = id; }, 'all');
      MT.pushRecent('tex', id);
      MT.toast(`${MT.texName(id)} : ${lname} de la pièce « ${m.zones[s.i].name} » (calque de l’outil Textures).`);
      return true;
    }
    MT.toast('Sélectionnez une case ou une pièce (outil Éléments → Pièce), ou peignez avec l’outil Textures.', 'warn');
    return false;
  };
  /* Modèles : poser (outil Objets). */
  B.placeWith = (id) => {
    S.opts.props.model = id;
    MT.pushRecent('model', id);
    if (S.tool !== 'props') MT.setTool('props'); else MT.emit('tool-opts');
    MT.emit('preview');
    MT.toast(`Poser : ${ZS.MODELS[id] ? ZS.MODELS[id].name : id} (clic dans le plan ou la 3D)`);
    return true;
  };
  /* Modèles : remplacer la sélection (objets posés : même place, même rotation, mêmes facteurs ; décor de
     la base : « Remplacer par un objet »). */
  B.replaceWith = (id) => {
    const s = S.sel;
    if (s && s.kind === 'prop') {
      MT.edit(`Remplacer par : ${ZS.MODELS[id].name}`, (m) => { for (const i of s.list) if (m.props[i]) m.props[i].m = id; }, 'props', { list: s.list });
      MT.pushRecent('model', id);
      return true;
    }
    if (isOpen() && s && s.kind === 'place') return MT.ow.placeReplace(s.i, id);
    MT.toast('Sélectionnez un ou plusieurs objets posés (ou une pièce du décor de la base) à remplacer.', 'warn');
    return false;
  };
  function primary(kind, id) {
    choose(kind, id);
    if (kind === 'model') { B.placeWith(id); return; }
    if (placeSel()) B.applyTex(id);
    else B.paintWith(id);
  }
  function drawFoot(kind) {
    const W = B.win[kind];
    if (!W) return;
    const f = W.foot, st = ST[kind], d = st.sel ? (kind === 'tex' ? ZS.TEXLIB[st.sel] : ZS.MODELS[st.sel]) : null;
    f.textContent = '';
    if (!d) { f.append(h('p', { class: 'br-hint' }, kind === 'tex' ? 'Clic : choisir · double-clic : peindre avec (ou appliquer à la pièce du décor sélectionnée) · glisser vers le plan ou la 3D : peindre la case, la surface visée · flèches et Entrée.' : 'Clic : choisir · double-clic : poser (outil Objets) · glisser vers le plan ou la 3D : poser l’objet là · flèches et Entrée.')); return; }
    const sw = h('span', { class: 'br-sw' });
    MT.thumbs.get(kind === 'tex' ? 'tex' : 'model', d.id, kind === 'tex' ? 128 : 160).then((u) => { if (u) sw.style.backgroundImage = `url(${u})`; });
    const fav = h('button', { type: 'button', class: `mt-btn sm ${FAV[kind].has(d.id) ? 'on' : ''}`, title: 'Favori (vue « Favoris »)', onclick: () => { B.toggleFav(kind, d.id); drawFoot(kind); } }, UI.icon('star'), FAV[kind].has(d.id) ? 'Favori' : 'Ajouter aux favoris');
    const acts = [];
    if (kind === 'tex') {
      const q = texMeta(d);
      const e = placeSel();
      let matPick = null;
      if (e && e.mats && e.mats.length > 1) {
        matPick = h('select', { class: 'f-select br-sel' }, h('option', { value: '' }, `Toutes ses matières (${e.mats.length})`), e.mats.slice(0, 40).map((t) => h('option', { value: t }, MT.texName(t))));
      }
      if (!isOpen()) acts.push(h('button', { type: 'button', class: 'mt-btn sm primary', onclick: () => B.paintWith(d.id) }, UI.icon('paint'), 'Peindre avec'));
      acts.push(matPick, h('button', { type: 'button', class: `mt-btn sm ${isOpen() ? 'primary' : ''}`, onclick: () => B.applyTex(d.id, matPick ? matPick.value : '') }, isOpen() ? 'Appliquer au décor sélectionné' : 'Appliquer à la sélection'));
      f.append(sw, h('div', { class: 'br-det' }, h('b', null, d.name), h('small', null, `${d.id} · ${q.res}${d.size ? ` · ${decFr(d.size[0])} × ${decFr(d.size[1])} m` : ''}`), h('small', null, `${labelOf(TEX_SURF(), q.surf)} · ${labelOf(TEX_MAT(), q.mat).toLowerCase()} · ${q.use.map((u) => labelOf(TEX_USE(), u).toLowerCase()).join(', ')} · ${labelOf(TEX_SRC(), q.src)}`)), h('div', { class: 'br-acts' }, ...acts, fav));
    } else {
      const q = modFull(d);
      acts.push(h('button', { type: 'button', class: 'mt-btn sm primary', onclick: () => B.placeWith(d.id) }, UI.icon('props'), 'Poser'),
        h('button', { type: 'button', class: 'mt-btn sm', title: 'Les objets sélectionnés (ou la pièce du décor) deviennent ce modèle', onclick: () => B.replaceWith(d.id) }, 'Remplacer la sélection'));
      const cat = (ZS.MODEL_CATS.find((c) => c[0] === d.cat) || [d.cat, d.cat])[1];
      f.append(sw, h('div', { class: 'br-det' }, h('b', null, d.name), h('small', null, `${d.id}${q.dims ? ` · ${decFr(q.dims[0])} × ${decFr(q.dims[1])} × ${decFr(q.dims[2])} m` : ''}`), h('small', null, `${cat} · ${q.famName || (q.glb ? 'mes modèles' : 'jeu 1.x')} · ${labelOf(MOD_MAT(), q.mat).toLowerCase()}${d.solid && !d.decal ? ' · bloque le passage' : ''}${d.wall ? ' · se colle aux murs' : ''}`)), h('div', { class: 'br-acts' }, ...acts, fav));
    }
  }

  /* --------------------------------------------- glisser vers les vues -- */
  /* Une vignette lâchée sur le plan ou la 3D : un modèle est posé là (comme l'outil Objets) ; une
     texture peint la case visée (carte en grille) ou s'applique à la surface du décor visée. */
  function onDrop(e, view) {
    const data = e.dataTransfer && e.dataTransfer.getData('text/zs-lib');
    if (!data || !S.map) return;
    e.preventDefault();
    const [kind, id] = data.split(':');
    const p = view === 'plan' ? planPoint(e) : MT.v3.pick(e);
    if (!p) return;
    if (kind === 'model') {
      if (!ZS.MODELS[id]) return;
      S.opts.props.model = id;
      const pl = isOpen() ? MT.ow.propPlacement(p, e) : MT.tools.placement(p, e);
      if (!pl) return;
      if (isOpen() && S.map.props.length >= MT.ow.limit('prop')) { MT.toast(`Objets : ${MT.ow.limit('prop')} au plus sur une carte ouverte.`, 'warn'); return; }
      const pr = MT.makeProp(id, pl.x, pl.z, pl.y, pl.face);
      MT.edit(`Poser : ${ZS.MODELS[id].name}`, (m) => { m.props.push(pr); S.sel = { kind: 'prop', list: [m.props.length - 1] }; }, 'props');
      MT.emit('selection');
      MT.pushRecent('model', id);
      return;
    }
    if (kind === 'tex' && ZS.TEXLIB[id]) {
      if (isOpen()) {
        const hit = MT.ow.hitTest(p);
        if (hit && hit.kind === 'place') { MT.select(hit); B.applyTex(id); } else MT.toast('Lâchez la texture sur une pièce ou une surface du décor de la base.', 'warn');
        return;
      }
      if (!MT.inb(p.x, p.z)) return;
      // en 3D, le calque suit ce qui est visé (mur, sol, plafond)
      const layer = view === '3d' && p.face ? 'wall' : view === '3d' && p.ny < -0.5 ? 'ceil' : S.opts.paint.layer;
      let cell = [p.x, p.z];
      if (layer === 'wall' && p.face) cell = [p.x + p.face[0], p.z + p.face[1]];
      try { MT.edit('Peindre', () => MT.paintCells(layer, [cell], id) || false, 'layers'); } catch (err) { MT.toast(err.message, 'error'); return; }
      MT.pushRecent('tex', id);
    }
  }
  function planPoint(e) {
    const c = MT.plan.canvas, r = c.getBoundingClientRect(), w = MT.plan.toWorld(e.clientX - r.left, e.clientY - r.top);
    return { x: Math.floor(w.x), z: Math.floor(w.z), wx: w.x, wz: w.z, wy: 0, face: null, view: 'plan' };
  }
  function hookDrop(el, view) {
    el.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('text/zs-lib')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    el.addEventListener('drop', (e) => onDrop(e, view));
  }
  B.init = () => {
    if (MT.plan && MT.plan.canvas) hookDrop(MT.plan.canvas, 'plan');
    if (MT.v3 && MT.v3.canvas) hookDrop(MT.v3.canvas, '3d');
  };
  // la carte change : listes à refaire (sur la carte, familles, cotes)
  MT.on('map', () => { for (const k of ['tex', 'model']) { if (B.win[k]) { B.win[k].drawFilters(); refresh(k); } } });
  MT.on('change', debounce(() => { for (const k of ['tex', 'model']) if (B.isOpen(k) && ST[k].view === 'map') refresh(k, false); }, 400));
  MT.on('selection', () => { if (B.isOpen('tex')) drawFoot('tex'); if (B.isOpen('model')) drawFoot('model'); });
  MT.on('library', () => { bunkerTex = null; for (const k of ['tex', 'model']) if (B.isOpen(k)) refresh(k, false); });
  B.state = ST;
  B.items = items;
  B.texMeta = texMeta;
  B.modMeta = modFull;
})();
