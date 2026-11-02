
/* ------------------------------------------------------------ Ambiance --
   Le fond sonore du marais, synthétisé sur le bus des effets : clapot, vent dans les cyprès,
   grillons, grenouilles (ouaouarons, grenouilles vertes, rainettes), oiseaux de nuit au loin.
   Plus fort près des rives, plus de vent au large ; tout se tait quand la bête approche
   (MA.dread) : le silence est le premier signe. Sons brefs : pas dans l'eau, balle qui entre
   dans l'eau, grenade qui plonge. */
const MA_AMB = { ctx: null, out: null, fx: null, verb: null, noise: null, beds: null, crickets: [], frogT: 1.5, peepT: 3, birdT: 18, hushT: 0, lvl: 0, lapW: 0, sndT: -9, wadeT: 0, duckT: 0 };
/* Bruit rose (3 s) partagé par les lits et les éclaboussures. */
function maAmbNoise(ctx) {
  const n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
  }
  return buf;
}
/* Réverbération : une queue de bruit qui décroît (la brume, l'eau, les troncs). */
function maAmbIR(ctx, dur) {
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.4) * (i < 300 ? i / 300 : 1) * 0.5;
  }
  return buf;
}
function maAmbStart() {
  const b = Sound.bus();
  if (!b) return null;
  const A = MA_AMB;
  if (A.out && A.ctx === b.ctx) return A;
  if (A.out) maAmbStop(true);
  const ctx = b.ctx, t = ctx.currentTime;
  A.ctx = ctx;
  if (!A.noise || A.noise.sampleRate !== ctx.sampleRate) A.noise = maAmbNoise(ctx);
  // kit 2.0.7 (31 octobre) : sous 40 Hz, les nappes de bruit (clapot, vent) ne faisaient qu'une pression sourde au
  // casque (−26 dBFS entre 10 et 40 Hz, plus fort que tout le reste) ; on ne l'entendait pas, on la sentait
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = 0.7; hp.connect(b.sortie);
  A.out = ctx.createGain(); A.out.gain.value = 0; A.out.connect(hp); A.hp = hp;
  A.fx = ctx.createGain(); A.fx.gain.value = 1; A.fx.connect(b.sortie);
  A.verb = ctx.createConvolver(); A.verb.buffer = maAmbIR(ctx, 2.8);
  const vg = ctx.createGain(); vg.gain.value = 0.7; A.verb.connect(vg); vg.connect(A.out);
  const bed = (type, f, q, rate) => {
    const s = ctx.createBufferSource(); s.buffer = A.noise; s.loop = true; s.playbackRate.value = rate;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(A.out);
    s.start(t, Math.random() * 2.5);
    return { s, fl, g };
  };
  A.beds = { lap: bed('lowpass', 380, 0.9, 0.93), lap2: bed('bandpass', 900, 1.4, 1.07), wind: bed('bandpass', 230, 0.55, 0.71), hiss: bed('bandpass', 5600, 4, 1.0) };
  // grillons : sinus aigu découpé à 26-31 Hz (stridulation) ; l'enveloppe fait les paquets
  A.crickets = [];
  for (const [f, am, pan] of [[4300, 27, -0.45], [3780, 31, 0.55], [4620, 24, 0.1]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const m = ctx.createOscillator(); m.type = 'square'; m.frequency.value = am;
    const mg = ctx.createGain(); mg.gain.value = 0.5;
    const cg = ctx.createGain(); cg.gain.value = 0.5;
    const env = ctx.createGain(); env.gain.value = 0;
    m.connect(mg); mg.connect(cg.gain); o.connect(cg); cg.connect(env);
    let tail = env;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; env.connect(p); tail = p; }
    tail.connect(A.out);
    o.start(t); m.start(t);
    A.crickets.push({ o, m, env, T: Math.random() * 2, f });
  }
  return A;
}
function maAmbStop(now) {
  const A = MA_AMB;
  if (!A.out) return;
  const ctx = A.ctx, out = A.out, fx = A.fx, beds = A.beds, cr = A.crickets, hp = A.hp;
  A.out = null; A.fx = null; A.beds = null; A.crickets = []; A.lvl = 0; A.hp = null;
  const kill = () => {
    try {
      for (const k in beds) { beds[k].s.stop(); beds[k].g.disconnect(); }
      for (const c of cr) { c.o.stop(); c.m.stop(); c.env.disconnect(); }
      out.disconnect(); fx.disconnect(); if (hp) hp.disconnect();
    } catch (e) { /* déjà arrêtés */ }
  };
  if (now || !ctx || ctx.state === 'closed') { kill(); return; }
  out.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  setTimeout(kill, 700);
}
/* Côté d'un son pour l'oreille (−1 gauche, 1 droite). */
function maPanOf(x, z) {
  const L = camera.position, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
  if (d < 0.5) return 0;
  const yaw = VEH.drive ? VEH.drive.yaw + VEH.lookYaw : player.yaw;
  return clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d, -1, 1);
}
/* Une voix brève : source → filtres → gain → côté → sortie (+ réverbération). */
function maAmbVoice(A, src, pan, wet, dur) {
  const ctx = A.ctx, g = ctx.createGain();
  src.connect(g);
  let tail = g;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); tail = p; }
  tail.connect(A.out);
  if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; tail.connect(w); w.connect(A.verb); setTimeout(() => { try { w.disconnect(); } catch (e) { /* */ } }, (dur + 3.5) * 1000); }
  setTimeout(() => { try { tail.disconnect(); g.disconnect(); } catch (e) { /* */ } }, (dur + 3.5) * 1000);
  return g;
}
/* Grenouilles : ouaouaron (« rrroum », grave et rauque), grenouille verte (« gonk » double),
   rainette (sifflet montant, en série). dist : 0 près, 1 au loin (plus sourd, plus de réverbération). */
