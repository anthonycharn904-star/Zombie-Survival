/* ------------------------------------------- Mod Tools : cartes ouvertes --
   Ce que les Mod Tools du launcher (1.3.0, interface 3 du moteur) demandent au monde ouvert :
   charger la carte sans partie, refaire ses éléments, suivre la caméra libre, viser (rayons),
   dessiner le plan (relief, cases des bâtiments) et proposer une place à un élément (contre un mur,
   sur le sol). Les Mod Tools ne sont pas dans le jeu des joueurs ; ceci ne sert qu'à eux. */
const OWED = { on: false, map: null, plan: null, planKey: '', tiles: new Map(), tilesRev: 0, meshes: null, meshesRoot: null };

/* Monde de la carte pour l'éditeur : pas de HUD ni de zombies, objets un par un (sélection). */
function owEditorLoad(map) {
  clearZombies();
  const t0 = performance.now();
  // grilles de travail du relief et du sol (après la création du terrain, la première fois)
  if (OW.H) owEditorSyncMods(map);
  owLoad(map, { editor: true });
  if (!OWMOD.live) owEditorSyncMods(map);
  // plan d'une autre base ou d'un autre terrain : refait (sinon gardé, il suit les coups de pinceau)
  const sig = owEditorSig(map);
  if (sig !== OWED.planSig) { OWED.plan = null; OWED.planKey = ''; OWED_RELIEF.clear(); OWED.planSig = sig; }
  OWED.on = true; OWED.map = map;
  OWED.tiles.clear(); OWED.tilesRev++;
  OWED.meshes = null;
  return { terrain: !!OW.H, chunks: OW.surf.n, ms: Math.round(performance.now() - t0) };
}
/* Empreinte du terrain d'une carte (base, blocs de relief et de sol, routes, bâtiments). */
function owEditorSig(map) {
  let h = 0;
  const add = (str) => { for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0; h = (Math.imul(h, 31) + str.length) | 0; };
  for (const o of [owBlocks(map && map.terrain), owBlocks(map && map.ground)]) {
    if (!o) { add('-'); continue; }
    for (const k of Object.keys(o).sort()) { add(k); add(o[k]); }
  }
  add(JSON.stringify([(map && map.roads) || [], (map && map.buildings) || []]));
  return `${OW.baseId || 'khamsin'}|${h}`;
}
/* Refait les éléments (armes, atouts, boîte, jerricans, disjoncteurs, objets, véhicules). */
function owEditorRebuild(map) {
  OWED.map = map;
  const t0 = performance.now();
  owRebuildElements(map, { perProp: true, places: true });
  OWED.tiles.clear(); OWED.tilesRev++;
  return performance.now() - t0;
}
/* Chaque image de l'éditeur : la caméra du jeu suit celle des Mod Tools (détail du terrain, ciel,
   lumière des lieux, lampes). */
function owEditorFrame(dt, cam) {
  if (!OW.on) return;
  camera.position.copy(cam.position);
  camera.quaternion.copy(cam.quaternion);
  camera.updateMatrixWorld();
  owUpdateView(dt);
}
/* Rayon dans le monde (terrain, bâtiments, solides) : { hit, t, x, y, z, nx, ny, nz }. */
function owEditorRay(ox, oy, oz, dx, dy, dz, maxT = 4000) {
  owRaycast(ox, oy, oz, dx, dy, dz, maxT);
  const t = RAY.t;
  return { hit: RAY.hit, t, x: ox + dx * t, y: oy + dy * t, z: oz + dz * t, nx: RAY.nx, ny: RAY.ny, nz: RAY.nz };
}

/* ---- Plan : relief (couleur du sol, ombrage), routes et pyramides, à la taille demandée. */
function owEditorPlan(w, h) {
  const key = `${w}x${h}`;
  if (OWED.plan && OWED.planKey === key) return OWED.plan;
  OWED.plan = owPlanCanvas(w, h, { relief: true, corridor: false, pins: false, userRoads: false });
  OWED.planKey = key;
  return OWED.plan;
}
/* Morceau de 64 × 64 m du plan, une case = un pixel : le relief (couleur du sol, ombrage, eau) et,
   par-dessus, les cases des lieux et des éléments (sols, murs, portes, fenêtres, solides bas).
   make = false : seulement s'il est déjà prêt (le plan en demande quelques-uns par image). */
