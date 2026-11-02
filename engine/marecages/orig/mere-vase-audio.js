/* ============================================================================================
   La Mère-Vase : voix et bruits, entièrement synthétisés (Web Audio, aucun fichier).
   Module autonome : MereVaseAudio.create(ctx, dest) sur le contexte et le bus des effets du jeu.

   Chaque son se joue avec un placement calculé par le jeu (distance, côté, eau entre la bête et
   l'oreille) :
     A.play(nom, { gain, pan, lp, rate, wet, under })
       gain  : volume (0 à 1, déjà atténué par la distance)
       pan   : -1 gauche … +1 droite
       lp    : coupure passe-bas en Hz (son étouffé sous l'eau ou loin) ; défaut 18 000
       rate  : hauteur des voix (1 = normale ; 0,5 à 2)
       wet   : part de réverbération (brouillard, marais : longue queue) ; défaut 0.25
       under : la bête est sous l'eau (grave renforcé, aigus coupés)
   Sons : grondement, cri, souffle, bulles, remous, eclaboussure, retombe, impact, arrache,
          morsure, saisie, secousse, avale, plonge, douleur, mort, appel, coque, claque, ruee.
   Fond continu (approche) : A.drone(niveau 0..1, { pan, lp }) — infra-grave, battements
   dissonants, pouls lent ; s'éteint à 0.
   ============================================================================================ */
