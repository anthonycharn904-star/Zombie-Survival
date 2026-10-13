/* ------------------------------------------------------- Cartes ouvertes --
   Format d'une carte ouverte (jeu 2.0.0 ; Mod Tools du launcher 1.3.0). Le monde (relief, routes,
   lieux, sanctuaire, quête) vient du code de sa base (Khamsin) ; la carte porte ce que l'auteur
   peut changer dans les Mod Tools. Sans fichier dans le paquet du jeu : la carte intégrée.
     spawn     { pos: [x, z], yaw }                   départ du joueur
     wallbuys  [{ w, x, y, z, nx, nz, h, cost? }]     arme à la craie sur un mur (normale vers le joueur,
                                                       h : hauteur du dessin au-dessus du sol y)
     perks     [{ p, x, y, z, face: [fx, fz], roomH? }] machine dos au mur, face vers le joueur
     boxes     [{ x, y, z, face }] + boxStart         emplacements de la boîte mystère (face : côté du joueur)
     vehicles  [{ type, x, z, yaw }]                  jeep, buggy, truck
     fuel      [{ x, y, z }]                          jerricans (plein du véhicule le plus proche)
     breakers  [{ x, y, z, nx, nz, name }]            disjoncteurs : tous enclenchés, le courant
     props     [{ m, x, z, y?, r?, s?, c?, solid? }]  objets de la bibliothèque (y : au-dessus du sol)
     rules     { startPoints, startWeapon, powerOn, boxWeapons, storms }   storms : une tempête toutes
                                                       les N manches (0 : aucune)
     menuCam   { pos, look, sway }                    vue du menu (absente : depuis le camp, vers le plateau)
     thumb     vignette du menu (absente : le plan en relief)
     terrain, ground, roads, buildings, locs          relief, sol, routes, bâtiments et lieux ajoutés (voir
                                                       « Terrain d'une carte ouverte »)
     placeEdits { id: { x, z, dy, r, s, hide, m } }  jeu 2.0.3 : pièces et surfaces du décor des lieux de
                                                       la base déplacées, tournées, mises à l'échelle,
                                                       retirées, autres matières (voir « Décor des lieux »)
     custom    { models, textures }                   modèles .glb et images importés (textures des surfaces
                                                       du décor : u_… = { name, data, size, rough })
     adds      ['pyramides']                          jeu 2.0.3 : éléments ajoutés depuis à la carte de la base
                                                       que la carte a déjà reçus (une carte de Khamsin d'avant
                                                       l'intérieur des pyramides reçoit leurs armes et leur
                                                       boîte une fois ; retirés ensuite, ils ne reviennent pas)
   Bases : « khamsin » (Khamsin et ses sept lieux) ou « desert » (désert vierge, sans les lieux).
   y : hauteur du sol sous l'élément, recalculée par les Mod Tools quand il bouge (un sol de tombeau
   sous la falaise, un plancher de bâtiment : le terrain seul ne suffit pas à la retrouver). */
const OPEN_FORMAT = 1;
const OPEN_LIMITS = { wallbuys: 80, perks: 24, boxes: 24, vehicles: 24, fuel: 24, breakers: 12, props: 4000, roads: 60, buildings: 300, locs: 24, placeEdits: 20000 };
const OPEN_KINDS = ['wallbuys', 'perks', 'boxes', 'vehicles', 'fuel', 'breakers', 'props'];
const OPEN_RULES = { startPoints: 500, startWeapon: 'm1911', powerOn: false, boxWeapons: null, storms: 4 };

/* Jeu 2.0.3 : éléments de l'intérieur des pyramides (FG42 au pied de la Grande Galerie, MG42 dans la
   chambre de Belzoni, PPSh-41 dans l'antichambre de Mykérinos, la boîte dans la chambre du Roi). */
const KH_PYR_ADDS = {
  wallbuys: [
    { w: 'fg42', x: 2130.92, y: 47.619, z: 1202, nx: -1, nz: 0, h: 1.6 },
    { w: 'mg42', x: 1928.92, y: 40.579, z: 1433, nx: -1, nz: 0, h: 1.6 },
    { w: 'ppsh', x: 1754, y: 37.196, z: 1606.08, nx: 0, nz: 1, h: 1.6 },
  ],
  boxes: [{ x: 2121.5, y: 63.619, z: 1254.5, face: [0, -1] }],
};
/* Éléments de la carte intégrée (relevés sur ses lieux : tente-réfectoire, relais, oasis, centrale,
   tombeaux, hangars, pyramides). Ordre des emplacements de la boîte : camp (départ), relais, oasis,
   centrale, aérodrome, plateau, nécropole, chambre du Roi (Khéops). */
