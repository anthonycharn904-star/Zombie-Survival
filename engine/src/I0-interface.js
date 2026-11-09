/* ------------------------------------------------------------- Interface --
   Refonte de l'interface du jeu (chantier interface ; plan : docs/plan-interface-jeu.md). Menu principal
   vertical (logo, boutons, rapport opérationnel de la carte chargée), sélection des cartes en trois zones
   (navigation, liste des dossiers, aperçu et fiche de la carte survolée), clavier, sons des menus, fond
   figé sous les écrans opaques, aperçus vidéo déclarés dans apercus/index.json (une seule vidéo décodée à la
   fois), réglages « Réduire les animations », « Sons des menus », « Fond du menu ».
   Les éléments du jeu 1.9.0 sont déplacés dans la nouvelle mise en page avec leurs identifiants et leurs
   écouteurs : aucune règle d'écran n'est réécrite. Styles : engine/interface/interface.css. Points
   d'accroche : tools/hooks-interface.py (ifcMonter, ifcEcran, ifcChoix, ifcFige, ifcBalance). */
const IFC = {
  pret: false,
  ecran: null,                     // dernier écran demandé à showScreen
  calme: false, calmeChoisi: null, // animations réduites (null : préférence du système)
  sons: true,                      // sons des menus
  fond: 'illustration', fixe: false, fondPret: false,   // fond du menu (illustration, scène, scène figée), illustration chargée
  images: 0, depuis: 0,            // fond figé : images rendues depuis le dernier changement, et son heure
  carteVue: null, toile: '',       // carte et taille de la toile de la dernière image (un changement redessine)
  gelT: null,                      // balancement de la caméra du menu arrêté à cet instant
  survol: null, survolMinuteur: 0, // sélection : carte survolée (null : on montre la carte choisie)
  apercu: null, couche: 0,         // carte de l'aperçu, couche visible (fondu entre deux couches)
  plans: new WeakMap(),            // plans dessinés une fois par carte (cartes sans image)
  manifeste: null, demande: false, // aperçus déclarés (apercus/index.json), lu à la première sélection
  video: null, jeton: 0,           // vidéo de l'aperçu ({ v, url }) ; jeton : un chargement plus récent l'emporte
  pauseT: 0, repriseEchap: false,  // heure d'ouverture de la pause ; reprise par Échap, souris pas encore reprise
};
/* Fond des écrans hors partie (demande d'Anthony du 3 novembre 2026) : une illustration, assombrie derrière les
   écrans ; ambiance 2D accordée à l'illustration. Livrée à côté du jeu (launcher/gamelibs/fonds/). */
const IFC_FOND = { image: 'fonds/menu.jpg', position: '50% 42%', ambiance: 'sable' };
const IFC_ECRANS_MENU = ['menu', 'mapsel', 'stats', 'models', 'ranking', 'mods', 'secrets', 'options', 'confirm'];   // confirm : confirmations de la sauvegarde (2.0.7)
/* Ordre des maquettes : Jouer ouvre la sélection (décision d'Anthony du 2 novembre 2026), puis l'amélioration
   d'arme, les trois écrans du survivant, les options et la sortie. Commandes : fenêtres étroites seulement. */
const IFC_ORDRE = ['btn-play', 'btn-resume-save', 'btn-mods', 'btn-stats', 'btn-models', 'btn-ranking', 'btn-secrets', 'btn-options', 'btn-controls', 'btn-exit'];

/* Une fois, au démarrage (après bindUI) : nouvelle mise en page, options, clavier. Aucune carte n'est encore
   chargée : le contenu des écrans se remplit quand ils s'ouvrent (ifcEcran). */
