/* ----------------------------------------------------------- Véhicules --
   Planche « Rouler, c'est survivre » (page 6) : 4×4 de fouilles (deux au camp, un à l'oasis,
   gratuits), buggy des sables (garage du relais Km 47, 1 500 points), camion blindé (centrale du
   Nil, une fois le courant rétabli). Vitesses de la planche selon le sol : route goudronnée, piste,
   sable mou. Conduite arcade : direction d'un vélo, roues posées sur le terrain (tangage, roulis),
   chocs contre les murs, les falaises, l'eau et les autres véhicules ; les zombies sont écrasés
   au-dessus d'une vitesse, repoussés en dessous. Seul, le conducteur ne tire pas.
   Repère d'un véhicule : x à droite, y en haut, l'avant vers -z (comme la caméra) ; yaw comme
   celui du joueur (avant = (-sin yaw, -cos yaw)). */
const VEH_TYPES = {
  jeep: {
    name: '4×4 de fouilles', short: 'le 4×4', len: 4.5, wid: 1.86, hgt: 2.1, wb: 2.8, track: 1.56, wr: 0.41,
    vmax: { road: 80, track: 50, sand: 25 }, acc: 4.6, brake: 9, rev: 4.5, steer: 0.56, fuel: 6000,
    protect: 0.5, noise: 60, kill: 6, bog: true, seat: [-0.43, 0.98, 0.1], eye: 0.66, cam: [7.4, 2.8], engine: [34, 1.0],
  },
  buggy: {
    name: 'Buggy des sables', short: 'le buggy', len: 3.7, wid: 1.9, hgt: 1.75, wb: 2.4, track: 1.62, wr: 0.42,
    vmax: { road: 70, track: 65, sand: 55 }, acc: 6.2, brake: 10, rev: 5, steer: 0.62, fuel: 4000,
    protect: 1, noise: 60, kill: 6.5, cost: 1500, seat: [-0.36, 0.55, 0.15], eye: 0.78, cam: [6.4, 2.4], engine: [46, 0.75],
  },
  truck: {
    name: 'Camion blindé', short: 'le camion blindé', len: 8.8, wid: 2.5, hgt: 3.3, wb: 4.6, track: 2.04, wr: 0.6,
    vmax: { road: 55, track: 35, sand: 15 }, acc: 2.6, brake: 6.5, rev: 3, steer: 0.48, fuel: 8000,
    protect: 0.25, noise: 100, kill: 2.2, ram: true, power: true, seat: [-0.62, 1.62, -2.85], eye: 0.8, cam: [12, 4.2], engine: [24, 1.35],
    axles: [-3.0, 1.15, 2.6],
  },
};
// emplacements : ceux de la carte (KHAMSIN.vehicles pour la carte intégrée, plan page 2 : deux 4×4 au
// camp, un à l'oasis, le buggy au garage du relais, le camion à la centrale)
const VEH = { list: [], drive: null, view: 0, lookYaw: 0, lookPitch: 0, lookT: 0, light: null, snd: null, hornT: 0, camPos: new THREE.Vector3(), camInit: false };
const _vf = new THREE.Vector3(), _vr = new THREE.Vector3(), _vq = new THREE.Quaternion(), _ve = new THREE.Euler();
const vehFwd = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];

/* ---- Matières (partagées) */
const VMAT = {};
function vehMaterials() {
  if (VMAT.paint) return VMAT;
  // peinture salie : poussière en bas, rayures (une texture pour toutes les faces)
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  const n = valueNoise(S, S, [[8, 8, 1], [32, 32, 0.5], [128, 128, 0.25]], 1.6);
  paintPixels(g, S, S, (x, y, col) => {
    const v = 236 + (n[y * S + x] - 0.5) * 34 + (Math.random() - 0.5) * 8 - Math.pow(y / S, 3) * 40;
    col[0] = v; col[1] = v * 0.97; col[2] = v * 0.91;
  });
  g.strokeStyle = 'rgba(80,60,40,0.18)'; g.lineWidth = 1;
  for (let i = 0; i < 40; i++) { g.beginPath(); const x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y); g.lineTo(x + rand(-30, 30), y + rand(-4, 4)); g.stroke(); }
  const dirt = share(toTex(c));
  const std = (o) => share(new THREE.MeshStandardMaterial(o));
  VMAT.paint = std({ vertexColors: true, map: dirt, roughness: 0.62, metalness: 0.12 });
  VMAT.dark = std({ vertexColors: true, roughness: 0.88, metalness: 0.05 });
  VMAT.metal = std({ vertexColors: true, roughness: 0.38, metalness: 0.65, envMap: GK.env || (GK.env = genGlasEnv()), envMapIntensity: 0.6 });
  VMAT.glass = std({ color: 0x1d2a33, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.42, envMap: GK.env, envMapIntensity: 1.1, depthWrite: false });
  VMAT.cloth = std({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  // pneu : sculptures (bandes sombres) sur la bande de roulement
  {
    const W2 = 256, H2 = 64, tc = makeCanvas(W2, H2), tg = tc.getContext('2d');
    tg.fillStyle = '#2a2622'; tg.fillRect(0, 0, W2, H2);
    tg.fillStyle = '#161412';
    for (let x = 0; x < W2; x += 16) { tg.fillRect(x, 4, 7, 24); tg.fillRect(x + 8, 36, 7, 24); }
    VMAT.tire = std({ map: toTex(tc), roughness: 0.95 });
  }
  return VMAT;
}
const vcol = (hex) => { const c = new THREE.Color(hex).convertSRGBToLinear(); return [c.r, c.g, c.b]; };
/* Assemblage d'un modèle : pièces regroupées par matière, une géométrie par matière. */
function vehBuilder() {
  const parts = {};
  const B = {
    add(mat, geo, m, hex) { (parts[mat] || (parts[mat] = [])).push({ geo, matrix: m, color: vcol(hex) }); return B; },
    box(mat, hex, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { return B.add(mat, GEO.box, mtx(x, y, z, rx, ry, rz, sx, sy, sz), hex); },
    cyl(mat, hex, x, y, z, r, h, rx = 0, ry = 0, rz = 0, r2) {
      const g = r2 !== undefined ? new THREE.CylinderGeometry(r2, r, 1, 14) : GEO.cyl;
      return B.add(mat, g, mtx(x, y, z, rx, ry, rz, r2 !== undefined ? 1 : r, h, r2 !== undefined ? 1 : r), hex);
    },
    beam(mat, hex, a, b, w) { return B.add(mat, GEO.box, beamMtx(a[0], a[1], a[2], b[0], b[1], b[2], w, w), hex); },
    build(group) {
      for (const mat in parts) {
        const geo = mergeGeometries(parts[mat]);
        const mesh = new THREE.Mesh(geo, VMAT[mat]);
        mesh.name = mat;
        group.add(mesh);
      }
      return group;
    },
  };
  return B;
}
/* Inscription peinte (portières, caisse) : texte sur fond transparent. */
function vehDecal(lines, w, h, color = '#f2e6cf') {
  const c = makeCanvas(512, Math.round((512 * h) / w)), g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [txt, size, y, font] of lines) {
    g.font = `${font || 700} ${Math.round(size * c.height)}px ${FONT_HUD}`;
    g.fillStyle = color; g.globalAlpha = 0.9;
    g.fillText(txt, c.width / 2, y * c.height);
  }
  const m = new THREE.MeshStandardMaterial({ map: toTex(c, { clamp: true }), transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}
/* Roue : pneu (bande sculptée), flancs, jante ; tourne autour de x. */
function vehWheel(r, w, rimHex = 0xb9b2a4) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22, 1, true).rotateZ(Math.PI / 2), VMAT.tire);
  const side = vehBuilder();
  side.cyl('dark', 0x24211e, -w / 2 + 0.005, 0, 0, r * 0.97, 0.01, 0, 0, Math.PI / 2).cyl('dark', 0x24211e, w / 2 - 0.005, 0, 0, r * 0.97, 0.01, 0, 0, Math.PI / 2);
  side.cyl('metal', rimHex, w / 2 - 0.02, 0, 0, r * 0.58, 0.05, 0, 0, Math.PI / 2).cyl('metal', rimHex, -w / 2 + 0.02, 0, 0, r * 0.58, 0.05, 0, 0, Math.PI / 2);
  side.cyl('dark', 0x3a3530, w / 2 + 0.01, 0, 0, r * 0.18, 0.06, 0, 0, Math.PI / 2).cyl('dark', 0x3a3530, -w / 2 - 0.01, 0, 0, r * 0.18, 0.06, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; side.cyl('dark', 0x3a3530, w / 2 + 0.012, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, 0.025, 0.04, 0, 0, Math.PI / 2); }
  g.add(tire);
  side.build(g);
  return g;
}

