/* ================================================================ 15 PRÉHENSION ==
   Prise des armes (jeu 2.0.6) : demande d'Anthony du 17 octobre 2026, « un véritable système de
   préhension des armes » (points de préhension propres à chaque arme, mains et poignets cohérents,
   doigts articulés, poses de poignée, de détente et de garde-main, cinématique inverse, synchronisation
   avec le tir et les rechargements, contrôles visuels), validé par lui le même jour.

   Une prise se déclare par arme et par main (PRISES) : où se pose le centre de la paume, la direction
   des doigts et celle du pouce. Le solveur (prSolveHand) fait le reste, comme une main qui saisit :
     1. la paume vient au contact de l'arme, sans y entrer ;
     2. chaque doigt s'enroule (base et milieu ; le bout suit le milieu, IPD = 0,72 × IPP, comme le
        tendon commun d'une vraie main) jusqu'à ce que le plus de phalanges touchent l'arme sans la
        traverser, dans les limites des articulations (PR_LIM) ;
     3. l'index de la main droite pose sa pulpe sur la face avant de la détente (et, détente tirée,
        se plie avec elle : prise « press ») ;
     4. le pouce vise son point (flanc de la pièce tenue), dans son cône anatomique.
   Les prises se calculent pendant le menu (warmHolds) et sont gardées (HOLD_CACHE) ; les armes sans
   prise déclarée gardent l'ajustement du jeu 1.9.0 (gunHold, fitHold) jusqu'à leur passage ici.
   Contrôle : prMeasureHold (pénétrations en mm, contacts, angles) et le banc engine/tools/mains.js. */

/* Repères anatomiques de la main droite, dans le repère de son poignet (la gauche : x opposé). */
const PR_REP = {
  web: [-0.04, -0.004, -0.062],      // creux entre le pouce et l'index (bord radial de la paume)
  palm: [0.0, -0.0185, -0.048],      // centre de la face palmaire
  heel: [0.022, -0.0175, -0.014],    // talon de la main côté auriculaire (éminence hypothénar)
  mcpI: [-0.026, -0.012, -0.086],    // têtes des métacarpiens : index, majeur, auriculaire (face palmaire)
  mcpM: [-0.0085, -0.012, -0.0895],
  mcpL: [0.026, -0.012, -0.079],
};
/* Limites des articulations (radians) : doigts (base, milieu ; bout lié au milieu) et pouce (abduction
   palmaire, flexion de la base, milieu, bout, opposition ; repère du pouce du jeu 2.0.6). */
const PR_LIM = {
  mcp: [-0.25, 1.55], pip: [0, 1.75], dip: 1.25, kDip: 0.72,
  // pouce (construction 2) : écartement de la base 0 à 40° au-delà du repos (60° au plus), pas d'hyperextension
  pouce: [[0.1, 1.05], [-0.3, 0.8], [0, 0.95], [-0.05, 1.25], [-0.5, 0.65]],
};

/* Prises déclarées, dans le plan du modèle de l'arme (x à droite, v en haut, u vers l'arrière ; les
   mêmes nombres que dans GUN_MODELS). D : main droite, G : main gauche. Ancrage : le point de l'arme où
   se pose un repère de la main (PR_ANCRES : paume, creux, index, majeur ; le premier donné) ; doigts,
   pouce : directions (le dos de la main s'en déduit) ; la paume vient ensuite au contact ; detente :
   l'index va sur la détente ; poucePt, pouceBout : où vont l'articulation du milieu et la pulpe du pouce
   (solveur anatomique prThumbPose) ; pouceVers : le point que regarde la pulpe ; pouceSur : 'majeur', le
   pouce se referme par-dessus le majeur (poignées où les doigts font le tour). recharge :
   prises des pièces saisies pendant le rechargement (chargeur, levier), dans le repère de la pièce ;
   pince : pulpe de l'index et pulpe du pouce sur ces points (face : direction de la pulpe de l'index). */
const PRISES = {
  /* STG-44 : poignée pistolet (creux de la main contre le haut du dos de la poignée, majeur sous le
     pontet, pouce enroulé derrière la poignée et posé sur le flanc gauche) ; main gauche sous le
     garde-main, doigts en diagonale sur le flanc droit (poignet incliné de 17° au lieu de 33°), main
     roulée côté pouce pour coucher le pouce le long du bas du flanc gauche, vers l'avant. */
  stg44: {
    D: { modele: 'poignee' },   // modèle commun (construction 2 : la place déclarée de l'étape 1 gênait le pouce)
    G: { paume: [-0.002, -0.032, 0.28], doigts: [0.8, 0.15, -0.58], pouce: [-0.05, 0.55, -1],
      poucePt: [-0.0235, -0.014, 0.232], pouceBout: [-0.0175, -0.006, 0.2] },
    // rechargement, dans le repère de chaque pièce (origine : celle de la pièce dans le modèle) :
    // chargeur saisi par le flanc gauche, doigts enroulés sur l'avant ; levier d'armement (patte de 16 ×
    // 9 mm à gauche de la boîte) pincé entre la pulpe de l'index (devant) et celle du pouce (derrière)
    recharge: {
      chargeur: { paume: [-0.0126, -0.04, 0.012], doigts: [0, -0.12, -1], pouce: [0, 1, 0.1] },
      levier: { index: [-0.055, -0.005, 0.017], doigts: [0.85, 0.1, -0.5], pouce: [0.1, 0.3, 1],
        pince: { index: [-0.0128, 0, -0.0085], pouce: [-0.0128, 0.002, 0.0105], face: [0, 0, 1] } },
    },
  },
};

/* Poignées pistolet (étape 2) : main droite par le modèle « poignee » (MG42, Onde de choc : 6 mm plus bas, la
   boîte de culasse gênait le pouce en haut de la poignée) ; main gauche sur le puits du chargeur (MP40), une
   poignée avant (Thompson, Panzerschreck, Onde de choc), sous le fût (FG42) ou sous le manchon du canon (MG42). */
Object.assign(PRISES, {
  mp40: { D: { modele: 'poignee' }, G: { modele: 'verticale', haut: [0, -0.02, 0.243], dz: 0.008 },
    recharge: { chargeur: { modele: 'chargeur' }, levier: { modele: 'levier', out: [-1, 0, 0] } } },
  thompson: { D: { modele: 'poignee' }, G: { modele: 'verticale', haut: [0, -0.036, 0.211] },
    recharge: { chargeur: { modele: 'chargeur' }, levier: { modele: 'levier', out: [0, 1, 0] } } },
  fg42: { D: { modele: 'poignee' }, G: { modele: 'garde', centre: [0, -0.042, 0.34] },
    recharge: { levier: { modele: 'levier', out: [1, 0, 0] } } },
  mg42: { D: { modele: 'poignee', dy: 0.006 }, G: { modele: 'garde', centre: [0, 0, 0.35] } },
  panzer: { D: { modele: 'poignee' }, G: { modele: 'verticale', haut: [0, -0.058, 0.692] } },
  blaster: { D: { modele: 'poignee', dy: 0.006 }, G: { modele: 'verticale', haut: [0, -0.072, 0.253] } },   // main sous la boîte (le pouce en fait le tour)
});

/* Crosses (étape 2) : main droite sur la poignée inclinée de la crosse (modèle « crosse ») ; main gauche
   sous le fût, sous la pompe (Trench), sous le garde-main ou sous le tambour (PPSh). Fûts en bois hauts
   de 4 cm (Kar98k, G43, Double canon) : main décalée à gauche et plus roulée, pouce le long du flanc. PPSh-41 :
   main droite 69 mm derrière la détente, sur le bois juste derrière la boîte de culasse (plus en avant, le pouce
   ne peut pas passer par-dessus la boîte ; plus en arrière, l'index n'atteint plus la détente). */
Object.assign(PRISES, {
  kar98k: { D: { modele: 'crosse', hi: 0.45 }, G: { modele: 'garde', centre: [0, -0.045, 0.47], paume: [-0.012, -0.062, 0.47], pouce: [-0.05, 0.8, -0.8] } },
  g43: { D: { modele: 'crosse', hi: 0.45 }, G: { modele: 'garde', centre: [0, -0.047, 0.48], paume: [-0.015, -0.063, 0.48], pouce: [-0.05, 0.8, -0.8] } },
  trench: { D: { modele: 'crosse' }, G: { modele: 'garde', centre: [0, -0.042, 0.31] } },
  dbarrel: { D: { modele: 'crosse' }, G: { modele: 'garde', centre: [0, -0.03, 0.56], paume: [-0.016, -0.046, 0.56], pouce: [-0.05, 0.8, -0.8] } },
  bar: { D: { modele: 'crosse' }, G: { modele: 'garde', centre: [0, -0.042, 0.6] } },
  ppsh: { D: { modele: 'crosse', du: 0.069 }, G: { modele: 'garde', centre: [0, -0.2, 0.268] } },   // main gauche sous le tambour
  type100: { D: { modele: 'crosse' }, G: { modele: 'garde', centre: [0, -0.041, 0.33] } },
});

