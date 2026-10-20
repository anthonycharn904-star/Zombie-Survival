/* ======================================================================= 17 GESTES ==
   Rechargements et boisson d'atout retravaillés (jeu 2.0.6, demande d'Anthony du 19 octobre 2026), avec la
   préhension (section 15) et ses bras (section 16).
   · Boisson : la main droite prend chaque fiole par le solveur de la préhension, sur sa vraie forme
     (ballon, calebasse) : paume posée contre le verre, doigts enroulés, pouce opposé, sans traverser.
     Avant, la prise était celle du jeu 1.9.0 (une pose fixe, la même pour toutes les fioles) : la base du
     pouce entrait de 16 à 24 mm dans le verre pendant toute la boisson.
   ============================================================================ */
const GE_FIOLE = {}, GE_FIOLE_MARGE = { gourd: 0.002 };
/* Prise de la main droite sur une fiole de forme kind (repère de la fiole : fond au centre, y vers le
   goulot) : { p, q, pose, fit }, calculée une fois par forme. Départ : la prise du jeu 1.9.0 (dos de la
   main à droite, doigts autour du ventre, pouce vers le goulot). */
function geBottleHold(kind) {
  if (GE_FIOLE[kind]) return GE_FIOLE[kind];
  const V = (x, y, z) => new THREE.Vector3(x, y, z), f = [-0.15, 0.05, -1], u = [0, 1, 0.15];
  const base = handWrap(V(0, 0.05, 0), V(...f), V(...u), false, 0.046, 0.03, 'bottle');
  const H = { p: base.p.clone(), q: base.q.clone(), pose: HAND_POSES.bottle, fit: null };
  try {
    const id = Object.keys(ELIXIRS).find((k) => (ELIXIRS[k].vial || 'flask') === kind) || 'souffle';
    const root = { userData: { parts: { fiole: buildBottle(id) } } };
    const key = { p: base.p.toArray(), d: f, u, pose: 'bottle' };
    prFitGrip(root, 'fiole', key, false);
    H.p.fromArray(key.p); H.q = handBasis(V(...key.d), V(...key.u), false); H.pose = key.pose; H.fit = key._pr;
  } catch (e) { console.warn('prise de la fiole', kind, e); }
  // sa main (section 16) a la peau de la paume un peu plus épaisse que la nôtre : sur la calebasse, elle
  // entrait de 1,7 mm dans le verre ; la main s'écarte de 2 mm (mesure sur les sommets de sa peau : 0 mm)
  const marge = GE_FIOLE_MARGE[kind] || 0;
  if (marge) H.p.addScaledVector(V(0, 1, 0).applyQuaternion(H.q), marge);
  GE_FIOLE[kind] = H;
  return H;
}
/* Fin du lancer (après le lâcher) : la main garde la prise de la fiole lâchée et tourne encore de
   (th, ps, la) en sortant de la vue. Jeu 1.9.0 : th −0,8, la −0,4 (la main se rabattait vers la paume,
   poignet plié de 110 à 140°) ; ici elle se relève : flexion de 10 à 56°, inclinaison de ±16° au plus. */
const GE_SUIT = { th: 0.6, ps: 0, la: 0.4 };

/* ------------------------------------------------------------- mouvements continus
   Rechargements (et réarmements) du jeu 1.9.0 : chaque segment entre deux clés était adouci en début et en
   fin (smoothstep) : la main ou l'arme s'arrêtait à chaque clé (mouvement par à-coups). Ici, les mains et
   l'arme passent par les mêmes clés sur une courbe continue (Hermite ; tangente d'une clé : vers la clé
   suivante depuis la précédente, à l'échelle des temps), départ et arrivée du clip en douceur. Une clé
   marquée stop: true s'arrête ; un segment à l'adoucissement explicite (e : 'i', 'o', 'l', 'snap' : chocs,
   claques, culasse lâchée) garde l'ancien calcul. Mêmes clés, mêmes temps, mêmes événements. */
const GE = { tension: 0.85 };
const _geP = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _geQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const _geH = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
/* Segment de la piste encadrant t : indices i (début), j (fin), u linéaire. */
function geSeg(keys, t) {
  const n = keys.length;
  if (!n) return null;
  if (t <= keys[0].t) return { i: 0, j: 0, u: 0 };
  if (t >= keys[n - 1].t) return { i: n - 1, j: n - 1, u: 0 };
  let i = 0;
  while (i < n - 2 && t >= keys[i + 1].t) i++;
  return { i, j: i + 1, u: clamp((t - keys[i].t) / Math.max(1e-6, keys[i + 1].t - keys[i].t), 0, 1) };
}
const geSmoothSeg = (b) => !b.e || b.e === 'io';
/* Facteur de la tangente de la clé k (0 : arrêt) : premières et dernières clés, clés stop, et voisins en
   choc (l'arrivée sur une claque reste nette). */
