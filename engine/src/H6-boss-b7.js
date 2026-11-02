/* ========================================================================= 21 BOSS ==
   Boss de Bunker 7, « Le Dernier Pacte » (jeu 2.0.7, demande d'Anthony du 1er novembre 2026 ; suivi : SUIVI-BOSS-B7.md).
   Le paquet d'Anthony (boss-bunker7/le-dernier-pacte/) est inséré tel quel par build.py, chacun dans son <script> :
   réglages (BOSS_B7_CONFIG : copie réglée engine/boss-b7/config.js), salle (BOSS_B7_ARENE : engine/boss-b7/arene.js),
   logique du combat (BossB7Logique), modèle, effets, sons (BOSS_B7_SONS : les 133 MP3 en base64) et interface.
   Ce module est le seul pont entre le combat et le jeu : l'adaptateur « jeu » de son API.md (§3).
   · Joueur : le joueur local (« j1 ») ; lacet du paquet = yaw du jeu + π (0 : vers +Z) ; lieu (« salle » : la salle
     secrète, « bunker » : la carte) tenu par les téléportations du combat.
   · Dégâts : fraction des PV max, par playerDamage (règles du jeu : à terre, digi pass), sans secousse ni à-coup de la
     vue (vertige d'Anthony) ; le jeu n'a aucune réduction de dégâts (Mastodonte augmente les PV max) ; blessure
     critique : PV ramenés à 1 % des PV max, jamais mortelle.
   · Scènes : commandes coupées (touches, souris, tir : b7Bloque), invulnérabilité (b7Invulnerable) ; regard tourné
     doucement vers le Septième pendant les scènes seulement, jamais pendant un crochet (décision du 1er novembre 2026).
   · Zombies du combat : zombies du jeu sortis de terre au point demandé, PV de la config (D6), à la course la plus
     rapide du jeu (les zombies du jeu poursuivent toujours le joueur : « agressif ») ; leur mort donne les points
     habituels, sans bonus ni compte dans la manche (b7ZombieTue) ; saisie, extraction, relâche (b7EffetZombie) ;
     retrait sans points (un zombie de manche retiré sera recréé à une fenêtre, comme un traînard). Chiens de la meute,
     mini-boss, petits Démembrés, irradiation et mécaniques du joueur : section 24 (H9-boss-ennemis.js).
   · Manches suspendues pendant le combat ; aucun bonus au hasard du début du combat à sa fin (D3).
   · Bonus : les vrais bonus du jeu (B7_BONUS traduit les identifiants du paquet). Armes merveilles de la récompense
     (D2) : objets au sol devant l'autel de la salle, comme les bonus, jamais perdus ; ramassées, elles remplacent
     l'emplacement 1, puis le 2 (une arme déjà tenue est améliorée à sa place).
   · Navigation : chemin (A* sur la grille : portes ouvertes, escaliers), position valide, ligne de vue (sightClear) ;
     la salle secrète fait partie de la grille de Bunker 7 (module suivant, section 22 : H7-boss-salle.js).
   · Drapeaux : ceux de la partie en cours (le jeu n'a pas de sauvegarde de partie ; le combat se joue une fois).
   Création : le combat et l'adaptateur une fois, à la première partie sur Bunker 7 (remis à zéro à chaque partie) ;
   les sons y sont décodés aussitôt sur le contexte audio du jeu (Sound.bus), sans réseau, et libérés quand une autre
   carte est chargée. Sans le paquet (script absent, erreur à la création) : le jeu d'avant, sans boss.
   ============================================================================ */
