/* ------------------------------------------------- Lune : physique 1/6 g --
   Valeurs de la planche (page 3, « règles 1/6 g ») :
     pesanteur     1,62 m/s² pour tout : joueur, zombies, grenades, douilles, débris, sang, poussière
     saut          même impulsion que sur Terre (3,13 m/s) : 3,0 m de haut, 3,9 s en l'air
     chutes        14 m (un gradin) : 4,2 s, sans dégâts ; dégâts dès 15 m, mortelle à 50 m
     adhérence     3 m/s² au sol (choix d'Anthony : à mi-chemin entre 1,1 réel et le jeu), 0,35 en l'air
     propulseurs   7,2 m/s vers le haut, un niveau plus haut en 6 s (8 m/s du N1 au bord, 17 m)
   Le pont est un tablier (couche 1 des solides : la Lune n'a pas de sous-sol) : on marche dessus, on
   passe dessous ; les parois des gradins ne bloquent que ce qui monte : on en tombe, on y glisse. */
const GRAV = { k: 1, feel: 14, jump: 4.7, moon: false };
function luGravity(on) {
  GRAV.moon = on;
  GRAV.k = on ? LU.g / 9.81 : 1;              // pesanteur des effets (sang, débris, douilles) : rapport à la Terre
  GRAV.feel = on ? LU.g : 14;                 // pesanteur « de jeu » (joueur, grenades : 14 sur Terre)
  GRAV.jump = on ? 3.13 : 4.7;
  OW.decks = on;
}
/* ---- Tabliers (couche 1) : sol d'un tablier sous (x, z), NaN s'il n'y en a pas. */
function luDeckY(x, z) {
  const L = OW.under;
  if (!L || !L.n) return NaN;
  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(L, cx, cz);
  if (!ch) return NaN;
  const i = owIdx(cx, cz), k = ch.kind[i];
  return k === OWK.FLOOR || k === OWK.LOW ? ch.base[i] : NaN;
}
/* Garde-corps du tablier (case basse) : haut, ou NaN. */
function luRailTop(cx, cz) {
  const L = OW.under, ch = L && L.n ? owChunk(L, cx, cz) : null;
  if (!ch) return NaN;
  const i = owIdx(cx, cz);
  return ch.kind[i] === OWK.LOW ? ch.top[i] : NaN;
}
/* Surface d'une case pour un corps dont les pieds sont à A : la plus haute qu'il peut atteindre
   (marche de 0,75 m au plus) ; { y, layer } ou null (bloquée). Une paroi raide plus basse que les
   pieds n'arrête rien : on y tombe. */
const _luSurf = { y: 0, layer: 0, steep: false };
/* Surface d'une case pour un corps dont les pieds sont à A : la plus haute des surfaces qu'il peut
   atteindre (marche de 0,75 m) parmi le tablier (couche 1) et le sol (terrain, solides) ; null si
   la case l'arrête. Une paroi plus basse que les pieds n'arrête rien : on y tombe, on y glisse. */
