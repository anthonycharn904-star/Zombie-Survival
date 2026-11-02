
/* ---------------------------------------------------- Bâtiments finis (kit MM 2.1.5) --
   Demande d'Anthony du 27 octobre 2026 : « nombreux bâtiments possèdent des textures/modèles non
   finis (sol qui devient vide d'un coup) ». Relevé sur captures, dedans et dehors, de chaque lieu :
   · seuils : la case du mur (1 m) sous chaque porte n'avait pas de plancher : la vase ou l'eau ;
   · toits à deux pans d'une seule face : vus d'en dessous (avant-toits, scierie ouverte), ils
     disparaissaient ; plancher des maisons sur pilotis sans dessous ;
   · bâtiments posés plus haut que la vase sans soubassement ;
   · textures étirées : coque de la péniche, cuves, château d'eau, conduites, grumes (coordonnées
     de texture de 0 à 1 sur toute la pièce) ;
   · le même bardage dedans et dehors, ouvertures sans encadrement, sans menuiserie, sans vantaux.
   maHouse garde les cases des solides de owHouse (murs d'une case, mêmes portes et fenêtres) et
   dessine des murs finis : bardage dehors, planches dedans, tableaux doublés, seuils, encadrements,
   appuis, vantaux ouverts, fenêtres à croisillons et carreaux cassés, plinthes, plafond à solives,
   toit épais (dessus, voliges dessous, rives, faîtière, chevrons), dessous fermé et solives sur
   pilotis, soubassement jusqu'au sol ailleurs. Pièces de métal et grumes : coordonnées de texture
   en mètres. maDampen : le pied des murs et des pieux plus sombre près de la vase et de l'eau. */
const MA_FACES = ['top', 'bottom', 'px', 'nx', 'pz', 'nz'];
const MA_SIDE_FR = { n: 'nord', s: 'sud', w: 'ouest', e: 'est' };
/* Boîte alignée dont chaque face a sa matière ([tex, hex]) ; une face absente n'est pas dessinée. */
function maBoxF(K, f, x0, y0, z0, x1, y1, z1) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return K;
  for (const face of MA_FACES) {
    const m = f[face];
    if (m) K.box(m[0], m[1], x0, y0, z0, x1, y1, z1, { skip: MA_FACES.filter((q) => q !== face) });
  }
  return K;
}
/* Toutes les faces d'une même matière, sauf skip. */
const maBoxAll = (K, tex, hex, x0, y0, z0, x1, y1, z1, skip) => K.box(tex, hex, x0, y0, z0, x1, y1, z1, { skip: skip || [] });
/* Face (4 coins) ou triangle dans le bon sens : retournés si leur normale géométrique s'oppose à n. */
function maQuad(K, tex, hex, p0, p1, p2, p3, n, uvOf) {
  const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
  const d = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2];
  return d < 0 ? K.quad(tex, hex, p3, p2, p1, p0, n, uvOf) : K.quad(tex, hex, p0, p1, p2, p3, n, uvOf);
}
function maTri(K, tex, hex, a, b, c, n, uvOf) {
  const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = c[0] - a[0], by = c[1] - a[1], bz = c[2] - a[2];
  const d = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2];
  return d < 0 ? K.tri(tex, hex, a, c, b, n, uvOf) : K.tri(tex, hex, a, b, c, n, uvOf);
}
const maTexSize = (tex) => (TEXLIB[tex] ? TEXLIB[tex].size : [2, 2]);
/* Boîte de dimensions réelles, coordonnées de texture en mètres (÷ taille de la texture). */
function maBoxGeo(sx, sy, sz, tex) {
  const S = maTexSize(tex), g = new THREE.BoxGeometry(sx, sy, sz), uv = g.attributes.uv;
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];     // px, nx, py, ny, pz, nz
  for (let f = 0; f < 6; f++) for (let j = 0; j < 4; j++) { const i = f * 4 + j; uv.setXY(i, (uv.getX(i) * dims[f][0]) / S[0], (uv.getY(i) * dims[f][1]) / S[1]); }
  return g;
}
/* Cylindre (ou tronc de cône) de dimensions réelles, coordonnées de texture en mètres. */
function maCylGeo(r, h, seg, tex, rTop) {
  const rt = rTop === undefined ? r : rTop, S = maTexSize(tex);
  const g = new THREE.CylinderGeometry(rt, r, h, seg), uv = g.attributes.uv, side = (seg + 1) * 2, circ = TAU * Math.max(r, rt);
  for (let i = 0; i < uv.count; i++) {
    if (i < side) uv.setXY(i, (uv.getX(i) * circ) / S[0], (uv.getY(i) * h) / S[1]);
    else uv.setXY(i, ((uv.getX(i) - 0.5) * 2 * Math.max(r, rt)) / S[0], ((uv.getY(i) - 0.5) * 2 * Math.max(r, rt)) / S[1]);
  }
  return g;
}
/* Pose une géométrie (puis la libère). */
function maGeo(K, tex, hex, g, m) { K.geo(tex, hex, g, m); g.dispose(); return K; }
const maBoxR = (K, tex, hex, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => maGeo(K, tex, hex, maBoxGeo(sx, sy, sz, tex), mtx(x, y, z, rx, ry, rz));
const maCylR = (K, tex, hex, x, y, z, r, h, seg = 12, rx = 0, ry = 0, rz = 0, rTop) => maGeo(K, tex, hex, maCylGeo(r, h, seg, tex, rTop), mtx(x, y, z, rx, ry, rz));
/* Poutre de a à b (section w × h), texture à l'échelle. */
const _mbX = new THREE.Vector3(), _mbY = new THREE.Vector3(), _mbZ = new THREE.Vector3();
function maBeam(K, tex, hex, a, b, w, h) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-4;
  _mbX.set(dx / L, dy / L, dz / L);
  if (Math.abs(_mbX.y) > 0.98) _mbY.set(1, 0, 0).addScaledVector(_mbX, -_mbX.x).normalize();
  else _mbY.set(0, 1, 0).addScaledVector(_mbX, -_mbX.y).normalize();
  _mbZ.crossVectors(_mbX, _mbY);
  const m = new THREE.Matrix4().makeBasis(_mbX, _mbY, _mbZ);
  m.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return maGeo(K, tex, hex, maBoxGeo(L, h, w, tex), m);
}

/* ---- Repère d'un mur : a le long du mur, d dans l'épaisseur (0 dehors, 1 dedans). */
function maWallFrame(o, side) {
  const { x0, z0, x1, z1 } = o;
  const F = {
    n: { alongX: true, a0: x0, a1: x1, out: 'nz', inn: 'pz', aS: 'nx', aE: 'px', corner: true, rect: (a, b, d0, d1) => [a, z0 + d0, b, z0 + d1], ax: [1, 0], dn: [0, 1], P: (a, d) => [a, z0 + d] },
    s: { alongX: true, a0: x0, a1: x1, out: 'pz', inn: 'nz', aS: 'nx', aE: 'px', corner: true, rect: (a, b, d0, d1) => [a, z1 - d1, b, z1 - d0], ax: [1, 0], dn: [0, -1], P: (a, d) => [a, z1 - d] },
    w: { alongX: false, a0: z0 + 1, a1: z1 - 1, out: 'nx', inn: 'px', aS: 'nz', aE: 'pz', corner: false, rect: (a, b, d0, d1) => [x0 + d0, a, x0 + d1, b], ax: [0, 1], dn: [1, 0], P: (a, d) => [x0 + d, a] },
    e: { alongX: false, a0: z0 + 1, a1: z1 - 1, out: 'px', inn: 'nx', aS: 'nz', aE: 'pz', corner: false, rect: (a, b, d0, d1) => [x1 - d1, a, x1 - d0, b], ax: [0, 1], dn: [-1, 0], P: (a, d) => [x1 - d, a] },
  }[side];
  F.side = side;
  return F;
}
/* Boîte dans le repère d'un mur : f = { out, inn, aS, aE, top, bottom } (faces locales). */
function maLB(K, F, f, a0, a1, d0, d1, y0, y1) {
  const [rx0, rz0, rx1, rz1] = F.rect(Math.min(a0, a1), Math.max(a0, a1), Math.min(d0, d1), Math.max(d0, d1));
  const w = {};
  if (f.out) w[F.out] = f.out;
  if (f.inn) w[F.inn] = f.inn;
  if (f.aS) w[F.aS] = f.aS;
  if (f.aE) w[F.aE] = f.aE;
  if (f.top) w.top = f.top;
  if (f.bottom) w.bottom = f.bottom;
  return maBoxF(K, w, Math.min(rx0, rx1), y0, Math.min(rz0, rz1), Math.max(rx0, rx1), y1, Math.max(rz0, rz1));
}
const maAll = (m) => ({ out: m, inn: m, aS: m, aE: m, top: m, bottom: m });