const OWED_COL = {
  [OWK.FLOOR]: [168, 150, 122, 255], [OWK.SOLID]: [52, 44, 38, 255], [OWK.LOW]: [118, 92, 62, 255], [OWK.WINDOW]: [214, 168, 86, 255],
  [OWK.DOOR]: [168, 52, 40, 255], [OWK.RAMP]: [150, 132, 104, 255], [OWK.WATER]: [42, 96, 120, 255], [OWK.VOID]: [10, 10, 10, 255],
};
const OWED_RELIEF = new Map();          // morceau → pixels du relief (gardés : le relief ne change pas)
function owEditorRelief(tx, tz) {
  const k = tz * 64 + tx;
  let d = OWED_RELIEF.get(k);
  if (d) { OWED_RELIEF.delete(k); OWED_RELIEF.set(k, d); return d; }
  d = new Uint8ClampedArray(4096 * 4);
  const col = new THREE.Color();
  // couleur de chaque point du champ de hauteurs autour du morceau (tous les 4 m, 2 m sur la Lune),
  // puis mélange bilinéaire : le plan ressemble au terrain 3D (couleurs des sommets), sans carrés
  const NX = OW.NX, NZ = OW.NZ, P = OW.STEP, N = 64 / P + 3;
  const i0 = Math.floor((tx * 64 - OW.X0) / P) - 1, j0 = Math.floor((tz * 64 - OW.Z0) / P) - 1;
  const pc = new Float32Array(N * N * 4), H = OW.H;
  for (let b = 0; b < N; b++) {
    for (let a = 0; a < N; a++) {
      const i = clamp(i0 + a, 0, NX - 1), j = clamp(j0 + b, 0, NZ - 1), kk = j * NX + i, bk = OW.bio[kk];
      if (bk === OWB.RIVER || (OW.water[kk] && bk === OWB.MUD)) col.setHex(0x1f5b73);
      else if ((bk === OWB.ROAD || bk === OWB.TRACK || bk === OWB.RUNWAY) && !(OWMOD.paint && OWMOD.paint[kk] === bk + 1)) {
        // routes, pistes, piste d'envol : le plan les trace en vecteurs par-dessus ; dessous, du sable tassé
        OW.bio[kk] = OWB.PAD; owGroundColor(kk, OW.X0 + i * P, OW.Z0 + j * P, col); OW.bio[kk] = bk; col.convertLinearToSRGB();
      } else { owGroundColor(kk, OW.X0 + i * P, OW.Z0 + j * P, col); col.convertLinearToSRGB(); }
      const q = (b * N + a) * 4;
      pc[q] = col.r; pc[q + 1] = col.g; pc[q + 2] = col.b;
      // ombrage depuis le nord-ouest, par point (mélangé comme les couleurs : pas de facettes de 4 m)
      const ia = Math.max(0, i - 1), ib = Math.min(NX - 1, i + 1), ja = Math.max(0, j - 1), jb = Math.min(NZ - 1, j + 1);
      pc[q + 3] = clamp(1 + (H[jb * NX + ib] - H[ja * NX + ia]) * (0.32 / P), 0.55, 1.35);
    }
  }
  for (let pz = 0; pz < 64; pz++) {
    for (let px = 0; px < 64; px++) {
      const x = tx * 64 + px + 0.5, z = tz * 64 + pz + 0.5, p = (pz * 64 + px) * 4;
      if (x > OW.W || z > OW.D) { d[p] = 13; d[p + 1] = 11; d[p + 2] = 9; d[p + 3] = 255; continue; }
      const kk = owPointIndex(x, z);
      const fx = (x - OW.X0) / P - i0, fz = (z - OW.Z0) / P - j0, a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b;
      const q00 = (b * N + a) * 4, q10 = q00 + 4, q01 = q00 + N * 4, q11 = q01 + 4;
      const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
      let r, gg, bb;
      if (OW.bio[kk] === OWB.FIELD) {
        // champs : parcelles et sentiers au mètre
        owGroundColor(kk, x, z, col); col.convertLinearToSRGB();
        r = col.r; gg = col.g; bb = col.b;
      } else {
        r = pc[q00] * w00 + pc[q10] * w10 + pc[q01] * w01 + pc[q11] * w11;
        gg = pc[q00 + 1] * w00 + pc[q10 + 1] * w10 + pc[q01 + 1] * w01 + pc[q11 + 1] * w11;
        bb = pc[q00 + 2] * w00 + pc[q10 + 2] * w10 + pc[q01 + 2] * w01 + pc[q11 + 2] * w11;
      }
      const shade = pc[q00 + 3] * w00 + pc[q10 + 3] * w10 + pc[q01 + 3] * w01 + pc[q11 + 3] * w11;
      d[p] = r * 255 * shade; d[p + 1] = gg * 255 * shade; d[p + 2] = bb * 255 * shade; d[p + 3] = 255;
    }
  }
  OWED_RELIEF.set(k, d);
  if (OWED_RELIEF.size > 900) OWED_RELIEF.delete(OWED_RELIEF.keys().next().value);
  return d;
}
function owEditorTile(tx, tz, make = true) {
  const k = tz * 64 + tx;
  if (OWED.tiles.has(k)) return OWED.tiles.get(k);
  if (!make || !OW.H || tx < 0 || tz < 0 || tx * 64 >= OW.W || tz * 64 >= OW.D) return null;
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d'), img = g.createImageData(64, 64), d = img.data;
  d.set(owEditorRelief(tx, tz));
  const ch = OW.surf && OW.surf.chunks[tz * OW.surf.CW + tx];
  if (ch) {
    for (let i = 0; i < 4096; i++) {
      const col = OWED_COL[ch.kind[i]];
      if (!col) continue;
      const p = i * 4, dark = ch.kind[i] === OWK.FLOOR && ch.ceil[i] > 0 ? 0.82 : 1;   // sol couvert (toit) : plus sombre
      d[p] = col[0] * dark; d[p + 1] = col[1] * dark; d[p + 2] = col[2] * dark; d[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  OWED.tiles.set(k, c);
  if (OWED.tiles.size > 600) OWED.tiles.delete(OWED.tiles.keys().next().value);
  return c;
}

/* ---- Surface visible d'un mur. La grille des solides arrondit les murs au mètre ; la toile d'une
   tente, un panneau, un enduit sont parfois en avant ou en retrait de la case : un rayon horizontal
   part du sol devant (1,4 m de haut) vers le mur et s'arrête sur la première face tournée vers lui. */
const OWED_RC = new THREE.Raycaster();
const OWED_WALLS = new Set(['lieux', 'lieux-décor', 'sanctuaire', 'kiosque-escalier', 'quête', 'tunnel', 'tunnel-f', 'pyramide', 'lune-lieux', 'lune-base']);
function owEditorMeshes() {
  if (OWED.meshes && OWED.meshesRoot === World.root) return OWED.meshes;
  const out = [];
  if (World.root) {
    for (const c of World.root.children) {
      if (!OWED_WALLS.has(c.name)) continue;
      // décor des lieux (jeu 2.0.3) : sans les pièces retirées par la carte
      for (const q of c.name === 'lieux-décor' ? c.children.filter((g) => g.visible) : [c]) q.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position) out.push(o); });
    }
  }
  OWED.meshes = out; OWED.meshesRoot = World.root;
  return out;
}
function owEditorSurface(px, pz, nx, nz, y) {
  OWED_RC.set(new THREE.Vector3(px + nx * 1.2, y + 1.4, pz + nz * 1.2), new THREE.Vector3(-nx, 0, -nz));
  OWED_RC.near = 0; OWED_RC.far = 2.6;
  const hits = OWED_RC.intersectObjects(owEditorMeshes(), false);
  const n = new THREE.Vector3();
  for (const h of hits) {
    if (!h.face) continue;
    n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
    if (n.x * nx + n.z * nz < 0.6) continue;
    return { x: h.point.x, z: h.point.z, t: h.distance };
  }
  return null;
}

