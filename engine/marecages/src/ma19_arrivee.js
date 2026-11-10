/* ================================================================ L'arrivée des Stryges ==
   Kit 2.0.7. Demande d'Anthony (31 octobre 2026) : « je souhaiterais que tu ajoutes une petite animation quand
   les Stryges apparaissent. En effet, vois-tu les effets qui apparaissent quand les chiens apparaissent dans
   Call of Duty Zombie ? J'aimerais pareil, mais pour les Stryges. L'animation doit être animée, avec son propre
   son aussi. » Choisi avec lui : un éclair rouge et des plumes ; elles apparaissent plus près, devant lui de
   préférence (avant : à 28-40 m, à 8-12 m de haut, d'un côté au hasard, souvent hors de vue).

   Chaque Stryge arrive ainsi (maStrygeArrive, appelée par maStrygeSpawn) :
     · l'appel (0,5 s) : au point d'arrivée (18 à 28 m du joueur, trois fois sur quatre dans son champ de vision,
       4 à 6 m de haut, jamais sous un toit), une lueur rouge qui bat, des arcs rouges qui convergent, des plumes
       noires aspirées en spirale ; un souffle qui monte, un cri à l'envers, des crépitements ;
     · l'éclair : rouge sang, de sous les nuages (160 à 280 m) jusqu'au sol en passant par elle ; quatre arcs en
       0,35 s ; le marais s'éclaire en rouge (la lumière des éclairs de l'orage, ma18 : la scène, le ciel, la
       brume, la pluie, l'eau) ; au sol, une brûlure (sur l'eau : une gerbe et des ronds) ;
     · le jaillissement (1 s) : la Stryge sort de l'éclair (de 30 % à sa taille en 0,14 s), ramassée puis les ailes
       grandes ouvertes, la tête renversée, elle hurle ; des arcs rouges courent sur elle ; une gerbe de plumes
       noires encore rougeoyantes part en tous sens puis retombe en tournoyant (5 à 8 s) ; une onde chasse la
       brume au ras du sol ou de l'eau, une autre, rouge, s'élargit autour d'elle ; puis elle part vers le joueur.
   Le son (calculé, maArrSnd) : un souffle qui monte, des crépitements, un cri à l'envers ; le claquement de
   l'éclair, son grondement et l'écho du tonnerre (la réverbération de l'orage) ; la gerbe d'ailes ; le cri de
   la Stryge qui jaillit (maStrygeSnd 'emerge') ; le froissement des plumes.
   Sans dégâts : l'éclair d'une arrivée ne touche personne (comme celui des chiens).
   Tout existe dès le chargement (précompilé : rien ne se compile en partie). Réglages : MA_ARR.
   ============================================================================================ */
const MA_ARR = {
  pre: 0.5, emerge: 1.0,                              // s : l'appel, le jaillissement
  dist: [18, 28], alt: [4, 6], view: 0.75, cone: 0.6, // m du joueur ; m au-dessus du sol ou de l'eau ; part devant lui ; demi-angle (rad)
  gap: [0.55, 1.0],                                   // s entre deux arrivées d'une même nuée (les chiens : 0,3 à 0,75)
  H: [160, 280],                                      // m : hauteur d'où part l'éclair
  col: [1.0, 0.12, 0.15],                             // sa lumière (linéaire)
  flash: { k: 2.8, amb: 0.95, sky: 0.55 },            // lumière de la scène (comme un éclair de l'orage tout proche, en moins fort)
  light: 30,                                          // la lumière au point d'arrivée, au plus fort
  feathers: 80, gather: 26,                           // plumes de la gerbe ; plumes aspirées pendant l'appel
};
const MA_ARRS = { list: [], n: 0, fea: null, rings: [], glows: [], tex: null, ready: false };
const MA_FEA_N = 640;
const _arrV = new THREE.Vector3(), _arrW = new THREE.Vector3();

/* ---------------------------------------------------------------- Où --
   À 18-28 m, à 4-6 m au-dessus du sol ou de l'eau, à ciel ouvert. Trois fois sur quatre dans le champ de vision
   (vue dégagée de préférence) ; sinon du côté d'où vient la nuée. Pas sur une autre arrivée en cours. */
function maArrSpot(dir) {
  const C = MA_ARR, p = player, cam = viewCamera || camera;
  cam.getWorldDirection(_arrV);
  const fa = Math.atan2(_arrV.z, _arrV.x), front = Math.random() < C.view;
  const ex = cam.position.x, ey = cam.position.y, ez = cam.position.z;
  let fallback = null;
  for (let i = 0; i < 24; i++) {
    const inCone = front ? i < 16 : i >= 16;
    const a = inCone ? fa + rand(-C.cone, C.cone) : dir + rand(-0.6, 0.6), d = rand(C.dist[0], C.dist[1]);
    const x = clamp(p.pos.x + Math.cos(a) * d, 60, 940), z = clamp(p.pos.z + Math.sin(a) * d, 60, 940);
    if (maRoofOver(x, z)) continue;
    if (MA_ARRS.list.some((A) => A.t < A.pre + 0.6 && Math.hypot(A.x - x, A.zz - z) < 6)) continue;
    const y = maStrygeFloor(x, z, 2) + rand(C.alt[0], C.alt[1]);
    const seen = owSightClear(ex, ey, ez, x, y, z);
    if (seen || !inCone) return { x, y, z, seen };
    if (!fallback) fallback = { x, y, z, seen: false };
  }
  return fallback;
}

