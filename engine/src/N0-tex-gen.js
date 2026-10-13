/* =====================================================================================================
   Jeu 2.0.4 : générateurs de la grande bibliothèque de textures (demande d'Anthony du 12 octobre 2026 :
   « autant de textures que tu pourrais me créer, de toute sorte »). Ils complètent ceux du jeu 1.x
   (tgBrick, tgTiles, tgPlanks…) : dalles irrégulières, bâtons rompus, point de Hongrie, hexagones,
   terrazzo, bardeaux, chaume, tissus et tartans, science-fiction, circuits, ventilations, tôle perforée,
   métal brossé, pavés de verre, lumières, strates, écorce, feuillage, lierre, sacs de sable, grillage,
   claustras, glace, camouflage, ossuaire, livres, tuyauteries, bûches, OSB, contreplaqué, liège,
   carton, mousse acoustique, bâche, caustiques, résine, granulés, graffitis, paroi organique, cuivre
   patiné, cabochons, carreaux de ciment, bac acier, caissons, marquages routiers.
   Mêmes règles que les autres : raccordables (la texture se répète sans couture), tailles relatives à la
   largeur (la vignette ressemble à la texture du jeu), aléa reproductible (R). Cinquième argument G :
   le canal de lumière propre (textures lumineuses, jeu 2.0.4), absent pour les vignettes ; dessiner
   dedans ne doit jamais tirer de nombre au hasard (la couleur serait différente avec ou sans).
   ===================================================================================================== */
const gxFr = (v) => v - Math.floor(v);
const gxMod = (a, n) => ((a % n) + n) % n;
/* Hachage de deux entiers et d'une graine → [0, 1). */
function gxH(a, b, s) {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x3c6ef372, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const gxSeed = (R) => (R() * 2147483647) | 0;
const gxPick = (R, a) => a[(R() * a.length) | 0];

/* Peint pixel par pixel la couleur c et, si G est donné, la lumière propre e (noire par défaut). */
function gxPaint(g, G, w, h, fn) {
  const img = g.createImageData(w, h), d = img.data;
  const lim = G ? G.createImageData(w, h) : null, L = lim ? lim.data : null;
  const c = [0, 0, 0], e = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      e[0] = 0; e[1] = 0; e[2] = 0;
      fn(x, y, c, e);
      const p = (y * w + x) * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      if (L) { L[p] = e[0]; L[p + 1] = e[1]; L[p + 2] = e[2]; L[p + 3] = 255; }
    }
  }
  g.putImageData(img, 0, 0);
  if (G) G.putImageData(lim, 0, 0);
}
/* Dessin dans la couleur et dans la lumière (même tracé, sans tirage au hasard). */
function gxBoth(g, G, fn) { fn(g); if (G) fn(G); }

/* Cellules de Voronoï raccordables (un point par case d'une grille nx × ny, décalé au hasard).
   at(u, v) en cases : id (case du point le plus proche), d1, d2, e (distance au bord de la cellule). */
function gxCells(nx, ny, R, jit = 0.9) {
  const n = nx * ny, px = new Float32Array(n), py = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = 0.5 + (R() - 0.5) * jit; py[i] = 0.5 + (R() - 0.5) * jit; }
  const q = { id: 0, id2: 0, d1: 0, d2: 0, e: 0, dx: 0, dy: 0 };
  q.at = (u, v) => {
    const ci = Math.floor(u), cj = Math.floor(v);
    let d1 = 1e9, d2 = 1e9, id = 0, id2 = 0, ax = 0, ay = 0, bx = 0, by = 0;
    for (let dj = -1; dj <= 1; dj++) {
      const j = cj + dj, row = gxMod(j, ny) * nx;
      for (let di = -1; di <= 1; di++) {
        const i = ci + di, k = row + gxMod(i, nx);
        const dx = i + px[k] - u, dy = j + py[k] - v, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; id2 = id; bx = ax; by = ay; d1 = d; id = k; ax = dx; ay = dy; } else if (d < d2) { d2 = d; id2 = k; bx = dx; by = dy; }
      }
    }
    const L = Math.hypot(bx - ax, by - ay) || 1;
    q.d1 = Math.sqrt(d1); q.d2 = Math.sqrt(d2); q.id = id; q.id2 = id2; q.dx = ax; q.dy = ay;
    q.e = (d2 - d1) / (2 * L);                    // distance à la médiatrice (largeur de joint régulière)
    return q;
  };
  return q;
}
/* Relief : éclairage d'un champ de hauteurs raccordable, lumière en haut à gauche. */
function gxEmboss(H, w, h, s) {
  const out = new Float32Array(w * h), k = s * (w / 512);
  for (let y = 0; y < h; y++) {
    const y0 = ((y - 1 + h) % h) * w, y1 = ((y + 1) % h) * w, yr = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = (x - 1 + w) % w, x1 = (x + 1) % w;
      out[yr + x] = clamp(1 - (H[yr + x1] - H[yr + x0] + H[y1 + x] - H[y0 + x]) * k * 22, 0.45, 1.55);
    }
  }
  return out;
}
/* Patine verte du cuivre (vert-de-gris), comme la rouille. */
function gxPatina(g, w, h, R, amount) {
  if (!amount) return;
  const n = vnoise(w, h, [[5, 5, 1], [20, 20, 0.6], [80, 80, 0.35]], 2.2, R);
  const f = vnoise(w, h, [[48, 48, 1], [128, 128, 0.7]], 1.8, R);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    const m = clamp((n[i] - (1 - amount * 0.75)) * 2.6, 0, 1) * (0.55 + 0.45 * f[i]);
    if (m <= 0.02) continue;
    const v = 0.7 + 0.45 * n[i];
    d[i * 4] = lerp(d[i * 4], 70 * v, m); d[i * 4 + 1] = lerp(d[i * 4 + 1], 150 * v, m); d[i * 4 + 2] = lerp(d[i * 4 + 2], 128 * v, m);
  }
  g.putImageData(img, 0, 0);
}
const gxFinish = (g, w, h, R, o, gr) => { grime(g, w, h, R, gr); overlay(g, w, h, R, o); };

/* ------------------------------------------------- dalles irrégulières, cellules -- */
/* Dalles et pierres de forme libre (opus incertum), boue craquelée, cuir, vitrail, lave.
   cells : cellules sur la largeur ; jw : joint (en cellules) ; hot : joints incandescents (lave) ;
   glass : vitrail (plomb noir, centre plus clair, lumière propre). */
function gxFlags(o) {
  return (g, w, h, R, G) => {
    const nx = o.cells || 6, ny = Math.max(1, Math.round((nx * h) / w));
    const V = gxCells(nx, ny, R, o.jit === undefined ? 0.92 : o.jit);
    const vr = o.var === undefined ? 0.16 : o.var, cols = [];
    for (let i = 0; i < nx * ny; i++) cols.push(shadec(gxPick(R, o.colors), 1 - vr + R() * 2 * vr));
    const n = vnoise(w, h, o.noise || [[6, 6, 1], [24, 24, 0.5], [96, 96, 0.3]], 1.8, R);
    const jc = o.joint || [52, 48, 42], jw = o.jw === undefined ? 0.05 : o.jw, bev = o.bevel === undefined ? 0.1 : o.bevel;
    const flat = !!o.flat, glass = !!o.glass, hot = !!o.hot;
    gxPaint(g, G, w, h, (x, y, c, e) => {
      const q = V.at((x / w) * nx, (y / h) * ny), v = n[y * w + x];
      if (q.e < jw) {
        if (hot) {
          const t = 1 - q.e / jw, k = 0.65 + 0.35 * t;
          c[0] = 255 * k; c[1] = (70 + 150 * t * t) * k; c[2] = (10 + 40 * t * t * t) * k;
          e[0] = c[0]; e[1] = c[1]; e[2] = c[2];
          return;
        }
        const k = 0.75 + 0.4 * v;
        c[0] = jc[0] * k; c[1] = jc[1] * k; c[2] = jc[2] * k;
        return;
      }
      const b = cols[q.id];
      let k = flat ? 0.92 + 0.12 * v : 0.76 + 0.38 * v;
      if (bev > 0 && q.e < jw + bev) k *= 0.72 + 0.28 * ((q.e - jw) / bev);
      if (glass) k *= 0.8 + 0.4 * clamp(1 - q.d1 * 1.3, 0, 1);
      if (hot) { const t = clamp(1 - (q.e - jw) / 0.12, 0, 1); k *= 1 + t * 0.9; if (t > 0) { e[0] = 120 * t; e[1] = 30 * t; } }
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
      if (glass) { e[0] = c[0] * 0.9; e[1] = c[1] * 0.9; e[2] = c[2] * 0.9; }
    });
    if (o.cracks) for (let i = 0; i < o.cracks; i++) crackR(g, w, h, R, R() * w, R() * h, 4 + ((R() * 8) | 0), (5 * w) / 512, w / 512, 'rgba(20,18,15,0.55)');
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 4 : o.stains, specks: o.specks === undefined ? 120 : o.specks, dark: o.dark || [24, 18, 10] });
  };
}

/* ------------------------------------------------------- parquets à motif -- */
/* Bâtons rompus : planches de n largeurs de long à 45°, k motifs par côté (texture carrée). */
function gxHerring(o) {
  return (g, w, h, R) => {
    const n = o.n || 4, kk = o.k || 4, s = gxSeed(R), P = 2 * n * kk;
    const cw = w / (Math.SQRT2 * n * kk), pal = o.colors, gap = o.gap === undefined ? 0.035 : o.gap;
    const nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.25]], 1.6, R);
    const sh = o.shade === undefined ? 0.24 : o.shade, jk = o.jointK === undefined ? 0.42 : o.jointK, gr = o.grain === undefined ? 1 : o.grain;
    gxPaint(g, null, w, h, (x, y, c) => {
      const u = (x + y) / (Math.SQRT2 * cw), v = (y - x) / (Math.SQRT2 * cw);
      const i = Math.floor(u), j = Math.floor(v), t = gxMod(i - j, 2 * n);
      let a, b, along, across, hz;
      if (t < n) { a = i - t; b = j; along = u - a; across = v - j; hz = 1; } else { const r0 = j - (n - 1 - (t - n)); a = i; b = r0; along = v - r0; across = u - i; hz = 0; }
      const pa = gxMod(a + b, P), pb = gxMod(a - b, P) * 2 + hz;
      const h1 = gxH(pa, pb, s), h2 = gxH(pa + 911, pb, s);
      const base = pal[(h1 * pal.length) | 0];
      const grain = 0.5 + 0.5 * Math.sin(across * (8 + h2 * 9) + along * 0.5 + h1 * 40 + Math.sin(along * 1.7 + h2 * 9) * 0.9);
      let k = (1 - sh / 2 + sh * h2) * (1 - 0.2 * gr + 0.2 * gr * grain) * (0.88 + 0.22 * nz[y * w + x]);
      if (across < gap || across > 1 - gap || along < gap * 1.2 || along > n - gap * 1.2) k *= jk;
      c[0] = base[0] * k; c[1] = base[1] * k; c[2] = base[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 60, dark: o.dark || [22, 16, 10] });
  };
}
/* Point de Hongrie : colonnes de lames coupées à 45°, en chevrons (cols pair). */
function gxChevron(o) {
  return (g, w, h, R) => {
    const cols = o.cols || 4, rows = o.rows || 12, C = w / cols, Wp = h / rows, s = gxSeed(R), pal = o.colors;
    const nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.25]], 1.6, R), gap = o.gap === undefined ? 0.05 : o.gap;
    gxPaint(g, null, w, h, (x, y, c) => {
      const ci = Math.floor(x / C), lx = x - ci * C, sg = ci % 2 ? -1 : 1;
      const d = y + sg * (lx - C / 2), pi = Math.floor(d / Wp), across = d / Wp - pi, along = lx / C;
      const h1 = gxH(gxMod(pi, rows), ci, s), h2 = gxH(gxMod(pi, rows) + 77, ci, s);
      const base = pal[(h1 * pal.length) | 0];
      const grain = 0.5 + 0.5 * Math.sin(across * (7 + h2 * 8) + along * 3 + h1 * 30 + Math.sin(along * 4 + h2 * 7) * 0.8);
      let k = (0.86 + 0.24 * h2) * (0.8 + 0.2 * grain) * (0.88 + 0.22 * nz[y * w + x]);
      if (across < gap || across > 1 - gap || lx < C * 0.012 || lx > C * 0.988) k *= 0.42;
      c[0] = base[0] * k; c[1] = base[1] * k; c[2] = base[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 60, dark: [22, 16, 10] });
  };
}