function maFrog(kind, pan, dist, level) {
  const A = MA_AMB;
  if (!A.out) return;
  const ctx = A.ctx, t0 = ctx.currentTime + 0.03;
  const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; lp.type = 'lowpass'; lp.frequency.value = lerp(7000, 1400, dist);
  o.connect(bp); bp.connect(lp);
  let end = t0;
  if (kind === 'ouaouaron') {
    const f0 = rand(58, 76), n = 2 + Math.floor(Math.random() * 3);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t0);
    bp.frequency.value = rand(210, 290); bp.Q.value = 2.6;
    // la râpe : modulation d'amplitude à 18-24 Hz
    const am = ctx.createOscillator(), amg = ctx.createGain(), rough = ctx.createGain();
    am.frequency.value = rand(17, 24); amg.gain.value = 0.45; rough.gain.value = 0.55;
    am.connect(amg); amg.connect(rough.gain); lp.connect(rough);
    const g = maAmbVoice(A, rough, pan, 0.25 + dist * 0.6, 4);
    g.gain.setValueAtTime(0, t0);
    let s = t0;
    for (let i = 0; i < n; i++) {
      const len = rand(0.38, 0.62);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(level * 0.9, s + 0.07);
      g.gain.setValueAtTime(level * 0.8, s + len * 0.7); g.gain.linearRampToValueAtTime(0, s + len);
      o.frequency.setValueAtTime(f0 * 1.06, s); o.frequency.linearRampToValueAtTime(f0 * 0.94, s + len);
      s += len + rand(0.35, 0.6);
    }
    end = s; am.start(t0); am.stop(end + 0.1);
  } else if (kind === 'verte') {
    const f0 = rand(150, 230), n = 1 + Math.floor(Math.random() * 2);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t0);
    bp.frequency.value = rand(650, 1050); bp.Q.value = 4.5;
    const g = maAmbVoice(A, lp, pan, 0.2 + dist * 0.6, 2);
    g.gain.setValueAtTime(0, t0);
    let s = t0;
    for (let i = 0; i < n; i++) {
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(level, s + 0.012); g.gain.setTargetAtTime(0, s + 0.035, 0.025);
      o.frequency.setValueAtTime(f0 * 1.12, s); o.frequency.exponentialRampToValueAtTime(f0 * 0.82, s + 0.08);
      s += rand(0.11, 0.16);
    }
    end = s + 0.2;
  } else {
    const f = rand(2500, 3150), n = 3 + Math.floor(Math.random() * 6), gap = rand(0.7, 1.15);
    o.type = 'sine'; bp.frequency.value = f; bp.Q.value = 1.2;
    const g = maAmbVoice(A, lp, pan, 0.3 + dist * 0.5, n * gap + 1);
    g.gain.setValueAtTime(0, t0);
    let s = t0;
    for (let i = 0; i < n; i++) {
      o.frequency.setValueAtTime(f * 0.86, s); o.frequency.exponentialRampToValueAtTime(f, s + 0.075);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(level * 0.5, s + 0.02); g.gain.setTargetAtTime(0, s + 0.06, 0.02);
      s += gap * rand(0.92, 1.08);
    }
    end = s;
  }
  o.start(t0); o.stop(end + 0.15);
}
/* Oiseaux de nuit, au loin dans la brume : hulotte (deux, trois ululements), héron (cri rauque). */
function maBird(kind, pan, level) {
  const A = MA_AMB;
  if (!A.out) return;
  const ctx = A.ctx, t0 = ctx.currentTime + 0.05;
  const o = ctx.createOscillator(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1800;
  o.connect(lp);
  let end = t0;
  if (kind === 'hulotte') {
    const f = rand(340, 410), g = maAmbVoice(A, lp, pan, 0.9, 5);
    o.type = 'sine'; g.gain.setValueAtTime(0, t0);
    const hoots = [[0, 0.32], [0.62, 0.2], [0.9, 0.85]];
    for (const [at, len] of hoots) {
      const s = t0 + at;
      o.frequency.setValueAtTime(f * 1.04, s); o.frequency.linearRampToValueAtTime(f * 0.95, s + len);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(level, s + 0.06); g.gain.setTargetAtTime(0, s + len * 0.8, 0.06);
    }
    // vibrato du long ululement
    const vb = ctx.createOscillator(), vg = ctx.createGain(); vb.frequency.value = 6.5; vg.gain.value = f * 0.02; vb.connect(vg); vg.connect(o.frequency); vb.start(t0 + 0.9); vb.stop(t0 + 2);
    end = t0 + 2;
  } else {
    const f = rand(480, 560), bp = ctx.createBiquadFilter(), g = maAmbVoice(A, bp, pan, 0.8, 3);
    o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.6;
    lp.connect(bp);
    const am = ctx.createOscillator(), amg = ctx.createGain(); am.frequency.value = 38; amg.gain.value = level * 0.4; am.connect(amg); amg.connect(g.gain);
    o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + 0.4);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level * 0.7, t0 + 0.03); g.gain.setTargetAtTime(0, t0 + 0.3, 0.06);
    am.start(t0); am.stop(t0 + 0.7);
    end = t0 + 0.7;
  }
  o.start(t0); o.stop(end + 0.1);
}
/* Où l'on est : près d'une rive (0 au large, 1 sur la berge), sur une île (forêt). */
function maShoreK(x, z) {
  let e = 1e9;
  for (const I of MA.islands) e = Math.min(e, Math.hypot(x - I.x, z - I.z) - I.r);
  return 1 - owSmoothstep(0, 95, Math.max(0, e));
}
/* Chaque image (idle : menu, fin de partie). */
function maAmbUpdate(dt, idle) {
  const A = maAmbStart();
  if (!A) return;
  const ctx = A.ctx, t = ctx.currentTime, L = camera.position;
  const dread = MA.dread || 0, hush = 1 - owSmoothstep(0.22, 0.55, dread);
  // kit 2.0.7 : sous l'averse (ma17), les grillons se taisent, les oiseaux aussi ; les grenouilles se font
  // rares (couvertes par la pluie) puis reprennent en chœur quand elle cesse (le sol encore mouillé) ; le vent forcit
  const WX = typeof MA_WX !== 'undefined' && MA_WX.ready ? MA_WX : null, rI = WX ? WX.I : 0, after = WX ? WX.wet * (1 - owSmoothstep(0.02, 0.15, rI)) : 0;
  const shore = maShoreK(L.x, L.z), onW = !idle && maPlayerOnWater(), swim = !idle && MA_SWIM.on, inside = MA.inside || 0;
  // volume général : il monte au chargement ; un peu plus bas à l'intérieur
  A.lvl = damp(A.lvl, G.state === 'playing' || G.state === 'menu' ? 1 - 0.45 * inside : 0.4, 0.8, dt);
  // le silence d'avant la ruée (MM 2.1.3) : l'ambiance se tait d'un coup (A.duckT, en s)
  const duck = A.duckT > 0 ? 0.08 : 1;
  A.duckT = Math.max(0, (A.duckT || 0) - dt);
  A.out.gain.setTargetAtTime(A.lvl * (idle ? 0.8 : 1) * duck, t, duck < 1 ? 0.03 : 0.12);
  // le clapot : des vaguelettes contre la coque, les pilotis, les roseaux (marche au hasard lissée)
  A.lapW = clamp(A.lapW + (Math.random() - 0.5) * dt * 3, -1, 1);
  const lap = (onW ? 0.42 : 0.1 + 0.22 * shore) * (1 + 0.45 * A.lapW) * (swim ? 1.4 : 1);
  A.beds.lap.g.gain.setTargetAtTime(lap, t, 0.12);
  A.beds.lap.fl.frequency.setTargetAtTime(swim ? 260 : 380 + 120 * A.lapW, t, 0.2);
  A.beds.lap2.g.gain.setTargetAtTime(lap * 0.12 * (1 + A.lapW), t, 0.1);
  // le vent forcit sous l'averse et dans l'orage, sans tout couvrir (31 octobre, chez Anthony : jusqu'à +10 dB, un
  // grondement « étourdissant » ; maintenant +3 à +6 dB au plus fort)
  const ws = WX ? Math.min(3.5, Math.max(0, WX.windS - 0.6)) : 0;
  A.beds.wind.g.gain.setTargetAtTime((0.1 + 0.12 * (1 - shore) + 0.05 * dread + 0.03 * ws) * (1 - 0.4 * inside), t, 0.6);
  A.beds.wind.fl.frequency.setTargetAtTime(230 + 45 * ws, t, 0.8);
  A.beds.hiss.g.gain.setTargetAtTime(0.022 * (0.35 + 0.65 * shore) * hush * (1 - 0.6 * inside) * (1 - 0.85 * rI), t, 0.5);
  // grillons : paquets de stridulations, chacun à son rythme
  for (const c of A.crickets) {
    c.T -= dt;
    if (c.T > 0) continue;
    const lv = 0.012 * (0.25 + 0.75 * shore) * hush * (1 - 0.7 * inside) * (1 - owSmoothstep(0.05, 0.4, rI)) * (1 - 0.6 * after);
    c.T = rand(0.45, 0.95);
    if (lv < 0.0015 || Math.random() < 0.15) { c.env.gain.setTargetAtTime(0, t, 0.05); continue; }
    const s = t + 0.02, len = rand(0.09, 0.2);
    c.env.gain.setValueAtTime(0, s); c.env.gain.linearRampToValueAtTime(lv, s + 0.012);
    c.env.gain.setValueAtTime(lv, s + len); c.env.gain.linearRampToValueAtTime(0, s + len + 0.025);
  }
  // les grenouilles : un chœur près des rives, quelques voix au large ; elles se taisent d'un coup
  A.hushT = dread > 0.42 ? 18 : Math.max(0, A.hushT - dt);
  if (A.hushT <= 0) {
    A.frogT -= dt * (0.25 + 1.1 * shore) * hush * (1 - 0.6 * owSmoothstep(0.1, 0.6, rI)) * (1 + 1.4 * after);
    if (A.frogT <= 0) {
      A.frogT = rand(0.5, 1.8);
      const r = Math.random(), kind = r < 0.32 ? 'ouaouaron' : r < 0.72 ? 'verte' : 'rainette';
      const dist = clamp(rand(0.15, 1) * (1.15 - shore * 0.5), 0, 1);
      maFrog(kind, rand(-0.9, 0.9), dist, (kind === 'ouaouaron' ? 0.16 : 0.09) * (1 - 0.65 * dist) * hush * (1 - 0.5 * inside));
    }
  }
  // oiseaux de nuit : rares, toujours loin
  A.birdT -= dt;
  if (A.birdT <= 0) {
    A.birdT = rand(22, 55);
    if (hush > 0.5 && rI < 0.15) maBird(Math.random() < 0.7 ? 'hulotte' : 'heron', rand(-0.9, 0.9), 0.06 * hush);
  }
}
/* Éclaboussure (son) : k 0,1 (goutte, balle) à 1 (corps, grenade) ; à (x, z). */
function maSplashSnd(x, z, k = 0.3) {
  const A = MA_AMB;
  if (!A.out || G.time - A.sndT < 0.025) return;
  A.sndT = G.time;
  const ctx = A.ctx, t = ctx.currentTime + 0.005, L = camera.position;
  const d = Math.hypot(x - L.x, z - L.z), att = 1 / (1 + Math.pow(Math.max(0, d - 2) / 9, 1.4));
  if (att < 0.03) return;
  const s = ctx.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = rand(0.8, 1.25);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(rand(1400, 2400) * (1.2 - 0.5 * k), t); bp.frequency.exponentialRampToValueAtTime(rand(300, 500), t + 0.18 + k * 0.3);
  const g = ctx.createGain(), lvl = (0.12 + 0.5 * k) * att;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.008); g.gain.setTargetAtTime(0, t + 0.03 + k * 0.08, 0.05 + k * 0.12);
  s.connect(bp); bp.connect(g);
  // le « ploc » : une bulle qui chante (sinus qui monte)
  const o = ctx.createOscillator(), og = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(rand(380, 620) / (0.6 + k), t + 0.01); o.frequency.exponentialRampToValueAtTime(rand(900, 1400) / (0.6 + k), t + 0.07);
  og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(lvl * 0.35, t + 0.012); og.gain.setTargetAtTime(0, t + 0.04, 0.025);
  o.connect(og);
  let tail = g;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = maPanOf(x, z) * 0.8; g.connect(p); og.connect(p); tail = p; } else og.connect(g);
  tail.connect(A.fx);
  const wet = ctx.createGain(); wet.gain.value = 0.15 + clamp(d / 60, 0, 0.5); tail.connect(wet); wet.connect(A.verb);
  s.start(t, Math.random() * 2); s.stop(t + 0.5 + k * 0.6); o.start(t); o.stop(t + 0.2);
  setTimeout(() => { try { tail.disconnect(); wet.disconnect(); g.disconnect(); og.disconnect(); } catch (e) { /* */ } }, 4000);
}
/* Un pas dans l'eau (maPlayerWater) : plus grave et plus long dans l'eau profonde. */
function maSoundWade(pos, d) {
  const A = MA_AMB;
  if (!A.out) return;
  const ctx = A.ctx, t = ctx.currentTime + 0.005;
  const s = ctx.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = rand(0.75, 1.1);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(rand(800, 1200) - d * 300, t); bp.frequency.exponentialRampToValueAtTime(rand(220, 320), t + 0.25 + d * 0.15);
  const g = ctx.createGain(), lvl = clamp(0.14 + d * 0.38, 0.1, 0.5);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.03); g.gain.setTargetAtTime(0, t + 0.08, 0.07 + d * 0.08);
  s.connect(bp); bp.connect(g); g.connect(A.fx);
  s.start(t, Math.random() * 2); s.stop(t + 0.7);
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, 1500);
}

