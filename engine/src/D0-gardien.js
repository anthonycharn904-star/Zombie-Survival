/* --------------------------------------------------------------- Gardien --
   Planche « Ce qui marche dans la poussière » (page 7) : le Gardien à tête de chacal, l'horloge de
   la partie. 3,2 m oreilles comprises ; lent, mais il se déplace en tourbillon de sable. À chaque pic
   de Khamsin, il traverse la carte le long du couloir de tempête et renverse les véhicules sur son
   passage (le camion blindé encaisse un coup) ; invulnérable hors du sanctuaire. Au sanctuaire, boss
   en 3 phases : ses fissures s'allument juste après un coup de sceptre au sol (la fenêtre de tir) ;
   le Sceptre reconstitué (nécropole) double les dégâts pendant ces fenêtres. Sa mort fait tomber la
   tempête pendant 4 minutes : la fenêtre pour décoller.
   Il est dans la liste des zombies (tirs, explosions, couteau le trouvent), avec son propre modèle,
   son pas, ses coups et ses dégâts. */
const KHG = {
  hp: (r) => Math.round(25000 * (1 + 0.15 * Math.max(0, r - 10))),   // PV au sanctuaire selon la manche
  window: 5, chip: 0.1, sceptre: 2,              // fenêtre de tir (s) ; hors fenêtre : 10 % ; Sceptre : ×2
  slam: { r: 7, dmg: 45, min: 12, reach: 2.6 },  // onde du coup de sceptre (au contact, au bord) ; point d'impact devant lui
  swipe: { r: 3.2, dmg: 40, cd: 1.8 },
  speed: [1.6, 2.1, 2.7], slamEvery: [9, 7, 5.5], whirlEvery: 13,
  whirl: { speed: 16, out: 0.5, in: 0.6 },
  cross: { speed: 6.5, whirl: 18, len: 260, back: 110, flip: 5.5 },
  calm: 240,                                     // s de calme après sa mort
  phases: [0.66, 0.33],
  e: null, R: null, mats: null, tornado: null, bar: null, lastCross: 0, dead: false, kills: 0, hintT: 0,
};
const GARDIEN_TYPE = {
  id: 'kh_gardien', num: 'K-05', name: 'Le Gardien à tête de chacal', cls: 'Boss (Khamsin)', tag: 'L’horloge de la partie', model: 'kh_gardien', facts: 'gardien',
  maps: ['khamsin'], dog: true, kh: true, boss: true,
  desc: 'Le gardien du sanctuaire sous la Grande Pyramide. Le sceau brisé l’a réveillé ; la tempête est son souffle.',
  mult: { hp: 1, speed: 1, damage: 1.5 }, headMult: 1.5, ability: 'Tourbillon',
};
SPECIMEN_TYPES.push(GARDIEN_TYPE, KH_PILOTE_TYPE);   // onglets dans l'ordre des numéros : K-05, K-06

/* ---- Matières : corps de basalte fendu (fissures turquoise en émission), or, faïence, lin */
function khGardienMats() {
  if (KHG.mats) return KHG.mats;
  const c = makeCanvas(512, 512), g = c.getContext('2d'), R = mulberry32(3207);
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const bolt = (x, y, a, len, w, depth) => {
    g.strokeStyle = `rgba(95,242,226,${0.55 + 0.45 * R()})`; g.lineWidth = w; g.shadowColor = '#5ff2e2'; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < len; i++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); if (depth < 3 && R() < 0.12) bolt(x, y, a + (R() - 0.5) * 1.6, len / 2, w * 0.6, depth + 1); }
    g.stroke();
  };
  for (let i = 0; i < 16; i++) bolt(R() * 512, R() * 512, R() * TAU, 14 + R() * 18, 2.2 + R() * 1.6, 0);
  const crack = toTex(c);
  share(crack);
  // collier large : rangées d'or, de turquoise et de lapis
  const cc = makeCanvas(256, 64), gc = cc.getContext('2d');
  ['#d4a640', '#2fa89c', '#d4a640', '#2c4f9a', '#d4a640', '#2fa89c', '#d4a640'].forEach((col, i) => { gc.fillStyle = col; gc.fillRect(0, i * 9 + 1, 256, 8); });
  for (let x = 0; x < 256; x += 8) { gc.fillStyle = 'rgba(0,0,0,0.25)'; gc.fillRect(x, 0, 1, 64); }
  const collar = toTex(cc);
  share(collar);
  const std = (o) => linearize(share(new THREE.MeshStandardMaterial(o)));
  KHG.mats = {
    body: std({ color: 0x1b1a1e, roughness: 0.42, metalness: 0.25, emissive: 0xffffff, emissiveMap: crack, emissiveIntensity: 0.12 }),
    gold: std({ color: 0xd4a640, roughness: 0.3, metalness: 0.85, emissive: 0x2a1c06, emissiveIntensity: 1 }),
    faience: std({ color: 0x2fa89c, roughness: 0.32, metalness: 0.1, emissive: 0x0a3430, emissiveIntensity: 1 }),
    linen: std({ color: 0xe6dcc6, roughness: 0.9, side: THREE.DoubleSide }),
    collar: std({ map: collar, roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide }),
    eye: linearize(share(new THREE.MeshBasicMaterial({ color: 0x5ff2e2, fog: false }))),
  };
  return KHG.mats;
}
/* ---- Modèle : un squelette d'objets (bassin, buste, cou, tête ; épaules, coudes, mains ; hanches,
   genoux, pieds) et ses pièces ; le sceptre was dans la main droite. Origine au sol. */
