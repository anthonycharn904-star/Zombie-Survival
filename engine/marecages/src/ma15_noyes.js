
/* ================================================================== Les Noyés ==
   Kit MM 2.1.6. Demande d'Anthony (27 octobre 2026) : des zombies aquatiques, modélisés, avec leur son et
   leurs animations. Ils flottent dans l'eau et ne viennent vers le joueur que lorsqu'il est dans l'eau ou
   en barque ; ils l'attaquent, peuvent le tuer et détruire la barque ; leurs yeux luisent et se voient
   nettement au-dessus de l'eau ; ils ne quittent pas l'eau : à terre, ce sont les zombies ordinaires qui
   viennent ; au lieu de disparaître, ils retournent au fond ; tués, ils ne comptent pas pour la manche.

   Le Noyé (M-01) : un pêcheur du Bourg, gonflé d'eau (pull marin rayé sur un ventre qui déborde, ciré
   ouvert, cuissardes, corde en ceinture, algues et lentilles d'eau), peau grise et luisante, vase qui
   coule de la bouche, crâne dégarni aux mèches plaquées ou bonnet de laine, mains en griffes.
   Squelette du Fantassin (ZRIG).
     · il sort du fond (2 s : la lueur rouge de ses yeux monte sous l'eau, il crève la surface, souffle) ;
     · il approche à la façon d'un caïman : seuls le haut du crâne et les yeux dépassent, il ondule,
       un sillage de ronds ; plus près, le nez sort ; on entend des bulles, un râle noyé, une plainte ;
     · à 2,3 m d'une barque lente (moins de 3,2 m/s), il jaillit (cri gargouillant, gerbe) et s'agrippe
       au plat-bord : les mains par-dessus, la tête au ras du bord ; il freine la barque et la fait
       gîter, déchire la coque à coups de griffes, griffe le barreur s'il est à portée (à l'arrière) ;
       au-delà de 2,4 m/s il peut lâcher prise, de plus en plus souvent avec la vitesse ;
     · une barque lancée (plus de 2,8 m/s) qui lui passe dessus le blesse et l'enfonce (la coque cogne) ;
     · un nageur : il le saisit (morsure, puis il l'enfonce : le nageur ne bouge plus), 3 s au plus ;
       V (ou E) : un coup de pied le repousse (le nageur n'a pas d'arme) ;
     · le joueur prend pied (île, haut-fond, ponton) : il vient jusqu'au bord de l'eau profonde, le
       regarde de 4 à 8 s, puis retourne au fond (la lueur s'éteint en descendant) ; distancé (75 m),
       aussi ; tué, il flotte un instant sur le dos, puis coule.
   Ses yeux : rouge braise (MA_NOYE.eye ; ni le vert des leurres de la bête, ni le jaune des lanternes,
   ni le turquoise réservé au surnaturel). Deux lueurs sans brouillard (la brume les ternit à
   peine, elles grossissent un peu), d'au moins 4,2 pixels quelle que soit la distance (7,5 en 1080p), plus
   fortes au loin ; à bout portant, plafonnées (l'œil reste lisible) ; éteintes quand la tête se détourne ;
   leur reflet allongé sur l'eau, vers la caméra ; sous l'eau, une tache rouge à la surface. Ils clignent.
   Hors du décompte : ni la manche ni les bonus ne les comptent (khKillRodeur, de même) ; ils rapportent
   des points. Les zombies ordinaires ne sortent plus quand le joueur est sur l'eau (maPickSpawn) : ceux
   qui sont déjà là l'attendent sur la rive.
   Kit MM 2.1.7 (« davantage de Noyés, voire beaucoup plus », trois fois plus, attaques limitées) : jusqu'à 6 à
   la fois à la manche 1, 20 dès la 8 ; ils sortent par groupes de 2-3 (3-5 à la manche 10), l'un après
   l'autre ; seuls les plus proches attaquent (agrippés : 2 → 6, chasseurs d'un nageur : 2 → 4), les autres
   tournent lentement autour de la barque arrêtée ou du nageur, face au joueur, et prennent la place de ceux
   qui tombent. Ils ne comptent pas dans le plafond des zombies ordinaires (aliveCount, patches.py).
   Branchements : patches.py (matières, pièce facultative, mise à jour, mort, tir, rampe, collision des
   véhicules, fiche et sons de l'écran « Modèles », aliveCount), maUpdate (après la barque et la bête), maLoad
   (lueurs, précompilation), maResetWorld, maUnload, F8. Crochets : maOn('noye', …).
   ============================================================================================ */
const MA_NOYE = {
  eye: 0xff5226,                                      // rouge braise (sRGB)
  minDepth: 1.0,                                      // eau qu'il leur faut (au-delà de 0,9 m, on nage)
  navDepth: 1.2,                                      // chemins : la grille de la bête (eau de 1,2 m et plus)
  spawnDepth: 1.6,                                    // ils sortent d'au moins 1,6 m d'eau
  // kit MM 2.1.7 : trois fois plus nombreux. À la fois : 6 à la manche 1, +2 par manche, 20 dès la 8 (la horde
  // du moteur a 48 places : 24 zombies ordinaires au plus, les Noyés, les morts qui coulent).
  max: (r) => Math.min(20, 4 + 2 * Math.max(1, r)),
  every: (r) => lerp(9, 4.5, clamp((r - 1) / 9, 0, 1)),              // s entre deux groupes (±25 %)
  pack: (r) => { const k = clamp((r - 1) / 9, 0, 1); return [2 + Math.round(k), 3 + Math.round(2 * k)]; },   // taille d'un groupe : 2-3 → 3-5
  packR: [2.5, 6],                                    // m entre les membres d'un groupe
  packDelay: [0.25, 0.9],                             // s entre leurs sorties (l'un après l'autre)
  // attaques limitées : à la fois, agrippés à la barque (2 aux manches 1-2… 6 dès la 9) et chasseurs d'un nageur
  // (2 aux manches 1-3, 3 aux 4-6, 4 dès la 7) ; les autres attendent leur tour en cercle, yeux sur le joueur
  attack: { boat: (r) => Math.min(6, 1 + Math.ceil(Math.max(1, r) / 2)), swim: (r) => Math.min(4, 1 + Math.ceil(Math.max(1, r) / 3)) },
  wait: { boat: [4.2, 6.2], swim: [5.5, 8.5], step: 0.35, speed: [0.25, 0.55] },   // rayons du cercle (m), pas, vitesse (m/s)
  first: [4, 7],                                      // s sur l'eau avant le premier groupe
  dist: [24, 44],                                     // m : où ils sortent (en barque lancée, plutôt devant)
  swimDist: [18, 34],                                 // m : autour d'un nageur
  speed: (r) => [lerp(1.2, 1.6, clamp((r - 1) / 9, 0, 1)), lerp(1.5, 1.95, clamp((r - 1) / 9, 0, 1))],   // m/s
  rise: 2.1,                                          // s : du fond à la surface
  surge: { at: 2.3, dur: 0.5, speed: 3.6, boatMax: 3.2 },
  grip: { every: [1.3, 1.9], hull: (r) => lerp(4, 6.5, clamp((r - 1) / 9, 0, 1)), swipe: 18, reach: 1.35, drag: 0.12, slip: 2.4, slipK: 0.32 },
  grab: { at: 1.35, bite: 12, dps: 7, dur: 3, cd: 3, free: 2 },     // free : répit du nageur après une prise (MM 2.1.7 : 1,2 → 2 s)
  kick: { r: 1.8, dmg: 25, push: 2.2, stun: 1.4, cd: 0.9 },
  ram: { at: 2.8, dmg: 0.35, hull: 3 },
  stare: [4, 8],                                      // s à regarder, depuis l'eau, un joueur qui a pris pied
  far: 75,                                            // m : distancés, ils retournent au fond
  hp: 0.75,                                           // PV : ×0,75 ceux d'un zombie ordinaire du marais (khHp) de la même manche
};
const MA_NOYE_EYE_LIN = new THREE.Color(MA_NOYE.eye).convertSRGBToLinear().getHex();   // teinte d'instance (non convertie par paintZombieSlot)
const MA_NOYE_TYPE = {
  id: 'ma_noye', num: 'M-01', name: 'Le Noyé', cls: 'Aquatique (Marécages Maudits)', tag: 'Sur l’eau seulement', model: 'ma_noye', facts: 'noye',
  maps: ['marais'], noye: true,
  desc: 'Un pêcheur du Bourg noyé, gonflé d’eau. Il ne sort jamais de l’eau profonde : il attend les barques et les nageurs, les yeux au ras de la surface.',
  sign: 'Deux yeux rouge braise au ras de l’eau, dans la brume ; le crâne qui ondule à la surface, un sillage de ronds.',
  mult: { hp: MA_NOYE.hp, speed: 0.75, damage: 0.6 }, headMult: 2, helmet: false, ability: 'Embuscade',
};
SPECIMEN_TYPES.push(MA_NOYE_TYPE);                    // fiche de l'écran « Modèles » et compteur d'éliminations
const MA_NOYE_ST = { rise: 'remonte', stalk: 'approche', wait: 'attend son tour', surge: 'jaillit', grip: 'agrippé', fall: 'retombe', grab: 'tient le nageur', stun: 'sonné', stare: 'regarde', sink: 'retourne au fond', dead: 'mort', eaten: 'englouti par la bête' };

/* ---- Modèle (pièces sur les os du squelette humain) ; opt : pièce facultative, selon l'apparence */
ZPARTS.ma_noye = [
  { geo: 'torso', bone: 'hips', mat: 'maNoyeCloth', tint: 'cloth' },
  { geo: 'chest', bone: 'hips', mat: 'maNoyeSkin', tint: 'skin' },
  { geo: 'head', bone: 'neck', mat: 'maNoyeSkin', tint: 'skin', head: true },
  { geo: 'hair', bone: 'neck', mat: 'maNoyeCloth', tint: 'white', head: true, opt: 'hair' },
  { geo: 'cap', bone: 'neck', mat: 'maNoyeCloth', tint: 'helmet', head: true, opt: 'cap' },
  { geo: 'eyes', bone: 'neck', mat: 'khEyes', tint: 'eyes', head: true },
  { geo: 'upper', bone: 'sh', mat: 'maNoyeCloth', tint: 'cloth' },
  { geo: 'fore', bone: 'el', mat: 'maNoyeSkin', tint: 'skin' },
  { geo: 'thigh', bone: 'hip', mat: 'maNoyeCloth', tint: 'cloth' },
  { geo: 'shin', bone: 'kn', mat: 'maNoyeCloth', tint: 'cloth' },
  { geo: 'armStump', bone: 'sh', mat: 'maNoyeSkin', tint: 'skin', stump: 'arm' },
];
/* Sous l'eau, le corps se perd dans l'eau croupie. Sans cela, l'eau du marais (transparente à 16 % en eau
   profonde) laissait voir tout le corps d'un noyé qui n'a que les yeux dehors. Deux effets, selon la
   profondeur sous la surface :
   - la couleur rejoint celle de l'eau trouble (à moitié à 0,28 m, tout à fait à 0,55 m) ;
   - plus bas, le corps s'efface (de 0,3 à 0,8 m) : on voit ce qu'il y a derrière (le fond, à travers l'eau).
   Une couleur fixe ne suffisait pas : mesuré sur l'image, le fond vu de la barque (en rasant, de 10 à 30 m)
   paraît clair (brouillard sur la longue distance jusqu'au fond, 0,17-0,24 / 0,24-0,29 / 0,25-0,29) ; vu d'un
   ponton (en plongée, 9 m), il est proche et sombre (0,05 / 0,05 / 0,03). La couleur choisie est entre les deux.
   Le mélange se fait après l'encodage de sortie (avant le brouillard) : uMnMurk est une couleur de l'image.
   Effacement : l'alpha règle la couverture des échantillons (MSAA, alphaToCoverage) ; sans MSAA, une trame
   ordonnée 4 × 4 (sous 84 % d'eau opaque, elle ne se voit pas). Les deux matières des noyés (peau, étoffe)
   partagent un shader ; écran « Modèles » : pas d'eau (water à −1000). */
const MA_NOYE_U = { uMnWater: { value: 0 }, uMnDepth: { value: 0.55 }, uMnFade: { value: new THREE.Vector2(0.3, 0.5) }, uMnMurk: { value: new THREE.Color().setRGB(0.15, 0.2, 0.195) } };
function maNoyeMurk(mat) {
  mat.alphaToCoverage = true;
  mat.onBeforeCompile = (sh, r) => {
    Object.assign(sh.uniforms, MA_NOYE_U);
    let ms = 0;
    try { const gl = r && r.getContext ? r.getContext() : null; ms = gl ? gl.getParameter(gl.SAMPLES) : 0; } catch (e) { ms = 0; }
    sh.vertexShader = 'varying float vMnY;\n' + sh.vertexShader.replace('#include <project_vertex>', [
      '#include <project_vertex>',
      '  vec4 mnW = vec4( transformed, 1.0 );',
      '  #ifdef USE_INSTANCING',
      '    mnW = instanceMatrix * mnW;',
      '  #endif',
      '  vMnY = ( modelMatrix * mnW ).y;',
    ].join('\n'));
    sh.fragmentShader = 'varying float vMnY;\nuniform float uMnWater;\nuniform float uMnDepth;\nuniform vec2 uMnFade;\nuniform vec3 uMnMurk;\n'
      + 'float mnBayer2( vec2 a ) { a = floor( a ); return fract( a.x * 0.5 + a.y * a.y * 0.75 ); }\n'
      + sh.fragmentShader.replace('#include <fog_fragment>', [
        '  {',
        '    float mnD = uMnWater - vMnY, mnU = clamp( mnD / uMnDepth, 0.0, 1.0 );',
        '    gl_FragColor.rgb = mix( gl_FragColor.rgb, uMnMurk, mnU * mnU * ( 3.0 - 2.0 * mnU ) );',
        '    float mnA = 1.0 - clamp( ( mnD - uMnFade.x ) / uMnFade.y, 0.0, 1.0 );',
        ms >= 2 ? '    gl_FragColor.a *= mnA;'
          : '    if ( mnA < 1.0 && mnA <= mnBayer2( 0.5 * gl_FragCoord.xy ) * 0.25 + mnBayer2( gl_FragCoord.xy ) + 0.03125 ) discard;',
        '  }',
        '#include <fog_fragment>',
      ].join('\n'));
  };
  mat.customProgramCacheKey = () => 'marais-noye';
  return mat;
}
/* Textures (les couleurs sont dans les sommets) : peau gorgée d'eau, sans sang (l'eau l'a lavé) : marbrures
   des noyés (veines sombres ramifiées), plis fins, taches livides ou verdâtres ; étoffe trempée : trame,
   auréoles de l'eau, vase, algues, accrocs. Créées par buildMaterials (patches.py). */
function maNoyeSkinTex() {
  const w = 256, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  const n = valueNoise(w, h, [[4, 4, 1], [10, 10, 0.6], [32, 32, 0.3]], 2.0);
  paintPixels(g, w, h, (x, y, col) => { const v = n[y * w + x], k = 0.8 + 0.24 * v; col[0] = 226 * k; col[1] = 232 * k; col[2] = 224 * k; });
  for (let i = 0; i < 24; i++) crack(g, w, h, rand(0, w), rand(0, h), randInt(6, 14), rand(0.7, 1.5), `rgba(${randInt(50, 68)},${randInt(66, 84)},${randInt(80, 98)},0.4)`);
  for (let i = 0; i < 60; i++) {                                     // plis de la peau trempée
    const x = rand(0, w), y = rand(0, h), l = rand(6, 14), a = rand(-0.4, 0.4);
    g.strokeStyle = i % 2 ? 'rgba(255,255,250,0.16)' : 'rgba(40,50,48,0.18)'; g.lineWidth = 1;
    for (const ox of [-w, 0, w]) { g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + l / 2, y + Math.sin(a) * 4 + 2, x + ox + l, y + Math.sin(a) * l * 0.3); g.stroke(); }
  }
  for (let i = 0; i < 10; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(12, 30), 'rgba(70,62,92,0.16)');
  for (let i = 0; i < 8; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(10, 24), 'rgba(58,72,38,0.16)');
  return toTex(c);
}
function maNoyeClothTex() {
  const w = 256, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  const n = valueNoise(w, h, [[6, 6, 1], [24, 24, 0.5]], 1.8);
  paintPixels(g, w, h, (x, y, col) => {
    const weave = ((x & 3) === 0 ? 0.9 : 1) * ((y & 3) === 0 ? 0.92 : 1), k = (0.74 + 0.28 * n[y * w + x]) * weave;
    col[0] = 222 * k; col[1] = 222 * k; col[2] = 214 * k;
  });
  for (let i = 0; i < 6; i++) {                                      // auréoles de l'eau : bords plus sombres, irréguliers
    const x = rand(0, w), y = rand(0, h), r = rand(18, 34);
    for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU + rand(-0.2, 0.2); blot(g, w, h, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, rand(6, 11), 'rgba(56,48,34,0.16)'); }
  }
  for (let i = 0; i < 8; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(14, 36), 'rgba(58,48,32,0.3)');
  for (let i = 0; i < 5; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(12, 28), 'rgba(52,70,32,0.26)');
  g.fillStyle = 'rgba(14,12,10,0.75)';
  for (let i = 0; i < 4; i++) {
    const x = rand(0, w), y = rand(0, h);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) g.lineTo(x + rand(-7, 7), y + rand(-7, 7));
    g.fill();
  }
  return toTex(c);
}
/* Main en griffe au bout de l'avant-bras (repère du coude : l'avant-bras descend selon −y). La paume est
   tournée vers −z (vers l'arrière, bras pendant ; vers le bas, bras tendu devant : les griffes du zombie) ;
   le poignet et les doigts se plient vers la paume : par-dessus le plat-bord, les doigts crochent l'intérieur. */
function maNoyeHand(k, K) {
  const { box, ell, seg, V } = k, out = [];
  const W = V(0, -0.262, 0.002), B = new THREE.Matrix4().compose(W, new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.45), V(1, 1, 1));
  const put = (p) => ({ geo: p.geo, matrix: B.clone().multiply(p.matrix), color: p.color });
  const dir = (a) => V(0, -Math.cos(a), -Math.sin(a));
  const parts = [
    box(0.064, 0.08, 0.03, 0, -0.042, 0, K.skin),                          // paume
    ell(0.036, 0.013, 0.02, 0, -0.08, 0.002, K.skinD),                     // jointures
    ell(0.03, 0.03, 0.022, 0, -0.012, 0, K.skinB),                         // poignet gonflé
  ];
  const lens = [0.04, 0.047, 0.045, 0.036];
  for (let i = 0; i < 4; i++) {
    const x = -0.024 + i * 0.016;
    const a = V(x, -0.082, -0.004), b = a.clone().addScaledVector(dir(0.5), lens[i]), c = b.clone().addScaledVector(dir(1.05), lens[i] * 0.78), d = c.clone().addScaledVector(dir(1.5), 0.024);
    parts.push(seg(a, b, K.skin, 0.0092, 0, true, 0.0086), seg(b, c, K.skinB, 0.0084, 0, true, 0.0074), seg(c, d, K.claw, 0.0062, 0, true, 0.0012));
  }
  // pouce, sur le côté (+x), replié vers la paume
  { const a = V(0.034, -0.03, -0.006), b = a.clone().add(V(0.012, -0.034, -0.02)), c = b.clone().add(V(-0.006, -0.022, -0.016));
    parts.push(seg(a, b, K.skin, 0.01, 0, true, 0.009), seg(b, c, K.claw, 0.0068, 0, true, 0.0014)); }
  for (const p of parts) out.push(put(p));
  return out;
}
/* Salissures dans les couleurs des sommets : boue et eau croupie vers le bas (f), taches qui se fondent
   (bruit de valeur 3D, pas de pastilles), lumière inégale du tissu mouillé. */
