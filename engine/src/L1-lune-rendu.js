/* -------------------------------------------------------- Lune : dessin --
   Régolithe gris (plus clair sur les éjectas frais, plus sombre sur les aires damées et la roche
   des parois), glace d'eau au fond ; ciel noir, étoiles pâles, Soleil rasant à l'est-sud-est, la
   Terre au nord (1,9°, en phase) ; pas d'air : ni brume ni bleu de l'horizon, des ombres noires.
   L'ombre du relief vient de la carte de soleil (luSunMap) : chaque matière éclairée du monde la lit
   (luSunify), le terrain comme les modules, les zombies et les objets ; les ombres des objets
   eux-mêmes viennent de la carte d'ombre du soleil autour du joueur. */
const LUC = {
  regolith: 0x8e8b86, regolithDark: 0x6f6c68, ejecta: 0xb4b1ab, rock: 0x5d5a56, rockLight: 0x7a7672,
  pad: 0x77746f, bench: 0x84817c, ice: 0xc6d3dc, dark: 0x5a5753,
};
const _luCol = new THREE.Color(), _luCol2 = new THREE.Color();
/* Couleur du sol lunaire en un point du champ (linéaire). */
function luGroundColor(k, x, z, out) {
  const b = OW.bio[k];
  const n = owNoise(x / 9, z / 9), n2 = owNoise(x / 61 + 3, z / 61 - 7), n3 = owNoise(x / 230 - 11, z / 230 + 5);
  switch (b) {
    case OWB.EJECTA: _luCol.setHex(LUC.ejecta).lerp(_luCol2.setHex(LUC.regolith), clamp(0.45 + (n - 0.5) * 0.7 + (n2 - 0.5) * 0.3, 0.15, 0.85)); break;
    case OWB.ROCK: _luCol.setHex(LUC.rock).lerp(_luCol2.setHex(LUC.rockLight), clamp(n * 0.8 + (n2 - 0.5) * 0.4, 0, 1)); break;
    case OWB.PAD: _luCol.setHex(LUC.pad).lerp(_luCol2.setHex(LUC.regolithDark), clamp((n2 - 0.4) * 0.6, 0, 0.5)); break;
    case OWB.BENCH: _luCol.setHex(LUC.bench).lerp(_luCol2.setHex(LUC.regolithDark), clamp((n - 0.5) * 0.5 + (n2 - 0.5) * 0.4 + 0.15, 0, 0.6)); break;
    case OWB.ICE: _luCol.setHex(LUC.ice).lerp(_luCol2.setHex(LUC.regolithDark), clamp(0.35 + (n - 0.5) * 0.9, 0, 0.85)); break;
    case OWB.DARKSOIL: _luCol.setHex(LUC.dark); break;
    default: {
      // régolithe : grandes plaques plus claires ou plus sombres (maturité du sol), grain fin
      _luCol.setHex(LUC.regolith).lerp(_luCol2.setHex(LUC.regolithDark), clamp(0.35 + (n3 - 0.5) * 0.9 + (n2 - 0.5) * 0.35 + (n - 0.5) * 0.15, 0, 0.9));
    }
  }
  out.copy(_luCol).convertSRGBToLinear();
  return out;
}
/* Grain du régolithe (petits cailloux, empreintes de poussière), répété tous les 8 m. */
function luRegolithTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const n = valueNoise(S, S, [[8, 8, 1], [32, 32, 0.55], [128, 128, 0.25]], 1.5);
  const rnd = mulberry32(1969);
  paintPixels(g, S, S, (x, y, col) => {
    const v = 236 + (n[y * S + x] - 0.5) * 34 + (rnd() - 0.5) * 16;
    col[0] = v; col[1] = v * 0.995; col[2] = v * 0.985;
  });
  // cailloux : petites taches claires avec leur ombre (vers l'ouest)
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = 0.7 + rnd() * rnd() * 3.2;
    g.fillStyle = 'rgba(40,38,36,0.35)'; g.beginPath(); g.ellipse(x - r * 0.9, y - r * 0.2, r * 1.3, r * 0.8, 0, 0, TAU); g.fill();
    const v = 196 + rnd() * 52; g.fillStyle = `rgba(${v | 0},${(v * 0.99) | 0},${(v * 0.97) | 0},0.8)`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const t = toTex(c);
  t.anisotropy = 8;
  return t;
}
function luTerrainMat() {
  if (LU.terMat) return LU.terMat;
  LU.terMat = share(luSunify(new THREE.MeshStandardMaterial({ vertexColors: true, map: (OWT.regolith || (OWT.regolith = share(luRegolithTexture()))), roughness: 1, metalness: 0 }), true));
  return LU.terMat;
}

