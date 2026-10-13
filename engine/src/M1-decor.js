/* ------------------------------------------------- Décor des lieux (jeu 2.0.3) --
   Chaque pièce du décor des lieux (tente, caisse, fût, lampadaire, maison, mastaba, base lunaire…)
   est une pièce de la base : un identifiant stable (lieu, genre, position d'origine), sa géométrie
   relevée dans un kit à elle, ses cases relevées à part. Une carte ouverte peut la déplacer, la
   tourner, la mettre à l'échelle ou la retirer ; les Mod Tools la sélectionnent. Sans retouche, tout
   est comme avant (mêmes maillages fusionnés, mêmes cases).
   Interface 7 (même jeu 2.0.3) : chaque surface d'une pièce (mur, poutre, panneau, face, forme,
   objet : un appel du kit, ou un groupe K.group) se sélectionne et se retouche seule ; matières
   (texture et teinte) ; plus de pièce fixe : ce qui dépend d'une pièce dans le jeu (air de la base,
   échelle et ascenseur de la tour, quête, porte du sanctuaire…) suit sa pose.
     placeEdits { id: { x, z, dy, r, s, hide, m } }
       id     pièce (« A.tente@2265,1992.5 ») ou surface (« A.tente@2265,1992.5/3 » : la 4e surface)
       x, z   nouvelle place du pied ; pour une pièce posée dans une autre (table d'une tente) ou une
              surface, dans le repère d'origine de ce qui la porte
       dy     hauteur ajoutée (m) ; r : rotation ajoutée (radians, lacet de three.js) ;
       s      taille (un facteur, ou [largeur, hauteur, profondeur]) ; hide : retirée
       m      matières { tex: { t, c } } : t, une autre texture (bibliothèque, image de la carte) ;
              c, une teinte 0xRRGGBB ; sur une pièce, vaut pour ses surfaces et ce qu'elle porte
       cost   prix d'une porte payante (herse d'une pyramide, interface 8), en points
   Déplacée, une pièce garde sa hauteur au-dessus du terrain ; ce qui est posé dans une pièce la suit
   (déplacé, tourné, mis à l'échelle, retiré avec elle) ; chaque case d'une pièce appartient à la
   surface qui la recouvre le plus (elle la suit).
   Les cases des pièces sont écrites en dernier (après le sanctuaire, la quête et le tunnel), dans le
   journal P : les Mod Tools les retirent et les reposent sans refaire le monde. */
const OWLOGP = owJournal();
const OWPI = { list: [], prims: [], byId: new Map(), place: '', stack: [], sig: null, root: null, own: new Map(), desc: null, ver: 0, fol: [] };
const OWPI_ID = new THREE.Matrix4();                       // identité (partagée, jamais modifiée)
const OWPI_PRI = { [OWK.SOLID]: 6, [OWK.DOOR]: 5, [OWK.WINDOW]: 4, [OWK.LOW]: 3, [OWK.RAMP]: 2, [OWK.FLOOR]: 1 };
const OWPI_WHITE = [1, 1, 1];

/* Case relevée (mêmes valeurs par défaut que owSet). */
function owCapRec(L, cx, cz, kind, o) {
  const base = o.base !== undefined ? o.base : 0;
  return { L, cx, cz, kind, base, top: o.top !== undefined ? o.top : base, lo: o.lo || 0, hi: o.hi || 0, ceil: o.ceil || 0, roof: o.roof || 0, dir: o.dir || 0, mat: o.mat || 0, door: o.door !== undefined ? o.door : -1, p: -1 };
}
/* Retouches d'une carte (objet { id: retouche }). */
const owPlaceEdits = (map = OW.map) => (map && map.placeEdits && typeof map.placeEdits === 'object' ? map.placeEdits : {});

/* Début des lieux d'un chargement : les cases des pièces du chargement d'avant sont retirées. */
function owItemsBegin() {
  owLogUndo(OWLOGP);
  OWPI.list = []; OWPI.prims = []; OWPI.byId = new Map(); OWPI.stack = []; OWPI.place = '';
  OWPI.own = new Map(); OWPI.sig = null; OWPI.root = null; OWPI.desc = null; OWPI.fol = []; OWPI.ver++;
}
/* Une pièce (K.item) : construite dans un kit à elle, qui relève ses surfaces ; ses cases relevées.
   o : { logic (ce qui la suit dans le jeu, dit par les Mod Tools), ground (false : elle ne suit pas
   le terrain quand on la déplace) }. */
