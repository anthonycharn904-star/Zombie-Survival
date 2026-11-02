/* ==================================================================== 16 PERSONNAGE ==
   Anthony, premier personnage jouable (jeu 2.0.6, demande d'Anthony du 18 octobre 2026). Son modèle
   (engine/orig/survivant/ : survivant-tete.js, survivant-matieres.js, survivant.js) est inséré tel quel par
   build.py ; ce module le branche sur le jeu sans le retoucher (règles de son INTEGRATION.md).
   · Bras en vue FPS : ses bras (createSurvivorArms) suivent à chaque image nos bras, posés par la préhension
     (section 15), qui reste invisible et décide de tout (choix d'Anthony du 18 octobre). Ses os de la main se
     posent sur nos articulations (ses doigts ont nos longueurs à 1 mm près) ; ses bras, plus courts (29 + 25,5 cm
     contre 33 + 28,5), ont leur propre cinématique, coude dans le plan du nôtre ; l'épaule, hors champ,
     avance si la main est trop loin. Nos bras restent calculés, mais ne sont plus dessinés (calque 1).
   · Corps : son corps (createSurvivor) suit le joueur, réduit à 1,75 m (choix d'Anthony : ses yeux, à 1,667 m,
     à la hauteur de ceux du jeu, PLAYER_EYE). En vue FPS, pour la caméra seulement : ses bras sont repliés (nos
     bras de la vue les remplacent), tout ce qui est à moins de 20 cm de la caméra est effacé (tête, cou, col),
     l'intérieur des vêtements est assombri, et il recule de 10 cm (en regardant à ses pieds, on voit ses
     bottes et son jean) ; son ombre garde tout le corps (la passe des ombres a ses propres matières).
   · Accroupi : ses hanches descendent jusqu'à la hauteur des yeux du jeu (1,07 m) ; ses pieds, qui flottaient
     dans son accroupi, sont reposés au sol ; jambes recalculées.
   · Vue TPS (touche T, choix d'Anthony du 18 octobre : caméra derrière l'épaule, rien ne bouge pour viser) : la
     caméra du jeu reste à ses yeux (tirs, couteau, objets, sons inchangés) ; une caméra de rendu derrière l'épaule
     droite, parallèle, qui ne traverse pas les murs ; réticule sur le point visé ; son arme dans ses mains (copie
     du modèle du jeu, main gauche où la préhension la pose), recul, rechargement, gestes (couteau, grenade, fiole).
   · Véhicules : assis au volant de la jeep (mains sur le volant qui suivent sa rotation, pieds au plancher, tête
     qui suit le regard), monté et descendu en 0,55 s ; la caméra du conducteur est à ses yeux. Sièges dans
     PERSO_SIEGES (le passager est prêt pour la coop).
   · Coop (préparée) : un corps (avatar) est piloté par un état (persoEtatLocal pour le joueur) ; un autre joueur
     aura son avatar (persoCreerAvatar), piloté par l'état reçu.
   · Couleurs : il convertit lui-même ses couleurs (sortie sRGB du jeu). Il n'est donc pas sous World.root et
     ses matières sont marquées comme converties (linearizeTree ne les touche pas).
   · Caché au menu, dans les Mod Tools, pendant les scènes ; à terre en vue FPS (couché en vue TPS).
   ============================================================================ */
const PERSO = {
  on: true,                                   // false : nos bras d'avant (si son modèle manque ou échoue)
  taille: PLAYER_EYE / 1.667,                 // 1,75 m
  fps: { efface: 0.2, recul: 0.1, dedans: 0.3 },
  tps: { dist: 2.3, cote: 0.42, haut: 0.12, marge: 0.2, d: 2.3, t0: 0 },   // caméra TPS : recul, à droite, en haut (m)
  pouceBase: 'sien',                          // base du pouce de ses bras : la sienne (son éminence telle qu'il l'a dessinée ;
                                              // jeu 2.0.6, gestes : la fiole n'est plus traversée) ou la nôtre ('jeu')
  vue: 'fps', arms: null, hero: null, av: null, cam: null, flash: null, err: null,
  drop: 0, lift: 0, eyeY: 0, shown: false, oeilVolant: null,
};
const PR_DOIGTS = ['index', 'middle', 'ring', 'pinky'];

function persoInit() {
  if (typeof createSurvivor !== 'function' || typeof createSurvivorArms !== 'function') { PERSO.on = false; PERSO.err = 'modèle absent'; return; }
  try {
    persoArmsInit();
    persoBodyInit();
  } catch (e) {
    console.warn('personnage', e);
    PERSO.on = false; PERSO.err = String(e && e.message || e);
    if (PERSO.arms) { Arms.root.remove(PERSO.arms.object); PERSO.arms = null; }
    if (PERSO.hero) { scene.remove(PERSO.hero.object); PERSO.hero = null; PERSO.av = null; }
    for (const a of [Arms.armR, Arms.armL]) a.root.traverse((o) => { if (o.isMesh) o.layers.set(0); });
  }
}
/* ses matières se convertissent elles-mêmes : linearize ne doit pas les reprendre */
function persoMarkLinear(mats) { for (const k in mats) _linDone.add(mats[k]); }

/* Bras du couteau et du khépesh (leurs propres bras, dessinés dans leur vue) : aux couleurs d'Anthony (demande
   du 19 octobre 2026) : manche de sa veste et gant de ses mitaines (PAL.jacket et PAL.glove de survivant.js),
   converties en linéaire par les modules comme avant. Sans son modèle, les couleurs du jeu d'avant (gants et
   manches du treillis), manche dans la matière des manches du jeu (MAT.sleeve). */
const PERSO_BRAS_COULEURS = { gant: 0x2a2522, manche: 0x6c5a40 };
function persoCouleursBras() { return typeof createSurvivor === 'function' ? Object.assign({}, PERSO_BRAS_COULEURS) : { gant: 0x3b2a1d, manche: 0x4f5638 }; }
function persoMancheBras(rig) {
  if (typeof createSurvivor === 'function') return;
  rig.traverse((m) => { if (m.material && m.material.color && !m.material.map && m.material.color.equals(MAT.sleeve.color)) m.material = MAT.sleeve; });
}

