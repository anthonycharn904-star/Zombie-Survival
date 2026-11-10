/* ================================================================ Les Stryges ==
   Kit 2.0.7 (map en développement). Demande d'Anthony (30 octobre 2026) : sur la 1re map, une manche
   spéciale de chiens ; sur la 2e, la tempête de sable ; sur le marais, des « petits vampires » volants
   (fiche N°07 « La Stryge », faite avec Claude) : même fréquence et même nombre que les chiens zombies,
   la manche tirée au hasard comme celle des chiens (pas « dès la manche 12 » comme sur la fiche) ; une
   stryge qui tombe dans l'eau meurt noyée.

   La Stryge (N°07, harceleuse aérienne) : mi-vampire, mi-cadavre ; 1,75 m, 3,2 m d'envergure (fiche).
   Peau #B9B3C9 sur des côtes saillantes, crâne chauve aux oreilles pointues, yeux rouges émissifs
   (#FF2E3A), crocs, sang (#8E0F1A) autour de la bouche et en coulures sur la poitrine ; cape noire à col
   montant (#1E1B24), pantalon déchiré, mains et pieds griffus ; ailes : bras, trois doigts, membrane
   (#382F45) aux trous déchirés (alpha).
     · elle vole entre 3 et 5 m au-dessus du sol ou de l'eau, en cercle autour du joueur (battements lents,
       glissés) ;
     · le piqué : un cri, les ailes levées (0,6 s), puis elle plonge en arc sur la tête du joueur
       (traînée sombre) ; elle corrige sa course, mais pas assez pour suivre un pas de côté au dernier
       moment ; au contact, elle mord et draine : les dégâts qu'elle fait la soignent d'autant ; elle
       remonte et repart ;
     · deux tirs dans la membrane (un par tir, quelle que soit l'arme) et elle s'écrase (les trous
       s'agrandissent à chaque tir ; une balle qui passe par un trou ne la touche pas) ; au sol, elle rampe
       vers le joueur et mord ; au-dessus de l'eau (plus de 0,75 m), elle se noie : elle se débat, coule,
       et compte comme tuée (points d'une élimination) ;
     · le joueur à l'abri d'un toit : elle se pose dehors et entre à quatre pattes, ailes repliées ; dès
       qu'il ressort à ciel ouvert, elle reprend son vol.
   Manche : celle des chiens (planDogBlock : une ou deux par tranche de dix manches, jamais aux manches 1 et
   2, au moins 3 d'écart), avec leurs nombres (dogsForRound : 6, puis +2, 24 au plus), leurs vagues (4 à 6,
   6 en vie au plus) et leur récompense (munitions max sur la dernière ; tuée au-dessus de l'eau, à côté du
   joueur). PV : ×1,3 ceux d'un zombie du
   marais de la même manche (khHp) ; vitesse ×1,7 le trot ; morsure ×1,2 le coup d'un zombie (fiche).
   Les Noyés restent dans l'eau pendant la manche.
   Branchements : patches.py (matières ; manche : planification des chiens rouverte dans le marais, PV,
   annonce, vagues, fin, récompense, compteur rouge ; mise à jour, mort, tir, dégâts, rampe, bras, véhicules ;
   fiche, sons et bouton « Tir dans l'aile » de l'écran « Modèles »), maUpdate (après les Noyés), maLoad
   (lueurs, traînées, précompilation), maResetWorld, maUnload, F8. Crochets : maOn('stryge', …).
   ============================================================================================ */
const MA_STRYGE = {
  eye: 0xff2e3a,                                      // fiche : yeux émissifs rouges
  hp: 1.3, speedK: 1.7, dmgK: 1.2,                    // fiche N°07 (× le zombie du marais : khHp, trot, coup)
  alt: [3, 5],                                        // m au-dessus du sol ou de l'eau (fiche : « vole entre 3 et 5 m »)
  ring: [6.5, 11],                                    // m : rayon du cercle autour du joueur
  cruise: () => [SPEEDS.jog[0] * MA_STRYGE.speedK, SPEEDS.jog[1] * MA_STRYGE.speedK],   // 3,6 à 4,3 m/s
  chase: 8.5,                                         // m/s au plus, pour rattraper une barque lancée
  // le piqué : cri et ailes levées (windup), vitesse et accélération, virage au plus (rad/s), rayon de la
  // morsure, visée au-dessus de la tête, durée au plus, repos entre deux piqués, distances de départ, écart
  // entre deux départs (toutes stryges)
  // la correction de course (0,7 rad/s) cesse à 2,2 m (lock) : un pas de côté à la fin du plongeon la fait manquer
  dive: { windup: 0.6, speed: 9.5, accel: 14, turn: 0.7, lock: 2.2, hit: 0.95, over: 0.32, max: 2.4, cool: [4, 7], from: [7, 14], gap: 1.8 },
  attackers: (n) => (n < 2 ? 1 : n < 4 ? 2 : 3),      // en piqué (ou en morsure au sol) à la fois, selon les manches de Stryges déjà jouées
  heal: 1,                                            // PV repris par point de dégâts infligé (drain)
  wing: { hits: 2, k: 0.5, tear: 0.3 },               // tirs dans la membrane avant la chute ; dégâts gardés ; trous en plus par tir
  fallDmg: 0.2,                                       // part des PV max perdue en s'écrasant
  // au sol : rampe (ailes brisées) ou à quatre pattes ; morsure : portée, cadence ; autant mordent à la fois
  // qu'il en pique en vol (attackers) ; les autres attendent à 2,4 m ; après une morsure, elle recule d'un bond
  crawl: { speed: [0.85, 1.1], prowl: [1.8, 2.2], reach: 1.25, cycle: 1.6, wait: 2.4, back: 0.5 },
  drown: 0.75,                                        // m d'eau où elle se noie
  spawn: { dist: [28, 40], alt: [8, 12] },
  far: 80,
};
const MA_STRYGE_EYE_LIN = new THREE.Color(MA_STRYGE.eye).convertSRGBToLinear().getHex();
const MA_STRYGE_TYPE = {
  id: 'ma_stryge', num: '07', name: 'La Stryge', cls: 'Harceleuse aérienne (Marécages Maudits)', tag: 'Manche spéciale', model: 'ma_stryge', facts: 'stryge',
  maps: ['marais'], stryge: true,
  desc: 'Mi-vampire, mi-cadavre, elle guette depuis les hauteurs et fond sur sa proie. Elles n’arrivent qu’en manche spéciale, au hasard, comme les chiens.',
  sign: 'Deux yeux rouges qui tournent au-dessus de vous dans la brume ; un cri, puis le piqué.',
  mult: { hp: MA_STRYGE.hp, speed: MA_STRYGE.speedK, damage: MA_STRYGE.dmgK }, headMult: 2, helmet: false, ability: 'Piqué',
};
SPECIMEN_TYPES.push(MA_STRYGE_TYPE);                  // fiche de l'écran « Modèles » et compteur d'éliminations
const MA_STRYGE_ST = { emerge: 'apparaît', arrive: 'arrive', circle: 'tourne', windup: 'crie', dive: 'pique', climb: 'remonte', land: 'se pose', prowl: 'à quatre pattes', takeoff: 's’envole', crash: 'tombe', grounded: 'au sol', crawl: 'rampe', drown: 'se noie', fall: 'chute (morte)', dead: 'morte', sink: 'coule' };
/* Manche de Stryges : la manche spéciale (celle des chiens) dans le marais. */
const maStrygeRoundOn = () => typeof OW !== 'undefined' && OW.on && OW.worldId === 'marais';
const maStrygeHp = (r) => Math.round(khHp(Math.max(1, r)) * MA_STRYGE.hp);

/* ---------------------------------------------------------------- Squelette --
   Racine à la taille (le centre du corps en vol) ; buste (hips) et bassin (pelvis) ; cou et mâchoire ;
   bras ; jambes ; ailes : base (wb, sur l'omoplate), poignet (ww, fixe dans la base), trois doigts (wd1-3,
   tournés autour du poignet) ; bas de la cape (cp). Repère de l'aile (gauche) : x vers l'extérieur, z vers
   le haut du corps, y hors du dos ; la membrane est dans le plan xz. Battre = tourner autour de z (la
   charnière omoplate-hanche, le long du corps : la membrane y reste attachée), balayer = autour de y,
   vriller = autour de x. L'aile droite : la même, tournée d'un demi-tour autour de l'axe du corps. */
const MS_RIG = { neck: 0.56, sh: [0.19, 0.48, 0], hip: [0.085, -0.03, 0], thigh: 0.43, upper: 0.28, wb: [0.072, 0.4, -0.1], cp: [0, 0.07, -0.128], jaw: [0, ZRIG.head - 0.058, 0.026], waist: 0.94 };
// aile (repère de la base) : coude E, poignet W, attache basse Bt ; doigts : longueurs, angles ouverts et repliés
// (depuis +x vers −z, autour du poignet), creux du bord de fuite entre deux rayons
const MS_W = { E: [0.27, 0, 0.2], W: [0.7, 0, 0.3], Bt: [0.03, 0, -0.46], L: [0.8, 0.8, 0.7], open: [0.3, 0.78, 1.25], fold: [2.02, 2.11, 2.2], scal: [0.17, 0.19, 0.24] };
MS_W.a4 = Math.atan2(-(MS_W.Bt[2] - MS_W.W[2]), MS_W.Bt[0] - MS_W.W[0]);
MS_W.L4 = Math.hypot(MS_W.Bt[0] - MS_W.W[0], MS_W.Bt[2] - MS_W.W[2]);
const MS_BONES = ['root', 'pelvis', 'hips', 'neck', 'jaw', 'cp', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'knL', 'knR', 'wbL', 'wbR', 'wwL', 'wwR', 'wd1L', 'wd2L', 'wd3L', 'wd1R', 'wd2R', 'wd3R'];
function makeStrygeRig() {
  const o = () => new THREE.Object3D();
  const r = { root: o(), pelvis: o(), hips: o(), neck: o(), jaw: o(), cp: o() };
  r.body = r.root;
  r.root.add(r.pelvis, r.hips);
  r.hips.add(r.neck, r.cp);
  r.neck.position.set(0, MS_RIG.neck, 0.012); r.cp.position.fromArray(MS_RIG.cp);
  r.neck.add(r.jaw); r.jaw.position.fromArray(MS_RIG.jaw);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = o(), el = o(), hp = o(), kn = o(), wb = o(), ww = o();
    r.hips.add(sh); sh.position.set(sx * MS_RIG.sh[0], MS_RIG.sh[1], MS_RIG.sh[2]);
    sh.add(el); el.position.y = -MS_RIG.upper;
    r.pelvis.add(hp); hp.position.set(sx * MS_RIG.hip[0], MS_RIG.hip[1], 0);
    hp.add(kn); kn.position.y = -MS_RIG.thigh;
    r.hips.add(wb); wb.position.set(sx * MS_RIG.wb[0], MS_RIG.wb[1], MS_RIG.wb[2]);
    wb.add(ww); ww.position.fromArray(MS_W.W);
    r[`sh${s}`] = sh; r[`el${s}`] = el; r[`hip${s}`] = hp; r[`kn${s}`] = kn; r[`wb${s}`] = wb; r[`ww${s}`] = ww;
    for (let k = 1; k <= 3; k++) { const d = o(); ww.add(d); r[`wd${k}${s}`] = d; }
  }
  return r;
}
ZBONES.wb = ['wbL', 'wbR']; ZBONES.ww = ['wwL', 'wwR']; ZBONES.wd1 = ['wd1L', 'wd1R']; ZBONES.wd2 = ['wd2L', 'wd2R']; ZBONES.wd3 = ['wd3L', 'wd3R'];

/* ---- Modèle : pièces sur les os ; la membrane (deux instances par stryge, une par aile) prend ses réglages
   dans la couleur de l'instance : r repli, g déchirures, b gonflement (maStrygeWingTint). */
ZPARTS.ma_stryge = [
  { geo: 'torso', bone: 'hips', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'mantle', bone: 'hips', mat: 'maStrygeCloth', tint: 'cloth' },
  { geo: 'cape', bone: 'cp', mat: 'maStrygeCloth', tint: 'cloth' },
  { geo: 'pelvis', bone: 'pelvis', mat: 'maStrygeCloth', tint: 'cloth' },
  { geo: 'head', bone: 'neck', mat: 'maStrygeSkin', tint: 'skin', head: true },
  { geo: 'jaw', bone: 'jaw', mat: 'maStrygeSkin', tint: 'skin', head: true },
  { geo: 'eyes', bone: 'neck', mat: 'khEyes', tint: 'eyes', head: true },
  { geo: 'upper', bone: 'sh', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'fore', bone: 'el', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'thigh', bone: 'hip', mat: 'maStrygeCloth', tint: 'cloth' },
  { geo: 'shinCloth', bone: 'kn', mat: 'maStrygeCloth', tint: 'cloth' },
  { geo: 'shin', bone: 'kn', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'warm', bone: 'wb', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'wfin1', bone: 'wd1', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'wfin2', bone: 'wd2', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'wfin3', bone: 'wd3', mat: 'maStrygeSkin', tint: 'skin' },
  { geo: 'membrane', bone: 'ww', mat: 'maStrygeWing', tint: 'fan' },
];

/* ---------------------------------------------------------------- Textures --
   Les couleurs sont dans les sommets ; les textures donnent le grain : peau sèche et fine (rides, veines
   bleutées, marbrures) ; étoffe épaisse usée (trame, taches, accrocs) ; membrane : veines, plis, trous
   déchirés et bord de fuite effiloché (alpha), et un champ de déchirures (alphaMap, canal vert) : sous la
   valeur « dégâts » de l'aile, la membrane disparaît (les trous s'agrandissent à chaque tir). */
function maStrygeSkinTex() {
  const w = 256, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  const n = valueNoise(w, h, [[5, 5, 1], [14, 14, 0.55], [40, 40, 0.3]], 1.9);
  paintPixels(g, w, h, (x, y, col) => { const v = n[y * w + x], k = 0.82 + 0.22 * v; col[0] = 232 * k; col[1] = 228 * k; col[2] = 238 * k; });
  for (let i = 0; i < 30; i++) crack(g, w, h, rand(0, w), rand(0, h), randInt(5, 12), rand(0.6, 1.3), `rgba(${randInt(64, 84)},${randInt(70, 90)},${randInt(118, 140)},0.32)`);
  for (let i = 0; i < 90; i++) {                                     // rides fines de la peau desséchée
    const x = rand(0, w), y = rand(0, h), l = rand(5, 12);
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(40,34,52,0.2)'; g.lineWidth = 0.8;
    for (const ox of [-w, 0, w]) { g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + l / 2, y + rand(-2, 2), x + ox + l, y + rand(-1.5, 1.5)); g.stroke(); }
  }
  for (let i = 0; i < 9; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(10, 26), 'rgba(84,62,96,0.16)');
  for (let i = 0; i < 6; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(8, 18), 'rgba(110,40,52,0.12)');
  return toTex(c);
}
function maStrygeClothTex() {
  const w = 256, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  const n = valueNoise(w, h, [[6, 6, 1], [22, 22, 0.5], [64, 64, 0.2]], 1.7);
  paintPixels(g, w, h, (x, y, col) => {
    const weave = ((x + (y >> 2)) % 3 === 0 ? 0.9 : 1) * ((y & 3) === 0 ? 0.93 : 1), k = (0.72 + 0.3 * n[y * w + x]) * weave;
    col[0] = 220 * k; col[1] = 216 * k; col[2] = 226 * k;
  });
  for (let i = 0; i < 8; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(16, 34), 'rgba(40,30,34,0.3)');
  for (let i = 0; i < 5; i++) blot(g, w, h, rand(0, w), rand(0, h), rand(10, 22), 'rgba(90,24,30,0.22)');   // sang séché
  for (let i = 0; i < 30; i++) {                                    // fils tirés, usure
    const x = rand(0, w), y = rand(0, h);
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-3, 3), y + rand(6, 16)); g.stroke();
  }
  return toTex(c);
}
/* Membrane : u = secteur (0 à 0,75 : les trois secteurs du poignet ; 0,75 à 1 : le panneau du bras), v = rayon
   (1 : le bord de fuite, en haut de la toile). Les pixels de l'alpha et du champ servent aussi aux tirs. */
const MS_TEX = { wing: null, tear: null, wingA: null, tearG: null, ww: 512, wh: 256, tw: 256, th: 128 };
function maStrygeWingTex() {
  const W = MS_TEX.ww, H = MS_TEX.wh, c = makeCanvas(W, H), g = c.getContext('2d'), R = mulberry32(707);
  const rr = (a, b) => a + (b - a) * R();
  const n = valueNoise(W, H, [[8, 4, 1], [26, 13, 0.5], [70, 35, 0.22]], 1.5);
  paintPixels(g, W, H, (x, y, col) => { const k = 0.8 + 0.26 * n[y * W + x]; col[0] = 238 * k; col[1] = 230 * k; col[2] = 242 * k; });
  // plis de tension, le long des doigts (lignes de rayon constant : u constant), plus marqués près du poignet
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 7; i++) {
      const u = (s + rr(0.08, 0.92)) / 3 * 0.75 * W;
      const grd = g.createLinearGradient(0, H, 0, 0);
      grd.addColorStop(0, 'rgba(50,40,62,0.32)'); grd.addColorStop(1, 'rgba(50,40,62,0)');
      g.strokeStyle = grd; g.lineWidth = rr(1, 2.4);
      g.beginPath(); g.moveTo(u, H); g.quadraticCurveTo(u + rr(-12, 12), H * 0.5, u + rr(-20, 20), H * rr(0.05, 0.35)); g.stroke();
    }
  }
  // veines : fines, sombres, ramifiées, qui partent des doigts vers le milieu des secteurs
  const vein = (x, y, a, len, wdt) => {
    g.strokeStyle = `rgba(${36 + (R() * 20) | 0},${22 + (R() * 12) | 0},${44 + (R() * 20) | 0},0.55)`; g.lineCap = 'round';
    let px = x, py = y;
    for (let i = 0; i < len; i++) {
      a += rr(-0.35, 0.35);
      const nx = px + Math.cos(a) * rr(5, 10), ny = py + Math.sin(a) * rr(5, 10);
      g.lineWidth = wdt * (1 - i / len) + 0.4;
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (R() < 0.18 && len - i > 3) vein(nx, ny, a + (R() < 0.5 ? -1 : 1) * rr(0.5, 1.1), Math.floor((len - i) * 0.6), wdt * 0.6);
      px = nx; py = ny;
    }
  };
  for (let s = 0; s <= 3; s++) {
    const u = (s / 3) * 0.75 * W;
    for (let i = 0; i < 6; i++) { const y = H * rr(0.15, 0.9); if (s > 0) vein(u - 2, y, Math.PI + rr(-0.5, 0.5), randInt(5, 11), 2.2); if (s < 3) vein(u + 2, y, rr(-0.5, 0.5), randInt(5, 11), 2.2); }
  }
  for (let i = 0; i < 10; i++) vein(W * rr(0.77, 0.98), H * rr(0.1, 0.9), rr(0, TAU), randInt(4, 9), 1.8);
  for (let i = 0; i < 14; i++) blot(g, W, H, rr(0, W), rr(0, H), rr(14, 40), 'rgba(40,22,40,0.18)');
  // trous déchirés et bord de fuite effiloché (alpha)
  g.globalCompositeOperation = 'destination-out';
  const tear = (x, y, r, k = 1) => {
    g.fillStyle = 'rgba(0,0,0,1)'; g.beginPath();
    const m = 9 + (R() * 6 | 0);
    for (let i = 0; i < m; i++) { const a = (i / m) * TAU, q = r * rr(0.35, 1.25) * (i % 2 ? 1 : rr(0.5, 1)); const px = x + Math.cos(a) * q * 1.4 * k, py = y + Math.sin(a) * q; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath(); g.fill();
  };
  // fiche : de grands accrocs dans le deuxième et le troisième secteur, quelques petits ailleurs
  tear(W * 0.33, H * 0.3, 15); tear(W * 0.37, H * 0.4, 6); tear(W * 0.55, H * 0.24, 19, 1.2); tear(W * 0.6, H * 0.52, 8); tear(W * 0.15, H * 0.35, 7);
  tear(W * 0.88, H * 0.42, 9); tear(W * 0.47, H * 0.62, 5); tear(W * 0.67, H * 0.18, 10);
  for (let i = 0; i < 70; i++) {                                    // le bord de fuite (v = 1 : y = 0) : dents, lambeaux
    const x = rr(0, 0.75 * W), d = rr(2, 9) + (R() < 0.12 ? rr(10, 26) : 0);
    g.beginPath(); g.moveTo(x - rr(2, 7), -1); g.lineTo(x + rr(-2, 2), d); g.lineTo(x + rr(2, 7), -1); g.closePath(); g.fill();
  }
  g.fillRect(0, 0, 0.75 * W, 2);
  g.globalCompositeOperation = 'source-over';
  MS_TEX.wingA = g.getImageData(0, 0, W, H).data;
  return c;
}
function maStrygeTearTex() {
  const W = MS_TEX.tw, H = MS_TEX.th, c = makeCanvas(W, H), g = c.getContext('2d'), R = mulberry32(911);
  // champ : distance au plus proche « germe » de déchirure, bruitée (0 au germe, 1 loin)
  const seeds = [];
  for (let i = 0; i < 26; i++) seeds.push([R() * W, R() * H * 0.95, 9 + R() * 22]);
  const n = valueNoise(W, H, [[16, 8, 1], [48, 24, 0.5]], 1.4);
  const img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 1;
    for (const [sx, sy, r] of seeds) m = Math.min(m, Math.hypot(x - sx, (y - sy) * 1.6) / (r * 2.4));
    // le bord de fuite se déchire en premier
    m = Math.min(m, (y / H) * 2.2 + 0.08);
    const v = clamp(m * 0.85 + (n[y * W + x] - 0.5) * 0.35 + 0.12, 0, 1) * 255, p = (y * W + x) * 4;
    d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  MS_TEX.tearG = d;
  return c;
}
/* Alpha de la membrane en (u, v) (tirs : une balle qui passe par un trou ne touche pas). */
function maStrygeWingSolid(u, v, dmg) {
  if (!MS_TEX.wingA) return true;
  const x = clamp(Math.floor(u * MS_TEX.ww), 0, MS_TEX.ww - 1), y = clamp(Math.floor((1 - v) * MS_TEX.wh), 0, MS_TEX.wh - 1);
  if (MS_TEX.wingA[(y * MS_TEX.ww + x) * 4 + 3] < 128) return false;
  if (dmg > 0 && MS_TEX.tearG) {
    const tx = clamp(Math.floor(u * MS_TEX.tw), 0, MS_TEX.tw - 1), ty = clamp(Math.floor((1 - v) * MS_TEX.th), 0, MS_TEX.th - 1);
    if (MS_TEX.tearG[(ty * MS_TEX.tw + tx) * 4 + 1] / 255 < dmg) return false;
  }
  return true;
}

