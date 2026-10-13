/* ------------------------------------------------- Lune : la horde --
   « Horde · bonds de 3 à 6 m » (planche, page 1) : les morts de la mine, en combinaison, avancent par
   bonds balistiques (1,62 m/s²) : courts et hauts au début, longs et rasants ensuite ; ils sautent
   d'un gradin au suivant (« zombie qui saute de N1, 14 m plus haut »), prennent les propulseurs comme
   le joueur, franchissent le pont et le convoyeur. Visière fêlée : une lueur orange dedans.
     L'Astronaute    combinaison de sortie blanche, sac dorsal, casque à visière dorée fêlée
     Le Mineur       combinaison de travail orange à bandes, casque de chantier et lampe frontale */
const LU_EYE_LIN = new THREE.Color(0xff8a2a).convertSRGBToLinear().getHex();
const LU_TYPES = [
  {
    id: 'lu_astro', num: 'L-01', name: 'L’Astronaute', cls: 'Mort de la mine (Ombre éternelle)', from: 1, model: 'lu_astro', facts: 'lu', maps: ['ombre'], lu: true,
    desc: 'Une équipe de relève de la base Séléné. Les combinaisons ont tenu ; ce qu’il y a dedans, non.',
    sign: 'Combinaison de sortie blanche, sac dorsal, casque à visière dorée fêlée : une lueur orange derrière.',
    mult: { hp: 1, speed: 1, damage: 1 }, headMult: 2, helmet: false, ability: 'Bonds',
  },
  {
    id: 'lu_mineur', num: 'L-02', name: 'Le Mineur', cls: 'Mort de la mine (Ombre éternelle)', from: 1, model: 'lu_mineur', facts: 'lu', maps: ['ombre'], lu: true,
    desc: 'Un foreur du fond. Il travaillait dans le noir, à −80 m ; il en remonte par bonds.',
    sign: 'Combinaison de travail orange à bandes réfléchissantes, casque de chantier, lampe frontale encore allumée.',
    mult: { hp: 1.15, speed: 0.95, damage: 1 }, headMult: 2, helmet: false, ability: 'Bonds',
  },
];
SPECIMEN_TYPES.push(...LU_TYPES);
const luZombieType = () => LU_TYPES[Math.random() < 0.62 ? 0 : 1];
function luLook(look, type) {
  look.eyes = LU_EYE_LIN;
  look.skin = pick([0xffffff, 0xeee8e2, 0xf4f0ea]);
  look.cloth = type && type.id === 'lu_mineur' ? pick([0xffffff, 0xf2ece4, 0xfaf4ea]) : pick([0xffffff, 0xf0eeea, 0xe8e6e0, 0xf6f4ee]);
  look.helmet = false;
  return look;
}
function luSpeedType(r) {
  const x = Math.random();
  if (r < 4) return 'walk';
  if (r < 8) return x < 0.4 ? 'walk' : x < 0.75 ? 'jog' : 'run';
  return x < 0.15 ? 'walk' : x < 0.45 ? 'jog' : 'run';
}
/* Bonds selon l'allure : longueur (m), angle (degrés), temps au sol entre deux bonds (s). Un
   bond de 3 m à 38° dure 1,8 s (1,4 m/s de moyenne) ; 6 m à 16°, 1,4 s (3,9 m/s). */
const LU_HOPS = { walk: [3.0, 38, 0.32], jog: [4.6, 25, 0.24], run: [6.0, 16, 0.16] };

