/* ========================================================================== 37 CAMION ==
   Deuxième easter egg secondaire de Bunker 7 (demande d'Anthony du 9 novembre 2026, pour le jeu 2.0.7) : le camion
   militaire des abords, derrière la Salle des machines, refait en 3D, se détruit.
   · Solidité : une réserve de CAM.pv points de vie. Les balles comptent leurs dégâts réels (paliers du Glas, Détente),
     multipliés par CAM.kBalles (environ 3 chargeurs de Thompson au palier I) ; les explosifs (roquettes, Désintégrateur,
     grenades, balles de la M1911 Ardente, Onde de choc) comptent triple, au moins CAM.explosifMin (grenades des
     premières manches). Le couteau ne compte pas (le camion est hors d'atteinte).
   · Pendant les tirs : étincelles et trous de balles ; à 50 % il fume, à 25 % des flammes sortent du capot.
   · Détruit : explosion (boule de feu, éclair des explosions, pièces qui volent, bâche arrachée), puis l'épave noircie
     brûle CAM.feu s et fume jusqu'à la fin de la partie. Ni dégâts ni secousse (vertige d'Anthony).
   · Récompense : « Munitions max » et « Atout gratuit » au sol, CAM.vie s, dans la salle du joueur, près de lui
     (horlPlaces), un petit son ; écran « Secrets » : b7-camion. Une fois par partie ; une nouvelle partie remet le
     camion neuf. Seulement sur Bunker 7 ; ailleurs, les camions des abords sont en 3D mais indestructibles ; pendant le
     combat du boss, rien ; pendant la quête principale (coupure, lockdowns), il se détruit aussi.
   · Rendu : les pièces sont celles des abords (Parts, PropBatch, outskirtsMaterial : mêmes matières, aucun programme
     nouveau à compiler) ; l'épave noircit par les couleurs de ses sommets. Aucune lampe ajoutée (lueur du feu : sprites
     additifs ; éclair : FX.boomLight). Fumée et flammes : sprites à lui (la réserve des effets du jeu n'est pas prise).
   Points d'accroche : tools/hooks-camion.py.
   ============================================================================ */
const CAM = {
  pv: 13500,                                   // réserve : 2 roquettes, 3 tirs de Désintégrateur, 3 à 4 grenades (manche 10)
  explosif: 3, explosifMin: 1100,              // les explosifs comptent triple, au moins 1 100 (grenade des premières manches)
  kBalles: 0,                                  // calculé : 3 chargeurs de Thompson au palier I (camKBalles)
  feu: 30, vie: 30,                            // s : l'épave brûle ; durée des bonus au sol
  // boîtes de tir dans le repère du camion (avant vers +z) : cabine et capot, plateau et bâche
  boites: [
    { x0: -0.62, x1: 0.62, y0: 0.25, y1: 1.74, z0: 2.08, z1: 3.68 },        // capot et calandre
    { x0: -1.1, x1: 1.1, y0: 0.25, y1: 1.18, z0: 2.0, z1: 3.68 },          // ailes et pare-chocs
    { x0: -1.08, x1: 1.08, y0: 0.25, y1: 2.82, z0: 0.82, z1: 2.22 },       // cabine
    { x0: -1.2, x1: 1.2, y0: 0.25, y1: 2.82, z0: -3.42, z1: 0.82, bache: true },   // plateau et bâche (1,75 m sans elle)
  ],
  place: { x: 29.09, z: -8.74, r: 5.07, s: 0.92 },   // Bunker 7 : place du camion de l'easter egg (celle de la qualité normale)
  camions: [], cible: null,                    // camions des abords (repère) ; celui qu'on détruit (Bunker 7)
  groupe: null, racine: null, corps: [], bache: null, vitres: null, sprites: null, couleurs: null,
  inv: new THREE.Matrix4(), mat: new THREE.Matrix4(),
  etat: 'neuf', degats: 0, t: 0, fumT: 0, feuT: 0, sonT: 0, fait: false,
};

/* ------------------------------------------------------------------ Modèle --- */
/* Camion militaire bâché (années 1940) : capot, calandre, ailes, phares, cabine, pare-brise en deux, portières,
   marchepieds, réservoir, échappement, châssis, plateau à ridelles, bâche sur arceaux, six roues à jantes. Couleurs
   sRGB (vert olive passé, rouille). Trois lots : la carrosserie, la bâche, les vitres (cachées à la destruction). */
