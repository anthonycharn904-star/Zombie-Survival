/* ----------------------------------------------------------------- Lieux --
   Les sept lieux du plan (page 2) et leurs fiches (page 4) :
   A camp de fouilles (départ : tente-réfectoire et ses armes, tentes, conteneur ABRI, tranchée du
     sceau), B plateau (mastabas, kiosque du sanctuaire), C relais Km 47 (station, café, garage du
     buggy, cuve de carburant d'aviation), D oasis de Sekhet (village de brique crue, citerne),
     E centrale du Nil (salle des turbines, poste de commande, transformateurs, prise d'eau, abri du
     camion), F nécropole (tombeaux taillés dans la falaise), G aérodrome (hangars, tour de contrôle,
     KH-47, camion-citerne, balisage). Bâtiments et cases des solides sont posés une fois par
     génération ; les maillages à chaque chargement.
   Jeu 2.0.3 : chaque pièce du décor est une pièce de la base (K.item : genre, nom, pied), que les
   Mod Tools sélectionnent et qu'une carte peut retoucher ; ce qui est posé dans une pièce (tables
   d'une tente, lanternes d'une maison) la suit ; chaque surface (mur, toit, poteau…) se retouche
   aussi seule. Plus de pièce fixe : ce que la quête et le sanctuaire posent dans le kiosque, la cuve
   d'aviation, le poste de commande et les tombeaux suit leur pose (nœuds dans KH.places). */
/* Maillage posé (position, rotation). */
function owMeshAt(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  return m;
}
KH.places = {};       // positions utiles aux éléments de jeu (armes, atouts, boîte, carburant…)

/* Retouches du terrain (avant le calcul des pentes) : fosse de la tranchée, sol des bâtiments. */
function khShapeTerrain() {
  const yA = owHeightAtGrid(2320, 1965);
  // tranchée de fouille : un creux de 1,4 m (bords en pente douce : le maillage est de 4 m)
  owLevel(2228, 1900, 2244, 1908, yA - 1.4, 3);
  // aérodrome : l'aire de stationnement jusqu'à la piste
  const yG = owHeightAtGrid(2990, 445);
  owLevel(2930, 280, 3060, 330, yG, 14);
}

function owBuildPlaces(root) {
  OWL.lamps = [];
  OW.placesRoot = root;
  owItemsBegin();
  const K = owKit('lieux');
  khPlaceA(K); khPlaceB(K); khPlaceC(K); khPlaceD(K); khPlaceE(K); khPlaceF(K); khPlaceG(K);
  owItemsBuild(K, root);
  K.build(root);
  owLightsInit(root);
}

/* ---------------------------------------------------------------- A : camp */
function khPlaceA(K) {
  OWPI.place = 'A';
  const y = owH(2320, 1965), P = (KH.places.A = { y });
  // tente-réfectoire (ouverte au sud) : tables et bancs, panneaux des armes au fond, lampe
  K.item('tente', 'Tente-réfectoire', 2305, y, 1962.5, (K) => {
    owTent(K, 2296, 1958, 2314, 1967, y, 4.4, 1.9, 's', 0xdcccaa);
    for (const x of [2300, 2305, 2310]) {
      K.item('table', 'Table et bancs', x, y, 1963.5, (K) => {
        owTable(K, x, y + 0.05, 1963.5, 2.2, 0.9);
        K.box('kh_planks', 0x7a5a3a, x - 1.1, y + 0.05, 1962.4, x + 1.1, y + 0.47, 1962.7).box('kh_planks', 0x7a5a3a, x - 1.1, y + 0.05, 1964.3, x + 1.1, y + 0.47, 1964.6);
      });
      // panneau de planches contre la toile du fond (armes dessinées à la craie)
      K.box('kh_planks', 0x9a7650, x - 0.95, y + 0.9, 1959.06, x + 0.95, y + 2.25, 1959.16);
    }
    K.item('lampe', 'Lampe', 2305, y + 3.7, 1962.5, (K) => owLamp(K, 2305, y + 3.7, 1962.5, 0xffe2b0, false, 0.8));
  });
  // tentes de couchage, ouvertes à l'est
  for (const z0 of [1980, 1990, 2000]) K.item('tente', 'Tente de couchage', 2265, y, z0 + 2.5, (K) => owTent(K, 2262, z0, 2268, z0 + 5, y, 2.9, 1.2, 'e', 0xcfbf98));
  // conteneur « ABRI » (refuge), ouvert à l'ouest
  K.item('conteneur', 'Conteneur « ABRI »', 2374, y, 1947.5, (K) => owContainer(K, 2368, 1946, 2380, 1949, y, 0x35607d, 'ABRI', 0));
  P.refuge = [{ x0: 2368, z0: 1946, x1: 2380, z1: 1949, name: 'conteneur ABRI' }];
  // tranchée de fouille : cadre de planches, passerelle, sceau du sanctuaire (turquoise) ; fixe
  const yt = y - 1.4;
  K.item('tranchee', 'Tranchée de fouille et sceau', 2236, yt, 1904, (K) => {
    K.box('kh_planks', 0x8a6a48, 2226, y - 0.2, 1898.6, 2246, y + 0.25, 1899.2).box('kh_planks', 0x8a6a48, 2226, y - 0.2, 1908.8, 2246, y + 0.25, 1909.4);
    K.box('kh_planks', 0x8a6a48, 2225.4, y - 0.2, 1898.6, 2226, y + 0.25, 1909.4).box('kh_planks', 0x8a6a48, 2246, y - 0.2, 1898.6, 2246.6, y + 0.25, 1909.4);
    K.box('kh_planks', 0xa08060, 2235, y + 0.05, 1898, 2236.4, y + 0.15, 1910);
    for (const x of [2229, 2241]) for (const z of [1899.6, 1908.4]) K.box('kh_planks', 0x6b4a30, x - 0.1, yt, z - 0.1, x + 0.1, y + 1.0, z + 0.1);
    const seal = khSeal(1.6);
    seal.position.set(2236, yt + 0.06, 1904); K.add(seal);
  });
  P.seal = { x: 2236, y: yt, z: 1904 };
  // auvent de la boîte mystère, groupe électrogène, caisses, fûts, sacs de sable
  K.item('auvent', 'Auvent de la boîte mystère', 2329, y, 1940, (K) => {
    for (const [x, z] of [[2325.2, 1937.2], [2332.8, 1937.2], [2325.2, 1942.8], [2332.8, 1942.8]]) K.box('kh_planks', 0x6b4a30, x - 0.06, y, z - 0.06, x + 0.06, y + 2.7, z + 0.06);
    K.box('kh_canvas', 0xb04a32, 2324.8, y + 2.7, 1936.8, 2333.2, y + 2.82, 1943.2);
  });
  K.item('groupe', 'Groupe électrogène', 2287.3, y, 1939.7, (K) => {
    K.box('kh_sheet', 0x5a6a48, 2286, y, 1939, 2288.6, y + 1.3, 1940.4).cyl('kh_sheet', 0x3a3631, 2287.3, y + 1.5, 1939.7, 0.08, 0.5);
    K.solid(2286, 1939, 2289, 1941, OWK.LOW, { base: y, top: y + 1.3, mat: OWM.METAL });
  });
  K.item('caisse', 'Caisse', 2290.5, y, 1944, (K) => {
    owCrate(K, 2290.5, y, 1944, 1);
    K.item('caisse', 'Caisse (sur la pile)', 2290.9, y + 1, 1944.1, (K) => owCrate(K, 2290.9, y + 1, 1944.1, 0.7));
  });
  K.item('caisse', 'Caisse', 2291.6, y, 1944.2, (K) => owCrate(K, 2291.6, y, 1944.2, 0.8));
  for (const [x, z] of [[2343, 1966], [2344.2, 1966.4]]) K.item('caisse', 'Caisse', x, y, z, (K) => owCrate(K, x, y, z, 1));
  K.item('fut', 'Fût', 2289, y, 1946.5, (K) => owBarrel(K, 2289, y, 1946.5));
  K.item('fut', 'Fût', 2289.8, y, 1947.3, (K) => owBarrel(K, 2289.8, y, 1947.3, 0x3c6a8a));
  K.item('fut', 'Fût', 2384, y, 1952, (K) => owBarrel(K, 2384, y, 1952));
  K.item('sacs', 'Sacs de sable', 2221, y, 1904, (K) => owSandbags(K, 2221, 1896, 2221, 1912, y, 2));
  // lampes du camp
  for (const [x, z, arm] of [[2318, 1971, [0, -0.7]], [2282, 1975, [0.7, 0]], [2346, 1956, [0, 0.7]], [2238, 1913, [0, -0.7]]]) {
    K.item('lampadaire', 'Lampadaire', x, y, z, (K) => owLampPost(K, x, y, z, 4.5, 0xffd09a, false, arm));
  }
}
/* Sceau du sanctuaire : disque de pierre gravé, glyphes turquoise (le turquoise dit le surnaturel). */
function khSeal(r) {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#8a7a64'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
  g.strokeStyle = '#5ff2e2'; g.lineWidth = 6; g.shadowColor = '#5ff2e2'; g.shadowBlur = 12;
  g.beginPath(); g.arc(128, 128, 104, 0, TAU); g.stroke();
  g.beginPath(); g.arc(128, 128, 62, 0, TAU); g.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(128 + Math.cos(a) * 66, 128 + Math.sin(a) * 66); g.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); g.stroke(); }
  // tête de chacal stylisée au centre
  g.beginPath(); g.moveTo(108, 160); g.lineTo(118, 96); g.lineTo(126, 70); g.lineTo(134, 96); g.lineTo(150, 104); g.lineTo(160, 120); g.lineTo(138, 124); g.lineTo(140, 160); g.closePath(); g.stroke();
  const m = new THREE.MeshBasicMaterial({ map: toTex(c, { clamp: true }), transparent: true });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), m);
  mesh.name = 'sceau';
  return mesh;
}