const B7 = {
  on: true,                                   // false : pas de boss (le jeu d'avant)
  id: 'j1',                                   // identifiant du joueur local pour le combat
  combat: null, jeu: null, err: null, e: null,   // e : état de la logique à cette image (null hors combat)
  etat: 'inactif', actif: false, cine: false, // état de la logique ; combat en cours ; scène en cours
  bloque: false, invul: false, manches: false,
  lieu: 'bunker', regard: null, drapeaux: {},
  retires: new Map(),                         // zombies retirés : dernière position (effets : cendres), gardée 3 s
  recompenses: [], placees: new Set(), atouts: 0,
  audio: null, sonsPrets: false, sonsCharges: null, volMusique: -1,
  vueZombies: [], nav: null, journal: [],
};
// identifiants des bonus du paquet → ceux du jeu (vente flash, points bonus, atout gratuit et machine de mort : absents)
const B7_BONUS = { 'munitions-max': 'ammo', 'mort-instantanee': 'insta', 'points-doubles': 'double', 'bombe-nucleaire': 'nuke', 'charpentier': 'carpenter' };
const B7_HORS_COMBAT = ['inactif', 'termine', 'echec'];
const B7_MUSIQUE = 1.4;                       // gain de la musique du paquet (v1.1), multiplié par le réglage du jeu
const B7_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const b7Carte = () => B7.on && !OW.on && G.mapId === BUNKER7.id;
/* Points d'accroche (sans effet hors du combat) : commandes, invulnérabilité, manches, bonus au hasard. */
function b7Bloque() { return B7.bloque && G.state === 'playing'; }
function b7Invulnerable() { return B7.invul; }
function b7ManchesSuspendues() { return B7.manches; }
function b7SansBonus() { return B7.actif; }
function b7Journal(niveau, msg) {
  B7.journal.push(`${niveau} : ${msg}`);
  if (B7.journal.length > 80) B7.journal.shift();
  if (niveau === 'erreur') console.error('[boss B7]', msg);
  else if (niveau === 'avertissement') console.warn('[boss B7]', msg);
}
/* Lieu d'un point : « salle » dans l'octogone de la salle secrète (marge 1 m), sinon « bunker ». */
function b7LieuDe(p) {
  const S = BOSS_B7_ARENE.salle, O = S.origine, dx = p.x - O.x, dz = p.z - O.z, A = S.apotheme + 1;
  if (Math.abs((+p.y || 0) - O.y) > 4) return 'bunker';
  for (const m of S.murs) if (dx * m.normale.x + dz * m.normale.z > A) return 'bunker';
  return 'salle';
}

/* -------------------------------------------------------------- Joueur --- */
const B7_VUE = { id: 'j1', position: { x: 0, y: 0, z: 0 }, vitesse: { x: 0, y: 0, z: 0 }, lacet: 0, vivant: true, aTerre: false, lieu: 'bunker', pvFraction: 1 };
const B7_JOUEURS = [B7_VUE];
function b7Joueurs() {
  const v = B7_VUE, p = player;
  v.position.x = p.pos.x; v.position.y = p.gy + p.y; v.position.z = p.pos.z;   // aux pieds (sol, plus le saut)
  v.vitesse.x = p.vel.x; v.vitesse.y = p.vy; v.vitesse.z = p.vel.z;
  v.lacet = wrapAngle(p.yaw + Math.PI);
  v.vivant = G.state !== 'gameover' && (p.hp > 0 || p.down);
  v.aTerre = p.down;                                       // à terre : Quick Revive (relevé seul en 4,5 s)
  v.lieu = B7.lieu;
  v.pvFraction = p.maxHp > 0 ? clamp(p.hp / p.maxHp, 0, 1) : 0;
  return B7_JOUEURS;
}
function b7Degats(id, fraction) {
  if (id !== B7.id || !(fraction > 0)) return 0;
  const sh = FX.shake, pu = player.punch, hp = player.hp;
  playerDamage(fraction * player.maxHp);
  FX.shake = sh; player.punch = pu;                        // vertige : ni secousse ni à-coup de la vue
  return Math.max(0, hp - Math.max(0, player.hp)) / player.maxHp;
}
function b7Critique(id, fraction) {
  if (id !== B7.id || player.down || G.state !== 'playing' || G.god || G.cheat) return;
  const cible = Math.max(1e-6, +fraction || 0) * player.maxHp;
  if (player.hp > cible) player.hp = cible;
  player.lastHit = G.time;                                 // la régénération du jeu reprend après son délai
  Sound.playerHurt();
  HUD.hurt();
}
function b7Teleporter(id, p, lacet, lieu) {
  if (id !== B7.id || !p || !isFinite(+p.x + +p.z)) return;
  if (nearestNode(+p.x, +p.z, +p.y || 0) < 0) { b7Journal('erreur', `téléportation refusée : (${(+p.x).toFixed(1)} ; ${(+p.z).toFixed(1)}) hors de la grille`); return; }
  glReset();
  placePlayer(+p.x, +p.z, LV[levelAtY((+p.y || 0) + 0.1)]);
  player.vel.set(0, 0, 0); player.y = 0; player.vy = 0; player.grounded = true;
  player.recoil = player.recoilYaw = player.punch = 0;
  if (lacet != null && isFinite(lacet)) { player.yaw = wrapAngle(lacet - Math.PI); player.pitch = 0; }
  B7.lieu = lieu === 'salle' || lieu === 'bunker' ? lieu : b7LieuDe(p);
  B7.regard = null;
  Zombies.flowT = 0;                                       // champ de flux refait autour du nouveau point
}
function b7Controle(id, actif) {
  if (id !== B7.id) return;
  B7.bloque = !actif;
  if (!actif) { player.sprinting = false; Input.lmb = Input.rmb = false; }
}
/* Chaque image, avant updatePlayer : commandes coupées (souris, tir, molette ; les touches : key et pressed) et
   regard des scènes (lissé sur sa durée, souris sans effet pendant ce temps). */
