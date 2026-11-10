/* ========================================================================== 39 CAISSES TOXIQUES ==
   Quatrième easter egg secondaire de Bunker 7 (demande d'Anthony du 9 novembre 2026, pour le jeu 2.0.7) : détruire les
   quatre caisses en bois marquées d'un logo toxique rouge, 1 ou 2 par salle. Seules les petites caisses posées sur les
   grandes sont concernées ; celles qui portent le logo sont tirées au hasard à chaque partie (une dans chaque salle qui
   a des petites caisses, puis une de plus : la Salle des machines de Bunker 7 n'a aucune caisse).
   · Coups : balles (CX.pv points), couteau (un coup), explosions (souffle qui les voit).
   · Une caisse détruite : planches qui volent, et un petit nuage de fumée toxique verte (CX.nuage s). Le joueur dedans
     reçoit de faibles dégâts en continu, sans secousse ; un zombie ou un chien qui passe dans le nuage devient toxique
     (l'irradiation des zombies du combat du boss : teinte et lueur vertes, aura qui blesse de près) pour CX.toxique s.
   · Les quatre détruites : « Atout gratuit » et « Munitions max » au sol près du joueur, un petit son ; écran
     « Secrets » : b7-caisses. Une fois par partie. Seulement sur Bunker 7 ; pas pendant le combat du boss.
   · Les petites caisses ne sont plus fondues avec les grandes : un maillage chacune (même matière, mêmes couleurs de
     sommets : aucun programme nouveau) ; le logo, une copie de la matière avec sa texture. Le tirage du monde (wr) est
     gardé à l'identique. Fumée : des sprites à lui ; aucune lampe ajoutée, aucune secousse.
   Points d'accroche : tools/hooks-caisses.py.
   ============================================================================ */
const CX = {
  pv: 120,                                     // points d'une caisse pour les balles (3 balles de M1911, 1 au palier II)
  nuage: 30, rayon: 1.9, joueurDps: 0.03,      // s ; m ; part des PV max par seconde dans le nuage
  toxique: 60, aura: { rayon: 1.5, degatsParSeconde: 0.04 },   // zombies toxiques : s ; aura du combat du boss
  vie: 30,                                     // s : bonus au sol
  salles: ['Salle des machines', 'Entrepôt', "Salle d'arrivée", 'Infirmerie'],
  liste: [], geo: null, mat: null, choisies: [], nuages: [], toxiques: new Map(), fait: false, pool: null, dernier: -1,
};
/* (buildLevelGeometry, à la place d'une petite caisse fondue) : la caisse retenue, mêmes tirages du monde. */
function cxPetite(li, x, y, z, ry, k) {
  CX.liste.push({ li, x, y, z, ry, k, mesh: null, pv: CX.pv, cassee: false, toxique: false });
}
/* (buildLevelGeometry, après les caisses) : un maillage par petite caisse, dans le groupe du niveau. */
function cxConstruire(group) {
  if (!CX.geo) CX.geo = share(mergeGeometries([{ geo: new THREE.BoxGeometry(1, 1, 1), matrix: new THREE.Matrix4().makeScale(0.66, 0.66, 0.66), color: [0.85, 0.85, 0.85] }]));
  for (const c of CX.liste) {
    const m = new THREE.Mesh(CX.geo, MAT.crate);
    m.position.set(c.x, c.y, c.z); m.rotation.y = c.ry;
    if (NL > 1) m.userData.lv = LV[c.li];
    m.userData.cx = c;
    group.add(m);
    c.mesh = m;
  }
}
/* Salle d'une caisse : la case de la caisse n'est pas praticable (pas de salle) ; la salle des cases voisines. */
function cxZone(c) {
  if (zoneOf[c.k] >= 0) return zoneOf[c.k];
  const li = (c.k / GN) | 0, cc = c.k % GN, x = cc % GW, z = (cc / GW) | 0;
  for (let r = 1; r <= 3; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (!inb(x + dx, z + dz)) continue;
    const zi = zoneOf[node(li, x + dx, z + dz)];
    if (zi >= 0) return zi;
  }
  return -1;
}
/* Matière au logo : la texture des caisses, et le symbole toxique rouge au pochoir (une copie de MAT.crate : même
   programme de rendu). */