(function (root) {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function create(ctx, dest, opts) {
    const O = Object.assign({ volume: 1 }, opts || {});
    const out = ctx.createGain();
    out.gain.value = O.volume;
    out.connect(dest);
    // ---- tampons de bruit (blanc, brun) partagés
    const SR = ctx.sampleRate;
    const mkBuf = (sec, fn) => {
      const n = Math.floor(SR * sec), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
      fn(d, n);
      return b;
    };
    const white = mkBuf(3, (d, n) => { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; });
    const brown = mkBuf(4, (d, n) => {
      let v = 0;
      for (let i = 0; i < n; i++) { v = (v + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = v * 3.5; }
    });
    // ---- réverbération : marais embrumé, queue de 3,2 s, premières réflexions rares
    const verb = ctx.createConvolver();
    verb.buffer = (() => {
      const n = Math.floor(SR * 3.2), b = ctx.createBuffer(2, n, SR);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) {
          const t = i / SR, e = Math.exp(-t * 1.9) * (t < 0.03 ? t / 0.03 : 1);
          d[i] = (Math.random() * 2 - 1) * e * (0.6 + 0.4 * Math.exp(-t * 6));
        }
      }
      return b;
    })();
    const verbLP = ctx.createBiquadFilter(); verbLP.type = 'lowpass'; verbLP.frequency.value = 2600;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.9;
    verb.connect(verbLP); verbLP.connect(verbOut); verbOut.connect(out);
    // ---- distorsion douce (gorge) : courbe en tanh
    const curve = (k) => {
      const n = 1024, c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
      return c;
    };
    const CURVE_SOFT = curve(2.2), CURVE_HARD = curve(5.5);
    let PITCH = 1;                                   // hauteur du son en cours (variété d'un cri à l'autre)

    // ---- chaîne de sortie d'un son : gain → passe-bas → panoramique → sortie (+ envoi réverbéré)
    function chain(o) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      lp.type = 'lowpass';
      lp.frequency.value = clamp(o.lp || 18000, 80, 20000);
      lp.Q.value = 0.5;
      g.gain.value = clamp(o.gain === undefined ? 1 : o.gain, 0, 2);
      g.connect(lp);
      if (pn) { pn.pan.value = clamp(o.pan || 0, -1, 1); lp.connect(pn); pn.connect(out); } else lp.connect(out);
      const ws = ctx.createGain();
      ws.gain.value = clamp(o.wet === undefined ? 0.25 : o.wet, 0, 1.5) * clamp(o.gain === undefined ? 1 : o.gain, 0, 2);
      lp.connect(ws); ws.connect(verb);
      const nodes = [g, lp, ws]; if (pn) nodes.push(pn);
      return { input: g, nodes, end: 0 };
    }
    // libère les nœuds d'un son quand il est fini
    function release(C, dur) {
      const ms = (dur + 3.6) * 1000;
      setTimeout(() => { for (const n of C.nodes) { try { n.disconnect(); } catch (e) { /* déjà fait */ } } }, ms);
    }
    // ---- briques
    const noise = (buf, t, dur, dst, gainEnv) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const off = Math.random() * (buf.duration - 0.1);
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(g); g.connect(dst);
      gainEnv(g.gain, t);
      s.start(t, off); s.stop(t + dur + 0.05);
      return { s, g };
    };
    const filt = (type, f, q, dst) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; if (dst) b.connect(dst); return b; };
    const env = (p, t, a, h, r, peak) => {
      p.setValueAtTime(0.0001, t);
      p.linearRampToValueAtTime(peak, t + a);
      p.setValueAtTime(peak, t + a + h);
      p.exponentialRampToValueAtTime(0.0001, t + a + h + r);
    };
    const osc = (type, t, dur, dst, freqFn) => {
      const o = ctx.createOscillator(); o.type = type;
      freqFn(o.frequency, t);
      o.connect(dst); o.start(t); o.stop(t + dur + 0.05);
      return o;
    };
    /* Voix de gorge géante : fondamentale (dent de scie + carré) dans des formants, grain (modulation
       par du bruit), sous-harmonique, souffle. f : [[temps, Hz], …] (rampes), formants : [[Hz, Q, gain], …] */
    function throat(t, dur, f, peak, dst, o) {
      o = o || {};
      const bus = ctx.createGain(); bus.gain.value = 0;
      const shaper = ctx.createWaveShaper(); shaper.curve = o.hard ? CURVE_HARD : CURVE_SOFT; shaper.oversample = '2x';
      const pre = ctx.createGain(); pre.gain.value = o.drive || 1.6;
      pre.connect(shaper);
      const forms = (o.formants || [[170, 3, 1], [420, 4, 0.7], [880, 5, 0.35]]).map(([fq, q, gg]) => {
        const b = filt('bandpass', fq, q); const g = ctx.createGain(); g.gain.value = gg;
        shaper.connect(b); b.connect(g); g.connect(bus); return b;
      });
      // grain : AM par un bruit filtré (râle)
      const am = ctx.createGain(); am.gain.value = 1;
      const ns = ctx.createBufferSource(); ns.buffer = white; ns.loop = true;
      const nl = filt('lowpass', o.roughF || 30, 0.7, null);
      const ng = ctx.createGain(); ng.gain.value = (o.rough === undefined ? 0.7 : o.rough) * 4;
      ns.connect(nl); nl.connect(ng); ng.connect(am.gain);
      ns.start(t, Math.random() * 2); ns.stop(t + dur + 0.05);
      am.connect(pre);
      const setF = (p, mult) => {
        p.setValueAtTime(f[0][1] * mult * PITCH, t);
        for (let i = 1; i < f.length; i++) p.exponentialRampToValueAtTime(Math.max(5, f[i][1] * mult * PITCH), t + f[i][0]);
      };
      const o1 = osc('sawtooth', t, dur, am, (p) => setF(p, 1));
      const o2 = osc('square', t, dur, am, (p) => setF(p, 1.003));
      const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.disconnect(); o2.connect(g2); g2.connect(am);
      if (o.vib) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = o.vib; const lg = ctx.createGain(); lg.gain.value = o.vibA || 3;
        lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
      }
      // sous-harmonique (poitrine)
      const sub = ctx.createGain(); sub.gain.value = o.sub === undefined ? 0.55 : o.sub;
      osc('sine', t, dur, sub, (p) => setF(p, 0.5)); sub.connect(bus);
      // souffle dans la gorge
      if (o.breath) {
        const bf = filt('bandpass', o.breathF || 600, 0.8, bus);
        noise(white, t, dur, bf, (p) => env(p, t, Math.min(0.2, dur * 0.2), dur * 0.5, dur * 0.3, o.breath));
      }
      env(bus.gain, t, o.att || 0.12, o.hold === undefined ? dur * 0.55 : o.hold, Math.max(0.05, dur - (o.att || 0.12) - (o.hold === undefined ? dur * 0.55 : o.hold)), peak);
      bus.connect(dst);
      return bus;
    }
    // éclaboussure : claquement de surface, gerbe, gouttes qui retombent
    function splash(t, size, dst) {
      const k = clamp(size, 0.2, 2);
      // claque
      noise(white, t, 0.25, filt('highpass', 500, 0.6, dst), (p) => env(p, t, 0.004, 0.02, 0.2 * k, 0.55 * k));
      // gerbe (souffle d'eau)
      const b = filt('bandpass', 1400, 0.9, dst);
      noise(white, t, 1.4 * k, b, (p) => env(p, t, 0.02, 0.15 * k, 1.1 * k, 0.55 * k));
      b.frequency.setValueAtTime(2400, t); b.frequency.exponentialRampToValueAtTime(700, t + 1.2 * k);
      // masse d'eau (grave)
      const lo = filt('lowpass', 220, 0.8, dst);
      noise(brown, t, 1.6 * k, lo, (p) => env(p, t, 0.03, 0.2 * k, 1.2 * k, 0.6 * k));
      osc('sine', t, 0.5, (() => { const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.005, 0.03, 0.4, 0.6 * k); g.connect(dst); return g; })(), (p) => { p.setValueAtTime(90, t); p.exponentialRampToValueAtTime(38, t + 0.4); });
      // gouttes
      const n = Math.round(14 * k);
      for (let i = 0; i < n; i++) {
        const tt = t + 0.25 + Math.random() * 1.3 * k, f0 = rnd(900, 3800);
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, tt, 0.002, 0.005, 0.06, rnd(0.04, 0.16) * k); g.connect(dst);
        osc('sine', tt, 0.09, g, (p) => { p.setValueAtTime(f0, tt); p.exponentialRampToValueAtTime(f0 * 1.7, tt + 0.05); });
      }
    }
    // bulles : petits gloussements montants
    function bubbles(t, n, spread, dst, low) {
      for (let i = 0; i < n; i++) {
        const tt = t + Math.random() * spread, f0 = low ? rnd(140, 420) : rnd(260, 900);
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, tt, 0.004, 0.01, rnd(0.05, 0.12), rnd(0.08, 0.25)); g.connect(dst);
        osc('sine', tt, 0.16, g, (p) => { p.setValueAtTime(f0, tt); p.exponentialRampToValueAtTime(f0 * rnd(1.4, 2.2), tt + 0.06); });
      }
    }
    // bois qui craque (planches) : transitoire + résonances
    function woodHit(t, k, dst) {
      noise(white, t, 0.2, filt('bandpass', 1900, 1.6, dst), (p) => env(p, t, 0.002, 0.01, 0.16, 0.9 * k));
      for (const [f, d, a] of [[176, 0.45, 0.5], [263, 0.35, 0.4], [418, 0.25, 0.3], [641, 0.18, 0.18]]) {
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.003, 0.01, d, a * k); g.connect(dst);
        osc('triangle', t, d + 0.05, g, (p) => { p.setValueAtTime(f * rnd(0.95, 1.05), t); });
      }
      const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.004, 0.02, 0.35, 0.9 * k); g.connect(dst);
      osc('sine', t, 0.4, g, (p) => { p.setValueAtTime(95, t); p.exponentialRampToValueAtTime(45, t + 0.35); });
    }
    function crunch(t, n, dst, k) {
      for (let i = 0; i < n; i++) {
        const tt = t + Math.random() * 0.25;
        noise(white, tt, 0.06, filt('bandpass', rnd(900, 3200), 2, dst), (p) => env(p, tt, 0.001, 0.004, 0.04, rnd(0.3, 0.7) * k));
      }
    }

    // ---- catalogue
    const S = {
      grondement(t, d) {
        throat(t, 2.4, [[0, 40], [0.5, 47], [1.4, 43], [2.4, 33]], 0.9, d, { formants: [[150, 3, 1], [330, 4, 0.6], [700, 6, 0.25]], rough: 0.9, roughF: 22, drive: 2.2, att: 0.35, hold: 1.2, breath: 0.25, breathF: 380 });
        bubbles(t + 0.4, 6, 1.8, d, true);
        return 2.6;
      },
      cri(t, d) {
        // beuglement grave + crissement aigu, gorge distordue, souffle
        throat(t, 2.7, [[0, 52], [0.25, 88], [1.4, 74], [2.7, 44]], 1.0, d, { formants: [[190, 3, 1], [470, 5, 0.8], [1050, 6, 0.4]], rough: 0.8, drive: 3, hard: true, att: 0.14, hold: 1.5, breath: 0.6, breathF: 900, sub: 0.7 });
        throat(t + 0.08, 2.3, [[0, 330], [0.3, 540], [1.2, 470], [2.3, 250]], 0.32, d, { formants: [[1250, 7, 1], [1900, 8, 0.6], [2700, 9, 0.3]], vib: 6.5, vibA: 18, rough: 0.5, roughF: 60, drive: 2.5, att: 0.18, hold: 1.1, sub: 0 });
        noise(white, t, 1.8, filt('bandpass', 950, 0.7, d), (p) => env(p, t, 0.1, 0.9, 0.8, 0.25));
        return 3;
      },
      souffle(t, d) {
        const b = filt('bandpass', 1300, 0.9, d);
        b.frequency.setValueAtTime(1500, t); b.frequency.exponentialRampToValueAtTime(380, t + 1.3);
        const am = ctx.createGain(); am.connect(b);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 17; const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain); lfo.start(t); lfo.stop(t + 1.5);
        noise(white, t, 1.4, am, (p) => env(p, t, 0.15, 0.4, 0.8, 0.7));
        noise(brown, t, 1.4, filt('lowpass', 160, 0.7, d), (p) => env(p, t, 0.2, 0.5, 0.7, 0.8));
        return 1.6;
      },
      bulles(t, d) { bubbles(t, 18, 1.4, d, false); bubbles(t + 0.2, 8, 1.2, d, true); return 1.8; },
      remous(t, d) {
        const lo = filt('lowpass', 300, 0.8, d);
        lo.frequency.setValueAtTime(240, t); lo.frequency.linearRampToValueAtTime(620, t + 1.0); lo.frequency.linearRampToValueAtTime(200, t + 2.6);
        noise(brown, t, 2.8, lo, (p) => env(p, t, 0.8, 0.6, 1.3, 1.2));
        noise(white, t, 2.6, filt('bandpass', 700, 0.5, d), (p) => env(p, t, 0.9, 0.4, 1.2, 0.12));
        return 3;
      },
      eclaboussure(t, d) { splash(t, 1.3, d); return 2.6; },
      retombe(t, d) {
        splash(t, 1.6, d);
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.01, 0.1, 1.4, 0.75); g.connect(d);
        osc('sine', t, 1.6, g, (p) => { p.setValueAtTime(48, t); p.exponentialRampToValueAtTime(26, t + 1.4); });
        S.remous(t + 0.4, d);
        return 3.6;
      },
      impact(t, d) { woodHit(t, 1.2, d); woodHit(t + 0.05, 0.6, d); splash(t + 0.03, 0.8, d); return 1.6; },
      arrache(t, d) {
        for (let i = 0; i < 7; i++) woodHit(t + i * rnd(0.05, 0.13), rnd(0.25, 0.6), d);
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.1, 0.5, 0.5, 0.25); g.connect(filt('bandpass', 380, 4, d));
        osc('sawtooth', t, 1.2, g, (p) => { p.setValueAtTime(70, t); p.linearRampToValueAtTime(96, t + 0.6); p.linearRampToValueAtTime(58, t + 1.1); });
        return 1.6;
      },
      morsure(t, d) {
        noise(white, t, 0.08, filt('bandpass', 2600, 2.5, d), (p) => env(p, t, 0.001, 0.005, 0.07, 1));
        noise(white, t + 0.012, 0.1, filt('bandpass', 850, 2, d), (p) => env(p, t + 0.012, 0.001, 0.01, 0.09, 0.8));
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.002, 0.02, 0.3, 1); g.connect(d);
        osc('sine', t, 0.35, g, (p) => { p.setValueAtTime(120, t); p.exponentialRampToValueAtTime(48, t + 0.3); });
        const sq = filt('bandpass', 420, 1.5, d); sq.frequency.setValueAtTime(700, t + 0.05); sq.frequency.exponentialRampToValueAtTime(260, t + 0.4);
        noise(white, t + 0.05, 0.4, sq, (p) => env(p, t + 0.05, 0.01, 0.05, 0.3, 0.4));
        return 0.8;
      },
      saisie(t, d) { S.morsure(t, d); crunch(t + 0.05, 9, d, 1); throat(t + 0.1, 1.2, [[0, 46], [0.5, 54], [1.2, 40]], 0.5, d, { rough: 1, drive: 2.6, att: 0.06, hold: 0.6 }); return 1.4; },
      secousse(t, d) {
        splash(t, 0.9, d);
        throat(t, 0.9, [[0, 50], [0.4, 62], [0.9, 44]], 0.55, d, { rough: 1, roughF: 18, drive: 2.8, att: 0.05, hold: 0.45 });
        crunch(t + 0.2, 4, d, 0.6);
        return 1.2;
      },
      avale(t, d) {
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.03, 0.1, 0.55, 1.2); g.connect(filt('lowpass', 400, 1, d));
        osc('sine', t, 0.8, g, (p) => { p.setValueAtTime(130, t); p.exponentialRampToValueAtTime(36, t + 0.6); });
        bubbles(t + 0.15, 10, 0.8, d, true);
        noise(brown, t, 1.0, filt('lowpass', 260, 1, d), (p) => env(p, t, 0.05, 0.3, 0.6, 0.9));
        return 1.4;
      },
      plonge(t, d) {
        splash(t, 1.1, d);
        const lo = filt('lowpass', 900, 0.8, d); lo.frequency.setValueAtTime(900, t); lo.frequency.exponentialRampToValueAtTime(120, t + 1.8);
        noise(brown, t, 2.0, lo, (p) => env(p, t, 0.05, 0.4, 1.4, 1.1));
        bubbles(t + 0.4, 12, 1.5, d, true);
        return 2.4;
      },
      douleur(t, d) {
        throat(t, 1.3, [[0, 420], [0.15, 760], [0.6, 640], [1.3, 300]], 0.45, d, { formants: [[1100, 6, 1], [1800, 8, 0.6]], vib: 9, vibA: 30, rough: 0.6, roughF: 70, drive: 3, hard: true, att: 0.03, hold: 0.5, sub: 0 });
        throat(t, 1.1, [[0, 60], [0.2, 92], [1.1, 50]], 0.7, d, { rough: 0.9, drive: 2.5, att: 0.03, hold: 0.4 });
        return 1.5;
      },
      mort(t, d) {
        throat(t, 5.5, [[0, 70], [0.6, 82], [2.5, 50], [5.5, 24]], 0.9, d, { formants: [[160, 3, 1], [360, 4, 0.6], [760, 5, 0.25]], rough: 1, roughF: 14, drive: 2, att: 0.2, hold: 2.8, breath: 0.4, breathF: 420 });
        bubbles(t + 2.5, 22, 3, d, true);
        S.souffle(t + 4.6, d);
        return 6.4;
      },
      // ruée (jeu 2.1.3) : le choc d'un jump scare. Le jeu coupe l'ambiance juste avant ; puis tout part en
      // même temps, sans montée : l'eau qui explose, un coup sourd, un hurlement aigu et un beuglement
      // distordus, un accord strident (seconde mineure, triton) qui glisse vers le bas.
      ruee(t, d) {
        const bb = filt('bandpass', 2600, 0.6, d); bb.frequency.setValueAtTime(3200, t); bb.frequency.exponentialRampToValueAtTime(500, t + 0.8);
        noise(white, t, 0.9, bb, (p) => env(p, t, 0.003, 0.05, 0.75, 0.8));
        noise(brown, t, 1.3, filt('lowpass', 260, 0.8, d), (p) => env(p, t, 0.004, 0.12, 1.0, 0.7));
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.003, 0.04, 0.9, 1.0); g.connect(d);
        osc('sine', t, 1.0, g, (p) => { p.setValueAtTime(74, t); p.exponentialRampToValueAtTime(29, t + 0.85); });
        throat(t + 0.02, 1.5, [[0, 520], [0.1, 880], [0.45, 760], [1.5, 330]], 0.4, d, { formants: [[1350, 6, 1], [2200, 7, 0.6], [3300, 8, 0.3]], vib: 11, vibA: 40, rough: 0.7, roughF: 80, drive: 3.4, hard: true, att: 0.025, hold: 0.55, sub: 0 });
        throat(t + 0.01, 1.9, [[0, 62], [0.12, 112], [0.7, 88], [1.9, 46]], 0.85, d, { formants: [[200, 3, 1], [520, 5, 0.8], [1150, 6, 0.45]], rough: 0.9, drive: 3.4, hard: true, att: 0.03, hold: 0.7, breath: 0.5, breathF: 1100, sub: 0.8 });
        for (const [f, a] of [[1180, 0.14], [1250, 0.12], [1770, 0.09], [590, 0.11]]) {
          const c = ctx.createGain(); c.gain.value = 0; env(c.gain, t, 0.006, 0.18, 0.9, a); c.connect(filt('bandpass', f, 1.2, d));
          osc('sawtooth', t, 1.2, c, (p) => { p.setValueAtTime(f, t); p.exponentialRampToValueAtTime(f * 0.8, t + 1.1); });
        }
        return 2.2;
      },
      // appel lointain (signe) : plainte grave, longue, presque une baleine
      appel(t, d) {
        throat(t, 4.2, [[0, 64], [1.2, 92], [2.6, 78], [4.2, 52]], 0.55, d, { formants: [[210, 4, 1], [520, 6, 0.5]], rough: 0.25, roughF: 9, drive: 1.3, att: 0.9, hold: 1.8, vib: 0.8, vibA: 4, sub: 0.8 });
        return 4.6;
      },
      // coque cognée par en dessous : bois sourd, grincement
      coque(t, d) {
        const g = ctx.createGain(); g.gain.value = 0; env(g.gain, t, 0.006, 0.05, 0.6, 1.2); g.connect(d);
        osc('sine', t, 0.8, g, (p) => { p.setValueAtTime(64, t); p.exponentialRampToValueAtTime(38, t + 0.6); });
        woodHit(t, 0.5, d);
        const c = ctx.createGain(); c.gain.value = 0; env(c.gain, t + 0.1, 0.15, 0.3, 0.4, 0.18); c.connect(filt('bandpass', 520, 5, d));
        osc('sawtooth', t + 0.1, 0.9, c, (p) => { p.setValueAtTime(110, t + 0.1); p.linearRampToValueAtTime(84, t + 0.9); });
        return 1.2;
      },
      // claque de queue à la surface (signe lointain)
      claque(t, d) { splash(t, 1.0, d); woodHit(t, 0.0001, d); return 2.2; },
    };

    // ---- fond d'approche (continu)
    let D = null;
    function droneStart() {
      if (D) return D;
      const t = ctx.currentTime;
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      g.connect(lp); if (pn) { lp.connect(pn); pn.connect(out); } else lp.connect(out);
      const ws = ctx.createGain(); ws.gain.value = 0.3; lp.connect(ws); ws.connect(verb);
      const oscs = [];
      for (const [f, a, type] of [[31, 0.9, 'sine'], [58, 0.25, 'sine'], [61.6, 0.25, 'sine'], [87.5, 0.08, 'triangle']]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); oscs.push(o);
      }
      // pouls lent (cœur de la bête) : modulation du gain du sous-grave
      const pulse = ctx.createGain(); pulse.gain.value = 0.6; g.disconnect(); g.connect(pulse); pulse.connect(lp);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.9; const lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg); lg.connect(pulse.gain); lfo.start(t); oscs.push(lfo);
      const nb = ctx.createBufferSource(); nb.buffer = brown; nb.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 180; const ng = ctx.createGain(); ng.gain.value = 0.7;
      nb.connect(nf); nf.connect(ng); ng.connect(g); nb.start(t); oscs.push(nb);
      D = { g, lp, pn, ws, pulse, lfo, oscs, level: 0 };
      return D;
    }
    function drone(level, o) {
      o = o || {};
      level = clamp(level, 0, 1);
      if (!D && level < 0.01) return;
      const d = droneStart(), t = ctx.currentTime;
      d.level = level;
      d.g.gain.setTargetAtTime(level * level * 0.55, t, 0.6);
      d.lp.frequency.setTargetAtTime(clamp(o.lp || 900, 80, 4000), t, 0.3);
      if (d.pn) d.pn.pan.setTargetAtTime(clamp(o.pan || 0, -1, 1) * 0.6, t, 0.4);
      d.lfo.frequency.setTargetAtTime(0.7 + level * 0.9, t, 1);
    }

    let alive = true;
    const api = {
      names: Object.keys(S),
      play(name, o) {
        if (!alive) return 0;
        const f = S[name];
        if (!f) return 0;
        o = o || {};
        if ((o.gain === undefined ? 1 : o.gain) < 0.005) return 0;
        const C = chain(o);
        let dst = C.input;
        if (o.under) {
          // sous l'eau : les aigus partent, le grave enfle
          const sh = ctx.createBiquadFilter(); sh.type = 'lowshelf'; sh.frequency.value = 180; sh.gain.value = 6;
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(o.lp || 18000, 1100);
          sh.connect(lp); lp.connect(C.input); C.nodes.push(sh, lp); dst = sh;
        }
        const input = dst;
        PITCH = clamp(o.rate || 1, 0.5, 2);
        let dur = 0;
        try { dur = f(ctx.currentTime + 0.01, input); } finally { PITCH = 1; }
        release(C, dur || 3);
        return dur || 0;
      },
      drone,
      setVolume(v) { out.gain.setTargetAtTime(clamp(v, 0, 2), ctx.currentTime, 0.1); },
      dispose() {
        alive = false;
        if (D) { for (const o of D.oscs) { try { o.stop(); } catch (e) { /* rien */ } } D = null; }
        setTimeout(() => { try { out.disconnect(); verb.disconnect(); } catch (e) { /* rien */ } }, 200);
      },
    };
    return api;
  }

  const api = { create, VERSION: '1.1.0' };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.MereVaseAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : undefined);