/* Pistolets : tenus d'une main, la gauche ne vient qu'au rechargement (info.one). Modèle « poignee », comme les
   poignées pistolet (construction 2) : la place de 1.9.0, reprise à l'étape 2, laissait la base du pouce trop
   loin de la poignée pour qu'il en fasse le tour (pouce raide le long de la glissière). */
Object.assign(PRISES, {
  m1911: { D: { modele: 'poignee' } },
  raygun: { D: { modele: 'poignee' } },
});

const PR_ANCRES = { paume: 'palm', creux: 'web', index: 'mcpI', majeur: 'mcpM' };
/* Modèles de prise : une prise peut se déclarer par un modèle (modele) et quelques points ; le reste se
   mesure sur l'arme (rayons contre ses triangles) avec les réglages trouvés sur le STG-44 (jeu 2.0.6).
     poignee   main droite sur une poignée pistolet : rien à donner (détente et poignée mesurées) ; dz : recul
               de la main (25 mm par défaut), dy : main plus basse (pouce gêné par la boîte de culasse) ;
     verticale main gauche sur une poignée verticale ou un puits de chargeur : haut (point du haut de la
               face avant) ; dz : base des doigts reculée d'autant depuis la face avant (poignée en boîte) ;
     garde     main gauche sous un garde-main ou un fût : centre (point du dessous où va la paume) ;
     crosse    main droite sur la poignée inclinée d'une crosse : du (distance derrière la détente où se
               mesure la poignée), hi (hauteur de l'index sur son flanc, en fraction).
   Les valeurs données à côté du modèle remplacent celles qu'il calcule. */
function prRay(T, o, d, len) { const t = triHit(T, o.x, o.y, o.z, d.x * len, d.y * len, d.z * len); return t <= 1 ? t * len : null; }
/* Triangles de l'arme pièce par pièce (repère de l'arme, comme gunTris) : chaque maillage est fermé, on peut
   y compter entrées et sorties ; deux pièces qui se chevauchent (chargeur dans son puits) ne se mêlent pas. */
function prMeshTris(root) {
  const parts = Object.values(root.userData.parts || {}), saved = parts.map((p) => [p.position.clone(), p.quaternion.clone()]);
  for (const p of parts) { p.position.copy(p.userData.rest); p.quaternion.copy(p.userData.restQ); }
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let q = o; q && q !== root; q = q.parent) if (!q.visible || (q.userData && q.userData.spare)) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; }
    let part = null; for (let q = o; q && q !== root; q = q.parent) if (parts.includes(q)) { part = q; break; }
    a.part = part ? Object.keys(root.userData.parts).find((k) => root.userData.parts[k] === part) : null;
    out.push(a);
  });
  parts.forEach((p, i) => { p.position.copy(saved[i][0]); p.quaternion.copy(saved[i][1]); });
  root.updateMatrixWorld(true);
  return out;
}
/* Première matière épaisse (au moins minT traversés) le long d'un rayon : [entrée, sortie] (distances).
   Dans chaque pièce, entrées et sorties se reconnaissent au sens de la face touchée (normale contre le rayon :
   entrée) et se comptent (faces doublées des biseaux sans effet) ; les intervalles de toutes les pièces sont
   fusionnés, deux pièces jointives n'en font qu'une ; les pièces minces (barre de pontet, tôle) sont passées. */
function prSolid(meshes, o, d, len, minT = 0.015) {
  const iv = [];
  for (const T of meshes) {
    const ev = [];
    for (let i = 0; i < T.length; i += 9) {
      const t = triHit(T.subarray(i, i + 9), o.x, o.y, o.z, d.x * len, d.y * len, d.z * len);
      if (t > 1) continue;
      const e1x = T[i + 3] - T[i], e1y = T[i + 4] - T[i + 1], e1z = T[i + 5] - T[i + 2], e2x = T[i + 6] - T[i], e2y = T[i + 7] - T[i + 1], e2z = T[i + 8] - T[i + 2];
      const nd = (e1y * e2z - e1z * e2y) * d.x + (e1z * e2x - e1x * e2z) * d.y + (e1x * e2y - e1y * e2x) * d.z;
      ev.push([t * len, nd < 0 ? 1 : -1]);
    }
    ev.sort((x, y) => x[0] - y[0]);
    let depth = 0, start = 0;
    for (const [t, s] of ev) {
      if (s > 0) { if (depth === 0) start = t; depth++; }
      else if (depth > 0) { depth--; if (depth === 0) iv.push([start, t]); }
    }
  }
  iv.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of iv) { const last = merged[merged.length - 1]; if (last && a <= last[1] + 0.001) last[1] = Math.max(last[1], b); else merged.push([a, b]); }
  return merged.find(([a, b]) => b - a >= minT) || null;
}
function prExpand(root, T, decl, meshes = null) {
  if (!decl || !decl.modele) return decl;
  meshes = meshes || prMeshTris(root);
  const ud = root.userData, org = ud.origin, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const toPlan = (v) => [+(v.x + org[0]).toFixed(4), +(v.y + org[1]).toFixed(4), +(v.z + org[2]).toFixed(4)];
  const P = (a) => V(a[0] - org[0], a[1] - org[1], a[2] - org[2]);
  const X = V(1, 0, 0), Z = V(0, 0, 1), Y = V(0, 1, 0);
  let out;
  if (decl.modele === 'poignee' || decl.modele === 'verticale') {
    const right = decl.modele === 'poignee', sx = right ? 1 : -1;
    let y0, zStart;
    if (right) { const trig = triggerPoint(root, ud); y0 = trig.y - 0.008 - (decl.dy || 0); zStart = trig.z + 0.012; out = { trig }; }
    else { const h = P(decl.haut); y0 = h.y - 0.012; zStart = h.z - 0.08; out = {}; }
    const sol = prSolid(meshes, V(0, y0, zStart), Z, 0.15), zF = zStart + (sol ? sol[0] : 0.03), zB = zStart + (sol ? sol[1] : 0.07);
    const dW = prRay(T, V(-0.08, y0 - 0.012, (zF + zB) / 2), X, 0.16), hw = dW === null ? 0.016 : 0.08 - dW;
    const top = right ? out.trig.y : P(decl.haut).y - 0.003;
    out = {
      // base de l'index sur le flanc, reculée de dz depuis l'avant de la poignée : toute la longueur de l'index
      // sert à atteindre la détente, la commissure vient sur le dos de la poignée et la base du pouce derrière
      // elle (main droite : 25 mm, main gauche sur une poignée avant : 30 mm ; jusqu'à la construction 1, la
      // main restait à l'avant de la poignée et le pouce ne pouvait pas en faire le tour)
      index: toPlan(V(sx * (hw + 0.007), y0, zF + 0.0007 + (decl.dz ?? (right ? 0.025 : 0.03)))), doigts: [-0.3 * sx, 0, -0.95], pouce: [0, 1, -0.1], detente: right,
      // pouce : articulation du milieu au coin arrière de l'autre flanc (hors de la poignée, la commissure sur
      // le dos de la poignée) ; pulpe refermée sur le majeur (pouceSur), tournée vers le cœur de la poignée
      poucePt: toPlan(V(-sx * (hw + 0.011), top - 0.006, zB - 0.002)), pouceBout: toPlan(V(-sx * (hw + 0.0065), y0 + 0.001, zF + (zB - zF) * 0.45)),
      pouceVers: toPlan(V(0, y0 - 0.006, (zF + zB) / 2)), pouceSur: 'majeur',
    };
  } else if (decl.modele === 'crosse') {
    // poignée de crosse (inclinée) : section mesurée à du derrière la détente ; index sur son flanc droit
    // (fraction hi de la hauteur), côté pouce le long de la poignée vers l'avant, doigts enroulés dessous,
    // pouce par-dessus, posé sur le flanc gauche vers l'avant
    const trig = triggerPoint(root, ud), du = decl.du ?? 0.05, z = trig.z + du;
    const sv = prSolid(meshes, V(0, trig.y - 0.12, z), Y, 0.25, 0.015), yBot = sv ? trig.y - 0.12 + sv[0] : trig.y - 0.01, yTop = sv ? trig.y - 0.12 + sv[1] : trig.y + 0.04;
    // section haute (plus de 5 cm : la crosse droite de la BAR sous la boîte de culasse) : la main en tient le bas
    const tall = yTop - yBot > 0.05, yH = tall ? yBot + 0.045 : yTop;
    const yC = (yBot + yH) / 2, sw = prSolid(meshes, V(-0.08, yC, z), X, 0.16, 0.01), hw = sw ? 0.08 - sw[0] : 0.02;
    const yI = tall ? yBot + 0.022 : yBot + (decl.hi ?? 0.6) * (yTop - yBot);
    out = {
      index: toPlan(V(hw + 0.007, yI, z)), doigts: [-0.25, -0.5, -0.83], pouce: [0, 0.86, -0.5], detente: true,
      // pouce par-dessus la poignée de crosse : articulation du milieu posée sur le dessus, pulpe sur le flanc
      // gauche à mi-hauteur ; section trop haute pour en faire le tour (plus de 5 cm, comme la BAR avant la
      // correction de son modèle) : la main en tient les 4,5 cm du bas, pouce sur le flanc gauche de cette partie
      ...(tall
        ? { poucePt: toPlan(V(-(hw + 0.011), yH - 0.004, z + 0.012)), pouceBout: toPlan(V(-(hw + 0.0065), yBot + 0.024, z - 0.022)) }
        : { poucePt: toPlan(V(-hw * 0.25, yTop + 0.0115, z + 0.012)), pouceBout: toPlan(V(-(hw + 0.0065), yC + 0.003, z - 0.002)) }),
      pouceVers: toPlan(V(0, tall ? yBot + 0.024 : yC, z)),
    };
  } else if (decl.modele === 'garde') {
    const c = P(decl.centre);
    const dY = prRay(T, V(c.x, c.y - 0.06, c.z), Y, 0.1), yB = c.y - 0.06 + (dY ?? 0.06);
    const dX = prRay(T, V(-0.08, yB + 0.005, c.z), X, 0.16), xL = dX === null ? -0.015 : -0.08 + dX;
    // fût large : la paume glisse vers la gauche et le pouce monte le long du flanc (réglé sur le STG-44,
    // 26 mm de large ; un fût de 42 mm décale la paume de 7 mm et monte le pouce de 2 mm)
    // hauteur du flanc gauche (matière au-dessus du dessous, 4 mm à l'intérieur du flanc)
    const sh = prSolid(meshes, V(xL + 0.004, yB - 0.01, c.z - 0.02), Y, 0.15, 0.008), yT = sh ? yB - 0.01 + sh[1] : yB + 0.03;
    out = {
      paume: toPlan(V(c.x - 0.35 * -xL + 0.0025, yB - 0.0165, c.z)), doigts: [0.8, 0.15, -0.58], pouce: [-0.05, 0.55, -1],
      // pouce : base au coin bas du flanc gauche, pulpe sur ce flanc à mi-hauteur, un peu en avant (en face des
      // doigts posés sur le flanc droit)
      // (pulpe 45 mm en avant, au quart de la hauteur : le pouce repose en biais vers l'avant, courbé, la pulpe
      // appuyée sur le flanc, comme une main qui porte le fût en diagonale dans la paume)
      poucePt: toPlan(V(xL - 0.012, yB + 0.004, c.z + (decl.pm ?? 0.012))), pouceBout: toPlan(V(xL - 0.0065, yB + (decl.ph ?? 0.25) * Math.min(0.04, yT - yB), c.z - (decl.pa ?? 0.045))),
      pouceVers: toPlan(V(c.x - 0.35 * -xL, yB + 0.45 * Math.min(0.04, yT - yB), c.z - 0.02)),
    };
  }
  const res = Object.assign(out, decl);
  delete res.modele; delete res.haut; delete res.centre; delete res.dz; delete res.dy; delete res.du; delete res.hi; delete res.pm; delete res.ph; delete res.pa;
  // un ancrage donné remplace celui du modèle
  for (const k of Object.keys(PR_ANCRES)) if (decl[k]) for (const j of Object.keys(PR_ANCRES)) if (j !== k && !decl[j]) delete res[j];
  return res;
}
/* --------------------------------------------------------------- outils du solveur */
const _prV = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function prSetFinger(bones, m, p, s, kd = PR_LIM.kDip) {
  bones[0].rotation.set(-m, s, 0); bones[1].rotation.x = -p; bones[2].rotation.x = -Math.min(PR_LIM.dip, p * kd);
}
/* Une phalange traverse-t-elle l'arme au-delà de k fois son rayon ? Lignes le long de l'os, sur deux
   anneaux (k et k/2) répartis tout autour (phalanxHit, celui de l'ajustement de 1.9.0, n'en tire que quatre côté paume :
   une pièce mince passait entre elles). */
