'use strict';
/* =========================================================================
   Mod Tools — cartes ouvertes : outils (sélection, objets, éléments de jeu)
   Mêmes points que les autres outils ({ x, z, wx, wy, wz, view, … }) ; en 3D,
   el ({ kind, i }), prop ou mt (marqueur de l'éditeur) disent ce qui est visé.
   Le moteur recale chaque élément (contre un mur, sur le sol) : O.place.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS;
  const { round, rad } = MT.util;
  const S = MT.state;
  const O = MT.ow;

  const BASE_TOOLS = [
    { id: 'select', name: 'Sélection', key: 'KeyV', label: 'V', hint: 'Clic : sélectionner · glisser : déplacer · Maj+clic : ajouter des objets · Suppr : supprimer · R : tourner' },
    { id: 'props', name: 'Objets', key: 'KeyO', label: 'O', hint: 'Clic : poser · R : tourner · Alt+clic : pipette · Échap : sélection' },
    { id: 'elements', name: 'Éléments de jeu', key: 'KeyG', label: 'G', hint: 'Clic : poser · clic droit : retirer · R : tourner · 1 à 8 : genre' },
  ];
  /* Outils des cartes ouvertes : ceux du niveau 2 (relief, sol, routes, bâtiments) si le moteur les a. */
  Object.defineProperty(O, 'toolList', { get: () => BASE_TOOLS.concat(O.terrain && O.ok2() ? O.terrain.tools : []), configurable: true });
  O.KIND_KEYS = ['spawn', 'wallbuy', 'perk', 'box', 'vehicle', 'fuel', 'breaker', 'loc'];

  const snapV = (v, step) => (step > 0 ? Math.round(v / step) * step : v);
  const zoom = () => (MT.plan ? MT.plan.cam.zoom : 4);

  /* ----------------------------------------------- détection (clic) -- */
  /* Plan : à quelques pixels d'un élément (les éléments avant les objets). */
  O.hitTest = (p) => {
    const m = S.map;
    if (!m || !p) return null;
    if (p.view === '3d') {
      if (p.el && O.get(p.el)) return { ...p.el };
      if (typeof p.prop === 'number' && m.props[p.prop]) return { kind: 'prop', i: p.prop };
      if (p.mt) return { ...p.mt };
      const t = O.terrain ? O.terrain.hitTest(p) : null;
      return t && t.kind !== 'building' ? t : null;
    }
    const Z = zoom(), px = 9 / Z;
    let best = null, bd = Infinity;
    const test = (kind, i, x, z, r = 0) => {
      const d = Math.hypot(x - p.wx, z - p.wz) - r;
      if (d < Math.max(px, 0.4) && d < bd) { bd = d; best = kind === 'spawn' ? { kind } : { kind, i }; }
    };
    test('spawn', 0, m.spawn.pos[0], m.spawn.pos[1]);
    m.wallbuys.forEach((w, i) => test('wallbuy', i, w.x, w.z));
    m.perks.forEach((e, i) => test('perk', i, e.x + e.face[0] * 0.5, e.z + e.face[1] * 0.5, 0.4));
    m.boxes.forEach((e, i) => test('box', i, e.x, e.z, 0.5));
    m.vehicles.forEach((e, i) => { const T = ZS.VEH_TYPES[e.type]; test('vehicle', i, e.x, e.z, T ? T.wid * 0.5 : 1); });
    m.fuel.forEach((e, i) => test('fuel', i, e.x, e.z, 0.3));
    m.breakers.forEach((e, i) => test('breaker', i, e.x + e.nx * 0.2, e.z + e.nz * 0.2, 0.3));
    (m.locs || []).forEach((L, i) => test('loc', i, L.x, L.z));
    if (best) return best;
    let bi = -1, bestArea = Infinity;
    if (Z < 0.6) return O.terrain ? O.terrain.hitTest(p) : null;
    for (let i = m.props.length - 1; i >= 0; i--) {
      const pr = m.props[i];
      if (Math.abs(pr.x - p.wx) > 30 || Math.abs(pr.z - p.wz) > 30) continue;
      if (!MT.propContains(pr, p.wx, p.wz, 3 / Z)) continue;
      const b = MT.modelBox(pr.m), area = (b.max.x - b.min.x) * (b.max.z - b.min.z) * (pr.s || 1) ** 2;
      if (area < bestArea) { bi = i; bestArea = area; }
    }
    if (bi >= 0) return { kind: 'prop', i: bi };
    return O.terrain ? O.terrain.hitTest(p) : null;
  };

  /* ------------------------------------------------------- Sélection -- */
  function startMove(sel, p) {
    const m = S.map;
    if (sel.kind === 'prop') {
      MT.begin('Déplacer');
      MT.tools.drag = { mode: 'ow-props', start: [p.wx, p.wz], orig: sel.list.map((i) => [m.props[i].x, m.props[i].z]), list: sel.list.slice(), moved: false };
      return;
    }
    const e = O.get(sel);
    if (!e || sel.kind === 'road') return;
    MT.begin('Déplacer');
    MT.tools.drag = { mode: 'ow-el', sel: { ...sel }, start: [p.wx, p.wz], orig: O.posOf(sel.kind, e), moved: false, before: sel.kind === 'building' ? O.terrainRect('building', { ...e }) : null };
  }
  function dragMove(p, ev) {
    const d = MT.tools.drag, m = S.map;
    if (!d || !p) return;
    if (d.mode === 'ow-handle') { O.terrain.dragHandle(p); return; }
    let dx = p.wx - d.start[0], dz = p.wz - d.start[1];
    if (!d.moved && Math.hypot(dx, dz) < Math.max(0.06, 2 / zoom())) return;
    if (d.mode === 'ow-props') {
      d.moved = true;
      const snap = ev.alt ? 0 : S.opts.props.snap;
      if (snap) { dx = snapV(d.orig[0][0] + dx, snap) - d.orig[0][0]; dz = snapV(d.orig[0][1] + dz, snap) - d.orig[0][1]; }
      d.list.forEach((i, k) => { const pr = m.props[i]; if (pr) { pr.x = round(d.orig[k][0] + dx); pr.z = round(d.orig[k][1] + dz); } });
      MT.touch('prop-move', { list: d.list, live: true });
    } else if (d.mode === 'ow-el') {
      const r = O.moveTo(d.sel, d.orig[0] + dx, d.orig[1] + dz, true);
      if (r.ok) d.moved = true;
      MT.preview.owWhy = r.ok ? null : r.why || null;
    }
  }
  const select = {
    down(p, ev) {
      if (ev.button !== 0) return false;
      // point d'une route sélectionnée : on le glisse
      const hk = O.terrain && p.view === 'plan' ? O.terrain.roadHandleAt(p) : -1;
      if (hk >= 0) { O.terrain.startHandle(S.sel.i, hk, p); return true; }
      const hit = ev.alt ? null : O.hitTest(p);
      if (hit && hit.kind === 'prop') {
        const cur = MT.selectedProps();
        if (ev.shift) {
          const list = cur.includes(hit.i) ? cur.filter((i) => i !== hit.i) : [...cur, hit.i];
          MT.select(list.length ? { kind: 'prop', list } : null);
          return true;
        }
        if (!cur.includes(hit.i)) MT.select({ kind: 'prop', list: [hit.i] });
        startMove(S.sel, p);
        return true;
      }
      if (hit) {
        MT.select(hit);
        startMove(hit, p);
        return true;
      }
      if (p.view === 'plan') {
        MT.tools.drag = { mode: 'ow-box', a: [p.wx, p.wz], b: [p.wx, p.wz], shift: ev.shift };
        return true;
      }
      MT.select(null);
      return true;
    },
    drag(p, ev) {
      const d = MT.tools.drag;
      if (!d || !p) return;
      if (d.mode === 'ow-box') { d.b = [p.wx, p.wz]; MT.preview.rect = { a: d.a, b: d.b }; return; }
      dragMove(p, ev);
    },
    up() {
      const d = MT.tools.drag;
      if (!d) return;
      MT.preview.owWhy = null;
      if (d.mode === 'ow-box') {
        MT.preview.rect = null;
        const x0 = Math.min(d.a[0], d.b[0]), x1 = Math.max(d.a[0], d.b[0]), z0 = Math.min(d.a[1], d.b[1]), z1 = Math.max(d.a[1], d.b[1]);
        if (x1 - x0 < 3 / zoom() && z1 - z0 < 3 / zoom()) { if (!d.shift) MT.select(null); return; }
        const list = [];
        S.map.props.forEach((pr, i) => { if (pr.x >= x0 && pr.x <= x1 && pr.z >= z0 && pr.z <= z1) list.push(i); });
        const merged = d.shift ? [...new Set([...MT.selectedProps(), ...list])] : list;
        MT.select(merged.length ? { kind: 'prop', list: merged } : null);
        if (merged.length) MT.toast(`${merged.length} objet${merged.length > 1 ? 's' : ''} sélectionné${merged.length > 1 ? 's' : ''}`);
        return;
      }
      // fin du glisser : les cases (solides) suivent ; un bâtiment refait le terrain sous lui
      if (d.mode === 'ow-handle') { O.terrain.endHandle(); return; }
      if (d.moved && d.mode === 'ow-el') {
        if (d.sel.kind === 'building') MT.touch('ow-terrain', { rect: O.unionRect(d.before, O.terrainRect('building', O.get(d.sel))) });
        else if (d.sel.kind === 'loc') MT.touch('settings');
        else MT.touch('ow-el', { kind: d.sel.kind, i: d.sel.i });
      }
      if (d.moved && d.mode === 'ow-props') MT.touch('props', { list: d.list });
    },
    hover() { MT.preview.ow = null; MT.preview.ghost = null; },
  };

  /* ---------------------------------------------------------- Objets -- */
  /* Position d'un objet à poser : grille, murs (objets muraux), empilement (en 3D). */
  O.propPlacement = (p, ev) => {
    const o = S.opts.props, def = ZS.MODELS[o.model];
    if (!def || !p || !ZS.ow.on) return null;
    const snap = ev && ev.alt ? 0 : o.snap;
    let x = snapV(p.wx, snap), z = snapV(p.wz, snap), y = 0, face = null;
    if (def.wall) {
      const r = ZS.ow.place('wallbuy', p.wx, p.wz, { rad: 2 });
      if (r.ok) { face = [r.nx, r.nz]; x = r.nx ? r.x - r.nx * 0.01 : snapV(r.x, snap || 0.05); z = r.nz ? r.z - r.nz * 0.01 : snapV(r.z, snap || 0.05); }
    } else if (p.view === '3d' && p.ny > 0.5) {
      const fy = p.wy - ZS.ow.ground(x, z);
      if (fy > 0.04 && fy < 12) y = round(fy);
    }
    return { x: round(x), z: round(z), y, face };
  };
  const props = {
    down(p, ev) {
      if (ev.button !== 0) return false;
      const o = S.opts.props;
      if (ev.alt) {
        const hit = O.hitTest(p);
        if (hit && hit.kind === 'prop') { o.model = S.map.props[hit.i].m; MT.emit('tool-opts'); MT.toast(`Objet choisi : ${ZS.MODELS[o.model].name}`); }
        return true;
      }
      const pl = O.propPlacement(p, ev);
      if (!pl) { MT.toast(ZS.MODELS[o.model] ? 'Monde pas encore chargé.' : 'Choisissez un objet dans la bibliothèque.', 'warn'); return true; }
      if (S.map.props.length >= O.limit('prop')) { MT.toast(`Objets : ${O.limit('prop')} au plus sur une carte ouverte.`, 'warn'); return true; }
      const pr = MT.makeProp(o.model, pl.x, pl.z, pl.y, pl.face);
      MT.edit(`Poser : ${ZS.MODELS[o.model].name}`, (m) => { m.props.push(pr); S.sel = { kind: 'prop', list: [m.props.length - 1] }; }, 'props');
      MT.emit('selection');
      MT.pushRecent('model', o.model);
      return true;
    },
    hover(p, ev) {
      const pl = p ? O.propPlacement(p, ev) : null;
      if (!pl) { MT.preview.ghost = null; return; }
      const o = S.opts.props, def = ZS.MODELS[o.model];
      const r = pl.face && def.wall ? Math.atan2(pl.face[0], pl.face[1]) : rad(o.rot);
      MT.preview.ghost = { m: o.model, x: pl.x, z: pl.z, y: pl.y, r, s: o.scale || 1 };
    },
  };

  /* ------------------------------------------------ Éléments de jeu -- */
  const elements = {
    down(p, ev) {
      const kind = S.opts.ow.kind;
      if (ev.button === 2) {
        const hit = O.hitTest(p);
        if (hit && hit.kind !== 'prop' && hit.kind !== 'spawn') O.remove(hit.kind, hit.i);
        return true;
      }
      if (ev.button !== 0) return false;
      // un élément déjà posé sous le curseur : on le sélectionne (et on peut le glisser)
      const hit = O.hitTest(p);
      if (hit && hit.kind !== 'prop') { MT.select(hit); startMove(hit, p); return true; }
      O.add(kind, p.wx, p.wz);
      return true;
    },
    drag(p, ev) { if (MT.tools.drag) dragMove(p, ev); },
    up() {
      const d = MT.tools.drag;
      MT.preview.owWhy = null;
      if (d && d.moved && d.mode === 'ow-el') MT.touch('ow-el', { kind: d.sel.kind, i: d.sel.i });
    },
    hover(p) {
      if (!p || !ZS.ow.on) { MT.preview.ow = null; return; }
      const o = S.opts.ow, r = O.place(o.kind, p.wx, p.wz);
      MT.preview.ow = { kind: o.kind, ...r, face: r.face || (o.kind === 'perk' || o.kind === 'box' || o.kind === 'breaker' ? o.face : null), yaw: o.yaw, type: o.vehicle, wx: p.wx, wz: p.wz };
    },
  };

  O.TOOLS = { select, props, elements };
})();
