/* --------------------------------------------------------- Lune : les lieux --
   A Base Séléné (moyeu octogonal sous coupole, quatre modules cylindriques en croix, deux sas, grande
   baie vers la fosse et le dépôt : le départ), C pont en treillis (tablier de 6 m au niveau −24 m),
   D catapulte (voie surélevée sur portiques jusqu'à +46 m au bord nord, gare de chargement, capsules),
   E crête solaire (cinq mâts de 46 m, panneaux verticaux face au Soleil, poste électrique), F tour
   relais (treillis jusqu'à +123 m, plate-forme, ascenseur), G plateau d'extraction (atterrisseur,
   balisage, abri), H dépôt d'oxygène (sphères sur berceaux : une seule explosion), I convoyeur (bande
   sur treillis, du bord ouest au fond), J foreuse à glace (derrick de 30 m), lampadaires des gradins.
   Chaque pièce écrit sa géométrie (kit) et ses cases (solides) ; le pont et le convoyeur sont des
   tabliers (couche 1).
   Jeu 2.0.3 : pièces du décor (voir « Décor des lieux ») : tout se retouche, surface par surface ;
   ce qui en dépend dans le jeu suit leur pose (LUPL.nodes) : l'air de la base (moyeu et modules),
   le perchoir, l'échelle et l'ascenseur de la tour, la quête (tour, cabine, atterrisseur), le dépôt
   (explosion, sphères), la catapulte (capsules) et le convoyeur (sens de la bande). */
(function luTextures() {
  defTex('lu_panel', 'Panneaux blancs (Lune)', 'metal', { size: [2, 2], rough: 0.55, metal: 0.15 }, tgPanels({ tile: 2, color: [214, 214, 208], panel: 0.66, screws: true }));
  defTex('lu_ceil', 'Plafond acoustique (Lune)', 'metal', { size: [2, 2], rough: 0.92, metal: 0 }, tgPanels({ tile: 2, color: [226, 226, 222], panel: 1, screws: false }));
  defTex('lu_panel_dark', 'Panneaux gris (Lune)', 'metal', { size: [2, 2], rough: 0.6, metal: 0.25 }, tgPanels({ tile: 2, color: [112, 116, 120], panel: 1, screws: true }));
  defTex('lu_metal', 'Métal brossé (Lune)', 'metal', { size: [2, 2], rough: 0.45, metal: 0.6 }, tgMetalPlates({ tile: 2, color: [150, 152, 154], plate: 1, rivets: true }));
  defTex('lu_grate', 'Caillebotis (Lune)', 'metal', { size: [1, 1], rough: 0.55, metal: 0.5 }, tgGrating({ tile: 1, color: [120, 122, 124], bg: [22, 22, 24], mesh: 0.05 }));
  defTex('lu_floor', 'Sol de module (Lune)', 'sol', { size: [2, 2], rough: 0.7 }, tgDiamondPlate({ tile: 2, color: [96, 100, 104] }));
  defTex('lu_yellow', 'Jaune de sécurité (Lune)', 'metal', { size: [2, 2], rough: 0.6, metal: 0.2 }, tgPanels({ tile: 2, color: [214, 168, 40], panel: 2 }));
  defTex('lu_hazard', 'Bandes de danger (Lune)', 'metal', { size: [1, 1], rough: 0.6 }, tgHazard({ c1: [210, 160, 30], c2: [30, 28, 26], stripes: 6 }));
  defTex('lu_solar', 'Cellules solaires (Lune)', 'metal', { size: [2, 2], rough: 0.25, metal: 0.4 }, (g, w, h, R) => {
    g.fillStyle = '#16233c'; g.fillRect(0, 0, w, h);
    const n = 8, c = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 34 + R() * 14;
      g.fillStyle = `rgb(${v * 0.55 | 0},${v * 0.8 | 0},${v * 1.5 | 0})`; g.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
      g.fillStyle = 'rgba(200,210,230,0.25)'; g.fillRect(i * c + c / 2 - 0.5, j * c + 2, 1, c - 4);
    }
    g.strokeStyle = 'rgba(210,214,220,0.8)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  });
  defTex('lu_foil', 'Isolant doré (Lune)', 'metal', { size: [1, 1], rough: 0.35, metal: 0.85 }, (g, w, h, R) => {
    const n = vnoise(w, h, [[6, 6, 1], [18, 18, 0.7], [48, 48, 0.4]], 2.2, R);
    paintPixels(g, w, h, (x, y, c) => { const v = 0.55 + 0.6 * n[y * w + x]; c[0] = 214 * v; c[1] = 168 * v; c[2] = 74 * v; });
    g.strokeStyle = 'rgba(80,50,10,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 60; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 80, y + (R() - 0.5) * 80); g.stroke(); }
  });
  defTex('lu_glass', 'Verre de hublot (Lune)', 'verre', { size: [2, 2], rough: 0.08, metal: 0.6 }, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a3440'); gr.addColorStop(0.5, '#56687a'); gr.addColorStop(1, '#1c242c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
})();

/* Cylindre couché (axe x ou z) : coordonnées de texture en mètres ; ouvert (bouts à part). */
function luTube(K, tex, hex, x, y, z, r, len, alongX, seg = 24, open = true) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open);
  const uv = g.attributes.uv, S = TEXLIB[tex] ? TEXLIB[tex].size : [2, 2];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * TAU * r) / S[0], (uv.getY(i) * len) / S[1]);
  K.geo(tex, hex, g, mtx(x, y, z, alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0));
  g.dispose();
}
/* Calotte (dôme) : demi-sphère aplatie, tournée vers dir ([0,1,0] pour une coupole). */
function luDome(K, tex, hex, x, y, z, r, h, dir = [0, 1, 0], seg = 20) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg / 3 | 0), 0, TAU, 0, Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TAU * r / 2, uv.getY(i) * r);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, h, r));
  K.geo(tex, hex, g, m);
  g.dispose();
}
/* Poutre de (a) à (b), section w × w (treillis, portiques). */
function luBeam(K, tex, hex, ax, ay, az, bx, by, bz, w) {
  K.geo(tex, hex, GEO.box, beamMtx(ax, ay, az, bx, by, bz, w, w));
}
const LUPL = { base: null };

/* -------------------------------------------------------------- Terrain --
   Retouches avant les pentes et la carte de soleil : aire du poste de la crête, sommet de la butte
   de la tour, pied de la foreuse. */
function luShapeTerrain() {
  owLevel(380, 702, 404, 724, owHeightAtGrid(392, 713), 8);       // poste électrique de la crête
  owLevel(474, 360, 500, 396, owHeightAtGrid(487, 372), 10);      // pied de la tour et sa cabine
  owLevel(862, 790, 884, 812, owHeightAtGrid(873, 801), 10);      // gare de la catapulte
}