function khGardienModel() {
  const M = khGardienMats();
  const root = new THREE.Group();
  const bone = (p, x, y, z) => { const o = new THREE.Group(); o.position.set(x, y, z); p.add(o); return o; };
  const part = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; p.add(m); return m;
  };
  const cyl = (rt, rb, h, n = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, n, 1, open);
  const R = { root };
  R.body = bone(root, 0, 0, 0);
  R.hips = bone(R.body, 0, 1.45, 0);
  // pagne plissé, ceinture d'or, tablier rayé
  part(R.hips, cyl(0.36, 0.52, 0.64, 18, true), M.linen, 0, -0.27, 0.02);
  part(R.hips, cyl(0.375, 0.375, 0.1, 18), M.gold, 0, 0.04, 0);
  part(R.hips, new THREE.BoxGeometry(0.26, 0.52, 0.04), M.collar, 0, -0.28, 0.43, 0.08, 0, Math.PI / 2);
  R.chest = bone(R.hips, 0, 0.1, 0);
  part(R.chest, cyl(0.47, 0.33, 0.9, 14), M.body, 0, 0.44, 0, 0, 0, 0, 1, 1, 0.7);
  part(R.chest, cyl(0.54, 0.47, 0.3, 24, true), M.collar, 0, 0.8, 0.02, 0.12);
  R.neck = bone(R.chest, 0, 0.92, 0.03);
  part(R.neck, cyl(0.13, 0.16, 0.3, 10), M.body, 0, 0.1, 0);
  R.head = bone(R.neck, 0, 0.27, 0);
  // tête de chacal : crâne, museau effilé, mâchoire, oreilles dressées, némès rayé
  part(R.head, new THREE.SphereGeometry(1, 14, 10), M.body, 0, 0.06, 0, 0, 0, 0, 0.19, 0.2, 0.23);
  part(R.head, cyl(0.055, 0.11, 0.44, 10), M.body, 0, -0.02, 0.3, Math.PI / 2 - 0.12);
  part(R.head, new THREE.SphereGeometry(0.045, 8, 6), M.body, 0, 0.01, 0.52);
  R.jaw = bone(R.head, 0, -0.08, 0.12);
  part(R.jaw, new THREE.BoxGeometry(0.11, 0.045, 0.32), M.body, 0, -0.02, 0.16, -0.06);
  for (const s of [-1, 1]) {
    part(R.head, new THREE.ConeGeometry(0.095, 0.46, 4), M.body, s * 0.11, 0.4, -0.04, -0.06, Math.PI / 4, s * -0.12);
    part(R.head, new THREE.ConeGeometry(0.05, 0.3, 4), M.gold, s * 0.11, 0.38, 0.0, -0.06, Math.PI / 4, s * -0.12);
    part(R.head, new THREE.BoxGeometry(0.15, 0.5, 0.05), M.collar, s * 0.2, -0.22, 0.08, 0.1, 0, s * 0.08);   // pans du némès
    const e = part(R.head, new THREE.SphereGeometry(1, 8, 6), M.eye, s * 0.085, 0.08, 0.17, 0, 0, s * -0.35, 0.035, 0.016, 0.02);
    e.castShadow = false;
  }
  part(R.head, cyl(0.2, 0.22, 0.22, 16, true), M.collar, 0, -0.04, -0.06, -0.25, 0, 0, 1, 1, 1);
  // bras : épaules, coudes, mains ; brassards d'or
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    const sh = R[`sh${k}`] = bone(R.chest, s * 0.5, 0.74, 0);
    part(sh, new THREE.SphereGeometry(0.15, 10, 8), M.body, 0, 0, 0);
    part(sh, cyl(0.12, 0.1, 0.62), M.body, 0, -0.31, 0);
    part(sh, cyl(0.13, 0.13, 0.08), M.gold, 0, -0.14, 0);
    const el = R[`el${k}`] = bone(sh, 0, -0.62, 0);
    part(el, cyl(0.1, 0.08, 0.56), M.body, 0, -0.28, 0);
    part(el, cyl(0.105, 0.1, 0.1), M.gold, 0, -0.46, 0);
    const ha = R[`ha${k}`] = bone(el, 0, -0.56, 0);
    part(ha, new THREE.BoxGeometry(0.1, 0.17, 0.09), M.body, 0, -0.08, 0.01);
  }
  // sceptre was : hampe d'or, tête de chacal stylisée en haut, fourche en bas (tenu à un tiers du haut)
  R.staff = bone(R.haR, 0, -0.1, 0.03);
  part(R.staff, cyl(0.032, 0.032, 2.75, 8), M.gold, 0, -0.4, 0);
  part(R.staff, new THREE.BoxGeometry(0.07, 0.07, 0.24), M.gold, 0, 0.98, 0.09, 0.5);
  part(R.staff, new THREE.ConeGeometry(0.03, 0.12, 4), M.gold, 0, 1.05, -0.02, -0.3);
  for (const s of [-1, 1]) part(R.staff, cyl(0.02, 0.012, 0.22, 6), M.gold, s * 0.05, -1.82, 0, 0, 0, s * 0.3);
  // jambes
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    const hp = R[`hip${k}`] = bone(R.hips, s * 0.18, -0.05, 0);
    part(hp, cyl(0.17, 0.13, 0.72), M.body, 0, -0.36, 0);
    const kn = R[`kn${k}`] = bone(hp, 0, -0.72, 0);
    part(kn, cyl(0.12, 0.085, 0.68), M.body, 0, -0.34, 0);
    part(kn, cyl(0.095, 0.095, 0.07), M.gold, 0, -0.6, 0);
    const ft = R[`ft${k}`] = bone(kn, 0, -0.68, 0);
    part(ft, new THREE.BoxGeometry(0.16, 0.08, 0.34), M.body, 0, -0.04, 0.08);
  }
  // lueur des yeux (perce la poussière)
  R.glow = [];
  for (const s of [-1, 1]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x5ff2e2, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    sp.position.set(s * 0.085, 0.08, 0.2); sp.scale.setScalar(0.22);
    R.head.add(sp); R.glow.push(sp);
  }
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  return R;
}