/* ---- Modèles (dimensions de la planche, graduée en mètres) */
function vehModelJeep(V) {
  const B = vehBuilder(), K = 0xb7a57a, KD = 0x8f7f5c, DK = 0x2b2622;
  // caisse, capot, ailes
  B.box('paint', K, 0, 0.98, 0.15, 1.82, 0.72, 4.0);                 // bas de caisse
  B.box('paint', K, 0, 1.39, -1.68, 1.66, 0.12, 1.12);                // capot
  B.box('paint', KD, 0, 1.31, -1.68, 1.74, 0.06, 1.16);               // joint du capot
  B.box('paint', K, -0.84, 1.2, -1.68, 0.2, 0.36, 1.16).box('paint', K, 0.84, 1.2, -1.68, 0.2, 0.36, 1.16);   // ailes avant
  // habitacle : montants, toit, panneaux sous les vitres
  B.box('paint', K, 0, 1.96, 0.62, 1.82, 0.07, 3.06);                 // toit
  for (const x of [-0.88, 0.88]) {
    B.box('paint', K, x, 1.67, -0.9, 0.07, 0.58, 0.08, 0.1);        // montant A
    B.box('paint', K, x, 1.67, 0.16, 0.07, 0.58, 0.1);               // montant B
    B.box('paint', K, x, 1.67, 1.2, 0.07, 0.58, 0.1);                // montant C
    B.box('paint', K, x, 1.67, 2.1, 0.07, 0.58, 0.12);               // montant D
  }
  B.box('paint', K, 0, 1.4, 2.13, 1.82, 0.12, 0.06);                   // bas de la vitre arrière
  B.box('paint', K, 0, 1.4, -0.92, 1.7, 0.1, 0.08);                    // bas du pare-brise
  // vitres (teintées, un peu en retrait)
  B.add('glass', GEO.box, mtx(0, 1.68, -0.9, 0.1, 0, 0, 1.68, 0.5, 0.02), 0xffffff);
  for (const x of [-0.89, 0.89]) for (const [z, l] of [[-0.37, 0.95], [0.68, 0.94], [1.65, 0.8]]) B.add('glass', GEO.box, mtx(x, 1.68, z, 0, 0, 0, 0.02, 0.5, l), 0xffffff);
  B.add('glass', GEO.box, mtx(0, 1.68, 2.14, 0, 0, 0, 1.6, 0.48, 0.02), 0xffffff);
  // calandre, pare-chocs, passages de roues, marchepieds
  B.box('dark', DK, 0, 1.08, -2.27, 1.3, 0.5, 0.06).box('dark', 0x4a4540, 0, 1.08, -2.3, 1.18, 0.04, 0.02);
  for (let i = 0; i < 6; i++) B.box('dark', 0x5c554c, -0.42 + i * 0.17, 1.1, -2.31, 0.03, 0.4, 0.02);
  B.box('dark', DK, 0, 0.58, -2.33, 1.96, 0.2, 0.18).box('dark', DK, 0, 0.6, 2.28, 1.9, 0.18, 0.14);
  for (const z of [-1.4, 1.4]) for (const x of [-0.98, 0.98]) B.box('dark', DK, x, 1.02, z, 0.16, 0.12, 1.1);
  B.box('dark', DK, -0.96, 0.5, 0, 0.18, 0.06, 1.2).box('dark', DK, 0.96, 0.5, 0, 0.18, 0.06, 1.2);
  // roue de secours sur la porte arrière
  B.cyl('dark', 0x24211e, 0, 1.3, 2.36, 0.38, 0.24, Math.PI / 2).cyl('metal', 0xb9b2a4, 0, 1.3, 2.49, 0.22, 0.04, Math.PI / 2);
  // galerie : cadre, jerricans (vert, rouge), bâche roulée, plaques de désensablage (orange) sur le flanc
  for (const x of [-0.84, 0.84]) B.box('dark', DK, x, 2.06, 0.65, 0.04, 0.04, 2.8);
  for (const z of [-0.7, 0.2, 1.1, 2.0]) B.box('dark', DK, 0, 2.06, z, 1.7, 0.04, 0.04);
  B.box('paint', 0x4f6b3a, -0.45, 2.3, 0.55, 0.18, 0.46, 0.34).box('paint', 0x4f6b3a, -0.22, 2.3, 0.55, 0.18, 0.46, 0.34).box('paint', 0x9c2f22, 0.05, 2.3, 0.55, 0.18, 0.46, 0.34);
  B.cyl('cloth', 0xa58f68, 0.1, 2.2, 1.55, 0.17, 1.5, 0, 0, Math.PI / 2);
  for (let i = 0; i < 2; i++) B.box('paint', 0xe9884d, 0.94, 1.05 + i * 0.07, -0.2 + i * 0.03, 0.04, 0.3, 1.25);
  // phares (ronds), feux arrière, rampe de toit
  for (const x of [-0.62, 0.62]) B.cyl('dark', DK, x, 1.08, -2.29, 0.13, 0.05, Math.PI / 2);
  // antenne fouet et fanion rouge
  B.cyl('dark', 0x1c1a18, 0.86, 2.95, 2.1, 0.012, 2.0);
  // inscriptions des portières : « MISSION ARCHÉO » et le numéro
  for (const sd of [-1, 1]) {
    const d = vehDecal([['MISSION ARCHÉO', 0.22, 0.28, 600], ['03', 0.52, 0.68, 800]], 0.9, 0.42, '#2b2116');
    d.position.set(sd * 0.917, 1.06, -0.32); d.rotation.y = sd * Math.PI / 2;
    V.group.add(d);
  }
  B.build(V.group);
  // fanion (toile qui flotte : animée)
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36, 6, 1).translate(0.31, 0, 0), new THREE.MeshStandardMaterial({ color: 0xa8432a, roughness: 0.9, side: THREE.DoubleSide }));
  flag.position.set(0.86, 3.75, 2.1);
  V.group.add(flag); V.flag = flag;
  vehLamps(V, [[-0.62, 1.08, -2.32], [0.62, 1.08, -2.32]], [[-0.84, 1.15, 2.32], [0.84, 1.15, 2.32]], [[-0.3, 2.04, -0.95], [0, 2.04, -0.95], [0.3, 2.04, -0.95]]);
}
function vehModelBuggy(V) {
  const B = vehBuilder(), O = 0xe9884d, DK = 0x26221e, ST = 0x3b3833;
  // coque : fond, flancs, nez en pente, plage arrière
  B.box('paint', O, 0, 0.55, 0.05, 1.3, 0.3, 2.6);
  B.box('paint', O, 0, 0.6, -1.45, 1.2, 0.18, 0.7, -0.35);
  B.box('paint', O, -0.66, 0.68, 0.05, 0.06, 0.3, 2.4).box('paint', O, 0.66, 0.68, 0.05, 0.06, 0.3, 2.4);
  B.box('paint', 0xc46a35, 0, 0.82, 1.05, 1.36, 0.08, 0.9);
  // arceau (tubes) : longerons, arceaux avant et arrière, toit, renforts
  const T = (a, b) => B.beam('metal', ST, a, b, 0.07);
  for (const s of [-1, 1]) {
    T([s * 0.62, 0.72, -1.15], [s * 0.6, 1.55, -0.35]);            // montant avant
    T([s * 0.6, 1.55, -0.35], [s * 0.6, 1.58, 0.75]);               // toit
    T([s * 0.6, 1.58, 0.75], [s * 0.66, 0.78, 1.25]);               // montant arrière
    T([s * 0.64, 0.75, -1.2], [s * 0.68, 0.75, 1.3]);                // longeron
    T([s * 0.6, 1.58, 0.75], [s * 0.62, 0.8, 0.2]);                  // renfort
    T([s * 0.66, 0.6, -1.25], [s * 0.82, 0.62, -1.62]);              // triangle avant (amortisseur)
  }
  T([-0.6, 1.55, -0.35], [0.6, 1.55, -0.35]); T([-0.6, 1.58, 0.75], [0.6, 1.58, 0.75]); T([-0.6, 1.57, 0.2], [0.6, 1.57, 0.2]);
  T([-0.64, 0.78, -1.2], [0.64, 0.78, -1.2]); T([-0.66, 0.8, 1.25], [0.66, 0.8, 1.25]);
  T([-0.6, 1.58, 0.75], [0.6, 0.85, 1.25]);
  // sièges baquets, volant, moteur à l'arrière, échappements, roue de secours
  for (const x of [-0.34, 0.34]) { B.box('dark', 0x2e2a26, x, 0.78, 0.25, 0.46, 0.14, 0.5).box('dark', 0x2e2a26, x, 1.08, 0.48, 0.46, 0.6, 0.12, -0.25); }
  B.cyl('dark', DK, -0.34, 1.08, -0.38, 0.17, 0.04, 1.1).beam('dark', DK, [-0.34, 0.95, -0.5], [-0.34, 0.75, -0.95], 0.05);
  B.box('metal', 0x8d877c, 0, 0.98, 1.45, 0.62, 0.44, 0.5).box('dark', DK, 0, 1.25, 1.45, 0.5, 0.12, 0.38);
  B.beam('metal', 0x9a8f80, [0.25, 0.85, 1.6], [0.32, 0.9, 1.95], 0.07).beam('metal', 0x9a8f80, [-0.25, 0.85, 1.6], [-0.32, 0.9, 1.95], 0.07);
  B.cyl('dark', 0x24211e, 0, 1.0, 1.0, 0.36, 0.22, 0, 0, Math.PI / 2);
  // amortisseurs avant (ressorts jaunes)
  for (const s of [-1, 1]) B.cyl('paint', 0xd9b23a, s * 0.72, 0.68, -1.2, 0.06, 0.42, 0, 0, s * 0.5);
  // antenne et fanion orange
  B.cyl('dark', 0x1c1a18, 0.6, 2.55, 0.75, 0.012, 2.0);
  B.build(V.group);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32, 6, 1).translate(0.25, 0, 0), new THREE.MeshStandardMaterial({ color: 0xe9884d, roughness: 0.9, side: THREE.DoubleSide }));
  flag.position.set(0.6, 3.35, 0.75);
  V.group.add(flag); V.flag = flag;
  vehLamps(V, [[-0.45, 0.82, -1.66], [0.45, 0.82, -1.66]], [[-0.55, 0.85, 1.32], [0.55, 0.85, 1.32]], [[-0.39, 1.66, -0.36], [-0.13, 1.66, -0.36], [0.13, 1.66, -0.36], [0.39, 1.66, -0.36]]);
}
function vehModelTruck(V) {
  const B = vehBuilder(), OL = 0x5e6a4a, OD = 0x4a5539, DK = 0x24221f, MT = 0x55524c;
  // châssis
  B.box('dark', DK, 0, 0.95, 0.2, 2.0, 0.42, 8.0);
  // cabine blindée (avant), pare-brise en fentes
  B.box('paint', OL, 0, 1.85, -3.25, 2.42, 1.5, 1.9);
  B.box('paint', OD, 0, 2.66, -3.25, 2.3, 0.12, 1.8);
  B.box('paint', OL, 0, 1.55, -4.15, 2.3, 0.85, 0.3, 0.12);                    // nez
  for (const x of [-0.75, -0.25, 0.25, 0.75]) B.add('glass', GEO.box, mtx(x, 2.28, -4.21, 0.12, 0, 0, 0.38, 0.2, 0.03), 0xffffff);
  for (const s of [-1, 1]) B.add('glass', GEO.box, mtx(s * 1.215, 2.3, -3.4, 0, 0, 0, 0.03, 0.22, 0.7), 0xffffff);
  // caisse (refuge roulant) : panneaux, meurtrières, inscription
  B.box('paint', OL, 0, 2.1, 1.25, 2.5, 2.05, 5.6);
  B.box('paint', OD, 0, 3.17, 1.25, 2.38, 0.1, 5.5);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) B.box('paint', OD, s * 1.262, 2.1, -1.2 + i * 1.22, 0.02, 1.9, 0.05);     // joints des panneaux
    for (const z of [-0.75, 0.6, 1.95, 3.3]) B.box('dark', 0x0e0d0c, s * 1.264, 2.45, z, 0.02, 0.09, 0.42);   // meurtrières
  }
  for (const z of [-0.2, 2.7]) B.box('dark', 0x0e0d0c, 0, 2.45, 4.06, 0.42, 0.09, 0.02);
  B.box('paint', OD, 0, 2.05, 4.07, 1.1, 1.75, 0.04);                                         // porte arrière
  // échelle arrière, phare de recherche, bélier à pointes
  for (const x of [-0.95, -0.6]) B.box('dark', DK, x, 1.95, 4.12, 0.05, 2.3, 0.05);
  for (let i = 0; i < 7; i++) B.box('dark', DK, -0.775, 0.95 + i * 0.32, 4.12, 0.35, 0.04, 0.04);
  B.cyl('metal', MT, 0.7, 2.85, -3.6, 0.18, 0.22, Math.PI / 2).box('dark', DK, 0.7, 2.74, -3.55, 0.12, 0.12, 0.12);
  B.box('dark', 0x3a3631, 0, 0.95, -4.45, 2.6, 0.75, 0.25, -0.35);
  for (let i = 0; i < 7; i++) B.add('dark', new THREE.ConeGeometry(0.09, 0.42, 8), mtx(-1.08 + i * 0.36, 0.95, -4.72, -Math.PI / 2, 0, 0), 0x6a645b);
  // ailes (pare-boue) et pare-chocs arrière
  for (const z of [-3.0, 1.15, 2.6]) for (const s of [-1, 1]) B.box('dark', DK, s * 1.12, 1.65, z, 0.3, 0.08, 1.35);
  B.box('dark', DK, 0, 0.75, 4.15, 2.4, 0.18, 0.18);
  const lettering = vehDecal([['CENTRALE DU NIL', 0.42, 0.5, 700]], 3.2, 0.42, '#d8d0b8');
  for (const s of [-1, 1]) { const d = lettering.clone(); d.position.set(s * 1.266, 2.8, 1.25); d.rotation.y = s * Math.PI / 2; V.group.add(d); }
  B.build(V.group);
  vehLamps(V, [[-0.85, 1.55, -4.32], [0.85, 1.55, -4.32]], [[-1.05, 1.0, 4.2], [1.05, 1.0, 4.2]], [[0.7, 2.85, -3.72]]);
}
/* Feux : phares (blanc chaud), feux arrière (rouge), rampe ; une matière par véhicule (allumés ou non). */
function vehLamps(V, heads, tails, extra) {
  const head = new THREE.MeshBasicMaterial({ color: 0x6e6a60, fog: true }), tail = new THREE.MeshBasicMaterial({ color: 0x4a0d08 });
  const g1 = [], g2 = [];
  for (const p of heads.concat(extra)) g1.push({ geo: GEO.sph, matrix: mtx(p[0], p[1], p[2], 0, 0, 0, 0.1, 0.1, 0.05) });
  for (const p of tails) g2.push({ geo: GEO.box, matrix: mtx(p[0], p[1], p[2], 0, 0, 0, 0.14, 0.1, 0.04) });
  const m1 = new THREE.Mesh(mergeGeometries(g1), head), m2 = new THREE.Mesh(mergeGeometries(g2), tail);
  V.group.add(m1, m2);
  V.lampHead = head; V.lampTail = tail; V.heads = heads;
  // halos des phares (sprites additifs, visibles dans la poussière)
  V.halos = heads.map((p) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffe2b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(p[0], p[1], p[2] - 0.08); s.scale.set(1.3, 1.3, 1);
    V.group.add(s);
    return s;
  });
}
const VEH_MODELS = { jeep: vehModelJeep, buggy: vehModelBuggy, truck: vehModelTruck };

