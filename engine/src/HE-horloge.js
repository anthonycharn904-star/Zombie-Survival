/* ========================================================================== 34 HORLOGE ==
   Easter egg secondaire de Bunker 7 (demande d'Anthony du 4 novembre 2026, pour le jeu 2.0.7) : l'horloge de la gare
   abandonnée des abords, refaite en 3D (boîtier de fonte, lunette, cadran à chiffres romains, aiguilles à fer de lance).
   La petite aiguille est fixe sur 12 ; la grande part de 3 à chaque partie. Chaque tir du joueur sur le cadran l'avance
   d'une heure du cadran (30°). Quand elle arrive sur 12, avec la petite : un petit son de réussite, et deux bonus au sol
   près du joueur, « Atout gratuit » (HF-atout-gratuit.js : le joueur boit un atout qu'il n'a pas, présents et futurs)
   et « Munitions max ». Une fois par partie : l'horloge reste ensuite sur midi.
   · L'horloge appartient aux abords, dont le groupe est gardé en cache d'une partie à l'autre : elle est remise sur 3 h
     à chaque partie (resetFeatures). L'ancienne horloge plate du modèle de la gare n'est retirée que des abords : la
     bibliothèque des Mod Tools garde le modèle intact.
   · Tir : un disque analytique dans hitscan, après les zombies (un zombie ou un mur devant arrête la balle) ; un cran
     par tir (G.stats.shots : les plombs d'un fusil à pompe comptent pour un). Projectiles, couteau, grenades : rien.
   · Seulement sur Bunker 7 (G.mapId), hors du monde ouvert, salle du boss non affichée ; pendant le combat du boss
     (B7.actif), l'horloge ignore les tirs (aucun bonus pendant le combat, décision D3).
   · Aucune lampe, aucune secousse ; couleurs données en sRGB, converties une fois avec le monde (linearizeTree) ;
     brume des abords (mistify) ; géométries et matières partagées (le cache des abords les garde).
   Points d'accroche : tools/hooks-horloge.py (abords, tir, bonus, remise à zéro, chaque image, sons).
   ============================================================================ */
const HORL = {
  rayon: 0.45, marge: 0.06,                    // m : cadran ; marge du tir (dispersion des armes)
  centre: [0, 5.9, 2.5],                       // repère de la gare : centre de l'horloge, au nu du mur (face vers +z)
  depart: 3, midi: 12,                         // crans : heures du cadran
  vieux: [0xd8d4c4, 0x1a1816],                 // couleurs de l'ancienne horloge plate (pièces « paint » de la gare)
  vie: 30,                                     // s : durée au sol des deux bonus
  anim: 0.2,                                   // s : saut de l'aiguille, avec un léger rebond
  groupe: null, cadre: null, pivot: null, mats: null, geos: null, retires: 0, chauffe: null, chauffeN: 0,
  cx: 0, cy: 0, cz: 0, nx: 0, ny: 0, nz: 1,    // centre du cadran et normale, dans le monde
  cran: 3, de: Math.PI / 2, angle: Math.PI / 2, t: 1, fait: false, dernier: -1,
};

/* Abords (point d'accroche dans buildOutskirts) : l'ancienne horloge plate retirée de la gare. Elle est gardée si ses
   trois pièces ne sont pas trouvées telles quelles (modèle changé) : pas d'horloge 3D alors. */
function horlParts(id, parts) {
  if (id !== 'ruin_station') return parts;
  const r = parts.filter((q) => !(q.f === 'paint' && HORL.vieux.includes(q.c)));
  HORL.retires = parts.length - r.length;
  if (HORL.retires !== 3) { console.warn(`[horloge] ancienne horloge : ${HORL.retires} pièces au lieu de 3, modèle gardé`); return parts; }
  return r;
}

