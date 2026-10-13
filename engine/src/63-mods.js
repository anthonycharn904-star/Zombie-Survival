/* ---------------------------------------------- Terrain d'une carte ouverte --
   Ce qu'une carte ouverte change au désert de sa base (Mod Tools, niveau 2) :
     terrain   { d: { "bi,bj": base64 } }   relief : écart à la base en cm (Int16), par blocs de
                                            32 × 32 points du champ de hauteurs (128 m de côté)
     ground    { d: { "bi,bj": base64 } }   sol peint : 0 inchangé, sinon matière + 1 (Uint8)
     roads     [{ kind, w, pts }]           routes et pistes ajoutées (posées comme celles du jeu)
     buildings [{ type, x, z, rot, y }]     bâtiments ajoutés (catalogue OWBLD), terrain aplani
     locs      [{ name, x, z, r }]          lieux nommés (mini-carte, nom en entrant)
   Le terrain généré est gardé tel quel (OW.base0) : chaque chargement, chaque coup de pinceau
   repart de lui dans la zone touchée. Les lieux de Khamsin, ses routes et les pyramides sont
   protégés (owProtectMask) : le relief ne bouge pas sous eux.
   Bases : « khamsin » (le désert et ses sept lieux) et « desert » (le même désert, routes et
   pyramides comprises, sans les lieux, le sanctuaire, la quête ni le tunnel). */
const OW_BASES = {
  khamsin: { name: 'Khamsin', places: true, world: 'khamsin' },
  desert: { name: 'Désert vierge', places: false, world: 'khamsin' },
};
const OWMOD = { B: 32, on: false, live: false, delta: null, paint: null, cache: new Map() };
const OW_PAINTS = ['SAND', 'PAD', 'TRACK', 'ROCK', 'WADI', 'PLATEAU', 'OASIS', 'FIELD', 'MUD'];
/* Lune : régolithe, régolithe sombre, éjectas clairs, roche, sol damé, gradin, glace sale. */
const OW_PAINTS_LU = ['SAND', 'DARKSOIL', 'EJECTA', 'ROCK', 'PAD', 'BENCH', 'ICE'];
const owPaints = () => (OW.worldId === 'lune' ? OW_PAINTS_LU : OW_PAINTS);

/* Solides de chaque base : les lieux de Khamsin ne sont pas dans le désert vierge. */
function owUseBase(id) {
  if (!OW_BASES[id] || OW_BASES[id].world !== (OW.worldId || 'khamsin')) id = OW_WORLDS[OW.worldId || 'khamsin'].base;
  if (!OW.layers) OW.layers = {};
  if (OW.baseId === id && OW.surf) return;
  owBoxRelease();
  owLogUndoAll();
  let L = OW.layers[id];
  if (!L) {
    L = OW.layers[id] = { surf: owNewLayer(OWK.TERRAIN), under: owNewLayer(OWK.ROCK), doors: [] };
    OW.surf = L.surf; OW.under = L.under; OW.doors = L.doors;
    if (OW.worldId === 'lune') luRasterBase(id); else owRasterPyramids();
  }
  OW.surf = L.surf; OW.under = L.under; OW.doors = L.doors;
  OW.baseId = id;
  OWED.tiles.clear(); OWED.meshes = null;
}
const owBaseHasPlaces = () => !!(OW_BASES[OW.baseId || 'khamsin'] || OW_BASES.khamsin).places;
/* Monde d'une base (Khamsin et le désert vierge : le désert ; Ombre éternelle et la Lune vierge : la Lune). */
const owWorldOf = (base) => (OW_BASES[base] || OW_BASES.khamsin).world;
/* Terrain généré, gardé une fois pour toutes. */
function owTerrainSave() {
  if (!OW.base0) OW.base0 = { H: OW.H.slice(), bio: OW.bio.slice(), steep: OW.steep.slice(), water: OW.water.slice() };
}

