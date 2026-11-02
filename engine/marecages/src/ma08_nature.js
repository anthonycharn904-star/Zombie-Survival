
/* ------------------------------------------------------------ Végétation --
   Instanciée (une poignée de dessins pour tout le marais) :
     cyprès chauves   tronc évasé et contreforts, pneumatophores (« genoux ») autour du pied, houppier
                      en plaques de rameaux, barbe-de-vieillard (mousse espagnole) qui pend ; dense sur
                      la Futaie, en lisière des autres îles, debout dans l'eau peu profonde ;
     arbres morts     gris, branches nues, quelques lambeaux de mousse ; dans l'eau, sur l'Enlisée,
                      en forêt noyée au bord du monde (et en silhouettes dans la brume au-delà) ;
     roseaux, massettes, nénuphars (et quelques fleurs), fougères, souches, troncs flottants.
   Les troncs sont des solides (cases) : on ne les traverse ni à pied ni en barque. Le vent fait
   bouger la mousse, les roseaux et les feuilles (décalage des sommets dans le nuanceur). */
function maCardTexture(kind) {
  const W = 256, H = 256, c = makeCanvas(W, H), g = c.getContext('2d'), R = mulberry32(kind.length * 977);
  g.clearRect(0, 0, W, H);
  if (kind === 'feuilles') {
    // touffe de rameaux plumeux (aiguilles plates de part et d'autre du rameau), en masse arrondie
    // irrégulière ; vert olive sombre, pointes plus claires ; un rameau sur quatre roux (l'automne du cyprès)
    const cx = W / 2, cy = H * 0.5;
    for (let b = 0; b < 54; b++) {
      const a = R() * TAU, r0 = R() * W * 0.14, x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0 * 0.8;
      const L = W * (0.14 + R() * 0.22), dir = a + (R() - 0.5) * 0.8, rust = R() < 0.24, v = 0.85 + R() * 0.3;
      const col = rust ? [126 * v, 72 * v, 36 * v] : [50 * v, 68 * v, 30 * v], tip = rust ? [150, 96, 52] : [92, 108, 52];
      let px = x0, py = y0;
      for (let t = 0; t < 1; t += 0.05) {
        const ang = dir + t * 0.35, nx = px + Math.cos(ang) * L * 0.05, ny = py + Math.sin(ang) * L * 0.05 + t * 1.2;
        const c = mixc(col, tip, t * t), l = 12 * (1 - t * 0.55);
        g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.97)`; g.lineWidth = 2.4;
        for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(ang + sgn * 1.25) * l, ny + Math.sin(ang + sgn * 1.25) * l); g.stroke(); }
        g.strokeStyle = `rgba(${c[0] * 0.7 | 0},${c[1] * 0.7 | 0},${c[2] * 0.7 | 0},1)`; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
        px = nx; py = ny;
      }
    }
  } else if (kind === 'mousse') {
    // barbe-de-vieillard : mèches de filaments gris-vert qui pendent, effilées, en grappes
    for (let lock = 0; lock < 11; lock++) {
      const x0 = W * (0.05 + R() * 0.9), L = H * (0.4 + R() * 0.6), spread = 8 + R() * 18;
      for (let st = 0; st < 24; st++) {
        const x = x0 + (R() - 0.5) * spread, len = L * (0.45 + R() * 0.55), v = 118 + R() * 60;
        g.strokeStyle = `rgba(${v * 0.82 | 0},${v * 0.9 | 0},${v * 0.76 | 0},${0.5 + R() * 0.5})`; g.lineWidth = 0.8 + R() * 1.7;
        g.beginPath(); g.moveTo(x, 0);
        for (let y = 0; y < len; y += 6) g.lineTo(x + Math.sin(y * 0.055 + st) * 6 * (y / L) + (R() - 0.5) * 1.6, y);
        g.stroke();
      }
    }
  } else if (kind === 'roseaux') {
    // roseaux et massettes : brins effilés paille et olive, quelques épis bruns
    for (let i = 0; i < 110; i++) {
      const x = W * (0.06 + R() * 0.88), h = H * (0.4 + R() * 0.6), lean = (R() - 0.5) * 56, v = 0.75 + R() * 0.45;
      const c = R() < 0.42 ? [150 * v, 138 * v, 88 * v] : [96 * v, 110 * v, 58 * v];
      g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},1)`; g.lineWidth = 1.4 + R() * 2.4;
      g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.3, H - h * 0.5, x + lean, H - h); g.stroke();
      if (R() < 0.16) { g.fillStyle = 'rgb(82,54,32)'; g.beginPath(); g.ellipse(x + lean * 0.85, H - h * 0.85, 3.5, 13, lean * 0.004, 0, TAU); g.fill(); }
    }
  } else if (kind === 'herbes') {
    // touffe de laîches : brins longs et fins, arqués, vert olive et paille aux pointes
    for (let i = 0; i < 90; i++) {
      const x = W * (0.3 + R() * 0.4), h = H * (0.35 + R() * 0.62), lean = (R() - 0.5) * 140, v = 0.7 + R() * 0.5;
      const dry = R() < 0.35, c = dry ? [140 * v, 128 * v, 80 * v] : [74 * v, 90 * v, 44 * v];
      const grd = g.createLinearGradient(0, H, 0, H - h);
      grd.addColorStop(0, `rgb(${c[0] * 0.6 | 0},${c[1] * 0.6 | 0},${c[2] * 0.6 | 0})`); grd.addColorStop(1, `rgb(${Math.min(255, c[0] * 1.25) | 0},${Math.min(255, c[1] * 1.2) | 0},${c[2] | 0})`);
      g.strokeStyle = grd; g.lineWidth = 1.2 + R() * 2;
      g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.2, H - h * 0.6, x + lean, H - h * (0.8 + R() * 0.2)); g.stroke();
    }
  } else if (kind === 'nenuphar') {
    // feuille ronde échancrée, nervures ; en bas à droite, une fleur blanche
    const cx = 92, cy = 92, r = 84;
    g.fillStyle = 'rgb(56,78,38)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, 0.25, TAU - 0.15); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(96,120,60,0.8)'; g.lineWidth = 2;
    for (let a = 0.4; a < TAU - 0.2; a += 0.35) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); g.stroke(); }
    g.fillStyle = 'rgba(30,40,20,0.35)'; g.beginPath(); g.arc(cx + 20, cy - 16, r * 0.4, 0, TAU); g.fill();
    for (let p = 0; p < 12; p++) { const a = (p / 12) * TAU; g.fillStyle = p % 2 ? 'rgb(226,224,210)' : 'rgb(240,236,226)'; g.beginPath(); g.ellipse(200 + Math.cos(a) * 16, 200 + Math.sin(a) * 16, 9, 22, a + Math.PI / 2, 0, TAU); g.fill(); }
    g.fillStyle = 'rgb(220,190,80)'; g.beginPath(); g.arc(200, 200, 8, 0, TAU); g.fill();
  } else if (kind === 'fougere') {
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI / 2 + (f / 8 - 0.5) * 2.4, L = H * (0.45 + R() * 0.4), x0 = W / 2, y0 = H;
      g.strokeStyle = 'rgb(48,66,30)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke();
      for (let t = 0.1; t < 1; t += 0.05) {
        const px = x0 + Math.cos(a) * L * t, py = y0 + Math.sin(a) * L * t, l = 22 * Math.sin(Math.PI * t);
        g.strokeStyle = `rgb(${58 + R() * 20 | 0},${82 + R() * 24 | 0},${36 + R() * 10 | 0})`; g.lineWidth = 3;
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + s * 1.3) * l, py + Math.sin(a + s * 1.3) * l); g.stroke(); }
      }
    }
  }
  const t = toTex(c, { clamp: true });
  t.anisotropy = 4;
  return t;
}
const MAV = { mats: null, meshes: [], sway: { value: 0 } };
function maVegMats() {
  if (MAV.mats) return MAV.mats;
  // cartes (rameaux, mousse, roseaux, fougères) : les normales viennent de la géométrie (vers le haut
  // et vers l'extérieur de la plante) et valent des deux côtés : la touffe est éclairée comme un volume,
  // jamais noire de dos
  const NOFLIP = THREE.ShaderChunk.normal_fragment_begin.split('normal = normal * faceDirection;').join('');
  const sway = (mat, amp, base) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSway = MAV.sway;
      sh.vertexShader = 'uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '#ifdef USE_INSTANCING',
        '  vec3 maIp = instanceMatrix[3].xyz;',
        '#else',
        '  vec3 maIp = vec3(0.0);',
        '#endif',
        `  float maK = max(0.0, position.y - ${base.toFixed(2)});`,
        `  transformed.x += sin(uSway * 1.3 + maIp.x * 0.31 + maIp.z * 0.17 + position.y * 0.6) * ${amp.toFixed(3)} * maK;`,
        `  transformed.z += cos(uSway * 1.1 + maIp.z * 0.29 + position.y * 0.5) * ${(amp * 0.7).toFixed(3)} * maK;`,
      ].join('\n'));
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', NOFLIP);
    };
    mat.customProgramCacheKey = () => 'marais-veg2-' + amp + '-' + base;
    return mat;
  };
  const card = (tex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 }, o));
  // écorce des arbres : la texture de la bibliothèque, répétée le long du tronc (2 fois autour, 8 fois en hauteur)
  const barkTex = (() => { const src = TEX_ma('ma_bark'); if (!src) return null; const t = src.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 8); return share(t); })();
  MAV.mats = {
    bark: share(new THREE.MeshStandardMaterial({ map: barkTex, color: 0x9a8a78, roughness: 0.96, metalness: 0 })),
    dead: share(new THREE.MeshStandardMaterial({ map: barkTex, color: 0xa8a49a, roughness: 0.94, metalness: 0 })),
    leaves: share(sway(card(share(maCardTexture('feuilles')), { color: 0xd0d4c4 }), 0.012, 6)),
    moss: share(sway(card(share(maCardTexture('mousse')), { color: 0xc4ccb8, alphaTest: 0.35 }), 0.05, -3)),
    reeds: share(sway(card(share(maCardTexture('roseaux'))), 0.06, 0.2)),
    pad: share(new THREE.MeshStandardMaterial({ map: share(maCardTexture('nenuphar')), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.55, metalness: 0 })),
    fern: share(sway(card(share(maCardTexture('fougere')), { color: 0xc8ccbc }), 0.03, 0.1)),
    grass: share(sway(card(share(maCardTexture('herbes')), { color: 0xc8c8b8, alphaTest: 0.38 }), 0.05, 0.05)),
  };
  for (const k in MAV.mats) linearize(MAV.mats[k]);
  // ombres découpées des feuillages (le carré de la carte ne doit pas faire d'ombre)
  MAV.depth = {};
  for (const k of ['leaves', 'moss', 'reeds', 'fern']) {
    const m = MAV.mats[k];
    MAV.depth[k] = share(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: m.alphaTest, side: THREE.DoubleSide }));
  }
  return MAV.mats;
}
/* Texture d'une matière du kit (bibliothèque du jeu) pour les troncs. */
function TEX_ma(id) {
  const m = levelMaterial(id);
  return m && m.map ? m.map : null;
}
/* ---- Géométries des modèles (un BufferGeometry par matière et par variante) */
function maGeoPush(arr, geo, m) { const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m); arr.push(g); return g; }
function maMergeList(list) { const I = new THREE.Matrix4(), g = mergeGeometries(list.map((geo) => ({ geo, matrix: I }))); for (const x of list) x.dispose(); return g; }
/* Normales des cartes : fn(x, y, z, out) donne la normale (non normalisée) de chaque sommet. */
function maCardNormals(geo, fn) {
  const P = geo.attributes.position, N = geo.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    fn(P.getX(i), P.getY(i), P.getZ(i), v);
    v.normalize();
    N.setXYZ(i, v.x, v.y, v.z);
  }
  N.needsUpdate = true;
  return geo;
}
/* Cyprès chauve : h hauteur, R hasard. Pied très évasé (contreforts cannelés) au ras de l'eau, fût
   droit qui s'effile, couronne aplatie et irrégulière de touffes de rameaux, barbe-de-vieillard qui
   pend des branches, genoux autour du pied. */
