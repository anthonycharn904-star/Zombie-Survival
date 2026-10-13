/* ------------------------------------------------------------ Tempêtes --
   Planche « Le cycle du Khamsin » (page 3) : toutes les 4 manches, la tempête traverse la carte du
   sud-ouest au nord-est, le long du couloir. Alerte 60 s (vent de sable, sirène, compte à rebours,
   mini-carte brouillée au-delà de 200 m, pistes ensablées), Tempête 90 s (mini-carte coupée,
   véhicules à 50 km/h, phares, Rôdeurs), Khamsin 40 s (dehors : abrasion continue ; véhicules à
   30 km/h ; le Gardien traverse), puis 20 s de retour au calme. Visibilité de la planche (page 8) :
   brouillard exponentiel au carré, densité √3 ÷ visibilité, interpolée en échelle logarithmique ;
   distance d'affichage réduite d'autant (la poussière paie la carte). Le faisceau et les yeux
   ignorent le brouillard. Hors du couloir, on voit le mur de poussière et on sent le vent. */
const KHS_LV = [
  // visibilité (m), densité, affichage max (m), couleur du brouillard (planche)
  { vis: 3000, dens: 0.00058, far: 4300, col: 0xe6ad74 },
  { vis: 800, dens: 0.0022, far: 1000, col: 0xd79a5e },
  { vis: 150, dens: 0.0115, far: 220, col: 0xa65b2d },
  { vis: 30, dens: 0.058, far: 60, col: 0x4c1f10 },
];
const KHS_PHASES = [['alert', 60, 'Vent de sable'], ['tempete', 90, 'Tempête'], ['khamsin', 40, 'Khamsin'], ['settle', 20, 'Le vent tombe']];
const KHS = { on: false, i: -1, t: 0, front: -3000, lv: 0, abr: 0, every: 4, walls: null, streaks: null, snd: null, calmT: 0, hurtT: 0 };
const _khc = new THREE.Color(), _khc2 = new THREE.Color();
/* Axe du couloir (vers le nord-est) : position d'un point le long du couloir. */
const khAlong = (x, z) => KH.corridor.ax * x + KH.corridor.az * z;

/* Manche : une tempête au début des manches 4, 8, 12… (pas pendant le calme qui suit le Gardien). */
function khOnRound(n) {
  if (OW.worldId === 'lune') { luOnRound(n); return; }  // Lune : pas de tempête ; le dépôt saute à la manche 1
  if (!OW.on || n < KHS.every || n % KHS.every !== 0 || KHS.on || KHS.calmT > 0) return;
  khStormStart();
}
function khStormStart() {
  KHS.n = (KHS.n || 0) + 1;
  KHS.on = true; KHS.i = 0; KHS.t = 0; KHS.front = -2400;
  HUD.banner('Alerte Khamsin', 'Rejoignez un refuge ou un véhicule fermé · 60 s', 'warn');
  khSiren();
}
function khStormReset() {
  KHS.on = false; KHS.i = -1; KHS.t = 0; KHS.lv = 0; KHS.abr = 0; KHS.calmT = 0;
  OW.stormVmax = 0; OW.stormDark = 0; OW.mapMode = 'full';
  if (KHS.snd) KHS.snd.g.gain.value = 0;
}
/* Niveau de la tempête de la phase en cours (0 calme … 3 Khamsin) et du front. */
function khPhaseLevel() {
  if (!KHS.on) return 0;
  const [id, dur] = KHS_PHASES[KHS.i], k = clamp(KHS.t / dur, 0, 1);
  if (id === 'alert') return lerp(0.4, 1, smooth(k));
  if (id === 'tempete') return lerp(1, 2, smooth(clamp(k * 1.6, 0, 1)));
  if (id === 'khamsin') return lerp(2, 3, smooth(clamp(k * 3, 0, 1)));
  return lerp(2.2, 0, smooth(k));
}
/* Niveau ressenti en (x, z) : dans le couloir, derrière le front ; dehors, un vent de sable au plus. */
function khStormLevelAt(x, z) {
  if (!KHS.on) return 0;
  const L = khPhaseLevel(), inC = khCorridor(x, z);
  const behind = owSmoothstep(KHS.front + 60, KHS.front - 380, khAlong(x, z));
  return Math.max(L * inC * behind, Math.min(L, 1) * 0.55 * behind);
}

