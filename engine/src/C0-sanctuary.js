/* ---------------------------------------------------------- Sanctuaire --
   Planche « B Le sanctuaire · sous la Grande Pyramide · lumière turquoise » (page 6) : une salle
   hypostyle à 40 m sous le plateau ; la colonne de lumière qui sort du sommet de la pyramide descend
   jusqu'ici et frappe l'autel. La porte (au kiosque, entre les pyramides) ne s'ouvre qu'avec le
   courant de la centrale (E). L'autel améliore une arme contre des points (les paliers du Glas :
   I, II, III, mêmes prix, mêmes mods) et réveille le Gardien. Arène : 10 colonnes pour se couvrir,
   6 braseros, des statues qui bloquent les lignes de tir au fond.
   Le sous-sol est la couche 1 du monde ouvert (OW.under, roche hors des salles) ; on y descend par
   l'escalier du kiosque (fondu au noir) ; les Desséchés y sortent des fosses de sable. */
const KHSY = -8;                                   // sol du sanctuaire (le plateau est à 32 m)
const KHSAN = {
  hall: [2100, 1212, 2140, 1268], h: 11,           // salle : x0, z0, x1, z1 ; hauteur sous plafond
  altar: { x: 2120, z: 1240 },                     // sous le sommet de la Grande Pyramide
  south: [2116, 1268, 2124, 1302], southH: 6,      // couloir d'entrée et pied de l'escalier
  west: [2066, 1236, 2100, 1244], westH: 5,        // galerie de la draisine (vers la nécropole)
  columns: [], braziers: [], statues: [], pits: [], group: null, kiosk: null, door: null,
  under: false, fire: [], t: 0, beam: null, light: null,
};

/* ---- Textures : grandes dalles, reliefs gravés, plafond étoilé, basalte, or, faïence */
(function khSanctuaryTextures() {
  defTex('kh_slab', 'Dalles du sanctuaire (Khamsin)', 'sol', { size: [4, 4] }, tgBrick({ tile: 4, colors: [[176, 150, 112], [168, 142, 104], [186, 160, 120]], bw: 1.95, bh: 0.98, mortar: 0.006, mortarColor: [116, 96, 72], stains: 9 }));
  defTex('kh_relief', 'Reliefs gravés (Khamsin)', 'brique', { size: [3, 3] }, (g, w, h, R) => {
    const n = vnoise(w, h, [[5, 5, 1], [22, 22, 0.5], [90, 90, 0.35]], 1.8, R);
    paintPixels(g, w, h, (x, y, c) => { const k = 0.82 + 0.24 * n[y * w + x]; c[0] = 196 * k; c[1] = 168 * k; c[2] = 126 * k; });
    const reg = h / 6, paint = ['rgba(168,67,42,0.35)', 'rgba(46,95,154,0.32)', 'rgba(214,170,72,0.38)', 'rgba(64,140,120,0.3)'];
    const carve = (draw) => {
      g.save(); g.translate(1.2, 1.2); g.strokeStyle = 'rgba(70,50,30,0.75)'; g.fillStyle = 'rgba(70,50,30,0.35)'; draw(); g.restore();
      g.save(); g.translate(-0.8, -0.8); g.strokeStyle = 'rgba(255,240,210,0.45)'; g.fillStyle = 'rgba(0,0,0,0)'; draw(); g.restore();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let r = 0; r < 6; r++) {
      const y0 = r * reg;
      carve(() => { g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, y0 + 2); g.lineTo(w, y0 + 2); g.stroke(); });
      for (let x = 8; x < w - 30; x += 30 + R() * 16) {
        const cx = x + 14, cy = y0 + reg / 2 + 2, s = reg * 0.32, kind = Math.floor(R() * 7);
        if (R() < 0.45) { g.fillStyle = paint[Math.floor(R() * paint.length)]; g.beginPath(); g.ellipse(cx, cy, s * 0.8, s * 1.1, 0, 0, TAU); g.fill(); }
        carve(() => {
          g.lineWidth = 2;
          g.beginPath();
          switch (kind) {
            case 0: g.arc(cx, cy, s * 0.7, 0, TAU); g.moveTo(cx + 2, cy); g.arc(cx, cy, 2, 0, TAU); break;                              // soleil
            case 1: g.ellipse(cx, cy - s * 0.35, s * 0.35, s * 0.4, 0, 0, TAU); g.moveTo(cx, cy + s * 0.05); g.lineTo(cx, cy + s * 1.1); g.moveTo(cx - s * 0.55, cy + s * 0.3); g.lineTo(cx + s * 0.55, cy + s * 0.3); break;   // ânkh
            case 2: g.moveTo(cx - s, cy + s * 0.2); for (let i = 0; i <= 6; i++) g.lineTo(cx - s + (i * 2 * s) / 6, cy + (i % 2 ? -0.2 : 0.2) * s); break;   // eau
            case 3: g.moveTo(cx - s * 0.8, cy); g.quadraticCurveTo(cx, cy - s * 0.9, cx + s * 0.8, cy); g.quadraticCurveTo(cx, cy + s * 0.6, cx - s * 0.8, cy); g.moveTo(cx + 3, cy); g.arc(cx, cy, 3, 0, TAU); g.moveTo(cx, cy + s * 0.3); g.lineTo(cx - s * 0.3, cy + s); break;   // œil
            case 4: g.moveTo(cx - s * 0.6, cy + s); g.lineTo(cx - s * 0.2, cy); g.lineTo(cx + s * 0.1, cy - s * 0.5); g.lineTo(cx + s * 0.6, cy - s * 0.7); g.lineTo(cx + s * 0.35, cy - s * 0.2); g.lineTo(cx + s * 0.3, cy + s * 0.5); g.lineTo(cx - s * 0.1, cy + s * 0.6); g.moveTo(cx, cy + s * 0.55); g.lineTo(cx - s * 0.1, cy + s * 1.05); break;   // oiseau
            case 5: g.moveTo(cx, cy - s); g.quadraticCurveTo(cx + s * 0.5, cy, cx, cy + s); g.quadraticCurveTo(cx - s * 0.2, cy, cx, cy - s); break;   // plume
            default: g.rect(cx - s * 0.45, cy - s, s * 0.9, s * 2); g.moveTo(cx - s * 0.45, cy + s * 0.75); g.lineTo(cx + s * 0.45, cy + s * 0.75);   // cartouche
          }
          g.stroke();
        });
      }
    }
  });
  defTex('kh_stars', 'Plafond étoilé (Khamsin)', 'beton', { size: [3, 3] }, (g, w, h, R) => {
    const n = vnoise(w, h, [[4, 4, 1], [18, 18, 0.5]], 1.6, R);
    paintPixels(g, w, h, (x, y, c) => { const k = 0.8 + 0.3 * n[y * w + x]; c[0] = 26 * k; c[1] = 38 * k; c[2] = 82 * k; });
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    const step = w / 8;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      g.fillStyle = R() < 0.15 ? 'rgba(214,176,90,0.35)' : 'rgba(222,184,96,0.9)';
      star((i + (j % 2) * 0.5 + 0.25) * step, (j + 0.5) * step, step * 0.28);
    }
    g.strokeStyle = 'rgba(10,12,20,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 40; y += (R() - 0.3) * 30; g.lineTo(x, y); } g.stroke(); }
  });
  defTex('kh_basalt', 'Basalte poli (Khamsin)', 'brique', { size: [2, 2], rough: 0.42 }, tgConcrete({ base: [46, 44, 46], stains: 3, cracks: 2 }));
  defTex('kh_gold', 'Feuille d’or (Khamsin)', 'metal', { size: [2, 2], rough: 0.32, metal: 0.75 }, tgPlaster({ color: [214, 170, 72], rough: false, stains: 2, cracks: 0 }));
  defTex('kh_faience', 'Faïence turquoise (Khamsin)', 'metal', { size: [1, 1], rough: 0.28, metal: 0.05 }, tgBrick({ tile: 1, colors: [[64, 178, 168], [52, 160, 152], [74, 192, 180]], bw: 0.25, bh: 0.1, mortar: 0.012, mortarColor: [36, 58, 54] }));
})();