function owItem(K, kind, title, x, y, z, fn, o = {}) {
  const parent = OWPI.stack.length ? OWPI.stack[OWPI.stack.length - 1] : null;
  const r1 = (v) => Math.round(v * 10) / 10;
  let id = `${OWPI.place}.${kind}@${r1(x)},${r1(z)}`;
  if (OWPI.byId.has(id)) { let n = 2; while (OWPI.byId.has(`${id}#${n}`)) n++; id = `${id}#${n}`; }
  const it = {
    i: OWPI.list.length, id, kind, title, place: OWPI.place, ax: x, ay: y, az: z, parent, kids: [], logic: o.logic || '', ground: o.ground !== false,
    cells: new Map(), late: null, lamps: [], kit: null, prims: [], pmap: null, box: null,
    M: OWPI_ID, ident: true, hidden: false, own: null, mat: null, dirty: false, psig: '', group: null,
  };
  OWPI.list.push(it); OWPI.byId.set(id, it);
  if (parent) parent.kids.push(it);
  const Ki = K.mk(K.name), cap = OWCAP.cur, n0 = OWL.lamps.length;
  Ki.cap = { prims: [] };
  OWCAP.cur = { cells: it.cells, own: it };
  OWPI.stack.push(it);
  try { fn(Ki); } finally { OWPI.stack.pop(); OWCAP.cur = cap; }
  it.kit = Ki;
  const recs = Ki.cap.prims;
  Ki.cap = null;
  it.prims = recs.map((r, n) => owPrimNode(it, r, n));
  for (let k = n0; k < OWL.lamps.length; k++) {
    const L = OWL.lamps[k];
    if (L.item) continue;
    L.item = it; L.o = [L.x, L.y, L.z];
    L.prim = L.pr && L.pr.node && L.pr.node.item === it ? L.pr.node : null;
    it.lamps.push(L);
  }
  it.box = owItemBox(it);
  owCellOwners(it);
  it.pmap = owPrimMap(it);
  return it;
}
/* Surface relevée → nœud : boîte et pied d'origine, nom, matières. */
const OW_PRIM_KIND = { quad: 'Face', tri: 'Face triangulaire', box: 'Bloc', gable: 'Toit à deux pans', cyl: 'Cylindre', add: 'Objet', group: 'Ensemble', geo: 'Forme' };
const owTexName = (tex) => { const d = TEXLIB[tex]; return d ? d.name.replace(/\s*\((Khamsin|Lune)\)$/, '') : ''; };
function owPrimNode(it, r, n) {
  const d = it.kit.dump(), b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const add = (x, y, z) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z; };
  for (const [tex, s, e] of r.ranges) { const P = d.parts.get(tex).pos; for (let i = s; i < e; i++) add(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
  const bb = new THREE.Box3();
  for (let x = r.exr[0]; x < r.exr[1]; x++) {
    const o = d.extra[x];
    if (o.isSprite) { add(o.position.x, o.position.y, o.position.z); continue; }
    o.updateMatrixWorld(true);
    bb.setFromObject(o);
    if (!bb.isEmpty()) { add(bb.min.x, bb.min.y, bb.min.z); add(bb.max.x, bb.max.y, bb.max.z); }
  }
  if (!(b[3] >= b[0])) { b[0] = it.ax - 0.25; b[1] = it.ay; b[2] = it.az - 0.25; b[3] = it.ax + 0.25; b[4] = it.ay + 0.5; b[5] = it.az + 0.25; }
  const box = b.map((v) => Math.round(v * 1000) / 1000);
  const p = {
    j: OWPI.prims.length, id: `${it.id}/${n}`, n, item: it, kind: r.kind, title: '', ranges: r.ranges, exr: r.exr, box,
    ax: Math.round(((box[0] + box[3]) / 2) * 1000) / 1000, ay: box[1], az: Math.round(((box[2] + box[5]) / 2) * 1000) / 1000,
    mats: [...new Set(r.ranges.map((g) => g[0]))], logic: '', M: OWPI_ID, ident: true, hidden: false, own: null, mat: null, selfEdit: false,
  };
  let t = OW_PRIM_KIND[r.kind] || 'Surface';
  const w = box[3] - box[0], h = box[4] - box[1], dd = box[5] - box[2];
  if (r.kind === 'box') t = h < 0.35 && Math.max(w, dd) > 0.8 ? 'Dalle' : Math.min(w, dd) < 0.4 && h > 1 && Math.max(w, dd) > 0.8 ? 'Panneau' : h > 1.2 && Math.max(w, dd) < 0.45 ? 'Poteau' : 'Bloc';
  else if (r.kind === 'geo') t = r.geo === 'beam' ? 'Poutre' : /Cylinder/.test(r.geo) ? 'Cylindre' : /Sphere/.test(r.geo) ? 'Calotte' : /Circle/.test(r.geo) ? 'Disque' : /Lathe/.test(r.geo) ? 'Pièce tournée' : /Torus/.test(r.geo) ? 'Anneau' : 'Forme';
  else if (r.kind === 'add') { const o = d.extra[r.exr[0]]; t = o && o.isSprite ? 'Halo' : 'Objet'; }
  const mat = p.mats.length ? owTexName(p.mats[0]) : '';
  p.title = r.title || (mat ? `${t} · ${mat}` : t);
  r.node = p;
  for (let x = r.exr[0]; x < r.exr[1]; x++) d.extra[x].userData.prim = p.j;
  OWPI.prims.push(p); OWPI.byId.set(p.id, p);
  return p;
}
/* Boîte d'origine d'une pièce [x0, y0, z0, x1, y1, z1] : ses surfaces et ce qu'elle porte (la base
   lunaire : son moyeu et ses modules). */
function owItemBox(it) {
  const B = it.prims.map((p) => p.box).concat(it.kids.map((k) => k.box).filter(Boolean));
  if (!B.length) return [it.ax - 0.5, it.ay, it.az - 0.5, it.ax + 0.5, it.ay + 1, it.az + 0.5];
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const q of B) for (let k = 0; k < 3; k++) { if (q[k] < b[k]) b[k] = q[k]; if (q[k + 3] > b[k + 3]) b[k + 3] = q[k + 3]; }
  return b;
}
/* Chaque case de la pièce va à la surface qui la recouvre le plus (volume commun) ; pour une case
   pleine (mur, muret, fenêtre, porte, rampe), une surface qui descend jusqu'à son pied ; pour un sol,
   la dalle sous lui. Sans surface : la case suit la pièce. */