/* ---- Modèles : pièces sur les os du squelette humain */
const ZP_SUIT = [
  { geo: 'torso', bone: 'hips', mat: 'zCloth', tint: 'cloth' },
  { geo: 'head', bone: 'neck', mat: 'zSkin', tint: 'skin', head: true },
  { geo: 'eyes', bone: 'neck', mat: 'khEyes', tint: 'eyes', head: true },
  { geo: 'hat', bone: 'neck', mat: 'zCloth', tint: 'cloth', head: true },
  { geo: 'upper', bone: 'sh', mat: 'zCloth', tint: 'cloth' },
  { geo: 'fore', bone: 'el', mat: 'zCloth', tint: 'cloth' },
  { geo: 'hand', bone: 'el', mat: 'zCloth', tint: 'cloth' },
  { geo: 'thigh', bone: 'hip', mat: 'zCloth', tint: 'cloth' },
  { geo: 'shin', bone: 'kn', mat: 'zCloth', tint: 'cloth', legs: true },
  { geo: 'stump', bone: 'kn', mat: 'zSkin', tint: 'skin', stump: true },
  { geo: 'armStump', bone: 'sh', mat: 'zSkin', tint: 'skin', stump: 'arm' },
];
ZPARTS.lu_astro = ZP_SUIT;
ZPARTS.lu_mineur = ZP_SUIT;
function luSuitModel(model) {
  const k = zKit(), { C, V, box, cyl, ell, tor, cap, seg, on } = k, H = ZRIG.head;
  const merge = (o) => { const out = {}; for (const key in o) out[key] = mergeGeometries(o[key]); return out; };
  const K = { ...zCommonK(C), skin: C(0x6e7468, 1.0), skinD: C(0x3e423a, 1.0) };
  const miner = model === 'lu_mineur';
  const su = miner ? C(0xd8762a) : C(0xe4e2dc), suD = miner ? C(0xa85a1e) : C(0xb8b6b0), ring = C(0x6a6e72), refl = C(0xd8dcd0), grime = C(0x6a6458), blood = K.blood;
  const R = (y) => lerp(0.235, 0.25, clamp((y - 0.06) / 0.42, 0, 1)), sT = (x, y, o = 0) => on(x, R(y), 0.62, o);
  // torse : combinaison épaisse, plastron, sac dorsal (ou bouteille du mineur), tuyaux
  const T = [cyl(0.25, 0.235, 0.44, 0, 0.27, 0, su, 0.62, 0, 0, 0, 14), ell(0.27, 0.1, 0.16, 0, 0.47, 0, su, 0, 0, 0, 14, 8),
    cyl(0.235, 0.24, 0.2, 0, -0.06, 0, su, 0.66, 0, 0, 0, 14), cyl(0.244, 0.244, 0.05, 0, 0.04, 0, ring, 0.66, 0, 0, 0, 16)];
  { const z = sT(0, 0.3).z; T.push(box(0.26, 0.2, 0.05, 0, 0.32, z + 0.02, miner ? C(0x3a3a3c) : C(0xcfcdc8)), box(0.06, 0.04, 0.02, -0.06, 0.36, z + 0.05, C(0x2a8a4a)), box(0.06, 0.04, 0.02, 0.05, 0.36, z + 0.05, C(0xc83a2a))); }
  if (miner) for (const y of [0.16, 0.38]) T.push(cyl(0.252, 0.252, 0.04, 0, y, 0, refl, 0.63, 0, 0, 0, 16));
  if (!miner) { T.push(box(0.46, 0.56, 0.24, 0, 0.3, -0.27, C(0xeceae4)), box(0.4, 0.12, 0.2, 0, 0.62, -0.26, C(0xd6d4ce)), box(0.08, 0.3, 0.02, 0.15, 0.3, -0.4, ring)); }
  else { T.push(cyl(0.11, 0.11, 0.5, 0.1, 0.32, -0.26, C(0x3a6a3a), 1, 0, 0, 0, 12), cyl(0.11, 0.11, 0.5, -0.1, 0.32, -0.26, C(0x3a6a3a), 1, 0, 0, 0, 12)); }
  T.push(seg(V(0.12, 0.45, 0.16), V(0.16, 0.6, -0.12), ring, 0.025, 0, true, 0.025), seg(V(-0.12, 0.45, 0.16), V(-0.16, 0.6, -0.12), ring, 0.025, 0, true, 0.025));
  // déchirures, sang séché, poussière
  for (const [x, y, a, c] of [[0.12, 0.2, 0.04, blood], [-0.1, 0.1, 0.03, grime], [0.06, 0.42, 0.025, blood], [-0.15, 0.32, 0.05, grime]]) { const p = sT(x, y, 0.004); T.push(ell(a, a * 1.2, 0.006, p.x, y, p.z, c, 0, p.ry, 0, 8, 5)); }
  // tête dans le casque, cou ; casque : calotte (sphère) avec visière dorée fêlée (lueur dans les fêlures)
  const head = zHeadCore(k, K);
  const hat = [];
  if (!miner) {
    hat.push(ell(0.19, 0.2, 0.19, 0, H + 0.01, -0.01, C(0xeeece6), 0, 0, 0, 18, 12));
    hat.push(ell(0.165, 0.13, 0.08, 0, H + 0.005, 0.12, C(0x6a4a18), 0, 0, 0, 16, 10));      // visière dorée
    hat.push(tor(0.17, 0.018, 0, H + 0.01, 0.06, ring, 0, 0, 0, 1.12, 1, 0.5), cyl(0.15, 0.17, 0.06, 0, -0.04, 0, ring, 1, 0, 0, 0, 16));
    hat.push(box(0.05, 0.03, 0.04, 0.14, H + 0.12, 0.02, C(0x2a2a2c)), box(0.05, 0.03, 0.04, -0.14, H + 0.12, 0.02, C(0x2a2a2c)));
  } else {
    hat.push(cap(Math.PI * 0.5, 0.155, 0.13, 0.17, 0, H + 0.04, -0.005, C(0xf0c020)), cyl(0.2, 0.2, 0.015, 0, H + 0.04, 0.0, C(0xe0b018), 1, 0, 0, 0, 18));
    hat.push(cyl(0.035, 0.035, 0.04, 0, H + 0.11, 0.155, C(0x3a3a3c), 1, Math.PI / 2, 0, 0, 10));
    hat.push(ell(0.14, 0.1, 0.06, 0, H - 0.01, 0.1, C(0x2a2c2e), 0, 0, 0, 12, 8));           // masque respiratoire
  }
  // yeux (teinte d'instance orange) : fêlures de la visière qui laissent passer la lueur, ou lampe frontale
  const eyes = miner
    ? [ell(0.03, 0.03, 0.012, 0, H + 0.11, 0.176), ell(0.016, 0.01, 0.008, -0.035, H, 0.096), ell(0.016, 0.01, 0.008, 0.035, H, 0.096)]
    : [box(0.006, 0.12, 0.004, 0.02, H + 0.01, 0.201, null, 0, 0, 0.5), box(0.005, 0.09, 0.004, -0.03, H - 0.01, 0.2, null, 0, 0, -0.7), box(0.005, 0.07, 0.004, 0.05, H + 0.04, 0.196, null, 0, 0, 1.3),
      ell(0.022, 0.012, 0.006, -0.04, H, 0.197), ell(0.022, 0.012, 0.006, 0.04, H, 0.197)];
  // bras : épais, rotule d'épaule, gant
  const upper = [ell(0.09, 0.085, 0.09, 0, -0.01, 0, su), cyl(0.078, 0.07, 0.31, 0, -0.155, 0, su), cyl(0.081, 0.081, 0.03, 0, -0.3, 0, ring)];
  const fore = [cyl(0.07, 0.064, 0.24, 0, -0.12, 0, su), cyl(0.07, 0.07, 0.04, 0, -0.245, 0, ring)];
  const hand = [cyl(0.055, 0.05, 0.07, 0, -0.28, 0, miner ? C(0x3a3a3c) : C(0xd8d6d0)), box(0.07, 0.08, 0.04, 0, -0.33, 0.01, miner ? C(0x3a3a3c) : C(0xd0cec8))];
  const thigh = [cyl(0.1, 0.085, 0.44, 0, -0.22, 0, su), ell(0.11, 0.12, 0.1, 0, -0.12, 0, su), cyl(0.088, 0.088, 0.03, 0, -0.42, 0, ring)];
  const shin = [cyl(0.085, 0.078, 0.28, 0, -0.14, 0, su), box(0.13, 0.12, 0.27, 0, -0.38, 0.04, miner ? C(0x2a2a2c) : C(0xd0d0cc)), box(0.135, 0.03, 0.29, 0, -0.44, 0.045, C(0x3a3a3c))];
  if (miner) shin.push(cyl(0.087, 0.087, 0.035, 0, -0.1, 0, refl));
  const G = merge({ torso: T, head, hat, upper, fore, hand, thigh, shin });
  Object.assign(G, zStumps(k, { ...K, flesh: C(0x6a2a1c), fleshD: C(0x2e0d08) }, su, su));
  G.eyes = mergeGeometries(eyes);
  return G;
}
for (const m of ['lu_astro', 'lu_mineur']) Object.defineProperty(ZVGEO, m, { configurable: true, enumerable: true, get() { const g = luSuitModel(m); Object.defineProperty(ZVGEO, m, { value: g, enumerable: true }); return g; } });