function ifcMonter() {
  if (IFC.pret) return;
  ifcLireReglages();
  ifcSecretsMonter();                                       // écran « Secret » (I3-secrets.js), avant la mise en page du menu
  ifcMonterMenu();
  ifcMonterSelection();
  ifcMonterOptions();
  ifcMonterEcrans();                                       // phase D : autres écrans du menu, pause, fin de partie (I2-ecrans.js)
  ifcFondMonter();
  window.addEventListener('keydown', ifcClavier);
  if (!window.zsModtools) for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, ifcEveil, true);
  // vidéo de l'aperçu en pause fenêtre cachée ou réduite : dans le launcher (backgroundThrottling désactivé), la page
  // reste « visible » ; la perte du focus de la fenêtre (réduite, autre fenêtre devant) le dit
  const pause = () => { if (IFC.video) IFC.video.v.pause(); };
  const reprise = () => { if (IFC.video && !$('mapsel').hidden && !document.hidden) IFC.video.v.play().catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else reprise(); ifcAmbiance(); });
  window.addEventListener('blur', pause);
  window.addEventListener('focus', reprise);
  // reprise par Échap : le premier clic reprend la souris sans atteindre le jeu (ni tir ni visée)
  window.addEventListener('mousedown', (e) => {
    if (!IFC.repriseEchap) return;
    IFC.repriseEchap = false;
    if (G.state !== 'playing' || Input.locked) return;
    e.stopPropagation();
    e.preventDefault();
    requestLock();
  }, true);
  // « Sons des menus » éteint : le clic de validation du jeu se tait aussi hors partie (pause et fin de partie le gardent)
  const ui0 = Sound.ui;
  Sound.ui = function ui() { if (IFC.sons || G.state !== 'menu' || window.zsModtools) ui0(); };
  IFC.pret = true;
}

/* --- réglages (zs.interface ; les réglages du jeu, zs.settings, ne changent pas) */
function ifcLireReglages() {
  const r = store.get('zs.interface', {}) || {};
  IFC.calmeChoisi = typeof r.calme === 'boolean' ? r.calme : null;
  IFC.sons = r.sons !== false;
  IFC.fond = ['illustration', 'scene', 'fixe'].includes(r.fond) ? r.fond : r.fond === 'anime' ? 'scene' : 'illustration';
  IFC.fixe = IFC.fond === 'fixe';
  ifcAppliquer();
}
function ifcAppliquer() {
  const sys = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  IFC.calme = IFC.calmeChoisi === null ? sys : IFC.calmeChoisi;
  document.body.classList.toggle('ifc-calme', IFC.calme);
  ifcRafraichir();
  ifcFond();
  ifcAmbiance();
}
function ifcEcrireReglages() {
  store.set('zs.interface', { calme: IFC.calmeChoisi, sons: IFC.sons, fond: IFC.fond });
  ifcAppliquer();
}