/* ---- Pose : marche, coup de sceptre, rugissement, tourbillon, chute (temps de l'état st). */
function khGardienPose(R, s, st, ph, opt = {}) {
  const sw = Math.sin(ph), cw = Math.cos(ph);
  const set = (b, x = 0, y = 0, z = 0) => b.rotation.set(x, y, z);
  // repos
  set(R.body); set(R.hips); set(R.chest); set(R.neck, 0.08); set(R.head, -0.06); set(R.jaw);
  for (const k of ['L', 'R']) { set(R[`sh${k}`]); set(R[`el${k}`], -0.25); set(R[`ha${k}`]); set(R[`hip${k}`]); set(R[`kn${k}`]); set(R[`ft${k}`]); }
  R.hips.position.y = 1.45;
  R.root.scale.setScalar(opt.scale || 1);
  const breathe = Math.sin((opt.t || 0) * 1.6) * 0.02;
  R.chest.rotation.x = breathe;
  // bras droit : le sceptre tenu droit, la hampe au sol devant lui
  R.shR.rotation.set(-0.35, 0, -0.12); R.elR.rotation.x = -0.5; R.haR.rotation.x = 0.85;
  R.shL.rotation.set(0.1, 0, 0.18);
  switch (s) {
    case 'walk': case 'cross': {
      const a = opt.stride || 0.42;
      R.hipL.rotation.x = sw * a; R.hipR.rotation.x = -sw * a;
      R.knL.rotation.x = Math.max(0, -cw) * a * 1.4; R.knR.rotation.x = Math.max(0, cw) * a * 1.4;
      R.ftL.rotation.x = -R.hipL.rotation.x * 0.4; R.ftR.rotation.x = -R.hipR.rotation.x * 0.4;
      R.hips.position.y = 1.45 - Math.abs(cw) * 0.05;
      R.hips.rotation.y = sw * 0.08; R.chest.rotation.y = -sw * 0.1;
      R.shL.rotation.x = -sw * a * 0.7; R.shR.rotation.x = -0.35 + sw * 0.12;
      R.body.rotation.x = 0.06;
      break;
    }
    case 'slam': {
      // 0 → 0,6 s : le sceptre monte à deux mains au-dessus de la tête ; 0,6 → 0,78 : il frappe ; puis il se relève
      const up = smooth(clamp(st / 0.6, 0, 1)), down = smooth(clamp((st - 0.6) / 0.18, 0, 1)), back = smooth(clamp((st - 0.95) / 0.55, 0, 1));
      const raise = up * (1 - down);
      const sx = lerp(lerp(-0.35, -2.9, raise), -1.1, down * (1 - back));
      R.shR.rotation.set(sx, 0, lerp(-0.12, 0.25, raise));
      R.shL.rotation.set(lerp(0.1, -2.7, raise) * (1 - back) + lerp(-0.9, 0.1, back) * down, 0, lerp(0.18, -0.3, raise));
      R.elR.rotation.x = lerp(-0.5, -0.2, raise); R.elL.rotation.x = lerp(-0.25, -0.6, raise);
      R.haR.rotation.x = lerp(0.85, 1.6, raise) * (1 - down) + lerp(0.2, 0.85, back) * down;
      R.body.rotation.x = lerp(-0.12 * raise, 0.42, down) * (1 - back);
      R.hipL.rotation.x = -0.5 * down * (1 - back); R.knL.rotation.x = 0.7 * down * (1 - back);
      R.hipR.rotation.x = 0.25 * down * (1 - back);
      R.hips.position.y = 1.45 - 0.22 * down * (1 - back);
      R.jaw.rotation.x = 0.35 * down * (1 - back);
      break;
    }
    case 'swipe': {
      const k = clamp(st / 0.45, 0, 1), r = smooth(clamp((st - 0.45) / 0.45, 0, 1));
      R.shL.rotation.set(-1.4 * (1 - r), 0, lerp(-1.1, 0.4, smooth(k)) * (1 - r));
      R.chest.rotation.y = lerp(0.5, -0.5, smooth(k)) * (1 - r);
      R.jaw.rotation.x = 0.25 * (1 - r);
      break;
    }
    case 'roar': case 'rise': {
      const k = s === 'rise' ? clamp(st / 2.4, 0, 1) : 1, r = s === 'roar' ? Math.sin(clamp(st / 2.2, 0, 1) * Math.PI) : smooth(clamp((st - 1.8) / 0.6, 0, 1));
      R.head.rotation.x = -0.5 * r; R.neck.rotation.x = -0.25 * r; R.jaw.rotation.x = 0.5 * r;
      R.shL.rotation.set(-0.4 * r, 0, 0.18 + 0.9 * r); R.shR.rotation.set(-0.35 - 0.3 * r, 0, -0.12 - 0.6 * r);
      R.body.rotation.x = -0.15 * r;
      if (s === 'rise') { R.body.rotation.x = lerp(0.6, -0.15 * r, k); R.hips.position.y = lerp(0.6, 1.45, smooth(k)); R.knL.rotation.x = R.knR.rotation.x = lerp(1.6, 0, smooth(k)); R.hipL.rotation.x = R.hipR.rotation.x = lerp(-1.2, 0, smooth(k)); }
      break;
    }
    case 'stagger': {
      const k = Math.sin(clamp(st / 0.8, 0, 1) * Math.PI);
      R.body.rotation.x = -0.25 * k; R.head.rotation.x = 0.3 * k; R.shL.rotation.z = 0.18 + 0.5 * k;
      break;
    }
    case 'dying': {
      const k = smooth(clamp(st / 1.6, 0, 1));
      R.hipL.rotation.x = R.hipR.rotation.x = -1.4 * k; R.knL.rotation.x = R.knR.rotation.x = 2.2 * k;
      R.hips.position.y = lerp(1.45, 0.62, k);
      R.body.rotation.x = 0.35 * k; R.head.rotation.x = 0.4 * k;
      R.shL.rotation.set(0.3 * k, 0, 0.18); R.shR.rotation.set(-0.35 + 0.5 * k, 0, -0.12);
      break;
    }
    default: break;
  }
  R.root.updateMatrixWorld(true);
}

/* ---- Entité : un « zombie » de la liste, sans pièces instanciées (son modèle est à part). */
function khGardienSpawn(x, z, mode) {
  if (KHG.e && !KHG.e.removed) khGardienRemove();
  if (!ZR.free.length) { const c = Zombies.list.find((q) => !q.alive); if (c) removeZombie(c); else return null; }
  const slot = ZR.free.pop();
  hideZombieSlot(slot);
  if (!KHG.R) {
    KHG.R = khGardienModel();
    KHG.tornado = khTornado();
  }
  if (KHG.R.root.parent !== scene) { scene.add(KHG.R.root); scene.add(KHG.tornado.group); }
  KHG.R.root.visible = true;
  const layer = mode === 'arena' ? 1 : 0, gy = owGroundAt(layer, x, z);
  const hp = mode === 'arena' ? KHG.hp(G.round) : 1e9;
  const e = {
    id: ++Zombies.seq, slot, type: GARDIEN_TYPE, model: 'kh_gardien', boss: true, alive: true, outside: false, layer, mode,
    hp, maxHp: hp, pos: new THREE.Vector3(x, gy, z), gy, k: owLocate(x, z, gy), yaw: Math.atan2(player.pos.x - x, player.pos.z - z),
    state: 'chase', gstate: mode === 'arena' ? 'rise' : 'cross', st: 0, t: 0, ph: 0, phase: 0, window: 0, slamT: 6, whirlT: KHG.whirlEvery, swipeCd: 0,
    whirlTo: null, whirlFrom: null, whirlD: 0, path: null, crossT: 0, hitT: 0, scale: 1, sunk: mode === 'arena' ? 1 : 0, double: false,
    win: null, gib: 0, headless: false, crawl: false, stagger: 0, flinch: 0, knockX: 0, knockZ: 0, knockT: 0, reelT: 0, called: null,
    look: { skin: 0xffffff, cloth: 0xffffff, eyes: 0xffffff, helmet: false, helmetColor: 0 }, helmetOn: false, dog: true, speedType: 'walk', speed: 1, moving: 0,
    vx: 0, vz: 0, nukeT: 0, losT: 0, los: true, farT: 0, stuck: 0, stuckT: 9, lastX: x, lastZ: z,
  };
  Zombies.list.push(e);
  KHG.e = e;
  khGardienPose(KHG.R, e.gstate, 0, 0, { t: 0 });
  khGardienPlace(e);
  return e;
}
function khGardienRemove() {
  const e = KHG.e;
  if (e && !e.removed) removeZombie(e);
  KHG.e = null;
  if (KHG.R) KHG.R.root.visible = false;
  if (KHG.tornado) KHG.tornado.group.visible = false;
  khBossBar(null);
}
function khGardienPlace(e) {
  const R = KHG.R;
  R.root.position.set(e.pos.x, e.gy - e.sunk * 3.4, e.pos.z);
  R.root.rotation.y = e.yaw;
}