function luSurface(cx, cz, A, out = _luSurf) {
  let best = -Infinity, layer = 0, steep = false;
  // tablier (et son garde-corps, en treillis : on le franchit d'un saut)
  const L1 = OW.under, ch1 = L1 && L1.n ? owChunk(L1, cx, cz) : null;
  if (ch1) {
    const i = owIdx(cx, cz), k = ch1.kind[i];
    if (k === OWK.FLOOR || k === OWK.LOW) {
      const deck = ch1.base[i], top = k === OWK.LOW ? ch1.top[i] : deck;
      if (top <= A + 0.75) { best = top; layer = 1; }                 // dessus (ou on y retombe)
      else if (A > deck - 2.2) return null;                         // le garde-corps, ou la tête sous la dalle
    }
  }
  // sol : terrain ou solides
  const ch = owChunk(OW.surf, cx, cz);
  let g0 = -Infinity, st = false, ok = true;
  if (!ch || ch.kind[owIdx(cx, cz)] === OWK.TERRAIN) {
    g0 = owH(cx + 0.5, cz + 0.5);
    if (!owTerrainWalk(cx + 0.5, cz + 0.5)) {
      const B = OW.walk;
      if (cx + 0.5 < B[0] || cx + 0.5 > B[2] || cz + 0.5 < B[1] || cz + 0.5 > B[3]) return null;   // bord de la carte
      if (g0 > A + 0.75) ok = false;                                                                  // paroi : on n'y monte pas
      else st = true;                                                                                 // on y tombe, on y glisse
    } else if (g0 > A + 0.75) ok = false;
  } else {
    const i = owIdx(cx, cz), k = ch.kind[i];
    if (k === OWK.FLOOR || k === OWK.RAMP || k === OWK.WATER) g0 = owGroundAt(0, cx + 0.5, cz + 0.5);
    else if (k === OWK.DOOR) { const open = ch.door[i] >= 0 && OW.doors[ch.door[i]] && OW.doors[ch.door[i]].open; g0 = open ? ch.base[i] : ch.top[i]; }
    else if (k === OWK.VOID) g0 = -1e9;
    else if (k === OWK.ROCK) ok = false;
    else g0 = ch.top[i];
    if (g0 > A + 0.75) ok = false;
    // sous un plafond (intérieur d'un module, porte) : on passe si la tête tient dessous
    if (ok && (k === OWK.FLOOR || k === OWK.RAMP) && ch.ceil[i] > 0 && A > ch.ceil[i] - 0.3) ok = false;
  }
  if (ok && g0 > best + 0.02) { best = g0; layer = 0; steep = st; }
  else if (!ok && (layer === 0 || g0 > best + 0.3)) return null;
  out.y = best; out.layer = layer; out.steep = layer ? false : steep;
  return out;
}
/* Corps après un déplacement (joueur, zombies) : comme owSettle, avec les tabliers, les chutes et
   les glissades. Joueur : player.y (hauteur au-dessus du sol), player.grounded ; zombie : z.luY. */