function mnHash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function mnNoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), c = (a, b, d) => mnHash3(ix + a, iy + b, iz + d);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function mnGrime(geo, mud, k0, f, seed = 0, var0 = 0.28) {
  const P = geo.attributes.position.array, Cc = geo.attributes.color.array;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    const n = 0.6 * mnNoise3(x * 8 + seed, y * 8, z * 8) + 0.4 * mnNoise3(x * 21, y * 21 + seed, z * 21);
    const k = clamp((f ? f(x, y, z) : 0) + k0 + (n - 0.5) * 0.45, 0, 0.85), b = 1 - var0 / 2 + var0 * mnNoise3(x * 13 - seed, y * 13, z * 13 + 5);
    for (let c = 0; c < 3; c++) Cc[i + c] = lerp(Cc[i + c], mud[c], k) * b;
  }
  return geo;
}
function maNoyeGeometries() {
  const k = zKit(), { C, V, box, cyl, ell, tor, cap, seg, on } = k, H = ZRIG.head;
  const rnd = mulberry32(616), rr = (a, b) => a + (b - a) * rnd();
  const K = {
    ...zCommonK(C),
    skin: C(0x8e9a8f, 1.0), skinD: C(0x62706a, 1.0), skinB: C(0x9ca698, 1.0), vein: C(0x4d5e66, 1.0),
    mouth: C(0x0f0b0b), socket: C(0x090b0a), teeth: C(0xa8a080),
    sweater: C(0x2e3646), sweaterD: C(0x252b37), stripe: C(0x5c5e56), jacket: C(0x6a643a), jacketD: C(0x4e4b2c), trousers: C(0x3a3832),
    boot: C(0x2a2e28), bootD: C(0x1a1d18), rope: C(0x6e6248), algae: C(0x34421f), algaeD: C(0x232d16), weed: C(0x55702a),
    mud: C(0x3a3224), hair: C(0x2a261f), knit: C(0xb8b8b4, 1.0), claw: C(0x171411),
    flesh: C(0x8e6c68), fleshD: C(0x4a3434), bone: C(0xd2cab2),
  };
  const MUD = K.mud, sm = (a, b, x) => owSmoothstep(a, b, x);
  // ruban (algue, lanière) : plat, effilé, qui suit une suite de points
  const ribbon = (list, pts, w, col, t = 0.004) => { for (let i = 0; i + 1 < pts.length; i++) list.push(seg(pts[i], pts[i + 1], col, w * (1 - (i / pts.length) * 0.65), t)); };

  /* ---- buste (os du bassin) : pull marin rayé qui remonte sur un ventre gonflé, ciré ouvert devant */
  const T = [], S = [];
  const R = (y) => lerp(0.212, 0.224, clamp((y - 0.08) / 0.4, 0, 1));
  const sT = (x, y, o = 0) => on(x, R(y), 0.63, o);
  T.push(cyl(0.224, 0.212, 0.4, 0, 0.28, 0, K.sweater, 0.63, 0, 0, 0, 18));
  T.push(ell(0.228, 0.086, 0.135, 0, 0.452, 0, K.sweater, 0, 0, 0, 16, 8));
  T.push(cyl(0.23, 0.226, 0.034, 0, 0.088, 0.003, K.sweaterD, 0.66, 0, 0, 0, 18));                    // bord-côte roulé
  for (const y of [0.16, 0.24, 0.32, 0.4]) T.push(cyl(R(y) + 0.003, R(y) + 0.003, 0.024, 0, y, 0, K.stripe, 0.635, 0, 0, 0, 18));
  T.push(cyl(0.208, 0.216, 0.21, 0, -0.075, 0, K.trousers, 0.64, 0, 0, 0, 16));                     // pantalon
  T.push(tor(0.212, 0.011, 0, 0.022, 0, K.rope, Math.PI / 2, 0, 0, 1, 1, 0.66, 22));                 // corde en ceinture
  { const p = sT(0.075, 0.02, 0.012); T.push(ell(0.02, 0.016, 0.015, p.x, 0.022, p.z, K.rope)); ribbon(T, [V(p.x, 0.012, p.z), V(p.x + 0.015, -0.09, p.z + 0.012), V(p.x + 0.004, -0.2, p.z + 0.018)], 0.022, K.rope, 0.016); }
  // ciré : dos et côtés, ouvert devant, un peu évasé ; empiècement sur les épaules, col relevé, revers, poches
  const shell = (rt, rb, h, y, z0, col, open, sz) => ({ geo: new THREE.CylinderGeometry(rt, rb, h, 20, 2, true, open, TAU - 2 * open), matrix: mtx(0, y, z0, 0, 0, 0, 1, 1, sz), color: col });
  T.push(shell(0.247, 0.256, 0.63, 0.115, -0.006, K.jacket, 0.74, 0.68));
  // empiècement des épaules : le haut d'un ellipsoïde ouvert devant, raccord exact avec le haut du ciré
  T.push({ geo: new THREE.SphereGeometry(1, 20, 6, Math.PI / 2 + 0.74, TAU - 1.48, 0, Math.PI / 2), matrix: mtx(0, 0.43, -0.006, 0, 0, 0, 0.247, 0.125, 0.168), color: K.jacket });
  T.push(box(0.008, 0.6, 0.004, 0, 0.13, -0.175, K.jacketD), box(0.36, 0.006, 0.004, 0, 0.36, -0.17, K.jacketD));                  // coutures du dos
  T.push(tor(0.098, 0.026, 0, 0.502, -0.014, K.jacketD, Math.PI / 2 - 0.3, 0, 0, 1.2, 1, 0.95));
  for (const s of [-1, 1]) {
    const a = 0.74, x = s * 0.25 * Math.sin(a), z = 0.25 * Math.cos(a) * 0.68 - 0.006;
    T.push(box(0.034, 0.7, 0.012, x - s * 0.01, 0.15, z + 0.003, K.jacketD, 0, s * 0.7, 0));                        // revers
    const pk = { x: s * 0.236, z: 0.07 };                                                                              // poche plaquée et son rabat
    T.push(box(0.11, 0.1, 0.012, pk.x, 0.0, pk.z + 0.075, K.jacket, 0, s * 1.05, 0), box(0.12, 0.03, 0.016, pk.x, 0.055, pk.z + 0.077, K.jacketD, 0, s * 1.05, 0));
  }
  for (let i = 0; i < 14; i++) {                                                                                         // bas déchiré
    const a = 0.85 + (i / 13) * (TAU - 1.7), l = rr(0.03, 0.08), r = 0.257;
    T.push(box(0.05, l, 0.008, Math.sin(a) * r, -0.185 - l / 2, Math.cos(a) * r * 0.68 - 0.006, K.jacket, 0, a, rr(-0.25, 0.25)));
  }
  // algues : rubans qui pendent des épaules, une touffe de lentilles d'eau
  ribbon(T, [V(0.13, 0.545, 0.02), V(0.15, 0.52, -0.1), V(0.16, 0.38, -0.185), V(0.15, 0.2, -0.19), V(0.17, 0.06, -0.19)], 0.03, K.algae);
  ribbon(T, [V(-0.1, 0.55, 0.0), V(-0.12, 0.5, 0.12), V(-0.15, 0.38, 0.17), V(-0.165, 0.25, 0.175)], 0.026, K.algaeD);
  ribbon(T, [V(0.02, 0.56, -0.07), V(-0.02, 0.48, -0.16), V(-0.03, 0.34, -0.19)], 0.02, K.algae);
  for (let i = 0; i < 9; i++) T.push(ell(0.016, 0.006, 0.016, -0.17 + rr(-0.035, 0.035), 0.528 + rr(-0.008, 0.008), rr(-0.04, 0.04), K.weed, 0, rr(0, 3), 0, 6, 3));
  // peau : le ventre gonflé qui déborde sous le pull, le nombril, la chair du cou au col
  S.push(ell(0.19, 0.075, 0.148, 0, 0.05, 0.034, K.skinB, 0, 0, 0, 16, 8), ell(0.012, 0.009, 0.006, 0, 0.05, 0.181, K.skinD));
  S.push(box(0.05, 0.0035, 0.003, 0.07, 0.06, 0.168, K.vein, 0, 0.45, 0.5), box(0.045, 0.0035, 0.003, -0.06, 0.04, 0.17, K.vein, 0, -0.4, -0.4));
  S.push(cyl(0.072, 0.08, 0.06, 0, 0.53, 0.008, K.skinD, 0.9));

  /* ---- tête (os du cou) : crâne commun, visage gonflé (bajoues), bouche ouverte d'où coule la vase */
  const head = zHeadCore(k, K).concat([
    ell(0.062, 0.03, 0.06, 0, H - 0.118, 0.022, K.skinD, 0.28),                                                   // menton gonflé, plus sombre
    box(0.006, 0.05, 0.005, -0.011, H - 0.126, 0.09, K.mud, 0.25), box(0.005, 0.075, 0.005, 0.013, H - 0.142, 0.083, K.mud, 0.25),
  ]);
  const eyes = mergeGeometries([ell(0.018, 0.0115, 0.008, -0.04, H - 0.003, 0.106, null, 0, 0, 0, 10, 6), ell(0.018, 0.0115, 0.008, 0.04, H - 0.003, 0.106, null, 0, 0, 0, 10, 6)]);

  /* ---- cheveux (facultatifs) : une calotte collée au crâne (front dégarni, nuque couverte), et des mèches
     mouillées, fines, qui en sortent et pendent sur la nuque et derrière les oreilles */
  const hair = [cap(1.9, 0.1, 0.121, 0.111, 0, H + 0.002, -0.006, K.hair, -0.6)];
  const sk = (phi, y, out = 0.004) => { const u = clamp((y - H) / 0.118, -0.98, 0.98), r = Math.sqrt(1 - u * u); return V(Math.sin(phi) * (0.096 * r + out), y, 0.004 + Math.cos(phi) * (0.106 * r + out)); };
  const nrmS = (p) => V(p.x / 0.0092, (p.y - H) / 0.0139, (p.z - 0.004) / 0.0112).normalize();
  const flat = (a, b, n, w, t = 0.0035) => {
    const Y = b.clone().sub(a), len = Y.length(); Y.normalize();
    const Z = n.clone().addScaledVector(Y, -n.dot(Y)).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
    const m = new THREE.Matrix4().makeBasis(X, Y, Z); m.setPosition(a.clone().add(b).multiplyScalar(0.5)); m.scale(V(w, len + 0.004, t));
    hair.push({ geo: GEO.box, matrix: m, color: K.hair });
  };
  const clump = (pts, w0, w1) => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1], mid = a.clone().add(b).multiplyScalar(0.5);
      flat(a, b, mid.y > H - 0.07 ? nrmS(mid) : V(mid.x, 0, mid.z - 0.004).normalize(), lerp(w0, w1, k / Math.max(1, pts.length - 2)) * rr(0.85, 1.15));
    }
  };
  // nuque et côtés : mèches fines, plaquées, qui partent derrière les oreilles (rien sur le front ni les tempes :
  // de près, des mèches isolées sur un front dégarni se lisaient comme des sourcils ou des œillères)
  for (let i = 0; i < 15; i++) {
    const phi = Math.PI + (i / 14 - 0.5) * 2.9 + rr(-0.07, 0.07), dr = rr(-0.08, 0.08), back = Math.cos(phi) < -0.35;
    const y0 = H + rr(0.0, 0.03), a = sk(phi, y0, 0.006), b = sk(phi + dr * 0.5, back ? H - 0.07 : H - 0.04, 0.008);
    const pts = [a, b];
    if (back) pts.push(V(b.x * 0.8, H - rr(0.12, 0.16), b.z * 0.68 - 0.012), V(b.x * 0.72 + rr(-0.01, 0.01), H - rr(0.17, 0.24), b.z * 0.62 - 0.016));
    else pts.push(sk(phi + dr, H - rr(0.06, 0.09), 0.01));
    clump(pts, rr(0.015, 0.021), 0.006);
  }
  /* ---- bonnet de marin en laine (facultatif, teinte de l'apparence) : calotte souple un peu haute, revers
     roulé, côtes du tricot sur le revers */
  const capG = [cap(Math.PI * 0.5, 0.108, 0.098, 0.116, 0, H + 0.03, -0.008, K.knit, -0.16),
    cyl(0.111, 0.114, 0.052, 0, H + 0.028, -0.006, K.knit, 1.06, -0.16, 0, 0, 22),
    tor(0.112, 0.012, 0, H + 0.054, -0.01, K.knit, Math.PI / 2 - 0.16, 0, 0, 1, 1, 1.06, 22)];
  for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; capG.push(box(0.007, 0.046, 0.004, Math.sin(a) * 0.115, H + 0.028 + Math.cos(a) * 0.019, -0.006 + Math.cos(a) * 0.121, C(0xa2a29e, 1.0), 0, a, 0)); }

  /* ---- bras : manche du ciré jusqu'au coude (couture, bout déchiré, une algue) ; avant-bras nu, gonflé */
  const upper = [ell(0.075, 0.071, 0.075, 0, -0.005, 0, K.jacket), cyl(0.071, 0.064, 0.3, 0, -0.15, 0, K.jacket), box(0.006, 0.29, 0.004, 0.0, -0.15, -0.069, K.jacketD)];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3, l = 0.022 + (i % 3) * 0.014; upper.push(box(0.03, l, 0.006, Math.sin(a) * 0.063, -0.3 - l / 2, Math.cos(a) * 0.063, K.jacket, 0.15 * Math.cos(a), a, 0.2 * ((i % 3) - 1))); }
  ribbon(upper, [V(0.03, 0.02, 0.07), V(0.04, -0.12, 0.077), V(0.03, -0.26, 0.078), V(0.05, -0.36, 0.07)], 0.022, K.algaeD);
  const fore = [cyl(0.05, 0.037, 0.25, 0, -0.125, 0, K.skin), ell(0.043, 0.076, 0.041, 0.004, -0.1, 0.004, K.skinB)];
  for (const [y, rz] of [[-0.08, 0.3], [-0.15, -0.2]]) fore.push(box(0.003, 0.05, 0.003, 0.043, y, 0.012, K.vein, 0, 0, rz));
  fore.push(...maNoyeHand(k, K));

  /* ---- jambes : pantalon trempé, cuissardes de caoutchouc (revers à mi-cuisse) */
  const thigh = [cyl(0.092, 0.07, 0.44, 0, -0.22, 0, K.trousers), ell(0.1, 0.13, 0.093, 0, -0.13, 0, K.trousers),
    cyl(0.083, 0.072, 0.21, 0, -0.335, 0, K.boot), cyl(0.088, 0.086, 0.04, 0, -0.236, 0, K.bootD)];
  const shin = [cyl(0.073, 0.064, 0.34, 0, -0.17, 0, K.boot), box(0.105, 0.075, 0.25, 0, -0.39, 0.05, K.boot), ell(0.052, 0.04, 0.052, 0, -0.395, 0.162, K.boot),
    box(0.11, 0.02, 0.27, 0, -0.432, 0.05, K.bootD), box(0.1, 0.03, 0.075, 0, -0.415, -0.06, K.bootD)];

  // fusion et salissures (boue vers le bas, taches fondues)
  const G = {
    torso: mnGrime(mergeGeometries(T), MUD, 0.05, (x, y) => 0.55 * sm(0.12, -0.2, y), 1),
    chest: mnGrime(mergeGeometries(S), K.skinD, 0, (x, y) => 0.3 * sm(0.1, -0.02, y), 2, 0.2),
    head: mnGrime(mergeGeometries(head), K.skinD, 0, (x, y) => 0.35 * sm(H - 0.02, H - 0.13, y), 3, 0.18),
    hair: mnGrime(mergeGeometries(hair), MUD, 0.05, null, 4, 0.3),
    cap: mnGrime(mergeGeometries(capG), MUD, 0.08, null, 5, 0.25),
    upper: mnGrime(mergeGeometries(upper), MUD, 0.08, (x, y) => 0.25 * sm(-0.12, -0.32, y), 6),
    fore: mnGrime(mergeGeometries(fore), K.skinD, 0.02, (x, y) => 0.25 * sm(-0.2, -0.32, y), 7, 0.18),
    thigh: mnGrime(mergeGeometries(thigh), MUD, 0.12, (x, y) => 0.3 * sm(-0.1, -0.44, y), 8),
    shin: mnGrime(mergeGeometries(shin), MUD, 0.25, (x, y) => 0.45 * sm(-0.1, -0.44, y), 9),
  };
  G.eyes = eyes;
  G.armStump = zStumps(k, K, K.trousers, K.jacket).armStump;
  return G;
}
Object.defineProperty(ZVGEO, 'ma_noye', { configurable: true, enumerable: true, get() { const g = maNoyeGeometries(); Object.defineProperty(ZVGEO, 'ma_noye', { value: g, enumerable: true }); return g; } });
/* Apparence : teintes de peau et d'étoffe, cheveux, bonnet (et sa couleur). */
const MA_NOYE_CAPS = [0x2c3a52, 0x7a3026, 0x6e5e2c, 0x4a4a48, 0x2e4a3e];
function maNoyeLook() {
  const r = Math.random();
  return { skin: pick([0xffffff, 0xeef4ee, 0xf6f2ea, 0xe2ebe6]), cloth: pick([0xffffff, 0xeaeee4, 0xf6f0e2, 0xdfe4dc]), eyes: MA_NOYE_EYE_LIN,
    helmet: false, helmetColor: pick(MA_NOYE_CAPS), hair: r < 0.75, cap: r > 0.55 };
}

