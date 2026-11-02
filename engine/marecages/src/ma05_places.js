
/* ------------------------------------------------------------- Les lieux --
   Construits avec le kit des lieux (une géométrie par matière, les cases des solides : sols de
   planches, murs, fenêtres) ; les hauteurs se prennent sur le relief au chargement (pilotis à la
   demande). Les pontons s'avancent jusqu'à l'eau assez profonde pour une barque ; leur bout est
   noté (MA.docks) : les barques de la carte y sont amarrées. Repères : MA.spots (éléments posés
   par la carte sur ces constructions : armes au mur, atouts, boîte, disjoncteurs, Le Glas). */
const MA_PL = { docks: {}, spots: {}, lamps: [] };
const maGround = (x, z) => owH(x, z);
// sol le plus haut sous un rectangle (pour poser un plancher au-dessus de la vase)
function maMaxGround(x0, z0, x1, z1) {
  let m = -1e9;
  for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) m = Math.max(m, owH(x, z));
  return m;
}
/* Pieu (perche goudronnée) de bas en haut ; kit MM 2.1.5 : écorce de cyprès à l'échelle (avant : des
   rondins couchés étirés sur la hauteur). */
function maPost(K, x, z, yTop, r = 0.11, tex = 'ma_bark', hex = 0x857565) {
  const yb = Math.min(owH(x, z), MA.water) - 0.4;
  maCylR(K, tex, hex, x, (yb + yTop) / 2, z, r, yTop - yb, 8);
}
/* Plancher (ponton, terrasse, place) : lames, poutres de rive, pieux ; cases de sol praticables. */
function maDeck(K, x0, z0, x1, z1, y, o = {}) {
  const t = o.tex || 'ma_deck', th = 0.16;
  K.group(o.name || 'Plancher', () => {
    K.box(t, o.hex || 0xffffff, x0, y - th, z0, x1, y, z1);
    // poutres sous les rives
    K.box('ma_planks', 0x7a6a56, x0, y - th - 0.22, z0, x1, y - th, z0 + 0.18, { skip: ['top'] });
    K.box('ma_planks', 0x7a6a56, x0, y - th - 0.22, z1 - 0.18, x1, y - th, z1, { skip: ['top'] });
    if (o.posts !== false) {
      const sx = Math.max(1, Math.round((x1 - x0) / (o.span || 2.6))), sz = Math.max(1, Math.round((z1 - z0) / (o.span || 2.6)));
      for (let i = 0; i <= sx; i++) for (let j = 0; j <= sz; j++) {
        if (i > 0 && i < sx && j > 0 && j < sz) continue;          // pieux sur le pourtour
        const px = lerp(x0 + 0.15, x1 - 0.15, i / sx), pz = lerp(z0 + 0.15, z1 - 0.15, j / sz);
        if (owH(px, pz) > y - 0.25) continue;                      // posé sur le sol
        maPost(K, px, pz, y - th, 0.1);
      }
    }
  });
  K.solid(x0, z0, x1, z1, OWK.FLOOR, { base: y, mat: OWM.WOOD });
  if (o.rail) maRails(K, x0, z0, x1, z1, y, o.rail);
}
/* Garde-corps sur certains côtés ('n', 's', 'w', 'e') : lisse et poteaux (visuel ; la case reste
   praticable : on ne tombe pas, on s'y appuie : cases basses LOW sur le bord). */
function maRails(K, x0, z0, x1, z1, y, sides) {
  const H = 0.95, hex = 0x786a58;
  const run = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.6));
    for (let i = 0; i <= n; i++) { const px = lerp(ax, bx, i / n), pz = lerp(az, bz, i / n); K.box('ma_planks', hex, px - 0.05, y, pz - 0.05, px + 0.05, y + H, pz + 0.05, { skip: ['bottom'] }); }
    maBeam(K, 'ma_planks', hex, [ax, y + H, az], [bx, y + H, bz], 0.09, 0.07);
    maBeam(K, 'ma_planks', hex, [ax, y + H * 0.5, az], [bx, y + H * 0.5, bz], 0.05, 0.06);
  };
  for (const s of sides) {
    if (s === 'n') { run(x0, z0 + 0.05, x1, z0 + 0.05); K.solid(x0, z0, x1, z0 + 0.5, OWK.LOW, { base: y, top: y + H, mat: OWM.WOOD }); }
    if (s === 's') { run(x0, z1 - 0.05, x1, z1 - 0.05); K.solid(x0, z1 - 0.5, x1, z1, OWK.LOW, { base: y, top: y + H, mat: OWM.WOOD }); }
    if (s === 'w') { run(x0 + 0.05, z0, x0 + 0.05, z1); K.solid(x0, z0, x0 + 0.5, z1, OWK.LOW, { base: y, top: y + H, mat: OWM.WOOD }); }
    if (s === 'e') { run(x1 - 0.05, z0, x1 - 0.05, z1); K.solid(x1 - 0.5, z0, x1, z1, OWK.LOW, { base: y, top: y + H, mat: OWM.WOOD }); }
  }
}
/* Marches (cases de sol de plus en plus hautes, 0,45 m au plus) de (x, z) vers dir ('n','s','w','e'). */
function maSteps(K, x, z, w, dir, y0, y1) {
  const n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.42)), [dx, dz] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir];
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, (i + 1) / n), cx = x + dx * i, cz = z + dz * i;
    const ax0 = dx ? Math.min(cx, cx + dx) : x - w / 2, ax1 = dx ? Math.max(cx, cx + dx) : x + w / 2;
    const az0 = dz ? Math.min(cz, cz + dz) : z - w / 2, az1 = dz ? Math.max(cz, cz + dz) : z + w / 2;
    K.box('ma_deck', 0xffffff, ax0, y - 0.12, az0, ax1, y, az1);
    K.box('ma_planks', 0x6a5a48, ax0 + 0.05, Math.min(y0, y) - 0.6, az0 + 0.05, ax1 - 0.05, y - 0.12, az1 - 0.05, { skip: ['top'] });
    K.solid(ax0, az0, ax1, az1, OWK.FLOOR, { base: y, mat: OWM.WOOD });
  }
  return [x + dx * n, z + dz * n];
}
/* Ponton qui part de la rive (x, z) dans la direction dir jusqu'à 1,8 m d'eau (+ 4 m), 2 m de large ;
   renvoie son bout et l'amarre de chaque côté (pour les barques). */