function b7Entrees(dt) {
  const R = B7.regard;
  if (b7Fige()) { Input.lmb = Input.lmbDown = false; Input.wheel = 0; }   // étape 6 : étourdi ou projeté, ni tir (la vue reste libre)
  if (B7P.ouvert && !Input.locked) Input.dx = Input.dy = 0;              // étape 7 : panneau de test ouvert, souris libre : la vue ne tourne pas
  if (!b7Bloque() && !R) return;
  Input.dx = Input.dy = 0;
  if (b7Bloque()) { Input.lmb = Input.rmb = Input.lmbDown = false; Input.wheel = 0; }
  if (!R) return;
  R.t += dt;
  const k = smooth(clamp(R.t / R.d, 0, 1));
  player.yaw = wrapAngle(lerp(R.y0, R.y1, k));
  player.pitch = lerp(R.p0, R.p1, k);
  if (R.t >= R.d && !B7.bloque) B7.regard = null;
}
function b7Regarder(id, p, duree) {
  if (id !== B7.id || !p || !B7.cine) return;               // hors des scènes (crochets) : la vue n'est jamais tournée de force
  const eye = player.gy + PLAYER_EYE, dx = p.x - player.pos.x, dz = p.z - player.pos.z, dy = (p.y != null ? p.y : eye) - eye;
  const y1 = Math.atan2(-dx, -dz), p1 = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.4, 1.4);
  B7.regard = { y0: player.yaw, p0: player.pitch, y1: player.yaw + wrapAngle(y1 - player.yaw), p1, t: 0, d: Math.max(0.05, +duree || 0.8) };
}
/* Traction d'un crochet (v1.4) : le joueur posé au point donné, vitesse nulle (les murs le retiennent comme toujours). */
function b7Tirer(id, p) {
  if (id !== B7.id || !p || !isFinite(+p.x + +p.z)) return false;
  player.pos.x = +p.x; player.pos.z = +p.z;
  const k = nearestNode(player.pos.x, player.pos.z, player.gy);
  if (k >= 0) { player.k = k; player.gy = surfY(k, player.pos.x, player.pos.z); player.pos.y = player.gy; }
  player.vel.set(0, 0, 0);
  return true;
}

/* -------------------------------------------------------------- Zombies --- */
function b7Zombie(id) {
  const n = +id;
  for (const z of Zombies.list) if (z.id === n && !z.removed) return z;
  return null;
}
/* Zombie du combat : PV de la config (D6), à la course la plus rapide du jeu (v1.1 : « sprint »), hors de la manche. */
function b7Combattant(z, o) {
  if (o.pv > 0) z.hp = z.maxHp = o.pv;
  if (o.vitesse === 'sprint') { z.speedType = 'run'; z.speed = SPEEDS.run[1] * z.type.mult.speed; }
  z.b7 = { lieu: o.lieu, source: o.source || 'boss', type: 'zombie' };
  return z;
}
function b7Apparition(p) {
  if (!p || !p.position) return null;
  const type = p.type || 'zombie';
  if (type === 'chien') return b7Chien(p);                 // étape 6 : le chien du jeu (section 24)
  if (B7_TYPES_ENT.includes(type)) return b7EntApparition(p);   // étape 6 : mini-boss, petits Démembrés (module du prototype)
  if (type !== 'zombie') { b7Journal('avertissement', `apparition « ${type} » inconnue`); return null; }
  const q = p.position, k = nearestNode(+q.x, +q.z, +q.y || 0);
  if (k < 0) return null;
  const li = levelOfNode(k);
  // sortie de terre au point demandé (émergence, brèche, faille : le jeu n'a qu'une sortie de terre)
  const z = spawnZombie({ riser: true, x: +q.x, z: +q.z, li, k, layer: 0, zone: zoneOf[k], y: LVY[li] }, p.pv > 0 ? p.pv : G.zombieHp || zombieHpForRound(Math.max(1, G.round)));
  if (!z) return null;
  b7Combattant(z, { pv: p.pv, vitesse: p.vitesse, lieu: p.lieu === 'salle' || p.lieu === 'bunker' ? p.lieu : b7LieuDe(q), source: p.source });
  if (z.b7.lieu === 'salle' && p.effet === 'breche') b7SalleBreche(+q.x, +q.z);   // étape 4 : la grille de la brèche se soulève
  return z.id;
}
function b7Zombies() {
  const L = B7.vueZombies;
  L.length = 0;
  for (const z of Zombies.list) {
    if (!z.alive || z.removed || z.boss || z.pilot) continue;
    const v = z.b7v || (z.b7v = { id: z.id, position: { x: 0, y: 0, z: 0 }, vivant: true, lieu: 'bunker', type: 'zombie', pv: 0, pvMax: 0 });
    v.position.x = z.pos.x; v.position.y = z.gy; v.position.z = z.pos.z;
    v.lieu = z.b7 ? z.b7.lieu : 'bunker';                  // zombies et chiens de la manche : dans la carte
    v.type = z.b7 ? z.b7.type : z.dog ? 'chien' : 'zombie';
    v.pv = z.hp; v.pvMax = z.maxHp;
    L.push(v);
  }
  if (B7E.Z) for (const v of B7E.Z.liste()) L.push(v);     // étape 6 : mini-boss et petits Démembrés (type, nom, pv, pvMax)
  return L;
}
function b7Effet(id, effet, params) {
  if (b7EstEnt(id)) return B7E.Z ? B7E.Z.effet(id, effet, params) : false;   // étape 6 : rages, irradiation (module)
  const z = b7Zombie(id);
  if (!z || !z.alive) return false;
  if (effet === 'irradie') return b7Irradier(z, params || {});   // étape 6 : rage de L'Irradié
  if (z.dog) return effet === 'relache';                   // ni saisie ni extraction pour les chiens (API §14.3)
  if (effet === 'saisie' || effet === 'extraction') { z.b7Effet = { type: effet, t: 0 }; return true; }
  if (effet === 'relache') { z.b7Effet = null; return true; }
  b7Journal('info', `effet « ${effet} » inconnu pour un zombie du jeu`);
  return false;
}
/* Dans updateZombie : saisi, il reste sur place et se débat ; extrait, il est soulevé (l'âme : effets du paquet).
   Un zombie qui sort encore de terre finit d'abord de sortir. */
