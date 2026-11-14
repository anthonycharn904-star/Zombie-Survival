
/* ------------------------------------------------------------- La barque --
   Véhicule « barque » du moteur (VEH_TYPES) : modèle et son de barque.js, physique propre (eau
   seulement) branchée en tête de vehStep, de vehPose et de vehCellFree.
     · moteur hors-bord à barre franche : gaz (Z), marche arrière lente (S), Espace : gaz coupés ;
       on gouverne par la poussée (on tourne mal sans gaz), la poupe glisse dans les virages ;
       6,9 m/s en eau libre (25 km/h ; 6 m/s en croisière), moins dans les bancs de roseaux, échouage sous 0,45 m d'eau
     · elle flotte : houle, sillage, tangage en accélérant, gîte dans les virages, coups de la bête
     · coque de 100 points : chocs contre les berges et les pontons, attaques ; à 0 elle chavire
       (on se retrouve à l'eau, on la retourne en nageant : F maintenu)
     · le bruit du moteur s'entend sous l'eau (menace : MAM). */
VEH_TYPES.barque = {
  name: 'Barque à moteur', short: 'la barque', boat: true, len: 4.4, wid: 1.62, hgt: 0.9, wb: 3.2, track: 1.3, wr: 0.3,
  vmax: { road: 25, track: 25, sand: 25 }, acc: 2.4, brake: 3, rev: 1.7, steer: 0.5, fuel: 6000,
  protect: 0.85, noise: 30, kill: 99, seat: [-0.22, 0.22, 1.58], eye: 0.86, cam: [7.8, 2.7], axles: [], exit: null,
};
const MA_BOAT_PAINT = [0x4f6356, 0x5a5f52, 0x51606a, 0x6a5a48, 0x4a5a4a, 0x5f5446, 0x56645c];
/* Jeu 2.0.7 (demande d'Anthony du 14 novembre 2026, « Ok pour éléments et barques ») : les textures des barques (95 %
   du temps de leur création ; 2,8 s pour les onze en qualité haute) sont gardées pour la session et, au premier
   chargement, se calculent par morceaux en partie (Barque.texturesSteps : retouches/modules.py), comme la peau de la
   Mère-Vase (ma09, maFondPas) : les barques à moins de 90 m du départ sont faites tout de suite (on les voit en
   arrivant) ; les autres reçoivent des textures provisoires (une teinte, mêmes réglages : rien à recompiler), remplacées
   une par une quand les leurs sont prêtes. Dans les Mod Tools : comme avant, d'un trait. */
const MA_BARQ = { tex: new Map(), taches: new Map(), pose: [], t0: 0, calc: 0, n: 0, moy: 0, faites: 0 };
function maBarqProvisoire(paint) {
  const tex = (rgb, reglage) => {
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const g = c.getContext('2d'); g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; g.fillRect(0, 0, 4, 4);
    const t = new THREE.CanvasTexture(c); reglage(t); t.encoding = THREE.sRGBEncoding;
    return t;
  };
  const P = [(paint >> 16) & 255, (paint >> 8) & 255, paint & 255];
  return {                                             // mêmes réglages que hullTexture, woodTexture, cowlTexture du module
    hull: tex(P.map((c) => Math.round(c * 0.9)), (t) => { t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; }),
    inner: tex([72, 64, 54], (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }),
    plank: tex([84, 75, 63], (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }),
    cowl: tex([60, 64, 50], () => {}),
  };
}
const MA_BARQ_MAT = { hull: 'hull', inner: 'inner', plank: 'wood', cowl: 'cowl' };     // texture → matière de la barque
function maBarqPose(B, tex) {
  if (!B.materials) return;
  for (const k of ['hull', 'inner', 'plank', 'cowl']) {
    const m = B.materials[MA_BARQ_MAT[k]], old = m && m.map;
    if (!m || old === tex[k]) continue;
    m.map = tex[k]; B.textures[k] = tex[k];
    if (old && !SHARED.has(old)) old.dispose();          // la provisoire
  }
}
/* Des morceaux des textures de la barque la plus proche du joueur (maFondPas, ma09) ; finies : gardées pour la session,
   posées sur ses barques (une par image : maBarqPoseUne). */
