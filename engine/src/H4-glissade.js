/* ===================================================================== 19 GLISSADE ==
   Glissade (Slide), annulation de glissade (Slide Cancel) et sprint tactique (jeu 2.0.6, demande d'Anthony du
   19 octobre 2026). Son paquet (engine/orig/mouvement/ : mouvement-cod.js, le contrôleur réglé sur Black Ops 6 ;
   mouvement-effets.js, poussière et sons ; et le nouveau survivant.js) est inséré tel quel par build.py ; ce module
   le branche sur le jeu sans le retoucher (son INTEGRATION.md : réglages par les options du contrôleur).
   Choix d'Anthony (19 octobre) :
   · glissade, annulation et sprint tactique, avec les vitesses du jeu : marche, sprint, accroupi, visée, mobilité
     de l'arme, atout Endurance et endurance du sprint ne changent pas ; Maj et C restent maintenus ;
   · caméra : la descente des yeux seule, avec un ressort doux (ni roulis, ni champ de vision, ni vibration) ;
   · son corps : le nouveau survivant.js (glissade, sprint, sprint tactique) ;
   · pas sur la Lune : sa physique garde ses glissades de pente (GRAV.moon : déplacements d'avant).
   Partage du travail :
   · le contrôleur décide de l'état (debout, accroupi, sprint, sprint tactique, glissade, en l'air), du saut et de
     la vitesse pendant la glissade (durée 0,65 s, pointe 1,55 × la marche, frottement, pente) ; hors glissade, la
     vitesse reste celle du jeu (updatePlayer), sprint tactique compris (× GLISSADE.tac) ;
   · le jeu garde ses collisions (settleBody, zombies) ; le contrôleur apprend chaque obstacle (applyCollision) :
     une glissade longe un mur, ou s'arrête si elle le prend de face ;
   · la pente vient du sol réellement parcouru (le contrôleur glisse plus loin en descente) ;
   · caméra : seulement la descente des yeux (glOeil) ; arme de la vue FPS : penchée en glissade, levée en sprint
     tactique, main gauche libre qui balance (glVue, glMainGauche) ; corps : glCorps, lu par la section 16 ;
   · poussière (sable à Khamsin, béton ailleurs) et frottement de la glissade, sur le bus des effets du jeu.
   Pendant une glissade (règles) : tir permis après 0,33 s (délai du contrôleur), visée, rechargement, couteau,
   grenade, changement d'arme et achats permis ; boisson d'atout : pas de sprint, donc pas de glissade (comme le
   sprint du jeu) ; à terre, agrippé par un Rôdeur, dans un escalier de Khamsin : la glissade s'arrête. Le sprint
   tactique retombe en sprint au tir, au rechargement, au couteau, à la grenade, à la boisson et au changement
   d'arme ; le coup part quand l'arme est redescendue.
   Coop (préparée) : le corps lit un état (persoEtatLocal().mv) ; un autre joueur enverra le même.
   ============================================================================ */
