  // ============================================================================================
  // Corps du Septième sous et sur le manteau : col de chemise sombre (visible dans l'échancrure du col),
  // ceinture de cuir portée SUR le manteau (boucle simple sans emblème) avec trois fioles de verre à lueur
  // d'âme et une chaîne, pantalon sombre droit, bottes hautes usées, avant-bras bandés (visibles quand la
  // manche remonte), cou décharné. Aucune pièce d'uniforme. Lofts et plis repris de ../survivant/src/body.js.
  // ============================================================================================
  const CEINTURE_Y = [0.985, 1.033];

  // anneaux de la ceinture : au-dessus du buste et du haut de la jupe du manteau, plus l'épaisseur
  function anneauxCeinture() {
    const RB = prepRings(MANTEAU_RINGS), RJ = prepRings(JUPE_RINGS);
    return [0, 0.5, 1].map((t) => {
      const y = lerp(CEINTURE_Y[0], CEINTURE_Y[1], t);
      const b = interpRing(RB, y - MANTEAU_Y0), j = interpRing(RJ, y - JUPE_Y0), e = 0.0075;
      return { s: y - CEINTURE_Y[0], wL: Math.max(b.wL, j.wL) + e, wR: Math.max(b.wR, j.wR) + e, dF: Math.max(b.dF, j.dF) + e, dB: Math.max(b.dB, j.dB) + e, n: 2.35, oz: lerp(b.oz, j.oz, 0.5) };
    });
  }

  function construireCorps(bd, THREE, I, W, Q) {
    // poids du tronc : bassin → colonne → poitrine → cou (+ clavicules sur les épaules)
    const torsoWeights = (y, x) => {
      const tHS = smooth(1.0, 1.13, y), tSC = smooth(1.17, 1.31, y), tCN = smooth(1.455, 1.50, y);
      const wh = 1 - tHS, ws = tHS * (1 - tSC), wc = tSC * (1 - tCN), wn = tCN;
      const cl = smooth(0.07, 0.16, Math.abs(x)) * smooth(1.33, 1.42, y) * 0.75;
      const clav = x >= 0 ? I.clavL : I.clavR;
      return [[I.hips, wh], [I.spine, ws], [I.chest, wc * (1 - cl)], [clav, wc * cl], [I.neck, wn]];
    };
    Q.torsoWeights = torsoWeights;
    const R = rng(1203);

    // ---------------------------------------------------------------- col de chemise sombre (dans l'échancrure du col)
    const chemiseCol = (P) => mixc(mixc(PAL.tunique, PAL.tuniqueSombre, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 201) * 0.6), PAL.sangSec, smooth(0.66, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 203)) * 0.5);
    bd.loft('tunique', {
      a: [0, 1.43, -0.03], b: [0, 1.53, -0.03], seg: 20, step: 0.03, rim1: 0.002,
      rings: [{ s: 0.0, w: 0.086, dF: 0.080, dB: 0.086 }, { s: 0.05, w: 0.068, dF: 0.063, dB: 0.072 }, { s: 0.085, w: 0.064, dF: 0.059, dB: 0.068 }],
      hem1: (ang) => 0.02 * Math.pow(Math.max(0, Math.cos(ang)), 4), hemDepth1: 0.022,
      weights: (s, ang, P) => { const t = smooth(1.45, 1.52, P[1]); return [[I.chest, 0.6 * (1 - t) + 0.25 * t], [I.neck, 0.4 * (1 - t) + 0.75 * t]]; },
      color: chemiseCol
    });

    // ---------------------------------------------------------------- ceinture de cuir sur le manteau
    const cuirCol = (P) => mixc(mixc(PAL.cuir, PAL.cuirClair, fbm(P[0] * 50, P[1] * 50, P[2] * 50, 211) * 0.5), PAL.poussiere, smooth(0.65, 0.85, fbm(P[0] * 18, P[1] * 18, P[2] * 18, 213)) * 0.3);
    const BELT = anneauxCeinture();
    bd.loft('cuir', {
      a: [0, CEINTURE_Y[0], 0], b: [0, CEINTURE_Y[1], 0], seg: 44, step: 0.024, rings: BELT, rim0: 0.002, rim1: 0.002,
      radius: (s) => 1 + 0.02 * gauss(s, 0.024, 0.016),
      weights: () => [[I.hips, 1]],
      color: (P, s) => mixc(cuirCol(P), mulc(PAL.cuir, 0.55), Math.max(gauss(s, 0.003, 0.003), gauss(s, 0.045, 0.003)) * 0.7)
    });
    const surfCeinture = (y, ang, grow) => surfPoint(BELT, CEINTURE_Y[0], y, ang, grow);
    {
      // boucle à cadre rectangulaire et ardillon (aucun emblème), un peu décalée sur la gauche
      const c = surfCeinture(1.009, 0.12, 0.004);
      const n = vnorm([Math.sin(0.12), 0, Math.cos(0.12)]), tg = [n[2], 0, -n[0]];
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(tg[0], tg[1], tg[2]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2])).setPosition(c[0], c[1], c[2]);
      for (const [w, h, x, y] of [[0.046, 0.006, 0, 0.022], [0.046, 0.006, 0, -0.022], [0.006, 0.05, 0.02, 0], [0.006, 0.05, -0.02, 0], [0.004, 0.044, -0.003, 0]]) {
        bd.rigid('metal', new THREE.BoxGeometry(w, h, 0.005), new THREE.Matrix4().makeTranslation(x, y, 0.002).premultiply(M), [[I.hips, 1]], (P, N) => mixc(PAL.metal, PAL.rouille, 0.25 + 0.4 * fbm(P[0] * 300, P[1] * 300, P[2] * 300, 215)));
      }
    }
    // fioles de verre suspendues sur la hanche gauche (vers l'arrière) : lueur d'âme bleu-vert pâle
    {
      const profilVerre = [[0.0001, -0.031], [0.0105, -0.03], [0.0124, -0.018], [0.0124, 0.014], [0.0056, 0.025], [0.0052, 0.033], [0.0066, 0.036]];
      const profilAme = [[0.0001, -0.027], [0.0095, -0.026], [0.0102, 0.006], [0.0001, 0.012]];
      const lathe = (prof, n) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), n);
      for (const [ang, dy, rot] of [[1.82, 0.0, 0.05], [2.12, -0.008, -0.08], [2.42, 0.004, 0.1]]) {
        const top = surfCeinture(0.985, ang, 0.0);
        const n = vnorm([Math.sin(ang), 0, Math.cos(ang)]);
        const c = vadd(vadd(top, vscale(n, 0.018)), [0, -0.05 + dy, 0]);
        const M = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot, ang, -rot * 0.5)).setPosition(c[0], c[1], c[2]);
        bd.rigid('verre', lathe(profilVerre, bd.n(8, 6)), M, [[I.hips, 1]], PAL.verre);
        bd.cur = [0, 0, 1];
        bd.rigid('ame', lathe(profilAme, bd.n(7, 5)), M, [[I.hips, 1]], PAL.ame);
        bd.cur = [0, 0, 0];
        // bouchon de cuir et lanière qui la retient à la ceinture
        bd.rigid('cuir', new THREE.CylinderGeometry(0.0062, 0.0058, 0.009, 6, 1), new THREE.Matrix4().makeTranslation(0, 0.039, 0).premultiply(M), [[I.hips, 1]], (P) => cuirCol(P));
        const pts = [vadd(top, vscale(n, 0.004)), vadd(vadd(top, vscale(n, 0.012)), [0, -0.02, 0]), vadd(c, [0, 0.042, 0])];
        bd.ribbon('cuir', pts, 0.008, 0.0025, () => n, () => [[I.hips, 1]], (P) => cuirCol(P));
      }
    }
    // chaîne de fer qui pend de l'avant droit de la ceinture vers la hanche droite
    {
      const a0 = -0.5, a1 = -1.95, nl = Math.max(8, Math.round(13 * bd.q));
      const pts = [];
      for (let i = 0; i <= nl; i++) {
        const t = i / nl, a = lerp(a0, a1, t), sag = 0.075 * Math.sin(Math.PI * t);
        const y = CEINTURE_Y[0] + 0.002 - sag;
        // sous la ceinture la chaîne s'écarte de la jupe du manteau
        const P = surfPoint(JUPE_RINGS, JUPE_Y0, Math.min(y, 1.02), a, 0.012);
        const B0 = surfCeinture(Math.max(y, CEINTURE_Y[0]), a, 0.006);
        pts.push([lerp(B0[0], P[0], smooth(0.0, 0.03, sag)), y, lerp(B0[2], P[2], smooth(0.0, 0.03, sag))]);
      }
      for (let i = 0; i < nl; i++) {
        const p0 = pts[i], p1 = pts[i + 1], mid = vlerp(p0, p1, 0.5), d = vnorm(vsub(p1, p0));
        const g = new THREE.TorusGeometry(0.0072, 0.0017, bd.n(4, 3), bd.n(7, 5));
        g.scale(1.35, 1, 1);
        const out = vnorm([mid[0], 0, mid[2]]);
        const up = i % 2 ? out : vnorm(vcross(d, out));
        const X = d, Z = vnorm(vcross(X, up)), Y = vcross(Z, X);
        const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2])).setPosition(mid[0], mid[1], mid[2]);
        bd.rigid('metal', g, M, [[I.hips, 1]], (P) => mixc(PAL.fer, PAL.rouille, 0.3 + 0.5 * fbm(P[0] * 200, P[1] * 200, P[2] * 200, 217)));
      }
    }

    // ---------------------------------------------------------------- avant-bras bandés (sous la manche, visibles quand elle remonte)
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const sh = [0.185, 1.418, -0.035], armEnd = vadd(sh, vscale(ARM_DIR, 0.62));
      const elbowS = L_UPPER, wristS = L_UPPER + L_FORE;
      const armW = (s) => {
        const t1 = smooth(elbowS - 0.05, elbowS + 0.05, s), t2 = smooth(elbowS + 0.06, wristS, s) * 0.55;
        return [[I['arm' + S], 1 - t1], [I['fore' + S], t1 * (1 - t2)], [I['tors' + S], t1 * t2]];
      };
      const spire = 0.019;
      bd.loft('bandage', {
        a: sh, b: armEnd, mirror: sx < 0, seg: 12, step: 0.012, s0: wristS - 0.2, s1: wristS - 0.022,
        rings: [{ s: wristS - 0.2, w: 0.037, d: 0.04 }, { s: wristS - 0.13, w: 0.032, d: 0.036 }, { s: wristS - 0.07, w: 0.027, d: 0.0325 }, { s: wristS - 0.022, w: 0.021, d: 0.0285 }],
        displace: (P, s, ang, r, radial) => {
          const f = (s / spire + ang / TAU * (sx > 0 ? 1 : -1)) % 1, fr = f < 0 ? f + 1 : f;
          const d = 0.0016 * smooth(0.0, 0.1, fr) - 0.0012 * smooth(0.8, 1.0, fr) + 0.0005 * vnoise(s * 300, ang * 4, sx, 219);
          return radialD(radial, d);
        },
        weights: (s) => armW(s),
        color: (P, s, ang) => {
          const f = (s / spire + ang / TAU * (sx > 0 ? 1 : -1)) % 1, fr = f < 0 ? f + 1 : f;
          let c = mixc(PAL.bandage, PAL.bandageSale, 0.2 + 0.6 * fbm(P[0] * 60, P[1] * 60, P[2] * 60, 221));
          c = mixc(c, mulc(PAL.bandageSale, 0.45), smooth(0.78, 0.98, fr) * 0.85);                  // bord sombre de chaque tour
          c = mixc(c, mulc(PAL.bandage, 1.12), smooth(0.25, 0.0, fr) * 0.3);                        // arête claire du tour suivant
          c = mixc(c, PAL.sangSec, smooth(0.62, 0.78, fbm(P[0] * 35 + sx, P[1] * 35, P[2] * 35, 223)) * 0.75);
          return mixc(c, PAL.cendre, smooth(0.7, 0.9, fbm(P[0] * 80, P[1] * 80, P[2] * 80, 225)) * 0.3);
        }
      });
    }
    void R;

    // ---------------------------------------------------------------- pantalon sombre, droit, rentré dans les bottes
    const culCol = (P, s, ang) => {
      let c = mixc(PAL.pantalon, PAL.pantalonSombre, fbm(P[0] * 20, P[1] * 40, P[2] * 20, 227) * 0.55);
      c = mixc(c, PAL.poussiere, smooth(0.6, 0.85, fbm(P[0] * 14, P[1] * 14, P[2] * 14, 229)) * 0.25);
      return mixc(c, PAL.cendre, smooth(0.45, 0.2, P[1]) * 0.15);
    };
    bd.loft('pantalon', {
      a: [0, 0.80, -0.008], b: [0, 1.0, -0.008], seg: 24, step: 0.04,
      rings: [{ s: 0.0, w: 0.118, dF: 0.07, dB: 0.08, n: 2.4 }, { s: 0.06, w: 0.142, dF: 0.088, dB: 0.104, n: 2.4 },
        { s: 0.13, w: 0.148, dF: 0.092, dB: 0.106, n: 2.4 }, { s: 0.2, w: 0.146, dF: 0.094, dB: 0.1, n: 2.4 }],
      weights: (s, ang, P) => {
        const sideB = P[0] >= 0 ? I.thighL : I.thighR;
        const low = smooth(0.92, 0.84, P[1]) * smooth(0.04, 0.12, Math.abs(P[0])) * 0.6;
        return [[I.hips, 1 - low], [sideB, low]];
      },
      color: culCol
    });
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const hipP = [0.092, 1.0, 0.0], ank = W.footL;
      const kneeS = vlen(vsub(W.shinL, hipP));
      bd.loft('pantalon', {
        a: hipP, b: ank, mirror: sx < 0, seg: 18, step: 0.03, s0: 0.0, s1: 0.56,
        rings: [
          { s: 0.0, wL: 0.084, wR: 0.1, dF: 0.092, dB: 0.104, n: 2.3 },
          { s: 0.10, wL: 0.077, wR: 0.092, dF: 0.087, dB: 0.094, n: 2.25 },
          { s: 0.20, wL: 0.071, wR: 0.084, dF: 0.082, dB: 0.085, n: 2.2 },
          { s: 0.29, wL: 0.066, wR: 0.077, dF: 0.076, dB: 0.077, n: 2.2 },
          { s: 0.38, wL: 0.061, wR: 0.068, dF: 0.07, dB: 0.068 },
          { s: kneeS - 0.04, w: 0.058, dF: 0.064, dB: 0.062 },
          { s: 0.53, w: 0.056, dF: 0.06, dB: 0.06 }
        ],
        displace: (P, s, ang, r, radial) => {
          let d = ripple(s, ang, kneeS - 0.01, 0.03, 0.02, 0.0035, 0, 1.0) + ripple(s, ang, 0.5, 0.025, 0.018, 0.003, 0, 3.5);
          d += 0.0018 * Math.sin(ang * 2 + s * 21) * gauss(s, 0.25, 0.08);
          d += seamAt(ang, -Math.PI / 2, 0.0012) + seamAt(ang, Math.PI / 2, 0.0009);
          return radialD(radial, d);
        },
        weights: (s) => {
          const t1 = smooth(0.0, 0.16, s), t2 = smooth(kneeS - 0.05, kneeS + 0.05, s);
          return [[I.hips, 1 - t1], [I['thigh' + S], t1 * (1 - t2)], [I['shin' + S], t2]];
        },
        color: culCol
      });

      // ------------------------------------------------------------ bottes hautes usées (cuir éraflé, plis, poussière)
      const fx = 0.104, fxs = 0.104 * sx;
      const knee = W.shinL;
      const bootCol = (P, s, ang) => {
        let c = mixc(PAL.botte, PAL.botteReflet, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 231) * 0.45);
        c = mixc(c, PAL.poussiere, smooth(0.55, 0.85, fbm(P[0] * 16, P[1] * 16, P[2] * 16, 233)) * 0.4 + smooth(0.08, 0.02, P[1]) * 0.3);
        c = mixc(c, PAL.cendre, smooth(0.7, 0.9, fbm(P[0] * 60, P[1] * 60, P[2] * 60, 235)) * 0.2);
        const raye = 1 - smooth(0.0, 0.03, Math.abs(vnoise(P[0] * 60, P[1] * 9, P[2] * 60, 237) - 0.5));   // éraflures claires
        return mixc(c, PAL.botteReflet, raye * 0.5 * smooth(0.6, 0.8, fbm(P[0] * 25, P[1] * 25, P[2] * 25, 239)));
      };
      // tige : du dessous du genou à la cheville
      const shaftLen = vlen(vsub(ank, knee));
      bd.loft('botte', {
        a: knee, b: ank, mirror: sx < 0, seg: 16, step: 0.034, s0: 0.022, s1: shaftLen + 0.03, rim0: 0.004,
        rings: [
          { s: 0.022, w: 0.061, dF: 0.066, dB: 0.068 }, { s: 0.06, w: 0.058, dF: 0.061, dB: 0.066 },
          { s: 0.15, w: 0.056, dF: 0.058, dB: 0.069 }, { s: 0.25, w: 0.05, dF: 0.051, dB: 0.059 },
          { s: 0.34, w: 0.044, dF: 0.046, dB: 0.048 }, { s: shaftLen - 0.01, w: 0.045, dF: 0.05, dB: 0.047 },
          { s: shaftLen + 0.03, w: 0.047, dF: 0.06, dB: 0.05 }
        ],
        hem0: (ang) => 0.022 * Math.pow(Math.max(0, -Math.cos(ang)), 2), hemDepth0: 0.025,   // échancrure à l'arrière du genou
        displace: (P, s, ang, r, radial) => {
          let d = ripple(s, ang, shaftLen - 0.045, 0.03, 0.016, 0.0028, 0, 1.4) + ripple(s, ang, shaftLen - 0.02, 0.02, 0.012, 0.002, Math.PI, 1.0);
          d += 0.0015 * Math.sin(ang * 5 + s * 23) * gauss(s, shaftLen - 0.08, 0.04);
          return radialD(radial, d);
        },
        weights: (s) => { const t = smooth(shaftLen - 0.04, shaftLen + 0.02, s); return [[I['shin' + S], 1 - t], [I['foot' + S], t]]; },
        color: bootCol
      });
      const footW = (s) => { const t = smooth(0.17, 0.24, s); return [[I['foot' + S], 1 - t], [I['toes' + S], t]]; };
      // semelle fine et talon
      bd.loft('botte', {
        a: [fx, 0.014, -0.088], b: [fx, 0.014, 0.21], front: [0, 1, 0], mirror: sx < 0, seg: 14, step: 0.022,
        rings: [
          { s: 0.0, w: 0.026, dF: 0.016, dB: 0.014, n: 3.2 }, { s: 0.02, w: 0.034, dF: 0.017, dB: 0.014, n: 3.4 },
          { s: 0.07, w: 0.036, dF: 0.016, dB: 0.014, n: 3.4 }, { s: 0.085, w: 0.034, dF: 0.008, dB: 0.006, n: 3.4 },
          { s: 0.15, wL: 0.034, wR: 0.039, dF: 0.006, dB: 0.006, n: 3.4 }, { s: 0.22, w: 0.04, dF: 0.006, dB: 0.006, n: 3.2 },
          { s: 0.27, w: 0.032, dF: 0.006, dB: 0.006, n: 2.8 }, { s: 0.298, w: 0.012, dF: 0.005, dB: 0.005, n: 2.4 }
        ],
        cap0: true, cap1: true,
        weights: footW,
        color: (P) => mixc(PAL.semelle, PAL.poussiere, smooth(0.5, 0.8, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 237)) * 0.35)
      });
      // empeigne effilée
      bd.loft('botte', {
        a: [fx, 0.05, -0.085], b: [fx, 0.05, 0.205], front: [0, 1, 0], mirror: sx < 0, seg: 18, step: 0.017,
        rings: [
          { s: 0.0, w: 0.022, dF: 0.045, dB: 0.03, n: 2.6 }, { s: 0.025, w: 0.036, dF: 0.056, dB: 0.03, n: 2.7 },
          { s: 0.07, w: 0.04, dF: 0.06, dB: 0.032, n: 2.8 }, { s: 0.13, wL: 0.039, wR: 0.043, dF: 0.054, dB: 0.034, n: 2.8 },
          { s: 0.19, wL: 0.042, wR: 0.044, dF: 0.034, dB: 0.034, n: 2.8 }, { s: 0.24, w: 0.039, dF: 0.022, dB: 0.034, n: 2.7 },
          { s: 0.275, w: 0.028, dF: 0.016, dB: 0.033, n: 2.4 }, { s: 0.293, w: 0.012, dF: 0.01, dB: 0.03, n: 2.2 }
        ],
        cap0: true, cap1: true,
        displace: (P, s, ang, r, radial) => radialD(radial, ripple(s, ang, 0.17, 0.014, 0.009, 0.0016, 0, 0.9)),
        weights: footW,
        color: bootCol
      });
      // cou-de-pied : raccord entre la tige et l'empeigne
      bd.loft('botte', {
        a: [fxs, 0.06, -0.035], b: [fxs, 0.14, -0.03], seg: 14, step: 0.03,
        rings: [{ s: 0.0, w: 0.044, dF: 0.05, dB: 0.046 }, { s: 0.05, w: 0.045, dF: 0.052, dB: 0.046 }, { s: 0.08, w: 0.046, dF: 0.054, dB: 0.047 }],
        weights: (s) => { const t = smooth(0.03, 0.08, s); return [[I['foot' + S], 1 - t * 0.5], [I['shin' + S], t * 0.5]]; },
        color: bootCol
      });
    }

    // ---------------------------------------------------------------- cou décharné (tendons, pomme d'Adam, veines)
    // (absent si un module de tête est fourni : son cou descend jusqu'à y = 1,431 m, sous le col)
    if (!Q.sansCou) bd.loft('peau', {
      a: [0, 1.43, -0.032], b: [0, 1.655, -0.03], seg: 18, step: 0.02,
      rings: [{ s: 0.0, w: 0.072, dF: 0.062, dB: 0.074 }, { s: 0.06, w: 0.058, dF: 0.052, dB: 0.062 }, { s: 0.13, w: 0.052, dF: 0.048, dB: 0.056, oz: 0.004 }, { s: 0.2, w: 0.055, dF: 0.05, dB: 0.056, oz: 0.008 }, { s: 0.225, w: 0.058, dF: 0.048, dB: 0.054, oz: 0.01 }],
      displace: (P, s, ang, r, radial) => {
        const a = wrapPi(ang);
        let d = 0.004 * gauss(a, 0, 0.18) * gauss(s, 0.09, 0.025);                      // pomme d'Adam
        d += 0.004 * (gauss(a, 0.75, 0.16) + gauss(a, -0.75, 0.16)) * gauss(s, 0.08, 0.06);  // sterno-cléido-mastoïdiens
        d -= 0.003 * (gauss(a, 0.38, 0.12) + gauss(a, -0.38, 0.12)) * gauss(s, 0.06, 0.05);
        return radialD(radial, d);
      },
      weights: (s, ang, P) => { const y = P[1]; const t0 = smooth(1.44, 1.49, y), t1 = smooth(1.57, 1.63, y); return [[I.chest, 1 - t0], [I.neck, t0 * (1 - t1)], [I.head, t1]]; },
      color: (P, s, ang) => {
        let c = mixc(PAL.peau, PAL.peauOmbre, 0.25 + fbm(P[0] * 40, P[1] * 40, P[2] * 40, 241) * 0.3);
        const v = 1 - smooth(0.0, 0.05, Math.abs(vnoise(s * 30, ang * 2.5, 3, 243) - 0.5));
        return mixc(c, PAL.veine, v * 0.45 * smooth(-0.3, 0.6, Math.abs(Math.sin(ang))));
      },
      extra: (P, s, ang) => [0, 0, (1 - smooth(0.0, 0.04, Math.abs(vnoise(s * 30, ang * 2.5, 3, 243) - 0.5))) * 0.5]
    });
  }
