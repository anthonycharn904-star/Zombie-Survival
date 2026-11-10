/* ========================================================================== 40 TÊTES AU BÉRET ==
   Cinquième easter egg secondaire de Bunker 7 (demande d'Anthony du 9 novembre 2026, pour le jeu 2.0.7) : trois têtes de
   zombie au béret (son modèle, engine/orig/tete-beret/, inséré tel quel par build.py dans TETE_BERET_GLB), posées aux trois
   places qu'il a montrées : sur le toit du wagon rouge, face à l'horloge de la gare (abords) ; sur le socle de la machine
   de Quick Revive ; sur le cadre de l'ouverture du plafond, au-dessus du Glas (Salle des machines). Légèrement
   illuminées pour qu'on les voie. Une balle sur une tête : un petit son (l'easter egg est en cours), un souffle de fumée,
   la tête disparaît. Les trois : « Atout gratuit » et « Munitions max » près du joueur ; écran « Secrets » : b7-tetes.
   · Une fois par partie ; seulement sur Bunker 7 ; pas pendant le combat du boss. Balles seulement.
   · Modèle : les 17 maillages du fichier réunis en une géométrie (couleurs de sommets du fichier : entiers normalisés et
     valeurs sRGB, ramenées entre 0 et 1 puis converties en linéaire, comme l'aperçu d'Anthony le montre), une matière
     à nous (MeshStandard à couleurs de sommets, un peu d'émission) ; lueur : un sprite additif ; aucune lampe ajoutée.
   Points d'accroche : tools/hooks-tetes.py.
   ============================================================================ */