/* ---------------------------------------------------------------- État commun -- */
const MA_NOYES = { t: 0, waterT: 0, first: 5, kickCd: 0, rip: 3, pathBudget: 1, spawned: 0, killed: 0, eaten: 0, packs: 0, waiting: 0, attackers: 0, seen: false, hintGrip: false, hintGrab: false, hintShore: false, hintWait: false, muffled: false, noise: null };
const MA_NOYE_BONES = ['root', 'body', 'pelvis', 'hips', 'neck', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'knL', 'knR'];
const _mnV = new THREE.Vector3(), _mnW = new THREE.Vector3(), _mnN = new THREE.Vector3(), _mnE = new THREE.Vector3(), _mnH = new THREE.Vector3(), _mnA = new THREE.Vector3(), _mnB = new THREE.Vector3();
/* Un noyé (en partie : slot de la horde ; écran « Modèles » : R à part, spec). */
function maNoyeObject(slot, look, R = null) {
  const [s0, s1] = MA_NOYE.speed(typeof G !== 'undefined' && G.round ? G.round : 1);
  const hp = Math.round(khHp(Math.max(1, (typeof G !== 'undefined' && G.round) || 1)) * MA_NOYE.hp);
  return {
    id: ++Zombies.seq, slot, R, type: MA_NOYE_TYPE, model: 'ma_noye', noye: true, rig: makeRig(), look, helmetOn: false, alive: true, outside: false,
    state: 'rise', ns: 'rise', st: 0, t: 0, hp, maxHp: hp, pos: new THREE.Vector3(), root: new THREE.Vector3(), k: -1, gy: 0, layer: 0,
    yaw: 0, vx: 0, vz: 0, moving: 0, speedType: 'jog', speed: 1, nspd: rand(s0, s1), win: null, gib: 0, headless: false, crawl: false,
    stagger: 0, flinch: 0, knockX: 0, knockZ: 0, knockT: 0, knockDur: 0, knockDir: 1, knockK: 0, knockShift: false, reelT: 0, called: null, nukeT: 0, deathKind: null,
    losT: 0, los: false, stuck: 0, stuckT: 0, lastX: 0, lastZ: 0, farT: 0,
    wl: typeof MA !== 'undefined' ? MA.water : 0, hx: 0, hz: 0, ey: -1.9, eyT: -1.9, glow: 0, blinkT: rand(2, 5), blink: 0, seed: rand(0, 10), lean: 0.4, cd: 0,
    act: null, actT: 1, grip: null, gripW: new THREE.Vector3(), gripArm: 'elL', surgeTo: null, nav: null, stunT: 0, grabT: 0, biteAcc: 0, sinkV: 0, stareT: 0,
    gurgleT: rand(1.5, 4), moanT: rand(5, 12), ripT: 0, hitT: 0, blendK: 5,
  };
}
/* Sort du fond en (x, z), tourné vers yaw. */
function maNoyeSpawn(x, zz, yaw) {
  if (!ZR.free.length) {
    // horde pleine : on reprend la place d'un mort qu'on ne voit plus (Noyé à plus de 0,8 m sous l'eau), sinon
    // celle du corps le plus loin, à plus de 35 m ; jamais un corps visible près du joueur (il disparaîtrait)
    let best = null, bs = -1;
    for (const q of Zombies.list) {
      if (q.alive || q.removed) continue;
      const deep = q.noye && q.ey < (q.wl || 0) - 0.8, d = Math.hypot(q.pos.x - player.pos.x, q.pos.z - player.pos.z);
      if (!deep && d < 35) continue;
      const sc = (deep ? 1e6 : 0) + d;
      if (sc > bs) { bs = sc; best = q; }
    }
    if (!best) return null;
    removeZombie(best);
  }
  const slot = ZR.free.pop(), look = maNoyeLook();
  paintZombieSlot(slot, look, ZR, 'ma_noye');
  const z = maNoyeObject(slot, look);
  z.hx = x; z.hz = zz; z.yaw = yaw; z.wl = MA.water; z.ey = z.eyT = MA.water - 1.9;
  Zombies.list.push(z);
  maNoyeAnimate(z, 0);
  writeZombieMatrices(z);
  maBubbles(x, zz, 5, 0.5);
  maEmit('noye', { what: 'sort', id: z.id, x: Math.round(x), z: Math.round(zz) });
  return z;
}
function maNoyeState(z, s) {
  z.ns = s; z.st = 0; z.waiting = false;
  if (z.alive) z.state = s === 'rise' ? 'rise' : 'noye';
  switch (s) {
    case 'surge': maNoyeSnd('screech', z.hx, z.hz); maSplash(z.hx, z.hz, 0.7, { up: 0.9 }); z.blendK = 10; break;
    case 'grip': maNoyeSnd('slap', z.hx, z.hz); maSplash(z.hx, z.hz, 0.5, { up: 0.6 }); z.actT = rand(0.5, 0.9); z.act = null; z.blendK = 12; maEmit('noye', { what: 'agrippe', id: z.id }); break;
    case 'fall': maSplash(z.hx, z.hz, 0.8, { up: 0.9 }); maSplashSnd(z.hx, z.hz, 0.6); z.grip = null; z.surgeTo = null; z.blendK = 7; break;
    case 'stun': z.grip = null; z.surgeTo = null; z.blendK = 8; break;
    case 'stare': z.stareT = rand(MA_NOYE.stare[0], MA_NOYE.stare[1]); z.grip = null; z.surgeTo = null; z.blendK = 4; break;
    case 'grab': z.blendK = 10; break;
    default: z.blendK = 5;
  }
}
/* À terre : ils restent dans l'eau à regarder ; puis ils retournent au fond. */
function maNoyeStare(z) {
  if (!z.alive || z.ns === 'stare' || z.ns === 'rise') return;
  if (player.grabbedBy === z) maNoyeRelease(z);
  if (z.ns === 'grip') maSplash(z.hx, z.hz, 0.7, { up: 0.8 });
  maNoyeState(z, 'stare');
}
function maNoyeLeave(z) {
  if (!z.alive) return;
  if (player.grabbedBy === z) maNoyeRelease(z);
  z.alive = false; z.state = 'dead'; z.grip = null; z.surgeTo = null; z.sinkV = 0;
  maNoyeState(z, 'sink');
  z.blendK = 2.5;
  maNoyeSnd('sink', z.hx, z.hz);
  maEmit('noye', { what: 'coule', id: z.id });
}

/* ---------------------------------------------------------------- La barque -- */
/* Forme du plat-bord (barque.js : demi-largeur et tonture ; u : 0 étrave → 1 tableau), en coordonnées de la
   barque : lf vers l'avant (m, −2,2 au tableau, 2,2 à l'étrave), côté s (+1 tribord, à droite). */
const maHullHB = (u) => { const a = u < 0.5 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.5)), 0.85) : 1; return 0.06 + 0.72 * a - 0.08 * owSmoothstep(0.8, 1, u); };
const maHullSheer = (u) => 0.34 + 0.24 * Math.pow(1 - u, 3) + 0.02 * u;
const maHullU = (lf) => clamp((2.2 - lf) / 4.4, 0, 1);
const maHullHalf = (lf) => maHullHB(maHullU(lf));
/* Point du plat-bord (bord extérieur, dessus) dans le monde, et la normale vers l'extérieur. */
function maNoyeGunwale(V, lf, s, out, nOut) {
  const u = maHullU(lf);
  out.set(s * (maHullHB(u) + 0.015), maHullSheer(u) + 0.008, -lf).applyMatrix4(V.group.matrixWorld);
  if (nOut) nOut.set(s, 0, 0).transformDirection(V.group.matrixWorld);
  return out;
}
/* Coordonnées d'un point dans le repère de la barque (à plat). */
function maNoyeBoatLocal(V, x, z) {
  const [fx, fz] = vehFwd(V.yaw), dx = x - V.x, dz = z - V.z;
  return [dx * fx + dz * fz, dx * -fz + dz * fx];
}
/* Une place libre le long du plat-bord (0,8 m entre deux noyés), la plus proche de lf. */
function maNoyeGripSlot(V, lf, s, self) {
  const lo = -1.7, hi = 1.5;
  const taken = (c) => Zombies.list.some((o) => o !== self && o.noye && o.alive && ((o.grip && o.grip.V === V && o.grip.s === s && Math.abs(o.grip.lf - c) < 0.75) || (o.surgeTo && o.surgeTo.V === V && o.surgeTo.s === s && Math.abs(o.surgeTo.lf - c) < 0.75)));
  for (const d of [0, 0.8, -0.8, 1.6, -1.6]) { const c = clamp(lf + d, lo, hi); if (!taken(c)) return c; }
  return null;
}
/* Le barreur est-il à portée de ses griffes (depuis le point d'attache) ? */
function maNoyeReachPilot(V, lf, s) {
  const T = V.T, seatLf = -T.seat[2], seatLr = T.seat[0];
  return Math.hypot(lf - seatLf, s * maHullHalf(lf) - seatLr) < MA_NOYE.grip.reach;
}
/* Contact avec la barque pendant l'approche : elle lui passe dessus (lancée), ou il jaillit pour s'agripper. */
function maNoyeBoatContact(z, V, noSurge) {
  const [lf, lr] = maNoyeBoatLocal(V, z.hx, z.hz), sp = Math.abs(V.v || 0);
  if (Math.abs(lf) < 2.35 && Math.abs(lr) < maHullHalf(clamp(lf, -2.2, 2.2)) + 0.3 && sp > MA_NOYE.ram.at) { maNoyeRammed(z, V); return; }
  if (noSurge || z.hunt === false || z.cd > 0 || sp > MA_NOYE.surge.boatMax || (z.gib & 3) === 3) return;
  const lfc = clamp(lf, -1.7, 1.5), gap = Math.hypot(lf - lfc, Math.max(0, Math.abs(lr) - maHullHalf(lfc)));
  if (gap > MA_NOYE.surge.at) return;
  const s = lr >= 0 ? 1 : -1, slot = maNoyeGripSlot(V, lfc, s, z);
  if (slot === null) return;
  z.surgeTo = { V, lf: slot, s };
  maNoyeState(z, 'surge');
}
/* La barque lancée lui passe dessus : il est blessé et enfoncé, la coque cogne. */
function maNoyeRammed(z, V) {
  const [fx, fz] = vehFwd(V.yaw), [, lr] = maNoyeBoatLocal(V, z.hx, z.hz), s = lr >= 0 ? 1 : -1, k = Math.sign(V.v) || 1;
  maBoatDamage(V, MA_NOYE.ram.hull, 'noye');
  V.v *= 0.85; V.pv += 0.06; V.rv += (Math.random() - 0.5) * 0.3;
  if (V.bsnd) V.bsnd.clunk(0.9);
  if (V === VEH.drive) maSecousse(0.18);
  maSplash(z.hx, z.hz, 0.9, { up: 0.9 });
  const killed = damageZombie(z, z.maxHp * MA_NOYE.ram.dmg, { kind: 'vehicle', dx: fx * k, dz: fz * k, force: 2 });
  if (!killed && z.alive) {
    z.vx = -fz * s * 2.4 + fx * k * 0.6; z.vz = fx * s * 2.4 + fz * k * 0.6;
    z.cd = Math.max(z.cd, 2); z.stunT = 1.5;
    maNoyeState(z, 'stun');
    maNoyeSnd('gurgle', z.hx, z.hz);
  }
}

/* ---------------------------------------------------------------- Le nageur -- */
function maNoyeGrab(z) {
  maNoyeState(z, 'grab');
  z.grabT = MA_NOYE.grab.dur; z.biteAcc = 0;
  player.grabT = z.grabT; player.grabbedBy = z;
  playerDamage(MA_NOYE.grab.bite);
  maNoyeSnd('bite', z.hx, z.hz);
  maSplash(player.pos.x, player.pos.z, 0.9, { up: 0.9 });
  maSecousse(0.35);
  if (!MA_NOYES.hintGrab) { MA_NOYES.hintGrab = true; HUD.hint('Un Noyé vous tient et vous enfonce ! V : un coup de pied le repousse', 3.5); }
  else HUD.hint('Agrippé ! V : coup de pied', 1.6);
  maEmit('noye', { what: 'saisit', id: z.id });
}
/* Il lâche le nageur (fin de la prise, coup de pied, mort, joueur à terre) : un court répit avant la suivante. */
function maNoyeRelease(z, kicked) {
  if (player.grabbedBy !== z) return;
  player.grabbedBy = null;
  if (player.grabT < 90) player.grabT = 0;                // (99 : la bête dévore, rien à voir ici)
  player.grabFreeT = MA_NOYE.grab.free;
  z.cd = Math.max(z.cd, MA_NOYE.grab.cd);
  if (z.alive && z.ns === 'grab' && !kicked) maNoyeState(z, 'fall');
}
/* Coup de pied du nageur (V ou E ; il n'a pas d'arme) : libère d'une prise, repousse et sonne le plus proche. */
function maNoyeKickInput(C) {
  const S = MA_NOYES, p = player;
  if (!C.swim || p.down || S.kickCd > 0 || !(pressed('KeyV') || pressed('KeyE'))) return;
  S.kickCd = MA_NOYE.kick.cd;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  let tgt = p.grabbedBy && p.grabbedBy.noye && p.grabbedBy.alive ? p.grabbedBy : null;
  if (!tgt) {
    let bd = MA_NOYE.kick.r;
    for (const z of Zombies.list) {
      if (!z.noye || !z.alive || z.ns === 'rise') continue;
      const dx = z.hx - p.pos.x, dz = z.hz - p.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > -0.25) { bd = d; tgt = z; }
    }
  }
  maNoyeSnd('kick', p.pos.x + fx * 0.6, p.pos.z + fz * 0.6);
  maSplash(p.pos.x + fx * 0.7, p.pos.z + fz * 0.7, 0.5, { up: 0.7 });
  if (!tgt) return;
  const dx = tgt.hx - p.pos.x, dz = tgt.hz - p.pos.z, d = Math.hypot(dx, dz) || 1;
  if (p.grabbedBy === tgt) maNoyeRelease(tgt, true);
  const killed = damageZombie(tgt, MA_NOYE.kick.dmg, { kind: 'knife', dx: dx / d, dz: dz / d, force: 1 });
  HUD.hitmarker(killed);
  if (!killed && tgt.alive) {
    tgt.vx = (dx / d) * MA_NOYE.kick.push; tgt.vz = (dz / d) * MA_NOYE.kick.push;
    tgt.cd = Math.max(tgt.cd, 2); tgt.stunT = MA_NOYE.kick.stun;
    maNoyeState(tgt, 'stun');
  }
}
/* La prise ne survit pas à son noyé (mort, retourné au fond, joueur hors de l'eau ou à terre). */
function maNoyeGrabGuard(dt, C) {
  if (player.grabFreeT > 0) player.grabFreeT -= dt;
  const z = player.grabbedBy;
  if (!z || !z.noye) return;
  if (!z.alive || z.removed || z.ns !== 'grab' || !C.swim || player.down) maNoyeRelease(z);
}

/* ---------------------------------------------------------------- Déplacement -- */
/* Eau où ils peuvent être : dans les limites, ni ponton ni bâtiment, assez profonde. */
function maNoyeCellBase(x, z) {
  const B = OW.walk;
  if (x < B[0] || x > B[2] || z < B[1] || z > B[3]) return false;
  const k = owKind(OW.surf, Math.floor(x), Math.floor(z));
  return k === OWK.TERRAIN || k === OWK.WATER;
}
const maNoyeCellOk = (x, z) => maDepth(x, z) >= MA_NOYE.minDepth && maNoyeCellBase(x, z);
/* Penché d'autant plus que l'eau est basse (les pieds ne traversent pas le fond). */
const maNoyeLeanFor = (z, lean) => clamp(Math.max(lean, 0.3 + (1.75 - maDepth(z.hx, z.hz)) * 0.7), 0.1, 1.2);
/* Où viser pour aller en (tx, tz) : tout droit si l'eau le permet, sinon le chemin de la grille de la bête
   (un calcul par image au plus pour tous les noyés). */
function maNoyeSteer(z, tx, tz) {
  const P = z.nav || (z.nav = { path: null, t: -99, tx: 0, tz: 0, i: 0, ct: -99, clear: true, cx: 0, cz: 0 });
  if (G.time - P.ct > 0.4 || Math.abs(tx - P.cx) + Math.abs(tz - P.cz) > 3) { P.ct = G.time; P.cx = tx; P.cz = tz; P.clear = maNavClear(z.hx, z.hz, tx, tz, MA_NOYE.minDepth); }
  if (P.clear || !MA_NAV.dep) return [tx, tz];
  if ((!P.path || Math.hypot(tx - P.tx, tz - P.tz) > 8 || G.time - P.t > 3) && MA_NOYES.pathBudget > 0) {
    MA_NOYES.pathBudget--;
    P.path = maNavPath(z.hx, z.hz, tx, tz, MA_NOYE.navDepth); P.tx = tx; P.tz = tz; P.t = G.time; P.i = 0;
  }
  const W = P.path && P.path.pts;
  if (!W || !W.length) return [tx, tz];
  let i = Math.min(P.i, W.length - 1);
  for (let k = i + 1; k < Math.min(W.length, i + 10); k++) if (maNavClear(z.hx, z.hz, W[k][0], W[k][1], MA_NOYE.minDepth)) i = k;
  P.i = i;
  return W[i];
}
function maNoyeMove(z, ax, az, sp, dt, turn = 1.8) {
  const dx = ax - z.hx, dz = az - z.hz, d = Math.hypot(dx, dz);
  if (d > 0.05) z.yaw = turnTo(z.yaw, Math.atan2(dx, dz), turn * dt);
  const off = d > 0.05 ? Math.abs(wrapAngle(Math.atan2(dx, dz) - z.yaw)) : 0;
  const s = sp * (off > 1.2 ? 0.35 : off > 0.6 ? 0.7 : 1) * Math.min(1, d / 0.6);
  z.vx = damp(z.vx, Math.sin(z.yaw) * s, 2.5, dt); z.vz = damp(z.vz, Math.cos(z.yaw) * s, 2.5, dt);
  maNoyeAdvance(z, dt);
}
/* Un pas : écartés les uns des autres, jamais dans une coque, pas hors de l'eau profonde (ils glissent le
   long du bord). */