function luSettle(b, r) {
  const isP = b === player;
  let cx0, cz0;
  if (b.k >= 0) { cx0 = owKx(b.k); cz0 = owKz(b.k); } else { cx0 = Math.floor(b.pos.x); cz0 = Math.floor(b.pos.z); }
  const gy0 = Number.isFinite(b.gy) ? b.gy : owGroundAt(0, b.pos.x, b.pos.z);
  // hauteur au-dessus du sol d'avant ; un mort en l'air peut être passé sous ce sol (il descend une pente)
  const air = isP ? Math.max(0, player.y) : b.luAir ? (b.luY || 0) : Math.max(0, b.luY || 0);
  const A = gy0 + air;
  const blocked = (cx, cz) => (cx === cx0 && cz === cz0 ? false : !luSurface(cx, cz, A));
  collideCircle(b.pos, r, blocked);
  let cx = Math.floor(b.pos.x), cz = Math.floor(b.pos.z);
  if ((cx !== cx0 || cz !== cz0) && blocked(cx, cz)) {
    b.pos.x = clamp(b.pos.x, cx0 + 0.001, cx0 + 0.999);
    b.pos.z = clamp(b.pos.z, cz0 + 0.001, cz0 + 0.999);
    cx = cx0; cz = cz0;
  }
  let s = luSurface(cx, cz, A);
  let g, layer, steep;
  if (s) { g = s.y; layer = s.layer; steep = s.steep; }
  else { g = gy0; layer = b.layer | 0; steep = false; }
  // raide : la pente sous le point exact (la case au pied d'une paroi est marquée raide, souvent plate)
  if (steep) { owNormal(b.pos.x, b.pos.z, _luN); steep = _luN.y < 0.8; }
  // terrain sous le point exact (pas au centre de la case) : la pente se suit
  if (layer === 0) {
    const c = owChunk(OW.surf, cx, cz);
    if (!c || c.kind[owIdx(cx, cz)] === OWK.TERRAIN) g = owH(b.pos.x, b.pos.z);
    else if (c.kind[owIdx(cx, cz)] === OWK.RAMP) g = owGroundAt(0, b.pos.x, b.pos.z);
  }
  if (isP) {
    if (player.grounded) {
      if (gy0 - g > 0.45 || steep) { player.y = Math.max(0, gy0 - g); player.grounded = false; player.vy = Math.min(player.vy, 0); player.luTop = gy0; }
    } else {
      player.y = A - g;
      player.luTop = Math.max(player.luTop === undefined ? A : player.luTop, A);
      if (player.y <= 0) { player.y = 0; player.vy = 0; player.grounded = true; luLand(player, player.luTop - g); }
    }
    player.luSlide = steep && player.grounded;
  } else {
    if (!b.luAir) {
      // un mort ne tombe que d'un rebord ; sur une paroi raide il glisse (luChase)
      if (gy0 - g > 0.45) { b.luAir = true; b.luVy = Math.min(b.luVy || 0, 0); b.luY = gy0 - g; }
      else b.luY = 0;
    } else {
      b.luY = A - g;
      if (b.luY <= 0 && (b.luVy || 0) <= 0.01) { b.luY = 0; b.luAir = false; b.luVy = 0; b.luLand = 0.3; }
    }
    b.luSlide = steep && !b.luAir;
  }
  b.gy = g;
  b.layer = layer;
  b.k = owK(layer, cx, cz);
}
/* Réception : dégâts de chute du joueur (dès 15 m, mortelle à 50 m). */
function luLand(p, fall) {
  p.luTop = undefined;
  if (!Number.isFinite(fall)) return;
  if (fall > 1.2) Sound.land();
  if (fall > 15 && p === player) {
    const k = clamp((fall - 15) / 35, 0, 1);
    FX.shake = Math.min(1, FX.shake + 0.3 + k);
    playerDamage(k >= 1 ? player.maxHp * 2 : player.maxHp * k);
  }
}
/* Adhérence : vitesse visée atteinte à 3 m/s² au plus au sol, 0,35 en l'air ; glissade sur une paroi. */
function luAccel(p, tx, tz, dt) {
  if (p.luSlide) {
    owNormal(p.pos.x, p.pos.z, _luN);
    const h = Math.hypot(_luN.x, _luN.z) || 1;
    p.vel.x += (_luN.x / h) * 9 * dt; p.vel.z += (_luN.z / h) * 9 * dt;
    return;
  }
  const a = (p.grounded ? 3.0 : 0.35) * dt;
  let dx = tx - p.vel.x, dz = tz - p.vel.z;
  const d = Math.hypot(dx, dz);
  if (d > a) { dx *= a / d; dz *= a / d; }
  p.vel.x += dx; p.vel.z += dz;
}
const _luN = { x: 0, y: 1, z: 0 };

