/* ========================================================================== 41 LE VISIONNAIRE ==
   Sixième easter egg secondaire de Bunker 7 (demande d'Anthony du 10 novembre 2026, pour le jeu 2.0.7), très très rare :
   un zombie hors du concept de Bunker 7, « Le Momifié » (sa fiche N°00-G : bandelettes de la tête aux pieds, collier d'or
   volé, yeux jaunes), apparaît au hasard, à n'importe quelle manche. C'est un zombie normal : points de vie de la manche,
   vitesse, attaques et points comme un Fantassin ; seule l'apparence change. Une seule fois par partie (sauvegarde
   comprise), 0,01 % de chance à chaque zombie qui sort. Tué : un portail de sable s'ouvre à son cadavre, de 1,80 m de
   haut, pour 10 s ; seul celui qui l'a tué peut y entrer. Dedans : une hallucination, un désert sans fin sous le Khamsin
   (étape 2) ; à la mort, le joueur se réveille à la place exacte du portail, comme avant d'y entrer.
   · Choix d'Anthony (10 novembre 2026) : désert construit dans Bunker 7 (option A) ; 0,01 % par zombie, une fois par
     partie ; règles d'un zombie normal ; portail de 10 s pour le tueur ; Bunker 7 figé pendant l'hallucination ; rien
     de ce qui s'y passe ne compte (PV, munitions, points, atouts, Quick Revive et ses relèves restent comme avant) ; aucune
     récompense ; écran « Secrets » : b7-visionnaire, « Visionnaire ».
   · Seulement sur Bunker 7 ; pas pendant le combat du boss. Essais : VS.force = true (le prochain zombie est le Momifié).
   Points d'accroche : tools/hooks-visionnaire.py.
   ============================================================================ */
const VS = {
  chance: 0.0001,                              // 0,01 % à chaque zombie qui sort
  vie: 10,                                     // s : durée du portail
  ouverture: 0.6, fermeture: 0.8,              // s : le portail grandit, puis se referme
  haut: 1.8, large: 1.15,                      // m : du sol à la taille du joueur
  rayon: 0.55,                                 // m : distance au centre pour y entrer
  fait: false,                                 // le Momifié est sorti pendant cette partie (sauvegardé)
  force: false,                                // essais : le prochain zombie est le Momifié
  relance: false,                              // le Momifié a été retiré vivant (bloqué, loin) : il ressortira
  momie: null, portail: null, on: false, compile: false, entree: null, reveil: null, sortie: null, I: null, d: null,
  mat: null, matGrains: null, matHalo: null, son: null,
};
const VS_TYPE = {
  id: 'momifie', num: '00-G', name: 'Le Momifié', cls: 'Variante du Fantassin', from: 1, model: 'momifie', facts: 'variant', maps: null,
  mult: { hp: 1, speed: 1, damage: 1 }, headMult: 2, helmet: false, ability: 'Horde',
};
const vsIci = () => !!CUR.map && CUR.map.id === BUNKER7.id && !CUR.editor && !OW.on;