function geTanK(keys, k) {
  const n = keys.length;
  if (k <= 0 || k >= n - 1 || keys[k].stop) return 0;
  if (!geSmoothSeg(keys[k]) || !geSmoothSeg(keys[k + 1])) return 0;
  if (keys[k + 1].t - keys[k - 1].t < 1e-6) return 0;
  return GE.tension * (keys[k + 1].t - keys[k].t > 1e-6 && keys[k].t - keys[k - 1].t > 1e-6 ? 1 : 0);
}
/* Hermite sur des composantes : a, b valeurs ; ma, mb tangentes (déjà à l'échelle du segment). */
function geHerm(a, b, ma, mb, u) {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * ma + (-2 * u3 + 3 * u2) * b + (u3 - u2) * mb;
}
/* Main d'un côté au temps t (remplace le calcul de rlHand) : { a, b, s } (poses des doigts), ou null. */
function geHand(c, side, gun, t, outP, outQ) {
  geAttach(c);
  const K = c[side];
  if (!K || !K.length) return null;
  const sg = geSeg(K, t), a = K[sg.i], b = K[sg.j];
  const hold = gunHold(gun)[side].pose;
  _geHoldNow = gunHold(gun)[side];
  geTient(side, a, b, sg.i === sg.j ? 0 : sg.u);
  const pz = (k) => ((k.pose === 'press' || (k.pose === 'thumbPush' && (k.f || 'hold') === 'hold')) ? gePress(hold)
    : k.pose && typeof k.pose === 'object' ? k.pose : k.pose ? HAND_POSES[k.pose] : hold);
  rlHandAt(a, gun, side, _rlA);
  if (sg.i === sg.j) { outP.copy(_rlA.p); outQ.copy(_rlA.q); return { a: pz(a), b: pz(a), s: 0 }; }
  rlHandAt(b, gun, side, _rlB);
  // main posée sur une même pièce (ou sur l'arme) d'une clé à l'autre : elle suit la pièce exactement (le glissement
  // éventuel se fait dans le repère de la pièce), sans courbe qui l'en écarterait
  const fa = a.f || 'hold', fb = b.f || 'hold';
  if (fa === fb && fa !== 'cam' && (fa === 'hold' || (a.p && b.p && Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) < 0.015))) {
    const s = (RL_EASE[b.e || 'io'] || RL_EASE.io)(sg.u);
    outP.lerpVectors(_rlA.p, _rlB.p, s); outQ.copy(_rlA.q).slerp(_rlB.q, s);
    return { a: pz(a), b: pz(b), s };
  }
  if (!geSmoothSeg(b)) {
    const s = (RL_EASE[b.e] || RL_EASE.io)(sg.u);
    outP.lerpVectors(_rlA.p, _rlB.p, s); outQ.copy(_rlA.q).slerp(_rlB.q, s);
    return { a: pz(a), b: pz(b), s };
  }
  const n = K.length, i0 = Math.max(0, sg.i - 1), i3 = Math.min(n - 1, sg.j + 1);
  const ka = geTanK(K, sg.i), kb = geTanK(K, sg.j), dT = b.t - a.t;
  _geP[1].copy(_rlA.p); _geP[2].copy(_rlB.p); _geQ[1].copy(_rlA.q); _geQ[2].copy(_rlB.q);
  if (ka) { rlHandAt(K[i0], gun, side, _geH); _geP[0].copy(_geH.p); _geQ[0].copy(_geH.q); }
  if (kb) { rlHandAt(K[i3], gun, side, _geH); _geP[3].copy(_geH.p); _geQ[3].copy(_geH.q); }
  // quaternions dans le même hémisphère que le début du segment
  for (const q of _geQ) if (q.dot(_geQ[1]) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const sa = ka ? (ka * dT) / (b.t - K[i0].t) : 0, sb = kb ? (kb * dT) / (K[i3].t - a.t) : 0;
  for (const ax of ['x', 'y', 'z']) {
    const ma = sa ? (_geP[2][ax] - _geP[0][ax]) * sa : 0, mb = sb ? (_geP[3][ax] - _geP[1][ax]) * sb : 0;
    outP[ax] = geHerm(_geP[1][ax], _geP[2][ax], ma, mb, sg.u);
  }
  for (const ax of ['x', 'y', 'z', 'w']) {
    const ma = sa ? (_geQ[2][ax] - _geQ[0][ax]) * sa : 0, mb = sb ? (_geQ[3][ax] - _geQ[1][ax]) * sb : 0;
    outQ[ax] = geHerm(_geQ[1][ax], _geQ[2][ax], ma, mb, sg.u);
  }
  outQ.normalize();
  return geApproach(side, a, b, pz(a), pz(b), sg.u, dT, outP);
}
/* Dégagement et approche : une main qui quitte une prise (arme, pièce) s'en écarte d'abord du côté du dos de la
   main, doigts détendus ; une main qui va saisir arrive de ce côté et ne referme les doigts qu'à la fin (comme
   une vraie main : elle ne traverse pas la pièce en changeant de pose). Pas pour une main qui reste sur la même
   pièce, ni pour un segment court. Renvoie la pose des doigts { a, b, s }. */
const GE_APPROCHE = { h: 0.035, minT: 0.12 };
const _gePose = { R: { f: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], s: [0, 0, 0, 0], t: [0, 0, 0, 0, 0] }, L: { f: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], s: [0, 0, 0, 0], t: [0, 0, 0, 0, 0] } };
const _geN = new THREE.Vector3();
const geContact = (k) => (k.f || 'hold') !== 'cam' && !(k.f === 'gun' && k.pose === 'relax');
function geMixPose(out, A, B, k) {
  for (let i = 0; i < 4; i++) { for (let j = 0; j < 3; j++) out.f[i][j] = lerp(A.f[i][j], B.f[i][j], k); out.s[i] = lerp(A.s[i] || 0, B.s[i] || 0, k); }
  for (let j = 0; j < 5; j++) out.t[j] = lerp(A.t[j] || 0, B.t[j] || 0, k);
  return out;
}
/* Prise ouverte d'une clé : celle calculée pour la prise (tenue de l'arme, pièce), sinon l'ouverture par défaut. */
let _geHoldNow = null;
function geOpenOf(k, P) {
  if (k.open) return k.open;
  if ((k.f || 'hold') === 'hold' && _geHoldNow && _geHoldNow.pose === P && _geHoldNow.open) return _geHoldNow.open;
  return geOpen(P);
}
/* Direction de dégagement ou d'approche : v (repère de la clé : pièce, arme ou vue) si la prise en donne une
   (chargeur : vers le bas, hors du puits ; chargeur latéral : par son bout extérieur), sinon le dos de la main. */
const _geFq = new THREE.Quaternion(), _geQi = new THREE.Quaternion();
function geDir(k, hq, v) {
  if (!v || !k.qL) return _geN.set(0, 1, 0).applyQuaternion(hq);
  _geFq.copy(hq).multiply(_geQi.copy(k.qL).invert());
  return _geN.fromArray(v).normalize().applyQuaternion(_geFq);
}
/* Pouce qui appuie (bouton du chargeur, clé d'ouverture) sans lâcher la prise : seul le pouce se plie un peu. */
const _gePress = new WeakMap();
function gePress(h) {
  let p = _gePress.get(h);
  if (!p) { const t = h.t || [0, 0, 0, 0, 0]; p = { f: h.f, s: h.s, t: [t[0], t[1], (t[2] || 0) + 0.12, (t[3] || 0) + 0.1, t[4] || 0] }; _gePress.set(h, p); }
  return p;
}
/* Prise ouverte : la même prise, doigts presque dépliés et pouce un peu plus écarté, du même côté de la pièce (il
   ne la traverse pas en s'ouvrant ; la pose détendue le ramenait le long de l'index, à travers la pièce). */