/* Cases du sous-sol (couche 1). */
const khUnderFill = (x0, z0, x1, z1, kind, o) => owFill(OW.under, x0, z0, x1, z1, kind, o);

/* ---- Construction (une fois par génération : cases ; à chaque chargement : maillages) */
function owBuildSanctuary(root) {
  const K = owKit('sanctuaire'), y = KHSY, [x0, z0, x1, z1] = KHSAN.hall, H = KHSAN.h;
  KHSAN.columns = []; KHSAN.braziers = []; KHSAN.statues = []; KHSAN.pits = []; KHSAN.fire = [];
  // salle : sol, murs gravés, plafond étoilé (ouvert au-dessus de l'autel)
  khUnderFill(x0, z0, x1, z1, OWK.FLOOR, { base: y, ceil: y + H, roof: y + H + 1, mat: OWM.STONE });
  K.box('kh_slab', 0xffffff, x0, y - 0.3, z0, x1, y, z1, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] });
  const A = KHSAN.altar, hole = 1.4;
  for (const [a0, b0, a1, b1] of [[x0, z0, x1, A.z - hole], [x0, A.z + hole, x1, z1], [x0, A.z - hole, A.x - hole, A.z + hole], [A.x + hole, A.z - hole, x1, A.z + hole]]) {
    K.box('kh_stars', 0xffffff, a0, y + H, b0, a1, y + H + 0.6, b1, { skip: ['top', 'px', 'nx', 'pz', 'nz'] });
  }
  // puits de lumière au-dessus de l'autel (le faisceau descend du sommet de la pyramide)
  for (const [a0, b0, a1, b1] of [[A.x - hole - 0.3, A.z - hole - 0.3, A.x + hole + 0.3, A.z - hole], [A.x - hole - 0.3, A.z + hole, A.x + hole + 0.3, A.z + hole + 0.3],
    [A.x - hole - 0.3, A.z - hole, A.x - hole, A.z + hole], [A.x + hole, A.z - hole, A.x + hole + 0.3, A.z + hole]]) K.box('kh_sandstone', 0xbfae8e, a0, y + H, b0, a1, y + H + 9, b1);
  // murs (faces intérieures) : grès gravé, frise peinte en haut, plinthe
  const wall = (ax, az, bx, bz, nx, nz, hh = H, from = 0) => {
    const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
    const p = (s, yy) => [ax + tx * s, yy, az + tz * s];
    K.quad('kh_relief', 0xffffff, p(0, y + from), p(len, y + from), p(len, y + hh - 1.2), p(0, y + hh - 1.2), [nx, 0, nz], (q) => [(q[0] - ax) * tx + (q[2] - az) * tz, q[1] - y]);
    K.quad('kh_faience', 0xffffff, p(0, y + hh - 1.2), p(len, y + hh - 1.2), p(len, y + hh - 0.9), p(0, y + hh - 0.9), [nx, 0, nz], (q) => [(q[0] - ax) * tx + (q[2] - az) * tz, q[1]]);
    K.quad('kh_gold', 0xc8a050, p(0, y + hh - 0.9), p(len, y + hh - 0.9), p(len, y + hh), p(0, y + hh), [nx, 0, nz], (q) => [(q[0] - ax) * tx + (q[2] - az) * tz, q[1]]);
  };
  // nord (statues devant), est, ouest (galerie), sud (couloir)
  wall(x1, z0, x0, z0, 0, 1);
  wall(x1, z1, x1, z0, -1, 0);
  const [, wz0, , wz1] = KHSAN.west;
  wall(x0, z0, x0, wz0, 1, 0); wall(x0, wz1, x0, z1, 1, 0);
  wall(x0, wz0, x0, wz1, 1, 0, H, KHSAN.westH);                 // linteau de la galerie
  const [sx0, , sx1] = KHSAN.south;
  wall(x0, z1, sx0, z1, 0, -1); wall(sx1, z1, x1, z1, 0, -1);
  wall(sx0, z1, sx1, z1, 0, -1, H, KHSAN.southH);                // linteau du couloir
  // couloir d'entrée (au sud) et escalier qui remonte vers le kiosque
  {
    const [cx0, cz0, cx1, cz1] = KHSAN.south, hh = KHSAN.southH, zs = 1294;
    khUnderFill(cx0, cz0, cx1, zs, OWK.FLOOR, { base: y, ceil: y + hh, roof: y + hh + 1, mat: OWM.STONE });
    khUnderFill(cx0, zs, cx1, cz1, OWK.VOID, {});
    K.box('kh_slab', 0xe8dcc8, cx0, y - 0.3, cz0, cx1, y, zs, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] });
    K.box('kh_stars', 0xffffff, cx0, y + hh, cz0, cx1, y + hh + 0.4, zs, { skip: ['top', 'px', 'nx', 'pz', 'nz'] });
    wall(cx0, cz0, cx0, cz1, 1, 0, hh + 4); wall(cx1, cz1, cx1, cz0, -1, 0, hh + 4);
    // marches (0,25 m) qui montent vers le sud, plafond en pente, puis le noir
    for (let i = 0; i < 16; i++) K.box('kh_sandstone', 0xd8c8aa, cx0, y, zs + i * 0.5, cx1, y + 0.25 * (i + 1), zs + (i + 1) * 0.5);
    K.box('kh_stars', 0xffffff, cx0, y + hh + 0.4, zs, cx1, y + hh + 4.4, zs + 8, { skip: ['top', 'px', 'nx', 'pz', 'bottom'] });
    K.add(khVoid(cx0, y + 4, zs + 8, cx1 - cx0, hh, 0));
    KHSAN.stairFoot = { x: (cx0 + cx1) / 2, y, z: zs - 0.6 };
    // torchères du couloir
    for (const z of [1276, 1288]) for (const x of [cx0 + 0.25, cx1 - 0.25]) khBrazier(K, x, y + 2.6, z, true);
  }
  // galerie de la draisine (vers la nécropole) : couloir plus bas, quai, rails qui filent dans le noir
  {
    const [gx0, gz0, gx1, gz1] = KHSAN.west, hh = KHSAN.westH;
    khUnderFill(gx0, gz0, gx1, gz1, OWK.FLOOR, { base: y, ceil: y + hh, roof: y + hh + 1, mat: OWM.STONE });
    K.box('kh_slab', 0xd8ccb8, gx0, y - 0.3, gz0, gx1, y, gz1, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] });
    K.box('kh_rock', 0x9a8670, gx0, y + hh, gz0, gx1, y + hh + 0.4, gz1, { skip: ['top', 'px', 'nx', 'pz', 'nz'] });
    K.box('kh_rock', 0xa89276, gx0, y, gz0 - 0.4, gx1, y + hh, gz0, { skip: ['nz', 'top', 'bottom'] }).box('kh_rock', 0xa89276, gx0, y, gz1, gx1, y + hh, gz1 + 0.4, { skip: ['pz', 'top', 'bottom'] });
    // étais de bois (galerie de fouilles), rails Decauville
    for (let x = gx0 + 3; x < gx1 - 1; x += 4) {
      K.box('kh_planks', 0x7a5a3a, x - 0.12, y, gz0, x + 0.12, y + hh, gz0 + 0.25).box('kh_planks', 0x7a5a3a, x - 0.12, y, gz1 - 0.25, x + 0.12, y + hh, gz1);
      K.box('kh_planks', 0x7a5a3a, x - 0.12, y + hh - 0.3, gz0, x + 0.12, y + hh, gz1);
    }
    const zc = (gz0 + gz1) / 2;
    for (let x = gx0 - 6; x < gx1 - 6; x += 0.6) K.box('kh_planks', 0x5a4028, x, y, zc - 0.55, x + 0.14, y + 0.08, zc + 0.55);
    for (const s of [-0.3, 0.3]) K.box('kh_sheet', 0x5a5550, gx0 - 6, y + 0.08, zc + s - 0.03, gx1 - 6, y + 0.16, zc + s + 0.03);
    K.add(khVoid(gx0, y + hh / 2, zc, gz1 - gz0, hh, Math.PI / 2));
    KHSAN.railHead = { x: gx0 + 4, y, z: zc };
    khBrazier(K, gx1 - 3, y + 2.4, gz0 + 0.3, true); khBrazier(K, gx0 + 8, y + 2.4, gz1 - 0.3, true);
  }
  // colonnes papyriformes (deux rangées de cinq)
  for (const x of [2110, 2130]) for (const z of [1220, 1230, 1240, 1250, 1260]) khColumn(K, x, z, y, H);
  // statues du fond : quatre colosses à tête de chacal, assis, face à l'autel
  for (const x of [2105, 2114.5, 2125.5, 2135]) khStatue(K, x, z0 + 3.4, y);
  for (const x of [2109.8, 2120, 2130.2]) khBrazier(K, x, y + 3.2, z0 + 0.3, true);
  // braseros : six, autour de l'autel et le long des bas-côtés
  for (const [x, z] of [[2104, 1226], [2104, 1254], [2136, 1226], [2136, 1254], [2115, 1263], [2125, 1263]]) khBrazier(K, x, y, z, false);
  // fosses de sable (les Desséchés en sortent)
  for (const [x, z] of [[2103.5, 1218], [2136.5, 1218], [2103.5, 1240], [2136.5, 1240], [2103.5, 1262], [2136.5, 1262], [2120, 1284], [2080, 1240]]) {
    KHSAN.pits.push({ x, z });
    K.box('kh_slab', 0xffffff, x - 1.6, y, z - 1.6, x + 1.6, y + 0.04, z + 1.6, { top: 'kh_rock', topHex: 0xc8a070, skip: ['bottom'] });
  }
  // autel et faisceau
  khAltarBuild(K);
  // kiosque : escalier, porte scellée (jeu 2.0.3 : dans un kit à part, qui suit le kiosque)
  khKioskBuild(K, root);
  const g = K.build(root);
  g.name = 'sanctuaire';
  KHSAN.group = g;
  // lumière du faisceau (toujours dans la scène : le nombre de lumières ne change pas en jeu)
  const L = new THREE.PointLight(0x5ff2e2, 0, 22, 2);
  L.position.set(A.x, y + 3.2, A.z);
  root.add(L);
  KHSAN.light = L;
  khBuildAltarFeature(g);
}
/* Fond noir (la suite d'un escalier, d'une galerie) : un plan sans brouillard. */
function khVoid(x, y, z, w, h, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
  m.position.set(x + (ry ? 0 : w / 2), y, z); m.rotation.y = ry ? ry : Math.PI;
  if (ry) m.position.set(x, y, z);
  return m;
}
/* Colonne papyriforme : base, fût gravé, bandes peintes, chapiteau évasé, abaque. */
const KH_CAPITAL = (() => {
  const pts = [[0.8, 0], [0.86, 0.25], [1.05, 0.7], [1.24, 1.15], [1.34, 1.5], [1.36, 1.6]].map(([r, h]) => new THREE.Vector2(r, h));
  return new THREE.LatheGeometry(pts, 24);
})();
function khColumn(K, x, z, y, H) {
  const top = y + H, shaftTop = top - 0.5 - 1.6;
  K.cyl('kh_sandstone', 0xd6c4a2, x, y + 0.15, z, 1.05, 0.3, 24);
  K.geo('kh_relief', 0xf0e2c8, new THREE.CylinderGeometry(0.8, 0.88, shaftTop - y - 0.3, 24, 1, true), mtx(x, (y + 0.3 + shaftTop) / 2, z));
  const bands = [[0xa8432a, 0], [0x2e5f9a, 0.14], [0xd6aa48, 0.28]];
  for (const [hex, dy] of bands) K.cyl('kh_ochre', hex, x, shaftTop - 0.5 + dy, z, 0.83, 0.12, 24);
  K.geo('kh_sandstone', 0xe2cfa8, KH_CAPITAL, mtx(x, shaftTop, z));
  K.box('kh_sandstone', 0xd2bf9c, x - 0.95, top - 0.5, z - 0.95, x + 0.95, top, z + 0.95);
  khUnderFill(x - 1, z - 1, x + 1, z + 1, OWK.SOLID, { base: y, top, mat: OWM.STONE });
  KHSAN.columns.push({ x, z });
}
/* Colosse à tête de chacal, assis sur son trône (6,5 m), face au sud. */
function khStatue(K, x, z, y) {
  const B = (tex, hex, a, b, c, d, e, f) => K.box(tex, hex, x + a, y + b, z + c, x + d, y + e, z + f);
  const R = (tex, hex, sx, sy, sz, px, py, pz, rx = 0, ry = 0, rz = 0) => K.geo(tex, hex, GEO.box, mtx(x + px, y + py, z + pz, rx, ry, rz, sx, sy, sz));
  B('kh_sandstone', 0xcdb995, -1.9, 0, -2.2, 1.9, 1.1, 2.4);                      // socle
  B('kh_relief', 0xe8d6b0, -1.92, 0.15, 2.4, 1.92, 0.95, 2.42);                     // inscription
  B('kh_basalt', 0xffffff, -1.4, 1.1, -2.0, 1.4, 3.4, -0.6);                        // trône
  for (const s of [-1, 1]) {
    B('kh_basalt', 0xffffff, s * 0.62 - 0.3, 1.1, 1.0, s * 0.62 + 0.3, 3.0, 1.6);    // jambes
    B('kh_basalt', 0xffffff, s * 0.62 - 0.32, 1.1, 1.55, s * 0.62 + 0.32, 1.35, 2.05); // pieds
    B('kh_basalt', 0xffffff, s * 0.62 - 0.34, 2.95, -0.7, s * 0.62 + 0.34, 3.55, 1.65); // cuisses
    B('kh_basalt', 0xffffff, s * 0.95 - 0.2, 3.5, -0.9, s * 0.95 + 0.2, 4.9, -0.4);    // bras
    B('kh_basalt', 0xffffff, s * 0.9 - 0.18, 3.55, -0.5, s * 0.9 + 0.18, 3.85, 1.2);   // avant-bras posés sur les cuisses
  }
  B('kh_gold', 0xffffff, -0.75, 2.95, -0.75, 0.75, 3.75, 0.9);                     // pagne doré
  B('kh_basalt', 0xffffff, -0.8, 3.55, -1.0, 0.8, 5.2, -0.2);                       // torse
  R('kh_faience', 0xffffff, 1.5, 0.12, 0.9, 0, 5.0, -0.48, -0.15);                   // collier large
  R('kh_gold', 0xffffff, 1.55, 0.06, 0.92, 0, 4.92, -0.47, -0.15);
  // tête de chacal : crâne, museau, oreilles dressées, némès rayé
  B('kh_basalt', 0xffffff, -0.42, 5.2, -0.95, 0.42, 5.95, -0.15);
  R('kh_basalt', 0xffffff, 0.34, 0.32, 0.85, 0, 5.42, 0.25, 0.12);
  R('kh_basalt', 0xffffff, 0.2, 0.16, 0.3, 0, 5.38, 0.62, 0.2);
  for (const s of [-1, 1]) R('kh_basalt', 0xffffff, 0.2, 0.95, 0.14, s * 0.25, 6.3, -0.6, 0.1, 0, s * -0.12);
  for (const s of [-1, 1]) {
    R('kh_gold', 0xffffff, 0.22, 1.2, 0.5, s * 0.52, 5.1, -0.55, 0, 0, s * 0.08);
    R('kh_faience', 0x7aa0d8, 0.23, 1.2, 0.06, s * 0.53, 5.1, -0.28, 0, 0, s * 0.08);
  }
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0x0c1412, fog: false }));
    e.position.set(x + s * 0.2, y + 5.68, z + 0.05); e.scale.set(0.12, 0.05, 0.04); e.rotation.z = s * 0.25;
    K.add(e); eyes.push(e);
  }
  khUnderFill(x - 1.9, z - 2.2, x + 1.9, z + 2.4, OWK.SOLID, { base: y, top: y + 6.4, mat: OWM.STONE });
  KHSAN.statues.push({ x, z, eyes });
}
/* Brasero de bronze sur trépied (ou torchère murale) : feu animé, vraie lumière quand il est proche. */
function khBrazier(K, x, y, z, wall) {
  const bronze = 0x8a6436;
  if (!wall) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      K.geo('kh_gold', bronze, new THREE.CylinderGeometry(0.035, 0.045, 1.2, 6), mtx(x + Math.cos(a) * 0.28, y + 0.55, z + Math.sin(a) * 0.28, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25));
    }
    K.geo('kh_gold', bronze, new THREE.CylinderGeometry(0.48, 0.24, 0.32, 16, 1, false), mtx(x, y + 1.18, z));
    khUnderFill(x - 0.5, z - 0.5, x + 0.5, z + 0.5, OWK.LOW, { base: y, top: y + 1.34, mat: OWM.METAL });
  } else {
    K.geo('kh_gold', bronze, new THREE.CylinderGeometry(0.18, 0.08, 0.3, 10), mtx(x, y, z));
  }
  const fy = y + (wall ? 0.25 : 1.42), s = wall ? 0.55 : 1;
  const fire = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flare, color: i ? 0xff7a2a : 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set(x, fy + 0.2 * i * s, z); sp.scale.set(0.9 * s, 1.2 * s, 1);
    K.add(sp); fire.push(sp);
  }
  const L = { x, y: fy + 0.4, z, color: new THREE.Color(0xff9a4a), power: false, bulb: null, halo: fire[0], mat: new THREE.MeshBasicMaterial(), on: true, size: wall ? 0.9 : 1.4, base: wall ? 0.9 : 1.4, layer: 1, range: wall ? 14 : 22 };
  OWL.lamps.push(L);
  KHSAN.fire.push({ fire, L, ph: Math.random() * TAU, s });
  KHSAN.braziers.push({ x, z, wall });
}