/* Chaque image (owUpdate) : phases, front, effets sur le joueur. */
function khStormUpdate(dt) {
  if (KHS.calmT > 0) KHS.calmT -= dt;
  if (KHS.on) {
    KHS.t += dt;
    const [id, dur] = KHS_PHASES[KHS.i];
    // le front avance du sud-ouest au nord-est pendant l'alerte et la tempête (≈ 34 m/s)
    if (id === 'alert' || id === 'tempete') KHS.front += dt * 5600 / 150;
    if (KHS.t >= dur) {
      KHS.i++; KHS.t = 0;
      if (KHS.i >= KHS_PHASES.length) { khStormReset(); HUD.banner('Le Khamsin est passé', 'Le calme revient', 'power'); }
      else {
        const nid = KHS_PHASES[KHS.i][0];
        if (nid === 'tempete') { HUD.banner('Tempête', 'Visibilité 150 m · mini-carte coupée', 'warn'); KHS.front = Math.max(KHS.front, 0); }
        if (nid === 'khamsin') { HUD.banner('Khamsin', 'Dehors, le sable écorche : abritez-vous', 'warn'); KHS.front = 9999; }
      }
    }
  }
  const p = player, lv = p.layer || (KHPY.pz && KHPY.pz.w > 0.3) ? 0 : khStormLevelAt(p.pos.x, p.pos.z);      // sous terre, dans une pyramide : à l'abri
  KHS.lv = damp(KHS.lv, lv, 2.5, dt);
  const phase = KHS.on ? KHS_PHASES[KHS.i][0] : 'calm';
  // mini-carte, véhicules, phares
  OW.mapMode = KHS.lv > 1.4 ? 'off' : KHS.lv > 0.6 ? 'scramble' : 'full';
  OW.stormVmax = KHS.lv > 2.4 ? 30 : KHS.lv > 1.4 ? 50 : 0;
  OW.stormTrack = KHS.lv > 0.6 ? 0.85 : 1;
  OW.stormDark = clamp((KHS.lv - 1) / 2, 0, 1);
  // abrasion au cœur du Khamsin, hors des refuges (un véhicule fermé divise par deux)
  if (KHS.lv > 2.4 && G.state === 'playing' && !player.down) {
    const k = khShelterFactor();
    if (k > 0) {
      KHS.abr += 3.2 * k * dt;
      if (KHS.abr >= 6) { KHS.abr -= 6; playerDamage(6); }
    }
  } else KHS.abr = 0;
  khWindSound(dt);
  khStreaks(dt);
  khWalls(dt);
  owStormHud(phase);
}
/* Part de l'abrasion reçue : 0 dans un refuge (pièce couverte), ½ dans un véhicule fermé, 1 dehors. */
function khShelterFactor() {
  const V = VEH.drive;
  if (V) return V.type === 'buggy' ? 1 : V.T.protect <= 0.25 ? 0.25 : 0.5;
  const cx = Math.floor(player.pos.x), cz = Math.floor(player.pos.z), ch = owChunk(player.layer ? OW.under : OW.surf, cx, cz);
  if (player.layer) return 0;
  if (ch) { const i = owIdx(cx, cz); if ((ch.kind[i] === OWK.FLOOR || ch.kind[i] === OWK.RAMP) && ch.ceil[i] > 0) return 0; }
  return 1;
}
/* Brouillard, ciel, lumière, distance d'affichage selon le niveau ressenti (appelé par owApplyGrade). */
function khStormGrade(g, u, fogCol) {
  const lv = KHS.lv;
  if (lv <= 0.001) { scene.fog.density = KHS_LV[0].dens; u.uHazeK.value = 0.5; khFar(KHS_LV[0].far); return; }
  const i = Math.min(2, Math.floor(lv)), f = lv - i, A = KHS_LV[i], B = KHS_LV[i + 1];
  // densité et affichage : interpolation logarithmique (sinon la visibilité s'effondre dès le début)
  scene.fog.density = Math.exp(lerp(Math.log(A.dens), Math.log(B.dens), f));
  khFar(Math.exp(lerp(Math.log(A.far), Math.log(B.far), f)));
  _khc.setHex(A.col).lerp(_khc2.setHex(B.col), f).convertSRGBToLinear();
  const w = clamp(lv / 1.2, 0, 1);
  fogCol.lerp(_khc, w);
  // le ciel prend la couleur du brouillard ; la lumière baisse et rougit
  u.uHazeK.value = lerp(0.5, 1, clamp(lv - 0.6, 0, 1));
  u.uSunK.value *= clamp(1.4 - lv * 0.6, 0, 1);
  OW.sunLight.intensity *= clamp(1 - lv * 0.28, 0.12, 1);
  OW.sunLight.color.lerp(_khc, w * 0.5);
  if (HEMI) { HEMI.color.lerp(_khc, w * 0.6); HEMI.groundColor.lerp(_khc, w * 0.6); HEMI.intensity *= clamp(1 - lv * 0.18, 0.35, 1); }
}
function khFar(far) {
  const f = Math.max(60, far);
  if (Math.abs(camera.far - f) > 1) { camera.far = f; camera.updateProjectionMatrix(); }
  // au-delà de la distance d'affichage : le fond prend la couleur du brouillard
  if (f < 3900) { if (!scene.background || !scene.background.isColor) scene.background = new THREE.Color(); scene.background.copy(scene.fog.color); }
}