/* ---- Apparition : ils sortent du régolithe autour du joueur (16 à 40 m), plutôt derrière lui, jamais
   dans la base ; d'un gradin plus haut (ils sautent) plus volontiers que d'un gradin plus bas. */
function luPickSpawn() {
  const p = player;
  const others = Zombies.list.filter((z) => z.alive && z.state === 'rise');
  // au perchoir : autour du pied de la tour (le régolithe est 85 m plus bas)
  const foot = luOnTower() ? luLadderFoot() : null, tower = !!foot, cx0 = tower ? foot.x : p.pos.x, cz0 = tower ? foot.z : p.pos.z, ref = tower ? foot.y : p.gy;
  for (let tries = 0; tries < 40; tries++) {
    const behind = Math.random() < 0.6;
    const a = p.yaw + Math.PI + (behind ? rand(-1.6, 1.6) : rand(-Math.PI, Math.PI));
    const d = tower ? rand(18, 55) : rand(16, 40);
    const x = cx0 - Math.sin(a) * d, z = cz0 - Math.cos(a) * d;
    const cx = Math.floor(x), cz = Math.floor(z);
    if (owKind(OW.surf, cx, cz) !== OWK.TERRAIN || !owWalkCell(0, cx, cz)) continue;
    if (Number.isFinite(luDeckY(x, z))) continue;
    if (luInsideAt(x, owH(x, z) + 1, z)) continue;
    const g = owGroundAt(0, x, z), dh = g - ref;
    if (dh < -10 || dh > 30) continue;
    if (others.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 3)) continue;
    const near = khNearestLoc(x, z);
    return { riser: true, x, z, li: 0, k: owK(0, cx, cz), zone: OW.locs.indexOf(near.loc), layer: 0, y: g };
  }
  return null;
}

