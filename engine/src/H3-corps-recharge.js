/* ================================================================ 18 RECHARGEMENT DU CORPS ==
   Rechargements et réarmements du corps d'Anthony (vue TPS, ombre, coop) : jeu 2.0.6, demande d'Anthony du
   19 octobre 2026 (« le personnage 3D complet n'effectue pratiquement aucun mouvement visible »).
   Causes trouvées : son modèle (hero.update) repose à chaque image l'arme dans sa garde basse et les deux mains
   dessus ; l'ancien geste ne déplaçait que la main gauche autour de cette arme immobile, et rien pour une arme
   tenue d'une main (M1911, Désintégrateur : pas d'étalonnage, le geste s'arrêtait) ; ni torse, ni tête, ni doigts.
   Ici :
   · un double de l'arme (fantôme, hors de la scène) rejoue le clip de la vue FPS au même instant (geGun, rlParts,
     geHand) : arme, pièces et cibles des deux mains, dans le repère de la vue. Il ne dépend que de l'arme, du clip et
     du temps du clip : les mêmes étapes aux mêmes instants que la vue FPS (munitions comprises), et un autre joueur
     (coop) se rejoue de même ;
   · cette scène est posée devant sa poitrine (repère du rechargement : sa poitrine, son cap, une part du regard),
     l'arme y est placée, et ses bras la rejoignent par sa propre cinématique (ses épaules, ses longueurs) ;
   · ses mains prennent l'orientation des nôtres par leurs repères anatomiques (doigts, côté du pouce, paume :
     persoMainsK), pas en copiant des rotations ; quand notre main tient l'arme par sa prise, la sienne reprend sa
     propre prise (poignée, garde-main) ; une main qui va à la poche va à ses porte-chargeurs (hanche avant gauche) ;
     une pièce portée (chargeur, cartouche, roquette, cellule) suit sa main ; ses doigts (quatre ensemble, deux
     articulations, et le pouce : son modèle n'en a pas plus) suivent la prise de nos doigts ;
   · le torse se penche sur l'arme et tourne vers la poche, la tête regarde le geste ;
   · fondus depuis et vers sa garde basse (ou sa visée) ; rechargement interrompu : retour en un quart de seconde.
   Réarmements entre deux tirs (levier du Kar98k, pompe de la Trench) : le même geste, sur l'arme là où il la tient.
   Les jambes gardent leur animation (marche, course, accroupi) : seuls le torse, la tête et les bras changent.
   ============================================================================ */
const PERSO_RL = {
  entree: 0.3, sortie: 0.32,                  // fondus (s) depuis et vers la garde basse (au plus 30 % du clip)
  // garde du rechargement (repère de son modèle, comme ses poses d'arme : poignée r, tangage (− : canon vers le bas),
  // lacet (+ : vers sa gauche), roulis ; vrille : buste tourné (− : vers sa droite)) : l'arme à hauteur du bas de la
  // poitrine, un peu à droite, canon vers l'avant gauche ; le buste se tourne un peu vers sa droite : le geste se voit
  // depuis la caméra TPS (derrière l'épaule droite) au lieu de se faire devant son ventre, caché par son dos
  garde: { r: [-0.13, 1.28, 0.3], pitch: -0.2, yaw: 0.42, roll: 0.12, vrille: -0.2 },
  // gardes propres à une arme (et amplitude, fondu d'entrée) : le Panzerschreck se recharge tube en travers du corps,
  // canon vers sa droite, l'arrière du tube devant sa main gauche (la vue FPS le fait pivoter pour la même raison)
  // priseG : pièces que la main gauche tient comme sa prise (la pompe de la Trench)
  // fixe : amplitude gardée (la garde fait déjà ce que fait le pivot de la vue FPS)
  // armes longues (un mètre et plus, pompe ou garde-main loin devant) : poignée contre la hanche droite, crosse sous le
  // bras, canon à 45° vers l'avant gauche : sa main gauche (ses bras sont 9 cm plus courts que ceux de la vue FPS) atteint
  // la pompe et le garde-main ; cette garde sert aussi quand la main gauche tient sa prise (tenue : false ; dans sa garde
  // basse, sa main gauche n'atteint pas le garde-main d'une arme longue)
  gardes: {
    panzer: { r: [-0.2, 1.08, 0.4], pitch: 0, yaw: -1.2, roll: 0, vrille: 0, ampleur: 0, fixe: true, entree: 0.45 },
    trench: { r: [-0.2, 1.13, 0.16], pitch: -0.15, yaw: 0.75, roll: 0.1, vrille: 0, tenue: false },
    dbarrel: { r: [-0.2, 1.13, 0.16], pitch: -0.15, yaw: 0.75, roll: 0.1, vrille: 0, tenue: false },
    mg42: { r: [-0.2, 1.13, 0.16], pitch: -0.15, yaw: 0.75, roll: 0.1, vrille: 0, tenue: false },
    blaster: { vrille: 0 },                       // la manivelle se tourne buste de face (poignet droit)
  },
  // la garde du rechargement ne vaut que quand la main gauche a quitté sa prise (pompe, garde-main, poignée avant) :
  // avant et après, l'arme reste dans sa garde basse (sa main gauche n'atteindrait pas la pompe d'une arme levée)
  ampleur: 0.4, ampleurCyc: 0.7,              // part du mouvement de l'arme de la vue FPS (qui la présente à la caméra)
  tangage: 0.25,                              // part du regard haut/bas du joueur
  poche: [0.13, 1.065, 0.14],                 // dessus de ses porte-chargeurs (repère de son modèle : gauche +x, avant +z)
  pocheY: [-0.32, -0.46],                     // main de la vue FPS plus basse que ça (y du poignet, repère de la vue) : à la poche
  penche: 0.14, tourne: 0.3,                  // torse : penché sur l'arme, tourné vers la poche (rad)
  regard: 0.7,                                // la tête suit le geste (angle au plus, rad)
  paume: 0.004,                               // sa paume est 4 mm plus courte que la nôtre (articulations des doigts alignées)
  repli: 0.62,                                // une main plus près de son épaule que ça (part de la longueur du bras) éloigne la scène
  torse: { rx: 0.23, rz: 0.15, rzDos: 0.24, zc: -0.01, y: [0.9, 1.52], marge: 0.03 },   // volume du torse et des épaules (repère du modèle ; dos : veste, équipement)
  degage: [-0.55, 0, 0.84],                   // la crosse sort du torse vers sa droite et l'avant (sous le bras)
};
const _pcM = new THREE.Matrix4(), _pcM2 = new THREE.Matrix4(), _pcM3 = new THREE.Matrix4(), _pcMv = new THREE.Matrix4(), _pcMg = new THREE.Matrix4();
const _pcQ = new THREE.Quaternion(), _pcQ2 = new THREE.Quaternion(), _pcE = new THREE.Euler(), _pcV = new THREE.Vector3(), _pcV2 = new THREE.Vector3();
const _pcS = new THREE.Vector3(), _pcUn = new THREE.Vector3(1, 1, 1), _pcG = [0, 0, 0, 0, 0, 0];
const PERSO_RL_OS = ['armR', 'foreR', 'handR', 'armL', 'foreL', 'handL'];