/* Un pas dans la vase : succion grave (le pied qui sort), un petit claquement mouillé. */
function maSoundMud(pos) {
  const A = MA_AMB;
  if (!A.out) return;
  const ctx = A.ctx, t = ctx.currentTime + 0.005;
  const s = ctx.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = rand(0.55, 0.75);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6;
  bp.frequency.setValueAtTime(rand(380, 520), t); bp.frequency.exponentialRampToValueAtTime(rand(140, 190), t + 0.22);
  const g = ctx.createGain(), lvl = rand(0.13, 0.18);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.05); g.gain.setTargetAtTime(0, t + 0.12, 0.06);
  s.connect(bp); bp.connect(g); g.connect(A.fx);
  s.start(t, Math.random() * 2); s.stop(t + 0.5);
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, 1200);
}

/* ------------------------------------------------- Vase et eau sous les balles --
   Les impacts sur le terrain (owSandHit) et les zombies qui sortent du sol (owSandBurst) :
   de la vase sombre à terre ; dans l'eau, une gerbe et des bulles. */
function maMudPool() {
  if (!MA.mudFX) {
    const m = maHFogLite(new THREE.PointsMaterial({ color: new THREE.Color(0x3e3326).convertSRGBToLinear(), size: 0.085, map: TEX.glow, alphaTest: 0.35 }));
    _linDone.add(m);
    MA.mudFX = new PointPool(260, share(m), 9.8, false);
    MA.mudFX.points.name = 'vase';
  }
  if (!MA.mudFX.points.parent) scene.add(MA.mudFX.points);
  return MA.mudFX;
}
function maMudHit(x, y, z, nx, ny, nz) {
  if (y < MA.water + 0.03 && maDepth(x, z) > 0.03) {          // le fond, sous l'eau : rien ne sort (la gerbe est à la surface)
    if (Math.random() < 0.5) maBubbles(x, z, 2, 0.15);
    return;
  }
  const P = maMudPool();
  for (let i = 0; i < 7; i++) P.emit(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03, nx * rand(0.3, 1.1) + rand(-0.5, 0.5), ny * rand(0.5, 1.6) + rand(0.2, 1.1), nz * rand(0.3, 1.1) + rand(-0.5, 0.5), rand(0.3, 0.65));
  spawnPuff(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08, rand(0.22, 0.38), rand(0.45, 0.75), 0x4e4334, 0.4, 0.2);
}
function maMudBurst(x, z, y) {
  const d = maDepth(x, z);
  if (d > 0.05) {
    // il sort de l'eau : remous, bulles, une gerbe boueuse
    maSplash(x, z, 0.9 + d * 0.6, { up: 0.8 });
    maBubbles(x, z, 10, 0.9);
    maSplashSnd(x, z, 0.7);
    spawnPuff(x, MA.water + 0.15, z, 1.4, 1.6, 0x3a3a2c, 0.35, 0.3);
    return;
  }
  const P = maMudPool();
  for (let i = 0; i < 18; i++) P.emit(x + rand(-0.35, 0.35), y + 0.05, z + rand(-0.35, 0.35), rand(-1.1, 1.1), rand(1.3, 3.2), rand(-1.1, 1.1), rand(0.5, 0.95));
  spawnPuff(x, y + 0.35, z, 1.3, 1.3, 0x4a3e2e, 0.5, 0.3);
}