/* ---- Autel : estrade, bloc de granit noir cerclé d'or, berceau de l'arme ; au-dessus, le
   pyramidion d'or suspendu dans le faisceau (il descend sur l'arme comme la cloche du Glas). */
function khAltarBuild(K) {
  const A = KHSAN.altar, y = KHSY;
  K.box('kh_slab', 0xe0d0b0, A.x - 3.4, y, A.z - 2.6, A.x + 3.4, y + 0.2, A.z + 2.6);
  K.box('kh_slab', 0xe8d8b8, A.x - 2.6, y + 0.2, A.z - 1.9, A.x + 2.6, y + 0.4, A.z + 1.9);
  khUnderFill(A.x - 3, A.z - 2.2, A.x + 3, A.z + 2.2, OWK.FLOOR, { base: y + 0.2, ceil: y + KHSAN.h, roof: y + KHSAN.h + 1, mat: OWM.STONE });
  khUnderFill(A.x - 2.2, A.z - 1.5, A.x + 2.2, A.z + 1.5, OWK.FLOOR, { base: y + 0.4, ceil: y + KHSAN.h, roof: y + KHSAN.h + 1, mat: OWM.STONE });
  const E = y + 0.4, top = E + 1.05;
  K.box('kh_basalt', 0xffffff, A.x - 1.3, E, A.z - 0.65, A.x + 1.3, top, A.z + 0.65);
  K.box('kh_gold', 0xffffff, A.x - 1.36, top - 0.08, A.z - 0.71, A.x + 1.36, top, A.z + 0.71);
  K.box('kh_gold', 0xffffff, A.x - 1.36, E, A.z - 0.71, A.x + 1.36, E + 0.1, A.z + 0.71);
  for (const s of [-1, 1]) K.box('kh_faience', 0xffffff, A.x + s * 0.9 - 0.18, E + 0.3, A.z + 0.655, A.x + s * 0.9 + 0.18, E + 0.75, A.z + 0.665);
  K.box('kh_relief', 0xe0d0b4, A.x - 0.6, E + 0.25, A.z + 0.652, A.x + 0.6, E + 0.85, A.z + 0.662);
  khUnderFill(A.x - 1.3, A.z - 0.65, A.x + 1.3, A.z + 0.65, OWK.LOW, { base: E, top, mat: OWM.STONE });
  KHSAN.altarTop = top;
}
/* Kiosque du plateau : escalier qui descend (fondu vers le sanctuaire), porte scellée. Jeu 2.0.3 :
   géométrie (kit « kiosque-escalier »), cases (avec le kiosque) et passages suivent le kiosque. */