/* Kit dont les faces se tournent d'elles-mêmes vers la normale donnée (l'ordre des coins n'importe plus). */
function luKit(name) {
  const K = owKit(name), q = K.quad, t = K.tri;
  const flip = (p0, p1, p2, n) => {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    return (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0;
  };
  K.quad = (tex, hex, p0, p1, p2, p3, n, uvOf) => (flip(p0, p1, p2, n) ? q(tex, hex, p0, p3, p2, p1, n, uvOf) : q(tex, hex, p0, p1, p2, p3, n, uvOf));
  K.tri = (tex, hex, a, b, c, n, uvOf) => (flip(a, b, c, n) ? t(tex, hex, a, c, b, n, uvOf) : t(tex, hex, a, b, c, n, uvOf));
  K.mk = luKit;                     // pièces du décor (jeu 2.0.3) : un kit qui se tourne de même
  return K;
}
function luBuildPlaces(root) {
  OWL.lamps = [];
  OW.placesRoot = root;
  owItemsBegin();
  LUPL.nodes = { arm: {} };
  const K = luKit('lune-lieux');
  // grande pièce d'un lieu (jeu 2.0.3 : retouchable ; logic : ce qui la suit dans le jeu)
  const piece = (place, kind, title, L, fn, logic) => { OWPI.place = place; K.item(kind, title, L.x, owH(L.x, L.z), L.z, fn, { logic }); return K.lastItem; };
  const loc = (id) => LU.locs.find((L) => L.id === id);
  const B = luBaseGeo();
  LUPL.nodes.base = piece('A', 'base', 'Base Séléné', { x: B.x, z: B.z }, (K) => luBase(K), 'Air respirable, sas et éclairage suivent le moyeu et chaque module (le départ et ce qui est posé dedans suivent quand on déplace la base dans les Mod Tools).');
  LUPL.nodes.bridge = piece('C', 'pont', 'Pont suspendu', loc('C'), (K) => luBridge(K), 'Le tablier (où l’on marche) suit le pont.');
  LUPL.nodes.conv = piece('I', 'convoyeur', 'Convoyeur', loc('I'), (K) => luConveyor(K), 'La bande et son sens de marche suivent le convoyeur (la tranchée creusée dans les gradins reste où elle est).');
  LUPL.nodes.cata = piece('D', 'catapulte', 'Catapulte électromagnétique', loc('D'), (K) => luCatapult(K, root), 'Les capsules partent le long de la voie, où qu’elle soit.');
  luMasts(K);
  LUPL.nodes.tower = piece('F', 'tour', 'Tour relais', loc('F'), (K) => luTower(K), 'Perchoir, échelle, ascenseur et centrale inertielle (pièce ①) suivent la tour, chacun avec sa surface.');
  luPlateau(K);
  LUPL.nodes.depot = piece('H', 'depot', 'Dépôt d’oxygène', loc('H'), (K) => luDepot(K, root), 'L’explosion de la manche 1 part des sphères, où qu’elles soient.');
  luDrill(K); luPitLamps(K); luPads(K, root);
  owItemsBuild(K, root);
  K.build(root);
}

/* ---------------------------------------------------------- A : la base --
   Moyeu octogonal (6 m d'apothème intérieur, murs de 4,4 m, coupole), quatre modules de 16 m
   (intérieur 4,4 × 3 m), sas au bout des modules ouest (vers la fosse) et nord (vers la catapulte).
   Baie panoramique au sud-ouest : depuis le départ, on voit le dépôt d'oxygène au-delà de la fosse. */
function luBaseGeo() {
  if (LUPL.base) return LUPL.base;
  const x = LU.base.x, z = LU.base.z, y = owHeightAtGrid(x, z) + 0.45;
  LUPL.base = { x, z, y, ap: 6.0, wall: 0.6, h: 4.4, arm: 16, aw: 2.2, ah: 3.0, ar: 3.0 };
  return LUPL.base;
}
const LU_OCT = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4; return [Math.sin(a), -Math.cos(a)]; });   // faces N, NE, E, SE, S, SO, O, NO (normales)
const LU_DIR8 = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
const LU_DOOR_SIDES = { 0: ['ouest', 'est'], 2: ['nord', 'sud'], 4: ['est', 'ouest'], 6: ['sud', 'nord'] };   // de part et d'autre des portes du moyeu
function luOctD(dx, dz) {
  let d = -Infinity, f = 0;
  for (let i = 0; i < 8; i++) { const v = dx * LU_OCT[i][0] + dz * LU_OCT[i][1]; if (v > d) { d = v; f = i; } }
  return [d, f];
}
/* Jeu 2.0.3 : la base en éléments (le moyeu, chaque module avec son sas) ; l'air suit chacun. */
function luBase(K) {
  const B = luBaseGeo(), { x, z, y } = B, ext = B.ap + B.wall, sm = (ext - 0.3 + ext + B.arm) / 2;
  K.item('moyeu', 'Moyeu (coupole, baie, console)', x, y, z, (K) => luHub(K), { ground: false, logic: 'L’air respirable du moyeu le suit.' });
  LUPL.nodes.hub = K.lastItem;
  const NAMES = { n: 'nord', e: 'est', s: 'sud', o: 'ouest' };
  for (const [dir, nx, nz] of [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['o', -1, 0]]) {
    K.item('module', `Module ${NAMES[dir]}${dir === 'n' || dir === 'o' ? ' et son sas' : ''}`, x + nx * sm, y, z + nz * sm, (K) => luArm(K, B, dir, nx, nz), { ground: false, logic: 'L’air respirable du module (et de son sas) le suit.' });
    LUPL.nodes.arm[dir] = K.lastItem;
  }
}
function luHub(K) {
  const B = luBaseGeo(), { x, z, y, ap, wall, h } = B, top = y + h;
  const ext = ap + wall;
  // --- moyeu : cases (sol couvert, murs ; portes N, E, S, O ; baie au sud-ouest)
  for (let cz = Math.floor(z - ext - 1); cz <= Math.ceil(z + ext + 1); cz++) {
    for (let cx = Math.floor(x - ext - 1); cx <= Math.ceil(x + ext + 1); cx++) {
      const [d, f] = luOctD(cx + 0.5 - x, cz + 0.5 - z);
      if (d < ap) owSet(OW.surf, cx, cz, OWK.FLOOR, { base: y, ceil: top, roof: top + 3.6, mat: OWM.METAL });
      else if (d < ext + 0.2) {
        const door = f % 2 === 0 && Math.abs(f === 0 || f === 4 ? cx + 0.5 - x : cz + 0.5 - z) < B.aw;
        if (door) owSet(OW.surf, cx, cz, OWK.FLOOR, { base: y, ceil: y + B.ah, roof: top, mat: OWM.METAL });
        else owSet(OW.surf, cx, cz, OWK.SOLID, { base: y - 0.5, top: top + 2, mat: OWM.METAL });
      }
    }
  }
  // géométrie : sol, faces de l'octogone (dehors et dedans), baie, coupole
  const R8 = ext / Math.cos(Math.PI / 8), r8 = ap / Math.cos(Math.PI / 8);
  const corner = (i, R) => { const a = (i * Math.PI) / 4 - Math.PI / 8; return [x + Math.sin(a) * R, z - Math.cos(a) * R]; };
  {
    // sol intérieur (octogone en éventail)
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push(corner(i, r8));
    K.group('Sol du moyeu', () => { for (let i = 0; i < 8; i++) { const a = pts[i], b = pts[(i + 1) % 8]; K.tri('lu_floor', 0xffffff, [x, y, z], [b[0], y, b[1]], [a[0], y, a[1]], [0, 1, 0], (p) => [p[0], p[2]]); } });
    // plafond intérieur (vu d'en dessous)
    K.group('Plafond du moyeu', () => { for (let i = 0; i < 8; i++) { const a = pts[i], b = pts[(i + 1) % 8]; K.tri('lu_ceil', 0xffffff, [x, top, z], [a[0], top, a[1]], [b[0], top, b[1]], [0, -1, 0], (p) => [p[0], p[2]]); } });
    // dalles lumineuses (en couronne autour de la coupole)
    const lp = new THREE.MeshBasicMaterial({ color: 0xeef2ff });
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4, m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.5), lp); m.position.set(x + Math.sin(a) * 3.4, top - 0.03, z + Math.cos(a) * 3.4); m.rotation.y = a; K.group('Dalle lumineuse', () => K.add(m)); }
  }
  for (let f = 0; f < 8; f++) {
    const [ox0, oz0] = corner(f, R8), [ox1, oz1] = corner(f + 1, R8), [ix0, iz0] = corner(f, r8), [ix1, iz1] = corner(f + 1, r8);
    const n = LU_OCT[f], door = f % 2 === 0, bay = f === 5, side = LU_DIR8[f];     // jeu 2.0.3 : surfaces nommées
    const segs = door ? [[0, 0.5 - B.aw / (2 * Math.hypot(ox1 - ox0, oz1 - oz0)) * 1.0], [0.5 + B.aw / (2 * Math.hypot(ox1 - ox0, oz1 - oz0)), 1]] : [[0, 1]];
    for (const [t0, t1] of segs) {
      const P = (ax, az, bx, bz, t) => [lerp(ax, bx, t), lerp(az, bz, t)];
      const [a0x, a0z] = P(ox0, oz0, ox1, oz1, t0), [a1x, a1z] = P(ox0, oz0, ox1, oz1, t1), [b0x, b0z] = P(ix0, iz0, ix1, iz1, t0), [b1x, b1z] = P(ix0, iz0, ix1, iz1, t1);
      if (bay) {
        // baie : allège, vitrage (de 1 m à 3,4 m), linteau
        const yl = y + 1.0, yh = y + 3.4;
        K.group('Allège de la baie (dehors)', () => K.quad('lu_panel', 0xffffff, [a0x, y - 0.6, a0z], [a1x, y - 0.6, a1z], [a1x, yl, a1z], [a0x, yl, a0z], [n[0], 0, n[1]], (p) => [p[0] * n[1] - p[2] * n[0], p[1]]));
        K.group('Linteau de la baie (dehors)', () => K.quad('lu_panel', 0xffffff, [a0x, yh, a0z], [a1x, yh, a1z], [a1x, top, a1z], [a0x, top, a0z], [n[0], 0, n[1]], (p) => [p[0] * n[1] - p[2] * n[0], p[1]]));
        K.group('Allège de la baie (dedans)', () => K.quad('lu_panel', 0xe6e6e0, [b1x, y, b1z], [b0x, y, b0z], [b0x, yl, b0z], [b1x, yl, b1z], [-n[0], 0, -n[1]], (p) => [-(p[0] * n[1] - p[2] * n[0]), p[1]]));
        K.group('Linteau de la baie (dedans)', () => K.quad('lu_panel', 0xe6e6e0, [b1x, yh, b1z], [b0x, yh, b0z], [b0x, top, b0z], [b1x, top, b1z], [-n[0], 0, -n[1]], (p) => [-(p[0] * n[1] - p[2] * n[0]), p[1]]));
        // montants de la baie
        for (const t of [0.02, 0.36, 0.68, 0.98]) { const [mx, mz] = P(a0x, a0z, a1x, a1z, t), [nx2, nz2] = P(b0x, b0z, b1x, b1z, t); K.group('Montant de la baie', () => luBeam(K, 'lu_metal', 0x6a6e72, (mx + nx2) / 2, yl, (mz + nz2) / 2, (mx + nx2) / 2, yh, (mz + nz2) / 2, 0.16)); }
        LUPL.bay = { a: [a0x, a0z], b: [a1x, a1z], yl, yh, n };
      } else {
        const hi = door && (t0 > 0.01 || t1 < 0.99) ? top : top;
        const part = door ? `, côté ${LU_DOOR_SIDES[f][t0 < 0.01 ? 0 : 1]} de la porte` : '';
        K.group(`Paroi ${side} (dehors${part})`, () => K.quad('lu_panel', 0xffffff, [a0x, y - 0.6, a0z], [a1x, y - 0.6, a1z], [a1x, hi, a1z], [a0x, hi, a0z], [n[0], 0, n[1]], (p) => [p[0] * n[1] - p[2] * n[0], p[1]]));
        K.group(`Paroi ${side} (dedans${part})`, () => K.quad('lu_panel', 0xe6e6e0, [b1x, y, b1z], [b0x, y, b0z], [b0x, top, b0z], [b1x, top, b1z], [-n[0], 0, -n[1]], (p) => [-(p[0] * n[1] - p[2] * n[0]), p[1]]));
      }
    }
    if (door) {
      // linteau au-dessus de la porte (dehors et dedans)
      const t0 = 0.5 - B.aw / Math.hypot(ox1 - ox0, oz1 - oz0), t1 = 1 - t0;
      const L = (ax, az, bx, bz, t) => [lerp(ax, bx, t), lerp(az, bz, t)];
      const [a0x, a0z] = L(ox0, oz0, ox1, oz1, t0), [a1x, a1z] = L(ox0, oz0, ox1, oz1, t1), [b0x, b0z] = L(ix0, iz0, ix1, iz1, t0), [b1x, b1z] = L(ix0, iz0, ix1, iz1, t1);
      K.group(`Linteau de la porte ${side} (dehors)`, () => K.quad('lu_panel', 0xffffff, [a0x, y + B.ah, a0z], [a1x, y + B.ah, a1z], [a1x, top, a1z], [a0x, top, a0z], [n[0], 0, n[1]], (p) => [p[0] * n[1] - p[2] * n[0], p[1]]));
      K.group(`Linteau de la porte ${side} (dedans)`, () => K.quad('lu_panel', 0xe6e6e0, [b1x, y + B.ah, b1z], [b0x, y + B.ah, b0z], [b0x, top, b0z], [b1x, top, b1z], [-n[0], 0, -n[1]], (p) => [-(p[0] * n[1] - p[2] * n[0]), p[1]]));
    }
    // bande dorée au pied, cerclage en haut
    K.group(`Bande dorée ${side}`, () => K.quad('lu_foil', 0xffffff, [ox0 + n[0] * 0.03, y - 0.6, oz0 + n[1] * 0.03], [ox1 + n[0] * 0.03, y - 0.6, oz1 + n[1] * 0.03], [ox1 + n[0] * 0.03, y + 0.35, oz1 + n[1] * 0.03], [ox0 + n[0] * 0.03, y + 0.35, oz0 + n[1] * 0.03], [n[0], 0, n[1]], (p) => [p[0] * n[1] - p[2] * n[0], p[1]]));
  }
  K.group('Coupole', () => luDome(K, 'lu_panel', 0xf0f0ea, x, top, z, R8 * 0.98, 3.4, [0, 1, 0], 24));
  K.group('Cerclage de la coupole', () => K.geo('lu_metal', 0x8a8e92, new THREE.CylinderGeometry(R8, R8, 0.3, 24, 1, true), mtx(x, top + 0.1, z, 0, 0, 0)));   // cerclage (ouvert : il ne ferme pas le plafond)
  // antenne et parabole sur la coupole
  K.group('Antenne', () => K.cyl('lu_metal', 0x9a9ea2, x + 1.5, top + 4.4, z - 1, 0.06, 3, 6));
  K.group('Parabole', () => luDome(K, 'lu_panel', 0xffffff, x + 1.5, top + 5.6, z - 1, 0.9, 0.35, [0.5, 0.6, -0.6], 14));
  // vitrage de la baie (une vraie vitre : on voit dehors)
  if (LUPL.bay) {
    const b = LUPL.bay, mat = new THREE.MeshBasicMaterial({ color: 0x0c1418, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const g = new THREE.BufferGeometry();
    const mx = (b.a[0] + b.b[0]) / 2 - b.n[0] * 0.3, mz = (b.a[1] + b.b[1]) / 2 - b.n[1] * 0.3;
    g.setAttribute('position', new THREE.Float32BufferAttribute([b.a[0] - b.n[0] * 0.3, b.yl, b.a[1] - b.n[1] * 0.3, b.b[0] - b.n[0] * 0.3, b.yl, b.b[1] - b.n[1] * 0.3, b.b[0] - b.n[0] * 0.3, b.yh, b.b[1] - b.n[1] * 0.3, b.a[0] - b.n[0] * 0.3, b.yh, b.a[1] - b.n[1] * 0.3], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.renderOrder = 4; m.name = 'baie'; K.group('Vitrage de la baie', () => K.add(m));
    LUPL.bayCenter = [mx, mz];
  }
  // lumières intérieures (toujours allumées : batteries) ; spots dans les modules
  for (const [dx, dz] of [[0, 0], [3, 3], [-3, 3], [3, -3], [-3, -3]]) owLamp(K, x + dx, top - 0.7, z + dz, 0xf2f4ff, false, 0.8);
  // intérieur du moyeu : console centrale, carte de la mine, casiers
  K.group('Console centrale', () => K.box('lu_panel_dark', 0xffffff, x - 1.2, y, z - 0.6, x + 1.2, y + 1.0, z + 0.6).box('lu_metal', 0x2a3038, x - 1.15, y + 1.0, z - 0.55, x + 1.15, y + 1.06, z + 0.55));
  K.solid(x - 1.2, z - 0.6, x + 1.2, z + 0.6, OWK.LOW, { base: y, top: y + 1.06, mat: OWM.METAL });
  K.group('Écran de la console', () => luScreen(K, x, y + 1.06, z, 0x3ad0ff));
}
/* Écran lumineux posé sur une console. */
function luScreen(K, x, y, z, col) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
  m.position.set(x, y + 0.36, z); m.rotation.x = -0.9; K.add(m);
}
/* Un module : tube couché, intérieur en boîte (sol, plafond, parois), bouts en calotte ; sas au bout. */
function luArm(K, B, dir, nx, nz) {
  const { x, z, y } = B, along = nx !== 0, ext = B.ap + B.wall, L = B.arm, aw = B.aw, ah = B.ah, R = B.ar;
  const s0 = ext - 0.3, s1 = ext + L;                       // abscisses (depuis le centre) du module
  const P = (s, l) => [x + nx * s - nz * l, z + nz * s + nx * l];   // s le long, l en travers
  const air = dir === 'o' || dir === 'n';                   // sas au bout
  // cases : sol couvert (largeur 4,4), murs de part et d'autre, bout fermé ou sas ouvert
  for (let s = Math.floor(s0); s < Math.ceil(s1 + (air ? 5 : 2.2)); s++) {
    for (let l = -Math.ceil(aw) - 1; l <= Math.ceil(aw); l++) {
      const [cxf, czf] = P(s + 0.5, l + 0.5), cx = Math.floor(cxf), cz = Math.floor(czf);
      const inside = l + 0.5 > -aw && l + 0.5 < aw;
      const end = s + 0.5 > s1 + (air ? 4.6 : 2.0);
      if (s + 0.5 < ext + 0.2 && !(inside)) continue;
      if (air && s + 0.5 > s1 && s + 0.5 < s1 + 4.6) {
        // sas : couloir plus étroit (2,4 m), ouvert au bout
        if (Math.abs(l + 0.5) < 1.2) owSet(OW.surf, cx, cz, OWK.FLOOR, { base: y, ceil: y + 2.6, roof: y + 3.4, mat: OWM.METAL });
        else owSet(OW.surf, cx, cz, OWK.SOLID, { base: y - 0.5, top: y + 3.6, mat: OWM.METAL });
        continue;
      }
      if (end) continue;
      if (inside && s + 0.5 < s1 - 0.1) owSet(OW.surf, cx, cz, OWK.FLOOR, { base: y, ceil: y + ah, roof: y + R + 1.6, mat: OWM.METAL });
      else owSet(OW.surf, cx, cz, OWK.SOLID, { base: y - 0.5, top: y + R + 1.6, mat: OWM.METAL });
    }
  }
  // géométrie : tube extérieur, calotte au bout, intérieur
  const sm = (s0 + s1) / 2, [mx, mz] = P(sm, 0), yc = y + 1.6;
  K.group('Tube du module', () => luTube(K, 'lu_panel', 0xf4f4ee, mx, yc, mz, R, s1 - s0, along, 28, true));
  for (const s of [s0 + 1.2, sm, s1 - 1.2]) { const [rx, rz] = P(s, 0); K.group('Cerclage du tube', () => luTube(K, 'lu_metal', 0x9a9ea2, rx, yc, rz, R + 0.06, 0.35, along, 28, true)); }
  const [ex, ez] = P(s1, 0);
  K.group(air ? 'Calotte du sas' : 'Calotte du bout', () => luDome(K, 'lu_panel', 0xf0f0ea, ex, yc, ez, R, air ? 1.2 : 2.2, [nx, 0, nz], 24));
  // berceaux sous le tube
  for (const s of [s0 + 3, s1 - 3]) { const [bx, bz] = P(s, 0); K.group('Berceau', () => K.box('lu_metal', 0x6a6e72, bx - (along ? 0.3 : R * 0.8), y - 1.5, bz - (along ? R * 0.8 : 0.3), bx + (along ? 0.3 : R * 0.8), y - 0.1, bz + (along ? R * 0.8 : 0.3))); }
  // hublots
  for (let s = s0 + 3.5; s < s1 - 2; s += 4.5) for (const side of [-1, 1]) { const [hx, hz] = P(s, side * (R + 0.02)); const d = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshStandardMaterial({ color: 0x1a222a, roughness: 0.1, metalness: 0.7 })); d.position.set(hx, yc + 0.6, hz); d.lookAt(hx + (along ? 0 : side) * (along ? 0 : 1) - nz * side, yc + 0.6, hz + nx * side); K.group('Hublot', () => K.add(d)); }
  // intérieur : sol, plafond, parois (vues de dedans)
  const [a0x, a0z] = P(s0, -aw), [a1x, a1z] = P(s1 - 0.1, aw);
  const X0 = Math.min(a0x, a1x), X1 = Math.max(a0x, a1x), Z0 = Math.min(a0z, a1z), Z1 = Math.max(a0z, a1z);
  K.group('Sol du module', () => K.box('lu_floor', 0xffffff, X0, y - 0.2, Z0, X1, y, Z1, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] }));
  K.group('Plafond du module', () => K.box('lu_panel', 0xd6d6d0, X0, y + ah, Z0, X1, y + ah + 0.1, Z1, { skip: ['top', 'px', 'nx', 'pz', 'nz'] }));
  // parois intérieures (faces tournées vers l'intérieur)
  if (along) {
    K.group('Paroi intérieure nord', () => K.quad('lu_panel', 0xe2e2dc, [X1, y, Z0], [X0, y, Z0], [X0, y + ah, Z0], [X1, y + ah, Z0], [0, 0, 1], (p) => [p[0], p[1]]));
    K.group('Paroi intérieure sud', () => K.quad('lu_panel', 0xe2e2dc, [X0, y, Z1], [X1, y, Z1], [X1, y + ah, Z1], [X0, y + ah, Z1], [0, 0, -1], (p) => [p[0], p[1]]));
  } else {
    K.group('Paroi intérieure ouest', () => K.quad('lu_panel', 0xe2e2dc, [X0, y, Z0], [X0, y, Z1], [X0, y + ah, Z1], [X0, y + ah, Z0], [1, 0, 0], (p) => [p[2], p[1]]));
    K.group('Paroi intérieure est', () => K.quad('lu_panel', 0xe2e2dc, [X1, y, Z1], [X1, y, Z0], [X1, y + ah, Z0], [X1, y + ah, Z1], [-1, 0, 0], (p) => [p[2], p[1]]));
  }
  // fond du module (sans sas) : paroi
  if (!air) {
    const [fx, fz] = P(s1 - 0.1, 0);
    K.group('Paroi du fond', () => {
      if (along) K.quad('lu_panel', 0xd8d8d2, [fx, y, Z1], [fx, y, Z0], [fx, y + ah, Z0], [fx, y + ah, Z1], [-nx, 0, 0], (p) => [p[2], p[1]]);
      else K.quad('lu_panel', 0xd8d8d2, [X0, y, fz], [X1, y, fz], [X1, y + ah, fz], [X0, y + ah, fz], [0, 0, -nz], (p) => [p[0], p[1]]);
    });
  } else {
    // sas : couloir de 2,4 m, porte extérieure ouverte (cadre jaune, bandes de danger)
    const [c0x, c0z] = P(s1, -1.2), [c1x, c1z] = P(s1 + 4.5, 1.2);
    const W0 = Math.min(c0x, c1x), W1 = Math.max(c0x, c1x), V0 = Math.min(c0z, c1z), V1 = Math.max(c0z, c1z);
    K.group('Coque du sas', () => K.box('lu_panel_dark', 0xffffff, W0 - (along ? 0 : 0.6), y - 0.4, V0 - (along ? 0.6 : 0), W1 + (along ? 0 : 0.6), y + 3.4, V1 + (along ? 0.6 : 0), { skip: ['bottom'] }));
    K.group('Sol du sas', () => K.box('lu_floor', 0xffffff, W0, y - 0.2, V0, W1, y, V1, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] }));
    const [dx0, dz0] = P(s1 + 4.5, -1.5), [dx1, dz1] = P(s1 + 4.6, 1.5);
    K.group('Bandeau de danger du sas', () => K.box('lu_hazard', 0xffffff, Math.min(dx0, dx1), y + 2.6, Math.min(dz0, dz1), Math.max(dx0, dx1), y + 3.0, Math.max(dz0, dz1)));
    const [lx, lz] = P(s1 + 4.8, 1.6);
    owLamp(K, lx, y + 2.9, lz, 0xff9a3a, false, 0.6);
  }
  for (let s = s0 + 2; s < s1 - 1; s += 5) { const [lx, lz] = P(s, 0); owLamp(K, lx, y + ah - 0.2, lz, 0xf2f4ff, false, 0.7); }
  // rangement : casiers le long d'une paroi
  for (let s = s0 + 2.2; s < s1 - 2.5; s += 2.2) {
    const [ax, az] = P(s, -aw + 0.3), [bx2, bz2] = P(s + 1.8, -aw + 0.75);
    if (dir === 'e' || dir === 's') K.group('Casier', () => K.box('lu_panel_dark', 0xffffff, Math.min(ax, bx2), y, Math.min(az, bz2), Math.max(ax, bx2), y + 2.1, Math.max(az, bz2)));
  }
  B[dir] = { s0, s1, P, air };
}

