/* ========================================================================== 33 DÉBRIS ==
   Débris payants des cartes en grille (portes « debris » ; dans Bunker 7 : Salle d'arrivée ↔ Infirmerie, 1 000 points,
   et Infirmerie ↔ Salle des machines, 1 250 points ; demande d'Anthony du 4 novembre 2026, pour le jeu 2.0.7). Un amas de pierres et de rochers bouche le passage. Payé,
   le joueur y pose une charge : elle se colle à l'amas (DEB.pose), bipe de plus en plus vite (DEB.meche), puis saute.
   Les rochers volent et disparaissent, le passage s'ouvre (openDoor : cases, zones, statistiques) ; des traces de
   brûlure restent au sol et sur les murs autour du passage, jusqu'à la partie suivante.
   · Ouverture sans charge (phase 5 du boss, __zs.openAll) : l'explosion seule ; partie restaurée : les traces seules.
   · Aucun dégât (joueur, zombies), aucune secousse de caméra (vertige d'Anthony).
   · Aucune lampe ajoutée : l'éclair est celui des explosions (FX.boomLight, déjà dans la scène). three r128 recompile
     chaque matière quand le nombre de lampes change (gels mesurés par la session d'intégration).
   · Amas : une maille par matière (3 appels de dessin par porte), rochers taillés une fois par page, même forme à
     chaque chargement (générateur local : le hasard du jeu n'est pas touché) ; DEB.eclats rochers volent à l'explosion.
   · Traces : une suie dessinée par le module (debSuie), sur le sol et sur les murs seulement là où la grille a un mur
     dont la face se voit.
   · Couleurs données en sRGB : converties une fois avec le monde (linearizeTree, buildWorld).
   Points d'accroche : tools/hooks-debris.py (construction, achat, ouverture et sa poussière, remise à zéro, chaque
   image, sauvegarde, bips placés dans l'espace : Sound.keypad(kind, pos)).
   ============================================================================ */
const DEB = {
  pose: 0.3,                                    // s : la charge se colle à l'amas
  meche: 2.5,                                   // s : puis elle bipe, de plus en plus vite, et saute
  eclats: 18,                                   // rochers qui volent (l'amas lui-même disparaît dans l'explosion)
  verbe: 'faire sauter les débris',             // texte de l'achat, à la place de celui d'origine (« dégager les débris »)
  geos: null, mats: null,                       // rochers taillés et matières, partagés par toutes les portes
};
const _debV = new THREE.Vector3(), _debW = new THREE.Vector3();

/* Rochers taillés (6 formes) et matières, une fois par page. */
function debRessources() {
  if (DEB.geos) return;
  const R = mulberry32(4091);
  DEB.geos = [];
  for (let g = 0; g < 6; g++) {
    const geo = new THREE.IcosahedronGeometry(1, g < 2 ? 0 : 1), P = geo.attributes.position, ecarts = new Map();
    const sx = 0.75 + R() * 0.5, sy = 0.55 + R() * 0.4, sz = 0.75 + R() * 0.5;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), cle = `${Math.round(x * 999)},${Math.round(y * 999)},${Math.round(z * 999)}`;
      let k = ecarts.get(cle);
      if (k == null) { k = 0.8 + R() * 0.36; ecarts.set(cle, k); }   // un sommet commun à plusieurs faces : le même écart
      P.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
    }
    geo.computeVertexNormals();                 // polyèdre de three sans sommets partagés : des facettes, comme une pierre
    geo.computeBoundingSphere();
    DEB.geos.push(share(geo));                  // partagées : gardées d'une carte à l'autre (disposeWorld les laisse)
  }
  const std = (o) => share(new THREE.MeshStandardMaterial(o));       // partagées, comme les rochers
  // pas d'alphaTest : il entre dans la clé du programme de three (un shader de plus, compilé à la première explosion) ;
  // sans lui, la suie partage le programme des rochers, déjà compilé
  const suie = (o) => std(Object.assign({ transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, o));
  DEB.mats = {
    // béton et pierre grise du bunker (textures de la bibliothèque), trois teintes
    roches: [['concrete_cracked', 0xe2ded6], ['concrete_cracked', 0xb9b4ab], ['concrete_dark', 0xf2eee8]].map(([t, c]) => std({ map: levelTexture(t), color: c, roughness: 0.96 })),
    pain: std({ color: 0x5f5d3a, roughness: 0.85 }),                 // explosif
    ruban: std({ color: 0x1d1d1f, roughness: 0.6 }),
    boitier: std({ color: 0x2c2f33, roughness: 0.5, metalness: 0.3 }),
    etiquette: std({ color: 0xd9d2b6, roughness: 0.9 }),
    filR: std({ color: 0xb3221c, roughness: 0.5 }), filB: std({ color: 0x1f4fa8, roughness: 0.5 }),
    ledEteinte: std({ color: 0x3a0806, roughness: 0.4 }),
    ledAllumee: share(new THREE.MeshBasicMaterial({ color: 0xff2a14 })),
    trace: suie({ map: debSuie(false) }),       // suie : tache entière (sol, tableaux, linteau)
    traceBord: suie({ map: debSuie(true) }),    // suie : demi-tache, le bord gauche de l'image contre l'ouverture (murs à côté)
  };
}

