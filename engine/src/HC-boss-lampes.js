/* ======================================================= 26b LAMPES CONSTANTES DU BOSS ==
   Gels du combat du boss de Bunker 7 (relevés par Anthony le 4 novembre 2026 : 15 à 20 s au début de la phase 5, gels
   avant, pendant et après la téléportation). three.js r128 compile un programme par matière et par nombre de lampes de
   chaque sorte : chaque fois que ce nombre change, toutes les matières dessinées sont recompilées (environ 0,3 s chacune
   sur une carte graphique sous Windows). Bunker 7 a 16 lampes ponctuelles et un hémisphère ; la couche d'effets du boss
   en ajoute 3 en phase 5 (60 programmes recompilés d'un bloc) ; la salle en a 17 et un projecteur (120 programmes).
   · Remède : sur Bunker 7 (menu compris, dès que la salle est dans sa grille), le nombre de lampes de chaque sorte reste
     celui du plus grand des états (Bunker 7 avec les effets du boss, salle avec ses effets) ; des lampes éteintes
     (intensité nulle, loin sous la carte) complètent l'état courant. Les matières de Bunker 7 sont compilées une fois, au
     chargement et au lancement de la partie comme avant ; l'entrée dans la salle ne compile plus que la salle et le boss ;
     la phase 5 et les retours, rien. Rien de visible ne change ; chaque image calcule 4 lampes éteintes de plus.
   · La compilation de la salle (b7Precompiler, écran noir de l'introduction) se fait avec ce même nombre de lampes, et
     compile aussi la couche d'effets de Bunker 7 (phase 5), ses lampes cachées le temps de la compilation.
   ============================================================================ */
const B7L = { cible: null, groupe: null, pads: {}, sig: '', image: 0, montees: 0 };
const B7L_SORTES = ['PointLight', 'SpotLight', 'HemisphereLight', 'DirectionalLight'];
// lampes d'une couche d'effets du boss avant sa création (BossB7Fx : 3 lampes ponctuelles par couche) ; si elle en a
// plus, le nombre visé monte une fois (b7LampesEgaliser)
const B7L_FX = { PointLight: 3, SpotLight: 0, HemisphereLight: 0, DirectionalLight: 0 };
function b7LampesCompte(racine, sauf) {
  const n = { PointLight: 0, SpotLight: 0, HemisphereLight: 0, DirectionalLight: 0 };
  if (!racine) return n;
  (function v(o) {
    if (!o.visible || (sauf && sauf.has(o))) return;
    if (o.isLight && n[o.type] != null && !o.userData.b7pad) n[o.type]++;
    for (const c of o.children) v(c);
  })(racine);
  return n;
}
/* Nombre visé : le plus grand des deux états (calculé sans changer d'état), puis jamais moins. */
function b7LampesCibleCalculer() {
  const S = B7S, V = B7V, fxS = V.fxSalle, fxB = V.fxBunker, groupes = new Set([S.racine, fxS, fxB, B7L.groupe].filter(Boolean));
  const seul = (g) => {                                 // lampes d'un groupe, comme s'il était affiché
    if (!g) return b7LampesCompte(null);
    const v = g.visible; g.visible = true;
    try { return b7LampesCompte(g); } finally { g.visible = v; }
  };
  const reste = b7LampesCompte(scene, new Set([...groupes, World.root].filter(Boolean)));
  const monde = seul(World.root), salle = seul(S.racine), fS = fxS ? seul(fxS) : B7L_FX, fB = fxB ? seul(fxB) : B7L_FX, c = {};
  for (const t of B7L_SORTES) {
    const bunker = reste[t] + monde[t] + fB[t];
    let dansSalle = reste[t] + salle[t] + fS[t];
    if (t === 'HemisphereLight' && HEMI && HEMI.visible) dansSalle -= 1;   // l'hémisphère du jeu est caché dans la salle
    c[t] = Math.max(bunker, dansSalle);
  }
  return c;
}
function b7LampePad(t) {
  const L = t === 'PointLight' ? new THREE.PointLight(0x000000, 0, 0.01, 2) : t === 'SpotLight' ? new THREE.SpotLight(0x000000, 0, 0.01, 0.3, 0, 2)
    : t === 'HemisphereLight' ? new THREE.HemisphereLight(0x000000, 0x000000, 0) : new THREE.DirectionalLight(0x000000, 0);
  L.userData.b7pad = true; L.position.set(0, -500, 0); L.castShadow = false;
  B7L.groupe.add(L);
  return L;
}
/* Avant chaque rendu (après b7SalleAvantRendu) et avant la compilation de la salle : lampes éteintes ajustées. */
function b7LampesEgaliser(force) {
  const actif = B7.on && B7S.actif && B7S.racine && !OW.on && G.state !== 'editor';
  if (!actif) { if (B7L.groupe && B7L.groupe.parent) B7L.groupe.parent.remove(B7L.groupe); return; }
  if (!B7L.groupe) { B7L.groupe = new THREE.Group(); B7L.groupe.name = 'b7-lampes-eteintes'; }
  if (B7L.groupe.parent !== scene) scene.add(B7L.groupe);
  const V = B7V, S = B7S;
  const sig = [S.racine.parent ? 1 : 0, World.root && World.root.visible ? 1 : 0, HEMI && HEMI.visible ? 1 : 0,
    V.fxSalle && V.fxSalle.parent ? 1 : 0, V.fxBunker && V.fxBunker.parent ? 1 : 0, B7E.gS && B7E.gS.parent ? 1 : 0, scene.children.length].join('');
  if (!force && sig === B7L.sig && ++B7L.image % 30) return;
  B7L.sig = sig;
  if (!B7L.cible) B7L.cible = b7LampesCibleCalculer();
  const n = b7LampesCompte(scene);
  for (const t of B7L_SORTES) {
    if (n[t] > B7L.cible[t]) { B7L.cible[t] = n[t]; B7L.montees++; console.warn(`[boss B7] lampes : ${n[t]} ${t}, plus que prévu`); }
    const pads = B7L.pads[t] || (B7L.pads[t] = []), besoin = B7L.cible[t] - n[t];
    while (pads.length < besoin) pads.push(b7LampePad(t));
    pads.forEach((L, i) => { L.visible = i < besoin; });
  }
}
/* Branchements : après le choix du lieu (b7SalleAvantRendu) ; compilation de la salle au même nombre de lampes. */
{
  const avantRendu0 = b7SalleAvantRendu, precompiler0 = b7Precompiler;
  b7SalleAvantRendu = function () {
    // la compilation de la salle a lieu à la fin de b7SalleAvantRendu : lampes ajustées juste avant (renderer.compile)
    const c0 = renderer.compile;
    renderer.compile = function (s, cam) { b7LampesEgaliser(true); return c0.call(this, s, cam); };
    try { avantRendu0(); } finally { renderer.compile = c0; }
    b7LampesEgaliser(false);
  };
  b7Precompiler = function () {
    const fxB = B7V.fxBunker, cachees = [];
    if (!B7L.cible) B7L.cible = b7LampesCibleCalculer();   // avant de cacher les lampes de la couche de Bunker 7
    let pose = false;
    if (fxB && fxB.parent !== scene) {                    // couche d'effets de Bunker 7 (phase 5) : ses matières, sans ses lampes
      fxB.traverse((o) => { if (o.isLight && o.visible) { o.visible = false; cachees.push(o); } });
      scene.add(fxB); pose = true;
    }
    try { precompiler0(); } finally {
      if (pose) scene.remove(fxB);
      for (const o of cachees) o.visible = true;
      b7LampesEgaliser(true);
    }
  };
}