/* ---- Place d'un élément près du point (x, z) : contre un mur (arme, atout, disjoncteur) ou sur
   le sol. Renvoie { ok, x, z, y, nx, nz, face, why }. opts.face : sens choisi (rotation) pour ce
   qui se pose sans mur ; opts.rad : distance de recherche du mur. */
function owEditorWallNear(x, z, rad = 3) {
  let best = null, bd = Infinity;
  const x0 = Math.floor(x - rad), x1 = Math.floor(x + rad), z0 = Math.floor(z - rad), z1 = Math.floor(z + rad);
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fx = cx + nx, fz = cz + nz;
        if (!owBaseWalk(0, fx, fz)) continue;
        const y = owBaseGround(0, fx + 0.5, fz + 0.5);
        if (!owBaseWallAt(cx, cz, y)) continue;
        // point de la face du mur le plus proche du curseur
        const px = nx ? cx + (nx > 0 ? 1 : 0) : clamp(x, cx + 0.15, cx + 0.85);
        const pz = nz ? cz + (nz > 0 ? 1 : 0) : clamp(z, cz + 0.15, cz + 0.85);
        const d = Math.hypot(px - x, pz - z);
        if (d < bd) { bd = d; best = { x: px, z: pz, nx, nz, y }; }
      }
    }
  }
  return best;
}
function owEditorPlace(kind, x, z, opts = {}) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const groundAt = (px, pz) => { const g = owBaseGround(0, px, pz); return Number.isFinite(g) ? g : owH(px, pz); };
  const walk = (px, pz) => owBaseWalk(0, Math.floor(px), Math.floor(pz));
  const f = opts.face || [0, 1];
  if (x < 1 || z < 1 || x > OW.W - 1 || z > OW.D - 1) return { ok: false, why: 'Hors de la carte.' };
  const k = elemK(opts.k);                       // jeu 2.0.3 : taille de l'élément (Le Glas, boîte)
  if (kind === 'glas') {
    // Le Glas : beffroi de 4,7 m (socle de 2,4 × 1,2 m fermé), 5 × 3 m de sol libre et 2,4 m devant (× k)
    const rx = -f[1], rz = f[0], y0 = groundAt(x, z), st = 0.8 * Math.min(1, k);
    for (let a = -2.4 * k; a <= 2.4 * k + 0.01; a += st) for (let b = -1.4 * k; b <= 3.8 * k + 0.01; b += st) {
      const px = x + rx * a + f[0] * b, pz = z + rz * a + f[1] * b;
      if (!walk(px, pz) || Math.abs(groundAt(px, pz) - y0) > 0.6) {
        const dc = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
        return { ok: false, x: r3(x), z: r3(z), face: f.slice(), why: `Le Glas demande ${dc(5 * k)} × ${dc(5 * k)} m de sol libre et plat (beffroi, socle, place devant).` };
      }
    }
    return { ok: true, x: r3(x), z: r3(z), y: r3(y0), face: f.slice() };
  }
  if (kind === 'wallbuy' || kind === 'perk' || kind === 'breaker' || kind === 'oxy') {
    const w = owEditorWallNear(x, z, opts.rad || 3);
    if (!w) {
      if (kind === 'wallbuy') return { ok: false, why: 'Il faut un mur (une arme se dessine sur un mur, avec du sol devant).' };
      // atout, disjoncteur : sans mur, posé sur le sol (face selon la rotation choisie)
      if (!walk(x, z) || !walk(x + f[0] * 1.2, z + f[1] * 1.2)) return { ok: false, why: 'Il faut du sol libre (ou un mur avec du sol devant).' };
      return { ok: true, x: r3(x), z: r3(z), y: r3(groundAt(x + f[0] * 0.6, z + f[1] * 0.6)), nx: f[0], nz: f[1], face: f.slice(), free: true };
    }
    // la face visible du mur (toile, panneau…) plutôt que le bord de la case
    const s = owEditorSurface(w.x, w.z, w.nx, w.nz, w.y);
    const wx = s && w.nx ? s.x : w.x, wz = s && w.nz ? s.z : w.z;
    // arme : à 2 cm de la face visible (8 cm du bord de la case sans face trouvée)
    const off = kind === 'wallbuy' ? (s ? 0.02 : 0.08) : kind === 'perk' ? 0.05 : 0.02;
    const px = wx + w.nx * off, pz = wz + w.nz * off;
    if (kind === 'wallbuy') return { ok: true, x: r3(px), z: r3(pz), y: r3(w.y), nx: w.nx, nz: w.nz };
    return { ok: true, x: r3(px), z: r3(pz), y: r3(w.y), nx: w.nx, nz: w.nz, face: [w.nx, w.nz] };
  }
  if (kind === 'vehicle') {
    if (owWaterAt(x, z)) return { ok: false, why: 'Pas dans l’eau.' };
    const ok = owTerrainWalk(x, z) || walk(x, z);
    return { ok, x: r3(x), z: r3(z), y: r3(groundAt(x, z)), why: ok ? '' : 'Terrain trop pentu ou obstacle.' };
  }
  if (kind === 'box') {
    // deux cases (1,6 m) en travers du sens de la boîte, et du sol devant pour le joueur ; agrandie,
    // elle avance vers sa face (son dos reste en place)
    const rx = -f[1], rz = f[0], sh = boxShift(k), cx = x + f[0] * sh, cz = z + f[1] * sh, fd = sh + boxReach(k);
    const ok = walk(cx + rx * 0.5 * k, cz + rz * 0.5 * k) && walk(cx - rx * 0.5 * k, cz - rz * 0.5 * k) && walk(x + f[0] * fd, z + f[1] * fd);
    return { ok, x: r3(x), z: r3(z), y: r3(groundAt(x, z)), face: f.slice(), why: ok ? '' : 'Il faut deux cases de sol libre, et du sol devant la boîte.' };
  }
  const ok = walk(x, z);
  return { ok, x: r3(x), z: r3(z), y: r3(groundAt(x, z)), why: ok ? '' : 'Il faut du sol libre (ni mur, ni eau, ni pente trop forte).' };
}
/* Routes, pistes et piste d'envol (le plan les dessine en vecteurs, à leur largeur). */
function owEditorRoads() { return (OW.worldId === 'lune' ? [] : KH.roads).map((r) => ({ id: r.id, kind: r.kind, w: r.w || 6, pts: ((r.line && r.line.pts) || r.pts).map((p) => [p[0], p[1]]) })); }
/* Sol des lieux sous un point (sans les éléments). */
function owEditorGround(x, z) { const g = owBaseGround(0, x, z); return Number.isFinite(g) ? g : owH(x, z); }
/* Lieux de la base (noms sur le plan, lieu le plus proche d'un point). */
function owEditorLocs() { return (owBaseHasPlaces() ? OW.locs || KH.locs : []).map((L) => ({ id: L.id, name: L.name, x: L.x, z: L.z, r: L.r })); }
function owEditorNear(x, z) { const n = khNearestLoc(x, z); return { id: n.loc.id, name: n.loc.name, d: n.d }; }

