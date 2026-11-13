
/* ---------------------------------------------------------------- L'eau --
   Un plan à y = 0 (MeshStandardMaterial : la lune, les lanternes, le projecteur de la barque s'y
   reflètent) retouché à la compilation : petites rides et houle lente, ronds dans l'eau (jusqu'à 24
   à la fois : gouttes, sillages, pas dans l'eau, signes de la bête), lentilles d'eau dans les coins
   calmes, liseré d'écume sale sur les berges, transparence selon la profondeur (le fond vaseux se
   voit dans les hauts-fonds, une ombre se devine à un ou deux mètres sous la surface), reflet du ciel
   brumeux en lumière rasante (Fresnel). Profondeur et lentilles : une texture tirée du relief.
   Kit 2.0.7 (la pluie, ma17 ; l'orage, ma18) : ronds de pluie calculés sur toute la surface proche (deux couches
   de cases, une goutte par case et par cycle, le rond qui s'élargit et s'efface ; pas sous un toit), reflets
   brouillés au loin sous l'averse, reflet de l'éclair dans l'eau, l'eau qui s'illumine là où la foudre tombe
   (cœur, filaments, onde de lumière) ; pas d'eau dans la coque des barques. */
const MA_RIP = 24, MA_HULLS = 6;
function maDepthTexture() {
  const S = 512, data = new Uint8Array(S * S * 4), span = (OW.NX - 1) * OW.STEP;
  for (let j = 0; j < S; j++) {
    const z = OW.Z0 + ((j + 0.5) / S) * span;
    for (let i = 0; i < S; i++) {
      const x = OW.X0 + ((i + 0.5) / S) * span, dep = MA.water - owH(x, z), k = (j * S + i) * 4;
      data[k] = clamp(dep / 12, 0, 1) * 255;
      // lentilles d'eau : eau calme et peu profonde, par plaques
      const calm = owSmoothstep(3.2, 0.5, dep) * (dep > 0 ? 1 : 0) * clamp(owFbm(x / 36 + 2, z / 36 - 5, 3) * 1.6 - 0.45, 0, 1);
      data[k + 1] = calm * 255;
      data[k + 2] = clamp(-dep / 3, 0, 1) * 255;                     // terre (pour l'écume)
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
function maBuildWater(root) {
  const span = (OW.NX - 1) * OW.STEP;
  const U = MA.waterU = {
    uT: { value: 0 }, uDepthTex: { value: maDepthTexture() }, uRect: { value: new THREE.Vector3(OW.X0, OW.Z0, 1 / span) },
    uRip: { value: Array.from({ length: MA_RIP }, () => new THREE.Vector4(0, 0, -100, 0)) },
    uSky: { value: new THREE.Color(0x2c3a34).convertSRGBToLinear() }, uDeep: { value: new THREE.Color(0x0d1410).convertSRGBToLinear() },
    uShallow: { value: new THREE.Color(0x2a3020).convertSRGBToLinear() }, uWeed: { value: new THREE.Color(0x3b4a1c).convertSRGBToLinear() },
    uFoam: { value: new THREE.Color(0x6d7262).convertSRGBToLinear() }, uReflK: { value: 0.85 },
    // kit 2.0.7 : la pluie (ronds de pluie, de 0 à 1), le reflet de l'éclair dans l'eau, l'eau qui s'illumine
    // à l'impact de la foudre (x, z, instant, rayon ; force)
    uRainR: { value: 0 }, uSkyF: { value: new THREE.Color(0, 0, 0) }, uZap: { value: new THREE.Vector4(0, 0, -100, 7) }, uZapK: { value: 0 },
    uRoofW: MA_WXU.uRoof,                                 // la carte des toits de la pluie (ma17) : pas de ronds sous un toit
    // kit 2.0.7 : l'intérieur des barques (x, z, avant x, avant z) : pas d'eau dans la coque (la pluie et l'éclair
    // y faisaient voir le plan d'eau qui traverse le fond)
    uBoat: { value: Array.from({ length: MA_HULLS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  };
  MA.rip = { next: 0 };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.07, metalness: 0, transparent: true, opacity: 1, depthWrite: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vMaW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vMaW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = [
      'varying vec3 vMaW;',
      'uniform float uT; uniform sampler2D uDepthTex; uniform vec3 uRect; uniform vec4 uRip[' + MA_RIP + '];',
      'uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uWeed; uniform vec3 uFoam; uniform float uReflK;',
      'uniform float uRainR; uniform vec3 uSkyF; uniform vec4 uZap; uniform float uZapK; uniform sampler2D uRoofW; uniform vec4 uBoat[' + MA_HULLS + '];',
      'float maHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      // kit 2.0.7 : ronds de pluie. Une goutte par case et par cycle (0,55 à 1 s), à un endroit tiré au hasard ;
      // une case sur deux… à toutes (uRainR) ; le rond s'élargit à 0,34 m/s et s'efface en une demi-seconde.
      // Renvoie la pente (dérivée exacte de la hauteur).
      'vec2 maRainLayer(vec2 p, float sc, float seed){',
      '  vec2 g = vec2(0.0), c0 = floor(p / sc);',
      '  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {',
      '    vec2 c = c0 + vec2(float(i), float(j));',
      '    float per = 0.55 + 0.45 * maHash(c + vec2(seed, 3.7));',
      '    float tt = uT / per + maHash(c + vec2(seed)), cyc = floor(tt), age = fract(tt) * per;',
      '    if (maHash(c + vec2(cyc * 0.731, seed + 0.5)) > uRainR) continue;',
      '    vec2 ctr = (c + 0.15 + 0.7 * vec2(maHash(c + vec2(cyc + seed, 1.3)), maHash(c + vec2(7.9, cyc - seed)))) * sc;',
      '    vec2 d = p - ctr; float r = length(d), x = r - age * 0.34;',
      '    float env = exp(-x * x * 1400.0 - age * 3.6), k = 105.0;',
      '    g += env * (-k * sin(k * x) - 2800.0 * x * cos(k * x)) * d / max(r, 1e-3);',
      '  }',
      '  return g;',
      '}',
      'float maNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(maHash(i), maHash(i + vec2(1.0, 0.0)), f.x), mix(maHash(i + vec2(0.0, 1.0)), maHash(i + vec2(1.0, 1.0)), f.x), f.y); }',
      'float maWaveH(vec2 p){',
      '  float h = 0.010 * sin(p.x * 0.21 + uT * 0.7) + 0.008 * sin(p.y * 0.17 - uT * 0.55 + p.x * 0.05)',
      '    + 0.005 * sin((p.x + p.y) * 0.53 + uT * 1.3) + 0.004 * sin((p.x - p.y) * 0.91 - uT * 1.7)',
      '    + 0.006 * maNoise(p * 0.8 + vec2(uT * 0.11, -uT * 0.07)) + 0.003 * maNoise(p * 2.7 - vec2(uT * 0.21, uT * 0.13));',
      '  for (int i = 0; i < ' + MA_RIP + '; i++) {',
      '    vec4 r = uRip[i]; float age = uT - r.z;',
      '    if (age > 0.0 && age < 5.0) {',
      '      float dist = length(p - r.xy), rad = age * (1.2 + abs(r.w) * 0.6), d = dist - rad;',
      '      h += r.w * exp(-d * d * 1.6) * sin(d * 7.0) * exp(-age * 0.75) / (1.0 + rad * 0.35);',
      '    }',
      '  }',
      '  return h;',
      '}',
    ].join('\n') + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        // la coque d'une barque (4,4 × 1,62 m, la poupe large, la proue en pointe), un peu en retrait du bordé
        '  for (int i = 0; i < ' + MA_HULLS + '; i++) {',
        '    vec4 B = uBoat[i];',
        '    if (B.z == 0.0 && B.w == 0.0) continue;',
        '    vec2 q = vMaW.xz - B.xy; float lf = dot(q, B.zw), lr = dot(q, vec2(-B.w, B.z)), u = (lf + 2.08) / 4.12;',
        '    float hw = 0.69 * (u < 0.45 ? 1.0 : sqrt(max(0.0, 1.0 - (u - 0.45) * (u - 0.45) / 0.3025)));',
        '    if (u > 0.0 && u < 1.0 && abs(lr) < hw) discard;',
        '  }',
        '  vec2 maUv = (vMaW.xz - uRect.xy) * uRect.z, maRg = vec2(0.0);',
        '  vec4 maD = texture2D(uDepthTex, maUv);',
        '  float maDep = maD.r * 12.0, maCalm = maD.g, maLand = maD.b;',
        '  float maWeed = maCalm * smoothstep(0.52, 0.72, maNoise(vMaW.xz * 0.07) * 0.62 + maNoise(vMaW.xz * 0.33) * 0.38);',
        '  float maFoam = (1.0 - smoothstep(0.0, 0.22, maDep)) * (0.55 + 0.45 * maNoise(vMaW.xz * 2.6 + uT * 0.2));',
        '  vec3 maBase = mix(uShallow, uDeep, smoothstep(0.08, 2.6, maDep));',
        '  maBase = mix(maBase, uWeed * (0.65 + 0.5 * maNoise(vMaW.xz * 1.9)), maWeed);',
        '  maBase = mix(maBase, uFoam, maFoam * 0.45);',
        '  diffuseColor.rgb = maBase;',
        '  diffuseColor.a = max(max(mix(0.55, 0.84, smoothstep(0.05, 2.2, maDep)), maWeed * 0.96), maFoam * 0.75);',
      ].join('\n'))
      .replace('#include <normal_fragment_maps>', [
        '#include <normal_fragment_maps>',
        '  {',
        '    float e = 0.18, h0 = maWaveH(vMaW.xz), hx = maWaveH(vMaW.xz + vec2(e, 0.0)), hz = maWaveH(vMaW.xz + vec2(0.0, e));',
        '    float maFlat = 1.0 - 0.8 * maWeed;',
        '    if (uRainR > 0.002) {',
        '      float fade = (1.0 - smoothstep(7.0, 24.0, length(cameraPosition - vMaW))) * step(texture2D(uRoofW, (floor(vMaW.xz) + 0.5) / 1024.0).r, 0.0);',
        '      if (fade > 0.0) maRg = (maRainLayer(vMaW.xz, 0.42, 0.0) + maRainLayer(vMaW.xz, 0.27, 19.0)) * 0.0021 * fade * (1.0 - 0.9 * maWeed);',
        '    }',
        '    vec3 wn = normalize(vec3(-(hx - h0) / e * 6.0 * maFlat - maRg.x, 1.0, -(hz - h0) / e * 6.0 * maFlat - maRg.y));',
        '    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);',
        '  }',
      ].join('\n'))
      // kit 2.0.7 : sous l'averse, les reflets se brouillent au loin (des milliers de ronds trop petits pour être vus)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.78, maWeed);\n  roughnessFactor = mix(roughnessFactor, 0.24, uRainR * smoothstep(5.0, 32.0, length(cameraPosition - vMaW)) * (1.0 - maWeed));')
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        '  {',
        '    vec3 V = normalize(cameraPosition - vMaW);',
        '    vec3 wN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);',
        '    float fr = 0.02 + 0.98 * pow(1.0 - clamp(dot(wN, V), 0.0, 1.0), 5.0);',
        '    totalEmissiveRadiance += (uSky + uSkyF) * fr * uReflK * (1.0 - maWeed);',
        // les ronds de pluie accrochent la lumière du ciel (de l'éclair surtout) : on les devine la nuit
        '    totalEmissiveRadiance += (uSky * 3.0 + uSkyF * 0.8) * min(length(maRg), 1.2) * 0.35;',
        '  }',
        // kit 2.0.7 : la foudre tombe dans l'eau : le cœur éblouissant, le halo, l'onde de lumière qui court
        // (des filaments de lumière qui partent du point d'impact sous la surface, et changent sans cesse)
        '  if (uZapK > 0.001) {',
        '    vec2 zv = vMaW.xz - uZap.xy; float zd = length(zv), za = max(0.0, uT - uZap.z), zr = (zd - za * 11.0) / 0.9;',
        '    vec2 zu = zv / max(zd, 1e-3);',
        '    float fil = maNoise(zu * 4.0 + vec2(zd * 0.22 - uT * 6.0, uT * 3.0)) * maNoise(zu * 9.0 + vec2(17.0 + uT * 11.0, zd * 0.5));',
        '    fil = smoothstep(0.18, 0.55, fil);',
        '    float zc = exp(-zd * zd / (uZap.w * uZap.w * 0.06)), zh = exp(-zd / (uZap.w * 0.55)), zw = exp(-zr * zr - za * 2.2);',
        '    totalEmissiveRadiance += vec3(0.58, 0.7, 1.0) * uZapK * (zc * 3.5 + zh * (0.25 + 2.6 * fil) + zw * 2.0);',
        '  }',
      ].join('\n'));
  };
  mat.customProgramCacheKey = () => 'marais-eau-3';
  const geo = new THREE.PlaneGeometry(2600, 2600, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(500, MA.water, 500);
  m.name = 'eau'; m.renderOrder = 2; m.receiveShadow = false; m.frustumCulled = false;
  root.add(m);
  MA.waterMesh = m;
  _linDone.add(mat);                                    // couleurs données en linéaire
}
/* Chaque image : la place des barques à flot (pas d'eau dans leur coque). */
function maWaterHulls() {
  const U = MA.waterU;
  if (!U || !U.uBoat) return;
  let i = 0;
  for (const V of VEH.list) {
    if (i >= MA_HULLS) break;
    if (!V.T.boat || V.wrecked || V.capsized || (V.group && !V.group.visible)) continue;
    const [fx, fz] = vehFwd(V.yaw);
    U.uBoat.value[i++].set(V.x, V.z, fx, fz);
  }
  for (; i < MA_HULLS; i++) U.uBoat.value[i].set(0, 0, 0, 0);
}
/* Un rond dans l'eau (amp > 0 : vers le haut ; 0,02 goutte, 0,1 corps qui tombe, 0,4 la bête). */
function maRipple(x, z, amp = 0.05) {
  if (!MA.waterU) return;
  const R = MA.waterU.uRip.value[MA.rip.next];
  MA.rip.next = (MA.rip.next + 1) % MA_RIP;
  R.set(x, z, OW.t, amp);
}

/* ---- Gouttes (éclaboussures) : grains clairs qui retombent ; quand ils touchent l'eau, un petit rond. */
function maDropTexture() {
  const S = 64, c = makeCanvas(S, S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(230,240,235,0.8)'); grd.addColorStop(1, 'rgba(200,215,210,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return toTex(c, { clamp: true });
}
function maFxInit(root) {
  if (!MA.drops) {
    const mat = maHFogLite(new THREE.PointsMaterial({ color: new THREE.Color(0x9fb0a6).convertSRGBToLinear(), size: 0.11, map: share(maDropTexture()), transparent: true, depthWrite: false, opacity: 0.85 }));
    MA.drops = new PointPool(900, share(mat), 9.8, false);
    MA.drops.points.name = 'gouttes';
    _linDone.add(mat);
  }
  if (!MA.drops.points.parent) scene.add(MA.drops.points);
  // kit MM 2.1.3 : de grosses paquets d'eau (la ruée, l'eau qui ruisselle de la bête) : les gouttes de 11 cm ne
  // se voyaient pas à plus de quelques mètres
  if (!MA.spray) {
    const mat = maHFogLite(new THREE.PointsMaterial({ color: new THREE.Color(0xaebdb4).convertSRGBToLinear(), size: 0.24, map: MA.drops.points.material.map, transparent: true, depthWrite: false, opacity: 0.6 }));
    MA.spray = new PointPool(500, share(mat), 9.8, false);
    MA.spray.points.name = 'embruns';
    _linDone.add(mat);
  }
  if (!MA.spray.points.parent) scene.add(MA.spray.points);
  if (!MA.splashTex) MA.splashTex = share(maSplashTexture());
}
/* Gerbe d'eau pour les gros plongeons : une colonne de gouttes et de paquets d'eau qui s'évase en montant
   (kit MM 2.1.3 : l'ancien éventail de traits droits partant d'un point se lisait, la nuit, comme un faisceau
   de lumière). */
function maSplashTexture() {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d'), rnd = mulberry32(77);
  for (let i = 0; i < 300; i++) {
    const h = Math.pow(rnd(), 0.85), y = S * (0.93 - h * 0.86), spread = S * (0.05 + 0.3 * h);
    const x = S / 2 + ((rnd() + rnd() + rnd() - 1.5) / 1.5) * spread;
    const r = 0.6 + rnd() * (2.8 - 1.8 * h), a = 0.55 * (1 - h * 0.65) * (0.35 + 0.65 * rnd());
    g.fillStyle = `rgba(232,240,236,${a.toFixed(3)})`;
    g.beginPath(); g.ellipse(x, y, r, r * (1.1 + rnd() * 1.8), 0, 0, Math.PI * 2); g.fill();
  }
  const grd = g.createRadialGradient(S / 2, S * 0.9, 2, S / 2, S * 0.9, S * 0.3);
  grd.addColorStop(0, 'rgba(230,238,232,0.5)'); grd.addColorStop(1, 'rgba(230,238,232,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return toTex(c, { clamp: true });
}
/* Éclaboussure : k 0,2 (douille, balle) à 3 (la bête retombe). */
function maSplash(x, z, k = 1, o = {}) {
  maFxInit();
  const y = MA.water + 0.02, n = Math.round(clamp(8 + 40 * k, 6, 180));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, r = Math.random() * 0.4 * k, up = rand(1.5, 4.5) * Math.sqrt(k) * (o.up || 1);
    MA.drops.emit(x + Math.cos(a) * r, y, z + Math.sin(a) * r, Math.cos(a) * rand(0.4, 2.2) * Math.sqrt(k) + (o.vx || 0), up, Math.sin(a) * rand(0.4, 2.2) * Math.sqrt(k) + (o.vz || 0), rand(0.5, 1.3) * Math.min(1.6, 0.7 + k * 0.3));
  }
  maRipple(x, z, clamp(0.03 * k, 0.015, 0.5));
  if (k > 0.6) maRipple(x + rand(-0.5, 0.5), z + rand(-0.5, 0.5), clamp(0.02 * k, 0.01, 0.3));
  if (k > 0.8) {
    // gerbe et voile d'embruns
    // kit MM 2.1.3 : la gerbe plafonne (à 3 et plus, un éventail blanc de 6 m qui se lisait comme des rayons de
    // lumière la nuit) ; les gouttes font le reste
    const s = 1.2 + Math.min(k, 2.2) * 1.3;
    spawnPuff(x, y + s * 0.42, z, s, 0.45 + Math.min(k, 2.2) * 0.15, 0xc8d4cc, clamp(0.22 + k * 0.08, 0, 0.42), 0.6, false, MA.splashTex);
    spawnPuff(x + rand(-0.6, 0.6), y + 0.4, z + rand(-0.6, 0.6), s * 1.4, 1.2 + k * 0.4, 0x8c9a92, 0.18, 0.25, false, TEX.smoke);
  }
}
/* Bulles qui crèvent à la surface (la bête respire, une barque coule) : petits ronds, gouttelettes. */
function maBubbles(x, z, n = 6, spread = 1.2) {
  maFxInit();
  for (let i = 0; i < n; i++) {
    const bx = x + rand(-spread, spread), bz = z + rand(-spread, spread);
    if (Math.random() < 0.5) maRipple(bx, bz, rand(0.006, 0.02));
    MA.drops.emit(bx, MA.water + 0.03, bz, rand(-0.2, 0.2), rand(0.4, 1.2), rand(-0.2, 0.2), rand(0.2, 0.4));
  }
}

/* ---- Brume : grandes nappes posées sur l'eau, qui dérivent ; recyclées autour de la caméra. Elles
   s'effacent de près (on ne voit jamais un plan). Kit MM 2.1.5 : plus nombreuses (96, 56 en qualité
   basse), et des écharpes basses sur la terre ferme (52, 30), entre 10 et 75 m, loin des bâtiments,
   leur bas au-dessus du sol ; dedans, elles pâlissent. Le gros de la brume est la nappe des shaders
   (ma14) : ces sprites y ajoutent du relief et du mouvement. */
function maMistTexture() {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
  const n = valueNoise(S, S, [[4, 4, 1], [8, 8, 0.6], [16, 16, 0.3]], 1.4);
  // jeu 2.0.7 (temps de chargement, 12 novembre 2026) : les pixels écrits dans une image neuve, sans relire le canevas
  // (getImageData attendait tout le travail en cours de la carte graphique) ; même texture qu'avant, au pixel près
  const img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), r = Math.hypot(dx, dy * 1.6), p = (y * S + x) * 4;
    d[p] = 200; d[p + 1] = 210; d[p + 2] = 204;
    d[p + 3] = clamp((1 - r) * 1.4, 0, 1) * clamp(n[y * S + x] * 1.5 - 0.2, 0, 1) * 255;
  }
  g.putImageData(img, 0, 0);
  return toTex(c, { clamp: true });
}
function maBuildMist(root) {
  const tex = MA.mistTex || (MA.mistTex = share(maMistTexture()));
  MA.mist = [];
  const g = new THREE.Group(); g.name = 'brume';
  const low = settings.quality === 'low', nW = low ? 56 : 96, nL = low ? 30 : 52;
  for (let i = 0; i < nW + nL; i++) {
    const land = i >= nW;
    const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(land ? 0x86948a : 0x7c8a80).convertSRGBToLinear(), transparent: true, opacity: 0, depthWrite: false, fog: true });
    m.rotation = rand(-0.25, 0.25);
    maHFogLite(m);
    const s = new THREE.Sprite(m);
    s.visible = false;
    const e = { s, m, land, x: 0, z: 0, y: 0, size: 0, op: land ? rand(0.22, 0.4) : rand(0.3, 0.55), vx: rand(0.05, 0.35), vz: rand(-0.05, 0.2), init: false, c0: m.color.clone() };
    g.add(s); MA.mist.push(e);
  }
  root.add(g);
}
function maMistPlace(e, cx, cz, near) {
  for (let t = 0; t < 8; t++) {
    const a = Math.random() * TAU, d = near ? rand(18, 140) : rand(90, 150);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (maDepth(x, z) < 0.6) continue;
    e.x = x; e.z = z; e.y = rand(0.1, 1.4); e.size = rand(20, 46); e.init = true;
    e.s.scale.set(e.size, e.size * 0.34, 1);
    return true;
  }
  return false;
}
/* Près d'un bâtiment (pas d'écharpe qui traverse un mur) ? */
function maMistNearBuilding(x, z, r) {
  const S = MA_PL.spots;
  for (const k in S) {
    const v = S[k];
    if (!v) continue;
    for (const s of Array.isArray(v) ? v : [v]) {
      if (s.x0 !== undefined) { if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return true; }
      else if (s.x !== undefined && Math.hypot(x - s.x, z - s.z) < r + (k === 'barge' ? 12 : 4)) return true;
    }
  }
  return false;
}
function maMistPlaceLand(e, cx, cz, near) {
  for (let t = 0; t < 10; t++) {
    const a = Math.random() * TAU, d = near ? rand(10, 72) : rand(48, 76);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (maDepth(x, z) > 0.25) continue;
    const size = rand(6, 14);
    if (maMistNearBuilding(x, z, size * 0.5 + 1.5)) continue;
    const g = Math.max(owH(x, z), MA.water);
    e.x = x; e.z = z; e.y = g + size * 0.2 + rand(0.15, 0.7); e.size = size; e.init = true;
    e.s.scale.set(size, size * 0.4, 1);
    return true;
  }
  return false;
}
function maMistUpdate(dt) {
  if (!MA.mist) return;
  const C = (viewCamera || camera).position, cx = C.x, cz = C.z, cy = C.y, ins = MA.inside || 0, dread = MA.dread || 0;      // la caméra qui rend (vue libre comprise)
  // kit 2.0.7 : les nappes ne sont pas éclairées : l'éclair (ma18) les allume lui-même
  const F = typeof maStormFlash === 'function' && MA_WX.ready ? maStormFlash() : null, fk = F ? 1 + Math.min(3, F.amb * 0.9) : 1;
  for (const e of MA.mist) {
    if (fk !== e.fk) { e.fk = fk; e.m.color.copy(e.c0).multiplyScalar(fk); }
    const far = e.land ? 82 : 165;
    if (!e.init || Math.hypot(e.x - cx, e.z - cz) > far) {
      if (!(e.land ? maMistPlaceLand(e, cx, cz, !e.init) : maMistPlace(e, cx, cz, !e.init))) { e.m.opacity = 0; e.s.visible = false; continue; }
    }
    e.x += e.vx * dt; e.z += e.vz * dt;
    e.s.position.set(e.x, e.y + (e.land ? 0 : e.size * 0.12), e.z);
    const d = Math.hypot(e.x - cx, e.z - cz, (e.y - cy) * 2);
    const k = e.land ? owSmoothstep(e.size * 0.55, e.size * 1.3, d) * (1 - owSmoothstep(64, 80, d)) * (1 - 0.75 * ins)
      : owSmoothstep(e.size * 0.22, e.size * 0.7, d) * (1 - owSmoothstep(140, 165, d));
    e.m.opacity = e.op * k * (1 + 0.6 * dread);
    e.s.visible = e.m.opacity > 0.004;
  }
}

