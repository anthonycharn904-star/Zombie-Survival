  // ============================================================================================
  // Mains gantées de cuir noir, longues et osseuses : cuir tendu sur les jointures, plis de flexion, coutures
  // sur les côtés des doigts, usure plus claire aux arêtes. Le bout de l'index et du majeur est déchiré :
  // la peau grise et un ongle noir en griffe dépassent. Cinq doigts à trois phalanges (griffes, désignation).
  // Main gauche construite, droite en miroir. Structure des doigts reprise de ../survivant/src/arms.js.
  // ============================================================================================
  function construireMains(bd, THREE, I, W) {
    const ad = ARM_DIR;
    const peauMain = (P, k) => {
      let c = mixc(PAL.peau, PAL.peauOmbre, 0.12 + fbm(P[0] * 70, P[1] * 70, P[2] * 70, 401) * 0.45);
      c = mixc(c, PAL.peauFroide, fbm(P[0] * 20, P[1] * 20, P[2] * 20, 403) * 0.35);
      return mixc(c, PAL.cendre, (k || 0) + smooth(0.62, 0.85, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 405)) * 0.25);
    };
    // cuir noir : légères variations, usure plus claire (k), sillons plus sombres (creux)
    const cuirGant = (P, k, creux) => {
      let c = mixc(PAL.gant, PAL.gantSombre, 0.25 + fbm(P[0] * 90, P[1] * 90, P[2] * 90, 421) * 0.5);
      c = mixc(c, PAL.gantUse, clamp((k || 0) + smooth(0.68, 0.9, fbm(P[0] * 40, P[1] * 40, P[2] * 40, 423)) * 0.3, 0, 1));
      return mixc(c, mulc(PAL.gantSombre, 0.55), clamp(creux || 0, 0, 1));
    };
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const mir = sx < 0;
      const wr = W.handL;                          // côté gauche ; la droite par miroir
      const handW = (s) => { const t = smooth(-0.022, 0.012, s); return [[I['tors' + S], (1 - t) * 0.5], [I['fore' + S], (1 - t) * 0.5], [I['hand' + S], t]]; };
      const veineDos = (P, s, ang) => {
        const dorsal = smooth(-0.15, -0.55, Math.sin(ang));
        const v = 1 - smooth(0.0, 0.06, Math.abs(vnoise(s * 28, P[2] * 60, 7 + sx, 407) - 0.5));
        const v2 = 1 - smooth(0.0, 0.05, Math.abs(vnoise(s * 45 + 3, P[2] * 90, 9 + sx, 409) - 0.5));
        return Math.max(v, v2 * 0.7) * dorsal;
      };
      // paume et dos de la main (gant)
      bd.loft('gant', {
        a: wr, b: vadd(wr, vscale(ad, 0.2)), mirror: mir, seg: 14, step: 0.011, s0: -0.03, s1: L_PALM + 0.006,
        rings: [
          { s: -0.03, w: 0.0215, d: 0.029, n: 2.2 }, { s: 0.0, w: 0.019, d: 0.0305, n: 2.3 },
          { s: 0.022, wL: 0.0178, wR: 0.0158, d: 0.0365, n: 2.6 }, { s: 0.05, wL: 0.0171, wR: 0.0139, d: 0.0398, n: 3.0 },
          { s: 0.078, wL: 0.015, wR: 0.0122, d: 0.041, n: 3.0 }, { s: L_PALM + 0.006, w: 0.0112, d: 0.039, n: 2.8 }
        ],
        cap1: true,
        displace: (P, s, ang, r, radial) => {
          const dorsal = smooth(-0.2, -0.6, Math.sin(ang));
          let d = 0;
          for (const [f, dz, back] of DOIGTS) {
            d += 0.0011 * gauss(P[2] - dz, 0, 0.0032) * smooth(0.012, 0.03, s) * smooth(L_PALM + back, L_PALM + back - 0.02, s) * dorsal;   // tendons
            d += 0.0026 * gauss(P[2] - dz, 0, 0.0055) * gauss(s, L_PALM + back - 0.004, 0.0055) * dorsal;                                     // jointures
          }
          d += 0.0005 * gauss(s, -0.012, 0.004);                                                                                               // bord du revers du gant
          return radialD(radial, d);
        },
        weights: (s) => handW(s),
        color: (P, s, ang) => {
          let kn = 0;
          for (const [f, dz, back] of DOIGTS) kn += gauss(P[2] - dz, 0, 0.006) * gauss(s, L_PALM + back - 0.004, 0.006);
          const dorsal = smooth(-0.2, -0.6, Math.sin(ang));
          const couture = Math.max(0, seamAt(ang, 0.05, 1)) * smooth(-0.01, 0.01, s);                    // couture du dos
          const revers = gauss(s, -0.018, 0.003);                                                          // bord roulé du revers
          let c = cuirGant(P, kn * 0.7 * dorsal + revers * 0.5, smooth(0.25, 0.75, Math.sin(ang)) * 0.15);
          return mixc(c, PAL.gantUse, couture * 0.35);
        },
        extra: () => [0, 0, 0]
      });
      // éminence thénar (gras du pouce)
      {
        const pl = PAUME_L, td = POUCE_DIR_L;
        let c = vadd(vadd(vadd(wr, vscale(ad, 0.03)), [0, 0, 0.016]), vscale(pl, 0.0085));
        const g = new THREE.SphereGeometry(1, bd.n(12, 6), bd.n(8, 4));
        const X = vnorm(td), Y = vnorm(vcross(pl, X)), Z = vcross(X, Y);
        const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(X[0], X[1], X[2]), new THREE.Vector3(Y[0], Y[1], Y[2]), new THREE.Vector3(Z[0], Z[1], Z[2]))
          .multiply(new THREE.Matrix4().makeScale(0.032, 0.0185, 0.0145));
        if (mir) { c = miroir(c); M.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1)); }
        M.setPosition(c[0], c[1], c[2]);
        if (mir) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } }
        bd.rigid('gant', g, M, [[I['hand' + S], 0.65], [I['pouce1' + S], 0.35]], (P) => cuirGant(P, 0.05, 0.1));
      }
      // doigts : trois phalanges, jointures osseuses, ongle sombre effilé en griffe
      const doigt = (K, dir, front, L, r0, bones, isThumb, dechire) => {
        const L1 = L[0], L2 = L[1], L3 = L[2], Lt = L1 + L2 + L3;
        r0 *= 1.12;                                           // épaisseur du cuir
        const nail = (s, ang) => smooth(Lt - 0.0165, Lt - 0.0135, s) * smooth(-0.35, -0.7, Math.sin(ang)) + smooth(Lt - 0.001, Lt + 0.001, s);
        // bord déchiré du gant (doigts « dechire ») : au-delà, peau grise et ongle noir pointu
        const bordDechire = (s, ang) => Lt - 0.0185 + 0.0035 * Math.sin(ang * 3 + 1.3) + 0.0025 * Math.sin(ang * 7 + 0.4);
        // bout : griffe (peau et ongle) qui perce le cuir sur les doigts déchirés, bout de gant arrondi sinon
        const bout = dechire
          ? [{ s: Lt - 0.002, wL: r0 * 0.6, wR: r0 * 0.66, d: r0 * 0.64 }, { s: Lt + 0.003, wL: r0 * 0.16, wR: r0 * 0.36, d: r0 * 0.36, ox: r0 * 0.2 }, { s: Lt + 0.0075, w: r0 * 0.05, d: r0 * 0.06, ox: r0 * 0.34 }]
          : [{ s: Lt - 0.003, wL: r0 * 0.8, wR: r0 * 0.8, d: r0 * 0.78 }, { s: Lt + 0.0012, wL: r0 * 0.64, wR: r0 * 0.66, d: r0 * 0.6 }, { s: Lt + 0.0042, wL: r0 * 0.26, wR: r0 * 0.28, d: r0 * 0.24 }];
        bd.loft('gant', {
          a: K, b: vadd(K, vscale(dir, Lt)), front: front, mirror: mir, seg: 8, step: 0.0072, s0: isThumb ? -0.016 : -0.012, s1: bout[bout.length - 1].s,
          rings: [
            { s: isThumb ? -0.016 : -0.012, w: r0 * 1.3, d: r0 * 1.25 }, { s: 0.0, wL: r0 * 1.12, wR: r0 * 1.2, d: r0 * 1.16 },
            { s: L1 * 0.5, wL: r0 * 0.95, wR: r0 * 0.86, d: r0 * 0.92 }, { s: L1, wL: r0 * 0.98, wR: r0 * 1.04, d: r0 * 1.04 },
            { s: L1 + L2 * 0.5, wL: r0 * 0.88, wR: r0 * 0.8, d: r0 * 0.86 }, { s: L1 + L2, wL: r0 * 0.9, wR: r0 * 0.94, d: r0 * 0.92 },
            { s: Lt - 0.009, wL: r0 * 0.84, wR: r0 * 0.78, d: r0 * 0.8 }
          ].concat(bout),
          cap0: true, cap1: true,
          displace: (P, s, ang, r, radial) => {
            const dorsal = smooth(-0.2, -0.7, Math.sin(ang));
            let d = 0.0012 * (gauss(s, L1, 0.0032) + gauss(s, L1 + L2, 0.0028)) * dorsal;
            d -= 0.0004 * (gauss(s, L1 - 0.003, 0.001) + gauss(s, L1 + 0.003, 0.001) + gauss(s, L1 + L2 + 0.002, 0.001)) * dorsal;
            if (dechire) d += 0.0005 * nail(s, ang) * (s < Lt ? 1 : 0);
            return radialD(radial, d);
          },
          weights: (s) => {
            const a = smooth(-0.006, 0.004, s), b = smooth(L1 - 0.005, L1 + 0.005, s), c = smooth(L1 + L2 - 0.0045, L1 + L2 + 0.0045, s);
            return [[bones[0], 1 - a], [bones[1], a * (1 - b)], [bones[2], b * (1 - c)], [bones[3], c]];
          },
          color: (P, s, ang) => {
            const dorsal = smooth(-0.2, -0.7, Math.sin(ang));
            const jointures = (gauss(s, L1, 0.003) + gauss(s, L1 + L2, 0.0026)) * dorsal;
            const plis = (gauss(s, L1, 0.0012) + gauss(s, L1 + L2, 0.001)) * (1 - dorsal);
            const couture = Math.max(0, seamAt(ang, Math.PI * 0.5, 1)) + Math.max(0, seamAt(ang, -Math.PI * 0.5, 1));
            let c = cuirGant(P, jointures * 0.55 + smooth(Lt - 0.012, Lt, s) * 0.25, plis * 0.7);
            c = mixc(c, PAL.gantUse, clamp(couture, 0, 1) * 0.3 * smooth(0.002, 0.01, s) * smooth(Lt - 0.004, Lt - 0.012, s));
            if (dechire) {
              const bd0 = bordDechire(s, ang);
              if (s > bd0) {
                c = peauMain(P, 0.1);
                const nl = nail(s, ang);
                c = mixc(c, mixc(PAL.ongle, PAL.sangSec, 0.25 * vnoise(s * 400, ang, 1, 413)), clamp(nl, 0, 1) * 0.97);
              } else c = mixc(c, mulc(PAL.gantSombre, 0.5), smooth(bd0 - 0.002, bd0, s) * 0.8);   // bord effiloché
            }
            return c;
          },
          extra: () => [0, 0, 0]
        });
      };
      for (const [f, dz, back, len, r0] of DOIGTS) {
        const K = W[f + '1L'];
        doigt(K, ad, [0, 0, 1], len, r0, [I['hand' + S], I[f + '1' + S], I[f + '2' + S], I[f + '3' + S]], false, f === 'index' || f === 'majeur');
      }
      doigt(W.pouce1L, POUCE_DIR_L, vcross(PAUME_L, POUCE_DIR_L), POUCE_L, 0.0102, [I['hand' + S], I['pouce1' + S], I['pouce2' + S], I['pouce3' + S]], true, false);
    }
  }