/* Repères de ses mains : K tel que (notre poignet) · K = (son os de la main), par les axes anatomiques (doigts,
   côté du pouce, paume) mesurés sur son squelette au repos (os de la main, articulation des doigts, pouce). */
function persoMainsK(av) {
  if (av.mainK) return av.mainK;
  const sk = av.hero.skeleton, inv = {};
  sk.bones.forEach((b, i) => { inv[b.name] = new THREE.Matrix4().copy(sk.boneInverses[i]).invert(); });
  const pos = (n) => new THREE.Vector3().setFromMatrixPosition(inv[n]), K = {};
  for (const S of ['L', 'R']) {
    const qi = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(inv['hand' + S])).invert();
    const f = pos('fing' + S).sub(pos('hand' + S)).normalize().applyQuaternion(qi);
    const t = pos('thumb2' + S).sub(pos('thumb' + S)).normalize().applyQuaternion(qi);
    t.addScaledVector(f, -t.dot(f)).normalize();
    const fo = new THREE.Vector3(0, 0, -1), to = new THREE.Vector3(S === 'L' ? 1 : -1, 0, 0);
    const Bh = new THREE.Matrix4().makeBasis(f, t, f.clone().cross(t)), Bo = new THREE.Matrix4().makeBasis(fo, to, fo.clone().cross(to));
    K[S] = new THREE.Quaternion().setFromRotationMatrix(Bo.multiply(Bh.transpose()));
  }
  return (av.mainK = K);
}

/* Décalage (monde) d'un os par rapport à sa place au repos dans son modèle : accroupi, sa poitrine descend de 35 cm ;
   la garde suit sa poitrine, la poche son bassin, le volume du torse sa colonne. */
function persoDecale(av, n, out = _psV()) {
  if (!av.bindPos) {
    av.bindPos = {};
    const sk = av.hero.skeleton;
    sk.bones.forEach((b, i) => { av.bindPos[b.name] = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[i]).invert()); });
  }
  const o = av.hero.object;
  return av.hero.bones[n].getWorldPosition(out).sub(o.localToWorld(av.bindPos[n].clone()));
}
/* Fantôme : un double de l'arme dans un support, hors de la scène (repère de la vue FPS). */
function persoFantome(av, id, tier) {
  const key = id + ':' + tier;
  if (av.rlf && av.rlf.key === key) return av.rlf;
  const root = new THREE.Group(), holder = new THREE.Group(), gun = buildGun(id, tier);
  root.add(holder); holder.add(gun);
  return (av.rlf = { key, root, holder, gun, p: { R: new THREE.Vector3(), L: new THREE.Vector3() }, q: { R: new THREE.Quaternion(), L: new THREE.Quaternion() }, h: {}, T: {}, c: null, t: 0 });
}
/* Part de la prise de l'arme dans le segment en cours d'une piste de main (0 à 1). */
function persoTenue(c, S, t) {
  const K = c[S];
  if (!K || !K.length) return 1;
  const sg = geSeg(K, t), a = K[sg.i], b = K[sg.j], u = sg.i === sg.j ? 0 : sg.u;
  return ((a.f || 'hold') === 'hold' ? 1 - u : 0) + ((b.f || 'hold') === 'hold' ? u : 0);
}
/* Le clip de la vue FPS rejoué sur le fantôme au temps t : arme (comme updateViewmodel, à la hanche, sans balancement
   ni visée), pièces, cibles et poses des deux mains. */