/* ---- Pendant un glisser : l'objet 3D de l'élément suit (sans refaire les éléments). e : l'élément
   tel que la carte le porte (x, z, y, normale ou face, lacet). Les cases suivent au relâcher. */
function owEditorPose(kind, i, e) {
  const o = OW.elObjs && OW.elObjs[kind] && OW.elObjs[kind][i];
  if (!o) return false;
  const yOf = (px, pz) => (typeof e.y === 'number' && Number.isFinite(e.y) ? e.y : owEditorGround(px, pz));
  switch (kind) {
    case 'wallbuy': {
      const y = yOf(e.x + e.nx * 0.6, e.z + e.nz * 0.6);
      o.position.set(e.x + e.nx * 0.02, y + (e.h || 1.6), e.z + e.nz * 0.02);
      o.lookAt(o.position.x + e.nx, o.position.y, o.position.z + e.nz);
      break;
    }
    case 'perk': o.position.set(e.x, yOf(e.x, e.z), e.z); o.rotation.y = Math.atan2(e.face[0], e.face[1]); break;
    case 'breaker': o.position.set(e.x, yOf(e.x, e.z), e.z); o.rotation.y = Math.atan2(e.nx, e.nz); break;
    case 'oxy': case 'glas': o.position.set(e.x, yOf(e.x, e.z), e.z); o.rotation.y = Math.atan2(e.face[0], e.face[1]); break;
    case 'box': { const sh = boxShift(elemK(e.k)) - 0.05; o.position.set(e.x + e.face[0] * sh, yOf(e.x, e.z), e.z + e.face[1] * sh); o.rotation.y = Math.atan2(e.face[0], e.face[1]); break; }
    case 'fuel': { const at = o.userData.at || [0, 0, 0]; o.position.set(e.x - at[0], yOf(e.x, e.z) - at[1], e.z - at[2]); break; }
    case 'vehicle': { const V = VEH.list[i]; if (!V) return false; V.x = e.x; V.z = e.z; V.yaw = e.yaw || 0; vehPose(V, 0, true); break; }
    case 'building': { const at = o.userData.at || [e.x, 0, e.z]; o.position.set(e.x - at[0], (Number.isFinite(e.y) ? e.y : at[1]) - at[1], e.z - at[2]); break; }
    default: return false;
  }
  o.updateMatrixWorld(true);
  return true;
}
/* Objet posé (un groupe par objet dans les Mod Tools) : suit pendant un glisser. */
function owEditorPoseProp(i, pr) {
  const P = OW.propsRoot;
  if (!P) return false;
  const g = P.children.find((c) => c.userData.prop === i);
  if (!g) return false;
  g.position.set(pr.x, owPropGround(pr) + (pr.y || 0), pr.z);
  g.rotation.set(0, pr.r || 0, 0);
  g.scale.set(...propScale(pr));
  g.updateMatrixWorld(true);
  return true;
}