/* ---- Création, remise à zéro */
function owBuildVehicles(root, map) {
  vehMaterials();
  VEH.list = [];
  VEH.drive = null;
  const g = new THREE.Group();
  g.name = 'véhicules';
  map.vehicles.forEach((sp, i) => {
    const T = VEH_TYPES[sp.type];
    const V = { id: i, type: sp.type, T, sp, x: sp.x, z: sp.z, yaw: sp.yaw, y: 0, pitch: 0, roll: 0, v: 0, steer: 0, fuel: T.fuel, rot: 0, rpm: 0,
      bought: !T.cost, lights: false, group: new THREE.Group(), body: new THREE.Group(), wheels: [], flag: null, hit: 0, bump: 0, stuckT: 0 };
    V.group.add(V.body);
    const save = V.group;
    V.group = V.body;                          // les pièces vont dans le corps (qui penche) ; les roues aussi
    VEH_MODELS[sp.type](V);
    V.group = save;
    // roues : avant (directrices) et arrière ; essieux du camion
    const axles = T.axles || [-T.wb / 2, T.wb / 2];
    for (const az of axles) for (const s of [-1, 1]) {
      const w = vehWheel(T.wr, sp.type === 'truck' ? 0.42 : 0.3);
      const pivot = new THREE.Group();
      pivot.position.set(s * T.track / 2, T.wr, az);
      pivot.add(w);
      V.body.add(pivot);
      V.wheels.push({ pivot, w, front: az === axles[0], s, z: az });
    }
    vehPose(V, 0, true);
    V.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(V.group);
    owTagEl(V.group, 'vehicle', i);
    VEH.list.push(V);
    const it = vehInteractable(V);
    it.el = true;
    Features.interactables.push(it);
  });
  // projecteur des phares du véhicule conduit (une seule lumière : pas de recompilation des matières ;
  // gardée d'une construction à l'autre)
  const L = VEH.light || new THREE.SpotLight(0xffe6c0, 0, 60, 0.5, 0.45, 1.4);
  L.name = 'phares';
  L.userData.keep = true;
  g.add(L, L.target);
  VEH.light = L;
  root.add(g);
}
function owResetVehicles() {
  if (VEH.drive) vehExit(true);
  for (const V of VEH.list) {
    V.x = V.sp.x; V.z = V.sp.z; V.yaw = V.sp.yaw; V.v = 0; V.steer = 0; V.fuel = V.T.fuel; V.bought = !V.T.cost; V.lights = false; V.stuckT = 0; V.stuck = false; V.bogT = 0; V.plateT = 0;
    V.flipT = 0; V.flipped = V.flipping = V.unflipping = false; V.unflipT = 0; V.dented = false;
    vehPose(V, 0, true);
  }
}
/* Sol sous le véhicule : route, piste ou sable mou. */
function vehSurface(x, z) {
  const b = owBioAt(x, z);
  if (b === OWB.ROAD || b === OWB.RUNWAY) return 'road';
  if (b === OWB.TRACK || b === OWB.PAD || b === OWB.PLATEAU || b === OWB.WADI || b === OWB.FIELD || b === OWB.MUD || b === OWB.ROCK) return 'track';
  return 'sand';
}
/* Peut-on rouler sur ce point ? (falaises, eau, murs, objets, bords de la carte) */
function vehCellFree(x, z, gy, T) {
  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(OW.surf, cx, cz);
  if (!ch) return owTerrainWalk(x, z);
  const i = owIdx(cx, cz), k = ch.kind[i];
  if (k === OWK.TERRAIN) return owTerrainWalk(x, z);
  if (k === OWK.FLOOR || k === OWK.RAMP) return !(ch.ceil[i] > 0) || ch.ceil[i] - ch.base[i] > T.hgt + 0.1;
  if (k === OWK.DOOR) return ch.door[i] >= 0 && OW.doors[ch.door[i]] && OW.doors[ch.door[i]].open;
  return false;
}
/* Pose (x, z, yaw) libre ? Points du pourtour, autres véhicules. */
function vehBlocked(V, x, z, yaw) {
  const T = V.T, [fx, fz] = vehFwd(yaw), rx = -fz, rz = fx, hl = T.len / 2, hw = T.wid / 2;
  const pts = [[hl, hw], [hl, -hw], [hl, 0], [-hl, hw], [-hl, -hw], [-hl, 0], [0, hw], [0, -hw], [hl * 0.5, hw], [hl * 0.5, -hw], [-hl * 0.5, hw], [-hl * 0.5, -hw]];
  for (const [f, r] of pts) {
    const px = x + fx * f + rx * r, pz = z + fz * f + rz * r;
    if (!vehCellFree(px, pz, V.y, T)) return { x: px, z: pz };
  }
  for (const O of VEH.list) {
    if (O === V || Math.hypot(O.x - x, O.z - z) > (O.T.len + T.len) / 2 + 0.5) continue;
    for (const [f, r] of pts) {
      const px = x + fx * f + rx * r, pz = z + fz * f + rz * r;
      if (vehInside(O, px, pz, 0.1)) return { x: px, z: pz, veh: O };
    }
    // et ses coins dans le nôtre
    const [ofx, ofz] = vehFwd(O.yaw), orx = -ofz, orz = ofx, ol = O.T.len / 2, ow = O.T.wid / 2;
    for (const [f, r] of [[ol, ow], [ol, -ow], [-ol, ow], [-ol, -ow]]) {
      const px = O.x + ofx * f + orx * r, pz = O.z + ofz * f + orz * r;
      if (vehInsideAt(x, z, yaw, T, px, pz, 0.1)) return { x: px, z: pz, veh: O };
    }
  }
  return null;
}
function vehInsideAt(x, z, yaw, T, px, pz, m) {
  const [fx, fz] = vehFwd(yaw), dx = px - x, dz = pz - z;
  const lf = dx * fx + dz * fz, lr = dx * -fz + dz * fx;
  return Math.abs(lf) < T.len / 2 + m && Math.abs(lr) < T.wid / 2 + m;
}
const vehInside = (V, px, pz, m) => vehInsideAt(V.x, V.z, V.yaw, V.T, px, pz, m);

