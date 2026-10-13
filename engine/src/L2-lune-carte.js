/* ------------------------------------------------- Lune : carte, chargement --
   « Ombre éternelle » dans le catalogue (carte ouverte, base « ombre ») et la Lune vierge (base
   « lune » des Mod Tools : le même relief, la fosse et ses rampes, sans les lieux ni la quête). */
const OMBRE = {
  id: 'ombre', open: true, format: OPEN_FORMAT, base: 'ombre', name: 'Ombre éternelle',
  description: 'Mine de glace en gradins près du pôle Sud de la Lune. Un sixième de la pesanteur, pas d’air, un Soleil rasant : la fosse plonge à −80 m dans une ombre que rien n’éclaire.',
  eyebrow: 'Rapport d’incident · Ombre éternelle · 76° sud',
  lead: 'Survivez dans la mine lunaire le plus longtemps possible, ou réparez l’atterrisseur du plateau d’extraction et quittez la Lune.',
  w: 1400, h: 1400,
  rules: { startPoints: 500, startWeapon: 'm1911', powerOn: false, boxWeapons: null, storms: 0 },
  spawn: { pos: LU.spawn.pos.slice(), yaw: LU.spawn.yaw, lv: 0 },
  ambiance: { sky: '#000000', fog: '#000000', fogDensity: 0.00001, hemiSky: '#6d7d9a', hemiGround: '#3b3a38', hemi: 0.1, exposure: 1.0, moon: false, trees: 0, pipes: false, wallHeight: 3.5 },
  wallbuys: [], perks: [], boxes: [], boxStart: 0, vehicles: [], fuel: [], breakers: [], props: [],
  roads: [], buildings: [], locs: [], terrain: null, ground: null, custom: { models: {} },
  doors: [], lights: [], signs: [], zones: [], risers: [], power: null, amp: null, digipass: null, altar: false,
  thumb: null, menuCam: null, seed: 76, author: '', updated: '2026-10-09',
};
const LUNE = {
  id: 'lune', open: true, format: OPEN_FORMAT, base: 'lune', name: 'Lune vierge', w: 1400, h: 1400,
  description: 'Le relief d’Ombre éternelle sans ses lieux : la fosse et ses rampes, la crête, les cratères. Le reste est à construire.',
  eyebrow: 'Rapport d’incident · pôle Sud de la Lune',
  lead: 'Survivez sur la Lune le plus longtemps possible.',
  rules: { startPoints: 500, startWeapon: 'm1911', powerOn: false, boxWeapons: null, storms: 0 },
  spawn: { pos: LU.spawn.pos.slice(), yaw: LU.spawn.yaw, lv: 0 }, ambiance: { ...OMBRE.ambiance },
  wallbuys: [], perks: [], boxes: [], boxStart: 0, vehicles: [], fuel: [], breakers: [], props: [],
  roads: [], buildings: [], locs: [], terrain: null, ground: null, custom: { models: {} },
  doors: [], lights: [], signs: [], zones: [], risers: [], power: null, amp: null, digipass: null, altar: false,
  thumb: null, menuCam: null, seed: 76, author: '', updated: '',
};
Object.assign(OW_BASES, {
  ombre: { name: 'Ombre éternelle', places: true, world: 'lune' },
  lune: { name: 'Lune vierge', places: false, world: 'lune' },
});
Object.assign(OPEN_BASES, { ombre: OMBRE, lune: LUNE });

/* Solides d'une base lunaire (créés une fois) : rien pour l'instant, les lieux écrivent les leurs. */
function luRasterBase(id) {}
/* Protection du relief (Mod Tools) : la fosse, ses rampes et les aires des lieux ne bougent pas. */
function luProtect(id, put) {
  const P = LU.pit;
  owEachPoint(P.x - P.rim - 40, P.z - P.rim - 40, P.x + P.rim + 40, P.z + P.rim + 40, (k, x, z) => put(k, owSmoothstep(P.rim + 6, P.rim + 34, Math.hypot(x - P.x, z - P.z))));
  if (OW_BASES[id].places) {
    for (const L of LU.locs) {
      if (L.id === 'B' || L.id === 'C' || L.id === 'I' || L.id === 'J') continue;
      owEachPoint(L.x - L.r, L.z - L.r, L.x + L.r, L.z + L.r, (k, x, z) => put(k, owSmoothstep(L.r * 0.55, L.r * 0.95, Math.hypot(x - L.x, z - L.z))));
    }
  }
  // bord de la carte
  owEachPoint(OW.X0, OW.Z0, OW.X0 + (OW.NX - 1) * OW.STEP, OW.Z0 + (OW.NZ - 1) * OW.STEP, (k, x, z) => { if (x < 4 || z < 4 || x > OW.W - 4 || z > OW.D - 4) put(k, 0); });
}

