/* ------------------------------------------------------------ Dessin --
   Terrain en morceaux de 256 m (pas de 4, 8, 16 ou 32 m selon la distance, bords rabattus pour
   cacher les fentes), routes en rubans posés sur le terrain (cachés au loin : la couleur du
   terrain prend le relais), Nil et bassin de l'oasis, ciel en dôme qui suit la caméra, soleil,
   trois pyramides, faisceau de la Grande Pyramide (hors du brouillard), palmiers, poteaux. */
const OWC = {
  // couleurs de la planche (page 8), en sRGB
  sand: 0xe5b685, sandDark: 0xc99662, sea: 0xdcab76, plateau: 0xd9c4a0, rock: 0xae8c6b, rockDark: 0x8a6a4e,
  wadi: 0xb08560, mud: 0x7d6a4c, pad: 0xd8b383, road: 0x585a5e, track: 0xcda678, runway: 0x8d8984,
  fields: [0x6f8b3d, 0x86a047, 0x9db25a, 0x5d7c37, 0x8c7a4a, 0xa49554], oasis: 0x7c8f45,
};
const _owCol = new THREE.Color(), _owCol2 = new THREE.Color();
/* Couleur du sol en un point du champ (linéaire, pour les couleurs des sommets). */
function owGroundColor(k, x, z, out) {
  if (OW.worldId === 'lune') return luGroundColor(k, x, z, out);
  const b = OW.bio[k], h = OW.H[k];
  const n = owNoise(x / 23, z / 23), n2 = owNoise(x / 140 + 7, z / 140 - 3);
  switch (b) {
    case OWB.SEA: case OWB.SAND: {
      _owCol.setHex(b === OWB.SEA ? OWC.sea : OWC.sand);
      // creux un peu plus sombres, crêtes plus claires (l'ombre prend le bleu du ciel)
      const NX = OW.NX, i = k % NX, j = (k / NX) | 0;
      const c = i > 0 && j > 0 && i < NX - 1 && j < OW.NZ - 1 ? (OW.H[k - 1] + OW.H[k + 1] + OW.H[k - NX] + OW.H[k + NX]) / 4 - h : 0;
      _owCol2.setHex(OWC.sandDark);
      _owCol.lerp(_owCol2, clamp(0.25 + c * 0.35 + (n - 0.5) * 0.3 + (n2 - 0.5) * 0.25, 0, 0.75));
      break;
    }
    case OWB.PLATEAU: _owCol.setHex(OWC.plateau).lerp(_owCol2.setHex(OWC.rock), clamp((n - 0.35) * 0.9 + (n2 - 0.5) * 0.3, 0, 0.7)); break;
    case OWB.ROCK: _owCol.setHex(OWC.rock).lerp(_owCol2.setHex(OWC.rockDark), clamp(n * 0.8, 0, 1)); break;
    case OWB.WADI: _owCol.setHex(OWC.wadi).lerp(_owCol2.setHex(OWC.rockDark), clamp((n - 0.3) * 0.6, 0, 0.5)); break;
    case OWB.FIELD: {
      // parcelles de 40 × 60 m, une culture chacune
      const px = Math.floor((x + 13) / 46), pz = Math.floor((z + 7) / 62);
      _owCol.setHex(OWC.fields[Math.floor(owHash(px, pz) * OWC.fields.length)]);
      const fx = ((x + 13) % 46 + 46) % 46, fz = ((z + 7) % 62 + 62) % 62;
      if (fx < 2.5 || fz < 2.5) _owCol.lerp(_owCol2.setHex(OWC.mud), 0.6);   // sentiers entre les parcelles
      _owCol.lerp(_owCol2.setHex(0x4a5f2a), (n - 0.5) * 0.3 + 0.1);
      break;
    }
    case OWB.MUD: case OWB.RIVER: _owCol.setHex(OWC.mud).lerp(_owCol2.setHex(0x5b4a35), clamp(n * 0.6, 0, 1)); break;
    case OWB.OASIS: _owCol.setHex(OWC.oasis).lerp(_owCol2.setHex(OWC.sand), clamp((n - 0.2) * 0.7, 0, 0.7)); break;
    case OWB.PAD: _owCol.setHex(OWC.pad).lerp(_owCol2.setHex(OWC.sandDark), clamp((n - 0.5) * 0.5, 0, 0.4)); break;
    case OWB.ROAD: _owCol.setHex(OWC.sandDark).lerp(_owCol2.setHex(OWC.road), 0.6); break;    // le ruban fait le détail de près
    case OWB.TRACK: _owCol.setHex(OWC.track); break;
    case OWB.RUNWAY: _owCol.setHex(OWC.runway); break;
    default: _owCol.setHex(OWC.sand);
  }
  out.copy(_owCol).convertSRGBToLinear();
  return out;
}
/* Texture de détail du sable (grains, petites rides), répétée tous les 8 m. */
function owSandTexture() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const n = valueNoise(S, S, [[16, 16, 1], [64, 64, 0.5]], 1.4);
  paintPixels(g, S, S, (x, y, col) => {
    const r = Math.sin((y + Math.sin(x / 19) * 6) / 3.2) * 0.5 + 0.5;
    const v = 240 + (n[y * S + x] - 0.5) * 22 + (r - 0.5) * 9 + (Math.random() - 0.5) * 12;
    col[0] = v; col[1] = v * 0.985; col[2] = v * 0.96;
  });
  const t = toTex(c);
  t.anisotropy = 8;
  return t;
}
const OWT = {};    // textures du monde ouvert (gardées d'une partie à l'autre)
function owTextures() {
  if (OWT.sand) return OWT;
  OWT.sand = share(owSandTexture());
  // asphalte : bords blancs, tirets au milieu (3 m sur 9 m) ; u en travers, v le long
  {
    const c = makeCanvas(64, 256), g = c.getContext('2d');
    const n = valueNoise(64, 256, [[8, 32, 1], [32, 128, 0.6]], 1.3);
    paintPixels(g, 64, 256, (x, y, col) => { const v = 92 + (n[y * 64 + x] - 0.5) * 24 + (Math.random() - 0.5) * 10; col[0] = v * 0.96; col[1] = v * 0.97; col[2] = v; });
    g.fillStyle = 'rgba(232,226,210,0.82)';
    g.fillRect(3, 0, 2, 256); g.fillRect(59, 0, 2, 256);
    g.fillRect(31, 0, 2, 86);
    // sable poussé sur les bords
    g.fillStyle = 'rgba(205,166,120,0.55)'; g.fillRect(0, 0, 2, 256); g.fillRect(62, 0, 2, 256);
    OWT.road = share(toTex(c));
  }
  // piste : sable tassé, deux ornières, bords irréguliers (transparence)
  {
    const c = makeCanvas(64, 128), g = c.getContext('2d');
    const n = valueNoise(64, 128, [[8, 16, 1], [32, 64, 0.5]], 1.3);
    const img = g.createImageData(64, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
      const p = (y * 64 + x) * 4, u = x / 63;
      const rut = Math.exp(-Math.pow((u - 0.28) / 0.07, 2)) + Math.exp(-Math.pow((u - 0.72) / 0.07, 2));
      const v = 196 + (n[y * 64 + x] - 0.5) * 30 - rut * 34;
      img.data[p] = v * 1.02; img.data[p + 1] = v * 0.84; img.data[p + 2] = v * 0.6;
      const edge = Math.min(u, 1 - u) * 64 + (n[y * 64 + x] - 0.5) * 10;
      img.data[p + 3] = edge > 3 ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    OWT.track = share(toTex(c));
  }
  // piste d'aviation : béton, axe en tirets, bandes de bord
  {
    const c = makeCanvas(128, 256), g = c.getContext('2d');
    const n = valueNoise(128, 256, [[16, 32, 1], [64, 128, 0.5]], 1.2);
    paintPixels(g, 128, 256, (x, y, col) => { const v = 146 + (n[y * 128 + x] - 0.5) * 26 + (y % 64 === 0 ? -30 : 0); col[0] = v; col[1] = v * 0.98; col[2] = v * 0.94; });
    g.fillStyle = 'rgba(240,236,226,0.9)';
    g.fillRect(4, 0, 3, 256); g.fillRect(121, 0, 3, 256);
    g.fillRect(62, 0, 4, 120);
    OWT.runway = share(toTex(c));
  }
  // pierre de taille des pyramides : assises de 1,1 m, joints décalés
  {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const n = valueNoise(S, S, [[8, 8, 1], [32, 32, 0.6], [128, 128, 0.3]], 1.5);
    paintPixels(g, S, S, (x, y, col) => {
      const row = Math.floor(y / 32), off = (row % 2) * 24, j = (x + off) % 48;
      const joint = y % 32 < 2 || j < 2 ? 0.72 : 1;
      const v = (200 + (n[y * S + x] - 0.5) * 50 + (owHash(row, Math.floor((x + off) / 48)) - 0.5) * 22) * joint;
      col[0] = v * 1.02; col[1] = v * 0.9; col[2] = v * 0.74;
    });
    OWT.stone = share(toTex(c));
  }
  return OWT;
}

/* ---- Terrain en morceaux */
const OWTER = { size: 256, cols: 24, rows: 20, chunks: [], mat: null, group: null, t: 0 };
function owTerrainMat() {
  if (OWTER.mat) return OWTER.mat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: owTextures().sand, roughness: 0.96, metalness: 0 });
  OWTER.mat = share(m);
  return m;
}
/* Géométrie d'un morceau au pas s (4, 8, 16, 32 m à Khamsin ; 2 à 16 m sur la Lune), bords
   rabattus de `skirt` m. */