function persoRejoue(F, clip) {
  const gun = F.gun, info = gun.userData.info, c = clip.c, t = clip.t, H = F.holder;
  const hip = info.hip, hr = info.hipRot || [0, 0.05, 0.03];
  H.position.set(hip[0], hip[1], hip[2]); H.rotation.set(hr[0], hr[1], hr[2]);
  const go = geGun(c, t, _pcG);
  if (go[3] || go[4] || go[5]) {
    _pcQ.setFromEuler(_pcE.set(go[3], go[4], go[5]));
    const pc = _pcV.fromArray(c.pivot || [0, 0, 0]).applyQuaternion(H.quaternion).add(H.position);
    H.position.sub(pc).applyQuaternion(_pcQ).add(pc);
    H.quaternion.premultiply(_pcQ);
  }
  H.position.x += go[0]; H.position.y += go[1]; H.position.z += go[2];
  F.root.updateMatrixWorld(true);
  rlParts(c, gun, t);
  gun.updateMatrixWorld(true);
  for (const S of ['R', 'L']) {
    const hold = gunHold(gun)[S];
    let pose = rlHand(c, S, gun, t, F.p[S], F.q[S]);
    const vide = !pose;
    if (vide) { heldTarget(gun, hold, F.p[S], F.q[S]); pose = { a: hold.pose, b: null, s: 0 }; }
    F.h[S] = pose;
    F.T[S] = vide ? { part: null, w: 0, hold: 1 } : { part: _geTient[S].part, w: _geTient[S].w, hold: persoTenue(c, S, t) };
  }
  F.c = c; F.t = t;
}
/* Dégagement : l'arme du rechargement ne doit pas entrer dans son torse ni ses épaules (la crosse, quand l'arme pivote
   vers sa gauche comme dans la vue FPS) : recul nécessaire (m, vers l'avant de son corps) pour des points répartis dans
   la boîte de l'arme, contre une colonne elliptique autour de sa colonne vertébrale. */
function persoDegage(av, F, G) {
  const o = av.hero.object, T = PERSO_RL.torse;
  if (!F.box) {
    const b = new THREE.Box3(), inv = new THREE.Matrix4().copy(F.gun.matrixWorld).invert(), v = new THREE.Vector3();
    F.gun.updateMatrixWorld(true);
    F.gun.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox, M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < 8; i++) b.expandByPoint(v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(M));
    });
    F.box = b;
  }
  const ds = persoDecale(av, 'spine'), oi = new THREE.Matrix4().copy(o.matrixWorld).invert();
  const b = F.box, M = new THREE.Matrix4().multiplyMatrices(oi, new THREE.Matrix4().makeTranslation(-ds.x, -ds.y, -ds.z).multiply(G)), p = new THREE.Vector3();
  const pts = [];
  for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector3(lerp(b.min.x, b.max.x, i / 2), lerp(b.min.y, b.max.y, j / 2), lerp(b.min.z, b.max.z, k / 6)).applyMatrix4(M));
  const d = new THREE.Vector3().fromArray(PERSO_RL.degage).normalize(), dedans = (q) => q.y > T.y[0] && q.y < T.y[1] && Math.hypot(q.x / (T.rx + T.marge), (q.z - T.zc) / ((q.z > T.zc ? T.rz : T.rzDos) + T.marge)) < 1;
  let push = 0;
  for (; push < 0.4; push += 0.02) if (!pts.some((q) => dedans(p.copy(q).addScaledVector(d, push)))) break;
  return push * PERSO.taille;                               // le long de PERSO_RL.degage (repère de son modèle)
}
/* Bras du geste : le coude tourne autour de l'axe épaule–poignet pour garder le poignet dans ses limites (ses épaules ne
   sont pas les nôtres : une même main lui demande un autre coude), sans entrer dans son torse ; au-delà, la main tourne
   autour du point qu'elle tient, juste assez (limites et saturation douce des bras de la vue FPS : GE_POIGNET), sauf
   quand elle tient l'arme par sa prise (libre : 0). W, q : poignet et os de sa main (monde), corrigés sur place. */
