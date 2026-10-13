/* ------------------------------------------------------ Kit de construction --
   Bâtiments des lieux (camp, relais, village, centrale, hangars, tombeaux) : chaque pièce posée
   écrit à la fois sa géométrie (fusionnée par matière, coordonnées de texture en mètres, raccord
   d'une boîte à l'autre) et ses cases dans la grille des solides (collisions, rayons, zombies).
   Bâtiments alignés sur les axes (les cases font 1 m). Textures du désert ajoutées à la
   bibliothèque du jeu (crépi chaulé, brique crue, béton, tôle, grès, roche, toile, planches). */
(function khTextures() {
  defTex('kh_mudbrick', 'Brique crue (Khamsin)', 'brique', { size: [2, 2] }, tgBrick({ tile: 2, colors: [[188, 150, 112], [180, 142, 104], [196, 158, 118]], bw: 0.38, bh: 0.13, mortar: 0.016, mortarColor: [164, 130, 96], paint: [222, 204, 170], peel: 0.22, stains: 4 }));
  defTex('kh_whitewash', 'Crépi chaulé (Khamsin)', 'beton', { size: [2, 2] }, tgPlaster({ color: [228, 216, 192], rough: true, chips: 0.1, under: [196, 166, 128], cracks: 3, drips: 4, stains: 3 }));
  defTex('kh_ochre', 'Enduit ocre (Khamsin)', 'beton', { size: [2, 2] }, tgPlaster({ color: [204, 162, 112], rough: true, chips: 0.08, under: [170, 130, 90], cracks: 2, stains: 3 }));
  defTex('kh_concrete', 'Béton clair (Khamsin)', 'beton', { size: [3, 3] }, tgConcrete({ base: [184, 178, 166], form: 3, stains: 4, cracks: 2 }));
  defTex('kh_sheet', 'Tôle ondulée (Khamsin)', 'metal', { size: [2, 2], rough: 0.55, metal: 0.35 }, tgCorrugated({ tile: 2, color: [182, 180, 172], rust: 0.1, seams: true, pitch: 0.18 }));
  defTex('kh_sheet_red', 'Tôle peinte (Khamsin)', 'metal', { size: [2, 2], rough: 0.6, metal: 0.25 }, tgCorrugated({ tile: 2, color: [160, 74, 50], rust: 0.15, seams: true, pitch: 0.18 }));
  defTex('kh_sandstone', 'Grès appareillé (Khamsin)', 'brique', { size: [3, 3] }, tgBrick({ tile: 3, colors: [[200, 172, 130], [190, 162, 122], [210, 182, 140]], bw: 1.1, bh: 0.55, mortar: 0.01, mortarColor: [156, 132, 100], stains: 5 }));
  defTex('kh_rock', 'Roche des falaises (Khamsin)', 'brique', { size: [4, 4] }, tgConcrete({ base: [170, 132, 100], stains: 10, cracks: 14 }));
  defTex('kh_canvas', 'Toile de tente (Khamsin)', 'papier', { size: [2, 2], rough: 0.95 }, tgPlaster({ color: [214, 198, 160], rough: false, stains: 7, cracks: 0, drips: 2 }));
  defTex('kh_planks', 'Planches (Khamsin)', 'bois', { size: [2, 2] }, tgPlanks({ tile: 2, color: [150, 112, 72], width: 0.18, stains: 6 }));
  defTex('kh_paint', 'Métal peint (Khamsin)', 'metal', { size: [2, 2], rough: 0.5, metal: 0.2 }, tgPlaster({ color: [222, 216, 204], rough: false, stains: 3, cracks: 0, drips: 4 }));
  defTex('kh_floor', 'Dallage poussiéreux (Khamsin)', 'sol', { size: [2, 2] }, tgConcrete({ base: [170, 150, 122], joints: true, stains: 8 }));
})();

