/* ---------------------------------------------------- Éléments de jeu --
   Armes au mur (craie), atouts (les cinq Élixirs, répartis entre les lieux), boîte mystère (qui
   voyage d'un lieu à l'autre), jerricans (plein du véhicule le plus proche), disjoncteurs (tous
   tenus : le courant). Les mécanismes sont ceux du jeu (achat, boisson, tirage) ; les emplacements
   viennent de la carte (voir « Cartes ouvertes » : la carte intégrée, ou celle des Mod Tools). */
const KHF = { breakers: [], fuel: [] };
/* Hauteur d'un élément : celle de la carte (relevée par les Mod Tools), sinon le sol des lieux sous lui. */
function owElemY(e) {
  if (typeof e.y === 'number' && Number.isFinite(e.y)) return e.y;
  const g = owBaseGround(0, e.x, e.z);
  return Number.isFinite(g) ? g : owH(e.x, e.z);
}
const KH_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/* Objet 3D d'un élément (Mod Tools : sélection, déplacement en direct) : OW.elObjs[genre][indice]. */
function owTagEl(o, kind, i) {
  o.userData.el = { kind, i };
  if (OW.elObjs) (OW.elObjs[kind] || (OW.elObjs[kind] = []))[i] = o;
  return o;
}
/* Éléments de la carte (map : carte ouverte normalisée). Leurs cases sont écrites pendant le journal
   (owLogBegin) : les Mod Tools les retirent et les reposent sans refaire les lieux. */
function owBuildFeatures(root, map) {
  const group = new THREE.Group();
  group.name = 'éléments';
  Features.group = group;
  const n0 = Features.interactables.length;
  // armes au mur
  map.wallbuys.forEach((wb, i) => owTagEl(owWallbuy(group, { ...wb, y: owElemY({ x: wb.x + wb.nx * 0.6, z: wb.z + wb.nz * 0.6, y: wb.y }) }), 'wallbuy', i));
  // atouts
  map.perks.forEach((pm, i) => owTagEl(owPerk(group, { id: pm.p, x: pm.x, y: owElemY(pm), z: pm.z, face: pm.face, roomH: pm.roomH, k: pm.k }), 'perk', i));
  // boîte mystère : au premier emplacement au départ, puis ailleurs
  const spots = map.boxes.map((b) => ({ ...b, y: owElemY(b) }));
  LAYOUT.boxes = spots.map((b) => ({ cells: [[b.x - 0.5, b.z - 0.5], [b.x - 0.5, b.z - 0.5]], face: b.face, lv: 0 }));
  LAYOUT.boxStart = clamp(map.boxStart | 0, 0, Math.max(0, spots.length - 1));
  Features.box = null;
  if (spots.length) {
    buildBox(group);
    Features.box.locs.forEach((L, i) => {
      // jeu 2.0.3 : agrandie ou réduite, la boîte garde son dos en place (elle avance vers sa face)
      const k = elemK(spots[i].k), sh = boxShift(k);
      L.E = spots[i].y; L.x = spots[i].x + L.face[0] * sh; L.z = spots[i].z + L.face[1] * sh; L.ow = true; L.k = k;
      L.locked = khPyrLock(L.x, L.z, L.E);                  // jeu 2.0.3 : derrière la herse fermée d'une pyramide
    });
    placeBox(Features.box.cur);
    owTagEl(Features.box.root, 'box', Features.box.cur);
  }
  // jerricans (une pile chacun)
  KHF.fuel = map.fuel.map((f) => ({ ...f, y: owElemY(f) }));
  if (KHF.fuel.length) {
    // en partie, une seule pile de maillages ; dans les Mod Tools, une par emplacement (sélection)
    let K = CUR.editor ? null : owKit('jerricans');
    KHF.fuel.forEach((f, i) => {
      if (CUR.editor) K = owKit(`jerricans ${i + 1}`);
      khJerricans(K, f.x, f.y, f.z, elemK(f.k));             // k : taille (jeu 2.0.3)
      Features.interactables.push(owFuelPoint(f));
      if (CUR.editor) { const g = K.build(group); g.userData.at = [f.x, f.y, f.z]; owTagEl(g, 'fuel', i); }
    });
    if (!CUR.editor) K.build(group);
  }
  // disjoncteurs (tous enclenchés : le courant)
  KHF.breakers = map.breakers.map((b, i) => owBreaker(group, { ...b, y: owElemY(b) }, i));
  KHF.breakers.forEach((B, i) => owTagEl(B.g, 'breaker', i));
  // Lune : postes d'oxygène, Le Glas au fond
  if (OW.worldId === 'lune') luBuildFeatures(group, map);
  for (let i = n0; i < Features.interactables.length; i++) Features.interactables[i].el = true;
  linearizeTree(group);
  root.add(group);
}
function owResetFeatures() {
  for (const b of KHF.breakers) { b.held = 0; b.done = false; owBreakerLook(b); }
}