const PR_PEN_LINES = [[0, 0], [0, -0.85], [0, 0.75], [0.8, -0.2], [-0.8, -0.2], [0.55, -0.6], [-0.55, -0.6], [0.55, 0.5], [-0.55, 0.5]];
const _ppA = new THREE.Vector3(), _ppB = new THREE.Vector3();
function prPen(G, bone, L, r, tip, k = 0.8) {
  const end = -(L + (tip ? r * 0.85 * k : 0));
  for (const kk of [k, k * 0.5]) for (let i = kk === k ? 0 : 1; i < PR_PEN_LINES.length; i++) {   // deux anneaux : une barre mince ne passe pas entre
    const [x, y] = PR_PEN_LINES[i];
    bone.localToWorld(_ppA.set(x * r * kk, y * r * kk, 0)); bone.localToWorld(_ppB.set(x * r * kk, y * r * kk, end));
    if (gridSeg(G, _ppA, _ppB)) return true;
  }
  return false;
}
/* Pénétration (au-delà de 0,8 du rayon : le gant s'écrase de 2 mm au plus) et contact (rayon + 3,5 mm)
   de chaque phalange d'un doigt. */
function prFingerState(G, bones, F) {
  bones[0].updateMatrixWorld(true);
  const pen = [false, false, false], touch = [false, false, false];
  for (let j = 0; j < 3; j++) if (prPen(G, bones[j], F.L[j], F.r[j], j === 2)) { pen[j] = true; return { pen, touch, n: 1 }; }   // une suffit
  for (let j = 0; j < 3; j++) touch[j] = phalanxHit(G, bones[j], F.L[j], F.r[j] + 0.0035, j === 2);
  return { pen, touch, n: 0 };
}
/* Enroulement d'un doigt : parmi les flexions permises, celle où le plus de phalanges touchent sans
   pénétrer, puis la plus fermée (une main qui serre), le moins écartée de son écart naturel. */
function prWrapFinger(G, bones, F, s0) {
  let best = null;
  const evalAt = (m, p, s) => {
    m = clamp(m, PR_LIM.mcp[0], PR_LIM.mcp[1]); p = clamp(p, PR_LIM.pip[0], PR_LIM.pip[1]);
    prSetFinger(bones, m, p, s);
    const st = prFingerState(G, bones, F);
    const nt = st.touch.reduce((a, t, j) => a + (t ? [1, 1.2, 1.5][j] : 0), 0);
    const score = -10 * st.n + nt + 0.25 * (m + p) - 0.6 * Math.abs(s - s0) - 0.15 * Math.abs(m - 0.85 * p);
    if (!best || score > best.score) best = { m, p, s, score, npen: st.n, touch: st.touch };
  };
  // flexion sur une grille de 0,14 rad à l'écart naturel, puis affinage (0,07 rad) et écart (± 0,08)
  for (let m = PR_LIM.mcp[0]; m <= PR_LIM.mcp[1] + 1e-6; m += 0.14) for (let p = PR_LIM.pip[0]; p <= PR_LIM.pip[1] + 1e-6; p += 0.14) evalAt(m, p, s0);
  const b0 = best;
  for (const ds of [0, -0.08, 0.08]) for (const dm of [-0.07, 0, 0.07]) for (const dp of [-0.07, 0, 0.07]) if (ds || dm || dp) evalAt(b0.m + dm, b0.p + dp, s0 + ds);
  prSetFinger(bones, best.m, best.p, best.s);
  return best;
}
/* Index sur la détente : la pulpe de la phalange distale sur le point visé (face avant de la détente),
   tournée vers l'arrière, sans traverser l'arme ; base (flexion, écart), milieu, et bout lié au milieu
   (trois rapports essayés). near : pose voisine préférée (détente tirée : même doigt, plus plié) ;
   faceDir : direction voulue de la pulpe (par défaut vers l'arrière de l'arme). */