/* ======================================================= Niveau 2 : terrain ==
   Relief et sol peints au pinceau, routes et bâtiments ajoutés. Les grilles de travail (OWMOD.delta :
   écart à la base en m ; OWMOD.paint : matière + 1) suivent la carte : relues de ses blocs au
   chargement et après « annuler », écrites dans ses blocs à la fin de chaque coup de pinceau. */
function owEditorSyncMods(map) {
  const n = OW.NX * OW.NZ, B = OWMOD.B, NX = OW.NX, NZ = OW.NZ;
  if (!OWMOD.delta || OWMOD.delta.length !== n) { OWMOD.delta = new Float32Array(n); OWMOD.paint = new Uint8Array(n); }
  else { OWMOD.delta.fill(0); OWMOD.paint.fill(0); }
  const put = (blocks, Type, fn) => {
    for (const key of Object.keys(blocks || {})) {
      const [bi, bj] = key.split(',').map(Number), a = owB64Dec(blocks[key], Type);
      for (let q = 0; q < B; q++) { const j = bj * B + q; if (j >= NZ) break; for (let p = 0; p < B; p++) { const i = bi * B + p; if (i >= NX) break; if (a[q * B + p]) fn(j * NX + i, a[q * B + p]); } }
    }
  };
  put(owBlocks(map.terrain), Int16Array, (k, v) => { OWMOD.delta[k] = v / 100; });
  put(owBlocks(map.ground), Uint8Array, (k, v) => { OWMOD.paint[k] = v; });
  OWMOD.live = true;
}
/* Zone (rect) de tout ce que la carte change au terrain, ou null. */
function owModsRect(map) {
  let R = null;
  const add = (q) => { R = R ? owRectUnion(R, q) : q.slice(); };
  const P = OW.STEP, B = OWMOD.B * P;
  for (const o of [owBlocks(map.terrain), owBlocks(map.ground)]) for (const key of Object.keys(o || {})) { const [bi, bj] = key.split(',').map(Number); add([OW.X0 + bi * B - P, OW.Z0 + bj * B - P, OW.X0 + (bi + 1) * B + P, OW.Z0 + (bj + 1) * B + P]); }
  for (const r of map.roads || []) add(owRoadReach(r));
  for (const b of map.buildings || []) { const Q = owBldRect(b); if (Q) add([Q.x0 - 10, Q.z0 - 10, Q.x1 + 10, Q.z1 + 10]); }
  return R;
}
/* Pinceau de relief en (x, z), rayon r (m) : 'raise' | 'lower' (s : m par passage au centre),
   'flatten' (vers la hauteur target), 'smooth', 'reset' (retour à la base). Les lieux de la base,
   ses routes et les pyramides ne bougent pas. Renvoie la zone touchée. */
