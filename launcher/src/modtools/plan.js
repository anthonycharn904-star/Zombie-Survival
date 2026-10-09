'use strict';
/* =========================================================================
   Mod Tools — vue en plan (2D, vue de dessus)
   Fond : une image de la carte (une case = quelques pixels), refaite quand les
   cases ou les textures changent. Par-dessus, à chaque image : grille, pièces,
   éléments de jeu, objets, sélection, aperçu de l'outil, problèmes.
   Souris : molette = zoom, clic milieu ou Espace+clic = déplacer la vue.
   ========================================================================= */
(() => {
  const MT = window.MT, ZS = window.ZS;
  const { clamp, DIRS } = MT.util;
  const S = MT.state;
  const P = (MT.plan = {
    cam: { x: 16, z: 12, zoom: 24 }, canvas: null, g: null, w: 1, h: 1, dpr: 1,
    base: null, baseKey: '', baseRev: 0, B: 12, need: true, hover: null, pan: null, active: false, space: false,
    showZones: true, showProps: true, showGrid: true, flash: null, visible: true,
  });

  const TILE_COLOR = { '.': '#77726a', '#': '#24211e', W: '#b98538', D: '#9c3a28', m: '#59544c', P: '#38332e', x: '#86663b', o: '#3c4a2b', ' ': '#0d0f11' };
  const CAT_COLOR = {
    stockage: '#a5804c', mobilier: '#8e6d54', hopital: '#9db3b6', bureau: '#86915f', industriel: '#7b8189', militaire: '#727d4c',
    urbain: '#8c8b80', nature: '#4e7d3c', eclairage: '#dcc46e', horreur: '#94403d', decals: '#b14848', import: '#5f8fb0',
  };
  const DOOR_COLOR = { door: '#a8582c', debris: '#7d6d5a', steel: '#6d7a84', gate: '#8a8f7a' };
  const STAIR_COLOR = { wood: '#93603a', wood_old: '#76604a', stone: '#9a978f', stone_moss: '#76855e', concrete: '#999c9f', metal: '#86919a', grating: '#8a6448', brick: '#b0563d', marble: '#ddd6ca' };
  const BASE_KINDS = new Set(['grid', 'layers', 'all', 'settings', 'textures']);
  const zoneColor = (i, a) => `hsla(${(i * 137.508) % 360}, 55%, 55%, ${a})`;
  const thumbCache = new Map();
  function thumb(id) {
    if (!thumbCache.has(id)) thumbCache.set(id, ZS.TEXLIB[id] ? ZS.textureThumb(id, 32) : null);
    return thumbCache.get(id);
  }
  MT.on('library', () => { thumbCache.clear(); patterns.clear(); P.baseRev++; P.need = true; });

  /* ------------------------------------------------------- coordonnées -- */
  P.toScreen = (x, z) => [P.w / 2 + (x - P.cam.x) * P.cam.zoom, P.h / 2 + (z - P.cam.z) * P.cam.zoom];
  P.toWorld = (sx, sy) => ({ x: (sx - P.w / 2) / P.cam.zoom + P.cam.x, z: (sy - P.h / 2) / P.cam.zoom + P.cam.z });
  function pickAt(e) {
    const r = P.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const w = P.toWorld(sx, sy);
    return { x: Math.floor(w.x), z: Math.floor(w.z), wx: w.x, wz: w.z, wy: 0, face: null, view: 'plan', sx, sy };
  }
  const evInfo = (e) => ({ button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, view: 'plan' });
  const usesRight = () => S.tool === 'build' || S.tool === 'paint' || S.tool === 'elements' || S.tool === 'stairs' || S.tool === 'terrain' || S.tool === 'ground';

  const OWP = () => (S.map && S.map.open && MT.ow && MT.ow.plan ? MT.ow.plan : null);
  P.fit = () => {
    const m = S.map;
    if (!m) return;
    if (OWP()) { OWP().fit(P); return; }
    P.cam.zoom = clamp(Math.min((P.w - 60) / m.w, (P.h - 60) / m.h), 3, 64);
    P.cam.x = m.w / 2; P.cam.z = m.h / 2;
    P.need = true;
  };
  P.centerOn = (x, z, flash = true) => {
    P.cam.x = x; P.cam.z = z;
    if (OWP()) { if (P.cam.zoom < 5) P.cam.zoom = 8; } else if (P.cam.zoom < 18) P.cam.zoom = 22;
    if (flash) P.flash = { x, z, t0: performance.now() };
    P.need = true;
  };
  P.resize = (w, h) => {
    if (!P.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    P.dpr = dpr; P.w = Math.max(1, w); P.h = Math.max(1, h);
    P.canvas.width = Math.round(P.w * dpr); P.canvas.height = Math.round(P.h * dpr);
    P.canvas.style.width = `${P.w}px`; P.canvas.style.height = `${P.h}px`;
    P.need = true;
  };

  /* ------------------------------------------------------------ souris -- */
  function onDown(e) {
    if (!S.map) return;
    P.canvas.focus({ preventScroll: true });
    const p = pickAt(e);
    if (e.button === 1 || (e.button === 0 && P.space) || (e.button === 2 && !usesRight())) {
      P.pan = { sx: e.clientX, sy: e.clientY, x: P.cam.x, z: P.cam.z, moved: false, button: e.button };
      P.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      P.canvas.classList.add('panning');
      return;
    }
    if (MT.tools.down(p, evInfo(e))) {
      P.active = true;
      P.canvas.setPointerCapture(e.pointerId);
    }
    P.need = true;
  }
  function onMove(e) {
    const p = pickAt(e);
    if (P.pan) {
      const dx = e.clientX - P.pan.sx, dy = e.clientY - P.pan.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) P.pan.moved = true;
      P.cam.x = P.pan.x - dx / P.cam.zoom; P.cam.z = P.pan.z - dy / P.cam.zoom;
      P.need = true;
      return;
    }
    P.hover = p;
    MT.tools.move(p, evInfo(e));
    MT.emit('cursor', p);
    P.need = true;
  }
  function onUp(e) {
    if (P.pan) {
      P.pan = null;
      P.canvas.classList.remove('panning');
      try { P.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* déjà relâché */ }
      return;
    }
    if (P.active) {
      P.active = false;
      MT.tools.up(pickAt(e), evInfo(e));
      try { P.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* déjà relâché */ }
    }
    P.need = true;
  }
  function onWheel(e) {
    e.preventDefault();
    const r = P.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const before = P.toWorld(sx, sy);
    const k = Math.exp(-clamp(e.deltaY, -200, 200) * 0.0016);
    P.cam.zoom = OWP() ? clamp(P.cam.zoom * k, OWP().ZMIN, OWP().ZMAX) : clamp(P.cam.zoom * k, 3, 140);
    const after = P.toWorld(sx, sy);
    P.cam.x += before.x - after.x; P.cam.z += before.z - after.z;
    P.need = true;
  }
  P.init = (canvas) => {
    P.canvas = canvas;
    P.g = canvas.getContext('2d');
    canvas.tabIndex = 0;
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', () => { if (!P.active) { P.hover = null; MT.tools.move(null, { view: 'plan' }); MT.emit('cursor', null); P.need = true; } });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dblclick', (e) => { const p = pickAt(e); MT.emit('look-at', { x: p.wx, z: p.wz }); });
    MT.on('change', (kind, d) => {
      if (BASE_KINDS.has(kind)) {
        const cells = S.liveCells;
        S.liveCells = null;
        if (d && d.live && cells && cells.length && P.base && (kind === 'grid' || kind === 'layers')) {
          // pendant le geste : seulement les cases touchées et leurs voisines
          const W = S.map.w;
          P.dirty = P.dirty || new Set();
          for (const [x, z] of cells) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (MT.inb(x + dx, z + dz)) P.dirty.add((z + dz) * W + x + dx);
        } else P.baseRev++;
      }
      P.need = true;
    });
    for (const ev of ['selection', 'preview', 'issues', 'tool-opts', 'camera3d']) MT.on(ev, () => { P.need = true; });
    MT.on('tool', () => { P.baseRev++; P.need = true; });
    MT.on('map', () => { P.baseRev++; thumbCache.clear(); requestAnimationFrame(() => P.fit()); });
    MT.on('focus', (f) => { if (f && Number.isFinite(f.x)) P.centerOn(f.x, f.z); });
    MT.on('resized', (dx, dz) => { P.cam.x += dx; P.cam.z += dz; });
    MT.on('level', () => { P.baseRev++; P.need = true; });
  };
  P.frame = () => {
    if (!P.visible || !P.g) return;
    if (P.flash) P.need = true;
    if (!P.need) return;
    P.need = false;
    P.draw();
  };

  /* -------------------------------------------------------------- fond -- */
  function baseMode() { return S.tool === 'paint' ? S.opts.paint.layer : 'tiles'; }
  /* Fond : refait en entier quand la carte change (pièces, portes…), ou seulement les cases
     touchées pendant un coup de pinceau (P.dirty), le reste étant refait à la fin du geste. */
  const ZONE_COLORS = [];
  const zoneFill = (zi) => ZONE_COLORS[zi] || (ZONE_COLORS[zi] = zoneColor(zi, 0.13));
  const patterns = new Map();
  function texPattern(g, id) {
    const key = `${id}@${P.B}`;
    if (patterns.has(key)) return patterns.get(key);
    const t = thumb(id);
    let pat = null;
    if (t) {
      pat = g.createPattern(t, 'repeat');
      if (pat && pat.setTransform) pat.setTransform(new DOMMatrix().scale(P.B / t.width, P.B / t.height));
    }
    patterns.set(key, pat);
    return pat;
  }
  P.dirty = null;
  /* Niveau du dessous (pour le dessiner en transparence dans le vide du niveau affiché). */
  function lowerGrid() {
    const lvs = MT.levels(), i = lvs.indexOf(S.level);
    return i > 0 ? MT.gridOf(lvs[i - 1]) : null;
  }
  function ensureBase() {
    const m = S.map, mode = baseMode(), G = MT.grid();
    const key = `${P.baseRev}|${mode}|${P.showZones}|${m.w}x${m.h}|${S.level}`;
    if (P.base && key === P.baseKey) {
      if (P.dirty && P.dirty.size) { drawCells(P.base.getContext('2d'), [...P.dirty].map((k) => [k % m.w, Math.floor(k / m.w)]), mode); P.dirty = null; }
      return;
    }
    P.baseKey = key;
    P.dirty = null;
    const B = clamp(Math.floor(1800 / Math.max(m.w, m.h)), 5, 16);
    if (B !== P.B) patterns.clear();
    P.B = B;
    if (!P.base) P.base = document.createElement('canvas');
    if (P.base.width !== m.w * B || P.base.height !== m.h * B) { P.base.width = m.w * B; P.base.height = m.h * B; }
    const g = P.base.getContext('2d');
    g.clearRect(0, 0, P.base.width, P.base.height);
    const zoneAt = (x, z) => MT.zoneIndexAt(x, z);
    // passe 1 : couleurs des cases par segments (une couleur par suite de cases identiques)
    for (let z = 0; z < m.h; z++) {
      const row = G[z];
      let x = 0;
      while (x < m.w) {
        const ch = row[x];
        const zi = mode === 'tiles' && ch === '.' && P.showZones ? zoneAt(x, z) : -1;
        let x2 = x + 1;
        while (x2 < m.w && row[x2] === ch && (zi < 0 || zoneAt(x2, z) === zi) && !(zi < 0 && mode === 'tiles' && ch === '.' && P.showZones && zoneAt(x2, z) >= 0)) x2++;
        g.fillStyle = TILE_COLOR[ch] || '#000';
        g.fillRect(x * B, z * B, (x2 - x) * B, B);
        if (zi >= 0) { g.fillStyle = zoneFill(zi); g.fillRect(x * B, z * B, (x2 - x) * B, B); }
        x = x2;
      }
    }
    // niveau du dessous, en transparence, là où ce niveau est vide (pour aligner les murs)
    const low = lowerGrid();
    if (low) {
      for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) {
        if (G[z][x] !== ' ' || low[z][x] === ' ') continue;
        g.fillStyle = hexA(TILE_COLOR[low[z][x]] || '#000000', 0.3);
        g.fillRect(x * B, z * B, B, B);
      }
    }
    // passe 2 : détails (caisses, piliers…) et textures
    const cells = [];
    for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) {
      const ch = G[z][x];
      if (mode === 'tiles' ? 'xPmoD'.includes(ch) : ch !== ' ') cells.push([x, z]);
    }
    drawCells(g, cells, mode, true);
  }
  function drawCells(g, cells, mode, fresh = false) {
    const m = S.map, B = P.B, A = MT.analysis(), G = MT.grid();
    const inside = (x, z) => A.ok(x, z) && (MT.zoneIndexAt(x, z) >= 0 || G[z][x] === 'D');
    const wallLike = (ch) => ch === '#' || ch === 'W' || ch === 'D' || ch === 'P';
    for (const [x, z] of cells) {
      if (x < 0 || z < 0 || x >= m.w || z >= m.h) continue;
      const ch = G[z][x], X = x * B, Z = z * B;
      if (!fresh) {
        g.fillStyle = TILE_COLOR[ch] || '#000';
        g.fillRect(X, Z, B, B);
      }
      if (mode === 'tiles') {
        if (!fresh && ch === '.' && P.showZones) { const zi = MT.zoneIndexAt(x, z); if (zi >= 0) { g.fillStyle = zoneFill(zi); g.fillRect(X, Z, B, B); } }
        decorate(g, ch, X, Z, B);
      } else if (mode === 'floor' || mode === 'ceil') {
        if (inside(x, z) && ch !== 'P') {
          const id = MT.cellTexture(x, z, mode);
          if (id === 'none') drawSky(g, X, Z, B);
          else { const pat = texPattern(g, id); if (pat) { g.fillStyle = pat; g.fillRect(X, Z, B, B); } }
          if (ch !== '.') { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X, Z, B, B); decorate(g, ch, X, Z, B); }
        } else { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(X, Z, B, B); }
      } else if (mode === 'wall') {
        if (ch === 'm') {
          const pat = texPattern(g, MT.cellTexture(x, z, 'wall'));
          if (pat) { g.fillStyle = pat; g.fillRect(X, Z, B, B); }
        } else if (inside(x, z)) {
          g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X, Z, B, B);
          const pat = texPattern(g, MT.cellTexture(x, z, 'wall'));
          const sw = Math.max(2, Math.round(B * 0.32));
          for (const [dx, dz] of DIRS) {
            if (!wallLike(G[z + dz] ? G[z + dz][x + dx] : ' ')) continue;
            const rx = dx === 1 ? X + B - sw : X, rz = dz === 1 ? Z + B - sw : Z;
            if (pat) { g.fillStyle = pat; g.fillRect(rx, rz, dx ? sw : B, dz ? sw : B); }
          }
        } else if (!fresh) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(X, Z, B, B); }
      }
    }
  }
  function drawSky(g, X, Z, B) {
    g.fillStyle = '#16233a'; g.fillRect(X, Z, B, B);
    g.fillStyle = 'rgba(220,230,255,0.75)';
    const r = Math.max(1, B / 10);
    g.fillRect(X + B * 0.22, Z + B * 0.3, r, r); g.fillRect(X + B * 0.68, Z + B * 0.18, r, r); g.fillRect(X + B * 0.5, Z + B * 0.72, r, r);
  }
  function decorate(g, ch, X, Z, B) {
    if (B < 6) return;
    if (ch === 'x') {
      g.strokeStyle = 'rgba(40,24,10,0.8)'; g.lineWidth = Math.max(1, B / 10);
      g.strokeRect(X + B * 0.12, Z + B * 0.12, B * 0.76, B * 0.76);
      g.beginPath(); g.moveTo(X + B * 0.12, Z + B * 0.12); g.lineTo(X + B * 0.88, Z + B * 0.88); g.moveTo(X + B * 0.88, Z + B * 0.12); g.lineTo(X + B * 0.12, Z + B * 0.88); g.stroke();
    } else if (ch === 'P') {
      g.fillStyle = '#4e4741'; g.fillRect(X + B * 0.15, Z + B * 0.15, B * 0.7, B * 0.7);
    } else if (ch === 'm') {
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      g.beginPath();
      for (let k = -1; k < 3; k++) { g.moveTo(X + k * B * 0.4, Z + B); g.lineTo(X + k * B * 0.4 + B, Z); }
      g.save(); g.rect(X, Z, B, B); g.clip(); g.stroke(); g.restore();
    } else if (ch === 'o') {
      g.fillStyle = 'rgba(160,190,110,0.25)';
      g.fillRect(X + B * 0.25, Z + B * 0.3, Math.max(1, B * 0.1), Math.max(1, B * 0.1));
      g.fillRect(X + B * 0.65, Z + B * 0.65, Math.max(1, B * 0.1), Math.max(1, B * 0.1));
    } else if (ch === 'D') {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 3; k++) g.fillRect(X + B * (0.18 + k * 0.25), Z + B * 0.12, Math.max(1, B * 0.1), B * 0.76);
    }
  }

  /* ------------------------------------------------------------ dessin -- */
  P.draw = () => {
    if (OWP()) { OWP().draw(P); return; }
    const g = P.g, m = S.map, Z = P.cam.zoom;
    g.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    g.fillStyle = '#090b0c';
    g.fillRect(0, 0, P.w, P.h);
    if (!m) return;
    ensureBase();
    const [ox, oy] = P.toScreen(0, 0);
    g.imageSmoothingEnabled = Z < P.B;
    g.drawImage(P.base, ox, oy, m.w * Z, m.h * Z);
    g.imageSmoothingEnabled = true;
    const vx0 = Math.max(0, Math.floor(P.toWorld(0, 0).x)), vz0 = Math.max(0, Math.floor(P.toWorld(0, 0).z));
    const vx1 = Math.min(m.w, Math.ceil(P.toWorld(P.w, P.h).x)), vz1 = Math.min(m.h, Math.ceil(P.toWorld(P.w, P.h).z));
    const vis = (x, z, pad = 2) => x >= vx0 - pad && x <= vx1 + pad && z >= vz0 - pad && z <= vz1 + pad;
    // grille
    if (P.showGrid && Z >= 9) {
      g.lineWidth = 1;
      for (const [step, a] of [[1, 0.07], [5, 0.13]]) {
        if (step === 1 && Z < 12) continue;
        g.strokeStyle = `rgba(232,223,200,${a})`;
        g.beginPath();
        for (let x = Math.ceil(vx0 / step) * step; x <= vx1; x += step) { const sx = Math.round(ox + x * Z) + 0.5; g.moveTo(sx, Math.max(oy, 0)); g.lineTo(sx, Math.min(oy + m.h * Z, P.h)); }
        for (let z = Math.ceil(vz0 / step) * step; z <= vz1; z += step) { const sy = Math.round(oy + z * Z) + 0.5; g.moveTo(Math.max(ox, 0), sy); g.lineTo(Math.min(ox + m.w * Z, P.w), sy); }
        g.stroke();
      }
    }
    g.strokeStyle = 'rgba(214,173,87,0.55)'; g.lineWidth = 1.5;
    g.strokeRect(ox - 0.5, oy - 0.5, m.w * Z + 1, m.h * Z + 1);

    const A = MT.analysis();
    drawStairs(g, m);
    drawWindows(g, A, vis);
    drawDoors(g, m, vis);
    if (P.showProps) drawProps(g, m, vis);
    drawElements(g, m, vis);
    if (P.showZones && S.tool !== 'paint') drawZoneLabels(g, m, A);
    drawSelection(g, m);
    drawPreview(g);
    drawIssues(g);
    drawCamera(g);
    if (P.flash) {
      const t = (performance.now() - P.flash.t0) / 1000;
      if (t > 1.4) P.flash = null;
      else {
        const [sx, sy] = P.toScreen(P.flash.x, P.flash.z);
        g.strokeStyle = `rgba(255,214,120,${1 - t / 1.4})`; g.lineWidth = 3;
        g.beginPath(); g.arc(sx, sy, 8 + t * 40, 0, Math.PI * 2); g.stroke();
      }
    }
    if (P.hover && MT.inb(P.hover.x, P.hover.z) && !MT.preview.cells) {
      const [sx, sy] = P.toScreen(P.hover.x, P.hover.z);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
      g.strokeRect(Math.round(sx) + 0.5, Math.round(sy) + 0.5, Math.round(Z) - 1, Math.round(Z) - 1);
    }
  };

  function cellRect(g, x, z, inset = 0) {
    const [sx, sy] = P.toScreen(x + inset, z + inset);
    const s = P.cam.zoom * (1 - inset * 2);
    return [sx, sy, s, s];
  }
  function label(g, text, sx, sy, { size = 12, color = '#e8dfc8', bg = 'rgba(7,9,10,0.72)', font = 'Barlow Condensed', weight = 600, align = 'center' } = {}) {
    g.font = `${weight} ${size}px "${font}", "Arial Narrow", sans-serif`;
    const w = g.measureText(text).width;
    const x = align === 'center' ? sx - w / 2 : sx;
    if (bg) { g.fillStyle = bg; g.fillRect(x - 3, sy - size * 0.62 - 2, w + 6, size + 4); }
    g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(text, x, sy);
  }
  function arrow(g, sx, sy, dx, dz, len, color, width = 2) {
    const ex = sx + dx * len, ey = sy + dz * len;
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    const a = Math.atan2(dz, dx), hl = Math.max(4, len * 0.45);
    g.beginPath(); g.moveTo(ex + Math.cos(a) * 2, ey + Math.sin(a) * 2);
    g.lineTo(ex - Math.cos(a - 0.5) * hl, ey - Math.sin(a - 0.5) * hl);
    g.lineTo(ex - Math.cos(a + 0.5) * hl, ey - Math.sin(a + 0.5) * hl);
    g.closePath(); g.fill();
  }

  /* Escaliers du niveau affiché (marches, sens de la montée) et trémies des escaliers du
     dessous (le vide où arrive un escalier qui monte de l'étage inférieur). */
  function drawStair(g, st, { ghost = false } = {}) {
    const plan = ZS.stairPlan(st), Z = P.cam.zoom, col = STAIR_COLOR[st.mat] || '#999999';
    for (const c of plan.cells) {
      const [sx, sy] = P.toScreen(c.x, c.z);
      g.fillStyle = hexA(col, ghost ? 0.5 : 0.92);
      g.fillRect(sx, sy, Z, Z);
      // plus clair en montant
      g.fillStyle = `rgba(255,255,255,${(0.32 * (c.h0 + c.h1)) / 2})`;
      g.fillRect(sx, sy, Z, Z);
      if (Z >= 9) {
        g.strokeStyle = 'rgba(20,14,8,0.55)'; g.lineWidth = 1;
        g.beginPath();
        if (c.kind === 'ramp') {
          // nez de marche : traits en travers de la montée
          const [dx, dz] = c.din;
          for (const t of [0.25, 0.5, 0.75]) {
            if (dx) { const X = sx + (dx > 0 ? t : 1 - t) * Z; g.moveTo(X, sy); g.lineTo(X, sy + Z); }
            else { const Y = sy + (dz > 0 ? t : 1 - t) * Z; g.moveTo(sx, Y); g.lineTo(sx + Z, Y); }
          }
        } else if (c.kind === 'turn') {
          // marches dansantes : rayons depuis le coin intérieur
          const px = c.x + 0.5 + (c.dout[0] - c.din[0]) * 0.5, pz = c.z + 0.5 + (c.dout[1] - c.din[1]) * 0.5;
          const [qx, qy] = P.toScreen(px, pz);
          for (const a of [1, 2, 3]) {
            const ang = (a / 4) * (Math.PI / 2);
            const u = [-c.dout[0], -c.dout[1]], v = c.din;
            const ex = Math.cos(ang) * u[0] + Math.sin(ang) * v[0], ez = Math.cos(ang) * u[1] + Math.sin(ang) * v[1];
            const L = Math.min(1 / Math.max(Math.abs(Math.cos(ang)), 1e-3), 1 / Math.max(Math.abs(Math.sin(ang)), 1e-3));
            g.moveTo(qx, qy); g.lineTo(qx + ex * L * Z, qy + ez * L * Z);
          }
        }
        g.stroke();
      }
    }
    for (const [x, z] of plan.core) { const [sx, sy] = P.toScreen(x + 0.15, z + 0.15); g.fillStyle = '#3d3833'; g.fillRect(sx, sy, Z * 0.7, Z * 0.7); }
    // parcours de la montée
    if (Z >= 6) {
      const pts = plan.cells.map((c) => P.toScreen(c.x + 0.5, c.z + 0.5));
      g.strokeStyle = ghost ? 'rgba(255,230,170,0.9)' : 'rgba(255,240,200,0.85)'; g.lineWidth = Math.max(1.5, Z * 0.06);
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      const last = plan.cells[plan.cells.length - 1], [lx, ly] = pts[pts.length - 1];
      arrow(g, lx, ly, last.dout[0], last.dout[1], Math.max(6, Z * 0.42), ghost ? 'rgba(255,230,170,0.95)' : '#fff0c8', Math.max(1.5, Z * 0.06));
      if (Z >= 14) {
        const ex = plan.exits[0], [tx, ty] = P.toScreen(ex[0] + 0.5, ex[1] + 0.5);
        label(g, `↑ ${MT.levelName((st.lv | 0) + 1)}`, tx, ty, { size: 11, color: '#ffe7b0' });
      }
    }
  }
  function drawStairs(g, m) {
    const Z = P.cam.zoom;
    for (const st of m.stairs || []) {
      const lv = st.lv | 0;
      if (lv === S.level) drawStair(g, st);
      else if (lv + 1 === S.level) {
        // trémie : on voit l'escalier qui arrive d'en dessous
        g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,214,140,0.75)'; g.lineWidth = 1.2;
        for (const [x, z] of MT.openingsOf(st)) { const [sx, sy] = P.toScreen(x, z); g.strokeRect(sx + 1.5, sy + 1.5, Z - 3, Z - 3); }
        g.setLineDash([]);
        const plan = ZS.stairPlan(st), last = plan.cells[plan.cells.length - 1];
        for (const ex of plan.exits) {
          const [sx, sy] = P.toScreen(ex[0] + 0.5 - last.dout[0] * 0.3, ex[1] + 0.5 - last.dout[1] * 0.3);
          arrow(g, sx, sy, -last.dout[0], -last.dout[1], Math.max(5, Z * 0.35), 'rgba(255,214,140,0.9)', 1.5);
        }
        if (Z >= 14) { const ex = plan.exits[0], [tx, ty] = P.toScreen(ex[0] + 0.5, ex[1] + 0.5); label(g, `↓ ${MT.levelName(lv)}`, tx, ty + Z * 0.55, { size: 11, color: '#ffd68c' }); }
      }
    }
  }
  function drawWindows(g, A, vis) {
    const Z = P.cam.zoom;
    if (Z < 5) return;
    for (const w of A.windows) {
      if ((w.lv | 0) !== S.level || !vis(w.x, w.z)) continue;
      const [sx, sy] = P.toScreen(w.x + 0.5, w.z + 0.5);
      g.strokeStyle = '#3a2410'; g.lineWidth = Math.max(1, Z * 0.09);
      for (const k of [-0.25, 0, 0.25]) {
        g.beginPath();
        if (w.nx) { g.moveTo(sx - Z * 0.35, sy + k * Z); g.lineTo(sx + Z * 0.35, sy + k * Z - Z * 0.08); } else { g.moveTo(sx + k * Z, sy - Z * 0.35); g.lineTo(sx + k * Z + Z * 0.08, sy + Z * 0.35); }
        g.stroke();
      }
      if (Z >= 14) arrow(g, sx + w.nx * Z * 0.6, sy + w.nz * Z * 0.6, -w.nx, -w.nz, Z * 0.35, 'rgba(141,255,116,0.55)', 1.5);
    }
  }
  function drawDoors(g, m, vis) {
    const Z = P.cam.zoom;
    m.doors.forEach((d) => {
      if (!MT.here(d)) return;
      let cx = 0, cz = 0;
      for (const [x, z] of d.cells) { cx += x + 0.5; cz += z + 0.5; }
      cx /= d.cells.length; cz /= d.cells.length;
      if (!vis(cx, cz)) return;
      for (const [x, z] of d.cells) {
        const [sx, sy, s] = cellRect(g, x, z, 0.08);
        g.fillStyle = DOOR_COLOR[d.type] || DOOR_COLOR.door; g.fillRect(sx, sy, s, s);
      }
      if (Z >= 12) { const [sx, sy] = P.toScreen(cx, cz); label(g, `${d.cost}`, sx, sy, { size: clamp(Z * 0.5, 10, 15), color: '#ffd9a0' }); }
    });
  }
  function drawProps(g, m, vis) {
    const Z = P.cam.zoom;
    const sel = new Set(MT.selectedProps());
    m.props.forEach((pr, i) => {
      if (!MT.here(pr) || !vis(pr.x, pr.z, 4)) return;
      const def = ZS.MODELS[pr.m];
      const cat = def ? def.cat : 'import';
      const pts = MT.propCorners(pr).map(([x, z]) => P.toScreen(x, z));
      g.beginPath();
      pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      const decal = def && def.decal;
      g.fillStyle = decal ? 'rgba(177,72,72,0.22)' : hexA(CAT_COLOR[cat] || '#888', def ? 0.72 : 0.3);
      g.fill();
      g.setLineDash(decal ? [3, 3] : []);
      g.strokeStyle = sel.has(i) ? '#ffd27a' : decal ? 'rgba(220,120,120,0.8)' : 'rgba(10,8,6,0.85)';
      g.lineWidth = sel.has(i) ? 2 : 1;
      g.stroke();
      g.setLineDash([]);
      if (!def && Z >= 10) { const [sx, sy] = P.toScreen(pr.x, pr.z); label(g, '?', sx, sy, { size: 12, color: '#ff8080' }); }
      if ((sel.has(i) || Z >= 30) && def) {
        // avant de l'objet
        const r = pr.r || 0, [sx, sy] = P.toScreen(pr.x, pr.z);
        arrow(g, sx, sy, Math.sin(r), Math.cos(r), Math.min(18, Z * 0.4), sel.has(i) ? '#ffd27a' : 'rgba(255,255,255,0.35)', 1.5);
      }
      if (sel.has(i) && (pr.y || 0) > 0.05 && Z >= 14) { const [sx, sy] = P.toScreen(pr.x, pr.z); label(g, `↑${pr.y.toFixed(2)} m`, sx, sy - 14, { size: 11 }); }
    });
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function drawElements(g, m, vis) {
    const Z = P.cam.zoom, small = Z < 10;
    const H = MT.here;
    // apparitions au sol
    for (const rs of m.risers) {
      const [x, z] = rs;
      if (!H(rs) || !vis(x, z)) continue;
      const [sx, sy] = P.toScreen(x + 0.5, z + 0.5), r = Math.max(3, Z * 0.3);
      g.fillStyle = 'rgba(70,160,60,0.85)'; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
      if (!small) { g.strokeStyle = '#0c1a08'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx - r * 0.45, sy + r * 0.2); g.lineTo(sx, sy - r * 0.35); g.lineTo(sx + r * 0.45, sy + r * 0.2); g.stroke(); }
    }
    // distributeurs d'atouts
    for (const p of m.perks) {
      if (!H(p) || !vis(p.cell[0], p.cell[1])) continue;
      const def = ZS.PERKS[p.p], [sx, sy, s] = cellRect(g, p.cell[0], p.cell[1], 0.1);
      g.fillStyle = def.color; g.fillRect(sx, sy, s, s);
      g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1; g.strokeRect(sx + 0.5, sy + 0.5, s - 1, s - 1);
      if (!small) {
        label(g, def.glyph, sx + s / 2, sy + s / 2, { size: clamp(Z * 0.55, 9, 18), bg: null, color: '#fff', weight: 700 });
        const [cx, cy] = P.toScreen(p.cell[0] + 0.5 + p.face[0] * 0.5, p.cell[1] + 0.5 + p.face[1] * 0.5);
        arrow(g, cx, cy, p.face[0], p.face[1], Math.max(4, Z * 0.25), '#fff', 1.5);
      }
    }
    // emplacements de la boîte mystère
    m.boxes.forEach((b, i) => {
      if (!H(b)) return;
      const x0 = Math.min(b.cells[0][0], b.cells[1][0]), z0 = Math.min(b.cells[0][1], b.cells[1][1]);
      const w = b.cells[0][0] === b.cells[1][0] ? 1 : 2, hgt = w === 1 ? 2 : 1;
      if (!vis(x0, z0)) return;
      const [sx, sy] = P.toScreen(x0 + 0.1, z0 + 0.1);
      g.fillStyle = i === m.boxStart ? '#2f6fc8' : 'rgba(47,111,200,0.55)';
      g.fillRect(sx, sy, (w - 0.2) * Z, (hgt - 0.2) * Z);
      g.strokeStyle = i === m.boxStart ? '#9fd0ff' : 'rgba(159,208,255,0.6)'; g.lineWidth = 1.5;
      g.strokeRect(sx, sy, (w - 0.2) * Z, (hgt - 0.2) * Z);
      if (!small) {
        const [cx, cy] = P.toScreen(x0 + w / 2, z0 + hgt / 2);
        label(g, i === m.boxStart ? '?★' : '?', cx, cy, { size: clamp(Z * 0.55, 10, 20), bg: null, color: '#e8f2ff', weight: 700 });
        const [fx, fy] = P.toScreen(x0 + w / 2 + b.face[0] * (w / 2), z0 + hgt / 2 + b.face[1] * (hgt / 2));
        arrow(g, fx, fy, b.face[0], b.face[1], Math.max(4, Z * 0.25), '#9fd0ff', 1.5);
      }
    });
    if (m.amp && H(m.amp)) {
      const b = m.amp, x0 = Math.min(b.cells[0][0], b.cells[1][0]), z0 = Math.min(b.cells[0][1], b.cells[1][1]);
      const w = b.cells[0][0] === b.cells[1][0] ? 1 : 2, hgt = w === 1 ? 2 : 1;
      const [sx, sy] = P.toScreen(x0 + 0.1, z0 + 0.1);
      g.fillStyle = '#6a2fb0'; g.fillRect(sx, sy, (w - 0.2) * Z, (hgt - 0.2) * Z);
      if (!small) {
        const [cx, cy] = P.toScreen(x0 + w / 2, z0 + hgt / 2);
        label(g, 'AMP', cx, cy, { size: clamp(Z * 0.4, 9, 15), bg: null, color: '#f0dcff', weight: 700 });
        const [fx, fy] = P.toScreen(x0 + w / 2 + b.face[0] * (w / 2), z0 + hgt / 2 + b.face[1] * (hgt / 2));
        arrow(g, fx, fy, b.face[0], b.face[1], Math.max(4, Z * 0.25), '#e0c0ff', 1.5);
      }
    }
    // armes murales, interrupteur
    const onWall = (cell, n, fill, text, tcol) => {
      const [x, z] = cell;
      if (!vis(x, z)) return;
      const cx = x + 0.5 + n[0] * 0.32, cz = z + 0.5 + n[1] * 0.32;
      const hw = n[0] ? 0.16 : 0.42, hd = n[0] ? 0.42 : 0.16;
      const [sx, sy] = P.toScreen(cx - hw, cz - hd);
      g.fillStyle = fill; g.fillRect(sx, sy, hw * 2 * Z, hd * 2 * Z);
      if (text && Z >= 16) { const [lx, ly] = P.toScreen(x + 0.5 + n[0] * 0.95, z + 0.5 + n[1] * 0.95); label(g, text, lx, ly, { size: 11, color: tcol }); }
    };
    for (const w of m.wallbuys) {
      if (!H(w)) continue;
      const def = ZS.WEAPONS[w.w];
      onWall(w.cell, w.n, 'rgba(240,236,220,0.92)', `${def.name} · ${ZS.wallbuyPrice(w)}`, '#f3ead2');
    }
    if (m.power && H(m.power)) onWall(m.power.cell, m.power.n, '#e8c22a', 'Courant', '#ffe58a');
    if (m.digipass && H(m.digipass)) onWall(m.digipass.cell, m.digipass.n, '#5d6366', 'Digi pass', '#cfd6da');
    // panneaux
    for (const s of m.signs) {
      const [x, z] = MT.signCell(s);
      if (!H(s) || !vis(x, z)) continue;
      const along = s.n[0] ? [0, 1] : [1, 0];
      const a = P.toScreen(s.pos[0] - along[0] * 0.85 + s.n[0] * 0.04, s.pos[2] - along[1] * 0.85 + s.n[1] * 0.04);
      const b = P.toScreen(s.pos[0] + along[0] * 0.85 + s.n[0] * 0.04, s.pos[2] + along[1] * 0.85 + s.n[1] * 0.04);
      g.strokeStyle = 'rgba(232,223,200,0.9)'; g.lineWidth = Math.max(2, Z * 0.12);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      if (Z >= 14) { const [lx, ly] = P.toScreen(s.pos[0] + s.n[0] * 0.55, s.pos[2] + s.n[1] * 0.55); label(g, s.text, lx, ly, { size: 11, font: 'Special Elite', weight: 400 }); }
    }
    // lumières
    m.lights.forEach((l) => {
      if (!H(l) || !vis(l.pos[0], l.pos[2])) return;
      const [sx, sy] = P.toScreen(l.pos[0], l.pos[2]), r = clamp(Z * 0.22, 3.5, 9);
      const col = ZS.colorHex(l.color);
      g.fillStyle = col; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1.5; g.stroke();
      if (l.powered !== undefined && l.powered !== null) {
        g.fillStyle = ZS.colorHex(l.powered);
        g.beginPath(); g.arc(sx, sy, r * 0.5, 0, Math.PI * 2); g.fill();
      }
    });
    // départ
    if (!H(m.spawn)) return;
    const sp = m.spawn, [sx, sy] = P.toScreen(sp.pos[0], sp.pos[1]), r = clamp(Z * 0.32, 5, 12);
    g.fillStyle = '#2fa84a'; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#0b2410'; g.lineWidth = 1.5; g.stroke();
    arrow(g, sx, sy, -Math.sin(sp.yaw), -Math.cos(sp.yaw), r * 1.9, '#8dff74', 2);
    if (Z >= 12) label(g, 'DÉPART', sx, sy + r + 10, { size: 11, color: '#8dff74' });
  }
  function drawZoneLabels(g, m, A) {
    const Z = P.cam.zoom;
    if (Z < 6) return;
    const acc = A.zones.map(() => ({ x: 0, z: 0, n: 0 }));
    for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) { const zi = MT.zoneIndexAt(x, z); if (zi >= 0) { const a = acc[zi]; a.x += x + 0.5; a.z += z + 0.5; a.n++; } }
    A.zones.forEach((zone, i) => {
      const a = acc[i];
      if (!a.n || a.n < 2) return;
      const [sx, sy] = P.toScreen(a.x / a.n, a.z / a.n);
      if (sx < -80 || sy < -20 || sx > P.w + 80 || sy > P.h + 20) return;
      label(g, zone.auto ? `${zone.name} (sans nom)` : zone.name, sx, sy, { size: clamp(Z * 0.55, 11, 17), color: zone.auto ? 'rgba(232,223,200,0.55)' : '#f0e6cc', bg: 'rgba(7,9,10,0.55)', font: 'Special Elite', weight: 400 });
    });
  }
  function drawSelection(g, m) {
    const s = S.sel, Z = P.cam.zoom;
    if (!s) return;
    g.strokeStyle = '#ffd27a'; g.lineWidth = 2;
    const box = (x0, z0, w, hh) => { const [sx, sy] = P.toScreen(x0, z0); g.strokeRect(sx - 1, sy - 1, w * Z + 2, hh * Z + 2); };
    switch (s.kind) {
      case 'light': {
        const l = m.lights[s.i];
        if (!l) return;
        const [sx, sy] = P.toScreen(l.pos[0], l.pos[2]);
        g.beginPath(); g.arc(sx, sy, clamp(Z * 0.22, 3.5, 9) + 4, 0, Math.PI * 2); g.stroke();
        g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255,210,122,0.5)';
        g.beginPath(); g.arc(sx, sy, l.range * Z * 0.5, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        break;
      }
      case 'perk': { const p = m.perks[s.i]; if (p) box(p.cell[0], p.cell[1], 1, 1); break; }
      case 'riser': { const r = m.risers[s.i]; if (r) box(r[0], r[1], 1, 1); break; }
      case 'wallbuy': { const w = m.wallbuys[s.i]; if (w) box(w.cell[0], w.cell[1], 1, 1); break; }
      case 'power': if (m.power) box(m.power.cell[0], m.power.cell[1], 1, 1); break;
      case 'sign': { const sg = m.signs[s.i]; if (sg) { const [x, z] = MT.signCell(sg); box(x, z, 1, 1); } break; }
      case 'box': case 'amp': {
        const b = s.kind === 'box' ? m.boxes[s.i] : m.amp;
        if (b) box(Math.min(b.cells[0][0], b.cells[1][0]), Math.min(b.cells[0][1], b.cells[1][1]), b.cells[0][0] === b.cells[1][0] ? 1 : 2, b.cells[0][0] === b.cells[1][0] ? 2 : 1);
        break;
      }
      case 'door': { const d = m.doors[s.i]; if (d) for (const [x, z] of d.cells) box(x, z, 1, 1); break; }
      case 'spawn': { const [sx, sy] = P.toScreen(m.spawn.pos[0], m.spawn.pos[1]); g.beginPath(); g.arc(sx, sy, clamp(Z * 0.32, 5, 12) + 4, 0, Math.PI * 2); g.stroke(); break; }
      case 'cell': box(s.x, s.z, 1, 1); break;
      case 'stair': {
        const st = (m.stairs || [])[s.i];
        if (!st) return;
        for (const [x, z] of ZS.stairPlan(st).footprint) box(x, z, 1, 1);
        break;
      }
      case 'zone': {
        const def = m.zones[s.i];
        if (!def || !MT.here(def)) return;
        const zi = MT.zoneIndexAt(def.seed[0], def.seed[1]);
        if (zi < 0) return;
        g.fillStyle = 'rgba(255,210,122,0.16)';
        for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) if (MT.zoneIndexAt(x, z) === zi) { const [sx, sy] = P.toScreen(x, z); g.fillRect(sx, sy, Z, Z); }
        const [sx, sy] = P.toScreen(def.seed[0] + 0.5, def.seed[1] + 0.5);
        g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(sx, sy - 6); g.lineTo(sx + 6, sy); g.lineTo(sx, sy + 6); g.lineTo(sx - 6, sy); g.closePath(); g.fill();
        break;
      }
      default: break;
    }
  }
  function drawPreview(g) {
    const pv = MT.preview, Z = P.cam.zoom;
    if (pv.cells && pv.cells.length) {
      g.fillStyle = pv.tone === 'erase' ? 'rgba(226,49,58,0.38)' : pv.tone === 'element' ? 'rgba(120,200,255,0.35)' : 'rgba(214,173,87,0.38)';
      g.strokeStyle = pv.tone === 'erase' ? 'rgba(255,120,120,0.9)' : 'rgba(255,230,170,0.85)';
      g.lineWidth = 1;
      for (const [x, z] of pv.cells) {
        if (!MT.inb(x, z)) continue;
        const [sx, sy] = P.toScreen(x, z);
        g.fillRect(sx, sy, Z, Z);
        if (pv.cells.length < 400) g.strokeRect(Math.round(sx) + 0.5, Math.round(sy) + 0.5, Math.round(Z) - 1, Math.round(Z) - 1);
      }
      if (S.tool === 'build' && MT.tools.drag && MT.tools.drag.a && MT.tools.drag.b && Z >= 8) {
        const d = MT.tools.drag, w = Math.abs(d.b[0] - d.a[0]) + 1, hh = Math.abs(d.b[1] - d.a[1]) + 1;
        const [sx, sy] = P.toScreen(Math.max(d.a[0], d.b[0]) + 1, Math.max(d.a[1], d.b[1]) + 1);
        label(g, `${w} × ${hh}`, sx + 18, sy + 10, { size: 12, color: '#ffd27a' });
      }
    }
    if (pv.rect) {
      const [ax, ay] = P.toScreen(pv.rect.a[0], pv.rect.a[1]), [bx, by] = P.toScreen(pv.rect.b[0], pv.rect.b[1]);
      g.setLineDash([5, 4]); g.strokeStyle = '#ffd27a'; g.lineWidth = 1.2;
      g.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,210,122,0.08)'; g.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    }
    if (pv.stair && S.tool === 'stairs') drawStair(g, pv.stair, { ghost: true });
    if (pv.ghost && S.tool === 'props') {
      const pts = MT.propCorners(pv.ghost).map(([x, z]) => P.toScreen(x, z));
      g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      g.fillStyle = 'rgba(214,173,87,0.25)'; g.fill();
      g.setLineDash([4, 3]); g.strokeStyle = '#ffd27a'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
      const [sx, sy] = P.toScreen(pv.ghost.x, pv.ghost.z);
      arrow(g, sx, sy, Math.sin(pv.ghost.r || 0), Math.cos(pv.ghost.r || 0), Math.min(18, Z * 0.45), '#ffd27a', 1.5);
    }
  }
  function drawIssues(g) {
    const Z = P.cam.zoom;
    const all = [...S.issues.errors.map((e) => [e, '#ff4a4a']), ...S.issues.warnings.map((e) => [e, '#f0b23a'])];
    for (const [e, col] of all) {
      if (!e.at || (e.at[2] | 0) !== S.level) continue;
      const [sx, sy] = P.toScreen(e.at[0] + 0.5, e.at[1] + 0.5), r = clamp(Z * 0.55, 7, 16);
      g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.stroke();
      if (Z >= 8) label(g, '!', sx + r * 0.75, sy - r * 0.75, { size: 11, color: '#0b0b0b', bg: col, weight: 700 });
    }
  }
  function drawCamera(g) {
    const V = MT.v3;
    if (!V || !V.visible || !V.cam) return;
    const [sx, sy] = P.toScreen(V.cam.position.x, V.cam.position.z);
    const yaw = V.yaw, fov = 0.55, len = 26;
    g.fillStyle = 'rgba(141,255,116,0.16)';
    g.beginPath(); g.moveTo(sx, sy);
    g.lineTo(sx - Math.sin(yaw - fov) * len, sy - Math.cos(yaw - fov) * len);
    g.lineTo(sx - Math.sin(yaw + fov) * len, sy - Math.cos(yaw + fov) * len);
    g.closePath(); g.fill();
    g.fillStyle = '#8dff74'; g.beginPath(); g.arc(sx, sy, 3.5, 0, Math.PI * 2); g.fill();
  }
})();