const _geOpen = new WeakMap();
function geOpen(P) {
  let o = _geOpen.get(P);
  if (!o) {
    // pouce : il s'ouvre dans le plan de la paume, loin des doigts (flexion de la base réduite) et revient un peu
    // vers ce plan (l'abduction palmaire le porterait vers la pièce tenue)
    const t = P.t || [0, 0, 0, 0, 0];
    o = { f: P.f.map((f) => f.map((x) => x * 0.3)), s: (P.s || [0, 0, 0, 0]).slice(), t: [(t[0] || 0) * 0.7, (t[1] || 0) * 0.2 - 0.15, (t[2] || 0) * 0.3, (t[3] || 0) * 0.3, t[4] || 0] };
    _geOpen.set(P, o);
  }
  return o;
}
/* Main qui tient une pièce : une clé « dans la vue » (f: 'cam') posée à l'instant où la pièce est elle-même posée
   dans la vue, avec la même prise que la clé suivante ou précédente de la main dans le repère de cette pièce, devient
   une clé dans le repère de la pièce. La main reste alors attachée à la pièce d'une clé à l'autre (avant, main et
   pièce suivaient chacune leur interpolation et se séparaient en chemin : doigts dans le chargeur). Fait une fois
   par clip. */
function geAttach(c) {
  if (c._geAttach) return;
  c._geAttach = true;
  const M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), H = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
  for (const side of ['L', 'R']) {
    const K = c[side];
    if (!K) continue;
    K.forEach((k, i) => {
      if (k.f !== 'cam' || !k.qL) return;
      for (const nb of [K[i + 1], K[i - 1]]) {
        if (!nb || !nb.f || nb.f === 'cam' || nb.f === 'hold' || nb.f === 'gun' || !nb.qL) continue;
        const pk = (c.parts[nb.f] || []).find((x) => x.f === 'cam' && Math.abs(x.t - k.t) < 0.003);
        if (!pk) continue;
        // prise impliquée par la clé de la main et la pose de la pièce, dans le repère de la pièce
        M.compose(_rlV(pk.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(pk.r[0], pk.r[1], pk.r[2])), one);
        H.compose(_rlV(k.p), k.qL, one);
        Mi.copy(M).invert().multiply(H);
        const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        Mi.decompose(p, q, s);
        if (p.distanceTo(_rlV(nb.p)) > 0.01 || q.angleTo(nb.qL) > 0.1) continue;
        k.f = nb.f; k.p = nb.p.slice(); k.qL = nb.qL; k.pose = nb.pose; k.ap = nb.ap; k.ret = nb.ret; k.open = nb.open; k._attache = true;
        break;
      }
    });
  }
}
function geApproach(side, a, b, pa, pb, u, dT, outP) {
  const same = (a.f || 'hold') === (b.f || 'hold') && (!a.p || !b.p || Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) < 0.015);
  const ret = geContact(a) && !same && dT >= GE_APPROCHE.minT, app = geContact(b) && !same && dT >= GE_APPROCHE.minT;
  if (!ret && !app) return { a: pa, b: pb, s: smooth(u) };
  // la main s'écarte du côté de son dos (+y de son repère) une fois la prise desserrée, et revient de ce côté
  const r = ret ? smooth(clamp((u - 0.08) / 0.22, 0, 1)) * (1 - smooth(clamp((u - 0.35) / 0.35, 0, 1))) : 0;
  const q = app ? smooth(clamp((u - 0.35) / 0.3, 0, 1)) * (1 - smooth(clamp((u - 0.7) / 0.2, 0, 1))) : 0;
  if (r) outP.addScaledVector(geDir(a, _rlA.q, a.ret), GE_APPROCHE.h * r);
  if (q) outP.addScaledVector(geDir(b, _rlB.q, b.ap), GE_APPROCHE.h * q);
  // doigts : la prise se desserre sur place au départ (0 à 0,18), se referme à l'arrivée (0,84 à 1)
  const oa = ret ? geOpenOf(a, pa) : pa, ob = app ? geOpenOf(b, pb) : pb, P = _gePose[side];
  if (ret && u < 0.18) return { a: geMixPose(P, pa, oa, smooth(u / 0.18)), b: null, s: 0 };
  if (app && u > 0.84) return { a: geMixPose(P, ob, pb, smooth((u - 0.84) / 0.16)), b: null, s: 0 };
  const u0 = ret ? 0.18 : 0, u1 = app ? 0.84 : 1;
  return { a: geMixPose(P, oa, ob, smooth(clamp((u - u0) / (u1 - u0), 0, 1))), b: null, s: 0 };
}
/* Décalage de l'arme au temps t (remplace le calcul de rlGun) : [dx, dy, dz, rx, ry, rz]. */
function geGun(c, t, out) {
  out.fill(0);
  const K = c.gun;
  if (!K || !K.length) return out;
  const sg = geSeg(K, t), a = K[sg.i], b = K[sg.j];
  const val = (k, i) => (i < 3 ? (k.p ? k.p[i] : 0) : (k.r ? k.r[i - 3] : 0));
  if (sg.i === sg.j) { for (let i = 0; i < 6; i++) out[i] = val(a, i); return out; }
  if (!geSmoothSeg(b)) { const s = (RL_EASE[b.e] || RL_EASE.io)(sg.u); for (let i = 0; i < 6; i++) out[i] = lerp(val(a, i), val(b, i), s); return out; }
  const n = K.length, k0 = K[Math.max(0, sg.i - 1)], k3 = K[Math.min(n - 1, sg.j + 1)];
  const ka = geTanK(K, sg.i), kb = geTanK(K, sg.j), dT = b.t - a.t;
  const sa = ka ? (ka * dT) / (b.t - k0.t) : 0, sb = kb ? (kb * dT) / (k3.t - a.t) : 0;
  for (let i = 0; i < 6; i++) {
    const ma = sa ? (val(b, i) - val(k0, i)) * sa : 0, mb = sb ? (val(k3, i) - val(a, i)) * sb : 0;
    out[i] = geHerm(val(a, i), val(b, i), ma, mb, sg.u);
  }
  return out;
}
/* Masse de l'arme pendant un rechargement : son décalage suit celui du clip par un ressort amorti
   (pulsation 26 rad/s, amortissement 0,8 : un léger retard, un léger dépassement aux arrêts nets). */