/* ---------------------------------------------------------------- Une arrivée -- */
function maStrygeArrive(z) {
  const x = z.root.x, y = z.root.y, zz = z.root.z;
  const s = maWxSurface(x, zz);
  const A = { z, x, y, zz, t: 0, pre: MA_ARR.pre, hit: false, slot: -1, sslot: -1, tslot: -1, cT: 0, tT: 0, pulses: null, light: 0, glow: null, gy: s ? s[1] : maStrygeFloor(x, zz, 0), surf: s ? s[0] : 2 };
  z.arr = A; z.hidden = true; z.glow = 0;
  A.glow = MA_ARRS.glows.find((g) => !g.on) || null;
  if (A.glow) { A.glow.on = true; A.glow.s.visible = true; A.glow.s.position.set(x, y, zz); A.glow.s.scale.setScalar(0.4); }
  A.sslot = maBoltPut(maArrCrackles(x, y, zz, 1));
  maFeaGather(A, MA_ARR.gather);
  maArrSnd('pre', A);
  MA_ARRS.list.push(A); MA_ARRS.n++;
  return A;
}
/* Les arcs rouges de l'appel : de petits arcs qui convergent vers le point (k : 1 au début, s'élargissent moins
   vers la fin). */
function maArrCrackles(x, y, z, k) {
  const parts = [];
  for (let i = 0, n = 5 + ((Math.random() * 4) | 0); i < n; i++) {
    const a = rand(0, TAU), e = rand(-0.9, 0.9), r = rand(0.7, 1.6) * k, ce = Math.cos(e);
    parts.push([maBoltPath(x + Math.cos(a) * ce * r, y + Math.sin(e) * r, z + Math.sin(a) * ce * r, x + rand(-0.12, 0.12), y + rand(-0.12, 0.12), z + rand(-0.12, 0.12), 0.45, 0.08, 0.8), rand(0.4, 0.8), 0.03, 2]);
  }
  return parts;
}
/* Les arcs sur la Stryge, juste après l'éclair : du corps vers les ailes et les membres. */
function maArrTendrils(z) {
  const parts = [], r = z.rig;
  _arrV.setFromMatrixPosition(r.hips.matrixWorld);
  for (const b of ['wwL', 'wwR', 'elL', 'elR', 'knL', 'knR', 'neck']) {
    if (Math.random() < 0.3) continue;
    _arrW.setFromMatrixPosition(r[b].matrixWorld);
    parts.push([maBoltPath(_arrV.x, _arrV.y, _arrV.z, _arrW.x + rand(-0.2, 0.2), _arrW.y + rand(-0.2, 0.2), _arrW.z + rand(-0.2, 0.2), 0.5, 0.06, 0.8), rand(0.45, 0.9), 0.028, 2]);
  }
  return parts;
}
/* L'éclair : du ciel jusqu'au sol en passant par la Stryge ; des branches dans la partie haute. */
function maArrBolt(A) {
  const V = maOrEye(), H = rand(MA_ARR.H[0], MA_ARR.H[1]), a = rand(0, TAU), off = rand(0.06, 0.25) * H;
  const up = maBoltPath(A.x + Math.cos(a) * off, A.y + H, A.zz + Math.sin(a) * off, A.x, A.y, A.zz, 0.3, 0.35, 0.3, V);
  const dn = maBoltPath(A.x, A.y, A.zz, A.x + rand(-0.5, 0.5), A.gy, A.zz + rand(-0.5, 0.5), 0.38, 0.2, 0.45, V);
  const main = up.concat(dn.slice(3)), parts = [[main, 1, 0.85, 2]], n = up.length / 3;
  for (let i = 0, nb = 4 + ((Math.random() * 4) | 0); i < nb; i++) {
    const k = Math.floor(n * rand(0.05, 0.8)), sx = up[k * 3], sy = up[k * 3 + 1], sz = up[k * 3 + 2], h = sy - A.y;
    const b = rand(0, TAU), l = Math.max(4, h * rand(0.1, 0.35)), dy = l * rand(0.5, 1);
    parts.push([maBoltPath(sx, sy, sz, sx + Math.cos(b) * l * 0.7, sy - dy, sz + Math.sin(b) * l * 0.7, 0.42, 0.5, 0.4, V), rand(0.3, 0.6), 0.55, 2]);
  }
  return parts;
}
/* L'éclair tombe : lumière, la Stryge apparaît, plumes, ondes, sol ou eau, son. */
function maArrStrike(A) {
  const O = MA_OR, z = A.z, x = A.x, y = A.y, zz = A.zz;
  A.hit = true;
  if (A.sslot >= 0) { maBoltFree(A.sslot); A.sslot = -1; }
  // quatre arcs en 0,35 s (le premier le plus fort), un reste de lueur après chacun
  const t1 = rand(0.07, 0.1), t2 = t1 + rand(0.09, 0.13), t3 = t2 + rand(0.1, 0.14);
  A.pulses = [[-0.02, 0.08, 0.004, 0.01], [0, 1, 0.0006, 0.05], [t1, rand(0.65, 0.8), 0.0006, 0.04], [t2, rand(0.45, 0.6), 0.0006, 0.05], [t3, rand(0.25, 0.4), 0.001, 0.08]];
  A.slot = maBoltPut(maArrBolt(A));
  maBoltI(A.slot, 1.3);
  const L = maOrListener(), d = Math.hypot(x - L.x, zz - L.z), F = MA_ARR.flash;
  // la lumière de la scène (l'éclair libère son emplacement à la fin : maFlashUpdate) ; dans une nuée, les éclairs qui
  // se suivent (moins de 1,2 s) éclairent un peu moins (sinon la scène reste rouge)
  const rk = OW.t - (MA_ARRS.lastHit || -9) < 1.2 ? 0.65 : 1;
  MA_ARRS.lastHit = OW.t;
  O.fl.push({ t: 0.003, pulses: A.pulses, dir: new THREE.Vector3(x - L.x, 70, zz - L.z).normalize(), col: new THREE.Color(MA_ARR.col[0], MA_ARR.col[1], MA_ARR.col[2]),
    k: rk * F.k / (1 + (d / 120) ** 2), amb: rk * F.amb / (1 + (d / 400) ** 2), sky: F.sky * rk, slot: A.slot, life: 1.0 });
  // elle sort de l'éclair
  if (z && z.alive && !z.removed) { z.hidden = false; z.glow = 2.6; z.st = 0; }
  if (A.glow) { A.glow.s.scale.setScalar(5.5); }
  // l'éblouissement rouge, les étincelles, la gerbe de plumes, les ondes
  spawnPuff(x, y, zz, 7, 0.22, maOrLin(0xff3040), maFlashsReduits() ? 0.35 : 0.95, 0, true, TEX.flare);   // (effets réduits : ma00)
  for (let i = 0; i < 46; i++) { const a = rand(0, TAU), e = rand(-0.4, 1), sp = rand(2, 8); FX.sparks.emit(x, y, zz, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1, Math.sin(a) * Math.cos(e) * sp, rand(0.3, 0.8), 1, 0.2, 0.16); }
  maFeaBurst(x, y, zz, MA_ARR.feathers);
  maRingStart(x, Math.max(A.gy, MA.water) + 0.12, zz, false, 12, 1.0);
  maRingStart(x, y, zz, true, 5, 0.45);
  // au pied de l'éclair
  const gx = x, gz = zz, gy = A.gy;
  if (A.surf === 0) {
    spawnPuff(gx, MA.water + 0.6, gz, 4, 0.25, maOrLin(0xff4050), maFlashsReduits() ? 0.35 : 0.9, 0, true, TEX.flare);
    maSplash(gx, gz, 1.6, { up: 1.3 }); maRipple(gx, gz, 0.4); maBubbles(gx, gz, 16, 1.4);
    A.later = [[0.14, () => { for (let i = 0; i < 3; i++) spawnPuff(gx + rand(-1.2, 1.2), MA.water + rand(0.4, 1.4), gz + rand(-1.2, 1.2), rand(2, 3.5), rand(2.5, 4), MA_OR_STEAM, 0.4, rand(0.5, 1)); }]];
  } else {
    if (A.surf === 2) { const M = maMudPool(); for (let i = 0; i < 18; i++) M.emit(gx + rand(-0.3, 0.3), gy + 0.05, gz + rand(-0.3, 0.3), rand(-2.5, 2.5), rand(1.5, 4), rand(-2.5, 2.5), rand(0.5, 1)); }
    else for (let i = 0; i < 8; i++) spawnDebris(MAT.crate, rand(0.03, 0.07), rand(0.02, 0.04), rand(0.1, 0.25), gx + rand(-0.3, 0.3), gy + 0.1, gz + rand(-0.3, 0.3), rand(-4, 4), rand(2, 5), rand(-4, 4), 3);
    for (let i = 0; i < 18; i++) { const a = rand(0, TAU), sp = rand(1.5, 5); FX.sparks.emit(gx, gy + 0.1, gz, Math.cos(a) * sp, rand(1, 4), Math.sin(a) * sp, rand(0.2, 0.6), 1, 0.25, 0.18); }
    maStrikeScorch(gx, gy, gz, rand(1.4, 2.2));
    A.later = [[0.14, () => spawnPuff(gx, gy + 0.5, gz, 1.8, 2.2, MA_OR_SMOKE, 0.45, 0.5)]];
  }
  // un peu de fumée sombre autour d'elle, un instant après (au moment de l'éclair, elle ferait une tache sombre)
  A.later.push([0.16, () => { for (let i = 0; i < 3; i++) spawnPuff(x + rand(-0.8, 0.8), y + rand(-0.5, 0.8), zz + rand(-0.8, 0.8), rand(1.6, 2.6), rand(1.4, 2.4), maOrLin(0x2a1e26), 0.42, rand(0.2, 0.5)); }]);
  // la secousse, selon la distance
  if (G.state === 'playing') maSecousse(Math.max(0, 1 - d / 34) * 0.3);
  maArrSnd('strike', A);
  if (z && z.alive) maStrygeSnd('emerge', x, zz);
  maEmit('stryge', { what: 'apparait', id: z ? z.id : -1, x: Math.round(x), z: Math.round(zz) });
}
/* Chaque image (maUpdateView, avant la météo : la lumière d'un éclair est prise dans la même image). */
function maArrUpdate(dt) {
  MA_FLG.dt = Math.min(0.1, dt > 0 ? dt : 1 / 60);            // confort (ma00) : le pas de la garde des flashs
  if (!MA_ARRS.ready) return;
  const L = MA_ARRS.list;
  let LI = 0, LA = null;
  for (let j = L.length - 1; j >= 0; j--) {
    const A = L[j];
    A.t += dt;
    if (!A.hit) {
      // confort (ma00) : la lueur bat lentement (2,4 fois par seconde) au lieu de scintiller à chaque image
      const k = clamp(A.t / A.pre, 0, 1), fl = maBat(0.5, A.t);
      // les arcs qui convergent : ils changent de forme toutes les 50 à 90 ms, de plus en plus serrés
      A.cT -= dt;
      if (A.cT <= 0) { A.cT = rand(0.05, 0.09); maBoltFree(A.sslot); A.sslot = maBoltPut(maArrCrackles(A.x, A.y, A.zz, 1.3 - 0.6 * k)); }
      if (A.sslot >= 0) maBoltI(A.sslot, (0.25 + 0.75 * k) * fl * 0.8);
      if (A.glow) { const g = A.glow; g.s.scale.setScalar(0.8 + 3.2 * k * k + 0.3 * Math.sin(A.t * 15)); g.s.material.opacity = (0.45 + 0.55 * k) * fl; }
      if (Math.random() < dt * (10 + 40 * k)) FX.sparks.emit(A.x + rand(-1, 1), A.y + rand(-1, 1), A.zz + rand(-1, 1), rand(-0.5, 0.5), rand(-0.3, 0.8), rand(-0.5, 0.5), rand(0.15, 0.35), 1, 0.22, 0.16);
      const li = (1.2 + 7 * k * k) * fl;
      if (li > LI) { LI = li; LA = A; }
      if (A.t >= A.pre) maArrStrike(A);
    } else {
      const s = A.t - A.pre, v = maFlashV(A, maPulse(A.pulses, Math.max(s, 0.003)));   // enveloppe : ma00
      // des arcs sur elle (0,45 s)
      if (s < 0.45 && A.z && A.z.alive && !A.z.hidden) {
        A.tT -= dt;
        if (A.tT <= 0) { A.tT = rand(0.04, 0.07); maBoltFree(A.tslot); A.tslot = maBoltPut(maArrTendrils(A.z)); }
        if (A.tslot >= 0) maBoltI(A.tslot, (1 - s / 0.45) * 0.95 * maBat(0.15, A.t));
      } else if (A.tslot >= 0) { maBoltFree(A.tslot); A.tslot = -1; }
      if (A.glow) {
        const g = A.glow, e = Math.exp(-s * 5);
        g.s.material.opacity = Math.min(1, 0.15 + v * 1.2) * e; g.s.scale.setScalar(2.5 + 3 * e);
        if (s > 0.9) { g.on = false; g.s.visible = false; A.glow = null; }
      }
      const li = v * MA_ARR.light;
      if (s < 0.6 && li > LI) { LI = li; LA = A; }
      if (A.later) for (let k = A.later.length - 1; k >= 0; k--) if (s >= A.later[k][0]) { const f = A.later[k][1]; A.later.splice(k, 1); f(); }
      if (s > 1.2 && A.tslot < 0) { if (A.glow) { A.glow.on = false; A.glow.s.visible = false; } L.splice(j, 1); }
    }
  }
  // la lumière au point d'arrivée (celle des explosions du moteur : la plus forte l'emporte)
  const BL = FX.boomLight;
  if (BL && LA && LI > BL.intensity * 0.9) {
    BL.position.set(LA.x, LA.y, LA.zz); BL.color.setRGB(1, 0.16, 0.14); BL.decay = 2;
    BL.intensity = LI * MA_FLG.k * (maFlashsReduits() ? 0.5 : 1); FX.boomT = Math.max(FX.boomT || 0, 0.05);   // confort (ma00)
  }
  maFeaUpdate(dt);
  maRingUpdate(dt);
}
/* Nouvelle partie, autre carte : tout s'éteint. */
function maArrReset() {
  for (const A of MA_ARRS.list) { maBoltFree(A.sslot); maBoltFree(A.tslot); }
  MA_ARRS.list.length = 0; MA_ARRS.n = 0;
  for (const g of MA_ARRS.glows) { g.on = false; g.s.visible = false; }
  for (const R of MA_ARRS.rings) { R.on = false; R.m.visible = false; }
  const F = MA_ARRS.fea;
  if (F) { F.life.fill(0); F.n = 0; F.alive = 0; maFeaWrite(); }
}
/* La taille de la Stryge pendant le jaillissement (maStrygeAnimate) : de 30 % à 112 % en 0,14 s, puis 100 %. */
function maArrScale(A) {
  if (!A || !A.hit) return 1e-4;
  const s = A.t - A.pre;
  if (s < 0.14) { const k = s / 0.14; return 0.3 + 0.82 * (1 - Math.pow(1 - k, 3)); }
  return 1 + 0.12 * Math.max(0, 1 - (s - 0.14) / 0.22);
}