/* --- menu principal */
function ifcMonterMenu() {
  const menu = $('menu'), grille = menu.querySelector('.menu-grid'), actions = menu.querySelector('.actions'), dossier = $('dossier');
  menu.classList.add('ifc');
  grille.classList.add('ifc-menu');
  ifcAmbianceMonter(menu);                                 // atmosphère 2D de la carte (I1-ambiance.js)
  const tete = el('header', 'ifc-tete');
  $('menu-title').classList.add('ifc-logo');
  tete.append($('menu-title'), $('menu-eyebrow'));
  const nav = el('nav', 'ifc-nav');
  nav.setAttribute('aria-label', 'Menu principal');
  // boutons connus dans l'ordre des maquettes ; un bouton ajouté par un autre chantier passe avant Options
  const fin = ['btn-options', 'btn-controls', 'btn-exit'], inconnus = [...actions.children].filter((b) => !IFC_ORDRE.includes(b.id));
  [...IFC_ORDRE.filter((id) => !fin.includes(id)).map((id) => $(id)), ...inconnus, ...fin.map((id) => $(id))].forEach((b, i) => {
    if (b.classList.contains('btn')) b.classList.add('ifc-item');
    b.style.setProperty('--ifc-i', i);
    actions.append(b);
  });
  nav.append(actions);
  const pied = el('footer', 'ifc-pied');
  pied.append($('menu-rank'), $('game-version'), $('touch-note'));
  // rapport opérationnel : le dossier du jeu (consignes, touches) avec la fiche de la carte chargée
  const stamp = dossier.querySelector('.stamp'), zone = dossier.querySelector('h2'), consignes = dossier.querySelector('h3');
  const ordres = dossier.querySelector('.orders'), touches = dossier.querySelector('.keys');
  dossier.classList.add('ifc-rapport');
  dossier.setAttribute('aria-label', 'Rapport opérationnel');
  zone.className = 'ifc-r-zone';
  zone.textContent = '';
  const carte = el('div', 'ifc-r-carte');
  carte.append(el('div', 'ifc-r-plan'), el('dl', 'ifc-faits'));
  const cmd = el('details', 'ifc-r-cmd');
  cmd.append(el('summary', '', 'Commandes'), touches);
  // un élément ajouté par un autre chantier n'est jamais retiré : en bas du rapport, sous les boutons du menu
  const dansDossier = [...dossier.children].filter((n) => ![stamp, zone, consignes, ordres, touches].includes(n));
  dossier.replaceChildren(stamp, el('p', 'ifc-r-sur', 'Rapport opérationnel'), zone, carte, $('best'), el('h3', '', 'Briefing'), $('menu-lead'), consignes, ordres, ...dansDossier, cmd);
  const intro = grille.querySelector('.intro');
  if (intro) nav.append(...intro.children);                // ex. : la ligne de la sauvegarde (#menu-save-done, 2.0.7)
  const autres = [...grille.children].filter((n) => n !== intro && n !== dossier);
  grille.replaceChildren(tete, nav, dossier, pied, ...autres);
  // fenêtres étroites : le rapport reste visible ; le bouton Commandes ouvre le volet des touches
  $('btn-controls').addEventListener('click', () => { cmd.open = true; cmd.scrollIntoView({ block: 'nearest' }); });
  actions.addEventListener('pointerover', (e) => { const b = e.target.closest('.btn'); if (b) ifcActif(b, true); });
  actions.addEventListener('focusin', (e) => { const b = e.target.closest('.btn'); if (b) ifcActif(b, false); });
}
/* Surlignage : un seul élément à la fois, celui de la souris ou du clavier (le focus le suit). */
function ifcActif(b, survol) {
  if (b.classList.contains('ifc-actif')) return;
  const nav = b.parentElement;
  for (const x of nav.querySelectorAll('.ifc-actif')) x.classList.remove('ifc-actif');
  b.classList.add('ifc-actif');
  if (!survol) return;
  ifcSon();
  if (nav.contains(document.activeElement) && document.activeElement !== b) b.focus({ preventScroll: true });
}
/* Fiche de la carte chargée (celle du fond), à chaque retour au menu. */
function ifcRapport() {
  const map = CUR.map;
  if (!map) return;
  const d = $('dossier');
  d.querySelector('.ifc-r-zone').textContent = map.name;
  ifcVignette(d.querySelector('.ifc-r-plan'), map);
  ifcFaits(d.querySelector('.ifc-faits'), map, false);
  const actif = $('menu').querySelector('.actions .ifc-actif');
  if (actif && actif.hidden) actif.classList.remove('ifc-actif');
}
/* Faits réels seulement : type, record, parties, auteur. */
function ifcFaits(dl, map, record) {
  const lignes = [['Type', map.open ? 'Monde ouvert' : 'Salles et couloirs']];
  if (record) {
    const best = store.get(`zs.best.${map.id}`, 0);
    lignes.push(['Record', best > 0 ? plural(best, 'manche') : 'Aucune partie terminée']);
  }
  const games = Life.data && Life.data.maps[map.id] ? Life.data.maps[map.id].games : 0;
  lignes.push(['Parties', games ? plural(games, 'partie') : 'Jamais jouée']);
  if (map.author) lignes.push(['Auteur', map.author]);
  dl.replaceChildren(...lignes.flatMap(([k, v]) => [el('dt', '', k), el('dd', '', v)]));
}
/* Image de la carte : l'affiche déclarée dans le manifeste des aperçus, son image, ou son plan (dessiné une
   fois, recopié à chaque usage). */
function ifcImage(map, a) {
  const src = a && a.affiche ? `apercus/${a.affiche}` : map.thumb;
  if (src) {
    const img = el('img');
    img.alt = ''; img.decoding = 'async';
    if (a && a.cadrage) img.style.objectPosition = a.cadrage;
    // affiche déclarée mais absente ou illisible : l'image ou le plan de la carte
    if (a && a.affiche) img.addEventListener('error', () => { console.warn(`Affiche de ${map.id} illisible`); img.replaceWith(ifcImage(map)); }, { once: true });
    img.src = src;
    return img;
  }
  let plan = IFC.plans.get(map);
  if (!plan) { plan = mapPlan(map); IFC.plans.set(map, plan); }
  const c = el('canvas');
  c.width = plan.width; c.height = plan.height;
  c.getContext('2d').drawImage(plan, 0, 0);
  return c;
}
function ifcVignette(boite, map) {
  if (boite.dataset.id === map.id && boite.firstChild) return;
  boite.dataset.id = map.id;
  boite.replaceChildren(ifcImage(map));
}
/* « Nouveau » : la carte est arrivée avec cette version du jeu (champ « ajout » de la carte). */
const ifcNouveau = (map) => !!map.ajout && map.ajout === GAME_VERSION;