/* --------------------------------------------------------- hexagones -- */
/* Carreaux hexagonaux (pointe en haut) : n sur la largeur ; la hauteur de la texture doit valoir
   largeur × gxHexAspect(n) (m rangées doubles). colors tirées au hasard, ou mix (motif de fleurs). */
const gxHexM = (n) => Math.max(1, Math.round((n * Math.sqrt(3)) / 3));
const gxHexAspect = (n) => (3 * gxHexM(n)) / (n * Math.sqrt(3));
function gxHex(o) {
  return (g, w, h, R, G) => {
    const N = o.n || 8, M = gxHexM(N), sx = (N * Math.sqrt(3)) / w, sy = (M * 3) / h, s = gxSeed(R), pal = o.colors;
    const nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5]], 1.6, R);
    const gw = o.grout === undefined ? 0.07 : o.grout, gc = o.groutColor || [60, 58, 54], bev = o.bevel === undefined ? 0.1 : o.bevel;
    const vr = o.var === undefined ? 0.08 : o.var;
    gxPaint(g, G, w, h, (x, y, c, e) => {
      const X = x * sx, Y = y * sy;
      const qf = (Math.sqrt(3) / 3) * X - Y / 3, rf = (2 / 3) * Y, yf = -qf - rf;
      let rx = Math.round(qf), ry = Math.round(yf), rz = Math.round(rf);
      const ex = Math.abs(rx - qf), ey = Math.abs(ry - yf), ez = Math.abs(rz - rf);
      if (ex > ey && ex > ez) rx = -ry - rz; else if (ey > ez) ry = -rx - rz; else rz = -rx - ry;
      const q = rx, r = rz, px = X - Math.sqrt(3) * (q + r / 2), py = Y - 1.5 * r;
      const hd = Math.max(Math.abs(px), Math.abs(px * 0.5 + py * 0.8660254), Math.abs(-px * 0.5 + py * 0.8660254));
      const ed = 0.8660254 - hd, m = Math.floor(r / (2 * M)), r2 = r - 2 * M * m, q2 = gxMod(q + M * m, N);
      const v = nz[y * w + x];
      if (ed < gw) { const k = 0.8 + 0.3 * v; c[0] = gc[0] * k; c[1] = gc[1] * k; c[2] = gc[2] * k; return; }
      const h1 = gxH(q2, r2, s);
      if (o.missing && gxH(q2 + 9, r2 + 3, s) < o.missing) { const k = 0.6 + 0.3 * v; c[0] = gc[0] * k * 0.7; c[1] = gc[1] * k * 0.7; c[2] = gc[2] * k * 0.7; return; }
      let b;
      if (o.flower) {
        // fleurs : un hexagone sur sept d'une autre couleur (motif de pavage en rosaces)
        const f = gxMod(q2 + 2 * r2, 7) === 0 || (o.flower === 2 && gxMod(q2 - r2, 7) === 3);
        b = f ? o.flowerColor : pal[(h1 * pal.length) | 0];
      } else b = pal[(h1 * pal.length) | 0];
      let k = (1 - vr / 2 + vr * gxH(q2 + 5, r2, s)) * (0.9 + 0.16 * v);
      if (bev > 0 && ed < gw + bev) k *= 0.75 + 0.25 * ((ed - gw) / bev);
      if (o.dome) k *= 0.75 + 0.45 * clamp(ed / 0.8, 0, 1);
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
      if (o.glow && h1 < o.glow) { e[0] = c[0]; e[1] = c[1]; e[2] = c[2]; }
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 60, dark: o.dark || [40, 34, 24] });
  };
}

/* --------------------------------------------------- terrazzo, granulés -- */
function gxTerrazzo(o) {
  return (g, w, h, R) => {
    const k = w / 512, area = (w * h) / 262144;
    fillBase(g, w, h, o.base, R, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.3]], 0.12);
    const n = Math.round((o.chips || 900) * area);
    for (let i = 0; i < n; i++) {
      const x = R() * w, y = R() * h, r = (o.size || 4) * k * (0.4 + R() * R() * 2.2);
      const col = shadec(gxPick(R, o.colors), 0.85 + R() * 0.3), pts = 3 + ((R() * 4) | 0), a0 = R() * TAU, sh = [];
      for (let p = 0; p < pts; p++) { const a = a0 + (p / pts) * TAU + (R() - 0.5) * 0.8, rr = r * (0.6 + R() * 0.6); sh.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      g.fillStyle = rgbS(col);
      wrapAt(w, h, x, y, r * 1.3, (cx, cy) => { g.beginPath(); sh.forEach(([a, b], j) => (j ? g.lineTo(cx + a, cy + b) : g.moveTo(cx + a, cy + b))); g.closePath(); g.fill(); });
    }
    if (o.tiles) { g.fillStyle = 'rgba(30,28,26,0.5)'; const s = w / o.tiles; for (let i = 0; i < o.tiles; i++) { g.fillRect(i * s, 0, Math.max(1, k * 1.5), h); g.fillRect(0, i * s, w, Math.max(1, k * 1.5)); } }
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 2 : o.stains, specks: 40, cracks: o.cracks || 0 });
  };
}
/* Sol de granulés (caoutchouc coulé des aires de jeux, EPDM) : base sombre et éclats de couleur. */
function gxFlecks(o) {
  return (g, w, h, R) => {
    const k = w / 512, area = (w * h) / 262144;
    fillBase(g, w, h, o.base, R, [[4, 4, 1], [32, 32, 0.4]], 0.18);
    for (let i = 0; i < Math.round((o.count || 5200) * area); i++) {
      g.fillStyle = rgbS(shadec(gxPick(R, o.colors), 0.75 + R() * 0.4));
      const x = R() * w, y = R() * h, s = (1.2 + R() * 2.4) * k;
      g.fillRect(x, y, s, s * (0.5 + R()));
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 30 });
  };
}

/* --------------------------------------------------- bardeaux, écailles -- */
/* Rangs de bardeaux (shape : 'carre', 'rond' écailles, 'pointe') ; chaque rang recouvre le haut du suivant. */
function gxShingles(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, k = w / 512;
    const cols = Math.max(2, Math.round(w / ((o.tw || 0.25) * ppm))), rows = Math.max(2, Math.round(h / ((o.th || 0.18) * ppm)) & ~1);
    const cw = w / cols, rh = h / rows, shape = o.shape || 'carre', pal = o.colors;
    g.fillStyle = rgbS(shadec(pal[0], 0.3)); g.fillRect(0, 0, w, h);
    const tile = (x, y, col) => {
      const top = y - rh * 0.6, bot = y + rh;
      g.beginPath();
      if (shape === 'rond') { g.moveTo(x, top); g.lineTo(x + cw, top); g.lineTo(x + cw, bot - cw / 2); g.arc(x + cw / 2, bot - cw / 2, cw / 2, 0, Math.PI); g.closePath(); }
      else if (shape === 'pointe') { g.moveTo(x, top); g.lineTo(x + cw, top); g.lineTo(x + cw, bot - cw * 0.35); g.lineTo(x + cw / 2, bot); g.lineTo(x, bot - cw * 0.35); g.closePath(); }
      else { g.rect(x + k, top, cw - 2 * k, bot - top); }
      const gr = g.createLinearGradient(0, top, 0, bot);
      gr.addColorStop(0, rgbS(shadec(col, 0.55))); gr.addColorStop(0.65, rgbS(col)); gr.addColorStop(1, rgbS(shadec(col, 1.1)));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = Math.max(1, 1.4 * k); g.stroke();
    };
    // couleurs tirées d'avance (colonne modulo cols : la texture se raccorde)
    const rc = [];
    for (let r = 0; r < rows; r++) { const a = []; for (let i = 0; i < cols; i++) a.push(shadec(gxPick(R, pal), 0.8 + R() * 0.32)); rc.push(a); }
    const row = (r, dy) => {
      const off = (r % 2) * cw / 2;
      for (let i = -1; i <= cols; i++) tile(i * cw + off, r * rh + dy, rc[r][gxMod(i, cols)]);
    };
    for (let r = rows - 1; r >= 0; r--) row(r, 0);
    row(rows - 1, -h);
    const n = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.3]], 1.8, R), img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < w * h; i++) { const kk = 0.84 + 0.26 * n[i]; d[i * 4] *= kk; d[i * 4 + 1] *= kk; d[i * 4 + 2] *= kk; }
    g.putImageData(img, 0, 0);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 5 : o.stains, specks: 160 });
  };
}
/* Chaume : rangs de paille, plus sombres sous chaque rang. */
function gxThatch(o) {
  return (g, w, h, R) => {
    const k = w / 512, ppm = w / o.tile;
    fillBase(g, w, h, shadec(o.color, 0.42), R, [[4, 4, 1], [16, 16, 0.5]], 0.3);
    const rows = Math.max(2, Math.round(h / ((o.band || 0.3) * ppm))), rh = h / rows;
    g.lineCap = 'round';
    for (let r = 0; r < rows; r++) {
      const y0 = r * rh, n = Math.round((w / k) * 1.3);
      for (let i = 0; i < n; i++) {
        const x = R() * w, len = rh * (0.8 + R() * 0.8), y = y0 - rh * 0.25 + R() * rh * 0.35, a = (R() - 0.5) * 0.3;
        g.strokeStyle = rgbS(shadec(o.color, 0.55 + R() * 0.65), 0.9); g.lineWidth = (0.8 + R() * 1.6) * k;
        const ex = Math.sin(a) * len, ey = Math.cos(a) * len;
        wrapAt(w, h, x, y + ey / 2, len, (cx, cy) => { g.beginPath(); g.moveTo(cx, cy - ey / 2); g.lineTo(cx + ex, cy + ey / 2); g.stroke(); });
      }
      const gr = g.createLinearGradient(0, y0 + rh * 0.7, 0, y0 + rh);
      gr.addColorStop(0, 'rgba(10,8,4,0)'); gr.addColorStop(1, 'rgba(10,8,4,0.45)');
      g.fillStyle = gr; g.fillRect(0, y0 + rh * 0.7, w, rh * 0.3);
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 4 : o.stains, specks: 100, dark: [20, 16, 8] });
  };
}

/* ---------------------------------------------------------------- tissus -- */
/* Armure toile (2) ou sergé (4) ; sett : couleurs des fils (tartans), sinon warp / weft. Fil : thread m. */
function gxWeave(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, want = Math.max(2.2, (o.thread || 0.004) * ppm), L = o.sett ? o.sett.length : 2;
    const nx = Math.max(L, Math.round(w / want / L) * L), ny = Math.max(L, Math.round(h / want / L) * L), sx = w / nx, sy = h / ny;
    const warp = o.warp || o.color, weft = o.weft || (o.color ? shadec(o.color, 0.9) : null), sett = o.sett, tw = o.twill;
    const jx = new Float32Array(nx), jy = new Float32Array(ny);
    for (let i = 0; i < nx; i++) jx[i] = 0.9 + R() * 0.2;
    for (let i = 0; i < ny; i++) jy[i] = 0.9 + R() * 0.2;
    const nz = vnoise(w, h, [[6, 6, 1], [32, 32, 0.4]], 1.5, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const ix = Math.floor(x / sx), iy = Math.floor(y / sy), fx = x / sx - ix, fy = y / sy - iy;
      const over = tw ? gxMod(ix - iy, 4) < 2 : (ix + iy) % 2 === 0;
      let col, prof, jt;
      if (over) { col = sett ? sett[ix % L] : warp; prof = Math.sin(fx * Math.PI); jt = jx[ix]; } else { col = sett ? sett[iy % L] : weft; prof = Math.sin(fy * Math.PI); jt = jy[iy]; }
      const k = (0.62 + 0.4 * prof) * jt * (0.86 + 0.22 * nz[y * w + x]);
      c[0] = col[0] * k; c[1] = col[1] * k; c[2] = col[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 40, dark: [30, 24, 18] });
  };
}
/* Sett d'un tartan : [[couleur, fils], …] → couleur par fil (symétrique, comme les vrais). */
function gxSett(spec) {
  const one = [];
  for (const [c, n] of spec) for (let i = 0; i < n; i++) one.push(c);
  return one.concat(one.slice().reverse());
}