const GLISSADE = {
  on: true,                                   // false : déplacements d'avant (glissade et sprint tactique retirés)
  tac: 8.2 / 6.65,                            // sprint tactique : × la vitesse de sprint du jeu (rapport de Black Ops 6)
  vmax: 9.5,                                  // m/s : plafond de la vitesse en glissade (longue descente)
  oeil: 0.64,                                 // m : yeux en glissade, ceux de son corps dans la pose de glissade (0,63 m
                                              // mesurés ; le paquet : 0,82 m pour 1,80 m, soit 0,80 m pour lui)
  replie: 0.3,                                // vue FPS : au-delà de ce poids de glissade, son buste (penché en arrière,
                                              // sous les yeux) est replié pour la caméra ; restent le bassin et les jambes
  tirApres: 0.33,                             // s : tir permis après le début d'une glissade (slideToFire du contrôleur)
  tacTir: 0.35,                               // le coup part quand la pose du sprint tactique est retombée sous ce poids
  volume: 0.55,                               // sons de la glissade (bus des effets du jeu)
  poussiere: 0.7,                             // quantité de poussière (1 : celle du paquet)
  // options du contrôleur (MouvementCoD.DEFAULTS) ; les vitesses sont celles du jeu, recopiées à chaque image
  options: {
    preset: 'bo6', sprintMode: 'hold', crouchMode: 'hold', tacSprint: true, verticalPhysics: false,
    accel: 14, decel: 14, sprintAccel: 14, backwardScale: 1, strafeScale: 1,      // réactivité du jeu (damp 14)
    bobScale: 0, shakeScale: 0, fovSprint: 0, fovTac: 0, fovSlide: 0, slideRoll: 0,   // vertige : aucun effet de caméra
  },
  // arme de la vue FPS (repère de la caméra : x droite, y haut, −z avant ; rotations x, y, z en radians), ajoutées à
  // la pose de la vue : glissade et main gauche, valeurs du paquet (compose de mouvement-cod.js) ; sprint tactique,
  // réglé sur les images (celle du paquet, p [0,055, 0,03, 0,06] r [1,05, 0,22, 0,35], tournait l'arme autour de sa
  // poignée et la mettait devant la moitié droite de l'écran) ; le sprint garde la pose du jeu
  vue: {
    tac: { p: [0.08, -0.05, -0.02], r: [0.85, 0.5, 0.6], pas: [0.024, 0.018, 0.05, 0.08] },
    glisse: { p: [-0.012, -0.024, 0.012], r: [0.04, 0.06, -0.26], baisse: [0.022, -0.1, -0.12] },
    main: { p: [-0.21, -0.34, -0.42], pas: [0.02, 0.07, 0.1] },      // main gauche libre (sprint tactique)
  },
};
const GL = {
  move: null, out: null, actif: false, prev: 'stand', jump: false, res: null,
  air: { sprint: false, tac: false }, pente: 0, n: [0, 1, 0],
  oeil: { x: 0, v: 0, w: 13 }, vm: null, libre: 0, clic: 0,
  dust: null, audio: null, audioCtx: null, surface: '', neufs: false,
  mesure: null,                               // essais : dernière glissade (durée, distance, vitesses)
};

/* Le contrôleur (créé au premier usage). */
function glMove() {
  if (!GL.move) {
    const o = Object.assign({}, GLISSADE.options, { eyeStand: PLAYER_EYE, eyeCrouch: PLAYER_EYE - 0.55, eyeSlide: GLISSADE.oeil });
    GL.move = MouvementCoD.create(o);
    GL.vm = [0, 0, 0, 0, 0, 0].map(() => ({ x: 0, v: 0 }));
  }
  return GL.move;
}
function glActif() {
  return !!(GLISSADE.on && typeof MouvementCoD === 'object' && !GRAV.moon && !player.down);
}
/* Remise à zéro : nouvelle partie, à terre, au volant, sur la Lune. */
function glReset() {
  if (GL.audio && GL.out && GL.out.slide.active) GL.audio.update(0, { events: [{ type: 'slideEnd', cancelled: true }], slide: { active: false, speed: 0 } });
  if (GL.move && GL.out && (GL.out.state !== 'stand' || GL.out.stance !== 'stand' || GL.out.speed > 0.01)) GL.move.reset();
  GL.out = null; GL.res = null; GL.actif = false; GL.prev = 'stand'; GL.jump = false;
  GL.air.sprint = GL.air.tac = false; GL.pente = 0; GL.n = [0, 1, 0];
  GL.oeil.x = GL.oeil.v = 0; GL.oeil.w = 13; GL.libre = 0; GL.clic = 0;
  if (GL.vm) for (const s of GL.vm) s.x = s.v = 0;
}
/* ressort amorti (celui du contrôleur), par pas de 1/240 s */
function glRessort(s, cible, w, z, dt) {
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (let i = 0; i < n; i++) { s.v += (w * w * (cible - s.x) - 2 * z * w * s.v) * h; s.x += s.v * h; }
}

/* Chaque image, dans updatePlayer (après le regard, avant la vitesse) : f, s : avant et côté demandés (déjà nuls
   si le joueur est agrippé, à terre ou dans un escalier de Khamsin). Rend null (déplacements d'avant) ou
   { sprinting, tac, crouch, slide, vx, vz, jump }. */
