/*!
 * mouvement-effets.js v1.0.0 — Zombie Survival
 * Effets des déplacements de mouvement-cod.js : poussière soulevée par la glissade et les appuis,
 * sons synthétisés (pas, frottement de glissade, impact, relevé, atterrissage). Aucun fichier audio.
 * Poussière : Three.js r128 à r186 (THREE.Points + ShaderMaterial). Sons : Web Audio.
 * Script classique → window.MouvementEffets ; CommonJS → module.exports.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.MouvementEffets = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';
  var VERSION = '1.0.0';
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ───────────── poussière ─────────────
  var SURFACES = {
    terre: { color: [0.62, 0.55, 0.45], rate: 1.0, size: 1.0 },
    sable: { color: [0.76, 0.68, 0.52], rate: 1.35, size: 1.15 },
    beton: { color: [0.6, 0.6, 0.58], rate: 0.45, size: 0.8 },
    herbe: { color: [0.46, 0.5, 0.36], rate: 0.25, size: 0.7 }
  };
  function createDust(THREE, scene, opts) {
    opts = opts || {};
    var N = opts.max || 320;
    var pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
    var life = new Float32Array(N), age = new Float32Array(N), s0 = new Float32Array(N), s1 = new Float32Array(N), a0 = new Float32Array(N);
    for (var i = 0; i < N; i++) { age[i] = 1; life[i] = 1; pos[i * 3 + 1] = -1000; }
    var geo = new THREE.BufferGeometry();
    var aPos = new THREE.BufferAttribute(pos, 3), aSize = new THREE.BufferAttribute(size, 1), aAlpha = new THREE.BufferAttribute(alpha, 1);
    if (aPos.setUsage) { aPos.setUsage(THREE.DynamicDrawUsage); aSize.setUsage(THREE.DynamicDrawUsage); aAlpha.setUsage(THREE.DynamicDrawUsage); }
    geo.setAttribute('position', aPos); geo.setAttribute('aSize', aSize); geo.setAttribute('aAlpha', aAlpha);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    var surface = SURFACES[opts.surface || 'terre'] || SURFACES.terre;
    var uniforms = { uColor: { value: new THREE.Vector3().fromArray(surface.color) }, uLight: { value: opts.light != null ? opts.light : 0.8 }, uScale: { value: 600 } };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, transparent: true, depthWrite: false,
      vertexShader: [
        'attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;',
        'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), 0.0, 512.0); vA = aAlpha; }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uLight; varying float vA;',
        'void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;',
        '  float a = (1.0 - r * r); a *= a; gl_FragColor = vec4(uColor * uLight, a * vA); }'
      ].join('\n')
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false; points.renderOrder = 2; points.name = 'poussière de déplacement';
    scene.add(points);
    var cursor = 0, acc = 0, live = 0;
    function spawn(x, y, z, vx, vy, vz, sz0, sz1, al, lf) {
      var i = cursor; cursor = (cursor + 1) % N;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      s0[i] = sz0; s1[i] = sz1; a0[i] = al; life[i] = lf; age[i] = 0;
    }
    // nuage soulevé au point de contact, projeté vers l'arrière et les côtés
    function puff(x, y, z, dx, dz, speed, count, strength) {
      var k = surface.size;
      for (var j = 0; j < count; j++) {
        var back = rnd(0.25, 0.9) * speed * 0.28, side = rnd(-1, 1) * (0.35 + speed * 0.06);
        spawn(x + rnd(-0.12, 0.12), y + rnd(0.02, 0.1), z + rnd(-0.12, 0.12),
          -dx * back + -dz * side, rnd(0.25, 0.95) * (0.6 + 0.4 * strength), -dz * back + dx * side,
          rnd(0.08, 0.16) * k, rnd(0.45, 0.85) * k * (0.7 + 0.3 * strength), rnd(0.28, 0.5) * strength, rnd(0.9, 1.7));
      }
    }
    return {
      object: points,
      /** dt : secondes ; out : sortie de mouvement-cod ; feet : position des pieds {x,y,z} ; camera : pour la taille à l'écran */
      update: function (dt, out, feet, camera, viewportHeight) {
        if (camera && camera.isPerspectiveCamera) {
          var h = viewportHeight || (opts.renderer ? opts.renderer.domElement.height : 800);
          uniforms.uScale.value = h / (2 * Math.tan(camera.fov * Math.PI / 360));
        }
        var ev = out.events, sl = out.slide, f = out.body.facingYaw, dx = -Math.sin(f), dz = -Math.cos(f);
        var rate = surface.rate * (opts.intensity != null ? opts.intensity : 1);
        for (var e = 0; e < ev.length; e++) {
          var E = ev[e];
          if (E.type === 'slideStart') puff(feet.x + dx * 0.35, feet.y, feet.z + dz * 0.35, dx, dz, E.speed, Math.round(26 * rate), 1);
          else if (E.type === 'land' && E.impact > 1.5) puff(feet.x, feet.y, feet.z, dx, dz, out.speed, Math.round(clamp(E.impact * 5, 0, 22) * rate), clamp(E.impact / 4, 0.3, 1));
          else if (E.type === 'footstep' && E.speed > 5.5 && opts.footsteps !== false) puff(feet.x + dx * 0.15, feet.y, feet.z + dz * 0.15, dx, dz, E.speed * 0.5, Math.round(2 * rate + Math.random()), 0.35);
          else if (E.type === 'slideCancel') puff(feet.x + dx * 0.4, feet.y, feet.z + dz * 0.4, dx, dz, out.speed * 0.6, Math.round(10 * rate), 0.6);
        }
        if (sl.active) {
          acc += dt * 95 * rate * clamp(sl.speed / 7.67, 0, 1.3);
          while (acc >= 1) {
            acc -= 1;
            var heel = Math.random() < 0.3, off = heel ? 1.15 : 0.32;
            puff(feet.x + dx * off, feet.y, feet.z + dz * off, dx, dz, sl.speed, 1, heel ? 0.55 : 0.85);
          }
        } else acc = 0;
        // simulation : traînée de l'air, légère flottaison, grossissement et fondu
        live = 0;
        var drag = Math.exp(-2.6 * dt);
        for (var i = 0; i < N; i++) {
          if (age[i] >= life[i]) { alpha[i] = 0; continue; }
          live++;
          age[i] += dt;
          var t = age[i] / life[i];
          vel[i * 3] *= drag; vel[i * 3 + 1] = vel[i * 3 + 1] * drag - 0.35 * dt; vel[i * 3 + 2] *= drag;
          pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.max(feet.y - 0.05, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          size[i] = s0[i] + (s1[i] - s0[i]) * (1 - (1 - t) * (1 - t));
          alpha[i] = a0[i] * Math.min(1, age[i] / 0.06) * (1 - t) * (1 - t);
        }
        aPos.needsUpdate = true; aSize.needsUpdate = true; aAlpha.needsUpdate = true;
      },
      setSurface: function (name) { surface = SURFACES[name] || surface; uniforms.uColor.value.fromArray(surface.color); },
      setLight: function (v) { uniforms.uLight.value = v; },
      get live() { return live; },
      dispose: function () { scene.remove(points); geo.dispose(); mat.dispose(); }
    };
  }

  // ───────────── sons ─────────────
  var SOUND_SURFACES = {
    terre: { crunch: [1500, 2600], decay: 0.13, thump: 0.9, grit: 1.0 },
    sable: { crunch: [1100, 2000], decay: 0.16, thump: 0.6, grit: 1.2 },
    beton: { crunch: [2600, 4200], decay: 0.08, thump: 1.15, grit: 0.55 },
    herbe: { crunch: [800, 1700], decay: 0.12, thump: 0.6, grit: 0.35 }
  };
  function createAudio(opts) {
    opts = opts || {};
    var AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AC) return { resume: function () {}, update: function () {}, setVolume: function () {}, setSurface: function () {}, dispose: function () {}, available: false };
    var ctx = opts.context || new AC();
    var master = ctx.createGain(); master.gain.value = opts.volume != null ? opts.volume : 0.8;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp); comp.connect(opts.destination || ctx.destination);
    var surf = SOUND_SURFACES[opts.surface || 'terre'] || SOUND_SURFACES.terre;
    // bruit blanc partagé (2 s)
    var nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var foot = 0, slideNodes = null, gritT = 0;
    function noise(t0, dur, rate) { var s = ctx.createBufferSource(); s.buffer = nb; s.playbackRate.value = rate || 1; s.start(t0, Math.random() * 1.5, dur + 0.05); return s; }
    function env(g, t0, peak, attack, decay) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay); }
    function panned(node, pan) {
      if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(master); }
      else node.connect(master);
    }
    function thump(t0, freq, level, decay) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.6, t0); o.frequency.exponentialRampToValueAtTime(freq, t0 + 0.03);
      env(g, t0, level, 0.003, decay); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + decay + 0.05);
    }
    function crunch(t0, f0, f1, level, decay, pan, q) {
      var s = noise(t0, decay + 0.02, rnd(0.8, 1.2)), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = rnd(f0, f1); bp.Q.value = q || 0.9;
      hp.type = 'highpass'; hp.frequency.value = 500;
      env(g, t0, level, 0.0015, decay);
      s.connect(bp); bp.connect(hp); hp.connect(g); panned(g, pan || 0);
    }
    function footstep(E) {
      var t0 = ctx.currentTime + 0.005, crouch = E.state === 'crouch', i = clamp(E.speed / 8.2, 0.25, 1) * (crouch ? 0.45 : 1);
      foot = 1 - foot;
      var pan = foot ? 0.12 : -0.12;
      thump(t0, rnd(70, 95), 0.32 * i * surf.thump, 0.075);
      crunch(t0, surf.crunch[0], surf.crunch[1], 0.22 * i, surf.decay * rnd(0.85, 1.15), pan);
      if (E.speed > 6 && !crouch) crunch(t0 + 0.01, 5000, 7200, 0.04 * i, 0.03, -pan, 2.5);   // équipement qui tinte
    }
    function rustle(t0, level, dur) { crunch(t0, 2200, 3200, level, dur, 0, 0.6); }
    function slideStart(E) {
      var t0 = ctx.currentTime + 0.005, lv = clamp(E.speed / 7.67, 0.5, 1.2);
      thump(t0, 52, 0.55 * lv, 0.16);                                   // le corps touche le sol
      var s = noise(t0, 0.2, 0.7), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 900; env(g, t0, 0.35 * lv, 0.004, 0.18); s.connect(lp); lp.connect(g); g.connect(master);
      // frottement continu : bruit en boucle filtré, suit la vitesse
      var src = ctx.createBufferSource(); src.buffer = nb; src.loop = true; src.playbackRate.value = 0.9;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.value = 500 + 120 * E.speed;
      var rum = ctx.createBiquadFilter(); rum.type = 'lowpass'; rum.frequency.value = 220;
      var g1 = ctx.createGain(), g2 = ctx.createGain(), out = ctx.createGain();
      g1.gain.value = 0.55; g2.gain.value = 0.9; out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(0.42 * lv, t0 + 0.035);
      src.connect(bp); bp.connect(g1); g1.connect(out); src.connect(rum); rum.connect(g2); g2.connect(out); out.connect(master);
      src.start(t0, Math.random());
      slideNodes = { src: src, bp: bp, out: out };
    }
    function slideStop(cancelled) {
      if (!slideNodes) return;
      var t0 = ctx.currentTime, n = slideNodes, rel = cancelled ? 0.06 : 0.14;
      n.out.gain.cancelScheduledValues(t0); n.out.gain.setValueAtTime(Math.max(0.0001, n.out.gain.value), t0); n.out.gain.exponentialRampToValueAtTime(0.0001, t0 + rel);
      n.src.stop(t0 + rel + 0.05);
      slideNodes = null;
      rustle(t0 + 0.01, cancelled ? 0.16 : 0.1, cancelled ? 0.12 : 0.16);     // vêtements qui frottent quand il se relève
    }
    return {
      available: true, context: ctx,
      /** À appeler depuis un geste de l'utilisateur (clic, touche) : les navigateurs bloquent le son avant. */
      resume: function () { if (ctx.state === 'suspended') return ctx.resume(); },
      update: function (dt, out) {
        if (ctx.state !== 'running') return;
        var ev = out.events;
        for (var e = 0; e < ev.length; e++) {
          var E = ev[e];
          if (E.type === 'footstep') footstep(E);
          else if (E.type === 'slideStart') slideStart(E);
          else if (E.type === 'slideEnd') slideStop(E.cancelled);
          else if (E.type === 'land') { var t0 = ctx.currentTime + 0.003, k = clamp(E.impact / 4, 0.2, 1); thump(t0, 60, 0.6 * k * surf.thump, 0.12); crunch(t0, surf.crunch[0], surf.crunch[1], 0.3 * k, surf.decay * 1.3, 0); }
          else if (E.type === 'jump') rustle(ctx.currentTime + 0.003, 0.08, 0.1);
        }
        if (slideNodes && out.slide.active) {
          var v = out.slide.speed, t = ctx.currentTime;
          slideNodes.bp.frequency.setTargetAtTime(500 + 120 * v, t, 0.04);
          slideNodes.out.gain.setTargetAtTime(Math.max(0.0001, 0.42 * clamp(v / 7.67, 0.2, 1.2)), t, 0.05);
          // graviers : petits claquements aléatoires, plus serrés à grande vitesse
          gritT -= dt;
          while (gritT <= 0) { gritT += 1 / (18 + 30 * clamp(v / 7.67, 0, 1.2) * surf.grit); crunch(t + Math.random() * 0.02, 3000, 6500, rnd(0.03, 0.09) * surf.grit, 0.012, rnd(-0.3, 0.3), 1.6); }
        }
      },
      setVolume: function (v) { master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
      setSurface: function (name) { surf = SOUND_SURFACES[name] || surf; },
      dispose: function () { if (slideNodes) slideNodes.src.stop(); master.disconnect(); if (!opts.context) ctx.close(); }
    };
  }

  return { version: VERSION, createDust: createDust, createAudio: createAudio, SURFACES: Object.keys(SURFACES) };
});