/* ------------------------------------------------------ science-fiction -- */
/* Panneaux découpés (subdivision), biseaux, grilles, voyants (lumière propre), bandes de danger. */
function gxSciFi(o) {
  return (g, w, h, R, G) => {
    const k = w / 512, b = o.color;
    fillBase(g, w, h, b, R, [[4, 4, 1], [16, 16, 0.4]], 0.1);
    if (G) { G.fillStyle = '#000'; G.fillRect(0, 0, w, h); }
    const rects = [], q = 8 * k;
    const split = (x, y, rw, rh, d) => {
      if (d >= (o.depth || 4) || (rw < w * 0.14 && rh < h * 0.14) || (d > 1 && R() < 0.22)) { rects.push([x, y, rw, rh]); return; }
      if (rw > rh * (0.7 + R() * 0.6)) { const t = Math.max(q, Math.min(rw - q, Math.round(((0.25 + R() * 0.5) * rw) / q) * q)); split(x, y, t, rh, d + 1); split(x + t, y, rw - t, rh, d + 1); }
      else { const t = Math.max(q, Math.min(rh - q, Math.round(((0.25 + R() * 0.5) * rh) / q) * q)); split(x, y, rw, t, d + 1); split(x, y + t, rw, rh - t, d + 1); }
    };
    split(0, 0, w, h, 0);
    const glow = o.glow || [120, 220, 255];
    for (const [x, y, rw, rh] of rects) {
      const col = shadec(o.alt && R() < 0.25 ? o.alt : b, 0.84 + R() * 0.28);
      g.fillStyle = rgbS(col); g.fillRect(x + 2 * k, y + 2 * k, rw - 4 * k, rh - 4 * k);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + 2 * k, y + 2 * k, rw - 4 * k, 2 * k); g.fillRect(x + 2 * k, y + 2 * k, 2 * k, rh - 4 * k);
      g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(x + 2 * k, y + rh - 4 * k, rw - 4 * k, 2 * k); g.fillRect(x + rw - 4 * k, y + 2 * k, 2 * k, rh - 4 * k);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, rw, 2 * k); g.fillRect(x, y, 2 * k, rh);
      const r = R(), cx = x + rw / 2, cy = y + rh / 2;
      if (r < 0.18 && rw > 40 * k && rh > 28 * k) {                     // grille d'aération
        const vw = rw * 0.6, vh = rh * 0.5, n = Math.max(3, Math.round(vh / (6 * k)));
        g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(cx - vw / 2, cy - vh / 2, vw, vh);
        for (let i = 0; i < n; i++) { g.fillStyle = rgbS(shadec(col, 0.75)); g.fillRect(cx - vw / 2 + k, cy - vh / 2 + (i + 0.2) * (vh / n), vw - 2 * k, (vh / n) * 0.5); }
      } else if (r < 0.32 && o.lights !== false) {                       // bande lumineuse
        const horiz = rw > rh, lw = horiz ? rw * 0.7 : 4 * k, lh = horiz ? 4 * k : rh * 0.7;
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(cx - lw / 2 - k, cy - lh / 2 - k, lw + 2 * k, lh + 2 * k);
        gxBoth(g, G, (c) => { c.fillStyle = rgbS(glow); c.fillRect(cx - lw / 2, cy - lh / 2, lw, lh); });
      } else if (r < 0.46) {                                            // vis aux coins
        g.fillStyle = 'rgba(30,30,32,0.85)';
        for (const [sx, sy] of [[x + 7 * k, y + 7 * k], [x + rw - 7 * k, y + 7 * k], [x + 7 * k, y + rh - 7 * k], [x + rw - 7 * k, y + rh - 7 * k]]) { g.beginPath(); g.arc(sx, sy, 2.2 * k, 0, TAU); g.fill(); }
      } else if (r < 0.54 && o.hazard && rw > 30 * k) {                  // bande de danger
        const hh = Math.min(rh * 0.3, 14 * k), yy = y + rh - hh - 6 * k;
        g.save(); g.beginPath(); g.rect(x + 6 * k, yy, rw - 12 * k, hh); g.clip();
        for (let xx = x - hh; xx < x + rw + hh; xx += hh * 1.4) { g.fillStyle = 'rgb(206,166,40)'; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + hh * 0.7, yy); g.lineTo(xx + hh * 1.7, yy + hh); g.lineTo(xx + hh, yy + hh); g.fill(); }
        g.restore();
      } else if (r < 0.66 && rw > 24 * k && rh > 24 * k) {               // panneau en creux
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 8 * k, y + 8 * k, rw - 16 * k, rh - 16 * k);
        g.fillStyle = rgbS(shadec(col, 0.92)); g.fillRect(x + 10 * k, y + 10 * k, rw - 20 * k, rh - 20 * k);
        if (R() < 0.35 && o.lights !== false) { const lc = R() < 0.5 ? glow : [255, 120, 60]; gxBoth(g, G, (c) => { c.fillStyle = rgbS(lc); c.beginPath(); c.arc(x + rw - 16 * k, y + 16 * k, 2.6 * k, 0, TAU); c.fill(); }); }
      }
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 40, drips: o.drips || 2 });
  };
}
/* Circuit imprimé : pistes à 0, 45, 90°, pastilles, puces ; diodes lumineuses (lumière propre). */
function gxCircuit(o) {
  return (g, w, h, R, G) => {
    const k = w / 512, area = (w * h) / 262144;
    fillBase(g, w, h, o.board || [22, 70, 40], R, [[4, 4, 1], [16, 16, 0.4]], 0.14);
    if (G) { G.fillStyle = '#000'; G.fillRect(0, 0, w, h); }
    const step = 8 * k, nx = Math.round(w / step), ny = Math.round(h / step), gx = w / nx, gy = h / ny;
    const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const tr = o.trace || [196, 166, 80];
    g.lineCap = 'round'; g.lineJoin = 'round';
    const rep = (fn) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) fn(ox, oy); };
    for (let i = 0; i < Math.round((o.traces || 260) * area); i++) {
      let cx = (R() * nx) | 0, cy = (R() * ny) | 0, dir = ((R() * 4) | 0) * 2;
      const pts = [[cx * gx, cy * gy]], len = 4 + ((R() * 22) | 0);
      for (let s = 0; s < len; s++) { if (R() < 0.22) dir = (dir + (R() < 0.5 ? 1 : 7)) % 8; cx += DIR[dir][0]; cy += DIR[dir][1]; pts.push([cx * gx, cy * gy]); }
      const lw = (R() < 0.2 ? 3 : 1.6) * k;
      rep((ox, oy) => {
        g.strokeStyle = rgbS(shadec(tr, 0.55), 0.8); g.lineWidth = lw + 1.4 * k; g.beginPath(); pts.forEach(([a, b], j) => (j ? g.lineTo(a + ox, b + oy) : g.moveTo(a + ox, b + oy))); g.stroke();
        g.strokeStyle = rgbS(tr, 0.95); g.lineWidth = lw; g.stroke();
        g.fillStyle = rgbS(tr); for (const [a, b] of [pts[0], pts[pts.length - 1]]) { g.beginPath(); g.arc(a + ox, b + oy, 2.6 * k, 0, TAU); g.fill(); }
      });
    }
    for (let i = 0; i < Math.round((o.chips || 12) * area); i++) {
      const cw = (24 + R() * 50) * k, ch = (16 + R() * 34) * k, x = R() * w, y = R() * h;
      wrapAt(w, h, x + cw / 2, y + ch / 2, Math.max(cw, ch), (cx, cy) => {
        const x0 = cx - cw / 2, y0 = cy - ch / 2;
        g.fillStyle = 'rgb(150,150,140)';
        for (let p = x0 + 3 * k; p < x0 + cw - 2 * k; p += 5 * k) { g.fillRect(p, y0 - 3 * k, 2 * k, ch + 6 * k); }
        g.fillStyle = 'rgb(24,24,26)'; g.fillRect(x0, y0, cw, ch);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x0, y0, cw, 2 * k);
      });
    }
    if (o.leds) {
      for (let i = 0; i < Math.round(o.leds * area); i++) {
        const x = R() * w, y = R() * h, col = gxPick(R, o.ledColors || [[80, 255, 120], [255, 60, 40], [80, 180, 255]]);
        gxBoth(g, G, (c) => { c.fillStyle = rgbS(col); c.fillRect(x - 2 * k, y - 1.4 * k, 4 * k, 2.8 * k); });
      }
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 2 : o.stains, specks: 30 });
  };
}

/* --------------------------------------------- métal : ventilations, perforé, brossé -- */
function gxLouvre(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, rows = Math.max(2, Math.round(h / ((o.pitch || 0.05) * ppm))), ph = h / rows, b = o.color;
    const nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.2]], 1.8, R);
    const fw = o.frame ? Math.max(2, Math.round(w / (o.frame * ppm))) : 0, fs = fw ? w / fw : 0;
    gxPaint(g, null, w, h, (x, y, c) => {
      const f = gxFr(y / ph);
      let k = f < 0.7 ? 0.62 + 0.5 * (f / 0.7) : f < 0.78 ? 1.22 : 0.1;
      if (fs) { const fx = gxFr(x / fs); if (fx < 0.03 || fx > 0.97) k = fx < 0.015 || fx > 0.985 ? 0.3 : 1.05; }
      k *= 0.85 + 0.25 * nz[y * w + x];
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    rustify(g, w, h, R, o.rust || 0);
    gxFinish(g, w, h, R, o, { stains: 3, specks: 40 });
  };
}
function gxPerforated(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, p = (o.pitch || 0.025) * ppm, rr = o.hole || 0.32;
    const nx = Math.max(2, Math.round(w / p)), ny = Math.max(2, Math.round(h / p) & ~1), px = w / nx, py = h / ny, b = o.color, bg = o.bg || [14, 14, 16];
    const nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.2]], 1.8, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const iy = Math.floor(y / py), off = o.stagger !== false && iy % 2 ? 0.5 : 0;
      const fx = gxFr(x / px - off) - 0.5, fy = gxFr(y / py) - 0.5;
      const d = o.square ? Math.max(Math.abs(fx), Math.abs(fy)) : Math.sqrt(fx * fx + fy * fy), v = nz[y * w + x];
      if (d < rr) { const k = 0.7 + 0.5 * (fy + 0.5); c[0] = bg[0] * k; c[1] = bg[1] * k; c[2] = bg[2] * k; return; }
      let k = 0.8 + 0.3 * v;
      if (d < rr + 0.05) k *= fy > 0 ? 1.25 : 0.7;
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    rustify(g, w, h, R, o.rust || 0);
    gxFinish(g, w, h, R, o, { stains: 2, specks: 30 });
  };
}
function gxBrushed(o) {
  return (g, w, h, R) => {
    const b = o.color, n1 = vnoise(w, h, [[2, 96, 1], [3, 192, 0.6], [6, 256, 0.35]], 2.0, R), n2 = vnoise(w, h, [[3, 3, 1], [8, 8, 0.4]], 1.4, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const i = y * w + x, k = (0.8 + 0.28 * n1[i]) * (0.9 + 0.16 * n2[i]);
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    if (o.plates) { const k = w / 512, s = w / o.plates; for (let i = 0; i < o.plates; i++) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(i * s, 0, 1.6 * k, h); g.fillRect(0, i * s, w, 1.6 * k); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(i * s + 1.6 * k, 0, k, h); g.fillRect(0, i * s + 1.6 * k, w, k); } }
    if (o.scratches) { const k = w / 512; g.strokeStyle = 'rgba(235,235,230,0.18)'; g.lineWidth = Math.max(1, k); for (let i = 0; i < o.scratches * (w * h) / 262144; i++) { const x = R() * w, y = R() * h, a = R() * TAU, l = (10 + R() * 50) * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }
    gxPatina(g, w, h, R, o.patina || 0);
    rustify(g, w, h, R, o.rust || 0);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 2 : o.stains, specks: 30 });
  };
}
/* Bac acier (toiture et bardage industriels) : ondes trapézoïdales verticales. */
function gxTrapez(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, n = Math.max(2, Math.round(w / ((o.pitch || 0.25) * ppm))), pw = w / n, b = o.color;
    const nz = vnoise(w, h, [[4, 8, 1], [16, 32, 0.4]], 1.8, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const f = gxFr(x / pw);
      const k0 = f < 0.12 ? 1.18 : f < 0.24 ? 0.7 : f < 0.62 ? 0.95 : f < 0.74 ? 1.08 : 1.0;
      const k = k0 * (0.84 + 0.24 * nz[y * w + x]);
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    rustify(g, w, h, R, o.rust || 0);
    gxFinish(g, w, h, R, o, { stains: 3, specks: 50, drips: 6 });
  };
}