const PERSO_RL_TORSE = new THREE.Vector3();
function persoBrasGeste(av, S, W, q, pole0, libre, dt) {
  const Bn = av.hero.bones, L = PERSO.barms[S], s = PERSO.taille, a = L.a * s, b = L.b * s, o = av.hero.object, K = persoMainsK(av);
  const Sh = Bn['arm' + S].getWorldPosition(_psV()), u = W.clone().sub(Sh);
  const D = clamp(u.length(), Math.abs(a - b) + 1e-3, (a + b) * 0.999); u.normalize();
  const N0 = pole0.clone().addScaledVector(u, -pole0.dot(u)); if (N0.lengthSq() < 1e-8) N0.set(0, -1, 0); N0.normalize();
  const ca = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const qn = q.clone().multiply(K[S].clone().invert()), oi = new THREE.Matrix4().copy(o.matrixWorld).invert(), T = PERSO_RL.torse;
  const coude = (sw, out) => out.copy(Sh).addScaledVector(u, a * ca).addScaledVector(N0.clone().applyAxisAngle(u, sw), a * sa);
  const E = _psV(), cout = (sw) => {
    coude(sw, E);
    const wr = prWristAngles(W.clone().sub(E).normalize(), qn, S === 'L');
    let c = (wr.ext / 0.61) ** 2 + (wr.uln > 0 ? wr.uln / 0.44 : -wr.uln / 0.26) ** 2 + 0.3 * (sw / 1.2) ** 2;
    const haut = E.y - (Sh.y - 0.12); if (haut > 0) c += (haut / 0.06) ** 2;      // coude bas : pas d'« aile de poulet » à hauteur d'épaule
    const p = PERSO_RL_TORSE.copy(E).applyMatrix4(oi);                       // coude dans son torse
    if (p.y > T.y[0] && p.y < T.y[1]) { const e = Math.hypot(p.x / T.rx, (p.z - T.zc) / T.rz); if (e < 1) c += 25 * (1 - e); }
    return c;
  };
  let best = 0, bc = Infinity;
  for (let sw = -1.4; sw <= 1.4001; sw += 0.1) { const c = cout(sw); if (c < bc) { bc = c; best = sw; } }
  const sv = av.rlSw || (av.rlSw = {});
  sv[S] = sv[S] === undefined ? best : sv[S] + (best - sv[S]) * Math.min(1, dt * 12);
  const pole = N0.clone().applyAxisAngle(u, sv[S]);
  // poignet : au-delà des limites, la main tourne autour du point tenu
  if (libre > 0) {
    coude(sv[S], E);
    const Lm = GE_POIGNET, sx = S === 'L' ? -1 : 1;
    const fh = W.clone().sub(E).normalize().applyQuaternion(qn.clone().invert());
    const ext = Math.atan2(-fh.y, -fh.z), uln = Math.atan2(-sx * fh.x, -fh.z);
    const e2 = geDoux(ext, Lm.ext[0], Lm.ext[1], Lm.doux), u2 = geDoux(uln, Lm.uln[0], Lm.uln[1], Lm.doux);
    if (Math.abs(e2 - ext) > 1e-4 || Math.abs(u2 - uln) > 1e-4) {
      const tdir = _psV().set(-sx * Math.tan(u2), -Math.tan(e2), -1).normalize();
      const r = new THREE.Quaternion().setFromUnitVectors(tdir, fh), R = qn.clone().multiply(r).multiply(qn.clone().invert());
      const Rk = new THREE.Quaternion().slerp(R, libre), piv = _psV().fromArray(Lm.piv).applyQuaternion(qn).add(W);
      W.sub(piv).applyQuaternion(Rk).add(piv); q.premultiply(Rk);
    }
  }
  persoArmIK(av, S, W, pole);
  persoSetWorldQ(Bn['hand' + S], q);
}
/* Part de la prise de l'arme pour une main du fantôme : sa prise, ou une pièce tenue comme une prise (pompe). */
function persoTientW(F, S, id) {
  const G = PERSO_RL.gardes[id], T = F.T[S];
  return Math.min(1, T.hold + (S === 'L' && G && G.priseG && G.priseG.includes(T.part) ? T.w : 0));
}
/* Part de la poche pour une main du fantôme : elle sort de la vue FPS (par le bas, ou par un côté : elle va chercher
   des munitions ; sauf si elle tient l'arme). Champ de la vue : 26° en haut et en bas, 43° sur les côtés. */
function persoPocheW(F, S) {
  const P = PERSO_RL, p = F.p[S], z = Math.max(0.05, -p.z);
  const bas = smooth(clamp((-p.y + P.pocheY[0]) / (P.pocheY[0] - P.pocheY[1]), 0, 1));
  const cote = smooth(clamp((Math.abs(p.x) / z - 0.93) / 0.35, 0, 1)) * (F.T[S].part ? 0 : 1);   // pas une main qui porte une pièce
  return Math.max(bas, cote) * (1 - F.T[S].hold);
}
/* Mélange de deux poses (matrices) : position, orientation. */
function persoMelangeM(A, B, k, out) {
  A.decompose(_pcV, _pcQ, _pcS); B.decompose(_pcV2, _pcQ2, _pcS);
  return out.compose(_pcV.lerp(_pcV2, k), _pcQ.slerp(_pcQ2, k), _pcS);
}
/* Sa main sur l'arme (pose gunW) comme la pose son modèle : droite sur la poignée (l'arme est accrochée à sa main),
   gauche sur le garde-main (g.fore) ; renvoie l'os de la main : { W (poignet), q }. */
function persoPriseSienne(av, S, g, gunW) {
  const s = PERSO.taille, A = S === 'R' ? av.AR : av.AL;
  if (S === 'R') {
    _pcM.makeScale(1 / s, 1 / s, 1 / s).multiply(g.gun.matrix);              // accroche → arme, l'accroche au repos
    _pcM2.copy(gunW).multiply(_pcM.invert());                                 // accroche (monde)
  } else {
    _pcM2.copy(gunW).multiply(g.fore.matrix);                                 // garde-main (monde)
    _pcM2.decompose(_pcV, _pcQ, _pcS);
    gunW.decompose(_pcV2, _pcQ2, _pcS);                                        // orientation : celle de l'arme dans son repère (+Z avant)
    _pcM2.compose(_pcV, _pcQ2.multiply(_pcQ.setFromAxisAngle(_psV().set(0, 1, 0), Math.PI)), _pcUn);
  }
  _pcM2.decompose(_pcV, _pcQ, _pcS);
  const q = _pcQ.clone().multiply(A.qi);
  return { W: _pcV.clone().sub(A.p.clone().multiplyScalar(s).applyQuaternion(q)), q };
}
/* Ses porte-chargeurs : la prise d'une main qui y plonge (notre poignet, monde) : doigts vers le bas, paume vers le
   ceinturon. */