function owEditorSculpt(op, x, z, r, s, target) {
  const D = OWMOD.delta, H = OW.H, B0 = OW.base0.H, M = owProtectMask(), NX = OW.NX;
  const pts = [];
  owEachPoint(x - r, z - r, x + r, z + r, (k, px, pz) => {
    const d = Math.hypot(px - x, pz - z);
    if (d > r) return;
    const f = (1 - owSmoothstep(r * 0.3, r, d)) * (M[k] / 255);
    if (f > 0.002) pts.push(k, f);
  });
  let avg = null;
  if (op === 'smooth') {
    avg = new Float32Array(pts.length / 2);
    for (let q = 0; q < pts.length; q += 2) {
      const k = pts[q];
      avg[q / 2] = (B0[k - 1] + D[k - 1] + B0[k + 1] + D[k + 1] + B0[k - NX] + D[k - NX] + B0[k + NX] + D[k + NX] + (B0[k] + D[k]) * 2) / 6;
    }
  }
  for (let q = 0; q < pts.length; q += 2) {
    const k = pts[q], f = pts[q + 1];
    let v = D[k];
    if (op === 'raise') v += s * f;
    else if (op === 'lower') v -= s * f;
    else if (op === 'flatten') v += (target - (B0[k] + v)) * Math.min(1, f * s);
    else if (op === 'smooth') v += (avg[q / 2] - (B0[k] + v)) * Math.min(1, f * s);
    else if (op === 'reset') v *= 1 - Math.min(1, f * s);
    D[k] = clamp(v, -60, 60);
    if (Math.abs(D[k]) < 0.005) D[k] = 0;
    H[k] = B0[k] + D[k];
  }
  return [x - r - 4, z - r - 4, x + r + 4, z + r + 4];
}
/* Pinceau de sol : v (OWB) ou -1 (sol de la base). Pas sur l'eau, les routes ni les pistes. */
function owEditorPaint(v, x, z, r) {
  const P = OWMOD.paint, bio = OW.bio, b0 = OW.base0.bio;
  owEachPoint(x - r, z - r, x + r, z + r, (k, px, pz) => {
    if (Math.hypot(px - x, pz - z) > r) return;
    const cur = bio[k];
    // pas sur l'eau ni sur les routes (un sol damé peint se repeint)
    if (b0[k] === OWB.RIVER || ((cur === OWB.ROAD || cur === OWB.TRACK || cur === OWB.RUNWAY) && P[k] !== cur + 1)) return;
    P[k] = v < 0 ? 0 : v + 1;
    bio[k] = v < 0 ? b0[k] : v;
  });
  return [x - r - 4, z - r - 4, x + r + 4, z + r + 4];
}
/* Terrain changé dans une zone : morceaux du rendu, plan (fond et morceaux), mini-carte. */
function owEditorAfterTerrain(rect, opts = {}) {
  const R = rect || [OW.X0, OW.Z0, OW.X0 + (OW.NX - 1) * OW.STEP, OW.Z0 + (OW.NZ - 1) * OW.STEP];
  owTerrainInvalidate(R);
  owUpdateTerrainLod(true);
  // morceaux du plan
  const tx0 = Math.floor(R[0] / 64), tx1 = Math.floor(R[2] / 64), tz0 = Math.floor(R[1] / 64), tz1 = Math.floor(R[3] / 64);
  for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) { OWED_RELIEF.delete(tz * 64 + tx); OWED.tiles.delete(tz * 64 + tx); }
  OWED.tilesRev++;
  // fond du plan : seulement la zone (sauf pendant un coup de pinceau)
  if (OWED.plan && !opts.live) {
    const c = OWED.plan, s = Math.min(c.width / OW.W, c.height / OW.D), ox = (c.width - OW.W * s) / 2, oz = (c.height - OW.D * s) / 2;
    const px0 = clamp(Math.floor(ox + R[0] * s) - 2, 0, c.width), px1 = clamp(Math.ceil(ox + R[2] * s) + 2, 0, c.width);
    const py0 = clamp(Math.floor(oz + R[1] * s) - 2, 0, c.height), py1 = clamp(Math.ceil(oz + R[3] * s) + 2, 0, c.height);
    if (px1 > px0 && py1 > py0) owPlanDraw(c, { relief: true, corridor: false, pins: false, userRoads: false }, [px0, py0, px1, py1]);
    OWED.planRev = (OWED.planRev || 0) + 1;
  }
  OWH.bg = null;
}
/* Fin d'un coup de pinceau : les grilles de travail vont dans les blocs de la carte, puis le
   terrain de la zone est refait au propre (routes, bâtiments, pentes). Renvoie la zone refaite. */