/* ---- Blocs (base64) */
function owB64Enc(arr) {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function owB64Dec(str, Type) {
  const key = `${Type === Int16Array ? 'i' : 'u'}${str}`;
  let a = OWMOD.cache.get(key);
  if (a) return a;
  const bin = atob(str), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  a = new Type(u8.buffer, 0, Math.floor(u8.length / Type.BYTES_PER_ELEMENT));
  OWMOD.cache.set(key, a);
  if (OWMOD.cache.size > 400) OWMOD.cache.delete(OWMOD.cache.keys().next().value);
  return a;
}
const owBlocks = (o) => (o && o.d && typeof o.d === 'object' ? o.d : null);
/* La carte change-t-elle le terrain ? */
function owModsActive(map) {
  if (!map) return false;
  const t = owBlocks(map.terrain), g = owBlocks(map.ground);
  return !!((t && Object.keys(t).length) || (g && Object.keys(g).length) || (map.roads && map.roads.length) || (map.buildings && map.buildings.length));
}

/* ---- Protection : 0 sous les lieux de Khamsin, ses routes et les pyramides, 255 ailleurs. */
function owProtectMask() {
  const id = OW.baseId || 'khamsin';
  if (!OW.protect) OW.protect = {};
  if (OW.protect[id]) return OW.protect[id];
  const NX = OW.NX, M = new Uint8Array(OW.NX * OW.NZ).fill(255);
  const put = (k, v) => { const q = Math.round(clamp(v, 0, 1) * 255); if (q < M[k]) M[k] = q; };
  if (OW.worldId === 'lune') { luProtect(id, put); OW.protect[id] = M; return M; }
  if (OW_BASES[id].places) {
    for (const L of KH.locs) owEachPoint(L.x - L.r, L.z - L.r, L.x + L.r, L.z + L.r, (k, x, z) => put(k, owSmoothstep(L.r * 0.6, L.r * 0.95, Math.hypot(x - L.x, z - L.z))));
  }
  for (const p of KH.pyramids) {
    const r = p.side * 0.72;
    owEachPoint(p.x - r - 30, p.z - r - 30, p.x + r + 30, p.z + r + 30, (k, x, z) => put(k, owSmoothstep(r, r + 30, Math.hypot(x - p.x, z - p.z))));
  }
  for (const r of OW.roads || []) {
    const pts = r.line.pts, a = r.w / 2 + 2, b = r.w / 2 + 12;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], ex = pts[i + 1][0] - ax, ez = pts[i + 1][1] - az, l2 = ex * ex + ez * ez || 1e-6;
      owEachPoint(Math.min(ax, ax + ex) - b, Math.min(az, az + ez) - b, Math.max(ax, ax + ex) + b, Math.max(az, az + ez) + b, (k, x, z) => {
        const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1);
        put(k, owSmoothstep(a, b, Math.hypot(x - ax - ex * t, z - az - ez * t)));
      });
    }
  }
  // bord du monde (mur de sable, falaises hors carte) : pas de relief au-delà de la zone jouable
  owEachPoint(OW.X0, OW.Z0, OW.X0 + (OW.NX - 1) * OW.STEP, OW.Z0 + (OW.NZ - 1) * OW.STEP, (k, x, z) => { if (x < 100 || z < -20 || x > OW.W + 20 || z > OW.D + 20) M[k] = 0; });
  OW.protect[id] = M;
  return M;
}

/* ---- Routes ajoutées : emprise (avec l'aplanissement de part et d'autre) */
function owRoadReach(r) {
  // recalculée à chaque fois : les Mod Tools déplacent les points d'une route sans la recréer
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of r.pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  const m = (r.w || 6) / 2 + 80;
  return [x0 - m, z0 - m, x1 + m, z1 + m];
}
const owRectHit = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
const owRectUnion = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

/* Applique au terrain les modifications de la carte, dans rect ([x0, z0, x1, z1]) ou partout.
   La zone grandit aux routes ajoutées et aux bâtiments qui la touchent ; elle est renvoyée. */
