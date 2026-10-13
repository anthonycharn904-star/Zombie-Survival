/* ------------------------------------------------- Lune : éléments de jeu --
   Armes au mur (dans les modules de la base, la gare, le poste, les cabines), les cinq Élixirs (un par
   lieu : la base, la crête, la tour, le plateau, la foreuse), la boîte mystère en caisse de
   ravitaillement (liseré cyan), deux disjoncteurs au poste de la crête solaire (le courant vient des
   mâts), des postes d'oxygène (bouteilles à acheter dehors), Le Glas au fond, dans l'ombre éternelle.
   Nouveaux genres d'éléments des cartes ouvertes : oxy (poste d'oxygène) et glas (la cloche). */
Object.assign(OMBRE, {
  wallbuys: [
    { w: 'kar98k', x: 878, z: 858.8, nx: 0, nz: 1, h: 1.55 },
    { w: 'mp40', x: 873, z: 858.8, nx: 0, nz: 1, h: 1.55 },
    { w: 'g43', x: 878, z: 863.2, nx: 0, nz: -1, h: 1.55 },
    { w: 'trench', x: 873, z: 863.2, nx: 0, nz: -1, h: 1.55 },
    { w: 'stg44', x: 879, z: 790, nx: 0, nz: 1, h: 1.7 },
    { w: 'type100', x: 875, z: 802, nx: 0, nz: -1, h: 1.7 },
    { w: 'dbarrel', x: 395.5, z: 707, nx: 0, nz: 1, h: 1.6 },
    { w: 'fg42', x: 485, z: 384, nx: 0, nz: -1, h: 1.6 },
    { w: 'ppsh', x: 1000.5, z: 439, nx: 0, nz: -1, h: 1.6 },
    { w: 'mg42', x: 696, z: 1010, nx: 0, nz: -1, h: 1.6 },
    { w: 'bar', x: 698, z: 1004, nx: 0, nz: 1, h: 1.6 },
    { w: 'thompson', x: 554, z: 969, nx: 0, nz: 1, h: 1.5 },
  ],
  perks: [
    { p: 'souffle', x: 893, z: 882.95, face: [0, -1], roomH: 3 },
    { p: 'endurance', x: 391.5, z: 707.05, face: [0, 1], roomH: 3.6 },
    { p: 'detente', x: 483.05, z: 381.5, face: [1, 0], roomH: 3.4 },
    { p: 'mainleste', x: 994, z: 438.95, face: [0, -1], roomH: 3.6 },
    { p: 'cuirasse', x: 698.95, z: 1007, face: [-1, 0], roomH: 3.4 },
  ],
  boxes: [
    { x: 905, z: 862.55, face: [0, -1] },
    { x: 803, z: 1012, face: [-1, 0] },
    { x: 879.55, z: 797, face: [-1, 0] },
    { x: 392, z: 705.55, face: [0, -1] },
    { x: 484.5, z: 385.45, face: [0, 1] },
    { x: 1012, z: 425, face: [-1, 0] },
    { x: 672.5, z: 1003, face: [1, 0] },
  ],
  boxStart: 0,
  breakers: [
    { x: 387, z: 708.5, nx: 1, nz: 0, name: 'poste de la crête, départ nord' },
    { x: 387, z: 711.4, nx: 1, nz: 0, name: 'poste de la crête, départ sud' },
  ],
  oxy: [
    { x: 872.6, z: 800, face: [1, 0] },
    { x: 398.45, z: 708, face: [1, 0] },
    { x: 484.5, z: 379.45, face: [0, 1] },
    { x: 1002.55, z: 436, face: [-1, 0] },
    { x: 696, z: 1002.55, face: [0, -1] },
    { x: 803, z: 1003, face: [-1, 0] },
  ],
  glas: { x: 668, z: 1022, face: [1, 0] },
});
/* Forme d'une carte relue (openNormalize) : y écrit (null : au sol), clés dans le même ordre. Une
   carte des Mod Tools enregistrée sans modification se relit ainsi à l'identique de la carte intégrée. */
{
  const at = (e) => ({ x: e.x, y: Number.isFinite(e.y) ? e.y : null, z: e.z });
  OMBRE.wallbuys = OMBRE.wallbuys.map((w) => ({ w: w.w, ...at(w), nx: w.nx, nz: w.nz, h: w.h }));
  OMBRE.perks = OMBRE.perks.map((p) => ({ p: p.p, ...at(p), face: p.face, roomH: p.roomH }));
  OMBRE.boxes = OMBRE.boxes.map((b) => ({ ...at(b), face: b.face }));
  OMBRE.breakers = OMBRE.breakers.map((b) => ({ ...at(b), nx: b.nx, nz: b.nz, name: b.name }));
  OMBRE.oxy = OMBRE.oxy.map((o) => ({ ...at(o), face: o.face }));
  OMBRE.glas = { ...at(OMBRE.glas), face: OMBRE.glas.face };
}
LUNE.oxy = []; LUNE.glas = null;
KHAMSIN.oxy = []; KHAMSIN.glas = null; DESERT.oxy = []; DESERT.glas = null;
OPEN_KINDS.push('oxy');
OPEN_LIMITS.oxy = 24;
const LU_OXY = { cost: 250 };

