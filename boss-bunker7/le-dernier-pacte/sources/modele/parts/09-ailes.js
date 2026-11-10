  // ============================================================================================
  // Ailes de la phase 2 (création originale) : charpente d'os noueux (racine, humérus, avant-bras,
  // poignet hérissé, pouce-griffe, quatre longs doigts osseux à deux phalanges terminées en griffes)
  // et membranes déchirées d'énergie rouge-noir (shader : trous de bruit, veines émissives, bords
  // incandescents, apparition depuis les os, dissolution en braises). Envergure ≈ 5,4 m.
  // États : apparition (les os percent le dos et se déplient), déployées (battements, frémissement),
  // repliées en flèche pendant le piqué (paramètres de pose « ail »), disparition (cendres et braises).
  // ============================================================================================
  // angles des articulations (radians) : [plan de l'aile (+ = vers le haut), balayage (+ = vers l'arrière)]
  const AILE_FERMEE = { hum: [0.78, 0.28], avb: [-1.8, 0.05], d: [[1.85, 0], [2.38, 0], [2.95, 0], [3.5, 0]], pou: [1.2, 0] };
  const AILE_FLECHE = { hum: [-0.2, 1.0], avb: [-0.75, 0.25], d: [[-0.3, 0.05], [0.05, 0.08], [0.38, 0.1], [0.66, 0.12]], pou: [0.4, 0] };

  function creerAiles(THREE, C) {
    const B = C.B, I = C.I, q = C.q;
    const bd = new Builder(THREE, q);
    const A = AILE;
    const osCol = (P, k) => {
      let c = mixc(PAL.os, PAL.osClair, fbm(P[0] * 30, P[1] * 30, P[2] * 30, 601) * 0.5);
      c = mixc(c, hexc(0x0d0a09), smooth(0.55, 0.75, fbm(P[0] * 60, P[1] * 60, P[2] * 60, 603)) * 0.6);
      return mixc(c, PAL.sangSec, (k || 0) * 0.5);
    };
    const fissOs = (P) => { const v = Math.abs(fbm(P[0] * 40, P[1] * 40, P[2] * 40, 605) - 0.5); return 1 - smooth(0.0, 0.035, v); };
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const mir = sx < 0;
      // segment osseux : nœuds aux articulations, bosses, griffe au bout si r1 = 0
      const os = (p0, p1, r0, r1, wFn, knot0, knot1, seg) => {
        const L = vlen(vsub(p1, p0));
        const rings = [
          { s: -r0 * 0.6, w: r0 * 0.6 }, { s: 0, w: r0 * (knot0 || 1.25) }, { s: L * 0.12, w: r0 * 0.95 }, { s: L * 0.5, w: lerp(r0, Math.max(r1, r0 * 0.25), 0.5) * 0.78 },
          { s: L * 0.85, w: Math.max(r1, r0 * 0.2) * (r1 > 0 ? 0.95 : 0.8) }, { s: L, w: r1 > 0 ? r1 * (knot1 || 1.2) : r0 * 0.05 }
        ];
        if (r1 > 0) rings.push({ s: L + r1 * 0.6, w: r1 * 0.55 });
        bd.loft('aileOs', {
          a: p0, b: p1, front: [0, 0, 1], mirror: mir, seg: Math.max(5, (seg || 8) - 1), step: Math.max(0.035, L / 7), s0: rings[0].s, s1: rings[rings.length - 1].s, cap0: true, cap1: true, rings: rings,
          displace: (P, s, ang, r, radial) => radialD(radial, (fbm(P[0] * 25, P[1] * 25, P[2] * 25, 607) - 0.5) * r0 * 0.5 + r0 * 0.25 * Math.max(0, Math.sin(s * 37 + ang * 2) - 0.6)),
          weights: (s, ang, P) => wFn(s / L),
          color: (P) => osCol(P), extra: (P) => [0, 0, fissOs(mir ? miroir(P) : P)]
        });
      };
      const W1 = (n) => () => [[I[n + S], 1]];
      const W2 = (n0, n1, t0) => (t) => { const k = smooth(t0 - 0.06, t0 + 0.06, t); return [[I[n0 + S], 1 - k], [I[n1 + S], k]]; };
      os(A.R0, A.S1, 0.042, 0.038, W1('aileRac'), 1.0, 1.3, 8);
      os(A.S1, A.E, 0.04, 0.031, W2('aileRac', 'aileHum', 0.02), 1.35, 1.45, 9);
      os(A.E, A.Wr, 0.031, 0.022, W2('aileHum', 'aileAvb', 0.02), 1.3, 1.6, 8);
      // éperon osseux au coude, griffe du pouce
      os(A.E, vadd(A.E, vscale(vnorm(vsub(A.E, A.Wr)), 0.16)).map((v, i) => v + (i === 1 ? 0.05 : 0)), 0.024, 0, W1('aileAvb'), 1.2, 0, 6);
      os(A.Wr, A.pouce.tip, 0.02, 0, W1('ailePou'), 1.4, 0, 6);
      A.doigts.forEach((d, i) => {
        const n = 'aileD' + (i + 1);
        os(A.Wr, d.mid, 0.02 - i * 0.0015, 0.0145 - i * 0.001, W2('aileMain', n + 'a', 0.04), 1.5, 1.35, 7);
        os(d.mid, d.tip, 0.0145 - i * 0.001, 0, W1(n + 'b'), 1.3, 0, 6);
      });
      // membranes : secteurs entre rayons partant du poignet (bord d'attaque, doigts), puis plagiopatagium
      const rayon = (pts) => {
        const L = [0];
        for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + vlen(vsub(pts[i], pts[i - 1])));
        const T = L[L.length - 1];
        return { pts: pts, L: L, T: T, at: (s) => { const d = clamp(s, 0, 1) * T; let i = 1; while (i < pts.length - 1 && L[i] < d) i++; const t = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return vlerp(pts[i - 1], pts[i], clamp(t, 0, 1)); } };
      };
      const rays = [rayon([A.Wr, A.E, A.S1])].concat(A.doigts.map((d) => rayon([A.Wr, d.mid, d.tip])));
      const wRay = (k, s) => {
        if (k === 0) { const j = rays[0].L[1] / rays[0].T; const t = smooth(j - 0.05, j + 0.05, s); return [[I['aileAvb' + S], 1 - t], [I['aileHum' + S], t]]; }
        const j = rays[k].L[1] / rays[k].T, n = 'aileD' + k;
        const a = smooth(0.0, 0.12, s), b = smooth(j - 0.05, j + 0.05, s);
        return [[I['aileMain' + S], 1 - a], [I[n + 'a' + S], a * (1 - b)], [I[n + 'b' + S], a * b]];
      };
      const memCol = (P) => mixc(PAL.membrane, hexc(0x2a0806), fbm(P[0] * 9, P[1] * 9, P[2] * 9, 611) * 0.8);
      const secteur = (k0, k1, creux, ns, nt) => {
        const pos = [], ix = [], wts = [], ex = [];
        for (let j = 0; j <= nt; j++) {
          const t = j / nt, smax = 1 - creux * Math.sin(Math.PI * t);
          for (let i = 0; i <= ns; i++) {
            const s = i / ns * smax;
            const p = vlerp(rays[k0].at(s), rays[k1].at(s), t);
            const bow = 0.02 * Math.sin(Math.PI * t) * smooth(0, 0.3, s);   // légère poche de la membrane
            const pp = vadd(p, vscale(A.n, -bow));
            pos.push(pp);
            const w = wRay(k0, s).map(([b, x]) => [b, x * (1 - t)]).concat(wRay(k1, s).map(([b, x]) => [b, x * t]));
            wts.push(w);
            ex.push([clamp(Math.min(t, 1 - t) * 2.2, 0, 1) * smooth(0.0, 0.15, s), clamp((smax - s) / 0.14, 0, 1), 0]);
          }
        }
        for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) { const a = j * (ns + 1) + i, b = a + 1, c = a + ns + 2, d = a + ns + 1; ix.push(a, b, c, a, c, d); }
        poserMembrane(pos, ix, wts, ex);
      };
      const poserMembrane = (pos, ix, wts, ex) => {
        const g = new THREE.BufferGeometry();
        const arr = [];
        for (const p of pos) { const pp = mir ? miroir(p) : p; arr.push(pp[0], pp[1], pp[2]); }
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        if (mir) for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
        g.setIndex(ix); g.computeVertexNormals();
        let vi = 0;
        bd.cur = () => ex[vi] || [0, 0, 0];
        bd.rigid('membrane', g, new THREE.Matrix4(), () => wts[vi++] || [[I['aileMain' + S], 1]], (P) => memCol(P));
        bd.cur = [0, 0, 0];
      };
      const ns = bd.n(12, 6), nt = bd.n(7, 4);
      secteur(0, 1, 0.42, ns, nt);
      secteur(1, 2, 0.24, ns, nt);
      secteur(2, 3, 0.26, ns, nt);
      secteur(3, 4, 0.28, ns, nt);
      // plagiopatagium : carreau de Coons entre le doigt 4, le bras, le dos et le bord de fuite
      {
        const top = rayon([A.Wr, A.E, A.S1, A.R0]), left = rays[4], right = rayon([A.R0].concat(A.corps));
        const P00 = A.Wr, P10 = A.R0, P01 = A.doigts[3].tip, P11 = A.corps[A.corps.length - 1];
        const bot = (a) => { const p = vlerp(P01, P11, a); return vadd(p, vscale(vnorm(vsub(A.Wr, p)), 0.3 * Math.sin(Math.PI * a))); };
        const na = bd.n(11, 6), nb = bd.n(8, 4);
        const pos = [], ix = [], wts = [], ex = [];
        for (let j = 0; j <= nb; j++) {
          const b = j / nb;
          for (let i = 0; i <= na; i++) {
            const a = i / na;
            const ct = top.at(a), cb = bot(a), cl = left.at(b), cr = right.at(b);
            const p = [0, 1, 2].map((k) => (1 - b) * ct[k] + b * cb[k] + (1 - a) * cl[k] + a * cr[k] - ((1 - a) * (1 - b) * P00[k] + a * (1 - b) * P10[k] + (1 - a) * b * P01[k] + a * b * P11[k]));
            pos.push(p);
            const wb = smooth(1.36, 1.1, p[1]);
            const wBody = [[I.chest, 1 - wb], [I.spine, wb]];
            const wTop = a < 0.55 ? [[I['aileAvb' + S], 1]] : [[I['aileHum' + S], smooth(0.95, 0.55, a)], [I['aileRac' + S], smooth(0.55, 0.95, a)]];
            const kT = Math.pow(1 - b, 3), kL = (1 - a) * (1 - kT), kR = a * (1 - kT);
            wts.push(wRay(4, b).map(([bb, x]) => [bb, x * kL]).concat(wBody.map(([bb, x]) => [bb, x * kR])).concat(wTop.map(([bb, x]) => [bb, x * kT])));
            ex.push([clamp(Math.min(a, 1 - a) * 2 * Math.min(1, b * 3), 0, 1), clamp((1 - b) / 0.18, 0, 1), 0]);
          }
        }
        for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) { const a = j * (na + 1) + i, b = a + 1, c = a + na + 2, d = a + na + 1; ix.push(a, c, b, a, d, c); }
        poserMembrane(pos, ix, wts, ex);
      }
    }
    // matériaux : os (fissures de braise), membrane (shader dédié)
    const rev = parseInt(THREE.REVISION, 10);
    const UA = {
      uTemps: C.U.uTemps, uDissol: { value: 0 }, uDissolCoul: { value: new THREE.Color(1.0, 0.3, 0.05) }, uPuis: { value: 0 }, uSceauCoul: C.U.uSceauCoul,
      uVeine: { value: 0.4 }, uVeineCoul: { value: new THREE.Color(1.6, 0.12, 0.03) }, uDoublure: C.U.uDoublure, uFlotAmp: { value: 0.02 }, uForm: { value: 1 }, uFlash: C.U.uFlash
    };
    const matOs = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.72, metalness: 0.05 });
    const matMem = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    matMem.envMapIntensity = 0.25;
    if (rev < 129) { matOs.skinning = true; matMem.skinning = true; }
    patchBoss(THREE, matOs, { LUEUR: true }, UA, 'aileOs');
    patchBoss(THREE, matMem, { FLOT: true, MEMBRANE: true }, UA, 'membrane');
    const MAT = { aileOs: matOs, membrane: matMem };
    const meshes = bd.build(MAT, C.linear);
    let tris = 0;
    for (const k in meshes) {
      const m = meshes[k];
      m.castShadow = !!C.opts.ombres; m.receiveShadow = false;
      m.customDepthMaterial = depthBoss(THREE, { FLOT: k === 'membrane' }, UA, 'aile-' + k);
      m.visible = false;
      C.corps.add(m);
      m.bind(C.skeleton, m.matrixWorld.clone().identity().copy(C.corps.matrixWorld));
      tris += m.geometry.index.count / 3;
    }
    // ---- animation des articulations (axes de la pose de référence ; même convention que le squelette)
    const axes = {};
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      const u = sx > 0 ? A.u : miroir(A.u);
      const n = vnorm(vcross(u, A.v));
      axes[S] = { n: new THREE.Vector3(n[0], n[1], n[2]), y: new THREE.Vector3(0, 1, 0), sx: sx };
    }
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const poser = (bone, S, plan, bal) => {
      const X = axes[S];
      qa.setFromAxisAngle(X.y, bal * X.sx); qb.setFromAxisAngle(X.n, plan); qa.multiply(qb);
      bone.quaternion.copy(qa);
    };
    const st = { phase: 0, vis: false };
    // os des ailes par côté (évite de composer les noms à chaque image) et pose repliée courante
    const OS_AILE = {};
    for (const S of ['L', 'R']) {
      OS_AILE[S] = { rac: B['aileRac' + S], hum: B['aileHum' + S], avb: B['aileAvb' + S], main: B['aileMain' + S], pou: B['ailePou' + S],
        da: [1, 2, 3, 4].map((i) => B['aileD' + i + 'a' + S]), db: [1, 2, 3, 4].map((i) => B['aileD' + i + 'b' + S]) };
    }
    const RP = [0, 0];
    const replier = (C0, F0, ouv, fl) => { RP[0] = lerp(lerp(C0[0], 0, ouv), F0[0], fl); RP[1] = lerp(lerp(C0[1], 0, ouv), F0[1], fl); };
    function maj(ailes, ctx) {
      const etat = ailes && ailes.etat ? ailes.etat : 'aucune', t = clamp(ailes && ailes.t != null ? ailes.t : 1, 0, 1);
      const vis = etat !== 'aucune' && ctx.dissol < 0.999;
      if (vis !== st.vis) { for (const k in meshes) meshes[k].visible = vis; st.vis = vis; }
      if (!vis) { B.aileRacL.scale.setScalar(0.001); B.aileRacR.scale.setScalar(0.001); return; }
      const a = ctx.A, o0 = ctx.OFF.ail;
      let ouv = a[o0], amp = a[o0 + 1], fr = a[o0 + 2], fl = a[o0 + 3], rel = a[o0 + 4];
      let g = 1, form = 1, dis = 0, glow = 0.35 + 0.6 * ctx.puis;
      if (etat === 'apparition') {
        g = smooth(0.0, 0.42, t);
        const k = clamp((t - 0.42) / 0.38, 0, 1);
        ouv = k <= 0 ? 0 : Math.min(ouv, ease.b(k));
        form = smooth(0.32, 0.92, t);
        amp *= smooth(0.8, 1.0, t);
        glow += 1.6 * gauss(t, 0.82, 0.08) + 0.6 * (1 - t);
      } else if (etat === 'disparition') {
        dis = smooth(0.0, 0.95, t);
        ouv *= 1 - 0.35 * t; rel -= 0.35 * t; amp *= 1 - t;
        glow += 0.8 * t;
      }
      dis = Math.max(dis, ctx.dissol);
      UA.uDissol.value = dis; UA.uForm.value = form; UA.uVeine.value = glow;
      UA.uDissolCoul.value.copy(C.U.uDissolCoul.value);
      UA.uFlotAmp.value = 0.012 + 0.02 * (1 - fl);
      st.phase += TAU * fr * ctx.dt;
      const T = ctx.temps;
      for (let si = 0; si < 2; si++) {
        const S = si === 0 ? 'L' : 'R', OS = OS_AILE[S];
        const ph = st.phase + (si === 1 ? 0.05 : 0), jo = si === 1 ? 9 : 0;
        const fH = amp * Math.sin(ph), fA = amp * Math.sin(ph - 0.7), fD = amp * Math.sin(ph - 1.3);
        OS.rac.scale.setScalar(Math.max(0.001, g));
        OS.rac.quaternion.setFromAxisAngle(axes[S].n, rel * 0.4);
        // repliement : pose ouverte → fermée (ouv) puis → flèche du piqué (fl), sans allocation
        replier(AILE_FERMEE.hum, AILE_FLECHE.hum, ouv, fl);
        poser(OS.hum, S, RP[0] + fH + rel, RP[1] - fH * 0.35);
        replier(AILE_FERMEE.avb, AILE_FLECHE.avb, ouv, fl);
        poser(OS.avb, S, RP[0] + fA * 0.4 + bruit1(T * 5 + 1.7 + jo, 621) * 0.025, RP[1]);
        OS.main.quaternion.identity();
        for (let i = 0; i < 4; i++) {
          replier(AILE_FERMEE.d[i], AILE_FLECHE.d[i], ouv, fl);
          poser(OS.da[i], S, RP[0] + fD * 0.3 + bruit1(T * 5 + (2 + i) * 1.7 + jo, 621) * 0.025, RP[1]);
          OS.db[i].quaternion.setFromAxisAngle(axes[S].n, -fD * 0.15 * (1 - fl) + bruit1(T * 5 + (6 + i) * 1.7 + jo, 621) * 0.025 - 0.12 * (1 - ouv));
        }
        replier(AILE_FERMEE.pou, AILE_FLECHE.pou, ouv, fl);
        poser(OS.pou, S, RP[0], RP[1]);
      }
    }
    return {
      maj: maj, meshes: meshes, materiaux: MAT, uniformes: UA, triangles: Math.round(tris), reinitialiser: () => { st.phase = 0; },
      dispose: () => { for (const k in meshes) { meshes[k].geometry.dispose(); if (meshes[k].customDepthMaterial) meshes[k].customDepthMaterial.dispose(); } matOs.dispose(); matMem.dispose(); }
    };
  }