function cxMatiere() {
  if (CX.mat) return CX.mat;
  const base = TEX.crate.image, W = base.width, H = base.height, c = makeCanvas(W, H), g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  // le pochoir sur un calque à part : disque de peinture claire, symbole de danger biologique rouge, « TOXIQUE »
  const L = makeCanvas(W, H), l = L.getContext('2d');
  const cx = W * 0.5, cy = H * 0.6, R = W * 0.22;
  l.fillStyle = '#d8cdb0'; l.beginPath(); l.arc(cx, cy, R * 1.12, 0, TAU); l.fill();
  l.fillStyle = '#b3120c'; l.strokeStyle = '#b3120c';
  for (let i = 0; i < 3; i++) {                 // trois croissants
    const a = -Math.PI / 2 + (i * TAU) / 3;
    l.beginPath(); l.arc(cx + Math.cos(a) * R * 0.42, cy + Math.sin(a) * R * 0.42, R * 0.5, 0, TAU);
    l.arc(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62, R * 0.36, 0, TAU, true); l.fill('evenodd');
  }
  l.lineWidth = R * 0.12; l.beginPath(); l.arc(cx, cy, R * 0.55, 0, TAU); l.stroke();
  l.fillStyle = '#d8cdb0'; l.beginPath(); l.arc(cx, cy, R * 0.16, 0, TAU); l.fill();
  l.fillStyle = '#b3120c'; l.font = `900 ${Math.round(W * 0.11)}px ${FONT_DISPLAY}`; l.textAlign = 'center';
  l.fillText('TOXIQUE', cx, H * 0.24);
  // usure du pochoir : éclats (le bois reparaît dessous)
  const R0 = mulberry32(3939);
  l.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 320; i++) { l.globalAlpha = 0.25 + R0() * 0.6; l.fillRect(cx - R * 1.3 + R0() * R * 2.6, H * 0.12 + R0() * H * 0.78, 1 + R0() * 4, 1 + R0() * 3); }
  l.globalCompositeOperation = 'source-over'; l.globalAlpha = 1;
  g.globalAlpha = 0.9; g.drawImage(L, 0, 0); g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.encoding = TEX.crate.encoding; t.anisotropy = TEX.crate.anisotropy; t.wrapS = TEX.crate.wrapS; t.wrapT = TEX.crate.wrapT;
  CX.mat = share(MAT.crate.clone()); CX.mat.map = share(t);
  _linDone.add(CX.mat);                         // la copie garde la couleur déjà convertie de MAT.crate
  return CX.mat;
}

/* ------------------------------------------------------------------ Tirage et remise à zéro --- */
/* (resetFeatures) : toutes les petites caisses entières et sans logo ; une par salle au hasard porte le logo ; nuages et
   zombies toxiques retirés. */