function maCypressGeo(h, R, lite) {
  const bark = [], leaves = [], moss = [];
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, y = -1.2 + t * (h * 0.96 + 1.2);
    const r = 0.44 * (1 - t * 0.72) + 1.15 * Math.exp(-Math.max(0, y + 0.9) / 1.05);
    pts.push(new THREE.Vector2(Math.max(0.07, r), y));
  }
  const trunk = new THREE.LatheGeometry(pts, lite ? 8 : 14);
  // contreforts : le rayon ondule avec l'angle (six côtes), d'autant plus fort que l'on est bas
  { const p = trunk.attributes.position, ph = R() * 6; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.34 * Math.sin(a * 6 + ph) * Math.exp(-Math.max(0, y + 0.6) / 1.3) + 0.05 * Math.sin(a * 3 + y * 0.4 + ph); p.setX(i, x * k); p.setZ(i, z * k); } trunk.computeVertexNormals(); }
  maGeoPush(bark, trunk, new THREE.Matrix4());
  trunk.dispose();
  const crownY = h * 0.72;
  const leafN = (x, y, z, v) => v.set(x, (y - crownY) * 0.5, z).normalize().multiplyScalar(0.8).add(_maUp);
  const clump = (x, y, z, s, a0) => {
    // une touffe : trois cartes croisées et une à plat
    for (let c = 0; c < 3; c++) {
      const pl = new THREE.PlaneGeometry(s * 1.25, s * 0.85);
      const m = new THREE.Matrix4().makeRotationY(a0 + c * (Math.PI / 3)).multiply(new THREE.Matrix4().makeRotationX((R() - 0.5) * 0.5));
      m.setPosition(x, y, z);
      maCardNormals(maGeoPush(leaves, pl, m), leafN);
      pl.dispose();
    }
    const fl = new THREE.PlaneGeometry(s * 1.2, s * 1.0); fl.rotateX(-Math.PI / 2);
    const m = new THREE.Matrix4().makeRotationY(a0); m.setPosition(x, y + s * 0.12, z);
    maCardNormals(maGeoPush(leaves, fl, m), leafN);
    fl.dispose();
  };
  const hang = (x, y, z, L, w) => {
    const mq = new THREE.PlaneGeometry(w, L); mq.translate(0, -L / 2, 0);
    for (const rot of [R() * Math.PI, null]) {
      const m = new THREE.Matrix4().makeRotationY(rot === null ? R() * Math.PI + Math.PI / 2 : rot); m.setPosition(x, y, z);
      maCardNormals(maGeoPush(moss, mq, m), (px, py, pz, v) => v.set(px, 0, pz).normalize().add(_maUp35));
    }
    mq.dispose();
  };
  // branches : de 40 % à 95 % de la hauteur, plus longues en bas ; elles montent puis retombent
  const nb = lite ? 7 : 13;
  for (let i = 0; i < nb; i++) {
    const t = 0.4 + 0.55 * (i / nb) + (R() - 0.5) * 0.04, y = h * t, a = R() * TAU, L = (2.2 + R() * 2.8) * (1.25 - t * 0.7);
    const mx = Math.cos(a) * L * 0.55, mz = Math.sin(a) * L * 0.55, my = y + L * 0.35;
    const ex = Math.cos(a) * L, ez = Math.sin(a) * L, ey = y + L * 0.28 - 0.3;
    const r0 = 0.12 * (1.2 - t * 0.6);
    for (const [ax, ay, az, bx, by, bz, w] of [[0, y, 0, mx, my, mz, r0], [mx, my, mz, ex, ey, ez, r0 * 0.6]]) {
      const br = new THREE.CylinderGeometry(0.5, 1, 1, 6).rotateZ(-Math.PI / 2);   // axe le long de x (beamMtx)
      maGeoPush(bark, br, beamMtx(ax, ay, az, bx, by, bz, w, w));
      br.dispose();
    }
    // touffes au bout et au milieu de la branche
    const s = (2.4 + R() * 1.4) * (1.1 - t * 0.35);
    clump(ex, ey + 0.2, ez, s, a);
    if (!lite || i % 2) clump(mx, my + 0.3, mz, s * 0.8, a + 1.1);
    // mousse qui pend
    if (!lite) {
      if (R() < 0.85) hang(lerp(mx, ex, 0.5), lerp(my, ey, 0.5) - 0.2, lerp(mz, ez, 0.5), 2.2 + R() * 2.6, 1.0 + R() * 0.7);
      if (R() < 0.5) hang(mx * 0.6, my - 0.1, mz * 0.6, 1.5 + R() * 2, 0.8 + R() * 0.5);
    }
  }
  // cime et touffes le long du haut du fût
  clump(0, h * 0.97, 0, 2.6, R() * TAU);
  if (!lite) for (let i = 0; i < 3; i++) clump(Math.cos(i * 2.1) * 0.6, h * (0.8 + i * 0.05), Math.sin(i * 2.1) * 0.6, 2.2, R() * TAU);
  // genoux (pneumatophores) autour du pied
  if (!lite) for (let i = 0; i < 7; i++) {
    const a = R() * TAU, d = 1.7 + R() * 2.4, kh = 0.35 + R() * 0.75, cone = new THREE.ConeGeometry(0.13 + R() * 0.09, kh, 6);
    cone.translate(0, kh / 2 - 0.25, 0);
    maGeoPush(bark, cone, new THREE.Matrix4().makeTranslation(Math.cos(a) * d, -0.15, Math.sin(a) * d));
    cone.dispose();
  }
  return { bark: maMergeList(bark), leaves: maMergeList(leaves), moss: moss.length ? maMergeList(moss) : null };
}
const _maUp = new THREE.Vector3(0, 1, 0), _maUp35 = new THREE.Vector3(0, 0.35, 0);
/* Arbre mort : tronc gris, branches nues tordues, lambeaux de mousse. */
function maDeadGeo(h, R, lite) {
  const bark = [], moss = [];
  const tr = new THREE.CylinderGeometry(0.12, 0.38, h, lite ? 6 : 8, 4);
  { const p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 0.7 + R()) * 0.12); } tr.computeVertexNormals(); }
  tr.translate(0, h / 2 - 0.4, 0);
  maGeoPush(bark, tr, new THREE.Matrix4());
  tr.dispose();
  const nb = lite ? 3 : 6;
  for (let i = 0; i < nb; i++) {
    const y = h * (0.45 + 0.5 * R()), a = R() * TAU, L = 1.2 + R() * 2.6, up = 0.6 + R() * 1.6;
    const bx = Math.cos(a) * L, bz = Math.sin(a) * L;
    const br = new THREE.CylinderGeometry(0.35, 1, 1, 5).rotateZ(-Math.PI / 2);
    maGeoPush(bark, br, beamMtx(0, y, 0, bx, y + up, bz, 0.1, 0.1));
    if (!lite) { const tw = new THREE.CylinderGeometry(0.3, 1, 1, 4).rotateZ(-Math.PI / 2); maGeoPush(bark, tw, beamMtx(bx, y + up, bz, bx * 1.3 + (R() - 0.5), y + up + 0.6 + R(), bz * 1.3 + (R() - 0.5), 0.035, 0.035)); tw.dispose(); }
    br.dispose();
    if (!lite && R() < 0.5) { const ml = 1 + R() * 1.6, mq = new THREE.PlaneGeometry(0.7, ml); mq.translate(0, -ml / 2, 0); const m = new THREE.Matrix4().makeRotationY(R() * Math.PI); m.setPosition(bx * 0.7, y + up * 0.7, bz * 0.7); maCardNormals(maGeoPush(moss, mq, m), (px, py, pz, v) => v.set(px, 0, pz).normalize().add(_maUp35)); mq.dispose(); }
  }
  return { bark: maMergeList(bark), moss: moss.length ? maMergeList(moss) : null };
}
function maReedGeo() {
  const list = [];
  for (let c = 0; c < 3; c++) { const pl = new THREE.PlaneGeometry(1.6, 1.9); pl.translate(0, 0.95 - 0.15, 0); maCardNormals(maGeoPush(list, pl, new THREE.Matrix4().makeRotationY((c / 3) * Math.PI)), (x, y, z, v) => v.set(x * 0.35, 1, z * 0.35)); pl.dispose(); }
  return maMergeList(list);
}
function maFernGeo() {
  const list = [];
  for (let c = 0; c < 2; c++) { const pl = new THREE.PlaneGeometry(1.4, 1.1); pl.translate(0, 0.5, 0); maCardNormals(maGeoPush(list, pl, new THREE.Matrix4().makeRotationY(c * Math.PI / 2 + 0.4)), (x, y, z, v) => v.set(x * 0.3, 1, z * 0.3)); pl.dispose(); }
  return maMergeList(list);
}
function maGrassGeo() {
  const list = [];
  for (let c = 0; c < 2; c++) { const pl = new THREE.PlaneGeometry(1.3, 0.9); pl.translate(0, 0.42, 0); maCardNormals(maGeoPush(list, pl, new THREE.Matrix4().makeRotationY(c * Math.PI / 2 + 0.3)), (x, y, z, v) => v.set(x * 0.3, 1, z * 0.3)); pl.dispose(); }
  return maMergeList(list);
}
function maPadGeo() {
  const pl = new THREE.PlaneGeometry(1, 1);
  pl.rotateX(-Math.PI / 2);
  return pl;
}
/* ---- Placement : liste [x, y, z, rotation, échelle] par modèle. Les instances sont rangées par cases
   de 160 m : une InstancedMesh par case, avec sa sphère englobante (la géométrie est partagée, ses
   tampons aussi) : le moteur écarte les cases hors du champ et des ombres ; maNatureUpdate cache celles
   que la brume avale (au-delà de 330 m). */