/* ---- Ombre du relief dans les matières : la hauteur d'ombre (luSunMap) en texture (demi-flottants
   en WebGL 2, octets au mètre sinon) ; le soleil (lumière directionnelle) s'éteint dessous. */
const LUS = {
  on: { value: 0 }, tex: { value: null }, gtex: { value: null }, box: { value: new THREE.Vector4(0, 0, 1, 1) },
  byte: false,
};
function luHalf(v) {
  // flottant 32 bits → 16 bits (demi-flottant)
  const f = luHalf.f || (luHalf.f = new Float32Array(1)), u = luHalf.u || (luHalf.u = new Uint32Array(f.buffer));
  f[0] = v;
  const x = u[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
  if (e <= 0) return s;
  if (e >= 31) return s | 0x7c00;
  return s | (e << 10) | (m >>> 13);
}
/* Deux textures : la hauteur d'ombre (objets, zombies, lieux : leur hauteur y est comparée) et, pour
   le terrain, la profondeur d'ombre au sol (ys − H). Le terrain lointain est simplifié (pas de 4 à
   16 m) : sa hauteur dessinée s'écarte du relief, et l'ombre des gradins y faisait des dents ; lue au
   sol, elle suit le relief vrai à toute distance. */
function luSunTexture() {
  if (LU.sunTex) return LU.sunTex;
  const { NX, NZ, X0, Z0, STEP, H } = OW, ys = OW.sunVis;
  // un texel tous les 2 m (le champ)
  const gl2 = !!(renderer && renderer.capabilities && renderer.capabilities.isWebGL2);
  let t, tg;
  if (gl2) {
    const d = new Uint16Array(NX * NZ), dg = new Uint16Array(NX * NZ);
    for (let i = 0; i < d.length; i++) { d[i] = luHalf(clamp(ys[i], -400, 2000)); dg[i] = luHalf(clamp(ys[i] - H[i], -400, 400)); }
    t = new THREE.DataTexture(d, NX, NZ, THREE.RedFormat, THREE.HalfFloatType);
    tg = new THREE.DataTexture(dg, NX, NZ, THREE.RedFormat, THREE.HalfFloatType);
    LUS.byte = false;
  } else {
    // octets : la hauteur au mètre (−100 à 155 m), la profondeur au décimètre (−12,8 à 12,7 m)
    const d = new Uint8Array(NX * NZ), dg = new Uint8Array(NX * NZ);
    for (let i = 0; i < d.length; i++) { d[i] = clamp(Math.round(ys[i] + 100), 0, 255); dg[i] = clamp(Math.round((ys[i] - H[i]) * 10 + 128), 0, 255); }
    t = new THREE.DataTexture(d, NX, NZ, THREE.LuminanceFormat, THREE.UnsignedByteType);
    tg = new THREE.DataTexture(dg, NX, NZ, THREE.LuminanceFormat, THREE.UnsignedByteType);
    LUS.byte = true;
  }
  for (const x of [t, tg]) {
    x.magFilter = THREE.LinearFilter; x.minFilter = THREE.LinearFilter; x.generateMipmaps = false;
    x.wrapS = x.wrapT = THREE.ClampToEdgeWrapping; x.flipY = false;
    x.needsUpdate = true;
  }
  LU.sunTex = t; LU.sunGTex = tg;
  LUS.tex.value = t; LUS.gtex.value = tg;
  // texel (i, j) au point X0 + i·STEP : centres des texels sur les points du champ
  const w = (NX - 1) * STEP, h = (NZ - 1) * STEP;
  LUS.box.value.set(X0 - STEP / 2, Z0 - STEP / 2, 1 / (w + STEP), 1 / (h + STEP));
  return t;
}
const LU_SUN_PARS = `uniform sampler2D luSunTex; uniform sampler2D luSunGTex; uniform vec4 luSunBox; uniform float luSunOn; varying vec3 vLuW;
float luSunK() {
  if (luSunOn < 0.5) return 1.0;
  vec2 uv = (vLuW.xz - luSunBox.xy) * luSunBox.zw;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 1.0;
  #ifdef LU_SUN_GROUND
    #ifdef LU_SUN_BYTE
      float dg = texture2D(luSunGTex, uv).r * 25.5 - 12.8;
    #else
      float dg = texture2D(luSunGTex, uv).r;
    #endif
    return 1.0 - smoothstep(-0.45, 0.45, dg);
  #else
    #ifdef LU_SUN_BYTE
      float ys = texture2D(luSunTex, uv).r * 255.0 - 100.0;
    #else
      float ys = texture2D(luSunTex, uv).r;
    #endif
    return smoothstep(ys - 0.45, ys + 0.45, vLuW.y);
  #endif
}`;
/* Matière éclairée : le soleil s'éteint dans l'ombre du relief (une seule lumière directionnelle).
   ground : le terrain (l'ombre lue au sol, sans la hauteur dessinée). */
function luSunify(m, ground = false) {
  if (!m || !m.isMeshStandardMaterial || m.userData.luSun) return m;
  m.userData.luSun = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(this, sh, r);
    sh.uniforms.luSunTex = LUS.tex; sh.uniforms.luSunGTex = LUS.gtex; sh.uniforms.luSunBox = LUS.box; sh.uniforms.luSunOn = LUS.on;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLuW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 luWp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nluWp = instanceMatrix * luWp;\n#endif\nvLuW = (modelMatrix * luWp).xyz;');
    const lights = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );',
      'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\tdirectLight.color *= luSunF;');
    sh.fragmentShader = (LUS.byte ? '#define LU_SUN_BYTE\n' : '') + (ground ? '#define LU_SUN_GROUND\n' : '') + sh.fragmentShader.replace('#include <common>', `#include <common>\n${LU_SUN_PARS}`)
      .replace('#include <lights_fragment_begin>', `float luSunF = luSunK();\n${lights}`);
  };
  m.customProgramCacheKey = function () { return `${prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey ? prevKey.call(this) : ''}|luSun${LUS.byte ? 'B' : ''}${ground ? 'G' : ''}`; };
  m.needsUpdate = true;
  return m;
}
/* Toutes les matières éclairées d'un sous-arbre. */
function luSunifyTree(root) {
  root.traverse((o) => {
    if (!o.material) return;
    if (Array.isArray(o.material)) o.material.forEach(luSunify); else luSunify(o.material);
  });
}

