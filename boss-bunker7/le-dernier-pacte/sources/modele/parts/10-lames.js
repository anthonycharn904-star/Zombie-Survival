  // ============================================================================================
  // Lames du Pacte (phase 5) — création originale : une SEULE lame très courbe et asymétrique, tenue par une
  // extrémité (aucune lame de l'autre côté de la poignée, pas de double croissant), en sang coagulé translucide ;
  // tranchant extérieur fin comme du verre, bord intérieur hérissé d'éclats d'os en forme de dents ; garde
  // d'éclats d'os liés par des tendons, avec un cœur noirâtre qui bat ; poignée de vertèbres soudées gainée de
  // tendons, éperon d'os et bague de fer au pommeau ; veines qui battent (émissif), fumée rouge, gouttes de sang
  // qui tombent et s'écrasent au sol, traînée lumineuse pendant les coups ; frémissement propre à chaque lame.
  // États : formation (le sang coule des mains puis se fige depuis la poignée, première torsion),
  // actives, destruction (fissures incandescentes puis effritement en sang).
  // Repère d'une lame : origine au centre de la poignée, +Y = côté du pouce (grand arc), +Z = tranchant
  // (direction de l'avant-bras quand la main est ouverte), X = épaisseur.
  // ============================================================================================
  const LAME_ARC = { cz: -0.52, cy: 0.44, r: 0.62, a0: -28 * Math.PI / 180, a1: 70 * Math.PI / 180 };
  const LAME_CROC = { cz: 0.17, cy: -0.12, r: 0.19, a0: Math.PI, a1: Math.PI + 125 * Math.PI / 180 };
  // bord extérieur, bord intérieur et épaisseur d'une partie de la lame, s ∈ [0, 1] depuis la poignée
  function profilLame(P, s, largeurMax, base, epais) {
    const a = lerp(P.a0, P.a1, s), oz = P.cz + P.r * Math.cos(a), oy = P.cy + P.r * Math.sin(a);
    const w = largeurMax * Math.pow(Math.max(0, Math.sin(Math.PI * (base + (1 - base) * s))), 0.8);
    const k = w / P.r;
    return { o: [oz, oy], n: [oz + (P.cz - oz) * k, oy + (P.cy - oy) * k], w: w, t: lerp(epais, 0.0035, Math.pow(s, 0.8)), a: a };
  }
  function pointLameBrut(part, s, w, side) {
    const P = part === 0 ? LAME_ARC : LAME_CROC;
    const pr = part === 0 ? profilLame(P, s, 0.155, 0.12, 0.017) : profilLame(P, s, 0.075, 0.18, 0.013);
    const z = lerp(pr.o[0], pr.n[0], w), y = lerp(pr.o[1], pr.n[1], w);
    const t = pr.t * Math.pow(w, 0.55) * (1 + 0.15 * Math.sin(s * 40 + w * 6) * w);
    return [side * t * 0.5, y, z];
  }
  // le grand arc sort de la bague en s'inclinant de 70° vers le tranchant (axe de l'avant-bras) : la lame prolonge
  // le bras (traîne derrière en traque, se croise au-dessus de la tête) tandis que la poignée reste dans le poing
  const LAME_INCL = 70 * Math.PI / 180, LAME_PIVOT = 0.128;
  const inclinerArc = (p) => { const dy = p[1] - LAME_PIVOT, dz = p[2], c = Math.cos(LAME_INCL), sn = Math.sin(LAME_INCL); return [p[0], LAME_PIVOT - dz * sn + dy * c, dz * c + dy * sn]; };
  const inclinerDir = (d) => { const c = Math.cos(LAME_INCL), sn = Math.sin(LAME_INCL); return [d[0], -d[2] * sn + d[1] * c, d[2] * c + d[1] * sn]; };
  function pointLame(part, s, w, side) {
    const p = pointLameBrut(part, s, w, side);
    return part === 0 ? inclinerArc(p) : p;
  }

  // ---------------------------------------------------------------- palettes (v2.2, API.md §16.6)
  // rouge = couleurs d'origine (verre de sang coagulé) ; bleu = « bleu très clair » (choix d'Anthony, palier 0) : verre
  // glacé translucide, veines et lueur cyan pâle presque blanches, cœur bleu clair ; vert = vert spectral (illusions).
  // verre / coeur / tendon : couleurs de sommets (hex sRGB) ; bord : renfort du tranchant par canal ; coeurVeine : veines
  // du cœur (ajout) ; veine : émission des veines, du front de formation et des fissures (uVeineCoul, linéaire HDR) ;
  // reg : [lueur de base, reflet de bord, force des veines] (uLameReg) ; dissol : dissolution du corps quand les lames
  // sont là (apparitions, téléportations : brume de sang à l'origine) ; aura : halo de l'aura dans ces mêmes moments ;
  // trainee, fumee, goutte, eclab, reflet : particules (linéaire, comme à l'origine) ; opacite, rugosite, env : verre.
  // Les os de la poignée et les dents d'os ne changent pas ; les tendons de la poignée suivent la teinte.
  const PALETTES_LAMES = {
    rouge: { verre: [0x3a0606, 0x240303], bord: [1, 0, 0], coeur: [0x2e0a08, 0x1a0504], coeurVeine: [0.12, 0, 0], coeurEmis: 0xff2410,
      tendon: [0x5a1812, 0x3e100c, 0x2a0a08], veine: [1.5, 0.05, 0.02], reg: [0, 0.1, 1], dissolLame: [1.2, 0.03, 0.01], dissol: [0.9, 0.02, 0.01],
      aura: [0.8, 0.03, 0.02], trainee: [1.0, 0.12, 0.05], fumee: [0.22, 0.015, 0.01], goutte: [0.16, 0.004, 0.004], eclab: [0.11, 0.003, 0.003],
      reflet: [0.12, 0.02, 0.02], opacite: 0.93, rugosite: 0.14, env: 0.8 },
    bleu: { verre: [0x4f8fbf, 0x2f6a9c], bord: [0.3, 0.55, 0.85], coeur: [0x3a6488, 0x24425e], coeurVeine: [0.1, 0.16, 0.2], coeurEmis: 0xa8e2ff,
      tendon: [0x5d7f98, 0x45627a, 0x2e4558], veine: [0.78, 1.12, 1.4], reg: [0.035, 0.24, 1.0], dissolLame: [0.6, 0.9, 1.15], dissol: [0.55, 0.85, 1.1],
      aura: [0.3, 0.52, 0.75], trainee: [0.36, 0.56, 0.72], fumee: [0.06, 0.1, 0.14], goutte: [0.42, 0.62, 0.8], eclab: [0.28, 0.42, 0.56],
      reflet: [0.3, 0.38, 0.42], opacite: 0.8, rugosite: 0.08, env: 1.05 },
    vert: { verre: [0x0f3a1a, 0x08240f], bord: [0.25, 1, 0.35], coeur: [0x103a18, 0x08200c], coeurVeine: [0.03, 0.12, 0.04], coeurEmis: 0x44ff70,
      tendon: [0x24502c, 0x1a3a20, 0x102814], veine: [0.3, 1.35, 0.42], reg: [0.03, 0.18, 1], dissolLame: [0.3, 1.2, 0.4], dissol: [0.25, 1.0, 0.35],
      aura: [0.1, 0.55, 0.16], trainee: [0.26, 0.85, 0.34], fumee: [0.03, 0.15, 0.05], goutte: [0.03, 0.2, 0.06], eclab: [0.02, 0.13, 0.04],
      reflet: [0.05, 0.2, 0.08], opacite: 0.88, rugosite: 0.12, env: 0.8 }
  };
  const NOMS_PALETTES = ['rouge', 'bleu', 'vert'];
  const nomPalette = (n) => (n && PALETTES_LAMES[n] ? n : 'rouge');

  function creerLames(THREE, C) {
    const q = C.q, rev = parseInt(THREE.REVISION, 10);
    const lin = C.linear;
    const cl = (h) => { const c = hexc(h); return lin ? c.map(toLin) : c; };
    const PL = PALETTES_LAMES;
    const R = rng(1771);
    // ---------------------------------------------------------------- géométrie de la lame (+ dents d'os)
    // couleurs de sommets calculées pour chaque palette (cf : couleur fixe, ou fonction de la palette)
    const pos = [], cols = { rouge: [], bleu: [], vert: [] }, ex = [], idx = [];
    const add = (p, cf, e) => {
      pos.push(p[0], p[1], p[2]);
      for (const n of NOMS_PALETTES) { const c = typeof cf === 'function' ? cf(PL[n]) : cf; cols[n].push(c[0], c[1], c[2]); }
      ex.push(e[0], e[1], e[2]); return pos.length / 3 - 1;
    };
    const sangCol = (s, w, k) => { const v = vnoise(s * 30, w * 5, 1, 701); return (P) => cl(v > 0.6 ? P.verre[0] : P.verre[1]).map((x, i) => x * (0.8 + 0.4 * v) * (1 + 0.4 * (1 - w) * P.bord[i]) * (k || 1)); };
    const longueurs = [1.0, 0.33];
    for (let part = 0; part < 1; part++) {          // une seule lame (l'ancien crochet inférieur est supprimé)
      const ns = Math.max(8, Math.round((part === 0 ? 24 : 10) * q)), nw = Math.max(3, Math.round(4 * q));
      for (const side of [1, -1]) {
        const base = pos.length / 3;
        for (let i = 0; i <= ns; i++) for (let j = 0; j <= nw; j++) {
          const s = i / ns, w = j / nw;
          add(pointLame(part, s, w, side), sangCol(s, w), [part === 0 ? s : s * longueurs[1], w, 0]);
        }
        for (let i = 0; i < ns; i++) for (let j = 0; j < nw; j++) {
          const a = base + i * (nw + 1) + j, b = a + 1, c = a + nw + 2, d = a + nw + 1;
          if (side > 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
        }
      }
      // dos de la lame (bord intérieur épais) et base
      const b0 = pos.length / 3;
      for (let i = 0; i <= ns; i++) { const s = i / ns; for (const side of [1, -1]) add(pointLame(part, s, 1, side), sangCol(s, 1, 0.8), [part === 0 ? s : s * longueurs[1], 1, 0]); }
      for (let i = 0; i < ns; i++) { const a = b0 + i * 2, b = a + 1, c = a + 3, d = a + 2; idx.push(a, d, c, a, c, b); }
      const b1 = pos.length / 3;
      for (let j = 0; j <= nw; j++) for (const side of [1, -1]) add(pointLame(part, 0, j / nw, side), sangCol(0, j / nw), [0, j / nw, 0]);
      for (let j = 0; j < nw; j++) { const a = b1 + j * 2, b = a + 1, c = a + 3, d = a + 2; idx.push(a, c, d, a, b, c); }
      // dents d'os sur le bord intérieur, inclinées vers la pointe
      const nd = part === 0 ? Math.max(6, Math.round(11 * q)) : 4;
      for (let k = 0; k < nd; k++) {
        const s = (part === 0 ? 0.07 : 0.12) + (part === 0 ? 0.8 : 0.66) * (k + 0.3 * R()) / nd;
        const P = part === 0 ? LAME_ARC : LAME_CROC;
        const b0 = pointLameBrut(part, s, 1, 0), b1 = pointLameBrut(part, Math.min(1, s + 0.02), 1, 0);
        const tg = vnorm(vsub(b1, b0));
        const inw = vnorm([0, P.cy - b0[1], P.cz - b0[2]]);
        let dir = vnorm(vadd(vscale(inw, 0.8), vscale(tg, 0.45)));
        const p0 = part === 0 ? inclinerArc(b0) : b0;
        if (part === 0) dir = inclinerDir(dir);
        const h = (0.022 + 0.022 * R()) * (1 - 0.5 * s) * (part === 0 ? 1 : 0.8), r = 0.0075 + 0.003 * R();
        const g = new THREE.ConeGeometry(r, h, 5, 2);
        g.translate(0, h / 2, 0);
        const gp = g.attributes.position;
        for (let v = 0; v < gp.count; v++) { const yy = gp.getY(v); gp.setZ(v, gp.getZ(v) + 0.25 * (yy / h) * (yy / h) * h); }   // légère courbure
        g.computeVertexNormals();
        const M = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir[0], dir[1], dir[2])));
        M.setPosition(p0[0], p0[1], p0[2]);
        const gi = g.index.array, ga = g.attributes.position, base = pos.length / 3;
        const vv = new THREE.Vector3();
        for (let v = 0; v < ga.count; v++) {
          vv.fromBufferAttribute(ga, v).applyMatrix4(M);
          const tint = vnoise(vv.x * 300, vv.y * 300, vv.z * 300, 703);
          add([vv.x, vv.y, vv.z], cl(tint > 0.5 ? 0xb3a382 : 0x7d6b4c), [part === 0 ? s : s * longueurs[1], 1, 1]);
        }
        for (let v = 0; v < gi.length; v++) idx.push(base + gi[v]);
        g.dispose();
      }
    }
    const geoLame = new THREE.BufferGeometry();
    geoLame.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geoLame.setAttribute('color', new THREE.Float32BufferAttribute(cols.rouge, 3));
    const TAB_LAME = {};
    for (const n of NOMS_PALETTES) TAB_LAME[n] = new Float32Array(cols[n]);
    geoLame.setAttribute('aBoss', new THREE.Float32BufferAttribute(ex, 3));
    geoLame.setIndex(idx);
    geoLame.computeVertexNormals();
    geoLame.computeBoundingSphere();

    // ---------------------------------------------------------------- poignée : vertèbres, barbelé rouillé, bague de fer
    const gp = [], gcs = { rouge: [], bleu: [], vert: [] }, gi = [];
    const fusion = (g, M, colFn) => {   // colFn(P, palette) : seuls les tendons dépendent de la palette
      const p = g.attributes.position, n = g.attributes.normal, base = gp.length / 6;
      const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(M);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(M); nv.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        gp.push(v.x, v.y, v.z, nv.x, nv.y, nv.z);
        for (const nm2 of NOMS_PALETTES) { const c = colFn([v.x, v.y, v.z], PL[nm2]); gcs[nm2].push(c[0], c[1], c[2]); }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) gi.push(base + g.index.getX(i)); else for (let i = 0; i < p.count; i++) gi.push(base + i);
      g.dispose();
    };
    const osC = (P) => cl(vnoise(P[0] * 200, P[1] * 200, P[2] * 200, 707) > 0.55 ? 0xa8977a : 0x6e5d45);
    const rouille = (P) => { const v = vnoise(P[0] * 400, P[1] * 400, P[2] * 400, 709); return cl(v > 0.6 ? 0x7a4320 : v > 0.3 ? 0x4a2a16 : 0x2a1a12); };
    const nv = 5, seg = Math.max(5, Math.round(6 * q));
    for (let k = 0; k < nv; k++) {
      const y = -0.1 + k * 0.05;
      const body = new THREE.CylinderGeometry(0.0185, 0.0185, 0.034, seg, 2);
      const bp = body.attributes.position;
      for (let i = 0; i < bp.count; i++) { const yy = bp.getY(i); const s = 1 - 0.16 * (1 - Math.pow(yy / 0.017, 2)); bp.setX(i, bp.getX(i) * s); bp.setZ(i, bp.getZ(i) * s * 0.9); }
      body.computeVertexNormals();
      fusion(body, new THREE.Matrix4().makeTranslation(0, y, 0), osC);
      const disc = new THREE.CylinderGeometry(0.0155, 0.0155, 0.016, seg, 1);
      fusion(disc, new THREE.Matrix4().makeTranslation(0, y + 0.025, 0), () => cl(0x2a0c08));
      const spin = new THREE.ConeGeometry(0.0075, 0.038, 5);
      fusion(spin, new THREE.Matrix4().makeRotationX(-Math.PI / 2 - 0.35).setPosition(0, y - 0.004, -0.03), osC);
      for (const sx of [1, -1]) {
        const tr = new THREE.ConeGeometry(0.0055, 0.024, 4);
        fusion(tr, new THREE.Matrix4().makeRotationZ(-sx * Math.PI / 2 + sx * 0.25).setPosition(sx * 0.024, y, -0.004), osC);
      }
    }
    {
      // tendons qui gainent la poignée (trois brins en spirale, rouge sombre luisant)
      const tendon = (P, pal) => { const v = vnoise(P[0] * 300, P[1] * 300, P[2] * 300, 711); return cl(v > 0.55 ? pal.tendon[0] : v > 0.25 ? pal.tendon[1] : pal.tendon[2]); };
      const n = Math.max(12, Math.round(20 * q));
      for (let b = 0; b < 3; b++) {
        const pts = [];
        for (let i = 0; i <= n; i++) { const t = i / n, a = t * 2.6 * TAU + b * TAU / 3; const r = 0.0215 + 0.002 * Math.sin(t * 40 + b); pts.push(new THREE.Vector3(Math.cos(a) * r, -0.112 + 0.235 * t, Math.sin(a) * r * 0.95)); }
        fusion(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.0034, 4, false), new THREE.Matrix4(), tendon);
      }
      // garde : éclats d'os en couronne inclinés vers l'arrière, liés par des tendons
      const R2 = rng(2207);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + 0.3 * R2(), h = 0.05 + 0.04 * R2();
        const g = new THREE.ConeGeometry(0.0085, h, 5);
        g.translate(0, h / 2, 0);
        const dir = new THREE.Vector3(Math.cos(a) * 0.85, -0.55 - 0.2 * R2(), Math.sin(a) * 0.85).normalize();
        const M = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        M.setPosition(Math.cos(a) * 0.022, 0.118, Math.sin(a) * 0.022);
        fusion(g, M, osC);
        const pts = [new THREE.Vector3(Math.cos(a) * 0.02, 0.112, Math.sin(a) * 0.02), new THREE.Vector3(Math.cos(a + 0.6) * 0.03, 0.1, Math.sin(a + 0.6) * 0.03),
          new THREE.Vector3(Math.cos(a + 1.1) * 0.024, 0.085, Math.sin(a + 1.1) * 0.024)];
        fusion(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.0022, 3, false), new THREE.Matrix4(), tendon);
      }
      // collier de la garde (os poreux)
      const col = new THREE.TorusGeometry(0.026, 0.0085, 5, Math.max(9, Math.round(12 * q)));
      fusion(col, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.124, -0.002), osC);
      // pommeau : éperon d'os recourbé et bague de fer
      const ep = new THREE.ConeGeometry(0.011, 0.07, 6, 2);
      ep.translate(0, 0.035, 0);
      const epp = ep.attributes.position;
      for (let v = 0; v < epp.count; v++) { const yy = epp.getY(v); epp.setZ(v, epp.getZ(v) + 0.35 * (yy / 0.07) * (yy / 0.07) * 0.07); }
      ep.computeVertexNormals();
      fusion(ep, new THREE.Matrix4().makeRotationX(Math.PI).setPosition(0, -0.128, 0.0), osC);
      const bague2 = new THREE.TorusGeometry(0.021, 0.0045, 4, Math.max(8, Math.round(10 * q)));
      fusion(bague2, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, -0.122, 0.0), () => cl(0x3a2a20));
    }
    const geoPoi = new THREE.BufferGeometry();
    const P6 = new Float32Array(gp);
    geoPoi.setAttribute('position', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(P6, 6), 3, 0));
    geoPoi.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(P6, 6), 3, 3));
    geoPoi.setAttribute('color', new THREE.Float32BufferAttribute(gcs.rouge, 3));
    geoPoi.setIndex(gi);
    geoPoi.computeBoundingSphere();
    const TAB_POI = {};
    for (const n of NOMS_PALETTES) TAB_POI[n] = new Float32Array(gcs[n]);

    // ---------------------------------------------------------------- matériaux
    // uniformes propres à cette instance (uTemps, uSceauCoul, uDoublure et uFlash sont ceux du corps de la même instance)
    const UL = {
      uTemps: C.U.uTemps, uDissol: { value: 0 }, uDissolCoul: { value: new THREE.Color(1.2, 0.03, 0.01) }, uPuis: { value: 0 }, uSceauCoul: C.U.uSceauCoul,
      uVeine: { value: 0.5 }, uVeineCoul: { value: new THREE.Color(1.5, 0.05, 0.02) }, uDoublure: C.U.uDoublure, uFlotAmp: { value: 0 },
      uForm: { value: 1 }, uFiss: { value: 0 }, uEffrit: { value: 0 }, uPouls: { value: 0 }, uFlash: C.U.uFlash,
      uLameReg: { value: new THREE.Vector3(0, 0.1, 1) }
    };
    const matLame = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.14, metalness: 0.0, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
    matLame.envMapIntensity = 0.8;
    patchBoss(THREE, matLame, { LAME: true }, UL, 'lame');
    const matPoi = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, metalness: 0.15 });
    patchBoss(THREE, matPoi, { LAMEPOI: true }, UL, 'poignee');
    // chaque lame bat à son propre rythme : seconde copie du matériau avec sa propre pulsation
    const UL2 = Object.assign({}, UL, { uPouls: { value: 0 } });
    const matLame2 = matLame.clone();
    patchBoss(THREE, matLame2, { LAME: true }, UL2, 'lame');
    // cœur de la garde : masse organique noirâtre veinée de rouge, qui bat (échelle et émission)
    // deux lobes inégaux, bosselé, un moignon de vaisseau ; couleur noirâtre, veines (aBoss.z) seules lumineuses
    const geoCoeur = new THREE.SphereGeometry(1, Math.max(12, Math.round(16 * q)), Math.max(9, Math.round(12 * q)));
    const TAB_COEUR = {};
    {
      const pc = geoCoeur.attributes.position, nC = pc.count;
      const eC = new Float32Array(nC * 3);
      for (const n of NOMS_PALETTES) TAB_COEUR[n] = new Float32Array(nC * 3);
      for (let i = 0; i < nC; i++) {
        const x = pc.getX(i), y = pc.getY(i), z = pc.getZ(i);
        // lobes : renflement à gauche en haut, pointe en bas décalée ; bosses irrégulières
        let k = 1 + 0.22 * Math.exp(-((x - 0.45) * (x - 0.45) + (y - 0.35) * (y - 0.35)) * 3) + 0.16 * Math.exp(-((x + 0.5) * (x + 0.5) + (y - 0.2) * (y - 0.2)) * 4);
        k += 0.09 * (vnoise(x * 3.2, y * 3.2, z * 3.2, 731) - 0.5) + 0.05 * (vnoise(x * 7, y * 7, z * 7, 733) - 0.5);
        k *= 1 - 0.32 * smooth(-0.2, -1, y) * (1 - Math.abs(x) * 0.4);
        // moignon de vaisseau en haut
        k += 0.35 * Math.exp(-((x + 0.15) * (x + 0.15) + z * z) * 14) * smooth(0.6, 1, y);
        pc.setXYZ(i, x * k * 0.024, (y * k + 0.08) * 0.028, z * k * 0.019);
        const v1 = 1 - smooth(0, 0.07, Math.abs(vnoise(x * 2.4 + 3, y * 2.4, z * 2.4, 735) - 0.5));
        const v2 = 1 - smooth(0, 0.05, Math.abs(vnoise(x * 5 + 1, y * 5, z * 5, 737) - 0.5));
        const ve = Math.max(v1, v2 * 0.7);
        const clair = vnoise(x * 6, y * 6, z * 6, 739) > 0.55;
        for (const n of NOMS_PALETTES) {
          const P = PL[n], base = cl(clair ? P.coeur[0] : P.coeur[1]), T = TAB_COEUR[n];
          T[i * 3] = base[0] + ve * P.coeurVeine[0]; T[i * 3 + 1] = base[1] + ve * P.coeurVeine[1]; T[i * 3 + 2] = base[2] + ve * P.coeurVeine[2];
        }
        eC[i * 3] = 1; eC[i * 3 + 1] = 0; eC[i * 3 + 2] = 0.08 + 0.92 * ve;
      }
      geoCoeur.setAttribute('color', new THREE.BufferAttribute(TAB_COEUR.rouge.slice(), 3));
      geoCoeur.setAttribute('aBoss', new THREE.BufferAttribute(eC, 3));
      geoCoeur.computeVertexNormals();
    }
    const matCoeur = [UL, UL2].map((u, i) => patchBoss(THREE, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0,
      emissive: new THREE.Color().fromArray(cl(0xff2410)), emissiveIntensity: 1 }), { EMISMASQUE: true }, u, 'coeur' + i));

    // ---------------------------------------------------------------- deux lames attachées aux mains
    const lames = [];
    const NT = 14;                                   // longueur de la traînée (images)
    let tris = 0;
    for (const [S, G, sx] of [['L', 'G', 1], ['R', 'D', -1]]) {
      const d = [ARM_DIR[0] * sx, ARM_DIR[1], 0], pl = sx > 0 ? PAUME_L : miroir(PAUME_L);
      const racine = new THREE.Object3D(); racine.name = 'lame-' + G;
      const w = C.W['hand' + S];
      const c = vadd(vadd(w, vscale(d, 0.062)), vscale(pl, 0.03));
      racine.position.set(c[0] - w[0], c[1] - w[1], c[2] - w[2] + 0.004);
      const Yb = [0, 0, 1], Zb = d, Xb = vnorm(vcross(Yb, Zb));
      racine.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(Xb[0], Xb[1], Xb[2]), new THREE.Vector3(Yb[0], Yb[1], Yb[2]), new THREE.Vector3(Zb[0], Zb[1], Zb[2])));
      const frem = new THREE.Object3D();
      racine.add(frem);
      const mL = new THREE.Mesh(geoLame, G === 'G' ? matLame : matLame2); mL.castShadow = !!C.opts.ombres; mL.renderOrder = 2;
      const mP = new THREE.Mesh(geoPoi, matPoi); mP.castShadow = !!C.opts.ombres;
      const mC = new THREE.Mesh(geoCoeur, matCoeur[G === 'G' ? 0 : 1]); mC.position.set(0.0, 0.124, 0.03); mC.castShadow = false;
      frem.add(mL); frem.add(mP); frem.add(mC);
      C.B['hand' + S].add(racine);
      racine.visible = false;
      // ancres : garde (lameG / lameD) et pointe de la lame (pointeLameG / pointeLameD)
      const tip = pointLame(0, 1, 0, 0);
      for (const [nom, p] of [['lame' + G, [0, 0.124, 0]], ['pointeLame' + G, tip]]) {
        const anc = C.ancres[nom];
        if (anc.parent) anc.parent.remove(anc);
        anc.position.set(p[0], p[1], p[2]);
        frem.add(anc);
      }
      tris += (geoLame.index.count + geoPoi.index.count + geoCoeur.index.count) / 3;
      const hist = [];
      for (let i = 0; i < NT; i++) hist.push([new THREE.Vector3(), new THREE.Vector3()]);
      lames.push({ S: S, G: G, ancreMain: C.ancres['main' + G], racine: racine, frem: frem, mL: mL, mP: mP, mC: mC, ph: R() * 10, f1: 9 + 4 * R(), f2: 0.35 + 0.2 * R(), per: 0.98 + 0.16 * R(),
        U: G === 'G' ? UL : UL2, prev: new THREE.Vector3(), vit: new THREE.Vector3(), aPrev: false, hist: hist, nHist: 0, iHist: 0 });
    }

    // ---------------------------------------------------------------- particules : gouttes, éclaboussures au sol, traînées, fumée
    const monde = new THREE.Group(); monde.name = 'boss-lames-monde'; monde.matrixAutoUpdate = false;
    C.objet.add(monde);
    // uCoul (et uReflet, reflet des gouttes) : couleur de la palette courante, changée sans recompiler
    const shaderPart = (additif, couleur) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uCoul: { value: new THREE.Color(couleur[0], couleur[1], couleur[2]) }, uReflet: { value: new THREE.Color(0.12, 0.02, 0.02) }, uTemps: C.U.uTemps },
        vertexShader: 'attribute vec2 aUV; attribute float aAlpha; varying vec2 vUV; varying float vA; void main(){ vUV = aUV; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: additif
          ? 'uniform vec3 uCoul; varying vec2 vUV; varying float vA; void main(){ float e = 1.0 - abs(vUV.y * 2.0 - 1.0); float a = vA * e * e; if (a < 0.003) discard; gl_FragColor = vec4(uCoul * a, a); }'
          : 'uniform vec3 uCoul; uniform vec3 uReflet; varying vec2 vUV; varying float vA; void main(){ vec2 c = vUV * 2.0 - 1.0; float r = length(c); float n = sin(atan(c.y, c.x) * 7.0 + vUV.x * 3.0) * 0.08; float a = vA * (1.0 - smoothstep(0.55 + n, 1.0 + n, r)); if (a < 0.02) discard; vec3 col = uCoul * (0.7 + 0.6 * (1.0 - r)) + uReflet * pow(max(0.0, 1.0 - length(c - vec2(-0.3, 0.35)) * 2.2), 3.0); gl_FragColor = vec4(col, a); }',
        transparent: true, depthWrite: false, blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide
      });
      return m;
    };
    const mkDyn = (nQuads, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nQuads * 12), 3));
      g.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(nQuads * 8), 2));
      g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(nQuads * 4), 1));
      const ix = new Uint16Array(nQuads * 6);
      for (let i = 0; i < nQuads; i++) { ix.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
      g.setIndex(new THREE.BufferAttribute(ix, 1));
      const uv = g.attributes.aUV.array;
      for (let i = 0; i < nQuads; i++) uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
      monde.add(m);
      return m;
    };
    const lin3 = (r, g, b) => lin ? [r, g, b] : [Math.pow(r, 1 / 2.2), Math.pow(g, 1 / 2.2), Math.pow(b, 1 / 2.2)];
    const NG = 72, NE = 40;
    const mGouttes = mkDyn(NG * 2, shaderPart(false, lin3(0.16, 0.004, 0.004)));
    const mEclab = mkDyn(NE, shaderPart(false, lin3(0.11, 0.003, 0.003)));
    const mTrainee = mkDyn(2 * (NT - 1), shaderPart(true, lin3(1.0, 0.12, 0.05)));
    const mFumee = mkDyn(24, shaderPart(true, lin3(0.22, 0.015, 0.01)));
    mEclab.renderOrder = 1;
    // option « gouttes : false » : le jeu dessine lui-même le sang (src/fx.js) → aucune goutte ni éclaboussure ici
    const avecGouttes = !(C.opts && C.opts.gouttes === false);
    mGouttes.visible = avecGouttes; mEclab.visible = avecGouttes;
    // coordonnées de texture fixes des traînées et de la fumée (posées une fois)
    for (const m of [mTrainee, mFumee]) { const uv = m.geometry.attributes.aUV.array; for (let i = 0; i < uv.length; i += 8) { uv[i] = 0; uv[i + 1] = 0; uv[i + 2] = 0; uv[i + 3] = 1; uv[i + 4] = 1; uv[i + 5] = 1; uv[i + 6] = 1; uv[i + 7] = 0; } }
    const gouttes = [], eclab = [], fumees = [];
    for (let i = 0; i < NG; i++) gouttes.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3() });
    for (let i = 0; i < NE; i++) eclab.push({ vie: 0, p: new THREE.Vector3(), r: 0, a: 0 });
    for (let i = 0; i < 24; i++) fumees.push({ vie: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0 });
    let iG = 0, iE = 0, iF = 0, accG = 0, accF = 0;
    const tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), tvBest = new THREE.Vector3();
    const pointMonde = (L, part, s, w, out) => { const p = pointLame(part, s, w, 0); out.set(p[0], p[1], p[2]); L.mL.updateMatrixWorld(); return out.applyMatrix4(L.mL.matrixWorld); };
    const emettreGoutte = (p, v) => { const g = gouttes[iG]; iG = (iG + 1) % NG; g.vie = 1; g.p.copy(p); g.v.copy(v); };
    const st = { vis: false, trainee: 0, palette: null };

    // ---------------------------------------------------------------- palette courante (instantané, sans recompilation)
    // Couleurs prêtes pour chaque palette (une fois) ; au changement : recopie des couleurs de sommets (verre, cœur,
    // tendons) préparées plus haut, uniformes, couleurs de matériau. Rien de partagé avec une autre instance.
    const col3 = (a) => new THREE.Color(a[0], a[1], a[2]);
    const PC = {};
    for (const n of NOMS_PALETTES) {
      const P = PL[n];
      PC[n] = { veine: col3(P.veine), reg: new THREE.Vector3(P.reg[0], P.reg[1], P.reg[2]), dissolLame: col3(P.dissolLame), coeurEmis: new THREE.Color().fromArray(cl(P.coeurEmis)),
        trainee: col3(lin3(P.trainee[0], P.trainee[1], P.trainee[2])), fumee: col3(lin3(P.fumee[0], P.fumee[1], P.fumee[2])),
        goutte: col3(lin3(P.goutte[0], P.goutte[1], P.goutte[2])), eclab: col3(lin3(P.eclab[0], P.eclab[1], P.eclab[2])), reflet: col3(lin3(P.reflet[0], P.reflet[1], P.reflet[2])),
        dissol: col3(P.dissol), aura: col3(lin3(P.aura[0], P.aura[1], P.aura[2])) };
    }
    function palette(nom) {
      const n = nomPalette(nom);
      if (n === st.palette) return n;
      st.palette = n;
      const P = PL[n], K = PC[n];
      const recopier = (geo, tab) => { const a = geo.attributes.color; a.array.set(tab); a.needsUpdate = true; };
      recopier(geoLame, TAB_LAME[n]); recopier(geoPoi, TAB_POI[n]); recopier(geoCoeur, TAB_COEUR[n]);
      UL.uVeineCoul.value.copy(K.veine); UL.uDissolCoul.value.copy(K.dissolLame); UL.uLameReg.value.copy(K.reg);   // UL2 partage ces objets
      for (let i = 0; i < matCoeur.length; i++) matCoeur[i].emissive.copy(K.coeurEmis);
      matLame.opacity = matLame2.opacity = P.opacite; matLame.roughness = matLame2.roughness = P.rugosite; matLame.envMapIntensity = matLame2.envMapIntensity = P.env;
      mTrainee.material.uniforms.uCoul.value.copy(K.trainee); mFumee.material.uniforms.uCoul.value.copy(K.fumee);
      mGouttes.material.uniforms.uCoul.value.copy(K.goutte); mGouttes.material.uniforms.uReflet.value.copy(K.reflet);
      mEclab.material.uniforms.uCoul.value.copy(K.eclab); mEclab.material.uniforms.uReflet.value.copy(K.reflet);
      // teinte de la dissolution du corps et du halo de l'aura quand les lames sont là (lue par l'animateur et l'aura)
      if (C.teinte) { C.teinte.nom = n; C.teinte.dissol.copy(K.dissol); C.teinte.aura.copy(K.aura); }
      return n;
    }
    function maj(etatL, ctx) {
      const etat = etatL && etatL.etat ? etatL.etat : 'aucune', t = clamp(etatL && etatL.t != null ? etatL.t : 1, 0, 1);
      const dt = ctx.dt, T = ctx.temps;
      monde.matrix.copy(C.objet.matrixWorld).invert();
      monde.matrixWorldNeedsUpdate = true;
      const vis = etat !== 'aucune' && ctx.dissol < 0.98;
      let form = 1, fiss = 0, effr = 0, echP = 1, tors = 0, debit = 4.5, debitMain = 0;
      if (etat === 'formation') {
        form = smooth(0.3, 0.86, t); echP = smooth(0.22, 0.5, t);
        const k = clamp((t - 0.74) / 0.26, 0, 1); tors = k > 0 ? Math.sin(k * Math.PI * 2.5) * Math.exp(-k * 3) * 0.7 : 0;
        debitMain = t < 0.55 ? 18 : 0; debit = t > 0.5 ? 6 : 0;
      } else if (etat === 'destruction') {
        fiss = smooth(0.0, 0.45, t); effr = smooth(0.4, 1.0, t); debit = t > 0.4 && t < 0.95 ? 30 : 3;
        echP = 1 - smooth(0.82, 1.0, t);
      }
      if (ctx.dissol > 0) effr = Math.max(effr, ctx.dissol);
      // dissolution du corps (téléportations, apparitions) : le cœur et la poignée fondent avec la lame au lieu de rester
      // entiers jusqu'à la disparition (v2.2)
      const kDis = ctx.dissol > 0 ? 1 - smooth(0.2, 0.85, ctx.dissol) : 1;
      UL.uForm.value = form; UL.uFiss.value = fiss; UL.uEffrit.value = effr;
      UL.uVeine.value = 0.5 + ctx.puis * 0.5;
      // traînée pendant les coups
      const frappe = ctx.action === 'frappe' || (ctx.action === 'frappe-ratee' && ctx.u < 0.35) || (ctx.action === 'frappe-preparation' && ctx.u > 0.9);
      st.trainee += ((frappe && vis ? 1 : 0) - st.trainee) * (1 - Math.exp(-dt * (frappe ? 30 : 6)));
      for (let il = 0; il < lames.length; il++) {
        const L = lames[il];
        L.racine.visible = vis;
        if (!vis) { L.aPrev = false; L.nHist = 0; continue; }
        // battement de cœur propre à chaque lame (période ≈ 1 s, deux coups rapprochés)
        const cyc = ((T + L.ph) % L.per) / L.per;
        const pouls = Math.exp(-Math.pow(cyc - 0.06, 2) / 0.0025) + 0.6 * Math.exp(-Math.pow(cyc - 0.3, 2) / 0.004);
        L.U.uPouls.value = pouls + 0.3 * ctx.rage;
        L.mC.scale.setScalar(Math.max(0.001, echP * kDis * (1 + 0.16 * pouls)));
        L.mC.material.emissiveIntensity = (0.5 + 2.6 * pouls) * (1 - effr);
        // frémissement indépendant de chaque lame, torsion de formation
        const a1 = bruit1(T * L.f1 + L.ph, 711) * 0.012, a2 = bruit1(T * L.f1 * 1.3 + L.ph * 2, 713) * 0.01;
        const tw = Math.sin(T * L.f2 * TAU + L.ph) * 0.035 + tors * (L.G === 'G' ? 1 : -1);
        L.frem.rotation.set(a1, tw, a2);
        L.mP.scale.setScalar(Math.max(0.001, echP * (0.35 + 0.65 * kDis)));
        L.frem.updateMatrixWorld(true);
        // vitesse de la lame (gouttes projetées pendant les gestes)
        pointMonde(L, 0, 0.6, 0.5, tv);
        if (L.aPrev && dt > 0) { L.vit.subVectors(tv, L.prev).divideScalar(dt); if (L.vit.length() > 30) L.vit.set(0, 0, 0); } else L.vit.set(0, 0, 0);
        L.prev.copy(tv); L.aPrev = true;
        // gouttes : depuis les points les plus bas de la lame, ou depuis la paume pendant la formation
        accG += avecGouttes ? dt * (debit + debitMain) : 0;
        while (accG >= 1) {
          accG -= 1;
          if (debitMain > 0 && R() < debitMain / (debit + debitMain)) {
            L.ancreMain.getWorldPosition(tv2);
            tv2.x += (R() - 0.5) * 0.05; tv2.z += (R() - 0.5) * 0.05;
            emettreGoutte(tv2, tv.set((R() - 0.5) * 0.2, -0.3 * R(), (R() - 0.5) * 0.2));
          } else {
            let aBest = false;
            for (let k = 0; k < 3; k++) {
              const s = R() * Math.min(1, form * 1.05), w = R() < 0.5 ? 0 : 1;
              pointMonde(L, 0, s, w, tv2);
              if (!aBest || tv2.y < tvBest.y) { tvBest.copy(tv2); aBest = true; }
            }
            emettreGoutte(tvBest, tv.copy(L.vit).multiplyScalar(0.55).add(tv2.set((R() - 0.5) * 0.15, -0.1, (R() - 0.5) * 0.15)));
          }
        }
        // fumée rouge qui s'élève de la lame
        accF += dt * 3.2;
        while (accF >= 1) {
          accF -= 1;
          const f = fumees[iF]; iF = (iF + 1) % fumees.length;
          pointMonde(L, 0, R() * form, R(), f.p);
          f.v.set((R() - 0.5) * 0.12, 0.18 + 0.15 * R(), (R() - 0.5) * 0.12); f.vie = 1; f.r = 0.05 + 0.06 * R();
        }
        // historique pour la traînée : base et pointe du grand arc
        if (st.trainee > 0.01) {
          // tampon circulaire : L.iHist = case la plus récente
          L.iHist = (L.iHist + NT - 1) % NT;
          const h = L.hist[L.iHist];
          pointMonde(L, 0, 0.25, 0, h[0]); pointMonde(L, 0, 1.0, 0, h[1]);
          L.nHist = Math.min(NT, L.nHist + 1);
        } else L.nHist = 0;
      }
      // intégration des gouttes et éclaboussures au sol
      const sol = ctx.solMonde;
      let nG = 0, nE = 0, nF = 0;
      if (avecGouttes) for (let ig = 0; ig < NG; ig++) {
        const g = gouttes[ig];
        if (g.vie <= 0) continue;
        g.v.y -= 9.8 * dt;
        g.p.addScaledVector(g.v, dt);
        g.vie -= dt * 0.25;
        if (g.p.y <= sol + 0.003) {
          const e = eclab[iE]; iE = (iE + 1) % NE;
          e.vie = 1; e.p.set(g.p.x, sol + 0.004 + iE * 0.00005, g.p.z); e.r = 0.012 + 0.03 * Math.min(1, g.v.length() / 5) * (0.6 + 0.8 * R()); e.a = R() * TAU;
          g.vie = 0;
        }
        if (g.vie > 0) nG++;
      }
      if (avecGouttes) for (let ie = 0; ie < NE; ie++) { const e = eclab[ie]; if (e.vie > 0) { e.vie -= dt / 6; nE++; } }
      for (let jf = 0; jf < fumees.length; jf++) { const f = fumees[jf]; if (f.vie > 0) { f.vie -= dt / 1.6; f.p.addScaledVector(f.v, dt); f.r += dt * 0.05; nF++; } }
      // écriture des sommets (repère du monde : le groupe « monde » annule la transformation du boss), seulement quand
      // quelque chose est visible : sinon le maillage est caché (ni envoi au GPU, ni appel de dessin)
      mGouttes.visible = avecGouttes && nG > 0;
      mEclab.visible = avecGouttes && nE > 0;
      mTrainee.visible = vis && st.trainee > 0.004;
      mFumee.visible = vis && nF > 0;
      if (mGouttes.visible) {
        const P = mGouttes.geometry.attributes.position.array, Al = mGouttes.geometry.attributes.aAlpha.array;
        let k = 0;
        for (let ig = 0; ig < NG; ig++) {
          const g = gouttes[ig];
          const a = g.vie > 0 ? 1 : 0;
          const len = 0.014 + Math.min(0.05, g.v.length() * 0.01), wd = 0.0055;
          tv.copy(g.v); if (tv.lengthSq() < 1e-6) tv.set(0, -1, 0); tv.normalize();
          for (let sd = 0; sd < 2; sd++) {
            tv2.set(sd === 0 ? 1 : 0, 0, sd === 0 ? 0 : 1).cross(tv);
            if (tv2.lengthSq() < 1e-8) tv2.set(0, 1, 0);
            tv2.normalize().multiplyScalar(wd);
            const o = k * 12;
            P[o] = g.p.x - tv2.x; P[o + 1] = g.p.y - tv2.y; P[o + 2] = g.p.z - tv2.z;
            P[o + 3] = g.p.x + tv2.x; P[o + 4] = g.p.y + tv2.y; P[o + 5] = g.p.z + tv2.z;
            P[o + 6] = g.p.x + tv2.x - tv.x * len; P[o + 7] = g.p.y + tv2.y - tv.y * len; P[o + 8] = g.p.z + tv2.z - tv.z * len;
            P[o + 9] = g.p.x - tv2.x - tv.x * len; P[o + 10] = g.p.y - tv2.y - tv.y * len; P[o + 11] = g.p.z - tv2.z - tv.z * len;
            Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = a;
            k++;
          }
        }
        mGouttes.geometry.attributes.position.needsUpdate = true; mGouttes.geometry.attributes.aAlpha.needsUpdate = true;
      }
      if (mEclab.visible) {
        const P = mEclab.geometry.attributes.position.array, Al = mEclab.geometry.attributes.aAlpha.array;
        for (let k = 0; k < NE; k++) {
          const e = eclab[k];
          const r = e.r * (e.vie > 0 ? Math.min(1, (1 - e.vie) * 30 + 0.3) : 0), c = Math.cos(e.a) * r, s = Math.sin(e.a) * r;
          const o = k * 12;
          P[o] = e.p.x - c + s; P[o + 1] = e.p.y; P[o + 2] = e.p.z - s - c;
          P[o + 3] = e.p.x + c + s; P[o + 4] = e.p.y; P[o + 5] = e.p.z + s - c;
          P[o + 6] = e.p.x + c - s; P[o + 7] = e.p.y; P[o + 8] = e.p.z + s + c;
          P[o + 9] = e.p.x - c - s; P[o + 10] = e.p.y; P[o + 11] = e.p.z - s + c;
          const a = e.vie > 0 ? Math.min(1, e.vie * 2.5) * 0.92 : 0;
          Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = a;
        }
        mEclab.geometry.attributes.position.needsUpdate = true; mEclab.geometry.attributes.aAlpha.needsUpdate = true;
      }
      if (mTrainee.visible) {
        const P = mTrainee.geometry.attributes.position.array, Al = mTrainee.geometry.attributes.aAlpha.array;
        let k = 0;
        for (let l = 0; l < lames.length; l++) {
          const L = lames[l];
          for (let i = 0; i < NT - 1; i++, k++) {
            const o = k * 12;
            if (!vis || i + 1 >= L.nHist) { Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = 0; continue; }
            // i = 0 : case la plus récente ; quadrilatère base/pointe récentes → pointe/base plus anciennes
            const h0 = L.hist[(L.iHist + i) % NT], h1 = L.hist[(L.iHist + i + 1) % NT];
            P[o] = h0[0].x; P[o + 1] = h0[0].y; P[o + 2] = h0[0].z;
            P[o + 3] = h0[1].x; P[o + 4] = h0[1].y; P[o + 5] = h0[1].z;
            P[o + 6] = h1[1].x; P[o + 7] = h1[1].y; P[o + 8] = h1[1].z;
            P[o + 9] = h1[0].x; P[o + 10] = h1[0].y; P[o + 11] = h1[0].z;
            const a0 = (1 - i / (NT - 1)) * st.trainee * 0.85, a1 = (1 - (i + 1) / (NT - 1)) * st.trainee * 0.85;
            Al[k * 4] = a0; Al[k * 4 + 1] = a0; Al[k * 4 + 2] = a1; Al[k * 4 + 3] = a1;
          }
        }
        mTrainee.geometry.attributes.position.needsUpdate = true; mTrainee.geometry.attributes.aAlpha.needsUpdate = true;
      }
      if (mFumee.visible) {
        const P = mFumee.geometry.attributes.position.array, Al = mFumee.geometry.attributes.aAlpha.array;
        for (let k = 0; k < fumees.length; k++) {
          const f = fumees[k];
          const r = f.r, o = k * 12, a = f.vie > 0 && vis ? Math.sin(Math.PI * f.vie) * 0.5 : 0;
          const ang = k * 1.3;
          const cx = Math.cos(ang) * r, cz = Math.sin(ang) * r;
          P[o] = f.p.x - cx; P[o + 1] = f.p.y - r; P[o + 2] = f.p.z - cz;
          P[o + 3] = f.p.x + cx; P[o + 4] = f.p.y - r; P[o + 5] = f.p.z + cz;
          P[o + 6] = f.p.x + cx; P[o + 7] = f.p.y + r; P[o + 8] = f.p.z + cz;
          P[o + 9] = f.p.x - cx; P[o + 10] = f.p.y + r; P[o + 11] = f.p.z - cz;
          Al[k * 4] = Al[k * 4 + 1] = Al[k * 4 + 2] = Al[k * 4 + 3] = a;
        }
        mFumee.geometry.attributes.position.needsUpdate = true; mFumee.geometry.attributes.aAlpha.needsUpdate = true;
      }
    }
    function reinitialiser() {
      for (const g of gouttes) g.vie = 0;
      for (const e of eclab) e.vie = 0;
      for (const f of fumees) f.vie = 0;
      for (const L of lames) { L.aPrev = false; L.nHist = 0; L.iHist = 0; }
      st.trainee = 0;
    }
    palette(C.opts && C.opts.couleurLames);
    return {
      maj: maj, reinitialiser: reinitialiser, lames: lames, uniformes: UL, triangles: Math.round(tris), monde: monde, gouttes: avecGouttes,
      palette: palette, paletteCourante: () => st.palette, materiaux: { lame: matLame, lame2: matLame2, poignee: matPoi, coeur: matCoeur },
      dispose: () => { geoLame.dispose(); geoPoi.dispose(); geoCoeur.dispose(); matLame.dispose(); matLame2.dispose(); matPoi.dispose(); for (const m of matCoeur) m.dispose(); for (const m of [mGouttes, mEclab, mTrainee, mFumee]) { m.geometry.dispose(); m.material.dispose(); } }
    };
  }