function maNoyeAdvance(z, dt) {
  for (const o of Zombies.list) {
    if (o === z || !o.noye || o.removed || !o.alive) continue;
    const ox = z.hx - o.hx, oz = z.hz - o.hz, d2 = ox * ox + oz * oz;
    if (d2 < 1.1 && d2 > 1e-6) { const d = Math.sqrt(d2), f = (1.05 - d) * 3 * dt; z.vx += (ox / d) * f; z.vz += (oz / d) * f; }
  }
  let nx = z.hx + z.vx * dt, nz = z.hz + z.vz * dt;
  // retombé dans moins d'un mètre d'eau (barque, coup de pied) : il peut toujours aller vers plus profond
  const here = maDepth(z.hx, z.hz), ok = (x, zz) => maNoyeCellOk(x, zz) || (here < MA_NOYE.minDepth && maDepth(x, zz) > here + 1e-3 && maNoyeCellBase(x, zz));
  if (!ok(nx, nz)) {
    const sp = Math.hypot(z.vx, z.vz), a0 = Math.atan2(z.vx, z.vz);
    let found = false;
    for (const da of [0.5, -0.5, 1.0, -1.0, 1.55, -1.55, 2.2, -2.2, Math.PI]) {
      const a = a0 + da, tx = z.hx + Math.sin(a) * Math.max(sp, 0.3) * dt, tz = z.hz + Math.cos(a) * Math.max(sp, 0.3) * dt;
      if (ok(tx, tz)) { nx = tx; nz = tz; found = true; break; }
    }
    if (!found) { nx = z.hx; nz = z.hz; z.vx *= 0.3; z.vz *= 0.3; }
  }
  for (const V of VEH.list) {
    if (!V.T.boat || V.wrecked) continue;
    const [lf, lr] = maNoyeBoatLocal(V, nx, nz), hb = maHullHalf(clamp(lf, -2.2, 2.2)) + 0.3;
    if (Math.abs(lf) > 2.5 || Math.abs(lr) > hb) continue;
    const [fx, fz] = vehFwd(V.yaw), pr = hb - Math.abs(lr), pf = 2.5 - Math.abs(lf);
    if (pr < pf) { const s = Math.sign(lr) || 1; nx += -fz * s * pr; nz += fx * s * pr; }
    else { const s = Math.sign(lf) || 1; nx += fx * s * pf; nz += fz * s * pf; }
  }
  // kit MM 2.1.7 : autour d'un nageur, seul celui qui le saisit (ou jaillit sur lui) vient à moins de 1,4 m ; les
  // autres reculent (à 2,5 m/s au plus) : pas de crâne collé à la caméra après une prise ou un saut manqué
  if (MA_SWIM.on && z.alive && z.ns !== 'grab' && z.ns !== 'surge') {
    const px = player.pos.x, pz = player.pos.z, dx = nx - px, dz = nz - pz, d = Math.hypot(dx, dz), R = 1.4;
    if (d < R) {
      const ux = d > 1e-3 ? dx / d : Math.sin(z.yaw + Math.PI), uz = d > 1e-3 ? dz / d : Math.cos(z.yaw + Math.PI), push = Math.min(R - d, 2.5 * dt);
      if (maNoyeCellBase(nx + ux * push, nz + uz * push)) { nx += ux * push; nz += uz * push; }
    }
  }
  z.hx = nx; z.hz = nz;
  z.moving = Math.hypot(z.vx, z.vz);
}
/* Sillage : de petits ronds devant le crâne (3 par seconde au plus pour tous : les ronds de l'eau sont 24). */
function maNoyeWake(z, dt) {
  z.ripT -= dt;
  if (z.ripT > 0 || z.moving < 0.35 || MA_NOYES.rip < 1 || z.ey < z.wl - 0.08) return;
  if (Math.hypot(z.hx - camera.position.x, z.hz - camera.position.z) > 40) return;
  MA_NOYES.rip -= 1; z.ripT = rand(0.45, 0.7);
  maRipple(z.hx + Math.sin(z.yaw) * 0.12, z.hz + Math.cos(z.yaw) * 0.12, 0.006 + 0.004 * Math.min(2, z.moving));
}
/* Cible : la barque menée (là où elle sera, un peu en avance) ou le nageur ; et sa distance. */
function maNoyeTarget(z, C) {
  if (C.V) {
    const V = C.V, [fx, fz] = vehFwd(V.yaw), sp = V.v || 0, d = Math.hypot(V.x - z.hx, V.z - z.hz);
    const lead = Math.min(2.5, d / Math.max(1, z.nspd + 0.5)) * 0.7;
    return [V.x + fx * sp * lead, V.z + fz * sp * lead, d];
  }
  const p = player.pos;
  return [p.x, p.z, Math.hypot(p.x - z.hx, p.z - z.hz)];
}

/* ---------------------------------------------------------------- Un noyé, chaque image -- */
function maNoyeStep(z, dt, C) {
  z.t += dt; z.st += dt;
  if (z.cd > 0) z.cd -= dt;
  z.flinch = damp(z.flinch, 0, 8, dt);
  if (z.stagger > 0) z.stagger -= dt;
  // les coups le font reculer (balles, souffle)
  if (z.knockX || z.knockZ) {
    if (z.ns !== 'grip' && z.ns !== 'grab') { const nx = z.hx + z.knockX * dt * 0.3, nz = z.hz + z.knockZ * dt * 0.3; if (maNoyeCellOk(nx, nz)) { z.hx = nx; z.hz = nz; } }
    z.knockX = damp(z.knockX, 0, 4, dt); z.knockZ = damp(z.knockZ, 0, 4, dt);
    if (Math.abs(z.knockX) + Math.abs(z.knockZ) < 0.02) z.knockX = z.knockZ = 0;
  }
  if (z.alive && z.nukeT > 0) { z.nukeT -= dt; if (z.nukeT <= 0) killZombie(z, { kind: 'nuke', dx: rand(-1, 1), dz: rand(-1, 1) }); }
  // clignements
  z.blinkT -= dt;
  if (z.blinkT <= 0) { z.blink = 0.13; z.blinkT = rand(2.5, 7); }
  if (z.blink > 0) z.blink -= dt;
  if (z.alive && !C.onWater && z.ns !== 'stare' && z.ns !== 'rise') maNoyeStare(z);
  const bob = 0.012 * Math.sin(z.t * 1.7 + z.seed) + 0.006 * Math.sin(z.t * 3.1 + z.seed * 2);
  let glow = 1, eyeK = 5;
  switch (z.ns) {
    case 'rise': {
      const k = clamp(z.st / MA_NOYE.rise, 0, 1);
      z.eyT = lerp(z.wl - 1.9, z.wl + 0.035, smooth(k));
      eyeK = 12;
      if (C.onWater) { const [tx, tz] = maNoyeTarget(z, C); z.yaw = turnTo(z.yaw, Math.atan2(tx - z.hx, tz - z.hz), 1.2 * dt); }
      z.vx = damp(z.vx, Math.sin(z.yaw) * 0.3, 2, dt); z.vz = damp(z.vz, Math.cos(z.yaw) * 0.3, 2, dt);
      maNoyeAdvance(z, dt);
      z.lean = maNoyeLeanFor(z, 0.45);
      if (k >= 0.93 && !z.surf) { z.surf = true; maNoyeSnd('surface', z.hx, z.hz); maRipple(z.hx, z.hz, 0.03); maSplash(z.hx, z.hz, 0.3, { up: 0.5 }); }
      if (k >= 1) maNoyeState(z, C.onWater ? 'stalk' : 'stare');
      break;
    }
    case 'stalk': {
      const [tx, tz, d] = maNoyeTarget(z, C);
      if (d > MA_NOYE.far) { maNoyeLeave(z); break; }
      const W = maNoyeWaitPoint(z, C);
      z.waiting = !!W;
      if (W) {
        // il attend son tour : il glisse lentement sur son cercle, face au joueur, le nez hors de l'eau
        const dx = W[0] - z.hx, dz = W[1] - z.hz, dd = Math.hypot(dx, dz) || 1, WS = MA_NOYE.wait.speed;
        const s = (dd > 3.5 ? z.nspd * 0.85 : Math.min(z.nspd, lerp(WS[0], WS[1], clamp((dd - 0.5) / 2.5, 0, 1)))) * (z.stagger > 0 ? 0.3 : 1);
        z.vx = damp(z.vx, (dx / dd) * s, 2, dt); z.vz = damp(z.vz, (dz / dd) * s, 2, dt);
        maNoyeAdvance(z, dt);
        z.yaw = turnTo(z.yaw, Math.atan2(player.pos.x - z.hx, player.pos.z - z.hz), 2.4 * dt);
        z.eyT = z.wl + 0.07 + bob;
        z.lean = damp(z.lean, maNoyeLeanFor(z, 0.34), 2, dt);
        if (C.V) maNoyeBoatContact(z, C.V, true);             // une barque peut encore lui passer dessus
        maNoyeWake(z, dt);
        break;
      }
      const [ax, az] = maNoyeSteer(z, tx, tz), near = owSmoothstep(9, 3, d);
      const sp = z.nspd * (1 + 0.2 * near) * (z.stagger > 0 ? 0.3 : 1) * (C.down ? 0.35 : 1);
      maNoyeMove(z, ax, az, sp, dt);
      z.eyT = z.wl + 0.03 + 0.06 * near + bob;
      z.lean = damp(z.lean, maNoyeLeanFor(z, 0.42 + 0.3 * clamp(z.moving / 1.8, 0, 1)), 2, dt);
      if (C.V) maNoyeBoatContact(z, C.V);
      else if (C.swim && !C.down && z.hunt !== false && z.cd <= 0 && d < MA_NOYE.grab.at + 0.9 && !(player.grabT > 0) && !(player.grabFreeT > 0)) { z.surgeTo = 'nageur'; maNoyeState(z, 'surge'); }
      maNoyeWake(z, dt);
      break;
    }
    case 'surge': {
      const T = MA_NOYE.surge, k = clamp(z.st / T.dur, 0, 1);
      glow = 1.35; eyeK = 10;
      if (z.surgeTo === 'nageur') {
        if (player.grabbedBy && player.grabbedBy !== z) { z.cd = 1.5; maNoyeState(z, 'fall'); break; }   // un autre le tient déjà
        const p = player.pos, dx = p.x - z.hx, dz = p.z - z.hz, d = Math.hypot(dx, dz) || 1;
        z.yaw = turnTo(z.yaw, Math.atan2(dx, dz), 6 * dt);
        const s = d > 0.55 ? T.speed : 0;
        z.vx = (dx / d) * s; z.vz = (dz / d) * s;
        maNoyeAdvance(z, dt);
        z.eyT = z.wl + 0.06 + 0.2 * Math.sin(Math.PI * k);
        if (k >= 1) {
          if (C.swim && !C.down && Math.hypot(p.x - z.hx, p.z - z.hz) < 1.4 && !(player.grabT > 0) && !(player.grabFreeT > 0)) maNoyeGrab(z);
          else { z.cd = 1.5; maNoyeState(z, 'fall'); }
        }
      } else {
        const g = z.surgeTo;
        if (!g || !C.V || g.V !== C.V || C.V.capsized) { z.cd = 1.5; maNoyeState(z, 'fall'); break; }
        const V = g.V;
        maNoyeGunwale(V, g.lf, g.s, _mnV, _mnN);
        // le corps vient contre la coque, sous le plat-bord
        const bx = _mnV.x + _mnN.x * 0.42, bz = _mnV.z + _mnN.z * 0.42, dx = bx - z.hx, dz = bz - z.hz, d = Math.hypot(dx, dz) || 1;
        z.yaw = turnTo(z.yaw, Math.atan2(-_mnN.x, -_mnN.z), 7 * dt);
        const [fx, fz] = vehFwd(V.yaw), s = Math.min(T.speed, d / Math.max(dt, 1e-3));
        z.hx += ((dx / d) * s + fx * (V.v || 0)) * dt; z.hz += ((dz / d) * s + fz * (V.v || 0)) * dt;
        z.eyT = z.wl + lerp(0.06, 0.5, smooth(k));
        if (k >= 1) {
          if (d < 1.0 && Math.abs(V.v || 0) < T.boatMax + 0.4 && !V.capsized && !V.wrecked && maDepth(bx, bz) >= 0.6) { z.grip = { V, lf: g.lf, s: g.s }; z.surgeTo = null; maNoyeState(z, 'grip'); }
          else { z.cd = 1.5; maNoyeState(z, 'fall'); }
        }
      }
      break;
    }
    case 'grip': {
      const g = z.grip, V = g && g.V;
      eyeK = 14;
      if (!V || V !== C.V || V.capsized || V.wrecked || (z.gib & 3) === 3) { z.cd = 2.5; maNoyeState(z, 'fall'); break; }
      // la vitesse le fait lâcher prise ; la bête qui se jette sur la barque aussi
      const sp = Math.abs(V.v || 0);
      if (sp > MA_NOYE.grip.slip && Math.random() < (sp - MA_NOYE.grip.slip) * MA_NOYE.grip.slipK * dt) { z.cd = 2.5; maNoyeSnd('gurgle', z.hx, z.hz); maNoyeState(z, 'fall'); break; }
      if (MAB.on && (MAB.state === 'ruee' || MAB.state === 'surgit' || MAB.state === 'mord') && Math.hypot(MAB.x - V.x, MAB.z - V.z) < 16) { z.cd = 3; maNoyeState(z, 'fall'); break; }
      if (maDepth(z.hx, z.hz) < 0.6) { z.cd = 3; maNoyeState(z, 'fall'); break; }   // la barque l'entraîne vers le haut-fond : il lâche
      maNoyeGripAct(z, V, g, dt, C);
      break;
    }
    case 'grab': {
      eyeK = 10;
      if (!C.swim || C.down || player.grabbedBy !== z) { maNoyeRelease(z); if (z.ns === 'grab') { z.cd = 2; maNoyeState(z, 'fall'); } break; }
      z.grabT -= dt;
      player.grabT = Math.max(0.05, z.grabT);
      const p = player.pos;
      let dx = z.hx - p.x, dz = z.hz - p.z;
      const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      z.hx = damp(z.hx, p.x + dx * 0.5, 8, dt); z.hz = damp(z.hz, p.z + dz * 0.5, 8, dt);
      z.yaw = turnTo(z.yaw, Math.atan2(-dx, -dz), 8 * dt);
      z.eyT = z.wl + 0.1 + 0.03 * Math.sin(z.t * 9);
      z.biteAcc += dt * MA_NOYE.grab.dps;
      if (z.biteAcc >= 1) { const n = Math.floor(z.biteAcc); z.biteAcc -= n; playerDamage(n); }
      if (Math.random() < dt * 3) maSplash(p.x + rand(-0.4, 0.4), p.z + rand(-0.4, 0.4), 0.3, { up: 0.6 });
      if (z.grabT <= 0) maNoyeRelease(z);
      break;
    }
    case 'fall': {
      eyeK = 6;
      z.eyT = z.wl - 0.32 * Math.sin(Math.PI * clamp(z.st / 1.1, 0, 1));
      z.vx = damp(z.vx, 0, 2, dt); z.vz = damp(z.vz, 0, 2, dt);
      maNoyeAdvance(z, dt);
      z.lean = damp(z.lean, maNoyeLeanFor(z, 0.3), 2, dt);
      if (z.st >= 1.1) { z.cd = Math.max(z.cd, 1.5); maNoyeState(z, 'stalk'); }
      break;
    }
    case 'stun': {
      eyeK = 6;
      z.eyT = z.wl - 0.45 * Math.sin(Math.PI * clamp(z.st / Math.max(0.3, z.stunT), 0, 1));
      z.vx = damp(z.vx, 0, 1.6, dt); z.vz = damp(z.vz, 0, 1.6, dt);
      maNoyeAdvance(z, dt);
      if (z.st >= z.stunT) maNoyeState(z, C.onWater ? 'stalk' : 'stare');
      break;
    }
    case 'stare': {
      if (C.onWater) { maNoyeState(z, 'stalk'); break; }
      z.stareT -= dt;
      const p = player.pos, dx = p.x - z.hx, dz = p.z - z.hz, d = Math.hypot(dx, dz);
      if (d > 5) maNoyeMove(z, p.x, p.z, z.nspd * 0.55, dt, 1.2);
      else { z.yaw = turnTo(z.yaw, Math.atan2(dx, dz), 1.5 * dt); z.vx = damp(z.vx, 0, 2, dt); z.vz = damp(z.vz, 0, 2, dt); maNoyeAdvance(z, dt); }
      z.eyT = z.wl + 0.055 + bob;
      z.lean = damp(z.lean, maNoyeLeanFor(z, 0.25), 1.5, dt);
      if (!MA_NOYES.hintShore && d < 25 && G.state === 'playing') { MA_NOYES.hintShore = true; HUD.hint('Les Noyés ne sortent pas de l’eau : ils vous regardent, puis retournent au fond', 3.5); }
      // kit 2.0.7 : la bête le chasse (ou chasse tout près) : il reste là, à vous regarder, jusqu'à 10 s de plus
      if (z.stareT <= 0 && (z.prey || ((MAB.state === 'festin' || (MAB.state === 'ruee' && MAB.tgt && MAB.tgt.kind === 'noye')) && Math.hypot(MAB.x - z.hx, MAB.z - z.hz) < 40)) && (z.held || 0) < 10) { z.held = (z.held || 0) + dt; z.stareT = 0.01; }
      if (z.stareT <= 0 || d > MA_NOYE.far) maNoyeLeave(z);
      break;
    }
    case 'eaten': {
      // kit 2.0.7 : dans la gueule de la bête ; il se débat, disparaît avec elle sous l'eau
      eyeK = 30;
      if (!MAB.mv || !MAB.obj) { removeZombie(z); return; }
      const M = maMaw(_mnV);
      z.hx = M.x; z.hz = M.z; z.eyT = M.y - 0.12;
      glow = clamp(1 - z.st / 0.9, 0, 1) * 0.8;
      if (Math.random() < dt * 8 && M.y > MA.water) MA.drops && MA.drops.emit(M.x + rand(-0.4, 0.4), M.y - 0.3, M.z + rand(-0.4, 0.4), rand(-0.5, 0.5), rand(-1, 0.5), rand(-0.5, 0.5), rand(0.5, 1));
      if (z.st > 2.2 || (z.st > 0.6 && M.y < MA.water - 0.5)) {
        spawnPuff(M.x, MA.water + 0.05, M.z, 1.6, 3, 0x3a1612, 0.42, 0.04);   // le sang, sombre, dans l'eau
        maBubbles(M.x, M.z, 10, 1.2);
        removeZombie(z); return;
      }
      break;
    }
    case 'sink': case 'dead': {
      // il descend jusqu'au fond (2,6 m au plus) ; la lueur pâlit avec la profondeur et s'éteint au fond
      eyeK = 30;
      const dead = z.ns === 'dead', floor = Math.max(z.wl - 2.6, owH(z.hx, z.hz) + 0.25);
      z.vx = damp(z.vx, 0, dead ? 1.2 : 1.5, dt); z.vz = damp(z.vz, 0, dead ? 1.2 : 1.5, dt);
      const nx = z.hx + z.vx * dt, nz = z.hz + z.vz * dt;
      if (maNoyeCellBase(nx, nz)) { z.hx = nx; z.hz = nz; }
      if (!dead || z.st > 0.9) { z.sinkV = Math.min(dead ? 0.42 : 0.55, z.sinkV + dt * (dead ? 0.22 : 0.3)); z.eyT = Math.max(floor, z.eyT - z.sinkV * dt); }
      else z.eyT = damp(z.eyT, z.wl + 0.01, 3, dt);
      glow = dead ? 0 : 1 - owSmoothstep(0.5, 2.2, z.wl - z.ey);
      if (z.ey <= floor + 0.03) { z.restT = (z.restT || 0) + dt; glow = 0; }
      if (Math.random() < dt * (dead ? 2 : 2.5) && z.ey > z.wl - 2) maBubbles(z.hx, z.hz, 2, 0.32);
      if ((z.restT || 0) > 0.9 && z.glow < 0.03) { removeZombie(z); return; }
      break;
    }
    default: maNoyeState(z, 'stalk');
  }
  if (z.removed) return;
  z.ey = eyeK >= 30 ? z.eyT : damp(z.ey, z.eyT, eyeK, dt);
  z.glow = damp(z.glow, z.headless ? 0 : glow, glow > z.glow ? 6 : 3, dt);
  maNoyeAnimate(z, dt);
}
/* Agrippé : coups de griffes à la coque, au barreur s'il est à portée, secousses. Bras d'action : le droit
   (le gauche tient le plat-bord ; s'il est arraché, c'est l'inverse). */