/* ------------------------------------------------- Tirs, projectiles, grenades --
   hitscan : la balle entre dans l'eau (gerbe), s'y arrête en un mètre ; la bête (yeux, gueule,
   leurres, branchies). Tout coup de feu près de l'eau profonde : elle l'entend (maNoise). */
const _maShot = { water: false, tw: Infinity, stopT: Infinity, mon: null };
function maShot(s, ox, oy, oz, dx, dy, dz, wallT) {
  const tw = maRayWater(oy, dy);
  const water = tw < wallT;
  const stopT = water ? Math.min(wallT, tw + 1) : wallT;
  _maShot.water = water; _maShot.tw = tw; _maShot.stopT = stopT;
  _maShot.mon = maRayMonster(ox, oy, oz, dx, dy, dz, stopT);
  return _maShot;
}
/* La bête touchée (hitscan) : dégâts (portée, points faibles), giclée sombre, bulles sous l'eau. */
function maShotHit(s, MW, dx, dy, dz, dmg) {
  const def = WEAPONS[s.id], h = MW.mon, fall = def.falloff;
  let d = dmg;
  if (fall) d *= h.t <= fall[0] ? 1 : h.t >= fall[1] ? fall[2] : lerp(1, fall[2], (h.t - fall[0]) / (fall[1] - fall[0]));
  maBeastDamage(d, h.part, { kind: 'bullet', under: h.under, x: h.x, y: h.y, z: h.z });
  if (h.under) maBubbles(h.x, h.z, 3, 0.35);
  else {
    bloodBurst(h.x, h.y, h.z, dx, dz, h.part === 'oeil' || h.part === 'gueule' ? 6 : 3, 0.8);
    spawnPuff(h.x - dx * 0.1, h.y - dy * 0.1, h.z - dz * 0.1, 0.18, 0.4, 0x2a3a26, 0.5, 0.2);
  }
  HUD.hitmarker(false);
  Arms.shotHit = true;
  const boom = wstat(s, 'explosive');
  if (boom) explode(h.x - dx * 0.3, h.y - dy * 0.3, h.z - dz * 0.3, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s });
}
/* Fin du trajet : la gerbe où la balle est entrée dans l'eau (et les balles explosives). */
function maShotEnd(MW, ox, oy, oz, dx, dy, dz, endT, s) {
  if (!MW.water || endT < MW.tw - 1e-3) return;
  const x = ox + dx * MW.tw, z = oz + dz * MW.tw, def = WEAPONS[s.id];
  maSplash(x, z, def.kind === 'shotgun' ? 0.12 : 0.22, { up: 0.8 });
  maSplashSnd(x, z, 0.1);
  const boom = wstat(s, 'explosive');
  if (boom && !MW.mon) explode(x, MA.water + 0.05, z, boom.r, boom.dmg, { color: 0xff7a30, src: 'rounds', slot: s });
}
/* Onde de choc (blastCone) : la bête dans le cône, à portée. */
function maBlastCone(ox, oy, oz, b, s) {
  if (!MAB.on || !MAB.obj || !MAB.obj.visible) return 0;
  const H = maBeastAnchor('head', _mbV), hx = H.x - ox, hy = H.y - oy, hz = H.z - oz, d = Math.hypot(hx, hy, hz);
  if (d > b.range + 2.5) return 0;
  const dot = (hx * _fwd.x + hy * _fwd.y + hz * _fwd.z) / (d || 1);
  if (dot < Math.cos(b.cone) * 0.9) return 0;
  maBeastDamage(2600 * (1 - 0.6 * clamp(d / (b.range + 2.5), 0, 1)), 'tete', { kind: 'blast', under: H.y < MA.water - 0.3 });
  return 1;
}
/* Grenade dans l'eau : elle plonge (gerbe), freinée, coule lentement, des bulles. */
function maNadeWater(g, dt) {
  if (g.y > MA.water + 0.04 || maDepth(g.x, g.z) < 0.12) { g.wet = false; return; }
  if (!g.wet) {
    g.wet = true;
    maSplash(g.x, g.z, 0.55, { up: 0.9 });
    maSplashSnd(g.x, g.z, 0.45);
    g.vx *= 0.35; g.vz *= 0.35; g.vy *= 0.25;
  }
  g.vy += GRAV.feel * dt * 0.82;                                 // poussée de l'eau
  const k = Math.exp(-3.2 * dt);
  g.vx *= k; g.vy *= k; g.vz *= k;
  g.bubT = (g.bubT || 0) - dt;
  if (g.bubT <= 0) { g.bubT = 0.35; maBubbles(g.x, g.z, 2, 0.2); }
}
/* Explosion (explode) : la bête l'entend et l'encaisse ; sous l'eau (grenade coulée), une colonne
   d'eau au lieu du feu, des dégâts aux zombies et au nageur proches. Renvoie le nombre de zombies
   touchés, ou −1 : explosion ordinaire (au-dessus de l'eau). */