/* ---------------------------------------------------------- C : le pont --
   Tablier de 6 m (caillebotis) au niveau N2, garde-corps (cases basses de 2,2 m) des deux côtés, poutres
   en treillis (membrures, montants tous les 6 m, diagonales), culées sur les gradins. */
function luBridge(K) {
  const Bd = LU.bridge, y = Bd.y, z0 = Bd.z - Bd.w / 2, z1 = Bd.z + Bd.w / 2;
  for (let cx = Bd.x0; cx < Bd.x1; cx++) {
    for (let cz = Math.floor(z0); cz < Math.ceil(z1); cz++) {
      const rail = cz === Math.floor(z0) || cz === Math.ceil(z1) - 1;
      owSet(OW.under, cx, cz, rail ? OWK.LOW : OWK.FLOOR, { base: y, top: y + (rail ? 2.2 : 0), mat: OWM.METAL });
    }
  }
  // tablier
  K.box('lu_grate', 0xffffff, Bd.x0, y - 0.12, z0 + 0.4, Bd.x1, y, z1 - 0.4, { skip: ['bottom'] });
  K.box('lu_metal', 0x7a7e82, Bd.x0, y - 0.45, z0 + 0.3, Bd.x1, y - 0.12, z0 + 0.6).box('lu_metal', 0x7a7e82, Bd.x0, y - 0.45, z1 - 0.6, Bd.x1, y - 0.12, z1 - 0.3);
  // poutres en treillis des deux côtés
  const H = 2.4, step = 6;
  for (const zz of [z0 + 0.45, z1 - 0.45]) {
    luBeam(K, 'lu_metal', 0x8a8e92, Bd.x0, y + H, zz, Bd.x1, y + H, zz, 0.22);
    luBeam(K, 'lu_metal', 0x8a8e92, Bd.x0, y + 1.1, zz, Bd.x1, y + 1.1, zz, 0.08);
    luBeam(K, 'lu_metal', 0x7a7e82, Bd.x0, y + 0.1, zz, Bd.x1, y + 0.1, zz, 0.26);
    for (let x = Bd.x0; x <= Bd.x1 + 0.01; x += step) {
      luBeam(K, 'lu_metal', 0x8a8e92, x, y, zz, x, y + H, zz, 0.16);
      if (x + step <= Bd.x1 + 0.01) { const up = Math.round((x - Bd.x0) / step) % 2 === 0; luBeam(K, 'lu_metal', 0x8a8e92, x, up ? y : y + H, zz, x + step, up ? y + H : y, zz, 0.12); }
    }
  }
  // traverses hautes, feux de balisage
  for (let x = Bd.x0; x <= Bd.x1 + 0.01; x += step * 2) luBeam(K, 'lu_metal', 0x7a7e82, x, y + H, z0 + 0.45, x, y + H, z1 - 0.45, 0.1);
  for (let x = Bd.x0 + 12; x < Bd.x1; x += 36) owLamp(K, x, y + H + 0.2, Bd.z, 0xffb24a, true, 0.7);
  // culées : blocs de béton sur les gradins
  for (const xa of [Bd.x0, Bd.x1 - 4]) K.box('lu_panel_dark', 0xb8b8b4, xa, y - 2.2, z0 - 0.5, xa + 4, y - 0.12, z1 + 0.5, { skip: ['top'] });
  // armoire de chantier à la culée ouest (la Thompson à la craie sur sa face sud)
  const ya = owHeightAtGrid(554, 968);
  K.box('lu_panel_dark', 0xffffff, 552.4, ya, 967.3, 555.6, ya + 2.7, 969).box('lu_hazard', 0xffffff, 552.4, ya + 2.7, 967.3, 555.6, ya + 2.85, 969);
  owFill(OW.surf, 552.4, 967.3, 555.6, 969, OWK.SOLID, { base: ya - 0.5, top: ya + 2.85, mat: OWM.METAL });
}

