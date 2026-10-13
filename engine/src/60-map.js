/* ------------------------------------------------- Lumière de chaque lieu --
   « Une heure du jour par lieu » (planche, page 8) : matin au camp, heure bleue au relais, fin
   d'après-midi à l'oasis, nuit à la centrale, contre-jour à la nécropole, poussière à l'aérodrome ;
   sur la route, la fin d'après-midi de l'illustration. Les réglages se fondent avec la distance. */
const OW_GRADES = {
  // sun / sunI : soleil (couleur, intensité) ; hemi* : lumière du ciel ; top, horizon, ground, haze : ciel et brume (couleurs d'écran)
  // règle d'éclairage : sunI · sin(el) + hemiI · ~0,5 ≈ 0,6 à 0,8 sur un sol plat (le sable garde sa teinte après l'étalonnage)
  route: { az: 320, el: 9, sun: 0xffc88a, sunI: 2.4, hemiSky: 0xd8a878, hemiGround: 0xb98a5c, hemiI: 0.55, top: 0x8c4f2b, horizon: 0xeaa86a, ground: 0xd9a26e, haze: 0xe6ad74, exp: 1.0, stars: 0, sunK: 1 },
  A: { az: 100, el: 24, sun: 0xfff1dc, sunI: 1.35, hemiSky: 0xaccdf0, hemiGround: 0xd9b48a, hemiI: 0.5, top: 0x5d93cf, horizon: 0xdce6ec, ground: 0xe0c49c, haze: 0xe8d5b8, exp: 1.0, stars: 0, sunK: 1 },
  B: { az: 245, el: 18, sun: 0xffd29a, sunI: 1.6, hemiSky: 0xc2b0a0, hemiGround: 0xd2a676, hemiI: 0.5, top: 0x8a5a3c, horizon: 0xf0bd84, ground: 0xdcae7c, haze: 0xe9b987, exp: 1.0, stars: 0, sunK: 1 },
  C: { az: 262, el: -4, sun: 0x8f7cb8, sunI: 0.3, hemiSky: 0x5a6fae, hemiGround: 0x3e3448, hemiI: 0.9, top: 0x1c2a58, horizon: 0xc08a8a, ground: 0x3a3150, haze: 0x6b5a7a, exp: 1.0, stars: 0.35, sunK: 0.6 },
  D: { az: 250, el: 8, sun: 0xffaa5a, sunI: 2.4, hemiSky: 0xc9a87c, hemiGround: 0xc88a50, hemiI: 0.5, top: 0x6f8fb5, horizon: 0xf2c48c, ground: 0xdca06a, haze: 0xedb277, exp: 1.0, stars: 0, sunK: 1 },
  E: { az: 140, el: 38, sun: 0x8fa6d8, sunI: 0.35, hemiSky: 0x1e2c52, hemiGround: 0x0b0f1a, hemiI: 0.9, top: 0x040a1c, horizon: 0x14244a, ground: 0x0a0f1e, haze: 0x101a33, exp: 1.0, stars: 1, sunK: 0 },
  F: { az: 330, el: 5, sun: 0xff9a4a, sunI: 2.2, hemiSky: 0x8a6a72, hemiGround: 0x5a3a2a, hemiI: 0.55, top: 0x4a3e58, horizon: 0xe58a4e, ground: 0xa86a42, haze: 0xc9824f, exp: 1.0, stars: 0, sunK: 1 },
  G: { az: 240, el: 14, sun: 0xff9c55, sunI: 1.6, hemiSky: 0xb0704a, hemiGround: 0x7a4a2e, hemiI: 0.6, top: 0x7a3f22, horizon: 0xd88848, ground: 0xb0683a, haze: 0xc77b45, exp: 1.0, stars: 0, sunK: 0.7 },
};
const OW_GRADE_KEYS = ['sun', 'hemiSky', 'hemiGround', 'top', 'horizon', 'ground', 'haze'];
const OWG = { cur: null, tmp: new THREE.Color(), presets: null };
function owGradePresets() {
  if (OWG.presets) return OWG.presets;
  OWG.presets = {};
  for (const id in OW_GRADES) {
    const g = OW_GRADES[id], o = { ...g };
    for (const k of OW_GRADE_KEYS) o[k] = new THREE.Color(g[k]).convertSRGBToLinear();
    const az = (g.az * Math.PI) / 180, el = (g.el * Math.PI) / 180;
    o.dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    OWG.presets[id] = o;
  }
  return OWG.presets;
}
/* Réglage de lumière en (x, z) : mélange des lieux proches et de la route. */
function owGradeAt(x, z, out) {
  const P = owGradePresets();
  if (!out.sun) { for (const k of OW_GRADE_KEYS) out[k] = new THREE.Color(); out.dir = new THREE.Vector3(); }
  const ws = [];
  let maxW = 0;
  for (const L of owBaseHasPlaces() ? KH.locs : []) {
    const d = Math.hypot(x - L.x, z - L.z);
    const w = 1 - owSmoothstep(L.r * 0.75, L.r + 260, d);
    if (w > 0) { ws.push([P[L.id], w]); maxW = Math.max(maxW, w); }
  }
  ws.push([P.route, Math.max(0.0001, 1 - maxW)]);
  let tw = 0;
  for (const [, w] of ws) tw += w;
  for (const k of OW_GRADE_KEYS) out[k].setRGB(0, 0, 0);
  out.dir.set(0, 0, 0);
  out.sunI = out.hemiI = out.exp = out.stars = out.sunK = 0;
  for (const [p, w0] of ws) {
    const w = w0 / tw;
    for (const k of OW_GRADE_KEYS) { out[k].r += p[k].r * w; out[k].g += p[k].g * w; out[k].b += p[k].b * w; }
    out.dir.addScaledVector(p.dir, w);
    out.sunI += p.sunI * w; out.hemiI += p.hemiI * w; out.exp += p.exp * w; out.stars += p.stars * w; out.sunK += p.sunK * w;
  }
  out.dir.normalize();
  out.night = P.E && ws.find(([p]) => p === P.E) ? ws.find(([p]) => p === P.E)[1] / tw : 0;
  return out;
}
const _owGrade = {};
/* Réglage d'un seul preset (vue du menu). */
function owGradeOf(id, out) {
  const p = owGradePresets()[id];
  if (!out.sun) { for (const k of OW_GRADE_KEYS) out[k] = new THREE.Color(); out.dir = new THREE.Vector3(); }
  for (const k of OW_GRADE_KEYS) out[k].copy(p[k]);
  out.dir.copy(p.dir);
  out.sunI = p.sunI; out.hemiI = p.hemiI; out.exp = p.exp; out.stars = p.stars; out.sunK = p.sunK; out.night = id === 'E' ? 1 : 0;
  return out;
}
function owApplyGrade(dt) {
  if (G.state === 'menu' || KHSAN.under) { KHPY.view = 0; KHPY.cz = null; KHPY.dark = false; }   // pyramides : seulement en partie, à la surface
  const g = G.state === 'menu' ? owGradeOf('route', _owGrade) : KHSAN.under ? owGradeOf('S', _owGrade) : khPyrGrade(owGradeAt(camera.position.x, camera.position.z, _owGrade), dt);
  const sun = OW.sunLight;
  sun.color.copy(g.sun); sun.intensity = g.sunI;
  // la cible suit la caméra, calée sur la taille d'un texel de l'ombre (pas de scintillement)
  const tx = OW.shadowT || 1, cx = Math.round(camera.position.x / tx) * tx, cz = Math.round(camera.position.z / tx) * tx;
  sun.target.position.set(cx, camera.position.y, cz);
  sun.position.copy(sun.target.position).addScaledVector(g.dir, 320);
  sun.target.updateMatrixWorld();
  if (HEMI) { HEMI.color.copy(g.hemiSky); HEMI.groundColor.copy(g.hemiGround); HEMI.intensity = g.hemiI; }
  const u = OW.sky.material.uniforms;
  u.uTop.value.copy(g.top); u.uHorizon.value.copy(g.horizon); u.uGround.value.copy(g.ground);
  u.uSunDir.value.copy(g.dir); u.uSunCol.value.copy(g.sun); u.uSunK.value = g.sunK; u.uStars.value = g.stars;
  // brouillard du calme (planche, page 8 : densité √3 ÷ visibilité) ; la tempête le prend ensuite en main
  const fogCol = OWG.tmp.copy(g.haze);
  khStormGrade(g, u, fogCol);
  // three r128 mélange le brouillard après l'étalonnage et l'encodage : sa couleur est une couleur d'écran
  if (KHSAN.under) { scene.fog.density = 0.022; khFar(300); }       // sanctuaire : brume sombre, la salle se perd dans le noir
  scene.fog.color.copy(fogCol).convertLinearToSRGB();
  if (KHSAN.under && scene.background && scene.background.isColor) scene.background.copy(scene.fog.color);
  u.uHaze.value.copy(fogCol);
  if (OW.sandWall) { const w = OW.sandWall.material.uniforms; w.uHaze.value.copy(fogCol); w.uFogD.value = scene.fog.density; }
  renderer.toneMappingExposure = g.exp;
  // lune à la centrale
  if (MOON) {
    MOON.visible = g.night > 0.02;
    MOON.material.opacity = 0.85 * g.night;
    MOON.position.copy(camera.position).add(OWG.moonDir || (OWG.moonDir = new THREE.Vector3(0.45, 0.62, 0.64).normalize().multiplyScalar(3400)));
    MOON.scale.set(160, 160, 1);
  }
  OW.grade = g;
}

