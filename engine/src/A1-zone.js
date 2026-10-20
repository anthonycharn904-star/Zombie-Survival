/* ------------------------------------------------------- Zone jouable (jeu 2.0.6) --
   Demande d'Anthony du 18 octobre 2026 : Khamsin ramené au plateau des pyramides (son tracé : le bord du
   plateau). La zone jouable est l'union des lieux nommés « Zone jouable » de la carte : des cercles que les
   Mod Tools posent, déplacent, agrandissent et retirent comme les autres lieux (outil Éléments, « Lieu
   nommé »). Une carte qui n'en a pas (Désert vierge, cartes des Mod Tools d'avant) n'a pas de zone : rien
   ne change. La Lune n'en a jamais (pas de tempête de sable).
   Dehors, une tempête de sable permanente, faite du système des tempêtes de Khamsin (A0-storm) : son
   niveau ressenti (khStormLevelAt) monte avec la distance au bord, d'où les mêmes effets qu'aux manches de
   tempête (brouillard et distance d'affichage, ciel et lumière, sable qui file, vent, mini-carte brouillée
   puis coupée, véhicules ralentis, phares). Aucun mur : on y entre, mais on n'y survit pas.
     · ZONE.band m avant le bord : le vent se lève (niveau 0 → 1 au bord, sans dégâts) ;
     · dehors : niveau 1 → 2 sur ZONE.d2 m, puis 2 → 3 sur ZONE.d3 m (visibilité 150 m, puis 30 m) ;
     · exposition (s) : elle monte dehors, plus vite en profondeur (1 + profondeur ÷ ZONE.rise par seconde),
       et retombe dedans (ZONE.fall par seconde) ; dehors, des dégâts toutes les ZONE.hurt.every s, qui
       croissent avec elle et avec la profondeur ; ni abri (toit, sous-sol), ni caisse de véhicule, ni
       régénération (le coup précédent est toujours récent), ni second souffle : la tempête tue sans
       réanimation, et quoi qu'il arrive à ZONE.lethal s d'exposition. Mesures (100 PV, à pied) : demi-tour
       après 3 ou 4 s dehors, on revient avec 30 à 65 PV ; après 5 s, ou en continuant, la mort en 8 à 9 s
       dehors (30 à 45 m) ; Mastodonte : 12 à 14 s ; en jeep : 7 s.
   Les zombies restent dedans : ils n'apparaissent pas dehors (Desséchés, Rôdeurs), leur champ de flux ne
   passe pas dehors, et un corps qui sort est ramené au bord. Un rideau de poussière (le mur de sable du
   jeu) suit le bord à ZONE.wall m dehors ; vu de l'intérieur, il cache le désert lointain et s'efface quand
   on entre dans la tempête. Les manches de tempête restent celles du jeu : leur niveau et celui de la zone
   se combinent (le plus fort compte). */
const ZONE = {
  re: /^\s*zone\s+jouable\s*$/i,
  circles: [],
  band: 40, d2: 20, d3: 55,                        // m : vent avant le bord ; niveaux 2 et 3 dehors
  wall: 70, wallH: 200, wallA: 0.85,               // rideau de poussière : à 70 m dehors, 200 m de haut, opacité
  rise: 80, fall: 0.6, lethal: 15,                 // exposition : montée, retombée, mort (s)
  hurt: { every: 0.5, base: 1.5, k: 0.4, pow: 1.7, depth: 0.12 },   // dégâts par seconde : base + k · exposition^pow + depth · profondeur (m)
  expo: 0, tick: 0, d: -Infinity, out: false, sndT: 0, curtain: null, killed: false,
};
const zoneIsLoc = (L) => !!L && typeof L.name === 'string' && ZONE.re.test(L.name);
/* Cercles de la zone d'une carte (ses lieux « Zone jouable »). */
const zoneCirclesOf = (map) => ((map && map.locs) || []).filter(zoneIsLoc).map((L) => ({ x: L.x, z: L.z, r: L.r }));
const zoneOn = () => OW.on && OW.worldId !== 'lune' && ZONE.circles.length > 0;
/* Distance au bord de la zone (négative dedans). */
function zoneDist(x, z) {
  let d = Infinity;
  for (const c of ZONE.circles) { const e = Math.hypot(x - c.x, z - c.z) - c.r; if (e < d) d = e; }
  return d;
}
/* Niveau de la tempête permanente en (x, z) : 0 dedans … 3 au cœur (échelle des tempêtes de Khamsin). */
function zoneLevelAt(x, z) {
  if (!zoneOn()) return 0;
  const d = zoneDist(x, z), Z = ZONE;
  if (d <= -Z.band) return 0;
  if (d <= 0) return smooth((d + Z.band) / Z.band);
  if (d <= Z.d2) return 1 + d / Z.d2;
  return Math.min(3, 2 + (d - Z.d2) / (Z.d3 - Z.d2));
}
/* Point le plus proche à l'intérieur (pour ramener un corps) : sur le cercle dont le bord est le plus près. */
function zoneKeep(b, m = 0.3) {
  if (!zoneOn()) return;
  let best = null, bd = Infinity;
  for (const c of ZONE.circles) { const e = Math.hypot(b.pos.x - c.x, b.pos.z - c.z) - c.r; if (e < bd) { bd = e; best = c; } }
  if (!best || bd <= -m) return;
  const dx = b.pos.x - best.x, dz = b.pos.z - best.z, d = Math.hypot(dx, dz) || 1, k = (best.r - m) / d;
  b.pos.x = best.x + dx * k; b.pos.z = best.z + dz * k;
}

