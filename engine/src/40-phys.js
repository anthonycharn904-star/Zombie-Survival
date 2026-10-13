/* ------------------------------------------------- Corps, rayons, flux --
   Un corps (joueur, zombie) garde k = couche · 2²⁴ + z · 4096 + x : la case où il se tient. */
const owK = (layer, cx, cz) => layer * 16777216 + cz * 4096 + cx;
const owKx = (k) => (k % 16777216) % 4096;
const owKz = (k) => ((k % 16777216) / 4096) | 0;
const owKl = (k) => (k / 16777216) | 0;
/* Corps après un déplacement : cases infranchissables (non praticables, ou marche de plus de
   0,75 m) repoussées comme dans le reste du jeu, puis posé sur le sol. Le joueur tombe d'un
   rebord (sa hauteur reste continue) au lieu de descendre d'un coup. */
function owSettle(b, r) {
  if (OW.decks) { luSettle(b, r); return; }           // Lune : tabliers, chutes, glissades
  const layer = b.layer | 0;
  let cx0, cz0;
  if (b.k >= 0 && owKl(b.k) === layer) { cx0 = owKx(b.k); cz0 = owKz(b.k); }
  else { cx0 = Math.floor(b.pos.x); cz0 = Math.floor(b.pos.z); }
  const gy0 = Number.isFinite(b.gy) ? b.gy : owGroundAt(layer, b.pos.x, b.pos.z);
  // jeu 2.0.3 : le joueur au-dessus d'un plafond (pente d'une pyramide au-dessus de ses salles, toit)
  // marche sur le toit au lieu de tomber dans la salle
  const foot = b === player ? gy0 + Math.max(0, player.y) : -Infinity;
  const blocked = (cx, cz) => {
    if (cx === cx0 && cz === cz0) return false;
    if (!owWalkCell(layer, cx, cz)) return true;
    return owRoofGround(layer, cx + 0.5, cz + 0.5, foot) > gy0 + 0.75 + (b === player ? Math.max(0, player.y) : 0);   // en sautant, on monte sur une caisse
  };
  collideCircle(b.pos, r, blocked);
  if (VEH.list.length) vehPushBody(b, r);
  let cx = Math.floor(b.pos.x), cz = Math.floor(b.pos.z);
  if ((cx !== cx0 || cz !== cz0) && blocked(cx, cz)) {
    // case d'arrivée fermée (grand déplacement, coin) : le corps reste au bord de la sienne
    b.pos.x = clamp(b.pos.x, cx0 + 0.001, cx0 + 0.999);
    b.pos.z = clamp(b.pos.z, cz0 + 0.001, cz0 + 0.999);
    cx = cx0; cz = cz0;
  }
  let g = owRoofGround(layer, b.pos.x, b.pos.z, foot);
  if (!Number.isFinite(g)) g = gy0;
  if (b === player) {
    // hauteur absolue continue : un rebord fait tomber, une montée pendant le saut se rattrape
    const A = gy0 + player.y;
    if (player.grounded) {
      if (gy0 - g > 0.45) { player.y = gy0 - g; player.grounded = false; player.vy = 0; }
    } else {
      player.y = A - g;
      if (player.y <= 0) { player.y = 0; player.vy = 0; player.grounded = true; }
    }
  }
  b.gy = g;
  b.k = owK(layer, cx, cz);
}

/* Sol sous des pieds à la hauteur foot : le toit d'une case couverte (sol, rampe) quand les pieds sont
   au-dessus de son plafond (jeu 2.0.3 : on marche sur la pente d'une pyramide au-dessus de ses salles). */
function owRoofGround(layer, x, z, foot) {
  const g = owGroundAt(layer, x, z);
  if (layer || !(foot > g + 1.5)) return g;
  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(OW.surf, cx, cz);
  if (!ch) return g;
  const i = owIdx(cx, cz), k = ch.kind[i];
  if ((k === OWK.FLOOR || k === OWK.RAMP || k === OWK.DOOR) && ch.ceil[i] > 0 && ch.roof[i] > ch.ceil[i] && foot > ch.ceil[i] + 0.3) return ch.roof[i];
  return g;
}
/* Nœud d'un corps en (x, z) : la couche dont le sol est le plus proche de yHint ; -1 hors du monde
   (équivalent de locateNode). walkOnly : seulement une case praticable. */