/* Texture de suie : taches douces superposées (denses au centre, bord irrégulier), traînées du souffle, grains ;
   demi : la moitié droite seulement, le centre de la tache sur le bord gauche de l'image. */
function debSuie(demi) {
  const W = demi ? 256 : 512, H = 512, cx = demi ? 0 : 256, cy = 256, c = makeCanvas(W, H), g = c.getContext('2d'), R = mulberry32(demi ? 7213 : 7121);
  const tache = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(13,10,8,${a})`); gr.addColorStop(1, 'rgba(13,10,8,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
  for (let i = 0; i < 320; i++) {
    const a = R() * TAU, r = Math.pow(R(), 0.75) * 190;
    tache(cx + Math.cos(a) * r, cy + Math.sin(a) * r, (18 + R() * 46) * (1.15 - r / 256), 0.13 + R() * 0.1);
  }
  tache(cx, cy, 150, 0.85);
  tache(cx, cy, 70, 0.6);
  for (let i = 0; i < 30; i++) {                // traînées : fuseaux doux, du cœur vers le bord
    const a = R() * TAU, l = 120 + R() * 120, e = 3 + R() * 7;
    g.save(); g.translate(cx, cy); g.rotate(a);
    const gl = g.createLinearGradient(40, 0, l, 0);
    gl.addColorStop(0, 'rgba(11,9,7,0.32)'); gl.addColorStop(1, 'rgba(11,9,7,0)');
    g.fillStyle = gl; g.beginPath(); g.moveTo(40, -e); g.lineTo(l, 0); g.lineTo(40, e); g.closePath(); g.fill();
    g.restore();
  }
  for (let i = 0; i < 700; i++) {               // grains de suie et petits éclats
    const a = R() * TAU, r = 60 + R() * 180;
    g.fillStyle = `rgba(12,10,8,${0.12 + R() * 0.4})`;
    g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.6 + R() * 2.4, 0, TAU); g.fill();
  }
  g.globalCompositeOperation = 'destination-in'; // fondu jusqu'au bord : rien ne s'arrête net
  const gf = g.createRadialGradient(cx, cy, 150, cx, cy, 255);
  gf.addColorStop(0, 'rgba(0,0,0,1)'); gf.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gf; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  if (typeof renderer !== 'undefined' && renderer && renderer.initTexture) renderer.initTexture(t);   // envoyée tout de suite
  return share(t);
}

/* Repère d'une porte : u le long du passage, y vers le haut depuis son sol, v à travers (côté positif : +z ou +x). */
function debMonde(D, u, y, v) {
  return D.alongX ? new THREE.Vector3(D.cx + u, D.E + y, D.cz + v) : new THREE.Vector3(D.cx + v, D.E + y, D.cz - u);
}
function debCase(d, D, u, v) {                  // type de la case de la grille sous le point (u, v) de la porte
  const p = debMonde(D, u, 0, v), x = Math.floor(p.x), z = Math.floor(p.z);
  return inb(x, z) ? grid[d.li * GN + z * GW + x] : T.VOID;
}

/* Construction (buildDoors, porte « debris ») : l'amas, la charge, les éclats et les traces, cachés jusqu'à l'achat. */
function debConstruire(d, alongX, width, E, id) {
  debRessources();
  // axe du passage : buildDoors prend le plus long côté de la porte ; une porte d'une case, ou plus profonde que large,
  // peut avoir l'autre : on garde celui qui a des murs de part et d'autre de l'ouverture
  const xs = d.cells.map((k) => (k % GN) % GW), zs = d.cells.map((k) => ((k % GN) / GW) | 0);
  const ex = Math.max(...xs) - Math.min(...xs) + 1, ez = Math.max(...zs) - Math.min(...zs) + 1;
  const murs = (ax, w) => { const A = { alongX: ax, E, cx: d.cx, cz: d.cz }; let n = 0; for (const g of [-1, 1]) if (debCase(d, A, g * (w / 2 + 0.5), 0) === T.WALL) n++; return n; };
  const n0 = murs(alongX, width), w1 = alongX ? ez : ex;
  if (n0 < 2 && murs(!alongX, w1) > n0) { alongX = !alongX; width = w1; }
  const prof = alongX ? ez : ex, o = (prof - 1) / 2;   // profondeur du passage (cases) ; o : demi-profondeur en plus d'une case
  const M = DEB.mats, R = mulberry32(((((CUR.map && CUR.map.seed) || 7) * 977) + (id | 0) * 7919 + 13) >>> 0);
  const D = { alongX, width, prof, o, vc: o + 0.66, v0: o + 1.15, E, cx: d.cx, cz: d.cz, t: -1, s: 1, u: 0, bip: 0, ledT: 0, arme: false, vol: 0, origine: null, marques: false };
  const cadre = D.cadre = new THREE.Group();
  cadre.position.set(d.cx, E, d.cz);
  cadre.rotation.y = alongX ? 0 : Math.PI / 2;
  d.group.add(cadre);
  // amas : deux faces de rochers serrés (v = ±0,3, plus la demi-profondeur en plus) jusqu'au linteau, gros en bas, plus
  // petits en haut ; un cœur qui bouche les jours ; des pierres plates sous le linteau ; au pied, des deux côtés, des
  // rochers éboulés et des cailloux
  const hw = width / 2, lots = [[], [], []], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const roc = (u, y, v, r, sy = 1) => {
    e.set(sy === 1 ? R() * TAU : (R() - 0.5) * 0.4, R() * TAU, sy === 1 ? R() * TAU : (R() - 0.5) * 0.4); q.setFromEuler(e);
    m4.compose(_debV.set(u, y, v), q, _debW.set(r, r * sy, r));
    lots[(R() * 3) | 0].push({ geo: DEB.geos[(R() * 6) | 0], matrix: m4.clone() });
  };
  const rangee = (a, b, pas, f) => { const n = Math.max(1, Math.round((b - a) / pas)); for (let i = 0; i <= n; i++) f(lerp(a, b, i / n)); };   // de bord à bord
  for (let y = 0.22; y < DOOR_H - 0.2; y += 0.3) {
    const r0 = lerp(0.36, 0.2, y / 2.5);
    for (const s of [-1, 1]) rangee(-hw + 0.12, hw - 0.12, r0 * 1.35, (u) => roc(u + (R() - 0.5) * 0.08, y + (R() - 0.5) * 0.08, s * (o + 0.3 + R() * 0.08), r0 * (0.85 + R() * 0.35)));
    for (let v = -o; v <= o + 1e-6; v += Math.max(0.45, o || 1)) rangee(-hw + 0.25, hw - 0.25, 0.5, (u) => roc(u + (R() - 0.5) * 0.1, y, v + (R() - 0.5) * 0.15, r0 * 1.1));
  }
  // sous le linteau : pierres plates qui y mordent un peu (le dessous du linteau les cache) : aucun jour
  // (deux rangées serrées à v = ±0,1 : elles ne débordent pas des faces du linteau, à v = ±0,5)
  rangee(-(o + 0.1), o + 0.1, 0.4, (v) => rangee(-hw + 0.14, hw - 0.14, 0.2, (u) => roc(u, DOOR_H - 0.06, v, 0.2 + R() * 0.04, 0.7)));
  for (const s of [-1, 1]) {
    for (let u = -hw - 0.05; u <= hw + 0.05; u += 0.4) roc(u + (R() - 0.5) * 0.2, 0.16 + R() * 0.1, s * (o + 0.6 + R() * 0.1), 0.18 + R() * 0.1);
    for (let u = -hw; u <= hw; u += 0.5) if (R() < 0.75) roc(u + (R() - 0.5) * 0.3, 0.5 + R() * 0.2, s * (o + 0.52 + R() * 0.06), 0.18 + R() * 0.08);
    for (let i = 0; i < 9; i++) roc((R() - 0.5) * (width + 0.6), 0.04, s * (o + 0.78 + R() * 0.4), 0.05 + R() * 0.06);
  }
  for (let i = 0; i < 3; i++) {
    if (!lots[i].length) continue;
    const m = new THREE.Mesh(mergeGeometries(lots[i]), M.roches[i]);   // une maille par matière
    cadre.add(m);
    d.pieces.push({ m, pos: m.position.clone(), rot: m.rotation.clone(), scale: m.scale.clone(), vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0 });
  }
  // charge : pain d'explosif tenu par deux rubans, étiquette, détonateur à diode, deux fils ; face avant vers +v
  const bombe = D.bombe = new THREE.Group();
  const piece = (mat, sx, sy, sz, x, y, z, geo = GEO.box) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); bombe.add(m); return m; };
  piece(M.pain, 0.3, 0.17, 0.08, 0, 0, 0.04);
  for (const x of [-0.09, 0.09]) piece(M.ruban, 0.035, 0.18, 0.09, x, 0, 0.04);
  piece(M.etiquette, 0.12, 0.05, 0.004, 0, -0.045, 0.082);
  piece(M.boitier, 0.1, 0.06, 0.035, 0.02, 0.035, 0.097);
  piece(M.ledEteinte, 0.016, 0.016, 0.01, 0.055, 0.045, 0.117);
  D.led = piece(M.ledAllumee, 0.018, 0.018, 0.012, 0.055, 0.045, 0.118);
  D.led.visible = false;
  piece(M.filR, 0.006, 0.13, 0.006, -0.045, 0.02, 0.1, GEO.cyl).rotation.z = 1.2;
  piece(M.filB, 0.006, 0.13, 0.006, -0.035, 0.0, 0.1, GEO.cyl).rotation.z = 1.4;
  bombe.visible = false;
  cadre.add(bombe);
  // éclats : dans le repère du monde (ils rebondissent sur les murs : debrisHit)
  D.eclats = [];
  for (let i = 0; i < DEB.eclats; i++) {
    const m = new THREE.Mesh(DEB.geos[i % 6], M.roches[i % 3]);
    m.visible = false;
    d.group.add(m);
    D.eclats.push({ m, vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: 0, t: -1, r: 0.2 });
  }
  // traces de brûlure : sol des deux côtés et du passage ; murs autour du passage, des deux côtés ; tableaux du passage ;
  // linteau (faces et dessous)
  D.traces = [];
  const trace = (w, h, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(GEO.plane, rz == null ? M.trace : M.traceBord);
    m.scale.set(w, h, 1); m.position.set(x, y, z); m.rotation.set(rx, ry, rz != null ? rz : w === h ? R() * TAU : R() < 0.5 ? 0 : Math.PI);   // rectangle : retourné seulement (reste dans ses bords)
    m.renderOrder = -1; m.visible = false;         // avant les autres transparents : feu, poussière, étincelles et impacts passent dessus
    cadre.add(m); D.traces.push(m);
  };
  const sol = (u, v) => { const t = debCase(d, D, u, v); return t !== T.VOID && !tallType(t); };
  const mur = (g, a = 0.5) => debCase(d, D, g * (hw + a), 0) === T.WALL;
  const face = (g, a, s) => mur(g, a) && !tallType(debCase(d, D, g * (hw + a), s * (o + 1))) && debCase(d, D, g * (hw + a), s * (o + 1)) !== T.VOID;   // face de mur bâtie
  trace(1.7 + 2 * o, 1.7 + 2 * o, 0, 0.012, 0, -Math.PI / 2, 0);
  for (const s of [-1, 1]) {
    // sol devant le passage : grande tache si le sol est plein autour, petite sinon
    let plein = true;
    for (const u of [-1, 0, 1]) for (const v of [0.7, 1.3, 1.9]) if (!sol(u * Math.min(1, hw), s * (o + v))) plein = false;
    if (plein) trace(2.4, 2.4, 0, 0.012, s * (o + 1.05), -Math.PI / 2, 0);
    else if (sol(0, s * (o + 0.8))) trace(1.3, 1.3, 0, 0.012, s * (o + 0.75), -Math.PI / 2, 0);
    // face du mur à côté du passage : contre le mur, depuis le bord du passage (1,5 m de large, 0,95 m si le mur s'arrête
    // ou si sa deuxième case n'a pas de face), seulement si la face est bâtie (rien de haut devant)
    for (const g of [-1, 1]) {
      if (!face(g, 0.5, s)) continue;
      const l = face(g, 1.3, s) ? 1.5 : 0.95;
      // bord gauche de l'image (centre de la tache) contre l'ouverture : retournée selon le côté du mur et la face
      trace(l, 2.3, g * (hw + 0.01 + l / 2), 1.15, s * (o + 0.512), 0, s > 0 ? 0 : Math.PI, s * g > 0 ? 0 : Math.PI);
    }
  }
  for (const g of [-1, 1]) if (mur(g)) trace(prof - 0.05, 1.6, g * (hw - 0.012), 1.0, 0, 0, g > 0 ? -Math.PI / 2 : Math.PI / 2);
  if (WALL_H > DOOR_H + 0.1) {
    const h = Math.min(0.8, WALL_H - DOOR_H);
    for (const s of [-1, 1]) if (sol(0, s * (o + 0.8))) trace(width + (mur(-1) && mur(1) ? 0.5 : 0), h, 0, DOOR_H + h / 2, s * (o + 0.512), 0, s > 0 ? 0 : Math.PI);
    trace(width - 0.1, prof - 0.1, 0, DOOR_H - 0.012, 0, Math.PI / 2, 0);
  }
  d.deb = D;
  d.charge = false;
  if (d.verb === DOOR_VERBS.debris) d.verb = DEB.verbe;
}

/* Achat : la charge se colle à l'amas, du côté du joueur, en face de lui (dans la largeur du passage). */
function debPoser(d) {
  const D = d.deb;
  D.cadre.updateMatrixWorld(true);
  _debV.copy(player.pos); D.cadre.worldToLocal(_debV);
  D.s = _debV.z >= 0 ? 1 : -1;
  D.u = clamp(_debV.x, -D.width / 2 + 0.4, D.width / 2 - 0.4);
  // surface de l'amas sous la charge : rayons vers l'amas (une fois par achat) ; la charge se colle au rocher le plus avancé
  const ray = new THREE.Raycaster(), dir = debMonde(D, 0, 0, -D.s).sub(debMonde(D, 0, 0, 0)).normalize(), tas = d.pieces.map((p) => p.m);
  let vc = -1;
  for (const du of [-0.12, 0, 0.12]) for (const y of [1.05, 1.12, 1.19]) {
    ray.set(debMonde(D, D.u + du, y, D.s * (D.o + 1.5)), dir); ray.far = D.o + 1.5;
    const h = ray.intersectObjects(tas, false)[0];
    if (h) vc = Math.max(vc, D.o + 1.5 - h.distance);
  }
  D.vc = clamp(vc < 0 ? D.o + 0.66 : vc - 0.005, D.o + 0.45, D.o + 0.8);
  D.v0 = clamp(Math.abs(_debV.z) - 0.25, D.vc + 0.05, D.vc + 0.5);   // départ de la charge : devant le joueur, jamais derrière la caméra
  D.t = 0; D.bip = 0; D.ledT = 0; D.arme = false;
  d.charge = true;
  D.bombe.visible = true;
  D.bombe.rotation.set(0, D.s > 0 ? 0 : Math.PI, (Math.random() - 0.5) * 0.25);
  debPoseBombe(D, 0);
  Sound.boardPlace(debMonde(D, D.u, 1.12, D.s * D.vc));
}
function debPoseBombe(D, k) {                   // k de 0 (dans la main) à 1 (collée à l'amas)
  const e = smooth(clamp(k, 0, 1));
  D.bombe.position.set(D.u, lerp(1.32, 1.12, e), D.s * lerp(D.v0, D.vc, e));
  D.bombe.scale.setScalar(lerp(0.7, 1, e));
}

/* Chaque image (updateDoors) : charges posées (bips, diode, explosion), éclats en vol, traces d'une partie restaurée. */
function debMaj(dt) {
  for (const id in World.doors) {
    const d = World.doors[id], D = d.deb;
    if (!D) continue;
    if (d.charge) {
      if (d.opened) { d.charge = false; D.bombe.visible = false; D.led.visible = false; continue; }   // ouverte entre-temps
      D.t += dt;
      if (D.t < DEB.pose) debPoseBombe(D, D.t / DEB.pose);
      else {
        debPoseBombe(D, 1);
        const f = (D.t - DEB.pose) / DEB.meche;
        if (f >= 1) {
          d.charge = false;
          D.origine = debMonde(D, D.u, 1.16, D.s * (D.vc + 0.06));
          openDoor(d);                          // ouverture habituelle, puis l'explosion (point d'accroche d'openDoor)
          continue;
        }
        if (!D.arme) { D.arme = true; D.ici = debMonde(D, D.u, 1.12, D.s * (D.vc + 0.04)); Sound.keypad('ok', D.ici); D.bip = 0.35; }   // armée : double bip
        D.bip -= dt;
        if (D.bip <= 0) { Sound.keypad('key', D.ici); D.ledT = 0.07; D.bip = lerp(0.42, 0.07, f * f); }
        D.ledT -= dt;
        D.led.visible = D.ledT > 0;
      }
    }
    if (D.vol > 0) debEclats(D, dt);
    if (d.opened && !D.marques) debTraces(D, true);     // partie restaurée : passage ouvert, traces sans explosion
  }
}

/* Explosion (openDoor d'une porte « debris ») : à la charge, ou au cœur de l'amas sans charge. */
function debExplosion(d) {
  const D = d.deb, o = D.origine || (d.charge ? debMonde(D, D.u, 1.16, D.s * (D.vc + 0.06)) : debMonde(D, 0, 1.1, 0)), big = 1.25;   // à la charge, ou au cœur de l'amas
  D.origine = null;
  d.charge = false;
  D.bombe.visible = false; D.led.visible = false;
  for (const p of d.pieces) p.m.visible = false;
  Sound.explosion(o, big);
  const L = FX.boomLight;                       // l'éclair des explosions, déjà dans la scène : aucune lampe ajoutée
  L.position.set(o.x, o.y + 0.3, o.z);
  L.decay = lightBandDecay(L.position.y, levelAtY(D.E + 0.1));
  L.color.setHex(0xff8a3a);
  L.intensity = 6 * big; FX.boomT = 0.35;
  for (let i = 0; i < 6; i++) spawnPuff(o.x + rand(-0.4, 0.4), o.y + rand(-0.3, 0.5), o.z + rand(-0.4, 0.4), rand(1.2, 2), rand(0.25, 0.45), 0xffa040, 0.9, 0.6, true, TEX.flare);
  for (let i = 0; i < 8; i++) {                 // poussière : un nuage qui remplit le passage, des deux côtés
    const p = debMonde(D, rand(-D.width / 2, D.width / 2), rand(0.2, 2.1), (i % 2 ? 1 : -1) * rand(0.4, 2));
    spawnPuff(p.x, p.y, p.z, rand(1.2, 2.4), rand(1.6, 3), 0x3a3632, 0.5, rand(0.2, 0.6));   // la fumée des explosions du jeu
  }
  for (let i = 0; i < 40; i++) { const a = rand(0, TAU), s = rand(2, 8); FX.sparks.emit(o.x, o.y, o.z, Math.cos(a) * s, rand(1, 6), Math.sin(a) * s, rand(0.3, 0.9), 1, 0.62, 0.25); }
  for (const e of D.eclats) {                   // rochers soufflés loin de la charge
    const p = debMonde(D, rand(-D.width / 2 + 0.2, D.width / 2 - 0.2), rand(0.3, 2.2), rand(-(D.o + 0.45), D.o + 0.45));
    e.r = rand(0.12, 0.3); e.t = 0;
    e.m.position.copy(p); e.m.scale.setScalar(e.r); e.m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)); e.m.visible = true;
    _debW.subVectors(p, o); _debW.y = Math.max(_debW.y, 0) + 0.4; _debW.normalize();
    const v = rand(4, 10);
    e.vx = _debW.x * v + rand(-1, 1); e.vy = _debW.y * v * 0.4 + rand(1, 3); e.vz = _debW.z * v + rand(-1, 1);
    e.ax = rand(-8, 8); e.ay = rand(-8, 8); e.az = rand(-8, 8);
  }
  D.vol = 2.4;
  for (let i = 0; i < 16; i++) {                // gravillons
    const p = debMonde(D, rand(-D.width / 2 + 0.2, D.width / 2 - 0.2), rand(0.4, 2), rand(-0.3, 0.3)), s = rand(0.06, 0.16), v = rand(3, 8);
    _debW.subVectors(p, o).normalize();
    spawnDebris(MAT.rubble, s, s * 0.8, s, p.x, p.y, p.z, _debW.x * v, rand(2, 5), _debW.z * v, rand(1.5, 3));
  }
  debTraces(D, true);
}
function debEclats(D, dt) {
  D.vol -= dt;
  for (const e of D.eclats) {
    const m = e.m;
    if (!m.visible) continue;
    e.t += dt;
    e.vy -= 12 * GRAV.k * dt;
    let nx = m.position.x + e.vx * dt, nz = m.position.z + e.vz * dt;
    if (debrisHit(nx, m.position.y, m.position.z, m.position.x, m.position.z)) { e.vx *= -0.4; nx = m.position.x; }
    if (debrisHit(m.position.x, m.position.y, nz, m.position.x, m.position.z)) { e.vz *= -0.4; nz = m.position.z; }
    m.position.x = nx; m.position.z = nz; m.position.y += e.vy * dt;
    // rebond sous le plafond, ou sous le linteau tant que le rocher est dans le passage
    const lu = D.alongX ? m.position.x - D.cx : D.cz - m.position.z, lv = D.alongX ? m.position.z - D.cz : m.position.x - D.cx;
    const sol = (NL > 1 ? floorBelow(m.position.x, m.position.z, m.position.y + 0.3) : D.E) + e.r * 0.6, plafond = D.E + (Math.abs(lv) < D.prof / 2 + e.r && Math.abs(lu) < D.width / 2 ? DOOR_H : WALL_H) - e.r * 0.6;
    if (m.position.y > plafond) { m.position.y = plafond; e.vy = -Math.abs(e.vy) * 0.3; }
    if (m.position.y < sol) { m.position.y = sol; e.vy = Math.abs(e.vy) * 0.25; e.vx *= 0.6; e.vz *= 0.6; e.ax *= 0.6; e.az *= 0.6; }
    m.rotation.x += e.ax * dt; m.rotation.y += e.ay * dt; m.rotation.z += e.az * dt;
    if (e.t > 1.2) m.scale.setScalar(e.r * Math.max(0.02, 1 - (e.t - 1.2) / 0.9));
    if (e.t > 2.1) m.visible = false;
  }
}
function debTraces(D, oui) {
  for (const m of D.traces) m.visible = oui;
  D.marques = oui;
}

/* Remise à zéro (resetFeatures : nouvelle partie, menu) : amas en place (remis avec les pièces), plus de charge, d'éclat
   ni de trace. */
function debRemettre(d) {
  d.charge = false;
  const D = d.deb;
  if (!D) return;
  D.t = -1; D.arme = false; D.vol = 0; D.origine = null;
  D.bombe.visible = false; D.led.visible = false;
  for (const e of D.eclats) e.m.visible = false;
  debTraces(D, false);
}