/* Cadran : crème vieilli, piste des minutes, barres des heures, chiffres romains (XII en haut), salissures. */
function horlCadran() {
  const W = 512, c = makeCanvas(W, W), g = c.getContext('2d'), R = mulberry32(1215), m = W / 2;
  g.fillStyle = '#e4dcc6'; g.fillRect(0, 0, W, W);
  const v = g.createRadialGradient(m, m, W * 0.18, m, m, W * 0.5);
  v.addColorStop(0, 'rgba(70,58,40,0)'); v.addColorStop(1, 'rgba(70,58,40,0.38)');
  g.fillStyle = v; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 70; i++) {                // taches d'humidité
    const x = R() * W, y = R() * W, r = 6 + R() * 34, t = g.createRadialGradient(x, y, 0, x, y, r);
    t.addColorStop(0, `rgba(90,74,50,${0.05 + R() * 0.1})`); t.addColorStop(1, 'rgba(90,74,50,0)');
    g.fillStyle = t; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.strokeStyle = '#1c1a17';
  g.lineWidth = 3; g.beginPath(); g.arc(m, m, W * 0.47, 0, TAU); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(m, m, W * 0.405, 0, TAU); g.stroke();
  g.fillStyle = '#1c1a17';
  for (let i = 0; i < 60; i++) {                // piste des minutes : barres épaisses aux heures
    const a = (i / 60) * TAU, h = i % 5 === 0;
    g.save(); g.translate(m, m); g.rotate(a);
    g.fillRect(h ? -5 : -1.5, -W * 0.468, h ? 10 : 3, h ? W * 0.07 : W * 0.04);
    g.restore();
  }
  const ROM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.font = `bold ${Math.round(W * 0.085)}px Georgia, 'Times New Roman', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  ROM.forEach((s, i) => {                       // chiffres tournés vers le centre, comme sur les horloges de gare
    const a = (i / 12) * TAU;
    g.save(); g.translate(m + Math.sin(a) * W * 0.32, m - Math.cos(a) * W * 0.32); g.rotate(a); g.fillText(s, 0, 0); g.restore();
  });
  g.strokeStyle = 'rgba(40,32,22,0.45)'; g.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {                 // fêlures de l'émail
    let x = m + (R() - 0.5) * W * 0.6, y = m + (R() - 0.5) * W * 0.6;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 9; i++) {                 // coulures de rouille sous l'axe et sous la lunette
    const x = m + (R() - 0.5) * W * 0.5, y0 = R() < 0.5 ? m + 8 : W * 0.06, l = 40 + R() * 120, t = g.createLinearGradient(0, y0, 0, y0 + l);
    t.addColorStop(0, 'rgba(110,62,30,0.28)'); t.addColorStop(1, 'rgba(110,62,30,0)');
    g.fillStyle = t; g.fillRect(x - 2 - R() * 3, y0, 3 + R() * 4, l);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  return share(tex);
}

/* Aiguille à fer de lance (forme plane extrudée) : longueur L vers +y, largeur w, contrepoids rond derrière l'axe. */
function horlAiguille(L, w, queue) {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.5, 0); s.lineTo(-w * 0.3, L * 0.6); s.lineTo(-w * 1.5, L * 0.72); s.lineTo(0, L);
  s.lineTo(w * 1.5, L * 0.72); s.lineTo(w * 0.3, L * 0.6); s.lineTo(w * 0.5, 0); s.lineTo(w * 0.35, -queue); s.lineTo(-w * 0.35, -queue); s.closePath();
  const rond = new THREE.Shape(); rond.absarc(0, -queue, w * 0.95, 0, TAU, false);
  const anneau = new THREE.Shape(); anneau.absarc(0, 0, w * 0.9, 0, TAU, false);
  return share(new THREE.ExtrudeGeometry([s, rond, anneau], { depth: 0.008, bevelEnabled: false, curveSegments: 10 }));
}

/* Géométries et matières, une fois par page (partagées : le cache des abords les garde d'une carte à l'autre). */
function horlRessources() {
  if (HORL.geos) return;
  const r = HORL.rayon;
  HORL.geos = {
    boitier: share(new THREE.CylinderGeometry(r + 0.05, r + 0.07, 0.12, 40).rotateX(Math.PI / 2)),   // axe le long de z
    lunette: share(new THREE.TorusGeometry(r + 0.025, 0.028, 10, 48)),
    cadran: share(new THREE.CircleGeometry(r, 48)),
    petite: horlAiguille(0.25, 0.034, 0.05),
    grande: horlAiguille(0.385, 0.026, 0.09),
    axe: share(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 16).rotateX(Math.PI / 2)),
  };
  const std = (o) => share(mistify(new THREE.MeshStandardMaterial(o)));   // brume des abords
  const cadran = horlCadran();
  HORL.mats = {
    fonte: std({ color: 0x35322d, roughness: 0.6, metalness: 0.5 }),
    laiton: std({ color: 0x80704a, roughness: 0.42, metalness: 0.65 }),
    cadran: std({ map: cadran, roughness: 0.85, emissive: 0xffffff, emissiveMap: cadran, emissiveIntensity: 0.2 }),   // un peu lumineux, comme l'ancienne horloge sous la lune : lisible dans la brume
    aiguille: std({ color: 0x14120f, roughness: 0.5, metalness: 0.35 }),
  };
}

/* Abords (point d'accroche dans buildOutskirts, avant NO_RAYCAST) : l'horloge 3D dans le repère de la gare. */
function horlAbords(group, placed) {
  HORL.groupe = HORL.cadre = HORL.pivot = null;
  const p = placed.find((q) => q.id === 'ruin_station');
  if (!p || HORL.retires !== 3) return;
  horlRessources();
  const G0 = HORL.geos, M = HORL.mats, [X, Y, Z] = HORL.centre;
  const cadre = new THREE.Group();
  cadre.name = 'horloge';
  cadre.position.set(p.x, 0, p.z);
  cadre.rotation.y = p.r;
  if (LI0 > 0) cadre.userData.lv = 0;
  const piece = (geo, mat, z, parent = cadre, x = X, y = Y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  piece(G0.boitier, M.fonte, Z + 0.06);          // 2,50 à 2,62
  piece(G0.lunette, M.laiton, Z + 0.13);
  piece(G0.cadran, M.cadran, Z + 0.13);          // 1 cm devant le boîtier : pas de scintillement de loin
  piece(G0.petite, M.aiguille, Z + 0.137);       // fixe sur 12
  const pivot = new THREE.Group();
  pivot.position.set(X, Y, Z + 0.149);
  piece(G0.grande, M.aiguille, 0, pivot, 0, 0);
  cadre.add(pivot);
  piece(G0.axe, M.laiton, Z + 0.163);
  group.add(cadre);
  HORL.groupe = group; HORL.cadre = cadre; HORL.pivot = pivot;
  const s = Math.sin(p.r), c = Math.cos(p.r), zc = Z + 0.13;   // centre du cadran et normale dans le monde (abords à l'origine)
  HORL.cx = p.x + X * c + zc * s; HORL.cy = Y; HORL.cz = p.z - X * s + zc * c;
  HORL.nx = s; HORL.ny = 0; HORL.nz = c;
  horlPoser(HORL.cran * Math.PI / 6);
}
function horlPoser(a) { HORL.angle = a; if (HORL.pivot) HORL.pivot.rotation.z = -a; }   // a : sens horaire depuis 12

/* Remise à zéro (resetFeatures : nouvelle partie, menu, carte, partie de test) : grande aiguille sur 3 ; programmes de
   rendu de l'horloge et de la fiole du bonus compilés aux deux premières images (sinon au premier regard vers la gare,
   en pleine partie : leurs matières n'existent nulle part ailleurs). */
function horlRemettre() {
  HORL.cran = HORL.depart; HORL.fait = false; HORL.dernier = -1; HORL.t = 1;
  HORL.de = HORL.cran * Math.PI / 6;
  horlPoser(HORL.de);
  if (HORL.cadre) {
    if (!HORL.chauffe) {                        // une fiole cachée dans le boîtier, le temps de la compiler
      HORL.chauffe = atgModele();
      HORL.chauffe.position.set(HORL.centre[0], HORL.centre[1], HORL.centre[2] + 0.06);
      HORL.chauffe.scale.setScalar(0.1);
    }
    HORL.cadre.add(HORL.chauffe);
    HORL.cadre.traverse((m) => { if (m.isMesh || m.isSprite) m.frustumCulled = false; });
    HORL.chauffeN = 2;
  }
}
function horlChauffeFin() {
  HORL.chauffeN = 0;
  if (HORL.chauffe && HORL.chauffe.parent) HORL.chauffe.parent.remove(HORL.chauffe);
  if (HORL.cadre) HORL.cadre.traverse((m) => { if (m.isMesh || m.isSprite) m.frustumCulled = true; });
}

/* L'horloge répond-elle aux tirs ? */
function horlActive() {
  const H = HORL;
  if (!H.pivot || H.fait || OW.on || G.mapId !== BUNKER7.id) return false;
  if (H.groupe !== OUTSKIRTS.group || !World.outskirts || World.outskirts !== OUTSKIRTS.info) return false;
  if (typeof B7 === 'object' && B7.actif) return false;   // combat du boss : aucun bonus (D3)
  let o = H.cadre;
  for (; o.parent; o = o.parent) if (!o.visible) return false;   // salle du boss : World.root caché
  return o === scene && o.visible;
}
/* Rayon d'un tir (hitscan) contre le cadran : distance, ou −1. De face seulement (pas à travers la gare). */
function horlRayon(ox, oy, oz, dx, dy, dz, maxT) {
  if (!horlActive()) return -1;
  const H = HORL, den = dx * H.nx + dy * H.ny + dz * H.nz;
  if (den > -0.05) return -1;
  const t = ((H.cx - ox) * H.nx + (H.cy - oy) * H.ny + (H.cz - oz) * H.nz) / den;
  if (t <= 0 || t >= maxT) return -1;
  const px = ox + dx * t - H.cx, py = oy + dy * t - H.cy, pz = oz + dz * t - H.cz, r = H.rayon + H.marge;
  return px * px + py * py + pz * pz <= r * r ? t : -1;
}
/* Coup sur le cadran : un cran par tir (jeton : numéro du tir) ; midi : réussite. */
function horlTouche(x, y, z, jeton) {
  const H = HORL;
  sparkBurst(x, y, z, H.nx, H.ny, H.nz, 3);
  if (jeton === H.dernier || H.fait) return;
  H.dernier = jeton;
  H.cran = Math.min(H.midi, H.cran + 1);
  H.de = H.angle; H.t = 0;
  horlSonTic();
  if (H.cran >= H.midi) { H.fait = true; horlReussite(); }
}
/* Chaque image (updateFeatures) : saut de l'aiguille vers son cran, avec un léger rebond. */
function horlMaj(dt) {
  const H = HORL;
  if (H.chauffeN > 0 && --H.chauffeN === 0) horlChauffeFin();   // après une image dessinée
  if (!H.pivot || H.t >= 1) return;
  H.t = Math.min(1, H.t + dt / H.anim);
  const u = H.t - 1, k = 1 + 2.2 * u * u * u + 1.2 * u * u;   // retour arrière : dépasse un peu puis revient
  horlPoser(lerp(H.de, H.cran * Math.PI / 6, k));
}

/* Réussite : son, puis les deux bonus au sol près du joueur (dans la même image : une sauvegarde ne peut pas les perdre). */
function horlReussite() {
  horlSonReussite();
  const [a, b] = horlPlaces();
  if (atgLibres().length) atgPoser(a.x, a.z, a.gy, HORL.vie);   // le joueur a déjà tous les atouts : seulement les munitions
  spawnPowerup('ammo', b.x, b.z, b.gy); Powerups.list[Powerups.list.length - 1].life = HORL.vie;
}
/* Deux places atteignables : sol où l'on marche, même zone que le joueur, vues de lui, à 1,4 m au moins de lui et l'une
   de l'autre (rayon de ramassage : 1,25 m) ; derrière lui d'abord (il regarde la fenêtre). Repli : sous le joueur. */
function horlPlaces() {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), gy = player.gy, z0 = zoneAt(player.pos.x, player.pos.z, gy), res = [];
  for (const d of [1.8, 2.4, 1.5]) for (const a of [1, 0.75, -0.75, 0.5, -0.5, 0.25, -0.25, 0].map((f) => f * Math.PI)) {
    if (res.length === 2) break;
    const c = Math.cos(a), s = Math.sin(a), x = player.pos.x + (fx * c - fz * s) * d, z = player.pos.z + (fx * s + fz * c) * d;
    const k = locateNode(x, z, gy, true);
    if (k < 0) continue;
    const y = surfY(k, x, z);
    if (Math.abs(y - gy) > 0.6 || zoneAt(x, z, y) !== z0 || !sightClear(player.pos.x, gy + 1, player.pos.z, x, y + 1, z)) continue;
    if (res.some((q) => Math.hypot(q.x - x, q.z - z) < 1.4)) continue;
    res.push({ x, z, gy: y });
  }
  while (res.length < 2) res.push({ x: player.pos.x, z: player.pos.z, gy });
  return res;
}

/* Sons (outils de Sound.synthe, point d'accroche) : déclic de l'aiguille, placé à l'horloge et retardé du trajet du son
   (≈ 73 ms à 25 m : il passe après le claquement du tir, qui le couvrirait) ; réussite, deux notes de cloche montantes,
   courtes, sur le volume des effets. Ils rendent leur sortie (null : pas de son). */
function horlSonTic() {
  const S = Sound.synthe && Sound.synthe();
  if (!S) return null;
  const t = S.ctx.currentTime + Math.hypot(HORL.cx - player.pos.x, HORL.cz - player.pos.z) / 343, o = S.out({ x: HORL.cx, z: HORL.cz }, 0.8, 10);
  if (!o) return null;
  S.noiseHit(t, 0.018, 0.6, 'bandpass', 3400, null, 2.5, o, 0.001);
  S.noiseHit(t + 0.012, 0.09, 0.35, 'lowpass', 900, 300, 1.2, o, 0.002);
  S.tone('triangle', 620, 560, t + 0.01, 0.12, 0.12, o, 0.002);
  return o;
}
function horlSonReussite() {
  const S = Sound.synthe && Sound.synthe();
  if (!S) return null;
  const t = S.ctx.currentTime + 0.2, o = S.out(null, 0.3);
  if (!o) return null;
  S.bell(t, 987.77, 0.2, o, 0.9);
  S.bell(t + 0.16, 1318.5, 0.22, o, 1.3);
  return o;
}
