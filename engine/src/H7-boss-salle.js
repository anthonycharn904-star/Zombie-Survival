/* ================================================================= 22 SALLE DU BOSS ==
   Salle secrète du boss de Bunker 7, « Chambre du Pacte » (jeu 2.0.7, étape 4 du brief ; suivi : SUIVI-BOSS-B7.md).
   · Construite par le constructeur du prototype d'Anthony (ProtoB7Monde : prototype/proto-monde.js, avec proto-commun.js,
     proto-nav.js et proto-zombies.js pour le mini-boss endormi des cuves), inséré tel quel par build.py comme le permet le
     brief (§4) : géométrie, matières, cuves, dalles, piliers et leur effondrement, autel, lustre, braseros, poussière,
     puits de lumière. Créée une fois, au premier chargement de Bunker 7 en jeu (jamais dans les Mod Tools) ; la maquette
     de Bunker 7 que le prototype construit avec elle n'est jamais dessinée.
   · Place (D12) : BOSS_B7_ARENE.salle.origine (engine/boss-b7/arene.js), au niveau du sol, loin au sud de la carte, hors
     de ses abords. À chaque construction du monde de Bunker 7, la salle est ajoutée à sa grille par des lignes de cases
     posées sous la carte (les cases de la carte gardent leurs numéros) : sol de l'octogone, mur autour, piliers, cuves et
     meubles en obstacles. La carte (données, Mod Tools, plan) ne change pas. Ce qui suit la grille y marche donc sans
     autre changement : sol et déplacements, champ de flux des zombies, apparitions, chemins, débris.
   · Collisions exactes : après la grille, les corps (joueur, zombies) sont repoussés par les collisions du prototype
     (octogone jouable, piliers, cuves, autel, meubles : b7SalleCorps, depuis settleBody) ; tirs, grenades et lignes de
     vue partis de la salle touchent son décor exact (b7SalleRayon, depuis raycast).
   · Vue : la salle n'est dans la scène que quand le joueur (hors partie : la caméra) y est, et Bunker 7 n'est pas dessiné
     pendant ce temps (hors de la salle, ses lampes ne comptent pas et rien d'elle n'est recalculé). Ambiance de la salle
     du prototype (brume, fond, exposition 1, son hémisphère à la place de celui du jeu, sans lune), celle de la carte
     rendue à la sortie.
   · Lumières : le prototype éclaire en unités physiques (physicallyCorrectLights), le jeu en unités anciennes. Les lampes
     de la salle portent une marque dans PointLight.decay (B7S_MARQUE, comme la bande d'étage de lightBandDecay) et leur
     intensité est divisée par π ; pour une lampe marquée, le shader de toutes les matières prend la chute de lumière
     physique (1 / d², fenêtre de three.js) : tout ce qu'elles éclairent (salle, zombies, joueur, Septième) l'est comme
     dans la démo. Les lampes des effets du boss portent la même marque (section 23) ; les autres lampes du jeu (Bunker 7,
     éclairs des armes) gardent la chute ancienne.
   · Combat : dalles, piliers et cuves suivent l'état de la logique à chaque image ; la grille d'une brèche se soulève quand
     un zombie en sort ; les dégâts d'un pilier sont tournés vers le point touché (évènement « pilier »).
   ============================================================================ */
