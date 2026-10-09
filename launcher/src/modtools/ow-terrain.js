'use strict';
/* =========================================================================
   Mod Tools — cartes ouvertes, niveau 2 : relief, sol, routes, bâtiments
   Pinceaux de relief (monter, creuser, aplanir, adoucir, effacer) et de sol
   (sable, roche, herbe…), routes et pistes tracées point par point, bâtiments
   du catalogue. Les lieux de Khamsin, ses routes et les pyramides sont
   protégés : le relief n'y bouge pas. Un coup de pinceau s'écrit dans la
   carte (blocs de 128 m) quand on relâche la souris ; « annuler » le retire.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS, THREE = window.THREE;
  const { clamp, round, deep } = MT.util;
  const S = MT.state;
  const O = MT.ow;
  const TR = (O.terrain = {});

  S.opts.ow.brush = { op: 'raise', size: 24, strength: 0.5 };
  S.opts.ow.paint = { bio: 'OASIS', size: 14 };
  S.opts.ow.road = { kind: 'track', w: 6 };
  S.opts.ow.bld = { type: 'maison', rot: 0 };
  TR.OPS = [['raise', 'Monter'], ['lower', 'Creuser'], ['flatten', 'Aplanir'], ['smooth', 'Adoucir'], ['reset', 'Effacer']];
  TR.PAINT = {
    SAND: ['Sable', '#d9a873'], PAD: ['Sable tassé', '#d8b48a'], TRACK: ['Sol damé', '#c49a66'], ROCK: ['Roche', '#8f7a64'], WADI: ['Graviers d’oued', '#b39674'],
    PLATEAU: ['Calcaire', '#e8d3ad'], OASIS: ['Herbe (oasis)', '#7a8f45'], FIELD: ['Champs', '#5d7d36'], MUD: ['Boue', '#6b5840'],
  };
  TR.tools = [
    { id: 'terrain', name: 'Relief', key: 'KeyT', label: 'T', hint: 'Glisser : pinceau · clic droit (plan) : l’inverse · [ et ] : taille · Échap : annuler le coup · les lieux, routes d’origine et pyramides ne bougent pas' },
    { id: 'ground', name: 'Sol', key: 'KeyP', label: 'P', hint: 'Glisser : peindre le sol · clic droit (plan) : sol d’origine · [ et ] : taille' },
    { id: 'roads', name: 'Routes', key: 'KeyL', label: 'L', hint: 'Clic : un point · double-clic ou Entrée : finir · Retour arrière : enlever le dernier · Échap : annuler' },
    { id: 'buildings', name: 'Bâtiments', key: 'KeyB', label: 'B', hint: 'Clic : poser · R : tourner d’un quart de tour · Alt+clic : pipette' },
  ];

  /* ------------------------------------------------- pinceaux (relief, sol) -- */
  const now = () => performance.now();
  function dab(st, x, z, k = 1) {
    let r;
    if (st.kind === 'terrain') {
      const b = S.opts.ow.brush, op = st.op;
      const sMeters = (op === 'raise' || op === 'lower' ? b.strength * 0.9 : b.strength * 0.35) * k;
      r = ZS.ow.sculpt(op, x, z, b.size, sMeters, st.target);
    } else {
      const p = S.opts.ow.paint;
      r = ZS.ow.paint(st.erase ? -1 : ZS.ow.PAINTS.find((q) => q.id === p.bio).v, x, z, p.size);
    }
    st.rect = O.unionRect(st.rect, r);
    st.live = O.unionRect(st.live, r);
    st.n++;
    if (now() - st.t > 90) { ZS.ow.afterTerrain(st.live, { live: true }); st.live = null; st.t = now(); MT.plan.need = true; }
  }
  function stroke(kind) {
    return {
      down(p, ev) {
        if (ev.button !== 0 && ev.button !== 2) return false;
        if (!O.ok2() || !ZS.ow.on) { MT.toast('Le monde n’est pas encore chargé.', 'warn'); return true; }
        const b = S.opts.ow.brush;
        const op = kind === 'terrain' && ev.button === 2 ? (b.op === 'raise' ? 'lower' : b.op === 'lower' ? 'raise' : b.op) : b.op;
        MT.begin(kind === 'terrain' ? `Relief : ${TR.OPS.find((o) => o[0] === op)[1].toLowerCase()}` : 'Peindre le sol');
        const st = { kind, op, erase: kind === 'ground' && ev.button === 2, rect: null, live: null, t: now(), n: 0, last: [p.wx, p.wz], target: ZS.ow.reliefAt(p.wx, p.wz) };
        // Échap pendant le coup : le terrain de la zone revient à la carte (rien n'y est encore écrit)
        const onCancel = () => { clearInterval(st.timer); st.timer = null; st.offBlur(); if (st.rect) { try { ZS.ow.syncMods(S.map); ZS.ow.apply(S.map, st.rect); } catch (e) { console.error(e); } MT.plan.need = true; } };
        // fenêtre quittée bouton enfoncé (Alt+Tab…) : le relâcher n'arrivera pas ; le coup s'arrête là
        const onBlur = () => { if (MT.tools.drag && MT.tools.drag.st === st) MT.tools.up(null, {}); };
        window.addEventListener('blur', onBlur);
        st.offBlur = () => window.removeEventListener('blur', onBlur);
        MT.tools.drag = { mode: 'ow-stroke', st, onCancel };
        dab(st, p.wx, p.wz);
        // pinceau tenu immobile : il continue (monter, creuser)
        st.timer = setInterval(() => {
          const d = MT.tools.drag;
          if (!d || d.st !== st) { clearInterval(st.timer); st.offBlur(); return; }
          // tenu immobile : la moitié d'un passage toutes les 110 ms (environ 2 m par seconde à 50 %)
          if (st.op === 'raise' || st.op === 'lower' || st.op === 'smooth') dab(st, st.last[0], st.last[1], 0.5);
        }, 110);
        return true;
      },
      drag(p) {
        const d = MT.tools.drag;
        if (!d || d.mode !== 'ow-stroke' || !p) return;
        const st = d.st, size = kind === 'terrain' ? S.opts.ow.brush.size : S.opts.ow.paint.size;
        const [lx, lz] = st.last, dist = Math.hypot(p.wx - lx, p.wz - lz), step = Math.max(1.5, size * 0.3);
        if (dist < step) return;
        const n = Math.min(40, Math.ceil(dist / step));
        for (let i = 1; i <= n; i++) dab(st, lx + ((p.wx - lx) * i) / n, lz + ((p.wz - lz) * i) / n);
        st.last = [p.wx, p.wz];
      },
      up() {
        const d = MT.tools.drag;
        if (!d || d.mode !== 'ow-stroke') return;
        const st = d.st;
        clearInterval(st.timer);
        st.offBlur();
        if (!st.rect) return;
        // la carte reçoit ses blocs ; le terrain de la zone est refait au propre (routes, bâtiments)
        const R = ZS.ow.commitTerrain(S.map, st.rect);
        MT.touch('ow-terrain', { rect: R, done: true });
      },
      hover(p) { MT.preview.brush = p ? { x: p.wx, z: p.wz, r: kind === 'terrain' ? S.opts.ow.brush.size : S.opts.ow.paint.size, kind } : null; },
    };
  }

  /* ------------------------------------------------------------ routes -- */
  const roads = {
    down(p, ev) {
      if (ev.button !== 0) return false;
      const o = S.opts.ow.road;
      const pv = MT.preview.road || (MT.preview.road = { kind: o.kind, w: o.w, pts: [] });
      const last = pv.pts[pv.pts.length - 1];
      // double-clic (deux clics au même endroit) : fin de la route
      if (last && Math.hypot(last[0] - p.wx, last[1] - p.wz) < Math.max(1.5, 6 / MT.plan.cam.zoom) && pv.pts.length >= 2) { TR.finishRoad(); return true; }
      if (pv.pts.length >= 300) { MT.toast('300 points au plus par route.', 'warn'); return true; }
      pv.pts.push([round(p.wx, 1), round(p.wz, 1)]);
      MT.emit('preview');
      return true;
    },
    hover(p) { if (MT.preview.road) MT.preview.road.cursor = p ? [p.wx, p.wz] : null; },
  };
  TR.finishRoad = () => {
    const pv = MT.preview.road;
    MT.preview.road = null;
    if (!pv || pv.pts.length < 2) { MT.emit('preview'); return false; }
    if ((S.map.roads || []).length >= ZS.OPEN_LIMITS.roads) { MT.toast(`${ZS.OPEN_LIMITS.roads} routes au plus.`, 'warn'); return false; }
    const r = { kind: pv.kind, w: pv.w, pts: pv.pts };
    let idx = -1;
    MT.edit(`Tracer : ${r.kind === 'road' ? 'route' : 'piste'}`, (m) => { m.roads.push(r); idx = m.roads.length - 1; }, 'ow-terrain', { rect: O.terrainRect('road', r) });
    MT.select({ kind: 'road', i: idx });
    MT.emit('preview');
    return true;
  };
  TR.cancelRoad = () => { if (!MT.preview.road) return false; MT.preview.road = null; MT.emit('preview'); return true; };

  /* --------------------------------------------------------- bâtiments -- */
  const buildings = {
    down(p, ev) {
      if (ev.button !== 0) return false;
      const o = S.opts.ow.bld;
      if (ev.alt) { const h = O.hitTest(p); if (h && h.kind === 'building') { const b = S.map.buildings[h.i]; o.type = b.type; o.rot = b.rot; MT.emit('tool-opts'); } return true; }
      if ((S.map.buildings || []).length >= ZS.OPEN_LIMITS.buildings) { MT.toast(`${ZS.OPEN_LIMITS.buildings} bâtiments au plus.`, 'warn'); return true; }
      const r = ZS.ow.buildingPlace(o.type, p.wx, p.wz, o.rot);
      if (!r.ok) { MT.toast(r.why, 'warn'); return true; }
      const over = (S.map.buildings || []).some((b) => { const Q = ZS.ow.bldRect(b); return Q && r.rect[0] < Q.x1 && Q.x0 < r.rect[2] && r.rect[1] < Q.z1 && Q.z0 < r.rect[3]; });
      if (over) MT.toast('Ce bâtiment en chevauche un autre.', 'warn');
      let idx = -1;
      MT.edit(`Poser : ${ZS.ow.BUILDINGS[o.type].name.toLowerCase()}`, (m) => { m.buildings.push(r.b); idx = m.buildings.length - 1; }, 'ow-terrain', { rect: O.terrainRect('building', r.b) });
      MT.select({ kind: 'building', i: idx });
      return true;
    },
    hover(p) {
      if (!p || !ZS.ow.on) { MT.preview.bld = null; return; }
      const o = S.opts.ow.bld, r = ZS.ow.buildingPlace(o.type, p.wx, p.wz, o.rot);
      MT.preview.bld = { ...r, wx: p.wx, wz: p.wz };
    },
  };
  TR.rotateTool = (dir) => {
    const o = S.opts.ow.bld;
    o.rot = (o.rot + (dir > 0 ? 1 : 3)) % 4;
    MT.emit('tool-opts'); MT.emit('preview');
  };

  O.TOOLS2 = { terrain: stroke('terrain'), ground: stroke('ground'), roads, buildings };

  /* --------------------------------------------- routes : points (glisser) -- */
  /* Point d'une route sélectionnée sous le curseur du plan : son indice, ou -1. */
  TR.roadHandleAt = (p) => {
    const s = S.sel;
    if (!s || s.kind !== 'road' || !p) return -1;
    const r = S.map.roads[s.i];
    if (!r) return -1;
    const tol = Math.max(1.2, 8 / MT.plan.cam.zoom);
    return r.pts.findIndex(([x, z]) => Math.hypot(x - p.wx, z - p.wz) < tol);
  };
  /* Distance d'un point à la polyligne d'une route. */
  TR.roadDist = (r, x, z) => {
    let best = Infinity;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], ex = r.pts[i + 1][0] - ax, ez = r.pts[i + 1][1] - az, l2 = ex * ex + ez * ez || 1e-6;
      const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1);
      best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
    }
    return best;
  };
  /* Route, bâtiment ou lieu sous le point (sélection), après les éléments. */
  TR.hitTest = (p) => {
    const m = S.map;
    if (!m || !p) return null;
    const Z = MT.plan ? MT.plan.cam.zoom : 4, tol = p.view === '3d' ? 1.5 : Math.max(0.6, 7 / Z);
    for (let i = (m.buildings || []).length - 1; i >= 0; i--) {
      const R = ZS.ow.bldRect(m.buildings[i]);
      if (R && p.wx >= R.x0 - 0.2 && p.wx <= R.x1 + 0.2 && p.wz >= R.z0 - 0.2 && p.wz <= R.z1 + 0.2) return { kind: 'building', i };
    }
    let best = null, bd = Infinity;
    (m.roads || []).forEach((r, i) => { const d = TR.roadDist(r, p.wx, p.wz) - r.w / 2; if (d < tol && d < bd) { bd = d; best = { kind: 'road', i }; } });
    if (best) return best;
    if (p.view !== '3d') {
      for (let i = (m.locs || []).length - 1; i >= 0; i--) {
        const L = m.locs[i], d = Math.hypot(L.x - p.wx, L.z - p.wz);
        if (d < Math.max(1, 9 / Z) || Math.abs(d - L.r) < Math.max(1, 5 / Z)) return { kind: 'loc', i };
      }
    }
    return null;
  };
  /* Glisser un point de route (outil Sélection). */
  TR.startHandle = (i, k, p) => {
    MT.begin('Déplacer un point de la route');
    MT.tools.drag = { mode: 'ow-handle', i, k, orig: S.map.roads[i].pts[k].slice(), before: deep(S.map.roads[i]), moved: false };
  };
  TR.dragHandle = (p) => {
    const d = MT.tools.drag;
    if (!d || d.mode !== 'ow-handle' || !p) return;
    const r = S.map.roads[d.i];
    r.pts[d.k] = [round(clamp(p.wx, 1, S.map.w - 1), 1), round(clamp(p.wz, 1, S.map.h - 1), 1)];
    d.moved = true;
    MT.touch('ow-live', { kind: 'road', i: d.i, live: true });
  };
  TR.endHandle = () => {
    const d = MT.tools.drag;
    if (!d || d.mode !== 'ow-handle' || !d.moved) return;
    MT.touch('ow-terrain', { rect: O.unionRect(O.terrainRect('road', d.before), O.terrainRect('road', S.map.roads[d.i])) });
  };

  /* ----------------------------------------------------------- clavier -- */
  O.onKey = (e) => {
    if (S.tool === 'roads' && MT.preview.road) {
      if (e.key === 'Enter') { TR.finishRoad(); return true; }
      if (e.key === 'Escape') { TR.cancelRoad(); return true; }
      if (e.key === 'Backspace') { const pv = MT.preview.road; pv.pts.pop(); if (!pv.pts.length) MT.preview.road = null; MT.emit('preview'); return true; }
    }
    if ((S.tool === 'terrain' || S.tool === 'ground') && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
      const o = S.tool === 'terrain' ? S.opts.ow.brush : S.opts.ow.paint;
      o.size = clamp(Math.round(o.size * (e.code === 'BracketRight' ? 1.25 : 0.8)), 4, 160);
      MT.emit('tool-opts'); MT.emit('preview');
      MT.toast(`Pinceau : ${o.size} m`);
      return true;
    }
    if (S.tool === 'buildings' && e.code === 'KeyR' && !(S.sel && S.sel.kind === 'building')) { TR.rotateTool(e.altKey ? -1 : 1); return true; }
    return false;
  };

  /* ------------------------------------------------------------- plan -- */
  const yawOfRot = (q) => -q * Math.PI / 2;
  /* Dessin du plan : routes ajoutées, bâtiments, lieux nommés, aperçus (pinceau, route, bâtiment). */
  TR.drawPlan = (P, g, m, vis) => {
    const Z = P.cam.zoom, sel = S.sel;
    // routes ajoutées (vecteurs, à leur largeur)
    g.lineCap = 'round'; g.lineJoin = 'round';
    (m.roads || []).forEach((r, i) => {
      const on = sel && sel.kind === 'road' && sel.i === i;
      g.beginPath();
      r.pts.forEach(([x, z], k) => { const [sx, sy] = P.toScreen(x, z); if (k) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
      const wpx = Math.max(2, r.w * Z);
      if (on) { g.strokeStyle = '#ffd27a'; g.lineWidth = wpx + 5; g.stroke(); }
      if (r.kind === 'road') { g.strokeStyle = '#cfc2a8'; g.lineWidth = wpx + Math.max(1, 0.8 * Z); g.stroke(); g.strokeStyle = '#3a3430'; g.lineWidth = Math.max(1, wpx - Math.max(1, 0.8 * Z)); g.stroke(); }
      else { g.strokeStyle = 'rgba(110,84,58,0.85)'; g.lineWidth = wpx; g.stroke(); }
      if (on) for (const [x, z] of r.pts) { const [sx, sy] = P.toScreen(x, z); g.fillStyle = '#ffd27a'; g.strokeStyle = '#1b1408'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx, sy, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
    });
    g.lineCap = 'butt';
    // bâtiments : emprise, porte principale
    (m.buildings || []).forEach((b, i) => {
      const R = ZS.ow.bldRect(b);
      if (!R || !vis((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2, 20)) return;
      const [ax, ay] = P.toScreen(R.x0, R.z0), [bx, by] = P.toScreen(R.x1, R.z1);
      const on = sel && sel.kind === 'building' && sel.i === i;
      g.fillStyle = 'rgba(200,176,138,0.55)'; g.fillRect(ax, ay, bx - ax, by - ay);
      g.strokeStyle = on ? '#ffd27a' : '#2a2016'; g.lineWidth = on ? 2.5 : 1.5; g.strokeRect(ax, ay, bx - ax, by - ay);
      if (Z >= 3) {
        const T = ZS.ow.BUILDINGS[b.type];
        const t = T ? T.name : b.type;
        g.font = '600 11px "Barlow Condensed", "Arial Narrow", sans-serif';
        const tw = g.measureText(t).width;
        if (tw < bx - ax - 4 || Z >= 6) { g.fillStyle = '#1b1408'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, (ax + bx) / 2, (ay + by) / 2); g.textAlign = 'left'; }
      }
    });
    // lieux nommés de la carte
    (m.locs || []).forEach((L, i) => {
      if (!vis(L.x, L.z, L.r)) return;
      const [sx, sy] = P.toScreen(L.x, L.z), on = sel && sel.kind === 'loc' && sel.i === i;
      g.strokeStyle = on ? '#ffd27a' : 'rgba(255,231,176,0.7)'; g.lineWidth = on ? 2 : 1.5; g.setLineDash([7, 5]);
      g.beginPath(); g.arc(sx, sy, L.r * Z, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      g.font = `600 ${clamp(11 + Z * 2, 11, 17)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      const w = g.measureText(L.name).width;
      g.fillStyle = 'rgba(7,9,10,0.72)'; g.fillRect(sx - w / 2 - 3, sy - 10, w + 6, 20);
      g.fillStyle = on ? '#ffd27a' : '#ffe7b0'; g.textBaseline = 'middle'; g.fillText(L.name, sx - w / 2, sy);
    });
    // aperçus
    const pv = MT.preview;
    if ((S.tool === 'terrain' || S.tool === 'ground') && pv.brush && P.hover) {
      const [sx, sy] = P.toScreen(pv.brush.x, pv.brush.z), prot = ZS.ow.protectAt ? ZS.ow.protectAt(pv.brush.x, pv.brush.z) : 1;
      g.strokeStyle = S.tool === 'terrain' && prot < 0.05 ? '#e04a3a' : '#ffd27a'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(sx, sy, pv.brush.r * Z, 0, Math.PI * 2); g.stroke();
      g.setLineDash([3, 4]); g.beginPath(); g.arc(sx, sy, pv.brush.r * Z * 0.3, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      if (S.tool === 'terrain' && prot < 0.05) {
        const t = 'Protégé : lieu, route d’origine ou pyramide';
        g.font = '600 13px "Barlow Condensed", "Arial Narrow", sans-serif';
        const tw = g.measureText(t).width, tx = sx - tw / 2, ty = sy - pv.brush.r * Z - 14;
        g.fillStyle = 'rgba(7,9,10,0.8)'; g.fillRect(tx - 4, ty - 9, tw + 8, 18);
        g.fillStyle = '#ffb4a8'; g.textBaseline = 'middle'; g.fillText(t, tx, ty);
      }
    }
    if (S.tool === 'roads' && pv.road) {
      const pts = pv.road.pts.concat(pv.road.cursor ? [pv.road.cursor] : []);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, z], k) => { const [sx, sy] = P.toScreen(x, z); if (k) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
      g.strokeStyle = 'rgba(255,210,122,0.75)'; g.lineWidth = Math.max(2, pv.road.w * Z); g.stroke();
      g.lineCap = 'butt';
      for (const [x, z] of pv.road.pts) { const [sx, sy] = P.toScreen(x, z); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(sx, sy, 4, 0, Math.PI * 2); g.fill(); }
    }
    if (S.tool === 'buildings' && pv.bld && pv.bld.b && P.hover) {
      const R = ZS.ow.bldRect(pv.bld.b);
      if (R) {
        const [ax, ay] = P.toScreen(R.x0, R.z0), [bx, by] = P.toScreen(R.x1, R.z1);
        g.fillStyle = pv.bld.ok ? 'rgba(79,208,106,0.35)' : 'rgba(224,74,58,0.35)'; g.fillRect(ax, ay, bx - ax, by - ay);
        g.strokeStyle = pv.bld.ok ? '#4fd06a' : '#e04a3a'; g.lineWidth = 2; g.strokeRect(ax, ay, bx - ax, by - ay);
        if (!pv.bld.ok && pv.bld.why) { g.font = '600 12px "Barlow Condensed", sans-serif'; g.fillStyle = '#ffb4a8'; g.fillText(pv.bld.why, bx + 8, ay); }
      }
    }
  };

  /* --------------------------------------------------------------- 3D -- */
  /* Repères 3D du niveau 2 : cercle du pinceau posé sur le terrain, route en cours, bâtiment à poser. */
  TR.ghost3d = () => {
    const pv = MT.preview, g = new THREE.Group();
    g.userData.noPick = true;
    const line = (pts, color) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95, fog: false }));
      l.renderOrder = 21;
      g.add(l);
    };
    if ((S.tool === 'terrain' || S.tool === 'ground') && pv.brush) {
      const { x, z, r } = pv.brush, pts = [];
      for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; pts.push(new THREE.Vector3(px, ZS.ow.ground(px, pz) + 0.25, pz)); }
      line(pts, 0xffd27a);
    }
    if (S.tool === 'roads' && pv.road) {
      const all = pv.road.pts.concat(pv.road.cursor ? [pv.road.cursor] : []), pts = [];
      for (let k = 0; k < all.length - 1; k++) {
        const [ax, az] = all[k], [bx, bz] = all[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4));
        for (let q = 0; q <= n; q++) { const x = ax + ((bx - ax) * q) / n, z = az + ((bz - az) * q) / n; pts.push(new THREE.Vector3(x, ZS.ow.ground(x, z) + 0.4, z)); }
      }
      if (pts.length >= 2) line(pts, 0xffd27a);
    }
    if (S.tool === 'buildings' && pv.bld && pv.bld.b) {
      const R = ZS.ow.bldRect(pv.bld.b), y = pv.bld.b.y;
      if (R) {
        const box = new THREE.Box3(new THREE.Vector3(R.x0, y, R.z0), new THREE.Vector3(R.x1, y + 3.2, R.z1));
        const hlp = new THREE.Box3Helper(box, pv.bld.ok ? 0x4fd06a : 0xe04a3a);
        hlp.material.depthTest = false; hlp.material.transparent = true; hlp.renderOrder = 21;
        g.add(hlp);
      }
    }
    return g.children.length ? g : null;
  };
})();