function prIndexOn(G, hand, target, near = null, faceDir = null) {
  const bs = hand.fingers[0], F = HAND.fingers[0], pad = new THREE.Vector3(), nrm = new THREE.Vector3(), q = new THREE.Quaternion();
  const cands = [];
  const evalAt = (m, s, p, kd, lim) => {
    m = clamp(m, PR_LIM.mcp[0], PR_LIM.mcp[1]); p = clamp(p, PR_LIM.pip[0], PR_LIM.pip[1]);
    prSetFinger(bs, m, p, s, kd); bs[0].updateMatrixWorld(true);
    bs[2].localToWorld(pad.set(0, -F.r[2] * 0.92, -F.L[2] * 0.55));
    const d = pad.distanceTo(target);
    if (d > lim) return;
    bs[2].getWorldQuaternion(q); nrm.set(0, -1, 0).applyQuaternion(q);
    const face = faceDir ? nrm.dot(faceDir) : nrm.z;        // pulpe tournée vers l'arrière (contre la face avant), ou vers faceDir
    let c = d - 0.004 * face;
    if (near) c += 0.01 * (Math.abs(m - near.m) + Math.abs(s - near.s) + 0.5 * Math.abs(kd - near.kd));
    cands.push({ m, s, p, kd, d, face, c });
  };
  // près d'une pose voisine (détente tirée) : seulement autour d'elle ; sinon grille de 0,1 rad
  const M = near ? [Math.max(PR_LIM.mcp[0], near.m - 0.2), near.m + 0.2] : [PR_LIM.mcp[0], 1.3], S = near ? [near.s - 0.1, near.s + 0.1] : [-0.45, 0.36], KD = near ? [near.kd] : [0.55, 0.72, 0.9];
  for (const kd of KD) for (let m = M[0]; m <= M[1] + 1e-6; m += 0.1) for (let s = S[0]; s <= S[1] + 1e-6; s += 0.1) for (let p = 0; p <= 1.5; p += 0.1) evalAt(m, s, p, kd, 0.014);
  cands.sort((a, b) => a.c - b.c);
  const seeds = cands.slice(0, 6);
  for (const c of seeds) for (const dm of [-0.05, 0, 0.05]) for (const ds of [-0.05, 0, 0.05]) for (const dp of [-0.05, 0, 0.05]) if (dm || ds || dp) evalAt(c.m + dm, c.s + ds, c.p + dp, c.kd, 0.008);
  const ok = cands.filter((c) => c.d <= 0.008).sort((a, b) => a.c - b.c);
  for (const c of ok.slice(0, 200)) {
    prSetFinger(bs, c.m, c.p, c.s, c.kd); bs[0].updateMatrixWorld(true);
    let hit = false;
    for (let j = 0; j < 3 && !hit; j++) hit = prPen(G, bs[j], F.L[j], F.r[j], j === 2);
    if (!hit) return c;
  }
  return ok.length ? Object.assign({ blocked: true }, ok[0]) : null;
}
/* Pouce anatomique (jeu 2.0.6, construction 2). Le pouce n'est pas un doigt comme les autres : sa base
   s'écarte de la paume et tourne sur elle-même (opposition) pour que sa pulpe fasse face aux doigts. Le
   solveur cherche la pose qui :
     · pose la pulpe sur la pièce tenue, du côté opposé aux doigts (padT : point visé) et la base du pouce
       (articulation du milieu) derrière la pièce (mcpT) ;
     · garde une posture naturelle : jamais tendu (articulations du milieu et du bout pliées d'au moins
       PR_POUCE.fmin ensemble), le bout plié au moins comme le milieu mais pas plus de 30° au-delà (pas de
       crochet), écartement modéré, rotation liée à l'écartement et à la flexion (opposition) ;
     · tourne la pulpe vers les doigts (dernière phalange du majeur) ;
     · touche l'arme ou les doigts sans les traverser, ni la paume de la main (grille GP).
   Recherche : grille des quatre angles (rotation liée), classée sur la géométrie seule, collisions vérifiées
   sur les meilleures, puis affinage. Rend [écartement, flexion de la base, milieu, bout, rotation]. */
const PR_POUCE = { fmin: 0.5, abdMax: 0.9, wT: 60, wM: 25 };
const _ptA = new THREE.Vector3(), _ptB = new THREE.Vector3(), _ptC = new THREE.Vector3(), _ptQ = new THREE.Quaternion();
/* Une phalange touche-t-elle l'arme à gap près (lignes denses, rayon + gap) ? */
function prTouch(G, bone, L, r, tip, gap = 0.0015) {
  const end = -(L + (tip ? r * 0.85 : 0)), R = r + gap;
  for (const [x, y] of PR_PEN_LINES) {
    if (!x && !y) continue;
    bone.localToWorld(_ppA.set(x * R, y * R, 0)); bone.localToWorld(_ppB.set(x * R, y * R, end));
    if (gridSeg(G, _ppA, _ppB)) return true;
  }
  return false;
}
function prPenFrom(G, bone, L, r, tip, from, k = 0.8) {
  const end = -(L + (tip ? r * 0.85 * k : 0));
  for (const [x, y] of PR_PEN_LINES) {
    bone.localToWorld(_ppA.set(x * r * k, y * r * k, -L * from)); bone.localToWorld(_ppB.set(x * r * k, y * r * k, end));
    if (gridSeg(G, _ppA, _ppB)) return true;
  }
  return false;
}
function prPalmGrid(hand, c) {
  const palm = hand.body.children.find((m) => m.isMesh && m.geometry === HAND_GEO.palm);
  return palm ? triGrid(new Float32Array(objTris(palm, [])), c, 0.16) : null;
}
function prThumbPose(G, GP, hand, mcpT, padT, o = {}) {
  const [t1, t2, t3] = hand.thumb, TH = HAND.thumb, L = PR_LIM.pouce;
  const set = (t) => { t1.rotation.set(-t[1], t[0] - 0.35, t[4]); t2.rotation.x = -t[2]; t3.rotation.x = -t[3]; t1.updateMatrixWorld(true); };
  hand.fingers[1][0].updateMatrixWorld(true);
  const opp = o.opp || hand.fingers[1][2].localToWorld(new THREE.Vector3(0, -HAND.fingers[1].r[2], -HAND.fingers[1].L[2] * 0.5));
  const wT = o.wT ?? PR_POUCE.wT, wM = o.wM ?? PR_POUCE.wM, fmin = o.fmin ?? PR_POUCE.fmin;
  const clampT = (t) => t.map((v, i) => clamp(v, L[i][0], L[i][1]));
  const geo = (t) => {
    set(t);
    t3.localToWorld(_ptA.set(0, -TH.r[2] * 0.6, -TH.L[2] * 0.6)); t2.getWorldPosition(_ptB);
    let c = 0;
    if (padT) c += wT * _ptA.distanceTo(padT);
    if (mcpT) c += wM * _ptB.distanceTo(mcpT);
    const F = t[2] + t[3];
    if (F < fmin) c += ((fmin - F) / 0.12) ** 2;                               // jamais tendu
    if (t[3] < 0.8 * t[2] - 0.05) c += ((0.8 * t[2] - 0.05 - t[3]) / 0.15) ** 2;   // le bout plié au moins comme le milieu
    if (t[3] > t[2] + 0.55) c += ((t[3] - t[2] - 0.55) / 0.15) ** 2;               // pas de bout en crochet sur un milieu droit
    c += 0.5 * ((t[2] - 0.3) / 0.35) ** 2 + 0.5 * ((t[3] - 0.45) / 0.4) ** 2;      // préférence douce : flexion d'un pouce qui tient
    if (t[0] > PR_POUCE.abdMax) c += ((t[0] - PR_POUCE.abdMax) / 0.08) ** 2;
    c += 0.6 * ((t[4] - (0.5 * t[1] + 0.35 * (t[0] - 0.35))) / 0.3) ** 2;     // opposition liée
    t3.getWorldQuaternion(_ptQ); _ptC.set(0, -1, 0).applyQuaternion(_ptQ);
    c -= 0.6 * Math.max(0, _ptC.dot(opp.clone().sub(_ptA).normalize()));      // pulpe vers les doigts
    return c;
  };
  const info = {};
  const full = (t) => {
    let c = geo(t), pen = 0, touch = 0;
    const why = [];
    for (let j = 1; j < 3; j++) {
      if (prPen(G, hand.thumb[j], TH.L[j], TH.r[j], j === 2)) { c += 30; pen++; why.push('a' + j); }
      else if (j === 2 && phalanxHit(G, hand.thumb[j], TH.L[j], TH.r[j] + 0.0035, true)) { c -= 2; touch++; }     // pulpe en appui
      else if (prTouch(G, hand.thumb[j], TH.L[j], TH.r[j], j === 2, 0.002)) { c -= j === 2 ? 0.5 : 0.8; touch++; }
      else if (j === 1 && prTouch(G, hand.thumb[1], TH.L[1], TH.r[1], false, 0.01)) c -= 0.4;   // phalange du milieu près de la pièce
      if (GP && prPenFrom(GP, hand.thumb[j], TH.L[j], TH.r[j], j === 2, j === 1 ? 0.35 : 0)) { c += 30; pen++; why.push('p' + j); }
    }
    if (prPen(G, t1, TH.L[0], TH.r[0], false)) { c += 8; pen++; why.push('m'); }        // base charnue : 2,5 mm au plus
    info.pen = pen; info.touch = touch; info.why = why.join(' ');
    return c;
  };
  const cand = [];
  for (let a = L[0][0]; a <= L[0][1] + 1e-6; a += (L[0][1] - L[0][0]) / 4) for (let f = L[1][0]; f <= L[1][1] + 1e-6; f += (L[1][1] - L[1][0]) / 4)
    for (let m = 0; m <= 0.9 + 1e-6; m += 0.225) for (let i = 0; i <= 1.2 + 1e-6; i += 0.3) for (const dO of [-0.15, 0.15]) {
      const t = clampT([a, f, m, i, 0.5 * f + 0.35 * (a - 0.35) + dO]);
      cand.push({ t, g: geo(t) });
    }
  cand.sort((x, y) => x.g - y.g);
  let best = null;
  // collisions vérifiées sur les 120 poses les plus proches des cibles, puis sur un échantillon du reste (une
  // pièce trop large pour être entourée : la meilleure pose libre peut être loin des cibles)
  const tried = cand.slice(0, 120).concat(cand.slice(120).filter((_, i) => i % 5 === 0));
  for (const e of tried) { const c = full(e.t); if (!best || c < best.c) best = { t: e.t, c }; if (best.c - cand[0].g < -1) break; }
  let t = best.t.slice(), c = best.c;
  for (let it = 0; it < 3; it++) for (const st of [0.1, 0.05, 0.025]) for (let i = 0; i < 5; i++) for (const sg of [-st, st]) {
    const u = t.slice(); u[i] += sg; const uc = clampT(u), cu = full(uc); if (cu < c) { c = cu; t = uc; }
  }
  full(t);
  return { t, c, pen: info.pen, touch: info.touch, why: info.why };
}
/* Paume : écartée le long du dos de la main tant qu'elle touche (elle ou la base charnue du pouce), sinon
   rapprochée jusqu'au contact. */