/* ---- Au chargement : cercles, rideau de poussière (pas dans les Mod Tools : la vue de l'éditeur reste claire) */
function owZoneSetup(root, map, opts = {}) {
  ZONE.circles = OW.worldId === 'lune' ? [] : zoneCirclesOf(map);
  const key = JSON.stringify(ZONE.circles);
  if (key !== ZONE.key) { ZONE.key = key; OWH.bg = null; }        // fond de la mini-carte refait (bord de la zone)
  ZONE.curtain = null;
  zoneReset();
  if (!ZONE.circles.length || opts.editor || !OW.sandWall) return;
  ZONE.curtain = zoneCurtain();
  root.add(ZONE.curtain);
}
function zoneReset() {
  ZONE.expo = 0; ZONE.tick = 0; ZONE.d = -Infinity; ZONE.out = false; ZONE.killed = false; ZONE.sndT = 0;
}
/* Contour extérieur de l'union des cercles agrandis de w : on le parcourt d'un cercle à l'autre, angle croissant,
   en passant au suivant là où l'arc entre dans un autre cercle (intersection exacte). Points tous les step m,
   en boucle (le dernier rejoint le premier). Départ : le point le plus à l'ouest (un point du bord). */
function zoneContour(w, step = 8, C0 = ZONE.circles) {
  const C = C0.map((c) => ({ x: c.x, z: c.z, R: c.r + w }));
  const live = C.filter((c, i) => !C.some((o, j) => j !== i && Math.hypot(c.x - o.x, c.z - o.z) + c.R <= o.R + 1e-6));
  if (!live.length) return [];
  const norm = (a) => ((a % TAU) + TAU) % TAU;
  let i = 0;
  for (let k = 1; k < live.length; k++) if (live[k].x - live[k].R < live[i].x - live[i].R) i = k;
  const out = [], i0 = i;
  let a = Math.PI, first = true;
  for (let guard = 0; guard < 4 * live.length + 4; guard++) {
    const c = live[i];
    // prochaine entrée dans un autre cercle, angle croissant
    let best = Infinity, bj = -1;
    for (let j = 0; j < live.length; j++) {
      if (j === i) continue;
      const o = live[j], d = Math.hypot(o.x - c.x, o.z - c.z);
      if (d >= c.R + o.R || d <= Math.abs(c.R - o.R)) continue;
      const base = Math.atan2(o.z - c.z, o.x - c.x), half = Math.acos(clamp((c.R * c.R + d * d - o.R * o.R) / (2 * c.R * d), -1, 1));
      const da = norm(base - half - a);
      if (da > 1e-6 && da < best) { best = da; bj = j; }
    }
    const span = bj < 0 ? TAU : best;
    // fin : de retour sur le cercle de départ, on s'arrête à l'angle de départ
    const stopHere = !first && i === i0;
    const until = stopHere ? Math.min(span, norm(Math.PI - a) || TAU) : span;
    const n = Math.max(1, Math.ceil((until * c.R) / step));
    for (let k = 0; k < n; k++) { const t = a + (until * k) / n; out.push([c.x + Math.cos(t) * c.R, c.z + Math.sin(t) * c.R]); }
    if (stopHere || bj < 0) break;
    const e = a + best, px = c.x + Math.cos(e) * c.R, pz = c.z + Math.sin(e) * c.R;
    i = bj; a = Math.atan2(pz - live[i].z, px - live[i].x); first = false;
  }
  return out;
}
/* Rideau : un ruban d'un seul tenant sur ce contour (cercles agrandis de ZONE.wall), du sol à ZONE.wallH, dans
   le matériau du mur de sable (bruit le long du ruban, fondu en haut). */