function khKioskBuild(K0, root) {
  const P = KH.places.B.kiosk, y = P.y, N = P.node, K = owKit('kiosque-escalier');
  owLate(N, () => khKioskParts(K, P, y));
  const g = K.build(root);
  g.name = 'kiosque-escalier';
  owFollow(N, g);
  // le passage vers le sanctuaire et la sortie, à la pose du kiosque
  const k = KHSAN.kiosk, a = owPt(N, k.x, k.y, k.z), b = owPt(N, k.x, k.y, k.z + 1.6);
  KHSAN.kioskW = { x: a.x, y: a.y, z: a.z, out: { x: b.x, z: b.z, yaw: Math.PI + owYaw(N) } };
  // fosse sous le kiosque (maillage fin du terrain) : l'escalier s'y enfonce
  OW.pit = new Map();
  for (const px of [2188, 2192]) for (const pz of [1392, 1396, 1400]) {
    const q = owPt(N, px, 0, pz), gx = Math.round((q.x - OW.X0) / 4), gz = Math.round((q.z - OW.Z0) / 4);
    if (gx >= 0 && gz >= 0 && gx < OW.NX && gz < OW.NZ) OW.pit.set(gz * OW.NX + gx, -6);
  }
}
function khKioskParts(K, P, y) {
  // trémie de l'escalier (2 × 6 m) au milieu du kiosque, bordée d'une balustrade de pierre
  const x0 = 2189, x1 = 2191, za = 1392, zb = 1398;
  // sol du kiosque autour de la trémie
  for (const [a0, b0, a1, b1] of [[2185, 1391, x0, 1401], [x1, 1391, 2195, 1401], [x0, zb, x1, 1401], [x0, 1391, x1, za]]) K.box('kh_sandstone', 0xffffff, a0, y - 0.3, b0, a1, y, b1, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] });
  owFill(OW.surf, x0, za, x1, zb, OWK.VOID, {});
  owFill(OW.surf, x0 - 1, za - 1, x0, zb, OWK.LOW, { base: y, top: y + 0.9, mat: OWM.STONE });
  owFill(OW.surf, x1, za - 1, x1 + 1, zb, OWK.LOW, { base: y, top: y + 0.9, mat: OWM.STONE });
  owFill(OW.surf, x0, za - 1, x1, za, OWK.LOW, { base: y, top: y + 0.9, mat: OWM.STONE });
  K.box('kh_sandstone', 0xd8c4a0, x0 - 0.3, y, za - 0.3, x0, y + 0.9, zb).box('kh_sandstone', 0xd8c4a0, x1, y, za - 0.3, x1 + 0.3, y + 0.9, zb).box('kh_sandstone', 0xd8c4a0, x0, y, za - 0.3, x1, y + 0.9, za);
  // parois de la trémie et marches qui descendent vers le nord
  K.box('kh_relief', 0xc8b490, x0 - 0.3, y - 4.5, za, x0, y, zb, { skip: ['top', 'bottom', 'nx'] }).box('kh_relief', 0xc8b490, x1, y - 4.5, za, x1 + 0.3, y, zb, { skip: ['top', 'bottom', 'px'] });
  K.box('kh_relief', 0xc8b490, x0, y - 4.5, za - 0.3, x1, y, za, { skip: ['top', 'bottom', 'nz'] });
  for (let i = 0; i < 14; i++) K.box('kh_sandstone', 0xcfbc98, x0, y - 0.3 * (i + 1) - 0.3, zb - (i + 1) * 0.42, x1, y - 0.3 * (i + 1), zb - i * 0.42);
  const v = khVoid(x0, y - 3.4, za + 0.02, x1 - x0, 2.6, 0);
  v.rotation.y = 0; K.add(v);
  KHSAN.kiosk = { x: (x0 + x1) / 2, y, z: zb + 0.6 };
  // porte scellée : dalle de grès gravée du chacal turquoise, qui s'enfonce dans le sol avec le courant
  const [dx0, dz0, dx1, dz1] = P.door;
  let di = OW.doors.findIndex((d) => d.id === 'sanctuaire');
  if (di < 0) { di = OW.doors.length; OW.doors.push({ open: false, id: 'sanctuaire' }); }
  for (let x = dx0; x < dx1; x++) owSet(OW.surf, x, dz0, OWK.DOOR, { base: y, top: y + 3.2, ceil: y + 3.2, roof: y + 4.6, door: di, mat: OWM.STONE });
  const slab = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.BoxGeometry(dx1 - dx0, 3.2, 0.5), levelMaterial('kh_sandstone'));
  stone.position.y = 1.6; slab.add(stone);
  const seal = khSeal(0.7); seal.rotation.x = Math.PI / 2; seal.position.set(0, 1.7, 0.26); slab.add(seal);
  slab.position.set((dx0 + dx1) / 2, y, (dz0 + dz1) / 2);
  K.add(slab);
  KHSAN.door = { i: di, slab, t: 0, opening: false, y };
}