/* ------------------------------------------------------------ B : plateau */
function khPlaceB(K) {
  OWPI.place = 'B';
  const P = (KH.places.B = {});
  // mastabas (tombes de pierre basses, murs en talus) à l'est de la Grande Pyramide et à l'ouest
  const mastaba = (x0, z0, x1, z1) => {
    const y = owH((x0 + x1) / 2, (z0 + z1) / 2) - 0.3, h = 3.4, inset = 0.5;
    K.item('mastaba', 'Mastaba', (x0 + x1) / 2, y, (z0 + z1) / 2, (K) => {
      K.geo('kh_sandstone', 0xe8dcc6, khFrustum(x1 - x0, z1 - z0, h, inset), mtx((x0 + x1) / 2, y, (z0 + z1) / 2));
      K.solid(x0, z0, x1, z1, OWK.SOLID, { base: y, top: y + h, mat: OWM.STONE });
    });
  };
  for (const [x, z] of [[2238, 1160], [2252, 1176], [2238, 1192], [2252, 1208], [2266, 1160], [2266, 1192]]) mastaba(x, z, x + 10, z + 5);
  for (const [x, z] of [[1985, 1085], [2000, 1085], [1985, 1100], [2000, 1100], [2015, 1093]]) mastaba(x, z, x + 9, z + 5);
  // kiosque du sanctuaire (porte scellée jusqu'au courant), entre les deux grandes pyramides
  const yk = owH(2190, 1396) + 0.05;
  K.item('kiosque', 'Kiosque du sanctuaire', 2190, yk, 1396, (K) => owHouse(K, { x0: 2184, z0: 1390, x1: 2196, z1: 1402, y: yk, h: 4.6, wall: 'kh_sandstone', roof: 'flat', roofTex: 'kh_sandstone', parapet: 0.6, noFloor: true, doors: [['s', 5, 2, 3.2]] }),   // sol percé de l'escalier (sanctuaire)
    { logic: 'L’escalier du sanctuaire et sa porte scellée suivent le kiosque (le sanctuaire reste 40 m sous le plateau).' });
  P.kiosk = { x: 2190, y: yk, z: 1402, door: [2189, 1401, 2191, 1402], node: K.lastItem };
  // petit camp de l'équipe (tentes et groupe électrogène)
  const yc = owH(2246, 1560);
  K.item('tente', 'Tente', 2244, yc, 1554.5, (K) => owTent(K, 2240, 1552, 2248, 1557, yc, 3, 1.3, 's', 0xd2c29c));
  K.item('tente', 'Tente', 2255, yc, 1558.5, (K) => owTent(K, 2252, 1556, 2258, 1561, yc, 2.8, 1.2, 'w', 0xd2c29c));
  K.item('caisse', 'Caisse', 2249.5, yc, 1563, (K) => owCrate(K, 2249.5, yc, 1563, 1));
  K.item('fut', 'Fût', 2251, yc, 1564.5, (K) => owBarrel(K, 2251, yc, 1564.5));
  K.item('lampadaire', 'Lampadaire', 2246, yc, 1566, (K) => owLampPost(K, 2246, yc, 1566, 4.2, 0xffd09a, false, [0, -0.7]));
  // jeu 2.0.3 : intérieur des trois pyramides (portails, herses payantes, salles ; voir « Intérieur des pyramides »)
  khPyramidInteriors(K);
}
/* Tronc de pyramide (mastaba) : base w × d, sommet rentré de inset, hauteur h. */
function khFrustum(w, d, h, inset) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h / 2) { p.setX(i, p.getX(i) * (1 - (2 * inset) / w)); p.setZ(i, p.getZ(i) * (1 - (2 * inset) / d)); }
  g.computeVertexNormals();
  // coordonnées de texture en mètres
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 1.5, uv.getY(i) * h / 1.5);
  return g;
}