/* ---- Le Momifié : modèle (pièces des os du squelette du Fantassin, comme ses variantes) ; palette de la fiche */
const VS_K = (C) => ({
  ...zCommonK(C),
  lin: C(0xcdbf9c), linL: C(0xdccfae), linD: C(0xa89a78), linS: C(0x8f7a55), tache: C(0x6e5a3a),
  skin: C(0x8a9580, 1.0), skinD: C(0x55604c, 1.0), claw: C(0x2a2620),
  belt: C(0x1f1a16), boot: C(0x5a4030), bootD: C(0x3a2a1e), sole: C(0x1a120c),
  or: C(0xd4a73a, 1.0), orD: C(0xa07a22, 1.0), lapis: C(0x2f5aab, 1.0), turq: C(0x3fa8ad, 1.0), rouge: C(0xb4482a, 1.0),
  bouche: C(0x120a06), orbite: C(0x0a0806),
});
function vsGeometries() {
  const k = zKit(), { C, V, box, cyl, ell, tor, seg, on } = k, H = ZRIG.head, K = VS_K(C);
  const merge = (o) => { const out = {}; for (const key in o) out[key] = mergeGeometries(o[key]); return out; };
  const nuance = (i) => (i % 3 === 0 ? K.linL : i % 3 === 1 ? K.lin : K.linD);
  // bandes autour d'un membre (cylindre de rayon r0 → r1 de y0 à y1) : anneaux un peu en relief, inclinés
  const bandes = (out, r0, r1, y0, y1, n, sz = 1, phase = 0) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, y = lerp(y0, y1, t), r = lerp(r0, r1, t) + 0.004;
      out.push(cyl(r, r, Math.abs(y1 - y0) / n * 0.62, 0, y, 0, nuance(i + phase), sz, 0, 0, ((i + phase) % 2 ? 1 : -1) * 0.16, 12));
    }
  };
  /* ---- buste, hanches, ceinture, bouts de bandelettes */
  const R1 = (y) => lerp(0.2, 0.22, clamp((y - 0.06) / 0.42, 0, 1)), BELT = 0.209;
  const T = [
    cyl(0.22, 0.2, 0.42, 0, 0.27, 0, K.lin, 0.6, 0, 0, 0, 14),
    ell(0.24, 0.088, 0.135, 0, 0.45, 0, K.lin, 0, 0, 0, 14, 8),
    cyl(0.2, 0.212, 0.2, 0, -0.07, 0, K.linD, 0.64, 0, 0, 0, 14),
    cyl(0.075, 0.09, 0.07, 0, 0.505, 0.005, K.lin, 0.92),
    cyl(BELT, BELT, 0.05, 0, 0.035, 0, K.belt, 0.645, 0, 0, 0, 16),
  ];
  for (let i = 0; i < 6; i++) {
    const y = 0.09 + i * 0.058, r = R1(y) + 0.005;
    T.push(cyl(r, r, 0.034, 0, y, 0, nuance(i), 0.6, 0, 0, (i % 2 ? 1 : -1) * 0.1, 14));
  }
  for (let i = 0; i < 3; i++) {
    const y = -0.03 - i * 0.055, r = lerp(0.2, 0.212, (i + 1) / 4) + 0.005;
    T.push(cyl(r, r, 0.032, 0, y, 0, nuance(i + 1), 0.64, 0, 0, (i % 2 ? -1 : 1) * 0.12, 14));
  }
  // taches (sable, vieux sang) sur le lin
  for (const [x, y, a, c] of [[0.1, 0.3, 0.03, K.linS], [-0.12, 0.18, 0.024, K.tache], [0.05, 0.12, 0.018, K.linS], [-0.06, 0.36, 0.02, K.linS], [0.14, -0.08, 0.026, K.tache]]) {
    const p = y > 0.06 ? on(x, R1(y), 0.6, 0.008) : on(x, 0.212, 0.64, 0.008);
    T.push(ell(a, a * 0.8, 0.005, p.x, y, p.z, c, 0, p.ry, 0.3, 8, 5));
  }
  // bouts libres qui pendent : devant à gauche, derrière à droite
  { const p = on(0.12, BELT, 0.645, 0.012);
    T.push(box(0.034, 0.2, 0.005, p.x, -0.075, p.z, K.linD, 0.05, p.ry, 0.12), box(0.028, 0.12, 0.005, p.x + 0.03, -0.22, p.z + 0.004, K.lin, 0.12, p.ry, -0.1));
    const q = on(-0.1, BELT, 0.645, 0.012);
    T.push(box(0.032, 0.24, 0.005, q.x, -0.09, -q.z, K.linD, -0.06, -q.ry, -0.08)); }

  /* ---- collier d'or (usekh) : rangs d'or, de lapis, de turquoise et de perles rouges, sur la poitrine et les épaules */
  const col = [];
  const surfZ = (x, y) => {
    const ch = y <= 0.47 ? on(x, R1(Math.min(y, 0.48)), 0.6).z : 0;
    const u = 1 - (x / 0.24) ** 2 - ((y - 0.45) / 0.088) ** 2;
    return Math.max(ch, u > 0 ? 0.135 * Math.sqrt(u) : 0);
  };
  const cy = 0.53;
  const rangs = [[0.07, K.or, 0.02], [0.092, K.lapis, 0.022], [0.112, K.or, 0.014], [0.131, K.turq, 0.02], [0.15, K.or, 0.012]];
  for (const [r, c, w] of rangs) {
    const n = 22;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const a = lerp(-1.45, 1.45, i / n), x = Math.sin(a) * r * 1.25, y = cy - Math.cos(a) * r;
      const p = V(x, y, surfZ(x, y) + 0.009);
      if (prev) col.push(seg(prev, p, c, w, 0.007));
      prev = p;
    }
  }
  // perles rouges et gouttes d'or au bord du collier
  for (let i = 0; i <= 14; i++) {
    const a = lerp(-1.35, 1.35, i / 14), r = 0.166, x = Math.sin(a) * r * 1.25, y = cy - Math.cos(a) * r, z = surfZ(x, y) + 0.01;
    col.push(ell(0.009, 0.012, 0.007, x, y, z, i % 2 ? K.rouge : K.or, 0, 0, 0, 6, 4));
    if (i % 2 === 0) col.push(ell(0.006, 0.013, 0.005, x * 1.02, y - 0.02, z + 0.001, K.orD, 0, 0, 0, 6, 4));
  }
  // dos du collier : un rang d'or autour de la base du cou
  col.push(cyl(0.083, 0.088, 0.016, 0, 0.535, 0.002, K.or, 0.92, 0, 0, 0, 14));
  // boucle d'or de la ceinture
  { const p = on(0, BELT, 0.645, 0.006); col.push(box(0.06, 0.05, 0.012, 0, 0.035, p.z, K.or), box(0.034, 0.026, 0.006, 0, 0.035, p.z + 0.007, K.belt)); }

  /* ---- tête bandée : bouche ouverte et dents, orbites sombres (les yeux brillent à part) */
  const head = [
    cyl(0.05, 0.058, 0.13, 0, 0.02, 0, K.lin),
    ell(0.098, 0.12, 0.108, 0, H, 0.004, K.lin, 0, 0, 0, 14, 10),
    ell(0.07, 0.036, 0.068, 0, H - 0.11, 0.028, K.linD, 0.28),
    ell(0.044, 0.032, 0.016, 0, H - 0.08, 0.088, K.bouche),
    ell(0.036, 0.028, 0.018, -0.04, H - 0.004, 0.097, K.orbite),
    ell(0.036, 0.028, 0.018, 0.04, H - 0.004, 0.097, K.orbite),
    ell(0.012, 0.028, 0.02, -0.098, H - 0.012, -0.01, K.lin), ell(0.012, 0.028, 0.02, 0.098, H - 0.012, -0.01, K.lin),
  ];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.0115;
    head.push(box(0.0098, 0.016, 0.008, x, H - 0.066, 0.099 - Math.abs(x) * 0.25, K.teeth));
    head.push(box(0.0098, 0.014, 0.008, x * 0.92, H - 0.098, 0.096 - Math.abs(x) * 0.25, K.teeth, 0.2));
  }
  // bandes du crâne : anneaux inclinés, au-dessus et au-dessous des yeux, en croix sur le front
  for (const [dy, rx, c] of [[0.085, 0.1, K.linL], [0.05, -0.14, K.lin], [0.032, 0.2, K.linD], [-0.045, -0.12, K.linL], [-0.07, 0.16, K.lin], [-0.12, 0.3, K.linD]]) {
    const y = H + dy, f = Math.sqrt(Math.max(0.05, 1 - (dy / 0.12) ** 2));
    head.push(tor(1, 0.07, 0, y, 0.004, c, Math.PI / 2 + rx, 0, 0, 0.1 * f, 0.11 * f, 0.13));
  }
  head.push(seg(V(-0.03, H + 0.11, 0.07), V(0.06, H + 0.02, 0.1), K.linD, 0.026, 0.006), seg(V(0.07, H + 0.1, 0.06), V(-0.02, H + 0.03, 0.105), K.lin, 0.022, 0.006));
  head.push(ell(0.016, 0.02, 0.004, 0.05, H - 0.05, 0.095, K.tache, 0, 0.4, 0, 7, 5));
  const eyes = [ell(0.025, 0.019, 0.006, -0.04, H - 0.004, 0.109, null, 0, 0, 0, 12, 7), ell(0.025, 0.019, 0.006, 0.04, H - 0.004, 0.109, null, 0, 0, 0, 12, 7)];

  /* ---- bras bandés, mains griffues grises */
  const upper = [ell(0.07, 0.066, 0.07, 0, -0.005, 0, K.lin), cyl(0.064, 0.056, 0.31, 0, -0.155, 0, K.lin)];
  bandes(upper, 0.064, 0.056, -0.02, -0.3, 5);
  const fore = [cyl(0.056, 0.044, 0.25, 0, -0.12, 0, K.lin)];
  bandes(fore, 0.056, 0.044, -0.01, -0.245, 4, 1, 1);
  fore.push(...zClawHand(k, K, -0.3));
  fore.push(box(0.022, 0.16, 0.004, 0.03, -0.33, -0.04, K.linD, 0.25, 0, 0.15));   // bout libre au poignet

  /* ---- jambes bandées, bottes brunes */
  const thigh = [ell(0.098, 0.12, 0.092, 0, -0.13, 0, K.linD), cyl(0.09, 0.068, 0.44, 0, -0.22, 0, K.lin)];
  bandes(thigh, 0.09, 0.068, -0.04, -0.43, 6, 1, 2);
  const shin = [cyl(0.07, 0.062, 0.3, 0, -0.15, 0, K.lin)];
  bandes(shin, 0.07, 0.062, -0.01, -0.28, 4, 1, 1);
  shin.push(cyl(0.068, 0.07, 0.11, 0, -0.33, 0, K.boot), box(0.1, 0.07, 0.24, 0, -0.4, 0.045, K.boot), ell(0.05, 0.036, 0.052, 0, -0.405, 0.158, K.boot),
    box(0.105, 0.018, 0.262, 0, -0.432, 0.048, K.sole), box(0.1, 0.028, 0.07, 0, -0.418, -0.055, K.sole), cyl(0.072, 0.072, 0.016, 0, -0.282, 0, K.bootD));

  const G = merge({ torso: T, collar: col, head, eyes, upper, fore, thigh, shin });
  Object.assign(G, zStumps(k, { ...K, flesh: C(0x7a2a22), fleshD: C(0x3a0d0a) }, K.lin, K.lin));
  return G;
}
ZPARTS.momifie = [
  { geo: 'torso', bone: 'hips', mat: 'zCloth', tint: 'cloth' },
  { geo: 'collar', bone: 'hips', mat: 'zHelmet', tint: 'white' },
  { geo: 'head', bone: 'neck', mat: 'zCloth', tint: 'cloth', head: true },
  { geo: 'eyes', bone: 'neck', mat: 'zEyes', tint: 'eyes', head: true },
  { geo: 'upper', bone: 'sh', mat: 'zCloth', tint: 'cloth' },
  { geo: 'fore', bone: 'el', mat: 'zCloth', tint: 'cloth' },
  { geo: 'thigh', bone: 'hip', mat: 'zCloth', tint: 'cloth' },
  { geo: 'shin', bone: 'kn', mat: 'zCloth', tint: 'cloth', legs: true },
  { geo: 'stump', bone: 'kn', mat: 'zSkin', tint: 'skin', stump: true },
  { geo: 'armStump', bone: 'sh', mat: 'zSkin', tint: 'skin', stump: 'arm' },
];
Object.defineProperty(ZVGEO, 'momifie', { configurable: true, enumerable: true, get() { const g = vsGeometries(); Object.defineProperty(ZVGEO, 'momifie', { value: g, writable: true, enumerable: true }); return g; } });