/* --- sélection des cartes : trois zones (navigation, dossiers, aperçu et fiche) */
function ifcMonterSelection() {
  const ms = $('mapsel'), sheet = ms.querySelector('.sheet'), head = sheet.querySelector('.sheet-head'), actions = sheet.querySelector('.sheet-actions');
  ms.classList.add('ifc');
  sheet.classList.add('ifc-sel');
  const { rail } = ifcRailMonter($('btn-ms-back'));
  const liste = el('div', 'ifc-liste-col');
  head.append(el('p', 'ifc-compte'));
  liste.append(head, $('ms-grid'));
  const fiche = el('section', 'ifc-fiche-col');
  fiche.setAttribute('aria-label', 'Fiche de la carte');
  const apercu = el('div', 'ifc-apercu');
  apercu.append(el('div', 'ifc-couche on'), el('div', 'ifc-couche'), el('span', 'ifc-apercu-note', 'Aperçu fixe'));
  const doc = el('div', 'ifc-fiche');
  doc.append(el('p', 'ifc-f-sur'), el('h3', 'ifc-f-nom'), el('div', 'ifc-f-tampons'), el('p', 'ifc-f-desc'), el('dl', 'ifc-faits'), el('p', 'ifc-f-lead'));
  actions.append(el('p', 'ifc-f-choix'));
  // un élément ajouté par un autre chantier n'est jamais retiré : dans la colonne de la fiche, avant JOUER
  const autres = [...sheet.children].filter((n) => n !== head && n !== $('ms-grid') && n !== actions);
  fiche.append(apercu, doc, ...autres, actions);
  sheet.replaceChildren(rail, liste, fiche);
  // survol (souris) et focus (clavier, Tab) : aperçu et fiche suivent, sans choisir la carte
  const grid = $('ms-grid');
  grid.addEventListener('pointerover', (e) => { const c = e.target.closest('.ms-card'); if (c) ifcSurvol(c.dataset.id, false); });
  grid.addEventListener('pointerleave', () => {
    const f = document.activeElement, c = f && grid.contains(f) && f.closest ? f.closest('.ms-card') : null;
    ifcSurvol(c ? c.dataset.id : null, !!c);
  });
  grid.addEventListener('focusin', (e) => { const c = e.target.closest('.ms-card'); if (c) ifcSurvol(c.dataset.id, true); });
  grid.addEventListener('focusout', (e) => { if (!grid.contains(e.relatedTarget) && !grid.matches(':hover')) ifcSurvol(null, true); });
  // Entrée sur une carte (focus clavier) la choisit puis la lance, comme le clic : passe avant l'écouteur du jeu
  grid.addEventListener('keydown', (e) => {
    const c = e.key === 'Enter' && e.target.closest ? e.target.closest('.ms-card') : null;
    if (c && c.dataset.id !== MapSel.sel) selectMapCard(c.dataset.id);
  }, true);
}
/* À chaque ouverture : les dossiers viennent d'être refaits par openMapSelect (MAPS.list, rien en dur). */
function ifcOuvrirSelection() {
  const grid = $('ms-grid');
  let n = 0;
  for (const c of grid.children) {
    const map = MAPS.byId[c.dataset.id];
    n++;
    if (!map || c.querySelector('.ifc-onglet')) continue;
    c.prepend(el('span', 'ifc-onglet', `Dossier ${String(n).padStart(2, '0')}`));
    if (ifcNouveau(map)) c.append(el('span', 'ifc-badge', 'Nouveau'));
  }
  $('mapsel').querySelector('.ifc-compte').textContent = n > 1 ? `${n} cartes disponibles` : '1 carte disponible';
  ifcRail($('mapsel'), 'btn-play');
  IFC.survol = null;
  clearTimeout(IFC.survolMinuteur);
  for (const c of grid.children) c.classList.remove('ifc-survol');
  ifcLireManifeste();
  ifcMontrer(MapSel.sel, true);
  // retour des Options ouvertes depuis le rail : le focus revient sur la carte choisie
  setTimeout(() => {
    if ($('mapsel').hidden || grid.contains(document.activeElement)) return;
    const c = grid.querySelector('[aria-selected="true"]');
    if (c) c.focus({ preventScroll: true });
  }, 60);
}
function ifcFermerSelection() {
  clearTimeout(IFC.survolMinuteur);
  IFC.survol = null;
  IFC.apercu = null;
  ifcArreterVideo();
  for (const c of $('mapsel').querySelectorAll('.ifc-couche')) c.replaceChildren();   // rien ne reste décodé
}
/* Carte survolée : l'aperçu change après un court délai (le passage rapide de la souris ne fait pas défiler
   les images) ; null : retour à la carte choisie. */