function cxRemettre() {
  for (const c of CX.liste) {
    c.cassee = false; c.toxique = false; c.pv = CX.pv;
    if (c.mesh) { c.mesh.visible = true; c.mesh.material = MAT.crate; }
    solidTop[c.k] = 1.6;
  }
  for (const [z] of CX.toxiques) if (typeof b7IrrFin === 'function') b7IrrFin(z);
  CX.toxiques.clear();
  cxLueurs();
  if (CX.debris) { for (const m of CX.debris.children.slice()) CX.debris.remove(m); }   // planches de la partie d'avant
  CX.eclats = [];
  CX.nuages.length = 0;
  if (CX.pool) for (const p of CX.pool.L) { p.life = 0; p.s.visible = false; }
  CX.fait = false; CX.choisies = [];
  if (!cxCarte()) return;
  for (const c of CX.liste) c.zone = cxZone(c);
  // une par salle qui a des petites caisses (la Salle des machines de Bunker 7 n'a aucune caisse), puis jusqu'à 4 au
  // total, deux au plus par salle (« 1 ou 2 par salle », demande d'Anthony)
  const zs = CX.salles.map((nom) => LAYOUT.zones.findIndex((z) => z.name === nom)).filter((zi) => zi >= 0);
  const tirer = (l) => l[Math.floor(Math.random() * l.length)];
  const prendre = (c) => { c.toxique = true; c.mesh.material = cxMatiere(); CX.choisies.push(c); };
  for (const zi of zs) { const ici = CX.liste.filter((c) => c.zone === zi && c.mesh); if (ici.length) prendre(tirer(ici)); }
  while (CX.choisies.length < 4) {
    const libres = CX.liste.filter((c) => c.mesh && !c.toxique && zs.includes(c.zone) && CX.choisies.filter((q) => q.zone === c.zone).length < 2);
    if (!libres.length) break;
    prendre(tirer(libres));
  }
}
/* La caisse vue d'un point (souffle, couteau) ? La grille déclare sa case pleine jusqu'à 1,6 m (solidTop), la caisse
   est dedans : la ligne de vue vise le bord de la case tourné vers ce point (ou le dessus de la caisse, vu d'en haut). */
function cxVue(c, x, y, z) {
  const k = c.k % GN, cx = (k % GW) + 0.5, cz = ((k / GW) | 0) + 0.5, E = LVY[c.li];
  if (y >= E + 1.6) return sightClear(x, y, z, c.x, E + 1.64, c.z);
  const dx = x - cx, dz = z - cz, m = Math.max(Math.abs(dx), Math.abs(dz)) || 1;   // bord carré de la case (diagonales comprises)
  return sightClear(x, y, z, cx + (dx / m) * 0.56, clamp(y, E + 0.25, E + 1.55), cz + (dz / m) * 0.56);
}
/* (buildLevelGeometry) : les petites caisses à part seulement sur Bunker 7 en jeu ; ailleurs, fondues comme avant. */
const cxIci = () => !!CUR.map && CUR.map.id === BUNKER7.id && !CUR.editor && !OW.on;
const cxCarte = () => !OW.on && G.mapId === BUNKER7.id && !CUR.editor && CX.liste.length > 0;
/* L'easter egg répond-il ? */
function cxActif() {
  if (CX.fait || !cxCarte() || !CX.choisies.length) return false;
  if (typeof B7 === 'object' && B7.actif) return false;
  if (World.root && !World.root.visible) return false;
  return true;
}