/* Éléments propres à la Lune (appelés par owBuildFeatures) : postes d'oxygène, Le Glas. */
function luBuildFeatures(group, map) {
  LU.oxy = (map.oxy || []).map((o, i) => luOxyStation(group, { ...o, y: owElemY(o) }, i));
  Features.amp = null;
  if (map.glas) luGlas(group, { ...map.glas, y: owElemY(map.glas) });
}
/* ---- Poste d'oxygène : râtelier de quatre bouteilles, manomètre ; F : le plein (4 min) pour 250 */
function luOxyStation(group, o, i) {
  const g = new THREE.Group(), ok = elemK(o.k);
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = Math.atan2(o.face[0], o.face[1]);
  g.scale.setScalar(ok);                                 // jeu 2.0.3 : taille choisie
  const frame = new THREE.MeshStandardMaterial({ color: 0x7a7e82, roughness: 0.5, metalness: 0.6 });
  const bottle = new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.35, metalness: 0.3 });
  const band = new THREE.MeshStandardMaterial({ color: 0x2f8a5a, roughness: 0.5, metalness: 0.2 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.08), frame); back.position.set(0, 0.95, 0.04); g.add(back);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.45), frame); shelf.position.set(0, 0.06, 0.24); g.add(shelf);
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.05, 12), bottle); b.position.set(-0.45 + k * 0.3, 0.62, 0.22); g.add(b);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.12, 12), band); s.position.set(-0.45 + k * 0.3, 0.98, 0.22); g.add(s);
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8), frame); v.position.set(-0.45 + k * 0.3, 1.2, 0.22); g.add(v);
  }
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: 0x9cf0c0 })); gauge.position.set(0.4, 1.6, 0.09); g.add(gauge);
  const plate = vehDecal([['OXYGÈNE', 0.5, 0.5, 700]], 0.8, 0.16, '#e8f0ea'); plate.position.set(-0.15, 1.62, 0.09); g.add(plate);
  group.add(g);
  owFill(OW.surf, o.x - 0.5 * ok, o.z - 0.5 * ok, o.x + 0.5 * ok, o.z + 0.5 * ok, OWK.LOW, { base: o.y, top: o.y + 1.9 * ok, mat: OWM.METAL });
  const S = { ...o, i, g, gauge };
  Features.interactables.push({
    kind: 'oxy', el: true, x: o.x + o.face[0] * (0.55 + 0.45 * ok), z: o.z + o.face[1] * (0.55 + 0.45 * ok), y: o.y, r: 1.5,
    prompt() {
      if (LU.inside) return { text: 'Dans la base, l’oxygène se recharge seul', disabled: true };
      if (LUO.o2 >= LUO.max - 1) return { text: 'Réservoir plein', disabled: true };
      return { text: 'Appuyez sur F pour changer de bouteille', cost: LU_OXY.cost, sub: `Oxygène : ${luO2Text()} · le plein fait 4 min` };
    },
    use() {
      if (LU.inside || LUO.o2 >= LUO.max - 1 || armsBusy()) return;
      if (trySpend(LU_OXY.cost)) { LUO.o2 = LUO.max; LUO.warnT = 0; Sound.luOxy ? Sound.luOxy() : Sound.ui(); HUD.banner('Oxygène', 'Bouteille neuve · 4 min', 'power'); }
    },
  });
  owTagEl(g, 'oxy', i);
  return S;
}
/* ---- Le Glas au fond de la fosse : la cloche du jeu (offrande, coups, paliers), sans plafond ; dans le
   vide, on ne l'entend qu'à travers le sol (les sons passent par le filtre de la combinaison). */