function maNoyeGripAct(z, V, g, dt, C) {
  z.gripArm = z.gib & 1 ? 'elR' : 'elL';
  if (z.act) {
    z.act.t += dt;
    if (!z.act.hit && z.act.t >= 0.38) {
      z.act.hit = true;
      maNoyeGunwale(V, g.lf, g.s, _mnV, null);
      if (z.act.kind === 'swipe' && !player.down && maNoyeReachPilot(V, g.lf, g.s) && V === VEH.drive) {
        playerDamage(MA_NOYE.grip.swipe);
        maNoyeSnd('swipe', _mnV.x, _mnV.z);
      } else if (z.act.kind === 'rock') {
        V.rv -= g.s * 0.7; V.hv -= 0.22;
        if (V.bsnd) V.bsnd.clunk(0.5); else Sound.bodyFall({ x: _mnV.x, z: _mnV.z });
        maSplash(z.hx, z.hz, 0.4, { up: 0.6 });
      } else {
        maBoatDamage(V, MA_NOYE.grip.hull(G.round), 'noye');
        V.rv -= g.s * 0.35;
        maNoyeSnd('claw', _mnV.x, _mnV.z);
        maNoyeSplinters(V, _mnV, 3);
        if (V === VEH.drive) maSecousse(0.1);
      }
    }
    if (z.act.t >= 0.8) z.act = null;
    return;
  }
  z.actT -= dt;
  if (z.actT > 0 || (z.gib & 3) !== 0) return;                 // un bras arraché : l'autre tient, il ne frappe plus
  z.actT = rand(MA_NOYE.grip.every[0], MA_NOYE.grip.every[1]);
  const pilot = V === VEH.drive && !player.down && maNoyeReachPilot(V, g.lf, g.s);
  const x = Math.random();
  z.act = { kind: pilot && x < 0.6 ? 'swipe' : x < 0.75 ? 'claw' : 'rock', t: 0, hit: false };
  if (Math.random() < 0.35) maNoyeSnd('gurgle', z.hx, z.hz);
}
/* Éclats de bois arrachés par les griffes. */
function maNoyeSplinters(V, P, n) {
  const mat = V.barque && V.barque.materials ? V.barque.materials.wood : MAT.gib;
  for (let i = 0; i < n; i++) spawnDebris(mat, rand(0.015, 0.03), rand(0.01, 0.02), rand(0.08, 0.22), P.x + rand(-0.15, 0.15), P.y + 0.02, P.z + rand(-0.15, 0.15), rand(-1.2, 1.2), rand(1, 2.5), rand(-1.2, 1.2), rand(1.2, 2));
}

/* ---------------------------------------------------------------- Poses -- */
/* Clés interpolées (t, valeur), par morceaux adoucis. */
function mnKey(t, K) {
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const a = K[i - 1], b = K[i]; return lerp(a[1], b[1], smooth((t - a[0]) / (b[0] - a[0] || 1))); }
  return K[K.length - 1][1];
}
/* À la nage : penché de lean, la tête relevée (les yeux sur l'horizon), les bras fouillent l'eau devant lui
   l'un après l'autre, griffes ouvertes ; les jambes battent lentement. k : 0 sur place, 1 à pleine vitesse. */
function maNoyeSwimPose(P, z, k) {
  const c = z.t, s = z.seed, lean = z.lean;
  P.bRX = lean; P.tRX = 0.12 + 0.05 * Math.sin(c * 0.5 + s);
  P.nRX = -(lean + P.tRX) * 0.92 - 0.06; P.nRY = 0.12 * Math.sin(c * 0.31 + s); P.nRZ = 0.08 * Math.sin(c * 0.43 + 1 + s);
  const a = c * (1.6 + 1.4 * k) + s;
  P.sLX = -0.75 - 0.35 * k + 0.42 * Math.sin(a); P.sRX = -0.75 - 0.35 * k + 0.42 * Math.sin(a + Math.PI);
  P.sLZ = 0.42 + 0.18 * Math.cos(a); P.sRZ = -0.42 + 0.18 * Math.cos(a);
  P.eL = -0.55 - 0.35 * Math.max(0, Math.cos(a)); P.eR = -0.55 - 0.35 * Math.max(0, -Math.cos(a));
  const b = c * (1.9 + 1.6 * k) + s * 2;
  P.hLX = 0.1 + 0.32 * Math.sin(b); P.hRX = 0.1 + 0.32 * Math.sin(b + Math.PI);
  P.kL = 0.55 + 0.35 * Math.max(0, Math.sin(b + 0.9)); P.kR = 0.55 + 0.35 * Math.max(0, Math.sin(b + 0.9 + Math.PI));
  P.hLZ = 0.08; P.hRZ = -0.08;
}
/* Agrippé au plat-bord : coudes écartés et bas contre la coque, avant-bras qui montent raides au plat-bord,
   poignets cassés par-dessus, griffes qui crochent l'intérieur ; le buste penché sur la coque, les yeux juste
   au-dessus du bord, tournés vers le barreur. Angles totaux (corps et buste compris) : bras −60° (vers
   l'avant et le bas), avant-bras à 75° au-dessus de l'horizontale. act : griffe, coup au barreur, secousse
   (bras droit, sauf si c'est lui qui tient). */
const MA_GRIP = { b: 0.05, t: 0.32, sX: -1.047 - 0.37, e: -1.833, sZ: 0.42, n: -0.5 };
function maNoyeGripPose(P, z) {
  const c = z.t, s = z.seed, Gp = MA_GRIP;
  P.bRX = Gp.b; P.tRX = Gp.t + 0.04 * Math.sin(c * 1.3 + s);
  P.sLX = P.sRX = Gp.sX; P.eL = P.eR = Gp.e; P.sLZ = Gp.sZ; P.sRZ = -Gp.sZ;
  P.nRX = Gp.n; P.nRY = clamp(z.lookY || 0, -0.9, 0.9) * 0.8; P.nRZ = 0.06 * Math.sin(c * 0.7 + s);
  P.hLX = 0.25 + 0.15 * Math.sin(c * 1.4 + s); P.hRX = 0.25 + 0.15 * Math.sin(c * 1.4 + s + Math.PI); P.kL = 0.45; P.kR = 0.5; P.hLZ = 0.1; P.hRZ = -0.1;
  const A = z.act;
  if (!A) return;
  const t = A.t, R = z.gripArm === 'elL' ? 'R' : 'L', sx = `s${R}X`, sz = `s${R}Z`, ek = `e${R}`, sgn = R === 'R' ? 1 : -1;
  const zs = -Gp.sZ * sgn;                                // écart du bras d'action (signe de son côté)
  if (A.kind === 'claw') {
    P[sx] = mnKey(t, [[0, Gp.sX], [0.3, -2.95], [0.42, -1.9], [0.8, Gp.sX]]);
    P[ek] = mnKey(t, [[0, Gp.e], [0.3, -0.45], [0.42, -0.9], [0.8, Gp.e]]);
    P[sz] = mnKey(t, [[0, zs], [0.3, zs * 0.4], [0.42, zs * 0.7], [0.8, zs]]);
    P.tRX = mnKey(t, [[0, Gp.t], [0.3, 0.12], [0.42, 0.6], [0.8, Gp.t]]);
    P.nRX = mnKey(t, [[0, Gp.n], [0.3, -0.7], [0.42, -0.25], [0.8, Gp.n]]);
  } else if (A.kind === 'swipe') {
    P[sx] = mnKey(t, [[0, Gp.sX], [0.28, -2.75], [0.42, -2.3], [0.8, Gp.sX]]);
    P[sz] = mnKey(t, [[0, zs], [0.28, -0.3 * sgn], [0.42, 0.55 * sgn], [0.8, zs]]);
    P[ek] = mnKey(t, [[0, Gp.e], [0.28, -0.45], [0.42, -0.15], [0.8, Gp.e]]);
    P.tRY = mnKey(t, [[0, 0], [0.3, 0.2 * sgn], [0.42, -0.45 * sgn], [0.8, 0]]);
    P.tRX = mnKey(t, [[0, Gp.t], [0.3, 0.2], [0.42, 0.55], [0.8, Gp.t]]);
  } else {
    P.tRX = mnKey(t, [[0, Gp.t], [0.3, 0.05], [0.5, 0.6], [0.8, Gp.t]]);
    P.sLX = P.sRX = mnKey(t, [[0, Gp.sX], [0.3, Gp.sX + 0.2], [0.5, Gp.sX - 0.25], [0.8, Gp.sX]]);
    P.nRX = mnKey(t, [[0, Gp.n], [0.3, -0.3], [0.5, -0.75], [0.8, Gp.n]]);
  }
}
function maNoyePoseFor(z, P) {
  for (const key of ZPK) P[key] = 0;
  const c = z.t, s = z.seed, t = z.st;
  switch (z.ns) {
    case 'rise': {
      const k = clamp(t / MA_NOYE.rise, 0, 1), up = 1 - owSmoothstep(0.55, 1, k);
      maNoyeSwimPose(P, z, 0.2);
      P.bRX = lerp(0.05, z.lean, k); P.nRX = lerp(-0.55, P.nRX, k);
      P.sLX = lerp(P.sLX, -2.75 + 0.15 * Math.sin(c * 3 + s), up); P.sRX = lerp(P.sRX, -2.75 + 0.15 * Math.sin(c * 3 + s + 2), up);
      P.sLZ = lerp(P.sLZ, 0.3, up); P.sRZ = lerp(P.sRZ, -0.3, up);
      P.hLX = 0.2 + 0.4 * Math.sin(c * 4 + s); P.hRX = 0.2 + 0.4 * Math.sin(c * 4 + s + Math.PI);
      break;
    }
    case 'stalk':
      if (z.waiting) { maNoyeSwimPose(P, z, 0.12); P.nRZ += 0.16 * Math.sin(c * 0.45 + s); P.nRY *= 0.5; }   // il attend : il fait du surplace
      else maNoyeSwimPose(P, z, clamp(z.moving / 1.8, 0, 1));
      break;
    case 'stare': maNoyeSwimPose(P, z, 0); P.nRZ += 0.2 * Math.sin(c * 0.4 + s); P.nRY *= 0.4; break;
    case 'surge': {
      const k = clamp(t / MA_NOYE.surge.dur, 0, 1);
      P.bRX = 0.1; P.tRX = lerp(0.05, -0.15, k); P.nRX = -0.3;
      P.sLX = P.sRX = lerp(-1.2, -2.05, smooth(k)); P.sLZ = 0.42; P.sRZ = -0.42; P.eL = P.eR = -0.4;
      P.hLX = 0.3 + 0.5 * Math.sin(c * 9); P.hRX = 0.3 + 0.5 * Math.sin(c * 9 + Math.PI); P.kL = P.kR = 0.6;
      break;
    }
    case 'grip': maNoyeGripPose(P, z); break;
    case 'grab': {
      P.bRX = 0.3; P.tRX = 0.38 + 0.06 * Math.sin(c * 6); P.tRZ = 0.1 * Math.sin(c * 5.3);
      P.sLX = P.sRX = -1.25; P.sLZ = -0.32; P.sRZ = 0.32; P.eL = P.eR = -1.45;
      P.nRX = -0.25 + 0.18 * Math.sin(c * 9); P.nRY = 0.15 * Math.sin(c * 4.7);
      P.hLX = 0.2 + 0.4 * Math.sin(c * 5); P.hRX = 0.2 + 0.4 * Math.sin(c * 5 + Math.PI); P.kL = P.kR = 0.7;
      break;
    }
    case 'fall': {
      const k = clamp(t / 1.1, 0, 1);
      P.bRX = lerp(-0.35, 0.3, k); P.tRX = -0.2; P.nRX = -0.2;
      P.sLX = -2.5 + 0.4 * Math.sin(c * 7); P.sRX = -2.4 + 0.4 * Math.sin(c * 7 + 2); P.sLZ = 0.4; P.sRZ = -0.4; P.eL = P.eR = -0.3;
      P.hLX = 0.3 * Math.sin(c * 6); P.hRX = -0.3 * Math.sin(c * 6); P.kL = P.kR = 0.5;
      break;
    }
    case 'stun': {
      P.bRX = -0.2; P.tRX = -0.3 + 0.1 * Math.sin(c * 5); P.nRX = -0.4 + 0.2 * Math.sin(c * 4);
      P.sLX = -1.8 + 0.6 * Math.sin(c * 6); P.sRX = -1.8 + 0.6 * Math.sin(c * 6 + 2.3); P.sLZ = 0.5; P.sRZ = -0.5; P.eL = P.eR = -0.4;
      P.hLX = 0.3 * Math.sin(c * 5); P.hRX = -0.3 * Math.sin(c * 5); P.kL = P.kR = 0.4;
      break;
    }
    case 'sink': {
      P.bRX = 0.02; P.tRX = 0.05; P.nRX = -0.45; P.nRZ = 0.12 * Math.sin(c * 0.5 + s);
      P.sLX = -2.4 + 0.2 * Math.sin(c * 0.9 + s); P.sRX = -2.5 + 0.2 * Math.sin(c * 0.8 + s + 1); P.sLZ = 0.35; P.sRZ = -0.35; P.eL = P.eR = -0.3;
      P.hLX = 0.05; P.hRX = 0.1; P.kL = 0.25; P.kR = 0.3;
      break;
    }
    case 'eaten': {
      // kit 2.0.7 : tenu par la tête dans la gueule de la bête : il se débat, bras et jambes dans le vide
      P.bRX = 0.15 + 0.15 * Math.sin(c * 6); P.tRX = -0.25 + 0.2 * Math.sin(c * 9 + s); P.tRZ = 0.25 * Math.sin(c * 7); P.nRX = -0.6;
      P.sLX = -2.6 + 0.8 * Math.sin(c * 11 + s); P.sRX = -2.4 + 0.8 * Math.sin(c * 10 + s + 2); P.sLZ = 0.7; P.sRZ = -0.7; P.eL = -0.5 + 0.4 * Math.sin(c * 9); P.eR = -0.6;
      P.hLX = 0.5 * Math.sin(c * 12 + s); P.hRX = -0.5 * Math.sin(c * 12 + s); P.kL = 0.6 + 0.4 * Math.sin(c * 12); P.kR = 0.6 - 0.4 * Math.sin(c * 12); P.hLZ = 0.15; P.hRZ = -0.15;
      break;
    }
    case 'dead': {
      const k = owSmoothstep(0, 1.2, t);
      P.bRX = lerp(0.1, -0.6, k); P.tRX = -0.12; P.nRX = lerp(-0.2, -0.75, k); P.nRZ = 0.3 * k;
      P.sLX = -0.55 + 0.08 * Math.sin(c * 0.7); P.sRX = -0.65 + 0.08 * Math.sin(c * 0.6 + 1); P.sLZ = 1.05 * k; P.sRZ = -1.1 * k; P.eL = -0.25; P.eR = -0.35;
      P.hLX = -0.35; P.hRX = -0.2; P.kL = 0.3; P.kR = 0.45;
      break;
    }
    case 'idle': {
      // écran « Modèles » : il fait du sur-place, droit dans l'eau, les bras qui godillent
      P.bRX = 0.12; P.tRX = 0.1 + 0.03 * Math.sin(c * 0.8); P.nRX = -0.12; P.nRY = 0.2 * Math.sin(c * 0.4); P.nRZ = 0.1 * Math.sin(c * 0.55 + 1);
      const a = c * 1.6;
      P.sLX = -0.55 + 0.25 * Math.sin(a); P.sRX = -0.55 + 0.25 * Math.sin(a + 1.3); P.sLZ = 0.55 + 0.2 * Math.cos(a); P.sRZ = -0.55 - 0.2 * Math.cos(a + 1.3); P.eL = P.eR = -0.7;
      P.hLX = -0.15 + 0.3 * Math.sin(c * 1.9); P.hRX = -0.15 + 0.3 * Math.sin(c * 1.9 + Math.PI); P.kL = 0.5 + 0.3 * Math.max(0, Math.sin(c * 1.9 + 1)); P.kR = 0.5 + 0.3 * Math.max(0, Math.sin(c * 1.9 + 1 + Math.PI));
      break;
    }
    default: maNoyeSwimPose(P, z, 0);
  }
  if (z.flinch > 0) { P.tRX -= 0.25 * z.flinch; P.nRX -= 0.3 * z.flinch; }
}
/* Pose (cible P, adoucie dans Q, ressorts des coups), puis placement : les yeux en (hx, ey, hz) ; agrippé,
   la main qui tient sur le plat-bord. pos : la tête (distances du jeu) ; gy : 1,3 m sous les yeux. */
function maNoyeAnimate(z, dt) {
  const a = z.an || zAnimInit(z), P = a.P, Q = a.Q, L = a.L, r = z.rig, gripping = z.ns === 'grip' && !!(z.grip || z.spec);
  if (z.ns === 'grip' && z.grip) {
    // regarde le barreur ; vers la coque
    const V = z.grip.V;
    V.group.updateMatrixWorld();
    maNoyeGunwale(V, z.grip.lf, z.grip.s, _mnV, _mnN);
    z.yaw = Math.atan2(-_mnN.x, -_mnN.z);
    const lx = Math.cos(z.yaw), lz = -Math.sin(z.yaw), arm = z.gripArm === 'elR' ? -1 : 1;
    z.gripW.set(_mnV.x + lx * 0.175 * arm + _mnN.x * 0.03, _mnV.y - 0.02, _mnV.z + lz * 0.175 * arm + _mnN.z * 0.03);
    if (V === VEH.drive) { const px = player.pos.x - _mnV.x, pz = player.pos.z - _mnV.z; z.lookY = wrapAngle(Math.atan2(px, pz) - z.yaw); }
  }
  maNoyePoseFor(z, P);
  const w = dt > 0 ? 1 - Math.exp(-(z.blendK || 5) * dt) : 1;
  for (const k of ZPK) Q[k] += (P[k] - Q[k]) * w;
  zPoseSet(L, Q);
  if (dt > 0) zSprings(z, L, dt);
  z.pos.set(0, 0, 0);
  zApplyPose(z, L);
  r.root.position.set(0, 0, 0);
  r.root.updateMatrixWorld(true);
  let tx, ty, tz;
  if (gripping) { _mnA.set(0, -0.265, 0.004).applyMatrix4(r[z.gripArm].matrixWorld); tx = z.gripW.x; ty = z.gripW.y; tz = z.gripW.z; }
  else { _mnA.set(0, ZRIG.head - 0.003, 0.104).applyMatrix4(r.neck.matrixWorld); tx = z.hx; ty = z.ey; tz = z.hz; }
  const dx = tx - _mnA.x, dy = ty - _mnA.y, dz = tz - _mnA.z;
  r.root.position.set(dx, dy, dz);
  for (const b of MA_NOYE_BONES) { const e = r[b].matrixWorld.elements; e[12] += dx; e[13] += dy; e[14] += dz; }
  z.root.set(dx, dy, dz);
  if (gripping) { _mnE.set(0, ZRIG.head - 0.003, 0.104).applyMatrix4(r.neck.matrixWorld); if (!z.spec) { z.hx = _mnE.x; z.hz = _mnE.z; } z.ey = z.eyT = _mnE.y; }
  z.pos.set(z.hx, z.ey - 1.25, z.hz);
  z.gy = z.ey - 1.3;
  if (!z.spec) writeZombieMatrices(z);
}