const KIT_NAMES = new Set();
/* Nouveau chantier. Les pièces s'accumulent ; build(root) crée les maillages. */
function owKit(name) {
  const parts = new Map();            // matière → { pos, nor, uv, col }
  const extra = [];                   // objets déjà prêts (maillages animés, lampes…)
  const K = { name };
  const bucket = (tex) => {
    let b = parts.get(tex);
    if (!b) parts.set(tex, (b = { pos: [], nor: [], uv: [], col: [] }));
    return b;
  };
  const texSize = (tex) => (TEXLIB[tex] ? TEXLIB[tex].size : [2, 2]);
  /* Une face (4 coins dans l'ordre, sens trigonométrique vu de l'extérieur). */
  K.quad = (tex, hex, p0, p1, p2, p3, n, uvOf) => {
    const b = bucket(tex), c = vcol(hex), S = texSize(tex);
    for (const [a, q, r] of [[p0, p1, p2], [p0, p2, p3]]) {
      for (const p of [a, q, r]) {
        b.pos.push(p[0], p[1], p[2]); b.nor.push(n[0], n[1], n[2]); b.col.push(c[0], c[1], c[2]);
        const [u, v] = uvOf(p); b.uv.push(u / S[0], v / S[1]);
      }
    }
    return K;
  };
  /* Boîte alignée (x0 < x1…) ; faces : liste à omettre ('top', 'bottom', 'px', 'nx', 'pz', 'nz'). */
  K.box = (tex, hex, x0, y0, z0, x1, y1, z1, o = {}) => {
    const skip = o.skip || [], tTop = o.top || tex;
    if (!skip.includes('top')) K.quad(tTop, o.topHex || hex, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], (p) => [p[0], p[2]]);
    if (!skip.includes('bottom')) K.quad(tex, hex, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], (p) => [p[0], p[2]]);
    if (!skip.includes('pz')) K.quad(tex, hex, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], (p) => [p[0], p[1]]);
    if (!skip.includes('nz')) K.quad(tex, hex, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], (p) => [-p[0], p[1]]);
    if (!skip.includes('px')) K.quad(tex, hex, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], (p) => [-p[2], p[1]]);
    if (!skip.includes('nx')) K.quad(tex, hex, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], (p) => [p[2], p[1]]);
    return K;
  };
  /* Toit à deux pans (faîtage le long de x si alongX), pignons compris. */
  K.gable = (tex, hex, x0, z0, x1, z1, y0, rise, alongX = true, gableTex = null, gableHex = null) => {
    const ym = y0 + rise;
    if (alongX) {
      const zm = (z0 + z1) / 2, sl = Math.hypot(rise, zm - z0), ny = (zm - z0) / sl, nz = rise / sl;
      K.quad(tex, hex, [x0, y0, z1], [x1, y0, z1], [x1, ym, zm], [x0, ym, zm], [0, ny, nz], (p) => [p[0], Math.hypot(p[1] - y0, p[2] - z1)]);
      K.quad(tex, hex, [x1, y0, z0], [x0, y0, z0], [x0, ym, zm], [x1, ym, zm], [0, ny, -nz], (p) => [-p[0], Math.hypot(p[1] - y0, p[2] - z0)]);
      const gt = gableTex || tex, gh = gableHex || hex;
      K.tri(gt, gh, [x1, y0, z1], [x1, y0, z0], [x1, ym, zm], [1, 0, 0], (p) => [-p[2], p[1]]);
      K.tri(gt, gh, [x0, y0, z0], [x0, y0, z1], [x0, ym, zm], [-1, 0, 0], (p) => [p[2], p[1]]);
    } else {
      const xm = (x0 + x1) / 2, sl = Math.hypot(rise, xm - x0), ny = (xm - x0) / sl, nx = rise / sl;
      K.quad(tex, hex, [x1, y0, z1], [x1, y0, z0], [xm, ym, z0], [xm, ym, z1], [nx, ny, 0], (p) => [-p[2], Math.hypot(p[1] - y0, p[0] - x1)]);
      K.quad(tex, hex, [x0, y0, z0], [x0, y0, z1], [xm, ym, z1], [xm, ym, z0], [-nx, ny, 0], (p) => [p[2], Math.hypot(p[1] - y0, p[0] - x0)]);
      const gt = gableTex || tex, gh = gableHex || hex;
      K.tri(gt, gh, [x0, y0, z1], [x1, y0, z1], [xm, ym, z1], [0, 0, 1], (p) => [p[0], p[1]]);
      K.tri(gt, gh, [x1, y0, z0], [x0, y0, z0], [xm, ym, z0], [0, 0, -1], (p) => [-p[0], p[1]]);
    }
    return K;
  };
  K.tri = (tex, hex, a, b, c, n, uvOf) => {
    const B = bucket(tex), col = vcol(hex), S = texSize(tex);
    for (const p of [a, b, c]) { B.pos.push(p[0], p[1], p[2]); B.nor.push(n[0], n[1], n[2]); B.col.push(col[0], col[1], col[2]); const [u, v] = uvOf(p); B.uv.push(u / S[0], v / S[1]); }
    return K;
  };
  /* Géométrie quelconque (BufferGeometry) placée par une matrice, avec la matière d'un id de texture ou d'une matière VMAT. */
  K.geo = (tex, hex, geo, m) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    const b = bucket(tex), c = vcol(hex), S = texSize(tex), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      b.pos.push(P.getX(i), P.getY(i), P.getZ(i)); b.nor.push(N.getX(i), N.getY(i), N.getZ(i)); b.col.push(c[0], c[1], c[2]);
      b.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    }
    g.dispose();
    return K;
  };
  K.cyl = (tex, hex, x, y, z, r, h, seg = 16, rx = 0, rz = 0) => K.geo(tex, hex, new THREE.CylinderGeometry(r, r, h, seg), mtx(x, y, z, rx, 0, rz));
  K.add = (obj) => { extra.push(obj); return K; };
  /* Jeu 2.0.3 (interface 7) : surfaces d'une pièce du décor. Dans le kit d'une pièce (cap), chaque appel
     de premier niveau (face, boîte, toit, forme, cylindre, objet) est une surface : ses sommets dans
     chaque matière [tex, début, fin), ses objets [début, fin). K.group(nom, fn) en fait une seule. */
  let depth = 0;
  K.cap = null; K.cur = null; K.lastPrim = null;
  const pOpen = (kind) => {
    if (!K.cap || depth++ > 0) return;
    const at = new Map();
    for (const [tex, b] of parts) at.set(tex, b.pos.length / 3);
    K.cur = { kind, title: '', at, ex: extra.length, ranges: null, exr: null, geo: '', node: null };
  };
  const pClose = () => {
    if (!K.cap || --depth > 0) return;
    const r = K.cur;
    K.cur = null;
    if (!r) return;
    r.ranges = [];
    for (const [tex, b] of parts) { const s = r.at.get(tex) || 0, e = b.pos.length / 3; if (e > s) r.ranges.push([tex, s, e]); }
    r.exr = [r.ex, extra.length];
    r.at = null;
    if (!r.ranges.length && r.exr[1] === r.exr[0]) return;     // rien de dessiné
    K.cap.prims.push(r);
    K.lastPrim = r;
  };
  for (const k of ['quad', 'tri', 'box', 'gable', 'geo', 'cyl', 'add']) {
    const f = K[k];
    K[k] = (...a) => {
      if (!K.cap) return f(...a);
      pOpen(k);
      try {
        if (k === 'geo' && K.cur && depth === 1) K.cur.geo = a[2] === GEO.box ? 'beam' : (a[2] && a[2].type) || '';
        f(...a);
      } finally { pClose(); }
      return K;
    };
  }
  K.group = (title, fn) => {
    if (!K.cap) { fn(K); return K; }
    pOpen('group');
    if (K.cur && depth === 1) K.cur.title = title;
    try { fn(K); } finally { pClose(); }
    return K;
  };
  /* Cases de la grille des solides. */
  K.solid = (x0, z0, x1, z1, kind, o) => { owFill(OW.surf, x0, z0, x1, z1, kind, o); return K; };
  /* Jeu 2.0.3 : pièce du décor des lieux (genre, nom, pied x y z, construction fn(K) dans un kit à
     elle) ; les Mod Tools la sélectionnent, une carte la déplace, la tourne, la met à l'échelle ou la
     retire. Voir « Décor des lieux ». K.lastItem : la dernière pièce posée par ce kit. */
  K.mk = owKit;
  K.item = (kind, title, x, y, z, fn, o) => { K.lastItem = owItem(K, kind, title, x, y, z, fn, o); return K; };
  K.dump = () => ({ parts, extra });
  /* Sommets [s, e) d'une matière d'un autre kit (src : { pos, nor, uv, col }), transformés par M
     (null : tels quels ; nm : sa matrice des normales), vers la matière tex ; uv × k ; col : couleur
     imposée [r, g, b] (null : la leur). Renvoie [début, fin) dans ce kit. */
  const _kv = new THREE.Vector3();
  K.mergeRange = (src, s, e, tex, M, nm, k, col) => {
    const b = bucket(tex), at = b.pos.length / 3, v = _kv;
    for (let i = s; i < e; i++) {
      const i3 = i * 3, i2 = i * 2;
      if (M) {
        v.set(src.pos[i3], src.pos[i3 + 1], src.pos[i3 + 2]).applyMatrix4(M); b.pos.push(v.x, v.y, v.z);
        v.set(src.nor[i3], src.nor[i3 + 1], src.nor[i3 + 2]).applyMatrix3(nm).normalize(); b.nor.push(v.x, v.y, v.z);
      } else {
        b.pos.push(src.pos[i3], src.pos[i3 + 1], src.pos[i3 + 2]);
        b.nor.push(src.nor[i3], src.nor[i3 + 1], src.nor[i3 + 2]);
      }
      b.uv.push(src.uv[i2] * k[0], src.uv[i2 + 1] * k[1]);
      if (col) b.col.push(col[0], col[1], col[2]); else b.col.push(src.col[i3], src.col[i3 + 1], src.col[i3 + 2]);
    }
    return [at, b.pos.length / 3];
  };
  /* Ajoute la géométrie d'un autre kit (une pièce), transformée par la matrice M (null : telle quelle). */
  K.merge = (Ki, M = null) => {
    const d = Ki.dump(), v = new THREE.Vector3(), nm = M ? new THREE.Matrix3().getNormalMatrix(M) : null;
    for (const [tex, s] of d.parts) {
      const b = bucket(tex);
      if (!M) {
        for (const [from, to] of [[s.pos, b.pos], [s.nor, b.nor], [s.uv, b.uv], [s.col, b.col]]) for (let i = 0; i < from.length; i++) to.push(from[i]);
        continue;
      }
      for (let i = 0; i < s.pos.length; i += 3) {
        v.set(s.pos[i], s.pos[i + 1], s.pos[i + 2]).applyMatrix4(M); b.pos.push(v.x, v.y, v.z);
        v.set(s.nor[i], s.nor[i + 1], s.nor[i + 2]).applyMatrix3(nm).normalize(); b.nor.push(v.x, v.y, v.z);
      }
      for (let i = 0; i < s.uv.length; i++) b.uv.push(s.uv[i]);
      for (let i = 0; i < s.col.length; i++) b.col.push(s.col[i]);
    }
    for (const o of d.extra) { if (M) o.applyMatrix4(M); extra.push(o); }
    return K;
  };
  K.build = (root) => {
    const g = new THREE.Group();
    g.name = name;
    for (const [tex, b] of parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.computeBoundingSphere();
      const mat = VMAT[tex] || levelMaterial(tex);
      const m = new THREE.Mesh(geo, mat);
      m.userData.tex = tex;                                // surfaces du décor (Mod Tools : quelle surface sous la souris)
      m.matrixAutoUpdate = false;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    for (const o of extra) g.add(o);
    root.add(g);
    return g;
  };
  return K;
}