/* ---- Maison. o : comme owHouse ({ x0, z0, x1, z1, y, h, wall, wallHex, inTex, inHex, doors, wins,
   roof: 'gable' | 'flat' | 'none', roofTex, roofHex, rise, parapet, floorTex, ceilTex }) et :
   mat (OWM des cases), stilt (sur pilotis : dessous fermé, solives), found ([tex, hex] du
   soubassement, au sol), trim (bois des encadrements), leaf ('in' | 'out' | 'none' | 'broken', ou
   par porte : 5e élément), leafTex, glass ('clair' | 'vitrail' | 'atelier'), sash (couleur des
   croisillons), metal (menuiseries de fer : station), beams (solives apparentes au plafond),
   eave, rake, roofTh, under ([tex, hex] des voliges), cap ([tex, hex] de la faîtière). */
function maHouse(K, o) {
  const { x0, z0, x1, z1, y } = o, h = o.h || 3.2, top = y + h, roof = o.roof || 'gable', rise = o.rise || 1.5;
  const W = [o.wall || 'ma_siding', o.wallHex || 0xffffff], IN = [o.inTex || W[0], o.inHex || 0xd9d2c4];
  const REV = [o.revTex || 'ma_planks', o.revHex || 0x86705a], TRIM = [o.trimTex || 'ma_planks', o.trim || 0x5a4838];
  const FLOOR = [o.floorTex || 'ma_planks', o.floorHex || 0xffffff], UNDER = ['ma_planks', 0x5a4c3e];
  const mat = o.mat === undefined ? OWM.WOOD : o.mat, stilt = !!o.stilt;
  const roofY = top + (roof === 'flat' ? 0.25 : 0.1), yDamp = y + 0.6;
  const H = { o, y, top, W, IN, REV, TRIM, FLOOR, UNDER, stilt, mat };
  K.solid(x0 + 1, z0 + 1, x1 - 1, z1 - 1, OWK.FLOOR, { base: y, ceil: roof === 'none' ? 0 : top, roof: roofY, mat });
  K.group('Sol', () => maBoxF(K, { top: FLOOR, bottom: stilt ? UNDER : null }, x0 + 1, y - 0.3, z0 + 1, x1 - 1, y, z1 - 1));
  for (const side of ['n', 's', 'w', 'e']) {
    const F = maWallFrame(o, side), base = F.alongX ? x0 : z0;
    const ops = (o.doors || []).filter((d) => d[0] === side).map((d) => ({ s: base + d[1], e: base + d[1] + d[2], lo: y, hi: y + (d[3] || 2.3), door: true, leaf: d[4] || o.leaf || 'in' }))
      .concat((o.wins || []).filter((w) => w[0] === side).map((w) => ({ s: base + w[1], e: base + w[1] + w[2], lo: y + w[3], hi: y + w[4], door: false })))
      .sort((p, q) => p.s - q.s);
    const endFace = (op) => (op ? { m: REV, lo: op.lo, hi: op.hi } : F.corner ? { m: W, lo: y - 0.3, hi: top } : null);
    // segment de mur : full (pied à faîte), lintel (au-dessus d'une ouverture), sill (allège)
    const seg = (s, e, lo, hi, kind, eS, eE) => {
      if (e - s <= 0.01 || hi - lo <= 0.01) return;
      K.group(`Mur ${MA_SIDE_FR[side]}`, () => {
        if (lo < yDamp && hi > yDamp) { maLB(K, F, { out: W }, s, e, 0, 1, lo, yDamp); maLB(K, F, { out: W }, s, e, 0, 1, yDamp, hi); }
        else maLB(K, F, { out: W }, s, e, 0, 1, lo, hi);
        const ilo = Math.max(lo, y);
        if (hi > ilo) maLB(K, F, { inn: IN }, s, e, 0, 1, ilo, hi);
        const tp = kind === 'sill' ? REV : roof === 'none' ? W : null;
        const bt = kind === 'lintel' ? REV : stilt ? UNDER : null;
        if (tp || bt) maLB(K, F, { top: tp, bottom: bt }, s, e, 0, 1, lo, hi);
        for (const [ef, key] of [[eS, 'aS'], [eE, 'aE']]) {
          if (!ef) continue;
          const y0 = Math.max(lo, ef.lo), y1 = Math.min(hi, ef.hi);
          if (y1 - y0 <= 0.01) continue;
          if (y0 < yDamp && y1 > yDamp) { maLB(K, F, { [key]: ef.m }, s, e, 0, 1, y0, yDamp); maLB(K, F, { [key]: ef.m }, s, e, 0, 1, yDamp, y1); }
          else maLB(K, F, { [key]: ef.m }, s, e, 0, 1, y0, y1);
        }
      });
    };
    let cur = F.a0, prev = null;
    for (const op of ops) {
      seg(cur, op.s, y - 0.3, top, 'full', endFace(prev), endFace(op));
      seg(op.s, op.e, op.hi, top, 'lintel');
      if (!op.door) seg(op.s, op.e, y - 0.3, op.lo, 'sill');
      const [rx0, rz0, rx1, rz1] = F.rect(op.s, op.e, 0, 1);
      if (op.door) K.solid(Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1), OWK.FLOOR, { base: y, ceil: op.hi, roof: top, mat });
      else K.solid(Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1), OWK.WINDOW, { base: y - 0.3, top, lo: op.lo, hi: op.hi, mat });
      if (op.door) maDoorway(K, F, op, H); else maWindow(K, F, op, H);
      cur = op.e; prev = op;
    }
    seg(cur, F.a1, y - 0.3, top, 'full', endFace(prev), F.corner ? endFace(null) : null);
    for (let t = Math.floor(F.a0); t < Math.ceil(F.a1); t++) {
      if (ops.some((op) => t + 0.5 > op.s && t + 0.5 < op.e)) continue;
      const [rx0, rz0, rx1, rz1] = F.rect(t, t + 1, 0, 1);
      K.solid(Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1), OWK.SOLID, { base: y - 0.5, top: roof === 'gable' ? top + rise * 0.5 : top + (o.parapet || 0), mat });
    }
    // plinthe intérieure (hors portes)
    if (o.plinth !== false) {
      const a0 = F.corner ? F.a0 + 1 : F.a0, a1 = F.corner ? F.a1 - 1 : F.a1;
      let c = a0;
      const doors = ops.filter((p) => p.door);
      for (const p of doors.concat([{ s: a1 + 0.12, e: a1 }])) {
        const e = Math.min(p.s - 0.12, a1);
        if (e - c > 0.1) K.group('Plinthe', () => maLB(K, F, { inn: TRIM, top: TRIM, aS: TRIM, aE: TRIM }, c, e, 1, 1.022, y, y + 0.11));
        c = Math.max(c, p.e + 0.12);
      }
    }
  }
  // dessous : solives et lambourdes (pilotis) ; soubassement (au sol)
  if (stilt) maJoists(K, x0, z0, x1, z1, y - 0.3);
  else if (o.found) maFound(K, x0, z0, x1, z1, y - 0.3, o.found);
  // toit
  if (roof === 'gable') {
    const along = x1 - x0 >= z1 - z0;
    K.group('Toit à deux pans', () => maGableRoof(K, { x0, z0, x1, z1, top, rise, along, tex: o.roofTex || 'ma_tin', hex: o.roofHex || 0xffffff,
      under: o.under || ['ma_planks', 0x8a7864], gable: W, fascia: o.fascia || ['ma_planks', 0x4e4034], cap: o.cap, eave: o.eave, rake: o.rake, th: o.roofTh }));
    K.group('Plafond', () => maBoxF(K, { bottom: [o.ceilTex || 'ma_planks', o.ceilHex || 0xcfc2ad] }, x0 + 1, top - 0.05, z0 + 1, x1 - 1, top, z1 - 1));
    if (o.beams !== false) {
      // solives apparentes, en travers de la petite portée
      const n = Math.max(1, Math.round(((along ? x1 - x0 : z1 - z0) - 2) / 1.8));
      for (let i = 1; i < n; i++) {
        const t = (along ? x0 + 1 : z0 + 1) + (i * ((along ? x1 - x0 : z1 - z0) - 2)) / n;
        K.group('Solive', () => (along ? maBoxAll(K, 'ma_planks', 0x6a5644, t - 0.07, top - 0.23, z0 + 1, t + 0.07, top - 0.05, z1 - 1, ['top'])
          : maBoxAll(K, 'ma_planks', 0x6a5644, x0 + 1, top - 0.23, t - 0.07, x1 - 1, top - 0.05, t + 0.07, ['top'])));
      }
    }
  } else if (roof === 'flat') {
    const R = [o.roofTex || W[0], o.roofHex || W[1]];
    K.group('Toit', () => maBoxAll(K, R[0], R[1], x0 - 0.15, top, z0 - 0.15, x1 + 0.15, top + 0.25, z1 + 0.15));
    if (o.parapet) {
      const p = o.parapet, t2 = top + 0.25, C = [o.copeTex || 'ma_concrete', o.copeHex || 0x9a968a];
      K.group('Acrotère', () => {
        maBoxAll(K, W[0], W[1], x0, t2, z0, x1, t2 + p, z0 + 0.3, ['bottom', 'top']); maBoxAll(K, W[0], W[1], x0, t2, z1 - 0.3, x1, t2 + p, z1, ['bottom', 'top']);
        maBoxAll(K, W[0], W[1], x0, t2, z0 + 0.3, x0 + 0.3, t2 + p, z1 - 0.3, ['bottom', 'top', 'nz', 'pz']); maBoxAll(K, W[0], W[1], x1 - 0.3, t2, z0 + 0.3, x1, t2 + p, z1 - 0.3, ['bottom', 'top', 'nz', 'pz']);
        // couvertine
        maBoxAll(K, C[0], C[1], x0 - 0.05, t2 + p, z0 - 0.05, x1 + 0.05, t2 + p + 0.07, z0 + 0.35, []); maBoxAll(K, C[0], C[1], x0 - 0.05, t2 + p, z1 - 0.35, x1 + 0.05, t2 + p + 0.07, z1 + 0.05, []);
        maBoxAll(K, C[0], C[1], x0 - 0.05, t2 + p, z0 + 0.35, x0 + 0.35, t2 + p + 0.07, z1 - 0.35, ['nz', 'pz']); maBoxAll(K, C[0], C[1], x1 - 0.35, t2 + p, z0 + 0.35, x1 + 0.05, t2 + p + 0.07, z1 - 0.35, ['nz', 'pz']);
      });
    }
  }
  return H;
}
/* Seuil, appui, chambranles, vantaux. */
function maDoorway(K, F, op, H) {
  const { y, W, TRIM, FLOOR, UNDER, stilt } = H, s = op.s, e = op.e, hi = op.hi;
  K.group('Seuil', () => {
    maLB(K, F, { top: FLOOR, out: W, bottom: stilt ? UNDER : null }, s, e, 0, 1, y - 0.3, y);
    maLB(K, F, { top: TRIM, out: TRIM, aS: TRIM, aE: TRIM, bottom: TRIM }, s - 0.04, e + 0.04, -0.07, 0.14, y - 0.06, y + 0.022);
  });
  K.group('Chambranle', () => {
    for (const [d0, d1, pr] of [[-0.045, 0, 1], [1, 1.035, -1]]) {
      const f = pr > 0 ? { out: TRIM, aS: TRIM, aE: TRIM, top: TRIM } : { inn: TRIM, aS: TRIM, aE: TRIM, top: TRIM };
      maLB(K, F, f, s - 0.13, s, d0, d1, y, hi);
      maLB(K, F, f, e, e + 0.13, d0, d1, y, hi);
      maLB(K, F, Object.assign({ bottom: TRIM }, f), s - 0.17, e + 0.17, pr > 0 ? d0 - 0.015 : d0, pr > 0 ? d1 : d1 + 0.015, hi, hi + 0.16);
    }
  });
  if (op.leaf === 'none') return;
  const w = e - s, n = op.leaf === 'broken' ? 2 : w >= 1.6 ? 2 : 1, lw = w / n, lh = hi - y - 0.04;
  const metal = !!H.o.metal, T = H.o.leafTex || (metal ? 'ma_steel' : 'ma_planks'), hx = H.o.leafHex || (metal ? 0x7e8a80 : 0x7a6450);
  for (let i = 0; i < n; i++) {
    const left = i === 0;                                         // charnière en s (gauche) ou en e
    const hingeA = left ? s : e, inward = op.leaf !== 'out';
    const dHinge = inward ? 1.03 : -0.03;
    // direction du vantail ouvert (presque contre le mur, 14° de jeu)
    const phi = (166 * Math.PI) / 180, dir = left ? -1 : 1;
    let va = Math.cos(phi) * -dir, vd = Math.sin(phi) * (inward ? 1 : -1);
    let tilt = 0, drop = 0;
    if (op.leaf === 'broken') {
      if (left) { va = Math.cos(2.0) * -dir; vd = Math.sin(2.0); tilt = 0.18; drop = 0.08; }       // pend à une charnière
      else continue;
    }
    const [hx0, hz0] = F.P(hingeA, dHinge), wx = F.ax[0] * va + F.dn[0] * vd, wz = F.ax[1] * va + F.dn[1] * vd;
    const L = Math.hypot(wx, wz), ux = wx / L, uz = wz / L, yaw = Math.atan2(-uz, ux);
    const cx = hx0 + ux * (lw / 2), cz = hz0 + uz * (lw / 2), cy = y + 0.02 + lh / 2 - drop, B = mtx(cx, cy, cz, 0, yaw, tilt);
    const M = (lx, ly, lz) => B.clone().multiply(new THREE.Matrix4().makeTranslation(lx, ly, lz));
    K.group('Vantail', () => {
      if (metal) {
        maGeo(K, T, hx, maBoxGeo(lw - 0.03, lh, 0.05, T), M(0, 0, 0));
        maGeo(K, 'ma_steel', 0x5e665e, maBoxGeo(lw - 0.2, 0.06, 0.07, 'ma_steel'), M(0, lh * 0.18, 0));
        maGeo(K, 'ma_steel', 0x5e665e, maBoxGeo(lw - 0.2, 0.06, 0.07, 'ma_steel'), M(0, -lh * 0.3, 0));
      } else {
        maGeo(K, T, hx, maBoxGeo(lw - 0.03, lh, 0.045, T), M(0, 0, 0));
        // barres et écharpe (côté intérieur du vantail fermé)
        for (const yy of [0.36, -0.02, -0.4]) maGeo(K, T, 0x5e4a3a, maBoxGeo(lw - 0.12, 0.1, 0.03, T), M(0, lh * yy, 0.036));
        const a = -(lw / 2 - 0.1), b = lw / 2 - 0.1, ya = -lh * 0.38, yb = lh * 0.34;
        const ang = Math.atan2(yb - ya, (b - a) * (left ? 1 : -1)), len = Math.hypot(yb - ya, b - a);
        maGeo(K, T, 0x5e4a3a, maBoxGeo(len, 0.09, 0.028, T), M(0, (ya + yb) / 2, 0.036).multiply(new THREE.Matrix4().makeRotationZ(ang)));
      }
      // poignée
      maGeo(K, 'ma_rust', 0x3a3430, maBoxGeo(0.03, 0.14, 0.05, 'ma_rust'), M((lw / 2 - 0.12) * (left ? 1 : -1), -lh * 0.06, -0.05));
    });
  }
  if (op.leaf === 'broken') {
    // l'autre vantail, tombé dehors à plat contre le seuil
    const [px, pz] = F.P((s + e) / 2 + 0.3, -0.9), yaw = Math.atan2(-F.ax[1], F.ax[0]);
    K.group('Vantail tombé', () => maGeo(K, T, 0x6a5848, maBoxGeo(lw - 0.03, 0.045, lh * 0.92, T), mtx(px, y + 0.05, pz, 0.06, yaw, 0.04)));
  }
}
/* Fenêtre : chambranles, appui saillant, tablette, châssis à croisillons, carreaux (entiers, cassés, absents). */
function maWindow(K, F, op, H) {
  const { TRIM } = H, o = H.o, s = op.s, e = op.e, lo = op.lo, hi = op.hi, w = e - s, hh = hi - lo, metal = !!o.metal;
  K.group('Encadrement', () => {
    // dehors : montants, linteau à larmier, appui
    maLB(K, F, { out: TRIM, aS: TRIM, aE: TRIM }, s - 0.11, s, -0.04, 0, lo - 0.02, hi);
    maLB(K, F, { out: TRIM, aS: TRIM, aE: TRIM }, e, e + 0.11, -0.04, 0, lo - 0.02, hi);
    maLB(K, F, { out: TRIM, aS: TRIM, aE: TRIM, bottom: TRIM }, s - 0.15, e + 0.15, -0.05, 0, hi, hi + 0.13);
    maLB(K, F, { out: TRIM, aS: TRIM, aE: TRIM, bottom: TRIM, top: TRIM }, s - 0.19, e + 0.19, -0.1, 0, hi + 0.13, hi + 0.17);
    maLB(K, F, { out: TRIM, aS: TRIM, aE: TRIM, bottom: TRIM, top: TRIM, inn: TRIM }, s - 0.13, e + 0.13, -0.13, 0.22, lo - 0.07, lo + 0.012);
    // dedans : chambranles et tablette
    maLB(K, F, { inn: TRIM, aS: TRIM, aE: TRIM }, s - 0.1, s, 1, 1.03, lo, hi);
    maLB(K, F, { inn: TRIM, aS: TRIM, aE: TRIM }, e, e + 0.1, 1, 1.03, lo, hi);
    maLB(K, F, { inn: TRIM, aS: TRIM, aE: TRIM, bottom: TRIM, top: TRIM }, s - 0.13, e + 0.13, 1, 1.035, hi, hi + 0.12);
    maLB(K, F, { inn: TRIM, aS: TRIM, aE: TRIM, bottom: TRIM, top: TRIM }, s - 0.08, e + 0.08, 0.8, 1.07, lo - 0.04, lo + 0.012);
  });
  // châssis : à 0,2 m du nu extérieur
  const SA = metal ? ['ma_steel', 0x5c625a] : [TRIM[0], o.sash || 0x6e5c4a], d0 = 0.17, d1 = 0.24, r = metal ? 0.045 : 0.06;
  const cols = metal ? Math.max(2, Math.round(w / 0.55)) : w >= 1.4 ? 2 : 1, rows = metal ? 2 : hh >= 1.6 ? 3 : 2;
  K.group('Châssis', () => {
    maLB(K, F, maAll(SA), s, e, d0, d1, lo + 0.012, lo + 0.012 + r);
    maLB(K, F, maAll(SA), s, e, d0, d1, hi - r, hi);
    maLB(K, F, maAll(SA), s, s + r, d0, d1, lo + 0.012 + r, hi - r);
    maLB(K, F, maAll(SA), e - r, e, d0, d1, lo + 0.012 + r, hi - r);
    for (let i = 1; i < cols; i++) { const a = s + (i * w) / cols; maLB(K, F, maAll(SA), a - 0.02, a + 0.02, d0 + 0.01, d1 - 0.01, lo + 0.012 + r, hi - r); }
    for (let j = 1; j < rows; j++) { const yy = lo + 0.012 + (j * (hh - 0.012)) / rows; maLB(K, F, maAll(SA), s + r, e - r, d0 + 0.01, d1 - 0.01, yy - 0.02, yy + 0.02); }
  });
  // carreaux
  const G = o.glass || 'clair', dg = 0.205;
  const COL = G === 'vitrail' ? [0x9a3a2a, 0x2a4a8a, 0xb08a2a, 0x3a7a4a, 0x7a3a7a] : G === 'atelier' ? [0x8a9690, 0x7a8680] : [0x9aa6a0, 0x8e9c94];
  const pw = (w - 2 * r) / cols, ph = (hh - 0.012 - 2 * r) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const a0 = s + r + i * pw + 0.02, a1 = s + r + (i + 1) * pw - 0.02, y0 = lo + 0.012 + r + j * ph + 0.02, y1 = lo + 0.012 + r + (j + 1) * ph - 0.02;
    const q = Math.random(), col = COL[(Math.random() * COL.length) | 0];
    const P = (a, yy) => { const [px, pz] = F.P(a, dg); return [px, yy, pz]; };
    const n = [F.dn[0], 0, F.dn[1]], uv = () => [0, 0];
    if (q < (G === 'vitrail' ? 0.45 : 0.22)) maQuad(K, 'ma_glass', col, P(a0, y0), P(a1, y0), P(a1, y1), P(a0, y1), n, uv);
    else if (q < 0.8) {
      // éclats restés dans le châssis : un à trois triangles depuis les coins
      const k = 1 + ((Math.random() * 3) | 0), C = [[a0, y0, 1, 1], [a1, y0, -1, 1], [a1, y1, -1, -1], [a0, y1, 1, -1]];
      for (let t = 0; t < k; t++) {
        const [ca, cy, sa, sy] = C[(Math.random() * 4) | 0], la = (a1 - a0) * (0.25 + Math.random() * 0.6), ly = (y1 - y0) * (0.25 + Math.random() * 0.6);
        maTri(K, 'ma_glass', col, P(ca, cy), P(ca + sa * la, cy), P(ca, cy + sy * ly), n, uv);
      }
    }
  }
}
/* Solives sous un plancher sur pilotis (yb : dessous du plancher). */
function maJoists(K, x0, z0, x1, z1, yb) {
  const T = 'ma_planks', hx = 0x5c4c3c, along = x1 - x0 >= z1 - z0;
  K.group('Solives', () => {
    // lambourdes de rive sur le pourtour
    maBoxAll(K, T, hx, x0, yb - 0.26, z0, x1, yb, z0 + 0.22, ['top']); maBoxAll(K, T, hx, x0, yb - 0.26, z1 - 0.22, x1, yb, z1, ['top']);
    maBoxAll(K, T, hx, x0, yb - 0.26, z0 + 0.22, x0 + 0.22, yb, z1 - 0.22, ['top', 'nz', 'pz']); maBoxAll(K, T, hx, x1 - 0.22, yb - 0.26, z0 + 0.22, x1, yb, z1 - 0.22, ['top', 'nz', 'pz']);
    // solives en travers de la petite portée, tous les 0,8 m
    if (along) for (let x = x0 + 0.8; x < x1 - 0.5; x += 0.8) maBoxAll(K, T, hx, x - 0.05, yb - 0.22, z0 + 0.22, x + 0.05, yb, z1 - 0.22, ['top', 'nz', 'pz']);
    else for (let z = z0 + 0.8; z < z1 - 0.5; z += 0.8) maBoxAll(K, T, hx, x0 + 0.22, yb - 0.22, z - 0.05, x1 - 0.22, yb, z + 0.05, ['top', 'nx', 'px']);
  });
}
/* Soubassement : du sol le plus bas du pourtour (moins 0,35 m) au pied des murs, un peu en saillie. */
function maFound(K, x0, z0, x1, z1, yTop, m) {
  let g = 1e9;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    g = Math.min(g, owH(lerp(x0, x1, t), z0 - 0.1), owH(lerp(x0, x1, t), z1 + 0.1), owH(x0 - 0.1, lerp(z0, z1, t)), owH(x1 + 0.1, lerp(z0, z1, t)));
  }
  const yb = Math.min(g, yTop) - 0.35, yt = yTop + 0.04, p = 0.05, t = 0.35;
  K.group('Soubassement', () => {
    maBoxF(K, { nz: m, top: m, nx: m, px: m }, x0 - p, yb, z0 - p, x1 + p, yt, z0 + t);
    maBoxF(K, { pz: m, top: m, nx: m, px: m }, x0 - p, yb, z1 - t, x1 + p, yt, z1 + p);
    maBoxF(K, { nx: m, top: m }, x0 - p, yb, z0 + t, x0 + t, yt, z1 - t);
    maBoxF(K, { px: m, top: m }, x1 - t, yb, z0 + t, x1 + p, yt, z1 - t);
  });
  return yb;
}
/* Toit à deux pans épais : couverture dessus, voliges dessous, rives (bandeaux), faîtière,
   chevrons sous les avant-toits ; pignons triangulaires au nu des murs. Le dessous passe par
   l'arête haute extérieure des longs pans : il ferme le comble sans jour. */
