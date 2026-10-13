# Jeu 2.0.3 : tailles réglables (objets par axe, textures par carte et variantes, éléments de jeu).
# Exécuté par build.py après hooks.py ; les aides sont dans src/M0-tailles.js.

# ---------------------------------------------------------------- format des cartes à grille
rep("    if (p.s !== undefined && p.s !== 1) o.s = num(p.s, 0.1, 10, 1);",
    "    { const s = normPropScale(p.s); if (s !== undefined) o.s = s; }   // jeu 2.0.3 : un facteur, ou trois (largeur, hauteur, profondeur)")
rep("      if (typeof w.cost === 'number' && Number.isFinite(w.cost)) o.cost = int(w.cost, 0, 99999, 1000);\n      return withLv(o, lvOf(w.lv));",
    "      if (typeof w.cost === 'number' && Number.isFinite(w.cost)) o.cost = int(w.cost, 0, 99999, 1000);\n      withK(o, w.k);                                     // jeu 2.0.3 : taille du dessin\n      return withLv(o, lvOf(w.lv));")
rep(".map((p) => withLv({ p: p.p, cell: cell(p.cell), face: dir(p.face) }, lvOf(p.lv)));",
    ".map((p) => withLv(withK({ p: p.p, cell: cell(p.cell), face: dir(p.face) }, p.k), lvOf(p.lv)));")
rep(".map((b) => withLv({ cells: two(b.cells), face: dir(b.face) }, lvOf(b.lv)));",
    ".map((b) => withLv(withK({ cells: two(b.cells), face: dir(b.face) }, b.k), lvOf(b.lv)));")
rep("withLv({ cell: cell(raw.power.cell), n: dir(raw.power.n) }, lvOf(raw.power.lv)) : null;",
    "withLv(withK({ cell: cell(raw.power.cell), n: dir(raw.power.n) }, raw.power.k), lvOf(raw.power.lv)) : null;")
rep("withLv({ cells: two(raw.amp.cells), face: dir(raw.amp.face) }, lvOf(raw.amp.lv)) : null;",
    "withLv(withK({ cells: two(raw.amp.cells), face: dir(raw.amp.face) }, raw.amp.k), lvOf(raw.amp.lv)) : null;")
# variantes de textures et tailles de textures de la carte
rep("""    for (const id of Object.keys(ct).slice(0, 64)) {
      const t = ct[id];
      if (!/^u_[\\w-]{1,40}$/.test(id) || !t || typeof t.data !== 'string' || !/^data:image\\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(t.data)) continue;""",
    """    const variants = [];
    for (const id of Object.keys(ct).slice(0, 64)) {
      const t = ct[id];
      // variante (jeu 2.0.3) : sans image, celle de sa base à une autre taille ; lue après les images
      if (/^u_[\\w-]{1,40}$/.test(id) && t && typeof t.data !== 'string' && typeof t.base === 'string') { variants.push([id, t]); continue; }
      if (!/^u_[\\w-]{1,40}$/.test(id) || !t || typeof t.data !== 'string' || !/^data:image\\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(t.data)) continue;""")
rep("""        rough: num(t.rough, 0, 1, 0.85), fit: !!t.fit,
      };
    }
  }
""", """        rough: num(t.rough, 0, 1, 0.85), fit: !!t.fit,
      };
    }
    // variantes : d'une texture de la bibliothèque, ou d'une image de cette carte (pas d'une autre variante)
    for (const [id, t] of variants) {
      const v = normTexVariant(t, (b) => (m.custom.textures[b] ? typeof m.custom.textures[b].data === 'string' : !!TEXLIB[b] && !TEXLIB[b].variant));
      if (v) m.custom.textures[id] = v;
    }
  }
  // tailles des textures sur cette carte (jeu 2.0.3) : { id: [largeur, hauteur] } en mètres
  m.texSizes = normTexSizes(raw.texSizes);
""")
# enregistrement
rep("    boxes: m.boxes.map((b) => lv(b, { cells: b.cells.map((c) => c.slice()), face: b.face.slice() })), boxStart: m.boxStart,",
    "    boxes: m.boxes.map((b) => lv(b, withK({ cells: b.cells.map((c) => c.slice()), face: b.face.slice() }, b.k))), boxStart: m.boxStart,")
rep("    power: m.power ? lv(m.power, { cell: m.power.cell.slice(), n: m.power.n.slice() }) : null,",
    "    power: m.power ? lv(m.power, withK({ cell: m.power.cell.slice(), n: m.power.n.slice() }, m.power.k)) : null,")