/* ------------------------------------------------------ C : relais Km 47 */
function khPlaceC(K) {
  OWPI.place = 'C';
  const y = owH(1395, 2585), P = (KH.places.C = { y });
  // auvent de la station et ses deux pompes
  K.item('station', 'Auvent de la station', 1384, y, 2572, (K) => {
    for (const [x, z] of [[1377, 2569], [1391, 2569], [1377, 2575], [1391, 2575]]) { K.box('kh_concrete', 0xdad2c2, x - 0.2, y, z - 0.2, x + 0.2, y + 4.6, z + 0.2); K.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, OWK.SOLID, { base: y, top: y + 4.6, mat: OWM.METAL }); }
    K.box('kh_sheet_red', 0xc84a32, 1375.5, y + 4.6, 2567.5, 1392.5, y + 5.3, 2576.5);
    K.box('kh_concrete', 0xc8c0b0, 1378.5, y, 2571.4, 1389.5, y + 0.18, 2572.6);
    for (const x of [1381, 1387]) {
      K.item('pompe', 'Pompe à essence', x, y, 2572, (K) => {
        K.box('kh_sheet', 0xd8d0be, x - 0.45, y + 0.18, 2571.65, x + 0.45, y + 1.8, 2572.35).box('kh_sheet', 0xb03a28, x - 0.47, y + 1.4, 2571.62, x + 0.47, y + 1.75, 2572.38);
        K.solid(x - 0.45, 2571.65, x + 0.45, 2572.35, OWK.LOW, { base: y, top: y + 1.8, mat: OWM.METAL });
      });
    }
    owLamp(K, 1381, y + 4.5, 2572, 0xc8f0ff, false, 0.9); owLamp(K, 1387, y + 4.5, 2572, 0xc8f0ff, false, 0.9);
  });
  // café (armes au mur du fond), porte au nord
  K.item('cafe', 'Café', 1402, y, 2584.5, (K) => {
    owHouse(K, { x0: 1396, z0: 2580, x1: 1408, z1: 2589, y, h: 3.4, wall: 'kh_ochre', roof: 'flat', roofTex: 'kh_concrete', parapet: 0.4, floorTex: 'kh_floor', doors: [['n', 3, 2]], wins: [['n', 7, 3, 1.0, 2.2], ['w', 3, 3, 1.0, 2.2], ['e', 3, 3, 1.0, 2.2]] });
    K.box('kh_sheet_red', 0x2c6a74, 1397, y + 3.0, 2579.3, 1407, y + 3.35, 2579.6);       // enseigne bleue
    for (const x of [1400, 1404.5]) K.item('table', 'Table', x, y, 2584.5, (K) => owTable(K, x, y, 2584.5, 1.2, 1.2));
    K.item('comptoir', 'Comptoir', 1397.6, y, 2584.3, (K) => {
      K.box('kh_planks', 0x7a5a3a, 1397, y, 2582.2, 1398.2, y + 1.05, 2586.4);                // comptoir, contre le mur ouest
      K.solid(1397, 2582.2, 1398, 2586.4, OWK.LOW, { base: y, top: y + 1.05, mat: OWM.WOOD });
    });
    owLamp(K, 1402, y + 3.1, 2584.5, 0xffe0b0, false, 0.8);
  });
  // garage du buggy : grande porte à l'ouest
  K.item('garage', 'Garage du buggy', 1418, y, 2589, (K) => {
    owHouse(K, { x0: 1412, z0: 2584, x1: 1424, z1: 2594, y, h: 4.2, wall: 'kh_concrete', roof: 'gable', rise: 1.4, roofTex: 'kh_sheet', floorTex: 'kh_floor', doors: [['w', 2, 6, 3.6]], wins: [['n', 4, 4, 2.4, 3.4]] });
    K.item('caisse', 'Caisse', 1421.5, y, 2586.5, (K) => owCrate(K, 1421.5, y, 2586.5, 1));
    K.item('fut', 'Fût', 1422, y, 2591.5, (K) => owBarrel(K, 1422, y, 2591.5, 0x3c6a8a));
    K.item('fut', 'Fût', 1421.2, y, 2592.2, (K) => owBarrel(K, 1421.2, y, 2592.2));
    owLamp(K, 1418, y + 4.0, 2589, 0xfff0d0, false, 0.8);
  });
  // cuve de carburant d'aviation (pièce ①) derrière le garage : fixe
  K.item('cuve', 'Cuve de carburant d’aviation', 1419, y, 2601, (K) => owTank(K, 1419, y, 2601, 1.5, 7, true, 0xe2dccc),
    { logic: 'Pièce ① de l’avion : la vanne et le fût de la quête suivent la cuve.' });
  P.fuelTank = { x: 1419, y: y + 1.9, z: 2599.2, node: K.lastItem };
  // jerricans (faire le plein), borne kilométrique
  const ym = owH(1446, 2541);
  K.item('borne', 'Borne kilométrique', 1446, ym, 2541, (K) => khMilestone(K, 1446, ym, 2541, '47'));
  // néons de l'heure bleue
  K.item('lampadaire', 'Lampadaire', 1384, y, 2563, (K) => owLampPost(K, 1384, y, 2563, 5, 0x9fe4ff, false, [0, 0.8]));
  K.item('lampadaire', 'Lampadaire', 1410, y, 2577, (K) => owLampPost(K, 1410, y, 2577, 5, 0xffd2a0, false, [0, 0.8]));
  K.item('lampadaire', 'Lampadaire', 1428, y, 2582, (K) => owLampPost(K, 1428, y, 2582, 5, 0xffd2a0, false, [-0.8, 0]));
  P.refuge = [{ x0: 1397, z0: 2581, x1: 1407, z1: 2588, name: 'café' }, { x0: 1413, z0: 2585, x1: 1423, z1: 2593, name: 'garage' }];
}
/* Pile de jerricans (on y fait le plein du véhicule le plus proche) ; k : taille (jeu 2.0.3). */
function khJerricans(K, x, y, z, k = 1) {
  const cols = [0x9c2f22, 0x4f6b3a, 0x9c2f22, 0x4f6b3a, 0x9c2f22];
  for (let i = 0; i < 5; i++) { const ox = ((i % 3) * 0.38 - 0.38) * k, oz = Math.floor(i / 3) * 0.3 * k; K.box('kh_sheet_red', cols[i], x + ox - 0.17 * k, y, z + oz - 0.12 * k, x + ox + 0.17 * k, y + 0.47 * k, z + oz + 0.12 * k); }
  K.box('kh_sheet_red', 0x9c2f22, x - 0.2 * k, y + 0.47 * k, z - 0.12 * k, x + 0.14 * k, y + 0.94 * k, z + 0.12 * k);
  K.solid(x - 0.6 * k, z - 0.2 * k, x + 0.6 * k, z + 0.5 * k, OWK.LOW, { base: y, top: y + 0.95 * k, mat: OWM.METAL });
}
/* Borne kilométrique (blanche, tête rouge) : « KM 47 ». */
function khMilestone(K, x, y, z, n) {
  K.box('kh_concrete', 0xf0ebe0, x - 0.25, y, z - 0.12, x + 0.25, y + 0.75, z + 0.12).box('kh_sheet_red', 0xb83a28, x - 0.26, y + 0.75, z - 0.13, x + 0.26, y + 1.02, z + 0.13);
  const d = vehDecal([['KM', 0.26, 0.3, 700], [n, 0.5, 0.68, 800]], 0.42, 0.5, '#2a2622');
  d.position.set(x, y + 0.45, z + 0.125); K.add(d);
  K.solid(x - 0.25, z - 0.12, x + 0.25, z + 0.12, OWK.LOW, { base: y, top: y + 1, mat: OWM.STONE });
}