function owCellOwners(it) {
  if (!it.cells.size || !it.prims.length) return;
  const B = it.prims.map((p) => [p.box[0] - 0.3, p.box[1] - 0.05, p.box[2] - 0.3, p.box[3] + 0.3, p.box[4] + 0.05, p.box[5] + 0.3]);
  for (const r of it.cells.values()) {
    let y0, y1;
    const floor = r.kind === OWK.FLOOR;
    if (floor) { y0 = r.base - 0.4; y1 = r.base + 0.05; } else { y0 = Math.min(r.base, r.top); y1 = Math.max(r.base, r.top, y0 + 0.1); }
    let best = -1, bs = 0;
    for (let n = 0; n < B.length; n++) {
      const b = B[n];
      if (!floor && b[1] > y0 + 0.65) continue;
      const ox = Math.min(r.cx + 1, b[3]) - Math.max(r.cx, b[0]); if (ox <= 0) continue;
      const oz = Math.min(r.cz + 1, b[5]) - Math.max(r.cz, b[2]); if (oz <= 0) continue;
      const oy = Math.min(y1, b[4]) - Math.max(y0, b[1]); if (oy <= 0) continue;
      const s = ox * oz * oy;
      if (s > bs) { bs = s; best = n; }
    }
    r.p = best;
  }
}
/* Par matière du kit de la pièce : [début, fin, j] de chaque surface (Mod Tools : surface sous la souris). */
function owPrimMap(it) {
  const m = new Map();
  for (const p of it.prims) for (const [tex, s, e] of p.ranges) { let a = m.get(tex); if (!a) m.set(tex, (a = [])); a.push(s, e, p.j); }
  for (const [tex, a] of m) m.set(tex, Int32Array.from(a));
  return m;
}

/* Matrice propre d'une retouche (null : aucune) : pied, hauteur ajoutée, lacet, taille autour du pied
   d'origine (ax, ay, az) ; ground : déplacée, elle garde sa hauteur au-dessus du terrain. */
const _owT = new THREE.Matrix4(), _owQ = new THREE.Quaternion(), _owV = new THREE.Vector3(), _owS = new THREE.Vector3(), _owY = new THREE.Vector3(0, 1, 0);
function owOwnMatrix(e, n, ground) {
  if (!e || !(e.x !== undefined || e.dy || e.r || e.s !== undefined)) return null;
  const moved = typeof e.x === 'number' && typeof e.z === 'number' && (Math.abs(e.x - n.ax) > 1e-4 || Math.abs(e.z - n.az) > 1e-4);
  const x = moved ? e.x : n.ax, z = moved ? e.z : n.az;
  let y = n.ay + (e.dy || 0);
  if (moved && ground) y += owH(x, z) - owH(n.ax, n.az);
  const s = propScale({ s: e.s });
  return new THREE.Matrix4().compose(_owV.set(x, y, z), _owQ.setFromAxisAngle(_owY, e.r || 0), _owS.set(s[0], s[1], s[2])).multiply(_owT.makeTranslation(-n.ax, -n.ay, -n.az));
}
const owMatsOf = (e) => (e && e.m && typeof e.m === 'object' && Object.keys(e.m).length ? e.m : null);
/* Poses d'après les retouches (sans rien changer) : { it: [...], pr: [...] }, chacune { M (null :
   telle quelle), ident, hidden, edited, own (matrice propre), mat (matières, héritées comprises) }.
   Un parent avant ce qu'il porte ; une surface après sa pièce. */
function owItemsCompute(edits) {
  const out = new Array(OWPI.list.length), outP = new Array(OWPI.prims.length);
  for (const it of OWPI.list) {
    const e = edits[it.id] || null, P = it.parent ? out[it.parent.i] : null;
    const own = owOwnMatrix(e, it, !it.parent && it.ground);
    const M = P && P.M ? (own ? P.M.clone().multiply(own) : P.M) : own;
    const m = owMatsOf(e), pm = P ? P.mat : null;
    out[it.i] = { M, ident: !M, hidden: !!(e && e.hide) || !!(P && P.hidden), edited: !!e, own, mat: m ? (pm ? { ...pm, ...m } : m) : pm };
  }
  for (const p of OWPI.prims) {
    const e = edits[p.id] || null, P = out[p.item.i];
    const own = owOwnMatrix(e, p, false);
    const M = P.M ? (own ? P.M.clone().multiply(own) : P.M) : own;
    const m = owMatsOf(e);
    outP[p.j] = { M, ident: !M, hidden: !!(e && e.hide) || P.hidden, edited: !!e, own, mat: m ? (P.mat ? { ...P.mat, ...m } : m) : P.mat, selfMat: m };
  }
  return { it: out, pr: outP };
}
/* Poses appliquées aux pièces et aux surfaces ; dirty : une pièce dont une surface est retouchée,
   retirée ou dont les matières changent (fusionnée surface par surface). */
