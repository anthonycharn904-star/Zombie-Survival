/* ========================================================================== 36 QUÊTE PRINCIPALE ==
   Easter egg principal de Bunker 7 (demande d'Anthony du 9 novembre 2026, pour le jeu 2.0.7) :
   1. courant rétabli, toutes les portes ouvertes, une arme non explosive au palier II ou III du Glas (Résonance) en
      main : le joueur tire sur le disjoncteur ; il s'électrifie (arcs, champ qui blesse autour) pendant QP.elec s ;
   2. court-circuit : coupure (noir presque total, comme la phase 5 du boss ; machines à atouts et Glas sans courant,
      les atouts déjà pris restent ; manches figées) ;
   3. quatre lockdowns, un par salle, dans l'ordre QP.salles : la salle suivante appelle (lampes rouges faibles), le
      lockdown part quand le joueur y entre : portes fermées par un champ qui blesse, vague sans fin (QP.densite),
      chiens, chrono, musique de la salle, QP.duree s ; puis « Munitions max » ; les zombies restants poursuivent le joueur ;
   4. le disjoncteur, éteint, se rallume à la main : tout revient ;
   5. tonnerre et foudre : le toit de la Salle d'arrivée s'effondre (brèche, gravats, ciel) ; le Septième apparaît
      dessous, invulnérable et passif (modèle et effets du paquet du boss pilotés par une vue à nous) ;
   6. à l'approche : absorption de l'âme (rituel_ames de la phase 5) ; 1,4 s avant la fin, le combat démarre
      (introduction du paquet) : téléportation et absorption ensemble, le Septième visible jusqu'à la salle.
   · Logique dans QP (état, temps de jeu) ; effets, lumières et sons la lisent. Prêt pour la coop : le tir porte son
     tireur, les dégâts du champ passent par qpBlesser.
   · Aucune lampe ajoutée (gels de three r128) : lampes de la carte et HEMI multipliées après updateLights ; éclairs
     par FX.boomLight, déjà dans la scène ; pulsations lentes (au plus 3 éclats par seconde) ; aucune secousse. Seule
     exception : la couche d'effets du boss dans le bunker (B7V.fxBunker, 3 lampes), attachée à la foudre comme elle
     l'est en phase 5, la recompilation cachée sous le flash.
   Points d'accroche : tools/hooks-quete.py.
   ============================================================================ */
const QP = {
  elec: 12,                                    // s : disjoncteur électrifié avant le court-circuit
  champR: 1.7, champCoup: 0.5, champDegats: 0.18,   // m ; s entre deux coups ; part des PV max par coup
  noir: 0.03,                                  // facteur des lampes et de l'ambiance pendant la coupure (phase 5 du boss : 0,03)
  salles: ['Salle des machines', 'Entrepôt', "Salle d'arrivée", 'Infirmerie'],   // ordre des lockdowns (décision du 9 nov.)
  duree: 60,                                   // s : un lockdown (vague sans fin jusqu'au bout)
  densite: 1.5,                                // apparitions 1,5 fois plus serrées qu'une manche
  chiensT: 12, chiensMax: 3,                   // s entre deux paquets de chiens ; chiens vivants au plus
  breche: { x0: 22, x1: 27, z0: 17, z1: 21 },  // cases du toit de la Salle d'arrivée détruit par la foudre (6 × 5 m, hors lampes,
                                               // boîte, départ et points du boss)
  kB: null, toit: null, bord: null, gravats: null, chutes: null, eclairM: null, ceilSauve: null, flash: 0, brecheE: 0,
  ld: null,                                    // lockdown en cours : { i, phase 'appel' | 'actif' | 'pause', t, zone, portes, ... }
  etape: 'attente', t: 0, dernier: -1, coupe: false, manches: false, k: 1, glasAttente: false,
  fx: null, arcs: [], champT: 0, cracT: 0, flashT: 0, lampesZ: null, monde: null,
};
const qpCarte = () => !OW.on && G.mapId === BUNKER7.id && !!Features.power;
const qpZone = (nom) => LAYOUT.zones.findIndex((z) => z.name === nom);

/* ------------------------------------------------------------------ Atouts et courant --- */
/* Interaction du disjoncteur bloquée tant que la quête ne permet pas de le rallumer. */
function qpBloqueCourant() { return QP.etape === 'electrifie' || QP.etape === 'coupure' || QP.etape === 'lockdowns'; }
function qpManchesSuspendues() { return QP.manches; }

/* ------------------------------------------------------------------ Tir sur le disjoncteur --- */
/* Plaque du disjoncteur dans le monde (repère de son groupe : face vers +z local). */
function qpPlaque() {
  const g = Features.power && Features.power.group;
  if (!g) return null;
  g.updateMatrixWorld(true);
  return { m: g.matrixWorld, inv: new THREE.Matrix4().copy(g.matrixWorld).invert() };
}
const _qpO = new THREE.Vector3(), _qpD = new THREE.Vector3();
/* Rayon d'un tir (hitscan) : distance jusqu'à la face de la plaque, ou −1 (seulement en attente, courant rétabli). */
function qpRayon(s, ox, oy, oz, dx, dy, dz, maxT) {
  if (QP.etape !== 'attente' || !G.power || !qpCarte() || (typeof B7 === 'object' && B7.actif)) return -1;
  const P = qpPlaque();
  if (!P) return -1;
  _qpO.set(ox, oy, oz).applyMatrix4(P.inv);
  _qpD.set(dx, dy, dz).transformDirection(P.inv);
  if (_qpD.z > -0.05) return -1;               // de face seulement
  const t = (0.08 - _qpO.z) / _qpD.z;          // face avant de la plaque (z local 0,08)
  if (t <= 0 || t >= maxT) return -1;
  const x = _qpO.x + _qpD.x * t, y = _qpO.y + _qpD.y * t;
  return Math.abs(x) <= 0.37 && y >= 0.87 && y <= 1.94 ? t : -1;
}
/* Coup sur la plaque : étincelles ; le bon tir (arme non explosive au palier II ou III, toutes les portes ouvertes)
   électrifie le disjoncteur. Un seul coup compte par tir (jeton : numéro du tir). */
function qpTouche(s, x, y, z, jeton) {
  sparkBurst(x, y, z, -1, 0.2, 0, 4);
  if (jeton === QP.dernier || QP.etape !== 'attente') return;
  QP.dernier = jeton;
  const resonance = s && (s.tier || 0) >= 2 && !wstat(s, 'explosive');
  const portes = Object.values(World.doors).every((d) => d.opened);
  const salles = QP.salles.every((n) => qpZone(n) >= 0);   // une Bunker 7 modifiée sans l'une des quatre salles : pas de quête
  if (resonance && portes && salles) qpElectrifier();
}

/* ------------------------------------------------------------------ Étapes --- */
function qpElectrifier() {
  QP.etape = 'electrifie'; QP.t = 0; QP.champT = 0.3;
  qpEffets(true);
  const p = Features.power;
  p.anim = -1;                                 // le levier tressaute (qpMaj)
  qpSonDecharge(1);
}
function qpCouper() {
  QP.etape = 'coupure'; QP.t = 0;
  const p = Features.power;
  G.power = false;
  Sound.setHum(false);
  p.anim = -1; p.pivot.rotation.x = 0.5;      // levier retombé
  setLin(p.lampMat.color, 0x1a0505);           // voyant éteint
  for (const m of Features.perkMachines) if (m.active && PERKS[m.id] && PERKS[m.id].power) lightMachine(m, false, true);
  QP.glasAttente = true;                       // Le Glas se tait dès qu'il ne porte plus d'arme (qpGlas)
  QP.coupe = true; QP.manches = true;          // machines à atouts sans courant ; les atouts du joueur restent (décision du 9 nov.)
  qpEffets(false);
  const c = qpCentre();
  FX.boomLight.position.set(c.x, c.y, c.z); FX.boomLight.color.setHex(0xbfe4ff);
  FX.boomLight.decay = lightBandDecay(c.y, levelAtY(Features.power.group.position.y + 0.1));
  FX.boomLight.intensity = 9; FX.boomT = 0.3;
  for (let i = 0; i < 60; i++) { const a = rand(0, TAU), v = rand(2, 7); FX.sparks.emit(c.x, c.y, c.z, -Math.abs(Math.cos(a)) * v, rand(0.5, 5), Math.sin(a) * v, rand(0.3, 1), 0.75, 0.9, 1); }
  for (let i = 0; i < 4; i++) spawnPuff(c.x - 0.2, c.y + rand(-0.3, 0.3), c.z + rand(-0.3, 0.3), rand(0.6, 1.1), rand(0.2, 0.35), 0x9fd0ff, 0.9, 0.3, true, TEX.flare);
  for (let i = 0; i < 5; i++) spawnPuff(c.x - 0.3, c.y + rand(0, 0.6), c.z + rand(-0.4, 0.4), rand(0.8, 1.4), rand(1.5, 2.5), 0x2a2826, 0.5, 0.4);
  qpSonCourtCircuit();
}
/* Disjoncteur éteint : on peut le rallumer (interaction du jeu, puis qpRallume). */
function qpEteindre() { QP.etape = 'eteint'; QP.t = 0; }
/* Rallumage (interaction du disjoncteur, après activatePower) : atouts rendus, lumière revenue, manches reprises. */
function qpRallume() {
  if (QP.etape !== 'eteint') return;
  QP.etape = 'rallume'; QP.t = 0;
  QP.coupe = false; QP.glasAttente = false;    // une arme encore sous la cloche reprend son délai habituel
}

/* Le Glas se tait à la coupure ; s'il porte une arme, elle est d'abord rendue au palier atteint (décision du 9 nov.) :
   le rituel s'arrête (la cloche se relève, une fois la première frappe tombée), puis l'arme attend le joueur sous la
   cloche (F, comme d'habitude : ni arme en main remplacée de force, ni boisson ou rechargement coupés), sans être
   perdue tant que dure la coupure ; reprise, la cloche se tait. */
function qpGlas() {
  const a = Features.amp;
  if (!a) { QP.glasAttente = false; return; }
  if (a.state === 'ritual' && a.weapon && a.landed) glasRaiseStart(a);
  if (a.state === 'ritual' || a.state === 'raise') return;
  if (a.state === 'ready' && a.weapon) { a.t = 0; return; }
  if (a.state === 'rest' || a.state === 'wake' || a.state === 'mute') { a.state = 'mute'; a.t = 0; QP.glasAttente = false; }
}