const GE_MASSE = { w: 26, z: 0.8, x: [0, 0, 0, 0, 0, 0], v: [0, 0, 0, 0, 0, 0], clip: null, out: [0, 0, 0, 0, 0, 0] };
function geGunInertia(go, clip, dt) {
  const M = GE_MASSE;
  if (!clip || clip !== M.clip || !dt) { M.clip = clip; for (let i = 0; i < 6; i++) { M.x[i] = go[i]; M.v[i] = 0; } return go; }
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let k = 0; k < n; k++) for (let i = 0; i < 6; i++) {
    M.v[i] += (M.w * M.w * (go[i] - M.x[i]) - 2 * M.z * M.w * M.v[i]) * h;
    M.x[i] += M.v[i] * h;
  }
  for (let i = 0; i < 6; i++) M.out[i] = M.x[i];
  return M.out;
}

/* ------------------------------------------------------------- poignets dans leurs limites
   Une clé de rechargement (jeu 1.9.0, ou prise recalculée) peut demander à la main une orientation que l'avant-bras
   ne peut pas suivre, quel que soit le coude : le poignet se pliait de 90 à 180° (main de la Trench repliée sur la
   cartouche, main de la MG42 rabattue sur le couvercle, main de la PPSh retournée sur la culasse…). Ici, quand le
   poignet sortirait de ses limites, la main tourne autour du point qu'elle tient (centre de la prise), juste assez
   pour y revenir ; une pièce portée par la main (cartouche, chargeur, roquette hors de l'arme) tourne avec elle.
   Le coude est ensuite choisi pour cette orientation. Rechargements et réarmements seulement.
   Rien ne change en deçà des limites (radians) : extension (dos de la main vers l'avant-bras) 55°, flexion 60°,
   inclinaison cubitale 30°, radiale 15° ; au-delà, l'angle sature en douceur, sur doux (10°), sans cassure (pas
   d'à-coup quand la main y arrive) ; une dernière passe, exacte, le borne à butee de plus, malgré les lissages.
   piv : centre de la prise dans le repère de la main ; lisse : part de la correction rattrapée à chaque image (pas
   de saut quand le coude change de côté). */
const GE_POIGNET = { ext: [-1.05, 0.96], uln: [-0.26, 0.52], doux: 0.17, butee: 0.05, piv: [0, -0.028, -0.062], lisse: 0.3 };
const geDoux = (x, lo, hi, m) => (x > hi ? hi + m * Math.tanh((x - hi) / m) : x < lo ? lo - m * Math.tanh((lo - x) / m) : x);
const _geTient = { R: { part: null, w: 0, hold: 0 }, L: { part: null, w: 0, hold: 0 } };
/* Pièce tenue par la main d'un côté pendant le segment (a → b, u) : son nom et le poids de la prise ; hold : part
   de la prise de l'arme (la main qui tient l'arme par sa prise n'est jamais corrigée : elle suit l'arme). */
function geTient(side, a, b, u) {
  const T = _geTient[side], pa = gePieceDe(a), pb = gePieceDe(b);
  T.hold = _geHoldNow && _geHoldNow.free ? 0 : ((a.f || 'hold') === 'hold' ? 1 - u : 0) + ((b.f || 'hold') === 'hold' ? u : 0);   // main libre (pistolet) : sa « prise » est hors champ
  T.part = null; T.w = 0;
  if (pa && pa === pb) { T.part = pa; T.w = 1; }
  else if (pa && 1 - u >= u) { T.part = pa; T.w = 1 - u; }
  else if (pb) { T.part = pb; T.w = u; }
  else if (pa) { T.part = pa; T.w = 1 - u; }
}
const gePieceDe = (k) => { const f = k.f || 'hold'; return f === 'hold' || f === 'gun' || f === 'cam' ? null : f; };
const _gwS = new THREE.Vector3(), _gwD = new THREE.Vector3(), _gwN = new THREE.Vector3(), _gwE = new THREE.Vector3(), _gwP = new THREE.Vector3();
const _gwF = new THREE.Vector3(), _gwH = new THREE.Vector3(), _gwT = new THREE.Vector3(), _gwV = new THREE.Vector3(), _gwC = new THREE.Vector3();
const _gwQ = new THREE.Quaternion(), _gwQi = new THREE.Quaternion(), _gwR = new THREE.Quaternion(), _gwR2 = new THREE.Quaternion(), _gwQ1 = new THREE.Quaternion();
const _gwPos = new THREE.Vector3(), _gwM = new THREE.Matrix4(), _gwM2 = new THREE.Matrix4(), _gwSc = new THREE.Vector3(), _gwI = new THREE.Quaternion();
/* Meilleur coude pour la main en (pos, quat), comme prSolveArm, sans toucher au bras. */
function geCoude(arm, pos, quat, out) {
  const a = HAND.upper, b = HAND.fore;
  const S = _gwS.copy(arm.shoulder), D = _gwD.subVectors(pos, S);
  let d = D.length();
  const maxd = (a + b) * 0.985;
  if (d > maxd) { S.addScaledVector(D, (d - maxd) / d); d = maxd; }
  d = Math.max(d, Math.abs(a - b) + 0.02);
  D.subVectors(pos, S).normalize();
  const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const N0 = _gwN.copy(arm.pole).addScaledVector(D, -arm.pole.dot(D));
  if (N0.lengthSq() < 1e-8) return null;
  N0.normalize();
  let bc = Infinity;
  for (let sw = -1.3; sw <= 1.3001; sw += 0.1) {
    _gwE.copy(S).addScaledVector(D, a * ca).addScaledVector(_gwP.copy(N0).applyQuaternion(_gwQ.setFromAxisAngle(D, sw)), a * sa);
    const c = prElbowCost(arm, S, _gwE, pos, quat, sw);
    if (c < bc) { bc = c; out.copy(_gwE); }
  }
  return out;
}
/* Rotation (repère de la vue) qui ramène le poignet dans ses limites pour un coude en E : out, ou null si le
   poignet y est déjà. */