/* ---- Rayons, points, sols avec les tabliers */
function luLayerAt(x, y, z) {
  const d = luDeckY(x, z);
  return Number.isFinite(d) && y >= d - 0.35 && y <= d + 2.6 ? 1 : 0;
}
/* Tabliers traversés par un rayon : la dalle (35 cm) arrête ; le garde-corps (treillis) laisse passer. */
function luRayDecks(ox, oy, oz, dx, dy, dz, maxT) {
  const L = OW.under;
  if (!L || !L.n) return maxT;
  let best = maxT;
  let cx = Math.floor(ox), cz = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx > 0 ? (cx + 1 - ox) / dx : dx < 0 ? (cx - ox) / dx : Infinity;
  let tmz = dz > 0 ? (cz + 1 - oz) / dz : dz < 0 ? (cz - oz) / dz : Infinity;
  let tEnter = 0;
  for (let guard = 0; guard < 8192 && tEnter < best; guard++) {
    const ch = owChunk(L, cx, cz);
    if (!ch) {
      const bx = dx > 0 ? ((cx >> 6) + 1) << 6 : (cx >> 6) << 6, bz = dz > 0 ? ((cz >> 6) + 1) << 6 : (cz >> 6) << 6;
      const tx = dx !== 0 ? (bx - ox) / dx : Infinity, tz = dz !== 0 ? (bz - oz) / dz : Infinity, tn = Math.min(tx, tz);
      if (!(tn < best) || tn > 1e6) break;
      tEnter = tn + 1e-4;
      cx = Math.floor(ox + dx * tEnter); cz = Math.floor(oz + dz * tEnter);
      if (cx < -64 || cz < -64 || cx > 4160 || cz > 3136) break;
      tmx = dx > 0 ? (cx + 1 - ox) / dx : dx < 0 ? (cx - ox) / dx : Infinity;
      tmz = dz > 0 ? (cz + 1 - oz) / dz : dz < 0 ? (cz - oz) / dz : Infinity;
      continue;
    }
    const tExit = Math.min(tmx, tmz, best);
    const i = owIdx(cx, cz), k = ch.kind[i];
    if (k === OWK.FLOOR || k === OWK.LOW) {
      const B = ch.base[i], y0 = oy + dy * tEnter, y1 = oy + dy * tExit;
      // dalle [B − 0,35, B] : entrée par le dessus ou le dessous, ou par la tranche
      const lo = B - 0.35;
      if (y0 >= lo && y0 <= B) { best = tEnter; RAY.nx = 0; RAY.ny = dy > 0 ? -1 : 1; RAY.nz = 0; break; }
      if (dy !== 0) {
        for (const yy of [B, lo]) {
          const t = (yy - oy) / dy;
          if (t >= tEnter && t <= tExit && t < best) { best = t; RAY.ny = yy === B ? 1 : -1; RAY.nx = 0; RAY.nz = 0; }
        }
        if (best < maxT && best <= tExit) break;
      }
    }
    if (tExit >= best) break;
    if (tmx < tmz) { tEnter = tmx; tmx += tdx; cx += stepX; } else { tEnter = tmz; tmz += tdz; cz += stepZ; }
  }
  return best;
}

/* ---- Propulseurs : un niveau plus haut (7,2 m/s ; 8 m/s du N1 au bord) */
function luPadList() {
  if (LU._padList) return LU._padList;
  const P = LU.pit, out = [];
  for (const [deg, lv] of LU.pads) {
    const a = luDeg(deg), B = luBench(lv);
    const r = lv >= 5 ? 31 : (B.r0 + B.r1) / 2;
    const up = lv === 0 ? 182 : luBench(lv - 1).r0 + (luBench(lv - 1).r1 - luBench(lv - 1).r0) / 2;
    const vy = lv === 0 ? 8.0 : 7.2;
    const yTo = lv === 0 ? luPitProfile(up) : LU.levels[lv - 1];
    const dh = yTo - B.y, t = (vy + Math.sqrt(Math.max(0, vy * vy - 2 * LU.g * dh))) / LU.g;
    const vh = (up - r) / t;
    out.push({ x: P.x + Math.cos(a) * r, z: P.z + Math.sin(a) * r, y: B.y, a, lv, vy, vx: Math.cos(a) * vh, vz: Math.sin(a) * vh, tx: P.x + Math.cos(a) * up, tz: P.z + Math.sin(a) * up, ty: yTo, t });
  }
  LU._padList = out;
  return out;
}
/* Corps au sol sur un propulseur : il part. Renvoie le propulseur, ou null. */
function luPadAt(x, z, y) {
  for (const p of luPadList()) if (Math.abs(x - p.x) < 1.5 && Math.abs(z - p.z) < 1.5 && Math.hypot(x - p.x, z - p.z) < 1.35 && Math.abs(y - p.y) < 0.8) return p;
  return null;
}
function luPadLaunchPlayer(dt) {
  const p = player;
  if (p.luPadT > 0) { p.luPadT -= dt; return; }
  if (!p.grounded || p.down) return;
  const pad = luPadAt(p.pos.x, p.pos.z, p.gy);
  if (!pad || !LUP.on) return;
  p.vy = pad.vy; p.vel.x = pad.vx; p.vel.z = pad.vz; p.grounded = false; p.y = 0.02; p.luTop = p.gy;
  p.luPadT = 1.0;
  luPadFx(pad);
  Sound.luPad ? Sound.luPad() : Sound.land();
}
const LUP = { on: true };