/* ------------------------------------------------------------ Plan --
   Plan de Khamsin dessiné d'après les données (vignette du menu, fond de la mini-carte, plan des
   Mod Tools). clip : [px0, py0, px1, py1] pour ne refaire qu'une partie d'un plan existant (le
   terrain changé dans les Mod Tools). */
function khPlanCanvas(w, h, opts = {}) {
  const c = makeCanvas(w, h);
  khPlanDraw(c, opts, null);
  return c;
}
/* Plan du monde courant (Khamsin ou la Lune) : fond de la mini-carte, plan des Mod Tools. */
function owPlanCanvas(w, h, opts = {}) {
  const c = makeCanvas(w, h);
  owPlanDraw(c, opts, null);
  return c;
}
function owPlanDraw(c, opts = {}, clip = null) {
  return OW.worldId === 'lune' ? luPlanDraw(c, opts, clip) : khPlanDraw(c, opts, clip);
}
function khPlanDraw(c, opts = {}, clip = null) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const s = Math.min(w / 4000, h / 3000), ox = (w - 4000 * s) / 2, oz = (h - 3000 * s) / 2;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  const [px0, py0, px1, py1] = clip || [0, 0, w, h];
  g.save();
  g.beginPath(); g.rect(px0, py0, px1 - px0, py1 - py0); g.clip();
  g.fillStyle = '#0d0b09'; g.fillRect(px0, py0, px1 - px0, py1 - py0);
  if (OW.H && opts.relief) {
    // relief : couleur du sol et ombrage depuis le nord-ouest
    const iw = px1 - px0, ih = py1 - py0, img = g.createImageData(iw, ih), d = img.data, col = new THREE.Color();
    for (let py = py0; py < py1; py++) {
      for (let px = px0; px < px1; px++) {
        const x = (px - ox) / s, z = (py - oz) / s;
        if (x < 0 || z < 0 || x > 4000 || z > 3000) continue;
        const k = owPointIndex(x, z), bk = OW.bio[k];
        if (bk === OWB.RIVER || (OW.water[k] && bk === OWB.MUD)) col.setHex(0x1f5b73);
        else { owGroundColor(k, x, z, col); col.convertLinearToSRGB(); }
        const e = 4 / s, hl = owH(x - e, z - e), hr = owH(x + e, z + e);
        const shade = clamp(1 + (hr - hl) * 0.04 * s * 4, 0.55, 1.35);
        const p = ((py - py0) * iw + (px - px0)) * 4;
        d[p] = clamp(col.r * 255 * shade, 0, 255); d[p + 1] = clamp(col.g * 255 * shade, 0, 255); d[p + 2] = clamp(col.b * 255 * shade, 0, 255); d[p + 3] = 255;
      }
    }
    // par une toile intermédiaire : putImageData sur une toile déjà dessinée passait parfois avant
    // le fond noir (zone redessinée après un coup de pinceau restée noire)
    const tmp = makeCanvas(iw, ih);
    tmp.getContext('2d').putImageData(img, 0, 0);
    g.drawImage(tmp, px0, py0);
  } else {
    // vignette (avant le terrain) : à plat
    g.fillStyle = '#d9a873'; g.fillRect(X(0), Z(0), 4000 * s, 3000 * s);
    g.fillStyle = '#c99662';
    for (let x = 230; x < 1100; x += 96) { g.beginPath(); g.moveTo(X(x), Z(0)); for (let z = 0; z <= 2150; z += 100) g.lineTo(X(x + 26 * Math.sin(z / 230 + 1.3)), Z(z)); g.lineWidth = Math.max(1, 14 * s); g.strokeStyle = 'rgba(150,100,60,0.5)'; g.stroke(); }
    g.fillStyle = '#8d6748'; g.beginPath(); g.ellipse(X(520), Z(2300), 470 * s, 175 * s, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8d3ad'; g.beginPath(); KH.plateau.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.closePath(); g.fill();
    g.fillStyle = '#6f8b3d'; g.fillRect(X(3300), Z(0), 490 * s, 3000 * s);
    g.fillStyle = '#1f5b73'; g.beginPath(); g.moveTo(X(3790), Z(0)); for (let z = 0; z <= 3000; z += 50) g.lineTo(X(KH.nileBank(z)), Z(z)); g.lineTo(X(4000), Z(3000)); g.lineTo(X(4000), Z(0)); g.closePath(); g.fill();
    g.fillStyle = '#3f7a39'; for (let i = 0; i < 70; i++) { const a = i * 2.4, r = 30 + (i * 37) % 150; g.beginPath(); g.arc(X(734 + Math.cos(a) * r * 1.4), Z(732 + Math.sin(a) * r), Math.max(1, 9 * s), 0, TAU); g.fill(); }
    g.fillStyle = '#2b6c74'; g.beginPath(); g.ellipse(X(734), Z(732), 44 * s, 19 * s, 0, 0, TAU); g.fill();
  }
  // couloir du Khamsin (hachures)
  if (opts.corridor !== false) {
    g.save(); g.beginPath(); g.rect(X(0), Z(0), 4000 * s, 3000 * s); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = Math.max(1, 3 * s);
    const C = KH.corridor;
    for (let t = -6000; t < 6000; t += 60) {
      const ax = C.ax * t + C.nx * C.s0, az = C.az * t + C.nz * C.s0, bx = C.ax * t + C.nx * C.s1, bz = C.az * t + C.nz * C.s1;
      g.beginPath(); g.moveTo(X(ax), Z(az)); g.lineTo(X(bx), Z(bz)); g.stroke();
    }
    g.restore();
  }
  // routes et pistes (celles du jeu, puis celles de la carte, sauf pour le plan des Mod Tools qui les dessine lui-même)
  const user = OW.H && opts.userRoads !== false ? (OW.roadsUser || []).filter(Boolean).map((q) => ({ kind: q.kind, pts: q.line.pts })) : [];
  for (const r of [...KH.roads, ...user]) {
    g.beginPath();
    r.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    if (r.kind === 'road') { g.strokeStyle = '#f2e6d0'; g.lineWidth = Math.max(2, 22 * s); g.setLineDash([]); g.stroke(); g.strokeStyle = '#2a2420'; g.lineWidth = Math.max(1.2, 14 * s); g.stroke(); }
    else if (r.kind === 'runway') { g.strokeStyle = '#8d8984'; g.lineWidth = Math.max(2, 30 * s); g.setLineDash([]); g.stroke(); }
    else { g.strokeStyle = '#4a3a2c'; g.lineWidth = Math.max(1, 9 * s); g.setLineDash([Math.max(3, 30 * s), Math.max(2, 22 * s)]); g.stroke(); g.setLineDash([]); }
  }
  // pyramides
  for (const p of KH.pyramids) {
    const hs = (p.side / 2) * s;
    g.fillStyle = '#c9a77c'; g.fillRect(X(p.x) - hs, Z(p.z) - hs, hs * 2, hs * 2);
    g.fillStyle = '#a5845c'; g.beginPath(); g.moveTo(X(p.x), Z(p.z)); g.lineTo(X(p.x) + hs, Z(p.z) - hs); g.lineTo(X(p.x) + hs, Z(p.z) + hs); g.lineTo(X(p.x) - hs, Z(p.z) + hs); g.closePath(); g.fill();
    if (p.beam) { g.fillStyle = '#5ff2e2'; g.beginPath(); g.arc(X(p.x), Z(p.z), Math.max(2, 10 * s), 0, TAU); g.fill(); }
  }
  // lieux
  if (opts.pins !== false) {
    const R = Math.max(7, 60 * s);
    g.font = `700 ${Math.round(R * 1.15)}px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const L of KH.locs) {
      g.fillStyle = '#a8432a'; g.beginPath(); g.arc(X(L.x), Z(L.z), R, 0, TAU); g.fill();
      g.strokeStyle = '#f5e6cf'; g.lineWidth = Math.max(1, R * 0.16); g.stroke();
      g.fillStyle = '#fff4e2'; g.fillText(L.id, X(L.x), Z(L.z) + R * 0.06);
    }
  }
  g.restore();
  return c;
}

/* ---------------------------------------------------------------- Carte --
   Khamsin dans le catalogue : une carte « ouverte » (open), sans grille. */
const KHAMSIN = {
  id: 'khamsin', open: true, format: 1, name: 'Khamsin',
  description: 'Désert égyptien. Douze kilomètres carrés entre la mer de sable et le Nil, sept lieux reliés par la route du Km 47. Le faisceau de la Grande Pyramide guide les survivants.',
  eyebrow: 'Rapport d’incident · Khamsin · route du Km 47',
  lead: 'Survivez dans le désert le plus longtemps possible, ou réunissez les trois pièces de l’avion, abattez le Gardien du sanctuaire et décollez de l’aérodrome.',
  rules: { startPoints: 500, startWeapon: 'm1911', powerOn: false, boxWeapons: null },
  spawn: { pos: [2350, 1992], yaw: 0.47, lv: 0 },
  ambiance: { sky: '#e6ad74', fog: '#e6ad74', fogDensity: 0.00058, hemiSky: '#9aa9c2', hemiGround: '#c8915c', hemi: 0.8, exposure: 1.0, moon: false, trees: 0, pipes: false, wallHeight: 3.5 },
  boxes: [], perks: [], doors: [], wallbuys: [], lights: [], signs: [], props: [], zones: [], risers: [], power: null, amp: null, digipass: null, altar: true,
  thumb: null, menuCam: null, seed: 4747, updated: '2026-10-09',
};
function khThumb() {
  if (!KHAMSIN.thumb) { try { KHAMSIN.thumb = khPlanCanvas(640, 360).toDataURL('image/jpeg', 0.86); } catch (e) { KHAMSIN.thumb = null; } }
  return KHAMSIN.thumb;
}
/* Catalogue vu par les Mod Tools (window.ZS.MAPS) : sans les cartes ouvertes, qui ne s'éditent pas. */
function editorMaps() {
  const byId = Object.create(null);
  for (const id in MAPS.byId) if (!MAPS.byId[id].open) byId[id] = MAPS.byId[id];
  return { list: MAPS.list.filter((id) => byId[id]), byId };
}

/* --------------------------------------------------------- Chargement -- */
function owLoad(map, opts = {}) {
  disposeWorld();
  khepeshClear();                                       // jeu 2.0.4 : sang du khépesh effacé, khépesh rangé
  KHPY.on = false; KHPY.items = []; KHPY.doors = []; KHPY.view = 0; KHPY.pz = null; KHPY.cz = null; KHPY.lastZone = null; OW.pyrMeshes = [];   // pyramides (jeu 2.0.3)
  CUR.map = map; CUR.editor = !!opts.editor;
  // grille vide (8 × 8 cases) : le code de la grille ne voit rien ; tout passe par OW
  LV = [0]; LVY = new Float32Array([0]); LI0 = 0; WALL_H = 3.5; LVL_H = 3.8;
  allocGrid(8, 8, 1); airBands = [];
  LAYOUT = {
    zones: (owWorldOf(map.base) === 'lune' ? LU.locs : KH.locs).map((L) => ({ name: L.name, auto: false })), startZone: 0,
    doors: {}, wallbuys: [], perks: [], boxes: [], boxStart: 0, power: null, amp: null, digipass: null, lights: [], signs: [], spawn: map.spawn,
  };
  CUR.levels = [0];
  Lanterns.lights = [];
  OW.on = true; OW.map = map;
  // monde de la base (le désert ou la Lune), créé la première fois
  owUseWorld(owWorldOf(map.base));
  if (OW.worldId === 'lune') { luLoad(map, opts); return; }
  luUnload();                                          // depuis la Lune : jauge d'oxygène, objectifs, son de la combinaison
  luGravity(false); LUS.on.value = 0;
  // solides de la base (Khamsin et ses lieux, ou le désert vierge)
  owUseBase(map.base);
  const places = owBaseHasPlaces();
  if (!map.menuCam) {
    const cam = [2405, 0, 2085];
    cam[1] = owH(cam[0], cam[2]) + 2.4;
    map.menuCam = { pos: cam, look: [2120, owH(2120, 1240) + 70, 1240], sway: [3, 1.5], auto: true };
  }
  // éléments de la carte précédente (ou d'avant une modification) : leurs cases sont retirées
  owBoxRelease();
  owLogUndoAll();
  registerCustomModels(map);
  registerCustomTextures(map);                          // jeu 2.0.3 : images des surfaces du décor
  KHS.every = map.rules && Number.isFinite(map.rules.storms) ? map.rules.storms : 4;
  // terrain de la carte (relief, sol peint, routes et bâtiments ajoutés) : refait s'il change, ou si
  // la carte d'avant le changeait (les Mod Tools tiennent leurs grilles de travail à jour)
  if (!opts.editor) OWMOD.live = false;
  if (owModsActive(map) || OWMOD.on) { owApplyMods(map); OWH.bg = null; }
  else OW.roadsUser = [];
  OW.locsShown = owNamedLocs(map);
  const root = new THREE.Group();
  root.name = 'monde';
  owBuildTerrainChunks(root);
  owBuildRoads(root);
  owBuildUserRoads(root);
  owBuildWater(root);
  owBuildSky(root);
  owBuildPyramids(root);
  owBuildPalms(root);
  if (places) {
    owBuildPoles(root);
    owBuildPlaces(root);
    owBuildSanctuary(root);
    khPortalInteractables();
    owBuildQuest(root);
    owBuildTunnel(root);
    owItemsWrite();                                    // jeu 2.0.3 : cases des pièces retouchables du décor, en dernier
    khPyrFaces();                                      // jeu 2.0.3 : faces nord échancrées derrière les portails
    khPyrInteractables();                              // herses payantes des pyramides
  } else khInertPlaces(root);
  owBuildElements(root, map, { perProp: !!opts.editor });
  owBuildFarRing(root);
  owBuildSandWall(root);
  World.root = root;
  linearizeTree(root);
  scene.add(root);
  owSandPool();
  camera.near = 0.1; camera.far = 4300; camera.updateProjectionMatrix();
  OW.lastLoc = null;
  owHud(!opts.editor);
  OWNAV.ready = false;
  Zombies.flowT = 0; Zombies.lastCell = -1;
  owShadows();
  owUpdateTerrainLod(true);
  owApplyGrade(0);
  // jeu 2.0.4 : le khépesh, arme de corps-à-corps du désert, fait au premier chargement en partie
  if (!opts.editor && !Khepesh) buildKhepesh();
}
/* Ombres du soleil : carte de 1 024 (moyenne) ou 2 048 texels (haute) sur ±55 ou ±80 m ; aucune en basse qualité. */
function owShadows() {
  const q = settings.quality, on = q !== 'low', L = OW.sunLight;
  renderer.shadowMap.enabled = on;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (!L) return;
  L.castShadow = on;
  const size = q === 'high' ? 2048 : 1024, R = q === 'high' ? 80 : 55;
  L.shadow.mapSize.set(size, size);
  const c = L.shadow.camera;
  c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 20; c.far = 700; c.updateProjectionMatrix();
  L.shadow.bias = -0.0005; L.shadow.normalBias = 0.04;
  if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; }
  OW.shadowT = (2 * R) / size;
}
/* Retour à une carte en grille : la caméra et le HUD reprennent leurs réglages. */
function owUnload() {
  if (!OW.on && !OW.hudOn) return;
  khepeshClear();                                       // jeu 2.0.4 : pas de sang du désert sur une autre carte
  if (OW.worldId === 'lune') luUnload();
  luGravity(false); LUS.on.value = 0;
  OW.on = false; OW.map = null;
  camera.near = 0.05; camera.far = 220; camera.updateProjectionMatrix();
  renderer.shadowMap.enabled = false;
  if (KHS.snd) KHS.snd.g.gain.value = 0;
  for (const m of KHS.walls ? KHS.walls.meshes : []) m.visible = false;
  if (KHS.streaks) KHS.streaks.mesh.visible = false;
  if (KHE.pts) KHE.pts.visible = false;
  KHSAN.under = false; if (KHP.el) khFade(false, 0.01);
  if (KHG.R) { KHG.R.root.visible = false; KHG.tornado.group.visible = false; } KHG.e = null; khBossBar(null);
  if (KHQ.hud) KHQ.hud.hidden = true; khPlaneSound(false); KHT.ride = null; KHSAN.view = 'surface';
  if (MOON) { MOON.scale.set(30, 30, 1); MOON.material.opacity = 0.8; }
  OW.lastLoc = null;
  owHud(false);
}

/* --------------------------------------------------------- Chaque image -- */
function owUpdateView(dt) {
  if (!OW.on) return;
  if (OW.worldId === 'lune') { luUpdateView(dt); return; }
  OW.t += dt;
  OW.sky.position.copy(camera.position);
  OW.sky.material.uniforms.uTime.value = OW.t;
  OWTER.t -= dt;
  if (OWTER.t <= 0) { OWTER.t = 0.2; owUpdateTerrainLod(false); owUpdateRoads(); }
  if (OW.sandWall) OW.sandWall.material.uniforms.uTime.value = OW.t;
  owLightsUpdate(dt);
  if (OW.beam) {
    const k = 0.85 + Math.sin(OW.t * 2.1) * 0.08 + Math.sin(OW.t * 7.3) * 0.04;
    const dark = clamp(1.2 - (OW.grade ? OW.grade.sunI * Math.max(0.15, OW.grade.dir.y) * 1.6 + OW.grade.hemiI * 0.3 : 1), 0, 1);
    OW.beam.core.material.opacity = 0.9 * k; OW.beam.halo.material.opacity = (0.3 + 0.55 * dark) * k; OW.beam.star.material.opacity = 0.35 + 0.6 * dark;
    OW.beam.star.material.rotation = Math.sin(OW.t * 0.3) * 0.05;
  }
  owApplyGrade(dt);
}
function owUpdate(dt) {
  if (OW.worldId === 'lune') { luUpdate(dt); return; }
  owUpdateView(dt);
  if (OW.sandFX) OW.sandFX.update(dt);
  const places = owBaseHasPlaces();
  khStormUpdate(dt);
  if (places) { khSanctuaryUpdate(dt); khPyrUpdate(dt); }
  owVehUpdate(dt);
  khRodeurs(dt);
  if (places) { khGardienStormTick(dt); khQuestUpdate(dt); }
  khEyes();
  // nom du lieu en entrant (lieux de la base et de la carte)
  const near = owNearestNamed(player.pos.x, player.pos.z);
  const inside = near && near.d < 0 ? near.loc : null;
  if (inside && inside !== OW.lastLoc) HUD.zone(inside.name);
  OW.lastLoc = inside || (!near || near.d > 60 ? null : OW.lastLoc);
  owUpdateHud(dt);
  if (places) { khVictoryCam(dt); khRideCam(dt); }
}

/* ---------------------------------------------------- Mini-carte, boussole --
   Mini-carte en haut à droite (nord en haut, 600 m de côté), boussole en haut au milieu avec le
   faisceau de la Grande Pyramide (turquoise). */
const OWH = { map: null, comp: null, bg: null, t: 0 };
function owHud(on) {
  OW.hudOn = on;
  if (on && !OWH.map) {
    const hud = $('hud');
    OWH.map = el('canvas', 'ow-minimap'); OWH.map.width = 220; OWH.map.height = 220;
    OWH.comp = el('canvas', 'ow-compass'); OWH.comp.width = 520; OWH.comp.height = 46;
    // au volant : vitesse, carburant (à la place de l'arme)
    OWH.drive = el('div', 'ow-drive');
    OWH.drive.innerHTML = '<span class="nm"></span><span class="row"><span class="spd">0</span><span class="u">km/h</span></span><span class="fuel"><i></i></span>';
    OWH.dName = OWH.drive.querySelector('.nm'); OWH.dSpd = OWH.drive.querySelector('.spd'); OWH.dFuel = OWH.drive.querySelector('.fuel i');
    OWH.storm = el('div', 'ow-storm'); OWH.storm.hidden = true;
    hud.append(OWH.map, OWH.comp, OWH.drive, OWH.storm);
  }
  if (OWH.map) { OWH.map.hidden = !on; OWH.comp.hidden = !on; OWH.drive.hidden = true; OWH.storm.hidden = true; }
  if (!on) { luO2Hud(false); if (LUQ.hud) LUQ.hud.hidden = true; }
  if (on && !OWH.bg && OW.H) OWH.bg = OW.worldId === 'lune' ? luPlanCanvas(1000, 1000, { relief: true, pins: false }) : khPlanCanvas(1000, 750, { relief: true, pins: owBaseHasPlaces() });
}
function owUpdateHud(dt) {
  OWH.t -= dt;
  if (OWH.t > 0 || !OWH.map) return;
  OWH.t = 1 / 20;
  const p = player, V = VEH.drive, yaw = V ? V.yaw + (VEH.view ? VEH.lookYaw : 0) : p.yaw;
  // au volant
  HUD.el.hud.classList.toggle('ow-driving', !!V);
  OWH.drive.hidden = !V;
  if (V) {
    OWH.dName.textContent = V.T.name;
    OWH.dSpd.textContent = Math.round(Math.abs(V.v) * 3.6);
    OWH.dFuel.style.width = `${Math.round((V.fuel / V.T.fuel) * 100)}%`;
    OWH.dFuel.parentNode.classList.toggle('low', V.fuel / V.T.fuel < 0.2);
  }
  // boussole : cap du regard, lettres et faisceau
  {
    const c = OWH.comp, g = c.getContext('2d'), W = c.width, Hh = c.height, fovH = 1.9;
    g.clearRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(18,14,11,0.55)'; g.fillRect(0, 10, W, 26);
    const head = -yaw;                       // 0 = nord, sens horaire
    const xAt = (a) => W / 2 + (wrapAngle(a - head) / fovH) * W;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 15px ${FONT_HUD}`;
    const marks = [['N', 0], ['NE', Math.PI / 4], ['E', Math.PI / 2], ['SE', 3 * Math.PI / 4], ['S', Math.PI], ['SO', -3 * Math.PI / 4], ['O', -Math.PI / 2], ['NO', -Math.PI / 4]];
    for (let a = -Math.PI; a < Math.PI; a += Math.PI / 12) {
      const x = xAt(a);
      if (x < 0 || x > W) continue;
      g.fillStyle = 'rgba(245,200,141,0.5)'; g.fillRect(x - 0.5, 14, 1, 6);
    }
    for (const [t, a] of marks) {
      const x = xAt(a);
      if (x < 8 || x > W - 8) continue;
      g.fillStyle = t === 'N' ? '#e9884d' : '#f5e6cf'; g.fillText(t, x, 27);
    }
    const B = OW.beam;
    if (B) {
      const ab = Math.atan2(B.x - p.pos.x, -(B.z - p.pos.z));
      const x = xAt(ab);
      if (x > 4 && x < W - 4) { g.fillStyle = '#5ff2e2'; g.beginPath(); g.moveTo(x, 38); g.lineTo(x - 5, 46); g.lineTo(x + 5, 46); g.closePath(); g.fill(); g.fillRect(x - 1, 8, 2, 30); }
    }
    g.fillStyle = '#e9884d'; g.fillRect(W / 2 - 1, 6, 2, 8);
  }
  // mini-carte (coupée en Tempête : restent la boussole et le faisceau)
  OWH.map.hidden = OW.mapMode === 'off';
  if (OW.mapMode !== 'off') {
    const c = OWH.map, g = c.getContext('2d'), S = c.width, R = 300, bg = OWH.bg;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 3, 0, TAU); g.clip();
    g.fillStyle = '#120e0b'; g.fillRect(0, 0, S, S);
    if (bg) {
      const k = bg.width / OW.W;            // pixels du fond par mètre
      g.drawImage(bg, (p.pos.x - R) * k, (p.pos.z - R) * k, 2 * R * k, 2 * R * k, 0, 0, S, S);
    }
    const scale = S / (2 * R), X = (x) => S / 2 + (x - p.pos.x) * scale, Z = (z) => S / 2 + (z - p.pos.z) * scale;
    // boîte mystère (sa lueur bleue)
    const bx = Features.box;
    if (bx && bx.root.visible) {
      const L = bx.locs[bx.cur], x = X(L.x), z = Z(L.z);
      if (x > -6 && z > -6 && x < S + 6 && z < S + 6) { g.fillStyle = '#5fa8ff'; g.strokeStyle = '#120e0b'; g.lineWidth = 1.5; g.fillRect(x - 4, z - 3, 8, 6); g.strokeRect(x - 4, z - 3, 8, 6); }
    }
    // véhicules (orange : les humains et leurs machines)
    for (const W of VEH.list) {
      const x = X(W.x), z = Z(W.z);
      if (x < -10 || z < -10 || x > S + 10 || z > S + 10) continue;
      g.save(); g.translate(x, z); g.rotate(-W.yaw);
      g.fillStyle = W === V ? '#f5c88d' : '#e9884d'; g.strokeStyle = '#120e0b'; g.lineWidth = 1.5;
      const l = Math.max(5, W.T.len * scale), w = Math.max(3.5, W.T.wid * scale);
      g.fillRect(-w / 2, -l / 2, w, l); g.strokeRect(-w / 2, -l / 2, w, l);
      g.restore();
    }
    if (owBaseHasPlaces()) { if (OW.worldId === 'lune') luQuestMapMarks(g, X, Z, S); else khQuestMapMarks(g, X, Z, S); }
    // lieux hors du cadre : flèches au bord
    g.font = `700 13px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const L of OW.locsShown || OW.locs || KH.locs) {
      let x = X(L.x), z = Z(L.z);
      const dx = x - S / 2, dz = z - S / 2, d = Math.hypot(dx, dz), lim = S / 2 - 14;
      if (d > lim) { x = S / 2 + (dx / d) * lim; z = S / 2 + (dz / d) * lim; }
      g.fillStyle = '#a8432a'; g.beginPath(); g.arc(x, z, 9, 0, TAU); g.fill();
      g.fillStyle = '#fff4e2'; g.fillText(L.id, x, z + 1);
    }
    // joueur : flèche dans le sens du regard
    g.translate(S / 2, S / 2); g.rotate(-yaw);
    g.fillStyle = '#f5c88d'; g.strokeStyle = '#120e0b'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath(); g.stroke(); g.fill();
    g.restore();
    if (OW.mapMode === 'scramble') {
      // vent de sable : au-delà de 200 m, le signal se perd
      g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 3, 0, TAU); g.arc(S / 2, S / 2, (S / 2) * (200 / R), 0, TAU, true); g.clip();
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${150 + Math.random() * 90 | 0},${110 + Math.random() * 70 | 0},${70 + Math.random() * 40 | 0},0.9)`; g.fillRect(Math.random() * S, Math.random() * S, 3, 3); }
      g.restore();
    }
    g.strokeStyle = 'rgba(245,200,141,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 3, 0, TAU); g.stroke();
    g.fillStyle = '#e9884d'; g.font = `700 14px ${FONT_HUD}`; g.fillText('N', S / 2, 12);
  }
}