/* Pose sur le terrain : hauteur des roues, tangage, roulis (amortis). */
function vehPose(V, dt, snap) {
  const T = V.T, [fx, fz] = vehFwd(V.yaw), rx = -fz, rz = fx, a = T.wb / 2, b = T.track / 2;
  const h = (f, r) => { const g = owGroundAt(0, V.x + fx * f + rx * r, V.z + fz * f + rz * r); return Number.isFinite(g) ? g : V.y; };
  const fl = h(a, -b), fr = h(a, b), rl = h(-a, -b), rr = h(-a, b);
  const y = (fl + fr + rl + rr) / 4, pitch = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, T.wb), roll = Math.atan2((fr + rr) / 2 - (fl + rl) / 2, T.track);
  if (snap) { V.y = y; V.pitch = pitch; V.roll = roll; V.vy = 0; }
  else {
    // suspension : le corps suit le sol avec un peu de retard ; une chute (rebord) se fait en tombant
    if (V.y > y + 0.25) { V.vy = (V.vy || 0) - 14 * dt; V.y = Math.max(y, V.y + V.vy * dt); if (V.y === y) { V.bump = Math.min(1, -V.vy / 8); V.vy = 0; } }
    else { V.y = damp(V.y, y, 18, dt); V.vy = 0; }
    V.pitch = damp(V.pitch, pitch, 10, dt); V.roll = damp(V.roll, roll, 10, dt);
  }
  V.group.position.set(V.x, V.y, V.z);
  _ve.set(V.pitch, V.yaw, V.roll, 'YXZ');
  V.group.quaternion.setFromEuler(_ve);
  if (V.flipT) khVehFlipPose(V);                  // renversé par le Gardien
}