function glStep(dt, f, s, mobility, endurance, wantSprint) {
  const p = player;
  if (!glActif()) { if (GL.actif || GL.out) glReset(); return null; }
  const M = glMove(), c = M.config;
  // vitesses du jeu (mobilité de l'arme, atout Endurance) : la glissade part de 1,55 × la marche
  const walk = 4.6 * mobility * (endurance ? 1.07 : 1);
  c.walkSpeed = walk; c.sprintSpeed = walk * 1.46; c.tacSprintSpeed = walk * 1.46 * GLISSADE.tac;
  c.crouchSpeed = walk * 0.55; c.aimSpeed = walk * 0.58; c.slidePeakSpeed = c.slideSpeedScale * walk;
  const prev = GL.out ? GL.out.state : 'stand', stance = GL.out ? GL.out.stance : 'stand';
  // Maj : les conditions du sprint du jeu (endurance du sprint, boisson) ; l'avant et la visée, le contrôleur
  const was = prev === 'sprint' || prev === 'tacSprint';
  const okSprint = (endurance || p.stamina > (was ? 0.02 : 0.15)) && Arms.state !== 'drink';
  const tenu = !!wantSprint && okSprint;
  const appui = (pressed('ShiftLeft') || pressed('ShiftRight')) && okSprint;
  // agrippé, escalier : la glissade s'arrête (toute sa vitesse retirée)
  if (prev === 'slide' && (p.grabT > 0 || (OW.on && KHP.busy > 0)) && GL.out.speed > 0.01) M.applyCollision(-GL.out.velocity[0], -GL.out.velocity[2]);
  // sprint tactique : le tir, un rechargement, un geste le ramènent au sprint (une image « en visée »)
  const tacStop = prev === 'tacSprint' && (Input.lmb || Arms.state !== 'idle');
  const out = M.update(dt, {
    moveX: s, moveY: f, lookYaw: p.yaw, lookPitch: p.pitch,
    sprintHeld: tenu, sprintPressed: appui, crouchHeld: key('KeyC'), crouchPressed: pressed('KeyC'),
    jumpPressed: pressed('Space') && p.grounded && !p.luSlide && (prev === 'slide' || stance === 'crouch' || p.crouch < 0.5),
    aim: p.ads > 0.3 || tacStop,
    onGround: p.grounded, canStand: true, groundNormal: GL.n,
  });
  GL.out = out; GL.actif = true; GL.prev = prev; GL.neufs = true;   // événements de cette image (effets)
  GL.jump = false;
  for (const e of out.events) {
    if (e.type === 'jump') { GL.jump = true; GL.air.sprint = prev === 'sprint' || prev === 'tacSprint' || prev === 'slide'; GL.air.tac = prev === 'tacSprint'; }
    else if (e.type === 'slideStart') GL.mesure = { t0: G.time, x0: p.pos.x, z0: p.pos.z, entree: e.speed, vmax: e.speed, fin: null };
    else if (e.type === 'slideEnd' && GL.mesure && !GL.mesure.fin) GL.mesure.fin = Object.assign({ t: G.time, dist: Math.hypot(p.pos.x - GL.mesure.x0, p.pos.z - GL.mesure.z0) }, e);
  }
  const st = out.state, air = st === 'air';
  if (!air) GL.air.sprint = GL.air.tac = false;
  const slide = st === 'slide';
  let vx = out.velocity[0], vz = out.velocity[2];
  const v = Math.hypot(vx, vz);
  if (v > GLISSADE.vmax) { vx *= GLISSADE.vmax / v; vz *= GLISSADE.vmax / v; }
  if (slide && GL.mesure && !GL.mesure.fin) GL.mesure.vmax = Math.max(GL.mesure.vmax, Math.min(v, GLISSADE.vmax));
  // yeux : ils descendent en glissade (ressort du contrôleur : 24 à l'entrée, 18 à l'annulation, 10 à la fin)
  if (slide && prev !== 'slide') GL.oeil.w = 24;
  else if (!slide && prev === 'slide') GL.oeil.w = out.events.some((e) => e.type === 'slideCancel') ? 18 : 10;
  return (GL.res = {
    sprinting: st === 'sprint' || st === 'tacSprint' || (air && GL.air.sprint && tenu && f > 0),
    tac: st === 'tacSprint' || (air && GL.air.tac && tenu && f > 0) ? GLISSADE.tac : 1,
    crouch: out.stance === 'crouch' || slide ? 1 : 0,
    slide, vx, vz, jump: GL.jump,
  });
}
/* Après les collisions du jeu (settleBody, zombies) : l'écart entre la position voulue et la position obtenue
   donne l'obstacle (le contrôleur retire la vitesse vers lui) ; le sol parcouru donne la pente. */