/* --------------------------------------------------------------- verre -- */
function gxGlassBlock(o) {
  return (g, w, h, R, G) => {
    const ppm = w / o.tile, n = Math.max(1, Math.round(w / ((o.size || 0.19) * ppm))), m = Math.max(1, Math.round(h / ((o.size || 0.19) * ppm)));
    const cw = w / n, ch = h / m, b = o.color || [150, 190, 186], gc = o.grout || [150, 148, 140], gw = 0.07, nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5]], 1.6, R);
    gxPaint(g, G, w, h, (x, y, c, e) => {
      const fx = gxFr(x / cw), fy = gxFr(y / ch), v = nz[y * w + x];
      if (fx < gw || fy < gw) { const k = 0.8 + 0.3 * v; c[0] = gc[0] * k; c[1] = gc[1] * k; c[2] = gc[2] * k; return; }
      const ux = (fx - gw) / (1 - gw) - 0.5, uy = (fy - gw) / (1 - gw) - 0.5, r = Math.max(Math.abs(ux), Math.abs(uy));
      const ripple = 0.5 + 0.5 * Math.sin((ux * ux + uy * uy) * 90 + v * 4);
      const k = clamp(0.62 + 0.22 * ripple + (r > 0.43 ? 0.28 : 0) - Math.hypot(ux + 0.18, uy + 0.18) * 0.32 + 0.12 * v, 0.3, 1.4);
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
      if (o.lit) { e[0] = c[0] * 0.6; e[1] = c[1] * 0.6; e[2] = c[2] * 0.6; }
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 2 : o.stains, specks: 30 });
  };
}
/* Verre dépoli ou miroir : surface presque unie, reflets doux. */
function gxGlassPlain(o) {
  return (g, w, h, R) => {
    const b = o.color, n = vnoise(w, h, [[2, 2, 1], [5, 5, 0.5], [64, 64, o.frost ? 0.5 : 0.05], [200, 200, o.frost ? 0.4 : 0]], 1.4, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const t = (x + y) / (w + h), band = Math.max(0, 1 - Math.abs(gxFr(t * 2 + 0.2) - 0.5) * 6) * (o.frost ? 0.08 : 0.3);
      const k = 0.82 + 0.26 * n[y * w + x] + band;
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    if (o.frame) { const k = w / 512, s = w / o.frame; g.fillStyle = 'rgba(30,30,32,0.9)'; for (let i = 0; i < o.frame; i++) { g.fillRect(i * s - 3 * k, 0, 6 * k, h); g.fillRect(0, i * s - 3 * k, w, 6 * k); } }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 1 : o.stains, specks: 20 });
  };
}

/* ------------------------------------------------- lumières (lumière propre) -- */
/* kind : 'dalles' (plafond à dalles lumineuses), 'tubes' (néons), 'leds' (mur de diodes),
   'ecrans' (moniteurs, lignes de texte), 'commandes' (pupitre : boutons, voyants, cadrans). */
function gxLights(o) {
  return (g, w, h, R, G) => {
    const k = w / 512, col = o.light || [240, 244, 255], base = o.base || [40, 42, 46];
    fillBase(g, w, h, base, R, [[4, 4, 1], [16, 16, 0.4]], 0.12);
    if (G) { G.fillStyle = '#000'; G.fillRect(0, 0, w, h); }
    const kind = o.kind || 'dalles';
    if (kind === 'dalles') {
      const n = o.n || 3, s = w / n, m = Math.max(1, Math.round(h / s)), sh = h / m;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const x = i * s, y = j * sh, lit = (i + j) % (o.every || 2) === 0;
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, s, 3 * k); g.fillRect(x, y, 3 * k, sh);
        if (lit) {
          gxBoth(g, G, (c) => { c.fillStyle = rgbS(col); c.fillRect(x + 6 * k, y + 6 * k, s - 12 * k, sh - 12 * k); });
          g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = Math.max(1, k);
          for (let t = 1; t < 8; t++) { g.beginPath(); g.moveTo(x + 6 * k + ((s - 12 * k) * t) / 8, y + 6 * k); g.lineTo(x + 6 * k + ((s - 12 * k) * t) / 8, y + sh - 6 * k); g.stroke(); }
        } else { g.fillStyle = rgbS(shadec(base, 1.5)); g.fillRect(x + 4 * k, y + 4 * k, s - 8 * k, sh - 8 * k); }
      }
    } else if (kind === 'tubes') {
      const n = o.n || 4, rh = h / n;
      for (let j = 0; j < n; j++) {
        const y = j * rh + rh / 2;
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, y - 10 * k, w, 20 * k);
        g.fillStyle = rgbS(shadec(base, 1.8)); g.fillRect(0, y - 8 * k, w, 3 * k);
        gxBoth(g, G, (c) => { const gr = c.createLinearGradient(0, y - 5 * k, 0, y + 5 * k); gr.addColorStop(0, rgbS(shadec(col, 0.7))); gr.addColorStop(0.5, rgbS(col)); gr.addColorStop(1, rgbS(shadec(col, 0.7))); c.fillStyle = gr; c.fillRect(0, y - 5 * k, w, 10 * k); });
        if (G) { const gr = G.createLinearGradient(0, y - rh / 2, 0, y + rh / 2); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, rgbS(shadec(col, 0.25))); gr.addColorStop(1, 'rgba(0,0,0,0)'); G.globalCompositeOperation = 'lighter'; G.fillStyle = gr; G.fillRect(0, y - rh / 2, w, rh); G.globalCompositeOperation = 'source-over'; }
      }
    } else if (kind === 'leds') {
      const s = (o.pitch || 16) * k, n = Math.max(2, Math.round(w / s)), m = Math.max(2, Math.round(h / s)), cw = w / n, ch = h / m;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const x = (i + 0.5) * cw, y = (j + 0.5) * ch, on = R() < (o.on || 0.7), c0 = o.colors ? gxPick(R, o.colors) : col;
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(x, y, cw * 0.36, 0, TAU); g.fill();
        if (on) gxBoth(g, G, (c) => { c.fillStyle = rgbS(c0); c.beginPath(); c.arc(x, y, cw * 0.26, 0, TAU); c.fill(); });
        else { g.fillStyle = rgbS(shadec(c0, 0.25)); g.beginPath(); g.arc(x, y, cw * 0.26, 0, TAU); g.fill(); }
      }
    } else if (kind === 'ecrans') {
      const n = o.n || 2, s = w / n, m = Math.max(1, Math.round(h / (s * 0.75))), sh = h / m;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const x = i * s, y = j * sh, fx = x + 10 * k, fy = y + 10 * k, fw = s - 20 * k, fh = sh - 20 * k;
        g.fillStyle = 'rgb(22,22,24)'; g.fillRect(x + 4 * k, y + 4 * k, s - 8 * k, sh - 8 * k);
        const dead = R() < (o.dead || 0.12), sc = shadec(col, 0.12);
        g.fillStyle = rgbS(dead ? [8, 8, 9] : sc); g.fillRect(fx, fy, fw, fh);
        if (!dead) {
          if (G) { G.fillStyle = rgbS(shadec(col, 0.1)); G.fillRect(fx, fy, fw, fh); }
          const lines = Math.max(4, Math.round(fh / (9 * k)));
          for (let l = 0; l < lines; l++) {
            let lx = fx + 6 * k;
            const ly = fy + 6 * k + l * ((fh - 12 * k) / lines), lim = fx + fw - 6 * k - R() * fw * 0.4;
            while (lx < lim) { const ww = (6 + R() * 26) * k; const xx = lx, yy = ly; gxBoth(g, G, (c) => { c.fillStyle = rgbS(col, 0.85); c.fillRect(xx, yy, Math.min(ww, lim - xx), 3 * k); }); lx += ww + 5 * k; }
          }
          g.fillStyle = 'rgba(0,0,0,0.18)'; for (let yy = fy; yy < fy + fh; yy += 3 * k) g.fillRect(fx, yy, fw, Math.max(1, k));
        }
      }
    } else {                                                            // pupitre de commande
      const n = o.n || 4, s = w / n, m = Math.max(1, Math.round(h / s)), sh = h / m;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const x = i * s, y = j * sh;
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, s, 2 * k); g.fillRect(x, y, 2 * k, sh);
        const kind2 = R();
        if (kind2 < 0.4) {                                              // boutons
          for (let b = 0; b < 6; b++) {
            const bx = x + s * (0.2 + (b % 3) * 0.3), by = y + sh * (0.3 + Math.floor(b / 3) * 0.4), c0 = gxPick(R, [[220, 40, 30], [40, 200, 80], [240, 200, 40], [60, 140, 255]]), on = R() < 0.5;
            g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(bx, by, s * 0.09, 0, TAU); g.fill();
            if (on) gxBoth(g, G, (c) => { c.fillStyle = rgbS(c0); c.beginPath(); c.arc(bx, by, s * 0.065, 0, TAU); c.fill(); });
            else { g.fillStyle = rgbS(shadec(c0, 0.35)); g.beginPath(); g.arc(bx, by, s * 0.065, 0, TAU); g.fill(); }
          }
        } else if (kind2 < 0.7) {                                       // cadran
          const cx = x + s / 2, cy = y + sh / 2, r = Math.min(s, sh) * 0.32;
          g.fillStyle = 'rgb(20,20,20)'; g.beginPath(); g.arc(cx, cy, r * 1.12, 0, TAU); g.fill();
          gxBoth(g, G, (c) => { c.fillStyle = rgbS(shadec(col, 0.8)); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); });
          g.strokeStyle = 'rgb(30,30,30)'; g.lineWidth = 2 * k; for (let t = 0; t < 9; t++) { const a = Math.PI * (0.75 + t * 0.1875); g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75); g.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); g.stroke(); }
          const a = Math.PI * (0.75 + R() * 1.5); g.strokeStyle = 'rgb(200,30,20)'; g.lineWidth = 2.4 * k; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); g.stroke();
        } else {                                                        // interrupteurs
          for (let b = 0; b < 4; b++) {
            const bx = x + s * (0.2 + b * 0.2), by = y + sh / 2;
            g.fillStyle = 'rgb(28,28,30)'; g.fillRect(bx - s * 0.05, by - sh * 0.2, s * 0.1, sh * 0.4);
            g.fillStyle = 'rgb(190,190,186)'; g.fillRect(bx - s * 0.025, by - (R() < 0.5 ? sh * 0.18 : -sh * 0.02), s * 0.05, sh * 0.16);
            const on = R() < 0.6, c0 = on ? [80, 255, 110] : [255, 60, 40];
            gxBoth(g, G, (c) => { c.fillStyle = rgbS(c0); c.beginPath(); c.arc(bx, by - sh * 0.3, s * 0.025, 0, TAU); c.fill(); });
          }
        }
      }
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 2 : o.stains, specks: 30 });
  };
}