function maGableRoof(K, o) {
  const along = o.along, e = o.eave === undefined ? 0.45 : o.eave, r = o.rake === undefined ? 0.3 : o.rake, th = o.th === undefined ? 0.13 : o.th;
  const u0 = along ? o.x0 : o.z0, u1 = along ? o.x1 : o.z1, v0 = along ? o.z0 : o.x0, v1 = along ? o.z1 : o.x1, top = o.top, rise = o.rise;
  const vm = (v0 + v1) / 2, hs = (v1 - v0) / 2, s = rise / hs, k = Math.sqrt(1 + s * s), tv = th * k;
  const P = (u, yy, v) => (along ? [u, yy, v] : [v, yy, u]);
  const N = (nu, ny, nv) => (along ? [nu, ny, nv] : [nv, ny, nu]);
  const yU = (v) => top + rise - s * Math.abs(v - vm), yT = (v) => yU(v) + tv;
  const ua = u0 - r, ub = u1 + r, va = v0 - e, vb = v1 + e;
  const UC = (p) => (along ? p[0] : p[2]), VC = (p) => (along ? p[2] : p[0]);
  const uvS = (p) => [UC(p), Math.abs(VC(p) - vm) * k];                 // u le long du faîtage, v le long de la pente
  const tex = o.tex, hex = o.hex, U = o.under, FA = o.fascia, CAP = o.cap || [tex, 0xb8b0a4];
  for (const sd of [-1, 1]) {
    const vE = sd < 0 ? va : vb, n = N(0, 1 / k, (sd * s) / k), nd = N(0, -1 / k, (-sd * s) / k);
    // dessus (couverture) et dessous (voliges)
    maQuad(K, tex, hex, P(ua, yT(vE), vE), P(ub, yT(vE), vE), P(ub, yT(vm), vm), P(ua, yT(vm), vm), n, uvS);
    maQuad(K, U[0], U[1], P(ua, yU(vE), vE), P(ub, yU(vE), vE), P(ub, yU(vm), vm), P(ua, yU(vm), vm), nd, uvS);
    // bandeau d'égout et planches de rive : planches pleines qui ferment les chants de la dalle
    const yMid = (v) => (yU(v) - 0.07 + yT(v) + 0.012) / 2, hv = tv + 0.082;
    maBeam(K, FA[0], FA[1], P(ua - 0.05, yMid(vE), vE + sd * 0.025), P(ub + 0.05, yMid(vE), vE + sd * 0.025), 0.05, hv);
    for (const [uE, su] of [[ua, -1], [ub, 1]]) maBeam(K, FA[0], FA[1], P(uE + su * 0.025, yMid(vE), vE), P(uE + su * 0.025, yMid(vm), vm), 0.05, hv / k);
    // chevrons apparents sous l'avant-toit
    const vW = sd < 0 ? v0 : v1, nR = Math.max(2, Math.round((u1 - u0) / 0.65));
    for (let i = 0; i <= nR; i++) {
      const u = lerp(u0 + 0.12, u1 - 0.12, i / nR), a = P(u, yU(vW) - 0.06, vW), b = P(u, yU(vE + sd * -0.04) - 0.06, vE - sd * 0.04);
      maBeam(K, 'ma_planks', 0x5e4c3c, a, b, 0.06, 0.1);
    }
  }
  // faîtière
  const yr = yT(vm);
  const c0 = P(ua - 0.02, yr - 0.04, vm - 0.17), c1 = P(ub + 0.02, yr + 0.06, vm + 0.17);
  maBoxAll(K, CAP[0], CAP[1], Math.min(c0[0], c1[0]), yr - 0.04, Math.min(c0[2], c1[2]), Math.max(c0[0], c1[0]), yr + 0.06, Math.max(c0[2], c1[2]), ['bottom']);
  // pignons au nu des murs
  if (o.gable) for (const [uW, su] of [[u0, -1], [u1, 1]]) {
    const uvG = along ? (su < 0 ? (p) => [p[2], p[1]] : (p) => [-p[2], p[1]]) : (su < 0 ? (p) => [-p[0], p[1]] : (p) => [p[0], p[1]]);
    maTri(K, o.gable[0], o.gable[1], P(uW, top, v0), P(uW, top, v1), P(uW, top + rise, vm), N(su, 0, 0), uvG);
  }
  return { yU, yT, s, k, vm };
}
/* Auvent en appentis au-dessus d'une terrasse (côté P d'une maison) : haut contre le mur, bas au
   bord de la terrasse, poteaux aux coins, sablière. */
