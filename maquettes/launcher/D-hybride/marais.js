'use strict';
/* Direction D : fond animé « Marécages maudits » (prévisualisation, 31 octobre 2026).
   Base : une vraie capture du kit 2.0.7 d'Anthony (« 13_la_mere_vase_se_jette_sur_un_noye », vue libre, sans HUD),
   retournée pour que la bête soit à droite, hors du texte. Animés en 2D :
     - l'eau ondule ; le reflet du leurre et celui de la lanterne scintillent (les pixels de la capture) ;
     - le leurre pulse ; les yeux des Noyés au loin luisent et clignent (MA_NOYE.eye, ils clignent) ;
     - la brume de la carte dérive (MA_HFOG.col 0x5a6a62), plus épaisse sous la pluie (MA_WXC.hfK) ;
     - la pluie et l'orage, adaptés en 2D d'après le kit (ma17_pluie.js, ma18_orage.js ; aucun de leurs codes n'est
       exécuté) : traits penchés par le vent, deux plans (proche et lointain), ronds de pluie sur l'eau, intensité qui
       varie sans jamais s'arrêter ; éclairs irréguliers dans les nuages et au sol (canal ramifié, arcs en retour,
       teinte et force tirées au hasard), la scène, la pluie et l'eau s'éclairent.
   Adaptation pour le confort (vertige d'Anthony) : au plus 3 arcs par éclair, espacés d'au moins 140 ms, un éclair
   toutes les 6 à 15 s, éclat plafonné ; aucun mouvement de caméra. Boucle sans coupure : tout est continu.
   Économie : 30 images par seconde au plus ; une image fixe quand l'animation est coupée ; arrêt complet sur demande. */