/* ---- Poursuite par bonds */
const _luFd = { x: 0, z: 0, link: null };
function luChase(z, dt) {
  const px = player.pos.x, pz = player.pos.z;
  const dx = px - z.pos.x, dz = pz - z.pos.z, d = Math.hypot(dx, dz) || 1e-3;
  const sameFloor = Math.abs(player.gy - z.gy) < 1.2;
  if (z.luY === undefined) { z.luY = 0; z.luAir = false; z.luVy = 0; z.hopCd = rand(0.1, 0.6); z.luHop = 0; }
  if (z.luClimb) { luClimbUpdate(z, dt); return; }
  // en l'air : parabole ; le terrain et les tabliers le reçoivent (luSettle)
  if (z.luAir) {
    const x0 = z.pos.x, z0 = z.pos.z;
    z.luVy -= LU.g * dt;
    z.luY += z.luVy * dt;
    z.pos.x += z.vx * dt; z.pos.z += z.vz * dt;
    settleBody(z, 0.28);
    const mv = Math.hypot(z.pos.x - x0, z.pos.z - z0), want = Math.hypot(z.vx, z.vz) * dt;
    if (want > 1e-4 && mv < want * 0.4) { z.vx *= 0.2; z.vz *= 0.2; }      // contre un mur : il retombe
    z.pos.y = z.gy + Math.max(0, z.luY);
    z.moving = 0; z.luHop = 1;
    if (!z.luAir) { z.luLand = 0.28; z.hopCd = (LU_HOPS[z.speedType] || LU_HOPS.walk)[2] + rand(0, 0.12); }
    z.yaw = turnTo(z.yaw, Math.atan2(z.vx || dx, z.vz || dz), 3 * dt);
    return;
  }
  z.luHop = 0;
  if (z.luLand > 0) z.luLand -= dt;
  // sur une paroi trop raide : il glisse vers le bas (comme le joueur), sans bondir
  if (z.luSlide) {
    owNormal(z.pos.x, z.pos.z, _luSn);
    const h = Math.hypot(_luSn.x, _luSn.z) || 1;
    z.vx = damp(z.vx, (_luSn.x / h) * 3, 4, dt); z.vz = damp(z.vz, (_luSn.z / h) * 3, 4, dt);
    z.pos.x += z.vx * dt; z.pos.z += z.vz * dt;
    settleBody(z, 0.28);
    z.pos.y = z.gy + Math.max(0, z.luY);
    z.moving = 0; z.hopCd = Math.max(z.hopCd, 0.2);
    return;
  }
  // vue directe, sinon le champ de flux (liens : sauts, propulseurs)
  z.losT -= dt;
  if (z.losT <= 0) { z.losT = rand(0.2, 0.35); z.los = d < 16 && sameFloor && losClear(z.k, z.pos.x, z.pos.z, px, pz, 0.28); }
  let mx, mz, link = null;
  if (z.los) { mx = dx / d; mz = dz / d; }
  else { flowDir(z.k, z.pos.x, z.pos.z, _luFd); mx = _luFd.x; mz = _luFd.z; link = _luFd.link; }
  // propulseur sous les pieds : il part comme le joueur
  const pad = z.padCd > 0 ? null : luPadAt(z.pos.x, z.pos.z, z.gy);
  if (z.padCd > 0) z.padCd -= dt;
  if (pad && LUP.on) {
    z.luAir = true; z.luVy = pad.vy; z.vx = pad.vx; z.vz = pad.vz; z.luY = 0.02; z.padCd = 2; luPadFx(pad);
    return;
  }
  // près du joueur (même sol) : il marche et frappe
  if (d < 2.4 && sameFloor && !link) {
    const sp = z.crawl ? z.crawlSpeed : 1.1 * (z.stagger > 0 ? 0.3 : 1);
    z.vx = damp(z.vx, mx * sp, 6, dt); z.vz = damp(z.vz, mz * sp, 6, dt);
    z.pos.x += z.vx * dt; z.pos.z += z.vz * dt;
    const pdx = z.pos.x - px, pdz = z.pos.z - pz, pd = Math.hypot(pdx, pdz);
    if (pd < 0.62 && pd > 1e-4) { z.pos.x = px + (pdx / pd) * 0.62; z.pos.z = pz + (pdz / pd) * 0.62; }
    settleBody(z, 0.28);
    z.pos.y = z.gy + Math.max(0, z.luY);
    z.moving = Math.hypot(z.vx, z.vz);
    z.yaw = turnTo(z.yaw, Math.atan2(dx, dz), 8 * dt);
    if (d < (z.crawl ? 1.05 : 1.25) && !player.down && z.stagger <= 0 && !z.luAir) {
      z.state = 'attack'; z.t = 0; z.attackHit = false; z.winAttack = false;
      if (Math.random() < 0.6) Sound.zombie(z.pos, 'attack');
    }
  } else {
    // au sol entre deux bonds : il se ramasse, se tourne, repart
    z.vx = damp(z.vx, 0, 10, dt); z.vz = damp(z.vz, 0, 10, dt);
    z.moving = 0;
    const want = link ? Math.atan2(link.bx + 0.5 - z.pos.x, link.bz + 0.5 - z.pos.z) : Math.atan2(mx, mz);
    z.yaw = turnTo(z.yaw, want, 6 * dt);
    z.hopCd -= dt;
    // au pied de l'échelle de la tour, le joueur au perchoir : il grimpe
    if (LUPL.ladder && !z.crawl && luOnTower() && !owNodeHidden(LUPL.nodes && LUPL.nodes.ladder) && (() => { const F = luLadderFoot(); return Math.hypot(z.pos.x - F.x, z.pos.z - F.z) < 1.8; })()
      && !Zombies.list.some((o) => o !== z && o.alive && o.luClimb && o.luClimb.dir > 0 && o.luClimb.s < 2.4)) { z.luClimb = { s: 0, dir: 1, m: 0 }; return; }
    if (z.hopCd <= 0 && z.stagger <= 0 && !player.down && !z.crawl) {
      // sans le joueur en vue ni lien à prendre : on vise la case la plus lointaine du chemin qu'on
      // voit en ligne droite (un bond le long du flux couperait le coin des murs)
      let aim = null;
      if (!z.los && !link && luFlowAim(z, (LU_HOPS[z.speedType] || LU_HOPS.walk)[0] * 1.12, _luAim)) { const ax = _luAim.x - z.pos.x, az = _luAim.z - z.pos.z, ad = Math.hypot(ax, az); if (ad > 0.3) { mx = ax / ad; mz = az / ad; aim = ad; } }
      luHopStart(z, mx, mz, link, aim !== null ? Math.max(aim, 1.2) + 0.8 : d);
    }
    else if (z.crawl) { z.pos.x += mx * z.crawlSpeed * dt; z.pos.z += mz * z.crawlSpeed * dt; z.moving = z.crawlSpeed; }
    settleBody(z, 0.28);
    z.pos.y = z.gy + Math.max(0, z.luY);
  }
  // recyclage des traînards et des bloqués
  z.farT = flowAt(z.k) > 60 && !z.los ? z.farT + dt : 0;
  z.stuckT -= dt;
  if (z.stuckT <= 0) {
    z.stuckT = 5;
    const moved = Math.hypot(z.pos.x - z.lastX, z.pos.z - z.lastZ);
    z.stuck = moved < 0.4 && d > 4 ? z.stuck + 1 : 0;
    z.lastX = z.pos.x; z.lastZ = z.pos.z;
  }
  if (z.farT > 14 || z.stuck >= 3) recycleZombie(z);
}
const _luSn = { x: 0, y: 1, z: 0 }, _luAim = { x: 0, z: 0 };
/* Visée d'un bond : la descente du champ de flux, case après case, tant que la case se voit en ligne
   droite depuis le mort (sol praticable, même couche, rien à escalader) et qu'elle est à portée. */