/* ---------------------------------------------------------------- Les plumes --
   Une réserve de points (une plume par point, tournée et vue de biais dans le fragment). Au jaillissement, elles
   partent en tous sens (freinées vite), puis retombent comme des plumes : lentement (0,5 à 1,1 m/s), en se
   balançant et en tournant ; posées (sol, plancher, toit, eau), elles s'effacent. Encore rougeoyantes au départ. */
function maFeatherTex() {
  const S = 64, c = makeCanvas(S, S), g = c.getContext('2d'), R = Math.random;
  g.clearRect(0, 0, S, S);
  const cx = S / 2;
  // la vexille : des barbes en biais, de longueur inégale (effilochée), quelques fentes ; noire, reflets violets
  for (let i = 0; i < 52; i++) {
    const t = i / 51, y = S * 0.93 - t * S * 0.86;
    const w = S * 0.19 * Math.sin(Math.PI * Math.min(1, 0.08 + t * 1.02)) * (t < 0.1 ? 0.4 + 6 * t : 1);
    for (const sd of [-1, 1]) {
      if (t > 0.18 && R() < 0.1) continue;
      const L = w * (0.7 + 0.4 * R()), x1 = cx + sd * L, y1 = y - L * (0.45 + 0.25 * t);
      const sh = 26 + 34 * R() + 30 * (1 - Math.abs(t - 0.5) * 2) * 0.4;
      g.strokeStyle = `rgba(${(sh * 0.85) | 0},${(sh * 0.7) | 0},${(sh * 1.1) | 0},0.95)`;
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + sd * L * 0.5, y - L * 0.05, x1, y1); g.stroke();
    }
  }
  // le rachis, plus clair
  g.strokeStyle = 'rgba(105,96,118,0.95)'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(cx, S * 0.99); g.quadraticCurveTo(cx + 1.5, S * 0.5, cx - 0.5, S * 0.05); g.stroke();
  const t = toTex(c, { clamp: true, srgb: false });
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function maFeaInit(root) {
  if (!MA_ARRS.fea) {
    const N = MA_FEA_N, F = {
      N, n: 0, alive: 0, next: 0,
      pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), age: new Float32Array(N), ang: new Float32Array(N), spin: new Float32Array(N),
      size: new Float32Array(N), emb: new Float32Array(N), flip: new Float32Array(N), flipV: new Float32Array(N), sway: new Float32Array(N), swayF: new Float32Array(N),
      term: new Float32Array(N), mode: new Uint8Array(N), tgt: new Float32Array(N * 3), tEnd: new Float32Array(N), land: new Uint8Array(N), gy: new Float32Array(N), gT: new Float32Array(N),
    };
    const g = new THREE.BufferGeometry();
    F.aPos = new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
    F.aP = new THREE.BufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    F.aQ = new THREE.BufferAttribute(new Float32Array(N * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', F.aPos); g.setAttribute('aP', F.aP); g.setAttribute('aQ', F.aQ);
    g.setDrawRange(0, 0);
    MA_ARRS.tex = MA_ARRS.tex || share(maFeatherTex());
    const U = Object.assign({}, MA_WXU, { uTex: { value: MA_ARRS.tex } });
    const mat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: [
        'attribute vec4 aP; attribute vec2 aQ;',          // angle, taille (m), opacité, rougeoiement ; vue de biais (cos), hasard
        'uniform float uScale, uFog;',
        MA_WX_LIGHT_GLSL,
        'varying vec3 vC; varying vec4 vP; varying float vF;',
        'void main() {',
        '  vP = aP; vF = aQ.x; vC = vec3(0.0);',
        '  if (aP.z <= 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float d = max(0.05, -mv.z);',
        '  gl_PointSize = clamp(aP.y * uScale / d, 1.5, 72.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  vC = maWxLight(position, normalize(position - cameraPosition));',
        '  vP.z *= exp(-uFog * uFog * d * d * 0.6);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uTex; varying vec3 vC; varying vec4 vP; varying float vF;',
        'void main() {',
        '  vec2 p = gl_PointCoord - 0.5; float c = cos(vP.x), s = sin(vP.x);',
        '  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y); p.x /= max(0.2, abs(vF));',
        // la texture d'abord (lecture sans condition), puis les rejets
        '  vec4 t = texture2D(uTex, clamp(p + 0.5, 0.0, 1.0));',
        '  float a = t.a * vP.z;',
        '  if (abs(p.x) > 0.5 || abs(p.y) > 0.5 || a < 0.03) discard;',
        '  vec3 col = t.rgb * (vC * 2.2 + 0.015) + vec3(1.0, 0.12, 0.1) * vP.w * (0.5 + t.r * 2.0);',
        '  gl_FragColor = vec4(col, a);',
        '  #include <encodings_fragment>',
        '}',
      ].join('\n'),
      transparent: true, depthWrite: false, fog: false,
    });
    F.points = new THREE.Points(g, mat);
    F.points.frustumCulled = false; F.points.renderOrder = 9; F.points.name = 'plumes des stryges';
    MA_ARRS.fea = F;
  }
  if (root) root.add(MA_ARRS.fea.points);
}
function maFeaEmit(x, y, z) {
  const F = MA_ARRS.fea, i = F.next;
  F.next = (F.next + 1) % F.N;
  F.pos[i * 3] = x; F.pos[i * 3 + 1] = y; F.pos[i * 3 + 2] = z;
  F.age[i] = 0; F.ang[i] = rand(0, TAU); F.spin[i] = rand(-4, 4); F.size[i] = rand(0.24, 0.42);
  F.flip[i] = rand(0, TAU); F.flipV[i] = rand(-5, 5); F.sway[i] = rand(0.35, 0.8); F.swayF[i] = rand(1.8, 3.6);
  F.term[i] = rand(0.5, 1.1); F.land[i] = 0; F.gT[i] = 0; F.gy[i] = -1e4; F.mode[i] = 0;
  if (i >= F.n) F.n = i + 1;
  return i;
}
/* La gerbe : en tous sens (plutôt à l'horizontale et vers le haut), rougeoyantes. */
function maFeaBurst(x, y, z, n) {
  const F = MA_ARRS.fea;
  if (!F) return;
  for (let k = 0; k < n; k++) {
    const i = maFeaEmit(x + rand(-0.3, 0.3), y + rand(-0.3, 0.3), z + rand(-0.3, 0.3));
    const a = rand(0, TAU), e = rand(-0.5, 0.9), sp = rand(3, 9.5), ce = Math.cos(e);
    F.vel[i * 3] = Math.cos(a) * ce * sp; F.vel[i * 3 + 1] = Math.sin(e) * sp; F.vel[i * 3 + 2] = Math.sin(a) * ce * sp;
    F.life[i] = rand(5, 8); F.emb[i] = rand(0.7, 1.2);
  }
  F.alive = 1;
}
/* L'appel : des plumes sur une coquille de 3 à 5,5 m qui convergent en spirale vers le point, à l'instant de
   l'éclair (elles y disparaissent). */