/* ------------------------------------------------------- nature, roche -- */
/* Roche en strates (falaises, carrières) ; pebbles : cailloux pris dans la masse (pisé). */
function gxStrata(o) {
  return (g, w, h, R) => {
    const L = o.layers || 9, pal = o.colors;
    const warp = vnoise(w, h, [[3, 2, 1], [6, 4, 0.5], [12, 8, 0.25]], 1.2, R);
    const n = vnoise(w, h, [[8, 8, 1], [32, 32, 0.6], [128, 128, 0.3]], 2.0, R);
    const lc = [];
    for (let i = 0; i < L; i++) lc.push(shadec(gxPick(R, pal), 0.84 + R() * 0.28));
    const wa = o.warp === undefined ? 1.6 : o.warp, jt = o.joint === undefined ? 0.06 : o.joint;
    gxPaint(g, null, w, h, (x, y, c) => {
      const i = y * w + x, t = (y / h) * L + (warp[i] - 0.5) * wa, li = gxMod(Math.floor(t), L), f = gxFr(t), b = lc[li];
      let k = 0.72 + 0.42 * n[i];
      if (f < jt) k *= 0.6;
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    const kk = w / 512;
    for (let i = 0; i < (o.cracks === undefined ? 10 : o.cracks); i++) crackR(g, w, h, R, R() * w, R() * h, 6 + ((R() * 10) | 0), 9 * kk, (1 + R()) * kk, 'rgba(18,14,10,0.55)');
    if (o.pebbles) for (let i = 0; i < o.pebbles * (w * h) / 262144; i++) {
      const x = R() * w, y = R() * h, r = (1.5 + R() * 4) * kk, col = mixc(gxPick(R, pal), [60, 56, 50], R() * 0.6);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x + r * 0.3, y + r * 0.3, r, r * 0.8, 0, 0, TAU); g.fill();
      g.fillStyle = rgbS(col); g.beginPath(); g.ellipse(x, y, r, r * 0.8, R() * 3, 0, TAU); g.fill();
    }
    if (o.forms) { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 1; i <= o.forms; i++) g.fillRect(0, (h * i) / o.forms - kk, w, 2 * kk); }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 5 : o.stains, specks: 200, dark: o.dark || [24, 18, 10] });
  };
}
function gxBark(o) {
  return (g, w, h, R) => {
    const b = o.color, n1 = vnoise(w, h, [[18, 3, 1], [40, 6, 0.6], [96, 12, 0.3]], 2.0, R), n2 = vnoise(w, h, [[6, 6, 1], [24, 24, 0.5]], 1.8, R);
    const lichen = o.lichen ? hexc(0x8a9a6a) : null;
    gxPaint(g, null, w, h, (x, y, c) => {
      const i = y * w + x, v = n1[i];
      let k = 0.62 + 0.62 * v;
      if (v < 0.32) k *= 0.5 + (v / 0.32) * 0.3;
      k *= 0.85 + 0.25 * n2[i];
      const col = lichen && n2[i] > 0.72 && v > 0.5 ? mixc(b, lichen, 0.55) : b;
      c[0] = col[0] * k; c[1] = col[1] * k; c[2] = col[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: 2, specks: 100, dark: [18, 12, 6] });
  };
}
/* Feuillage dense (haies), feuilles mortes, fleurs : feuilles sombres dessous, claires dessus. */
function gxLeaves(o) {
  return (g, w, h, R) => {
    const k = w / 512, area = (w * h) / 262144;
    if (o.under) o.under(g, w, h, R); else fillBase(g, w, h, shadec(o.color, 0.45), R, [[4, 4, 1], [16, 16, 0.5]], 0.4);
    const n = Math.round((o.count || 2600) * area * (o.under ? 1 : 2.6)), L = [];
    for (let i = 0; i < n; i++) L.push([R() * w, R() * h, (o.size || 9) * k * (0.6 + R() * 0.7), R() * TAU, R(), R()]);
    L.sort((a, b) => a[4] - b[4]);
    const pal = o.colors || [o.color];
    for (const [x, y, s, a, t, u] of L) {
      const col = shadec(pal[(u * pal.length) | 0], 0.5 + t * 0.8);
      g.fillStyle = rgbS(col);
      wrapAt(w, h, x, y, s, (cx, cy) => {
        g.beginPath(); g.ellipse(cx, cy, s, s * (o.round ? 0.8 : 0.45), a, 0, TAU); g.fill();
        if (s > 5 * k) { g.strokeStyle = rgbS(shadec(col, 0.7), 0.6); g.lineWidth = Math.max(0.6, 0.7 * k); g.beginPath(); g.moveTo(cx - Math.cos(a) * s * 0.8, cy - Math.sin(a) * s * 0.8); g.lineTo(cx + Math.cos(a) * s * 0.8, cy + Math.sin(a) * s * 0.8); g.stroke(); }
      });
    }
    if (o.flowers) for (let i = 0; i < Math.round(o.flowers * area); i++) {
      const x = R() * w, y = R() * h, r = (3.6 + R() * 3.6) * k, c0 = gxPick(R, o.flowerColors || [[230, 220, 90], [220, 80, 90], [240, 240, 236], [170, 120, 220]]);
      wrapAt(w, h, x, y, r * 2, (cx, cy) => { g.fillStyle = rgbS(c0); for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.7, 0, TAU); g.fill(); } g.fillStyle = 'rgb(230,190,60)'; g.beginPath(); g.arc(cx, cy, r * 0.5, 0, TAU); g.fill(); });
    }
    overlay(g, w, h, R, o);
  };
}
/* Lierre sur une autre texture : grappes de feuilles le long de tiges (mask : part couverte). */
function gxIvy(base, o) {
  return (g, w, h, R) => {
    base(g, w, h, R);
    const k = w / 512, m = vnoise(w, h, [[3, 3, 1], [8, 8, 0.5]], 2.4, R), cover = o.cover || 0.5;
    const area = (w * h) / 262144, n = Math.round(9000 * area * cover), pal = o.colors || [[52, 84, 40], [66, 100, 46], [40, 66, 32], [82, 112, 52]];
    const L = [];
    for (let i = 0; i < n * 3 && L.length < n; i++) {
      const x = R() * w, y = R() * h, t = R(), s = (8 + R() * 7) * k, a = R() * TAU, u = R();
      if (m[((y | 0) % h) * w + ((x | 0) % w)] < 1 - cover) continue;
      L.push([x, y, s, a, t, u]);
    }
    L.sort((a, b) => a[4] - b[4]);
    for (const [x, y, s, a, t, u] of L) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      wrapAt(w, h, x, y, s, (cx, cy) => { g.beginPath(); g.ellipse(cx + 1.5 * k, cy + 2 * k, s, s * 0.75, a, 0, TAU); g.fill(); });
      g.fillStyle = rgbS(shadec(pal[(u * pal.length) | 0], 0.55 + t * 0.7));
      wrapAt(w, h, x, y, s, (cx, cy) => {
        g.beginPath();
        for (let p = 0; p < 3; p++) { const aa = a + (p - 1) * 0.9; g.ellipse(cx + Math.cos(aa) * s * 0.45, cy + Math.sin(aa) * s * 0.45, s * 0.55, s * 0.38, aa, 0, TAU); }
        g.fill();
      });
    }
    overlay(g, w, h, R, o);
  };
}
/* Glace : bleu pâle, profondeur, fissures blanches, bulles. */
function gxIce(o) {
  return (g, w, h, R) => {
    const b = o.color || [168, 204, 222], n = vnoise(w, h, [[3, 3, 1], [9, 9, 0.6], [32, 32, 0.3]], 1.8, R), cl = vnoise(w, h, [[48, 48, 1], [120, 120, 0.6]], 1.4, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const i = y * w + x, k = 0.68 + 0.42 * n[i] + 0.06 * cl[i];
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    const k = w / 512;
    for (let i = 0; i < (o.cracks || 14); i++) crackR(g, w, h, R, R() * w, R() * h, 6 + ((R() * 12) | 0), 12 * k, (0.8 + R() * 1.2) * k, 'rgba(240,250,255,0.55)');
    for (let i = 0; i < 90 * (w * h) / 262144; i++) { const x = R() * w, y = R() * h, r = (0.8 + R() * 2.6) * k; g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = Math.max(0.6, 0.6 * k); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
    if (o.snow) for (let i = 0; i < 6; i++) softBlot(g, w, h, R() * w, R() * h, (40 + R() * 80) * k, 'rgba(240,244,250,0.45)');
    overlay(g, w, h, R, o);
  };
}

/* --------------------------------------------------------------- militaire -- */
function gxSandbags(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, k = w / 512;
    const cols = Math.max(1, Math.round(w / ((o.bw || 0.62) * ppm))), rows = Math.max(2, Math.round(h / ((o.bh || 0.16) * ppm)) & ~1), cw = w / cols, rh = h / rows;
    g.fillStyle = 'rgb(22,20,16)'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * cw / 2;
      for (let i = -1; i <= cols; i++) {
        const x = i * cw + off + cw / 2, y = r * rh + rh / 2, col = shadec(gxPick(R, o.colors), 0.8 + R() * 0.3), sq = 0.86 + R() * 0.12;
        wrapAt(w, h, x, y, cw, (cx, cy) => {
          const gr = g.createRadialGradient(cx - cw * 0.15, cy - rh * 0.25, rh * 0.1, cx, cy, cw * 0.55);
          gr.addColorStop(0, rgbS(shadec(col, 1.15))); gr.addColorStop(0.7, rgbS(col)); gr.addColorStop(1, rgbS(shadec(col, 0.45)));
          g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, cw * 0.5 * sq, rh * 0.56, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx - cw * 0.44 * sq, cy, cw * 0.04, rh * 0.22, 0, 0, TAU); g.fill();
        });
      }
    }
    const n = vnoise(w, h, [[64, 64, 1], [160, 160, 0.6]], 1.4, R), img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < w * h; i++) { const kk = 0.86 + 0.24 * n[i]; d[i * 4] *= kk; d[i * 4 + 1] *= kk; d[i * 4 + 2] *= kk; }
    g.putImageData(img, 0, 0);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 6 : o.stains, specks: 200 });
  };
}
/* Camouflage : taches de 3 ou 4 couleurs (seuils de bruit) ; digital : en pixels carrés. */
function gxCamo(o) {
  return (g, w, h, R) => {
    const pal = o.colors, sc = o.scale || 1;
    const ns = pal.slice(1).map((_, i) => vnoise(w, h, [[Math.round(3 * sc + i), Math.round(3 * sc + i), 1], [Math.round(7 * sc), Math.round(7 * sc), 0.5], [Math.round(16 * sc), Math.round(16 * sc), 0.25]], 2.6, R));
    const px = o.digital ? Math.max(2, Math.round(w / (o.digital || 64))) : 1, fine = vnoise(w, h, [[64, 64, 1], [200, 200, 0.5]], 1.3, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const qx = px > 1 ? Math.floor(x / px) * px : x, qy = px > 1 ? Math.floor(y / px) * px : y, i = qy * w + qx;
      let col = pal[0];
      for (let l = 0; l < ns.length; l++) if (ns[l][i] > 0.52 + l * 0.04) col = pal[l + 1];
      const k = 0.9 + 0.16 * fine[y * w + x];
      c[0] = col[0] * k; c[1] = col[1] * k; c[2] = col[2] * k;
    });
    overlay(g, w, h, R, o);
  };
}
/* Grillage à mailles losanges devant un fond (opaque). */
function gxChainLink(o) {
  return (g, w, h, R) => {
    if (o.under) o.under(g, w, h, R); else fillBase(g, w, h, o.bg || [40, 42, 40], R, [[4, 4, 1], [16, 16, 0.5]], 0.4);
    const k = w / 512, ppm = w / o.tile, n = Math.max(2, Math.round(w / ((o.mesh || 0.06) * ppm))), s = w / n, wire = o.wire || [160, 164, 160];
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? rgbS(wire) : 'rgba(0,0,0,0.45)'; g.lineWidth = (pass ? 1.8 : 2.2) * k;
      const d = pass ? 0 : 2 * k;
      for (let i = -n; i <= 2 * n; i++) {
        g.beginPath(); g.moveTo(i * s + d, d); g.lineTo(i * s - h + d, h + d); g.stroke();
        g.beginPath(); g.moveTo(i * s + d, d); g.lineTo(i * s + h + d, h + d); g.stroke();
      }
    }
    rustify(g, w, h, R, o.rust || 0);
    overlay(g, w, h, R, o);
  };
}