/* ---------------------------------------------------------- I : le convoyeur --
   Bande de 3 m sur treillis, du bord ouest (+7,2 m) au fond : un tablier en pente (cases de la
   couche 1, une marche de 0,6 m par case au plus) ; on y marche, la bande monte à 2,5 m/s. */
function luConveyor(K) {
  const C = LU.conv, P = LU.pit, a = luDeg(C.a), ux = Math.cos(a), uz = Math.sin(a), cv = {};
  const xa = P.x + ux * C.r1, za = P.z + uz * C.r1, xb = P.x + ux * C.r0, zb = P.z + uz * C.r0;
  for (let cz = Math.floor(Math.min(za, zb)) - 3; cz <= Math.ceil(Math.max(za, zb)) + 3; cz++) {
    for (let cx = Math.floor(Math.min(xa, xb)) - 3; cx <= Math.ceil(Math.max(xa, xb)) + 3; cx++) {
      luConvAt(cx + 0.5, cz + 0.5, cv);
      if (!cv.on) continue;
      if (Number.isFinite(luDeckY(cx + 0.5, cz + 0.5))) continue;              // le pont passe ailleurs
      if (owH(cx + 0.5, cz + 0.5) > cv.h + 0.3) continue;
      owSet(OW.under, cx, cz, OWK.FLOOR, { base: cv.h, mat: OWM.METAL, dir: 7 });
    }
  }
  // bande (rubans), bords, treillis porteur et pieds jusqu'au sol
  const L = C.r0 - C.r1, n = Math.ceil(L / 2);
  for (let i = 0; i < n; i++) {
    const r0 = C.r1 + (L * i) / n, r1 = C.r1 + (L * (i + 1)) / n;
    const y0 = C.y1 + ((C.y0 - C.y1) * (r0 - C.r1)) / L, y1 = C.y1 + ((C.y0 - C.y1) * (r1 - C.r1)) / L;
    const px = -uz * (C.w / 2), pz = ux * (C.w / 2);
    const ax = P.x + ux * r0, az = P.z + uz * r0, bx = P.x + ux * r1, bz = P.z + uz * r1;
    K.quad('lu_panel_dark', 0x3a3a3c, [ax - px, y0 + 0.02, az - pz], [ax + px, y0 + 0.02, az + pz], [bx + px, y1 + 0.02, bz + pz], [bx - px, y1 + 0.02, bz - pz], [0, 1, 0], (p) => [p[0], p[2]]);
    for (const s of [-1, 1]) luBeam(K, 'lu_yellow', 0xffffff, ax + px * s * 1.05, y0 + 0.25, az + pz * s * 1.05, bx + px * s * 1.05, y1 + 0.25, bz + pz * s * 1.05, 0.18);
    // pieds : là où la bande est au-dessus du sol
    if (i % 3 === 0) {
      const g = owH(ax, az);
      if (y0 - g > 1.2) for (const s of [-1, 1]) luBeam(K, 'lu_metal', 0x7a7e82, ax + px * s, g - 0.3, az + pz * s, ax + px * s, y0 - 0.1, az + pz * s, 0.14);
    }
  }
  // gares : en haut (sur le bord) et en bas (au fond)
  K.box('lu_yellow', 0xffffff, xb - 2.5, C.y0 - 0.2, zb - 2.5, xb + 2.5, C.y0 + 0.05, zb + 2.5, { skip: ['bottom'] });
  K.box('lu_panel_dark', 0xffffff, xb + ux * 3 - 1.5, C.y0, zb + uz * 3 - 1.5, xb + ux * 3 + 1.5, C.y0 + 3.2, zb + uz * 3 + 1.5);
  owLamp(K, xb, C.y0 + 3.6, zb, 0xffb24a, true, 0.8);
  owLamp(K, xa, C.y1 + 3.2, za, 0xffb24a, true, 0.8);
  LUPL.conv = { xa, za, xb, zb, ux, uz };
}