function b7EffetZombie(z, dt) {
  const E = z.b7Effet;
  if (!z.alive) { z.b7Effet = null; return false; }
  if (z.state === 'rise') return false;
  E.t += dt;
  z.vx = z.vz = 0; z.moving = 0; z.knockX = z.knockZ = 0;
  if (z.state === 'attack') { z.state = 'chase'; z.t = 0; }
  if (E.type === 'saisie') { z.pos.y = z.gy; z.flinch = 0.25 + 0.2 * Math.abs(Math.sin(E.t * 9)); }
  else { z.pos.y = z.gy + 0.9 * smooth(clamp(E.t / 1.2, 0, 1)); z.flinch = 0.5; }
  return true;
}
function b7Retirer(id, o) {
  if (b7EstEnt(id)) return B7E.Z ? B7E.Z.retirer(id, o || {}) : false;   // étape 6 : effondrement, cendres, silencieux
  const z = b7Zombie(id);
  if (!z) return false;
  B7.retires.set(z.id, { x: z.pos.x, y: z.gy, z: z.pos.z, t: G.time });
  if (o && o.points && z.alive) addPoints(RULES.pointsKill);
  if (z.b7 || !z.alive) removeZombie(z);
  else recycleZombie(z);                                   // zombie de manche : recréé plus tard à une fenêtre
  return true;
}
/* Position d'un zombie, vivant ou retiré depuis moins de 3 s (effets du paquet : cendres, âmes). */
function b7PositionZombie(id) {
  if (b7EstEnt(id)) { const m = B7E.Z && B7E.Z.obtenir(id); return m && m.actif ? m.position : null; }   // étape 6 : module
  const z = b7Zombie(id);
  if (z) return { x: z.pos.x, y: z.pos.y, z: z.pos.z };
  const r = B7.retires.get(+id);
  return r ? { x: r.x, y: r.y, z: r.z } : null;
}
/* Zombie du combat tué par le joueur (onZombieKilled) : points habituels (killZombie), Le Glas ; ni bonus ni manche.
   Pas d'« apparitions normales » (étape 9) : en phase 5, la logique fait elle-même sortir de terre les zombies du combat
   aux points de Bunker 7 (arene.bunker7.apparitionsZombies, à 8 m au moins du joueur) ; ils foncent sur lui dès leur
   apparition (critère 13), alors que ceux d'une manche passeraient par les fenêtres et leurs planches. */
function b7ZombieTue(z, info) { glasOnKill(z, info); }
/* Points de Bunker 7 demandés par la logique (pointsBunker, facultatif). « zombies » (sorties de terre des zombies du combat
   et failles des chiens, phase 5) : ceux à 8 m au moins du joueur, debout ou à terre (décision d'Anthony du 2 novembre
   2026 ; la logique ne compte que les joueurs debout). Autres types : null, la logique prend les listes de l'arène. */
