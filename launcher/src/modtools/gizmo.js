'use strict';
/* =========================================================================
   Mod Tools — flèches de déplacement (gizmo 3D), launcher 1.3.3
   Sur ce qui est sélectionné en 3D (objets, lumières, départ, éléments de jeu,
   panneaux, escaliers, décor de la base, bâtiments, lieux nommés) :
     Déplacer : trois flèches (X rouge vers l'est, Y vert vers le haut, Z bleu
                vers le sud), trois carrés pour glisser dans un plan, le cube du
                centre pour glisser sur le sol ;
     Tourner  : un anneau autour de la verticale ;
     Taille   : une poignée par axe, le cube du centre pour les trois à la fois.
   Dessiné par-dessus la scène, à taille constante à l'écran. Un geste = une
   étape d'annulation. Recalage : la grille de l'outil Objets (Alt : libre) ;
   ce qui est posé sur les cases (atouts, boîte, armes murales… d'une carte en
   grille) avance case par case ; le moteur recale les éléments d'une carte
   ouverte (contre un mur, sur le sol). X : mode suivant.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const { clamp, round, rad, deg, wrapRad, deep, h } = MT.util;
  const S = MT.state;
  const V = () => MT.v3;
  const OW = () => MT.ow;
  const PREF = 'mt.gizmo';
  const G = (MT.gizmo = { mode: 'move', show: true, root: null, drag: null, hover: null, px: 108, handles: {} });
  try { const p = JSON.parse(localStorage.getItem(PREF) || '{}'); if (['move', 'rotate', 'scale'].includes(p.mode)) G.mode = p.mode; if (p.show === false) G.show = false; } catch (e) { /* rien */ }
  const savePref = () => { try { localStorage.setItem(PREF, JSON.stringify({ mode: G.mode, show: G.show })); } catch (e) { /* rien */ } };
  G.MODES = [['move', 'Déplacer'], ['rotate', 'Tourner'], ['scale', 'Taille']];

  /* ------------------------------------------------------------ dessin -- */
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const COL = { x: 0xe8473d, y: 0x56cf47, z: 0x3c80ec, u: 0xefe8d4, hi: 0xffd23a };
  const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const PICK = new THREE.MeshBasicMaterial({ visible: false });
  /* Une poignée : ses maillages visibles (une matière à elle, qui s'allume au survol) et ceux qu'on vise
     (invisibles, plus épais). kind : axis, plane, center, ring, scale, uscale. */
  const HANDLES = {
    x: { mode: 'move', kind: 'axis', a: 'x' }, y: { mode: 'move', kind: 'axis', a: 'y' }, z: { mode: 'move', kind: 'axis', a: 'z' },
    xz: { mode: 'move', kind: 'plane', n: 'y', a: 'xz' }, xy: { mode: 'move', kind: 'plane', n: 'z', a: 'xy' }, yz: { mode: 'move', kind: 'plane', n: 'x', a: 'yz' },
    c: { mode: 'move', kind: 'plane', n: 'y', a: 'xz' },
    ry: { mode: 'rotate', kind: 'ring' },
    sx: { mode: 'scale', kind: 'scale', a: 'x' }, sy: { mode: 'scale', kind: 'scale', a: 'y' }, sz: { mode: 'scale', kind: 'scale', a: 'z' },
    su: { mode: 'scale', kind: 'uscale' },
  };
  /* géométrie construite le long de +Y, tournée vers l'axe voulu */
  const toAxis = (geo, a) => (a === 'x' ? geo.rotateZ(-Math.PI / 2) : a === 'z' ? geo.rotateX(Math.PI / 2) : geo);
  function build() {
    const root = new THREE.Group();
    root.name = 'gizmo';
    root.userData.noPick = true;
    root.visible = false;
    const add = (id, color, opacity, geos, picks, lines = []) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: lin(color), transparent: true, opacity, depthTest: false, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
      const lmat = lines.length ? new THREE.LineBasicMaterial({ color: lin(color), transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false, toneMapped: false }) : null;
      for (const geo of geos) { const me = new THREE.Mesh(geo, mat); me.renderOrder = 1000; me.userData.noPick = true; g.add(me); }
      for (const geo of lines) { const l = new THREE.LineSegments(geo, lmat); l.renderOrder = 1001; l.userData.noPick = true; g.add(l); }
      const pk = [];
      for (const geo of picks) { const me = new THREE.Mesh(geo, PICK); me.userData.h = id; me.userData.noPick = true; g.add(me); pk.push(me); }
      root.add(g);
      G.handles[id] = { id, ...HANDLES[id], group: g, mat, lmat, color, opacity, picks: pk };
    };
    // déplacer : flèches
    for (const a of ['x', 'y', 'z']) {
      add(a, COL[a], 1,
        [toAxis(new THREE.CylinderGeometry(0.018, 0.018, 0.74, 8).translate(0, 0.16 + 0.37, 0), a), toAxis(new THREE.ConeGeometry(0.068, 0.24, 18).translate(0, 1.0, 0), a)],
        [toAxis(new THREE.CylinderGeometry(0.085, 0.085, 1.02, 8).translate(0, 0.62, 0), a)]);
    }
    // déplacer : carrés des plans (couleur de l'axe qui leur est perpendiculaire)
    const sq = (plane) => {
      const g = new THREE.PlaneGeometry(0.22, 0.22);
      if (plane === 'xz') g.rotateX(-Math.PI / 2).translate(0.36, 0, 0.36);
      else if (plane === 'xy') g.translate(0.36, 0.36, 0);
      else g.rotateY(Math.PI / 2).translate(0, 0.36, 0.36);
      return g;
    };
    for (const [id, n] of [['xz', 'y'], ['xy', 'z'], ['yz', 'x']]) add(id, COL[n], 0.42, [sq(id)], [sq(id)], [new THREE.EdgesGeometry(sq(id))]);
    // déplacer : cube du centre (sur le sol)
    add('c', COL.u, 0.9, [new THREE.BoxGeometry(0.1, 0.1, 0.1)], [new THREE.BoxGeometry(0.2, 0.2, 0.2)]);
    // tourner : anneau autour de la verticale, repères tous les 45°
    const ticks = [];
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; ticks.push(new THREE.BoxGeometry(0.012, 0.012, 0.12).rotateY(-a).translate(Math.sin(a) * 0.92, 0, Math.cos(a) * 0.92)); }
    add('ry', COL.y, 1, [new THREE.TorusGeometry(0.92, 0.014, 6, 96).rotateX(Math.PI / 2), ...ticks], [new THREE.TorusGeometry(0.92, 0.075, 6, 48).rotateX(Math.PI / 2)]);
    // taille : une poignée par axe, cube du centre pour les trois
    for (const a of ['x', 'y', 'z']) {
      add(`s${a}`, COL[a], 1,
        [toAxis(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 6).translate(0, 0.12 + 0.4, 0), a), toAxis(new THREE.BoxGeometry(0.12, 0.12, 0.12).translate(0, 0.98, 0), a)],
        [toAxis(new THREE.CylinderGeometry(0.085, 0.085, 1.02, 8).translate(0, 0.62, 0), a)]);
    }
    add('su', COL.u, 0.95, [new THREE.BoxGeometry(0.16, 0.16, 0.16)], [new THREE.BoxGeometry(0.26, 0.26, 0.26)]);
    G.root = root;
    ZS.scene.add(root);
  }
  function setHover(id) {
    if (G.hover === id) return;
    const prev = G.handles[G.hover];
    if (prev) { prev.mat.color.copy(lin(prev.color)); prev.mat.opacity = prev.opacity; if (prev.lmat) prev.lmat.color.copy(lin(prev.color)); }
    G.hover = id;
    const cur = G.handles[id];
    if (cur) { cur.mat.color.copy(lin(COL.hi)); cur.mat.opacity = Math.max(cur.opacity, 0.7); if (cur.lmat) cur.lmat.color.copy(lin(COL.hi)); }
    const v = V();
    if (v && v.canvas) v.canvas.style.cursor = id ? (HANDLES[id].kind === 'ring' ? 'grab' : 'move') : '';
  }

  /* ------------------------------------------------ ce qui se déplace -- */
  const isOpen = () => MT.isOpen();
  const gy = (x, z) => { try { return ZS.ow && ZS.ow.on ? ZS.ow.ground(x, z) : 0; } catch (e) { return 0; } };
  const sizesOk = () => MT.sizesOk();
  /* Ce que permet la sélection : axes de déplacement, rotation ('free' : au degré près ; 'quarter' :
     par quart de tour ; 'flip' : demi-tour), taille ('axes' : par axe ; 'uniform' : un facteur). */
  function caps(sel) {
    const m = S.map;
    if (!sel || !m) return null;
    if (sel.kind === 'prop') return sel.list && sel.list.length ? { x: 1, y: 1, z: 1, rot: 'free', scale: sizesOk() ? 'axes' : null } : null;
    if (isOpen()) {
      const e = OW().get(sel);
      if (!e) return null;
      switch (sel.kind) {
        case 'place': return e.locked || e.hidden ? null : { x: 1, y: 1, z: 1, rot: 'free', scale: sizesOk() ? 'axes' : null };
        case 'spawn': case 'vehicle': return { x: 1, z: 1, rot: 'free' };
        case 'perk': case 'box': case 'oxy': case 'glas': case 'breaker': return { x: 1, z: 1, rot: 'quarter', scale: sizesOk() ? 'uniform' : null };
        case 'wallbuy': case 'fuel': return { x: 1, z: 1, scale: sizesOk() ? 'uniform' : null };
        case 'building': return { x: 1, z: 1, rot: 'quarter' };
        case 'loc': return { x: 1, z: 1 };
        default: return null;
      }
    }
    const el = { light: m.lights, perk: m.perks, riser: m.risers, box: m.boxes, wallbuy: m.wallbuys, sign: m.signs, stair: m.stairs || [] }[sel.kind];
    if (el && !el[sel.i]) return null;
    switch (sel.kind) {
      case 'light': return { x: 1, y: 1, z: 1 };
      case 'spawn': return { x: 1, z: 1, rot: 'free' };
      case 'sign': { const s = m.signs[sel.i]; return { x: s.n[0] ? 0 : 1, z: s.n[0] ? 1 : 0, y: 1, scale: sizesOk() ? 'uniform' : null }; }
      case 'perk': return { x: 1, z: 1, cell: 1, rot: 'quarter', scale: sizesOk() ? 'uniform' : null };
      case 'box': return { x: 1, z: 1, cell: 1, rot: 'flip', scale: sizesOk() ? 'uniform' : null };
      case 'amp': return m.amp ? { x: 1, z: 1, cell: 1, rot: 'flip', scale: sizesOk() ? 'uniform' : null } : null;
      case 'wallbuy': return { x: 1, z: 1, cell: 1, scale: sizesOk() ? 'uniform' : null };
      case 'power': return m.power ? { x: 1, z: 1, cell: 1, scale: sizesOk() ? 'uniform' : null } : null;
      case 'riser': return { x: 1, z: 1, cell: 1 };
      case 'stair': return { x: 1, z: 1, cell: 1, rot: 'quarter' };
      default: return null;
    }
  }
  G.caps = caps;
  /* La poignée id est-elle permise par ce que la sélection sait faire ? */
  function allowed(id, c) {
    const H = HANDLES[id];
    if (H.mode !== G.mode || !c) return false;
    switch (H.kind) {
      case 'axis': return !!c[H.a];
      case 'plane': return !!c[H.a[0]] && !!c[H.a[1]] && !(c.cell && H.a !== 'xz');
      case 'ring': return !!c.rot;
      case 'scale': return c.scale === 'axes';
      case 'uscale': return !!c.scale;
      default: return false;
    }
  }
  /* Point d'appui : le centre de la boîte de sélection de la vue 3D (une pièce du décor : la sienne). */
  function pivotOf(sel) {
    const v = V(), boxes = [];
    if (v && v.sel) v.sel.traverse((o) => { if (o.box && o.box.isBox3) boxes.push(o.box); });
    if (!boxes.length) return null;
    if (sel.kind === 'place') return boxes[0].getCenter(new THREE.Vector3());
    const u = new THREE.Box3();
    for (const b of boxes) u.union(b);
    return u.getCenter(new THREE.Vector3());
  }
  /* Le cadre de la sélection est refait une image après un changement (objets reconstruits) : pendant
     ce temps, le point d'appui de la même sélection reste celui d'avant (flèches dessinées et visées au
     même endroit, pas de clic qui tombe dans le vide). */
  let lastPivot = null, lastKey = '';
  function target() {
    const sel = S.sel, c = caps(sel);
    if (!c) return null;
    const key = JSON.stringify(sel);
    let pivot = pivotOf(sel);
    if (pivot) { lastPivot = pivot.clone(); lastKey = key; } else if (key === lastKey && lastPivot) pivot = lastPivot.clone();
    return pivot ? { sel, caps: c, pivot } : null;
  }
  G.target = target;

  /* ----------------------------------------------- appliquer le geste -- */
  const gridStep = (ev) => (ev && ev.alt ? 0 : S.opts.props.snap || 0);
  const snapV = (v, s) => (s > 0 ? Math.round(v / s) * s : v);
  const rotSnap = (a, ev) => { const s = ev && ev.alt ? 0 : rad(ev && ev.shift ? 45 : (S.opts.props.rotStep || 15)); return s ? Math.round(a / s) * s : a; };
  const scaleSnap = (f, ev) => (ev && ev.alt ? f : Math.round(f * 20) / 20);
  const PROP_RULE = () => (ZS.SIZE_RULES ? ZS.SIZE_RULES.prop : [0.1, 10]);
  const kOf = (e) => (e && e.k ? e.k : 1);
  const setK = (e, k) => { const v = ZS.elemK ? ZS.elemK(k) : 1; if (Math.abs(v - 1) < 1e-3) delete e.k; else e.k = v; };
  const LABEL = { move: 'Déplacer', rotate: 'Tourner', scale: 'Taille' };

  /* Objets posés (les deux sortes de cartes) : un ou plusieurs. */
  function propOps(sel) {
    const m = S.map, open = isOpen(), list = sel.list.slice(), orig = list.map((i) => deep(m.props[i]));
    const cx = orig.reduce((a, p) => a + p.x, 0) / orig.length, cz = orig.reduce((a, p) => a + p.z, 0) / orig.length;
    const live = () => MT.touch('prop-move', { list, live: true });
    return {
      begin(mode) { MT.begin(LABEL[mode]); },
      move(d, ev) {
        const s = gridStep(ev), o0 = orig[0];
        let dx = d.x, dz = d.z, dy = d.y;
        if (s) {
          if (Math.abs(d.x) > 1e-9) dx = snapV(o0.x + dx, s) - o0.x;
          if (Math.abs(d.z) > 1e-9) dz = snapV(o0.z + dz, s) - o0.z;
          if (Math.abs(d.y) > 1e-9) dy = snapV((o0.y || 0) + dy, Math.min(s, 0.25)) - (o0.y || 0);
        }
        list.forEach((i, k) => {
          const pr = m.props[i], o = orig[k];
          if (!pr) return;
          pr.x = round(clamp(o.x + dx, 0, m.w)); pr.z = round(clamp(o.z + dz, 0, m.h));
          const y = round(clamp((o.y || 0) + dy, open ? -20 : -5, open ? 60 : 30));
          if (Math.abs(y) > 1e-4) pr.y = y; else delete pr.y;
        });
        live();
        return new THREE.Vector3(dx, dy, dz);
      },
      rotate(a, ev) {
        const aa = rotSnap(a, ev), c = Math.cos(aa), sn = Math.sin(aa);
        list.forEach((i, k) => {
          const pr = m.props[i], o = orig[k];
          if (!pr) return;
          if (list.length > 1) { const dx = o.x - cx, dz = o.z - cz; pr.x = round(cx + c * dx + sn * dz); pr.z = round(cz - sn * dx + c * dz); }
          const r = round(wrapRad((o.r || 0) + aa), 4);
          if (Math.abs(r) > 1e-4) pr.r = r; else delete pr.r;
        });
        live();
        return aa;
      },
      scale(f, ev) {
        const [a, b] = PROP_RULE(), ff = f.map((v) => scaleSnap(v, ev));
        list.forEach((i, k) => { const pr = m.props[i]; if (pr) MT.setPropScale(pr, MT.propScale(orig[k]).map((v, j) => round(clamp(v * ff[j], a, b), 3))); });
        live();
        return ff;
      },
      end() { MT.touch('props', { list }); MT.commit(); },
    };
  }

  /* Cartes en grille : lumières, départ, panneaux, et ce qui est posé sur les cases. */
  function gridOps(sel) {
    const m = S.map, kind = sel.kind;
    if (kind === 'light') {
      const l = m.lights[sel.i], o = l.pos.slice();
      return {
        begin(mode) { MT.begin('Déplacer la lumière'); },
        move(d, ev) {
          const s = gridStep(ev);
          const sn = (v, dv, st) => (st && Math.abs(dv) > 1e-9 ? snapV(v + dv, st) : v + dv);
          const x = sn(o[0], d.x, s), z = sn(o[2], d.z, s), y = sn(o[1], d.y, Math.min(s, 0.25));
          l.pos = [round(clamp(x, 0, m.w)), round(clamp(y, 0.2, 12)), round(clamp(z, 0, m.h))];
          MT.touch('light-live', { i: sel.i, move: true });
          return new THREE.Vector3(l.pos[0] - o[0], l.pos[1] - o[1], l.pos[2] - o[2]);
        },
        end() { MT.touch('lights'); MT.commit(); },
      };
    }
    if (kind === 'spawn') {
      const sp = m.spawn, o = sp.pos.slice(), yaw0 = sp.yaw;
      return {
        begin(mode) { MT.begin(mode === 'rotate' ? 'Tourner le départ' : 'Déplacer le départ'); },
        move(d, ev) {
          const s = gridStep(ev) || 0.05;
          const sn = (v, dv) => (Math.abs(dv) > 1e-9 ? snapV(v + dv, s) : v);
          sp.pos = [round(clamp(sn(o[0], d.x), 0, m.w)), round(clamp(sn(o[1], d.z), 0, m.h))];
          MT.tagLv(sp);
          MT.touch('spawn-live', { live: true });
          return new THREE.Vector3(sp.pos[0] - o[0], 0, sp.pos[1] - o[1]);
        },
        rotate(a, ev) { const aa = rotSnap(a, ev); sp.yaw = round(wrapRad(yaw0 + aa), 4); MT.touch('spawn-live', { live: true }); return aa; },
        end() { MT.touch('elements'); MT.commit(); },
      };
    }
    if (kind === 'sign') {
      const sg = m.signs[sel.i], o = sg.pos.slice(), k0 = kOf(sg);
      const ok = (pos) => { const c = MT.signCell({ pos, n: sg.n }); const t = MT.tileAt(c[0], c[1]); return (t === '#' || t === 'W' || t === 'D' || t === 'P') && MT.isFloor(MT.tileAt(c[0] + sg.n[0], c[1] + sg.n[1])); };
      return {
        begin(mode) { MT.begin(mode === 'scale' ? 'Taille du panneau' : 'Déplacer le panneau'); },
        move(d, ev) {
          const s = gridStep(ev);
          const sn = (v, dv, st) => (st && Math.abs(dv) > 1e-9 ? snapV(v + dv, st) : v + dv);
          const pos = [round(sg.n[0] ? o[0] : sn(o[0], d.x, s)), round(clamp(sn(o[1], d.y, Math.min(s, 0.25)), 0.3, 8)), round(sg.n[0] ? sn(o[2], d.z, s) : o[2])];
          if (ok(pos)) { sg.pos = pos; MT.touch('elements', { live: true }); }
          return new THREE.Vector3(sg.pos[0] - o[0], sg.pos[1] - o[1], sg.pos[2] - o[2]);
        },
        scale(f, ev) { const k = scaleSnap(k0 * f[0], ev); setK(sg, k); MT.touch('elements', { live: true }); return [kOf(sg) / k0, kOf(sg) / k0, kOf(sg) / k0]; },
        end() { MT.touch('elements'); MT.commit(); },
      };
    }
    // posé sur les cases : avance case par case (le même contrôle que le glisser du plan)
    const e = kind === 'perk' ? m.perks[sel.i] : kind === 'box' ? m.boxes[sel.i] : kind === 'amp' ? m.amp : kind === 'wallbuy' ? m.wallbuys[sel.i] : kind === 'power' ? m.power : kind === 'riser' ? m.risers[sel.i] : kind === 'stair' ? m.stairs[sel.i] : null;
    if (!e) return null;
    const anchor = () => {
      const x = kind === 'perk' ? m.perks[sel.i] : kind === 'box' ? m.boxes[sel.i] : kind === 'amp' ? m.amp : kind === 'wallbuy' ? m.wallbuys[sel.i] : kind === 'power' ? m.power : kind === 'riser' ? m.risers[sel.i] : m.stairs[sel.i];
      if (kind === 'riser') return [x[0], x[1]];
      if (kind === 'stair') return [x.x, x.z];
      if (kind === 'box' || kind === 'amp') return [Math.min(x.cells[0][0], x.cells[1][0]), Math.min(x.cells[0][1], x.cells[1][1])];
      return x.cell.slice();
    };
    const a0 = anchor(), k0 = kOf(e);
    let cur = a0.slice();
    const face = () => (kind === 'wallbuy' ? m.wallbuys[sel.i].n : kind === 'power' ? m.power.n : null);
    return {
      cell: true,
      begin(mode) { MT.begin(mode === 'scale' ? 'Taille' : 'Déplacer'); },
      move(d) {
        const t = [a0[0] + Math.round(d.x), a0[1] + Math.round(d.z)];
        if ((t[0] !== cur[0] || t[1] !== cur[1]) && MT.inb(t[0], t[1])) {
          const f = face();
          const p = { x: t[0], z: t[1], wx: t[0] + 0.5 + (f ? f[0] * 0.49 : 0), wz: t[1] + 0.5 + (f ? f[1] * 0.49 : 0), face: f ? f.slice() : null, view: '3d' };
          if (MT.tools.moveElementTo(sel, p, cur)) { cur = t; MT.touch(kind === 'stair' ? 'all' : 'elements', { live: true }); }
        }
        return new THREE.Vector3(cur[0] - a0[0], 0, cur[1] - a0[1]);
      },
      scale(f, ev) {
        const x = kind === 'perk' ? m.perks[sel.i] : kind === 'box' ? m.boxes[sel.i] : kind === 'amp' ? m.amp : kind === 'wallbuy' ? m.wallbuys[sel.i] : m.power;
        setK(x, scaleSnap(k0 * f[0], ev));
        MT.touch('elements', { live: true });
        const r = kOf(x) / k0;
        return [r, r, r];
      },
      end() { MT.touch(kind === 'stair' ? 'all' : 'elements'); MT.commit(); },
    };
  }

  /* Cartes ouvertes : décor de la base, éléments (le moteur les recale), bâtiments, lieux. */
  function openOps(sel) {
    const O = OW(), m = S.map, kind = sel.kind, e = O.get(sel);
    if (!e) return null;
    if (kind === 'place') {
      const D = O.placeDesc()[sel.i];
      if (!D) return null;
      const E0 = deep((m.placeEdits && m.placeEdits[D.id]) || {}), x0 = e.x, z0 = e.z;
      const s0 = ZS.propScale ? ZS.propScale({ s: E0.s }) : [1, 1, 1];
      let plan = null;
      /* retouche écrite depuis celle d'avant le geste ; ce qui est posé dedans suit */
      const write = (fn) => {
        const E = m.placeEdits || (m.placeEdits = {}), ne = deep(E0);
        fn(ne);
        O.placeClean(ne, e);
        if (Object.keys(ne).length) E[D.id] = ne; else delete E[D.id];
        for (const P of plan || []) { const B = O.placeMatrix(P.i, m); if (!B.hidden) O.placeFollowApply(m, P.fol, P.A, B.M); }
        MT.touch('ow-live', { kind: 'place', i: sel.i, live: true });
      };
      return {
        begin(mode) { plan = O.placeFollowPlan([sel.i]); MT.begin(LABEL[mode]); },
        move(d, ev) {
          const s = gridStep(ev);
          const sn = (v, dv, st) => (st && Math.abs(dv) > 1e-9 ? snapV(v + dv, st) : v + dv);
          const tx = clamp(sn(x0, d.x, s), 1, m.w - 1), tz = clamp(sn(z0, d.z, s), 1, m.h - 1);
          const dy0 = E0.dy || 0, dy = sn(dy0, d.y, Math.min(s, 0.25)) - dy0;
          write((ne) => {
            if (Math.abs(tx - x0) > 1e-4 || Math.abs(tz - z0) > 1e-4) { const [lx, lz] = ZS.ow.placeLocal(sel.i, tx, tz, m); ne.x = round(lx, 3); ne.z = round(lz, 3); }
            ne.dy = round(clamp(dy0 + dy, -60, 200), 3);
          });
          return new THREE.Vector3(tx - x0, dy, tz - z0);
        },
        rotate(a, ev) { const aa = rotSnap(a, ev); write((ne) => { ne.r = (E0.r || 0) + aa; }); return aa; },
        scale(f, ev) {
          const [a, b] = PROP_RULE(), ff = f.map((v) => scaleSnap(v, ev));
          write((ne) => { ne.s = s0.map((v, j) => round(clamp(v * ff[j], a, b), 3)); });
          return ff;
        },
        end() { MT.touch('ow-el', { kind: 'place', i: sel.i }); MT.commit(); },
      };
    }
    if (kind === 'road') return null;
    const [x0, z0] = O.posOf(kind, e);
    const yaw0 = kind === 'spawn' || kind === 'vehicle' ? e.yaw || 0 : 0, k0 = kOf(e);
    const before = kind === 'building' ? O.terrainRect('building', deep(e)) : null;
    const free = kind === 'vehicle' || kind === 'spawn' || kind === 'loc';
    let last = null;
    return {
      quarter: kind !== 'spawn' && kind !== 'vehicle',
      begin(mode) { MT.begin(LABEL[mode]); },
      move(d, ev) {
        const s = free ? gridStep(ev) : 0;
        const tx = s && Math.abs(d.x) > 1e-9 ? snapV(x0 + d.x, s) : x0 + d.x, tz = s && Math.abs(d.z) > 1e-9 ? snapV(z0 + d.z, s) : z0 + d.z;
        const r = O.moveTo(sel, tx, tz, true);
        last = r && r.ok ? null : (r && r.why) || null;
        MT.preview.owWhy = last;
        const cur = O.get(sel), [x, z] = O.posOf(kind, cur);
        return new THREE.Vector3(x - x0, 0, z - z0);
      },
      rotate(a, ev) {
        const aa = rotSnap(a, ev), x = O.get(sel);
        x.yaw = round(wrapRad(yaw0 + aa), 4);
        MT.touch('ow-live', { kind, i: sel.i, live: true });
        return aa;
      },
      scale(f, ev) { const x = O.get(sel); setK(x, scaleSnap(k0 * f[0], ev)); MT.touch('ow-el', { kind, i: sel.i, live: true }); const r = kOf(x) / k0; return [r, r, r]; },
      end() {
        MT.preview.owWhy = null;
        if (kind === 'building') MT.touch('ow-terrain', { rect: O.unionRect(before, O.terrainRect('building', O.get(sel))) });
        else if (kind === 'loc') MT.touch('settings');
        else MT.touch('ow-el', { kind, i: sel.i });
        MT.commit();
        if (last) MT.toast(last, 'warn');
      },
    };
  }
  function makeOps(sel) {
    if (sel.kind === 'prop') return propOps(sel);
    return isOpen() ? openOps(sel) : gridOps(sel);
  }

  /* ------------------------------------------------------------ souris -- */
  const tmp = new THREE.Vector3();
  function rayPlane(e, plane) {
    const v = V();
    v.int.setRay(e);
    const q = v.int.ray.ray.intersectPlane(plane, new THREE.Vector3());
    return q;
  }
  /* Plan qui contient l'axe et fait face à la caméra (glisser le long d'un axe). */
  function axisPlane(axis, p0) {
    const cam = V().cam, view = tmp.copy(cam.position).sub(p0).normalize();
    const n = view.clone().sub(axis.clone().multiplyScalar(view.dot(axis)));
    if (n.lengthSq() < 1e-6) n.copy(Math.abs(axis.y) < 0.9 ? AX.y : AX.x);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(n.normalize(), p0);
  }
  function pickHandle(e) {
    if (!G.root || !G.root.visible) return null;
    // poignées du mode en cours, même si l'image qui les montre n'est pas encore dessinée (mode changé au clavier)
    const T = target();
    if (!T) return null;
    const v = V();
    v.int.setRay(e);
    G.root.updateMatrixWorld(true);
    const picks = [];
    for (const hd of Object.values(G.handles)) if (allowed(hd.id, T.caps)) picks.push(...hd.picks);
    const hits = v.int.ray.intersectObjects(picks, false);
    return hits.length ? hits[0].object.userData.h : null;
  }
  /* Appui dans la vue 3D : true si une poignée est prise (le geste est alors celui du gizmo). */
  G.down = (e) => {
    if (e.button !== 0 || e.altKey || G.drag || !S.map) return false;
    const id = pickHandle(e);
    if (!id) return false;
    const T = target();
    if (!T || !allowed(id, T.caps)) return false;
    const H = HANDLES[id], p0 = G.root.position.clone();
    let plane, axis = null;
    if (H.kind === 'axis' || H.kind === 'scale') { axis = AX[H.a]; plane = axisPlane(axis, p0); }
    else if (H.kind === 'plane') plane = new THREE.Plane().setFromNormalAndCoplanarPoint(AX[H.n], p0);
    else if (H.kind === 'ring') plane = new THREE.Plane().setFromNormalAndCoplanarPoint(AX.y, p0);
    else plane = new THREE.Plane().setFromNormalAndCoplanarPoint(tmp.copy(V().cam.position).sub(p0).normalize().clone(), p0);
    const q0 = rayPlane(e, plane);
    if (!q0) return false;
    const ops = makeOps(T.sel);
    if (!ops) return false;
    // tourner par quart de tour (atouts, boîte, bâtiments…) : appliqué au relâcher, par les commandes habituelles
    const discrete = H.kind === 'ring' && T.caps.rot !== 'free';
    if (H.kind === 'ring' && !discrete && !ops.rotate) return false;
    if ((H.kind === 'scale' || H.kind === 'uscale') && !ops.scale) return false;
    G.drag = { id, H, plane, axis, q0, p0, T, ops, size: G.root.scale.x, applied: new THREE.Vector3(), angle: 0, f: [1, 1, 1], discrete, moved: false, r0: q0.clone().sub(p0) };
    if (!discrete) ops.begin(G.mode);
    setHover(id);
    return true;
  };
  G.move = (e) => {
    const d = G.drag;
    if (!d) return;
    const q = rayPlane(e, d.plane);
    if (!q) return;
    const ev = { alt: e.altKey, shift: e.shiftKey };
    const w = q.clone().sub(d.q0);
    if (!d.moved && w.length() < d.size * 0.01) return;
    d.moved = true;
    try {
      if (d.H.kind === 'axis' || d.H.kind === 'plane') {
        let delta;
        if (d.H.kind === 'axis') delta = d.axis.clone().multiplyScalar(w.dot(d.axis));
        else { const n = AX[d.H.n]; delta = w.clone().sub(n.clone().multiplyScalar(w.dot(n))); }
        d.applied.copy(d.ops.move(delta, ev) || delta);
        tip(fmtMove(d.applied, d.ops.cell));
      } else if (d.H.kind === 'ring') {
        const a0 = d.r0, a1 = q.clone().sub(d.p0);
        let a = Math.atan2(a0.z * a1.x - a0.x * a1.z, a0.x * a1.x + a0.z * a1.z);
        // tours complets : on suit l'angle en continu
        const prev = d.rawAngle || 0;
        while (a - prev > Math.PI) a -= Math.PI * 2;
        while (a - prev < -Math.PI) a += Math.PI * 2;
        d.rawAngle = a;
        if (d.discrete) { const k = Math.round(a / (d.T.caps.rot === 'flip' ? Math.PI : Math.PI / 2)); d.angle = k * (d.T.caps.rot === 'flip' ? Math.PI : Math.PI / 2); tip(`${d.angle >= 0 ? '+' : '−'}${Math.round(Math.abs(deg(d.angle)))}°${k ? ' (au relâcher)' : ''}`); }
        else { d.angle = d.ops.rotate(a, ev); tip(`${d.angle >= 0 ? '+' : '−'}${fmtNum(Math.abs(deg(d.angle)), 1)}°`); }
      } else {
        let f;
        if (d.H.kind === 'scale') { const t = w.dot(d.axis); const k = clamp(1 + t / Math.max(d.size, 1e-3), 0.05, 40); f = [1, 1, 1]; f['xyz'.indexOf(d.H.a)] = k; }
        else {
          // cube du centre : vers la droite ou vers le haut de l'écran, plus grand
          const cam = V().cam, right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
          const k = clamp(1 + (w.dot(right) + w.dot(up)) / Math.max(d.size, 1e-3), 0.05, 40);
          f = [k, k, k];
        }
        d.f = d.ops.scale(f, ev) || f;
        tip(d.H.kind === 'scale' ? `×${fmtNum(d.f['xyz'.indexOf(d.H.a)], 2)} (${d.H.a.toUpperCase()})` : `×${fmtNum(d.f[0], 2)}`);
      }
    } catch (err) { console.error('[gizmo]', err); }
  };
  G.up = () => {
    const d = G.drag;
    G.drag = null;
    hideTip();
    if (!d) return;
    try {
      if (d.discrete) {
        const unit = d.T.caps.rot === 'flip' ? Math.PI : Math.PI / 2;
        let k = Math.round(d.angle / unit);
        if (d.T.caps.rot === 'flip') k = Math.abs(k) % 2;
        const dir = d.angle >= 0 ? 1 : -1;
        for (let i = 0; i < Math.abs(k); i++) MT.tools.rotate(dir, false);
      } else if (!d.moved) { MT.cancelGesture(); }
      else d.ops.end();
    } catch (err) { console.error('[gizmo]', err); MT.commit(); }
  };
  G.cancel = () => {
    const d = G.drag;
    G.drag = null;
    hideTip();
    if (d && !d.discrete) { MT.preview.owWhy = null; MT.cancelGesture(); }
  };
  /* Survol (une fois par image, depuis la vue 3D) : la poignée sous le curseur s'allume. */
  G.hoverAt = (e) => { if (G.drag) return; setHover(e ? pickHandle(e) : null); };
  /* poignée sous un point de l'écran (essais) */
  G.handleAt = (clientX, clientY) => pickHandle({ clientX, clientY });
  G.over = () => !!G.hover && !G.drag;

  /* ---------------------------------------------------------- étiquette -- */
  const fmtNum = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('fr-BE', { minimumFractionDigits: 0, maximumFractionDigits: d });
  const sgn = (v, d = 2) => `${v >= 0 ? '+' : '−'}${fmtNum(Math.abs(v), d)}`;
  function fmtMove(a, cell) {
    const parts = [];
    if (Math.abs(a.x) > 1e-4) parts.push(`x ${sgn(a.x)}`);
    if (Math.abs(a.y) > 1e-4) parts.push(`y ${sgn(a.y)}`);
    if (Math.abs(a.z) > 1e-4) parts.push(`z ${sgn(a.z)}`);
    return parts.length ? `${parts.join(' · ')} ${cell ? 'case(s)' : 'm'}` : '0';
  }
  let tipEl = null;
  function tip(text) {
    const v = V();
    if (!tipEl) { tipEl = h('div', { class: 'mt-gizmo-tip', id: 'mt-gizmo-tip', role: 'status' }); document.body.append(tipEl); }
    tipEl.textContent = text;
    tipEl.hidden = false;
    const r = v.canvas.getBoundingClientRect(), p = G.root.position.clone().project(v.cam);
    tipEl.style.left = `${Math.round(r.left + ((p.x + 1) / 2) * r.width + 18)}px`;
    tipEl.style.top = `${Math.round(r.top + ((1 - p.y) / 2) * r.height - 34)}px`;
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }

  /* ------------------------------------------------------- chaque image -- */
  G.frame = () => {
    const v = V();
    if (!v || !v.cam || !ZS.scene) return;
    if (!G.root) build();
    const T = G.drag ? G.drag.T : target();
    const on = !!T && G.show && v.active && v.visible && ZS.G.state === 'editor';
    G.root.visible = on;
    if (!on) { if (G.hover) setHover(null); if (!G.drag) hideTip(); return; }
    const p = G.drag ? G.drag.p0.clone().add(G.drag.applied) : T.pivot;
    G.root.position.copy(p);
    const cam = v.cam, dist = Math.max(0.05, cam.position.distanceTo(p));
    const hpx = Math.max(1, v.canvas.clientHeight || v.canvas.height || 600);
    const wpp = (2 * dist * Math.tan(rad(cam.fov) / 2)) / hpx;
    G.root.scale.setScalar(G.px * wpp);
    for (const hd of Object.values(G.handles)) hd.group.visible = allowed(hd.id, T.caps);
    if (G.hover && !G.handles[G.hover].group.visible) setHover(null);
  };
  G.setMode = (mode) => {
    if (!['move', 'rotate', 'scale'].includes(mode)) return;
    if (G.drag) G.cancel();
    G.mode = mode;
    savePref();
    refreshButtons();
    G.frame();   // poignées du nouveau mode tout de suite (sans attendre l'image suivante)
    MT.toast(`Flèches : ${G.MODES.find((x) => x[0] === mode)[1].toLowerCase()} (X : suivant)`);
  };
  G.cycle = () => { const i = G.MODES.findIndex((x) => x[0] === G.mode); G.setMode(G.MODES[(i + 1) % G.MODES.length][0]); };
  G.setShow = (on) => { G.show = !!on; if (!on && G.drag) G.cancel(); savePref(); refreshButtons(); };
  function refreshButtons() {
    for (const b of document.querySelectorAll('#mt-gz [data-gz]')) { const on = b.dataset.gz === G.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    const t = document.getElementById('mt-gz-show');
    if (t) { t.classList.toggle('on', G.show); t.setAttribute('aria-pressed', G.show ? 'true' : 'false'); }
    document.body.classList.toggle('mt-gz-off', !G.show);
  }
  G.refreshButtons = refreshButtons;
  MT.on('map', () => { if (G.drag) G.cancel(); lastKey = ''; lastPivot = null; });
  MT.on('selection', () => { if (G.drag && !(S.sel && G.drag.T.sel && S.sel.kind === G.drag.T.sel.kind)) G.cancel(); });
})();
