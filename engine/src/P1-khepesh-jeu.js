/* ------------------------------------------------ Khépesh : règles du jeu (2.0.4) ---
   Demande d'Anthony (13 octobre 2026, 7 h 57), avec le fichier khepesh-melee.js fait avec Claude :
   « cette arme, qui sera utilisable uniquement dans la 2ème map, Khamsin », arme de corps-à-corps
   principale, « identique au fichier », pour le jeu 2.0.4. Module creerKhepesh juste au-dessus (bras
   ganté, épée-faucille de bronze, traînée, sang, flaques, saignement, sons, animations touché et raté).
   Arme de corps-à-corps du désert de Khamsin : Khamsin, ses copies et le désert vierge des Mod Tools
   (même monde) ; le couteau reste celui de Bunker 7, des cartes en grille et de la Lune. V ou E, comme
   le couteau (startKnife, état « knife » de updateArms). Le module dessine et joue ; le jeu choisit les
   cibles et applique ses dégâts, avec la géométrie du fichier : quand la lame arrive (0,3 s), jusqu'à
   3 zombies à 2,4 m de l'œil (jusqu'à leur surface), à ±62° du regard (plus leur demi-largeur), du plus
   proche au plus loin : 150, 113 et 75 dégâts (+10 par touche, +130 s'il meurt : élimination au
   corps-à-corps, comme le couteau). Règles du jeu en plus : même étage (±1 m), pas en train de sortir
   de terre ni sous le sable, pas derrière un mur (sightClear). Saignement (fichier) : la moitié des
   dégâts du coup en 4 s, par tranches de 0,5 s ; pas de points par tranche ; un zombie qui en meurt
   compte comme une élimination au corps-à-corps (+130). Le Gardien ne perd pas de PV par saignement
   (ses fenêtres de tir décident de ses dégâts). Le khépesh fait lâcher prise au Rôdeur, comme le
   couteau. Pas d'élan vers le zombie (le fichier n'en a pas). La vue ne bouge pas : secousse de caméra
   et coup de zoom du module coupés (vertige, comme pour le couteau). */
const KHEPESH = {
  damage: 150, range: 2.4, cone: 62, max: 3, factors: [1, 0.75, 0.5],   // valeurs du fichier
  bleed: { part: 0.5, duree: 4, pas: 0.5 },                              // saignement du fichier
  radius: 0.35, bossRadius: 0.6,     // demi-largeur d'un zombie (fichier) ; du Gardien (3,2 m)
  volume: 0.21,                      // niveau des sons du module dans le bus des effets du jeu : le coup sonne comme celui
                                     // du couteau (à 0,27, comme le couteau, il sonnait 2 dB plus fort ; fichier : 0,7)
  env: null, envReady: false,        // reflets du bronze du fichier, calculés d'avance (khepeshEnv, bloc suivant)
  buildMs: 0,                        // temps de construction mesuré (essais)
};
let Khepesh = null;
const _khpP = new THREE.Vector3(), _khpEye = new THREE.Vector3(), _khpFwd = new THREE.Vector3(), _khpV = new THREE.Vector3();
const _khpDeg = 180 / Math.PI;
/* Le khépesh est l'arme de corps-à-corps du désert (Khamsin, ses copies, le désert vierge), en partie
   (pas dans les Mod Tools). */
function khepeshOn() { return OW.on && OW.worldId === 'khamsin' && !CUR.editor; }
/* Arme de corps-à-corps en cours (V ou E) : le khépesh dans le désert (fait au premier besoin), sinon le couteau. */
function meleeMod() { return khepeshOn() ? Khepesh || buildKhepesh() : Couteau; }
function meleeCur() { return khepeshOn() ? Khepesh : Couteau; }
function meleeName() { return khepeshOn() ? 'Khépesh' : 'Couteau'; }
/* Point visé : la poitrine ; plus bas pour un Rôdeur, un rampant ou un zombie à terre ; plus haut pour le Gardien. */
function khepeshPoint(z, out) {
  const h = z.boss ? 1.8 : z.dog ? 0.6 : z.crawl || z.knockT > 0 ? 0.35 : 1.3;
  return out.set(z.pos.x, z.gy + h, z.pos.z);
}
/* Zombie que la lame peut trouver : vivant, sorti de terre, au même étage, pas sous le sable. */
function khepeshCan(z) {
  if (!z.alive || z.removed || z.state === 'rise' || Math.abs(z.gy - player.gy) > 1) return false;
  if (z.rodeur && (z.rstate === 'gone' || z.pos.y < z.gy - 0.6)) return false;
  if (z.boss && (z.scale < 0.5 || (z.gstate === 'rise' && z.sunk > 0.6))) return false;
  return true;
}
/* Cibles quand la lame arrive, avec la géométrie du fichier (sa recherche interne) : de l'œil jusqu'à la
   surface du zombie, arc autour du regard élargi de sa demi-largeur, du plus proche au plus loin, 3 au
   plus ; les murs arrêtent la lame. */