/* ------------------------------------------------------------------ Coups --- */
const _cxO = new THREE.Vector3(), _cxD = new THREE.Vector3();
/* Rayon contre les caisses au logo encore entières (boîte de 0,66 m tournée) : distance, ou −1 ; la caisse dans CX.c. */
function cxRayon(ox, oy, oz, dx, dy, dz, maxT) {
  if (!cxActif()) return -1;
  let best = -1;
  for (const c of CX.choisies) {
    if (c.cassee) continue;
    const s = Math.sin(-c.ry), co = Math.cos(-c.ry);
    const lx = ox - c.x, ly = oy - c.y, lz = oz - c.z;
    _cxO.set(lx * co + lz * s, ly, -lx * s + lz * co); _cxD.set(dx * co + dz * s, dy, -dx * s + dz * co);
    let t0 = 0, t1 = maxT, ok = true;
    for (const ax of ['x', 'y', 'z']) {
      const o = _cxO[ax], d = _cxD[ax], h = 0.34;
      if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) ok = false; continue; }
      let a = (-h - o) / d, b = (h - o) / d; if (a > b) { const q = a; a = b; b = q; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) ok = false;
    }
    if (ok && t0 > 0 && (best < 0 || t0 < best)) { best = t0; CX.c = c; }
  }
  return best;
}
/* Balle (hitscan) : éclats de bois ; assez de dégâts : la caisse casse. */
function cxTouche(s, x, y, z, dmg, boom) {
  const c = CX.c;
  for (let i = 0; i < 6; i++) FX.dirt.emit(x, y, z, rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5), rand(0.3, 0.6));
  cxSonBois(x, y, z, false);
  c.pv -= dmg;
  if (c.pv <= 0) cxCasser(c);
  if (boom) explode(x, y + 0.3, z, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s });   // M1911 Ardente
}
/* Explosion (début d'explode) : le souffle qui voit une caisse la casse. */
function cxExplosion(x, y, z, radius) {
  if (!cxActif()) return;
  for (const c of CX.choisies) {
    if (c.cassee) continue;
    const d = Math.hypot(c.x - x, c.y - y, c.z - z);
    if (d > radius + 0.4 || (d > 0.6 && !cxVue(c, x, y, z))) continue;
    cxCasser(c);
  }
}
/* Couteau : la lame arrive sans zombie à toucher (onMiss du module : l'estoc dans le vide, sans sang) ; la caisse au
   logo devant le joueur, à portée, vue, casse. */
function cxCouteauVide() {
  if (!cxActif()) return;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let best = null, bd = Infinity;
  for (const c of CX.choisies) {
    if (c.cassee) continue;
    const dx = c.x - player.pos.x, dz = c.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > KNIFE.range + 0.3 || (dx * fx + dz * fz) / (d || 1) < KNIFE.cone || Math.abs(c.y - (player.gy + 1.2)) > 1.3) continue;
    if (!cxVue(c, camera.position.x, camera.position.y, camera.position.z)) continue;
    if (d < bd) { bd = d; best = c; }
  }
  if (best) { cxSonBois(best.x, best.y, best.z, false); cxCasser(best); }
}