/* ---------------------------------------------------------- D : oasis */
function khPlaceD(K) {
  OWPI.place = 'D';
  const y = owH(840, 745), P = (KH.places.D = { y });
  const NAMES = { kh_mudbrick: 'Maison en brique crue', kh_whitewash: 'Maison blanchie' };
  // une maison ; lamp : [x, z] de la lanterne de sa façade (elle la suit)
  const house = (x0, z0, x1, z1, door, wall = 'kh_whitewash', h = 3.3, wins = [], lamp = null) => K.item('maison', NAMES[wall] || 'Maison', (x0 + x1) / 2, y, (z0 + z1) / 2, (K) => {
    owHouse(K, { x0, z0, x1, z1, y, h, wall, roof: 'flat', roofTex: 'kh_ochre', roofHex: 0xeadcc4, parapet: 0.5, floorTex: 'kh_floor', doors: [door], wins, capTex: 'kh_ochre' });
    if (lamp) K.item('lampe', 'Lanterne', lamp[0], y + 2.6, lamp[1], (K) => owLamp(K, lamp[0], y + 2.6, lamp[1], 0xffc070, false, 0.7));
  });
  house(822, 748, 832, 756, ['s', 4, 2], 'kh_mudbrick', 3.4, [['e', 3, 2, 1.1, 2.0]], [827, 757.1]);
  house(834, 746, 842, 754, ['s', 3, 2], 'kh_whitewash', 3.0);
  house(846, 748, 856, 757, ['s', 4, 2], 'kh_whitewash', 3.6, [['w', 3, 2, 1.1, 2.1], ['e', 3, 2, 1.1, 2.1]], [851, 757.6]);
  house(860, 752, 868, 760, ['w', 3, 2], 'kh_mudbrick', 3.2);
  house(860, 778, 870, 786, ['w', 3, 2], 'kh_whitewash', 3.4, [['n', 4, 2, 1.1, 2.0]], [859.4, 782]);
  house(846, 784, 856, 792, ['n', 4, 2], 'kh_mudbrick', 3.1);
  house(830, 786, 840, 794, ['n', 4, 2], 'kh_whitewash', 3.5, [['e', 3, 2, 1.1, 2.0]]);
  house(818, 772, 826, 782, ['e', 4, 2], 'kh_mudbrick', 3.0);
  house(808, 756, 816, 766, ['e', 3, 2], 'kh_whitewash', 3.2);
  house(872, 764, 880, 772, ['w', 3, 2], 'kh_mudbrick', 3.0);
  // armes dans la maison sud-est (mur nord intérieur), citerne du puits (refuge), place
  K.item('citerne', 'Citerne du puits', 845, y, 771, (K) => {
    owHouse(K, { x0: 842, z0: 768, x1: 848, z1: 774, y, h: 2.8, wall: 'kh_whitewash', roof: 'flat', roofTex: 'kh_whitewash', floorTex: 'kh_floor', doors: [['s', 2, 2]] });
    K.geo('kh_whitewash', 0xf4ece0, new THREE.SphereGeometry(2.6, 18, 8, 0, TAU, 0, Math.PI / 2), mtx(845, y + 2.95, 771, 0, 0, 0, 1, 0.7, 1));
  });
  K.item('margelle', 'Margelle du puits', 845, y, 778.5, (K) => {
    K.cyl('kh_mudbrick', 0xd8c4a4, 845, y + 0.4, 778.5, 0.9, 0.8, 16);        // margelle du puits
    K.solid(844, 777.5, 846, 779.5, OWK.LOW, { base: y, top: y + 0.8, mat: OWM.STONE });
  });
  P.refuge = [{ x0: 843, z0: 769, x1: 847, z1: 773, name: 'citerne du puits' }];
  // auvents de palmes, jarres (les lanternes sont sur les façades)
  K.item('auvent', 'Auvent de palmes', 836.6, y, 771, (K) => K.box('kh_planks', 0x7a5a3a, 834.5, y + 2.4, 766, 838.5, y + 2.5, 776).box('kh_planks', 0x6b4a30, 834.6, y, 766.1, 834.8, y + 2.4, 766.3).box('kh_planks', 0x6b4a30, 834.6, y, 775.7, 834.8, y + 2.4, 775.9));
  for (const [x, z] of [[829, 758], [843, 758], [858, 762], [863, 776], [832, 784]]) K.item('jarre', 'Jarre', x, y, z, (K) => K.cyl('kh_mudbrick', 0xb07850, x, y + 0.4, z, 0.3, 0.8, 10));
}