function ifcSurvol(id, tout) {
  if (id === IFC.survol) return;
  IFC.survol = id;
  for (const c of $('ms-grid').children) c.classList.toggle('ifc-survol', c.dataset.id === id);
  clearTimeout(IFC.survolMinuteur);
  if (id && !tout) ifcSon();
  IFC.survolMinuteur = setTimeout(() => ifcMontrer(id || MapSel.sel, false), tout ? 0 : 90);
}
/* Accroche de selectMapCard : la carte choisie change (clic, Entrée, flèches). */
function ifcChoix(id) {
  if (!IFC.pret || $('mapsel').hidden) return;
  if (!IFC.survol || IFC.survol === id) ifcMontrer(id, false);
  else ifcFicheChoix();
}
function ifcMontrer(id, instant) {
  const map = MAPS.byId[id];
  if (!map) return;
  if (IFC.apercu !== id) { ifcApercu(map, instant); IFC.apercu = id; }
  ifcFiche(map);
}
/* Aperçu : deux couches, la nouvelle image apparaît en fondu sur l'ancienne. Une carte qui a une vidéo
   déclarée la montre par-dessus son image dès qu'elle joue (sauf animations réduites ou fond allégé). */
function ifcApercu(map, instant) {
  const zone = $('mapsel').querySelector('.ifc-apercu'), couches = zone.querySelectorAll('.ifc-couche');
  const avant = couches[IFC.couche], apres = couches[1 - IFC.couche], a = ifcDeclare(map);
  // la vidéo qui jouait laisse sa dernière image dans la couche qui s'efface (pas de saut vers l'affiche)
  const x = IFC.video;
  if (x && x.v.classList.contains('on') && x.v.readyState >= 2 && x.v.videoWidth) {
    const c = el('canvas', 'ifc-video on');
    c.width = x.v.videoWidth; c.height = x.v.videoHeight;
    c.getContext('2d').drawImage(x.v, 0, 0);
    c.style.objectPosition = x.v.style.objectPosition;
    x.v.after(c);
  }
  ifcArreterVideo();
  apres.replaceChildren(ifcImage(map, a));
  zone.classList.toggle('ifc-instant', !!instant || IFC.calme);
  zone.classList.remove('ifc-video-on');
  apres.classList.add('on');
  avant.classList.remove('on');
  IFC.couche = 1 - IFC.couche;
  if (a && a.video && !IFC.calme && !IFC.fixe) ifcVideo(apres, map.id, a);
}

/* --- aperçus vidéo : manifeste apercus/index.json, livré à côté du jeu (launcher/gamelibs/apercus/) :
   { "version": 1, "cartes": { "<id>": { "video": "<fichier>.webm", "affiche": "<fichier>.jpg", "cadrage": "50% 40%" } } }
   Lu une fois, à la première ouverture de la sélection ; rien dans les Mod Tools ni hors d'un serveur. */