function owLocate(x, z, yHint = 0, walkOnly = false) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= 4096 || cz >= 3072) return -1;
  let best = -1, bd = Infinity;
  for (let layer = 0; layer < 2; layer++) {
    if (layer && (!OW.under || !OW.under.n || !owChunk(OW.under, cx, cz))) break;
    if (walkOnly && !owWalkCell(layer, cx, cz)) continue;
    const g = owGroundAt(layer, x, z);
    if (!Number.isFinite(g)) continue;
    const d = Math.abs(g - yHint);
    if (d < bd) { bd = d; best = owK(layer, cx, cz); }
  }
  return best;
}
/* Comme owLocate, mais cherche aussi dans les cases voisines (équivalent de nearestNode). */
function owNearest(x, z, yHint = 0) {
  const k = owLocate(x, z, yHint, true);
  if (k >= 0) return k;
  let best = -1, bd = Infinity;
  for (let r = 1; r <= 3 && best < 0; r++) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const j = owLocate(x + dx, z + dz, yHint, true);
      if (j < 0) continue;
      const d = Math.hypot(dx, dz) + Math.abs(owGroundAt(owKl(j), x + dx, z + dz) - yHint) * 0.5;
      if (d < bd) { bd = d; best = j; }
    }
  }
  return best;
}
/* Corps physique des morts (rdTop) : haut de ce qui occupe la case à la hauteur y ; le terrain
   n'est qu'un sol (rdFloor), jamais un mur. */
function owRdTop(cx, cz, y) {
  const layer = owLayerAt(cx + 0.5, y, cz + 0.5), ch = owChunk(layer ? OW.under : OW.surf, cx, cz);
  if (!ch) return layer ? Infinity : -Infinity;
  const i = owIdx(cx, cz);
  switch (ch.kind[i]) {
    case OWK.SOLID: case OWK.LOW: return y < ch.base[i] - 0.3 ? -Infinity : ch.top[i];
    case OWK.DOOR: return ch.door[i] >= 0 && OW.doors[ch.door[i]] && OW.doors[ch.door[i]].open ? -Infinity : ch.top[i];
    case OWK.WINDOW: return y + 0.05 >= ch.hi[i] ? ch.top[i] : ch.lo[i];
    case OWK.ROCK: return Infinity;
    default: return -Infinity;
  }
}

/* Rayon : terrain (marche puis dichotomie), cases solides (pas de case en case), pyramides comprises.
   Remplit RAY comme raycast (type : matière OWM + 16 si c'est le terrain). */