function glCollide(dt, x0, z0, gy0) {
  if (!GL.actif || !GL.out || dt <= 0) return;
  const p = player, ix = x0 + p.vel.x * dt, iz = z0 + p.vel.z * dt;
  const cx = p.pos.x - ix, cz = p.pos.z - iz;
  if (cx * cx + cz * cz > 1e-8) GL.move.applyCollision(cx, cz);
  const dx = p.pos.x - x0, dz = p.pos.z - z0, d = Math.hypot(dx, dz);
  if (d > 0.01 && p.grounded && Number.isFinite(gy0) && Number.isFinite(p.gy)) {
    const sl = clamp((p.gy - gy0) / d, -0.7, 0.7);
    GL.pente = damp(GL.pente, sl, 10, dt);
    const ux = dx / d, uz = dz / d, n = Math.hypot(GL.pente, 1);
    GL.n = [-GL.pente * ux / n, 1 / n, -GL.pente * uz / n];
  } else if (!p.grounded) GL.n = [0, 1, 0];
}
/* Yeux : descente sous ceux de l'accroupi pendant la glissade (le jeu descend déjà de l'accroupi). */
function glOeil(dt) {
  if (!GL.actif || !GL.out) return 0;
  const cible = GL.out.state === 'slide' ? Math.max(0, PLAYER_EYE - 0.55 - GLISSADE.oeil) : 0;
  glRessort(GL.oeil, cible, GL.oeil.w, 1, dt);
  if (GL.out.state !== 'slide' && GL.oeil.w !== 13 && Math.abs(GL.oeil.x) < 0.02 && Math.abs(GL.oeil.v) < 0.2) GL.oeil.w = 13;
  return GL.oeil.x;
}
const glSliding = () => !!(GL.actif && GL.out && GL.out.state === 'slide');
const glTacW = () => (GL.actif && GL.out ? GL.out.body.tac : 0);
/* Tir : bloqué au début d'une glissade, et tant que l'arme est levée du sprint tactique. */
function glCanFire() {
  if (!GL.actif || !GL.out) return true;
  const o = GL.out;
  if (o.slide.active && o.slide.t < GLISSADE.tirApres) return false;
  return o.body.tac <= GLISSADE.tacTir;
}
function glTir(s) {
  if (!glCanFire()) { if (Input.lmbDown) GL.clic = G.time; return; }
  const att = !Input.lmbDown && GL.clic > 0 && G.time - GL.clic < 0.45;
  GL.clic = 0;
  if (!att) { tryFire(s); return; }
  Input.lmbDown = true; tryFire(s); Input.lmbDown = false;   // clic fait pendant le délai : le coup part maintenant
}

/* ------------------------------------------------------------- arme de la vue FPS */
const _glVm = [0, 0, 0, 0, 0, 0];
/* Décalage de l'arme (position, rotation) ajouté à la pose de la vue (updateViewmodel) ; le sprint du jeu garde sa
   pose (Arms.sprintK), effacée en sprint tactique. */