function maBarqMorceaux(fin) {
  const vivantes = (T) => T.cibles.filter((c) => VEH.list.includes(c.V));
  let T = null, d = Infinity;
  for (const X of MA_BARQ.taches.values()) {
    const c = vivantes(X)[0];
    const dx = c ? Math.hypot(c.V.x - player.pos.x, c.V.z - player.pos.z) : 1e6;
    if (dx < d) { d = dx; T = X; }
  }
  if (!T) return;
  try {
    if (!T.gen) T.gen = Barque.texturesSteps(THREE, T.o);
    const r = maMorceaux(MA_BARQ, T.gen, fin);
    if (!r) return;
    for (const k in r.value) share(r.value[k]);
    MA_BARQ.tex.set(T.cle, r.value);
    MA_BARQ.taches.delete(T.cle);
    MA_BARQ.faites++;
    for (const c of vivantes(T)) MA_BARQ.pose.push({ B: c.B, tex: r.value });
    if (!MA_BARQ.taches.size) MA_BARQ.fin = true;
  } catch (e) { MA_BARQ.taches.delete(T.cle); maErr('marais : textures d’une barque (elle garde ses textures provisoires)', e); }
}
function maBarqPoseUne() {
  const p = MA_BARQ.pose.shift();
  maBarqPose(p.B, p.tex);
  for (const k of ['hull', 'inner', 'plank', 'cowl']) maEnvoi(p.tex[k]);
  if (MA_BARQ.pose.length || !MA_BARQ.fin) return;
  MA_BARQ.fin = false;
  const s = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  try { console.info(`[chargement] marais : textures des barques prêtes en partie, ${s(performance.now() - MA_BARQ.t0)} après le chargement (${MA_BARQ.faites} barques, ${s(MA_BARQ.calc)} de calcul en ${MA_BARQ.n} morceaux)`); } catch (e) { /* console absente */ }
}
VEH_MODELS.barque = function maBoatModel(V) {
  const q = settings.quality === 'high' ? 'high' : settings.quality === 'low' ? 'low' : 'medium';
  const o = { quality: q, seed: 7 + V.id * 13, paint: MA_BOAT_PAINT[V.id % MA_BOAT_PAINT.length] }, cle = `${q}|${o.seed}|${o.paint}`;
  const parMorceaux = typeof Barque.texturesSteps === 'function' && !(typeof CUR === 'object' && CUR && CUR.editor);
  const faite = MA_BARQ.tex.get(cle), pres = Math.hypot(V.sp.x - MA.spawn.pos[0], V.sp.z - MA.spawn.pos[1]) < 90;
  let B;
  if (faite || !parMorceaux || pres) {
    B = Barque.create(THREE, faite ? { ...o, textures: faite } : o);
    if (!faite) { for (const k in B.textures) share(B.textures[k]); MA_BARQ.tex.set(cle, B.textures); }
  } else {
    B = Barque.create(THREE, { ...o, textures: maBarqProvisoire(o.paint) });
    let T = MA_BARQ.taches.get(cle);
    if (!T) { T = { cle, o, gen: null, cibles: [], fait: null }; MA_BARQ.taches.set(cle, T); if (!MA_BARQ.t0) MA_BARQ.t0 = performance.now(); }
    T.cibles.push({ B, V });
  }
  V.group.add(B.object);
  V.barque = B;
  V.heads = [[0.32, 0.62, -1.6]];
  V.halos = [];
  V.lampHead = new THREE.MeshBasicMaterial(); V.lampTail = new THREE.MeshBasicMaterial();
  maBoatReset(V);
};
function maBoatReset(V) {
  V.hull = 100; V.capsized = false; V.capT = 0; V.rightT = 0; V.thr = 0; V.vs = 0; V.yr = 0; V.motor = false; V.grab = 0;
  V.wrecked = false; V.wreckT = 0;
  V.hv = 0; V.hy = 0; V.rv = 0; V.rr = 0; V.pv = 0; V.pp = 0; V.grT = 0; V.hitT = 0; V.slapT = 1; V.lostT = 0; V.wakeOff = true;
}
/* Eau navigable sous un point de la coque : assez de fond, pas de pieu ni de ponton, dans les limites. */
function maBoatCellFree(x, z) {
  const B = OW.walk;
  if (x < B[0] || x > B[2] || z < B[1] || z > B[3]) return false;
  const k = owKind(OW.surf, Math.floor(x), Math.floor(z));
  if (k !== OWK.TERRAIN && k !== OWK.WATER) return false;
  return maDepth(x, z) > 0.22;
}
/* Pose flottante (hauteur, tangage, roulis : houle, vitesse, virage, coups) ; snap : à l'arrêt. */
function maBoatPose(V, dt, snap) {
  const t = OW.t || 0, sp = V.v || 0;
  const wave = 0.025 * Math.sin(t * 1.25 + V.x * 0.21 + V.id) + 0.015 * Math.sin(t * 2.1 + V.z * 0.33);
  // ressorts : pilonnement (hv), roulis (rv), tangage (pv), excités par la bête et les chocs
  if (!snap && dt > 0) {
    V.hv += (-V.hy * 30 - V.hv * 3.4) * dt; V.hy += V.hv * dt;
    V.rv += (-V.rr * 18 - V.rv * 2.6) * dt; V.rr += V.rv * dt;
    V.pv += (-V.pp * 20 - V.pv * 3.0) * dt; V.pp += V.pv * dt;
  }
  const plane = clamp(sp / 3, 0, 1) - 0.6 * clamp((sp - 3.5) / 3, 0, 1);       // l'avant se lève puis se couche
  const gr = V.grab || 0;                                   // saisie par la bête : soulevée, avant en l'air, secouée
  const y = MA.water - 0.02 + wave + V.hy + (V.capsized ? -0.25 : 0) + 0.85 * gr;
  const pitch = 0.07 * plane * (sp >= 0 ? 1 : -0.5) + 0.02 * Math.sin(t * 1.6 + V.id) + V.pp + 0.5 * gr;
  let roll = -clamp(V.yr * sp * 0.035, -0.18, 0.18) + 0.025 * Math.sin(t * 1.1 + V.id * 2) + V.rr + 0.3 * gr * Math.sin(t * 11);
  if (V.capsized) roll = lerp(V.capRoll || 0, Math.PI * 0.96, smooth(clamp(V.capT / 1.4, 0, 1))) + 0.03 * Math.sin(t * 1.3);
  if (snap) { V.y = y; V.pitch = pitch; V.roll = roll; V.vy = 0; }
  else { V.y = damp(V.y, y, 10, dt); V.pitch = damp(V.pitch, pitch, gr > 0.05 ? 9 : 4, dt); V.roll = damp(V.roll, roll, V.capsized || gr > 0.05 ? 9 : 5, dt); }
  // confort (ma00) : la pose « calme » que suit la vue du barreur quand les secousses ne sont pas réglées
  // (maBoatCamConfort) : houle, virage, avant qui se lève, soulèvement par la bête ; sans les ressorts des chocs
  // (pilonnement, roulis, tangage) ni la secousse de la saisie. La barque elle-même garde toute sa pose.
  const cy = MA.water - 0.02 + wave + 0.85 * gr, cr = -clamp(V.yr * sp * 0.035, -0.18, 0.18) + 0.025 * Math.sin(t * 1.1 + V.id * 2);
  const cp = 0.07 * plane * (sp >= 0 ? 1 : -0.5) + 0.02 * Math.sin(t * 1.6 + V.id) + 0.5 * gr;
  if (snap || V.cy === undefined) { V.cy = cy; V.cp = cp; V.cr = cr; }
  else { V.cy = damp(V.cy, cy, 10, dt); V.cp = damp(V.cp, cp, gr > 0.05 ? 9 : 4, dt); V.cr = damp(V.cr, cr, 5, dt); }
  V.group.position.set(V.x, V.y, V.z);
  _ve.set(V.pitch, V.yaw, V.roll, 'YXZ');
  V.group.quaternion.setFromEuler(_ve);
  // au loin : sans les détails (70 m), puis plus du tout (dans la brume, 300 m)
  const dc = Math.hypot(V.x - camera.position.x, V.z - camera.position.z);
  V.group.visible = !V.wrecked && (dc < 300 || V === VEH.drive);
  if (V.barque && V.barque.setDetail) V.barque.setDetail(dc < 70 || V === VEH.drive);
}
/* Un pas de la barque (conduite ou à la dérive). */
function maBoatStep(V, dt, ctl) {
  const T = V.T, driven = V === VEH.drive;
  if (V.hull === undefined) maBoatReset(V);
  if (V.wrecked) return;                               // détruite (MM 2.1.3) : maWreckUpdate la ramène à son ponton
  if (V.capsized) { maBoatCapsizedStep(V, dt); return; }
  const dep = maDepth(V.x, V.z), [fx, fz] = vehFwd(V.yaw), rx = -fz, rz = fx;
  const reeds = OW.bio && OW.bio[owPointIndex(V.x, V.z)] === OWB.REEDS;
  // moteur : gaz tenus par la poignée (relâchée : ralenti) ; carburant
  let want = driven ? ctl.f : 0;
  if (driven && V.fuel <= 0 && want) { want = 0; if (!V.dryT || G.time - V.dryT > 4) { V.dryT = G.time; HUD.hint('Réservoir vide : faites le plein aux jerricans', 3); } }
  if (driven && !V.motor && V.fuel > 0) { V.motor = true; if (V.bsnd) V.bsnd.start(); }
  if (!driven && V.motor && Math.abs(V.v) < 0.3) V.motor = false;
  V.thr = approach(V.thr, want > 0 ? 1 : want < 0 ? -0.5 : 0, (want ? 1.3 : 2.4) * dt);
  if (ctl.hand) V.thr = approach(V.thr, 0, 5 * dt);
  // eau : profondeur (échouage), roseaux (frein)
  const free = clamp((dep - 0.3) / 0.8, 0, 1), vmax = (T.vmax.road / 3.6) * (0.35 + 0.65 * free) * (reeds ? 0.72 : 1);
  const A = T.acc * (V.thr < 0 ? 0.7 : 1);
  const c = A / (vmax * vmax);
  V.v += (A * V.thr - c * V.v * Math.abs(V.v) - V.v * (0.12 + (1 - free) * 1.6 + (reeds ? 0.25 : 0))) * dt;
  if (!driven) V.v *= Math.exp(-0.9 * dt);
  // direction : la poussée tourne la barque (sans gaz, presque rien) ; la poupe dérape
  const sv = Math.abs(V.v), push = Math.abs(V.thr);
  const target = (driven ? -ctl.s : 0) * (0.08 + 0.42 * clamp(sv / 4, 0, 1) + 0.38 * push) * (V.v < -0.2 ? -0.8 : 1);
  V.yr = damp(V.yr, target, 2.2, dt);
  V.steer = damp(V.steer || 0, driven ? ctl.s : 0, 6, dt);
  V.vs += (-V.yr * V.v * 0.22 - V.vs * 2.8) * dt;
  const nyaw = V.yaw + V.yr * dt;
  const [nfx, nfz] = vehFwd(nyaw), nrx = -nfz, nrz = nfx;
  const nx = V.x + (nfx * V.v + nrx * V.vs) * dt, nz = V.z + (nfz * V.v + nrz * V.vs) * dt;
  const hit = Math.abs(V.v) > 0.01 || Math.abs(V.vs) > 0.01 || Math.abs(V.yr) > 0.001 ? vehBlocked(V, nx, nz, nyaw) : null;
  if (!hit) { V.x = nx; V.z = nz; V.yaw = nyaw; }
  else {
    const spd = Math.hypot(V.v, V.vs);
    if (spd > 1.2 && V.hitT <= 0) {
      V.hitT = 0.5;
      const dmg = spd > 3 ? (spd - 3) * 7 : 0;
      if (dmg > 0) maBoatDamage(V, dmg, 'choc');
      if (V.bsnd) V.bsnd.clunk(clamp(spd / 4, 0.3, 1.5)); else Sound.bodyFall({ x: hit.x, z: hit.z });
      if (driven) maSecousse(spd / 22);
      V.pv += spd * 0.05; V.rv += (Math.random() - 0.5) * spd * 0.1;
    }
    V.v *= -0.22; V.vs *= -0.3;
    if (hit.veh) { hit.veh.v += V.v * 0.3; }
    if (!vehBlocked(V, V.x, V.z, nyaw)) V.yaw = nyaw;
    else V.yr *= 0.3;
  }
  V.hitT -= dt;
  // échouage : on racle le fond
  if (dep < 0.45 && sv > 0.6) {
    V.grT -= dt;
    if (V.grT <= 0) { V.grT = 0.6; if (V.bsnd) V.bsnd.scrape(clamp(sv / 3, 0.3, 1.2)); if (driven && sv > 2) HUD.hint('Haut-fond : la barque racle la vase', 1.5); }
  }
  // clapot sur la coque
  V.slapT -= dt * (0.6 + sv * 0.5);
  if (V.slapT <= 0) { V.slapT = rand(0.6, 1.4); if (V.bsnd) V.bsnd.slap(clamp(0.3 + sv / 6, 0.2, 1.2)); }
  V.fuel = Math.max(0, V.fuel - (Math.abs(V.v) + (V.motor ? 0.3 : 0)) * dt);
  V.rpm = damp(V.rpm || 0, V.motor ? 0.1 + 0.9 * Math.abs(V.thr) : 0, 3, dt);
  maBoatPose(V, dt);
  vehZombies(V, dt);
  maWakeUpdate(V, dt);
  if (V.barque) V.barque.update(dt, { speed: V.v, throttle: V.thr, steer: V.steer || 0, rpm: V.rpm, on: V.motor, lights: driven && (V.lights || owDarkness() > 0.35), damage: 1 - V.hull / 100, sway: V.rr });
  if (driven) maBoatSoundUpdate(V, dt);
}
/* Dégâts de coque (attaques, chocs) ; à 0 : chavire. */
function maBoatDamage(V, amount, why) {
  if (V.capsized || amount <= 0) return;
  V.hull = Math.max(0, V.hull - amount);
  if (V === VEH.drive && V.hull < 35 && V.hull + amount >= 35) HUD.hint('La coque prend l’eau', 2.5);
  maEmit('barque', { what: 'degats', id: V.id, hull: V.hull, why });
  if (V.hull <= 0) maBoatCapsize(V, why);
}
/* Chavirer : la barque se retourne, le pilote tombe à l'eau. */
function maBoatCapsize(V, why) {
  if (V.capsized) return;
  V.capsized = true; V.capT = 0; V.capRoll = V.roll || 0; V.rightT = 0; V.lostT = 0;
  V.v = 0; V.vs = 0; V.yr = 0; V.thr = 0; V.motor = false;
  maSplash(V.x, V.z, 1.6);
  if (V === VEH.drive) {
    const [fx, fz] = vehFwd(V.yaw);
    maBoatSoundStop();
    VEH.drive = null;
    Arms.root.visible = true;
    maSwimStart(V.x - fz * 1.8, V.z + fx * 1.8, 'chavire');
    playerDamage(15);
  }
  maEmit('barque', { what: 'chavire', id: V.id, why });
}
function maBoatCapsizedStep(V, dt) {
  V.capT += dt;
  V.v = 0;
  maBoatPose(V, dt);
  if (V.barque) V.barque.update(dt, { speed: 0, rpm: 0, on: false, lights: false, damage: 1 });
  if (V.capT < 3 && Math.random() < dt * 6) maBubbles(V.x + rand(-1.5, 1.5), V.z + rand(-1.5, 1.5), 2, 0.4);
  // personne à côté pendant 90 s : la barque est ramenée à son ponton (on la retrouve amarrée)
  const d = Math.hypot(player.pos.x - V.x, player.pos.z - V.z);
  V.lostT = d > 25 ? V.lostT + dt : 0;
  if (V.lostT > 90) { maBoatReturn(V); }
}
function maBoatReturn(V) {
  maBoatReset(V);
  V.x = V.sp.x; V.z = V.sp.z; V.yaw = V.sp.yaw; V.v = 0;
  maBoatPose(V, 0, true);
}
/* ------------------------------------------------------- La barque détruite (MM 2.1.3) --
   La ruée de la bête la brise d'un coup : éclats, planches qui flottent puis coulent, gerbe, bulles ; le
   pilote est jeté à l'eau (blessé) et doit nager jusqu'à la rive. La barque n'existe plus là (rangée hors
   de la carte, invisible) ; 60 s plus tard, quand personne n'est à moins de 35 m de son ponton, une
   barque l'y attend de nouveau (sinon, une île sans barque deviendrait une prison). */