function persoPoche(av, S) {
  const o = av.hero.object, P = PERSO_RL, qo = o.getWorldQuaternion(new THREE.Quaternion());
  const d = _psV().set(0, -1, 0.2), t = S === 'L' ? _psV().set(-0.3, 0, 1) : _psV().set(1, 0, 0.3);
  const q = qo.clone().multiply(handBasis(d, t, S === 'L'));
  const c = o.localToWorld(_psV().fromArray(P.poche)).add(persoDecale(av, 'hips'));
  return { p: c.sub(_psV().set(0, -0.028, -0.062).applyQuaternion(q)), q };
}
/* Ses doigts (quatre ensemble : fing, fing2 ; pouce : thumb, thumb2) d'après une pose de nos doigts. */
function persoDoigts(av, S, pose, k) {
  if (!pose || k <= 0) return;
  const Bn = av.hero.bones, sx = S === 'L' ? 1 : -1, f = pose.f, t = pose.t || [0.35, 0, 0, 0, 0];
  let c1 = 0, c2 = 0;
  for (let i = 0; i < 4; i++) { c1 += f[i][0]; c2 += f[i][1] + 0.5 * f[i][2]; }
  c1 = clamp(c1 / 4 * 1.05, -0.1, 1.6); c2 = clamp(c2 / 4 * 0.8, 0, 1.7);
  const tf = clamp(((t[1] || 0) + (t[2] || 0)) * 0.5, -0.3, 1.2), ta = clamp((t[0] || 0.35) - 0.35, -0.4, 0.8);
  const set = (n, x, y, z) => { _pcQ.setFromEuler(_pcE.set(x, y, z)); Bn[n + S].quaternion.slerp(_pcQ, k); };
  set('fing', 0, 0, -sx * c1);
  set('fing2', 0, 0, -sx * c2);
  set('thumb', 0, sx * (0.25 + 0.6 * ta), -sx * (0.3 + 0.5 * tf));
  set('thumb2', 0, 0, -sx * 0.6 * clamp(t[3] || 0, 0, 1.2));
}
/* Mélange de deux poses de nos doigts (a → b, s). */
function persoPoseMix(h) {
  if (!h) return null;
  if (!h.b || h.s <= 0) return h.a;
  if (h.s >= 1) return h.b;
  return geMixPose(h._m || (h._m = { f: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], s: [0, 0, 0, 0], t: [0, 0, 0, 0, 0] }), h.a, h.b, h.s);
}

