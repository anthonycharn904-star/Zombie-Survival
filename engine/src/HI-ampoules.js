/* ========================================================================== 38 AMPOULES ==
   Troisième easter egg secondaire de Bunker 7 (demande d'Anthony du 9 novembre 2026, pour le jeu 2.0.7) : tirer sur
   l'ampoule de chaque lampe de la carte (World.lights : 6 sur Bunker 7). Une ampoule touchée scintille quelques secondes
   (sa lampe aussi) ; chacune compte une fois. Toutes touchées : les lampes scintillent ensemble, un petit son, et
   « Munitions max » et « Atout gratuit » au sol près du joueur (comme l'horloge et le camion) ; écran « Secrets » :
   b7-ampoules. Une fois par partie ; une nouvelle partie remet le compte à zéro.
   · Pas pendant les lockdowns de la quête principale (QP : actif avant, et après) ni pendant le combat du boss ;
     seulement sur Bunker 7 ; les tirs déjà faits restent comptés pendant les lockdowns.
   · Tir : une sphère autour de l'ampoule dans hitscan (la balle s'y arrête), après les zombies, la plaque du
     disjoncteur, l'horloge et le camion. Seulement les balles (projectiles, grenades, couteau : rien).
   · Scintillement : intensité, halo et ampoule de la lampe multipliés après updateLights et qpLumieres (aucune lampe
     ajoutée ni cachée) ; au plus 3 baisses par seconde (règle des flashs) ; ni secousse.
   Points d'accroche : tools/hooks-ampoules.py.
   ============================================================================ */