const MA_WRECK = { planks: [], geo: null };
function maBoatWreck(V, H) {
  if (V.wrecked) return;
  const driven = V === VEH.drive, wx = V.x, wz = V.z, wyaw = V.yaw;
  maBoatSplinters(V, 34, H);
  maWreckPlanks(V, 10);
  maSplash(wx, wz, 3.2, { up: 1.1 });
  maRipple(wx, wz, 0.08);
  for (let i = 0; i < 7; i++) setTimeout(() => maBubbles(wx + rand(-2.2, 2.2), wz + rand(-2.2, 2.2), 6, 1.4), 250 + i * 380);
  maBeastSay('impact', wx, MA.water + 0.5, wz, { vol: 1.9, ref: 16 });
  maBeastSay('arrache', wx, MA.water + 0.5, wz, { vol: 1.5, ref: 14 });
  if (V.bsnd) V.bsnd.clunk(2);
  V.wrecked = true; V.wreckT = 0; V.capsized = false; V.hull = 0; V.v = 0; V.vs = 0; V.yr = 0; V.thr = 0; V.motor = false; V.grab = 0;
  if (V.wake) V.wake.pts.length = 0;
  V.group.visible = false;
  V.x = V.sp.x + 3000; V.z = V.sp.z;                   // hors de la carte (ni collision, ni petite carte, ni « monter »)
  if (driven) {
    const [fx, fz] = vehFwd(wyaw);
    maBoatSoundStop();
    player.yaw = wyaw + VEH.lookYaw; player.pitch = 0;   // on regarde toujours du même côté, à l'horizon
    VEH.drive = null; VEH.boardCam = null; MA.exitCam = null;
    Arms.root.visible = true;
    player.pos.x = wx - fz * 1.2; player.pos.z = wz + fx * 1.2;
    maSwimStart(player.pos.x, player.pos.z, 'epave');
    playerDamage(MA_CFG.leap.dmg);
    HUD.hint('La barque est détruite ! Nagez jusqu’à la rive la plus proche (Maj : plus vite)', 4.5);
  }
  maEmit('barque', { what: 'detruite', id: V.id });
}
/* Planches de l'épave : projetées, elles retombent, flottent en dérivant, puis coulent (20-30 s). */
function maWreckPlanks(V, n) {
  const mat = V.barque && V.barque.materials ? V.barque.materials.wood : MAT.board;
  if (!MA_WRECK.geo) MA_WRECK.geo = share(new THREE.BoxGeometry(1, 0.05, 0.2));
  const root = World.root || scene;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(MA_WRECK.geo, mat), a = Math.random() * TAU, r = rand(0.2, 2), sp = rand(1, 3.8);
    m.scale.set(rand(0.7, 2.3), 1, rand(0.8, 1.4));
    m.name = 'épave';
    root.add(m);
    MA_WRECK.planks.push({ m, x: V.x + Math.cos(a) * r, z: V.z + Math.sin(a) * r, y: MA.water + rand(0.4, 1.4), vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rand(1.5, 5),
      yaw: Math.random() * TAU, yr: rand(-3, 3), tilt: rand(-0.6, 0.6), t: 0, life: rand(20, 32), wet: false });
  }
}
/* Chaque image : les planches de l'épave ; les barques détruites qui reviennent à leur ponton. */
function maWreckUpdate(dt) {
  const L = MA_WRECK.planks;
  for (let i = L.length - 1; i >= 0; i--) {
    const P = L[i];
    P.t += dt;
    if (!P.wet) {
      P.vy -= 9.8 * dt; P.y += P.vy * dt;
      if (P.y <= MA.water + 0.03 && P.vy < 0) { P.wet = true; P.y = MA.water + 0.03; maSplash(P.x, P.z, 0.22, { up: 0.5 }); P.vx *= 0.4; P.vz *= 0.4; }
    } else {
      P.vx = damp(P.vx, 0.12, 0.5, dt); P.vz = damp(P.vz, 0.08, 0.5, dt);
      P.tilt = damp(P.tilt, 0.05 * Math.sin(P.t * 1.3 + P.yaw), 2, dt);
      P.y = MA.water + 0.03 - 0.7 * owSmoothstep(P.life - 5, P.life, P.t) + 0.025 * Math.sin(P.t * 1.8 + P.yaw * 3);
      if (maDepth(P.x, P.z) < 0.1) { P.vx = 0; P.vz = 0; }      // échouée sur la berge
    }
    P.x += P.vx * dt; P.z += P.vz * dt; P.yaw += P.yr * dt; P.yr = damp(P.yr, 0, P.wet ? 1.5 : 0.2, dt);
    P.m.position.set(P.x, P.y, P.z); P.m.rotation.set(P.tilt, P.yaw, P.wet ? 0.04 * Math.sin(P.t * 2.1) : P.tilt * 2, 'YXZ');
    if (P.t > P.life) { if (P.m.parent) P.m.parent.remove(P.m); L.splice(i, 1); }
  }
  for (const V of VEH.list) {
    if (!V.T.boat || !V.wrecked) continue;
    V.wreckT += dt;
    const C = MA_CFG.wreck;
    if (V.wreckT > C.back && Math.hypot(player.pos.x - V.sp.x, player.pos.z - V.sp.z) > C.far) {
      maBoatReturn(V);
      V.group.visible = true;
      maEmit('barque', { what: 'revenue', id: V.id });
    }
  }
}
function maWreckClear() {
  for (const P of MA_WRECK.planks) if (P.m.parent) P.m.parent.remove(P.m);
  MA_WRECK.planks.length = 0;
}
/* Remettre à l'endroit en nageant (F maintenu 3 s) : la coque est rafistolée à 40. */
function maBoatRight(V, dt) {
  V.rightT += dt;
  if (Math.random() < dt * 5) maSplash(V.x + rand(-1, 1), V.z + rand(-1, 1), 0.3);
  if (V.rightT >= 3) {
    V.capsized = false; V.capT = 0; V.rightT = 0; V.hull = Math.max(V.hull, 40);
    V.roll = 0; V.rr = 0; V.rv = 1.2;
    maSplash(V.x, V.z, 1.2);
    HUD.hint('La barque est à l’endroit (coque fragile)', 2.5);
    maEmit('barque', { what: 'redressee', id: V.id });
  }
}