/* ------------------------------------------------------------- bras en vue FPS */
const _psV = () => new THREE.Vector3();
/* repère (a, n ⊥ a, a × n) */
function persoBasis(a, n, out) {
  const x = _psV().copy(a).normalize(), y = _psV().copy(n).addScaledVector(x, -n.dot(x)).normalize();
  return out.makeBasis(x, y, _psV().crossVectors(x, y));
}
function persoArmsInit() {
  const arms = createSurvivorArms(THREE, { renderer, shadows: false });
  persoMarkLinear(arms.materials);
  Arms.root.add(arms.object);
  for (const a of [Arms.armR, Arms.armL]) a.root.traverse((o) => { if (o.isMesh) o.layers.set(1); });   // nos bras : calculés, pas dessinés
  const sk = arms.skeleton, rest = {};
  sk.bones.forEach((b, i) => { rest[b.name] = _psV().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[i]).invert()); });
  // au repos, ses os ont l'orientation de l'objet : axe vers l'os suivant, dos de la main vers +x (droite)
  // ou −x (gauche) ; REST[nom] = repère de repos transposé
  const REST = {};
  for (const S of ['R', 'L']) {
    const dos = new THREE.Vector3(S === 'R' ? 1 : -1, 0, 0), put = (n, a) => { REST[n] = persoBasis(a, dos, new THREE.Matrix4()).transpose(); };
    put('hand' + S, new THREE.Vector3(0, 0, -1));
    put('fore' + S + ':dos', new THREE.Vector3(0, 0, -1));
    for (const f of [...PR_DOIGTS, 'thumb']) for (let k = 1; k <= 3; k++) {
      const a = k < 3 ? rest[f + (k + 1) + S].clone().sub(rest[f + k + S]) : rest[f + 3 + S].clone().sub(rest[f + 2 + S]);
      put(f + k + S, a);
    }
  }
  // bras et avant-bras de sa cinématique : axe −z, charnière du coude −x (comme dans son modèle)
  REST.charniere = persoBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Matrix4()).transpose();
  PERSO.arms = arms; PERSO.armsRest = REST; PERSO.armsW = {};
  PERSO.armsBind = {}; for (const b of sk.bones) PERSO.armsBind[b.name] = b.position.clone();   // positions de liaison (repère du parent)
}
const _psM = new THREE.Matrix4(), _psQ = new THREE.Quaternion();
function persoAim(rest, a, n) { persoBasis(a, n, _psM).multiply(rest); return new THREE.Quaternion().setFromRotationMatrix(_psM); }
/* pose un os en (p, q) monde ; p nul : il garde sa position de liaison par rapport à son parent */
function persoSetW(b, p, q) {
  const W = PERSO.armsW, par = b.parent, PW = W[par.name];
  let pq, pp;
  if (PW) { pq = PW.q; pp = PW.p; } else { pq = par.getWorldQuaternion(new THREE.Quaternion()); pp = par.getWorldPosition(_psV()); }
  _psQ.copy(pq).invert();
  b.quaternion.copy(_psQ).multiply(q);
  if (p) b.position.copy(p).sub(pp).applyQuaternion(_psQ);
  W[b.name] = { q: q.clone(), p: p ? p.clone() : b.position.clone().applyQuaternion(pq).add(pp) };
}
const persoWPos = (o, x = 0, y = 0, z = 0) => o.localToWorld(_psV().set(x, y, z));
const persoWDir = (o, x, y, z) => _psV().set(x, y, z).transformDirection(o.matrixWorld);
const PERSO_BRAS = 0.29, PERSO_AVANT_BRAS = 0.255;        // ses longueurs (survivant.js)
function persoArmSide(S, arm) {
  const B = PERSO.arms.bones, R = PERSO.armsRest, on = arm.root.visible;
  B['arm' + S].scale.setScalar(on ? 1 : 1e-5);              // bras caché : replié sur l'épaule, hors champ
  if (!on) return;
  const a = PERSO_BRAS, b = PERSO_AVANT_BRAS;
  const Sh = persoWPos(arm.upper), E = persoWPos(arm.fore), Wr = persoWPos(arm.hand.wrist);
  const u = Wr.clone().sub(Sh);
  let D = u.length(); u.normalize();
  const S0 = Sh.clone();
  if (D > (a + b) * 0.999) { D = (a + b) * 0.999; S0.copy(Wr).addScaledVector(u, -D); }   // l'épaule avance
  D = Math.max(D, Math.abs(a - b) + 0.01);
  const pv = E.clone().sub(Sh); pv.addScaledVector(u, -pv.dot(u)); if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0); pv.normalize();
  const ca = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const Eh = S0.clone().addScaledVector(u, a * ca).addScaledVector(pv, a * sa);
  const dUp = Eh.clone().sub(S0).normalize(), dFo = Wr.clone().sub(Eh).normalize();
  const n1 = _psV().crossVectors(dFo, dUp); if (n1.lengthSq() < 1e-8) n1.crossVectors(dUp, pv); n1.normalize();
  const w = arm.hand.wrist, dos = persoWDir(w, 0, 1, 0);
  persoSetW(B['arm' + S], S0, persoAim(R.charniere, dUp, n1));
  persoSetW(B['fore' + S], Eh, persoAim(R['fore' + S + ':dos'], dFo, dos));   // le roulis de l'avant-bras suit la main
  persoSetW(B['hand' + S], Wr, persoAim(R['hand' + S], persoWDir(w, 0, 0, -1), dos));
  arm.hand.fingers.forEach((segs, i) => {
    const f = PR_DOIGTS[i], L = HAND.fingers[i].L;
    for (let j = 0; j < 3; j++) {
      const g = segs[j], P = persoWPos(g), Pn = j < 2 ? persoWPos(segs[j + 1]) : persoWPos(g, 0, 0, -L[2]);
      persoSetW(B[f + (j + 1) + S], P, persoAim(R[f + (j + 1) + S], Pn.sub(P), persoWDir(g, 0, 1, 0)));
    }
  });
  const th = arm.hand.thumb, TL = HAND.thumb.L;
  for (let j = 0; j < 3; j++) {
    const g = th[j], Pn = j < 2 ? persoWPos(th[j + 1]) : persoWPos(g, 0, 0, -TL[2]);
    let P = persoWPos(g);
    if (j === 0 && PERSO.pouceBase === 'sien') { const hw = PERSO.armsW['hand' + S]; P = PERSO.armsBind['thumb1' + S].clone().applyQuaternion(hw.q).add(hw.p); }
    persoSetW(B['thumb' + (j + 1) + S], P, persoAim(R['thumb' + (j + 1) + S], Pn.sub(P), persoWDir(g, 0, 1, 0)));
  }
}
function persoArmsSync() {
  const A = PERSO.arms;
  if (!PERSO.on || !A) return;
  A.object.visible = true;
  if (!Arms.root.visible) return;
  const W = PERSO.armsW;
  for (const k in W) delete W[k];
  Arms.root.updateMatrixWorld(true);
  const r = A.bones.root;
  W[r.name] = { q: r.getWorldQuaternion(new THREE.Quaternion()), p: r.getWorldPosition(_psV()) };
  persoArmSide('R', Arms.armR);
  persoArmSide('L', Arms.armL);
  A.object.updateMatrixWorld(true);
}