function glVue(dt, out6) {
  for (let i = 0; i < 6; i++) out6[i] = 0;
  if (!GL.vm) return out6;
  const o = GL.actif ? GL.out : null, V = GLISSADE.vue;
  const wSl = o ? o.body.slide : 0, wT = o ? o.body.tac * (1 - wSl) : 0;
  const low = o && o.slide.active ? 1 - smooth(clamp(o.slide.t / GLISSADE.tirApres, 0, 1)) : 0;
  const ph = player.bobT, bS = Math.sin(ph), bS2 = Math.abs(Math.sin(ph));
  const amp = o ? clamp(o.speed / Math.max(1, GL.move.config.sprintSpeed), 0, 1.3) : 0;
  const T = V.tac, S = V.glisse, k = 1 - player.ads * 0.9;
  const tgt = [
    T.p[0] * wT + S.p[0] * wSl + T.pas[0] * wT * bS * amp,
    T.p[1] * wT + (S.p[1] - S.baisse[0] * low) * wSl + T.pas[1] * wT * bS2 * amp,
    T.p[2] * wT + S.p[2] * wSl,
    T.r[0] * wT + (S.r[0] + S.baisse[1] * low) * wSl + T.pas[2] * wT * Math.cos(2 * ph) * amp,
    T.r[1] * wT + S.r[1] * wSl,
    T.r[2] * wT + (S.r[2] + S.baisse[2] * low) * wSl + T.pas[3] * wT * bS * amp,
  ];
  for (let i = 0; i < 6; i++) { glRessort(GL.vm[i], tgt[i] * k, 15, 0.85, dt); out6[i] = GL.vm[i].x; }
  // main gauche libre (sprint tactique), au repos sur l'arme pendant un geste, un réarmement ou la visée
  GL.libre = wT * (Arms.state === 'idle' && !Arms.cyc ? 1 : 0) * (1 - player.ads);
  return out6;
}
const _glV = new THREE.Vector3(), _glQ = new THREE.Quaternion(), _glE = new THREE.Euler();
const _glP = new THREE.Vector3(), _glQ2 = new THREE.Quaternion(), _glOff = new THREE.Vector3(-0.25, -0.75, -0.35);
/* Main gauche : de sa prise sur l'arme (ou de sous l'écran, pistolet) vers sa place de course, poing fermé. */
function glMainGauche(lP, lQ, lPose) {
  const f = smooth(clamp(GL.libre, 0, 1));
  if (f < 1e-3) return null;
  const M = GLISSADE.vue.main, ph = player.bobT, bS = Math.sin(ph);
  const amp = GL.out ? clamp(GL.out.speed / Math.max(1, GL.move.config.sprintSpeed), 0, 1.3) : 0;
  _glV.set(M.p[0] - M.pas[0] * bS, M.p[1] + M.pas[1] * bS * amp, M.p[2] - M.pas[2] * bS * amp);
  _glQ.setFromEuler(_glE.set(-0.25 + 0.35 * bS * amp, 0.35, 0.9));
  const p0 = lP ? _glP.copy(lP) : _glP.copy(_glOff), q0 = lQ ? _glQ2.copy(lQ) : _glQ2.copy(_glQ);
  return { p: p0.lerp(_glV, f), q: q0.slerp(_glQ, f), pose: lPose || HAND_POSES.relax, pose2: HAND_POSES.fist, k: f };
}

/* ------------------------------------------------------------- corps (section 16) */
/* Ce que le corps montre du déplacement (coop : la même chose viendra du réseau). Sans le contrôleur (Lune, à
   terre) : le sprint du jeu. facing : l'avant du corps (la trajectoire en glissade, le regard sinon) ; oeil :
   descente des yeux sous ceux de l'accroupi (m). */
function glCorps() {
  const o = GL.actif && GL.out;
  if (!o) return { slide: 0, slideT: 0, sprint: player.sprinting ? 1 : 0, tac: 0, facing: player.yaw, oeil: 0 };
  const b = o.body;
  return { slide: b.slide, slideT: b.slideT, sprint: b.sprint, tac: b.tac, facing: b.facingYaw, oeil: GL.oeil.x };
}

/* Pieds au sol pendant une glissade (section 16, après sa pose) : dans la pose de glissade du modèle, la cheville
   droite est au niveau du sol (talon dessous), et le mélange avec la course fait passer un pied jusqu'à 17 cm sous
   le sol à l'entrée et à la sortie. Un pied qui passe sous le sol est remonté : jambe recalculée de la hanche
   (genou gauche, replié, dans son plan ; genou droit, celui de la jambe tendue du modèle, plié vers le haut), pied
   gardant son orientation. Le fichier du modèle n'est pas touché. */