/* ---- Ciel : noir, étoiles pâles, le Soleil (disque et éclat), la Terre (en phase, à sa taille) */
function luEarthTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const rnd = mulberry32(3), img = g.createImageData(S, S), d = img.data;
  // vue de la Lune : la Terre éclairée du côté du Soleil (à l'est, à droite quand on regarde au nord)
  const sun = luDir(LU.sun.az, LU.sun.el), earth = luDir(LU.earth.az, LU.earth.el);
  // repère de l'image : droite = est vu face au nord, haut = zénith
  const right = new THREE.Vector3().crossVectors(earth, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, earth).normalize();
  const L = new THREE.Vector3(sun.dot(right), sun.dot(up), -sun.dot(earth)).normalize();   // vers le Soleil, dans le repère de la Terre vue
  const cont = valueNoise(S, S, [[6, 6, 1], [18, 18, 0.5], [48, 48, 0.25]], 1.8);
  const cloud = valueNoise(S, S, [[10, 10, 1], [40, 40, 0.6], [96, 96, 0.3]], 1.6);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const p = (y * S + x) * 4, u = (x + 0.5) / S * 2 - 1, v = 1 - (y + 0.5) / S * 2, r2 = u * u + v * v;
      if (r2 > 1) { d[p + 3] = 0; continue; }
      const w = Math.sqrt(1 - r2), lit = Math.max(0, u * L.x + v * L.y + w * L.z);
      const lat = Math.abs(v);
      let r, gg, b;
      const land = cont[y * S + x] > 0.56 && lat < 0.86;
      if (lat > 0.88) { r = 235; gg = 240; b = 245; }
      else if (land) { const des = lat < 0.45 && cont[y * S + x] > 0.62; r = des ? 186 : 96; gg = des ? 160 : 120; b = des ? 112 : 70; }
      else { r = 28; gg = 62; b = 132; }
      const cl = clamp((cloud[y * S + x] - 0.52) * 3.2, 0, 0.92);
      r = lerp(r, 245, cl); gg = lerp(gg, 247, cl); b = lerp(b, 250, cl);
      // atmosphère au limbe, terminateur adouci
      const k = owSmoothstep(-0.05, 0.25, lit) * (0.35 + 0.65 * lit), rim = Math.pow(1 - w, 3) * 0.6;
      d[p] = clamp(r * k + 90 * rim * k, 0, 255); d[p + 1] = clamp(gg * k + 140 * rim * k, 0, 255); d[p + 2] = clamp(b * k + 255 * rim * k, 0, 255);
      d[p + 3] = 255 * clamp((1 - Math.sqrt(r2)) * 60, 0, 1);
    }
  }
  g.putImageData(img, 0, 0);
  return toTex(c);
}
function luBuildSky(root) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: luDir(LU.sun.az, LU.sun.el) }, uStars: { value: 0.55 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uSunDir; uniform float uStars; varying vec3 vDir;',
      'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void main(){',
      '  vec3 d = normalize(vDir);',
      '  vec3 c = vec3(0.0);',
      '  float s = max(dot(d, normalize(uSunDir)), 0.0);',
      // disque (0,53°), couronne serrée : sans air, pas de halo bleu
      '  c += vec3(1.0, 0.97, 0.92) * (smoothstep(0.99995, 0.999965, s) * 9.0 + pow(s, 4000.0) * 2.5 + pow(s, 400.0) * 0.25 + pow(s, 60.0) * 0.03);',
      // étoiles pâles (le sol au soleil les efface à l'œil), plus loin du Soleil
      '  vec3 a = abs(d); vec2 g; float face;',
      '  if (a.x > a.y && a.x > a.z) { g = d.yz / a.x; face = d.x > 0.0 ? 1.0 : 2.0; } else if (a.y > a.z) { g = d.xz / a.y; face = d.y > 0.0 ? 3.0 : 4.0; } else { g = d.xy / a.z; face = d.z > 0.0 ? 5.0 : 6.0; }',
      '  vec2 cell = floor(g * 340.0) + face * 1000.0; float st = step(0.9972, h21(cell));',
      '  float tw = h21(cell + 7.0); c += vec3(0.75 + 0.25 * tw, 0.8 + 0.2 * tw, 0.9) * st * uStars * (0.25 + 0.75 * tw * tw) * (1.0 - pow(s, 6.0)) * step(-0.02, d.y);',
      '  gl_FragColor = vec4(c, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <encodings_fragment>',
      '}',
    ].join('\n'),
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), mat);
  sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'ciel';
  OW.sky = sky;
  root.add(sky);
  // la Terre : disque de 1,9° (à 8,5 km du centre du ciel : 282 m de diamètre)
  const earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: (LU.earthTex || (LU.earthTex = share(luEarthTexture()))), transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  const D = 8500, sz = 2 * D * Math.tan(luDeg(LU.earth.size / 2));
  earth.scale.set(sz, sz, 1);
  earth.renderOrder = -9; earth.frustumCulled = false; earth.name = 'Terre';
  LU.earth3 = { sprite: earth, dir: luDir(LU.earth.az, LU.earth.el), D };
  root.add(earth);
  // le Soleil : la lumière ; la cible suit la caméra
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.1);
  sun.name = 'soleil';
  root.add(sun, sun.target);
  OW.sunLight = sun;
}
/* Ciel et Terre suivent la caméra. */
function luSkyFollow() {
  if (OW.sky) OW.sky.position.copy(camera.position);
  const E = LU.earth3;
  if (E) E.sprite.position.copy(camera.position).addScaledVector(E.dir, E.D);
}

