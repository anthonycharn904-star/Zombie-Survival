/* ============================================================== 24 ENNEMIS DU BOSS ==
   Ennemis et mécaniques du combat du boss de Bunker 7 (jeu 2.0.7, étape 6 du brief ; suivi : SUIVI-BOSS-B7.md).
   · Chiens de la meute (v1.2) : le chien du jeu, Le Molosse (le brief : « celui du jeu s'il existe »), avec le profil du
     combat : PV, galop (7,4 m/s), morsure (5 % des PV max toutes les 0,9 s à 1,4 m, bond compris). Il jaillit de la
     faille que dessinent les effets du boss (ni éclair ni secousse du jeu), chasse dans la salle comme dans Bunker 7
     (grille du jeu) ; tué, il éclate comme toujours, sans souffle ni secousse ; points habituels. Perdu ou bloqué, le jeu
     ne le déplace pas : la logique le remplace par une nouvelle faille.
   · Mini-boss (Le Survolté, L'Irradié, Le Démembré géant) et petits Démembrés : le module des zombies du prototype
     d'Anthony (ProtoB7Zombies, prototype/proto-zombies.js, inséré tel quel par build.py), qui porte leurs modèles, leurs
     animations, leur IA et leurs capacités : décharges et arcs, aura, boules et zones radioactives, flaque, fléau, rages,
     bras arraché, charge. Il vit dans la salle (grille de navigation, collisions et lignes de vue du monde de la salle,
     B7S.monde) à travers une façade qui le place dans le repère du jeu (b7EnnemisMonde : cuves, lampe de cuve prêtée).
     Ses zombies et ses chiens ne servent pas : ce sont ceux du jeu.
   · Tirs : chaque entité du module a une entrée dans la liste des zombies (b7ent, comme le Septième : place de rendu
     cachée, multiplicateur de tête 1) ; toutes les armes du jeu la trouvent. Rayons contre les zones de tir du module
     (tête, torse, jambes, bras pendu du géant) ; dégâts par le module (tête × 2 ; rien pendant la sortie de cuve, la
     sortie du sol et les rages). Mini-boss : jamais tués d'un coup (Onde de choc : 1 393, 2 786 améliorée, D5 ; Bombe,
     onde du Glas et Mort instantanée sans effet), 500 points à l'élimination, aucun par touche ; bouclier (étincelles)
     quand il est invulnérable. Petits Démembrés : règles et points d'un zombie du jeu.
   · Joueur (comme prototype/proto-joueur.js) : vision brouillée (décharge du Survolté), étourdissement (ni déplacement,
     ni saut, ni tir, ni rechargement, ni couteau, ni grenade ; la vue reste libre et ne tremble pas, vertige d'Anthony :
     voile électrique bref et son du combat ; « Étourdi » dans l'interface du combat), projection par la charge du
     Démembré (vitesse imposée qui faiblit, commandes coupées, collisions comprises, sans saut ni secousse ; contre un
     mur de la salle : dégâts en plus).
   · Irradiation (rage de L'Irradié) des zombies et chiens du jeu : teinte et lueur vertes, aura de 4 % des PV max par
     seconde à 1,5 m, par tics de 0,25 s (comme le module) ; leur lueur au sol est dessinée par les effets du boss.
   ============================================================================ */
