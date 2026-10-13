/* ========================================================== 12 MONDE OUVERT ==
   Khamsin (jeu 2.0.0) : demande d'Anthony du 8 octobre 2026, 23 h 41, d'après sa planche « Khamsin —
   map zombie (Égypte) » (8 pages) : « une toute nouvelle map », « très très grande », tous les modèles
   et les véhicules, deuxième carte du menu Jouer. Douze kilomètres carrés (4 × 3 km) entre la mer de
   sable et le Nil, sept lieux reliés par la R47 et des pistes, une tempête toutes les quatre manches.
   La grille de cases de 1 m du reste du jeu (160 × 160 cases au plus, un tableau par case et par
   niveau) ne tient pas à cette taille : ce monde a son propre moteur. Quand OW.on est vrai, les
   fonctions de la grille (sol, collisions, rayons, flux des zombies, apparitions) passent la main
   à celles d'ici :
     terrain    champ de hauteurs tous les 4 m (dunes, plateau, oued et falaises, vallée du Nil),
                routes aplanies, morceaux de 256 m dessinés à quatre niveaux de détail
     solides    grille de cases de 1 m par morceaux de 64 × 64 créés à la demande (bâtiments, murs,
                pyramides, caisses) ; une seconde grille pour le sous-sol (sanctuaire, tunnels)
     zombies    champ de flux de 160 × 160 m autour du joueur, en ligne droite au-delà
   Repère : x vers l'est (0 à 4000 m), z vers le sud (0 à 3000 m), y en haut ; le nord est en haut du plan.
   ============================================================================ */