/* ---------------------------------------------------------------- Tir, mort -- */
/* Tir : la tête (sphère), le buste (capsule du bassin au cou), les bras. Ce qui est sous l'eau n'est touché
   qu'à moins d'un mètre de la surface (la balle s'y arrête : maShot). */
function maNoyeRay(z, ox, oy, oz, dx, dy, dz, extra) {
  _hitHead = false; _hitLeg = false; _hitArm = 0;
  if (!z.alive || z.ns === 'rise') return -1;
  let best = -1;
  if (!z.headless) {
    zombieHead(z, _mnH);
    const R = 0.16 + extra, lx = ox - _mnH.x, ly = oy - _mnH.y, lz = oz - _mnH.z;
    const b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - R * R, disc = b * b - c;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t >= 0) { best = t; _hitHead = true; } }
  }
  _mnA.setFromMatrixPosition(z.rig.pelvis.matrixWorld); _mnB.setFromMatrixPosition(z.rig.neck.matrixWorld);
  const tb = raySegment(ox, oy, oz, dx, dy, dz, _mnA, _mnB, 0.2 + extra);
  if (tb >= 0 && (best < 0 || tb < best - 0.06)) { best = tb; _hitHead = false; }
  if (!_hitHead) {
    let armT = -1;
    for (let side = 1; side <= 2; side++) {
      if (z.gib & side) continue;
      const t = rayArm(z, side, ox, oy, oz, dx, dy, dz, 0.075 + extra);
      if (t >= 0 && (best < 0 || t < best + 0.03) && (armT < 0 || t < armT)) { armT = t; _hitArm = side; }
    }
    if (_hitArm) best = armT;
  }
  return best;
}
/* Mort : points (comme un zombie), hors du décompte de la manche et sans bonus. Il lâche tout, flotte un
   instant sur le dos, puis coule ; ses yeux s'éteignent. */
function maNoyeKill(z, info) {
  if (!z.alive) return;
  const was = z.ns, dx = info.dx || 0, dz = info.dz || 0;
  if (player.grabbedBy === z) maNoyeRelease(z, true);
  z.alive = false; z.state = 'dead'; z.deathKind = info.kind; z.sinkV = 0;
  let pts = RULES.pointsKill;
  if (info.kind === 'knife') pts = RULES.pointsKnife; else if (info.kind === 'nuke') pts = 0; else if (info.head) pts = RULES.pointsHead;
  if (pts) addPoints(pts);
  MA_NOYES.killed++;
  if (!info.foudre) { G.stats.kills++; Life.kill(info, MA_NOYE_TYPE); Rank.kill(info); }   // kit 2.0.7 : la foudre (ma18) n'est pas le joueur
  glasOnKill(z, info);
  if (info.head && info.kind === 'bullet') {
    G.stats.headshots++;
    Sound.headshot();
    zombieHead(z, _mnH);
    z.headless = true;
    bloodBurst(_mnH.x, _mnH.y, _mnH.z, dx, dz, 16, 1.2);
    for (let i = 0; i < 3; i++) spawnDebris(MAT.gib, rand(0.04, 0.08), rand(0.04, 0.08), rand(0.04, 0.08), _mnH.x, _mnH.y, _mnH.z, rand(-2, 2) + dx * 2, rand(1, 3), rand(-2, 2) + dz * 2, 2.5);
  }
  if (was === 'grip' && z.grip) {
    // il tombe de la barque, à la renverse
    maNoyeGunwale(z.grip.V, z.grip.lf, z.grip.s, _mnV, _mnN);
    z.vx = _mnN.x * 1.3; z.vz = _mnN.z * 1.3;
    maSplash(z.hx, z.hz, 1.0, { up: 1 });
  } else { z.vx = dx * 0.8; z.vz = dz * 0.8; maSplash(z.hx, z.hz, 0.6, { up: 0.8 }); }
  z.grip = null; z.surgeTo = null;
  maNoyeState(z, 'dead');
  z.blendK = 5;
  if (z.ey > z.wl - 0.3) spawnPuff(z.hx, z.wl + 0.05, z.hz, 0.9, 2.4, 0x3a1612, 0.35, 0.05);    // le sang, sombre, dans l'eau
  maBubbles(z.hx, z.hz, 8, 0.5);
  maNoyeSnd('death', z.hx, z.hz);
  maEmit('noye', { what: 'tue', id: z.id, kind: info.kind });
}

/* Kit 2.0.7 : la bête les engloutit. La gueule (H) se referme : la proie, et ceux qui ont la tête au ras de l'eau
   à moins de r m de la gueule (deux au plus en plus de la proie). Pas de points : ce n'est pas le joueur. */
function maNoyesEngulf(H, r, prey) {
  let n = 0;
  const L = Zombies.list.filter((z) => z.noye && z.alive && !z.removed && z.ns !== 'rise' && z.ey > z.wl - 0.7 && (z === prey || Math.hypot(z.hx - H.x, z.hz - H.z) < r))
    .sort((a, b) => (a === prey ? -1 : b === prey ? 1 : Math.hypot(a.hx - H.x, a.hz - H.z) - Math.hypot(b.hx - H.x, b.hz - H.z)));
  for (const z of L) {
    if (z === prey && Math.hypot(z.hx - H.x, z.hz - H.z) > r + 0.8) continue;      // la proie s'est écartée : ratée
    if (n >= 3) break;
    maNoyeEaten(z);
    n++;
  }
  return n;
}
function maNoyeEaten(z) {
  if (player.grabbedBy === z) maNoyeRelease(z, true);
  z.alive = false; z.state = 'dead'; z.grip = null; z.surgeTo = null; z.prey = false;
  maNoyeState(z, 'eaten');
  z.blendK = 9;
  MA_NOYES.eaten++;
  // la gueule se referme : du sang dans la gerbe, des lambeaux du ciré qui volent
  spawnPuff(z.hx, MA.water + 0.1, z.hz, 1.4, 2.6, 0x3a1612, 0.45, 0.06);
  bloodBurst(z.hx, MA.water + 0.4, z.hz, 0, 0, 18, 1.6);
  for (let i = 0; i < 4; i++) spawnDebris(i < 2 ? MAT.maNoyeCloth : MAT.gib, rand(0.06, 0.14), rand(0.01, 0.03), rand(0.08, 0.2), z.hx, MA.water + 0.6, z.hz, rand(-2.5, 2.5), rand(2, 4.5), rand(-2.5, 2.5), 2);
  maNoyeSnd('death', z.hx, z.hz);
  maEmit('noye', { what: 'englouti', id: z.id, x: Math.round(z.hx), z: Math.round(z.hz) });
}

/* ---------------------------------------------------------------- Chaque image (maUpdate) -- */
function maNoyesUpdate(dt) {
  const S = MA_NOYES;
  if (!OW.on || OW.worldId !== 'marais') return;
  const D = VEH.drive, V = D && D.T.boat && !D.capsized && !D.wrecked ? D : null, swim = MA_SWIM.on;
  const devour = !!MAB.devour || MAB.state === 'devore';
  const C = { V, swim, onWater: !!(V || swim) && !devour && G.state === 'playing', down: !!player.down };
  // hors de leur portée (barque à quai dans le haut-fond, nageur au bord) : comme à terre, ils ne sortent pas et
  // ceux qui sont là regardent puis retournent au fond (sinon : des points sans risque, en tirant depuis le quai)
  if (C.onWater && !maNoyeReachable(C)) { S.outT = (S.outT || 0) + dt; if (S.outT > 2.5) C.onWater = false; } else S.outT = 0;
  if (V) V.group.updateMatrixWorld();
  MA_NOYE_U.uMnWater.value = MA.water;
  S.kickCd -= dt; S.pathBudget = 1; S.rip = Math.min(3, S.rip + dt * 3);
  maNoyesSpawner(dt, C);
  maNoyesRoles(C);
  for (let i = Zombies.list.length - 1; i >= 0; i--) { const z = Zombies.list[i]; if (z && z.noye && !z.removed) maNoyeStep(z, dt, C); }
  maNoyeWaitHint(C);
  maNoyesBoat(dt, C);
  maNoyeGrabGuard(dt, C);
  maNoyeKickInput(C);
  maNoyesVoices(dt, C);
  maNoyeGrabView(C);
  maNoyeGlowUpdate(dt);
  flushZombieMatrices();
}
/* Le joueur est-il à leur portée : de l'eau d'au moins 1 m à moins de 2 m de la barque (de son bord) ou du nageur ? */
function maNoyeReachable(C) {
  const x0 = C.V ? C.V.x : player.pos.x, z0 = C.V ? C.V.z : player.pos.z, r0 = C.V ? 2.2 + 2 : 1.5;
  if (maDepth(x0, z0) >= MA_NOYE.minDepth) return true;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; for (const r of [r0 * 0.5, r0]) if (maNoyeCellOk(x0 + Math.cos(a) * r, z0 + Math.sin(a) * r)) return true; }
  return false;
}
/* Sorties : sur l'eau seulement, dès la manche 1, de 4 à 7 s après être monté en barque ou s'être mis à
   l'eau, puis un groupe toutes les 9 s (manche 1) à 4,5 s (manche 10 et au-delà) : 2-3 Noyés à la manche 1,
   3-5 à la 10, qui crèvent la surface l'un après l'autre, à 2,5-6 m les uns des autres. Jusqu'à 6 à la fois à
   la manche 1, 20 dès la 8 (MA_NOYE.max). */
function maNoyesSpawner(dt, C) {
  const S = MA_NOYES;
  if (!C.onWater || G.round < 1 || player.down) { S.waterT = 0; return; }
  if (S.waterT === 0) { S.first = rand(MA_NOYE.first[0], MA_NOYE.first[1]); S.t = 0; }
  S.waterT += dt;
  if (S.waterT < S.first) return;
  S.t -= dt;
  if (S.t > 0) return;
  let alive = 0;
  for (const z of Zombies.list) if (z.noye && z.alive) alive++;
  const room = MA_NOYE.max(G.round) - alive;
  if (room <= 0) { S.t = 0.8; return; }
  const p = maNoyePickSpawn(C);
  if (!p) { S.t = 0.6; return; }
  const px = C.V ? C.V.x : player.pos.x, pz = C.V ? C.V.z : player.pos.z, [g0, g1] = MA_NOYE.pack(G.round);
  const n = Math.min(room, randInt(g0, g1));
  let made = 0, delay = 0;
  for (let i = 0; i < n; i++) {
    const q = i === 0 ? p : maNoyePackPoint(p, px, pz);
    if (!q) continue;
    const z = maNoyeSpawn(q[0], q[1], Math.atan2(px - q[0], pz - q[1]));
    if (!z) break;
    if (made) { delay += rand(MA_NOYE.packDelay[0], MA_NOYE.packDelay[1]); z.st = -delay; }   // il attend au fond, sa lueur sous l'eau
    made++; S.spawned++;
  }
  if (made > 1) S.packs = (S.packs || 0) + 1;
  S.t = made ? MA_NOYE.every(G.round) * rand(0.75, 1.25) : 1;
}
/* Un autre membre du groupe : à 2,5-6 m du premier, dans au moins 1,6 m d'eau, rien que de l'eau jusqu'à la
   cible, à 1,6 m au moins des autres Noyés et à plus de 15 m de la cible. */
function maNoyePackPoint(p, px, pz) {
  for (let tries = 0; tries < 14; tries++) {
    const a = rand(0, TAU), r = rand(MA_NOYE.packR[0], MA_NOYE.packR[1]), x = p[0] + Math.sin(a) * r, z = p[1] + Math.cos(a) * r;
    if (Math.hypot(x - px, z - pz) < 15) continue;
    if (!maNoyeCellOk(x, z) || maDepth(x, z) < MA_NOYE.spawnDepth) continue;
    if (MA_NAV.lake && !maInLake(x, z)) continue;
    if (!maWaterLine(px, pz, x, z)) continue;
    if (Zombies.list.some((o) => o.noye && !o.removed && Math.hypot(o.hx - x, o.hz - z) < 1.6)) continue;
    if (MAB.on && MAB.state !== 'dormant' && Math.hypot(MAB.x - x, MAB.z - z) < 14) continue;
    return [x, z];
  }
  return null;
}
/* Rôles (chaque image) : seuls les plus proches attaquent, jusqu'au plafond de la manche (MA_NOYE.attack) ;
   les autres attendent leur tour en cercle autour de la barque lente ou du nageur (maNoyeWaitPoint) et
   prennent la place de ceux qui tombent, lâchent ou meurent. Une barque qui file : tous la suivent. */