/* ---- Au-delà du champ de hauteurs : la plaine, de grandes collines (cratères anciens) qui passent
   l'horizon, la courbure (à 8 km, 18 m plus bas) ; le premier anneau suit le bord du champ. */
function luFarHeight(x, z) {
  const d = Math.hypot(x - 700, z - 700);
  // près du champ : la plaine comme sur la carte ; au-delà de 3 km, des collines qui dépassent l'horizon
  let h = luNatural(x, z) * (1 - owSmoothstep(1500, 2600, d));
  // collines rondes au-delà de l'horizon (vieux remparts érodés) : 60 à 120 m, larges de plusieurs km
  const big = owFbm(x / 2600 + 3.1, z / 2600 - 1.7, 3);
  h += Math.max(0, big - 0.45) * 330 * owSmoothstep(2800, 5200, d);
  h += (owFbm(x / 700, z / 700, 2) - 0.5) * 14 * owSmoothstep(2400, 4000, d);
  return h - (d * d) / (2 * LU.R);
}
function luBuildFarRing(root) {
  const { X0, Z0, STEP, NX, NZ } = OW, x1 = X0 + (NX - 1) * STEP, z1 = Z0 + (NZ - 1) * STEP, cx = 700, cz = 700;
  const A = 720, K = 44, Rmax = 7600;
  const pos = new Float32Array(A * K * 3), col = new Float32Array(A * K * 3), idx = [];
  const c = new THREE.Color();
  for (let a = 0; a < A; a++) {
    const ang = (a / A) * TAU, ux = Math.cos(ang), uz = Math.sin(ang);
    // distance du centre au bord du champ dans cette direction (2 m en retrait)
    const tx = ux > 0 ? (x1 - 2 - cx) / ux : ux < 0 ? (X0 + 2 - cx) / ux : Infinity, tz = uz > 0 ? (z1 - 2 - cz) / uz : uz < 0 ? (Z0 + 2 - cz) / uz : Infinity;
    const d0 = Math.min(tx, tz);
    for (let k = 0; k < K; k++) {
      const d = d0 + (Rmax - d0) * Math.pow(k / (K - 1), 2.2), x = cx + ux * d, z = cz + uz * d, v = (a * K + k) * 3;
      const y = k === 0 ? owH(x, z) - 0.05 : lerp(owH(cx + ux * d0, cz + uz * d0), luFarHeight(x, z), owSmoothstep(0, 1, k / 3));
      pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
      c.setHex(LUC.regolith).lerp(_luCol2.setHex(LUC.regolithDark), 0.3 + (owNoise(x / 900, z / 900) - 0.5) * 0.6).convertSRGBToLinear();
      col[v] = c.r; col[v + 1] = c.g; col[v + 2] = c.b;
    }
  }
  for (let a = 0; a < A; a++) {
    const b = (a + 1) % A;
    for (let k = 0; k < K - 1; k++) {
      const p0 = a * K + k, p1 = b * K + k, p2 = a * K + k + 1, p3 = b * K + k + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, luSunify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })));
  m.name = 'horizon'; m.frustumCulled = false; m.receiveShadow = false;
  root.add(m);
}