function ifcLireManifeste() {
  if (IFC.demande) return;
  IFC.demande = true;
  if (window.zsModtools || location.protocol === 'file:') { IFC.manifeste = {}; return; }
  fetchJson('apercus/index.json', 4000)
    .then((m) => { IFC.manifeste = ifcValiderManifeste(m); })
    .catch((e) => { IFC.manifeste = {}; console.warn(`Aperçus des cartes indisponibles : ${e.message}`); })
    .then(() => {
      // la sélection est déjà ouverte : l'aperçu montré prend sa vidéo ou son affiche
      const id = IFC.apercu;
      if ($('mapsel').hidden || !id || !ifcDeclare(MAPS.byId[id])) return;
      IFC.apercu = null;
      ifcMontrer(id, true);
    });
}
function ifcValiderManifeste(m) {
  const out = {}, nom = (f, ext) => typeof f === 'string' && new RegExp(`^[a-z0-9_-]{1,60}\\.(${ext})$`).test(f) ? f : null;
  const cartes = m && typeof m.cartes === 'object' && m.cartes ? m.cartes : {};
  for (const [id, a] of Object.entries(cartes)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(id) || !a || typeof a !== 'object') continue;
    const e = { video: nom(a.video, 'webm|mp4'), affiche: nom(a.affiche, 'jpg|jpeg|webp|png'),
      cadrage: typeof a.cadrage === 'string' && /^\d{1,3}% \d{1,3}%$/.test(a.cadrage) ? a.cadrage : '' };
    if (e.video || e.affiche) out[id] = e;
  }
  return out;
}
const ifcDeclare = (map) => (map && IFC.manifeste && IFC.manifeste[map.id]) || null;
/* Une seule vidéo à la fois, lue depuis un Blob (le protocole du jeu dans le launcher ne sert pas les requêtes
   partielles) ; elle apparaît en fondu quand elle joue ; illisible : l'image reste. */
