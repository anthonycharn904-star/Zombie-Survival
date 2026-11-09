/* ------------------------------------------------------ Interface : secrets --
   Écran « Secret » (demande d'Anthony du 9 novembre 2026, pour le jeu 2.0.7) : un onglet par carte du jeu ; pour la
   carte choisie, ses easter eggs principaux et ses easter eggs secondaires, séparés. Ceux que le joueur a découverts
   montrent leur titre, leur descriptif et la date de la découverte ; les autres, « ???? ».
   · Le catalogue (SECRETS) dit, par identifiant de carte, les easter eggs qui existent ; une carte sans easter egg
     l'affiche. Pour une nouvelle carte ou un nouvel easter egg : ajouter son entrée ici.
   · La découverte est enregistrée par l'easter egg lui-même, au moment où il est réussi :
       if (typeof secretDecouvert === 'function') secretDecouvert('b7-horloge');
     Elle est gardée dans le navigateur du joueur (zs.secrets : identifiant → date), comme les records. Ni en partie de
     test des Mods Tools, ni avec le digi pass (comme l'expérience du rang). */
const SECRETS = {
  bunker7: [
    { id: 'b7-quete', type: 'principal', titre: 'Le Dernier Pacte',
      texte: 'Le courant rétabli et toutes les portes ouvertes, une arme reforgée par Le Glas (palier II ou III) tire sur le disjoncteur de la Salle des machines. Il s’électrifie, puis le bunker plonge dans le noir : les salles se verrouillent une à une, des Machines à l’Infirmerie. Quand la lumière revient, la foudre frappe le toit, et le Septième absorbe les âmes des morts avant l’affrontement.' },
    { id: 'b7-horloge', type: 'secondaire', titre: 'L’horloge de la gare',
      texte: 'Dehors, l’horloge de la gare abandonnée, visible des fenêtres du sud une fois leurs planches arrachées, s’est arrêtée sur trois heures. Chaque tir sur son cadran avance la grande aiguille d’une heure. À midi, elle laisse un atout gratuit et les munitions max. Une fois par partie.' },
  ],
  // Les Marécages Maudits (carte « marais », jeu 2.0.7, session Marécages) : aucun easter egg pour l'instant (le kit
  // n'a ni quête ni secret : « ils viendront des Mod Tools ») ; l'onglet apparaît dès que la carte est dans le jeu.
  marais: [],
};
const SC = { carte: null };
const SC_TYPES = [['principal', 'Easter egg'], ['secondaire', 'Easter eggs secondaires']];

/* --- découverte (appelée par les easter eggs) : vrai si elle est nouvelle */
function secretDecouvert(id) {
  if (!Object.values(SECRETS).some((l) => l.some((s) => s.id === id))) { console.warn(`Secret inconnu : ${id}`); return false; }
  if (G.editorSession || G.cheat) return false;
  const vus = store.get('zs.secrets', {}) || {};
  if (vus[id]) return false;
  vus[id] = Date.now();
  store.set('zs.secrets', vus);
  return true;
}
function secretsEtat() { return store.get('zs.secrets', {}) || {}; }
function scNombre(id) { return (SECRETS[id] || []).length; }

/* --- écran : section et bouton créés au démarrage (avant la mise en page du menu, qui les range) */
function ifcSecretsMonter() {
  const b = el('button', 'btn', 'Secret');
  b.id = 'btn-secrets'; b.type = 'button';
  $('btn-ranking').after(b);
  b.addEventListener('click', () => { Sound.ui(); ifcSecretsOuvrir(); });
  const s = el('section', 'screen sheet-screen');
  s.id = 'secrets'; s.hidden = true;
  s.setAttribute('aria-labelledby', 'secrets-title');
  const sheet = el('div', 'sheet'), head = el('header', 'sheet-head');
  const titre = el('h2', 'sheet-title', 'Secret');
  titre.id = 'secrets-title';
  head.append(el('p', 'eyebrow', 'Rapport d’incident · dossiers classés'), titre);
  const tabs = el('div', 'md-tabs');
  tabs.id = 'sc-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Cartes');
  const rep = el('article', 'report sc-report');
  rep.id = 'sc-report'; rep.setAttribute('role', 'tabpanel');
  const actions = el('div', 'sheet-actions'), retour = el('button', 'btn primary', 'Retour');
  retour.id = 'btn-secrets-back'; retour.type = 'button';
  retour.addEventListener('click', () => { Sound.ui(); showScreen('menu'); });
  actions.append(retour);
  sheet.append(head, tabs, rep, actions);
  s.append(sheet);
  $('loading').before(s);
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = MAPS.list.indexOf(SC.carte), j = clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, MAPS.list.length - 1);
    if (MAPS.list[j] !== SC.carte) { Sound.ui(); ifcSecretsCarte(MAPS.list[j]); }
    const t = tabs.querySelector('[aria-selected="true"]');
    if (t) t.focus();
  });
}
function ifcSecretsOuvrir() {
  // carte : celle déjà choisie, sinon la carte chargée si elle a des secrets, sinon la première qui en a
  if (!MAPS.list.includes(SC.carte)) SC.carte = scNombre(G.mapId) ? G.mapId : MAPS.list.find(scNombre) || MAPS.list[0];
  const tabs = $('sc-tabs'), vus = secretsEtat();
  tabs.replaceChildren(...MAPS.list.map((id) => {
    const liste = SECRETS[id] || [], t = el('button', 'md-tab');
    t.type = 'button'; t.dataset.id = id; t.setAttribute('role', 'tab');
    t.append(el('b', '', MAPS.byId[id].name), liste.length ? `${liste.filter((x) => vus[x.id]).length} / ${liste.length}` : '—');
    t.addEventListener('click', () => { if (SC.carte !== id) { Sound.ui(); ifcSecretsCarte(id); } });
    return t;
  }));
  ifcSecretsCarte(SC.carte);
  showScreen('secrets');
}
function ifcSecretsCarte(id) {
  SC.carte = id;
  for (const t of $('sc-tabs').children) t.setAttribute('aria-selected', t.dataset.id === id ? 'true' : 'false');
  const rep = $('sc-report'), liste = SECRETS[id] || [], vus = secretsEtat();
  const contenu = [el('span', 'stamp', 'Classifié'), el('h3', 'sc-carte', MAPS.byId[id].name)];
  if (!liste.length) contenu.push(el('p', 'sc-vide', 'Aucun easter egg connu sur cette carte pour le moment.'));
  for (const [type, nom] of SC_TYPES) {
    const parType = liste.filter((s) => s.type === type);
    if (!parType.length) continue;
    const sec = el('section', `sc-section sc-${type}`);
    sec.append(el('h4', 'sc-titre', `${nom} · ${parType.filter((s) => vus[s.id]).length} / ${parType.length}`));
    for (const s of parType) {
      const d = vus[s.id], f = el('div', `sc-fiche ${d ? 'decouvert' : 'cache'}`);
      f.dataset.id = s.id;
      f.append(el('span', 'sc-tampon', d ? 'Découvert' : 'Non découvert'), el('b', 'sc-nom', d ? s.titre : '????'), el('p', 'sc-texte', d ? s.texte : '????'));
      if (d) f.append(el('p', 'sc-date', `Découvert le ${new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`));
      sec.append(f);
    }
    contenu.push(sec);
  }
  rep.replaceChildren(...contenu);
  rep.setAttribute('aria-label', `Secrets : ${MAPS.byId[id].name}`);
}