/* ---- Le Glas devient l'autel : mêmes paliers, mêmes prix, mêmes mods ; autre machine.
   Features.amp reçoit l'autel (altar : vrai) ; le rituel du Glas (offrande, coups tenus, relève,
   reprise) le pilote ; son apparence et ses sons sont les siens. */
function khBuildAltarFeature(group) {
  const R = glasResources(), A = KHSAN.altar, E = KHSY + 0.4, top = KHSAN.altarTop;
  share(R.T.ring); share(R.G.plane);                // partagés avec Le Glas : pas libérés au déchargement
  const g = new THREE.Group();
  g.position.set(A.x, 0, A.z);
  group.add(g);
  // berceau : l'arme couchée sur l'autel
  const holder = new THREE.Group();
  holder.position.set(0, top + 0.12, 0);
  g.add(holder);
  // pyramidion d'or, suspendu dans le faisceau
  const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.1, 4, 1), new THREE.MeshStandardMaterial({ color: 0xd8ac4a, roughness: 0.28, metalness: 0.9, emissive: 0x5ff2e2, emissiveIntensity: 0 }));
  pyr.rotation.y = Math.PI / 4;
  const cap = new THREE.Group(); cap.add(pyr); pyr.position.y = 0.55;
  g.add(cap);
  // faisceau : du puits du plafond à l'autel
  const H = KHSY + KHSAN.h + 9 - top;
  const beamMat = new THREE.MeshBasicMaterial({ map: TEX.beam, color: 0x5ff2e2, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, H, 20, 1, true), beamMat);
  beam.position.y = top + H / 2;
  g.add(beam);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, H, 12, 1, true), beamMat.clone());
  core.material.opacity = 0.9; core.position.y = top + H / 2;
  g.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x5ff2e2, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.position.y = top + 0.3; glow.scale.set(3.2, 2, 1);
  g.add(glow);
  // ondes au sol (comme celles du Glas, turquoise)
  const waves = [];
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial(Object.assign({ map: R.T.ring, color: 0x5ff2e2, opacity: 0 }, R.add));
    const m = new THREE.Mesh(R.G.plane, mat);
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3;
    group.add(m);
    waves.push({ m, mat, on: false, t: 0, dur: 1, R: 1, a: 1 });
  }
  const fp = { cx: A.x, cz: A.z, rot: 0, toWorld: (lx, lz) => [A.x + lx, A.z + lz], cells: [] };
  const amp = Features.amp = {
    altar: true, group: g, holder, cap, pyr, beam, core, glow, li: 0, E, s: 1, open: false, fp, cx: A.x, cz: A.z, waves,
    pos: { x: A.x, y: top + 0.6, z: A.z },
    state: 'mute', t: 0, tier: 0, weapon: null, landed: false, nextT: 0, lastT: 0, holdT: -9,
    lip: -1, flashT: 9, strikeT: 9, ropeT: 9, offerT: 9, sparkT: 0, struck: false,
    models: {}, display: null, called: [],
  };
  khAltarAnimate(amp, 0);
  Features.interactables.push({
    kind: 'amp', x: A.x, z: A.z + 1.9, y: E, r: 1.7, hold: true, layer: 1,
    prompt() { return glasPrompt(amp); },
    useHold() { glasUse(amp); },
  });
}
const KH_CAP = { up: 2.6, down: 0.02 };          // hauteur du pyramidion au-dessus du berceau : levé, posé sur l'arme
/* Image par image (à la place de glasAnimate) : pyramidion, faisceau, éclats des coups, ondes. */
function khAltarAnimate(amp, dt) {
  const st = amp.state, t = amp.t, top = KHSAN.altarTop;
  amp.flashT += dt; amp.strikeT += dt; amp.ropeT += dt; amp.offerT += dt;
  let lip = KH_CAP.up;
  if (st === 'ritual') {
    if (!amp.landed) lip = lerp(KH_CAP.up, KH_CAP.down, clamp(t / GLAS.fall, 0, 1) ** 2);
    else lip = KH_CAP.down + (amp.strikeT < 0.16 ? 0.04 * Math.sin((Math.PI * amp.strikeT) / 0.16) : 0);
  } else if (st === 'raise') lip = lerp(KH_CAP.down, KH_CAP.up, smooth(clamp(t / GLAS.raise, 0, 1)));
  amp.lip = lip;
  const now = G.time;
  amp.cap.position.y = top + 0.12 + lip + (lip > 2 ? 0.06 * Math.sin(now * 1.3) : 0);
  amp.cap.rotation.y = lip > 2 ? now * 0.25 : amp.cap.rotation.y;
  // faisceau : éteint sans courant, vif pendant le rituel, éclat à chaque coup
  const awake = st !== 'mute', flash = Math.exp(-amp.flashT / 0.35), k = (awake ? 0.55 : 0.12) + (st === 'ritual' ? 0.25 : 0) + flash * 0.9;
  const fl = 0.92 + Math.sin(now * 2.3) * 0.05 + Math.sin(now * 7.1) * 0.03;
  amp.beam.material.opacity = 0.32 * k * fl; amp.core.material.opacity = 0.75 * k * fl;
  amp.glow.material.opacity = 0.35 + 0.5 * k; amp.glow.scale.set(3 + flash * 3, 2 + flash * 1.5, 1);
  amp.pyr.material.emissiveIntensity = flash * 2.5 + (st === 'ritual' ? 0.3 : 0);
  if (KHSAN.light) KHSAN.light.intensity = KHSAN.under ? (0.6 + 1.6 * k) * fl : 0;
  // ondes au sol
  for (const w of amp.waves) {
    if (!w.on) continue;
    w.t += dt;
    if (w.t < 0) continue;
    const q = w.t / w.dur;
    if (q >= 1) { w.on = false; w.m.visible = false; continue; }
    w.m.visible = true;
    const r = Math.max(0.05, w.R * smooth(q));
    w.m.scale.set(r * 2, r * 2, 1);
    w.mat.opacity = w.a * (1 - q);
  }
  if (amp.display) { amp.display.rotation.x = 0; amp.display.position.y = st === 'ritual' && amp.landed ? Math.sin(now * 30) * 0.004 : 0; }
}
/* Invites de l'autel (le rituel est celui du Glas). */
function khAltarPrompt(amp) {
  const T = GLAS.tiers;
  switch (amp.state) {
    case 'mute': return { text: 'L’autel est éteint : il faut du courant (centrale du Nil)', disabled: true };
    case 'wake': return { text: 'Le faisceau s’éveille…', disabled: true };
    case 'ritual': {
      const n = glasNext(amp);
      if (n > 3) return { text: 'Le faisceau frappe…', disabled: true };
      return { text: `Maintenez F · Rayon ${T[n].roman}`, cost: T[n].cost, hold: key('KeyF'), sub: `${T[n].name} : ${T[n].desc}` };
    }
    case 'raise': return { text: 'Le pyramidion remonte…', disabled: true };
    case 'ready': return { text: `Appuyez sur F pour reprendre ${tierStats(amp.weapon.id, amp.tier).name}` };
    default: {
      const s = curSlot();
      if (!s) return null;
      const t = s.tier || 0;
      if (t >= 3) return { text: 'L’autel refuse cette arme : elle est au palier III', disabled: true };
      return { text: 'Appuyez sur F pour poser l’arme sur l’autel', cost: T[t + 1].cost, sub: `${wstat(s, 'name')} · Rayon ${T[t + 1].roman} : ${T[t + 1].name} (${T[t + 1].desc})` };
    }
  }
}

