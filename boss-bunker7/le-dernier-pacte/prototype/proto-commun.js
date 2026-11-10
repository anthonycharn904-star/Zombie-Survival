/*!
 * proto-commun.js — Outils communs du mini-moteur du prototype (boss de Bunker 7).
 * Aléatoire à graine, bruit, petits vecteurs, compatibilité Three.js r128 ↔ récent (couleurs, lumières),
 * textures procédurales (pierre, dalles, béton, métal, bois, crasse) et atlas de glyphes occultes INVENTÉS.
 * Global : ProtoB7Commun. Aucune dépendance (Three.js est passé en paramètre).
 */
(function (root) {
  'use strict';

  // ── aléatoire reproductible (mulberry32) ──
  function rng(graine) {
    var a = (graine >>> 0) || 1;
    var f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.entre = function (a0, b0) { return a0 + (b0 - a0) * f(); };
    f.entier = function (a0, b0) { return Math.floor(a0 + (b0 - a0 + 1) * f()); };
    f.choix = function (arr) { return arr[Math.floor(f() * arr.length) % arr.length]; };
    return f;
  }

  // ── bruit de valeur 2D/3D (déterministe) ──
  function hash2(ix, iy, s) {
    var h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function hash3(ix, iy, iz, s) { return hash2(ix + Math.imul(iz | 0, 1013), iy - Math.imul(iz | 0, 7919), s); }
  function lisse(t) { return t * t * (3 - 2 * t); }
  function bruit2(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    var u = lisse(fx), v = lisse(fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm2(x, y, s, oct) {
    var v = 0, amp = 0.5, f = 1, tot = 0;
    for (var o = 0; o < (oct || 4); o++) { v += amp * bruit2(x * f, y * f, s + o * 17); tot += amp; amp *= 0.5; f *= 2.03; }
    return v / tot;
  }
  // bruit périodique (texture qui se répète sans couture) : période p cellules
  function bruit2p(x, y, s, p) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var m = function (i) { return ((i % p) + p) % p; };
    var a = hash2(m(ix), m(iy), s), b = hash2(m(ix + 1), m(iy), s), c = hash2(m(ix), m(iy + 1), s), d = hash2(m(ix + 1), m(iy + 1), s);
    var u = lisse(fx), v = lisse(fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm2p(x, y, s, p, oct) {
    var v = 0, amp = 0.5, f = 1, tot = 0;
    for (var o = 0; o < (oct || 4); o++) { v += amp * bruit2p(x * f, y * f, s + o * 17, p * f); tot += amp; amp *= 0.5; f *= 2; }
    return v / tot;
  }

  // ── petits outils ──
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function angleDiff(a, b) { var d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }
  function hexVersRgb(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
  function srgbVersLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  /** Couleur hex sRGB → [r, g, b] linéaire (couleurs de sommets : Three.js ne les convertit jamais). */
  function lin(h) { var c = hexVersRgb(h); return [srgbVersLin(c[0]), srgbVersLin(c[1]), srgbVersLin(c[2])]; }
  function melange(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

  // ── compatibilité Three.js r128 ↔ r152+ (gestion des couleurs, unités de lumière) ──
  function compat(THREE) {
    var rev = parseInt(THREE.REVISION, 10) || 0;
    var moderne = rev >= 152;
    var C = {
      rev: rev, moderne: moderne,
      /** Couleur de matériau à partir d'un hex sRGB, correcte dans les deux familles de versions. */
      couleur: function (hex) { var c = new THREE.Color(hex); if (!moderne) c.convertSRGBToLinear(); return c; },
      texSRGB: function (t) { if (moderne && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding; return t; },
      texDonnees: function (t) { if (moderne && THREE.NoColorSpace !== undefined) t.colorSpace = THREE.NoColorSpace; else if (THREE.LinearEncoding !== undefined) t.encoding = THREE.LinearEncoding; return t; },
      /** Réglages de rendu identiques dans les deux familles : sortie sRGB, lumières physiques, ACES. */
      configurerRendu: function (renderer) {
        if (moderne) { if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace; }
        else { renderer.outputEncoding = THREE.sRGBEncoding; renderer.physicallyCorrectLights = true; }
        if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
      }
    };
    return C;
  }

  // ── textures procédurales (canvas) ──
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }
  /** Carte de normales à partir d'une hauteur (Float32Array, n×n, répétable). force = pente. */
  function normalesDepuisHauteur(H, n, force) {
    var c = canvas(n, n), g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var xl = (x - 1 + n) % n, xr = (x + 1) % n, yu = (y - 1 + n) % n, yd = (y + 1) % n;
        var dx = (H[y * n + xr] - H[y * n + xl]) * force, dy = (H[yd * n + x] - H[yu * n + x]) * force;
        // repère tangent « OpenGL » : +X à droite, +Y vers le haut de l'image (le canvas a Y vers le bas)
        var nx = -dx, ny = dy, nz = 1, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
        var i = (y * n + x) * 4;
        d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function ecrireCouleur(n, fn) {
    var c = canvas(n, n), g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var col = fn(x, y), i = (y * n + x) * 4;
      d[i] = clamp(col[0], 0, 1) * 255; d[i + 1] = clamp(col[1], 0, 1) * 255; d[i + 2] = clamp(col[2], 0, 1) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /** Blocs de pierre appareillés (murs). Une texture couvre `metres` × `metres`. */
  function texPierre(n, graine, opts) {
    opts = opts || {};
    var R = rng(graine || 11), H = new Float32Array(n * n), base = opts.teinte || [0.30, 0.29, 0.27];
    var rangs = opts.rangs || 5, mortier = opts.mortier || 0.014, K = opts.contraste != null ? opts.contraste : 0.42;
    // gabarit : rangées de blocs de longueurs variables (en unités de texture 0..1)
    var blocs = [];
    for (var r = 0; r < rangs; r++) {
      var y0 = r / rangs, y1 = (r + 1) / rangs, x = R() * 0.2;
      var debut = x;
      while (x < debut + 1) {
        var L = R.entre(0.16, 0.34);
        if (x + L > debut + 1 - 0.08) L = debut + 1 - x;
        blocs.push({ x0: x, x1: x + L, y0: y0, y1: y1, t: R.entre(-0.06, 0.06), h: R.entre(0.85, 1.0), s: R.entier(0, 9999) });
        x += L;
      }
    }
    var cel = new Int32Array(n * n).fill(-1), dist = new Float32Array(n * n);
    for (var bi = 0; bi < blocs.length; bi++) {
      var b = blocs[bi];
      for (var py = Math.floor(b.y0 * n); py < Math.ceil(b.y1 * n); py++) {
        for (var px = Math.floor(b.x0 * n); px < Math.ceil(b.x1 * n); px++) {
          var X = ((px % n) + n) % n, Y = ((py % n) + n) % n, u = (px + 0.5) / n, v = (py + 0.5) / n;
          var e = Math.min(u - b.x0, b.x1 - u, v - b.y0, b.y1 - v);
          if (e < 0) continue;
          var i = Y * n + X;
          if (cel[i] < 0 || e > dist[i]) { cel[i] = bi; dist[i] = e; }
        }
      }
    }
    var col = new Float32Array(n * n * 3);
    for (var y = 0; y < n; y++) for (var x2 = 0; x2 < n; x2++) {
      var j = y * n + x2, bb = blocs[Math.max(0, cel[j])], e2 = dist[j];
      var u2 = x2 / n, v2 = y / n;
      var grain = fbm2p(u2 * 64, v2 * 64, 3, 64, 3), large = fbm2p(u2 * 8, v2 * 8, 5 + bb.s % 7, 8, 4);
      var bord = smooth(mortier * 0.4, mortier * 2.2 + 0.006 * large, e2);          // arêtes émoussées
      var eclat = fbm2p(u2 * 24, v2 * 24, 9 + bb.s % 5, 24, 3);
      var h = (bord * (bb.h - 0.25 * eclat * (1 - smooth(0, 0.05, e2))) + 0.12 * grain + 0.1 * large);
      if (e2 < mortier) h = 0.08 * grain;
      H[j] = h;
      var t = 0.82 + bb.t * 2.2 + 0.3 * (large - 0.5) + 0.2 * (grain - 0.5);
      var c = [base[0] * t, base[1] * t, base[2] * t * 0.98];
      if (e2 < mortier) c = [base[0] * K, base[1] * K, base[2] * K * 0.97];
      // coulures sombres depuis les joints horizontaux
      var coul = fbm2p(u2 * 40, v2 * 3, 21, 40, 3);
      var t2 = smooth(0.62, 0.8, coul) * 0.35;
      c = melange(c, [c[0] * 0.45, c[1] * 0.42, c[2] * 0.40], t2);
      col[j * 3] = c[0]; col[j * 3 + 1] = c[1]; col[j * 3 + 2] = c[2];
    }
    // fissures fines (polylignes)
    for (var k = 0; k < (opts.fissures || 7); k++) {
      var fx = R(), fy = R(), ang = R() * Math.PI * 2;
      for (var s = 0; s < 70; s++) {
        ang += R.entre(-0.5, 0.5); fx += Math.cos(ang) * 1.2 / n; fy += Math.sin(ang) * 1.2 / n;
        var X2 = ((Math.floor(fx * n) % n) + n) % n, Y2 = ((Math.floor(fy * n) % n) + n) % n, q = Y2 * n + X2;
        H[q] -= 0.18; col[q * 3] *= 0.45; col[q * 3 + 1] *= 0.45; col[q * 3 + 2] *= 0.45;
      }
    }
    var map = ecrireCouleur(n, function (x, y) { var q = (y * n + x) * 3; return [col[q], col[q + 1], col[q + 2]]; });
    return { map: map, normal: normalesDepuisHauteur(H, n, opts.relief || 9), hauteur: H };
  }

  /** Grandes dalles de sol usées (joints crasseux, fissures, taches). */
  function texDalles(n, graine, opts) {
    opts = opts || {};
    var R = rng(graine || 23), cases = opts.cases || 4, base = opts.teinte || [0.24, 0.235, 0.225];
    var H = new Float32Array(n * n), teintes = [];
    for (var i = 0; i < cases * cases; i++) teintes.push(R.entre(-0.07, 0.07));
    var cv = ecrireCouleur(n, function (x, y) {
      var u = x / n, v = y / n, cu = u * cases, cvv = v * cases, ix = Math.floor(cu), iy = Math.floor(cvv);
      var fu = cu - ix, fv = cvv - iy, e = Math.min(fu, 1 - fu, fv, 1 - fv) / cases;
      var grain = fbm2p(u * 96, v * 96, 4, 96, 3), large = fbm2p(u * 6, v * 6, 8, 6, 4);
      var usure = fbm2p(u * 14, v * 14, 12, 14, 4);
      var joint = 1 - smooth(0.002, 0.006, e);
      H[y * n + x] = (1 - joint) * (0.8 + 0.1 * grain - 0.25 * smooth(0.6, 0.9, usure)) + 0.05 * grain;
      var t = 0.84 + teintes[(iy % cases) * cases + (ix % cases)] + 0.25 * (large - 0.5) + 0.14 * (grain - 0.5);
      var c = [base[0] * t, base[1] * t, base[2] * t];
      c = melange(c, [c[0] * 0.45, c[1] * 0.43, c[2] * 0.42], joint * 0.8);
      var tache = smooth(0.58, 0.75, fbm2p(u * 5, v * 5, 31, 5, 5));
      c = melange(c, [c[0] * 0.55, c[1] * 0.5, c[2] * 0.48], tache * 0.6);
      var rouille = smooth(0.7, 0.85, fbm2p(u * 9, v * 9, 47, 9, 4)) * (opts.residuRouge || 0.25);
      c = melange(c, [0.20, 0.06, 0.045], rouille);
      return c;
    });
    for (var k = 0; k < 9; k++) {
      var fx = R(), fy = R(), ang = R() * 6.28;
      for (var s = 0; s < 90; s++) {
        ang += R.entre(-0.45, 0.45); fx += Math.cos(ang) * 1.3 / n; fy += Math.sin(ang) * 1.3 / n;
        var X = ((Math.floor(fx * n) % n) + n) % n, Y = ((Math.floor(fy * n) % n) + n) % n;
        H[Y * n + X] -= 0.25;
      }
    }
    var g = cv.getContext('2d');
    g.globalAlpha = 0.5; g.strokeStyle = '#141210'; g.lineWidth = 1;
    var R2 = rng((graine || 23) + 1);
    for (var k2 = 0; k2 < 9; k2++) {
      g.beginPath(); var x0 = R2() * n, y0 = R2() * n; g.moveTo(x0, y0);
      var a = R2() * 6.28;
      for (var s2 = 0; s2 < 40; s2++) { a += (R2() - 0.5) * 0.9; x0 += Math.cos(a) * 3; y0 += Math.sin(a) * 3; g.lineTo(x0, y0); }
      g.stroke();
    }
    return { map: cv, normal: normalesDepuisHauteur(H, n, opts.relief || 6) };
  }

  /** Béton de bunker : marques de coffrage, éclats, coulures, taches d'humidité. */
  function texBeton(n, graine, opts) {
    opts = opts || {};
    var R = rng(graine || 37), base = opts.teinte || [0.42, 0.41, 0.385], H = new Float32Array(n * n);
    var planches = opts.planches || 6;
    var cv = ecrireCouleur(n, function (x, y) {
      var u = x / n, v = y / n;
      var grain = fbm2p(u * 128, v * 128, 2, 128, 2), large = fbm2p(u * 4, v * 4, 6, 4, 5);
      var pv = v * planches, fv = pv - Math.floor(pv);
      var joint = 1 - smooth(0.0, 0.03, Math.min(fv, 1 - fv));
      var trous = smooth(0.9, 0.95, bruit2p(u * 90, v * 90, 77, 90));
      H[y * n + x] = 0.6 + 0.15 * grain - 0.3 * joint - 0.25 * trous + 0.1 * large;
      var t = 0.86 + 0.28 * (large - 0.5) + 0.12 * (grain - 0.5);
      var c = [base[0] * t, base[1] * t, base[2] * t];
      c = melange(c, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.68], joint * 0.6 + trous * 0.35);
      var humide = smooth(0.55, 0.8, fbm2p(u * 3, v * 1.5, 19, 3, 5)) * smooth(0.3, 1.0, v);
      c = melange(c, [c[0] * 0.55, c[1] * 0.56, c[2] * 0.52], humide * 0.7);
      var coul = smooth(0.55, 0.75, fbm2p(u * 30, v * 2, 53, 30, 3)) * 0.4;
      c = melange(c, [0.16, 0.14, 0.12], coul);
      return c;
    });
    return { map: cv, normal: normalesDepuisHauteur(H, n, opts.relief || 5) };
  }

  /** Métal peint écaillé / rouillé. */
  function texMetal(n, graine, teinte) {
    var base = teinte || [0.18, 0.2, 0.18];
    var cv = ecrireCouleur(n, function (x, y) {
      var u = x / n, v = y / n, r = fbm2p(u * 10, v * 10, graine || 5, 10, 5), g = fbm2p(u * 90, v * 90, 3, 90, 2);
      var rouille = smooth(0.55, 0.72, r);
      var c = [base[0] * (0.9 + 0.2 * g), base[1] * (0.9 + 0.2 * g), base[2] * (0.9 + 0.2 * g)];
      return melange(c, [0.30 + 0.1 * g, 0.13, 0.06], rouille);
    });
    return { map: cv };
  }

  /** Bois sombre (tables, caisses). */
  function texBois(n, graine, teinte) {
    var base = teinte || [0.26, 0.17, 0.10];
    var cv = ecrireCouleur(n, function (x, y) {
      var u = x / n, v = y / n;
      var veine = Math.sin((u * 30 + 4 * fbm2p(u * 4, v * 16, graine || 7, 4, 4)) * Math.PI) * 0.5 + 0.5;
      var g = fbm2p(u * 64, v * 8, 13, 64, 3);
      var t = 0.75 + 0.25 * veine + 0.2 * (g - 0.5);
      var c = [base[0] * t, base[1] * t, base[2] * t];
      var planche = Math.abs(((v * 4) % 1) - 0.5) > 0.485 ? 0.35 : 1;
      return [c[0] * planche, c[1] * planche, c[2] * planche];
    });
    return { map: cv };
  }

  /** Crasse / grain neutre (gris ≈ 0,5) à multiplier sur des couleurs de sommets. */
  function texCrasse(n, graine) {
    var cv = ecrireCouleur(n, function (x, y) {
      var u = x / n, v = y / n;
      var g = 0.78 + 0.22 * fbm2p(u * 32, v * 32, graine || 3, 32, 4) + 0.08 * (bruit2p(u * 256, v * 256, 9, 256) - 0.5);
      var tache = smooth(0.6, 0.8, fbm2p(u * 6, v * 6, (graine || 3) + 9, 6, 4)) * 0.25;
      g -= tache;
      return [g, g * 0.98, g * 0.95];
    });
    return { map: cv };
  }

  // ── glyphes occultes INVENTÉS ──
  // Construits uniquement avec cercles, arcs, points, traits droits isolés, triangles et spirales.
  // Règles de sécurité appliquées à la main : jamais de croix à branches coudées ni de symétrie d'ordre 4 à
  // crochets, jamais d'éclair en zigzag, jamais de roue à rayons, jamais de forme de rune.
  var GLYPHES = [
    // [type, ...paramètres] dans un carré [-1, 1]² ; y vers le haut
    [['arc', -0.5, 0.1, 0.25, 0, 180], ['arc', 0, 0.1, 0.25, 180, 360], ['arc', 0.5, 0.1, 0.25, 0, 180], ['trait', -0.75, 0.1, -0.75, -0.62], ['point', -0.5, -0.32, 0.09], ['point', 0.5, -0.32, 0.09], ['point', 0, 0.6, 0.09]],
    [['trait', -0.6, 0.45, -0.6, -0.6], ['trait', -0.6, -0.6, 0.6, -0.6], ['trait', 0.6, -0.6, 0.6, 0.45], ['point', 0, -0.22, 0.12], ['arc', 0, 0.42, 0.62, 25, 155], ['trait', 0.6, 0.0, 0.85, 0.0], ['trait', 0.6, -0.3, 0.85, -0.3]],
    [['arc', -0.25, 0, 0.6, 60, 300], ['arc', 0.25, 0, 0.6, 240, 480], ['point', 0, 0.72, 0.1], ['point', 0, -0.72, 0.1]],
    [['arc', 0, -0.2, 0.5, 150, 390], ['trait', -0.433, 0.05, 0, 0.85], ['trait', 0.433, 0.05, 0, 0.85], ['point', 0, -0.2, 0.11], ['trait', -0.4, -0.88, 0.4, -0.88]],
    [['spirale', 0, 0, 0.82, 2.4], ['point', 0.62, -0.62, 0.09]],
    [['arc', 0, 0, 0.82, 30, 330], ['trait', -0.3, 0, 0.62, 0], ['cercle', -0.42, 0, 0.12]],
    [['tri', 0, -0.85, -0.7, 0.5, 0.7, 0.5], ['trait', 0, 0.5, 0, 0.9], ['point', -0.35, 0.1, 0.08], ['point', 0.35, 0.1, 0.08]],
    [['cercle', 0, 0, 0.3], ['arc', 0, 0, 0.62, 100, 260], ['arc', 0, 0, 0.62, 280, 440], ['arc', 0, 0, 0.88, 200, 340]],
    [['trait', -0.75, 0.6, 0.75, 0.6], ['arc', 0, 0.6, 0.75, 180, 360], ['point', 0, -0.05, 0.12], ['trait', 0, -0.35, 0, -0.85]],
    [['cercle', -0.25, -0.15, 0.5], ['cercle', 0.48, 0.45, 0.2], ['arc', 0.48, 0.45, 0.38, 200, 430], ['point', -0.25, -0.15, 0.1]],
    [['arc', 0, 0.2, 0.55, 0, 180], ['arc', 0, -0.2, 0.55, 180, 360], ['trait', 0, 0.2, 0, -0.2], ['point', 0, 0.85, 0.08]],
    [['arc', 0, -0.4, 1.0, 35, 145], ['trait', 0, 0.6, 0, 0.1], ['cercle', 0, 0.0, 0.1], ['point', -0.55, -0.35, 0.09], ['point', 0, -0.55, 0.09], ['point', 0.55, -0.35, 0.09]],
    [['spirale', -0.2, 0.15, 0.55, 1.6], ['arc', 0.2, -0.2, 0.62, 270, 400], ['point', 0.55, 0.6, 0.08]],
    [['cercle', 0, 0, 0.85], ['cercle', 0, 0, 0.55], ['trait', -0.85, -0.85, -0.45, -0.45], ['point', 0.3, 0.3, 0.1]],
    [['arc', -0.4, 0.3, 0.35, 0, 360], ['trait', -0.4, -0.05, -0.4, -0.85], ['arc', 0.35, -0.2, 0.45, 90, 300]],
    [['tri', 0, 0.8, -0.3, 0.1, 0.3, 0.1], ['tri', 0, -0.8, -0.3, -0.1, 0.3, -0.1], ['cercle', 0, 0, 0.88]]
  ];
  /** Dessine un glyphe dans un contexte 2D (centre cx, cy, demi-taille s). */
  function dessinerGlyphe(g, idx, cx, cy, s, ep) {
    var G = GLYPHES[((idx % GLYPHES.length) + GLYPHES.length) % GLYPHES.length];
    g.save(); g.translate(cx, cy); g.scale(s, -s);
    g.lineWidth = (ep || 0.09); g.lineCap = 'round'; g.lineJoin = 'round';
    for (var i = 0; i < G.length; i++) {
      var e = G[i];
      g.beginPath();
      if (e[0] === 'cercle') { g.arc(e[1], e[2], e[3], 0, Math.PI * 2); g.stroke(); }
      else if (e[0] === 'point') { g.arc(e[1], e[2], e[3], 0, Math.PI * 2); g.fill(); }
      else if (e[0] === 'arc') { g.arc(e[1], e[2], e[3], e[4] * Math.PI / 180, e[5] * Math.PI / 180); g.stroke(); }
      else if (e[0] === 'trait') { g.moveTo(e[1], e[2]); g.lineTo(e[3], e[4]); g.stroke(); }
      else if (e[0] === 'tri') { g.moveTo(e[1], e[2]); g.lineTo(e[3], e[4]); g.lineTo(e[5], e[6]); g.closePath(); g.stroke(); }
      else if (e[0] === 'spirale') {
        var tours = e[4], N = 80;
        for (var k = 0; k <= N; k++) {
          var t = k / N, a = t * tours * Math.PI * 2, r = e[3] * (0.12 + 0.88 * t);
          var x = e[1] + Math.cos(a) * r, y = e[2] + Math.sin(a) * r;
          if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    g.restore();
  }
  /** Atlas 4 × 4 de glyphes blancs sur fond transparent (cellule = 1/4 de la texture). */
  function atlasGlyphes(n) {
    var c = canvas(n, n), g = c.getContext('2d'), cell = n / 4;
    g.clearRect(0, 0, n, n);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff';
    for (var i = 0; i < 16; i++) dessinerGlyphe(g, i, (i % 4 + 0.5) * cell, (Math.floor(i / 4) + 0.5) * cell, cell * 0.4, 0.085);
    return c;
  }
  /** Anneau d'inscriptions (glyphes en couronne) sur fond transparent, pour le sol. */
  function anneauGlyphes(n, graine, opts) {
    opts = opts || {};
    var c = canvas(n, n), g = c.getContext('2d'), R = rng(graine || 61), m = n / 2;
    g.clearRect(0, 0, n, n);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff';
    var r0 = m * 0.97, r1 = m * 0.80, r2 = m * 0.62;
    g.lineWidth = n * 0.006;
    g.beginPath(); g.arc(m, m, r0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(m, m, r1, 0, Math.PI * 2); g.stroke();
    g.lineWidth = n * 0.004;
    g.beginPath(); g.arc(m, m, r2, 0, Math.PI * 2); g.stroke();
    var nb = opts.nombre || 22;
    for (var i = 0; i < nb; i++) {
      var a = i / nb * Math.PI * 2, rr = (r0 + r1) / 2;
      g.save(); g.translate(m + Math.cos(a) * rr, m + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
      dessinerGlyphe(g, R.entier(0, 15), 0, 0, (r0 - r1) * 0.36, 0.1);
      g.restore();
    }
    // triangle inscrit et cercles aux sommets (géométrie occulte inventée, pas d'étoile ni de roue)
    g.lineWidth = n * 0.004;
    g.beginPath();
    for (var k = 0; k < 3; k++) { var a2 = -Math.PI / 2 + k * Math.PI * 2 / 3; var x = m + Math.cos(a2) * r2, y = m + Math.sin(a2) * r2; if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.closePath(); g.stroke();
    for (var k2 = 0; k2 < 3; k2++) {
      var a3 = -Math.PI / 2 + k2 * Math.PI * 2 / 3;
      g.beginPath(); g.arc(m + Math.cos(a3) * r2, m + Math.sin(a3) * r2, r2 * 0.13, 0, Math.PI * 2); g.stroke();
    }
    g.beginPath(); g.arc(m, m, r2 * 0.22, 0, Math.PI * 2); g.stroke();
    return c;
  }

  function tex(THREE, C, cv, opts) {
    opts = opts || {};
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = opts.aniso || 4;
    if (opts.donnees) C.texDonnees(t); else C.texSRGB(t);
    t.needsUpdate = true;
    return t;
  }

  // ── géométrie : fusion simple de BufferGeometry (positions, normales, uv, couleurs) ──
  function fusionner(THREE, liste) {
    var nv = 0, ni = 0, aCouleur = false;
    liste.forEach(function (g) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
      if (g.attributes.color) aCouleur = true;
    });
    var P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), Cc = aCouleur ? new Float32Array(nv * 3) : null;
    var I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    var ov = 0, oi = 0;
    liste.forEach(function (g) {
      var n = g.attributes.position.count;
      P.set(g.attributes.position.array, ov * 3);
      if (g.attributes.normal) N.set(g.attributes.normal.array, ov * 3);
      if (g.attributes.uv) U.set(g.attributes.uv.array, ov * 2);
      if (Cc) { if (g.attributes.color) Cc.set(g.attributes.color.array, ov * 3); else Cc.fill(1, ov * 3, (ov + n) * 3); }
      if (g.index) { var src = g.index.array; for (var k = 0; k < src.length; k++) I[oi + k] = src[k] + ov; oi += src.length; }
      else { for (var k2 = 0; k2 < n; k2++) I[oi + k2] = ov + k2; oi += n; }
      ov += n;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    if (Cc) out.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
  /** Applique une matrice à une géométrie (copie) et peint une couleur de sommets uniforme (option). */
  function placer(THREE, geo, m, couleurLin) {
    var g = geo.index ? geo.clone() : geo.clone();
    g.applyMatrix4(m);
    if (couleurLin) {
      var n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { c[i * 3] = couleurLin[0]; c[i * 3 + 1] = couleurLin[1]; c[i * 3 + 2] = couleurLin[2]; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    return g;
  }
  /** UV « monde » (projection triplanaire figée) : u, v = coordonnées / échelle selon la normale dominante. */
  function uvMonde(geo, echelle) {
    var P = geo.attributes.position.array, N = geo.attributes.normal.array, n = geo.attributes.position.count;
    var U = new Float32Array(n * 2);
    for (var i = 0; i < n; i++) {
      var nx = Math.abs(N[i * 3]), ny = Math.abs(N[i * 3 + 1]), nz = Math.abs(N[i * 3 + 2]);
      var x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (ny >= nx && ny >= nz) { U[i * 2] = x / echelle; U[i * 2 + 1] = z / echelle; }
      else if (nx >= nz) { U[i * 2] = z / echelle; U[i * 2 + 1] = y / echelle; }
      else { U[i * 2] = x / echelle; U[i * 2 + 1] = y / echelle; }
    }
    geo.setAttribute('uv', new geo.attributes.position.constructor(U, 2));
    return geo;
  }

  var API = {
    rng: rng, hash2: hash2, hash3: hash3, bruit2: bruit2, fbm2: fbm2, bruit2p: bruit2p, fbm2p: fbm2p,
    clamp: clamp, lerp: lerp, smooth: smooth, angleDiff: angleDiff, lin: lin, hexVersRgb: hexVersRgb, melange: melange,
    compat: compat, canvas: canvas,
    texPierre: texPierre, texDalles: texDalles, texBeton: texBeton, texMetal: texMetal, texBois: texBois, texCrasse: texCrasse,
    normalesDepuisHauteur: normalesDepuisHauteur,
    GLYPHES: GLYPHES, dessinerGlyphe: dessinerGlyphe, atlasGlyphes: atlasGlyphes, anneauGlyphes: anneauGlyphes,
    tex: tex, fusionner: fusionner, placer: placer, uvMonde: uvMonde
  };
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  if (root) root.ProtoB7Commun = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