function owRaycast(ox, oy, oz, dx, dy, dz, maxT) {
  RAY.hit = false;
  let best = maxT, nx = 0, ny = 0, nz = 0, type = 0;
  // Lune : la couche 1 est celle des tabliers (au-dessus du sol), vue à part
  const layer = OW.decks ? 0 : owLayerAt(ox, oy, oz);
  const L = layer ? OW.under : OW.surf;
  // --- terrain (couche de surface seulement)
  if (!layer) {
    let t = 0, f0 = oy - owH(ox, oz);
    if (f0 > -0.05) {
      while (t < best) {
        const y = oy + dy * t, x = ox + dx * t, z = oz + dz * t;
        const step = clamp(Math.max(0.4, (y - owH(x, z)) * 0.6), 0.4, 3);
        const t1 = Math.min(best, t + step);
        const f1 = oy + dy * t1 - owH(ox + dx * t1, oz + dz * t1);
        if (f1 <= 0) {
          let a = t, b = t1;
          for (let it = 0; it < 7; it++) { const m = (a + b) / 2; if (oy + dy * m - owH(ox + dx * m, oz + dz * m) > 0) a = m; else b = m; }
          best = b;
          const hx = ox + dx * b, hz = oz + dz * b;
          owNormal(hx, hz, _owN); nx = _owN.x; ny = _owN.y; nz = _owN.z;
          type = 16 + (owBioAt(hx, hz) === OWB.ROAD || owBioAt(hx, hz) === OWB.RUNWAY ? OWM.STONE : OWM.SAND);
          break;
        }
        t = t1;
      }
    }
  }
  // --- cases solides : pas de case en case, en sautant les morceaux absents
  let cx = Math.floor(ox), cz = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx > 0 ? (cx + 1 - ox) / dx : dx < 0 ? (cx - ox) / dx : Infinity;
  let tmz = dz > 0 ? (cz + 1 - oz) / dz : dz < 0 ? (cz - oz) / dz : Infinity;
  let tEnter = 0, enx = 0, enz = 0;
  for (let guard = 0; guard < 4096 && tEnter < best; guard++) {
    const ch = owChunk(L, cx, cz);
    if (!ch && !layer) {
      // morceau absent : rien que du terrain, on file jusqu'au morceau suivant
      const bx = dx > 0 ? ((cx >> 6) + 1) << 6 : (cx >> 6) << 6, bz = dz > 0 ? ((cz >> 6) + 1) << 6 : (cz >> 6) << 6;
      const tx = dx !== 0 ? (bx - ox) / dx : Infinity, tz = dz !== 0 ? (bz - oz) / dz : Infinity;
      const tn = Math.min(tx, tz);
      if (!(tn < best) || tn > 1e6) break;
      tEnter = tn + 1e-4;
      enx = tx < tz ? -stepX : 0; enz = tx < tz ? 0 : -stepZ;
      cx = Math.floor(ox + dx * tEnter); cz = Math.floor(oz + dz * tEnter);
      if (cx < -64 || cz < -64 || cx > 4160 || cz > 3136) break;
      tmx = dx > 0 ? (cx + 1 - ox) / dx : dx < 0 ? (cx - ox) / dx : Infinity;
      tmz = dz > 0 ? (cz + 1 - oz) / dz : dz < 0 ? (cz - oz) / dz : Infinity;
      continue;
    }
    const tExit = Math.min(tmx, tmz, best);
    const y0 = oy + dy * tEnter, y1 = oy + dy * tExit;
    _bt = Infinity;
    if (!ch) _cand(-1e9, 1e9, y0, y1, tEnter, oy, dy, enx, enz);          // roche du sous-sol
    else {
      const i = owIdx(cx, cz), k = ch.kind[i], B = ch.base[i], T = ch.top[i];
      if (k === OWK.SOLID || k === OWK.LOW) _cand(B, T, y0, y1, tEnter, oy, dy, enx, enz);
      else if (k === OWK.WINDOW) { _cand(B, ch.lo[i], y0, y1, tEnter, oy, dy, enx, enz); _cand(ch.hi[i], T, y0, y1, tEnter, oy, dy, enx, enz); }
      else if (k === OWK.DOOR && !(ch.door[i] >= 0 && OW.doors[ch.door[i]] && OW.doors[ch.door[i]].open)) _cand(B, T, y0, y1, tEnter, oy, dy, enx, enz);
      else if (k === OWK.ROCK) _cand(-1e9, 1e9, y0, y1, tEnter, oy, dy, enx, enz);
      else if (k === OWK.FLOOR || k === OWK.DOOR || k === OWK.RAMP) {
        _cand(layer ? -1e9 : B - 0.3, k === OWK.RAMP ? (B + T) / 2 : B, y0, y1, tEnter, oy, dy, enx, enz);
        if (ch.ceil[i] > 0) _cand(ch.ceil[i], layer ? 1e9 : ch.roof[i], y0, y1, tEnter, oy, dy, enx, enz);
      }
      if (_bt < Infinity) type = ch.mat[i];
    }
    if (_bt <= tExit && _bt < best) { best = _bt; nx = _bnx; ny = _bny; nz = _bnz; RAY.cell = owK(layer, cx, cz); break; }
    if (tExit >= best) break;
    if (tmx < tmz) { tEnter = tmx; tmx += tdx; cx += stepX; enx = -stepX; enz = 0; }
    else { tEnter = tmz; tmz += tdz; cz += stepZ; enx = 0; enz = -stepZ; }
  }
  if (OW.decks) {
    const t = luRayDecks(ox, oy, oz, dx, dy, dz, best);
    if (t < best) { best = t; nx = RAY.nx; ny = RAY.ny; nz = RAY.nz; type = OWM.METAL; }
  }
  if (best < maxT) {
    RAY.hit = true; RAY.t = best; RAY.nx = nx; RAY.ny = ny; RAY.nz = nz; RAY.type = type;
  } else RAY.t = maxT;
  RAY.x = ox + dx * RAY.t; RAY.y = oy + dy * RAY.t; RAY.z = oz + dz * RAY.t;
  return RAY;
}
const _owN = { x: 0, y: 1, z: 0 };
/* Couche d'un point : le sous-sol si une salle du sous-sol l'entoure, sinon la surface. */
function owLayerAt(x, y, z) {
  if (OW.decks) return luLayerAt(x, y, z);
  if (!OW.under || !OW.under.n) return 0;
  const ch = owChunk(OW.under, Math.floor(x), Math.floor(z));
  if (!ch) return 0;
  const i = owIdx(Math.floor(x), Math.floor(z)), k = ch.kind[i];
  if (k !== OWK.FLOOR && k !== OWK.RAMP && k !== OWK.DOOR) return 0;
  const top = ch.ceil[i] > 0 ? ch.ceil[i] : Infinity;
  return y >= ch.base[i] - 0.4 && y <= top + 0.1 && y < owH(x, z) - 0.3 ? 1 : 0;
}
function owSightClear(x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz);
  if (d < 0.05) return true;
  owRaycast(x0, y0, z0, dx / d, dy / d, dz / d, d);
  return !RAY.hit || RAY.t >= d - 0.05;
}
/* Point dans un solide (débris qui rebondissent). */
function owSolidPoint(x, y, z) {
  if (OW.decks) { const d = luDeckY(x, z); if (Number.isFinite(d) && y <= d && y >= d - 0.35) return true; }
  const layer = OW.decks ? 0 : owLayerAt(x, y, z), L = layer ? OW.under : OW.surf;
  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(L, cx, cz);
  if (!ch) return layer ? true : y < owH(x, z) - 0.02;
  const i = owIdx(cx, cz), k = ch.kind[i];
  if (k === OWK.TERRAIN) return y < owH(x, z) - 0.02;
  if (k === OWK.SOLID || k === OWK.LOW || (k === OWK.DOOR && !(ch.door[i] >= 0 && OW.doors[ch.door[i]] && OW.doors[ch.door[i]].open))) return y >= ch.base[i] && y <= ch.top[i];
  if (k === OWK.WINDOW) return (y >= ch.base[i] && y < ch.lo[i]) || (y > ch.hi[i] && y <= ch.top[i]);
  if (k === OWK.ROCK) return true;
  if (ch.ceil[i] > 0 && y >= ch.ceil[i] && y <= (layer ? 1e9 : ch.roof[i])) return true;
  return y < owGroundAt(layer, x, z) - 0.02;
}
/* Sol sous un point (débris, grenades, particules) : la surface la plus haute sous y. */
function owFloorBelow(x, z, y) {
  if (OW.decks) { const d = luDeckY(x, z); if (Number.isFinite(d) && y >= d - 0.05) return d; }
  const layer = OW.decks ? 0 : owLayerAt(x, y, z), L = layer ? OW.under : OW.surf;
  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(L, cx, cz);
  if (!ch) return layer ? y - 50 : owH(x, z);
  const i = owIdx(cx, cz), k = ch.kind[i];
  if (k === OWK.TERRAIN) return owH(x, z);
  if (k === OWK.SOLID || k === OWK.LOW || k === OWK.WINDOW || k === OWK.DOOR) {
    const top = k === OWK.WINDOW ? (y + 0.05 >= ch.top[i] ? ch.top[i] : y + 0.05 >= ch.lo[i] && y < ch.hi[i] ? ch.lo[i] : ch.base[i]) : ch.top[i];
    if (top <= y + 0.05) return top;
    return k === OWK.DOOR ? ch.base[i] : layer ? ch.base[i] : owH(x, z);
  }
  if (ch.ceil[i] > 0 && y > ch.roof[i] - 0.05 && !layer) return ch.roof[i];
  const g = owGroundAt(layer, x, z);
  return Number.isFinite(g) ? g : y - 50;
}

