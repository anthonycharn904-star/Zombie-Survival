/* ========================================================================== 35 ATOUT GRATUIT ==
   Bonus « Atout gratuit » (jeu 2.0.7, décisions d'Anthony du 4 novembre 2026) : une récompense des easter eggs,
   principaux et secondaires (le premier : l'horloge de la gare, HE-horloge.js), jamais lâchée au hasard par les
   zombies (POWERUPS.freeperk.tirage === false). Posé au sol comme les autres bonus (une fiole dans leur vert : elle ne
   dit pas quel atout). Ramassé : le joueur boit l'atout, avec la boisson des machines (la fiole à la couleur et à
   l'étiquette de l'atout), sans payer et sans courant. L'atout est tiré au moment de boire, parmi tous ceux du jeu
   qu'il n'a pas : Object.keys(PERKS), donc aussi les atouts à venir, même ceux qui n'auront pas de machine sur la
   carte. À terre pendant la boisson, la fiole tombe comme d'habitude, mais l'atout reste dû : il est bu une fois le
   joueur relevé. Le joueur a déjà tous les atouts : un bandeau le dit.
   · Pour un easter egg : atgPoser(x, z, gy, vie) pose le bonus ; atgLibres() dit s'il reste un atout à offrir.
   · Le nom « freeperk » est celui qu'attend l'annonceur de l'intégration 2.0.7 (voix « Atout gratuit »).
   Points d'accroche : tools/hooks-horloge.py (modèle, ramassage, chaque image, remise à zéro, tirage au hasard).
   ============================================================================ */
const ATG = {
  delai: 0.4,                                  // s : entre le ramassage (bandeau, voix) et le début de la boisson
  attente: 0, t: 0, boit: null,                // atouts dus ; délai en cours ; atout en train d'être bu
};
POWERUPS.freeperk = { name: 'Atout gratuit', say: 'Atout gratuit !', tirage: false };

/* Atouts qu'on peut offrir : tous ceux du jeu que le joueur n'a pas, sauf Quick Revive épuisé (3 relevés : il n'aurait
   plus d'effet) et l'atout en train d'être bu (payé à une machine). */
function atgLibres() {
  return Object.keys(PERKS).filter((id) => !player.perks.has(id)
    && !(id === 'souffle' && player.souffleUses >= 3)
    && !(Arms.state === 'drink' && Arms.drinkId === id));
}
/* Pose le bonus au sol (vie : durée en secondes ; 26 s par défaut, comme les autres bonus). */
function atgPoser(x, z, gy, vie) {
  spawnPowerup('freeperk', x, z, gy);
  if (vie) Powerups.list[Powerups.list.length - 1].life = vie;
}
/* Ramassage (applyPowerup) : un atout de plus à boire, après le bandeau et la voix du bonus. */
function atgRamasse() { ATG.attente++; ATG.t = ATG.delai; }
/* Chaque image (updateFeatures) : boisson interrompue (à terre) → l'atout reste dû ; sinon, dès que les mains sont
   vraiment libres (ni rechargement, ni réarmement, ni rechargement automatique prévu, ni grenade, ni couteau : rien
   n'est coupé, à la différence d'une machine où le joueur choisit d'appuyer) et le joueur debout, il boit l'atout. */
function atgMaj(dt) {
  if (ATG.boit) {
    if (Arms.state === 'drink' && Arms.drinkId === ATG.boit) return;
    if (!player.perks.has(ATG.boit)) { ATG.attente++; ATG.t = ATG.delai; }
    ATG.boit = null;
  }
  if (!ATG.attente || G.state !== 'playing') return;
  if (ATG.t > 0) { ATG.t -= dt; return; }
  if (player.down || Arms.state !== 'idle' || Arms.cyc || Arms.autoReloadAt > 0) return;
  ATG.attente--;
  const l = atgLibres();
  if (!l.length) { HUD.banner(POWERUPS.freeperk.name, 'Vous avez déjà tous les atouts', 'powerup'); return; }
  ATG.boit = l[Math.floor(Math.random() * l.length)];
  startDrink(ATG.boit);                        // la boisson des machines : fiole de l'atout, atout accordé à la gorgée
  Life.add('perks');
}
/* Remise à zéro (resetFeatures). */
function atgRemettre() { ATG.attente = 0; ATG.t = 0; ATG.boit = null; }

/* Modèle au sol : une fiole dans le vert des bonus, avec leur halo. */
function atgModele() {
  const g = new THREE.Group(), V = bottleGeometries('flask'), S = VIALS.flask, f = new THREE.Group(), k = 2.4;
  f.scale.setScalar(k); f.position.y = -0.1 * k;
  const liq = new THREE.Mesh(V.liquid, MAT.powerup); liq.position.y = S.liquidY; liq.scale.y = S.liquidH;
  const verre = new THREE.Mesh(V.glass, MAT.bottleGlass); verre.renderOrder = 2;
  f.add(liq, verre, new THREE.Mesh(V.capOn, MAT.powerupDark));
  g.add(f);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0x64ff70, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(1.3, 1.3, 1);
  g.add(halo);
  return g;
}