/* ------------------------------------------------------------- corps */
/* Sièges des véhicules, dans le repère du modèle de la jeep (son fichier : avant +z, gauche +x ; plancher à
   0,56 m, coussins à 0,76 m, dossiers à z −0,395, volant de 0,19 m de rayon) : x du siège, hauteur des hanches
   et leur recul, pieds (écart, avance), bassin basculé en arrière (rad), mains (volant ou genoux). Le
   passager est prêt pour la coop (un autre joueur), pas encore utilisé. */
const PERSO_SIEGES = {
  jeep: {
    conducteur: { x: 0.29, sol: 0.56, hanche: [0.82, -0.27], pieds: [0.1, 0.29], bassin: 0.1, mains: 'volant' },
    passager: { x: -0.29, sol: 0.56, hanche: [0.82, -0.27], pieds: [0.12, 0.27], bassin: 0.14, mains: 'genoux' },
  },
};
const _psQ2 = () => new THREE.Quaternion();
/* Un avatar : un corps (son modèle) piloté par un état (persoEtatLocal pour le joueur ; en coop, l'état
   d'un autre joueur viendra du réseau). Qualité : « haute » pour le joueur, « moyenne » conseillée pour
   les autres (son INTEGRATION.md). */
function persoCreerAvatar(qualite, local) {
  const hero = createSurvivor(THREE, { renderer, shadows: true, quality: qualite || 'haute' });
  persoMarkLinear(hero.materials);
  hero.object.scale.setScalar(PERSO.taille);
  hero.object.visible = false;
  scene.add(hero.object);
  const av = { hero, local: !!local, cut: { value: 0 }, guns: {}, gunKey: '', g: null, trans: null, siege: null, root: null,
    drop: 0, lift: 0, eyeY: 0, down: false, yawPrev: null, shown: false };
  // effacement près de la caméra et intérieur assombri (passe de la caméra seulement)
  const IN = { value: PERSO.fps.dedans };
  for (const k in hero.materials) {
    const m = hero.materials[k], prev = m.onBeforeCompile;
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      // distance à la caméra : une variable à nous (l'ombre des yeux est une MeshBasicMaterial, sans vViewPosition)
      sh.uniforms.uPersoCut = av.cut; sh.uniforms.uPersoIn = IN;
      sh.vertexShader = 'varying vec3 vPersoVue;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvPersoVue = - mvPosition.xyz;');
      sh.fragmentShader = 'uniform float uPersoCut;\nuniform float uPersoIn;\nvarying vec3 vPersoVue;\n' + sh.fragmentShader
        .replace('void main() {', 'void main() {\n\tif (uPersoCut > 0.0 && length(vPersoVue) < uPersoCut) discard;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tif (uPersoCut > 0.0 && !gl_FrontFacing) gl_FragColor.rgb *= uPersoIn;');
    };
    m.customProgramCacheKey = () => 'zs-perso|' + k + '|' + (prev ? prev.toString() : '');
    m.needsUpdate = true;
  }
  const Bn = hero.bones, fold = [Bn.armL, Bn.armR], foldG = [Bn.chest];
  let frame = -1;
  const before = function (r, sc, cam) {
    av.cut.value = persoCutFor(av, cam);
    if (!(av.local && cam === camera && persoFoldArms()) || r.info.render.frame === frame) return;
    // une fois par image, vue FPS à pied : bras repliés sur les épaules pour la caméra (les os reprennent leur
    // taille tout de suite ; la passe des ombres, faite avant, a gardé le corps entier) ; en glissade (section 19),
    // le haut du buste, penché en arrière sous les yeux, est replié sur la poitrine : restent le ventre et les jambes
    frame = r.info.render.frame;
    const F = hero.state && hero.state.slide > GLISSADE.replie ? foldG : fold;
    for (const b of F) { b.scale.setScalar(1e-4); b.updateMatrixWorld(true); }
    hero.skeleton.update();
    for (const b of F) { b.scale.setScalar(1); b.updateMatrixWorld(true); }
  };
  for (const k in hero.meshes) hero.meshes[k].onBeforeRender = before;
  const anc = (n) => ({ p: hero.anchors[n].position.clone(), qi: hero.anchors[n].quaternion.clone().invert() });
  av.AR = anc('rightHand'); av.AL = anc('leftHand');
  return av;
}
/* Longueurs et repères de repos (os orientés comme l'objet ; axe vers l'os suivant, pli vers l'avant +z). */
function persoBodyRig(hero) {
  const sk = hero.skeleton, bind = {}, z = new THREE.Vector3(0, 0, 1);
  sk.bones.forEach((b, i) => { bind[b.name] = _psV().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[i]).invert()); });
  const seg = (a, b) => { const d = bind[b].clone().sub(bind[a]); return { L: d.length(), R: persoBasis(d, z, new THREE.Matrix4()).transpose() }; };
  PERSO.legs = {}; PERSO.barms = {};
  for (const S of ['L', 'R']) {
    const t = seg('thigh' + S, 'shin' + S), sh = seg('shin' + S, 'foot' + S), u = seg('arm' + S, 'fore' + S), f = seg('fore' + S, 'hand' + S);
    PERSO.legs[S] = { a: t.L, b: sh.L, ra: t.R, rb: sh.R };
    PERSO.barms[S] = { a: u.L, b: f.L, ra: u.R, rb: f.R };
  }
  PERSO.ankle = bind.footL.y;                                 // cheville au repos (0,088 m)
  PERSO.thighOff = bind.thighL.y - bind.hips.y;               // hanches sous le bassin (−0,06 m)
}
function persoBodyInit() {
  const av = persoCreerAvatar('haute', true);
  persoBodyRig(av.hero);
  PERSO.av = av; PERSO.hero = av.hero; PERSO.vue = 'fps'; PERSO.cutU = av.cut;
}
function persoSetWorldQ(b, q) { const pq = b.parent.getWorldQuaternion(_psQ2()); b.quaternion.copy(pq.invert().multiply(q)); b.updateMatrixWorld(true); }
function persoEye(av, out = _psV()) {
  const B = av.hero.bones;
  return out.copy(B.oeilG.getWorldPosition(_psV())).add(B.oeilD.getWorldPosition(_psV())).multiplyScalar(0.5);
}
/* Jambe : cinématique à deux os (genou dans le plan de pv), cheville en A, pied orienté par fq. */
function persoLegIK(av, S, A, pv0, fq) {
  const Bn = av.hero.bones, L = PERSO.legs[S], s = PERSO.taille, a = L.a * s, b = L.b * s;
  const H = Bn['thigh' + S].getWorldPosition(_psV());
  const u = A.clone().sub(H);
  let D = u.length(); u.normalize();
  D = clamp(D, Math.abs(a - b) + 1e-3, (a + b) * 0.999);
  const pv = pv0.clone().addScaledVector(u, -pv0.dot(u)); pv.normalize();
  const ca = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const Kn = H.clone().addScaledVector(u, a * ca).addScaledVector(pv, a * sa);
  const At = Kn.clone().sub(H).normalize(), As = H.clone().addScaledVector(u, D).sub(Kn).normalize();
  const lat = _psV().crossVectors(At, pv).normalize();                 // axe du genou
  persoSetWorldQ(Bn['thigh' + S], persoAim(L.ra, At, _psV().crossVectors(lat, At)));
  persoSetWorldQ(Bn['shin' + S], persoAim(L.rb, As, _psV().crossVectors(lat, As)));
  if (fq) persoSetWorldQ(Bn['foot' + S], fq);
}
/* Bras du corps : cinématique à deux os de l'épaule au poignet W (coude vers pole). */
function persoArmIK(av, S, W, pole) {
  const B = av.hero.bones, L = PERSO.barms[S], s = PERSO.taille, a = L.a * s, b = L.b * s;
  const Sh = B['arm' + S].getWorldPosition(_psV());
  const u = W.clone().sub(Sh);
  let D = u.length(); u.normalize();
  D = clamp(D, Math.abs(a - b) + 1e-3, (a + b) * 0.999);
  const pv = pole.clone().addScaledVector(u, -pole.dot(u)); if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0); pv.normalize();
  const ca = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const E = Sh.clone().addScaledVector(u, a * ca).addScaledVector(pv, a * sa), Wp = Sh.clone().addScaledVector(u, D);
  const Au = E.clone().sub(Sh).normalize(), Af = Wp.clone().sub(E).normalize();
  const Nu = Af.clone().addScaledVector(Au, -Af.dot(Au)).normalize();          // le pli du coude, vers l'avant au repos
  const lat = _psV().crossVectors(Au, Nu);
  persoSetWorldQ(B['arm' + S], persoAim(L.ra, Au, Nu));
  persoSetWorldQ(B['fore' + S], persoAim(L.rb, Af, _psV().crossVectors(lat, Af)));
}
/* Main du corps : son ancre (centre de la prise, +Z avant, +Y haut, comme pour une arme) en (pos, quat). */
function persoPlaceHand(av, S, pos, quat, pole) {
  const A = S === 'R' ? av.AR : av.AL, handQ = quat.clone().multiply(A.qi);
  const W = pos.clone().sub(A.p.clone().multiplyScalar(PERSO.taille).applyQuaternion(handQ));
  persoArmIK(av, S, W, pole);
  persoSetWorldQ(av.hero.bones['hand' + S], handQ);
}
/* Accroupi plus bas que le sien : les hanches descendent jusqu'à ce que ses yeux soient à la hauteur
   visée ; dans son accroupi, les pieds flottent (chevilles à 0,19 m au lieu de 0,088 : la flexion des
   jambes ne compense pas la descente des hanches), on les pose donc au sol à mesure qu'il s'accroupit.
   Chaque jambe est recalculée (cinématique à deux os, genou dans son plan), le pied garde son orientation. */