/* ------------------------------------------------------ E : centrale */
function khPlaceE(K) {
  OWPI.place = 'E';
  const y = owH(3515, 1620), P = (KH.places.E = { y });
  // salle des turbines (grande porte à l'ouest, jours hauts), turbines, pont roulant
  K.item('salle', 'Salle des turbines', 3536, y, 1594, (K) => {
    owHouse(K, { x0: 3520, z0: 1586, x1: 3552, z1: 1602, y, h: 10, wall: 'kh_concrete', roof: 'gable', rise: 2.4, roofTex: 'kh_sheet', floorTex: 'kh_floor',
      doors: [['w', 4, 8, 5.2], ['e', 6, 2, 2.4]], wins: [['n', 4, 6, 6.5, 8.6], ['n', 14, 6, 6.5, 8.6], ['n', 24, 6, 6.5, 8.6], ['s', 4, 6, 6.5, 8.6], ['s', 14, 6, 6.5, 8.6], ['s', 24, 6, 6.5, 8.6]] });
    for (const x of [3530, 3540]) {
      K.item('turbine', 'Turbine', x, y, 1594, (K) => {
        K.cyl('kh_sheet', 0x5f7a6a, x, y + 1.6, 1594, 2.2, 5, 20, 0, Math.PI / 2).box('kh_concrete', 0xb8b0a0, x - 3, y, 1591.4, x + 3, y + 0.6, 1596.6);
        K.solid(x - 2.6, 1592, x + 2.6, 1596, OWK.LOW, { base: y, top: y + 3.8, mat: OWM.METAL });
      });
    }
    K.box('kh_sheet', 0xc8a030, 3521, y + 8.6, 1593.5, 3551, y + 9.1, 1594.5);
    owLamp(K, 3536, y + 9.4, 1594, 0xfff0d0, true, 1.2);
  });
  // poste de commande (disjoncteur, chargeur de la batterie) : fixe
  K.item('poste', 'Poste de commande', 3529, y, 1615, (K) => {
    owHouse(K, { x0: 3524, z0: 1610, x1: 3534, z1: 1620, y, h: 3.6, wall: 'kh_concrete', roof: 'flat', roofTex: 'kh_concrete', parapet: 0.3, floorTex: 'kh_floor', doors: [['w', 4, 2]], wins: [['n', 3, 4, 1.1, 2.3], ['s', 3, 4, 1.1, 2.3]] });
    K.box('kh_sheet', 0x6c7a72, 3531.5, y, 1611.2, 3532.9, y + 2, 1618.8);           // pupitre
    K.solid(3531, 1611, 3533, 1619, OWK.LOW, { base: y, top: y + 1.2, mat: OWM.METAL });
    owLamp(K, 3529, y + 3.3, 1615, 0xfff0d0, true, 0.8);
  }, { logic: 'Le chargeur de la batterie (pièce ② de l’avion) suit le poste.' });
  const posteNode = K.lastItem;
  // parc des transformateurs (grillage : on tire au travers, on ne passe pas)
  K.item('grillage', 'Parc des transformateurs', 3550, y, 1618, (K) => {
    const fence = (x0, z0, x1, z1) => {
      owFill(OW.surf, x0, z0, x1, z1, OWK.WINDOW, { base: y - 0.2, top: y + 2.4, lo: y - 0.2, hi: y + 2.3, mat: OWM.METAL });
      K.box('kh_sheet', 0x8a8a84, x0, y + 2.25, z0, x1, y + 2.35, z1);
    };
    fence(3540, 1608, 3560, 1609); fence(3540, 1627, 3560, 1628); fence(3559, 1609, 3560, 1627); fence(3540, 1609, 3541, 1615); fence(3540, 1620, 3541, 1627);
    for (let x = 3540; x <= 3560; x += 2.5) for (const z of [1608.5, 1627.5]) K.box('kh_sheet', 0x6a6a64, x - 0.04, y, z - 0.04, x + 0.04, y + 2.4, z + 0.04);
    const net = khFenceMesh([[3540, 1608.5, 3560, 1608.5], [3540, 1627.5, 3560, 1627.5], [3559.5, 1609, 3559.5, 1627], [3540.5, 1609, 3540.5, 1615], [3540.5, 1620, 3540.5, 1627]], y, 2.3);
    K.add(net);
    for (const z of [1611, 1617, 1623]) {
      K.item('transfo', 'Transformateur', 3551, y, z, (K) => {
        K.box('kh_sheet', 0x6e7a6a, 3549, y, z - 1.2, 3553, y + 2.8, z + 1.2);
        for (const x of [3550, 3551.5]) K.cyl('kh_concrete', 0xb06a40, x, y + 3.2, z, 0.12, 0.8, 8);
        K.solid(3549, z - 1.2, 3553, z + 1.2, OWK.SOLID, { base: y, top: y + 2.8, mat: OWM.METAL });
      });
    }
  });
  // conduite de la prise d'eau, jusqu'au Nil
  const xb = KH.nileBank(1597);
  K.item('conduite', 'Conduite de la prise d’eau', (3552 + xb) / 2, y, 1597, (K) => {
    K.cyl('kh_sheet', 0x6a6e66, (3552 + xb) / 2, y + 1.2, 1597, 0.6, xb - 3552, 14, 0, Math.PI / 2);
    for (let x = 3556; x < xb; x += 14) { const g = owH(x, 1597); K.box('kh_concrete', 0xa8a090, x - 0.3, g - 0.4, 1596.2, x + 0.3, y + 0.7, 1597.8); }
    owFill(OW.surf, 3552, 1596, xb, 1598, OWK.LOW, { base: y, top: y + 1.9, mat: OWM.METAL });
  });
  // abri du camion blindé (toit sur poteaux)
  K.item('abri', 'Abri du camion', 3502, y, 1646, (K) => {
    for (const [x, z] of [[3496.5, 1637.5], [3507.5, 1637.5], [3496.5, 1654.5], [3507.5, 1654.5]]) { K.box('kh_sheet', 0x4a4a46, x - 0.15, y, z - 0.15, x + 0.15, y + 4.6, z + 0.15); K.solid(x - 0.15, z - 0.15, x + 0.15, z + 0.15, OWK.SOLID, { base: y, top: y + 4.6, mat: OWM.METAL }); }
    K.gable('kh_sheet', 0xffffff, 3495.6, 1636.6, 3508.4, 1655.4, y + 4.6, 1.0, false);
  });
  // éclairage au sodium (la nuit à la centrale)
  for (const [x, z, a] of [[3516, 1584, [0, -0.8]], [3516, 1606, [0.8, 0]], [3538, 1606, [0, 0.8]], [3556, 1606, [0, 0.8]], [3517, 1630, [0.8, 0]], [3500, 1660, [0, -0.8]]]) {
    K.item('lampadaire', 'Lampadaire', x, y, z, (K) => owLampPost(K, x, y, z, 6, 0xffa850, false, a));
  }
  P.battery = { x: 3527.5, y, z: 1618.7, node: posteNode };
  P.refuge = [{ x0: 3525, z0: 1611, x1: 3533, z1: 1619, name: 'poste de commande' }, { x0: 3521, z0: 1587, x1: 3551, z1: 1601, name: 'salle des turbines' }];
}
/* Grillage : panneaux transparents (texture de mailles). */
function khFenceMesh(segs, y, h) {
  if (!OWT.mesh) {
    const c = makeCanvas(64, 64), g = c.getContext('2d');
    g.strokeStyle = 'rgba(70,72,70,0.95)'; g.lineWidth = 2;
    for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
    OWT.mesh = share(toTex(c));
  }
  const pos = [], uv = [];
  for (const [x0, z0, x1, z1] of segs) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    pos.push(x0, y, z0, x1, y, z1, x1, y + h, z1, x0, y, z0, x1, y + h, z1, x0, y + h, z0);
    uv.push(0, 0, L / 0.5, 0, L / 0.5, h / 0.5, 0, 0, L / 0.5, h / 0.5, 0, h / 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: OWT.mesh, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }));
}