/* ------------------------------------------------------------- Apparition --- */
/* spawnZombie : le type tiré pour la pièce, ou le Momifié (une fois par partie, 0,01 %). */
function vsType(t) {
  if (!vsIci() || VS.momie || VS.on || G.state !== 'playing') return t;
  if (typeof B7 === 'object' && B7.actif) return t;                 // pas pendant le combat du boss
  if (!VS.force && !VS.relance && (VS.fait || Math.random() >= VS.chance)) return t;
  VS.fait = true; VS.force = false; VS.relance = false;
  return VS_TYPE;
}
/* Ses couleurs sont celles de la fiche, sans les nuances d'un Fantassin à l'autre ; yeux jaunes (matière des yeux). */
function vsLook(look) {
  look.skin = 0xffffff; look.cloth = 0xffffff; look.eyes = 0xffffff; look.helmet = false;
  return look;
}
function vsNe(z) {
  z.vsMomie = true; VS.momie = z;
  vsPrecompiler();                             // le portail et le désert : compilés tout de suite, pas à l'ouverture
}
/* Retiré vivant (bloqué, trop loin : recycleZombie) : il ressortira au prochain zombie. */
function vsPerdu(z) {
  if (VS.momie !== z) return;
  VS.momie = null; VS.relance = true;
}
/* Tué : le portail s'ouvre au cadavre (onZombieKilled ; en solo, le tueur est le joueur). */
function vsTue(z, info) {
  if (VS.momie !== z) return;
  VS.momie = null;
  if (typeof secretDecouvert === 'function') secretDecouvert('b7-visionnaire');   // écran « Secrets » de l'Interface (2.0.7)
  vsOuvrir(z.pos.x, z.pos.z, z.gy, 'j1');
}