/* ---- Tourbillon de sable (il s'y dissout pour se déplacer) */
function khTornado() {
  const group = new THREE.Group();
  const parts = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.smoke, transparent: true, depthWrite: false, opacity: 0 }));
    setLin(s.material.color, i % 3 ? 0xb48a5a : 0x8a6a48);
    group.add(s);
    parts.push({ s, a: Math.random() * TAU, h: (i / 22) * 4.2, r: 0.4 + (i / 22) * 1.6, sp: 4 + Math.random() * 3 });
  }
  group.visible = false;
  return { group, parts, k: 0 };
}
function khTornadoUpdate(T, x, y, z, k, dt) {
  T.k = k;
  T.group.visible = k > 0.01;
  if (!T.group.visible) return;
  T.group.position.set(x, y, z);
  for (const p of T.parts) {
    p.a += p.sp * dt; p.h += dt * 1.2; if (p.h > 4.4) p.h -= 4.4;
    const r = p.r * (0.6 + p.h / 4.4);
    p.s.position.set(Math.cos(p.a) * r, p.h, Math.sin(p.a) * r);
    p.s.scale.setScalar(0.9 + p.h * 0.35);
    p.s.material.opacity = 0.5 * k * (1 - Math.abs(p.h - 2.2) / 2.6);
    p.s.material.rotation += dt * 2;
  }
}

/* ---- Chaque image */
function khGardienUpdate(e, dt) {
  e.t += dt; e.st += dt;
  if (e.hitT > 0) e.hitT -= dt;
  if (e.swipeCd > 0) e.swipeCd -= dt;
  if (e.window > 0) e.window -= dt;
  if (e.mode === 'cross') khGardienCross(e, dt); else khGardienArena(e, dt);
  if (e.removed || !KHG.R) return;
  // pas lourds, fissures, lueur des yeux
  const M = KHG.mats, lit = e.window > 0 ? 1.6 + 0.6 * Math.sin(e.t * 14) : e.gstate === 'dying' ? 3 : e.gstate === 'roar' || e.gstate === 'rise' ? 0.9 : e.mode === 'cross' ? 0.45 : 0.12;
  M.body.emissiveIntensity = damp(M.body.emissiveIntensity, lit, 10, dt);
  for (const g of KHG.R.glow) g.material.opacity = e.gstate === 'whirl' ? 0 : 0.9;
  khGardienPlace(e);
  KHG.R.root.scale.setScalar(e.scale);
  khBossBar(e);
}
/* Combat au sanctuaire. */
function khGardienArena(e, dt) {
  const p = player, dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1e-3;
  const sameLayer = (p.layer | 0) === 1;
  const ph = e.phase;
  const go = (s) => { e.gstate = s; e.st = 0; };
  switch (e.gstate) {
    case 'rise': {
      e.sunk = Math.max(0, 1 - e.st / 2.4);
      if (e.st < 2.4 && Math.random() < dt * 14) owSandBurst(e.pos.x + rand(-1.5, 1.5), e.pos.z + rand(-1.5, 1.5), e.gy);
      if (e.st >= 2.4) { e.sunk = 0; go('roar'); khGardienSound('roar', e.pos); }
      break;
    }
    case 'roar':
      e.yaw = turnTo(e.yaw, Math.atan2(dx, dz), 2 * dt);
      if (e.st >= 2.2) { go('walk'); if (e.summon) { khGardienSummon(e.summon); e.summon = 0; } }
      break;
    case 'walk': {
      const sp = KHG.speed[ph];
      e.yaw = turnTo(e.yaw, Math.atan2(dx, dz), 1.6 * dt);
      if (sameLayer && d > 2.4) {
        const v = sp * (Math.abs(wrapAngle(Math.atan2(dx, dz) - e.yaw)) < 0.8 ? 1 : 0.4);
        e.pos.x += Math.sin(e.yaw) * v * dt; e.pos.z += Math.cos(e.yaw) * v * dt;
        settleBody(e, 0.7); e.pos.y = e.gy;
        e.ph += dt * v * 2.1;
        e.stepT = (e.stepT || 0) - dt * v;
        if (e.stepT <= 0) { e.stepT = 1.3; khGardienSound('step', e.pos); FX.shake = Math.min(1, FX.shake + Math.max(0, 0.18 - d / 120)); }
      }
      e.slamT -= dt; e.whirlT -= dt;
      if (!sameLayer) break;
      if (d < KHG.swipe.r && e.swipeCd <= 0) { go('swipe'); e.swipeHit = false; break; }
      if (ph >= 1 && e.whirlT <= 0 && d > 5) { khGardienWhirl(e); break; }
      if (e.slamT <= 0 && d < 14) { go('slam'); e.slamHit = false; e.double = ph >= 2; khGardienSound('windup', e.pos); }
      break;
    }
    case 'swipe':
      if (!e.swipeHit && e.st >= 0.45) {
        e.swipeHit = true;
        if (d < KHG.swipe.r + 0.4 && !p.down) { khPlayerHit(KHG.swipe.dmg, dx / d, dz / d, 7); khGardienSound('hit', p.pos); }
      }
      if (e.st >= 0.9) { e.swipeCd = KHG.swipe.cd; go('walk'); }
      break;
    case 'slam':
      e.yaw = e.st < 0.55 ? turnTo(e.yaw, Math.atan2(dx, dz), 2.4 * dt) : e.yaw;
      if (!e.slamHit && e.st >= 0.75) { e.slamHit = true; khGardienSlam(e); }
      if (e.st >= 1.5) {
        if (e.double) { e.double = false; go('slam'); e.slamHit = false; break; }
        e.slamT = KHG.slamEvery[ph] * rand(0.85, 1.15); go('walk');
      }
      break;
    case 'whirl': {
      // dissolution (0,5 s), course du tourbillon, retour (0,6 s), puis coup de sceptre aussitôt
      const W = KHG.whirl;
      if (e.st < W.out) e.scale = 1 - smooth(e.st / W.out);
      else if (e.whirlD > 0) {
        e.scale = 0.001;
        const tx = e.whirlTo.x - e.pos.x, tz = e.whirlTo.z - e.pos.z, dd = Math.hypot(tx, tz);
        const step = Math.min(dd, W.speed * dt);
        if (dd > 0.05) { e.pos.x += (tx / dd) * step; e.pos.z += (tz / dd) * step; settleBody(e, 0.3); }
        if (dd <= 0.3 || e.st > 4) { e.whirlD = 0; e.st = W.out; e.reform = true; }
      } else {
        const k = clamp((e.st - W.out) / W.in, 0, 1);
        e.scale = Math.max(0.001, smooth(k));
        e.yaw = Math.atan2(dx, dz);
        if (k >= 1) { e.scale = 1; e.whirlT = KHG.whirlEvery * rand(0.8, 1.2); go('slam'); e.slamHit = false; e.double = ph >= 2; }
      }
      khTornadoUpdate(KHG.tornado, e.pos.x, e.gy, e.pos.z, e.scale < 1 ? 1 - e.scale * 0.6 : 0, dt);
      if (Math.random() < dt * 8) owSandBurst(e.pos.x, e.pos.z, e.gy);
      break;
    }
    case 'stagger':
      if (e.st >= 0.8) go('walk');
      break;
    case 'dying': {
      if (e.st > 1.6) e.scale = Math.max(0.001, 1 - smooth((e.st - 1.6) / 1.6));
      if (Math.random() < dt * 16) { owSandBurst(e.pos.x + rand(-1, 1), e.pos.z + rand(-1, 1), e.gy); }
      if (e.st >= 3.3) { khGardienRemove(); return; }
      break;
    }
    default: go('walk');
  }
  if (e.gstate !== 'whirl') khTornadoUpdate(KHG.tornado, e.pos.x, e.gy, e.pos.z, 0, dt);
  khGardienPose(KHG.R, e.gstate === 'walk' ? 'walk' : e.gstate === 'whirl' ? 'walk' : e.gstate, e.st, e.ph, { t: e.t, stride: 0.38 });
}
/* Coup de sceptre au sol : onde (dégâts selon la distance, les morts renversés), fissures allumées. */
function khGardienSlam(e) {
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), x = e.pos.x + fx * KHG.slam.reach, z = e.pos.z + fz * KHG.slam.reach, y = e.gy;
  khGardienSound('slam', { x, z });
  FX.shake = Math.min(1.2, FX.shake + 0.9);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; owSandBurst(x + Math.cos(a) * rand(0.5, 2.5), z + Math.sin(a) * rand(0.5, 2.5), y); }
  if (Features.amp && Features.amp.altar) { glasWave(Features.amp, 0, KHG.slam.r, 0.55, 1, x, z, y); glasWave(Features.amp, 0.1, KHG.slam.r * 0.6, 0.45, 0.7, x, z, y); }
  const p = player, d = Math.hypot(p.pos.x - x, p.pos.z - z);
  if (d < KHG.slam.r && !p.down && Math.abs(p.gy - y) < 2.5) {
    const k = 1 - d / KHG.slam.r, dmg = lerp(KHG.slam.min, KHG.slam.dmg, k);
    khPlayerHit(dmg, (p.pos.x - x) / (d || 1), (p.pos.z - z) / (d || 1), 3 + 6 * k);
  }
  glasKnockdown(x, z, KHG.slam.r, 1.6, 0);
  // fenêtre de tir : les fissures s'allument
  e.window = KHG.window;
  if (e.mode === 'arena' && KHG.hintT <= 0) { KHG.hintT = 30; HUD.hint('Ses fissures brillent : tirez maintenant !', 2.5); }
}
/* Il se dissout en tourbillon et file vers un point à 6–9 m du joueur (plutôt dans son dos). */
function khGardienWhirl(e) {
  const p = player;
  let to = null;
  for (let i = 0; i < 16 && !to; i++) {
    const a = p.yaw + rand(-1.2, 1.2), r = rand(6, 9), x = p.pos.x + Math.sin(a) * r, z = p.pos.z + Math.cos(a) * r;
    if (owWalkCell(e.layer, Math.floor(x), Math.floor(z)) && Math.abs(owGroundAt(e.layer, x, z) - e.gy) < 1) to = { x, z };
  }
  if (!to) { e.whirlT = 4; return; }
  e.gstate = 'whirl'; e.st = 0; e.whirlTo = to; e.whirlD = 1;
  khGardienSound('whirl', e.pos);
}
/* Coup reçu par le joueur : dégâts, recul (glisse sur le sol, arrêtée par les murs), secousse. */
function khPlayerHit(dmg, ux, uz, push) {
  if (VEH.drive) { playerDamage(dmg * VEH.drive.T.protect); return; }
  playerDamage(dmg);
  KHG.push = { x: ux * push, z: uz * push, t: 0.3 };
  FX.shake = Math.min(1.2, FX.shake + 0.6);
}
function khPushUpdate(dt) {
  const P = KHG.push;
  if (!P || P.t <= 0 || VEH.drive) return;
  P.t -= dt;
  const k = dt / 0.3;
  player.pos.x += P.x * k; player.pos.z += P.z * k;
  settleBody(player, player.radius);
  player.pos.y = player.gy;
}
/* Les Desséchés sortent des fosses du sanctuaire (changement de phase). */
function khGardienSummon(n) {
  for (let i = 0; i < n; i++) {
    const sp = khPickSpawnUnder();
    if (!sp) continue;
    const z = spawnZombie(sp, khHp(G.round));
    if (z) { z.speedType = 'run'; z.speed = rand(SPEEDS.run[0], SPEEDS.run[1]); }
  }
}