/* ---------------------------------------------------------------- Membrane (nuanceur) --
   Les trois secteurs entre les doigts et la ligne poignet-hanche sont calculés dans le nuanceur, en
   éventail autour du poignet : aFan = (t, r), t de 0 à 3 (secteur et position dans le secteur), r de 0 à
   1 (du poignet au bord de fuite). Les angles des doigts suivent le repli (r de la couleur d'instance) :
   la membrane se replie en éventail avec eux, sans se déchirer ni passer au travers. Le panneau entre le
   bras et cette ligne est fixe (aFan.x < 0). Le bord de fuite se creuse entre deux doigts ; la membrane
   gonfle un peu sous les battements (b). Les déchirures (g) : alphaMap, canal vert. */
const MS_FAN_U = {
  uMsA0: { value: new THREE.Vector4(MS_W.open[0], MS_W.open[1], MS_W.open[2], MS_W.a4) },
  uMsA1: { value: new THREE.Vector4(MS_W.fold[0], MS_W.fold[1], MS_W.fold[2], MS_W.a4) },
  uMsL: { value: new THREE.Vector4(MS_W.L[0], MS_W.L[1], MS_W.L[2], MS_W.L4) },
  uMsS: { value: new THREE.Vector3(MS_W.scal[0], MS_W.scal[1], MS_W.scal[2]) },
};
const MS_FAN_GLSL = `
attribute vec2 aFan;
uniform vec4 uMsA0;
uniform vec4 uMsA1;
uniform vec4 uMsL;
uniform vec3 uMsS;
varying float vMsDmg;
`;
const MS_FAN_BEGIN = `
vec3 transformed = vec3( position );
#ifdef USE_INSTANCING_COLOR
	float msFold = instanceColor.r, msBil = instanceColor.b * 2.0 - 1.0;
	vMsDmg = instanceColor.g;
#else
	float msFold = 0.0, msBil = 0.0;
	vMsDmg = 0.0;
#endif
if ( aFan.x >= 0.0 ) {
	vec4 A = mix( uMsA0, uMsA1, msFold );
	float t = clamp( aFan.x, 0.0, 3.0 ), a0, a1, l0, l1, s, f;
	if ( t < 1.0 ) { a0 = A.x; a1 = A.y; l0 = uMsL.x; l1 = uMsL.y; s = uMsS.x; f = t; }
	else if ( t < 2.0 ) { a0 = A.y; a1 = A.z; l0 = uMsL.y; l1 = uMsL.z; s = uMsS.y; f = t - 1.0; }
	else { a0 = A.z; a1 = A.w; l0 = uMsL.z; l1 = uMsL.w; s = uMsS.z; f = t - 2.0; }
	float a = mix( a0, a1, f ), sf = sin( 3.14159265 * f );
	float rho = aFan.y * mix( l0, l1, f ) * ( 1.0 - s * sf * ( 1.0 - 0.5 * msFold ) );
	float bil = 0.09 * msBil * sf * sin( 3.14159265 * aFan.y ) * ( 1.0 - 0.7 * msFold ) * ( l0 + l1 ) * 0.5;
	transformed = vec3( cos( a ) * rho, bil, - sin( a ) * rho );
}
`;
function maStrygeFanPatch(mat, depth) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, MS_FAN_U);
    sh.vertexShader = MS_FAN_GLSL + sh.vertexShader.replace('#include <begin_vertex>', MS_FAN_BEGIN);
    if (!depth) {
      // la couleur de l'instance règle l'aile : elle ne teinte pas la membrane
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', '#ifdef USE_COLOR\n\tvColor = color;\n#endif');
    }
    sh.fragmentShader = 'varying float vMsDmg;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>',
      '#ifdef USE_ALPHAMAP\n\tif ( texture2D( alphaMap, vUv ).g < vMsDmg ) discard;\n#endif');
  };
  mat.customProgramCacheKey = () => (depth ? 'ms-fan-depth' : 'ms-fan');
  return mat;
}
/* Matières (buildMaterials, patches.py) : peau, étoffe, membrane (et sa matière d'ombre pour l'écran « Modèles »). */
function maStrygeMaterials(std) {
  MS_TEX.wing = toTex(maStrygeWingTex(), { clamp: true });
  MS_TEX.tear = toTex(maStrygeTearTex(), { clamp: true, srgb: false });
  MAT.maStrygeSkin = std({ map: share(maStrygeSkinTex()), vertexColors: true, roughness: 0.6, emissive: 0x241f2c, emissiveIntensity: 1 });
  MAT.maStrygeCloth = std({ map: share(maStrygeClothTex()), vertexColors: true, roughness: 0.9, emissive: 0x0c0a10, emissiveIntensity: 1 });
  MAT.maStrygeWing = maStrygeFanPatch(std({ map: share(MS_TEX.wing), alphaMap: share(MS_TEX.tear), alphaTest: 0.5, vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x160f1c, emissiveIntensity: 1 }), false);
  MS_TEX.depth = maStrygeFanPatch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: MS_TEX.wing, alphaMap: MS_TEX.tear, alphaTest: 0.5 }), true);
}

/* ---------------------------------------------------------------- Géométrie --
   Surfaces paramétriques (couleur par sommet) : buste (côtes, sternum, ventre creux, clavicules, vertèbres,
   omoplates, coulures de sang), tête (crâne allongé, arcades, joues creuses, pommettes, nez crochu, oreilles
   pointues, crocs, bouche ensanglantée), membres décharnés, cape à col montant (doublure à l'intérieur),
   pantalon déchiré ; ailes : bras, doigts noueux, griffe du pouce, membrane. */
function msSurf(nu, nv, fn, flip = false) {
  const pos = [], col = [], uv = [], idx = [], o = { p: [0, 0, 0], c: [1, 1, 1] };
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    o.c = [1, 1, 1];
    fn(i / nu, j / nv, o);
    pos.push(o.p[0], o.p[1], o.p[2]); col.push(o.c[0], o.c[1], o.c[2]); uv.push(i / nu, j / nv);
  }
  const W = nu + 1;
  // faces vers l'extérieur quand u tourne vers +x devant et que v monte (flip : l'inverse)
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/* Surface vue des deux côtés : la même, retournée (faces et normales), avec la couleur de l'envers. */
function msTwoSided(g, back) {
  const b = g.clone(), idx = b.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const N = b.attributes.normal.array, C = b.attributes.color.array, P = b.attributes.position.array, Nf = g.attributes.normal.array;
  for (let i = 0; i < N.length; i++) { N[i] = -N[i]; P[i] -= Nf[i] * 0.004; }
  if (back) for (let i = 0; i < C.length; i += 3) { C[i] = back[0]; C[i + 1] = back[1]; C[i + 2] = back[2]; }
  return [g, b];
}
/* Fusion : { geo, matrix, color } (couleur unie) ou { geo, matrix } (couleurs des sommets gardées). */
function msMerge(list) {
  let count = 0;
  const parts = list.map((p) => {
    const g0 = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (p.matrix) g0.applyMatrix4(p.matrix);
    count += g0.attributes.position.count;
    return { g: g0, color: p.color };
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), col = new Float32Array(count * 3);
  let o = 0;
  for (const { g, color } of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (color || !g.attributes.color) { const c = color || [1, 1, 1]; for (let k = 0; k < n; k++) col.set(c, (o + k) * 3); }
    else col.set(g.attributes.color.array, o * 3);
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const msMix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const msMul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
/* Tube le long de y (de y0 à y1), section elliptique rx(v) × rz(v) ; disp(u, v, ang) : déplacement radial ;
   col(u, v, ang) : couleur. ang : 0 devant (+z), π/2 à gauche (+x). */
function msTube(nu, nv, y0, y1, rx, rz, disp, col, x0 = 0, z0 = 0) {
  return msSurf(nu, nv, (u, v, o) => {
    const a = u * TAU, y = lerp(y0, y1, v), d = disp ? disp(u, v, a, y) : 0, s = Math.sin(a), c = Math.cos(a);
    const ex = rx(v, a) + d, ez = rz(v, a) + d;
    o.p = [x0 + s * ex, y, z0 + c * ez];
    if (col) o.c = col(u, v, a, y);
  });
}
/* Rayon entre a et b (tronc de cône), avec bosses (nœuds) : list [[t, +r]]. */
function msBone(a, b, r0, r1, color, knots = [], n = 7) {
  const dir = b.clone().sub(a), len = dir.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const g = msTube(n, 6, 0, len, (v) => lerp(r0, r1, v) + knots.reduce((s, [t, k]) => s + k * Math.exp(-Math.pow((v - t) / 0.07, 2)), 0),
    (v) => lerp(r0, r1, v) + knots.reduce((s, [t, k]) => s + k * Math.exp(-Math.pow((v - t) / 0.07, 2)), 0), null, () => color);
  const m = new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1));
  return { geo: g, matrix: m };
}
function maStrygeGeometries() {
  const k = zKit(), { C, V, box, cyl, ell, seg } = k, H = ZRIG.head;
  const rnd = mulberry32(1707), rr = (a, b) => a + (b - a) * rnd();
  const K = {
    skin: C(0xb9b3c9, 1.0), skinD: C(0x857e96, 1.0), skinH: C(0xd6d1e2, 1.0), vein: C(0x6c6a96, 1.0), rib: C(0xcfcadc, 1.0),
    blood: C(0x8e0f1a, 1.0), bloodD: C(0x4c0710, 1.0), mouth: C(0x2a070c), gum: C(0x6a1622), teeth: C(0xd9d0b4), fang: C(0xeee8d6),
    claw: C(0x17121a), socket: C(0x1c1420), nail: C(0x2a2230),
    cloth: C(0x1e1b24, 1.15), clothD: C(0x141218, 1.15), lining: C(0x2c1d2a, 1.15), clothH: C(0x2e2a36, 1.15),
    wingBone: C(0x3e3444, 1.0), wingBoneD: C(0x272029, 1.0), membrane: C(0x3a2c3e, 1.0), membraneD: C(0x281d2b, 1.0), membraneL: C(0x56404f, 1.0),
  };
  const sm = (a, b, x) => owSmoothstep(a, b, x);
  const nz3 = (x, y, z, s = 0) => mnNoise3(x + s, y, z);

  /* ---- buste (os hips) : de la taille (y 0) à la base du cou (0,56) ; décharné, côtes saillantes */
  const ribsY = [0.43, 0.395, 0.36, 0.325, 0.29, 0.255, 0.22];
  const torsoRX = (v) => { const y = v * 0.56; return y < 0.12 ? lerp(0.118, 0.112, y / 0.12) : y < 0.3 ? lerp(0.112, 0.152, (y - 0.12) / 0.18) : y < 0.47 ? lerp(0.152, 0.158, (y - 0.3) / 0.17) : lerp(0.158, 0.06, sm(0.47, 0.56, y)); };
  const torsoRZ = (v) => { const y = v * 0.56; return y < 0.14 ? lerp(0.082, 0.072, y / 0.14) : y < 0.32 ? lerp(0.072, 0.108, (y - 0.14) / 0.18) : y < 0.47 ? 0.11 : lerp(0.11, 0.055, sm(0.47, 0.56, y)); };
  const front = (a) => Math.max(0, Math.cos(a)), side = (a) => Math.abs(Math.sin(a)), back = (a) => Math.max(0, -Math.cos(a));
  const torso = msTube(40, 36, 0, 0.56, torsoRX, torsoRZ, (u, v, a, y) => {
    let d = 0;
    // côtes : des arcs qui descendent vers l'avant ; creux entre elles ; le sternum ; le ventre creusé sous les côtes
    const slope = 0.035 * front(a);
    let rib = 0;
    for (const ry of ribsY) rib = Math.max(rib, Math.exp(-Math.pow((y + slope - ry) / 0.0085, 2)));
    const ribZone = sm(0.2, 0.25, y) * (1 - sm(0.44, 0.47, y)) * sm(0.15, 0.6, side(a) + front(a) * 0.6) * (1 - 0.85 * sm(0.75, 0.97, front(a)));
    d += (rib * 0.0085 - 0.004) * ribZone;
    d += 0.006 * Math.exp(-Math.pow(a / 0.12, 2)) * sm(0.24, 0.3, y) * (1 - sm(0.44, 0.47, y));              // sternum
    d -= 0.022 * front(a) * front(a) * sm(0.03, 0.1, y) * (1 - sm(0.17, 0.23, y));                           // ventre creux
    d += 0.007 * Math.exp(-Math.pow((y - 0.515) / 0.012, 2)) * sm(0.2, 0.7, front(a)) * sm(0.1, 0.45, side(a));   // clavicules
    d += 0.008 * Math.exp(-Math.pow((a - Math.PI) / 0.09, 2)) * (0.5 + 0.5 * Math.cos(y * 175)) * sm(0.05, 0.12, y); // vertèbres
    d += 0.012 * back(a) * Math.exp(-Math.pow((side(a) - 0.55) / 0.2, 2)) * Math.exp(-Math.pow((y - 0.4) / 0.06, 2)); // omoplates
    return d + (nz3(Math.sin(a) * 9, y * 9, Math.cos(a) * 9, 3) - 0.5) * 0.004;
  }, (u, v, a, y) => {
    const slope = 0.035 * front(a);
    let rib = 0;
    for (const ry of ribsY) rib = Math.max(rib, Math.exp(-Math.pow((y + slope - ry) / 0.011, 2)));
    const ribZone = sm(0.2, 0.25, y) * (1 - sm(0.44, 0.47, y)) * sm(0.15, 0.6, side(a) + front(a) * 0.6);
    let c = msMix(K.skin, K.skinD, (1 - rib) * ribZone * 0.55);
    c = msMix(c, K.rib, rib * ribZone * 0.4);
    c = msMix(c, K.skinD, 0.5 * front(a) * sm(0.03, 0.1, y) * (1 - sm(0.17, 0.23, y)));
    c = msMix(c, K.skinD, 0.25 * sm(0.4, 0.05, y));
    // coulures de sang du menton sur la poitrine (devant), plus sombres en bas
    const ax = a > Math.PI ? a - TAU : a;
    for (const [cx, len, w] of [[-0.16, 0.13, 0.022], [-0.07, 0.24, 0.026], [0.02, 0.31, 0.03], [0.1, 0.18, 0.022], [0.2, 0.1, 0.02], [0.27, 0.2, 0.018]]) {
      const wob = cx + 0.012 * Math.sin(y * 60 + cx * 30);
      const k2 = Math.exp(-Math.pow((ax - wob) / w, 2)) * sm(0.56 - len - 0.015, 0.56 - len + 0.03, y) * sm(0.6, 0.47, y + 0.08);
      if (k2 > 0.02) c = msMix(c, y < 0.56 - len * 0.55 ? K.bloodD : K.blood, clamp(k2 * 1.3, 0, 0.9));
    }
    // le sang qui a coulé du menton : une tache au creux du cou
    c = msMix(c, K.blood, clamp(0.85 * Math.exp(-Math.pow(ax / 0.18, 2)) * sm(0.48, 0.55, y), 0, 0.85));
    return c;
  });
  // omoplates et attaches des ailes : les muscles qui tirent la peau du dos
  const wingRoot = [ell(0.05, 0.075, 0.04, 0.07, 0.4, -0.085, K.skinD, 0.2, 0, 0.35), ell(0.05, 0.075, 0.04, -0.07, 0.4, -0.085, K.skinD, 0.2, 0, -0.35)];
  const torsoG = msMerge([{ geo: torso }, ...wingRoot]);

  /* ---- cape : la pèlerine sur les épaules (ouverte devant), le col montant derrière la tête ; le bas (os cp) */
  const mantleOut = msSurf(36, 10, (u, v, o) => {
    // u : de l'avant gauche (0) à l'avant droit (1) par le dos ; v : du col (0) au bas (1)
    const a = lerp(0.98, TAU - 0.98, u), s = Math.sin(a), c = Math.cos(a), bk = Math.max(0, -c);
    const yTop = 0.585, yBot = lerp(0.36, 0.07, sm(0.1, 0.85, bk)) + 0.035 * Math.sin(u * 37) * v * v;
    const y = lerp(yTop, yBot, v), r = lerp(0.115, 0.205, sm(0, 0.5, v)) + 0.012 * Math.sin(u * 19 + v * 3) * v;
    o.p = [s * r * 1.1, y, c * r * 0.82 - 0.012];
    o.c = msMix(K.cloth, K.clothH, 0.25 * (1 - v) + 0.2 * (0.5 + 0.5 * Math.sin(u * 23)));
  }, true);
  const collar = msSurf(30, 8, (u, v, o) => {
    // col montant : il évase vers le haut et s'arrête en pointes ; ouvert devant
    const a = lerp(1.75, TAU - 1.75, u), s = Math.sin(a), c = Math.cos(a), tip = Math.pow(Math.abs(Math.sin(u * Math.PI * 2)), 0.7);
    const y = lerp(0.54, 0.705 + 0.03 * tip, v), r = lerp(0.078, 0.142, Math.pow(v, 1.5));
    o.p = [s * r * 1.12, y, c * r * 0.9 - 0.04 - 0.04 * v];
    o.c = msMix(K.cloth, K.clothH, 0.3 * v);
  });
  const mantle = msMerge([...msTwoSided(mantleOut, K.lining).map((g) => ({ geo: g })), ...msTwoSided(collar, K.lining).map((g) => ({ geo: g }))]);
  const capeOut = msSurf(16, 18, (u, v, o) => {
    // pan arrière : de l'os cp (taille, dans le dos) jusqu'aux mollets ; plus large en bas, bord déchiré
    const x = lerp(-1, 1, u), w = lerp(0.19, 0.3, v), L = 0.66 + 0.09 * Math.sin(u * 17.3) * Math.sin(u * 5.1) + (Math.abs(Math.sin(u * 9.7)) < 0.18 ? 0.08 : 0);
    const y = -v * L, bow = 0.05 * (1 - x * x) + 0.02 * v;
    o.p = [x * w, y + 0.06, -bow - 0.01];
    o.c = msMix(K.cloth, K.clothD, 0.35 * v + 0.15 * (0.5 + 0.5 * Math.sin(u * 31 + v * 7)));
  });
  const cape = msMerge(msTwoSided(capeOut, K.lining).map((g) => ({ geo: g })));

  /* ---- bassin (os pelvis) : pantalon (ceinture de corde, fesses osseuses) */
  const pelvis = msMerge([
    { geo: msTube(24, 8, -0.14, 0.04, (v) => lerp(0.122, 0.118, v), (v) => lerp(0.094, 0.083, v), (u, v, a) => 0.006 * Math.sin(a * 5 + v * 3), () => K.cloth) },
    { geo: new THREE.TorusGeometry(0.121, 0.0055, 5, 24), matrix: mtx(0, 0.026, 0, Math.PI / 2, 0, 0, 1, 0.74, 1), color: C(0x2a2220) },
  ]);

  /* ---- tête (os du cou) : crâne chauve allongé, visage émacié ; la mâchoire est à part (os jaw) */
  const head = msSurf(36, 24, (u, v, o) => {
    const th = u * TAU, ph = v * Math.PI, sy = Math.cos(ph), sr = Math.sin(ph), s = Math.sin(th), c = Math.cos(th);
    let rx = 0.091, ry = 0.13, rz = 0.105;
    const fr = Math.max(0, c);                               // vers l'avant
    let x = s * sr * rx, y = sy * ry, z = c * sr * rz;
    // crâne qui pointe vers l'arrière et le haut ; tempes creuses ; arcades ; joues creuses ; pommettes
    z -= 0.025 * Math.max(0, sy) * (1 - fr);
    y += 0.012 * Math.max(0, sy);
    const yy = y;
    const temple = Math.exp(-Math.pow((yy - 0.01) / 0.035, 2)) * Math.pow(Math.abs(s), 3) * fr;
    x -= Math.sign(s) * 0.012 * temple;
    const brow = Math.exp(-Math.pow((yy - 0.012) / 0.012, 2)) * Math.pow(fr, 4) * (1 - 0.6 * Math.exp(-Math.pow(s / 0.08, 2)));
    z += 0.012 * brow;
    const cheek = Math.exp(-Math.pow((yy + 0.055) / 0.03, 2)) * Math.exp(-Math.pow((Math.abs(s) - 0.62) / 0.2, 2)) * fr;
    x -= Math.sign(s) * 0.014 * cheek; z -= 0.01 * cheek;
    const bone = Math.exp(-Math.pow((yy + 0.025) / 0.014, 2)) * Math.exp(-Math.pow((Math.abs(s) - 0.7) / 0.15, 2)) * fr;
    x += Math.sign(s) * 0.008 * bone; z += 0.006 * bone;
    // orbites enfoncées
    for (const ex of [-0.036, 0.036]) {
      const e = Math.exp(-(Math.pow((x - ex) / 0.021, 2) + Math.pow((yy + 0.003) / 0.016, 2))) * Math.pow(fr, 2);
      z -= 0.018 * e;
    }
    // nez crochu et creusé à la racine ; bouche en retrait (la mâchoire la ferme)
    const nose = Math.exp(-Math.pow(s / 0.07, 2)) * Math.pow(fr, 8);
    z += nose * (0.024 * Math.exp(-Math.pow((yy + 0.035) / 0.022, 2)) - 0.004 * Math.exp(-Math.pow((yy + 0.004) / 0.008, 2)));
    const mouth = Math.exp(-Math.pow(s / 0.32, 2)) * Math.pow(fr, 3) * sm(-0.06, -0.085, yy);
    z -= 0.035 * mouth; y = yy - 0.0 * mouth;
    // bas du crâne : on rentre vers le cou (la mâchoire couvre le bas du visage)
    const low = sm(-0.07, -0.13, yy);
    x *= 1 - 0.35 * low; z = z * (1 - 0.3 * low) - 0.012 * low;
    o.p = [x, y + H, z + 0.004];
    let col = msMix(K.skin, K.skinH, 0.25 * Math.max(0, sy) * (1 - fr * 0.5));
    col = msMix(col, K.skinD, clamp(temple * 1.5 + cheek * 1.2 + 0.7 * mouth, 0, 0.8));
    for (const ex of [-0.036, 0.036]) { const e = Math.exp(-(Math.pow((x - ex) / 0.024, 2) + Math.pow((yy + 0.003) / 0.02, 2))) * fr; col = msMix(col, K.socket, clamp(e * 1.6, 0, 0.92)); }
    col = msMix(col, K.mouth, clamp(mouth * 1.4, 0, 1));
    // sang au coin des lèvres
    const lip = Math.exp(-Math.pow((yy + 0.068) / 0.012, 2)) * Math.exp(-Math.pow(s / 0.32, 2)) * fr;
    col = msMix(col, K.blood, clamp(lip * 0.8, 0, 0.7));
    o.c = col;
  }, true);
  const ear = (sx) => {
    // oreille pointue, en arrière : un cône aplati, l'intérieur plus sombre
    const out = [{ geo: new THREE.ConeGeometry(0.036, 0.155, 8, 1, false), matrix: mtx(sx * 0.09, H + 0.035, -0.016, -0.42, sx * 0.5, sx * -0.6, 1, 1, 0.36), color: K.skin },
      { geo: new THREE.ConeGeometry(0.024, 0.11, 6), matrix: mtx(sx * 0.0955, H + 0.028, -0.005, -0.42, sx * 0.5, sx * -0.6, 1, 1, 0.18), color: K.skinD }];
    return out;
  };
  const upperTeeth = [];
  for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.0105; upperTeeth.push(box(0.009, 0.012, 0.007, x, H - 0.07, 0.083 - Math.abs(x) * 0.35, K.teeth)); }
  // les crocs : longs, fins, un peu recourbés
  for (const sx of [-1, 1]) upperTeeth.push({ geo: new THREE.ConeGeometry(0.0072, 0.046, 6), matrix: mtx(sx * 0.0175, H - 0.091, 0.08, Math.PI + 0.12, 0, 0, 1, 1, 0.8), color: K.fang });
  const mouthIn = [ell(0.034, 0.024, 0.03, 0, H - 0.078, 0.06, K.mouth), ell(0.03, 0.006, 0.02, 0, H - 0.066, 0.072, K.gum)];
  const headG = msMerge([{ geo: head }, ...ear(1), ...ear(-1), ...upperTeeth, ...mouthIn,
    cyl(0.034, 0.046, 0.14, 0, 0.02, -0.004, K.skin, 0.9),                                  // cou maigre
  ]);
  /* ---- mâchoire (os jaw) : menton pointu, dents du bas, sang qui coule */
  const jaw = msSurf(20, 10, (u, v, o) => {
    const a = lerp(-1.25, 1.25, u), s = Math.sin(a), c = Math.cos(a);
    const y = lerp(0.008, -0.066, v), r = lerp(0.07, 0.03, Math.pow(v, 1.1)) * (1 - 0.12 * Math.abs(s));
    o.p = [s * r * 1.02, y, c * r * 0.95 + 0.022 - 0.006 * v];
    const bl = Math.exp(-Math.pow(s / 0.35, 2)) * sm(0.2, 0.8, v);
    o.c = msMix(msMix(K.skin, K.skinD, 0.3 * v), K.blood, clamp(bl * 0.75 + 0.3 * Math.exp(-Math.pow((v - 0.05) / 0.1, 2)), 0, 0.85));
  }, true);
  const lowerTeeth = [];
  for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.0098; lowerTeeth.push(box(0.0085, 0.011, 0.006, x, 0.012, 0.083 - Math.abs(x) * 0.45, K.teeth)); }
  for (const sx of [-1, 1]) lowerTeeth.push({ geo: new THREE.ConeGeometry(0.004, 0.018, 5), matrix: mtx(sx * 0.024, 0.022, 0.076, -0.1, 0, 0, 1, 1, 0.8), color: K.fang });
  const jawG = msMerge([...msTwoSided(jaw, K.mouth).map((g) => ({ geo: g })), ...lowerTeeth, ell(0.03, 0.01, 0.022, 0, 0.0, 0.05, K.gum),
    box(0.0042, 0.04, 0.004, 0.009, -0.052, 0.046, K.blood, 0.25)]);
  const eyes = mergeGeometries([ell(0.016, 0.0105, 0.008, -0.036, H - 0.003, 0.092, null, 0, 0, 0, 10, 6), ell(0.016, 0.0105, 0.008, 0.036, H - 0.003, 0.092, null, 0, 0, 0, 10, 6)]);

  /* ---- bras : décharnés, coude saillant ; main aux doigts longs et griffus (paume vers l'arrière, bras pendant) */
  const upper = msMerge([
    { geo: msTube(10, 10, -MS_RIG.upper - 0.01, 0.02, (v) => lerp(0.032, 0.046, v) + 0.012 * Math.exp(-Math.pow((v - 0.85) / 0.12, 2)), (v) => lerp(0.032, 0.042, v), null, (u, v) => msMix(K.skin, K.skinD, 0.3 * (1 - v))) },
    ell(0.036, 0.026, 0.03, 0, -MS_RIG.upper, -0.012, K.skinD),
  ]);
  const hand = [];
  { const y0 = -0.255;
    hand.push(box(0.05, 0.06, 0.02, 0, y0 - 0.03, 0.004, K.skin), ell(0.028, 0.022, 0.018, 0, y0 + 0.004, 0, K.skinD));
    for (let i = 0; i < 4; i++) {
      const x = -0.019 + i * 0.0127, L = [0.075, 0.088, 0.085, 0.068][i];
      const a = V(x, y0 - 0.058, 0.004), b = V(x * 1.25, y0 - 0.058 - L * 0.55, 0.02), c = V(x * 1.35, y0 - 0.058 - L, 0.045), d = V(x * 1.4, y0 - 0.058 - L - 0.03, 0.075);
      hand.push(seg(a, b, K.skin, 0.0065, 0, true, 0.006), seg(b, c, K.skin, 0.0058, 0, true, 0.0052), seg(c, d, K.claw, 0.0048, 0, true, 0.0008));
      hand.push(ell(0.0075, 0.0075, 0.0075, b.x, b.y, b.z, K.skinD));
    }
    const a = V(0.027, y0 - 0.012, 0.012), b = V(0.04, y0 - 0.055, 0.035), c = V(0.042, y0 - 0.08, 0.06);
    hand.push(seg(a, b, K.skin, 0.0075, 0, true, 0.0068), seg(b, c, K.claw, 0.0055, 0, true, 0.0009));
  }
  const fore = msMerge([
    { geo: msTube(10, 10, -0.26, 0.0, (v) => lerp(0.022, 0.033, v), (v) => lerp(0.02, 0.03, v), null, (u, v) => msMix(K.skin, K.vein, 0.15 * Math.exp(-Math.pow((u - 0.25) / 0.05, 2)))) },
    ...hand,
  ]);

  /* ---- jambes : pantalon déchiré (cuisse, haut du tibia, lambeaux), tibia nu, pied griffu */
  const thigh = msMerge([{ geo: msTube(12, 12, -MS_RIG.thigh - 0.01, 0.03, (v) => lerp(0.047, 0.066, v), (v) => lerp(0.047, 0.062, v), (u, v, a) => 0.005 * Math.sin(a * 3 + v * 11), (u, v) => msMix(K.cloth, K.clothH, 0.25 * (0.5 + 0.5 * Math.sin(u * 30 + v * 8)))) },
    ell(0.036, 0.032, 0.036, 0, -MS_RIG.thigh, 0.012, K.clothD)]);
  const shinCloth = [];
  shinCloth.push({ geo: msTube(12, 6, -0.2, 0.01, (v) => lerp(0.052, 0.045, v), (v) => lerp(0.05, 0.043, v), null, () => K.cloth) });
  for (let i = 0; i < 11; i++) {                                     // lambeaux de l'ourlet
    const a = (i / 11) * TAU + rr(-0.2, 0.2), l = rr(0.03, 0.11);
    shinCloth.push(box(0.028, l, 0.005, Math.sin(a) * 0.05, -0.2 - l / 2, Math.cos(a) * 0.048, i % 2 ? K.clothD : K.cloth, rr(-0.15, 0.15), a, rr(-0.2, 0.2)));
  }
  const foot = [];
  { const y0 = -0.42;
    foot.push(ell(0.032, 0.024, 0.04, 0, y0 + 0.012, 0.0, K.skinD));                                           // talon, cheville
    foot.push(box(0.05, 0.022, 0.09, 0, y0 - 0.002, 0.05, K.skin));
    for (let i = 0; i < 4; i++) {
      const x = -0.018 + i * 0.012, a = V(x, y0 - 0.004, 0.09), b = V(x * 1.3, y0 - 0.012, 0.135 + (i === 1 || i === 2 ? 0.012 : 0)), c = V(x * 1.35, y0 - 0.03, 0.16 + (i === 1 || i === 2 ? 0.012 : 0));
      foot.push(seg(a, b, K.skin, 0.0075, 0, true, 0.0065), seg(b, c, K.claw, 0.0055, 0, true, 0.0008));
    }
    foot.push(seg(V(0.0, y0 + 0.006, -0.02), V(0, y0 - 0.025, -0.06), K.claw, 0.006, 0, true, 0.001));      // ergot
  }
  const shin = msMerge([{ geo: msTube(10, 10, -0.42, -0.16, (v) => lerp(0.026, 0.034, v), (v) => lerp(0.025, 0.035, v), null, (u, v) => msMix(K.skin, K.skinD, 0.25 * (1 - v))) }, ...foot]);

  /* ---- ailes (os wb) : humérus (omoplate → coude), avant-bras (coude → poignet), griffe du pouce */
  const E = V(...MS_W.E), Wp = V(...MS_W.W), B0 = V(0, 0, 0);
  const warm = msMerge([
    msBone(B0, E, 0.042, 0.03, K.wingBone, [[0.1, 0.012], [0.95, 0.008]]),
    msBone(E, Wp, 0.026, 0.02, K.wingBone, [[0.05, 0.008], [0.96, 0.01]]),
    ell(0.034, 0.026, 0.03, E.x, E.y, E.z, K.wingBoneD),
    ell(0.026, 0.024, 0.026, Wp.x, Wp.y, Wp.z, K.wingBoneD),
    seg(Wp.clone().add(V(0, 0, 0.01)), Wp.clone().add(V(0.012, 0, 0.07)), K.wingBone, 0.01, 0, true, 0.008),
    seg(Wp.clone().add(V(0.012, 0, 0.07)), Wp.clone().add(V(0.004, 0, 0.11)), K.claw, 0.008, 0, true, 0.0012),
    ell(0.06, 0.045, 0.05, 0.015, 0, 0.0, K.skinD),                                                             // attache à l'omoplate
  ]);
  const fin = (i) => {
    // doigt le long de +x (repère du doigt), noueux, effilé
    const L = MS_W.L[i];
    return msMerge([msBone(V(0, 0, 0), V(L, 0, 0), 0.014, 0.004, K.wingBone, [[0.35, 0.005], [0.66, 0.004]]), ell(0.016, 0.014, 0.016, 0, 0, 0, K.wingBoneD)]);
  };
  /* ---- membrane (os ww, repère du poignet) : trois secteurs en éventail, calculés par le nuanceur, et le
     panneau fixe entre le bras et la ligne poignet-hanche (sommets à leur place, aFan.x = −1) */
  const mem = { pos: [], fan: [], uv: [], col: [], idx: [] };
  const vtx = (p, fan, uv, c) => { mem.pos.push(p[0], p[1], p[2]); mem.fan.push(fan[0], fan[1]); mem.uv.push(uv[0], uv[1]); mem.col.push(c[0], c[1], c[2]); return mem.pos.length / 3 - 1; };
  const NT = 10, NR = 9;
  for (let s = 0; s < 3; s++) {
    const base = mem.pos.length / 3;
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NT; i++) {
      const t = s + i / NT, r = j / NR, a = lerp(MS_W.open[s], s < 2 ? MS_W.open[s + 1] : MS_W.a4, i / NT), R0 = lerp(MS_W.L[s], s < 2 ? MS_W.L[s + 1] : MS_W.L4, i / NT);
      const c = msMix(msMix(K.membraneL, K.membrane, sm(0.0, 0.5, r)), K.membraneD, 0.35 * sm(0.75, 1, r) + 0.2 * Math.exp(-Math.pow(i / NT - 0.5, 2) / 0.05) * r);
      vtx([Math.cos(a) * r * R0, 0, -Math.sin(a) * r * R0], [t, r], [(t / 3) * 0.75, r], c);
    }
    for (let j = 0; j < NR; j++) for (let i = 0; i < NT; i++) { const a = base + j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1; mem.idx.push(a, b, c, b, d, c); }
  }
  {
    // panneau fixe : W (origine du poignet), E, B, Bt, en grille (repère du poignet)
    const P = [[0, 0], [E.x - Wp.x, E.z - Wp.z], [-Wp.x, -Wp.z], [MS_W.Bt[0] - Wp.x, MS_W.Bt[2] - Wp.z]];
    const base = mem.pos.length / 3, N = 6;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / N;
      // quadrilatère bilinéaire W-E-B-Bt (u : de W vers E et de Bt vers B ; v : de la ligne W-Bt vers le bras E-B)
      const ax = lerp(P[0][0], P[3][0], 1 - u), az = lerp(P[0][1], P[3][1], 1 - u), bx = lerp(P[1][0], P[2][0], 1 - u), bz = lerp(P[1][1], P[2][1], 1 - u);
      const x = lerp(ax, bx, v), z = lerp(az, bz, v);
      const c = msMix(K.membrane, K.membraneD, 0.25 * (1 - v));
      vtx([x, 0, z], [-1, 0], [0.76 + 0.23 * u, 0.04 + 0.92 * v], c);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = base + j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; mem.idx.push(a, b, c, b, d, c); }
  }
  const membrane = new THREE.BufferGeometry();
  membrane.setAttribute('position', new THREE.Float32BufferAttribute(mem.pos, 3));
  membrane.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(mem.pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  membrane.setAttribute('aFan', new THREE.Float32BufferAttribute(mem.fan, 2));
  membrane.setAttribute('uv', new THREE.Float32BufferAttribute(mem.uv, 2));
  membrane.setAttribute('color', new THREE.Float32BufferAttribute(mem.col, 3));
  membrane.setIndex(mem.idx);
  // la membrane change de forme dans le nuanceur : une boîte assez grande pour tous les replis
  membrane.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.6);

  return {
    torso: torsoG, mantle, cape, pelvis, head: headG, jaw: jawG, eyes, upper, fore, thigh, shinCloth: msMerge(shinCloth), shin,
    warm, wfin1: fin(0), wfin2: fin(1), wfin3: fin(2), membrane,
  };
}
Object.defineProperty(ZVGEO, 'ma_stryge', { configurable: true, enumerable: true, get() { const g = maStrygeGeometries(); Object.defineProperty(ZVGEO, 'ma_stryge', { value: g, enumerable: true }); return g; } });
/* Apparence : peau (nuances), cape (noire, parfois brun de sang séché ou bleu nuit). */
function maStrygeLook() {
  return { skin: pick([0xffffff, 0xf4f0f8, 0xeef0f4, 0xf8f2f2]), cloth: pick([0xffffff, 0xf0e8ee, 0xe8eaf2, 0xf4ecea]), eyes: MA_STRYGE_EYE_LIN, helmet: false, helmetColor: 0 };
}
/* Réglages des ailes dans la couleur des instances de la membrane (r repli, g déchirures, b gonflement). */
function maStrygeWingTint(z) {
  const R = z.R || ZR, list = R.models && R.models.ma_stryge;
  if (!list) return;
  if (!z.memM) z.memM = list.find((p) => p.def.geo === 'membrane').m;
  const m = z.memM, A = m.instanceColor.array;
  for (let s = 0; s < 2; s++) {
    const W = z.wing[s], i = (z.slot * 2 + s) * 3;
    A[i] = clamp(W.fold, 0, 1); A[i + 1] = clamp(W.dmg, 0, 0.95); A[i + 2] = clamp(0.5 + W.bil * 0.5, 0, 1);
  }
  m.instanceColor.needsUpdate = true;
}