Object.assign(KHAMSIN, {
  base: 'khamsin', format: OPEN_FORMAT, w: OW.W, h: OW.D,
  rules: { ...OPEN_RULES },
  wallbuys: [
    { w: 'kar98k', x: 2300, y: 8.563, z: 1959.17, nx: 0, nz: 1, h: 1.58 },
    { w: 'g43', x: 2305, y: 8.563, z: 1959.17, nx: 0, nz: 1, h: 1.58 },
    { w: 'mp40', x: 2310, y: 8.563, z: 1959.17, nx: 0, nz: 1, h: 1.58 },
    { w: 'trench', x: 1400.5, y: 17.028, z: 2587.92, nx: 0, nz: -1, h: 1.7 },
    { w: 'thompson', x: 1404.5, y: 17.028, z: 2587.92, nx: 0, nz: -1, h: 1.7 },
    { w: 'dbarrel', x: 849, y: 8.758, z: 749.1, nx: 0, nz: 1, h: 1.6 },
    { w: 'type100', x: 853, y: 8.758, z: 749.1, nx: 0, nz: 1, h: 1.6 },
    { w: 'stg44', x: 3521.08, y: 2.982, z: 1589, nx: 1, nz: 0, h: 1.7 },
    { w: 'bar', x: 3521.08, y: 2.982, z: 1599.5, nx: 1, nz: 0, h: 1.7 },
    { w: 'mg42', x: 406.92, y: 2.14, z: 2132.5, nx: -1, nz: 0, h: 1.6 },
    { w: 'ppsh', x: 2791.08, y: 8.676, z: 376, nx: 1, nz: 0, h: 1.7 },
    { w: 'fg42', x: 2791.08, y: 8.676, z: 384, nx: 1, nz: 0, h: 1.7 },
    ...KH_PYR_ADDS.wallbuys,
  ],
  perks: [
    { p: 'souffle', x: 2358, y: 8.513, z: 1978, face: [-1, 0] },
    { p: 'endurance', x: 1406.95, y: 17.028, z: 2582.8, face: [-1, 0], roomH: 3.4 },
    { p: 'detente', x: 857.3, y: 8.758, z: 772, face: [-1, 0] },
    { p: 'cuirasse', x: 632.05, y: 2.345, z: 2133.5, face: [1, 0], roomH: 3.2 },
    { p: 'mainleste', x: 2860.95, y: 8.676, z: 386, face: [-1, 0], roomH: 8 },
  ],
  boxes: [
    { x: 2329, y: 8.513, z: 1940.2, face: [0, 1] },
    { x: 1384, y: 17.028, z: 2582.5, face: [0, -1] },
    { x: 836.5, y: 8.758, z: 771, face: [1, 0] },
    { x: 3526, y: 2.982, z: 1626.5, face: [0, -1] },
    { x: 2846, y: 8.676, z: 389.6, face: [0, -1] },
    { x: 2244, y: 31.219, z: 1566.5, face: [0, -1] },
    { x: 700, y: 2.292, z: 2156, face: [0, 1] },
    ...KH_PYR_ADDS.boxes,
  ],
  boxStart: 0,
  adds: ['pyramides'],
  vehicles: [
    { type: 'jeep', x: 2386, z: 2047, yaw: 2.6 },
    { type: 'jeep', x: 2398, z: 2056, yaw: 2.6 },
    { type: 'jeep', x: 896, z: 752, yaw: -1.5708 },
    { type: 'buggy', x: 1417.5, z: 2589, yaw: 1.5708 },
    { type: 'truck', x: 3502, z: 1646, yaw: 0 },
  ],
  fuel: [
    { x: 1393.5, y: 17.028, z: 2577.5 },
    { x: 3512.5, y: 2.982, z: 1638 },
    { x: 2946, y: 8.676, z: 418 },
  ],
  breakers: [
    { x: 3550.7, y: 2.982, z: 1599.8, nx: -1, nz: 0, name: 'salle des turbines' },
    { x: 3524.9, y: 2.982, z: 1612.5, nx: 1, nz: 0, name: 'poste de commande' },
    { x: 3557, y: 2.982, z: 1625, nx: -1, nz: 0, name: 'transformateurs' },
  ],
  props: [], roads: [], buildings: [], locs: [], terrain: null, ground: null,
  custom: { models: {} },
  author: '', updated: KHAMSIN.updated,
});
/* Désert vierge : le désert de Khamsin (relief, routes, Nil, oasis, pyramides) sans ses lieux ni sa
   quête ; base des cartes ouvertes faites à partir de zéro dans les Mod Tools. Pas dans le menu. */