const B7E = {
  Z: null, err: null,                         // module des zombies du prototype (mini-boss, petits Démembrés)
  gS: null, gB: null,                         // ses groupes (origine du monde) : salle ; Bunker 7 (jamais dessiné)
  ents: new Map(),                            // id du module → son entrée dans Zombies.list (tirs)
  type: null,                                 // type de ces entrées
  lum: new Map(),                             // lampe de cuve prêtée : doublure du module → lampe de la salle
  irr: new Set(),                             // zombies et chiens du jeu irradiés
  irrPts: null, irrPos: null, irrT: 0,        // leurs lueurs ; horloge des tics d'aura
  reste: 0,                                   // secondes de mise à jour après le combat (morts et effets qui finissent)
  plein: false,                               // plus de place dans la liste des zombies (signalé une fois)
};
const B7J = {                                 // mécaniques du joueur pendant le combat
  flouT: 0, flouD: 0, flouAge: 99,            // vision brouillée
  etourdiT: 0, voileAge: 99,                  // étourdissement
  projT: 0, projD: 0, vx: 0, vz: 0,           // projection (charge du Démembré)
  els: null, eclairs: null, pas: [-1, -1, -1], OPA: [],   // couches (flou, éblouissement, voile) et opacités posées
};
for (let i = 0; i <= 40; i++) B7J.OPA.push(String(i / 40));
const B7_TYPES_ENT = ['survolte', 'irradie', 'demembre', 'demembre_petit'];
// étourdi ou projeté : déplacement, saut, sprint, accroupi et glissade, rechargement, couteau, grenade
const B7_TOUCHES_FIGEES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR', 'KeyV', 'KeyE', 'KeyG']);
const B7_IRR_COUL = 0x8cff2e;
const b7EstEnt = (id) => typeof id === 'string' && /^[a-z]/.test(id);   // identifiants du module : 'm12'…

/* ------------------------------------------------------------- Création --- */
/* Le module, une fois, avec le combat (première partie sur Bunker 7, la salle déjà construite). */
function b7EnnemisCreer() {
  const E = B7E;
  if (E.Z) return true;
  if (E.err || !B7S.monde) return false;
  try {
    if (typeof ProtoB7Zombies !== 'object') throw new Error('module des zombies du prototype absent');
    E.gS = new THREE.Group(); E.gB = new THREE.Group();
    E.gS.name = 'boss-b7-ennemis-salle'; E.gB.name = 'boss-b7-ennemis-bunker';
    E.Z = ProtoB7Zombies.creer(THREE, {
      monde: b7EnnemisMonde(), max: 1, maxChiens: 1,           // zombies et chiens : ceux du jeu
      halosIrradies: false,                                    // lueur au sol des irradiés : les effets du boss
      surAttaque: (m, id) => { if (m && m.degats > 0) b7Degats(id, m.degats); },   // coup au contact (fraction des PV max)
      surCapacite: b7Capacite,
    });
    E.Z.brancherDegats(b7DegatsCapacite);
    E.type = Object.assign({}, BASE_TYPE, { id: 'b7_ennemi', name: 'Ennemi du Septième', headMult: 1, boss: true });
    b7IrrCreer();
    b7JoueurCreer();
    return true;
  } catch (e) {
    E.Z = null; E.err = String((e && e.message) || e);
    console.error('[boss B7] ennemis', e);
    return false;
  }
}
/* Le monde de la salle vu par le module : le prototype pose sa salle à l'origine du monde, le jeu en
   BOSS_B7_ARENE.salle.origine. Cuves en coordonnées du monde ; lampe de cuve prêtée par une doublure, que le module place
   dans le monde et en unités physiques (b7LumieresPretees la recopie dans la salle, en unités du jeu). */
function b7EnnemisMonde() {
  const M = B7S.monde, O = B7S.O;
  return {
    scenes: { salle: B7E.gS, bunker: B7E.gB },
    grilles: M.grilles,
    tubes: M.tubes.map((t) => Object.assign({}, t, { x: O.x + t.x, z: O.z + t.z })),
    lieuDe: () => 'salle',
    resoudre: (lieu, p, r) => lieu === 'salle' && M.resoudre('salle', p, r),
    visible: (a, b) => M.visible(a, b, 'salle'),
    tir: (lieu, o, d, max) => M.tir('salle', o, d, max),
    cacherDormeur: (id) => M.cacherDormeur(id),
    emprunterLumiereTube: b7EmprunterLumiere,
    rendreLumiereTube: b7RendreLumiere,
    brecheProche: (x, z) => M.brecheProche(x - O.x, z - O.z),
    ouvrirBreche: (i, d) => M.ouvrirBreche(i, d),
  };
}
function b7EmprunterLumiere(cle) {
  const L = B7S.monde.emprunterLumiereTube(cle);
  if (!L) return null;
  const d = { isLight: true, position: new THREE.Vector3(), color: L.color.clone(), intensity: 0, userData: {} };
  B7E.lum.set(d, L);
  return d;
}
function b7RendreLumiere(d) {
  const L = B7E.lum.get(d);
  if (!L) return;
  B7E.lum.delete(d);
  B7S.monde.rendreLumiereTube(L);
}
/* Après le module : la lampe prêtée prend la place, la couleur et l'intensité de sa doublure (÷ π et obscurité des effets :
   le multiplicateur que b7SalleIntensite pose sur les lampes de cuve). */