/* ---- Feux follets et lucioles : des points vert pâle qui flottent au ras de l'eau et des berges,
   s'allument et s'éteignent ; plus nombreux près de La Fosse et de l'îlot des pierres. */
function maBuildWisps(root) {
  const N = 140, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const W = MA.wisps = { N, pos, col, base: [], ph: new Float32Array(N), sp: new Float32Array(N) };
  const rnd = mulberry32(4242);
  for (let i = 0; i < N; i++) {
    let x, z, tries = 0;
    do {
      const I = rnd() < 0.25 ? MA.fosse : MA.islands[(rnd() * MA.islands.length) | 0];
      const a = rnd() * TAU, r = (I.r || 50) * (0.5 + rnd() * 1.2);
      x = I.x + Math.cos(a) * r; z = I.z + Math.sin(a) * r; tries++;
    } while (tries < 6 && maDepth(x, z) > 3);
    const y = Math.max(MA.water, owH(x, z)) + 0.4 + rnd() * 1.8;
    W.base.push([x, y, z]); W.ph[i] = rnd() * 100; W.sp[i] = 0.3 + rnd() * 0.9;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.16, map: TEX.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  mat.defines = { HFOG_ADD: '', HFOG_LITE: '' };        // kit MM 2.1.5 : la brume les éteint (lumière ajoutée)
  _linDone.add(mat);
  const pts = new THREE.Points(geo, mat); pts.name = 'feux follets'; pts.frustumCulled = false;
  root.add(pts);
  W.pts = pts;
}
function maWispsUpdate(dt) {
  const W = MA.wisps;
  if (!W) return;
  const t = OW.t, calm = 1 - 0.85 * (MA.dread || 0);        // la bête approche : les lucioles s'éteignent
  for (let i = 0; i < W.N; i++) {
    const b = W.base[i], ph = W.ph[i], sp = W.sp[i];
    W.pos[i * 3] = b[0] + Math.sin(t * sp * 0.7 + ph) * 1.6;
    W.pos[i * 3 + 1] = b[1] + Math.sin(t * sp * 1.3 + ph * 2) * 0.35;
    W.pos[i * 3 + 2] = b[2] + Math.cos(t * sp * 0.5 + ph) * 1.6;
    const blink = Math.max(0, Math.sin(t * sp * 2.1 + ph * 3)) ** 3 * calm;
    W.col[i * 3] = 0.55 * blink; W.col[i * 3 + 1] = 0.85 * blink; W.col[i * 3 + 2] = 0.35 * blink;
  }
  W.pts.geometry.attributes.position.needsUpdate = true;
  W.pts.geometry.attributes.color.needsUpdate = true;
}

/* ---- Sillage d'une barque : ruban d'écume qui s'élargit et s'efface derrière la poupe, rides de
   l'étrave et du moteur. Un ruban par barque en mouvement (créé à la demande). */
function maWakeTexture() {
  const W = 64, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  const n = valueNoise(W, H, [[4, 16, 1], [8, 32, 0.6], [16, 64, 0.4]], 2.2);
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, edge = Math.pow(Math.sin(Math.PI * u), 0.6), mid = 1 - 0.55 * Math.exp(-Math.pow((u - 0.5) / 0.12, 2)) * v;
    const a = clamp(n[y * W + x] * 1.6 - 0.35, 0, 1) * edge * mid, k = (y * W + x) * 4;
    d[k] = 205; d[k + 1] = 214; d[k + 2] = 206; d[k + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = toTex(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}
const MA_WAKE_N = 48;
function maWakeFor(V) {
  if (V.wake) return V.wake;
  const N = MA_WAKE_N, pos = new Float32Array(N * 2 * 3), uv = new Float32Array(N * 2 * 2), al = new Float32Array(N * 2);
  const idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
  geo.setIndex(idx);
  const tex = MA.wakeTex || (MA.wakeTex = share(maWakeTexture()));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uCol: { value: new THREE.Color(0x8e9a92).convertSRGBToLinear() }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.01 }, uHFog: { value: MA_HF } },
    vertexShader: 'attribute float alpha; varying float vA; varying vec2 vUv; varying float vFogDepth; varying vec3 vHFogW; void main(){ vA = alpha; vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vFogDepth = -mv.z; vHFogW = (vec4(mv.xyz, 0.0) * viewMatrix).xyz; gl_Position = projectionMatrix * mv; }',
    // kit MM 2.1.5 : la nappe de brume (ma14) l'efface aussi
    fragmentShader: 'uniform sampler2D map; uniform vec3 uCol; uniform vec3 fogColor; uniform float fogDensity; varying float vA; varying vec2 vUv; varying float vFogDepth; varying vec3 vHFogW;\n' + MA_HF_GLSL +
      '\nvoid main(){ vec4 t = texture2D(map, vUv); float f = 1.0 - exp(-(fogDensity * fogDensity * vFogDepth * vFogDepth + (uHFog[0].x > 0.0 ? hfTau(vHFogW) : 0.0))); gl_FragColor = vec4(uCol * t.rgb, t.a * vA * (1.0 - f));\n#include <encodings_fragment>\n}',
    transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.name = 'sillage'; mesh.renderOrder = 3;
  const W = { mesh, geo, pos, uv, al, pts: [], t: 0, ripT: 0, v: 0 };
  (World.root || scene).add(mesh);
  V.wake = W;
  return W;
}
/* Chaque image : la poupe laisse un point toutes les 0,1 s (ou 0,6 m) ; le ruban s'élargit avec l'âge. */
function maWakeUpdate(V, dt) {
  const sp = Math.abs(V.v);
  if (!V.wake && sp < 0.6) return;
  const W = maWakeFor(V);
  if (sp < 0.4 && !W.pts.length && !W.mesh.visible) return;       // à quai : rien à faire
  W.t += dt;
  const [fx, fz] = vehFwd(V.yaw), sx = V.x - fx * (V.T.len / 2 + 0.3), sz = V.z - fz * (V.T.len / 2 + 0.3);
  const last = W.pts[0];
  if (sp > 0.4 && (!last || W.t - last.t > 0.1 || Math.hypot(last.x - sx, last.z - sz) > 0.6)) {
    W.pts.unshift({ x: sx, z: sz, t: W.t, v: sp, rx: -fz, rz: fx });
    if (W.pts.length > MA_WAKE_N) W.pts.length = MA_WAKE_N;
  }
  // rides : étrave (de part et d'autre), hélice
  W.ripT -= dt;
  if (sp > 1 && W.ripT <= 0) {
    W.ripT = 0.22 - Math.min(0.12, sp * 0.015);
    const bx = V.x + fx * (V.T.len / 2 - 0.4), bz = V.z + fz * (V.T.len / 2 - 0.4), s = Math.random() < 0.5 ? 1 : -1;
    maRipple(bx - fz * s * 0.9, bz + fx * s * 0.9, clamp(sp * 0.008, 0.005, 0.05));
    if (Math.random() < 0.5) maRipple(sx, sz, clamp(sp * 0.006, 0.004, 0.04));
  }
  // gerbe d'étrave à pleine vitesse
  if (sp > 3.5 && Math.random() < dt * sp * 3) {
    const bx = V.x + fx * (V.T.len / 2 - 0.2), bz = V.z + fz * (V.T.len / 2 - 0.2), s = Math.random() < 0.5 ? 1 : -1;
    maFxInit();
    MA.drops.emit(bx - fz * s * 0.6, MA.water + 0.1, bz + fx * s * 0.6, -fz * s * rand(0.8, 1.8) + fx * sp * 0.3, rand(0.8, 1.8), fx * s * rand(0.8, 1.8) + fz * sp * 0.3, rand(0.3, 0.6));
  }
  // ruban
  const n = W.pts.length;
  let alive = 0;
  for (let i = 0; i < MA_WAKE_N; i++) {
    const P = W.pts[Math.min(i, n - 1)], k = i * 2;
    if (!P) { W.al[k] = W.al[k + 1] = 0; continue; }
    const age = W.t - P.t, life = 3.2;
    const a = i < n ? clamp(1 - age / life, 0, 1) * clamp(P.v / 4, 0.15, 1) * (i === 0 ? 0 : 1) : 0;
    if (a > 0) alive++;
    const half = 0.55 + age * (0.55 + P.v * 0.12);
    W.pos[k * 3] = P.x - P.rx * half; W.pos[k * 3 + 1] = MA.water + 0.03; W.pos[k * 3 + 2] = P.z - P.rz * half;
    W.pos[k * 3 + 3] = P.x + P.rx * half; W.pos[k * 3 + 4] = MA.water + 0.03; W.pos[k * 3 + 5] = P.z + P.rz * half;
    const v = P.t * 0.35;
    W.uv[k * 2] = 0; W.uv[k * 2 + 1] = v; W.uv[k * 2 + 2] = 1; W.uv[k * 2 + 3] = v;
    W.al[k] = W.al[k + 1] = a * 0.55;
  }
  W.geo.attributes.position.needsUpdate = true; W.geo.attributes.uv.needsUpdate = true; W.geo.attributes.alpha.needsUpdate = true;
  const u = W.mesh.material.uniforms;
  u.fogColor.value.copy(scene.fog.color); u.fogDensity.value = scene.fog.density;
  W.mesh.visible = alive > 0;
  if (!alive && sp < 0.4) W.pts.length = 0;                  // sillage effacé, barque arrêtée : plus rien à calculer
}