/* ---- Son : moteur deux temps de barque.js, sur le bus des effets ; un seul (la barque conduite). */
function maBoatSoundStart(V) {
  maBoatSoundStop();
  const b = Sound.bus();
  if (!b || typeof Barque === 'undefined') return;
  try { V.bsnd = Barque.createAudio(b.ctx, b.sortie, { volume: 0.9 }); MA.boatSnd = V; } catch (e) { V.bsnd = null; }
}
function maBoatSoundUpdate(V, dt) {
  if (!V.bsnd) return;
  V.bsnd.update({ rpm: V.rpm, load: Math.abs(V.thr), speed: Math.abs(V.v), on: V.motor });
}
function maBoatSoundStop() {
  const V = MA.boatSnd;
  if (V && V.bsnd) { try { V.bsnd.dispose(); } catch (e) { /* rien */ } V.bsnd = null; }
  MA.boatSnd = null;
}
/* Descendre : sur le ponton ou la rive, des deux côtés, à l'avant, à l'arrière (2 à 4 m). */
function maBoatExitSpots(V) {
  const T = V.T, s = [];
  for (const d of [1.0, 1.6, 2.3, 3.0]) for (const f of [T.seat[2] * -1, 0, 1.2, -1.6, 2]) { s.push([f, -(T.wid / 2 + d)]); s.push([f, T.wid / 2 + d]); }
  for (const d of [0.8, 1.6, 2.6]) { s.push([T.len / 2 + d, 0]); s.push([-(T.len / 2 + d), 0]); }
  return s;
}