const MA_VEG_CELL = 160;
function maInst(root, geo, mat, list, name, shadow, depth) {
  if (!list.length || !geo) return null;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const gr = geo.boundingSphere.radius + geo.boundingSphere.center.length();
  const cells = new Map();
  for (const e of list) {
    const k = Math.floor(e[0] / MA_VEG_CELL) + ',' + Math.floor(e[2] / MA_VEG_CELL);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(e);
  }
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const out = [];
  for (const [k, L] of cells) {
    const g = new THREE.BufferGeometry();
    for (const a in geo.attributes) g.setAttribute(a, geo.attributes[a]);
    if (geo.index) g.setIndex(geo.index);
    // sphère : les pieds des instances, plus la taille du modèle à la plus grande échelle
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, smax = 0;
    for (const e of L) { x0 = Math.min(x0, e[0]); x1 = Math.max(x1, e[0]); y0 = Math.min(y0, e[1]); y1 = Math.max(y1, e[1]); z0 = Math.min(z0, e[2]); z1 = Math.max(z1, e[2]); smax = Math.max(smax, e[4] * (e[7] || 1)); }
    const c = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    g.boundingSphere = new THREE.Sphere(c, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + gr * smax);
    const m = new THREE.InstancedMesh(g, mat, L.length);
    L.forEach((e, i) => {
      q.setFromAxisAngle(Y, e[3]);
      if (e[5]) { const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[5], 0, e[6] || 0)); q.multiply(tilt); }
      S.setScalar(e[4]); if (e[7]) S.y *= e[7];
      P.set(e[0], e[1], e[2]);
      M.compose(P, q, S);
      m.setMatrixAt(i, M);
    });
    m.instanceMatrix.needsUpdate = true;
    m.name = name + ' ' + k; m.castShadow = !!shadow; m.receiveShadow = true;
    if (shadow && depth) m.customDepthMaterial = depth;
    m.frustumCulled = true;
    root.add(m);
    MAV.meshes.push(m);
    out.push(m);
  }
  return out;
}
/* La brume avale tout au-delà de ~300 m : cases de végétation et morceaux de terrain cachés (4 fois par seconde). */
function maFogCull(dt, force) {
  MAV.cullT = (MAV.cullT || 0) - dt;
  if (MAV.cullT > 0 && !force) return;
  MAV.cullT = 0.25;
  const cx = camera.position.x, cz = camera.position.z, R = CUR.editor ? 1e9 : 330 * (MA.fogK ? 1 / MA.fogK : 1);   // Mod Tools : tout
  for (const m of MAV.meshes) { const s = m.geometry.boundingSphere; m.visible = Math.hypot(s.center.x - cx, s.center.z - cz) - s.radius < R; }
  const S = OWTER.size;
  for (const ch of OWTER.chunks) {
    const dx = Math.max(ch.x0 - cx, 0, cx - (ch.x0 + S)), dz = Math.max(ch.z0 - cz, 0, cz - (ch.z0 + S));
    ch.mesh.visible = Math.hypot(dx, dz) < R;
  }
}
function maBuildNature(root, places) {
  const Q = settings.quality, k = Q === 'low' ? 0.5 : Q === 'high' ? 1.2 : 0.85;
  const mats = maVegMats(), R = mulberry32(7351);
  MAV.meshes = [];
  // zones à éviter (bâtiments, pontons, allées) : cases qui ne sont pas du terrain
  const free = (x, z, pad = 1) => {
    for (let dz = -pad; dz <= pad; dz++) for (let dx = -pad; dx <= pad; dx++) if (owKind(OW.surf, Math.floor(x) + dx, Math.floor(z) + dz) !== OWK.TERRAIN) return false;
    return true;
  };
  const near = (x, z, r) => { for (const I of MA.islands) if (Math.hypot(x - I.x, z - I.z) < r) return true; return false; };
  const spawn = MA.spawn.pos;
  // ---- cyprès (trois variantes) et arbres morts (deux variantes)
  const CV = [maCypressGeo(18, mulberry32(11)), maCypressGeo(14, mulberry32(12)), maCypressGeo(22, mulberry32(13))];
  const CL = maCypressGeo(19, mulberry32(14), true);                 // silhouettes lointaines
  const DV = [maDeadGeo(12, mulberry32(21)), maDeadGeo(8, mulberry32(22))];
  const DL = maDeadGeo(11, mulberry32(23), true);
  const cyp = [[], [], []], cypFar = [], dead = [[], []], deadFar = [];
  const trunkCell = (x, z, y, h) => owSet(OW.surf, Math.floor(x), Math.floor(z), OWK.SOLID, { base: y - 1, top: y + h, mat: OWM.WOOD });
  // kit 2.0.7 : les arbres de la carte (pied, hauteur de la cime) : la foudre les frappe (ma18), la pluie s'y entend (ma17)
  MA.trees = [];
  const CH = [18, 14, 22], DH = [12, 8];
  const tryTree = (x, z, kind) => {
    const g = owH(x, z), dep = MA.water - g;
    if (dep > 1.4) return false;
    if (!free(x, z, 2)) return false;
    if (Math.hypot(x - spawn[0], z - spawn[1]) < 9) return false;
    const y = g, s = 0.75 + R() * 0.55, rot = R() * TAU;
    if (kind === 'c') { const v = (R() * 3) | 0; cyp[v].push([x, y, z, rot, s]); trunkCell(x, z, y, 6); MA.trees.push({ x, z, y, h: CH[v] * 0.96 * s }); }
    else { const v = (R() * 2) | 0; dead[v].push([x, y, z, rot, s, (R() - 0.5) * 0.18, (R() - 0.5) * 0.18]); trunkCell(x, z, y, 4); MA.trees.push({ x, z, y, h: (DH[v] - 0.4) * s, dead: true }); }
    return true;
  };
  // la Futaie : forêt dense (sauf la clairière de la cabane et de la scierie)
  const B = MA.islands[1];
  for (let i = 0, n = Math.round(260 * k); i < n; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * B.r * 1.3, x = B.x + Math.cos(a) * r * B.ex, z = B.z + Math.sin(a) * r * B.ez;
    if (Math.hypot(x - 268, z - 566) < 22) continue;
    tryTree(x, z, R() < 0.88 ? 'c' : 'd');
  }
  // lisières des autres îles et eau peu profonde autour
  for (const I of MA.islands) {
    if (I.id === 'B') continue;
    const n = Math.round((I.id === 'D' ? 70 : I.id === 'E' ? 22 : 55) * k);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, q = 0.75 + R() * 0.5, x = I.x + Math.cos(a) * I.r * q * (I.ex || 1), z = I.z + Math.sin(a) * I.r * q * (I.ez || 1);
      tryTree(x, z, I.id === 'D' ? (R() < 0.7 ? 'd' : 'c') : R() < 0.75 ? 'c' : 'd');
    }
  }
  // arbres noyés en eau libre peu profonde (le long des bancs, au bord du monde)
  for (let i = 0, n = Math.round(420 * k); i < n; i++) {
    const x = rand(80, 920), z = rand(80, 920), d = maDepth(x, z);
    if (d < 0.2 || d > 1.3) continue;
    tryTree(x, z, R() < 0.55 ? 'd' : 'c');
  }
  // au-delà du bord : forêt noyée, silhouettes dans la brume (sans solides)
  for (let i = 0, n = Math.round(700 * k); i < n; i++) {
    const a = R() * TAU, r = 470 + R() * 330, x = 500 + Math.cos(a) * r, z = 500 + Math.sin(a) * r;
    const g = owH(x, z);
    if (MA.water - g > 1.6) continue;
    (R() < 0.55 ? cypFar : deadFar).push([x, g, z, R() * TAU, 0.8 + R() * 0.7, (R() - 0.5) * 0.2, (R() - 0.5) * 0.2]);
  }
  for (let v = 0; v < 3; v++) {
    maInst(root, CV[v].bark, mats.bark, cyp[v], 'cyprès ' + v, true);
    maInst(root, CV[v].leaves, mats.leaves, cyp[v], 'cyprès ' + v + ' rameaux', true, MAV.depth.leaves);
    if (CV[v].moss) maInst(root, CV[v].moss, mats.moss, cyp[v], 'cyprès ' + v + ' mousse', false);
  }
  for (let v = 0; v < 2; v++) {
    maInst(root, DV[v].bark, mats.dead, dead[v], 'arbre mort ' + v, true);
    if (DV[v].moss) maInst(root, DV[v].moss, mats.moss, dead[v], 'arbre mort ' + v + ' mousse', false);
  }
  maInst(root, CL.bark, mats.bark, cypFar, 'cyprès lointains', false);
  maInst(root, CL.leaves, mats.leaves, cypFar, 'cyprès lointains rameaux', false);
  maInst(root, DL.bark, mats.dead, deadFar, 'arbres morts lointains', false);
  // ---- roseaux : berges, bancs, hauts-fonds (touffes)
  const reeds = [];
  for (let i = 0, n = Math.round(5200 * k); i < n; i++) {
    const x = rand(90, 910), z = rand(90, 910), d = maDepth(x, z);
    if (d < -0.15 || d > 1.35) continue;
    if (!free(x, z, 0)) continue;
    if (owNoise(x / 11, z / 11) < 0.42) continue;
    reeds.push([x, Math.min(MA.water, owH(x, z)) - 0.05, z, R() * TAU, 0.8 + R() * 0.7]);
  }
  maInst(root, maReedGeo(), mats.reeds, reeds, 'roseaux', false);
  // ---- nénuphars : eau calme de 0,3 à 2,5 m, par colonies
  const pads = [];
  for (let i = 0, n = Math.round(9000 * k); i < n && pads.length < 4200 * k; i++) {
    const x = rand(100, 900), z = rand(100, 900), d = maDepth(x, z);
    if (d < 0.3 || d > 2.6) continue;
    if (owFbm(x / 40 + 9, z / 40 - 2, 2) < 0.56) continue;
    if (!free(x, z, 0)) continue;
    pads.push([x, MA.water + 0.012 + R() * 0.006, z, R() * TAU, 0.55 + R() * 0.8]);
  }
  maInst(root, maPadGeo(), mats.pad, pads, 'nénuphars', false);
  // ---- fougères sous les arbres
  const ferns = [];
  for (const I of MA.islands) {
    const n = Math.round((I.id === 'B' ? 520 : 140) * k);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, r = Math.sqrt(R()) * I.r * 0.95, x = I.x + Math.cos(a) * r * (I.ex || 1), z = I.z + Math.sin(a) * r * (I.ez || 1);
      if (owH(x, z) < 0.35 || !free(x, z, 0)) continue;
      ferns.push([x, owH(x, z) - 0.05, z, R() * TAU, 0.6 + R() * 0.8]);
    }
  }
  maInst(root, maFernGeo(), mats.fern, ferns, 'fougères', false);
  // ---- herbes (laîches) : touffes sur les îles et les berges, en nappes (bruit), hors des allées
  const grass = [];
  for (const I of MA.islands) {
    const n = Math.round((I.id === 'E' ? 900 : I.id === 'B' ? 1300 : 1700) * k);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, r = Math.sqrt(R()) * I.r * 1.15, x = I.x + Math.cos(a) * r * (I.ex || 1), z = I.z + Math.sin(a) * r * (I.ez || 1);
      const g = owH(x, z);
      if (g < MA.water - 0.08 || !free(x, z, 0)) continue;
      if (owNoise(x / 6 + 11, z / 6 - 3) < 0.36) continue;
      grass.push([x, g - 0.04, z, R() * TAU, 0.55 + R() * 0.7]);
    }
  }
  maInst(root, maGrassGeo(), mats.grass, grass, 'herbes', false);
  // ---- troncs flottants et souches (un kit)
  const K = owKit('marais-bois');
  for (let i = 0; i < Math.round(60 * k); i++) {
    const x = rand(120, 880), z = rand(120, 880), d = maDepth(x, z);
    if (d < 0.6 || d > 6 || !free(x, z, 1) || near(x, z, 30)) continue;
    const L = 3 + R() * 5, a = R() * TAU;
    K.geo('ma_bark', 0x8a7a68, GEO.cyl, mtx(x, MA.water - 0.08, z, 0, a, Math.PI / 2, 0.28, L, 0.28));
  }
  for (const I of MA.islands) for (let i = 0; i < 10; i++) {
    const a = R() * TAU, r = I.r * (0.4 + R() * 0.6), x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
    if (!free(x, z, 1)) continue;
    const y = owH(x, z), h = 0.4 + R() * 0.9;
    K.cyl('ma_bark', 0x8a7a68, x, y + h / 2 - 0.1, z, 0.35 + R() * 0.25, h, 9);
    owSet(OW.surf, Math.floor(x), Math.floor(z), OWK.LOW, { base: y, top: y + h, mat: OWM.WOOD });
  }
  K.build(root);
}
function maNatureUpdate(dt) {
  MAV.sway.value = OW.t;
  maFogCull(dt);
  maPlacesUpdate(dt);
}