function prSettlePalm(G, hand) {
  const w = hand.wrist, n = new THREE.Vector3(0, 1, 0).applyQuaternion(w.quaternion), TH = HAND.thumb;
  // paume, ou base charnue du pouce (métacarpien au repos, écrasée de 2,5 mm au plus)
  const hit = () => palmHit(G, hand) || prPen(G, hand.thumb[0], TH.L[0], TH.r[0], false);
  let moved = 0;
  w.updateMatrixWorld(true);
  if (hit()) { while (hit() && moved < 0.03) { w.position.addScaledVector(n, 0.001); moved += 0.001; w.updateMatrixWorld(true); } }
  else {
    while (!hit() && moved > -0.02) { w.position.addScaledVector(n, -0.001); moved -= 0.001; w.updateMatrixWorld(true); }
    w.position.addScaledVector(n, 0.001); moved += 0.001; w.updateMatrixWorld(true);
  }
  return moved;
}

/* Triangles de l'arme sans une pièce (l'index sur la détente : la lame se loge dans le pli de la dernière
   phalange, elle ne compte pas comme obstacle). */
function prTrisWithout(root, partName) {
  const p = root.userData.parts[partName];
  if (!p) return null;
  const vis = p.visible; p.visible = false;
  const T = new Float32Array(gunTris(root));
  p.visible = vis;
  return T;
}
/* Main posée selon une prise déclarée (repère de l'arme) : { p, q, pose, info }. org : origine du plan ;
   Tidx : triangles pour l'index sur la détente (sans la détente). */
const _prHands = {};
function prSolveHand(T0, spec, left, org, trig, Tidx = null) {
  const P = (a) => new THREE.Vector3(a[0] - org[0], a[1] - org[1], a[2] - org[2]);
  const hand = _prHands[left ? 'L' : 'R'] || (_prHands[left ? 'L' : 'R'] = buildHand(left)), w = hand.wrist;
  const q = handBasis(_prV(spec.doigts), _prV(spec.pouce), left);
  const an = Object.keys(PR_ANCRES).find((k) => spec[k]), lm = _prV(PR_REP[PR_ANCRES[an]]); if (left) lm.x = -lm.x;
  w.quaternion.copy(q); w.position.copy(P(spec[an])).sub(lm.applyQuaternion(q));
  const P0 = HAND_POSES[spec.pose || (left ? 'fore' : 'pistol')];
  hand.fingers.forEach((bs, i) => prSetFinger(bs, -0.1, 0.05, P0.s[i]));    // doigts ouverts pendant la pose de la paume
  setHandPose(hand, { f: hand.fingers.map(() => [-0.1, 0.05, 0.036]), s: P0.s, t: [0.35, 0, 0.1, 0.1, 0] });
  w.updateMatrixWorld(true);
  const c = hand.body.localToWorld(new THREE.Vector3(0, -0.01, -0.06)), G = triGrid(trisNear(T0, c, 0.15), c, 0.16);
  const info = { moved: +prSettlePalm(G, hand).toFixed(4), doigts: [] };
  const pose = { f: [], s: [], t: P0.t.slice() };
  for (let i = 0; i < 4; i++) {
    const bs = hand.fingers[i], F = HAND.fingers[i];
    if (i === 0 && spec.detente && trig) {
      const GI = Tidx ? triGrid(trisNear(Tidx, c, 0.15), c, 0.16) : G;
      const ti = prIndexOn(GI, hand, trig);
      if (ti) {
        pose.f[0] = [ti.m, ti.p, Math.min(PR_LIM.dip, ti.p * ti.kd)]; pose.s[0] = ti.s;
        info.detente = { d: +ti.d.toFixed(4), face: +ti.face.toFixed(2), bloque: !!ti.blocked, kd: ti.kd };
        prSetFinger(bs, ti.m, ti.p, ti.s, ti.kd);
        continue;
      }
      info.detente = 'hors de portée';
    }
    const b = prWrapFinger(G, bs, F, P0.s[i]);
    pose.f[i] = [b.m, b.p, Math.min(PR_LIM.dip, b.p * PR_LIM.kDip)]; pose.s[i] = b.s;
    info.doigts.push({ i, contact: b.touch.map(Number).join(''), pen: b.npen });
  }
  setHandPose(hand, pose); w.updateMatrixWorld(true);
  if (spec.pouceBout) {
    const TF = []; for (const f of hand.fingers) objTris(f[0], TF);
    G.next = triGrid(new Float32Array(TF), c, 0.16);
    let padT = P(spec.pouceBout), opp = spec.pouceVers ? P(spec.pouceVers) : null;
    if (spec.pouceSur === 'majeur') {
      // le majeur s'enroule jusqu'à l'autre flanc : le pouce se referme par-dessus lui, comme dans un poing (pulpe
      // sur le dos de sa phalange du milieu, tournée vers lui)
      const mb = hand.fingers[1], FM = HAND.fingers[1]; mb[0].updateMatrixWorld(true);
      padT = mb[1].localToWorld(new THREE.Vector3(0, FM.r[1] + 0.4 * HAND.thumb.r[2] + 0.0008, -FM.L[1] * 0.8));
      opp = mb[1].localToWorld(new THREE.Vector3(0, 0, -FM.L[1] * 0.8));
    }
    const th = prThumbPose(G, prPalmGrid(hand, c), hand, spec.poucePt ? P(spec.poucePt) : null, padT, { opp });
    pose.t = th.t; info.pouce = { c: +th.c.toFixed(3), pen: th.pen, contact: th.touch, why: th.why };
    G.next = null;
  }
  setHandPose(hand, pose); w.updateMatrixWorld(true);
  const out = { p: w.position.clone(), q: w.quaternion.clone(), pose, info };
  // détente tirée : l'index suit la détente (pièce « trigger » tournée de PR_TRIG)
  if (spec.detente && trig && info.detente && info.detente.d !== undefined) out.trigIdx = { m: pose.f[0][0], s: pose.s[0], kd: info.detente.kd };
  return out;
}
/* Détente tirée : rotation de la pièce « trigger » autour de son axe (x), en radians (le bas recule). */
const PR_TRIG = -0.28;
/* Prise d'une arme déclarée dans PRISES (même format que gunHold). */
function prGunHold(root) {
  const ud = root.userData, spec = PRISES[ud.id], org = ud.origin;
  const ms = {}, t0 = performance.now(), trig = triggerPoint(root, ud);
  // un seul parcours de l'arme : triangles de toutes les pièces, et sans la détente (index)
  const meshes = prMeshTris(root), cat = (list) => { let n = 0; for (const a of list) n += a.length; const out = new Float32Array(n); let o = 0; for (const a of list) { out.set(a, o); o += a.length; } return out; };
  const T = cat(meshes), Tidx = meshes.some((a) => a.part === 'trigger') ? cat(meshes.filter((a) => a.part !== 'trigger')) : null;
  const R = prSolveHand(T, prExpand(root, T, spec.D, meshes), false, org, trig, Tidx);
  ms.D = Math.round(performance.now() - t0);
  const hold = { R: { p: R.p, q: R.q, pose: R.pose }, fit: { R: R.info } };
  // index sur la détente tirée : la détente tourne, l'index la suit (pose voisine de la prise)
  const tp = ud.parts.trigger;
  if (R.trigIdx) {
    // détente mobile : le point visé tourne de PR_TRIG autour de l'axe de la détente (le bas recule) ;
    // détentes fixes (Double canon) : la pulpe recule de 3 mm
    let trig2;
    if (tp) {
      const piv = tp.userData.rest.clone();
      for (let q = tp.parent; q && q !== root; q = q.parent) piv.applyMatrix4(new THREE.Matrix4().compose(q.position, q.quaternion, q.scale));
      trig2 = trig.clone().sub(piv).applyAxisAngle(new THREE.Vector3(1, 0, 0), PR_TRIG).add(piv);
    } else trig2 = trig.clone().add(new THREE.Vector3(0, 0, 0.003));
    const T2 = Tidx || T;
    const hand = _prHands.R;
    hand.wrist.position.copy(R.p); hand.wrist.quaternion.copy(R.q); setHandPose(hand, R.pose); hand.wrist.updateMatrixWorld(true);
    const c = hand.body.localToWorld(new THREE.Vector3(0, -0.01, -0.06)), G = triGrid(trisNear(T2, c, 0.15), c, 0.16);
    const ti = prIndexOn(G, hand, trig2, R.trigIdx);
    if (ti) {
      const f = R.pose.f.map((x) => x.slice()), s = R.pose.s.slice();
      f[0] = [ti.m, ti.p, Math.min(PR_LIM.dip, ti.p * ti.kd)]; s[0] = ti.s;
      // index qui n'atteignait pas tout à fait la détente au repos (pulpe déjà à la place de la détente tirée) :
      // il se plie quand même un peu au coup de feu
      const r0 = R.pose.f[0];
      if (Math.abs(f[0][0] - r0[0]) + Math.abs(f[0][1] - r0[1]) < 0.03) f[0] = [r0[0] + 0.03, Math.min(PR_LIM.pip[1], r0[1] + 0.12), Math.min(PR_LIM.dip, r0[2] + 0.09)];
      hold.R.press = { f, s, t: R.pose.t };
      hold.fit.press = { d: +ti.d.toFixed(4), bloque: !!ti.blocked };
    }
  }
  ms.press = Math.round(performance.now() - t0) - ms.D;
  if (ud.info.one || !spec.G) {
    hold.L = { p: new THREE.Vector3(-0.17, -0.27, 0.16), q: handBasis(new THREE.Vector3(0.35, 0.6, -0.72), new THREE.Vector3(0, 0.55, -0.8), true), pose: HAND_POSES.relax, free: true };
  } else {
    const L = prSolveHand(T, prExpand(root, T, spec.G, meshes), true, org, null);
    hold.L = { p: L.p, q: L.q, pose: L.pose };
    hold.fit.L = L.info;
  }
  ms.G = Math.round(performance.now() - t0) - ms.D - ms.press;
  hold.fit.miss = [];
  hold.fit.ms = ms;                                // les pièces du rechargement : prFitReload (warmHolds, startReload)
  return hold;
}
/* --------------------------------------------------------------- mesures (banc, essais) */
/* Pour chaque main posée : pénétration de chaque phalange et de la paume (mm, 0 : aucune ; l'index droit
   contre l'arme sans sa détente), phalanges en contact (à 3,5 mm près), articulations hors limites,
   distance de la pulpe de l'index à la détente. */