function camPieces() {
  const O = 0x4a5532, O2 = 0x3f4a2c, F = 0x26261f, N = 0x161614, R = 0x6a3e24, BO = 0x5a4632, T = 0x5d6142;
  const C = new Parts(mulberry32(4417)), B = new Parts(mulberry32(4418)), V = new Parts(mulberry32(4419));
  // châssis, pare-chocs, crochets
  for (const x of [-0.5, 0.5]) C.b(0.12, 0.22, 6.7, x, 0.74, -0.15, 'metal', F);
  C.b(2.2, 0.18, 0.16, 0, 0.66, 3.58, 'metal', F); C.b(2.0, 0.16, 0.14, 0, 0.7, -3.42, 'metal', F);
  for (const x of [-0.75, 0.75]) C.o(0.07, 0.022, x, 0.62, 3.7, 'metal', N, 0, Math.PI / 2, 0);
  // calandre : cadre et barreaux
  C.b(1.02, 0.86, 0.1, 0, 1.24, 3.43, 'paint', O2);
  for (let i = 0; i < 9; i++) C.b(0.04, 0.72, 0.06, -0.4 + i * 0.1, 1.24, 3.49, 'metal', N);
  C.b(0.86, 0.06, 0.06, 0, 1.62, 3.49, 'metal', N);
  // capot : dessus, flancs, ouïes, charnière
  C.b(1.08, 0.08, 1.38, 0, 1.64, 2.78, 'paint', O); C.b(1.08, 0.08, 0.02, 0, 1.64, 2.08, 'metal', N);
  for (const sx of [-1, 1]) {
    C.b(0.06, 0.62, 1.38, sx * 0.53, 1.32, 2.78, 'paint', O);
    for (let i = 0; i < 5; i++) C.b(0.02, 0.05, 0.4, sx * 0.565, 1.2 + i * 0.08, 2.9, 'metal', N);
  }
  C.b(0.08, 0.04, 1.3, 0, 1.69, 2.78, 'metal', F);
  // ailes avant (dessus, pente avant, jupe) et phares
  for (const sx of [-1, 1]) {
    C.b(0.5, 0.06, 0.95, sx * 0.84, 1.13, 2.62, 'paint', O);
    C.b(0.5, 0.06, 0.55, sx * 0.84, 0.94, 3.27, 'paint', O, -0.62, 0, 0);
    C.b(0.5, 0.06, 0.42, sx * 0.84, 0.95, 2.02, 'paint', O, 0.75, 0, 0);
    C.c(0.12, 0.14, sx * 0.72, 1.34, 3.3, 'metal', F, Math.PI / 2, 0, 0, 14);
    V.c(0.1, 0.02, sx * 0.72, 1.34, 3.38, 'glass', 0xd8d4b8, Math.PI / 2, 0, 0, 14);
    C.b(0.05, 0.22, 0.05, sx * 0.72, 1.2, 3.28, 'metal', F);
  }
  // cabine : caisse, toit, montants, portières, poignées, marchepieds, rétroviseurs
  C.b(2.0, 0.85, 1.32, 0, 1.58, 1.52, 'paint', O); C.b(2.04, 0.07, 1.4, 0, 2.77, 1.5, 'paint', O2);
  C.b(2.0, 0.2, 0.08, 0, 2.62, 2.18, 'paint', O); C.b(0.08, 0.6, 0.08, 0, 2.3, 2.18, 'paint', O);
  for (const sx of [-1, 1]) {
    C.b(0.08, 0.62, 0.08, sx * 0.98, 2.3, 2.18, 'paint', O); C.b(0.08, 0.72, 0.1, sx * 0.98, 2.37, 0.86, 'paint', O);
    C.b(0.06, 0.18, 1.2, sx * 1.0, 2.08, 1.52, 'paint', O);
    C.b(0.02, 0.85, 0.02, sx * 1.01, 1.6, 2.1, 'metal', N); C.b(0.02, 0.85, 0.02, sx * 1.01, 1.6, 0.95, 'metal', N);
    C.b(0.04, 0.03, 0.14, sx * 1.03, 1.75, 1.15, 'metal', F);
    C.b(0.42, 0.04, 0.5, sx * 1.05, 0.98, 1.55, 'metal', F);
    C.b(0.03, 0.03, 0.34, sx * 1.12, 2.3, 2.2, 'metal', F, 0, sx * 0.6, 0); C.b(0.04, 0.2, 0.14, sx * 1.26, 2.32, 2.32, 'metal', N);
    V.b(0.02, 0.5, 1.02, sx * 1.0, 2.35, 1.52, 'glass', 0x9fb4b8);
  }
  for (const sx of [-1, 1]) V.b(0.86, 0.5, 0.02, sx * 0.47, 2.32, 2.19, 'glass', 0x9fb4b8);
  C.b(2.0, 0.6, 0.06, 0, 2.33, 0.83, 'paint', O2);
  // étoile blanche passée sur les portières et le capot (cinq traits)
  const etoile = (P, x, y, z, ry, r) => {
    const pts = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; pts.push([Math.cos(a) * r, -Math.sin(a) * r]); }
    for (let i = 0; i < 5; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 5], L = Math.hypot(bx - ax, by - ay), a = Math.atan2(by - ay, bx - ax);
      if (ry === 'haut') P.b(L, 0.012, 0.035, x + (ax + bx) / 2, y, z + (ay + by) / 2, 'paint', 0xb8b4a2, 0, -a, 0);
      else P.b(0.012, 0.035, L, x, y + (ay + by) / 2, z + ((ax + bx) / 2) * ry, 'paint', 0xb8b4a2, -a * ry, 0, 0);
    }
  };
  etoile(C, 1.032, 1.62, 1.52, 1, 0.24); etoile(C, -1.032, 1.62, 1.52, -1, 0.24); etoile(C, 0, 1.685, 2.72, 'haut', 0.3);
  // réservoir, échappement, batterie
  C.c(0.2, 0.9, 0.72, 0.72, 0.6, 'paint', O2, 0, 0, Math.PI / 2, 14); C.c(0.05, 2.2, -0.72, 0.5, -0.3, 'rust', R, Math.PI / 2, 0, 0, 8);
  C.b(0.4, 0.32, 0.36, -0.75, 0.82, 0.55, 'metal', F);
  // plateau : plancher, ridelles à planches, tête de plateau, hayon à chaînes
  C.b(2.3, 0.12, 4.24, 0, 1.15, -1.28, 'wood', BO);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) C.b(0.06, 0.15, 4.24, sx * 1.12, 1.31 + i * 0.18, -1.28, 'wood', BO);
    for (const z of [0.6, -0.4, -1.4, -2.4, -3.3]) C.b(0.08, 0.6, 0.08, sx * 1.14, 1.5, z, 'metal', F);
  }
  for (let i = 0; i < 4; i++) C.b(2.3, 0.14, 0.06, 0, 1.3 + i * 0.17, 0.82, 'wood', BO);
  for (let i = 0; i < 3; i++) C.b(2.24, 0.15, 0.06, 0, 1.31 + i * 0.18, -3.38, 'wood', BO);
  for (const sx of [-1, 1]) C.b(0.02, 0.4, 0.02, sx * 1.0, 1.55, -3.42, 'metal', N, 0.4, 0, 0);
  // arceaux de la bâche (visibles une fois la bâche brûlée)
  for (const z of [0.7, -0.35, -1.4, -2.45, -3.3]) {
    for (const sx of [-1, 1]) C.b(0.05, 0.5, 0.05, sx * 1.12, 2.0, z, 'metal', F);
    for (let k = 0; k < 8; k++) {               // demi-arc : 8 barres le long de la demi-ellipse
      const a0 = (k / 8) * Math.PI, a1 = ((k + 1) / 8) * Math.PI;
      C._add('box', beamMtx(Math.cos(a0) * 1.12, 2.25 + Math.sin(a0) * 0.5, z, Math.cos(a1) * 1.12, 2.25 + Math.sin(a1) * 0.5, z, 0.05, 0.05), 'metal', F);
    }
  }
  // bâche : côtés, toit bombé, fond, rabat arrière roulé à moitié
  for (const sx of [-1, 1]) B.b(0.04, 0.52, 4.2, sx * 1.16, 2.0, -1.28, 'fabric', T);
  B._add('cyl:1:20', mtx(0, 2.24, -1.28, Math.PI / 2, 0, 0, 1.17, 4.22, 0.56), 'fabric', T);
  B.b(2.3, 0.55, 0.04, 0, 2.0, 0.8, 'fabric', T);
  B.b(2.26, 0.35, 0.04, 0, 2.4, -3.4, 'fabric', 0x535839); B.c(0.09, 2.2, 0, 2.2, -3.42, 'fabric', 0x535839, 0, 0, Math.PI / 2, 10);
  for (let i = 0; i < 6; i++) B.b(0.03, 0.45, 0.03, -1.0 + i * 0.4, 1.95, -3.43, 'fabric', 0x4a4e32);
  // roues : pneu, jante, moyeu (avant simples, arrière jumelées)
  const roue = (x, z) => {
    C.c(0.5, 0.3, x, 0.5, z, 'rubber', N, 0, 0, Math.PI / 2, 20);
    C.c(0.3, 0.32, x, 0.5, z, 'paint', O2, 0, 0, Math.PI / 2, 14);
    C.c(0.1, 0.34, x, 0.5, z, 'metal', F, 0, 0, Math.PI / 2, 10);
  };
  for (const sx of [-1, 1]) { roue(sx * 0.96, 2.55); roue(sx * 0.92, -1.35); roue(sx * 0.92, -2.55); }
  for (const z of [-1.35, -2.55]) C.b(0.2, 0.12, 0.4, 0, 0.55, z, 'metal', F);
  return { C: C.list, B: B.list, V: V.list };
}
/* Un camion dans le repère des abords (position, lacet, échelle et inclinaison du camion qu'il remplace). */
function camModele(p) {
  const P = camPieces(), g = new THREE.Group();
  g.name = 'camion';
  const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0, p.z),
    new THREE.Quaternion().setFromAxisAngle(_vUp, p.r).premultiply(p.tilt ? new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tilt[0], 0, p.tilt[1])) : new THREE.Quaternion()),
    new THREE.Vector3(p.s, p.s, p.s));
  const lot = (list, nom) => { const sg = new THREE.Group(); sg.name = nom; const b = new PropBatch(); b.add(list, m); b.build(sg, null, outskirtsMaterial); g.add(sg); return sg; };
  const corps = lot(P.C, 'camion-corps'), bache = lot(P.B, 'camion-bache'), vitres = lot(P.V, 'camion-vitres');
  if (LI0 > 0) g.traverse((o) => { if (o.isMesh) o.userData.lv = 0; });
  return { g, corps, bache, vitres, m };
}