/* ---------------------------------------------------------------- La nage --
   Dans l'eau profonde (après un chavirage) : lent (1,5 m/s, 2,1 m/s en forçant), sans arme ;
   les yeux au ras de l'eau. On sort sur la berge (eau de moins de 0,8 m), sur un ponton bas, ou
   en montant dans une barque (F). La bête entend les nageurs (menace : MAM). */
const MA_SWIM = { on: false, t: 0, vx: 0, vz: 0, bob: 0, why: '', stroke: 0 };
function maSwimStart(x, z, why) {
  const S = MA_SWIM;
  S.on = true; S.t = 0; S.vx = 0; S.vz = 0; S.why = why || '';
  player.pos.x = x; player.pos.z = z; player.gy = MA.water - 1.1; player.pos.y = player.gy; player.y = 0; player.vy = 0; player.grounded = true;
  player.vel.set(0, 0, 0); player.sprinting = false; player.ads = 0; player.crouch = 0;
  player.k = owLocate(x, z, player.gy);
  Arms.root.visible = false;
  if (Couteau) Couteau.annuler();
  Sound.setMuffle(2600);
  maSplash(x, z, 1.4);
  HUD.hint(S.why === 'plonge' ? 'Vous nagez : lentement, sans arme, et ce qui vit dessous vous entend (Maj : plus vite · F : monter dans une barque)' : 'À l’eau ! Nagez vers la rive ou une barque (Z Q S D · Maj : plus vite · F : monter)', 4);
  maEmit('nage', { what: 'debut', why: S.why });
}
function maSwimEnd(force) {
  const S = MA_SWIM;
  if (!S.on) return;
  S.on = false;
  if (OW.on && OW.worldId === 'marais') { Arms.root.visible = !VEH.drive; Sound.setMuffle(false); }
  if (!force) maEmit('nage', { what: 'fin' });
}
const maSwimming = () => MA_SWIM.on;
/* Pas de nage (à la place du déplacement à pied, dans updatePlayer). */
function maSwimStep(dt) {
  const p = player, S = MA_SWIM;
  S.t += dt;
  if (p.down) { /* à terre dans l'eau : on coule (la bête vient) ; on reste à la surface pour la relève */ }
  const f = (key('KeyW') ? 1 : 0) - (key('KeyS') ? 1 : 0), s = (key('KeyD') ? 1 : 0) - (key('KeyA') ? 1 : 0);
  const busy = p.down || p.grabT > 0 || KHP.busy > 0;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let wx = busy ? 0 : fx * f + rx * s, wz = busy ? 0 : fz * f + rz * s;
  const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
  const fast = key('ShiftLeft') || key('ShiftRight');
  const sp = fast ? 2.1 : 1.5;
  S.vx = damp(S.vx, wx * sp, 2.2, dt); S.vz = damp(S.vz, wz * sp, 2.2, dt);
  const nx = p.pos.x + S.vx * dt, nz = p.pos.z + S.vz * dt;
  // sortir : berge (pied), ponton bas, sinon rester dans l'eau (pas à travers les pieux)
  const cx = Math.floor(nx), cz = Math.floor(nz), kind = owKind(OW.surf, cx, cz);
  const dep = maDepth(nx, nz);
  if (kind === OWK.TERRAIN || kind === OWK.WATER) {
    if (dep < 0.8 && owWalkCell(0, cx, cz)) { p.pos.x = nx; p.pos.z = nz; maSwimEnd(); placePlayer(nx, nz); p.vel.set(S.vx, 0, S.vz); HUD.hint('Pied !', 1); return; }
    const B = OW.walk;
    if (nx > B[0] && nx < B[2] && nz > B[1] && nz < B[3] && !VEH.list.some((O) => O.T.boat && !O.capsized && vehInside(O, nx, nz, 0.25))) { p.pos.x = nx; p.pos.z = nz; }
    else { S.vx *= -0.3; S.vz *= -0.3; }
  } else if (kind === OWK.FLOOR) {
    const g = owGroundAt(0, nx, nz);
    if (g - MA.water < 1.0 && !busy) { maSwimEnd(); placePlayer(nx, nz); HUD.hint('Vous vous hissez sur les planches', 1.2); return; }
    S.vx *= -0.2; S.vz *= -0.2;
  } else { S.vx *= -0.2; S.vz *= -0.2; }
  p.gy = MA.water - 1.1; p.pos.y = p.gy; p.y = 0;
  p.k = owLocate(p.pos.x, p.pos.z, p.gy);
  p.vel.set(S.vx, 0, S.vz);
  // brasses : ronds, éclaboussures, souffle
  const moving = Math.hypot(S.vx, S.vz);
  S.stroke -= dt * (moving > 0.3 ? (fast ? 1.6 : 1.1) : 0.25);
  if (S.stroke <= 0) {
    S.stroke = 1;
    maRipple(p.pos.x, p.pos.z, moving > 0.3 ? 0.03 : 0.012);
    if (moving > 0.3) maSplash(p.pos.x + fx * 0.6, p.pos.z + fz * 0.6, 0.25, { up: 0.6 });
  }
  // caméra : les yeux au ras de l'eau, la tête qui monte et descend avec les brasses
  S.bob += dt * (moving > 0.3 ? (fast ? 5 : 3.6) : 1.6);
  camera.rotation.order = 'YXZ';
  const eye = MA.water + 0.22 + Math.sin(S.bob) * (moving > 0.3 ? 0.07 : 0.04);
  camera.position.set(p.pos.x, eye, p.pos.z);
  // confort (ma00) : le balancement de la tête (tangage, roulis) seulement s'il est réglé ; l'horizon reste droit
  const bal = maBalance();
  camera.rotation.y = p.yaw; camera.rotation.x = p.pitch + Math.sin(S.bob * 0.5) * 0.02 * bal; camera.rotation.z = Math.sin(S.bob * 0.5 + 1) * 0.03 * bal;
  const sh = FX.shake * FX.shake * maBalance();             // confort (ma00) : aucune secousse à la nage, sauf si réglée
  if (sh > 0.0001) { camera.rotation.x += rand(-1, 1) * sh * 0.03; camera.rotation.y += rand(-1, 1) * sh * 0.03; }
  Sound.setListener(p.pos.x, p.pos.z, p.yaw, p.gy);
  // monter dans une barque, retourner une barque chavirée : les invites du véhicule (updateInteract)
}
/* Joueur et eau, chaque image : pas dans l'eau (ronds, éclaboussures), nage. */
function maPlayerWater(dt) {
  const p = player;
  if (MA_SWIM.on || VEH.drive || G.state !== 'playing') return;
  const d = maDepth(p.pos.x, p.pos.z), sp = Math.hypot(p.vel.x, p.vel.z);
  // de l'eau à mi-cuisse, on avance encore vers le large : on se met à nager (lentement, sans arme)
  if (d > 0.62 && !p.down && !(p.grabT > 0) && !(KHP.busy > 0)) {
    const f = (key('KeyW') ? 1 : 0) - (key('KeyS') ? 1 : 0), s = (key('KeyD') ? 1 : 0) - (key('KeyA') ? 1 : 0);
    let into = false, ax = 0, az = 0;
    if (f || s) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      let wx = fx * f + rx * s, wz = fz * f + rz * s; const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
      ax = p.pos.x + wx * 0.9; az = p.pos.z + wz * 0.9;
      const k = owKind(OW.surf, Math.floor(ax), Math.floor(az));
      // devant : de l'eau où l'on n'a plus pied (la marche s'y arrête)
      into = (k === OWK.TERRAIN || k === OWK.WATER) && maDepth(ax, az) > 0.78 && !owWalkCell(0, Math.floor(ax), Math.floor(az));
      if (into) for (let e = 1.2; e < 3.2 && maDepth(ax, az) < MA.wade + 0.05; e += 0.4) { ax = p.pos.x + wx * e; az = p.pos.z + wz * e; }
    }
    MA.deepT = into ? (MA.deepT || 0) + dt : 0;
    if (MA.deepT > 0.3) { MA.deepT = 0; maSwimStart(ax, az, 'plonge'); return; }
  }
  // sur les planches (au-dessus de l'eau ou non), ni ronds ni éclaboussures (MM 2.1.2)
  const floor = maOnFloor(p.pos.x, p.pos.z);
  if (!floor && d > 0.08 && sp > 0.5) {
    MA.stepT = (MA.stepT || 0) - dt * sp;
    if (MA.stepT <= 0) {
      MA.stepT = 1.4;
      maRipple(p.pos.x, p.pos.z, clamp(d * 0.04, 0.01, 0.035));
      if (Math.random() < 0.6) maSplash(p.pos.x, p.pos.z, 0.18 + d * 0.2, { up: 0.5 });
      maSoundWade(p.pos, d);
    }
  } else if (!floor && sp > 0.5 && p.grounded) {
    // dans la vase (MM 2.1.2) : le pied s'enfonce et ressort, un bruit de succion, des mottes ; la première
    // fois, un mot pour dire que les passerelles sont le chemin
    const k = MA_SOIL_K[owBioAt(p.pos.x, p.pos.z)];
    if (k !== undefined && k < 0.7) {
      MA.stepT = (MA.stepT || 0) - dt * sp;
      if (MA.stepT <= 0) {
        MA.stepT = 1.3;
        maSoundMud(p.pos);
        const P = maMudPool(), fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        for (let i = 0; i < 4; i++) P.emit(p.pos.x + fx * 0.5 + rand(-0.15, 0.15), p.gy + 0.04, p.pos.z + fz * 0.5 + rand(-0.15, 0.15), rand(-0.4, 0.4), rand(0.6, 1.4), rand(-0.4, 0.4), rand(0.25, 0.5));
      }
      MA.mudT = (MA.mudT || 0) + dt;
      if (!MA.mudHint && MA.mudT > 1.2) { MA.mudHint = true; HUD.hint('La vase ralentit : les passerelles et les pontons sont le chemin', 4); }
    }
  }
}
/* Le joueur est-il sur l'eau (barque, nage) ? */
function maPlayerOnWater() {
  if (MA_SWIM.on) return true;
  const V = VEH.drive;
  return !!(V && V.T.boat);
}
/* Monter : vue embarquée (on tire), moteur prêt (il démarre aux premiers gaz). */
function maBoatEnter(V) {
  if (MA_SWIM.on) maSwimEnd();
  VEH.view = 1; VEH.lookYaw = 0; VEH.lookPitch = -0.05; VEH.lookT = 0; VEH.camInit = false;
  Arms.root.visible = true;
  V.thr = 0;
  maBoatSoundStart(V);
  if (V.bsnd && V.fuel > 0) { V.motor = true; V.bsnd.start(); }
  VEH.boardCam = { p: camera.position.clone(), q: camera.quaternion.clone(), t: 0 };   // on enjambe le plat-bord
  HUD.hint('Z gaz · S arrière · Q/D barre · Espace couper les gaz · C vue · L projecteur · F descendre au ponton · en vue embarquée, on tire', 6);
  maEmit('barque', { what: 'monte', id: V.id });
}
/* Tomber de la barque au large (à terre dans la barque, éjecté) : à l'eau, à côté. */
function maBoatBail(V) {
  const [fx, fz] = vehFwd(V.yaw);
  VEH.drive = null;
  Arms.root.visible = true;
  vehSoundStop(); maBoatSoundStop();
  player.yaw = V.yaw + VEH.lookYaw; player.pitch = 0;
  maSwimStart(V.x - fz * 1.7, V.z + fx * 1.7, 'tombe');
}