/* ---- Sable qui file (traits dans le vent), autour de la caméra */
function khStreaks(dt) {
  const S = KHS.streaks || (KHS.streaks = khMakeStreaks());
  const lv = KHS.lv;
  S.mesh.visible = lv > 0.15;
  if (!S.mesh.visible) return;
  const ax = KH.corridor.ax, az = KH.corridor.az, sp = 8 + lv * 14, len = 0.4 + lv * 0.7;
  const c = camera.position, P = S.pos, R = 22;
  for (let i = 0; i < S.n; i++) {
    const k = i * 6;
    let x = S.p[i * 3] + ax * sp * dt * S.v[i], y = S.p[i * 3 + 1] + Math.sin(OW.t * 3 + i) * 0.4 * dt, z = S.p[i * 3 + 2] + az * sp * dt * S.v[i];
    // recyclage autour de la caméra
    if (x - c.x > R) x -= 2 * R; else if (x - c.x < -R) x += 2 * R;
    if (z - c.z > R) z -= 2 * R; else if (z - c.z < -R) z += 2 * R;
    if (y - c.y > 8) y -= 14; else if (y - c.y < -6) y += 14;
    S.p[i * 3] = x; S.p[i * 3 + 1] = y; S.p[i * 3 + 2] = z;
    P[k] = x; P[k + 1] = y; P[k + 2] = z;
    P[k + 3] = x - ax * len * S.v[i]; P[k + 4] = y; P[k + 5] = z - az * len * S.v[i];
  }
  S.geo.attributes.position.needsUpdate = true;
  S.mat.opacity = clamp(lv / 2, 0, 0.75);
  S.mat.color.copy(scene.fog.color).lerp(_khc2.setRGB(1, 0.92, 0.8), 0.35);
}
function khMakeStreaks() {
  const n = 900, p = new Float32Array(n * 3), v = new Float32Array(n), pos = new Float32Array(n * 6);
  const c = camera.position;
  for (let i = 0; i < n; i++) { p[i * 3] = c.x + rand(-22, 22); p[i * 3 + 1] = c.y + rand(-5, 7); p[i * 3 + 2] = c.z + rand(-22, 22); v[i] = rand(0.6, 1.4); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xd8b080, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 7;
  scene.add(mesh);
  return { n, p, v, pos, geo, mat, mesh };
}

/* ---- Murs de poussière : les deux bords du couloir et le front (vus du dehors) */
function khWalls(dt) {
  const W = KHS.walls || (KHS.walls = khMakeWalls());
  const L = khPhaseLevel(), vis = KHS.on ? clamp(L / 1.2, 0, 1) * clamp(1.6 - KHS.lv, 0, 1) : 0;
  for (const m of W.meshes) { m.visible = vis > 0.01; m.material.uniforms.uTime.value = OW.t; m.material.uniforms.uAlpha.value = vis; m.material.uniforms.uHaze.value.copy(scene.fog.color).convertSRGBToLinear(); m.material.uniforms.uFogD.value = scene.fog.density; }
  // le front : perpendiculaire au couloir, à sa position
  const C = KH.corridor, mid = (C.s0 + C.s1) / 2;
  W.front.position.set(C.ax * KHS.front + C.nx * mid, 220, C.az * KHS.front + C.nz * mid);
  W.front.visible = W.front.visible && KHS.on && KHS.front > -2300 && KHS.front < 3400;
}
function khMakeWalls() {
  const C = KH.corridor, meshes = [];
  const mk = (len, x, z, rotY) => {
    const mat = OW.sandWall.material.clone();
    mat.uniforms = THREE.UniformsUtils.clone(OW.sandWall.material.uniforms);
    mat.uniforms.uAlpha = { value: 0 };
    mat.fragmentShader = mat.fragmentShader.replace('uniform float uTime, uFogD;', 'uniform float uTime, uFogD, uAlpha;').replace('gl_FragColor = vec4(col, a);', 'gl_FragColor = vec4(col, a * uAlpha);');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 460, 48, 6), mat);
    m.position.set(x, 220, z); m.rotation.y = rotY; m.renderOrder = 3; m.visible = false;
    scene.add(m); meshes.push(m);
    return m;
  };
  // bords : le long de l'axe (direction ax, az), décalés de s0 et s1 selon la normale
  const rot = Math.atan2(-C.az, C.ax);
  for (const s of [C.s0, C.s1]) mk(7000, C.nx * s + C.ax * 600, C.nz * s + C.az * 600, rot);
  const front = mk(C.s1 - C.s0 + 300, 0, 0, rot + Math.PI / 2);
  return { meshes, front };
}