function maPorchRoof(K, house, pr, P, yHigh, yLow, o = {}) {
  const [px0, pz0, px1, pz1] = pr, ov = 0.3, sw = 0.15, th = 0.1;
  const tex = o.tex || 'ma_tin', hex = o.hex || 0xffffff, U = ['ma_planks', 0x7e6c58], FA = ['ma_planks', 0x4e4034];
  // repère : w le long du mur, d vers le large (0 au mur)
  const wall = { n: pz1, s: pz0, w: px1, e: px0 }[P], dSign = { n: -1, s: 1, w: -1, e: 1 }[P], alongX = P === 'n' || P === 's';
  const w0 = (alongX ? px0 : pz0) - sw, w1 = (alongX ? px1 : pz1) + sw, D = (alongX ? pz1 - pz0 : px1 - px0) + ov;
  const Q = (w, d, yy) => (alongX ? [w, yy, wall + dSign * d] : [wall + dSign * d, yy, w]);
  const sl = (yHigh - yLow) / (D - ov), yAt = (d) => yHigh - sl * d, kk = Math.sqrt(1 + sl * sl);
  const nUp = alongX ? [0, 1 / kk, (dSign * sl) / kk] : [(dSign * sl) / kk, 1 / kk, 0];
  const nDn = [-nUp[0], -nUp[1], -nUp[2]];
  const uvf = (p) => [alongX ? p[0] : p[2], Math.abs((alongX ? p[2] : p[0]) - wall) * kk];
  K.group('Auvent', () => {
    maQuad(K, tex, hex, Q(w0, 0.02, yAt(0) + th), Q(w1, 0.02, yAt(0) + th), Q(w1, D, yAt(D) + th), Q(w0, D, yAt(D) + th), nUp, uvf);
    maQuad(K, U[0], U[1], Q(w0, 0.02, yAt(0)), Q(w1, 0.02, yAt(0)), Q(w1, D, yAt(D)), Q(w0, D, yAt(D)), nDn, uvf);
    const nOut = alongX ? [0, 0, dSign] : [dSign, 0, 0];
    maQuad(K, FA[0], FA[1], Q(w0, D, yAt(D) - 0.04), Q(w1, D, yAt(D) - 0.04), Q(w1, D, yAt(D) + th), Q(w0, D, yAt(D) + th), nOut, (p) => [alongX ? p[0] : p[2], p[1]]);
    for (const [wE, sg] of [[w0, -1], [w1, 1]]) {
      const nS = alongX ? [sg, 0, 0] : [0, 0, sg];
      maQuad(K, FA[0], FA[1], Q(wE, 0.02, yAt(0) - 0.04), Q(wE, D, yAt(D) - 0.04), Q(wE, D, yAt(D) + th), Q(wE, 0.02, yAt(0) + th), nS, (p) => [alongX ? p[2] : p[0], p[1]]);
    }
    // sablière et poteaux
    const dP = D - ov - 0.12, yb = yAt(dP);
    maBeam(K, 'ma_planks', 0x5a4838, Q(w0 + sw, dP, yb - 0.1), Q(w1 - sw, dP, yb - 0.1), 0.14, 0.2);
    const nP = 1;                                                    // poteaux aux angles seulement : rien devant la porte ni l'escalier
    for (let i = 0; i <= nP; i++) {
      const w = lerp(w0 + sw + 0.1, w1 - sw - 0.1, i / nP), [x, , z] = Q(w, dP, 0);
      maBoxAll(K, 'ma_planks', 0x6a5644, x - 0.07, house.y, z - 0.07, x + 0.07, yb - 0.2, z + 0.07, ['top', 'bottom']);
      // jambes de force vers la sablière
      const [ax, , az] = Q(w + (i === 0 ? 0.5 : i === nP ? -0.5 : 0.45), dP, 0);
      if (i === 0 || i === nP) maBeam(K, 'ma_planks', 0x5a4838, [x, yb - 0.75, z], [ax, yb - 0.2, az], 0.07, 0.07);
    }
  });
}