/* ------------------------------------------------------- Le barreur (corps d'Anthony) --
   Vue à la troisième personne (et, plus tard, les autres joueurs en coop) : assis sur le banc de
   poupe, la main droite sur la poignée de la barre franche (elle suit le moteur qui pivote), la
   gauche sur la cuisse, les pieds au fond ; la tête suit le regard. La montée et la descente (0,55 s)
   sont celles du moteur (persoAnimer). En vue embarquée, le corps n'est pas dessiné (on tient l'arme). */
const _mbsV = new THREE.Vector3(), _mbsQ = new THREE.Quaternion(), _mbsY = new THREE.Vector3(0, 1, 0);
function persoAssisBarque(av, E, dt) {
  const V = E.siege.V, Bq = V.barque, hero = av.hero, o = hero.object, B = hero.bones, s = PERSO.taille;
  persoArme(av, E, null);
  if (av.down) { hero.revive(); av.down = false; }
  hero.update(dt, { speed: 0, crouch: false, armed: false, aim: false, onGround: true, lookPitch: E.look.pitch, turn: 0 });
  V.group.updateMatrixWorld(true);
  const gq = V.group.getWorldQuaternion(new THREE.Quaternion());
  const bq = gq.clone().multiply(_mbsQ.setFromAxisAngle(_mbsY, Math.PI));          // le corps regarde vers l'avant (−z de la barque)
  const at = (x, y, z) => V.group.localToWorld(new THREE.Vector3(x, y, z));
  const dir = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(bq);
  const S = Bq.seat, sol = Bq.floorY, hip = S.y + 0.1;
  o.position.copy(at(S.x, sol, S.z));
  o.quaternion.copy(bq);
  o.updateMatrixWorld(true);
  B.hips.position.set(0, (hip - sol) / s - PERSO.thighOff, 0);
  B.hips.quaternion.setFromEuler(new THREE.Euler(-0.12, 0, 0));
  o.updateMatrixWorld(true);
  // jambes : pieds à plat au fond, devant le banc (gauche du corps : −x de la barque)
  for (const [Sd, sx] of [['L', 1], ['R', -1]]) persoLegIK(av, Sd, at(S.x - sx * 0.14, sol + PERSO.ankle * s, S.z - 0.58), dir(0.25 * sx, 1, 0.6), bq);
  // main droite : la poignée de la barre (axe de la barre, paume dessus)
  const grip = Bq.anchors.helm.getWorldPosition(new THREE.Vector3());
  const base = Bq.tiller.getWorldPosition(new THREE.Vector3());
  const Y = grip.clone().sub(base).normalize(), Z0 = new THREE.Vector3(0, -1, 0);
  const Z = Z0.addScaledVector(Y, -Z0.dot(Y)).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  const qR = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  persoPlaceHand(av, 'R', grip, qR, dir(-0.7, -1, -0.4));
  if (B.fingR) B.fingR.quaternion.setFromEuler(new THREE.Euler(0, 0, 1.15));
  if (B.fing2R) B.fing2R.quaternion.setFromEuler(new THREE.Euler(0, 0, 1.25));
  // main gauche : posée sur la cuisse
  persoPlaceHand(av, 'L', at(S.x - 0.12, hip + 0.09, S.z - 0.3), bq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.3, 0, 0))), dir(0.8, -1, -0.3));
  // tête : elle suit le regard
  const ly = clamp(E.look.yaw, -1.3, 1.3);
  B.neck.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(_mbsY, ly * 0.4));
  B.head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(_mbsY, ly * 0.6));
  o.updateMatrixWorld(true);
}
/* Confort (ma00) : la vue du barreur suit la pose calme de la barque (V.cy, V.cp, V.cr : maBoatPose) au lieu de sa
   pose entière, quand les secousses ne sont pas réglées. Appelée par vehCamera (retouche « vehCamera montée barque »),
   juste après le calcul du moteur et avant la montée en douceur, avec les mêmes conventions (siège, yeux, roulis × 0,6). */