/* ---- Arme au mur : dessin à la craie sur le support, achat et munitions comme ailleurs */
function owWallbuy(group, wb) {
  const def = WEAPONS[wb.w], price = wallbuyPrice(wb);
  const mat = new THREE.MeshStandardMaterial({ map: chalkTexture(wb.w), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(GEO.plane, mat), wk = elemK(wb.k);
  mesh.scale.set(1.6 * wk, 0.8 * wk, 1);                 // jeu 2.0.3 : taille du dessin
  mesh.position.set(wb.x + wb.nx * 0.02, wb.y + wb.h, wb.z + wb.nz * 0.02);
  mesh.lookAt(mesh.position.x + wb.nx, mesh.position.y, mesh.position.z + wb.nz);
  group.add(mesh);
  mesh.userData.h = wb.h;
  Features.interactables.push({
    kind: 'wallbuy', x: wb.x + wb.nx * 0.75, z: wb.z + wb.nz * 0.75, y: wb.y, r: 1.35,
    prompt() {
      const slot = Arms.slots.find((s) => s && s.id === wb.w);
      if (!slot) return { text: `Appuyez sur F pour acheter ${def.name}`, cost: price };
      if (slot.res >= wstat(slot, 'res')) return { text: 'Munitions au maximum', disabled: true };
      return { text: `Appuyez sur F pour acheter des munitions (${wstat(slot, 'name')})`, cost: slot.up ? RULES.ampAmmoCost : Math.round(price / 2) };
    },
    use() {
      if (armsBusy()) return;
      const slot = Arms.slots.find((s) => s && s.id === wb.w);
      if (!slot) { if (trySpend(price)) { giveWeapon(wb.w); Life.add('wallbuys'); } return; }
      if (slot.res >= wstat(slot, 'res')) return;
      if (trySpend(slot.up ? RULES.ampAmmoCost : Math.round(price / 2))) { slot.res = wstat(slot, 'res'); HUD.weapon(); }
    },
  });
  return mesh;
}

/* ---- Atout : machine posée dos au mur (face vers l'avant), boisson comme ailleurs */
function owPerk(group, pm) {
  const D = ELIXIRS[pm.id], [fx, fz] = pm.face;
  const roomH = pm.roomH || 6, s = Math.min(elemK(pm.k), (roomH - 0.05) / D.h);   // k : taille choisie (jeu 2.0.3)
  const built = buildPerkMachine(pm.id, s);
  built.group.position.set(pm.x, pm.y, pm.z);
  built.group.rotation.y = Math.atan2(fx, fz);
  group.add(built.group);
  const depth = D.d * s;
  const m = Object.assign(built, {
    id: pm.id, active: true, cell: [Math.floor(pm.x), Math.floor(pm.z)], side: [], sinkT: -1, li: 0, E: pm.y, deep: true,
    lightLocal: built.light.pos.clone(), worldPos: new THREE.Vector3(pm.x + fx * depth * 0.5, pm.y + 1.2, pm.z + fz * depth * 0.5), ceilY: roomH / s,
  });
  built.group.updateMatrixWorld(true);
  lightMachine(m, !PERKS[pm.id].power);
  updateElixir(m, 0);
  Features.perkMachines.push(m);
  // emprise au sol (la machine arrête les corps et les balles)
  const w = D.w * s, rx = -fz, rz = fx;
  const ax = [pm.x + rx * w / 2, pm.x - rx * w / 2, pm.x + rx * w / 2 + fx * depth, pm.x - rx * w / 2 + fx * depth];
  const az = [pm.z + rz * w / 2, pm.z - rz * w / 2, pm.z + rz * w / 2 + fz * depth, pm.z - rz * w / 2 + fz * depth];
  owFill(OW.surf, Math.min(...ax) + 0.15, Math.min(...az) + 0.15, Math.max(...ax) - 0.15, Math.max(...az) - 0.15, OWK.LOW, { base: pm.y, top: pm.y + Math.min(roomH, D.h * s), mat: OWM.METAL });
  Features.interactables.push({
    kind: 'perk', machine: m, x: pm.x + fx * (depth + 0.6), z: pm.z + fz * (depth + 0.6), y: pm.y, r: 1.6,
    prompt() {
      if (!m.active || (Arms.state === 'drink' && Arms.drinkId === m.id)) return null;
      const perk = PERKS[m.id];
      if (perk.power && !G.power) return { text: `Il faut d'abord rétablir le courant (${OW.worldId === 'lune' ? 'crête solaire' : 'centrale du Nil'})`, disabled: true };
      if (player.perks.has(m.id)) return null;
      if (player.perks.size >= MAX_PERKS) return { text: `Vous avez déjà ${MAX_PERKS} atouts`, disabled: true };
      return { text: `Appuyez sur F pour boire ${perk.name}`, cost: perk.cost, sub: perk.desc };
    },
    use() {
      if (!m.active || armsBusy() || player.perks.has(m.id) || player.perks.size >= MAX_PERKS) return;
      if (PERKS[m.id].power && !G.power) return;
      if (trySpend(PERKS[m.id].cost)) { startDrink(m.id); elixirPlay(m); Life.add('perks'); }
    },
  });
  return built.group;
}
/* Boîte mystère : ses deux cases deviennent des solides bas (et retrouvent leur état quand elle part).
   OWBOX.at : l'emplacement qui les tient ; owBoxRelease les rend avant de refaire les éléments (la
   boîte a pu voyager pendant une partie, hors du journal des cases). */
const OWBOX = { at: null };
function owBoxRelease() {
  const L = OWBOX.at;
  OWBOX.at = null;
  if (L && L.owSaved) { for (const c of L.owSaved) owSet(OW.surf, c.x, c.z, c.kind, c); L.owSaved = null; }
}
function owBoxProp(prev, L) {
  if (prev && prev.owSaved) for (const c of prev.owSaved) owSet(OW.surf, c.x, c.z, c.kind, c);
  if (prev) prev.owSaved = null;
  const rx = -L.face[1], rz = L.face[0], bk = L.k || 1;
  L.owSaved = [];
  // cases sous la boîte : deux à la taille d'origine, davantage si elle est agrandie (jeu 2.0.3)
  const cells = Math.abs(bk - 1) > 1e-3 ? boxFootCells(L.x, L.z, L.face, bk) : [0.5, -0.5].map((sd) => [Math.floor(L.x + rx * sd), Math.floor(L.z + rz * sd)]);
  for (const [x, z] of cells) {
    const ch = owChunk(OW.surf, x, z), i = owIdx(x, z);
    const c = ch ? { x, z, kind: ch.kind[i], base: ch.base[i], top: ch.top[i], lo: ch.lo[i], hi: ch.hi[i], ceil: ch.ceil[i], roof: ch.roof[i], dir: ch.dir[i], mat: ch.mat[i], door: ch.door[i] } : { x, z, kind: OWK.TERRAIN };
    if (c.kind !== OWK.TERRAIN && c.kind !== OWK.FLOOR) continue;
    L.owSaved.push(c);
    owSet(OW.surf, x, z, OWK.LOW, { base: L.E, top: L.E + 0.8 * bk, mat: OWM.WOOD });
  }
  OWBOX.at = L;
}

/* ---- Jerricans : plein du véhicule le plus proche (deux jerricans font le plein) */
function owFuelPoint(f) {
  const near = () => {
    let best = null, bd = 14;
    for (const V of VEH.list) { const d = Math.hypot(V.x - f.x, V.z - f.z); if (d < bd && V.fuel < V.T.fuel - 1) { bd = d; best = V; } }
    return best;
  };
  return {
    kind: 'fuel', x: f.x, z: f.z, y: f.y, r: 1.6,
    prompt() {
      const V = near();
      if (!V) return { text: 'Jerricans : amenez un véhicule à moins de 14 m', disabled: true };
      return { text: `Appuyez sur F pour faire le plein (${V.T.short})`, sub: `Carburant ${Math.round((V.fuel / V.T.fuel) * 100)} %` };
    },
    use() {
      const V = near();
      if (!V) return;
      V.fuel = V.T.fuel;
      Sound.gulp(0);
      HUD.hint(`Plein fait : ${V.T.name}`, 2);
    },
  };
}

/* ---- Disjoncteurs de la centrale : armoire, levier, voyant ; F maintenue 4 s chacun */
function owBreaker(group, b, i) {
  const g = new THREE.Group(), bk = elemK(b.k);
  g.position.set(b.x, b.y, b.z);
  g.rotation.y = Math.atan2(b.nx, b.nz);
  g.scale.setScalar(bk);                                 // jeu 2.0.3 : taille choisie
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a6a62, roughness: 0.55, metalness: 0.4 }));
  cab.position.set(0, 1.0, 0.2); g.add(cab);
  const lever = new THREE.Group(); lever.position.set(0.18, 1.0, 0.42);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6 }));
  arm.position.y = 0.17; lever.add(arm);
  const knob = new THREE.Mesh(GEO.sph, new THREE.MeshStandardMaterial({ color: 0xb83a28, roughness: 0.5 }));
  knob.scale.setScalar(0.06); knob.position.y = 0.36; lever.add(knob);
  g.add(lever);
  const lamp = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  lamp.scale.setScalar(0.05); lamp.position.set(-0.25, 1.6, 0.42); g.add(lamp);
  const plate = vehDecal([[`DISJONCTEUR ${KH_ROMAN[i] || i + 1}`, 0.5, 0.5, 700]], 0.7, 0.14, '#e8e0cc');
  plate.position.set(0, 1.62, 0.405); g.add(plate);
  group.add(g);
  owFill(OW.surf, b.x - 0.45 * bk, b.z - 0.45 * bk, b.x + 0.45 * bk, b.z + 0.45 * bk, OWK.LOW, { base: b.y, top: b.y + 1.8 * bk, mat: OWM.METAL });
  const B = { ...b, i, g, lever, lamp, held: 0, done: false };
  Features.interactables.push({
    kind: 'breaker', x: b.x + b.nx * (0.5 + 0.4 * bk), z: b.z + b.nz * (0.5 + 0.4 * bk), y: b.y, r: 1.5, hold: true,
    prompt() {
      if (B.done || G.power) return null;
      const n = KHF.breakers.filter((q) => q.done).length;
      return { text: `Maintenez F pour enclencher le disjoncteur (${b.name})`, sub: `${Math.round((B.held / 4) * 100)} % · ${n}/${KHF.breakers.length} enclenchés` };
    },
    useHold(dt) {
      if (B.done || G.power) return;
      B.held = Math.min(4, B.held + dt);
      B.lever.rotation.x = -1.1 * (B.held / 4);
      if (B.held >= 4) {
        B.done = true; owBreakerLook(B);
        Sound.powerOn(); Sound.setHum(false);          // pas de bourdonnement électrique dans tout le désert
        const n = KHF.breakers.filter((q) => q.done).length;
        const N = KHF.breakers.length;
        if (n >= N) activatePower();
        else HUD.banner(`Disjoncteur ${KH_ROMAN[i] || i + 1}`, `${n}/${N} enclenchés · il en reste ${N - n}`, 'power');
      }
    },
  });
  return B;
}
function owBreakerLook(B) {
  B.lamp.material.color.setHex(B.done || G.power ? 0x40ff60 : 0xff2a1a);
  B.lever.rotation.x = B.done || G.power ? -1.1 : 0;
}