function owApplyMods(map, rect = null) {
  owTerrainSave();
  const NX = OW.NX, NZ = OW.NZ, B0 = OW.base0, H = OW.H, bio = OW.bio, steep = OW.steep, water = OW.water;
  const ST = OW.STEP, XM = OW.X0 + (NX - 1) * ST, ZM = OW.Z0 + (NZ - 1) * ST;
  const roads = (map && map.roads) || [], blds = (map && map.buildings) || [];
  let R = rect ? rect.slice() : [OW.X0, OW.Z0, XM, ZM];
  // route ajoutée ou retirée : toutes les routes sont reposées (leurs indices ont changé)
  if (rect && (!OW.roadsUser || OW.roadsUser.length !== roads.length)) {
    for (const r of roads) if (r && Array.isArray(r.pts) && r.pts.length >= 2) R = owRectUnion(R, owRoadReach(r));
  }
  if (rect) {
    for (let pass = 0; pass < 4; pass++) {
      const before = R.join();
      for (const r of roads) { const bb = owRoadReach(r); if (owRectHit(bb, R)) R = owRectUnion(R, bb); }
      for (const b of blds) { const Q = owBldRect(b); if (Q) { const bb = [Q.x0 - 10, Q.z0 - 10, Q.x1 + 10, Q.z1 + 10]; if (owRectHit(bb, R)) R = owRectUnion(R, bb); } }
      if (R.join() === before) break;
    }
  }
  R = [Math.max(OW.X0, R[0]), Math.max(OW.Z0, R[1]), Math.min(XM, R[2]), Math.min(ZM, R[3])];
  const i0 = clamp(Math.floor((R[0] - OW.X0) / ST), 0, NX - 1), i1 = clamp(Math.ceil((R[2] - OW.X0) / ST), 0, NX - 1);
  const j0 = clamp(Math.floor((R[1] - OW.Z0) / ST), 0, NZ - 1), j1 = clamp(Math.ceil((R[3] - OW.Z0) / ST), 0, NZ - 1);
  // 1. la base
  for (let j = j0; j <= j1; j++) {
    const a = j * NX + i0, b = j * NX + i1 + 1;
    H.set(B0.H.subarray(a, b), a); bio.set(B0.bio.subarray(a, b), a); steep.set(B0.steep.subarray(a, b), a); water.set(B0.water.subarray(a, b), a);
  }
  // 2. relief et 3. sol peint : grilles de travail des Mod Tools, sinon les blocs de la carte
  const B = OWMOD.B;
  if (OWMOD.live && OWMOD.delta) {
    const Dl = OWMOD.delta, P = OWMOD.paint;
    for (let j = j0; j <= j1; j++) for (let k = j * NX + i0, e = j * NX + i1; k <= e; k++) { if (Dl[k]) H[k] += Dl[k]; if (P[k]) bio[k] = P[k] - 1; }
  } else {
    const each = (blocks, Type, fn) => {
      for (const key of Object.keys(blocks || {})) {
        const [bi, bj] = key.split(',').map(Number);
        if ((bi + 1) * B <= i0 || bi * B > i1 || (bj + 1) * B <= j0 || bj * B > j1) continue;
        const a = owB64Dec(blocks[key], Type);
        for (let q = 0; q < B; q++) {
          const j = bj * B + q;
          if (j < j0 || j > j1) continue;
          for (let p = 0; p < B; p++) {
            const i = bi * B + p;
            if (i < i0 || i > i1) continue;
            const v = a[q * B + p];
            if (v) fn(j * NX + i, v);
          }
        }
      }
    };
    each(owBlocks(map && map.terrain), Int16Array, (k, v) => { H[k] += v / 100; });
    each(owBlocks(map && map.ground), Uint8Array, (k, v) => { bio[k] = v - 1; });
  }
  // 4. routes ajoutées (aplanies, matière de route), sans toucher aux lieux protégés
  const mask = owProtectMask();
  if (!OW.roadsUser || OW.roadsUser.length !== roads.length) OW.roadsUser = roads.map(() => null);
  roads.forEach((r, i) => {
    if (!r || !Array.isArray(r.pts) || r.pts.length < 2) { OW.roadsUser[i] = null; return; }
    if (!owRectHit(owRoadReach(r), R)) return;
    OW.roadsUser[i] = owLayRoad({ id: `u${i}`, kind: r.kind === 'road' ? 'road' : 'track', w: r.w || (r.kind === 'road' ? 8 : 6), pts: r.pts }, mask);
  });
  if (!OWED.on) { OW._bestD = OW._bestS = null; }
  // 5. bâtiments : terrain aplani dessous
  owBldPads(map || {}, R, mask);
  // 6. pentes raides et eau
  for (let j = Math.max(1, j0 - 1); j <= Math.min(NZ - 2, j1 + 1); j++) {
    for (let i = Math.max(1, i0 - 1); i <= Math.min(NX - 2, i1 + 1); i++) {
      const k = j * NX + i;
      const s = Math.max(Math.abs(H[k + 1] - H[k - 1]) / (2 * ST), Math.abs(H[k + NX] - H[k - NX]) / (2 * ST), Math.abs(H[k + 1] - H[k]) / ST, Math.abs(H[k + NX] - H[k]) / ST, Math.abs(H[k] - H[k - 1]) / ST, Math.abs(H[k] - H[k - NX]) / ST);
      const b = bio[k], paved = b === OWB.ROAD || b === OWB.TRACK || b === OWB.RUNWAY;
      if (OW.worldId === 'lune') steep[k] = luSteepRule(k, s, b);
      else if (s > 0.82 && !paved) { steep[k] = 1; if (b === OWB.SAND || b === OWB.SEA || b === OWB.PLATEAU || b === OWB.WADI) bio[k] = OWB.ROCK; }
      else steep[k] = 0;
    }
  }
  OWMOD.on = owModsActive(map);
  return R;
}

/* ---- Lieux nommés : ceux de la base (Khamsin) et ceux de la carte (numérotés). */
function owNamedLocs(map = OW.map) {
  const out = owBaseHasPlaces() ? (OW.locs || KH.locs).slice() : [];
  ((map && map.locs) || []).forEach((L, i) => out.push({ id: String(i + 1), name: L.name, x: L.x, z: L.z, r: L.r, user: true }));
  return out;
}
/* Lieu nommé le plus proche (dans son cercle : d < 0), ou null. */
function owNearestNamed(x, z) {
  let best = null, bd = Infinity;
  for (const L of OW.locsShown || []) {
    const d = Math.hypot(x - L.x, z - L.z) - L.r;
    if (d < bd) { bd = d; best = L; }
  }
  return best ? { loc: best, d: bd } : null;
}
/* Désert vierge : ni lieux, ni sanctuaire, ni quête, ni tunnel ; leurs états restent au repos. */
function khInertPlaces(root) {
  owItemsBegin();                                      // jeu 2.0.3 : pas de pièces de décor
  OWL.lamps = [];
  OW.placesRoot = root;
  owLightsInit(root);
  KH.places = {};
  KHSAN.door = null; KHSAN.under = false; KHSAN.view = 'surface';
  OW.pit = null;
  if (KHQ.hud) KHQ.hud.hidden = true;
  KHQ.items = {}; KHQ.key = null; KHQ.pilot = null; KHQ.cine = null; KHQ.escape = null; KHQ.won = false;
  KHT.ride = null; KHT.group = null; KHT.cart = null;
}