const DESERT = {
  id: 'desert', open: true, format: OPEN_FORMAT, base: 'desert', name: 'Désert vierge', w: OW.W, h: OW.D,
  description: 'Le désert du Khamsin sans ses lieux : dunes, plateau, Nil, oasis, routes et pyramides. Le reste est à construire.',
  eyebrow: 'Rapport d’incident · désert du Khamsin',
  lead: 'Survivez dans le désert le plus longtemps possible.',
  rules: { ...OPEN_RULES }, spawn: { pos: [2350, 1992], yaw: 0.47, lv: 0 }, ambiance: { ...KHAMSIN.ambiance },
  wallbuys: [], perks: [], boxes: [], boxStart: 0, vehicles: [], fuel: [], breakers: [], props: [],
  roads: [], buildings: [], locs: [], terrain: null, ground: null, custom: { models: {} },
  doors: [], lights: [], signs: [], zones: [], risers: [], power: null, amp: null, digipass: null, altar: false,
  thumb: null, menuCam: null, seed: 4747, author: '', updated: '',
};
const OPEN_BASES = { khamsin: KHAMSIN, desert: DESERT };
/* Vignette d'une base (plan du désert ; les lieux seulement pour Khamsin). */
function owBaseThumb(base) {
  if (owWorldOf(base) === 'lune') return luThumb(base);
  if (base !== 'desert') return khThumb();
  if (!DESERT.thumb) { try { DESERT.thumb = khPlanCanvas(640, 360, { pins: false }).toDataURL('image/jpeg', 0.86); } catch (e) { DESERT.thumb = null; } }
  return DESERT.thumb;
}

/* ---- Lecture d'une carte ouverte (fichier du paquet, atelier des Mod Tools) : tout est vérifié,
   ce qui ne va pas est retiré. La base donne le reste (ambiance, textes, vignette). */
function openNormalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Carte ouverte illisible.');
  const B = OPEN_BASES[typeof raw.base === 'string' ? raw.base : raw.id];
  if (!B) throw new Error(`Carte ouverte : base inconnue (${raw.base || raw.id}).`);
  if (raw === B) return B;
  const num = (v, a, b, d) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, a, b) : d);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const str = (v, n, d = '') => (typeof v === 'string' ? v.slice(0, n) : d);
  // dimensions du monde de la base (pas celles du monde chargé : le catalogue lit toutes les cartes)
  const Wd = OW_WORLDS[owWorldOf(B.id)];
  const inX = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Wd.W;
  const inZ = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Wd.D;
  const y = (v) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 2000 ? r3(v) : null);
  const n4 = (nx, nz) => { const a = Math.round(Math.atan2(nx || 0, nz || 0) / (Math.PI / 2)) * (Math.PI / 2); return [Math.round(Math.sin(a)), Math.round(Math.cos(a))]; };
  const face = (f) => (Array.isArray(f) ? n4(f[0], f[1]) : [0, 1]);
  // jeu 2.0.3 : une carte de Khamsin d'avant reçoit une fois les éléments des pyramides (adds le note)
  const adds = Array.isArray(raw.adds) ? raw.adds.filter((a) => typeof a === 'string' && /^[a-z0-9_-]{1,24}$/.test(a)).slice(0, 16) : [];
  let RA = raw;
  if (B === KHAMSIN && !adds.includes('pyramides')) {
    RA = { ...raw };
    for (const k of ['wallbuys', 'boxes']) {
      if (!Array.isArray(raw[k])) continue;
      const has = (e) => raw[k].some((q) => q && Math.abs(q.x - e.x) < 0.6 && Math.abs(q.z - e.z) < 0.6);
      RA[k] = raw[k].concat(KH_PYR_ADDS[k].filter((e) => !has(e)).map((e) => JSON.parse(JSON.stringify(e))));
    }
    adds.push('pyramides');
  }
  const list = (k) => (Array.isArray(RA[k]) ? RA[k] : B[k] || []).slice(0, OPEN_LIMITS[k]);
  const m = { ...B };
  m.id = typeof raw.id === 'string' && /^[a-z0-9_-]{1,40}$/.test(raw.id) ? raw.id : B.id;
  m.open = true; m.base = B.id; m.format = OPEN_FORMAT; m.w = Wd.W; m.h = Wd.D;
  m.name = str(raw.name, 60, B.name) || B.name;
  m.description = str(raw.description, 400, B.description);
  m.eyebrow = str(raw.eyebrow, 80, B.eyebrow) || B.eyebrow;
  m.lead = str(raw.lead, 300, B.lead) || B.lead;
  m.author = str(raw.author, 60);
  m.updated = str(raw.updated, 40);
  const rr = raw.rules || {};
  m.rules = {
    startPoints: Math.round(num(rr.startPoints, 0, 1000000, OPEN_RULES.startPoints)),
    startWeapon: WEAPONS[rr.startWeapon] ? rr.startWeapon : OPEN_RULES.startWeapon,
    powerOn: !!rr.powerOn,
    boxWeapons: Array.isArray(rr.boxWeapons) ? rr.boxWeapons.filter((id) => WEAPONS[id] && WEAPONS[id].box > 0) : null,
    storms: Math.round(num(rr.storms, 0, 20, OPEN_RULES.storms)),
  };
  const sp = raw.spawn && Array.isArray(raw.spawn.pos) && inX(raw.spawn.pos[0]) && inZ(raw.spawn.pos[1]) ? raw.spawn : B.spawn;
  m.spawn = { pos: [r3(sp.pos[0]), r3(sp.pos[1])], yaw: r3(num(sp.yaw, -10, 10, 0)), lv: 0 };
  m.wallbuys = list('wallbuys').filter((w) => w && WEAPONS[w.w] && inX(w.x) && inZ(w.z)).map((w) => {
    const [nx, nz] = n4(w.nx, w.nz), o = { w: w.w, x: r3(w.x), y: y(w.y), z: r3(w.z), nx, nz, h: r3(num(w.h, 0.6, 3, 1.6)) };
    if (typeof w.cost === 'number' && Number.isFinite(w.cost)) o.cost = Math.round(clamp(w.cost, 0, 1000000));
    return withK(o, w.k);                                // jeu 2.0.3 : taille du dessin
  });
  m.perks = list('perks').filter((p) => p && PERKS[p.p] && ELIXIRS[p.p] && inX(p.x) && inZ(p.z)).map((p) => {
    const o = { p: p.p, x: r3(p.x), y: y(p.y), z: r3(p.z), face: face(p.face) };
    if (typeof p.roomH === 'number' && Number.isFinite(p.roomH)) o.roomH = r3(clamp(p.roomH, 2.2, 30));
    return withK(o, p.k);
  });
  m.boxes = list('boxes').filter((b) => b && inX(b.x) && inZ(b.z)).map((b) => withK({ x: r3(b.x), y: y(b.y), z: r3(b.z), face: face(b.face) }, b.k));
  m.boxStart = Math.round(num(raw.boxStart, 0, Math.max(0, m.boxes.length - 1), 0));
  m.vehicles = list('vehicles').filter((v) => v && VEH_TYPES[v.type] && inX(v.x) && inZ(v.z)).map((v) => ({ type: v.type, x: r3(v.x), z: r3(v.z), yaw: Math.round(num(v.yaw, -10, 10, 0) * 10000) / 10000 }));
  m.fuel = list('fuel').filter((f) => f && inX(f.x) && inZ(f.z)).map((f) => withK({ x: r3(f.x), y: y(f.y), z: r3(f.z) }, f.k));
  m.breakers = list('breakers').filter((b) => b && inX(b.x) && inZ(b.z)).map((b, i) => {
    const [nx, nz] = n4(b.nx, b.nz);
    return withK({ x: r3(b.x), y: y(b.y), z: r3(b.z), nx, nz, name: str(b.name, 40) || `disjoncteur ${i + 1}` }, b.k);
  });
  // Lune : postes d'oxygène (bouteilles à acheter dehors) et Le Glas (une cloche au plus)
  m.oxy = list('oxy').filter((o) => o && inX(o.x) && inZ(o.z)).map((o) => withK({ x: r3(o.x), y: y(o.y), z: r3(o.z), face: face(o.face) }, o.k));
  const gl = raw.glas === undefined ? B.glas : raw.glas;
  m.glas = gl && typeof gl === 'object' && inX(gl.x) && inZ(gl.z) ? withK({ x: r3(gl.x), y: y(gl.y), z: r3(gl.z), face: face(gl.face) }, gl.k) : null;
  const cm = raw.custom && raw.custom.models && typeof raw.custom.models === 'object' ? raw.custom.models : {};
  m.custom = { models: {}, textures: {} };
  for (const id of Object.keys(cm)) if (/^u_[\w-]{1,40}$/.test(id) && cm[id] && typeof cm[id].data === 'string') m.custom.models[id] = cm[id];
  // jeu 2.0.3 : images importées (textures des surfaces du décor), comme sur une carte à grille
  const ct = raw.custom && raw.custom.textures && typeof raw.custom.textures === 'object' ? raw.custom.textures : {};
  let tot = 0;
  for (const id of Object.keys(ct).slice(0, 64)) {
    const t = ct[id];
    if (!/^u_[\w-]{1,40}$/.test(id) || !t || typeof t.data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(t.data)) continue;
    tot += t.data.length;
    if (tot > 12e6) break;
    m.custom.textures[id] = {
      name: str(t.name, 60).trim() || 'Image importée', data: t.data,
      size: Array.isArray(t.size) ? [num(t.size[0], 0.25, 20, 2), num(t.size[1], 0.25, 20, 2)] : [2, 2],
      rough: num(t.rough, 0, 1, 0.85), fit: !!t.fit,
    };
  }
  m.props = list('props').filter((p) => p && typeof p.m === 'string' && (MODELS[p.m] || m.custom.models[p.m]) && inX(p.x) && inZ(p.z)).map((p) => {
    const o = { m: p.m, x: r3(p.x), z: r3(p.z) };
    if (typeof p.y === 'number' && Number.isFinite(p.y) && Math.abs(p.y) > 1e-4) o.y = r3(clamp(p.y, -20, 60));
    if (typeof p.r === 'number' && Number.isFinite(p.r) && Math.abs(p.r) > 1e-4) o.r = Math.round(p.r * 10000) / 10000;
    { const s = normPropScale(p.s); if (s !== undefined) o.s = s; }   // jeu 2.0.3 : un facteur, ou trois
    if (typeof p.c === 'number' && Number.isFinite(p.c)) o.c = p.c & 0xffffff;
    if (typeof p.solid === 'boolean') o.solid = p.solid;
    return o;
  });
  // terrain (niveau 2) : blocs de 32 × 32 points en base64 (Int16 : 2 048 octets, Uint8 : 1 024)
  const blocks = (o, len) => {
    const d = o && o.d && typeof o.d === 'object' ? o.d : {}, out = {};
    let n = 0;
    for (const k of Object.keys(d)) {
      if (n >= 2100) break;
      if (/^\d{1,2},\d{1,2}$/.test(k) && typeof d[k] === 'string' && d[k].length === len && /^[A-Za-z0-9+/]+=*$/.test(d[k])) { out[k] = d[k]; n++; }
    }
    return n ? { d: out } : null;
  };
  m.terrain = blocks(raw.terrain, 2732);
  m.ground = blocks(raw.ground, 1368);
  const r1 = (v) => Math.round(v * 10) / 10;
  m.roads = list('roads').filter((r) => r && Array.isArray(r.pts)).map((r) => {
    const kind = r.kind === 'road' ? 'road' : 'track';
    const pts = r.pts.filter((p) => Array.isArray(p) && inX(p[0]) && inZ(p[1])).slice(0, 300).map((p) => [r1(p[0]), r1(p[1])]);
    return { kind, w: r1(num(r.w, 3, 14, kind === 'road' ? 8 : 6)), pts };
  }).filter((r) => r.pts.length >= 2);
  m.buildings = list('buildings').filter((b) => b && OWBLD[b.type] && inX(b.x) && inZ(b.z)).map((b) => {
    const o = { type: b.type, x: r1(b.x), z: r1(b.z), rot: Math.round(num(b.rot, 0, 3, 0)) };
    if (typeof b.y === 'number' && Number.isFinite(b.y) && Math.abs(b.y) < 500) o.y = r3(b.y);
    return owBldDims(o, b);                              // jeu 2.0.3 : largeur, profondeur, hauteur des murs
  });
  m.locs = list('locs').filter((L) => L && typeof L.name === 'string' && L.name.trim() && inX(L.x) && inZ(L.z)).map((L) => ({ name: L.name.trim().slice(0, 40), x: r1(L.x), z: r1(L.z), r: Math.round(num(L.r, 15, 600, 120)) }));
  m.placeEdits = normPlaceEdits(raw.placeEdits);       // jeu 2.0.3 : décor des lieux retouché
  m.adds = adds.length ? adds : B.adds ? B.adds.slice() : [];
  m.thumb = typeof raw.thumb === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(raw.thumb) && raw.thumb.length < 400000 ? raw.thumb : B.thumb;
  const mc = raw.menuCam, v3 = (a) => Array.isArray(a) && a.length === 3 && a.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 10000);
  m.menuCam = mc && v3(mc.pos) && v3(mc.look) ? { pos: mc.pos.map(r3), look: mc.look.map(r3), sway: Array.isArray(mc.sway) ? [num(mc.sway[0], 0, 20, 1), num(mc.sway[1], 0, 20, 1)] : [1, 0.6] } : null;
  return m;
}