function maDock(K, id, x, z, dir, o = {}) {
  const [dx, dz] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir], w = o.w || 2.4, y = o.y || 0.75;
  let L = 0;
  for (; L < 60; L += 1) if (maDepth(x + dx * L, z + dz * L) > 1.3) break;
  L = Math.min(64, L + (o.extra || 4));
  const ex = x + dx * L, ez = z + dz * L;
  const x0 = Math.min(x, ex) - (dx ? 0 : w / 2), x1 = Math.max(x, ex) + (dx ? 0 : w / 2), z0 = Math.min(z, ez) - (dz ? 0 : w / 2), z1 = Math.max(z, ez) + (dz ? 0 : w / 2);
  maDeck(K, Math.round(x0), Math.round(z0), Math.round(x1), Math.round(z1), y, { name: 'Ponton', span: 2.4 });
  // tête du ponton : plus large, bittes d'amarrage, lanterne
  const hx = ex, hz = ez, side = [-dz, dx];
  const tx0 = Math.round(Math.min(hx - side[0] * 3.2, hx + side[0] * 3.2) - (dx ? 1.5 : 0)), tx1 = Math.round(Math.max(hx - side[0] * 3.2, hx + side[0] * 3.2) + (dx ? 1.5 : 0));
  const tz0 = Math.round(Math.min(hz - side[1] * 3.2, hz + side[1] * 3.2) - (dz ? 1.5 : 0)), tz1 = Math.round(Math.max(hz - side[1] * 3.2, hz + side[1] * 3.2) + (dz ? 1.5 : 0));
  maDeck(K, tx0, tz0, tx1, tz1, y, { name: 'Tête du ponton', span: 2.2 });
  for (const s of [-1, 1]) {
    const bx = hx + side[0] * s * 2.9, bz = hz + side[1] * s * 2.9;
    maCylR(K, 'ma_bark', 0x6a5a4a, bx, y + 0.35, bz, 0.13, 0.7, 8);
    maCylR(K, 'ma_rust', 0x6a4a36, bx, y + 0.62, bz, 0.16, 0.06, 10);
  }
  const lx = hx + side[0] * 2.9, lz = hz + side[1] * 2.9;
  const lamp = owLamp(K, lx + dx * 0.32, y + 2.12, lz + dz * 0.32, 0xffb46a, false, 0.8);
  maCylR(K, 'ma_bark', 0x6a5a4a, lx, y + 1.2, lz, 0.075, 2.4, 7);
  maBeam(K, 'ma_planks', 0x4e4034, [lx, y + 2.3, lz], [lx + dx * 0.4, y + 2.3, lz + dz * 0.4], 0.05, 0.06);
  maCylR(K, 'ma_rust', 0x3a3430, lx + dx * 0.32, y + 2.22, lz + dz * 0.32, 0.012, 0.14, 4);
  MA_PL.lamps.push(lamp);
  // amarres : des deux côtés de la tête, barque parallèle au ponton, l'avant vers le large
  const yaw = Math.atan2(-dx, -dz);
  const moor = [-1, 1].map((s) => ({ x: hx + side[0] * s * 4.6 - dx * 1.2, z: hz + side[1] * s * 4.6 - dz * 1.2, yaw }));
  MA_PL.docks[id] = { x: hx, z: hz, y, dir, moor, root: [x, z] };
  return MA_PL.docks[id];
}
/* Ponton depuis l'intérieur d'une île : une allée jusqu'à la berge (dernier mètre au sec), puis le ponton. */
function maDockFrom(K, id, x, z, dir) {
  const [dx, dz] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir];
  let L = 0;
  while (L < 80 && maDepth(x + dx * L, z + dz * L) < 0.05) L += 1;
  const rx = x + dx * Math.max(0, L - 1), rz = z + dz * Math.max(0, L - 1);
  if (L > 2) maWalk(K, [[x, z], [rx, rz]]);
  return maDock(K, id, rx, rz, dir);
}
/* Maison sur pilotis : terrasse devant la porte sous un auvent, toit de tôle à deux pans, escalier vers
   le sol. Kit MM 2.1.5 : maHouse (seuil, menuiseries, toit épais, dessous fermé, solives), croix de
   Saint-André entre pieux voisins, lanterne sur potence. */
function maStiltHouse(K, o) {
  const { x0, z0, x1, z1 } = o, g = maMaxGround(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
  const y = Math.max(g + (o.lift || 1.0), MA.water + 1.3), h = o.h || 2.9;
  const P = o.porch || 's', pw = 2;
  const pr = { n: [x0, z0 - pw, x1, z0], s: [x0, z1, x1, z1 + pw], w: [x0 - pw, z0, x0, z1], e: [x1, z0, x1 + pw, z1] }[P];
  K.group('Pilotis', () => {
    const nx = Math.max(1, Math.round((x1 - x0) / 2.5)), xs = [];
    for (let i = 0; i <= nx; i++) xs.push(lerp(x0 + 0.3, x1 - 0.3, i / nx));
    for (const x of xs) for (const z of [z0 + 0.3, z1 - 0.3]) maPost(K, x, z, y - 0.56, 0.13);
    for (const z of [(z0 + z1) / 2]) for (const x of [xs[0], xs[xs.length - 1]]) maPost(K, x, z, y - 0.56, 0.12);
    // croix de Saint-André entre pieux voisins des longs pans
    for (const z of [z0 + 0.3, z1 - 0.3]) for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1], yb = Math.max(owH((xa + xb) / 2, z), MA.water) + 0.1, yt = y - 0.65;
      if (yt - yb < 0.7) continue;
      maBeam(K, 'ma_planks', 0x5e5040, [xa, yb, z + 0.15], [xb, yt, z + 0.15], 0.05, 0.13);
      maBeam(K, 'ma_planks', 0x5e5040, [xa, yt, z - 0.15], [xb, yb, z - 0.15], 0.05, 0.13);
    }
  });
  maDeck(K, pr[0], pr[1], pr[2], pr[3], y, { name: 'Terrasse', rail: o.rails || [] });
  const H = maHouse(K, { x0, z0, x1, z1, y, h, wall: o.wall || 'ma_siding', wallHex: o.wallHex || 0xffffff, inTex: o.inTex || 'ma_planks', inHex: o.inHex || 0xe2d6c0,
    doors: o.doors, wins: o.wins, roof: 'gable', roofTex: 'ma_tin', roofHex: o.roofHex || 0xffffff, rise: o.rise || 1.3, floorTex: 'ma_planks', ceilTex: 'ma_planks',
    stilt: true, trim: o.trim, glass: o.glass, metal: o.metal, mat: OWM.WOOD });
  // auvent au-dessus de la terrasse
  maPorchRoof(K, H, pr, P, y + h - 0.32, y + 2.32);
  // escalier de la terrasse vers le sol (ou la passerelle)
  if (o.stairs) {
    const sx = { n: (x0 + x1) / 2, s: (x0 + x1) / 2, w: x0 - pw, e: x1 + pw }[P], sz = { n: z0 - pw, s: z1 + pw, w: (z0 + z1) / 2, e: (z0 + z1) / 2 }[P];
    maSteps(K, sx, sz, 1.8, P, y, Math.max(maGround(sx, sz), MA.water + 0.1) + 0.1);
  }
  // lanterne sous l'auvent, sur une potence
  const lp = { n: [(x0 + x1) / 2 + 1.6, z0 - 0.42], s: [(x0 + x1) / 2 + 1.6, z1 + 0.42], w: [x0 - 0.42, (z0 + z1) / 2 + 1.6], e: [x1 + 0.42, (z0 + z1) / 2 + 1.6] }[P];
  const wp = { n: [lp[0], z0], s: [lp[0], z1], w: [x0, lp[1]], e: [x1, lp[1]] }[P];
  maBeam(K, 'ma_rust', 0x3a3430, [wp[0], y + 2.28, wp[1]], [lp[0], y + 2.28, lp[1]], 0.03, 0.03);
  MA_PL.lamps.push(owLamp(K, lp[0], y + 2.12, lp[1], 0xffb060, false, 0.75));
  H.house = { x0, z0, x1, z1 };
  return H;
}
/* Mobilier d'une maison : liste d'objets en coordonnées du monde (sol de la maison H.y). */
function maFurnish(K, H, items) {
  const y = H.y;
  for (const it of items) {
    const [k, a, b, c, d, e] = it;
    if (k === 'lit') { maBed(K, a, y, b, c, d); maLowCells(K, a, b, c, d, y, 0.62); }
    else if (k === 'table') {
      maTable2(K, a, y, b, c, d);
      let bx0 = a - c / 2, bz0 = b - d / 2, bx1 = a + c / 2, bz1 = b + d / 2;
      for (const ch of e || []) { maChair(K, ch[0], y, ch[1], ch[2]); bx0 = Math.min(bx0, ch[0] - 0.22); bx1 = Math.max(bx1, ch[0] + 0.22); bz0 = Math.min(bz0, ch[1] - 0.22); bz1 = Math.max(bz1, ch[1] + 0.22); }
      maLowCells(K, bx0, bz0, bx1, bz1, y, 0.8);
    }
    else if (k === 'poele') { maStove(K, a, y, b, H.top - 0.05); maLowCells(K, a - 0.3, b - 0.25, a + 0.3, b + 0.25, y, 0.75, OWM.METAL); }
    else if (k === 'etagere') { maShelf(K, a, y, b, c, d, e || 1.8); maLowCells(K, a, b, c, d, y, e || 1.8); }
    else if (k === 'chaise') maChair(K, a, y, b, c, !!d);
  }
}
/* Allée de planches sur la vase (segments alignés sur les axes), un peu au-dessus du sol. */
function maWalk(K, pts, w = 2, lift = 0.3) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const x0 = Math.min(ax, bx) - (ax === bx ? w / 2 : 0), x1 = Math.max(ax, bx) + (ax === bx ? w / 2 : 0);
    const z0 = Math.min(az, bz) - (az === bz ? w / 2 : 0), z1 = Math.max(az, bz) + (az === bz ? w / 2 : 0);
    // par tronçons de 4 m : la hauteur suit le sol
    const along = ax === bx ? 'z' : 'x', a0 = along === 'x' ? x0 : z0, a1 = along === 'x' ? x1 : z1;
    for (let s = a0; s < a1 - 0.01; s += 4) {
      const e = Math.min(a1, s + 4);
      const r = along === 'x' ? [s, z0, e, z1] : [x0, s, x1, e];
      const y = Math.max(maMaxGround(r[0], r[1], r[2], r[3]), MA.water) + lift;
      maDeck(K, Math.round(r[0]), Math.round(r[1]), Math.round(r[2]), Math.round(r[3]), y, { name: 'Allée', span: 2 });
    }
  }
}
/* Petites choses : tonneaux, caisses, filets, nasses, croix. */
function maBarrel(K, x, y, z, hex = 0x6a4a30) {
  maCylR(K, 'ma_rust', hex, x, y + 0.45, z, 0.3, 0.9, 14);
  for (const yy of [0.04, 0.3, 0.6, 0.88]) maCylR(K, 'ma_rust', 0x3a2a20, x, y + yy, z, 0.312, 0.035, 14);
  maCylR(K, 'ma_rust', 0x2a2420, x + 0.12, y + 0.91, z + 0.05, 0.04, 0.02, 8);
  owSet(OW.surf, Math.floor(x), Math.floor(z), OWK.LOW, { base: y, top: y + 0.9, mat: OWM.METAL });
}
function maCrate(K, x, y, z, s = 0.8, rot = 0) {
  maBoxR(K, 'ma_planks', 0x9a8466, x, y + s / 2, z, s, s, s, 0, rot, 0);
  for (const yy of [0.06, s - 0.06]) maBoxR(K, 'ma_planks', 0x6a5440, x, y + yy, z, s + 0.03, 0.09, s + 0.03, 0, rot, 0);
  owSet(OW.surf, Math.floor(x), Math.floor(z), OWK.LOW, { base: y, top: y + s, mat: OWM.WOOD });
}
function maCross(K, x, y, z, rot = 0, h = 1.2) {
  K.geo('ma_planks', 0x5a4c3c, GEO.box, mtx(x, y + h / 2, z, (Math.random() - 0.5) * 0.15, rot, (Math.random() - 0.5) * 0.15, 0.09, h, 0.06));
  K.geo('ma_planks', 0x5a4c3c, GEO.box, mtx(x, y + h * 0.72, z, 0, rot, 0, 0.55, 0.08, 0.06));
}
function maNet(K, x, y, z, rot = 0) {
  // séchoir à poissons : deux perches, une traverse, des poissons pendus
  const ax = x - Math.cos(rot) * 1.4, az = z + Math.sin(rot) * 1.4, bx = x + Math.cos(rot) * 1.4, bz = z - Math.sin(rot) * 1.4;
  K.cyl('ma_logs', 0x5a4a3a, ax, y + 1, az, 0.05, 2, 6);
  K.cyl('ma_logs', 0x5a4a3a, bx, y + 1, bz, 0.05, 2, 6);
  K.geo('ma_logs', 0x5a4a3a, GEO.box, beamMtx(ax, y + 1.9, az, bx, y + 1.9, bz, 0.05, 0.05));
  for (let i = 1; i < 8; i++) { const t = i / 8; K.geo('ma_rust', 0x6a6a58, GEO.box, mtx(lerp(ax, bx, t), y + 1.55, lerp(az, bz, t), 0, rot, 0, 0.12, 0.6, 0.03)); }
}