/* Ligne droite praticable (zombies : poursuite à vue) sur une même couche. */
function owLosClear(k0, x0, z0, x1, z1, r = 0.2) {
  if (k0 < 0) return false;
  const layer = owKl(k0);
  const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz);
  if (d < 0.01) return true;
  const ux = dx / d, uz = dz / d, px = -uz * r, pz = ux * r;
  let gPrev = owGroundAt(layer, x0, z0);
  for (let s = 0.33; s <= d; s += 0.5) {
    const x = x0 + ux * s, z = z0 + uz * s;
    if (!owWalkCell(layer, Math.floor(x + px), Math.floor(z + pz)) || !owWalkCell(layer, Math.floor(x - px), Math.floor(z - pz))) return false;
    const g = owGroundAt(layer, x, z);
    if (Math.abs(g - gPrev) > 0.6) return false;
    gPrev = g;
  }
  return true;
}

/* Champ de flux : 160 × 160 m autour du joueur, sur sa couche ; refait quand il s'éloigne du centre. */
const OWNAV = { N: 160, x0: 0, z0: 0, layer: -1, walk: null, g: null, flow: null, hI: null, hD: null, ready: false };
function owNavInit() {
  const n = OWNAV.N * OWNAV.N;
  OWNAV.walk = new Uint8Array(n); OWNAV.g = new Float32Array(n); OWNAV.flow = new Float32Array(n);
  OWNAV.hI = new Int32Array(n * 4); OWNAV.hD = new Float32Array(n * 4);
}
function owNavWindow(layer, pcx, pcz) {
  const N = OWNAV.N;
  OWNAV.x0 = pcx - (N >> 1); OWNAV.z0 = pcz - (N >> 1); OWNAV.layer = layer;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const cx = OWNAV.x0 + i, cz = OWNAV.z0 + j, w = owWalkCell(layer, cx, cz) ? 1 : 0;
      OWNAV.walk[j * N + i] = w;
      OWNAV.g[j * N + i] = w ? owCellGround(layer, cx, cz) : 0;
    }
  }
  OWNAV.ready = true;
}
function owComputeFlow() {
  if (OW.decks) { luComputeFlow(); return; }
  const p = player, layer = p.layer | 0, pcx = Math.floor(p.pos.x), pcz = Math.floor(p.pos.z), N = OWNAV.N;
  if (!OWNAV.flow) owNavInit();
  if (!OWNAV.ready || OWNAV.layer !== layer || Math.abs(pcx - (OWNAV.x0 + N / 2)) > 26 || Math.abs(pcz - (OWNAV.z0 + N / 2)) > 26) owNavWindow(layer, pcx, pcz);
  const flow = OWNAV.flow, walk = OWNAV.walk, g = OWNAV.g, hI = OWNAV.hI, hD = OWNAV.hD;
  flow.fill(1e9);
  const si = pcx - OWNAV.x0, sj = pcz - OWNAV.z0;
  if (si < 0 || sj < 0 || si >= N || sj >= N) return;
  let n = 0;
  const push = (i, d) => {
    let k = n++;
    hI[k] = i; hD[k] = d;
    while (k > 0) { const q = (k - 1) >> 1; if (hD[q] <= hD[k]) break; const ti = hI[q], td = hD[q]; hI[q] = hI[k]; hD[q] = hD[k]; hI[k] = ti; hD[k] = td; k = q; }
  };
  const s0 = sj * N + si;
  flow[s0] = 0; push(s0, 0);
  while (n > 0) {
    const i = hI[0], d = hD[0];
    n--;
    if (n > 0) {
      hI[0] = hI[n]; hD[0] = hD[n];
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < n && hD[l] < hD[m]) m = l;
        if (r < n && hD[r] < hD[m]) m = r;
        if (m === k) break;
        const ti = hI[m], td = hD[m]; hI[m] = hI[k]; hD[m] = hD[k]; hI[k] = ti; hD[k] = td;
        k = m;
      }
    }
    if (d > flow[i]) continue;
    const ci = i % N, cj = (i / N) | 0, gi = g[i];
    for (let q = 0; q < 8; q++) {
      const ddx = DIRS8[q][0], ddz = DIRS8[q][1], ni = ci + ddx, nj = cj + ddz;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const j = nj * N + ni;
      if (!walk[j] || Math.abs(g[j] - gi) > 0.75) continue;
      if (q >= 4 && (!walk[cj * N + ni] || !walk[nj * N + ci])) continue;
      const nd = d + (q >= 4 ? 1.4142 : 1);
      if (nd < flow[j] && n < hI.length) { flow[j] = nd; push(j, nd); }
    }
  }
}
function owFlowAt(k) {
  if (OW.decks) return luFlowAt(k);
  if (k < 0) return 1e9;
  const N = OWNAV.N, i = owKx(k) - OWNAV.x0, j = owKz(k) - OWNAV.z0;
  if (owKl(k) === OWNAV.layer && i >= 0 && j >= 0 && i < N && j < N && OWNAV.flow[j * N + i] < 1e8) return OWNAV.flow[j * N + i];
  return Math.hypot(owKx(k) - player.pos.x, owKz(k) - player.pos.z) + 60;
}
/* Direction conseillée : la case voisine la plus proche du joueur dans le champ ; sinon tout droit. */
function owFlowDir(k, x, z, out) {
  if (OW.decks) return luFlowDir(k, x, z, out);
  const N = OWNAV.N;
  if (k >= 0 && owKl(k) === OWNAV.layer) {
    const ci = owKx(k) - OWNAV.x0, cj = owKz(k) - OWNAV.z0;
    if (ci >= 0 && cj >= 0 && ci < N && cj < N && OWNAV.flow[cj * N + ci] < 1e8) {
      let best = OWNAV.flow[cj * N + ci], bi = -1, bj = -1;
      for (let q = 0; q < 8; q++) {
        const ni = ci + DIRS8[q][0], nj = cj + DIRS8[q][1];
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const f = OWNAV.flow[nj * N + ni];
        if (f < best) { best = f; bi = ni; bj = nj; }
      }
      if (bi >= 0) {
        const tx = OWNAV.x0 + bi + 0.5 - x, tz = OWNAV.z0 + bj + 0.5 - z, d = Math.hypot(tx, tz) || 1;
        out.x = tx / d; out.z = tz / d;
        return true;
      }
    }
  }
  const tx = player.pos.x - x, tz = player.pos.z - z, d = Math.hypot(tx, tz) || 1;
  out.x = tx / d; out.z = tz / d;
  return true;
}