function maFeaGather(A, n) {
  const F = MA_ARRS.fea;
  if (!F) return;
  for (let k = 0; k < n; k++) {
    const a = rand(0, TAU), e = rand(-0.7, 0.9), r = rand(3, 5.5), ce = Math.cos(e);
    const i = maFeaEmit(A.x + Math.cos(a) * ce * r, A.y + Math.sin(e) * r, A.zz + Math.sin(a) * ce * r);
    F.mode[i] = 1; F.tgt[i * 3] = A.x; F.tgt[i * 3 + 1] = A.y; F.tgt[i * 3 + 2] = A.zz; F.tEnd[i] = A.pre * rand(0.85, 1);
    F.vel[i * 3] = F.vel[i * 3 + 1] = F.vel[i * 3 + 2] = 0;
    F.life[i] = A.pre + 0.05; F.emb[i] = 0.1; F.spin[i] = rand(5, 9) * (Math.random() < 0.5 ? -1 : 1);
  }
  F.alive = 1;
}
function maFeaUpdate(dt) {
  const F = MA_ARRS.fea;
  if (!F || !F.alive || dt <= 0) return;
  let any = 0;
  const wx = typeof MA_WX !== 'undefined' ? MA_WX.wind[0] : 0, wz = typeof MA_WX !== 'undefined' ? MA_WX.wind[1] : 0;
  for (let i = 0; i < F.n; i++) {
    if (F.life[i] <= 0) continue;
    any = 1;
    F.age[i] += dt; F.life[i] -= dt;
    const k3 = i * 3, t = F.age[i];
    if (F.mode[i] === 1) {
      // aspirée : vers le point, en tournant autour, de plus en plus vite
      const left = Math.max(0.03, F.tEnd[i] - t), dx = F.tgt[k3] - F.pos[k3], dy = F.tgt[k3 + 1] - F.pos[k3 + 1], dz = F.tgt[k3 + 2] - F.pos[k3 + 2];
      const r = Math.hypot(dx, dz) || 1, sw = 2.5 * Math.min(1, r / 2);
      F.pos[k3] += (dx / left + (-dz / r) * sw) * dt; F.pos[k3 + 1] += (dy / left) * dt; F.pos[k3 + 2] += (dz / left + (dx / r) * sw) * dt;
      F.emb[i] = Math.min(1.2, F.emb[i] + dt * 2.2);
      F.ang[i] += F.spin[i] * dt; F.flip[i] += 6 * dt;
      if (t >= F.tEnd[i]) F.life[i] = 0;
      continue;
    }
    if (!F.land[i]) {
      // freinées vite (une plume), puis la chute lente, le balancement, la rotation
      const drag = Math.exp(-2.6 * dt);
      F.vel[k3] = (F.vel[k3] - wx * 0.25) * drag + wx * 0.25; F.vel[k3 + 2] = (F.vel[k3 + 2] - wz * 0.25) * drag + wz * 0.25;
      F.vel[k3 + 1] += (-F.term[i] - F.vel[k3 + 1]) * (1 - Math.exp(-2.2 * dt));
      const sw = Math.sin(t * F.swayF[i] + i) * F.sway[i];
      F.pos[k3] += (F.vel[k3] + sw * 0.7) * dt; F.pos[k3 + 1] += F.vel[k3 + 1] * dt * (1 - 0.35 * Math.abs(Math.sin(t * F.swayF[i] + i))); F.pos[k3 + 2] += (F.vel[k3 + 2] + sw * 0.5) * dt;
      F.ang[i] += F.spin[i] * dt * 0.6; F.flip[i] += F.flipV[i] * dt;
      F.gT[i] -= dt;
      if (F.gT[i] <= 0) { F.gT[i] = 0.4; F.gy[i] = maStrygeFloor(F.pos[k3], F.pos[k3 + 2], 0); }
      if (F.pos[k3 + 1] <= F.gy[i] + 0.02) { F.pos[k3 + 1] = F.gy[i] + 0.02; F.land[i] = 1; F.flip[i] = 0.12; F.life[i] = Math.min(F.life[i], rand(1.5, 3)); }
    } else if (F.gy[i] <= MA.water + 0.01) {
      // sur l'eau : elle dérive un peu
      F.pos[k3] += wx * 0.08 * dt; F.pos[k3 + 2] += wz * 0.08 * dt;
    }
    F.emb[i] *= Math.exp(-1.5 * dt);
  }
  F.alive = any;
  maFeaWrite();
}
function maFeaWrite() {
  const F = MA_ARRS.fea;
  if (!F) return;
  const P = F.aPos.array, Q = F.aP.array, R = F.aQ.array;
  let m = 0;
  for (let i = 0; i < F.n; i++) {
    const l = F.life[i];
    if (l <= 0) continue;
    const k3 = i * 3, o = m * 4;
    P[m * 3] = F.pos[k3]; P[m * 3 + 1] = F.pos[k3 + 1]; P[m * 3 + 2] = F.pos[k3 + 2];
    const fade = Math.min(1, F.age[i] / 0.06) * (F.mode[i] === 1 ? 1 : Math.min(1, l / 1));
    Q[o] = F.ang[i]; Q[o + 1] = F.size[i] * (F.mode[i] === 1 ? 1.1 : 1); Q[o + 2] = 0.95 * fade; Q[o + 3] = Math.min(1.2, F.emb[i]);
    R[m * 2] = F.land[i] ? 1 : Math.cos(F.flip[i]); R[m * 2 + 1] = 0;
    m++;
  }
  F.aPos.needsUpdate = true; F.aP.needsUpdate = true; F.aQ.needsUpdate = true;
  F.points.geometry.setDrawRange(0, m);
}