rep("    amp: m.amp ? lv(m.amp, { cells: m.amp.cells.map((c) => c.slice()), face: m.amp.face.slice() }) : null,",
    "    amp: m.amp ? lv(m.amp, withK({ cells: m.amp.cells.map((c) => c.slice()), face: m.amp.face.slice() }, m.amp.k)) : null,")
rep("      ? { textures: { ...(m.custom.textures || {}) }, models: { ...(m.custom.models || {}) } } : undefined,",
    "      ? { textures: { ...(m.custom.textures || {}) }, models: { ...(m.custom.models || {}) } } : undefined,\n"
    "    texSizes: m.texSizes && Object.keys(m.texSizes).length ? JSON.parse(JSON.stringify(m.texSizes)) : undefined,")

# ---------------------------------------------------------------- objets : facteurs par axe
rep("""  const s = pr.s || 1, b = info.foot || info.box, r = pr.r || 0, c = Math.cos(r), sn = Math.sin(r);
  const minx = b.min.x * s - 0.25, maxx = b.max.x * s + 0.25, minz = b.min.z * s - 0.25, maxz = b.max.z * s + 0.25;""",
    """  const [sx, , sz] = propScale(pr), b = info.foot || info.box, r = pr.r || 0, c = Math.cos(r), sn = Math.sin(r);
  const minx = b.min.x * sx - 0.25, maxx = b.max.x * sx + 0.25, minz = b.min.z * sz - 0.25, maxz = b.max.z * sz + 0.25;""")
rep("      const top = (pr.y || 0) + info.box.max.y * (pr.s || 1);\n      if (top > 0.15) for (const [cx, cz] of propFootprint(pr, info)) setProp(li, cx, cz, top);",
    "      const top = (pr.y || 0) + info.box.max.y * propScale(pr)[1];\n      if (top > 0.15) for (const [cx, cz] of propFootprint(pr, info)) setProp(li, cx, cz, top);")
rep("""  const s = pr.s || 1;
  return new THREE.Matrix4().compose(new THREE.Vector3(pr.x, pr.y || 0, pr.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pr.r || 0), new THREE.Vector3(s, s, s));""",
    """  const [sx, sy, sz] = propScale(pr);
  return new THREE.Matrix4().compose(new THREE.Vector3(pr.x, pr.y || 0, pr.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pr.r || 0), new THREE.Vector3(sx, sy, sz));""")

# ---------------------------------------------------------------- textures : tailles et variantes
rep("    const B = this.bucket(id), td = TEXLIB[id] || TEXLIB.concrete, sx = td.size[0], sy = td.size[1];",
    "    const B = this.bucket(id), [sx, sy] = texDims(id);")
rep("  const texSize = (id) => TEXLIB[id] || TEXLIB.concrete;\n  for (let li = 0; li < NL; li++) {",
    "  // taille de chaque texture : celle de la carte (texSizes, jeu 2.0.3), sinon celle de la bibliothèque\n"
    "  const texSizeC = new Map();\n"
    "  const texSize = (id) => { let o = texSizeC.get(id); if (!o) { o = { size: texDims(id), fit: texFit(id) }; texSizeC.set(id, o); } return o; };\n"
    "  for (let li = 0; li < NL; li++) {")
rep("gtex = CUR.map.textures.ground, gd = TEXLIB[gtex] || TEXLIB.frost_ground;",
    "gtex = CUR.map.textures.ground, gd = { size: texDims(TEXLIB[gtex] ? gtex : 'frost_ground') };")
rep("function levelTexture(id) {\n  if (LEVEL_TEX[id]) return LEVEL_TEX[id];",
    "function levelTexture(id) {\n  if (TEXLIB[id] && TEXLIB[id].variant) return levelTexture(TEXLIB[id].variant);   // variante : l'image de sa base\n  if (LEVEL_TEX[id]) return LEVEL_TEX[id];")
rep("function levelMaterial(id) {\n  if (LEVEL_MAT[id]) return LEVEL_MAT[id];",
    "function levelMaterial(id) {\n  if (TEXLIB[id] && TEXLIB[id].variant) return levelMaterial(TEXLIB[id].variant);  // les coordonnées de texture font la taille\n  if (LEVEL_MAT[id]) return LEVEL_MAT[id];")
rep("function textureThumb(id, px = 96) {\n  const key = `${id}@${px}`;",
    "function textureThumb(id, px = 96) {\n  if (TEXLIB[id] && TEXLIB[id].variant) return textureThumb(TEXLIB[id].variant, px);\n  const key = `${id}@${px}`;")