/* Chaque image (updateFeatures). */
function qpMaj(dt) {
  if (QP.etape === 'attente' || QP.etape === 'fini') return;
  QP.t += dt;
  const p = Features.power;
  if (QP.etape === 'electrifie') {
    if (p) p.pivot.rotation.x = 0.5 - 0.35 - 0.25 * Math.abs(Math.sin(QP.t * 5.3) * Math.sin(QP.t * 2.1));   // levier qui tressaute
    if (p) setLin(p.lampMat.color, Math.sin(QP.t * 9) > 0.2 ? 0xd8f0ff : 0x3a6a9a);
    qpArcs(dt);
    qpChamp(dt);
    if (QP.t >= QP.elec) qpCouper();
  } else if (QP.etape === 'coupure') {
    if (QP.glasAttente) qpGlas();
    if (!QP.compile && QP.t >= 0.75) qpPrecompiler();   // dans le noir du court-circuit : tout ce qui suivra, compilé d'avance
    if (QP.t >= 3) { QP.etape = 'lockdowns'; QP.t = 0; qpLdDebut(); }
  } else if (QP.etape === 'lockdowns') {
    if (QP.glasAttente) qpGlas();
    qpLockdowns(dt);
  } else if (QP.etape === 'eteint') {
    if (QP.glasAttente) qpGlas();
  } else if (QP.etape === 'rallume') {
    if (QP.t >= 1.6) { QP.etape = 'eclair'; QP.t = 0; QP.frappe = false; }
  } else if (QP.etape === 'eclair') {
    if (!QP.frappe && QP.t >= 0.6) { QP.frappe = true; qpFoudre(); }
    qpChutes(dt);
    if (QP.sept) qpSeptiemeMaj(dt);
    if (QP.t >= 4.5) { if (QP.sept) { QP.etape = 'septieme'; QP.t = 0; } else { QP.etape = 'fini'; QP.manches = false; } }
  } else if (QP.etape === 'septieme') {
    qpChutes(dt);
    qpSeptiemeMaj(dt);
  } else if (QP.etape === 'combat') {
    if (qpTransfert()) qpSeptiemeMaj(dt);       // l'absorption continue jusqu'à la téléportation
    qpVoileMaj(dt);
  }
  if (QP.etape === 'fini') qpChutes(dt);
}

/* ------------------------------------------------------------------ Lumières --- */
/* (update, après updateLights et b7Lumieres) : coupure → noir presque total ; électrification → les lampes de la Salle
   des machines vacillent (pulsation lente) ; rallumage → retour en 1,6 s. */
function qpLumieres(dt) {
  if (!CUR.map || !World.lights) return;
  let cible = 1;
  if (QP.etape === 'coupure') cible = QP.t < 0.25 ? 0.6 : QP.t < 0.4 ? 0.9 : QP.t < 0.7 ? 0.25 : QP.noir;   // deux sursauts, puis le noir
  else if (QP.etape === 'lockdowns' || QP.etape === 'eteint') cible = QP.noir;
  else if (QP.etape === 'rallume') cible = QP.noir + (1 - QP.noir) * smooth(clamp(QP.t / 1.6, 0, 1));
  QP.k = cible;
  if (QP.etape === 'electrifie') {
    if (!QP.lampesZ || QP.monde !== World.root) { QP.monde = World.root; QP.lampesZ = World.lights.map((l) => zoneAt(l.light.position.x, l.light.position.z, l.light.position.y - 2)); }
    const zm = qpZone('Salle des machines'), v = 0.55 + 0.45 * Math.abs(Math.sin(G.time * 2.6));   // ≈ 2,6 pulsations par seconde
    World.lights.forEach((l, i) => { if (QP.lampesZ[i] === zm) l.light.intensity *= v; });
  }
  if (!QP.lampesZ || QP.monde !== World.root) { QP.monde = World.root; QP.lampesZ = World.lights.map((l) => zoneAt(l.light.position.x, l.light.position.z, l.light.position.y - 2)); }
  const L = QP.etape === 'lockdowns' && QP.ld;
  if (QP.k < 1) {
    for (let i = 0; i < World.lights.length; i++) {
      const l = World.lights[i];
      if (L && QP.lampesZ[i] === L.zone && L.phase !== 'pause') {   // salle du lockdown : alarme rouge, pulsation lente
        const v = L.phase === 'actif' ? 0.5 + 0.5 * Math.abs(Math.sin(G.time * Math.PI * 0.8)) : 0.25 + 0.25 * Math.abs(Math.sin(G.time * Math.PI * 0.5));
        l.light.color.setHex(0xff1a10); l.halo.material.color.setHex(0xff1a10);
        l.light.intensity = 2.4 * v; l.halo.material.opacity = 0.5 * v;
        l.bulbMat.color.setHex(0xff1a10).multiplyScalar(0.3 + 0.7 * v);
        if (!l.qpPortee) l.qpPortee = l.light.distance;
        l.light.distance = Math.max(l.qpPortee, 12) * 1.6;
        continue;
      }
      if (l.qpPortee) { l.light.distance = l.qpPortee; l.qpPortee = 0; }
      if (l.light.color.getHex() !== new THREE.Color(l.color).getHex()) { l.light.color.setHex(l.color); l.halo.material.color.setHex(l.color); }
      l.light.intensity *= QP.k;
      l.halo.material.opacity *= QP.k;
      l.bulbMat.color.multiplyScalar(Math.max(QP.k, 0.08));
    }
  } else for (const l of World.lights) if (l.qpPortee) { l.light.distance = l.qpPortee; l.qpPortee = 0; l.light.color.setHex(l.color); l.halo.material.color.setHex(l.color); }
  if (QP.etape === 'eclair' && QP.t < 0.6) {    // les lampes de la Salle d'arrivée faiblissent avant la foudre
    const za = qpZone("Salle d'arrivée"), v = 0.25 + 0.2 * Math.abs(Math.sin(QP.t * 9));
    World.lights.forEach((l, i) => { if (QP.lampesZ[i] === za) l.light.intensity *= v; });
  }
  QP.flash = Math.max(0, QP.flash - (dt || 0) * 4);
  if (HEMI && (QP.k < 1 || QP.kHemi < 1 || QP.flash > 0 || QP.kFlash > 0)) {
    HEMI.intensity = CUR.map.ambiance.hemi * (QP.k + 2.5 * QP.flash); QP.kHemi = QP.k; QP.kFlash = QP.flash;
  }
}

/* ------------------------------------------------------------------ Effets du disjoncteur --- */
const qpCentre = () => { const g = Features.power.group; g.updateMatrixWorld(true); return new THREE.Vector3(0, 1.4, 0.12).applyMatrix4(g.matrixWorld); };
/* Arcs (segments additifs redessinés), halo (le champ n'a pas d'anneau au sol : décision du 9 nov.) ; matières de la famille des traçantes et des bonus
   (pas de programme nouveau à compiler). */
function qpEffets(on) {
  if (!QP.fx) {
    const g = new THREE.Group();
    const n = 6, seg = 9, pos = new Float32Array(n * seg * 2 * 3), col = new Float32Array(n * seg * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const arcs = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    arcs.frustumCulled = false;
    g.add(arcs);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x8fd0ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(1.6, 1.6, 1);
    g.add(halo);
    QP.fx = { g, arcs, halo, n, seg };
  }
  const F = QP.fx;
  if (on) {
    if (F.g.parent !== scene) scene.add(F.g);
    F.halo.position.copy(qpCentre());
    F.g.visible = true;
  } else F.g.visible = false;
}
const qpChampCentre = () => { const g = Features.power.group; g.updateMatrixWorld(true); return new THREE.Vector3(0, 0, 0.9).applyMatrix4(g.matrixWorld); };
/* Arcs redessinés toutes les 70 à 130 ms entre la plaque et le mur, le sol et le plafond proches. */
function qpArcs(dt) {
  const F = QP.fx;
  if (!F) return;
  F.cracT -= dt;
  F.halo.material.opacity = 0.45 + 0.25 * Math.abs(Math.sin(G.time * 2.6));
  if (F.cracT > 0) return;
  F.cracT = rand(0.07, 0.13);
  const g = Features.power.group, P = F.arcs.geometry.attributes.position, C = F.arcs.geometry.attributes.color, E = g.position.y;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3();
  let o = 0;
  for (let i = 0; i < F.n; i++) {
    a.set(rand(-0.3, 0.3), rand(0.95, 1.85), 0.1).applyMatrix4(g.matrixWorld);
    const cible = Math.random();                // vers le mur, le sol devant, ou un point du champ
    if (cible < 0.35) b.set(rand(-1.2, 1.2), rand(0.4, 2.6), 0.02).applyMatrix4(g.matrixWorld);
    else if (cible < 0.75) { b.set(rand(-1.1, 1.1), 0.02, rand(0.4, 1.6)).applyMatrix4(g.matrixWorld); b.y = E + 0.02; }
    else b.set(rand(-0.8, 0.8), rand(1, 2.2), rand(0.6, 1.4)).applyMatrix4(g.matrixWorld);
    const k = rand(0.55, 1);
    q.copy(a);
    for (let s = 0; s < F.seg; s++) {
      r.lerpVectors(a, b, (s + 1) / F.seg);
      if (s < F.seg - 1) { r.x += rand(-0.12, 0.12); r.y += rand(-0.12, 0.12); r.z += rand(-0.12, 0.12); }
      P.setXYZ(o, q.x, q.y, q.z); C.setXYZ(o, 0.55 * k, 0.8 * k, 1 * k); o++;
      P.setXYZ(o, r.x, r.y, r.z); C.setXYZ(o, 0.55 * k, 0.8 * k, 1 * k); o++;
      q.copy(r);
    }
    if (Math.random() < 0.4) FX.sparks.emit(b.x, b.y, b.z, rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5), rand(0.15, 0.4), 0.7, 0.85, 1);
  }
  P.needsUpdate = true; C.needsUpdate = true;
  QP.flashT -= 0.1;
  if (QP.flashT <= 0 && Math.random() < 0.35) {   // grosse décharge : au plus ≈ 2 par seconde
    QP.flashT = 0.5;
    const c = qpCentre();
    FX.boomLight.position.set(c.x - 0.4, c.y, c.z); FX.boomLight.color.setHex(0x9fd8ff);
    FX.boomLight.decay = lightBandDecay(c.y, levelAtY(E + 0.1));
    FX.boomLight.intensity = 3.5; FX.boomT = 0.12;
    qpSonDecharge(0.7);
  } else if (Math.random() < 0.6) qpSonCrepite();
}
/* Champ électrique : le joueur à moins de QP.champR du point devant la plaque (même niveau) reçoit un coup toutes les QP.champCoup s. */
function qpChamp(dt) {
  QP.champT -= dt;
  if (QP.champT > 0) return;
  const c = qpChampCentre(), E = Features.power.group.position.y;
  if (Math.hypot(player.pos.x - c.x, player.pos.z - c.z) <= QP.champR && Math.abs(player.gy - E) < 1.2 && !player.down) {
    QP.champT = QP.champCoup;
    qpBlesser(QP.champDegats);
  } else QP.champT = 0;
}
/* Dégâts sans secousse ni à-coup de la vue (vertige d'Anthony), comme ceux du boss. */
function qpBlesser(fraction) {
  const sh = FX.shake, pu = player.punch;
  playerDamage(fraction * player.maxHp);
  FX.shake = sh; player.punch = pu;
  sparkBurst(player.pos.x, player.gy + 1, player.pos.z, 0, 1, 0, 6);
  qpSonDecharge(0.9);
}