function owItemsPose(edits) {
  const R = owItemsCompute(edits);
  for (const it of OWPI.list) {
    const r = R.it[it.i];
    it.M = r.M || OWPI_ID; it.ident = r.ident; it.hidden = r.hidden; it.own = r.own; it.mat = r.mat;
    it.dirty = !!it.mat; it.psig = it.mat ? `m${JSON.stringify(it.mat)}` : '';
  }
  for (const p of OWPI.prims) {
    const r = R.pr[p.j], it = p.item;
    p.M = r.M || OWPI_ID; p.ident = r.ident; p.hidden = r.hidden; p.own = r.own; p.mat = r.mat;
    p.selfEdit = !!(r.own || r.selfMat || (r.hidden && !it.hidden));
    if (p.selfEdit) {
      it.dirty = true;
      it.psig += `${p.j}:${r.hidden ? 'h' : ''}${r.own ? Array.from(r.own.elements, (v) => Math.round(v * 1e4)).join(',') : ''}${r.selfMat ? JSON.stringify(r.selfMat) : ''}|`;
    }
  }
  OWPI.ver++;
  owFollowAll();
  return R;
}
/* Empreinte des poses (Mod Tools : refaire les cases quand elle change, terrain compris). */
function owItemsSig() {
  let s = '';
  for (const it of OWPI.list) s += `${it.hidden ? 'h' : it.ident ? '' : Array.from(it.M.elements, (v) => Math.round(v * 1e4)).join(',')}${it.psig ? `[${it.psig}]` : ''}|`;
  return s;
}

/* Matière d'arrivée d'une surface : [texture, uv × k, couleur imposée] (la texture d'origine si celle
   demandée n'existe pas ; une autre texture efface la teinte d'origine, sauf teinte choisie). */
const owRgb = (c) => { const k = new THREE.Color(c & 0xffffff).convertSRGBToLinear(); return [k.r, k.g, k.b]; };
function owMatTarget(tex, mat) {
  const o = mat && mat[tex];
  if (!o) return [tex, [1, 1], null];
  const t = o.t && o.t !== tex && TEXLIB[o.t] ? o.t : tex;
  const S0 = TEXLIB[tex] ? TEXLIB[tex].size : [2, 2], S1 = TEXLIB[t] ? TEXLIB[t].size : [2, 2];
  const k = t === tex ? [1, 1] : [S0[0] / (S1[0] || 2), S0[1] / (S1[1] || S1[0] || 2)];
  const col = typeof o.c === 'number' ? owRgb(o.c) : t !== tex ? OWPI_WHITE : null;
  return [t, k, col];
}
/* En partie : une pièce retouchée surface par surface rejoint les maillages fusionnés (chaque surface
   à sa pose, dans sa matière ; retirées : absentes). */
function owItemMerge(K, it) {
  const d = it.kit.dump();
  for (const p of it.prims) {
    if (p.hidden) continue;
    const M = p.ident ? null : p.M, nm = M ? new THREE.Matrix3().getNormalMatrix(M) : null;
    for (const [tex, s, e] of p.ranges) {
      const [t, k, col] = owMatTarget(tex, p.mat);
      K.mergeRange(d.parts.get(tex), s, e, t, M, nm, k, col);
    }
    for (let x = p.exr[0]; x < p.exr[1]; x++) { const o = d.extra[x]; if (M) o.applyMatrix4(M); K.add(o); }
  }
}
/* Fin des lieux (avant K.build) : en partie, chaque pièce rejoint les maillages fusionnés (transformée
   si la carte la retouche, absente si elle la retire) ; dans les Mod Tools, un groupe par pièce. */
function owItemsBuild(K, root) {
  owItemsPose(owPlaceEdits());
  if (CUR.editor) {
    const g = new THREE.Group();
    g.name = 'lieux-décor';
    for (const it of OWPI.list) it.group = owItemGroup(it, g);
    root.add(g);
    OWPI.root = g;
    owItemsGroups();
  } else {
    for (const it of OWPI.list) {
      if (it.hidden) continue;
      if (it.dirty) owItemMerge(K, it);
      else K.merge(it.kit, it.ident ? null : it.M);
    }
  }
  owItemsLamps(!CUR.editor);
  OWPI.sig = owItemsSig();
}
/* Objet d'une surface (Mod Tools) : à sa place d'origine dans le groupe de sa pièce, × own. */
function owExtraPose(o, own, show) {
  if (!o.userData.m0) { o.updateMatrix(); o.userData.m0 = o.matrix.clone(); }
  o.matrixAutoUpdate = false;
  if (own) o.matrix.multiplyMatrices(own, o.userData.m0); else o.matrix.copy(o.userData.m0);
  o.visible = show;
}
/* Mod Tools : groupe d'une pièce dans parent (ses surfaces dans son repère d'origine, chacune × sa
   matrice propre, dans sa matière). Chaque maillage porte ses surfaces (userData.prims : [début,
   fin, j]…), chaque objet la sienne (userData.prim). */