function b7LumieresPretees() {
  const O = B7S.O;
  for (const [d, L] of B7E.lum) {
    L.position.set(d.position.x - O.x, d.position.y - O.y, d.position.z - O.z);
    L.color.copy(d.color);
    L.intensity = d.intensity * (L.userData.multiplicateur != null ? L.userData.multiplicateur : 1 / Math.PI);
  }
}
/* Capacités des mini-boss → sons du combat (comme prototype/proto-boss.js). */
function b7Capacite(m, quoi, info) {
  const A = B7.audio;
  if (!A || !A.sonMiniBoss || !m || quoi === 'aura') return;
  const p = info && info.position && (info.position.x || info.position.z) ? info.position : m.position;
  A.sonMiniBoss(m.type, quoi, p, { lieu: m.lieu, id: quoi === 'zone' && info && info.id != null ? info.id : m.id, etat: info && info.etat,
    intensite: info && info.intensite, duree: info && info.duree, cible: info && info.cible });
}
/* Dégâts des capacités (décharge, aura, flaque, boules, zones, fléau, charge, mur heurté) : fraction des PV max ; décharge :
   vision brouillée et étourdissement ; charge : projection. false : effets non appliqués (à terre, invulnérable). */
function b7DegatsCapacite(m, id, fraction, source, info) {
  if (id !== B7.id || G.state !== 'playing' || player.down) return false;
  b7Degats(id, fraction);
  if (B7.invul || player.down) return false;
  if (source === 'decharge' && info && info.flou > 0) b7Flou(info.flou);
  if (info && info.etourdissement > 0) b7Etourdir(info.etourdissement);
  if (source === 'charge' && info && info.projection && info.projection.duree > 0) b7Projeter(info.projection.vx, info.projection.vz, info.projection.duree);
  return true;
}

/* ------------------------------------------------------------- Apparitions --- */
/* Chien de la meute : celui du jeu, au point de la faille, avec le profil du combat. */
function b7Chien(p) {
  const q = p.position, x = +q.x, zz = +q.z, k = nearestNode(x, zz, +q.y || 0);
  if (k < 0) return null;
  const pr = p.profil || {};
  const z = spawnDog(k, pr.pv > 0 ? pr.pv : dogHpForRound(Math.max(1, G.round)), true);
  if (!z) return null;
  z.pos.x = x; z.pos.z = zz; z.k = k; z.gy = surfY(k, x, zz); z.pos.y = z.gy; z.lastX = x; z.lastZ = zz;
  if (pr.vitesse > 0) z.speed = pr.vitesse;
  z.b7 = {
    lieu: p.lieu === 'salle' || p.lieu === 'bunker' ? p.lieu : b7LieuDe(q), source: p.source || 'boss', type: 'chien',
    degats: pr.degats > 0 ? pr.degats : 0.05,
    morsure: { reach: pr.portee > 0 ? pr.portee : DOGS.bite.reach, cycle: pr.cadence > 0 ? pr.cadence : DOGS.bite.cycle, at: DOGS.bite.at },
  };
  return z.id;
}
/* Mini-boss et petits Démembrés : entités du module, dans la salle seulement. */
function b7EntApparition(p) {
  if (p.lieu !== 'salle' || !b7EnnemisCreer()) return null;
  const petit = p.type === 'demembre_petit';
  return B7E.Z.apparaitre({ position: p.position, lieu: 'salle', effet: p.effet || 'normal', source: p.source || null, vitesse: p.vitesse,
    agressif: !!p.agressif, type: p.type, miniBoss: !petit, nom: p.nom || null, profil: p.profil || null, pv: p.pv, pvMax: p.pvMax });
}