function maNoyesRoles(C) {
  const S = MA_NOYES;
  S.waiting = 0; S.attackers = 0;
  if (!C.onWater) return;
  const V = C.V, r = Math.max(1, G.round), tx = V ? V.x : player.pos.x, tz = V ? V.z : player.pos.z, cand = [];
  let busy = 0;
  for (const z of Zombies.list) {
    if (!z.noye || !z.alive || z.removed) continue;
    if (V ? (z.ns === 'grip' && z.grip && z.grip.V === V) || (z.ns === 'surge' && z.surgeTo && z.surgeTo.V === V)
      : z.ns === 'grab' || (z.ns === 'surge' && z.surgeTo === 'nageur')) { busy++; continue; }
    if (z.ns === 'stalk') cand.push([Math.hypot(z.hx - tx, z.hz - tz), z]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const free = Math.max(0, (V ? MA_NOYE.attack.boat(r) : MA_NOYE.attack.swim(r)) - busy);
  for (let i = 0; i < cand.length; i++) cand[i][1].hunt = i < free;
  S.attackers = busy;
  for (const z of Zombies.list) if (z.noye && z.alive && z.waiting) S.waiting++;
}
/* Où attend celui qui n'attaque pas : sur un cercle de 4,2-6,2 m autour de la barque (5,5-8,5 m autour du
   nageur), un peu plus loin dans le sens où il tourne ; null s'il attaque, si la barque file ou s'il est loin. */
function maNoyeWaitPoint(z, C) {
  if (z.hunt !== false || !C.onWater) return null;
  const V = C.V;
  if (V && Math.abs(V.v || 0) > MA_NOYE.surge.boatMax + 0.4) return null;
  const cx = V ? V.x : player.pos.x, cz = V ? V.z : player.pos.z, key = V ? 1 : 2, W = V ? MA_NOYE.wait.boat : MA_NOYE.wait.swim;
  if (z.waitK !== key) { z.waitK = key; z.waitR = rand(W[0], W[1]); z.waitDir = Math.random() < 0.5 ? 1 : -1; }
  const dx = z.hx - cx, dz = z.hz - cz, d = Math.hypot(dx, dz);
  if (d > z.waitR + 8) return null;
  const a = (d > 1e-3 ? Math.atan2(dx, dz) : rand(0, TAU)) + z.waitDir * MA_NOYE.wait.step;
  return [cx + Math.sin(a) * z.waitR, cz + Math.cos(a) * z.waitR, cx, cz];
}
/* Où il sort : en eau d'au moins 1,6 m, dans le lac, à 24-44 m (18-34 autour d'un nageur), rien que de l'eau
   entre lui et sa cible ; devant la barque quand elle file (3 fois sur 4, ±63°) : on voit ses yeux arriver. */
function maNoyePickSpawn(C) {
  const V = C.V, px = V ? V.x : player.pos.x, pz = V ? V.z : player.pos.z;
  let hx = 0, hz = 0, moving = false;
  if (V && Math.abs(V.v || 0) > 1.5) { [hx, hz] = vehFwd(V.yaw); if (V.v < 0) { hx = -hx; hz = -hz; } moving = true; }
  const R = C.swim ? MA_NOYE.swimDist : MA_NOYE.dist;
  for (let tries = 0; tries < 30; tries++) {
    const ahead = moving && Math.random() < 0.75;
    const a = ahead ? Math.atan2(hx, hz) + rand(-1.1, 1.1) : rand(0, TAU);
    const d = rand(R[0], R[1]) * (ahead ? 1.15 : 1);
    const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
    if (!maNoyeCellOk(x, z) || maDepth(x, z) < MA_NOYE.spawnDepth) continue;
    if (MA_NAV.lake && !maInLake(x, z)) continue;
    if (!maWaterLine(px, pz, x, z)) continue;
    if (Zombies.list.some((o) => o.noye && !o.removed && Math.hypot(o.hx - x, o.hz - z) < 5)) continue;
    if (MAB.on && MAB.state !== 'dormant' && Math.hypot(MAB.x - x, MAB.z - z) < 14) continue;
    return [x, z];
  }
  return null;
}
/* La première fois qu'au moins trois Noyés tournent autour du joueur en attendant leur tour : un mot. */
function maNoyeWaitHint(C) {
  const S = MA_NOYES;
  if (S.hintWait || !C.onWater || S.waiting < 3 || G.state !== 'playing') return;
  S.hintWait = true;
  HUD.hint(C.V ? 'Ils encerclent la barque et attendent leur tour : ne restez pas à l’arrêt' : 'Ils tournent autour de vous et attendent leur tour : nagez vers la rive', 4);
}
/* La barque : ceux qui s'y agrippent la freinent et la font gîter de leur côté. */
function maNoyesBoat(dt, C) {
  const V = C.V;
  if (!V) return;
  let n = 0, side = 0;
  for (const z of Zombies.list) if (z.noye && z.alive && z.ns === 'grip' && z.grip && z.grip.V === V) { n++; side += z.grip.s; }
  V.noyes = n;
  if (!n) return;
  V.v -= V.v * MA_NOYE.grip.drag * n * dt;
  V.rv -= side * 0.9 * dt;
  if (!MA_NOYES.hintGrip) { MA_NOYES.hintGrip = true; HUD.hint('Un Noyé s’agrippe à la barque ! Visez la tête, ou pleins gaz : il lâchera prise', 4); }
}
/* Tenu sous l'eau : la vue s'enfonce au ras de l'eau, se secoue ; le son s'étouffe. */
function maNoyeGrabView(C) {
  const z = player.grabbedBy, on = !!(z && z.noye && C.swim && z.ns === 'grab');
  if (on) {
    // confort (ma00) : la vue s'enfonce toujours au ras de l'eau ; elle ne se secoue que si c'est réglé
    const t = G.time, b = maBalance();
    camera.position.y = Math.min(camera.position.y, MA.water + 0.07 + 0.035 * Math.sin(t * 11) * b);
    camera.rotation.z += 0.07 * Math.sin(t * 7.3) * b;
    camera.rotation.x += 0.04 * Math.sin(t * 9.1) * b;
  }
  if (on !== MA_NOYES.muffled) { MA_NOYES.muffled = on; Sound.setMuffle(on ? 1100 : MA_SWIM.on ? 2600 : false); }
}

/* ---------------------------------------------------------------- Yeux luisants -- */
/* Deux lueurs par noyé (points sans brouillard, d'au moins 4 pixels), leur reflet allongé sur l'eau vers la
   caméra ; sous l'eau, une tache rouge à la surface. Les objets existent dès le chargement (précompilés). */
const MA_NG = { pts: null, quads: null, n: 48, q: 40, col: new THREE.Color() };   // 24 noyés (2 yeux), 40 reflets ou taches
function maNoyeGlowInit(root) {
  const N = MA_NG;
  if (!N.pts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N.n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(N.n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N.n), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uMin: { value: 4 }, uMax: { value: 46 } },
      vertexShader: 'attribute vec3 aCol; attribute float aSize; uniform float uScale; uniform float uMin; uniform float uMax; varying vec3 vCol;\n'
        + 'void main() { vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), uMin, uMax); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vCol;\n'
        + 'void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard;\n'
        + '  float core = exp(-r2 * 14.0), halo = exp(-r2 * 3.2) * (1.0 - r2);\n'
        + '  float m = max(max(vCol.r, vCol.g), vCol.b);\n'
        + '  gl_FragColor = vec4(vCol * (halo * 0.85 + core * 1.0) + vec3(1.0, 0.5, 0.3) * core * 0.22 * m, 1.0);\n'
        + '  #include <tonemapping_fragment>\n  #include <encodings_fragment>\n}',
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    });
    N.pts = new THREE.Points(g, mat);
    N.pts.name = 'yeux des noyés'; N.pts.frustumCulled = false; N.pts.renderOrder = 9;
    // reflets et taches : des quadrilatères posés sur l'eau
    const qg = new THREE.BufferGeometry(), Q = N.q, idx = [];
    qg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Q * 12), 3).setUsage(THREE.DynamicDrawUsage));
    qg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Q * 12), 3).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(Q * 8);
    for (let i = 0; i < Q; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); }
    qg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    qg.setIndex(idx);
    qg.setDrawRange(0, 0);
    const qm = new THREE.MeshBasicMaterial({ map: share(maGlowTexture()), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide });
    qm.defines = { HFOG_ADD: '' };                          // la brume les éteint (lumière ajoutée)
    _linDone.add(qm);
    N.quads = new THREE.Mesh(qg, qm);
    N.quads.name = 'reflets des yeux'; N.quads.frustumCulled = false; N.quads.renderOrder = 5;
  }
  N.pts.geometry.setDrawRange(0, 0); N.quads.geometry.setDrawRange(0, 0);
  if (root) root.add(N.pts, N.quads);
  // bras arraché (gibArm) : les matières des noyés sur un objet ordinaire (pas une horde) ; précompilées ici
  if (root && !N.limbs) {
    N.limbs = [MAT.maNoyeSkin, MAT.maNoyeCloth].map((m) => { const o = new THREE.Mesh(GEO.box, m); o.visible = false; o.name = 'noyé (précompilation)'; return o; });
  }
  if (root) root.add(...N.limbs);
}
/* Un quadrilatère à plat sur l'eau : centre (x, z), axe u (unitaire, à plat), demi-longueur l, demi-largeur w. */
function mnQuad(i, x, y, z, ux, uz, l, w, r, g, b) {
  const P = MA_NG.quads.geometry.attributes.position.array, Cl = MA_NG.quads.geometry.attributes.color.array, o = i * 12;
  const vx = -uz, vz = ux;
  const c = [[-l, -w], [l, -w], [l, w], [-l, w]];
  for (let k = 0; k < 4; k++) {
    P[o + k * 3] = x + ux * c[k][0] + vx * c[k][1]; P[o + k * 3 + 1] = y; P[o + k * 3 + 2] = z + uz * c[k][0] + vz * c[k][1];
    Cl[o + k * 3] = r; Cl[o + k * 3 + 1] = g; Cl[o + k * 3 + 2] = b;
  }
}
const _mnL = [new THREE.Vector3(), new THREE.Vector3()], _mnF = new THREE.Vector3(), _mnR = new THREE.Vector3();
function maNoyeGlowUpdate(dt) {
  const N = MA_NG;
  if (!N.pts) return;
  const P = N.pts.geometry.attributes.position.array, Cc = N.pts.geometry.attributes.aCol.array, Sz = N.pts.geometry.attributes.aSize.array;
  const cam = camera.position, fogD = scene.fog && scene.fog.density ? scene.fog.density : 0, W = MA.water, t = G.time;
  const col = N.col.setHex(MA_NOYE.eye).convertSRGBToLinear();
  let n = 0, q = 0;
  for (const z of Zombies.list) {
    if (!z.noye || z.removed || z.headless || z.glow < 0.01) continue;
    const k0 = z.glow * (z.blink > 0 ? 0 : 1);
    const nk = z.rig.neck.matrixWorld;
    _mnL[0].set(-0.04, ZRIG.head - 0.003, 0.121).applyMatrix4(nk);
    _mnL[1].set(0.04, ZRIG.head - 0.003, 0.121).applyMatrix4(nk);
    _mnF.set(0, 0, 1).transformDirection(nk); _mnR.set(1, 0, 0).transformDirection(nk);   // face, droite de la tête
    const mx = (_mnL[0].x + _mnL[1].x) / 2, my = (_mnL[0].y + _mnL[1].y) / 2, mz = (_mnL[0].z + _mnL[1].z) / 2;
    const d = Math.hypot(mx - cam.x, my - cam.y, mz - cam.z);
    if (d > 140) continue;
    const tau = maHFogTau(mx, my, mz) + (fogD * d) * (fogD * d), vis = 0.28 + 0.72 * Math.exp(-0.55 * tau);
    // de face seulement : de dos, le crâne cache les yeux (aucun halo autour de la tête)
    const face = ((cam.x - mx) * _mnF.x + (cam.y - my) * _mnF.y + (cam.z - mz) * _mnF.z) / Math.max(d, 1e-3), kfM = owSmoothstep(-0.2, 0.35, face);
    // tout près, l'œil lui-même se voit (halo plus discret) ; au loin, la lueur porte un peu plus
    const kd = 0.62 + 0.38 * owSmoothstep(0.6, 2.5, d) + 0.5 * owSmoothstep(6, 20, d);
    const above = my - W;
    if (above > -0.012) {
      const k = k0 * kd * vis * owSmoothstep(-0.012, 0.02, above) * 1.25, size = 0.12 * (1 + 0.5 * Math.min(tau, 2.5));
      for (let e = 0; e < 2 && n < N.n; e++) {
        // chaque œil regarde un peu en dehors : de profil, l'œil du côté opposé passe derrière l'arête du nez
        const E = _mnL[e], sx = e ? 0.5 : -0.5;
        const nx = _mnF.x * 0.87 + _mnR.x * sx, ny = _mnF.y * 0.87 + _mnR.y * sx, nz = _mnF.z * 0.87 + _mnR.z * sx;
        const tx = cam.x - E.x, ty = cam.y - E.y, tz = cam.z - E.z, kf = owSmoothstep(-0.15, 0.35, (nx * tx + ny * ty + nz * tz) / (Math.hypot(tx, ty, tz) || 1));
        if (k * kf < 0.004) continue;
        P[n * 3] = E.x; P[n * 3 + 1] = E.y; P[n * 3 + 2] = E.z;
        Cc[n * 3] = col.r * k * kf; Cc[n * 3 + 1] = col.g * k * kf; Cc[n * 3 + 2] = col.b * k * kf;
        Sz[n] = size; n++;
      }
      // reflet : une traînée sur l'eau, du pied des yeux vers la caméra (pas à bout portant : la caméra est dessus)
      if (above > 0.012 && d > 2.2 && d < 70 && kfM > 0.02 && q < N.q) {
        let ux = cam.x - mx, uz = cam.z - mz;
        const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
        // un reflet s'allonge en incidence rasante ; vu de haut (ponton, toit), il se réduit à une tache sous les yeux
        const elev = (cam.y - W) / Math.max(0.5, Math.hypot(cam.x - mx, cam.z - mz)), graze = clamp(1 - elev * 3, 0.25, 1);
        const L = clamp(0.25 + d * 0.02, 0.25, 1.4) * clamp(0.6 + above * 2.5, 0.6, 1.6) * graze, fl = 0.75 + 0.25 * Math.sin(t * 7 + z.seed * 3) * Math.sin(t * 3.3 + z.seed);
        // pas à travers une coque (le reflet est sur l'eau entre lui et la caméra)
        const ex = mx + ux * L * 1.1, ez = mz + uz * L * 1.1;
        if (!VEH.list.some((V) => V.T.boat && !V.wrecked && (vehInside(V, ex, ez, 0.15) || vehInside(V, mx + ux * 0.25, mz + uz * 0.25, 0.1)))) {
          const kr = k0 * kfM * vis * 0.38 * fl;
          mnQuad(q++, mx + ux * L * 0.55, W + 0.006, mz + uz * L * 0.55, ux, uz, L * 0.6, 0.07 + d * 0.0012, col.r * kr, col.g * kr, col.b * kr);
        }
      }
    } else if (above > -2.6 && d > 1.6 && q < N.q) {
      // sous l'eau : la lueur à travers l'eau, plus large et plus pâle en profondeur
      const dep = -above, kk = k0 * vis * 0.6 * Math.pow(1 - dep / 2.6, 2), s = 0.24 + dep * 0.45;
      mnQuad(q++, mx, W + 0.008, mz, 1, 0, s, s, col.r * kk, col.g * kk, col.b * kk);
    }
  }
  const g = N.pts.geometry;
  g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  g.setDrawRange(0, n);
  const qg = N.quads.geometry;
  qg.attributes.position.needsUpdate = true; qg.attributes.color.needsUpdate = true;
  qg.setDrawRange(0, q * 6);
  // échelle des points : celle de PointsMaterial (hauteur de l'image / 2, champ de la caméra)
  const h = renderer.domElement ? renderer.domElement.height : 720, cm = viewCamera || camera;
  N.pts.material.uniforms.uScale.value = (h / 2) / Math.tan(((cm.fov || 60) * Math.PI) / 360);
  N.pts.material.uniforms.uMin.value = Math.max(4.2, 7.5 * (h / 1080));
  N.pts.material.uniforms.uMax.value = Math.max(24, 46 * (h / 720));      // à bout portant : l'œil, pas une boule de feu
  // la première fois qu'on en voit un à moins de 30 m : un mot
  if (!MA_NOYES.seen && n && G.state === 'playing') {
    for (const z of Zombies.list) {
      if (!z.noye || !z.alive || z.ey < W || Math.hypot(z.hx - cam.x, z.hz - cam.z) > 30) continue;
      camera.getWorldDirection(_mnV);
      const dx = z.hx - cam.x, dz = z.hz - cam.z, dl = Math.hypot(dx, dz) || 1;
      if ((dx * _mnV.x + dz * _mnV.z) / dl < 0.55) continue;
      MA_NOYES.seen = true;
      HUD.hint('Des yeux rouges au ras de l’eau : des Noyés. Ils ne quittent pas l’eau ; pleins gaz, ils lâchent la barque', 5);
      break;
    }
  }
}

/* ---------------------------------------------------------------- Sons -- */
/* Bulles, râle noyé, plainte, souffle à la surface, cri gargouillant, mains qui claquent sur le plat-bord,
   griffes dans le bois, morsure, coup de pied, agonie et bulles qui remontent. Bus des effets du marais
   (réverbération de la brume), sinon (écran « Modèles ») le bus des effets du jeu. */
function maNoyeOut(x, zz, vol, ref = 9, dur = 2) {
  const A = MA_AMB;
  let ctx, dst, verb, noise;
  if (A.out && A.ctx && A.ctx.state !== 'closed') { ctx = A.ctx; dst = A.fx; verb = A.verb; noise = A.noise; }
  else {
    const b = Sound.bus();
    if (!b) return null;
    ctx = b.ctx; dst = b.sortie; verb = null;
    if (!MA_NOYES.noise || MA_NOYES.noise.sampleRate !== ctx.sampleRate) MA_NOYES.noise = maAmbNoise(ctx);
    noise = MA_NOYES.noise;
  }
  let att = 1, pan = 0, wet = 0.2;
  if (x !== null && x !== undefined) {
    const L = camera.position, d = Math.hypot(x - L.x, zz - L.z);
    att = 1 / (1 + Math.pow(Math.max(0, d - 1.5) / ref, 1.5));
    if (att < 0.02) return null;
    pan = maPanOf(x, zz) * 0.85; wet = 0.18 + clamp(d / 50, 0, 0.5);
  }
  const g = ctx.createGain(); g.gain.value = vol * att;
  let tail = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
  tail.connect(dst);
  let w = null;
  if (verb) { w = ctx.createGain(); w.gain.value = wet; tail.connect(w); w.connect(verb); }
  setTimeout(() => { try { tail.disconnect(); g.disconnect(); if (w) w.disconnect(); } catch (e) { /* déjà débranché */ } }, (dur + 3) * 1000);
  return { ctx, g, t: ctx.currentTime + 0.012, noise };
}
function mnBubble(o, t, f, dur, lvl) {
  const c = o.ctx, s = c.createOscillator(), g = c.createGain();
  s.type = 'sine'; s.frequency.setValueAtTime(f, t); s.frequency.exponentialRampToValueAtTime(f * 1.9, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g); g.connect(o.g); s.start(t); s.stop(t + dur + 0.02);
}
function mnNoise(o, t, dur, type, f0, f1, q, lvl, att = 0.01, rate = 1) {
  const c = o.ctx, s = c.createBufferSource();
  s.buffer = o.noise; s.playbackRate.value = rate;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(o.g);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
}
function mnTone(o, type, f0, f1, t, dur, lvl, att = 0.004) {
  const c = o.ctx, s = c.createOscillator(), g = c.createGain();
  s.type = type; s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g); g.connect(o.g); s.start(t); s.stop(t + dur + 0.03);
}
/* Voix : dent de scie dans des formants, vibrato, gargouillis (modulation d'amplitude), étouffée par l'eau. */
function mnVoice(o, t, dur, f0, f1, O = {}) {
  const c = o.ctx, s = c.createOscillator();
  s.type = O.wave || 'sawtooth';
  s.frequency.setValueAtTime(f0, t);
  if (O.mid) { s.frequency.linearRampToValueAtTime(O.mid, t + dur * (O.midAt || 0.4)); s.frequency.linearRampToValueAtTime(f1, t + dur); }
  else s.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const stop = t + dur + 0.05;
  if (O.vib) { const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = O.vib; vg.gain.value = O.vibA || 3; v.connect(vg); vg.connect(s.frequency); v.start(t); v.stop(stop); }
  const am = c.createGain(); am.gain.value = 1 - (O.amD || 0) * 0.5;
  if (O.am) { const m = c.createOscillator(), mg = c.createGain(); m.frequency.value = O.am; mg.gain.value = (O.amD || 0.5) * 0.5; m.connect(mg); mg.connect(am.gain); m.start(t); m.stop(stop); }
  const env = c.createGain(), lvl = O.lvl || 0.3;
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(lvl, t + (O.att || 0.05));
  if (O.hold) env.gain.setValueAtTime(lvl, t + dur * O.hold);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(am);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = O.lp || 1200; lp.Q.value = 0.7;
  for (const [f, q, k] of O.formants || [[600, 3, 1]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const bg = c.createGain(); bg.gain.value = k; am.connect(b); b.connect(bg); bg.connect(lp); }
  lp.connect(env); env.connect(o.g);
  s.start(t); s.stop(stop);
}
function maNoyeSnd(kind, x, zz) {
  try {
    switch (kind) {
      case 'gurgle': {
        const o = maNoyeOut(x, zz, 0.36, 7, 1.2); if (!o) return;
        const n = 6 + ((Math.random() * 4) | 0);
        for (let i = 0, tt = o.t; i < n; i++, tt += rand(0.045, 0.12)) mnBubble(o, tt, rand(170, 420), rand(0.035, 0.07), rand(0.22, 0.45));
        mnVoice(o, o.t + 0.04, 0.62, rand(70, 85), rand(58, 68), { am: 23, amD: 0.8, formants: [[380, 3, 1], [760, 5, 0.4]], lp: 900, lvl: 0.2, att: 0.12 });
        break;
      }
      case 'moan': {
        const o = maNoyeOut(x, zz, 0.44, 13, 2.6); if (!o) return;
        const dur = rand(1.5, 2.2), f0 = rand(82, 100);
        mnVoice(o, o.t, dur, f0, f0 * 0.82, { mid: f0 * 1.12, midAt: 0.35, vib: 4.6, vibA: 2.5, am: 15, amD: 0.35, formants: [[430, 3.2, 1], [920, 4.5, 0.55], [2100, 6, 0.12]], lp: 1100, lvl: 0.32, att: 0.35, hold: 0.6 });
        for (let i = 0; i < 4; i++) mnBubble(o, o.t + rand(0.2, dur), rand(140, 260), rand(0.05, 0.08), rand(0.12, 0.25));
        break;
      }
      case 'surface': {
        const o = maNoyeOut(x, zz, 0.42, 8, 1.2); if (!o) return;
        mnNoise(o, o.t, 0.16, 'bandpass', 1900, 900, 1.3, 0.45, 0.01);
        mnNoise(o, o.t + 0.05, 0.7, 'lowpass', 1300, 260, 0.8, 0.3, 0.05);
        for (let i = 0; i < 4; i++) mnBubble(o, o.t + 0.1 + i * rand(0.05, 0.1), rand(220, 480), 0.05, 0.3);
        maSplashSnd(x, zz, 0.35);
        break;
      }
      case 'screech': {
        const o = maNoyeOut(x, zz, 0.62, 12, 1.4); if (!o) return;
        mnVoice(o, o.t, 0.85, rand(230, 260), rand(250, 290), { mid: rand(420, 470), midAt: 0.3, am: 34, amD: 0.75, formants: [[1150, 2, 1], [2500, 5, 0.5], [600, 3, 0.4]], lp: 4200, lvl: 0.42, att: 0.03, hold: 0.45 });
        mnNoise(o, o.t, 0.6, 'bandpass', 2000, 1200, 1, 0.22, 0.02);
        maSplashSnd(x, zz, 0.85);
        break;
      }
      case 'slap': {
        const o = maNoyeOut(x, zz, 0.55, 6, 0.6); if (!o) return;
        for (const dt of [0, 0.075]) {
          mnNoise(o, o.t + dt, 0.09, 'lowpass', 700, 200, 0.8, 0.6, 0.002);
          mnTone(o, 'sine', 120, 60, o.t + dt, 0.1, 0.45);
          mnNoise(o, o.t + dt + 0.008, 0.05, 'bandpass', 1500, null, 1.2, 0.35, 0.002);
        }
        break;
      }
      case 'claw': {
        const o = maNoyeOut(x, zz, 0.58, 7, 0.8); if (!o) return;
        mnNoise(o, o.t, 0.3, 'bandpass', 2800, 1600, 3.5, 0.32, 0.01);
        for (let i = 0; i < 6; i++) mnNoise(o, o.t + i * 0.04 + rand(0, 0.015), 0.02, 'highpass', 3000, null, 0.8, 0.22, 0.001);
        mnNoise(o, o.t + 0.02, 0.03, 'highpass', 2600, null, 0.7, 0.5, 0.001);
        mnNoise(o, o.t + 0.01, 0.07, 'bandpass', 650, null, 5, 0.6, 0.002);
        mnTone(o, 'sine', 170, 85, o.t, 0.12, 0.5);
        break;
      }
      case 'swipe': {
        const o = maNoyeOut(x, zz, 0.8, 6, 0.6); if (!o) return;
        mnNoise(o, o.t, 0.22, 'bandpass', 650, 1800, 1, 0.6, 0.03);
        mnVoice(o, o.t, 0.35, 180, 150, { am: 30, amD: 0.7, formants: [[900, 3, 1]], lp: 2400, lvl: 0.18, att: 0.02 });
        break;
      }
      case 'bite': {
        const o = maNoyeOut(x, zz, 0.6, 7, 1); if (!o) return;
        mnVoice(o, o.t, 0.7, 115, 90, { am: 28, amD: 0.8, formants: [[620, 3, 1], [1300, 5, 0.4]], lp: 1800, lvl: 0.4, att: 0.02 });
        maSplashSnd(x, zz, 0.7);
        break;
      }
      case 'kick': {
        const o = maNoyeOut(x, zz, 0.5, 6, 0.6); if (!o) return;
        mnTone(o, 'sine', 95, 45, o.t, 0.16, 0.7);
        mnNoise(o, o.t, 0.08, 'lowpass', 900, 200, 0.8, 0.5, 0.002);
        maSplashSnd(x, zz, 0.55);
        break;
      }
      case 'death': {
        const o = maNoyeOut(x, zz, 0.55, 10, 2.5); if (!o) return;
        mnVoice(o, o.t, 1.15, 150, 55, { am: 19, amD: 0.7, formants: [[480, 3, 1], [1000, 5, 0.4]], lp: 900, lvl: 0.36, att: 0.03 });
        for (let i = 0; i < 12; i++) mnBubble(o, o.t + 0.3 + i * rand(0.08, 0.14), rand(160, 360), rand(0.04, 0.08), 0.32 * (1 - i / 14));
        maSplashSnd(x, zz, 0.5);
        break;
      }
      case 'sink': {
        const o = maNoyeOut(x, zz, 0.32, 7, 2.2); if (!o) return;
        for (let i = 0; i < 8; i++) mnBubble(o, o.t + i * rand(0.15, 0.25), rand(120, 260), rand(0.05, 0.09), 0.3 * (1 - i / 9));
        break;
      }
      default: break;
    }
  } catch (e) { /* son facultatif */ }
}
/* Les voix de ceux qui approchent (les trois plus proches) : râles et bulles, une plainte de temps en temps. */
function maNoyesVoices(dt, C) {
  const cam = camera.position, near = [];
  for (const z of Zombies.list) {
    if (!z.noye || !z.alive || (z.ns !== 'stalk' && z.ns !== 'stare' && z.ns !== 'grip')) continue;
    const d = Math.hypot(z.hx - cam.x, z.hz - cam.z);
    if (d < 45) near.push([d, z]);
  }
  near.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < Math.min(4, near.length); i++) {
    const [d, z] = near[i];
    z.gurgleT -= dt; z.moanT -= dt;
    if (z.gurgleT <= 0) { z.gurgleT = rand(2.5, 5.5); if (d < 28) maNoyeSnd('gurgle', z.hx, z.hz); }
    if (z.moanT <= 0) { z.moanT = rand(7, 14); maNoyeSnd('moan', z.hx, z.hz); }
  }
}