function owItemGroup(it, parent) {
  const d = it.kit.dump();
  let g;
  if (!it.dirty) {
    g = it.kit.build(parent);
    for (const m of g.children) if (m.isMesh && m.userData.tex !== undefined) m.userData.prims = it.pmap.get(m.userData.tex) || null;
    for (const o of d.extra) owExtraPose(o, null, true);
  } else {
    const Kt = owKit(it.kit.name), maps = new Map();
    for (const p of it.prims) {
      const hid = p.hidden && !it.hidden;
      for (let x = p.exr[0]; x < p.exr[1]; x++) owExtraPose(d.extra[x], p.own, !hid);
      if (hid) continue;
      const nm = p.own ? new THREE.Matrix3().getNormalMatrix(p.own) : null;
      for (const [tex, s, e] of p.ranges) {
        const [t, k, col] = owMatTarget(tex, p.mat);
        const [a, b] = Kt.mergeRange(d.parts.get(tex), s, e, t, p.own, nm, k, col);
        let L = maps.get(t);
        if (!L) maps.set(t, (L = []));
        L.push(a, b, p.j);
      }
    }
    g = Kt.build(parent);
    for (const o of d.extra) g.add(o);
    for (const m of g.children) if (m.isMesh && m.userData.tex !== undefined) m.userData.prims = Int32Array.from(maps.get(m.userData.tex) || []);
  }
  g.name = it.id;
  g.matrixAutoUpdate = false;
  g.userData.el = { kind: 'place', i: it.i };
  return g;
}
/* Mod Tools : groupes des pièces dont les surfaces ont changé, refaits (old : leurs empreintes d'avant). */
function owItemsRegroup(old) {
  const R = OWPI.root;
  if (!R) return;
  OWPI.list.forEach((it, i) => {
    if (!it.group || it.psig + (it.dirty ? '*' : '') === old[i]) return;
    const og = it.group;
    it.group = owItemGroup(it, R);
    R.remove(og);
    og.traverse((o) => { if (o.isMesh && o.geometry && o.userData.tex !== undefined) o.geometry.dispose(); });
  });
  OWED.meshes = null;
}
const owItemsMarks = () => OWPI.list.map((it) => it.psig + (it.dirty ? '*' : ''));
/* Mod Tools : chaque groupe à sa place. */
function owItemsGroups() {
  for (const it of OWPI.list) {
    const g = it.group;
    if (!g) continue;
    g.matrix.copy(it.M);
    g.visible = !it.hidden;
    g.updateMatrixWorld(true);
  }
}
/* Lampes des pièces : à leur place (vraies lumières), sans celles des pièces et surfaces retirées.
   lazy : rien à faire si aucune pièce à lampe n'est retouchée (l'ordre des lampes reste celui d'origine). */
function owItemsLamps(lazy = false) {
  if (lazy && !OWPI.list.some((it) => it.lamps.length && (it.hidden || !it.ident || it.dirty))) return;
  const keep = OWL.lamps.filter((L) => !L.item), v = new THREE.Vector3();
  for (const it of OWPI.list) {
    if (it.hidden) continue;
    for (const L of it.lamps) {
      const n = L.prim || it;
      if (n.hidden) continue;
      v.set(L.o[0], L.o[1], L.o[2]).applyMatrix4(n.M); L.x = v.x; L.y = v.y; L.z = v.z;
      keep.push(L);
    }
  }
  OWL.lamps = keep;
}

/* Cases des pièces : écrites à la fin des lieux (journal P), à leur place. */
function owItemsWrite() {
  owLogUndo(OWLOGP);
  OWPI.own = new Map();
  owLogBegin(OWLOGP);
  const nI = OWPI.list.length;
  try { for (const it of OWPI.list) if (!it.hidden) owItemCells(it, nI); } finally { owLogEnd(); }
}
/* Cases transformées par M (null : telles quelles) : chaque case d'arrivée prend la case d'origine
   sous son centre, puis chaque case d'origine marque la case où tombe son centre (une pièce réduite
   garde ses murs d'une case). Hauteurs : base, dessus, ouverture, plafond, toit suivent l'échelle.
   emit(L, cx, cz, case d'arrivée, case d'origine). */