/* --------------------------------------------------------- Chargement -- */
function luLoad(map, opts = {}) {
  luGravity(true);
  owUseBase(map.base);
  if (!OW.links) luBuildLinks();
  const places = owBaseHasPlaces();
  if (!map.menuCam) {
    // au-dessus du dépôt, vers le nord-ouest : la fosse au Soleil rasant, les débris en orbite, la Terre
    const cam = [820, 0, 1260];
    cam[1] = owH(cam[0], cam[2]) + 64;
    map.menuCam = { pos: cam, look: [700, 5, 960], sway: [2.5, 1.2], auto: true };
  }
  owBoxRelease();
  owLogUndoAll();
  registerCustomModels(map);
  registerCustomTextures(map);                          // jeu 2.0.3 : images des surfaces du décor
  KHS.every = 0;                                       // pas de tempête sur la Lune
  if (!opts.editor) OWMOD.live = false;
  if (owModsActive(map) || OWMOD.on) { owApplyMods(map); OWH.bg = null; luSunMap(); }
  else OW.roadsUser = [];
  OW.locsShown = owNamedLocs(map);
  luSunTexture();
  const root = new THREE.Group();
  root.name = 'monde';
  owBuildTerrainChunks(root);
  for (const ch of OWTER.chunks) ch.mesh.material = luTerrainMat();
  owBuildUserRoads(root);
  luBuildSky(root);
  luBuildFarRing(root);
  OWL.lamps = [];
  OW.placesRoot = root;
  if (places) { luBuildPlaces(root); luBuildAnomaly(root); luBuildQuest(root); owItemsWrite(); }   // 2.0.3 : cases des pièces du décor en dernier
  else owItemsBegin();
  owLightsInit(root);
  owBuildElements(root, map, { perProp: !!opts.editor });
  World.root = root;
  linearizeTree(root);
  luSunifyTree(root);
  scene.add(root);
  root.add(luHelmetLamp(), LU.lamp.target);
  owSandPool();
  camera.near = 0.1; camera.far = 9500; camera.updateProjectionMatrix();
  OW.lastLoc = null;
  owHud(!opts.editor);
  luO2Hud(!opts.editor);
  OWNAV.ready = false;
  Zombies.flowT = 0; Zombies.lastCell = -1;
  owShadows();
  owUpdateTerrainLod(true);
  luApplyLight();
  luSkyFollow();
  // le menu montre l'anomalie (le dépôt a déjà sauté) ; la partie le remet debout, il saute à la manche 1
  if (places) { luDepotState(true, 30); luQuestLook(); }
}

/* --------------------------------------------------------- Chaque image -- */
function luUpdateView(dt) {
  if (!OW.on) return;
  OW.t += dt;
  luSkyFollow();
  OWTER.t -= dt;
  if (OWTER.t <= 0) { OWTER.t = 0.2; owUpdateTerrainLod(false); owUpdateRoads(); }
  owLightsUpdate(dt);
  luApplyLight();
  luLampFollow();
  luAnomalyUpdate(dt);
  if (G.state !== 'playing') {
    // menu, fin de partie : les sons normaux ; au menu, l'anomalie en fond
    if (LUO.muffled !== null) { LUO.muffled = null; Sound.setMuffle(false); }
    if (G.state === 'menu' && !LUA.done && LUA.kinds.length && owBaseHasPlaces()) { luDepotState(true, 30); luQuestLook(); }
  }
}
function luUpdate(dt) {
  luUpdateView(dt);
  if (OW.sandFX) OW.sandFX.update(dt);
  luLife(dt);
  if (owBaseHasPlaces()) {
    // manche 1 : le dépôt saute quelques secondes après le départ, sous les yeux du joueur
    if (LUA.armT > 0) { LUA.armT -= dt; if (LUA.armT <= 0) { LUA.armT = -1; luDepotBoom(); } }
    luQuestUpdate(dt);
  }
  // nom du lieu en entrant
  const near = owNearestNamed(player.pos.x, player.pos.z);
  const inside = near && near.d < 0 ? near.loc : null;
  if (inside && inside !== OW.lastLoc) HUD.zone(inside.name);
  OW.lastLoc = inside || (!near || near.d > 30 ? null : OW.lastLoc);
  owUpdateHud(dt);
}