/* ---------------------------------------------------------------- Poses --
   P : la pose voulue (angles en rad, décalages en m), Q : la pose adoucie, puis posée sur les os.
   Signes : pitch > 0 penche le corps en avant (à l'horizontale vers 1,4) ; nX < 0 relève la tête ; jaw > 0
   ouvre la gueule ; sX < 0 lève le bras vers l'avant, sZ l'écarte (gauche > 0) ; e < 0 plie le coude ;
   hX > 0 jambe en arrière, k > 0 plie le genou ; cpX > 0 relève le bas de la cape vers l'arrière ; ailes :
   f battement (> 0 vers le dos), s balayage (> 0 vers le bas du corps), t vrille, fold repli (0 à 1). */
const MS_PK = ['pitch', 'roll', 'lift', 'bend', 'twist', 'side', 'nX', 'nY', 'nZ', 'jaw', 'sLX', 'sLY', 'sLZ', 'sRX', 'sRY', 'sRZ', 'eL', 'eR',
  'hLX', 'hLZ', 'hRX', 'hRZ', 'kL', 'kR', 'cpX', 'cpZ', 'wLf', 'wLs', 'wLt', 'wRf', 'wRs', 'wRt', 'fL', 'fR'];
const MS_QREST = [new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)))];
const _msE = new THREE.Euler(), _msQ = new THREE.Quaternion();
const _msV = new THREE.Vector3(), _msW = new THREE.Vector3(), _msA = new THREE.Vector3(), _msB = new THREE.Vector3(), _msC = new THREE.Vector3(), _msH = new THREE.Vector3();
const _msM = new THREE.Matrix4();
function maStrygeWingBone(b, side, f, s, t) {
  const sg = side ? -1 : 1;
  _msE.set(sg * t, s, sg * f, 'ZYX');
  b.quaternion.copy(MS_QREST[side]).multiply(_msQ.setFromEuler(_msE));
}
/* Battements : phase, fréquence, amplitude ; repli à la remontée (l'éventail se ferme), vrille, gonflement. */
function msWings(P, z, o) {
  const ph = z.wph, sn = Math.sin(ph), cs = Math.cos(ph), A = o.amp;
  const f = o.bias + A * sn, s = (o.sweep || 0) + 0.18 * A * sn, t = (o.twist || 0) + 0.3 * A * cs;
  const fold = clamp((o.fold || 0) + (o.foldK === undefined ? 0.4 : o.foldK) * A * Math.max(0, cs), 0, 1);
  P.wLf = P.wRf = f; P.wLs = P.wRs = s; P.wLt = P.wRt = t; P.fL = P.fR = fold;
  z.bilT = clamp(-cs * A * 1.6, -1, 1);                                // descente : la membrane se gonfle vers le dos
  P.lift = -0.07 * A * sn;                                             // le corps monte quand les ailes descendent
}
/* En vol : k 0 sur place (presque droite), 1 lancée (presque à l'horizontale). */
function msFlyPose(P, z, k) {
  const c = z.t, s = z.seed;
  P.pitch = lerp(0.32, 1.22, k); P.roll = z.bank || 0;
  P.bend = lerp(0.18, 0.06, k); P.twist = 0.06 * Math.sin(c * 0.7 + s);
  P.nX = -P.pitch * 0.82 + (z.lookP || 0) * 0.6 - 0.05; P.nY = clamp(z.lookY || 0, -0.9, 0.9) * 0.7; P.nZ = -0.08 * (z.bank || 0);
  P.jaw = 0.12 + 0.05 * Math.sin(c * 1.3 + s) + (z.scream || 0) * 0.75;
  // bras : griffes prêtes (sur place : écartées devant ; lancée : sous le corps, vers l'avant)
  const g = 0.12 * Math.sin(c * 1.1 + s);
  P.sLX = lerp(-0.75, -2.05, k) + g; P.sRX = lerp(-0.75, -2.05, k) - g; P.sLZ = lerp(0.5, 0.28, k); P.sRZ = -P.sLZ; P.sLY = -0.2; P.sRY = 0.2;
  P.eL = lerp(-1.2, -0.95, k); P.eR = lerp(-1.25, -0.9, k);
  // jambes : pendantes sur place, en arrière lancée
  P.hLX = lerp(-0.42, 0.12, k) + 0.12 * Math.sin(c * 1.4 + s); P.hRX = lerp(-0.25, 0.18, k) + 0.12 * Math.sin(c * 1.4 + s + 2);
  P.hLZ = 0.08; P.hRZ = -0.08; P.kL = lerp(0.95, 0.45, k); P.kR = lerp(0.8, 0.5, k);
  P.cpX = lerp(0.12, 0.7, k) + lerp(0.06, 0.16, k) * Math.sin(c * lerp(3, 9, k) + s); P.cpZ = 0.06 * Math.sin(c * 2.3 + s);
}
function msDivePose(P, z, k) {
  const c = z.t;
  P.pitch = z.divePitch === undefined ? 1.7 : z.divePitch; P.roll = (z.bank || 0) * 0.6;
  P.bend = 0.05; P.nX = -P.pitch * 0.72 - 0.05; P.nY = clamp(z.lookY || 0, -0.6, 0.6) * 0.5;
  P.jaw = lerp(0.3, 0.75, k);
  P.sLX = P.sRX = lerp(-2.2, -2.85, k); P.sLZ = 0.32; P.sRZ = -0.32; P.eL = P.eR = lerp(-0.7, -0.22, k);
  P.hLX = 0.12; P.hRX = 0.2; P.kL = 0.25; P.kR = 0.32; P.hLZ = 0.06; P.hRZ = -0.06;
  P.cpX = 0.5 + 0.14 * Math.sin(c * 17); P.cpZ = 0.08 * Math.sin(c * 11);
}
function msWindupPose(P, z, k) {
  const c = z.t, s = z.seed;
  P.pitch = lerp(0.3, 0.05, k); P.roll = 0; P.bend = -0.12 * k;
  P.nX = -0.35 - 0.35 * k; P.nY = clamp(z.lookY || 0, -0.9, 0.9) * 0.7; P.nZ = 0;
  P.jaw = 0.25 + 0.65 * k + 0.05 * Math.sin(c * 31);
  P.sLX = P.sRX = -0.95; P.sLZ = 0.6 + 0.5 * k; P.sRZ = -P.sLZ; P.eL = P.eR = -0.85 + 0.35 * k; P.sLY = -0.3; P.sRY = 0.3;
  P.hLX = -0.5; P.hRX = -0.35; P.kL = 1.05; P.kR = 0.95; P.hLZ = 0.12; P.hRZ = -0.12;
  P.cpX = 0.15 + 0.05 * Math.sin(c * 4 + s);
}
/* Elle sort de l'éclair rouge (ma19) : k de 0 à 1 sur 1 s. Ramassée (ailes repliées autour d'elle, bras croisés,
   jambes repliées), puis d'un coup grande ouverte (ailes déployées et levées, bras écartés, griffes tendues, la
   tête renversée, la gueule ouverte : elle hurle), deux ou trois grands battements, puis elle se penche pour partir. */