rep("    const t = ct[id], old = TEXLIB[id];\n    if (old && old.image === t.data",
    "    const t = ct[id], old = TEXLIB[id];\n    if (!t || typeof t.data !== 'string') continue;        // variante (registerTextureVariants)\n    if (old && old.image === t.data")
rep("  registerCustomTextures(map);\n  registerCustomModels(map);\n  WALL_H = map.ambiance.wallHeight;",
    "  registerCustomTextures(map);\n  registerTextureVariants(map);\n  registerCustomModels(map);\n  WALL_H = map.ambiance.wallHeight;")

# ---------------------------------------------------------------- éléments de jeu : facteur k
# distributeurs : emprise à l'échelle (cases le long du mur et devant), hauteur sous plafond
rep("""function elixirFootprint(p, wallH) {
  const E = ELIXIRS[p.p], [cx, cz] = p.cell, [fx, fz] = p.face;
  const s = Math.min(1, (wallH - 0.04) / E.h);
  const over = (E.w * s) / 2 - 0.5;
  const side = over >= 0.3 ? [[cx + fz, cz - fx], [cx - fz, cz + fx]] : [];
  return { s, side, cells: [[cx, cz], ...side] };
}""", """function elixirFootprint(p, wallH) {
  const E = ELIXIRS[p.p], [cx, cz] = p.cell, [fx, fz] = p.face;
  const s = Math.min(elemK(p.k), (wallH - 0.04) / E.h);         // k : taille choisie (jeu 2.0.3)
  const over = (E.w * s) / 2 - 0.5;
  // une case de chaque côté au-delà de 0,3 m de débord, puis une de plus par mètre
  const n = over >= 0.3 ? Math.floor(over - 0.3) + 1 : 0, side = [];
  for (let i = 1; i <= n; i++) side.push([cx + fz * i, cz - fx * i], [cx - fz * i, cz + fx * i]);
  // plus profonde que sa case : du sol devant elle (au-delà de 5 cm) ; les rangées qu'elle couvre sur
  // plus de 0,5 m sont fermées (à la taille d'origine, aucune : Lazare n'avance que de 0,3 m)
  const ext = E.d * s - 1, deep = ext > 0 ? Math.floor(ext) + (ext - Math.floor(ext) > 0.5 ? 1 : 0) : 0;
  const reachN = Math.max(0, Math.ceil(ext - 0.05)), front = [], reach = [];
  for (let j = 1; j <= Math.max(deep, reachN); j++) for (let i = -n; i <= n; i++) {
    const c = [cx + fx * j + fz * i, cz + fz * j - fx * i];
    if (j <= deep) front.push(c);
    if (j <= reachN) reach.push(c);
  }
  return { s, side, front, reach, cells: [[cx, cz], ...side, ...front] };
}""")
rep("  m.side.forEach(([x, z], i) => setProp(m.li, x, z, Math.min(top, side[i] * m.s)));",
    "  m.side.forEach(([x, z], i) => setProp(m.li, x, z, Math.min(top, side[i % 2] * m.s)));\n  (m.front || []).forEach(([x, z]) => setProp(m.li, x, z, top));")
rep("  for (const [x, z] of m.side) clearProp(m.li, x, z);\n}",
    "  for (const [x, z] of m.side) clearProp(m.li, x, z);\n  for (const [x, z] of m.front || []) clearProp(m.li, x, z);\n}")
rep("    const side = fp.side.filter(([x, z]) => inb(x, z) && grid[node(li, x, z)] === T.FLOOR);",
    "    const side = fp.side.filter(([x, z]) => inb(x, z) && grid[node(li, x, z)] === T.FLOOR);\n    const front = fp.front.filter(([x, z]) => inb(x, z) && grid[node(li, x, z)] === T.FLOOR);")
rep("      id: pm.p, active: true, cell: [cx, cz], side, sinkT: -1, li, E, deep: riseDepth(li, cx + 0.5, cz + 0.5) > 1,",
    "      id: pm.p, active: true, cell: [cx, cz], side, front, sinkT: -1, li, E, deep: riseDepth(li, cx + 0.5, cz + 0.5) > 1,")
rep("""      const front = [p.cell[0] + p.face[0], p.cell[1] + p.face[1]];
      if (D.d > 1.05 && !floorAt(front[0], front[1], lv)) Wn(`Le distributeur ${name} (${D.machine}, ${dec(D.d)} m de profondeur) a besoin de sol libre devant lui.`, P(front, p.lv));
      if (fp.s < 1) Wn(""", """      const front = fp.reach.find(([x, z]) => !floorAt(x, z, lv) || onStairs([x, z], lv));
      if (front) Wn(`Le distributeur ${name} (${D.machine}, ${dec(D.d * fp.s)} m de profondeur) a besoin de sol libre devant lui.`, P(front, p.lv));
      if (fp.s < elemK(p.k) - 1e-3) Wn(""")