const B7S = {
  monde: null, racine: null, err: null, ms: 0,
  actif: false,                // salle ajoutée à la grille du monde courant
  dans: false,                 // vue dans la salle : son ambiance
  sauve: null,                 // ambiance de la carte, gardée pendant le séjour dans la salle
  O: null, demi: 0,            // origine de la salle ; demi-côté de son carré englobant (m)
  cases: null,                 // cases de la salle dans la grille : { x0, x1, z0, z1, gh0, sol, murs, obstacles }
  k: null,                     // facteur appliqué aux lampes de la salle (b7SalleIntensite)
};
const B7S_AMB = { fond: 0x020203, brume: 0x05060a, densite: 0.024, exposition: 1.0 };   // ambiance de la salle du prototype
const B7S_MARQUE = 7;          // PointLight.decay d'une lampe de la salle (aucune lampe du jeu n'a cette valeur)
const _b7sV = new THREE.Vector3(), _b7sP = { x: 0, z: 0 };
/* Chute de lumière des lampes marquées (une fois, avant toute compilation) : celle des unités physiques de three r128. */
(function b7SalleChuteLumiere() {
  const C = THREE.ShaderChunk, anc = 'return pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );';
  if (!C.bsdfs || C.bsdfs.split(anc).length !== 2) { console.warn('[boss B7] salle : chute de lumière de la démo indisponible (three.js inattendu)'); return; }
  C.bsdfs = C.bsdfs.replace(anc, [
    `if ( abs( decayExponent - ${B7S_MARQUE.toFixed(1)} ) < 0.01 ) return pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) ) / max( lightDistance * lightDistance, 0.01 );   // jeu 2.0.7 : lampe de la salle du boss`,
    anc,
  ].join('\n\t\t'));
})();

/* ------------------------------------------------------------- Création --- */
/* Salle construite une fois (premier chargement de Bunker 7 en jeu), hors de la scène jusqu'à ce que le joueur y entre. */
function b7SalleCreer() {
  const S = B7S;
  if (S.monde) return true;
  if (S.err) return false;
  try {
    if (typeof ProtoB7Monde !== 'object' || typeof BOSS_B7_ARENE !== 'object') throw new Error('constructeur de la salle absent');
    const t0 = performance.now(), O = BOSS_B7_ARENE.salle.origine;
    const m = ProtoB7Monde.creer(THREE, { arene: BOSS_B7_ARENE, renderer, qualite: settings.quality === 'low' ? 'basse' : 'haute', ombres: false });
    const R = m.racineSalle;
    R.parent.remove(R);                          // la racine quitte la scène du prototype ; celle du jeu la reçoit à l'entrée
    R.traverse((o) => {
      if (o.isLight) {
        o.userData.b7base = o.intensity / Math.PI;                   // unités du jeu (÷ π) ; intensité à pleine lumière
        if (o.isHemisphereLight) o.position.set(-O.x, 1 - O.y, -O.z);  // direction de l'hémisphère : sa position dans le monde
        else o.decay = B7S_MARQUE;                                    // chute de lumière de la démo (b7SalleChuteLumiere)
      }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const mt of mats) _linDone.add(mt);                       // couleurs déjà linéaires (compat du prototype)
    });
    R.updateMatrixWorld(true);
    S.monde = m; S.racine = R; S.O = O;
    b7SalleIntensite(1);
    m.mettreAJour(0, 0);
    S.demi = BOSS_B7_ARENE.salle.apotheme / Math.cos(Math.PI / 8) + 1;
    S.ms = Math.round(performance.now() - t0);
    return true;
  } catch (e) {
    S.err = String((e && e.message) || e);
    console.error('[boss B7] salle', e);
    return false;
  }
}

/* ------------------------------------------------------------- Grille --- */
/* Ajoute la salle à la grille de Bunker 7 : lignes de cases sous la carte (un seul niveau ; numéros des cases de la carte
   inchangés). Sol : les cases qui touchent l'octogone jouable (les collisions exactes tiennent les corps dedans) ; mur :
   l'anneau de cases autour ; obstacles : piliers, cuves, autel et meubles (cases sous leur forme). */