function owEditorCommitTerrain(map, rect) {
  const B = OWMOD.B, NX = OW.NX, NZ = OW.NZ, ST = OW.STEP;
  const i0 = clamp(Math.floor((rect[0] - OW.X0) / ST), 0, NX - 1), i1 = clamp(Math.ceil((rect[2] - OW.X0) / ST), 0, NX - 1);
  const j0 = clamp(Math.floor((rect[1] - OW.Z0) / ST), 0, NZ - 1), j1 = clamp(Math.ceil((rect[3] - OW.Z0) / ST), 0, NZ - 1);
  const T = { ...(owBlocks(map.terrain) || {}) }, P = { ...(owBlocks(map.ground) || {}) };
  for (let bj = Math.floor(j0 / B); bj <= Math.floor(j1 / B); bj++) {
    for (let bi = Math.floor(i0 / B); bi <= Math.floor(i1 / B); bi++) {
      const dt = new Int16Array(B * B), dp = new Uint8Array(B * B);
      let any = false, anyP = false;
      for (let q = 0; q < B; q++) {
        const j = bj * B + q;
        if (j >= NZ) break;
        for (let p = 0; p < B; p++) {
          const i = bi * B + p;
          if (i >= NX) break;
          const k = j * NX + i, v = Math.round(OWMOD.delta[k] * 100);
          if (v) { dt[q * B + p] = clamp(v, -32000, 32000); any = true; }
          if (OWMOD.paint[k]) { dp[q * B + p] = OWMOD.paint[k]; anyP = true; }
        }
      }
      const key = `${bi},${bj}`;
      if (any) T[key] = owB64Enc(dt); else delete T[key];
      if (anyP) P[key] = owB64Enc(dp); else delete P[key];
    }
  }
  map.terrain = Object.keys(T).length ? { d: T } : null;
  map.ground = Object.keys(P).length ? { d: P } : null;
  return owEditorApply(map, rect);
}
/* Carte changée (routes, bâtiments, blocs) : terrain refait dans rect (null : partout), routes
   ajoutées refaites. Renvoie la zone refaite. */
