  // ============================================================================================
  // Tête de remplacement du Septième (utilisée seulement si aucune donnée BOSS_B7_TETE n'est fournie) :
  // homme d'environ 55 ans, émacié, crâne entièrement rasé et un peu allongé ; sur le crâne et le haut du
  // front, le sceau à sept branches de Bunker 7 gravé en cicatrices qui luisent rouge-orangé (shader,
  // drapeau TETE7) ; longue cicatrice chirurgicale agrafée de la tempe droite à la mâchoire ; orbites
  // profondes, pommettes saillantes, joues creuses, nez long et mince un peu busqué, lèvres minces et
  // sombres, menton anguleux, chaume gris très court sur la mâchoire ; ni cheveux, ni moustache, ni barbe ;
  // oreilles normales ; peau très pâle gris-bleuté, veines sombres autour des yeux et aux tempes ; iris
  // incandescent rouge, sclère sombre. Ne ressemble à aucune personne réelle.
  // Mâchoire articulée (os « machoire ») : la bouche s'ouvre vraiment (couture découpée dans le shader,
  // cavité, dents). Méthode reprise de ../survivant/src/head.js (loft du crâne + relief).
  // ============================================================================================
  const TETE_RINGS = [
    [1.556, 0.024, 0.083, 0.046, 2.3],
    [1.565, 0.043, 0.090, 0.014, 2.5],
    [1.578, 0.053, 0.093, -0.018, 2.9],
    [1.595, 0.0575, 0.095, -0.049, 3.1],
    [1.615, 0.062, 0.096, -0.084, 2.9],
    [1.640, 0.0665, 0.095, -0.104, 2.7],
    [1.665, 0.0700, 0.093, -0.113, 2.5],
    [1.690, 0.0722, 0.0945, -0.119, 2.35],
    [1.715, 0.0726, 0.089, -0.124, 2.25],
    [1.740, 0.0705, 0.080, -0.126, 2.2],
    [1.765, 0.0640, 0.064, -0.119, 2.1],
    [1.785, 0.0520, 0.044, -0.100, 2.0],
    [1.800, 0.0320, 0.021, -0.066, 2.0],
    [1.808, 0.012, 0.004, -0.028, 2.0]
  ];
  const TETE_Y0 = 1.556;
  const teteRings = (grow) => TETE_RINGS.map(([y, w, f, b, n]) => ({ s: y - TETE_Y0, w: w + grow, dF: (f - b) / 2 + grow, dB: (f - b) / 2 + grow, n: n, oz: (f + b) / 2 }));
  const TETE_R = prepRings(teteRings(0));
  const OEIL_C = [0.0316, 1.6668], OEIL_R = 0.0118, OEIL_W = 0.0136, OEIL_UP = 0.0052, OEIL_LO = 0.0046;
  const BOUCHE_Y = 1.6005, BOUCHE_W = 0.0225;
  const segDist = (x, y, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, t = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
  };
  // fissures de braise (aucune sur ce visage : le sceau gravé et la cicatrice sont dessinés par le shader)
  const FISSURES = [];
  const fissure = (x, y) => { let m = 0; for (const s of FISSURES) m = Math.max(m, 1 - smooth(0.0004, 0.0016, segDist(x, y, s[0], s[1], s[2], s[3]))); return m; };

  // relief du visage (m, le long de la normale radiale)
  function reliefVisage(x, y, ang, avecYeux) {
    const front = smooth(0.05, 0.55, Math.cos(ang));
    if (front <= 0) return 0;
    const ax = Math.abs(x), aa = Math.abs(wrapPi(ang));
    const asym = x > 0 ? 1.12 : 0.92;                      // déformation asymétrique (joue gauche plus creuse)
    let d = 0;
    // nez long et mince, légèrement busqué : arête étroite, bosse au tiers supérieur, pointe un peu tombante
    const tN = clamp((1.690 - y) / (1.690 - 1.627), 0, 1);
    const top = lerp(0.0030, 0.0042, tN), base = lerp(0.0068, 0.0094, tN);
    const prof = 1 - smooth(top, base, ax);
    if (y < 1.696 && y > 1.618) d += (lerp(0.0028, 0.0188, Math.pow(tN, 1.0)) + 0.0021 * gauss(y, 1.668, 0.006)) * prof * smooth(1.696, 1.686, y) * smooth(1.618, 1.628, y);
    d += 0.0036 * gauss(y, 1.629, 0.0038) * (1 - smooth(0.003, 0.0082, ax));
    d += 0.0068 * smooth(1.6185, 1.625, y) * smooth(1.6315, 1.6245, y) * (1 - smooth(0.002, 0.0052, ax));
    d += 0.0042 * gauss(y, 1.6255, 0.0034) * (gauss(x, 0.0108, 0.0036) + gauss(x, -0.0108, 0.0036));
    d -= 0.0017 * gauss(y, 1.6245, 0.005) * (gauss(x, 0.0158, 0.0025) + gauss(x, -0.0158, 0.0025));
    // arcades, glabelle, orbites profondément creusées
    d += 0.0052 * gauss(y, 1.6905, 0.006) * gauss(ax, 0.027, 0.022);
    d += 0.0024 * gauss(y, 1.6885, 0.006) * gauss(x, 0, 0.01);
    d -= 0.0011 * smooth(1.683, 1.6865, y) * smooth(1.6975, 1.6945, y) * (gauss(x, 0.0052, 0.0011) + gauss(x, -0.0052, 0.0011));
    d -= 0.0072 * gauss(y, 1.6665, 0.0105) * gauss(ax, 0.032, 0.0165) * (x < 0 ? 1.1 : 1);
    // pommettes saillantes, joues très creuses, sillons
    d += 0.0064 * gauss(y, 1.6485, 0.0095) * gauss(ax, 0.053, 0.012);
    d -= 0.0082 * gauss(y, 1.617, 0.014) * gauss(ax, 0.047, 0.013) * asym;
    const nl = Math.min(segDist(x, y, 0.0195, 1.6305, 0.0285, 1.6005), segDist(x, y, -0.0195, 1.6305, -0.0285, 1.6005));
    d -= 0.0013 * (1 - smooth(0.0008, 0.003, nl));
    // tempes creusées
    d -= 0.004 * gauss(y, 1.70, 0.02) * gauss(aa, 1.15, 0.2);
    // bouche : lèvres très minces, commissure droite qui tombe
    const mw = BOUCHE_W, mx = clamp(ax / mw, 0, 1.2), shape = Math.sqrt(Math.max(0, 1 - mx * mx));
    const yl = BOUCHE_Y - 0.0013 * mx * mx - (x < 0 ? 0.0009 * mx : 0);
    d += 0.0004 * gauss(y, yl + 0.0022, 0.0013) * Math.pow(shape, 1.3);
    d += 0.0006 * gauss(y, yl - 0.0026, 0.0016) * shape;
    d -= 0.0011 * gauss(y, yl, 0.0008) * smooth(1.15, 0.9, mx);
    d += 0.0010 * gauss(y, 1.6125, 0.0042) * smooth(0.007, 0.002, ax);
    d -= 0.0010 * gauss(y, 1.5875, 0.003) * smooth(0.018, 0.005, ax);
    // menton anguleux (méplat et coins nets), angle de la mâchoire marqué
    d += 0.0062 * gauss(y, 1.5705, 0.0075) * (1 - smooth(0.014, 0.024, ax));
    d += 0.0016 * gauss(y, 1.5745, 0.004) * gauss(ax, 0.017, 0.004);
    d += 0.0052 * gauss(y, 1.583, 0.0095) * gauss(aa, 1.2, 0.22);
    d += 0.0003 * fissure(x, y);
    if (avecYeux !== false) {
      for (const sx of [1, -1]) {
        const cy = OEIL_C[1] - (sx < 0 ? 0.0008 : 0);
        const u = (x - OEIL_C[0] * sx) / OEIL_W, vy = y - cy;
        const v = vy / (vy > 0 ? OEIL_UP : OEIL_LO);
        const dd = u * u + v * v;
        if (dd < 3.5) {
          d -= 0.0118 * smooth(1.12, 0.6, dd);
          d += 0.0011 * gauss(dd, 1.08, 0.2);
          d -= 0.0018 * gauss(v, 1.9, 0.4) * smooth(1.45, 0.6, Math.abs(u));
          d -= 0.0012 * gauss(v, -1.8, 0.45) * smooth(1.3, 0.5, Math.abs(u));    // cernes creusés
        }
      }
    }
    return d * front;
  }
  function baseTete(y, ang, grow) {
    const r = interpRing(TETE_R, y - TETE_Y0);
    const c = Math.cos(ang), sn = Math.sin(ang), ex = 2 / r.n;
    return { x: Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (r.wL + (grow || 0)), z: Math.sign(c) * Math.pow(Math.abs(c), ex) * (r.dF + (grow || 0)) + r.oz, oz: r.oz };
  }
  function zVisage(x, y) {
    let lo = 0, hi = Math.PI / 2 * Math.sign(x || 1);
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (Math.abs(baseTete(y, mid).x) < Math.abs(x)) lo = mid; else hi = mid; }
    const ang = (lo + hi) / 2, b = baseTete(y, ang);
    const rl = Math.hypot(b.x, b.z - b.oz) || 1;
    return b.z + (b.z - b.oz) / rl * reliefVisage(b.x, y, ang, false);
  }

  function construireTete(bd, THREE, I, W, Q) {
    const q = bd.q;
    // anneaux : serrés sur le visage, couture de la bouche (4 anneaux), plus lâches sur le crâne
    const sl = [];
    const band = (y0, y1, st) => { for (let y = y0; y < y1 - 1e-6; y += 1.3 * st / Math.max(0.55, q)) sl.push(y - TETE_Y0); };
    band(1.556, 1.592, 0.004);
    band(1.592, 1.5994, 0.0022);
    sl.push(BOUCHE_Y - 0.0007 - TETE_Y0, BOUCHE_Y - 0.0003 - TETE_Y0, BOUCHE_Y + 0.0003 - TETE_Y0, BOUCHE_Y + 0.0007 - TETE_Y0);
    band(1.6015, 1.615, 0.0024);
    band(1.615, 1.655, 0.0028);
    band(1.655, 1.683, 0.0022);
    band(1.683, 1.711, 0.0032);
    band(1.711, 1.771, 0.007);
    band(1.771, 1.79, 0.005);
    sl.push(1.79 - TETE_Y0);
    sl.sort((a, b) => a - b);
    // zone de la mâchoire : sous la ligne de la bouche à l'avant, remonte vers l'oreille ; joues en fondu
    const poidsMach = (P) => {
      const x = P[0], y = P[1], z = P[2], ax = Math.abs(x);
      const front = smooth(0.035, 0.07, z);
      const inMouth = smooth(BOUCHE_W + 0.004, BOUCHE_W - 0.002, ax);
      const ySeam = BOUCHE_Y - 0.0013 * Math.min(1.2, ax / BOUCHE_W) ** 2;
      const lipCut = 1 - smooth(ySeam - 0.0001, ySeam + 0.0001, y);       // net à la lèvre
      const yJaw = lerp(1.612, 1.632, smooth(0.07, -0.01, z)) - 0.012 * smooth(0.02, 0.06, ax) * front;
      const soft = 1 - smooth(yJaw - 0.02, yJaw + 0.004, y);               // fondu sur les joues
      let w = lerp(soft * 0.85, lipCut, inMouth * front);
      w *= smooth(-0.07, -0.02, z) * smooth(1.66, 1.62, y);
      return clamp(w, 0, 1);
    };
    const peauTete = (P, s, ang) => {
      const x = P[0], y = P[1], ax = Math.abs(x);
      let c = mixc(PAL.peau, PAL.peauOmbre, fbm(P[0] * 55, P[1] * 55, P[2] * 55, 501) * 0.38);
      c = mixc(c, PAL.peauFroide, fbm(P[0] * 18, P[1] * 18, P[2] * 18, 503) * 0.45);
      c = mulc(c, 0.95 + 0.07 * vnoise(P[0] * 700, P[1] * 700, P[2] * 700, 505));
      // crâne rasé : ombre bleutée très légère de la repousse sur le haut et l'arrière
      c = mixc(c, mixc(PAL.peauOmbre, PAL.chaume, 0.4), smooth(1.70, 1.76, y) * 0.12 * (0.6 + 0.4 * vnoise(P[0] * 900, P[1] * 900, P[2] * 900, 509)));
      // orbites et joues assombries (cernes violacés), lèvres sombres et minces
      const u = (ax - OEIL_C[0]) / OEIL_W, vy = y - OEIL_C[1], v = vy / (vy > 0 ? OEIL_UP : OEIL_LO), dd = u * u + v * v;
      if (Math.cos(ang) > 0.25) {
        c = mixc(c, mixc(PAL.peauOmbre, hexc(0x4a4258), 0.5), smooth(5.5, 1.2, dd) * 0.38);
        c = mixc(c, hexc(0x221a24), gauss(dd, 1.02, 0.25) * smooth(-0.3, 0.3, v) * 0.55);
        c = mixc(c, mulc(PAL.peauOmbre, 0.82), gauss(y, 1.616, 0.012) * gauss(ax, 0.046, 0.012) * 0.45);
        const mw = BOUCHE_W, mx = clamp(ax / mw, 0, 1.2), yl = BOUCHE_Y - 0.0013 * mx * mx;
        c = mixc(c, PAL.levre, smooth(1.05, 0.85, mx) * gauss(y, yl, 0.0034) * 0.85);
        c = mixc(c, mulc(PAL.levre, 0.4), gauss(y, yl, 0.0008) * smooth(1.12, 0.8, mx) * 0.8);
        c = mixc(c, hexc(0x2e262a), gauss(y, 1.6262, 0.0013) * (gauss(x, 0.0058, 0.0018) + gauss(x, -0.0058, 0.0018)) * 0.7);   // narines
        const nl = Math.min(segDist(x, y, 0.0185, 1.6265, 0.0285, 1.6005), segDist(x, y, -0.0185, 1.6265, -0.0285, 1.6005));
        c = mixc(c, PAL.peauOmbre, (1 - smooth(0.0008, 0.003, nl)) * 0.45);
        // sourcils clairsemés gris, très fins (couleur seulement)
        const browY = 1.6898 + 0.0024 * Math.sin(Math.PI * clamp((ax - 0.01) / 0.044, 0, 1)) - 0.0012;
        c = mixc(c, mixc(PAL.chaume, PAL.peauOmbre, 0.4), gauss(y, browY, 0.0013) * smooth(0.008, 0.013, ax) * smooth(0.056, 0.046, ax) * 0.55 * (0.6 + 0.4 * vnoise(x * 2000, y * 600, 1, 511)));
        // chaume gris très court sur la mâchoire et le menton
        const mach = smooth(1.612, 1.598, y) * smooth(1.556, 1.568, y) * (1 - gauss(y, yl, 0.0035) * smooth(1.1, 0.8, mx));
        c = mixc(c, PAL.chaume, mach * 0.22 * (0.4 + 0.6 * hash3(Math.floor(x * 2600), Math.floor(y * 2600), Math.floor(P[2] * 2600), 513)));
      }
      // veines sombres autour des yeux, aux tempes et sur les côtés du crâne
      const vt = (1 - smooth(0.0, 0.05, Math.abs(vnoise(y * 90, ang * 7, 3, 507) - 0.5))) * gauss(Math.abs(wrapPi(ang)), 1.05, 0.38) * gauss(y, 1.69, 0.045);
      const ve = (1 - smooth(0.0, 0.06, Math.abs(vnoise(x * 160, y * 160, 7, 515) - 0.5))) * smooth(6.5, 2.0, dd) * smooth(1.2, 1.8, dd) * (Math.cos(ang) > 0.3 ? 1 : 0);
      c = mixc(c, PAL.veine, Math.max(vt * 0.65, ve * 0.55));
      return c;
    };
    bd.loft('peau', {
      a: [0, TETE_Y0, 0], b: [0, 1.9, 0], seg: 56, angWarp: 0.6, sList: sl, rings: teteRings(0), cap0: true, cap1: true, fixedStep: true,
      displace: (P, s, ang, r, radial) => { const d = reliefVisage(P[0], P[1], ang, true); return [radial[0] * d, radial[1] * d, radial[2] * d]; },
      weights: (s, ang, P) => {
        const m = poidsMach(P);
        const backLow = smooth(1.615, 1.575, P[1]) * smooth(-0.01, -0.06, P[2]);
        return [[I.head, (1 - m) * (1 - backLow * 0.6)], [I.machoire, m], [I.neck, (1 - m) * backLow * 0.6]];
      },
      color: peauTete,
      extra: (P, s, ang) => {
        const ax = Math.abs(P[0]);
        const front = Math.cos(ang) > 0.55 ? 1 : 0;
        const dy = Math.abs(P[1] - BOUCHE_Y);
        const mx = ax / BOUCHE_W;
        const hole = (dy < 0.00045 && mx < 1.0 && front) ? 1 : 0;
        return [0, hole, fissure(P[0], P[1]) * (Math.cos(ang) > 0 ? 1 : 0)];
      }
    });

    // cavité buccale (sombre), dents abîmées
    {
      const g = new THREE.SphereGeometry(1, bd.n(14, 8), bd.n(10, 6));
      const M = new THREE.Matrix4().makeTranslation(0, BOUCHE_Y - 0.004, 0.062).multiply(new THREE.Matrix4().makeScale(0.021, 0.016, 0.024));
      bd.rigid('bouche', g, M, (P) => { const m = smooth(BOUCHE_Y + 0.004, BOUCHE_Y - 0.006, P[1]); return [[I.head, 1 - m], [I.machoire, m]]; },
        (P) => mixc(hexc(0x1a0606), hexc(0x3a0c0a), smooth(BOUCHE_Y - 0.012, BOUCHE_Y - 0.018, P[1]) * 0.6));
      for (const [row, y0, bone] of [[0, BOUCHE_Y + 0.0035, I.head], [1, BOUCHE_Y - 0.0035, I.machoire]]) {
        for (let k = -3; k <= 3; k++) {
          const x = k * 0.0052, z = zVisage(x * 0.9, BOUCHE_Y) - 0.0085 - 0.0008 * k * k;
          const h = 0.0062 - Math.abs(k) * 0.0004 + (k === 1 || k === -2 ? -0.0015 : 0);
          const tg = new THREE.BoxGeometry(0.0047, h, 0.0035, 1, 2, 1);
          bd.rigid('bouche', tg, new THREE.Matrix4().makeRotationY(-x * 6).setPosition(x, y0 + (row ? -h / 2 + 0.003 : h / 2 - 0.003), z), [[bone, 1]],
            (P) => mixc(hexc(0xb6ab8c), hexc(0x5a4a32), 0.25 + 0.5 * vnoise(P[0] * 900, P[1] * 900, 1, 509)));
        }
      }
    }

    // yeux : globe sombre, iris rouge-orangé lumineux (masque d'émission), suivent les os des yeux
    for (const sx of [1, -1]) {
      const cx = OEIL_C[0] * sx, cy = OEIL_C[1] - (sx < 0 ? 0.0008 : 0);
      const rim = zVisage(cx, cy) + 0.0011;
      const cz = rim - 0.0018 - OEIL_R;
      const look = vnorm([0.02 * sx, -0.01, 1]);
      const bone = sx > 0 ? I.oeilG : I.oeilD;
      const g = new THREE.SphereGeometry(OEIL_R, bd.n(16, 10), bd.n(10, 7));
      bd.cur = (P) => { const n = vnorm(vsub(P, [cx, cy, cz])), dz = vdot(n, look); return [0, 0, dz > 0.975 ? 0.05 : dz > 0.86 ? 1.0 - 0.4 * smooth(0.93, 0.86, dz) : 0.035]; };
      bd.rigid('yeux', g, new THREE.Matrix4().makeTranslation(cx, cy, cz), [[bone, 1]], (P, N) => {
        const dz = vdot(N, look);
        if (dz > 0.975) return hexc(0x080303);
        if (dz > 0.86) return mixc(hexc(0xff3a1a), hexc(0xffa060), smooth(0.9, 0.97, dz));
        return mixc(hexc(0x1c1416), hexc(0x3a0e10), 0.3 + 0.5 * vnoise(N[0] * 30, N[1] * 30, N[2] * 30, 517));
      });
      bd.cur = [0, 0, 0];
      // bord des paupières sombre
      const lid = [];
      for (let k = 0; k <= 28; k++) {
        const t = k / 28 * TAU, u = Math.cos(t), up = Math.sin(t) >= 0;
        const ly = cy + Math.sin(t) * (up ? OEIL_UP : OEIL_LO) * 0.97;
        lid.push([cx + u * (OEIL_W - 0.0003), ly, zVisage(cx + u * (OEIL_W - 0.0003), ly) - 0.0012]);
      }
      bd.ribbon('peau', lid, (t) => (Math.sin(t * TAU) >= 0 ? 0.0024 : 0.0016), 0.0015,
        (pp) => vnorm([(pp[0] - cx) * 0.6, (pp[1] - cy) * 0.6, 1]), () => [[I.head, 1]],
        (P, t) => mixc(mixc(PAL.peau, PAL.peauOmbre, 0.6), hexc(0x120a0a), smooth(-0.2, 0.6, Math.sin(t * TAU)) * 0.8));
    }
    // oreilles normales (proches du crâne), pâles
    for (const sx of [1, -1]) {
      const ear = new THREE.SphereGeometry(0.0275, bd.n(12, 8), bd.n(9, 6));
      ear.scale(0.3, 0.98, 0.56);
      const me = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.18, -0.06 * sx, 0.05 * sx)).setPosition(0.0688 * sx, 1.654, -0.03);
      bd.rigid('peau', ear, me, [[I.head, 1]], (P, N) => mixc(mixc(PAL.peau, PAL.peauRose, 0.25), PAL.peauOmbre, smooth(0.1, 0.8, N[0] * sx) * 0.5));
      const rimG = new THREE.TorusGeometry(0.0216, 0.0038, 5, bd.n(12, 8), Math.PI * 1.25);
      rimG.rotateZ(-Math.PI * 0.45); rimG.scale(1, 1.18, 1);
      const mr = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.18, -0.06 * sx + Math.PI / 2 * sx, 0.05 * sx)).setPosition(0.0708 * sx, 1.657, -0.032);
      bd.rigid('peau', rimG, mr, [[I.head, 1]], mixc(PAL.peau, PAL.peauRose, 0.3));
    }

    // cicatrice chirurgicale agrafée : de la tempe droite (x < 0) à la mâchoire, en avant de l'oreille ;
    // polyligne posée sur la surface (le shader dessine la couture, le bourrelet et les agrafes)
    {
      const pts = [[1.722, -1.08], [1.688, -1.2], [1.652, -1.22], [1.618, -1.16], [1.592, -1.02], [1.572, -0.8]];
      Q.cicatrice = pts.map(([y, ang]) => {
        const b = baseTete(y, -Math.abs(ang));
        const rl = Math.hypot(b.x, b.z - b.oz) || 1;
        const d = reliefVisage(b.x, y, -Math.abs(ang), false);
        return [b.x + b.x / rl * d, y, b.z + (b.z - b.oz) / rl * d];
      });
    }

  }