function owChunkGeometry(c, s) {
  const N = OWTER.size / s, V = N + 1, NX = OW.NX, H = OW.H, P = OW.STEP;
  const nv = V * V + 4 * V, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const st = s / P;
  const i0 = (c.x0 - OW.X0) / P, j0 = (c.z0 - OW.Z0) / P;
  const color = new THREE.Color();
  const put = (v, gi, gj, dy) => {
    const ci = clamp(gi, 0, NX - 1), cj = clamp(gj, 0, OW.NZ - 1), k = cj * NX + ci;
    const x = OW.X0 + gi * P, z = OW.Z0 + gj * P;
    pos[v * 3] = x; pos[v * 3 + 1] = H[k] + dy + (s === P && OW.pit && OW.pit.has(k) ? OW.pit.get(k) : 0); pos[v * 3 + 2] = z;
    const l = Math.max(0, ci - st), r = Math.min(NX - 1, ci + st), u = Math.max(0, cj - st), d = Math.min(OW.NZ - 1, cj + st);
    const gx = (H[cj * NX + r] - H[cj * NX + l]) / ((r - l) * P || 1), gz = (H[d * NX + ci] - H[u * NX + ci]) / ((d - u) * P || 1);
    const ln = Math.hypot(gx, 1, gz);
    nor[v * 3] = -gx / ln; nor[v * 3 + 1] = 1 / ln; nor[v * 3 + 2] = -gz / ln;
    owGroundColor(k, x, z, color);
    col[v * 3] = color.r; col[v * 3 + 1] = color.g; col[v * 3 + 2] = color.b;
    uv[v * 2] = x / 8; uv[v * 2 + 1] = z / 8;
  };
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) put(j * V + i, i0 + i * st, j0 + j * st, 0);
  // bords rabattus (nord, sud, ouest, est)
  const skirt = -2 - s * 0.6;
  let b = V * V;
  for (let i = 0; i < V; i++) put(b + i, i0 + i * st, j0, skirt);
  for (let i = 0; i < V; i++) put(b + V + i, i0 + i * st, j0 + N * st, skirt);
  for (let j = 0; j < V; j++) put(b + 2 * V + j, i0, j0 + j * st, skirt);
  for (let j = 0; j < V; j++) put(b + 3 * V + j, i0 + N * st, j0 + j * st, skirt);
  const idx = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * V + i, bb = a + 1, cc = a + V, d = cc + 1;
      idx.push(a, cc, bb, bb, cc, d);
    }
  }
  // jupes : chaque bord avec sa copie descendue (vues de l'extérieur du morceau)
  for (let i = 0; i < N; i++) {
    const t0 = i, t1 = i + 1, s0 = b + i, s1 = b + i + 1;            // nord
    idx.push(t0, t1, s0, t1, s1, s0);
    const u0 = N * V + i, u1 = u0 + 1, w0 = b + V + i, w1 = w0 + 1;  // sud
    idx.push(u0, w0, u1, u1, w0, w1);
    const l0 = i * V, l1 = (i + 1) * V, m0 = b + 2 * V + i, m1 = m0 + 1;   // ouest
    idx.push(l0, m0, l1, l1, m0, m1);
    const r0 = i * V + N, r1 = (i + 1) * V + N, q0 = b + 3 * V + i, q1 = q0 + 1;   // est
    idx.push(r0, r1, q0, r1, q1, q0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(nv > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
  g.computeBoundingSphere();
  return g;
}
function owBuildTerrainChunks(root) {
  OWTER.group = new THREE.Group();
  OWTER.group.name = 'terrain';
  OWTER.chunks = [];
  for (let r = 0; r < OWTER.rows; r++) {
    for (let c = 0; c < OWTER.cols; c++) {
      const ch = { x0: OW.X0 + c * OWTER.size, z0: OW.Z0 + r * OWTER.size, lod: -1, geo: [null, null, null, null], mesh: null };
      ch.mesh = new THREE.Mesh(new THREE.BufferGeometry(), owTerrainMat());
      ch.mesh.matrixAutoUpdate = false;
      ch.mesh.frustumCulled = true;
      ch.mesh.receiveShadow = true;
      OWTER.group.add(ch.mesh);
      OWTER.chunks.push(ch);
    }
  }
  root.add(OWTER.group);
}
/* Pas des quatre niveaux de détail : 1, 2, 4 et 8 fois le pas du champ (4 à 32 m à Khamsin). */
const owLodStep = (lod) => OW.STEP << lod;
function owLodDistances() {
  const q = settings.quality, L = (OW_WORLDS[OW.worldId] || OW_WORLDS.khamsin).lod;
  // Khamsin : pas de 4 m jusqu'à 260 m (les 9 morceaux autour de la caméra), 8 m jusqu'à 800 m, 16 m jusqu'à 1,8 km
  return q === 'low' ? L[0] : q === 'high' ? L[2] : L[1];
}
/* Niveau de détail de chaque morceau selon la distance de la caméra à son bord le plus proche. */
function owUpdateTerrainLod(force) {
  const cx = camera.position.x, cz = camera.position.z, L = owLodDistances(), S = OWTER.size;
  let built = 0;
  for (const ch of OWTER.chunks) {
    const dx = Math.max(ch.x0 - cx, 0, cx - (ch.x0 + S)), dz = Math.max(ch.z0 - cz, 0, cz - (ch.z0 + S));
    const d = Math.hypot(dx, dz);
    const lod = d < L[0] ? 0 : d < L[1] ? 1 : d < L[2] ? 2 : 3;
    if (lod === ch.lod) continue;
    // au plus deux morceaux fins par image (pas d'à-coup), sauf au chargement
    if (!ch.geo[lod]) {
      if (!force && lod <= 1 && built >= 2) continue;
      ch.geo[lod] = owChunkGeometry(ch, owLodStep(lod));
      built++;
    }
    ch.mesh.geometry = ch.geo[lod];
    ch.lod = lod;
    // les détails fins des morceaux lointains sont libérés
    for (let l = 0; l < 2; l++) if (l < lod - 1 && ch.geo[l]) { ch.geo[l].dispose(); ch.geo[l] = null; }
  }
}

/* ---- Routes : rubans posés sur le terrain, par tronçons de 200 m (cachés au-delà de 900 m) */
function owRoadMats() {
  if (OWT.roadMats) return OWT.roadMats;
  const T = owTextures();
  OWT.roadMats = {
    road: share(new THREE.MeshStandardMaterial({ map: T.road, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
    track: share(new THREE.MeshStandardMaterial({ map: T.track, roughness: 0.98, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
    runway: share(new THREE.MeshStandardMaterial({ map: T.runway, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
  };
  return OWT.roadMats;
}
function owBuildRoads(root) {
  OW.roadParts = [];
  root.add(owRoadGroup(OW.roads, 'routes', OW.roadParts));
}
/* Routes et pistes ajoutées par la carte (Mod Tools) : un groupe à part, refait quand elles changent. */
function owBuildUserRoads(root) {
  if (OW.userRoads) { OW.userRoads.parent && OW.userRoads.parent.remove(OW.userRoads); OW.userRoads.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  OW.roadPartsUser = [];
  OW.userRoads = owRoadGroup((OW.roadsUser || []).filter(Boolean), 'routes ajoutées', OW.roadPartsUser);
  root.add(OW.userRoads);
  return OW.userRoads;
}
function owRoadGroup(list, name, parts) {
  const mats = owRoadMats();
  const group = new THREE.Group();
  group.name = name;
  for (const r of list) {
    const pts = r.line.pts, cum = r.line.cum, half = r.w / 2, rep = r.kind === 'road' ? 9 : r.kind === 'runway' ? 40 : 12;
    const PER = 12;    // points par tronçon (48 m)
    for (let s0 = 0; s0 < pts.length - 1; s0 += PER) {
      const s1 = Math.min(pts.length - 1, s0 + PER);
      const n = s1 - s0 + 1, pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
      let cx = 0, cz = 0;
      for (let q = 0; q < n; q++) {
        const i = s0 + q, a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const px = -tz, pz = tx;
        for (let sd = 0; sd < 2; sd++) {
          const o = sd ? half : -half, x = pts[i][0] + px * o, z = pts[i][1] + pz * o, v = (q * 2 + sd) * 3;
          pos[v] = x; pos[v + 1] = owH(x, z) + 0.06; pos[v + 2] = z;
          uv[(q * 2 + sd) * 2] = sd; uv[(q * 2 + sd) * 2 + 1] = cum[i] / rep;
        }
        cx += pts[i][0]; cz += pts[i][1];
        if (q < n - 1) { const a0 = q * 2, b0 = a0 + 1, c0 = a0 + 2, d0 = a0 + 3; idx.push(a0, b0, c0, b0, d0, c0); }   // faces vers le haut
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mats[r.kind]);
      m.renderOrder = 1;
      m.matrixAutoUpdate = false;
      m.receiveShadow = true;
      group.add(m);
      // morceaux de terrain sous le tronçon : le ruban ne se montre que s'ils sont tous au pas de 4 m
      const chunks = new Set();
      for (let q = 0; q < n; q++) {
        const pt = pts[s0 + q];
        for (const o of [-half - 2, half + 2]) { chunks.add(owTerChunkIndex(pt[0] + o, pt[1])); chunks.add(owTerChunkIndex(pt[0], pt[1] + o)); }
      }
      parts.push({ mesh: m, x: cx / n, z: cz / n, chunks: [...chunks].filter((c) => c >= 0) });
    }
  }
  return group;
}
function owUpdateRoads() {
  const cx = camera.position.x, cz = camera.position.z, C = OWTER.chunks;
  // plus loin, la couleur du terrain dessine la route (un ruban plat passerait sous le terrain simplifié)
  for (const L of [OW.roadParts, OW.roadPartsUser]) for (const p of L || []) p.mesh.visible = Math.hypot(p.x - cx, p.z - cz) < 420 && p.chunks.every((c) => C[c].lod === 0);
}
/* Morceaux du terrain refaits dans une zone (relief ou sol changés) : au prochain niveau de détail. */
function owTerrainInvalidate(rect) {
  const S = OWTER.size;
  for (const ch of OWTER.chunks) {
    if (ch.x0 + S + 8 < rect[0] || ch.x0 - 8 > rect[2] || ch.z0 + S + 8 < rect[1] || ch.z0 - 8 > rect[3]) continue;
    for (let l = 0; l < 4; l++) if (ch.geo[l]) { ch.geo[l].dispose(); ch.geo[l] = null; }
    ch.lod = -1;
  }
}
/* Rang du morceau de terrain qui contient (x, z), ou -1. */
function owTerChunkIndex(x, z) {
  const c = Math.floor((x - OW.X0) / OWTER.size), r = Math.floor((z - OW.Z0) / OWTER.size);
  return c < 0 || r < 0 || c >= OWTER.cols || r >= OWTER.rows ? -1 : r * OWTER.cols + c;
}

/* ---- Eau : le Nil et le bassin de l'oasis */
function owBuildWater(root) {
  const nile = new THREE.Mesh(new THREE.PlaneGeometry(1700, 5600, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1d5a66, roughness: 0.14, metalness: 0.35, envMap: GK.env || (GK.env = genGlasEnv()), envMapIntensity: 0.9 }));
  nile.position.set(4500, 0.35, 1500);
  nile.name = 'Nil';
  root.add(nile);
  const O = KH.oasis;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2b6c74, roughness: 0.1, metalness: 0.35, envMap: GK.env, envMapIntensity: 1 }));
  pool.scale.set(O.rx * 1.02, 1, O.rz * 1.02);
  pool.position.set(O.x, OW.oasisWater, O.z);
  root.add(pool);
  OW.waterMats = [nile.material, pool.material];
}

/* ---- Ciel : dôme qui suit la caméra (dégradé, soleil, brume à l'horizon de la couleur du brouillard).
   Ses couleurs sortent telles quelles à l'écran (toneMapped: false) : dans three r128, le brouillard
   se mélange après l'étalonnage et l'encodage sRGB ; l'horizon du ciel et le terrain au loin se
   rejoignent ainsi exactement. */
function owBuildSky(root) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
      uHaze: { value: new THREE.Color() }, uHazeK: { value: 0.3 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color() }, uSunK: { value: 1 }, uStars: { value: 0 }, uTime: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uTop, uHorizon, uGround, uHaze, uSunCol, uSunDir; uniform float uHazeK, uSunK, uStars, uTime; varying vec3 vDir;',
      'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void main(){',
      '  vec3 d = normalize(vDir); float e = d.y;',
      '  vec3 c = e > 0.0 ? mix(uHorizon, uTop, pow(clamp(e, 0.0, 1.0), 0.55)) : mix(uHorizon, uGround, clamp(-e * 6.0, 0.0, 1.0));',
      '  float s = max(dot(d, normalize(uSunDir)), 0.0);',
      '  c += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12) * uSunK;',
      '  if (uStars > 0.0 && e > 0.0) { vec2 g = floor(d.xz / (d.y + 0.25) * 260.0); float st = step(0.9965, h21(g)); c += vec3(st * uStars * clamp(e * 3.0, 0.0, 1.0)); }',
      '  float hz = uHazeK * (1.0 - smoothstep(0.0, 0.32, abs(e)));',
      '  c = mix(c, uHaze, clamp(hz + (e < 0.0 ? uHazeK : 0.0), 0.0, 1.0));',
      '  gl_FragColor = vec4(c, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <encodings_fragment>',
      '}',
    ].join('\n'),
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.name = 'ciel';
  OW.sky = sky;
  root.add(sky);
  // soleil (lumière directionnelle) ; la cible suit la caméra
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.name = 'soleil';
  root.add(sun, sun.target);
  OW.sunLight = sun;
}

/* ---- Pyramides et faisceau (jeu 2.0.3 : géométrie dans owPyramidGeometry, face nord échancrée
   derrière le portail de chaque intérieur ; voir « Intérieur des pyramides ») */
function owBuildPyramids(root) {
  const T = owTextures();
  const mat = new THREE.MeshStandardMaterial({ map: T.stone, vertexColors: true, roughness: 0.9 });
  OW.pyrMeshes = [];
  // ombre de l'intérieur : une pyramide 2 m en retrait, invisible, qui ne fait qu'ombre (ses deux faces) :
  // le soleil n'entre pas dans les salles, quel que soit le joint entre leurs murs
  const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  ghost.shadowSide = THREE.DoubleSide;
  for (const p of KH.pyramids) {
    const m = new THREE.Mesh(owPyramidGeometry(p, null), mat);
    m.name = 'pyramide';
    m.userData.notch = '';
    m.castShadow = true; m.receiveShadow = true;
    root.add(m);
    OW.pyrMeshes.push(m);
    const k = (p.side / 2 - 2) / (p.side / 2), s = new THREE.Mesh(owPyramidGeometry({ x: p.x, z: p.z, y0: p.y0, side: p.side * k, h: p.h * k }, null), ghost);
    s.name = 'pyramide (ombre)';
    s.castShadow = true; s.receiveShadow = false;
    s.raycast = () => {};
    root.add(s);
    if (p.beam) owBuildBeam(root, p.x, p.y0 + p.h - 1.5, p.z);
  }
}
function owBuildBeam(root, x, y, z) {
  const g = new THREE.Group();
  g.name = 'faisceau';
  const mk = (r, op) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3200, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x5ff2e2, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  const core = mk(1.4, 0.95), glow = mk(5, 0.16), haze = mk(14, 0.05);
  for (const m of [core, glow, haze]) { m.position.set(x, y + 1600, z); m.renderOrder = 5; g.add(m); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x5ff2e2, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.position.set(x, y + 1, z); halo.scale.set(70, 70, 1); halo.renderOrder = 6;
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flare || TEX.glow, color: 0xbffcf6, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  star.position.copy(halo.position); star.scale.set(160, 24, 1); star.renderOrder = 6;
  g.add(halo, star);
  OW.beam = { group: g, core, glow, haze, halo, star, x, y, z };
  root.add(g);
}

/* ---- Palmiers (instanciés) : le long du Nil et du canal, dans l'oasis, quelques-uns aux lieux */
function owPalmGeometries() {
  const trunk = new THREE.CylinderGeometry(0.17, 0.26, 1, 7, 6, true);
  trunk.translate(0, 0.5, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.sin(y * 1.4) * 0.06 * y); }
  trunk.computeVertexNormals();
  // couronne : 9 palmes (rubans qui retombent)
  const pos = [], idx = [];
  for (let f = 0; f < 9; f++) {
    const a = (f / 9) * TAU + (f % 2) * 0.2, ca = Math.cos(a), sa = Math.sin(a), L = 2.6 + (f % 3) * 0.35, base = pos.length / 3;
    for (let s = 0; s <= 5; s++) {
      const t = s / 5, r = L * t, y = Math.sin(t * Math.PI * 0.75) * 0.9 - t * t * 1.25, w = 0.42 * Math.sin(t * Math.PI) + 0.05;
      const cx = ca * r, cz = sa * r;
      pos.push(cx - sa * w, y, cz + ca * w, cx + sa * w, y - 0.06, cz - ca * w);
      if (s < 5) { const q = base + s * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  crown.setIndex(idx);
  crown.computeVertexNormals();
  return { trunk, crown };
}
function owPalmSpots() {
  const out = [], rnd = mulberry32(911);
  const add = (x, z, h) => { if (x > 20 && x < 4000 && z > -200 && z < 3200) out.push([x, z, h || 7 + rnd() * 6, rnd() * TAU, 0.85 + rnd() * 0.3]); };
  // berge du Nil, deux rangs irréguliers
  for (let z = -300; z < 3300; z += 11 + rnd() * 9) { const xb = KH.nileBank(z); add(xb - 18 - rnd() * 14, z); if (rnd() < 0.5) add(xb - 40 - rnd() * 30, z + rnd() * 6); }
  // canal et bords des champs
  for (let z = -100; z < 3200; z += 16 + rnd() * 22) add(3360 + rnd() * 6 - 3, z);
  for (let i = 0; i < 160; i++) { const x = 3340 + rnd() * 420, z = rnd() * 3000; if (owBioAt(x, z) === OWB.FIELD && rnd() < 0.6) add(x, z); }
  // oasis : palmeraie autour du bassin
  const O = KH.oasis;
  for (let i = 0; i < 170; i++) {
    const a = rnd() * TAU, r = 1.25 + Math.pow(rnd(), 0.7) * 4.6;
    const x = O.x + Math.cos(a) * O.rx * r * 1.6, z = O.z + Math.sin(a) * O.rz * r * 2.4;
    if (owBioAt(x, z) !== OWB.ROAD) add(x, z, 6 + rnd() * 7);
  }
  return out;
}
function owBuildPalms(root) {
  const G = owPalmGeometries();
  const spots = owPalmSpots();
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.95 });
  const crownM = new THREE.MeshStandardMaterial({ color: 0x4d7a32, roughness: 0.85, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(G.trunk, trunkM, spots.length), crowns = new THREE.InstancedMesh(G.crown, crownM, spots.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  spots.forEach(([x, z, h, ry, s], i) => {
    const y = owH(x, z) - 0.2;
    o.position.set(x, y, z); o.rotation.set(0, ry, (owHash(i, 3) - 0.5) * 0.18); o.scale.set(s, h, s); o.updateMatrix();
    trunks.setMatrixAt(i, o.matrix);
    o.position.set(x + Math.sin(o.rotation.z) * -h * 0.5, y + h, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s * (0.9 + h / 26)); o.updateMatrix();
    crowns.setMatrixAt(i, o.matrix);
    crowns.setColorAt(i, col.setHex(0xffffff).multiplyScalar(0.8 + owHash(i, 9) * 0.35));
    // tronc : un obstacle
    owSet(OW.surf, Math.floor(x), Math.floor(z), OWK.SOLID, { base: y, top: y + h, mat: OWM.WOOD });
  });
  trunks.frustumCulled = false; crowns.frustumCulled = false;
  trunks.castShadow = crowns.castShadow = true;
  root.add(trunks, crowns);
}

/* ---- Poteaux télégraphiques le long de la R47 (et leurs fils) */
function owBuildPoles(root) {
  const r47 = OW.roads.find((r) => r.id === 'r47');
  const pts = r47.line.pts, cum = r47.line.cum, spots = [];
  let next = 20;
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] < next) continue;
    next += 48;
    const a = pts[i - 1], b = pts[i], tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1;
    const x = pts[i][0] + (tz / tl) * 9, z = pts[i][1] - (tx / tl) * 9;
    if (owBioAt(x, z) === OWB.RIVER) continue;
    spots.push([x, owH(x, z), z, Math.atan2(tx, tz)]);
  }
  const pole = new THREE.CylinderGeometry(0.09, 0.13, 7.5, 6);
  pole.translate(0, 3.75, 0);
  const arm = new THREE.BoxGeometry(1.6, 0.1, 0.1);
  arm.translate(0, 7.0, 0);
  const geo = mergeGeoms([pole, arm]);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }), spots.length);
  const o = new THREE.Object3D(), wires = [];
  spots.forEach(([x, y, z, ry], i) => {
    o.position.set(x, y - 0.3, z); o.rotation.set((owHash(i, 1) - 0.5) * 0.06, ry, (owHash(i, 2) - 0.5) * 0.08); o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    owSet(OW.surf, Math.floor(x), Math.floor(z), OWK.SOLID, { base: y - 1, top: y + 7, mat: OWM.WOOD });
    if (i > 0) {
      const p = spots[i - 1];
      for (const side of [-0.7, 0.7]) {
        const ax = p[0] + Math.cos(p[3]) * side, az = p[2] - Math.sin(p[3]) * side, bx = x + Math.cos(ry) * side, bz = z - Math.sin(ry) * side;
        let px = ax, py = p[1] + 6.95, pz = az;
        for (let s = 1; s <= 8; s++) {
          const t = s / 8, sag = Math.sin(t * Math.PI) * 0.9;
          const nx = lerp(ax, bx, t), ny = lerp(p[1] + 6.95, y + 6.95, t) - sag, nz = lerp(az, bz, t);
          wires.push(px, py, pz, nx, ny, nz);
          px = nx; py = ny; pz = nz;
        }
      }
    }
  });
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  const lines = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: new THREE.Color(0x2a221c).convertSRGBToLinear() }));
  root.add(mesh, lines);
}
/* Fusionne des géométries indexées ou non (positions, normales, uv). */
function mergeGeoms(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  for (let g of list) {
    if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
      if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
      idx.push(base + i);
    }
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

/* ---- Au-delà du champ de hauteurs : un anneau de sable jusqu'à 12 km (fondu dans la brume) */
function owBuildFarRing(root) {
  const g = new THREE.RingGeometry(3600, 12000, 64, 2).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xd9aa78, roughness: 1 }));
  m.position.set(2048, 12, 1536);
  m.name = 'horizon';
  root.add(m);
}
/* ---- Mur de sable (bord ouest) : rideau de poussière qui monte jusqu'au ciel */
function owBuildSandWall(root) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0x7e3a1b).convertSRGBToLinear() }, uCol2: { value: new THREE.Color(0xc77a43).convertSRGBToLinear() }, uHaze: { value: new THREE.Color() }, uFogD: { value: 0.00058 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: [
      'uniform float uTime, uFogD; uniform vec3 uCol, uCol2, uHaze; varying vec2 vUv; varying vec3 vW;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }',
      'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }',
      'void main(){',
      '  vec2 p = vec2(vW.z / 60.0 + uTime * 0.05, vW.y / 45.0 - uTime * 0.12);',
      '  float c = n(p) * 0.55 + n(p * 2.3 + 7.0) * 0.3 + n(p * 5.1 - 3.0) * 0.15;',
      '  float top = 1.0 - smoothstep(0.55, 1.0, vUv.y + (c - 0.5) * 0.25);',
      '  float a = clamp(top * (0.75 + c * 0.35), 0.0, 1.0) * smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);',
      '  vec3 col = mix(uCol, uCol2, clamp(c * 1.2 - vUv.y * 0.4, 0.0, 1.0));',
      '  float d = length(vW - cameraPosition), f = 1.0 - exp(-uFogD * uFogD * d * d);',
      '  col = mix(col, uHaze, f * 0.7);',
      '  gl_FragColor = vec4(col, a);',
      '  #include <tonemapping_fragment>',
      '  #include <encodings_fragment>',
      '}',
    ].join('\n'),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6400, 520, 64, 8).rotateY(Math.PI / 2), mat);
  wall.position.set(70, 250, 1500);
  wall.renderOrder = 3;
  OW.sandWall = wall;
  root.add(wall);
}