/* ----------------------------------------------------- F : nécropole */
function khPlaceF(K) {
  OWPI.place = 'F';
  const P = (KH.places.F = { tombs: [] });
  // tombeaux taillés au pied de la falaise nord de l'oued : façade, piliers, chambre (refuge)
  for (const [xc, big] of [[330, false], [404, false], [636, true], [702, false], [764, false]]) {
    // pied de la falaise : premier point (en remontant vers le nord) 3,5 m au-dessus du fond
    const floorY = owH(xc, 2240);
    let zf = 2240;
    while (zf > 2050 && owH(xc, zf) < floorY + 3.5) zf -= 1;
    zf = Math.ceil(zf) + 1;
    const w = big ? 11 : 8, d = big ? 9 : 7, h = big ? 8 : 6.5, y = Math.min(floorY, owH(xc, zf + 1)) + 0.1;
    const x0 = Math.round(xc - w / 2), x1 = x0 + w, z1 = zf + 1, z0 = z1 - d;        // la chambre s'enfonce vers le nord
    K.item('tombeau', big ? 'Grand tombeau' : 'Tombeau', (x0 + x1) / 2, y, (z0 + z1) / 2, (K) => {
      owHouse(K, { x0, z0, x1, z1, y, h: 3.2, wall: 'kh_rock', roof: 'flat', roofTex: 'kh_rock', floorTex: 'kh_rock', doors: [['s', Math.floor(w / 2) - 1, 2, 2.6]] });
      // façade : bloc de roche au-dessus de l'entrée, linteau gravé, deux piliers
      K.box('kh_rock', 0xd8b890, x0 - 1, y + 3.2, z1 - 1.2, x1 + 1, y + h, z1 + 0.3);
      K.box('kh_sandstone', 0xe6d2b0, x0 + 1, y + 2.7, z1 - 0.05, x1 - 1, y + 3.3, z1 + 0.45);
      for (const px of [x0 + Math.floor(w / 2) - 2.2, x0 + Math.floor(w / 2) + 1.4]) { K.box('kh_sandstone', 0xe0caa4, px, y, z1 + 0.05, px + 0.8, y + 2.7, z1 + 0.85); K.solid(px, z1, px + 0.8, z1 + 1, OWK.SOLID, { base: y, top: y + 2.7, mat: OWM.STONE }); }
      K.box('kh_rock', 0xc8a882, x0 - 1, y - 0.3, z0 - 0.5, x0, y + h, z1 + 0.3).box('kh_rock', 0xc8a882, x1, y - 0.3, z0 - 0.5, x1 + 1, y + h, z1 + 0.3);
      // sarcophage
      const cx = (x0 + x1) / 2;
      K.box('kh_sandstone', 0xcdb08a, cx - 1.1, y, z0 + 1.6, cx + 1.1, y + 1.0, z0 + 2.6);
      K.solid(cx - 1.1, z0 + 1.6, cx + 1.1, z0 + 2.6, OWK.LOW, { base: y, top: y + 1, mat: OWM.STONE });
      owLamp(K, cx, y + 2.6, z0 + 3.5, 0xffa040, false, 0.7);
    }, { logic: big ? 'Le quai de la draisine (vers le sanctuaire) suit le grand tombeau.' : 'Le fragment du Sceptre posé sur le sarcophage suit le tombeau.' });
    P.tombs.push({ x0, z0, x1, z1, y, big, node: K.lastItem });
  }
  const T = P.tombs[2];
  P.refuge = P.tombs.map((t) => ({ x0: t.x0 + 1, z0: t.z0 + 1, x1: t.x1 - 1, z1: t.z1 - 1, name: 'tombeau' }));
}