/* ------------------------------------------------------------------ Abords --- */
/* (buildOutskirts, avant les objets semés) : les camions sont retirés des objets ; celui de Bunker 7 qu'on détruit est
   le plus proche des fenêtres de la Salle des machines. */
function camChoisir(props) {
  CAM.camions = props.filter((p) => p.m === 'truck_wreck');
  CAM.cible = null;
  const zm = LAYOUT && LAYOUT.zones ? LAYOUT.zones.findIndex((z) => z.name === 'Salle des machines') : -1;
  const fen = zm >= 0 ? World.windows.filter((w) => w.zone === zm) : [];
  if (!CUR.map || CUR.map.id !== BUNKER7.id || !fen.length) return;
  // la place est fixe (les objets semés changent avec la qualité « basse », qui sème moins d'arbres) : le camion de cette
  // place s'il y est, sinon le nôtre ; les objets semés tout près sont retirés (camProp)
  const P = CAM.place, cx = Math.floor(P.x), cz = Math.floor(P.z);
  if (inb(cx, cz) && grid[cz * GW + cx] !== T.VOID) return;   // une Bunker 7 modifiée qui s'étend jusque-là : pas de camion
  CAM.cible = CAM.camions.find((p) => Math.hypot(p.x - P.x, p.z - P.z) < 0.5) || null;
  if (!CAM.cible) { CAM.cible = { m: 'truck_wreck', x: P.x, z: P.z, r: P.r, s: P.s, tilt: null, ajoute: true }; CAM.camions.push(CAM.cible); }
}
function camProp(p) {
  if (p.m === 'truck_wreck') return true;
  return !!CAM.cible && CAM.cible.ajoute && Math.hypot(p.x - CAM.cible.x, p.z - CAM.cible.z) < 4.2 && !String(p.m).startsWith('decal_') && p.m !== 'fern' && p.m !== 'tall_grass';
}
/* (buildOutskirts, après l'horloge) : les camions 3D. */
function camAbords(group) {
  CAM.groupe = CAM.racine = CAM.bache = CAM.vitres = CAM.corps = null; CAM.couleurs = null; CAM.sprites = null;
  for (const p of CAM.camions) {
    const M = camModele(p);
    group.add(M.g);
    if (p !== CAM.cible) continue;
    CAM.groupe = group; CAM.racine = M.g; CAM.corps = M.corps; CAM.bache = M.bache; CAM.vitres = M.vitres;
    CAM.mat.copy(M.m); CAM.inv.copy(M.m).invert();
    CAM.couleurs = [];                         // couleurs d'origine des sommets (l'épave noircit, une partie neuve les rend)
    M.g.traverse((o) => { if (o.isMesh) CAM.couleurs.push([o.geometry.attributes.color, o.geometry.attributes.color.array.slice()]); });
    camSprites();
  }
}