/* ---------------------------------------------------------------- Partie, carte -- */
function maNoyesReset() {
  for (const z of Zombies.list.slice()) if (z.noye) { if (player.grabbedBy === z) maNoyeRelease(z, true); removeZombie(z); }
  Object.assign(MA_NOYES, { t: 0, waterT: 0, first: 5, kickCd: 0, rip: 3, spawned: 0, killed: 0, eaten: 0, packs: 0, waiting: 0, attackers: 0, seen: false, hintGrip: false, hintGrab: false, hintShore: false, hintWait: false });
  if (MA_NOYES.muffled) { MA_NOYES.muffled = false; if (typeof Sound !== 'undefined') Sound.setMuffle(MA_SWIM.on ? 2600 : false); }
  if (MA_NG.pts) { MA_NG.pts.geometry.setDrawRange(0, 0); MA_NG.quads.geometry.setDrawRange(0, 0); }
}
/* F8 : ce que font les noyés. */
function maNoyeDiag() {
  const by = {};
  let n = 0;
  for (const z of Zombies.list) if (z.noye && !z.removed) { n++; const k = z.ns === 'stalk' && z.waiting ? 'wait' : z.ns; by[k] = (by[k] || 0) + 1; }
  const S = MA_NOYES, list = Object.keys(by).map((k) => `${by[k]} ${MA_NOYE_ST[k] || k}`).join(', ');
  const r = Math.max(1, G.round), atk = MA_SWIM.on ? `${MA_NOYE.attack.swim(r)} sur un nageur` : `${MA_NOYE.attack.boat(r)} à la barque`;
  const next = !maPlayerOnWater() ? 'sur l’eau seulement' : G.round < 1 ? 'dès la manche 1' : S.waterT < S.first ? `premier dans ${Math.ceil(S.first - S.waterT)} s` : `prochain dans ${Math.max(0, Math.ceil(S.t))} s`;
  const V = VEH.drive && VEH.drive.T.boat ? VEH.drive : null;
  return `noyés : ${n}${n ? ` (${list})` : ''} · ${MA_NOYE.max(r)} à la fois, ${atk} au plus · ${next} · sortis ${S.spawned} (${S.packs || 0} groupes), tués ${S.killed}, engloutis par la bête ${S.eaten || 0}${V && V.noyes ? ` · ${V.noyes} agrippé${V.noyes > 1 ? 's' : ''} à la barque` : ''}`;
}

/* ---------------------------------------------------------------- Écran « Modèles » -- */
/* Le Noyé dans l'aperçu : un disque d'eau translucide à hauteur de la ligne d'eau (1,45 m), le plat-bord
   d'une barque pour « S'agrippe », la lueur des yeux. Animations : Repos (sur place), À fleur d'eau (les
   yeux seuls dépassent), Nage, Surgit, S'agrippe (griffes, coup, secousse), Saisit (un nageur), Mort (il
   flotte sur le dos, puis coule). */
SPECIMEN_MODELS.ma_noye = { anims: ['idle', 'guet', 'nage', 'surgit', 'agrippe', 'saisit', 'death'], make: () => maNoyeSpecimen() };
function maNoyeSpecimen() {
  const R = {};
  const root = zombieInstances(R, 1, ['ma_noye']);
  for (const m of R.parts) m.castShadow = true;
  const z = maNoyeObject(0, maNoyeLook(), R);
  z.spec = true; z.id = 13; z.wl = 1.45; z.ns = 'idle'; z.ey = z.eyT = 1.5; z.glow = 1;
  paintZombieSlot(0, z.look, R, 'ma_noye');
  const props = new THREE.Group();
  root.add(props);
  // eau : disque translucide qui s'efface sur ses bords
  const c = makeCanvas(128, 128), g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.7, '#d8d8d8'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), new THREE.MeshStandardMaterial({ color: 0x24342c, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.5, alphaMap: toTex(c, { clamp: true, srgb: false }), depthWrite: false, side: THREE.DoubleSide }));
  linearize(water.material);
  water.rotation.x = -Math.PI / 2; water.position.y = z.wl; water.renderOrder = 2;
  props.add(water);
  // plat-bord et bordé d'une barque (« S'agrippe »)
  const wood = linearize(new THREE.MeshStandardMaterial({ color: 0x4f6356, roughness: 0.8 }));
  const rail = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.045, 0.075), wood), side = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.02), wood);
  side.position.set(0, -0.06, 0.03);
  for (const m of [top, side]) { m.castShadow = true; m.receiveShadow = true; rail.add(m); }
  rail.visible = false;
  props.add(rail);
  // lueur des yeux
  const eyeGlow = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: MA_NOYE.eye, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.1); root.add(s); return s;
  });
  const S = { anim: null, armT: -1, kt: 0, cycle: -1 };
  const C0 = new THREE.Vector3();
  return {
    root,
    view: [1.0, 1.5],
    restyle() { z.look = maNoyeLook(); paintZombieSlot(0, z.look, R, 'ma_noye'); },
    center: () => C0.setFromMatrixPosition(z.rig.hips.matrixWorld),
    armShot() {
      if (z.gib === 3) return false;
      const side = z.gib & 1 ? 2 : z.gib & 2 ? 1 : Math.random() < 0.5 ? 1 : 2;
      z.gib |= side; S.armT = 0;
      zHitReact(z, 'arm', side === 1 ? 1 : -1, true, 1.3);
      return true;
    },
    pose(anim, t, dt, yaw) {
      MA_NOYE_U.uMnWater.value = -1000;                     // l'aperçu montre tout le corps
      if (anim !== S.anim) { S.anim = anim; S.cycle = -1; z.headless = false; z.alive = true; z.act = null; }
      z.t += dt;
      z.yaw = yaw; z.hx = 0; z.hz = 0;
      props.rotation.y = yaw;
      rail.visible = anim === 'agrippe';
      const W = z.wl;
      let glowK = 1;
      switch (anim) {
        case 'guet': z.ns = 'stalk'; z.lean = 0.5; z.moving = 0.4; z.eyT = W + 0.035 + 0.012 * Math.sin(z.t * 1.7); break;
        case 'nage': z.ns = 'stalk'; z.lean = 0.85; z.moving = 1.8; z.eyT = W + 0.05; break;
        case 'surgit': {
          const u = t % 2.6;
          if (u < 0.9) { z.ns = 'stalk'; z.lean = 0.5; z.moving = 1; z.eyT = W + 0.04; }
          else if (u < 1.4) { if (z.ns !== 'surge') { z.ns = 'surge'; z.st = 0; maNoyeSnd('screech', null, null); } z.eyT = W + lerp(0.06, 0.55, smooth((u - 0.9) / 0.5)); }
          else if (u < 2.0) { z.ns = 'surge'; z.st = MA_NOYE.surge.dur; z.eyT = W + 0.55; }
          else { if (z.ns !== 'fall') { z.ns = 'fall'; z.st = 0; } z.eyT = W - 0.3 * Math.sin(Math.PI * (u - 2.0) / 0.6); }
          glowK = 1.3;
          break;
        }
        case 'agrippe': {
          z.ns = 'grip';
          const u = t % 1.8, cyc = Math.floor(t / 1.8);
          if (cyc !== S.cycle) { S.cycle = cyc; z.act = { kind: ['claw', 'swipe', 'claw', 'rock'][cyc % 4], t: 0, hit: false }; }
          if (z.act) { z.act.t = u; if (u >= 0.38 && !z.act.hit) { z.act.hit = true; maNoyeSnd(z.act.kind === 'swipe' ? 'swipe' : 'claw', null, null); } if (u >= 0.8) z.act = null; }
          // le plat-bord, devant lui (0,5 m), à 0,38 m au-dessus de l'eau
          rail.position.set(0, W + 0.38, 0.5);
          z.gripW.set(Math.cos(yaw) * 0.175 + Math.sin(yaw) * 0.47, W + 0.36, -Math.sin(yaw) * 0.175 + Math.cos(yaw) * 0.47);
          break;
        }
        case 'saisit': z.ns = 'grab'; z.eyT = W + 0.1 + 0.03 * Math.sin(z.t * 9); break;
        case 'death': {
          const u = t % 5;
          if (u < dt * 1.5 || z.ns !== 'dead') { z.ns = 'dead'; z.st = u; z.eyT = W + 0.02; z.sinkV = 0; }
          z.st = u;
          if (u > 0.9) { z.sinkV = Math.min(0.42, z.sinkV + dt * 0.22); z.eyT = Math.max(W - 0.95, z.eyT - z.sinkV * dt); } else z.eyT = W + 0.02;
          glowK = Math.max(0, 1 - u / 0.6);
          break;
        }
        default: z.ns = 'idle'; z.eyT = W + 0.06 + 0.015 * Math.sin(z.t * 1.6);
      }
      if (z.ns !== 'grip') { z.st += dt; z.ey = damp(z.ey, z.eyT, anim === 'death' ? 30 : 10, dt); }
      z.blendK = anim === 'agrippe' ? 12 : 8;
      z.blinkT -= dt;
      if (z.blinkT <= 0) { z.blink = 0.13; z.blinkT = rand(2.5, 6); }
      if (z.blink > 0) z.blink -= dt;
      maNoyeAnimate(z, dt);
      writeZombieMatrices(z);
      if (S.armT >= 0) { S.armT += dt; if (S.armT > 4.5) { z.gib = 0; S.armT = -1; } }
      flushZombieMatrices(R);
      const k = (z.blink > 0 ? 0 : 1) * glowK;
      // la lueur au fond de l'orbite (sous l'éclairage de l'écran, devant l'œil elle le blanchissait), éteinte quand la
      // tête se détourne (pas de halo autour du crâne)
      const nk = z.rig.neck.matrixWorld, cp = Models.camera ? Models.camera.position : null;
      _mnF.set(0, 0, 1).transformDirection(nk); _mnR.set(1, 0, 0).transformDirection(nk);
      eyeGlow.forEach((s, i) => {
        s.position.set(i ? 0.04 : -0.04, ZRIG.head - 0.003, 0.11).applyMatrix4(nk);
        let kf = 1;
        if (cp) {
          const sx = i ? 0.5 : -0.5, tx = cp.x - s.position.x, ty = cp.y - s.position.y, tz = cp.z - s.position.z;
          kf = owSmoothstep(-0.15, 0.35, ((_mnF.x * 0.87 + _mnR.x * sx) * tx + (_mnF.y * 0.87 + _mnR.y * sx) * ty + (_mnF.z * 0.87 + _mnR.z * sx) * tz) / (Math.hypot(tx, ty, tz) || 1));
        }
        s.material.opacity = 0.85 * k * kf; s.visible = k * kf > 0.01;
      });
    },
  };
}
/* Le son de chaque animation (setModelAnim). */
function maNoyeSpecSound(k) {
  const snd = { idle: 'gurgle', guet: 'gurgle', nage: 'moan', surgit: 'surface', agrippe: 'slap', saisit: 'bite', death: 'death' }[k];
  if (snd) maNoyeSnd(snd, null, null); else Sound.ui();
}
/* Libellés et fiche (MODEL_ANIMS et SPECIMEN_FACTS sont définis plus bas dans le jeu : appelé après eux). */
function maNoyeSpecimenSetup() {
  Object.assign(MODEL_ANIMS, { guet: 'À fleur d’eau', nage: 'Nage', surgit: 'Surgit', agrippe: 'S’agrippe', saisit: 'Saisit un nageur' });
  SPECIMEN_FACTS.noye = (type) => {
    const hp = (r) => fmtNum(Math.round(khHp(r) * MA_NOYE.hp), 0), Gp = MA_NOYE.grip, B = MA_NOYE.grab, sp = MA_NOYE.speed;
    return {
      bars: [['PV', (khHp(1) * MA_NOYE.hp) / zombieHpForRound(1)], ['Vitesse', sp(10)[1] / SPEEDS.jog[1]], ['Dégâts', Gp.swipe / RULES.zombieHit]],
      ref: `Trait clair = zombie standard (×1) : ${fmtNum(zombieHpForRound(1), 0)} PV à la manche 1, trot de ${fmtNum(SPEEDS.jog[0])} à ${fmtNum(SPEEDS.jog[1])} m/s, ${fmtNum(RULES.zombieHit, 0)} dégâts par coup.`,
      cards: [
        [`Capacité · ${type.ability}`, `Il ne vient que si vous êtes sur l’eau. Il jaillit sur une barque lente (moins de ${fmtNum(MA_NOYE.surge.boatMax)} m/s) et s’agrippe au plat-bord : il la freine, la fait gîter et déchire la coque ; il saisit un nageur et l’enfonce.`],
        ['Faiblesse', `Sa tête ne dépasse guère de l’eau, mais ses yeux le trahissent. Au-delà de ${fmtNum(Gp.slip)} m/s, il lâche prise ; une barque lancée lui passe dessus. Il ne quitte jamais l’eau profonde.`],
      ],
      details: [
        ['Apparition', 'Sur l’eau', '', `En barque ou à la nage, dès la manche 1 : ils sortent du fond par groupes de ${MA_NOYE.pack(1)[0]} à ${MA_NOYE.pack(10)[1]}, à ${MA_NOYE.dist[0]}-${MA_NOYE.dist[1]} m, plutôt devant une barque lancée · ${MA_NOYE.max(1)} à la fois à la manche 1, ${MA_NOYE.max(8)} dès la 8`],
        ['À tour de rôle', `${MA_NOYE.attack.boat(1)} à ${MA_NOYE.attack.boat(9)}`, '', `Seuls les plus proches attaquent : ${MA_NOYE.attack.boat(1)} à ${MA_NOYE.attack.boat(9)} agrippés à la barque, ${MA_NOYE.attack.swim(1)} à ${MA_NOYE.attack.swim(7)} sur un nageur, selon la manche ; les autres tournent autour en attendant leur tour`],
        ['Points de vie', `${hp(1)} → ${hp(10)} → ${hp(20)}`, '', 'Manches 1, 10 et 20 : les trois quarts de ceux d’un zombie du marais'],
        ['Vitesse', `${fmtNum(sp(1)[0])} à ${fmtNum(sp(10)[1])} m/s`, '', 'À la nage : bien moins qu’une barque, un peu moins qu’un nageur qui force (Maj : 2,1 m/s)'],
        ['Barque', `${fmtNum(Gp.hull(1), 0)} à ${fmtNum(Gp.hull(10), 1)} par griffe`, '', `Agrippé, il déchire la coque (à zéro, elle chavire) et griffe le barreur à moins de ${fmtNum(Gp.reach)} m (${Gp.swipe} dégâts)`],
        ['Nageur', `${B.bite} puis ${B.dps}/s`, '', `Il vous tient ${B.dur} s au plus, sous l’eau · V (ou E) : un coup de pied le repousse`],
        ['Yeux', 'Rouge braise', '', 'Au ras de l’eau, dans la brume : on voit leurs yeux bien avant leur tête'],
        ['Terre ferme', 'Jamais', '', `Quand vous prenez pied, il reste au bord de l’eau profonde à vous regarder de ${MA_NOYE.stare[0]} à ${MA_NOYE.stare[1]} s, puis retourne au fond`],
        ['Points rapportés', `+${RULES.pointsKill} à +${RULES.pointsKnife}`, '', `Élimination +${RULES.pointsKill}, tête +${RULES.pointsHead}, coup de pied +${RULES.pointsKnife} · +${RULES.pointsHit} par touche · hors du décompte de la manche`],
      ],
    };
  };
}