/* ------------------------------------------------------- claustras, ossuaire -- */
function gxBreeze(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, k = w / 512, n = Math.max(1, Math.round(w / ((o.size || 0.4) * ppm))), cw = w / n, m = Math.max(1, Math.round(h / cw)), ch = h / m, b = o.color;
    fillBase(g, w, h, b, R, [[8, 8, 1], [32, 32, 0.5], [96, 96, 0.3]], 0.3);
    const hole = (x, y, s) => {
      const gr = g.createLinearGradient(x, y - s, x, y + s);
      gr.addColorStop(0, 'rgb(8,8,8)'); gr.addColorStop(1, 'rgb(40,38,34)');
      g.fillStyle = gr;
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const x = i * cw, y = j * ch, cx = x + cw / 2, cy = y + ch / 2, s = cw * 0.5;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, cw, 3 * k); g.fillRect(x, y, 3 * k, ch);
      hole(cx, cy, s);
      g.beginPath();
      if (o.motif === 'ronds') for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(cx + dx * s * 0.45 + s * 0.3, cy + dy * s * 0.45); g.arc(cx + dx * s * 0.45, cy + dy * s * 0.45, s * 0.3, 0, TAU); }
      else if (o.motif === 'losange') { g.moveTo(cx, cy - s * 0.78); g.lineTo(cx + s * 0.78, cy); g.lineTo(cx, cy + s * 0.78); g.lineTo(cx - s * 0.78, cy); g.closePath(); }
      else if (o.motif === 'croix') { const a = s * 0.78, t = s * 0.26; g.rect(cx - a, cy - t, 2 * a, 2 * t); g.rect(cx - t, cy - a, 2 * t, 2 * a); }
      else { for (const dx of [-1, 1]) for (const dy of [-1, 1]) g.rect(cx + (dx > 0 ? s * 0.1 : -s * 0.8), cy + (dy > 0 ? s * 0.1 : -s * 0.8), s * 0.7, s * 0.7); }
      g.fill();
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 5 : o.stains, specks: 160, cracks: 2 });
  };
}
/* Ossuaire : rangs de crânes et de têtes d'os longs (catacombes). */
function gxOssuary(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, k = w / 512, bone = o.bone || [200, 186, 150];
    g.fillStyle = rgbS(o.bg || [22, 18, 14]); g.fillRect(0, 0, w, h);
    const cols = Math.max(2, Math.round(w / ((o.skull || 0.2) * ppm))), cw = w / cols;
    const pat = o.pattern || ['c', 'o', 'o', 'c', 'o'], unit = pat.reduce((s, p) => s + (p === 'c' ? 1.05 : 0.42), 0);
    const reps = Math.max(1, Math.round(h / (unit * cw))), sc = h / (reps * unit * cw);
    const skull = (cx, cy, s, col) => {
      const gr = g.createRadialGradient(cx - s * 0.15, cy - s * 0.2, s * 0.05, cx, cy, s * 0.6);
      gr.addColorStop(0, rgbS(shadec(col, 1.12))); gr.addColorStop(0.75, rgbS(col)); gr.addColorStop(1, rgbS(shadec(col, 0.5)));
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy - s * 0.06, s * 0.44, s * 0.42, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(cx, cy + s * 0.2, s * 0.3, s * 0.22, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgb(16,12,10)';
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * s * 0.16, cy + s * 0.02, s * 0.11, s * 0.1, sx * 0.25, 0, TAU); g.fill(); }
      g.beginPath(); g.moveTo(cx, cy + s * 0.1); g.lineTo(cx - s * 0.05, cy + s * 0.2); g.lineTo(cx + s * 0.05, cy + s * 0.2); g.closePath(); g.fill();
      for (let t = -2; t <= 2; t++) { g.fillStyle = 'rgba(10,8,6,0.85)'; g.fillRect(cx + t * s * 0.065 - s * 0.006, cy + s * 0.27, Math.max(1, s * 0.012), s * 0.09); }
    };
    const knobs = (cx, cy, s, col) => {
      for (const dx of [-0.22, 0.22]) {
        const gr = g.createRadialGradient(cx + dx * s - s * 0.06, cy - s * 0.06, s * 0.02, cx + dx * s, cy, s * 0.26);
        gr.addColorStop(0, rgbS(shadec(col, 1.1))); gr.addColorStop(1, rgbS(shadec(col, 0.55)));
        g.fillStyle = gr; g.beginPath(); g.arc(cx + dx * s, cy, s * 0.22, 0, TAU); g.fill();
      }
    };
    let y = 0;
    for (let r = 0; r < reps; r++) for (const p of pat) {
      const rh = (p === 'c' ? 1.05 : 0.42) * cw * sc, cy = y + rh / 2, off = p === 'c' ? 0 : ((R() * 2) | 0) * cw / 2;
      for (let i = -1; i <= cols; i++) {
        const cx = i * cw + cw / 2 + off, col = shadec(bone, 0.78 + R() * 0.3);
        wrapAt(w, h, cx, cy, cw, (x, yy) => (p === 'c' ? skull(x, yy, cw * 0.95, col) : knobs(x, yy, cw * 0.9, col)));
      }
      y += rh;
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 8 : o.stains, specks: 200, dark: [20, 14, 8] });
  };
}

/* --------------------------------------------- rayonnages, tuyaux, bûches -- */
function gxBooks(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, k = w / 512, rows = Math.max(1, Math.round(h / ((o.shelf || 0.36) * ppm))), sh = h / rows, wood = o.wood || [96, 64, 40];
    const pal = o.colors || [[110, 30, 26], [36, 60, 40], [30, 40, 70], [90, 60, 30], [24, 22, 20], [130, 100, 50], [70, 30, 50]];
    for (let r = 0; r < rows; r++) {
      const y0 = r * sh, plank = sh * 0.09;
      g.fillStyle = 'rgb(14,10,8)'; g.fillRect(0, y0, w, sh);
      const ws = [];
      let sum = 0;
      while (sum < w) { const bw = (0.018 + R() * 0.045) * ppm; ws.push(bw); sum += bw; }
      const f = w / sum;
      let x = 0;
      for (const bw0 of ws) {
        const bw = bw0 * f, bh = (sh - plank) * (0.62 + R() * 0.32), col = shadec(gxPick(R, pal), 0.75 + R() * 0.4), yb = y0 + sh - plank;
        if (R() < 0.06) { x += bw; continue; }
        const gr = g.createLinearGradient(x, 0, x + bw, 0);
        gr.addColorStop(0, rgbS(shadec(col, 0.55))); gr.addColorStop(0.35, rgbS(col)); gr.addColorStop(1, rgbS(shadec(col, 0.6)));
        g.fillStyle = gr; g.fillRect(x + 0.4 * k, yb - bh, bw - 0.8 * k, bh);
        if (R() < 0.6) { g.fillStyle = 'rgba(210,170,80,0.7)'; g.fillRect(x + bw * 0.15, yb - bh + bh * 0.1, bw * 0.7, Math.max(1, 1.4 * k)); g.fillRect(x + bw * 0.15, yb - bh * 0.18, bw * 0.7, Math.max(1, 1.4 * k)); }
        x += bw;
      }
      const gp = g.createLinearGradient(0, y0 + sh - plank, 0, y0 + sh);
      gp.addColorStop(0, rgbS(shadec(wood, 1.2))); gp.addColorStop(1, rgbS(shadec(wood, 0.6)));
      g.fillStyle = gp; g.fillRect(0, y0 + sh - plank, w, plank);
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 120 });
  };
}
function gxPipes(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, k = w / 512;
    tgConcrete({ base: o.wall || [110, 108, 102], cracks: 3, stains: 4 })(g, w, h, R);
    const pal = o.colors || [[150, 40, 32], [200, 160, 40], [60, 100, 60], [60, 80, 120], [120, 122, 124]];
    const pipe = (x0, x1, y0, y1, vert, col) => {
      const gr = vert ? g.createLinearGradient(x0, 0, x1, 0) : g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, rgbS(shadec(col, 0.35))); gr.addColorStop(0.3, rgbS(shadec(col, 1.2))); gr.addColorStop(0.55, rgbS(col)); gr.addColorStop(1, rgbS(shadec(col, 0.3)));
      g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    };
    const nh = o.horizontal === undefined ? 1 : o.horizontal;
    for (let i = 0; i < nh; i++) {
      const y = R() * h, d = (0.06 + R() * 0.12) * ppm, col = gxPick(R, pal);
      for (const oy of [0, h, -h]) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y + oy - d / 2 + 4 * k, w, d); pipe(0, w, y + oy - d / 2, y + oy + d / 2, false, col); }
    }
    let x = R() * w * 0.1;
    while (x < w * 0.95) {
      const d = (0.05 + R() * 0.16) * ppm, col = gxPick(R, pal);
      if (x + d > w) break;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 5 * k, 0, d, h);
      pipe(x, x + d, 0, h, true, col);
      for (let j = 0; j < 2; j++) {
        const y = R() * h;
        for (const oy of [0, h, -h]) { g.fillStyle = rgbS(shadec(col, 0.7)); g.fillRect(x - d * 0.12, y + oy, d * 1.24, d * 0.25); g.fillStyle = 'rgba(30,30,30,0.9)'; g.fillRect(x - d * 0.3, y + oy + d * 0.05, d * 0.2, d * 0.15); g.fillRect(x + d * 1.1, y + oy + d * 0.05, d * 0.2, d * 0.15); }
      }
      x += d + (0.04 + R() * 0.2) * ppm;
    }
    rustify(g, w, h, R, o.rust || 0);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 4 : o.stains, specks: 60, drips: 6 });
  };
}
function gxWoodpile(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, k = w / 512, rmin = (o.rmin || 0.05) * ppm, rmax = (o.rmax || 0.11) * ppm, wood = o.color || [176, 136, 90], bark = o.bark || [70, 50, 34];
    g.fillStyle = 'rgb(18,13,9)'; g.fillRect(0, 0, w, h);
    const logs = [];
    for (let t = 0; t < 5000 && logs.length < 400; t++) {
      const r = rmin + R() * (rmax - rmin), x = R() * w, y = R() * h;
      let ok = true;
      for (const [x2, y2, r2] of logs) {
        let dx = Math.abs(x - x2), dy = Math.abs(y - y2);
        if (dx > w / 2) dx = w - dx;
        if (dy > h / 2) dy = h - dy;
        if (dx * dx + dy * dy < (r + r2) * (r + r2) * 0.92) { ok = false; break; }
      }
      if (ok) logs.push([x, y, r]);
    }
    for (const [x, y, r] of logs) {
      const col = shadec(wood, 0.8 + R() * 0.3), bk = shadec(bark, 0.8 + R() * 0.3), ox = (R() - 0.5) * r * 0.3, oy = (R() - 0.5) * r * 0.3, rings = 3 + ((R() * 5) | 0), cracks = (R() * 4) | 0, ang = [];
      for (let c = 0; c < cracks; c++) ang.push(R() * TAU);
      wrapAt(w, h, x, y, r, (cx, cy) => {
        g.fillStyle = rgbS(bk); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
        const gr = g.createRadialGradient(cx + ox, cy + oy, 0, cx, cy, r * 0.86);
        gr.addColorStop(0, rgbS(shadec(col, 0.85))); gr.addColorStop(0.6, rgbS(col)); gr.addColorStop(1, rgbS(shadec(col, 0.7)));
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * 0.86, 0, TAU); g.fill();
        g.strokeStyle = rgbS(shadec(col, 0.62), 0.6); g.lineWidth = Math.max(0.6, 0.7 * k);
        for (let i = 1; i <= rings; i++) { g.beginPath(); g.arc(cx + ox * (1 - i / rings), cy + oy * (1 - i / rings), (r * 0.82 * i) / (rings + 0.6), 0, TAU); g.stroke(); }
        g.strokeStyle = 'rgba(20,12,6,0.7)'; g.lineWidth = Math.max(0.8, 1.1 * k);
        for (const a of ang) { g.beginPath(); g.moveTo(cx + ox, cy + oy); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke(); }
      });
    }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 60 });
  };
}