function maExplodeWater(x, y, z, radius, damage, opts) {
  maExplode(x, y, z, radius, damage);
  const d = maDepth(x, z);
  if (y > MA.water - 0.15 || d < 0.4) {
    if (Math.abs(y - MA.water) < 1.1 && d > 0.15) { maSplash(x, z, 1.4 + radius * 0.25, { up: 1.3 }); maBubbles(x, z, 12, radius * 0.4); }
    return -1;
  }
  const big = clamp(radius / 4.5, 0.4, 1.6), depth = MA.water - y;
  Sound.explosion({ x, y: MA.water, z }, big * 0.75);
  maSplashSnd(x, z, 1);
  // la colonne : une gerbe haute, l'écume, la vapeur ; d'autant plus basse que la charge est profonde
  const up = clamp(2.2 - depth * 0.35, 0.8, 2.2);
  maSplash(x, z, 2.6 + radius * 0.25, { up });
  maSplash(x + rand(-0.6, 0.6), z + rand(-0.6, 0.6), 1.6, { up: up * 0.7 });
  maBubbles(x, z, 24, radius * 0.5);
  for (let i = 0; i < 3; i++) setTimeout(() => maBubbles(x + rand(-1, 1), z + rand(-1, 1), 10, radius * 0.4), 250 + i * 280);
  spawnPuff(x, MA.water + 1.2, z, radius * 0.9, 1.8, 0xb8c4bc, 0.35, 0.4, false, MA.splashTex);
  maRipple(x, z, 0.25);
  FX.boomLight.position.set(x, MA.water + 0.4, z);
  FX.boomLight.color.setHex(0xffb070); FX.boomLight.intensity = 1.5 * big; FX.boomT = 0.15;
  const dp = Math.hypot(player.pos.x - x, player.pos.z - z);
  maSecousse(Math.max(0, 1 - dp / (radius * 3)) * 0.7 * big, 1.2);
  // dégâts : l'onde porte dans l'eau ; les zombies qui pataugent, le nageur
  let hit = 0;
  const R = radius * 1.15;
  for (const zb of Zombies.list) {
    if (!zb.alive) continue;
    const dz = Math.hypot(zb.pos.x - x, zb.pos.z - z);
    if (dz > R || maDepth(zb.pos.x, zb.pos.z) < 0.1) continue;
    const f = clamp(1 - dz / R, 0, 1), ux = (zb.pos.x - x) / (dz || 1), uz = (zb.pos.z - z) / (dz || 1);
    damageZombie(zb, damage * (0.3 + 0.7 * f), { kind: 'explosive', src: opts.src, dx: ux, dz: uz, force: 1 + 3 * f, slot: opts.slot || null });
    hit++;
  }
  if (opts.self && MA_SWIM.on && dp < R && !player.down) player.damage(opts.self * 1.3 * (1 - dp / R), true);
  return hit;
}