/* ---- Monter, descendre */
function vehInteractable(V) {
  return {
    get x() { return V.x; }, get z() { return V.z; }, get y() { return V.y; },
    get r() { return V.T.len / 2 + 1.4; }, veh: V,
    get hold() { return (!!V.stuck || !!V.flipped) && !VEH.drive; },
    useHold(dt) {
      if (V.flipped) {
        if (V.unflipping) return;
        V.unflipT = (V.unflipT || 0) + dt;
        if (V.unflipT >= 5) { V.unflipping = true; V.unflipT = 0; Sound.boardPlace({ x: V.x, z: V.z }); HUD.hint(`${V.T.name} : sur ses roues`, 2); }
        return;
      }
      V.plateT += dt;
      if (Math.random() < dt * 4) owSandBurst(V.x + rand(-1, 1), V.z + rand(-1, 1), V.y);
      if (V.plateT >= 10) { V.stuck = false; V.plateT = 0; Sound.boardPlace({ x: V.x, z: V.z }); HUD.hint('Dégagé : les plaques sont rangées sur le flanc', 2.5); }
    },
    prompt() {
      if (VEH.drive || G.state !== 'playing') return null;
      if (V.flipping || V.unflipping) return null;
      if (V.flipped) return { text: 'Maintenez F pour remettre le véhicule sur ses roues', sub: `${Math.round(((V.unflipT || 0) / 5) * 100)} %` };
      if (V.T.power && !G.power) return { text: `${V.T.name} : sans courant`, disabled: true, sub: 'Rétablissez le courant à la centrale' };
      if (!V.bought) return { text: `Acheter ${V.T.short}`, cost: V.T.cost };
      if (V.stuck) return { text: 'Maintenez F pour poser les plaques de désensablage', sub: `${Math.round((V.plateT / 10) * 100)} %` };
      return { text: `Conduire ${V.T.short}`, sub: V.fuel <= 0 ? 'Réservoir vide : faites le plein aux jerricans' : `Carburant ${Math.round((V.fuel / V.T.fuel) * 100)} %` };
    },
    use() {
      if (VEH.drive || V.flipped || V.flipping || V.unflipping) return;
      if (V.T.power && !G.power) { Sound.deny(); return; }
      if (!V.bought) { if (!trySpend(V.T.cost)) return; V.bought = true; HUD.banner(V.T.name, 'Il est à vous', 'power'); }
      vehEnter(V);
    },
  };
}
function vehEnter(V) {
  VEH.drive = V;
  VEH.view = 0; VEH.lookYaw = 0; VEH.lookPitch = -0.12; VEH.lookT = 0; VEH.camInit = false;
  if (Couteau) Couteau.annuler();
  if (Khepesh) Khepesh.annuler();                      // jeu 2.0.4 : le khépesh du désert
  KnifeLunge.m = 0;
  if (Arms.state === 'nade') { /* la grenade dégoupillée reste en main : rien */ }
  Arms.root.visible = false;
  player.sprinting = false; player.ads = 0; player.crouch = 0; player.y = 0; player.vy = 0; player.grounded = true;
  player.yaw = V.yaw; player.pitch = 0;
  vehSeat(V);
  HUD.hint('Z/S accélérer, freiner · Q/D tourner · Espace frein · C vue · L phares · F descendre', 5);
  vehSoundStart(V);
}
/* Le joueur suit le siège du conducteur. */
function vehSeat(V) {
  const T = V.T, [fx, fz] = vehFwd(V.yaw), s = T.seat;
  player.pos.x = V.x + -fz * s[0] + fx * -s[2];
  player.pos.z = V.z + fx * s[0] + fz * -s[2];
  player.gy = V.y; player.pos.y = V.y;
  player.layer = 0;
  player.k = owLocate(player.pos.x, player.pos.z, V.y);
}
/* Descendre : à gauche, sinon à droite, derrière, devant (une place libre au sol). */
function vehExit(force) {
  const V = VEH.drive;
  if (!V) return;
  if (!force && Math.abs(V.v) > 4) { HUD.hint('Ralentissez pour descendre', 1.5); return; }
  const T = V.T, [fx, fz] = vehFwd(V.yaw), rx = -fz, rz = fx;
  const spots = [[T.seat[2] * -1, -(T.wid / 2 + 0.7)], [T.seat[2] * -1, T.wid / 2 + 0.7], [-(T.len / 2 + 0.9), 0], [T.len / 2 + 0.9, 0], [0, -(T.wid / 2 + 1.6)], [0, T.wid / 2 + 1.6]];
  let pos = null;
  for (const [f, r] of spots) {
    const x = V.x + fx * f + rx * r, z = V.z + fz * f + rz * r;
    if (!owWalkCell(0, Math.floor(x), Math.floor(z)) || VEH.list.some((O) => vehInside(O, x, z, 0.35))) continue;
    if (Math.abs(owGroundAt(0, x, z) - V.y) > 1.5) continue;
    pos = [x, z]; break;
  }
  if (!pos) { if (!force) { HUD.hint('Pas de place pour descendre ici', 1.5); return; } pos = [V.x + rx * -(T.wid / 2 + 0.7), V.z + rz * -(T.wid / 2 + 0.7)]; }
  VEH.drive = null;
  Arms.root.visible = true;
  vehSoundStop();
  player.yaw = V.yaw + VEH.lookYaw; player.pitch = 0;
  placePlayer(pos[0], pos[1]);
  player.vel.set(0, 0, 0);
}
const owDriving = () => !!VEH.drive;

