/* ------------------------------------------------- Interface : autres écrans --
   Phase D de la refonte de l'interface : les mêmes codes visuels pour les autres écrans, sans changer leur
   logique. Statistiques, Modèles, Ranking et Amélioration d'arme prennent le rail de navigation de la sélection
   (logo, entrées du menu principal, Retour) à côté de leur fiche ; la pause et la fin de partie prennent les
   boutons du menu (surlignage rouge, flèches) ; les Options sont habillées en dossier. Les éléments du jeu 1.9.0
   gardent leurs identifiants et leurs écouteurs (le bouton Retour de chaque écran est déplacé dans son rail). */
/* Écrans à rail, et l'entrée du menu principal qui y mène (elle reste en évidence). */
const IFC_RAILS = { mapsel: 'btn-play', stats: 'btn-stats', models: 'btn-models', ranking: 'btn-ranking', mods: 'btn-mods', secrets: 'btn-secrets' };

/* Rail : petit logo, navigation (remplie à chaque ouverture par ifcRail), bouton Retour de l'écran. */
function ifcRailMonter(retour) {
  const rail = el('aside', 'ifc-rail');
  const logo = el('p', 'ifc-logo-mini', 'Zombie');
  logo.setAttribute('aria-hidden', 'true');
  logo.append(el('span', '', 'Survival'));
  const liens = el('nav', 'ifc-liens');
  liens.setAttribute('aria-label', 'Menu principal');
  retour.classList.add('ifc-item', 'ifc-retour');
  retour.prepend(el('i', '', '←'));
  rail.append(logo, liens, retour);
  liens.addEventListener('pointerover', (e) => { const b = e.target.closest('.ifc-item'); if (b) ifcActif(b, true); });
  liens.addEventListener('focusin', (e) => { const b = e.target.closest('.ifc-item'); if (b) ifcActif(b, false); });
  // la souris ou le clavier quitte le rail : le surlignage revient sur l'écran en cours
  const rendre = () => { const c = liens.querySelector('[aria-current]'); if (c) ifcActif(c, false); };
  liens.addEventListener('pointerleave', () => { if (!liens.contains(document.activeElement)) rendre(); });
  liens.addEventListener('focusout', (e) => { if (!liens.contains(e.relatedTarget) && !liens.matches(':hover')) rendre(); });
  return { rail, liens };
}
/* Navigation d'un écran : les entrées visibles du menu principal, qui en déclenchent les boutons ; celle de
   l'écran en cours ramène le focus dans sa fiche ; Options revient ensuite à cet écran. */
function ifcRail(ecran, courant) {
  const liens = ecran.querySelector('.ifc-liens');
  if (!liens) return;
  liens.replaceChildren();
  for (const b of $('menu').querySelectorAll('.actions .btn')) {
    if (b.hidden || b.id === 'btn-controls' || b.id === 'btn-resume-save') continue;
    const l = el('button', 'btn ifc-item', b.textContent);
    l.type = 'button';
    if (b.id === courant) {
      l.classList.add('ifc-actif');
      l.setAttribute('aria-current', 'page');
      l.addEventListener('click', () => { const c = ifcFocusFiche(ecran); if (c) c.focus(); });
    } else l.addEventListener('click', () => { b.click(); if (b.id === 'btn-options') optionsReturn = ecran.id; });
    liens.append(l);
  }
  // showScreen donne le focus au premier bouton de l'écran (le premier lien du rail) : il passe sur l'écran en cours,
  // qui garde ainsi le surlignage ; rail réduit à une ligne (liens cachés) : sur la fiche, ou sur Retour
  setTimeout(() => {
    if (ecran.hidden) return;
    const c = liens.querySelector('[aria-current]'), f = document.activeElement;
    if (c && c.getClientRects().length) { if (f !== c && liens.contains(f)) c.focus({ preventScroll: true }); return; }
    if (ecran.contains(f) && f.getClientRects().length) return;
    const r = ifcFocusFiche(ecran) || ecran.querySelector('.ifc-retour');
    if (r) r.focus({ preventScroll: true });
  }, 45);
}
/* Élément de la fiche qui reçoit le focus : la carte choisie, l'onglet choisi, ou le premier bouton. */
function ifcFocusFiche(ecran) {
  if (ecran.id === 'mapsel') return $('ms-grid').querySelector('[aria-selected="true"]');
  return ecran.querySelector('.sheet [role="tab"][aria-selected="true"]')
    || ecran.querySelector('.sheet button:not([hidden]):not(:disabled), .sheet [tabindex="0"]');
}

function ifcMonterEcrans() {
  // fiches : rail à gauche, fiche à droite (même fond que la sélection)
  for (const id of ['stats', 'models', 'ranking', 'mods', 'secrets']) {
    const ecran = $(id), sheet = ecran.querySelector('.sheet'), actions = sheet.querySelector('.sheet-actions');
    ecran.classList.add('ifc', 'ifc-fiches');
    const coquille = el('div', 'ifc-coquille');
    const { rail } = ifcRailMonter($(`btn-${id}-back`));
    actions.hidden = !actions.querySelector('button');
    sheet.before(coquille);
    coquille.append(rail, sheet);
  }
  // pause et fin de partie : boutons du menu, surlignage qui suit la souris et le clavier
  // (confirm : l'écran des confirmations de « Sauvegarder et quitter », jeu 2.0.7 ; absent avant la fusion)
  for (const id of ['pause', 'gameover', 'confirm']) {
    const ecran = $(id), panel = ecran && ecran.querySelector('.panel');
    if (!panel) continue;
    ecran.classList.add('ifc', 'ifc-panneau');
    for (const b of panel.querySelectorAll('.btn')) b.classList.add('ifc-item');
    panel.addEventListener('pointerover', (e) => { const b = e.target.closest('.ifc-item'); if (b) ifcActif(b, true); });
    panel.addEventListener('focusin', (e) => { const b = e.target.closest('.ifc-item'); if (b) ifcActif(b, false); });
  }
  // options : un dossier, ses réglages en deux groupes (jeu, menus)
  const options = $('options');
  options.classList.add('ifc', 'ifc-options');
  options.querySelector('.panel').prepend(el('p', 'ifc-r-sur', 'Réglages du survivant'));
}
