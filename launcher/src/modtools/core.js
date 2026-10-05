'use strict';
/* =========================================================================
   Mod Tools de Zombie Survival — noyau
   Le launcher charge ces fichiers (zsgame://editor/modtools/) par-dessus le
   moteur du jeu, et seulement quand la clé de publication de l'auteur est
   présente sur le PC. Le moteur expose window.ZS (cartes, rendu, bibliothèques).

   Ce fichier : utilitaires, état de l'éditeur, historique (annuler/rétablir),
   opérations sur la carte (cases, portes, pièces, éléments, objets), fichiers.
   ========================================================================= */
(() => {
  const MT = (window.MT = window.MT || {});
  const ZS = window.ZS;

  /* ------------------------------------------------------- utilitaires -- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const round = (v, n = 3) => { const k = 10 ** n; return Math.round(v * k) / k; };
  function deep(v) {
    if (Array.isArray(v)) return v.map(deep);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = deep(v[k]);
      return o;
    }
    return v;
  }
  const $ = (id) => document.getElementById(id);
  const PROPS_AS_FIELDS = new Set(['value', 'checked', 'disabled', 'hidden', 'title', 'textContent', 'selected', 'tabIndex', 'type', 'min', 'max', 'step', 'placeholder', 'maxLength', 'htmlFor', 'src', 'alt', 'draggable']);
  /* Création d'élément : h('button', { class: 'x', onclick: fn }, 'texte', enfant…) */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (PROPS_AS_FIELDS.has(k)) e[k] = v;
        else e.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of kids.flat(Infinity)) {
      if (c === undefined || c === null || c === false) continue;
      e.append(c && c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }
  function slug(s, max = 40) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
  }
  function debounce(fn, ms) {
    let t = 0, args = null;
    const f = (...a) => { args = a; clearTimeout(t); t = setTimeout(() => { t = 0; fn(...args); }, ms); };
    f.flush = () => { if (t) { clearTimeout(t); t = 0; fn(...(args || [])); } };
    f.cancel = () => { clearTimeout(t); t = 0; };
    return f;
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dateFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDate = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? dateFmt.format(t) : ''; };
  const deg = (r) => Math.round((r * 180) / Math.PI * 10) / 10;
  const rad = (d) => (d * Math.PI) / 180;
  const wrapRad = (r) => { const t = Math.PI * 2; let v = r % t; if (v > Math.PI) v -= t; if (v < -Math.PI) v += t; return v; };
  MT.util = { clamp, round, deep, $, h, slug, debounce, DIRS, fmtDate, deg, rad, wrapRad };

  /* ------------------------------------------------------- événements -- */
  const handlers = Object.create(null);
  MT.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  MT.emit = (ev, ...args) => {
    for (const fn of handlers[ev] || []) {
      try { fn(...args); } catch (e) { console.error(`[Mod Tools] ${ev}`, e); }
    }
  };
  MT.toast = (msg, tone = 'info') => MT.emit('toast', msg, tone);

  /* ------------------------------------- accès aux fichiers (launcher) -- */
  /* Dans le launcher, window.zsModtools vient du preload (fichiers dans le
     dossier de l'auteur). Ouvert dans un simple navigateur (développement),
     les cartes sont gardées dans le stockage du navigateur. */
  function browserApi() {
    const LS = 'mt.dev.';
    const get = (k, d) => { try { const v = localStorage.getItem(LS + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
    const set = (k, v) => {
      try { if (v === null || v === undefined) localStorage.removeItem(LS + k); else localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { throw new Error('Stockage du navigateur plein.'); }
    };
    const pickFile = (accept) => new Promise((resolve) => {
      const i = document.createElement('input');
      i.type = 'file'; i.accept = accept;
      i.onchange = () => resolve(i.files[0] || null);
      i.click();
    });
    const readAs = (file, how) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r[how](file); });
    return {
      dev: true,
      info: async () => ({ launcherVersion: null, engine: { version: ZS.version, source: 'page' }, workspace: 'stockage du navigateur' }),
      listMaps: async () => Object.values(get('maps', {})).map((e) => ({ id: e.id, name: e.name, updated: e.updated, bytes: e.text.length, recovery: get(`rec.${e.id}`, null) ? get(`rec.${e.id}`).at : null })),
      readMap: async (id) => { const e = get('maps', {})[id]; if (!e) throw new Error('Carte introuvable.'); return e.text; },
      saveMap: async (id, text) => {
        const all = get('maps', {}), o = JSON.parse(text);
        all[id] = { id, name: o.name, updated: o.updated, text };
        set('maps', all);
        return { ok: true };
      },
      deleteMap: async (id) => { const all = get('maps', {}); delete all[id]; set('maps', all); set(`rec.${id}`, null); return true; },
      readRecovery: async (id) => get(`rec.${id}`, null),
      writeRecovery: async (id, text) => { set(`rec.${id}`, text ? { text, at: new Date().toISOString() } : null); return true; },
      importMap: async () => { const f = await pickFile('.json,application/json'); return f ? { name: f.name, text: await readAs(f, 'readAsText') } : null; },
      exportMap: async (id, text) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = `${id}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        return `${id}.json`;
      },
      importImage: async () => { const f = await pickFile('image/png,image/jpeg,image/webp'); return f ? { name: f.name, dataUrl: await readAs(f, 'readAsDataURL') } : null; },
      importModel: async () => {
        const f = await pickFile('.glb,model/gltf-binary');
        if (!f) return null;
        const url = await readAs(f, 'readAsDataURL');
        return { name: f.name, dataUrl: url.replace(/^data:[^;]*;/, 'data:model/gltf-binary;') };
      },
      listModels: async () => Object.entries(get('models', {})).map(([id, text]) => ({ id, text })),
      saveModel: async (id, text) => { const all = get('models', {}); all[id] = text; set('models', all); return true; },
      deleteModel: async (id) => { const all = get('models', {}); delete all[id]; set('models', all); return true; },
      listTextures: async () => Object.entries(get('tex', {})).map(([id, text]) => ({ id, text })),
      saveTexture: async (id, text) => { const all = get('tex', {}); all[id] = text; set('tex', all); return true; },
      deleteTexture: async (id) => { const all = get('tex', {}); delete all[id]; set('tex', all); return true; },
      getPublishSet: async () => get('publish', null),
      setPublishSet: async (v) => { set('publish', v); return true; },
      openPublisher: async () => false,
      openFolder: async () => false,
      setTitle: (t) => { document.title = t; },
      toggleFullscreen: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); },
      close: () => {},
      onCloseRequest: () => {
        window.addEventListener('beforeunload', (e) => { if (MT.isDirty()) { e.preventDefault(); e.returnValue = ''; } });
      },
    };
  }
  const host = window.zsModtools;
  MT.api = host && typeof host.listMaps === 'function' ? host : browserApi();

  /* ------------------------------------------------------------- état -- */
  const S = (MT.state = {
    map: null, id: null, source: null, rev: 0, savedRev: 0,
    tool: 'select', sel: null, level: 0,
    undo: [], redo: [], pending: null,
    issues: { errors: [], warnings: [] }, analysis: null, analysisRev: -1,
    opts: {
      build: { tile: '#', shape: 'brush', size: 1 },
      paint: { layer: 'floor', tex: 'concrete_stained', shape: 'brush', size: 1 },
      props: { model: 'crate_medium', snap: 0.25, rot: 0, rotStep: 15, randomRot: false, randomScale: 0, scale: 1, tint: null, solid: 'auto' },
      stairs: { shape: 'straight', mat: 'wood', w: 1, n: 5, n2: 3, turn: 1, dir: [0, -1] },
      elements: {
        kind: 'light', weapon: 'mp40', perk: 'cuirasse', sign: 'ENTREPÔT', boxVertical: false,
        light: { color: '#ffc78f', intensity: 1.8, range: 12, flicker: 0.1, fixture: 'lamp', powered: null },
        door: { cost: 750, type: 'door' },
      },
    },
    recent: { tex: [], model: [] },
    publish: null,
    library: Object.create(null),
    modelLib: Object.create(null),
    known: [],
  });
  MT.isDirty = () => !!S.map && S.rev !== S.savedRev;
  MT.map = () => S.map;

  /* --------------------------------------------------------- historique --
     begin() garde une copie de la carte avant un geste ; touch() signale une
     modification ; commit() range la copie dans l'historique si le geste a
     changé quelque chose. edit(libellé, fn) fait les trois d'un coup.        */
  MT.begin = (label) => {
    if (!S.map) return;
    if (!S.pending) S.pending = { label, before: deep(S.map), sel: deep(S.sel), changed: false };
  };
  MT.commit = () => {
    const p = S.pending;
    S.pending = null;
    if (!p || !p.changed) return;
    S.undo.push(p);
    if (S.undo.length > 200) S.undo.shift();
    S.redo.length = 0;
    MT.emit('history');
  };
  MT.cancelGesture = () => {
    const p = S.pending;
    S.pending = null;
    if (p && p.changed) { S.map = p.before; S.sel = p.sel; S.rev++; MT.emit('change', 'all', { history: true }); MT.emit('selection'); }
  };
  /* kind : 'grid' | 'layers' | 'props' | 'prop-move' | 'lights' | 'light-live' | 'elements' | 'settings' | 'ambiance' | 'all' */
  MT.touch = (kind = 'all', detail = null) => {
    if (S.pending) S.pending.changed = true;
    S.rev++;
    MT.emit('change', kind, detail);
  };
  MT.edit = (label, fn, kind = 'all', detail = null) => {
    if (!S.map) return undefined;
    MT.begin(label);
    let r;
    try { r = fn(S.map); } catch (e) { MT.commit(); throw e; }
    if (r !== false) MT.touch(kind, detail);
    MT.commit();
    return r;
  };
  function restore(snapshot, sel) {
    S.map = snapshot;
    S.sel = sel;
    if (!MT.hasLevel(S.level)) { S.level = 0; MT.emit('level', 0); }
    S.rev++;
    MT.emit('change', 'all', { history: true });
    MT.emit('selection');
    MT.emit('history');
  }
  MT.undo = () => {
    if (S.pending) MT.commit();
    const e = S.undo.pop();
    if (!e) return false;
    S.redo.push({ label: e.label, before: deep(S.map), sel: deep(S.sel), changed: true });
    restore(e.before, e.sel);
    MT.toast(`Annulé : ${e.label}`);
    return true;
  };
  MT.redo = () => {
    if (S.pending) MT.commit();
    const e = S.redo.pop();
    if (!e) return false;
    S.undo.push({ label: e.label, before: deep(S.map), sel: deep(S.sel), changed: true });
    restore(e.before, e.sel);
    MT.toast(`Rétabli : ${e.label}`);
    return true;
  };

  /* ------------------------------------------------------------ carte -- */
  const PAL = () => ZS.PAL_CHARS;
  const inb = (x, z) => !!S.map && x >= 0 && z >= 0 && x < S.map.w && z < S.map.h;
  MT.inb = inb;
  MT.wallHeight = () => (S.map ? S.map.ambiance.wallHeight : 3.5);

  /* ---------------------------------------------------------- niveaux --
     Jeu 1.4.0 (interface 2) : grid et layers forment le rez-de-chaussée (niveau 0),
     floors[] les étages (1, 2…) et sous-sols (-1, -2…). Les éléments portent lv
     (absent = 0). Les outils travaillent sur le niveau affiché, S.level.        */
  MT.multiOk = () => (ZS.editorApi || 1) >= 2 && typeof ZS.stairPlan === 'function';
  const floorOf = (m, lv) => (!m ? null : (lv | 0) === 0 ? m : (m.floors || []).find((f) => f.lv === lv) || null);
  MT.levels = (m = S.map) => (m ? [0, ...(m.floors || []).map((f) => f.lv)].sort((a, b) => a - b) : [0]);
  MT.hasLevel = (lv, m = S.map) => !!floorOf(m, lv);
  MT.gridOf = (lv = S.level, m = S.map) => { const f = floorOf(m, lv); return f ? f.grid : null; };
  /* Grille du niveau affiché (le rez-de-chaussée si ce niveau n'existe plus). */
  MT.grid = (lv = S.level, m = S.map) => MT.gridOf(lv, m) || (m ? m.grid : null);
  MT.layersOf = (lv = S.level, m = S.map) => {
    const f = floorOf(m, lv);
    if (!f) return null;
    if (!f.layers) f.layers = {};
    for (const L of ['floor', 'ceil', 'wall']) if (!Array.isArray(f.layers[L]) || f.layers[L].length !== m.h) f.layers[L] = Array.from({ length: m.h }, () => '.'.repeat(m.w));
    return f.layers;
  };
  MT.levelY = (lv = S.level) => lv * (MT.wallHeight() + (ZS.SLAB || 0.3));
  MT.lvOf = (e) => (Array.isArray(e) ? e[2] | 0 : e ? e.lv | 0 : 0);
  MT.here = (e) => MT.lvOf(e) === S.level;
  /* Range le niveau dans un élément (lv absent au rez-de-chaussée). */
  MT.tagLv = (o, lv = S.level) => { if (lv) o.lv = lv; else delete o.lv; return o; };
  MT.levelName = (lv) => (lv > 0 ? `Étage ${lv}` : lv < 0 ? `Sous-sol ${-lv}` : 'Rez-de-chaussée');
  MT.tileAt = (x, z, lv = S.level) => { const g = MT.gridOf(lv); return inb(x, z) && g ? g[z][x] : ' '; };
  const isFloor = (ch) => ch === '.';
  const fillable = (ch) => ch === '.' || ch === 'x' || ch === 'P' || ch === 'm';
  MT.isFloor = isFloor;
  MT.fillable = fillable;
  function setRow(m, x, z, ch, lv = S.level) {
    const rows = MT.gridOf(lv, m);
    if (!rows) return false;
    const r = rows[z];
    if (r[x] === ch) return false;
    rows[z] = r.slice(0, x) + ch + r.slice(x + 1);
    return true;
  }
  MT.setLevel = (lv) => {
    if (!S.map || !MT.hasLevel(lv) || lv === S.level) return;
    if (MT.tools && MT.tools.cancel) MT.tools.cancel();
    S.level = lv;
    S.sel = null;
    MT.emit('level', lv);
    MT.emit('selection');
  };

  /* Analyse (pièces, fenêtres, portes) de la carte en cours, recalculée au besoin. */
  MT.analysis = () => {
    if (!S.map) return null;
    if (S.analysisRev !== S.rev) { S.analysis = ZS.analyzeMap(S.map); S.analysisRev = S.rev; }
    return S.analysis;
  };
  MT.zoneIndexAt = (x, z, lv = S.level) => {
    const A = MT.analysis();
    if (!A || !A.ok(x, z)) return -1;
    if (!A.zoneAll) return lv === 0 ? A.zoneOf[A.ix(x, z)] : -1;
    const li = A.liOf.get(lv);
    return li === undefined ? -1 : A.zoneAll[A.K(li, x, z)];
  };
  /* Définition (m.zones) correspondant à une pièce de l'analyse, -1 si pièce automatique. */
  MT.zoneDefOf = (zi) => {
    const A = MT.analysis();
    const z = A && A.zones[zi];
    if (!z || z.auto) return -1;
    return S.map.zones.findIndex((d) => d.seed[0] === z.seed[0] && d.seed[1] === z.seed[1] && (d.lv | 0) === (z.lv | 0));
  };

  /* Portes : chaque groupe de cases D voisines forme une porte (16 cases au plus) ;
     un groupe garde le prix et le type de la porte qui occupait déjà une de ses cases. */
  function reconcileDoors(m) {
    const W = m.w, H = m.h, old = m.doors;
    const ownerOld = new Map();
    old.forEach((d, i) => d.cells.forEach(([x, z]) => ownerOld.set(`${d.lv | 0}:${z * W + x}`, i)));
    const used = new Set(), out = [];
    for (const lv of MT.levels(m)) {
      const G = MT.gridOf(lv, m), seen = new Uint8Array(W * H);
      for (let z = 0; z < H; z++) {
        for (let x = 0; x < W; x++) {
          if (G[z][x] !== 'D' || seen[z * W + x]) continue;
          const cells = [], stack = [[x, z]];
          seen[z * W + x] = 1;
          while (stack.length) {
            const [cx, cz] = stack.pop();
            cells.push([cx, cz]);
            for (const [dx, dz] of DIRS) {
              const nx = cx + dx, nz = cz + dz;
              if (nx >= 0 && nz >= 0 && nx < W && nz < H && !seen[nz * W + nx] && G[nz][nx] === 'D') { seen[nz * W + nx] = 1; stack.push([nx, nz]); }
            }
          }
          let src = null;
          for (const [cx, cz] of cells) {
            const k = ownerOld.get(`${lv}:${cz * W + cx}`);
            if (k !== undefined && !used.has(k)) { src = old[k]; used.add(k); break; }
          }
          const def = S.opts.elements.door;
          cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
          for (let i = 0; i < cells.length; i += 16) {
            const type = src ? src.type : def.type;
            out.push(MT.tagLv({ cells: cells.slice(i, i + 16), cost: src ? src.cost : def.cost, type, verb: src ? src.verb : ZS.DOOR_VERBS[type] }, lv));
          }
        }
      }
    }
    m.doors = out;
  }
  MT.reconcileDoors = reconcileDoors;

  /* Une pièce nommée garde son nom si on repeint la case qui la définissait. */
  function fixZoneSeeds(m) {
    const key = (z, c) => `${z.lv | 0}:${c}`;
    const inM = (x, z) => x >= 0 && z >= 0 && x < m.w && z < m.h;
    const taken = new Set(m.zones.map((z) => key(z, z.seed)));
    for (const z of m.zones) {
      const [sx, sz] = z.seed, G = MT.gridOf(z.lv | 0, m);
      if (!G) continue;
      if (inM(sx, sz) && fillable(G[sz][sx])) continue;
      let best = null;
      for (let r = 1; r <= 10 && !best; r++) {
        for (let dz = -r; dz <= r && !best; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const x = sx + dx, zz = sz + dz;
            if (inM(x, zz) && fillable(G[zz][x]) && !taken.has(key(z, [x, zz]))) { best = [x, zz]; break; }
          }
        }
      }
      if (best) { taken.delete(key(z, z.seed)); z.seed = best; taken.add(key(z, best)); }
    }
  }

  /* Éléments devenus impossibles après un changement de cases (arme murale sans mur…). */
  function cleanElements(m, changed, lv = S.level) {
    const hit = new Set(changed.map(([x, z]) => `${lv}:${x},${z}`));
    let cur = 0;
    // at(c) : la case c (du niveau de l'élément en cours d'examen) a-t-elle changé ?
    const at = (c) => hit.has(`${cur}:${c[0]},${c[1]}`);
    const keepLv = (arr, ok, label) => arr.filter((e) => { cur = MT.lvOf(e); if (cur !== lv || ok(e)) return true; removed.push(label(e)); return false; });
    const tile = (c) => MT.tileAt(c[0], c[1], lv);
    const removed = [];
    const keep = keepLv;
    m.wallbuys = keep(m.wallbuys, (w) => !at(w.cell) || tile(w.cell) === '#', (w) => `arme murale ${ZS.WEAPONS[w.w].name}`);
    m.perks = keep(m.perks, (p) => !at(p.cell) || tile(p.cell) === '.', (p) => `distributeur ${ZS.PERKS[p.p].name}`);
    const before = m.boxes.length;
    m.boxes = keep(m.boxes, (b) => !b.cells.some(at) || b.cells.every((c) => tile(c) === '.'), () => 'emplacement de boîte mystère');
    if (m.boxes.length !== before) m.boxStart = clamp(m.boxStart, 0, Math.max(0, m.boxes.length - 1));
    m.risers = keep(m.risers, (r) => !at(r) || tile(r) === '.', () => 'apparition de zombies');
    const one = (e) => { cur = MT.lvOf(e); return cur === lv; };
    if (m.power && one(m.power) && at(m.power.cell) && tile(m.power.cell) !== '#') { m.power = null; removed.push('interrupteur du courant'); }
    if (m.amp && one(m.amp) && m.amp.cells.some(at) && !m.amp.cells.every((c) => tile(c) === '.')) { m.amp = null; removed.push('Amplificateur'); }
    if (m.digipass && one(m.digipass) && at(m.digipass.cell) && tile(m.digipass.cell) !== '#') { m.digipass = null; removed.push('digi pass'); }
    return removed;
  }

  /* Change des cases (cells : [[x, z], …]). Renvoie le nombre de cases modifiées. */
  MT.setTiles = (cells, ch) => {
    const m = S.map;
    const changed = [];
    for (const [x, z] of cells) if (inb(x, z) && setRow(m, x, z, ch)) changed.push([x, z]);
    if (!changed.length) return 0;
    S.liveCells = (S.liveCells || []).concat(changed);
    reconcileDoors(m);
    const removed = cleanElements(m, changed);
    fixZoneSeeds(m);
    if (removed.length) MT.toast(`Retiré : ${[...new Set(removed)].join(', ')}`, 'warn');
    return changed.length;
  };

  /* Remplissage : cases voisines de même type que (x, z). */
  MT.floodCells = (x, z, same, limit = 40000) => {
    if (!inb(x, z)) return [];
    const W = S.map.w, seen = new Uint8Array(W * S.map.h), out = [], stack = [[x, z]];
    seen[z * W + x] = 1;
    while (stack.length && out.length < limit) {
      const [cx, cz] = stack.pop();
      out.push([cx, cz]);
      for (const [dx, dz] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (inb(nx, nz) && !seen[nz * W + nx] && same(nx, nz)) { seen[nz * W + nx] = 1; stack.push([nx, nz]); }
      }
    }
    return out;
  };

  /* ---------------------------------------------- textures des calques -- */
  const allLayers = (m) => [m.layers, ...(m.floors || []).map((f) => f.layers || {})];
  function compactPalette(m) {
    const map = new Map(), pal = [];
    for (const LS of allLayers(m)) for (const L of ['floor', 'ceil', 'wall']) {
      for (const row of LS[L] || []) {
        for (const ch of row) {
          if (ch === '.' || map.has(ch)) continue;
          const id = m.palette[PAL().indexOf(ch)];
          if (!id) { map.set(ch, '.'); continue; }
          let k = pal.indexOf(id);
          if (k < 0) { k = pal.length; pal.push(id); }
          map.set(ch, PAL()[k]);
        }
      }
    }
    for (const LS of allLayers(m)) for (const L of ['floor', 'ceil', 'wall']) if (LS[L]) LS[L] = LS[L].map((row) => row.replace(/[^.]/g, (ch) => map.get(ch) || '.'));
    m.palette = pal;
  }
  MT.compactPalette = compactPalette;
  function palChar(m, id) {
    let k = m.palette.indexOf(id);
    if (k < 0) {
      if (m.palette.length >= PAL().length) { compactPalette(m); k = m.palette.indexOf(id); }
      if (k < 0) {
        if (m.palette.length >= PAL().length) throw new Error('Trop de textures différentes sur cette carte (62 au maximum).');
        k = m.palette.length;
        m.palette.push(id);
      }
    }
    return PAL()[k];
  }
  /* Texture d'une case pour un calque, telle que le jeu la verra. */
  MT.cellTexture = (x, z, layer) => {
    const m = S.map;
    if (!inb(x, z)) return null;
    const ch = MT.layersOf()[layer][z][x];
    if (ch !== '.') { const id = m.palette[PAL().indexOf(ch)]; if (id) return id; }
    const zi = MT.zoneIndexAt(x, z);
    const A = MT.analysis();
    if (zi >= 0 && A.zones[zi] && A.zones[zi][layer]) return A.zones[zi][layer];
    return m.textures[layer];
  };
  /* Peint une texture (id, ou null pour revenir à la texture par défaut). */
  MT.paintCells = (layer, cells, id) => {
    const m = S.map;
    const ch = id ? palChar(m, id) : '.';
    let n = 0;
    const rows = MT.layersOf()[layer];
    const changed = [];
    for (const [x, z] of cells) {
      if (!inb(x, z) || rows[z][x] === ch) continue;
      rows[z] = rows[z].slice(0, x) + ch + rows[z].slice(x + 1);
      changed.push([x, z]);
      n++;
    }
    if (n) S.liveCells = (S.liveCells || []).concat(changed);
    return n;
  };
  MT.usedTextures = (m = S.map) => {
    const used = new Set(Object.values(m.textures));
    for (const LS of allLayers(m)) for (const L of ['floor', 'ceil', 'wall']) for (const row of LS[L] || []) for (const ch of row) if (ch !== '.') { const id = m.palette[PAL().indexOf(ch)]; if (id) used.add(id); }
    for (const z of m.zones) for (const L of ['floor', 'wall', 'ceil']) if (z[L]) used.add(z[L]);
    used.delete('none');
    return used;
  };

  /* --------------------------------------------- bibliothèque d'images --
     Les images importées sont gardées dans le dossier de l'auteur (toutes les
     cartes peuvent s'en servir) et recopiées dans chaque carte qui les utilise. */
  MT.registerLibrary = () => { ZS.registerCustomTextures({ custom: { textures: S.library } }); };
  MT.addToLibrary = async (id, t, persist = true) => {
    S.library[id] = { name: t.name, data: t.data, size: t.size.slice(), rough: t.rough, fit: !!t.fit };
    MT.registerLibrary();
    if (persist) await MT.api.saveTexture(id, JSON.stringify(S.library[id]));
    MT.emit('library');
  };
  MT.loadLibrary = async () => {
    try {
      const list = await MT.api.listTextures();
      for (const { id, text } of list || []) {
        try {
          const t = JSON.parse(text);
          if (/^u_[\w-]{1,40}$/.test(id) && t && typeof t.data === 'string' && Array.isArray(t.size)) S.library[id] = t;
        } catch (e) { console.warn(`Image ${id} illisible`); }
      }
      MT.registerLibrary();
    } catch (e) { console.warn('Bibliothèque d\'images indisponible', e); }
  };
  /* Images et modèles embarqués dans une carte ouverte : ajoutés à la bibliothèque s'ils n'y sont pas. */
  async function absorbCustomTextures(m) {
    const ct = (m.custom && m.custom.textures) || {};
    for (const id of Object.keys(ct)) {
      if (S.library[id]) continue;
      try { await MT.addToLibrary(id, ct[id]); } catch (e) { console.warn(e); }
    }
    const cm = (m.custom && m.custom.models) || {};
    for (const id of Object.keys(cm)) {
      if (S.modelLib[id]) continue;
      try { await MT.addModelToLibrary(id, cm[id]); } catch (e) { console.warn(e); }
    }
  }
  /* Modèles 3D importés (.glb) : même principe que les images. */
  const modelEntry = (t) => ({ name: t.name, data: t.data, scale: t.scale, offset: t.offset.slice(), box: t.box.slice(), solid: t.solid !== false, wall: !!t.wall });
  MT.registerModels = () => { ZS.registerCustomModels({ custom: { models: S.modelLib } }); };
  MT.addModelToLibrary = async (id, t, persist = true) => {
    S.modelLib[id] = modelEntry(t);
    MT.registerModels();
    if (persist) await MT.api.saveModel(id, JSON.stringify(S.modelLib[id]));
    MT.emit('library');
  };
  MT.loadModelLibrary = async () => {
    try {
      const list = (await MT.api.listModels()) || [];
      for (const { id, text } of list) {
        try {
          const t = JSON.parse(text);
          if (/^u_[\w-]{1,40}$/.test(id) && t && typeof t.data === 'string' && Array.isArray(t.box) && Array.isArray(t.offset)) S.modelLib[id] = modelEntry(t);
        } catch (e) { console.warn(`Modèle ${id} illisible`); }
      }
      MT.registerModels();
    } catch (e) { console.warn('Bibliothèque de modèles indisponible', e); }
  };

  /* ------------------------------------------------- objets posés --- */
  const BOX_DEFAULT = { min: { x: -0.5, y: 0, z: -0.5 }, max: { x: 0.5, y: 1, z: 0.5 } };
  MT.modelBox = (id) => { const info = ZS.MODELS[id] ? ZS.modelParts(id) : null; return info ? info.box : BOX_DEFAULT; };
  MT.propCorners = (pr) => {
    const b = MT.modelBox(pr.m), s = pr.s || 1, r = pr.r || 0, c = Math.cos(r), sn = Math.sin(r);
    return [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]]
      .map(([lx, lz]) => [pr.x + (c * lx + sn * lz) * s, pr.z + (-sn * lx + c * lz) * s]);
  };
  MT.propContains = (pr, px, pz, pad = 0) => {
    const b = MT.modelBox(pr.m), s = pr.s || 1, r = pr.r || 0, c = Math.cos(r), sn = Math.sin(r);
    const dx = px - pr.x, dz = pz - pr.z;
    const lx = (c * dx - sn * dz) / s, lz = (sn * dx + c * dz) / s;
    const p = pad / s;
    return lx >= b.min.x - p && lx <= b.max.x + p && lz >= b.min.z - p && lz <= b.max.z + p;
  };
  MT.propSolid = (pr) => {
    const def = ZS.MODELS[pr.m];
    if (!def || def.decal) return false;
    return typeof pr.solid === 'boolean' ? pr.solid : def.solid;
  };
  /* Nouvel objet avec les réglages de l'outil (rotation, échelle, teinte). */
  MT.makeProp = (model, x, z, y = 0, face = null) => {
    const o = S.opts.props, def = ZS.MODELS[model];
    let r = rad(o.rot);
    if (o.randomRot) r = Math.round(Math.random() * 24) * (Math.PI / 12);
    if (face && def && def.wall) r = Math.atan2(face[0], face[1]);
    let s = o.scale || 1;
    if (o.randomScale > 0) s *= 1 + (Math.random() * 2 - 1) * o.randomScale;
    const pr = { m: model, x: round(x), z: round(z) };
    if (y) pr.y = round(y);
    if (Math.abs(r) > 1e-4) pr.r = round(wrapRad(r), 4);
    if (Math.abs(s - 1) > 1e-3) pr.s = round(clamp(s, 0.1, 10), 3);
    if (o.tint) pr.c = ZS.parseColor(o.tint, 0xffffff);
    if (o.solid === 'yes') pr.solid = true;
    else if (o.solid === 'no') pr.solid = false;
    return MT.tagLv(pr);
  };
  MT.pushRecent = (kind, id) => {
    const list = S.recent[kind];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    list.unshift(id);
    if (list.length > 16) list.length = 16;
    try { localStorage.setItem(`mt.recent.${kind}`, JSON.stringify(list)); } catch (e) { /* facultatif */ }
  };
  for (const k of ['tex', 'model']) {
    try { const v = JSON.parse(localStorage.getItem(`mt.recent.${k}`) || '[]'); if (Array.isArray(v)) S.recent[k] = v.filter((x) => typeof x === 'string').slice(0, 16); } catch (e) { /* rien */ }
  }

  /* ---------------------------------------------------- éléments --- */
  /* Côté du mur (x, z) tourné vers une case de sol ; pref : direction préférée. */
  MT.wallFace = (x, z, pref) => {
    const opts = DIRS.filter(([dx, dz]) => isFloor(MT.tileAt(x + dx, z + dz)));
    if (!opts.length) return null;
    if (pref) opts.sort((a, b) => (b[0] * pref[0] + b[1] * pref[1]) - (a[0] * pref[0] + a[1] * pref[1]));
    return opts[0].slice();
  };
  /* Orientation par défaut d'une machine : dos au mur, face à la pièce. */
  MT.defaultFace = (x, z) => {
    let best = [0, 1], score = -1;
    for (const [dx, dz] of DIRS) {
      const back = MT.tileAt(x - dx, z - dz), front = MT.tileAt(x + dx, z + dz);
      const s = (back !== '.' ? 2 : 0) + (isFloor(front) ? 1 : 0);
      if (s > score) { score = s; best = [dx, dz]; }
    }
    return best;
  };
  /* Deux cases pour la boîte / l'Amplificateur, et le côté où se tient le joueur. */
  MT.pairAt = (x, z, vertical) => {
    const cells = vertical ? [[x, z], [x, z + 1]] : [[x, z], [x + 1, z]];
    const cand = vertical ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    let face = cand[0], best = -1;
    for (const f of cand) {
      let s = 0;
      for (const [cx, cz] of cells) { if (isFloor(MT.tileAt(cx + f[0], cz + f[1]))) s += 2; if (!isFloor(MT.tileAt(cx - f[0], cz - f[1]))) s += 1; }
      if (s > best) { best = s; face = f; }
    }
    return { cells, face: face.slice() };
  };
  MT.signPos = (x, z, n, y = 3.05) => [round(x + 0.5 + n[0] * 0.505), round(y), round(z + 0.5 + n[1] * 0.505)];
  MT.signCell = (s) => [Math.floor(s.pos[0] - s.n[0] * 0.2), Math.floor(s.pos[2] - s.n[1] * 0.2)];
  MT.lightDefaults = (fixture) => {
    const L = S.opts.elements.light;
    const o = { color: ZS.parseColor(L.color, 0xffc78f), intensity: L.intensity, range: L.range, flicker: L.flicker, fixture: fixture || L.fixture };
    if (L.powered) { o.powered = ZS.parseColor(L.powered, 0xe6eeff); o.poweredRange = Math.max(L.range, 11); }
    return o;
  };

  /* Éléments présents sur une case (sélection dans le plan). */
  MT.elementsAt = (x, z) => {
    const m = S.map, out = [], H = MT.here;
    const same = (c) => c[0] === x && c[1] === z;
    m.lights.forEach((l, i) => { if (H(l) && Math.floor(l.pos[0]) === x && Math.floor(l.pos[2]) === z) out.push({ kind: 'light', i }); });
    m.perks.forEach((p, i) => { if (H(p) && same(p.cell)) out.push({ kind: 'perk', i }); });
    m.boxes.forEach((b, i) => { if (H(b) && b.cells.some(same)) out.push({ kind: 'box', i }); });
    if (m.amp && H(m.amp) && m.amp.cells.some(same)) out.push({ kind: 'amp' });
    m.wallbuys.forEach((w, i) => { if (H(w) && same(w.cell)) out.push({ kind: 'wallbuy', i }); });
    if (m.power && H(m.power) && same(m.power.cell)) out.push({ kind: 'power' });
    m.signs.forEach((s, i) => { if (H(s) && same(MT.signCell(s))) out.push({ kind: 'sign', i }); });
    m.risers.forEach((r, i) => { if (H(r) && same(r)) out.push({ kind: 'riser', i }); });
    if (H(m.spawn) && Math.floor(m.spawn.pos[0]) === x && Math.floor(m.spawn.pos[1]) === z) out.push({ kind: 'spawn' });
    m.doors.forEach((d, i) => { if (H(d) && d.cells.some(same)) out.push({ kind: 'door', i }); });
    const si = MT.stairAt(x, z);
    if (si >= 0) out.push({ kind: 'stair', i: si });
    return out;
  };

  /* ------------------------------------------------------- sélection --- */
  MT.select = (sel) => { S.sel = sel; MT.emit('selection'); };
  MT.selKind = () => (S.sel ? S.sel.kind : null);
  MT.selectedProps = () => (S.sel && S.sel.kind === 'prop' ? S.sel.list : []);
  /* Après une modification : retire de la sélection ce qui n'existe plus. */
  MT.fixSelection = () => {
    const s = S.sel, m = S.map;
    if (!s || !m) return;
    const arr = { light: m.lights, wallbuy: m.wallbuys, perk: m.perks, box: m.boxes, sign: m.signs, riser: m.risers, door: m.doors, zone: m.zones, stair: m.stairs || [] }[s.kind];
    let ok = true;
    if (s.kind === 'prop') { s.list = s.list.filter((i) => i < m.props.length); ok = s.list.length > 0; }
    else if (arr) ok = s.i < arr.length;
    else if (s.kind === 'power') ok = !!m.power;
    else if (s.kind === 'amp') ok = !!m.amp;
    else if (s.kind === 'cell') ok = inb(s.x, s.z);
    if (!ok) { S.sel = null; MT.emit('selection'); }
  };
  const KIND_OF = { prop: 'props', light: 'lights', door: 'all', wallbuy: 'elements', perk: 'elements', box: 'elements', power: 'elements', amp: 'elements', sign: 'elements', riser: 'elements', zone: 'all', spawn: 'elements', stair: 'all' };
  MT.changeKindOf = (sel) => KIND_OF[sel && sel.kind] || 'all';

  MT.deleteSelection = () => {
    const s = S.sel;
    if (!s || s.kind === 'spawn' || s.kind === 'cell') return false;
    const ok = MT.edit('Supprimer', (m) => {
      switch (s.kind) {
        case 'prop': { const set = new Set(s.list); m.props = m.props.filter((_, i) => !set.has(i)); break; }
        case 'light': m.lights.splice(s.i, 1); break;
        case 'wallbuy': m.wallbuys.splice(s.i, 1); break;
        case 'perk': m.perks.splice(s.i, 1); break;
        case 'box': m.boxes.splice(s.i, 1); m.boxStart = clamp(m.boxStart, 0, Math.max(0, m.boxes.length - 1)); break;
        case 'power': m.power = null; break;
        case 'amp': m.amp = null; break;
        case 'sign': m.signs.splice(s.i, 1); break;
        case 'riser': m.risers.splice(s.i, 1); break;
        case 'zone': m.zones.splice(s.i, 1); break;
        case 'door': {
          // une porte supprimée redevient un mur
          const d = m.doors[s.i];
          for (const [x, z] of d.cells) setRow(m, x, z, '#', d.lv | 0);
          reconcileDoors(m);
          break;
        }
        case 'stair': {
          const st = (m.stairs || [])[s.i];
          if (!st) return false;
          m.stairs.splice(s.i, 1);
          MT.fillOpenings(m, st);
          break;
        }
        default: return false;
      }
      return true;
    }, MT.changeKindOf(s));
    if (ok) MT.select(null);
    return ok;
  };
  MT.duplicateSelection = () => {
    const s = S.sel;
    if (!s) return false;
    if (s.kind === 'prop') {
      return MT.edit('Dupliquer', (m) => {
        const start = m.props.length;
        for (const i of s.list) { const p = deep(m.props[i]); p.x = round(p.x + 1); p.z = round(p.z + 1); m.props.push(p); }
        S.sel = { kind: 'prop', list: s.list.map((_, k) => start + k) };
        MT.emit('selection');
      }, 'props');
    }
    if (s.kind === 'light') {
      return MT.edit('Dupliquer', (m) => {
        const l = deep(m.lights[s.i]);
        l.pos[0] = round(l.pos[0] + 1);
        m.lights.push(l);
        S.sel = { kind: 'light', i: m.lights.length - 1 };
        MT.emit('selection');
      }, 'lights');
    }
    return false;
  };

  /* ------------------------------------------------ copier / coller ---- */
  MT.copySelection = () => {
    const s = S.sel;
    if (!s || s.kind !== 'prop') return false;
    const props = s.list.map((i) => deep(S.map.props[i]));
    const cx = props.reduce((a, p) => a + p.x, 0) / props.length, cz = props.reduce((a, p) => a + p.z, 0) / props.length;
    S.clipboard = { props: props.map((p) => ({ ...p, x: p.x - cx, z: p.z - cz })) };
    MT.toast(`${props.length} objet${props.length > 1 ? 's' : ''} copié${props.length > 1 ? 's' : ''}`);
    return true;
  };
  MT.paste = (x, z) => {
    const c = S.clipboard;
    if (!c || !c.props.length) return false;
    const snap = S.opts.props.snap || 0;
    const sx = snap ? Math.round(x / snap) * snap : x, sz = snap ? Math.round(z / snap) * snap : z;
    return MT.edit('Coller', (m) => {
      const start = m.props.length;
      for (const p of c.props) m.props.push(MT.tagLv({ ...deep(p), x: round(p.x + sx), z: round(p.z + sz) }));
      S.sel = { kind: 'prop', list: c.props.map((_, k) => start + k) };
      MT.emit('selection');
    }, 'props');
  };

  /* ---------------------------------------------------- étages --- */
  /* Nouveau niveau au-dessus (dir > 0) du plus haut, ou en dessous (dir < 0) du plus bas.
     Il reprend la structure du niveau voisin (murs, piliers, sols) pour démarrer vite ;
     portes et fenêtres deviennent des murs, les cours deviennent du vide. */
  MT.levelFrom = (srcRows) => srcRows.map((row) => row.replace(/./g, (ch) => (ch === '#' || ch === 'P' ? ch : ch === ' ' || ch === 'o' ? ' ' : ch === 'W' || ch === 'D' ? '#' : '.')));
  function newLevel(m, lv, from) {
    const src = MT.gridOf(from, m) || m.grid;
    const blank = Array.from({ length: m.h }, () => '.'.repeat(m.w));
    const f = { lv, grid: MT.levelFrom(src), layers: { floor: blank.slice(), ceil: blank.slice(), wall: blank.slice() } };
    m.floors = (m.floors || []).concat([f]).sort((a, b) => a.lv - b.lv);
    // escaliers qui attendaient cet étage : leur trémie s'ouvre
    for (const st of m.stairs || []) if ((st.lv | 0) + 1 === lv) MT.carveOpenings(m, st);
    return f;
  }
  MT.addLevel = (dir) => {
    const m = S.map;
    if (!m || !MT.multiOk()) return null;
    const lvs = MT.levels();
    if (lvs.length >= (ZS.LEVELS_MAX || 8)) { MT.toast(`${ZS.LEVELS_MAX || 8} niveaux au plus par carte.`, 'warn'); return null; }
    const lv = dir > 0 ? lvs[lvs.length - 1] + 1 : lvs[0] - 1;
    if (lv > (ZS.LEVEL_MAX || 6) || lv < (ZS.LEVEL_MIN || -3)) { MT.toast(dir > 0 ? `Pas plus de ${ZS.LEVEL_MAX || 6} étages.` : `Pas plus de ${-(ZS.LEVEL_MIN || -3)} sous-sols.`, 'warn'); return null; }
    MT.edit(`Ajouter : ${MT.levelName(lv)}`, (mm) => { newLevel(mm, lv, dir > 0 ? lv - 1 : lv + 1); }, 'all');
    MT.setLevel(lv);
    MT.toast(`${MT.levelName(lv)} ajouté : il reprend les murs du niveau ${dir > 0 ? 'du dessous' : 'du dessus'}.`, 'ok');
    return lv;
  };
  /* Retire un niveau et tout ce qui s'y trouve (éléments, objets, escaliers qui y montent ou en partent).
     Seulement l'étage le plus haut ou le sous-sol le plus bas : les niveaux restent d'un seul tenant. */
  MT.removable = (lv) => { const lvs = MT.levels(); return !!lv && MT.hasLevel(lv) && (lv === lvs[lvs.length - 1] || lv === lvs[0]); };
  MT.removeLevel = (lv) => {
    const m = S.map;
    if (!m || !lv || !MT.hasLevel(lv)) return false;
    if (!MT.removable(lv)) { MT.toast(lv > 0 ? 'Supprimez d’abord les étages du dessus.' : 'Supprimez d’abord les sous-sols du dessous.', 'warn'); return false; }
    MT.edit(`Supprimer : ${MT.levelName(lv)}`, (mm) => {
      const other = (e) => MT.lvOf(e) !== lv;
      // escaliers qui partent de ce niveau : leur trémie, au niveau du dessus, se referme
      for (const st of mm.stairs || []) if ((st.lv | 0) === lv) MT.fillOpenings(mm, st);
      mm.floors = mm.floors.filter((f) => f.lv !== lv);
      for (const k of ['lights', 'wallbuys', 'perks', 'signs', 'props', 'zones', 'doors', 'risers']) mm[k] = mm[k].filter(other);
      const nb = mm.boxes.length;
      mm.boxes = mm.boxes.filter(other);
      if (mm.boxes.length !== nb) mm.boxStart = clamp(mm.boxStart, 0, Math.max(0, mm.boxes.length - 1));
      for (const k of ['power', 'amp', 'digipass']) if (mm[k] && !other(mm[k])) mm[k] = null;
      if (MT.lvOf(mm.spawn) === lv) delete mm.spawn.lv;
      mm.stairs = (mm.stairs || []).filter((st) => (st.lv | 0) !== lv && (st.lv | 0) + 1 !== lv);
    }, 'all');
    if (S.level === lv || !MT.hasLevel(S.level)) { S.level = 0; MT.emit('level', 0); }
    S.sel = null;
    MT.emit('selection');
    return true;
  };

  /* ---------------------------------------------------- escaliers --- */
  /* Un escalier part du sol de son niveau (lv) et monte au niveau du dessus. */
  MT.stairsOf = (m = S.map) => (m && m.stairs) || [];
  MT.stairPlan = (s) => ZS.stairPlan(s);
  /* Escalier dont l'emprise (marches, palier, noyau) couvre la case (x, z) du niveau lv. */
  MT.stairAt = (x, z, lv = S.level) => {
    if (!MT.multiOk()) return -1;
    const list = MT.stairsOf();
    for (let i = list.length - 1; i >= 0; i--) {
      const st = list[i];
      if ((st.lv | 0) !== lv) continue;
      if (ZS.stairPlan(st).footprint.some((c) => c[0] === x && c[1] === z)) return i;
    }
    return -1;
  };
  /* Trémie : cases de l'étage du dessus vidées au-dessus des hautes marches (et noyau d'un colimaçon).
     Le jeu les vide de toute façon ; l'éditeur les vide dans la grille pour qu'on les voie. */
  MT.openingsOf = (st, m = S.map, wallH = m.ambiance.wallHeight) => ZS.stairOpenings(ZS.stairPlan(st), wallH);
  const WALLISH = new Set(['#', 'W', 'D', 'P']);
  const FLOORISH = new Set(['.', 'x', 'm', 'o']);
  const okey = (x, z) => `${x},${z}`;
  /* Ouvre la trémie. Renvoie les cases changées de l'étage du dessus ({ cells, up, walls }). */
  function carve(m, st, wallH) {
    const up = (st.lv | 0) + 1, G = MT.gridOf(up, m), cells = [];
    let walls = 0;
    if (!G) return { cells, up, walls };
    const inM = (x, z) => x >= 0 && z >= 0 && x < m.w && z < m.h;
    for (const [x, z] of MT.openingsOf(st, m, wallH)) {
      if (!inM(x, z)) continue;
      const was = G[z][x];
      if (setRow(m, x, z, ' ', up)) { cells.push([x, z]); if (WALLISH.has(was)) walls++; }
    }
    // le palier d'arrivée : du sol s'il n'y a que du vide
    for (const [x, z] of ZS.stairPlan(st).exits) if (inM(x, z) && G[z][x] === ' ' && setRow(m, x, z, '.', up)) cells.push([x, z]);
    if (cells.length) { reconcileDoors(m); fixZoneSeeds(m); }
    return { cells, up, walls };
  }
  MT.carveOpenings = (m, st, wallH) => carve(m, st, wallH).cells.length;
  /* Escalier retiré ou déplacé : sa trémie redevient du sol là où elle touche la pièce,
     mais pas du côté du vide (bord de l'étage, mezzanine) ni sur la trémie d'un autre escalier. */
  MT.fillOpenings = (m, st, wallH = m.ambiance.wallHeight) => {
    const up = (st.lv | 0) + 1, G = MT.gridOf(up, m);
    if (!G) return 0;
    const inM = (x, z) => x >= 0 && z >= 0 && x < m.w && z < m.h;
    const open = MT.openingsOf(st, m, wallH).filter(([x, z]) => inM(x, z));
    const mine = new Set(open.map(([x, z]) => okey(x, z)));
    const others = new Set();
    for (const o of m.stairs || []) if (o !== st && (o.lv | 0) + 1 === up) for (const [x, z] of MT.openingsOf(o, m, wallH)) others.add(okey(x, z));
    let n = 0;
    for (let pass = 0; pass < 16; pass++) {
      let changed = false;
      for (const [x, z] of open) {
        if (G[z][x] !== ' ' || others.has(okey(x, z))) continue;
        let floor = false, outside = false;
        for (const [dx, dz] of DIRS) {
          const nx = x + dx, nz = z + dz, k = okey(nx, nz);
          if (others.has(k) || !inM(nx, nz)) continue;
          const ch = G[nz][nx];
          if (mine.has(k)) { if (ch === '.') floor = true; continue; }
          if (ch === ' ') outside = true;
          else if (FLOORISH.has(ch) || WALLISH.has(ch)) floor = true;
        }
        if (floor && !outside) { setRow(m, x, z, '.', up); n++; changed = true; }
      }
      if (!changed) break;
    }
    if (n) fixZoneSeeds(m);
    return n;
  };
  /* Hauteur des murs : la trémie de chaque escalier dépend de la hauteur d'étage. */
  MT.setWallHeight = (m, h) => {
    const old = m.ambiance.wallHeight;
    if (old === h) return;
    for (const st of m.stairs || []) MT.fillOpenings(m, st, old);
    m.ambiance.wallHeight = h;
    let walls = 0;
    const removed = [];
    for (const st of m.stairs || []) {
      const r = carve(m, st);
      walls += r.walls;
      if (r.cells.length) removed.push(...cleanElements(m, r.cells, r.up));
    }
    if (walls) MT.toast(`Trémies agrandies : ${walls} case${walls > 1 ? 's' : ''} de mur ouverte${walls > 1 ? 's' : ''} au-dessus des escaliers.`, 'warn');
    if (removed.length) MT.toast(`Retiré : ${[...new Set(removed)].join(', ')}`, 'warn');
  };
  /* Escalier tel que l'outil le poserait en (x, z) (options de l'outil). */
  MT.stairFromOpts = (x, z, o = S.opts.stairs, lv = S.level) => {
    const st = { x, z, dir: o.dir.slice(), shape: o.shape, w: o.shape === 'spiral' ? 1 : o.w, n: o.n, mat: o.mat };
    if (o.shape === 'l' || o.shape === 'u') st.n2 = o.n2;
    if (o.shape !== 'straight') st.turn = o.turn === -1 ? -1 : 1;
    return MT.tagLv(st, lv);
  };
  /* Peut-on poser cet escalier ? Renvoie null, ou la raison. ignore : indice d'un escalier à ignorer. */
  MT.stairProblem = (st, ignore = -1) => {
    const m = S.map, lv = st.lv | 0, plan = ZS.stairPlan(st);
    if (!plan.footprint.every(([x, z]) => inb(x, z))) return 'L’escalier sort de la carte.';
    if (!plan.cells.every((c) => MT.tileAt(c.x, c.z, lv) === '.')) return 'Il faut du sol libre sous toutes les marches.';
    const mine = new Set(plan.footprint.map((c) => `${c[0]},${c[1]}`));
    const open = new Set(MT.openingsOf(st).map((c) => `${c[0]},${c[1]}`));
    for (const [i, o] of MT.stairsOf().entries()) {
      if (i === ignore) continue;
      const op = ZS.stairPlan(o), olv = o.lv | 0;
      if (olv === lv && op.footprint.some((c) => mine.has(`${c[0]},${c[1]}`))) return 'Il y a déjà un escalier ici.';
      if (olv === lv + 1 && op.footprint.some((c) => open.has(`${c[0]},${c[1]}`))) return 'La trémie toucherait l’escalier de l’étage du dessus.';
      if (olv + 1 === lv && MT.openingsOf(o).some((c) => mine.has(`${c[0]},${c[1]}`))) return 'Ces cases sont la trémie d’un escalier du dessous.';
    }
    // étage du dessus : la trémie ne coupe ni mur, ni porte, ni fenêtre, ni élément posé au sol
    const up = lv + 1;
    if (MT.hasLevel(up)) {
      const where = up > 0 ? `de l’étage ${up}` : up < 0 ? `du sous-sol ${-up}` : 'du rez-de-chaussée';
      const WHAT = { '#': 'un mur', W: 'une fenêtre', D: 'une porte', P: 'un pilier' };
      for (const [x, z] of MT.openingsOf(st)) {
        const ch = MT.tileAt(x, z, up);
        if (WALLISH.has(ch)) return `La trémie couperait ${WHAT[ch]} ${where} : déplacez l’escalier ou retirez-le d’abord.`;
      }
      const on = (c) => open.has(`${c[0]},${c[1]}`);
      const atUp = (e) => MT.lvOf(e) === up;
      const hit = m.perks.some((p) => atUp(p) && on(p.cell)) ? 'un distributeur d’atout'
        : m.boxes.some((b) => atUp(b) && b.cells.some(on)) ? 'un emplacement de boîte mystère'
          : m.amp && atUp(m.amp) && m.amp.cells.some(on) ? 'l’Amplificateur'
            : m.risers.some((r) => atUp(r) && on(r)) ? 'une apparition de zombies'
              : atUp(m.spawn) && on([Math.floor(m.spawn.pos[0]), Math.floor(m.spawn.pos[1])]) ? 'le départ du joueur' : null;
      if (hit) return `La trémie tomberait sur ${hit} ${where}.`;
    }
    return null;
  };
  /* Pose un escalier ; crée l'étage du dessus s'il manque. Renvoie son indice, ou -1. */
  MT.placeStair = (x, z) => {
    const m = S.map;
    if (!m || !MT.multiOk()) return -1;
    const st = MT.stairFromOpts(x, z);
    const why = MT.stairProblem(st);
    if (why) { MT.toast(why, 'warn'); return -1; }
    const up = S.level + 1;
    if (up > (ZS.LEVEL_MAX || 6)) { MT.toast(`Pas d’étage possible au-dessus de l’étage ${ZS.LEVEL_MAX || 6}.`, 'warn'); return -1; }
    const created = !MT.hasLevel(up);
    if (created && MT.levels().length >= (ZS.LEVELS_MAX || 8)) { MT.toast(`${ZS.LEVELS_MAX || 8} niveaux au plus : impossible d’ajouter l’étage d’arrivée.`, 'warn'); return -1; }
    let idx = -1;
    MT.edit(`Poser : escalier ${ZS.STAIR_SHAPES[st.shape].toLowerCase()} (${ZS.STAIR_MATS[st.mat].name.toLowerCase()})`, (mm) => {
      if (!mm.stairs) mm.stairs = [];
      if (created) newLevel(mm, up, S.level);
      mm.stairs.push(st);
      idx = mm.stairs.length - 1;
      MT.carveOpenings(mm, st);
      S.sel = { kind: 'stair', i: idx };
    }, 'all');
    MT.emit('selection');
    if (created) MT.toast(`${MT.levelName(up)} ajouté pour l’arrivée de l’escalier.`, 'ok');
    return idx;
  };
  /* Change un escalier (forme, matériau, sens…) ; la trémie suit. */
  MT.updateStair = (i, fn, label = 'Modifier l’escalier') => {
    const m = S.map, st0 = MT.stairsOf()[i];
    if (!st0) return false;
    const next = deep(st0);
    fn(next);
    if (next.shape === 'spiral') next.w = 1;
    if (next.shape === 'l' || next.shape === 'u') { if (!next.n2) next.n2 = next.n; } else delete next.n2;
    if (next.shape === 'straight') delete next.turn; else if (next.turn !== -1) next.turn = 1;
    const why = MT.stairProblem(next, i);
    if (why) { MT.toast(why, 'warn'); return false; }
    MT.edit(label, (mm) => {
      MT.fillOpenings(mm, mm.stairs[i]);
      mm.stairs[i] = next;
      MT.carveOpenings(mm, next);
    }, 'all');
    return true;
  };
  const DIR_CW = (d) => [-d[1], d[0]];      // quart de tour (sens des aiguilles d'une montre, vu du plan)
  MT.rotateDir = (d, k = 1) => { let r = d.slice(); for (let i = 0; i < ((k % 4) + 4) % 4; i++) r = DIR_CW(r); return r; };

  /* --------------------------------------------- taille de la carte --- */
  /* ax, az : ancrage (0 = gauche/haut, 1 = centre, 2 = droite/bas). */
  MT.resizeMap = (W2, H2, ax, az) => {
    const m0 = S.map;
    W2 = clamp(Math.round(W2), ZS.MAP_MIN, ZS.MAP_MAX); H2 = clamp(Math.round(H2), ZS.MAP_MIN, ZS.MAP_MAX);
    const dx = ax === 0 ? 0 : ax === 1 ? Math.floor((W2 - m0.w) / 2) : W2 - m0.w;
    const dz = az === 0 ? 0 : az === 1 ? Math.floor((H2 - m0.h) / 2) : H2 - m0.h;
    return MT.edit('Redimensionner la carte', () => {
      const raw = ZS.serializeMap(m0);
      const shiftRows = (rows, fill) => {
        const out = [];
        for (let z = 0; z < H2; z++) {
          const src = rows[z - dz];
          let r = '';
          for (let x = 0; x < W2; x++) { const sx = x - dx; r += src !== undefined && sx >= 0 && sx < m0.w ? src[sx] : fill; }
          out.push(r);
        }
        return out;
      };
      const inside = (x, z) => x >= 0 && z >= 0 && x < W2 && z < H2;
      const mv = (c) => [c[0] + dx, c[1] + dz];
      raw.grid = shiftRows(m0.grid, ' ');
      for (const L of ['floor', 'ceil', 'wall']) raw.layers[L] = shiftRows(m0.layers[L], '.');
      if (m0.floors && m0.floors.length) {
        raw.floors = m0.floors.map((f) => {
          const ls = {};
          for (const L of ['floor', 'ceil', 'wall']) ls[L] = shiftRows((f.layers && f.layers[L]) || [], '.');
          return { lv: f.lv, grid: shiftRows(f.grid, ' '), layers: ls };
        });
      }
      let dropped = [];
      if (raw.stairs) {
        const fits = (s) => ZS.stairPlan(s).footprint.every((c) => inside(...c));
        const moved = raw.stairs.map((s) => ({ ...s, x: s.x + dx, z: s.z + dz }));
        raw.stairs = moved.filter(fits);
        dropped = moved.filter((s) => !fits(s));
      }
      raw.zones = raw.zones.map((z) => ({ ...z, seed: mv(z.seed) })).filter((z) => inside(...z.seed));
      raw.spawn.pos = [clamp(raw.spawn.pos[0] + dx, 0, W2), clamp(raw.spawn.pos[1] + dz, 0, H2)];
      raw.doors = raw.doors.map((d) => ({ ...d, cells: d.cells.map(mv).filter((c) => inside(...c)) })).filter((d) => d.cells.length);
      raw.wallbuys = raw.wallbuys.map((w) => ({ ...w, cell: mv(w.cell) })).filter((w) => inside(...w.cell));
      raw.perks = raw.perks.map((p) => ({ ...p, cell: mv(p.cell) })).filter((p) => inside(...p.cell));
      raw.boxes = raw.boxes.map((b) => ({ ...b, cells: b.cells.map(mv) })).filter((b) => b.cells.every((c) => inside(...c)));
      if (raw.power) { raw.power.cell = mv(raw.power.cell); if (!inside(...raw.power.cell)) raw.power = null; }
      if (raw.amp) { raw.amp.cells = raw.amp.cells.map(mv); if (!raw.amp.cells.every((c) => inside(...c))) raw.amp = null; }
      if (raw.digipass) { raw.digipass.cell = mv(raw.digipass.cell); if (!inside(...raw.digipass.cell)) raw.digipass = null; }
      raw.lights = raw.lights.map((l) => ({ ...l, pos: [l.pos[0] + dx, l.pos[1], l.pos[2] + dz] })).filter((l) => inside(Math.floor(l.pos[0]), Math.floor(l.pos[2])));
      raw.signs = raw.signs.map((s) => ({ ...s, pos: [s.pos[0] + dx, s.pos[1], s.pos[2] + dz] }));
      raw.risers = raw.risers.map((c) => mv(c).concat(c.slice(2))).filter((c) => inside(c[0], c[1]));
      raw.props = raw.props.map((p) => ({ ...p, x: p.x + dx, z: p.z + dz }));
      if (raw.menuCam) { raw.menuCam.pos[0] += dx; raw.menuCam.pos[2] += dz; raw.menuCam.look[0] += dx; raw.menuCam.look[2] += dz; }
      const m = ZS.normalizeMap(raw);
      for (const st of dropped) MT.fillOpenings(m, st);
      reconcileDoors(m);
      S.map = m;
      if (!MT.hasLevel(S.level)) S.level = 0;
      MT.emit('resized', dx, dz);
    }, 'all');
  };

  /* --------------------------------------------------------- fichiers --- */
  /* JSON lisible : une ligne par rangée de la grille, par objet, par lumière… */
  MT.formatMapJson = (o) => {
    const out = ['{'];
    const keys = Object.keys(o).filter((k) => o[k] !== undefined);
    const rows = (pad, name, list, end) => {
      out.push(`${pad}${JSON.stringify(name)}: [`);
      list.forEach((row, r) => out.push(`${pad}  ${JSON.stringify(row)}${r < list.length - 1 ? ',' : ''}`));
      out.push(`${pad}]${end}`);
    };
    keys.forEach((k, i) => {
      const v = o[k], end = i < keys.length - 1 ? ',' : '';
      const isList = Array.isArray(v) && v.length && v.every((e) => typeof e === 'string' || (e && typeof e === 'object'));
      if (k === 'floors' && isList) {
        // un bloc par niveau : une ligne par rangée, comme la grille du rez-de-chaussée
        out.push('  "floors": [');
        v.forEach((f, j) => {
          out.push('    {');
          const fk = Object.keys(f).filter((x) => f[x] !== undefined);
          fk.forEach((x, q) => {
            const e2 = q < fk.length - 1 ? ',' : '';
            if (x === 'grid' && Array.isArray(f.grid)) rows('      ', 'grid', f.grid, e2);
            else if (x === 'layers' && f.layers && typeof f.layers === 'object') {
              const ls = Object.keys(f.layers);
              if (!ls.length) { out.push(`      "layers": {}${e2}`); return; }
              out.push('      "layers": {');
              ls.forEach((L, li) => rows('        ', L, f.layers[L], li < ls.length - 1 ? ',' : ''));
              out.push(`      }${e2}`);
            } else out.push(`      ${JSON.stringify(x)}: ${JSON.stringify(f[x])}${e2}`);
          });
          out.push(`    }${j < v.length - 1 ? ',' : ''}`);
        });
        out.push(`  ]${end}`);
      } else if (isList) {
        out.push(`  ${JSON.stringify(k)}: [`);
        v.forEach((e, j) => out.push(`    ${JSON.stringify(e)}${j < v.length - 1 ? ',' : ''}`));
        out.push(`  ]${end}`);
      } else if (k === 'layers' && v && typeof v === 'object' && !Array.isArray(v)) {
        const ls = Object.keys(v);
        if (!ls.length) { out.push(`  "layers": {}${end}`); return; }
        out.push('  "layers": {');
        ls.forEach((L, j) => {
          out.push(`    ${JSON.stringify(L)}: [`);
          v[L].forEach((row, r) => out.push(`      ${JSON.stringify(row)}${r < v[L].length - 1 ? ',' : ''}`));
          out.push(`    ]${j < ls.length - 1 ? ',' : ''}`);
        });
        out.push(`  }${end}`);
      } else out.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${end}`);
    });
    out.push('}');
    return `${out.join('\n')}\n`;
  };
  /* Version enregistrable : images utilisées embarquées, palette nettoyée, date. */
  MT.exportMapObject = (m = S.map) => {
    compactPalette(m);
    const custom = {};
    for (const id of MT.usedTextures(m)) {
      if (!/^u_/.test(id)) continue;
      const t = S.library[id] || (m.custom && m.custom.textures && m.custom.textures[id]);
      if (t) custom[id] = { name: t.name, data: t.data, size: t.size.slice(), rough: t.rough, fit: !!t.fit };
    }
    const models = {};
    for (const p of m.props) {
      if (!/^u_/.test(p.m) || models[p.m]) continue;
      const t = S.modelLib[p.m] || (m.custom && m.custom.models && m.custom.models[p.m]);
      if (t) models[p.m] = modelEntry(t);
    }
    m.custom = { textures: custom, models };
    m.updated = new Date().toISOString();
    return ZS.serializeMap(m);
  };
  MT.mapJson = (m = S.map) => MT.formatMapJson(MT.exportMapObject(m));

  MT.save = async (opts = {}) => {
    if (!S.map) return false;
    const m = S.map;
    if (opts.id) { m.id = opts.id; S.id = opts.id; }
    if (opts.name) m.name = opts.name;
    if (!m.id || m.id === 'sans-nom') { m.id = MT.uniqueId(slug(m.name) || 'carte'); S.id = m.id; }
    const json = MT.mapJson(m);
    await MT.api.saveMap(S.id, json);
    S.source = 'workspace';
    S.savedRev = S.rev;
    if (!S.known.some((k) => k.id === S.id)) S.known.push({ id: S.id, name: m.name, updated: m.updated });
    MT.api.writeRecovery(S.id, null).catch(() => {});
    MT.emit('saved');
    MT.emit('history');
    MT.toast(`Carte enregistrée : ${m.name}`, 'ok');
    return true;
  };
  /* Copie de secours (toutes les 40 s s'il y a des modifications non enregistrées). */
  let lastRecoveryRev = -1;
  MT.writeRecovery = async () => {
    if (!S.map || !MT.isDirty() || S.rev === lastRecoveryRev || S.pending) return;
    lastRecoveryRev = S.rev;
    try {
      const copy = deep(S.map);
      await MT.api.writeRecovery(S.id || copy.id, MT.formatMapJson(MT.exportMapObject(copy)));
    } catch (e) { console.warn('Copie de secours impossible', e); }
  };
  setInterval(() => { MT.writeRecovery(); }, 40000);

  MT.uniqueId = (base, extra = []) => {
    const taken = new Set([...S.known.map((k) => k.id), ...Object.keys(ZS.MAPS.byId), ...extra]);
    let id = slug(base) || 'carte';
    if (!taken.has(id)) return id;
    for (let i = 2; i < 999; i++) { const c = `${id.slice(0, 36)}-${i}`; if (!taken.has(c)) return c; }
    return `${id.slice(0, 30)}-${Date.now() % 100000}`;
  };

  /* Ouvre une carte (déjà normalisée). source : 'workspace' | 'game' | 'new' | 'import' */
  MT.openMap = (map, { id, source }) => {
    S.map = map;
    S.id = id || map.id;
    S.source = source;
    S.undo = []; S.redo = []; S.pending = null; S.sel = null; S.level = 0;
    S.rev++;
    S.savedRev = source === 'workspace' || source === 'game' ? S.rev : -1;
    S.analysisRev = -1;
    absorbCustomTextures(map);
    MT.emit('map');
    MT.emit('change', 'all', { load: true });
    MT.emit('selection');
    MT.emit('history');
  };
  /* Liste des cartes : dossier de l'auteur + cartes du jeu (moteur). */
  MT.refreshKnown = async () => {
    try { S.known = (await MT.api.listMaps()) || []; } catch (e) { S.known = []; MT.toast(`Liste des cartes illisible : ${e.message}`, 'error'); }
    return S.known;
  };
  MT.readWorkspaceMap = async (id) => ZS.normalizeMap(JSON.parse(await MT.api.readMap(id)));
  MT.loadPublishSet = async () => {
    let v = null;
    try { v = await MT.api.getPublishSet(); } catch (e) { v = null; }
    S.publish = v && Array.isArray(v.maps) ? { maps: v.maps.filter((id) => typeof id === 'string' && /^[a-z0-9_-]{1,40}$/.test(id)) } : { maps: ZS.MAPS.list.slice(), auto: true };
    return S.publish;
  };
  MT.savePublishSet = async (maps) => {
    S.publish = { maps: [...new Set(maps)] };
    await MT.api.setPublishSet({ maps: S.publish.maps, updated: new Date().toISOString() });
    MT.emit('publish');
  };
})();