/* ---- Conduite (à la place du déplacement à pied, dans updatePlayer) */
function owDriveStep(dt) {
  const V = VEH.drive, p = player;
  if (p.down) { vehExit(true); return; }
  if (pressed('KeyF')) { vehExit(false); if (!VEH.drive) { Input.down.KeyF = false; return; } }
  if (pressed('KeyC')) { VEH.view = 1 - VEH.view; VEH.lookYaw = 0; VEH.lookPitch = VEH.view ? 0 : -0.12; }
  if (pressed('KeyL')) V.lightsManual = !V.lightsManual;
  // regard : la souris tourne la vue autour du véhicule (elle revient derrière après un moment)
  const sens = 0.0015 * settings.sens;
  if (Input.dx || Input.dy) VEH.lookT = 1.6;
  VEH.lookYaw = wrapAngle(VEH.lookYaw - Input.dx * sens);
  VEH.lookPitch = clamp(VEH.lookPitch - Input.dy * sens * (settings.invertY ? -1 : 1), VEH.view ? -0.7 : -0.6, VEH.view ? 0.6 : 0.35);
  VEH.lookT -= dt;
  if (VEH.lookT <= 0 && !VEH.view) { VEH.lookYaw = damp(VEH.lookYaw, 0, 2.5, dt); VEH.lookPitch = damp(VEH.lookPitch, -0.12, 2, dt); }
  if (VEH.view) VEH.lookYaw = clamp(VEH.lookYaw, -1.9, 1.9);
  const ctl = {
    f: (key('KeyW') ? 1 : 0) - (key('KeyS') ? 1 : 0),
    s: (key('KeyD') || key('ArrowRight') ? 1 : 0) - (key('KeyA') || key('ArrowLeft') ? 1 : 0),
    hand: key('Space'),
  };
  vehStep(V, dt, ctl);
  vehSeat(V);
  p.yaw = V.yaw + VEH.lookYaw;
  p.vel.set(0, 0, 0);
  vehCamera(V, dt);
  Sound.setListener(p.pos.x, p.pos.z, p.yaw, p.gy);
}
/* Santé au volant (régénération, battements de cœur) : le reste de updatePlayer est sauté. */
function owPlayerVitals(dt) {
  const p = player;
  if (!p.down && p.hp < p.maxHp && G.time - p.lastHit > 2.4) p.hp = Math.min(p.maxHp, p.hp + 70 * dt);
  if (!p.down && p.hp < p.maxHp * 0.4) { p.heartT -= dt; if (p.heartT <= 0) { p.heartT = 0.85; Sound.heartbeat(); } }
  p.bobAmt = 0;
}
/* Un pas de physique (conduit ou en roue libre). */
function vehStep(V, dt, ctl) {
  const T = V.T, surf = vehSurface(V.x, V.z);
  let vmax = T.vmax[surf] / 3.6;
  if (OW.stormVmax) vmax = Math.min(vmax, OW.stormVmax / 3.6);
  if (V.stuckT > 0) { V.stuckT -= dt; vmax = Math.min(vmax, 0.4); }
  if (V.stuck) vmax = Math.min(vmax, 0.25);
  // ensablement : à faible allure dans le sable mou, en montée, en forçant
  if (T.bog && V === VEH.drive && !V.stuck) {
    if (surf === 'sand' && ctl.f !== 0 && Math.abs(V.v) < 1.6 && Math.sin(V.pitch) * Math.sign(ctl.f) > 0.1) V.bogT = (V.bogT || 0) + dt;
    else V.bogT = Math.max(0, (V.bogT || 0) - dt * 0.5);
    if (V.bogT > 2.2) { V.stuck = true; V.plateT = 0; V.bogT = 0; HUD.hint('Ensablé ! Descendez et posez les plaques de désensablage (F maintenu, 10 s)', 4); }
  }
  const [fx, fz] = vehFwd(V.yaw);
  // pente : la gravité freine en montée, pousse en descente
  const slope = Math.sin(V.pitch);
  let f = ctl.f;
  if (V.fuel <= 0 && f !== 0) { f = 0; if (!V.dryT || G.time - V.dryT > 4) { V.dryT = G.time; HUD.hint('Réservoir vide : jerricans au relais Km 47, à la centrale ou à l\'aérodrome', 3); } }
  if (f > 0) V.v = V.v < -0.3 ? approach(V.v, 0, T.brake * dt) : approach(V.v, vmax, T.acc * dt * (1 - Math.max(0, V.v) / (vmax * 1.25)));
  else if (f < 0) V.v = V.v > 0.3 ? approach(V.v, 0, T.brake * dt) : approach(V.v, -T.rev, T.acc * 0.7 * dt);
  else V.v = approach(V.v, 0, (surf === 'sand' ? 2.6 : 1.1) * dt);
  if (ctl.hand) V.v = approach(V.v, 0, T.brake * 1.3 * dt);
  if (Math.abs(V.v) > vmax) V.v = approach(V.v, Math.sign(V.v) * vmax, (surf === 'sand' ? 9 : 4) * dt);
  V.v -= 9.8 * slope * 0.55 * dt;
  // direction (moins de braquage à grande vitesse)
  const sMax = T.steer * (1 - Math.min(0.62, Math.abs(V.v) / 32));
  V.steer = approach(V.steer, ctl.s * sMax, (ctl.s ? 2.2 : 3) * dt);
  const yawRate = (V.v / T.wb) * Math.tan(V.steer);
  const nyaw = V.yaw - yawRate * dt;
  const [nfx, nfz] = vehFwd(nyaw);
  const nx = V.x + nfx * V.v * dt, nz = V.z + nfz * V.v * dt;
  const hit = Math.abs(V.v) > 0.01 || ctl.s ? vehBlocked(V, nx, nz, nyaw) : null;
  if (!hit) { V.x = nx; V.z = nz; V.yaw = nyaw; }
  else {
    // choc : on s'arrête net (léger rebond), secousse selon la vitesse
    const sp = Math.abs(V.v);
    if (sp > 3 && V === VEH.drive) { FX.shake = Math.min(1, FX.shake + sp / 25); Sound.bodyFall({ x: hit.x, z: hit.z }); }
    V.v *= -0.15;
    if (hit.veh) hit.veh.v += V.v * 0.3;
    // la rotation seule reste permise si elle est libre
    if (!vehBlocked(V, V.x, V.z, nyaw)) V.yaw = nyaw;
  }
  const dist = Math.abs(V.v) * dt;
  V.fuel = Math.max(0, V.fuel - dist);
  V.dustT = (V.dustT || 0) - dt;
  const spin = V.stuck && ctl.f !== 0;
  if (V.dustT <= 0 && (spin || (Math.abs(V.v) > 4 && surf !== 'road'))) {
    V.dustT = spin ? 0.06 : clamp(0.5 - Math.abs(V.v) * 0.025, 0.07, 0.4);
    const back = -Math.sign(V.v || 1) * T.len * 0.45;
    for (const s of [-1, 1]) spawnPuff(V.x + fx * back + -fz * s * T.track * 0.5, V.y + 0.35, V.z + fz * back + fx * s * T.track * 0.5, rand(0.9, 1.6) + Math.abs(V.v) * 0.05, rand(0.9, 1.6), surf === 'sand' ? 0xb08458 : 0xa08060, 0.42, 0.5);
  }
  V.rot += (V.v * dt) / T.wr;
  vehPose(V, dt);
  vehZombies(V, dt);
}
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

