/*
 * mere-vase.js — « La Mère-Vase », monstre des Marécages Maudits (Zombie Survival), pour Three.js, sans fichier externe.
 * Silure-salamandre géant d'environ 18 m : tête plate de 4 m, six yeux laiteux, barbillons à bulbes lumineux qui
 * servent de leurres dans le brouillard, mâchoire inférieure fendue en deux demi-mandibules, branchies externes,
 * quatre pattes palmées à griffes, queue en ruban. Créature originale.
 * Compatible Three.js r128 (artefacts Claude, version du jeu) et les versions récentes. Tout est généré en code :
 * maillage (lofts + pièces), squelette, poids, textures (canvas), animations procédurales mélangées.
 *
 * Utilisation :
 *   const mv = MereVase.create(THREE, { renderer, quality: 'high' });   // 'low' | 'medium' | 'high'
 *   scene.add(mv.object);                        // repère : mètres, Y en haut, avant = +Z, gauche = +X,
 *                                                //  origine = milieu du dos (bassin avant), axe du corps à y = 0
 *   mv.play('nage');                             // voir MereVase.CLIPS ; fondu enchaîné automatique
 *   mv.drive({ speed, turn });                   // nage pilotée par l'IA : m/s, rad/s (+ = vers la gauche)
 *   mv.look.glow, mv.look.wet                    // lisibilité de nuit : lueurs (×, 1 par défaut), peau mouillée (0 à 1)
 *                                                //  (aussi en options de create : { glow: 1.6, wet: 0.7 })
 *   mv.update(dt);                               // une fois par image
 *   mv.anchors : mouth, bite, throat, eyeL, eyeR, lureL, lureR, chest, tail, clawL, clawR (Object3D)
 *   mv.hitTest(ox,oy,oz, dx,dy,dz, maxT)         // → { t, part, mult } ou null (capsules sur les os)
 *   mv.on('event', fn)                           // repères synchronisés des clips (saisie, morsure, avale…)
 *   mv.setWater(y)                               // hauteur de l'eau (teinte trouble sous la surface)
 *   mv.dispose()
 */