function persoDeepen(av, eyeTarget, ground, poids = 1) {
  const hero = av.hero, o = hero.object, Bn = hero.bones, s = PERSO.taille, k = (hero.state ? hero.state.crouch : 0) * poids;
  o.updateMatrixWorld(true);
  const drop = clamp(persoEye(av).y - eyeTarget, 0, 0.35) * poids;   // poids : effacé pendant une glissade (section 19)
  const keep = {};
  let lift = 0;
  for (const S of ['L', 'R']) {
    const ank = Bn['foot' + S].getWorldPosition(_psV());
    const up = k * Math.max(0, ank.y - (ground + PERSO.ankle * s));
    ank.y -= up; lift = Math.max(lift, up);
    keep[S] = { ank, knee: Bn['shin' + S].getWorldPosition(_psV()), fq: Bn['foot' + S].getWorldQuaternion(_psQ2()) };
  }
  av.drop = drop; av.lift = lift;
  if (drop < 0.005 && lift < 0.005) return;
  Bn.hips.position.y -= drop / s;
  o.updateMatrixWorld(true);
  const fwd = _psV().set(0, 0, 1).transformDirection(o.matrixWorld);
  for (const S of ['L', 'R']) {
    const K = keep[S], H = Bn['thigh' + S].getWorldPosition(_psV()), pv = K.knee.clone().sub(H);
    persoLegIK(av, S, K.ank, pv.lengthSq() < 1e-8 ? fwd : pv, K.fq);
  }
}

/* ------------------------------------------------------------- état du joueur */
/* Ce qu'un corps doit montrer (le joueur local ; en coop, la même chose viendra du réseau). */
function persoEtatLocal() {
  const p = player, s = curSlot(), V = OW.on && owDriving() ? VEH.drive : null;
  const playing = G.state === 'playing' || G.state === 'paused';
  const E = {
    playing: playing && !viewCamera,
    x: p.pos.x, y: p.gy + p.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch,
    speed: Math.hypot(p.vel.x, p.vel.z), crouch: p.crouch, grounded: p.grounded, down: !!p.down,
    arme: s ? { id: s.id, tier: s.tier || 0 } : null, ads: p.ads,
    etat: Arms.state, t: Arms.t, dur: Arms.dur, kick: Arms.kick, kickRot: Arms.kickRot, flash: !!(Arms.flash && Arms.flash.visible),
    rl: Arms.rl ? { c: Arms.rl.c, t: Arms.rl.t } : null, fiole: Arms.state === 'drink' ? Arms.drinkId : null,
    cyc: Arms.cyc && Arms.state === 'idle' ? { c: Arms.cyc.c, t: Arms.cyc.t } : null,   // réarmement (levier, pompe)
    mv: glCorps(),                                          // glissade, sprint, sprint tactique (section 19)
    siege: V && V.jeep ? { V, place: 'conducteur', thr: VEH.thr || 0 } : null,
    look: V ? { yaw: VEH.lookYaw, pitch: VEH.lookPitch } : { yaw: 0, pitch: p.pitch },
    cinematique: !V && !Arms.root.visible,                  // scène (bras de la vue cachés hors véhicule)
    vue: V ? (VEH.view ? 'volant' : 'poursuite') : PERSO.vue,
  };
  // montré : en partie, sauf pendant une scène, dans un véhicule sans siège dessiné, et à terre en vue FPS
  E.visible = E.playing && !E.cinematique && !(V && !V.jeep) && !(E.down && E.vue === 'fps');
  return E;
}
/* Vue FPS à pied : les bras du corps sont repliés pour la caméra. */
function persoFoldArms() { return PERSO.vue === 'fps' && !(OW.on && owDriving()); }
/* Rayon d'effacement autour de la caméra qui dessine (0 : rien d'effacé). */
function persoCutFor(av, cam) {
  if (!av.local) return 0;
  if (cam === camera) return (PERSO.vue === 'fps' && !(OW.on && owDriving())) || (OW.on && owDriving() && VEH.view) ? PERSO.fps.efface : 0;
  if (cam === PERSO.cam) return PERSO.tps.d < 0.75 ? 0.35 : 0;       // caméra TPS serrée contre un mur
  return 0;
}