/* --------------------------------------------------------- D : la catapulte --
   Voie surélevée (caisson de 1,4 m, rails magnétiques bleus) sur portiques tous les 12 m, du ras du
   sol à la gare jusqu'à +46 m au bord nord (elle continue hors de la carte). Gare de chargement
   (bâtiment, berceau). Une capsule part toutes les 40 à 60 s : 60 m/s en bout de voie. */
function luCataY(t) { const C = LU.cata; return lerp(owHeightAtGrid(C.x0, C.z0) + 2.2, C.top, t); }
function luCatapult(K, root) {
  const C = LU.cata, dx = C.x1 - C.x0, dz = C.z1 - C.z0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ext = 1.3;
  const px = -uz, pz = ux;
  // gare : bâtiment de 10 × 14 m à côté du départ, quai et berceau
  const gx = C.x0 + px * 9, gz = C.z0 + pz * 9, gy = owHeightAtGrid(C.x0, C.z0);
  const g0x = Math.round(gx - 5), g0z = Math.round(gz - 7);
  owHouse(K, { x0: g0x, z0: g0z, x1: g0x + 10, z1: g0z + 14, y: gy + 0.2, h: 5, wall: 'lu_panel', wallHex: 0xffffff, roof: 'flat', roofTex: 'lu_panel_dark', floorTex: 'lu_floor', inTex: 'lu_panel', doors: [['w', 5, 3, 3], ['e', 3, 3, 3]], wins: [['n', 3, 4, 1.6, 3.4]] });
  LUPL.station = { x0: g0x, z0: g0z, x1: g0x + 10, z1: g0z + 14, y: gy + 0.2 };
  owLamp(K, g0x + 5, gy + 5.4, g0z + 7, 0xf2f4ff, false, 0.9);
  // voie : tronçons de caisson, rails, feux bleus ; portiques
  const n = Math.ceil(L / 12) + 16;                 // prolongée hors de la carte
  for (let i = 0; i < n; i++) {
    const t0 = i / Math.ceil(L / 12), t1 = (i + 1) / Math.ceil(L / 12);
    const ax = C.x0 + dx * t0, az = C.z0 + dz * t0, bx = C.x0 + dx * t1, bz = C.z0 + dz * t1, ay = luCataY(t0), by = luCataY(t1);
    luBeam(K, 'lu_panel_dark', 0xb0b0ac, ax, ay - 0.7, az, bx, by - 0.7, bz, 1.4);
    for (const s of [-0.45, 0.45]) luBeam(K, 'lu_metal', 0x5ab4ff, ax + px * s, ay + 0.05, az + pz * s, bx + px * s, by + 0.05, bz + pz * s, 0.12);
    // portique en A : deux jambes, une traverse
    const gyA = owH(ax, az);
    if (ay - gyA > 1.5 && (ax > -40 && az > -60)) {
      for (const s of [-1, 1]) luBeam(K, 'lu_metal', 0x9a9ea2, ax + px * s * 3.2, gyA - 0.4, az + pz * s * 3.2, ax + px * s * 0.7, ay - 1.4, az + pz * s * 0.7, 0.3);
      luBeam(K, 'lu_metal', 0x8a8e92, ax - px * 1.6, lerp(gyA, ay - 1.4, 0.55), az - pz * 1.6, ax + px * 1.6, lerp(gyA, ay - 1.4, 0.55), az + pz * 1.6, 0.18);
      for (const s of [-1, 1]) { const fx = Math.floor(ax + px * s * 3.2), fz = Math.floor(az + pz * s * 3.2); if (fx >= 0 && fz >= 0) owSet(OW.surf, fx, fz, OWK.SOLID, { base: gyA - 1, top: gyA + 3, mat: OWM.METAL }); }
    }
    if (i % 3 === 1) { const lg = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0x6ac8ff })); lg.position.set(ax, ay + 0.3, az); lg.scale.setScalar(0.18); K.add(lg); }
  }
  // capsules : une au berceau, une qui part
  // capsule : profil tourné (deux calottes et un fût), l'axe en y
  const prof = [];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(Math.sin(a) * 1.1, -2.5 - Math.cos(a) * 1.1)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(Math.cos(a) * 1.1, 2.5 + Math.sin(a) * 1.1 * 1.6)); }
  const capG = new THREE.LatheGeometry(prof, 16);
  const capM = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.35, metalness: 0.3 });
  const caps = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(capG, capM);
    m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(ux, uz); m.rotation.x = Math.PI / 2 - Math.atan2(C.top - luCataY(0), L);
    m.userData.ry = m.rotation.y;                    // jeu 2.0.3 : la voie peut tourner (catapulte retouchée)
    m.castShadow = true; m.name = 'capsule';
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x5ab4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(9, 9, 1);
    root.add(m, glow);
    caps.push({ m, glow, t: -1, wait: 6 + i * 18 });
  }
  LU.cataRun = { caps, L, ux, uz, next: rand(8, 14) };
  // la première attend au berceau (Mod Tools : elle suit la catapulte retouchée)
  owFollowFn(null, () => luCataPlace(caps[0], 0));
}
/* Capsule à t (0 : berceau, 1 : bout de la voie) : sur la voie, à la pose de la catapulte. */
function luCataPlace(c, t) {
  const C = LU.cata, x = lerp(C.x0, C.x1, t), z = lerp(C.z0, C.z1, t), y = luCataY(Math.max(0, t)) + 1.3, N = LUPL.nodes && LUPL.nodes.cata;
  const p = owPt(N, x, y, z);
  c.m.position.copy(p); c.glow.position.copy(p);
  if (c.m.userData.ry !== undefined) c.m.rotation.y = c.m.userData.ry + owYaw(N);
  c.m.visible = t > -0.5 && t < 1.3 && !owNodeHidden(N);
}