function msEmergePose(P, z, k) {
  const c = z.t, u = owSmoothstep(0.02, 0.2, k), back = owSmoothstep(0.06, 0.25, k) * (1 - owSmoothstep(0.62, 0.95, k)), go = owSmoothstep(0.7, 1, k);
  P.pitch = lerp(0.75, 0.0, u) + 0.4 * go; P.roll = 0;
  P.bend = lerp(0.5, -0.32, u) * (1 - 0.7 * go);
  P.nX = lerp(0.3, -0.25, u) - 0.75 * back - 0.25 * go; P.nY = 0; P.nZ = 0.18 * Math.sin(c * 9) * back;
  P.jaw = lerp(0.15, 0.25, u) + 0.75 * back + 0.06 * Math.sin(c * 37) * back;
  P.sLX = lerp(-1.6, -1.05, u) - 0.5 * go; P.sRX = P.sLX; P.sLZ = lerp(0.05, 1.35, u) * (1 - 0.5 * go); P.sRZ = -P.sLZ; P.sLY = -0.25; P.sRY = 0.25;
  P.eL = P.eR = lerp(-2.0, -0.3, u) - 0.5 * go;
  P.hLX = lerp(-1.15, -0.4, u); P.hRX = lerp(-1.05, -0.28, u); P.kL = lerp(1.75, 0.95, u); P.kR = lerp(1.65, 0.85, u); P.hLZ = 0.1; P.hRZ = -0.1;
  P.cpX = lerp(0.05, 0.85, u) + 0.18 * Math.sin(c * 11) * u; P.cpZ = 0.1 * Math.sin(c * 7);
  // ailes : repliées autour d'elle, puis déployées et levées, et de grands battements
  msWings(P, z, { bias: lerp(1.15, 0.3, u), amp: 0.85 * u * (0.5 + 0.5 * go), sweep: lerp(0.55, -0.5, u) * (1 - 0.6 * go), twist: 0.22, fold: 1 - u, foldK: 0.2 });
}
/* Au sol, à quatre pattes : g phase de la marche, w 1 ailes repliées sur le dos, 0 brisées (traînées). */
function msGroundPose(P, z, g, w, k) {
  const c = z.t, s = z.seed;
  P.pitch = 1.42; P.roll = 0.05 * Math.sin(g); P.bend = -0.12 + 0.05 * Math.sin(g * 2);
  P.nX = -1.2 + 0.08 * Math.sin(g * 2 + 0.5) + (z.lookP || 0) * 0.5; P.nY = clamp(z.lookY || 0, -0.8, 0.8) * 0.7; P.nZ = 0.1 * Math.sin(g);
  P.jaw = 0.2 + 0.1 * Math.sin(c * 2 + s) + (z.scream || 0) * 0.7;
  const sa = Math.sin(g), ca = Math.cos(g);
  P.sLX = -1.45 + 0.5 * sa * k; P.sRX = -1.45 - 0.5 * sa * k; P.sLZ = 0.32; P.sRZ = -0.32;
  P.eL = -0.35 - 0.45 * Math.max(0, ca) * k; P.eR = -0.35 - 0.45 * Math.max(0, -ca) * k;
  P.hLX = -1.25 - 0.35 * sa * k; P.hRX = -1.25 + 0.35 * sa * k; P.hLZ = 0.2; P.hRZ = -0.2;
  P.kL = 1.75 + 0.3 * Math.max(0, sa) * k; P.kR = 1.75 + 0.3 * Math.max(0, -sa) * k;
  P.cpX = -0.15 + 0.05 * Math.sin(g + 1); P.cpZ = 0.08 * Math.sin(g);
  if (w > 0.5) { P.wLf = P.wRf = 1.2 + 0.05 * Math.sin(g); P.wLs = P.wRs = 0.55; P.wLt = P.wRt = 0.1; P.fL = P.fR = 1; z.bilT = 0; }
  else {
    // ailes brisées : à demi ouvertes, traînées en arrière, elles tressaillent
    const tw = 0.12 * Math.sin(c * 13 + s) * Math.sin(c * 2.3);
    P.wLf = 0.35 + tw; P.wRf = 0.3 - tw; P.wLs = P.wRs = 0.95; P.wLt = 0.25; P.wRt = 0.2; P.fL = 0.55; P.fR = 0.6; z.bilT = 0;
  }
}
/* Chute (ailes brisées, ou morte en l'air) : elle tourne sur elle-même, membres battants. */
function msFallPose(P, z, dead) {
  const c = z.t, s = z.seed, f = dead ? 0.35 : 1;
  P.pitch = z.tumP || 0.6; P.roll = z.tumR || 0; P.bend = 0.2;
  P.nX = -0.3 + 0.3 * Math.sin(c * 5 + s) * f; P.nZ = 0.25 * Math.sin(c * 4 + s) * f; P.jaw = dead ? 0.5 : 0.7 + 0.15 * Math.sin(c * 23);
  P.sLX = -2.3 + 0.7 * Math.sin(c * 9 + s) * f; P.sRX = -2.2 + 0.7 * Math.sin(c * 8.3 + s + 2) * f; P.sLZ = 0.9; P.sRZ = -0.9; P.eL = P.eR = -0.6 + 0.3 * Math.sin(c * 7) * f;
  P.hLX = -0.5 + 0.6 * Math.sin(c * 7 + s) * f; P.hRX = -0.4 - 0.6 * Math.sin(c * 7 + s) * f; P.kL = P.kR = 0.8;
  P.wLf = 0.2 + 0.9 * Math.sin(c * 6.5 + s) * f; P.wRf = 0.15 + 0.9 * Math.sin(c * 6.1 + s + 1.7) * f; P.wLs = P.wRs = 0.35; P.wLt = 0.3; P.wRt = 0.25; P.fL = 0.35; P.fR = 0.4;
  P.cpX = 1.2 + 0.3 * Math.sin(c * 13); z.bilT = 0.6 * Math.sin(c * 6.5 + s);
}
/* Morte au sol : face contre terre, bras en avant, ailes étalées. */
function msDeadPose(P, z) {
  const k = owSmoothstep(0, 0.5, z.st), tw = (1 - owSmoothstep(0.3, 2.2, z.st)) * 0.15 * Math.sin(z.t * 23);
  P.pitch = 1.53; P.roll = z.deadRoll || 0; P.bend = 0.05; P.nX = -0.3; P.nY = 0.5 * (z.deadSide || 1); P.nZ = 0.2; P.jaw = 0.45;
  P.sLX = -2.75; P.sRX = -2.2; P.sLZ = 0.7; P.sRZ = -0.95; P.eL = -0.4 + tw; P.eR = -0.9; P.hLX = 0.1; P.hRX = 0.25; P.hLZ = 0.15; P.hRZ = -0.1; P.kL = 0.25; P.kR = 0.6 + tw;
  P.wLf = -0.12 + tw; P.wRf = -0.1; P.wLs = 0.25; P.wRs = 0.3; P.wLt = P.wRt = 0; P.fL = 0.2; P.fR = 0.28;
  P.cpX = 0.05; P.cpZ = 0.15; z.bilT = 0;
  P.lift = -0.0 * k;
}
/* Elle se noie : droite dans l'eau, se débat, ailes qui frappent l'eau, puis coule. */
function msDrownPose(P, z) {
  const c = z.t, s = z.seed, k = clamp(1 - z.st / 3, 0.15, 1);
  P.pitch = -0.12 + 0.1 * Math.sin(c * 3); P.roll = 0.15 * Math.sin(c * 2.1 + s); P.bend = -0.1;
  P.nX = -0.55 + 0.2 * Math.sin(c * 6); P.nY = 0.4 * Math.sin(c * 1.7 + s); P.jaw = 0.75 + 0.15 * Math.sin(c * 19);
  P.sLX = -2.6 + 0.7 * Math.sin(c * 7.5 + s) * k; P.sRX = -2.5 + 0.7 * Math.sin(c * 7.1 + s + 2) * k; P.sLZ = 0.6; P.sRZ = -0.6; P.eL = P.eR = -0.5;
  P.hLX = 0.3 * Math.sin(c * 5); P.hRX = -0.3 * Math.sin(c * 5); P.kL = P.kR = 0.6;
  P.wLf = 0.25 + 0.7 * Math.sin(c * 5.5 + s) * k; P.wRf = 0.25 + 0.7 * Math.sin(c * 5.1 + s + 1) * k; P.wLs = P.wRs = 0.15; P.wLt = P.wRt = 0.2; P.fL = P.fR = 0.25;
  P.cpX = 0.5; z.bilT = 0.5 * Math.sin(c * 5.5);
}
/* Pose de l'état courant (z.ss). */
function maStrygePoseFor(z, P) {
  for (const k of MS_PK) P[k] = 0;
  const st = z.ss, sp = z.vel ? Math.hypot(z.vel.x, z.vel.z) : 0;
  switch (st) {
    case 'emerge': {
      const A = z.arr, k = A ? clamp((A.t - A.pre) / MA_ARR.emerge, 0, 1) : 1;
      msEmergePose(P, z, k);
      break;
    }
    case 'windup': {
      const k = clamp(z.st / MA_STRYGE.dive.windup, 0, 1);
      msWindupPose(P, z, k);
      msWings(P, z, { bias: 0.25, amp: 0.55, sweep: -0.55 * k, twist: 0.25, fold: 0, foldK: 0.2 });
      break;
    }
    case 'dive': {
      const k = clamp(z.st / 0.45, 0, 1);
      msDivePose(P, z, k);
      msWings(P, z, { bias: lerp(0.2, 0.55, k), amp: 0.12, sweep: lerp(0.1, 0.6, k), twist: 0.05, fold: lerp(0.15, 0.5, k), foldK: 0 });
      if (z.biteT > 0) { P.jaw = 0.05; P.sLX = P.sRX = -2.4; P.eL = P.eR = -1.1; }
      break;
    }
    case 'land': case 'takeoff': {
      const k = clamp(z.flyK === undefined ? 0.3 : z.flyK, 0, 1);
      msFlyPose(P, z, k * 0.5);
      msWings(P, z, { bias: 0, amp: 1, sweep: 0.05, twist: 0.25, fold: 0, foldK: 0.5 });
      P.hLX = P.hRX = -0.7; P.kL = P.kR = 1.1;
      break;
    }
    case 'prowl': case 'crawl': case 'grounded': {
      const w = st === 'prowl' ? 1 : 0, k = st === 'grounded' ? 0 : clamp(z.moving / 1.2, 0, 1);
      msGroundPose(P, z, z.gait || 0, w, k);
      if (st === 'grounded') { P.pitch = 1.5; P.nX = -0.9 + 0.25 * Math.sin(z.t * 5); P.sLX = -2.2 + 0.4 * Math.sin(z.t * 4); P.sRX = -1.9; P.jaw = 0.6; }
      if (z.biteT > 0) {
        const b = clamp(1 - z.biteT / 0.35, 0, 1);
        P.nX -= 0.4 * Math.sin(Math.PI * b); P.jaw = 0.75 * (1 - b) + 0.05; P.sLX -= 0.7 * Math.sin(Math.PI * b); P.sRX -= 0.6 * Math.sin(Math.PI * b);
      }
      break;
    }
    case 'crash': case 'fall': msFallPose(P, z, st === 'fall'); break;
    case 'dead': msDeadPose(P, z); break;
    case 'drown': case 'sink': msDrownPose(P, z); break;
    default: {
      // en vol : arrive, tourne, remonte
      const k = clamp(sp / 4.2, 0, 1) * (st === 'climb' ? 0.7 : 1);
      msFlyPose(P, z, k);
      const glide = z.glide || 0;
      msWings(P, z, { bias: lerp(-0.05, 0.08, k) + 0.25 * glide, amp: lerp(st === 'climb' ? 1.05 : 0.9, 0.55, k) * (1 - 0.75 * glide), sweep: lerp(0.1, -0.04, k), twist: lerp(0.22, 0.1, k), fold: 0, foldK: 0.42 });
    }
  }
  if (z.flinch > 0) { P.bend -= 0.3 * z.flinch; P.nX -= 0.25 * z.flinch; P.jaw += 0.3 * z.flinch; }
}
/* Pose adoucie, posée sur les os ; racine en z.root (le milieu du corps). */
function maStrygeAnimate(z, dt) {
  if (!z.P) { z.P = {}; z.Q = {}; maStrygePoseFor(z, z.P); for (const k of MS_PK) z.Q[k] = z.P[k]; }
  const P = z.P, Q = z.Q, r = z.rig;
  // battements : la phase avance à la fréquence de l'état
  z.wph = (z.wph || 0) + dt * TAU * (z.wfreq || 1);
  maStrygePoseFor(z, P);
  const w = dt > 0 ? 1 - Math.exp(-(z.blendK || 7) * dt) : 1, ww = dt > 0 ? 1 - Math.exp(-14 * dt) : 1;
  for (const k of MS_PK) {
    const wing = k.charCodeAt(0) === 119 || k === 'fL' || k === 'fR' || k === 'lift';   // w… : les ailes suivent leur battement de près
    Q[k] += (P[k] - Q[k]) * (wing ? ww : w);
  }
  z.bil = damp(z.bil || 0, z.bilT || 0, 8, dt || 1);
  // l'arrivée (ma19) : invisible pendant l'appel, puis elle sort de l'éclair (de 30 % à sa taille)
  r.root.scale.setScalar(z.hidden ? 1e-4 : z.ss === 'emerge' && typeof maArrScale === 'function' ? maArrScale(z.arr) : 1);
  r.root.rotation.set(Q.pitch, z.yaw, Q.roll, 'YXZ');
  r.root.position.set(z.root.x, z.root.y + Q.lift, z.root.z);
  r.hips.rotation.set(Q.bend, Q.twist, Q.side);
  r.neck.rotation.set(Q.nX, Q.nY, Q.nZ);
  r.jaw.rotation.set(Math.max(0, Q.jaw), 0, 0);
  r.shL.rotation.set(Q.sLX, Q.sLY, Q.sLZ); r.shR.rotation.set(Q.sRX, Q.sRY, Q.sRZ);
  r.elL.rotation.set(Q.eL, 0, 0); r.elR.rotation.set(Q.eR, 0, 0);
  r.hipL.rotation.set(Q.hLX, 0, Q.hLZ); r.hipR.rotation.set(Q.hRX, 0, Q.hRZ);
  r.knL.rotation.set(Q.kL, 0, 0); r.knR.rotation.set(Q.kR, 0, 0);
  r.cp.rotation.set(Q.cpX, 0, Q.cpZ);
  maStrygeWingBone(r.wbL, 0, Q.wLf, Q.wLs, Q.wLt);
  maStrygeWingBone(r.wbR, 1, Q.wRf, Q.wRs, Q.wRt);
  for (let k = 0; k < 3; k++) {
    r[`wd${k + 1}L`].rotation.set(0, lerp(MS_W.open[k], MS_W.fold[k], clamp(Q.fL, 0, 1)), 0);
    r[`wd${k + 1}R`].rotation.set(0, lerp(MS_W.open[k], MS_W.fold[k], clamp(Q.fR, 0, 1)), 0);
  }
  z.wing[0].fold = Q.fL; z.wing[1].fold = Q.fR;
  z.wing[0].bil = z.bil; z.wing[1].bil = -z.bil;
  r.root.updateMatrixWorld(true);
  maStrygeWingTint(z);
  if (!z.spec) writeZombieMatrices(z);
}

/* ---------------------------------------------------------------- Une stryge -- */
function maStrygeObject(slot, look, R = null) {
  const r0 = typeof G !== 'undefined' && G.round ? G.round : 1, hp = maStrygeHp(r0), [c0, c1] = MA_STRYGE.cruise();
  return {
    id: ++Zombies.seq, slot, R, type: MA_STRYGE_TYPE, model: 'ma_stryge', stryge: true, rig: makeStrygeRig(), look, helmetOn: false, alive: true, outside: true,
    state: 'stryge', ss: 'arrive', st: 0, t: 0, hp, maxHp: hp, pos: new THREE.Vector3(), root: new THREE.Vector3(), vel: new THREE.Vector3(), k: -1, gy: 0, layer: 0,
    yaw: 0, yawV: 0, vx: 0, vz: 0, moving: 0, speedType: 'run', speed: rand(c0, c1), win: null, gib: 0, headless: false, crawl: false,
    stagger: 0, flinch: 0, knockX: 0, knockZ: 0, knockT: 0, knockDur: 0, knockDir: 1, knockK: 0, knockShift: false, reelT: 0, called: null, nukeT: 0, deathKind: null,
    losT: 0, los: false, stuck: 0, stuckT: 0, lastX: 0, lastZ: 0, farT: 0,
    wing: [{ fold: 0, dmg: 0, bil: 0 }, { fold: 0, dmg: 0, bil: 0 }], wingHits: 0, wingT: -1, wph: rand(0, TAU), wfreq: 1, glide: 0, bank: 0, bil: 0, bilT: 0,
    seed: rand(0, 10), orbitR: rand(MA_STRYGE.ring[0], MA_STRYGE.ring[1]), orbitDir: Math.random() < 0.5 ? 1 : -1, orbitA: 0, alt: rand(MA_STRYGE.alt[0], MA_STRYGE.alt[1]),
    diveCd: rand(1.5, 3.5), biteT: 0, biteCd: 0, scream: 0, hurtT: 0, screechT: rand(2, 5), flapT: 0, glow: 0, blink: 0, blinkT: rand(2, 6), gait: 0, lookY: 0, lookP: 0,
    indoorT: 0, landTo: null, rayPart: null, blendK: 7, healT: 0,
  };
}

/* ---------------------------------------------------------------- Écran « Modèles » --
   La Stryge dans l'aperçu : Vol (sur place), Plane, Piqué (le cri, puis le plongeon), Draine (la morsure),
   S'écrase (deux tirs dans l'aile : elle tombe, puis rampe), Rampe, Se noie (dans une eau translucide),
   Mort ; « Tir dans l'aile » déchire la membrane (au deuxième, elle s'écrase). */