/* ---- Lumière : le Soleil (fixe), un reflet très faible de la Terre et du sol dans l'ombre, la lampe
   du casque (toujours allumée : dans l'ombre, c'est elle qui montre le chemin). */
function luApplyLight() {
  const sun = OW.sunLight, dir = luDir(LU.sun.az, LU.sun.el, LU._sunDir || (LU._sunDir = new THREE.Vector3()));
  const tx = OW.shadowT || 1, cx = Math.round(camera.position.x / tx) * tx, cz = Math.round(camera.position.z / tx) * tx;
  sun.target.position.set(cx, camera.position.y, cz);
  sun.position.copy(sun.target.position).addScaledVector(dir, 320);
  sun.target.updateMatrixWorld();
  // dehors : la lumière cendrée (Terre) et le régolithe ; dans la base, la lumière des plafonniers renvoyée par le sol
  if (HEMI) { HEMI.color.setHex(LU.inside ? 0xc9ced6 : 0x6d7d9a).convertSRGBToLinear(); HEMI.groundColor.setHex(LU.inside ? 0x8a8780 : 0x3b3a38).convertSRGBToLinear(); HEMI.intensity = LU.inside ? 0.42 : 0.085; }
  // sans air : pas de brouillard (une trace pour garder le calcul du jeu)
  scene.fog.density = 0.000012;
  scene.fog.color.setRGB(0, 0, 0);
  if (scene.background && scene.background.isColor) scene.background.setRGB(0, 0, 0);
  renderer.toneMappingExposure = 1.0;
  if (MOON) MOON.visible = false;
  LUS.on.value = 1;
}
/* Lampe du casque : un projecteur qui suit la caméra. */
function luHelmetLamp() {
  if (LU.lamp) return LU.lamp;
  const L = new THREE.SpotLight(0xe8f0ff, 2.6, 46, 0.62, 0.55, 1.4);
  L.name = 'lampe du casque';
  L.castShadow = false;
  LU.lamp = L;
  return L;
}
function luLampFollow() {
  const L = LU.lamp;
  if (!L || !L.parent) return;
  L.position.copy(camera.position);
  camera.getWorldDirection(LU._ld || (LU._ld = new THREE.Vector3()));
  L.target.position.copy(L.position).addScaledVector(LU._ld, 10);
  L.target.updateMatrixWorld();
  // éteinte au soleil (inutile), pleine dans l'ombre
  const lit = luSunAt(camera.position.x, camera.position.y - 1, camera.position.z);
  L.intensity = LU.inside ? 0 : 2.8 * (1 - 0.85 * lit);
}