const _mbcE = new THREE.Euler(), _mbcQ = new THREE.Quaternion();
function maBoatCamConfort(V) {
  if (maSecoue() || V.cy === undefined) return;
  const T = V.T;
  _mbcE.set(V.cp, V.yaw, V.cr, 'YXZ'); _mbcQ.setFromEuler(_mbcE);
  camera.position.set(T.seat[0], T.seat[1] + T.eye, T.seat[2]).applyQuaternion(_mbcQ);
  camera.position.x += V.x; camera.position.y += V.cy; camera.position.z += V.z;
  _mbcE.set(V.cp + VEH.lookPitch, V.yaw + VEH.lookYaw, V.cr * 0.6, 'YXZ');
  camera.quaternion.setFromEuler(_mbcE);
  camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');
}
/* Monter, descendre : la caméra passe des yeux du joueur debout à ceux du barreur (et inversement)
   en 0,6 s, avec une petite courbe (on enjambe le plat-bord). */
function maBoatBoardCam(dt) {
  const C = VEH.boardCam;
  if (!C) return;
  C.t += dt;
  const k = smooth(clamp(C.t / 0.6, 0, 1));
  _mbsV.copy(camera.position);
  camera.position.lerpVectors(C.p, _mbsV, k); camera.position.y += Math.sin(Math.PI * k) * 0.18;
  camera.quaternion.slerpQuaternions(C.q, camera.quaternion.clone(), k);
  camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');
  if (k >= 1) VEH.boardCam = null;
}
function maBoatExitCam(dt) {
  const C = MA.exitCam;
  if (!C || VEH.drive) { MA.exitCam = null; return; }
  C.t += dt;
  const k = smooth(clamp(C.t / 0.5, 0, 1));
  _mbsV.copy(camera.position);
  camera.position.lerpVectors(C.p, _mbsV, k); camera.position.y += Math.sin(Math.PI * k) * 0.15;
  if (k >= 1) MA.exitCam = null;
}