function zoneCurtain() {
  const P = zoneContour(ZONE.wall), pos = [], uv = [], arc = [], idx = [];
  let s = 0;
  for (let k = 0; k <= P.length; k++) {
    const [x, z] = P[k % P.length], g = owH(x, z), base = pos.length / 3;
    if (k > 0) s += Math.hypot(x - pos[(base - 2) * 3], z - pos[(base - 2) * 3 + 2]);
    pos.push(x, g - 15, z, x, g + ZONE.wallH, z);
    uv.push(0.5, 0, 0.5, 1);
    arc.push(s, s);
    if (k > 0) idx.push(base - 2, base, base - 1, base, base + 1, base - 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aArc', new THREE.Float32BufferAttribute(arc, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const src = OW.sandWall.material, mat = src.clone();
  mat.uniforms = THREE.UniformsUtils.clone(src.uniforms);
  mat.uniforms.uAlpha = { value: 1 };
  mat.vertexShader = src.vertexShader.replace('varying vec2 vUv;', 'attribute float aArc; varying float vArc; varying vec2 vUv;').replace('vUv = uv;', 'vUv = uv; vArc = aArc;');
  mat.fragmentShader = src.fragmentShader
    .replace('uniform float uTime, uFogD;', 'uniform float uTime, uFogD, uAlpha; varying float vArc;')
    .replace('vec2(vW.z / 60.0', 'vec2(vArc / 60.0')
    .replace('gl_FragColor = vec4(col, a);', 'gl_FragColor = vec4(col, a * uAlpha);');
  const m = new THREE.Mesh(geo, mat);
  m.name = 'rideau de la zone';
  m.renderOrder = 3; m.frustumCulled = false;
  return m;
}

/* ---- Chaque image (owUpdate, après khStormUpdate) : exposition, dégâts, rideau */
function zoneUpdate(dt) {
  const Z = ZONE;
  if (Z.curtain) {
    const u = Z.curtain.material.uniforms, a = clamp(1.6 - KHS.lv, 0, 1) * Z.wallA;
    Z.curtain.visible = a > 0.01;
    u.uAlpha.value = a; u.uTime.value = OW.t;
    u.uHaze.value.copy(scene.fog.color).convertSRGBToLinear(); u.uFogD.value = scene.fog.density;
  }
  if (!zoneOn()) { Z.out = false; Z.expo = 0; return; }
  const p = player, d = zoneDist(p.pos.x, p.pos.z), out = d > 0;
  if (out && !Z.out && G.state === 'playing') HUD.hint('Tempête mortelle : faites demi-tour, le sable tue', 3);
  Z.d = d; Z.out = out;
  if (G.state !== 'playing' || p.down || Z.killed) return;
  if (out) Z.expo += dt * (1 + d / Z.rise);
  else { Z.expo = Math.max(0, Z.expo - dt * Z.fall); Z.tick = 0; return; }
  if (Z.expo >= Z.lethal) { zoneKill(); return; }
  Z.tick += dt;
  while (Z.tick >= Z.hurt.every && !Z.killed) {
    Z.tick -= Z.hurt.every;
    zoneHurt(Z.hurt.every * (Z.hurt.base + Z.hurt.k * Math.pow(Z.expo, Z.hurt.pow) + Z.hurt.depth * d));
  }
}
/* Dégâts de la tempête : directs (ni caisse de véhicule, ni digi pass), sans secousse de la vue. */
function zoneHurt(a) {
  const p = player;
  if (G.god) return;                                   // outil d'essai seulement (__zs.god)
  p.hp -= a;
  p.lastHit = G.time;                                  // pas de régénération dans la tempête
  HUD.hurt();
  ZONE.sndT -= ZONE.hurt.every;
  if (ZONE.sndT <= 0) { ZONE.sndT = 1.5; Sound.playerHurt(); }
  if (p.hp <= 0) zoneKill();
}
/* Mort dans la tempête : pas de second souffle (Quick Revive), fin de la partie. */
function zoneKill() {
  const p = player;
  if (G.god || p.down || G.state !== 'playing' || ZONE.killed) return;
  ZONE.killed = true;
  if (VEH.drive) vehExit(true);
  p.hp = 0;
  G.stats.downs++;
  Life.add('downs');
  gameOver();
  $('go-title').textContent = 'Emporté par le Khamsin';
}

/* ---- Fond de la mini-carte : le bord de la zone (trait rouge), sur le plan en relief */
function zoneMapOutline(c, C = zoneOn() ? ZONE.circles : []) {
  if (!c || !C.length) return;
  // même échelle que khPlanDraw : le plan de 4 × 3 km au plus grand dans le canevas, centré
  const g = c.getContext('2d'), k = Math.min(c.width / 4000, c.height / 3000), ox = (c.width - 4000 * k) / 2, oz = (c.height - 3000 * k) / 2;
  const P = zoneContour(0, 6, C);
  g.save();
  g.strokeStyle = 'rgba(176,44,26,0.95)'; g.lineWidth = 3;
  g.beginPath();
  P.forEach(([x, z], i) => (i ? g.lineTo(ox + x * k, oz + z * k) : g.moveTo(ox + x * k, oz + z * k)));
  g.closePath(); g.stroke();
  g.restore();
}