/* ---- Sons de l'autel (à la place de ceux de la cloche quand l'autel est la machine) */
function khAltarSound(kind, pos, a, b) {
  const bus = Sound.bus();
  if (!bus) return;
  const ctx = bus.ctx, t0 = ctx.currentTime, d = pos ? Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) : 0, vol = clamp(1.2 - d / 30, 0.08, 1);
  const out = ctx.createGain(); out.connect(bus.sortie);
  const tone = (f, dur, type = 'sine', g0 = 0.2, f1 = f, at = 0) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0 + at); if (f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t0 + at + dur);
    g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(g0 * vol, t0 + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    o.connect(g); g.connect(out); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
  };
  const noise = (dur, f, q, g0, at = 0) => {
    const n = ctx.createBufferSource(), len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), dd = buf.getChannelData(0);
    for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = g0 * vol;
    n.connect(fl); fl.connect(g); g.connect(out); n.start(t0 + at);
  };
  switch (kind) {
    case 'toll': {                                  // le faisceau frappe : grondement grave et carillon de verre
      const tier = a || 1, f = [55, 49, 43.6, 36.7][tier] || 55;
      tone(f, 3.2, 'sine', 0.32 * (b || 1)); tone(f * 2.01, 2.4, 'triangle', 0.1 * (b || 1)); tone(f * 7.98, 1.6, 'sine', 0.05, f * 7.9);
      tone(880 + tier * 110, 1.8, 'sine', 0.06, 870 + tier * 110, 0.05); tone(1318, 1.4, 'sine', 0.04, 1310, 0.1);
      noise(0.5, 220, 0.8, 0.18);
      break;
    }
    case 'fall': tone(330, a || 0.8, 'sine', 0.05, 110); noise(a || 0.8, 1800, 0.6, 0.03); break;
    case 'impact': tone(62, 1.2, 'sine', 0.3, 48); noise(0.7, 160, 0.7, 0.3); break;
    case 'raise': tone(110, a || 0.8, 'sine', 0.05, 330); noise(a || 0.8, 2400, 0.5, 0.02); break;
    case 'offer': tone(220, 0.5, 'triangle', 0.06, 196); noise(0.25, 900, 1.2, 0.06); break;
    case 'chime': tone(660, 1.2, 'sine', 0.08); tone(990, 1.4, 'sine', 0.06, 990, 0.08); tone(1320, 1.6, 'sine', 0.04, 1320, 0.16); break;
    case 'lost': tone(196, 1.5, 'sine', 0.08, 98); noise(0.8, 700, 0.6, 0.06); break;
    default: break;
  }
}
const khAltarOn = () => !!(OW.on && Features.amp && Features.amp.altar);
(function khWrapGlasSounds() {
  const wrap = (name, kind, map) => {
    const f = Sound[name];
    if (typeof f !== 'function') return;
    Sound[name] = function (...args) { if (khAltarOn()) return khAltarSound(kind, ...(map ? map(args) : args)); return f.apply(this, args); };
  };
  wrap('glasToll', 'toll');
  wrap('glasFall', 'fall', (a) => [a[0], a[1]]);
  wrap('glasImpact', 'impact');
  wrap('glasRaise', 'raise', (a) => [a[0], a[1]]);
  wrap('glasOffer', 'offer');
  wrap('glasChime', 'chime');
  wrap('glasLost', 'lost');
  const hum = Sound.glasHum;
  if (typeof hum === 'function') Sound.glasHum = function (level, pos) { return hum.call(this, khAltarOn() && !KHSAN.under ? 0 : level, pos); };
})();