function luFlowAim(z, maxL, out) {
  const N = LUNAV.N, NN = N * N;
  if (!LUNAV.flow || z.k < 0) return false;
  const lay = owKl(z.k) ? 1 : 0;
  let ci = owKx(z.k) - LUNAV.x0, cj = owKz(z.k) - LUNAV.z0;
  if (ci < 0 || cj < 0 || ci >= N || cj >= N) return false;
  let f = LUNAV.flow[lay * NN + cj * N + ci], found = false;
  if (!(f < 1e8)) return false;
  for (let s = 0; s < 12 && f > 0; s++) {
    let best = f, bi = -1, bj = -1, bl = 0;
    for (let q = 0; q < 8; q++) {
      const ni = ci + DIRS8[q][0], nj = cj + DIRS8[q][1];
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      for (let L2 = 0; L2 < 2; L2++) { const v = LUNAV.flow[L2 * NN + nj * N + ni]; if (v < best - 1e-4) { best = v; bi = ni; bj = nj; bl = L2; } }
    }
    if (bi < 0 || bl !== lay) break;
    ci = bi; cj = bj; f = best;
    const x = LUNAV.x0 + ci + 0.5, zz = LUNAV.z0 + cj + 0.5;
    if (Math.hypot(x - z.pos.x, zz - z.pos.z) > maxL || !luHopClear(z, lay, x, zz)) break;
    out.x = x; out.z = zz; found = true;
  }
  return found;
}
/* Ligne droite praticable d'un mort jusqu'à (x, z) : chaque case du trajet (pas de 0,4 m) est
   praticable sur sa couche dans la grille du champ de flux (garde-corps, tabliers, parois compris). */