/* ---- Mobilier (boîtes ; cases basses pour ce qui barre le passage). */
function maLowCells(K, x0, z0, x1, z1, y, h, m = OWM.WOOD) { K.solid(x0, z0, x1, z1, OWK.LOW, { base: y, top: y + h, mat: m }); }
function maTable2(K, x, y, z, w, d, hex = 0x7a6450) {
  K.group('Table', () => {
    maBoxAll(K, 'ma_planks', hex, x - w / 2, y + 0.72, z - d / 2, x + w / 2, y + 0.78, z + d / 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) maBoxAll(K, 'ma_planks', 0x5a4838, x + sx * (w / 2 - 0.09) - 0.035, y, z + sz * (d / 2 - 0.09) - 0.035, x + sx * (w / 2 - 0.09) + 0.035, y + 0.72, z + sz * (d / 2 - 0.09) + 0.035, ['top', 'bottom']);
    maBoxAll(K, 'ma_planks', 0x5a4838, x - w / 2 + 0.1, y + 0.62, z - d / 2 + 0.08, x + w / 2 - 0.1, y + 0.72, z - d / 2 + 0.11, ['top', 'bottom']);
  });
}
function maChair(K, x, y, z, yaw = 0, fallen = false) {
  K.group('Chaise', () => {
    const B = fallen ? mtx(x, y + 0.24, z, -Math.PI / 2 + 0.08, yaw, 0) : mtx(x, y, z, 0, yaw, 0);
    const M = (lx, ly, lz) => B.clone().multiply(new THREE.Matrix4().makeTranslation(lx, fallen ? ly - 0.45 : ly, lz));
    maGeo(K, 'ma_planks', 0x6a5644, maBoxGeo(0.44, 0.04, 0.42, 'ma_planks'), M(0, 0.46, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) maGeo(K, 'ma_planks', 0x4e3e30, maBoxGeo(0.04, 0.46, 0.04, 'ma_planks'), M(sx * 0.18, 0.23, sz * 0.17));
    for (const sx of [-1, 1]) maGeo(K, 'ma_planks', 0x4e3e30, maBoxGeo(0.04, 0.5, 0.04, 'ma_planks'), M(sx * 0.18, 0.73, -0.19));
    maGeo(K, 'ma_planks', 0x6a5644, maBoxGeo(0.4, 0.14, 0.03, 'ma_planks'), M(0, 0.86, -0.19));
  });
}
function maBed(K, x0, y, z0, x1, z1) {
  const along = x1 - x0 >= z1 - z0;
  K.group('Lit', () => {
    maBoxAll(K, 'ma_planks', 0x5a4838, x0, y + 0.22, z0, x1, y + 0.36, z1);
    for (const [px, pz] of [[x0, z0], [x1 - 0.07, z0], [x0, z1 - 0.07], [x1 - 0.07, z1 - 0.07]]) maBoxAll(K, 'ma_planks', 0x4a3a2c, px, y, pz, px + 0.07, y + 0.62, pz + 0.07, ['bottom']);
    maBoxAll(K, 'kh_canvas', 0x7a7462, x0 + 0.05, y + 0.36, z0 + 0.05, x1 - 0.05, y + 0.5, z1 - 0.05, ['bottom']);
    // couverture froissée, oreiller
    if (along) { maBoxAll(K, 'kh_canvas', 0x5a5a48, x0 + 0.5, y + 0.5, z0 + 0.03, x1 - 0.04, y + 0.56, z1 - 0.03, ['bottom']); maBoxAll(K, 'kh_canvas', 0x9a9480, x0 + 0.1, y + 0.5, z0 + 0.15, x0 + 0.45, y + 0.6, z1 - 0.15, ['bottom']); }
    else { maBoxAll(K, 'kh_canvas', 0x5a5a48, x0 + 0.03, y + 0.5, z0 + 0.5, x1 - 0.03, y + 0.56, z1 - 0.04, ['bottom']); maBoxAll(K, 'kh_canvas', 0x9a9480, x0 + 0.15, y + 0.5, z0 + 0.1, x1 - 0.15, y + 0.6, z0 + 0.45, ['bottom']); }
  });
}
function maStove(K, x, y, z, top) {
  K.group('Poêle', () => {
    maBoxAll(K, 'ma_rust', 0x4a3e36, x - 0.32, y + 0.14, z - 0.26, x + 0.32, y + 0.74, z + 0.26);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) maBoxAll(K, 'ma_rust', 0x2e2622, x + sx * 0.26 - 0.03, y, z + sz * 0.2 - 0.03, x + sx * 0.26 + 0.03, y + 0.14, z + sz * 0.2 + 0.03, ['bottom']);
    maBoxAll(K, 'ma_rust', 0x2a2420, x - 0.2, y + 0.3, z - 0.27, x + 0.2, y + 0.56, z - 0.255, []);
    maCylR(K, 'ma_rust', 0x3a3230, x + 0.12, (y + 0.74 + top) / 2, z + 0.08, 0.065, top - y - 0.74, 10);
  });
}
function maShelf(K, x0, y, z0, x1, z1, hgt = 1.8) {
  K.group('Étagère', () => {
    const along = x1 - x0 >= z1 - z0;
    for (const t of [0, 1]) {
      if (along) maBoxAll(K, 'ma_planks', 0x5a4838, t ? x1 - 0.04 : x0, y, z0, t ? x1 : x0 + 0.04, y + hgt, z1, ['bottom']);
      else maBoxAll(K, 'ma_planks', 0x5a4838, x0, y, t ? z1 - 0.04 : z0, x1, y + hgt, t ? z1 : z0 + 0.04, ['bottom']);
    }
    for (let i = 0; i < 4; i++) {
      const yy = y + 0.1 + i * (hgt - 0.15) / 3;
      maBoxAll(K, 'ma_planks', 0x6a5644, x0 + 0.01, yy, z0 + 0.01, x1 - 0.01, yy + 0.03, z1 - 0.01);
      // bocaux, boîtes
      if (i > 0) for (let j = 0; j < 3; j++) {
        const t = (j + 0.5 + (Math.random() - 0.5) * 0.4) / 3, px = along ? lerp(x0 + 0.1, x1 - 0.1, t) : (x0 + x1) / 2, pz = along ? (z0 + z1) / 2 : lerp(z0 + 0.1, z1 - 0.1, t);
        if (Math.random() < 0.55) maCylR(K, 'ma_glass', [0x8a9a6a, 0x9a8a6a, 0x7a8a8a][j], px, yy + 0.03 + 0.1, pz, 0.06, 0.2, 8);
        else maBoxAll(K, 'kh_canvas', [0x8a6a4a, 0x6a6a5a, 0x9a8a6a][j], px - 0.09, yy + 0.03, pz - 0.07, px + 0.09, yy + 0.2, pz + 0.07, ['bottom']);
      }
    }
  });
}
function maPew(K, x0, y, z0, z1) {
  // banc d'église, assise vers +x, dossier côté x0
  K.group('Banc', () => {
    maBoxAll(K, 'ma_planks', 0xa08a6c, x0 + 0.1, y + 0.42, z0, x0 + 0.5, y + 0.47, z1);
    maBoxAll(K, 'ma_planks', 0x947e62, x0, y + 0.47, z0, x0 + 0.06, y + 0.98, z1);
    maBoxAll(K, 'ma_planks', 0x947e62, x0 + 0.06, y + 0.9, z0, x0 + 0.1, y + 0.98, z1, ['bottom']);
    for (const z of [z0, (z0 + z1) / 2 - 0.03, z1 - 0.06]) maBoxAll(K, 'ma_planks', 0x7a6650, x0, y, z, x0 + 0.5, y + 0.42, z + 0.06, ['top', 'bottom']);
    maBoxAll(K, 'ma_planks', 0x7a6650, x0 + 0.06, y + 0.1, z0, x0 + 0.5, y + 0.14, z1, ['bottom']);
  });
}