/* ---- Passages : l'escalier du kiosque et celui du sanctuaire (fondu au noir) */
const KHP = { busy: 0, el: null };
function khFade(on, dur = 0.35) {
  if (!KHP.el) {
    KHP.el = el('div', 'kh-fade');
    Object.assign(KHP.el.style, { position: 'fixed', inset: '0', background: '#000', opacity: '0', pointerEvents: 'none', transition: `opacity ${dur}s ease`, zIndex: '40' });
    document.body.append(KHP.el);
  }
  KHP.el.style.transition = `opacity ${dur}s ease`;
  KHP.el.style.opacity = on ? '1' : '0';
}
/* Passer d'une couche à l'autre : fondu, joueur posé à l'arrivée, fondu retour. */
function khPortal(to, name) {
  if (KHP.busy > 0) return;
  KHP.busy = 1.1;
  khFade(true);
  schedule(0.4, () => {
    placePlayer(to.x, to.z, to.layer ? -1 : 0);
    player.yaw = to.yaw;
    player.vel.set(0, 0, 0);
    clearFarZombies();
    khSetView(to.layer ? 'under' : 'surface');
    if (name) HUD.zone(name);
    khFade(false);
  });
}
/* Les zombies de l'autre couche ne suivent pas : retirés (ils ressortiront près du joueur). */
function clearFarZombies() {
  for (const z of Zombies.list.slice()) {
    if (!z.alive || z.boss) continue;
    if ((z.layer | 0) !== (player.layer | 0)) { if (z.rodeur) removeZombie(z); else recycleZombie(z); }
  }
}
/* Sous terre : la surface est cachée (rien ne s'y voit), le soleil ne fait plus d'ombres. */
function khSetUnder(on) {
  KHSAN.under = on;
  // (les lumières restent visibles : leur nombre ne change pas, rien n'est recompilé)
  const hide = (o) => { if (o === KHSAN.group || o.isLight) return; if (o.getObjectByProperty('isLight', true)) { for (const c of o.children) hide(c); return; } o.visible = !on; };
  if (World.root) for (const c of World.root.children) hide(c);
  OWNAV.ready = false;
  if (Features.amp && Features.amp.altar) khAltarAnimate(Features.amp, 0);
}
function khPortalInteractables() {
  const K = KHSAN.kioskW || KHSAN.kiosk, F = KHSAN.stairFoot, out = K.out || { x: K.x, z: K.z + 1.6, yaw: Math.PI };
  Features.interactables.push({
    kind: 'portal', x: K.x, z: K.z, y: K.y, r: 1.5,
    prompt() { return { text: 'Appuyez sur F pour descendre au sanctuaire', sub: '40 m sous le plateau' }; },
    use() { khPortal({ x: F.x, z: F.z - 1.2, layer: 1, yaw: 0 }, 'Sanctuaire'); },
  });
  Features.interactables.push({
    kind: 'portal', x: F.x, z: F.z, y: F.y, r: 1.8, layer: 1,
    prompt() { return { text: 'Appuyez sur F pour remonter au plateau', sub: 'Kiosque du sanctuaire' }; },
    use() { khPortal({ x: out.x, z: out.z, layer: 0, yaw: out.yaw }, KH.locs[1].name); },
  });
  // porte du kiosque : scellée jusqu'au courant
  const D = KHSAN.door, P = KH.places.B.kiosk, sq = owPt(P.node, (P.door[0] + P.door[2]) / 2, P.y, P.door[3] + 0.9);
  Features.interactables.push({
    kind: 'seal', x: sq.x, z: sq.z, y: sq.y, r: 1.6,
    prompt() { return OW.doors[D.i].open || D.opening ? null : { text: 'Porte scellée : rétablissez le courant à la centrale du Nil', disabled: true }; },
    use() {},
  });
}