/* ---------------------------------------------------------------- Les ondes --
   Un anneau plat qui s'élargit (front irrégulier, une brume claire derrière) : au ras du sol ou de l'eau, la brume
   chassée ; autour de la Stryge, un anneau rouge (additif). */
function maRingInit(root) {
  if (!MA_ARRS.rings.length) {
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const add = i >= 4;
      const mat = new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 }, uW: { value: 0.08 }, uCol: { value: new THREE.Vector3(1, 1, 1) }, uSeed: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform float uA, uW, uSeed; uniform vec3 uCol; varying vec2 vUv;',
          'void main() {',
          '  vec2 q = vUv * 2.0 - 1.0; float r = length(q), an = atan(q.y, q.x);',
          '  float n = 0.55 + 0.45 * sin(an * 7.0 + uSeed) * sin(an * 3.0 - uSeed * 1.7);',
          '  float w = uW * (0.6 + 0.4 * n), ring = exp(-pow((r - 0.86) / w, 2.0)), inner = smoothstep(0.9, 0.15, r);',
          '  float a = (ring * (0.65 + 0.35 * n) + inner * 0.18) * uA * (1.0 - smoothstep(0.92, 1.0, r));',
          '  if (a < 0.004) discard;',
          '  gl_FragColor = vec4(uCol, a);',
          '  #include <encodings_fragment>',
          '}',
        ].join('\n'),
        transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false; m.renderOrder = 8; m.visible = false; m.name = 'onde (arrivée des stryges)';
      MA_ARRS.rings.push({ m, on: false, add, t: 0, dur: 1, R: 1 });
    }
  }
  if (root) for (const R of MA_ARRS.rings) root.add(R.m);
}
function maRingStart(x, y, z, add, R, dur) {
  const P = MA_ARRS.rings.find((q) => !q.on && q.add === add) || MA_ARRS.rings.filter((q) => q.add === add).sort((a, b) => b.t - a.t)[0];
  if (!P) return;
  P.on = true; P.t = 0; P.dur = dur; P.R = R; P.m.visible = true; P.m.position.set(x, y, z);
  P.m.material.uniforms.uSeed.value = rand(0, 100);
  P.m.scale.setScalar(0.01);
}
function maRingUpdate(dt) {
  const fogC = scene.fog ? scene.fog.color : null;
  for (const P of MA_ARRS.rings) {
    if (!P.on) continue;
    P.t += dt;
    const k = P.t / P.dur;
    if (k >= 1) { P.on = false; P.m.visible = false; continue; }
    const e = 1 - Math.pow(1 - k, 3), U = P.m.material.uniforms;
    P.m.scale.setScalar(Math.max(0.01, P.R * e / 0.86));
    U.uW.value = 0.05 + 0.12 * k;
    if (P.add) { U.uCol.value.set(1, 0.12, 0.12); U.uA.value = 0.9 * (1 - k) * (1 - k); }
    else {
      // la brume chassée : un peu plus claire que le brouillard (qui prend déjà la lueur de l'éclair)
      const c = fogC || _arrV.set(0.1, 0.12, 0.11);
      U.uCol.value.set(Math.min(1, c.r * 3 + 0.06), Math.min(1, c.g * 3 + 0.06), Math.min(1, c.b * 3 + 0.06));
      U.uA.value = 0.8 * (1 - k) * Math.min(1, k * 8);
    }
  }
}

