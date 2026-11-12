/* ========================================================================== 43 TEMPS DE CHARGEMENT ==
   Jeu 2.0.7, demande d'Anthony du 11 novembre 2026 (« Ça prend un temps fou pour lancer une map ») : mesurer chez lui
   et alléger le lancement d'une carte.
   · Mesure : du démarrage au menu, puis de chaque lancement de carte (clic sur Jouer, reprise d'une sauvegarde) à la
     première image rendue (« jouable après »), puis les 30 images suivantes (la plus longue : gel d'une compilation).
     Une ligne « [chargement] … » dans la console ; le launcher la recopie dans son journal (launcher.log). Rien n'est
     affiché en jeu.
   · Préparations au démarrage, derrière l'écran de chargement, juste avant le menu (construction 3) : la machine de mort
     (section 32, mdmAuMenu) et les dessins à la craie des armes murales de toutes les cartes (chalkTexture, déjà
     gardés en cache pour la session). Ces travaux étaient faits au lancement de la première carte qui en avait besoin.
   · Le menu s'ouvre sur Bunker 7 (construction 3, choix d'Anthony du 12 novembre 2026), sauf reprise demandée par le
     launcher ; la sélection des cartes propose la dernière carte jouée.
   Points d'accroche : tools/hooks-chargement.py. */
const CHG = {
  m: null,               // mesure en cours : { quoi, carte, t0, monde, partie, mdm, p0 }
  images: null,          // attente des premières images : { quoi, t, n, pire, premiere }
  journal: [],           // lignes écrites (essais)
  prep: false,           // préparations du démarrage faites (une fois par session)
  prepLog: [],           // préparations faites (textes)
  prepMs: 0,
  gpu: null,
};
const CHG_IMAGES = 30, CHG_MAX_MS = 20000;
const chgS = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const chgProgrammes = () => { try { return renderer.info.programs.length; } catch (e) { return 0; } };   // 0 avant le moteur 3D
function chgGpu() {
  if (CHG.gpu) return CHG.gpu;
  try {
    const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info');
    CHG.gpu = String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 160);
  } catch (e) { CHG.gpu = 'inconnu'; }
  return CHG.gpu;
}
const chgActif = () => !window.zsModtools;      // les Mod Tools ne mesurent rien

/* Début d'une mesure. t0 : instant de départ (le clic ; 0 pour le démarrage de la page). */
function chgDebut(quoi, carte, t0) {
  if (!chgActif()) return;
  CHG.m = { quoi, carte: carte || null, t0: t0 === undefined ? performance.now() : t0, monde: 0, partie: 0, mdm: 0, p0: chgProgrammes() };
  CHG.images = null;
}
/* loadMap : temps de construction du monde (grille ou monde ouvert). */
function chgMonde(map, ms) {
  if (!chgActif()) return;
  if (!CHG.m) chgDebut('reprise', map && map.id, performance.now() - ms);
  CHG.m.monde += ms;
  if (map && !CHG.m.carte) CHG.m.carte = map.id;
}
/* startGame : temps de la mise en place de la partie ; ensuite, attente des premières images. */
function chgPartie(ms) {
  if (!chgActif()) return;
  if (!CHG.m) chgDebut('nouvelle partie', G.mapId, performance.now() - ms);
  CHG.m.partie += ms;
  if (!CHG.m.carte) CHG.m.carte = G.mapId;
  chgAttendre();
}
/* Machine de mort créée, ou recompilée pour l'éclairage d'une autre carte, pendant le lancement. */
function chgMdm(ms) { if (CHG.m) CHG.m.mdm += ms; }
/* Fin du démarrage (boot) : le menu est montré. */
function chgMenu() {
  if (!chgActif() || !CHG.m) return;
  CHG.m.carte = G.mapId;
  chgAttendre();
}
function chgAttendre() { CHG.images = { t: performance.now(), n: 0, pire: 0, premiere: 0, derniere: performance.now() }; }