/* ---- Dégâts : seulement au sanctuaire ; pleins pendant les fenêtres de tir, 10 % hors fenêtre. */
function khGardienDamage(e, amount, info) {
  if (!e.alive || e.removed) return false;
  const immune = e.mode !== 'arena' || e.gstate === 'rise' || e.gstate === 'roar' || e.gstate === 'dying' || e.gstate === 'whirl'
    || info.kind === 'nuke' || info.kind === 'glas' || info.kind === 'vehicle';
  if (immune) {
    if (e.mode !== 'arena' && KHG.hintT <= 0 && info.kind !== 'vehicle') { KHG.hintT = 12; HUD.hint('Le Gardien est invulnérable hors du sanctuaire', 2.5); }
    return false;
  }
  let k = e.window > 0 ? 1 : KHG.chip;
  if (e.window > 0 && KHQ.sceptre) k *= KHG.sceptre;
  e.hp -= amount * k;
  if (e.window > 0 && info.kind !== 'nuke') addPoints(RULES.pointsHit);
  e.hitT = 0.12;
  // phases : à 66 % et à 33 %, il rugit et appelle les morts
  const f = e.hp / e.maxHp;
  if (e.phase < KHG.phases.length && f <= KHG.phases[e.phase] && e.hp > 0) {
    e.phase++;
    e.gstate = 'roar'; e.st = 0; e.window = 0; e.summon = e.phase === 1 ? 4 : 6;
    khGardienSound('roar', e.pos);
    HUD.banner(`Le Gardien · phase ${e.phase + 1}`, e.phase === 1 ? 'Il se déplace en tourbillon de sable' : 'Il frappe deux fois de suite', 'warn');
  }
  if (e.hp <= 0) { khGardienDie(e, info); return true; }
  return false;
}
function khGardienDie(e, info) {
  e.hp = 0; e.gstate = 'dying'; e.st = 0; e.window = 0;
  e.alive = false; e.state = 'dead';
  KHG.dead = true; KHG.kills++;
  khGardienSound('die', e.pos);
  FX.shake = Math.min(1.5, FX.shake + 1.2);
  addPoints(5000);
  G.stats.kills++;
  Life.kill(info, GARDIEN_TYPE);
  // la tempête tombe : 4 minutes de calme
  KHS.calmT = KHG.calm;
  if (KHS.on) khStormReset();
  KHS.calmT = KHG.calm;
  HUD.banner('Le Gardien est tombé', 'La tempête tombe : 4 minutes pour décoller de l’aérodrome', 'power');
  if (typeof khQuestOnGardien === 'function') khQuestOnGardien();
  for (const s of KHSAN.statues) for (const m of s.eyes) m.material.color.setHex(0x0c1412);
}
/* Rayon contre le Gardien : tête, buste, bras, jambes (capsules sur ses os). */
const _gha = new THREE.Vector3(), _ghb = new THREE.Vector3();
const KHG_HIT = [
  ['head', 'head', [0, 0.06, 0.05], 'head', [0, 0.0, 0.42], 0.24],
  ['body', 'hips', [0, -0.3, 0], 'neck', [0, 0.05, 0], 0.46],
  ['body', 'shL', [0, 0, 0], 'haL', [0, -0.1, 0], 0.15], ['body', 'shR', [0, 0, 0], 'haR', [0, -0.1, 0], 0.15],
  ['body', 'hipL', [0, 0, 0], 'ftL', [0, 0, 0], 0.18], ['body', 'hipR', [0, 0, 0], 'ftR', [0, 0, 0], 0.18],
];
function khGardienRay(e, ox, oy, oz, dx, dy, dz, extra) {
  _hitHead = false; _hitLeg = false; _hitArm = 0;
  if (!KHG.R || e.removed || e.scale < 0.5 || (e.gstate === 'rise' && e.sunk > 0.6)) return -1;
  let best = -1, head = false;
  for (const [part, ba, a, bb, b, r] of KHG_HIT) {
    _gha.fromArray(a).applyMatrix4(KHG.R[ba].matrixWorld);
    _ghb.fromArray(b).applyMatrix4(KHG.R[bb].matrixWorld);
    const t = raySegment(ox, oy, oz, dx, dy, dz, _gha, _ghb, r * e.scale + extra);
    if (t >= 0 && (best < 0 || t < best)) { best = t; head = part === 'head'; }
  }
  _hitHead = head;
  return best;
}
/* Impact sur le Gardien : éclats de pierre ; turquoise pendant la fenêtre de tir. */
function khGardienSpark(x, y, z, dx, dz) {
  const e = KHG.e, open = e && e.window > 0 && e.mode === 'arena';
  sparkBurst(x, y, z, -dx, 0, -dz, open ? 3 : 5);
  if (open) spawnPuff(x, y, z, 0.35, 0.35, 0x5ff2e2, 0.8, 0.2, true, TEX.glow);
  else if (Math.random() < 0.3) khGardienSound('ping', { x, z });
}