/* ------------------------------------------------------------- Entrées de tir --- */
/* Chaque image, après le module : une entrée par entité vivante de la salle, à sa place ; celles des mortes retirées. */
function b7EntSync() {
  const Z = B7E.Z, E = B7E.ents;
  for (const [id, z] of E) {
    const m = Z.obtenir(id);
    if (z.removed || !z.alive || !m || !Z.vivant(m)) { if (!z.removed) removeZombie(z); E.delete(id); }
  }
  for (const v of Z.liste()) {
    if (v.lieu !== 'salle') continue;
    const m = Z.obtenir(v.id);
    const z = E.get(v.id) || b7EntNouvelle(v.id);
    if (!z) continue;
    z.pos.set(m.position.x, 0, m.position.z);
    z.k = nearestNode(z.pos.x, z.pos.z, 0);
    z.gy = z.k >= 0 ? surfY(z.k, z.pos.x, z.pos.z) : 0;
    z.pos.y = z.gy;
    z.yaw = m.lacet;
    z.state = m.etat === 'cuve' || m.etat === 'bras' ? 'rise' : 'chase';   // encore dans la cuve ou sous le sol
    z.lastX = z.pos.x; z.lastZ = z.pos.z;
  }
}
function b7EntNouvelle(id) {
  if (!ZR.free.length) {
    const c = Zombies.list.find((q) => !q.alive && !q.boss);
    if (c) removeZombie(c);
    else { if (!B7E.plein) b7Journal('avertissement', `liste des zombies pleine : ${id} ne peut pas être visé`); B7E.plein = true; return null; }
  }
  const slot = ZR.free.pop();
  hideZombieSlot(slot);
  const z = {
    id: ++Zombies.seq, slot, type: B7E.type, model: 'b7_ennemi', boss: true, dog: true, b7ent: id, alive: true, outside: false, layer: 0,
    hp: 1e9, maxHp: 1e9, pos: new THREE.Vector3(), gy: 0, k: -1, yaw: 0, state: 'chase', st: 0, t: 0, ph: 0, phase: 0, window: 0,
    win: null, gib: 0, headless: false, crawl: false, stagger: 0, flinch: 0, knockX: 0, knockZ: 0, knockT: 0, reelT: 0, called: null,
    look: { skin: 0xffffff, cloth: 0xffffff, eyes: 0xffffff, helmet: false, helmetColor: 0 }, helmetOn: false, speedType: 'walk',
    speed: 1, moving: 0, vx: 0, vz: 0, nukeT: 0, losT: 0, los: true, farT: 0, stuck: 0, stuckT: 9, lastX: 0, lastZ: 0, scale: 1,
  };
  Zombies.list.push(z);
  B7E.ents.set(id, z);
  return z;
}
/* Rayon d'une arme contre une entité du module : ses zones de tir (celles de ProtoB7Zombies.intersecter, pour cette seule
   entité) : tête, torse (hanches → poitrine, poitrine → cou), jambes, bras pendu du géant ; t ou -1. Directions normalisées. */