/* ---- Maison (murs d'une case, portes, fenêtres, toit plat ou à deux pans, sol, plafond)
   o : { x0, z0, x1, z1 (bords extérieurs, en m entiers), y (sol), h (hauteur des murs), wall (texture),
         wallHex, doors: [[côté, début, largeur, hauteur?]], wins: [[côté, début, largeur, bas, haut]],
         roof: 'flat' | 'gable' | 'none', roofTex, rise, parapet, floorTex, inTex (murs intérieurs) }
   côté : 'n' (z0), 's' (z1), 'w' (x0), 'e' (x1) ; début : distance depuis le coin ouest ou nord. */
function owHouse(K, o) {
  const { x0, z0, x1, z1, y } = o, h = o.h || 3.2, top = y + h, wt = o.wall || 'kh_whitewash', hex = o.wallHex || 0xffffff;
  const inT = o.inTex || wt, inHex = o.inHex || (hex === 0xffffff ? 0xd9d2c4 : hex);
  const doorsOn = (side) => (o.doors || []).filter((d) => d[0] === side);
  const winsOn = (side) => (o.wins || []).filter((d) => d[0] === side);
  // sol et plafond (cases intérieures : FLOOR avec plafond, le toit arrête les rayons)
  const roofY = top + (o.roof === 'flat' ? 0.25 : 0.1);
  const SIDE = { n: 'nord', s: 'sud', w: 'ouest', e: 'est' };       // noms des surfaces (Mod Tools)
  K.solid(x0 + 1, z0 + 1, x1 - 1, z1 - 1, OWK.FLOOR, { base: y, ceil: o.roof === 'none' ? 0 : top, roof: roofY, mat: OWM.STONE });
  if (!o.noFloor) K.group('Sol', () => K.box(o.floorTex || 'kh_floor', 0xffffff, x0 + 1, y - 0.3, z0 + 1, x1 - 1, y, z1 - 1, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] }));
  // murs : côté par côté, en segments entre les ouvertures
  const sides = [
    ['n', x0, x1, (a, b) => [a, z0, b, z0 + 1], true],
    ['s', x0, x1, (a, b) => [a, z1 - 1, b, z1], true],
    ['w', z0 + 1, z1 - 1, (a, b) => [x0, a, x0 + 1, b], false],
    ['e', z0 + 1, z1 - 1, (a, b) => [x1 - 1, a, x1, b], false],
  ];
  for (const [side, a0, a1, rect, alongX] of sides) {
    const opens = doorsOn(side).map((d) => ({ s: (alongX ? x0 : z0) + d[1], e: (alongX ? x0 : z0) + d[1] + d[2], lo: y, hi: y + (d[3] || 2.3), door: true }))
      .concat(winsOn(side).map((w) => ({ s: (alongX ? x0 : z0) + w[1], e: (alongX ? x0 : z0) + w[1] + w[2], lo: y + w[3], hi: y + w[4], door: false })))
      .sort((p, q) => p.s - q.s);
    let cur = a0;
    const seg = (s, e, lo, hi, what = 'Mur') => {
      if (e - s <= 0.01 || hi - lo <= 0.01) return;
      const [rx0, rz0, rx1, rz1] = rect(s, e);
      K.group(`${what} ${SIDE[side]}`, () => K.box(wt, hex, rx0, lo, rz0, rx1, hi, rz1, { top: o.capTex || wt }));
    };
    for (const op of opens) {
      seg(cur, op.s, y - 0.3, top);
      seg(op.s, op.e, op.hi, top, op.door ? 'Linteau de la porte' : 'Linteau de la fenêtre');
      if (!op.door) seg(op.s, op.e, y - 0.3, op.lo, 'Allège');
      const [rx0, rz0, rx1, rz1] = rect(op.s, op.e);
      if (op.door) K.solid(rx0, rz0, rx1, rz1, OWK.FLOOR, { base: y, ceil: op.hi, roof: top, mat: OWM.STONE });
      else K.solid(rx0, rz0, rx1, rz1, OWK.WINDOW, { base: y - 0.3, top, lo: op.lo, hi: op.hi, mat: OWM.STONE });
      // encadrement (bois sombre)
      K.group(`Encadrement ${SIDE[side]}`, () => K.box('kh_planks', 0x6b4a30, ...(alongX ? [op.s, op.hi, rz0 - 0.04, op.e, op.hi + 0.12, rz1 + 0.04] : [rx0 - 0.04, op.hi, op.s, rx1 + 0.04, op.hi + 0.12, op.e])));
      cur = op.e;
    }
    seg(cur, a1, y - 0.3, top);
    // cases pleines du côté, hors ouvertures
    for (let t = Math.floor(a0); t < Math.ceil(a1); t++) {
      if (opens.some((op) => t + 0.5 > op.s && t + 0.5 < op.e)) continue;
      const [rx0, rz0, rx1, rz1] = rect(t, t + 1);
      K.solid(rx0, rz0, rx1, rz1, OWK.SOLID, { base: y - 0.5, top: o.roof === 'gable' ? top + (o.rise || 1.5) * 0.5 : top + (o.parapet || 0), mat: OWM.STONE });
    }
  }
  // toit
  if (o.roof === 'flat') {
    K.group('Toit', () => K.box(o.roofTex || wt, o.roofHex || hex, x0 - 0.15, top, z0 - 0.15, x1 + 0.15, top + 0.25, z1 + 0.15));
    if (o.parapet) {
      const p = o.parapet, t2 = top + 0.25;
      K.group('Acrotère nord', () => K.box(wt, hex, x0, t2, z0, x1, t2 + p, z0 + 0.3)).group('Acrotère sud', () => K.box(wt, hex, x0, t2, z1 - 0.3, x1, t2 + p, z1))
        .group('Acrotère ouest', () => K.box(wt, hex, x0, t2, z0 + 0.3, x0 + 0.3, t2 + p, z1 - 0.3)).group('Acrotère est', () => K.box(wt, hex, x1 - 0.3, t2, z0 + 0.3, x1, t2 + p, z1 - 0.3));
    }
  } else if (o.roof === 'gable') {
    const along = x1 - x0 >= z1 - z0;
    K.group('Toit à deux pans', () => K.gable(o.roofTex || 'kh_sheet', o.roofHex || 0xffffff, x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, top, o.rise || 1.5, along, wt, hex));
    K.group('Plafond', () => K.box(o.ceilTex || 'kh_planks', 0xcfc2ad, x0 + 1, top - 0.05, z0 + 1, x1 - 1, top, z1 - 1, { skip: ['top', 'px', 'nx', 'pz', 'nz'] }));
  }
  return K;
}

/* Hauteur posée d'un lieu (moyenne du terrain sous un rectangle). */
function owPadY(x0, z0, x1, z1) {
  let s = 0, n = 0;
  for (let z = z0; z <= z1; z += 2) for (let x = x0; x <= x1; x += 2) { s += owH(x, z); n++; }
  return s / n;
}
/* Aplanit le terrain sous un rectangle (bords fondus) : les bâtiments posés ensuite y tiennent. */
function owLevel(x0, z0, x1, z1, y, blend = 6) {
  const H = OW.H;
  owEachPoint(x0 - blend, z0 - blend, x1 + blend, z1 + blend, (k, x, z) => {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), d = Math.hypot(dx, dz);
    const w = 1 - owSmoothstep(0, blend, d);
    if (w > 0) H[k] = lerp(H[k], y, w);
  });
}