/* ------------------------------------------------------------------ Remise à zéro --- */
/* (resetFeatures) : nouvelle partie, menu, carte. Les lampes et le disjoncteur sont remis par le jeu. */
function qpRemettre() {
  Object.assign(QP, { etape: 'attente', t: 0, dernier: -1, coupe: false, manches: false, glasAttente: false, champT: 0, flashT: 0, lampesZ: null });
  if (HEMI && CUR.map && (QP.k < 1 || QP.kHemi < 1)) HEMI.intensity = CUR.map.ambiance.hemi;
  QP.k = 1; QP.kHemi = 1;
  if (QP.fx) QP.fx.g.visible = false;
  // rideaux retirés sans toucher aux portes : resetFeatures vient de les refermer (doorOpen à 0) ; lampes rendues
  if (QP.ld && QP.ld.rideaux) for (const r of QP.ld.rideaux) if (r.g.parent) r.g.parent.remove(r.g);
  QP.ld = null;
  if (World.lights) for (const l of World.lights) if (l.qpPortee) { l.light.distance = l.qpPortee; l.qpPortee = 0; l.light.color.setHex(l.color); l.halo.material.color.setHex(l.color); }
  qpToitRemettre();
  qpSeptiemeRetirer();
  qpChrono(null);
  qpMusiqueFin(0.4);
}

/* ------------------------------------------------------------------ Sons (Sound.synthe) --- */
function qpSynthe() { return Sound.synthe && Sound.synthe(); }
function qpSonCrepite(pos) {
  const S = qpSynthe(); if (!S) return;
  const c = pos || qpCentre(), o = S.out({ x: c.x, z: c.z }, 0.35, 5); if (!o) return;
  const t = S.ctx.currentTime;
  for (let i = 0; i < 3; i++) S.noiseHit(t + i * rand(0.01, 0.03), rand(0.01, 0.03), rand(0.3, 0.6), 'bandpass', rand(2500, 5000), null, 3, o, 0.001);
}
function qpSonDecharge(v) {
  const S = qpSynthe(); if (!S) return;
  const c = qpCentre(), o = S.out({ x: c.x, z: c.z }, 0.6 * v, 6); if (!o) return;
  const t = S.ctx.currentTime;
  S.noiseHit(t, 0.12, 0.7, 'highpass', 1800, null, 0.8, o, 0.001);
  S.tone('sawtooth', 160, 90, t, 0.22, 0.18, o, 0.002);
  for (let i = 0; i < 5; i++) S.noiseHit(t + 0.02 + i * 0.035, 0.02, 0.4, 'bandpass', rand(3000, 6000), null, 4, o, 0.001);
}
function qpSonCourtCircuit() {
  const S = qpSynthe(); if (!S) return;
  const c = qpCentre(), o = S.out({ x: c.x, z: c.z }, 0.9, 8); if (!o) return;
  const t = S.ctx.currentTime, lp = S.filt('lowpass', 900, 0.7); lp.connect(o);
  S.noiseHit(t, 0.35, 0.9, 'lowpass', 1200, 200, 0.7, o, 0.002);          // claquement
  for (let i = 0; i < 9; i++) S.noiseHit(t + 0.03 + i * 0.05, 0.03, 0.5 - i * 0.04, 'bandpass', rand(2500, 6000), null, 3, o, 0.001);
  S.tone('sawtooth', 240, 38, t + 0.1, 1.4, 0.22, lp, 0.01);              // le courant qui tombe
}

/* ------------------------------------------------------------------ Lockdowns --- */
/* Zone du lockdown en cours (apparitions des chiens limitées à la salle), ou −1. */
function qpZoneLockdown() { return QP.etape === 'lockdowns' && QP.ld && QP.ld.phase === 'actif' ? QP.ld.zone : -1; }
/* Début de la série : les zombies encore dans le bunker repartent (rendus aux manches, figées jusqu'au combat). */
function qpLdDebut() {
  for (const z of Zombies.list.slice()) if (z.alive && !z.qp) recycleZombie(z);
  QP.ld = null;
  qpLdAppel(0);
}
/* Salle suivante : elle « appelle » (rouge faible) ; le lockdown part quand le joueur y entre. */
function qpLdAppel(i) {
  const zone = qpZone(QP.salles[i]);
  const portes = Object.values(World.doors).filter((d) => d.zones.has(zone));
  QP.ld = { i, phase: 'appel', t: 0, zone, portes, spawnT: 0, chiensT: 6, sortis: 0, tues: 0, champT: 0, cracT: 0 };
  if (i > 0) HUD.banner(QP.salles[i], 'Le verrouillage suivant vous attend', 'powerup');
}
function qpLockdowns(dt) {
  const L = QP.ld;
  if (!L) return;
  L.t += dt;
  if (L.phase === 'appel') {
    if (player.down) return;
    const ici = zoneAt(player.pos.x, player.pos.z, player.gy) === L.zone;
    const loin = L.portes.every((d) => Math.hypot(player.pos.x - d.cx, player.pos.z - d.cz) > 1.4);
    if (ici && loin) qpLdActif();
  } else if (L.phase === 'actif') {
    qpLdSpawn(dt);
    qpChampsMaj(dt);
    qpMusiqueMaj(clamp(L.t / QP.duree, 0, 1));
    qpChrono(Math.max(0, QP.duree - L.t));
    if (L.t >= QP.duree) qpLdFin();
  } else if (L.phase === 'pause') {
    if (L.t >= 4) { if (L.i + 1 < QP.salles.length) qpLdAppel(L.i + 1); else { QP.ld = null; qpEteindre(); HUD.banner('Le disjoncteur est éteint', 'Rétablissez le courant', 'powerup'); } }
  }
}
function qpLdActif() {
  const L = QP.ld;
  L.phase = 'actif'; L.t = 0; L.spawnT = 1; L.chiensT = 8;
  qpChamps(true);
  Zombies.flowT = 0;
  HUD.banner('Verrouillage', QP.salles[L.i], 'perk');
  qpSonSirene();
  qpMusiqueDebut(L.i);
}
function qpLdFin() {
  const L = QP.ld;
  L.phase = 'pause'; L.t = 0;
  qpChamps(false);
  Zombies.flowT = 0;
  qpChrono(null);
  qpMusiqueFin(2.5);
  // les zombies restants continuent de poursuivre le joueur (décision du 9 nov.) ; tués, ils rapportent leurs points
  const [a] = typeof horlPlaces === 'function' ? horlPlaces() : [{ x: player.pos.x, z: player.pos.z, gy: player.gy }];
  spawnPowerup('ammo', a.x, a.z, a.gy);
  Powerups.list[Powerups.list.length - 1].life = 30;
  HUD.banner('Verrouillage levé', QP.salles[L.i], 'powerup');
  qpSonFinLockdown();
}
/* Vague sans fin : 1,5 fois plus serrée qu'une manche, par les fenêtres de la salle et des sorties de terre ; chiens par
   paquets. Zombies marqués z.qp (morts et recyclage à part : hors manche). */
function qpLdSpawn(dt) {
  const L = QP.ld;
  L.spawnT -= dt;
  if (L.spawnT <= 0) {
    L.spawnT = 0.4;
    if (aliveCount() < RULES.maxAlive) {
      const sp = (Math.random() < 0.4 ? qpFenetre(L.zone) : null) || qpSortie(L.zone) || qpFenetre(L.zone);
      const z = sp ? spawnZombie(sp, zombieHpForRound(Math.max(1, G.round))) : null;
      if (z) { z.qp = true; L.sortis++; L.spawnT = (Math.max(0.35, 2 * Math.pow(0.95, Math.max(1, G.round) - 1)) / QP.densite) * rand(0.8, 1.2); }
    }
  }
  L.chiensT -= dt;
  if (L.chiensT <= 0) {
    L.chiensT = QP.chiensT;
    const vivants = Zombies.list.filter((z) => z.alive && z.dog && z.qp).length;
    for (let i = 0; i < Math.min(2, QP.chiensMax - vivants); i++) {
      const k = pickDogSpawn();
      if (k < 0) break;
      const d = spawnDog(k, dogHpForRound(Math.max(1, G.round)));
      if (d) d.qp = true;
    }
  }
}
function qpFenetre(zone) {
  const w = World.windows.filter((q) => q.zone === zone && q.queue.length < 2);
  return w.length ? w[(Math.random() * w.length) | 0] : null;
}
/* Sortie de terre dans la salle : case praticable, à 6 m au moins du joueur et loin des portes. */
function qpSortie(zone) {
  const L = QP.ld, ok = [];
  for (let k = 0; k < GN; k++) {
    if (zoneOf[k] !== zone || !walkNode(k) || stairAt[k] >= 0 || !(flow[k] < 1e8)) continue;
    const x = nodeCX(k), z = nodeCZ(k);
    if (Math.hypot(player.pos.x - x, player.pos.z - z) < 6) continue;
    if (L.portes.some((d) => Math.hypot(d.cx - x, d.cz - z) < 2.5)) continue;
    ok.push(k);
  }
  if (!ok.length) return null;
  const k = ok[(Math.random() * ok.length) | 0];
  return { riser: true, x: nodeCX(k), z: nodeCZ(k), li: 0, k, layer: 0, zone, y: LVY[0] };
}
/* Mort d'un zombie du lockdown (onZombieKilled) : bonus au hasard et Glas comme d'habitude, hors manche. */
function qpTue(z, info) {
  if (!z.dog && info.kind !== 'nuke') maybeDropPowerup(z.pos.x, z.pos.z, z.gy);
  glasOnKill(z, info);
  if (QP.ld) QP.ld.tues++;
}

/* ------------------------------------------------------------------ Champs électriques des portes --- */
/* Barrières des portes de la salle du lockdown (retours d'Anthony du 9 nov.) : seul le joueur est arrêté (qpBarrieres,
   depuis settleBody) ; balles, grenades et zombies passent (les portes restent ouvertes pour le moteur). Le champ est
   posé sur la face de la porte côté salle : deux voiles d'énergie qui défilent en sens contraires, bords lumineux,
   émetteurs aux montants et au linteau, lueur au sol, arcs ramifiés, étincelles, surtensions ; coup au contact.
   Matières de base du jeu (MeshBasic, Sprite, LineBasic additifs : pas de programme nouveau). */