/* ----------------------------------------------------- G : aérodrome */
function khPlaceG(K) {
  OWPI.place = 'G';
  const y = owH(2990, 445), P = (KH.places.G = { y });
  // deux hangars (portes au nord, vers la piste) ; caisses et fûts dans le premier
  for (const x0 of [2790, 2830]) {
    K.item('hangar', 'Hangar', x0 + 16, y, 381, (K) => {
      owHouse(K, { x0, z0: 370, x1: x0 + 32, z1: 392, y, h: 8, wall: 'kh_sheet', wallHex: 0xd0ccc0, roof: 'gable', rise: 3.2, roofTex: 'kh_sheet', floorTex: 'kh_concrete',
        doors: [['n', 7, 18, 6.8], ['s', 14, 2, 2.4]], wins: [['e', 6, 8, 5, 7], ['w', 6, 8, 5, 7]] });
      owLamp(K, x0 + 16, y + 7.6, 381, 0xfff0d8, true, 1.2);
      if (x0 !== 2790) return;
      K.item('caisse', 'Caisse', 2794, y, 389, (K) => {
        owCrate(K, 2794, y, 389, 1);
        K.item('caisse', 'Caisse (sur la pile)', 2794.5, y + 1, 389.1, (K) => owCrate(K, 2794.5, y + 1, 389.1, 0.8));
      });
      K.item('caisse', 'Caisse', 2795.2, y, 389.3, (K) => owCrate(K, 2795.2, y, 389.3, 1));
      K.item('fut', 'Fût', 2818, y, 389, (K) => owBarrel(K, 2818, y, 389));
      K.item('fut', 'Fût', 2818.8, y, 388.2, (K) => owBarrel(K, 2818.8, y, 388.2, 0x3c6a8a));
    });
  }
  // tour de contrôle : fût, escalier à l'est, cabine vitrée à 12 m (vue sur toute la carte)
  K.item('tour', 'Tour de contrôle', 2883, y, 363, (K) => khTower(K, 2880, 360, y));
  // camion-citerne (décor) et jerricans
  K.item('camion', 'Camion-citerne', 2952, y, 424, (K) => khTanker(K, 2952, 424, y));
  // balisage de la piste (allumé avec le courant)
  const r = OW.roads.find((q) => q.id === 'runway'), pts = r.line.pts, cum = r.line.cum;
  for (let s = 10; s < r.line.len - 5; s += 45) {
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < s) i++;
    const a = pts[i], b = pts[i + 1], t = (s - cum[i]) / (cum[i + 1] - cum[i]), x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), px = -dz / l, pz = dx / l;
    for (const sd of [-1, 1]) {
      const lx = x + px * 16.5 * sd, lz = z + pz * 16.5 * sd, ly = owH(lx, lz) + 0.35;
      K.item('balise', 'Balise de piste', lx, ly, lz, (K) => owLamp(K, lx, ly, lz, sd > 0 ? 0xffc070 : 0x8fd0ff, true, 0.6));
    }
  }
  for (const [x, z] of [[2786, 360], [2870, 400], [2930, 440]]) K.item('lampadaire', 'Lampadaire', x, y, z, (K) => owLampPost(K, x, y, z, 6, 0xffc890, false, [0, -0.8]));
  P.plane = { x: 3000, y: owH(3000, 300), z: 300 };
  // l'avion à part (il décolle à la fin) : pivot sur sa position, pièces en coordonnées du monde
  const KP = owKit('avion'), pivot = new THREE.Group();
  khPlane(KP, P.plane.x, P.plane.y, P.plane.z);
  pivot.position.set(P.plane.x, P.plane.y, P.plane.z);
  KP.build(pivot).position.set(-P.plane.x, -P.plane.y, -P.plane.z);
  OW.placesRoot.add(pivot);
  P.planeGroup = pivot;
  P.refuge = [{ x0: 2791, z0: 371, x1: 2821, z1: 391, name: 'hangar' }, { x0: 2831, z0: 371, x1: 2861, z1: 391, name: 'hangar' }];
}
/* Tour de contrôle : fût de béton 6 × 6, escalier droit à l'est (rampes), cabine vitrée. */
function khTower(K, x0, z0, y) {
  const H = 12, x1 = x0 + 6, z1 = z0 + 6;
  K.box('kh_concrete', 0xdad4c6, x0, y - 0.3, z0, x1, y + H, z1);
  K.solid(x0, z0, x1, z1, OWK.SOLID, { base: y - 0.3, top: y + H, mat: OWM.STONE });
  // escalier : de (x1, z1 + 15) vers le nord jusqu'au palier, 16 marches de 0,75 m
  const sx0 = x1, sx1 = x1 + 2, n = 16;
  for (let i = 0; i < n; i++) {
    const zc = z1 + n - 1 - i, b = y + i * 0.75;
    owFill(OW.surf, sx0, zc, sx1, zc + 1, OWK.RAMP, { base: b, top: b + 0.75, dir: 3, mat: OWM.METAL });
    K.box('kh_sheet', 0x8a8a84, sx0, b + 0.65, zc, sx1, b + 0.75, zc + 1);
    K.box('kh_sheet', 0x5a5a56, sx0, b - 0.3, zc + 0.9, sx1, b + 0.75, zc + 1);
  }
  // rampes (garde-corps) et poteaux
  K.box('kh_sheet', 0x3a3a38, sx1 - 0.05, y + 1, z1, sx1 + 0.02, y + H + 1, z1 + n);
  for (let i = 0; i <= n; i += 4) K.box('kh_sheet', 0x3a3a38, sx1 - 0.08, y, z1 + n - i - 0.08, sx1, y + i * 0.75 + 1, z1 + n - i);
  // palier devant la cabine, côté est
  owFill(OW.surf, sx0, z0 + 1, sx1, z1, OWK.FLOOR, { base: y + H, mat: OWM.METAL });
  owFill(OW.surf, sx0, z0, sx1, z0 + 1, OWK.LOW, { base: y + H, top: y + H + 1.05, mat: OWM.METAL });       // garde-corps au nord du palier
  K.box('kh_sheet', 0x8a8a84, sx0, y + H - 0.15, z0, sx1, y + H, z1);
  K.box('kh_sheet', 0x3a3a38, sx0, y + H, z0, sx1, y + H + 1.05, z0 + 0.08);
  // cabine : vitres tout autour (on tire au travers), toit débordant, porte à l'est
  const cy = y + H;
  const win = { base: y - 0.3, top: cy + 3, lo: cy + 1.0, hi: cy + 2.7, mat: OWM.METAL };
  owFill(OW.surf, x0, z0, x1 - 1, z0 + 1, OWK.WINDOW, win);
  owFill(OW.surf, x0, z1 - 1, x1 - 1, z1, OWK.WINDOW, win);
  owFill(OW.surf, x0, z0 + 1, x0 + 1, z1 - 1, OWK.WINDOW, win);              // face est : ouverte (porte), sur le fût plein
  K.box('kh_concrete', 0xcfc8b8, x0, cy, z0, x1, cy + 1.0, z0 + 0.3).box('kh_concrete', 0xcfc8b8, x0, cy, z1 - 0.3, x1, cy + 1.0, z1).box('kh_concrete', 0xcfc8b8, x0, cy, z0, x0 + 0.3, cy + 1.0, z1);
  K.box('kh_concrete', 0xcfc8b8, x0 - 0.5, cy + 2.9, z0 - 0.5, x1 + 0.5, cy + 3.3, z1 + 0.5);
  for (const [a, b] of [[x0, z0], [x1 - 0.15, z0], [x0, z1 - 0.15], [x1 - 0.15, z1 - 0.15]]) K.box('kh_sheet', 0x3a3a38, a, cy + 1, b, a + 0.15, cy + 2.9, b + 0.15);
  K.add(owMeshAt(new THREE.BoxGeometry(6, 1.9, 6), VMAT.glass, x0 + 3, cy + 1.95, z0 + 3));
  owLamp(K, x0 + 3, cy + 3.5, z0 + 3, 0xff3a2a, true, 0.8);
}
/* Camion-citerne (décor : il ne roule pas). */
function khTanker(K, x, z, y) {
  K.box('kh_sheet', 0x2a2826, x - 1.1, y + 0.6, z - 4.5, x + 1.1, y + 1.0, z + 4.5);
  K.box('kh_sheet_red', 0xc8b040, x - 1.2, y + 1.0, z - 4.6, x + 1.2, y + 3.0, z - 2.6);
  K.add(owMeshAt(new THREE.BoxGeometry(2.0, 0.7, 0.05), VMAT.glass, x, y + 2.4, z - 4.63));
  K.cyl('kh_paint', 0xdcd6c8, x, y + 2.15, z + 1.0, 1.15, 6.6, 16, Math.PI / 2, 0);
  for (const zz of [-3.6, 1.8, 3.4]) for (const sd of [-1, 1]) K.cyl('kh_sheet', 0x1e1c1a, x + sd * 1.05, y + 0.5, z + zz, 0.5, 0.35, 12, 0, Math.PI / 2);
  const d = vehDecal([['CARBURANT AVIATION', 0.36, 0.5, 800]], 4.6, 0.6, '#9c2f22');
  d.position.set(x + 1.16, y + 2.2, z + 1.0); d.rotation.y = Math.PI / 2; K.add(d);
  K.solid(x - 1.2, z - 4.6, x + 1.2, z + 4.6, OWK.SOLID, { base: y, top: y + 3.3, mat: OWM.METAL });
}