/* ------------------------------------------------------------------ Tirs --- */
/* Le camion répond-il ? (Bunker 7, abords affichés, pas pendant le combat du boss, pas encore détruit) */
function camActif() {
  if (!CAM.racine || CAM.fait || OW.on || G.mapId !== BUNKER7.id || CUR.editor) return false;
  if (CAM.groupe !== OUTSKIRTS.group || !World.outskirts || World.outskirts !== OUTSKIRTS.info) return false;
  if (typeof B7 === 'object' && B7.actif) return false;
  let o = CAM.racine;
  for (; o.parent; o = o.parent) if (!o.visible) return false;
  return o === scene;
}
/* L'épave arrête encore les balles (sans dégâts) : le camion est-il là ? */
function camPresent() {
  if (!CAM.racine || OW.on || G.mapId !== BUNKER7.id || CUR.editor || CAM.groupe !== OUTSKIRTS.group) return false;
  let o = CAM.racine;
  for (; o.parent; o = o.parent) if (!o.visible) return false;
  return o === scene;
}
const _camO = new THREE.Vector3(), _camD = new THREE.Vector3(), _camN = new THREE.Vector3();
/* Rayon contre les boîtes du camion : distance (repère du monde), ou −1 ; normale de la face dans CAM.n. */
function camRayon(ox, oy, oz, dx, dy, dz, maxT) {
  if (!camPresent()) return -1;
  _camO.set(ox, oy, oz).applyMatrix4(CAM.inv);
  _camD.set(dx, dy, dz).transformDirection(CAM.inv);
  const k = 1 / CAM.racineEchelle(), o = _camO, d = _camD;   // distances locales → monde
  let best = Infinity, n = -1;
  for (const b of CAM.boites) {
    let t0 = -Infinity, t1 = Infinity, ax = -1;
    const lo = [b.x0, b.y0, b.z0], hi = [b.x1, camHaut(b), b.z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < lo[i] || oo[i] > hi[i]) ok = false; continue; }
      let a = (lo[i] - oo[i]) / dd[i], c = (hi[i] - oo[i]) / dd[i], s = -1;
      if (a > c) { const q = a; a = c; c = q; s = 1; }
      if (a > t0) { t0 = a; ax = i * 2 + (s > 0 ? 1 : 0); }
      if (c < t1) t1 = c;
      if (t0 > t1) ok = false;
    }
    if (ok && t0 > 0 && t0 < best) { best = t0; n = ax; }
  }
  if (n < 0) return -1;
  const t = best / k;
  if (t >= maxT) return -1;
  _camN.set(0, 0, 0); _camN.setComponent(n >> 1, n & 1 ? 1 : -1);
  _camN.transformDirection(CAM.mat);
  return t;
}
CAM.racineEchelle = () => new THREE.Vector3().setFromMatrixScale(CAM.mat).x;
const camHaut = (b) => (b.bache && CAM.fait ? 1.75 : b.y1);
/* Balles : 3 chargeurs de Thompson au palier I (dégâts du jeu, Détente comprise) font la réserve. */
function camKBalles() {
  if (!CAM.kBalles) { const t = tierStats('thompson', 1); CAM.kBalles = CAM.pv / (3 * t.dmg * t.mag); }
  return CAM.kBalles;
}
/* Coup de balle (hitscan) : étincelles, trou, dégâts ; balles explosives de la M1911 Ardente : leur explosion. */
function camTouche(s, x, y, z, t, dmg, fall, boom) {
  const n = _camN;
  sparkBurst(x, y, z, n.x, n.y, n.z, 4);
  if (Math.random() < 0.5) addDecal('hole', x, y, z, n.x, n.y, n.z, rand(0.06, 0.09));
  if (camActif()) {
    Arms.shotHit = true;
    let d = dmg;
    if (fall) d *= t <= fall[0] ? 1 : t >= fall[1] ? fall[2] : lerp(1, fall[2], (t - fall[0]) / (fall[1] - fall[0]));
    camDegats(d * camKBalles());
    camSonImpact(x, z);
  }
  if (boom) explode(x + n.x * 0.25, y + n.y * 0.25, z + n.z * 0.25, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s });
}
/* Explosion (début d'explode) : le souffle qui atteint le camion compte triple. */
function camExplosion(x, y, z, radius, damage, opts) {
  if (!camActif()) return;
  _camO.set(x, y, z).applyMatrix4(CAM.inv);
  const k = CAM.racineEchelle();
  let dmin = Infinity;
  for (const b of CAM.boites) {
    const cx = clamp(_camO.x, b.x0, b.x1), cy = clamp(_camO.y, b.y0, camHaut(b)), cz = clamp(_camO.z, b.z0, b.z1), d = Math.hypot(_camO.x - cx, _camO.y - cy, _camO.z - cz) * k;
    if (d < dmin) { dmin = d; _camN.set(cx, cy, cz); }
  }
  if (dmin > radius + 0.3) return;
  _camN.applyMatrix4(CAM.mat);                  // point du camion le plus proche : pas de souffle à travers un mur
  if (dmin > 0.3 && !sightClear(x, y, z, _camN.x, _camN.y, _camN.z)) return;
  const f = clamp(1 - Math.max(0, dmin - 0.5) / (radius - 0.2), 0, 1);   // contre la carrosserie (à 0,5 m près) : tout le souffle
  camDegats(Math.max(damage, opts && opts.src === 'grenade' ? CAM.explosifMin : 0) * (0.3 + 0.7 * f) * CAM.explosif);
}
/* Onde de choc : le camion dans son cône et à sa portée, comme une roquette. */
function camSouffle(ox, oy, oz, b) {
  if (!camActif() || !b) return;
  const c = new THREE.Vector3(0, 1.4, 0).applyMatrix4(CAM.mat), d = Math.hypot(c.x - ox, c.y - oy, c.z - oz);
  if (d > b.range + 2) return;
  const dot = ((c.x - ox) * _fwd.x + (c.y - oy) * _fwd.y + (c.z - oz) * _fwd.z) / (d || 1);
  if (dot < Math.cos(b.cone) || !sightClear(ox, oy, oz, c.x, c.y, c.z)) return;   // pas à travers un mur
  camDegats(2600 * CAM.explosif);
}
/* Grenade qui touche le camion : elle rebondit dessus (sinon elle le traverserait). */
function camGrenade(g) {
  if (!camPresent()) return;
  _camO.set(g.x, g.y, g.z).applyMatrix4(CAM.inv);
  const o = _camO, m = 0.06;
  for (const b of CAM.boites) {
    const y1 = camHaut(b);
    if (o.x < b.x0 - m || o.x > b.x1 + m || o.y < b.y0 - m || o.y > y1 + m || o.z < b.z0 - m || o.z > b.z1 + m) continue;
    const pen = [o.x - (b.x0 - m), b.x1 + m - o.x, o.y - (b.y0 - m), y1 + m - o.y, o.z - (b.z0 - m), b.z1 + m - o.z];
    let i = 0; for (let j = 1; j < 6; j++) if (pen[j] < pen[i]) i = j;
    const ax = i >> 1, sg = i & 1 ? 1 : -1;
    o.setComponent(ax, (sg > 0 ? [b.x1, y1, b.z1] : [b.x0, b.y0, b.z0])[ax] + sg * m);
    o.applyMatrix4(CAM.mat); g.x = o.x; g.y = o.y; g.z = o.z;
    _camN.set(0, 0, 0); _camN.setComponent(ax, sg); _camN.transformDirection(CAM.mat);
    const dot = g.vx * _camN.x + g.vy * _camN.y + g.vz * _camN.z;
    if (dot < 0) { g.vx -= 2 * dot * _camN.x; g.vy -= 2 * dot * _camN.y; g.vz -= 2 * dot * _camN.z; g.vx *= 0.4; g.vy *= 0.35; g.vz *= 0.4; if (Math.abs(dot) > 2) Sound.grenadeBounce({ x: g.x, y: g.y, z: g.z }); }
    return;
  }
}