/* ---------------------------------------------------------------- Crochets --
   Pour les quêtes à venir (Mod Tools, cartes dérivées) : rien n'est écrit ici, seulement de quoi
   s'y accrocher. Événements (maOn(nom, fn), « * » pour tous) :
     ile        { id, nom }                  on aborde une île (nom du lieu affiché)
     lieu       { id, what: 'entre'|'sort' } un lieu repéré (chapelle, cabane, station, péniche, pierres, autel…)
     repere     { id }                       un repère ajouté par marque() (rayon r)
     menace     { level, from, attn }        palier de la menace (0 calme … 4 attaque)
     bete       { state, from, x, z }        état de la bête (rode, affleure, traque, guet, charge, attaque…)
     attaque    { kind, … }                  bosse, barque, morsure, rate, ruee (cible) ; noye (n : Noyés engloutis,
                                             kit 2.0.7 ; manqué : rate, cible 'noye')
     devoration { what }                     debut, fin
     barque     { what, id, … }              monte, degats, chavire, redressee
     nage       { what }                     debut, fin
     blessure   { amount, part }             la bête touchée
     boss       { what, phase }              debut, phase, vaincue, mort, fin
     manche     { n }
     noye       { what, id, … }              les Noyés (ma15, kit MM 2.1.6) : sort (x, z), agrippe, saisit, tue (kind), coule ;
                                             englouti (par la bête, kit 2.0.7)
     stryges    { what, manche, … }          manche de Stryges (ma16, kit 2.0.7) : debut (nombre), fin
     stryge     { what, id, … }              une Stryge : arrive (x, z), apparait (x, z : elle sort de l'éclair rouge, ma19),
                                             cri, pique, rate, mord (degats), ecrase, noyee, tuee (kind)
     meteo      { what, … }                  le temps (ma17, ma18, kit 2.0.7) : sec (dur), averse (n, dur, orage), orage (n, dur),
                                             fin-orage (n)
     foudre     { x, z, surface, d, tues, joueur }   un éclair au sol (ma18) : surface eau, bois, boue, arbre ; d : distance
                                             au joueur (m) ; tues : foudroyés ; joueur : PV perdus
   Lieux repérés : MA_PL.spots (rectangles des bâtiments, points des pierres et de l'autel). */
