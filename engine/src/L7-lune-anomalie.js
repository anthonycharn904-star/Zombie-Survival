/* ----------------------------------------- Lune : le dépôt et l'anomalie --
   « Dépôt d'oxygène — une seule explosion ; l'anomalie (fictive) garde ses débris en orbite sans
   fin » ; choix d'Anthony : il saute de lui-même dès la manche 1, sous les yeux du joueur qui sort
   de la base (le départ regarde le dépôt par la baie). Sans air : un éclair, un nuage de cristaux
   d'oxygène qui s'étend et s'évapore, des éclats ; ni boule de feu ni fumée.
   L'anomalie : un cylindre vertical sur la moitié est de la fosse et le dépôt (centre 760, 1045 ;
   150 m de rayon ; de −85 à +70 m). Dedans, tout tourne en cercles autour de l'axe (débris, poussière,
   grenades, gouttes) ; dehors, chaque grain suit sa parabole. */
const LUA = { x: 760, z: 1045, R: 150, y0: -85, y1: 70, on: false, t: 0, items: [], kinds: [], dust: null, boomT: -1, done: false };
/* Vitesse de l'anomalie en (x, y, z) : tangente au cercle autour de l'axe (m/s), ou null dehors. */
function luAnomalyIn(x, y, z) {
  if (!LUA.on) return false;
  const dx = x - LUA.x, dz = z - LUA.z;
  return dx * dx + dz * dz < LUA.R * LUA.R && y > LUA.y0 && y < LUA.y1;
}
/* Un point (particule, grenade) dans l'anomalie : sa vitesse tend vers l'orbite (sens horaire vu du
   dessus, 3 à 6 m/s), sa hauteur ne change plus guère. */
function luAnomalyPush(px, py, pz, v, dt) {
  const dx = px - LUA.x, dz = pz - LUA.z, r = Math.hypot(dx, dz) || 1;
  const sp = 3 + 3 * (1 - r / LUA.R);
  const tx = -dz / r * sp, tz = dx / r * sp;
  const k = Math.min(1, dt * 1.6);
  v.x += (tx - v.x) * k; v.z += (tz - v.z) * k; v.y += (0 - v.y) * k;
  // force centripète : le rayon se garde
  v.x -= (dx / r) * (sp * sp / r) * dt; v.z -= (dz / r) * (sp * sp / r) * dt;
}
const _luAV = { x: 0, y: 0, z: 0 };
/* Gouttes, poussière, sable (PointPool) : appelée à la place de la pesanteur ; vrai si le point est pris. */
function luAnomalyPoint(P, k, dt) {
  if (!LUA.on) return false;
  const x = P.pos[k], y = P.pos[k + 1], z = P.pos[k + 2];
  if (!luAnomalyIn(x, y, z)) return false;
  _luAV.x = P.vel[k]; _luAV.y = P.vel[k + 1]; _luAV.z = P.vel[k + 2];
  luAnomalyPush(x, y, z, _luAV, dt);
  P.vel[k] = _luAV.x; P.vel[k + 1] = _luAV.y; P.vel[k + 2] = _luAV.z;
  // dans l'anomalie, la goutte dure (elle tourne) : sa vie ne descend que lentement
  P.life[k / 3] += dt * 0.8;
  return true;
}

/* ---- Les débris : éclats de sphère, panneaux, caisses, bouteilles, cailloux, morceaux de mât, et
   le corps d'un technicien en combinaison. Instanciés par genre. */