function qpChamps(on) {
  const L = QP.ld;
  if (!L) return;
  if (!L.rideaux) L.rideaux = L.portes.map((d) => qpRideau(d, L.zone));
  for (const r of L.rideaux) {
    if (on && r.g.parent !== scene) scene.add(r.g);
    if (!on && r.g.parent) r.g.parent.remove(r.g);
    r.g.visible = on;
  }
}
/* Ressources partagées (une fois par page) : textures et matières. */
function qpChampRes() {
  if (QP.resB) return QP.resB;
  const tex = (W, H, f, rep) => { const c = makeCanvas(W, H), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); f(g, W, H); const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return share(t); };
  const voile = tex(128, 256, (g, W, H) => {          // filets d'énergie verticaux, quelques cœurs plus vifs
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * W, a = 0.12 + Math.random() * 0.55, w = 1.5 + Math.random() * 4;
      const gr = g.createLinearGradient(x - w, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(0.5, `rgba(215,240,255,${a})`); gr.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = gr; g.fillRect(x - w, 0, 2 * w, H);
    }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(230,248,255,${0.3 + Math.random() * 0.7})`; g.fillRect(Math.random() * W, Math.random() * H, 1, 2 + Math.random() * 8); }
  }, true);
  const balayage = tex(64, 256, (g, W, H) => {        // bandes horizontales et grésillement
    for (let i = 0; i < 7; i++) {
      const y = Math.random() * H, h = 4 + Math.random() * 18, gr = g.createLinearGradient(0, y - h, 0, y + h);
      gr.addColorStop(0, 'rgba(90,170,255,0)'); gr.addColorStop(0.5, `rgba(170,225,255,${0.35 + Math.random() * 0.4})`); gr.addColorStop(1, 'rgba(90,170,255,0)');
      g.fillStyle = gr; g.fillRect(0, y - h, W, 2 * h);
    }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(200,235,255,${Math.random() * 0.5})`; g.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
  }, true);
  const bord = tex(64, 64, (g, W, H) => {             // bords lumineux (montants et haut)
    const gx = g.createLinearGradient(0, 0, W, 0);
    gx.addColorStop(0, 'rgba(225,245,255,1)'); gx.addColorStop(0.12, 'rgba(120,200,255,0.35)'); gx.addColorStop(0.3, 'rgba(60,140,255,0)');
    gx.addColorStop(0.7, 'rgba(60,140,255,0)'); gx.addColorStop(0.88, 'rgba(120,200,255,0.35)'); gx.addColorStop(1, 'rgba(225,245,255,1)');
    g.fillStyle = gx; g.fillRect(0, 0, W, H);
    const gy = g.createLinearGradient(0, 0, 0, H);
    gy.addColorStop(0, 'rgba(200,235,255,0.8)'); gy.addColorStop(0.15, 'rgba(80,160,255,0)'); gy.addColorStop(0.9, 'rgba(80,160,255,0)'); gy.addColorStop(1, 'rgba(160,215,255,0.6)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gy; g.fillRect(0, 0, W, H);
  });
  const sol = tex(64, 64, (g, W, H) => {              // lueur au sol, le long du seuil
    const gy = g.createLinearGradient(0, 0, 0, H);
    gy.addColorStop(0, 'rgba(60,140,255,0)'); gy.addColorStop(0.5, 'rgba(170,225,255,1)'); gy.addColorStop(1, 'rgba(60,140,255,0)');
    g.fillStyle = gy; g.fillRect(0, 0, W, H);
  });
  const add = (o) => share(new THREE.MeshBasicMaterial(Object.assign({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }, o)));
  QP.resB = {
    voile, balayage,
    mVoile: add({ map: voile, color: 0x8fd4ff, opacity: 0.7 }),
    mBalayage: add({ map: balayage, color: 0x5fb4ff, opacity: 0.55 }),
    mBord: add({ map: bord, color: 0x9fdcff, opacity: 0.8 }),
    mSol: add({ map: sol, color: 0x7fc8ff, opacity: 0.6 }),
    mTige: add({ color: 0xa8e4ff, opacity: 0.9 }),
    mArc: share(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })),
    mHalo: share(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x9fdcff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })),
  };
  // couleurs données en sRGB : converties une fois (three r128 rend en sRGB ; sinon 2 à 3 fois trop claires, délavées)
  for (const k of ['mVoile', 'mBalayage', 'mBord', 'mSol', 'mTige', 'mHalo']) { QP.resB[k].color.convertSRGBToLinear(); _linDone.add(QP.resB[k]); }
  return QP.resB;
}
/* Une barrière : sur la face de la porte côté salle (zone), tournée vers la salle. */
function qpRideau(d, zone) {
  const xs = d.cells.map((k) => (k % GN) % GW), zs = d.cells.map((k) => ((k % GN) / GW) | 0);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
  const alongX = x1 - x0 > z1 - z0, w = alongX ? x1 - x0 : z1 - z0;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, E = d.E;
  // côté de la salle : celui dont la case voisine est dans la zone du lockdown
  const bas = alongX ? zoneAt(mx, z0 - 0.5, E) === zone : zoneAt(x0 - 0.5, mz, E) === zone;
  const plan = alongX ? (bas ? z0 : z1) : (bas ? x0 : x1), sens = bas ? -1 : 1;   // sens : normale vers la salle
  const R = qpChampRes(), g = new THREE.Group();
  g.position.set(alongX ? mx : plan + sens * 0.02, E, alongX ? plan + sens * 0.02 : mz);
  g.rotation.y = alongX ? 0 : Math.PI / 2;
  const H = DOOR_H, plane = (m, sx, sy, y, z) => { const me = new THREE.Mesh(GEO.plane || new THREE.PlaneGeometry(1, 1), m); me.scale.set(sx, sy, 1); me.position.set(0, y, z); me.frustumCulled = false; g.add(me); return me; };
  const voile = plane(R.mVoile, w, H, H / 2, 0), balayage = plane(R.mBalayage, w, H, H / 2, 0.025), bordM = plane(R.mBord, w, H, H / 2, 0.012);
  const solM = plane(R.mSol, w, 0.9, 0.02, 0); solM.rotation.x = -Math.PI / 2;
  const tiges = [];
  for (const [x, y, sx, sy] of [[-w / 2, H / 2, 0.06, H], [w / 2, H / 2, 0.06, H], [0, H, w, 0.06]]) {
    const t = new THREE.Mesh(GEO.box, R.mTige); t.scale.set(sx, sy, 0.06); t.position.set(x, y, 0); g.add(t); tiges.push(t);
  }
  const halos = [];
  for (const [x, y] of [[-w / 2, 0.15], [-w / 2, H], [w / 2, 0.15], [w / 2, H], [0, H]]) { const h = new THREE.Sprite(R.mHalo); h.position.set(x, y, 0.05); h.scale.set(0.7, 0.7, 1); g.add(h); halos.push(h); }
  const seg = 10, n = 7, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * seg * 2 * 3 * 2), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * seg * 2 * 3 * 2), 3));
  const arcs = new THREE.LineSegments(geo, R.mArc); arcs.frustumCulled = false; g.add(arcs);
  g.visible = false;
  return { g, w, seg, n, arcs, halos, voile, d, alongX, plan, sens, x0, x1, z0, z1, E, surT: rand(1, 3), sur: 0, etT: 0 };
}
/* Le joueur ne passe pas (settleBody, avant le choix de la case) : gardé du côté de la salle, à son rayon du champ. */
function qpBarrieres(b, rad) {
  const L = QP.ld;
  if (!L || L.phase !== 'actif' || !L.rideaux) return;
  for (const r of L.rideaux) {
    if (Math.abs((b.gy || 0) - r.E) > 1.5) continue;
    const lng = r.alongX ? b.pos.x : b.pos.z, lo = r.alongX ? r.x0 : r.z0, hi = r.alongX ? r.x1 : r.z1;
    if (lng < lo - rad || lng > hi + rad) continue;
    const c = r.alongX ? b.pos.z : b.pos.x, a = r.alongX ? r.z0 : r.x0, z = r.alongX ? r.z1 : r.x1;
    let v = c;
    if (r.sens < 0) { if (c > r.plan - rad && c < (a + z) / 2 + 0.5) v = r.plan - rad; }   // salle du côté bas
    else if (c < r.plan + rad && c > (a + z) / 2 - 0.5) v = r.plan + rad;               // salle du côté haut
    if (v !== c) { if (r.alongX) b.pos.z = v; else b.pos.x = v; }
  }
}
/* Chaque image d'un lockdown : voiles qui défilent, scintillement, surtensions, arcs, étincelles, coups au contact. */
function qpChampsMaj(dt) {
  const L = QP.ld, R = QP.resB;
  if (!R) return;
  const t = G.time, fl = 0.9 + 0.1 * Math.sin(t * 5.3);   // scintillement lent (règle des flashs : pas de hasard à chaque image)
  R.voile.offset.set(0, (t * 0.9) % 1); R.balayage.offset.set(0, -(t * 0.37) % 1);
  L.cracT -= dt;
  const redessine = L.cracT <= 0;
  if (redessine) L.cracT = rand(0.06, 0.11);
  let sur = 0;
  for (const r of L.rideaux || []) {
    r.surT -= dt;
    if (r.surT <= 0) { r.surT = rand(1.8, 4); r.sur = 1; qpSonDecharge(0.5); for (let i = 0; i < 10; i++) qpEtincelle(r, rand(-r.w / 2, r.w / 2), rand(0.1, DOOR_H)); }
    r.sur = Math.max(0, r.sur - dt * 4);
    sur = Math.max(sur, r.sur);
    for (const h of r.halos) { const k = 0.6 + 0.25 * Math.sin(t * 7 + h.position.x * 3 + h.position.y) + 0.4 * r.sur; h.scale.set(k, k, 1); }
    r.etT -= dt;
    if (r.etT <= 0) { r.etT = rand(0.08, 0.2); qpEtincelle(r, Math.random() < 0.5 ? -r.w / 2 : r.w / 2, rand(0.1, 0.5)); }
    if (!redessine) continue;
    const P = r.arcs.geometry.attributes.position, C = r.arcs.geometry.attributes.color;
    let o = 0;
    const seg = (ax, ay, bx, by, k, nS) => {           // un arc dentelé de a à b, et son halo bleu décalé
      let px = ax, py = ay;
      for (let j = 0; j < nS && o < P.count - 3; j++) {
        const f = (j + 1) / nS, nx = j === nS - 1 ? bx : lerp(ax, bx, f) + rand(-0.12, 0.12), ny = j === nS - 1 ? by : lerp(ay, by, f) + rand(-0.16, 0.16), nz = rand(-0.04, 0.04);
        P.setXYZ(o, px, py, 0.03); C.setXYZ(o, k, k, k); o++; P.setXYZ(o, nx, ny, nz + 0.03); C.setXYZ(o, k, k, k); o++;
        P.setXYZ(o, px + 0.015, py + 0.02, 0.05); C.setXYZ(o, 0.25 * k, 0.55 * k, k); o++; P.setXYZ(o, nx + 0.015, ny + 0.02, nz + 0.05); C.setXYZ(o, 0.25 * k, 0.55 * k, k); o++;
        if (Math.random() < 0.12 && o < P.count - 8) { const bx2 = nx + rand(-0.4, 0.4), by2 = ny + rand(-0.4, 0.4); P.setXYZ(o, nx, ny, nz + 0.03); C.setXYZ(o, 0.6 * k, 0.8 * k, k); o++; P.setXYZ(o, bx2, by2, 0.03); C.setXYZ(o, 0.6 * k, 0.8 * k, k); o++; }
        px = nx; py = ny;
      }
    };
    for (let i = 0; i < r.n; i++) {
      const k = rand(0.55, 1);
      if (i < 5) seg(-r.w / 2, rand(0.15, DOOR_H - 0.1), r.w / 2, rand(0.15, DOOR_H - 0.1), k, r.seg);          // d'un montant à l'autre
      else seg(rand(-r.w / 2, r.w / 2), DOOR_H, rand(-r.w / 2, r.w / 2), 0.02, k, r.seg);                            // du linteau au sol
    }
    while (o < P.count) { P.setXYZ(o, 0, 0, 0); C.setXYZ(o, 0, 0, 0); o++; }
    P.needsUpdate = true; C.needsUpdate = true;
    if (Math.random() < 0.35) qpSonCrepite(r.g.position);
  }
  R.mVoile.opacity = (0.55 + 0.2 * Math.abs(Math.sin(t * 2.2)) + 0.3 * sur) * fl;
  R.mBalayage.opacity = (0.4 + 0.15 * Math.abs(Math.sin(t * 3.1 + 1)) + 0.3 * sur) * fl;
  R.mBord.opacity = 0.75 + 0.25 * sur; R.mSol.opacity = 0.45 + 0.15 * Math.sin(t * 4) + 0.3 * sur; R.mTige.opacity = 0.8 + 0.2 * fl;
  // contact : le joueur contre une barrière (qpBarrieres le tient à son rayon du champ)
  L.champT -= dt;
  if (L.champT > 0) return;
  for (const r of L.rideaux || []) {
    const lng = r.alongX ? player.pos.x : player.pos.z, lo = r.alongX ? r.x0 : r.z0, hi = r.alongX ? r.x1 : r.z1, c = r.alongX ? player.pos.z : player.pos.x;
    if (Math.abs(c - r.plan) < player.radius + 0.2 && lng > lo - 0.2 && lng < hi + 0.2 && Math.abs(player.gy - r.E) < 1.5 && !player.down) {
      L.champT = QP.champCoup; qpBlesser(QP.champDegats);
      r.sur = 1;
      for (let i = 0; i < 14; i++) qpEtincelle(r, clamp(lng - (r.alongX ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2), -r.w / 2, r.w / 2) * (r.alongX ? 1 : -1), rand(0.6, 1.6));
      return;
    }
  }
}
/* Étincelle au point (x, y) du plan d'une barrière (repère du groupe). */
function qpEtincelle(r, x, y) {
  r.g.updateMatrixWorld(true);
  const v = new THREE.Vector3(x, y, 0.05).applyMatrix4(r.g.matrixWorld);
  const nx = r.alongX ? 0 : r.sens, nz = r.alongX ? r.sens : 0;
  FX.sparks.emit(v.x, v.y, v.z, nx * rand(0.5, 2.5) + rand(-1, 1), rand(-0.5, 2.5), nz * rand(0.5, 2.5) + rand(-1, 1), rand(0.15, 0.45), 0.7, 0.88, 1);
}
/* ------------------------------------------------------------------ Chrono du lockdown --- */
function qpChrono(s) {
  let el = document.getElementById('qp-chrono');
  if (s == null) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'qp-chrono';
    el.style.cssText = 'position:absolute;left:50%;top:9%;transform:translateX(-50%);font:700 26px Teko, "ZS Teko", sans-serif;letter-spacing:2px;color:#ff5a48;text-shadow:0 0 8px rgba(255,40,20,.6),0 2px 3px #000;pointer-events:none;z-index:30';
    (document.getElementById('hud') || document.body).appendChild(el);
  }
  el.style.display = '';
  const n = Math.ceil(s);
  el.textContent = `VERROUILLAGE · ${QP.salles[QP.ld.i].toUpperCase()} · ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ Sons des lockdowns --- */
function qpSonSirene() {
  const S = qpSynthe(); if (!S) return;
  const o = S.out(null, 0.22); if (!o) return;
  const t = S.ctx.currentTime, lp = S.filt('lowpass', 1800, 0.8); lp.connect(o);
  for (let i = 0; i < 3; i++) { S.tone('square', 560, 760, t + i * 1.1, 0.55, 0.35, lp, 0.02); S.tone('square', 760, 560, t + i * 1.1 + 0.55, 0.55, 0.35, lp, 0.02); }
}
function qpSonFinLockdown() {
  const S = qpSynthe(); if (!S) return;
  const o = S.out(null, 0.3); if (!o) return;
  const t = S.ctx.currentTime, lp = S.filt('lowpass', 1200, 0.7); lp.connect(o);
  S.tone('sawtooth', 300, 60, t, 0.9, 0.25, lp, 0.01);
  S.noiseHit(t + 0.05, 0.25, 0.4, 'lowpass', 800, 150, 0.7, o, 0.003);
}

/* ------------------------------------------------------------------ Toit de la Salle d'arrivée --- */
const qpBrecheActive = () => !!CUR.map && CUR.map.id === BUNKER7.id && !CUR.editor && !OW.on;
/* (buildLevelGeometry) : case du plafond de la brèche, posée dans un maillage à part qu'on peut cacher. */
function qpBrecheCase(li, x, z) {
  const b = QP.breche;
  return li === 0 && qpBrecheActive() && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
}
function qpPlafondBreche(td, ct, x, z, Y, tint, aoFn) {
  if (!QP.kB) QP.kB = new TexMesh();
  const v = [[x + 1, Y, z + 1], [x, Y, z + 1], [x, Y, z], [x + 1, Y, z]];
  const uvs = v.map((p) => [p[0] / td.size[0], -p[2] / td.size[1]]);
  const cols = v.map((p) => { const k = aoFn ? aoFn(p[0], p[2]) : 1; return [tint[0] * k, tint[1] * k, tint[2] * k]; });
  QP.kB.quad(ct, v, [0, -1, 0], uvs, cols);
}
/* (buildLevelGeometry, après K.build) : le morceau de plafond, puis le bord cassé et les gravats, cachés jusqu'à la foudre. */
function qpBrecheConstruire(group, E) {
  QP.toit = QP.bord = QP.gravats = null; QP.chutes = null;
  if (!QP.kB) return;
  const toit = new THREE.Group(); toit.name = 'toit-breche';
  QP.kB.build(toit); QP.kB = null;
  group.add(toit);
  QP.toit = toit; QP.brecheE = E;
  debRessources();                             // rochers et béton des débris (HD-debris.js)
  const b = QP.breche, X0 = b.x0, X1 = b.x1 + 1, Z0 = b.z0, Z1 = b.z1 + 1, Y = E + WALL_H, R = mulberry32(7307);
  if (!QP.matsT) {
    const std = (o) => share(new THREE.MeshStandardMaterial(o));
    QP.matsT = { beton: std({ map: levelTexture('concrete_cracked'), color: 0xb9b4ab, roughness: 0.95 }), fer: std({ color: 0x4a3426, roughness: 0.7, metalness: 0.4 }) };
  }
  const M = QP.matsT, m4 = (x, y, z, rx, ry, rz, sx, sy, sz) => mtx(x, y, z, rx, ry, rz, sx, sy, sz);
  // bord cassé : morceaux de dalle dentelés qui débordent dans le trou et pendent un peu ; fers à béton
  const bloc = [], fers = [];
  const cote = (ax, az, bx, bz, nx, nz) => {
    const L = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < L; t += 0.3 + R() * 0.25) {
      const f = t / L, x = lerp(ax, bx, f), z = lerp(az, bz, f), d = 0.08 + R() * 0.4, w = 0.3 + R() * 0.35, th = 0.22 + R() * 0.14;
      bloc.push({ geo: GEO.box, matrix: m4(x + nx * d / 2, Y + 0.08 - R() * 0.12, z + nz * d / 2, (R() - 0.5) * 0.5, (R() - 0.5) * 0.3, (R() - 0.5) * 0.5, nz ? w : d, th, nz ? d : w) });
      if (R() < 0.35) fers.push({ geo: GEO.cyl, matrix: m4(x + nx * (d + 0.15), Y - 0.12, z + nz * (d + 0.15), nz ? 0.9 + R() * 0.6 : (R() - 0.5) * 0.6, 0, nx ? 0.9 + R() * 0.6 : (R() - 0.5) * 0.6, 0.012, 0.35 + R() * 0.45, 0.012) });
    }
  };
  cote(X0, Z0, X1, Z0, 0, 1); cote(X1, Z1, X0, Z1, 0, -1); cote(X0, Z1, X0, Z0, 1, 0); cote(X1, Z0, X1, Z1, -1, 0);
  const bord = new THREE.Group(); bord.name = 'toit-bord';
  bord.add(new THREE.Mesh(mergeGeometries(bloc), M.beton));
  if (fers.length) bord.add(new THREE.Mesh(mergeGeometries(fers), M.fer));
  bord.visible = false; group.add(bord); QP.bord = bord;
  // gravats au sol : un tas bas de rochers et de dalles (pas sur le départ ni sur les points du boss)
  const roches = [[], [], []], dalles = [];
  for (let i = 0; i < 70; i++) {
    const x = lerp(X0 + 0.6, X1 - 0.6, R()), z = lerp(Z0 + 0.6, Z1 - 0.7, R());
    const c = 1 - Math.min(1, Math.hypot((x - (X0 + X1) / 2) / 3, (z - (Z0 + Z1) / 2) / 2.5)), r = 0.08 + R() * 0.16 + c * 0.12;
    roches[(R() * 3) | 0].push({ geo: DEB.geos[(R() * 6) | 0], matrix: m4(x, E + r * 0.5, z, R() * TAU, R() * TAU, R() * TAU, r, r * 0.8, r) });
  }
  for (let i = 0; i < 10; i++) {
    const x = lerp(X0 + 0.8, X1 - 0.8, R()), z = lerp(Z0 + 0.8, Z1 - 0.9, R());
    dalles.push({ geo: GEO.box, matrix: m4(x, E + 0.12 + R() * 0.12, z, (R() - 0.5) * 0.6, R() * TAU, (R() - 0.5) * 0.6, 0.5 + R() * 0.5, 0.2 + R() * 0.1, 0.4 + R() * 0.5) });
  }
  const gravats = new THREE.Group(); gravats.name = 'toit-gravats';
  roches.forEach((l, i) => { if (l.length) gravats.add(new THREE.Mesh(mergeGeometries(l), DEB.mats.roches[i])); });
  gravats.add(new THREE.Mesh(mergeGeometries(dalles), M.beton));
  gravats.visible = false; group.add(gravats); QP.gravats = gravats;
  // dalles qui tombent à la foudre (puis restent au sol)
  QP.chutes = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(GEO.box, M.beton);
    m.scale.set(0.35 + R() * 0.55, 0.2 + R() * 0.12, 0.3 + R() * 0.5); m.visible = false; group.add(m);
    QP.chutes.push({ m, x: lerp(X0 + 0.4, X1 - 0.4, R()), z: lerp(Z0 + 0.4, Z1 - 0.6, R()), vy: 0, ax: (R() - 0.5) * 6, az: (R() - 0.5) * 6, t: -1, pose: false });
  }
}
/* La foudre frappe la Salle d'arrivée : éclair, flash, tonnerre, le toit s'effondre. */
function qpFoudre() {
  const b = QP.breche, E = QP.brecheE, cx = (b.x0 + b.x1 + 1) / 2, cz = (b.z0 + b.z1 + 1) / 2;
  qpSonTonnerre();
  QP.flash = 1; HUD.flashK = Math.max(HUD.flashK, 0.55);
  FX.boomLight.position.set(cx, E + 1.5, cz); FX.boomLight.color.setHex(0xdfe8ff);
  FX.boomLight.decay = lightBandDecay(E + 1.5, levelAtY(E + 0.1));
  FX.boomLight.intensity = 14; FX.boomT = 0.45;
  qpEclair(cx, E, cz);
  qpSeptiemeApparait(cx, E, cz);
  if (QP.toit) {
    QP.toit.visible = false; QP.bord.visible = true; QP.gravats.visible = true;
    QP.ceilSauve = [];
    for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) { const k = z * GW + x; QP.ceilSauve.push([k, ceilOn[k]]); ceilOn[k] = 0; }   // les tirs partent au ciel
    for (const c of QP.chutes) { c.t = 0; c.vy = -rand(0, 2); c.m.position.set(c.x, E + WALL_H - 0.1, c.z); c.m.rotation.set(rand(-0.3, 0.3), rand(0, TAU), rand(-0.3, 0.3)); c.m.visible = true; c.pose = false; }
  }
  for (let i = 0; i < 18; i++) spawnPuff(cx + rand(-2.8, 2.8), E + rand(0.3, 3), cz + rand(-2.2, 2.2), rand(1.2, 2.6), rand(2, 3.6), 0x3a3632, 0.5, rand(0.1, 0.5));
  for (let i = 0; i < 6; i++) spawnPuff(cx + rand(-0.4, 0.4), E + rand(0.2, 1.5), cz + rand(-0.4, 0.4), rand(1, 1.8), rand(0.2, 0.4), 0xcfe0ff, 0.9, 0.5, true, TEX.flare);
  for (let i = 0; i < 50; i++) { const a = rand(0, TAU), v = rand(2, 8); FX.sparks.emit(cx, E + 0.2, cz, Math.cos(a) * v, rand(1, 6), Math.sin(a) * v, rand(0.3, 1), 0.85, 0.9, 1); }
}
/* L'éclair : un ruban blanc bleuté, dentelé, du ciel au sol de la salle, tourné vers la caméra ; deux impulsions. */
function qpEclair(cx, E, cz) {
  const pts = [[cx + rand(-3, 3), E + 45, cz + rand(-3, 3)]];
  for (let i = 1; i <= 16; i++) { const f = i / 16; pts.push([lerp(pts[0][0], cx, f) + (i < 16 ? rand(-0.7, 0.7) : 0), lerp(E + 45, E, f), lerp(pts[0][2], cz, f) + (i < 16 ? rand(-0.7, 0.7) : 0)]); }
  const cam = camera.position, P = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), c = new THREE.Vector3(...pts[i + 1]);
    const dir = c.clone().sub(a).normalize(), vue = cam.clone().sub(a).normalize(), cote = dir.clone().cross(vue).normalize().multiplyScalar(0.18);
    const a1 = a.clone().add(cote), a2 = a.clone().sub(cote), c1 = c.clone().add(cote), c2 = c.clone().sub(cote);
    P.push(...a1.toArray(), ...a2.toArray(), ...c1.toArray(), ...a2.toArray(), ...c2.toArray(), ...c1.toArray());
  }
  if (!QP.eclairM) {
    QP.eclairM = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    QP.eclairM.frustumCulled = false;
  }
  QP.eclairM.geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  if (QP.eclairM.parent !== scene) scene.add(QP.eclairM);
  QP.eclairM.visible = true; QP.eclairT = 0;
}
/* Chaque image après la foudre : l'éclair (deux impulsions puis plus rien), les dalles qui tombent puis restent. */
function qpChutes(dt) {
  if (QP.eclairM && QP.eclairM.visible) {
    QP.eclairT += dt;
    const t = QP.eclairT;
    QP.eclairM.material.opacity = t < 0.08 ? 1 : t < 0.16 ? 0.15 : t < 0.26 ? 0.9 : Math.max(0, 0.9 - (t - 0.26) * 6);
    if (t > 0.18 && t < 0.2 && QP.flash < 0.7) { QP.flash = 0.8; HUD.flashK = Math.max(HUD.flashK, 0.35); }   // seconde impulsion
    if (t > 0.45) QP.eclairM.visible = false;
  }
  if (!QP.chutes) return;
  const E = QP.brecheE;
  for (const c of QP.chutes) {
    if (c.t < 0 || c.pose) continue;
    c.t += dt;
    c.vy -= 12 * GRAV.k * dt;
    c.m.position.y += c.vy * dt;
    c.m.rotation.x += c.ax * dt; c.m.rotation.z += c.az * dt;
    const sol = E + c.m.scale.y / 2;
    if (c.m.position.y <= sol) {
      c.m.position.y = sol;
      if (Math.abs(c.vy) > 3) { c.vy = -c.vy * 0.2; c.ax *= 0.4; c.az *= 0.4; spawnPuff(c.m.position.x, E + 0.3, c.m.position.z, rand(0.8, 1.4), rand(1, 2), 0x4a4540, 0.45, 0.3); }
      else { c.pose = true; c.m.rotation.x = rand(-0.15, 0.15); c.m.rotation.z = rand(-0.15, 0.15); }
    }
  }
}
function qpToitRemettre() {
  if (QP.ceilSauve) { for (const [k, v] of QP.ceilSauve) ceilOn[k] = v; QP.ceilSauve = null; }
  if (QP.toit) QP.toit.visible = true;
  if (QP.bord) QP.bord.visible = false;
  if (QP.gravats) QP.gravats.visible = false;
  if (QP.chutes) for (const c of QP.chutes) { c.m.visible = false; c.t = -1; c.pose = false; }
  if (QP.eclairM) QP.eclairM.visible = false;
  QP.flash = 0;
}
/* Tonnerre tout proche : craquement sec, puis un grondement grave qui roule (3 s). */
function qpSonTonnerre() {
  const S = qpSynthe(); if (!S) return;
  const o = S.out(null, 0.85); if (!o) return;
  const t = S.ctx.currentTime;
  S.noiseHit(t, 0.12, 1, 'highpass', 2200, null, 0.7, o, 0.001);
  S.noiseHit(t + 0.02, 0.5, 0.9, 'lowpass', 2400, 300, 0.7, o, 0.002);
  S.noiseHit(t + 0.15, 3.2, 0.8, 'lowpass', 420, 60, 0.6, o, 0.05);
  S.noiseHit(t + 0.6, 2.4, 0.5, 'lowpass', 260, 50, 0.6, o, 0.2);
  S.tone('sine', 55, 32, t + 0.05, 2.6, 0.35, o, 0.02);
}

/* ------------------------------------------------------------------ Le Septième dans la Salle d'arrivée --- */
/* Le combat peut-il commencer ? (boss chargé, salle prête, pas encore fait dans la partie) */
function qpSeptiemePossible() {
  return typeof B7V === 'object' && !!B7V.modele && !!B7.combat && b7Carte() && B7S.actif && B7.etat === 'inactif'
    && B7.drapeaux[B7.combat.config.general.drapeauTermine] !== true;
}
/* Le modèle est-il à nous ? (b7VueAvantRendu : attaché hors du combat pendant l'attente et la cinématique) */
function qpSeptiemeVisible() { return !!QP.sept && (QP.etape === 'eclair' || QP.etape === 'septieme' || (QP.etape === 'combat' && B7.lieu === 'bunker')); }
/* Transfert : le combat a démarré (introduction du paquet), le joueur est encore dans le bunker ; la quête garde la main
   sur le Septième et ses effets (b7VueMaj les laisse) jusqu'à la téléportation. */
function qpTransfert() { return QP.etape === 'combat' && !!QP.sept && B7.lieu === 'bunker'; }
/* À la foudre : il apparaît sous la brèche (le modèle du paquet piloté par une vue à nous : invulnérable, passif). */
function qpSeptiemeApparait(cx, E, cz) {
  if (!qpSeptiemePossible()) { QP.sept = null; return; }
  const vue = { present: true, visible: true, position: { x: cx, y: E + 1.0, z: cz }, lacet: 0, locomotion: 'levitation',
    action: { id: 'apparition', etape: 'formation', t: 0, duree: 2.6 }, regard: { x: 0, y: 0, z: 0 }, vulnerable: false,
    ailes: 'absentes', lames: 'absentes', temps: 0 };
  QP.sept = { vue, phase: 'apparition', t: 0, x: cx, z: cz, E, etat: null };
  try { if (B7V.modele.reinitialiser) B7V.modele.reinitialiser(); } catch (e) { /* rien */ }
  qpSeptiemeVue(0);
  scene.add(B7V.modele.object);
  qpFxLampes(false);                           // couche d'effets sans ses 3 lampes : le nombre de lampes ne change pas (pas de recompilation)
  if (B7V.fxBunker && B7V.fxBunker.parent !== scene) scene.add(B7V.fxBunker);
  try { renderer.compile(scene, camera); } catch (e) { /* compilé au premier rendu sinon (sous le flash) */ }
  qpBossSon('boss_apparition');
  try { B7V.fx.declencher('flash', { force: 0.35 }); } catch (e) { /* rien */ }   // éclair d'écran avec la foudre (et le voile d'écran compilé sous le flash)
}
function qpSeptiemeRetirer() {
  if (QP.sept && typeof B7V === 'object' && B7V.modele && !(B7.e && B7.actif)) {
    if (B7V.modele.object.parent) B7V.modele.object.parent.remove(B7V.modele.object);
    if (B7V.fxBunker && B7V.fxBunker.parent) B7V.fxBunker.parent.remove(B7V.fxBunker);
    try { B7V.fx.reinitialiser(); B7V.modele.reinitialiser(); } catch (e) { /* rien */ }
  }
  qpFxLampes(true);
  QP.sept = null;
  qpVoile(0);
}
function qpSeptiemeVue(dt) {
  const S = QP.sept, v = S.vue;
  v.temps = G.time;
  v.lacet = Math.atan2(player.pos.x - S.x, player.pos.z - S.z);
  v.regard.x = player.pos.x; v.regard.y = player.gy + PLAYER_EYE; v.regard.z = player.pos.z;
  try { B7V.modele.update(dt, v); } catch (e) { console.error('[quête] Septième', e); }
  qpSeptiemeEffets(dt);
}
/* Effets du paquet (couche de Bunker 7) : les mêmes qu'à la capture des âmes de la phase 5 (vortex, vrilles vers le
   joueur, âmes, voile qui va au noir), lus dans un instantané à nous : l'état inactif du combat, le boss remplacé par
   notre vue (dans le bunker). */
function qpSeptiemeEffets(dt) {
  const V = B7V, S = QP.sept;
  if (!V.fx || !S) return;
  try {
    const e0 = B7.combat.etat();
    const boss = Object.assign({}, e0.boss, S.vue, { lieu: 'bunker', present: true, visible: true });
    const etat = Object.assign({}, e0, { boss, lieu: 'bunker' });
    S.etat = etat;
    const p = player, C = V.ctx, J = C.joueurLocal;
    J.position.x = p.pos.x; J.position.y = p.gy + p.y; J.position.z = p.pos.z; J.lieu = 'bunker';
    C.temps = G.time; C.joueurs = b7Joueurs();
    V.fx.mettreAJour(dt, etat, C);
  } catch (e) { console.error('[quête] effets du Septième', e); }
}
/* Chaque image : apparition (formation, présentation), attente en méditation, puis la cinématique à l'approche. */
function qpSeptiemeMaj(dt) {
  const S = QP.sept;
  if (!S) return;
  const v = S.vue, a = v.action;
  S.t += dt;
  if (S.phase === 'apparition') {
    if (a.etape === 'formation' && S.t >= 2.6) { a.etape = 'presentation'; a.duree = 3.4; }
    a.t = a.etape === 'formation' ? S.t : S.t - 2.6;
    a.progression = clamp(a.t / a.duree, 0, 1);
    if (S.t >= 6) { S.phase = 'attente'; v.action = { id: 'recharge', etape: 'boucle' }; }
  } else if (S.phase === 'attente') {
    const d = Math.hypot(player.pos.x - S.x, player.pos.z - S.z);
    if (QP.etape === 'septieme' && d <= 5.5 && !player.down && Math.abs(player.gy - S.E) < 1.5
      && sightClear(player.pos.x, player.gy + 1.6, player.pos.z, S.x, S.E + 1.8, S.z)) qpCineDebut();
  } else if (S.phase === 'cine') {
    qpCineMaj(dt);
    if (!QP.sept) return;
  }
  qpSeptiemeVue(dt);
}

/* ------------------------------------------------------------------ Cinématique : l'âme absorbée --- */
const QP_RITUEL = { elevation: 1.0, incantation: 2.6, capture: 1.6 };   // étapes de « rituel_ames » du paquet (config phase5.rituel)
function qpCineDebut() {
  const S = QP.sept;
  S.phase = 'cine'; S.ct = 0;
  S.vue.action = { id: 'rituel_ames', etape: 'elevation', t: 0, duree: QP_RITUEL.elevation };
  B7.cine = true; b7Controle(B7.id, false); B7.invul = true;
  b7Regarder(B7.id, { x: S.x, y: S.E + 2.6, z: S.z }, 0.9);
  qpBossSon('capture_ames');
}
function qpCineMaj(dt) {
  const S = QP.sept, a = S.vue.action, R = QP_RITUEL;
  S.ct += dt;
  const t = S.ct, t1 = R.elevation, t2 = t1 + R.incantation, t3 = t2 + R.capture;
  if (t < t1) { a.etape = 'elevation'; a.t = t; a.duree = t1; }
  else if (t < t2) { a.etape = 'incantation'; a.t = t - t1; a.duree = R.incantation; }
  else { a.etape = 'capture'; a.t = Math.min(t - t2, R.capture); a.duree = R.capture; }
  a.progression = clamp(a.t / a.duree, 0, 1);
  S.vue.position.y = S.E + 1.0 + 1.2 * smooth(clamp(t / t1, 0, 1));          // il s'élève dans la brèche
  if (t > 0.9 && (!B7.regard || B7.regard.t >= B7.regard.d)) b7Regarder(B7.id, { x: S.x, y: S.vue.position.y + 1.2, z: S.z }, 0.3);
  if (!B7V.fx) qpVoile(t > t2 ? smooth(clamp((t - t2) / R.capture, 0, 1)) : 0);   // sans les effets du paquet : un voile à nous
  const F = (BOSS_B7_CONFIG.introduction && BOSS_B7_CONFIG.introduction.fondu) || 1.4;
  if (!S.demarre && t >= t3 - F) qpCineFin();                                  // téléportation (fin du fondu) = fin de la capture
}
/* Pendant la capture : le combat commence (introduction du paquet) ; le Septième reste visible et absorbe jusqu'à la
   téléportation, l'aspiration de la téléportation se mêle au voile de capture (qpEcranTeleport). */
function qpCineFin() {
  const S = QP.sept;
  if (typeof secretDecouvert === 'function') secretDecouvert('b7-quete');   // écran « Secrets » de l'Interface (2.0.7)
  QP.manches = false;                          // le combat suspend lui-même les manches
  const ok = B7.combat.demarrer();
  if (ok) { S.demarre = true; QP.etape = 'combat'; QP.t = 0; return; }
  b7Journal('erreur', 'quête : le combat refuse de démarrer');
  B7.cine = false; b7Controle(B7.id, true); B7.invul = false; B7.regard = null;
  qpSeptiemeRetirer();
  QP.etape = 'fini';
}
/* Voile noir de la cinématique, levé une fois le joueur téléporté dans la salle (l'introduction du paquet prend le relais). */
function qpVoile(k) {
  let el = document.getElementById('qp-voile');
  if (!el) {
    if (!(k > 0)) return;
    el = document.createElement('div'); el.id = 'qp-voile';
    el.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:45;opacity:0';
    document.body.appendChild(el);
  }
  el.style.opacity = String(clamp(k, 0, 1));
  QP.voileK = k;
}
function qpVoileMaj(dt) {
  if (QP.sept && B7.lieu === 'salle') { QP.sept = null; qpFxLampes(true); }   // téléporté : la logique du paquet reprend le Septième et ses lampes
  const ok = B7.lieu === 'salle' || QP.t > 6;
  if (ok) qpVoile(Math.max(0, (QP.voileK || 0) - dt / 0.5));
  if (ok && !(QP.voileK > 0)) QP.etape = 'fini';
}
/* Téléportation pendant l'absorption : le paquet ne dessine l'aspiration et le noir de son introduction que si le
   Septième est invisible ; ici il reste visible (il absorbe encore). Le voile d'écran du paquet (scène à part,
   ecranSepare) est rendu par un rendeur enveloppé qui ajoute, juste avant le rendu, l'aspiration et le noir aux courbes
   du paquet (introduction.fondu) au voile de capture. */
function qpRendeurTeleport() {
  const R = QP.rendeur || (QP.rendeur = {
    get autoClear() { return renderer.autoClear; }, set autoClear(v) { renderer.autoClear = v; },
    render(sc, cam) { qpEcranTeleport(sc); renderer.render(sc, cam); },
  });
  return R;
}
function qpEcranTeleport(sc) {
  const m = sc && sc.children[0], U = m && m.material && m.material.uniforms;
  if (!U || !U.uA || !U.uB) return;
  let te = 0;
  try { te = +B7.combat.etat().tempsEtat || 0; } catch (e) { /* rien */ }
  const F = (BOSS_B7_CONFIG.introduction && BOSS_B7_CONFIG.introduction.fondu) || 1.4, lisse = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
  U.uA.value.w = Math.max(U.uA.value.w, lisse(0, F, te));          // aspiration
  U.uB.value.x = Math.max(U.uB.value.x, lisse(F * 0.4, F, te));    // noir
}
function qpBossSon(cle) { try { if (B7.audio && B7.audio.jouer) B7.audio.jouer(cle, { plein: true, bus: 'cinema' }); } catch (e) { /* sons pas encore décodés */ } }

/* ------------------------------------------------------------------ Musique des lockdowns --- */
/* Une musique de tension par salle (demande d'Anthony du 9 novembre 2026), synthétisée (WebAudio), sur le bus de la
   musique du jeu (réglage « Musique » du joueur). Séquenceur à la double croche : chaque image programme les notes des
   0,25 s à venir (rien à charger) ; plus dense dans le dernier quart du lockdown ; fondu d'entrée et de sortie. */
const qpMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const QP_MUSIQUES = [
  { nom: 'Machinerie', bpm: 132, vol: 0.5,                    // Salle des machines : industrielle, basse obstinée en ré
    jouer(S, M, t, s, p) {
      const b = s & 15, mes = s >> 4, o = M.o;
      if (b === 0 || b === 8 || (p > 0.75 && (b === 6 || b === 14))) { S.tone('sine', 150, 42, t, 0.3, 0.9, o, 0.002); S.noiseHit(t, 0.02, 0.25, 'highpass', 3000, null, 0.7, o); }
      if (b === 4 || b === 12) { S.noiseHit(t, 0.1, 0.32, 'bandpass', 3300, 1700, 7, o); S.tone('square', 1730, 1690, t, 0.07, 0.04, o); }
      S.noiseHit(t, 0.03, b % 4 === 2 ? 0.1 : 0.05, 'highpass', 8000, null, 0.7, o);
      if (!(b & 1)) {
        const bas = [38, 38, 50, 38, 41, 38, 45, 38][(b >> 1) & 7] + (mes % 8 >= 6 ? -2 : 0);
        M.lp.frequency.setValueAtTime(380 + 900 * (0.5 + 0.5 * Math.sin(mes * 0.9 + b * 0.2)) * (0.6 + 0.4 * p), t);
        S.tone('sawtooth', qpMidi(bas), qpMidi(bas), t, 0.2, 0.2, M.lp, 0.004);
      }
      if (b === 0 && mes % 2 === 0) for (const n of [62, 69, 74]) S.tone('sawtooth', qpMidi(n), qpMidi(n) * 0.995, t, 0.55, 0.05, M.lp, 0.01);
      if (p > 0.5 && b === 0 && mes % 4 === 3) S.tone('square', 587, 880, t, 0.45, 0.035, o, 0.02);
    } },
  { nom: 'Cargaison', bpm: 104, vol: 0.55,                    // Entrepôt : tambours lourds, cuivres graves en do mineur
    jouer(S, M, t, s, p) {
      const b = s & 15, mes = s >> 4, o = M.o;
      if ([0, 3, 6, 10, 12].includes(b) || (p > 0.75 && b === 14)) { const f = b === 0 ? 95 : 120; S.tone('sine', f, f * 0.5, t, 0.4, b === 0 ? 1 : 0.7, o, 0.003); S.noiseHit(t, 0.12, 0.3, 'lowpass', 900, 200, 0.8, o); }
      if (b % 2 === 1) S.noiseHit(t, 0.02, 0.06, 'highpass', 6500, null, 0.7, o);
      if (b === 0) {
        const r = [48, 44, 46, 43][mes & 3], acc = mes % 4 === 3 ? [0, 4, 7] : [0, 3, 7], d = (60 / 104) * 4 * 0.95;
        M.lp.frequency.setValueAtTime(700 + 600 * p, t);
        for (const n of acc) S.tone('sawtooth', qpMidi(r + n), qpMidi(r + n), t, d, 0.045, M.lp, 0.09);
        S.tone('sawtooth', qpMidi(r - 12), qpMidi(r - 12), t, d, 0.07, M.lp, 0.05);
      }
      if (b === 0 && mes % 4 === 3) S.noiseHit(t, (60 / 104) * 4, 0.12, 'bandpass', 400, 3200, 3, o, 1.6);
    } },
  { nom: 'Le ciel gronde', bpm: 92, vol: 0.6,                 // Salle d'arrivée : battement de cœur, chœur dissonant, grondement
    jouer(S, M, t, s, p) {
      const b = s & 15, mes = s >> 4, o = M.o, mesure = (60 / 92) * 4;
      if (b === 0 || b === 3 || (p > 0.6 && (b === 8 || b === 11))) S.tone('sine', 72, 44, t, 0.24, b % 8 === 0 ? 0.85 : 0.55, o, 0.003);
      if (b === 0 && mes % 2 === 0) {
        const acc = mes % 4 === 0 ? [52, 55, 59, 60] : [52, 56, 58, 63];
        for (const n of acc) { S.tone('triangle', qpMidi(n), qpMidi(n) * 0.997, t, mesure * 2, 0.035, M.lp, 0.9); S.tone('sine', qpMidi(n + 12) * 1.004, qpMidi(n + 12), t, mesure * 2, 0.015, M.lp, 1.2); }
      }
      if (b === 0 && mes % 4 === 0) S.tone('sine', 41.2, 41.2, t, mesure * 4, 0.28, o, 1.5);
      if (b === 0 && mes % 8 === 4) S.noiseHit(t, 2.6, 0.35, 'lowpass', 320, 60, 0.7, o, 0.08);
      if (p > 0.6) S.noiseHit(t, 0.02, 0.05, 'highpass', 7000, null, 0.7, o);
    } },
  { nom: 'Chloroforme', bpm: 120, vol: 0.5,                   // Infirmerie : boîte à musique, trémolo, horloge, cœur qui s'emballe
    jouer(S, M, t, s, p) {
      const b = s & 15, mes = s >> 4, o = M.o;
      if (!(b & 1)) { const mel = [81, 84, 83, 79, 81, 76, 78, 74, 76, 79, 77, 73, 74, 70, 72, 69]; const n = mel[((mes & 1) << 3) + (b >> 1)]; S.bell(t, qpMidi(n), 0.05, o, 1.3); }
      const tr = [57, 64, 60, 63][mes & 3];
      M.lp.frequency.setValueAtTime(900 + 900 * p, t);
      S.tone('sawtooth', qpMidi(tr), qpMidi(tr), t, 0.11, 0.03, M.lp, 0.01); S.tone('sawtooth', qpMidi(tr + 6) * 1.003, qpMidi(tr + 6), t, 0.11, 0.02, M.lp, 0.01);
      if (b % 4 === 0) S.noiseHit(t, 0.015, 0.12, 'bandpass', 2600, null, 4, o);
      const pas = p > 0.75 ? 4 : p > 0.4 ? 8 : 16;
      if (b % pas === 0) { S.tone('sine', 70, 44, t, 0.2, 0.75, o, 0.003); S.tone('sine', 66, 42, t + 0.17, 0.2, 0.5, o, 0.003); }
    } },
];
/* Début d'un lockdown (après la sirène) : la musique de la salle i. */
function qpMusiqueDebut(i) {
  qpMusiqueFin(0.3);
  const S = qpSynthe(), def = QP_MUSIQUES[i];
  if (!S || !S.musique || !def) return;
  const o = S.out(null, 1, 4, S.musique); if (!o) return;
  const t = S.ctx.currentTime;
  o.gain.setValueAtTime(0.0001, t); o.gain.exponentialRampToValueAtTime(def.vol, t + 2.5);
  const lp = S.filt('lowpass', 700, 3); lp.connect(o);
  QP.mus = { def, o, lp, pas: 0, next: t + 1.2, vol: def.vol };
}
/* Chaque image d'un lockdown actif : notes des 0,25 s à venir (après une pause, on reprend sans rattraper). */
function qpMusiqueMaj(p) {
  const M = QP.mus, S = qpSynthe();
  if (!M || !S) return;
  const now = S.ctx.currentTime, d = 60 / M.def.bpm / 4;
  if (M.next < now - 0.1) M.next = now + 0.05;
  while (M.next < now + 0.25) { try { M.def.jouer(S, M, M.next, M.pas, p); } catch (e) { console.error('[quête] musique', e); QP.mus = null; return; } M.pas++; M.next += d; }
}
/* Fin (lockdown fini, remise à zéro) : fondu, puis la sortie se détache. */
function qpMusiqueFin(duree = 2) {
  const M = QP.mus, S = qpSynthe();
  QP.mus = null;
  if (!M || !S) return;
  const t = S.ctx.currentTime;
  try { M.o.gain.cancelScheduledValues(t); M.o.gain.setValueAtTime(Math.max(0.0001, M.o.gain.value), t); M.o.gain.exponentialRampToValueAtTime(0.0001, t + duree); } catch (e) { /* rien */ }
  setTimeout(() => { try { M.o.disconnect(); } catch (e) { /* rien */ } }, (duree + 6) * 1000);
}

/* Lampes de la couche d'effets du boss dans Bunker 7 (3 lampes ponctuelles) : cachées tant que la quête s'en sert
   (le nombre de lampes de la scène ne change pas : three r128 recompilerait toutes les matières, gel de plusieurs
   secondes sur une carte graphique), rendues quand le combat la reprend. */
function qpFxLampes(on) {
  if (!on) {
    if (QP.fxLampes || typeof B7V !== 'object' || !B7V.fxBunker) return;
    QP.fxLampes = [];
    B7V.fxBunker.traverse((o) => { if (o.isLight && o.visible) { o.visible = false; QP.fxLampes.push(o); } });
  } else if (QP.fxLampes) { for (const o of QP.fxLampes) o.visible = true; QP.fxLampes = null; }
}

/* Compilation d'avance (au court-circuit, dans le noir) de tout ce que la suite dessinera : le Septième et la couche
   d'effets de Bunker 7 (toutes leurs pièces, même cachées : vortex, vrilles, âmes de la capture…), puis la salle du boss
   telle qu'à l'entrée (ambiance, salle, mini-boss : b7Precompiler). Sans elle, three r128 compilait d'un bloc à la foudre
   (≈ 100 programmes) et à l'arrivée dans la salle (120) : gels de plusieurs secondes relevés par Anthony le 9 novembre.
   Le nombre de lampes restant le même partout sur Bunker 7 (HC-boss-lampes.js, lampes de la couche cachées pendant la
   quête), les programmes compilés ici servent tels quels. Les erreurs de compilation ne sont pas lues pendant ce temps
   (debug.checkShaderErrors) : le pilote compile en parallèle au lieu de bloquer la page à chaque programme. */
function qpPrecompiler() {
  QP.compile = true;
  if (!qpSeptiemePossible() || !B7S.racine || G.state !== 'playing') return;
  const S = B7S, dbg = renderer.debug.checkShaderErrors, t0 = performance.now(), n0 = renderer.info.programs ? renderer.info.programs.length : 0;
  renderer.debug.checkShaderErrors = false;
  const lampes = !QP.fxLampes;
  try {
    // Bunker 7 : le Septième et la couche d'effets, toutes leurs pièces visibles le temps de compiler
    qpFxLampes(false);
    const racines = [B7V.modele.object, B7V.fxBunker].filter(Boolean), poses = [], caches = [];
    for (const r of racines) { if (r.parent !== scene) { scene.add(r); poses.push(r); } r.traverse((o) => { if (!o.visible && !o.isLight) { o.visible = true; caches.push(o); } }); }
    if (typeof b7LampesEgaliser === 'function') b7LampesEgaliser(true);
    try { renderer.compile(scene, camera); } finally { for (const o of caches) o.visible = false; for (const r of poses) scene.remove(r); }
    // la salle, comme à l'entrée du combat
    if (!B7A.compile && S.racine.parent !== scene && !S.dans) {
      // comme à l'entrée (HC-boss-lampes.js) : lampes égalisées juste avant la compilation, une fois tout attaché
      const c0 = renderer.compile;
      renderer.compile = function (sc, cam) { if (typeof b7LampesEgaliser === 'function') b7LampesEgaliser(true); return c0.call(this, sc, cam); };
      b7SalleAmbiance(true); scene.add(S.racine);
      try { b7Precompiler(); }
      finally { renderer.compile = c0; scene.remove(S.racine); b7SalleAmbiance(false); if (typeof b7LampesEgaliser === 'function') b7LampesEgaliser(true); }
    }
  } catch (e) { console.error('[quête] compilation d\'avance', e); }
  finally { renderer.debug.checkShaderErrors = dbg; if (lampes) qpFxLampes(true); }
  QP.compileMs = Math.round(performance.now() - t0); QP.compileN = (renderer.info.programs ? renderer.info.programs.length : 0) - n0;
}