function luHopClear(z, lay, x, zz) {
  const N = LUNAV.N, NN = N * N, W = LUNAV.walk, G = LUNAV.g;
  const at = (cx, cz) => { const i = cx - LUNAV.x0, j = cz - LUNAV.z0; return i < 0 || j < 0 || i >= N || j >= N ? -1 : lay * NN + j * N + i; };
  const dx = x - z.pos.x, dz = zz - z.pos.z, L = Math.hypot(dx, dz), n = Math.ceil(L / 0.4);
  let pcx = Math.floor(z.pos.x), pcz = Math.floor(z.pos.z);
  for (let i = 1; i <= n; i++) {
    const cx = Math.floor(z.pos.x + (dx * i) / n), cz = Math.floor(z.pos.z + (dz * i) / n);
    if (cx === pcx && cz === pcz) continue;
    const q = at(cx, cz);
    if (q < 0 || !W[q] || G[q] - z.gy > 0.7) return false;
    // en diagonale, pas entre deux coins de mur
    if (cx !== pcx && cz !== pcz) { const a = at(cx, pcz), b = at(pcx, cz); if (a < 0 || b < 0 || !W[a] || !W[b]) return false; }
    pcx = cx; pcz = cz;
  }
  return true;
}
/* Un bond : vers le joueur (pas plus loin que lui), ou le saut d'un lien (bord d'un gradin : on vise
   l'arrivée ; la hauteur gagnée au départ est faible, la chute fait le reste). */