/* ---------------------------------------------------------------- Portail --- */
const VS_VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const VS_FRAG = `uniform float uT, uA;
uniform vec3 uSable, uClair, uFond;
varying vec2 vUv;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float sw = a * 3.0 + uT * 2.6 + 2.2 / (r + 0.12);          // trois bras qui s'enroulent vers le centre
  float n = bruit(vec2(sw * 1.3, r * 7.0 - uT * 4.0)) + 0.5 * bruit(vec2(sw * 2.7 + 5.0, r * 13.0 - uT * 6.0));
  float bras = 0.5 + 0.5 * sin(sw + n * 2.2);
  float bord = smoothstep(1.0, 0.86, r);
  float rive = smoothstep(0.55, 0.92, r) * bord;
  vec3 col = mix(uFond, uSable, smoothstep(0.05, 0.85, r) * (0.45 + 0.55 * bras));
  col = mix(col, uClair, rive * (0.35 + 0.65 * bras) * 0.8);
  float alpha = bord * (0.72 + 0.28 * bras) * uA;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
const _vsC = (h) => new THREE.Color(h).convertSRGBToLinear();
function vsMatieres() {
  if (VS.mat) return;
  VS.mat = share(new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uSable: { value: _vsC(0xc8954e) }, uClair: { value: _vsC(0xf6dca4) }, uFond: { value: _vsC(0x2a170a) } },
    vertexShader: VS_VERT, fragmentShader: VS_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  VS.matGrains = share(new THREE.PointsMaterial({ color: _vsC(0xe8c48a), size: 0.05, map: TEX.glow, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  VS.matHalo = share(new THREE.SpriteMaterial({ map: TEX.glow, color: _vsC(0xd9a75e), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  for (const m of [VS.mat, VS.matGrains, VS.matHalo]) _linDone.add(m);
}
const VS_GRAINS = 90;
function vsConstruirePortail() {
  vsMatieres();
  const g = new THREE.Group(); g.name = 'visionnaire-portail';
  const pivot = new THREE.Group(); g.add(pivot);                     // tourné vers la caméra (lacet seulement)
  const disque = new THREE.Mesh(new THREE.PlaneGeometry(VS.large, VS.haut), VS.mat);
  disque.position.y = VS.haut / 2; disque.renderOrder = 3; pivot.add(disque);
  const halo = new THREE.Sprite(VS.matHalo); halo.scale.set(VS.large * 2.2, VS.haut * 1.5, 1); halo.position.y = VS.haut / 2; halo.renderOrder = 2; pivot.add(halo);
  const pos = new Float32Array(VS_GRAINS * 3), gr = [];
  for (let i = 0; i < VS_GRAINS; i++) gr.push({ a: rand(0, TAU), r: rand(0.2, 1.4), v: rand(0.5, 1.1), z: rand(-0.08, 0.08) });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const grains = new THREE.Points(geo, VS.matGrains); grains.frustumCulled = false; grains.renderOrder = 4; pivot.add(grains);
  return { g, pivot, disque, halo, grains, gr };
}
/* Ouvre le portail au sol (x, z, gy) ; tueur : le joueur qui peut y entrer. */
function vsOuvrir(x, z, gy, tueur) {
  vsFermer(true);
  const P = vsConstruirePortail();
  P.g.position.set(x, gy, z); P.g.scale.setScalar(0.001);
  scene.add(P.g);
  VS.portail = Object.assign(P, { x, z, gy, t: 0, tueur, ferme: false });
  owSandBurst(x, z, gy);
  spawnPuff(x, gy + 0.5, z, 1.2, 1.2, 0xc09060, 0.5, 0.5);
  vsSonPortail(true);
}
function vsFermer(vite) {
  const P = VS.portail;
  if (!P) return;
  VS.portail = null;
  if (P.g.parent) P.g.parent.remove(P.g);
  P.disque.geometry.dispose(); P.grains.geometry.dispose();
  vsSonPortail(false, vite);
}
/* Chaque image (updateFeatures) : le portail tourne, aspire le sable, se referme après 10 s ; le tueur y entre. */
function vsMaj(dt) {
  vsEntreeMaj(dt);
  vsSortieMaj(dt);
  const P = VS.portail;
  if (!P) return;
  P.t += dt;
  const t = P.t, reste = VS.vie - t;
  if (reste <= 0) { vsFermer(); return; }
  const k = t < VS.ouverture ? smooth(t / VS.ouverture) : reste < VS.fermeture ? smooth(reste / VS.fermeture) : 1;
  P.g.scale.set(Math.max(0.001, k), Math.max(0.001, k), Math.max(0.001, k));
  P.pivot.rotation.y = Math.atan2(camera.position.x - P.x, camera.position.z - P.z);
  VS.mat.uniforms.uT.value = t; VS.mat.uniforms.uA.value = Math.min(1, k * 1.2);
  VS.matHalo.opacity = 0.4 * k * (0.85 + 0.15 * Math.sin(t * 5.3));
  // grains de sable : ils tournent et tombent vers le centre, puis repartent du bord
  const a = P.grains.geometry.attributes.position, arr = a.array, cy = VS.haut / 2;
  for (let i = 0; i < P.gr.length; i++) {
    const q = P.gr[i];
    q.a += dt * (1.6 + 1.6 / (q.r + 0.2)) * q.v; q.r -= dt * 0.35 * q.v;
    if (q.r < 0.06) { q.r = rand(0.9, 1.45); q.a = rand(0, TAU); }
    arr[i * 3] = Math.cos(q.a) * q.r * VS.large * 0.5; arr[i * 3 + 1] = cy + Math.sin(q.a) * q.r * VS.haut * 0.5; arr[i * 3 + 2] = q.z;
  }
  a.needsUpdate = true;
  if (OW.sandFX) OW.sandFX.update(dt);
  if (Math.random() < dt * 6) spawnPuff(P.x + rand(-0.4, 0.4), P.gy + 0.08, P.z + rand(-0.4, 0.4), rand(0.3, 0.5), rand(0.7, 1.1), 0xb88a5a, 0.35, 0.15);
  vsSonMaj();
  // entrée : le tueur, debout, au centre du portail, une fois ouvert
  if (t > VS.ouverture * 0.6 && P.tueur === 'j1' && !VS.entree && !VS.on && !player.down && G.state === 'playing' && Math.abs(player.gy - P.gy) < 1
    && Math.hypot(player.pos.x - P.x, player.pos.z - P.z) < VS.rayon) vsEntrer(P);
}

/* ------------------------------------------------------------------- Sons --- */
/* Souffle continu du portail : bruit filtré qui « tourne », plus fort près de lui (bus des effets du jeu). */
function vsSonPortail(on, vite) {
  const bus = Sound.bus && Sound.bus();
  if (!bus) return;
  const ctx = bus.ctx, t = ctx.currentTime;
  if (!on) {
    const s = VS.son; VS.son = null;
    if (!s) return;
    try { s.g.gain.cancelScheduledValues(t); s.g.gain.setValueAtTime(Math.max(0.0001, s.g.gain.value), t); s.g.gain.exponentialRampToValueAtTime(0.0001, t + (vite ? 0.15 : 0.9)); s.src.stop(t + 1.2); } catch (e) { /* rien */ }
    return;
  }
  vsSonPortail(false, true);
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }   // bruit brun
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 1.4;
  const g = ctx.createGain(); g.gain.value = 0.0001;
  src.connect(f); f.connect(g); g.connect(bus.sortie); src.start(t);
  VS.son = { src, f, g };
  const S = Sound.synthe && Sound.synthe();
  if (S) { const o = S.out(null, 0.35); if (o) { S.noiseHit(t, 1.2, 0.5, 'bandpass', 300, 1400, 1.2, o, 0.15); S.tone('sine', 70, 110, t, 1.0, 0.25, o, 0.2); } }
}
function vsSonMaj() {
  const s = VS.son, P = VS.portail;
  if (!s || !P) return;
  const ctx = s.g.context, t = ctx.currentTime, d = Math.hypot(player.pos.x - P.x, player.pos.z - P.z);
  const k = P.t < VS.ouverture ? P.t / VS.ouverture : Math.min(1, (VS.vie - P.t) / VS.fermeture);
  const v = (G.state === 'playing' ? 0.22 : 0) * clamp(k, 0, 1) / (1 + Math.pow(Math.max(0, d - 1) / 5, 1.6));
  s.g.gain.setTargetAtTime(Math.max(0.0001, v), t, 0.08);
  s.f.frequency.setTargetAtTime(380 + 160 * Math.sin(P.t * 2.1) + 120 * Math.sin(P.t * 5.3), t, 0.05);
}

/* ------------------------------------------------------------ Compilation --- */
/* Matières du portail (et du désert, étape 2) compilées à la sortie du Momifié : pas de gel à l'ouverture. */
function vsPrecompiler() {
  if (VS.compile || G.state !== 'playing') return;
  VS.compile = true;
  const dbg = renderer.debug.checkShaderErrors;
  renderer.debug.checkShaderErrors = false;
  const P = vsConstruirePortail();
  P.g.position.set(camera.position.x, -500, camera.position.z);
  scene.add(P.g);
  // le désert (sable, mirage), le sable qui file, les grains, les yeux, les Desséchés et les Rôdeurs (pièces cachées)
  const D = vsPreparer();
  scene.add(D.root);
  owSandPool();
  if (!KHS.streaks) KHS.streaks = khMakeStreaks();
  const traits = KHS.streaks.mesh.visible; KHS.streaks.mesh.visible = true;
  khEyes(); const yeux = KHE.pts.visible; KHE.pts.visible = true;
  const caches = ZR.parts.filter((m) => !m.visible); for (const m of caches) m.visible = true;
  try {
    if (typeof b7LampesEgaliser === 'function') b7LampesEgaliser(true);
    renderer.compile(scene, camera);
  } catch (e) { console.error('[visionnaire] compilation d\'avance', e); }
  finally {
    scene.remove(P.g); P.disque.geometry.dispose(); P.grains.geometry.dispose();
    scene.remove(D.root); KHS.streaks.mesh.visible = traits; KHE.pts.visible = yeux;
    for (const m of caches) m.visible = false;
    renderer.debug.checkShaderErrors = dbg;
  }
}

/* -------------------------------------------------------- Hallucination --- */
/* Le désert : construit loin de la grille de Bunker 7 (hors de vue et hors de ses cases), dans la même scène. Sa propre
   physique (VS.on : sol, corps, rayons, lignes de vue ; points d'accroche), un sol défini partout : il ne finit jamais.
   Bunker 7 reste tel quel, figé : ses zombies sont mis de côté, ses manches, machines et minuteries ne tournent pas. */
const VSD = {
  ox: 9000, oz: 9000,                          // m : origine du désert (la grille de Bunker 7 tient dans 0–160 m)
  taille: 240, pas: 2,                         // m : terrain dessiné autour du joueur, refait quand il s'éloigne de 24 m
  lv: 2.35,                                    // niveau du Khamsin (KHS_LV : entre « Tempête » et « Khamsin »), en rafales
  zMin: 8, zMax: 26, zPas: 8,                  // zombies à la fois : 8, un de plus toutes les 8 s, 26 au plus
  zDist: [16, 30],                             // m : ils sortent du sable à cette distance du joueur
  rMax: [2, 3], rPas: 60, rDist: [14, 24],     // Rôdeurs à la fois (3 après 60 s), à cette distance
  sprint: [5.4, 6.2],                          // m/s : Desséchés en super-sprint (demande d'Anthony du 10 novembre 2026) ;
                                               // plus vite que le joueur qui marche, un peu moins qu'au sprint
  entree: 0.45, sortie: 1.4,                   // s : voile de sable à l'entrée, voile au réveil
  vision: 0.9,                                 // s : le voile se lève sur le désert
};
const _vsN = new THREE.Vector3();
/* Sol du désert : longues dunes à crête, houle plus courte, bruit (défini partout : le désert ne finit pas). */
function vsSol(x, z) {
  const c = 1 - Math.abs(Math.sin(x * 0.035 + 1.2 * Math.sin(z * 0.02)));
  return 3.4 * c * c + 0.7 * Math.sin(x * 0.06 + z * 0.045) + 1.4 * (owNoise(x * 0.03, z * 0.03) - 0.5);
}
function vsNormale(x, z, out = _vsN) {
  const e = 0.5;
  return out.set(vsSol(x - e, z) - vsSol(x + e, z), 2 * e, vsSol(x, z - e) - vsSol(x, z + e)).normalize();
}
/* ---- physique (appelée par les fonctions de la grille quand VS.on) */
function vsPoser(b) { b.k = -1; b.layer = 0; b.gy = vsSol(b.pos.x, b.pos.z); }
function vsRayon(ox, oy, oz, dx, dy, dz, maxT) {
  RAY.hit = false; RAY.cell = -1; RAY.type = 0;
  let t0 = 0, h0 = oy - vsSol(ox, oz);
  if (h0 < 0) { RAY.hit = true; RAY.t = 0; RAY.x = ox; RAY.y = oy; RAY.z = oz; RAY.nx = 0; RAY.ny = 1; RAY.nz = 0; RAY.type = 16; return RAY; }
  const pas = 0.5;
  for (let t = pas; t <= maxT + pas; t += pas) {
    const tt = Math.min(t, maxT), x = ox + dx * tt, y = oy + dy * tt, z = oz + dz * tt, h = y - vsSol(x, z);
    if (h < 0) {
      // affinage entre les deux pas
      let a = t0, b = tt;
      for (let i = 0; i < 6; i++) { const m = (a + b) / 2; if (oy + dy * m - vsSol(ox + dx * m, oz + dz * m) < 0) b = m; else a = m; }
      const n = vsNormale(ox + dx * b, oz + dz * b);
      RAY.hit = true; RAY.t = b; RAY.x = ox + dx * b; RAY.y = oy + dy * b; RAY.z = oz + dz * b; RAY.nx = n.x; RAY.ny = n.y; RAY.nz = n.z; RAY.type = 16;
      return RAY;
    }
    if (tt >= maxT) break;
    t0 = tt; h0 = h;
  }
  RAY.t = maxT;
  return RAY;
}

/* ---- terrain dessiné : une grille qui suit le joueur (couleurs du sable de Khamsin, relief ombré d'avance) */
function vsTerrain(px = player.pos.x, pz = player.pos.z) {
  const D = VS.d, n = Math.round(VSD.taille / VSD.pas) + 1;
  if (!D.sol) {
    const geo = new THREE.BufferGeometry(), idx = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i; idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1); }
    geo.setIndex(idx);
    for (const [nom, k] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2]]) geo.setAttribute(nom, new THREE.BufferAttribute(new Float32Array(n * n * k), k));
    const mat = share(new THREE.MeshStandardMaterial({ vertexColors: true, map: owTextures().sand, roughness: 0.96, metalness: 0 }));
    _linDone.add(mat);
    D.sol = new THREE.Mesh(geo, mat); D.sol.frustumCulled = false; D.sol.name = 'visionnaire-sable';
    D.root.add(D.sol);
  }
  const cx = Math.round(px / VSD.pas) * VSD.pas, cz = Math.round(pz / VSD.pas) * VSD.pas, h = VSD.taille / 2;
  D.cx = cx; D.cz = cz; D.sol.position.set(cx, 0, cz);
  const g = D.sol.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array, U = g.attributes.uv.array;
  const sable = _vsC(0xe5b685), sombre = _vsC(0xc99662), c = new THREE.Color(), L = new THREE.Vector3(0.55, 0.5, 0.3).normalize();
  for (let j = 0, v = 0; j < n; j++) for (let i = 0; i < n; i++, v++) {
    const lx = -h + i * VSD.pas, lz = -h + j * VSD.pas, x = cx + lx, z = cz + lz, y = vsSol(x, z), nn = vsNormale(x, z);
    P[v * 3] = lx; P[v * 3 + 1] = y; P[v * 3 + 2] = lz;
    N[v * 3] = nn.x; N[v * 3 + 1] = nn.y; N[v * 3 + 2] = nn.z;
    const k = owNoise(x * 0.05 + 3.1, z * 0.05 - 7.7), o = 0.62 + 0.5 * Math.max(0, nn.dot(L));
    c.copy(sable).lerp(sombre, clamp(k * 1.3 - 0.15, 0, 1)).multiplyScalar(o);
    C[v * 3] = c.r; C[v * 3 + 1] = c.g; C[v * 3 + 2] = c.b;
    U[v * 2] = (x - VSD.ox) / 8; U[v * 2 + 1] = (z - VSD.oz) / 8;
  }
  for (const a of ['position', 'normal', 'color', 'uv']) g.attributes[a].needsUpdate = true;
  g.computeBoundingSphere();
}
/* ---- mirage : les pyramides de Khamsin, au loin dans la tempête ; elles reculent quand on avance (la boucle sans fin) */
function vsMirage() {
  const D = VS.d, g = new THREE.Group(); g.name = 'visionnaire-mirage';
  const mat = share(new THREE.MeshBasicMaterial({ color: _vsC(0x5a2a12), transparent: true, opacity: 0, depthWrite: false, fog: false }));
  _linDone.add(mat);
  for (const [dx, dz, s, hh] of [[0, 0, 46, 30], [-38, 22, 38, 25], [-66, 40, 20, 13]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(s / Math.SQRT2, hh, 4, 1), mat);
    m.position.set(dx, hh / 2 - 4, dz); m.rotation.y = Math.PI / 4; g.add(m);
  }
  g.scale.setScalar(0.55); g.renderOrder = -1;
  D.mirage = g; D.mirageMat = mat; D.root.add(g);
}

/* Le désert, construit une fois (gardé d'une partie à l'autre). */
function vsPreparer() {
  const D = VS.d || (VS.d = { root: null, sol: null, cx: VSD.ox, cz: VSD.oz });
  if (!D.root) { D.root = new THREE.Group(); D.root.name = 'visionnaire-desert'; vsMirage(); vsTerrain(VSD.ox, VSD.oz); }
  return D;
}
/* ---- l'instant du portail : tout ce que le joueur retrouvera au réveil */
function vsInstantane(P) {
  const p = player;
  return {
    x: P.x, z: P.z, gy: P.gy, yaw: p.yaw, pitch: p.pitch,
    hp: p.hp, maxHp: p.maxHp, perks: [...p.perks], souffleUses: p.souffleUses, stamina: p.stamina,
    slots: Arms.slots.map((s) => s && Object.assign({}, s)), cur: Arms.cur, grenades: G.grenades,
    points: G.points, stats: Object.assign({}, G.stats), timers: Object.assign({}, G.timers), life: { add: Life.add, kill: Life.kill },
    liste: Zombies.list, events: G.time,
  };
}
function vsRendreJoueur(I) {
  const p = player;
  p.hp = I.hp; p.maxHp = I.maxHp; p.perks.clear(); for (const k of I.perks) p.perks.add(k);
  p.souffleUses = I.souffleUses; p.stamina = I.stamina; p.down = false; p.downT = 0; p.lastHit = G.time;
  p.grabT = 0; p.grabbedBy = null; p.grabFreeT = 0;
  Arms.slots = I.slots.map((s) => s && Object.assign({}, s)); Arms.cur = Arms.slots[I.cur] ? I.cur : Math.max(0, Arms.slots.findIndex((s) => s));
  Arms.state = 'idle'; Arms.t = 0; Arms.dur = 0; Arms.autoReloadAt = -1; Arms.drinkId = null; Arms.rl = null; Arms.cyc = null;
  if (Arms.bottle) { Arms.bottle.visible = false; Arms.cap.visible = false; }
  nadeReset();
  if (Couteau) Couteau.annuler();
  refreshGunModel();
  G.grenades = I.grenades; G.points = I.points; G.stats = I.stats; Object.assign(G.timers, I.timers);
  Life.add = I.life.add; Life.kill = I.life.kill;
}

/* ---- ambiance : brouillard du Khamsin, ciel couleur de sable, lampes de Bunker 7 éteintes (même nombre de lumières,
   pas de recompilation) */
function vsAmbiance(on) {
  const D = VS.d;
  if (on) {
    D.amb = { fond: scene.background, brume: scene.fog.color.clone(), densite: scene.fog.density, expo: renderer.toneMappingExposure, far: camera.far,
      hemi: HEMI ? { c: HEMI.color.clone(), g: HEMI.groundColor.clone(), i: HEMI.intensity } : null, lampes: [] };
    scene.traverse((o) => { if (o.isLight && o !== HEMI && o.intensity > 0) { D.amb.lampes.push([o, o.intensity]); o.intensity = 0; } });
    scene.background = new THREE.Color();
    renderer.toneMappingExposure = 1.0;
    // Bunker 7 reste affiché : à 9 km, hors de la distance d'affichage, il n'est pas dessiné ; le cacher retirerait ses
    // lampes de la scène (autre nombre de lumières : toutes les matières recompilées, un gel)
    return;
  }
  const a = D.amb; D.amb = null;
  if (!a) return;
  scene.background = a.fond; scene.fog.color.copy(a.brume); scene.fog.density = a.densite; renderer.toneMappingExposure = a.expo;
  if (Math.abs(camera.far - a.far) > 0.5) { camera.far = a.far; camera.updateProjectionMatrix(); }
  if (HEMI && a.hemi) { HEMI.color.copy(a.hemi.c); HEMI.groundColor.copy(a.hemi.g); HEMI.intensity = a.hemi.i; }
  for (const [o, i] of a.lampes) o.intensity = i;
}
/* Niveau du Khamsin à l'instant (rafales) : brouillard, fond, lumière, distance d'affichage. */
const _vsF = new THREE.Color(), _vsF2 = new THREE.Color();
function vsTempete(dt) {
  const D = VS.d, t = D.t;
  const lv = VSD.lv + 0.22 * Math.sin(t * 0.37) * Math.sin(t * 0.91 + 1.3) + 0.08 * Math.sin(t * 2.3);
  KHS.lv = lv; OW.t += dt;
  const i = Math.min(2, Math.floor(lv)), f = lv - i, A = KHS_LV[i], B = KHS_LV[i + 1];
  scene.fog.density = Math.exp(lerp(Math.log(A.dens), Math.log(B.dens), f));
  // couleur : celle d'un niveau plus bas (le ciel restait presque noir au-dessus d'un sable clair)
  const lc = lv - 0.5, ic = Math.min(2, Math.floor(lc)), fc = lc - ic;
  _vsF.setHex(KHS_LV[ic].col).lerp(_vsF2.setHex(KHS_LV[ic + 1].col), fc).convertSRGBToLinear();
  scene.fog.color.copy(_vsF);
  scene.background.copy(_vsF);
  const far = Math.max(90, Math.exp(lerp(Math.log(A.far), Math.log(B.far), f)) * 0.9);
  if (Math.abs(camera.far - far) > 1) { camera.far = far; camera.updateProjectionMatrix(); }
  if (HEMI) { HEMI.color.setHex(0xe0a46a).lerp(_vsF, 0.35); HEMI.groundColor.setHex(0x8a5530); HEMI.intensity = 1.05 - (lv - 2) * 0.3; }
  khStreaks(dt);
  // sable qui file : plus discret qu'à Khamsin (de près, sans le relief des lieux, il couvrait l'écran)
  if (KHS.streaks) { KHS.streaks.mat.opacity *= 0.35; KHS.streaks.mat.color.copy(_vsF).multiplyScalar(1.6); }
  khWindSound(dt);
  // mirage : au loin, devant le joueur au moment d'entrer ; il garde sa distance, il paraît et disparaît dans les rafales
  if (D.mirage) {
    D.mirage.position.set(player.pos.x + D.mirDir.x * 78, vsSol(player.pos.x, player.pos.z) - 1, player.pos.z + D.mirDir.z * 78);
    D.mirage.rotation.y = Math.atan2(D.mirDir.x, D.mirDir.z);
    D.mirageMat.opacity = clamp(0.42 - (lv - 2.2) * 0.9, 0, 0.4) * clamp(t / 4, 0, 1);
    D.mirageMat.color.copy(_vsF).multiplyScalar(0.5);
  }
}

/* ---- entrée : le voile de sable, puis le désert */
function vsVoile(k) {
  let el = document.getElementById('vs-voile');
  if (!el) {
    if (!(k > 0)) return;
    el = document.createElement('div'); el.id = 'vs-voile';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45;opacity:0;background:radial-gradient(ellipse at center,#d9a868 0%,#a8682e 55%,#4a2210 100%)';
    document.body.appendChild(el);
  }
  el.style.opacity = String(clamp(k, 0, 1));
  el.style.display = k > 0 ? '' : 'none';
}
function vsVignette(on) {
  let el = document.getElementById('vs-vignette');
  if (!el) {
    if (!on) return;
    el = document.createElement('div'); el.id = 'vs-vignette';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(60,24,8,0.55) 100%)';
    document.body.appendChild(el);
  }
  el.style.display = on ? '' : 'none';
}
function vsEntrer(P) {
  if (VS.on || VS.entree) return;
  VS.entree = { P: { x: P.x, z: P.z, gy: P.gy }, t: 0, pret: false };
  vsFermer(true);
  const S = Sound.synthe && Sound.synthe();
  if (S) { const o = S.out(null, 0.5); if (o) { const t = S.ctx.currentTime; S.noiseHit(t, 1.6, 0.9, 'bandpass', 1600, 250, 0.9, o, 0.08); S.tone('sine', 140, 45, t, 1.4, 0.35, o, 0.05); } }
}
/* Chaque image d'une entrée (updateFeatures, puis vsUpdate) : voile qui monte, bascule, voile qui se lève. */
function vsEntreeMaj(dt) {
  const E = VS.entree;
  if (!E) return;
  E.t += dt;
  if (!E.pret) {
    vsVoile(E.t / VSD.entree);
    if (E.t >= VSD.entree) { E.pret = true; E.t = 0; vsBascule(E.P); }
    return;
  }
  vsVoile(1 - E.t / VSD.vision);
  if (E.t >= VSD.vision) { vsVoile(0); VS.entree = null; }
}
function vsBascule(P) {
  VS.I = vsInstantane(P);
  const D = vsPreparer();
  scene.add(D.root);
  D.t = 0; D.zT = 1.2; D.rT = rand(5, 8); D.mirDir = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
  // Bunker 7 figé : ses zombies de côté (leurs places de dessin gardées), bonus de la manche suspendus
  for (const z of VS.I.liste) hideZombieSlot(z.slot);
  Zombies.list = [];
  G.timers.insta = 0; G.timers.double = 0;
  Life.add = () => {}; Life.kill = () => {};   // statistiques de carrière : l'hallucination ne compte pas
  VS.on = true;
  vsAmbiance(true);
  vsVignette(true);
  placePlayer(VSD.ox, VSD.oz);
  player.vel.set(0, 0, 0); player.y = 0; player.vy = 0; player.grounded = true; player.pitch = 0;
  glReset();
  vsTerrain();
  vsTempete(0);
  KHR.t = 0;
  flushZombieMatrices();
}
/* ---- chaque image de l'hallucination (à la place d'update) */
function vsUpdate(dt) {
  const D = VS.d;
  D.t += dt;
  vsEntreeMaj(dt);
  if (VS.reveil) { vsReveilMaj(dt); return; }
  updatePlayer(dt);
  updateArms(dt);
  persoUpdate(dt);
  glEffets(dt);
  ptsHudFrame();
  if (Couteau) Couteau.update(dt);
  HUD.prompt(null);
  if (Math.hypot(player.pos.x - D.cx, player.pos.z - D.cz) > 24) vsTerrain();
  vsApparitions(dt);
  khGrabGuard(dt);
  updateZombies(dt);
  khEyes(); KHE.pts.visible = true;           // les yeux turquoise percent la poussière
  updateProjectiles(dt);
  updateGrenades(dt);
  updateFX(dt);
  if (OW.sandFX) OW.sandFX.update(dt);
  vsTempete(dt);
  HUD.update(dt);
}
/* Zombies du désert (Desséchés de Khamsin) et Rôdeurs : sans fin, de plus en plus nombreux. */
function vsApparitions(dt) {
  const D = VS.d, px = player.pos.x, pz = player.pos.z;
  let nz = 0, nr = 0;
  for (const z of Zombies.list) if (z.alive) { if (z.rodeur) nr++; else nz++; }
  D.zT -= dt;
  const max = Math.min(VSD.zMax, VSD.zMin + Math.floor(D.t / VSD.zPas));
  if (D.zT <= 0 && nz < max) {
    D.zT = rand(0.5, 1.4) * clamp(1.2 - D.t / 200, 0.45, 1);
    const a = player.yaw + Math.PI + rand(-1.9, 1.9), d = rand(VSD.zDist[0], VSD.zDist[1]);   // surtout devant et sur les côtés
    const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d, y = vsSol(x, z);
    const e = spawnZombie({ riser: true, x, z, y, li: 0, k: -1, zone: -1, layer: 0 }, G.zombieHp || zombieHpForRound(Math.max(1, G.round)));
    if (e) {
      e.vs = true;
      // super-sprint : démarche « Super-sprinteur » (manches avancées), vitesse au-dessus de la course
      e.speedType = 'run'; e.speed = rand(VSD.sprint[0], VSD.sprint[1]);
      const an = e.an || zAnimInit(e); an.prev = an.gait; an.gb = 1; an.gait = ZGAITS.super; an.gaitFor = 'run';
    }
  }
  D.rT -= dt;
  const rmax = D.t > VSD.rPas ? VSD.rMax[1] : VSD.rMax[0];
  if (D.rT <= 0 && nr < rmax && !player.down) {
    D.rT = rand(KHR.every[0], KHR.every[1]);
    const a = rand(0, TAU), d = rand(VSD.rDist[0], VSD.rDist[1]);
    vsRodeur(px + Math.sin(a) * d, pz + Math.cos(a) * d);
  }
}
/* Un Rôdeur sort du sable (comme khSpawnRodeur, sur le sol du désert). */
function vsRodeur(x, zz) {
  if (!ZR.free.length) { const c = Zombies.list.find((q) => !q.alive); if (!c) return null; removeZombie(c); }
  const slot = ZR.free.pop();
  const look = { skin: pick(KHR_TINTS), cloth: 0xffffff, eyes: KH_EYE_LIN, helmet: false, helmetColor: 0 };
  paintZombieSlot(slot, look, ZR, 'kh_rodeur');
  const hp = khHp(Math.max(1, G.round)) * 2, gy = vsSol(x, zz);
  const z = {
    id: ++Zombies.seq, slot, type: RODEUR_TYPE, model: 'kh_rodeur', dog: true, rodeur: true, vs: true, rig: makeDogRig(), look, helmetOn: false, alive: true, outside: false,
    state: 'chase', dstate: 'spawn', rstate: 'rise', st: 0, t: 0, hp, maxHp: hp, pos: new THREE.Vector3(x, gy - KHR.depth * KHR.scale, zz), k: -1, gy,
    yaw: Math.atan2(player.pos.x - x, player.pos.z - zz), vx: 0, vz: 0, moving: 0, speedType: 'run', speed: rand(KHR.speed[0], KHR.speed[1]), win: null, gib: 0,
    headless: false, crawl: false, stagger: 0, flinch: 0, flinchSide: 1, knockX: 0, knockZ: 0, knockT: 0, knockDur: 0, knockDir: 1, knockK: 0, knockShift: false,
    reelT: 0, called: null, nukeT: 0, deathKind: null, losT: 0, los: false, stuckT: 0, lastX: x, lastZ: zz, farT: 0,
    flank: 1, leapCd: 0, leap: 0, leapFrom: null, leapTo: null, leapL: 0, leapHit: false,
    biteN: -1, biteHit: true, barkT: rand(1, 2.5), yelpT: 0, droolT: 99, pawU: 1, aim: 0, turn: 0, stunDur: 1.2, stunSide: 1, grabCd: 0, hideT: 0, layer: 0, biteAcc: 0,
  };
  z.rig.root.scale.setScalar(KHR.scale);
  owSandBurst(x, zz, gy);
  Sound.rise(z.pos);
  Zombies.list.push(z);
  animateDog(z, 0);
  return z;
}
/* Desséchés au hasard (archéologues, ouvriers, villageois), comme au camp de fouilles. */
function vsTypeDesert() {
  const x = Math.random();
  return KH_TYPES[x < 0.45 ? 0 : x < 0.85 ? 1 : 2];
}

/* ---- la « mort » : rien de réel ; le voile tombe, le joueur se réveille au portail */
function vsMort() {
  if (VS.reveil) return;
  player.hp = 1;
  VS.reveil = { t: 0, bascule: false };
  if (player.grabbedBy || player.grabT > 0) khRelease();
  Sound.playerHurt();
  const S = Sound.synthe && Sound.synthe();
  if (S) { const o = S.out(null, 0.5); if (o) { const t = S.ctx.currentTime; S.noiseHit(t, 1.2, 0.8, 'lowpass', 900, 120, 0.8, o, 0.02); S.tone('sine', 90, 40, t, 1.3, 0.4, o, 0.02); } }
}
function vsReveilMaj(dt) {
  const R = VS.reveil;
  R.t += dt;
  if (!R.bascule) {
    vsVoile(R.t / 0.35);
    // le désert continue un instant derrière le voile (sans le joueur)
    updateFX(dt); vsTempete(dt);
    if (R.t >= 0.35) { R.bascule = true; R.t = 0; vsSortir(true); }
    return;
  }
}
/* Retour à Bunker 7 (joueur rendu tel qu'au portail si rendre) ; aussi à la remise à zéro et au menu. */
function vsSortir(rendre) {
  const I = VS.I, D = VS.d;
  VS.on = false; VS.reveil = null; VS.entree = null;
  // les zombies du désert disparaissent ; ceux de Bunker 7 reviennent à leur place
  const desert = Zombies.list.slice();
  for (const z of desert) removeZombie(z);
  if (I) {
    Zombies.list = I.liste;
    if (rendre) for (const z of Zombies.list) { if (!z.removed && z.rig) writeZombieMatrices(z); }   // poses gardées (corps compris)
    else { for (const z of I.liste.slice()) removeZombie(z); Zombies.list = []; }
  }
  if (player.grabbedBy || player.grabT > 0) khRelease();
  vsAmbiance(false);
  vsVignette(false);
  KHS.lv = 0;
  if (KHS.streaks) KHS.streaks.mesh.visible = false;
  if (KHS.snd) KHS.snd.g.gain.value = 0;
  if (KHE && KHE.pts) KHE.pts.visible = false;
  if (D && D.root && D.root.parent) D.root.parent.remove(D.root);
  if (I && !rendre) { Life.add = I.life.add; Life.kill = I.life.kill; }
  if (I && rendre) {
    vsRendreJoueur(I);
    // les minuteries de Bunker 7 reprennent où elles étaient
    const ecart = G.time - I.events;
    for (const e of G.events) e.t += ecart;
    placePlayer(I.x, I.z);
    player.vel.set(0, 0, 0); player.y = 0; player.vy = 0; player.grounded = true; player.yaw = I.yaw; player.pitch = I.pitch;
    glReset();
    Zombies.flowT = 0; Zombies.lastCell = -1; computeFlow(player.k);
    HUD.full();
    VS.sortie = { t: 0 };
    HUD.banner('…', 'Ce n’était qu’une vision', 'info');
  } else vsVoile(0);
  flushZombieMatrices();
  VS.I = null;
}
/* Après le réveil (updateFeatures) : le voile se lève sur Bunker 7. */
function vsSortieMaj(dt) {
  const S = VS.sortie;
  if (!S) return;
  S.t += dt;
  vsVoile(1 - S.t / VSD.sortie);
  if (S.t >= VSD.sortie) { vsVoile(0); VS.sortie = null; }
}
/* Pause pendant l'hallucination : le vent se tait (render, chaque image). */
function vsAvantRendu() {
  if (VS.on && G.state !== 'playing' && KHS.snd) KHS.snd.g.gain.value = 0;
}
/* --------------------------------------------------------- Remise à zéro --- */
function vsRemettre() {
  if (VS.on || VS.I) vsSortir(false);
  vsFermer(true);
  vsVoile(0); vsVignette(false);
  VS.fait = false; VS.relance = false; VS.momie = null; VS.on = false; VS.entree = null; VS.reveil = null; VS.sortie = null;
}