/* ---- Écriture (fichier de l'atelier, paquet du jeu) : seulement ce que la carte porte. */
function openSerialize(m) {
  const o = {
    id: m.id, format: OPEN_FORMAT, open: true, base: m.base || 'khamsin', name: m.name,
    description: m.description, eyebrow: m.eyebrow, lead: m.lead, author: m.author || '', updated: m.updated || '',
    rules: { ...m.rules, boxWeapons: m.rules.boxWeapons ? m.rules.boxWeapons.slice() : null },
    spawn: { pos: m.spawn.pos.slice(), yaw: m.spawn.yaw },
  };
  for (const k of OPEN_KINDS) o[k] = JSON.parse(JSON.stringify(m[k] || []));
  // Lune : Le Glas (les cartes du désert n'en ont pas, ni de postes d'oxygène)
  if (owWorldOf(o.base) === 'lune') o.glas = m.glas ? withK({ x: m.glas.x, y: m.glas.y, z: m.glas.z, face: m.glas.face.slice() }, m.glas.k) : null;
  else delete o.oxy;
  o.boxStart = m.boxStart | 0;
  const used = new Set(o.props.map((p) => p.m));
  o.custom = { models: {} };
  for (const id of Object.keys((m.custom && m.custom.models) || {})) if (used.has(id)) o.custom.models[id] = m.custom.models[id];
  // images importées : celles que portent les matières des surfaces du décor
  const usedT = new Set();
  for (const e of Object.values(m.placeEdits || {})) for (const q of Object.values((e && e.m) || {})) if (q && typeof q.t === 'string' && q.t.startsWith('u_')) usedT.add(q.t);
  const CT = (m.custom && m.custom.textures) || {};
  for (const id of usedT) if (CT[id]) (o.custom.textures || (o.custom.textures = {}))[id] = CT[id];
  for (const k of ['roads', 'buildings', 'locs']) if ((m[k] || []).length) o[k] = JSON.parse(JSON.stringify(m[k]));
  if (m.placeEdits && Object.keys(m.placeEdits).length) o.placeEdits = JSON.parse(JSON.stringify(m.placeEdits));
  if (m.adds && m.adds.length) o.adds = m.adds.slice();
  if (m.terrain && m.terrain.d && Object.keys(m.terrain.d).length) o.terrain = { d: { ...m.terrain.d } };
  if (m.ground && m.ground.d && Object.keys(m.ground.d).length) o.ground = { d: { ...m.ground.d } };
  if (m.thumb && m.thumb !== (OPEN_BASES[o.base] || {}).thumb) o.thumb = m.thumb;
  if (m.menuCam && !m.menuCam.auto) o.menuCam = { pos: m.menuCam.pos.slice(), look: m.menuCam.look.slice(), sway: (m.menuCam.sway || [1, 0.6]).slice() };
  return o;
}