/* ------------------------------------------------------------------ Casse, nuage, réussite --- */
function cxCasser(c) {
  c.cassee = true;
  c.mesh.visible = false;
  solidTop[c.k] = 0.95;                         // il ne reste que la grande caisse
  cxSonBois(c.x, c.y, c.z, true);
  cxSonGaz(c.x, c.y, c.z);
  cxEclats(c);                                 // les planches tombent et restent (sur la grande caisse ou au sol)
  for (let i = 0; i < 16; i++) FX.dirt.emit(c.x, c.y, c.z, rand(-2.5, 2.5), rand(1, 4), rand(-2.5, 2.5), rand(0.4, 0.9));
  CX.nuages.push({ x: c.x, y: c.y - 0.3, z: c.z, gy: c.y - 1.28, t: 0, tic: 0, puffT: 0 });
  for (let i = 0; i < 6; i++) cxPuff(CX.nuages[CX.nuages.length - 1], true);
  if (CX.choisies.every((q) => q.cassee)) cxReussite();
}
function cxReussite() {
  CX.fait = true;
  cxSonReussite();
  if (typeof secretDecouvert === 'function') secretDecouvert('b7-caisses');   // écran « Secrets » de l'Interface (2.0.7)
  const [a, b] = horlPlaces();
  if (atgLibres().length) atgPoser(a.x, a.z, a.gy, CX.vie);
  spawnPowerup('ammo', b.x, b.z, b.gy); Powerups.list[Powerups.list.length - 1].life = CX.vie;
}
/* Fumée : un petit lot de sprites à lui (fumée verte, lueur additive), dans la scène. */
function cxPool() {
  if (CX.pool && CX.pool.g.parent === scene) return CX.pool;
  if (!CX.pool) {
    const g = new THREE.Group(); g.name = 'caisses-nuages';
    const L = [];
    for (let i = 0; i < 36; i++) {
      const add = i >= 28;
      const mat = new THREE.SpriteMaterial({ map: add ? TEX.glow : TEX.smoke, color: add ? 0x6fe23a : 0x58b83a, transparent: true, depthWrite: false, opacity: 0, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
      mat.color.convertSRGBToLinear(); _linDone.add(mat);
      const s = new THREE.Sprite(mat); s.visible = false; s.frustumCulled = false; g.add(s);
      L.push({ s, add, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1, op: 0.5 });
    }
    CX.pool = { g, L };
  }
  scene.add(CX.pool.g);
  return CX.pool;
}
function cxPuff(n, fort) {
  const P = cxPool(), add = !fort && Math.random() < 0.15;
  const p = P.L.find((q) => q.add === add && q.life <= 0) || P.L.filter((q) => q.add === add).sort((a, b) => a.life - b.life)[0];
  const a = rand(0, TAU), r = rand(0, CX.rayon * 0.6);
  p.life = p.max = add ? rand(0.8, 1.4) : rand(2.5, 4); p.size = add ? rand(1.2, 1.8) : rand(1.0, 1.6) * (fort ? 1.3 : 1);
  p.op = add ? 0.18 : 0.42; p.vx = rand(-0.15, 0.15); p.vy = rand(0.05, 0.25); p.vz = rand(-0.15, 0.15);
  p.s.position.set(n.x + Math.cos(a) * r, n.gy + rand(0.4, 1.4), n.z + Math.sin(a) * r);
  p.s.material.rotation = rand(0, TAU); p.s.visible = true;
}
/* Chaque image (updateFeatures) : nuages (fumée, dégâts au joueur, zombies qui deviennent toxiques), fin du poison. */
function cxMaj(dt) {
  if (CX.eclats.length) cxEclatsMaj(dt);
  for (let i = CX.nuages.length - 1; i >= 0; i--) {
    const n = CX.nuages[i];
    n.t += dt;
    if (n.t >= CX.nuage) { CX.nuages.splice(i, 1); continue; }
    const k = 1 - Math.max(0, (n.t - (CX.nuage - 4)) / 4);   // il se dissipe les 4 dernières secondes
    n.puffT -= dt;
    if (n.puffT <= 0 && k > 0.15) { n.puffT = 0.22 / k; cxPuff(n, false); }
    if (G.state !== 'playing') continue;
    n.tic += dt;
    if (n.tic >= 0.5) {
      n.tic -= 0.5;
      // le joueur dans le nuage : faibles dégâts, sans secousse (comme ceux du boss)
      if (!player.down && Math.hypot(player.pos.x - n.x, player.pos.z - n.z) <= CX.rayon * k && Math.abs(player.gy - n.gy) < 1.5) {
        const sh = FX.shake, pu = player.punch;
        playerDamage(CX.joueurDps * 0.5 * player.maxHp);
        FX.shake = sh; player.punch = pu;
      }
    }
    // zombies et chiens qui passent dans le nuage : toxiques pour CX.toxique s
    if (typeof b7Irradier === 'function' && !(typeof B7 === 'object' && B7.actif)) for (const z of Zombies.list) {
      if (!z.alive || z.b7boss || z.b7ent || z.boss || Math.abs(z.gy - n.gy) > 1.5) continue;
      if (Math.hypot(z.pos.x - n.x, z.pos.z - n.z) > CX.rayon * 0.85 * k) continue;
      if (!CX.toxiques.has(z)) { b7Irradier(z, { aura: CX.aura }); cxSonToxique(z); }
      CX.toxiques.set(z, CX.toxique);
    }
  }
  for (const [z, t] of CX.toxiques) {
    const r = t - dt;
    // fin : seulement hors du combat (le boss peut avoir irradié le même zombie : il garde son irradiation)
    if (r <= 0 || !z.alive || z.removed) { CX.toxiques.delete(z); if (z.alive && !z.removed && !(typeof B7 === 'object' && B7.actif) && typeof b7IrrFin === 'function') b7IrrFin(z); }
    else CX.toxiques.set(z, r);
  }
  cxLueurs();
  const P = CX.pool;
  if (!P) return;
  for (const p of P.L) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    const u = 1 - p.life / p.max;
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    const sz = p.size * (1 + u * 0.8); p.s.scale.set(sz, sz, 1);
    p.s.material.opacity = p.op * Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.05)) * (1 - u * 0.5);
  }
}