/* ---- Chaque image : porte, feux, faisceau ; couche du joueur */
function khSanctuaryUpdate(dt) {
  KHSAN.t += dt;
  const D = KHSAN.door;
  if (D) {
    const open = OW.doors[D.i].open;
    if (G.power && !open && !D.opening) { D.opening = true; D.t = 0; Sound.powerOn(); Sound.setHum(false); HUD.banner('Le sanctuaire s’ouvre', 'La porte du kiosque s’enfonce dans le sol · plateau des pyramides', 'power'); }
    if (D.opening) {
      D.t += dt;
      const k = clamp(D.t / 2.6, 0, 1);
      D.slab.position.y = D.y - 3.25 * smooth(k);
      if (Math.random() < dt * 10 && k < 1) { const q = owPt(KH.places.B.kiosk.node, D.slab.position.x + rand(-1, 1), D.y, D.slab.position.z + 0.4); owSandBurst(q.x, q.z, q.y); }
      if (k >= 1) { D.opening = false; OW.doors[D.i].open = true; }
    }
  }
  // feux des braseros (flamme, lumière qui vacille)
  const t = KHSAN.t;
  for (const B of KHSAN.fire) {
    const f = 0.85 + Math.sin(t * 9 + B.ph) * 0.08 + Math.sin(t * 23 + B.ph * 2) * 0.06;
    B.fire.forEach((sp, i) => { sp.scale.set((0.9 - i * 0.2) * B.s * f, (1.2 + i * 0.25) * B.s * (2 - f), 1); sp.material.opacity = 0.85 - i * 0.2; });
    B.L.size = B.L.base * f;
  }
  // couche du joueur (au cas où un saut, une téléportation l'auraient changée)
  if (!KHT.ride && KHSAN.view !== 'tunnel') {
    const under = (player.layer | 0) === 1;
    if (under !== KHSAN.under) khSetView(under ? 'under' : 'surface');
  }
  if (KHP.busy > 0) KHP.busy -= dt;
}
function khSanctuaryReset() {
  const D = KHSAN.door;
  if (D) { D.opening = false; D.t = 0; D.slab.position.y = D.y; OW.doors[D.i].open = false; }
  KHP.busy = 0;
  if (KHP.el) khFade(false, 0.01);
  khSetView('surface');
}

/* Réglage de lumière du sanctuaire : pas de soleil, braseros chauds, brume sombre. */
OW_GRADES.S = { az: 0, el: 60, sun: 0x000000, sunI: 0, hemiSky: 0x7a5a3c, hemiGround: 0x2e3a38, hemiI: 0.55, top: 0x0c0a08, horizon: 0x1a120c, ground: 0x0c0a08, haze: 0x1c140e, exp: 1.0, stars: 0, sunK: 0 };

/* Apparitions sous terre : dans les fosses de sable, à 8–45 m du joueur, plutôt hors de vue. */
function khPickSpawnUnder() {
  const p = player, others = Zombies.list.filter((z) => z.alive && z.state === 'rise');
  const cand = KHSAN.pits.filter((q) => { const d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z); return d > 6 && d < 48; });
  if (!cand.length) return null;
  for (let tries = 0; tries < 12; tries++) {
    const q = cand[Math.floor(Math.random() * cand.length)], x = q.x + rand(-1.2, 1.2), z = q.z + rand(-1.2, 1.2);
    if (others.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 1.2)) continue;
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!owWalkCell(1, cx, cz)) continue;
    return { riser: true, x, z, li: 0, k: owK(1, cx, cz), zone: 1, layer: 1, y: owGroundAt(1, x, z) };
  }
  return null;
}