/* ------------------------------------------------------------------ États --- */
function camDegats(d) {
  if (CAM.fait || !(d > 0)) return;
  CAM.degats += d;
  const k = CAM.degats / CAM.pv;
  if (CAM.etat === 'neuf' && k >= 0.5) { CAM.etat = 'fume'; }
  if (CAM.etat === 'fume' && k >= 0.75) { CAM.etat = 'flammes'; camSonFeu(1); }
  if (k >= 1) camDetruire();
}
/* Destruction : explosion sans dégâts ni secousse, pièces, bâche, épave noircie qui brûle ; la récompense. */
function camDetruire() {
  CAM.fait = true; CAM.etat = 'detruit'; CAM.t = 0;
  const c = new THREE.Vector3(0, 1.4, 1.0).applyMatrix4(CAM.mat);
  Sound.explosion({ x: c.x, y: c.y, z: c.z }, 1.6);
  camSonExplosion(c);
  FX.boomLight.position.set(c.x, c.y + 1, c.z); FX.boomLight.color.setHex(0xff8a3a);
  FX.boomLight.decay = 1.2; FX.boomLight.intensity = 14; FX.boomT = 0.6;
  for (let i = 0; i < 40; i++) { const a = rand(0, TAU), v = rand(3, 11); FX.sparks.emit(c.x, c.y, c.z, Math.cos(a) * v, rand(2, 9), Math.sin(a) * v, rand(0.4, 1.2), 1, 0.7, 0.3); }
  for (let i = 0; i < 30; i++) FX.embers.emit(c.x + rand(-1, 1), c.y + rand(0, 1), c.z + rand(-1, 1), rand(-2, 2), rand(2, 6), rand(-2, 2), rand(1, 2.5), 1, 0.55, 0.2);
  // pièces qui volent : morceaux de capot, de portières, de ridelles, de bâche
  for (let i = 0; i < 14; i++) {
    const a = rand(0, TAU), v = rand(3, 9), mat = MAT.rubble;   // matière du jeu sans couleurs de sommets (les débris n'en ont pas)
    spawnDebris(mat, rand(0.2, 0.7), rand(0.04, 0.12), rand(0.2, 0.8), c.x + rand(-0.8, 0.8), c.y + rand(0, 1), c.z + rand(-1.2, 1.2), Math.cos(a) * v, rand(4, 11), Math.sin(a) * v, rand(3, 5));
  }
  if (CAM.bache) CAM.bache.visible = false;
  if (CAM.vitres) CAM.vitres.visible = false;
  camNoircir(1);
  camBoule(c);
  camReussite();
}
/* Couleurs des sommets vers le noir de suie (k = 1 : épave brûlée), ou d'origine (k = 0). */
function camNoircir(k) {
  if (!CAM.couleurs) return;
  for (const [attr, orig] of CAM.couleurs) {
    const a = attr.array;
    for (let i = 0; i < a.length; i += 3) {
      const g = (orig[i] + orig[i + 1] + orig[i + 2]) / 3;
      a[i] = lerp(orig[i], 0.018 + g * 0.08, k); a[i + 1] = lerp(orig[i + 1], 0.014 + g * 0.06, k); a[i + 2] = lerp(orig[i + 2], 0.012 + g * 0.05, k);
    }
    attr.needsUpdate = true;
  }
}
/* Récompense (même image que la destruction) : son, puis les deux bonus près du joueur. */
function camReussite() {
  camSonReussite();
  if (typeof secretDecouvert === 'function') secretDecouvert('b7-camion');   // écran « Secrets » de l'Interface (2.0.7)
  const [a, b] = horlPlaces();
  if (atgLibres().length) atgPoser(a.x, a.z, a.gy, CAM.vie);
  spawnPowerup('ammo', b.x, b.z, b.gy); Powerups.list[Powerups.list.length - 1].life = CAM.vie;
}