const _b7eA = new THREE.Vector3(), _b7eB = new THREE.Vector3(), _b7eC = new THREE.Vector3(), _b7eS = new THREE.Vector3();
function b7RaySphere(ox, oy, oz, dx, dy, dz, c, r) {
  const cx = c.x - ox, cy = c.y - oy, cz = c.z - oz, t = cx * dx + cy * dy + cz * dz;
  if (t < 0) return -1;
  const d2 = cx * cx + cy * cy + cz * cz - t * t;
  return d2 > r * r ? -1 : t - Math.sqrt(r * r - d2);
}
function b7RaySegment(ox, oy, oz, dx, dy, dz, a, b, r) {          // segment approché par 6 sphères, comme le module
  let best = -1;
  for (let k = 0; k <= 5; k++) {
    _b7eS.set(a.x + (b.x - a.x) * k / 5, a.y + (b.y - a.y) * k / 5, a.z + (b.z - a.z) * k / 5);
    const t = b7RaySphere(ox, oy, oz, dx, dy, dz, _b7eS, r);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}
function b7EntRayon(z, ox, oy, oz, dx, dy, dz, extra) {
  _hitHead = false; _hitLeg = false; _hitArm = 0;
  const Z = B7E.Z, m = Z && Z.obtenir(z.b7ent);
  if (!m || z.removed || !Z.vivant(m) || m.lieu !== B7.lieu) return -1;
  const e = extra || 0, sc = m.scale, gros = m.fam === 'irradie', colosse = m.fam === 'demembre';
  m.os.tete.updateWorldMatrix(true, false);
  _b7eA.set(0, 0.1, 0.03).applyMatrix4(m.os.tete.matrixWorld);
  const th = b7RaySphere(ox, oy, oz, dx, dy, dz, _b7eA, (gros ? 0.15 : colosse ? 0.15 : 0.145) * sc + e);
  m.os.hanches.getWorldPosition(_b7eA); m.os.poitrine.getWorldPosition(_b7eB); m.os.cou.getWorldPosition(_b7eC);
  const rT = (gros ? 0.33 : colosse ? 0.36 : 0.27) * sc;
  let tb = b7RaySegment(ox, oy, oz, dx, dy, dz, _b7eA, _b7eB, rT + e);
  const tu = b7RaySegment(ox, oy, oz, dx, dy, dz, _b7eB, _b7eC, rT * 0.62 + e);
  if (tu >= 0 && (tb < 0 || tu < tb)) tb = tu;
  _b7eB.set(m.position.x, m.position.y + m.hauteur + 0.18, m.position.z);
  const tj = b7RaySegment(ox, oy, oz, dx, dy, dz, _b7eB, _b7eA, (gros ? 0.24 : colosse ? 0.27 : 0.2) * sc + e);
  if (tj >= 0 && (tb < 0 || tj < tb)) tb = tj;
  if (colosse && !m.sansBras) {                                   // bras pendu : touché comme le corps
    m.os.brasLibre.getWorldPosition(_b7eA); m.os.mainLibre.getWorldPosition(_b7eB);
    const ta = b7RaySegment(ox, oy, oz, dx, dy, dz, _b7eA, _b7eB, 0.1 * sc + e);
    if (ta >= 0 && (tb < 0 || ta < tb)) tb = ta;
  }
  if (th >= 0 && (tb < 0 || th <= tb + 0.1 * sc)) { _hitHead = true; return th; }
  return tb;
}
/* Dégâts d'une arme du jeu sur une entité du module (son pv, sa tête × 2, ses protections). Renvoie vrai si elle meurt. */
function b7EntDegats(z, amount, info) {
  B7V.touche = false;
  const Z = B7E.Z, m = Z && Z.obtenir(z.b7ent), k = info && info.kind;
  if (!m || z.removed || !z.alive || !(amount > 0) || k === 'vehicle') return false;
  const mb = m.miniBoss;
  let d = amount;
  if (mb) {
    if (k === 'nuke' || k === 'glas') return false;              // jamais tué d'un coup (§11.3)
    if (k === 'blast') d = B7.combat.config.dpsReference * (info.slot && info.slot.up ? 2 : 1);   // D5
  } else if (k === 'nuke' || k === 'blast' || G.timers.insta > 0) d = 1e9;   // petit Démembré : comme un zombie du jeu
  const pv0 = m.pv, r = Z.toucher(z.b7ent, d, k === 'bullet' && info.head ? 'tete' : 'corps', { joueur: B7.id });
  B7V.touche = !!(r && (r.tue || m.pv < pv0));
  if (!B7V.touche) return false;
  if (!r.tue) { if (!mb && k !== 'nuke') addPoints(RULES.pointsHit); return false; }
  z.alive = false;                                                // l'entrée quitte la liste à la prochaine image (b7EntSync)
  if (k !== 'nuke') addPoints(mb ? 500 : k === 'knife' ? RULES.pointsKnife : k === 'bullet' && info.head ? RULES.pointsHead : RULES.pointsKill);
  G.stats.kills++;
  Life.kill(info, null);
  Rank.kill(info);
  if (k === 'bullet' && info.head) { G.stats.headshots++; Sound.headshot(); }
  return true;
}
/* Impact d'une balle (hitscan) : étincelles si le mini-boss est invulnérable (rage), sang sinon. */
function b7EntImpact(z, hx, hy, hz, dx, dz, tete) {
  const L = B7.e && B7.e.miniBoss;
  let protege = false;
  if (L) for (const q of L) if (q.id === z.b7ent) { protege = !!q.invulnerable; break; }
  if (protege) sparkBurst(hx, hy, hz, -dx, 0, -dz, 6);
  else bloodBurst(hx, hy, hz, dx, dz, tete ? 7 : 4, 1);
}

/* ------------------------------------------------------------- Irradiation --- */
/* Rage de L'Irradié sur un zombie ou un chien du jeu : teinte verte (sa place de rendu), lueur, aura. */
function b7Irradier(z, p) {
  if (p.actif === false) { b7IrrFin(z); return true; }
  const A = p.aura || {};
  z.b7Irr = { r: A.rayon > 0 ? A.rayon : 1.5, dps: A.degatsParSeconde >= 0 ? A.degatsParSeconde : 0.04 };
  if (B7E.irr.has(z)) return true;
  B7E.irr.add(z);
  const vert = new THREE.Color(p.couleur || B7_IRR_COUL), L = z.look;
  const mix = (hex, k) => new THREE.Color(hex).lerp(vert, k).getHex();
  paintZombieSlot(z.slot, { skin: mix(L.skin, 0.6), cloth: mix(L.cloth, 0.3), eyes: vert.getHex(), helmet: L.helmet, helmetColor: mix(L.helmetColor, 0.3) }, z.R || ZR, zModelOf(z));
  return true;
}
function b7IrrFin(z) {
  if (!B7E.irr.delete(z)) return;
  z.b7Irr = null;
  if (!z.removed) paintZombieSlot(z.slot, z.look, z.R || ZR, zModelOf(z));
}
function b7IrrCreer() {
  const g = new THREE.BufferGeometry();
  B7E.irrPos = new Float32Array(64 * 3);
  g.setAttribute('position', new THREE.BufferAttribute(B7E.irrPos, 3));
  g.setDrawRange(0, 0);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(B7_IRR_COUL).convertSRGBToLinear(), size: 0.9, map: TEX.glow,
    transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 3;
  B7E.gS.add(pts);
  B7E.irrPts = pts;
}
/* Chaque image : lueurs des irradiés ; aura par tics de 0,25 s (distance à plat, même lieu, comme le module). */
function b7IrrMaj(dt) {
  const E = B7E, pts = E.irrPts;
  if (!pts) return;
  if (!E.irr.size) { pts.visible = false; E.irrT = 0; return; }
  E.irrT += dt;
  const tic = E.irrT >= 0.25;
  if (tic) E.irrT -= 0.25;
  const P = E.irrPos, peut = G.state === 'playing' && !player.down;
  let n = 0;
  for (const z of E.irr) {
    if (z.removed || !z.alive) { E.irr.delete(z); z.b7Irr = null; continue; }   // mort : son corps reste vert
    if (n < 64) { P[n * 3] = z.pos.x; P[n * 3 + 1] = z.gy + (z.dog ? 0.55 : 1.1); P[n * 3 + 2] = z.pos.z; n++; }
    if (!tic || !peut || (z.b7 ? z.b7.lieu : 'bunker') !== B7.lieu) continue;
    const dx = player.pos.x - z.pos.x, dz = player.pos.z - z.pos.z, R = z.b7Irr.r;
    if (dx * dx + dz * dz <= R * R) b7Degats(B7.id, z.b7Irr.dps * 0.25);
  }
  pts.geometry.setDrawRange(0, n);
  pts.geometry.attributes.position.needsUpdate = true;
  pts.visible = n > 0;
  pts.material.opacity = 0.55 + 0.2 * Math.sin(G.time * 5.3);
}

/* ------------------------------------------------------------- Joueur --- */
/* Touche permise ? (key, pressed) : aucune pendant les scènes ; étourdi ou projeté, restent le regard (souris, flèches),
   la visée, l'interaction et le choix de l'arme. */
function b7Touche(c) {
  if (b7Bloque()) return false;
  return !(b7Fige() && B7_TOUCHES_FIGEES.has(c));
}
function b7Fige() { return (B7J.etourdiT > 0 || B7J.projT > 0) && G.state === 'playing'; }
function b7Projete() { return B7J.projT > 0 && G.state === 'playing'; }
/* Couches de l'écran (styles de prototype/proto-joueur.js), sous le HUD du jeu et au-dessus de l'image. */
function b7JoueurCreer() {
  const J = B7J, hud = HUD.el.hud;
  if (J.els || !hud || !hud.parentNode) return;
  const couche = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;opacity:0;' + css; return d; };
  const flou = couche('background:rgba(150,220,255,0.10);-webkit-backdrop-filter:blur(7px) brightness(1.3) saturate(0.5);backdrop-filter:blur(7px) brightness(1.3) saturate(0.5)');
  const eblou = couche('mix-blend-mode:screen;background:radial-gradient(ellipse at center, rgba(240,253,255,0.95) 0%, rgba(160,232,255,0.62) 32%, rgba(70,180,255,0.28) 68%, rgba(30,100,210,0.08) 100%)');
  const voile = couche('mix-blend-mode:screen;background:radial-gradient(ellipse at center, rgba(110,215,255,0.04) 35%, rgba(70,180,255,0.32) 80%, rgba(150,230,255,0.55) 100%)');
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
  J.eclairs = [];
  for (let k = 0; k < 8; k++) {
    const pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', k % 2 ? '#f2fdff' : '#6fe0ff'); pl.setAttribute('stroke-width', k % 2 ? '0.25' : '0.6'); pl.setAttribute('stroke-linejoin', 'bevel');
    svg.appendChild(pl); J.eclairs.push(pl);
  }
  voile.appendChild(svg);
  for (const d of [flou, eblou, voile]) { d.className = 'b7-joueur'; hud.parentNode.insertBefore(d, hud); }
  J.els = [flou, eblou, voile];
}
function b7Opacite(i, op) {
  const J = B7J, el = J.els && J.els[i], p = Math.round(clamp(op, 0, 1) * 40);
  if (!el || p === J.pas[i]) return;
  J.pas[i] = p; el.style.opacity = J.OPA[p];
}
/* Vision brouillée pendant `duree` s (la plus longue l'emporte) : éblouissement immédiat, flou qui s'estompe sur la fin. */
function b7Flou(duree) {
  const J = B7J;
  duree = duree > 0 ? duree : 1;
  if (duree >= J.flouT) { J.flouT = duree; J.flouD = duree; }
  J.flouAge = 0;
}
/* Étourdi pendant `duree` s : commandes figées (b7Touche, b7Entrees), voile électrique bref ; ni tremblement ni secousse. */
function b7Etourdir(duree) {
  const J = B7J;
  duree = duree > 0 ? duree : 1;
  if (duree > J.etourdiT) J.etourdiT = duree;
  J.voileAge = 0;
  player.sprinting = false;
  if (!J.eclairs) return;
  for (let k = 0; k < J.eclairs.length; k++) {                    // éclairs redessinés à chaque étourdissement (prototype)
    const bord = k % 4, x = bord === 0 ? 0 : bord === 1 ? 100 : 10 + Math.random() * 80, y = bord === 2 ? 0 : bord === 3 ? 100 : 10 + Math.random() * 80;
    const tx = 32 + Math.random() * 36, ty = 32 + Math.random() * 36, pts = [];
    for (let q = 0; q <= 7; q++) { const f = q / 7 * 0.7; pts.push((x + (tx - x) * f + (q ? (Math.random() - 0.5) * 7 : 0)).toFixed(1) + ',' + (y + (ty - y) * f + (q ? (Math.random() - 0.5) * 7 : 0)).toFixed(1)); }
    J.eclairs[k].setAttribute('points', pts.join(' '));
  }
}
/* Projeté à (vx, vz) m/s pendant `duree` s (charge du Démembré) : la vitesse faiblit de 100 à 40 %, commandes coupées. */
function b7Projeter(vx, vz, duree) {
  const J = B7J;
  if (!isFinite(vx) || !isFinite(vz) || !(duree > 0)) return;
  J.projT = J.projD = duree; J.vx = vx; J.vz = vz;
  player.sprinting = false;
  if (GL.actif) glReset();                                         // une glissade s'arrête net
}
/* Dans updatePlayer, à la place de la marche : la vitesse de la projection (les collisions du jeu s'appliquent ensuite). */
function b7Projection(p, dt) {
  const J = B7J;
  J.projT = Math.max(0, J.projT - dt);
  const k = J.projD > 0 ? 0.4 + 0.6 * J.projT / J.projD : 0;
  p.vel.x = J.vx * k; p.vel.z = J.vz * k;
}
/* Projeté contre un mur de la salle (b7SalleCorps) : la projection s'arrête, le module ajoute ses dégâts et son son. */
function b7ImpactMur() {
  const J = B7J, v = Math.hypot(J.vx, J.vz) * (J.projD > 0 ? 0.4 + 0.6 * J.projT / J.projD : 0);
  J.projT = 0;
  player.vel.x = player.vel.z = 0;
  if (B7E.Z) B7E.Z.impactMur(B7.id, { x: player.pos.x, z: player.pos.z, vitesse: v });
}
/* Chaque image : étourdissement, vision brouillée et voile (comme le prototype). */
function b7JoueurMaj(dt) {
  const J = B7J;
  if (J.etourdiT > 0) J.etourdiT = Math.max(0, J.etourdiT - dt);
  if (J.flouT > 0 || J.flouAge < 99) {
    J.flouT = Math.max(0, J.flouT - dt); J.flouAge += dt;
    const kf = J.flouD > 0 ? J.flouT / J.flouD : 0, e0 = Math.max(0, 1 - J.flouAge / 0.45);
    b7Opacite(0, Math.min(1, kf * 1.8));
    b7Opacite(1, Math.min(1, e0 * e0 * 0.85 + 0.18 * kf));
    if (J.flouT <= 0 && J.flouAge > 0.5) { J.flouAge = 99; b7Opacite(0, 0); b7Opacite(1, 0); }
  }
  if (J.voileAge < 99) {
    J.voileAge += dt;
    b7Opacite(2, Math.max(0, 1 - J.voileAge / 0.4) * (0.75 + 0.25 * Math.sin(J.voileAge * 60)));
    if (J.voileAge > 0.45) { J.voileAge = 99; b7Opacite(2, 0); }
  }
}

/* ------------------------------------------------------------- Chaque image --- */
/* (b7Update, après la salle) : module (IA, capacités, effets), lampe prêtée, entrées de tir, irradiés, joueur. */
function b7EnnemisMaj(dt) {
  const E = B7E;
  b7JoueurMaj(dt);
  if (!E.Z) return;
  if (B7.e) E.reste = 6;
  else if (E.reste > 0) E.reste -= dt;
  if (E.reste > 0) {
    E.Z.mettreAJour(dt, G.time, b7Joueurs());
    b7LumieresPretees();
  }
  b7EntSync();
  b7IrrMaj(dt);
}
/* Nouvelle partie : plus aucune entité vivante du module, ni entrée, ni irradié ; le joueur rendu à lui-même. Le module
   tourne encore quelques secondes, hors de la vue : morts, flaques et zones en cours finissent. */
function b7EnnemisRemettre() {
  const E = B7E, J = B7J;
  J.flouT = J.etourdiT = J.projT = 0; J.flouAge = J.voileAge = 99;
  for (let i = 0; i < 3; i++) b7Opacite(i, 0);
  for (const z of E.irr) z.b7Irr = null;
  E.irr.clear();
  for (const z of E.ents.values()) if (!z.removed) removeZombie(z);
  E.ents.clear();
  E.plein = false;
  if (E.Z) { E.Z.tuerTous('silencieux', null, true); E.reste = 6; }
  if (E.gS) b7Attacher(E.gS, false);
}