(function (root) {
  'use strict';

  // ============================================================================================
  // Outils
  // ============================================================================================
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  const sgnPow = (x, p) => (x < 0 ? -Math.pow(-x, p) : Math.pow(x, p));
  const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

  // Générateur pseudo-aléatoire reproductible (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bruit de gradient 3D (Perlin amélioré), table de permutation figée par une graine
  function makeNoise(seed) {
    const R = rng(seed), p = new Uint8Array(512);
    const perm = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    function grad(h, x, y, z) {
      const u = (h & 15) < 8 ? x : y, v = (h & 15) < 4 ? y : (h & 15) === 12 || (h & 15) === 14 ? x : z;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }
    function n3(x, y, z) {
      const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
      x -= X; y -= Y; z -= Z;
      const xi = X & 255, yi = Y & 255, zi = Z & 255;
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[xi] + yi, AA = p[A] + zi, AB = p[A + 1] + zi, B = p[xi + 1] + yi, BA = p[B] + zi, BB = p[B + 1] + zi;
      const l1 = lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u);
      const l2 = lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u);
      const l3 = lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u);
      const l4 = lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u);
      return lerp(lerp(l1, l2, v), lerp(l3, l4, v), w);
    }
    function fbm(x, y, z, oct, gain, lac) {
      let a = 0.5, s = 0, f = 1;
      for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); f *= lac || 2.03; a *= gain || 0.5; }
      return s;
    }
    return { n3, fbm };
  }
  const N = makeNoise(1957);

  // Courbes de profil : liste [s, valeur] interpolée par Catmull-Rom (s croissant)
  function curve(pts) {
    return function (s) {
      if (s <= pts[0][0]) return pts[0][1];
      const n = pts.length;
      if (s >= pts[n - 1][0]) return pts[n - 1][1];
      let i = 0;
      while (i < n - 2 && s > pts[i + 1][0]) i++;
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const t = (s - p1[0]) / (p2[0] - p1[0]);
      const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]);
      const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
    };
  }

  // ============================================================================================
  // Proportions. s = abscisse le long du corps, 0 au museau, 1 au bout de la queue (LEN mètres).
  // Repère : avant +Z ; le museau est à z = Z0, la queue à z = Z0 - LEN ; l'axe du dos au repos est y = 0.
  // ============================================================================================
  const LEN = 18, Z0 = 7.74;                // origine du repère à s = 0.43 (milieu du dos)
  const SJ = 0.165;                          // charnière de la mâchoire (3 m derrière le museau)
  const zOf = (s) => Z0 - LEN * s;
  const W0 = curve([[0, 1.62], [0.03, 1.86], [0.07, 2.04], [0.11, 2.07], [0.15, 1.96], [0.19, 1.8], [0.24, 1.74],
    [0.32, 1.86], [0.42, 1.92], [0.5, 1.82], [0.58, 1.6], [0.65, 1.3], [0.72, 1.0], [0.8, 0.74], [0.88, 0.48],
    [0.95, 0.26], [1, 0.1]]);
  const H0 = curve([[0, 0.42], [0.03, 0.5], [0.07, 0.58], [0.11, 0.66], [0.15, 0.76], [0.19, 0.88], [0.24, 1.0],
    [0.32, 1.12], [0.42, 1.18], [0.5, 1.14], [0.58, 1.04], [0.65, 0.94], [0.72, 0.84], [0.8, 0.74], [0.88, 0.6],
    [0.95, 0.44], [1, 0.2]]);
  const YC = curve([[0, -0.2], [0.08, -0.17], [0.16, -0.1], [0.24, 0.0], [0.34, 0.06], [0.46, 0.04], [0.6, 0.0],
    [0.8, 0.04], [1, 0.08]]);
  const NEXP = curve([[0, 3.2], [0.12, 3.0], [0.2, 2.5], [0.4, 2.35], [0.62, 2.2], [0.8, 2.0], [1, 2.0]]);
  // arrondi du museau et de la pointe de la queue (le contour se referme sur un point)
  const roundFront = (s) => Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, s / 0.06), 2)));
  const roundTail = (s) => Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, (1 - s) / 0.025), 2)));
  const widthAt = (s) => W0(s) * roundFront(s) * roundTail(s);
  const heightAt = (s) => H0(s) * (0.35 + 0.65 * roundFront(s)) * roundTail(s);
  const mouthY = (s) => YC(s) - 0.1 * heightAt(s);   // ligne des lèvres
  const ALPHA = Math.asin(0.1);                      // angle du coin des lèvres sous l'équateur

  // Os de la colonne : abscisses (le premier est la tête, rigide jusqu'au museau)
  const SPINE_S = [0.1, 0.17, 0.235, 0.3, 0.365, 0.43, 0.495, 0.56, 0.625, 0.69, 0.75, 0.81, 0.865, 0.915, 0.96, 1.0];
  const ROOT_K = 5;                                   // os de référence (origine du repère)

  // ============================================================================================
  // Textures procédurales (canvas). Coordonnées : u = s (long du corps), v = angle autour / 2π
  // (v = 0 : flanc gauche, 0,25 : dos, 0,5 : flanc droit, 0,75 : ventre).
  // ============================================================================================
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Taches circulaires dures (verrues, pores, sangsues) : liste précalculée, rendue dans une carte de hauteur
  function scatter(R, n, fn) { const out = []; for (let i = 0; i < n; i++) out.push(fn(R)); return out; }

  function makeSkinTextures(THREE, q) {
    const W = q === 'high' ? 2048 : q === 'medium' ? 1024 : 512, H = W / 2;
    const R = rng(77);
    const height = new Float32Array(W * H);
    const albedo = new Uint8ClampedArray(W * H * 4);
    const rough = new Uint8ClampedArray(W * H * 4);
    const glow = new Uint8ClampedArray(W * H * 4);
    const L = LEN, CIRC = 9.6;                         // mètres le long du corps et autour (ordre de grandeur)
    // verrues et cloques (dos, tête), en mètres dans le plan (u·L, v·CIRC)
    const warts = scatter(R, Math.round(W * 1.2), (r) => {
      const u = r(), back = r() < 0.75;
      const v = back ? 0.1 + r() * 0.3 : r();
      return { u, v, rad: 0.02 + 0.06 * r() * r(), h: 0.3 + 0.5 * r(), seed: r() * 100 };
    });
    const leeches = scatter(R, 70, (r) => ({ u: 0.18 + r() * 0.7, v: r() < 0.5 ? 0.02 + r() * 0.14 : 0.36 + r() * 0.14,
      a: r() * TAU, l: 0.09 + r() * 0.08 }));
    const scars = scatter(R, 9, (r) => ({ u: 0.15 + r() * 0.6, v: 0.05 + r() * 0.4, a: (r() - 0.5) * 1.2,
      l: 0.5 + r() * 1.4, w: 0.025 + r() * 0.03, bend: (r() - 0.5) * 0.8 }));
    const cyl = (u, v, f) => [u * L * f, Math.cos(v * TAU) * CIRC / TAU * f, Math.sin(v * TAU) * CIRC / TAU * f];
    // 1) hauteur : plis des flancs, rides fines, verrues
    for (let j = 0; j < H; j++) {
      const v = (j + 0.5) / H;
      const vy = Math.sin(v * TAU);                     // +1 dos, -1 ventre
      const flank = Math.exp(-Math.pow(Math.cos(v * TAU) * 0 + Math.abs(vy) / 0.32, 2) * 1.0);   // près de l'équateur
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W;
        const [x, y, z] = cyl(u, v, 1);
        let hgt = 0;
        // plis verticaux de peau le long des flancs (salamandre géante), ondulés
        const foldBand = flank * smooth(0.17, 0.24, u) * (1 - smooth(0.66, 0.76, u));
        if (foldBand > 0.01) {
          const ph = u * L * 2.6 + 0.9 * N.n3(x * 0.4, y * 0.6, z * 0.6) + 0.25 * vy * 6;
          hgt += foldBand * (0.55 * Math.pow(0.5 + 0.5 * Math.sin(ph * TAU), 3) - 0.18);
        }
        // grandes rides transversales du ventre
        const belly = smooth(0.0, -0.75, vy);
        if (belly > 0.01) hgt += belly * (0.06 + 0.16 * smooth(0.16, 0.26, u)) * Math.sin((u * L * 3.4 + 0.6 * N.n3(x, y, z)) * TAU);
        // rides fines et grain
        hgt += 0.22 * N.fbm(x * 3.1, y * 3.1, z * 3.1, 3);
        hgt += 0.08 * N.n3(x * 14, y * 14, z * 14);
        height[j * W + i] = hgt;
      }
    }
    // verrues (somme de bosses lissées)
    for (const w of warts) {
      const cx = w.u * W, cy = w.v * H, rx = (w.rad / L) * W, ry = (w.rad / CIRC) * H;
      const x0 = Math.floor(cx - rx * 1.5), x1 = Math.ceil(cx + rx * 1.5), y0 = Math.floor(cy - ry * 1.5), y1 = Math.ceil(cy + ry * 1.5);
      for (let y = y0; y <= y1; y++) {
        const jj = ((y % H) + H) % H;
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || x >= W) continue;
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          const d = Math.hypot(dx, dy) * (1 + 0.38 * N.n3(dx * 1.4 + w.seed, dy * 1.4, w.seed));
          if (d < 1.4) height[jj * W + x] += w.h * 0.5 * Math.pow(Math.max(0, 1 - d * d / 1.96), 1.6);
        }
      }
    }
    // 2) couleur, rugosité, lueur
    for (let j = 0; j < H; j++) {
      const v = (j + 0.5) / H;
      const vy = Math.sin(v * TAU), vx = Math.cos(v * TAU);
      const back = smooth(0.15, 0.9, vy), belly = smooth(-0.15, -0.8, vy);
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W;
        const [x, y, z] = cyl(u, v, 1);
        const blot = N.fbm(x * 0.55, y * 0.55, z * 0.55, 4);
        const blot2 = N.fbm(x * 1.7 + 11, y * 1.7, z * 1.7, 3);
        const head = 1 - smooth(0.12, 0.2, u);
        // teintes (sRGB 0..255) : dos olive-noir, flancs olive-tourbe, ventre gris-jaune sale
        let r = 44, g = 45, b = 32;
        if (blot > 0.06) { const k = smooth(0.06, 0.22, blot); r = lerp(r, 66, k); g = lerp(g, 52, k); b = lerp(b, 33, k); }   // tourbe
        if (blot2 < -0.1) { const k = smooth(-0.1, -0.3, blot2); r = lerp(r, 24, k); g = lerp(g, 27, k); b = lerp(b, 20, k); }
        r = lerp(r, 28, back * 0.5); g = lerp(g, 30, back * 0.5); b = lerp(b, 22, back * 0.5);
        const bc = 0.85 + 0.15 * N.n3(x * 4, y * 4, z * 4);
        const bk = belly * (0.55 + 0.45 * smooth(0.14, 0.3, u));
        r = lerp(r, 96 * bc, bk); g = lerp(g, 90 * bc, bk); b = lerp(b, 70 * bc, bk);
        // mouchetures pâles sur les flancs et le ventre
        const speck = N.n3(x * 9.5, y * 9.5, z * 9.5);
        if (speck > 0.52) { const k = smooth(0.52, 0.68, speck) * (0.2 + 0.8 * (1 - back)); r = lerp(r, 104, k * 0.4); g = lerp(g, 100, k * 0.4); b = lerp(b, 80, k * 0.4); }
        // tête plus sombre, lèvres pâles (près de l'équateur à l'avant)
        r = lerp(r, r * 0.8, head * back); g = lerp(g, g * 0.8, head * back); b = lerp(b, b * 0.8, head * back);
        const lip = head * Math.exp(-Math.pow(Math.abs(vy + 0.1) / 0.06, 2));
        r = lerp(r, 112, lip * 0.7); g = lerp(g, 96, lip * 0.7); b = lerp(b, 80, lip * 0.7);
        // algues sur le dos
        const alg = N.fbm(x * 1.3 + 40, y * 1.3, z * 1.3, 4) + 0.12 * back - 0.12;
        let rg = 0.5 + 0.12 * blot2;
        if (alg > 0.12 && back > 0.35) { const k = smooth(0.12, 0.3, alg) * back * 0.7; r = lerp(r, 40, k); g = lerp(g, 52, k); b = lerp(b, 28, k); rg = lerp(rg, 0.82, k); }
        // creux des verrues plus sombres, sommets plus clairs (lecture du relief)
        const hv = height[j * W + i];
        const shade = clamp(1 + hv * 0.22, 0.75, 1.25);
        r *= shade; g *= shade; b *= shade;
        const k = (j * W + i) * 4;
        albedo[k] = r; albedo[k + 1] = g; albedo[k + 2] = b; albedo[k + 3] = 255;
        rough[k] = rough[k + 1] = rough[k + 2] = clamp(255 * (rg + 0.08 * N.n3(x * 6, y * 6, z * 6) + belly * 0.1 + clamp(hv, 0, 1) * 0.16), 0, 255); rough[k + 3] = 255;
        // ligne latérale : pores luminescents faibles sur les deux flancs
        let gl = 0;
        const lateral = Math.exp(-Math.pow(vy / 0.035, 2)) * smooth(0.18, 0.24, u) * (1 - smooth(0.9, 0.97, u));
        if (lateral > 0.05) {
          const pore = 0.5 + 0.5 * Math.cos((u * L * 6.5) * TAU);
          gl = lateral * Math.pow(pore, 18);
        }
        glow[k] = gl * 120; glow[k + 1] = gl * 255; glow[k + 2] = gl * 190; glow[k + 3] = 255;
      }
    }
    // cicatrices pâles (rosâtres) : traits courbes
    for (const sc of scars) {
      const steps = 60;
      for (let n = 0; n <= steps; n++) {
        const t = n / steps - 0.5;
        const a = sc.a + sc.bend * t;
        const pu = sc.u + (Math.cos(a) * sc.l * t) / L, pv = sc.v + (Math.sin(a) * sc.l * t) / CIRC;
        const cx = pu * W, cy = pv * H, rx = (sc.w / L) * W * (1 - Math.abs(t) * 1.4), ry = (sc.w / CIRC) * H * 2;
        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
          const jj = ((y % H) + H) % H;
          for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
            if (x < 0 || x >= W) continue;
            const d = Math.hypot((x - cx) / Math.max(0.5, rx), (y - cy) / Math.max(0.5, ry));
            if (d > 1) continue;
            const k = (jj * W + x) * 4, m = (1 - d) * 0.55;
            albedo[k] = lerp(albedo[k], 98, m); albedo[k + 1] = lerp(albedo[k + 1], 84, m); albedo[k + 2] = lerp(albedo[k + 2], 74, m);
            height[jj * W + x] -= 0.45 * m;
            rough[k] = rough[k + 1] = rough[k + 2] = lerp(rough[k], 150, m);
          }
        }
      }
    }
    // sangsues : ovales sombres bordeaux, en relief
    for (const lc of leeches) {
      const cx = lc.u * W, cy = lc.v * H, ca = Math.cos(lc.a), sa = Math.sin(lc.a);
      const lx = (lc.l / L) * W, ly = (lc.l / CIRC) * H;
      for (let y = Math.floor(cy - ly - 2); y <= cy + ly + 2; y++) {
        const jj = ((y % H) + H) % H;
        for (let x = Math.floor(cx - lx - 2); x <= cx + lx + 2; x++) {
          if (x < 0 || x >= W) continue;
          const dx = (x - cx) / Math.max(1, lx), dy = (y - cy) / Math.max(1, ly);
          const a = dx * ca + dy * sa, b2 = -dx * sa + dy * ca;
          const d = Math.hypot(a, b2 * 2.6);
          if (d > 1) continue;
          const k = (jj * W + x) * 4, m = 1 - d * d;
          albedo[k] = lerp(albedo[k], 46, m); albedo[k + 1] = lerp(albedo[k + 1], 20, m); albedo[k + 2] = lerp(albedo[k + 2], 22, m);
          height[jj * W + x] += 0.8 * m;
          rough[k] = rough[k + 1] = rough[k + 2] = lerp(rough[k], 50, m);
        }
      }
    }
    // 3) carte de normales depuis la hauteur (différences finies, v se referme)
    const nrm = new Uint8ClampedArray(W * H * 4);
    const sx = 2.4, sy = 2.4;
    for (let j = 0; j < H; j++) {
      const jp = (j + 1) % H, jm = (j - 1 + H) % H;
      for (let i = 0; i < W; i++) {
        const ip = Math.min(W - 1, i + 1), im = Math.max(0, i - 1);
        const dx = (height[j * W + ip] - height[j * W + im]) * sx;
        const dy = (height[jp * W + i] - height[jm * W + i]) * sy;
        const l = Math.hypot(dx, dy, 1);
        const k = (j * W + i) * 4;
        nrm[k] = (-dx / l * 0.5 + 0.5) * 255; nrm[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[k + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[k + 3] = 255;
      }
    }
    const toTex = (data, srgb) => {
      const c = canvas(W, H), cx = c.getContext('2d');
      cx.putImageData(new ImageData(data, W, H), 0, 0);
      const t = new THREE.CanvasTexture(c); t.flipY = false;
      t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      if (srgb && THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      if (srgb && t.colorSpace !== undefined && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    return { map: toTex(albedo, true), normalMap: toTex(nrm, false), roughnessMap: toTex(rough, false), emissiveMap: toTex(glow, true) };
  }

  // Intérieur de la gueule. u < 0.5 : palais (crêtes transversales) ; u ≥ 0.5 : plancher, langue et
  // membrane gulaire (plis longitudinaux souples, marbrures). Dans chaque moitié, la profondeur
  // locale (0 lèvres → 1 gorge) assombrit la chair. v = travers.
  function makeMouthTextures(THREE, q) {
    const W = q === 'high' ? 512 : 256, H = W;
    const col = new Uint8ClampedArray(W * H * 4), nrm = new Uint8ClampedArray(W * H * 4), hgt = new Float32Array(W * H);
    for (let j = 0; j < H; j++) {
      const v = j / H;
      for (let i = 0; i < W; i++) {
        const u = i / W, floor = u >= 0.5, d = floor ? (u - 0.5) * 2 : u * 2;
        const n = N.fbm(u * 8, v * 8, 3.3, 3), n2 = N.fbm(u * 3, v * 3, 8.1, 3);
        let h, r, g, b;
        if (!floor) {
          const ridge = Math.pow(0.5 + 0.5 * Math.sin((d * 13 + 0.9 * Math.sin(v * 11) + 0.5 * N.n3(d * 9, v * 9, 2.1)) * TAU), 3);
          const mid = Math.exp(-Math.pow((v - 0.5) / 0.04, 2));            // sillon médian du palais
          h = ridge * 0.55 * (1 - mid) - mid * 0.6 + n * 0.45;
          r = lerp(84, 20, smooth(0.25, 1, d)); g = lerp(44, 11, smooth(0.25, 1, d)); b = lerp(50, 15, smooth(0.25, 1, d));
          r *= 0.88 + 0.2 * ridge; g *= 0.9 + 0.12 * ridge; b *= 0.9 + 0.12 * ridge;
        } else {
          const fold = Math.pow(0.5 + 0.5 * Math.sin((v * 17 + 0.6 * N.n3(d * 4, v * 4, 5.2)) * TAU), 2);
          h = fold * 0.12 + n * 0.45;
          r = lerp(58, 14, smooth(0.15, 1, d)); g = lerp(30, 9, smooth(0.15, 1, d)); b = lerp(38, 12, smooth(0.15, 1, d));
          // marbrures grisâtres et petites veines
          const mar = smooth(0.05, 0.3, n2);
          r = lerp(r, r * 0.7 + 14, mar * 0.6); g = lerp(g, g * 0.8 + 10, mar * 0.6); b = lerp(b, b * 0.8 + 14, mar * 0.6);
          const vein = Math.pow(Math.max(0, 1 - Math.abs(N.n3(d * 10, v * 10, 4.4)) * 9), 3);
          r = lerp(r, 96, vein * 0.5 * (1 - d)); g = lerp(g, 22, vein * 0.5 * (1 - d)); b = lerp(b, 30, vein * 0.5 * (1 - d));
        }
        r += n * 14; g += n * 6; b += n * 7;
        hgt[j * W + i] = h;
        const k = (j * W + i) * 4;
        col[k] = r; col[k + 1] = g; col[k + 2] = b; col[k + 3] = 255;
      }
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const dx = (hgt[j * W + Math.min(W - 1, i + 1)] - hgt[j * W + Math.max(0, i - 1)]) * 3;
      const dy = (hgt[Math.min(H - 1, j + 1) * W + i] - hgt[Math.max(0, j - 1) * W + i]) * 3;
      const l = Math.hypot(dx, dy, 1), k = (j * W + i) * 4;
      nrm[k] = (-dx / l * 0.5 + 0.5) * 255; nrm[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[k + 2] = (0.5 / l + 0.5) * 255; nrm[k + 3] = 255;
    }
    const toTex = (data, srgb) => {
      const c = canvas(W, H); c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
      const t = new THREE.CanvasTexture(c); t.flipY = false;
      t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
      if (srgb && THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      return t;
    };
    return { map: toTex(col, true), normalMap: toTex(nrm, false) };
  }

  // Bulbe lumineux : cœur plus vif, veinules sombres, extrémités ternes (u = le long du bulbe, v = autour)
  function makeLureTexture(THREE) {
    const W = 128, H = 64, d = new Uint8ClampedArray(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H, k = (j * W + i) * 4;
      const core = Math.exp(-Math.pow((u - 0.58) / 0.24, 2));
      const vein = Math.pow(Math.max(0, 1 - Math.abs(N.n3(u * 9, Math.cos(v * TAU) * 2, Math.sin(v * TAU) * 2)) * 7), 2);
      const spot = smooth(0.25, 0.45, N.n3(u * 14, Math.cos(v * TAU) * 4, Math.sin(v * TAU) * 4));
      const e = clamp(core * (1 - 0.65 * vein) * (0.75 + 0.25 * spot), 0, 1);
      d[k] = 255 * e * 0.85; d[k + 1] = 255 * e; d[k + 2] = 255 * e * 0.9; d[k + 3] = 255;
    }
    const c = canvas(W, H); c.getContext('2d').putImageData(new ImageData(d, W, H), 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = false;
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Membranes (branchies plumeuses, nageoire de la queue) : couleur + masque alpha (découpe)
  function makeMembraneTexture(THREE, kind) {
    const W = 256, H = 256, d = new Uint8ClampedArray(W * H * 4);
    for (let j = 0; j < H; j++) {
      const v = j / H;
      for (let i = 0; i < W; i++) {
        const u = i / W, k = (j * W + i) * 4;
        let r, g, b, a = 255;
        if (kind === 'gill') {
          // filaments : rayures fines le long de u, bout effiloché (u → 1)
          const fil = 0.5 + 0.5 * Math.sin(v * 46 * TAU + Math.sin(u * 7) * 1.5);
          const edge = u + 0.12 * N.n3(v * 30, u * 3, 1.7);
          a = fil > 0.22 && edge < 0.97 ? 255 : 0;
          const tip = smooth(0.4, 1, u);
          r = lerp(70, 168, tip) * (0.8 + 0.2 * fil); g = lerp(20, 70, tip) * (0.8 + 0.2 * fil); b = lerp(36, 92, tip) * (0.8 + 0.2 * fil);
        } else {
          // nageoire : rayons + membrane tachée, bord déchiqueté, trous
          const ray = Math.pow(0.5 + 0.5 * Math.cos(u * 34 * TAU), 6);
          const edge = v + 0.1 * N.fbm(u * 18, v * 2, 5.5, 3) + 0.05 * Math.sin(u * 60);
          const hole = N.fbm(u * 9, v * 9, 9.1, 3);
          a = edge < 0.93 && hole < 0.32 ? 255 : 0;
          const n = N.fbm(u * 6, v * 6, 2.2, 3);
          r = lerp(46, 62, n + 0.5) + ray * 20; g = lerp(48, 58, n + 0.5) + ray * 16; b = lerp(34, 40, n + 0.5) + ray * 10;
          const tip = smooth(0.5, 0.95, v); r = lerp(r, 84, tip * 0.5); g = lerp(g, 70, tip * 0.5); b = lerp(b, 58, tip * 0.5);
        }
        d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = a;
      }
    }
    const c = canvas(W, H); c.getContext('2d').putImageData(new ImageData(d, W, H), 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Œil laiteux : iris trouble verdâtre, fente verticale, sclère assombrie vers le bord (fondu dans la
  // paupière), veinules. Sert aussi de carte d'émission (seul le laiteux luit).
  function makeEyeTexture(THREE) {
    const W = 128, H = 128, d = new Uint8ClampedArray(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H, k = (j * W + i) * 4;
      // u = longitude (0..1 autour), v = latitude (0 pôle avant regard → 1)
      const fr = v;
      const slitW = 0.02 + 0.012 * (1 - smooth(0, 0.25, fr));
      const slit = Math.exp(-Math.pow(Math.sin((u - 0.25) * TAU) * fr / slitW, 2)) * (1 - smooth(0.16, 0.3, fr));
      const n = N.fbm(u * 12, v * 12, 7.7, 3);
      const fib = 0.5 + 0.5 * Math.sin(u * TAU * 38 + n * 3);                    // fibres radiales de l'iris
      let r = 128 + n * 24 + fib * 10, g = 136 + n * 22 + fib * 10, b = 98 + n * 16;
      const ringK = Math.exp(-Math.pow((fr - 0.27) / 0.035, 2));               // liseré sombre de l'iris
      r = lerp(r, 70, ringK * 0.6); g = lerp(g, 76, ringK * 0.6); b = lerp(b, 52, ringK * 0.6);
      const outer = smooth(0.3, 0.6, fr);
      r = lerp(r, 46, outer); g = lerp(g, 46, outer); b = lerp(b, 34, outer);
      const vein = Math.pow(Math.max(0, N.n3(u * 30, v * 30, 1.1)), 2) * smooth(0.3, 0.55, fr) * (1 - outer * 0.6);
      r = lerp(r, 110, vein); g = lerp(g, 40, vein); b = lerp(b, 36, vein);
      r = lerp(r, 10, slit); g = lerp(g, 12, slit); b = lerp(b, 8, slit);
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
    }
    const c = canvas(W, H); c.getContext('2d').putImageData(new ImageData(d, W, H), 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = false;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Halo additif (bulbes des barbillons)
  function makeGlowTexture(THREE) {
    const c = canvas(64, 64), cx = c.getContext('2d');
    const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(200,255,230,0.55)');
    g.addColorStop(0.55, 'rgba(120,255,200,0.12)'); g.addColorStop(1, 'rgba(80,200,160,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // ============================================================================================
  // Constructeur de maillage skinné : sommets + poids (4 os max), groupes de matériaux,
  // normales lissées par groupe de lissage (soudure par position).
  // ============================================================================================
  const GROUPS = ['skin', 'mouth', 'teeth', 'eyes', 'gill', 'fin', 'lure'];
  function Builder() {
    this.pos = []; this.uv = []; this.col = []; this.si = []; this.sw = []; this.sg = [];
    this.idx = {}; for (const g of GROUPS) this.idx[g] = [];
    this.n = 0;
  }
  // bw : [[os, poids], …] (normalisés ici) ; sg : groupe de lissage (entier) ; c : couleur [r,g,b] linéaire
  Builder.prototype.v = function (x, y, z, u, v, bw, sg, c) {
    this.pos.push(x, y, z); this.uv.push(u, v);
    const cc = c || [1, 1, 1]; this.col.push(cc[0], cc[1], cc[2]);
    const w = bw.slice().sort((a, b) => b[1] - a[1]).slice(0, 4);
    let t = 0; for (const e of w) t += e[1];
    for (let i = 0; i < 4; i++) { const e = w[i]; this.si.push(e ? e[0] : 0); this.sw.push(e && t > 0 ? e[1] / t : 0); }
    this.sg.push(sg | 0);
    return this.n++;
  };
  Builder.prototype.tri = function (g, a, b, c) { this.idx[g].push(a, b, c); };
  // anneau i (a = j, b = j+1) vers anneau i+1 (c = j+1, d = j) : normale sortante si s croît vers la queue
  Builder.prototype.quad = function (g, a, b, c, d, flip) {
    if (flip) { this.tri(g, a, b, c); this.tri(g, a, c, d); } else { this.tri(g, a, d, c); this.tri(g, a, c, b); }
  };
  Builder.prototype.ringStrip = function (g, r0, r1, flip) {
    for (let j = 0; j < r0.length - 1; j++) this.quad(g, r0[j], r0[j + 1], r1[j + 1], r1[j], flip);
  };
  Builder.prototype.build = function (THREE) {
    const geo = new THREE.BufferGeometry();
    const P = new Float32Array(this.pos);
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(this.si), 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(this.sw), 4));
    const all = []; let start = 0;
    GROUPS.forEach((g, mi) => {
      const a = this.idx[g];
      if (a.length) { geo.addGroup(start, a.length, mi); for (const i of a) all.push(i); start += a.length; }
    });
    geo.setIndex(all);
    // normales : somme des faces pondérée par l'aire, puis soudure par position dans un même groupe de lissage
    const n = this.n, NR = new Float32Array(n * 3);
    for (let k = 0; k < all.length; k += 3) {
      const a = all[k] * 3, b = all[k + 1] * 3, c = all[k + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      for (const q of [a, b, c]) { NR[q] += nx; NR[q + 1] += ny; NR[q + 2] += nz; }
    }
    const key = (i) => this.sg[i] + ':' + Math.round(P[i * 3] * 2000) + ',' + Math.round(P[i * 3 + 1] * 2000) + ',' + Math.round(P[i * 3 + 2] * 2000);
    const acc = new Map();
    for (let i = 0; i < n; i++) {
      const k = key(i); let e = acc.get(k);
      if (!e) { e = [0, 0, 0, []]; acc.set(k, e); }
      e[0] += NR[i * 3]; e[1] += NR[i * 3 + 1]; e[2] += NR[i * 3 + 2]; e[3].push(i);
    }
    for (const e of acc.values()) {
      const l = Math.hypot(e[0], e[1], e[2]) || 1;
      for (const i of e[3]) { NR[i * 3] = e[0] / l; NR[i * 3 + 1] = e[1] / l; NR[i * 3 + 2] = e[2] / l; }
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(NR, 3));
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += 6;      // marge : le squelette déforme beaucoup le corps
    return geo;
  };

  // poids le long de la colonne pour une abscisse s (deux os encadrants)
  function spineWeights(s) {
    if (s <= SPINE_S[0]) return [[0, 1]];
    for (let k = 0; k < SPINE_S.length - 1; k++) {
      if (s <= SPINE_S[k + 1]) {
        const f = (s - SPINE_S[k]) / (SPINE_S[k + 1] - SPINE_S[k]);
        return [[k, 1 - f], [k + 1, f]];
      }
    }
    return [[SPINE_S.length - 1, 1]];
  }

  // ============================================================================================
  // Squelette. Les os de la colonne sont tous enfants de la racine : leur pose est calculée chaque
  // image depuis une courbe (nage, virages, cabrage). Têtes, mâchoires, membres, barbillons et
  // branchies sont des chaînes enfants de leur os de colonne.
  // ============================================================================================
  function makeSkeleton(THREE) {
    const bones = [], byName = {};
    const add = (name, parent, x, y, z) => {
      const b = new THREE.Bone(); b.name = name;
      if (parent) {
        // position locale = position absolue - position absolue du parent (os parents sans rotation au repos)
        b.position.set(x - parent.userData.ax, y - parent.userData.ay, z - parent.userData.az);
        parent.add(b);
      } else b.position.set(x, y, z);
      b.userData.ax = x; b.userData.ay = y; b.userData.az = z;
      b.userData.rest = b.position.clone();
      byName[name] = b; bones.push(b);
      return b;
    };
    const rootB = add('racine', null, 0, 0, 0);
    const spine = SPINE_S.map((s, k) => add('dos' + k, rootB, 0, YC(s), zOf(s)));
    const head = spine[0];
    // mâchoire : charnière au coin des lèvres
    const hz = zOf(SJ), hy = mouthY(SJ) - 0.05;
    const jaw = add('machoire', head, 0, hy, hz);
    const mx = widthAt(SJ) * 0.86;
    const mandL = add('mandibuleG', jaw, mx, hy, hz - 0.05);
    const mandR = add('mandibuleD', jaw, -mx, hy, hz - 0.05);
    // barbillons longs (8 os) : base sur la lèvre supérieure, près du museau
    const barbel = (side) => {
      const s = 0.04, w = widthAt(s), x = side * w * 0.92, y = mouthY(s) + 0.08, z = zOf(s) - 0.06;
      const chain = [];
      let par = head;
      for (let i = 0; i < 8; i++) {
        // au repos : la chaîne part sur le côté puis s'incurve vers l'arrière et le bas
        const t = i / 7, along = i * 0.74;
        const px = x + side * (0.35 * along - 0.012 * along * along * 3), py = y - 0.05 * along, pz = z - 0.55 * along;
        const b = add((side > 0 ? 'barbG' : 'barbD') + i, par, px, py, pz);
        chain.push(b); par = b;
      }
      return chain;
    };
    const barbL = barbel(1), barbR = barbel(-1);
    // branchies : trois de chaque côté du cou
    const gills = [];
    for (const side of [1, -1]) for (let i = 0; i < 3; i++) {
      const s = 0.185 + i * 0.022, w = widthAt(s);
      gills.push(add((side > 0 ? 'branG' : 'branD') + i, spine[1], side * w * 0.9, YC(s) + 0.25 - i * 0.15, zOf(s)));
    }
    // membres : épaule, coude, poignet
    const limb = (name, sK, s, side, len) => {
      const w = widthAt(s), h = heightAt(s);
      const sx = side * w * 0.78, sy = YC(s) - 0.42 * h, sz = zOf(s);
      const sh = add(name + '0', spine[sK], sx, sy, sz);
      const ex = sx + side * len[0] * 0.82, ey = sy - len[0] * 0.48, ez = sz - len[0] * 0.25;
      const el = add(name + '1', sh, ex, ey, ez);
      const wx = ex + side * len[1] * 0.3, wy = ey - len[1] * 0.8, wz = ez + len[1] * 0.4;
      const wr = add(name + '2', el, wx, wy, wz);
      return [sh, el, wr];
    };
    const legFL = limb('patteAG', 3, 0.285, 1, [0.9, 0.78]), legFR = limb('patteAD', 3, 0.285, -1, [0.9, 0.78]);
    const legHL = limb('patteRG', 8, 0.6, 1, [1.0, 0.85]), legHR = limb('patteRD', 8, 0.6, -1, [1.0, 0.85]);
    return { bones, byName, root: rootB, spine, head, jaw, mandL, mandR, barbL, barbR, gills, legs: [legFL, legFR, legHL, legHR] };
  }
  const boneIndex = (SK, b) => SK.bones.indexOf(b);

  // ============================================================================================
  // Géométrie
  // ============================================================================================
  function buildGeometry(THREE, SK, q) {
    const B = new Builder();
    const hi = q === 'high', lo = q === 'low';
    const NT = hi ? 64 : lo ? 32 : 48;                 // points autour du corps
    const iHead = boneIndex(SK, SK.head), iJaw = boneIndex(SK, SK.jaw);
    const iML = boneIndex(SK, SK.mandL), iMR = boneIndex(SK, SK.mandR);
    const sp = (k) => boneIndex(SK, SK.spine[k]);
    const spW = (s) => spineWeights(s).map(([k, w]) => [sp(k), w]);
    const n = (s) => NEXP(s);
    const cs = (t, e) => sgnPow(Math.cos(t), 2 / e), sn = (t, e) => sgnPow(Math.sin(t), 2 / e);
    // détails géométriques de surface (en mètres) : verrues larges, crête médiane, bourrelet latéral
    const disp = (s, th) => {
      const x = s * LEN, c = Math.cos(th), si = Math.sin(th);
      let d = 0.045 * N.fbm(x * 0.9, c * 1.6, si * 1.6, 3) + 0.02 * N.n3(x * 3.2, c * 4, si * 4);
      const lateral = smooth(0.2, 0.27, s) * (1 - smooth(0.6, 0.68, s));
      d += lateral * 0.13 * gauss(si, -0.12, 0.08) * (0.75 + 0.35 * Math.sin(x * 2.6 * TAU + 0.7 * N.n3(x, 1, 2)));
      d += smooth(0.08, 0.2, s) * (1 - smooth(0.62, 0.7, s)) * 0.06 * gauss(si, 1, 0.12);
      return d;
    };
    // point de la section (x, y) avec déplacement le long de la normale approchée (radiale)
    const sect = (s, th, w, h, yc) => {
      const e = n(s);
      let x = w * cs(th, e), y = h * sn(th, e);
      if (y < 0) y *= 0.82;                              // ventre aplati
      const dd = disp(s, th);
      const l = Math.hypot(x / Math.max(w, 1e-3), y / Math.max(h, 1e-3)) || 1;
      const nx = x / Math.max(w * w, 1e-4), ny = y / Math.max(h * h, 1e-4), nl = Math.hypot(nx, ny) || 1;
      return [x + dd * nx / nl * Math.min(1, w), yc + y + dd * ny / nl * Math.min(1, h)];
    };

    // ---- 1) Corps : de la charnière (SJ) à la queue, anneaux complets
    const bodyS = [];
    const NB = hi ? 170 : lo ? 80 : 120;
    for (let i = 0; i <= NB; i++) { const t = i / NB; bodyS.push(SJ + (1 - SJ) * (t * 0.55 + 0.45 * t * t)); }
    let prev = null;
    for (const s of bodyS) {
      const w = widthAt(s), h = heightAt(s), yc = YC(s), z = zOf(s), ring = [];
      const myM = mouthY(s);
      for (let j = 0; j <= NT; j++) {
        const th = (j / NT) * TAU;
        const [x, y] = sect(s, th, w, h, yc);
        let bw = spW(s);
        // gorge : la peau sous la ligne des lèvres suit la mâchoire près de la charnière (poche qui s'étire)
        const throat = (1 - smooth(SJ, 0.26, s)) * smooth(myM + 0.05, myM - 0.25 * h, y);
        if (throat > 0.001) bw = bw.map(([b, wt]) => [b, wt * (1 - throat)]).concat([[iJaw, throat]]);
        ring.push(B.v(x, y, z, s, j / NT, bw, 1));
      }
      if (prev) B.ringStrip('skin', prev, ring);
      prev = ring;
    }

    // ---- 2) Crâne : arc supérieur (lèvre gauche → dos → lèvre droite) + palais
    const NSK = hi ? 70 : lo ? 30 : 48, NTA = Math.round(NT * 0.56), NPAL = hi ? 16 : 10;
    const skullS = [];
    for (let i = 0; i <= NSK; i++) { const t = i / NSK; skullS.push(SJ * (t * t * 0.6 + 0.4 * t)); }
    let prevA = null, prevP = null;
    const headW = (s) => {
      const f = smooth(0.1, SJ + 0.004, s);
      return f > 0 ? [[iHead, 1 - f], [sp(1), f]] : [[iHead, 1]];
    };
    for (const s of skullS) {
      const w = Math.max(widthAt(s), 1e-3), h = Math.max(heightAt(s), 1e-3), yc = YC(s), z = zOf(s);
      const arc = [], pal = [];
      for (let j = 0; j <= NTA; j++) {
        const th = -ALPHA + (j / NTA) * (Math.PI + 2 * ALPHA);
        const [x, y] = sect(s, th, w, h, yc);
        arc.push(B.v(x, y, z, s, th / TAU, headW(s), 2));
      }
      // palais : de la lèvre droite à la lèvre gauche, voûté
      const xl = B.pos[arc[0] * 3], yl = B.pos[arc[0] * 3 + 1];
      for (let j = 0; j <= NPAL; j++) {
        const t = j / NPAL, x = lerp(-xl, xl, t);
        const y = yl + 0.02 + 0.16 * h * (1 - Math.pow(2 * t - 1, 2));
        const ao = (1 - 0.3 * smooth(0.55, 1, s / SJ)) * (1 - 0.35 * Math.pow(Math.abs(2 * t - 1), 6));
        pal.push(B.v(x, y, z, 0.5 * s / SJ, t, headW(s), 3, [ao, ao * 0.97, ao * 0.97]));
      }
      if (prevA) { B.ringStrip('skin', prevA, arc); B.ringStrip('mouth', prevP, pal); }
      prevA = arc; prevP = pal;
    }

    // ---- 3) Demi-mandibules : arc inférieur (lèvre → menton), tranche au milieu, langue (bord → lèvre)
    const jawHalf = (side) => {
      const iM = side > 0 ? iML : iMR;
      let pa = null, pc = null, pt = null;
      const keyB = [], keyT = [];
      const NTJ = Math.round(NT * 0.25);
      const jwW = (s) => { const f = smooth(0.1, SJ, s); return [[iM, 1 - f], [iJaw, f]]; };
      for (const s of skullS) {
        const w = Math.max(widthAt(s), 1e-3), h = Math.max(heightAt(s), 1e-3), yc = YC(s), z = zOf(s);
        const arc = [], cut = [], tng = [];
        // côté gauche (side +1) : angle de 2π - α (lèvre) à 3π/2 (menton) ; côté droit : π + α → 3π/2
        for (let j = 0; j <= NTJ; j++) {
          const t = j / NTJ;
          const th = side > 0 ? TAU - ALPHA - t * (Math.PI / 2 - ALPHA) : Math.PI + ALPHA + t * (Math.PI / 2 - ALPHA);
          const [x, y] = sect(s, th, w, h, yc);
          arc.push(B.v(x, y, z, s, th / TAU, jwW(s), side > 0 ? 4 : 5));
        }
        const xl = B.pos[arc[0] * 3], yl = B.pos[arc[0] * 3 + 1];
        const yb = B.pos[arc[NTJ] * 3 + 1];
        const yt = yl - 0.05 - 0.3 * h;                       // fond de la langue au milieu
        // tranche du menton (milieu) : du bas vers la langue
        for (let j = 0; j <= 3; j++) cut.push(B.v(0, lerp(yb, yt, j / 3), z, 0.5 + 0.49 * s / SJ, 0.5, jwW(s), side > 0 ? 6 : 7, [0.6, 0.55, 0.56]));
        // langue : du milieu vers la lèvre, en cuvette
        for (let j = 0; j <= 8; j++) {
          const t = j / 8, x = t * xl;
          // langue charnue au milieu du plancher (bourrelet), bords en gouttière vers les dents
          const bulge = 0.24 * h * Math.exp(-Math.pow(t / 0.34, 2)) * smooth(0.025, 0.065, s) * (1 - smooth(0.11, SJ * 0.97, s));
          const y = lerp(yt, yl - 0.02, Math.pow(t, 1.6)) + bulge;
          const ao = 0.62 + 0.38 * smooth(0.0, 0.5, t) * (1 - 0.5 * Math.pow(t, 8)) - 0.25 * smooth(0.6, 1, s / SJ);
          tng.push(B.v(x, y, z, 0.5 + 0.49 * s / SJ, 0.5 + side * 0.5 * t, jwW(s), side > 0 ? 8 : 9, [ao, ao * 0.95, ao * 0.97]));
        }
        if (pa) {
          B.ringStrip('skin', pa, arc, side > 0);
          B.ringStrip('mouth', pc, cut, side > 0);
          B.ringStrip('mouth', pt, tng, side < 0);
        }
        pa = arc; pc = cut; pt = tng;
        keyB.push(arc[NTJ]); keyT.push(tng[0]);
      }
      return { keyB, keyT };
    };
    const JL = jawHalf(1), JR = jawHalf(-1);
    // membranes gulaires : relient les deux demi-mandibules au menton (s'étirent quand elles s'écartent)
    for (let i = 0; i < JL.keyB.length - 1; i++) {
      B.quad('skin', JL.keyB[i], JL.keyB[i + 1], JR.keyB[i + 1], JR.keyB[i], true);
      B.quad('mouth', JL.keyT[i], JL.keyT[i + 1], JR.keyT[i + 1], JR.keyT[i], false);
    }

    // ---- 4) Fond de gueule et joues : membranes étirables entre palais et langue
    {
      const sB = SJ * 0.995, z = zOf(sB) - 0.02, w = widthAt(sB), h = heightAt(sB);
      const yl = mouthY(sB), yPal = yl + 0.02, yTon = yl - 0.05 - 0.3 * h;
      const NG = 14, top = [], bot = [];
      for (let j = 0; j <= NG; j++) {
        const t = j / NG, x = lerp(-w * 0.97, w * 0.97, t), bump = 1 - Math.pow(2 * t - 1, 2);
        top.push(B.v(x, yPal + 0.16 * h * bump, z, 0.49, t, [[iHead, 0.3], [sp(1), 0.7]], 10, [0.55, 0.5, 0.5]));
        bot.push(B.v(x, lerp(yl - 0.02, yTon, bump), z, 0.99, t, [[iJaw, 1]], 10, [0.5, 0.45, 0.46]));
      }
      // gosier : rangée intermédiaire enfoncée (sombre)
      const mid = [];
      for (let j = 0; j <= NG; j++) {
        const t = j / NG, bump = 1 - Math.pow(2 * t - 1, 2), x = lerp(-w * 0.6, w * 0.6, t);
        mid.push(B.v(x, lerp(yPal, yTon, 0.5), z - 0.9 * bump, 0.995, t, [[iHead, 0.25], [sp(1), 0.35], [iJaw, 0.4]], 10, [0.12, 0.07, 0.07]));
      }
      B.ringStrip('mouth', top, mid, true); B.ringStrip('mouth', mid, bot, true);
      // joues : du coin des lèvres vers l'avant sur 40 % de la profondeur de la gueule
      for (const side of [1, -1]) {
        let pr = null;
        for (let i = 0; i <= 8; i++) {
          const s = SJ * (1 - 0.42 * i / 8), zz = zOf(s), ww = widthAt(s) * 0.96, yy = mouthY(s);
          const k = 1 - i / 8;
          const a = B.v(side * ww, yy + 0.01, zz, 0.5 + 0.49 * s / SJ, 0, [[iHead, 1]], 11, [0.7, 0.66, 0.66]);
          const m = B.v(side * ww * 0.97, yy - 0.08, zz, 0.5 + 0.49 * s / SJ, 0.5, [[iHead, 0.5 * k + 0.2], [iJaw, 0.8 - 0.5 * k]], 11, [0.45, 0.4, 0.42]);
          const b = B.v(side * ww, yy - 0.03, zz, 0.5 + 0.49 * s / SJ, 1, [[side > 0 ? iML : iMR, 1 - k], [iJaw, k]], 11, [0.7, 0.66, 0.66]);
          const r = [a, m, b];
          if (pr) B.ringStrip('mouth', pr, r, side < 0);
          pr = r;
        }
      }
    }

    // ---- 5) Dents : aiguilles recourbées sur les lèvres, deux rangées (externe longue, interne en crochets)
    const R = rng(4242);
    const tooth = (bx, by, bz, dx, dy, dz, len, rad, bend, bw, kind) => {
      // teinte par dent : base tachée (tanin, vase), pointe ivoire ; griffes sombres, cornées ;
      // papilles de la gueule : chair pâle, pointe cornée jaunâtre
      const tint = 0.78 + 0.3 * R(), stain = R(), claw = kind === true || kind === 'claw', pap = kind === 'papille';
      const c0 = claw ? [0.05, 0.045, 0.035] : pap ? [0.09, 0.03, 0.035] : [0.2 * tint, 0.14 * tint, 0.07 * tint];
      const c1 = claw ? [0.36, 0.32, 0.26] : pap ? [0.42 * tint, 0.34 * tint, 0.26 * tint] : [0.66 * tint - 0.12 * stain, 0.6 * tint - 0.12 * stain, 0.46 * tint - 0.1 * stain];
      // cône incurvé : 3 anneaux de 6 côtés + pointe ; dir = (dx,dy,dz) unitaire ; bend = recourbement vers l'arrière
      const up = Math.abs(dy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let ax = dy * up[2] - dz * up[1], ay = dz * up[0] - dx * up[2], az = dx * up[1] - dy * up[0];
      const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      const bx2 = dy * az - dz * ay, by2 = dz * ax - dx * az, bz2 = dx * ay - dy * ax;
      const rings = [];
      for (let r = 0; r <= 3; r++) {
        const t = r / 3, rr = rad * (1 - t * 0.85), off = bend * t * t * len;
        const cx = bx + dx * len * t, cy = by + dy * len * t, cz = bz + dz * len * t - off;
        const ring = [];
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * TAU, ca = Math.cos(a) * rr, sa = Math.sin(a) * rr;
          const f = Math.pow(t, 0.7);
          ring.push(B.v(cx + ax * ca + bx2 * sa, cy + ay * ca + by2 * sa, cz + az * ca + bz2 * sa, t, k / 6, bw, 20 + rings.length,
            [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)]));
        }
        rings.push(ring);
      }
      const tipOff = bend * len;
      const tip = B.v(bx + dx * len * 1.12, by + dy * len * 1.12, bz + dz * len * 1.12 - tipOff, 1, 0, bw, 30, claw ? [0.42, 0.38, 0.3] : [Math.min(1, c1[0] * 1.15), Math.min(1, c1[1] * 1.15), Math.min(1, c1[2] * 1.12)]);
      for (let r = 0; r < 3; r++) B.ringStrip('teeth', rings[r], rings[r + 1], true);
      for (let k = 0; k < 6; k++) B.tri('teeth', rings[3][k], rings[3][k + 1], tip);
    };
    for (const side of [1, -1]) {
      // le long de la lèvre supérieure (crâne) : de l'avant (s ≈ 0.012) au coin (s ≈ 0.15)
      for (let s = 0.008; s < SJ * 0.9; s += 0.0065 + 0.004 * R()) {
        const w = widthAt(s), yl = mouthY(s), z = zOf(s);
        const front = 1 - smooth(0.03, 0.1, s);
        const x = side * w * 0.965;
        // vecteur vers l'intérieur de la gueule (normal au contour en vue de dessus)
        const ds = 0.004, w2 = widthAt(s + ds), dxdz = (w2 - w) / (LEN * ds);
        let ix = -side, iz = -dxdz * side;  // approx.
        const il = Math.hypot(ix, iz); ix /= il; iz /= il;
        const len = (0.16 + 0.16 * front + 0.06 * R()) * (s < 0.05 ? 1.25 : 1);
        tooth(x + ix * 0.04, yl + 0.02, z + iz * 0.04, ix * 0.18, -0.98, iz * 0.18, len, 0.035 + 0.02 * front, 0.25, [[iHead, 1]]);
        if (R() < 0.6) tooth(x + ix * 0.2, yl + 0.04, z + iz * 0.2, ix * 0.35, -0.94, iz * 0.35, len * 0.55, 0.026, 0.55, [[iHead, 1]]);
      }
      // lèvre inférieure (demi-mandibule) : dents vers le haut
      for (let s = 0.01; s < SJ * 0.88; s += 0.0068 + 0.004 * R()) {
        const w = widthAt(s), yl = mouthY(s), z = zOf(s), front = 1 - smooth(0.03, 0.1, s);
        const x = side * w * 0.955;
        const ix = -side, iz = 0;
        const len = 0.13 + 0.13 * front + 0.05 * R();
        const bw = [[side > 0 ? iML : iMR, 1 - smooth(0.1, SJ, s)], [iJaw, smooth(0.1, SJ, s)]];
        tooth(x + ix * 0.05, yl - 0.03, z, ix * 0.2, 0.98, iz, len, 0.03 + 0.016 * front, 0.2, bw);
        if (R() < 0.5) tooth(x + ix * 0.22, yl - 0.06, z, ix * 0.4, 0.92, 0, len * 0.5, 0.022, 0.5, bw);
      }
    }

    // ---- 5b) Papilles cornées de la gueule : rangées de crochets tournés vers la gorge (palais et plancher).
    // Une proie ne ressort pas ; elles cassent aussi l'aspect lisse de l'intérieur.
    for (let s = 0.03; s < SJ * 0.86; s += 0.011 + 0.006 * R()) {
      const w = widthAt(s), h = heightAt(s), z = zOf(s), yl = mouthY(s), xl = w * 0.9;
      const deep = s / SJ;
      for (const t of [0.2, 0.34, 0.66, 0.8]) {
        if (R() < 0.25) continue;
        const tt = t + (R() - 0.5) * 0.06, x = lerp(-xl, xl, tt);
        const y = yl + 0.02 + 0.16 * h * (1 - Math.pow(2 * tt - 1, 2)) - 0.01;
        tooth(x, y, z, (0.5 - tt) * 0.3, -0.55, -0.8, 0.07 + 0.07 * R() * (1 - 0.4 * deep), 0.022, 0.5, headW(s), 'papille');
      }
      for (const side of [1, -1]) {
        const jw = [[side > 0 ? iML : iMR, 1 - smooth(0.1, SJ, s)], [iJaw, smooth(0.1, SJ, s)]];
        const yt = yl - 0.05 - 0.3 * h;
        for (const t of [0.42, 0.68]) {
          if (R() < 0.3) continue;
          const tt = t + (R() - 0.5) * 0.08, x = side * tt * xl;
          const bulge = 0.24 * h * Math.exp(-Math.pow(tt / 0.34, 2)) * smooth(0.025, 0.065, s) * (1 - smooth(0.11, SJ * 0.97, s));
          const y = lerp(yt, yl - 0.02, Math.pow(tt, 1.6)) + bulge - 0.01;
          tooth(x, y, z, -side * 0.15, 0.55, -0.8, 0.06 + 0.06 * R(), 0.02, 0.5, jw, 'papille');
        }
      }
    }

    // ---- 6) Yeux : trois de chaque côté, en arc sur le haut des flancs de la tête, avec bourrelet
    const eyeTexUV = (vx, vy, vz, ox, oy, oz) => {
      // u = longitude autour de l'axe du regard, v = angle depuis le regard (0 = centre de la pupille)
      const d = vx * ox + vy * oy + vz * oz;
      const v = Math.acos(clamp(d, -1, 1)) / Math.PI;
      return [Math.atan2(vy, vx) / TAU + 0.5, v];
    };
    const EYES = [[0.074, 0.092, 0.66], [0.099, 0.122, 0.62], [0.124, 0.088, 0.64]];
    const eyeCenters = [];
    for (const side of [1, -1]) {
      for (const [s, r, phi] of EYES) {
        const w = widthAt(s), h = heightAt(s), yc = YC(s), th = side > 0 ? phi : Math.PI - phi;
        const [x, y] = sect(s, th, w, h, yc);
        const z = zOf(s);
        // normale extérieure approchée
        let nx = side * 0.75, ny = 0.6, nz = 0.12; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const cx = x - nx * r * 0.48, cy = y - ny * r * 0.48, cz = z;
        eyeCenters.push({ side, x: cx, y: cy, z: cz, r, n: [nx, ny, nz] });
        const SEG = hi ? 18 : 12, RG = hi ? 12 : 8;
        let prev = null;
        for (let a = 0; a <= RG; a++) {
          const lat = (a / RG) * Math.PI;
          const ring = [];
          for (let b = 0; b <= SEG; b++) {
            const lon = (b / SEG) * TAU;
            // sphère dont le pôle (lat = 0) regarde selon n
            const lx = Math.sin(lat) * Math.cos(lon), ly = Math.sin(lat) * Math.sin(lon), lz = Math.cos(lat);
            // base orthonormée (t1, t2, n)
            let t1x = -nz, t1y = 0, t1z = nx; const tl = Math.hypot(t1x, t1y, t1z) || 1; t1x /= tl; t1z /= tl;
            const t2x = ny * t1z - nz * t1y, t2y = nz * t1x - nx * t1z, t2z = nx * t1y - ny * t1x;
            const vx = t1x * lx + t2x * ly + nx * lz, vy = t1y * lx + t2y * ly + ny * lz, vz = t1z * lx + t2z * ly + nz * lz;
            ring.push(B.v(cx + vx * r, cy + vy * r, cz + vz * r, b / SEG, lat / Math.PI, [[iHead, 1]], 40 + eyeCenters.length));
          }
          if (prev) B.ringStrip('eyes', prev, ring, false);
          prev = ring;
        }
        // bourrelet (paupière) : anneau de peau posé à la surface, bord interne glissé sous l'œil,
        // paupière supérieure plus épaisse. Enroulement choisi par face (normale sortante du bourrelet).
        {
          let t1x = -nz, t1z = nx; const tl = Math.hypot(t1x, t1z) || 1; t1x /= tl; t1z /= tl;
          const t2x = ny * t1z, t2y = nz * t1x - nx * t1z, t2z = -ny * t1x;
          const RT = hi ? 24 : 16, CS = 6, base = r * 0.3, rings = [], ctr = [];
          for (let a = 0; a <= RT; a++) {
            const ang = (a / RT) * TAU;
            const ux = Math.cos(ang) * t1x + Math.sin(ang) * t2x, uy = Math.sin(ang) * t2y, uz = Math.cos(ang) * t1z + Math.sin(ang) * t2z;
            const thick = 0.75 + 0.55 * Math.max(0, Math.sin(ang)) * (uy > 0 ? 1 : 0.4);
            const ring = [];
            for (let b = 0; b <= CS; b++) {
              const sa = (b / CS) * Math.PI;
              const rr = r * (0.9 + 0.45 * (1 - Math.cos(sa)) * 0.5), hh = base + r * 0.27 * thick * Math.sin(sa);
              ring.push(B.v(cx + ux * rr + nx * hh, cy + uy * rr + ny * hh, cz + uz * rr + nz * hh,
                s + (uz * rr) / -LEN, (side > 0 ? phi : Math.PI - phi) / TAU + (uy * rr) / 9.6, [[iHead, 1]], 60));
            }
            rings.push(ring);
            ctr.push([cx + ux * r * 1.125 + nx * base, cy + uy * r * 1.125 + ny * base, cz + uz * r * 1.125 + nz * base]);
          }
          const Pp = B.pos;
          for (let a = 0; a < RT; a++) for (let b = 0; b < CS; b++) {
            const A = rings[a][b], Bq = rings[a][b + 1], C = rings[a + 1][b + 1], Dq = rings[a + 1][b];
            // normale de (A, Dq, C) comparée à la direction centre de section → sommet
            const e1 = [Pp[Dq * 3] - Pp[A * 3], Pp[Dq * 3 + 1] - Pp[A * 3 + 1], Pp[Dq * 3 + 2] - Pp[A * 3 + 2]];
            const e2 = [Pp[C * 3] - Pp[A * 3], Pp[C * 3 + 1] - Pp[A * 3 + 1], Pp[C * 3 + 2] - Pp[A * 3 + 2]];
            const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
            const o = [Pp[Bq * 3] - ctr[a][0], Pp[Bq * 3 + 1] - ctr[a][1], Pp[Bq * 3 + 2] - ctr[a][2]];
            B.quad('skin', A, Bq, C, Dq, fn[0] * o[0] + fn[1] * o[1] + fn[2] * o[2] < 0);
          }
        }
      }
    }

    // ---- 7) Tube générique skinné le long d'une suite de points (barbillons, membres, doigts)
    // pts : [[x,y,z,rayon,[[os,poids]…]], …] ; aplati : facteur vertical ; sgId : groupe de lissage
    const tube = (g, pts, segs, sgId, flat, uvS) => {
      let prevR = null;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], pn = pts[Math.min(pts.length - 1, i + 1)], pp = pts[Math.max(0, i - 1)];
        let tx = pn[0] - pp[0], ty = pn[1] - pp[1], tz = pn[2] - pp[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        let ux = 0, uy = 1, uz = 0; if (Math.abs(ty) > 0.95) { ux = 1; uy = 0; }
        let ax = ty * uz - tz * uy, ay = tz * ux - tx * uz, az = tx * uy - ty * ux; const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
        const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
        const ring = [];
        for (let k = 0; k <= segs; k++) {
          const a = (k / segs) * TAU, ca = Math.cos(a) * p[3], sa = Math.sin(a) * p[3] * (flat || 1);
          ring.push(B.v(p[0] + ax * ca + bx * sa, p[1] + ay * ca + by * sa, p[2] + az * ca + bz * sa,
            uvS ? uvS[0] + uvS[1] * (i / (pts.length - 1)) : i / (pts.length - 1), 0.04 + 0.4 * (k / segs), p[4], sgId));
        }
        if (prevR) B.ringStrip(g, prevR, ring, true);
        prevR = ring;
      }
      return prevR;
    };
    const sphereAt = (g, cx, cy, cz, r, bw, sgId, segs) => {
      let prev = null; const S = segs || 10;
      for (let a = 0; a <= S; a++) {
        const lat = (a / S) * Math.PI, ring = [];
        for (let b = 0; b <= S; b++) {
          const lon = (b / S) * TAU;
          ring.push(B.v(cx + Math.sin(lat) * Math.cos(lon) * r, cy + Math.cos(lat) * r, cz + Math.sin(lat) * Math.sin(lon) * r, b / S, a / S, bw, sgId));
        }
        if (prev) B.ringStrip(g, prev, ring, true);
        prev = ring;
      }
    };

    // ---- 8) Barbillons longs (8 os chacun) et bulbes lumineux
    for (const chain of [SK.barbL, SK.barbR]) {
      const idx = chain.map((b) => boneIndex(SK, b));
      const P = chain.map((b) => [b.userData.ax, b.userData.ay, b.userData.az]);
      const pts = [];
      const NSEG = hi ? 44 : 28;
      // départ enfoui dans la lèvre (le bout ouvert du tube reste caché dans la tête)
      { const a = P[0], sd = a[0] > 0 ? 1 : -1;
        pts.push([a[0] - sd * 0.42, a[1] + 0.06, a[2] + 0.04, 0.2, [[iHead, 0.7], [idx[0], 0.3]]]); }
      for (let i = 0; i <= NSEG; i++) {
        const t = (i / NSEG) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(t)), f = t - k;
        const a = P[k], b = P[k + 1];
        const r = 0.17 * Math.pow(1 - i / NSEG, 0.75) + 0.035;
        pts.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f), r, [[idx[k], 1 - f], [idx[k + 1], f]]]);
      }
      tube('skin', pts, hi ? 10 : 7, 70, 1, [0.2, 0.5]);
      // bulbe en goutte, dans le prolongement du dernier segment
      const e = P[P.length - 1], e0 = P[P.length - 2];
      let ddx = e[0] - e0[0], ddy = e[1] - e0[1], ddz = e[2] - e0[2]; const dl = Math.hypot(ddx, ddy, ddz) || 1; ddx /= dl; ddy /= dl; ddz /= dl;
      const bulb = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, r = 0.17 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.75) * (1 - 0.25 * t) + 0.01;
        bulb.push([e[0] + ddx * (t * 0.46 - 0.06), e[1] + ddy * (t * 0.46 - 0.06), e[2] + ddz * (t * 0.46 - 0.06), r, [[idx[idx.length - 1], 1]]]);
      }
      tube('lure', bulb, hi ? 12 : 8, 71, 1, [0, 1]);
    }
    // barbillons courts : menton (2 par demi-mandibule) et coins de la bouche (rigides)
    for (const side of [1, -1]) {
      for (const [s, xf, len] of [[0.03, 0.35, 1.5], [0.055, 0.6, 1.2]]) {
        const w = widthAt(s), h = heightAt(s), x0 = side * w * xf, y0 = YC(s) - h * 0.78, z0 = zOf(s);
        const bw = [[side > 0 ? iML : iMR, 1]];
        const pts = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          pts.push([x0 + side * 0.15 * t * len, y0 - 0.55 * len * t + 0.15 * len * t * t, z0 - 0.75 * len * t, 0.06 * (1 - t) + 0.015, bw]);
        }
        tube('skin', pts, 6, 72, 1, [0.03, 0.05]);
      }
      const s = SJ * 0.9, w = widthAt(s), x0 = side * w * 0.98, y0 = mouthY(s) + 0.05, z0 = zOf(s);
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push([x0 + side * 0.5 * t, y0 - 0.25 * t, z0 - 0.7 * t, 0.07 * (1 - t) + 0.015, [[iHead, 1]]]);
      }
      tube('skin', pts, 6, 73, 1, [0.1, 0.05]);
    }

    // ---- 9) Branchies externes : tige + frondes plumeuses (membrane découpée)
    SK.gills.forEach((g, gi) => {
      const side = g.userData.ax > 0 ? 1 : -1, bi = boneIndex(SK, g);
      const x0 = g.userData.ax, y0 = g.userData.ay, z0 = g.userData.az;
      const len = 2.0 + 0.45 * ((gi % 3) === 1 ? 1 : 0) - 0.25 * ((gi % 3) === 2 ? 1 : 0);
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push([x0 + side * (0.42 * t * len), y0 + 0.3 * len * t - 0.12 * len * t * t, z0 - 0.7 * len * t, 0.1 * (1 - t * 0.7), [[bi, 1]]]);
      }
      tube('gill', pts, 6, 80 + gi, 1, [0, 1]);
      // fronde : bande de part et d'autre de la tige
      let pr = null;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, p = pts[i], wdt = 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.05;
        const a = B.v(p[0], p[1] + wdt, p[2], t, 0, [[bi, 1]], 90 + gi);
        const m = B.v(p[0] + side * 0.02, p[1], p[2], t, 0.5, [[bi, 1]], 90 + gi);
        const b = B.v(p[0], p[1] - wdt, p[2], t, 1, [[bi, 1]], 90 + gi);
        const r = [a, m, b];
        if (pr) B.ringStrip('gill', pr, r, side < 0);
        pr = r;
      }
    });

    // ---- 10) Membres : bras/jambe en tube, main palmée à 4 doigts et griffes
    const limbGeo = (L, front) => {
      const [sh, el, wr] = L, side = sh.userData.ax > 0 ? 1 : -1;
      const ia = boneIndex(SK, sh), ib = boneIndex(SK, el), ic = boneIndex(SK, wr);
      const A = [sh.userData.ax, sh.userData.ay, sh.userData.az], Bp = [el.userData.ax, el.userData.ay, el.userData.az], C = [wr.userData.ax, wr.userData.ay, wr.userData.az];
      const r0 = front ? 0.62 : 0.72, pts = [];
      // départ enfoui dans le flanc
      const inX = A[0] - side * 0.45;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, x = lerp(inX, Bp[0], t), y = lerp(A[1] + 0.1, Bp[1], t), z = lerp(A[2], Bp[2], t);
        const bw = t < 0.15 ? [[sp(front ? 3 : 8), 1 - t / 0.15], [ia, t / 0.15]] : t > 0.75 ? [[ia, (1 - t) / 0.25], [ib, (t - 0.75) / 0.25]] : [[ia, 1]];
        pts.push([x, y, z, lerp(r0, r0 * 0.66, t) * (1 + 0.15 * Math.sin(t * Math.PI)), bw]);
      }
      for (let i = 1; i <= 7; i++) {
        const t = i / 7, x = lerp(Bp[0], C[0], t), y = lerp(Bp[1], C[1], t), z = lerp(Bp[2], C[2], t);
        const bw = t > 0.75 ? [[ib, (1 - t) / 0.25], [ic, (t - 0.75) / 0.25]] : [[ib, 1]];
        pts.push([x, y, z, lerp(r0 * 0.7, r0 * 0.5, t), bw]);
      }
      tube('skin', pts, hi ? 14 : 10, 100 + (front ? 0 : 2) + (side > 0 ? 0 : 1), 1, [front ? 0.27 : 0.58, 0.04]);
      // main : paume aplatie, quatre doigts en éventail vers l'avant-extérieur, palmure, griffes
      const hand = [C[0] + side * 0.1, C[1] - 0.12, C[2] + 0.18];
      const palm = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        palm.push([lerp(C[0], hand[0], t), lerp(C[1], hand[1], t), lerp(C[2], hand[2], t), lerp(r0 * 0.5, r0 * 0.62, t), [[ic, 1]]]);
      }
      tube('skin', palm, 10, 110, 0.45, [0.3, 0.02]);
      const tips = [];
      for (let f = 0; f < 4; f++) {
        const a = (-0.7 + f * 0.47) * side, dl = (front ? 0.55 : 0.62) * (f === 1 || f === 2 ? 1 : 0.8);
        const dx = Math.sin(a) * 0.9 + side * 0.25, dz = Math.cos(a), dy = -0.18; const l = Math.hypot(dx, dy, dz);
        const d = [dx / l, dy / l, dz / l], base = [hand[0] + d[0] * 0.15, hand[1], hand[2] + d[2] * 0.15];
        const fp = [];
        for (let i = 0; i <= 5; i++) {
          const t = i / 5;
          fp.push([base[0] + d[0] * dl * t, base[1] + d[1] * dl * t - 0.05 * t * t, base[2] + d[2] * dl * t, 0.12 * (1 - 0.45 * t), [[ic, 1]]]);
        }
        tube('skin', fp, 6, 111, 0.7, [0.3, 0.01]);
        const tip = fp[5];
        tooth(tip[0], tip[1] + 0.02, tip[2], d[0] * 0.8, -0.45, d[2] * 0.8, 0.22, 0.05, -0.3, [[ic, 1]], true);
        tips.push(fp);
      }
      // palmure entre les doigts (membrane double face, matière nageoire)
      for (let f = 0; f < 3; f++) {
        const A1 = tips[f], A2 = tips[f + 1];
        for (let i = 0; i < 4; i++) {
          const a = A1[i], b = A2[i], c = A2[i + 1], d = A1[i + 1];
          const va = B.v(a[0], a[1], a[2], i / 5, 0.1, [[ic, 1]], 112), vb = B.v(b[0], b[1], b[2], i / 5, 0.1, [[ic, 1]], 112);
          const vc = B.v(c[0], c[1], c[2], (i + 1) / 5, 0.1, [[ic, 1]], 112), vd = B.v(d[0], d[1], d[2], (i + 1) / 5, 0.1, [[ic, 1]], 112);
          B.quad('fin', va, vb, vc, vd, side > 0);
        }
      }
      return { tips };
    };
    limbGeo(SK.legs[0], true); limbGeo(SK.legs[1], true); limbGeo(SK.legs[2], false); limbGeo(SK.legs[3], false);

    // ---- 11) Tubercules : rangée dorsale irrégulière et verrues latérales. Dômes aplatis, enfoncés dans
    // la peau, déformés par du bruit, avec des UV qui prolongent celles du corps (la carte de normales
    // de la peau s'y applique : rides, pores).
    const knob = (s, th, size, elong, flat) => {
      const w = widthAt(s), h = heightAt(s), yc = YC(s), z = zOf(s);
      const [x, y] = sect(s, th, w, h, yc);
      const nx0 = Math.cos(th) / Math.max(w, 1e-3), ny0 = Math.sin(th) / Math.max(h, 1e-3), nl = Math.hypot(nx0, ny0) || 1;
      const nx = nx0 / nl, ny = ny0 / nl, tx = ny, ty = -nx;            // normale et tangente (sens de th décroissant)
      const rl = Math.max(0.2, Math.hypot(w * Math.sin(th), h * Math.cos(th)));
      const bw = spW(s), S = hi ? 12 : 8, sink = size * flat * 0.3, seed = R() * 50;
      let prev = null;
      for (let a = 0; a <= S / 2; a++) {
        const lat = (a / S) * Math.PI * 1.08, ring = [];
        for (let b = 0; b <= S; b++) {
          const lon = (b / S) * TAU;
          const irr = 1 + 0.22 * N.n3(Math.cos(lon) * 1.3 + seed, Math.sin(lon) * 1.3, lat);
          const lx = Math.sin(lat) * Math.cos(lon) * size * irr, lz = Math.sin(lat) * Math.sin(lon) * size * elong * irr;
          const lh = Math.cos(lat) * size * flat * (0.9 + 0.2 * irr) - sink;
          ring.push(B.v(x + tx * lx + nx * lh, y + ty * lx + ny * lh, z + lz, s - lz / LEN, (th - lx / rl) / TAU, bw, 120));
        }
        if (prev) B.ringStrip('skin', prev, ring, true);
        prev = ring;
      }
    };
    for (let s = 0.07; s < 0.62; s += 0.018 + 0.016 * R()) {
      if (R() < 0.18) continue;
      const big = 1 - smooth(0.3, 0.62, s);
      const off = (R() - 0.5) * 0.12;
      knob(s, Math.PI / 2 + off, 0.07 + 0.08 * big + 0.04 * R(), 1.3 + 0.6 * R(), 0.55);
      if (R() < 0.3) knob(s + 0.006, Math.PI / 2 - off * 1.5 + (R() - 0.5) * 0.1, 0.05 + 0.04 * R(), 1.2, 0.5);
    }
    for (let s = 0.17; s < 0.62; s += 0.024 + 0.03 * R()) {
      for (const side of [1, -1]) {
        if (R() < 0.35) continue;
        const th = Math.PI / 2 - side * (0.5 + R() * 0.35);
        knob(s + (R() - 0.5) * 0.01, th, 0.045 + 0.045 * R(), 1 + 0.5 * R(), 0.5);
      }
    }

    // ---- 12) Nageoire en ruban : dessus (s 0.6 → 0.99) et dessous (s 0.7 → 0.99)
    const fin = (s0, s1, top, hmax) => {
      let prev = null;
      const NF = hi ? 70 : 40;
      for (let i = 0; i <= NF; i++) {
        const s = lerp(s0, s1, i / NF), t = i / NF;
        const h = heightAt(s), yc = YC(s), z = zOf(s), bw = spW(s);
        const fh = hmax * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (0.75 + 0.25 * Math.sin(t * 9.4)) + 0.06;
        const y0 = yc + (top ? h * 0.9 : -h * 0.72), y1 = y0 + (top ? fh : -fh);
        const a = B.v(0, y0, z, t, 0, bw, 130), b = B.v(0, y1, z - 0.15 * fh, t, 0.9, bw, 130);
        const r = [a, b];
        if (prev) B.ringStrip('fin', prev, r, !top);
        prev = r;
      }
    };
    fin(0.6, 0.995, true, 0.95);
    fin(0.7, 0.995, false, 0.55);

    return { geometry: B.build(THREE), eyeCenters };
  }

  // ============================================================================================
  // Matières (eau trouble : teinte vers la couleur de vase sous la surface ; flash rouge à l'impact)
  // ============================================================================================
  function makeMaterials(THREE, q, lin) {
    const skinT = makeSkinTextures(THREE, q), mouthT = makeMouthTextures(THREE, q);
    const U = { uWaterY: { value: 0 }, uMurk: { value: new THREE.Color(0x1b2216) }, uHit: { value: 0 }, uDepthK: { value: 0.75 } };
    // uMurk : mélangée après le rendu tonal et l'encodage sRGB (au point du brouillard) : couleur d'écran, jamais convertie
    const patch = (m) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uWaterY = U.uWaterY; sh.uniforms.uMurk = U.uMurk; sh.uniforms.uHit = U.uHit; sh.uniforms.uDepthK = U.uDepthK;
        sh.vertexShader = 'varying vec3 vMvW;\n' + sh.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\n  vMvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'uniform float uWaterY;\nuniform vec3 uMurk;\nuniform float uHit;\nuniform float uDepthK;\nvarying vec3 vMvW;\n' +
          sh.fragmentShader.replace('#include <fog_fragment>',
            '  { float dep = uWaterY - vMvW.y;\n' +
            '    if (dep > 0.0) { float k = 1.0 - exp(-dep * uDepthK); gl_FragColor.rgb = mix(gl_FragColor.rgb, uMurk, clamp(k * 0.96, 0.0, 0.96)); }\n' +
            '    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.55, 0.05, 0.03), uHit * 0.45); }\n' +
            '#include <fog_fragment>');
      };
      m.customProgramCacheKey = () => 'mereVase:' + (m.name || '');
      return m;
    };
    const col = (hex) => { const c = new THREE.Color(hex); if (lin) c.convertSRGBToLinear(); return c; };
    const std = (o, name) => { const m = new THREE.MeshStandardMaterial(o); m.name = name; m.skinning = true; return patch(m); };
    const skin = std({ map: skinT.map, normalMap: skinT.normalMap, normalScale: new THREE.Vector2(0.95, 0.95), roughnessMap: skinT.roughnessMap,
      roughness: 1, metalness: 0, emissiveMap: skinT.emissiveMap, emissive: col(0x6dffb4), emissiveIntensity: 0.55 }, 'peau');
    const mouth = std({ map: mouthT.map, normalMap: mouthT.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide }, 'gueule');
    const teeth = std({ vertexColors: true, roughness: 0.42, metalness: 0 }, 'dents');
    const eyeT = makeEyeTexture(THREE);
    const eyes = std({ map: eyeT, roughness: 0.06, metalness: 0, emissive: col(0xe4f0b0), emissiveMap: eyeT, emissiveIntensity: 0.4 }, 'yeux');
    const gill = std({ map: makeMembraneTexture(THREE, 'gill'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.45 }, 'branchies');
    const fin = std({ map: makeMembraneTexture(THREE, 'fin'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 }, 'nageoire');
    const lureT = makeLureTexture(THREE);
    const lure = std({ color: col(0x2c4a40), emissive: col(0x8affd6), emissiveMap: lureT, emissiveIntensity: 2.4, roughness: 0.3 }, 'leurre');
    const list = [skin, mouth, teeth, eyes, gill, fin, lure];
    return { list, skin, mouth, teeth, eyes, gill, fin, lure, U, textures: [skinT.map, skinT.normalMap, skinT.roughnessMap, skinT.emissiveMap, mouthT.map, mouthT.normalMap, eyes.map, gill.map, fin.map, lureT] };
  }

  // ============================================================================================
  // Clips : chaque clip donne des cibles pour les paramètres de pose (fonction du temps t et des
  // consignes D), vers lesquelles la pose converge (amortissement par paramètre). Les événements
  // datés servent à synchroniser sons, effets, caméra et victime.
  // ============================================================================================
  const P0 = { swim: 0.15, freq: 0.18, turn: 0, arch: 0, archBack: 0, roll: 0, headYaw: 0, headPitch: 0, headRoll: 0,
    jaw: 0.04, spread: 0, gill: 0.2, blink: 0, lure: 0.3, glow: 0.15, tuck: 1, paddle: 0, grab: 0, twitch: 0, shake: 0,
    gulp: 0, limp: 0 };
  const RATE = { swim: 2.5, freq: 2, turn: 3, arch: 2.2, archBack: 2, roll: 2.5, headYaw: 5, headPitch: 5, headRoll: 5,
    jaw: 9, spread: 7, gill: 4, blink: 18, lure: 1.5, glow: 3, tuck: 3, paddle: 3, grab: 6, twitch: 6, shake: 8, gulp: 10, limp: 2 };
  const pulse = (t, a, b) => smooth(a, a + (b - a) * 0.35, t) * (1 - smooth(a + (b - a) * 0.65, b, t));

  const CLIPS = {
    // Repos sous l'eau : ondulation lente, branchies qui respirent, barbillons à la dérive
    repos: { loop: true, dur: 8, f: (t) => ({ swim: 0.18, freq: 0.16, gill: 0.25 + 0.15 * Math.sin(t * 1.3), lure: 0.25, glow: 0.12, tuck: 1, jaw: 0.04 + 0.03 * Math.sin(t * 0.7) }) },
    // Nage : amplitude et fréquence suivent la vitesse ; virages par la consigne turn
    nage: { loop: true, dur: 4, f: (t, D) => {
      const v = clamp(D.speed / 6, 0, 1.4);
      return { swim: 0.35 + 0.65 * v, freq: 0.22 + 0.42 * v, turn: clamp(D.turn * 1.4, -1, 1), roll: clamp(-D.turn * 0.35, -0.4, 0.4),
        headYaw: clamp(D.turn * 0.25, -0.3, 0.3), gill: 0.12 + 0.1 * v, tuck: 1, lure: 0.15, glow: 0.15, jaw: 0.03 };
    } },
    // Guet près de la surface : barbillons levés et lumineux (leurres), tête immobile
    guet: { loop: true, dur: 6, f: (t, D) => ({ swim: 0.22, freq: 0.15, turn: clamp(D.turn, -1, 1) * 0.6, arch: 0.08, lure: 1, glow: 0.4,
      gill: 0.3 + 0.1 * Math.sin(t * 1.1), headPitch: 0.06, jaw: 0.06 + 0.04 * Math.sin(t * 0.9), tuck: 0.8, paddle: 0.25 }) },
    // Remontée vers la surface
    remontee: { dur: 2.4, f: (t) => ({ swim: 0.5, freq: 0.32, arch: 0.25 * smooth(0, 1.2, t), headPitch: 0.2, gill: 0.4, tuck: 0.8, lure: 0.6 }) },
    // Plongée / disparition sous l'eau
    plongee: { dur: 2.2, f: (t) => ({ swim: 0.7, freq: 0.45, arch: -0.45 * smooth(0, 0.8, t), archBack: 0.3 * pulse(t, 0.3, 2.2),
      headPitch: -0.25, jaw: 0.02, gill: 0.1, tuck: 1, lure: 0.1, glow: 0.1 }) },
    // Surgissement spectaculaire hors de l'eau : cabrage, gueule ouverte, branchies déployées, pattes en avant
    surgissement: { dur: 3.4, ev: [[0.15, 'eclaboussure'], [0.75, 'cri'], [2.6, 'retombe']],
      f: (t) => {
        const up = smooth(0, 0.7, t) * (1 - smooth(2.4, 3.4, t));
        return { swim: 0.3, freq: 0.3, arch: 0.8 * up, archBack: -0.25 * up, headPitch: (0.25 - 1.15 * smooth(0.7, 1.4, t)) * up,
          jaw: 0.9 * pulse(t, 0.55, 2.3), spread: 0.22 * pulse(t, 0.6, 2.2), gill: 1 * up, tuck: 1 - up, grab: 0.9 * up,
          glow: 1, lure: 0, shake: 0.5 * pulse(t, 0.8, 1.9), blink: 0 };
      } },
    // Cri : gueule grande ouverte, tête secouée
    cri: { dur: 2.2, ev: [[0.1, 'cri']], f: (t) => ({ jaw: 1 * pulse(t, 0, 2.1), spread: 0.4 * pulse(t, 0.05, 2.0), gill: 1, shake: 0.7 * pulse(t, 0.2, 1.8),
      headPitch: 0.25 * pulse(t, 0, 2.1), arch: 0.2, glow: 1, tuck: 0.6, grab: 0.3, lure: 0.05 }) },
    // Préparation d'attaque : se cabre en arrière, gueule qui s'ouvre, branchies et barbillons dressés, grondement
    preparation: { dur: 1.8, ev: [[0.05, 'grondement']], f: (t) => ({ swim: 0.25, freq: 0.25, arch: 0.55 * smooth(0, 1.2, t), headPitch: 0.35 * smooth(0, 1.4, t) - 0.3 * smooth(1.2, 1.8, t),
      jaw: 0.75 * smooth(0.3, 1.6, t), spread: 0.22 * smooth(0.6, 1.7, t), gill: 1, lure: 0.1, glow: 1, tuck: 0.3, grab: 0.8 * smooth(0.5, 1.5, t), shake: 0.15 }) },
    // Ruée (1.2.0) : jaillit de l'eau sur sa proie, gueule béante (demi-mandibules écartées), branchies et
    // pattes déployées ; « jaillit » au départ (le jeu y joue le choc : eau, cri, accord strident) ; la
    // tête se rabat sur la proie (le jeu la pointe sur elle) et la mâchoire se referme à l'impact (0,7 s),
    // secousse, puis elle retombe. Poses rapides (vitesses propres : rate).
    ruee: { dur: 1.9, ev: [[0, 'jaillit'], [0.7, 'impact'], [1.25, 'retombe']],
      rate: { arch: 11, archBack: 8, headPitch: 13, jaw: 16, spread: 13, grab: 12, tuck: 12, gill: 10, glow: 9, shake: 10, swim: 6 },
      f: (t) => {
        const up = smooth(0, 0.28, t) * (1 - smooth(1.0, 1.8, t));
        return { swim: 0.9 * (1 - smooth(0.15, 0.45, t)) + 0.3, freq: 0.9, arch: 0.38 * up - 0.18 * pulse(t, 0.45, 1.1), archBack: -0.2 * up,
          headPitch: 0.35 * smooth(0, 0.2, t) - 0.6 * smooth(0.25, 0.6, t) * (1 - smooth(1.0, 1.7, t)),
          jaw: t < 0.66 ? 1 : 0.2 + 0.4 * pulse(t, 0.8, 1.45), spread: t < 0.66 ? 0.55 * smooth(0, 0.2, t) : 0.06 + 0.1 * pulse(t, 0.8, 1.4),
          grab: up, tuck: 1 - up, gill: 1, glow: 1, lure: 0.15, shake: 0.7 * pulse(t, 0.68, 1.3), headRoll: 0.25 * Math.sin(t * 14) * pulse(t, 0.7, 1.3), blink: 0 };
      } },
    // Attaque contre une barque : retombe gueule ouverte et pattes en avant sur l'embarcation
    attaqueBarque: { dur: 1.9, ev: [[0.42, 'impact'], [1.2, 'arrache']], f: (t) => ({ swim: 0.3, freq: 0.3,
      arch: lerp(0.55, -0.25, smooth(0.1, 0.45, t)) * (1 - smooth(1.3, 1.9, t)), headPitch: lerp(0.35, -0.45, smooth(0.1, 0.45, t)) * (1 - smooth(1.3, 1.9, t)),
      jaw: t < 0.42 ? 0.9 : 0.3 + 0.5 * pulse(t, 0.7, 1.5), spread: t < 0.42 ? 0.28 : 0.1, grab: 1 * (1 - smooth(1.2, 1.8, t)), tuck: smooth(1.2, 1.9, t),
      shake: 0.6 * pulse(t, 0.5, 1.4), gill: 1, glow: 1, lure: 0 }) },
    // Attaque directe sur un joueur : détente du cou, claquement de mâchoire
    attaqueJoueur: { dur: 1.3, ev: [[0.36, 'morsure']], f: (t) => ({ arch: 0.4 * (1 - smooth(0.2, 0.4, t)) + 0.15 * smooth(0.4, 1.3, t),
      headPitch: lerp(0.3, -0.15, smooth(0.15, 0.36, t)), jaw: t < 0.36 ? smooth(0, 0.3, t) * 0.95 : 0.05, spread: t < 0.36 ? 0.42 : 0.05,
      headYaw: 0.15 * Math.sin(t * 9) * pulse(t, 0.36, 1.0), gill: 1, glow: 1, grab: 0.5, tuck: 0.4 }) },
    // Saisie et dévoration : synchronisée avec la victime (ancre « bite »)
    devoration: { dur: 3.6, ev: [[0.32, 'saisie'], [0.9, 'secousse'], [1.6, 'secousse'], [2.35, 'avale'], [3.1, 'plonge']],
      f: (t) => ({ swim: 0.3, freq: 0.3, arch: 0.7 * smooth(0.3, 1, t) * (1 - smooth(2.6, 3.6, t)) - 0.4 * smooth(3, 3.6, t),
        headPitch: 0.5 * smooth(0.3, 1.1, t) * (1 - smooth(2.2, 3.0, t)), jaw: t < 0.3 ? 0.95 : t < 2.2 ? 0.18 + 0.08 * Math.sin(t * 20) : 0.5 * pulse(t, 2.2, 2.6) + 0.02,
        spread: t < 0.3 ? 0.45 : 0.05 + 0.2 * pulse(t, 2.15, 2.6), shake: 1 * (pulse(t, 0.8, 1.35) + pulse(t, 1.5, 2.05)), headRoll: 0.3 * Math.sin(t * 13) * pulse(t, 0.8, 2.05),
        gulp: pulse(t, 2.3, 2.9), gill: 1, glow: 1, tuck: 0.5, grab: 0.7 * (1 - smooth(2.4, 3.2, t)), blink: pulse(t, 2.3, 2.6), lure: 0 }) },
    // Réaction aux dégâts : sursaut de la tête, yeux fermés, gueule entrouverte
    degats: { dur: 0.9, ev: [[0, 'douleur']], f: (t) => ({ headYaw: 0.35 * pulse(t, 0, 0.6) * (t < 0.3 ? 1 : -0.6), headPitch: 0.25 * pulse(t, 0, 0.7),
      jaw: 0.55 * pulse(t, 0, 0.8), blink: pulse(t, 0, 0.5), gill: 1, twitch: 0.5 * pulse(t, 0, 0.6), glow: 1 }) },
    // Affaibli : tête basse, branchies affaissées, nage lourde
    affaibli: { loop: true, dur: 5, f: (t) => ({ swim: 0.3, freq: 0.14, arch: -0.15, headPitch: -0.2, gill: 0.05, limp: 1, lure: 0.05, glow: 0.05,
      jaw: 0.12 + 0.05 * Math.sin(t * 0.8), tuck: 0.5, paddle: 0.4, twitch: 0.08 }) },
    // Mort : convulsions, roulade sur le dos, gueule béante, puis immobilité
    mort: { dur: 6, ev: [[0, 'cri'], [3.8, 'fin']], f: (t) => ({ swim: 0.6 * (1 - smooth(0, 3.5, t)), freq: 0.6, twitch: 1 * (1 - smooth(0.5, 3.8, t)),
      roll: Math.PI * 0.92 * smooth(1, 4.5, t), jaw: 0.7, spread: 0.3, gill: 0, lure: 0, glow: 0, limp: 1, tuck: 0.2, paddle: 0.3 * (1 - smooth(1, 3, t)),
      headPitch: -0.1, blink: smooth(3.5, 4.5, t) }) },
  };

  // ============================================================================================
  // Création
  // ============================================================================================
  function create(THREE, options) {
    const O = Object.assign({ quality: 'medium', renderer: null, shadows: true }, options || {});
    const q = O.quality === 'high' ? 'high' : O.quality === 'low' ? 'low' : 'medium';
    const lin = O.linear !== undefined ? !!O.linear : !!(O.renderer && THREE.sRGBEncoding !== undefined && O.renderer.outputEncoding === THREE.sRGBEncoding);
    const object = new THREE.Group(); object.name = 'mereVase';
    const SK = makeSkeleton(THREE);
    object.add(SK.root);
    object.updateMatrixWorld(true);
    const { geometry, eyeCenters } = buildGeometry(THREE, SK, q);
    const M = makeMaterials(THREE, q, lin);
    // lisibilité de nuit : lueurs (yeux, taches de la ligne latérale, leurres) et peau mouillée (reflets)
    const look = { glow: O.glow === undefined ? 1 : Math.max(0, +O.glow || 0), wet: O.wet === undefined ? 0 : clamp(+O.wet || 0, 0, 1) };
    let lookWet = -1;
    const applyWet = () => {
      if (look.wet === lookWet) return;
      lookWet = look.wet;
      M.skin.roughness = 1 - 0.45 * lookWet; M.mouth.roughness = 0.6 - 0.2 * lookWet; M.gill.roughness = 0.45 - 0.15 * lookWet; M.fin.roughness = 0.55 - 0.2 * lookWet;
    };
    applyWet();
    const mesh = new THREE.SkinnedMesh(geometry, M.list);
    mesh.name = 'mereVaseCorps';
    mesh.frustumCulled = false;
    mesh.castShadow = !!O.shadows; mesh.receiveShadow = true;
    object.add(mesh);
    const skeleton = new THREE.Skeleton(SK.bones);
    mesh.bind(skeleton, mesh.matrixWorld);

    // --- ancres et halos des leurres
    const anchor = (name, bone, x, y, z) => {
      const a = new THREE.Object3D(); a.name = name;
      a.position.set(x - bone.userData.ax, y - bone.userData.ay, z - bone.userData.az);
      bone.add(a); return a;
    };
    const midEyeL = eyeCenters.find((e) => e.side > 0 && e.r > 0.11) || eyeCenters[0];
    const midEyeR = eyeCenters.find((e) => e.side < 0 && e.r > 0.11) || eyeCenters[3];
    const lastL = SK.barbL[SK.barbL.length - 1], lastR = SK.barbR[SK.barbR.length - 1];
    const anchors = {
      mouth: anchor('gueule', SK.head, 0, mouthY(0.05) + 0.15, zOf(0.04)),
      bite: anchor('morsure', SK.jaw, 0, mouthY(0.07) - 0.05, zOf(0.075)),
      throat: anchor('gosier', SK.head, 0, mouthY(SJ) + 0.05, zOf(SJ * 0.92)),
      eyeL: anchor('oeilG', SK.head, midEyeL.x, midEyeL.y, midEyeL.z),
      eyeR: anchor('oeilD', SK.head, midEyeR.x, midEyeR.y, midEyeR.z),
      lureL: anchor('leurreG', lastL, lastL.userData.ax, lastL.userData.ay, lastL.userData.az - 0.05),
      lureR: anchor('leurreD', lastR, lastR.userData.ax, lastR.userData.ay, lastR.userData.az - 0.05),
      chest: anchor('poitrail', SK.spine[3], 0, YC(0.3), zOf(0.3)),
      tail: anchor('queue', SK.spine[13], 0, YC(0.915), zOf(0.915)),
      clawL: anchor('griffeG', SK.legs[0][2], SK.legs[0][2].userData.ax, SK.legs[0][2].userData.ay - 0.2, SK.legs[0][2].userData.az + 0.5),
      clawR: anchor('griffeD', SK.legs[1][2], SK.legs[1][2].userData.ax, SK.legs[1][2].userData.ay - 0.2, SK.legs[1][2].userData.az + 0.5),
      head: anchor('tete', SK.head, 0, YC(0.06) + 0.5, zOf(0.06)),
    };
    const glowTex = makeGlowTexture(THREE);
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x9dffd8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    const glows = [anchors.lureL, anchors.lureR].map((a) => {
      const sp = new THREE.Sprite(glowMat); sp.scale.setScalar(1.6); a.add(sp); return sp;
    });

    // --- état d'animation
    const P = Object.assign({}, P0), T = Object.assign({}, P0);
    const D = { speed: 0, turn: 0 };
    let clipName = 'repos', clip = CLIPS.repos, ct = 0, cspeed = 1, evI = 0, nextClip = null, phase = 0, time = 0, rate = RATE;
    const listeners = {};
    const emit = (name, data) => {
      for (const fn of listeners[name] || []) fn(name, data);
      for (const fn of listeners['*'] || []) fn(name, data);
    };
    const overrides = {};

    // --- colonne : courbe → os
    const NS = SPINE_S.length, sRoot = SPINE_S[ROOT_K];
    const rest = SPINE_S.map((s) => [0, YC(s), zOf(s)]);
    const segL = []; for (let k = 0; k < NS - 1; k++) segL.push(Math.hypot(rest[k + 1][1] - rest[k][1], rest[k + 1][2] - rest[k][2]));
    const X = new Float32Array(NS), Y = new Float32Array(NS), PX = new Float32Array(NS), PY = new Float32Array(NS), PZ = new Float32Array(NS);
    const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3();
    const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
    function solveSpine(dt) {
      const amp = (s) => P.swim * (0.08 + 1.15 * Math.pow(Math.max(0, (s - 0.3) / 0.7), 1.6));
      const kap = P.turn / 8.5;
      for (let k = 0; k < NS; k++) {
        const s = SPINE_S[k], d = (s - sRoot) * LEN;
        let x = kap * d * d * 0.5 + amp(s) * Math.sin(TAU * (phase - (s - sRoot) / 0.9));
        let y = YC(s);
        if (s < sRoot) y += P.arch * 6.2 * Math.pow((sRoot - s) / sRoot, 1.45);
        else y += P.archBack * 2.6 * Math.pow((s - sRoot) / (1 - sRoot), 2);
        y += P.swim * 0.1 * Math.sin(TAU * (phase * 0.5 - s / 0.7)) * smooth(0.4, 1, s);
        if (P.twitch > 0.001) {
          x += P.twitch * 0.55 * N.n3(s * 5, time * 7, 1.3);
          y += P.twitch * 0.4 * N.n3(s * 5, time * 7, 7.9);
        }
        if (P.limp > 0) y -= P.limp * 0.35 * Math.pow(Math.abs(s - sRoot) / 0.6, 2);
        X[k] = x; Y[k] = y;
      }
      PX[ROOT_K] = X[ROOT_K]; PY[ROOT_K] = Y[ROOT_K]; PZ[ROOT_K] = 0;
      const step = (k, from, dir) => {
        const L = segL[Math.min(k, from)];
        let dx = X[k] - X[from], dy = Y[k] - Y[from];
        const l2 = dx * dx + dy * dy, max2 = 0.84 * L * L;
        if (l2 > max2) { const f = Math.sqrt(max2 / l2); dx *= f; dy *= f; }
        PX[k] = PX[from] + dx; PY[k] = PY[from] + dy; PZ[k] = PZ[from] + dir * Math.sqrt(Math.max(0.01, L * L - dx * dx - dy * dy));
      };
      for (let k = ROOT_K - 1; k >= 0; k--) step(k, k + 1, 1);
      for (let k = ROOT_K + 1; k < NS; k++) step(k, k - 1, -1);
      for (let k = 0; k < NS; k++) {
        const a = Math.max(0, k - 1), b = Math.min(NS - 1, k + 1);
        _f.set(PX[a] - PX[b], PY[a] - PY[b], PZ[a] - PZ[b]).normalize();
        _u.set(0, 1, 0);
        _x.crossVectors(_u, _f).normalize(); _y.crossVectors(_f, _x);
        const s = SPINE_S[k], roll = P.roll * (0.6 + 0.4 * smooth(0, 1, s)) + (P.twitch > 0.001 ? P.twitch * 0.3 * N.n3(s * 3, time * 6, 4.4) : 0);
        if (roll) {
          const c = Math.cos(roll), sn = Math.sin(roll);
          const xx = _x.x * c + _y.x * sn, xy = _x.y * c + _y.y * sn, xz = _x.z * c + _y.z * sn;
          _y.set(-_x.x * sn + _y.x * c, -_x.y * sn + _y.y * c, -_x.z * sn + _y.z * c); _x.set(xx, xy, xz);
        }
        _m.makeBasis(_x, _y, _f);
        const b0 = SK.spine[k];
        b0.position.set(PX[k], PY[k], PZ[k]);
        b0.quaternion.setFromRotationMatrix(_m);
      }
      // tête : orientation propre + secousses
      const sh = P.shake;
      _e.set(-(P.headPitch) + (sh ? sh * 0.18 * N.n3(time * 9, 1.1, 0.3) : 0), P.headYaw + (sh ? sh * 0.32 * N.n3(time * 9, 2.2, 0.7) : 0),
        P.headRoll + (sh ? sh * 0.2 * N.n3(time * 9, 3.3, 0.1) : 0), 'YXZ');
      _q.setFromEuler(_e);
      SK.head.quaternion.multiply(_q);
      SK.spine[1].scale.set(1 + 0.16 * P.gulp, 1 + 0.32 * P.gulp, 1 + 0.05 * P.gulp);
    }

    // --- mâchoire, branchies, membres
    function solveParts() {
      SK.jaw.rotation.set(P.jaw * 0.74, 0, 0);
      SK.mandL.rotation.set(0, P.spread * 0.24, -P.spread * 0.08);
      SK.mandR.rotation.set(0, -P.spread * 0.24, P.spread * 0.08);
      SK.gills.forEach((g, i) => {
        const side = g.userData.ax > 0 ? 1 : -1, br = 0.06 * Math.sin(time * 1.6 + i * 0.9) * (1 - P.limp);
        const fl = P.gill * (1 - P.limp * 0.9);
        g.rotation.set(-0.15 * fl - P.limp * 0.4, side * (0.1 + 0.6 * fl + br), side * (0.25 * fl - 0.3 * P.limp));
      });
      SK.legs.forEach((L, i) => {
        const side = L[0].userData.ax > 0 ? 1 : -1, front = i < 2;
        const ph = phase * TAU * 0.5 + (i === 0 || i === 3 ? 0 : Math.PI);
        const pad = P.paddle * 0.55 * Math.sin(ph);
        const tuck = P.tuck, grab = P.grab * (front ? 1 : 0.35);
        L[0].rotation.set(-0.25 * grab, side * (1.0 * tuck - 0.95 * grab + pad), side * (0.4 * tuck + 0.6 * grab - 0.25 * P.limp));
        L[1].rotation.set(0.2 * grab, side * (0.55 * tuck - 0.2 * grab + pad * 0.5), side * 0.25 * grab);
        L[2].rotation.set(0.5 * grab - 0.2 * tuck, side * 0.35 * tuck, 0);
      });
    }

    // --- barbillons : chaîne de points simulée dans le monde (inertie, traînée, retour à la forme)
    const barbels = [SK.barbL, SK.barbR].map((chain, ci) => {
      const side = ci === 0 ? 1 : -1;
      const pts = chain.map((b) => new THREE.Vector3(b.userData.ax - SK.head.userData.ax, b.userData.ay - SK.head.userData.ay, b.userData.az - SK.head.userData.az));
      const last = chain[chain.length - 1], prevB = chain[chain.length - 2];
      const tip = new THREE.Vector3(2 * last.userData.ax - prevB.userData.ax - SK.head.userData.ax, 2 * last.userData.ay - prevB.userData.ay - SK.head.userData.ay, 2 * last.userData.az - prevB.userData.az - SK.head.userData.az);
      pts.push(tip);
      const len = []; for (let i = 0; i < pts.length - 1; i++) len.push(pts[i].distanceTo(pts[i + 1]));
      const restDir = []; for (let i = 0; i < chain.length; i++) restDir.push(pts[i + 1].clone().sub(pts[i]).normalize());
      // pose « leurre » : le barbillon monte vers l'avant puis s'allonge à l'horizontale (directions par segment)
      const liftDir = restDir.map((_, i) => {
        const t = i / (restDir.length - 1);
        return new THREE.Vector3(side * (0.5 - 0.3 * t), 0.85 - 0.8 * t, 0.55 + 0.45 * t).normalize();
      });
      const tgt = pts.map(() => new THREE.Vector3());
      return { chain, side, restLocal: pts, len, restDir, liftDir, tgt, X: pts.map(() => new THREE.Vector3()), Xp: pts.map(() => new THREE.Vector3()), init: false };
    });
    let waterY = -1e9;
    const _hw = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _hqi = new THREE.Quaternion(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _pq = new THREE.Quaternion();
    function solveBarbels(dt) {
      SK.head.updateMatrixWorld(true);
      _hw.copy(SK.head.matrixWorld);
      SK.head.getWorldQuaternion(_hq); _hqi.copy(_hq).invert ? _hqi.copy(_hq).invert() : _hqi.copy(_hq).inverse();
      const scaleW = object.scale.x || 1;
      for (const B of barbels) {
        const n = B.X.length;
        const lift = P.lure * (1 - P.limp);
        // cible : chaîne reconstruite segment par segment (longueurs exactes, pas de flambage) en mêlant la
        // direction de repos (vers l'arrière, un peu tombante) et la direction « leurre » (vers l'avant, en haut)
        B.tgt[0].copy(B.restLocal[0]);
        for (let i = 0; i < n - 1; i++) {
          const t = i / (n - 2);
          const sway = 0.22 * Math.sin(time * 0.6 + i * 0.45 + B.side * 1.7) * t + 0.08 * Math.sin(time * 1.7 + i * 1.3);
          _d.copy(B.restDir[i]); _d.y -= 0.18 * t * (1 - lift);
          _d.lerp(B.liftDir[i], lift);
          _d.x += B.side * sway * 0.6; _d.y += sway * 0.25;
          _d.normalize();
          B.tgt[i + 1].copy(B.tgt[i]).addScaledVector(_d, B.len[i]);
        }
        const target = (i, out) => out.copy(B.tgt[i]).applyMatrix4(_hw);
        if (!B.init) { for (let i = 0; i < n; i++) { target(i, B.X[i]); B.Xp[i].copy(B.X[i]); } B.init = true; }
        const k = 26, drag = Math.min(0.9, 2.6 * dt);
        for (let i = 1; i < n; i++) {
          target(i, _t);
          const x = B.X[i], xp = B.Xp[i];
          _d.copy(x).sub(xp).multiplyScalar(1 - drag);
          xp.copy(x);
          x.add(_d).addScaledVector(_t.sub(x), Math.min(1, k * dt * dt * (1 + i * 0.2)));
        }
        if (lift > 0.05) for (let i = Math.floor(n * 0.45); i < n; i++) {
          const x = B.X[i], fy = waterY + 0.04 - (i === n - 1 ? 0 : 0.05);
          if (x.y < fy) x.y += Math.min(fy - x.y, lift * dt * (2.5 + 4 * i / n));
          else if (x.y > fy + 0.25 && lift > 0.6) x.y = damp(x.y, fy + 0.2, 2, dt);
        }
        target(0, B.X[0]);
        for (let it = 0; it < 3; it++) {
          for (let i = 1; i < n; i++) {
            const a = B.X[i - 1], b = B.X[i], L = B.len[i - 1] * scaleW;
            _d.copy(b).sub(a); const l = _d.length() || 1;
            b.copy(a).addScaledVector(_d, L / l);
          }
        }
        // orienter les os : direction de repos (repère tête) → direction simulée
        _pq.copy(_hq);
        for (let i = 0; i < B.chain.length; i++) {
          _d.copy(B.X[i + 1]).sub(B.X[i]).normalize().applyQuaternion(_hqi);
          _q.setFromUnitVectors(B.restDir[i], _d);
          _q2.copy(_hq).multiply(_q);                       // orientation monde voulue
          const pinv = _pq.clone(); pinv.invert ? pinv.invert() : pinv.inverse();
          B.chain[i].quaternion.copy(pinv.multiply(_q2));
          _pq.copy(_q2);
        }
      }
    }

    // --- lecture des clips
    function play(name, opts) {
      const c = CLIPS[name];
      if (!c) return 0;
      opts = opts || {};
      if (name === clipName && c.loop && !opts.restart) { cspeed = opts.speed || cspeed; return c.dur; }
      clipName = name; clip = c; ct = 0; evI = 0; cspeed = opts.speed || 1;
      rate = c.rate ? (c.rateAll || (c.rateAll = Object.assign({}, RATE, c.rate))) : RATE;
      nextClip = opts.next || null;
      return c.dur / cspeed;
    }
    function update(dt) {
      dt = Math.min(dt, 0.1);
      time += dt;
      ct += dt * cspeed;
      // un repère peut lancer un autre clip (le jeu : « impact » de la ruée → dévoration) : on compte le
      // repère avant de l'émettre, et on s'arrête si le clip a changé (1.2.1 : le premier repère du nouveau
      // clip, « saisie », était sauté)
      if (clip.ev) while (evI < clip.ev.length && ct >= clip.ev[evI][0]) { const c0 = clip, nm = clip.ev[evI][1]; evI++; emit(nm, { clip: clipName }); if (clip !== c0) break; }
      if (!clip.loop && ct >= clip.dur) {
        const done = clipName;
        emit('fin:' + done, { clip: done });
        if (done === 'mort') ct = clip.dur;                // reste sur la dernière pose
        else play(nextClip || (D.speed > 0.5 ? 'nage' : 'repos'));
      }
      const tgt = clip.f(clip.loop ? ct % clip.dur + Math.floor(ct / clip.dur) * clip.dur : ct, D);
      for (const k in P0) T[k] = tgt[k] !== undefined ? tgt[k] : P0[k];
      for (const k in overrides) if (overrides[k] !== undefined && overrides[k] !== null) T[k] = overrides[k];
      for (const k in P) P[k] = damp(P[k], T[k], rate[k], dt);
      phase += P.freq * dt;
      solveSpine(dt);
      solveParts();
      object.updateMatrixWorld(true);
      solveBarbels(dt);
      // matières : lueur des yeux et des leurres, flash d'impact
      const G = look.glow;
      applyWet();
      M.eyes.emissiveIntensity = (0.45 + 1.3 * P.glow) * (1 - 0.85 * P.blink) * G;
      const pul = 0.75 + 0.25 * Math.sin(time * 2.3) * Math.sin(time * 0.67 + 1);
      M.lure.emissiveIntensity = (0.6 + 3.2 * P.lure) * pul * (1 - P.limp) * G;
      glowMat.opacity = clamp((0.1 + 0.55 * P.lure) * Math.min(G, 1.5), 0, 1) * pul * (1 - P.limp);
      for (const g of glows) g.scale.setScalar((0.7 + 0.9 * P.lure) * (0.8 + 0.2 * Math.min(G, 2)));
      M.skin.emissiveIntensity = (0.25 + 0.6 * P.glow) * G;
      M.U.uHit.value = Math.max(0, M.U.uHit.value - dt * 3.5);
    }

    // --- capsules de tir (os, décalages locaux, rayon, partie, multiplicateur)
    const CAPS = [];
    const cap = (bone, a, bone2, b, r, part, mult) => CAPS.push({ bone, a: new THREE.Vector3(...a), bone2: bone2 || bone, b: new THREE.Vector3(...b), r, part, mult });
    const rel = (bone, x, y, z) => [x - bone.userData.ax, y - bone.userData.ay, z - bone.userData.az];
    {
      const hd = SK.head;
      cap(hd, rel(hd, 0.95, YC(0.04), zOf(0.03)), hd, rel(hd, 1.05, YC(0.14), zOf(0.14)), 0.62, 'tete', 1.2);
      cap(hd, rel(hd, -0.95, YC(0.04), zOf(0.03)), hd, rel(hd, -1.05, YC(0.14), zOf(0.14)), 0.62, 'tete', 1.2);
      cap(hd, rel(hd, 0, YC(0.02), zOf(0.02)), hd, rel(hd, 0, YC(0.15), zOf(0.15)), 0.55, 'tete', 1.2);
      cap(SK.jaw, rel(SK.jaw, 0, mouthY(0.05) - 0.35, zOf(0.04)), SK.jaw, rel(SK.jaw, 0, mouthY(0.14) - 0.4, zOf(0.14)), 0.55, 'machoire', 1);
      cap(SK.jaw, rel(SK.jaw, 0, mouthY(0.06) + 0.05, zOf(0.06)), SK.jaw, rel(SK.jaw, 0, mouthY(0.13) + 0.05, zOf(0.13)), 0.6, 'gueule', 2.2);
      for (const e of eyeCenters) cap(hd, rel(hd, e.x, e.y, e.z), hd, rel(hd, e.x, e.y, e.z), e.r * 1.45, 'oeil', 3);
      for (const g of SK.gills) cap(g, [0, 0, 0], g, [g.userData.ax > 0 ? 0.35 : -0.35, 0.35, -0.9], 0.3, 'branchie', 1.6);
      for (const ch of [SK.barbL, SK.barbR]) { const b = ch[ch.length - 1]; cap(b, [0, 0, -0.05], b, [0, 0, -0.05], 0.3, 'leurre', 1.5); }
      for (let k = 0; k < NS - 1; k++) {
        const s = (SPINE_S[k] + SPINE_S[k + 1]) / 2, r = Math.min(widthAt(s), heightAt(s)) * 0.95 + 0.1;
        cap(SK.spine[k], [0, 0, 0], SK.spine[k + 1], [0, 0, 0], r, s < 0.62 ? 'corps' : 'queue', s < 0.62 ? 1 : 0.8);
      }
      for (const L of SK.legs) { cap(L[0], [0, 0, 0], L[1], [0, 0, 0], 0.32, 'patte', 0.8); cap(L[1], [0, 0, 0], L[2], [0, 0, 0], 0.25, 'patte', 0.8); }
    }
    const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _hit = { t: 0, part: '', mult: 1, x: 0, y: 0, z: 0 };
    function hitTest(ox, oy, oz, dx, dy, dz, maxT) {
      let best = maxT, bc = null;
      const sc = object.scale.x || 1;
      for (const c of CAPS) {
        if (c.part === 'gueule' && P.jaw < 0.35) continue;
        _A.copy(c.a).applyMatrix4(c.bone.matrixWorld); _B.copy(c.b).applyMatrix4(c.bone2.matrixWorld);
        const r = c.r * sc;
        // distance rayon / segment
        const ux = _B.x - _A.x, uy = _B.y - _A.y, uz = _B.z - _A.z, wx = ox - _A.x, wy = oy - _A.y, wz = oz - _A.z;
        const a = dx * dx + dy * dy + dz * dz, b = dx * ux + dy * uy + dz * uz, cc = ux * ux + uy * uy + uz * uz;
        const d = dx * wx + dy * wy + dz * wz, e = ux * wx + uy * wy + uz * wz;
        const den = a * cc - b * b;
        let t, u;
        if (den < 1e-8) { t = 0; u = cc > 0 ? clamp(e / cc, 0, 1) : 0; } else { t = (b * e - cc * d) / den; u = clamp((a * e - b * d) / den, 0, 1); }
        if (cc > 0) { t = Math.max(0, (u * b - d) / a); u = clamp((t * b + e) / cc, 0, 1); } else t = Math.max(0, -d / a);
        const px = ox + dx * t - (_A.x + ux * u), py = oy + dy * t - (_A.y + uy * u), pz = oz + dz * t - (_A.z + uz * u);
        const dist2 = px * px + py * py + pz * pz;
        if (dist2 > r * r) continue;
        const th = t - Math.sqrt(Math.max(0, r * r - dist2));
        const priority = c.part === 'oeil' || c.part === 'gueule' || c.part === 'leurre' ? 0.25 : 0;   // les points faibles l'emportent de peu
        if (th - priority < best) { best = th - priority; bc = c; _hit.t = Math.max(0, th); }
      }
      if (!bc) return null;
      _hit.part = bc.part; _hit.mult = bc.mult;
      _hit.x = ox + dx * _hit.t; _hit.y = oy + dy * _hit.t; _hit.z = oz + dz * _hit.t;
      return _hit;
    }

    play('repos');
    update(0.016);

    return {
      object, mesh, skeleton, bones: SK.byName, anchors, materials: M, clips: Object.keys(CLIPS), look,
      play, update,
      drive(o) { if (o.speed !== undefined) D.speed = o.speed; if (o.turn !== undefined) D.turn = o.turn; },
      set(o) { Object.assign(overrides, o); },
      clearOverrides() { for (const k in overrides) delete overrides[k]; },
      on(name, fn) { (listeners[name] || (listeners[name] = [])).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; },
      flash(k) { M.U.uHit.value = Math.max(M.U.uHit.value, k === undefined ? 1 : k); },
      setWater(y, depthK) { M.U.uWaterY.value = y; waterY = y; if (depthK !== undefined) M.U.uDepthK.value = depthK; },
      hitTest,
      get state() { return { clip: clipName, t: ct, dur: clip.dur, loop: !!clip.loop, params: P }; },
      get length() { return LEN * (object.scale.x || 1); },
      stats: { triangles: geometry.index.count / 3, bones: SK.bones.length, drawCalls: geometry.groups.length },
      dispose() {
        geometry.dispose(); for (const m of M.list) m.dispose(); for (const t of M.textures) if (t) t.dispose();
        glowTex.dispose(); glowMat.dispose();
        if (object.parent) object.parent.remove(object);
      },
    };
  }

  const api = { create, CLIPS: Object.keys(CLIPS), LENGTH: LEN, VERSION: '1.2.1' };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.MereVase = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : undefined);