function luDebrisGeometries() {
  if (LUA.geo) return LUA.geo;
  const shell = new THREE.SphereGeometry(1, 8, 6, 0, 1.3, 0.4, 1.1);       // éclat de sphère (coque)
  const panel = new THREE.BoxGeometry(1.6, 0.06, 1.0);
  const crate = new THREE.BoxGeometry(0.9, 0.7, 0.7);
  const bottle = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 10);
  const rock = new THREE.IcosahedronGeometry(0.35, 0);
  const solar = new THREE.BoxGeometry(2.2, 0.05, 1.1);
  const pipe = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8);
  LUA.geo = { shell, panel, crate, bottle, rock, solar, pipe };
  return LUA.geo;
}
const LU_DEBRIS = [
  // genre, nombre, matière (couleur, rugosité, métal), taille
  ['shell', 70, 0xe6e6e0, 0.4, 0.35, [1.2, 3.2]],
  ['panel', 50, 0xd0d0ca, 0.5, 0.3, [0.6, 1.6]],
  ['crate', 34, 0xc89a48, 0.7, 0.1, [0.7, 1.3]],
  ['bottle', 46, 0xe8ece8, 0.35, 0.3, [0.8, 1.2]],
  ['rock', 70, 0x8a8682, 0.95, 0, [0.5, 2.2]],
  ['solar', 22, 0x1c2c4a, 0.25, 0.4, [0.8, 1.4]],
  ['pipe', 20, 0xb0b2b4, 0.4, 0.6, [0.6, 1.4]],
];
function luBuildAnomaly(root) {
  const G0 = luDebrisGeometries(), rnd = mulberry32(312);
  LUA.items = []; LUA.kinds = [];
  for (const [kind, n, col, rough, metal, [s0, s1]] of LU_DEBRIS) {
    const mat = luSunify(new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal, side: kind === 'shell' ? THREE.DoubleSide : THREE.FrontSide }));
    const mesh = new THREE.InstancedMesh(G0[kind], mat, n);
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.name = `débris ${kind}`;
    root.add(mesh);
    const K = { mesh, n, items: [] };
    for (let i = 0; i < n; i++) {
      // orbite : rayon, hauteur, vitesse, phase, inclinaison, roulis propre
      const r = 8 + Math.pow(rnd(), 0.75) * (LUA.R - 14), y = lerp(-70, 55, Math.pow(rnd(), 0.9)) * (r < 60 ? 1 : 0.7) + (r > 120 ? 10 : 0);
      const it = {
        kind, r, y, w: (2.5 + rnd() * 3.5) / r * (rnd() < 0.08 ? -1 : 1), ph: rnd() * TAU, tilt: (rnd() - 0.5) * 0.25, tp: rnd() * TAU,
        bob: rnd() * 2.5, bw: 0.1 + rnd() * 0.3, s: s0 + rnd() * (s1 - s0), ax: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), spin: (rnd() - 0.5) * 1.6,
        // trajet de l'explosion : départ au dépôt, vitesse ; capturé au bout de t1 s (fondu vers l'orbite)
        p0: new THREE.Vector3(), v0: new THREE.Vector3(), t1: 1.2 + rnd() * 2.8, q: new THREE.Quaternion(),
      };
      K.items.push(it); LUA.items.push(it);
    }
    LUA.kinds.push(K);
  }
  // poussière : 1 800 points qui tournent
  const n = 1800, pos = new Float32Array(n * 3);
  const dust = { n, pos, r: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), ph: new Float32Array(n) };
  for (let i = 0; i < n; i++) { dust.r[i] = 4 + Math.pow(rnd(), 0.8) * (LUA.R - 6); dust.y[i] = lerp(-78, 60, rnd()); dust.w[i] = (2 + rnd() * 4) / dust.r[i]; dust.ph[i] = rnd() * TAU; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8d6d0, size: 0.16, map: TEX.glow, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.frustumCulled = false; pts.name = 'poussière de l’anomalie';
  root.add(pts);
  dust.pts = pts;
  LUA.dust = dust;
  // nuage de l'explosion (cristaux d'oxygène) et éclair
  const cn = 900, cpos = new Float32Array(cn * 3), cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cpos, 3));
  const cloud = new THREE.Points(cg, new THREE.PointsMaterial({ color: 0xeaf6ff, size: 0.5, map: TEX.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  cloud.frustumCulled = false; cloud.visible = false;
  const vel = new Float32Array(cn * 3);
  for (let i = 0; i < cn; i++) { const a = rnd() * TAU, b = Math.acos(rnd() * 2 - 1), v = 20 + rnd() * 45; vel[i * 3] = Math.sin(b) * Math.cos(a) * v; vel[i * 3 + 1] = Math.abs(Math.cos(b)) * v * 0.8; vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * v; }
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xdff2ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flash.scale.set(140, 140, 1); flash.visible = false;
  const light = new THREE.PointLight(0xe8f4ff, 0, 400, 1.6);
  root.add(cloud, flash, light);
  LUA.boom = { cloud, cpos, vel, n: cn, flash, light };
}
/* État : intact (avant l'explosion) ou détruit (les débris en orbite depuis t secondes). */
function luDepotState(destroyed, t = 30) {
  const D = luDepotW();                                 // jeu 2.0.3 : le dépôt et ses sphères à leur pose
  LUA.done = destroyed; LUA.on = destroyed; LUA.boomT = destroyed ? t : -1;
  if (D && LUPL.depot.group) for (const s of LUPL.depot.spheres) { s.mesh.visible = !destroyed && !owNodeHidden(s.prim); s.band.visible = s.mesh.visible; }
  // cases des sphères : pleines tant qu'elles tiennent
  if (D) {
    for (const s of D.spheres) { const y = s.gy; owFill(OW.surf, s.x - 2.5, s.z - 2.5, s.x + 2.5, s.z + 2.5, destroyed ? OWK.LOW : OWK.SOLID, { base: y - 0.5, top: destroyed ? y + 0.8 : s.y + s.r, mat: OWM.METAL }); }
    OWNAV.ready = false; LUNAV.ready = false;
  }
  for (const K of LUA.kinds) K.mesh.visible = destroyed;
  if (LUA.dust) LUA.dust.pts.visible = destroyed;
  if (LUA.boom) { LUA.boom.cloud.visible = false; LUA.boom.flash.visible = false; LUA.boom.light.intensity = 0; }
  luQuestLook();
  // départs des éclats (au dépôt)
  if (D && D.spheres.length) for (const it of LUA.items) {
    const s = D.spheres[Math.floor(Math.random() * D.spheres.length)];
    it.p0.set(s.x + rand(-2, 2), s.y + rand(-2, 2), s.z + rand(-2, 2));
    // vers l'anomalie surtout (le dépôt est sur son bord), vers le haut
    const a = Math.atan2(LUA.z - s.z, LUA.x - s.x) + rand(-1.6, 1.6), v = rand(14, 48);
    it.v0.set(Math.cos(a) * v, rand(6, 40), Math.sin(a) * v);
  }
}
/* Explosion (manche 1) : éclair, nuage, éclats, dégâts autour, grondement par le sol. */
function luDepotBoom() {
  if (LUA.done) return;
  luDepotState(true, 0);
  const D = luDepotW(), B = LUA.boom;
  B.cloud.visible = true; B.flash.visible = true;
  B.flash.position.set(D.x, D.y + 6, D.z);
  B.light.position.set(D.x, D.y + 10, D.z);
  for (let i = 0; i < B.n; i++) { B.cpos[i * 3] = D.x + rand(-4, 4); B.cpos[i * 3 + 1] = D.y + rand(2, 8); B.cpos[i * 3 + 2] = D.z + rand(-4, 4); }
  const d = Math.hypot(player.pos.x - D.x, player.pos.z - D.z);
  if (d < 26 && !LU.inside) playerDamage(Math.max(0, (1 - d / 26)) * player.maxHp * 1.2, true);
  for (const z of Zombies.list) {
    if (!z.alive || z.boss) continue;
    const dz = Math.hypot(z.pos.x - D.x, z.pos.z - D.z);
    if (dz < 30) killZombie(z, { kind: 'explosion', dx: z.pos.x - D.x, dz: z.pos.z - D.z });
  }
  // dans la base : le grondement par le sol et la coque ; dehors près du dépôt : par les pieds
  if (LU.inside) luRumble(1.0, 3.2); else if (d < 260) luRumble(clamp(1.2 - d / 260, 0.15, 1), 2.2);
  FX.shake = Math.min(1, FX.shake + clamp(1 - d / 400, 0.15, 0.8));
  owSandBurst(D.x, D.z, D.y);
  HUD.banner('Le dépôt d’oxygène a sauté', 'Ses débris ne retombent pas', 'power');
}
/* Chaque image : orbites (débris, poussière), trajets de l'explosion qui se fondent dans les orbites. */
function luAnomalyUpdate(dt) {
  if (!LUA.kinds.length) return;
  if (LUA.boomT >= 0) LUA.boomT += dt;
  const T = LUA.boomT, now = (LUA.t += dt);
  if (!LUA.on) return;
  const o = new THREE.Object3D();
  for (const K of LUA.kinds) {
    for (let i = 0; i < K.n; i++) {
      const it = K.items[i];
      const a = it.ph + now * it.w;
      let x = LUA.x + Math.cos(a) * it.r, z = LUA.z + Math.sin(a) * it.r, y = it.y + Math.sin(now * it.bw + it.tp) * it.bob + Math.sin(a + it.tp) * it.r * it.tilt;
      if (T < it.t1 + 2.5) {
        // trajet de l'explosion (parabole), fondu vers l'orbite à partir de t1
        const tt = Math.min(T, it.t1 + 2.5), bx = it.p0.x + it.v0.x * tt, bz = it.p0.z + it.v0.z * tt, by = it.p0.y + it.v0.y * tt - 0.5 * LU.g * tt * tt;
        const k = smooth(clamp((T - it.t1) / 2.5, 0, 1));
        x = lerp(bx, x, k); y = lerp(by, y, k); z = lerp(bz, z, k);
      }
      o.position.set(x, y, z);
      o.quaternion.setFromAxisAngle(it.ax, now * it.spin + it.ph);
      o.scale.setScalar(it.s);
      o.updateMatrix();
      K.mesh.setMatrixAt(i, o.matrix);
    }
    K.mesh.instanceMatrix.needsUpdate = true;
  }
  const D = LUA.dust;
  if (D) {
    const show = smooth(clamp(T / 4, 0, 1));
    D.pts.material.opacity = 0.85 * show;
    for (let i = 0; i < D.n; i++) { const a = D.ph[i] + now * D.w[i]; D.pos[i * 3] = LUA.x + Math.cos(a) * D.r[i]; D.pos[i * 3 + 1] = D.y[i] + Math.sin(now * 0.3 + i) * 0.6; D.pos[i * 3 + 2] = LUA.z + Math.sin(a) * D.r[i]; }
    D.pts.geometry.attributes.position.needsUpdate = true;
  }
  // nuage de cristaux et éclair
  const B = LUA.boom;
  if (B && B.cloud.visible) {
    if (T > 3.5) { B.cloud.visible = false; B.flash.visible = false; B.light.intensity = 0; }
    else {
      for (let i = 0; i < B.n; i++) { B.cpos[i * 3] += B.vel[i * 3] * dt; B.cpos[i * 3 + 1] += B.vel[i * 3 + 1] * dt; B.cpos[i * 3 + 2] += B.vel[i * 3 + 2] * dt; }
      B.cloud.geometry.attributes.position.needsUpdate = true;
      B.cloud.material.opacity = 0.9 * (1 - smooth(clamp(T / 3.5, 0, 1)));
      B.cloud.material.size = 1.6 + T * 4;
      B.flash.material.opacity = Math.max(0, 1 - T / 0.35);
      B.light.intensity = Math.max(0, 9 * (1 - T / 0.6));
    }
  }
}