/* ---------------------------------------------------------------- Les lueurs de l'appel -- */
function maGlowInit(root) {
  if (!MA_ARRS.glows.length) {
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(1.8, 0.16, 0.18), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      _linDone.add(mat);
      const s = new THREE.Sprite(mat);
      s.visible = false; s.renderOrder = 9; s.name = 'lueur (arrivée des stryges)';
      MA_ARRS.glows.push({ s, on: false });
    }
  }
  if (root) for (const g of MA_ARRS.glows) root.add(g.s);
}
/* Au chargement du marais (maLoad, avant la précompilation). */
function maArrInit(root) {
  maFeaInit(root); maRingInit(root); maGlowInit(root);
  MA_ARRS.ready = true;
  maArrReset();
}

/* ---------------------------------------------------------------- Le son --
   'pre' (l'appel, 0,5 s) : un souffle qui monte (bruit filtré qui glisse de 260 Hz à 2,4 kHz), des crépitements de
   plus en plus serrés, un cri à l'envers (il monte et enfle), un bourdon grave qui enfle ;
   'strike' : le claquement (très bref, aigu), la déchirure (2,8 kHz → 700 Hz), le coup grave (95 → 42 Hz), le
   grondement (bruit grave qui roule), l'écho du tonnerre (envoyé dans la réverbération de l'orage), la gerbe
   d'ailes (sept battements serrés), le froissement des plumes. Le cri de la Stryge : maStrygeSnd('emerge'). */