const AMP = {
  marge: 0.05,                                 // m : autour de l'ampoule (dispersion des armes)
  scint: 3, final: 4,                          // s : scintillement d'une lampe touchée ; de toutes à la fin
  vie: 30,                                     // s : bonus au sol
  touchees: null, t: null, dernier: -1, fait: false, finT: 0, monde: null,
};
/* Ampoule d'une lampe (maillage de sa matière bulbMat) : centre et rayon dans le monde, ou null (lampe sans ampoule). */
function ampSphere(l) {
  let b = null;
  l.fixture.traverse((o) => { if (!b && o.isMesh && o.material === l.bulbMat) b = o; });
  if (!b) return null;
  b.updateMatrixWorld(true);
  const s = new THREE.Vector3().setFromMatrixScale(b.matrixWorld), c = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  b.geometry.boundingSphere || b.geometry.computeBoundingSphere();
  return { c, r: b.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) };
}
/* État pour le monde courant (les lampes sont refaites à chaque construction du monde). */
function ampEtat() {
  if (AMP.monde !== World.root || !AMP.touchees || AMP.touchees.length !== World.lights.length) {
    AMP.monde = World.root;
    AMP.spheres = World.lights.map(ampSphere);
    AMP.touchees = World.lights.map(() => false);
    AMP.t = World.lights.map(() => 0);
  }
}
/* L'easter egg répond-il ? */
function ampActif() {
  if (AMP.fait || OW.on || G.mapId !== BUNKER7.id || CUR.editor || !World.lights || !World.lights.length) return false;
  if (typeof B7 === 'object' && B7.actif) return false;                 // combat du boss
  if (typeof QP === 'object' && QP.etape === 'lockdowns') return false;  // lockdowns de la quête principale
  if (World.root && !World.root.visible) return false;                  // salle du boss affichée
  return true;
}
/* Rayon d'un tir contre les ampoules pas encore touchées : distance, ou −1 ; l'indice dans AMP.i. */
function ampRayon(ox, oy, oz, dx, dy, dz, maxT) {
  if (!ampActif()) return -1;
  ampEtat();
  let best = -1;
  for (let i = 0; i < AMP.spheres.length; i++) {
    const S = AMP.spheres[i];
    if (!S || AMP.touchees[i]) continue;
    const r = S.r + AMP.marge, px = S.c.x - ox, py = S.c.y - oy, pz = S.c.z - oz;
    const t = px * dx + py * dy + pz * dz;
    if (t <= 0 || t >= maxT || (best >= 0 && t >= best)) continue;
    const d2 = px * px + py * py + pz * pz - t * t;
    if (d2 > r * r) continue;
    best = t - Math.sqrt(r * r - d2); AMP.i = i;
  }
  return best;
}
/* Ampoule touchée : étincelles, tintement, la lampe scintille ; toutes : la réussite. */
function ampTouche(x, y, z, jeton) {
  const i = AMP.i;
  if (AMP.touchees[i]) return;
  AMP.touchees[i] = true; AMP.t[i] = AMP.scint;
  sparkBurst(x, y, z, 0, -1, 0, 5);
  ampSonVerre(x, y, z);
  if (AMP.touchees.every((v, k) => v || !AMP.spheres[k])) ampReussite();
}
function ampReussite() {
  AMP.fait = true; AMP.finT = AMP.final;
  ampSonReussite();
  if (typeof secretDecouvert === 'function') secretDecouvert('b7-ampoules');   // écran « Secrets » de l'Interface (2.0.7)
  const [a, b] = horlPlaces();
  if (atgLibres().length) atgPoser(a.x, a.z, a.gy, AMP.vie);
  spawnPowerup('ammo', b.x, b.z, b.gy); Powerups.list[Powerups.list.length - 1].life = AMP.vie;
}
/* (update, après updateLights et qpLumieres) : lampes qui scintillent ; au plus 3 baisses par seconde. */
function ampLumieres(dt) {
  if (!AMP.t || AMP.monde !== World.root) return;
  if (AMP.finT > 0) AMP.finT = Math.max(0, AMP.finT - dt);
  for (let i = 0; i < World.lights.length; i++) {
    if (AMP.t[i] > 0) AMP.t[i] = Math.max(0, AMP.t[i] - dt);
    const t = Math.max(AMP.t[i], AMP.finT);
    if (!(t > 0)) continue;
    const l = World.lights[i], u = G.time;
    // 2,6 baisses par seconde, toutes les lampes en même temps (plusieurs lampes à contretemps feraient plus de 3 éclats
    // par seconde : règle des flashs), sans grésillement rapide
    const fin = clamp(t / 0.6, 0, 1), creux = Math.pow(Math.abs(Math.sin(Math.PI * 2.6 * u)), 0.6);
    const k = lerp(1, 0.12 + 0.88 * creux, fin);
    l.light.intensity *= k; l.halo.material.opacity *= k; l.bulbMat.color.multiplyScalar(Math.max(0.15, k));
  }
}
/* (resetFeatures) : rien de touché, rien qui scintille. */
function ampRemettre() {
  AMP.fait = false; AMP.finT = 0; AMP.dernier = -1; AMP.monde = null; AMP.touchees = null; AMP.t = null;
}
/* Sons (Sound.synthe) : verre qui tinte (retardé du trajet du son), réussite. */
function ampSonVerre(x, y, z) {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const o = S.out({ x, y, z }, 0.55, 6); if (!o) return;
  const t = S.ctx.currentTime + Math.hypot(x - player.pos.x, z - player.pos.z) / 343;
  S.bell(t, rand(2600, 3400), 0.12, o, 0.5);
  S.noiseHit(t, 0.06, 0.4, 'highpass', 5000, null, 1, o, 0.001);
  S.tone('sine', 120, 60, t, 0.25, 0.08, o, 0.005);       // la lampe qui grésille
}
function ampSonReussite() {
  const S = Sound.synthe && Sound.synthe(); if (!S) return;
  const t = S.ctx.currentTime + 0.25, o = S.out(null, 0.3); if (!o) return;
  S.bell(t, 659.25, 0.18, o, 0.9);
  S.bell(t + 0.14, 880, 0.2, o, 1);
  S.bell(t + 0.28, 1318.5, 0.22, o, 1.3);
}