const OW = {
  on: false, map: null, seed: 4747,
  W: 4000, D: 3000,                       // zone jouable (m)
  // champ de hauteurs : de -1024 à 5120 m en x, de -1024 à 4096 m en z, un point tous les 4 m
  // (monde courant : Khamsin ; la Lune a les siens, voir OW_WORLDS)
  X0: -1024, Z0: -1024, STEP: 4, INV: 0.25, NX: 1537, NZ: 1281, walk: [150, 10, 3990, 2990],
  H: null, bio: null, steep: null, water: null, worldId: null, locs: null,
  root: null, t: 0,
};
// matières du sol (une par point du champ de hauteurs)
const OWB = { SAND: 0, SEA: 1, PLATEAU: 2, ROCK: 3, WADI: 4, FIELD: 5, MUD: 6, RIVER: 7, OASIS: 8, PAD: 9, ROAD: 10, TRACK: 11, RUNWAY: 12 };
const owSmoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------- Bruit --- */
function owHash(ix, iz) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + OW.seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/* Bruit de valeur lissé, de 0 à 1. */
function owNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = owHash(ix, iz), b = owHash(ix + 1, iz), c = owHash(ix, iz + 1), d = owHash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function owFbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * owNoise(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

/* ------------------------------------------------------ Plan de Khamsin --
   Positions relevées sur le plan de la planche (page 2 : 4 × 3 km, graduation 500 m), en mètres. */
const KH = {
  // les sept lieux (A à G) : centre, rayon d'influence (nom à l'écran, lumière du lieu)
  locs: [
    { id: 'A', name: 'Camp de fouilles', sub: 'Départ', x: 2300, z: 1965, r: 170 },
    { id: 'B', name: 'Plateau des pyramides', sub: 'Sanctuaire · faisceau', x: 2030, z: 1360, r: 560 },
    { id: 'C', name: 'Relais Km 47', sub: 'Carburant · garage', x: 1395, z: 2585, r: 150 },
    { id: 'D', name: 'Oasis de Sekhet', sub: 'Village · puits', x: 820, z: 740, r: 240 },
    { id: 'E', name: 'Centrale du Nil', sub: 'Courant', x: 3520, z: 1620, r: 190 },
    { id: 'F', name: 'Nécropole des falaises', sub: 'Tombeaux · tunnels', x: 640, z: 2265, r: 240 },
    { id: 'G', name: 'Aérodrome', sub: 'Fuite finale', x: 2960, z: 400, r: 330 },
  ],
  // contour du plateau des pyramides (relevé sur le plan)
  plateau: [[1400, 1300], [1430, 1180], [1520, 1080], [1680, 990], [1880, 930], [2100, 905], [2300, 915], [2480, 960],
    [2580, 1060], [2610, 1180], [2560, 1300], [2470, 1420], [2420, 1520], [2380, 1640], [2260, 1760], [2080, 1830],
    [1880, 1840], [1680, 1800], [1520, 1700], [1430, 1560], [1395, 1420]],
  plateauTop: 32,
  // les trois pyramides : centre, côté, hauteur (Khéops, Khéphren, Mykérinos à l'échelle du plan)
  pyramids: [
    { x: 2120, z: 1240, side: 200, h: 128, beam: true },
    { x: 1915, z: 1440, side: 170, h: 109 },
    { x: 1750, z: 1620, side: 90, h: 58 },
  ],
  // routes : R47 goudronnée (D → G → E → A → C), pistes, piste de l'aérodrome
  roads: [
    { id: 'r47', kind: 'road', w: 8, pts: [[930, 734], [1000, 712], [1400, 664], [1800, 614], [2200, 572], [2600, 528], [2800, 512],
      [3120, 512], [3230, 556], [3360, 660], [3455, 840], [3500, 1060], [3510, 1300], [3480, 1520], [3440, 1690], [3380, 1760],
      [3200, 1880], [2900, 2000], [2600, 2062], [2420, 2100], [2200, 2210], [2000, 2340], [1800, 2430], [1600, 2500], [1420, 2550], [1360, 2566]] },
    { id: 'cf', kind: 'track', w: 6, pts: [[1360, 2566], [1250, 2560], [1120, 2540], [960, 2470], [830, 2390], [720, 2330], [640, 2300]] },
    { id: 'df', kind: 'track', w: 6, pts: [[700, 790], [640, 980], [580, 1180], [520, 1400], [490, 1620], [480, 1840], [500, 2040], [560, 2200], [620, 2270]] },
    { id: 'db', kind: 'track', w: 6, pts: [[930, 800], [1180, 920], [1450, 1040], [1650, 1130], [1790, 1220], [1840, 1300]] },
    { id: 'eb', kind: 'track', w: 6, pts: [[3420, 1640], [3150, 1600], [2850, 1550], [2600, 1500], [2420, 1460], [2240, 1420]] },
    { id: 'ab', kind: 'track', w: 6, pts: [[2290, 1905], [2250, 1820], [2190, 1700], [2130, 1580], [2100, 1520]] },
    { id: 'runway', kind: 'runway', w: 30, pts: [[2390, 268], [3560, 178]] },
  ],
  nileBank: (z) => 3790 + 26 * Math.sin(z / 180 + 0.7) + 11 * Math.sin(z / 61 + 2.1),
  oasis: { x: 734, z: 732, rx: 44, rz: 19 },
  // couloir du Khamsin : bande sud-ouest → nord-est (n · P entre 1818 et 2930 m), axe vers le nord-est
  corridor: { nx: 0.598, nz: 0.8015, s0: 1818, s1: 2930, ax: 0.8015, az: -0.598 },
  spawn: { pos: [2350, 1992], yaw: 0.47 },
};
/* Couloir du Khamsin : 1 au milieu, 0 dehors (bords fondus sur 120 m). */
function khCorridor(x, z) {
  const c = KH.corridor, s = c.nx * x + c.nz * z;
  return owSmoothstep(c.s0 - 60, c.s0 + 60, s) * (1 - owSmoothstep(c.s1 - 60, c.s1 + 60, s));
}
/* Lieu le plus proche et distance à son bord (négative dedans). */
function khNearestLoc(x, z) {
  let best = null, bd = Infinity;
  for (const L of OW.locs || KH.locs) {
    const d = Math.hypot(x - L.x, z - L.z) - L.r;
    if (d < bd) { bd = d; best = L; }
  }
  return { loc: best, d: bd };
}
