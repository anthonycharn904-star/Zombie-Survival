'use strict';
/* =========================================================================
   Mod Tools — outils (sélection, construction, textures, objets, éléments)
   Les deux vues (plan et 3D) envoient aux outils des « points » :
     { x, z }        case visée
     { wx, wy, wz }  position exacte dans le monde
     face            côté d'un mur visé ([nx, nz], vers la case libre) ou null
     prop, light, mt objet touché en 3D (indice dans la carte) ou null
     view            'plan' | '3d'
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS;
  const { clamp, round, DIRS, rad, wrapRad } = MT.util;
  const S = MT.state;
  const T = (MT.tools = {});

  T.list = [
    { id: 'select', name: 'Sélection', key: 'KeyV', label: 'V', hint: 'Clic : sélectionner · glisser : déplacer · Maj+clic : ajouter · Suppr : supprimer' },
    { id: 'build', name: 'Construire', key: 'KeyB', label: 'B', hint: 'Clic : poser la case · clic droit : effacer · Alt+clic : pipette' },
    { id: 'paint', name: 'Textures', key: 'KeyT', label: 'T', hint: 'Clic : peindre · clic droit : texture par défaut · Alt+clic : pipette' },
    { id: 'props', name: 'Objets', key: 'KeyO', label: 'O', hint: 'Clic : poser · R : tourner · Alt+clic : pipette · Échap : sélection' },
    { id: 'elements', name: 'Éléments de jeu', key: 'KeyG', label: 'G', hint: 'Clic : poser ou sélectionner · clic droit : retirer' },
  ];
  T.drag = null;
  MT.preview = { cells: null, tone: 'paint', ghost: null, face: null, rect: null };

  MT.setTool = (id) => {
    if (!T.list.some((t) => t.id === id)) return;
    T.cancel();
    S.tool = id;
    MT.preview.ghost = null;
    MT.emit('tool', id);
  };

  /* --------------------------------------------------------- formes -- */
  function brushCells(x, z, n) {
    const r = Math.floor((n - 1) / 2), out = [];
    for (let dz = -r; dz < n - r; dz++) for (let dx = -r; dx < n - r; dx++) out.push([x + dx, z + dz]);
    return out;
  }
  function lineCells(x0, z0, x1, z1) {
    const out = [], dx = Math.abs(x1 - x0), dz = -Math.abs(z1 - z0), sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx + dz, x = x0, z = z0;
    for (let guard = 0; guard < 4000; guard++) {
      out.push([x, z]);
      if (x === x1 && z === z1) break;
      const e2 = 2 * err;
      if (e2 >= dz) { err += dz; x += sx; }
      if (e2 <= dx) { err += dx; z += sz; }
    }
    return out;
  }
  function rectCells(a, b, hollow = false) {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]), out = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (!hollow || x === x0 || x === x1 || z === z0 || z === z1) out.push([x, z]);
    return out;
  }
  function constrain(a, b) {
    // Maj : ligne droite (horizontale, verticale ou diagonale)
    const dx = b[0] - a[0], dz = b[1] - a[1], ax = Math.abs(dx), az = Math.abs(dz);
    if (ax > az * 2) return [b[0], a[1]];
    if (az > ax * 2) return [a[0], b[1]];
    const d = Math.max(ax, az);
    return [a[0] + Math.sign(dx) * d, a[1] + Math.sign(dz) * d];
  }
  T.shapes = { brushCells, lineCells, rectCells };

  const snapV = (v, step) => (step > 0 ? Math.round(v / step) * step : v);
  const prefOf = (p) => (p.face ? p.face : [p.wx - p.x - 0.5, p.wz - p.z - 0.5]);
  const wallLike = (ch) => ch === '#' || ch === 'W' || ch === 'D' || ch === 'P';

  /* ----------------------------------------------- détection (clic) -- */
  /* Ce qui se trouve sous le point : objet, lumière, élément de jeu. */
  T.hitTest = (p) => {
    const m = S.map;
    if (!m || !p) return null;
    if (p.view === '3d') {
      if (typeof p.prop === 'number' && m.props[p.prop]) return { kind: 'prop', i: p.prop };
      if (typeof p.light === 'number' && m.lights[p.light]) return { kind: 'light', i: p.light };
      if (p.mt) return { ...p.mt };
    } else {
      const zoom = MT.plan ? MT.plan.cam.zoom : 24;
      const rad0 = Math.max(0.28, 9 / zoom);
      for (let i = m.lights.length - 1; i >= 0; i--) {
        const l = m.lights[i];
        if (Math.hypot(l.pos[0] - p.wx, l.pos[2] - p.wz) < rad0) return { kind: 'light', i };
      }
      if (Math.hypot(m.spawn.pos[0] - p.wx, m.spawn.pos[1] - p.wz) < rad0 * 1.2) return { kind: 'spawn' };
      let best = -1, bestArea = Infinity;
      for (let i = m.props.length - 1; i >= 0; i--) {
        const pr = m.props[i];
        if (!MT.propContains(pr, p.wx, p.wz, 2 / zoom)) continue;
        const b = MT.modelBox(pr.m), area = (b.max.x - b.min.x) * (b.max.z - b.min.z) * (pr.s || 1) ** 2;
        if (area < bestArea) { best = i; bestArea = area; }
      }
      if (best >= 0) return { kind: 'prop', i: best };
    }
    const els = MT.elementsAt(p.x, p.z).filter((e) => e.kind !== 'light' || p.view !== '3d');
    const order = ['perk', 'box', 'amp', 'wallbuy', 'power', 'sign', 'riser', 'spawn', 'light', 'door'];
    els.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    return els[0] || null;
  };

  /* ----------------------------------------------------- gestes --- */
  T.cancel = () => {
    if (T.drag) { MT.cancelGesture(); T.drag = null; }
    MT.preview.cells = null; MT.preview.rect = null;
    MT.emit('preview');
  };
  T.down = (p, ev) => {
    if (!S.map || !p) return false;
    const tool = TOOLS[S.tool];
    return tool && tool.down ? tool.down(p, ev) !== false : false;
  };
  T.move = (p, ev) => {
    if (!S.map) return;
    const tool = TOOLS[S.tool];
    if (T.drag && tool && tool.drag) tool.drag(p, ev);
    else if (tool && tool.hover) tool.hover(p, ev);
    MT.emit('preview');
  };
  T.up = (p, ev) => {
    if (!S.map) return;
    const tool = TOOLS[S.tool];
    if (T.drag && tool && tool.up) tool.up(p, ev);
    T.drag = null;
    MT.commit();
    MT.emit('preview');
  };
  /* Le geste en cours a-t-il besoin d'un plan horizontal en 3D (déplacement) ? */
  T.dragPlaneY = () => (T.drag && T.drag.planeY !== undefined ? T.drag.planeY : null);

  /* ------------------------------------------------ déplacements ---- */
  function startMove(sel, p, ev) {
    const m = S.map;
    if (sel.kind === 'prop') {
      MT.begin('Déplacer');
      const y0 = m.props[sel.list[0]].y || 0;
      T.drag = { mode: 'props', start: [p.wx, p.wz], orig: sel.list.map((i) => [m.props[i].x, m.props[i].z]), list: sel.list.slice(), planeY: y0, moved: false };
    } else if (sel.kind === 'light') {
      MT.begin('Déplacer la lumière');
      const l = m.lights[sel.i];
      T.drag = { mode: 'light', i: sel.i, start: [p.wx, p.wz], orig: [l.pos[0], l.pos[2]], planeY: 0, moved: false };
    } else if (sel.kind === 'spawn') {
      MT.begin('Déplacer le départ');
      T.drag = { mode: 'spawn', start: [p.wx, p.wz], orig: m.spawn.pos.slice(), planeY: 0, moved: false };
    } else if (['perk', 'box', 'amp', 'wallbuy', 'power', 'sign', 'riser'].includes(sel.kind)) {
      MT.begin('Déplacer');
      T.drag = { mode: 'element', sel: { ...sel }, cell: [p.x, p.z], planeY: 0, moved: false };
    } else return false;
    return true;
  }
  function dragMove(p, ev) {
    const d = T.drag, m = S.map;
    if (!d || !p) return;
    const snap = ev.alt ? 0 : S.opts.props.snap;
    if (d.mode === 'props') {
      let dx = p.wx - d.start[0], dz = p.wz - d.start[1];
      if (!d.moved && Math.hypot(dx, dz) < 0.06) return;
      d.moved = true;
      // le premier objet se cale sur la grille, les autres suivent
      if (snap) {
        const nx = snapV(d.orig[0][0] + dx, snap), nz = snapV(d.orig[0][1] + dz, snap);
        dx = nx - d.orig[0][0]; dz = nz - d.orig[0][1];
      }
      d.list.forEach((i, k) => { const pr = m.props[i]; if (pr) { pr.x = round(d.orig[k][0] + dx); pr.z = round(d.orig[k][1] + dz); } });
      MT.touch('prop-move', { list: d.list });
    } else if (d.mode === 'light') {
      const step = ev.alt ? 0 : 0.25;
      const l = m.lights[d.i];
      const nx = round(snapV(d.orig[0] + p.wx - d.start[0], step)), nz = round(snapV(d.orig[1] + p.wz - d.start[1], step));
      if (nx === l.pos[0] && nz === l.pos[2]) return;
      d.moved = true;
      l.pos[0] = nx; l.pos[2] = nz;
      MT.touch('light-live', { i: d.i, move: true });
    } else if (d.mode === 'spawn') {
      const step = ev.alt ? 0 : 0.25;
      const nx = round(snapV(d.orig[0] + p.wx - d.start[0], step)), nz = round(snapV(d.orig[1] + p.wz - d.start[1], step));
      if (nx === m.spawn.pos[0] && nz === m.spawn.pos[1]) return;
      d.moved = true;
      m.spawn.pos = [clamp(nx, 0, m.w), clamp(nz, 0, m.h)];
      MT.touch('elements');
    } else if (d.mode === 'element') {
      if (p.x === d.cell[0] && p.z === d.cell[1]) return;
      if (moveElement(d.sel, p)) { d.cell = [p.x, p.z]; d.moved = true; MT.touch('elements'); }
    }
  }
  function occupied(x, z, except) {
    return MT.elementsAt(x, z).some((e) => ['perk', 'box', 'amp'].includes(e.kind) && !(except && e.kind === except.kind && e.i === except.i));
  }
  function moveElement(sel, p) {
    const m = S.map, t = MT.tileAt(p.x, p.z);
    switch (sel.kind) {
      case 'perk':
        if (t !== '.' || occupied(p.x, p.z, sel)) return false;
        m.perks[sel.i].cell = [p.x, p.z];
        return true;
      case 'riser':
        if (t !== '.' || m.risers.some((r, k) => k !== sel.i && r[0] === p.x && r[1] === p.z)) return false;
        m.risers[sel.i] = [p.x, p.z];
        return true;
      case 'box': case 'amp': {
        const cur = sel.kind === 'box' ? m.boxes[sel.i] : m.amp;
        const vertical = cur.cells[0][0] === cur.cells[1][0];
        const pr = MT.pairAt(p.x, p.z, vertical);
        if (!pr.cells.every(([x, z]) => MT.tileAt(x, z) === '.' && !occupied(x, z, sel))) return false;
        cur.cells = pr.cells; cur.face = pr.face;
        return true;
      }
      case 'wallbuy': case 'power': case 'sign': {
        if (t !== '#') return false;
        const old = sel.kind === 'wallbuy' ? m.wallbuys[sel.i] : sel.kind === 'power' ? m.power : m.signs[sel.i];
        const face = p.face || MT.wallFace(p.x, p.z, prefOf(p)) || null;
        if (!face || !MT.isFloor(MT.tileAt(p.x + face[0], p.z + face[1]))) return false;
        if (sel.kind === 'sign') { old.pos = MT.signPos(p.x, p.z, face, old.pos[1]); old.n = face; } else { old.cell = [p.x, p.z]; old.n = face; }
        return true;
      }
      default: return false;
    }
  }
  /* Rotation : objets sélectionnés, objet à poser, machines. */
  T.rotate = (dir = 1, big = false) => {
    const m = S.map;
    if (!m) return;
    const s = S.sel;
    if (S.tool === 'props' && !(s && s.kind === 'prop' && T.drag)) {
      const step = big ? 90 : S.opts.props.rotStep;
      S.opts.props.rot = ((S.opts.props.rot + dir * step) % 360 + 360) % 360;
      MT.emit('tool-opts');
      MT.emit('preview');
      return;
    }
    if (!s) {
      if (S.tool === 'elements' && (S.opts.elements.kind === 'box' || S.opts.elements.kind === 'amp')) {
        S.opts.elements.boxVertical = !S.opts.elements.boxVertical;
        MT.emit('tool-opts'); MT.emit('preview');
      }
      return;
    }
    if (s.kind === 'prop') {
      const step = rad(big ? 90 : S.opts.props.rotStep) * dir;
      MT.edit('Tourner', () => {
        const list = s.list.map((i) => m.props[i]);
        const cx = list.reduce((a, p) => a + p.x, 0) / list.length, cz = list.reduce((a, p) => a + p.z, 0) / list.length;
        const c = Math.cos(step), sn = Math.sin(step);
        for (const p of list) {
          if (list.length > 1) {
            const dx = p.x - cx, dz = p.z - cz;
            p.x = round(cx + c * dx + sn * dz); p.z = round(cz - sn * dx + c * dz);
          }
          p.r = round(wrapRad((p.r || 0) + step), 4);
          if (Math.abs(p.r) < 1e-4) delete p.r;
        }
      }, 'prop-move', { list: s.list });
    } else if (s.kind === 'perk' || s.kind === 'box' || s.kind === 'amp') {
      MT.edit('Tourner', () => {
        const e = s.kind === 'perk' ? m.perks[s.i] : s.kind === 'box' ? m.boxes[s.i] : m.amp;
        if (s.kind === 'perk') {
          const order = [[0, 1], [-1, 0], [0, -1], [1, 0]];
          const cur = Math.max(0, order.findIndex((d) => d[0] === e.face[0] && d[1] === e.face[1]));
          e.face = order[(cur + (dir > 0 ? 1 : 3)) % 4].slice();
        } else {
          e.face = [-e.face[0], -e.face[1]];
        }
      }, 'elements');
    } else if (s.kind === 'spawn') {
      MT.edit('Tourner le départ', () => { m.spawn.yaw = round(wrapRad(m.spawn.yaw + rad(big ? 90 : 45) * dir), 4); }, 'elements');
    }
  };
  /* Flèches : petit déplacement de la sélection. */
  T.nudge = (dx, dz, fine) => {
    const s = S.sel, m = S.map;
    if (!s || !m) return;
    const step = fine ? 0.05 : S.opts.props.snap || 0.25;
    if (s.kind === 'prop') {
      MT.edit('Déplacer', () => { for (const i of s.list) { m.props[i].x = round(m.props[i].x + dx * step); m.props[i].z = round(m.props[i].z + dz * step); } }, 'prop-move', { list: s.list });
    } else if (s.kind === 'light') {
      MT.edit('Déplacer la lumière', () => { const l = m.lights[s.i]; l.pos[0] = round(l.pos[0] + dx * step); l.pos[2] = round(l.pos[2] + dz * step); }, 'lights');
    } else if (s.kind === 'spawn') {
      MT.edit('Déplacer le départ', () => { m.spawn.pos = [round(m.spawn.pos[0] + dx * step), round(m.spawn.pos[1] + dz * step)]; }, 'elements');
    }
  };
  /* Page haut / bas : hauteur des objets et des lumières. */
  T.raise = (dy) => {
    const s = S.sel, m = S.map;
    if (!s || !m) return;
    if (s.kind === 'prop') {
      MT.edit('Hauteur', () => { for (const i of s.list) { const p = m.props[i]; p.y = round(clamp((p.y || 0) + dy, -5, 30)); if (!p.y) delete p.y; } }, 'prop-move', { list: s.list });
    } else if (s.kind === 'light') {
      MT.edit('Hauteur de la lumière', () => { const l = m.lights[s.i]; l.pos[1] = round(clamp(l.pos[1] + dy, 0.2, 12)); }, 'lights');
    } else if (s.kind === 'sign') {
      MT.edit('Hauteur du panneau', () => { const g = m.signs[s.i]; g.pos[1] = round(clamp(g.pos[1] + dy, 0.3, 8)); }, 'elements');
    }
  };

  /* ===================================================== Sélection === */
  const select = {
    down(p, ev) {
      if (ev.button !== 0) return false;
      const hit = ev.alt ? null : T.hitTest(p);
      if (hit && hit.kind === 'prop') {
        const cur = MT.selectedProps();
        if (ev.shift) {
          const list = cur.includes(hit.i) ? cur.filter((i) => i !== hit.i) : [...cur, hit.i];
          MT.select(list.length ? { kind: 'prop', list } : null);
          return true;
        }
        if (!cur.includes(hit.i)) MT.select({ kind: 'prop', list: [hit.i] });
        startMove(S.sel, p, ev);
        return true;
      }
      if (hit) {
        MT.select(hit);
        startMove(hit, p, ev);
        return true;
      }
      if (p.view === 'plan') {
        T.drag = { mode: 'box', a: [p.wx, p.wz], b: [p.wx, p.wz], shift: ev.shift };
        return true;
      }
      MT.select(MT.inb(p.x, p.z) ? { kind: 'cell', x: p.x, z: p.z } : null);
      return true;
    },
    drag(p, ev) {
      const d = T.drag;
      if (!d || !p) return;
      if (d.mode === 'box') {
        d.b = [p.wx, p.wz];
        MT.preview.rect = { a: d.a, b: d.b };
        return;
      }
      dragMove(p, ev);
    },
    up(p) {
      const d = T.drag;
      if (!d) return;
      if (d.mode === 'box') {
        MT.preview.rect = null;
        const x0 = Math.min(d.a[0], d.b[0]), x1 = Math.max(d.a[0], d.b[0]), z0 = Math.min(d.a[1], d.b[1]), z1 = Math.max(d.a[1], d.b[1]);
        if (x1 - x0 < 0.15 && z1 - z0 < 0.15) {
          if (!d.shift) MT.select(p && MT.inb(p.x, p.z) ? { kind: 'cell', x: p.x, z: p.z } : null);
          return;
        }
        const list = [];
        S.map.props.forEach((pr, i) => { if (pr.x >= x0 && pr.x <= x1 && pr.z >= z0 && pr.z <= z1) list.push(i); });
        const merged = d.shift ? [...new Set([...MT.selectedProps(), ...list])] : list;
        MT.select(merged.length ? { kind: 'prop', list: merged } : null);
        if (merged.length) MT.toast(`${merged.length} objet${merged.length > 1 ? 's' : ''} sélectionné${merged.length > 1 ? 's' : ''}`);
        return;
      }
      if (d.mode === 'light' && d.moved) MT.touch('lights');
    },
    hover() { MT.preview.cells = null; },
  };

  /* ===================================================== Construire === */
  function buildPreview(d) {
    const b = d.b;
    if (d.mode === 'line') return lineCells(d.a[0], d.a[1], b[0], b[1]);
    if (d.mode === 'rect') return rectCells(d.a, b);
    if (d.mode === 'room') return rectCells(d.a, b);
    return null;
  }
  function applyRoom(a, b, erase) {
    if (erase) return MT.setTiles(rectCells(a, b), ' ');
    const border = rectCells(a, b, true).filter(([x, z]) => !['W', 'D'].includes(MT.tileAt(x, z)));
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    const inner = [];
    for (let z = z0 + 1; z < z1; z++) for (let x = x0 + 1; x < x1; x++) inner.push([x, z]);
    return MT.setTiles(border, '#') + MT.setTiles(inner, '.');
  }
  const build = {
    down(p, ev) {
      if (ev.button !== 0 && ev.button !== 2) return false;
      const o = S.opts.build;
      if (ev.alt && ev.button === 0) { o.tile = MT.tileAt(p.x, p.z); MT.emit('tool-opts'); MT.toast(`Case choisie : ${tileName(o.tile)}`); return true; }
      const ch = ev.button === 2 ? ' ' : o.tile;
      if (o.shape === 'fill') {
        const target = MT.tileAt(p.x, p.z);
        if (target === ch || !MT.inb(p.x, p.z)) return true;
        MT.edit('Remplir', () => MT.setTiles(MT.floodCells(p.x, p.z, (x, z) => MT.tileAt(x, z) === target), ch) || false, 'grid');
        return true;
      }
      MT.begin(ev.button === 2 ? 'Effacer' : 'Construire');
      if (o.shape === 'brush') {
        T.drag = { mode: 'brush', last: [p.x, p.z], ch };
        if (MT.setTiles(brushCells(p.x, p.z, o.size), ch)) MT.touch('grid', { live: true });
      } else {
        T.drag = { mode: o.shape, a: [p.x, p.z], b: [p.x, p.z], ch, erase: ev.button === 2 };
        MT.preview.cells = buildPreview(T.drag);
        MT.preview.tone = ev.button === 2 ? 'erase' : 'paint';
      }
      return true;
    },
    drag(p, ev) {
      const d = T.drag;
      if (!d || !p) return;
      if (d.mode === 'brush') {
        if (p.x === d.last[0] && p.z === d.last[1]) return;
        let n = 0;
        for (const [x, z] of lineCells(d.last[0], d.last[1], p.x, p.z)) n += MT.setTiles(brushCells(x, z, S.opts.build.size), d.ch);
        d.last = [p.x, p.z];
        if (n) MT.touch('grid', { live: true });
      } else {
        d.b = ev.shift && d.mode === 'line' ? constrain(d.a, [p.x, p.z]) : [p.x, p.z];
        MT.preview.cells = buildPreview(d);
      }
    },
    up() {
      const d = T.drag;
      MT.preview.cells = null;
      if (!d) return;
      if (d.mode === 'brush') { MT.touch('grid'); return; }
      let n = 0;
      if (d.mode === 'room') n = applyRoom(d.a, d.b, d.erase);
      else n = MT.setTiles(buildPreview(d), d.ch);
      if (n) MT.touch('grid');
    },
    hover(p) {
      if (!p) { MT.preview.cells = null; return; }
      const o = S.opts.build;
      MT.preview.cells = o.shape === 'brush' ? brushCells(p.x, p.z, o.size) : [[p.x, p.z]];
      MT.preview.tone = 'paint';
    },
  };
  function tileName(ch) { const t = ZS.TILES.find((k) => k.ch === ch); return t ? t.name : ch; }

  /* ======================================================= Textures === */
  /* Case dont on peint le calque : pour les murs, la case libre devant le mur visé. */
  function paintTarget(p) {
    const L = S.opts.paint.layer, t = MT.tileAt(p.x, p.z);
    if (L === 'wall' && wallLike(t)) {
      const f = p.face || MT.wallFace(p.x, p.z, prefOf(p));
      if (!f) return null;
      return [p.x + f[0], p.z + f[1]];
    }
    if (L === 'ceil' && p.view === '3d' && p.ny !== undefined && p.ny > 0.5 && p.wy > 0.1) return null;
    return MT.inb(p.x, p.z) ? [p.x, p.z] : null;
  }
  function paintCells(p) {
    const o = S.opts.paint, c = paintTarget(p);
    if (!c) return [];
    if (o.shape === 'room') {
      const zi = MT.zoneIndexAt(c[0], c[1]);
      if (zi < 0) return [c];
      return MT.floodCells(c[0], c[1], (x, z) => MT.zoneIndexAt(x, z) === zi);
    }
    if (o.shape === 'brush') return brushCells(c[0], c[1], o.size);
    return [c];
  }
  const paint = {
    down(p, ev) {
      if (ev.button !== 0 && ev.button !== 2) return false;
      const o = S.opts.paint;
      if (ev.alt && ev.button === 0) {
        const c = paintTarget(p);
        if (c) { o.tex = MT.cellTexture(c[0], c[1], o.layer) || o.tex; MT.emit('tool-opts'); MT.toast(`Texture choisie : ${texName(o.tex)}`); }
        return true;
      }
      const id = ev.button === 2 ? null : o.tex;
      if (o.shape === 'rect') {
        const c = paintTarget(p);
        if (!c) return true;
        MT.begin('Peindre');
        T.drag = { mode: 'rect', a: c, b: c, id };
        MT.preview.cells = [c];
        MT.preview.tone = id ? 'paint' : 'erase';
        return true;
      }
      MT.begin(id ? 'Peindre' : 'Texture par défaut');
      T.drag = { mode: 'paint', id, last: paintTarget(p) };
      try {
        if (MT.paintCells(o.layer, paintCells(p), id)) MT.touch('layers', { live: true });
      } catch (e) { MT.toast(e.message, 'error'); }
      if (id) MT.pushRecent('tex', id);
      return true;
    },
    drag(p) {
      const d = T.drag, o = S.opts.paint;
      if (!d || !p) return;
      if (d.mode === 'rect') {
        const c = paintTarget(p);
        if (c) { d.b = c; MT.preview.cells = rectCells(d.a, d.b); }
        return;
      }
      if (o.shape === 'room') return;
      const c = paintTarget(p);
      if (!c) return;
      let cells = [c];
      if (d.last && o.shape === 'brush') { cells = []; for (const [x, z] of lineCells(d.last[0], d.last[1], c[0], c[1])) cells.push(...brushCells(x, z, o.size)); }
      d.last = c;
      try { if (MT.paintCells(o.layer, cells, d.id)) MT.touch('layers', { live: true }); } catch (e) { MT.toast(e.message, 'error'); }
    },
    up() {
      const d = T.drag;
      MT.preview.cells = null;
      if (!d) return;
      if (d.mode === 'rect') {
        try { if (MT.paintCells(S.opts.paint.layer, rectCells(d.a, d.b), d.id)) MT.touch('layers'); } catch (e) { MT.toast(e.message, 'error'); }
        return;
      }
      MT.touch('layers');
    },
    hover(p) {
      if (!p) { MT.preview.cells = null; return; }
      MT.preview.cells = S.opts.paint.shape === 'rect' ? (paintTarget(p) ? [paintTarget(p)] : null) : paintCells(p);
      MT.preview.tone = 'paint';
    },
  };
  function texName(id) { if (id === 'none') return 'Ciel ouvert'; const d = ZS.TEXLIB[id]; return d ? d.name : id; }

  /* ========================================================= Objets === */
  /* Position d'un objet à poser sous le point (grille, murs, empilement). */
  function placement(p, ev) {
    const o = S.opts.props, def = ZS.MODELS[o.model];
    if (!def || !p) return null;
    const snap = ev && ev.alt ? 0 : o.snap;
    let x = p.wx, z = p.wz, y = 0, face = null;
    const t = MT.tileAt(p.x, p.z);
    if (def.wall) {
      // objet mural : collé au mur visé (ou au mur le plus proche dans la case)
      if (wallLike(t) || t === ' ') {
        face = p.face || MT.wallFace(p.x, p.z, prefOf(p));
        if (face) {
          if (face[0]) { x = p.x + 0.5 + face[0] * 0.505; z = snapV(p.wz, snap || 0.05); } else { z = p.z + 0.5 + face[1] * 0.505; x = snapV(p.wx, snap || 0.05); }
        }
      } else if (p.view === 'plan') {
        const fx = p.wx - p.x - 0.5, fz = p.wz - p.z - 0.5;
        let best = null, bd = 0.2;
        for (const [dx, dz] of DIRS) {
          if (!wallLike(MT.tileAt(p.x + dx, p.z + dz))) continue;
          const d = 0.5 - (dx * fx + dz * fz);
          if (d < bd) { bd = d; best = [-dx, -dz]; }
        }
        if (best) {
          face = best;
          if (face[0]) { x = p.x + 0.5 - face[0] * 0.495; z = snapV(p.wz, snap || 0.05); } else { z = p.z + 0.5 - face[1] * 0.495; x = snapV(p.wx, snap || 0.05); }
        }
      }
      if (!face) { x = snapV(x, snap); z = snapV(z, snap); }
    } else {
      x = snapV(x, snap); z = snapV(z, snap);
      if (p.view === '3d' && p.ny > 0.5 && p.wy > 0.04 && p.wy < 12) y = p.wy;
    }
    return { x, z, y, face };
  }
  const props = {
    down(p, ev) {
      if (ev.button !== 0) return false;
      const o = S.opts.props;
      if (ev.alt) {
        const hit = T.hitTest(p);
        if (hit && hit.kind === 'prop') { o.model = S.map.props[hit.i].m; MT.emit('tool-opts'); MT.toast(`Objet choisi : ${ZS.MODELS[o.model].name}`); }
        return true;
      }
      const pl = placement(p, ev);
      if (!pl) { MT.toast('Choisissez un objet dans la bibliothèque.', 'warn'); return true; }
      const pr = MT.makeProp(o.model, pl.x, pl.z, pl.y, pl.face);
      MT.edit(`Poser : ${ZS.MODELS[o.model].name}`, (m) => {
        m.props.push(pr);
        S.sel = { kind: 'prop', list: [m.props.length - 1] };
      }, 'props');
      MT.emit('selection');
      MT.pushRecent('model', o.model);
      return true;
    },
    hover(p, ev) {
      const pl = placement(p, ev);
      if (!pl) { MT.preview.ghost = null; return; }
      const o = S.opts.props, def = ZS.MODELS[o.model];
      const r = pl.face && def.wall ? Math.atan2(pl.face[0], pl.face[1]) : rad(o.rot);
      MT.preview.ghost = { m: o.model, x: pl.x, z: pl.z, y: pl.y, r, s: o.scale || 1 };
      MT.preview.cells = null;
    },
  };

  /* ============================================== Éléments de jeu === */
  const KIND_LABEL = {
    spawn: 'Point de départ', light: 'Lumière', door: 'Porte payante', window: 'Fenêtre barricadée', wallbuy: 'Arme murale',
    perk: 'Distributeur d’atout', box: 'Boîte mystère', power: 'Interrupteur du courant', amp: 'Amplificateur', sign: 'Panneau',
    riser: 'Apparition de zombies', zone: 'Pièce (nom, teinte)',
  };
  T.KIND_LABEL = KIND_LABEL;
  function needWall(p) {
    if (MT.tileAt(p.x, p.z) !== '#') { MT.toast('Visez un mur (case Mur) avec du sol devant.', 'warn'); return null; }
    const face = p.face || MT.wallFace(p.x, p.z, prefOf(p));
    if (!face || !MT.isFloor(MT.tileAt(p.x + face[0], p.z + face[1]))) { MT.toast('Il faut du sol devant ce mur.', 'warn'); return null; }
    return face;
  }
  function needFloor(p) {
    if (MT.tileAt(p.x, p.z) !== '.') { MT.toast('Visez une case de sol.', 'warn'); return false; }
    return true;
  }
  const elements = {
    down(p, ev) {
      const k = S.opts.elements.kind, m = S.map, o = S.opts.elements;
      if (ev.button === 2) { removeAt(k, p); return true; }
      if (ev.button !== 0) return false;
      // un élément du même type déjà là : on le sélectionne (et on peut le déplacer)
      const here = T.hitTest(p);
      if (here && here.kind === k) { MT.select(here); startMove(here, p, ev); return true; }
      switch (k) {
        case 'spawn': {
          MT.begin('Déplacer le départ');
          m.spawn.pos = [round(snapV(p.wx, 0.25)), round(snapV(p.wz, 0.25))];
          MT.touch('elements');
          MT.select({ kind: 'spawn' });
          T.drag = { mode: 'spawn-dir', planeY: 0 };
          return true;
        }
        case 'light': {
          const t = MT.tileAt(p.x, p.z);
          const L = MT.lightDefaults();
          let pos;
          if (L.fixture === 'wall' || (wallLike(t) && p.face)) {
            const face = wallLike(t) ? (p.face || MT.wallFace(p.x, p.z, prefOf(p))) : null;
            if (face) { L.fixture = 'wall'; pos = [round(p.x + 0.5 + face[0] * 0.62), 2.3, round(p.z + 0.5 + face[1] * 0.62)]; }
          }
          if (!pos) pos = [p.x + 0.5, round(MT.wallHeight() - 0.4), p.z + 0.5];
          MT.edit('Ajouter une lumière', () => { m.lights.push({ pos, ...L }); S.sel = { kind: 'light', i: m.lights.length - 1 }; }, 'lights');
          MT.emit('selection');
          if (m.lights.length === 17) MT.toast('Plus de 16 lumières : le jeu peut ralentir sur les petites cartes graphiques.', 'warn');
          return true;
        }
        case 'door': case 'window': {
          const t = MT.tileAt(p.x, p.z);
          if (k === 'door' && t === 'D') { const di = m.doors.findIndex((d) => d.cells.some((c) => c[0] === p.x && c[1] === p.z)); MT.select({ kind: 'door', i: di }); return true; }
          if (t !== '#' && t !== (k === 'door' ? 'W' : 'D')) { MT.toast('Visez un mur.', 'warn'); return true; }
          MT.begin(k === 'door' ? 'Ajouter une porte' : 'Ajouter une fenêtre');
          const ch = k === 'door' ? 'D' : 'W';
          MT.setTiles([[p.x, p.z]], ch);
          MT.touch('grid');
          T.drag = { mode: 'wall-line', ch, last: [p.x, p.z] };
          if (k === 'door') { const di = m.doors.findIndex((d) => d.cells.some((c) => c[0] === p.x && c[1] === p.z)); if (di >= 0) S.sel = { kind: 'door', i: di }; MT.emit('selection'); }
          return true;
        }
        case 'wallbuy': {
          const face = needWall(p);
          if (!face) return true;
          MT.edit('Ajouter une arme murale', () => {
            m.wallbuys = m.wallbuys.filter((w) => !(w.cell[0] === p.x && w.cell[1] === p.z));
            m.wallbuys.push({ w: o.weapon, cell: [p.x, p.z], n: face });
            S.sel = { kind: 'wallbuy', i: m.wallbuys.length - 1 };
          }, 'elements');
          MT.emit('selection');
          return true;
        }
        case 'perk': {
          if (!needFloor(p) || occupied(p.x, p.z)) return true;
          MT.edit('Ajouter un distributeur', () => { m.perks.push({ p: o.perk, cell: [p.x, p.z], face: MT.defaultFace(p.x, p.z) }); S.sel = { kind: 'perk', i: m.perks.length - 1 }; }, 'elements');
          MT.emit('selection');
          if (m.perks.filter((q) => q.p === o.perk).length > 1) MT.toast('Ce distributeur existe déjà sur la carte.', 'warn');
          return true;
        }
        case 'box': case 'amp': {
          const pr = MT.pairAt(p.x, p.z, o.boxVertical);
          if (!pr.cells.every(([x, z]) => MT.tileAt(x, z) === '.' && !occupied(x, z))) { MT.toast('Il faut deux cases de sol libres.', 'warn'); return true; }
          if (k === 'box') {
            MT.edit('Ajouter un emplacement de boîte', () => { m.boxes.push(pr); S.sel = { kind: 'box', i: m.boxes.length - 1 }; }, 'elements');
          } else {
            MT.edit('Placer l’Amplificateur', () => { m.amp = pr; S.sel = { kind: 'amp' }; }, 'elements');
          }
          MT.emit('selection');
          return true;
        }
        case 'power': {
          const face = needWall(p);
          if (!face) return true;
          MT.edit('Placer l’interrupteur', () => { m.power = { cell: [p.x, p.z], n: face }; S.sel = { kind: 'power' }; }, 'elements');
          MT.emit('selection');
          return true;
        }
        case 'sign': {
          if (!wallLike(MT.tileAt(p.x, p.z))) { MT.toast('Visez un mur.', 'warn'); return true; }
          const face = p.face || MT.wallFace(p.x, p.z, prefOf(p));
          if (!face) { MT.toast('Il faut du sol devant ce mur.', 'warn'); return true; }
          const text = (o.sign || 'PANNEAU').toUpperCase().slice(0, 28);
          MT.edit('Ajouter un panneau', () => { m.signs.push({ text, pos: MT.signPos(p.x, p.z, face, round(Math.min(3.05, MT.wallHeight() - 0.45))), n: face }); S.sel = { kind: 'sign', i: m.signs.length - 1 }; }, 'elements');
          MT.emit('selection');
          return true;
        }
        case 'riser': {
          if (!needFloor(p)) return true;
          if (m.risers.some((r) => r[0] === p.x && r[1] === p.z)) return true;
          MT.begin('Ajouter des apparitions');
          m.risers.push([p.x, p.z]);
          MT.touch('elements');
          T.drag = { mode: 'riser-line', last: [p.x, p.z] };
          return true;
        }
        case 'zone': {
          if (!MT.fillable(MT.tileAt(p.x, p.z))) { MT.toast('Visez le sol d’une pièce.', 'warn'); return true; }
          const zi = MT.zoneIndexAt(p.x, p.z);
          let di = MT.zoneDefOf(zi);
          if (di < 0) {
            const A = MT.analysis();
            const name = A.zones[zi] ? A.zones[zi].name : `Pièce ${m.zones.length + 1}`;
            MT.edit('Nommer une pièce', () => { m.zones.push({ name, seed: [p.x, p.z], tint: [1, 1, 1] }); }, 'all');
            di = m.zones.length - 1;
          }
          MT.select({ kind: 'zone', i: di });
          return true;
        }
        default: return false;
      }
    },
    drag(p, ev) {
      const d = T.drag, m = S.map;
      if (!d || !p) return;
      if (d.mode === 'spawn-dir') {
        const dx = p.wx - m.spawn.pos[0], dz = p.wz - m.spawn.pos[1];
        if (Math.hypot(dx, dz) < 0.4) return;
        let yaw = Math.atan2(-dx, -dz);
        if (!ev.alt) yaw = Math.round(yaw / (Math.PI / 4)) * (Math.PI / 4);
        m.spawn.yaw = round(wrapRad(yaw), 4);
        MT.touch('elements');
      } else if (d.mode === 'wall-line') {
        if (p.x === d.last[0] && p.z === d.last[1]) return;
        const cells = lineCells(d.last[0], d.last[1], p.x, p.z).filter(([x, z]) => MT.tileAt(x, z) === '#');
        d.last = [p.x, p.z];
        if (cells.length && MT.setTiles(cells, d.ch)) MT.touch('grid', { live: true });
      } else if (d.mode === 'riser-line') {
        if (p.x === d.last[0] && p.z === d.last[1]) return;
        d.last = [p.x, p.z];
        if (MT.tileAt(p.x, p.z) === '.' && !m.risers.some((r) => r[0] === p.x && r[1] === p.z)) { m.risers.push([p.x, p.z]); MT.touch('elements'); }
      } else dragMove(p, ev);
    },
    up() {
      const d = T.drag;
      if (d && d.mode === 'light' && d.moved) MT.touch('lights');
      if (d && d.mode === 'wall-line') MT.touch('grid');
    },
    hover(p) {
      if (!p) { MT.preview.cells = null; return; }
      const k = S.opts.elements.kind;
      if (k === 'box' || k === 'amp') MT.preview.cells = MT.pairAt(p.x, p.z, S.opts.elements.boxVertical).cells;
      else MT.preview.cells = [[p.x, p.z]];
      MT.preview.tone = 'element';
    },
  };
  function removeAt(k, p) {
    const m = S.map;
    const same = (c) => c[0] === p.x && c[1] === p.z;
    const label = `Retirer : ${KIND_LABEL[k] || k}`;
    switch (k) {
      case 'light': {
        let best = -1, bd = 0.9;
        m.lights.forEach((l, i) => { const d = Math.hypot(l.pos[0] - p.wx, l.pos[2] - p.wz); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) MT.edit(label, () => { m.lights.splice(best, 1); }, 'lights');
        break;
      }
      case 'door': case 'window': {
        const t = MT.tileAt(p.x, p.z);
        if ((k === 'door' && t === 'D') || (k === 'window' && t === 'W')) MT.edit(label, () => MT.setTiles([[p.x, p.z]], '#') || false, 'grid');
        break;
      }
      case 'wallbuy': { const i = m.wallbuys.findIndex((w) => same(w.cell)); if (i >= 0) MT.edit(label, () => { m.wallbuys.splice(i, 1); }, 'elements'); break; }
      case 'perk': { const i = m.perks.findIndex((q) => same(q.cell)); if (i >= 0) MT.edit(label, () => { m.perks.splice(i, 1); }, 'elements'); break; }
      case 'box': {
        const i = m.boxes.findIndex((b) => b.cells.some(same));
        if (i >= 0) MT.edit(label, () => { m.boxes.splice(i, 1); m.boxStart = clamp(m.boxStart, 0, Math.max(0, m.boxes.length - 1)); }, 'elements');
        break;
      }
      case 'amp': if (m.amp && m.amp.cells.some(same)) MT.edit(label, () => { m.amp = null; }, 'elements'); break;
      case 'power': if (m.power && same(m.power.cell)) MT.edit(label, () => { m.power = null; }, 'elements'); break;
      case 'sign': { const i = m.signs.findIndex((s) => same(MT.signCell(s))); if (i >= 0) MT.edit(label, () => { m.signs.splice(i, 1); }, 'elements'); break; }
      case 'riser': { const i = m.risers.findIndex(same); if (i >= 0) MT.edit(label, () => { m.risers.splice(i, 1); }, 'elements'); break; }
      case 'zone': {
        const di = MT.zoneDefOf(MT.zoneIndexAt(p.x, p.z));
        if (di >= 0) MT.edit('Retirer le nom de la pièce', () => { m.zones.splice(di, 1); }, 'all');
        break;
      }
      default: break;
    }
    MT.fixSelection();
  }

  const TOOLS = { select, build, paint, props, elements };
  T.impl = TOOLS;
  T.placement = placement;
  T.texName = texName;
  T.tileName = tileName;
})();