/* ------------------------------------------------------------------ Sons (Sound.synthe) --- */
function cxSonBois(x, y, z, casse) {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const o = S.out({ x, y, z }, casse ? 0.7 : 0.35, 6); if (!o) return;
  const t = S.ctx.currentTime;
  S.noiseHit(t, casse ? 0.25 : 0.06, casse ? 0.8 : 0.5, 'bandpass', casse ? 900 : 1400, casse ? 300 : null, 1.2, o, 0.002);
  if (casse) for (let i = 0; i < 5; i++) S.noiseHit(t + 0.03 + i * rand(0.03, 0.07), 0.05, 0.4, 'bandpass', rand(600, 1600), null, 3, o, 0.001);
  S.tone('sine', casse ? 140 : 220, casse ? 70 : 160, t, casse ? 0.2 : 0.06, casse ? 0.4 : 0.15, o, 0.002);
}
function cxSonGaz(x, y, z) {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const o = S.out({ x, y, z }, 0.5, 6); if (!o) return;
  const t = S.ctx.currentTime + 0.05;
  S.noiseHit(t, 2.2, 0.55, 'highpass', 2600, 1200, 0.7, o, 0.08, [0.4, 0.6]);   // le gaz qui fuse
  S.noiseHit(t, 1.4, 0.3, 'lowpass', 500, 200, 0.7, o, 0.05);
}
function cxSonToxique(z) {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const o = S.out({ x: z.pos.x, y: z.gy + 1, z: z.pos.z }, 0.3, 6); if (!o) return;
  const t = S.ctx.currentTime;
  S.tone('sawtooth', 180, 90, t, 0.35, 0.08, o, 0.02);
  S.noiseHit(t, 0.3, 0.2, 'bandpass', 1800, 900, 2, o, 0.02);
}
function cxSonReussite() {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const t = S.ctx.currentTime + 0.4, o = S.out(null, 0.3); if (!o) return;
  S.bell(t, 698.46, 0.2, o, 0.9);
  S.bell(t + 0.15, 1046.5, 0.22, o, 1.3);
}

/* Lueurs des zombies toxiques : les points de l'irradiation (B7E.irrPts) sont rangés dans le groupe de la salle du boss,
   attaché seulement dans la salle ; tant que des zombies sont toxiques à cause des caisses, ils passent dans la scène,
   puis reviennent dans leur groupe. */
function cxLueurs() {
  if (typeof B7E !== 'object' || !B7E.irrPts || !B7E.gS) return;
  const pts = B7E.irrPts, dehors = CX.toxiques.size > 0 && !(typeof B7 === 'object' && B7.actif) && World.root && World.root.visible;
  if (dehors && pts.parent !== scene) scene.add(pts);
  else if (!dehors && pts.parent !== B7E.gS) B7E.gS.add(pts);
}

/* ------------------------------------------------------------------ Débris qui restent --- */
/* La caisse cassée : ses planches (bois de la caisse : MAT.board, sans couleurs de sommets, déjà compilée) volent, tombent
   et restent, sur la grande caisse ou au sol autour, jusqu'à la partie suivante (demande d'Anthony du 9 novembre : « il
   faut que ça ressemble à la réalité »). Deux tasseaux du cadre, des planches entières et cassées, des éclats. */