function prMeasureHold(root, hold) {
  const T = new Float32Array(gunTris(root)), TI = prTrisWithout(root, 'trigger'), out = {};
  for (const side of ['R', 'L']) {
    const h = hold[side];
    if (!h || h.free) continue;
    const hand = buildHand(side === 'L');
    hand.wrist.position.copy(h.p); hand.wrist.quaternion.copy(h.q); setHandPose(hand, h.pose); hand.wrist.updateMatrixWorld(true);
    const c = hand.body.localToWorld(new THREE.Vector3(0, -0.01, -0.06)), G = triGrid(trisNear(T, c, 0.15), c, 0.16);
    const GI = side === 'R' && TI ? triGrid(trisNear(TI, c, 0.15), c, 0.16) : G;     // index droit : la détente ne compte pas
    const pen = {}, contact = [], lim = [];
    const depthG = (GG) => (b, L, r, tip) => { for (let k = 0.1; k <= 1.0001; k += 0.05) if (prPen(GG, b, L, r, tip, k)) return +(r * (1 - k) * 1000).toFixed(1); return 0; };
    const depth = depthG(G), depthI = depthG(GI);
    hand.fingers.forEach((bs, i) => bs.forEach((b, j) => {
      const F = HAND.fingers[i], d = i === 0 ? depthI(b, F.L[j], F.r[j], j === 2) : depth(b, F.L[j], F.r[j], j === 2);
      if (d > 0.5) pen['imar'[i] + j] = d;
      if (phalanxHit(G, b, F.L[j], F.r[j] + 0.0035, j === 2)) contact.push('imar'[i] + j);
    }));
    hand.thumb.forEach((b, j) => {
      const d = depth(b, HAND.thumb.L[j], HAND.thumb.r[j], j === 2);
      if (d > 0.5) pen['p' + j] = d;
      if (phalanxHit(G, b, HAND.thumb.L[j], HAND.thumb.r[j] + 0.0035, j === 2)) contact.push('p' + j);
    });
    if (palmHit(G, hand)) pen.paume = 1;
    h.pose.f.forEach((f, i) => { if (f[0] < PR_LIM.mcp[0] - 1e-6 || f[0] > PR_LIM.mcp[1] + 1e-6 || f[1] < PR_LIM.pip[0] - 1e-6 || f[1] > PR_LIM.pip[1] + 1e-6 || f[2] > PR_LIM.dip + 1e-6) lim.push('imar'[i]); });
    (h.pose.t || []).forEach((v, i) => { const L = PR_LIM.pouce[i]; if (L && (v < L[0] - 1e-6 || v > L[1] + 1e-6)) lim.push('p' + i); });
    out[side] = { pen, contact: contact.join(' '), limites: lim };
    if (side === 'R') {
      const trig = triggerPoint(root, root.userData);
      if (trig) { const F = HAND.fingers[0], pad = hand.fingers[0][2].localToWorld(new THREE.Vector3(0, -F.r[2] * 0.92, -F.L[2] * 0.55)); out.R.detente_mm = +(pad.distanceTo(trig) * 1000).toFixed(1); }
    }
  }
  return out;
}

/* --------------------------------------------------------------- bras : coude et poignet */
/* Le coude peut tourner autour de l'axe épaule–poignet sans que la main bouge. Parmi ces positions, on
   prend celle qui garde le poignet le plus près du neutre (extension et flexion confortables jusqu'à
   35°, inclinaison vers l'auriculaire 25°, vers le pouce 15°), le coude pas plus haut que la main (un
   tireur qui épaule lève le coude), du côté du bras (le gauche peut passer sous l'arme), et peu loin du coude habituel (pole). La rotation suit en douceur (pas de saut de coude). */
const _paS = new THREE.Vector3(), _paD = new THREE.Vector3(), _paN = new THREE.Vector3(), _paE = new THREE.Vector3(), _paF = new THREE.Vector3();
const _paX = new THREE.Vector3(), _paY = new THREE.Vector3(), _paZ = new THREE.Vector3(), _paQ = new THREE.Quaternion(), _paP = new THREE.Vector3();
/* Angles du poignet (radians) : ext (> 0 : extension, < 0 : flexion), uln (> 0 : vers l'auriculaire). */
function prWristAngles(fa, quat, left) {
  _paZ.set(0, 0, -1).applyQuaternion(quat); _paY.set(0, 1, 0).applyQuaternion(quat); _paX.set(left ? -1 : 1, 0, 0).applyQuaternion(quat);
  const az = fa.dot(_paZ);
  return { ext: Math.atan2(-fa.dot(_paY), az), uln: Math.atan2(-fa.dot(_paX), az) };
}
function prElbowCost(arm, S, E, pos, quat, sw) {
  _paF.subVectors(pos, E).normalize();
  const w = prWristAngles(_paF, quat, arm.left);
  let c = (w.ext / 0.61) ** 2 + (w.uln > 0 ? w.uln / 0.44 : -w.uln / 0.26) ** 2 + 0.25 * (sw / 1.2) ** 2;
  const up = E.y - Math.max(S.y - 0.05, pos.y); if (up > 0) c += (up / 0.05) ** 2;      // coude pas plus haut que la main
  const inward = arm.left ? E.x - 0.05 : (S.x - 0.08) - E.x; if (inward > 0) c += (inward / 0.05) ** 2;   // coude gauche : jusque sous l'arme
  return c;
}
function prSolveArm(arm, pos, quat, auto) {
  if (!auto) { arm.psi = 0; solveArm(arm, pos, quat); return; }
  const a = HAND.upper, b = HAND.fore;
  const S = _paS.copy(arm.shoulder), D = _paD.subVectors(pos, S);
  let d = D.length();
  const maxd = (a + b) * 0.985;
  if (d > maxd) { S.addScaledVector(D, (d - maxd) / d); d = maxd; }
  d = Math.max(d, Math.abs(a - b) + 0.02);
  D.subVectors(pos, S).normalize();
  const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const N0 = _paN.copy(arm.pole).addScaledVector(D, -arm.pole.dot(D));
  if (N0.lengthSq() < 1e-8) { solveArm(arm, pos, quat); return; }
  N0.normalize();
  const elbow = (sw) => _paE.copy(S).addScaledVector(D, a * ca).addScaledVector(_paP.copy(N0).applyQuaternion(_paQ.setFromAxisAngle(D, sw)), a * sa);
  let best = 0, bc = Infinity;
  for (let sw = -1.3; sw <= 1.3001; sw += 0.1) { const c = prElbowCost(arm, S, elbow(sw), pos, quat, sw); if (c < bc) { bc = c; best = sw; } }
  for (const st of [0.05, 0.025]) for (const sw of [best - st, best + st]) { const c = prElbowCost(arm, S, elbow(sw), pos, quat, sw); if (c < bc) { bc = c; best = sw; } }
  arm.psi = arm.psi === undefined ? best : arm.psi + (best - arm.psi) * 0.3;
  const save = _paX.copy(arm.pole);
  arm.pole.copy(N0).applyQuaternion(_paQ.setFromAxisAngle(D, arm.psi));
  solveArm(arm, pos, quat);
  arm.pole.copy(save);
}