rep("(×${dec(fp.s)}) pour tenir sous des murs de ${dec(wh)} m.`, P(p.cell, p.lv));",
    "(×${dec(fp.s)}${p.k ? ` au lieu de ×${dec(elemK(p.k))}` : ''}) pour tenir sous des murs de ${dec(wh)} m.`, P(p.cell, p.lv));")
# Le Glas : rectangle de 6 × 3 m × k ; beffroi à l'échelle (réduit sous un plafond)
rep("  for (const [lx, lz] of [[-3, -1.5], [3, -1.5], [-3, 1.5], [3, 1.5]]) {",
    "  const [hx, hz] = glasHalf(elemK(amp.k));                     // k : taille choisie (jeu 2.0.3)\n  for (const [lx, lz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) {")
rep("  const open = !!CUR.glasOpen, s = open ? 1 : Math.min(1, (WALL_H - 0.06) / 4.75);",
    "  const kk = elemK(L.k), open = !!CUR.glasOpen, s = open ? kk : Math.min(kk, (WALL_H - 0.06) / 4.75);")
rep('''    if (bad) Wn("Le Pack-A-Punch (Le Glas) a besoin de 6 × 3 m de sol libre autour de ses deux cases : son beffroi déborde ici.", P(bad, m.amp.lv));
    if (lv !== A.levels[A.levels.length - 1]) Wn(`Le Pack-A-Punch (Le Glas) est sous un étage : son beffroi de 5,6 m sera réduit pour tenir sous le plafond${where(lv)}.`, P(m.amp.cells[0], m.amp.lv));''',
    '''    const gk = elemK(m.amp.k);
    if (bad) Wn(`Le Pack-A-Punch (Le Glas) a besoin de ${dec(6 * gk)} × ${dec(3 * gk)} m de sol libre autour de ses deux cases : son beffroi déborde ici.`, P(bad, m.amp.lv));
    if (lv !== A.levels[A.levels.length - 1]) Wn(`Le Pack-A-Punch (Le Glas) est sous un étage : son beffroi de ${dec(5.6 * gk)} m sera réduit pour tenir sous le plafond${where(lv)}.`, P(m.amp.cells[0], m.amp.lv));''')
# boîte mystère : taille par emplacement, cases sous la boîte, point d'achat devant elle
rep("    box.locs.push({ cells: b.cells, face: b.face, x: (b.cells[0][0] + b.cells[1][0]) / 2 + 0.5, z: (b.cells[0][1] + b.cells[1][1]) / 2 + 0.5, li, E: LVY[li] });",
    "    const bk = elemK(b.k), sh = boxShift(bk);            // jeu 2.0.3 : agrandie, elle avance (dos contre le mur)\n"
    "    box.locs.push({ cells: b.cells, face: b.face, x: (b.cells[0][0] + b.cells[1][0]) / 2 + 0.5 + b.face[0] * sh, z: (b.cells[0][1] + b.cells[1][1]) / 2 + 0.5 + b.face[1] * sh, li, E: LVY[li], k: bk });")
rep("""  if (prev) for (const [x, z] of prev.cells) clearProp(prev.li, x, z);
  box.cur = i;
  const L = box.locs[i];
  for (const [x, z] of L.cells) setProp(L.li, x, z, 0.78);""",
    """  if (prev) for (const [x, z] of boxCellsOf(prev)) clearProp(prev.li, x, z);
  box.cur = i;
  const L = box.locs[i], bk = L.k || 1;
  for (const [x, z] of boxCellsOf(L)) setProp(L.li, x, z, 0.78 * bk);""")
rep("""  box.root.rotation.y = Math.atan2(L.face[0], L.face[1]);
  box.root.visible = true;""", """  box.root.rotation.y = Math.atan2(L.face[0], L.face[1]);
  box.root.scale.setScalar(bk);                         // jeu 2.0.3 : taille de l'emplacement
  box.root.visible = true;""")
rep("""  box.inter.x = L.x + L.face[0] * 1.0;
  box.inter.z = L.z + L.face[1] * 1.0;""", """  box.inter.x = L.x + L.face[0] * boxReach(bk);
  box.inter.z = L.z + L.face[1] * boxReach(bk);""")