/* ---------------------------------------- panneaux de bois, liège, carton, mousse -- */
function gxOSB(o) {
  return (g, w, h, R) => {
    const k = w / 512, area = (w * h) / 262144, b = o.color || [196, 162, 108];
    fillBase(g, w, h, shadec(b, 0.8), R, [[4, 4, 1], [16, 16, 0.5]], 0.2);
    for (let i = 0; i < Math.round(5200 * area); i++) {
      const x = R() * w, y = R() * h, l = (12 + R() * 30) * k, t = (5 + R() * 10) * k, a = R() * TAU, col = shadec(mixc(b, [150, 110, 64], R() * 0.6), 0.78 + R() * 0.36);
      wrapAt(w, h, x, y, l, (cx, cy) => { g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = rgbS(col, 0.92); g.fillRect(-l / 2, -t / 2, l, t); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-l / 2, t / 2 - k, l, k); g.restore(); });
    }
    if (o.paint) paintOver(g, w, h, R, o.paint, o.peel || 0.3);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 60 });
  };
}
function gxPlywood(o) {
  return (g, w, h, R) => {
    const b = o.color || [198, 160, 112], warp = vnoise(w, h, [[2, 3, 1], [4, 6, 0.5], [8, 12, 0.25]], 1.2, R), n = vnoise(w, h, [[4, 4, 1], [32, 32, 0.4]], 1.5, R);
    const bands = o.bands || 22;
    gxPaint(g, null, w, h, (x, y, c) => {
      const i = y * w + x, t = (y / h) * bands + warp[i] * 6, s = 0.5 + 0.5 * Math.sin(t * TAU), k = (0.8 + 0.18 * Math.pow(s, 3)) * (0.9 + 0.14 * n[i]);
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    if (o.sheets) { const k = w / 512, s = w / o.sheets; g.fillStyle = 'rgba(20,14,8,0.7)'; for (let i = 0; i < o.sheets; i++) g.fillRect(i * s, 0, 2 * k, h); g.fillRect(0, 0, w, 2 * k); }
    if (o.paint) paintOver(g, w, h, R, o.paint, o.peel || 0.3);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 60, drips: o.drips || 0 });
  };
}
function gxCork(o) {
  return (g, w, h, R) => {
    const k = w / 512, area = (w * h) / 262144, b = o.color || [168, 120, 76];
    fillBase(g, w, h, b, R, [[8, 8, 1], [48, 48, 0.6], [160, 160, 0.5]], 0.45, 2.2);
    for (let i = 0; i < Math.round(4200 * area); i++) { g.fillStyle = R() < 0.6 ? rgbS(shadec(b, 0.45), 0.7) : rgbS(shadec(b, 1.35), 0.6); const s = (1 + R() * 2.6) * k; g.fillRect(R() * w, R() * h, s, s); }
    if (o.tiles) { const s = w / o.tiles; g.fillStyle = 'rgba(40,24,12,0.6)'; for (let i = 0; i < o.tiles; i++) { g.fillRect(i * s, 0, 1.6 * k, h); g.fillRect(0, i * s, w, 1.6 * k); } }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 2 : o.stains, specks: 30 });
  };
}
function gxCardboard(o) {
  return (g, w, h, R) => {
    const k = w / 512, b = o.color || [176, 138, 92], n = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.3]], 1.6, R), pitch = 6 * k;
    gxPaint(g, null, w, h, (x, y, c) => { const kk = (0.88 + 0.1 * Math.sin((x / pitch) * TAU)) * (0.86 + 0.22 * n[y * w + x]); c[0] = b[0] * kk; c[1] = b[1] * kk; c[2] = b[2] * kk; });
    for (let i = 0; i < (o.tape || 3); i++) { const y = R() * h, th = (16 + R() * 10) * k; g.fillStyle = rgbS(o.tapeColor || [200, 176, 120], 0.75); g.fillRect(0, y, w, th); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y, w, 2 * k); }
    if (o.seams) { g.fillStyle = 'rgba(40,26,12,0.6)'; for (let i = 0; i < o.seams; i++) g.fillRect((w * i) / o.seams, 0, 2 * k, h); }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 6 : o.stains, specks: 60, drips: 4 });
  };
}
/* Mousse acoustique (pointes de diamant). */
function gxFoam(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, n = Math.max(2, Math.round(w / ((o.cell || 0.1) * ppm))), m = Math.max(2, Math.round(h / ((o.cell || 0.1) * ppm))), cw = w / n, ch = h / m, b = o.color;
    const nz = vnoise(w, h, [[32, 32, 1], [96, 96, 0.6]], 1.6, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const fx = gxFr(x / cw) - 0.5, fy = gxFr(y / ch) - 0.5;
      let k = Math.abs(fx) > Math.abs(fy) ? (fx < 0 ? 1.15 : 0.62) : fy < 0 ? 1.0 : 0.72;
      k *= 0.9 + 0.2 * nz[y * w + x];
      const tip = 1 - 2 * Math.max(Math.abs(fx), Math.abs(fy));
      k *= 0.75 + 0.35 * tip;
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 2 : o.stains, specks: 40 });
  };
}
/* Bâche plastique : plis (relief d'un bruit étiré), œillets au bord du lé. */
function gxTarp(o) {
  return (g, w, h, R) => {
    const b = o.color, H = vnoise(w, h, [[3, 2, 1], [7, 4, 0.6], [14, 9, 0.3]], 1.6, R), E = gxEmboss(H, w, h, 0.55), n = vnoise(w, h, [[32, 32, 1]], 1.2, R);
    gxPaint(g, null, w, h, (x, y, c) => { const i = y * w + x, k = E[i] * (0.9 + 0.12 * n[i]); c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k; });
    const k = w / 512;
    if (o.eyelets) for (let x = 20 * k; x < w; x += 64 * k) { g.fillStyle = 'rgb(180,180,176)'; g.beginPath(); g.arc(x, 12 * k, 5 * k, 0, TAU); g.fill(); g.fillStyle = 'rgb(20,20,20)'; g.beginPath(); g.arc(x, 12 * k, 2.6 * k, 0, TAU); g.fill(); }
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 5 : o.stains, specks: 60, drips: 4 });
  };
}

/* ---------------------------------------------------------- sols spéciaux -- */
/* Lumière ondulante d'une piscine (caustiques) par-dessus une autre texture. */
function gxCaustics(base, o) {
  return (g, w, h, R) => {
    base(g, w, h, R);
    const n1 = vnoise(w, h, [[3, 3, 1], [6, 6, 0.5]], 1.4, R), n2 = vnoise(w, h, [[4, 4, 1], [8, 8, 0.5]], 1.4, R), f = o.freq || 5;
    const img = g.getImageData(0, 0, w, h), d = img.data, lc = o.light || [200, 240, 255];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, a = Math.sin(((x / w) * f + n1[i] * 2.2) * TAU) + Math.sin(((y / h) * f + n2[i] * 2.2) * TAU);
      const t = Math.pow(1 - Math.min(1, Math.abs(a) * 0.9), 6) * (o.strength || 0.55);
      d[i * 4] = lerp(d[i * 4], lc[0], t); d[i * 4 + 1] = lerp(d[i * 4 + 1], lc[1], t); d[i * 4 + 2] = lerp(d[i * 4 + 2], lc[2], t);
    }
    g.putImageData(img, 0, 0);
  };
}
/* Résine de sol (époxy) : unie et brillante, marbrures légères ; lignes de marquage, paillettes. */
function gxEpoxy(o) {
  return (g, w, h, R) => {
    const k = w / 512, b = o.color;
    fillBase(g, w, h, b, R, [[3, 3, 1], [9, 9, 0.5], [40, 40, 0.2]], 0.14, 1.6);
    if (o.flakes) for (let i = 0; i < 2600 * (w * h) / 262144; i++) { g.fillStyle = rgbS(gxPick(R, o.flakes), 0.85); g.fillRect(R() * w, R() * h, (1 + R() * 2.4) * k, (1 + R() * 2) * k); }
    if (o.lines) {
      const lc = o.lineColor || [214, 176, 40];
      g.fillStyle = rgbS(lc, 0.9); g.fillRect(w * 0.12, 0, 0.05 * w, h);
      if (o.lines > 1) { g.save(); g.beginPath(); g.rect(w * 0.62, 0, 0.12 * w, h); g.clip(); for (let y = -w; y < h + w; y += 0.08 * w) { g.beginPath(); g.moveTo(w * 0.62, y); g.lineTo(w * 0.74, y + 0.12 * w); g.lineTo(w * 0.74, y + 0.16 * w); g.lineTo(w * 0.62, y + 0.04 * w); g.fill(); } g.restore(); }
      const ln = vnoise(w, h, [[8, 8, 1], [48, 48, 0.5]], 2.4, R), img = g.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < w * h; i++) if (ln[i] < 0.28) { d[i * 4] *= 0.85; d[i * 4 + 1] *= 0.85; d[i * 4 + 2] *= 0.85; }
      g.putImageData(img, 0, 0);
    }
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 30, cracks: o.cracks || 0 });
  };
}
/* Marquages sur l'asphalte : passage piéton (zebra) ou places de parking. */
function gxRoadMark(o) {
  return (g, w, h, R) => {
    tgAsphalt({ tile: o.tile, color: o.color, cracks: o.cracks || 2 })(g, w, h, R);
    const ppm = w / o.tile, lc = o.line || [226, 224, 214];
    g.fillStyle = rgbS(lc, 0.88);
    if (o.kind === 'zebra') { const n = Math.max(2, Math.round(w / (1.0 * ppm))); for (let i = 0; i < n; i++) g.fillRect((i + 0.25) * (w / n), h * 0.1, (w / n) * 0.5, h * 0.8); }
    else if (o.kind === 'parking') { const n = Math.max(1, Math.round(w / (2.5 * ppm))); for (let i = 0; i < n; i++) g.fillRect(i * (w / n), 0, 0.12 * ppm, h * 0.7); g.fillRect(0, h * 0.94, w, 0.12 * ppm); }
    else if (o.kind === 'stop') { g.fillRect(0, h * 0.45, w, 0.3 * ppm); }
    const ln = vnoise(w, h, [[8, 8, 1], [48, 48, 0.5]], 2.4, R), img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < w * h; i++) if (ln[i] < 0.32) { d[i * 4] *= 0.78; d[i * 4 + 1] *= 0.78; d[i * 4 + 2] *= 0.78; }
    g.putImageData(img, 0, 0);
    overlay(g, w, h, R, o);
  };
}