/* ------------------------------------------------------------------ A : le bourg */
function maBuildBourg(K) {
  const I = MA.islands[0];
  // place de planches (départ), réverbère
  const py = Math.max(maMaxGround(510, 697, 524, 708), MA.water) + 0.25;
  maDeck(K, 510, 697, 524, 708, py, { name: 'Place du bourg', posts: false });
  MA_PL.lamps.push(owLampPost(K, 517, py, 697.6, 4.2, 0xffb868, false, [0, 0.8]));
  MA_PL.spots.plaza = { y: py };
  // chapelle : planches blanchies, clocheton, croix ; la porte à l'ouest, sur la place
  const cy = Math.max(maMaxGround(527, 682, 537, 695), MA.water) + 0.35;
  const CH = maHouse(K, { x0: 527, z0: 682, x1: 537, z1: 695, y: cy, h: 4.4, wall: 'ma_siding', wallHex: 0xd8d4c8, inTex: 'ma_siding', inHex: 0xe4e0d4,
    doors: [['w', 5, 2, 2.6]], wins: [['n', 4, 2, 1.4, 3.4], ['s', 4, 2, 1.4, 3.4], ['e', 3, 1, 1.3, 3.2], ['e', 8, 1, 1.3, 3.2]],
    roof: 'gable', roofTex: 'ma_tin', rise: 2.4, floorTex: 'ma_planks', ceilTex: 'ma_planks', found: ['stone_moss', 0xb0b0a0], glass: 'vitrail', trim: 0xa8a294, sash: 0x8a8476 });
  // seuil entre la place et la porte (la place est un peu plus basse)
  maDeck(K, 524, 686, 527, 690, cy, { name: 'Parvis' });
  maSteps(K, 524, 688, 2.4, 'w', cy, Math.max(maGround(523, 688), MA.water) + 0.12);
  // clocheton à cheval sur le faîtage, au droit de la porte
  maBelfry(K, 532, 688.5, cy + 4.4 + 2.4 + 0.75, 0xd0ccc0);
  // dedans : bancs de part et d'autre de l'allée, croix au-dessus de l'atout (mur est)
  for (const x of [529.3, 530.85, 532.4]) { maPew(K, x, cy, 683.3, 686.3); maPew(K, x, cy, 690.7, 693.7); }
  maLowCells(K, 529.3, 683.3, 532.95, 686.3, cy, 1.0); maLowCells(K, 529.3, 690.7, 532.95, 693.7, cy, 1.0);
  K.group('Croix', () => { maBoxAll(K, 'ma_planks', 0x4a3a2c, 535.9, cy + 2.75, 688.43, 535.98, cy + 4.15, 688.57); maBoxAll(K, 'ma_planks', 0x4a3a2c, 535.9, cy + 3.62, 688.05, 535.98, cy + 3.72, 688.95); });
  MA_PL.spots.chapel = { x0: 527, z0: 682, x1: 537, z1: 695, y: cy };
  // petit cimetière derrière la chapelle (croix de travers dans la vase)
  for (let i = 0; i < 9; i++) maCross(K, 541 + (i % 3) * 2.2 + rand(-0.4, 0.4), maGround(541 + (i % 3) * 2.2, 684 + Math.floor(i / 3) * 2.6), 684 + Math.floor(i / 3) * 2.6 + rand(-0.3, 0.3), rand(-0.3, 0.3), rand(1.0, 1.4));
  // maisons sur pilotis (mobilier contre les murs, loin des portes et des vantaux)
  const h1 = maStiltHouse(K, { x0: 458, z0: 701, x1: 466, z1: 708, porch: 'e', doors: [['e', 2, 2]], wins: [['n', 3, 2, 0.9, 2.1], ['s', 3, 2, 0.9, 2.1], ['w', 2, 2, 0.9, 2.1]], rails: ['n', 's'], stairs: true });
  maFurnish(K, h1, [['lit', 459.08, 706.05, 460.98, 706.95], ['table', 460.2, 702.8, 1.1, 0.7, [[461.05, 702.8, -Math.PI / 2], [460.2, 703.55, Math.PI]]], ['poele', 463.5, 706.5], ['etagere', 463.1, 702.02, 464.4, 702.42]]);
  const h2 = maStiltHouse(K, { x0: 571, z0: 694, x1: 579, z1: 701, porch: 'w', doors: [['w', 2, 2]], wins: [['n', 3, 2, 0.9, 2.1], ['e', 2, 2, 0.9, 2.1]], rails: ['n', 's'], stairs: true, wallHex: 0xc8c0aa });
  maFurnish(K, h2, [['lit', 576.05, 699.05, 577.95, 699.95], ['table', 574.4, 699.25, 1.1, 0.7, [[574.4, 698.5, 0]]], ['poele', 577.4, 695.6], ['etagere', 572.62, 695.02, 573.9, 695.42]]);
  const h3 = maStiltHouse(K, { x0: 499, z0: 733, x1: 507, z1: 740, porch: 'n', doors: [['n', 3, 2]], wins: [['s', 3, 2, 0.9, 2.1], ['w', 2, 2, 0.9, 2.1], ['e', 2, 2, 0.9, 2.1]], rails: ['w', 'e'], stairs: true, wallHex: 0xb8c0b0 });
  maFurnish(K, h3, [['lit', 500.05, 737.08, 500.95, 738.98], ['table', 504.9, 738.4, 1.1, 0.7, [[504.9, 737.65, 0]]], ['poele', 505.45, 734.62], ['etagere', 500.02, 734.3, 500.42, 735.0]]);
  const h4 = maStiltHouse(K, { x0: 546, z0: 660, x1: 554, z1: 667, porch: 's', doors: [['s', 3, 2]], wins: [['n', 3, 2, 0.9, 2.1], ['e', 2, 2, 0.9, 2.1]], rails: ['w', 'e'], stairs: true });
  maFurnish(K, h4, [['lit', 547.05, 661.05, 547.95, 662.95], ['table', 551.9, 661.45, 1.1, 0.7, [[551.9, 662.2, Math.PI]]], ['poele', 547.6, 665.4], ['etagere', 552.58, 664.62, 552.98, 665.82]]);
  const h5 = maStiltHouse(K, { x0: 478, z0: 662, x1: 486, z1: 669, porch: 's', doors: [['s', 3, 2]], wins: [['n', 3, 2, 0.9, 2.1], ['w', 2, 2, 0.9, 2.1]], rails: ['w', 'e'], stairs: true, wallHex: 0xc4bca8 });
  maFurnish(K, h5, [['lit', 484.05, 663.05, 484.95, 664.95], ['table', 480.25, 663.45, 1.1, 0.7, [[480.25, 664.2, Math.PI]]], ['poele', 484.4, 667.4], ['etagere', 479.02, 666.6, 479.42, 667.8]]);
  MA_PL.spots.houses = [{ x0: 458, z0: 701, x1: 466, z1: 708, y: h1.y }, { x0: 571, z0: 694, x1: 579, z1: 701, y: h2.y }, { x0: 499, z0: 733, x1: 507, z1: 740, y: h3.y }, { x0: 546, z0: 660, x1: 554, z1: 667, y: h4.y }, { x0: 478, z0: 662, x1: 486, z1: 669, y: h5.y }];
  // allées de planches : place → maisons, place → pontons
  maWalk(K, [[510, 702], [472, 702], [472, 704.5]]);
  maWalk(K, [[524, 702], [566, 702], [566, 697.5]]);
  maWalk(K, [[517, 708], [517, 745]]);
  maWalk(K, [[503, 729], [503, 722], [517, 722]]);
  maWalk(K, [[517, 697], [517, 676], [550, 676], [550, 672]]);
  maWalk(K, [[517, 676], [482, 676], [482, 674]]);
  maWalk(K, [[500, 676], [500, 650]]);
  // pontons sud (deux barques) et nord (une barque)
  maDock(K, 'A-sud', 517, 746, 's');
  maDock(K, 'A-nord', 500, 650, 'n');
  // ponton est, vers La Fosse et la station (le raccourci : il passe au bord du repaire)
  maWalk(K, [[550, 676], [566, 676]]);
  maDockFrom(K, 'A-est', 566, 676, 'e');
  // filets, tonneaux, caisses, une barque pourrie retournée sur la berge
  maNet(K, 492, maGround(492, 712), 712, 0.3); maNet(K, 541, maGround(541, 724), 724, -0.6);
  maBarrel(K, 520.5, py, 698.2); maBarrel(K, 513, py, 706.8); maCrate(K, 522.8, py, 706.6, 0.8, 0.3); maCrate(K, 523.1, py + 0.8, 706.4, 0.6, 0.9);
  {
    const hull = new THREE.CylinderGeometry(0.62, 0.62, 3.8, 12, 1, false, 0, Math.PI), uv = hull.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.0, uv.getY(i) * 1.9);
    maGeo(K, 'ma_planks', 0x5c5446, hull, mtx(486, maGround(486, 728) - 0.08, 728, 0, 0.6, Math.PI / 2).multiply(new THREE.Matrix4().makeScale(1, 1, 0.85)));
  }
}
/* ------------------------------------------------------------------ B : la futaie */
function maBuildFutaie(K) {
  // cabane de trappeur en rondins : soubassement de moellons, bardeaux, cheminée de pierre, bouts des
  // rondins croisés aux angles
  const cy = Math.max(maMaxGround(250, 552, 258, 559), MA.water) + 0.35;
  const CB = maHouse(K, { x0: 250, z0: 552, x1: 258, z1: 559, y: cy, h: 2.7, wall: 'ma_logs', inTex: 'ma_logs', inHex: 0xb0a090,
    doors: [['e', 3, 2]], wins: [['n', 3, 2, 0.9, 1.9], ['s', 3, 2, 0.9, 1.9]], roof: 'gable', roofTex: 'ma_shingle', roofHex: 0xc8bca8, rise: 1.4, floorTex: 'ma_planks',
    found: ['stone_rubble', 0x9a968a], trim: 0x4e3e30, beams: true });
  K.group('Bouts des rondins', () => {
    for (const [cx, cz] of [[250, 552], [258, 552], [250, 559], [258, 559]]) {
      const sx = cx === 250 ? -1 : 1, sz = cz === 552 ? -1 : 1;
      // bouts croisés : un rang sur deux, le rondin du long pan dépasse l'angle, puis celui du pignon
      for (let yy = cy - 0.17, i = 0; yy < cy + 2.6; yy += 0.26, i++) {
        if (i % 2) maLog(K, cx, yy, cz + sz * 0.16 - sz * 0.2, 0.135, 0.72, Math.PI / 2);
        else maLog(K, cx + sx * 0.16 - sx * 0.2, yy, cz, 0.135, 0.72, 0);
      }
    }
  });
  // cheminée de pierre contre le pignon ouest, foyer dedans
  const rg = maGround(249.4, 555.5);
  K.group('Cheminée', () => {
    maBoxAll(K, 'stone_rubble', 0x9a968a, 248.9, rg - 0.3, 554.9, 250, cy + 2.2, 556.3, ['bottom']);
    maBoxAll(K, 'stone_rubble', 0x9a968a, 249.05, cy + 2.2, 555.05, 249.85, cy + 2.7 + 1.4 + 0.9, 556.15, ['bottom']);
    maBoxAll(K, 'stone_rubble', 0x7a766a, 249.0, cy + 4.95, 555.0, 249.9, cy + 5.05, 556.2);
    maBoxAll(K, 'stone_rubble', 0x8a867a, 251.0, cy, 554.7, 251.65, cy + 0.95, 556.3);
    maBoxAll(K, 'ma_rust', 0x1a1612, 251.645, cy + 0.12, 555.05, 251.66, cy + 0.72, 555.95, []);
    maBoxAll(K, 'ma_planks', 0x4a3a2c, 250.98, cy + 0.95, 554.6, 251.8, cy + 1.03, 556.4);
  });
  owSet(OW.surf, 249, 555, OWK.SOLID, { base: rg - 0.5, top: cy + 5, mat: OWM.STONE });
  maLowCells(K, 251, 554.7, 251.65, 556.3, cy, 1.0, OWM.STONE);
  maFurnish(K, CB, [['lit', 251.05, 553.05, 252.95, 553.95], ['table', 255.55, 557.3, 1.0, 0.7, [[254.7, 557.3, Math.PI / 2]]], ['etagere', 255.2, 553.02, 256.4, 553.42]]);
  maDeck(K, 258, 553, 261, 558, cy, { name: 'Perron' });
  MA_PL.lamps.push(owLamp(K, 258.6, cy + 2.3, 555.5 - 1.4, 0xffa850, false, 0.7));
  maBeam(K, 'ma_rust', 0x3a3430, [258, cy + 2.45, 554.1], [258.62, cy + 2.45, 554.1], 0.03, 0.03);
  MA_PL.spots.cabin = { x0: 250, z0: 552, x1: 258, z1: 559, y: cy };
  // scierie : hangar ouvert sur poteaux équarris (fermes, jambes de force), toit épais, mur du fond
  const sy = Math.max(maMaxGround(270, 572, 284, 582), MA.water) + 0.3;
  maDeck(K, 270, 572, 284, 582, sy, { name: 'Plancher de la scierie', tex: 'ma_planks' });
  K.group('Scierie', () => {
    const top = sy + 3.6, xs = [270.3, 277, 283.7];
    for (const px of xs) for (const pz of [572.3, 581.7]) {
      maBoxAll(K, 'ma_planks', 0x6a5a48, px - 0.14, sy, pz - 0.14, px + 0.14, top, pz + 0.14, ['bottom']);
      for (const dz of [pz < 577 ? 0.8 : -0.8]) maBeam(K, 'ma_planks', 0x5a4a3a, [px, top - 0.9, pz], [px, top - 0.12, pz + dz], 0.1, 0.1);
    }
    for (const pz of [572.3, 581.7]) maBoxAll(K, 'ma_planks', 0x5e4e3e, 270.1, top, pz - 0.15, 283.9, top + 0.2, pz + 0.15);
    const R = maGableRoof(K, { x0: 270, z0: 572, x1: 284, z1: 582, top, rise: 1.6, along: true, tex: 'ma_tin', hex: 0xffffff, under: ['ma_planks', 0x7a6a58], fascia: ['ma_planks', 0x4e4034], eave: 0.5, rake: 0.4 });
    // fermes : entrait, poinçon, arbalétriers sous les voliges
    for (const px of xs) {
      maBoxAll(K, 'ma_planks', 0x5a4a3a, px - 0.1, top, 572.3, px + 0.1, top + 0.18, 581.7);
      maBoxAll(K, 'ma_planks', 0x5a4a3a, px - 0.08, top + 0.18, 576.92, px + 0.08, R.yU(577) - 0.02, 577.08);
      for (const s of [-1, 1]) maBeam(K, 'ma_planks', 0x5a4a3a, [px, R.yU(577 + s * 4.5) - 0.11, 577 + s * 4.5], [px, R.yU(577 + s * 0.08) - 0.11, 577 + s * 0.08], 0.12, 0.16);
    }
    maBeam(K, 'ma_planks', 0x5a4a3a, [270.2, R.yU(577) - 0.1, 577], [283.8, R.yU(577) - 0.1, 577], 0.12, 0.16);
    // mur du fond (nord) : planches, on y accroche une arme ; son haut suit la pente du toit
    maBoxAll(K, 'ma_siding', 0xb0a890, 270, sy - 0.3, 572, 284, top, 573, ['top']);
    maQuad(K, 'ma_siding', 0xb0a890, [270, top, 573], [284, top, 573], [284, R.yU(573), 573], [270, R.yU(573), 573], [0, 0, 1], (p) => [p[0], p[1]]);
    maTri(K, 'ma_siding', 0xb0a890, [270, top, 572], [270, top, 573], [270, R.yU(573), 573], [-1, 0, 0], (p) => [p[2], p[1]]);
    maTri(K, 'ma_siding', 0xb0a890, [284, top, 572], [284, top, 573], [284, R.yU(573), 573], [1, 0, 0], (p) => [-p[2], p[1]]);
    // banc de scie : bâti d'acier, lame, moteur, courroie, chariot et sa grume
    maBoxAll(K, 'ma_steel', 0x6a6e66, 275, sy + 0.78, 576, 279, sy + 0.9, 578);
    for (const [lx, lz] of [[275.1, 576.1], [278.8, 576.1], [275.1, 577.8], [278.8, 577.8]]) maBoxAll(K, 'ma_steel', 0x4e524c, lx, sy, lz, lx + 0.1, sy + 0.78, lz + 0.1, ['bottom']);
    maCylR(K, 'ma_steel', 0xb8b8b0, 277, sy + 0.9, 577, 0.62, 0.025, 32, Math.PI / 2, 0, 0);
    maCylR(K, 'ma_rust', 0x3a3430, 277, sy + 0.9, 577, 0.1, 0.12, 10, Math.PI / 2, 0, 0);
    maBoxAll(K, 'ma_steel', 0x3a4a3a, 277.6, sy + 0.18, 578.2, 278.6, sy + 0.78, 578.9, ['bottom']);
    maBeam(K, 'kh_canvas', 0x2a2622, [277, sy + 0.86, 577.06], [278.1, sy + 0.55, 578.5], 0.05, 0.02);
    for (const z of [576.55, 577.45]) maBoxAll(K, 'ma_steel', 0x5a5e58, 271, sy, z - 0.04, 283, sy + 0.12, z + 0.04, ['bottom']);
    maLog(K, 273.2, sy + 0.5, 577, 0.3, 3.2, 0);
  });
  K.solid(270, 572, 284, 573, OWK.SOLID, { base: sy - 0.5, top: sy + 3.6, mat: OWM.WOOD });
  K.solid(275, 576, 279, 578, OWK.LOW, { base: sy, top: sy + 0.9, mat: OWM.METAL });
  K.solid(277, 578, 279, 579, OWK.LOW, { base: sy, top: sy + 0.8, mat: OWM.METAL });
  K.solid(271.6, 576.7, 274.8, 577.3, OWK.LOW, { base: sy, top: sy + 0.8, mat: OWM.WOOD });
  K.group('Grumes', () => { for (let i = 0; i < 6; i++) maLog(K, 287, sy + 0.32 + Math.floor(i / 3) * 0.56, 574 + (i % 3) * 0.66 + Math.floor(i / 3) * 0.33, 0.32, 5, 0); });
  K.solid(284.5, 573, 289.5, 576.5, OWK.LOW, { base: sy, top: sy + 1.3, mat: OWM.WOOD });
  MA_PL.lamps.push(owLamp(K, 277, sy + 3.2, 577, 0xffb060, false, 0.8));
  maCylR(K, 'ma_rust', 0x3a3430, 277, sy + 3.4, 577, 0.012, 0.4, 4);
  MA_PL.spots.sawmill = { x0: 270, z0: 572, x1: 284, z1: 582, y: sy };
  maWalk(K, [[261, 555.5], [266, 555.5], [266, 577], [270, 577]]);
  maWalk(K, [[284, 579], [300, 579], [300, 562], [318, 562]]);
  maDock(K, 'B', 318, 562, 'e');
}
/* ------------------------------------------------------------------ C : la station */
/* Plaque peinte (texte délavé sur tôle) : matière à elle, coordonnées 0..1 sur la plaque. */
function maSignMat(lines) {
  const c = makeCanvas(1024, 224), g = c.getContext('2d');
  const n = valueNoise(256, 56, [[8, 2, 1], [32, 8, 0.5]], 1.6);
  g.fillStyle = '#5e665c'; g.fillRect(0, 0, 1024, 224);
  for (let y = 0; y < 56; y++) for (let x = 0; x < 256; x++) { const v = n[y * 256 + x]; if (v > 0.62) { g.fillStyle = `rgba(110,52,24,${((v - 0.62) * 1.6).toFixed(3)})`; g.fillRect(x * 4, y * 4, 4, 4); } }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(226,218,196,0.82)';
  for (const [t, sz, y] of lines) { g.font = `700 ${sz}px ${FONT_HUD}`; g.fillText(t, 512, y); }
  g.strokeStyle = 'rgba(226,218,196,0.6)'; g.lineWidth = 6; g.strokeRect(14, 14, 996, 196);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,30,14,${(0.2 + Math.random() * 0.3).toFixed(2)})`; const x = Math.random() * 1024; g.fillRect(x, Math.random() * 120, 3 + Math.random() * 5, 40 + Math.random() * 120); }
  const t = toTex(c, { clamp: true });
  return share(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.25 }));
}
function maBuildStation(K) {
  // station de pompage : béton, toit plat, fenêtres hautes à châssis d'acier ; deux atouts dedans
  const py = Math.max(maMaxGround(741, 484, 755, 495), MA.water) + 0.4;
  const ST = maHouse(K, { x0: 741, z0: 484, x1: 755, z1: 495, y: py, h: 4.2, wall: 'ma_concrete', inTex: 'ma_concrete', inHex: 0xa8a89a,
    doors: [['n', 6, 2, 2.6]], wins: [['n', 2, 3, 2.6, 3.6], ['n', 10, 2, 2.6, 3.6], ['s', 3, 3, 2.6, 3.6], ['s', 9, 3, 2.6, 3.6], ['w', 4, 2, 2.6, 3.6], ['e', 4, 2, 2.6, 3.6]],
    roof: 'flat', roofTex: 'ma_concrete', parapet: 0.4, floorTex: 'ma_concrete', mat: OWM.STONE, found: ['ma_concrete', 0x8e8c80], metal: true, glass: 'atelier',
    trim: 0x6a6e66, trimTex: 'ma_steel', revTex: 'ma_concrete', revHex: 0x9a988c, leafTex: 'ma_steel', leafHex: 0x7a8a7e, plinth: false });
  MA_PL.spots.pump = { x0: 741, z0: 484, x1: 755, z1: 495, y: py };
  // plaque au-dessus de la porte
  if (!VMAT.ma_sign_pompe) VMAT.ma_sign_pompe = maSignMat([['STATION DE POMPAGE', 96, 92], ['N° 3  ·  SERVICE DES EAUX  ·  1931', 46, 170]]);
  K.group('Plaque', () => {
    maBoxAll(K, 'ma_steel', 0x4e524c, 746.35, py + 2.93, 483.94, 749.65, py + 3.47, 484, ['top', 'bottom']);
    K.quad('ma_sign_pompe', 0xffffff, [749.62, py + 2.96, 483.935], [746.38, py + 2.96, 483.935], [746.38, py + 3.44, 483.935], [749.62, py + 3.44, 483.935], [0, 0, -1], (p) => [((749.62 - p[0]) / 3.24) * 2, ((p[1] - py - 2.96) / 0.48) * 2]);
  });
  // dedans : deux pompes et leur moteur, armoire de commande, collecteur le long du mur sud, lampe
  K.group('Pompes', () => {
    for (const z of [488.2, 491.6]) {
      maBoxAll(K, 'ma_concrete', 0x8a887c, 742.1, py, z - 0.6, 744.2, py + 0.25, z + 0.6, ['bottom']);
      maCylR(K, 'ma_steel', 0x4a6a5a, 742.75, py + 0.8, z, 0.46, 0.55, 20, 0, 0, Math.PI / 2);
      maCylR(K, 'ma_steel', 0x3a4a44, 743.6, py + 0.68, z, 0.33, 0.95, 18, 0, 0, Math.PI / 2);
      for (let k = 0; k < 5; k++) maCylR(K, 'ma_steel', 0x2e3a34, 743.25 + k * 0.17, py + 0.68, z, 0.36, 0.03, 18, 0, 0, Math.PI / 2);
      maPipe(K, [742.75, py + 0.35, z], [742.75, py - 0.2, z], 0.17, 0x4a5a50);
      maPipe(K, [742.75, py + 1.25, z], [742.75, py + 2.3, z], 0.15, 0x4a5a50);
      maCylR(K, 'ma_rust', 0x8a2a1e, 742.75, py + 1.7, z + 0.22, 0.13, 0.04, 14, Math.PI / 2, 0, 0);      // vanne
    }
    maPipe(K, [742.75, py + 2.3, 488.2], [742.75, py + 2.3, 493.7], 0.18, 0x4a5a50);
    maPipe(K, [742.75, py + 2.3, 493.7], [748, py + 2.3, 493.7], 0.18, 0x4a5a50);
    maPipe(K, [748, py + 2.3, 493.7], [748, py + 0.6, 493.7], 0.18, 0x4a5a50);
    maPipe(K, [748, py + 0.6, 493.7], [748, py + 0.6, 494.6], 0.2, 0x4a5a50);
    maBoxAll(K, 'ma_steel', 0x6a7a70, 742.0, py, 489.6, 742.48, py + 1.9, 490.4, ['bottom']);
    for (let k = 0; k < 3; k++) maCylR(K, 'ma_steel', 0xd8d0b8, 742.49, py + 1.45, 489.75 + k * 0.25, 0.07, 0.02, 12, 0, 0, Math.PI / 2);
  });
  maLowCells(K, 742, 487.6, 744.2, 488.8, py, 1.3, OWM.METAL); maLowCells(K, 742, 491.0, 744.2, 492.2, py, 1.3, OWM.METAL); maLowCells(K, 742, 489.6, 742.5, 490.4, py, 1.9, OWM.METAL);
  MA_PL.lamps.push(owLamp(K, 748, py + 3.5, 489.5, 0xfff0d0, true, 0.75));
  maCylR(K, 'ma_rust', 0x3a3430, 748, py + 3.85, 489.5, 0.012, 0.7, 4);
  maPipe(K, [748, py + 0.6, 494.6], [748, py + 0.6, 503.5], 0.45, 0x6a6e66);         // conduite vers l'eau (sud)
  maPipe(K, [731, py + 0.5, 489.5], [741.05, py + 0.5, 489.5], 0.35, 0x6a6e66);
  for (const [x, z, y0, r] of [[748, 497, py + 0.6, 0.45], [748, 500.5, py + 0.6, 0.45], [733, 489.5, py + 0.5, 0.35], [737, 489.5, py + 0.5, 0.35]]) {
    const g = maGround(x, z);
    if (y0 - r - g > 0.08) maBoxAll(K, 'ma_concrete', 0x8a887c, x - 0.35, g - 0.3, z - 0.3, x + 0.35, y0 - r * 0.6, z + 0.3, ['bottom']);
  }
  K.solid(747.5, 495, 748.5, 504, OWK.LOW, { base: py, top: py + 1.1, mat: OWM.METAL });
  MA_PL.lamps.push(owLamp(K, 748, py + 3, 483.4, 0xfff0d0, true, 0.9));
  maBeam(K, 'ma_rust', 0x3a3430, [748, py + 3.1, 484], [748, py + 3.1, 483.35], 0.04, 0.04);
  // abri du groupe électrogène : les disjoncteurs (courant de la carte)
  const gy = Math.max(maMaxGround(724, 503, 732, 509), MA.water) + 0.3;
  const GS = maHouse(K, { x0: 724, z0: 503, x1: 732, z1: 509, y: gy, h: 3, wall: 'ma_tin', wallHex: 0xd0c8bc, inTex: 'ma_tin', inHex: 0x8a8278, doors: [['e', 2, 2]], wins: [['n', 3, 2, 1.2, 2.2]],
    roof: 'gable', roofTex: 'ma_tin', rise: 0.8, floorTex: 'ma_concrete', mat: OWM.METAL, found: ['ma_concrete', 0x8e8c80], glass: 'atelier', metal: true,
    leafTex: 'ma_tin', leafHex: 0xb8b0a4, trim: 0x5a5e58, trimTex: 'ma_steel', revTex: 'ma_tin', revHex: 0x7a7268, plinth: false });
  MA_PL.spots.gen = { x0: 724, z0: 503, x1: 732, z1: 509, y: gy };
  K.group('Groupe électrogène', () => {
    maBoxAll(K, 'ma_concrete', 0x8a887c, 725.4, gy, 507.0, 729.0, gy + 0.18, 507.9, ['bottom']);
    maBoxAll(K, 'ma_steel', 0x4a5a48, 725.75, gy + 0.18, 507.1, 727.4, gy + 1.15, 507.8, ['bottom']);
    maBoxAll(K, 'ma_steel', 0x3a3a36, 725.9, gy + 1.15, 507.2, 727.2, gy + 1.36, 507.7, ['bottom']);
    maBoxAll(K, 'ma_steel', 0x2e3a34, 725.45, gy + 0.2, 507.05, 725.75, gy + 1.25, 507.85, ['bottom']);
    maCylR(K, 'ma_steel', 0x6a2a20, 728.15, gy + 0.66, 507.45, 0.42, 0.75, 20, 0, 0, Math.PI / 2);
    maCylR(K, 'ma_rust', 0x2a2420, 727.6, gy + 0.66, 507.45, 0.37, 0.07, 20, 0, 0, Math.PI / 2);
    maPipe(K, [726.6, gy + 1.36, 507.6], [726.6, gy + 2.55, 507.6], 0.07, 0x3a3430);
    maPipe(K, [726.6, gy + 2.55, 507.6], [726.6, gy + 2.55, 509.35], 0.07, 0x3a3430);
    maPipe(K, [726.6, gy + 2.55, 509.35], [726.6, gy + 4.3, 509.35], 0.08, 0x3a3430);
  });
  maLowCells(K, 725.4, 507.0, 729.0, 507.9, gy, 1.4, OWM.METAL);
  maBarrel(K, 729.6, gy, 507.55, 0x5a4a3a);
  // laboratoire sur pilotis
  const LB = maStiltHouse(K, { x0: 758, z0: 504, x1: 769, z1: 511, porch: 'w', doors: [['w', 2, 2]], wins: [['n', 2, 3, 1.0, 2.2], ['n', 7, 3, 1.0, 2.2], ['s', 2, 3, 1.0, 2.2], ['e', 2, 2, 1.0, 2.2]],
    rails: ['n', 's'], stairs: true, wall: 'ma_panel', inTex: 'ma_panel', inHex: 0xc8ccc0, roofHex: 0xb0a898, lift: 1.4, glass: 'atelier', metal: true, trim: 0x8a8e86 });
  const ly = LB.y;
  K.group('Paillasse', () => {
    maBoxAll(K, 'ma_panel', 0xb8bcb0, 760.2, ly, 505.0, 764.8, ly + 0.86, 505.68, ['bottom']);
    maBoxAll(K, 'ma_steel', 0x5a5e58, 760.15, ly + 0.86, 504.98, 764.85, ly + 0.92, 505.72);
    for (let k = 0; k < 7; k++) { const x = 760.6 + k * 0.6 + (Math.random() - 0.5) * 0.2, r = 0.04 + Math.random() * 0.05; maCylR(K, 'ma_glass', [0x8aa070, 0xa09a70, 0x7a9a9a][k % 3], x, ly + 0.92 + 0.12, 505.35 + (Math.random() - 0.5) * 0.2, r, 0.24, 8); }
    maCylR(K, 'ma_steel', 0x2e3230, 763.6, ly + 1.05, 505.35, 0.08, 0.26, 10);                 // microscope
    maBoxAll(K, 'ma_steel', 0x2e3230, 763.48, ly + 0.92, 505.2, 763.72, ly + 0.96, 505.5);
    maBoxAll(K, 'kh_canvas', 0xd8d0b8, 761.6, ly + 0.92, 505.1, 762.1, ly + 0.925, 505.5);      // feuillets
  });
  maLowCells(K, 760.2, 505.0, 764.8, 505.7, ly, 0.95, OWM.METAL);
  maFurnish(K, LB, [['table', 760.8, 509.62, 1.4, 0.7, [[760.8, 508.9, 0]]], ['etagere', 763.4, 509.58, 764.6, 509.98]]);
  K.group('Bocal', () => {
    maCylR(K, 'ma_steel', 0x3a3e3a, 767.4, ly + 0.1, 505.62, 0.38, 0.2, 18);
    maCylR(K, 'ma_glass', 0x6a9a6a, 767.4, ly + 0.95, 505.62, 0.33, 1.5, 18);
    maCylR(K, 'ma_steel', 0x3a3e3a, 767.4, ly + 1.76, 505.62, 0.36, 0.12, 18);
    maGeo(K, 'ma_rust', 0x3a3a2a, new THREE.SphereGeometry(0.2, 10, 8), mtx(767.4, ly + 0.9, 505.62, 0.3, 0.5, 0, 1, 1.4, 0.8));
  });
  maLowCells(K, 767.0, 505.2, 767.8, 506.0, ly, 1.8, OWM.METAL);
  MA_PL.spots.lab = { x0: 758, z0: 504, x1: 769, z1: 511, y: ly };
  // château d'eau, mât radio (lampe rouge clignotante), cuves de fioul
  const wy = maGround(735, 476);
  maWaterTower(K, 735, 476, wy);
  for (const [px, pz] of [[732, 473], [738, 473], [732, 479], [738, 479]]) owSet(OW.surf, Math.floor(px), Math.floor(pz), OWK.SOLID, { base: wy - 1, top: wy + 12, mat: OWM.METAL });
  const my = maGround(772, 489);
  maRadioMast(K, 772, 489, my, 22);
  owSet(OW.surf, 772, 489, OWK.SOLID, { base: my - 1, top: my + 22, mat: OWM.METAL });
  MA_PL.radio = owLamp(K, 772, my + 22.2, 489, 0xff3020, false, 0.6);
  for (const [px, pz] of [[760, 490], [763.5, 490]]) { const y0 = maGround(px, pz); maFuelTank(K, px, pz, y0, 1.4, 4.2, 0x9a7a5e); K.solid(px - 1.4, pz - 2.1, px + 1.4, pz + 2.1, OWK.SOLID, { base: y0, top: y0 + 3.3, mat: OWM.METAL }); }
  maWalk(K, [[748, 484], [748, 458], [735, 458], [735, 452]]);
  maWalk(K, [[732, 506], [738, 506], [738, 482], [748, 482]]);
  maWalk(K, [[755, 507.5], [756, 507.5], [756, 482], [750, 482]]);
  maDock(K, 'C', 735, 452, 'n');
  // ponton ouest, vers l'Enlisée
  maWalk(K, [[738, 498], [722, 498]]);
  maDockFrom(K, 'C-ouest', 722, 498, 'w');
}
/* ------------------------------------------------------------------ D : l'Enlisée */
function maBuildEnlisee(K) {
  // cabane effondrée (toit arraché, une tôle glissée, chevrons tombés, porte cassée)
  const cy = Math.max(maMaxGround(452, 450, 459, 456), MA.water) + 0.4;
  maHouse(K, { x0: 452, z0: 450, x1: 459, z1: 456, y: cy, h: 2.6, wall: 'ma_siding', wallHex: 0x9a9888, inTex: 'ma_planks', inHex: 0xa09080,
    doors: [['s', 2, 3, 2.3, 'broken']], wins: [['n', 2, 2, 0.9, 1.9], ['w', 2, 2, 0.9, 1.9]], roof: 'none', floorTex: 'ma_planks', found: ['ma_planks', 0x5a4c3e], trim: 0x4e4034 });
  maBoxR(K, 'ma_tin', 0xffffff, 455.5, cy + 2.55, 453, 8.2, 0.06, 6.8, 0.22, 0.05, 0.12);          // la tôle glissée
  K.group('Chevrons tombés', () => {
    maBeam(K, 'ma_planks', 0x5a4a3a, [453.15, cy + 2.62, 450.7], [454.4, cy + 0.12, 453.6], 0.1, 0.14);
    maBeam(K, 'ma_planks', 0x5a4a3a, [452.6, cy + 2.62, 451.6], [454.9, cy + 0.6, 452.2], 0.09, 0.13);
    maBeam(K, 'ma_planks', 0x5a4a3a, [455.2, cy + 0.08, 454.1], [457.6, cy + 0.2, 454.6], 0.1, 0.12);
  });
  maTable2(K, 453.9, cy, 451.9, 1.0, 0.65, 0x6a5848); maChair(K, 453.6, cy, 452.85, 0.4, true);
  maLowCells(K, 453.2, 451.4, 454.8, 453.2, cy, 0.8);
  MA_PL.spots.shack = { x0: 452, z0: 450, x1: 459, z1: 456, y: cy };
  maDeck(K, 453, 456, 458, 459, cy, { name: 'Seuil' });
  // péniche échouée : coque d'acier posée de biais sur la berge sud, le pont à 1,6 m
  const bx = 486, bz = 486, rot = 0.35, len = 22, wid = 6.4;
  const by = Math.max(maGround(bx, bz), MA.water - 0.6) + 0.2;
  maBarge(K, bx, bz, by, rot, len, wid);
  MA_PL.spots.barge = { x: bx, z: bz, y: by + 1.55, rot };
  // passerelle de la berge à la péniche
  const gx = bx - Math.cos(rot) * 2 - Math.sin(rot) * (wid / 2 + 2), gz = bz + Math.sin(rot) * 2 - Math.cos(rot) * (wid / 2 + 2);
  maSteps(K, Math.round(gx), Math.round(gz), 1.6, 's', Math.max(maGround(gx, gz), MA.water) + 0.2, by + 1.5);
  maWalk(K, [[455.5, 459], [455.5, 470], [474, 470], [474, 476]]);
  maDock(K, 'D', 470, 498, 's');
  // l'Enlisée est le carrefour : pontons nord (vers les pierres) et est (vers la station)
  maWalk(K, [[474, 470], [474, 430]]);
  maDockFrom(K, 'D-nord', 474, 430, 'n');
  maWalk(K, [[474, 470], [512, 470], [512, 452]]);
  maDockFrom(K, 'D-est', 512, 452, 'e');
  // vieux poteaux télégraphiques penchés (traverse, isolateurs)
  for (let i = 0; i < 4; i++) {
    const px = 430 + i * 14, pz = 470 - i * 6, y0 = maGround(px, pz), rx = rand(-0.25, 0.25), rz = rand(-0.25, 0.25);
    const B = mtx(px, y0 + 3, pz, rx, 0, rz);
    maGeo(K, 'ma_bark', 0x6a5c4e, maCylGeo(0.13, 7, 8, 'ma_bark'), B);
    maGeo(K, 'ma_planks', 0x4e4034, maBoxGeo(1.6, 0.12, 0.1, 'ma_planks'), B.clone().multiply(new THREE.Matrix4().makeTranslation(0, 3.0, 0)));
    for (const ox of [-0.65, -0.25, 0.25, 0.65]) maGeo(K, 'ma_glass', 0x5a8a7a, maCylGeo(0.045, 0.12, 8, 'ma_glass'), B.clone().multiply(new THREE.Matrix4().makeTranslation(ox, 3.12, 0)));
  }
}
/* ------------------------------------------------------------------ E : les pierres */
function maBuildPierres(K) {
  const I = MA.islands[4], cx = I.x, cz = I.z - 2, top = maGround(cx, cz);
  // cercle de neuf pierres levées, une couchée ; pierre d'autel au centre (socle vide)
  K.group('Cercle de pierres', () => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.2, r = 10.5, px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r, y0 = maGround(px, pz);
      const h = 2.6 + ((i * 7) % 5) * 0.35, lean = i === 6 ? 1.35 : ((i * 13) % 7 - 3) * 0.03;
      maGeo(K, 'ma_stone', 0xffffff, maStoneGeo(1.1, h, 0.7, i), mtx(px, y0 + (i === 6 ? 0.5 : h / 2 - 0.3), pz, lean, -a, ((i * 5) % 3 - 1) * 0.05));
      if (i !== 6) owSet(OW.surf, Math.floor(px), Math.floor(pz), OWK.SOLID, { base: y0 - 0.5, top: y0 + h, mat: OWM.STONE });
    }
    maGeo(K, 'ma_stone', 0xd0d0c0, maBoxGeo(2.2, 0.7, 1.2, 'ma_stone'), mtx(cx, top + 0.35, cz - 6.2, 0, 0.1, 0));
  });
  owFill(OW.surf, cx - 1.1, cz - 6.8, cx + 1.1, cz - 5.6, OWK.LOW, { base: top - 0.2, top: top + 0.7, mat: OWM.STONE });
  MA_PL.spots.stones = { x: cx, z: cz, y: top };
  MA_PL.spots.altar = { x: cx, z: cz - 6.2, y: top + 0.7 };       // crochet de quête : pierre d'autel (vide)
  maWalk(K, [[cx, cz + 13], [cx, cz + 28]], 1.8, 0.25);
  maDock(K, 'E', cx, cz + 28, 's');
}

function maBuildPlaces(root) {
  OWL.lamps = [];
  OW.placesRoot = root;
  owItemsBegin();
  MA_PL.docks = {}; MA_PL.spots = {}; MA_PL.lamps = [];
  const K = owKit('marais-lieux');
  const R = mulberry32(1931), rSave = Math.random;
  Math.random = R;                                     // décor reproductible (croix, poteaux)
  maPlaceMaterials();
  try {
    maBuildBourg(K);
    maBuildFutaie(K);
    maBuildStation(K);
    maBuildEnlisee(K);
    maBuildPierres(K);
  } finally { Math.random = rSave; }
  owItemsBuild(K, root);
  maDampen(K);
  const g = K.build(root);
  // le verre ne porte pas d'ombre ; la plaque non plus (une seule face)
  for (const m of g.children) if (m.userData && (m.userData.tex === 'ma_glass' || m.userData.tex === 'ma_sign_pompe')) m.castShadow = false;
  // halos des lampes (lumière ajoutée) : la nappe de brume les éteint au lieu de les teinter (ma14)
  for (const L of OWL.lamps) if (L.halo && L.halo.material) L.halo.material.defines = { HFOG_ADD: '' };
}
/* Le mât radio clignote ; les lanternes des pontons vacillent. */
function maPlacesUpdate(dt) {
  if (MA_PL.radio) { const on = Math.sin(OW.t * 2.4) > 0.6; MA_PL.radio.halo.visible = on; MA_PL.radio.mat.color.setHex(on ? 0xff3020 : 0x301008); }
}