rep("""  m.boxes.forEach((b, i) => {
    if (!b.cells.every(([x, z]) => floorAt(x, z, b.lv | 0))) Wn(`Emplacement de boîte mystère n° ${i + 1} hors du sol.`, P(b.cells[0], b.lv));""",
    """  m.boxes.forEach((b, i) => {
    const bk = elemK(b.k), sh = boxShift(bk);
    const bc = bk > 1 ? boxFootCells((b.cells[0][0] + b.cells[1][0]) / 2 + 0.5 + b.face[0] * sh, (b.cells[0][1] + b.cells[1][1]) / 2 + 0.5 + b.face[1] * sh, b.face, bk).find(([x, z]) => !floorAt(x, z, b.lv | 0)) : null;
    if (bc) Wn(`Emplacement de boîte mystère n° ${i + 1} agrandi (×${dec(bk)}) : la boîte déborde hors du sol.`, P(bc, b.lv));
    if (!b.cells.every(([x, z]) => floorAt(x, z, b.lv | 0))) Wn(`Emplacement de boîte mystère n° ${i + 1} hors du sol.`, P(b.cells[0], b.lv));""")
rep("        for (const [x, z] of box.locs[box.cur].cells) clearProp(box.locs[box.cur].li, x, z);",
    "        for (const [x, z] of boxCellsOf(box.locs[box.cur])) clearProp(box.locs[box.cur].li, x, z);")
# panneaux peints : taille (jeu 2.0.3)
rep(".filter((s) => s && vec3(s.pos) && dir(s.n) && lvOf(s.lv) !== null).map((s) => withLv({ text: str(s.text, 28).toUpperCase(), pos: vec3(s.pos), n: dir(s.n) }, lvOf(s.lv)));",
    ".filter((s) => s && vec3(s.pos) && dir(s.n) && lvOf(s.lv) !== null).map((s) => withLv(withK({ text: str(s.text, 28).toUpperCase(), pos: vec3(s.pos), n: dir(s.n) }, s.k), lvOf(s.lv)));")
rep("    signs: m.signs.map((s) => lv(s, { text: s.text, pos: s.pos.slice(), n: s.n.slice() })), risers: m.risers.map((c) => c.slice()),",
    "    signs: m.signs.map((s) => lv(s, withK({ text: s.text, pos: s.pos.slice(), n: s.n.slice() }, s.k))), risers: m.risers.map((c) => c.slice()),")
rep("    const m = new THREE.Mesh(GEO.plane, mat);\n    m.scale.set(1.7, 0.42, 1);\n    m.position.set(s.pos[0], y, s.pos[2]);",
    "    const m = new THREE.Mesh(GEO.plane, mat), sk = elemK(s.k);\n    m.scale.set(1.7 * sk, 0.42 * sk, 1);                     // jeu 2.0.3 : taille du panneau\n    m.position.set(s.pos[0], y, s.pos[2]);")
# interrupteur et armes au mur : à l'échelle
rep("  ps.group.rotation.y = Math.atan2(nx, nz);\n  ps.group.userData.lv = LV[li];",
    "  ps.group.rotation.y = Math.atan2(nx, nz);\n  ps.group.scale.setScalar(elemK(LAYOUT.power.k));        // jeu 2.0.3 : taille choisie\n  ps.group.userData.lv = LV[li];")
rep("    const mesh = new THREE.Mesh(GEO.plane, mat);\n    mesh.scale.set(1.6, 0.8, 1);\n    mesh.position.set(fx, E + 1.65, fz);",
    "    const mesh = new THREE.Mesh(GEO.plane, mat), wk = elemK(wb.k);\n    mesh.scale.set(1.6 * wk, 0.8 * wk, 1);                 // jeu 2.0.3 : taille du dessin\n    mesh.position.set(fx, E + 1.65, fz);")

# ---------------------------------------------------------------- interface 5 des Mod Tools
rep("  normalizeMap, serializeMap, validateMap, analyzeMap, blankMap, buildWorld, disposeWorld, textureThumb, modelParts, PropBatch,",
    "  normalizeMap, serializeMap, validateMap, analyzeMap, blankMap, buildWorld, disposeWorld, textureThumb, modelParts, PropBatch,\n"
    "  /* interface 5 (jeu 2.0.3) : tailles des objets, des textures, des bâtiments et des éléments de jeu */\n"
    "  SIZE_RULES, propScale, normPropScale, elemK, texDims, texFit, normTexSizes, registerTextureVariants, boxFootCells, boxShift, boxReach, elixirFootprint, glasFootprint,")
rep("bldRect: owBldRect, namedLocs: () => owNamedLocs(OW.map),",
    "bldRect: owBldRect, bldLimits: owBldLimits, bldDims: owBldDims, bldSize: owBldSize, namedLocs: () => owNamedLocs(OW.map),")