/* ---- Traversée au pic du Khamsin : le long du couloir, il renverse les véhicules */
function khGardienStormTick(dt) {
  if (KHG.hintT > 0) KHG.hintT -= dt;
  khPushUpdate(dt);
  if (KHG.R && (!KHG.e || KHG.e.removed)) { KHG.R.root.visible = false; if (KHG.tornado) KHG.tornado.group.visible = false; }
  if (!KHS.on || KHS_PHASES[KHS.i][0] !== 'khamsin' || KHS.n === KHG.lastCross) return;
  if (KHG.e && !KHG.e.removed) return;                       // il est déjà là (combat au sanctuaire)
  if ((player.layer | 0) === 1 || G.state !== 'playing') return;
  KHG.lastCross = KHS.n;
  const C = KH.corridor, p = player.pos;
  // la ligne qu'il suit : dans le couloir, au plus près du joueur
  const sP = p.x * C.nx + p.z * C.nz, sL = clamp(sP + rand(-5, 5), C.s0 + 40, C.s1 - 40), off = sL - sP;
  const ox = p.x + C.nx * off, oz = p.z + C.nz * off;
  const x0 = ox - C.ax * KHG.cross.back, z0 = oz - C.az * KHG.cross.back;
  const e = khGardienSpawn(x0, z0, 'cross');
  if (!e) return;
  e.path = { x0, z0, s: 0, len: KHG.cross.len };
  e.yaw = Math.atan2(C.ax, C.az);
  e.whirlT = rand(3, 6);
  HUD.hint('Une silhouette immense traverse la poussière…', 3);
  khGardienSound('roar', e.pos);
}
function khGardienCross(e, dt) {
  const C = KH.corridor, P = e.path;
  // fin du Khamsin ou du trajet : il se dissout
  if (!KHS.on || KHS_PHASES[KHS.i][0] !== 'khamsin' || P.s >= P.len) {
    e.scale = Math.max(0.001, e.scale - dt * 1.5);
    khTornadoUpdate(KHG.tornado, e.pos.x, e.gy, e.pos.z, 1 - e.scale, dt);
    if (e.scale <= 0.01) { khGardienRemove(); return; }
    khGardienPose(KHG.R, 'cross', 0, e.ph, { t: e.t });
    return;
  }
  // il marche ; par moments (et à travers les bâtiments), il file en tourbillon
  e.whirlT -= dt;
  const cx = Math.floor(e.pos.x), cz = Math.floor(e.pos.z), blocked = owKind(OW.surf, cx, cz) !== OWK.TERRAIN;
  if (e.whirlT <= 0 && !e.whirling) { e.whirling = 2; e.whirlT = rand(5, 8); khGardienSound('whirl', e.pos); }
  if (e.whirling > 0) e.whirling -= dt;
  const fast = e.whirling > 0 || blocked;
  e.scale = damp(e.scale, fast ? 0.001 : 1, 6, dt);
  const v = fast ? KHG.cross.whirl : KHG.cross.speed;
  P.s += v * dt;
  e.pos.x = P.x0 + C.ax * P.s; e.pos.z = P.z0 + C.az * P.s;
  e.gy = owH(e.pos.x, e.pos.z); e.pos.y = e.gy;
  e.k = owLocate(e.pos.x, e.pos.z, e.gy);
  e.yaw = Math.atan2(C.ax, C.az);
  e.ph += dt * (fast ? 0 : v * 0.9);
  if (!fast) {
    e.stepT = (e.stepT || 0) - dt * v;
    if (e.stepT <= 0) { e.stepT = 2.2; khGardienSound('step', e.pos); }
  }
  khTornadoUpdate(KHG.tornado, e.pos.x, e.gy, e.pos.z, 1 - e.scale * 0.7, dt);
  // véhicules sur son passage : renversés (le camion encaisse le premier coup)
  for (const V of VEH.list) {
    if (V.flipped || V.flipping) continue;
    if (Math.hypot(V.x - e.pos.x, V.z - e.pos.z) < KHG.cross.flip) khFlipVehicle(V, C.ax, C.az);
  }
  // à pied : un revers ; les morts sur son chemin, écartés
  const p = player, d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
  if (!VEH.drive && d < KHG.swipe.r && e.swipeCd <= 0 && !p.down && p.layer === 0) {
    e.swipeCd = 2; khPlayerHit(KHG.swipe.dmg, (p.pos.x - e.pos.x) / (d || 1), (p.pos.z - e.pos.z) / (d || 1), 8); khGardienSound('hit', p.pos);
  }
  for (const z of Zombies.list) {
    if (z === e || !z.alive || z.boss) continue;
    const zd = Math.hypot(z.pos.x - e.pos.x, z.pos.z - e.pos.z);
    if (zd < 2.5) { z.knockX += (z.pos.x - e.pos.x) * 2; z.knockZ += (z.pos.z - e.pos.z) * 2; z.stagger = Math.max(z.stagger, 0.8); }
  }
  khGardienPose(KHG.R, 'cross', 0, e.ph, { t: e.t, stride: 0.5 });
}