/* ---- Post-traitement : pied humide. Les sommets proches de la vase ou de l'eau assombris (et
   un peu verdis), dans les matières des murs, des pieux et des métaux. */
const MA_DAMP = { ma_siding: 1, ma_logs: 1, ma_concrete: 1, ma_tin: 0.6, ma_panel: 0.8, stone_moss: 0.8, stone_rubble: 0.9, ma_steel: 0.9, ma_hull: 0.7, ma_rust: 0.6, ma_bark: 0.7 };
function maDampen(K) {
  const d = K.dump();
  for (const [tex, b] of d.parts) {
    const k = MA_DAMP[tex];
    if (!k) continue;
    const P = b.pos, C = b.col;
    for (let i = 0; i < P.length; i += 3) {
      const g = Math.max(owH(P[i], P[i + 2]), MA.water), hgt = P[i + 1] - g;
      const f = 1 - k * 0.5 * (1 - owSmoothstep(-0.25, 1.5, hgt));
      if (f < 0.999) { C[i] *= f * 0.97; C[i + 1] *= f * 1.01; C[i + 2] *= f * 0.94; }
    }
  }
}
/* Matières propres aux lieux : verre (carreaux, bocaux). */
function maPlaceMaterials() {
  if (!VMAT.ma_glass) {
    VMAT.ma_glass = share(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  }
}

/* ---- Géométrie à la main (sens des faces vérifié comme maQuad), coordonnées de texture en m. */
function maMesh() {
  const pos = [], nor = [], uv = [];
  const M = {
    quad(a, b, c, d, n, uvf) {
      const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = c[0] - a[0], by = c[1] - a[1], bz = c[2] - a[2];
      const flip = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0;
      const P = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
      for (const p of P) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); const t = uvf(p); uv.push(t[0], t[1]); }
      return M;
    },
    geo() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return g;
    },
  };
  return M;
}
const maNrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
/* Toit en pyramide épais (clocheton) : quatre pans, sous-face, bandeau. */
function maPyramidRoof(K, cx, cz, hw, yp, rise, tex, hex, under) {
  const ya = yp + rise, th = 0.08, s = rise / hw;
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = C[i], [bx, bz] = C[(i + 1) % 4], mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const n = maNrm(mx * s, 1, mz * s), nd = [-n[0], -n[1], -n[2]];
    const A = [cx + ax * hw, yp + th, cz + az * hw], B = [cx + bx * hw, yp + th, cz + bz * hw], T = [cx, ya + th, cz];
    const uvf = (p) => [mx === 0 ? p[0] : p[2], p[1] * 1.4];
    maTri(K, tex, hex, A, B, T, n, uvf);
    maTri(K, under[0], under[1], [A[0], yp, A[2]], [B[0], yp, B[2]], [cx, ya, cz], nd, uvf);
    maQuad(K, 'ma_planks', 0x4e4034, [A[0], yp - 0.04, A[2]], [B[0], yp - 0.04, B[2]], B, A, [mx, 0, mz], (p) => [p[0] + p[2], p[1]]);
  }
}
/* Cloche (bronze) : profil tourné dehors et dedans. */
function maBell(K, x, y, z, k = 1) {
  const P = [[0.4, 0], [0.385, 0.05], [0.31, 0.17], [0.27, 0.36], [0.25, 0.54], [0.19, 0.62], [0.07, 0.665], [0.001, 0.672]];
  const out = new THREE.LatheGeometry(P.map((p) => new THREE.Vector2(p[0] * k, p[1] * k)), 18);
  const inn = new THREE.LatheGeometry(P.slice(0, 6).reverse().map((p) => new THREE.Vector2(Math.max(0.001, p[0] - 0.025) * k, p[1] * k)), 18);
  maGeo(K, 'ma_rust', 0x6a6a44, out, mtx(x, y, z));
  maGeo(K, 'ma_rust', 0x2e2a1e, inn, mtx(x, y, z));
  maCylR(K, 'ma_rust', 0x3a3428, x, y + 0.12 * k, z, 0.035 * k, 0.3 * k, 6);                     // battant
  maGeo(K, 'ma_rust', 0x3a3428, new THREE.SphereGeometry(0.06 * k, 8, 6), mtx(x, y - 0.02 * k, z));
}
/* Clocheton à cheval sur le faîtage : socle (enfoncé dans le toit), abat-son, poteaux, cloche, toit en
   pyramide, croix. yBase : dessus du socle. */
