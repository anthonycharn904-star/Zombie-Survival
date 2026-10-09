'use strict';
/* =========================================================================
   Mod Tools — interface : barre du haut, outils, panneaux (outil, sélection,
   carte, problèmes), bibliothèques de textures et d'objets, fenêtres,
   raccourcis clavier, barre d'état.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const { clamp, round, $, h, slug, debounce, deg, rad } = MT.util;
  const S = MT.state;
  const UI = (MT.ui = { tab: 'tool', view: 'split', split: 0.5, modalOpen: false, lib: { tex: { cat: 'all', q: '' }, model: { cat: 'all', q: '' } } });
  try {
    const saved = JSON.parse(localStorage.getItem('mt.ui') || '{}');
    if (['plan', 'split', '3d'].includes(saved.view)) UI.view = saved.view;
    if (Number.isFinite(saved.split)) UI.split = clamp(saved.split, 0.2, 0.8);
  } catch (e) { /* réglages par défaut */ }
  const saveUi = debounce(() => { try { localStorage.setItem('mt.ui', JSON.stringify({ view: UI.view, split: UI.split })); } catch (e) { /* rien */ } }, 400);

  /* ------------------------------------------------------------ icônes -- */
  const ICONS = {
    select: '<path d="M5 3.5l13 7.2-5.6 1.7-2.7 5.6z"/><path d="M12.4 12.4l5 5"/>',
    build: '<rect x="3" y="5" width="18" height="14"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
    paint: '<rect x="3.5" y="3.5" width="13" height="5.5" rx="1"/><path d="M16.5 6.2h3.5v6.3h-8.2v3"/><rect x="10.6" y="15.5" width="2.4" height="5.2"/>',
    props: '<path d="M4 7.5l8-4 8 4v9l-8 4-8-4z"/><path d="M4 7.5l8 4 8-4M12 11.5v9"/>',
    elements: '<path d="M6 21V3.5"/><path d="M6 4h12l-2.6 4 2.6 4H6"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    undo: '<path d="M9 7L4 11.5 9 16"/><path d="M4.5 11.5H15a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 7l5 4.5-5 4.5"/><path d="M19.5 11.5H9a5 5 0 0 0 0 10h3"/>',
    play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
    maps: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5M12 17.2v.3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    bulb: '<path d="M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2v.5h-5v-.5c0-.8-.4-1.5-1-2z"/>',
    fog: '<path d="M3 8h13M6 12h15M3 16h13"/>',
    power: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    top: '<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    walk: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7l-3 7M12 14l3 7M8 10l4-2 4 2"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
    zones: '<path d="M3 5h8v6H3zM13 5h8v14h-8zM3 13h8v6H3z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="9.5" r="2"/><path d="M21 16l-5.5-5.5L5 20"/>',
    folder: '<path d="M3 6.5h6l2 2.5h10v10.5H3z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
    up: '<path d="M6 14l6-6 6 6"/>',
    down: '<path d="M6 10l6 6 6-6"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    tag: '<path d="M3 12.5V4h8.5L21 13.5 13.5 21z"/><circle cx="7.5" cy="8" r="1.4"/>',
    stairs: '<path d="M3 20h5v-4.5h4.5V11H17V6.5h4"/><path d="M3 20V9.5"/>',
    layers: '<path d="M12 3.5l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5"/>',
    terrain: '<path d="M2.5 19.5l6-10 4 6 3-4 6 8z"/><path d="M8.5 9.5l1.6 2.6"/>',
    ground: '<path d="M14 4l6 6-8.5 8.5a2.5 2.5 0 0 1-3.5 0L5.5 16a2.5 2.5 0 0 1 0-3.5z"/><path d="M3 21h8"/>',
    roads: '<path d="M8.5 3L5 21M15.5 3L19 21"/><path d="M12 4v3M12 10.5v3M12 17v3"/>',
    buildings: '<path d="M3.5 20.5V10l8.5-6 8.5 6v10.5z"/><path d="M9.5 20.5V14h5v6.5"/>',
  };
  function icon(name, cls = '') {
    const s = h('span', { class: `ic ${cls}`, 'aria-hidden': 'true' });
    s.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;
    return s;
  }
  UI.icon = icon;

  /* ------------------------------------------------------------ toasts -- */
  /* Une alerte identique à une alerte encore affichée ne s'empile pas : elle est
     relancée, avec un compteur (×2, ×3…). */
  MT.on('toast', (msg, tone) => {
    const box = $('mt-toasts');
    if (!box) return;
    tone = tone || '';
    const life = tone === 'error' ? 6000 : 2600;
    const arm = (t) => {
      clearTimeout(t._life);
      t._life = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, life);
    };
    const same = [...box.children].find((t) => t._msg === msg && t._tone === tone && !t.classList.contains('out'));
    if (same) {
      same._count += 1;
      same.querySelector('.mt-toast-n').textContent = `×${same._count}`;
      box.append(same);
      same.classList.remove('bump');
      void same.offsetWidth;
      same.classList.add('bump');
      arm(same);
      return;
    }
    const t = h('div', { class: `mt-toast ${tone}`, role: 'status' }, h('span', null, msg), h('i', { class: 'mt-toast-n' }));
    t._msg = msg; t._tone = tone; t._count = 1;
    box.append(t);
    while (box.children.length > 4) box.firstChild.remove();
    arm(t);
  });

  /* ------------------------------------------------- champs de formulaire -- */
  const fmtNum = (v, d = 3) => (Number.isFinite(v) ? String(round(v, d)) : '');
  function field(label, control, hint) {
    return h('div', { class: 'f-row' }, h('span', { class: 'f-label' }, label), h('div', { class: 'f-ctl' }, control, hint ? h('small', { class: 'f-hint' }, hint) : null));
  }
  function num({ value, min = -1e9, max = 1e9, step = 0.1, unit = '', onLive, onCommit, digits = 3, width }) {
    const i = h('input', { type: 'number', value: fmtNum(value, digits), min, max, step, class: 'f-num' });
    if (width) i.style.width = width;
    i.addEventListener('input', () => { const v = parseFloat(i.value); if (onLive && Number.isFinite(v)) onLive(clamp(v, min, max)); });
    i.addEventListener('change', () => {
      const v = parseFloat(i.value);
      if (!Number.isFinite(v)) { i.value = fmtNum(value, digits); return; }
      const c = clamp(v, min, max);
      i.value = fmtNum(c, digits);
      onCommit(c);
    });
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); });
    return unit ? h('span', { class: 'f-unit' }, i, h('em', null, unit)) : i;
  }
  function slider({ value, min, max, step = 0.01, fmt = (v) => fmtNum(v, 2), onLive, onCommit }) {
    const out = h('output', { class: 'f-out' }, fmt(value));
    const i = h('input', { type: 'range', min, max, step, value, class: 'f-range' });
    i.addEventListener('input', () => { const v = parseFloat(i.value); out.textContent = fmt(v); if (onLive) onLive(v); });
    i.addEventListener('change', () => { const v = parseFloat(i.value); out.textContent = fmt(v); onCommit(v); });
    return h('span', { class: 'f-slider' }, i, out);
  }
  function color({ value, onLive, onCommit }) {
    const i = h('input', { type: 'color', value: typeof value === 'number' ? ZS.colorHex(value) : value || '#ffffff', class: 'f-color' });
    i.addEventListener('input', () => onLive && onLive(i.value));
    i.addEventListener('change', () => onCommit(i.value));
    return i;
  }
  function select({ value, options, onChange }) {
    const s = h('select', { class: 'f-select' }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  function check({ checked, label, onChange }) {
    const i = h('input', { type: 'checkbox', checked: !!checked });
    i.addEventListener('change', () => onChange(i.checked));
    return h('label', { class: 'f-check' }, i, h('i', { 'aria-hidden': 'true' }), h('span', null, label));
  }
  function text({ value, maxLength = 60, placeholder = '', onCommit, onLive, upper = false }) {
    const i = h('input', { type: 'text', value: value || '', maxLength, placeholder, class: 'f-text', spellcheck: false });
    if (upper) i.style.textTransform = 'uppercase';
    i.addEventListener('input', () => onLive && onLive(i.value));
    i.addEventListener('change', () => onCommit(upper ? i.value.toUpperCase() : i.value));
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); });
    return i;
  }
  function seg(value, options, onChange, cls = '') {
    return h('div', { class: `f-seg ${cls}`, role: 'radiogroup' }, options.map(([v, l, title]) => h('button', {
      type: 'button', class: String(v) === String(value) ? 'on' : '', title: title || null, role: 'radio', 'aria-checked': String(v) === String(value) ? 'true' : 'false',
      onclick: () => onChange(v),
    }, l)));
  }
  function btn(label, onclick, { kind = '', ic = null, title = null, disabled = false } = {}) {
    return h('button', { type: 'button', class: `mt-btn ${kind}`, onclick, title, disabled }, ic ? icon(ic) : null, label ? h('span', null, label) : null);
  }
  function section(title, ...kids) { return h('section', { class: 'p-sec' }, h('h3', null, title), ...kids); }
  /* Modification immédiate (aperçu) puis validation (historique). */
  const live = (label, kind, fn, detail) => { if (!S.map) return; MT.begin(label); fn(S.map); MT.touch(kind, detail); };
  const commit = (label, kind, fn, detail) => { if (!S.map) return; MT.begin(label); fn(S.map); MT.touch(kind, detail); MT.commit(); };
  UI.f = { field, num, slider, color, select, check, text, seg, btn, section };

  /* ------------------------------------------------------- vignettes -- */
  const TH = { r: null, scene: null, cam: null, cache: new Map(), queue: [], pending: new Map(), timer: 0 };
  const thumbKey = () => `mt.thumbs.${ZS.version}`;
  try { const c = JSON.parse(localStorage.getItem(thumbKey()) || '{}'); for (const k in c) TH.cache.set(k, c[k]); } catch (e) { /* aucun cache */ }
  const saveThumbs = debounce(() => {
    try { const o = {}; for (const [k, v] of TH.cache) if (!k.startsWith('u_')) o[k] = v; localStorage.setItem(thumbKey(), JSON.stringify(o)); } catch (e) { /* stockage plein : tant pis */ }
  }, 1500);
  function thumbRenderer() {
    if (TH.r) return TH.r;
    TH.r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    TH.r.setSize(112, 112);
    TH.r.outputEncoding = THREE.sRGBEncoding;
    TH.r.toneMapping = THREE.ACESFilmicToneMapping;
    TH.r.toneMappingExposure = 1.25;
    TH.scene = new THREE.Scene();
    TH.scene.background = new THREE.Color(0x1d2122).convertSRGBToLinear();
    TH.scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3226, 1.25));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(3, 6, 4);
    TH.scene.add(sun);
    TH.cam = new THREE.PerspectiveCamera(28, 1, 0.05, 200);
    return TH.r;
  }
  function renderModelThumb(id) {
    const r = thumbRenderer();
    const obj = ZS.makePropObject({ m: id });
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const def = ZS.MODELS[id];
    const dir = def && def.decal && !def.wall ? new THREE.Vector3(0.15, 1, 0.35) : new THREE.Vector3(1.1, 0.75, 1.5);
    dir.normalize();
    const radius = Math.max(0.2, sz.length() / 2);
    const dist = radius / Math.sin((TH.cam.fov * Math.PI) / 360) * 1.02;
    TH.cam.position.copy(c).addScaledVector(dir, dist);
    TH.cam.lookAt(c);
    TH.cam.near = Math.max(0.01, dist - radius * 2); TH.cam.far = dist + radius * 3;
    TH.cam.updateProjectionMatrix();
    TH.scene.add(obj);
    r.render(TH.scene, TH.cam);
    const url = r.domElement.toDataURL('image/jpeg', 0.84);
    TH.scene.remove(obj);
    obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    return url;
  }
  function pumpThumbs() {
    TH.timer = 0;
    const t0 = performance.now();
    while (TH.queue.length && performance.now() - t0 < 14) {
      const id = TH.queue.shift();
      let url = '';
      try { url = renderModelThumb(id); } catch (e) { console.warn(`Vignette ${id}`, e); }
      TH.cache.set(id, url);
      for (const fn of TH.pending.get(id) || []) fn(url);
      TH.pending.delete(id);
    }
    saveThumbs();
    if (TH.queue.length) TH.timer = requestAnimationFrame(pumpThumbs);
  }
  MT.modelThumb = (id, cb) => {
    if (TH.cache.has(id)) { cb(TH.cache.get(id)); return; }
    // modèle importé : vignette quand il est décodé
    if (ZS.MODELS[id] && ZS.MODELS[id].glb && !TH.pending.has(id)) {
      TH.pending.set(id, [cb]);
      ZS.glbReady(id).then(() => { TH.queue.push(id); if (!TH.timer) TH.timer = requestAnimationFrame(pumpThumbs); });
      return;
    }
    if (!TH.pending.has(id)) { TH.pending.set(id, []); TH.queue.push(id); }
    TH.pending.get(id).push(cb);
    if (!TH.timer) TH.timer = requestAnimationFrame(pumpThumbs);
  };
  const texThumbUrl = new Map();
  MT.texThumb = (id) => {
    if (id === 'none') return null;
    if (!texThumbUrl.has(id)) {
      const c = ZS.textureThumb(id, 96);
      if (ZS.TEXLIB[id] && ZS.TEXLIB[id].image) return c; // image importée : dessinée quand elle est chargée
      texThumbUrl.set(id, c.toDataURL('image/jpeg', 0.85));
    }
    return texThumbUrl.get(id);
  };
  MT.on('library', () => { for (const k of [...texThumbUrl.keys()]) if (k.startsWith('u_')) texThumbUrl.delete(k); });

  /* ------------------------------------------------------ bibliothèque -- */
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const tile = en.target;
      io.unobserve(tile);
      const fill = tile.querySelector('.lib-img');
      if (!fill) continue;
      if (tile.dataset.kind === 'tex') {
        const v = MT.texThumb(tile.dataset.id);
        if (typeof v === 'string') fill.style.backgroundImage = `url(${v})`;
        else if (v && v.nodeType) { v.classList.add('lib-canvas'); fill.append(v.cloneNode ? copyCanvas(v) : v); }
      } else {
        MT.modelThumb(tile.dataset.id, (url) => { if (url) fill.style.backgroundImage = `url(${url})`; });
      }
    }
  }, { rootMargin: '120px' });
  function copyCanvas(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.className = 'lib-canvas';
    const draw = () => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0); };
    draw();
    setTimeout(draw, 400); setTimeout(draw, 1500);
    return c;
  }
  /* kind : 'tex' | 'model' ; opts.value, opts.onPick(id), opts.layer (textures), opts.compact */
  function library(kind, opts = {}) {
    const st = UI.lib[kind];
    const cats = kind === 'tex'
      ? [['all', 'Toutes'], ['recent', 'Récentes'], ...ZS.TEX_CATS, ['import', 'Mes images']]
      : [['all', 'Tous'], ['recent', 'Récents'], ...ZS.MODEL_CATS, ['import', 'Mes modèles']];
    const grid = h('div', { class: `lib-grid ${kind === 'model' ? 'models' : ''}` });
    const count = h('span', { class: 'lib-count' });
    const search = h('input', { type: 'search', class: 'f-text lib-search', placeholder: kind === 'tex' ? 'Chercher une texture…' : 'Chercher un objet…', value: st.q, spellcheck: false });
    const chips = h('div', { class: 'lib-cats' });
    const fill = () => {
      grid.textContent = '';
      const q = slug(st.q).replace(/-/g, ' ');
      let items;
      if (kind === 'tex') {
        items = Object.values(ZS.TEXLIB);
        if (st.cat === 'recent') items = S.recent.tex.map((id) => ZS.TEXLIB[id]).filter(Boolean);
        else if (st.cat === 'import') items = items.filter((d) => d.custom);
        else if (st.cat !== 'all') items = items.filter((d) => d.cat === st.cat);
      } else {
        items = Object.values(ZS.MODELS);
        if (st.cat === 'recent') items = S.recent.model.map((id) => ZS.MODELS[id]).filter(Boolean);
        else if (st.cat !== 'all') items = items.filter((d) => d.cat === st.cat);
      }
      if (q) items = items.filter((d) => slug(`${d.name} ${d.id}`).replace(/-/g, ' ').includes(q));
      const special = kind === 'tex' && opts.layer === 'ceil' && (st.cat === 'all' || st.cat === 'plafond') && !q;
      if (special) grid.append(tile({ id: 'none', name: 'Ciel ouvert (pas de plafond)' }));
      for (const d of items) grid.append(tile(d));
      count.textContent = `${items.length + (special ? 1 : 0)}`;
      if (!items.length && !special) grid.append(h('p', { class: 'lib-empty' }, st.cat === 'import' ? (kind === 'tex' ? 'Aucune image importée pour l’instant.' : 'Aucun modèle importé pour l’instant.') : 'Rien ne correspond.'));
    };
    const tile = (d) => {
      const on = d.id === opts.value;
      const t = h('button', {
        type: 'button', class: `lib-tile ${on ? 'on' : ''} ${d.id === 'none' ? 'sky' : ''}`, title: `${d.name}\n${d.id}`, dataset: { id: d.id, kind },
        onclick: () => { for (const x of grid.querySelectorAll('.lib-tile.on')) x.classList.remove('on'); t.classList.add('on'); opts.value = d.id; opts.onPick(d.id); },
      }, h('span', { class: 'lib-img' }), h('span', { class: 'lib-name' }, d.name));
      if (d.id !== 'none') io.observe(t);
      return t;
    };
    const drawChips = () => {
      chips.textContent = '';
      for (const [id, label] of cats) chips.append(h('button', { type: 'button', class: st.cat === id ? 'on' : '', onclick: () => { st.cat = id; st.scroll = 0; grid.scrollTop = 0; drawChips(); fill(); } }, label));
    };
    search.addEventListener('input', debounce(() => { st.q = search.value; st.scroll = 0; fill(); }, 120));
    drawChips();
    fill();
    grid.addEventListener('scroll', () => { st.scroll = grid.scrollTop; }, { passive: true });
    if (st.scroll) requestAnimationFrame(() => { grid.scrollTop = st.scroll; });
    const root = h('div', { class: `lib ${opts.compact ? 'compact' : ''}` }, h('div', { class: 'lib-head' }, search, count), chips, grid);
    root.refresh = fill;
    return root;
  }
  UI.library = library;
  /* Fenêtre de choix d'une texture ou d'un modèle. */
  UI.pick = (kind, value, title, { layer } = {}) => new Promise((resolve) => {
    let chosen = null;
    const lib = library(kind, { value, layer, onPick: (id) => { chosen = id; close(true); } });
    const close = UI.modal({ title, body: lib, wide: true, buttons: [{ label: 'Annuler' }], onClose: () => resolve(chosen) });
  });

  /* ---------------------------------------------------------- fenêtres -- */
  UI.modal = ({ title, body, buttons = [], wide = false, onClose, cls = '' }) => {
    const root = $('mt-modal');
    root.textContent = '';
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      root.hidden = true;
      root.textContent = '';
      UI.modalOpen = false;
      if (onClose) onClose();
    };
    const foot = h('footer', { class: 'mt-modal-foot' }, buttons.map((b) => h('button', {
      type: 'button', class: `mt-btn ${b.kind || ''}`, disabled: !!b.disabled,
      onclick: async () => { const r = b.onClick ? await b.onClick() : true; if (r !== false) close(); },
    }, b.label)));
    const box = h('div', { class: `mt-modal-box ${wide ? 'wide' : ''} ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', { class: 'mt-modal-head' }, h('h2', null, title), h('button', { type: 'button', class: 'mt-icon-btn', title: 'Fermer (Échap)', onclick: close }, icon('close'))),
      h('div', { class: 'mt-modal-body' }, body),
      buttons.length ? foot : null);
    root.append(box);
    root.hidden = false;
    UI.modalOpen = true;
    UI.closeModal = close;
    setTimeout(() => { const f = box.querySelector('input:not([type=checkbox]), select, .mt-btn.primary'); if (f) f.focus(); }, 30);
    return close;
  };
  UI.confirm = (message, { ok = 'Confirmer', cancel = 'Annuler', danger = false, title = 'Confirmation' } = {}) => new Promise((resolve) => {
    let r = false;
    UI.modal({ title, body: h('p', { class: 'mt-modal-text' }, message), buttons: [{ label: cancel }, { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => { r = true; } }], onClose: () => resolve(r) });
  });
  UI.choice = (message, choices, title = 'Mod Tools') => new Promise((resolve) => {
    let r = null;
    UI.modal({ title, body: h('p', { class: 'mt-modal-text' }, message), buttons: choices.map((c) => ({ label: c.label, kind: c.kind, onClick: () => { r = c.value; } })), onClose: () => resolve(r) });
  });

  /* ------------------------------------------------------- structure --- */
  /* Boutons des outils : ceux de la carte ouverte (grille ou monde ouvert). */
  const toolButtons = () => MT.tools.available().map((t) => h('button', {
    type: 'button', class: 'mt-tool', dataset: { tool: t.id }, title: `${t.name} (${t.label})`,
    onclick: () => MT.setTool(t.id),
  }, icon(t.id), h('span', { class: 'mt-tool-key' }, t.label)));
  let toolsKey = '';
  UI.refreshTools = () => {
    const nav = $('mt-tools');
    const key = MT.tools.available().map((t) => t.id).join(',');
    document.body.classList.toggle('mt-open', MT.isOpen());
    if (!nav || key === toolsKey) return;
    toolsKey = key;
    nav.textContent = '';
    nav.append(...toolButtons());
    if (!MT.tools.available().some((t) => t.id === S.tool)) MT.setTool('select');
    refreshToolbar();
  };
  UI.build = () => {
    document.body.classList.add('mt-on');
    const toolBtns = toolButtons();
    toolsKey = MT.tools.available().map((t) => t.id).join(',');
    const root = h('div', { id: 'mt', class: 'mt' },
      h('header', { class: 'mt-top' },
        h('div', { class: 'mt-brand' }, h('b', null, 'Mod Tools'), h('small', null, 'Zombie Survival')),
        h('button', { type: 'button', class: 'mt-btn', id: 'mt-maps', title: 'Cartes : ouvrir, créer, importer, publier', onclick: () => UI.mapManager() }, icon('maps'), h('span', null, 'Cartes')),
        h('div', { class: 'mt-title' },
          h('input', { id: 'mt-name', type: 'text', spellcheck: false, maxLength: 60, title: 'Nom de la carte' }),
          h('span', { id: 'mt-dirty', class: 'mt-dirty' })),
        h('div', { class: 'mt-group' },
          h('button', { type: 'button', class: 'mt-icon-btn', id: 'mt-save', title: 'Enregistrer (Ctrl+S)', onclick: () => UI.save() }, icon('save')),
          h('button', { type: 'button', class: 'mt-icon-btn', id: 'mt-undo', title: 'Annuler (Ctrl+Z)', onclick: () => MT.undo() }, icon('undo')),
          h('button', { type: 'button', class: 'mt-icon-btn', id: 'mt-redo', title: 'Rétablir (Ctrl+Y)', onclick: () => MT.redo() }, icon('redo'))),
        h('div', { class: 'mt-seg', id: 'mt-viewseg', role: 'radiogroup', 'aria-label': 'Vues' },
          ...[['plan', 'Plan'], ['split', 'Plan + 3D'], ['3d', '3D']].map(([v, l]) => h('button', { type: 'button', dataset: { view: v }, onclick: () => UI.setView(v) }, l))),
        h('div', { class: 'mt-levels', id: 'mt-levels', role: 'group', 'aria-label': 'Niveau affiché' }),
        h('div', { class: 'mt-spacer' }),
        h('button', { type: 'button', class: 'mt-btn issues', id: 'mt-issues-btn', title: 'Problèmes de la carte', onclick: () => UI.setTab('issues') }, icon('warn'), h('span', { id: 'mt-issues-count' }, '0')),
        h('button', { type: 'button', class: 'mt-btn primary', id: 'mt-test', title: 'Tester la carte (F5) · Maj+F5 : depuis la caméra', onclick: (e) => MT.test(e.shiftKey) }, icon('play'), h('span', null, 'Tester')),
        h('button', { type: 'button', class: 'mt-icon-btn', id: 'mt-help', title: 'Aide (F1)', onclick: () => UI.help() }, icon('help')),
        h('button', { type: 'button', class: 'mt-icon-btn', id: 'mt-quit', title: 'Fermer les Mod Tools', onclick: () => UI.quit() }, icon('close'))),
      h('nav', { class: 'mt-tools', id: 'mt-tools', 'aria-label': 'Outils' }, toolBtns),
      h('main', { class: 'mt-stage', id: 'mt-stage' },
        h('section', { class: 'mt-pane mt-plan', id: 'mt-plan-pane' },
          h('canvas', { id: 'mt-plan', 'aria-label': 'Plan de la carte' }),
          h('div', { class: 'mt-pane-bar' },
            h('span', { class: 'mt-pane-title' }, 'Plan'),
            h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Recentrer (toute la carte)', onclick: () => MT.plan.fit() }, icon('fit')),
            grid(toggleBtn('grid', 'Grille', () => MT.plan.showGrid, (v) => { MT.plan.showGrid = v; MT.plan.need = true; })),
            toggleBtn('zones', 'Pièces colorées et noms (carte ouverte : noms des lieux)', () => MT.plan.showZones, (v) => { MT.plan.showZones = v; MT.plan.baseRev++; MT.plan.need = true; }),
            toggleBtn('props', 'Objets', () => MT.plan.showProps, (v) => { MT.plan.showProps = v; MT.plan.need = true; }))),
        h('div', { class: 'mt-split', id: 'mt-split', title: 'Glisser pour changer la taille des vues' }),
        h('section', { class: 'mt-pane mt-3d', id: 'mt-3d-pane' },
          h('div', { class: 'mt-pane-bar' },
            h('span', { class: 'mt-pane-title' }, '3D'),
            h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Vue d’ensemble', onclick: () => MT.v3.overview() }, icon('eye')),
            h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Vue de dessus (H)', onclick: () => MT.v3.topView() }, icon('top')),
            h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'À hauteur d’homme, au départ', onclick: () => MT.v3.walkView() }, icon('walk')),
            toggleBtn('sun', 'Lumière d’appoint (éclaire la carte pour travailler)', () => MT.v3.editLight, (v) => MT.v3.setOption('editLight', v)),
            grid(toggleBtn('fog', 'Brouillard de la carte', () => MT.v3.fog, (v) => MT.v3.setOption('fog', v))),
            toggleBtn('power', 'Aperçu : courant rétabli', () => MT.v3.power, (v) => MT.v3.setOption('power', v)),
            grid(toggleBtn('bulb', 'Scintillement des lumières', () => MT.v3.animate, (v) => { MT.v3.setOption('animate', v); if (!v) MT.v3.forceRebuild(); })),
            toggleBtn('tag', 'Noms des pièces (carte ouverte : des lieux et des emplacements)', () => MT.v3.labels, (v) => MT.v3.setOption('labels', v))),
          h('div', { class: 'mt-3d-help' }, 'Clic droit maintenu : regarder · ZQSD/WASD : avancer · A/E : descendre/monter · Maj : vite · molette : zoom · clic milieu : glisser'))),
      h('aside', { class: 'mt-side' },
        h('div', { class: 'mt-tabs', role: 'tablist' },
          ...[['tool', 'Outil'], ['sel', 'Sélection'], ['map', 'Carte'], ['issues', 'Problèmes']].map(([id, l]) => h('button', { type: 'button', role: 'tab', dataset: { tab: id }, onclick: () => UI.setTab(id) }, l))),
        h('div', { class: 'mt-panel', id: 'mt-panel' })),
      h('footer', { class: 'mt-status' },
        h('span', { id: 'st-cell' }, '—'), h('span', { id: 'st-tile' }), h('span', { id: 'st-zone' }), h('span', { id: 'st-hint', class: 'st-hint' }),
        h('span', { class: 'mt-spacer' }), h('span', { id: 'st-map' }), h('span', { id: 'st-saved' })),
      h('div', { class: 'mt-toasts', id: 'mt-toasts', 'aria-live': 'polite' }));
    document.body.append(root, h('div', { class: 'mt-modal', id: 'mt-modal', hidden: true, onclick: (e) => { if (e.target.id === 'mt-modal' && UI.closeModal) UI.closeModal(); } }));
    $('mt-name').addEventListener('change', () => {
      const v = $('mt-name').value.trim().slice(0, 60);
      if (!S.map) return;
      if (!v) { $('mt-name').value = S.map.name; return; }
      commit('Renommer la carte', 'settings', (m) => { m.name = v; });
    });
    $('mt-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
    initSplit();
    new ResizeObserver(() => UI.layout()).observe($('mt-stage'));
    window.addEventListener('resize', () => UI.layout());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    MT.on('tool', () => { refreshToolbar(); if (UI.tab !== 'tool') UI.setTab('tool'); else renderPanel(); refreshHint(); });
    MT.on('tool-opts', () => { if (UI.tab === 'tool') renderPanel(); });
    MT.on('selection', () => {
      if (S.sel && S.sel.kind !== 'cell' && (S.tool === 'select' || UI.tab === 'sel')) UI.setTab('sel');
      else if (UI.tab === 'sel') renderPanel();
    });
    MT.on('change', (kind, d) => { refreshTop(); schedulePanel(kind, d); scheduleValidate(); });
    MT.on('history', refreshTop);
    MT.on('saved', refreshTop);
    MT.on('map', () => { UI.refreshTools(); refreshTop(); renderPanel(); validateNow(); });
    MT.on('issues', refreshIssues);
    MT.on('cursor', refreshCursor);
    MT.on('library', () => { if (UI.tab === 'tool' && S.tool === 'paint') renderPanel(); });
    MT.on('level', () => { refreshLevels(); renderPanel(); refreshTop(); });
    refreshToolbar();
    UI.setTab('tool');
    UI.setView(UI.view);
  };
  /* Bouton des seules cartes en grille (caché sur une carte ouverte). */
  function grid(el) { el.classList.add('grid-only'); return el; }
  function toggleBtn(ic, title, get, set) {
    const b = h('button', { type: 'button', class: `mt-icon-btn sm toggle ${get() ? 'on' : ''}`, title, 'aria-pressed': get() ? 'true' : 'false' }, icon(ic));
    b.addEventListener('click', () => { const v = !get(); set(v); b.classList.toggle('on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); });
    return b;
  }

  /* ----------------------------------------------- vues et disposition -- */
  UI.setView = (v) => {
    UI.view = v;
    for (const b of document.querySelectorAll('#mt-viewseg button')) b.classList.toggle('on', b.dataset.view === v);
    UI.layout();
    saveUi();
  };
  UI.layout = () => {
    const stage = $('mt-stage');
    if (!stage) return;
    const planPane = $('mt-plan-pane'), pane3 = $('mt-3d-pane'), split = $('mt-split');
    const showPlan = UI.view !== '3d', show3 = UI.view !== 'plan';
    planPane.hidden = !showPlan; pane3.hidden = !show3; split.hidden = UI.view !== 'split';
    planPane.style.flex = UI.view === 'split' ? `0 0 ${Math.round(UI.split * 1000) / 10}%` : '1 1 auto';
    MT.plan.visible = showPlan;
    const testing = ZS.G.state !== 'editor' && ZS.G.state !== 'editor-boot';
    if (showPlan) { const r = planPane.getBoundingClientRect(); MT.plan.resize(r.width, r.height); }
    if (show3 && !testing) {
      const r = pane3.getBoundingClientRect();
      const st = document.body.style;
      st.setProperty('--mt3d-x', `${r.left}px`); st.setProperty('--mt3d-y', `${r.top}px`);
      st.setProperty('--mt3d-w', `${r.width}px`); st.setProperty('--mt3d-h', `${r.height}px`);
      ZS.setRenderEnabled(true);
      ZS.setViewport({ w: r.width, h: r.height });
      MT.v3.resize(r.width, r.height);
      MT.v3.visible = true;
    } else if (!testing) {
      ZS.setRenderEnabled(false);
      MT.v3.visible = false;
    }
    document.body.classList.toggle('mt-no3d', !show3);
  };
  function initSplit() {
    const sp = $('mt-split');
    sp.addEventListener('pointerdown', (e) => {
      sp.setPointerCapture(e.pointerId);
      const r = $('mt-stage').getBoundingClientRect();
      const move = (ev) => { UI.split = clamp((ev.clientX - r.left) / r.width, 0.2, 0.8); UI.layout(); };
      const up = () => { sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up); saveUi(); };
      sp.addEventListener('pointermove', move);
      sp.addEventListener('pointerup', up);
    });
    sp.addEventListener('dblclick', () => { UI.split = 0.5; UI.layout(); saveUi(); });
  }

  /* -------------------------------------------------------- barre haute -- */
  /* Sélecteur de niveau (barre du haut) : descendre, niveau affiché, monter, ajouter. */
  function refreshLevels() {
    const box = $('mt-levels');
    if (!box) return;
    box.textContent = '';
    box.hidden = !S.map || !MT.multiOk() || MT.isOpen();
    if (box.hidden) return;
    const lvs = MT.levels(), i = lvs.indexOf(S.level);
    const sel = h('select', { class: 'f-select mt-level-sel', title: 'Niveau affiché (Ctrl+↑ / Ctrl+↓)' }, lvs.slice().reverse().map((lv) => h('option', { value: lv, selected: lv === S.level }, MT.levelName(lv))));
    sel.addEventListener('change', () => MT.setLevel(parseInt(sel.value, 10)));
    box.append(
      h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Niveau du dessous (Ctrl+↓)', disabled: i <= 0, onclick: () => MT.setLevel(lvs[i - 1]) }, icon('down')),
      icon('layers', 'mt-levels-ic'), sel,
      h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Niveau du dessus (Ctrl+↑)', disabled: i >= lvs.length - 1, onclick: () => MT.setLevel(lvs[i + 1]) }, icon('up')),
      h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Ajouter un étage ou un sous-sol', onclick: () => UI.addLevelDialog() }, icon('plus')));
  }
  UI.refreshLevels = refreshLevels;
  UI.addLevelDialog = async () => {
    const lvs = MT.levels();
    const r = await UI.choice(`Ajouter un niveau : un étage au-dessus de « ${MT.levelName(lvs[lvs.length - 1])} » ou un sous-sol sous « ${MT.levelName(lvs[0])} ». Il reprend les murs du niveau voisin ; un escalier (outil Escaliers, K) relie deux niveaux.`, [
      { label: 'Annuler', value: null }, { label: 'Sous-sol', value: -1 }, { label: 'Étage au-dessus', value: 1, kind: 'primary' },
    ], 'Ajouter un niveau');
    if (r) MT.addLevel(r);
  };
  function refreshTop() {
    if (!S.map) return;
    refreshLevels();
    const name = $('mt-name');
    if (document.activeElement !== name) name.value = S.map.name;
    const dirty = MT.isDirty();
    $('mt-dirty').textContent = S.source === 'new' && dirty ? 'nouvelle · non enregistrée' : dirty ? 'modifiée' : S.source === 'game' ? 'carte du jeu' : 'enregistrée';
    $('mt-dirty').className = `mt-dirty ${dirty ? 'on' : ''}`;
    $('mt-undo').disabled = !S.undo.length;
    $('mt-redo').disabled = !S.redo.length;
    $('mt-undo').title = S.undo.length ? `Annuler : ${S.undo[S.undo.length - 1].label} (Ctrl+Z)` : 'Rien à annuler';
    $('mt-redo').title = S.redo.length ? `Rétablir : ${S.redo[S.redo.length - 1].label} (Ctrl+Y)` : 'Rien à rétablir';
    const m = S.map;
    const nl = MT.levels().length;
    $('st-map').textContent = m.open ? MT.ow.summary(m) : `${m.w} × ${m.h}${nl > 1 ? ` · ${nl} niveaux` : ''} · ${m.props.length} objet${m.props.length > 1 ? 's' : ''} · ${m.lights.length} lumière${m.lights.length > 1 ? 's' : ''}`;
    MT.api.setTitle(`${dirty ? '● ' : ''}${m.name} — Mod Tools · Zombie Survival`);
  }
  function refreshToolbar() {
    for (const b of document.querySelectorAll('.mt-tool')) b.classList.toggle('on', b.dataset.tool === S.tool);
    const cls = ['tool-select', 'tool-build', 'tool-paint', 'tool-props', 'tool-elements', 'tool-stairs', 'tool-terrain', 'tool-ground', 'tool-roads', 'tool-buildings'];
    document.body.classList.remove(...cls);
    document.body.classList.add(`tool-${S.tool}`);
  }
  function refreshHint() {
    const t = MT.tools.info();
    $('st-hint').textContent = t ? t.hint : '';
  }
  function refreshCursor(p) {
    if (S.map && S.map.open) {
      const c = MT.ow.ui.cursor(p);
      $('st-cell').textContent = c ? c.cell : '—'; $('st-tile').textContent = c ? c.tile : ''; $('st-zone').textContent = c ? c.zone : '';
      return;
    }
    if (!p || !S.map || !MT.inb(p.x, p.z)) { $('st-cell').textContent = '—'; $('st-tile').textContent = ''; $('st-zone').textContent = ''; return; }
    $('st-cell').textContent = `${MT.levels().length > 1 ? `${MT.levelName(S.level)} · ` : ''}x ${p.x} · z ${p.z}${p.view === '3d' ? ` · h ${p.wy.toFixed(2)} m` : ''}`;
    let t = MT.tools.tileName(MT.tileAt(p.x, p.z));
    if (S.tool === 'paint') { const L = S.opts.paint.layer; const id = MT.cellTexture(p.x, p.z, L); t += ` · ${MT.tools.texName(id)}`; }
    $('st-tile').textContent = t;
    const zi = MT.zoneIndexAt(p.x, p.z);
    const A = MT.analysis();
    $('st-zone').textContent = zi >= 0 && A.zones[zi] ? `${A.zones[zi].name}${A.zones[zi].auto ? ' (sans nom)' : ''}` : '';
  }

  /* ------------------------------------------------------------ onglets -- */
  UI.setTab = (id) => {
    UI.tab = id;
    for (const b of document.querySelectorAll('.mt-tabs button')) { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
    renderPanel();
  };
  let panelTimer = 0;
  function schedulePanel(kind, d) {
    if (d && d.live) return;
    if (UI.tab === 'tool' && kind !== 'all' && !(d && d.history)) return;
    clearTimeout(panelTimer);
    panelTimer = setTimeout(() => {
      const panel = $('mt-panel');
      if (panel && panel.contains(document.activeElement) && document.activeElement.matches('input, select, textarea') && !(d && d.history)) return;
      renderPanel();
    }, 140);
  }
  function renderPanel() {
    const panel = $('mt-panel');
    if (!panel) return;
    const scroll = panel.scrollTop;
    panel.textContent = '';
    if (!S.map) { panel.append(h('p', { class: 'p-empty' }, 'Aucune carte ouverte.')); return; }
    if (UI.tab === 'tool') panel.append(...toolPanel());
    else if (UI.tab === 'sel') panel.append(...inspector());
    else if (UI.tab === 'map') panel.append(...mapPanel());
    else panel.append(...issuesPanel());
    panel.scrollTop = scroll;
    if (UI.tab === 'issues') refreshIssues();
  }
  UI.renderPanel = renderPanel;

  /* ------------------------------------------------------ panneau outil -- */
  function toolPanel() {
    const t = MT.tools.info() || MT.tools.available()[0];
    const head = h('div', { class: 'p-head' }, icon(S.tool), h('div', null, h('h2', null, t.name), h('p', null, t.hint)));
    if (MT.isOpen()) return [head, ...MT.ow.ui.toolPanel()];
    switch (S.tool) {
      case 'build': return [head, ...buildPanel()];
      case 'paint': return [head, ...paintPanel()];
      case 'props': return [head, ...propsPanel()];
      case 'elements': return [head, ...elementsPanel()];
      case 'stairs': return [head, ...stairsPanel()];
      default: return [head, ...selectPanel()];
    }
  }
  function selectPanel() {
    const m = S.map;
    const goLv = (e) => { const lv = MT.lvOf(e); if (lv !== S.level && MT.hasLevel(lv)) MT.setLevel(lv); };
    const cycle = (kind, arr) => {
      if (!arr.length) return;
      const cur = S.sel && S.sel.kind === kind ? S.sel.i : -1;
      const i = (cur + 1) % arr.length;
      goLv(arr[i]);
      MT.select({ kind, i });
      focusSel();
    };
    const stairs = MT.stairsOf();
    const inv = [
      ['Objets posés', m.props.length, () => { if (m.props.length) { const cur = MT.selectedProps(); const i = cur.length ? (cur[0] + 1) % m.props.length : 0; goLv(m.props[i]); MT.select({ kind: 'prop', list: [i] }); focusSel(); } }],
      ...(MT.multiOk() ? [['Escaliers', stairs.length, () => cycle('stair', stairs)]] : []),
      ['Lumières', m.lights.length, () => cycle('light', m.lights)],
      ['Portes payantes', m.doors.length, () => cycle('door', m.doors)],
      ['Armes murales', m.wallbuys.length, () => cycle('wallbuy', m.wallbuys)],
      ['Distributeurs d’atouts', m.perks.length, () => cycle('perk', m.perks)],
      ['Emplacements de boîte', m.boxes.length, () => cycle('box', m.boxes)],
      ['Panneaux', m.signs.length, () => cycle('sign', m.signs)],
      ['Apparitions au sol', m.risers.length, () => cycle('riser', m.risers)],
      ['Pièces nommées', m.zones.length, () => cycle('zone', m.zones)],
    ];
    return [
      section('Inventaire de la carte',
        h('p', { class: 'p-note' }, 'Cliquez pour sélectionner l’élément suivant et le montrer dans les vues.'),
        h('div', { class: 'inv' }, inv.map(([label, n, fn]) => h('button', { type: 'button', class: 'inv-row', disabled: !n, onclick: fn }, h('span', null, label), h('b', null, n)))),
        h('div', { class: 'p-actions' },
          btn('Départ', () => { goLv(m.spawn); MT.select({ kind: 'spawn' }); focusSel(); }, { ic: 'walk' }),
          m.power ? btn('Interrupteur', () => { goLv(m.power); MT.select({ kind: 'power' }); focusSel(); }, { ic: 'power' }) : null,
          m.amp ? btn('Pack-A-Punch', () => { goLv(m.amp); MT.select({ kind: 'amp' }); focusSel(); }) : null)),
      section('Astuces',
        h('ul', { class: 'p-tips' },
          h('li', null, 'Glisser un cadre dans le plan sélectionne plusieurs objets.'),
          h('li', null, 'R tourne la sélection (Maj+R : 90°), flèches : la déplace, Page haut/bas : la monte ou la descend.'),
          h('li', null, 'Ctrl+C / Ctrl+V : copier-coller des objets à l’endroit visé, Ctrl+D : dupliquer.'),
          h('li', null, 'Double-clic dans le plan : y regarder en 3D. Double-clic en 3D : s’approcher.'))),
    ];
  }
  function buildPanel() {
    const o = S.opts.build;
    const tiles = h('div', { class: 'tiles' }, ZS.TILES.map((t, k) => h('button', {
      type: 'button', class: `tile-btn ${o.tile === t.ch ? 'on' : ''}`, title: `${t.name} (${k + 1})`,
      onclick: () => { o.tile = t.ch; MT.emit('tool-opts'); },
    }, h('i', { style: { background: t.color } }), h('span', null, t.name), h('kbd', null, String(k + 1)))));
    return [
      section('Case à poser', tiles,
        h('p', { class: 'p-note' }, tileHelp(o.tile))),
      section('Forme',
        seg(o.shape, [['brush', 'Pinceau'], ['line', 'Ligne'], ['rect', 'Rectangle'], ['room', 'Pièce'], ['fill', 'Remplir']], (v) => { o.shape = v; MT.emit('tool-opts'); }),
        h('p', { class: 'p-note' }, {
          brush: 'Peint case par case en glissant.', line: 'Glisser : ligne droite (Maj : horizontale, verticale ou diagonale).',
          rect: 'Glisser : rectangle plein.', room: 'Glisser : une pièce entière (murs autour, sol dedans). Les portes et fenêtres déjà posées sur le pourtour sont gardées.',
          fill: 'Remplace toute la zone de cases identiques touchées.',
        }[o.shape]),
        o.shape === 'brush' ? field('Taille du pinceau', slider({ value: o.size, min: 1, max: 9, step: 1, fmt: (v) => `${v} × ${v}`, onCommit: (v) => { o.size = v; MT.emit('preview'); } }), '[ et ] pour changer') : null),
    ];
  }
  function tileHelp(ch) {
    return {
      '.': 'Sol des pièces : on y marche, les zombies aussi.',
      '#': 'Mur plein, de la hauteur de la carte. Les armes murales, l’interrupteur et les panneaux s’accrochent dessus.',
      W: 'Fenêtre barricadée : une pièce d’un côté, le vide ou la cour de l’autre. Les zombies arrivent par là.',
      D: 'Porte payante : les cases voisines forment une seule porte. Prix et type : outil Éléments ou onglet Sélection.',
      m: 'Muret de 1,10 m : bloque le passage mais pas les tirs au-dessus.',
      P: 'Pilier : bloque tout, plus petit visuellement qu’un mur.',
      x: 'Caisses empilées (décor qui bloque le passage).',
      o: 'Cour des zombies : sol extérieur devant les fenêtres, où ils sortent de terre.',
      ' ': 'Vide : l’extérieur de la carte.',
    }[ch] || '';
  }
  function paintPanel() {
    const o = S.opts.paint;
    const cur = o.tex;
    const preview = h('div', { class: 'tex-current' },
      h('span', { class: `tex-swatch ${cur === 'none' ? 'sky' : ''}`, style: cur !== 'none' && typeof MT.texThumb(cur) === 'string' ? { backgroundImage: `url(${MT.texThumb(cur)})` } : {} }),
      h('div', null, h('b', null, MT.tools.texName(cur)), h('small', null, cur === 'none' ? 'Plafond retiré : on voit le ciel' : `${cur}${ZS.TEXLIB[cur] ? ` · ${ZS.TEXLIB[cur].size[0]} × ${ZS.TEXLIB[cur].size[1]} m` : ''}`)));
    const setPreview = (id) => {
      const sw = preview.querySelector('.tex-swatch'), u = id === 'none' ? null : MT.texThumb(id);
      sw.classList.toggle('sky', id === 'none');
      sw.style.backgroundImage = typeof u === 'string' ? `url(${u})` : '';
      preview.querySelector('b').textContent = MT.tools.texName(id);
      preview.querySelector('small').textContent = id === 'none' ? 'Plafond retiré : on voit le ciel' : `${id}${ZS.TEXLIB[id] ? ` · ${ZS.TEXLIB[id].size[0]} × ${ZS.TEXLIB[id].size[1]} m` : ''}`;
    };
    const lib = library('tex', { value: cur, layer: o.layer, onPick: (id) => { o.tex = id; MT.pushRecent('tex', id); setPreview(id); MT.emit('preview'); } });
    return [
      section('Surface',
        seg(o.layer, [['floor', 'Sol'], ['wall', 'Murs'], ['ceil', 'Plafond']], (v) => { o.layer = v; if (v !== 'ceil' && o.tex === 'none') o.tex = 'concrete'; MT.emit('tool-opts'); MT.plan.baseRev++; MT.plan.need = true; }),
        h('p', { class: 'p-note' }, o.layer === 'wall' ? 'Visez un mur : c’est la face tournée vers vous qui change (en 3D) ou celle du côté du curseur (en plan).' : o.layer === 'ceil' ? 'Choisissez « Ciel ouvert » pour retirer le plafond (cours intérieures, puits de lumière).' : 'Le sol des pièces. Clic droit : revenir à la texture par défaut.')),
      section('Forme',
        seg(o.shape, [['brush', 'Pinceau'], ['rect', 'Rectangle'], ['room', 'Pièce entière']], (v) => { o.shape = v; MT.emit('tool-opts'); }),
        o.shape === 'brush' ? field('Taille', slider({ value: o.size, min: 1, max: 9, step: 1, fmt: (v) => `${v} × ${v}`, onCommit: (v) => { o.size = v; } })) : null),
      section('Texture', preview, lib,
        h('div', { class: 'p-actions' },
          btn('Importer une image…', () => UI.importImage(), { ic: 'image' }),
          btn('Textures par défaut', () => UI.setTab('map'), { title: 'Textures de toute la carte (onglet Carte)' }))),
    ];
  }
  function propsPanel() {
    const o = S.opts.props;
    const def = ZS.MODELS[o.model];
    const cur = h('div', { class: 'tex-current' }, h('span', { class: 'tex-swatch model' }), h('div', null, h('b', null, def ? def.name : '—'), h('small', null, def ? `${o.model}${def.wall ? ' · se colle aux murs' : ''}${def.solid && !def.decal ? ' · bloque le passage' : ''}` : '')));
    if (def) MT.modelThumb(o.model, (url) => { if (url) cur.firstChild.style.backgroundImage = `url(${url})`; });
    const lib = library('model', { value: o.model, onPick: (id) => {
      o.model = id;
      const d = ZS.MODELS[id];
      cur.querySelector('b').textContent = d ? d.name : id;
      cur.querySelector('small').textContent = d ? `${id}${d.wall ? ' · se colle aux murs' : ''}${d.solid && !d.decal ? ' · bloque le passage' : ''}` : '';
      cur.firstChild.style.backgroundImage = '';
      MT.modelThumb(id, (url) => { if (url && o.model === id) cur.firstChild.style.backgroundImage = `url(${url})`; });
      MT.emit('preview');
    } });
    return [
      section('Objet', cur, lib, h('div', { class: 'p-actions' }, btn('Importer un modèle 3D (.glb)…', () => UI.importModel(), { ic: 'upload' }))),
      section('Pose',
        field('Grille', seg(String(o.snap), [['0', 'Libre'], ['0.1', '10 cm'], ['0.25', '25 cm'], ['0.5', '50 cm'], ['1', '1 m']], (v) => { o.snap = parseFloat(v); MT.emit('tool-opts'); }), 'Alt : pose libre'),
        field('Rotation', h('span', { class: 'f-inline' },
          num({ value: o.rot, min: 0, max: 359, step: 1, unit: '°', digits: 1, width: '64px', onCommit: (v) => { o.rot = v; MT.emit('preview'); } }),
          select({ value: o.rotStep, options: [[15, 'pas de 15°'], [45, 'pas de 45°'], [90, 'pas de 90°']], onChange: (v) => { o.rotStep = parseInt(v, 10); } })), 'R / Maj+R'),
        check({ checked: o.randomRot, label: 'Rotation au hasard', onChange: (v) => { o.randomRot = v; } }),
        field('Taille', num({ value: o.scale, min: 0.1, max: 10, step: 0.05, unit: '×', onCommit: (v) => { o.scale = v; MT.emit('preview'); } })),
        field('Variation', slider({ value: o.randomScale, min: 0, max: 0.4, step: 0.05, fmt: (v) => `± ${Math.round(v * 100)} %`, onCommit: (v) => { o.randomScale = v; } })),
        field('Teinte', h('span', { class: 'f-inline' },
          check({ checked: !!o.tint, label: '', onChange: (v) => { o.tint = v ? (o.tintLast || '#c0a080') : null; MT.emit('tool-opts'); } }),
          color({ value: o.tint || o.tintLast || '#c0a080', onCommit: (v) => { o.tint = v; o.tintLast = v; } }))),
        field('Bloque le passage', select({ value: o.solid, options: [['auto', 'Selon l’objet'], ['yes', 'Oui'], ['no', 'Non']], onChange: (v) => { o.solid = v; } }))),
    ];
  }
  const KIND_ORDER = ['spawn', 'light', 'door', 'window', 'wallbuy', 'perk', 'box', 'power', 'amp', 'sign', 'riser', 'zone'];
  const KIND_DOT = { spawn: '#2fa84a', light: '#ffd27a', door: '#a8582c', window: '#b98538', wallbuy: '#f0ecdc', perk: '#b3231f', box: '#2f6fc8', power: '#e8c22a', amp: '#6a2fb0', sign: '#e8dfc8', riser: '#46a03c', zone: '#9ab0c0' };
  const KIND_HELP = {
    spawn: 'Clic : place le joueur au départ, glisser : choisit la direction du regard.',
    light: 'Clic : ajoute une lumière (au plafond, ou une applique si vous visez un mur en 3D).',
    door: 'Clic sur un mur : le transforme en porte payante. Glisser le long du mur : porte plus large.',
    window: 'Clic sur un mur extérieur : fenêtre barricadée (il faut une pièce d’un côté, l’extérieur de l’autre).',
    wallbuy: 'Clic sur un mur : dessine l’arme à la craie, achetable au mur.',
    perk: 'Clic sur le sol : distributeur, dos au mur le plus proche. R : le tourner.',
    box: 'Clic sur le sol : un emplacement possible de la boîte mystère (2 cases). R : sens.',
    power: 'Clic sur un mur : l’interrupteur qui rétablit le courant (un seul par carte).',
    amp: 'Clic sur le sol : le Pack-A-Punch (2 cases, un seul par carte). R : sens.',
    sign: 'Clic sur un mur : panneau peint (nom de pièce, indication).',
    riser: 'Clic ou glisser sur le sol : des zombies sortent de terre ici quand la pièce est ouverte.',
    zone: 'Clic dans une pièce : la nommer, lui donner une teinte ou ses propres textures.',
  };
  function elementsPanel() {
    const o = S.opts.elements;
    const kinds = h('div', { class: 'kinds' }, KIND_ORDER.map((k, i) => h('button', {
      type: 'button', class: `kind-btn ${o.kind === k ? 'on' : ''}`, onclick: () => { o.kind = k; MT.emit('tool-opts'); MT.emit('preview'); },
      title: i < 9 ? `${MT.tools.KIND_LABEL[k]} (${i + 1})` : MT.tools.KIND_LABEL[k],
    }, h('i', { style: { background: KIND_DOT[k] } }), h('span', null, MT.tools.KIND_LABEL[k]))));
    const opts = [];
    switch (o.kind) {
      case 'light': opts.push(...lightOptions(o.light)); break;
      case 'door':
        opts.push(field('Prix', num({ value: o.door.cost, min: 0, max: 99999, step: 50, unit: 'pts', digits: 0, onCommit: (v) => { o.door.cost = Math.round(v); } })));
        opts.push(field('Type', select({ value: o.door.type, options: Object.entries(ZS.DOOR_TYPES), onChange: (v) => { o.door.type = v; } })));
        break;
      case 'wallbuy':
        opts.push(field('Arme', select({ value: o.weapon, options: Object.entries(ZS.WEAPONS).map(([id, w]) => [id, `${w.name} — ${ZS.wallbuyPrice({ w: id })} pts`]), onChange: (v) => { o.weapon = v; } }), 'Prix modifiable ensuite (onglet Sélection).'));
        break;
      case 'perk':
        opts.push(field('Atout', select({ value: o.perk, options: Object.entries(ZS.PERKS).map(([id, p]) => [id, `${p.name} — ${p.cost} pts${p.power ? ' · courant' : ''}`]), onChange: (v) => { o.perk = v; } })));
        break;
      case 'box': case 'amp':
        opts.push(field('Sens', seg(o.boxVertical ? 'v' : 'h', [['h', 'Horizontal'], ['v', 'Vertical']], (v) => { o.boxVertical = v === 'v'; MT.emit('tool-opts'); MT.emit('preview'); }), 'R pour changer'));
        break;
      case 'sign':
        opts.push(field('Texte', text({ value: o.sign, maxLength: 28, upper: true, onCommit: (v) => { o.sign = v.toUpperCase(); } })));
        break;
      default: break;
    }
    return [section('Élément', kinds, h('p', { class: 'p-note' }, KIND_HELP[o.kind])), opts.length ? section('Réglages', ...opts) : null];
  }
  const LIGHT_PRESETS = [
    ['Chaude', { color: '#ffc78f', intensity: 1.8, range: 12, flicker: 0.1, powered: null }],
    ['Froide', { color: '#cfe8ff', intensity: 1.7, range: 12, flicker: 0.15, powered: null }],
    ['Alarme', { color: '#ff2a1a', intensity: 1.5, range: 7.5, flicker: 0.08, powered: '#e6eeff' }],
    ['Feu', { color: '#ff8a3c', intensity: 2.2, range: 9, flicker: 0.45, powered: null }],
    ['Toxique', { color: '#8dff74', intensity: 1.6, range: 9, flicker: 0.2, powered: null }],
    ['Panne', { color: '#ffd8a0', intensity: 1.4, range: 10, flicker: 0.7, powered: '#fff2d8' }],
  ];
  function lightOptions(L) {
    return [
      h('div', { class: 'presets' }, LIGHT_PRESETS.map(([name, p]) => h('button', { type: 'button', class: 'preset', onclick: () => { Object.assign(L, p); MT.emit('tool-opts'); } }, h('i', { style: { background: p.color } }), name))),
      field('Couleur', color({ value: L.color, onCommit: (v) => { L.color = v; } })),
      field('Intensité', slider({ value: L.intensity, min: 0.2, max: 6, step: 0.1, onCommit: (v) => { L.intensity = v; } })),
      field('Portée', slider({ value: L.range, min: 2, max: 40, step: 0.5, fmt: (v) => `${v} m`, onCommit: (v) => { L.range = v; } })),
      field('Scintillement', slider({ value: L.flicker, min: 0, max: 1, step: 0.05, onCommit: (v) => { L.flicker = v; } })),
      field('Luminaire', select({ value: L.fixture, options: Object.entries(ZS.LIGHT_FIXTURES), onChange: (v) => { L.fixture = v; } })),
      field('Avec le courant', h('span', { class: 'f-inline' },
        check({ checked: !!L.powered, label: '', onChange: (v) => { L.powered = v ? '#e6eeff' : null; MT.emit('tool-opts'); } }),
        L.powered ? color({ value: L.powered, onCommit: (v) => { L.powered = v; } }) : h('small', { class: 'f-hint' }, 'change de couleur quand le courant revient'))),
    ];
  }

  /* -------------------------------------------------- panneau sélection -- */
  function focusSel() {
    if (MT.isOpen()) { MT.ow.ui.focusSel(); return; }
    const s = S.sel, m = S.map;
    if (!s) return;
    let p = null;
    const E = MT.levelY();
    if (s.kind === 'prop') { const pr = m.props[s.list[0]]; if (pr) p = { x: pr.x - 0.5, z: pr.z - 0.5, y: E + (pr.y || 0) + 0.5 }; }
    else if (s.kind === 'light') { const l = m.lights[s.i]; p = { x: l.pos[0] - 0.5, z: l.pos[2] - 0.5, y: E + l.pos[1] - 0.5 }; }
    else if (s.kind === 'spawn') p = { x: m.spawn.pos[0] - 0.5, z: m.spawn.pos[1] - 0.5 };
    else if (s.kind === 'cell') p = { x: s.x, z: s.z };
    else if (s.kind === 'zone') { const d = m.zones[s.i]; if (d) p = { x: d.seed[0], z: d.seed[1] }; }
    else if (s.kind === 'stair') { const st = MT.stairsOf()[s.i]; if (st) { const c = ZS.stairPlan(st).cells; const mid = c[Math.floor(c.length / 2)]; p = { x: mid.x, z: mid.z, y: E + 1.2 }; } }
    else {
      const e = { perk: m.perks[s.i] && m.perks[s.i].cell, riser: m.risers[s.i], wallbuy: m.wallbuys[s.i] && m.wallbuys[s.i].cell, power: m.power && m.power.cell, sign: m.signs[s.i] && MT.signCell(m.signs[s.i]), box: m.boxes[s.i] && m.boxes[s.i].cells[0], amp: m.amp && m.amp.cells[0], door: m.doors[s.i] && m.doors[s.i].cells[0] }[s.kind];
      if (e) p = { x: e[0], z: e[1] };
    }
    if (p) MT.emit('focus', p);
  }
  UI.focusSel = focusSel;
  function selHead(title, sub, actions = []) {
    return h('div', { class: 'p-head sel' }, h('div', null, h('h2', null, title), sub ? h('p', null, sub) : null), h('div', { class: 'p-head-actions' },
      h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Montrer (F)', onclick: focusSel }, icon('eye')), ...actions));
  }
  const delBtn = () => h('button', { type: 'button', class: 'mt-icon-btn sm danger', title: 'Supprimer (Suppr)', onclick: () => MT.deleteSelection() }, icon('trash'));
  const dupBtn = () => h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Dupliquer (Ctrl+D)', onclick: () => MT.duplicateSelection() }, icon('copy'));
  function inspector() {
    if (MT.isOpen()) return MT.ow.ui.inspector();
    const s = S.sel, m = S.map;
    if (!s) {
      return [h('div', { class: 'p-empty' },
        h('p', null, 'Rien de sélectionné.'),
        h('p', { class: 'p-note' }, 'Outil Sélection (V) : cliquez sur un objet, une lumière, une porte, une machine… dans le plan ou en 3D.'))];
    }
    switch (s.kind) {
      case 'prop': return s.list.length > 1 ? propsMulti(s.list) : propInspector(s.list[0]);
      case 'light': return lightInspector(s.i);
      case 'door': {
        const d = m.doors[s.i];
        if (!d) return [];
        return [selHead('Porte payante', `${d.cells.length} case${d.cells.length > 1 ? 's' : ''} · relie deux pièces`, [delBtn()]), section('Réglages',
          field('Prix', num({ value: d.cost, min: 0, max: 99999, step: 50, unit: 'pts', digits: 0, onCommit: (v) => commit('Prix de la porte', 'all', (mm) => { mm.doors[s.i].cost = Math.round(v); }) })),
          field('Type', select({ value: d.type, options: Object.entries(ZS.DOOR_TYPES), onChange: (v) => commit('Type de porte', 'all', (mm) => { const dd = mm.doors[s.i]; const auto = dd.verb === ZS.DOOR_VERBS[dd.type]; dd.type = v; if (auto) dd.verb = ZS.DOOR_VERBS[v]; }) })),
          field('Message', text({ value: d.verb, maxLength: 60, onCommit: (v) => commit('Message de la porte', 'all', (mm) => { mm.doors[s.i].verb = v.trim() || ZS.DOOR_VERBS[mm.doors[s.i].type]; }) }), 'Affiché : « Appuyez sur F pour … »'),
          h('p', { class: 'p-note' }, 'Supprimer la porte la remplace par un mur.'))];
      }
      case 'wallbuy': {
        const w = m.wallbuys[s.i];
        if (!w) return [];
        const def = ZS.WEAPONS[w.w];
        return [selHead('Arme murale', def.name, [delBtn()]), section('Réglages',
          field('Arme', select({ value: w.w, options: Object.entries(ZS.WEAPONS).map(([id, x]) => [id, x.name]), onChange: (v) => commit('Arme murale', 'elements', (mm) => { mm.wallbuys[s.i].w = v; }) })),
          field('Prix', h('span', { class: 'f-inline' },
            check({ checked: typeof w.cost === 'number', label: 'personnalisé', onChange: (v) => commit('Prix de l’arme', 'elements', (mm) => { if (v) mm.wallbuys[s.i].cost = ZS.wallbuyPrice({ w: mm.wallbuys[s.i].w }); else delete mm.wallbuys[s.i].cost; }) }),
            typeof w.cost === 'number' ? num({ value: w.cost, min: 0, max: 99999, step: 50, unit: 'pts', digits: 0, onCommit: (v) => commit('Prix de l’arme', 'elements', (mm) => { mm.wallbuys[s.i].cost = Math.round(v); }) }) : h('small', { class: 'f-hint' }, `${ZS.wallbuyPrice(w)} pts (prix habituel)`)),
          'Les munitions coûtent la moitié du prix.'),
          field('Position', h('span', { class: 'f-hint' }, `mur x ${w.cell[0]} · z ${w.cell[1]}, face ${faceName(w.n)}`)))];
      }
      case 'perk': {
        const p = m.perks[s.i];
        if (!p) return [];
        const def = ZS.PERKS[p.p];
        return [selHead('Distributeur d’atout', `${def.name} · ${def.cost} pts${def.power ? ' · demande le courant' : ''}`, [delBtn()]), section('Réglages',
          field('Atout', select({ value: p.p, options: Object.entries(ZS.PERKS).map(([id, x]) => [id, x.name]), onChange: (v) => commit('Atout', 'elements', (mm) => { mm.perks[s.i].p = v; }) })),
          field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, faceName(p.face)), btn('Tourner', () => MT.tools.rotate(1), { ic: 'rotate' }))),
          h('p', { class: 'p-note' }, def.desc))];
      }
      case 'box': {
        const b = m.boxes[s.i];
        if (!b) return [];
        return [selHead('Emplacement de la boîte mystère', `n° ${s.i + 1} sur ${m.boxes.length}`, [delBtn()]), section('Réglages',
          check({ checked: m.boxStart === s.i, label: 'La boîte commence ici', onChange: (v) => { if (v) commit('Départ de la boîte', 'elements', (mm) => { mm.boxStart = s.i; }); } }),
          field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, faceName(b.face)), btn('Retourner', () => MT.tools.rotate(1), { ic: 'rotate' }))),
          h('p', { class: 'p-note' }, 'La boîte part ailleurs après quelques tirages (ours en peluche) : prévoyez plusieurs emplacements.'))];
      }
      case 'amp': return [selHead('Pack-A-Punch', 'Améliore l’arme tenue (5000 pts)', [delBtn()]), section('Réglages', field('Face', h('span', { class: 'f-inline' }, h('span', { class: 'f-hint' }, faceName(m.amp.face)), btn('Retourner', () => MT.tools.rotate(1), { ic: 'rotate' }))), h('p', { class: 'p-note' }, 'Il ne marche qu’avec le courant (interrupteur, ou « courant allumé au départ » dans l’onglet Carte).'))];
      case 'power': return [selHead('Interrupteur du courant', `mur x ${m.power.cell[0]} · z ${m.power.cell[1]}`, [delBtn()]), section('Infos', h('p', { class: 'p-note' }, 'Allume les distributeurs qui demandent le courant, le Pack-A-Punch et les lumières réglées « avec le courant ».'))];
      case 'sign': {
        const g = m.signs[s.i];
        if (!g) return [];
        return [selHead('Panneau', g.text, [delBtn()]), section('Réglages',
          field('Texte', text({ value: g.text, maxLength: 28, upper: true, onCommit: (v) => commit('Texte du panneau', 'elements', (mm) => { mm.signs[s.i].text = v.toUpperCase().slice(0, 28) || 'PANNEAU'; }) })),
          field('Hauteur', num({ value: g.pos[1], min: 0.3, max: 8, step: 0.05, unit: 'm', onCommit: (v) => commit('Hauteur du panneau', 'elements', (mm) => { mm.signs[s.i].pos[1] = round(v); }) })),
          field('Le long du mur', num({ value: g.n[0] ? g.pos[2] : g.pos[0], min: 0, max: 200, step: 0.25, unit: 'm', onCommit: (v) => commit('Déplacer le panneau', 'elements', (mm) => { const q = mm.signs[s.i]; if (q.n[0]) q.pos[2] = round(v); else q.pos[0] = round(v); }) })))];
      }
      case 'riser': { const r = m.risers[s.i]; if (!r) return []; return [selHead('Apparition de zombies', `case x ${r[0]} · z ${r[1]}`, [delBtn()]), section('Infos', h('p', { class: 'p-note' }, 'Utilisée seulement quand sa pièce est ouverte. Les plus proches du joueur servent le plus souvent ; aucune ne sert à moins de 3 m de lui.'))]; }
      case 'spawn': return [selHead('Point de départ', 'Où le joueur commence'), section('Réglages',
        field('Position', h('span', { class: 'f-inline' },
          num({ value: m.spawn.pos[0], min: 0, max: m.w, step: 0.25, unit: 'x', width: '72px', onCommit: (v) => commit('Départ', 'elements', (mm) => { mm.spawn.pos[0] = round(v); }) }),
          num({ value: m.spawn.pos[1], min: 0, max: m.h, step: 0.25, unit: 'z', width: '72px', onCommit: (v) => commit('Départ', 'elements', (mm) => { mm.spawn.pos[1] = round(v); }) }))),
        field('Regard', num({ value: (((deg(m.spawn.yaw) % 360) + 360) % 360), min: 0, max: 360, step: 15, unit: '°', digits: 1, onCommit: (v) => commit('Direction du départ', 'elements', (mm) => { mm.spawn.yaw = round(MT.util.wrapRad(rad(v)), 4); }) }), '0° : vers le haut du plan'))];
      case 'zone': return zoneInspector(s.i);
      case 'stair': return stairInspector(s.i);
      case 'cell': return cellInspector(s.x, s.z);
      default: return [];
    }
  }
  const faceName = (n) => (n[0] === 1 ? 'est' : n[0] === -1 ? 'ouest' : n[1] === 1 ? 'sud' : 'nord');
  function propInspector(i) {
    const m = S.map, pr = m.props[i];
    if (!pr) return [];
    const def = ZS.MODELS[pr.m];
    const set = (label, fn, kind = 'prop-move') => commit(label, kind, (mm) => fn(mm.props[i]), { list: [i] });
    const liveSet = (label, fn) => live(label, 'prop-move', (mm) => fn(mm.props[i]), { list: [i] });
    const thumbBox = h('span', { class: 'tex-swatch model' });
    if (def) MT.modelThumb(pr.m, (url) => { if (url) thumbBox.style.backgroundImage = `url(${url})`; });
    return [
      selHead(def ? def.name : `Modèle inconnu (${pr.m})`, def ? `${pr.m}${def.decal ? ' · décal' : ''}` : 'Ce modèle n’existe pas dans ce moteur : il ne s’affichera pas.', [dupBtn(), delBtn()]),
      section('Modèle', h('div', { class: 'tex-current' }, thumbBox, h('div', null, h('b', null, def ? def.name : pr.m), h('small', null, def ? (ZS.MODEL_CATS.find((c) => c[0] === def.cat) || [0, def.cat])[1] : ''))),
        h('div', { class: 'p-actions' },
          btn('Changer…', async () => { const id = await UI.pick('model', pr.m, 'Changer le modèle'); if (id) set('Changer le modèle', (p) => { p.m = id; }, 'props'); }),
          btn('Utiliser pour poser', () => { S.opts.props.model = pr.m; MT.setTool('props'); }))),
      section('Position',
        field('X', num({ value: pr.x, min: -60, max: m.w + 60, step: 0.05, unit: 'm', onLive: (v) => liveSet('Déplacer', (p) => { p.x = round(v); }), onCommit: (v) => set('Déplacer', (p) => { p.x = round(v); }) })),
        field('Z', num({ value: pr.z, min: -60, max: m.h + 60, step: 0.05, unit: 'm', onLive: (v) => liveSet('Déplacer', (p) => { p.z = round(v); }), onCommit: (v) => set('Déplacer', (p) => { p.z = round(v); }) })),
        field('Hauteur', num({ value: pr.y || 0, min: -5, max: 30, step: 0.05, unit: 'm', onLive: (v) => liveSet('Hauteur', (p) => { p.y = round(v); }), onCommit: (v) => set('Hauteur', (p) => { p.y = round(v); if (!p.y) delete p.y; }) }), 'Page haut / bas'),
        field('Rotation', num({ value: (((deg(pr.r || 0) % 360) + 360) % 360), min: -360, max: 720, step: 15, unit: '°', digits: 1, onLive: (v) => liveSet('Tourner', (p) => { p.r = round(MT.util.wrapRad(rad(v)), 4); }), onCommit: (v) => set('Tourner', (p) => { p.r = round(MT.util.wrapRad(rad(v)), 4); if (!p.r) delete p.r; }) }), 'R : +15° · Maj+R : +90°'),
        field('Taille', slider({ value: pr.s || 1, min: 0.1, max: 4, step: 0.05, fmt: (v) => `${v.toFixed(2)}×`, onLive: (v) => liveSet('Taille', (p) => { p.s = v; }), onCommit: (v) => set('Taille', (p) => { p.s = round(v); if (Math.abs(p.s - 1) < 1e-3) delete p.s; }) }))),
      section('Aspect',
        field('Teinte', h('span', { class: 'f-inline' },
          check({ checked: pr.c !== undefined, label: '', onChange: (v) => set('Teinte', (p) => { if (v) p.c = 0xc0a080; else delete p.c; }, 'props') }),
          pr.c !== undefined ? color({ value: pr.c, onCommit: (v) => set('Teinte', (p) => { p.c = ZS.parseColor(v, 0xffffff); }, 'props') }) : h('small', { class: 'f-hint' }, 'couleurs d’origine'))),
        field('Bloque le passage', select({ value: typeof pr.solid === 'boolean' ? (pr.solid ? 'yes' : 'no') : 'auto', options: [['auto', `Selon l’objet (${def && def.solid && !def.decal ? 'oui' : 'non'})`], ['yes', 'Oui'], ['no', 'Non']], onChange: (v) => set('Collision', (p) => { if (v === 'auto') delete p.solid; else p.solid = v === 'yes'; }, 'props') }))),
    ];
  }
  function propsMulti(list) {
    const m = S.map;
    const names = new Map();
    for (const i of list) { const d = ZS.MODELS[m.props[i].m]; const n = d ? d.name : m.props[i].m; names.set(n, (names.get(n) || 0) + 1); }
    return [
      selHead(`${list.length} objets`, 'Sélection multiple', [dupBtn(), delBtn()]),
      section('Contenu', h('ul', { class: 'p-list' }, [...names].slice(0, 12).map(([n, k]) => h('li', null, `${n}${k > 1 ? ` × ${k}` : ''}`)))),
      section('Ensemble',
        h('div', { class: 'p-actions' },
          btn('Tourner de 90°', () => MT.tools.rotate(1, true), { ic: 'rotate' }),
          btn('Poser au sol', () => commit('Poser au sol', 'prop-move', (mm) => { for (const i of list) delete mm.props[i].y; }, { list })),
          btn('Copier', () => MT.copySelection(), { ic: 'copy' })),
        field('Teinte commune', color({ value: '#c0a080', onCommit: (v) => commit('Teinte', 'props', (mm) => { for (const i of list) mm.props[i].c = ZS.parseColor(v, 0xffffff); }) }))),
    ];
  }
  function lightInspector(i) {
    const m = S.map, l = m.lights[i];
    if (!l) return [];
    const det = { i };
    const set = (label, fn) => commit(label, 'lights', (mm) => fn(mm.lights[i]));
    const liveSet = (label, fn) => live(label, 'light-live', (mm) => fn(mm.lights[i]), det);
    const powered = l.powered !== undefined && l.powered !== null;
    return [
      selHead('Lumière', `${ZS.LIGHT_FIXTURES[l.fixture]}${powered ? ' · change avec le courant' : ''}`, [dupBtn(), delBtn()]),
      section('Couleur',
        h('div', { class: 'presets' }, LIGHT_PRESETS.map(([name, p]) => h('button', { type: 'button', class: 'preset', onclick: () => set(`Lumière : ${name}`, (L) => {
          L.color = ZS.parseColor(p.color, 0xffffff); L.intensity = p.intensity; L.range = p.range; L.flicker = p.flicker;
          if (p.powered) { L.powered = ZS.parseColor(p.powered, 0xffffff); L.poweredRange = Math.max(p.range, 11); } else { delete L.powered; delete L.poweredRange; }
        }) }, h('i', { style: { background: p.color } }), name))),
        field('Couleur', color({ value: l.color, onLive: (v) => liveSet('Couleur', (L) => { L.color = ZS.parseColor(v, 0xffffff); }), onCommit: (v) => set('Couleur', (L) => { L.color = ZS.parseColor(v, 0xffffff); }) })),
        field('Intensité', slider({ value: l.intensity, min: 0, max: 8, step: 0.1, onLive: (v) => liveSet('Intensité', (L) => { L.intensity = v; }), onCommit: (v) => set('Intensité', (L) => { L.intensity = round(v, 2); }) })),
        field('Portée', slider({ value: l.range, min: 1, max: 60, step: 0.5, fmt: (v) => `${v} m`, onLive: (v) => liveSet('Portée', (L) => { L.range = v; }), onCommit: (v) => set('Portée', (L) => { L.range = v; }) })),
        field('Scintillement', slider({ value: l.flicker, min: 0, max: 1, step: 0.05, onCommit: (v) => set('Scintillement', (L) => { L.flicker = round(v, 2); }) }), 'Visible en jeu (ou bouton ampoule de la vue 3D)')),
      section('Courant',
        check({ checked: powered, label: 'Change quand le courant revient', onChange: (v) => set('Lumière et courant', (L) => { if (v) { L.powered = 0xe6eeff; L.poweredRange = Math.max(L.range, 11); } else { delete L.powered; delete L.poweredRange; } }) }),
        powered ? field('Couleur avec courant', color({ value: l.powered, onCommit: (v) => set('Couleur avec courant', (L) => { L.powered = ZS.parseColor(v, 0xffffff); }) })) : null,
        powered ? field('Portée avec courant', slider({ value: l.poweredRange || l.range, min: 1, max: 60, step: 0.5, fmt: (v) => `${v} m`, onCommit: (v) => set('Portée avec courant', (L) => { L.poweredRange = v; }) })) : null),
      section('Position',
        field('Luminaire', select({ value: l.fixture, options: Object.entries(ZS.LIGHT_FIXTURES), onChange: (v) => set('Luminaire', (L) => { L.fixture = v; }) })),
        field('X', num({ value: l.pos[0], min: -20, max: m.w + 20, step: 0.25, unit: 'm', onLive: (v) => liveSet('Déplacer', (L) => { L.pos[0] = v; }), onCommit: (v) => set('Déplacer', (L) => { L.pos[0] = round(v); }) })),
        field('Z', num({ value: l.pos[2], min: -20, max: m.h + 20, step: 0.25, unit: 'm', onLive: (v) => liveSet('Déplacer', (L) => { L.pos[2] = v; }), onCommit: (v) => set('Déplacer', (L) => { L.pos[2] = round(v); }) })),
        field('Hauteur', num({ value: l.pos[1], min: 0.2, max: 12, step: 0.05, unit: 'm', onLive: (v) => liveSet('Hauteur', (L) => { L.pos[1] = v; }), onCommit: (v) => set('Hauteur', (L) => { L.pos[1] = round(v); }) }), `Plafond à ${MT.wallHeight()} m`)),
    ];
  }
  function texField(label, value, onPick, { layer, allowDefault = false, defaultLabel = 'Par défaut' } = {}) {
    const sw = h('span', { class: `tex-swatch sm ${value === 'none' ? 'sky' : ''}` });
    if (value && value !== 'none') { const u = MT.texThumb(value); if (typeof u === 'string') sw.style.backgroundImage = `url(${u})`; }
    const b = h('button', { type: 'button', class: 'tex-field', onclick: async () => { const id = await UI.pick('tex', value, `Texture : ${label}`, { layer }); if (id) onPick(id); } },
      sw, h('span', null, value ? MT.tools.texName(value) : defaultLabel));
    return field(label, h('span', { class: 'f-inline' }, b, allowDefault && value ? h('button', { type: 'button', class: 'mt-icon-btn sm', title: 'Revenir à la texture par défaut', onclick: () => onPick(null) }, icon('close')) : null));
  }
  function zoneInspector(i) {
    const m = S.map, z = m.zones[i];
    if (!z) return [];
    const zi = MT.zoneIndexAt(z.seed[0], z.seed[1], z.lv | 0);
    const A = MT.analysis();
    const cells = zi >= 0 && A.zones[zi] ? A.zones[zi].cells : 0;
    const tintHex = ZS.colorHex(((Math.round(clamp(z.tint[0] / 1.2, 0, 1) * 255) << 16) | (Math.round(clamp(z.tint[1] / 1.2, 0, 1) * 255) << 8) | Math.round(clamp(z.tint[2] / 1.2, 0, 1) * 255)) >>> 0);
    const set = (label, fn) => commit(label, 'all', (mm) => fn(mm.zones[i]));
    // zombies de la pièce (moteur du jeu 1.8.0 ou plus récent) : le Fantassin par défaut
    const types = ZS.ZOMBIE_TYPES;
    let zombieSel = null;
    if (types && types.length > 1) {
      zombieSel = select({ value: z.zombie || types[0].id, options: types.map((t, k) => [t.id, `${t.name}${k ? '' : ' (par défaut)'}`]), onChange: (v) => set('Zombies de la pièce', (zz) => { zz.zombie = v; }) });
      zombieSel.dataset.field = 'zombie';
    }
    return [
      selHead(z.name, `Pièce de ${cells} case${cells > 1 ? 's' : ''}`, [delBtn()]),
      section('Nom',
        field('Nom', text({ value: z.name, maxLength: 40, onCommit: (v) => set('Nom de la pièce', (zz) => { zz.name = v.trim() || 'Pièce'; }) }), 'Affiché en jeu quand on y entre'),
        field('Teinte', color({ value: tintHex, onCommit: (v) => set('Teinte de la pièce', (zz) => { const n = ZS.parseColor(v, 0xffffff); zz.tint = [round(((n >> 16) & 255) / 255 * 1.2, 3), round(((n >> 8) & 255) / 255 * 1.2, 3), round((n & 255) / 255 * 1.2, 3)]; }) }), 'Assombrit ou colore les murs et le sol de la pièce'),
        btn('Teinte neutre', () => set('Teinte de la pièce', (zz) => { zz.tint = [1, 1, 1]; }))),
      ...(zombieSel ? [section('Zombies', field('Type', zombieSel, 'Ceux qui sortent des fenêtres et des apparitions au sol de la pièce'))] : []),
      section('Textures de la pièce',
        h('p', { class: 'p-note' }, 'Remplacent les textures par défaut de la carte dans cette pièce (la peinture case par case reste prioritaire).'),
        texField('Sol', z.floor, (id) => set('Sol de la pièce', (zz) => { if (id) zz.floor = id; else delete zz.floor; }), { allowDefault: true, defaultLabel: `Carte : ${MT.tools.texName(m.textures.floor)}` }),
        texField('Murs', z.wall, (id) => set('Murs de la pièce', (zz) => { if (id) zz.wall = id; else delete zz.wall; }), { allowDefault: true, defaultLabel: `Carte : ${MT.tools.texName(m.textures.wall)}` }),
        texField('Plafond', z.ceil, (id) => set('Plafond de la pièce', (zz) => { if (id) zz.ceil = id; else delete zz.ceil; }), { layer: 'ceil', allowDefault: true, defaultLabel: `Carte : ${MT.tools.texName(m.textures.ceil)}` })),
    ];
  }
  function cellInspector(x, z) {
    const m = S.map, ch = MT.tileAt(x, z);
    const zi = MT.zoneIndexAt(x, z), A = MT.analysis();
    const paintOne = (layer, id) => commit(id ? 'Peindre' : 'Texture par défaut', 'layers', () => { MT.paintCells(layer, [[x, z]], id); });
    const layerRow = (layer, label) => {
      const own = MT.layersOf()[layer][z][x] !== '.';
      return texField(label, MT.cellTexture(x, z, layer), (id) => paintOne(layer, id), { layer, allowDefault: own });
    };
    return [
      selHead(`Case x ${x} · z ${z}`, `${MT.tools.tileName(ch)}${zi >= 0 && A.zones[zi] ? ` · ${A.zones[zi].name}` : ''}`),
      section('Case', field('Type', select({ value: ch, options: ZS.TILES.map((t) => [t.ch, t.name]), onChange: (v) => commit('Changer la case', 'grid', () => { MT.setTiles([[x, z]], v); }) }))),
      section('Textures de cette case', layerRow('floor', 'Sol'), layerRow('wall', 'Murs autour'), layerRow('ceil', 'Plafond')),
      zi >= 0 ? section('Pièce', btn(MT.zoneDefOf(zi) >= 0 ? 'Réglages de la pièce' : 'Nommer cette pièce', () => {
        let di = MT.zoneDefOf(zi);
        if (di < 0) { commit('Nommer une pièce', 'all', (mm) => { mm.zones.push(MT.tagLv({ name: A.zones[zi].name, seed: [x, z], tint: [1, 1, 1] })); }); di = m.zones.length - 1; }
        MT.select({ kind: 'zone', i: di });
      })) : null,
    ];
  }

  /* ------------------------------------------------------ panneau carte -- */
  function mapPanel() {
    if (MT.isOpen()) return MT.ow.ui.mapPanel();
    const m = S.map;
    const a = m.ambiance, r = m.rules;
    const amb = (label, fn) => commit(label, 'ambiance', (mm) => fn(mm.ambiance));
    const ambLive = (label, fn) => live(label, 'ambiance', (mm) => fn(mm.ambiance));
    const thumb = h('div', { class: 'map-thumb' }, m.thumb ? h('img', { src: m.thumb, alt: '' }) : h('span', null, 'Pas de vignette'));
    return [
      section('Carte',
        field('Nom', text({ value: m.name, maxLength: 60, onCommit: (v) => commit('Nom de la carte', 'settings', (mm) => { mm.name = v.trim() || mm.name; }) })),
        field('Identifiant', h('span', { class: 'f-inline' }, h('code', null, S.id || m.id), btn('Changer…', () => UI.renameMap())), 'Nom du fichier ; sert aussi aux records des joueurs'),
        field('Description', h('textarea', { class: 'f-text', rows: 3, maxLength: 400, value: m.description, onchange: (e) => commit('Description', 'settings', (mm) => { mm.description = e.target.value.slice(0, 400); }) }), 'Affichée sous le nom dans le menu du jeu'),
        field('Auteur', text({ value: m.author, maxLength: 60, placeholder: 'Votre pseudo', onCommit: (v) => commit('Auteur', 'settings', (mm) => { mm.author = v.trim(); }) })),
        field('Taille', h('span', { class: 'f-inline' }, h('b', null, `${m.w} × ${m.h} cases`), btn('Redimensionner…', () => UI.resizeDialog())), `1 case = 1 m ; de ${ZS.MAP_MIN} à ${ZS.MAP_MAX}`),
        field('Décor aléatoire', h('span', { class: 'f-inline' }, h('code', null, String(m.seed)), btn('Tirer au sort', () => commit('Nouveau décor', 'all', (mm) => { mm.seed = Math.floor(Math.random() * 2147483647); }), { ic: 'rotate' })), 'Caisses penchées, arbres, planches : même graine = même décor')),
      MT.multiOk() ? levelsSection() : null,
      section('Textures par défaut',
        texField('Sol', m.textures.floor, (id) => commit('Sol par défaut', 'all', (mm) => { mm.textures.floor = id; })),
        texField('Murs', m.textures.wall, (id) => commit('Murs par défaut', 'all', (mm) => { mm.textures.wall = id; })),
        texField('Plafond', m.textures.ceil, (id) => commit('Plafond par défaut', 'all', (mm) => { mm.textures.ceil = id; }), { layer: 'ceil' }),
        texField('Murs, côté extérieur', m.textures.exterior, (id) => commit('Façades', 'all', (mm) => { mm.textures.exterior = id; })),
        texField('Sol extérieur', m.textures.ground, (id) => commit('Sol extérieur', 'all', (mm) => { mm.textures.ground = id; }))),
      section('Ambiance',
        field('Ciel', color({ value: a.sky, onLive: (v) => ambLive('Ciel', (x) => { x.sky = v; if (a.fogLinked !== false && a.sky === a.fog) x.fog = v; }), onCommit: (v) => amb('Couleur du ciel', (x) => { const same = x.fog === x.sky; x.sky = v; if (same) x.fog = v; }) })),
        field('Brouillard', color({ value: a.fog, onLive: (v) => ambLive('Brouillard', (x) => { x.fog = v; }), onCommit: (v) => amb('Couleur du brouillard', (x) => { x.fog = v; }) }), 'Même couleur que le ciel pour un horizon invisible'),
        field('Densité du brouillard', slider({ value: a.fogDensity, min: 0, max: 0.2, step: 0.005, fmt: (v) => v.toFixed(3), onLive: (v) => ambLive('Brouillard', (x) => { x.fogDensity = v; }), onCommit: (v) => amb('Densité du brouillard', (x) => { x.fogDensity = v; }) }), 'Visible en 3D avec le bouton Brouillard'),
        field('Lumière d’ambiance', slider({ value: a.hemi, min: 0, max: 3, step: 0.05, onLive: (v) => ambLive('Ambiance', (x) => { x.hemi = v; }), onCommit: (v) => amb('Lumière d’ambiance', (x) => { x.hemi = v; }) }), 'Coupez la lumière d’appoint de la vue 3D pour juger'),
        field('Ambiance (haut / bas)', h('span', { class: 'f-inline' },
          color({ value: a.hemiSky, onLive: (v) => ambLive('Ambiance', (x) => { x.hemiSky = v; }), onCommit: (v) => amb('Couleur d’ambiance', (x) => { x.hemiSky = v; }) }),
          color({ value: a.hemiGround, onLive: (v) => ambLive('Ambiance', (x) => { x.hemiGround = v; }), onCommit: (v) => amb('Couleur d’ambiance', (x) => { x.hemiGround = v; }) }))),
        field('Exposition', slider({ value: a.exposure, min: 0.3, max: 2.5, step: 0.02, onLive: (v) => ambLive('Exposition', (x) => { x.exposure = v; }), onCommit: (v) => amb('Exposition', (x) => { x.exposure = v; }) })),
        check({ checked: a.moon, label: 'Lune dans le ciel', onChange: (v) => amb('Lune', (x) => { x.moon = v; }) }),
        check({ checked: a.pipes, label: 'Tuyaux au plafond des pièces', onChange: (v) => commit('Tuyaux', 'all', (mm) => { mm.ambiance.pipes = v; }) }),
        field('Arbres morts dehors', slider({ value: a.trees, min: 0, max: 200, step: 1, fmt: (v) => `${v}`, onCommit: (v) => commit('Arbres', 'all', (mm) => { mm.ambiance.trees = Math.round(v); }) })),
        field('Hauteur des murs', slider({ value: a.wallHeight, min: 3, max: 8, step: 0.1, fmt: (v) => `${v.toFixed(1)} m`, onCommit: (v) => commit('Hauteur des murs', 'all', (mm) => { MT.setWallHeight(mm, round(v, 2)); }) }))),
      section('Règles de la partie',
        field('Points au départ', num({ value: r.startPoints, min: 0, max: 1000000, step: 100, unit: 'pts', digits: 0, onCommit: (v) => commit('Points au départ', 'settings', (mm) => { mm.rules.startPoints = Math.round(v); }) })),
        field('Arme de départ', select({ value: r.startWeapon, options: Object.entries(ZS.WEAPONS).map(([id, w]) => [id, w.name]), onChange: (v) => commit('Arme de départ', 'settings', (mm) => { mm.rules.startWeapon = v; }) })),
        check({ checked: r.powerOn, label: 'Courant allumé dès le départ', onChange: (v) => commit('Courant au départ', 'settings', (mm) => { mm.rules.powerOn = v; }) }),
        field('Armes de la boîte', boxWeapons(r), 'Aucune cochée : toutes les armes habituelles')),
      section('Menu du jeu',
        thumb,
        h('div', { class: 'p-actions' },
          btn('Vignette depuis la vue 3D', () => {
            const hv = MT.v3.helpers.visible;
            MT.v3.helpers.visible = false;
            let url;
            try { url = ZS.capture(MT.v3.cam, 320, 180); } finally { MT.v3.helpers.visible = hv; }
            commit('Vignette', 'settings', (mm) => { mm.thumb = url; });
            MT.toast('Vignette prise depuis la caméra 3D.', 'ok');
          }, { ic: 'camera', disabled: !MT.v3.visible }),
          m.thumb ? btn('Retirer', () => commit('Vignette', 'settings', (mm) => { mm.thumb = null; })) : null),
        h('div', { class: 'p-actions' },
          btn('Caméra du menu = vue 3D', () => {
            const c = MT.v3.cam, f = new THREE.Vector3(); c.getWorldDirection(f);
            const pos = [round(c.position.x, 2), round(c.position.y, 2), round(c.position.z, 2)];
            const look = [round(c.position.x + f.x * 8, 2), round(c.position.y + f.y * 8, 2), round(c.position.z + f.z * 8, 2)];
            commit('Caméra du menu', 'settings', (mm) => { mm.menuCam = { pos, look, sway: [0.8, 0.5] }; });
            MT.toast('Le menu du jeu montrera cette vue (avec un léger balancement).', 'ok');
          }, { ic: 'camera', disabled: !MT.v3.visible }),
          m.menuCam ? btn('Automatique', () => commit('Caméra du menu', 'settings', (mm) => { mm.menuCam = null; })) : null),
        h('p', { class: 'p-note' }, m.menuCam ? 'Caméra du menu réglée à la main.' : 'Caméra du menu automatique : depuis le départ, vers la boîte mystère.')),
    ];
  }
  function boxWeapons(r) {
    const pool = Object.entries(ZS.WEAPONS).filter(([, w]) => w.box > 0);
    const sel = new Set(r.boxWeapons || []);
    return h('div', { class: 'checks' }, pool.map(([id, w]) => check({
      checked: sel.has(id), label: w.name,
      onChange: (v) => commit('Armes de la boîte', 'settings', (mm) => {
        const s = new Set(mm.rules.boxWeapons || []);
        if (v) s.add(id); else s.delete(id);
        mm.rules.boxWeapons = s.size ? [...s] : null;
      }),
    })));
  }

  /* Pour les cartes ouvertes (ow-ui.js) : panneaux des objets, armes de la boîte, modifications. */
  UI.panels = { propsPanel, propInspector, propsMulti, boxWeapons };
  UI.edit = { live, commit };

  /* --------------------------------------------------------- étages --- */
  function levelsSection() {
    const m = S.map, lvs = MT.levels().slice().reverse();
    const count = (lv) => {
      const n = (arr) => arr.filter((e) => MT.lvOf(e) === lv).length;
      const st = MT.stairsOf().filter((x) => (x.lv | 0) === lv).length;
      const parts = [];
      if (st) parts.push(`${st} escalier${st > 1 ? 's' : ''} vers le haut`);
      const el = n(m.lights) + n(m.wallbuys) + n(m.perks) + n(m.boxes) + n(m.risers) + n(m.signs);
      if (el) parts.push(`${el} élément${el > 1 ? 's' : ''}`);
      const pr = n(m.props);
      if (pr) parts.push(`${pr} objet${pr > 1 ? 's' : ''}`);
      return parts.join(' · ') || 'vide';
    };
    return section('Niveaux',
      h('p', { class: 'p-note' }, 'Étages au-dessus du rez-de-chaussée, sous-sols en dessous. Un escalier monte d’un niveau au suivant ; la trémie (le trou dans le plancher) et les garde-corps sont automatiques.'),
      h('div', { class: 'inv' }, lvs.map((lv) => h('div', { class: `inv-row lvl ${lv === S.level ? 'on' : ''}` },
        h('button', { type: 'button', class: 'lvl-go', onclick: () => MT.setLevel(lv), title: 'Afficher ce niveau' }, h('span', null, MT.levelName(lv)), h('small', null, count(lv))),
        lv !== 0 ? h('button', { type: 'button', class: 'mt-icon-btn sm danger', disabled: !MT.removable(lv), title: MT.removable(lv) ? `Supprimer : ${MT.levelName(lv)}` : lv > 0 ? 'Supprimez d’abord les étages du dessus' : 'Supprimez d’abord les sous-sols du dessous', onclick: async () => {
          const ok = await UI.confirm(`Supprimer « ${MT.levelName(lv)} » et tout ce qui s’y trouve (éléments, objets, escaliers qui y arrivent ou en partent) ? Ctrl+Z pour revenir en arrière.`, { ok: 'Supprimer', danger: true, title: 'Supprimer un niveau' });
          if (ok) MT.removeLevel(lv);
        } }, icon('trash')) : null))),
      h('div', { class: 'p-actions' },
        btn('Ajouter un étage', () => MT.addLevel(1), { ic: 'up' }),
        btn('Ajouter un sous-sol', () => MT.addLevel(-1), { ic: 'down' })));
  }
  const DIR_OPTS = [['n', 'Nord ↑', [0, -1]], ['e', 'Est →', [1, 0]], ['s', 'Sud ↓', [0, 1]], ['w', 'Ouest ←', [-1, 0]]];
  const dirKey = (d) => (DIR_OPTS.find((o) => o[2][0] === d[0] && o[2][1] === d[1]) || DIR_OPTS[0])[0];
  const STAIR_HELP = {
    straight: 'Une volée droite, de 1 à 3 cases de large.',
    l: 'Une volée, un palier, puis une seconde volée à angle droit (quart tournant).',
    u: 'Deux volées côte à côte : demi-tour sur le palier. Prend deux fois la largeur.',
    spiral: 'Colimaçon : un bloc de 3 × 3 cases autour d’un noyau, on arrive au-dessus de la première marche.',
  };
  /* Hauteur d'une marche (environ 4 marches dessinées par case) et nombre de cases d'un escalier. */
  function stairInfo(st) {
    const LH = MT.wallHeight() + (ZS.SLAB || 0.3), plan = ZS.stairPlan(st);
    const ramps = plan.cells.filter((c) => c.kind !== 'flat');
    const rise = ramps.length ? (LH * (ramps[0].h1 - ramps[0].h0)) : LH;
    const steps = Math.max(1, Math.round(rise / 0.19));
    const slope = Math.round((Math.atan(rise) * 180) / Math.PI);
    return { LH, cells: plan.cells.length, step: Math.round((rise / steps) * 100), slope, steep: slope > 50 };
  }
  /* Réglages communs à l'outil (o = S.opts.stairs) et à un escalier posé (apply(fn)). */
  function stairControls(o, apply) {
    const matGrid = h('div', { class: 'stair-mats' }, Object.entries(ZS.STAIR_MATS).map(([id, mt]) => {
      const u = MT.texThumb(mt.tread);
      return h('button', { type: 'button', class: `stair-mat ${o.mat === id ? 'on' : ''}`, title: `${mt.name}${mt.open ? ' · marches ouvertes sur limons' : ' · marches pleines'}`, onclick: () => apply((x) => { x.mat = id; }) },
        h('span', { class: 'stair-sw', style: typeof u === 'string' ? { backgroundImage: `url(${u})` } : {} }), h('span', null, mt.name));
    }));
    const info = stairInfo(o.lv !== undefined || o.x !== undefined ? o : MT.stairFromOpts(0, 0, o));
    const two = o.shape === 'l' || o.shape === 'u';
    return [
      section('Forme',
        seg(o.shape, Object.entries(ZS.STAIR_SHAPES), (v) => apply((x) => { x.shape = v; if (v === 'spiral') x.w = 1; })),
        h('p', { class: 'p-note' }, STAIR_HELP[o.shape])),
      section('Matériau', matGrid),
      section('Dimensions',
        o.shape !== 'spiral' ? field('Largeur', seg(String(o.w || 1), [['1', '1 case'], ['2', '2 cases'], ['3', '3 cases']], (v) => apply((x) => { x.w = parseInt(v, 10); }))) : null,
        o.shape !== 'spiral' ? field(two ? '1re volée' : 'Longueur', slider({ value: o.n, min: 2, max: 12, step: 1, fmt: (v) => `${v} case${v > 1 ? 's' : ''}`, onCommit: (v) => apply((x) => { x.n = v; }) })) : null,
        two ? field('2e volée', slider({ value: o.n2 || o.n, min: 1, max: 12, step: 1, fmt: (v) => `${v} case${v > 1 ? 's' : ''}`, onCommit: (v) => apply((x) => { x.n2 = v; }) })) : null,
        o.shape !== 'straight' ? field('Virage', seg(String(o.turn === -1 ? -1 : 1), [['-1', '↶ à gauche'], ['1', '↷ à droite']], (v) => apply((x) => { x.turn = parseInt(v, 10); }))) : null,
        field('Sens de la montée', seg(dirKey(o.dir), DIR_OPTS.map(([k, l]) => [k, l]), (v) => apply((x) => { x.dir = DIR_OPTS.find((d) => d[0] === v)[2].slice(); })), 'R : tourner d’un quart de tour'),
        h('p', { class: `p-note ${info.steep ? 'warn' : ''}` }, `${info.cells} cases · marches d’environ ${info.step} cm · pente ${info.slope}°${info.steep ? ' : très raide, allongez-le' : ''}.`)),
    ];
  }
  function stairsPanel() {
    if (!MT.multiOk()) return [h('p', { class: 'p-note' }, 'Ce moteur du jeu ne connaît pas encore les étages (jeu 1.4.0 ou plus récent).')];
    const o = S.opts.stairs;
    const up = S.level + 1;
    const apply = (fn) => { fn(o); if (o.shape === 'spiral') o.w = 1; MT.emit('tool-opts'); MT.emit('preview'); };
    return [
      h('p', { class: 'p-note' }, `Monte du ${MT.levelName(S.level).toLowerCase()} à ${MT.levelName(up).toLowerCase()}${MT.hasLevel(up) ? '' : ' (ajouté à la pose)'}. Cliquez sur la case de la première marche ; la trémie s’ouvre toute seule à l’étage, des garde-corps bordent les vides. Les zombies montent et descendent comme le joueur.`),
      ...stairControls(o, apply),
    ];
  }
  function stairInspector(i) {
    const st = MT.stairsOf()[i];
    if (!st) return [];
    const mt = ZS.STAIR_MATS[st.mat] || ZS.STAIR_MATS.wood;
    const apply = (fn) => MT.updateStair(i, fn);
    return [
      selHead(`Escalier ${ZS.STAIR_SHAPES[st.shape].toLowerCase()}`, `${mt.name} · du ${MT.levelName(st.lv | 0).toLowerCase()} à ${MT.levelName((st.lv | 0) + 1).toLowerCase()}`, [delBtn()]),
      ...stairControls(st, apply),
      h('div', { class: 'p-actions' },
        btn('Utiliser pour poser', () => { Object.assign(S.opts.stairs, { shape: st.shape, mat: st.mat, w: st.w || 1, n: st.n, n2: st.n2 || st.n, turn: st.turn === -1 ? -1 : 1, dir: st.dir.slice() }); MT.setTool('stairs'); }),
        btn('Tourner', () => MT.tools.rotate(1), { ic: 'rotate' })),
    ];
  }

  /* ------------------------------------------------- panneau problèmes -- */
  function issuesPanel() {
    return [h('div', { class: 'p-head' }, icon('warn'), h('div', null, h('h2', null, 'Problèmes'), h('p', null, 'Les erreurs empêchent de publier la carte pour les joueurs (la partie de test reste possible) ; les conseils n’empêchent rien.'))), h('div', { id: 'mt-issues' })];
  }
  function refreshIssues() {
    const { errors, warnings } = S.issues;
    const n = errors.length + warnings.length;
    const b = $('mt-issues-btn');
    if (b) { $('mt-issues-count').textContent = String(n); b.classList.toggle('err', errors.length > 0); b.classList.toggle('warn', !errors.length && warnings.length > 0); }
    const box = $('mt-issues');
    if (!box) return;
    box.textContent = '';
    if (!n) { box.append(h('p', { class: 'p-ok' }, 'Aucun problème : la carte peut se jouer.')); return; }
    const item = (e, tone) => h('button', { type: 'button', class: `issue ${tone}`, disabled: !e.at, onclick: () => { if (!e.at) return; const lv = e.at[2] | 0; if (lv !== S.level && MT.hasLevel(lv)) MT.setLevel(lv); MT.emit('focus', { x: e.at[0], z: e.at[1] }); } },
      h('b', null, tone === 'err' ? 'Erreur' : 'Conseil'), h('span', null, e.msg), e.at ? h('small', null, `${e.at[2] ? `${MT.levelName(e.at[2])} · ` : ''}x ${e.at[0]} · z ${e.at[1]}`) : null);
    for (const e of errors) box.append(item(e, 'err'));
    for (const e of warnings) box.append(item(e, 'warn'));
  }
  let valTimer = 0;
  function validateNow() {
    clearTimeout(valTimer);
    if (!S.map) return;
    try {
      const v = S.map.open ? MT.ow.validate(S.map) : ZS.validateMap(S.map);
      S.issues = { errors: v.errors, warnings: v.warnings };
    } catch (e) { console.error(e); S.issues = { errors: [{ msg: `Carte illisible : ${e.message}`, at: null }], warnings: [] }; }
    MT.emit('issues');
  }
  function scheduleValidate() { clearTimeout(valTimer); valTimer = setTimeout(validateNow, 350); }
  MT.validateNow = validateNow;

  /* ----------------------------------------------------- enregistrement -- */
  UI.save = async () => {
    if (!S.map) return false;
    if (S.pending) MT.commit();
    try {
      if (S.source === 'new' || !S.id || S.id === 'sans-nom') {
        const id = MT.uniqueId(slug(S.map.name) || 'carte');
        return await MT.save({ id });
      }
      if (S.source === 'game' && !S.known.some((k) => k.id === S.id)) {
        const ok = await UI.confirm(`« ${S.map.name} » est une carte du jeu. Elle sera enregistrée dans votre atelier sous le même identifiant (${S.id}) : publiée avec la prochaine version, elle remplacera celle des joueurs.`, { ok: 'Enregistrer dans l’atelier', title: 'Modifier une carte du jeu' });
        if (!ok) return false;
      }
      return await MT.save();
    } catch (e) {
      MT.toast(`Enregistrement impossible : ${e.message}`, 'error');
      return false;
    }
  };
  UI.renameMap = async () => {
    const m = S.map;
    const nameI = h('input', { type: 'text', class: 'f-text', value: m.name, maxLength: 60 });
    const idI = h('input', { type: 'text', class: 'f-text', value: S.id || m.id, maxLength: 40, pattern: '[a-z0-9_-]+' });
    nameI.addEventListener('input', () => { idI.value = slug(nameI.value) || idI.value; });
    UI.modal({
      title: 'Enregistrer sous un autre identifiant',
      body: h('div', null,
        field('Nom', nameI), field('Identifiant', idI, 'Lettres minuscules, chiffres, - et _ (40 au plus)'),
        h('p', { class: 'p-note' }, 'Crée une copie sous ce nouvel identifiant ; l’ancien fichier reste dans l’atelier.')),
      buttons: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: async () => {
        const id = slug(idI.value);
        if (!id) { MT.toast('Identifiant invalide.', 'error'); return false; }
        if (id !== S.id && (S.known.some((k) => k.id === id) || MT.gameMaps().byId[id])) {
          const ok = await UI.confirm(`Une carte « ${id} » existe déjà. La remplacer ?`, { ok: 'Remplacer', danger: true });
          if (!ok) return false;
        }
        commit('Renommer', 'settings', (mm) => { mm.name = nameI.value.trim() || mm.name; mm.id = id; });
        S.source = 'workspace';
        try { await MT.save({ id }); } catch (e) { MT.toast(`Enregistrement impossible : ${e.message}`, 'error'); return false; }
        refreshTop(); renderPanel();
        return true;
      } }],
    });
  };
  UI.resizeDialog = () => {
    const m = S.map;
    let ax = 1, az = 1;
    const wI = h('input', { type: 'number', class: 'f-num', value: m.w, min: ZS.MAP_MIN, max: ZS.MAP_MAX });
    const hI = h('input', { type: 'number', class: 'f-num', value: m.h, min: ZS.MAP_MIN, max: ZS.MAP_MAX });
    const anchors = h('div', { class: 'anchor' });
    const drawA = () => {
      anchors.textContent = '';
      for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) anchors.append(h('button', { type: 'button', class: x === ax && z === az ? 'on' : '', title: 'Ancrage', onclick: () => { ax = x; az = z; drawA(); } }));
    };
    drawA();
    UI.modal({
      title: 'Taille de la carte',
      body: h('div', null,
        field('Largeur (x)', wI), field('Hauteur (z)', hI),
        field('Ancrage', anchors, 'Côté qui reste en place : la carte grandit ou rétrécit de l’autre côté'),
        h('p', { class: 'p-note' }, 'Ce qui sort de la carte est supprimé (annulable avec Ctrl+Z).')),
      buttons: [{ label: 'Annuler' }, { label: 'Appliquer', kind: 'primary', onClick: () => {
        const W = parseInt(wI.value, 10), H = parseInt(hI.value, 10);
        if (!Number.isFinite(W) || !Number.isFinite(H)) return false;
        MT.resizeMap(W, H, ax, az);
        MT.toast(`Carte : ${S.map.w} × ${S.map.h}`, 'ok');
        return true;
      } }],
    });
  };

  /* ------------------------------------------------- import d'images --- */
  function loadImage(src) {
    return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Image illisible.')); i.src = src; });
  }
  UI.importImage = async () => {
    let file;
    try { file = await MT.api.importImage(); } catch (e) { MT.toast(e.message, 'error'); return; }
    if (!file) return;
    let img;
    try { img = await loadImage(file.dataUrl); } catch (e) { MT.toast(e.message, 'error'); return; }
    // réduite à 1024 px au plus ; PNG si elle a de la transparence, sinon JPEG
    const k = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(4, Math.round(img.width * k)); c.height = Math.max(4, Math.round(img.height * k));
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    let alpha = false;
    try { const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { alpha = true; break; } } catch (e) { alpha = false; }
    const data = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88);
    const base = String(file.name || 'image').replace(/\.[a-z0-9]+$/i, '');
    const nameI = h('input', { type: 'text', class: 'f-text', value: base.slice(0, 60), maxLength: 60 });
    const wI = h('input', { type: 'number', class: 'f-num', value: 2, min: 0.25, max: 20, step: 0.25 });
    const hI = h('input', { type: 'number', class: 'f-num', value: round((2 * c.height) / c.width, 2), min: 0.25, max: 20, step: 0.25 });
    let lockRatio = true;
    wI.addEventListener('input', () => { if (lockRatio) hI.value = round((parseFloat(wI.value) * c.height) / c.width, 2); });
    const fitC = h('input', { type: 'checkbox' });
    const rough = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: 0.85, class: 'f-range' });
    const prev = h('div', { class: 'import-prev', style: { backgroundImage: `url(${data})` } });
    UI.modal({
      title: 'Importer une image comme texture',
      body: h('div', { class: 'import' }, prev, h('div', null,
        field('Nom', nameI),
        field('Taille réelle', h('span', { class: 'f-inline' }, wI, h('em', null, '×'), hI, h('em', null, 'm')), 'Une répétition de l’image couvre cette surface'),
        h('label', { class: 'f-check' }, (() => { const i = h('input', { type: 'checkbox', checked: true }); i.addEventListener('change', () => { lockRatio = i.checked; }); return i; })(), h('i'), h('span', null, 'Garder les proportions')),
        h('label', { class: 'f-check' }, fitC, h('i'), h('span', null, 'Étirer sur toute la hauteur des murs')),
        field('Rugosité', rough, '0 : brillant, 1 : mat'),
        h('p', { class: 'p-note' }, `${c.width} × ${c.height} px · ${alpha ? 'PNG (transparence)' : 'JPEG'} · ${Math.round((data.length * 0.75) / 1024)} Ko. L’image est gardée dans votre bibliothèque et copiée dans chaque carte qui l’utilise.`))),
      buttons: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: async () => {
        const name = nameI.value.trim() || base;
        let id = `u_${slug(name, 30).replace(/-/g, '_') || 'image'}`;
        for (let n = 2; S.library[id] || ZS.TEXLIB[id]; n++) id = `u_${slug(name, 26).replace(/-/g, '_') || 'image'}_${n}`;
        const t = { name, data, size: [clamp(parseFloat(wI.value) || 2, 0.25, 20), clamp(parseFloat(hI.value) || 2, 0.25, 20)], rough: parseFloat(rough.value), fit: fitC.checked };
        try { await MT.addToLibrary(id, t); } catch (e) { MT.toast(`Import impossible : ${e.message}`, 'error'); return false; }
        S.opts.paint.tex = id;
        UI.lib.tex.cat = 'import';
        MT.pushRecent('tex', id);
        MT.emit('tool-opts');
        MT.toast(`Texture importée : ${name}`, 'ok');
        return true;
      } }],
    });
  };

  /* ------------------------------------------------ import de modèles --- */
  UI.importModel = async () => {
    if (!THREE.GLTFLoader) { MT.toast('Ce moteur ne sait pas lire les modèles .glb (jeu 1.1.0 ou plus récent).', 'error'); return; }
    let file;
    try { file = await MT.api.importModel(); } catch (e) { MT.toast(e.message, 'error'); return; }
    if (!file) return;
    let gltf;
    try {
      const bin = atob(file.dataUrl.slice(file.dataUrl.indexOf(',') + 1));
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      gltf = await new Promise((ok, ko) => new THREE.GLTFLoader().parse(u8.buffer, '', ok, ko));
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      MT.toast(`Modèle illisible : ${msg}${/draco|meshopt|ktx/i.test(msg) ? ' — modèle compressé : réexportez-le sans compression (Blender : Fichier → Exporter → glTF, sans Draco).' : ''}`, 'error');
      return;
    }
    const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) { MT.toast('Ce fichier ne contient aucun maillage visible.', 'error'); return; }
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    let tris = 0, skinned = false;
    scene.traverse((o) => { if (o.isMesh && o.geometry) { const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } if (o.isSkinnedMesh) skinned = true; });
    const base = String(file.name || 'modele').replace(/\.glb$/i, '');
    const nameI = h('input', { type: 'text', class: 'f-text', value: base.slice(0, 60), maxLength: 60 });
    const plausible = size.y > 0.05 && size.y < 30;
    const hI = h('input', { type: 'number', class: 'f-num', value: round(plausible ? size.y : 1, 2), min: 0.05, max: 60, step: 0.05 });
    const solidC = h('input', { type: 'checkbox', checked: true });
    const wallC = h('input', { type: 'checkbox' });
    const dims = h('small', { class: 'f-hint' });
    const upd = () => { const k = (parseFloat(hI.value) || 1) / size.y; dims.textContent = `Une fois posé : ${round(size.x * k, 2)} × ${round(size.y * k, 2)} × ${round(size.z * k, 2)} m (largeur × hauteur × profondeur)`; };
    hI.addEventListener('input', upd);
    upd();
    const mb = (file.dataUrl.length * 0.75) / 1048576;
    UI.modal({
      title: 'Importer un modèle 3D',
      body: h('div', null,
        field('Nom', nameI),
        field('Hauteur réelle', h('span', { class: 'f-inline' }, hI, h('em', null, 'm')), dims),
        h('label', { class: 'f-check' }, solidC, h('i'), h('span', null, 'Bloque le passage (joueur et zombies)')),
        h('label', { class: 'f-check' }, wallC, h('i'), h('span', null, 'Se colle aux murs (le dos du modèle contre le mur)')),
        h('p', { class: 'p-note' }, `Fichier : ${round(size.x, 3)} × ${round(size.y, 3)} × ${round(size.z, 3)} unités · ${Math.round(tris).toLocaleString('fr-BE')} triangles · ${mb.toFixed(1)} Mo.${skinned ? ' Modèle animé : il sera figé dans sa pose de repos.' : ''}${tris > 150000 ? ' Beaucoup de triangles : préférez une version allégée si vous en posez plusieurs.' : ''}`),
        h('p', { class: 'p-note' }, 'Le modèle est gardé dans votre bibliothèque (catégorie « Mes modèles ») et copié dans chaque carte qui l’utilise, donc publié avec elle.')),
      buttons: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: async () => {
        const H = clamp(parseFloat(hI.value) || 1, 0.05, 60);
        const k = H / size.y;
        const wall = wallC.checked;
        const offset = [round(-center.x, 5), round(-box.min.y, 5), round(wall ? -box.min.z : -center.z, 5)];
        const fbox = [(box.min.x + offset[0]) * k, 0, (box.min.z + offset[2]) * k, (box.max.x + offset[0]) * k, (box.max.y + offset[1]) * k, (box.max.z + offset[2]) * k].map((v) => round(v, 4));
        const name = nameI.value.trim() || base;
        let id = `u_${slug(name, 30).replace(/-/g, '_') || 'modele'}`;
        for (let n = 2; S.modelLib[id] || ZS.MODELS[id]; n++) id = `u_${slug(name, 26).replace(/-/g, '_') || 'modele'}_${n}`;
        try { await MT.addModelToLibrary(id, { name, data: file.dataUrl, scale: round(k, 6), offset, box: fbox, solid: solidC.checked, wall }); } catch (e) { MT.toast(`Import impossible : ${e.message}`, 'error'); return false; }
        S.opts.props.model = id;
        UI.lib.model.cat = 'import';
        MT.pushRecent('model', id);
        MT.emit('tool-opts');
        MT.toast(`Modèle importé : ${name}`, 'ok');
        return true;
      } }],
    });
  };

  /* ---------------------------------------------------------- clavier --- */
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && !(el.tagName === 'INPUT' && ['checkbox', 'radio', 'range', 'button', 'color'].includes(el.type));
  function onKey(e) {
    if (ZS.G.state !== 'editor') return;
    if (UI.modalOpen) { if (e.key === 'Escape' && UI.closeModal) { e.preventDefault(); UI.closeModal(); } return; }
    if (MT.v3.key(e, true)) { e.preventDefault(); return; }
    if (MT.isOpen() && MT.ow.onKey && !typing(e.target) && !(e.ctrlKey || e.metaKey) && MT.ow.onKey(e)) { e.preventDefault(); return; }
    const ctrl = e.ctrlKey || e.metaKey;
    const t = typing(e.target);
    if (ctrl) {
      const k = e.code;
      if (k === 'KeyS') { e.preventDefault(); UI.save(); return; }
      if (t) return;
      if (k === 'KeyZ') { e.preventDefault(); if (e.shiftKey) MT.redo(); else MT.undo(); return; }
      if (k === 'KeyY') { e.preventDefault(); MT.redo(); return; }
      if (k === 'KeyD') { e.preventDefault(); MT.duplicateSelection(); return; }
      if (k === 'KeyC') { e.preventDefault(); MT.copySelection(); return; }
      if (k === 'KeyV') { e.preventDefault(); const p = lastCursor; if (p) MT.paste(p.wx, p.wz); else MT.toast('Visez l’endroit où coller (plan ou 3D).', 'warn'); return; }
      if (k === 'KeyA') { e.preventDefault(); const list = S.map.props.map((p, i) => (MT.here(p) ? i : -1)).filter((i) => i >= 0); if (list.length) MT.select({ kind: 'prop', list }); return; }
      if ((k === 'ArrowUp' || k === 'ArrowDown') && MT.multiOk()) {
        e.preventDefault();
        const lvs = MT.levels(), i = lvs.indexOf(S.level) + (k === 'ArrowUp' ? 1 : -1);
        if (i >= 0 && i < lvs.length) { MT.setLevel(lvs[i]); MT.toast(MT.levelName(lvs[i])); }
        return;
      }
      return;
    }
    if (e.key === 'F5') { e.preventDefault(); MT.test(e.shiftKey); return; }
    if (e.key === 'F1') { e.preventDefault(); UI.help(); return; }
    if (t) return;
    if (e.repeat && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'BracketLeft', 'BracketRight'].includes(e.code)) return;
    const tool = MT.tools.available().find((x) => x.key === e.code);
    if (tool && !e.altKey) { e.preventDefault(); MT.setTool(tool.id); return; }
    switch (e.code) {
      case 'Escape':
        if (MT.tools.drag) MT.tools.cancel();
        else if (S.sel) MT.select(null);
        else if (S.tool !== 'select') MT.setTool('select');
        break;
      case 'Delete': case 'Backspace': e.preventDefault(); MT.deleteSelection(); break;
      case 'KeyR': MT.tools.rotate(e.altKey ? -1 : 1, e.shiftKey); break;
      case 'KeyF': focusSel(); break;
      case 'KeyH': MT.v3.topView(); break;
      case 'Tab': e.preventDefault(); UI.setView(UI.view === 'split' ? 'plan' : UI.view === 'plan' ? '3d' : 'split'); break;
      case 'Space': MT.plan.space = true; e.preventDefault(); break;
      case 'BracketLeft': case 'BracketRight': {
        const o = S.tool === 'paint' ? S.opts.paint : S.opts.build;
        o.size = clamp(o.size + (e.code === 'BracketRight' ? 1 : -1), 1, 9);
        MT.emit('tool-opts'); MT.emit('preview');
        MT.toast(`Pinceau : ${o.size} × ${o.size}`);
        break;
      }
      case 'PageUp': e.preventDefault(); MT.tools.raise(e.shiftKey ? 0.5 : 0.05); break;
      case 'PageDown': e.preventDefault(); MT.tools.raise(e.shiftKey ? -0.5 : -0.05); break;
      case 'ArrowUp': e.preventDefault(); MT.tools.nudge(0, -1, e.shiftKey); break;
      case 'ArrowDown': e.preventDefault(); MT.tools.nudge(0, 1, e.shiftKey); break;
      case 'ArrowLeft': e.preventDefault(); MT.tools.nudge(-1, 0, e.shiftKey); break;
      case 'ArrowRight': e.preventDefault(); MT.tools.nudge(1, 0, e.shiftKey); break;
      default: {
        const d = /^Digit([1-9])$/.exec(e.code);
        if (d) {
          const n = parseInt(d[1], 10) - 1;
          if (MT.isOpen()) { if (S.tool === 'elements' && MT.ow.KIND_KEYS[n]) { S.opts.ow.kind = MT.ow.KIND_KEYS[n]; MT.emit('tool-opts'); MT.emit('preview'); } }
          else if (S.tool === 'build' && ZS.TILES[n]) { S.opts.build.tile = ZS.TILES[n].ch; MT.emit('tool-opts'); }
          else if (S.tool === 'elements' && KIND_ORDER[n]) { S.opts.elements.kind = KIND_ORDER[n]; MT.emit('tool-opts'); MT.emit('preview'); }
        }
      }
    }
  }
  function onKeyUp(e) {
    MT.v3.key(e, false);
    if (e.code === 'Space') MT.plan.space = false;
  }
  let lastCursor = null;
  MT.on('cursor', (p) => { if (p) lastCursor = p; });

  /* --------------------------------------------------------------- aide -- */
  UI.help = () => {
    const rows = [
      ['Outils', 'V sélection · B construire · T textures · O objets · G éléments de jeu · K escaliers'],
      ['Étages', 'Ctrl+↑ / Ctrl+↓ : niveau du dessus / du dessous · bouton + de la barre du haut : ajouter un étage ou un sous-sol · le plan montre le niveau du dessous en transparence, la 3D cache les niveaux au-dessus'],
      ['Annuler / rétablir', 'Ctrl+Z · Ctrl+Y (ou Ctrl+Maj+Z)'],
      ['Enregistrer', 'Ctrl+S (copie de secours automatique toutes les 40 s)'],
      ['Tester', 'F5 au départ · Maj+F5 depuis la caméra 3D · Échap puis « Retour aux Mod Tools »'],
      ['Sélection', 'Suppr supprime · Ctrl+D duplique · Ctrl+C / Ctrl+V copie-colle · Ctrl+A tous les objets'],
      ['Déplacer', 'glisser · flèches (Maj : fin) · Page haut/bas : hauteur · R : tourner (Maj : 90°, Alt : sens inverse)'],
      ['Plan', 'molette : zoom · clic milieu, clic droit ou Espace+glisser : déplacer · double-clic : voir en 3D'],
      ['3D', 'clic droit maintenu : regarder · ZQSD/WASD : avancer · A/E : descendre/monter · Maj : vite · molette : avancer vers le curseur · clic milieu : glisser · Alt+glisser : tourner autour · F : montrer la sélection · H : vue de dessus'],
      ['Construire', '1 à 9 : type de case · [ et ] : taille du pinceau · clic droit : effacer · Alt+clic : pipette'],
      ['Vues', 'Tab : plan / 3D / les deux · glisser la séparation pour la taille'],
      ['Carte ouverte (Khamsin)', 'V sélection · O objets · G éléments de jeu (1 départ · 2 arme au mur · 3 atout · 4 boîte · 5 véhicule · 6 jerricans · 7 disjoncteur · 8 lieu nommé) · les éléments se recalent seuls (mur, sol) · plan : de 4 km à quelques mètres · 3D : Maj pour voler très vite'],
      ['Monde ouvert : terrain', 'T relief (monter, creuser, aplanir, adoucir, effacer ; clic droit dans le plan : l’inverse ; Échap : annuler le coup) · P sol (sable, roche, oasis…) · L routes (clic par point, Entrée ou double-clic pour finir, Retour arrière : dernier point) · B bâtiments (R : quart de tour) · [ et ] : taille du pinceau · les sept lieux de Khamsin et les routes d’origine restent fixes · nouvelle carte « Désert vierge » : le désert sans ses lieux'],
    ];
    UI.modal({
      title: 'Aide des Mod Tools', wide: true,
      body: h('div', { class: 'help' },
        h('div', { class: 'help-steps' },
          h('h3', null, 'Faire une carte en 6 étapes'),
          h('ol', null,
            h('li', null, h('b', null, 'Construire'), ' les pièces (forme « Pièce » : murs autour, sol dedans), puis les ', h('b', null, 'fenêtres'), ' sur les murs extérieurs avec de la cour devant.'),
            h('li', null, 'Relier les pièces par des ', h('b', null, 'portes payantes'), ' (outil Éléments) et nommer les pièces. Pour des étages : outil ', h('b', null, 'Escaliers'), ' (K), qui ajoute l’étage du dessus s’il manque.'),
            h('li', null, 'Poser le ', h('b', null, 'départ'), ', les ', h('b', null, 'armes murales'), ', les ', h('b', null, 'distributeurs'), ', les emplacements de ', h('b', null, 'boîte mystère'), ', l’', h('b', null, 'interrupteur'), ' et les ', h('b', null, 'lumières'), '.'),
            h('li', null, 'Habiller : ', h('b', null, 'textures'), ' (sol, murs, plafond, ciel ouvert) et ', h('b', null, 'objets'), ' de la bibliothèque, ou vos propres images.'),
            h('li', null, 'Régler l’', h('b', null, 'ambiance'), ' et les ', h('b', null, 'règles'), ' (onglet Carte), puis ', h('b', null, 'Tester'), ' (F5).'),
            h('li', null, h('b', null, 'Cartes → Dans le jeu'), ' pour la publier avec la prochaine version du jeu (outil de publication du launcher).'))),
        h('table', { class: 'help-keys' }, h('tbody', null, rows.map(([a, b]) => h('tr', null, h('th', null, a), h('td', null, b)))))),
      buttons: [{ label: 'Fermer', kind: 'primary' }],
    });
  };

  /* -------------------------------------------------------------- quitter -- */
  UI.quit = async () => {
    if (MT.isDirty()) {
      const r = await UI.choice(`Enregistrer les modifications de « ${S.map.name} » avant de fermer ?`, [
        { label: 'Annuler', value: null }, { label: 'Ne pas enregistrer', value: 'discard', kind: 'danger' }, { label: 'Enregistrer', value: 'save', kind: 'primary' },
      ], 'Fermer les Mod Tools');
      if (!r) return;
      if (r === 'save' && !(await UI.save())) return;
      if (r === 'discard') { try { await MT.api.writeRecovery(S.id || S.map.id, null); } catch (e) { /* rien */ } }
    }
    MT.api.close(true);
  };
})();