/* Apparition : dans le sable autour du joueur (de 16 à 38 m), plutôt derrière lui. */
function owPickSpawn() {
  if (OW.worldId === 'lune') return luPickSpawn();
  if ((player.layer | 0) === 1) return khPickSpawnUnder();     // sanctuaire : les fosses de sable
  const inPyr = khPyrSpawn();                                    // jeu 2.0.3 : dans une pyramide, le sable de ses salles
  if (inPyr !== undefined) return inPyr;
  const p = player;
  const others = Zombies.list.filter((z) => z.alive && z.state === 'rise');
  const V = VEH.drive, fast = V && Math.abs(V.v) > 6;
  for (let tries = 0; tries < 30; tries++) {
    let x, z;
    if (fast) {
      // au volant : ils sortent du sable devant, sur le chemin (le moteur les attire)
      const [fx, fz] = vehFwd(V.yaw), d = rand(45, 95) * Math.sign(V.v), lat = rand(-24, 24);
      x = p.pos.x + fx * d - fz * lat; z = p.pos.z + fz * d + fx * lat;
    } else {
      const behind = Math.random() < 0.65;
      const a = p.yaw + Math.PI + (behind ? rand(-1.7, 1.7) : rand(-Math.PI, Math.PI));
      const d = rand(16, V ? V.T.noise * 0.6 : 38);
      x = p.pos.x - Math.sin(a) * d; z = p.pos.z - Math.cos(a) * d;
    }
    const cx = Math.floor(x), cz = Math.floor(z);
    if (owKind(OW.surf, cx, cz) !== OWK.TERRAIN || !owWalkCell(0, cx, cz)) continue;
    const g = owGroundAt(0, x, z);
    if (Math.abs(g - p.gy) > 8) continue;
    if (others.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 3)) continue;
    const near = khNearestLoc(x, z);
    return { riser: true, x, z, li: 0, k: owK(0, cx, cz), zone: OW.locs.indexOf(near.loc), layer: 0, y: g };
  }
  return null;
}
