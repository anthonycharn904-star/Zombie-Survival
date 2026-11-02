  // ============================================================================================
  // Étole rituelle rouge sombre du Septième : une bande de drap épais qui fait le tour de la base du col
  // (posée sur les épaules et la nuque) et dont les deux pans pendent sur le devant du manteau jusqu'aux
  // genoux. Glyphes brodés inventés et liserés (shader, drapeau ETOLE : aBoss = [travers 0..1, longueur
  // depuis le bout gauche (m), distance au bout le plus proche (m)]), frange aux deux bouts.
  // Chaque pan est porté par une chaîne de 6 os simulée (ressorts, collisions avec le torse et les jambes).
  // ============================================================================================
  function poidsEtole(I, G, y) {
    const n = ETO_Y.length;
    const below = [];
    for (let j = 0; j < n - 1; j++) below.push(smooth(ETO_Y[j] + 0.03, ETO_Y[j] - 0.03, y));
    below.push(0);
    const out = [[I.chest, 1 - below[0]]];
    for (let j = 0; j < n - 1; j++) { const w = below[j] - below[j + 1]; if (w > 1e-4) out.push([I['eto' + G + '_' + j], w]); }
    return out;
  }

  function construireEtole(bd, THREE, I, W, Q) {
    const torsoWeights = Q.torsoWeights;
    // tour du col (côté gauche, de la racine du pan vers la nuque) ; le côté droit par symétrie
    const COL = [[0.074, 1.392, 0.136], [0.082, 1.424, 0.116], [0.094, 1.452, 0.084], [0.107, 1.475, 0.04], [0.114, 1.487, -0.008],
      [0.108, 1.491, -0.058], [0.085, 1.492, -0.098], [0.045, 1.4925, -0.121]];
    const pan = (sx) => {
      const out = [];
      for (let y = ETO_Y[ETO_Y.length - 1]; y < ETO_Y[0] - 1e-6; y += 0.05) out.push(pointEtole(sx, y));
      out.push(pointEtole(sx, ETO_Y[0]));
      return out;   // du bas vers la racine
    };
    // chemin complet : bout du pan gauche → racine → tour du col → nuque → côté droit → bout du pan droit
    const pts = [], tags = [];
    for (const p of pan(1)) { pts.push(p); tags.push('G'); }
    for (const p of COL) { pts.push(p); tags.push('C'); }
    pts.push([0, 1.4925, -0.128]); tags.push('C');
    for (let k = COL.length - 1; k >= 0; k--) { pts.push(miroir(COL[k])); tags.push('C'); }
    const panD = pan(-1).reverse();
    for (const p of panD) { pts.push(p); tags.push('D'); }
    // longueurs cumulées (même calcul que le ruban) : glyphes et frange
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + vlen(vsub(pts[i], pts[i - 1])));
    const total = cum[cum.length - 1];
    // normale extérieure : vers l'avant sur la poitrine, vers le haut et le dehors sur les épaules
    const dehors = (P) => {
      const k = smooth(1.39, 1.47, P[1]);
      return vnorm(vlerp([P[0] * 0.15, 0.12, 1], [P[0] * 1.1, 0.95, (P[2] + 0.03) * 1.1], k));
    };
    const coulEtole = (P) => {
      let c = mixc(PAL.etole, PAL.etoleSombre, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 341) * 0.6);
      c = mixc(c, PAL.sangSec, smooth(0.66, 0.8, fbm(P[0] * 18 + 2, P[1] * 18, P[2] * 18, 343)) * 0.5);
      return mixc(c, PAL.cendre, smooth(0.62, 0.48, P[1]) * 0.18 * fbm(P[0] * 40, P[1] * 40, P[2] * 40, 345));
    };
    bd.cur = (P, t, a, b, i) => [(a + 1) / 2, cum[i], Math.min(cum[i], total - cum[i])];
    bd.ribbon('etole', pts, ETO_L, 0.0042, (P) => dehors(P),
      (P) => {
        // poids : chaîne de chaque pan, tronc pour le tour du col (raccord progressif sous la racine)
        if (P[1] > ETO_Y[0] + 0.03 || Math.abs(P[0]) > ETO_X + ETO_L) return torsoWeights(P[1], P[0]);
        return poidsEtole(I, P[0] >= 0 ? 'G' : 'D', P[1]);
      },
      (P) => coulEtole(P));
    bd.cur = [0, 0, 0];
    void tags;
  }