SPECIMEN_MODELS.ma_stryge = { anims: ['vol', 'plane', 'pique', 'draine', 'ecrase', 'rampe', 'noyade', 'death'], wing: true, make: () => maStrygeSpecimen() };
function maStrygeSpecimen() {
  const R = {};
  const root = zombieInstances(R, 1, ['ma_stryge']);
  for (const { def, m } of R.models.ma_stryge) { m.castShadow = true; if (def.geo === 'membrane') m.customDepthMaterial = MS_TEX.depth; }
  const z = maStrygeObject(0, maStrygeLook(), R);
  z.spec = true; z.id = 7; z.glow = 1;
  paintZombieSlot(0, z.look, R, 'ma_stryge');
  const props = new THREE.Group();
  root.add(props);
  // eau (« Se noie ») : disque translucide qui s'efface sur ses bords
  const c = makeCanvas(128, 128), g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.7, '#d8d8d8'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshStandardMaterial({ color: 0x24342c, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55, alphaMap: toTex(c, { clamp: true, srgb: false }), depthWrite: false, side: THREE.DoubleSide }));
  linearize(water.material);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.95; water.renderOrder = 2; water.visible = false;
  props.add(water);
  // lueur des yeux
  const eyeGlow = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: MA_STRYGE.eye, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.085); root.add(s); return s;
  });
  const S = { anim: null, cyc: -1, hitT: -1 };
  const C0 = new THREE.Vector3();
  const set = (st) => { if (z.ss !== st) { z.ss = st; z.st = 0; } };
  return {
    root,
    view: [0.95, 1.45],
    restyle() { z.look = maStrygeLook(); paintZombieSlot(0, z.look, R, 'ma_stryge'); },
    center: () => C0.setFromMatrixPosition(z.rig.hips.matrixWorld),
    wingShot() {
      // un tir dans la membrane : elle se déchire ; au deuxième, elle s'écrase (l'animation « S'écrase »)
      const s = Math.random() < 0.5 ? 0 : 1;
      z.wing[s].dmg = Math.min(0.85, z.wing[s].dmg + MA_STRYGE.wing.tear);
      z.flinch = 0.6; maStrygeSnd('rip', null, null);
      if (z.wing[0].dmg + z.wing[1].dmg >= MA_STRYGE.wing.tear * MA_STRYGE.wing.hits - 1e-3) { S.hitT = 0; setModelAnim('ecrase'); }
      return true;
    },
    pose(anim, t, dt, yaw) {
      if (anim !== S.anim) { S.anim = anim; S.cyc = -1; z.headless = false; z.alive = true; z.st = 0; z.biteT = 0; if (anim !== 'ecrase') { z.wing[0].dmg = z.wing[1].dmg = 0; } }
      z.t += dt; z.st += dt;
      z.yaw = yaw; z.vel.set(0, 0, 0); z.bank = 0; z.scream = 0; z.glide = 0;
      props.rotation.y = yaw;
      water.visible = anim === 'noyade';
      let glowK = 1, y = 1.05;
      z.flinch = damp(z.flinch, 0, 6, dt);
      switch (anim) {
        case 'plane': {
          const u = t % 6; z.glide = u < 3.2 ? 1 - owSmoothstep(2.6, 3.2, u) : owSmoothstep(5.4, 6, u) * 0.0;
          set('circle'); z.vel.set(Math.sin(yaw) * 4.2, 0, Math.cos(yaw) * 4.2); z.wfreq = 0.85; y = 1.25; z.bank = 0.12 * Math.sin(t * 0.6);
          break;
        }
        case 'pique': {
          const u = t % 2.4;
          if (u < 0.6) { set('windup'); z.st = u; z.scream = 0; z.wfreq = 1.3; y = 1.15 + 0.25 * owSmoothstep(0, 0.6, u); if (S.cyc !== Math.floor(t / 2.4)) { S.cyc = Math.floor(t / 2.4); maStrygeSnd('screech', null, null); } }
          else if (u < 1.6) { set('dive'); z.st = u - 0.6; z.wfreq = 3; z.divePitch = 1.5 + 0.35 * Math.sin(Math.PI * (u - 0.6)); y = 1.3 - 0.2 * Math.sin(Math.PI * (u - 0.6)); }
          else { set('climb'); z.st = u - 1.6; z.wfreq = 1.4; z.vel.set(Math.sin(yaw) * 2.5, 0, Math.cos(yaw) * 2.5); y = 1.15; }
          glowK = 1.25;
          break;
        }
        case 'draine': {
          const u = t % 1.8, cyc = Math.floor(t / 1.8);
          set('dive'); z.st = 0.45; z.wfreq = 2.6; z.divePitch = 1.05; y = 1.2;
          z.biteT = u > 0.55 && u < 1.0 ? 1 - (u - 0.55) / 0.45 : 0;
          if (cyc !== S.cyc && u > 0.55) { S.cyc = cyc; maStrygeSnd('bite', null, null); maStrygeSnd('drain', null, null); }
          glowK = 1 + (z.biteT > 0 ? 0.8 : 0);
          break;
        }
        case 'ecrase': {
          const u = S.hitT >= 0 ? (S.hitT += dt) : t % 4.5;
          if (S.hitT >= 0 && S.hitT > 4.5) S.hitT = -1;
          if (u < 0.9) { set('crash'); z.st = u; z.tumP = 0.6 + u * 2.2; z.tumR = u * 1.6; y = 1.15 - 1.0 * owSmoothstep(0, 0.9, u) * owSmoothstep(0, 0.9, u); if (u < dt * 1.5) maStrygeSnd('crash', null, null); }
          else if (u < 1.8) { set('grounded'); z.st = u - 0.9; y = 0.32; }
          else { set('crawl'); z.moving = 0.9; z.gait = (z.gait || 0) + dt * 4.2; y = 0.36; }
          if (u < dt * 1.5) { z.wing[0].dmg = Math.max(z.wing[0].dmg, 0.42); z.wing[1].dmg = Math.max(z.wing[1].dmg, 0.3); }
          break;
        }
        case 'rampe': { set('prowl'); z.moving = 1.2; z.gait = (z.gait || 0) + dt * 6.5; y = 0.42; break; }
        case 'noyade': {
          const u = t % 4.2;
          set('drown'); z.st = u; y = 0.75 - 0.45 * owSmoothstep(2.8, 4.2, u);
          if (u < dt * 1.5) maStrygeSnd('drown', null, null);
          glowK = 1 - owSmoothstep(3, 4, u);
          break;
        }
        case 'death': {
          const u = t % 5;
          if (u < 0.75) { set('fall'); z.st = u; z.tumP = 0.4 + u * 1.5; z.tumR = u * 0.8; y = 1.1 - 0.95 * owSmoothstep(0, 0.75, u); if (u < dt * 1.5) maStrygeSnd('death', null, null); }
          else { set('dead'); z.st = u - 0.75; y = 0.13; }
          glowK = Math.max(0, 1 - u / 0.8);
          break;
        }
        default: { set('circle'); z.wfreq = 1.25; y = 1.05; }
      }
      z.root.set(0, y, 0);
      z.blendK = anim === 'pique' || anim === 'ecrase' ? 14 : 8;
      z.blinkT -= dt;
      if (z.blinkT <= 0) { z.blink = 0.12; z.blinkT = rand(2.5, 6); }
      if (z.blink > 0) z.blink -= dt;
      if (z.biteT > 0) z.biteT = Math.max(0, z.biteT - dt * 0);
      maStrygeAnimate(z, dt);
      writeZombieMatrices(z);
      flushZombieMatrices(R);
      const k = (z.blink > 0 ? 0 : 1) * glowK;
      const nk = z.rig.neck.matrixWorld, cp = Models.camera ? Models.camera.position : null;
      _msA.set(0, 0, 1).transformDirection(nk); _msB.set(1, 0, 0).transformDirection(nk);
      eyeGlow.forEach((s, i) => {
        s.position.set(i ? 0.036 : -0.036, ZRIG.head - 0.003, 0.098).applyMatrix4(nk);
        let kf = 1;
        if (cp) {
          const sx = i ? 0.5 : -0.5, tx = cp.x - s.position.x, ty = cp.y - s.position.y, tz = cp.z - s.position.z;
          kf = owSmoothstep(-0.15, 0.35, ((_msA.x * 0.87 + _msB.x * sx) * tx + (_msA.y * 0.87 + _msB.y * sx) * ty + (_msA.z * 0.87 + _msB.z * sx) * tz) / (Math.hypot(tx, ty, tz) || 1));
        }
        s.material.opacity = 0.85 * k * kf; s.visible = k * kf > 0.01;
      });
    },
  };
}
/* Le son de chaque animation (setModelAnim). */
function maStrygeSpecSound(k) {
  const snd = { vol: 'flap', plane: 'hiss', pique: 'screech', draine: 'bite', ecrase: 'rip', rampe: 'hiss', noyade: 'drown', death: 'death' }[k];
  if (snd) maStrygeSnd(snd, null, null); else Sound.ui();
}
/* Libellés et fiche (MODEL_ANIMS et SPECIMEN_FACTS sont définis plus bas dans le jeu : appelé après eux). */
function maStrygeSpecimenSetup() {
  Object.assign(MODEL_ANIMS, { vol: 'Vol', plane: 'Plane', pique: 'Piqué', draine: 'Draine', ecrase: 'S’écrase', rampe: 'Rampe', noyade: 'Se noie' });
  SPECIMEN_FACTS.stryge = (type) => {
    const m = type.mult, hp = (r) => fmtNum(maStrygeHp(r), 0), bite = RULES.zombieHit * m.damage, D = MA_STRYGE.dive, [c0, c1] = MA_STRYGE.cruise();
    return {
      // fiche N°07 : ×1,3 / ×1,7 / ×1,2 par rapport au zombie de la carte (dans le marais : ses PV, khHp)
      bars: [['PV', m.hp], ['Vitesse', m.speed], ['Dégâts', m.damage]],
      ref: `Trait clair = zombie du marais (×1) : ${fmtNum(khHp(1), 0)} PV à la manche 1, trot de ${fmtNum(SPEEDS.jog[0])} à ${fmtNum(SPEEDS.jog[1])} m/s, ${fmtNum(RULES.zombieHit, 0)} dégâts par coup.`,
      cards: [
        [`Capacité · ${type.ability}`, `Vole entre ${MA_STRYGE.alt[0]} et ${MA_STRYGE.alt[1]} m, plonge sur toi et draine ta vie pour se soigner.`],
        ['Faiblesse', `Les ailes : ${MA_STRYGE.wing.hits} tirs dans la membrane et elle s’écrase, réduite à ramper. Au-dessus de l’eau, elle se noie.`],
      ],
      details: [
        ['Manches', '1 ou 2 par tranche de 10', '', `Comme les chiens : tirées au hasard, jamais aux manches 1 et 2, au moins ${DOGS.plan.gap} manches d’écart · rien que des Stryges (les Noyés restent dans l’eau)`],
        ['Nuée', `${DOGS.first}, puis +${DOGS.step} à chaque fois`, '', `${DOGS.first} à la première manche de Stryges, ${DOGS.step} de plus aux suivantes (${DOGS.max} au plus) · par vagues de ${DOGS.pack[0]} à ${DOGS.pack[1]}, ${DOGS.alive} en même temps au plus`],
        ['Points de vie', `${hp(5)} → ${hp(10)} → ${hp(20)}`, '', 'Manches 5, 10 et 20 : 1,3 fois ceux d’un zombie du marais'],
        ['Vitesse', `${fmtNum(c0)} à ${fmtNum(c1)} m/s`, '', `En vol, 1,7 fois le trot d’un zombie ; le piqué, jusqu’à ${fmtNum(D.speed, 0)} m/s ; ${fmtNum(MA_STRYGE.chase, 1)} m/s au plus pour rattraper une barque`],
        ['Piqué', `${fmtNum(bite, 0)} dégâts`, '', `Un cri, les ailes levées (${fmtNum(D.windup)} s), puis le plongeon : un pas de côté au dernier moment et elle te rate · ${MA_STRYGE.attackers(0)} à ${MA_STRYGE.attackers(9)} en piqué à la fois`],
        ['Drain', `+${fmtNum(bite * MA_STRYGE.heal, 0)} PV`, '', 'Ce qu’elle te prend, elle le reprend : sa morsure la soigne d’autant'],
        ['Ailes', `${MA_STRYGE.wing.hits} tirs`, '', `Un tir par coup, quelle que soit l’arme ; la membrane se déchire, les balles passent par les trous · en tombant, elle perd ${fmtNum(MA_STRYGE.fallDmg * 100, 0)} % de ses PV`],
        ['Au sol', 'Elle rampe', '', `Ailes brisées : ${fmtNum(MA_STRYGE.crawl.speed[0])} à ${fmtNum(MA_STRYGE.crawl.speed[1])} m/s, elle mord encore · tu t’abrites sous un toit : elle se pose et entre à quatre pattes`],
        ['Eau', 'Noyade', '', `Plus de ${fmtNum(MA_STRYGE.drown)} m d’eau sous elle quand elle tombe : elle se noie (une élimination)`],
        ['Récompense', 'Munitions max', '', 'Lâchées par la dernière Stryge de la manche ; tuée au-dessus de l’eau, elle les lâche à côté de toi'],
        ['Points rapportés', `+${RULES.pointsKill} à +${RULES.pointsKnife}`, '', `Élimination +${RULES.pointsKill}, tête +${RULES.pointsHead}, couteau +${RULES.pointsKnife} · +${RULES.pointsHit} par touche`],
      ],
    };
  };
}

/* ---------------------------------------------------------------- État commun -- */
const MA_STRYGES = { spawned: 0, killed: 0, drowned: 0, crashed: 0, bites: 0, rounds: 0, lastDive: -9, hint: false, hintRoof: false, voiceT: 0, fx: null };
const maStrygesAlive = () => { let n = 0; for (const z of Zombies.list) if (z.stryge && z.alive) n++; return n; };
const MS_FLY = { emerge: 1, arrive: 1, circle: 1, windup: 1, dive: 1, climb: 1, land: 1, takeoff: 1 };

/* ---------------------------------------------------------------- Obstacles --
   Le « plancher » du vol en (x, z) : l'eau ou le sol, et ce qu'il faut survoler à moins de r cases (toits, avec
   leur faîte ; murs ; plates-formes de la station). Les pleins isolés (troncs, poteaux) ne comptent pas : on
   les contourne (maStrygeAvoid). */
function maStrygeSolidTop(ch, i, cx, cz) {
  const k = ch.kind[i];
  if (k === OWK.TERRAIN || k === OWK.WATER) return -1e9;
  if (k === OWK.FLOOR || k === OWK.RAMP || k === OWK.DOOR) return ch.ceil[i] > 0 ? Math.max(ch.roof[i], ch.ceil[i]) + 1.6 : ch.base[i];
  if (k === OWK.SOLID) {
    // plein isolé (tronc, pilier) : contourné
    let n = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = owKind(OW.surf, cx + dx, cz + dz); if (q === OWK.SOLID || q === OWK.WINDOW || q === OWK.DOOR || q === OWK.FLOOR) n++; }
    if (n === 0) return -1e9;
  }
  return Math.max(ch.top[i], ch.roof[i] || 0);
}
function maStrygeFloor(x, z, r = 1) {
  let f = Math.max(MA.water, owH(x, z));
  const cx0 = Math.floor(x), cz0 = Math.floor(z);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const cx = cx0 + dx, cz = cz0 + dz, ch = owChunk(OW.surf, cx, cz);
    if (!ch) continue;
    const t = maStrygeSolidTop(ch, owIdx(cx, cz), cx, cz);
    if (t > f) f = t;
  }
  return f;
}
/* Écart horizontal : s'éloigner des troncs et poteaux à moins de 1,8 m (s'ils montent plus haut qu'elle). */
const _msAv = { x: 0, z: 0 };
function maStrygeAvoid(z) {
  _msAv.x = 0; _msAv.z = 0;
  const x = z.root.x, y = z.root.y, cx0 = Math.floor(x), cz0 = Math.floor(z.root.z);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const cx = cx0 + dx, cz = cz0 + dz, ch = owChunk(OW.surf, cx, cz);
    if (!ch) continue;
    const i = owIdx(cx, cz);
    if (ch.kind[i] !== OWK.SOLID || ch.top[i] < y - 0.8) continue;
    const ox = x - (cx + 0.5), oz = z.root.z - (cz + 0.5), d = Math.hypot(ox, oz);
    if (d > 1.8 || d < 1e-3) continue;
    const k = (1.8 - d) / 1.8 * 3.5;
    _msAv.x += (ox / d) * k; _msAv.z += (oz / d) * k;
  }
  return _msAv;
}
/* Un toit au-dessus de (x, z) ? */
const maRoofOver = (x, z) => owCeilAt(0, x, z) < Infinity;

/* ---------------------------------------------------------------- Vol --
   Vitesse voulue (vx, vy, vz), approchée en douceur (accel) ; puis le déplacement, au-dessus du plancher. */
function msSteer(z, vx, vy, vz, dt, accel = 3) {
  const A = maStrygeAvoid(z);
  vx += A.x; vz += A.z;
  const k = 1 - Math.exp(-accel * dt);
  z.vel.x += (vx - z.vel.x) * k; z.vel.y += (vy - z.vel.y) * k; z.vel.z += (vz - z.vel.z) * k;
}
function msFlyTo(z, tx, ty, tz, speed, dt, accel = 3) {
  const dx = tx - z.root.x, dz = tz - z.root.z, d = Math.hypot(dx, dz);
  const s = Math.min(speed, d * 1.2);
  msSteer(z, d > 1e-3 ? (dx / d) * s : 0, clamp((ty - z.root.y) * 1.4, -3.2, 3.2), d > 1e-3 ? (dz / d) * s : 0, dt, accel);
}
function msMove(z, dt, margin = 0.75, r = 1) {
  z.root.addScaledVector(z.vel, dt);
  // regarder un peu devant : elle monte avant le toit, pas dedans (r : cases autour ; 0 pour se poser au pied d'un mur)
  const ax = z.root.x + z.vel.x * 0.5, az = z.root.z + z.vel.z * 0.5;
  const f = Math.max(maStrygeFloor(z.root.x, z.root.z, r), maStrygeFloor(ax, az, r)) + margin;
  if (z.root.y < f) { z.root.y = damp(z.root.y, f, 10, dt); if (z.vel.y < 0) z.vel.y *= 0.3; }
  z.root.x = clamp(z.root.x, 40, 960); z.root.z = clamp(z.root.z, 40, 960);
}
/* Cap : d'après la vitesse (ou vers le joueur, sur place) ; inclinaison dans les virages. */
function msHeading(z, dt, faceX, faceZ) {
  const sp = Math.hypot(z.vel.x, z.vel.z);
  const want = sp > 0.8 && faceX === undefined ? Math.atan2(z.vel.x, z.vel.z) : Math.atan2((faceX ?? player.pos.x) - z.root.x, (faceZ ?? player.pos.z) - z.root.z);
  const prev = z.yaw;
  z.yaw = turnTo(z.yaw, want, (sp > 3 ? 2.6 : 4) * dt);
  const yr = dt > 0 ? wrapAngle(z.yaw - prev) / dt : 0;
  z.bank = damp(z.bank || 0, clamp(-yr * sp * 0.09, -0.65, 0.65), 4, dt);
}
/* Où regarde-t-elle : la tête vers le joueur (angles dans le repère du corps). */
function msLook(z, hx, hy, hz) {
  const dx = hx - z.root.x, dy = hy - (z.root.y + 0.7), dz = hz - z.root.z;
  z.lookY = clamp(wrapAngle(Math.atan2(dx, dz) - z.yaw), -1.2, 1.2);
  z.lookP = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.8, 0.8);
}

/* ---------------------------------------------------------------- Apparition --
   Kit 2.0.7 (31 octobre, demande d'Anthony) : chacune arrive dans un éclair rouge (ma19, maStrygeArrive), à
   18-28 m, 4-6 m de haut, trois fois sur quatre devant le joueur (maArrSpot) ; avant : une nuée d'un côté (dir),
   à 28-40 m et 8-12 m de haut, souvent hors de vue (encore le repli si aucun endroit ne convient). */
function maStrygeSpawn(dir) {
  if (!ZR.free.length) {
    // horde pleine : la place d'un mort qu'on ne voit plus (noyé au fond, corps loin), jamais un corps proche
    let best = null, bs = -1;
    for (const q of Zombies.list) {
      if (q.alive || q.removed) continue;
      const deep = q.noye && q.ey < (q.wl || 0) - 0.8, d = Math.hypot(q.pos.x - player.pos.x, q.pos.z - player.pos.z);
      if (!deep && d < 30) continue;
      const sc = (deep ? 1e6 : 0) + d;
      if (sc > bs) { bs = sc; best = q; }
    }
    if (!best) return null;
    removeZombie(best);
  }
  const S = MA_STRYGE.spawn, spot = typeof maArrSpot === 'function' ? maArrSpot(dir) : null;
  let x, zz, y;
  if (spot) { x = spot.x; zz = spot.z; y = spot.y; }
  else {
    const a = dir + rand(-0.55, 0.55), d = rand(S.dist[0], S.dist[1]);
    x = clamp(player.pos.x + Math.cos(a) * d, 60, 940); zz = clamp(player.pos.z + Math.sin(a) * d, 60, 940); y = maStrygeFloor(x, zz, 2) + rand(S.alt[0], S.alt[1]);
  }
  const slot = ZR.free.pop(), look = maStrygeLook();
  paintZombieSlot(slot, look, ZR, 'ma_stryge');
  const z = maStrygeObject(slot, look);
  z.hp = z.maxHp = G.zombieHp || maStrygeHp(G.round);
  z.root.set(x, y, zz);
  z.yaw = Math.atan2(player.pos.x - x, player.pos.z - zz);
  z.vel.set(Math.sin(z.yaw) * 3, -0.5, Math.cos(z.yaw) * 3);
  z.orbitA = Math.atan2(zz - player.pos.z, x - player.pos.x);
  z.ss = 'arrive'; z.st = 0; z.glow = 0;
  // l'arrivée : cachée pendant l'appel, elle sort de l'éclair (ma19) ; sans le module, comme avant
  if (spot && typeof maStrygeArrive === 'function') { z.ss = 'emerge'; z.blendK = 14; z.vel.set(0, 0, 0); maStrygeArrive(z); }
  msSync(z);
  Zombies.list.push(z);
  maStrygeAnimate(z, 0);
  MA_STRYGES.spawned++;
  if (z.ss !== 'emerge' && Math.random() < 0.6) maStrygeSnd('screech', x, zz, 0.7);
  maEmit('stryge', { what: 'arrive', id: z.id, x: Math.round(x), z: Math.round(zz) });
  return z;
}
/* Position « au sol » pour le moteur : pos (y : 0,9 m sous le milieu du corps, ou le sol), gy. */
function msSync(z) {
  const grounded = z.ss === 'prowl' || z.ss === 'crawl' || z.ss === 'grounded' || z.ss === 'dead';
  const g = grounded ? (z.groundY ?? owGroundAt(0, z.root.x, z.root.z)) : z.root.y - 0.9;
  z.pos.set(z.root.x, g, z.root.z); z.gy = g;
  z.crawl = grounded;
}

/* ---------------------------------------------------------------- Manche --
   Annonce, vagues (celles des chiens : DOGS), fin, récompense. */
function maStrygeRoundStart() {
  G.dogPack = { left: 0, t: DOGS.firstDelay, dir: rand(0, TAU) };
  MA_STRYGES.rounds++;
  maStrygeSnd('round', null, null);
  HUD.banner('Les Stryges', 'Manche spéciale', 'stryges');
  if (!MA_STRYGES.hint) {
    MA_STRYGES.hint = true;
    setTimeout(() => { if (G.state === 'playing' && G.dogRound) HUD.hint('Les Stryges : deux tirs dans les ailes et elles s’écrasent. Au-dessus de l’eau, elles se noient', 6); }, 4200);
  }
  maEmit('stryges', { what: 'debut', manche: G.round, nombre: G.total });
}
function maStrygeSpawns(dt) {
  const P = G.dogPack;
  if (!P || G.spawned >= G.total) return;
  P.t -= dt;
  if (P.t > 0) return;
  if (P.left <= 0) {
    if (maStrygesAlive() > 1) { P.t = 0.4; return; }
    P.left = Math.min(randInt(DOGS.pack[0], DOGS.pack[1]), G.total - G.spawned);
    P.dir = (P.dir || 0) + rand(1.2, 5.1);                         // la nuée suivante vient d'ailleurs
  }
  if (maStrygesAlive() >= DOGS.alive) { P.t = 0.3; return; }
  if (!maStrygeSpawn(P.dir)) { P.t = 0.5; return; }
  G.spawned++; P.left--;
  // (dans une nuée : un peu plus espacées que les chiens, pour que chaque arrivée se voie, ma19)
  const gap = typeof MA_ARR !== 'undefined' ? MA_ARR.gap : DOGS.spawnGap;
  P.t = P.left > 0 ? rand(gap[0], gap[1]) : rand(DOGS.packGap[0], DOGS.packGap[1]);
}
function maStrygeRoundEnd() {
  maStrygeSnd('roundEnd', null, null);
  maEmit('stryges', { what: 'fin', manche: G.round });
}
/* La dernière de la manche : munitions max (comme le dernier chien de Bunker 7), là où elle tombe. Tuée
   au-dessus de l'eau (ou sur un toit, le joueur dehors) : le bonus apparaît à côté du joueur (Anthony,
   31 octobre 2026), là où il le voit et le prend d'un pas (maStrygeDropNear). */
function maStrygeLastDrop(z) {
  const x = z.root.x, zz = z.root.z;
  const land = maOnFloor(x, zz) || maDepth(x, zz) < 0.4;
  if (land && !(maRoofOver(x, zz) && !maRoofOver(player.pos.x, player.pos.z))) { spawnPowerup('ammo', x, zz, owGroundAt(0, x, zz)); return; }
  const P = maStrygeDropNear();
  spawnPowerup('ammo', P[0], P[1], P[2]);
}
/* À côté du joueur, devant lui de préférence, sinon sur le côté ou derrière :
     · à pied : à 1,6 m, sur une case praticable à sa hauteur, en vue (un pas pour le prendre) ;
     · à la nage : à 1,6 m, sur l'eau libre ; en barque : à 1,1 m devant l'étrave (on avance pour le prendre) ;
       sur l'eau, il flotte à 0,6 m au-dessus de la surface.
   Rien de libre : à ses pieds (il le prend aussitôt). Un bonus se ramasse à moins de 1,25 m, à 1,2 m de
   hauteur près (updatePowerups) : sur l'eau, sa hauteur est celle du pont d'une barque et d'un nageur. */
