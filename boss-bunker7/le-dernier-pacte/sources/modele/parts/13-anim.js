  // ============================================================================================
  // Moteur d'animation : pose = f(action, tAction / dureeAction) (déterministe), fondu de pose au
  // changement d'action, couches secondaires (respiration, flottement, regard, visée, sursauts,
  // affaiblissement, tremblement de rage, inclinaison selon la vitesse), IK à deux os des bras
  // (méthode reprise de ../survivant/src/anim.js, solveArm), poignets, doigts, mâchoire, yeux, et
  // physique de ressorts des pans du manteau et de l'étole (Verlet, collisions avec le torse et les
  // jambes), manches qui remontent quand l'avant-bras se lève (cibles de morphose).
  // ============================================================================================
  // inclinaison minimale sous l'horizontale (rad) des bras qui visent : jamais de bras tendu vers l'avant et le haut
  const MIN_VISEE = { projection: 0.72, 'double-projection': 0.72, 'designation-mur': 0.34, 'saisie-mur': 0.3, lancer: 0.25, 'trait-preparation': 0.16, 'trait-lancer': 0.2,
    'crochet-visee': 0.16, 'crochet-lancer': 0.16 };
  const DISSOL_ACTIONS = {
    apparition: (u) => 1 - smooth(0.0, 0.6, u),
    disparition: (u) => smooth(0.12, 0.95, u),
    'teleport-sortie': (u) => smooth(0.35, 0.92, u),
    'teleport-entree': (u) => 1 - smooth(0.0, 0.62, u),
    reapparition: (u) => 1 - smooth(0.0, 0.7, u),
    reprise: (u) => smooth(0.72, 1.0, u),
    'retour-rage': (u) => 1 - smooth(0.0, 0.07, u)
  };
  const PHASE5 = { 'formation-lames': 1, traque: 1, 'frappe-preparation': 1, frappe: 1, 'frappe-ratee': 1, reapparition: 1, defaite: 1, 'frappe-recuperation': 1, 'frappe-ord-preparation': 1, 'frappe-ord': 1, 'frappe-ord-recuperation': 1,
    'crochet-visee': 1, 'crochet-lancer': 1, 'crochet-traction': 1 };

  function creerAnimateur(THREE, M) {
    const B = M.B, objet = M.objet, corps = M.corps, U = M.U;
    const leger = !!(M.opts && M.opts.allege);
    const CL = compilerClips();
    const P = new Float32Array(NPOSE), Pc = new Float32Array(NPOSE), Pm = new Float32Array(NPOSE), Pfrom = new Float32Array(NPOSE), A = new Float32Array(NPOSE);
    P.set(BASE_T); Pfrom.set(BASE_T);
    const bindPos = {};
    for (const k in B) bindPos[k] = B[k].position.clone();
    const e = new THREE.Euler(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m1 = new THREE.Matrix4(), mInv = new THREE.Matrix4();
    const qCorps = new THREE.Quaternion(), qCorpsInv = new THREE.Quaternion(), sCorps = new THREE.Vector3(), pCorps = new THREE.Vector3();
    const axe = (a) => new THREE.Vector3(a[0], a[1], a[2]).normalize();
    // repères de référence des bras et des mains
    const COTE = {};
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const d0 = [ARM_DIR[0] * sx, ARM_DIR[1], 0];
      const n0 = vnorm(vsub([1, 0, 0], vscale(d0, d0[0])));
      const palm = sx > 0 ? PAUME_L : miroir(PAUME_L);
      const td = sx > 0 ? POUCE_DIR_L : miroir(POUCE_DIR_L);
      const flex = vnorm(vcross(d0, palm)), ecart = vnorm(vcross(d0, [0, 0, 1]));
      const pflex = vnorm(vcross(td, palm));
      let opp = d0.slice(); if (vdot(vcross(opp, td), palm) < 0) opp = vscale(opp, -1);
      COTE[S] = { sx: sx, d0: d0, n0: n0, palm: palm, td: td, aD0: axe(d0), aFlex: axe(flex), aEcart: axe(ecart), aPflex: axe(pflex), aOpp: axe(opp),
        os: { arm: B['arm' + S], fore: B['fore' + S], tors: B['tors' + S], hand: B['hand' + S], clav: B['clav' + S],
          doigts: DOIGTS.map(([f]) => [B[f + '1' + S], B[f + '2' + S], B[f + '3' + S]]), pouce: [B['pouce1' + S], B['pouce2' + S], B['pouce3' + S]] } };
    }
    const st = {
      temps: 0, action: null, tPrec: -1, fondu: 1, fonduT: 0, init: false,
      toucheN: null, ressort: [0, 0, 0], ressortV: [0, 0, 0],
      regardY: 0, regardP: 0, vitF: 0, vitL: 0, puis: 0, rage: 0, faib: 0, bouclier: 0,
      posPrec: new THREE.Vector3(), aPos: false, panInit: false, acc: 0, mach: 0, lueur: 1, cligne: 0,
      dissol: 0, viseeLiss: null, pulse: 0, solPose: 0, nSursaut: 1
    };
    // --------------------------------------------------------------- outils repère du modèle (espace « corps »)
    const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
    const majRepere = () => {
      corps.matrixWorld.decompose(pCorps, qCorps, sCorps);
      qCorpsInv.copy(qCorps).invert();
      mInv.copy(corps.matrixWorld).invert();
    };
    const pM = (bone, out) => out.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(mInv);
    const qM = (bone, out) => { bone.matrixWorld.decompose(tmpP, out, tmpS); return out.premultiply(qCorpsInv); };
    const setQM = (bone, qModel) => { qM(bone.parent, q3); bone.quaternion.copy(q3.invert().multiply(qModel)); bone.updateMatrixWorld(true); };
    // petits vecteurs [x, y, z] SANS allocation (tampons réutilisés) pour tout ce qui tourne à chaque image
    const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
    const sub3 = (o, a, b) => set3(o, a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const madd3 = (o, a, b, k) => set3(o, a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k);
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const len3 = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    const nrm3 = (o, a) => { const l = len3(a) || 1; return set3(o, a[0] / l, a[1] / l, a[2] / l); };
    const crs3 = (o, a, b) => set3(o, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
    const lerp3 = (o, a, b, t) => set3(o, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    const vrot3 = (o, v, k, a) => {
      const c = Math.cos(a), s = Math.sin(a), d = dot3(k, v);
      const cx = k[1] * v[2] - k[2] * v[1], cy = k[2] * v[0] - k[0] * v[2], cz = k[0] * v[1] - k[1] * v[0];
      return set3(o, v[0] * c + cx * s + k[0] * d * (1 - c), v[1] * c + cy * s + k[1] * d * (1 - c), v[2] * c + cz * s + k[2] * d * (1 - c));
    };
    const m0 = new THREE.Matrix4(), mm1 = new THREE.Matrix4(), _b0 = [0, 0, 0], _b1 = [0, 0, 0];
    const basisQuat = (d0, n0, d1, n1, out) => {
      crs3(_b0, d0, n0); crs3(_b1, d1, n1);
      m0.set(d0[0], n0[0], _b0[0], 0, d0[1], n0[1], _b0[1], 0, d0[2], n0[2], _b0[2], 0, 0, 0, 0, 1);
      mm1.set(d1[0], n1[0], _b1[0], 0, d1[1], n1[1], _b1[1], 0, d1[2], n1[2], _b1[2], 0, 0, 0, 0, 1);
      mm1.multiply(m0.transpose());
      return out.setFromRotationMatrix(mm1);
    };
    const rotV3 = (o, v, q) => { v1.set(v[0], v[1], v[2]).applyQuaternion(q); return set3(o, v1.x, v1.y, v1.z); };
    const g3 = (k, i) => A[OFF[k] + i];

    // --------------------------------------------------------------- IK du bras (espace du modèle)
    const _s = [0, 0, 0], _dv = [0, 0, 0], _u = [0, 0, 0], _pv = [0, 0, 0], _E = [0, 0, 0], _Wp = [0, 0, 0], _dUp = [0, 0, 0], _dFo = [0, 0, 0], _n1 = [0, 0, 0], _nUp = [0, 0, 0], _nFo = [0, 0, 0];
    function resoudreBras(S, cible, pole) {
      const C = COTE[S], up = C.os.arm, fo = C.os.fore;
      pM(up, v2);
      set3(_s, v2.x, v2.y, v2.z);
      const a = L_UPPER, b = L_FORE;
      sub3(_dv, cible, _s);
      const D = clamp(len3(_dv), Math.abs(a - b) + 1e-3, a + b - 2e-3);
      nrm3(_u, _dv);
      madd3(_pv, pole, _u, -dot3(pole, _u));
      if (len3(_pv) < 1e-5) set3(_pv, 0, -1, 0);
      nrm3(_pv, _pv);
      const cosA = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
      madd3(_E, _s, _u, a * cosA); madd3(_E, _E, _pv, a * sinA);
      madd3(_Wp, _s, _u, D);
      nrm3(_dUp, sub3(_dUp, _E, _s)); nrm3(_dFo, sub3(_dFo, _Wp, _E));
      crs3(_n1, _dFo, _dUp);
      if (len3(_n1) < 1e-5) crs3(_n1, _dUp, _pv);
      nrm3(_n1, _n1);
      nrm3(_nUp, madd3(_nUp, _n1, _dUp, -dot3(_n1, _dUp)));
      nrm3(_nFo, madd3(_nFo, _n1, _dFo, -dot3(_n1, _dFo)));
      setQM(up, basisQuat(C.d0, C.n0, _dUp, _nUp, q1));
      setQM(fo, basisQuat(C.d0, C.n0, _dFo, _nFo, q1));
    }
    // torsion de l'avant-bras et orientation de la main pour présenter la paume dans la direction voulue
    const _a = [0, 0, 0], _pn = [0, 0, 0], _pdp = [0, 0, 0], _pnp = [0, 0, 0], _x = [0, 0, 0], _y = [0, 0, 0], _c = [0, 0, 0], _pn2 = [0, 0, 0];
    function orienterMain(S, pd, flexClip, devClip) {
      const C = COTE[S], fo = C.os.fore;
      qM(fo, q1);
      rotV3(_a, C.d0, q1); rotV3(_pn, C.palm, q1);
      madd3(_pdp, pd, _a, -dot3(pd, _a)); madd3(_pnp, _pn, _a, -dot3(_pn, _a));
      let tau = 0;
      if (len3(_pdp) > 1e-3 && len3(_pnp) > 1e-3) { nrm3(_x, _pnp); nrm3(_y, _pdp); tau = Math.atan2(dot3(_a, crs3(_c, _x, _y)), dot3(_x, _y)); }
      tau = clamp(tau, -1.8, 1.8);
      C.os.tors.quaternion.setFromAxisAngle(C.aD0, tau * 0.55);
      vrot3(_pn2, _pn, _a, tau);
      const flexAuto = clamp(-Math.atan2(dot3(pd, _a), Math.max(0.05, dot3(pd, _pn2))), -1.15, 1.0);
      const fl = clamp(flexAuto + flexClip, -1.25, 1.15);
      q1.setFromAxisAngle(C.aD0, tau * 0.45);
      q2.setFromAxisAngle(C.aFlex, fl); q1.multiply(q2);
      q2.setFromAxisAngle(C.aEcart, clamp(devClip, -0.5, 0.5)); q1.multiply(q2);
      C.os.hand.quaternion.copy(q1);
    }
    // formes de main pré-indexées : FORMES_T[k][d] = [4 valeurs] pour la forme k et le doigt d (4 doigts puis pouce)
    const NOMS_DOIGTS = DOIGTS.map((d) => d[0]).concat(['pouce']);
    const FORMES_T = MAINS.map((m) => NOMS_DOIGTS.map((f) => FORMES[m][f]));
    const I_TENIR = MAINS.indexOf('tenir');
    const formeTmp = NOMS_DOIGTS.map(() => [0, 0, 0, 0]);
    function appliquerDoigts(S, off, tenir, tremb, twitch) {
      for (let d = 0; d < formeTmp.length; d++) { const t = formeTmp[d]; t[0] = t[1] = t[2] = t[3] = 0; }
      let tot = 0;
      for (let k = 0; k < MAINS.length; k++) {
        let w = A[off + k] * (1 - tenir);
        if (k === I_TENIR) w += tenir;
        if (w <= 1e-4) continue;
        tot += w;
        const F = FORMES_T[k];
        for (let d = 0; d < formeTmp.length; d++) { const t = formeTmp[d], fd = F[d]; t[0] += fd[0] * w; t[1] += fd[1] * w; t[2] += fd[2] * w; t[3] += fd[3] * w; }
      }
      tot = tot || 1;
      const C = COTE[S], osD = C.os.doigts, dec = S === 'L' ? 0 : 11;
      for (let fi = 0; fi < osD.length; fi++) {
        const a = formeTmp[fi], o = osD[fi];
        const tw = twitch ? Math.max(0, bruit1(st.temps * 1.6 + fi * 3.7 + dec, 71) - 0.45) * 1.1 * twitch : 0;
        const tr = tremb ? bruit1(st.temps * 15 + fi * 5.1, 73) * 0.12 * tremb : 0;
        q1.setFromAxisAngle(C.aEcart, a[0] / tot); q2.setFromAxisAngle(C.aFlex, a[1] / tot + tw * 0.5 + tr); q1.multiply(q2);
        o[0].quaternion.copy(q1);
        o[1].quaternion.setFromAxisAngle(C.aFlex, a[2] / tot + tw + tr);
        o[2].quaternion.setFromAxisAngle(C.aFlex, a[3] / tot + tw * 0.7);
      }
      const t = formeTmp[formeTmp.length - 1], op = C.os.pouce;
      q1.setFromAxisAngle(C.aOpp, t[0] / tot); q2.setFromAxisAngle(C.aPflex, t[1] / tot); q1.multiply(q2);
      op[0].quaternion.copy(q1);
      op[1].quaternion.setFromAxisAngle(C.aPflex, t[2] / tot);
      op[2].quaternion.setFromAxisAngle(C.aPflex, t[3] / tot);
    }

    // --------------------------------------------------------------- physique des pans du manteau (espace monde)
    const PAN = [];
    {
      for (let k = 0; k < PAN_N; k++) {
        const f = k / (PAN_N - 1), pts = [];
        for (let i = 0; i < PAN_Y.length; i++) pts.push(pointJupe(f, PAN_Y[i], -0.012));
        const L = [], dirs = [];
        for (let i = 0; i < pts.length - 1; i++) { L.push(vlen(vsub(pts[i + 1], pts[i]))); dirs.push(axe(vsub(pts[i + 1], pts[i]))); }
        const hip = [0, 0.985, 0];
        PAN.push({ f: f, rest: pts.map((p) => vsub(p, hip)), L: L, dirs: dirs, x: pts.map(() => new THREE.Vector3()), xp: pts.map(() => new THREE.Vector3()), bones: [0, 1, 2, 3].map((i) => B['pan' + k + '_' + i]) });
      }
    }
    // distances de repos entre chaînes voisines (même niveau), calculées une fois
    for (let k = 0; k < PAN.length; k++) { const C0 = PAN[k], C1 = PAN[Math.min(PAN.length - 1, k + 1)]; C0.rn = C0.rest.map((r, i) => vlen(vsub(r, C1.rest[i]))); }
    const hipM = new THREE.Matrix4(), capA = new THREE.Vector3(), capB = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
    const capsules = [];
    for (let i = 0; i < 7; i++) capsules.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 });
    const STIF = [0, 0.11, 0.045, 0.02, 0.009];
    const CAPS = [[B.thighL, B.shinL, 0.125], [B.thighR, B.shinR, 0.125], [B.shinL, B.footL, 0.085], [B.shinR, B.footR, 0.085], [B.thighL, B.thighR, 0.15], [B.hips, B.spine, 0.17]];
    function capsulesJambes(echelle) {
      for (let n = 0; n < CAPS.length; n++) {
        const c = CAPS[n];
        capsules[n].a.setFromMatrixPosition(c[0].matrixWorld); capsules[n].b.setFromMatrixPosition(c[1].matrixWorld); capsules[n].r = c[2] * echelle;
      }
      return CAPS.length;
    }
    function pousserHors(p, nCap) {
      for (let c = 0; c < nCap; c++) {
        const C = capsules[c];
        tmpV.subVectors(C.b, C.a);
        const l2 = tmpV.lengthSq();
        let t = l2 > 1e-8 ? tmpW.subVectors(p, C.a).dot(tmpV) / l2 : 0;
        t = clamp(t, 0, 1);
        tmpW.copy(C.a).addScaledVector(tmpV, t);
        const d = p.distanceTo(tmpW);
        if (d < C.r && d > 1e-6) p.sub(tmpW).multiplyScalar(C.r / d).add(tmpW);
      }
    }
    function physiqueManteau(dt, lev, solW, solY) {
      const echelle = sCorps.x;
      hipM.copy(B.hips.matrixWorld);
      const reset = !st.panInit;
      st.panInit = true;
      const nCap = capsulesJambes(echelle);
      st.nCap = nCap;
      const steps = reset ? 1 : Math.min(3, Math.max(1, Math.round(dt * 60)));
      const h = reset ? 0 : dt / steps;
      const g = -9.8 * 0.5, up = 4.2 * lev, t = st.temps;
      for (let s = 0; s < steps; s++) {
        for (let k = 0; k < PAN.length; k++) {
          const C = PAN[k];
          for (let i = 0; i < C.x.length; i++) {
            tmpV.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(hipM);
            if (i === 0 || reset) { C.x[i].copy(tmpV); C.xp[i].copy(tmpV); continue; }
            const x = C.x[i], xp = C.xp[i];
            // amortissement + traînée de l'air (le drap traîne derrière quand il file)
            const ax0 = x.x - xp.x, ay0 = x.y - xp.y, az0 = x.z - xp.z;
            const vit = Math.hypot(ax0, ay0, az0) / Math.max(1e-4, h);
            const dr = Math.max(0.86, 1 - h * (2.0 + 0.55 * vit));
            const vx = ax0 * dr, vy = ay0 * dr, vz = az0 * dr;
            xp.copy(x);
            // courant ascendant de la lévitation, poussée vers l'extérieur, vent surnaturel
            const a = angPan(C.f, PAN_Y[i]);
            v3.set(Math.sin(a), 0, Math.cos(a)).applyQuaternion(qCorps);
            const wind = 1.4 * lev + 0.4;
            const nx = bruit1(t * 0.8 + k * 0.37 + i * 0.21, 81) * wind, nz = bruit1(t * 0.7 + k * 0.29 + i * 0.17, 83) * wind, ny = bruit1(t * 0.9 + k * 0.33, 85) * wind * 0.6;
            const lift = up * (0.55 + 0.45 * bruit1(t * 0.6 + k * 0.5, 87)) * (i / 4);
            x.x += vx + (v3.x * 1.1 * lev * (i / 4) + nx) * h * h;
            x.y += vy + (g + lift + ny) * h * h;
            x.z += vz + (v3.z * 1.1 * lev * (i / 4) + nz) * h * h;
            x.lerp(tmpV, STIF[i]);
          }
        }
        // contraintes : longueur des segments, voisins au même niveau, collisions jambes et sol
        for (let it = 0; it < 2; it++) {
          for (let k = 0; k < PAN.length; k++) {
            const C = PAN[k];
            for (let i = 1; i < C.x.length; i++) {
              const p0 = C.x[i - 1], p1 = C.x[i], L = C.L[i - 1] * echelle;
              tmpV.subVectors(p1, p0); const d = tmpV.length() || 1e-6;
              p1.copy(p0).addScaledVector(tmpV, L / d);
            }
          }
          for (let k = 0; k < PAN.length - 1; k++) {
            const C0 = PAN[k], C1 = PAN[k + 1];
            for (let i = 1; i < C0.x.length; i++) {
              const r0 = C0.rn[i] * echelle;
              tmpV.subVectors(C1.x[i], C0.x[i]); const d = tmpV.length() || 1e-6;
              const tgt = clamp(d, r0 * 0.55, r0 * 1.25);
              if (tgt !== d) { const c = (d - tgt) / d * 0.5; C0.x[i].addScaledVector(tmpV, c); C1.x[i].addScaledVector(tmpV, -c); }
            }
          }
          for (let k = 0; k < PAN.length; k++) {
            const C = PAN[k];
            for (let i = 1; i < C.x.length; i++) {
              pousserHors(C.x[i], nCap);
              if (solW > 0 && C.x[i].y < solY + 0.01) C.x[i].y = solY + 0.01;
            }
          }
        }
      }
      orienterPans();
    }
    // orientation des os : direction p_i → p_i+1 exprimée dans le repère du parent
    function orienterPans() {
      for (let k = 0; k < PAN.length; k++) {
        const C = PAN[k];
        qM(B.hips, q2); q2.premultiply(qCorps);   // orientation monde du bassin
        for (let i = 0; i < 4; i++) {
          tmpV.subVectors(C.x[i + 1], C.x[i]).normalize();
          tmpV.applyQuaternion(q3.copy(q2).invert());
          q1.setFromUnitVectors(C.dirs[i], tmpV);
          C.bones[i].quaternion.copy(q1);
          q2.multiply(q1);
        }
      }
    }

    // --------------------------------------------------------------- physique des deux pans de l'étole (espace monde)
    const ETO = [];
    {
      const Wc = M.W.chest;
      for (const [G, sx] of [['G', 1], ['D', -1]]) {
        const pts = ETO_Y.map((y) => pointEtole(sx, y));
        const L = [], dirs = [];
        for (let i = 0; i < pts.length - 1; i++) { L.push(vlen(vsub(pts[i + 1], pts[i]))); dirs.push(axe(vsub(pts[i + 1], pts[i]))); }
        // position de repos de chaque point : liée à la poitrine en haut, à la colonne puis au bassin plus bas, pour que
        // le pan reste couché sur le devant du manteau quand le corps se penche ou se cambre
        const osRepos = pts.map((p) => (p[1] > 1.16 ? 0 : p[1] > 0.98 ? 1 : 2));
        const Wr = [M.W.chest, M.W.spine, M.W.hips];
        ETO.push({ G: G, rest: pts.map((p, i) => vsub(p, Wr[osRepos[i]])), osRepos: osRepos, L: L, dirs: dirs, x: pts.map(() => new THREE.Vector3()), xp: pts.map(() => new THREE.Vector3()),
          bones: L.map((_, i) => B['eto' + G + '_' + i]) });
      }
    }
    // gabarit du torse (buste du manteau + ceinture) tous les centimètres, pour pousser l'étole hors du corps
    const GAB = { y0: 0.95, n: 56, wL: new Float32Array(56), wR: new Float32Array(56), dF: new Float32Array(56), dB: new Float32Array(56), oz: new Float32Array(56) };
    {
      const RB = prepRings(MANTEAU_RINGS);
      for (let i = 0; i < GAB.n; i++) {
        const y = GAB.y0 + i * 0.01, r = interpRing(RB, y - MANTEAU_Y0), e = 0.007 + (y > 0.98 && y < 1.04 ? 0.0075 : 0);
        GAB.wL[i] = r.wL + e; GAB.wR[i] = r.wR + e; GAB.dF[i] = r.dF + e; GAB.dB[i] = r.dB + e; GAB.oz[i] = r.oz;
      }
    }
    const mInvT = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()], osT = [B.chest, B.spine, B.hips];
    const yBindT = [M.W.chest, M.W.spine, M.W.hips];
    const chestM = new THREE.Matrix4(), vT = new THREE.Vector3();
    function pousserTorse(p) {
      // contrainte d'un seul côté : l'étole reste DEVANT le torse (jamais poussée vers le dos, pas de traversée),
      // dans le repère de la poitrine, de la colonne ou du bassin selon la hauteur (pose de référence)
      for (let b = 0; b < 3; b++) {
        vT.copy(p).applyMatrix4(mInvT[b]);
        const W0 = yBindT[b];
        const y = vT.y + W0[1];
        if (b === 0 && y < 1.14) continue;
        if (b === 1 && y < 0.98) continue;
        if (y < GAB.y0 || y > GAB.y0 + (GAB.n - 1) * 0.01) return;
        const i = Math.min(GAB.n - 1, Math.max(0, Math.round((y - GAB.y0) / 0.01)));
        const x = vT.x + W0[0], z = vT.z + W0[2];
        const w = x >= 0 ? GAB.wL[i] : GAB.wR[i], u = x / w;
        if (Math.abs(u) >= 1) return;
        const zf = GAB.oz[i] + GAB.dF[i] * Math.sqrt(1 - u * u);
        if (z < zf) { vT.z = zf - W0[2]; p.copy(vT).applyMatrix4(osT[b].matrixWorld); }
        return;
      }
    }
    const STIF_E = [0, 0.26, 0.2, 0.16, 0.13, 0.11, 0.09];
    function physiqueEtole(dt, lev, solW, solY) {
      const echelle = sCorps.x, nCap = st.nCap || 0;
      chestM.copy(B.chest.matrixWorld);
      for (let b = 0; b < 3; b++) mInvT[b].copy(osT[b].matrixWorld).invert();
      const reset = !st.etoInit;
      st.etoInit = true;
      const steps = reset ? 1 : Math.min(3, Math.max(1, Math.round(dt * 60)));
      const h = reset ? 0 : dt / steps;
      const g = -9.8 * 0.55, up = 1.1 * lev, t = st.temps;
      for (let s = 0; s < steps; s++) {
        for (let k = 0; k < ETO.length; k++) {
          const C = ETO[k];
          for (let i = 0; i < C.x.length; i++) {
            tmpV.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(osT[C.osRepos[i]].matrixWorld);
            if (i === 0 || reset) { C.x[i].copy(tmpV); C.xp[i].copy(tmpV); continue; }
            const x = C.x[i], xp = C.xp[i];
            const ax0 = x.x - xp.x, ay0 = x.y - xp.y, az0 = x.z - xp.z;
            const vit = Math.hypot(ax0, ay0, az0) / Math.max(1e-4, h);
            const dr = Math.max(0.8, 1 - h * (3.2 + 0.8 * vit));
            xp.copy(x);
            const wind = 0.22 * lev + 0.06;
            const nx = bruit1(t * 0.9 + k * 1.7 + i * 0.23, 181) * wind, nz = bruit1(t * 0.8 + k * 1.3 + i * 0.19, 183) * wind;
            const lift = up * (0.5 + 0.5 * bruit1(t * 0.7 + k * 0.9, 185)) * (i / 6);
            x.x += ax0 * dr + nx * h * h;
            x.y += ay0 * dr + (g + lift) * h * h;
            x.z += az0 * dr + nz * h * h;
            x.lerp(tmpV, STIF_E[i]);
          }
        }
        for (let it = 0; it < 2; it++) {
          for (let k = 0; k < ETO.length; k++) {
            const C = ETO[k];
            for (let i = 1; i < C.x.length; i++) {
              const p0 = C.x[i - 1], p1 = C.x[i], L = C.L[i - 1] * echelle;
              tmpV.subVectors(p1, p0); const d = tmpV.length() || 1e-6;
              p1.copy(p0).addScaledVector(tmpV, L / d);
            }
            for (let i = 1; i < C.x.length; i++) {
              pousserTorse(C.x[i]);
              pousserHors(C.x[i], nCap);
              if (solW > 0 && C.x[i].y < solY + 0.012) C.x[i].y = solY + 0.012;
            }
          }
          // les deux pans ne se traversent pas (écart minimal entre points de même rang)
          const A0 = ETO[0], A1 = ETO[1];
          for (let i = 1; i < A0.x.length; i++) {
            tmpV.subVectors(A1.x[i], A0.x[i]); const d = tmpV.length() || 1e-6, mn = 0.09 * echelle;
            if (d < mn) { const c = (d - mn) / d * 0.5; A0.x[i].addScaledVector(tmpV, c); A1.x[i].addScaledVector(tmpV, -c); }
          }
        }
      }
      orienterEtole();
    }
    function orienterEtole() {
      for (let k = 0; k < ETO.length; k++) {
        const C = ETO[k];
        qM(B.chest, q2); q2.premultiply(qCorps);
        for (let i = 0; i < C.bones.length; i++) {
          tmpV.subVectors(C.x[i + 1], C.x[i]).normalize();
          tmpV.applyQuaternion(q3.copy(q2).invert());
          q1.setFromUnitVectors(C.dirs[i], tmpV);
          C.bones[i].quaternion.copy(q1);
          q2.multiply(q1);
        }
      }
    }

    // --------------------------------------------------------------- tissus allégés (option allege, illusions)
    // Ni intégration ni contraintes itérées : chaque point des pans du manteau et de l'étole prend la position
    // d'équilibre qu'atteint la simulation : repos lié au bassin (ou à la colonne, à la poitrine pour l'étole), évasement
    // et affaissement selon la lévitation, traînée derrière selon la vitesse lissée du boss (même loi que la simulation à
    // 60 i/s), même souffle ; longueurs des segments conservées, bas des pans écarté des jambes, étole gardée devant le
    // torse. Même silhouette à distance pour une fraction du coût.
    const EVASE_P = [0, 0.003, 0.008, 0.015, 0.034], AFF_P0 = [0, 0.012, 0.03, 0.068, 0.15], AFF_P1 = [0, 0.004, 0.012, 0.034, 0.051];
    const TRAIN_P = [0, 0.0106, 0.026, 0.058, 0.13], SOUF_P = [0, 0.0025, 0.0062, 0.014, 0.031];
    const AFF_E = [0, 0.004, 0.006, 0.008, 0.01, 0.012, 0.014], TRAIN_E = [0, 0.0068, 0.0089, 0.011, 0.0137, 0.0162, 0.0198];
    const leg = { init: false, pos: new THREE.Vector3(), vit: new THREE.Vector3(), tmp: new THREE.Vector3() };
    function tissusLegers(dt, lev, solW, solY) {
      const echelle = sCorps.x, t = st.temps;
      // vitesse lissée du boss (monde) ; remise au repos après une téléportation (st.panInit)
      if (!leg.init || !st.panInit) { leg.pos.copy(objet.position); leg.vit.set(0, 0, 0); leg.init = true; }
      else if (dt > 0) {
        leg.tmp.subVectors(objet.position, leg.pos).divideScalar(dt);
        if (leg.tmp.lengthSq() > 900) leg.tmp.set(0, 0, 0);
        leg.vit.lerp(leg.tmp, 1 - Math.exp(-dt * 6)); leg.pos.copy(objet.position);
      }
      st.panInit = true; st.etoInit = true;
      const vx = leg.vit.x, vy = leg.vit.y, vz = leg.vit.z, vit = Math.hypot(vx, vy, vz);
      const kP = (2 + 0.55 * vit) / 4.2, kE = (3.2 + 0.8 * vit) / 6.4, wind = 1.4 * lev + 0.4;
      hipM.copy(B.hips.matrixWorld);
      const nCap = capsulesJambes(echelle);
      st.nCap = nCap;
      for (let k = 0; k < PAN.length; k++) {
        const C = PAN[k];
        const a = angPan(C.f, PAN_Y[3]);
        v3.set(Math.sin(a), 0, Math.cos(a)).applyQuaternion(qCorps);   // vers l'extérieur de la jupe (monde)
        for (let i = 0; i < C.x.length; i++) {
          const x = C.x[i];
          x.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(hipM);
          if (i > 0) {
            const ev = EVASE_P[i] * lev * echelle, af = lerp(AFF_P0[i], AFF_P1[i], lev) * echelle, tr = TRAIN_P[i] * kP, so = SOUF_P[i] * wind * echelle;
            x.x += v3.x * ev - vx * tr + bruit1(t * 0.8 + k * 0.37 + i * 0.21, 81) * so;
            x.y += -af - vy * tr + bruit1(t * 0.9 + k * 0.33, 85) * so * 0.6;
            x.z += v3.z * ev - vz * tr + bruit1(t * 0.7 + k * 0.29 + i * 0.17, 83) * so;
            const p0 = C.x[i - 1], L = C.L[i - 1] * echelle;
            tmpV.subVectors(x, p0); const d = tmpV.length() || 1e-6;
            x.copy(p0).addScaledVector(tmpV, L / d);
            if (i >= 2) pousserHors(x, nCap);
            if (solW > 0 && x.y < solY + 0.01) x.y = solY + 0.01;
          }
          C.xp[i].copy(x);
        }
      }
      orienterPans();
      for (let b = 0; b < 3; b++) mInvT[b].copy(osT[b].matrixWorld).invert();
      for (let k = 0; k < ETO.length; k++) {
        const C = ETO[k];
        for (let i = 0; i < C.x.length; i++) {
          const x = C.x[i];
          x.set(C.rest[i][0], C.rest[i][1], C.rest[i][2]).applyMatrix4(osT[C.osRepos[i]].matrixWorld);
          if (i > 0) {
            const tr = TRAIN_E[i] * kE;
            x.x -= vx * tr; x.y -= AFF_E[i] * echelle + vy * tr; x.z -= vz * tr;
            const p0 = C.x[i - 1], L = C.L[i - 1] * echelle;
            tmpV.subVectors(x, p0); const d = tmpV.length() || 1e-6;
            x.copy(p0).addScaledVector(tmpV, L / d);
            pousserTorse(x);
            if (solW > 0 && x.y < solY + 0.012) x.y = solY + 0.012;
          }
          C.xp[i].copy(x);
        }
      }
      orienterEtole();
    }
    // --------------------------------------------------------------- manches qui remontent (cibles de morphose « L » / « R »)
    const mManteau = M.maillages && M.maillages.manteau, iMorph = mManteau && mManteau.userData.morph ? mManteau.userData.morph : null;
    const vF = new THREE.Vector3(), vH = new THREE.Vector3();
    function majManches(dt) {
      if (!iMorph || !mManteau.morphTargetInfluences) return;
      for (let k = 0; k < 2; k++) {
        const S = k === 0 ? 'L' : 'R';
        if (iMorph[S] == null) continue;
        pM(B['fore' + S], vF); pM(B['hand' + S], vH);
        vH.sub(vF);
        const dy = vH.y / (vH.length() || 1);
        const cible = smooth(-0.12, 0.6, dy);
        const cur = mManteau.morphTargetInfluences[iMorph[S]];
        mManteau.morphTargetInfluences[iMorph[S]] = cur + (cible - cur) * (1 - Math.exp(-dt * (cible > cur ? 6 : 3.5)));
      }
    }

    // --------------------------------------------------------------- application d'une frame
    let dtK = 0;
    const kk = (r) => 1 - Math.exp(-dtK * r);
    const bruitTr = (s2, T, trA) => bruit1(T * 16 + s2 * 7.3, 97 + s2) * trA;
    const CTX = { E: null, A: A, OFF: OFF, action: '', u: 0, t: 0, temps: 0, dt: 0, lev: 0, sol: 0, solMonde: 0, puis: 0, rage: 0, faib: 0, bouclier: 0, dissol: 0, sang: false, qCorps: qCorps, mInv: mInv };
    const PISTE = { m: [0, 0, 0], pole: [0, 0, 0], pd: [0, 0, 0], vP: [0, 0, 0], sh: [0, 0, 0], tgt: [0, 0, 0], dir: [0, 0, 0], d2: [0, 0, 0], side: [0, 0, 0], aim: [0, 0, 0], upv: [0, 0, 0], sd: [0, 0, 0], pAim: [0, 0, 0], pl: [0, 0, 0], tmp: [0, 0, 0] };
    const SIDES = [['L', 'G', OFF.mG, OFF.pG, OFF.paG, OFF.vG, OFF.msG, OFF.fG, OFF.dG], ['R', 'D', OFF.mD, OFF.pD, OFF.paD, OFF.vD, OFF.msD, OFF.fD, OFF.dD]];
    const JAMBES = [['L', OFF.jG, 1, 0], ['R', OFF.jD, -1, 2.1]];
    const OSJ = { L: { thigh: B.thighL, shin: B.shinL, foot: B.footL, toes: B.toesL }, R: { thigh: B.thighR, shin: B.shinR, foot: B.footR, toes: B.toesR } };
    function appliquer(E, dt) {
      dt = clamp(dt || 0, 0, 0.1);
      E = E || {};
      const present = E.present !== false;
      objet.visible = present;
      st.temps += dt;
      U.uTemps.value = st.temps;
      // placement : position = point au sol sous les semelles, altitude = hauteur des semelles (SPEC §2)
      const alt = E.altitude || 0;
      if (E.position) objet.position.set(E.position.x, E.position.y + (M.opts.altitudeIncluse ? 0 : alt), E.position.z);
      if (E.cap != null) objet.rotation.set(0, E.cap, 0);
      // v2.2 : seuls l'objet et le groupe du corps servent avant les bras (le reste est recalculé plus loin)
      objet.updateWorldMatrix(true, false); corps.updateWorldMatrix(false, false);
      majRepere();
      if (st.aPos && objet.position.distanceTo(st.posPrec) > 2.0) { st.panInit = false; st.etoInit = false; }   // téléportation : tissus au repos
      st.posPrec.copy(objet.position); st.aPos = true;

      // ---- action et temps normalisé
      const action = (E.action && CL[E.action]) ? E.action : 'flotte';
      const clip = CL[action];
      const tA = Math.max(0, E.tAction || 0);
      const duree = E.dureeAction > 0 ? E.dureeAction : (DUREES_DEFAUT[action] || 1);
      // u imposé par le séquenceur (étape d'une action), sinon temps / durée ; boucles : horloge du modèle
      let u = clip.boucle ? (tA / clip.periode) % 1 : (E.u != null ? clamp(E.u, 0, 1) : clamp(tA / duree, 0, 1));
      const uCmp = clip.boucle ? tA : u;
      if (action !== st.action || uCmp + 1e-4 < st.tPrec) {
        if (st.init) { Pfrom.set(P); st.fondu = 0; st.fonduT = Math.max(0.03, clip.fondu); } else st.fondu = 1;
        st.action = action;
      }
      st.tPrec = uCmp; st.init = true;
      evaluerClip(clip, u, Pc);
      if (clip.extra) clip.extra(Pc, tA, u, duree);
      const mainG = E.main === 'gauche' && action.indexOf('double') !== 0;
      if (mainG) { miroirPose(Pc, Pm); Pc.set(Pm); }
      if (st.fondu < 1) {
        st.fondu = Math.min(1, st.fondu + dt / st.fonduT);
        const w = ease.s(st.fondu);
        for (let k = 0; k < NPOSE; k++) P[k] = Pfrom[k] + (Pc[k] - Pfrom[k]) * w;
      } else P.set(Pc);
      A.set(P);

      // ---- grandeurs lissées
      dtK = dt;
      st.puis += ((E.puissance || 0) - st.puis) * kk(3);
      st.rage += (((E.rage === true ? 1 : +E.rage) || 0) - st.rage) * kk(4);
      st.faib += ((E.faiblesse || 0) - st.faib) * kk(2);
      st.bouclier += ((E.bouclier || 0) - st.bouclier) * kk(8);
      const lames = E.lames || { etat: 'aucune', t: 0 }, ailes = E.ailes || { etat: 'aucune', t: 0 };
      const tenir = lames.etat === 'actives' ? 1 : lames.etat === 'formation' ? smooth(0.55, 0.8, lames.t) : lames.etat === 'destruction' ? 1 - smooth(0.3, 0.75, lames.t) : 0;
      const sol = A[OFF.sol], lev = 1 - sol;
      st.solPose = sol;
      const T = st.temps;
      // secousse de la poitrine à chaque âme absorbée (vue.ames augmente)
      st.pulse = Math.max(st.pulse * Math.exp(-dt * 5.5), E.pulseAme ? 1 : 0);
      if (st.pulse > 0.01) {
        const pa = st.pulse;
        A[OFF.ch] -= 0.13 * pa; A[OFF.hd] -= 0.1 * pa; A[OFF.mach] += 0.3 * pa; A[OFF.lu] += 0.8 * pa; A[OFF.au] += 0.6 * pa;
      }

      // ---- couches : respiration, flottement, faiblesse, rage, vitesse, sursaut
      const fa = st.faib;
      const perR = lerp(4.4, 2.6, fa) / (1 + 0.25 * st.rage), br = Math.sin(T * TAU / perR) * A[OFF.rs] * (1 + 0.6 * fa);
      A[OFF.ch] += -0.028 * br; A[OFF.sp] += -0.01 * br; A[OFF.hd] += 0.014 * br;
      A[OFF.cG] += 0.022 * br; A[OFF.cD] += 0.022 * br;
      A[OFF.h + 1] += (0.011 * Math.sin(T * 1.27) + 0.004 * Math.sin(T * 2.9)) * lev;
      A[OFF.hr + 2] += 0.018 * Math.sin(T * 1.19) * lev; A[OFF.hr] += 0.012 * Math.sin(T * 0.97 + 1) * lev;
      for (let j = 0; j < 2; j++) {
        const o = JAMBES[j][1], ph = JAMBES[j][3];
        A[o] += 0.06 * Math.sin(T * 0.83 + ph) * lev;
        A[o + 2] += 0.08 * Math.sin(T * 0.71 + ph + 0.5) * lev;
        A[o + 3] += 0.06 * Math.sin(T * 1.13 + ph) * lev;
      }
      if (fa > 0.01) {
        A[OFF.sp] += 0.1 * fa; A[OFF.ch] += 0.1 * fa; A[OFF.nk] += 0.08 * fa; A[OFF.hd] += 0.14 * fa;
        A[OFF.cG] -= 0.1 * fa; A[OFF.cD] -= 0.1 * fa;
        A[OFF.mG + 1] -= 0.05 * fa; A[OFF.mD + 1] -= 0.05 * fa;
        A[OFF.hr + 2] += 0.05 * fa * bruit1(T * 0.5, 91);
        A[OFF.lu] *= 1 - 0.5 * fa; A[OFF.au] *= 1 - 0.6 * fa;
      }
      const trA = Math.max(A[OFF.tr], st.rage * 0.55) + fa * 0.25;
      if (trA > 0.001) {
        A[OFF.sp] += 0.008 * bruitTr(1, T, trA); A[OFF.ch] += 0.012 * bruitTr(2, T, trA); A[OFF.ch + 2] += 0.008 * bruitTr(3, T, trA);
        A[OFF.nk + 1] += 0.012 * bruitTr(4, T, trA); A[OFF.hd] += 0.015 * bruitTr(5, T, trA); A[OFF.hd + 1] += 0.015 * bruitTr(6, T, trA); A[OFF.hd + 2] += 0.01 * bruitTr(7, T, trA);
        for (let i = 0; i < 3; i++) { A[OFF.mG + i] += 0.0045 * bruitTr(8 + i, T, trA); A[OFF.mD + i] += 0.0045 * bruitTr(11 + i, T, trA); }
      }
      if (st.rage > 0.01) { A[OFF.lu] *= 1 + 0.5 * st.rage; A[OFF.au] *= 1 + 0.4 * st.rage; A[OFF.cG] += 0.06 * st.rage; A[OFF.cD] += 0.06 * st.rage; }
      // inclinaison selon la vitesse (repère du boss)
      if (E.vitesse) {
        v1.set(E.vitesse.x || 0, 0, E.vitesse.z || 0).applyQuaternion(q1.copy(qCorps).invert());
        st.vitF += (v1.z - st.vitF) * kk(4); st.vitL += (v1.x - st.vitL) * kk(4);
      } else { st.vitF *= 1 - kk(4); st.vitL *= 1 - kk(4); }
      A[OFF.sp] += clamp(st.vitF * 0.03, -0.12, 0.2) * lev;
      A[OFF.rr] += clamp(-st.vitL * 0.03, -0.14, 0.14) * lev;
      // sursaut à chaque impact (ressort amorti)
      const to = E.touche;
      if (to && to.compteur != null) {
        if (st.toucheN != null && to.compteur !== st.toucheN) {
          const d = to.direction || { x: 0, y: 0, z: -1 };
          v1.set(d.x || 0, d.y || 0, d.z || 0).applyQuaternion(q1.copy(qCorps).invert());
          if (v1.lengthSq() < 1e-6) v1.set(0, 0, -1);
          v1.normalize();
          const f = clamp(to.force == null ? 0.6 : to.force, 0, 1.5) * (1 - 0.6 * sol);
          st.ressortV[0] += v1.z * 5.4 * f; st.ressortV[1] += -v1.x * 5.0 * f; st.ressortV[2] += (hash3(to.compteur, 3, 1, 5) - 0.5) * 3.4 * f;
          if (M.voile && st.bouclier > 0.3) M.voile.impactDirection(v1, f);
        }
        st.toucheN = to.compteur;
      }
      for (let i = 0; i < 3; i++) {
        const w0 = 15, z0 = 0.38;
        const acc = -w0 * w0 * st.ressort[i] - 2 * z0 * w0 * st.ressortV[i];
        st.ressortV[i] += acc * dt; st.ressort[i] += st.ressortV[i] * dt;
      }
      const rp = st.ressort[0], rr = st.ressort[1], ry = st.ressort[2];
      A[OFF.sp] += rp * 0.3; A[OFF.ch] += rp * 0.45; A[OFF.hd] += rp * 0.45; A[OFF.nk] += rp * 0.15;
      A[OFF.sp + 2] += rr * 0.3; A[OFF.ch + 2] += rr * 0.4; A[OFF.hd + 2] += rr * 0.3; A[OFF.ch + 1] += ry * 0.5; A[OFF.hd + 1] += ry * 0.3;
      A[OFF.h] += -rr * 0.1; A[OFF.h + 2] += rp * 0.1;   // le corps entier est un peu repoussé par l'impact

      // ---- regard (tête et cou, limites), l'excédent passe au buste
      let rgW = A[OFF.rg];
      if (E.regard && rgW > 0.001) {
        v1.set(E.regard.x, E.regard.y, E.regard.z);
        v2.set(0, 1.62, 0.02); corps.localToWorld(v2);
        v1.sub(v2).applyQuaternion(q1.copy(qCorps).invert());
        const yaw = Math.atan2(v1.x, v1.z), pit = Math.atan2(v1.y, Math.hypot(v1.x, v1.z));
        let dy = wrapPi(yaw - (A[OFF.hr + 1] + A[OFF.sp + 1] + A[OFF.ch + 1]));
        if (Math.abs(dy) > 2.4) rgW *= smooth(3.1, 2.4, Math.abs(dy));
        dy = clamp(dy, -1.35, 1.35);
        const dp = clamp(-pit - (A[OFF.hr] + A[OFF.sp] + A[OFF.ch] + A[OFF.rp]), -0.75, 0.7);
        st.regardY += (dy - st.regardY) * kk(6); st.regardP += (dp - st.regardP) * kk(6);
        const exc = st.regardY - clamp(st.regardY, -0.95, 0.95);
        A[OFF.ch + 1] += exc * 0.8 * rgW;
        const ry2 = clamp(st.regardY, -0.95, 0.95);
        A[OFF.nk + 1] = lerp(A[OFF.nk + 1], ry2 * 0.42, rgW); A[OFF.hd + 1] = lerp(A[OFF.hd + 1], ry2 * 0.58, rgW);
        A[OFF.nk] = lerp(A[OFF.nk], st.regardP * 0.4, rgW); A[OFF.hd] = lerp(A[OFF.hd], st.regardP * 0.6, rgW);
      }

      // ---- racine (rotation de tout le corps autour du bassin), bassin, colonne, tête
      let rpT = A[OFF.rp];
      if (action === 'pique' && E.vitesse) {
        const vh = Math.hypot(E.vitesse.x || 0, E.vitesse.z || 0), vy = E.vitesse.y || 0;
        if (vh + Math.abs(vy) > 1) rpT += clamp(Math.atan2(-vy, Math.max(0.1, vh)), -0.3, 1.1) * (st.fondu);
      }
      const sol0 = -alt / Math.max(1e-6, sCorps.y / (corps.parent ? 1 : 1)) / ECHELLE * ECHELLE;
      const solLocal = -alt / ECHELLE;
      e.set(rpT, 0, A[OFF.rr], 'XYZ'); q1.setFromEuler(e);
      B.root.quaternion.copy(q1);
      v1.set(0, 1.0, 0); v2.copy(v1).applyQuaternion(q1);
      B.root.position.set(v1.x - v2.x + A[OFF.h], v1.y - v2.y + A[OFF.h + 1] + sol * solLocal, v1.z - v2.z + A[OFF.h + 2]);
      B.hips.quaternion.setFromEuler(e.set(A[OFF.hr], A[OFF.hr + 1], A[OFF.hr + 2], 'XYZ'));
      B.spine.quaternion.setFromEuler(e.set(A[OFF.sp], A[OFF.sp + 1], A[OFF.sp + 2], 'XYZ'));
      B.chest.quaternion.setFromEuler(e.set(A[OFF.ch], A[OFF.ch + 1], A[OFF.ch + 2], 'XYZ'));
      if (M.tete && !M.tete.peauSkinnee) {
        // tête fournie rigide (cou lié à l'os de la tête) : la rotation passe surtout par l'os du cou pour que le cou
        // reste dans le col ; l'os de la tête ne garde qu'une petite part (hochements fins)
        for (let i = 0; i < 3; i++) { const h = A[OFF.hd + i]; A[OFF.nk + i] += h * 0.72; A[OFF.hd + i] = h * 0.28; }
      }
      B.neck.quaternion.setFromEuler(e.set(A[OFF.nk], A[OFF.nk + 1], A[OFF.nk + 2], 'XYZ'));
      B.head.quaternion.setFromEuler(e.set(A[OFF.hd], A[OFF.hd + 1], A[OFF.hd + 2], 'XYZ'));
      B.clavL.quaternion.setFromEuler(e.set(0, -A[OFF.cG + 1], A[OFF.cG], 'XYZ'));
      B.clavR.quaternion.setFromEuler(e.set(0, A[OFF.cD + 1], -A[OFF.cD], 'XYZ'));
      for (let j = 0; j < 2; j++) {
        const J = JAMBES[j], o = J[1], sx = J[2], OJ = OSJ[J[0]];
        OJ.thigh.quaternion.setFromEuler(e.set(A[o], A[o + 4] * sx, A[o + 1] * sx, 'XYZ'));
        OJ.shin.quaternion.setFromEuler(e.set(Math.max(0, A[o + 2]), 0, 0, 'XYZ'));
        OJ.foot.quaternion.setFromEuler(e.set(A[o + 3], 0, 0, 'XYZ'));
        OJ.toes.quaternion.setFromEuler(e.set(-0.15 * A[o + 3], 0, 0, 'XYZ'));
      }
      // mâchoire et yeux
      st.mach += (A[OFF.mach] - st.mach) * kk(18);
      const mach = M.machoireForcee != null ? M.machoireForcee : st.mach;
      B.machoire.quaternion.setFromEuler(e.set(0.4 * mach, 0, 0, 'XYZ'));
      const sac = bruit1(T * 0.9, 61) * 0.12, sac2 = bruit1(T * 0.7 + 3, 63) * 0.06;
      B.oeilG.quaternion.setFromEuler(e.set(-sac2 - (rgW > 0 ? (st.regardP - clamp(st.regardP, -0.6, 0.6)) * 0.5 : 0), sac + (rgW > 0 ? (st.regardY - clamp(st.regardY, -0.95, 0.95)) * 0.4 : 0), 0, 'XYZ'));
      B.oeilD.quaternion.copy(B.oeilG.quaternion);
      if (M.tete && M.tete.ancres) {          // tête cuite : ses globes tournent comme les os des yeux
        if (M.tete.ancres.oeilG) M.tete.ancres.oeilG.quaternion.copy(B.oeilG.quaternion);
        if (M.tete.ancres.oeilD) M.tete.ancres.oeilD.quaternion.copy(B.oeilD.quaternion);
      }
      // v2.2 : l'IK des bras ne lit que la chaîne racine → bassin → colonne → poitrine → clavicules → épaules ; chaque
      // bras met ensuite son sous-arbre à jour (setQM). Le reste de l'arbre est recalculé avant les tissus.
      B.armL.updateWorldMatrix(true, false); B.clavR.updateWorldMatrix(false, false); B.armR.updateWorldMatrix(false, false);

      // ---- bras : cibles du buste, visée, mains posées au sol ; IK, poignets, doigts
      qM(B.chest, q2);
      m1.copy(mInv).multiply(B.chest.matrixWorld);
      const visee = E.visee, P_ = PISTE, double = action.indexOf('double') === 0;
      let aVisee = false;
      if (visee) { v3.set(visee.x, visee.y, visee.z).applyMatrix4(mInv); set3(P_.vP, v3.x, v3.y, v3.z); aVisee = true; }
      for (let si = 0; si < 2; si++) {
        const SD = SIDES[si], S = SD[0], C = COTE[S], oM = SD[2], oP = SD[3], oPa = SD[4], oV = SD[5], oMs = SD[6], oF = SD[7], oD = SD[8];
        v1.set(A[oM], A[oM + 1], A[oM + 2]).applyMatrix4(m1);
        const cible = set3(P_.m, v1.x, v1.y, v1.z);
        const pole = rotV3(P_.pole, set3(P_.tmp, A[oP], A[oP + 1], A[oP + 2]), q2);
        const pd = rotV3(P_.pd, set3(P_.tmp, A[oPa], A[oPa + 1], A[oPa + 2]), q2);
        const wv = A[oV];
        if (wv > 0.001 && aVisee) {
          pM(C.os.arm, v2);
          const sh = set3(P_.sh, v2.x, v2.y, v2.z);
          const tgt = set3(P_.tgt, P_.vP[0], P_.vP[1], P_.vP[2]);
          if (double) {   // deux mains, deux cibles écartées
            nrm3(P_.d2, set3(P_.d2, P_.vP[0] - sh[0], 0, P_.vP[2] - sh[2]));
            madd3(tgt, tgt, set3(P_.side, P_.d2[2], 0, -P_.d2[0]), C.sx * 1.4);
          }
          const dir = nrm3(P_.dir, sub3(P_.dir, tgt, sh));
          // jamais de bras tendu vers l'avant au-dessus de l'horizontale : inclinaison minimale sous l'horizontale
          const minE = Math.sin(MIN_VISEE[action] != null ? MIN_VISEE[action] : 0.3);
          if (dir[1] > -minE) { const hz = Math.hypot(dir[0], dir[2]) || 1; const k = Math.sqrt(1 - minE * minE) / hz; set3(dir, dir[0] * k, -minE, dir[2] * k); }
          // lacet borné : le bras ne passe pas derrière le dos ni loin en travers du corps
          const yawB = A[OFF.hr + 1] + A[OFF.sp + 1] + A[OFF.ch + 1];
          let yw = wrapPi(Math.atan2(dir[0], dir[2]) - yawB);
          yw = C.sx > 0 ? clamp(yw, -0.55, 1.5) : clamp(yw, -1.5, 0.55);
          const hz = Math.hypot(dir[0], dir[2]);
          set3(dir, Math.sin(yw + yawB) * hz, dir[1], Math.cos(yw + yawB) * hz);
          const reach = (L_UPPER + L_FORE) * A[OFF.ext] * 0.97;
          lerp3(cible, cible, madd3(P_.aim, sh, dir, reach), wv);
          const upv = nrm3(P_.upv, set3(P_.upv, -dir[0] * dir[1], 1 - dir[1] * dir[1], -dir[2] * dir[1]));
          const sd = crs3(P_.sd, upv, dir);
          const pAim = set3(P_.pAim, sd[0] * A[oPa] + upv[0] * A[oPa + 1] + dir[0] * A[oPa + 2], sd[1] * A[oPa] + upv[1] * A[oPa + 1] + dir[1] * A[oPa + 2], sd[2] * A[oPa] + upv[2] * A[oPa + 1] + dir[2] * A[oPa + 2]);
          lerp3(pd, pd, pAim, wv);
          lerp3(pole, pole, set3(P_.tmp, C.sx * 0.7, -0.7, -0.2), wv * 0.6);
        }
        if (A[oMs + 2] > 0.001) {
          const wg = clamp(A[oMs + 2], 0, 1);
          lerp3(cible, cible, set3(P_.tmp, A[oMs], solLocal + 0.05, A[oMs + 1]), wg);
          lerp3(pd, pd, set3(P_.tmp, 0, -1, 0.1), wg);
        }
        resoudreBras(S, cible, pole);
        orienterMain(S, nrm3(pd, pd), A[oF], A[oF + 1]);
        const idle = (action === 'flotte' || action === 'meditation' || action === 'rage' || action === 'faible') ? 1 : 0.25;
        appliquerDoigts(S, oD, tenir, trA, idle * (1 - tenir));
      }

      // ---- tête : mâchoire, lueur, clignement (module de tête ou tête provisoire)
      const lu = A[OFF.lu] * (0.7 + 0.6 * st.puis);
      st.lueur += (lu - st.lueur) * kk(10);
      const lueur = M.lueurForcee != null ? M.lueurForcee : st.lueur;
      const cyc = (T % 5.3) / 5.3, blink = smooth(0.0, 0.03, cyc) * (1 - smooth(0.03, 0.07, cyc));
      const cl = Math.max(A[OFF.cl], blink * 0.9);
      if (M.tete) {
        if (M.tete.setMachoire) M.tete.setMachoire(mach);
        if (M.tete.setLueur) M.tete.setLueur(clamp(lueur / 2.6, 0, 1));
        if (M.tete.setCligne) M.tete.setCligne(cl);
      }
      if (M.MAT.yeux) M.MAT.yeux.emissiveIntensity = 2.2 * lueur * (1 - 0.85 * A[OFF.cl]);
      U.uVeine.value = clamp(0.15 * st.puis + 0.25 * st.rage + 0.3 * Math.max(0, lueur - 1.2), 0, 1.2);
      U.uPuis.value = clamp(st.puis * 0.9 + 0.35 * Math.max(0, A[OFF.au] - 1) + 0.3 * st.rage, 0, 1.6) * (1 - 0.7 * fa);

      // ---- dissolution (apparition, disparitions, téléportations), tourbillon
      const fd = DISSOL_ACTIONS[action];
      let dis = fd ? fd(u) : 0;
      if (st.fondu < 1 && !fd) dis *= 0;
      st.dissol = dis;
      U.uDissol.value = dis;
      if (M.tete && M.tete.objet) M.tete.objet.visible = dis < 0.55;   // yeux, dents : disparaissent avec la peau
      const sang = PHASE5[action] || lames.etat !== 'aucune';
      // lames présentes (phase 5) : brume à la teinte des lames de CETTE instance (rouge : sang ; bleu : glace ; vert : spectre)
      if (sang) { if (M.teinte) U.uDissolCoul.value.copy(M.teinte.dissol); else U.uDissolCoul.value.setRGB(0.9, 0.02, 0.01); }
      else U.uDissolCoul.value.setRGB(1.0, 0.32, 0.06);
      let sxz = 1, sy = 1, spin = 0;
      if (action === 'teleport-sortie') { const k = smooth(0.25, 1.0, u); sxz = 1 - 0.75 * k; sy = 1 + 0.35 * k; spin = 7 * k * k; }
      else if (action === 'teleport-entree') { const k = 1 - smooth(0.0, 0.6, u); sxz = 1 - 0.75 * k; sy = 1 + 0.35 * k; spin = -5 * k * k; }
      corps.scale.set(ECHELLE * sxz, ECHELLE * sy, ECHELLE * sxz);
      if (spin) { B.root.quaternion.premultiply(q1.setFromAxisAngle(v1.set(0, 1, 0), spin)); }

      // ---- manteau, ailes, lames, voile, aura
      objet.updateMatrixWorld(true);
      majRepere();
      const solMonde = M.solCourant != null && Number.isFinite(M.solCourant) ? M.solCourant : objet.position.y - alt;
      if (leger) tissusLegers(dt, lev * (action === 'cadavre' ? 0 : 1), sol, solMonde);
      else {
        physiqueManteau(dt, lev * (action === 'cadavre' ? 0 : 1), sol, solMonde);
        physiqueEtole(dt, lev * (action === 'cadavre' ? 0 : 1), sol, solMonde);
      }
      majManches(dt);
      U.uFlotAmp.value = 0.008 + 0.01 * lev;
      const ctx = CTX;
      ctx.E = E; ctx.action = action; ctx.u = u; ctx.t = tA; ctx.temps = T; ctx.dt = dt; ctx.lev = lev; ctx.sol = sol; ctx.solMonde = solMonde;
      ctx.puis = st.puis; ctx.rage = st.rage; ctx.faib = fa; ctx.bouclier = st.bouclier; ctx.dissol = dis; ctx.sang = !!sang;
      if (M.ailes) M.ailes.maj(ailes, ctx);
      if (M.lames) M.lames.maj(lames, ctx);
      if (M.voile) M.voile.maj(ctx);
      if (M.aura) M.aura.maj(ctx);
      // allégé : les matrices monde finales sont celles que le rendu recalcule (scene.matrixWorldAutoUpdate, par défaut) ;
      // les points (getWorldPosition) et hitboxes() se mettent à jour d'eux-mêmes
      if (!leger) objet.updateMatrixWorld(true);
      return st;
    }
    function reinitialiser() {
      st.temps = 0; st.action = null; st.tPrec = -1; st.fondu = 1; st.init = false; st.toucheN = null;
      st.ressort = [0, 0, 0]; st.ressortV = [0, 0, 0]; st.regardY = 0; st.regardP = 0; st.vitF = 0; st.vitL = 0;
      st.panInit = false; st.etoInit = false; st.aPos = false; st.mach = 0; st.lueur = 1; st.pulse = 0;
      if (iMorph && mManteau.morphTargetInfluences) for (let i = 0; i < mManteau.morphTargetInfluences.length; i++) mManteau.morphTargetInfluences[i] = 0;
      P.set(BASE_T); Pfrom.set(BASE_T);
      if (M.lames && M.lames.reinitialiser) M.lames.reinitialiser();
      if (M.ailes && M.ailes.reinitialiser) M.ailes.reinitialiser();
      if (M.aura && M.aura.reinitialiser) M.aura.reinitialiser();
      if (M.voile && M.voile.reinitialiser) M.voile.reinitialiser();
    }
    // sursaut à l'impact : (dx, dy, dz) = direction de la balle dans le monde (du tireur vers le boss)
    function sursaut(dx, dy, dz, force) {
      majRepere();
      v1.set(dx, dy, dz).applyQuaternion(q1.copy(qCorps).invert());
      if (v1.lengthSq() < 1e-6) v1.set(0, 0, -1);
      v1.normalize();
      const f = clamp(force, 0, 1.5) * (1 - 0.6 * st.solPose);
      st.ressortV[0] += v1.z * 5.4 * f; st.ressortV[1] += -v1.x * 5.0 * f; st.ressortV[2] += (hash3(st.nSursaut++, 3, 1, 5) - 0.5) * 3.4 * f;
      if (M.voile && st.bouclier > 0.12) M.voile.impactDirection(v1, f, st.nSursaut);
    }
    return { appliquer: appliquer, reinitialiser: reinitialiser, sursaut: sursaut, etat: st, pose: P, tissus: { pans: PAN, etole: ETO } };
  }