/* ------------------------------------------------------- E : la crête solaire --
   Cinq mâts de 46 m (tubes haubanés), panneaux verticaux de 6 × 16 m tournés vers le Soleil (est-sud-est),
   armoire au pied ; poste électrique à l'est du mât central (le courant de la mine). */
function luMasts(K) {
  OWPI.place = 'E';
  const sun = LU.sun.az, a = luDeg(sun), fx = Math.sin(a), fz = -Math.cos(a);   // vers le Soleil
  for (const [mx, mz] of LU.masts) K.item('mat', 'Mât solaire', mx, owHeightAtGrid(mx, mz), mz, (K) => {
    const y = owHeightAtGrid(mx, mz);
    K.cyl('lu_metal', 0xc8ccd0, mx, y + 23, mz, 0.32, 46, 10);
    K.box('lu_panel_dark', 0xb8b8b4, mx - 1.4, y - 0.6, mz - 1.4, mx + 1.4, y + 0.5, mz + 1.4);
    owFill(OW.surf, mx - 1, mz - 1, mx + 1, mz + 1, OWK.SOLID, { base: y - 1, top: y + 46, mat: OWM.METAL });
    // panneau vertical : face au Soleil, de 30 à 46 m
    const w = 6, h = 16, py = y + 38;
    const rx = -fz, rz = fx;      // axe horizontal du panneau
    const c0 = [mx + fx * 0.5 - rx * w / 2, py - h / 2, mz + fz * 0.5 - rz * w / 2], c1 = [mx + fx * 0.5 + rx * w / 2, py - h / 2, mz + fz * 0.5 + rz * w / 2];
    K.quad('lu_solar', 0xffffff, c0, c1, [c1[0], py + h / 2, c1[2]], [c0[0], py + h / 2, c0[2]], [fx, 0, fz], (p) => [(p[0] - c0[0]) * rx + (p[2] - c0[2]) * rz, p[1]]);
    K.quad('lu_metal', 0x8a8e92, [c1[0] - fx * 0.12, py - h / 2, c1[2] - fz * 0.12], [c0[0] - fx * 0.12, py - h / 2, c0[2] - fz * 0.12], [c0[0] - fx * 0.12, py + h / 2, c0[2] - fz * 0.12], [c1[0] - fx * 0.12, py + h / 2, c1[2] - fz * 0.12], [-fx, 0, -fz], (p) => [(p[0] - c0[0]) * rx + (p[2] - c0[2]) * rz, p[1]]);
    for (const t of [-0.5, 0, 0.5]) luBeam(K, 'lu_metal', 0x7a7e82, mx + rx * w * t, py - h / 2, mz + rz * w * t, mx + rx * w * t, py + h / 2, mz + rz * w * t, 0.1);
    // haubans
    for (const [hx, hz] of [[12, 0], [-6, 10], [-6, -10]]) luBeam(K, 'lu_metal', 0x6a6e72, mx, y + 28, mz, mx + hx, owH(mx + hx, mz + hz) + 0.2, mz + hz, 0.04);
    owLamp(K, mx, y + 46.6, mz, 0xff4a3a, false, 0.6);
  });
  // poste électrique (près du mât central) : armoires, câbles vers la mine
  const sx = 386, sz = 706, sy = owHeightAtGrid(392, 713);
  K.item('poste', 'Poste électrique', sx + 6, sy + 0.2, sz + 4, (K) => {
    owHouse(K, { x0: sx, z0: sz, x1: sx + 12, z1: sz + 8, y: sy + 0.2, h: 3.6, wall: 'lu_panel_dark', wallHex: 0xffffff, roof: 'flat', roofTex: 'lu_panel', floorTex: 'lu_floor', inTex: 'lu_panel', doors: [['e', 3, 2.4, 2.6]], wins: [['s', 4, 3, 1.4, 2.6]] });
    owLamp(K, sx + 6, sy + 3.5, sz + 4, 0xf2f4ff, true, 0.9);
    owLamp(K, sx + 12.4, sy + 3.2, sz + 4.5, 0xffb24a, false, 0.6);
  });
  LUPL.substation = { x0: sx, z0: sz, x1: sx + 12, z1: sz + 8, y: sy + 0.2 };
}

/* ---------------------------------------------------------- F : la tour relais --
   Treillis de 9 m à la base, 3 m au sommet ; plate-forme de 8 × 8 m à +118 m (le perchoir), antennes
   jusqu'à +123 m ; cabine au pied ; ascenseur (une cage dans la tour). */
function luTowerTopY() { return 118; }
function luTower(K) {
  const T = LU.tower, y0 = owHeightAtGrid(T.x, T.z), top = luTowerTopY(), H = top - y0;
  LUPL.tower = { x: T.x, z: T.z, y0, top };
  const w0 = 4.5, w1 = 1.5;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const at = (t) => lerp(w0, w1, t);
  for (const [sx, sz] of legs) luBeam(K, 'lu_metal', 0xd0d2d4, T.x + sx * w0, y0, T.z + sz * w0, T.x + sx * w1, top, T.z + sz * w1, 0.4);
  const nSeg = 14;
  for (let i = 0; i < nSeg; i++) {
    const t0 = i / nSeg, t1 = (i + 1) / nSeg, ya = y0 + H * t0, yb = y0 + H * t1, a = at(t0), b = at(t1);
    for (let f = 0; f < 4; f++) {
      const [sx0, sz0] = legs[f], [sx1, sz1] = legs[(f + 1) % 4];
      luBeam(K, 'lu_metal', 0xc0c2c4, T.x + sx0 * b, yb, T.z + sz0 * b, T.x + sx1 * b, yb, T.z + sz1 * b, 0.16);
      luBeam(K, 'lu_metal', 0xb0b2b4, T.x + sx0 * a, ya, T.z + sz0 * a, T.x + sx1 * b, yb, T.z + sz1 * b, 0.1);
      luBeam(K, 'lu_metal', 0xb0b2b4, T.x + sx1 * a, ya, T.z + sz1 * a, T.x + sx0 * b, yb, T.z + sz0 * b, 0.1);
    }
  }
  // feux rouges sur la hauteur
  for (const t of [0.33, 0.66]) owLamp(K, T.x + at(t), y0 + H * t, T.z + at(t), 0xff3a2a, false, 0.6);
  // plate-forme (le perchoir) : 8 × 8 m, garde-corps
  const p0x = T.x - 4, p0z = T.z - 4;
  K.group('Plate-forme (perchoir)', () => K.box('lu_grate', 0xffffff, p0x, top - 0.25, p0z, p0x + 8, top, p0z + 8));
  LUPL.nodes.platform = K.lastPrim;                  // le perchoir et la centrale inertielle la suivent
  for (const [ax, az, bx, bz] of [[p0x, p0z, p0x + 8, p0z], [p0x + 8, p0z, p0x + 8, p0z + 8], [p0x + 8, p0z + 8, p0x, p0z + 8], [p0x, p0z + 8, p0x, p0z]]) {
    K.group('Garde-corps', () => {
      luBeam(K, 'lu_yellow', 0xffffff, ax, top + 1.1, az, bx, top + 1.1, bz, 0.07);
      luBeam(K, 'lu_yellow', 0xffffff, ax, top + 0.55, az, bx, top + 0.55, bz, 0.05);
      for (let t = 0; t <= 1.001; t += 0.25) luBeam(K, 'lu_yellow', 0xffffff, lerp(ax, bx, t), top, lerp(az, bz, t), lerp(ax, bx, t), top + 1.1, lerp(az, bz, t), 0.06);
    });
  }
  // cases : le corps de la tour plein, la plate-forme (sol à +118), son bord (garde-corps)
  for (let cz = p0z - 1; cz < p0z + 9; cz++) for (let cx = p0x - 1; cx < p0x + 9; cx++) {
    const edge = cx < p0x || cz < p0z || cx >= p0x + 8 || cz >= p0z + 8;
    const inBase = Math.abs(cx + 0.5 - T.x) < w0 + 0.3 && Math.abs(cz + 0.5 - T.z) < w0 + 0.3;
    if (edge) { if (inBase) owSet(OW.surf, cx, cz, OWK.SOLID, { base: y0 - 1, top: top + 1.2, mat: OWM.METAL }); continue; }
    const rim = cx === p0x || cz === p0z || cx === p0x + 7 || cz === p0z + 7;
    owSet(OW.surf, cx, cz, rim ? OWK.SOLID : OWK.FLOOR, rim ? { base: y0 - 1, top: top + 1.2, mat: OWM.METAL } : { base: top, mat: OWM.METAL });
  }
  // antennes et parabole
  K.cyl('lu_metal', 0xd0d2d4, T.x + 2, top + 2.6, T.z - 2, 0.08, 5.2, 6).cyl('lu_metal', 0xd0d2d4, T.x - 2.5, top + 2.0, T.z + 2.5, 0.06, 4, 6);
  luDome(K, 'lu_panel', 0xffffff, T.x - 1.5, top + 2.4, T.z - 2.5, 1.6, 0.5, [0.2, 0.5, -0.8], 16);
  owLamp(K, T.x + 2, top + 5.3, T.z - 2, 0xff3a2a, false, 0.9);
  owLamp(K, T.x, top + 2.6, T.z + 3.6, 0xf2f4ff, true, 0.8);
  // cage de l'ascenseur (au centre de la tour) et sa porte au pied, côté sud
  K.group('Ascenseur (cage et rails)', () => {
    K.box('lu_yellow', 0xffffff, T.x - 1.1, y0, T.z + w0 - 0.2, T.x + 1.1, y0 + 2.8, T.z + w0 + 0.1, { skip: ['bottom'] });
    luBeam(K, 'lu_metal', 0x6a6e72, T.x - 1, y0, T.z, T.x - 1, top, T.z, 0.12);
    luBeam(K, 'lu_metal', 0x6a6e72, T.x + 1, y0, T.z, T.x + 1, top, T.z, 0.12);
  });
  LUPL.nodes.lift = K.lastPrim;                      // les trajets de l'ascenseur le suivent
  // échelle de service sur la face nord (les morts y grimpent quand le joueur est au perchoir)
  const la = { x: T.x, z0: T.z - 4.9, z1: T.z - 1.9, y0, y1: top - 1.2, top, fx: T.x, fz: T.z - 5.6, cz: T.z - 2.5 };
  K.group('Échelle de service', () => {
    for (const dx of [-0.28, 0.28]) luBeam(K, 'lu_yellow', 0xffffff, la.x + dx, la.y0, la.z0, la.x + dx, la.y1 + 1.2, la.z1, 0.07);
    for (let yy = la.y0 + 0.4; yy < la.y1 + 1; yy += 0.5) { const k = (yy - la.y0) / (la.y1 - la.y0), zz = lerp(la.z0, la.z1, k); luBeam(K, 'lu_yellow', 0xffffff, la.x - 0.28, yy, zz, la.x + 0.28, yy, zz, 0.04); }
  });
  LUPL.nodes.ladder = K.lastPrim;                    // les morts y grimpent où qu'elle soit
  LUPL.ladder = la;
  // cabine au pied (au sud)
  const cx0 = T.x - 5, cz0 = T.z + 7;
  owHouse(K, { x0: cx0, z0: cz0, x1: cx0 + 10, z1: cz0 + 7, y: y0 + 0.2, h: 3.4, wall: 'lu_panel', wallHex: 0xffffff, roof: 'flat', roofTex: 'lu_panel_dark', floorTex: 'lu_floor', inTex: 'lu_panel', doors: [['n', 4, 2.4, 2.6], ['s', 6, 2.4, 2.6]], wins: [['e', 2, 3, 1.3, 2.5]] });
  LUPL.towerHut = { x0: cx0, z0: cz0, x1: cx0 + 10, z1: cz0 + 7, y: y0 + 0.2 };
  owLamp(K, cx0 + 5, y0 + 3.3, cz0 + 3.5, 0xf2f4ff, false, 0.8);
}