const _glA = new THREE.Vector3(), _glT = new THREE.Vector3(), _glH = new THREE.Vector3(), _glK = new THREE.Vector3(), _glFQ = new THREE.Quaternion();
function glPieds(av, sol) {
  const Bn = av.hero.bones, s = PERSO.taille;
  av.hero.object.updateMatrixWorld(true);
  for (const S of ['L', 'R']) {
    Bn['foot' + S].getWorldPosition(_glA); Bn['toes' + S].getWorldPosition(_glT);
    const pen = sol + 0.005 - Math.min(_glA.y - PERSO.ankle * s, _glT.y - 0.015);   // semelle ; bout du pied
    if (pen <= 0.002) continue;
    Bn['thigh' + S].getWorldPosition(_glH); Bn['shin' + S].getWorldPosition(_glK);
    Bn['foot' + S].getWorldQuaternion(_glFQ);
    _glA.y += pen;
    const pv = S === 'R' ? _glK.set(0, 1, 0) : _glK.sub(_glH);
    persoLegIK(av, S, _glA, pv, _glFQ);
  }
}

/* ------------------------------------------------------------- poussière et sons */
function glSurface() {
  if (!OW.on) return 'beton';
  const p = player, L = p.layer ? OW.under : OW.surf, cx = Math.floor(p.pos.x), cz = Math.floor(p.pos.z);
  const ch = owChunk(L, cx, cz);
  if (!ch) return p.layer ? 'beton' : 'sable';
  return ch.kind[owIdx(cx, cz)] === OWK.TERRAIN ? 'sable' : 'beton';
}
/* Chaque image (après le corps) : poussière soulevée par la glissade et son annulation ; frottement de la glissade
   et vêtements qui frottent au relevé (les pas et l'atterrissage restent ceux du jeu). */
function glEffets(dt) {
  if (typeof MouvementEffets !== 'object') return;
  const o = GL.actif ? GL.out : null;
  if (!GL.dust) {
    if (!o || !o.slide.active) return;                   // créée à la première glissade
    try {
      GL.dust = MouvementEffets.createDust(THREE, scene, { renderer, surface: 'terre', light: 0.6, intensity: GLISSADE.poussiere, footsteps: false, max: 240 });
    } catch (e) { console.warn('glissade : poussière', e); GL.dust = false; return; }
  }
  if (!GL.dust) return;
  const sf = glSurface();
  if (sf !== GL.surface) { GL.surface = sf; GL.dust.setSurface(sf); if (GL.audio) GL.audio.setSurface(sf); }
  // lumière autour du joueur (celle qui éclaire l'arme de la vue FPS)
  GL.dust.setLight(clamp(0.2 + (Arms.keyLight ? Arms.keyLight.intensity / 0.78 : 0.6) * 0.55, 0.2, 0.9));
  // les événements d'une image ne servent qu'une fois (une image sans updatePlayer ne les rejoue pas)
  const vide = { events: [], slide: o ? o.slide : { active: false, speed: 0, t: 0 }, body: o ? o.body : { facingYaw: player.yaw }, speed: o ? o.speed : 0 };
  const src = o && GL.neufs ? o : vide;
  GL.neufs = false;
  const feet = _glV.set(player.pos.x, player.gy + player.y, player.pos.z);
  GL.dust.update(dt, src, feet, camera, renderer.domElement.height);
  // sons : sur le bus des effets du jeu (volume, étouffement à terre)
  const bus = Sound.bus();
  if (bus && (!GL.audio || GL.audioCtx !== bus.ctx)) {
    GL.audio = MouvementEffets.createAudio({ context: bus.ctx, destination: bus.sortie, volume: GLISSADE.volume, surface: GL.surface || 'terre' });
    GL.audioCtx = bus.ctx;
  }
  if (GL.audio && GL.audio.available) {
    const ev = src.events.filter((e) => e.type === 'slideStart' || e.type === 'slideEnd');
    GL.audio.update(dt, { events: ev, slide: src.slide });
  }
}