const TB = {
  echelle: 1.3,                                // le modèle fait 0,24 × 0,40 m
  vie: 30,                                     // s : bonus au sol
  geo: null, mat: null, glow: null, groupe: null, tetes: [], fait: false, charge: false,
};
/* Le modèle : décodé une fois (GLTFLoader), ses maillages réunis en une géométrie (position, normale, couleur). */
function tbCharger() {
  if (TB.charge || typeof TETE_BERET_GLB !== 'string' || !THREE.GLTFLoader) return;
  TB.charge = true;
  let buf;
  try {
    const bin = atob(TETE_BERET_GLB), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    buf = u8.buffer;
  } catch (e) { console.warn('[têtes] modèle illisible', e); return; }
  new THREE.GLTFLoader().parse(buf, '', (gltf) => {
    const sc = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!sc) return;
    sc.updateMatrixWorld(true);
    const P = [], N = [], C = [], col = new THREE.Color();
    sc.traverse((o) => {
      if (!o.isMesh) return;
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, m = Array.isArray(o.material) ? o.material[0] : o.material;
      // couleurs glTF en entiers normalisés : three r128 ne les ramène pas entre 0 et 1 à la lecture
      const kc = c && c.normalized ? 1 / (c.array instanceof Uint16Array ? 65535 : c.array instanceof Uint8Array ? 255 : 1) : 1;
      for (let i = 0; i < p.count; i++) {
        P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i));
        if (c) col.setRGB(c.getX(i) * kc, c.getY(i) * kc, c.getZ(i) * kc); else col.copy(m && m.color ? m.color : col.setRGB(0.5, 0.5, 0.5));
        if (m && m.color && c) col.multiply(m.color);
        col.convertSRGBToLinear();                 // couleurs du fichier données en sRGB (sinon 2 à 3 fois trop claires, comme l'aperçu d'Anthony le montre)
        C.push(col.r, col.g, col.b);
      }
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    TB.geo = share(geo);
    TB.mat = share(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, emissive: 0x24201e, emissiveIntensity: 1 }));
    TB.mat.emissive.convertSRGBToLinear(); _linDone.add(TB.mat);
    TB.glow = share(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x9fe07a, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    TB.glow.color.convertSRGBToLinear(); _linDone.add(TB.glow);
    TB.glowLoin = share(TB.glow.clone()); TB.glowLoin.opacity = 0.42; _linDone.add(TB.glowLoin);   // la tête du wagon, dehors dans la brume
    tbPoser();
  }, (e) => console.warn('[têtes] modèle illisible', e));
}
/* Les trois places (calculées d'après la carte : gare des abords, machine de Quick Revive, ouverture du Glas). */
function tbPlaces() {
  const L = [];
  // 1) toit du wagon rouge de la gare, face à l'horloge (repère du wagon dans le modèle ruin_station)
  const st = World.outskirts && World.outskirts.buildings && World.outskirts.buildings.find((b) => b.id === 'ruin_station');
  if (st) {
    const Ms = new THREE.Matrix4().compose(new THREE.Vector3(st.x, 0, st.z), new THREE.Quaternion().setFromAxisAngle(_vUp, st.r), new THREE.Vector3(1, 1, 1));
    const v = new THREE.Vector3(2.4, 3.05, 0.2).applyMatrix4(Ms.multiply(mtx(-3.6, 0.5, 8.3, 0, 0.12, 0.09)));
    L.push({ nom: 'wagon', x: v.x, y: v.y, z: v.z, ry: st.r });
  }
  // 2) socle de la machine de Quick Revive : coin gauche du dessus du socle, tourné vers la salle
  const qr = Features.perkMachines && Features.perkMachines.find((m) => m.id === 'souffle');
  const g = qr && (qr.group || qr.root);
  if (g) {
    const ry = g.rotation.y, v = new THREE.Vector3(-0.45, 1.34, 0.55).applyAxisAngle(_vUp, ry).add(g.position);
    L.push({ nom: 'quick-revive', x: v.x, y: v.y, z: v.z, ry, li: qr.li || 0, m: qr });
  }
  // 3) cadre de l'ouverture du plafond au-dessus du Glas : milieu du côté est, tourné vers l'ouest (on la voit par l'ouverture,
  //    du côté ouest de la salle : de l'est, le plafond la cache)
  const a = Features.amp;
  if (a && CUR.glasOpen) {
    const [x0, z0, x1, z1] = CUR.glasOpen;
    L.push({ nom: 'glas', x: x1 - 0.1, y: a.E + WALL_H + 0.23, z: (z0 + z1) / 2, ry: -Math.PI / 2, li: a.li || 0 });
  }
  return L;
}
/* Pose les têtes (au chargement du modèle, et à chaque partie). */
function tbPoser() {
  if (!TB.geo) return;
  if (!TB.groupe) { TB.groupe = new THREE.Group(); TB.groupe.name = 'tetes-beret'; }
  for (const t of TB.tetes) TB.groupe.remove(t.g);
  TB.tetes = [];
  if (!tbCarte()) { if (TB.groupe.parent) TB.groupe.parent.remove(TB.groupe); return; }
  for (const p of tbPlaces()) {
    const g = new THREE.Group();
    const e = p.nom === 'wagon' ? TB.echelle * 1.3 : TB.echelle;   // dehors, à 19 m dans la brume : un peu plus grande et plus lumineuse
    const m = new THREE.Mesh(TB.geo, TB.mat); m.scale.setScalar(e); g.add(m);
    const h = new THREE.Sprite(p.nom === 'wagon' ? TB.glowLoin : TB.glow); h.position.set(0, 0.22 * e, -0.05); h.scale.setScalar(p.nom === 'wagon' ? 1.8 : 0.9); g.add(h);
    g.position.set(p.x, p.y, p.z); g.rotation.y = p.ry;
    TB.groupe.add(g);
    const cx = Math.floor(p.x), cz = Math.floor(p.z), k = inb(cx, cz) ? node(p.li || 0, cx, cz) : -2;   // case de la grille (une machine y est pleine)
    TB.tetes.push({ nom: p.nom, g, cx: p.x, cy: p.y + 0.2 * e, cz: p.z, r: 0.17 * e + 0.04, touchee: false, k, m: p.m || null, e, sol: p.m ? LVY[p.li || 0] : 0, vy: 0, tombee: false });
  }
  const parent = World.root || scene;          // avec le monde : caché dans la salle du boss, retiré avec la carte
  if (TB.groupe.parent !== parent) parent.add(TB.groupe);
}
const tbCarte = () => !OW.on && !!CUR.map && CUR.map.id === BUNKER7.id && !CUR.editor;
/* (resetFeatures) : trois têtes neuves. */
function tbRemettre() {
  TB.fait = false;
  if (!TB.charge) tbCharger();
  tbPoser();
}
function tbActif() {
  if (TB.fait || !tbCarte() || G.mapId !== BUNKER7.id || !TB.tetes.length) return false;
  if (typeof B7 === 'object' && B7.actif) return false;
  if (World.root && !World.root.visible) return false;
  return true;
}
/* Rayon d'un tir contre les têtes encore là : distance, ou −1 ; la tête dans TB.t. */
function tbRayon(ox, oy, oz, dx, dy, dz, maxT) {
  if (!tbActif()) return -1;
  let best = -1;
  for (const t of TB.tetes) {
    if (t.touchee) continue;
    const px = t.cx - ox, py = t.cy - oy, pz = t.cz - oz, tt = px * dx + py * dy + pz * dz;
    if (tt <= 0 || tt >= maxT || (best >= 0 && tt >= best)) continue;
    const d2 = px * px + py * py + pz * pz - tt * tt;
    if (d2 > t.r * t.r) continue;
    best = tt - Math.sqrt(t.r * t.r - d2); TB.t = t;
  }
  return best;
}
/* Une tête touchée : petit son, souffle de fumée verte, elle disparaît ; les trois : la récompense. */
function tbTouche(x, y, z) {
  const t = TB.t;
  if (!t || t.touchee) return;
  t.touchee = true; t.g.visible = false;
  for (let i = 0; i < 4; i++) spawnPuff(t.cx + rand(-0.15, 0.15), t.cy + rand(-0.1, 0.2), t.cz + rand(-0.15, 0.15), rand(0.5, 0.9), rand(0.8, 1.4), 0x4a6a3a, 0.55, 0.4);
  for (let i = 0; i < 10; i++) FX.embers.emit(t.cx, t.cy, t.cz, rand(-1, 1), rand(0.5, 2), rand(-1, 1), rand(0.4, 0.8), 0.6, 0.9, 0.4);
  const n = TB.tetes.filter((q) => q.touchee).length;
  tbSon(t, n, n === TB.tetes.length);
  if (n === TB.tetes.length) tbReussite();
}
function tbReussite() {
  TB.fait = true;
  if (typeof secretDecouvert === 'function') secretDecouvert('b7-tetes');   // écran « Secrets » de l'Interface (2.0.7)
  const [a, b] = horlPlaces();
  if (atgLibres().length) atgPoser(a.x, a.z, a.gy, TB.vie);
  spawnPowerup('ammo', b.x, b.z, b.gy); Powerups.list[Powerups.list.length - 1].life = TB.vie;
}
/* Petit son (pour tout le monde, sans distance) : un ricanement grave qui monte d'un cran à chaque tête ; à la troisième,
   deux notes de cloche en plus. */