/* --------------------------------------------------------------- pièces saisies (rechargements) */
/* Pendant un rechargement, une main saisit une pièce (chargeur, levier d'armement…) : la clé du
   rechargement (rlGrip : place et directions de la main dans le repère de la pièce, nom de pose) donne
   l'approche ; le solveur pose la paume contre la pièce et referme doigts et pouce sur sa vraie forme.
   La clé garde la place corrigée et la pose obtenue (un objet au lieu d'un nom de HAND_POSES). Calculé
   une fois par arme, avec sa prise (prGunHold). */
function prPartTris(part) {
  part.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(part.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), out = [];
  part.traverse((o) => {
    if (!o.isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m); out.push(v.x, v.y, v.z); }
  });
  return new Float32Array(out);
}
/* Maillages d'une pièce dans son propre repère (mesures par rayons, comme prMeshTris). */
function prPartMeshes(part) {
  part.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(part.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), out = [];
  part.traverse((o) => {
    if (!o.isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; }
    out.push(a);
  });
  return out;
}
/* Modèles des pièces saisies (repère de la pièce) :
     chargeur  chargeur droit pris par le flanc gauche, doigts enroulés sur l'avant ; y : hauteur de la paume
               sous l'origine de la pièce (par défaut 4 cm) ;
     levier    bouton ou patte d'armement pincé entre la pulpe de l'index (devant) et celle du pouce
               (derrière) ; out : côté d'où vient la main ([-1, 0, 0] à gauche, [1, 0, 0] à droite, [0, 1, 0]
               dessus) ; le point est l'ancre « knob » de la pièce. */
function prExpandPiece(root, partName, decl) {
  if (!decl || !decl.modele) return decl;
  const part = root.userData.parts[partName], meshes = prPartMeshes(part), V = (x, y, z) => new THREE.Vector3(x, y, z);
  let out;
  if (decl.modele === 'chargeur') {
    const y = decl.y ?? -0.04;
    const sol = prSolid(meshes, V(0, y, -0.15), V(0, 0, 1), 0.3, 0.01), zF = sol ? -0.15 + sol[0] : -0.025;
    const sw = prSolid(meshes, V(-0.08, y, zF + 0.01), V(1, 0, 0), 0.16, 0.005), hw = sw ? 0.08 - sw[0] : 0.0126;
    out = { paume: [-hw, y, zF + 0.039], doigts: [0, -0.12, -1], pouce: [0, 1, 0.1] };
  } else if (decl.modele === 'levier') {
    const kn = root.userData.anchors.knob, K = V(...(decl.point || kn.p)), o = V(...(decl.out || [-1, 0, 0]));
    const up = Math.abs(o.y) > 0.5 ? V(decl.left === false ? -1 : 1, 0, 0) : V(0, 1, 0);
    const sol = prSolid(meshes, V(K.x, K.y, K.z - 0.05), V(0, 0, 1), 0.1, 0.002), zF = sol ? K.z - 0.05 + sol[0] : K.z - 0.008, zB = sol ? K.z - 0.05 + sol[1] : K.z + 0.01;
    const d = o.clone().multiplyScalar(-0.85).add(V(0, 0, -0.5)).addScaledVector(up, 0.1);
    const t = o.clone().multiplyScalar(-0.1).add(V(0, 0, 1)).addScaledVector(up, 0.3);
    const a = K.clone().addScaledVector(o, 0.042).addScaledVector(up, -0.005).add(V(0, 0, 0.016));
    out = { index: a.toArray(), doigts: d.toArray(), pouce: t.toArray(),
      pince: { index: [K.x, K.y, zF - 0.0005], pouce: K.clone().addScaledVector(up, 0.002).setZ(zB + 0.0005).toArray(), face: [0, 0, 1] } };
  }
  const res = Object.assign(out, decl);
  delete res.modele; delete res.y; delete res.out; delete res.point; delete res.left;
  return res;
}
/* Triangles du reste de l'arme (pièces au repos, sauf la pièce et les pièces de rechange), dans le repère de la
   pièce : la main qui saisit un chargeur encore engagé ne doit pas entrer dans le puits ni dans la boîte de
   culasse (jeu 2.0.6, gestes : avant, le solveur ne voyait que la pièce). */
function prBodyTris(root, part) {
  const parts = Object.values(root.userData.parts || {}), saved = parts.map((p) => [p.position.clone(), p.quaternion.clone()]);
  for (const p of parts) { p.position.copy(p.userData.rest); p.quaternion.copy(p.userData.restQ); }
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(part.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let q = o; q && q !== root; q = q.parent) if (q === part || (q.userData && q.userData.spare)) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m); out.push(v.x, v.y, v.z); }
  });
  parts.forEach((p, i) => { p.position.copy(saved[i][0]); p.quaternion.copy(saved[i][1]); });
  root.updateMatrixWorld(true);
  return out;
}
function prFitGrip(root, partName, key, left, decl = null, opts = {}) {
  const part = root.userData.parts[partName];
  if (!part || !key || key._pr) return;
  let T = prPartTris(part);
  if (opts.corps) { const B = prBodyTris(root, part); const A = new Float32Array(T.length + B.length); A.set(T); A.set(B, T.length); T = A; }
  const hand = _prHands[left ? 'L' : 'R'] || (_prHands[left ? 'L' : 'R'] = buildHand(left)), w = hand.wrist;
  const P0 = decl && decl.pince ? HAND_POSES.pinch : typeof key.pose === 'object' ? key.pose : HAND_POSES[key.pose] || HAND_POSES.relax;
  if (decl) {
    // prise déclarée (repère de la pièce) : un repère de la main sur un point, doigts et pouce orientés
    const q = handBasis(_prV(decl.doigts), _prV(decl.pouce), left);
    const an = Object.keys(PR_ANCRES).find((k) => decl[k]), lm = _prV(PR_REP[PR_ANCRES[an]]); if (left) lm.x = -lm.x;
    w.quaternion.copy(q); w.position.copy(_prV(decl[an])).sub(lm.applyQuaternion(q));
    key.d = decl.doigts.slice(); key.u = decl.pouce.slice();
  } else {
    w.position.fromArray(key.p); w.quaternion.copy(handBasis(_prV(key.d), _prV(key.u || [0, 1, 0]), left));
  }
  setHandPose(hand, { f: hand.fingers.map(() => [-0.1, 0.05, 0.036]), s: P0.s, t: [0.6, -0.2, 0, 0, 0] });
  w.updateMatrixWorld(true);
  const c = hand.body.localToWorld(new THREE.Vector3(0, -0.01, -0.06)), G = triGrid(trisNear(T, c, 0.15), c, 0.16);
  const pose = { f: [], s: [], t: P0.t.slice() }, info = {};
  if (decl && decl.pince) {
    // pince : pulpe de l'index et pulpe du pouce sur deux faces de la pièce ; les autres doigts repliés
    setHandPose(hand, P0); w.updateMatrixWorld(true);
    P0.f.forEach((f, i) => { pose.f[i] = f.slice(); pose.s[i] = P0.s[i]; });
    const ti = prIndexOn(G, hand, _prV(decl.pince.index), null, decl.pince.face ? _prV(decl.pince.face) : null);
    if (ti) { pose.f[0] = [ti.m, ti.p, Math.min(PR_LIM.dip, ti.p * ti.kd)]; pose.s[0] = ti.s; info.index = +ti.d.toFixed(4); }
    setHandPose(hand, pose); w.updateMatrixWorld(true);
    const TF = []; for (const f of hand.fingers) objTris(f[0], TF);
    G.next = triGrid(new Float32Array(TF), c, 0.16);
    // pince : pulpe du pouce sur la face arrière de la pièce, en face de l'index (cible serrée, flexion plus libre)
    const th = prThumbPose(G, prPalmGrid(hand, c), hand, null, _prV(decl.pince.pouce), { wT: 150, fmin: 0.35, opp: _prV(decl.pince.index) });
    G.next = null;
    pose.t = th.t; info.pouce = { c: +th.c.toFixed(3), pen: th.pen, contact: th.touch };
  } else {
    if (!decl || decl.contact !== false) info.moved = prSettlePalm(G, hand);
    hand.fingers.forEach((bs, i) => { const b = prWrapFinger(G, bs, HAND.fingers[i], P0.s[i]); pose.f[i] = [b.m, b.p, Math.min(PR_LIM.dip, b.p * PR_LIM.kDip)]; pose.s[i] = b.s; info['d' + i] = b.touch.map(Number).join(''); });
    setHandPose(hand, pose); w.updateMatrixWorld(true);
    const TF = []; for (const f of hand.fingers) objTris(f[0], TF);
    G.next = triGrid(new Float32Array(TF), c, 0.16);
    // chargeur tenu : le pouce se pose sur la pièce en face des doigts (pas de point visé : contact et opposition)
    const th = prThumbPose(G, prPalmGrid(hand, c), hand, null, null, { fmin: 0.4 });
    pose.t = th.t; info.pouce = { pen: th.pen, contact: th.touch };
    G.next = null;
  }
  key.p = w.position.toArray(); key.pose = pose; key._pr = info;
}
/* Pièces saisies du rechargement d'une arme déclarée : chargeur et levier d'armement (échange de chargeur),
   seulement celles dont la prise est déclarée (recharge) ; les autres gardent leur pose de 1.9.0. */