/* ------------------------------------------------- carreaux à motif, caissons -- */
/* Octogones et cabochons (carrelage d'entrée à l'ancienne). */
function gxCabochon(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, n = Math.max(1, Math.round(w / ((o.size || 0.2) * ppm))), s = w / n, m = Math.max(1, Math.round(h / s)), sy = h / m;
    const a = o.c1, b = o.c2, gc = o.groutColor || [70, 66, 60], cab = o.cab || 0.22, gw = 0.025, nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5]], 1.6, R), sd = gxSeed(R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const fx = gxFr(x / s), fy = gxFr(y / sy), dc = Math.min(fx, 1 - fx) + Math.min(fy, 1 - fy), v = nz[y * w + x];
      const ix = Math.floor(x / s), iy = Math.floor(y / sy), vr = 0.94 + 0.12 * gxH(ix, iy, sd);
      let col, k;
      if (Math.abs(dc - cab) < gw || fx < gw / 2 || fx > 1 - gw / 2 || fy < gw / 2 || fy > 1 - gw / 2) { col = gc; k = 0.8 + 0.3 * v; }
      else if (dc < cab) { col = b; k = (0.9 + 0.16 * v); }
      else { col = a; k = (0.9 + 0.16 * v) * vr; }
      c[0] = col[0] * k; c[1] = col[1] * k; c[2] = col[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 60, cracks: o.cracks || 0, dark: [40, 34, 24] });
  };
}
/* Carreaux de ciment : motif symétrique par carreau (étoile, rosace, fleur, losanges, cercles, croix). */
function gxCementTile(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, n = Math.max(1, Math.round(w / ((o.size || 0.2) * ppm))), s = w / n, m = Math.max(1, Math.round(h / s)), sy = h / m;
    const [c0, c1, c2] = o.colors, motif = o.motif || 'etoile', nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.2]], 1.6, R), gc = shadec(c0, 0.6);
    gxPaint(g, null, w, h, (x, y, c) => {
      const fx = gxFr(x / s), fy = gxFr(y / sy), u = fx - 0.5, v = fy - 0.5, r = Math.hypot(u, v), th = Math.atan2(v, u), nv = nz[y * w + x];
      let col = c0;
      if (fx < 0.012 || fy < 0.012) col = gc;
      else if (motif === 'etoile') { if (r < 0.2 + 0.12 * Math.abs(Math.cos(th * 4))) col = c1; else if (Math.min(fx, 1 - fx) + Math.min(fy, 1 - fy) < 0.18) col = c2; }
      else if (motif === 'rosace') { if (r < 0.12) col = c2; else if (r < 0.34 + 0.08 * Math.cos(th * 8)) col = c1; else if (r > 0.42 && r < 0.46) col = c2; }
      else if (motif === 'fleur') { const p = Math.abs(Math.cos(th * 2)); if (r < 0.1) col = c2; else if (r < 0.42 * p) col = c1; else if (Math.min(Math.hypot(fx, fy), Math.hypot(1 - fx, fy), Math.hypot(fx, 1 - fy), Math.hypot(1 - fx, 1 - fy)) < 0.22) col = c2; }
      else if (motif === 'losanges') { const d = Math.abs(u) + Math.abs(v); if (d < 0.18) col = c2; else if (d < 0.36 && d > 0.26) col = c1; else if (d > 0.46) col = c1; }
      else if (motif === 'cercles') { const d = Math.min(Math.hypot(fx, fy), Math.hypot(1 - fx, fy), Math.hypot(fx, 1 - fy), Math.hypot(1 - fx, 1 - fy)); if (d < 0.5 && d > 0.42) col = c1; else if (r < 0.2) col = c2; else if (d < 0.2) col = c1; }
      else { if (Math.abs(u) < 0.08 || Math.abs(v) < 0.08) col = c1; else if (Math.abs(Math.abs(u) - Math.abs(v)) < 0.05 && r < 0.4) col = c2; }
      const k = 0.88 + 0.18 * nv;
      c[0] = col[0] * k; c[1] = col[1] * k; c[2] = col[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 4 : o.stains, specks: 80, cracks: o.cracks || 0, dark: [40, 34, 24] });
  };
}
/* Plafond à caissons (bois ou plâtre). */
function gxCoffer(o) {
  return (g, w, h, R) => {
    const ppm = w / o.tile, n = Math.max(1, Math.round(w / ((o.size || 0.8) * ppm))), s = w / n, m = Math.max(1, Math.round(h / s)), sy = h / m, b = o.color;
    const nz = vnoise(w, h, [[4, 4, 1], [16, 16, 0.5], [64, 64, 0.25]], 1.6, R), grain = o.wood ? vnoise(w, h, [[2, 48, 1], [4, 96, 0.5]], 1.6, R) : null;
    gxPaint(g, null, w, h, (x, y, c) => {
      const fx = gxFr(x / s), fy = gxFr(y / sy), i = y * w + x, beam = 0.12, bev = 0.08;
      let k;
      const ex = Math.min(fx, 1 - fx), ey = Math.min(fy, 1 - fy), e = Math.min(ex, ey);
      if (e < beam / 2) k = 1.0;
      else if (e < beam / 2 + bev) k = ex < ey ? (fx < 0.5 ? 1.25 : 0.62) : fy < 0.5 ? 1.15 : 0.55;
      else k = 0.78;
      k *= 0.86 + 0.24 * nz[i];
      if (grain) k *= 0.85 + 0.2 * grain[i];
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    gxFinish(g, w, h, R, o, { stains: o.stains === undefined ? 3 : o.stains, specks: 40, drips: o.drips || 0 });
  };
}

/* ------------------------------------------------------- horreur, tags -- */
/* Paroi organique : chair, veines, pustules, reflets humides. */
function gxOrganic(o) {
  return (g, w, h, R) => {
    const k = w / 512, b = o.color, H = vnoise(w, h, [[4, 4, 1], [12, 12, 0.6], [32, 32, 0.3]], 2.0, R), E = gxEmboss(H, w, h, 1.6);
    gxPaint(g, null, w, h, (x, y, c) => { const i = y * w + x, kk = E[i] * (0.65 + 0.5 * H[i]); c[0] = b[0] * kk; c[1] = b[1] * kk; c[2] = b[2] * kk; });
    const vein = o.vein || [90, 20, 50];
    for (let i = 0; i < 26; i++) crackR(g, w, h, R, R() * w, R() * h, 8 + ((R() * 12) | 0), 10 * k, (1 + R() * 2.4) * k, rgbS(vein, 0.55));
    for (let i = 0; i < 12; i++) { const x = R() * w, y = R() * h, r = (5 + R() * 12) * k; softBlot(g, w, h, x, y, r * 1.8, 'rgba(60,10,10,0.35)'); softBlot(g, w, h, x, y, r, rgbS(o.pus || [200, 180, 90], 0.8)); softBlot(g, w, h, x - r * 0.3, y - r * 0.3, r * 0.35, 'rgba(255,255,240,0.5)'); }
    for (let i = 0; i < 8; i++) softBlot(g, w, h, R() * w, R() * h, (20 + R() * 40) * k, 'rgba(255,230,230,0.08)');
    overlay(g, w, h, R, o);
  };
}
/* Graffitis : traits de bombe épais cernés, coulures, par-dessus un mur. */
function gxGraffiti(base, o) {
  return (g, w, h, R) => {
    base(g, w, h, R);
    const k = w / 512, pal = o.colors || [[220, 40, 60], [40, 160, 220], [250, 200, 30], [60, 200, 90], [240, 240, 240], [150, 60, 200]];
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let t = 0; t < (o.tags || 4); t++) {
      const col = gxPick(R, pal), out = R() < 0.6 ? [16, 16, 18] : gxPick(R, pal), x0 = R() * w * 0.7, y0 = h * (0.2 + R() * 0.6), len = (90 + R() * 160) * k;
      const pts = [];
      let x = x0, y = y0, a = (R() - 0.5) * 0.6;
      for (let i = 0; i < 9 + ((R() * 8) | 0); i++) { pts.push([x, y]); a += (R() - 0.5) * 2.6; x += Math.cos(a) * len * 0.12 + len * 0.05; y += Math.sin(a) * len * 0.12; }
      for (const [lw, c, al] of [[(16 + R() * 10) * k, out, 0.9], [(10 + R() * 6) * k, col, 0.95]]) {
        g.strokeStyle = rgbS(c, al); g.lineWidth = lw;
        for (const ox of [-w, 0, w]) { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px + ox, py) : g.moveTo(px + ox, py))); g.stroke(); }
      }
      for (let d = 0; d < 4; d++) { const [px, py] = gxPick(R, pts), dl = (20 + R() * 60) * k; g.fillStyle = rgbS(col, 0.8); g.fillRect(px, py, 2.4 * k, dl); }
    }
    overlay(g, w, h, R, o);
  };
}

/* ------------------------------------------------------ copies du jeu -- */
/* Textures des objets du jeu (planches de barricade, portes, caisse, métal…) : dessinées par leurs
   générateurs d'origine, mises à l'échelle (leur aléa n'est pas reproductible : vignettes changeantes). */
function gxLegacy(make) {
  return (g, w, h) => {
    const c = make();
    g.drawImage(c, 0, 0, c.width, c.height, 0, 0, w, h);
  };
}
/* Sols des mondes ouverts : sable de Khamsin (rides, grains), régolithe de la Lune (cailloux). */
function gxDune(o) {
  return (g, w, h, R) => {
    const b = o.color, n = vnoise(w, h, [[16, 16, 1], [64, 64, 0.5]], 1.4, R), n2 = vnoise(w, h, [[3, 3, 1], [8, 8, 0.5]], 1.6, R);
    gxPaint(g, null, w, h, (x, y, c) => {
      const i = y * w + x, rr = Math.sin(((y / h) * 64 + Math.sin((x / w) * TAU * 3) * 1.6) * TAU) * 0.5 + 0.5;
      const k = (0.94 + (n[i] - 0.5) * 0.1 + (rr - 0.5) * (o.ripples === undefined ? 0.05 : o.ripples)) * (0.9 + 0.16 * n2[i]) + (R() - 0.5) * 0.05;
      c[0] = b[0] * k; c[1] = b[1] * k; c[2] = b[2] * k;
    });
    overlay(g, w, h, R, o);
  };
}
function gxRegolith(o) {
  return (g, w, h, R) => {
    const b = o.color, k = w / 512, n = vnoise(w, h, [[8, 8, 1], [32, 32, 0.55], [128, 128, 0.25]], 1.5, R);
    gxPaint(g, null, w, h, (x, y, c) => { const kk = 0.94 + (n[y * w + x] - 0.5) * 0.16 + (R() - 0.5) * 0.07; c[0] = b[0] * kk; c[1] = b[1] * kk; c[2] = b[2] * kk; });
    for (let i = 0; i < (o.pebbles || 520) * (w * h) / 262144; i++) {
      const x = R() * w, y = R() * h, r = (1 + R() * R() * 6) * k, v = 0.8 + R() * 0.3;
      g.fillStyle = 'rgba(30,28,26,0.4)'; g.beginPath(); g.ellipse(x - r * 0.9, y - r * 0.2, r * 1.3, r * 0.8, 0, 0, TAU); g.fill();
      g.fillStyle = rgbS(shadec(b, v)); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    if (o.craters) for (let i = 0; i < o.craters; i++) { const x = R() * w, y = R() * h, r = (14 + R() * 40) * k; softBlot(g, w, h, x + r * 0.2, y, r, 'rgba(20,20,20,0.25)'); wrapAt(w, h, x, y, r, (cx, cy) => { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2 * k; g.beginPath(); g.arc(cx, cy, r * 0.9, Math.PI * 0.6, Math.PI * 1.6); g.stroke(); }); }
    overlay(g, w, h, R, o);
  };
}
/* Mains ensanglantées et traînées par-dessus un mur (horreur). */
function gxHands(base, o) {
  return (g, w, h, R) => {
    base(g, w, h, R);
    const k = w / 512, col = o.blood || [96, 6, 10];
    for (let i = 0; i < (o.hands || 7); i++) {
      const x = R() * w, y = h * (0.15 + R() * 0.7), s = (22 + R() * 8) * k, a = (R() - 0.5) * 0.9, al = 0.55 + R() * 0.35;
      wrapAt(w, h, x, y, s * 2, (cx, cy) => {
        g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = rgbS(col, al);
        g.beginPath(); g.ellipse(0, s * 0.35, s * 0.42, s * 0.48, 0, 0, TAU); g.fill();
        for (const [fx, fl, fa] of [[-0.36, 0.62, -0.25], [-0.14, 0.8, -0.06], [0.08, 0.84, 0.04], [0.28, 0.72, 0.16], [0.5, 0.48, 0.9]]) {
          g.save(); g.translate(fx * s, -s * 0.05); g.rotate(fa); g.beginPath(); g.ellipse(0, -fl * s * 0.5, s * 0.1, fl * s * 0.5, 0, 0, TAU); g.fill(); g.restore();
        }
        g.restore();
      });
      if (R() < 0.5) { const len = (60 + R() * 140) * k; for (let d = 0; d < 4; d++) { g.fillStyle = rgbS(col, al * 0.8); g.fillRect(x - s * 0.3 + d * s * 0.18, y + s * 0.3, 2.6 * k, len * (0.4 + R() * 0.6)); } }
    }
    overlay(g, w, h, R, o);
  };
}

/* Vignette d'une texture sans la garder (jeu 2.0.4 : des milliers de textures ; les Mod Tools gardent
   les leurs dans leur propre cache). Même rendu que textureThumb. */
function textureThumbRaw(id, px = 96) {
  const d0 = TEXLIB[id];
  if (d0 && d0.variant) return textureThumbRaw(d0.variant, px);
  const c = makeCanvas(px, px), g = c.getContext('2d', { willReadFrequently: true });
  if (!d0) { g.fillStyle = '#222'; g.fillRect(0, 0, px, px); return c; }
  if (d0.image) { const img = new Image(); img.onload = () => g.drawImage(img, 0, 0, px, px); img.src = d0.image; return c; }
  const hh = Math.max(8, Math.round((px * d0.size[1]) / d0.size[0])), tmp = makeCanvas(px, hh);
  d0.gen(tmp.getContext('2d', { willReadFrequently: true }), px, hh, mulberry32(hashStr(d0.id)));
  g.drawImage(tmp, 0, 0, px, hh, 0, 0, px, px);
  return c;
}