/* ------------------------------------------------------------- pose debout */
const PERSO_GESTES = { knife: 0.45, nade: 1.4, drink: 2.2, swapOut: 0.3, swapIn: 0.3 };
function persoDebout(av, E, dt) {
  const hero = av.hero, o = hero.object, B = hero.bones;
  const turn = av.yawPrev === null || !dt ? 0 : wrapAngle(E.yaw - av.yawPrev) / dt;
  // glissade (section 19) : le corps suit sa trajectoire, la tête le regard ; il revient au regard en douceur
  const mv = E.mv || { slide: 0, slideT: 0, sprint: 0, tac: 0, facing: E.yaw };
  const face = wrapAngle(mv.facing - E.yaw);
  av.face = av.yawPrev === null || !dt || av.face === undefined ? face : wrapAngle(av.face + wrapAngle(face - av.face) * (1 - Math.exp(-12 * dt)));
  if (!face && Math.abs(av.face) < 1e-3) av.face = 0;           // hors glissade : exactement le regard, comme avant
  av.yawPrev = E.yaw;
  o.rotation.set(0, E.yaw + av.face + Math.PI, 0);              // son avant (+z) dans le regard du joueur
  o.position.set(E.x, E.y, E.z);
  o.updateMatrixWorld(true);
  // arme tenue : baissée pendant un geste (couteau, grenade, fiole, changement d'arme)
  const geste = PERSO_GESTES[E.etat] ? E.etat : null;
  persoArme(av, E, geste);
  if (E.down) { if (!av.down) { hero.die(); av.down = true; } }
  else if (av.down) { hero.revive(); av.down = false; }
  hero.update(dt, { speed: E.speed, crouch: E.crouch > 0.5 && mv.slide < 0.5, armed: !!E.arme && !geste, aim: E.ads > 0.5, onGround: E.grounded, lookPitch: E.pitch, turn,
    slide: mv.slide, slideT: mv.slideT, sprint: mv.sprint, tac: mv.tac, lookYaw: -av.face });
  if (av.down && hero.state) hero.state.deathT = Math.min(hero.state.deathT, 0.95);   // à terre : couché, sans aller plus loin
  if (E.grounded && !E.down) {
    persoDeepen(av, E.y + PLAYER_EYE - E.crouch * 0.55 - (mv.oeil || 0), E.y, 1 - smooth(clamp(hero.state ? hero.state.slide : 0, 0, 1)));   // glissade : ses jambes
    if (hero.state && hero.state.slide > 0.01) glPieds(av, E.y);   // glissade : pieds au sol (section 19)
  } else av.drop = av.lift = 0;
  av.rlEye = null;
  if (geste && !E.down) { av.rlW = 0; persoGeste(av, E, geste); }
  else if (!E.down && ((E.etat === 'reload' && E.rl) || E.cyc || av.rlW > 1e-3)) persoRecharge(av, E, dt);   // section 18
  else { av.rlW = 0; av.rlT = undefined; }
  if (av.fiole && geste !== 'drink') av.fiole.visible = false;
  persoLaches(av, dt);
  // ses yeux à l'aplomb de la caméra (reculés de 10 cm en vue FPS)
  if (!E.down) {
    o.updateMatrixWorld(true);
    const e = av.rlEye || persoEye(av), back = av.local && E.vue === 'fps' ? PERSO.fps.recul : 0;   // rechargement : ses yeux avant que la tête suive le geste
    o.position.x += E.x + Math.sin(E.yaw) * back - e.x;
    o.position.z += E.z + Math.cos(E.yaw) * back - e.z;
    av.eyeY = e.y - E.y;
  }
  o.updateMatrixWorld(true);
  av.root = { p: o.position.clone(), q: o.quaternion.clone() };
}
/* Gestes (vue TPS, coop) : la main droite, l'arme rangée. Cibles de son ancre dans le repère du corps. */
function persoGeste(av, E, geste) {
  const o = av.hero.object, k = clamp(E.t / PERSO_GESTES[geste], 0, 1);
  const at = (x, y, z) => o.localToWorld(_psV().set(x, y, z));          // repère de son modèle (avant +z, droite −x)
  const qo = o.getWorldQuaternion(_psQ2());
  let P = null, q = qo.clone();
  if (geste === 'knife') {                                    // coup de couteau vers l'avant
    const f = Math.sin(Math.PI * k);
    P = at(-0.14 + 0.08 * f, 1.12 + 0.16 * f, 0.22 + 0.42 * f);
  } else if (geste === 'nade') {                              // grenade : bras armé derrière la tête, puis lancer
    const back = smooth(clamp(k / 0.55, 0, 1)), fwd = smooth(clamp((k - 0.55) / 0.25, 0, 1));
    P = at(-0.2 + 0.1 * fwd, 1.1 + 0.5 * back - 0.15 * fwd, 0.2 - 0.38 * back + 0.75 * fwd);
  } else if (geste === 'drink') {                             // fiole portée à la bouche
    const up = smooth(clamp((k - 0.15) / 0.25, 0, 1)) * (1 - smooth(clamp((k - 0.8) / 0.15, 0, 1)));
    P = at(-0.1 + 0.06 * up, 1.1 + 0.42 * up, 0.25 - 0.06 * up);
    q.multiply(_psQ2().setFromEuler(new THREE.Euler(-1.1 * up, 0, 0)));
  } else return;
  persoPlaceHand(av, 'R', P, q, _psV().set(-1, -0.6, -0.2).applyQuaternion(qo));
  if (geste === 'drink') persoFiole(av, E);
}
/* La fiole dans sa main droite (vue TPS, coop) : la prise de la vue FPS (geBottleHold), convertie dans le repère de
   son ancre (étalonné sur la tenue d'une arme). */