function prFitReload(root) {
  const def = RELOADS[root.userData.id], o = def && def.cfg;
  if (!o || o._pr) return;
  o._pr = true;
  try {
    // jeu 2.0.6, gestes : toutes les armes à chargeur (M1911 compris : la main gauche tient le chargeur neuf),
    // contre le corps de l'arme (puits, boîte de culasse) ; les leviers aussi
    const R = (PRISES[root.userData.id] || {}).recharge || {}, corps = { corps: true };
    if (R.chargeur) prFitGrip(root, 'mag', o.grip, true, prExpandPiece(root, 'mag', R.chargeur), corps);
    if (o.bolt && R.levier) { const left = (o.bolt.side || 'L') === 'L'; prFitGrip(root, o.bolt.part, o.bolt.grip, left, prExpandPiece(root, o.bolt.part, Object.assign({ left }, R.levier)), corps); }
    if (typeof geOpenWeapon === 'function') geOpenWeapon(root);       // prises ouvertes calculées (module H2-gestes.js)
  } catch (e) { console.warn('prise de rechargement', root.userData.id, e); }
}

/* --------------------------------------------------------------- pouce : éminence et commissure (modèle) */
/* Le métacarpien du pouce est noyé dans la paume : on n'en voit que la masse charnue de l'éminence
   thénar, côté paume, et la peau de la commissure qui la relie à l'index, côté dos. Jusqu'au jeu 2.0.6
   (construction 1), il était dessiné comme une phalange libre de 41 mm : un pouce écarté devenait un
   « doigt » de 10 cm qui partait du poignet, droit comme un bâton. Ici, une gaine déformable (repère de la
   base du pouce : −z le long du métacarpien, +x vers le dos, +y vers le dehors, −y vers la paume) recouvre
   le métacarpien et plonge dans la paume : ses points du dehors suivent le pouce, ceux de la paume restent
   en place, ceux d'entre les deux tournent d'une part de l'angle (pas de pincement), et la peau s'étire. */
const PR_GAINE = { z0: 0.012, z1: -0.048, nu: 18, nt: 24, w0: -0.012, w1: 0.01, u0: 0.3, u1: 0.95, niv: 24 };
function prGaineRayons(u) {
  const L = (a, b, t) => a + (b - a) * t;
  return {
    dos: L(0.0150, 0.0110, u), paume: L(0.0140, 0.0118, u), dehors: L(0.0134, 0.0119, u),
    dedans: u < 0.6 ? L(0.021, 0.017, u / 0.6) : L(0.017, 0.0124, (u - 0.6) / 0.4),
  };
}
/* Part du mouvement du pouce que suit un point de la gaine : 1 au dehors, 0 dans la paume ; vers le bout,
   toute la gaine suit (près de l'articulation, le pouce se déplace de 3 cm : une partie fixe s'y replierait). */
function prGainePoids(y, u) {
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const { w0, w1 } = PR_GAINE, wy = sm(w0, w1, y), wu = sm(PR_GAINE.u0, PR_GAINE.u1, u);
  return 1 - (1 - wy) * (1 - wu);
}
function prGaineGeometrie() {
  const { z0, z1, nu, nt, w0, w1 } = PR_GAINE, pos = [], wt = [], idx = [];
  const sc = (u) => (u < 0.12 ? Math.sqrt(Math.sin((u / 0.12) * Math.PI / 2)) : u > 0.82 ? Math.sqrt(Math.max(0, Math.cos(((u - 0.82) / 0.18) * Math.PI / 2))) : 1);
  const push = (x, y, z) => { pos.push(x, y, z); wt.push(prGainePoids(y, (z - z0) / (z1 - z0))); };
  push(0, 0, z0 + 0.002);                                                    // pôle de la base (dans la paume)
  for (let j = 1; j < nu; j++) {
    const u = j / nu, R = prGaineRayons(u), s = sc(u), z = z0 + (z1 - z0) * u;
    for (let k = 0; k < nt; k++) {
      const a = (k / nt) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      push(s * c * (c > 0 ? R.dos : R.paume), s * sn * (sn > 0 ? R.dehors : R.dedans), z);
    }
  }
  push(0, 0, z1);                                                            // pôle du bout (articulation du pouce)
  const ring = (j, k) => 1 + (j - 1) * nt + (k % nt), last = pos.length / 3 - 1;
  for (let k = 0; k < nt; k++) idx.push(0, ring(1, k + 1), ring(1, k));
  for (let j = 1; j < nu - 1; j++) for (let k = 0; k < nt; k++) idx.push(ring(j, k), ring(j, k + 1), ring(j + 1, k + 1), ring(j, k), ring(j + 1, k + 1), ring(j + 1, k));
  for (let k = 0; k < nt; k++) idx.push(last, ring(nu - 1, k), ring(nu - 1, k + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // faces vers l'extérieur : sinon, sens inversé
  const p = g.attributes.position, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), i0 = 6 * nt + 3 * nt;
  A.fromBufferAttribute(p, idx[i0]); B.fromBufferAttribute(p, idx[i0 + 1]); C.fromBufferAttribute(p, idx[i0 + 2]);
  const n = B.clone().sub(A).cross(C.clone().sub(A)), mid = A.clone().add(B).add(C).multiplyScalar(1 / 3);
  if (n.dot(new THREE.Vector3(mid.x, mid.y, 0)) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); }
  g.computeVertexNormals();
  return { g, rest: new Float32Array(pos), w: new Float32Array(wt) };
}
/* Gaine d'une main (enfant de la base du pouce t0 ; géométrie propre à la main, déformée par prMajGaine). */
function prGaine(hand, t0, mat) {
  const G = prGaineGeometrie(), m = new THREE.Mesh(G.g, mat);
  m.frustumCulled = false;
  t0.add(m);
  hand.gaine = { mesh: m, rest: G.rest, w: G.w, q: new THREE.Quaternion(), qi: new THREE.Quaternion(), M: [], key: '' };
  prMajGaine(hand);
}
const _pgV = new THREE.Vector3(), _pgQ = new THREE.Quaternion(), _pgI = new THREE.Quaternion();
function prMajGaine(hand) {
  const S = hand.gaine;
  if (!S) return;
  const q = hand.thumb[0].quaternion, key = q.x.toFixed(5) + q.y.toFixed(5) + q.z.toFixed(5) + q.w.toFixed(5);
  if (key === S.key) return;
  S.key = key;
  const N = PR_GAINE.niv, mats = S.M;
  for (let l = 0; l <= N; l++) { _pgQ.copy(_pgI).slerp(q, l / N); (mats[l] || (mats[l] = new THREE.Matrix4())).makeRotationFromQuaternion(_pgQ); }
  const P = S.mesh.geometry.attributes.position, r = S.rest, w = S.w;
  for (let i = 0, n = w.length; i < n; i++) {
    _pgV.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]).applyMatrix4(mats[Math.round(w[i] * N)]);
    P.setXYZ(i, _pgV.x, _pgV.y, _pgV.z);
  }
  P.needsUpdate = true;
  S.mesh.geometry.computeVertexNormals();
  S.mesh.geometry.computeBoundingSphere();
}