function khGardienReset() {
  khGardienRemove();
  KHG.dead = false; KHG.push = null; KHG.hintT = 0; KHG.lastCross = KHS.n || 0;
  if (KHG.mats) KHG.mats.body.emissiveIntensity = 0.12;
}

/* ---- Véhicules renversés (le Gardien) ; remis sur roues en maintenant F 5 s */
function khFlipVehicle(V, ux, uz) {
  if (V.T.ram && !V.dented) {
    V.dented = true; V.v *= 0.2;
    V.x += ux * 1.2; V.z += uz * 1.2;
    if (V === VEH.drive) { FX.shake = Math.min(1.5, FX.shake + 1); HUD.hint('Le camion blindé encaisse le coup', 2.5); }
    khGardienSound('hit', { x: V.x, z: V.z });
    return;
  }
  const [rx, rz] = [-vehFwd(V.yaw)[1], vehFwd(V.yaw)[0]];
  V.flipDir = Math.sign(rx * ux + rz * uz) || 1;
  V.flipping = true; V.flipT = 0; V.v = 0; V.unflipT = 0;
  khGardienSound('hit', { x: V.x, z: V.z });
  if (V === VEH.drive) {
    vehExit(true);
    playerDamage(25);
    FX.shake = Math.min(1.5, FX.shake + 1.2);
    HUD.hint('Le Gardien a renversé le véhicule !', 3);
  }
}
/* Animation du retournement (appelée à chaque image pour chaque véhicule). */
function khVehFlipStep(V, dt) {
  if (V.flipping) {
    V.flipT += dt / 0.9;
    if (V.flipT >= 1) { V.flipT = 1; V.flipping = false; V.flipped = true; owSandBurst(V.x, V.z, V.y); Sound.bodyFall({ x: V.x, z: V.z }); }
  } else if (V.unflipping) {
    V.flipT -= dt / 1.2;
    if (V.flipT <= 0) { V.flipT = 0; V.unflipping = false; V.flipped = false; }
  }
  return V.flipT || 0;
}
/* Pose du véhicule renversé : roulis vers le côté du choc, la caisse reposant sur son toit. */
const _vfq = new THREE.Quaternion(), _vfa = new THREE.Vector3();
function khVehFlipPose(V) {
  const k = V.flipT || 0;
  if (k <= 0) return;
  const r = Math.PI * smooth(k), T = V.T;
  const [fx, fz] = vehFwd(V.yaw), rx = -fz, rz = fx, side = (V.flipDir || 1) * T.wid * 0.5 * Math.sin(r * 0.5);
  V.group.position.x += rx * side; V.group.position.z += rz * side;
  V.group.position.y += T.hgt * (1 - Math.cos(r)) / 2 + Math.sin(r) * T.wid * 0.35;
  _vfa.set(fx, 0, fz);
  _vfq.setFromAxisAngle(_vfa, r * (V.flipDir || 1));
  V.group.quaternion.premultiply(_vfq);
}

/* ---- Sons du Gardien (synthétisés) */
function khGardienSound(kind, pos) {
  const bus = Sound.bus();
  if (!bus) return;
  const ctx = bus.ctx, t0 = ctx.currentTime, d = pos ? Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) : 0;
  const vol = clamp(1.3 - d / (kind === 'roar' ? 160 : 60), 0.04, 1);
  if (vol <= 0.04 && kind !== 'roar') return;
  const out = ctx.createGain(); out.gain.value = vol; out.connect(bus.sortie);
  const tone = (f, dur, type, g0, f1 = f, at = 0) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0 + at); if (f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t0 + at + dur);
    g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(g0, t0 + at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    o.connect(g); g.connect(out); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
  };
  const noise = (dur, f, q, g0, at = 0, type = 'bandpass') => {
    const n = ctx.createBufferSource(), len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), dd = buf.getChannelData(0);
    for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.min(1, (len - i) / (len * 0.6));
    n.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = g0;
    n.connect(fl); fl.connect(g); g.connect(out); n.start(t0 + at);
  };
  switch (kind) {
    case 'step': tone(46, 0.45, 'sine', 0.35, 34); noise(0.3, 120, 0.8, 0.25); break;
    case 'roar': tone(70, 2.2, 'sawtooth', 0.12, 52); tone(105, 2.0, 'square', 0.05, 80); noise(2.2, 340, 0.7, 0.3); noise(1.6, 900, 1.2, 0.08, 0.2); break;
    case 'windup': noise(0.6, 600, 0.8, 0.08, 0, 'highpass'); tone(90, 0.6, 'sine', 0.06, 140); break;
    case 'slam': tone(52, 1.4, 'sine', 0.6, 30); noise(0.9, 160, 0.6, 0.6); noise(0.4, 1800, 0.8, 0.15); tone(330, 1.2, 'sine', 0.05, 320, 0.05); break;
    case 'whirl': noise(2.2, 700, 0.5, 0.25); noise(2.2, 1600, 1.5, 0.1, 0.1); break;
    case 'hit': tone(80, 0.4, 'sine', 0.35, 50); noise(0.25, 500, 0.9, 0.35); break;
    case 'ping': tone(1900 + Math.random() * 400, 0.18, 'triangle', 0.05, 1500); break;
    case 'die': tone(60, 3.4, 'sawtooth', 0.12, 28); noise(3.4, 260, 0.6, 0.35); tone(880, 2.6, 'sine', 0.04, 440, 0.3); break;
    default: break;
  }
}