/* ------------------------------------------------------------- Le plan --
   Comme la planche : le régolithe ombré par le relief, les ombres portées du Soleil rasant en noir,
   la fosse et ses gradins ; vignette (sans terrain) : la fosse et les lieux en aplats. */
function luPlanCanvas(w, h, opts = {}) {
  const c = makeCanvas(w, h);
  luPlanDraw(c, opts, null);
  return c;
}
function luPlanDraw(c, opts = {}, clip = null) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const W = 1400, s = Math.min(w / W, h / W), ox = (w - W * s) / 2, oz = (h - W * s) / 2;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  const [px0, py0, px1, py1] = clip || [0, 0, w, h];
  g.save();
  g.beginPath(); g.rect(px0, py0, px1 - px0, py1 - py0); g.clip();
  g.fillStyle = '#0b0b0c'; g.fillRect(px0, py0, px1 - px0, py1 - py0);
  if (OW.H && OW.worldId === 'lune' && opts.relief) {
    const iw = px1 - px0, ih = py1 - py0, img = g.createImageData(iw, ih), d = img.data, col = new THREE.Color();
    for (let py = py0; py < py1; py++) {
      for (let px = px0; px < px1; px++) {
        const x = (px - ox) / s, z = (py - oz) / s;
        if (x < 0 || z < 0 || x > W || z > W) continue;
        const k = owPointIndex(x, z), y = OW.H[k];
        owGroundColor(k, x, z, col); col.convertLinearToSRGB();
        // éclairage du Soleil sur la pente (comme le jeu), ombre portée, un peu de lumière cendrée
        owNormal(x, z, _luPN);
        const sd = LU._sunDir || luDir(LU.sun.az, LU.sun.el, (LU._sunDir = new THREE.Vector3()));
        const lam = Math.max(0, _luPN.x * sd.x + _luPN.y * sd.y + _luPN.z * sd.z) / sd.y;
        const sh = luSunAt(x, y + 0.2, z);
        const L = clamp(0.12 + 0.95 * lam * sh, 0, 1.6);
        const p = ((py - py0) * iw + (px - px0)) * 4;
        d[p] = clamp(col.r * 255 * L, 0, 255); d[p + 1] = clamp(col.g * 255 * L, 0, 255); d[p + 2] = clamp(col.b * 255 * L, 0, 255); d[p + 3] = 255;
      }
    }
    const tmp = makeCanvas(iw, ih);
    tmp.getContext('2d').putImageData(img, 0, 0);
    g.drawImage(tmp, px0, py0);
  } else {
    // vignette : régolithe, fosse en anneaux, ombres
    g.fillStyle = '#8b8883'; g.fillRect(X(0), Z(0), W * s, W * s);
    const rnd = mulberry32(76);
    for (let i = 0; i < 260; i++) { const x = rnd() * W, z = rnd() * W, r = 2 + rnd() * rnd() * 30; g.fillStyle = 'rgba(20,20,22,0.55)'; g.beginPath(); g.ellipse(X(x - r * 0.25), Z(z), r * s, r * 0.9 * s, 0, 0, TAU); g.fill(); }
    const P = LU.pit;
    for (let i = 0; i <= 5; i++) {
      const B = luBench(5 - i);
      g.fillStyle = `rgb(${120 - i * 14},${118 - i * 14},${114 - i * 14})`;
      g.beginPath(); g.arc(X(P.x), Z(P.z), Math.max(1, (i === 0 ? P.rim : luBench(5 - i).r1 + 6) * s), 0, TAU); g.fill();
      if (B) { /* gradins */ }
    }
    g.fillStyle = '#0d0d0e'; g.beginPath(); g.arc(X(P.x + 40), Z(P.z + 6), 150 * s, -1.3, 1.6); g.fill();
    g.fillStyle = '#1a1a1c'; g.beginPath(); LU.crest.forEach(([x, z], i) => (i ? g.lineTo(X(x - 70), Z(z)) : g.moveTo(X(x - 60), Z(z)))); for (let i = LU.crest.length - 1; i >= 0; i--) g.lineTo(X(LU.crest[i][0] - 10), Z(LU.crest[i][1])); g.closePath(); g.fill();
    g.fillStyle = '#9d9a95'; g.beginPath(); g.arc(X(LU.base.x), Z(LU.base.z), LU.base.r * s, 0, TAU); g.fill();
    g.beginPath(); g.arc(X(LU.pad.x), Z(LU.pad.z), LU.pad.r * s, 0, TAU); g.fill();
  }
  // catapulte (voie), pont, convoyeur
  const baseId = opts.base || (OW.worldId === 'lune' && OW.baseId) || 'ombre';
  if (opts.places !== false && OW_BASES[baseId] && OW_BASES[baseId].places) {
    const C = LU.cata;
    g.strokeStyle = 'rgba(30,30,32,0.9)'; g.lineWidth = Math.max(1.5, 7 * s); g.beginPath(); g.moveTo(X(C.x0), Z(C.z0)); g.lineTo(X(C.x1 + (C.x1 - C.x0) * 0.2), Z(C.z1 + (C.z1 - C.z0) * 0.2)); g.stroke();
    g.strokeStyle = '#cfcac2'; g.lineWidth = Math.max(1, 3 * s); g.beginPath(); g.moveTo(X(C.x0), Z(C.z0)); g.lineTo(X(C.x1 + (C.x1 - C.x0) * 0.2), Z(C.z1 + (C.z1 - C.z0) * 0.2)); g.stroke();
    const B = LU.bridge;
    g.strokeStyle = '#d8d4cc'; g.lineWidth = Math.max(1, 4 * s); g.beginPath(); g.moveTo(X(B.x0), Z(B.z)); g.lineTo(X(B.x1), Z(B.z)); g.stroke();
  }
  if (opts.pins !== false) {
    const R = Math.max(7, 24 * s);
    g.font = `700 ${Math.round(R * 1.15)}px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const L of LU.locs) {
      if (L.id === 'C' || L.id === 'I' || L.id === 'J') continue;
      g.fillStyle = '#1c1c1e'; g.beginPath(); g.arc(X(L.x), Z(L.z), R, 0, TAU); g.fill();
      g.strokeStyle = '#f0a33a'; g.lineWidth = Math.max(1, R * 0.16); g.stroke();
      g.fillStyle = '#ffffff'; g.fillText(L.id, X(L.x), Z(L.z) + R * 0.06);
    }
  }
  g.restore();
  return c;
}
const _luPN = { x: 0, y: 1, z: 0 };
function luThumb(base) {
  const M = OPEN_BASES[base] || OMBRE;
  if (!M.thumb) { try { M.thumb = luPlanCanvas(640, 360, { pins: base !== 'lune', places: base !== 'lune', base }).toDataURL('image/jpeg', 0.86); } catch (e) { M.thumb = null; } }
  return M.thumb;
}
/* Retour à une autre carte : la lampe s'éteint, la pesanteur revient. */
function luUnload() {
  if (LU.lamp && LU.lamp.parent) LU.lamp.parent.remove(LU.lamp, LU.lamp.target);
  LU.inside = false;
  LUNAV.ready = false;
  luO2Hud(false);
  if (LUQ.hud) LUQ.hud.hidden = true;
  LUQ.cine = null; LUL.ride = null; LUA.on = false; LUA.armT = -1;
  if (LUO.muffled !== null) { LUO.muffled = null; Sound.setMuffle(false); }
}
