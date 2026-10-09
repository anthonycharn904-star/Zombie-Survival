'use strict';
/* =========================================================================
   Mod Tools — cartes ouvertes : plan (vue de dessus)
   Fond : le relief de toute la carte (une image, 2 m par pixel) ; de près, des
   morceaux de 64 × 64 m à 1 m par pixel (relief, sols, murs, portes, fenêtres :
   ZS.ow.tile), quelques-uns par image. Par-dessus : noms des lieux, objets,
   éléments, sélection, aperçu de l'outil, problèmes, caméra 3D.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS;
  const { clamp } = MT.util;
  const S = MT.state;
  const O = MT.ow;
  const PL = (O.plan = { base: null, baseBusy: false, locs: null, ZMIN: 0.12, ZMAX: 40 });
  const CAT_COLOR = {
    stockage: '#a5804c', mobilier: '#8e6d54', hopital: '#9db3b6', bureau: '#86915f', industriel: '#7b8189', militaire: '#727d4c',
    urbain: '#8c8b80', nature: '#4e7d3c', eclairage: '#dcc46e', horreur: '#94403d', decals: '#b14848', import: '#5f8fb0',
  };

  /* Image du relief de toute la carte (faite une fois, après le premier chargement du monde). */
  function ensureBase(P) {
    if (PL.base || PL.baseBusy || !ZS.ow.on || !(MT.v3 && MT.v3.owLoaded)) return;
    PL.baseBusy = true;
    setTimeout(() => {
      // aux proportions de la carte : 2 000 × 1 500 pour le désert (4 × 3 km), 1 500 × 1 500 pour la Lune
      const m = S.map, k = m ? Math.min(2000 / m.w, 1500 / m.h) : 0.5;
      try { PL.base = ZS.ow.plan(Math.round((m ? m.w : 4000) * k), Math.round((m ? m.h : 3000) * k)); PL.locs = O.baseLocs(); } catch (e) { console.error(e); }
      PL.baseBusy = false;
      P.need = true;
    }, 30);
  }
  PL.fit = (P) => {
    const m = S.map;
    P.cam.zoom = clamp(Math.min((P.w - 40) / m.w, (P.h - 40) / m.h), PL.ZMIN, PL.ZMAX);
    P.cam.x = m.w / 2; P.cam.z = m.h / 2;
    P.need = true;
  };

  /* --------------------------------------------------------- dessin --- */
  function text(g, t, sx, sy, { size = 12, color = '#e8dfc8', bg = 'rgba(7,9,10,0.72)', weight = 600, align = 'center' } = {}) {
    g.font = `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const w = g.measureText(t).width, x = align === 'center' ? sx - w / 2 : sx;
    if (bg) { g.fillStyle = bg; g.fillRect(x - 3, sy - size * 0.62 - 2, w + 6, size + 4); }
    g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(t, x, sy);
  }
  /* Rectangle tourné (centre cx, cz ; demi-tailles hx en travers, hz en long ; lacet à la manière
     de three.js : x' = x cos + z sin, z' = -x sin + z cos). */
  function rotRect(P, cx, cz, hx, hz, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([lx, lz]) => P.toScreen(cx + lx * c + lz * s, cz - lx * s + lz * c));
  }
  function poly(g, pts, fill, stroke, lw = 1) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  const yawOfFace = (f) => Math.atan2(f[0], f[1]);

  PL.draw = (P) => {
    const g = P.g, m = S.map, Z = P.cam.zoom;
    g.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    g.fillStyle = '#090b0c';
    g.fillRect(0, 0, P.w, P.h);
    if (!m) return;
    ensureBase(P);
    const [ox, oy] = P.toScreen(0, 0);
    if (PL.base) {
      g.imageSmoothingEnabled = true;
      g.drawImage(PL.base, ox, oy, m.w * Z, m.h * Z);
    } else {
      g.fillStyle = O.moon() ? '#2b2b2c' : '#3a2f24'; g.fillRect(ox, oy, m.w * Z, m.h * Z);
      text(g, 'Plan en préparation…', P.w / 2, P.h / 2, { size: 14 });
    }
    const w0 = P.toWorld(0, 0), w1 = P.toWorld(P.w, P.h);
    const vis = (x, z, pad = 4) => x >= w0.x - pad && x <= w1.x + pad && z >= w0.z - pad && z <= w1.z + pad;
    // de près : morceaux de 64 m (relief à 1 m, sols, murs)
    if (Z >= 1.4 && ZS.ow.on) {
      g.imageSmoothingEnabled = Z < 3;
      let budget = 10, missing = false;
      const tx0 = Math.max(0, Math.floor(w0.x / 64)), tx1 = Math.min(Math.ceil(m.w / 64) - 1, Math.floor(w1.x / 64));
      const tz0 = Math.max(0, Math.floor(w0.z / 64)), tz1 = Math.min(Math.ceil(m.h / 64) - 1, Math.floor(w1.z / 64));
      for (let tz = tz0; tz <= tz1; tz++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          let c = ZS.ow.tile(tx, tz, false);
          if (!c && budget > 0) { c = ZS.ow.tile(tx, tz, true); budget--; }
          if (!c) { missing = true; continue; }
          const [sx, sy] = P.toScreen(tx * 64, tz * 64);
          g.drawImage(c, Math.floor(sx), Math.floor(sy), Math.ceil(64 * Z) + 1, Math.ceil(64 * Z) + 1);
        }
      }
      if (missing) P.need = true;
      g.imageSmoothingEnabled = true;
      // routes et pistes, à leur largeur (le fond les a déjà, de loin)
      if (!PL.roads) PL.roads = ZS.ow.roads ? ZS.ow.roads() : [];
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const r of PL.roads) {
        g.beginPath();
        r.pts.forEach(([x, z], i) => { const [sx, sy] = P.toScreen(x, z); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
        if (r.kind === 'road') { g.strokeStyle = '#cfc2a8'; g.lineWidth = (r.w + 0.8) * Z; g.stroke(); g.strokeStyle = '#3a3430'; g.lineWidth = (r.w - 0.8) * Z; g.stroke(); }
        else if (r.kind === 'runway') { g.strokeStyle = '#8d8984'; g.lineWidth = r.w * Z; g.stroke(); }
        else { g.strokeStyle = 'rgba(110,84,58,0.6)'; g.lineWidth = r.w * Z; g.stroke(); }
      }
      g.lineCap = 'butt';
    }
    // quadrillage : 100 m, puis 10 m et 1 m de près
    g.lineWidth = 1;
    for (const [step, a, zmin] of [[100, 0.1, 0.35], [10, 0.08, 5], [1, 0.07, 16]]) {
      if (Z < zmin) continue;
      g.strokeStyle = `rgba(232,223,200,${a})`;
      g.beginPath();
      for (let x = Math.ceil(Math.max(0, w0.x) / step) * step; x <= Math.min(m.w, w1.x); x += step) { const sx = Math.round(ox + x * Z) + 0.5; g.moveTo(sx, Math.max(oy, 0)); g.lineTo(sx, Math.min(oy + m.h * Z, P.h)); }
      for (let z = Math.ceil(Math.max(0, w0.z) / step) * step; z <= Math.min(m.h, w1.z); z += step) { const sy = Math.round(oy + z * Z) + 0.5; g.moveTo(Math.max(ox, 0), sy); g.lineTo(Math.min(ox + m.w * Z, P.w), sy); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(214,173,87,0.55)'; g.lineWidth = 1.5;
    g.strokeRect(ox - 0.5, oy - 0.5, m.w * Z + 1, m.h * Z + 1);
    // noms des lieux
    if (PL.locs && P.showZones !== false) {
      for (const L of PL.locs) {
        if (!vis(L.x, L.z, L.r)) continue;
        const [sx, sy] = P.toScreen(L.x, L.z);
        if (Z >= 1.5) { g.strokeStyle = 'rgba(232,223,200,0.25)'; g.setLineDash([6, 6]); g.beginPath(); g.arc(sx, sy, L.r * Z, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
        text(g, L.name, sx, Z >= 1.5 ? sy - L.r * Z * 0.72 : sy - clamp(L.r * Z * 0.6, 14, 40), { size: clamp(11 + Z * 2, 11, 17), color: '#ffe7b0' });
      }
    }
    if (O.terrain) O.terrain.drawPlan(P, g, m, vis);
    if (P.showProps !== false) drawProps(P, g, m, vis);
    drawElements(P, g, m, vis);
    drawSelection(P, g, m);
    drawPreview(P, g, m);
    drawIssues(P, g);
    drawCamera(P, g);
    if (P.flash) {
      const t = (performance.now() - P.flash.t0) / 1000;
      if (t > 1.4) P.flash = null;
      else {
        const [sx, sy] = P.toScreen(P.flash.x, P.flash.z);
        g.strokeStyle = `rgba(255,214,120,${1 - t / 1.4})`; g.lineWidth = 3;
        g.beginPath(); g.arc(sx, sy, 8 + t * 40, 0, Math.PI * 2); g.stroke();
      }
    }
    // échelle
    const bar = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1].find((v) => v * Z <= 140) || 1;
    const bx = 14, by = P.h - 16;
    g.strokeStyle = '#e8dfc8'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(bx, by); g.lineTo(bx + bar * Z, by); g.lineTo(bx + bar * Z, by - 4); g.stroke();
    text(g, bar >= 1000 ? `${bar / 1000} km` : `${bar} m`, bx + bar * Z / 2, by - 11, { size: 11, bg: null });
  };

  /* ---------------------------------------------------------- objets --- */
  function drawProps(P, g, m, vis) {
    const Z = P.cam.zoom;
    if (Z < 0.35) return;
    const sel = new Set(MT.selectedProps());
    m.props.forEach((pr, i) => {
      if (!vis(pr.x, pr.z, 6)) return;
      const def = ZS.MODELS[pr.m];
      const col = def ? CAT_COLOR[def.cat] || '#a5804c' : '#ff3b30';
      if (Z < 1.2) {
        const [sx, sy] = P.toScreen(pr.x, pr.z);
        g.fillStyle = sel.has(i) ? '#ffd27a' : col;
        g.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        return;
      }
      const pts = MT.propCorners(pr).map(([x, z]) => P.toScreen(x, z));
      poly(g, pts, `${col}c0`, sel.has(i) ? '#ffd27a' : 'rgba(0,0,0,0.55)', sel.has(i) ? 2 : 1);
    });
  }

  /* -------------------------------------------------------- éléments --- */
  function marker(g, sx, sy, r, fill, stroke = 'rgba(0,0,0,0.7)', shape = 'circle') {
    g.beginPath();
    if (shape === 'square') g.rect(sx - r, sy - r, r * 2, r * 2);
    else if (shape === 'diamond') { g.moveTo(sx, sy - r); g.lineTo(sx + r, sy); g.lineTo(sx, sy + r); g.lineTo(sx - r, sy); g.closePath(); }
    else g.arc(sx, sy, r, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill();
    g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke();
  }
  PL.drawElement = (P, g, kind, e, i, { ghost = false, ok = true } = {}) => {
    const Z = P.cam.zoom, m = S.map;
    const tint = (c) => (ghost ? (ok ? 'rgba(79,208,106,0.75)' : 'rgba(224,74,58,0.75)') : c);
    switch (kind) {
      case 'spawn': {
        const [sx, sy] = P.toScreen(e.pos[0], e.pos[1]), r = Math.max(6, 0.6 * Z);
        marker(g, sx, sy, r, tint('#2fa84a'), '#d9ffd0');
        g.strokeStyle = '#8dff74'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - Math.sin(e.yaw) * r * 2.2, sy - Math.cos(e.yaw) * r * 2.2); g.stroke();
        if (Z >= 2.5) text(g, 'Départ', sx, sy + r + 9, { size: 11, color: '#c8ffb8' });
        break;
      }
      case 'wallbuy': {
        const [sx, sy] = P.toScreen(e.x, e.z);
        if (Z >= 2.5) {
          poly(g, rotRect(P, e.x + e.nx * 0.06, e.z + e.nz * 0.06, 0.8, 0.12, yawOfFace([e.nx, e.nz])), tint('#f0ecdc'), '#2a2622', 1);
          if (Z >= 12 && !ghost) text(g, O.weaponName(e.w), sx + e.nx * 16, sy + e.nz * 16, { size: 11 });
        } else marker(g, sx, sy, 3.5, tint('#f0ecdc'), '#2a2622', 'square');
        break;
      }
      case 'perk': {
        const D = (ZS.ELIXIRS && ZS.ELIXIRS[e.p]) || { w: 1.2, d: 1 };
        const cx = e.x + e.face[0] * D.d / 2, cz = e.z + e.face[1] * D.d / 2;
        const col = (ZS.PERKS[e.p] && ZS.PERKS[e.p].color) || '#b3231f';
        const [sx, sy] = P.toScreen(cx, cz);
        if (Z >= 4) {
          poly(g, rotRect(P, cx, cz, D.w / 2, D.d / 2, yawOfFace(e.face)), tint(col), '#140c0b', 1.5);
          const [fx, fy] = P.toScreen(cx + e.face[0] * (D.d / 2 + 0.5), cz + e.face[1] * (D.d / 2 + 0.5));
          g.strokeStyle = '#fff2'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(fx, fy); g.stroke();
        } else marker(g, sx, sy, 6, tint(col), '#140c0b');
        if (!ghost && ZS.PERKS[e.p]) text(g, ZS.PERKS[e.p].glyph || '?', sx, sy, { size: 11, color: '#fff', bg: null, weight: 700 });
        if (Z >= 6 && !ghost) text(g, O.perkName(e.p), sx, sy + Math.max(14, D.d * Z), { size: 11 });
        break;
      }
      case 'box': {
        const [sx, sy] = P.toScreen(e.x, e.z), start = !ghost && m.boxStart === i;
        if (Z >= 3) poly(g, rotRect(P, e.x, e.z, 0.8, 0.4, yawOfFace(e.face)), tint('#2f6fc8'), start ? '#ffd27a' : '#0c1a33', start ? 2.5 : 1.2);
        else marker(g, sx, sy, start ? 6 : 5, tint('#2f6fc8'), start ? '#ffd27a' : '#0c1a33', 'square');
        if (!ghost && (Z >= 3 || start)) text(g, start ? `Boîte ${i + 1} · départ` : `Boîte ${i + 1}`, sx, sy - Math.max(12, Z * 0.9), { size: 11, color: '#bcd6ff' });
        break;
      }
      case 'vehicle': {
        const T = ZS.VEH_TYPES[e.type] || { len: 4.5, wid: 1.9 };
        const [sx, sy] = P.toScreen(e.x, e.z);
        if (Z >= 1.6) {
          poly(g, rotRect(P, e.x, e.z, T.wid / 2, T.len / 2, e.yaw || 0), tint('#8d9a52'), '#1d2110', 1.5);
          // avant (le véhicule avance vers -z local)
          const fx = e.x - Math.sin(e.yaw || 0) * T.len * 0.42, fz = e.z - Math.cos(e.yaw || 0) * T.len * 0.42;
          const [ax, ay] = P.toScreen(fx, fz);
          marker(g, ax, ay, Math.max(2, Z * 0.3), '#f4e9a8', '#1d2110');
        } else marker(g, sx, sy, 5, tint('#8d9a52'), '#1d2110', 'diamond');
        if (Z >= 3 && !ghost) text(g, O.vehName(e.type), sx, sy + Math.max(14, T.len * Z * 0.6), { size: 11 });
        break;
      }
      case 'fuel': {
        const [sx, sy] = P.toScreen(e.x, e.z);
        marker(g, sx, sy, Math.max(4, 0.45 * Z), tint('#e07a24'), '#2b1405', 'square');
        if (Z >= 5 && !ghost) text(g, 'Jerricans', sx, sy + Math.max(12, Z * 0.8), { size: 11 });
        break;
      }
      case 'breaker': {
        const [sx, sy] = P.toScreen(e.x + e.nx * 0.2, e.z + e.nz * 0.2);
        if (Z >= 3) poly(g, rotRect(P, e.x + e.nx * 0.2, e.z + e.nz * 0.2, 0.45, 0.2, yawOfFace([e.nx, e.nz])), tint('#e8c22a'), '#2a2205', 1.5);
        else marker(g, sx, sy, 5, tint('#e8c22a'), '#2a2205', 'diamond');
        if (Z >= 6 && !ghost) text(g, e.name, sx + e.nx * 18, sy + e.nz * 18, { size: 11, color: '#fff1b0' });
        break;
      }
      case 'oxy': {
        // râtelier de bouteilles (1,3 × 0,45 m), dos au mur
        const cx = e.x + e.face[0] * 0.22, cz = e.z + e.face[1] * 0.22, [sx, sy] = P.toScreen(cx, cz);
        if (Z >= 4) poly(g, rotRect(P, cx, cz, 0.65, 0.24, yawOfFace(e.face)), tint('#5fd8a8'), '#0b2a1e', 1.5);
        else marker(g, sx, sy, 5, tint('#5fd8a8'), '#0b2a1e', 'square');
        if (!ghost && Z >= 2) text(g, 'O₂', sx, sy, { size: 10, color: '#0b2a1e', bg: null, weight: 700 });
        if (Z >= 6 && !ghost) text(g, `Oxygène ${i + 1}`, sx, sy + Math.max(14, Z * 0.8), { size: 11, color: '#c8ffe8' });
        break;
      }
      case 'glas': {
        // beffroi de 4,7 m, socle de 2,4 × 1,2 m, place devant
        const [sx, sy] = P.toScreen(e.x, e.z);
        if (Z >= 1.2) {
          poly(g, rotRect(P, e.x, e.z, 2.35, 2.35, yawOfFace(e.face)), ghost ? tint('#d9a441') : 'rgba(217,164,65,0.25)', '#2a1c06', 1.2);
          poly(g, rotRect(P, e.x, e.z, 1.2, 0.6, yawOfFace(e.face)), tint('#d9a441'), '#2a1c06', 1.5);
          const [fx, fy] = P.toScreen(e.x + e.face[0] * 2.2, e.z + e.face[1] * 2.2);
          g.strokeStyle = '#ffe6a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(fx, fy); g.stroke();
        } else marker(g, sx, sy, 6, tint('#d9a441'), '#2a1c06');
        if (!ghost) text(g, 'Le Glas', sx, sy - Math.max(14, Z * 3), { size: 11, color: '#ffe6a8' });
        break;
      }
      default: break;
    }
  };
  function drawElements(P, g, m, vis) {
    const each = (kind) => (O.arr(kind, m) || []).forEach((e, i) => { if (vis(e.x, e.z, 10)) PL.drawElement(P, g, kind, e, i); });
    for (const k of ['fuel', 'breaker', 'oxy', 'wallbuy', 'box', 'perk', 'vehicle']) each(k);
    if (m.glas && vis(m.glas.x, m.glas.z, 10)) PL.drawElement(P, g, 'glas', m.glas, 0);
    PL.drawElement(P, g, 'spawn', m.spawn, 0);
  }

  /* ------------------------------------------- sélection, aperçu --- */
  function drawSelection(P, g, m) {
    const s = S.sel;
    if (!s || s.kind === 'prop') return;
    const e = O.get(s);
    if (!e) return;
    const [x, z] = O.posOf(s.kind, e);
    const [sx, sy] = P.toScreen(x, z);
    const r = s.kind === 'vehicle' ? Math.max(14, ((ZS.VEH_TYPES[e.type] || { len: 4 }).len / 2 + 0.6) * P.cam.zoom) : Math.max(11, 1.4 * P.cam.zoom);
    g.strokeStyle = '#ffd27a'; g.lineWidth = 2.5;
    g.setLineDash([5, 4]);
    g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }
  function drawPreview(P, g, m) {
    const pv = MT.preview;
    if (pv.rect) {
      const [ax, ay] = P.toScreen(pv.rect.a[0], pv.rect.a[1]), [bx, by] = P.toScreen(pv.rect.b[0], pv.rect.b[1]);
      g.strokeStyle = '#ffd27a'; g.lineWidth = 1.5; g.setLineDash([5, 4]);
      g.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,210,122,0.08)'; g.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    }
    if (S.tool === 'props' && pv.ghost && P.hover) {
      const pts = MT.propCorners(pv.ghost).map(([x, z]) => P.toScreen(x, z));
      g.setLineDash([4, 3]); poly(g, pts, 'rgba(255,210,122,0.25)', '#ffd27a', 1.5); g.setLineDash([]);
    }
    const o = pv.ow;
    if (S.tool === 'elements' && o && P.hover) {
      if (o.ok) {
        const e = o.kind === 'spawn' ? { pos: [o.x, o.z], yaw: m.spawn.yaw }
          : o.kind === 'wallbuy' || o.kind === 'breaker' ? { x: o.x, z: o.z, nx: o.nx, nz: o.nz, w: S.opts.ow.weapon, name: '' }
            : o.kind === 'vehicle' ? { x: o.x, z: o.z, type: o.type, yaw: o.yaw }
              : { x: o.x, z: o.z, face: o.face || [0, 1], p: S.opts.ow.perk };
        PL.drawElement(P, g, o.kind, e, -1, { ghost: true, ok: true });
      } else {
        const [sx, sy] = P.toScreen(o.wx, o.wz);
        g.strokeStyle = '#e04a3a'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(sx - 6, sy - 6); g.lineTo(sx + 6, sy + 6); g.moveTo(sx + 6, sy - 6); g.lineTo(sx - 6, sy + 6); g.stroke();
        if (o.why) text(g, o.why, sx + 12, sy - 14, { size: 12, color: '#ffb4a8', align: 'left' });
      }
    }
    if (pv.owWhy && P.hover) {
      const [sx, sy] = P.toScreen(P.hover.wx, P.hover.wz);
      text(g, pv.owWhy, sx + 12, sy - 14, { size: 12, color: '#ffb4a8', align: 'left' });
    }
  }
  function drawIssues(P, g) {
    const { errors, warnings } = S.issues;
    for (const [list, col] of [[warnings, '#e8b04a'], [errors, '#e04a3a']]) {
      for (const e of list) {
        if (!e.at) continue;
        const [sx, sy] = P.toScreen(e.at[0], e.at[1]);
        g.strokeStyle = col; g.lineWidth = 2.5;
        g.beginPath(); g.arc(sx, sy, 9, 0, Math.PI * 2); g.stroke();
      }
    }
  }
  function drawCamera(P, g) {
    const v = MT.v3;
    if (!v || !v.cam || !v.visible) return;
    const c = v.cam.position, [sx, sy] = P.toScreen(c.x, c.z);
    const L = 26, a = 0.5;
    g.fillStyle = 'rgba(124,200,255,0.18)'; g.strokeStyle = 'rgba(124,200,255,0.85)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(sx, sy);
    g.lineTo(sx - Math.sin(v.yaw - a) * L, sy - Math.cos(v.yaw - a) * L);
    g.lineTo(sx - Math.sin(v.yaw + a) * L, sy - Math.cos(v.yaw + a) * L);
    g.closePath(); g.fill(); g.stroke();
  }

  // monde chargé (autre carte, autre base, retour d'un test) : fond, lieux et routes relus
  MT.on('ow-world', () => { PL.base = null; PL.locs = O.baseLocs(); PL.roads = null; if (MT.plan) MT.plan.need = true; });
})();