function cxEclats(c) {
  if (!CX.debris) { CX.debris = new THREE.Group(); CX.debris.name = 'caisses-debris'; }
  if (CX.debris.parent !== (World.root || scene)) (World.root || scene).add(CX.debris);
  const k0 = c.k % GN, ccx = (k0 % GW) + 0.5, ccz = ((k0 / GW) | 0) + 0.5, E = LVY[c.li];
  const tailles = [[0.66, 0.05, 0.05], [0.66, 0.05, 0.05], [0.6, 0.05, 0.05], [0.64, 0.025, 0.12], [0.64, 0.025, 0.12], [0.62, 0.025, 0.12], [0.5, 0.025, 0.12],
    [0.45, 0.025, 0.12], [0.38, 0.025, 0.12], [0.3, 0.025, 0.1], [0.24, 0.025, 0.11], [0.2, 0.02, 0.06], [0.16, 0.02, 0.07], [0.14, 0.02, 0.05],
    [0.12, 0.02, 0.04], [0.1, 0.02, 0.05], [0.08, 0.015, 0.03], [0.07, 0.015, 0.04]];
  for (const [L, h, w] of tailles) {
    const m = new THREE.Mesh(GEO.box, MAT.board);
    m.scale.set(w, h, L);                        // la longueur le long de z
    m.position.set(c.x + rand(-0.2, 0.2), c.y + rand(-0.15, 0.25), c.z + rand(-0.2, 0.2));
    m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    if (NL > 1) m.userData.lv = LV[c.li];
    CX.debris.add(m);
    const a = rand(0, TAU), v = rand(0.25, 1.5);   // la plupart retombent sur la grande caisse ou à son pied
    CX.eclats.push({ m, vx: Math.cos(a) * v, vy: rand(1, 2.8), vz: Math.sin(a) * v, ax: rand(-9, 9), ay: rand(-6, 6), az: rand(-9, 9), pose: false, h, ccx, ccz, E, li: c.li });
  }
}
CX.eclats = [];
/* Chaque image : les planches en vol ; posées à plat (un peu de travers), elles ne bougent plus. */
function cxEclatsMaj(dt) {
  for (const e of CX.eclats) {
    if (e.pose) continue;
    const m = e.m, p = m.position;
    e.vy -= 9.8 * GRAV.k * dt;
    let nx = p.x + e.vx * dt, nz = p.z + e.vz * dt;
    // un mur, une fenêtre, une porte fermée : la planche rebondit
    // une caisse (grande, ou surmontée d'une petite entière) : seulement par-dessus
    const ok = (x, z) => { const cx = Math.floor(x), cz = Math.floor(z); if (!inb(cx, cz)) return false; const k = node(e.li, cx, cz); return walkNode(k) || (grid[k] === T.CRATE && p.y - e.h / 2 >= e.E + solidTop[k] - 0.02); };
    if (!ok(nx, p.z)) { e.vx *= -0.3; nx = p.x; }
    if (!ok(p.x, nz)) { e.vz *= -0.3; nz = p.z; }
    p.x = nx; p.z = nz; p.y += e.vy * dt;
    m.rotation.x += e.ax * dt; m.rotation.y += e.ay * dt; m.rotation.z += e.az * dt;
    // appui : le dessus de la grande caisse (dans sa case), sinon le sol
    const cx = Math.floor(p.x), cz = Math.floor(p.z), k = inb(cx, cz) ? node(e.li, cx, cz) : -1;
    const sol = e.E + (k >= 0 && grid[k] === T.CRATE ? solidTop[k] : 0) + e.h / 2;
    if (p.y <= sol) {
      p.y = sol;
      if (e.vy < -2.5) { e.vy = -e.vy * 0.25; e.vx *= 0.5; e.vz *= 0.5; e.ax *= 0.4; e.az *= 0.4; }
      else { e.pose = true; m.rotation.set(rand(-0.06, 0.06), m.rotation.y, rand(-0.06, 0.06)); }
    }
  }
}