/* Zombies contre le véhicule : écrasés au-dessus de T.kill (m/s), repoussés en dessous. */
function vehZombies(V, dt) {
  const T = V.T, [fx, fz] = vehFwd(V.yaw), sp = Math.abs(V.v), R = T.len / 2 + 1;
  for (const z of Zombies.list) {
    if (!z.alive || z.boss || z.state === 'rise' || Math.abs(z.gy - V.y) > 2.2) continue;
    const dx = z.pos.x - V.x, dz = z.pos.z - V.z;
    if (dx * dx + dz * dz > R * R) continue;
    const lf = dx * fx + dz * fz, lr = dx * -fz + dz * fx, m = 0.32;
    if (Math.abs(lf) > T.len / 2 + m || Math.abs(lr) > T.wid / 2 + m) continue;
    const front = V.v >= 0 ? lf > T.len / 2 - 0.9 : lf < -T.len / 2 + 0.9;
    if (sp > T.kill && front) {
      const k = Math.sign(V.v) || 1;
      damageZombie(z, 1e6, { kind: 'vehicle', dx: fx * k, dz: fz * k, force: Math.min(14, sp * 0.8) });
      bloodBurst(z.pos.x, z.gy + 0.9, z.pos.z, fx * k, fz * k, 12, 1.4);
      Sound.bodyFall(z.pos);
      if (V === VEH.drive) FX.shake = Math.min(1, FX.shake + 0.12);
      V.v *= T.ram ? 0.97 : 0.88;
      continue;
    }
    // repoussé hors de la caisse (sur le côté le plus proche)
    const pf = T.len / 2 + m - Math.abs(lf), pr = T.wid / 2 + m - Math.abs(lr);
    if (pr < pf) { const s = Math.sign(lr) || 1; z.pos.x += -fz * s * pr; z.pos.z += fx * s * pr; }
    else { const s = Math.sign(lf) || 1; z.pos.x += fx * s * pf; z.pos.z += fz * s * pf; }
    if (sp > 2) { z.stagger = Math.max(z.stagger, 0.4); z.knockX += (z.pos.x - V.x) * 0.6; z.knockZ += (z.pos.z - V.z) * 0.6; }
  }
}
/* Corps (joueur à pied, zombies) repoussés hors des véhicules (appelé par owSettle). */
function vehPushBody(b, r) {
  for (const V of VEH.list) {
    if (V === VEH.drive && b === player) continue;
    if (Math.abs((b.gy || 0) - V.y) > 2.4) continue;
    const dx = b.pos.x - V.x, dz = b.pos.z - V.z, R = V.T.len / 2 + r + 0.2;
    if (dx * dx + dz * dz > R * R) continue;
    const [fx, fz] = vehFwd(V.yaw), lf = dx * fx + dz * fz, lr = dx * -fz + dz * fx;
    const pf = V.T.len / 2 + r - Math.abs(lf), pr = V.T.wid / 2 + r - Math.abs(lr);
    if (pf <= 0 || pr <= 0) continue;
    if (pr < pf) { const s = Math.sign(lr) || 1; b.pos.x += -fz * s * pr; b.pos.z += fx * s * pr; }
    else { const s = Math.sign(lf) || 1; b.pos.x += fx * s * pf; b.pos.z += fz * s * pf; }
  }
}