/* Rechargement (ou réarmement) du corps : après hero.update (garde basse ou visée) et l'accroupi. */
function persoRecharge(av, E, dt) {
  const g = av.g, hero = av.hero, o = hero.object, Bn = hero.bones, P = PERSO_RL;
  if (!g || !E.arme) { av.rlW = 0; return; }
  const clip = E.rl && E.rl.c ? E.rl : E.cyc && E.cyc.c ? E.cyc : null;
  let w;
  if (clip) {
    const G1 = P.gardes[E.arme.id] || {}, d = clip.c.dur, t = clip.t, cy = !E.rl;   // réarmement : fondus courts (le geste dure moins d'une seconde)
    const fi = cy ? Math.min(0.08, d * 0.15) : Math.min(G1.entree || P.entree, d * 0.3), fo = cy ? Math.min(0.1, d * 0.15) : Math.min(P.sortie, d * 0.3);
    w = smooth(clamp(t / fi, 0, 1)) * (1 - smooth(clamp((t - (d - fo)) / fo, 0, 1)));
    av.rlCyc = !E.rl;
    persoRejoue(persoFantome(av, E.arme.id, E.arme.tier), clip);
  } else w = Math.max(0, (av.rlW || 0) - dt * 4);           // interrompu : retour, gestes figés
  av.rlW = w;
  const F = av.rlf;
  if (w < 1e-3 || !F || F.key !== E.arme.id + ':' + E.arme.tier) { av.rlW = 0; return; }
  const cyc = !!av.rlCyc, gun = g.gun, K = persoMainsK(av);
  const qo = o.getWorldQuaternion(new THREE.Quaternion()), qoi = qo.clone().invert();
  // l'arme : sa garde de rechargement (ou, pour un réarmement, là où il la tient), plus le mouvement du clip (réduit :
  // la vue FPS fait pivoter l'arme vers la caméra pour montrer le geste) ; mélangée à sa garde basse par les fondus
  const gunLow = _pcMg.copy(gun.matrixWorld);
  const info = F.gun.userData.info, hip = info.hip, hr = info.hipRot || [0, 0.05, 0.03];
  const rest = new THREE.Matrix4().compose(_pcV.set(hip[0], hip[1], hip[2]), _pcQ.setFromEuler(_pcE.set(hr[0], hr[1], hr[2])), _pcUn).multiply(F.gun.matrix);
  const restI = rest.clone().invert();
  const G0 = Object.assign({}, P.garde, P.gardes[E.arme.id] || {}), garde = new THREE.Matrix4();
  if (cyc) garde.copy(gunLow);
  else {
    const s = PERSO.taille;
    _pcQ.setFromEuler(_pcE.set(-G0.pitch - clamp(E.pitch * P.tangage, -0.3, 0.3), G0.yaw, G0.roll, 'YXZ'));
    garde.copy(o.matrixWorld).multiply(_pcM.compose(_pcV.fromArray(G0.r), _pcQ, _pcUn)).multiply(_pcM2.makeScale(1 / s, 1 / s, 1 / s)).multiply(gun.matrix);
    const dc = persoDecale(av, 'chest');
    garde.premultiply(_pcM.makeTranslation(dc.x, dc.y, dc.z));   // accroupi, en marche : la garde suit sa poitrine
  }
  const deg = _psV().fromArray(P.degage).normalize().applyQuaternion(qo);
  const poche = {}, epaule = {}, portee = {};
  for (const S of ['R', 'L']) {
    const pp = persoPoche(av, S);
    poche[S] = { W: pp.p.addScaledVector(_psV().set(0, 0, -1).applyQuaternion(pp.q), P.paume), q: pp.q.multiply(K[S]) };
    epaule[S] = Bn['arm' + S].getWorldPosition(_psV()); portee[S] = (PERSO.barms[S].a + PERSO.barms[S].b) * PERSO.taille * 0.97;
  }
  // l'arme pour une amplitude k du mouvement du clip (fantôme à l'instant rejoué), la tenue (sa garde basse tant que la main
  // gauche tient sa prise) et le dégagement du torse (push, le long de PERSO_RL.degage)
  const tenue = !cyc && G0.tenue !== false && !gunHold(F.gun).L.free;
  const arme = (k, ten, push) => {
    const rp = new THREE.Vector3(), rq = new THREE.Quaternion();
    new THREE.Matrix4().multiplyMatrices(restI, F.gun.matrixWorld).decompose(rp, rq, _pcS);
    if (tenue) k *= smooth(ten);                           // le pivot du clip quand la main gauche a quitté sa prise
    const b = tenue ? persoMelangeM(gunLow, garde, smooth(ten), new THREE.Matrix4()) : garde.clone();
    if (push) b.premultiply(new THREE.Matrix4().makeTranslation(deg.x * push, deg.y * push, deg.z * push));
    return b.multiply(new THREE.Matrix4().compose(rp.multiplyScalar(k), new THREE.Quaternion().slerp(rq, k), _pcUn));
  };
  // la scène du fantôme posée sur l'arme gw : cibles des mains (os de sa main : poignet W, orientation q), sa propre
  // prise aux fondus (wE < 1)
  const scene = (gw, wE) => {
    const Mv = new THREE.Matrix4().multiplyMatrices(gw, new THREE.Matrix4().copy(F.gun.matrixWorld).invert());
    const mq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(Mv)), T = {};
    for (const S of ['R', 'L']) {
      const pW = F.p[S].clone().applyMatrix4(Mv), qW = mq.clone().multiply(F.q[S]);
      const W = pW.addScaledVector(_psV().set(0, 0, -1).applyQuaternion(qW), P.paume), q = qW.multiply(K[S]);
      if (wE < 1) { const A = persoPriseSienne(av, S, g, gw); W.lerp(A.W, 1 - wE); q.slerp(A.q, 1 - wE); }
      T[S] = { W, q };
    }
    return { Mv, T };
  };
  const cible = (T, S, tr, pwS) => (pwS > 0 ? T[S].W.clone().add(tr).lerp(poche[S].W, pwS) : T[S].W.clone().add(tr));
  // portée : la scène (arme, mains, pièces) glisse vers les épaules si une main n'atteint pas sa cible ; la poche reste ;
  // reste : ce qui manque encore, sans les mains sur leur prise (hw : choix de l'amplitude ; au repos, sa garde basse
  // n'atteint pas toujours le garde-main)
  const portee2 = (T, pwX, hw) => {
    const tr = new THREE.Vector3();
    for (let it = 0; it < 6; it++) {
      const acc = new THREE.Vector3();
      for (const S of ['R', 'L']) {
        const d = cible(T, S, tr, pwX[S]).sub(epaule[S]), l = d.length(), ex = l - portee[S], pr = l - portee[S] * P.repli;
        if (ex > 0) acc.addScaledVector(d.normalize(), ex * (1 - pwX[S]));
        else if (pr < 0) acc.addScaledVector(d.normalize(), pr * 0.5 * (1 - pwX[S]));   // trop près : bras replié, coude écarté
      }
      if (acc.lengthSq() < 1e-8) break;
      tr.addScaledVector(acc, -0.7);
      if (tr.length() > 0.25) tr.setLength(0.25);
    }
    let reste = 0;
    for (const S of ['R', 'L']) reste = Math.max(reste, (cible(T, S, tr, pwX[S]).distanceTo(epaule[S]) - portee[S]) * (1 - hw[S]));
    return { tr, reste };
  };
  // plan du clip (une fois par clip) : le fantôme rejoue tout le clip ; amplitude la plus faible qui laisse ses mains
  // atteindre leurs cibles, puis, tous les 1/30 s, dégagement du torse, translation de portée et tenue, lissés dans le
  // temps : le corps anticipe au lieu de rattraper (pas d'arme qui saute quand une main part à la poche)
  if (clip && av.rlKc !== clip.c) {
    const G1 = P.gardes[E.arme.id] || {}, k0 = cyc ? P.ampleurCyc : G1.ampleur !== undefined ? G1.ampleur : P.ampleur, ks = G1.fixe ? [k0] : [k0, (k0 + 1) / 2, 1];
    const dtp = 1 / 30, n = Math.ceil(clip.c.dur / dtp) + 1, raw = [];
    const echant = (k, i) => {
      persoRejoue(F, { c: clip.c, t: Math.min(clip.c.dur, i * dtp) });
      const pwX = { R: persoPocheW(F, 'R'), L: persoPocheW(F, 'L') }, hw = { R: persoTientW(F, 'R', E.arme.id), L: persoTientW(F, 'L', E.arme.id) }, ten = 1 - hw.L;
      const push = cyc ? 0 : persoDegage(av, F, arme(k, ten, 0));
      const sc = scene(arme(k, ten, push), 1), r = portee2(sc.T, pwX, hw);
      return { push, tr: r.tr.applyQuaternion(qoi), ten, reste: r.reste };
    };
    let ki = 0;
    for (let i = 0; i < n && ki < ks.length - 1; i += 3) while (ki < ks.length - 1 && echant(ks[ki], i).reste > 0.03) ki++;
    for (let i = 0; i < n; i++) raw.push(echant(ks[ki], i));
    const sig = 0.08 / dtp, R0 = Math.ceil(sig * 3), plan = [];
    for (let i = 0; i < n; i++) {
      let sw = 0, push = 0, ten = 0; const tr = new THREE.Vector3();
      for (let j = Math.max(0, i - R0); j <= Math.min(n - 1, i + R0); j++) {
        const wj = Math.exp(-0.5 * ((j - i) / sig) ** 2); sw += wj;
        push += wj * raw[j].push; ten += wj * raw[j].ten; tr.addScaledVector(raw[j].tr, wj);
      }
      plan.push({ push: push / sw, ten: ten / sw, tr: tr.multiplyScalar(1 / sw) });
    }
    persoRejoue(F, clip);                                  // le fantôme revient à l'instant présent
    av.rlKc = clip.c; av.rlK = ks[ki]; av.rlPlan = { dtp, plan };
    av.rlSw = null; av.rlPw = null;                        // un nouveau clip : lissages remis à zéro
  }
  // l'instant présent dans le plan
  const PL = av.rlPlan, fi = clamp(F.t / PL.dtp, 0, PL.plan.length - 1), i0 = Math.floor(fi), i1 = Math.min(PL.plan.length - 1, i0 + 1), fr = fi - i0;
  const pa = PL.plan[i0], pb = PL.plan[i1];
  const push = lerp(pa.push, pb.push, fr), ten = lerp(pa.ten, pb.ten, fr), trw = pa.tr.clone().lerp(pb.tr, fr).applyQuaternion(qo).multiplyScalar(w);
  // part de la poche (lissée : la main y va et en revient en un geste)
  const pw = {}, pl = av.rlPw || (av.rlPw = {});
  for (const S of ['R', 'L']) { const v = persoPocheW(F, S); pl[S] = pl[S] === undefined ? v : pl[S] + (v - pl[S]) * Math.min(1, dt * 14); pw[S] = pl[S]; }
  // torse : penché sur l'arme, tourné vers la poche quand une main y va (pas pour un réarmement)
  if (!cyc) {
    Bn.spine.quaternion.multiply(_pcQ.setFromEuler(_pcE.set(P.penche * 0.4 * w, 0, 0)));
    const vr = Object.assign({}, P.garde, P.gardes[E.arme.id] || {}).vrille || 0;
    Bn.chest.quaternion.multiply(_pcQ.setFromEuler(_pcE.set(P.penche * 0.6 * w, (P.tourne * Math.max(pw.L, 0.6 * pw.R) + vr * (1 - Math.max(pw.L, pw.R))) * w, 0)));
  }
  o.updateMatrixWorld(true);
  av.rlEye = persoEye(av);                                     // ses yeux avant que la tête suive le geste
  for (const S of ['R', 'L']) epaule[S] = Bn['arm' + S].getWorldPosition(_psV());
  const gunW = persoMelangeM(gunLow, arme(av.rlK, ten, push), w, new THREE.Matrix4()).premultiply(new THREE.Matrix4().makeTranslation(trw.x, trw.y, trw.z));
  const SC = scene(gunW, w), tgt = SC.T;
  _pcMv.copy(SC.Mv);
  for (const S of ['R', 'L']) { tgt[S].W = cible(tgt, S, new THREE.Vector3(), pw[S]); if (pw[S] > 0) tgt[S].q.slerp(poche[S].q, pw[S]); }
  const pole = {};
  for (const S of ['R', 'L']) pole[S] = (S === 'R' ? _psV().set(-0.9, -0.6, -0.35).lerp(_psV().set(-0.5, -0.6, -0.7), pw.R) : _psV().set(0.35, -1, -0.15).lerp(_psV().set(0.6, -0.5, -0.7), pw.L)).applyQuaternion(qo);
  // bras : sa cinématique ; près de la garde basse, ses os se fondent avec ceux de son modèle (pas de saut)
  const save = PERSO_RL_OS.map((n) => Bn[n].quaternion.clone());
  for (const S of ['R', 'L']) persoBrasGeste(av, S, tgt[S].W, tgt[S].q, pole[S], w * (1 - persoTientW(F, S, E.arme.id)), dt);
  const kb = Math.min(1, w / 0.3);
  if (kb < 1) PERSO_RL_OS.forEach((n, i) => Bn[n].quaternion.copy(save[i].slerp(Bn[n].quaternion, kb)));
  o.updateMatrixWorld(true);
  av.rlEcart = { R: Bn.handR.getWorldPosition(_psV()).distanceTo(tgt.R.W), L: Bn.handL.getWorldPosition(_psV()).distanceTo(tgt.L.W) };   // main loin de sa cible : bras trop court
  // l'arme là où le geste la veut : son accroche (enfant de sa main droite) est recalculée
  const anc = hero.anchors.rightHand;
  _pcM.copy(anc.matrixWorld).invert().multiply(gunW).multiply(_pcM2.copy(gun.matrix).invert());
  _pcM.decompose(g.wrap.position, g.wrap.quaternion, g.wrap.scale);
  g.wrap.updateMatrixWorld(true);
  // pièces : comme sur le fantôme, par rapport à l'arme, ou à la main qui les porte (hors de l'arme)
  const c = F.c, t = F.t, parts = gun.userData.parts, fp = F.gun.userData.parts;
  const invFG = new THREE.Matrix4().copy(F.gun.matrixWorld).invert(), main = {};
  for (const S of ['R', 'L']) {
    const hb = Bn['hand' + S], hq = hb.getWorldQuaternion(new THREE.Quaternion()).multiply(K[S].clone().invert());
    const hp = hb.getWorldPosition(_psV()).addScaledVector(_psV().set(0, 0, -1).applyQuaternion(hq), -P.paume);
    main[S] = new THREE.Matrix4().compose(hp, hq, _pcUn).multiply(_pcM.compose(F.p[S], F.q[S], _pcUn).invert());   // (sa main) × (main du fantôme)⁻¹
  }
  for (const n in c.parts || {}) {
    const part = parts[n], fpart = fp[n];
    if (!part || !fpart) continue;
    part.visible = fpart.visible;
    const PW = _pcM2.multiplyMatrices(gun.matrixWorld, _pcM3.multiplyMatrices(invFG, fpart.matrixWorld));
    let follow = 0, side = null;
    for (const S of ['R', 'L']) if (F.T[S].part === n && F.T[S].w > follow) { follow = F.T[S].w; side = S; }
    if (side) {
      const sp = rlSpan(c.parts[n], t);
      follow *= !sp ? 0 : sp[0] === sp[1] ? (sp[0].f === 'cam' ? 1 : 0) : (sp[0].f === 'cam' ? 1 - sp[2] : 0) + (sp[1].f === 'cam' ? sp[2] : 0);
      if (follow > 1e-3) persoMelangeM(PW, new THREE.Matrix4().multiplyMatrices(main[side], fpart.matrixWorld), follow, PW);
    }
    _pcM.copy(part.parent.matrixWorld).invert().multiply(PW).decompose(part.position, part.quaternion, _pcS);
    part.updateMatrixWorld(true);
  }
  // doigts : sa prise quand la nôtre tient l'arme, sinon la prise de nos doigts
  for (const S of ['R', 'L']) persoDoigts(av, S, persoPoseMix(F.h[S]), w);
  // tête : elle regarde le geste (l'arme, la main gauche quand elle travaille, pas la poche)
  if (!cyc) {
    const look = gunW.decompose(_pcV, _pcQ, _pcS) && _pcV.clone();
    const lh = Bn.handL.getWorldPosition(_psV());
    look.lerp(lh, 0.5 * (1 - persoTientW(F, 'L', E.arme.id)) * (1 - pw.L));
    for (const [n, part] of [['neck', 0.4], ['head', 0.6]]) {
      const b = Bn[n], hp = Bn.head.getWorldPosition(_psV()), bq = b.getWorldQuaternion(new THREE.Quaternion());
      const fwd = _psV().set(0, 0, 1).applyQuaternion(Bn.head.getWorldQuaternion(new THREE.Quaternion())), want = look.clone().sub(hp).normalize();
      const d = new THREE.Quaternion().setFromUnitVectors(fwd, want), ang = 2 * Math.acos(Math.min(1, Math.abs(d.w)));
      const k = part * w * 0.85 * Math.min(1, P.regard / Math.max(ang, 1e-6));
      persoSetWorldQ(b, new THREE.Quaternion().slerp(d, k).multiply(bq));
    }
  }
  // chargeur lâché : il tombe au sol (événement du clip)
  const prevT = av.rlT === undefined || av.rlT > t ? t : av.rlT;
  av.rlT = t;
  for (const e of c.ev || []) if (e[1] === 'drop' && e[0] > prevT && e[0] <= t && parts[e[2]]) persoLacher(av, parts[e[2]]);
  o.updateMatrixWorld(true);
}