function owCellsXf(recs, M, emit) {
  if (!M) { for (const r of recs) emit(r.L, r.cx, r.cz, r, r); return; }
  const e = M.elements, a = e[0], b = e[8], c = e[2], d = e[10], tx = e[12], tz = e[14], sy = e[5], ty = e[13];
  const det = a * d - b * c;
  if (!(Math.abs(det) > 1e-9)) return;
  const fy = (v) => v * sy + ty, AX = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dirOf = (q) => { const u = AX[q] || AX[0], X = a * u[0] + b * u[1], Z = c * u[0] + d * u[1]; return Math.abs(X) >= Math.abs(Z) ? (X >= 0 ? 0 : 1) : (Z >= 0 ? 2 : 3); };
  const moved = (r) => ({ kind: r.kind, base: fy(r.base), top: fy(r.top), lo: r.lo ? fy(r.lo) : 0, hi: r.hi ? fy(r.hi) : 0, ceil: r.ceil ? fy(r.ceil) : 0, roof: r.roof ? fy(r.roof) : 0, dir: r.kind === OWK.RAMP ? dirOf(r.dir) : r.dir, mat: r.mat, door: r.door });
  const inW = (qx, qz) => qx >= 0 && qz >= 0 && qx < 4096 && qz < 3072;
  const layers = new Map();
  for (const r of recs) { let m = layers.get(r.L); if (!m) layers.set(r.L, (m = new Map())); m.set(r.cz * 4096 + r.cx, r); }
  for (const [L, src] of layers) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const r of src.values()) {
      for (let k = 0; k < 4; k++) {
        const px = r.cx + (k & 1), pz = r.cz + (k >> 1), X = a * px + b * pz + tx, Z = c * px + d * pz + tz;
        if (X < x0) x0 = X; if (X > x1) x1 = X; if (Z < z0) z0 = Z; if (Z > z1) z1 = Z;
      }
    }
    const dst = new Map();
    for (let qz = Math.floor(z0); qz < Math.ceil(z1); qz++) {
      for (let qx = Math.floor(x0); qx < Math.ceil(x1); qx++) {
        if (!inW(qx, qz)) continue;
        const X = qx + 0.5 - tx, Z = qz + 0.5 - tz, sx = Math.floor((d * X - b * Z) / det), sz = Math.floor((a * Z - c * X) / det);
        if (!inW(sx, sz)) continue;
        const r = src.get(sz * 4096 + sx);
        if (r) dst.set(qz * 4096 + qx, r);
      }
    }
    for (const r of src.values()) {
      const px = r.cx + 0.5, pz = r.cz + 0.5, qx = Math.floor(a * px + b * pz + tx), qz = Math.floor(c * px + d * pz + tz);
      if (!inW(qx, qz)) continue;
      const k = qz * 4096 + qx, cur = dst.get(k);
      if (!cur || (OWPI_PRI[r.kind] || 0) > (OWPI_PRI[cur.kind] || 0)) dst.set(k, r);
    }
    for (const [k, r] of dst) { const qx = k % 4096; emit(L, qx, (k - qx) / 4096, moved(r), r); }
  }
}
/* Cases d'une pièce : chaque surface retouchée emporte les siennes (retirée : aucune), le reste suit
   la pièce ; puis les cases posées dans la pièce par la quête, le sanctuaire… (late), par-dessus. */
function owItemCells(it, nI) {
  const put = (L, cx, cz, r, node) => { owSet(L, cx, cz, r.kind, r); if (L === OW.surf) OWPI.own.set(cz * 4096 + cx, node); };
  const nodeOf = (r) => (r.p >= 0 && it.prims[r.p] ? nI + it.prims[r.p].j : it.i);
  const anyPrim = it.prims.some((p) => p.own || (p.hidden && !it.hidden));
  if (it.ident && !anyPrim) {
    for (const r of it.cells.values()) put(r.L, r.cx, r.cz, r, nodeOf(r));
    if (it.late) for (const r of it.late.values()) put(r.L, r.cx, r.cz, r, it.i);
    return;
  }
  const groups = new Map();
  for (const r of it.cells.values()) {
    const p = r.p >= 0 ? it.prims[r.p] : null;
    if (p && p.hidden) continue;
    const key = p && p.own ? p.j : -1;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { M: p && p.own ? p.M : it.ident ? null : it.M, recs: [] }));
    g.recs.push(r);
  }
  const dst = new Map(), PR = (k) => OWPI_PRI[k] || 0;
  const key = (L, qx, qz) => (L === OW.under ? 16777216 : 0) + qz * 4096 + qx;
  for (const g of groups.values()) owCellsXf(g.recs, g.M, (L, qx, qz, r, src) => {
    const k = key(L, qx, qz), cur = dst.get(k);
    if (!cur || PR(r.kind) >= PR(cur.r.kind)) dst.set(k, { L, qx, qz, r, node: nodeOf(src) });
  });
  if (it.late) owCellsXf([...it.late.values()], it.ident ? null : it.M, (L, qx, qz, r) => { dst.set(key(L, qx, qz), { L, qx, qz, r, node: it.i }); });
  for (const v of dst.values()) put(v.L, v.qx, v.qz, v.r, v.node);
}

/* Mod Tools : retouches de la carte appliquées au monde déjà chargé (poses, groupes, lampes, cases,
   ce qui suit les pièces). Appelé quand les éléments sont refaits (leurs journaux déjà retirés).
   Renvoie vrai si rien n'était à jour. */
function owItemsApply(map) {
  if (!OWPI.list.length) return false;
  const old = owItemsMarks();
  owItemsPose(owPlaceEdits(map));
  const sig = owItemsSig();
  if (sig === OWPI.sig) return false;
  OWPI.sig = sig;
  owItemsRegroup(old);
  owItemsGroups();
  owItemsLamps(false);
  owItemsWrite();
  khPyrFaces();                                        // faces nord des pyramides : échancrées si le portail est à sa place
  OWNAV.ready = false;
  if (typeof LUNAV !== 'undefined') LUNAV.ready = false;
  OWED.meshes = null;
  return true;
}

/* ---- Ce qui suit une pièce ou une surface (interface 7) : le jeu s'y réfère par son nœud (pièce,
   surface, ou surface relevée par K.lastPrim). owPt : point d'origine → monde ; owLoc : l'inverse ;
   owYaw, owDir : lacet ajouté, direction tournée ; owFollow : un objet (maillage de la quête, porte),
   remis à sa place d'origine puis transformé à chaque pose ; owFollowFn : une fonction rappelée ;
   owLate : cases écrites avec la pièce (après les siennes). */