function maStrygeDropNear() {
  const p = player, V = VEH.drive && VEH.drive.T.boat ? VEH.drive : null, water = !!V || MA_SWIM.on;
  const wy = MA.water - 0.4;
  const ox = V ? V.x : p.pos.x, oz = V ? V.z : p.pos.z, r = V ? V.T.len / 2 + 1.1 : 1.6, yaw = V ? V.yaw : p.yaw;
  const ey = (water ? MA.water : p.gy) + 1.4;
  for (const a of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI]) {
    const [dx, dz] = vehFwd(yaw + a), x = ox + dx * r, z = oz + dz * r;
    if (VEH.list.some((O) => O !== V && vehInside(O, x, z, 0.3))) continue;
    if (water) {
      if (maOnFloor(x, z) || maDepth(x, z) < 0.6 || !owSightClear(ox, ey, oz, x, ey, z)) continue;
      return [x, z, wy];
    }
    if (!owWalkCell(0, Math.floor(x), Math.floor(z))) continue;
    const g = owGroundAt(0, x, z);
    if (!Number.isFinite(g) || Math.abs(g - p.gy) > 0.5 || (!maOnFloor(x, z) && maDepth(x, z) > 0.6)) continue;
    if (!owSightClear(p.pos.x, ey, p.pos.z, x, g + 0.8, z)) continue;
    return [x, z, g];
  }
  return [p.pos.x, p.pos.z, water ? wy : p.gy];
}

/* ---------------------------------------------------------------- Chaque image -- */
const _msHd = new THREE.Vector3(), _msF = new THREE.Vector3();
function maStrygesUpdate(dt) {
  if (!OW.on || OW.worldId !== 'marais') return;
  let any = false;
  for (const z of Zombies.list) if (z.stryge && !z.removed) { any = true; break; }
  if (!any) { maStrygeFxUpdate(dt, null); return; }
  const p = player, down = !!p.down;
  maPlayerHead(_msHd);
  const C = {
    px: p.pos.x, pz: p.pos.z, gy: p.gy, hx: _msHd.x, hy: _msHd.y, hz: _msHd.z, down,
    indoor: !VEH.drive && !MA_SWIM.on && maRoofOver(p.pos.x, p.pos.z),
    pvx: VEH.drive ? Math.sin(VEH.drive.yaw) * VEH.drive.v : (p.vel ? p.vel.x : 0), pvz: VEH.drive ? Math.cos(VEH.drive.yaw) * VEH.drive.v : (p.vel ? p.vel.z : 0),
    n: G.dogs ? G.dogs.n : 0,
  };
  C.indoorT = C.indoor ? (MA_STRYGES.indoorT = (MA_STRYGES.indoorT || 0) + dt) : (MA_STRYGES.indoorT = 0);
  maStrygesRoles(C);
  maStrygesGroundRoles(C);
  for (let i = Zombies.list.length - 1; i >= 0; i--) { const z = Zombies.list[i]; if (z && z.stryge && !z.removed) maStrygeStep(z, dt, C); }
  maStrygesVoices(dt, C);
  maStrygeFxUpdate(dt, C);
  flushZombieMatrices();
}
/* Qui pique : au plus attackers(n) à la fois, un départ toutes les 1,8 s au plus (dive.gap) ; de préférence une stryge que le
   joueur voit (le cri prévient aussi les autres), à bonne distance, la vue dégagée. */
function maStrygesRoles(C) {
  const D = MA_STRYGE.dive;
  let active = 0;
  for (const z of Zombies.list) if (z.stryge && z.alive && (z.ss === 'windup' || z.ss === 'dive')) active++;
  if (C.down || C.indoor || active >= MA_STRYGE.attackers(C.n) || G.time - MA_STRYGES.lastDive < D.gap) return;
  camera.getWorldDirection(_msF);
  let best = null, bs = Infinity;
  for (const z of Zombies.list) {
    if (!z.stryge || !z.alive || z.ss !== 'circle' || z.diveCd > 0 || !z.los) continue;
    const dx = z.root.x - C.hx, dy = z.root.y - C.hy, dz = z.root.z - C.hz, d = Math.hypot(dx, dy, dz);
    if (d < D.from[0] || d > D.from[1]) continue;
    const seen = (dx * _msF.x + dy * _msF.y + dz * _msF.z) / d > 0.45;
    const sc = d + (seen ? 0 : 4) + Math.random() * 2;
    if (sc < bs) { bs = sc; best = z; }
  }
  if (best) { msState(best, 'windup'); MA_STRYGES.lastDive = G.time; }
}
/* Au sol : les plus proches mordent (autant qu'en piqué), les autres attendent leur tour autour (en sifflant). */
function maStrygesGroundRoles(C) {
  const L = [];
  for (const z of Zombies.list) if (z.stryge && z.alive && (z.ss === 'prowl' || z.ss === 'crawl')) L.push([Math.hypot(z.root.x - C.px, z.root.z - C.pz), z]);
  L.sort((a, b) => a[0] - b[0]);
  const n = MA_STRYGE.attackers(C.n);
  L.forEach(([, z], i) => { z.gAtk = i < n; });
}
function msState(z, s) {
  z.ss = s; z.st = 0;
  switch (s) {
    case 'windup': z.blendK = 9; maStrygeSnd('screech', z.root.x, z.root.z, 1.1); maEmit('stryge', { what: 'cri', id: z.id }); break;
    case 'dive': z.blendK = 12; z.diveMin = 1e9; z.diveUp = 0; maStrygeSnd('dive', z.root.x, z.root.z); maEmit('stryge', { what: 'pique', id: z.id }); break;
    case 'climb': z.blendK = 6; z.diveCd = rand(MA_STRYGE.dive.cool[0], MA_STRYGE.dive.cool[1]); break;
    case 'circle': z.blendK = 6; z.orbitA = Math.atan2(z.root.z - player.pos.z, z.root.x - player.pos.x); break;
    case 'crash': z.blendK = 10; z.tumP = 0.6; z.tumR = 0; z.spin = rand(-4, 4); MA_STRYGES.crashed++; maStrygeSnd('crash', z.root.x, z.root.z); maEmit('stryge', { what: 'ecrase', id: z.id }); break;
    case 'grounded': z.blendK = 10; break;
    case 'crawl': z.blendK = 6; z.speed = rand(MA_STRYGE.crawl.speed[0], MA_STRYGE.crawl.speed[1]); break;
    case 'prowl': z.blendK = 7; z.speed = rand(MA_STRYGE.crawl.prowl[0], MA_STRYGE.crawl.prowl[1]); break;
    case 'land': z.blendK = 6; z.landTo = null; break;
    case 'takeoff': z.blendK = 8; maStrygeSnd('flap', z.root.x, z.root.z, 1.2); break;
    default: z.blendK = 7;
  }
}
/* Une stryge, chaque image. */
function maStrygeStep(z, dt, C) {
  z.t += dt; z.st += dt;
  if (z.diveCd > 0) z.diveCd -= dt;
  if (z.biteT > 0) z.biteT = Math.max(0, z.biteT - dt);
  if (z.biteCd > 0) z.biteCd -= dt;
  if (z.hurtT > 0) z.hurtT -= dt;
  if (z.healT > 0) z.healT -= dt;
  z.flinch = damp(z.flinch, 0, 7, dt);
  z.scream = damp(z.scream || 0, 0, 3, dt);
  if (z.alive && z.nukeT > 0) { z.nukeT -= dt; if (z.nukeT <= 0) killZombie(z, { kind: 'nuke', dx: rand(-1, 1), dz: rand(-1, 1) }); }
  if (z.removed) return;
  z.blinkT -= dt;
  if (z.blinkT <= 0) { z.blink = 0.12; z.blinkT = rand(2.5, 7); }
  if (z.blink > 0) z.blink -= dt;
  // vue sur le joueur (pour piquer) : toutes les 0,25 s
  z.losT -= dt;
  if (z.losT <= 0 && z.alive) { z.losT = 0.25; z.los = !C.indoor && owSightClear(z.root.x, z.root.y, z.root.z, C.hx, C.hy, C.hz); }
  const D = MA_STRYGE.dive, [c0, c1] = MA_STRYGE.cruise();
  const pdx = C.px - z.root.x, pdz = C.pz - z.root.z, pd = Math.hypot(pdx, pdz);
  let glow = 1;
  switch (z.ss) {
    case 'emerge': {
      // l'arrivée (ma19) : cachée pendant l'appel ; elle sort de l'éclair, se déploie en hurlant, monte un peu, se
      // tourne vers le joueur, puis part vers lui
      const A = z.arr;
      if (!A || z.hidden) { z.vel.set(0, 0, 0); glow = 0; z.glow = 0; if (!A) msState(z, 'arrive'); break; }
      const k = clamp((A.t - A.pre) / MA_ARR.emerge, 0, 1);
      msSteer(z, 0, k < 0.35 ? 1.4 : 0.3, 0, dt, 5);
      msMove(z, dt);
      msHeading(z, dt, C.hx, C.hz);
      msLook(z, C.hx, C.hy, C.hz);
      z.wfreq = k < 0.25 ? 0.6 : 1.7; z.glide = 0;
      z.scream = Math.max(z.scream, k > 0.08 && k < 0.75 ? 1 : 0);
      glow = 2.6 - 1.6 * k;
      if (k >= 1) { z.arr = null; msState(z, 'arrive'); z.blendK = 7; }
      break;
    }
    case 'arrive': case 'circle': {
      // tourner autour du joueur, à 3-5 m du sol ; plus vite s'il s'éloigne (barque lancée)
      if (z.ss === 'arrive' && pd < z.orbitR + 5) msState(z, 'circle');
      const behind = Math.max(0, pd - z.orbitR - 3);
      const sp = Math.min(MA_STRYGE.chase, z.speed + behind * 0.35 + Math.hypot(C.pvx, C.pvz) * 0.8);
      if (z.ss === 'circle') {
        z.orbitA += (z.orbitDir * z.speed / z.orbitR) * dt;
        // le point du cercle reste devant elle (s'il s'en éloigne, elle reprend où elle est)
        const cur = Math.atan2(z.root.z - C.pz, z.root.x - C.px);
        if (Math.abs(wrapAngle(z.orbitA - cur)) > 0.9) z.orbitA = cur + z.orbitDir * 0.5;
      }
      const R = z.orbitR + 1.2 * Math.sin(z.t * 0.31 + z.seed), tx = C.px + Math.cos(z.orbitA) * R, tz = C.pz + Math.sin(z.orbitA) * R;
      const ty = maStrygeFloor(tx, tz, 1) + z.alt + 0.5 * Math.sin(z.t * 0.6 + z.seed) + (z.ss === 'arrive' ? clamp((pd - 15) * 0.15, 0, 5) : 0);
      msFlyTo(z, tx, ty, tz, sp, dt, 2.2);
      msMove(z, dt);
      msHeading(z, dt);
      msLook(z, C.hx, C.hy, C.hz);
      // glissés : de temps en temps, les ailes s'arrêtent (quand elle ne monte pas)
      const g = 0.5 + 0.5 * Math.sin(z.t * 0.5 + z.seed * 1.7);
      z.glide = damp(z.glide || 0, g > 0.62 && z.vel.y < 0.4 ? 1 : 0, 2.5, dt);
      z.wfreq = lerp(1.15, 0.8, clamp(Math.hypot(z.vel.x, z.vel.z) / 4.2, 0, 1));
      // le joueur à l'abri : elle se pose et entre à pied
      if (z.ss === 'circle' && C.indoorT > 1.2) msState(z, 'land');
      if (pd > MA_STRYGE.far + 40) { z.root.set(C.px - Math.cos(z.orbitA) * 30, z.root.y, C.pz - Math.sin(z.orbitA) * 30); }   // perdue : elle revient
      break;
    }
    case 'windup': {
      // le cri : elle freine, monte un peu, lève les ailes, la gueule ouverte, face au joueur
      const k = clamp(z.st / D.windup, 0, 1);
      msSteer(z, 0, 0.9, 0, dt, 4);
      msMove(z, dt);
      msHeading(z, dt, C.hx, C.hz);
      msLook(z, C.hx, C.hy, C.hz);
      z.scream = Math.max(z.scream, k);
      z.wfreq = 1.35; z.glide = 0;
      glow = 1 + 0.6 * k;
      if (C.indoor || C.down) { msState(z, 'circle'); break; }
      if (z.st >= D.windup) {
        const tx = C.hx + C.pvx * 0.2 - z.root.x, ty = C.hy + D.over - z.root.y, tz = C.hz + C.pvz * 0.2 - z.root.z, d = Math.hypot(tx, ty, tz) || 1;
        z.vel.set((tx / d) * 3.5, (ty / d) * 3.5, (tz / d) * 3.5);
        msState(z, 'dive');
      }
      break;
    }
    case 'dive': {
      // le plongeon : la vitesse monte ; elle corrige sa course (D.turn rad/s au plus) vers la tête du joueur
      const tx = C.hx + C.pvx * 0.12 - z.root.x, ty = C.hy + D.over - z.root.y, tz = C.hz + C.pvz * 0.12 - z.root.z, d = Math.hypot(tx, ty, tz) || 1;
      const sp = Math.min(D.speed, Math.hypot(z.vel.x, z.vel.y, z.vel.z) + D.accel * dt);
      _msV.copy(z.vel).normalize(); _msW.set(tx / d, ty / d, tz / d);
      const ang = Math.acos(clamp(_msV.dot(_msW), -1, 1)), turn = d < D.lock ? 0 : D.turn * dt;
      if (ang > 1e-4) { const k = Math.min(1, turn / ang); _msV.lerp(_msW, k).normalize(); }
      z.vel.copy(_msV).multiplyScalar(sp);
      msMove(z, dt, 0.55);
      z.yaw = Math.atan2(z.vel.x, z.vel.z);
      z.divePitch = Math.PI / 2 + Math.atan2(-z.vel.y, Math.hypot(z.vel.x, z.vel.z)) * 0.85;
      z.bank = damp(z.bank || 0, 0, 4, dt);
      msLook(z, C.hx, C.hy, C.hz);
      z.wfreq = 3; glow = 1.5;
      // la morsure : la gueule à moins de D.hit de la tête
      _msA.set(0, ZRIG.head - 0.06, 0.09).applyMatrix4(z.rig.neck.matrixWorld);
      const hd = Math.hypot(_msA.x - C.hx, _msA.y - C.hy, _msA.z - C.hz);
      if (hd < D.hit && !C.down) { maStrygeBite(z, C, true); msState(z, 'climb'); break; }
      // ratée : elle a dépassé le point le plus proche (ou trop longtemps)
      if (hd < z.diveMin) z.diveMin = hd; else z.diveUp += dt;
      if ((z.diveUp > 0.08 && z.diveMin < 4) || z.st > D.max || C.indoor) { msState(z, 'climb'); maEmit('stryge', { what: 'rate', id: z.id }); }
      break;
    }
    case 'climb': {
      // elle remonte et repart : tout droit, en battant fort, jusqu'à son altitude
      const sp = Math.hypot(z.vel.x, z.vel.z) || 1, fx = z.vel.x / sp, fz = z.vel.z / sp;
      const ty = maStrygeFloor(z.root.x, z.root.z, 1) + z.alt;
      msSteer(z, fx * Math.max(c1, 4.5), clamp((ty - z.root.y) * 1.5 + 1.2, -1, 3.2), fz * Math.max(c1, 4.5), dt, 2.5);
      msMove(z, dt);
      msHeading(z, dt);
      z.wfreq = 1.4; z.glide = 0;
      if (z.st > 0.9 && z.root.y > ty - 0.8) msState(z, 'circle');
      if (z.st > 3) msState(z, 'circle');
      break;
    }
    case 'land': {
      // se poser dehors, près de l'abri du joueur, sur une case d'où l'on va jusqu'à lui à pied
      if (!C.indoor) { msState(z, 'circle'); break; }
      if (!z.landTo) z.landTo = maStrygeLandSpot(C, z);
      if (!z.landTo) { z.st = 0; msFlyTo(z, C.px + Math.cos(z.orbitA) * 8, maStrygeFloor(C.px, C.pz, 2) + 2, C.pz + Math.sin(z.orbitA) * 8, c0, dt); msMove(z, dt); msHeading(z, dt); break; }
      const L = z.landTo, d = Math.hypot(L.x - z.root.x, L.z - z.root.z);
      const ty = d > 3 ? Math.max(L.y + 2.2, maStrygeFloor(z.root.x, z.root.z, 1) + 1.2) : L.y + 0.45;
      msFlyTo(z, L.x, ty, L.z, Math.min(c1, d * 1.5 + 1), dt, d < 2.5 ? 5 : 3);
      msMove(z, dt, d > 2 ? 0.75 : 0.35, d > 2.5 ? 1 : 0);
      msHeading(z, dt, d > 1 ? undefined : C.px, d > 1 ? undefined : C.pz);
      z.flyK = clamp(d / 6, 0, 1); z.wfreq = 1.5;
      if (d < 0.7 && z.root.y < L.y + 0.75) { z.groundY = L.y; z.root.set(L.x, L.y + 0.42, L.z); z.vel.set(0, 0, 0); msState(z, 'prowl'); maStrygeSnd('thud', z.root.x, z.root.z, 0.5); }
      if (z.st > 12) { z.landTo = null; z.st = 0; }
      break;
    }
    case 'prowl': case 'crawl': {
      // au sol : à quatre pattes (ailes repliées) ou en rampant (ailes brisées), vers le joueur par le champ
      // de flux ; elle mord à portée ; ailes intactes et ciel libre (lui dehors, elle aussi) : elle s'envole
      maStrygeGround(z, dt, C);
      if (z.ss === 'prowl' && !C.indoor && !maRoofOver(z.root.x, z.root.z) && z.st > 0.8) msState(z, 'takeoff');
      break;
    }
    case 'takeoff': {
      const fx = Math.sin(z.yaw), fz = Math.cos(z.yaw);
      msSteer(z, fx * 1.5, 3.4, fz * 1.5, dt, 5);
      msMove(z, dt, 0.4);
      z.flyK = clamp(z.st / 0.8, 0, 1); z.wfreq = 1.8; z.groundY = null;
      if (z.st > 0.75) msState(z, 'climb');
      break;
    }
    case 'crash': {
      // ailes brisées : elle tombe en tournoyant, les ailes battent pour rien
      z.vel.y -= 9.8 * dt; z.vel.x = damp(z.vel.x, 0, 0.8, dt); z.vel.z = damp(z.vel.z, 0, 0.8, dt);
      z.root.addScaledVector(z.vel, dt);
      z.tumP += dt * 2.2; z.tumR += z.spin * dt; z.yaw += z.spin * 0.4 * dt;
      z.wfreq = 4; glow = 1.2;
      const gw = maStrygeLandAt(z.root.x, z.root.z, z.root.y);
      if (z.root.y <= gw.y + 0.3) maStrygeTouch(z, gw, false);
      break;
    }
    case 'grounded': {
      // assommée par la chute : elle se débat, puis rampe
      if (z.st > 0.9) msState(z, 'crawl');
      maStrygeGround(z, dt, C, true);
      break;
    }
    case 'fall': {
      // morte en l'air : elle tombe, molle
      z.vel.y -= 9.8 * dt; z.vel.x = damp(z.vel.x, 0, 0.6, dt); z.vel.z = damp(z.vel.z, 0, 0.6, dt);
      z.root.addScaledVector(z.vel, dt);
      z.tumP += dt * 1.6; z.tumR += (z.spin || 1) * 0.6 * dt;
      glow = 0;
      const gw = maStrygeLandAt(z.root.x, z.root.z, z.root.y);
      if (z.root.y <= gw.y + 0.2) maStrygeTouch(z, gw, true);
      break;
    }
    case 'dead': {
      glow = 0;
      if (z.st > 9) z.root.y -= dt * 0.12;                         // le corps s'enfonce dans la vase
      if (z.st > 11.5) { removeZombie(z); return; }
      break;
    }
    case 'drown': case 'sink': {
      // elle se débat (2,4 s), puis coule ; la lueur s'éteint sous l'eau
      const W = MA.water, k = z.ss === 'sink' ? z.st : 0;
      if (z.ss === 'drown') {
        z.root.y = damp(z.root.y, W - 0.3 + 0.08 * Math.sin(z.t * 7), 6, dt);
        if (Math.random() < dt * 6) maSplash(z.root.x + rand(-0.8, 0.8), z.root.z + rand(-0.8, 0.8), 0.45, { up: 0.8 });
        if (Math.random() < dt * 3) maBubbles(z.root.x, z.root.z, 3, 0.6);
        if (z.st > 2.4) { z.ss = 'sink'; z.st = 0; maStrygeSnd('sink', z.root.x, z.root.z); }
        glow = 0.9;
      } else {
        z.root.y -= dt * (0.35 + k * 0.25);
        if (Math.random() < dt * 2.5) maBubbles(z.root.x, z.root.z, 2, 0.4);
        glow = clamp(1 - (W - z.root.y) / 1.2, 0, 1) * 0.7;
        if (z.root.y < W - 2.4) { removeZombie(z); return; }
      }
      break;
    }
    default: msState(z, 'circle');
  }
  if (z.removed) return;
  z.glow = damp(z.glow || 0, z.headless ? 0 : glow * (z.healT > 0 ? 1.6 : 1), glow > z.glow ? 5 : 3, dt);
  msSync(z);
  maStrygeAnimate(z, dt);
}
/* Où tombe-t-elle : le sol (ou un plancher, un toit) sous (x, z), ou l'eau. */
function maStrygeLandAt(x, z, y) {
  const cx = Math.floor(x), cz = Math.floor(z), ch = owChunk(OW.surf, cx, cz);
  let g = owH(x, z), roof = false, floor = false;
  if (ch) {
    const i = owIdx(cx, cz), k = ch.kind[i];
    if ((k === OWK.FLOOR || k === OWK.RAMP || k === OWK.DOOR) && ch.ceil[i] > 0 && y > ch.ceil[i]) { g = ch.roof[i]; roof = true; }
    else if (k === OWK.FLOOR || k === OWK.RAMP) { g = ch.base[i]; floor = true; }
    else if (k === OWK.SOLID || k === OWK.LOW) { g = ch.top[i] <= y + 0.5 ? ch.top[i] : owH(x, z); floor = true; }
  }
  const water = !floor && !roof && MA.water - g > MA_STRYGE.drown;
  return { y: water ? MA.water : g, water, roof, ground: g };
}
/* Elle touche le sol, un toit ou l'eau. */
function maStrygeTouch(z, gw, dead) {
  z.vel.set(0, 0, 0);
  if (gw.roof) {
    // sur un toit : elle glisse et tombe au pied du bâtiment
    const a = Math.atan2(z.root.z - player.pos.z, z.root.x - player.pos.x);
    for (let r = 1; r < 9; r += 0.5) { const x = z.root.x + Math.cos(a) * r, zz = z.root.z + Math.sin(a) * r; if (!maRoofOver(x, zz)) { z.root.x = x; z.root.z = zz; break; } }
    return;
  }
  if (gw.water) {
    maSplash(z.root.x, z.root.z, 1.1, { up: 1.2 });
    maBubbles(z.root.x, z.root.z, 8, 1);
    z.root.y = MA.water - 0.2;
    if (dead) { z.ss = 'sink'; z.st = 0; maStrygeSnd('sink', z.root.x, z.root.z); return; }
    // vivante : elle se noie (une élimination pour le joueur)
    MA_STRYGES.drowned++;
    maStrygeKill(z, { kind: 'drown', dx: 0, dz: 0 });
    z.ss = 'drown'; z.st = 0; z.blendK = 8;
    maStrygeSnd('drown', z.root.x, z.root.z);
    maEmit('stryge', { what: 'noyee', id: z.id, x: Math.round(z.root.x), z: Math.round(z.root.z) });
    return;
  }
  z.groundY = gw.y; z.root.y = gw.y + (dead ? 0.13 : 0.32);
  maStrygeSnd('thud', z.root.x, z.root.z);
  spawnPuff(z.root.x, gw.y + 0.15, z.root.z, 1.1, 1.1, 0x3a3428, 0.4, 0.3);
  if (dead) { z.ss = 'dead'; z.st = 0; z.deadRoll = rand(-0.25, 0.25); z.deadSide = Math.random() < 0.5 ? -1 : 1; addDecal('blood', z.root.x, gw.y + 0.003, z.root.z, 0, 1, 0, rand(0.8, 1.2)); return; }
  // la chute la blesse
  z.ss = 'grounded'; z.st = 0;
  const dmg = z.maxHp * MA_STRYGE.fallDmg;
  z.hp -= dmg;
  if (z.hp <= 0) { z.hp = 0; maStrygeKill(z, { kind: 'fall', dx: 0, dz: 0 }); z.ss = 'dead'; z.st = 0; }
}
/* Au sol : avancer vers le joueur (champ de flux), sans entrer dans l'eau profonde ; mordre à portée. */
function maStrygeGround(z, dt, C, still = false) {
  const G0 = z.groundY ?? owGroundAt(0, z.root.x, z.root.z);
  const reach = MA_STRYGE.crawl.reach, dy = Math.abs(C.gy - G0);
  const dx = C.px - z.root.x, dz = C.pz - z.root.z, d = Math.hypot(dx, dz);
  let mv = 0;
  // elle recule après avoir mordu ; celles qui attendent leur tour restent à distance
  if (z.backT > 0) {
    z.backT -= dt;
    const nx = z.root.x - (dx / (d || 1)) * 1.8 * dt, nz = z.root.z - (dz / (d || 1)) * 1.8 * dt;
    if (owWalkCell(0, Math.floor(nx), Math.floor(nz)) && (maOnFloor(nx, nz) || maDepth(nx, nz) < MA_STRYGE.drown - 0.15)) { z.root.x = nx; z.root.z = nz; }
    still = true;
  }
  const wait = !z.gAtk && d < MA_STRYGE.crawl.wait;
  if (!still && !wait && d > reach * 0.8) {
    const k = owK(0, Math.floor(z.root.x), Math.floor(z.root.z));
    owFlowDir(k, z.root.x, z.root.z, _msV);
    const sp = z.speed * (z.stagger > 0 ? 0.4 : 1), sx = _msV.x * sp * dt, sz = _msV.z * sp * dt;
    // un pas : en diagonale, ou en glissant le long du mur (un coin de mur ou de seuil arrête la diagonale)
    for (const [ax, az] of [[sx, sz], [sx, 0], [0, sz]]) {
      if (!ax && !az) continue;
      const nx = z.root.x + ax, nz = z.root.z + az;
      const g = owGroundAt(0, nx, nz), deep = !maOnFloor(nx, nz) && maDepth(nx, nz) > MA_STRYGE.drown - 0.15;
      if (Number.isFinite(g) && !deep && Math.abs(g - G0) < 0.6 && owWalkCell(0, Math.floor(nx), Math.floor(nz))) {
        z.root.x = nx; z.root.z = nz; z.groundY = damp(G0, g, 12, dt); mv = Math.hypot(ax, az) / dt;
        break;
      }
    }
    // coincée (plus de 2,5 s sans avancer) : un pas de côté au hasard
    z.stuckT = mv > 0.2 ? 0 : (z.stuckT || 0) + dt;
    if (z.stuckT > 2.5) {
      z.stuckT = 0;
      for (let i = 0; i < 8; i++) { const a = rand(0, TAU), nx = z.root.x + Math.cos(a) * 0.8, nz = z.root.z + Math.sin(a) * 0.8, g = owGroundAt(0, nx, nz); if (owWalkCell(0, Math.floor(nx), Math.floor(nz)) && Math.abs(g - G0) < 0.6) { z.root.x = nx; z.root.z = nz; z.groundY = g; break; } }
    }
    z.yaw = turnTo(z.yaw, Math.atan2(_msV.x, _msV.z), 4 * dt);
  } else z.yaw = turnTo(z.yaw, Math.atan2(dx, dz), 5 * dt);
  z.moving = damp(z.moving || 0, mv, 6, dt);
  z.gait = (z.gait || 0) + dt * (z.ss === 'prowl' ? 6.5 : 4) * clamp(z.moving / 1.2 + 0.15, 0.15, 1.4);
  z.root.y = (z.groundY ?? G0) + (z.ss === 'prowl' ? 0.42 : 0.36) + 0.02 * Math.sin(z.gait * 2);
  // poussée par les coups
  if (z.knockX || z.knockZ) { z.knockX = damp(z.knockX, 0, 5, dt); z.knockZ = damp(z.knockZ, 0, 5, dt); }
  // tombée à l'eau (poussée, berge) : elle se noie
  if (!maOnFloor(z.root.x, z.root.z) && maDepth(z.root.x, z.root.z) > MA_STRYGE.drown) { maStrygeTouch(z, { water: true, y: MA.water }, false); return; }
  msLook(z, C.hx, C.hy, C.hz);
  // la morsure
  if (!still && !wait && !C.down && d < reach && dy < 1 && z.biteCd <= 0) { z.biteCd = MA_STRYGE.crawl.cycle; z.biteT = 0.35; z.biteDue = 0.15; }
  if (z.biteDue > 0) { z.biteDue -= dt; if (z.biteDue <= 0 && d < reach + 0.35 && dy < 1 && !C.down) { maStrygeBite(z, C, false); z.backT = MA_STRYGE.crawl.back; } }
}
/* Elle mord et draine : dégâts au joueur, autant de PV repris. */
function maStrygeBite(z, C, dive) {
  const dmg = RULES.zombieHit * MA_STRYGE.dmgK, before = player.hp;
  playerDamage(dmg);
  const dealt = Math.max(0, before - player.hp);
  if (dealt > 0) { z.hp = Math.min(z.maxHp, z.hp + dealt * MA_STRYGE.heal); z.healT = 0.9; }
  z.biteT = 0.35;
  MA_STRYGES.bites++;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  // le sang : devant le visage (pas sur la caméra), puis un filet qui file vers sa gueule
  bloodBurst(C.hx - fx * 0.7, C.hy - 0.15, C.hz - fz * 0.7, (z.root.x - C.hx) * 0.3, (z.root.z - C.hz) * 0.3, 7, 0.8);
  maStrygeDrainFx(z, C);
  if (dive) maSecousse(0.45);
  maStrygeSnd('bite', z.root.x, z.root.z);
  maStrygeSnd('drain', z.root.x, z.root.z);
  maEmit('stryge', { what: 'mord', id: z.id, degats: Math.round(dealt) });
}