const MA_HOOKS = { fns: {}, log: [], spots: null, inSpot: new Set(), t: 0, marks: new Map() };
function maOn(name, fn) {
  (MA_HOOKS.fns[name] || (MA_HOOKS.fns[name] = [])).push(fn);
  return () => { const L = MA_HOOKS.fns[name]; if (L) MA_HOOKS.fns[name] = L.filter((f) => f !== fn); };
}
function maEmit(name, data = {}) {
  const ev = Object.assign({}, data, { name, t: +G.time.toFixed(2) });
  MA_HOOKS.log.push(ev);
  if (MA_HOOKS.log.length > 80) MA_HOOKS.log.shift();
  for (const L of [MA_HOOKS.fns[name], MA_HOOKS.fns['*']]) {
    if (!L) continue;
    for (const f of L.slice()) { try { f(ev); } catch (e) { console.warn('marais : crochet « ' + name + ' »', e); } }
  }
}
/* Les lieux repérés, à plat : rectangles (x0, z0, x1, z1) ou disques (x, z, r), hauteur y. */
const MA_SPOT_ROOF = { chapel: 1, cabin: 1, pump: 1, gen: 1, lab: 1, shack: 1, houses: 1, sawmill: 0.6 };
function maSpots() {
  if (MA_HOOKS.spots) return MA_HOOKS.spots;
  const out = [];
  for (const id in MA_PL.spots) {
    const v = MA_PL.spots[id];
    for (const [i, s] of (Array.isArray(v) ? v : [v]).entries()) {
      const key = Array.isArray(v) ? `${id}.${i}` : id;
      if (Number.isFinite(s.x0)) out.push({ id: key, x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: s.y, roof: MA_SPOT_ROOF[id] || 0 });
      else if (Number.isFinite(s.x)) out.push({ id: key, x: s.x, z: s.z, r: id === 'stones' ? 9 : id === 'barge' ? 7 : 3, y: s.y, roof: 0 });
    }
  }
  MA_HOOKS.spots = out;
  return out;
}
function maHooksReset() { MA_HOOKS.spots = null; MA_HOOKS.inSpot.clear(); MA_HOOKS.t = 0; }
function maHooksUpdate(dt) {
  const p = player;
  // à l'intérieur (sous un toit) : moins de brume, une ambiance plus sourde
  MA_HOOKS.t -= dt;
  if (MA_HOOKS.t <= 0) {
    MA_HOOKS.t = 0.2;
    let roof = 0;
    const now = new Set();
    for (const s of maSpots()) {
      const yOk = !Number.isFinite(s.y) || Math.abs(p.gy - s.y) < 3;
      const inn = s.r ? Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < s.r : p.pos.x > s.x0 - 0.3 && p.pos.x < s.x1 + 0.3 && p.pos.z > s.z0 - 0.3 && p.pos.z < s.z1 + 0.3;
      if (inn && yOk) { now.add(s.id); roof = Math.max(roof, s.roof); }
    }
    for (const id of now) if (!MA_HOOKS.inSpot.has(id)) maEmit('lieu', { id, what: 'entre' });
    for (const id of MA_HOOKS.inSpot) if (!now.has(id)) maEmit('lieu', { id, what: 'sort' });
    MA_HOOKS.inSpot = now;
    MA.insideT = VEH.drive || MA_SWIM.on ? 0 : roof;
    // repères (marque) : en approche
    for (const m of MA_HOOKS.marks.values()) {
      if (!m.r) continue;
      const inn = Math.hypot(p.pos.x - m.x, p.pos.z - m.z) < m.r;
      if (inn && !m.inn) maEmit('repere', { id: m.id });
      m.inn = inn;
    }
  }
  MA.inside = damp(MA.inside || 0, MA.insideT || 0, 2.5, dt);
  if (MA.mudFX) MA.mudFX.update(dt);
}
/* Petite carte : les pontons (où accoster), puis les repères des quêtes (marque). */
function maMapMarks(g, X, Z, S) {
  for (const id in MA_PL.docks) {
    const D = MA_PL.docks[id], px = X(D.x), pz = Z(D.z);
    if (px < -6 || pz < -6 || px > S + 6 || pz > S + 6) continue;
    g.fillStyle = '#c9a26a'; g.strokeStyle = '#120e0b'; g.lineWidth = 1.2;
    g.fillRect(px - 2.5, pz - 2.5, 5, 5); g.strokeRect(px - 2.5, pz - 2.5, 5, 5);
  }
  for (const m of MA_HOOKS.marks.values()) {
    if (m.hidden) continue;
    const px = X(m.x), pz = Z(m.z);
    if (px < -8 || pz < -8 || px > S + 8 || pz > S + 8) continue;
    g.fillStyle = m.color || '#f0a33a'; g.strokeStyle = '#0b0c0e'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(px, pz, 6, 0, TAU); g.fill(); g.stroke();
    if (m.text) { g.fillStyle = '#0b0c0e'; g.font = `700 9px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.text, px, pz + 0.5); }
  }
}
/* Lanterne allumée tout près (0 à 1) : l'arme en main s'éclaire (owViewLum). */
function maLampNear() {
  const p = player, y = p.gy + 1.4;
  let best = 0;
  for (const L of MA_PL.lamps) {
    if (!L || !L.on) continue;
    const dx = L.x - p.pos.x, dz = L.z - p.pos.z;
    if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue;
    best = Math.max(best, 1 - owSmoothstep(2, 12, Math.hypot(dx, L.y - y, dz)));
  }
  return best;
}
/* window.ZS.marais : l'interface du marais (Mod Tools, quêtes à venir, tests). */
const MA_API = {
  version: 1,
  get on() { return OW.on && OW.worldId === 'marais'; },
  cfg: MA_CFG, boss: MA_BOSS, islands: MA.islands, fosse: MA.fosse,
  get spots() { return MA_PL.spots; }, get docks() { return MA_PL.docks; },
  on: maOn, emit: maEmit, get log() { return MA_HOOKS.log.slice(); },
  get menace() { return MAM.attn; }, set menace(v) { MAM.attn = clamp(+v || 0, 0, 100); },
  get niveau() { return MAM.level; },
  get bete() { return { state: MAB.state, x: MAB.x, y: MAB.y, z: MAB.z, yaw: MAB.yaw, visible: !!(MAB.obj && MAB.obj.visible) }; },
  /* repère sur la petite carte (et événement « repere » à moins de r m) */
  marque(id, o = {}) { MA_HOOKS.marks.set(id, { id, x: +o.x || 0, z: +o.z || 0, r: +o.r || 0, color: o.color, text: o.text, hidden: !!o.hidden, inn: false }); },
  efface(id) { MA_HOOKS.marks.delete(id); },
  /* la bête : la calmer (elle s'éloigne), l'appeler (menace à 85) */
  calme() { MAM.attn = 0; if (MAB.on && MAB.state !== 'dormant' && MAB.state !== 'devore') maBeastSetState('retraite'); },
  appelle(v = 85) { MAM.attn = clamp(v, 0, 100); },
  profondeur: (x, z) => maDepth(x, z), get eau() { return MA.water; },
};