function geSoulage(arm, pos, quat, E, out, dur = false) {
  const L = GE_POIGNET, sx = arm.left ? -1 : 1, b = L.butee;
  const fh = _gwH.subVectors(pos, E).normalize().applyQuaternion(_gwQi.copy(quat).invert());   // avant-bras, repère de la main
  const ext = Math.atan2(-fh.y, -fh.z), uln = Math.atan2(-sx * fh.x, -fh.z);
  const m = L.doux + b;
  const e2 = dur ? clamp(ext, L.ext[0] - m, L.ext[1] + m) : geDoux(ext, L.ext[0], L.ext[1], L.doux);
  const u2 = dur ? clamp(uln, L.uln[0] - m, L.uln[1] + m) : geDoux(uln, L.uln[0], L.uln[1], L.doux);
  if (Math.abs(e2 - ext) < 1e-5 && Math.abs(u2 - uln) < 1e-5) return null;
  _gwT.set(-sx * Math.tan(u2), -Math.tan(e2), -1).normalize();
  _gwR.setFromUnitVectors(_gwT, fh);                         // main : q' = q·r (l'avant-bras y est en _gwT)
  return out.copy(quat).multiply(_gwR).multiply(_gwQi);      // q·r·q⁻¹
}
/* Bras d'un côté vers (P, Q) (repère de la vue), poignet gardé dans ses limites pendant un clip ; P et Q sont
   corrigés sur place, la pièce portée suit. */
function geSolveArm(arm, P, Q, auto, clip, side, gun) {
  const rel = arm._geRel || (arm._geRel = new THREE.Quaternion());
  if (!auto || !clip || !gun) { rel.identity(); prSolveArm(arm, P, Q, auto); return; }
  // correction visée : deux passes (le coude change avec l'orientation de la main)
  const piv = gePivot(arm).applyQuaternion(Q).add(P);
  _gwR2.identity(); _gwPos.copy(P); _gwQ1.copy(Q);
  for (let it = 0; it < 2; it++) {
    if (!geCoude(arm, _gwPos, _gwQ1, _gwV)) break;
    const d = geSoulage(arm, _gwPos, _gwQ1, _gwV, _gwQ);
    if (!d) break;
    _gwR2.premultiply(d);
    _gwQ1.copy(_gwR2).multiply(Q);
    _gwPos.copy(P).sub(piv).applyQuaternion(_gwR2).add(piv);
  }
  const libre = 1 - _geTient[side].hold;
  if (libre < 1) _gwR2.slerp(_gwI.identity(), 1 - libre);
  if (_gwR2.dot(rel) < 0) _gwR2.set(-_gwR2.x, -_gwR2.y, -_gwR2.z, -_gwR2.w);
  rel.slerp(_gwR2, GE_POIGNET.lisse);
  const tot = _gwR2.copy(rel);
  if (1 - Math.abs(rel.w) > 1e-7) { P.sub(piv).applyQuaternion(rel).add(piv); Q.premultiply(rel); }
  prSolveArm(arm, P, Q, auto);
  // dernière passe, exacte, pour le coude retenu (lissages de la correction et du coude en retard sur un geste vif)
  let fin = libre > 0.001 ? geSoulage(arm, P, Q, arm.elbow.position, _gwQ, true) : null;
  if (fin && libre < 1) fin = fin.slerp(_gwI.identity(), 1 - libre);
  if (fin) {
    tot.premultiply(fin);
    P.sub(piv).applyQuaternion(fin).add(piv); Q.premultiply(fin);
    gePsiSolve(arm, P, Q);
  }
  if (1 - Math.abs(tot.w) > 1e-7) {
    // pièce portée par la main (hors de l'arme : dans la vue) : elle tourne avec la main
    const T = _geTient[side], part = T.part && gun.userData.parts[T.part], tr = T.part && clip.c.parts && clip.c.parts[T.part];
    if (part && tr && T.w > 0) {
      const sp = rlSpan(tr, clip.t);
      const wp = !sp ? 0 : sp[0] === sp[1] ? (sp[0].f === 'cam' ? 1 : 0) : (sp[0].f === 'cam' ? 1 - sp[2] : 0) + (sp[1].f === 'cam' ? sp[2] : 0);
      const w = T.w * wp;
      if (w > 1e-3) {
        _gwI.identity().slerp(tot, w);
        part.updateMatrixWorld(true);
        part.matrixWorld.decompose(_gwT, _gwQ, _gwSc);
        _gwT.sub(piv).applyQuaternion(_gwI).add(piv);
        _gwQ.premultiply(_gwI);
        _gwM.compose(_gwT, _gwQ, _gwSc);
        _gwM2.copy(part.parent.matrixWorld).invert().multiply(_gwM);
        _gwM2.decompose(part.position, part.quaternion, _gwSc);
        part.updateMatrixWorld(true);
      }
    }
  }
}
/* Centre de la rotation, dans le repère de la main (pose des doigts déjà posée) : le point pincé entre les pulpes de
   l'index et du pouce quand elles se touchent presque (levier, cartouche : la pièce reste entre les doigts), sinon
   le centre de la prise (paume). */
const _gwW = new THREE.Matrix4(), _gwA = new THREE.Vector3(), _gwB = new THREE.Vector3();
function gePivot(arm) {
  const h = arm.hand, F = HAND.fingers[0], TH = HAND.thumb;
  h.wrist.updateMatrixWorld(true);
  _gwW.copy(h.wrist.matrixWorld).invert();
  const I = h.fingers[0][2].localToWorld(_gwA.set(0, -F.r[2] * 0.9, -F.L[2] * 0.6)).applyMatrix4(_gwW);
  const T = h.thumb[2].localToWorld(_gwB.set(0, -TH.r[2] * 0.9, -TH.L[2] * 0.6)).applyMatrix4(_gwW);
  const w = 1 - smooth(clamp((I.distanceTo(T) - 0.025) / 0.02, 0, 1));
  return _gwC.fromArray(GE_POIGNET.piv).lerp(I.add(T).multiplyScalar(0.5), w);
}
/* Bras vers (pos, quat) avec le coude déjà choisi (arm.psi), sans nouvelle recherche. */
function gePsiSolve(arm, pos, quat) {
  const a = HAND.upper, b = HAND.fore;
  const S = _gwS.copy(arm.shoulder), D = _gwD.subVectors(pos, S);
  const d = D.length(), maxd = (a + b) * 0.985;
  if (d > maxd) S.addScaledVector(D, (d - maxd) / d);
  D.subVectors(pos, S).normalize();
  const N0 = _gwN.copy(arm.pole).addScaledVector(D, -arm.pole.dot(D));
  if (N0.lengthSq() < 1e-8) { solveArm(arm, pos, quat); return; }
  N0.normalize();
  const save = _gwP.copy(arm.pole);
  arm.pole.copy(N0).applyQuaternion(_gwQi.setFromAxisAngle(D, arm.psi || 0));
  solveArm(arm, pos, quat);
  arm.pole.copy(save);
}