const owNode = (n) => (n && n.node ? n.node : n);
function owNodeM(n) { n = owNode(n); return n && !n.ident ? n.M : null; }
function owNodeHidden(n) { n = owNode(n); return !!(n && n.hidden); }
function owPt(n, x, y, z, out = new THREE.Vector3()) { const M = owNodeM(n); out.set(x, y, z); return M ? out.applyMatrix4(M) : out; }
function owLoc(n, x, y, z, out = new THREE.Vector3()) {
  n = owNode(n);
  out.set(x, y, z);
  if (!n || n.ident) return out;
  if (n._iv !== OWPI.ver) { n._iv = OWPI.ver; n._inv = n.M.clone().invert(); }
  return out.applyMatrix4(n._inv);
}
function owYaw(n) { const M = owNodeM(n); return M ? Math.atan2(-M.elements[2], M.elements[0]) : 0; }
function owDir(n, dx, dz) { const a = owYaw(n), c = Math.cos(a), s = Math.sin(a); return [c * dx + s * dz, -s * dx + c * dz]; }
function owFollow(n, o) {
  if (!n || !o) return o;
  o.updateMatrix();
  const F = { n, o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
  OWPI.fol.push(F);
  owFollowOne(F);
  return o;
}
function owFollowFn(n, fn) { const F = { n, fn }; OWPI.fol.push(F); fn(); return F; }
function owFollowOne(F) {
  if (F.fn) { F.fn(); return; }
  const o = F.o;
  o.position.copy(F.p); o.quaternion.copy(F.q); o.scale.copy(F.s);
  const M = owNodeM(F.n);
  if (M) o.applyMatrix4(M);
  o.updateMatrix();
  o.updateMatrixWorld(true);
}
function owFollowAll() { for (const F of OWPI.fol) owFollowOne(F); }
function owLate(n, fn) {
  n = owNode(n);
  const it = n && n.item ? n.item : n;
  if (!it || !it.cells) { fn(); return; }
  if (!it.late) it.late = new Map();
  const cap = OWCAP.cur;
  OWCAP.cur = { cells: it.late, own: it };
  try { fn(); } finally { OWCAP.cur = cap; }
}

/* ---- Lecture d'une carte : retouches vérifiées (identifiant, nombres bornés, taille comme un objet,
   matières : identifiants de textures, teintes). */
function normPlaceEdits(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const f = (v, a, b) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, a, b) : undefined);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  let n = 0;
  for (const id of Object.keys(raw)) {
    if (n >= OPEN_LIMITS.placeEdits) break;
    const e = raw[id];
    if (!/^[A-Za-z0-9_.@,#/-]{1,80}$/.test(id) || !e || typeof e !== 'object') continue;
    const o = {};
    const x = f(e.x, -2000, 7000), z = f(e.z, -2000, 7000);
    if (x !== undefined && z !== undefined) { o.x = r3(x); o.z = r3(z); }
    const dy = f(e.dy, -60, 200);
    if (dy) o.dy = r3(dy);
    const r = f(e.r, -50, 50);
    if (r) o.r = Math.round(r * 10000) / 10000;
    const s = normPropScale(e.s);
    if (s !== undefined) o.s = s;
    if (e.hide === true) o.hide = true;
    const cost = f(e.cost, 0, 1000000);                  // interface 8 : prix d'une porte payante
    if (cost !== undefined) o.cost = Math.round(cost);
    if (e.m && typeof e.m === 'object' && !Array.isArray(e.m)) {
      const mo = {};
      for (const tex of Object.keys(e.m).slice(0, 24)) {
        const v = e.m[tex];
        if (!/^[\w-]{1,48}$/.test(tex) || !v || typeof v !== 'object') continue;
        const q = {};
        if (typeof v.t === 'string' && /^[\w-]{1,48}$/.test(v.t) && v.t !== tex) q.t = v.t;
        if (typeof v.c === 'number' && Number.isFinite(v.c)) q.c = Math.round(v.c) & 0xffffff;
        if (Object.keys(q).length) mo[tex] = q;
      }
      if (Object.keys(mo).length) o.m = mo;
    }
    if (Object.keys(o).length) { out[id] = o; n++; }
  }
  return out;
}

/* ---- Mod Tools (interfaces 6 et 7) : nœuds = pièces (0 … n − 1) puis surfaces (n … ). */
const owPlaceName = (id) => { const L = (OW.locs || []).find((q) => q.id === id); return L ? L.name : ''; };
const owNodeAt = (i) => (i < OWPI.list.length ? OWPI.list[i] : OWPI.prims[i - OWPI.list.length]);
/* Nœuds du décor du monde chargé : identité, nom, lieu, pied et boîte d'origine, parent, ce qu'il porte
   (pièces et surfaces), matières, ce qui le suit dans le jeu (logic). */
function owEditorPlaceItems() {
  if (!OWPI.desc) {
    const nI = OWPI.list.length;
    const matsOf = (it) => { const s = new Set(); const walk = (q) => { for (const p of q.prims) for (const t of p.mats) s.add(t); for (const k of q.kids) walk(k); }; walk(it); return [...s]; };
    const D = OWPI.list.map((it) => ({
      i: it.i, id: it.id, kind: it.kind, name: it.title, place: it.place, placeName: owPlaceName(it.place), x: it.ax, y: it.ay, z: it.az,
      box: it.box.slice(), parent: it.parent ? it.parent.i : -1, kids: it.kids.map((k) => k.i).concat(it.prims.map((p) => nI + p.j)),
      locked: '', logic: it.logic, surf: false, mats: matsOf(it), door: owEditorDoorOf(it),
    }));
    for (const p of OWPI.prims) {
      D.push({
        i: nI + p.j, id: p.id, kind: 'surface', name: p.title, place: p.item.place, placeName: owPlaceName(p.item.place), x: p.ax, y: p.ay, z: p.az,
        box: p.box.slice(), parent: p.item.i, kids: [], locked: '', logic: p.logic, surf: true, mats: p.mats.slice(),
      });
    }
    OWPI.desc = D;
  }
  return OWPI.desc;
}
/* Interface 8 : porte payante portée par une pièce (herse d'une pyramide) : { cost (prix d'origine), name }. */
function owEditorDoorOf(it) {
  const D = typeof KHPY !== 'undefined' ? KHPY.doors.find((q) => q.node === it) : null;
  return D ? { cost: D.d.cost, name: `pyramide de ${D.d.name}` } : null;
}
/* Pose de chaque nœud d'après les retouches de map : pied (monde), lacet, facteurs, empreinte au sol
   (quatre coins), hauteurs, retiré ou non. */
function owEditorPlaceState(map) {
  const R = owItemsCompute(owPlaceEdits(map)), v = new THREE.Vector3(), r3 = (x) => Math.round(x * 1000) / 1000;
  const one = (n, r) => {
    const M = r.M || OWPI_ID, e = M.elements, b = n.box;
    v.set(n.ax, n.ay, n.az).applyMatrix4(M);
    const at = [r3(v.x), r3(v.y), r3(v.z)];
    const foot = [[b[0], b[2]], [b[3], b[2]], [b[3], b[5]], [b[0], b[5]]].map(([x, z]) => { v.set(x, b[1], z).applyMatrix4(M); return [r3(v.x), r3(v.z)]; });
    return {
      x: at[0], y: at[1], z: at[2], r: Math.atan2(-e[2], e[0]), s: [Math.hypot(e[0], e[2]), e[5], Math.hypot(e[8], e[10])],
      foot, y0: r3(b[1] * e[5] + e[13]), y1: r3(b[4] * e[5] + e[13]), hidden: r.hidden, edited: r.edited, moved: !r.ident,
    };
  };
  return OWPI.list.map((it) => one(it, R.it[it.i])).concat(OWPI.prims.map((p) => one(p, R.pr[p.j])));
}
/* Matrices des nœuds de list d'après les retouches de map (Mod Tools : les éléments de jeu posés
   dans une pièce la suivent) : [{ M (16 nombres, repère d'origine → monde ; null : telle quelle),
   hidden }]. */
function owEditorPlaceMatrices(list, map) {
  const R = owItemsCompute(owPlaceEdits(map)), nI = OWPI.list.length;
  return list.map((i) => {
    const r = i >= 0 && i < nI ? R.it[i] : R.pr[i - nI];
    return r ? { M: r.M ? Array.from(r.M.elements) : null, hidden: r.hidden } : null;
  });
}
/* Point du monde → repère où la retouche du nœud i s'écrit (celui d'origine de ce qui le porte). */
function owEditorPlaceLocal(i, wx, wz, map) {
  const n = owNodeAt(i);
  if (!n) return [wx, wz];
  const P = n.item || n.parent;
  if (!P) return [wx, wz];
  const R = owItemsCompute(owPlaceEdits(map)).it[P.i];
  if (!R.M) return [wx, wz];
  const v = new THREE.Vector3(wx, n.ay, wz).applyMatrix4(R.M.clone().invert());
  return [v.x, v.z];
}
/* Pendant un glisser : les groupes suivent les retouches (sans refaire les cases). */
function owEditorPlacePose(map) {
  if (!OWPI.list.length) return false;
  const old = owItemsMarks();
  owItemsPose(owPlaceEdits(map));
  owItemsRegroup(old);
  owItemsGroups();
  const v = new THREE.Vector3();
  for (const it of OWPI.list) for (const L of it.lamps) { v.set(L.o[0], L.o[1], L.o[2]).applyMatrix4((L.prim || it).M); L.x = v.x; L.y = v.y; L.z = v.z; }
  return true;
}
/* Nœud à qui appartient la case sous (x, z) (vue 3D : un mur, un sol de tente…), ou -1. */
function owEditorPlaceAt(x, z) {
  const i = OWPI.own.get(Math.floor(z) * 4096 + Math.floor(x));
  return i === undefined ? -1 : i;
}
/* Nœud sous la souris dans la vue 3D : l'objet touché (et le triangle) → surface, sinon sa pièce ; -1. */
function owEditorPlaceHit(obj, face) {
  const nI = OWPI.list.length;
  let o = obj;
  while (o && !(o.userData && o.userData.el && o.userData.el.kind === 'place')) {
    if (o.userData && typeof o.userData.prim === 'number' && OWPI.prims[o.userData.prim]) return nI + o.userData.prim;
    o = o.parent;
  }
  if (!o) return -1;
  const P = obj && obj.userData && obj.userData.prims;
  if (P && typeof face === 'number' && face >= 0) {
    const v = face * 3;
    let lo = 0, hi = P.length / 3 - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, s = P[m * 3], e = P[m * 3 + 1];
      if (v < s) hi = m - 1; else if (v >= e) lo = m + 1; else return nI + P[m * 3 + 2];
    }
  }
  return o.userData.el.i;
}