/* ---------------------------------------------------------------- Se poser --
   Une case dehors (ciel libre), praticable, hors de l'eau profonde, d'où le champ de flux mène au joueur
   (moins de 30 cases), à 3-12 m de lui ; la plus proche à pied. */
function maStrygeLandSpot(C, z) {
  let best = null, bs = Infinity;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + (z.seed || 0), r = 3 + (i % 5) * 2.2;
    const x = C.px + Math.cos(a) * r, zz = C.pz + Math.sin(a) * r, cx = Math.floor(x), cz = Math.floor(zz);
    if (maRoofOver(x, zz) || !owWalkCell(0, cx, cz)) continue;
    if (!maOnFloor(x, zz) && maDepth(x, zz) > 0.35) continue;
    const f = owFlowAt(owK(0, cx, cz));
    if (!(f < 30)) continue;
    const sc = f + Math.hypot(x - z.root.x, zz - z.root.z) * 0.15;
    if (sc < bs) { bs = sc; best = { x: cx + 0.5, z: cz + 0.5, y: owGroundAt(0, cx + 0.5, cz + 0.5) }; }
  }
  if (best && !MA_STRYGES.hintRoof && G.state === 'playing') { MA_STRYGES.hintRoof = true; HUD.hint('À l’abri d’un toit, les Stryges se posent et entrent à quatre pattes', 4); }
  return best;
}

/* ---------------------------------------------------------------- Tir, dégâts, mort --
   Tir : la tête (sphère), le buste (capsule), bras et jambes, puis les deux membranes (le plan de l'aile, en
   éventail comme dans le nuanceur ; une balle qui passe par un trou ne touche pas). z.rayPart : ce qui est
   touché (lu par maStrygeDamage pour ce tir). */