function maBelfry(K, bx, bz, yBase, wallHex) {
  const S = ['ma_siding', wallHex || 0xd0ccc0], T = ['ma_planks', 0x5a4c3e], hP = 1.5, hw = 0.85;
  K.group('Clocheton', () => {
    maBoxAll(K, S[0], S[1], bx - 0.95, yBase - 1.7, bz - 0.95, bx + 0.95, yBase, bz + 0.95, ['bottom']);
    maBoxAll(K, T[0], T[1], bx - 1.06, yBase - 0.05, bz - 1.06, bx + 1.06, yBase + 0.07, bz + 1.06);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) maBoxAll(K, S[0], S[1], bx + sx * hw - 0.1, yBase + 0.07, bz + sz * hw - 0.1, bx + sx * hw + 0.1, yBase + 0.07 + hP, bz + sz * hw + 0.1, ['bottom', 'top']);
    // abat-son : trois lames inclinées en bas de chaque face
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 0; i < 3; i++) {
        const yy = yBase + 0.22 + i * 0.2, ox = ax * hw, oz = az * hw;
        const a = ax ? [bx + ox, yy, bz - hw + 0.1] : [bx - hw + 0.1, yy, bz + oz], b = ax ? [bx + ox, yy, bz + hw - 0.1] : [bx + hw - 0.1, yy, bz + oz];
        maGeo(K, T[0], T[1], maBoxGeo(Math.hypot(b[0] - a[0], b[2] - a[2]), 0.03, 0.2, T[0]), mtx((a[0] + b[0]) / 2, yy, (a[2] + b[2]) / 2, ax ? 0 : (az > 0 ? -0.55 : 0.55), ax ? Math.PI / 2 : 0, ax ? (ax > 0 ? 0.55 : -0.55) : 0));
      }
    }
    // sablière
    maBoxAll(K, T[0], T[1], bx - 1.0, yBase + 0.07 + hP, bz - 1.0, bx + 1.0, yBase + 0.2 + hP, bz + 1.0);
    // mouton et cloche
    maBeam(K, 'ma_planks', 0x4a3c30, [bx - hw, yBase + 1.32, bz], [bx + hw, yBase + 1.32, bz], 0.14, 0.16);
    maBell(K, bx, yBase + 0.56, bz, 1);
    maPyramidRoof(K, bx, bz, 1.22, yBase + 0.2 + hP, 1.25, 'ma_tin', 0xffffff, ['ma_planks', 0x7a6a58]);
    const yc = yBase + 0.2 + hP + 1.25 + 0.08;
    maBoxAll(K, 'ma_rust', 0x3a3028, bx - 0.04, yc, bz - 0.04, bx + 0.04, yc + 0.9, bz + 0.04);
    maBoxAll(K, 'ma_rust', 0x3a3028, bx - 0.3, yc + 0.55, bz - 0.04, bx + 0.3, yc + 0.63, bz + 0.04);
  });
}
/* Château d'eau : quatre pieds inclinés contreventés, cuve d'acier peint, toit conique, échelle. */
function maWaterTower(K, cx, cz, wy) {
  const legs = [[cx - 3, cz - 3], [cx + 3, cz - 3], [cx - 3, cz + 3], [cx + 3, cz + 3]];
  const topOf = ([px, pz]) => [lerp(px, cx, 0.2), wy + 12, lerp(pz, cz, 0.2)];
  K.group('Château d’eau', () => {
    for (const p of legs) maBeam(K, 'ma_steel', 0x8a8a7e, [p[0], wy - 0.5, p[1]], topOf(p), 0.25, 0.25);
    // entretoises horizontales et croix de Saint-André entre pieds voisins
    const at = (p, t) => [lerp(p[0], topOf(p)[0], t), lerp(wy - 0.5, wy + 12, t), lerp(p[1], topOf(p)[2], t)];
    for (const [i, j] of [[0, 1], [1, 3], [3, 2], [2, 0]]) {
      for (const t of [0.33, 0.66, 0.97]) maBeam(K, 'ma_steel', 0x7a7a70, at(legs[i], t), at(legs[j], t), 0.1, 0.1);
      for (const [t0, t1] of [[0.04, 0.33], [0.33, 0.66], [0.66, 0.97]]) {
        maBeam(K, 'ma_rust', 0x6a6058, at(legs[i], t0), at(legs[j], t1), 0.05, 0.05);
        maBeam(K, 'ma_rust', 0x6a6058, at(legs[j], t0), at(legs[i], t1), 0.05, 0.05);
      }
    }
    maCylR(K, 'ma_steel', 0xb8b4a6, cx, wy + 13.6, cz, 3.2, 3.4, 28);
    maCylR(K, 'ma_steel', 0x6a6a60, cx, wy + 12.05, cz, 3.25, 0.12, 28);                    // cerclage du fond
    maCylR(K, 'ma_steel', 0x6a6a60, cx, wy + 15.25, cz, 3.25, 0.12, 28);                    // et du haut
    maCylR(K, 'ma_tin', 0xd0c8b8, cx, wy + 15.9, cz, 3.45, 1.2, 28, 0, 0, 0, 0.2);          // toit conique
    maCylR(K, 'ma_steel', 0x5a5a52, cx, wy + 16.6, cz, 0.12, 0.3, 8);
    // échelle (côté est)
    const lx = cx + 3.6;
    for (const dz of [-0.22, 0.22]) maBoxAll(K, 'ma_rust', 0x5a4030, lx - 0.03, wy, cz + dz - 0.03, lx + 0.03, wy + 12.2, cz + dz + 0.03);
    for (let y = wy + 0.35; y < wy + 12; y += 0.32) maBoxAll(K, 'ma_rust', 0x5a4030, lx - 0.02, y, cz - 0.22, lx + 0.02, y + 0.035, cz + 0.22);
  });
}
/* Mât radio en treillis : trois membrures, entretoises et diagonales tous les 2 m. */
function maRadioMast(K, x, z, y0, H) {
  const at = (i, t) => { const a = (i / 3) * TAU, r = lerp(0.55, 0.12, t); return [x + Math.cos(a) * r, y0 + H * t, z + Math.sin(a) * r]; };
  K.group('Mât radio', () => {
    for (let i = 0; i < 3; i++) maBeam(K, 'ma_steel', 0x9a9a90, at(i, 0), at(i, 1), 0.07, 0.07);
    const n = Math.round(H / 2);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      for (let i = 0; i < 3; i++) {
        maBeam(K, 'ma_steel', 0x8a8a80, at(i, t1), at((i + 1) % 3, t1), 0.035, 0.035);
        maBeam(K, 'ma_steel', 0x8a8a80, at(i, t0), at((i + 1) % 3, t1), 0.03, 0.03);
      }
    }
  });
}
/* Cuve horizontale (fioul) sur deux berceaux de béton. */
function maFuelTank(K, x, z, y0, r, L, hex) {
  K.group('Cuve', () => {
    const yc = y0 + r + 0.45;
    maCylR(K, 'ma_steel', hex, x, yc, z, r, L, 22, Math.PI / 2, 0, 0);
    for (const dz of [-L / 2 + 0.35, L / 2 - 0.35]) maCylR(K, 'ma_steel', 0x5a5650, x, yc, z + dz, r + 0.03, 0.12, 22, Math.PI / 2, 0, 0);
    // fonds bombés
    for (const sg of [-1, 1]) maGeo(K, 'ma_steel', hex, new THREE.SphereGeometry(r, 22, 8, 0, TAU, 0, Math.PI / 2), mtx(x, yc, z + (sg * L) / 2, (sg * Math.PI) / 2, 0, 0, 1, 0.22, 1));
    for (const dz of [-L * 0.3, L * 0.3]) maBoxAll(K, 'ma_concrete', 0x9a968a, x - r * 0.8, y0 - 0.3, z + dz - 0.25, x + r * 0.8, y0 + 0.75, z + dz + 0.25);
    maCylR(K, 'ma_steel', 0x5a5650, x, y0 + 2 * r + 0.55, z - L * 0.25, 0.18, 0.25, 10);       // trou d'homme
  });
}
/* Conduite (de a à b, horizontale ou presque) : tube d'acier, brides tous les 2 m. */
function maPipe(K, a, b, r, hex = 0x7a6a5a) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  _mbX.set(dx / L, dy / L, dz / L);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), _mbX);
  const put = (t, rr, h) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(a[0] + dx * t, a[1] + dy * t, a[2] + dz * t), q, new THREE.Vector3(1, 1, 1));
    maGeo(K, 'ma_steel', rr > r ? 0x4e4a44 : hex, maCylGeo(rr, h, 14, 'ma_steel'), m);
  };
  K.group('Conduite', () => {
    put(0.5, r, L);
    const n = Math.max(1, Math.round(L / 2));
    for (let i = 0; i <= n; i++) put(i / n, r + 0.06, 0.08);
  });
}
/* Grume (écorce aux bonnes proportions, bouts de bois clair). */
function maLog(K, x, y, z, r, L, yaw) {
  const B = mtx(x, y, z, 0, yaw, Math.PI / 2);
  maGeo(K, 'ma_bark', 0xd0c4b4, maCylGeo(r, L, 12, 'ma_bark'), B);
  for (const s of [-1, 1]) maGeo(K, 'ma_planks', 0xb8a080, maCylGeo(r * 0.94, 0.02, 12, 'ma_planks'), B.clone().multiply(new THREE.Matrix4().makeTranslation(0, (s * L) / 2, 0)));
}
/* Pierre levée : prisme à sept pans, effilé, bosselé (déterministe). */
function maStoneGeo(w, h, d, seed) {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 7, 5), p = g.attributes.position, S = maTexSize('ma_stone');
  const hash = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.3) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y + 0.5, j = 1 + (hash(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)) - 0.5) * 0.28;
    const taper = (1 - 0.3 * t * t) * j, top = y > 0.49 ? 0.5 - 0.12 * (1 - Math.hypot(x, z) * 2) : y;
    p.setXYZ(i, x * w * taper, top * h, z * d * taper);
  }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * (w + d) * 0.5) / S[0], (uv.getY(i) * h) / S[1]);
  g.computeVertexNormals();
  return g;
}