/* ------------------------------------------------------------- prises des pièces du rechargement
   Chaque pièce saisie est prise par le solveur de la préhension (paume posée, doigts enroulés, pouce opposé),
   contre la pièce et le reste de l'arme (prFitReload). Chargeurs droits : main gauche sur le flanc gauche, doigts
   autour de l'avant, assez bas pour ne pas toucher le puits (y : hauteur sous l'entrée du puits) ; chargeurs
   latéraux (Type 100, FG42) : paume sous le chargeur, doigts autour de l'avant, pouce dessus ; leviers : pincés
   entre l'index et le pouce. */
(function () {
  const rc = (id, o) => { const P = PRISES[id]; if (!P) return; P.recharge = Object.assign(P.recharge || {}, o); };
  rc('mp40', { chargeur: { modele: 'chargeur', y: -0.075 } });
  rc('thompson', { chargeur: { modele: 'chargeur', y: -0.085 } });
  rc('stg44', { chargeur: { modele: 'chargeur', y: -0.085 } });
  rc('bar', { chargeur: { modele: 'chargeur', y: -0.045 }, levier: { modele: 'levier', out: [-1, 0, 0], point: [-0.016, 0, 0] } });
  rc('g43', { chargeur: { modele: 'chargeur', y: -0.038 }, levier: { modele: 'levier', out: [-1, 0, 0], point: [-0.0145, 0, 0] } });
  rc('ppsh', { chargeur: { modele: 'chargeur', y: -0.1 }, levier: { modele: 'levier', out: [1, 0, 0], point: [0.012, 0, 0] } });
  rc('type100', { chargeur: { paume: [-0.11, -0.012, -0.012], doigts: [0, 0.3, -1], pouce: [-1, 0.25, 0] }, levier: { modele: 'levier', out: [1, 0, 0], point: [0.012, 0, 0] } });
  rc('fg42', { chargeur: { paume: [-0.085, -0.015, 0.0], doigts: [0, 0.3, -1], pouce: [-1, 0.25, 0] } });
  rc('m1911', { chargeur: { modele: 'chargeur', y: 0.012 } });
})();

/* Claque sous le chargeur (Thompson, BAR, G43, M1911) : main à plat, pouce collé le long de l'index (la pose
   « à plat » du jeu 1.9.0 écartait le pouce vers la paume : il entrait dans le chargeur). Directions de dégagement
   et d'approche des chargeurs (repère du chargeur). */
const GE_PLAT = { f: [[0.12, 0.1, 0.06], [0.12, 0.1, 0.06], [0.14, 0.12, 0.07], [0.16, 0.14, 0.08]], s: [-0.02, 0, 0.02, 0.05], t: [0.04, -0.06, 0.04, 0.02, 0] };
/* Claque : le talon de la main (côté auriculaire) frappe le culot du chargeur, paume vers le haut, doigts vers
   l'avant ; le pouce passe à côté du chargeur (repère du chargeur : culot en y = bas, centre en z = zc). */
function geSlap(yBas, zc) {
  const d = [0.1, 0, -1], u = [-1, 0.1, 0], q = handBasis(_rlV(d), _rlV(u), true), lm = _rlV(PR_REP.heel);
  lm.x = -lm.x;                                                              // main gauche
  const p = new THREE.Vector3(0, yBas - 0.002, zc).sub(lm.applyQuaternion(q));
  return { p: p.toArray(), d, u, pose: GE_PLAT };
}
const GE_CLAQUES = { thompson: [-0.189, 0], bar: [-0.071, 0], g43: [-0.055, 0], m1911: [-0.007, -0.016] };
(function () {
  for (const id in RELOADS) {
    const o = RELOADS[id].cfg;
    if (!o) continue;
    if (o.slap && GE_CLAQUES[id]) o.slap = geSlap(...GE_CLAQUES[id]);
    else if (o.slap) o.slap.pose = GE_PLAT;
    if (!o.grip) continue;
    if (id === 'type100' || id === 'fg42') { o.grip.ret = [-1, -0.3, 0]; o.grip.ap = [-1, -0.3, 0]; }   // chargeur latéral, engagé par la gauche
    else if (id === 'raygun' || id === 'blaster') o.grip.ret = [0, 1, 0];                               // cellule engagée par le dessus
    else o.grip.ret = [-0.5, -1, 0];                                                                    // chargeur droit : la main glisse vers le bas
  }
})();

/* ------------------------------------------------------------- prises ouvertes, calculées
   Ouvrir une prise sans traverser la pièce dépend de la prise : un pouce posé le long de la pièce s'en écarte en
   revenant vers le plan de la paume, un pouce qui fait le tour d'un garde-main doit s'écarter davantage. Pour
   chaque prise (tenue de l'arme, pièces), une fois : plusieurs ouvertures candidates (doigts dépliés ; pouce
   plus ou moins écarté, déplié), essayées contre l'arme ou la pièce (et le reste de l'arme) le long du chemin
   depuis la prise ; la plus ouverte qui ne traverse rien est gardée (sinon la prise elle-même : la main
   s'écarte sans s'ouvrir). */
