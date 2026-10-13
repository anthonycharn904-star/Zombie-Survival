/* ---------------------------------------------------------------- Tunnel --
   « Nécropole des falaises : tombeaux dans la roche, tunnels vers le plateau (raccourci à pied) »
   (pages 2 et 4). La galerie de fouilles relie le grand tombeau de la nécropole (F) au sanctuaire
   sous la Grande Pyramide (B) : 1,7 km de voie Decauville, parcourus en draisine à moteur.
   Le trajet est un passage (comme l'escalier du kiosque) : fondu, quelques secondes dans le tunnel
   (vue depuis la draisine, lampes qui défilent), fondu, arrivée. */
const KHT = { group: null, ride: null, len: 260, x0: 1200, y: -60, z: 2420, cart: null };
function owBuildTunnel(root) {
  const K = owKit('tunnel'), { x0, y, z, len } = KHT, x1 = x0 + len, R = 2.3;
  // voûte de roche (vue de l'intérieur), sol de gravier, voie, traverses, cadres de bois, lampes
  const tube = new THREE.CylinderGeometry(R, R, len, 16, 1, true);
  tube.rotateZ(Math.PI / 2);
  const rock = levelMaterial('kh_rock').clone();
  rock.side = THREE.BackSide;
  const vault = new THREE.Mesh(tube, rock);
  vault.position.set((x0 + x1) / 2, y + 1.2, z);
  const uv = tube.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * len / 3);
  K.add(vault);
  K.box('kh_rock', 0x9a8670, x0, y - 0.2, z - 1.9, x1, y, z + 1.9, { skip: ['bottom', 'px', 'nx', 'pz', 'nz'] });
  K.add(khVoid(x0, y + 1.2, z, 4.8, 4.8, Math.PI / 2)); K.add(khVoid(x1, y + 1.2, z, 4.8, 4.8, -Math.PI / 2));     // les deux bouts : le noir
  for (let x = x0; x < x1; x += 0.65) K.box('kh_planks', 0x5a4028, x, y, z - 0.55, x + 0.14, y + 0.08, z + 0.55);
  for (const s of [-0.3, 0.3]) K.box('kh_sheet', 0x6a645c, x0, y + 0.08, z + s - 0.03, x1, y + 0.16, z + s + 0.03);
  for (let x = x0 + 2; x < x1; x += 6) {
    K.box('kh_planks', 0x6b4a30, x - 0.12, y, z - 1.85, x + 0.12, y + 2.6, z - 1.6).box('kh_planks', 0x6b4a30, x - 0.12, y, z + 1.6, x + 0.12, y + 2.6, z + 1.85);
    K.box('kh_planks', 0x6b4a30, x - 0.12, y + 2.5, z - 1.85, x + 0.12, y + 2.8, z + 1.85);
  }
  KHT.lamps = [];
  for (let x = x0 + 5; x < x1; x += 18) {
    const L = owLamp(K, x, y + 2.35, z - 1.4, 0xffc070, false, 0.7);
    L.layer = 2; L.range = 14;
    KHT.lamps.push(L);
  }
  // la draisine : plateau de planches, levier de pompe, moteur, phare
  const cart = new THREE.Group();
  const add = (geo, hex, px, py, pz, o = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.7, metalness: 0.2 }, o))); m.position.set(px, py, pz); cart.add(m); return m; };
  add(new THREE.BoxGeometry(2.2, 0.12, 1.3), 0x7a5a3a, 0, 0.5, 0);
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.55, 0.55]) add(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), 0x2a2622, sx, 0.24, sz, { metalness: 0.6 }).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.6, 0.45, 0.7), 0x4a5a48, -0.6, 0.8, 0, { metalness: 0.5 });
  add(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), 0x3a3631, 0.3, 1.0, 0);
  add(new THREE.BoxGeometry(0.06, 0.06, 1.1), 0x3a3631, 0.3, 1.5, 0);
  add(new THREE.CylinderGeometry(0.08, 0.07, 0.12, 12), 0xfff0d0, -1.08, 0.66, 0, { emissive: 0xffe0a0, emissiveIntensity: 1.2 }).rotation.z = Math.PI / 2;
  cart.visible = false;
  K.add(cart);
  KHT.cart = cart;
  const g = K.build(root);
  g.visible = false;
  KHT.group = g;
  // les deux quais : le fond du grand tombeau (F) et la galerie du sanctuaire (B)
  const T = KH.places.F.tombs[2], cx = (T.x0 + T.x1) / 2;
  // jeu 2.0.3 : le quai suit le grand tombeau (place, lacet)
  const qF = owPt(T.node, cx + 2.6, T.y, T.z0 + 1.5), qP = owPt(T.node, cx + 2.6, T.y, T.z0 + 1.9);
  KHT.endF = { x: qF.x, y: qF.y, z: qF.z, layer: 0, yaw: Math.PI + owYaw(T.node) };
  KHT.endB = { x: KHSAN.railHead.x + 1.5, y: KHSY, z: KHSAN.railHead.z, layer: 1, yaw: -Math.PI / 2 };
  khTunnelMouthF(T);
  Features.interactables.push({
    kind: 'portal', x: qP.x, z: qP.z, y: qP.y, r: 1.6,
    prompt() { return { text: 'Appuyez sur F pour prendre la draisine', sub: 'Galerie de fouilles · vers le sanctuaire (1,7 km)' }; },
    use() { khRide(KHT.endB, 1, 'Sanctuaire'); },
  });
  Features.interactables.push({
    kind: 'portal', x: KHSAN.railHead.x, z: KHSAN.railHead.z, y: KHSY, r: 1.8,
    prompt() { return { text: 'Appuyez sur F pour prendre la draisine', sub: 'Galerie de fouilles · vers la nécropole (1,7 km)' }; },
    use() { khRide(KHT.endF, -1, 'Nécropole des falaises'); },
  });
}
/* Fond du grand tombeau : une porte basse dans la roche, étayée, d'où sortent les rails. */
function khTunnelMouthF(T) {
  const K = owKit('tunnel-f'), cx = (T.x0 + T.x1) / 2 + 2.6, y = T.y, z = T.z0 + 1;
  K.box('kh_planks', 0x6b4a30, cx - 1.2, y, z, cx - 1.0, y + 2.4, z + 0.25).box('kh_planks', 0x6b4a30, cx + 1.0, y, z, cx + 1.2, y + 2.4, z + 0.25);
  K.box('kh_planks', 0x6b4a30, cx - 1.25, y + 2.3, z, cx + 1.25, y + 2.55, z + 0.25);
  const v = khVoid(cx - 1.0, y + 1.15, z + 0.02, 2.0, 2.3, 0);
  v.rotation.y = 0; K.add(v);
  for (let i = 0; i < 6; i++) K.box('kh_planks', 0x5a4028, cx - 0.55, y, z + 0.3 + i * 0.6, cx + 0.55, y + 0.06, z + 0.44 + i * 0.6);
  for (const s of [-0.3, 0.3]) K.box('kh_sheet', 0x6a645c, cx + s - 0.03, y + 0.06, z + 0.25, cx + s + 0.03, y + 0.13, z + 3.6);
  owFollow(T.node, K.build(OW.placesRoot || World.root));     // jeu 2.0.3 : elle suit le grand tombeau
}
/* Le trajet : fondu, vue depuis la draisine dans le tunnel, fondu, arrivée. dir : sens du défilement. */
function khRide(to, dir, name) {
  if (KHP.busy > 0 || KHT.ride) return;
  KHP.busy = 99;
  khFade(true);
  schedule(0.4, () => {
    for (const z of Zombies.list.slice()) { if (z.boss) continue; if (z.rodeur) removeZombie(z); else if (z.alive) recycleZombie(z); }
    KHT.ride = { t: 0, to, dir, name, dur: 7.5 };
    khSetView('tunnel');
    KHT.group.visible = true; KHT.cart.visible = true;
    Arms.root.visible = false;
    HUD.el.hud.hidden = true;
    khRideSound(true);
    khFade(false, 0.5);
  });
}
/* Caméra pendant le trajet (appelé après la mise à jour du joueur). */
function khRideCam(dt) {
  const Rd = KHT.ride;
  if (!Rd) return;
  Rd.t += dt;
  const k = Rd.t / Rd.dur, { x0, y, z, len } = KHT;
  const s = 6 + (len - 12) * k, x = Rd.dir > 0 ? x0 + s : x0 + len - s;
  KHT.cart.position.set(x, y + 0.05, z);
  KHT.cart.rotation.y = Rd.dir > 0 ? Math.PI : 0;
  camera.position.set(x - Rd.dir * 0.95, y + 1.95 + Math.sin(Rd.t * 17) * 0.012, z + 0.1);
  camera.rotation.set(-0.04 + Math.sin(Rd.t * 1.3) * 0.02, Rd.dir > 0 ? -Math.PI / 2 : Math.PI / 2, Math.sin(Rd.t * 9) * 0.006, 'YXZ');
  Arms.root.visible = false;
  if (Rd.t > Rd.dur - 0.45 && !Rd.faded) { Rd.faded = true; khFade(true, 0.4); }
  if (Rd.t >= Rd.dur && !Rd.done) {
    Rd.done = true;
    const to = Rd.to;
    schedule(0.05, () => {
      KHT.group.visible = false; KHT.cart.visible = false;
      placePlayer(to.x, to.z, to.layer ? -1 : 0);
      player.yaw = to.yaw; player.vel.set(0, 0, 0);
      khSetView(to.layer ? 'under' : 'surface');
      HUD.el.hud.hidden = false;
      Arms.root.visible = true;
      KHT.ride = null; KHP.busy = 1;
      khRideSound(false);
      HUD.zone(Rd.name);
      khFade(false, 0.5);
    });
  }
}
/* Ce que l'on voit : la surface, le sanctuaire ou le tunnel (les autres groupes sont cachés). */
function khSetView(v) {
  KHSAN.view = v;
  if (v === 'tunnel') {
    khSetUnder(true);
    if (KHSAN.group) KHSAN.group.visible = false;
  } else {
    if (KHSAN.group) KHSAN.group.visible = true;
    khSetUnder(v === 'under');
  }
}
function khTunnelReset() {
  if (KHT.ride) { KHT.ride = null; if (KHT.group) KHT.group.visible = false; if (KHT.cart) KHT.cart.visible = false; khRideSound(false); }
  KHSAN.view = 'surface';
}
/* Bruit de la draisine : roues sur les rails, moteur. */
function khRideSound(on) {
  const bus = Sound.bus();
  if (!bus) return;
  if (!on) { if (KHT.snd) { const S = KHT.snd; S.out.gain.setTargetAtTime(0, S.ctx.currentTime, 0.2); setTimeout(() => { try { S.o.stop(); S.n.stop(); } catch (e) { /* déjà arrêté */ } }, 800); KHT.snd = null; } return; }
  const ctx = bus.ctx, out = ctx.createGain(); out.gain.value = 0; out.connect(bus.sortie);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const g1 = ctx.createGain(); g1.gain.value = 0.3; o.connect(g1); g1.connect(lp); lp.connect(out);
  // clac-clac des joints de rail : bruit modulé
  const n = ctx.createBufferSource(), len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) { const ph = (i / ctx.sampleRate) % 0.32; d[i] = (Math.random() * 2 - 1) * (ph < 0.03 || (ph > 0.07 && ph < 0.1) ? 1 : 0.15); }
  n.buffer = buf; n.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1200; nf.Q.value = 0.8;
  const ng = ctx.createGain(); ng.gain.value = 0.22; n.connect(nf); nf.connect(ng); ng.connect(out);
  o.start(); n.start();
  out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.3);
  KHT.snd = { ctx, out, o, n };
}