function b7PointsBunker(type) {
  if (type !== 'zombies') return null;
  const loin = BOSS_B7_ARENE.bunker7.apparitionsZombies.filter((q) => Math.hypot(q.x - player.pos.x, q.z - player.pos.z) >= 8);
  return loin.length ? loin.map((q) => ({ x: q.x, y: q.y || 0, z: q.z })) : null;
}

/* -------------------------------------------------- Bonus et récompenses --- */
function b7Bonus(b) {
  const t = b && B7_BONUS[b.type];
  if (!t || !b.position) return false;
  const p = b.position, k = nearestNode(+p.x, +p.z, +p.y || 0);
  spawnPowerup(t, +p.x, +p.z, k >= 0 ? surfY(k, +p.x, +p.z) : +p.y || 0);
  Powerups.list[Powerups.list.length - 1].life = b.duree > 0 ? +b.duree : 30;
  return true;
}
function b7ActiverBonus(bonusId) {
  const t = B7_BONUS[bonusId];
  if (!t) { b7Journal('avertissement', `bonus inconnu du jeu : ${bonusId}`); return false; }
  applyPowerup(t);
  return true;
}
function b7ListeAtouts() {
  const ids = [...new Set((LAYOUT.perks || []).map((p) => p.p))].filter((id) => PERKS[id]);
  return ids.length ? ids : Object.keys(PERKS);
}
function b7DonnerAtout(id, atout) {
  if (id !== B7.id || !PERKS[atout] || player.perks.has(atout)) return false;
  schedule(B7.atouts++ * 0.7, () => { if (G.state === 'playing') grantPerk(atout); });   // l'un après l'autre (bannière, jingle)
  return true;
}
/* Arme de la récompense (D2) : un objet au sol devant l'autel, qui flotte et tourne comme un bonus ; il attend le
   joueur (aucune durée). Les deux armes côte à côte, à 1,4 m de l'autel vers le centre de la salle. */
function b7DeposerRecompense(r) {
  if (!r || r.type !== 'arme' || !WEAPONS[r.id] || !r.position) { b7Journal('avertissement', `récompense non déposée : ${r && r.id}`); return null; }
  const O = BOSS_B7_ARENE.salle.origine, p = r.position, i = B7.recompenses.length;
  let ux = O.x - p.x, uz = O.z - p.z;
  const l = Math.hypot(ux, uz) || 1;
  ux /= l; uz /= l;
  const lat = i % 2 ? 0.9 : -0.9, x = p.x + ux * 1.4 - uz * lat, z = p.z + uz * 1.4 + ux * lat;
  const k = nearestNode(x, z, +p.y || 0), tier = clamp(r.pap | 0, 0, 3);
  const m = b7ModeleArme(r.id, tier);
  scene.add(m);
  const o = { id: r.id, tier, x, z, gy: k >= 0 ? surfY(k, x, z) : +p.y || 0, m, t: rand(0, TAU) };
  B7.recompenses.push(o);
  Sound.powerupSpawn({ x, y: o.gy, z });
  return o;
}
function b7ModeleArme(id, tier) {
  const g = buildGun(id, tier);
  const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3()), L = bb.getSize(new THREE.Vector3()).z;
  g.position.set(-c.x, -c.y, -c.z);
  const arme = new THREE.Group();
  arme.add(g);
  arme.scale.setScalar(Math.min(1.5, 0.9 / L));
  linearizeTree(arme);                                     // comme l'arme posée sur Le Glas
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffc23a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(1.5, 1.5, 1);
  const m = new THREE.Group();
  m.add(arme, halo);
  return m;
}
function b7MajRecompenses(dt) {
  for (let i = B7.recompenses.length - 1; i >= 0; i--) {
    const r = B7.recompenses[i];
    r.t += dt;
    r.m.rotation.y += dt * 1.2;
    r.m.position.set(r.x, r.gy + 1 + Math.sin(r.t * 2.4) * 0.08, r.z);
    if (player.down || armsBusy() || Math.hypot(player.pos.x - r.x, player.pos.z - r.z) >= 1.25 || Math.abs(player.gy - r.gy) >= 1.2) continue;
    scene.remove(r.m);
    B7.recompenses.splice(i, 1);
    b7ArmeRecompense(r.id, r.tier);
  }
}
/* Ramassée : elle remplace l'emplacement 1, puis le 2 (décision d'Anthony du 1er novembre 2026) ; une arme déjà tenue
   est remplacée à sa place par sa version améliorée. Même mise en main que giveWeapon. */