/* Avion de transport KH-47 (planche des véhicules) : aile haute, deux turbopropulseurs, dérive à
   bout rouge, bande rouge, rampe arrière ; nez vers -x. Non pilotable : l'objectif final. */
function khPlane(K, x, y, z) {
  const W = 0xf0ece4, R = 0xa8432a, yc = y + 2.6, rf = 1.45;
  const ax = (geo) => geo.rotateZ(Math.PI / 2);          // axe des cylindres le long de x
  K.geo('kh_paint', W, ax(new THREE.CylinderGeometry(rf, rf, 15, 24)), mtx(x + 1.5, yc, z));
  K.geo('kh_paint', W, ax(new THREE.CylinderGeometry(rf, 0.45, 3.6, 24)), mtx(x - 7.8, yc - 0.15, z));
  K.geo('kh_paint', W, ax(new THREE.CylinderGeometry(0.55, rf, 3.4, 24)), mtx(x + 10.7, yc + 0.55, z));
  // poste de pilotage, hublots, bande rouge, inscription
  K.add(owMeshAt(new THREE.BoxGeometry(1.4, 0.55, 1.9), VMAT.glass, x - 6.9, yc + 0.95, z, 0, 0, 0.45));
  for (const sd of [-1, 1]) {
    K.box('kh_sheet_red', R, x - 5.8, yc + 0.05, z + sd * (rf - 0.02) - 0.03, x + 8.6, yc + 0.32, z + sd * (rf - 0.02) + 0.03);
    for (let i = 0; i < 8; i++) K.box('kh_sheet', 0x26303a, x - 4.6 + i * 1.6, yc + 0.48, z + sd * (rf - 0.01) - 0.03, x - 4.2 + i * 1.6, yc + 0.78, z + sd * (rf - 0.01) + 0.03);
    const d = vehDecal([['KH-47', 0.7, 0.5, 800]], 2.4, 0.6, '#3a3632');
    d.position.set(x - 4.5, yc - 0.55, z + sd * (rf + 0.02)); d.rotation.y = sd > 0 ? 0 : Math.PI; K.add(d);
  }
  // aile haute, moteurs, hélices
  K.box('kh_paint', W, x - 2.4, yc + rf - 0.1, z - 13, x + 1.2, yc + rf + 0.3, z + 13);
  K.box('kh_sheet', 0xdcd6ca, x - 2.0, yc + rf - 0.35, z - 1.6, x + 1.5, yc + rf, z + 1.6);
  for (const sd of [-1, 1]) {
    const ez = z + sd * 4.6;
    K.geo('kh_paint', W, ax(new THREE.CylinderGeometry(0.62, 0.55, 4.2, 18)), mtx(x - 1.6, yc + rf - 0.55, ez));
    K.geo('kh_sheet', 0x3a3632, ax(new THREE.CylinderGeometry(0.22, 0.42, 0.7, 14)), mtx(x - 4.0, yc + rf - 0.55, ez));
  }
  // dérive (bout rouge), empennage, rampe arrière, train d'atterrissage
  K.geo('kh_paint', W, khFin(4.2, 3.4, 1.6), mtx(x + 9.2, yc + rf - 0.1, z));
  K.geo('kh_sheet_red', R, khFin(1.0, 1.9, 0.95), mtx(x + 10.9, yc + rf + 3.1, z));
  K.box('kh_paint', W, x + 9.8, yc + 0.9, z - 4.2, x + 11.6, yc + 1.1, z + 4.2);
  K.box('kh_sheet', 0xcfc8ba, x + 11.6, y + 0.4, z - 1.1, x + 13.6, y + 0.6, z + 1.1, {});
  for (const sd of [-1, 1]) {
    K.box('kh_sheet', 0xe2ddd2, x - 0.5, y + 0.9, z + sd * 1.3 - 0.45, x + 3.0, y + 2.0, z + sd * 1.3 + 0.45);
    for (const gx of [0.2, 2.2]) K.cyl('kh_sheet', 0x1e1c1a, x + gx, y + 0.55, z + sd * 1.55, 0.55, 0.4, 14, Math.PI / 2, 0);
  }
  K.cyl('kh_sheet', 0x1e1c1a, x - 7.2, y + 0.42, z, 0.42, 0.3, 12, Math.PI / 2, 0).box('kh_sheet', 0x8a8a84, x - 7.25, y + 0.42, z - 0.05, x - 7.15, yc - 1.2, z + 0.05);
  // collisions : fuselage, moteurs bas
  K.solid(x - 9.4, z - 1.4, x + 12, z + 1.4, OWK.SOLID, { base: y, top: yc + rf, mat: OWM.METAL });
  for (const sd of [-1, 1]) K.solid(x - 3.8, z + sd * 4.6 - 0.6, x + 0.6, z + sd * 4.6 + 0.6, OWK.SOLID, { base: yc + rf - 1.2, top: yc + rf, mat: OWM.METAL });
}
/* Dérive : trapèze extrudé (base b, sommet t, hauteur h ; en x le long du fuselage). */
function khFin(h, b, t) {
  const sh = new THREE.Shape();
  sh.moveTo(-b / 2, 0); sh.lineTo(b / 2, 0); sh.lineTo(b / 2 + 0.2, h); sh.lineTo(b / 2 + 0.2 - t, h); sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: false }).translate(0, 0, -0.12);
}