function owEditorApply(map, rect) {
  const R = owApplyMods(map, rect);
  OW.locsShown = owNamedLocs(map);
  owEditorAfterTerrain(R);
  if (World.root) owBuildUserRoads(World.root);
  return R;
}
/* Après « annuler » : les grilles relues de la carte, le terrain refait là où l'une ou l'autre
   version le change. */
function owEditorReapply(map, prev) {
  owEditorSyncMods(map);
  const a = owModsRect(map), b = prev ? owModsRect(prev) : null;
  const R = a && b ? owRectUnion(a, b) : a || b;
  if (!R && !OWMOD.on) return null;
  return owEditorApply(map, R);
}
/* Place d'un bâtiment du catalogue (centre près de (x, z), rot quarts de tour) : emprise calée sur
   le mètre, sol relevé (relief de la carte, sans l'aplanissement des bâtiments), lieux évités. */
function owEditorBuildingPlace(type, x, z, rot, dims = null) {
  const T = OWBLD[type];
  if (!T) return { ok: false, why: 'Bâtiment inconnu.' };
  // dimensions de ce bâtiment (jeu 2.0.3 : w, d avant rotation, h), sinon celles du catalogue
  const sz = owBldDims({}, dims || {}, type), W0 = sz.w || T.w, D0 = sz.d || T.d;
  const q = ((rot | 0) % 4 + 4) % 4, w = q % 2 ? D0 : W0, d = q % 2 ? W0 : D0;
  const x0 = Math.round(x - w / 2), z0 = Math.round(z - d / 2), cx = x0 + w / 2, cz = z0 + d / 2;
  const b = { type, x: cx, z: cz, rot: q, ...sz };
  const E = OW_WORLDS[OW.worldId || 'khamsin'].edge;
  if (x0 < E[0] || z0 < E[1] || x0 + w > E[2] || z0 + d > E[3]) return { ok: false, b, why: 'Hors de la zone jouable.' };
  // sol : moyenne du relief de la carte (base + écart), sans les bâtiments déjà posés
  const B0 = OW.base0.H, D = OWMOD.delta;
  let sum = 0, n = 0, wet = false, place = false;
  owEachPoint(x0, z0, x0 + w, z0 + d, (k) => { sum += B0[k] + (D ? D[k] : 0); n++; if (OW.water[k]) wet = true; });
  for (let zz = z0; zz < z0 + d && !place; zz++) for (let xx = x0; xx < x0 + w; xx++) { const c = owPlaceRec(OW.surf, xx, zz); if (c && !c.none && c.kind !== OWK.TERRAIN) { place = true; break; } }
  b.y = Math.round((n ? sum / n : owH(cx, cz)) * 1000) / 1000;
  if (place) return { ok: false, b, why: OW.worldId === 'lune' ? 'Sur un lieu de la base.' : 'Sur un lieu ou une pyramide.' };
  if (OW.worldId === 'lune' && Math.hypot(cx - LU.pit.x, cz - LU.pit.z) < LU.pit.rim + Math.hypot(w, d) / 2 + 4) return { ok: false, b, why: 'Pas dans la fosse ni sur son bord : les gradins et les rampes ne bougent pas.' };
  if (wet) return { ok: false, b, why: 'Pas dans l’eau.' };
  if (owRectOnBaseRoad(x0, z0, x0 + w, z0 + d)) return { ok: false, b, why: 'Sur une route d’origine.' };
  return { ok: true, b, rect: [x0, z0, x0 + w, z0 + d] };
}
/* Un rectangle touche-t-il la chaussée d'une route de la base (largeur + 1 m) ? */
function owRectOnBaseRoad(x0, z0, x1, z1) {
  for (const r of OW.roads || []) {
    const pts = r.line.pts, m = r.w / 2 + 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      if (Math.max(ax, bx) < x0 - m || Math.min(ax, bx) > x1 + m || Math.max(az, bz) < z0 - m || Math.min(az, bz) > z1 + m) continue;
      // distance du segment au rectangle : points du segment tous les mètres
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L));
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
        const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
        if (dx * dx + dz * dz < m * m) return true;
      }
    }
  }
  return false;
}
/* Hauteur du relief de la carte (base + écart des pinceaux), sans routes ni bâtiments. */
function owEditorReliefAt(x, z) {
  const k = owPointIndex(x, z);
  return OW.base0 ? OW.base0.H[k] + (OWMOD.delta ? OWMOD.delta[k] : 0) : owH(x, z);
}