function b7ArmeRecompense(id, tier) {
  let i = Arms.slots.findIndex((s) => s && s.id === id);
  if (i < 0) { i = 0; while (i < Arms.slots.length - 1 && B7.placees.has(i)) i++; }
  B7.placees.add(i);
  const slot = { id, tier, up: tier > 0, mag: 0, res: 0, kills: 0 };
  slot.mag = wstat(slot, 'mag'); slot.res = wstat(slot, 'res');
  Arms.slots[i] = slot;
  Arms.cur = i;
  Arms.state = 'swapIn'; Arms.t = 0; Arms.dur = 0.45 * swapFactor();
  Arms.autoReloadAt = -1;
  refreshGunModel();
  Sound.powerupGrab();
  Sound.swap();
  HUD.weapon();
  HUD.banner(wstat(slot, 'name'), `Palier ${GLAS.tiers[tier] ? GLAS.tiers[tier].roman : tier} du Glas`, 'powerup');
}
/* Fin du combat : une arme restée dans la salle suit le joueur dans Bunker 7 (elle n'est jamais perdue). */
function b7RecompensesSuivent() {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  B7.recompenses.forEach((r, i) => {
    if (b7LieuDe({ x: r.x, y: r.gy, z: r.z }) !== 'salle') return;
    const lat = i % 2 ? 0.8 : -0.8, x = player.pos.x + fx * 1.6 - fz * lat, z = player.pos.z + fz * 1.6 + fx * lat;
    const k = locateNode(x, z, player.gy, true);
    r.x = k >= 0 ? x : player.pos.x; r.z = k >= 0 ? z : player.pos.z; r.gy = k >= 0 ? surfY(k, x, z) : player.gy;
  });
}
/* Échec sans fin de partie (filet) : jamais retenu dans la salle secrète. */
function b7Echec() {
  if (G.state !== 'playing' || B7.lieu !== 'salle') return;
  const r = (BOSS_B7_ARENE.bunker7.retourJoueurs || [])[0];
  if (r) b7Teleporter(B7.id, r, r.lacet, 'bunker');
  else b7AuDepart();
}
/* Le joueur au départ de Bunker 7 (point d'apparition de la carte). */
function b7AuDepart() {
  b7Teleporter(B7.id, { x: LAYOUT.spawn.pos[0], y: LVY[Math.max(0, levelIndex(LAYOUT.spawn.lv || 0))], z: LAYOUT.spawn.pos[1] }, null, 'bunker');
  player.yaw = LAYOUT.spawn.yaw;
}

/* ----------------------------------------------------------- Navigation --- */
/* Chemin de a à b sur la grille (A*, 8 voisins sans couper les coins, portes ouvertes, escaliers), lissé par lignes
   droites praticables ; [points] ou null. */
function b7Chemin(a, b) {
  if (OW.on || !a || !b) return null;
  const k0 = nearestNode(+a.x, +a.z, +a.y || 0), k1 = nearestNode(+b.x, +b.z, +b.y || 0);
  if (k0 < 0 || k1 < 0) return null;
  const n = GN * NL;
  let N = B7.nav;
  if (!N || N.n !== n) N = B7.nav = { n, g: new Float32Array(n), de: new Int32Array(n), vu: new Uint32Array(n), ferme: new Uint32Array(n), tour: 0, tas: [], cle: [] };
  const T = ++N.tour, tx = nodeCX(k1), tz = nodeCZ(k1), tas = N.tas, cle = N.cle;
  tas.length = 0; cle.length = 0;
  const h = (k) => { const dx = Math.abs(nodeCX(k) - tx), dz = Math.abs(nodeCZ(k) - tz); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  const pousser = (k, f) => {
    let i = tas.length;
    tas.push(k); cle.push(f);
    while (i > 0) { const q = (i - 1) >> 1; if (cle[q] <= f) break; tas[i] = tas[q]; cle[i] = cle[q]; i = q; }
    tas[i] = k; cle[i] = f;
  };
  const extraire = () => {
    const top = tas[0], k = tas.pop(), f = cle.pop(), m = tas.length;
    if (m) {
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= m) break; if (c + 1 < m && cle[c + 1] < cle[c]) c++; if (cle[c] >= f) break; tas[i] = tas[c]; cle[i] = cle[c]; i = c; }
      tas[i] = k; cle[i] = f;
    }
    return top;
  };
  const ouvrir = (k, j, c) => { const g = N.g[k] + c; if (N.vu[j] !== T || g < N.g[j]) { N.vu[j] = T; N.g[j] = g; N.de[j] = k; pousser(j, g + h(j)); } };
  N.vu[k0] = T; N.g[k0] = 0; N.de[k0] = -1;
  pousser(k0, h(k0));
  let trouve = false;
  for (let it = 0; tas.length && it < 60000; it++) {
    const k = extraire();
    if (k === k1) { trouve = true; break; }
    if (N.ferme[k] === T) continue;
    N.ferme[k] = T;
    for (let d = 0; d < 4; d++) { const j = passD(k, d); if (j >= 0) ouvrir(k, j, 1); }
    for (const [dx, dz] of B7_DIAG) { const j = diagPass(k, dx, dz); if (j >= 0) ouvrir(k, j, Math.SQRT2); }
  }
  if (!trouve) return null;
  const ks = [];
  for (let k = k1; k >= 0; k = N.de[k]) ks.push(k);
  ks.reverse();
  const pts = [];
  let ancre = 0;
  for (let i = 2; i < ks.length; i++) {
    const ka = ks[ancre], ki = ks[i];
    if (levelOfNode(ka) === levelOfNode(ki) && losClear(ka, nodeCX(ka), nodeCZ(ka), nodeCX(ki), nodeCZ(ki), 0.3)) continue;
    ancre = i - 1;
    const x = nodeCX(ks[ancre]), z = nodeCZ(ks[ancre]);
    pts.push({ x, y: surfY(ks[ancre], x, z), z });
  }
  pts.push({ x: +b.x, y: surfY(k1, +b.x, +b.z), z: +b.z });
  return pts;
}
function b7PositionValide(p, lieu) {
  if (!p || !isFinite(+p.x + +p.z)) return false;
  const l = b7LieuDe(p);
  if (lieu && l !== lieu) return false;
  if (locateNode(+p.x, +p.z, +p.y || 0, true) < 0) return false;
  return l !== 'salle' || b7SalleLibre(p, 0.4);            // salle : hors des murs et des obstacles exacts (étape 4)
}