/* ----------------------------------------------------- Effets du désert --
   Grains de sable (impacts de balles, zombies qui sortent du sable), éclairage de l'arme en plein
   jour, taches posées dans la pente. */
function owSandPool() {
  if (OW.sandFX) return OW.sandFX;
  // couleur des points prise telle quelle (comme les autres particules) : on la donne en linéaire
  const m = new THREE.PointsMaterial({ color: new THREE.Color(0xcfa676).convertSRGBToLinear(), size: 0.085, map: TEX.glow, alphaTest: 0.35 });
  OW.sandFX = new PointPool(220, share(m), 9.8, false);
  scene.add(OW.sandFX.points);
  return OW.sandFX;
}
function owSandHit(x, y, z, nx, ny, nz) {
  const P = owSandPool();
  for (let i = 0; i < 7; i++) P.emit(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03, nx * rand(0.4, 1.4) + rand(-0.7, 0.7), ny * rand(0.6, 2) + rand(0.3, 1.4), nz * rand(0.4, 1.4) + rand(-0.7, 0.7), rand(0.35, 0.8));
  spawnPuff(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08, rand(0.3, 0.5), rand(0.55, 0.9), 0xb88a5a, 0.45, 0.25);
}
function owSandBurst(x, z, y) {
  const P = owSandPool();
  for (let i = 0; i < 16; i++) P.emit(x + rand(-0.35, 0.35), y + 0.05, z + rand(-0.35, 0.35), rand(-1.3, 1.3), rand(1.6, 3.8), rand(-1.3, 1.3), rand(0.5, 1));
  spawnPuff(x, y + 0.4, z, 1.6, 1.4, 0xb08458, 0.55, 0.35);
}
/* Arme en main : plus de lumière au soleil qu'au fond du bunker (0,42 à 1,1 comme ailleurs). */
function owViewLum() {
  if (OW.worldId === 'lune') return LU.inside ? 0.85 : clamp(0.5 + 0.6 * luSunAt(player.pos.x, player.gy + 1.5, player.pos.z), 0.42, 1.1);
  const g = OW.grade;
  return g ? clamp(0.32 + g.sunI * 0.22 + g.hemiI * 0.35, 0.42, 1.1) : 0.8;
}
/* Tache à plat (sang, brûlure) sur le terrain : elle suit la pente. */
const _owDec = { x: 0, y: 1, z: 0, y0: 0 };
function owDecalSlope(x, y, z) {
  if (owKind(OW.surf, Math.floor(x), Math.floor(z)) !== OWK.TERRAIN || owLayerAt(x, y, z)) return null;
  const g = owH(x, z);
  if (Math.abs(y - g) > 0.3) return null;
  owNormal(x, z, _owDec);
  _owDec.y0 = g;
  return _owDec;
}

/* Nouvelle partie, retour au menu : véhicules à leur place, disjoncteurs relevés. */
function owResetWorld() {
  if (OW.worldId === 'lune') { luResetWorld(); khEnemiesReset(); owResetFeatures(); return; }
  khStormReset();
  if (owBaseHasPlaces()) { khSanctuaryReset(); khGardienReset(); khQuestReset(); khTunnelReset(); khPyrReset(); }
  khEnemiesReset();
  owResetVehicles();
  owResetFeatures();
}