/* ---- Barre de vie (en haut, sous la boussole) pendant le combat */
function khBossBar(e) {
  const show = !!(e && e.mode === 'arena' && !e.removed && (player.layer | 0) === 1 && G.state === 'playing');
  if (!KHG.bar) {
    if (!show) return;
    const hud = $('hud');
    const b = el('div', 'kh-boss');
    Object.assign(b.style, { position: 'absolute', left: '50%', top: 'calc(64px + env(safe-area-inset-top, 0px))', transform: 'translateX(-50%)', width: 'min(560px, 70vw)', textAlign: 'center', pointerEvents: 'none', textShadow: '0 2px 0 rgba(0,0,0,0.6)' });
    b.innerHTML = '<div style="font-weight:700;font-size:15px;letter-spacing:0.18em;text-transform:uppercase;color:#f5e6cf">Le Gardien à tête de chacal</div>'
      + '<div style="position:relative;height:10px;margin-top:5px;background:rgba(0,0,0,0.6);box-shadow:0 0 0 1px rgba(95,242,226,0.55)"><i style="position:absolute;left:0;top:0;bottom:0;background:#5ff2e2"></i>'
      + '<b style="position:absolute;left:66%;top:-2px;bottom:-2px;width:2px;background:rgba(245,230,207,0.7)"></b><b style="position:absolute;left:33%;top:-2px;bottom:-2px;width:2px;background:rgba(245,230,207,0.7)"></b></div>'
      + '<div class="kh-boss-sub" style="margin-top:4px;font-size:13px;letter-spacing:0.1em;color:#5ff2e2"></div>';
    hud.append(b);
    KHG.bar = { el: b, fill: b.querySelector('i'), sub: b.querySelector('.kh-boss-sub'), last: '' };
  }
  const B = KHG.bar;
  B.el.hidden = !show;
  if (!show) return;
  B.fill.style.width = `${clamp(e.hp / e.maxHp, 0, 1) * 100}%`;
  B.fill.style.background = e.window > 0 ? '#9ffff4' : '#5ff2e2';
  const sub = e.window > 0 ? `Fenêtre de tir${KHQ.sceptre ? ' · Sceptre : dégâts ×2' : ''}` : e.gstate === 'whirl' ? 'Tourbillon' : `Phase ${e.phase + 1} / 3`;
  if (sub !== B.last) { B.sub.textContent = sub; B.last = sub; }
}

/* ---- Écran « Modèles » : le Gardien, avec ses animations ; sa fiche */
SPECIMEN_MODELS.kh_gardien = { anims: ['idle', 'walk', 'slam', 'roar', 'whirl'], dog: true, make: () => makeGardienSpecimen() };
function makeGardienSpecimen() {
  const R = khGardienModel(), T = khTornado();
  const root = new THREE.Group();
  root.add(R.root, T.group);
  const S = { anim: null, t: 0, ph: 0, flinch: 0 };
  return {
    root,
    restyle() {},
    center: () => _specC.set(0, 1.6, 0),
    view: [1.75, 2.95],
    shot() { S.flinch = 0.6; return true; },
    pose(anim, t, dt, yaw) {
      if (S.anim !== anim) { S.anim = anim; S.ph = 0; }
      R.root.rotation.y = yaw; R.root.position.set(0, 0, 0);
      let st = t, s = anim, scale = 1;
      if (anim === 'walk') { S.ph += dt * 1.8 * 2.1; }
      else if (anim === 'slam') st = t % 2.4;
      else if (anim === 'roar') st = t % 3.2;
      else if (anim === 'whirl') { const p = t % 3.6; scale = p < 0.5 ? 1 - smooth(p / 0.5) : p < 2.6 ? 0.001 : smooth(clamp((p - 2.6) / 0.6, 0, 1)); s = 'walk'; }
      else s = 'idle';
      khGardienPose(R, s, st, S.ph, { t, scale: Math.max(0.001, scale) });
      if (S.flinch > 0) { S.flinch = Math.max(0, S.flinch - dt * 1.5); R.body.rotation.x -= S.flinch * 0.15; R.root.updateMatrixWorld(true); }
      khTornadoUpdate(T, 0, 0, 0, anim === 'whirl' ? 1 - scale * 0.6 : 0, dt);
      const lit = anim === 'slam' && st > 0.75 && st < 2.2 ? 1.8 : anim === 'roar' ? 0.9 : 0.15;
      KHG.mats.body.emissiveIntensity = damp(KHG.mats.body.emissiveIntensity, lit, 8, dt);
    },
  };
}
function khGardienSetup() {
  Object.assign(MODEL_ANIMS, { slam: 'Coup de sceptre', roar: 'Rugissement', whirl: 'Tourbillon' });
  SPECIMEN_FACTS.gardien = (type) => {
    const hp = (r) => fmtNum(KHG.hp(r), 0), S = KHG.slam;
    return {
      bars: [['PV', 2], ['Vitesse', KHG.speed[0] / SPEEDS.jog[1]], ['Dégâts', S.dmg / RULES.zombieHit]],
      ref: `Trait clair = zombie standard (×1) : ${fmtNum(zombieHpForRound(1), 0)} PV à la manche 1, trot de ${fmtNum(SPEEDS.jog[0])} à ${fmtNum(SPEEDS.jog[1])} m/s, ${fmtNum(RULES.zombieHit, 0)} dégâts par coup.`,
      cards: [
        [`Capacité · ${type.ability}`, 'Lent, mais il se dissout en tourbillon de sable et reparaît près de vous. À chaque pic de Khamsin, il traverse la carte le long du couloir et renverse les véhicules.'],
        ['Faiblesse', `Ses fissures s’allument juste après un coup de sceptre au sol : ${fmtNum(KHG.window, 0)} s de fenêtre de tir. Le Sceptre reconstitué double alors les dégâts.`],
      ],
      details: [
        ['Apparition', 'Pic du Khamsin · sanctuaire', '', 'Il traverse le couloir de tempête à chaque Khamsin ; l’autel du sanctuaire le réveille pour le combat'],
        ['Points de vie', `${hp(10)} → ${hp(15)} → ${hp(20)}`, '', 'Manches 10, 15 et 20 · invulnérable hors du sanctuaire'],
        ['Fenêtre de tir', `${fmtNum(KHG.window, 0)} s`, '', `Après chaque coup de sceptre ; hors fenêtre, ${fmtNum(KHG.chip * 100, 0)} % des dégâts seulement`],
        ['Coup de sceptre', `${fmtNum(S.dmg, 0)} à ${fmtNum(S.min, 0)} dégâts`, '', `Onde de ${fmtNum(S.r, 0)} m devant lui : vous êtes projeté, les morts sont renversés`],
        ['Revers', `${fmtNum(KHG.swipe.dmg, 0)} dégâts`, '', `À moins de ${fmtNum(KHG.swipe.r, 1)} m`],
        ['Phases', '3', '', 'À 66 % : tourbillons et 4 Desséchés ; à 33 % : doubles coups et 6 Desséchés'],
        ['Véhicules', 'renversés', '', 'Le camion blindé encaisse un coup ; un véhicule renversé se remet sur ses roues en maintenant F 5 s'],
        ['Sa mort', '4 min de calme', '', 'La tempête tombe : la fenêtre pour décoller de l’aérodrome'],
        ['Taille', '3,2 m', '', 'Oreilles comprises'],
      ],
    };
  };
}