const GE_OPEN_T = [
  (t) => [t[0] * 0.7, t[1] * 0.2 - 0.15, t[2] * 0.3, t[3] * 0.3, t[4]],
  (t) => [t[0] + 0.3, t[1], t[2] * 0.3, t[3] * 0.3, t[4]],
  (t) => [t[0] + 0.3, t[1] - 0.25, t[2] * 0.3, t[3] * 0.3, t[4]],
  (t) => [t[0], t[1] - 0.35, t[2] * 0.3, t[3] * 0.3, t[4]],
  (t) => [t[0], t[1], t[2] * 0.3, t[3] * 0.3, t[4]],
  (t) => [t[0] - 0.25, t[1] - 0.2, t[2] * 0.4, t[3] * 0.4, t[4]],
];
const GE_OPEN_F = [0.3, 0.55, 0.8];
function geOpenFit(P, T, wristP, wristQ, left) {
  try {
    const hand = _prHands[left ? 'L' : 'R'] || (_prHands[left ? 'L' : 'R'] = buildHand(left)), w = hand.wrist;
    w.position.copy(wristP); w.quaternion.copy(wristQ); w.updateMatrixWorld(true);
    const c = hand.body.localToWorld(new THREE.Vector3(0, -0.01, -0.06)), G = triGrid(trisNear(T, c, 0.15), c, 0.16);
    const hits = (pose) => {
      setHandPose(hand, pose); w.updateMatrixWorld(true);
      let n = 0;
      hand.fingers.forEach((bs, i) => bs.forEach((b, j) => { if (prPen(G, b, HAND.fingers[i].L[j], HAND.fingers[i].r[j], j === 2, 0.8)) n++; }));
      hand.thumb.forEach((b, j) => { if (j && prPen(G, b, HAND.thumb.L[j], HAND.thumb.r[j], j === 2, 0.8)) n++; });
      return n;
    };
    const base = hits(P), t0 = (P.t || [0, 0, 0, 0, 0]).map((x) => x || 0), tmp = { f: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], s: [0, 0, 0, 0], t: [0, 0, 0, 0, 0] };
    for (const kf of GE_OPEN_F) for (const ft of GE_OPEN_T) {
      const O = { f: P.f.map((f) => f.map((x) => x * kf)), s: (P.s || [0, 0, 0, 0]).slice(), t: ft(t0) };
      let ok = true;
      for (const k of [0.34, 0.67, 1]) if (hits(geMixPose(tmp, P, O, k)) > base) { ok = false; break; }
      if (ok) return O;
    }
  } catch (e) { console.warn('prise ouverte', e); }
  return P;
}
/* Prises ouvertes d'une arme : tenue (les deux mains) et pièces du rechargement (chargeur, levier, claque). */
function geOpenWeapon(root) {
  const ud = root.userData, h = gunHold(root);
  if (ud._geOpen || !h) return;
  ud._geOpen = true;
  const T = new Float32Array(gunTris(root));
  for (const S of ['L', 'R']) {
    const k = h[S];
    if (k && !k.free && k.pose && !k.open) k.open = geOpenFit(k.pose, T, k.p, k.q, S === 'L');
  }
  const o = RELOADS[ud.id] && RELOADS[ud.id].cfg;
  if (!o) return;
  const piece = (key, part, left) => {
    if (!key || key.open || !ud.parts[part] || !key.d) return;
    const P = typeof key.pose === 'object' ? key.pose : HAND_POSES[key.pose];
    if (!P) return;
    const Tp = prPartTris(ud.parts[part]), Tb = prBodyTris(root, ud.parts[part]), A = new Float32Array(Tp.length + Tb.length);
    A.set(Tp); A.set(Tb, Tp.length);
    key.open = geOpenFit(P, A, _rlV(key.p), handBasis(_rlV(key.d), _rlV(key.u || [0, 1, 0]), left), left);
  };
  piece(o.grip, 'mag', true);
  if (o.bolt) piece(o.bolt.grip, o.bolt.part, (o.bolt.side || 'L') === 'L');
}

/* ------------------------------------------------------------- pièces propres à certaines armes
   Kar98k, Trench, Double canon, MG42, Désintégrateur, Onde de choc : leurs clips (jeu 1.9.0) posent les mains sur
   leurs pièces avec des prises fixes. Une fois le clip construit, chaque clé de main posée sur une pièce reçoit
   une prise ajustée par le solveur, contre la pièce et le reste de l'arme (calculée une fois par arme, pièce et
   pose) : levier (pincé entre l'index et le pouce), main entière (paume posée, doigts enroulés), pincée (pulpes de
   l'index et du pouce sur les faces de la pièce les plus proches de l'ancienne prise : l'intention du geste est
   gardée), à plat (paume posée sur la surface). Une clé « pouce poussé » garde la prise, le pouce se plie. Temps,
   durées et événements du clip ne changent pas. */
const GE_PIECES = {
  kar98k: { R: { 'bolt/pinch': { mode: 'levier', decl: { modele: 'levier', out: [1, 0, 0], point: [0.0425, -0.0265, 0.061] } },
    'clip/pinch': { mode: 'pince' }, 'rounds/thumbPush': { mode: 'pince' }, 'round/pinch': { mode: 'pince' }, 'round/thumbPush': { mode: 'pince', de: 'round/pinch' },
    'gun/relax': { mode: 'degage', gun: true } } },
  trench: { L: { 'shell/pinch': { mode: 'pince' }, 'shell/thumbPush': { mode: 'pince', de: 'shell/pinch' } } },
  dbarrel: { L: { 'load/mag': { mode: 'pince' } } },
  mg42: { L: { 'cover/pinch': { mode: 'pince' }, 'mag/mag': { mode: 'entiere' }, 'cover/flat': { mode: 'plat' }, 'gun/flat': { mode: 'plat', gun: true } },
    R: { 'bolt/pinch': { mode: 'levier', decl: { modele: 'levier', out: [1, 0, 0], point: [0.018, 0, 0] } } } },
  raygun: { L: { 'mag/pinch': { mode: 'pince' } } },
  blaster: { L: { 'mag/mag': { mode: 'entiere' } }, R: { 'crank/fist': { mode: 'entiere' } } },
};
const _geFits = {};
function geRootOf(ud) { const p = Object.values(ud.parts || {})[0]; let o = p; while (o && o.userData !== ud) o = o.parent; return o; }
function gePieceTris(root, part) {
  const Tp = prPartTris(part), Tb = prBodyTris(root, part), A = new Float32Array(Tp.length + Tb.length);
  A.set(Tp); A.set(Tb, Tp.length);
  return A;
}
/* Pincée déduite d'une ancienne prise : pulpes de l'index et du pouce posées sur les points de la pièce les plus
   proches de leur ancienne place (boîte de la pièce, face la plus proche). */
