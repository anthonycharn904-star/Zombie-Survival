/* ------------------------------------------------------------ Accessoires --
   Caisses, fûts, sacs de sable, tables, tentes, conteneurs, cuves, lampadaires (lumières mises en
   commun : quelques vraies lumières suivent le joueur de lampe en lampe, les autres brillent). */
function owCrate(K, x, y, z, s = 1, hex = 0xb08a5c) {
  K.group('Caisse', () => K.box('kh_planks', hex, x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2));
  K.group('Ceinture de la caisse', () => K.box('kh_planks', 0x7a5a3a, x - s / 2 - 0.02, y + s * 0.42, z - s / 2 - 0.02, x + s / 2 + 0.02, y + s * 0.58, z + s / 2 + 0.02));
  if (s >= 0.9) K.solid(x - s / 2 + 0.2, z - s / 2 + 0.2, x + s / 2 - 0.2, z + s / 2 - 0.2, OWK.LOW, { base: y, top: y + s, mat: OWM.WOOD });
}
function owBarrel(K, x, y, z, hex = 0x8d3a28) {
  K.group('Fût', () => K.cyl('kh_sheet', hex, x, y + 0.45, z, 0.3, 0.9, 12));
  K.group('Cercles du fût', () => K.cyl('kh_sheet', 0x4a4440, x, y + 0.91, z, 0.31, 0.03, 12).cyl('kh_sheet', 0x4a4440, x, y + 0.3, z, 0.31, 0.03, 12).cyl('kh_sheet', 0x4a4440, x, y + 0.62, z, 0.31, 0.03, 12));
}
function owSandbags(K, x0, z0, x1, z1, y, rows = 3) {
  const along = Math.abs(x1 - x0) >= Math.abs(z1 - z0), L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.62));
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < n - (r % 2); i++) {
      const t = (i + 0.5 + (r % 2) * 0.5) / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t);
      const hx = along ? 0.31 : 0.2, hz = along ? 0.2 : 0.31;
      K.group('Sac de sable', () => K.box('kh_canvas', [0xa8916a, 0x9c8660, 0xb39a70][(i + r) % 3], x - hx, y + r * 0.22, z - hz, x + hx, y + r * 0.22 + 0.24, z + hz));
    }
  }
  owLine(OW.surf, x0, z0, x1, z1, OWK.LOW, { base: y, top: y + rows * 0.22 + 0.05, mat: OWM.CLOTH });
}
function owTable(K, x, y, z, w = 1.8, d = 0.9, hex = 0x8a6440) {
  K.group('Plateau de la table', () => K.box('kh_planks', hex, x - w / 2, y + 0.72, z - d / 2, x + w / 2, y + 0.78, z + d / 2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.group('Pied de la table', () => K.box('kh_planks', 0x6b4a30, x + sx * (w / 2 - 0.08) - 0.03, y, z + sz * (d / 2 - 0.08) - 0.03, x + sx * (w / 2 - 0.08) + 0.03, y + 0.72, z + sz * (d / 2 - 0.08) + 0.03));
}
/* Tente (toile tendue sur un faîtage) : x0..x1 le long du faîtage ; open : côté ouvert ('n', 's', 'w', 'e') ; murs bas. */
function owTent(K, x0, z0, x1, z1, y, h = 3.2, wallH = 1.4, open = 's', hex = 0xd8c8a2) {
  const along = x1 - x0 >= z1 - z0;
  K.group('Toile du toit', () => K.gable('kh_canvas', hex, x0, z0, x1, z1, y + wallH, h - wallH, along, 'kh_canvas', hex));
  const sides = { n: [x0, z0, x1, z0 + 0.06], s: [x0, z1 - 0.06, x1, z1], w: [x0, z0, x0 + 0.06, z1], e: [x1 - 0.06, z0, x1, z1] };
  const SIDE = { n: 'nord', s: 'sud', w: 'ouest', e: 'est' };
  for (const sd of ['n', 's', 'w', 'e']) {
    const [a, b, c, d] = sides[sd];
    if (sd === open) {
      // pans relevés de l'entrée
      if (sd === 'n' || sd === 's') { K.group(`Pan relevé ${SIDE[sd]}`, () => K.box('kh_canvas', hex, a, y, b, a + 1.2, y + wallH, d)); K.group(`Pan relevé ${SIDE[sd]}`, () => K.box('kh_canvas', hex, c - 1.2, y, b, c, y + wallH, d)); owFill(OW.surf, a, b - 0.5, a + 1, d + 0.5, OWK.SOLID, { base: y, top: y + h * 0.8, mat: OWM.CLOTH }); owFill(OW.surf, c - 1, b - 0.5, c, d + 0.5, OWK.SOLID, { base: y, top: y + h * 0.8, mat: OWM.CLOTH }); }
      else { K.group(`Pan relevé ${SIDE[sd]}`, () => K.box('kh_canvas', hex, a, y, b, c, y + wallH, b + 1.2)); K.group(`Pan relevé ${SIDE[sd]}`, () => K.box('kh_canvas', hex, a, y, d - 1.2, c, y + wallH, d)); }
      continue;
    }
    K.group(`Pan ${SIDE[sd]}`, () => K.box('kh_canvas', hex, a, y, b, c, y + wallH, d));
    // cases pleines le long du côté
    if (sd === 'n' || sd === 's') owFill(OW.surf, x0, sd === 'n' ? z0 : z1 - 1, x1, sd === 'n' ? z0 + 1 : z1, OWK.SOLID, { base: y, top: y + h * 0.8, mat: OWM.CLOTH });
    else owFill(OW.surf, sd === 'w' ? x0 : x1 - 1, z0, sd === 'w' ? x0 + 1 : x1, z1, OWK.SOLID, { base: y, top: y + h * 0.8, mat: OWM.CLOTH });
  }
  // mâts et faîtage
  if (along) { K.group('Mât', () => K.box('kh_planks', 0x6b4a30, x0 + 0.1, y, (z0 + z1) / 2 - 0.05, x0 + 0.2, y + h, (z0 + z1) / 2 + 0.05)).group('Mât', () => K.box('kh_planks', 0x6b4a30, x1 - 0.2, y, (z0 + z1) / 2 - 0.05, x1 - 0.1, y + h, (z0 + z1) / 2 + 0.05)); }
  else { K.group('Mât', () => K.box('kh_planks', 0x6b4a30, (x0 + x1) / 2 - 0.05, y, z0 + 0.1, (x0 + x1) / 2 + 0.05, y + h, z0 + 0.2)).group('Mât', () => K.box('kh_planks', 0x6b4a30, (x0 + x1) / 2 - 0.05, y, z1 - 0.2, (x0 + x1) / 2 + 0.05, y + h, z1 - 0.1)); }
  // intérieur : sol de planches, plafond de toile (arrête les rayons)
  owFill(OW.surf, x0 + 1, z0 + 1, x1 - 1, z1 - 1, OWK.FLOOR, { base: y + 0.05, ceil: y + h - 0.35, roof: y + h, mat: OWM.CLOTH });
  K.group('Plancher', () => K.box('kh_planks', 0xa08060, x0 + 0.1, y, z0 + 0.1, x1 - 0.1, y + 0.05, z1 - 0.1, { skip: ['bottom'] }));
}
/* Conteneur maritime (x0..x1 le long de x ou z), porte ouverte au bout (doorEnd : 0 début, 1 fin). */
function owContainer(K, x0, z0, x1, z1, y, hex, label, doorEnd = 0) {
  const h = 2.6, along = x1 - x0 >= z1 - z0, t = 0.1;
  // parois (tôle peinte), toit, plancher
  if (along) {
    K.group('Paroi', () => K.box('kh_sheet_red', hex, x0, y, z0, x1, y + h, z0 + t)).group('Paroi', () => K.box('kh_sheet_red', hex, x0, y, z1 - t, x1, y + h, z1));
    K.group('Toit', () => K.box('kh_sheet_red', hex, x0, y + h - t, z0, x1, y + h, z1));
    K.group('Fond', () => K.box('kh_sheet_red', hex, doorEnd ? x0 : x1 - t, y, z0, doorEnd ? x0 + t : x1, y + h, z1));
    // portes ouvertes rabattues
    const xd = doorEnd ? x1 : x0;
    K.group('Porte', () => K.box('kh_sheet_red', hex, xd - 0.05, y, z0 - 1.2, xd + 0.05, y + h, z0)).group('Porte', () => K.box('kh_sheet_red', hex, xd - 0.05, y, z1, xd + 0.05, y + h, z1 + 1.2));
    owFill(OW.surf, x0, z0, x1, z0 + 1, OWK.SOLID, { base: y, top: y + h, mat: OWM.METAL });
    owFill(OW.surf, x0, z1 - 1, x1, z1, OWK.SOLID, { base: y, top: y + h, mat: OWM.METAL });
    owFill(OW.surf, doorEnd ? x0 : x1 - 1, z0, doorEnd ? x0 + 1 : x1, z1, OWK.SOLID, { base: y, top: y + h, mat: OWM.METAL });
    owFill(OW.surf, doorEnd ? x0 + 1 : x0, z0 + 1, doorEnd ? x1 : x1 - 1, z1 - 1, OWK.FLOOR, { base: y + 0.12, ceil: y + h - 0.1, roof: y + h, mat: OWM.METAL });
  } else {
    K.group('Paroi', () => K.box('kh_sheet_red', hex, x0, y, z0, x0 + t, y + h, z1)).group('Paroi', () => K.box('kh_sheet_red', hex, x1 - t, y, z0, x1, y + h, z1));
    K.group('Toit', () => K.box('kh_sheet_red', hex, x0, y + h - t, z0, x1, y + h, z1));
    K.group('Fond', () => K.box('kh_sheet_red', hex, x0, y, doorEnd ? z0 : z1 - t, x1, y + h, doorEnd ? z0 + t : z1));
    owFill(OW.surf, x0, z0, x0 + 1, z1, OWK.SOLID, { base: y, top: y + h, mat: OWM.METAL });
    owFill(OW.surf, x1 - 1, z0, x1, z1, OWK.SOLID, { base: y, top: y + h, mat: OWM.METAL });
    owFill(OW.surf, x0, doorEnd ? z0 : z1 - 1, x1, doorEnd ? z0 + 1 : z1, OWK.SOLID, { base: y, top: y + h, mat: OWM.METAL });
    owFill(OW.surf, x0 + 1, doorEnd ? z0 + 1 : z0, x1 - 1, doorEnd ? z1 : z1 - 1, OWK.FLOOR, { base: y + 0.12, ceil: y + h - 0.1, roof: y + h, mat: OWM.METAL });
  }
  K.group('Plancher', () => K.box('kh_planks', 0x7a6248, x0 + t, y, z0 + t, x1 - t, y + 0.12, z1 - t, { skip: ['bottom'] }));
  if (label) {
    const d = vehDecal([[label, 0.62, 0.52, 800]], along ? 3.2 : 1.6, 0.9, '#f2e6cf');
    if (along) { d.position.set((x0 + x1) / 2, y + 1.55, z1 + 0.012); }
    else { d.position.set(x1 + 0.012, y + 1.55, (z0 + z1) / 2); d.rotation.y = Math.PI / 2; }
    K.group('Inscription', () => K.add(d));
  }
}
/* Cuve horizontale (carburant) sur berceaux. */
function owTank(K, x, y, z, r, len, alongX = true, hex = 0xd8d2c4) {
  K.group('Cuve', () => { if (alongX) K.cyl('kh_paint', hex, x, y + r + 0.4, z, r, len, 18, 0, Math.PI / 2); else K.cyl('kh_paint', hex, x, y + r + 0.4, z, r, len, 18, Math.PI / 2, 0); });
  for (const s of [-0.35, 0.35]) {
    const ox = alongX ? s * len : 0, oz = alongX ? 0 : s * len;
    K.group('Berceau', () => K.box('kh_concrete', 0xbdb5a5, x + ox - (alongX ? 0.25 : r * 0.9), y, z + oz - (alongX ? r * 0.9 : 0.25), x + ox + (alongX ? 0.25 : r * 0.9), y + 0.55, z + oz + (alongX ? r * 0.9 : 0.25)));
  }
  const hx = alongX ? len / 2 : r, hz = alongX ? r : len / 2;
  owFill(OW.surf, x - hx + 0.3, z - hz + 0.3, x + hx - 0.3, z + hz - 0.3, OWK.SOLID, { base: y, top: y + 2 * r + 0.4, mat: OWM.METAL });
}

/* ---- Lampes : ampoules et halos ; une réserve de vraies lumières suit le joueur */
const OWL = { lamps: [], pool: [], t: 0 };
function owLamp(K, x, y, z, color = 0xffd7a0, power = false, size = 1) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const bulb = new THREE.Mesh(GEO.sph, mat);
  bulb.position.set(x, y, z); bulb.scale.setScalar(0.12 * size);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.set(x, y, z); halo.scale.set(2.2 * size, 2.2 * size, 1);
  const L = { x, y, z, color: new THREE.Color(color), power, bulb, halo, mat, on: !power, size, pr: null };
  // jeu 2.0.3 : une surface « Lampe » (ampoule, halo, lumière) ; sa lumière la suit
  K.group('Lampe', () => { K.add(bulb); K.add(halo); L.pr = K.cur || null; });
  OWL.lamps.push(L);
  return L;
}
function owLampPost(K, x, y, z, h = 5, color = 0xffc070, power = false, arm = [0.8, 0]) {
  K.group('Poteau', () => K.cyl('kh_sheet', 0x3a3631, x, y + h / 2, z, 0.07, h, 8));
  K.group('Bras du lampadaire', () => K.box('kh_sheet', 0x3a3631, Math.min(x, x + arm[0]) - 0.04, y + h - 0.05, Math.min(z, z + arm[1]) - 0.04, Math.max(x, x + arm[0]) + 0.04, y + h + 0.03, Math.max(z, z + arm[1]) + 0.04));
  owSet(OW.surf, Math.floor(x), Math.floor(z), OWK.SOLID, { base: y, top: y + h, mat: OWM.METAL });
  return owLamp(K, x + arm[0], y + h - 0.2, z + arm[1], color, power);
}
function owLightsInit(root) {
  OWL.pool = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xffd0a0, 0, 16, 2);
    l.position.set(0, -500, 0);
    root.add(l);
    OWL.pool.push(l);
  }
}
/* Toutes les 0,3 s : les lampes allumées les plus proches reçoivent les vraies lumières. */
function owLightsUpdate(dt) {
  OWL.t -= dt;
  const dark = owDarkness();
  for (const L of OWL.lamps) {
    const on = !L.power || G.power;
    if (on !== L.on) { L.on = on; L.mat.color.copy(on ? L.color : new THREE.Color(0x2a2622)); L.halo.visible = on; }
    if (on) L.halo.material.opacity = 0.25 + dark * 0.55;
  }
  if (OWL.t > 0) return;
  OWL.t = 0.3;
  const C = KHT.ride && KHT.cart ? KHT.cart.position : camera.position, px = C.x, pz = C.z;      // en draisine : autour de la draisine
  const layer = KHSAN.view === 'tunnel' ? 2 : KHSAN.under ? 1 : 0;
  // jeu 2.0.3 : dans une pyramide, ses lampes (distance comptée en hauteur aussi) ; dehors, les siennes
  // seulement près de la porte (une lampe n'éclaire pas à travers la pierre)
  const zone = KHPY.cz && KHPY.view > 0.05 ? KHPY.cz.d.key : null, py = C.y;
  const dist = zone ? (L) => Math.hypot(L.x - px, (L.y - py) * 1.6, L.z - pz) : (L) => Math.hypot(L.x - px, L.z - pz);
  const near = OWL.lamps.filter((L) => L.on && (L.layer | 0) === layer && Math.abs(L.x - px) < 60 && Math.abs(L.z - pz) < 60 && ((L.zone || null) === zone || Math.hypot(L.x - px, L.y - py, L.z - pz) < 14))
    .sort((a, b) => dist(a) - dist(b));
  OWL.pool.forEach((l, i) => {
    const L = near[i];
    if (!L) { l.intensity = 0; return; }
    l.position.set(L.x, L.y - 0.15, L.z);
    l.color.copy(L.color);
    l.intensity = (0.4 + dark * 1.6) * L.size;
    l.distance = L.range || 16;
  });
}