function b7SalleGrille() {
  const S = B7S, A = BOSS_B7_ARENE.salle, O = A.origine, L = A.limiteJoueurs, R = A.apotheme / Math.cos(Math.PI / 8);
  const x0 = Math.floor(O.x - R) - 1, x1 = Math.ceil(O.x + R) + 1, z0 = Math.floor(O.z - R) - 1, z1 = Math.ceil(O.z + R) + 1;
  if (NL !== 1 || airBands.length || x0 < 0 || x1 > GW || z0 < GH || Math.abs(O.y - LVY[0]) > 0.01) {
    b7Journal('erreur', `salle : place impossible dans cette grille (${GW} × ${GH}, ${NL} niveau(x)) : pas de boss sur cette carte`);
    return false;
  }
  // garde-fou (étape 9) : chaque tableau par case créé par allocGrid est agrandi ci-dessous ; un tableau inconnu (version
  // future du jeu) n'aurait pas les cases de la salle : salle refusée, en le nommant
  const agrandis = ['grid', 'solidTop', 'doorOf', 'doorOpen', 'zoneOf', 'interior', 'noCeil', 'ceilOn', 'hole', 'holeZone', 'surfK', 'surfH0',
    'surfH1', 'surfDin', 'surfDout', 'stairAt', 'edgeTo', 'flow', '_heapI', '_heapD'];
  const inconnus = [...String(allocGrid).matchAll(/(\w+)\s*=\s*new\s+\w*Array\(/g)].map((m) => m[1]).filter((k) => !agrandis.includes(k));
  if (inconnus.length) {
    b7Journal('erreur', `salle : tableaux par case inconnus (${inconnus.join(', ')}), à agrandir dans b7SalleGrille : pas de boss sur cette carte`);
    return false;
  }
  const gh0 = GH, n0 = GN, n = GW * z1;
  const grow = (a, Ctor, fill, per = 1) => { const b = new Ctor(n * per); if (fill !== undefined) b.fill(fill); b.set(a.subarray(0, n0 * per)); return b; };
  grid = grow(grid, Uint8Array); solidTop = grow(solidTop, Float32Array);
  const portes = new Array(n).fill(null);
  for (let i = 0; i < n0; i++) portes[i] = doorOf[i];
  doorOf = portes;
  doorOpen = grow(doorOpen, Uint8Array); zoneOf = grow(zoneOf, Int16Array, -1); interior = grow(interior, Uint8Array);
  noCeil = grow(noCeil, Uint8Array); ceilOn = grow(ceilOn, Uint8Array); hole = grow(hole, Uint8Array); holeZone = grow(holeZone, Int16Array, -1);
  surfK = grow(surfK, Uint8Array); surfH0 = grow(surfH0, Float32Array); surfH1 = grow(surfH1, Float32Array);
  surfDin = grow(surfDin, Uint8Array); surfDout = grow(surfDout, Uint8Array); stairAt = grow(stairAt, Int16Array, -1);
  edgeTo = grow(edgeTo, Int8Array, -1, 4);
  flow = new Float32Array(n).fill(1e9); _heapI = new Int32Array(n * 8); _heapD = new Float32Array(n * 8);
  GH = z1; GN = n;
  // sol : la case touche l'octogone jouable (séparation : pour chaque mur, son coin le plus en dedans est en deçà du plan)
  const N8 = A.murs.map((m) => m.normale), E = LVY[0];
  const sol = (cx, cz) => N8.every((nm) => {
    let lo = Infinity;
    for (const [ax, az] of [[0, 0], [1, 0], [0, 1], [1, 1]]) lo = Math.min(lo, (cx + ax - O.x) * nm.x + (cz + az - O.z) * nm.z);
    return lo <= L;
  });
  let nSol = 0, nMur = 0, nObs = 0;
  for (let cz = z0; cz < z1; cz++) for (let cx = x0; cx < x1; cx++) {
    if (!sol(cx, cz)) continue;
    const k = cz * GW + cx;
    grid[k] = T.FLOOR; surfK[k] = 1; surfH0[k] = surfH1[k] = E; interior[k] = 1; nSol++;
  }
  for (let cz = z0; cz < z1; cz++) for (let cx = x0; cx < x1; cx++) {
    const k = cz * GW + cx;
    if (grid[k] !== T.VOID) continue;
    let pres = false;
    for (let dz = -1; dz <= 1 && !pres; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x >= x0 && x < x1 && z >= z0 && z < z1 && grid[z * GW + x] === T.FLOOR) { pres = true; break; }
    }
    if (pres) { grid[k] = T.WALL; nMur++; }
  }
  // obstacles : la case du centre de chaque forme, et celles qu'elle couvre à 15 cm près (piliers, cuves, autel, meubles)
  const obstacle = (cx, cz) => {
    const k = cz * GW + cx;
    if (grid[k] !== T.FLOOR) return;
    grid[k] = T.PILLAR; surfK[k] = 0; nObs++;
  };
  for (const p of S.monde.collisions.salle.prims) {
    const px = O.x + p.x, pz = O.z + p.z;
    if (p.t === 1) {
      const r = p.pilier ? 1.12 : p.r;                // pilier : sa base (le moignon d'un pilier effondré reste un obstacle)
      obstacle(Math.floor(px), Math.floor(pz));
      for (let cz = Math.floor(pz - r); cz <= Math.floor(pz + r); cz++) for (let cx = Math.floor(px - r); cx <= Math.floor(px + r); cx++) {
        let dedans = true;
        for (const [ax, az] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (Math.hypot(cx + ax - px, cz + az - pz) > r + 0.15) { dedans = false; break; }
        if (dedans) obstacle(cx, cz);
      }
    } else if (p.t === 2) {
      obstacle(Math.floor(px), Math.floor(pz));
      const e = Math.hypot(p.hx, p.hz);
      for (let cz = Math.floor(pz - e); cz <= Math.floor(pz + e); cz++) for (let cx = Math.floor(px - e); cx <= Math.floor(px + e); cx++) {
        let dedans = true;
        for (const [ax, az] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const dx = cx + ax - px, dz = cz + az - pz, lx = dx * p.c - dz * p.s, lz = dx * p.s + dz * p.c;
          if (Math.abs(lx) > p.hx + 0.15 || Math.abs(lz) > p.hz + 0.15) { dedans = false; break; }
        }
        if (dedans) obstacle(cx, cz);
      }
    }
  }
  buildEdges();
  S.cases = { x0, x1, z0, z1, gh0, sol: nSol, murs: nMur, obstacles: nObs };
  return true;
}
/* Le monde courant change (autre carte, monde ouvert compris) : la salle n'en fait plus partie. */
function b7SalleQuitter() {
  const S = B7S;
  if (S.sauve && HEMI) HEMI.visible = S.sauve.hemi;  // monde changé pendant un séjour dans la salle : l'hémisphère du jeu revient
  S.actif = false; S.dans = false; S.sauve = null; S.cases = null;
  if (S.racine && S.racine.parent) S.racine.parent.remove(S.racine);
}
/* Construction du monde (fin de buildWorld) : salle ajoutée à la grille de Bunker 7 en jeu ; ailleurs, rien. */
function b7SalleCarte(map) {
  const S = B7S;
  b7SalleQuitter();
  if (!B7.on || CUR.editor || map.open || map.id !== BUNKER7.id) return;
  if (!b7SalleCreer()) { b7Journal('erreur', `salle : ${B7S.err}`); return; }
  S.actif = b7SalleGrille();
}

/* ---------------------------------------------------- Collisions et tirs --- */
const b7SalleProche = (x, z) => Math.abs(x - B7S.O.x) <= B7S.demi && Math.abs(z - B7S.O.z) <= B7S.demi;
/* Corps posé par settleBody : repoussé par les collisions exactes de la salle (octogone, piliers, cuves, autel, meubles). */
function b7SalleCorps(b, r) {
  if (!B7S.actif || b.k < 0 || !b7SalleProche(b.pos.x, b.pos.z) || Math.abs((b.gy || 0) - B7S.O.y) > 2) return;
  _b7sP.x = b.pos.x; _b7sP.z = b.pos.z;
  if (!B7S.monde.resoudre('salle', _b7sP, r)) return;
  b.pos.x = _b7sP.x; b.pos.z = _b7sP.z;
  const k = followCells(b.k, b.pos);
  b.k = k;
  b.gy = surfY(k, b.pos.x, b.pos.z);
  if (b === player && B7J.projT > 0 && B7S.monde.contactMur) b7ImpactMur();   // étape 6 : projeté contre un mur de l'octogone
}
/* Point libre de la salle pour un corps de rayon r (dans l'octogone, hors des obstacles) ? */
function b7SalleLibre(p, r = 0.4) {
  if (!B7S.actif) return false;
  _b7sP.x = +p.x; _b7sP.z = +p.z;
  B7S.monde.resoudre('salle', _b7sP, r);
  return Math.hypot(_b7sP.x - p.x, _b7sP.z - p.z) < 0.02;
}
/* Tir parti de la salle : le décor exact du prototype (mêmes solides et mêmes règles que monde.tir, sans tester les
   solides hors du segment). Remplit RAY ; false si le rayon ne part pas de la salle. */
const _b7sRay = new THREE.Raycaster(), _b7sHits = [], _b7sSph = new THREE.Sphere(), _b7sN = new THREE.Vector3();
function b7SalleRayon(ox, oy, oz, dx, dy, dz, maxT) {
  const S = B7S;
  if (!S.actif || !b7SalleProche(ox, oz) || oy < S.O.y - 1 || oy > S.O.y + 15) return false;
  const len = Math.hypot(dx, dy, dz) || 1, far = maxT * len;
  _b7sRay.ray.origin.set(ox, oy, oz);
  _b7sRay.ray.direction.set(dx / len, dy / len, dz / len);
  _b7sRay.near = 0; _b7sRay.far = far;
  const o = _b7sRay.ray.origin, d = _b7sRay.ray.direction;
  _b7sHits.length = 0;
  for (const m of S.monde.solides.salle) {
    if ((!m.visible && !m.userData.proxy) || (m.parent && m.parent !== S.racine && !m.parent.visible)) continue;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    _b7sSph.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
    const cx = _b7sSph.center.x - o.x, cy = _b7sSph.center.y - o.y, cz = _b7sSph.center.z - o.z;
    const t = clamp(cx * d.x + cy * d.y + cz * d.z, 0, far);
    if ((cx - d.x * t) ** 2 + (cy - d.y * t) ** 2 + (cz - d.z * t) ** 2 > _b7sSph.radius * _b7sSph.radius) continue;
    m.raycast(_b7sRay, _b7sHits);
  }
  let h = null;
  for (const c of _b7sHits) if (c.distance <= far && (!h || c.distance < h.distance)) h = c;
  RAY.hit = !!h;
  if (h) {
    RAY.t = h.distance / len;
    RAY.x = h.point.x; RAY.y = h.point.y; RAY.z = h.point.z;
    if (h.face) _b7sN.copy(h.face.normal).transformDirection(h.object.matrixWorld); else _b7sN.set(0, 1, 0);
    if (_b7sN.dot(d) > 0) _b7sN.negate();
    RAY.nx = _b7sN.x; RAY.ny = _b7sN.y; RAY.nz = _b7sN.z;
    const cx = Math.floor(RAY.x), cz = Math.floor(RAY.z);
    RAY.cell = inb(cx, cz) ? cz * GW + cx : -1; RAY.type = T.WALL;
  } else {
    RAY.t = maxT; RAY.x = ox + dx * maxT; RAY.y = oy + dy * maxT; RAY.z = oz + dz * maxT;
  }
  return true;
}

/* ------------------------------------------------------------- Vue --- */
/* Avant chaque rendu : la salle dans la scène seulement quand on y est (le joueur en partie, sinon la caméra), Bunker 7
   caché pendant ce temps ; ambiance de la salle à l'entrée, celle de la carte rendue à la sortie. */
function b7SalleAvantRendu() {
  const S = B7S;
  if (!S.racine) return;
  let dans = false;
  if (S.actif && !OW.on && G.state !== 'editor') {   // Mod Tools : jamais (après une partie de test, le monde garde la salle)
    const p = G.state === 'playing' || G.state === 'paused' || G.state === 'gameover' ? _b7sV.set(player.pos.x, player.gy, player.pos.z) : (viewCamera || camera).position;
    dans = b7LieuDe(p) === 'salle';
  }
  if (dans !== S.dans) b7SalleAmbiance(dans);
  if (dans && S.racine.parent !== scene) scene.add(S.racine);
  else if (!dans && S.racine.parent) S.racine.parent.remove(S.racine);
  b7VueAvantRendu(dans);                         // étape 5 : le Septième et les effets du lieu
  if (dans && B7.e && !B7A.compile) b7Precompiler();   // étape 8 : première entrée pendant le combat, matières compilées d'un coup
}
function b7SalleAmbiance(dans) {
  const S = B7S;
  S.dans = dans;
  if (dans) {
    S.sauve = { root: World.root, rootVisible: World.root ? World.root.visible : true, fond: scene.background, brume: scene.fog.color.clone(), densite: scene.fog.density,
      exposition: renderer.toneMappingExposure, hemi: HEMI ? HEMI.visible : true, lune: MOON ? MOON.visible : false };
    if (World.root) World.root.visible = false;
    scene.background = new THREE.Color(B7S_AMB.fond).convertSRGBToLinear();
    scene.fog.color.setHex(B7S_AMB.brume).convertSRGBToLinear();
    scene.fog.density = B7S_AMB.densite;
    renderer.toneMappingExposure = B7S_AMB.exposition;
    if (HEMI) HEMI.visible = false;               // l'hémisphère de la salle le remplace (même nombre de lumières)
    if (MOON) MOON.visible = false;
    return;
  }
  const s = S.sauve;
  S.sauve = null;
  if (!s || s.root !== World.root) return;        // monde reconstruit entre-temps : il a déjà son ambiance
  if (World.root) World.root.visible = s.rootVisible;
  scene.background = s.fond; scene.fog.color.copy(s.brume); scene.fog.density = s.densite;
  renderer.toneMappingExposure = s.exposition;
  if (HEMI) HEMI.visible = s.hemi;
  if (MOON) MOON.visible = s.lune;
}

/* ------------------------------------------------------------- Combat --- */
/* Chaque image (b7Update) : dalles, piliers et cuves selon la logique ; flammes, braises, poussière, grilles et cuves
   animées tant que le joueur est dans la salle. */
function b7SalleMaj(dt) {
  const S = B7S;
  if (!S.actif) return;
  const e = B7.e;
  if (e) {
    S.monde.appliquerBlocs(e.blocs, G.time);
    if (e.piliers) S.monde.appliquerPiliers(e.piliers, G.time);
    if (e.tubes) S.monde.appliquerTubes(e.tubes, G.time);
  }
  if (S.dans || b7LieuDe(_b7sV.set(player.pos.x, player.gy, player.pos.z)) === 'salle') S.monde.mettreAJour(dt, G.time);
}
/* Lampes de la salle à pleine lumière × k (obscurité et éclats des effets du boss : fx.facteurLumiere('salle')). Les lampes
   qui vacillent (braseros, autel, lustre, accents, cuves) reçoivent k dans leur multiplicateur (le prototype les recalcule
   à chaque image depuis leur base physique) ; les autres (hémisphère, projecteur de l'oculus), leur intensité. */
function b7SalleIntensite(k) {
  const S = B7S, R = S.racine || (S.monde && S.monde.racineSalle);
  if (!R || S.k === k) return;
  S.k = k;
  R.traverse((o) => {
    if (!o.isLight || o.userData.b7base == null) return;
    if (o.userData.base != null) o.userData.multiplicateur = k / Math.PI;
    else o.intensity = o.userData.b7base * k;
  });
}
/* Nouvelle partie : dalles en place, piliers et cuves remis à neuf (le combat est à l'état « inactif »). */
function b7SalleRemettre() {
  const S = B7S;
  if (!S.monde) return;
  const A = BOSS_B7_ARENE.salle;
  S.monde.appliquerBlocs([], G.time);
  S.monde.appliquerPiliers(A.piliers.map((p) => ({ id: p.id, etat: 'intact', coups: 0, t: 0 })), G.time);
  S.monde.appliquerTubes((A.tubes || []).map((t) => ({ id: t.id, etat: 'intact', t: 0 })), G.time);
}
/* Un zombie sort par une brèche de la salle : sa grille se soulève (comme dans le prototype). */
function b7SalleBreche(x, z) {
  const S = B7S;
  if (!S.actif) return;
  const i = S.monde.brecheProche(x - S.O.x, z - S.O.z);
  if (i >= 0) S.monde.ouvrirBreche(i, 2.4);
}
/* Évènement « pilier » touché : fissures et éclats tournés vers le point d'impact réel. */
function b7SallePilier(d) {
  if (B7S.monde && d && d.etat === 'touche') B7S.monde.impactPilier(d.id, d.pointImpact, d.coups);
}
