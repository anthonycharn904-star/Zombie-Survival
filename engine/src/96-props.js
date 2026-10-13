/* ------------------------------------------------- Objets de la carte --
   Objets de la bibliothèque posés par les Mod Tools sur une carte ouverte (caisses, fûts, barrières,
   véhicules en ruine, arbres…). Posés sur le sol des lieux (y : décalage au-dessus) ; ceux qui sont
   pleins arrêtent les corps et les balles (cases basses, jusqu'à leur hauteur). Dans les Mod Tools,
   un groupe par objet (sélection, déplacement) ; en partie, tout est fusionné. */
function owPropGround(pr) {
  const g = owBaseGround(0, pr.x, pr.z);
  return Number.isFinite(g) ? g : owH(pr.x, pr.z);
}
function owBuildProps(root, map, perProp = false) {
  const group = new THREE.Group();
  group.name = 'objets';
  group.userData.props = true;
  const batch = perProp ? null : new PropBatch();
  map.props.forEach((pr, i) => {
    const def = MODELS[pr.m];
    const info = def ? modelParts(pr.m) : null;
    if (!info) return;
    const E = owPropGround(pr);
    const matrix = propMatrix({ ...pr, y: E + (pr.y || 0) });
    if (def.glb) {
      const o = glbObject(pr.m);
      if (o) {
        const g = new THREE.Group();
        g.add(o);
        g.applyMatrix4(matrix);
        if (perProp) { g.userData.prop = i; o.traverse((c) => { if (c.isMesh) c.userData.prop = i; }); }
        group.add(g);
      }
    } else if (perProp) {
      const g = new THREE.Group();
      g.userData.prop = i;
      const b = new PropBatch();
      b.add(info.parts, new THREE.Matrix4(), pr.c);
      b.build(g, { prop: i });
      g.applyMatrix4(matrix);
      group.add(g);
    } else batch.add(info.parts, matrix, pr.c);
    const solid = typeof pr.solid === 'boolean' ? pr.solid : def.solid;
    if (solid && !def.decal) {
      const top = (pr.y || 0) + info.box.max.y * propScale(pr)[1];
      if (top > 0.15) {
        for (const [cx, cz] of propFootprint(pr, info)) {
          const c = owBaseRec(OW.surf, cx, cz);
          const k = c && !c.none ? c.kind : OWK.TERRAIN;
          if (k !== OWK.TERRAIN && k !== OWK.FLOOR && k !== OWK.LOW) continue;
          const g0 = k === OWK.TERRAIN ? owH(cx + 0.5, cz + 0.5) : k === OWK.FLOOR ? c.base : c.base;
          const cur = owChunk(OW.surf, cx, cz), ci = owIdx(cx, cz);
          const prevTop = cur && cur.kind[ci] === OWK.LOW ? cur.top[ci] : -Infinity;
          owSet(OW.surf, cx, cz, OWK.LOW, { base: g0, top: Math.max(prevTop, E + top), mat: OWM.WOOD });
        }
      }
    }
  });
  if (batch) batch.build(group);
  linearizeTree(group);
  root.add(group);
  return group;
}

/* ---- Éléments de la carte : armes au mur, atouts, boîte, jerricans, disjoncteurs, objets (leurs cases
   dans le journal), puis les véhicules. Un sous-arbre à part : les Mod Tools le refont seul. */
function owBuildElements(root, map, opts = {}) {
  const g = new THREE.Group();
  g.name = 'carte';
  OW.elemRoot = g;
  OW.elObjs = { wallbuy: [], perk: [], box: [], fuel: [], breaker: [], vehicle: [], building: [], oxy: [], glas: [] };
  // bâtiments ajoutés d'abord (journal B) : les éléments se posent sur leurs murs et leurs sols
  owLogBegin(OWLOGB);
  try { owBuildBuildings(g, map); } finally { owLogEnd(); }
  owLogBegin(OWLOG);
  try {
    owBuildFeatures(g, map);
    OW.propsRoot = owBuildProps(g, map, !!opts.perProp);
  } finally { owLogEnd(); }
  owBuildVehicles(g, map);
  root.add(g);
  return g;
}
/* Refait les éléments d'une carte déjà chargée (Mod Tools). */
function owRebuildElements(map, opts = {}) {
  if (!OW.on || !World.root) return null;
  if (VEH.drive) vehExit(true);
  if (OW.elemRoot) {
    if (VEH.light && VEH.light.parent) VEH.light.parent.remove(VEH.light, VEH.light.target);
    World.root.remove(OW.elemRoot);
    disposeObject(OW.elemRoot);
    OW.elemRoot = null;
  }
  Features.interactables = Features.interactables.filter((it) => !it.el);
  Features.perkMachines = [];
  Features.box = null;
  owBoxRelease();
  owLogUndoAll();
  if (opts.places) { registerCustomTextures(map); owItemsApply(map); }   // jeu 2.0.3 : décor des lieux retouché (Mod Tools)
  registerCustomModels(map);
  const g = owBuildElements(World.root, map, opts);
  linearizeTree(g);
  return g;
}