function luGlas(group, o) {
  const a = buildGlas();
  const rot = Math.atan2(o.face[0], o.face[1]), co = Math.cos(rot), si = Math.sin(rot);
  const toWorld = (lx, lz) => [o.x + lx * co + lz * si, o.z - lx * si + lz * co];
  const gk = elemK(o.k);                                  // jeu 2.0.3 : taille choisie
  a.group.position.set(o.x, o.y, o.z);
  a.group.rotation.y = rot;
  a.group.scale.setScalar(gk);
  a.roof.visible = false; a.shaft.visible = false;
  group.add(a.group);
  // socle (2,4 × 1,2 m × k) : cases basses sous lui (à la taille d'origine : ses coins et son centre,
  // comme avant le jeu 2.0.3 ; agrandi ou réduit : une grille de points tous les 0,5 m au plus)
  const cells = [], seen = new Set();
  const put = ([x, z]) => { const c = [Math.floor(x), Math.floor(z)], key = `${c[0]},${c[1]}`; if (!seen.has(key)) { seen.add(key); cells.push(c); } };
  if (Math.abs(gk - 1) < 1e-3) for (const [lx, lz] of [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6], [0, 0]]) put(toWorld(lx, lz));
  else {
    const nx = Math.max(2, Math.ceil(2.4 * gk / 0.5)), nz = Math.max(2, Math.ceil(1.2 * gk / 0.5));
    for (let a2 = 0; a2 <= nx; a2++) for (let b2 = 0; b2 <= nz; b2++) put(toWorld(-1.2 * gk + (2.4 * gk * a2) / nx, -0.6 * gk + (1.2 * gk * b2) / nz));
  }
  for (const [cx, cz] of cells) owSet(OW.surf, cx, cz, OWK.LOW, { base: o.y, top: o.y + 0.95 * gk, mat: OWM.METAL });
  const waves = [];
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial(Object.assign({ map: GLAS_R.T.ring, color: 0xffc861, opacity: 0 }, GLAS_R.add));
    const m = new THREE.Mesh(GLAS_R.G.plane, mat);
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3;
    group.add(m);
    waves.push({ m, mat, on: false, t: 0, dur: 1, R: 1, a: 1 });
  }
  const fp = { cx: o.x, cz: o.z, rot, toWorld, cells, box: [o.x - 3 * gk, o.z - 3 * gk, o.x + 3 * gk, o.z + 3 * gk] };
  const [ix, iz] = toWorld(0, 1.95 * gk);
  const amp = Features.amp = Object.assign(a, {
    li: 0, E: o.y, s: gk, open: false, fp, cx: o.x, cz: o.z, waves, lune: true,
    pos: { x: o.x, y: o.y + 1.6 * gk, z: o.z },
    state: 'mute', t: 0, tier: 0, weapon: null, landed: false, nextT: 0, lastT: 0, holdT: -9,
    lip: -1, flashT: 9, strikeT: 9, ropeT: 9, offerT: 9, sparkT: 0, struck: false,
    models: {}, display: null, called: [],
  });
  glasAnimate(amp, 0);
  Features.interactables.push({
    kind: 'amp', el: true, x: ix, z: iz, y: o.y, r: 1.6, hold: true,
    prompt() { return glasPrompt(amp); },
    useHold() { glasUse(amp); },
  });
  owTagEl(a.group, 'glas', 0);
  return amp;
}