function maStrygeRay(z, ox, oy, oz, dx, dy, dz, extra) {
  _hitHead = false; _hitLeg = false; _hitArm = 0;
  if (!z.alive || z.hidden) return -1;                 // (pas encore sortie de l'éclair, ma19)
  const r = z.rig;
  let best = -1, part = null;
  const take = (t, p) => { if (t >= 0 && (best < 0 || t < best)) { best = t; part = p; } };
  if (!z.headless) {
    zombieHead(z, _msH);
    const R = 0.13 + extra, lx = ox - _msH.x, ly = oy - _msH.y, lz = oz - _msH.z;
    const b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - R * R, disc = b * b - c;
    if (disc >= 0) take(-b - Math.sqrt(disc), 'head');
  }
  _msA.setFromMatrixPosition(r.hips.matrixWorld); _msB.setFromMatrixPosition(r.neck.matrixWorld);
  take(raySegment(ox, oy, oz, dx, dy, dz, _msA, _msB, 0.15 + extra), 'body');
  for (const s of ['L', 'R']) {
    _msA.setFromMatrixPosition(r[`sh${s}`].matrixWorld); _msB.setFromMatrixPosition(r[`el${s}`].matrixWorld); _msC.set(0, -0.3, 0).applyMatrix4(r[`el${s}`].matrixWorld);
    take(raySegment(ox, oy, oz, dx, dy, dz, _msA, _msB, 0.05 + extra), 'arm'); take(raySegment(ox, oy, oz, dx, dy, dz, _msB, _msC, 0.045 + extra), 'arm');
    _msA.setFromMatrixPosition(r[`hip${s}`].matrixWorld); _msB.setFromMatrixPosition(r[`kn${s}`].matrixWorld); _msC.set(0, -0.42, 0.05).applyMatrix4(r[`kn${s}`].matrixWorld);
    take(raySegment(ox, oy, oz, dx, dy, dz, _msA, _msB, 0.065 + extra), 'leg'); take(raySegment(ox, oy, oz, dx, dy, dz, _msB, _msC, 0.05 + extra), 'leg');
  }
  for (let s = 0; s < 2; s++) take(maStrygeWingRay(z, s, ox, oy, oz, dx, dy, dz), s ? 'wingR' : 'wingL');
  z.rayPart = part; z.rayT = G.time;
  _hitHead = part === 'head';
  return best;
}
const _msO = new THREE.Vector3(), _msD = new THREE.Vector3();
function maStrygeWingRay(z, s, ox, oy, oz, dx, dy, dz) {
  const bone = z.rig[s ? 'wwR' : 'wwL'];
  _msM.copy(bone.matrixWorld).invert();
  _msO.set(ox, oy, oz).applyMatrix4(_msM);
  _msD.set(dx, dy, dz).transformDirection(_msM);
  if (Math.abs(_msD.y) < 1e-5) return -1;
  const t = -_msO.y / _msD.y;
  if (t < 0) return -1;
  const px = _msO.x + _msD.x * t, pz = _msO.z + _msD.z * t, W = z.wing[s];
  // panneau fixe (poignet, coude, épaule, hanche)
  const Q = [[0, 0], [MS_W.E[0] - MS_W.W[0], MS_W.E[2] - MS_W.W[2]], [-MS_W.W[0], -MS_W.W[2]], [MS_W.Bt[0] - MS_W.W[0], MS_W.Bt[2] - MS_W.W[2]]];
  let inQ = true, sg = 0;
  for (let i = 0; i < 4; i++) {
    const a = Q[i], b = Q[(i + 1) % 4], cr = (b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (cr !== 0) { if (!sg) sg = Math.sign(cr); else if (Math.sign(cr) !== sg) { inQ = false; break; } }
  }
  if (inQ) return maStrygeWingSolid(0.87, 0.5, W.dmg) ? t : -1;
  // l'éventail
  const rho = Math.hypot(px, pz), a = Math.atan2(-pz, px), f = clamp(W.fold, 0, 1);
  const th = [lerp(MS_W.open[0], MS_W.fold[0], f), lerp(MS_W.open[1], MS_W.fold[1], f), lerp(MS_W.open[2], MS_W.fold[2], f), MS_W.a4];
  const Ls = [MS_W.L[0], MS_W.L[1], MS_W.L[2], MS_W.L4];
  for (let k = 0; k < 3; k++) {
    if (a < th[k] || a > th[k + 1]) continue;
    const fr = (a - th[k]) / Math.max(1e-4, th[k + 1] - th[k]);
    const R = lerp(Ls[k], Ls[k + 1], fr) * (1 - MS_W.scal[k] * Math.sin(Math.PI * fr) * (1 - 0.5 * f));
    if (rho > R) return -1;
    return maStrygeWingSolid(((k + fr) / 3) * 0.75, rho / R, W.dmg) ? t : -1;
  }
  return -1;
}
function maStrygeDamage(z, amount, info) {
  if (!z.alive) return false;
  if (G.timers.insta > 0 && info.kind !== 'nuke') amount = z.hp + 1;
  const flying = !!MS_FLY[z.ss], kind = info.kind;
  const ray = z.rayT === G.time && kind !== 'knife' && kind !== 'nuke' && kind !== 'explosive' && kind !== 'blast';
  const part = ray ? z.rayPart : null;
  if (part === 'wingL' || part === 'wingR') {
    // dans la membrane : peu de dégâts, mais elle se déchire ; un tir compte une fois (les plombs d'une
    // décharge aussi)
    const s = part === 'wingL' ? 0 : 1;
    amount *= MA_STRYGE.wing.k;
    if (z.wingT !== G.time) {
      z.wingT = G.time; z.wingHits++;
      z.wing[s].dmg = Math.min(0.85, z.wing[s].dmg + MA_STRYGE.wing.tear);
      maStrygeSnd('rip', z.root.x, z.root.z);
      _msA.set(rand(0.2, 0.9), 0, rand(-0.5, 0.2)).applyMatrix4(z.rig[s ? 'wwR' : 'wwL'].matrixWorld);
      for (let i = 0; i < 4; i++) spawnDebris(MAT.maStrygeCloth, rand(0.04, 0.09), 0.006, rand(0.04, 0.1), _msA.x, _msA.y, _msA.z, (info.dx || 0) * rand(1, 3) + rand(-1, 1), rand(-0.5, 1.5), (info.dz || 0) * rand(1, 3) + rand(-1, 1), 2.5);
    }
  } else if (kind === 'explosive' || kind === 'blast') {
    // le souffle déchire les deux ailes
    z.wingHits += (info.force || 0) > 5 ? 2 : 1;
    for (const W of z.wing) W.dmg = Math.min(0.85, W.dmg + 0.22);
  }
  z.rayPart = null;
  z.hp -= amount;
  z.flinch = Math.min(0.7, z.flinch + 0.2 + (amount / z.maxHp) * 0.8);
  if (info.force && flying) { z.vel.x += (info.dx || 0) * info.force * 0.5; z.vel.z += (info.dz || 0) * info.force * 0.5; }
  else if (info.force) { z.knockX += (info.dx || 0) * info.force * 0.4; z.knockZ += (info.dz || 0) * info.force * 0.4; }
  if (z.hp <= 0) { killZombie(z, info); return true; }
  if (z.hurtT <= 0) { z.hurtT = 0.4; maStrygeSnd('hurt', z.root.x, z.root.z); }
  // deux tirs dans les ailes : elle s'écrase (en vol), ou ne pourra plus s'envoler (au sol)
  if (z.wingHits >= MA_STRYGE.wing.hits) {
    if (flying) msState(z, 'crash');
    else if (z.ss === 'prowl') msState(z, 'crawl');
  } else if (z.ss === 'windup' && amount >= z.maxHp * 0.25) msState(z, 'climb');      // un gros coup pendant le cri : elle renonce
  if (kind !== 'nuke') addPoints(RULES.pointsHit);
  return false;
}
/* Mort : points et relevés comme un zombie ; elle compte pour la manche (onZombieKilled). En l'air, elle
   tombe ; sur l'eau, elle coule ; au sol, elle s'effondre. Noyade : appelée par maStrygeTouch. */
function maStrygeKill(z, info) {
  if (!z.alive) return;
  const was = z.ss;
  z.alive = false; z.state = 'dead'; z.deathKind = info.kind;
  let pts = RULES.pointsKill;
  if (info.kind === 'knife') pts = RULES.pointsKnife; else if (info.kind === 'nuke') pts = 0; else if (info.head) pts = RULES.pointsHead;
  if (pts) addPoints(pts);
  MA_STRYGES.killed++;
  if (!info.foudre) { G.stats.kills++; Life.kill(info, MA_STRYGE_TYPE); Rank.kill(info); }   // kit 2.0.7 : la foudre (ma18) n'est pas le joueur
  if (info.head && info.kind === 'bullet') {
    G.stats.headshots++;
    Sound.headshot();
    zombieHead(z, _msH);
    z.headless = true;
    bloodBurst(_msH.x, _msH.y, _msH.z, info.dx || 0, info.dz || 0, 16, 1.2);
    for (let i = 0; i < 3; i++) spawnDebris(MAT.gib, rand(0.04, 0.08), rand(0.04, 0.08), rand(0.04, 0.08), _msH.x, _msH.y, _msH.z, rand(-2, 2) + (info.dx || 0) * 2, rand(1, 3), rand(-2, 2) + (info.dz || 0) * 2, 2.5);
  } else if (info.kind !== 'drown') maStrygeSnd('death', z.root.x, z.root.z);
  if (info.kind !== 'drown' && info.kind !== 'fall') {
    if (MS_FLY[was] || was === 'crash') { z.ss = 'fall'; z.st = 0; z.spin = rand(-3, 3); z.tumP = 0.6; z.tumR = 0; z.vel.y = Math.max(z.vel.y, 0.5); z.vel.x += (info.dx || 0) * 1.5; z.vel.z += (info.dz || 0) * 1.5; }
    else { z.ss = 'dead'; z.st = 0; z.deadRoll = rand(-0.25, 0.25); z.deadSide = Math.random() < 0.5 ? -1 : 1; addDecal('blood', z.root.x, (z.groundY ?? z.gy) + 0.003, z.root.z, 0, 1, 0, rand(0.8, 1.2)); }
    z.blendK = 9;
  }
  onZombieKilled(z, info);
  maEmit('stryge', { what: 'tuee', id: z.id, kind: info.kind });
}

/* ---------------------------------------------------------------- Effets --
   Les yeux (deux lueurs par stryge, la matière des yeux des Noyés : sans brouillard, d'au moins 4 pixels) ; la
   traînée sombre du piqué (un ruban face à la caméra, qui s'efface) ; le sang drainé (maStrygeDrainFx : les
   gouttes de sang du jeu). Tout existe dès le chargement (précompilé). */
const MS_FX = { pts: null, n: 48, trail: null, K: 6, M: 16, tr: [], col: new THREE.Color(), pre: null };
function maStrygeFxInit(root) {
  const F = MS_FX;
  if (!F.pts && MA_NG.pts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(F.n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(F.n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(F.n), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    F.pts = new THREE.Points(g, MA_NG.pts.material);
    F.pts.name = 'yeux des stryges'; F.pts.frustumCulled = false; F.pts.renderOrder = 9;
  }
  if (!F.trail) {
    // ruban : K traînées de M points, deux sommets par point ; couleur et transparence dans les sommets
    const n = F.K * F.M * 2, g = new THREE.BufferGeometry(), idx = [], uv = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
    for (let k = 0; k < F.K; k++) for (let i = 0; i < F.M; i++) {
      const v = (k * F.M + i) * 2;
      uv.set([i / (F.M - 1), 0, i / (F.M - 1), 1], v * 2);
      if (i < F.M - 1) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const c = makeCanvas(64, 64), cx = c.getContext('2d'), grd = cx.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grd; cx.fillRect(0, 0, 64, 64);
    // sans brouillard : la brume du marais blanchissait le ruban sombre (on voyait une traînée claire) ; il s'efface au loin
    const m = new THREE.MeshBasicMaterial({ map: toTex(c, { clamp: true, srgb: false }), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    _linDone.add(m);
    F.trail = new THREE.Mesh(g, m);
    F.trail.name = 'traînées des stryges'; F.trail.frustumCulled = false; F.trail.renderOrder = 4;
    for (let k = 0; k < F.K; k++) F.tr.push({ z: null, pts: [] });
  }
  if (!F.pre) {
    // éclats de membrane (spawnDebris : un objet ordinaire, pas une horde) : la matière précompilée ici
    F.pre = [MAT.maStrygeCloth, MAT.maStrygeSkin].map((m) => { const o = new THREE.Mesh(GEO.box, m); o.visible = false; o.name = 'stryge (précompilation)'; return o; });
  }
  if (root) { if (F.pts) root.add(F.pts); root.add(F.trail, ...F.pre); }
  maStrygeFxClear();
}
function maStrygeFxClear() {
  const F = MS_FX;
  if (F.pts) F.pts.geometry.setDrawRange(0, 0);
  if (F.trail) F.trail.geometry.setDrawRange(0, 0);
  for (const T of F.tr) { T.z = null; T.pts.length = 0; }
}
/* Le sang drainé : un jet de gouttes qui part de la gorge du joueur vers la gueule de la stryge (lancées pour
   y arriver en 0,25 à 0,4 s, malgré la pesanteur des gouttes de sang du jeu). */
function maStrygeDrainFx(z, C) {
  _msA.set(0, ZRIG.head - 0.06, 0.09).applyMatrix4(z.rig.neck.matrixWorld);
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), x0 = C.hx + fx * 0.6, y0 = C.hy - 0.3, z0 = C.hz + fz * 0.6;
  for (let i = 0; i < 12; i++) {
    const T = rand(0.25, 0.4), dx = _msA.x - x0, dy = _msA.y - y0, dz = _msA.z - z0;
    FX.blood.emit(x0 + rand(-0.08, 0.08), y0 + rand(-0.05, 0.05), z0 + rand(-0.08, 0.08), dx / T + rand(-0.4, 0.4), dy / T + 4.9 * T + rand(-0.3, 0.3), dz / T + rand(-0.4, 0.4), T + 0.05);
  }
}
const _msE1 = new THREE.Vector3(), _msE2 = new THREE.Vector3(), _msCam = new THREE.Vector3();
function maStrygeFxUpdate(dt, C) {
  const F = MS_FX;
  if (!F.pts || !F.trail) return;
  const P = F.pts.geometry.attributes.position.array, Cc = F.pts.geometry.attributes.aCol.array, Sz = F.pts.geometry.attributes.aSize.array;
  const cam = camera.position, col = F.col.setHex(MA_STRYGE.eye).convertSRGBToLinear(), fogD = scene.fog && scene.fog.density ? scene.fog.density : 0;
  let n = 0;
  for (const z of Zombies.list) {
    if (!z.stryge || z.removed || z.headless || (z.glow || 0) < 0.01) continue;
    const nk = z.rig.neck.matrixWorld;
    _msE1.set(-0.036, ZRIG.head - 0.003, 0.1).applyMatrix4(nk); _msE2.set(0.036, ZRIG.head - 0.003, 0.1).applyMatrix4(nk);
    _msA.set(0, 0, 1).transformDirection(nk); _msB.set(1, 0, 0).transformDirection(nk);
    const mx = (_msE1.x + _msE2.x) / 2, my = (_msE1.y + _msE2.y) / 2, mz = (_msE1.z + _msE2.z) / 2, d = Math.hypot(mx - cam.x, my - cam.y, mz - cam.z);
    if (d > 150 || my < MA.water - 0.05) continue;
    const tau = maHFogTau(mx, my, mz) + (fogD * d) * (fogD * d), vis = 0.3 + 0.7 * Math.exp(-0.55 * tau);
    const kd = 0.6 + 0.4 * owSmoothstep(0.6, 2.5, d) + 0.5 * owSmoothstep(6, 22, d);
    const k = z.glow * (z.blink > 0 ? 0 : 1) * kd * vis * 1.2;
    for (let e = 0; e < 2 && n < F.n; e++) {
      const E = e ? _msE2 : _msE1, sx = e ? 0.5 : -0.5;
      const nx = _msA.x * 0.87 + _msB.x * sx, ny = _msA.y * 0.87 + _msB.y * sx, nz = _msA.z * 0.87 + _msB.z * sx;
      const tx = cam.x - E.x, ty = cam.y - E.y, tz = cam.z - E.z, kf = owSmoothstep(-0.15, 0.35, (nx * tx + ny * ty + nz * tz) / (Math.hypot(tx, ty, tz) || 1));
      if (k * kf < 0.004) continue;
      P[n * 3] = E.x; P[n * 3 + 1] = E.y; P[n * 3 + 2] = E.z;
      Cc[n * 3] = col.r * k * kf; Cc[n * 3 + 1] = col.g * k * kf; Cc[n * 3 + 2] = col.b * k * kf;
      Sz[n] = 0.1 * (1 + 0.5 * Math.min(tau, 2.5)); n++;
    }
  }
  const g = F.pts.geometry;
  g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  g.setDrawRange(0, n);
  // traînées : pendant le piqué (et l'instant qui suit), un point toutes les 0,03 s ; elles s'effacent en 0,55 s
  const T = F.trail.geometry, TP = T.attributes.position.array, TC = T.attributes.color.array;
  for (const tr of F.tr) {
    if (tr.z && (tr.z.removed || !tr.z.stryge)) tr.z = null;
    for (let i = tr.pts.length - 1; i >= 0; i--) { tr.pts[i].a += dt; if (tr.pts[i].a > 0.55) tr.pts.splice(i, 1); }
  }
  for (const z of Zombies.list) {
    if (!z.stryge || z.removed) continue;
    const on = z.alive && (z.ss === 'dive' || (z.ss === 'climb' && z.st < 0.25));
    let tr = F.tr.find((q) => q.z === z);
    if (!tr && on) { tr = F.tr.find((q) => !q.z && !q.pts.length) || F.tr.find((q) => !q.z); if (tr) { tr.z = z; tr.pts.length = 0; } }
    if (!tr) continue;
    if (!on) { tr.z = null; continue; }
    tr.acc = (tr.acc || 0) + dt;
    if (tr.acc >= 0.03 || !tr.pts.length) { tr.acc = 0; _msA.setFromMatrixPosition(z.rig.hips.matrixWorld); tr.pts.unshift({ x: _msA.x, y: _msA.y, z: _msA.z, a: 0 }); if (tr.pts.length > F.M) tr.pts.length = F.M; }
  }
  let v = 0, used = 0;
  _msCam.copy(cam);
  for (let k = 0; k < F.K; k++) {
    const tr = F.tr[k], L = tr.pts;
    const base = k * F.M * 2;
    for (let i = 0; i < F.M; i++) {
      const o = (base + i * 2) * 3, oc = (base + i * 2) * 4;
      if (i >= L.length || L.length < 2) { for (let j = 0; j < 6; j++) TP[o + j] = 0; for (let j = 0; j < 8; j++) TC[oc + j] = 0; continue; }
      const q = L[i], q2 = L[Math.min(L.length - 1, i + 1)], q0 = L[Math.max(0, i - 1)];
      const tx = q0.x - q2.x, ty = q0.y - q2.y, tz = q0.z - q2.z, vx = _msCam.x - q.x, vy = _msCam.y - q.y, vz = _msCam.z - q.z;
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
      const sl = Math.hypot(sx, sy, sz) || 1, w = 0.32 + q.a * 1.4;
      sx = (sx / sl) * w; sy = (sy / sl) * w; sz = (sz / sl) * w;
      TP[o] = q.x - sx; TP[o + 1] = q.y - sy; TP[o + 2] = q.z - sz; TP[o + 3] = q.x + sx; TP[o + 4] = q.y + sy; TP[o + 5] = q.z + sz;
      const dc = Math.hypot(vx, vy, vz), al = 0.58 * (1 - q.a / 0.55) * (1 - 0.7 * i / F.M) * owSmoothstep(0, 1.2, dc) * (1 - owSmoothstep(14, 40, dc));
      for (const j of [0, 4]) { TC[oc + j] = 0.018; TC[oc + j + 1] = 0.01; TC[oc + j + 2] = 0.024; TC[oc + j + 3] = al; }
    }
    if (L.length >= 2) used = k + 1;
    v++;
  }
  T.attributes.position.needsUpdate = true; T.attributes.color.needsUpdate = true;
  T.setDrawRange(0, used * (F.M - 1) * 6);
}

/* ---------------------------------------------------------------- Sons --
   Cri strident et râpeux (le piqué l'annonce), sifflement, battements d'ailes (cuir : un « vlouf » grave et
   le claquement de la membrane), plongeon (souffle qui monte), morsure (craquement, grognement), drain
   (succion, bulles), membrane déchirée, douleur, chute, choc au sol, agonie, noyade ; annonce et fin de la
   manche (cloches graves, nappe grinçante, cris au loin, la nuée qui bat des ailes). Bus des effets du marais
   (maNoyeOut), sinon celui du jeu. */
function maStrygeSnd(kind, x, zz, k = 1) {
  try {
    const at = (vol, ref, dur) => maNoyeOut(x, zz, vol * k, ref, dur);
    switch (kind) {
      case 'screech': {
        const o = at(0.5, 16, 1.4); if (!o) return;
        const f0 = rand(980, 1150), dur = rand(0.62, 0.8);
        mnVoice(o, o.t, dur, f0, f0 * 0.62, { mid: f0 * 1.32, midAt: 0.25, am: rand(36, 48), amD: 0.7, formants: [[2400, 3, 1], [3700, 6, 0.55], [1250, 4, 0.45]], lp: 6500, lvl: 0.34, att: 0.015, hold: 0.45 });
        mnVoice(o, o.t + 0.02, dur * 0.9, 170, 120, { am: 24, amD: 0.8, formants: [[700, 3, 1], [1500, 5, 0.4]], lp: 1600, lvl: 0.14, att: 0.04 });
        for (let i = 0; i < 9; i++) mnNoise(o, o.t + dur * 0.8 + i * 0.028, 0.012, 'highpass', 3200, null, 0.8, 0.16, 0.001);
        break;
      }
      case 'emerge': {
        // elle sort de l'éclair (ma19) : un cri long et perçant qui monte d'abord, plus rauque que celui du piqué, un
        // grondement dessous, puis un râle sifflant
        const o = at(1.2, 26, 2.2); if (!o) return;
        const f0 = rand(880, 980), dur = rand(1.15, 1.35);
        mnVoice(o, o.t + 0.04, dur, f0, f0 * 0.66, { mid: f0 * 1.6, midAt: 0.16, am: rand(40, 50), amD: 0.75, vib: 7, vibA: 22, formants: [[2500, 3, 1], [3800, 6, 0.6], [1300, 4, 0.45]], lp: 7000, lvl: 0.36, att: 0.02, hold: 0.55 });
        mnVoice(o, o.t + 0.06, dur * 0.95, f0 * 1.005, f0 * 0.67, { mid: f0 * 1.58, midAt: 0.17, am: 47, amD: 0.6, formants: [[2900, 4, 1]], lp: 6500, lvl: 0.12, att: 0.03, hold: 0.5 });
        mnVoice(o, o.t + 0.05, dur * 0.9, 150, 105, { am: 22, amD: 0.85, formants: [[650, 3, 1], [1400, 5, 0.4]], lp: 1600, lvl: 0.18, att: 0.05 });
        mnNoise(o, o.t + dur * 0.85, 0.7, 'bandpass', 3400, 2200, 1.4, 0.12, 0.06);
        break;
      }
      case 'hiss': {
        const o = at(0.32, 9, 1.2); if (!o) return;
        mnNoise(o, o.t, 0.9, 'bandpass', 3200, 2300, 1.6, 0.22, 0.08);
        mnVoice(o, o.t + 0.05, 0.7, 260, 210, { am: 30, amD: 0.6, formants: [[2200, 3, 1]], lp: 4000, lvl: 0.07, att: 0.1 });
        break;
      }
      case 'flap': {
        const o = at(0.42, 8, 0.6); if (!o) return;
        mnNoise(o, o.t, 0.22, 'lowpass', 700, 180, 0.7, 0.42, 0.03);
        mnTone(o, 'sine', 75, 42, o.t + 0.02, 0.18, 0.26, 0.02);
        mnNoise(o, o.t + 0.13, 0.05, 'bandpass', 1900, null, 1.2, 0.12, 0.003);
        break;
      }
      case 'dive': {
        const o = at(0.55, 14, 1.4); if (!o) return;
        mnNoise(o, o.t, 1.0, 'bandpass', 420, 2400, 1.3, 0.36, 0.25);
        mnNoise(o, o.t + 0.1, 0.8, 'lowpass', 300, 900, 0.7, 0.2, 0.2);
        break;
      }
      case 'bite': {
        const o = at(0.7, 7, 1); if (!o) return;
        mnNoise(o, o.t, 0.05, 'bandpass', 1700, null, 2, 0.6, 0.002);
        mnNoise(o, o.t + 0.03, 0.2, 'lowpass', 900, 250, 0.8, 0.35, 0.01);
        mnVoice(o, o.t + 0.02, 0.42, 150, 115, { am: 26, amD: 0.8, formants: [[650, 3, 1], [1400, 5, 0.4]], lp: 2000, lvl: 0.3, att: 0.02 });
        break;
      }
      case 'drain': {
        const o = at(0.55, 7, 1.2); if (!o) return;
        mnVoice(o, o.t + 0.12, 0.55, 230, 160, { am: 9, amD: 0.9, formants: [[480, 4, 1], [1050, 6, 0.5]], lp: 1500, lvl: 0.24, att: 0.05 });
        for (let i = 0; i < 5; i++) mnBubble(o, o.t + 0.15 + i * rand(0.07, 0.11), rand(220, 420), rand(0.04, 0.07), 0.22);
        break;
      }
      case 'rip': {
        const o = at(0.62, 10, 0.8); if (!o) return;
        mnNoise(o, o.t, 0.17, 'bandpass', 2800, 1100, 2, 0.5, 0.004);
        for (let i = 0; i < 6; i++) mnNoise(o, o.t + i * 0.022 + rand(0, 0.01), 0.012, 'highpass', 2600, null, 0.8, 0.25, 0.001);
        mnVoice(o, o.t + 0.04, 0.28, 1250, 850, { am: 40, amD: 0.6, formants: [[2500, 4, 1]], lp: 5000, lvl: 0.16, att: 0.01 });
        break;
      }
      case 'hurt': {
        const o = at(0.45, 12, 0.6); if (!o) return;
        mnVoice(o, o.t, 0.3, rand(1250, 1400), 900, { am: 38, amD: 0.6, formants: [[2600, 4, 1], [1300, 4, 0.4]], lp: 5500, lvl: 0.26, att: 0.01 });
        break;
      }
      case 'crash': {
        const o = at(0.6, 16, 1.5); if (!o) return;
        mnVoice(o, o.t, 1.05, 1350, 520, { am: 44, amD: 0.75, formants: [[2400, 3, 1], [1200, 4, 0.5]], lp: 5000, lvl: 0.32, att: 0.01, hold: 0.3 });
        for (let i = 0; i < 6; i++) mnNoise(o, o.t + i * 0.13, 0.12, 'lowpass', 800, 250, 0.7, 0.3, 0.02);
        break;
      }
      case 'thud': {
        const o = at(0.6, 8, 0.6); if (!o) return;
        mnTone(o, 'sine', 95, 42, o.t, 0.2, 0.5, 0.003);
        mnNoise(o, o.t, 0.14, 'lowpass', 750, 180, 0.8, 0.4, 0.003);
        break;
      }
      case 'death': {
        const o = at(0.55, 14, 1.8); if (!o) return;
        mnVoice(o, o.t, 1.1, 1200, 300, { mid: 1350, midAt: 0.12, am: 26, amD: 0.75, formants: [[2200, 3, 1], [1100, 4, 0.5]], lp: 4200, lvl: 0.32, att: 0.01 });
        mnVoice(o, o.t + 0.6, 0.6, 140, 90, { am: 18, amD: 0.8, formants: [[500, 3, 1]], lp: 1000, lvl: 0.16, att: 0.05 });
        break;
      }
      case 'drown': {
        const o = at(0.6, 12, 3); if (!o) return;
        maSplashSnd(x, zz, 0.9);
        for (let i = 0; i < 3; i++) mnVoice(o, o.t + 0.15 + i * 0.7, 0.55, rand(950, 1150), rand(600, 700), { am: 18, amD: 0.85, formants: [[1800, 3, 1], [900, 4, 0.5]], lp: 1700, lvl: 0.24 * (1 - i * 0.25), att: 0.02 });
        for (let i = 0; i < 14; i++) mnBubble(o, o.t + 0.3 + i * rand(0.09, 0.16), rand(180, 420), rand(0.04, 0.08), 0.3 * (1 - i / 16));
        break;
      }
      case 'sink': {
        const o = at(0.3, 8, 2); if (!o) return;
        for (let i = 0; i < 8; i++) mnBubble(o, o.t + i * rand(0.15, 0.25), rand(120, 280), rand(0.05, 0.09), 0.28 * (1 - i / 9));
        break;
      }
      case 'round': {
        // l'annonce : des cloches graves, une nappe qui grince, des cris au loin, la nuée qui bat des ailes
        const o = maNoyeOut(null, null, 0.9, 9, 7); if (!o) return;
        for (const [dt, f, l] of [[0, 92.5, 0.3], [0, 98, 0.18], [1.9, 69.3, 0.28]]) { mnTone(o, 'sine', f, f * 0.995, o.t + dt, 3.6, l, 0.005); mnTone(o, 'sine', f * 2.76, f * 2.74, o.t + dt, 1.6, l * 0.3, 0.005); }
        mnVoice(o, o.t + 0.2, 5.2, 55, 55, { wave: 'sawtooth', formants: [[180, 1.5, 1], [420, 3, 0.3]], lp: 420, lvl: 0.12, att: 1.6, hold: 0.6 });
        mnVoice(o, o.t + 0.2, 5.2, 58.3, 58.3, { wave: 'sawtooth', formants: [[180, 1.5, 1]], lp: 420, lvl: 0.1, att: 1.6, hold: 0.6 });
        for (const [dt, f] of [[0.7, 1050], [1.5, 1180], [2.3, 960], [3.1, 1120]]) mnVoice(o, o.t + dt, 0.7, f, f * 0.62, { mid: f * 1.3, midAt: 0.25, am: 42, amD: 0.7, formants: [[2400, 3, 1], [1250, 4, 0.4]], lp: 2600, lvl: 0.09, att: 0.02, hold: 0.4 });
        mnNoise(o, o.t + 0.5, 3.2, 'lowpass', 260, 520, 0.7, 0.16, 1.2);
        for (let i = 0; i < 10; i++) mnNoise(o, o.t + 1 + i * 0.26 + rand(0, 0.08), 0.2, 'lowpass', 600, 200, 0.7, 0.07, 0.03);
        break;
      }
      case 'roundEnd': {
        const o = maNoyeOut(null, null, 0.8, 9, 5); if (!o) return;
        [[0, 98], [0.35, 146.8], [0.7, 196], [1.1, 233.1]].forEach(([dt, f]) => { mnTone(o, 'sine', f, f * 0.996, o.t + dt, 2.6, 0.22, 0.005); mnTone(o, 'sine', f * 2.76, f * 2.75, o.t + dt, 1.2, 0.06, 0.005); });
        mnVoice(o, o.t + 0.2, 1.2, 900, 380, { am: 30, amD: 0.7, formants: [[2000, 3, 1]], lp: 1800, lvl: 0.06, att: 0.02 });
        break;
      }
      default: break;
    }
  } catch (e) { /* son facultatif */ }
}
/* Les voix des plus proches (trois) : cris et sifflements de temps en temps ; les battements d'ailes (à chaque
   descente des ailes, à moins de 22 m). */
function maStrygesVoices(dt, C) {
  const cam = camera.position, near = [];
  for (const z of Zombies.list) {
    if (!z.stryge || !z.alive || z.hidden) continue;
    const d = Math.hypot(z.root.x - cam.x, z.root.y - cam.y, z.root.z - cam.z);
    if (d < 45) near.push([d, z]);
    // battements : la phase passe le haut de sa course
    const ph = ((z.wph % TAU) + TAU) % TAU, prev = z.lastPh === undefined ? ph : z.lastPh;
    z.lastPh = ph;
    if (MS_FLY[z.ss] && d < 22 && prev < Math.PI / 2 && ph >= Math.PI / 2 && (z.glide || 0) < 0.5 && z.ss !== 'dive') z.flapDue = true;
  }
  near.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < near.length; i++) {
    const [d, z] = near[i];
    if (z.flapDue) { z.flapDue = false; if (i < 3) maStrygeSnd('flap', z.root.x, z.root.z, z.ss === 'climb' || z.ss === 'takeoff' ? 1.3 : 0.85); }
    if (i >= 3) continue;
    z.screechT -= dt;
    if (z.screechT <= 0 && (z.ss === 'circle' || z.ss === 'prowl' || z.ss === 'crawl')) { z.screechT = rand(4, 9); maStrygeSnd(Math.random() < 0.45 ? 'screech' : 'hiss', z.root.x, z.root.z, Math.random() < 0.5 ? 0.6 : 0.85); }
  }
}

/* ---------------------------------------------------------------- Partie, carte, F8 -- */
function maStrygesReset() {
  Object.assign(MA_STRYGES, { spawned: 0, killed: 0, drowned: 0, crashed: 0, bites: 0, rounds: 0, lastDive: -9, hint: false, hintRoof: false, indoorT: 0 });
  maStrygeFxClear();
  if (typeof maArrReset === 'function' && MA_ARRS.ready) maArrReset();
}
function maStrygeDiag() {
  const by = {};
  let n = 0;
  for (const z of Zombies.list) if (z.stryge && !z.removed) { n++; by[z.ss] = (by[z.ss] || 0) + 1; }
  const S = MA_STRYGES, list = Object.keys(by).map((k) => `${by[k]} ${MA_STRYGE_ST[k] || k}`).join(', ');
  const plan = G.dogs && !G.dogs.off ? G.dogs.plan.filter((r) => r > G.round).slice(0, 3) : [];
  const now = G.dogRound && maStrygeRoundOn() ? `manche spéciale en cours (${G.killed}/${G.total})` : plan.length ? `prochaine manche spéciale : ${plan.join(', ')}` : 'manche spéciale : à tirer';
  const arr = typeof MA_ARRS !== 'undefined' ? ` · arrivées dans l'éclair rouge ${MA_ARRS.n} (en cours ${MA_ARRS.list.length})` : '';
  return `stryges : ${n}${n ? ` (${list})` : ''} · ${now} · en piqué à la fois : ${MA_STRYGE.attackers(G.dogs ? G.dogs.n : 0)} · sorties ${S.spawned}, tuées ${S.killed} (dont ${S.drowned} noyées), écrasées ${S.crashed}, morsures ${S.bites}${arr}`;
}