/* Chaque image (début de frame) : intervalle depuis la précédente ; au bout de CHG_IMAGES images, la ligne. */
function chgImage() {
  const I = CHG.images;
  if (!I || !CHG.m) return;
  const t = performance.now(), dt = t - I.derniere;
  I.derniere = t;
  if (I.n === 1) I.premiere = t - CHG.m.t0;       // la première image (compilations comprises) est rendue
  if (I.n >= 2) I.pire = Math.max(I.pire, dt);       // images suivantes seulement (la première est dans « jouable après »)
  I.n++;
  if (I.n > CHG_IMAGES || t - I.t > CHG_MAX_MS) chgFin(t);
}
function chgFin(t) {
  const m = CHG.m, I = CHG.images;
  CHG.m = null; CHG.images = null;
  const nom = (m.carte && MAPS.byId[m.carte] && MAPS.byId[m.carte].name) || m.carte || '?';
  const morceaux = [
    `${m.quoi}`, `carte ${nom} (${m.carte || '?'})`,
    `${m.quoi === 'démarrage' ? 'menu affiché' : 'jouable'} après ${chgS(I.premiere)}`,
    m.quoi === 'démarrage' ? `page ${chgS(CHG.pageMs || 0)}` : null,
    m.quoi === 'démarrage' && CHG.prepMs ? `préparations ${chgS(CHG.prepMs)}` : null,
    m.monde ? `monde ${chgS(m.monde)}` : 'monde déjà chargé',
    m.partie ? `partie ${chgS(m.partie)}` : null,
    m.mdm ? `dont machine de mort ${chgS(m.mdm)}` : null,
    `${Math.max(0, I.n - 1)} images suivantes en ${chgS(t - m.t0 - I.premiere)}, la plus longue ${chgS(I.pire)}`,
    `shaders ${m.p0} → ${chgProgrammes()}`,
  ].filter(Boolean);
  if (m.quoi === 'démarrage') morceaux.push(`jeu ${GAME_VERSION} (construction ${GAME_BUILD})`, `GPU ${chgGpu()}`);
  const ligne = `[chargement] ${morceaux.join(' ; ')}`;
  CHG.journal.push(ligne);
  console.info(ligne);
}

/* ---------------------------------------------- préparations du démarrage --- */
/* Construction 3 (12 novembre 2026, mesures d'Anthony : machine de mort 5,4 s sur sa RTX 3080, menu figé d'autant) :
   tout est préparé d'un bloc à la fin du démarrage (boot), derrière l'écran de chargement, juste avant le menu. Le
   menu ne gèle plus ; les lancements de carte restent allégés. Le temps est compté dans « menu affiché après ». */
function chgPreparer() {
  if (CHG.prep || !chgActif()) return;
  CHG.prep = true;
  // une image du menu d'abord : les lampes de complément du boss (HC-boss-lampes.js) ne sont en place qu'après un rendu,
  // et la précompilation doit voir l'éclairage de la partie (sinon le premier bonus se compile en pleine partie)
  try { if (renderEnabled) render(); } catch (e) { console.warn('[chargement] image du menu', e); }
  const pieces = [];
  if (typeof mdmAuMenu === 'function') pieces.push(['machine de mort', mdmAuMenu]);
  const armes = new Set();
  for (const id of MAPS.list) for (const wb of (MAPS.byId[id] && MAPS.byId[id].wallbuys) || []) if (wb && WEAPONS[wb.w]) armes.add(wb.w);
  for (const w of armes) pieces.push([`craie ${w}`, () => { if (!CHALK[w]) { chalkTexture(w); return true; } return false; }]);
  let fait = 0, total = 0, craies = 0, craiesMs = 0;
  for (const [nom, f] of pieces) {
    const t = performance.now();
    let utile = false;
    try { utile = f() !== false; } catch (e) { console.warn('[chargement] préparation', nom, e); }
    const ms = performance.now() - t;
    if (!utile) continue;
    fait++; total += ms;
    if (nom.startsWith('craie ')) { craies++; craiesMs += ms; continue; }
    const T = nom === 'machine de mort' && MDM.temps;
    CHG.prepLog.push(T ? `machine de mort ${chgS(ms)} (reflets ${chgS(T.reflets)}, création ${chgS(T.creation)}, vue ${chgS(T.vue)}, miniature ${chgS(T.miniature)}, corps ${chgS(T.corps)})` : `${nom} ${chgS(ms)}`);
  }
  if (craies) CHG.prepLog.push(`${craies} craie(s) ${chgS(craiesMs)}`);
  CHG.prepMs = total;
  const ligne = `[chargement] préparé au démarrage : ${fait} élément(s) en ${chgS(total)}${CHG.prepLog.length ? ` (${CHG.prepLog.join(' ; ')})` : ''}`;
  CHG.journal.push(ligne); console.info(ligne);
}

/* Carte d'une reprise demandée par le launcher (#continuer=<carte>) : construite tout de suite au démarrage. */
function chgCarteReprise() {
  try { const c = new URLSearchParams(location.hash.slice(1)).get('continuer'); return c && MAPS.byId[c] ? c : null; } catch (e) { return null; }
}
