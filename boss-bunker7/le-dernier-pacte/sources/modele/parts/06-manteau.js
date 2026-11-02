  // ============================================================================================
  // Long manteau de cuir noir-brun du Septième (mi-mollet), fermé sur le buste par des attaches de cuir à
  // crochets de fer, col montant sans revers, broche occulte à gemme rouge au col ; manches de cuir à
  // sangle de poignet, qui remontent quand l'avant-bras se lève (cibles de morphose) et découvrent les
  // bandages ; jupe fendue (devant, dos, côtés) aux ourlets en lambeaux portés par des chaînes d'os animées
  // (physique de ressorts) ; éraflures, brûlures, cendre. Aucune pièce d'uniforme (ni revers, ni pattes
  // d'épaule, ni boutons, ni baudrier).
  // ============================================================================================
  const MANTEAU_Y0 = 0.95;
  const MANTEAU_RINGS = [
    { s: 0.0, w: 0.178, dF: 0.121, dB: 0.13, n: 2.35 }, { s: 0.04, w: 0.173, dF: 0.118, dB: 0.127, n: 2.35 },
    { s: 0.12, w: 0.171, dF: 0.117, dB: 0.122, n: 2.35 }, { s: 0.21, w: 0.176, dF: 0.121, dB: 0.122, n: 2.35 },
    { s: 0.30, w: 0.187, dF: 0.131, dB: 0.127, n: 2.4, oz: 0.003 }, { s: 0.38, w: 0.197, dF: 0.135, dB: 0.133, n: 2.45 },
    { s: 0.44, w: 0.207, dF: 0.125, dB: 0.134, n: 2.55, oz: -0.006 }, { s: 0.48, w: 0.200, dF: 0.109, dB: 0.12, n: 2.5, oz: -0.012 },
    { s: 0.505, w: 0.162, dF: 0.095, dB: 0.106, n: 2.4, oz: -0.017 }, { s: 0.525, w: 0.12, dF: 0.085, dB: 0.096, n: 2.3, oz: -0.021 },
    { s: 0.545, w: 0.092, dF: 0.079, dB: 0.09, n: 2.2, oz: -0.025 }
  ];
  // ouverture du buste : bords jointifs (manteau fermé), petite échancrure sous le col
  const ouvertureBuste = (y) => lerp(0.03, 0.17, smooth(1.40, 1.48, y));
  const MANCHE_RETRAIT = 0.085;      // la manche remonte au plus de 8,5 cm le long de l'avant-bras

  // poids de peau de la jupe : chaînes voisines (fraction f autour du manteau) × os le long de la chaîne
  function poidsJupe(I, f, y) {
    const fk = clamp(f, 0, 1) * (PAN_N - 1), k0 = Math.min(PAN_N - 2, Math.floor(fk)), t = fk - k0;
    const below = [smooth(PAN_Y[0] + 0.045, PAN_Y[0] - 0.08, y)];
    for (let j = 1; j < PAN_Y.length - 1; j++) below.push(smooth(PAN_Y[j] + 0.05, PAN_Y[j] - 0.05, y));
    below.push(0);
    const out = [[I.hips, 1 - below[0]]];
    for (const [k, wk] of [[k0, 1 - t], [k0 + 1, t]]) {
      if (wk < 1e-4) continue;
      for (let i = 0; i < PAN_Y.length - 1; i++) {
        const w = below[i] - below[i + 1];
        if (w > 1e-4) out.push([I['pan' + k + '_' + i], w * wk]);
      }
    }
    return out;
  }
  const fJupe = (ang, y) => { const g = ouvertureJupe(y); return clamp((ang - g) / (TAU - 2 * g), 0, 1); };

  function construireManteau(bd, THREE, I, W, Q) {
    const torsoWeights = Q.torsoWeights;
    const R = rng(977);
    // cuir noir-brun : nuances, usure éclaircie, éraflures, cendre et poussière en bas, brûlures, sang séché
    const manteauCol = (P, ang, edge) => {
      const y = P[1];
      let c = mixc(PAL.manteau, PAL.manteauSombre, fbm(P[0] * 9, P[1] * 9, P[2] * 9, 301) * 0.55);
      c = mixc(c, PAL.manteauClair, smooth(0.6, 0.85, fbm(P[0] * 22, P[1] * 22, P[2] * 22, 303)) * 0.35);
      c = mixc(c, PAL.manteauClair, (edge || 0) * 0.5);
      const raye = 1 - smooth(0.0, 0.025, Math.abs(vnoise(P[0] * 45, P[1] * 12, P[2] * 45, 305) - 0.5));
      c = mixc(c, PAL.manteauClair, raye * 0.45 * smooth(0.55, 0.75, fbm(P[0] * 14, P[1] * 14, P[2] * 14, 307)));
      c = mixc(c, PAL.cendre, smooth(0.62, 0.22, y) * (0.16 + 0.3 * fbm(P[0] * 12, y * 12, P[2] * 12, 309)));
      const br = fbm(P[0] * 8 + 3, P[1] * 8, P[2] * 8, 311);
      c = mixc(c, mixc(PAL.brule, hexc(0x4a2412), smooth(0.79, 0.7, br) * 0.6), smooth(0.68, 0.74, br) * 0.85);
      c = mixc(c, PAL.sangSec, smooth(0.72, 0.84, fbm(P[0] * 20 + 5, P[1] * 20, P[2] * 20, 313)) * 0.6);
      return mulc(c, 0.94 + 0.08 * vnoise(P[0] * 300, P[1] * 300, P[2] * 300, 315));
    };
    const ferCol = (P) => mixc(PAL.fer, PAL.rouille, 0.25 + 0.5 * fbm(P[0] * 250, P[1] * 250, P[2] * 250, 317));

    // ---------------------------------------------------------------- buste du manteau (fermé)
    const plisBuste = (P, s, ang, r, radial) => {
      const y = MANTEAU_Y0 + s, a = wrapPi(ang);
      let d = ripple(s, ang, 0.075, 0.04, 0.028, 0.004, 0, 3.5) + ripple(s, ang, 0.03, 0.025, 0.02, 0.003, 0, 3.5);   // fronces sous la ceinture
      d += diagFold(s, a, 0.32, Math.PI / 2, 2.5, 0.05, 0.004, 0.07, 0.45) + diagFold(s, a, 0.32, -Math.PI / 2, -2.5, 0.05, 0.004, 0.07, 0.45);
      d += 0.0035 * Math.sin(ang * 5 + 1.3) * gauss(a, Math.PI, 0.6) * gauss(y, 1.16, 0.08);           // pli du dos
      d += seamAt(ang, Math.PI / 2 + 0.12, 0.0016) + seamAt(ang, -Math.PI / 2 - 0.12, 0.0016) + seamAt(ang, Math.PI, 0.0014);
      d += seamAt(ang, 0.55, 0.0011) + seamAt(ang, -0.55, 0.0011);                                       // découpes du devant
      d += 0.0012 * gauss(Math.abs(a), ouvertureBuste(y) + 0.025, 0.02);                                // bords repliés
      return radialD(radial, d);
    };
    bd.loft('manteau', {
      a: [0, MANTEAU_Y0, 0], b: [0, 1.50, 0], seg: 46, step: 0.023, s0: 0.01, gap: ouvertureBuste,
      rings: MANTEAU_RINGS, displace: plisBuste, rimGap: 0.006, rim0: 0.004,
      weights: (s, ang, P) => torsoWeights(P[1], P[0]),
      color: (P, s, ang) => manteauCol(P, ang, gauss(Math.abs(wrapPi(ang)), ouvertureBuste(P[1]) + 0.02, 0.03) + gauss(P[1], 1.43, 0.02) * 0.3)
    });
    // attaches de cuir (pattes cousues sur le pan droit) et crochets de fer pris dans des anneaux du pan gauche
    for (const y of [1.075, 1.155, 1.235, 1.315, 1.392]) {
      const pts = [];
      for (let k = 0; k <= 5; k++) pts.push(surfPoint(MANTEAU_RINGS, MANTEAU_Y0, y + 0.002 * Math.sin(k), lerp(-0.25, 0.13, k / 5), 0.0042));
      bd.ribbon('cuir', pts, (t) => lerp(0.024, 0.018, t), 0.003, (P) => vnorm([P[0], 0, P[2] + 0.02]), (P) => torsoWeights(P[1], P[0]),
        (P, t) => mixc(mixc(mulc(PAL.cuir, 0.8), PAL.cuir, fbm(P[0] * 60, P[1] * 60, P[2] * 60, 319)), PAL.cuirClair, gauss(t, 1, 0.12) * 0.35));
      const ac = 0.19, c = surfPoint(MANTEAU_RINGS, MANTEAU_Y0, y, ac, 0.0075), n = vnorm([Math.sin(ac), 0, Math.cos(ac)]), tg = [n[2], 0, -n[0]];
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(tg[0], tg[1], tg[2]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2])).setPosition(c[0], c[1], c[2]);
      const anneau = new THREE.TorusGeometry(0.0062, 0.0015, bd.n(4, 3), bd.n(8, 6));
      bd.rigid('metal', anneau, M, (P) => torsoWeights(P[1], P[0]), ferCol);
      // crochet : tige et bec recourbé qui passe dans l'anneau
      bd.rigid('metal', new THREE.BoxGeometry(0.014, 0.0032, 0.0032), new THREE.Matrix4().makeTranslation(-0.009, 0, 0.001).premultiply(M), (P) => torsoWeights(P[1], P[0]), ferCol);
      bd.rigid('metal', new THREE.BoxGeometry(0.0032, 0.008, 0.0032), new THREE.Matrix4().makeTranslation(-0.0005, -0.003, 0.0035).premultiply(M), (P) => torsoWeights(P[1], P[0]), ferCol);
    }

    // ---------------------------------------------------------------- col montant (sans revers)
    bd.loft('manteau', {
      a: [0, 1.445, -0.03], b: [0, 1.62, -0.03], seg: 32, step: 0.02, gap: 0.17, rim1: 0.006, rimGap: 0.005,
      rings: [{ s: 0.0, w: 0.098, dF: 0.09, dB: 0.096, n: 2.2 }, { s: 0.04, w: 0.085, dF: 0.079, dB: 0.087, n: 2.2 },
        { s: 0.09, w: 0.083, dF: 0.077, dB: 0.086, n: 2.2 }, { s: 0.145, w: 0.088, dF: 0.082, dB: 0.091, n: 2.2 }],
      s1: 0.145,
      hem1: (ang) => 0.052 * Math.pow(Math.max(0, Math.cos(ang)), 3) + 0.004 * vnoise(ang * 12, 1, 1, 321), hemDepth1: 0.06,
      displace: (P, s, ang, r, radial) => radialD(radial, 0.0018 * Math.sin(ang * 5 + 0.5) * smooth(0.05, 0.14, s) + seamAt(ang, Math.PI, 0.001)),
      weights: (s, ang, P) => { const t = smooth(1.46, 1.56, P[1]); return [[I.chest, 0.55 * (1 - t) + 0.25 * t], [I.neck, 0.45 * (1 - t) + 0.75 * t]]; },
      color: (P, s, ang) => mixc(manteauCol(P, ang, gauss(s, 0.145, 0.01) * 0.6), PAL.manteauSombre, 0.12)
    });
    // broche occulte au col (création) : plaque ovale de fer, trois griffes d'os qui tiennent une gemme rouge,
    // anneau pendant
    {
      const c = [0, 1.461, 0.0745], nrm = vnorm([0, 0.36, 0.93]);
      const X = [1, 0, 0], Y = vnorm(vcross(nrm, X)), Z = nrm;
      const B0 = new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2])).setPosition(c[0], c[1], c[2]);
      const wB = (P) => torsoWeights(P[1], P[0]);
      const pl = new THREE.SphereGeometry(1, bd.n(10, 7), bd.n(5, 4)); pl.scale(0.018, 0.023, 0.0042);
      bd.rigid('metal', pl, B0, wB, ferCol);
      const rim = new THREE.TorusGeometry(0.0195, 0.0021, bd.n(4, 3), bd.n(12, 8)); rim.scale(1, 1.22, 1);
      bd.rigid('metal', rim, B0, wB, (P) => mulc(ferCol(P), 0.8));
      const osC = (P) => mixc(PAL.osClair, PAL.os, fbm(P[0] * 300, P[1] * 300, P[2] * 300, 323) * 0.6);
      for (const a of [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + 2 * TAU / 3]) {
        const g = new THREE.ConeGeometry(0.0021, 0.013, 5, 2);
        g.translate(0, 0.0065, 0);
        const gp = g.attributes.position;
        for (let v = 0; v < gp.count; v++) { const yy = gp.getY(v) / 0.013; gp.setZ(v, gp.getZ(v) + 0.006 * yy * yy); }
        g.computeVertexNormals();
        const M = new THREE.Matrix4().makeRotationZ(a - Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.0135, Math.sin(a) * 0.0165, 0.002));
        bd.rigid('metal', g, M.premultiply(B0), wB, osC);
      }
      bd.cur = [0, 0, 0.6];
      const gem = new THREE.SphereGeometry(1, bd.n(10, 7), bd.n(7, 5)); gem.scale(0.0092, 0.0122, 0.0072);
      bd.rigid('yeux', gem, new THREE.Matrix4().makeTranslation(0, 0, 0.004).premultiply(B0), wB, (P, N) => mixc(hexc(0x5a0608), hexc(0xb01410), smooth(0.2, 0.9, vdot(N, nrm))));
      bd.cur = [0, 0, 0];
      const ann = new THREE.TorusGeometry(0.0052, 0.0012, bd.n(4, 3), bd.n(8, 6));
      bd.rigid('metal', ann, new THREE.Matrix4().makeTranslation(0, -0.031, 0.001).premultiply(B0), wB, ferCol);
    }

    // ---------------------------------------------------------------- manches de cuir, sangle de poignet ; remontent (morphose)
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const sh = [0.185, 1.418, -0.035];
      const armEnd = vadd(sh, vscale(ARM_DIR, 0.62));
      const elbowS = L_UPPER, wristS = L_UPPER + L_FORE;
      const armW = (s) => {
        const t0 = smooth(-0.04, 0.08, s), t1 = smooth(elbowS - 0.05, elbowS + 0.05, s), t2 = smooth(elbowS + 0.06, wristS, s) * 0.55;
        return [[I['clav' + S], 1 - t0], [I['arm' + S], t0 * (1 - t1)], [I['fore' + S], t1 * (1 - t2)], [I['tors' + S], t1 * t2]];
      };
      const g = bd.g('manteau'), v0 = g.p.length / 3;
      bd.loft('manteau', {
        a: sh, b: armEnd, mirror: sx < 0, seg: 22, step: 0.022, s0: -0.035, s1: wristS + 0.005, rim1: 0.005,
        rings: [
          { s: -0.035, wL: 0.074, wR: 0.046, d: 0.072 }, { s: 0.02, wL: 0.075, wR: 0.062, d: 0.073 }, { s: 0.08, wL: 0.071, wR: 0.068, d: 0.07 },
          { s: 0.16, w: 0.068, dF: 0.068, dB: 0.065 }, { s: elbowS, w: 0.065, d: 0.063 }, { s: 0.4, w: 0.062, d: 0.059 },
          { s: 0.48, w: 0.06, d: 0.057 }, { s: wristS - 0.03, w: 0.059, d: 0.056 }, { s: wristS + 0.005, w: 0.062, d: 0.059 }
        ],
        displace: (P, s, ang, r, radial) => radialD(radial,
          ripple(s, ang, elbowS - 0.01, 0.035, 0.022, 0.0055, 0.0, 1.1) + ripple(s, ang, elbowS + 0.015, 0.03, 0.026, 0.003, Math.PI, 0.9, 1.2) +
          ripple(s, ang, 0.05, 0.035, 0.026, 0.003, Math.PI / 2, 0.8) + 0.002 * Math.sin(ang * 3 + s * 21) * gauss(s, 0.18, 0.06) +
          ripple(s, ang, 0.44, 0.03, 0.024, 0.0028, 0, 3.5) + seamAt(ang, Math.PI - 0.3, 0.0013)),
        weights: (s) => armW(s),
        color: (P, s, ang) => manteauCol(P, ang, gauss(s, elbowS, 0.03) * Math.max(0, -Math.cos(ang)) * 0.8 + gauss(s, wristS + 0.005, 0.008) * 0.6)
      });
      // sangle de poignet et sa petite boucle (même maillage que la manche : elles remontent avec elle)
      const ad = sx > 0 ? ARM_DIR : miroir(ARM_DIR), shS = sx > 0 ? sh : miroir(sh);
      const sS = wristS - 0.035, cS = vadd(shS, vscale(ad, sS));
      const e1 = vnorm(vcross(ad, [0, 0, 1])), e2 = vnorm(vcross(e1, ad));
      const pts = [];
      for (let k = 0; k <= 14; k++) { const a = k / 14 * TAU; pts.push(vadd(cS, vadd(vscale(e1, Math.cos(a) * 0.0615), vscale(e2, Math.sin(a) * 0.0585)))); }
      bd.ribbon('manteau', pts, 0.016, 0.0028, (P) => vnorm(vsub(vsub(P, cS), vscale(ad, vdot(vsub(P, cS), ad)))), () => armW(sS), (P) => mixc(PAL.cuir, PAL.cuirClair, 0.3 * fbm(P[0] * 80, P[1] * 80, P[2] * 80, 325)));
      {
        const bc = vadd(cS, vscale(e2, -0.062)), M = new THREE.Matrix4().makeBasis(new THREE.Vector3(ad[0], ad[1], ad[2]), new THREE.Vector3(e1[0], e1[1], e1[2]), new THREE.Vector3(-e2[0], -e2[1], -e2[2])).setPosition(bc[0], bc[1], bc[2]);
        for (const [w, h, x, y] of [[0.019, 0.003, 0, 0.009], [0.019, 0.003, 0, -0.009], [0.003, 0.02, 0.008, 0], [0.003, 0.02, -0.008, 0]]) {
          bd.rigid('manteau', new THREE.BoxGeometry(w, h, 0.0035), new THREE.Matrix4().makeTranslation(x, y, 0.002).premultiply(M), () => armW(sS), PAL.fer);
        }
      }
      // cible de morphose : la manche remonte vers le coude (compression et bourrelets près du poignet)
      const v1 = g.p.length / 3;
      bd.morph('manteau', S, v0, v1, (P) => {
        const rel = vsub(P, shS), s = vdot(rel, ad);
        const k = MANCHE_RETRAIT * smooth(wristS - 0.21, wristS, s);
        const radial = vnorm(vsub(rel, vscale(ad, s)));
        const bour = 0.006 * gauss(s, wristS - 0.11, 0.045) * (0.7 + 0.3 * Math.sin(s * 160 + Math.atan2(radial[1], radial[0]) * 3));
        return vadd(vscale(ad, -k), vscale(radial, bour));
      });
    }

    // ---------------------------------------------------------------- jupe du manteau : plis, fente, lambeaux
    const crans = [];   // découpe du bas : entailles irrégulières entre des bandes de tissu
    {
      let a = ouvertureJupe(0.3) + 0.08;
      while (a < TAU - ouvertureJupe(0.3) - 0.08) {
        crans.push([a, 0.07 + 0.16 * R(), 0.03 + 0.03 * R()]);
        a += 0.16 + 0.2 * R();
      }
    }
    const bandes = [];
    for (let i = 0; i < 24; i++) bandes.push(0.05 * R());
    const hemJupe = (ang) => {
      let d = 0.012 * vnoise(ang * 14, 2, 3, 317) + 0.01 * vnoise(ang * 40, 5, 1, 319);
      for (const [c, dep, w] of crans) { const x = Math.abs(ang - c) / w; if (x < 1) d = Math.max(d, dep * Math.pow(1 - x, 0.8)); }
      d += bandes[Math.floor(clamp((ang - 0.8) / 0.2, 0, 23))];
      const xv = Math.abs(wrapPi(ang - Math.PI)) / 0.045;                       // fente du dos
      if (xv < 1) d = Math.max(d, 0.40 * Math.pow(1 - xv, 0.6));
      for (const ac of [Math.PI / 2 + 0.16, 1.5 * Math.PI - 0.16]) {               // fentes des côtés
        const xc = Math.abs(wrapPi(ang - ac)) / 0.038;
        if (xc < 1) d = Math.max(d, 0.31 * Math.pow(1 - xc, 0.6));
      }
      return d;
    };
    const plisJupe = (P, s, ang, r, radial) => {
      const y = P[1], a = wrapPi(ang);
      const k = smooth(0.98, 0.35, y);
      let d = 0.012 * k * (0.65 * Math.sin(ang * 7 + 2 * Math.sin(ang * 2.3)) + 0.35 * Math.sin(ang * 13 + 1.7));
      d += 0.0045 * Math.sin(ang * 21) * smooth(0.86, 0.97, y) * smooth(1.03, 0.97, y);                         // fronces sous la ceinture
      d += seamAt(ang, Math.PI / 2 + 0.15, 0.0015) + seamAt(ang, -Math.PI / 2 - 0.15, 0.0015);
      return radialD(radial, d);
    };
    bd.loft('manteau', {
      a: [0, JUPE_Y0, 0], b: [0, JUPE_Y0 + 0.89, 0], gap: (s) => ouvertureJupe(JUPE_Y0 + s), seg: 68, step: 0.029,
      rings: JUPE_RINGS, hem0: hemJupe, hemDepth0: 0.42, rim0: 0.004, rimGap: 0.006, displace: plisJupe,
      weights: (s, ang, P) => poidsJupe(I, fJupe(ang, P[1]), P[1]),
      color: (P, s, ang) => {
        const g = ouvertureJupe(P[1]);
        let c = manteauCol(P, ang, gauss(ang, g, 0.03) + gauss(TAU - ang, g, 0.03));
        return mixc(c, PAL.cendre, smooth(0.36, 0.16, P[1]) * 0.25);
      },
      extra: (P) => [smooth(0.62, 0.2, P[1]), 0, 0]
    });
    // lambeaux libres sous l'ourlet (bandes effilochées)
    {
      const n = Math.max(6, Math.round(14 * bd.q));
      for (let i = 0; i < n; i++) {
        const f = 0.04 + 0.92 * (i + 0.5 * R()) / n;
        const yTop = 0.40 + 0.06 * R(), yBot = 0.10 + 0.12 * R();
        const w0 = 0.035 + 0.035 * R(), twist = (R() - 0.5) * 0.8;
        const pts = [];
        const nseg = 7;
        for (let k = 0; k <= nseg; k++) {
          const t = k / nseg, y = lerp(yTop, yBot, t);
          const p = pointJupe(f + 0.01 * Math.sin(t * 3 + i), y, 0.004 + 0.006 * t);
          pts.push(p);
        }
        bd.ribbon('lambeaux', pts, (t) => w0 * (1 - 0.75 * t) * (0.8 + 0.4 * vnoise(t * 9, i, 1, 321)), 0.003,
          (P, k) => { const a = angPan(f, P[1]); return [Math.sin(a + twist * k / nseg), 0, Math.cos(a + twist * k / nseg)]; },
          (P) => poidsJupe(I, f, P[1]),
          (P, t) => mixc(manteauCol(P, 0, 0.1 * t), PAL.cendre, t * 0.3));
      }
      // les lambeaux flottent davantage
      const g = bd.g('lambeaux');
      for (let v = 0; v < g.x.length / 3; v++) g.x[v * 3] = clamp(smooth(0.45, 0.1, g.p[v * 3 + 1]) * 1.6, 0, 1.6);
    }
  }