function khepeshChoose() {
  camera.getWorldPosition(_khpEye); camera.getWorldDirection(_khpFwd);
  const res = [];
  for (const z of Zombies.list) {
    if (!khepeshCan(z)) continue;
    const p = khepeshPoint(z, new THREE.Vector3());
    _khpV.subVectors(p, _khpEye);
    const d = _khpV.length(), r = z.boss ? KHEPESH.bossRadius : KHEPESH.radius;
    if (d - r > KHEPESH.range) continue;
    if (_khpV.angleTo(_khpFwd) * _khpDeg > KHEPESH.cone + Math.atan2(r, Math.max(d, 0.01)) * _khpDeg) continue;
    if (!sightClear(_khpEye.x, _khpEye.y, _khpEye.z, p.x, p.y, p.z)) continue;
    res.push({ cible: z, point: p, rayon: r, d });
  }
  res.sort((a, b) => a.d - b.d);
  return res.slice(0, KHEPESH.max);
}
/* La lame touche (info.degats : 150, 113 ou 75 selon le rang) : dégâts, points et décompte du jeu. */
function khepeshOnHit(z, info) {
  if (z.rodeur) khKnifeRelease(z);                    // le khépesh fait lâcher prise au Rôdeur
  const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
  const killed = damageZombie(z, info.degats, { kind: 'knife', dx: dx / d, dz: dz / d, force: 1.2 });
  HUD.hitmarker(killed);
}
/* Saignement : PV retirés sans points ni réaction ; mort au corps-à-corps (+130). Renvoie false quand le
   saignement s'arrête (zombie mort ou parti ; le Gardien n'en perd pas de PV). */
function khepeshBleed(z, dose) {
  if (!z.alive || z.removed || z.boss) return false;
  z.hp -= G.timers.insta > 0 ? z.hp + 1 : dose;
  if (z.hp > 0) return true;
  const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
  killZombie(z, { kind: 'knife', dx: dx / d, dz: dz / d, force: 0.4 });
  return false;
}
/* Le module : bras ganté aux couleurs des gants et des manches du jeu (manche : MAT.sleeve), vue à part
   rendue par-dessus l'arme (render), reflets du bronze du fichier (sa salle aux torches préfiltrée,
   calculée d'avance au pixel près : khepeshEnv ; préfiltrée au chargement, elle prenait 25 à 30 s en
   rendu logiciel), son dans le bus des effets du jeu, règles du jeu ; il n'écoute pas le clavier (V et E
   passent par updateArms) et ne secoue pas la vue. Fait une fois, au premier chargement du désert en partie. */
function buildKhepesh() {
  const t0 = performance.now();
  Khepesh = creerKhepesh(THREE, {
    camera, scene, renderer,
    envMap: khepeshEnv(),                                     // la salle aux torches du fichier, préfiltrée d'avance
    ecouterClavier: false, vueSeparee: true, fovVue: 72, enchainement: true,
    portee: KHEPESH.range, angleCone: KHEPESH.cone, ciblesMax: KHEPESH.max, facteurs: KHEPESH.factors,
    degats: KHEPESH.damage, saignement: KHEPESH.bleed, rayonCible: KHEPESH.radius,
    choisirCible: khepeshChoose, onHit: khepeshOnHit, onSaignement: khepeshBleed,
    getHitPoint: (z) => khepeshPoint(z, _khpP), getSol: (z) => z.gy,
    couleurs: { gant: 0x3b2a1d, manche: 0x4f5638 },          // MAT.glove, MAT.sleeve
    gravite: 9.81, hauteurSol: 0,
    son: true, volume: KHEPESH.volume, audio: () => Sound.bus(),
    secousseCamera: false, secousseFOV: false, modeCamera: 'reinitialise',
  });
  // manche : la matière des bras du jeu (même couleur, même toile), comme pour le couteau
  Khepesh.rig.traverse((m) => { if (m.material && m.material.color && !m.material.map && m.material.color.equals(MAT.sleeve.color)) m.material = MAT.sleeve; });
  // matières compilées au chargement : pas d'à-coup au premier coup
  Khepesh.rig.visible = true; renderer.compile(Khepesh.sceneVue, Khepesh.cameraVue); Khepesh.rig.visible = false;
  KHEPESH.buildMs = Math.round(performance.now() - t0);
  return Khepesh;
}
/* Changement de carte, nouvelle partie, retour aux Mod Tools : rangé, sang effacé. */
function khepeshClear() {
  if (!Khepesh) return;
  Khepesh.annuler(); Khepesh.nettoyer();
}
