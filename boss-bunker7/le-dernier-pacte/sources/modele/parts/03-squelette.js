  // ============================================================================================
  // Squelette du boss. Base : squelette de 1,80 m du survivant (../survivant/src/body.js,
  // skeletonTable) — mêmes articulations, pose de référence identique (debout, bras écartés de 20°,
  // regard vers +Z) ; l'ensemble est mis à l'échelle 1,75 / 1,80 par le modèle.
  // Ajouts : os de torsion de l'avant-bras, 5 doigts articulés à 3 phalanges, mâchoire, chaînes
  // d'os du bas du manteau et des deux pans de l'étole (physique de ressorts), charpentes des ailes.
  // ============================================================================================
  const ECHELLE = 1.75 / 1.80;
  const ARM_ANGLE = 20 * Math.PI / 180;
  const ARM_DIR = [Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0];
  const L_UPPER = 0.29, L_FORE = 0.255, L_PALM = 0.092;
  // doigts : [nom, décalage vers le pouce (z), recul de l'articulation, longueurs des 3 phalanges, rayon]
  const DOIGTS = [
    ['index', 0.0275, -0.004, [0.047, 0.030, 0.025], 0.0080],
    ['majeur', 0.0092, 0.0, [0.051, 0.033, 0.027], 0.0084],
    ['annulaire', -0.0092, -0.003, [0.048, 0.031, 0.025], 0.0079],
    ['auriculaire', -0.0262, -0.012, [0.038, 0.025, 0.021], 0.0069]
  ];
  const POUCE_L = [0.046, 0.035, 0.029];
  // repère de la main gauche en pose de référence (le droit par symétrie x → −x)
  const N0L = vnorm(vsub([1, 0, 0], vscale(ARM_DIR, ARM_DIR[0])));   // normale « extérieure » du bras
  const PAUME_L = vscale(N0L, -1);                                     // la paume regarde le corps
  const POUCE_DIR_L = vnorm(vadd(vadd(vscale(ARM_DIR, 0.5), [0, 0, 0.66]), vscale(PAUME_L, 0.32)));

  // ---------------------------------------------------------------- manteau : jupe et chaînes d'os
  const JUPE_Y0 = 0.14;      // bas des lambeaux les plus longs
  const JUPE_RINGS = [
    { s: 0.0, w: 0.300, dF: 0.215, dB: 0.268, n: 2.25 },
    { s: 0.11, w: 0.292, dF: 0.21, dB: 0.258, n: 2.25 },
    { s: 0.26, w: 0.272, dF: 0.196, dB: 0.236, n: 2.25 },
    { s: 0.41, w: 0.247, dF: 0.176, dB: 0.210, n: 2.3 },
    { s: 0.56, w: 0.222, dF: 0.156, dB: 0.184, n: 2.35 },
    { s: 0.71, w: 0.196, dF: 0.138, dB: 0.158, n: 2.4 },
    { s: 0.84, w: 0.176, dF: 0.122, dB: 0.134, n: 2.4, oz: -0.004 },
    { s: 0.93, w: 0.168, dF: 0.116, dB: 0.124, n: 2.4, oz: -0.006 }
  ];
  // demi-angle de l'ouverture de la jupe : le manteau est fermé jusqu'à la ceinture, la jupe s'ouvre en dessous
  const ouvertureJupe = (y) => lerp(0.07, 0.8, smooth(0.98, 0.32, y));
  const PAN_N = 12;                                  // chaînes réparties du bord avant gauche au bord avant droit
  const PAN_Y = [0.985, 0.80, 0.605, 0.41, 0.18];    // niveaux : racine fixe, articulations, bout des lambeaux
  const angPan = (f, y) => { const g = ouvertureJupe(y); return g + (TAU - 2 * g) * f; };
  function pointJupe(f, y, grow) {
    const a = angPan(f, y);
    return surfPoint(JUPE_RINGS, JUPE_Y0, y, a, grow || 0);
  }

  // ---------------------------------------------------------------- étole : deux pans qui pendent sur le devant
  // Le haut de l'étole fait le tour de la base du col (rigide), chaque pan pend de la poitrine aux genoux,
  // porté par une chaîne de 6 os (racine fixée à la poitrine). x = ±ETO_X (centre du pan).
  const ETO_X = 0.072, ETO_L = 0.088;                                   // demi-écart des pans, largeur
  const ETO_Y = [1.36, 1.215, 1.07, 0.925, 0.78, 0.635, 0.49];         // racine puis articulations ; bout à 0,49 m
  // profondeur (z) du devant du pan à la hauteur y : posé sur le manteau, il tombe ensuite à l'aplomb
  function zEtole(y) {
    const zb = (yy) => {
      // demi-largeur du buste ou de la jupe à x = ETO_X → z de la surface (par dichotomie sur l'angle)
      const buste = yy >= 0.985;
      const R = buste ? MANTEAU_RINGS : JUPE_RINGS, y0 = buste ? MANTEAU_Y0 : JUPE_Y0;
      let lo = 0, hi = Math.PI / 2;
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (surfPoint(R, y0, yy, m, 0)[0] < ETO_X) lo = m; else hi = m; }
      const a = (lo + hi) / 2;
      if (!buste && a < ouvertureJupe(yy)) return -1;          // devant ouvert de la jupe : pas de surface
      return surfPoint(R, y0, yy, a, 0)[2];
    };
    let z = 0;
    for (let yy = 1.40; yy >= y - 1e-6; yy -= 0.01) z = Math.max(z, zb(yy) + (yy > 0.985 && yy < 1.045 ? 0.007 : 0));
    return z + 0.011;
  }
  const pointEtole = (sx, y) => [sx * ETO_X, y, zEtole(y)];

  // ---------------------------------------------------------------- ailes : charpente (côté gauche)
  const AILE = (() => {
    const u = vnorm([1, 0, -0.26]), v = [0, 1, 0];
    const dirA = (deg) => { const a = deg * Math.PI / 180; return vnorm(vadd(vscale(u, Math.cos(a)), vscale(v, Math.sin(a)))); };
    const R0 = [0.072, 1.355, -0.118];
    const S1 = vadd(R0, [0.10, 0.065, -0.07]);
    const E = vadd(S1, vscale(dirA(36), 0.55));
    const Wr = vadd(E, vscale(dirA(-12), 0.78));
    const doigts = [[38, [0.74, 0.60]], [7, [0.76, 0.64]], [-27, [0.66, 0.54]], [-60, [0.54, 0.44]]].map(([deg, L]) => {
      const d = dirA(deg), m = vadd(Wr, vscale(d, L[0])), t = vadd(m, vscale(d, L[1]));
      return { deg: deg, dir: d, L: L, mid: m, tip: t };
    });
    const pouce = { dir: dirA(98), tip: vadd(Wr, vscale(dirA(98), 0.21)) };
    const corps = [[0.085, 1.30, -0.135], [0.105, 1.16, -0.150], [0.115, 1.03, -0.152]];   // attache du plagiopatagium
    return { u: u, v: v, n: vnorm(vcross(u, v)), R0: R0, S1: S1, E: E, Wr: Wr, doigts: doigts, pouce: pouce, corps: corps };
  })();
  const miroir = (p) => [-p[0], p[1], p[2]];

  function tableSquelette() {
    const T = {
      root: [null, 0, 0, 0],
      hips: ['root', 0, 0.985, 0],
      spine: ['hips', 0, 1.10, -0.012],
      chest: ['spine', 0, 1.27, -0.02],
      neck: ['chest', 0, 1.478, -0.035],
      head: ['neck', 0, 1.588, -0.012],
      oeilG: ['head', 0.0315, 1.6672, 0.0655],
      oeilD: ['head', -0.0315, 1.6672, 0.0655],
      machoire: ['head', 0, 1.629, -0.008]
    };
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const ad = [ARM_DIR[0] * sx, ARM_DIR[1], 0];
      const sh = [0.185 * sx, 1.418, -0.035];
      const el = vadd(sh, vscale(ad, L_UPPER));
      const tw = vadd(el, vscale(ad, L_FORE * 0.58));
      const wr = vadd(el, vscale(ad, L_FORE));
      T['clav' + S] = ['chest', 0.03 * sx, 1.428, 0.005];
      T['arm' + S] = ['clav' + S, sh[0], sh[1], sh[2]];
      T['fore' + S] = ['arm' + S, el[0], el[1], el[2]];
      T['tors' + S] = ['fore' + S, tw[0], tw[1], tw[2]];
      T['hand' + S] = ['tors' + S, wr[0], wr[1], wr[2]];
      for (const [f, dz, back, len] of DOIGTS) {
        let p = vadd(vadd(wr, vscale(ad, L_PALM + back)), [0, 0, dz]);
        T[f + '1' + S] = ['hand' + S, p[0], p[1], p[2]];
        p = vadd(p, vscale(ad, len[0])); T[f + '2' + S] = [f + '1' + S, p[0], p[1], p[2]];
        p = vadd(p, vscale(ad, len[1])); T[f + '3' + S] = [f + '2' + S, p[0], p[1], p[2]];
      }
      const pl = sx > 0 ? PAUME_L : miroir(PAUME_L), td = sx > 0 ? POUCE_DIR_L : miroir(POUCE_DIR_L);
      let c = vadd(vadd(vadd(wr, vscale(ad, 0.016)), [0, 0, 0.019]), vscale(pl, 0.010));
      T['pouce1' + S] = ['hand' + S, c[0], c[1], c[2]];
      c = vadd(c, vscale(td, POUCE_L[0])); T['pouce2' + S] = ['pouce1' + S, c[0], c[1], c[2]];
      c = vadd(c, vscale(td, POUCE_L[1])); T['pouce3' + S] = ['pouce2' + S, c[0], c[1], c[2]];
      T['thigh' + S] = ['hips', 0.092 * sx, 0.925, 0.0];
      T['shin' + S] = ['thigh' + S, 0.098 * sx, 0.505, 0.012];
      T['foot' + S] = ['shin' + S, 0.104 * sx, 0.088, -0.022];
      T['toes' + S] = ['foot' + S, 0.11 * sx, 0.022, 0.12];
      // ailes
      const m = sx > 0 ? (p) => p : miroir;
      const A = AILE;
      T['aileRac' + S] = ['chest'].concat(m(A.R0));
      T['aileHum' + S] = ['aileRac' + S].concat(m(A.S1));
      T['aileAvb' + S] = ['aileHum' + S].concat(m(A.E));
      T['aileMain' + S] = ['aileAvb' + S].concat(m(A.Wr));
      A.doigts.forEach((d, i) => {
        T['aileD' + (i + 1) + 'a' + S] = ['aileMain' + S].concat(m(A.Wr));
        T['aileD' + (i + 1) + 'b' + S] = ['aileD' + (i + 1) + 'a' + S].concat(m(d.mid));
      });
      T['ailePou' + S] = ['aileMain' + S].concat(m(A.Wr));
    }
    // pans de l'étole : os etoG_i / etoD_i de ETO_Y[i] à ETO_Y[i+1], la racine suit la poitrine
    for (const [G, sx] of [['G', 1], ['D', -1]]) {
      let parent = 'chest';
      for (let i = 0; i < ETO_Y.length - 1; i++) {
        const p = pointEtole(sx, ETO_Y[i]);
        const nm = 'eto' + G + '_' + i;
        T[nm] = [parent, p[0], p[1], p[2]];
        parent = nm;
      }
    }
    // chaînes du manteau : os k_i de PAN_Y[i] à PAN_Y[i+1], la racine suit le bassin
    for (let k = 0; k < PAN_N; k++) {
      const f = k / (PAN_N - 1);
      let parent = 'hips';
      for (let i = 0; i < PAN_Y.length - 1; i++) {
        const p = pointJupe(f, PAN_Y[i], -0.012);
        const nm = 'pan' + k + '_' + i;
        T[nm] = [parent, p[0], p[1], p[2]];
        parent = nm;
      }
    }
    return T;
  }