/* ------------------------------------------------------------------ Fumée et feu --- */
/* Sprites à lui (fumée : normale ; flammes et lueur : additives), dans le groupe des abords ; aucun programme nouveau
   (les mêmes matières que les fumées et les flammes du jeu). */
function camSprites() {
  const g = new THREE.Group(); g.name = 'camion-feu';
  const L = [];
  for (let i = 0; i < 26; i++) {
    const add = i >= 14, s = new THREE.Sprite(new THREE.SpriteMaterial({ map: add ? TEX.flare : TEX.smoke, transparent: true, depthWrite: false, opacity: 0, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.visible = false; g.add(s); L.push({ s, add, life: 0, max: 1, vy: 0, size: 1, op: 0.5 });
  }
  const lueur = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff7a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  lueur.visible = false; g.add(lueur);
  CAM.racine.add(g);
  g.matrixAutoUpdate = true;
  // le groupe du camion porte sa matrice dans ses sommets : les sprites sont placés dans le monde (racine à l'origine)
  CAM.sprites = { g, L, lueur };
}
function camPuff(x, y, z, size, life, vy, add, color, op) {
  const S = CAM.sprites; if (!S) return;
  const p = S.L.find((q) => q.add === add && q.life <= 0) || S.L.filter((q) => q.add === add)[0];
  p.life = life; p.max = life; p.vy = vy; p.size = size; p.op = op;
  p.s.material.color.setHex(color); p.s.material.rotation = rand(0, TAU);
  p.s.position.set(x, y, z); p.s.scale.set(size, size, 1); p.s.visible = true;
}
/* Chaque image (updateFeatures) : fumée à 50 %, flammes à 25 %, épave en feu puis qui fume. */
function camMaj(dt) {
  const S = CAM.sprites;
  if (!S || !CAM.racine) return;
  const loc = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(CAM.mat);
  CAM.t += dt;
  const e = CAM.etat;
  if (e !== 'neuf') {
    CAM.fumT -= dt;
    if (CAM.fumT <= 0) {
      const brule = e === 'detruit' && CAM.t < CAM.feu;
      CAM.fumT = e === 'fume' ? 0.45 : brule ? 0.16 : e === 'detruit' ? 0.5 : 0.25;
      const p = e === 'detruit' ? loc(rand(-0.6, 0.6), 2.0, rand(-2.5, 2.4)) : loc(rand(-0.3, 0.3), 1.75, rand(2.4, 3.1));
      const gris = e === 'fume' ? 0x5a5650 : 0x2a2724;
      camPuff(p.x, p.y, p.z, rand(1.0, 1.8) * (e === 'detruit' ? 1.5 : 1), rand(3, 5), rand(0.8, 1.5), false, gris, e === 'fume' ? 0.35 : 0.55);
    }
  }
  const flammes = e === 'flammes' || (e === 'detruit' && CAM.t < CAM.feu);
  if (flammes) {
    CAM.feuT -= dt;
    if (CAM.feuT <= 0) {
      CAM.feuT = e === 'flammes' ? 0.1 : 0.06;
      const p = e === 'flammes' ? loc(rand(-0.35, 0.35), 1.72, rand(2.3, 3.2)) : loc(rand(-0.9, 0.9), rand(1.1, 2.4), rand(-3, 3));
      const k = e === 'detruit' ? clamp(1.2 - CAM.t / CAM.feu, 0.3, 1) : 0.7;
      camPuff(p.x, p.y, p.z, rand(0.5, 1.1) * (e === 'detruit' ? 1.4 : 1) * k, rand(0.35, 0.7), rand(1.2, 2.2), true, Math.random() < 0.5 ? 0xff7a2a : 0xffb347, 0.85 * k);
      if (Math.random() < 0.3) FX.embers.emit(p.x, p.y, p.z, rand(-0.5, 0.5), rand(1.5, 3.5), rand(-0.5, 0.5), rand(0.8, 1.6), 1, 0.55, 0.2);
    }
    const c = e === 'flammes' ? loc(0, 1.9, 2.8) : loc(0, 1.8, 0.3), k = e === 'detruit' ? clamp(1.2 - CAM.t / CAM.feu, 0, 1) : 0.6;
    S.lueur.visible = true; S.lueur.position.copy(c);
    const f = (0.8 + 0.2 * Math.sin(G.time * 6) * Math.sin(G.time * 2.3)) * k;   // composantes à 0,6 et 1,3 Hz (règle des flashs)
    S.lueur.material.opacity = 0.55 * f; S.lueur.scale.setScalar((e === 'detruit' ? 7 : 3.5) * (0.9 + 0.1 * f));
    CAM.sonT -= dt;
    if (CAM.sonT <= 0) { CAM.sonT = rand(0.15, 0.35); camSonFeu(k); }
  } else S.lueur.visible = false;
  for (const p of S.L) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    const u = 1 - p.life / p.max;
    p.s.position.y += p.vy * dt;
    const sz = p.size * (1 + u * (p.add ? 0.6 : 2.2));
    p.s.scale.set(sz, sz, 1);
    p.s.material.opacity = p.op * (p.add ? (1 - u) : Math.sin(Math.PI * Math.min(1, u * 1.4 + 0.05)) * (1 - u));
  }
}
/* Boule de feu de l'explosion : flammes et fumée lourde, d'un coup. */
function camBoule(c) {
  for (let i = 0; i < 12; i++) camPuff(c.x + rand(-1.4, 1.4), c.y + rand(0, 1.6), c.z + rand(-1.8, 1.8), rand(1.8, 3.2), rand(0.5, 0.9), rand(1, 3), true, i % 2 ? 0xff8a2a : 0xffc060, 0.95);
  for (let i = 0; i < 10; i++) camPuff(c.x + rand(-1.5, 1.5), c.y + rand(0.5, 2.5), c.z + rand(-2, 2), rand(2.2, 3.6), rand(3.5, 6), rand(0.8, 1.8), false, 0x1e1b18, 0.7);
}

/* ------------------------------------------------------------------ Remise à zéro --- */
/* (resetFeatures) : camion neuf ; couleurs, bâche, vitres rendues ; fumées éteintes. */
function camRemettre() {
  CAM.etat = 'neuf'; CAM.degats = 0; CAM.t = 0; CAM.fait = false; CAM.fumT = 0; CAM.feuT = 0; CAM.sonT = 0;
  if (CAM.bache) CAM.bache.visible = true;
  if (CAM.vitres) CAM.vitres.visible = true;
  camNoircir(0);
  if (CAM.sprites) { for (const p of CAM.sprites.L) { p.life = 0; p.s.visible = false; } CAM.sprites.lueur.visible = false; }
}

/* ------------------------------------------------------------------ Sons (Sound.synthe) --- */
function camSonImpact(x, z) {
  const S = Sound.synthe && Sound.synthe(); if (!S || Math.random() < 0.5) return;
  const o = S.out({ x, z }, 0.35, 8); if (!o) return;
  const t = S.ctx.currentTime + Math.hypot(x - player.pos.x, z - player.pos.z) / 343;
  S.noiseHit(t, 0.05, 0.5, 'bandpass', rand(1800, 3200), null, 5, o, 0.001);
  S.tone('triangle', rand(700, 1100), rand(500, 800), t, 0.12, 0.08, o, 0.002);
}
function camSonFeu(k) {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const c = new THREE.Vector3(0, 1.5, 1).applyMatrix4(CAM.mat), o = S.out({ x: c.x, z: c.z }, 0.3 * k, 10); if (!o) return;
  const t = S.ctx.currentTime;
  for (let i = 0; i < 3; i++) S.noiseHit(t + i * rand(0.02, 0.06), rand(0.02, 0.05), rand(0.2, 0.5), 'bandpass', rand(1200, 3500), null, 2, o, 0.001);
  S.noiseHit(t, 0.4, 0.25, 'lowpass', 400, 200, 0.7, o, 0.05);
}
function camSonExplosion(c) {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const o = S.out({ x: c.x, z: c.z }, 1, 14); if (!o) return;
  const t = S.ctx.currentTime + Math.hypot(c.x - player.pos.x, c.z - player.pos.z) / 343;
  S.noiseHit(t, 1.8, 0.9, 'lowpass', 1800, 90, 0.7, o, 0.003);
  S.tone('sine', 70, 30, t, 1.4, 0.6, o, 0.005);
  for (let i = 0; i < 6; i++) S.noiseHit(t + 0.25 + i * rand(0.08, 0.2), rand(0.1, 0.3), rand(0.2, 0.4), 'bandpass', rand(800, 2600), null, 3, o, 0.002);   // tôles qui retombent
}
function camSonReussite() {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const t = S.ctx.currentTime + 0.9, o = S.out(null, 0.3); if (!o) return;
  S.bell(t, 783.99, 0.2, o, 0.9);
  S.bell(t + 0.16, 1046.5, 0.22, o, 1.3);
}