/* ------------------------------------------------ G : le plateau d'extraction --
   Aire de 56 m de rayon à +9 m, cercle de balises (40 m), l'atterrisseur au centre (étage de descente
   doré sur quatre pieds, étage de remontée, tuyère), abri au sud (module court). */
function luPlateau(K) {
  OWPI.place = 'G';
  const P = LU.pad, y = P.h;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU, x = P.x + Math.cos(a) * 40, z = P.z + Math.sin(a) * 40, ly = owH(x, z) + 0.25;
    K.item('balise', 'Balise', x, ly, z, (K) => owLamp(K, x, ly, z, i % 2 ? 0xffffff : 0xffb24a, true, 0.45));
  }
  K.item('atterrisseur', 'Atterrisseur', P.x, owH(P.x, P.z), P.z, (K) => luLander(K, P.x, owH(P.x, P.z), P.z), { logic: 'Les pièces de la quête s’y posent et il décolle à la fin, où qu’il soit.' });
  LUPL.nodes.lander = K.lastItem;
  // abri : module court sur le bord sud
  const ax = P.x - 7, az = P.z + 36, ya = owH(P.x, az + 4) + 0.2;
  K.item('abri', 'Abri du plateau', ax + 7, ya, az + 4, (K) => {
    owHouse(K, { x0: ax, z0: az, x1: ax + 14, z1: az + 8, y: ya, h: 3.6, wall: 'lu_panel', wallHex: 0xffffff, roof: 'flat', roofTex: 'lu_foil', floorTex: 'lu_floor', inTex: 'lu_panel', doors: [['n', 5, 3, 2.8]], wins: [['w', 2, 3, 1.4, 2.6], ['e', 2, 3, 1.4, 2.6]] });
    owLamp(K, ax + 7, ya + 3.5, az + 4, 0xf2f4ff, false, 0.8);
  });
  LUPL.shelter = { x0: ax, z0: az, x1: ax + 14, z1: az + 8, y: ya };
}
function luLander(K, x, y, z) {
  LUPL.lander = { x, y, z };
  // étage de descente : octogone doré, 4 m de large, 2 m de haut, posé à 1,6 m sur ses pieds
  const yd = y + 1.6;
  K.geo('lu_foil', 0xffffff, new THREE.CylinderGeometry(2.6, 2.6, 2.2, 8), mtx(x, yd + 1.1, z, 0, Math.PI / 8, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4, fx = Math.cos(a), fz = Math.sin(a);
    luBeam(K, 'lu_metal', 0xc0c2c4, x + fx * 2.2, yd + 1.6, z + fz * 2.2, x + fx * 4.4, y + 0.3, z + fz * 4.4, 0.18);
    luBeam(K, 'lu_metal', 0xa0a2a4, x + fx * 2.4, yd + 0.2, z + fz * 2.4, x + fx * 4.3, y + 0.5, z + fz * 4.3, 0.1);
    K.cyl('lu_metal', 0xb0b2b4, x + fx * 4.5, y + 0.12, z + fz * 4.5, 0.55, 0.24, 12);
  }
  owFill(OW.surf, x - 2.6, z - 2.6, x + 2.6, z + 2.6, OWK.SOLID, { base: y - 0.5, top: yd + 2.2, mat: OWM.METAL });
  // tuyère sous l'étage
  K.geo('lu_metal', 0x5a5a5c, new THREE.CylinderGeometry(0.5, 0.9, 1.2, 16, 1, true), mtx(x, yd - 0.4, z));
  // étage de remontée : cabine blanche à facettes, hublot triangulaire, antenne
  K.geo('lu_panel', 0xf0f0ea, new THREE.CylinderGeometry(1.9, 2.2, 2.4, 6), mtx(x, yd + 3.4, z, 0, 0.2, 0));
  K.geo('lu_panel_dark', 0xffffff, new THREE.CylinderGeometry(1.2, 1.9, 0.8, 6), mtx(x, yd + 5.0, z, 0, 0.2, 0));
  K.geo('lu_glass', 0xffffff, new THREE.CircleGeometry(0.5, 3), mtx(x + 1.96, yd + 3.7, z - 0.4, 0, Math.PI / 2, 0));
  K.cyl('lu_metal', 0xd0d2d4, x - 0.8, yd + 6.2, z + 0.6, 0.04, 2, 5);
  luDome(K, 'lu_panel', 0xffffff, x - 0.8, yd + 7.1, z + 0.6, 0.45, 0.18, [0.4, 0.8, 0.2], 12);
  // échelle d'un pied (vers le sud) jusqu'au porche
  luBeam(K, 'lu_metal', 0xd0d2d4, x - 0.3, y + 0.3, z + 4.3, x - 0.3, yd + 2, z + 2.3, 0.06);
  luBeam(K, 'lu_metal', 0xd0d2d4, x + 0.3, y + 0.3, z + 4.3, x + 0.3, yd + 2, z + 2.3, 0.06);
}

/* --------------------------------------------------- H : le dépôt d'oxygène --
   Quatre sphères de 7,6 m sur berceaux, tuyauterie, local des pompes. Intactes au départ ; elles
   sautent à la manche 1 (voir l'explosion) : la géométrie est à part pour pouvoir la retirer. */
function luDepot(K, root) {
  const D = LU.depot, y = owHeightAtGrid(D.x, D.z);
  const spheres = [[-8, -4], [3, -9], [9, 3], [-2, 7]].map(([dx, dz]) => ({ x: D.x + dx, z: D.z + dz, r: 3.8, y: y + 4.6 }));
  LUPL.depot = { x: D.x, z: D.z, y, spheres };
  const mat = luSunify(new THREE.MeshStandardMaterial({ color: 0xeaeae4, roughness: 0.4, metalness: 0.35 }));
  const band = luSunify(new THREE.MeshStandardMaterial({ color: 0x2a5a9a, roughness: 0.5, metalness: 0.3 }));
  for (const s of spheres) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(s.r, 24, 16), mat);
    m.position.set(s.x, s.y, s.z); m.castShadow = true; m.receiveShadow = true;
    const b = new THREE.Mesh(new THREE.TorusGeometry(s.r * 1.005, 0.12, 6, 32), band);
    b.position.copy(m.position); b.rotation.x = Math.PI / 2;
    // jeu 2.0.3 : chaque sphère est une surface du dépôt (l'explosion part d'elle, où qu'elle soit)
    K.group('Sphère d’oxygène', () => { K.add(m); K.add(b); });
    s.prim = K.lastPrim;
    s.mesh = m; s.band = b;
    // berceau (jambes) : reste après l'explosion
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; luBeam(K, 'lu_metal', 0x8a8e92, s.x + Math.cos(a) * 3.2, y, s.z + Math.sin(a) * 3.2, s.x + Math.cos(a) * 2.4, s.y - 1.2, s.z + Math.sin(a) * 2.4, 0.25); }
    owFill(OW.surf, s.x - 2.5, s.z - 2.5, s.x + 2.5, s.z + 2.5, OWK.SOLID, { base: y - 0.5, top: s.y + s.r, mat: OWM.METAL });
  }
  // tuyauterie entre les sphères et vers la fosse
  for (let i = 0; i < spheres.length; i++) { const a = spheres[i], b = spheres[(i + 1) % spheres.length]; luBeam(K, 'lu_metal', 0xb0b2b4, a.x, y + 0.9, a.z, b.x, y + 0.9, b.z, 0.3); }
  K.box('lu_panel_dark', 0xffffff, D.x + 10, y, D.z + 8, D.x + 16, y + 3, D.z + 13);
  owFill(OW.surf, D.x + 10, D.z + 8, D.x + 16, D.z + 13, OWK.SOLID, { base: y - 0.5, top: y + 3, mat: OWM.METAL });
  owLamp(K, D.x + 13, y + 3.4, D.z + 7.6, 0xffb24a, true, 0.7);
  LUPL.depot.group = true;
}
/* Dépôt et sphères à leur pose (jeu 2.0.3) : { x, y, z, spheres: [{ x, y, z, r, mesh, band }] }. */
function luDepotW() {
  const D = LUPL.depot;
  if (!D) return null;
  const c = owPt(LUPL.nodes && LUPL.nodes.depot, D.x, D.y, D.z);
  return { x: c.x, y: c.y, z: c.z, spheres: D.spheres.filter((s) => !owNodeHidden(s.prim)).map((s) => { const p = owPt(s.prim, s.x, s.y, s.z), g = owPt(s.prim, s.x, D.y, s.z); return { x: p.x, y: p.y, z: p.z, gy: g.y, r: s.r, mesh: s.mesh, band: s.band }; }) };
}