async function ifcVideo(couche, id, a) {
  ifcArreterVideo();
  const jeton = IFC.jeton;
  let url;
  try {
    const res = await fetch(`apercus/${a.video}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (jeton !== IFC.jeton || IFC.apercu !== id || $('mapsel').hidden) return;   // l'aperçu a changé entre-temps
    url = URL.createObjectURL(blob);
  } catch (e) { console.warn(`Aperçu vidéo de ${id} illisible : ${e.message}`); return; }
  const v = el('video', 'ifc-video'), zone = couche.parentElement;
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('aria-hidden', 'true');
  if (a.cadrage) v.style.objectPosition = a.cadrage;
  IFC.video = { v, url };
  v.addEventListener('playing', () => { v.classList.add('on'); zone.classList.add('ifc-video-on'); }, { once: true });
  v.addEventListener('error', () => { if (IFC.video && IFC.video.v === v) ifcArreterVideo(); }, { once: true });
  v.src = url;
  couche.append(v);
  v.play().catch(() => { if (IFC.video && IFC.video.v === v) ifcArreterVideo(); });
}
function ifcArreterVideo() {
  IFC.jeton++;
  const x = IFC.video;
  IFC.video = null;
  const zone = $('mapsel').querySelector('.ifc-apercu');
  if (zone) zone.classList.remove('ifc-video-on');
  if (!x) return;
  x.v.pause();
  x.v.removeAttribute('src');
  x.v.load();                       // le décodeur est libéré
  x.v.remove();
  URL.revokeObjectURL(x.url);
}
function ifcFiche(map) {
  const doc = $('mapsel').querySelector('.ifc-fiche');
  doc.querySelector('.ifc-f-sur').textContent = map.eyebrow || `Rapport d’incident · ${map.name}`;
  doc.querySelector('.ifc-f-nom').textContent = map.name;
  const tampons = [];
  if (map.dev) tampons.push(el('span', 'ifc-tampon', 'En développement'));
  if (ifcNouveau(map)) tampons.push(el('span', 'ifc-tampon vert', 'Nouveau'));
  doc.querySelector('.ifc-f-tampons').replaceChildren(...tampons);
  doc.querySelector('.ifc-f-desc').textContent = map.description || '';
  ifcFaits(doc.querySelector('.ifc-faits'), map, true);
  doc.querySelector('.ifc-f-lead').textContent = map.lead || '';
  doc.classList.toggle('ifc-survol', map.id !== MapSel.sel);
  ifcFicheChoix();
}
/* Sous la fiche : la carte que lancera JOUER (le survol ne la change pas). */
function ifcFicheChoix() {
  const p = $('mapsel').querySelector('.ifc-f-choix'), choisie = MAPS.byId[MapSel.sel];
  if (!choisie) { p.textContent = ''; return; }
  const montree = IFC.survol && IFC.survol !== MapSel.sel;
  p.replaceChildren(montree ? 'Clic pour choisir cette carte · carte choisie : ' : 'Carte choisie : ', el('b', '', choisie.name));
  $('mapsel').querySelector('.ifc-fiche').classList.toggle('ifc-survol', !!montree);
}

/* --- options : trois réglages ajoutés avant le bouton Retour */
function ifcMonterOptions() {
  const caseOpt = (id, texte, val, fn) => {
    const lab = el('label', 'check'), inp = el('input');
    lab.htmlFor = id; inp.type = 'checkbox'; inp.id = id; inp.checked = val;
    inp.addEventListener('change', () => { fn(inp.checked); ifcEcrireReglages(); });
    lab.append(inp, ` ${texte}`);
    return lab;
  };
  const fond = el('label', 'opt'), sel = el('select');
  fond.htmlFor = 'opt-fond'; sel.id = 'opt-fond';
  for (const [v, t] of [['illustration', 'Illustration'], ['scene', 'Scène de la carte (3D animée)'], ['fixe', 'Scène de la carte figée (allégé)']]) { const o = el('option', '', t); o.value = v; sel.append(o); }
  sel.value = IFC.fond;
  sel.addEventListener('change', () => { IFC.fond = sel.value; IFC.fixe = IFC.fond === 'fixe'; ifcEcrireReglages(); });
  fond.append('Fond du menu', sel);
  $('btn-options-back').before(el('p', 'ifc-opt-titre', 'Menus'),
    caseOpt('opt-calme', 'Réduire les animations', IFC.calme, (v) => { IFC.calmeChoisi = v; }),
    caseOpt('opt-sons-menu', 'Sons des menus', IFC.sons, (v) => { IFC.sons = v; }),
    fond);
}

/* --- clavier : flèches dans les menus verticaux, Échap dans les options (retour à l'écran d'avant) */
function ifcClavier(e) {
  if (!IFC.pret || window.zsModtools || e.defaultPrevented) return;
  if (e.code === 'Escape' && !$('options').hidden) { e.preventDefault(); $('btn-options-back').click(); return; }
  if (e.code === 'Escape' && !$('secrets').hidden && G.state === 'menu') { e.preventDefault(); showScreen('menu'); return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  let nav = null;
  const ecran = document.querySelector('.screen.ifc:not([hidden])');
  if (!ecran) return;
  if (ecran.id === 'menu') nav = ecran.querySelector('.actions');
  else if (ecran.classList.contains('ifc-panneau')) nav = ecran.querySelector('.panel');
  else {
    nav = ecran.querySelector('.ifc-liens');
    if (!nav || !nav.contains(document.activeElement)) return;       // la liste des cartes, les onglets ont leurs flèches
  }
  if (!nav) return;
  const bs = [...nav.querySelectorAll('button.ifc-item, .actions button')].filter((b) => !b.hidden && b.offsetParent !== null);
  if (!bs.length) return;
  e.preventDefault();
  const i = bs.indexOf(document.activeElement);
  const j = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length;
  bs[j].focus({ preventScroll: true });
  ifcActif(bs[j], false);
  ifcSon();
}

/* --- accroche d'onGlobalKey : Échap dans l'écran de pause reprend la partie (demande d'Anthony du 3 novembre 2026).
   Un Échap arrivé moins de 400 ms après l'ouverture de la pause est ignoré : c'est la touche qui a libéré la souris
   verrouillée (et mis la pause). Dans les Options ouvertes depuis la pause, Échap ramène à la pause (ifcClavier). */
function ifcEchapReprend(e) {
  return e.code === 'Escape' && IFC.pret && !$('pause').hidden && performance.now() - IFC.pauseT > 400;
}
/* Le navigateur ne rend pas la souris verrouillée sur une touche (Échap ne compte pas comme un geste) : après une
   reprise par Échap, la partie repart en « souris libre », et le premier clic sert seulement à reprendre la souris,
   comme le bouton Reprendre, sans tirer (ifcMonter : écouteur mousedown en capture). */
function ifcReprendre(e) {
  resumeGame();
  IFC.repriseEchap = e.code === 'Escape' && G.state === 'playing' && !Input.locked;
}

/* --- sons des menus : le contexte audio du jeu naît au premier geste (règle des navigateurs), puis un
   petit clic discret au survol, sur le bus des effets (volume général du joueur). Éteints : ni survol, ni
   clic de validation hors partie (Sound.ui, voir ifcMonter). */
function ifcEveil() {
  if (!IFC.sons || G.state !== 'menu') return;
  Sound.init();
  for (const t of ['pointerdown', 'keydown']) window.removeEventListener(t, ifcEveil, true);
}
function ifcSon() {
  if (!IFC.sons || window.zsModtools || G.state !== 'menu') return;
  const b = Sound.bus();
  if (!b || b.ctx.state !== 'running') return;
  const { ctx, sortie } = b, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(1750, t);
  o.frequency.exponentialRampToValueAtTime(1320, t + 0.035);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.028, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g); g.connect(sortie);
  o.start(t); o.stop(t + 0.06);
}

/* --- accroche de showScreen : contenu de l'écran qui s'ouvre */
function ifcEcran(id) {
  if (!IFC.pret) return;
  const avant = IFC.ecran;
  IFC.ecran = id;
  $('secrets').hidden = id !== 'secrets';                 // écran ajouté : absent de la liste de showScreen
  if (id === 'pause') IFC.pauseT = performance.now();
  ifcRafraichir();
  if (id === 'menu') ifcRapport();
  if (id === 'mapsel') ifcOuvrirSelection();             // dossiers refaits par openMapSelect juste avant
  else if (avant === 'mapsel') ifcFermerSelection();
  if (IFC_RAILS[id] && id !== 'mapsel') ifcRail($(id), IFC_RAILS[id]);
  ifcFond();
  ifcAmbiance();
}

/* --- fond illustré : un calque fixe sous les écrans du menu (au-dessus de la toile 3D), montré hors partie ;
   chargé d'avance, il ne remplace la scène qu'une fois l'image arrivée (absente : la scène reste). */
const ifcIllustration = () => IFC.fond === 'illustration' && IFC.fondPret;
function ifcFondMonter() {
  const f = el('div', 'ifc-fond');
  f.id = 'ifc-fond';
  f.hidden = true;
  f.setAttribute('aria-hidden', 'true');
  document.body.append(f);
  if (window.zsModtools) return;
  const img = new Image();
  img.onload = () => {
    f.style.backgroundImage = `url("${IFC_FOND.image}")`;
    f.style.backgroundPosition = IFC_FOND.position;
    IFC.fondPret = true;
    ifcAppliquer();
  };
  img.onerror = () => console.warn('Illustration du menu introuvable : la scène de la carte reste en fond.');
  img.src = IFC_FOND.image;
}
function ifcFond() {
  const f = $('ifc-fond');
  if (!f) return;
  const montre = IFC.pret && ifcIllustration() && G.state === 'menu' && !window.zsModtools && IFC_ECRANS_MENU.includes(IFC.ecran);
  f.hidden = !montre;
  document.body.classList.toggle('ifc-illu', montre);
}
/* --- accroche de render : au menu, sous un écran opaque (sélection, statistiques…) ou avec le fond en
   image fixe, la scène n'est plus redessinée ; la dernière image reste à l'écran. Après chaque changement
   (écran, carte, taille de la toile : fenêtre ou qualité graphique), la scène est redessinée encore un moment :
   deux images au moins, et le temps que les modèles et les textures en image arrivent. Image fixe d'un monde
   ouvert : le terrain fin autour de la vue est construit d'un coup avant (sous un écran opaque, le voile cache
   la scène : pas d'à-coup au clic). renderEnabled reste celui des Mod Tools. */
function ifcRafraichir() { IFC.images = 0; IFC.depuis = performance.now(); }
function ifcFige() {
  if (!IFC.pret || G.state !== 'menu' || window.zsModtools) return false;
  const toile = `${renderer.domElement.width}x${renderer.domElement.height}`;
  if (IFC.carteVue !== G.mapId || IFC.toile !== toile) { IFC.carteVue = G.mapId; IFC.toile = toile; ifcRafraichir(); }
  const opaque = (IFC.ecran && IFC.ecran !== 'menu') || ifcIllustration();   // l'illustration couvre la scène
  if (!opaque && !IFC.fixe) return false;
  if (IFC.images === 0 && OW.on && IFC.fixe) { owUpdateTerrainLod(true); owUpdateRoads(); }
  IFC.images++;
  return IFC.images > 2 && performance.now() - IFC.depuis > (opaque ? 600 : 2000);
}
/* --- accroche de menuCamera : balancement arrêté quand les animations sont réduites (même temps sinon) */
function ifcBalance(t) {
  if (!IFC.calme) { IFC.gelT = null; return t; }
  if (IFC.gelT === null || t < IFC.gelT) IFC.gelT = t;
  return IFC.gelT;
}