/* Un bruit blanc (les aigus du claquement, des crépitements, des plumes ; celui des sons du marais est rose). */
function maArrWhite(ctx) {
  if (MA_ARRS.white && MA_ARRS.white.sampleRate === ctx.sampleRate) return MA_ARRS.white;
  const n = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), R = maWxRand(4242);
  for (let i = 0; i < n; i++) d[i] = R() * 2 - 1;
  return (MA_ARRS.white = b);
}
function maArrSnd(kind, A) {
  try {
    const x = A.x, zz = A.zz;
    if (kind === 'pre') {
      const o = maNoyeOut(x, zz, 1.0, 26, 2); if (!o) return;
      const T = A.pre, w = { ctx: o.ctx, g: o.g, t: o.t, noise: maArrWhite(o.ctx) };
      mnNoise(o, o.t, T + 0.04, 'bandpass', 260, 2400, 1.4, 0.9, T * 0.9);
      mnNoise(o, o.t + 0.05, T, 'lowpass', 180, 900, 0.8, 0.45, T * 0.85);
      for (let i = 0, n = 14; i < n; i++) { const u = Math.sqrt(i / n); mnNoise(w, o.t + u * T * 0.95 + rand(0, 0.02), 0.012, 'highpass', 3200, null, 0.8, 0.05 + 0.2 * u, 0.001); }
      mnVoice(o, o.t + 0.04, T - 0.02, 520, 1350, { att: T * 0.85, lvl: 0.13, am: 34, amD: 0.7, formants: [[2300, 3, 1], [1200, 4, 0.5]], lp: 4200 });
      mnVoice(o, o.t, T + 0.02, 68, 62, { wave: 'sawtooth', att: T * 0.9, lvl: 0.12, formants: [[170, 1.5, 1], [340, 3, 0.4]], lp: 420 });
      return;
    }
    if (kind === 'strike') {
      // (le bruit des sons du marais est un bruit rose : peu d'aigus, d'où des niveaux au-dessus de 1 pour le claquement)
      const o = maNoyeOut(x, zz, 1.25, 30, 4); if (!o) return;
      const t = o.t, w = { ctx: o.ctx, g: o.g, t: o.t, noise: maArrWhite(o.ctx) };
      mnNoise(w, t, 0.06, 'highpass', 1500, null, 0.7, 0.85, 0.001);
      mnNoise(w, t + 0.004, 0.32, 'bandpass', 2800, 700, 0.9, 0.6, 0.002);
      mnTone(o, 'sine', 95, 42, t + 0.008, 0.8, 0.85, 0.004);
      mnTone(o, 'triangle', 190, 70, t + 0.008, 0.35, 0.18, 0.003);
      mnNoise(o, t + 0.03, 1.5, 'lowpass', 520, 90, 0.7, 0.8, 0.03);
      for (const dt of [0.12, 0.31, 0.55]) mnNoise(o, t + dt + rand(0, 0.05), 0.45, 'lowpass', 380, 110, 0.7, 0.32, 0.05);
      // la gerbe d'ailes : sept battements serrés, puis le froissement des plumes
      for (let i = 0; i < 7; i++) { const s = t + 0.05 + i * rand(0.035, 0.06); mnNoise(o, s, 0.09, 'lowpass', 850, 230, 0.8, 0.6 - i * 0.05, 0.008); mnTone(o, 'sine', 82, 46, s, 0.08, 0.16, 0.004); }
      for (let i = 0; i < 16; i++) mnNoise(w, t + 0.25 + rand(0, 1.4), rand(0.03, 0.08), 'highpass', rand(2500, 4500), null, 0.7, rand(0.02, 0.05), 0.004);
      // l'écho du tonnerre : le claquement et le grondement, dans la réverbération de l'orage
      const B = typeof maOrBus === 'function' ? maOrBus() : null;
      if (B && B.verb) {
        const ctx = B.ctx, L = camera.position, d = Math.hypot(x - L.x, zz - L.z), g = ctx.createGain();
        g.gain.value = 0.8 / (1 + d / 40); g.connect(B.verb);
        const e = { ctx, g, t: ctx.currentTime + 0.012, noise: maArrWhite(ctx) }, ep = { ctx, g, t: e.t, noise: o.noise };
        mnNoise(e, e.t, 0.25, 'bandpass', 2000, 600, 0.8, 0.5, 0.002);
        mnNoise(ep, e.t + 0.02, 1.0, 'lowpass', 420, 100, 0.7, 0.8, 0.02);
        setTimeout(() => { try { g.disconnect(); } catch (err) { /* */ } }, 7000);
      }
    }
  } catch (e) { /* son facultatif */ }
}