function tbSon(t, n, derniere) {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const o = S.out(null, 0.3); if (!o) return;
  const T0 = S.ctx.currentTime + 0.05, f = [196, 233, 277][Math.min(2, n - 1)];
  for (let i = 0; i < 3; i++) S.tone('sawtooth', f * (1 + i * 0.06), f * 0.85, T0 + i * 0.11, 0.14, 0.07, o, 0.01);   // « hé hé hé »
  S.noiseHit(T0, 0.4, 0.12, 'bandpass', 900, 500, 3, o, 0.02);
  S.bell(T0 + 0.35, f * 4, 0.08, o, 0.8);
  if (derniere) { S.bell(T0 + 0.6, 987.77, 0.18, o, 0.9); S.bell(T0 + 0.76, 1318.5, 0.2, o, 1.3); }
}

/* Chaque image (updateFeatures) : la machine de Quick Revive retirée (troisième relève, en solo : elle s'enfonce puis
   disparaît), sa tête tombe au sol, à la même place, et reste à tirer. */
function tbMaj(dt) {
  for (const t of TB.tetes) {
    if (!t.m || t.touchee || t.tombee) continue;
    const partie = t.m.sinkT >= 0 || !t.m.group.visible || !t.m.active;
    if (!partie) continue;
    t.vy -= 9.8 * dt;
    const y = t.g.position.y + t.vy * dt, sol = t.sol;
    if (y <= sol) { t.g.position.y = sol; t.tombee = true; t.g.rotation.z = 0.35; }   // posée de travers, comme tombée
    else t.g.position.y = y;
    t.cy = t.g.position.y + 0.2 * t.e;
  }
}