function persoFiole(av, E) {
  if (!E.fiole) return;
  if (!av.fiole) { av.fiole = buildBottle(E.fiole); av.fiole.userData.id = E.fiole; scene.add(av.fiole); }
  const B = av.fiole;
  if (B.userData.id !== E.fiole) { dressBottle(B, E.fiole, true); B.userData.id = E.fiole; }
  const hold = gunHold(av.g ? av.g.gun : (PERSO.gunRef || (PERSO.gunRef = buildGun('m1911', 0)))).R;
  const qOff = hold.q.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(_psV().set(0, 1, 0), Math.PI));
  const H = geBottleHold(B.userData.shape ? B.userData.shape.kind : 'flask');
  av.hero.object.updateMatrixWorld(true);
  const anc = av.hero.anchors.rightHand, aq = anc.getWorldQuaternion(new THREE.Quaternion()), ap = anc.getWorldPosition(_psV());
  const qw = aq.multiply(qOff.invert()), wp = ap.sub(_psV().set(0, -0.01, -0.05).applyQuaternion(qw));
  _prsM.compose(wp, qw, _prsOne).multiply(_prsM2.compose(H.p, H.q, _prsOne).invert());
  _prsM.decompose(B.position, B.quaternion, _psV());
  B.visible = av.hero.object.visible;
}
/* L'arme du joueur dans les mains du corps : une copie du modèle de l'arme (mêmes matières), main droite
   sur la poignée, main gauche là où la préhension la pose (centre de la paume), ou sur la poignée pour une
   arme tenue d'une main ; recul au tir, bascule et main gauche au chargeur pendant un rechargement. */
function persoArme(av, E, geste) {
  const key = E.arme && !E.siege ? E.arme.id + ':' + E.arme.tier : '';
  if (key !== av.gunKey) {
    av.hero.setWeapon(null);
    av.g = null;
    if (key) {
      let g = av.guns[key];
      if (!g) {
        const gun = buildGun(E.arme.id, E.arme.tier), hold = gunHold(gun), wrap = new THREE.Group(), fore = new THREE.Object3D();
        gun.rotation.y = Math.PI;                             // repère de l'arme du jeu : z vers l'arrière ; le sien : +Z vers l'avant
        wrap.add(gun); wrap.scale.setScalar(1 / PERSO.taille);
        const L = hold.L && !hold.L.free ? hold.L : null;
        if (L) fore.position.copy(L.p).add(_psV().set(0, -0.01, -0.05).applyQuaternion(L.q));
        else fore.position.set(0.035, -0.035, 0.02);          // tenue d'une main : la gauche sur la poignée
        gun.add(fore);
        const mag = gun.userData.parts && gun.userData.parts.mag;
        g = { gun, wrap, fore, fore0: fore.position.clone(), mag: mag ? mag.position.clone() : fore.position.clone().add(_psV().set(0, -0.04, 0.12)), muzzle: gun.userData.muzzle };
        av.guns[key] = g;
      }
      av.hero.setWeapon(g.wrap, g.fore);
      av.g = g;
    }
    av.gunKey = key;
  }
  const g = av.g;
  if (!g) return;
  g.wrap.visible = !geste;
  // recul, rechargement (bascule douce ; la main gauche et les pièces suivent le clip de la vue FPS : persoRecharge)
  const s = PERSO.taille, rl = E.etat === 'reload' && E.dur > 0 && !E.rl ? clamp(E.t / E.dur, 0, 1) : -1, c = rl >= 0 ? Math.sin(Math.PI * rl) : 0;
  g.wrap.position.set(0, -0.04 * c / s, -0.5 * (E.kick || 0) / s);
  g.wrap.rotation.set(-0.5 * (E.kickRot || 0) - 0.25 * c, 0, 0.45 * c);
  g.wrap.scale.setScalar(1 / s);                              // le rechargement du corps (section 18) la recalcule
  const m = rl >= 0 && !E.rl ? smooth(clamp((rl - 0.15) / 0.2, 0, 1)) * (1 - smooth(clamp((rl - 0.65) / 0.2, 0, 1))) : 0;
  g.fore.position.copy(g.fore0).lerp(g.mag, m);
  if (!E.rl) for (const n in g.gun.userData.parts) { const p = g.gun.userData.parts[n]; p.position.copy(p.userData.rest); p.quaternion.copy(p.userData.restQ); p.visible = !p.userData.spare; }
}
/* Rechargement du corps : section 18 (H3-corps-recharge.js). Chargeur lâché : il tombe au sol. */
const _prsQ = new THREE.Quaternion(), _prsM = new THREE.Matrix4(), _prsM2 = new THREE.Matrix4(), _prsOne = new THREE.Vector3(1, 1, 1);
function persoLacher(av, part) {
  part.updateMatrixWorld(true);
  const cl = part.clone(true);
  cl.visible = true; cl.traverse((x) => { x.visible = true; });
  part.matrixWorld.decompose(cl.position, cl.quaternion, cl.scale);
  scene.add(cl);
  (av.lache || (av.lache = [])).push({ o: cl, v: _psV().set(0, -0.5, 0), w: _psV().set(rand(-3, 3), rand(-2, 2), rand(-3, 3)), t: 0, sol: player.gy + 0.02 });
}
function persoLaches(av, dt) {
  if (!av.lache) return;
  for (let i = av.lache.length - 1; i >= 0; i--) {
    const L = av.lache[i];
    L.t += dt;
    if (L.o.position.y > L.sol) { L.v.y -= 9.8 * GRAV.k * dt; L.o.position.addScaledVector(L.v, dt); L.o.rotation.x += L.w.x * dt; L.o.rotation.z += L.w.z * dt; }
    else L.o.position.y = L.sol;
    if (L.t > 6) { scene.remove(L.o); av.lache.splice(i, 1); }
  }
}

/* ------------------------------------------------------------- pose assise (véhicules) */
/* Assis au volant (ou passager) : bassin sur le coussin, dos contre le dossier, pieds au plancher (le pied
   droit appuie avec l'accélérateur), mains sur le volant à 10 h 10 qui suivent sa rotation (au-delà de
   ±63°, elles glissent sur la jante), tête qui suit le regard. Le corps suit la caisse de la jeep. */