/* ---- Caméra : derrière le véhicule (orbite à la souris), ou au poste du conducteur (C) */
const _vc = new THREE.Vector3(), _vl = new THREE.Vector3();
function vehCamera(V, dt) {
  const T = V.T;
  camera.rotation.order = 'YXZ';
  if (VEH.view) {
    // poste de conduite : la tête suit la caisse (tangage, roulis)
    _vc.set(T.seat[0], T.seat[1] + T.eye, T.seat[2]).applyQuaternion(V.group.quaternion).add(V.group.position);
    camera.position.copy(_vc);
    _ve.set(V.pitch + VEH.lookPitch, V.yaw + VEH.lookYaw, V.roll * 0.6, 'YXZ');
    camera.quaternion.setFromEuler(_ve);
    camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');
    return;
  }
  const yaw = V.yaw + VEH.lookYaw, d = T.cam[0], hgt = T.cam[1];
  const [fx, fz] = vehFwd(yaw);
  const pitch = VEH.lookPitch;
  _vl.set(V.x, V.y + T.hgt * 0.62, V.z);
  _vc.set(V.x - fx * d * Math.cos(pitch), V.y + hgt - Math.sin(pitch) * d, V.z - fz * d * Math.cos(pitch));
  // la caméra reste au-dessus du sol (dunes derrière le véhicule)
  const g = owGroundAt(0, _vc.x, _vc.z);
  if (Number.isFinite(g) && _vc.y < g + 0.8) _vc.y = g + 0.8;
  if (!VEH.camInit) { VEH.camPos.copy(_vc); VEH.camInit = true; }
  VEH.camPos.lerp(_vc, 1 - Math.exp(-10 * dt));
  camera.position.copy(VEH.camPos);
  camera.lookAt(_vl);
  if (FX.shake > 0.01) { const sh = FX.shake * FX.shake; camera.rotation.x += rand(-1, 1) * sh * 0.02; camera.rotation.y += rand(-1, 1) * sh * 0.02; }
}

/* ---- Chaque image : véhicules en roue libre, roues, fanions, feux, sons */
function owVehUpdate(dt) {
  const dark = owDarkness();
  for (const V of VEH.list) {
    if (V.flipping || V.unflipping) { khVehFlipStep(V, dt); V.v = 0; vehPose(V, dt); }
    else if (V.flipped) V.v = 0;
    else if (V !== VEH.drive && (Math.abs(V.v) > 0.01 || V.y > owGroundAt(0, V.x, V.z) + 0.3)) vehStep(V, dt, { f: 0, s: 0, hand: true });
    // roues : rotation, braquage
    for (const w of V.wheels) {
      w.w.rotation.x = -V.rot;
      if (w.front) w.pivot.rotation.y = V.steer;
    }
    if (V.flag) {
      const pos = V.flag.geometry.attributes.position, t = G.time * 9 + V.id;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin(t + x * 7) * 0.06 * x + x * Math.min(0.5, Math.abs(V.v) * 0.04)); }
      pos.needsUpdate = true;
    }
    const on = V === VEH.drive && (dark > 0.35 || V.lightsManual);
    if (on !== V.lights) {
      V.lights = on;
      V.lampHead.color.setHex(on ? 0xfff2d6 : 0x6e6a60);
      V.lampTail.color.setHex(on ? 0xff2a1a : 0x4a0d08);
    }
    for (const h of V.halos) h.material.opacity = on ? 0.55 + dark * 0.3 : 0;
  }
  // projecteur des phares
  const L = VEH.light, V = VEH.drive;
  if (L) {
    if (V && V.lights) {
      _vc.set(0, V.heads[0][1], V.heads[0][2] - 0.3).applyQuaternion(V.group.quaternion).add(V.group.position);
      L.position.copy(_vc);
      _vl.set(0, V.heads[0][1] - 1.6, V.heads[0][2] - 22).applyQuaternion(V.group.quaternion).add(V.group.position);
      L.target.position.copy(_vl); L.target.updateMatrixWorld();
      L.intensity = 2.2 + dark * 2;
    } else L.intensity = 0;
  }
  vehSoundUpdate(dt);
}
/* Obscurité de la vue (0 en plein jour, 1 la nuit ou au cœur du Khamsin). */
function owDarkness() {
  if (OW.worldId === 'lune') return LU.inside ? 0.45 : 1 - 0.8 * luSunAt(camera.position.x, camera.position.y - 0.5, camera.position.z);
  const g = OW.grade;
  if (!g) return 0;
  const day = g.sunI * Math.max(0, g.dir.y) * 1.4 + g.hemiI * 0.45;
  return clamp(Math.max(1 - (day - 0.25) / 0.55, OW.stormDark || 0, KHPY.view), 0, 1);     // dans une pyramide : la nuit des lampes
}

/* ---- Moteur (synthétisé) : grondement selon le régime et la charge */
function vehSoundStart(V) {
  vehSoundStop();
  const b = Sound.bus();
  if (!b) return;
  const ctx = b.ctx, out = ctx.createGain();
  out.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sine';
  const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
  g1.gain.value = 0.35; g2.gain.value = 0.15; g3.gain.value = 0.5;
  o1.connect(g1); o2.connect(g2); o3.connect(g3);
  g1.connect(lp); g2.connect(lp); g3.connect(lp);
  // grenaille : bruit filtré (gravier, sable sous les pneus)
  const nb = ctx.createBufferSource(); nb.loop = true;
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  nb.buffer = buf;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.6;
  const ng = ctx.createGain(); ng.gain.value = 0;
  nb.connect(nf); nf.connect(ng); ng.connect(out);
  lp.connect(out); out.connect(b.sortie);
  const t = ctx.currentTime;
  for (const o of [o1, o2, o3]) o.start(t);
  nb.start(t);
  out.gain.setTargetAtTime(0.22 * V.T.engine[1], t, 0.15);
  VEH.snd = { ctx, out, lp, o1, o2, o3, ng, nb, V };
}
function vehSoundUpdate(dt) {
  const S = VEH.snd;
  if (!S) return;
  const V = S.V, T = V.T, t = S.ctx.currentTime;
  const load = clamp(Math.abs(V.v) / (T.vmax.road / 3.6), 0, 1);
  V.rpm = damp(V.rpm, 0.15 + load * 0.7 + (key('KeyW') || key('KeyS') ? 0.15 : 0), 5, dt);
  const f = T.engine[0] * (0.7 + V.rpm * 2.2);
  S.o1.frequency.setTargetAtTime(f, t, 0.05); S.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05); S.o3.frequency.setTargetAtTime(f * 0.25, t, 0.05);
  S.lp.frequency.setTargetAtTime(380 + V.rpm * 1400, t, 0.08);
  S.ng.gain.setTargetAtTime(Math.min(0.5, Math.abs(V.v) * 0.03) * (vehSurface(V.x, V.z) === 'road' ? 0.35 : 1), t, 0.1);
}
function vehSoundStop() {
  const S = VEH.snd;
  if (!S) return;
  VEH.snd = null;
  const t = S.ctx.currentTime;
  S.out.gain.setTargetAtTime(0, t, 0.12);
  for (const o of [S.o1, S.o2, S.o3, S.nb]) { try { o.stop(t + 0.6); } catch (e) { /* déjà arrêté */ } }
  setTimeout(() => { try { S.out.disconnect(); } catch (e) { /* rien */ } }, 900);
}