/* ---- Péniche échouée : coque d'acier goudronné à étrave et tableau en pente, pont de planches,
   pavois (ouvert à la coupée, côté de la passerelle), deux panneaux de cale, timonerie fermée
   (fenêtres, porte à hublot, cheminée), bittes, treuil, cordage. Cases : le pont (comme avant),
   le bord du pont en cases basses (pavois) sauf à la coupée, la timonerie pleine. */
function maBarge(K, bx, bz, by, rot, len, wid) {
  const M0 = mtx(bx, by, bz, 0, rot, 0.06), L2 = len / 2, W2 = wid / 2, yd = 1.5, yb = -0.9, bowX = L2 - 2.6, sternX = -L2 + 0.8;
  const T = (x, y, z, rx = 0, ry = 0, rz = 0) => M0.clone().multiply(mtx(x, y, z, rx, ry, rz));
  const box = (tex, hex, x, y, z, sx, sy, sz, rx, ry, rz) => maGeo(K, tex, hex, maBoxGeo(sx, sy, sz, tex), T(x, y, z, rx, ry, rz));
  const cyl = (tex, hex, x, y, z, r, h, seg, rx, ry, rz) => maGeo(K, tex, hex, maCylGeo(r, h, seg || 12, tex), T(x, y, z, rx, ry, rz));
  const gap = [-3.4, -0.6];                                                     // coupée (côté -z)
  K.group('Péniche', () => {
    // coque
    const H = maMesh();
    for (const s of [-1, 1]) H.quad([-L2, yd, s * W2], [sternX, yb, s * W2], [bowX, yb, s * W2], [L2, yd, s * W2], [0, 0, s], (p) => [p[0] / 2, p[1] / 2]);
    const nb = maNrm(yd - yb, -(L2 - bowX), 0), ns = maNrm(-(yd - yb), -(sternX + L2), 0);
    H.quad([bowX, yb, -W2], [bowX, yb, W2], [L2, yd, W2], [L2, yd, -W2], nb, (p) => [p[2] / 2, Math.hypot(p[0] - bowX, p[1] - yb) / 2]);
    H.quad([sternX, yb, -W2], [sternX, yb, W2], [-L2, yd, W2], [-L2, yd, -W2], ns, (p) => [p[2] / 2, Math.hypot(p[0] - sternX, p[1] - yb) / 2]);
    maGeo(K, 'ma_hull', 0xffffff, H.geo(), M0);
    // liston (bourrelet de défense) et pont
    for (const s of [-1, 1]) box('ma_hull', 0x6a5a48, 0, yd - 0.12, s * (W2 + 0.05), len - 0.6, 0.18, 0.12);
    box('ma_planks', 0x7a6a56, 0, yd - 0.03, 0, len - 0.06, 0.06, wid - 0.06);
    // pavois
    const bw = (x0, x1, s) => { if (x1 - x0 > 0.05) { box('ma_hull', 0xb0a8a0, (x0 + x1) / 2, yd + 0.3, s * (W2 - 0.04), x1 - x0, 0.6, 0.08); box('ma_rust', 0x6a5444, (x0 + x1) / 2, yd + 0.63, s * (W2 - 0.04), x1 - x0, 0.06, 0.14); } };
    bw(-L2 + 0.04, gap[0], -1); bw(gap[1], L2 - 0.04, -1); bw(-L2 + 0.04, L2 - 0.04, 1);
    for (const x of [-L2 + 0.04, L2 - 0.04]) { box('ma_hull', 0xb0a8a0, x, yd + 0.3, 0, 0.08, 0.6, wid - 0.16); box('ma_rust', 0x6a5444, x, yd + 0.63, 0, 0.14, 0.06, wid - 0.1); }
    // panneaux de cale (hiloires d'acier, couvercles de planches)
    for (const [x0, x1] of [[0.2, 4.2], [5.0, 8.4]]) {
      box('ma_steel', 0x6a6e66, (x0 + x1) / 2, yd + 0.06, 0, x1 - x0, 0.12, 4.4);
      for (let x = x0 + 0.05; x < x1 - 0.05; x += 0.8) box('ma_planks', 0x5e5040, x + 0.37, yd + 0.135, 0, 0.72, 0.03, 4.3);
    }
    // timonerie
    const wx0 = -L2 + 1.2, wx1 = -L2 + 5.2, wc = (wx0 + wx1) / 2, wh = 2.3;
    box('ma_steel', 0xd8d2c4, wc, yd + wh / 2, 0, wx1 - wx0, wh, 4);
    box('ma_steel', 0x8a8478, wc, yd + wh + 0.06, 0, wx1 - wx0 + 0.5, 0.12, 4.5);
    for (let i = 0; i < 3; i++) { const z = -1.2 + i * 1.2; box('ma_hull', 0x1c2220, wx1 + 0.012, yd + 1.62, z, 0.02, 0.62, 0.86); box('ma_steel', 0x6a6a60, wx1 + 0.03, yd + 1.28, z, 0.05, 0.06, 1.0); }
    for (const z of [-0.9, 0.9]) box('ma_hull', 0x1c2220, wx0 - 0.012, yd + 1.62, z, 0.02, 0.6, 0.8);
    for (const s of [-1, 1]) for (const x of [wx0 + 0.9, wx1 - 0.9]) cyl('ma_hull', 0x1c2220, x, yd + 1.65, s * 2.012, 0.2, 0.02, 14, Math.PI / 2, 0, 0);
    box('ma_steel', 0x9a9488, wc + 0.6, yd + 1.0, 2.02, 0.8, 1.95, 0.04);                       // porte (tribord)
    cyl('ma_hull', 0x1c2220, wc + 0.6, yd + 1.5, 2.045, 0.13, 0.02, 12, Math.PI / 2, 0, 0);
    cyl('ma_hull', 0x2e2a26, wc - 0.8, yd + wh + 0.85, 0.3, 0.3, 1.5, 14);                     // cheminée
    cyl('ma_rust', 0x4a3a30, wc - 0.8, yd + wh + 1.62, 0.3, 0.34, 0.08, 14);
    cyl('ma_steel', 0x8a8478, wc + 1.2, yd + wh + 0.3, -1.2, 0.16, 0.36, 10);                  // projecteur
    // bittes, treuil, cordage
    for (const x of [L2 - 1.1, -L2 + 0.6]) for (const s of [-1, 1]) cyl('ma_rust', 0x4a3e36, x, yd + 0.25, s * 2.3, 0.14, 0.5, 10);
    box('ma_steel', 0x5a5e58, L2 - 2.4, yd + 0.35, 0, 0.6, 0.7, 1.6);
    cyl('ma_rust', 0x5a4a3e, L2 - 2.4, yd + 0.55, 0, 0.26, 1.3, 14, Math.PI / 2, 0, 0);
    maGeo(K, 'kh_canvas', 0x8a7a5a, new THREE.TorusGeometry(0.34, 0.07, 6, 16), T(L2 - 3.6, yd + 0.08, 1.9, Math.PI / 2, 0, 0));
    maGeo(K, 'kh_canvas', 0x8a7a5a, new THREE.TorusGeometry(0.26, 0.07, 6, 14), T(L2 - 3.6, yd + 0.2, 1.9, Math.PI / 2, 0, 0));
  });
  // cases : pont praticable, pavois (cases basses) sauf à la coupée, timonerie pleine
  const cells = new Map();
  for (let lx = -L2 + 0.25; lx < L2; lx += 0.5) for (let lz = -W2 + 0.25; lz < W2; lz += 0.5) {
    const wx = bx + Math.cos(rot) * lx + Math.sin(rot) * lz, wz = bz - Math.sin(rot) * lx + Math.cos(rot) * lz;
    const key = Math.floor(wx) + ',' + Math.floor(wz), y = by + 1.55 + Math.sin(0.06) * lx;
    const edge = (Math.abs(lz) > W2 - 0.5 || Math.abs(lx) > L2 - 0.5) && !(lz < 0 && lx > gap[0] && lx < gap[1]);
    const wheel = lx > -L2 + 1.1 && lx < -L2 + 5.3 && Math.abs(lz) < 2.1;
    const c = cells.get(key) || { cx: Math.floor(wx), cz: Math.floor(wz), y, n: 0, edge: 0, wheel: 0 };
    c.n++; if (edge) c.edge++; if (wheel) c.wheel++;
    c.y = Math.max(c.y, y);
    cells.set(key, c);
  }
  for (const c of cells.values()) {
    if (c.wheel * 2 >= c.n) owSet(OW.surf, c.cx, c.cz, OWK.SOLID, { base: c.y - 0.3, top: c.y + 2.5, mat: OWM.METAL });
    else if (c.edge * 2 > c.n) owSet(OW.surf, c.cx, c.cz, OWK.LOW, { base: c.y, top: c.y + 0.65, mat: OWM.METAL });
    else owSet(OW.surf, c.cx, c.cz, OWK.FLOOR, { base: c.y, mat: OWM.METAL });
  }
}