function persoAssis(av, E, dt) {
  const V = E.siege.V, J = V.jeep, P = PERSO_SIEGES.jeep[E.siege.place], hero = av.hero, o = hero.object, B = hero.bones, s = PERSO.taille;
  persoArme(av, E, null);
  if (av.down) { hero.revive(); av.down = false; }
  hero.update(dt, { speed: 0, crouch: false, armed: false, aim: false, onGround: true, lookPitch: E.look.pitch, turn: 0 });
  J.body.updateMatrixWorld(true);
  const bq = J.body.getWorldQuaternion(_psQ2()), at = (x, y, z) => J.body.localToWorld(_psV().set(x, y, z)), dir = (x, y, z) => _psV().set(x, y, z).applyQuaternion(bq);
  o.position.copy(at(P.x, P.sol, P.hanche[1]));
  o.quaternion.copy(bq);
  o.updateMatrixWorld(true);
  // bassin : les articulations des hanches à la hauteur voulue, bassin basculé en arrière
  B.hips.position.set(0, (P.hanche[0] - P.sol) / s - PERSO.thighOff, 0);
  B.hips.quaternion.setFromEuler(new THREE.Euler(-P.bassin, 0, 0));
  o.updateMatrixWorld(true);
  // jambes : genoux vers le haut et un peu en dehors, pieds à plat au plancher
  for (const [S, sx] of [['L', 1], ['R', -1]]) {
    const thr = S === 'R' && P.mains === 'volant' ? E.siege.thr || 0 : 0;
    const fq = bq.clone().multiply(_psQ2().setFromEuler(new THREE.Euler(0.22 * thr, 0, 0)));
    persoLegIK(av, S, at(P.x + sx * P.pieds[0], P.sol + PERSO.ankle * s, P.pieds[1]), dir(0.25 * sx, 1, 0.6), fq);
  }
  // mains
  if (P.mains === 'volant') {
    const mount = J.steeringWheel.parent, rot = clamp(J.steeringWheel.rotation.z, -1.1, 1.1), R = 0.19;
    mount.updateMatrixWorld(true);
    const mq = mount.getWorldQuaternion(_psQ2());
    for (const [S, sx] of [['L', 1], ['R', -1]]) {
      // repère du support du volant : z vers le conducteur, −y vers le haut, +x à sa gauche
      const th = (60 * Math.PI) / 180, x0 = Math.sin(th) * sx, y0 = -Math.cos(th);
      const x1 = x0 * Math.cos(rot) - y0 * Math.sin(rot), y1 = x0 * Math.sin(rot) + y0 * Math.cos(rot);
      const pos = mount.localToWorld(_psV().set(x1 * R, y1 * R, 0));
      let tg = _psV().set(-y1, x1, 0); if (tg.y > 0) tg.negate();       // tangente, vers le haut du volant
      const Y = tg.applyQuaternion(mq).normalize(), Z0 = _psV().set(0, 0, -1).applyQuaternion(mq);
      const Z = Z0.addScaledVector(Y, -Z0.dot(Y)).normalize(), X = _psV().crossVectors(Y, Z);
      const q = _psQ2().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      persoPlaceHand(av, S, pos, q, dir(0.7 * sx, -1, -0.4));
      B['fing' + S].quaternion.setFromEuler(new THREE.Euler(0, 0, 1.15 * -sx));
      B['fing2' + S].quaternion.setFromEuler(new THREE.Euler(0, 0, 1.25 * -sx));
    }
  } else {
    for (const [S, sx] of [['L', 1], ['R', -1]]) {        // passager : mains posées sur les cuisses
      const pos = at(P.x + sx * 0.12, P.hanche[0] + 0.08, P.hanche[1] + 0.3);
      const q = bq.clone().multiply(_psQ2().setFromEuler(new THREE.Euler(-1.3, 0, 0)));
      persoPlaceHand(av, S, pos, q, dir(0.8 * sx, -1, -0.3));
    }
  }
  // tête : elle suit le regard (lacet ; le tangage vient de son animation)
  const ly = clamp(E.look.yaw, -1.3, 1.3);
  B.neck.quaternion.multiply(_psQ2().setFromAxisAngle(_psV().set(0, 1, 0), ly * 0.4));
  B.head.quaternion.multiply(_psQ2().setFromAxisAngle(_psV().set(0, 1, 0), ly * 0.6));
  o.updateMatrixWorld(true);
  // yeux du conducteur, dans le repère de la jeep (sans la caisse) : la caméra du conducteur s'y place
  if (P.mains === 'volant' && Math.abs(E.look.yaw) < 0.05 && Math.abs(E.look.pitch) < 0.05 && !av.trans) {
    const e = J.object.worldToLocal(persoEye(av));
    PERSO.oeilVolant = e;
  }
}
/* Caméra du conducteur : à ses yeux (repère du modèle de la jeep), une fois le corps assis calculé. */
function persoDriverEye(V, out) {
  if (!PERSO.on || !PERSO.oeilVolant || !V.jeep) return null;
  return V.jeep.object.localToWorld(out.copy(PERSO.oeilVolant));
}

/* ------------------------------------------------------------- montée, descente */
function persoCapture(av) {
  const B = av.hero.skeleton.bones, o = av.hero.object;
  return { q: B.map((b) => b.quaternion.clone()), hip: av.hero.bones.hips.position.clone(), p: o.position.clone(), r: o.quaternion.clone() };
}
function persoBlend(av, A, Bp, k, lift) {
  const B = av.hero.skeleton.bones, o = av.hero.object;
  B.forEach((b, i) => b.quaternion.copy(A.q[i]).slerp(Bp.q[i], k));
  av.hero.bones.hips.position.copy(A.hip).lerp(Bp.hip, k);
  o.position.copy(A.p).lerp(Bp.p, k); o.position.y += lift;
  o.quaternion.copy(A.r).slerp(Bp.r, k);
  o.updateMatrixWorld(true);
}
/* Un corps : debout, assis, ou entre les deux (0,55 s) quand il monte ou descend. */
function persoAnimer(av, E, dt) {
  const was = av.siege;
  av.siege = E.siege ? E.siege.V : null;
  if (av.siege && !was && av.root) av.trans = { kind: 'monter', t: 0, from: av.root };
  else if (!av.siege && was && (!av.local || E.vue === 'tps')) av.trans = { kind: 'descendre', t: 0, V: was };
  else if (!av.siege && was) av.trans = null;
  if (av.trans) {
    const T = av.trans, k = smooth(clamp((T.t += dt) / 0.55, 0, 1));
    if (T.kind === 'monter') {
      persoAssis(av, E, dt);
      const A = persoCapture(av);
      const o = av.hero.object;
      o.position.copy(T.from.p); o.quaternion.copy(T.from.q); o.updateMatrixWorld(true);
      av.hero.update(0, { speed: 0, crouch: false, armed: false, aim: false, onGround: true, lookPitch: 0, turn: 0 });
      persoBlend(av, persoCapture(av), A, k, Math.sin(Math.PI * k) * 0.22);
    } else {
      const S = { V: T.V, place: 'conducteur', thr: 0 };
      persoAssis(av, Object.assign({}, E, { siege: S, look: { yaw: 0, pitch: 0 } }), dt);
      const A = persoCapture(av);
      persoDebout(av, E, dt);
      persoBlend(av, A, persoCapture(av), k, Math.sin(Math.PI * k) * 0.22);
    }
    if (T.t >= 0.55) av.trans = null;
    return;
  }
  if (E.siege) persoAssis(av, E, dt); else persoDebout(av, E, dt);
}