/* ---------------------------------------------------------- Adaptateur --- */
function b7Adaptateur() {
  return {
    joueurs: b7Joueurs,
    infligerDegats: b7Degats,
    blessureCritique: b7Critique,
    teleporter: b7Teleporter,
    controle: b7Controle,
    invulnerable: (id, actif) => { if (id === B7.id) B7.invul = !!actif; },
    faireApparaitreZombie: b7Apparition,
    zombies: b7Zombies,
    effetZombie: b7Effet,
    retirerZombie: b7Retirer,
    regarder: b7Regarder,
    tirerJoueur: b7Tirer,
    chemin: b7Chemin,
    positionValide: b7PositionValide,
    visible: (a, b) => !!a && !!b && sightClear(+a.x, +a.y || 0, +a.z, +b.x, +b.y || 0, +b.z),
    pointsBunker: b7PointsBunker,
    suspendreManches: (actif) => { B7.manches = !!actif; },
    listeAtouts: b7ListeAtouts,
    donnerArme: () => false,                               // D2 : les armes merveilles tombent au sol (deposerRecompense)
    donnerAtout: b7DonnerAtout,
    activerBonus: b7ActiverBonus,
    faireApparaitreBonus: b7Bonus,
    deposerRecompense: b7DeposerRecompense,
    lireDrapeau: (cle) => (B7.drapeaux[cle] === undefined ? false : B7.drapeaux[cle]),
    ecrireDrapeau: (cle, v) => { B7.drapeaux[cle] = v; },
    journal: b7Journal,
  };
}
/* Combat et adaptateur : créés une fois, à la première partie sur Bunker 7. */
function b7Creer() {
  if (B7.combat || !B7.on) return !!B7.combat;
  if (!B7S.actif) return false;                          // étape 9 : pas de salle dans cette grille (Bunker 7 modifié) : pas de combat
  try {
    if (typeof BossB7Logique !== 'object' || typeof BOSS_B7_CONFIG !== 'object' || typeof BOSS_B7_ARENE !== 'object') throw new Error('paquet du boss absent');
    B7.jeu = b7Adaptateur();
    const c = BossB7Logique.creerCombat({ config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE, jeu: B7.jeu });
    c.on('etat', (d) => { B7.etat = d.vers; B7.actif = !B7_HORS_COMBAT.includes(d.vers); });
    c.on('cinematique', (d) => { B7.cine = !!d.actif; });
    c.on('fin', b7RecompensesSuivent);
    c.on('echec', b7Echec);
    c.on('pilier', b7SallePilier);                         // étape 4 : dégâts du pilier tournés vers le point touché
    c.on('etat', b7AccesEtat);                             // étape 8 : phase 5, portes ouvertes
    B7.combat = c;
    if (!b7VueCreer()) throw new Error(`rendu du boss : ${B7V.err}`);   // étape 5 : modèle, effets, interface
    if (!b7EnnemisCreer()) b7Journal('erreur', `ennemis du boss : ${B7E.err || 'salle absente'} (mini-boss refusés)`);   // étape 6
  } catch (e) {
    B7.on = false; B7.err = String((e && e.message) || e);
    console.error('[boss B7]', e);
  }
  return !!B7.combat;
}
/* Sons du boss : décodés une fois sur le contexte audio du jeu, dès la première partie sur Bunker 7 (sans réseau : les
   MP3 sont dans le fichier du jeu), dans le bus des effets du jeu (volume général, étouffement à terre). */