/* ------------------------------------------------------------ J : la foreuse --
   Derrick jaune de 30 m sur une plate-forme d'acier, tige de forage, treuil, cabine de commande, feux. */
function luDrill(K) {
  OWPI.place = 'J';
  const D = LU.drill, y = LU.pit.fond, w0 = 4.5, w1 = 1.2, H = 30;
  K.item('foreuse', 'Foreuse à glace', D.x, y, D.z, (K) => {
    K.box('lu_grate', 0xffffff, D.x - 7, y, D.z - 7, D.x + 7, y + 0.3, D.z + 7, { skip: ['bottom'] });
    owFill(OW.surf, D.x - 7, D.z - 7, D.x + 7, D.z + 7, OWK.FLOOR, { base: y + 0.3, mat: OWM.METAL });
    const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of legs) luBeam(K, 'lu_yellow', 0xffffff, D.x + sx * w0, y + 0.3, D.z + sz * w0, D.x + sx * w1, y + H, D.z + sz * w1, 0.3);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, yy = y + 0.3 + (H - 0.3) * t, w = lerp(w0, w1, t);
      for (let f = 0; f < 4; f++) { const [a, b] = [legs[f], legs[(f + 1) % 4]]; luBeam(K, 'lu_yellow', 0xffffff, D.x + a[0] * w, yy, D.z + a[1] * w, D.x + b[0] * w, yy, D.z + b[1] * w, 0.14); }
    }
    for (const [sx, sz] of legs) owFill(OW.surf, D.x + sx * w0 - 0.6, D.z + sz * w0 - 0.6, D.x + sx * w0 + 0.6, D.z + sz * w0 + 0.6, OWK.SOLID, { base: y, top: y + 8, mat: OWM.METAL });
    K.cyl('lu_metal', 0x6a6e72, D.x, y + H / 2, D.z, 0.18, H, 8);
    K.box('lu_panel_dark', 0xffffff, D.x - 1.2, y + 0.3, D.z - 1.2, D.x + 1.2, y + 2.4, D.z + 1.2);
    owFill(OW.surf, D.x - 1.2, D.z - 1.2, D.x + 1.2, D.z + 1.2, OWK.SOLID, { base: y, top: y + 2.4, mat: OWM.METAL });
    owLamp(K, D.x, y + H + 0.4, D.z, 0xff3a2a, false, 0.8);
    for (const [sx, sz] of legs) owLamp(K, D.x + sx * 2.6, y + 14, D.z + sz * 2.6, 0xffe2a0, true, 1.0);
  });
  // cabine de commande (à l'est de la plate-forme) : fixe (la valve de la quête est sur son établi)
  const c0x = D.x + 9, c0z = D.z - 4;
  K.item('cabine', 'Cabine de la foreuse', c0x + 4, y + 0.2, c0z + 4, (K) => {
    owHouse(K, { x0: c0x, z0: c0z, x1: c0x + 8, z1: c0z + 8, y: y + 0.2, h: 3.4, wall: 'lu_yellow', wallHex: 0xffffff, roof: 'flat', roofTex: 'lu_panel_dark', floorTex: 'lu_floor', inTex: 'lu_panel', doors: [['w', 3, 2.4, 2.6]], wins: [['n', 2, 3, 1.4, 2.6]] });
    owLamp(K, c0x + 4, y + 3.3, c0z + 4, 0xf2f4ff, false, 0.8);
  }, { logic: 'La valve de tuyère (pièce ② de la quête) et son établi suivent la cabine.' });
  LUPL.nodes.cabin = K.lastItem;
  LUPL.drillHut = { x0: c0x, z0: c0z, x1: c0x + 8, z1: c0z + 8, y: y + 0.2 };
}

/* ------------------------------------------- Lampadaires des gradins (courant) */
function luPitLamps(K) {
  OWPI.place = 'B';
  const P = LU.pit;
  for (let i = 0; i < 5; i++) {
    const B = luBench(i), r = B.r1 - 2.2, n = Math.max(6, Math.round((TAU * r) / 46));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + i * 0.37, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (!owTerrainWalk(x, z) || Math.abs(owH(x, z) - B.y) > 0.4) continue;
      K.item('lampadaire', 'Lampadaire des gradins', x, owH(x, z), z, (K) => owLampPost(K, x, owH(x, z), z, 4.2, 0xffe6c0, true, [-Math.cos(a) * 0.9, -Math.sin(a) * 0.9]));
    }
  }
}

/* ------------------------------------------------------- Propulseurs (plots) */
function luPads(K, root) {
  const ring = luSunify(new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 }));
  const glowM = new THREE.MeshBasicMaterial({ color: 0x46b8ff, transparent: true, opacity: 0.85 });
  LU.padMeshes = [];
  for (const p of luPadList()) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.22, 24), ring);
    base.position.y = 0.11;
    const disk = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), glowM.clone());
    disk.rotation.x = -Math.PI / 2; disk.position.y = 0.23;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 3), new THREE.MeshBasicMaterial({ color: 0xbfe6ff }));
    arrow.position.set(Math.cos(p.a) * 0.4, 0.3, Math.sin(p.a) * 0.4); arrow.rotation.set(Math.PI / 2, 0, -p.a + Math.PI / 2);
    g.add(base, disk, arrow);
    g.position.set(p.x, owH(p.x, p.z), p.z);
    linearizeTree(g);
    root.add(g);
    LU.padMeshes.push({ g, disk, pad: p });
  }
}
/* Départ d'un propulseur : éclair bleu, poussière soufflée vers le haut (sans air : elle retombe d'un bloc). */
function luPadFx(pad) {
  const P = owSandPool();
  for (let i = 0; i < 24; i++) { const a = rand(0, TAU), v = rand(0.6, 2.4); P.emit(pad.x + Math.cos(a) * 0.8, pad.y + 0.1, pad.z + Math.sin(a) * 0.8, Math.cos(a) * v, rand(2, 6), Math.sin(a) * v, rand(1.5, 3)); }
  const m = LU.padMeshes && LU.padMeshes.find((q) => q.pad === pad);
  if (m) m.flash = 1;
}