/* ------------------------------------------------------------- chaque image */
function persoKeys() {
  if (!pressed('KeyT') || G.state !== 'playing' || (OW.on && owDriving())) return;   // au volant, T change la vue du véhicule
  PERSO.vue = PERSO.vue === 'tps' ? 'fps' : 'tps';
  PERSO.tps.d = PERSO.tps.dist;
}
function persoUpdate(dt) {
  if (!PERSO.on || !PERSO.av) return;
  persoKeys();
  const av = PERSO.av, E = persoEtatLocal();
  av.shown = E.visible;
  PERSO.shown = E.visible;
  if (!E.visible) { av.yawPrev = null; av.trans = null; av.siege = E.siege ? E.siege.V : null; return; }
  persoAnimer(av, E, dt);
  PERSO.drop = av.drop; PERSO.lift = av.lift; PERSO.eyeY = av.eyeY;
}

/* ------------------------------------------------------------- vue TPS */
/* Caméra derrière l'épaule droite, parallèle au regard (choix d'Anthony : rien ne bouge pour viser) ; elle
   se rapproche d'un mur sans le traverser (tout de suite), puis revient doucement. La caméra du jeu reste aux
   yeux du joueur : tirs, couteau, objets et sons ne changent pas ; le réticule se place sur le point visé. */
function persoTps() {
  return !!(PERSO.on && PERSO.av && PERSO.vue === 'tps' && (G.state === 'playing' || G.state === 'paused') && !viewCamera && !(OW.on && owDriving()));
}
function persoCamera() { return persoTps() ? persoTpsCam() : camera; }
function persoTpsCam() {
  const T = PERSO.tps, C = PERSO.cam || (PERSO.cam = new THREE.PerspectiveCamera(60, 1, 0.05, 220));
  const now = performance.now(), dt = T.t0 ? Math.min(0.1, (now - T.t0) / 1000) : 0;
  T.t0 = now;
  const vf = (2 * Math.atan(Math.tan((settings.fov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;   // sans le zoom de visée
  if (C.fov !== vf || C.aspect !== camera.aspect || C.near !== camera.near || C.far !== camera.far) {
    C.fov = vf; C.aspect = camera.aspect; C.near = camera.near; C.far = camera.far; C.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  C.quaternion.copy(camera.quaternion);
  const piv = camera.position, off = _psV().set(T.cote, T.haut, T.dist).applyQuaternion(camera.quaternion);
  const len = off.length(); off.normalize();
  if (typeof B7S === 'object') B7S.cameraTps = true;            // jeu 2.0.7 : les dalles lancées par le boss ne tirent pas la caméra (vertige ; H7)
  raycast(piv.x, piv.y, piv.z, off.x, off.y, off.z, len + T.marge);
  if (typeof B7S === 'object') B7S.cameraTps = false;
  let d = RAY.hit && RAY.t < len + T.marge ? Math.max(0.2, RAY.t - T.marge) : len;
  T.d = d < T.d || !dt ? d : damp(T.d, d, 4, dt);
  C.position.copy(piv).addScaledVector(off, T.d);
  if (!OW.on && typeof WALL_H === 'number') {                   // cartes en grille : sous le plafond de l'étage
    const E = LVY[Math.max(0, levelAtY(player.gy + 0.1))] || 0;
    C.position.y = Math.min(C.position.y, E + WALL_H - 0.12);
  }
  C.updateMatrixWorld();
  return C;
}
/* Réticule : sur le point visé (le rayon de la caméra du jeu), vu par la caméra TPS. */
function persoCrosshair(on) {
  const el = HUD.el && HUD.el.crosshair;
  if (!el) return;
  if (!on) { if (el.style.left) { el.style.left = ''; el.style.top = ''; } return; }
  const c = camera.position, f = _psV().set(0, 0, -1).applyQuaternion(camera.quaternion);
  raycast(c.x, c.y, c.z, f.x, f.y, f.z, 140);
  const t = RAY.hit ? RAY.t : 140, P = c.clone().addScaledVector(f, Math.max(0.5, t)).project(PERSO.cam);
  el.style.left = `${(50 + P.x * 50).toFixed(2)}%`; el.style.top = `${(50 - P.y * 50).toFixed(2)}%`;
  el.classList.remove('ads');                                    // pas de mire en vue TPS : le réticule reste
}
/* Éclair du coup en vue TPS : au bout du canon du corps (la vue de l'arme n'est pas dessinée). */
function persoTpsFlash(on) {
  const av = PERSO.av, g = av && av.g;
  if (!PERSO.flash) {
    if (!on) return;
    PERSO.flash = new THREE.Sprite(Arms.flash.material.clone()); PERSO.flash.material.depthTest = true; PERSO.flash.visible = false; scene.add(PERSO.flash);
  }
  const F = PERSO.flash;
  F.visible = !!(on && g && g.wrap.visible && Arms.flash.visible);
  if (!F.visible) return;
  g.muzzle.getWorldPosition(F.position);
  F.material.color.copy(Arms.flash.material.color); F.material.rotation = Arms.flash.material.rotation;
  F.scale.setScalar(Arms.flash.scale.x * 2.2);
}
/* Bout du canon en vue TPS (traçantes et projectiles partent du canon du corps). */
function persoMuzzle(out) {
  const g = persoTps() && PERSO.av && PERSO.av.g;
  if (!g || !g.wrap.visible) return null;
  PERSO.av.hero.object.updateMatrixWorld(true);
  return g.muzzle.getWorldPosition(out);
}
function persoBeforeRender() {
  const av = PERSO.av;
  if (!av) return;
  const shown = PERSO.on && av.shown && persoEtatLocal().visible;
  av.hero.object.visible = shown;
  const tps = persoTps();
  if (av.g) av.g.wrap.visible = av.g.wrap.visible && (tps || (OW.on && owDriving()) || !av.local);
  if (tps) persoTpsCam();
  persoCrosshair(tps);
  persoTpsFlash(tps && shown);
}