function b7Sons() {
  if (B7.audio || !B7.on || typeof BossB7Audio !== 'object' || typeof BOSS_B7_SONS !== 'object') return;
  const bus = Sound.bus();
  if (!bus) return;                                        // pas de son : le combat se joue sans
  try {
    const sons = {};
    for (const cle in BOSS_B7_SONS.donnees) {
      const s = atob(BOSS_B7_SONS.donnees[cle]), u = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      sons[cle] = u.buffer;
    }
    const a = BossB7Audio.creer({ context: bus.ctx, destination: bus.sortie, manifeste: BOSS_B7_SONS.manifeste, sons, config: BOSS_B7_CONFIG, arene: BOSS_B7_ARENE });
    B7.audio = a; B7.sonsPrets = false; B7.volMusique = -1;
    if (B7.combat) a.brancher(B7.combat);                   // étape 5 : évènements du combat → effets sonores et musique
    a.precharger().then((r) => {
      for (const cle in sons) delete sons[cle];          // décodés : les MP3 bruts (10 Mo) ne servent plus
      if (B7.audio === a) { B7.sonsPrets = true; B7.sonsCharges = r; }
    });
  } catch (e) {
    B7.audio = null;
    console.error('[boss B7] sons', e);
  }
}
/* Une autre carte chargée : la salle n'est plus dans le monde ; les sons du boss (≈ 173 Mo décodés) sont libérés. */
function b7ChangementDeCarte() {
  if (G.mapId === BUNKER7.id) return;
  b7SalleQuitter();                                        // étape 4 : mondes ouverts compris (chargés sans buildWorld)
  if (!B7.audio) return;
  try { B7.audio.dispose(); } catch (e) { /* rien */ }
  B7.audio = null; B7.sonsPrets = false; B7.sonsCharges = null;
}
/* Nouvelle partie (newGame) : tout ce qui tient à la partie est remis à zéro ; sur Bunker 7, le combat aussi. */
function b7NouvellePartie() {
  B7.bloque = B7.invul = B7.manches = B7.actif = B7.cine = false;
  B7.lieu = 'bunker'; B7.regard = null; B7.drapeaux = {}; B7.atouts = 0; B7.e = null;
  B7.retires.clear(); B7.placees.clear();
  for (const r of B7.recompenses) scene.remove(r.m);
  B7.recompenses.length = 0;
  b7PanneauRemettre();                                     // étape 7 : vitesse du temps et invincibilité du panneau de test
  B7A.codes.secret = B7A.codes.boss = false;               // étape 8 : codes du digi pass tapés dans la partie
  if (!b7Carte() || !b7Creer()) return;
  if (B7.etat !== 'inactif') B7.combat.allerA('inactif');
  b7SalleRemettre();                                       // étape 4 : dalles, piliers et cuves à neuf
  b7VueRemettre();                                         // étape 5 : le Septième, ses effets et son interface
  b7EnnemisRemettre();                                     // étape 6 : mini-boss, petits Démembrés, irradiés, joueur
  b7Sons();
}
/* Chaque image (update, après les manches) : armes au sol, logique du combat. */
function b7Update(dt) {
  if (!B7.combat || !b7Carte() || G.state !== 'playing') return;   // fin de partie plus tôt dans l'image : plus rien du combat
  if (B7.audio && B7.volMusique !== settings.music) { B7.volMusique = settings.music; B7.audio.setVolume('musique', B7_MUSIQUE * settings.music); }
  b7MajRecompenses(dt);
  if (B7.retires.size) for (const [id, r] of B7.retires) if (G.time - r.t > 3) B7.retires.delete(id);
  if (B7.etat !== 'inactif') B7.combat.mettreAJour(dt);
  B7.e = B7.etat !== 'inactif' ? B7.combat.etat() : null;  // un instantané par image, partagé (salle, rendu)
  b7SalleMaj(dt);                                          // étape 4 : dalles, piliers, cuves, décor animé de la salle
  b7EnnemisMaj(dt);                                        // étape 6 : mini-boss, petits Démembrés, irradiés, joueur
  b7VueMaj(dt, B7.e);                                      // étape 5 : le Septième, effets, sons, interface
}