function luHopStart(z, mx, mz, link, d) {
  const H = LU_HOPS[z.speedType] || LU_HOPS.walk, g = LU.g;
  if (link && link.kind === 'drop') {
    const tx = link.bx + 0.5 - z.pos.x, tz = link.bz + 0.5 - z.pos.z, L = Math.hypot(tx, tz) || 1;
    const vy = 1.4, drop = Math.max(0, z.gy - owGroundAt(0, link.bx + 0.5, link.bz + 0.5));
    const t = (vy + Math.sqrt(vy * vy + 2 * g * drop)) / g, vh = L / t;
    z.vx = (tx / L) * vh; z.vz = (tz / L) * vh; z.luVy = vy;
  } else {
    const L = Math.min(H[0] * rand(0.85, 1.12), Math.max(1.2, d - 0.8)), a = luDeg(H[1]);
    const v = Math.sqrt((L * g) / Math.sin(2 * a)) * (z.type ? z.type.mult.speed : 1);
    z.vx = mx * v * Math.cos(a); z.vz = mz * v * Math.cos(a); z.luVy = v * Math.sin(a);
  }
  z.luAir = true; z.luY = 0.02;
  if (Math.random() < 0.15) Sound.zombie(z.pos, 'groan');
}
/* Échelle de la tour : 3 m/s (on grimpe vite à 1,62 m/s²) ; en haut, il passe le garde-corps (0,8 s).
   Si le joueur quitte le perchoir, il redescend. */
function luClimbUpdate(z, dt) {
  const La = LUPL.ladder, C = z.luClimb, L = Math.hypot(La.y1 - La.y0, La.z1 - La.z0), N = LUPL.nodes && LUPL.nodes.ladder;
  if (!luOnTower() && C.m === 0) C.dir = -1;
  // jeu 2.0.3 : positions prises sur l'échelle d'origine, puis à la pose de l'échelle
  const at = (x, y, zz) => { const p = owPt(N, x, y, zz); z.pos.set(p.x, p.y, p.z); };
  if (C.m > 0) {
    // par-dessus le garde-corps, sur la plate-forme
    C.m += dt / 0.8;
    const k = smooth(clamp(C.m, 0, 1));
    at(La.x, lerp(La.y1, La.top, k) + Math.sin(k * Math.PI) * 0.9, lerp(La.z1 - 0.4, La.cz, k));
    if (C.m >= 1) {
      z.luClimb = null; z.gy = z.pos.y; z.luY = 0; z.luAir = false; z.luVy = 0; z.layer = 0; z.k = -1;
      settleBody(z, 0.28); z.pos.y = z.gy; z.hopCd = 0.3; z.lastX = z.pos.x; z.lastZ = z.pos.z; z.stuck = 0;
    }
  } else {
    C.s = clamp(C.s + C.dir * 3 * dt, 0, L);
    const k = C.s / L;
    at(La.x, lerp(La.y0, La.y1, k), lerp(La.z0, La.z1, k) - 0.42);
    if (C.dir > 0 && C.s >= L) C.m = 1e-3;
    if (C.dir < 0 && C.s <= 0) { z.luClimb = null; at(La.fx, La.y0, La.fz); z.gy = z.pos.y; z.k = -1; settleBody(z, 0.28); z.pos.y = z.gy; z.hopCd = 0.5; }
  }
  z.yaw = owYaw(N); z.moving = 0; z.vx = 0; z.vz = 0; z.farT = 0; z.stuckT = 5;
  if (z.luClimb) z.gy = z.pos.y;
}
/* Pose : ramassé au départ et à la réception, jambes repliées et bras en avant en l'air. */
function luHopPose(z, P) {
  if (!GRAV.moon || !z.alive) return;
  if (z.luClimb) {
    // à l'échelle : bras levés en alternance, genoux qui montent
    const c = Math.sin((z.luClimb.s || 0) * 2.2);
    P.sLX -= 2.3 + 0.35 * c; P.sRX -= 2.3 - 0.35 * c; P.hLX -= 0.6 + 0.4 * c; P.hRX -= 0.6 - 0.4 * c; P.kL += 0.9 + 0.5 * c; P.kR += 0.9 - 0.5 * c; P.nRX -= 0.4;
    return;
  }
  if (z.luAir) {
    const up = clamp(z.luVy / 3, -1, 1);
    P.hLX -= 0.75 - 0.25 * up; P.hRX -= 0.55 - 0.25 * up; P.kL += 1.15; P.kR += 0.95;
    P.sLX -= 1.0 + 0.3 * up; P.sRX -= 0.85 + 0.3 * up; P.sLZ += 0.25; P.sRZ -= 0.25;
    P.tRX += 0.22; P.nRX -= 0.15;
  } else {
    const c = Math.max(z.luLand > 0 ? z.luLand / 0.28 : 0, z.hopCd < 0.12 ? 1 - z.hopCd / 0.12 : 0);
    if (c > 0) { P.py -= 0.22 * c; P.kL += 1.25 * c; P.kR += 1.25 * c; P.hLX -= 0.7 * c; P.hRX -= 0.7 * c; P.tRX += 0.45 * c; P.sLX += 0.35 * c; P.sRX += 0.35 * c; }
  }
}