window.Marais = (function () {
  const IW = 1280, IH = 635, HORIZON = 318;                           // capture d'origine et ligne d'horizon
  // repères relevés dans la capture d'origine (avant retournement)
  const LEURRES = [{ x: 312, y: 194, r: 34, f: 1, ph: 0 }, { x: 379, y: 265, r: 20, f: 0.65, ph: 1.7 }];
  const YEUX = [[728, 358], [763, 382], [732, 414], [1191, 379]];
  const REFLETS = [{ x0: 320, x1: 406, y0: 520, y1: 635, a: 0.2, amp: 3.4 }, { x0: 894, x1: 930, y0: 384, y1: 446, a: 0.14, amp: 2 }];
  const BRUME = '90, 106, 98';
  // pluie et orage (d'après MA_WXC et MA_ORC du kit 2.0.7, ramenés à l'écran)
  const PLUIE = { pente: 0.17, proche: { dens: 2400, len: [16, 30], v: [950, 1180], a: [0.2, 0.42], w: 1.15 }, loin: { dens: 1250, len: [7, 13], v: [540, 720], a: [0.1, 0.24], w: 0.8 } };
  // éclat plafonné à 0,5 : l'éclair se voit sans éblouir (demande d'Anthony : une ambiance sombre, sans excès de lumière)
  const ORAGE = { attente: [8, 18], sol: 0.25, arcs: [2, 3], ecart: [0.14, 0.32], decroit: 0.11, force: [0.75, 1.3], max: 0.5 };

  function hasard(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const entre = (r, [a, b]) => a + (b - a) * r();

  /* Nappe de brume raccordable en largeur (pas de couture quand elle défile). */
  function nappe(seed, w, h, n, amin, amax) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), r = hasard(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = h * (0.25 + 0.5 * r()), rx = w * (0.06 + 0.1 * r()), ry = h * (0.18 + 0.22 * r()), a = amin + (amax - amin) * r();
      for (const dx of [-w, 0, w]) {
        const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
        gr.addColorStop(0, `rgba(${BRUME}, ${a})`); gr.addColorStop(1, `rgba(${BRUME}, 0)`);
        g.save(); g.translate(x + dx, y); g.scale(1, ry / rx); g.translate(-(x + dx), -y);
        g.fillStyle = gr; g.fillRect(x + dx - rx, y - rx, rx * 2, rx * 2); g.restore();
      }
    }
    return c;
  }

  /* Canal d'un éclair : déplacement aléatoire du milieu, branches qui s'arrêtent en l'air (comme ma18). */
  function canal(r, x0, y0, x1, y1, prof, rugo) {
    let pts = [[x0, y0], [x1, y1]];
    for (let n = 0; n < prof; n++) {
      const nv = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
        nv.push([(ax + bx) / 2 + (r() - 0.5) * l * rugo, (ay + by) / 2 + (r() - 0.5) * l * rugo * 0.25], [bx, by]);
      }
      pts = nv;
    }
    return pts;
  }

  function create(canvas, image, opts = {}) {
    const g = canvas.getContext('2d');
    const nappes = [nappe(3, 1024, 200, 26, 0.05, 0.16), nappe(9, 1024, 220, 22, 0.05, 0.13)];
    let W = 0, H = 0, k = 1, ox = 0, oy = 0, actif = false, anim = true, raf = 0, dernier = 0, tPrec = 0;
    const t0 = performance.now(), r = hasard(77);
    const gouttes = { proche: [], loin: [] }, ronds = [];
    let eclair = null, prochain = 3.5, eclairs = opts.eclairs !== false;   // le premier éclair arrive vite (ma18 : 3 à 9 s)
    const cadrage = Object.assign({ hy: 0.5, iy: 318 }, opts.cadrage || {});

    function taille() {
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return false;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      k = Math.max(W / IW, H / IH);
      ox = (W - IW * k) / 2;
      oy = Math.min(0, Math.max(H - IH * k, H * cadrage.hy - cadrage.iy * k));
      // la pluie : un nombre de traits proportionnel à la surface
      for (const [nom, P] of Object.entries({ proche: PLUIE.proche, loin: PLUIE.loin })) {
        const n = Math.round((W * H) / P.dens), L = gouttes[nom], rr = hasard(nom === 'proche' ? 5 : 6);
        L.length = 0;
        for (let i = 0; i < n; i++) L.push({ x: rr() * W, y: rr() * H, len: entre(rr, P.len), v: entre(rr, P.v), a: entre(rr, P.a) });
      }
      return true;
    }
    const X = (x) => ox + (IW - x) * k, Y = (y) => oy + y * k;      // repères d'origine → écran (image retournée)

    function intensite(t) { return 0.72 + 0.18 * Math.sin(t * 0.16) + 0.1 * Math.sin(t * 0.41 + 1.3); }   // jamais nulle

    function eclat(t) {
      if (!eclair) return 0;
      let f = 0;
      for (const a of eclair.arcs) { const u = t - a.t; if (u >= 0 && u < 0.6) f = Math.max(f, a.p * Math.exp(-u / ORAGE.decroit)); }
      return Math.min(ORAGE.max, f);
    }
    function planifier(t, forcerSol) {
      if (eclair && t > eclair.fin) eclair = null;
      if (eclair || t < prochain || !eclairs) return;
      const n = Math.round(entre(r, ORAGE.arcs)), sol = forcerSol || r() < ORAGE.sol, force = entre(r, ORAGE.force);
      const arcs = []; let ta = t;
      for (let i = 0; i < n; i++) { arcs.push({ t: ta, p: (i ? 0.55 + 0.4 * r() : 1) * force * 0.62 }); ta += entre(r, ORAGE.ecart); }
      const cx = W * (0.15 + 0.8 * r()), teinte = r();
      let chemin = null, branches = [];
      if (sol) {
        const xg = W * (0.08 + 0.84 * r()), yg = Y(HORIZON) + 2 + 8 * r();
        chemin = canal(r, cx, -10, xg, yg, 7, 0.42);
        for (let b = 0; b < 3 + Math.floor(r() * 3); b++) {
          const i = 8 + Math.floor(r() * (chemin.length * 0.6)), [bx, by] = chemin[Math.min(i, chemin.length - 1)];
          const l = (yg - by) * (0.25 + 0.35 * r());
          branches.push(canal(r, bx, by, bx + (r() - 0.5) * l * 1.2, by + l, 5, 0.5));
        }
      }
      eclair = { arcs, fin: ta + 0.7, cx, cy: H * (0.05 + 0.15 * r()), chemin, branches, teinte, force };
      prochain = ta + entre(r, ORAGE.attente);
    }

    function dessiner(t, dt) {
      if (!image.complete || !image.naturalWidth) return;
      const I = intensite(t), f = eclat(t);
      g.clearRect(0, 0, W, H);
      // 1. la capture retournée, puis l'eau par tranches décalées (houle lente, plus forte au premier plan)
      g.save(); g.translate(ox + IW * k, oy); g.scale(-k, k);
      g.drawImage(image, 0, 0);
      for (let y = HORIZON; y < IH; y += 2) {
        const p = (y - HORIZON) / (IH - HORIZON);
        const dx = (0.3 + 1.4 * p * p) * Math.sin(y * 0.15 + t * 1.5) + 0.5 * p * Math.sin(y * 0.045 - t * 0.8);
        g.drawImage(image, 0, y, IW, 2, dx, y, IW, 2.6);
      }
      // 2. reflets du leurre et de la lanterne : ils scintillent
      g.globalCompositeOperation = 'lighter';
      for (const R of REFLETS) {
        for (let y = R.y0; y < R.y1; y += 2) {
          const p = (y - R.y0) / (R.y1 - R.y0), dx = (1 + R.amp * p) * Math.sin(y * 0.33 + t * 2.4) + 1.2 * Math.sin(y * 0.09 - t * 1.3);
          g.globalAlpha = (R.a + 0.08 * Math.sin(t * 1.7 + y * 0.05)) * (1 + 1 * f);
          g.drawImage(image, R.x0, y, R.x1 - R.x0, 2, R.x0 + dx, y, R.x1 - R.x0, 2.6);
        }
      }
      g.restore();
      // 3. lueurs : le leurre pulse, les yeux des Noyés luisent et clignent
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const L of LEURRES) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 2.2 + L.ph) * Math.sin(t * 0.7 + L.ph * 2), x = X(L.x), y = Y(L.y), R = L.r * k * 1.4;
        const gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, `rgba(175, 255, 225, ${(0.42 * pulse * L.f).toFixed(3)})`); gr.addColorStop(0.35, `rgba(70, 230, 170, ${(0.2 * pulse * L.f).toFixed(3)})`); gr.addColorStop(1, 'rgba(40, 200, 150, 0)');
        g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
      }
      YEUX.forEach(([ex, ey], i) => {
        const cligne = ((t + i * 1.37) % 5.3) < 0.14 ? 0.1 : 1, x = X(ex), y = Y(ey), R = 7 * Math.max(1, k * 1.2);
        const a = (0.32 + 0.12 * Math.sin(t * 1.3 + i)) * cligne;
        const gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, `rgba(255, 110, 70, ${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(255, 82, 38, 0)');
        g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
      });
      g.restore();
      // 4. éclair au sol : le canal et ses branches (cœur blanc, halo violet), pendant ses arcs
      if (eclair && eclair.chemin && f > 0.02) {
        const col = eclair.teinte < 0.5 ? '232, 228, 255' : '214, 222, 255';
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
        for (const [w, a] of [[8, 0.05], [4, 0.12], [1.5, 0.72]]) {
          g.strokeStyle = `rgba(${col}, ${(a * Math.min(1, f * 1.6)).toFixed(3)})`; g.lineWidth = w;
          for (const ch of [eclair.chemin, ...eclair.branches]) { g.beginPath(); ch.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
          g.lineWidth = w * 0.6;
        }
        const [bx, by] = eclair.chemin[eclair.chemin.length - 1];
        const gr = g.createRadialGradient(bx, by, 0, bx, by, 60);
        gr.addColorStop(0, `rgba(${col}, ${(0.5 * f).toFixed(3)})`); gr.addColorStop(1, `rgba(${col}, 0)`);
        g.fillStyle = gr; g.fillRect(bx - 60, by - 60, 120, 120);
        g.restore();
      }
      // 5. éclat de l'éclair : le ciel s'illumine derrière les nuages, la scène se refroidit d'un coup
      if (f > 0.01) {
        g.save(); g.globalCompositeOperation = 'screen';
        const R = W * 0.75, gr = g.createRadialGradient(eclair.cx, eclair.cy, 0, eclair.cx, eclair.cy, R);
        gr.addColorStop(0, `rgba(226, 230, 255, ${(0.42 * f).toFixed(3)})`); gr.addColorStop(0.5, `rgba(200, 210, 240, ${(0.16 * f).toFixed(3)})`); gr.addColorStop(1, 'rgba(200, 210, 240, 0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, Y(HORIZON) + 40);
        g.fillStyle = `rgba(190, 205, 225, ${(0.07 * f).toFixed(3)})`; g.fillRect(0, 0, W, H);
        g.restore();
      }
      // 6. brume de la carte (plus épaisse sous la pluie), qui dérive avec le vent
      const largeur = W * 1.25;
      for (const [n, v, y, h, a] of [[nappes[0], (t * 9) % 1024, Y(HORIZON) - 75 * k, 160 * k, 0.95], [nappes[1], (t * 15) % 1024, Y(HORIZON) + 20 * k, 180 * k, 0.75]]) {
        g.globalAlpha = a * (0.85 + 0.3 * I) * (1 + 0.4 * f);
        const x0 = -v * (largeur / 1024);
        g.drawImage(n, x0, y, largeur, h); g.drawImage(n, x0 + largeur, y, largeur, h);
      }
      g.globalAlpha = 1;
      // 7. ronds de pluie sur l'eau (plus grands au premier plan)
      const yh = Y(HORIZON) + 6;
      if (dt > 0) {
        let n = 46 * I * dt + Math.random();
        while (n-- >= 1) { const y = yh + (H - yh) * Math.pow(Math.random(), 0.7); ronds.push({ x: Math.random() * W, y, t0: t, d: 0.55 + 0.35 * Math.random() }); }
      }
      g.save(); g.lineWidth = 1;
      for (let i = ronds.length - 1; i >= 0; i--) {
        const o = ronds[i], u = (t - o.t0) / o.d;
        if (u > 1 || u < 0) { if (u > 1) ronds.splice(i, 1); continue; }
        const p = (o.y - yh) / (H - yh), rx = (1.5 + 9 * p) * (0.3 + u);
        g.strokeStyle = `rgba(200, 222, 214, ${((0.3 + 0.4 * f) * (1 - u)).toFixed(3)})`;
        g.beginPath(); g.ellipse(o.x, o.y, rx, rx * 0.28, 0, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
      // 8. la pluie : deux plans de traits penchés par le vent, éclairés d'un coup par l'éclair
      g.save(); g.lineCap = 'round';
      for (const [nom, P] of [['loin', PLUIE.loin], ['proche', PLUIE.proche]]) {
        const L = gouttes[nom];
        for (const d of L) {
          if (dt > 0) { d.y += d.v * dt; d.x += d.v * PLUIE.pente * dt; if (d.y - d.len > H) { d.y -= H + d.len; d.x = Math.random() * W; } if (d.x > W) d.x -= W; }
        }
        // trois paquets d'opacité : trois tracés par plan
        for (const [a0, a1] of [[0, 0.33], [0.33, 0.66], [0.66, 1.01]]) {
          const am = P.a[0] + (P.a[1] - P.a[0]) * (a0 + a1) / 2;
          g.strokeStyle = `rgba(${f > 0.05 ? '235, 240, 255' : '205, 218, 214'}, ${Math.min(0.8, am * I * (1 + 1.6 * f)).toFixed(3)})`;
          g.lineWidth = P.w; g.beginPath();
          L.forEach((d, i) => { const q = (i % 97) / 97; if (q < a0 || q >= a1) return; g.moveTo(d.x, d.y); g.lineTo(d.x - d.len * PLUIE.pente, d.y - d.len); });
          g.stroke();
        }
      }
      g.restore();
    }

    function boucle(ts) {
      if (!actif || !anim) { raf = 0; return; }
      raf = requestAnimationFrame(boucle);
      if (ts - dernier < 33) return;                                   // 30 images par seconde au plus
      const t = (ts - t0) / 1000, dt = tPrec ? Math.min(0.1, t - tPrec) : 0;
      dernier = ts; tPrec = t;
      const avant = eclair;
      planifier(t);
      dessiner(t, dt);
      // les sons de l'ambiance (ambiance.js) : l'intensité de la pluie qu'on voit, et chaque nouvel éclair (son endroit)
      if (opts.ecoute) {
        opts.ecoute.intensite(intensite(t));
        if (eclair && eclair !== avant) opts.ecoute.eclair({ sol: !!eclair.chemin, force: eclair.force, x: (eclair.chemin ? eclair.chemin[eclair.chemin.length - 1][0] : eclair.cx) / W });
      }
    }
    function relancer() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!taille()) return;
      tPrec = 0;
      if (actif && anim) raf = requestAnimationFrame(boucle);
      else {                                                           // image fixe de secours : pluie figée, sans éclair
        eclair = null; ronds.length = 0;
        const rr = hasard(13), yh = Y(HORIZON) + 6;
        for (let i = 0; i < 26; i++) ronds.push({ x: rr() * W, y: yh + (H - yh) * Math.pow(rr(), 0.7), t0: -rr() * 0.6, d: 0.8 });
        dessiner(0, 0);
      }
    }
    if (!image.complete) image.addEventListener('load', relancer, { once: true });
    new ResizeObserver(relancer).observe(canvas);
    return {
      /* actif : l'accueil est visible et la fenêtre ouverte ; anim : animations permises (réglages) */
      regler(o) {
        if (o.eclairs !== undefined && o.eclairs !== eclairs) { eclairs = o.eclairs; if (!eclairs) eclair = null; }
        const a = o.actif !== undefined ? o.actif : actif, b = o.anim !== undefined ? o.anim : anim;
        if (a === actif && b === anim && raf) return;
        actif = a; anim = b; relancer();
      },
      enCours: () => !!raf,
      /* pour les essais des sons : un éclair à la prochaine image (s'ils sont permis) */
      provoquer() { if (eclair) eclair.fin = -1; prochain = 0; },
      /* pour les essais de la chaîne vidéo : avance de dt secondes et dessine (pluie et éclairs en mouvement) */
      pas(t, dt) { if (!W && !taille()) return; planifier(t); dessiner(t, dt); },
      /* pour les captures : une image à l'instant t, avec ou sans éclair */
      image(t, avecEclair) {
        if (!taille()) return;
        eclair = null; prochain = 1e9;
        if (avecEclair) { prochain = 0; planifier(t, true); prochain = 1e9; t = eclair.arcs[0].t + 0.03; }
        dessiner(t, 0);
      },
    };
  }
  return { create };
})();
