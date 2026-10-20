/*!
 * mouvement-cod.js v1.0.0 — Zombie Survival
 * Course, sprint tactique, glissade et annulation de glissade, réglés sur Call of Duty: Black Ops 6.
 * Logique pure, sans dépendance : le jeu fournit les entrées et le contact au sol, le module rend la vitesse,
 * la hauteur des yeux, les effets de caméra, la pose de l'arme en vue FPS et les paramètres du corps.
 * Pas de temps interne fixe (1/240 s) : mêmes durées et distances à 30, 60 ou 144 images par seconde.
 * Script classique → window.MouvementCoD ; CommonJS → module.exports ; ES module → mouvement-cod.mjs.
 *
 * Valeurs officielles (notes de mise à jour Black Ops 6, saison 3, mars 2025) :
 *   « Reduced slide max time from .7 to .65 » et « Reduced slide in max speed scale from 1.6 to 1.55 ».
 * Vitesses de déplacement : ordres de grandeur publiés par Activision (marche 4,6–5,0 m/s, sprint 6,1–7,2 m/s,
 * sprint tactique 8,4–8,7 m/s selon l'arme). Les autres réglages sont des estimations, signalées comme telles.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.MouvementCoD = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';

  var VERSION = '1.0.0';
  var DEG = Math.PI / 180;
  var STEP = 1 / 240;                       // pas interne de la simulation
  var TAU = Math.PI * 2;

  // ───────────── réglages ─────────────
  var BASE = {
    // vitesses (m/s) — ordres de grandeur officiels de Black Ops 6, arme d'assaut moyenne
    walkSpeed: 4.95,            // déplacement normal (petite course), officiel : 4,6–5,0 selon l'arme
    sprintSpeed: 6.65,          // officiel : 6,1–7,2 selon l'arme
    tacSprintSpeed: 8.2,        // officiel : 8,4–8,7 pour les armes de mêlée ; un peu moins avec une arme d'épaule
    crouchSpeed: 2.6,           // estimation
    aimSpeed: 3.5,              // déplacement en visée, estimation
    backwardScale: 0.8,         // recul plus lent (estimation)
    strafeScale: 0.92,          // pas chassés (estimation)
    accel: 11,                  // réactivité au sol (1/s) : 63 % de la vitesse visée en 0,09 s
    decel: 13,
    sprintAccel: 6,             // montée en vitesse du sprint (1/s)
    airControl: 3.5,            // contrôle en l'air (m/s²)
    // sprint
    sprintMode: 'toggle',       // 'toggle' (comme sur PC par défaut) ou 'hold' (maintenir)
    sprintMinForward: 0.35,     // part minimale de « avant » dans la direction pour sprinter
    tacSprint: true,            // sprint tactique (double appui sur sprint)
    tacDuration: 4.0,           // s d'endurance pleine (Warzone : passé de 2 à 4 s en 2024 ; estimation pour BO6)
    tacRegenDelay: 1.0,         // s avant la recharge (estimation)
    tacRegenTime: 2.5,          // s pour recharger entièrement (estimation)
    doubleTapWindow: 0.3,       // s entre deux appuis pour le sprint tactique
    // glissade
    slideMaxTime: 0.65,         // s — officiel BO6 saison 3 (0,70 avant)
    slideSpeedScale: 1.55,      // × walkSpeed = vitesse d'entrée maximale — officiel BO6 saison 3 (1,60 avant)
    slideAccelTime: 0.12,       // s pour atteindre la vitesse d'entrée (estimation)
    slideFriction: 0.5,         // coefficient de frottement : décélération = μ·g sur le plat (estimation)
    slideSteer: 70,             // °/s de correction de trajectoire pendant la glissade (estimation)
    slideMinSpeedScale: 0.8,    // vitesse minimale pour glisser, × sprintSpeed (« il faut être en sprint »)
    slideCooldown: 0.12,        // s entre la fin d'une glissade et la suivante
    slideLandingBuffer: 0.15,   // s : appui sur accroupi juste avant d'atterrir → glissade à l'atterrissage
    // annulation de glissade (BO6 : sprint, accroupi ou saut pendant la glissade)
    cancelOn: { jump: true, crouch: true, sprint: true },
    cancelMinTime: 0.1,         // s de glissade avant de pouvoir l'annuler (estimation)
    cancelResetsTacSprint: false, // true : l'annulation recharge le sprint tactique (comportement de MW 2019)
    sprintDelayAfterSlide: 0.25, // s avant de pouvoir resprinter après une glissade non annulée (estimation)
    crouchToStandTime: 0.2,     // s pour se relever d'accroupi (estimation)
    // saut et gravité (réalistes)
    jumpHeight: 0.55, gravity: 9.81, verticalPhysics: true, coyoteTime: 0.08,
    crouchMode: 'toggle',       // 'toggle' ou 'hold'
    // caméra (hauteur des yeux d'Anthony, 1,80 m)
    eyeStand: 1.66, eyeCrouch: 1.15, eyeSlide: 0.82,
    slideRoll: 6,               // ° d'inclinaison latérale pendant la glissade (tête vers la gauche)
    fovSprint: 3, fovTac: 6, fovSlide: 4,   // ° ajoutés au champ de vision
    bobScale: 1, shakeScale: 1, viewmodelScale: 1,
    // délais avant de pouvoir tirer (BO6 : 160–250 ms après un sprint, 280–335 ms après un sprint tactique,
    // 300–440 ms après le début d'une glissade, selon l'arme)
    sprintToFire: 0.2, tacSprintToFire: 0.3, slideToFire: 0.33
  };
  var PRESETS = {
    'bo6': { label: 'Black Ops 6 (depuis la saison 3)' },
    'bo6-lancement': { label: 'Black Ops 6 (lancement, avant la saison 3)', slideMaxTime: 0.7, slideSpeedScale: 1.6 },
    'bo6-recharge-tactique': { label: 'Black Ops 6 + annulation qui recharge le sprint tactique (façon MW 2019)', cancelResetsTacSprint: true }
  };

  function resolve(options) {
    var o = {}, k, p = (options && options.preset) || 'bo6';
    if (!PRESETS[p]) throw new Error('MouvementCoD: préréglage inconnu « ' + p + ' » (' + Object.keys(PRESETS).join(', ') + ')');
    for (k in BASE) o[k] = BASE[k];
    o.cancelOn = { jump: BASE.cancelOn.jump, crouch: BASE.cancelOn.crouch, sprint: BASE.cancelOn.sprint };
    for (k in PRESETS[p]) if (k !== 'label') o[k] = PRESETS[p][k];
    if (options) for (k in options) {
      if (k === 'preset') continue;
      if (!(k in BASE)) throw new Error('MouvementCoD: option inconnue « ' + k + ' »');
      if (k === 'cancelOn') { for (var c in options.cancelOn) o.cancelOn[c] = !!options.cancelOn[c]; }
      else o[k] = options[k];
    }
    o.preset = p; o.presetLabel = PRESETS[p].label;
    o.slidePeakSpeed = o.slideSpeedScale * o.walkSpeed;
    o.jumpSpeed = Math.sqrt(2 * o.gravity * o.jumpHeight);
    return o;
  }

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function expK(rate, h) { return 1 - Math.exp(-rate * h); }
  // ressort amorti (semi-implicite) : pulsation w (rad/s), amortissement z (1 = critique)
  function spring(s, target, w, z, h) { s.v += (w * w * (target - s.x) - 2 * z * w * s.v) * h; s.x += s.v * h; }
  function piece(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (var i = 1; i < table.length; i++) if (x <= table[i][0]) { var a = table[i - 1], b = table[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
    return table[table.length - 1][1];
  }
  // cadence (pas/s) selon la vitesse, d'après les mesures de biomécanique de la course (homme de 1,80 m)
  var CADENCE = [[0, 1.4], [1.4, 1.85], [2.5, 2.5], [3.5, 2.8], [5.0, 2.95], [6.65, 3.25], [8.2, 3.6], [10, 4.0]];
  // amplitude verticale du balancement de tête (m) selon la vitesse
  var BOB_V = [[0, 0], [1.4, 0.008], [4.95, 0.018], [6.65, 0.024], [8.2, 0.028]];

  // ───────────── contrôleur ─────────────
  function create(options) {
    var o = resolve(options || {});
    var S, out;

    function fresh() {
      S = {
        time: 0, state: 'stand', stance: 'stand', vx: 0, vz: 0, vy: 0, airT: 0, offGroundT: 0, fromSprint: false,
        stamina: 1, tacIdleT: 9, lastSprintPress: -9, sprintLatched: false, latchT: -9, wantTac: false, sawAir: true,
        slide: null, lastSlideEnd: -9, sprintBlockedUntil: 0, standReadyAt: 0, crouchBuffer: -9,
        eye: { x: o.eyeStand, v: 0 }, eyeW: 13, roll: { x: 0, v: 0 }, pitch: { x: 0, v: 0 }, fov: 0,
        bl: { slide: 0, sprint: 0, tac: 0, crouch: 0 }, step: 0, bobA: 0, lastFoot: 0,
        vm: [{ x: 0, v: 0 }, { x: 0, v: 0 }, { x: 0, v: 0 }, { x: 0, v: 0 }, { x: 0, v: 0 }, { x: 0, v: 0 }],
        readyT: 0, readyTotal: 0.2, lastYaw: null, lastPitch: null, yawRate: 0, pitchRate: 0,
        shakePh: [0, 1.3, 2.1, 0.4, 2.9, 1.7], lastSlide: null, facing: 0, prevGround: true
      };
      if (out) return;
      out = {
        state: 'stand', stance: 'stand', velocity: [0, 0, 0], speed: 0, onGround: true, events: [],
        camera: { eyeHeight: o.eyeStand, roll: 0, pitch: 0, yaw: 0, fov: 0, bobX: 0, bobY: 0 },
        viewmodel: { pos: [0, 0, 0], rot: [0, 0, 0], leftFree: 0, leftPos: [-0.21, -0.36, -0.42], leftRot: [-0.9, -0.25, 0] },
        body: { speed: 0, crouch: false, slide: 0, slideT: 0, sprint: 0, tac: 0, facingYaw: 0, onGround: true },
        weapon: { ready: 1, canFire: true },
        slide: { active: false, t: 0, maxTime: o.slideMaxTime, distance: 0, speed: 0, last: null },
        tac: { active: false, stamina: 1 }
      };
    }
    fresh();

    var pending = [];
    function emit(type, data) { var e = data || {}; e.type = type; e.time = +S.time.toFixed(4); (inUpdate ? out.events : pending).push(e); }
    var inUpdate = false;
    function hspeed() { return Math.hypot(S.vx, S.vz); }
    function setState(st) {
      if (S.state === st) return;
      var prev = S.state;
      S.state = st;
      if (st === 'sprint' && prev !== 'tacSprint') { emit('sprintStart'); S.readyT = Infinity; }
      if (st === 'tacSprint') { emit('tacStart'); S.readyT = Infinity; }
      if (prev === 'tacSprint' && st !== 'tacSprint') emit('tacEnd', { stamina: +S.stamina.toFixed(3) });
      if ((prev === 'sprint' || prev === 'tacSprint') && st !== 'sprint' && st !== 'tacSprint' && st !== 'slide') {
        S.readyTotal = prev === 'tacSprint' ? o.tacSprintToFire : o.sprintToFire; S.readyT = S.readyTotal;
      }
    }
    function forwardOk(my, ml) { return ml > 0.3 && my / Math.max(ml, 1e-6) >= o.sprintMinForward; }
    function jump() {
      S.vy = o.verticalPhysics ? o.jumpSpeed : 0; S.airT = 0; S.offGroundT = 0; S.sawAir = false;
      S.fromSprint = S.state === 'sprint' || S.state === 'tacSprint' || S.state === 'slide' || S.sprintLatched;
      emit('jump', { vy: +S.vy.toFixed(3) });
      if (S.stance !== 'stand') S.stance = 'stand';
      setState('air');
    }
    function startSlide(wx, wz) {
      var v = hspeed(), dx, dz;
      if (v > 0.1) { dx = S.vx / v; dz = S.vz / v; } else { var l = Math.hypot(wx, wz) || 1; dx = wx / l; dz = wz / l; }
      S.slide = { t: 0, v0: v, v: v, dx: dx, dz: dz, dist: 0, offT: 0 };
      S.stance = 'crouch';
      S.readyTotal = o.slideToFire; S.readyT = o.slideToFire;
      S.pitch.v -= 0.45;                    // la tête plonge un instant à l'impact
      S.eyeW = 24;
      for (var i = 0; i < S.shakePh.length; i++) S.shakePh[i] = Math.random() * TAU;
      setState('slide');
      emit('slideStart', { speed: +v.toFixed(3), peak: +o.slidePeakSpeed.toFixed(3) });
    }
    function endSlide(by, cancelled) {
      var sl = S.slide;
      S.lastSlide = { duration: +sl.t.toFixed(4), distance: +sl.dist.toFixed(3), cancelled: !!cancelled, by: by, entrySpeed: +sl.v0.toFixed(3), exitSpeed: +sl.v.toFixed(3) };
      S.slide = null; S.lastSlideEnd = S.time;
      if (cancelled) emit('slideCancel', { by: by, duration: S.lastSlide.duration, distance: S.lastSlide.distance });
      emit('slideEnd', S.lastSlide);
    }

    function step(h, inp, e) {
      S.time += h;
      var yaw = +inp.lookYaw || 0;
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var mx = clamp(+inp.moveX || 0, -1, 1), my = clamp(+inp.moveY || 0, -1, 1), ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
      var wx = fx * my + rx * mx, wz = fz * my + rz * mx;
      var onGround = inp.onGround !== false, canStand = inp.canStand !== false, aim = !!inp.aim;
      var n = inp.groundNormal, nx = 0, ny = 1, nz = 0;
      if (n) { var nl = Math.hypot(n[0], n[1], n[2]) || 1; nx = n[0] / nl; ny = n[1] / nl; nz = n[2] / nl; }
      var sprintHeld = !!inp.sprintHeld, crouchHeld = !!inp.crouchHeld;

      // appuis sur sprint : double appui → sprint tactique
      if (e.sprint) {
        if (S.time - S.lastSprintPress < o.doubleTapWindow) S.wantTac = true;
        S.lastSprintPress = S.time;
        if (o.sprintMode === 'toggle') { S.sprintLatched = true; S.latchT = S.time; }
      }
      if (o.sprintMode === 'toggle' && S.sprintLatched && S.state === 'stand' && S.time - S.latchT > 0.35 && !forwardOk(my, ml)) S.sprintLatched = false;
      if (o.sprintMode === 'hold') S.sprintLatched = sprintHeld;
      if (S.wantTac && S.time - S.lastSprintPress > o.doubleTapWindow) S.wantTac = false;
      var wantSprint = S.sprintLatched && forwardOk(my, ml) && !aim;

      // sol : départ (coyote time) et atterrissage
      if (S.state !== 'air') {
        if (!onGround && S.vy <= 0) { S.offGroundT += h; if (S.offGroundT > o.coyoteTime) { if (S.state === 'slide') endSlide('air', false); S.fromSprint = S.state === 'sprint' || S.state === 'tacSprint'; setState('air'); S.airT = 0; } }
        else S.offGroundT = 0;
      }
      if (S.state === 'air') {
        S.airT += h;
        if (e.crouch) S.crouchBuffer = S.time;
        if (e.jump && S.airT < o.coyoteTime && S.vy <= 0) { jump(); }
        if (!onGround) S.sawAir = true;
        if (onGround && S.vy <= 0 && S.airT > 0.02 && (S.sawAir || S.airT > 0.45)) {
          var impact = -S.vy; S.vy = 0;
          emit('land', { impact: +impact.toFixed(3) });
          S.eye.v -= Math.min(0.9, impact * 0.16); S.pitch.v -= Math.min(0.5, impact * 0.1);
          var v0 = hspeed();
          if (S.time - S.crouchBuffer <= o.slideLandingBuffer && v0 >= o.slideMinSpeedScale * o.sprintSpeed && S.time - S.lastSlideEnd >= o.slideCooldown) { S.state = 'stand'; startSlide(wx, wz); }
          else if (S.stance === 'crouch') setState('crouch');
          else if (S.fromSprint && wantSprint) setState('sprint');
          else setState('stand');
        }
      }
      if (S.state !== 'air' && S.state !== 'slide' && e.jump && onGround) {
        if (S.stance === 'crouch') { if (canStand) { S.stance = 'stand'; S.standReadyAt = S.time + o.crouchToStandTime; setState('stand'); emit('stand'); } else emit('standBlocked'); }
        else jump();
      }

      // sprint tactique : endurance
      if (S.state === 'tacSprint') { S.stamina -= h / o.tacDuration; S.tacIdleT = 0; }
      else { S.tacIdleT += h; if (S.tacIdleT > o.tacRegenDelay) S.stamina = Math.min(1, S.stamina + h / o.tacRegenTime); }

      var st = S.state, target = 0, rate = o.accel, v;
      switch (st) {
        case 'stand':
          if (e.crouch || (o.crouchMode === 'hold' && crouchHeld)) { S.stance = 'crouch'; setState('crouch'); emit('crouch'); break; }
          if (wantSprint && onGround && S.time >= S.sprintBlockedUntil && S.time >= S.standReadyAt) { setState(S.wantTac && o.tacSprint && S.stamina > 0.1 ? 'tacSprint' : 'sprint'); S.wantTac = false; }
          break;
        case 'crouch':
          if ((o.crouchMode === 'toggle' && e.crouch) || (o.crouchMode === 'hold' && !crouchHeld) || e.sprint) {
            if (canStand) { S.stance = 'stand'; S.standReadyAt = S.time + o.crouchToStandTime; setState('stand'); emit('stand'); }
            else if (e.crouch || e.sprint) emit('standBlocked');
          }
          break;
        case 'sprint':
          if (!wantSprint) { S.sprintLatched = o.sprintMode === 'hold' ? S.sprintLatched : false; setState('stand'); break; }
          if (e.crouch) { if (hspeed() >= o.slideMinSpeedScale * o.sprintSpeed && S.time - S.lastSlideEnd >= o.slideCooldown) startSlide(wx, wz); else { S.stance = 'crouch'; setState('crouch'); emit('crouch'); } break; }
          if ((e.sprint || S.wantTac) && o.tacSprint && S.stamina > 0.1 && my > 0.7) { setState('tacSprint'); S.wantTac = false; }
          break;
        case 'tacSprint':
          if (!wantSprint) { S.sprintLatched = o.sprintMode === 'hold' ? S.sprintLatched : false; setState('stand'); break; }
          if (e.crouch) { startSlide(wx, wz); break; }
          if (S.stamina <= 0 || my < 0.7 || Math.abs(mx) > 0.6) { S.stamina = Math.max(0, S.stamina); setState('sprint'); }
          break;
      }
      st = S.state;

      // ── glissade ──
      if (st === 'slide') {
        var sl = S.slide;
        sl.t += h;
        // annulation
        var by = null;
        if (sl.t >= o.cancelMinTime) {
          if (e.jump && o.cancelOn.jump) by = 'jump';
          else if (e.crouch && o.cancelOn.crouch) by = 'crouch';
          else if (e.sprint && o.cancelOn.sprint) by = 'sprint';
        }
        if (by) {
          if (!canStand && by !== 'jump') { emit('standBlocked'); by = null; }
        }
        if (by) {
          endSlide(by, true);
          S.lastSlideEnd = S.time;
          if (o.cancelResetsTacSprint) S.stamina = 1;
          S.pitch.v += 0.25; S.eyeW = 18;
          S.readyTotal = 0.12; S.readyT = Math.min(S.readyT, 0.12);
          S.stance = 'stand'; S.standReadyAt = S.time;
          if (by === 'jump') jump();
          else { S.sprintLatched = by === 'sprint' || S.sprintLatched || sprintHeld; setState(S.sprintLatched && forwardOk(my, ml) && !aim ? 'sprint' : 'stand'); }
          st = S.state;
        } else {
          // vitesse : montée vers la vitesse d'entrée maximale, puis frottement et pente
          if (sl.t <= o.slideAccelTime) sl.v = lerp(sl.v0, o.slidePeakSpeed, smooth(sl.t / o.slideAccelTime));
          else {
            // gravité le long du sol : g - (g·n)n, dont la part horizontale vaut G·ny·(nx, nz) ; frottement μ·G·ny
            var gAlong = o.gravity * ny * (nx * sl.dx + nz * sl.dz);
            sl.v += (gAlong - o.slideFriction * o.gravity * ny) * h;
            if (sl.v < 0) sl.v = 0;
          }
          // correction de trajectoire limitée vers la direction demandée
          if (ml > 0.2) {
            var wl = Math.hypot(wx, wz), tx = wx / wl, tz = wz / wl;
            var cross = sl.dx * tz - sl.dz * tx, dot = sl.dx * tx + sl.dz * tz;
            var ang = Math.atan2(cross, dot);
            if (Math.abs(ang) < 100 * DEG) {
              var dA = clamp(ang, -o.slideSteer * DEG * h, o.slideSteer * DEG * h), c = Math.cos(dA), s = Math.sin(dA);
              var ndx = sl.dx * c - sl.dz * s, ndz = sl.dx * s + sl.dz * c;
              sl.dx = ndx; sl.dz = ndz;
            }
          }
          S.vx = sl.dx * sl.v; S.vz = sl.dz * sl.v;
          sl.dist += sl.v * h;
          var timeUp = sl.t >= o.slideMaxTime - 1e-9;
          if (timeUp || sl.v < o.crouchSpeed * 0.9) {
            endSlide(timeUp ? 'time' : 'speed', false);
            S.sprintBlockedUntil = S.time + o.sprintDelayAfterSlide;
            S.sprintLatched = o.sprintMode === 'hold' ? S.sprintLatched : false;
            S.eyeW = 10;
            setState('crouch');
            st = 'crouch';
          }
        }
      }

      // ── vitesse horizontale hors glissade ──
      if (st !== 'slide') {
        if (st === 'air') {
          var cs = hspeed(), cap = Math.max(cs, o.walkSpeed);
          S.vx += wx * o.airControl * h; S.vz += wz * o.airControl * h;
          var ns = hspeed(); if (ns > cap) { S.vx *= cap / ns; S.vz *= cap / ns; }
          if (o.verticalPhysics) S.vy -= o.gravity * h;
        } else {
          if (st === 'sprint') { target = o.sprintSpeed; rate = o.sprintAccel; }
          else if (st === 'tacSprint') { target = o.tacSprintSpeed; rate = o.sprintAccel; }
          else if (st === 'crouch') target = o.crouchSpeed;
          else target = aim ? o.aimSpeed : o.walkSpeed;
          var post = S.time - S.lastSlideEnd < 0.6;   // élan après une glissade (BO6 : la vitesse se maintient un court instant)
          // pénalités de direction : recul et pas chassés
          var dirScale = 1;
          if (ml > 0.01) { var fwd = my / ml, side = Math.abs(mx) / ml; dirScale = fwd < 0 ? lerp(1, o.backwardScale, -fwd) : lerp(1, o.strafeScale, side * (1 - fwd)); }
          var tvx = wx * target * dirScale, tvz = wz * target * dirScale;
          var faster = tvx * tvx + tvz * tvz > S.vx * S.vx + S.vz * S.vz;
          var kRate = ml <= 0.01 ? (post ? 3.5 : o.decel) : faster ? rate : (post ? 3.5 : Math.max(rate, o.decel));
          var k = expK(kRate, h);
          S.vx += (tvx - S.vx) * k; S.vz += (tvz - S.vz) * k;
          if (S.vy < 0) S.vy = 0;
        }
      }

      // ── mélanges (0..1) ──
      var B = S.bl;
      B.slide += ((st === 'slide' ? 1 : 0) - B.slide) * expK(st === 'slide' ? 25 : 14, h);
      B.sprint += ((st === 'sprint' || st === 'tacSprint' ? 1 : 0) - B.sprint) * expK(8, h);
      B.tac += ((st === 'tacSprint' ? 1 : 0) - B.tac) * expK(7, h);
      B.crouch += ((S.stance === 'crouch' && st !== 'slide' ? 1 : 0) - B.crouch) * expK(10, h);

      // ── hauteur des yeux ──
      var eyeT = st === 'slide' ? o.eyeSlide : S.stance === 'crouch' ? o.eyeCrouch : o.eyeStand;
      if (st !== 'slide' && S.eyeW !== 13 && Math.abs(S.eye.x - eyeT) < 0.02 && Math.abs(S.eye.v) < 0.2) S.eyeW = 13;
      spring(S.eye, eyeT, S.eyeW, 1, h);

      // ── pas et balancement ──
      v = hspeed();
      var grounded = st !== 'air' && st !== 'slide';
      if (grounded && v > 0.2) {
        var cad = piece(CADENCE, v) * (S.stance === 'crouch' ? 1.05 : 1);
        S.step += cad * h;
        var foot = Math.floor(S.step);
        if (foot !== S.lastFoot) { S.lastFoot = foot; emit('footstep', { foot: foot % 2 ? 'R' : 'L', speed: +v.toFixed(2), state: st }); }
      }
      var bobT = grounded ? piece(BOB_V, v) * (S.stance === 'crouch' ? 0.6 : 1) : 0;
      S.bobA += (bobT - S.bobA) * expK(8, h);

      // ── roulis et tangage ──
      var lean = clamp(S.yawRate * 0.0125 * clamp(v / o.sprintSpeed, 0, 1.3), -2.5 * DEG, 2.5 * DEG) * (grounded ? 1 : 0.4);
      var strafe = -mx * 0.6 * DEG * clamp(v / o.walkSpeed, 0, 1) * (grounded ? 1 : 0);
      spring(S.roll, B.slide * o.slideRoll * DEG + lean + strafe, 12, 1, h);
      spring(S.pitch, 0, 13, 0.55, h);

      // ── arme : délai avant tir ──
      if (st === 'sprint' || st === 'tacSprint') S.readyT = Infinity;
      else if (S.readyT === Infinity) { S.readyTotal = o.sprintToFire; S.readyT = o.sprintToFire; }
      else S.readyT = Math.max(0, S.readyT - h);

      S.prevGround = onGround;
    }

    function update(dt, inp) {
      inp = inp || {};
      dt = clamp(+dt || 0, 0, 0.1);
      out.events.length = 0;
      inUpdate = true;
      for (var pi = 0; pi < pending.length; pi++) out.events.push(pending[pi]);
      pending.length = 0;
      // vitesses de rotation du regard (penchés dans les virages, retard de l'arme)
      var yaw = +inp.lookYaw || 0, pitch = +inp.lookPitch || 0;
      if (dt > 0) {
        if (S.lastYaw !== null) {
          var dy = yaw - S.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          S.yawRate += (dy / dt - S.yawRate) * expK(12, dt);
          S.pitchRate += ((pitch - S.lastPitch) / dt - S.pitchRate) * expK(12, dt);
        }
        S.lastYaw = yaw; S.lastPitch = pitch;
      }
      var e = { sprint: !!inp.sprintPressed, crouch: !!inp.crouchPressed, jump: !!inp.jumpPressed };
      var n = Math.max(1, Math.ceil(dt / STEP - 1e-9)), h = n ? dt / n : 0;
      if (dt === 0) n = 0;
      for (var i = 0; i < n; i++) { step(h, inp, e); e.sprint = e.crouch = e.jump = false; }
      compose(dt, inp);
      inUpdate = false;
      return out;
    }

    // Effets dérivés de l'état : caméra, arme FPS, corps. Calculés une fois par image.
    function compose(dt, inp) {
      var st = S.state, B = S.bl, v = hspeed(), o2 = o;
      out.state = st; out.stance = S.stance;
      out.velocity[0] = S.vx; out.velocity[1] = o.verticalPhysics ? S.vy : 0; out.velocity[2] = S.vz;
      out.speed = v; out.onGround = st !== 'air';
      // caméra
      var C = out.camera, ph = S.step, A = S.bobA * o.bobScale;
      C.eyeHeight = S.eye.x;
      C.bobY = -A * Math.cos(TAU * (ph % 1 - 0.1));
      C.bobX = A * 0.6 * Math.sin(Math.PI * ph);
      var sh = B.slide * clamp(v / o.slidePeakSpeed, 0, 1.2) * o.shakeScale, t = S.time, P = S.shakePh;
      var shake1 = Math.sin(TAU * 11.3 * t + P[0]) * 0.6 + Math.sin(TAU * 17.9 * t + P[1]) * 0.4;
      var shake2 = Math.sin(TAU * 13.7 * t + P[2]) * 0.6 + Math.sin(TAU * 21.1 * t + P[3]) * 0.4;
      var shake3 = Math.sin(TAU * 9.1 * t + P[4]) * 0.5 + Math.sin(TAU * 15.3 * t + P[5]) * 0.5;
      C.eyeHeight += shake3 * 0.002 * sh;
      C.roll = S.roll.x + (A / 0.024) * 0.5 * DEG * Math.sin(Math.PI * ph);
      C.pitch = S.pitch.x + shake1 * 0.0035 * sh;
      C.yaw = shake2 * 0.0025 * sh;
      var fovT = (B.sprint - B.tac) * o.fovSprint + B.tac * o.fovTac + B.slide * o.fovSlide * clamp(v / o.slidePeakSpeed, 0, 1);
      S.fov += (fovT - S.fov) * expK(7, dt);
      C.fov = S.fov;
      // arme FPS (repère caméra : x droite, y haut, -z avant ; rot = tangage, lacet, roulis)
      var aimW = inp.aim ? 1 : 0, wS = B.sprint * (1 - B.tac) * (1 - B.slide) * (1 - aimW), wT = B.tac * (1 - B.slide), wSl = B.slide;
      var sl = S.slide, slT = sl ? sl.t : 9, lowered = 1 - smooth(slT / Math.max(0.05, o.slideToFire));
      var cyc = ph / 2;   // cycle de deux pas
      var bS = Math.sin(TAU * cyc), bS2 = Math.abs(Math.sin(TAU * cyc));
      var amp = clamp(v / o.sprintSpeed, 0, 1.3);
      var tgt = [
        0.035 * wS + 0.055 * wT - 0.012 * wSl + (0.016 * wS + 0.024 * wT) * bS * amp + 0.004 * B.crouch,
        -0.045 * wS + 0.03 * wT - (0.024 + 0.022 * lowered) * wSl + (0.012 * wS + 0.018 * wT) * bS2 * amp - 0.008 * B.crouch - clamp(S.vy, -6, 6) * 0.004,
        0.04 * wS + 0.06 * wT + 0.012 * wSl,
        -0.32 * wS + 1.05 * wT + (0.04 - 0.1 * lowered) * wSl + (0.03 * wS + 0.05 * wT) * Math.cos(2 * TAU * cyc) * amp + clamp(-S.pitchRate * 0.008, -0.08, 0.08),
        0.52 * wS + 0.22 * wT + 0.06 * wSl + clamp(-S.yawRate * 0.01, -0.1, 0.1),
        0.4 * wS + 0.35 * wT - (0.26 + 0.12 * lowered) * wSl + (0.05 * wS + 0.08 * wT) * bS * amp
      ];
      var vs = o.viewmodelScale;
      var ns = Math.max(1, Math.ceil(dt * 120)), hs = dt / ns;
      for (var j = 0; j < ns; j++) for (var i = 0; i < 6; i++) spring(S.vm[i], tgt[i] * vs, 15, 0.85, hs);
      var V = out.viewmodel;
      V.pos[0] = S.vm[0].x; V.pos[1] = S.vm[1].x; V.pos[2] = S.vm[2].x;
      V.rot[0] = S.vm[3].x; V.rot[1] = S.vm[4].x; V.rot[2] = S.vm[5].x;
      // main gauche libre en sprint tactique : elle balance au rythme de la course
      V.leftFree = B.tac * (1 - B.slide);
      V.leftPos[0] = -0.21 - 0.02 * bS; V.leftPos[1] = -0.34 + 0.07 * bS * amp; V.leftPos[2] = -0.42 - 0.1 * bS * amp;
      V.leftRot[0] = -0.9 + 0.35 * bS * amp; V.leftRot[1] = -0.25; V.leftRot[2] = 0;
      // corps (pour hero.update)
      var Bo = out.body;
      Bo.speed = v; Bo.crouch = S.stance === 'crouch' && st !== 'slide'; Bo.slide = B.slide; Bo.slideT = sl ? sl.t : 0;
      Bo.sprint = B.sprint; Bo.tac = B.tac; Bo.onGround = st !== 'air';
      if (sl) S.facing = Math.atan2(-sl.dx, -sl.dz); else S.facing = +inp.lookYaw || 0;
      Bo.facingYaw = S.facing;
      // arme
      out.weapon.canFire = st !== 'sprint' && st !== 'tacSprint' && S.readyT <= 0;
      out.weapon.ready = st === 'sprint' || st === 'tacSprint' ? 0 : 1 - clamp(S.readyT / Math.max(1e-3, S.readyTotal), 0, 1);
      // glissade
      var SO = out.slide;
      SO.active = !!sl; SO.t = sl ? sl.t : 0; SO.distance = sl ? sl.dist : 0; SO.speed = sl ? sl.v : 0; SO.last = S.lastSlide;
      out.tac.active = st === 'tacSprint'; out.tac.stamina = clamp(S.stamina, 0, 1);
    }

    return {
      version: VERSION,
      config: o,
      update: update,
      /** Le jeu signale un mur touché (normale horizontale) : la vitesse vers le mur est retirée. */
      applyCollision: function (nx, nz) {
        var l = Math.hypot(nx, nz); if (!l) return;
        nx /= l; nz /= l;
        var d = S.vx * nx + S.vz * nz;
        if (d < 0) { S.vx -= d * nx; S.vz -= d * nz; }
        if (S.slide) {
          var sd = S.slide.dx * nx + S.slide.dz * nz;
          if (sd < 0) {
            var rx2 = S.slide.dx - sd * nx, rz2 = S.slide.dz - sd * nz, rl = Math.hypot(rx2, rz2);
            S.slide.v *= rl;   // la glissade garde seulement la part de vitesse le long du mur
            if (rl > 1e-3) { S.slide.dx = rx2 / rl; S.slide.dz = rz2 / rl; }
            if (S.slide.v < o.crouchSpeed * 0.9) { endSlide('obstacle', false); S.sprintBlockedUntil = S.time + o.sprintDelayAfterSlide; S.state = 'crouch'; }
          }
        }
      },
      /** Remet la vitesse à zéro (téléportation, réapparition) en gardant la posture debout. */
      reset: function () { fresh(); pending.length = 0; out.events.length = 0; compose(0, {}); return out; },
      get state() { return S.state; },
      get stance() { return S.stance; },
      get output() { return out; }
    };
  }

  // ───────────── clavier (codes physiques : ZQSD sur AZERTY = WASD sur QWERTY) ─────────────
  var DEFAULT_KEYS = {
    forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['KeyC'], jump: ['Space']
  };
  function createKeyboardInput(opts) {
    opts = opts || {};
    var target = opts.target || (typeof window !== 'undefined' ? window : null);
    if (!target) throw new Error('MouvementCoD.createKeyboardInput : aucune cible clavier');
    var keys = {}, k;
    for (k in DEFAULT_KEYS) keys[k] = (opts.bindings && opts.bindings[k]) || DEFAULT_KEYS[k];
    var down = {}, pressed = {}, all = {};
    for (k in keys) for (var i = 0; i < keys[k].length; i++) all[keys[k][i]] = k;
    var aimDown = false;
    function onDown(ev) {
      var a = all[ev.code]; if (!a) return;
      if (opts.enabled && !opts.enabled()) return;
      if (!ev.repeat) pressed[a] = true;
      down[a] = true;
      if (opts.preventDefault !== false) ev.preventDefault();
    }
    function onUp(ev) { var a = all[ev.code]; if (a) down[a] = false; }
    function onBlur() { down = {}; pressed = {}; aimDown = false; }
    function onMouse(ev) { if (ev.button === 2) aimDown = ev.type === 'mousedown'; }
    function onCtx(ev) { if (opts.aimWithRightButton !== false) ev.preventDefault(); }
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    if (typeof window !== 'undefined') window.addEventListener('blur', onBlur);
    if (opts.aimWithRightButton !== false) { target.addEventListener('mousedown', onMouse); target.addEventListener('mouseup', onMouse); target.addEventListener('contextmenu', onCtx); }
    var labels = {};
    try {
      if (typeof navigator !== 'undefined' && navigator.keyboard && navigator.keyboard.getLayoutMap) {
        navigator.keyboard.getLayoutMap().then(function (m) { m.forEach(function (v, c) { labels[c] = v.toUpperCase(); }); }, function () {});
      }
    } catch (err) { /* API absente : libellés QWERTY */ }
    var FALLBACK = { ShiftLeft: 'Maj', ShiftRight: 'Maj', Space: 'Espace', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ControlLeft: 'Ctrl' };
    // sans API de disposition (Firefox, Safari) : clavier AZERTY supposé pour le français de France et de Belgique
    var lang = (typeof navigator !== 'undefined' && navigator.language) || '';
    var AZERTY = /^fr(-(FR|BE|LU|MC))?$/i.test(lang) ? { KeyW: 'Z', KeyA: 'Q', KeyQ: 'A', KeyZ: 'W', Semicolon: 'M', KeyM: ',' } : {};
    return {
      bindings: keys,
      /** Lit l'état du clavier pour cette image ; les appuis (…Pressed) ne valent vrai qu'une fois. */
      read: function (extra) {
        var r = {
          moveX: (down.right ? 1 : 0) - (down.left ? 1 : 0), moveY: (down.forward ? 1 : 0) - (down.back ? 1 : 0),
          sprintHeld: !!down.sprint, sprintPressed: !!pressed.sprint, crouchHeld: !!down.crouch, crouchPressed: !!pressed.crouch,
          jumpPressed: !!pressed.jump, aim: aimDown
        };
        pressed = {};
        if (extra) for (var x in extra) r[x] = extra[x];
        return r;
      },
      /** Libellé de la touche sur le clavier de l'utilisateur (« Z » sur AZERTY pour KeyW, si le navigateur le permet). */
      label: function (action) { var c = keys[action][0]; return labels[c] || AZERTY[c] || FALLBACK[c] || c.replace(/^Key/, '').replace(/^Digit/, ''); },
      dispose: function () {
        target.removeEventListener('keydown', onDown); target.removeEventListener('keyup', onUp);
        if (typeof window !== 'undefined') window.removeEventListener('blur', onBlur);
        target.removeEventListener('mousedown', onMouse); target.removeEventListener('mouseup', onMouse); target.removeEventListener('contextmenu', onCtx);
      }
    };
  }

  // ───────────── aides Three.js (facultatives) ─────────────
  /** Place la caméra : pieds du joueur + hauteur des yeux + balancement ; regard (yaw, pitch) + roulis ; champ de vision. */
  function applyCamera(camera, out, feet, yaw, pitch, baseFov) {
    var C = out.camera, c = Math.cos(yaw), s = Math.sin(yaw);
    camera.position.set(feet.x + C.bobX * c, feet.y + C.eyeHeight + C.bobY, feet.z - C.bobX * s);
    camera.rotation.set(pitch + C.pitch, yaw + C.yaw, C.roll, 'YXZ');
    if (baseFov != null) {
      var f = baseFov + C.fov;
      if (Math.abs(camera.fov - f) > 1e-3) { camera.fov = f; camera.updateProjectionMatrix(); }
    }
  }
  /** Applique la pose de l'arme FPS à un groupe enfant de la caméra (basePos = position de hanche). */
  function applyViewmodel(group, out, basePos) {
    var V = out.viewmodel;
    group.position.set(basePos.x + V.pos[0], basePos.y + V.pos[1], basePos.z + V.pos[2]);
    group.rotation.set(V.rot[0], V.rot[1], V.rot[2], 'YXZ');
  }

  return {
    version: VERSION,
    create: create,
    PRESETS: PRESETS,
    DEFAULTS: BASE,
    createKeyboardInput: createKeyboardInput,
    applyCamera: applyCamera,
    applyViewmodel: applyViewmodel
  };
});