/* ---- Navigation : liens de saut (bords des gradins, escarpement, cratères raides) et propulseurs.
   Un lien va d'une case du haut (a) à une case du bas (b) ; le champ de flux les suit à l'envers
   (depuis le joueur). Construits une fois par monde. */
function luBuildLinks() {
  const links = [];
  const walk = (x, z) => owWalkCell(0, Math.floor(x), Math.floor(z));
  const B = OW.walk;
  for (let cz = Math.ceil(B[1]) + 2; cz < B[3] - 2; cz += 2) {
    for (let cx = Math.ceil(B[0]) + 2; cx < B[2] - 2; cx += 2) {
      if (owChunk(OW.surf, cx, cz) && owKind(OW.surf, cx, cz) !== OWK.TERRAIN) continue;
      if (!owTerrainWalk(cx + 0.5, cz + 0.5)) continue;
      const g0 = owH(cx + 0.5, cz + 0.5);
      // un bord : une case raide plus basse à 2 m, dans le sens de la pente
      let edge = false;
      for (const [dx, dz] of DIRS8) if (!owTerrainWalk(cx + 0.5 + dx * 2, cz + 0.5 + dz * 2) && owH(cx + 0.5 + dx * 2, cz + 0.5 + dz * 2) < g0 - 1.2) { edge = true; break; }
      if (!edge) continue;
      // sens : la descente (normale du terrain un peu plus loin)
      let bx = 0, bz = 0;
      for (const [dx, dz] of DIRS8) { const h = owH(cx + 0.5 + dx * 3, cz + 0.5 + dz * 3); if (h < g0 - 1) { bx += dx * (g0 - h); bz += dz * (g0 - h); } }
      const l = Math.hypot(bx, bz);
      if (l < 1e-3) continue;
      bx /= l; bz /= l;
      for (let d = 3; d <= 24; d += 1) {
        const x = cx + 0.5 + bx * d, z = cz + 0.5 + bz * d;
        if (x < B[0] || z < B[1] || x > B[2] || z > B[3]) break;
        const h = owH(x, z);
        if (h > g0 + 0.3) break;
        if (walk(x, z) && walk(x + bx, z + bz) && h < g0 - 2 && owKind(OW.surf, Math.floor(x + bx), Math.floor(z + bz)) === OWK.TERRAIN) {
          const x2 = x + bx * 1.5, z2 = z + bz * 1.5;
          if (g0 - h <= 45) links.push({ ax: cx, az: cz, bx: Math.floor(x2), bz: Math.floor(z2), drop: g0 - owH(x2, z2), d: Math.hypot(x2 - cx - 0.5, z2 - cz - 0.5), kind: 'drop' });
          break;
        }
      }
    }
  }
  // propulseurs : de la case du propulseur à l'arrivée
  for (const p of luPadList()) links.push({ ax: Math.floor(p.x), az: Math.floor(p.z), bx: Math.floor(p.tx), bz: Math.floor(p.tz), drop: p.y - p.ty, d: Math.hypot(p.tx - p.x, p.tz - p.z), kind: 'pad', pad: p });
  // index : par case de départ, et par carrés de 32 m (fenêtre du champ de flux)
  const byA = new Map(), grid = new Map();
  for (const L of links) {
    L.cost = L.kind === 'pad' ? L.d + 8 : L.d + 3 + Math.max(0, L.drop) * 0.08;
    const ka = L.az * 4096 + L.ax;
    if (!byA.has(ka)) byA.set(ka, []);
    byA.get(ka).push(L);
    const kg = (L.bz >> 5) * 64 + (L.bx >> 5);
    if (!grid.has(kg)) grid.set(kg, []);
    grid.get(kg).push(L);
  }
  OW.links = { list: links, byA, grid };
  return OW.links;
}
/* Liens qui partent de (cx, cz) ou d'une case voisine (2 m). */
function luLinksNear(cx, cz) {
  const L = OW.links;
  if (!L) return null;
  let out = null;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const a = L.byA.get((cz + dz) * 4096 + cx + dx);
    if (a) { if (!out) out = []; out.push(...a); }
  }
  return out;
}