/* ---- Vent (bruit filtré qui souffle par rafales) et sirène */
function khWindSound(dt) {
  const b = Sound.bus();
  if (!b) return;
  if (!KHS.snd) {
    const ctx = b.ctx, src = ctx.createBufferSource(), len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 6 + (Math.random() * 2 - 1) * 0.25; }
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(b.sortie); src.start();
    KHS.snd = { ctx, f, g };
  }
  const S = KHS.snd, t = S.ctx.currentTime, lv = KHS.lv, gust = 0.75 + 0.25 * Math.sin(OW.t * 0.7) * Math.sin(OW.t * 1.9 + 1);
  S.g.gain.setTargetAtTime(G.state === 'playing' || G.state === 'menu' ? (0.02 + lv * 0.11) * gust : 0, t, 0.3);
  S.f.frequency.setTargetAtTime(380 + lv * 260 * gust, t, 0.3);
}
function khSiren() {
  const b = Sound.bus();
  if (!b) return;
  const ctx = b.ctx, t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 1600;
  for (let i = 0; i < 3; i++) { o.frequency.setValueAtTime(330, t0 + i * 2.4); o.frequency.linearRampToValueAtTime(820, t0 + i * 2.4 + 1.4); o.frequency.linearRampToValueAtTime(330, t0 + i * 2.4 + 2.4); }
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.4); g.gain.setValueAtTime(0.12, t0 + 6.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 7.2);
  o.connect(f); f.connect(g); g.connect(b.sortie);
  o.start(t0); o.stop(t0 + 7.3);
}

/* ---- Bandeau de la tempête (sous la boussole) : phase et compte à rebours */
function owStormHud(phase) {
  if (!OWH.storm) return;
  const on = KHS.on;
  OWH.storm.hidden = !on;
  if (!on) return;
  const [, dur, name] = KHS_PHASES[KHS.i], left = Math.max(0, Math.ceil(dur - KHS.t));
  const txt = `${name} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  if (OWH.stormTxt !== txt) { OWH.storm.textContent = txt; OWH.stormTxt = txt; }
  OWH.storm.className = `ow-storm ${phase}`;
}