/* ---- Vérification. Sans monde chargé : la forme (catalogue du jeu) ; avec le monde de la carte
   chargé (Mod Tools) : aussi le sol sous chaque élément. Renvoie { errors, warnings } ; at : [x, z]. */
function openValidate(m, deep = false) {
  const errors = [], warnings = [];
  const E = (msg, at) => errors.push({ msg, at: at || null });
  const W = (msg, at) => warnings.push({ msg, at: at || null });
  if (!m.boxes.length) W('Pas d’emplacement pour la boîte mystère : elle n’apparaîtra pas.');
  const moon = owWorldOf(m.base) === 'lune';
  if (!m.breakers.length && !m.rules.powerOn) W(m.base === 'desert' || m.base === 'lune' ? 'Aucun disjoncteur et pas de courant au départ : les atouts électriques resteront sans courant.' : moon ? 'Aucun disjoncteur et pas de courant au départ : atouts, ascenseur de la tour et atterrisseur resteront sans courant.' : 'Aucun disjoncteur et pas de courant au départ : atouts, sanctuaire et batterie de l’avion resteront sans courant.');
  if (!m.vehicles.length && !moon) W('Aucun véhicule : la carte fait 4 × 3 km.');
  if (moon && !(m.oxy || []).length) W('Aucun poste d’oxygène : dehors, on ne tient que 4 minutes (la base recharge).');
  if (moon && m.vehicles.length) W('Véhicules sur la Lune : ils roulent comme sur Terre (1/6 g non simulé pour eux).');
  const seen = new Map();
  for (const p of m.perks) seen.set(p.p, (seen.get(p.p) || 0) + 1);
  for (const [id, n] of seen) if (n > 1) W(`${PERKS[id].name} : ${n} machines (une suffit).`, (m.perks.find((p) => p.p === id) || {}).x !== undefined ? [m.perks.find((p) => p.p === id).x, m.perks.find((p) => p.p === id).z] : null);
  if (deep && OW.H) {
    const ground = (x, z) => owBaseGround(0, x, z);
    const walk = (x, z) => owBaseWalk(0, Math.floor(x), Math.floor(z));
    const sp = m.spawn.pos;
    if (!walk(sp[0], sp[1])) E('Départ : le joueur ne peut pas se tenir à cet endroit (mur, eau, pente trop forte).', sp);
    // devant : du sol à moins de 1,6 m (la face visible d'un mur est parfois en retrait de sa case)
    const front = (x, z, nx, nz, d0) => [d0, d0 + 0.5, d0 + 1.0].find((d) => walk(x + nx * d, z + nz * d));
    const wallBehind = (x, z, nx, nz, y) => [0.05, 0.45].some((d) => owBaseWallAt(Math.floor(x - nx * d), Math.floor(z - nz * d), y));
    m.wallbuys.forEach((w) => {
      const d = front(w.x, w.z, w.nx, w.nz, 0.6);
      if (d === undefined) E(`${WEAPONS[w.w].name} au mur : pas de sol devant le dessin.`, [w.x, w.z]);
      else if (!wallBehind(w.x, w.z, w.nx, w.nz, ground(w.x + w.nx * d, w.z + w.nz * d))) W(`${WEAPONS[w.w].name} au mur : pas de mur derrière le dessin.`, [w.x, w.z]);
    });
    m.perks.forEach((p) => {
      const D = ELIXIRS[p.p] || { d: 1, h: 2.5 }, s = Math.min(elemK(p.k), ((p.roomH || 6) - 0.05) / D.h), d = D.d * s;
      if (front(p.x, p.z, p.face[0], p.face[1], d + 0.3) === undefined) E(`${PERKS[p.p].name} : pas de sol devant la machine.`, [p.x, p.z]);
      // jeu 2.0.3 : taille choisie, réduite sous un plafond trop bas
      const dc = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
      if (p.k && s < p.k - 1e-3) W(`${PERKS[p.p].name} : machine réduite (×${dc(s)} au lieu de ×${dc(p.k)}) pour tenir sous ${dc(p.roomH || 6)} m de plafond.`, [p.x, p.z]);
    });
    m.boxes.forEach((b, i) => { const bk = elemK(b.k), d = boxShift(bk) + boxReach(bk); if (!walk(b.x + b.face[0] * d, b.z + b.face[1] * d)) E(`Boîte mystère (emplacement ${i + 1}) : pas de sol devant elle.`, [b.x, b.z]); });
    m.fuel.forEach((f) => { if (!walk(f.x + 1.2, f.z) && !walk(f.x - 1.2, f.z) && !walk(f.x, f.z + 1.2) && !walk(f.x, f.z - 1.2)) E('Jerricans : on ne peut pas s’en approcher.', [f.x, f.z]); });
    m.breakers.forEach((b) => { if (front(b.x, b.z, b.nx, b.nz, 0.3 + 0.4 * elemK(b.k)) === undefined) E(`Disjoncteur (${b.name}) : pas de sol devant l’armoire.`, [b.x, b.z]); });
    (m.oxy || []).forEach((o, i) => { if (front(o.x, o.z, o.face[0], o.face[1], 0.55 + 0.45 * elemK(o.k)) === undefined) E(`Poste d’oxygène ${i + 1} : pas de sol devant le râtelier.`, [o.x, o.z]); });
    if (m.glas) { const gd = 1.95 * elemK(m.glas.k), fx = m.glas.x + m.glas.face[0] * gd, fz = m.glas.z + m.glas.face[1] * gd; if (![0, 0.5, 1].some((d) => walk(fx + m.glas.face[0] * d, fz + m.glas.face[1] * d))) E('Le Glas : pas de sol devant la cloche.', [m.glas.x, m.glas.z]); }
    m.vehicles.forEach((v) => {
      const T = VEH_TYPES[v.type];
      if (owWaterAt(v.x, v.z)) E(`${T.name} : dans l’eau.`, [v.x, v.z]);
      else if (!walk(v.x, v.z)) W(`${T.name} : posé sur un obstacle ou une pente trop forte.`, [v.x, v.z]);
    });
    // bâtiments ajoutés : ni sur un lieu de la base (ou une pyramide), ni dans l'eau, ni l'un sur l'autre
    const rects = m.buildings.map((b) => owBldRect(b));
    m.buildings.forEach((b, i) => {
      const R = rects[i], T = OWBLD[b.type];
      if (!R) return;
      let place = false, wet = false;
      for (let z = R.z0; z < R.z1 && !place; z++) for (let x = R.x0; x < R.x1; x++) { const c = owPlaceRec(OW.surf, x, z); if (c && !c.none && c.kind !== OWK.TERRAIN) { place = true; break; } }
      for (let z = R.z0; z <= R.z1 && !wet; z += 2) for (let x = R.x0; x <= R.x1; x += 2) if (owWaterAt(x, z)) { wet = true; break; }
      if (place) E(`${T.name} : empiète sur un lieu ou une pyramide (le terrain n’y est pas aplani).`, [b.x, b.z]);
      else if (wet) E(`${T.name} : dans l’eau.`, [b.x, b.z]);
      else if (owRectOnBaseRoad(R.x0, R.z0, R.x1, R.z1)) W(`${T.name} : sur une route d’origine (elle passe dessous).`, [b.x, b.z]);
      for (let j = 0; j < i; j++) { const Q = rects[j]; if (Q && R.x0 < Q.x1 && Q.x0 < R.x1 && R.z0 < Q.z1 && Q.z0 < R.z1) { W(`${T.name} : chevauche ${OWBLD[m.buildings[j].type].name.toLowerCase()}.`, [b.x, b.z]); break; } }
    });
    // décor des lieux retouché (jeu 2.0.3) : retouches sans pièce, pièce déplacée hors de la carte ou dans
    // l'eau, texture inconnue, pièce de la quête retirée
    const PE = m.placeEdits || {}, ids = Object.keys(PE);
    if (ids.length && OWPI.list.length && OW.baseId === m.base) {
      const lost = ids.filter((id) => !OWPI.byId.has(id)).length;
      if (lost) W(`Décor de la base : ${lost} retouche${lost > 1 ? 's' : ''} sans pièce ni surface correspondante (ignorée${lost > 1 ? 's' : ''}).`);
      const R = owItemsCompute(PE), v = new THREE.Vector3();
      for (const it of OWPI.list) {
        const e = PE[it.id];
        if (it.parent || !e || e.hide || e.x === undefined || !R.it[it.i].M) continue;
        v.set(it.ax, it.ay, it.az).applyMatrix4(R.it[it.i].M);
        if (v.x < 0 || v.z < 0 || v.x > OW.W || v.z > OW.D) E(`${it.title} (décor de la base) : hors de la carte.`, [clamp(v.x, 0, OW.W), clamp(v.z, 0, OW.D)]);
        else if (owWaterAt(v.x, v.z)) W(`${it.title} (décor de la base) : dans l’eau.`, [v.x, v.z]);
      }
      const CT = (m.custom && m.custom.textures) || {};
      let badTex = 0;
      for (const e of Object.values(PE)) for (const q of Object.values((e && e.m) || {})) if (q && q.t && !TEXLIB[q.t] && !CT[q.t]) badTex++;
      if (badTex) W(`Décor de la base : ${badTex} texture${badTex > 1 ? 's' : ''} introuvable${badTex > 1 ? 's' : ''} (la matière d’origine reste).`);
      // pièces dont dépend la quête (ou l'air) : retirées, la partie ne peut plus se finir
      for (const it of OWPI.list) {
        if (!it.logic || !R.it[it.i].hidden || (it.parent && R.it[it.parent.i].hidden)) continue;
        W(`Décor de la base : « ${it.title} » est retiré alors que la partie s’en sert (${it.logic.replace(/\.$/, '')}).`, [it.ax, it.az]);
      }
    }
  }
  return { errors, warnings };
}