function gePinceDecl(part, key, left) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), hand = _prHands[left ? 'L' : 'R'] || (_prHands[left ? 'L' : 'R'] = buildHand(left)), w = hand.wrist;
  const q = handBasis(V(...key.d), V(...(key.u || [0, 1, 0])), left);
  w.position.fromArray(key.p); w.quaternion.copy(q);
  setHandPose(hand, HAND_POSES.pinch); w.updateMatrixWorld(true);
  const F = HAND.fingers[0], TH = HAND.thumb;
  const tipI = hand.fingers[0][2].localToWorld(V(0, -F.r[2] * 0.9, -F.L[2] * 0.6)), tipT = hand.thumb[2].localToWorld(V(0, -TH.r[2] * 0.9, -TH.L[2] * 0.6));
  const T = prPartTris(part), box = new THREE.Box3();
  for (let i = 0; i < T.length; i += 3) box.expandByPoint(V(T[i], T[i + 1], T[i + 2]));
  const onFace = (p) => {
    const c = p.clone().clamp(box.min, box.max), n = V(0, 0, 0);
    if (c.distanceTo(p) > 1e-6) { n.subVectors(p, c).normalize(); return { p: c, n }; }
    // dedans : vers la face la plus proche
    let best = Infinity, ax = 0, sg = 1;
    for (const a of ['x', 'y', 'z']) for (const s of [-1, 1]) { const d = s > 0 ? box.max[a] - p[a] : p[a] - box.min[a]; if (d < best) { best = d; ax = a; sg = s; } }
    c[ax] = sg > 0 ? box.max[ax] : box.min[ax]; n[ax] = sg;
    return { p: c, n };
  };
  const I = onFace(tipI), Th = onFace(tipT);
  // la pièce au bout des doigts : l'articulation de l'index à 5 cm en arrière de sa pulpe, un peu du côté du dos
  const f = V(...key.d).normalize(), dos = V(0, 1, 0).applyQuaternion(q);
  const anchor = I.p.clone().addScaledVector(f, -0.05).addScaledVector(dos, 0.012);
  return { index: anchor.toArray(), doigts: key.d.slice(), pouce: (key.u || [0, 1, 0]).slice(),
    pince: { index: I.p.toArray(), pouce: Th.p.toArray(), face: I.n.multiplyScalar(-1).toArray() } };
}
/* Paume posée sur une surface (main à plat) : la main recule le long de son dos jusqu'à ne plus rien traverser. */
function gePlat(T, key, left, pose = GE_PLAT) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), hand = _prHands[left ? 'L' : 'R'] || (_prHands[left ? 'L' : 'R'] = buildHand(left)), w = hand.wrist;
  const q = handBasis(V(...key.d), V(...(key.u || [0, 1, 0])), left), dos = V(0, 1, 0).applyQuaternion(q), p0 = V(...key.p);
  w.quaternion.copy(q); setHandPose(hand, pose);
  for (let s = 0; s <= 0.05; s += 0.002) {
    w.position.copy(p0).addScaledVector(dos, s); w.updateMatrixWorld(true);
    const c = hand.body.localToWorld(V(0, -0.01, -0.06)), G = triGrid(trisNear(T, c, 0.15), c, 0.16);
    let n = 0;
    hand.fingers.forEach((bs, i) => bs.forEach((b, j) => { if (prPen(G, b, HAND.fingers[i].L[j], HAND.fingers[i].r[j], j === 2, 0.8)) n++; }));
    hand.thumb.forEach((b, j) => { if (j && prPen(G, b, HAND.thumb.L[j], HAND.thumb.r[j], j === 2, 0.8)) n++; });
    if (!n && !palmHit(G, hand)) return { p: w.position.toArray(), d: key.d, u: key.u, pose };
  }
  return { p: key.p, d: key.d, u: key.u, pose };
}
function geFitPiece(ud, part, side, name, sp, key) {
  const id = ud.id, ck = id + '|' + side + '|' + name;
  if (_geFits[ck] !== undefined) return _geFits[ck];
  let out = null;
  try {
    const root = geRootOf(ud), P = part === 'gun' ? root : ud.parts[part], left = side === 'L';
    if (root && P && key.d) {
      const T = sp.gun ? new Float32Array(gunTris(root)) : gePieceTris(root, P), k = { p: key.p.slice(), d: key.d.slice(), u: (key.u || [0, 1, 0]).slice(), pose: key.pose === 'thumbPush' ? 'pinch' : key.pose };
      if (sp.mode === 'plat') out = gePlat(T, k, left);
      else if (sp.mode === 'degage') out = gePlat(T, k, left, typeof k.pose === 'object' ? k.pose : HAND_POSES[k.pose] || HAND_POSES.relax);
      else {
        let decl = null;
        if (sp.mode === 'levier') decl = prExpandPiece(root, part, Object.assign({ left }, sp.decl));
        else if (sp.mode === 'pince') decl = gePinceDecl(P, k, left);
        prFitGrip(root, part, k, left, decl, { corps: true });
        out = { p: k.p, d: k.d, u: k.u, pose: k.pose, fit: k._pr };
      }
      out.qL = handBasis(_rlV(out.d), _rlV(out.u || [0, 1, 0]), left);
      const P0 = typeof out.pose === 'object' ? out.pose : HAND_POSES[out.pose];
      if (P0) out.open = geOpenFit(P0, T, _rlV(out.p), out.qL, left);
    }
  } catch (e) { console.warn('prise de pièce', id, part, e); }
  _geFits[ck] = out;
  return out;
}
function geRefit(c, ud) {
  const spec = GE_PIECES[ud.id];
  if (!c || !spec || c._geRefit) return c;
  c._geRefit = true;
  geAttach(c);
  for (const side of ['L', 'R']) {
    const S = spec[side];
    if (!S) continue;
    for (const k of c[side] || []) {
      if (!k.f || k.f === 'cam' || k.f === 'hold') continue;
      const name = k.f + '/' + (typeof k.pose === 'string' ? k.pose : ''), sp = S[name];
      if (!sp) continue;
      const g = geFitPiece(ud, k.f, side, sp.de || name, sp, k);
      if (!g) continue;
      const push = k.pose === 'thumbPush';
      k.p = g.p.slice(); k.d = g.d; k.u = g.u; k.qL = g.qL; k.pose = push && typeof g.pose === 'object' ? gePress(g.pose) : g.pose; k.open = g.open;
    }
  }
  return c;
}
(function () {
  for (const id in GE_PIECES) {
    const R = RELOADS[id];
    if (!R) continue;
    for (const fn of ['clip', 'cycle']) {
      const orig = R[fn];
      if (!orig) continue;
      R[fn] = (s, ud) => {
        const c = geRefit(orig(s, ud), ud);
        if (c && c.rebuild) { const rb = c.rebuild; c.rebuild = (i) => geRefit(rb(i), ud); }
        return c;
      };
    }
  }
})();