/* ---- Écran « Modèles » : fiches des morts de la mine */
function luSpecimenSetup() {
  SPECIMEN_FACTS.lu = (type) => {
    const hit = RULES.zombieHit * type.mult.damage, mh = type.mult.hp, hp = (r) => fmtNum(khHp(r) * mh, 0);
    const hop = (k) => { const [L, deg] = LU_HOPS[k], a = luDeg(deg), v = Math.sqrt((L * LU.g) / Math.sin(2 * a)); return [L, (2 * v * Math.sin(a)) / LU.g]; };
    const [Lw, tw] = hop('walk'), [Lr, tr] = hop('run');
    const details = [
      ['Apparaît', 'Ombre éternelle', '', 'Partout dehors ; ils sortent du régolithe autour de vous, jamais dans la base pressurisée'],
      ['Points de vie', `${hp(1)} → ${hp(10)} → ${hp(20)}`, '', mh > 1 ? `Manches 1, 10 et 20 : ${fmtNum(mh, 2)} fois ceux d’un Astronaute` : 'Manches 1, 10 et 20 : 150, +100 par manche jusqu’à la 10, puis ×1,1'],
      ['Bonds', `${fmtNum(Lw, 0)} à ${fmtNum(Lr, 0)} m`, '', `Au pas : ${fmtNum(Lw, 0)} m hauts (${fmtNum(tw, 1)} s en l’air) ; en courant : ${fmtNum(Lr, 0)} m rasants (${fmtNum(tr, 1)} s) · 1,62 m/s²`],
      ['Gradins', '14 m', '', 'Ils sautent d’un gradin au suivant et prennent les propulseurs comme vous'],
      ['Coup', `${fmtNum(hit, 0)} dégâts`, '', `${Math.ceil(RULES.playerHp / hit)} coups vous mettent à terre, ${Math.ceil(RULES.cuirasseHp / hit)} avec ${PERKS.cuirasse.name}`],
      ['Tête', `dégâts ×${fmtNum(type.headMult)}`, '', 'La visière ne protège pas : rien n’arrête le premier tir à la tête'],
      ['Points rapportés', `+${RULES.pointsKill} à +${RULES.pointsKnife}`, '', `Élimination +${RULES.pointsKill}, tête +${RULES.pointsHead}, couteau +${RULES.pointsKnife} · +${RULES.pointsHit} par touche`],
    ];
    return {
      bars: [['PV', (khHp(1) * mh) / zombieHpForRound(1)], ['Vitesse', type.mult.speed], ['Dégâts', type.mult.damage]],
      ref: `Référence ×1 du bestiaire : le Fantassin, ${fmtNum(zombieHpForRound(1), 0)} PV à la manche 1. Les morts de la mine ont la courbe des cartes ouvertes : ${hp(1)} PV à la manche 1, ${hp(10)} à la 10.`,
      cards: [[`Capacité · ${type.ability}`, 'Un sixième de la pesanteur : ils avancent par bonds balistiques, courts et hauts au début, longs et rasants dès la manche 4.'], ['Signe distinctif', type.sign]],
      details,
    };
  };
}
