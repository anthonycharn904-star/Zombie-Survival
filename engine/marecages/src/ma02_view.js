
/* --------------------------------------------------------------- Le plan --
   Carte d'état-major délavée : l'eau sombre (plus claire sur les hauts-fonds), les îles en vert
   mousse avec leur relief, les chenaux, La Fosse en noir ; vignette (sans terrain) : les îles en
   aplats d'après leurs contours. */
function maPlanCanvas(w, h, opts = {}) {
  const c = makeCanvas(w, h);
  maPlanDraw(c, opts, null);
  return c;
}
function maPlanDraw(c, opts = {}, clip = null) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const W = 1000, s = Math.min(w / W, h / W), ox = (w - W * s) / 2, oz = (h - W * s) / 2;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  const relief = opts.relief && OW.H && OW.worldId === 'marais';
  const x0 = clip ? clip[0] : 0, y0 = clip ? clip[1] : 0, x1 = clip ? clip[2] : w, y1 = clip ? clip[3] : h;
  const img = g.getImageData(x0, y0, x1 - x0, y1 - y0), d = img.data, iw = x1 - x0;
  const water = [24, 34, 31], shallow = [44, 56, 46], land = [62, 72, 46], high = [96, 98, 66], mud = [70, 62, 44];
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const x = (px - ox) / s, z = (py - oz) / s, q = ((py - y0) * iw + (px - x0)) * 4;
      let col;
      if (x < -300 || z < -300 || x > 1300 || z > 1300) col = [12, 16, 14];
      else {
        let hh;
        if (relief) hh = owH(x, z);
        else {
          // sans terrain : îles d'après leurs contours, un relief approché
          let best = 9;
          for (const I of MA.islands) { if (Math.abs(x - I.x) < I.r * 1.8 && Math.abs(z - I.z) < I.r * 1.8) best = Math.min(best, maIslandQ(I, x, z)); }
          hh = best < 1 ? 0.2 + (1 - best) * 2.2 : best < 1.6 ? lerp(0.1, -1.2, (best - 1) / 0.6) : -4;
          const F = MA.fosse, fd = Math.hypot(x - F.x, z - F.z) / F.r;
          if (fd < 1) hh = Math.min(hh, -16 + fd * 10);
        }
        if (hh >= 0) { const k = clamp(hh / 3.5, 0, 1); col = hh < 0.35 ? mud : [lerp(land[0], high[0], k), lerp(land[1], high[1], k), lerp(land[2], high[2], k)]; }
        else { const k = clamp(-hh / 6, 0, 1); col = [lerp(shallow[0], water[0], k), lerp(shallow[1], water[1], k), lerp(shallow[2], water[2], k)]; if (hh < -12) col = [10, 14, 13]; }
        // grain du papier
        const gr = (owNoise(px * 0.9, py * 0.9) - 0.5) * 10;
        col = [col[0] + gr, col[1] + gr, col[2] + gr * 0.8];
        // hors de l'archipel : la brume (plus pâle)
        const [bx0, bz0, bx1, bz1] = MA.bound, out = Math.max(bx0 - x, x - bx1, bz0 - z, z - bz1);
        if (out > 0) { const k = clamp(out / 120, 0, 0.7); col = [lerp(col[0], 40, k), lerp(col[1], 46, k), lerp(col[2], 42, k)]; }
      }
      d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2]; d[q + 3] = 255;
    }
  }
  g.putImageData(img, x0, y0);
  // hauts-fonds en pointillés, La Fosse cerclée
  g.save();
  if (clip) { g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); }
  g.setLineDash([3 * Math.max(1, s * 2), 3 * Math.max(1, s * 2)]); g.strokeStyle = 'rgba(160,170,120,0.45)'; g.lineWidth = Math.max(1, s * 1.5);
  for (const B of MA.bars) { g.beginPath(); B.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); }
  g.setLineDash([]);
  g.strokeStyle = 'rgba(120,20,16,0.6)'; g.lineWidth = Math.max(1, s * 2);
  g.beginPath(); g.arc(X(MA.fosse.x), Z(MA.fosse.z), MA.fosse.r * s * 0.7, 0, TAU); g.stroke();
  if (opts.pins !== false && opts.places !== false) {
    g.font = `700 ${Math.max(10, Math.round(14 * s * 1.6))}px ${typeof FONT_HUD !== 'undefined' ? FONT_HUD : 'sans-serif'}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const L of MA.locs) {
      const r = Math.max(7, 10 * s * 1.6);
      g.fillStyle = L.id === 'F' ? '#5a1410' : '#a8432a'; g.beginPath(); g.arc(X(L.x), Z(L.z), r, 0, TAU); g.fill();
      g.fillStyle = '#fff4e2'; g.fillText(L.id === 'F' ? '?' : L.id, X(L.x), Z(L.z) + 1);
    }
  }
  g.restore();
}
function maThumb(base) {
  const M = OPEN_BASES[base] || MARAIS;
  if (!M.thumb) {
    try {
      const c = makeCanvas(640, 360), g = c.getContext('2d');
      // vignette : le plan, cadré sur l'archipel, sous un voile de brume ; la lune
      const p = maPlanCanvas(1000, 1000, { pins: base === 'marais', places: base === 'marais', base });
      g.drawImage(p, 150, 120, 760, 428, 0, 0, 640, 360);
      const grd = g.createRadialGradient(470, 70, 10, 470, 70, 420);
      grd.addColorStop(0, 'rgba(190,200,180,0.35)'); grd.addColorStop(0.25, 'rgba(60,72,64,0.25)'); grd.addColorStop(1, 'rgba(10,14,12,0.55)');
      g.fillStyle = grd; g.fillRect(0, 0, 640, 360);
      M.thumb = c.toDataURL('image/jpeg', 0.86);
    } catch (e) { M.thumb = null; }
  }
  return M.thumb;
}
/* Protection du relief (Mod Tools) : les îles et leurs berges, La Fosse. */
function maProtect(id, put) {
  if (OW_BASES[id] && OW_BASES[id].places) {
    for (const I of MA.islands) {
      const m = I.r * 1.9;
      owEachPoint(I.x - m, I.z - m, I.x + m, I.z + m, (k, x, z) => put(k, owSmoothstep(1.05, 1.6, maIslandQ(I, x, z))));
    }
  }
  const F = MA.fosse;
  owEachPoint(F.x - F.r * 1.6, F.z - F.r * 1.6, F.x + F.r * 1.6, F.z + F.r * 1.6, (k, x, z) => put(k, owSmoothstep(F.r, F.r * 1.5, Math.hypot(x - F.x, z - F.z))));
  owEachPoint(OW.X0, OW.Z0, OW.X0 + (OW.NX - 1) * OW.STEP, OW.Z0 + (OW.NZ - 1) * OW.STEP, (k, x, z) => { if (x < 4 || z < 4 || x > 996 || z > 996) put(k, 0); });
}

/* -------------------------------------------------------------- Le ciel --
   Nuit voilée : zénith presque noir, horizon de brume verdâtre (la couleur du brouillard), lune
   basse derrière des nuages minces (halo, liseré clair sur les bords des nuages), rares étoiles dans
   les trouées. Le ciel suit la caméra ; la lune est la lumière directionnelle (ombres). */
function maDir(az, el, out = new THREE.Vector3()) {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}
function maBuildSky(root) {
  const fogC = new THREE.Color(MA.fog.sky).convertSRGBToLinear();          // le ciel est rendu en linéaire, le brouillard en couleur d'écran
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMoon: { value: maDir(MA.moon.az, MA.moon.el) }, uTime: { value: 0 }, uHorizon: { value: new THREE.Vector3(fogC.r, fogC.g, fogC.b) }, uDread: { value: 0 },
      uRain: { value: 0 }, uFlash: { value: new THREE.Vector4(0, 1, 0, 0) }, uFlashC: { value: new THREE.Vector3(1, 1, 1) } },     // kit 2.0.7 : ciel d'averse, éclairs (ma17, ma18)
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uMoon; uniform float uTime; uniform vec3 uHorizon; uniform float uDread; uniform float uRain; uniform vec4 uFlash; uniform vec3 uFlashC; varying vec3 vDir;',
      'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }',
      'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }',
      'void main(){',
      '  vec3 d = normalize(vDir);',
      '  float up = clamp(d.y, -0.2, 1.0);',
      // dégradé : brume à l'horizon (couleur du brouillard), zénith presque noir
      '  vec3 zen = vec3(0.006, 0.010, 0.012);',
      '  vec3 c = mix(uHorizon, zen, smoothstep(-0.02, 0.55, up));',
      '  c = mix(c, uHorizon * 0.85, smoothstep(0.0, -0.2, d.y));',
      // nuages : couche plane projetée, dérive lente ; trouées
      '  vec2 cp = d.xz / max(0.08, d.y + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);',
      '  float cl = fbm(cp * 0.9);',
      '  float cover = mix(smoothstep(0.38, 0.72, cl), 1.0, uRain);',
      // lune voilée : disque, halo large, liseré des nuages vers la lune
      '  vec3 m = normalize(uMoon); float s = max(dot(d, m), 0.0);',
      '  float disc = smoothstep(0.99955, 0.99975, s);',
      '  float halo = pow(s, 160.0) * 0.55 + pow(s, 18.0) * 0.12 + pow(s, 4.0) * 0.03;',
      '  vec3 moonCol = vec3(0.78, 0.84, 0.80);',
      '  c += moonCol * halo * (1.0 - 0.55 * cover) * (1.0 - 0.9 * uRain);',
      '  c += moonCol * disc * 2.2 * (1.0 - 0.8 * cover) * (1.0 - uRain);',
      '  vec3 cloudCol = mix(vec3(0.020, 0.028, 0.026), vec3(0.20, 0.23, 0.21), pow(s, 12.0) * (1.0 - smoothstep(0.55, 0.85, cl)) * (1.0 - uRain));',
      // kit 2.0.7 : sous l'averse, une couche basse, sombre, aux grosses masses
      '  cloudCol = mix(cloudCol, vec3(0.014, 0.018, 0.018) * (0.7 + 0.6 * cl), uRain * 0.75);',
      '  c = mix(c, cloudCol + uHorizon * 0.25, cover * smoothstep(-0.02, 0.15, up) * 0.85);',
      // étoiles dans les trouées
      '  vec3 a = abs(d); vec2 g; float face;',
      '  if (a.x > a.y && a.x > a.z) { g = d.yz / a.x; face = d.x > 0.0 ? 1.0 : 2.0; } else if (a.y > a.z) { g = d.xz / a.y; face = d.y > 0.0 ? 3.0 : 4.0; } else { g = d.xy / a.z; face = d.z > 0.0 ? 5.0 : 6.0; }',
      '  vec2 cell = floor(g * 260.0) + face * 1000.0; float st = step(0.9975, h21(cell));',
      '  c += vec3(0.7, 0.75, 0.8) * st * (1.0 - cover) * smoothstep(0.15, 0.5, up) * 0.35 * h21(cell + 3.0) * (1.0 - uRain);',
      // kit 2.0.7 : l'éclair illumine les nuages de l'intérieur (plus fort de son côté ; leurs masses apparaissent)
      '  c += uFlashC * uFlash.w * (0.16 + 0.84 * pow(max(dot(d, uFlash.xyz), 0.0), 4.0)) * (0.3 + 1.1 * cl) * smoothstep(-0.1, 0.25, up);',
      // menace : le ciel se ferme, un peu plus vert, plus bas
      '  c = mix(c, uHorizon * 0.6, uDread * 0.35 * smoothstep(0.5, 0.0, up));',
      '  gl_FragColor = vec4(c, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <encodings_fragment>',
      '}',
    ].join('\n'),
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2300, 48, 24), mat);
  sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'ciel';
  OW.sky = sky;
  root.add(sky);
  const moon = new THREE.DirectionalLight(0xb4c6d0, 1.0);
  moon.name = 'lune';
  root.add(moon, moon.target);
  OW.sunLight = moon;
}
function maSkyFollow() {
  if (OW.sky) { OW.sky.position.copy(camera.position); OW.sky.material.uniforms.uTime.value = OW.t; }
}
/* Lumière, brouillard : constants, un peu plus épais et plus verts quand la bête est proche
   (MA.dread de 0 à 1, donné par la menace). Kit 2.0.7 : sous l'averse (ma17), la lune s'efface derrière les
   nuages, le brouillard s'épaissit ; l'éclair (ma18) devient la lumière de la scène le temps de ses arcs (sa
   direction, ses ombres), la brume et le ciel s'allument. */
const _maFog = new THREE.Color(), _maFog2 = new THREE.Color(), _maL = new THREE.Vector3(), _maC = new THREE.Color();
function maApplyLight() {
  const sun = OW.sunLight, dir = maDir(MA.moon.az, MA.moon.el, MA._dir || (MA._dir = new THREE.Vector3()));
  const W = typeof MA_WX !== 'undefined' && MA_WX.ready ? MA_WX : null, F = W && typeof maStormFlash === 'function' ? maStormFlash() : null;
  const cov = W ? W.cover : 0, rain = W ? owSmoothstep(0.45, 1, cov) : 0, rI = W ? W.I : 0, fi = F ? F.i : 0, fa = F ? F.amb : 0;
  if (sun) {
    if (!MA._moonC) MA._moonC = sun.color.clone();
    const tx = OW.shadowT || 1, cx = Math.round(camera.position.x / tx) * tx, cz = Math.round(camera.position.z / tx) * tx;
    const base = 1.0 * (1 - 0.3 * (MA.dread || 0)) * (1 - MA_WXC.moonK * rain);
    _maL.copy(dir);
    if (fi > 0.001) _maL.multiplyScalar(base).addScaledVector(F.dir, fi).normalize();
    sun.target.position.set(cx, camera.position.y, cz);
    sun.position.copy(sun.target.position).addScaledVector(_maL, 320);
    sun.target.updateMatrixWorld();
    sun.intensity = base + fi;
    sun.color.copy(MA._moonC);
    if (fi > 0.001) sun.color.lerp(F.col, fi / (fi + base));
  }
  const dread = MA.dread || 0, inside = MA.inside || 0;
  if (HEMI) {
    HEMI.color.setHex(0x6a8076).convertSRGBToLinear();
    HEMI.groundColor.setHex(0x2c261d).convertSRGBToLinear();
    HEMI.intensity = 0.75 * (1 - 0.25 * dread) + 0.15 * inside - 0.1 * rain + fa * 0.55;     // l'éclair : surtout direct (des ombres)
    if (fa > 0.001) HEMI.color.lerp(F.col, Math.min(0.85, fa * 0.35));
  }
  // brouillard : couleur d'écran (r128 l'applique après le rendu des tons)
  _maFog.setHex(MA.fog.col).lerp(_maFog2.setHex(0x16241a), dread * 0.6);
  if (rain > 0) _maFog.lerp(_maFog2.setHex(0x161c1d), rain * 0.35);                 // l'averse grise la brume
  const red = fa > 0.001 && typeof maFlashRed === 'function' ? maFlashRed() : 0;          // (l'éclair rouge d'une Stryge, ma19)
  if (fa > 0.001) _maFog.lerp(_maC.setRGB(lerp(0.55, 0.62, red), lerp(0.6, 0.09, red), lerp(0.66, 0.1, red)), Math.min(0.8, fa * 0.22));      // l'éclair l'allume
  scene.fog.color.copy(_maFog);
  scene.fog.density = MA.fog.d * (1 + 0.45 * dread) * (MA.fogK || 1) * (1 + (W ? MA_WXC.fogK * rI : 0));
  if (!scene.background || !scene.background.isColor) scene.background = new THREE.Color();
  scene.background.copy(_maFog);
  if (OW.sky) {
    const u = OW.sky.material.uniforms;
    u.uDread.value = dread;
    if (u.uRain) {
      u.uRain.value = rain;
      if (F && F.sky > 0.001) { u.uFlash.value.set(F.dir.x, F.dir.y, F.dir.z, F.sky * (0.6 + Math.min(2.5, fa))); u.uFlashC.value.set(F.col.r, F.col.g, F.col.b).multiplyScalar(0.55); }
      else u.uFlash.value.w = 0;
      _maC.setHex(MA.fog.sky).convertSRGBToLinear().multiplyScalar(1 - 0.3 * rain);
      if (fa > 0.001) _maC.lerp(_maFog2.setRGB(lerp(0.3, 0.36, red), lerp(0.33, 0.05, red), lerp(0.38, 0.06, red)), Math.min(0.85, fa * 0.2));
      u.uHorizon.value.set(_maC.r, _maC.g, _maC.b);
    }
  }
  if (MA.terWet) MA.terWet.value = W ? W.wet : 0;
  renderer.toneMappingExposure = 1.25;
  if (MOON) MOON.visible = false;
}