/* ---- Champ de flux lunaire : 176 × 176 m, deux couches (sol et tablier), liens. */
const LUNAV = { N: 176, x0: 0, z0: 0, ready: false, walk: null, g: null, flow: null, hI: null, hD: null, lh: null, ln: null, lf: null, lc: null, nl: 0 };
function luNavInit() {
  const N = LUNAV.N, n = N * N * 2;
  LUNAV.walk = new Uint8Array(n); LUNAV.g = new Float32Array(n); LUNAV.flow = new Float32Array(n);
  LUNAV.hI = new Int32Array(n * 4); LUNAV.hD = new Float32Array(n * 4);
  LUNAV.lh = new Int32Array(n); LUNAV.ln = new Int32Array(4096); LUNAV.lf = new Int32Array(4096); LUNAV.lc = new Float32Array(4096);
}
function luNavWindow(pcx, pcz) {
  const N = LUNAV.N, NN = N * N;
  LUNAV.x0 = pcx - (N >> 1); LUNAV.z0 = pcz - (N >> 1);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const cx = LUNAV.x0 + i, cz = LUNAV.z0 + j, q = j * N + i;
      let w0 = owWalkCell(0, cx, cz) ? 1 : 0;
      const d = luDeckY(cx + 0.5, cz + 0.5), rail = Number.isFinite(luRailTop(cx, cz));
      // sous un tablier : le sol ne se parcourt que si le corps tient dessous (garde-corps, dalle basse)
      if (w0 && Number.isFinite(d)) { const g0 = owCellGround(0, cx, cz), top = rail ? luRailTop(cx, cz) : d; if (top > g0 + 0.75 && g0 > d - 2.2) w0 = 0; }
      LUNAV.walk[q] = w0; LUNAV.g[q] = w0 ? owCellGround(0, cx, cz) : 0;
      LUNAV.walk[NN + q] = Number.isFinite(d) && !rail ? 1 : 0; LUNAV.g[NN + q] = Number.isFinite(d) ? d : 0;
    }
  }
  // liens dans la fenêtre : listes chaînées par case d'arrivée (couche 0)
  LUNAV.lh.fill(-1);
  let nl = 0;
  const L = OW.links || luBuildLinks();
  for (let gz = LUNAV.z0 >> 5; gz <= (LUNAV.z0 + N) >> 5; gz++) {
    for (let gx = LUNAV.x0 >> 5; gx <= (LUNAV.x0 + N) >> 5; gx++) {
      for (const lk of L.grid.get(gz * 64 + gx) || []) {
        const ai = lk.ax - LUNAV.x0, aj = lk.az - LUNAV.z0, bi = lk.bx - LUNAV.x0, bj = lk.bz - LUNAV.z0;
        if (ai < 0 || aj < 0 || bi < 0 || bj < 0 || ai >= N || aj >= N || bi >= N || bj >= N || nl >= LUNAV.ln.length) continue;
        const b = bj * N + bi;
        LUNAV.lf[nl] = aj * N + ai; LUNAV.lc[nl] = lk.cost; LUNAV.ln[nl] = LUNAV.lh[b]; LUNAV.lh[b] = nl; nl++;
      }
    }
  }
  LUNAV.nl = nl;
  LUNAV.ready = true;
}
function luComputeFlow() {
  const p = player, N = LUNAV.N, NN = N * N, pcx = Math.floor(p.pos.x), pcz = Math.floor(p.pos.z);
  if (!LUNAV.flow) luNavInit();
  if (!LUNAV.ready || Math.abs(pcx - (LUNAV.x0 + N / 2)) > 30 || Math.abs(pcz - (LUNAV.z0 + N / 2)) > 30) luNavWindow(pcx, pcz);
  const flow = LUNAV.flow, walk = LUNAV.walk, g = LUNAV.g, hI = LUNAV.hI, hD = LUNAV.hD;
  flow.fill(1e9);
  const si = pcx - LUNAV.x0, sj = pcz - LUNAV.z0;
  if (si < 0 || sj < 0 || si >= N || sj >= N) return;
  let n = 0;
  const push = (i, d) => {
    let k = n++;
    hI[k] = i; hD[k] = d;
    while (k > 0) { const q = (k - 1) >> 1; if (hD[q] <= hD[k]) break; const ti = hI[q], td = hD[q]; hI[q] = hI[k]; hD[q] = hD[k]; hI[k] = ti; hD[k] = td; k = q; }
  };
  // départ : la case du joueur, sur sa couche (en l'air : la case sous lui) ; au perchoir de la tour,
  // le pied de l'échelle (les morts y vont, puis grimpent)
  let s0 = ((p.layer | 0) === 1 && walk[NN + sj * N + si] ? NN : 0) + sj * N + si;
  if (luOnTower()) { const F = luLadderFoot(), li = Math.floor(F.x) - LUNAV.x0, lj = Math.floor(F.z) - LUNAV.z0; if (li >= 0 && lj >= 0 && li < N && lj < N) s0 = lj * N + li; }
  flow[s0] = 0; push(s0, 0);
  while (n > 0) {
    const u = hI[0], d = hD[0];
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
    if (d > flow[u]) continue;
    const lay = u >= NN ? 1 : 0, c = u - lay * NN, ci = c % N, cj = (c / N) | 0, gu = g[u];
    for (let q = 0; q < 8; q++) {
      const ni = ci + DIRS8[q][0], nj = cj + DIRS8[q][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nc = nj * N + ni, step = q >= 4 ? 1.4142 : 1;
      for (let L2 = 0; L2 < 2; L2++) {
        const v = L2 * NN + nc;
        if (!walk[v] || Math.abs(g[v] - gu) > 0.75) continue;
        if (q >= 4 && L2 === lay && (!walk[L2 * NN + cj * N + ni] || !walk[L2 * NN + nj * N + ci])) continue;
        const nd = d + step;
        if (nd < flow[v] && n < hI.length) { flow[v] = nd; push(v, nd); }
      }
    }
    // liens qui arrivent ici (sol seulement) : leurs cases de départ
    if (!lay) {
      for (let e = LUNAV.lh[c]; e >= 0; e = LUNAV.ln[e]) {
        const v = LUNAV.lf[e];
        if (!walk[v]) continue;
        const nd = d + LUNAV.lc[e];
        if (nd < flow[v] && n < hI.length) { flow[v] = nd; push(v, nd); }
      }
    }
  }
}
function luFlowAt(k) {
  if (k < 0) return 1e9;
  const N = LUNAV.N, i = owKx(k) - LUNAV.x0, j = owKz(k) - LUNAV.z0, lay = owKl(k) ? 1 : 0;
  if (LUNAV.flow && i >= 0 && j >= 0 && i < N && j < N) { const f = LUNAV.flow[lay * N * N + j * N + i]; if (f < 1e8) return f; }
  return Math.hypot(owKx(k) - player.pos.x, owKz(k) - player.pos.z) + 60;
}
/* Direction conseillée ; out.link : un lien à prendre (saut, propulseur) quand c'est le plus court. */
function luFlowDir(k, x, z, out) {
  out.link = null;
  const N = LUNAV.N, NN = N * N;
  if (k >= 0 && LUNAV.flow) {
    const lay = owKl(k) ? 1 : 0, ci = owKx(k) - LUNAV.x0, cj = owKz(k) - LUNAV.z0;
    if (ci >= 0 && cj >= 0 && ci < N && cj < N && LUNAV.flow[lay * NN + cj * N + ci] < 1e8) {
      const here = LUNAV.flow[lay * NN + cj * N + ci];
      let best = here, bi = -1, bj = -1;
      for (let q = 0; q < 8; q++) {
        const ni = ci + DIRS8[q][0], nj = cj + DIRS8[q][1];
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        for (let L2 = 0; L2 < 2; L2++) { const f = LUNAV.flow[L2 * NN + nj * N + ni]; if (f < best - 1e-4) { best = f; bi = ni; bj = nj; } }
      }
      // un lien depuis la case (ou à côté) plus court que le pas suivant
      if (!lay) {
        const ls = luLinksNear(owKx(k), owKz(k));
        if (ls) {
          for (const lk of ls) {
            const bi2 = lk.bx - LUNAV.x0, bj2 = lk.bz - LUNAV.z0;
            if (bi2 < 0 || bj2 < 0 || bi2 >= N || bj2 >= N) continue;
            const f = LUNAV.flow[bj2 * N + bi2] + lk.cost;
            if (f < here + 0.5 && f < best + lk.cost * 0.5) { out.link = lk; best = -1; break; }
          }
        }
      }
      if (out.link) {
        const tx = out.link.ax + 0.5 - x, tz = out.link.az + 0.5 - z, d = Math.hypot(tx, tz);
        if (d > 1.2) { out.x = tx / d; out.z = tz / d; out.link = null; return true; }   // d'abord au bord
        const ex = out.link.bx + 0.5 - x, ez = out.link.bz + 0.5 - z, e = Math.hypot(ex, ez) || 1;
        out.x = ex / e; out.z = ez / e;
        return true;
      }
      if (bi >= 0) {
        const tx = LUNAV.x0 + bi + 0.5 - x, tz = LUNAV.z0 + bj + 0.5 - z, d = Math.hypot(tx, tz) || 1;
        out.x = tx / d; out.z = tz / d;
        return true;
      }
    }
  }
  // hors du champ (pied de paroi, case raide) : vers la case voisine la mieux placée (3 m autour)
  if (k >= 0 && LUNAV.flow) {
    const ci = owKx(k) - LUNAV.x0, cj = owKz(k) - LUNAV.z0;
    let best = 1e8, bx = 0, bz = 0;
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N || (!di && !dj)) continue;
      const f = LUNAV.flow[nj * N + ni] + Math.hypot(di, dj) * 1.5;
      if (f < best) { best = f; bx = di; bz = dj; }
    }
    if (best < 1e8) { const tx = LUNAV.x0 + ci + bx + 0.5 - x, tz = LUNAV.z0 + cj + bz + 0.5 - z, d = Math.hypot(tx, tz) || 1; out.x = tx / d; out.z = tz / d; return true; }
  }
  const tx = player.pos.x - x, tz = player.pos.z - z, d = Math.hypot(tx, tz) || 1;
  out.x = tx / d; out.z = tz / d;
  return true;
}

/* Le joueur est-il au perchoir (plate-forme de la tour relais) ? Jeu 2.0.3 : la plate-forme à sa pose. */
const _luTw = new THREE.Vector3();
function luOnTower() {
  const T = LUPL.tower, p = player, N = LUPL.nodes || {};
  if (!T || !LUPL.ladder || owNodeHidden(N.platform)) return false;
  const q = owLoc(N.platform, p.pos.x, p.gy, p.pos.z, _luTw);
  return Math.abs(q.x - T.x) < 4.2 && Math.abs(q.z - T.z) < 4.2 && q.y > T.top - 1.5;
}
/* Pied de l'échelle de la tour (où les morts commencent à grimper), à sa pose : { x, y, z }. */
function luLadderFoot() { const La = LUPL.ladder; return owPt(LUPL.nodes && LUPL.nodes.ladder, La.fx, La.y0, La.fz); }
