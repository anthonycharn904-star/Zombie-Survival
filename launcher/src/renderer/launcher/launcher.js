'use strict';
/* Interface du launcher (direction D de la maquette, validée le 31 octobre 2026) : affiche l'état envoyé par le
   processus principal (window.zs, voir preload/launcher.js) et déclenche les actions. Les règles des états sont
   celles du launcher 1.3.3 (bouton principal, ligne d'état, liens, bandeau du launcher, réglages) ; la maquette
   apporte la barre latérale, les pages, le fond animé de Bunker 7 et le gestionnaire de téléchargement. */
const $ = (id) => document.getElementById(id);
const NB = '\u00a0';
const fenetre = $('fenetre');

/* ---------------------------------------------------------- formats --- */
const num1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateCourteFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dateSeuleFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const heureFmt = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
const jourFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' });
function fmtSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${bytes > 0 ? Math.max(1, Math.round(bytes / 1024)) : 0}${NB}Ko`;
  return `${num1.format(bytes / 1048576)}${NB}Mo`;
}
function fmtDate(value, fmt = dateFmt) {
  const t = Date.parse(value || '');
  if (!Number.isFinite(t)) return value || '';
  // date seule (AAAA-MM-JJ, actualités) : lue comme minuit UTC, affichée en UTC pour garder le jour écrit
  if (fmt === dateFmt && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateSeuleFmt.format(t);
  return fmt.format(t);
}
function fmtEta(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  if (sec < 60) return `environ ${Math.max(1, Math.round(sec))}${NB}s`;
  return `environ ${Math.round(sec / 60)}${NB}min`;
}
/* « vérifié à l'instant », « il y a 5 min », « à 17:42 » le même jour, « le 1 nov. » un autre jour (Bruxelles, comme l'horloge) */
function depuis(t) {
  if (!Number.isFinite(t)) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'à l’instant';
  if (s < 3570) return `il y a ${Math.round(s / 60)}${NB}min`;
  const jour = jourFmt.format(t);
  return jour === jourFmt.format(Date.now()) ? `à ${heureFmt.format(t)}` : `le ${jour}`;
}
function parseV(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ''));
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function newer(a, b) {
  const x = parseV(a), y = parseV(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
/* Une note par ligne : le tiret ou la puce tapés en tête de ligne font double emploi avec la puce de la liste. */
function cleanNote(n) { return String(n).replace(/^\s*[-–—•*]+\s*/, ''); }
const plural = (n, word) => `${n}${NB}${word}${n > 1 ? 's' : ''}`;
function describeSource(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/latest\/download\/latest\.json$/i.exec(url || '');
  if (m) return { main: `github.com/${m[1]}/${m[2]}`, sub: 'Dernière release publiée sur GitHub' };
  if (/^file:/i.test(url || '')) {
    let p = url;
    try { p = decodeURIComponent(new URL(url).pathname).replace(/^\/([A-Za-z]:)/, '$1'); } catch (e) { /* adresse brute */ }
    return { main: p, sub: 'Dossier local (test)' };
  }
  return { main: url || '—', sub: '' };
}
/* Élément construit (jamais d'innerHTML : textes reçus du manifeste, politique de sécurité sans style en ligne). */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ------------------------------------------------- vitesse / ETA --- */
const rate = { target: null, t: 0, bytes: 0, bps: 0, courbe: [] };
function trackRate(p) {
  const now = performance.now();
  const key = `${p.phase}:${p.target}`;
  if (rate.target !== key || p.received < rate.bytes) {
    Object.assign(rate, { target: key, t: now, bytes: p.received, bps: 0, courbe: [] });
    return;
  }
  const dt = (now - rate.t) / 1000;
  if (dt < 0.25) return;
  const inst = (p.received - rate.bytes) / dt;
  rate.bps = rate.bps ? rate.bps * 0.7 + inst * 0.3 : inst;
  rate.t = now;
  rate.bytes = p.received;
  rate.courbe.push(inst);
  if (rate.courbe.length > 40) rate.courbe.shift();
}

/* ------------------------------------------------------- navigation --- */
const NOMS = { accueil: 'Accueil', actus: 'Actualités', maj: 'Mises à jour', installation: 'Installation', modtools: 'Mod Tools', reglages: 'Paramètres' };
let section = 'accueil';
function aller(s) {
  if (!NOMS[s]) return;
  section = s;
  for (const b of document.querySelectorAll('.d-nav button')) {
    if (b.dataset.section === s) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  for (const p of document.querySelectorAll('.d-page')) p.hidden = p.dataset.page !== s;
  $('d-fil').textContent = NOMS[s];
  fermerLecture();
  $('d-contenu').scrollTop = 0;
  if (s === 'accueil') requestAnimationFrame(placer);
  majVeille();
  majFond();
}

/* ------------------------------------------------------------- état --- */
let current = null;
let mainAction = null;
let linkActions = [null, null];
let pending = false;
const OCCUPE = ['checking', 'downloading', 'installing', 'restarting', 'playing', 'starting'];

const hasUpdateOf = (s) => !!(s.installed && s.remote && !s.remote.cached && newer(s.remote.version, s.installed.version));
/* notes publiées de la version installée (historique) : elles passent avant la note « Version livrée avec le
   launcher » d'un jeu installé depuis l'installateur */
function notesInstallees(s) {
  const inst = s.installed;
  if (!inst) return [];
  const published = (s.history || []).find((e) => e.version === inst.version && e.notes.length);
  return published ? published.notes : (inst.notes || []);
}

/* Bouton principal, ligne d'état et liens selon la phase : les règles du launcher 1.3.3. */
function etatDe(s) {
  const inst = s.installed, rem = s.remote, err = s.error;
  const v = inst ? inst.version : '—';
  const r = { ton: 'neutre', titre: '', detail: '', liens: [], principal: { libelle: 'Jouer', sous: '', type: 'jouer', actif: false, action: null, pct: 0 } };
  const jouer = () => window.zs.play();
  const P = r.principal;
  const pret = () => { P.actif = true; P.action = jouer; P.sous = `Déploiement · jeu ${v}`; };
  switch (s.phase) {
    case 'starting':
      r.titre = 'Ouverture du jeu…';
      P.sous = 'Ouverture du jeu…';
      break;
    case 'checking':
      r.ton = 'occupe'; r.titre = 'Vérification';
      r.detail = 'Recherche de mises à jour…';
      if (inst) pret(); else P.sous = 'Recherche de mises à jour…';
      break;
    case 'ready':
      r.ton = 'ok'; r.titre = 'Prêt';
      r.detail = inst ? `Version ${inst.version} installée · à jour` : '';
      pret();
      break;
    case 'update':
      r.ton = 'maj'; r.titre = 'Mise à jour disponible';
      r.detail = rem ? `Version ${v} → ${rem.version}${rem.size ? ` · ${fmtSize(rem.size)}` : ''}` : '';
      Object.assign(P, { libelle: 'Mettre à jour', type: 'maj', actif: true, action: () => window.zs.install(), sous: rem ? `Vers la ${rem.version}` : '' });
      if (inst) r.liens.push([`Jouer à la ${inst.version}`, jouer]);
      break;
    case 'downloading': {
      const p = s.progress || { received: 0, total: 0 };
      const launcher = p.phase === 'launcher';
      r.ton = 'occupe'; r.titre = launcher ? 'Téléchargement du launcher' : 'Téléchargement';
      trackRate(p);
      const pct = p.total ? (p.received / p.total) * 100 : 0;
      const parts = [`${fmtSize(p.received)} sur ${fmtSize(p.total)}`];
      if (rate.bps > 0) parts.push(`${fmtSize(rate.bps)}/s`, fmtEta((p.total - p.received) / rate.bps));
      r.detail = parts.filter(Boolean).join(' · ');
      Object.assign(P, { libelle: `${Math.floor(pct)}${NB}%`, type: 'progres', pct, sous: p.target ? (launcher ? `Launcher ${p.target}` : `Vers la ${p.target}`) : '' });
      r.liens.push(['Annuler', () => window.zs.cancel()]);
      break;
    }
    case 'installing':
      r.ton = 'occupe'; r.titre = 'Installation';
      r.detail = s.progress && s.progress.target ? `Version ${s.progress.target} : vérification et extraction…` : 'Remise en état du jeu…';
      Object.assign(P, { libelle: 'Installation', type: 'progres', pct: 100, sous: s.progress && s.progress.target ? `Version ${s.progress.target}` : 'Remise en état' });
      break;
    case 'restarting':
      r.ton = 'occupe'; r.titre = 'Redémarrage';
      r.detail = 'Installation du nouveau launcher…';
      Object.assign(P, { libelle: 'Redémarrage', type: 'progres', pct: 100, sous: 'Nouveau launcher' });
      break;
    case 'playing':
      r.ton = 'ok'; r.titre = 'Partie en cours';
      r.detail = inst ? `Version ${inst.version}` : '';
      Object.assign(P, { libelle: 'En jeu', type: 'partie', sous: 'Partie en cours' });
      break;
    case 'offline':
      if (err && err.code === 'NOT_CONFIGURED') {
        r.titre = 'Mises à jour inactives';
        r.detail = `Adresse de publication provisoire · version ${v} jouable`;
      } else {
        r.titre = 'Hors ligne';
        r.detail = `${err ? err.message : 'Serveur de mises à jour injoignable.'} Version ${v} jouable.`;
        r.liens.push(['Réessayer', () => window.zs.check()]);
      }
      if (inst) pret();
      break;
    case 'error':
    default: {
      r.ton = 'erreur'; r.titre = 'Erreur';
      r.detail = err ? err.message : 'Erreur inconnue.';
      if (inst) {
        pret();
        const ctx = err && err.context;
        if (ctx === 'install') r.liens.push(['Réessayer', () => window.zs.install()]);
        else if (ctx === 'launcher') r.liens.push(['Réessayer', () => window.zs.updateLauncher()]);
        else if (ctx === 'check') r.liens.push(['Réessayer', () => window.zs.check()]);
      } else {
        Object.assign(P, { libelle: 'Réparer', type: 'maj', actif: true, action: () => window.zs.repair(), sous: 'Remise en état du jeu' });
      }
      r.liens.push(['Ouvrir le journal', () => window.zs.open('logs')]);
    }
  }
  return r;
}

function render(s) {
  pending = false;
  dessiner(s);
}
function dessiner(s) {
  current = s;
  const inst = s.installed, rem = s.remote;
  const hasUpdate = hasUpdateOf(s);
  const busy = OCCUPE.includes(s.phase);
  const st = etatDe(s);

  // bouton principal
  const P = st.principal, b = $('btn-main');
  $('btn-main-label').textContent = P.libelle;
  $('d-jouer-sous').textContent = P.sous;
  b.dataset.type = P.type;
  b.disabled = !P.actif || pending;
  mainAction = P.actif ? P.action : null;
  $('d-jouer-rempli').style.width = P.type === 'progres' ? `${Math.max(0, Math.min(100, P.pct))}%` : '0';

  // ligne d'état et liens
  $('d-statut').dataset.ton = st.ton;
  $('status-title').textContent = st.titre;
  $('status-detail').textContent = st.detail;
  $('status-detail').title = st.detail;
  for (let i = 0; i < 2; i++) {
    const l = $(i === 0 ? 'link-a' : 'link-b'), x = st.liens[i];
    l.hidden = !x;
    l.textContent = x ? x[0] : '';
    linkActions[i] = x ? x[1] : null;
  }

  // accueil : la version et ses notes (la nouvelle quand une mise à jour attend)
  $('d-mission-v').textContent = !inst ? 'Jeu non installé' : hasUpdate ? `Jeu ${inst.version} → ${rem.version}` : `Jeu ${inst.version}`;
  const notes = (hasUpdate ? rem.notes || [] : notesInstallees(s)).map(cleanNote).filter((n) => n.trim());
  $('d-mission-t').textContent = notes[0] || '';
  $('d-mission-t').title = notes[0] || '';
  $('d-hero-desc').textContent = notes.slice(1).reduce((a, n) => (a ? a + (/[,;:]$/.test(a) ? ' ' : ' · ') + n : n), '');
  $('btn-modtools').hidden = !s.author;
  const modtoolsOff = !inst || ['downloading', 'installing', 'restarting'].includes(s.phase);
  $('btn-modtools').disabled = modtoolsOff;

  // barre latérale : état, plaques, entrées
  $('d-etat').dataset.ton = st.ton;
  $('d-etat-titre').textContent = st.titre;
  $('d-etat-detail').textContent = s.phase === 'downloading' ? st.principal.libelle + (rate.bps > 0 ? ` · ${fmtSize(rate.bps)}/s` : '')
    : inst ? (s.checkedAt ? `vérifié ${depuis(s.checkedAt)}` : `jeu ${inst.version}`) : 'jeu non installé';
  $('d-v-jeu').textContent = inst ? inst.version : '—';
  $('d-v-jeu-sous').textContent = hasUpdate ? `${rem.version} disponible` : inst ? 'installé' : 'non installé';
  $('d-v-launcher').textContent = s.launcherVersion || '—';
  $('d-point-maj').hidden = !hasUpdate;
  $('d-nav-modtools').hidden = !s.author;
  $('d-verrou').hidden = !!s.author;
  if (!s.author && section === 'modtools') aller('accueil');
  const notif = (hasUpdate ? 1 : 0) + (s.launcherUpdate ? 1 : 0);
  $('d-cloche-n').hidden = !notif;
  $('d-cloche-n').textContent = String(notif);
  $('d-cloche').title = notif ? `Notifications : ${plural(notif, 'nouvelle')}` : 'Notifications';
  $('d-cloche').setAttribute('aria-label', $('d-cloche').title);
  const navMaj = $('d-point-maj').parentElement;
  if (hasUpdate) navMaj.setAttribute('aria-label', `Mises à jour : version ${rem.version} disponible`);
  else navMaj.removeAttribute('aria-label');

  // bandeau du nouveau launcher
  const bandeau = !!s.launcherUpdate && !['downloading', 'installing', 'restarting', 'playing'].includes(s.phase);
  $('d-bandeau').hidden = !bandeau;
  if (bandeau) {
    $('d-bandeau-v').textContent = s.launcherUpdate.version;
    $('d-bandeau-btn').disabled = s.phase === 'checking';
    $('d-bandeau').title = (s.launcherUpdate.notes || []).join('\n');
  }

  // fenêtre (taille et boutons : processus principal)
  const fen = s.windowState, agrandie = !!(fen && fen.maximized);
  $('d-agrandir').hidden = !fen;
  $('d-agrandir').title = agrandie ? 'Restaurer' : 'Agrandir';
  $('d-agrandir').setAttribute('aria-label', $('d-agrandir').title);
  fenetre.classList.toggle('agrandie', agrandie);

  dessinerTelechargement(s, st);
  dessinerActus(s.news || []);
  dessinerMaj(s, hasUpdate, busy);
  dessinerInstallation(s, busy);
  dessinerReglages(s, busy);

  // boutons d'action des pages (mêmes règles que les réglages du launcher 1.3.3)
  for (const x of document.querySelectorAll('[data-act]')) {
    const a = x.dataset.act;
    if (a === 'check' || a === 'repair' || a === 'rollback' || a === 'sourceOfficielle') x.disabled = busy;
    else if (a === 'install') x.disabled = busy || !hasUpdate;
    else if (a === 'dossier') x.disabled = !inst;
    else if (a === 'modtools') x.disabled = modtoolsOff;
  }
  $('d-mod-moteur').textContent = inst ? `celui du jeu installé (${inst.version})` : 'aucun jeu installé';

  // écran d'ouverture et veille
  if (s.source && s.source.keyFingerprint) $('d-ouv-cle').textContent = s.source.keyFingerprint;
  if (s.phase !== 'starting') ouverture.pret = true;
  finOuverture();
  majVeille();
  majFond();
}
/* Pendant une partie, l'accueil se met en veille ; les autres pages (Paramètres, Installation, Mod Tools) restent
   utilisables, comme dans le launcher 1.3.3 quand « Garder le launcher ouvert » est coché. */
function majVeille() { $('d-veille').hidden = !(current && current.phase === 'playing' && section === 'accueil'); }

/* -------------------------------------- gestionnaire de téléchargement --- */
function dessinerTelechargement(s, st) {
  const dl = ['downloading', 'installing', 'restarting'].includes(s.phase);
  $('d-dl').hidden = !dl;
  if (!dl) return;
  const p = s.progress || {}, att = s.phase !== 'downloading';
  const lu = s.launcherUpdate;
  $('d-dl-titre').textContent = s.phase === 'restarting' || p.phase === 'launcher' ? `Launcher ${p.target || (lu && lu.version) || ''}`.trim()
    : p.target ? `Zombie Survival ${p.target}` : s.phase === 'installing' ? 'Réparation de Zombie Survival' : 'Zombie Survival';
  $('d-dl-detail').textContent = st.detail;
  const bande = $('d-bande'), n = bande.children.length;
  const pct = !att && p.total ? p.received / p.total : 0;
  const on = att ? 0 : Math.round(pct * n);
  bande.classList.toggle('attente', att);
  [...bande.children].forEach((c, k) => c.classList.toggle('on', k < on));
  $('d-dl-pct').textContent = att ? '' : `${Math.floor(pct * 100)}${NB}%`;
  $('d-dl-annuler').hidden = att;
  // courbe du débit : les 40 dernières mesures, étalées sur toute la largeur dès la deuxième
  const c = att ? [] : rate.courbe, max = Math.max(1, ...c);
  $('d-dl-poly').setAttribute('points', c.map((x, i) => `${((i / Math.max(1, c.length - 1)) * 120).toFixed(1)},${(30 - (x / max) * 26).toFixed(1)}`).join(' '));
  $('d-dl-courbe').classList.toggle('vide', c.length < 2);
}

/* ---------------------------------------------------------- actualités --- */
/* Pas d'image publiée avec les communiqués : une illustration par défaut, choisie d'après le sujet. */
const IMAGES = { bunker: 'assets/bg.jpg', khamsin: 'assets/khamsin.svg', ombre: 'assets/ombre.svg', marais: 'assets/marecages/fond-marais-affiche.jpg' };
function sujetDe(n) {
  const t = `${n.title || ''} ${n.text || ''}`.toLowerCase();
  if (/marécage|marecage|marais|mère-vase|mere-vase|noyé|stryge|barque/.test(t)) return 'marais';
  if (/khamsin|désert|desert|pyramide|khépesh|khepesh|jeep|tempête|egypt|égypt/.test(t)) return 'khamsin';
  if (/ombre éternelle|ombre eternelle|lune|lunaire|oxygène|gravité/.test(t)) return 'ombre';
  return 'bunker';
}
function duo(sujet) {
  const d = el('div', 'd-duo');
  const img = el('img');
  img.alt = '';
  img.src = IMAGES[sujet];
  img.dataset.sujet = sujet;
  d.append(img);
  return d;
}
function carteActu(n, i, compacte) {
  const b = el('button', 'd-actu');
  b.type = 'button';
  b.dataset.actu = String(i);
  const im = el('div', 'd-actu-img');
  im.append(duo(sujetDe(n)));
  const corps = el('div', 'd-actu-corps');
  corps.append(el('b', '', n.title || ''));
  if (n.date) corps.append(el('small', '', fmtDate(n.date)));
  if (!compacte && n.text) corps.append(el('p', '', n.text));
  b.append(im, corps);
  b.addEventListener('click', () => lire(i));
  return b;
}
let actusCle = null, actus = [];
function dessinerActus(news) {
  const cle = JSON.stringify(news);
  if (cle === actusCle) return;
  actusCle = cle;
  actus = news;
  $('d-mini-actus').replaceChildren(...news.slice(0, 3).map((n, i) => carteActu(n, i, true)));
  $('d-grille-actus').replaceChildren(...news.map((n, i) => carteActu(n, i, false)));
  $('d-mini-vide').hidden = news.length > 0;
  $('d-actus-vide').hidden = news.length > 0;
  if (!$('d-lecture').hidden) fermerLecture();
}
function lire(i) {
  const n = actus[i];
  if (!n) return;
  const meta = [`Transmission ${String(i + 1).padStart(2, '0')}`];
  if (n.date) meta.push(fmtDate(n.date));
  const photo = el('div', 'd-photo');
  photo.append(duo(sujetDe(n)));
  const corps = [el('p', 'd-meta', meta.join(' · ')), el('h2', '', n.title || ''), photo];
  if (n.text) corps.push(el('p', '', n.text));
  $('d-lecture-corps').replaceChildren(...corps);
  if (!$('d-lecture').contains(document.activeElement)) ouvreur = document.activeElement;
  $('d-lecture').hidden = false;
  $('d-lecture-fermer').focus();
}
// à la fermeture, le focus clavier revient à la carte qui a ouvert la lecture (s'il était dans le panneau)
let ouvreur = null;
function fermerLecture() {
  const l = $('d-lecture'), rendre = !l.hidden && l.contains(document.activeElement);
  l.hidden = true;
  if (rendre && ouvreur && ouvreur.isConnected) ouvreur.focus();
}

/* ------------------------------------------------------------ cartes --- */
const CARTES = [
  { id: 'bunker7', sujet: 'bunker', nom: 'Bunker 7', genre: 'Carte à grille', lieu: 'Bunker militaire',
    texte: 'Salles, couloirs et abords : 22 bâtiments abandonnés, des zombies propres à chaque pièce, le Glas.' },
  { id: 'khamsin', sujet: 'khamsin', nom: 'Khamsin', genre: 'Monde ouvert', lieu: 'Désert égyptien',
    texte: 'Le plateau des pyramides, cerné par une tempête permanente et mortelle ; trois jeeps d’archéologie.' },
  { id: 'ombre', sujet: 'ombre', nom: 'Ombre éternelle', genre: 'Monde ouvert', lieu: 'Lune',
    texte: 'Une mine de glace en gradins, une gravité de 1/6 g, l’oxygène compté.' },
  // jeu 2.0.7 : publiée « en développement », comme dans le choix des cartes du jeu (MARAIS.dev)
  { id: 'marais', sujet: 'marais', nom: 'Les Marécages Maudits', genre: 'Monde ouvert · en développement', lieu: 'Marais',
    texte: 'Un marais sans bord sous une lune voilée : cinq îles dans la brume, des pontons, des barques à moteur, et quelque chose de très grand sous l’eau noire.' },
];
function dessinerCartes() {
  $('d-zones').replaceChildren(...CARTES.map((c, i) => {
    const li = el('li'), b = el('button');
    b.type = 'button';
    b.dataset.carte = c.id;
    const img = el('img');
    img.alt = '';
    img.src = IMAGES[c.sujet];
    img.dataset.sujet = c.sujet;
    const t = el('span');
    t.append(el('small', '', `Zone ${i + 1} · ${c.lieu}`), el('b', '', c.nom), el('span', '', c.genre));
    b.append(img, t);
    b.addEventListener('click', () => toast(c.nom, `${c.texte} La carte se choisit dans le menu Jouer du jeu.`));
    li.append(b);
    return li;
  }));
}

/* ------------------------------------------------------- mises à jour --- */
const ouvertes = new Set();
let chronoCle = null;
function dessinerMaj(s, hasUpdate, busy) {
  const inst = s.installed, rem = s.remote;
  $('d-v-installee').textContent = inst ? inst.version : '—';
  const sous = [];
  if (inst && inst.installedAt) sous.push(`Installée le ${fmtDate(inst.installedAt)}`);
  if (inst && s.checkedAt) sous.push(`vérifiée ${depuis(s.checkedAt)}`);
  $('d-v-installee-sous').textContent = inst ? sous.join(' · ') : 'Jeu non installé';
  const tampon = $('d-v-tampon');
  const aJour = inst && rem && !rem.cached && !hasUpdate;
  tampon.textContent = hasUpdate ? 'Mise à jour' : aJour ? 'À jour' : inst ? 'Installée' : 'Absent';
  tampon.classList.toggle('ok', !hasUpdate && !!inst);
  $('d-v-dispo').hidden = !hasUpdate;
  if (hasUpdate) {
    $('d-v-distante').textContent = rem.version;
    const d = [];
    if (rem.size) d.push(`${fmtSize(rem.size)} à télécharger`);
    if (rem.date) d.push(`publiée le ${fmtDate(rem.date)}`);
    $('d-v-distante-sous').textContent = d.join(' · ');
  }
  dessinerChrono(s, hasUpdate);
}
/* Chronologie de toutes les versions publiées (reconstruite seulement si elle change : l'état est renvoyé
   plusieurs fois par seconde pendant un téléchargement). */
function dessinerChrono(s, hasUpdate) {
  const list = s.history || [];
  const inst = s.installed && s.installed.version, nouvelle = hasUpdate ? s.remote.version : null;
  const cle = JSON.stringify([list, inst, nouvelle, [...ouvertes]]);
  if (cle === chronoCle) return;
  chronoCle = cle;
  const focus = document.activeElement && $('d-chrono').contains(document.activeElement) ? document.activeElement.dataset.plus : null;
  $('d-chrono').replaceChildren(...list.map((v) => {
    const li = el('li');
    li.dataset.version = v.version;
    if (v.version === inst) li.classList.add('installee');
    if (v.version === nouvelle) li.classList.add('nouvelle');
    const h = el('header');
    h.append(el('b', '', v.version), el('small', '', v.date ? fmtDate(v.date) : 'Date inconnue'));
    if (v.version === inst) h.append(el('em', 'd-tampon', 'Installée'));
    if (v.version === nouvelle) h.append(el('em', 'd-tampon ok', 'Nouvelle'));
    const ul = el('ul');
    const notes = v.notes || [];
    const toutes = ouvertes.has(v.version) || notes.length <= 4;
    const montrees = toutes ? notes : notes.slice(0, 3);
    if (!notes.length) ul.append(el('li', 'vide', 'Aucune note pour cette version.'));
    for (const n of montrees) ul.append(el('li', '', cleanNote(n)));
    li.append(h, ul);
    const reste = notes.length - montrees.length;
    if (reste > 0) {
      const plus = el('button', 'd-lien', `Voir les ${reste} autres notes`);
      plus.type = 'button';
      plus.dataset.plus = v.version;
      plus.addEventListener('click', () => {
        ouvertes.add(v.version);
        dessinerChrono(current, hasUpdateOf(current));
        const ligne = [...$('d-chrono').children].find((x) => x.dataset.version === v.version);
        const premiere = ligne && ligne.querySelectorAll('ul li')[3];
        if (premiere) { premiere.tabIndex = -1; premiere.focus(); }
      });
      li.append(plus);
    }
    return li;
  }));
  if (focus) { const b = $('d-chrono').querySelector(`[data-plus="${CSS.escape(focus)}"]`); if (b) b.focus(); }
}

/* -------------------------------------------------------- installation --- */
let chiffresCle = null;
function dessinerInstallation(s, busy) {
  const inst = s.installed, rem = s.remote;
  const chiffres = [
    [inst ? inst.version : '—', 'Version installée'],
    [inst && inst.installedAt ? fmtDate(inst.installedAt, dateCourteFmt) : '—', 'Installée le'],
    [inst && inst.previous ? inst.previous : 'aucune', 'Version précédente gardée'],
    [rem && rem.size ? fmtSize(rem.size) : '—', rem ? `Paquet de la version ${rem.version}` : 'Paquet de la version en ligne'],
  ];
  const cle = JSON.stringify(chiffres);
  if (cle !== chiffresCle) {
    chiffresCle = cle;
    $('d-chiffres').replaceChildren(...chiffres.map(([v, l]) => { const d = el('div', 'd-chiffre'); const b = el('b', '', v); b.title = v; d.append(b, el('span', '', l)); return d; }));
  }
  $('d-sceau-cle').textContent = (s.source && s.source.keyFingerprint) || '—';
  $('d-versions-ligne').textContent = !inst ? 'Aucune version installée.'
    : inst.previous ? `Installée : ${inst.version} · précédente gardée : ${inst.previous} (retour possible).`
      : `Installée : ${inst.version} · aucune version précédente gardée.`;
  for (const x of document.querySelectorAll('[data-revenir]')) x.hidden = !(inst && inst.previous);
  for (const x of document.querySelectorAll('[data-precedente]')) x.textContent = inst && inst.previous ? inst.previous : '';
}

/* ---------------------------------------------------------- paramètres --- */
// réglages du fond (launcher 1.4.0) : chacun caché si le processus principal ne le connaît pas
const REGLAGES_FOND = ['fond', 'fondAnime', 'fondEclairs', 'volumeSons'];
const valeurDe = (i) => (i.type === 'checkbox' ? i.checked : i.type === 'range' ? Math.round(Number(i.value)) : i.value);
function majVolume(v) {
  const t = `${v}${NB}%`;
  $('d-volume-val').textContent = t;
  $('d-volume').setAttribute('aria-valuetext', t);
  $('d-volume').style.setProperty('--v', `${v}%`);
}
function dessinerReglages(s, busy) {
  const set = s.settings || {};
  for (const i of document.querySelectorAll('[data-reglage]')) {
    const k = i.dataset.reglage;
    if (REGLAGES_FOND.includes(k)) i.closest('[data-ligne]').hidden = !Object.hasOwn(set, k);
    if (document.activeElement === i) continue;
    if (i.type === 'checkbox') i.checked = k === 'fondAnime' || k === 'fondEclairs' ? set[k] !== false : !!set[k];
    else if (i.type === 'range') { const v = Number.isInteger(set[k]) ? set[k] : 80; i.value = String(v); majVolume(v); }
    else if (typeof set[k] === 'string') i.value = set[k];
  }
  document.querySelector('[data-reglage="autoInstall"]').disabled = !set.autoCheck;
  // éclairs, sons et volume ne valent que pour le fond des Marécages Maudits montré (choisi, et vidéo lisible) ; les sons
  // repartent coupés à chaque lancement
  const marais = fondActuel() === 'marais', panne = sons && sons.erreur();
  $('d-fond-note').textContent = videoEnPanne ? 'Les Marécages Maudits ne peuvent pas être lus sur ce PC : Bunker 7 à la place'
    : 'La scène d’une carte du jeu, derrière le bouton Jouer';
  document.querySelector('[data-reglage="fondEclairs"]').disabled = !marais;
  $('d-sons').closest('[data-ligne]').hidden = !sons;
  $('d-sons').checked = fondSons;
  $('d-sons').disabled = !sons || !!panne || !marais;
  $('d-sons-note').textContent = panne ? `Indisponibles sur ce PC : ${panne}` : 'Les Marécages Maudits : coupés à chaque lancement du launcher ; seulement quand le fond est visible';
  $('d-volume').disabled = !fondSons || !marais;
  $('d-regl-accueil').hidden = [...$('d-regl-accueil').querySelectorAll('[data-ligne]')].every((l) => l.hidden);
  const src = s.source || {};
  const desc = describeSource(src.url);
  $('d-source').textContent = desc.main;
  $('d-source').title = src.url || '';
  $('d-source-sous').textContent = desc.sub;
  $('d-source-sous').hidden = !desc.sub;
  $('d-cle').textContent = src.keyFingerprint || 'aucune';
  $('d-source-test').hidden = !src.custom;
  $('d-source-provisoire').hidden = !!src.configured || !!src.custom;
  $('d-versions-pied').textContent = `Launcher ${s.launcherVersion}${s.installed ? ` · jeu ${s.installed.version}` : ''}`;
}

/* ----------------------------------------------------------- bulles --- */
function toast(titre, texte, type) {
  const box = $('d-bulles');
  const b = el('div', `d-bulle${type === 'erreur' ? ' erreur' : ''}`);
  b.setAttribute('role', 'status');
  if (titre) b.append(el('b', '', titre));
  b.append(el('span', '', texte));
  box.append(b);
  while (box.children.length > 3) box.firstElementChild.remove();
  requestAnimationFrame(() => b.classList.add('visible'));
  setTimeout(() => { b.classList.remove('visible'); setTimeout(() => b.remove(), 400); }, 6000);
}

/* ------------------------------------------- scène de Bunker 7 (lampe, poussière) --- */
const hero = $('d-hero'), cv = $('d-poussiere'), cx = cv.getContext('2d');
const lampe = { x: 0, y: 0, s: 1 };
const reduire = matchMedia('(prefers-reduced-motion: reduce)');
let grains = [], boucleId = 0, dernier = 0;
function hasard(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function placer() {
  const W = hero.clientWidth, H = hero.clientHeight;
  if (!W || !H) return;
  const iw = 2160, ih = 1320, sc = Math.max(W / iw, H / ih);         // object-fit: cover ; object-position: 62 % 45 %
  lampe.x = (W - iw * sc) * 0.62 + 1107 * sc; lampe.y = (H - ih * sc) * 0.45 + 437 * sc; lampe.s = sc;
  $('d-lampe').style.left = `${lampe.x}px`; $('d-lampe').style.top = `${lampe.y}px`;
  const r = devicePixelRatio || 1;
  cv.width = Math.round(W * r); cv.height = Math.round(H * r); cx.setTransform(r, 0, 0, r, 0, 0);
  const h = hasard(7);
  grains = Array.from({ length: 55 }, () => {
    const t = h(), y = lampe.y + 10 + t * (H * 0.92 - lampe.y), demi = (y - lampe.y) * 0.6;
    return { x: lampe.x + (h() * 2 - 1) * demi, y, vx: (h() - 0.5) * 0.1, vy: (h() - 0.35) * 0.07, r: 0.5 + h() * 1.5, a: 0.12 + h() * 0.4, ph: h() * 6.28 };
  });
  poussiere(performance.now());
}
function poussiere(t) {
  const W = hero.clientWidth, H = hero.clientHeight;
  cx.clearRect(0, 0, W, H);
  const bas = H, g = cx.createLinearGradient(0, lampe.y, 0, bas);
  g.addColorStop(0, 'rgba(255, 220, 160, .09)'); g.addColorStop(1, 'rgba(255, 220, 160, 0)');
  cx.fillStyle = g; cx.beginPath(); cx.moveTo(lampe.x - 34 * lampe.s, lampe.y); cx.lineTo(lampe.x + 34 * lampe.s, lampe.y);
  cx.lineTo(lampe.x + (bas - lampe.y) * 0.6, bas); cx.lineTo(lampe.x - (bas - lampe.y) * 0.6, bas); cx.closePath(); cx.fill();
  for (const p of grains) {
    const demi = Math.max(20, (p.y - lampe.y) * 0.6), dx = Math.abs(p.x - lampe.x) / demi;
    const a = p.a * Math.max(0, 1 - dx) * (0.65 + 0.35 * Math.sin(t / 900 + p.ph));
    if (a <= 0.01) continue;
    cx.fillStyle = `rgba(255, 228, 185, ${a.toFixed(3)})`;
    cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
  }
}
function boucle(t) {
  boucleId = 0;
  if (hero.dataset.anime !== 'oui' || hero.dataset.fond !== 'bunker') return;
  if (t - dernier > 33) {
    dernier = t;
    const H = hero.clientHeight;
    for (const p of grains) {
      p.x += p.vx; p.y += p.vy;
      const demi = (p.y - lampe.y) * 0.6;
      if (p.y > H * 0.95 || p.y < lampe.y + 6 || Math.abs(p.x - lampe.x) > demi * 1.1) { p.y = lampe.y + 20 + Math.random() * (H * 0.7 - lampe.y); p.x = lampe.x + (Math.random() * 2 - 1) * (p.y - lampe.y) * 0.5; }
    }
    poussiere(t);
  }
  boucleId = requestAnimationFrame(boucle);
}
/* ----------------------------------- fond des Marécages Maudits (vidéo, sons de l'ambiance) --- */
/* La scène capturée dans le jeu du kit 2.0.7 (maquettes/launcher/scene-bete) : boucle de 7,7 s encodée par encoder.js
   (CRF 28, fondu d'une seconde : choix d'Anthony du 2 novembre 2026), copiée par scene-bete/vers-launcher.py, qui
   donne aussi sa chronologie (fond-marais.json : l'éclair de la boucle, qui déclenche le tonnerre). Fond par défaut
   des joueurs (choix d'Anthony du 2 novembre 2026) ; publication de ces ressources autorisée par lui le même jour. */
const MARAIS = {
  video: 'assets/marecages/fond-marais.webm', sans: 'assets/marecages/fond-marais-sans-eclairs.webm', affiche: 'assets/marecages/fond-marais-affiche.jpg',
  boucle: { fps: 30, images: 231, fondu: 30, duree: 7.7, eclairs: [{ t: 2.133, x: 0.151, d: 4436 }] },
};
// textes de la carte dans le jeu (MARAIS : eyebrow) et légende de la scène
const TEXTES = {
  marais: ['Rapport d’incident · Les Marécages Maudits · nuit', 'Les Marécages Maudits · la Mère-Vase se jette sur les Noyés · scène du jeu 2.0.7, sous l’orage'],
  bunker: ['Rapport d’incident · Bunker 7 · nuit du 14 décembre', ''],
};
const sons = window.Ambiance && Ambiance.disponible ? Ambiance : null;
let fondSons = false;                                  // les sons repartent coupés à chaque lancement
let videoEnPanne = false;
const video = window.FondVideo ? FondVideo.create(hero, MARAIS.video, MARAIS.affiche, {
  sans: MARAIS.sans, boucle: MARAIS.boucle, ecoute: sons ? { eclair: (e) => sons.eclair(e) } : null,
  panne: () => {
    videoEnPanne = true; fondSons = false;
    majFond();
    if (current) dessinerReglages(current);
    toast('Fond de l’accueil', 'La vidéo des Marécages Maudits ne peut pas être lue sur ce PC : Bunker 7 à la place.', 'erreur');
  },
}) : null;
if (sons) sons.regler({ panne: (m) => { fondSons = false; if (current) dessinerReglages(current); toast('Sons de l’ambiance', m, 'erreur'); } });
function fondActuel() {
  const set = (current && current.settings) || {};
  return set.fond !== 'bunker' && video && !videoEnPanne ? 'marais' : 'bunker';
}
// pour les essais (lecture seule) : le lecteur, l'ambiance, le fond montré
window.ZS_FOND = Object.freeze({ video: () => video, sons: () => sons, actuel: fondActuel, sonsAllumes: () => fondSons });
/* Le fond ne bouge que si on le voit : accueil, fenêtre visible et au premier plan (pas derrière les Mod Tools),
   pas de partie en cours ; jamais avec le réglage « fond fixe » ni avec « réduire les animations » de Windows. Fenêtre
   restée à l'écran mais à l'arrière-plan : la vidéo s'arrête sur l'image en cours (pas de retour à l'affiche). Les sons
   de l'ambiance, s'ils sont allumés, suivent la même visibilité, mais pas le fond fixe : sur l'image fixe, la pluie
   continue, sans tonnerre (pas d'éclair, pas de tonnerre ; plan §8.3, choix validé par Anthony le 31 octobre 2026). */
function majFond() {
  const s = current || {}, set = s.settings || {};
  const fixe = set.fondAnime === false || reduire.matches;
  const ecran = section === 'accueil' && !document.hidden && s.phase !== 'playing';   // le fond est à l'écran
  const visible = ecran && document.hasFocus();
  const anime = visible && !fixe, f = fondActuel();
  if (hero.dataset.fond !== f) {
    hero.dataset.fond = f;
    $('d-sur').textContent = TEXTES[f][0];
    $('d-legende').textContent = TEXTES[f][1];
    if (f === 'bunker') requestAnimationFrame(placer);
  }
  hero.classList.toggle('fond-fixe', fixe);
  hero.dataset.anime = anime ? 'oui' : 'non';
  if (anime && f === 'bunker' && !boucleId) boucleId = requestAnimationFrame(boucle);
  if (video) video.regler({ actif: f === 'marais' && visible, garder: f === 'marais' && ecran && !fixe, anim: !fixe, eclairs: set.fondEclairs !== false });
  if (sons) sons.regler({ veut: fondSons, visible: f === 'marais' && visible, volume: (Number.isInteger(set.volumeSons) ? set.volumeSons : 80) / 100 });
}
new ResizeObserver(placer).observe(hero, { box: 'device-pixel-content-box' });

/* ------------------------------------------------- écran d'ouverture --- */
// une seconde au moins (les trois lignes s'écrivent), jusqu'au premier état ; jamais plus de 2,5 s
const ouverture = { t0: performance.now(), pret: false, fini: false, apres: [] };
function finOuverture(force) {
  if (ouverture.fini || (!force && (!ouverture.pret || performance.now() - ouverture.t0 < 1000))) return;
  ouverture.fini = true;
  $('d-ouverture').classList.add('fini');
  for (const f of ouverture.apres.splice(0)) f();
}
setTimeout(() => finOuverture(), 1050);
setTimeout(() => finOuverture(true), 2500);

/* ---------------------------------------------------------- actions --- */
function guard(fn) {
  return async () => {
    try { await fn(); } catch (e) { console.error(e); }
  };
}
/* Le second clic d'un double-clic (event.detail = 2) ne relance pas l'action : le retour à la version précédente n'a
   pas de phase occupée et se serait défait ; un lien d'état peut avoir changé sous le pointeur. Au clavier, detail = 0. */
function unClic(fn) {
  const g = guard(fn);
  return (e) => { if (e.detail > 1) return; g(); };
}
async function ouvrirModtools() {
  try { await window.zs.openModtools(); } catch (e) {
    toast('Mod Tools', String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'erreur');
  }
}
const ACTIONS = {
  check: () => window.zs.check(),
  install: () => window.zs.install(),
  repair: () => window.zs.repair(),
  rollback: () => window.zs.rollback(),
  dossier: () => window.zs.open('game'),
  journal: () => window.zs.open('logs'),
  publication: () => window.zs.openPublisher(),
  modtools: ouvrirModtools,
  sourceOfficielle: () => window.zs.resetSource(),
  revenirPartie: () => window.zs.play(),
};
function bind() {
  $('d-reduire').addEventListener('click', guard(() => window.zs.windowAction('minimize')));
  $('d-fermer').addEventListener('click', guard(() => window.zs.windowAction('close')));
  // agrandir ou restaurer : le processus principal renvoie ensuite l'état de la fenêtre (windowState)
  $('d-agrandir').addEventListener('click', guard(() => window.zs.windowAction('maximize')));
  $('btn-main').addEventListener('click', guard(async () => {
    if (!mainAction || pending) return;
    const action = mainAction;
    pending = true;
    $('btn-main').disabled = true;
    setTimeout(() => { if (pending && current) render(current); }, 1500);
    await action();
  }));
  $('link-a').addEventListener('click', unClic(() => linkActions[0] && linkActions[0]()));
  $('link-b').addEventListener('click', unClic(() => linkActions[1] && linkActions[1]()));
  $('btn-modtools').addEventListener('click', ouvrirModtools);
  $('d-bandeau-btn').addEventListener('click', guard(() => window.zs.updateLauncher()));
  $('d-dl-annuler').addEventListener('click', guard(() => window.zs.cancel()));
  for (const b of document.querySelectorAll('[data-section]')) b.addEventListener('click', () => aller(b.dataset.section));
  for (const b of document.querySelectorAll('[data-aller]')) b.addEventListener('click', () => aller(b.dataset.aller));
  for (const b of document.querySelectorAll('[data-act]')) b.addEventListener('click', unClic(() => ACTIONS[b.dataset.act]()));
  for (const i of document.querySelectorAll('[data-reglage]')) i.addEventListener('change', guard(() => window.zs.setSetting(i.dataset.reglage, valeurDe(i))));
  // volume de l'ambiance : retenu pendant le glissement (sons.regler), enregistré au relâchement (change, ci-dessus) ; le
  // curseur est dans Paramètres, où les sons sont en pause : on l'entend au retour à l'accueil, par la montée de 1,5 s
  $('d-volume').addEventListener('input', () => { const v = valeurDe($('d-volume')); majVolume(v); if (sons) sons.regler({ volume: v / 100 }); });
  // sons de l'ambiance : réglage de la page seulement (coupés à chaque lancement) ; le contexte audio naît au premier
  // passage à l'accueil, sons allumés (ambiance.js, appliquer), sur ce geste
  $('d-sons').addEventListener('change', () => { fondSons = $('d-sons').checked; majFond(); if (current) dessinerReglages(current); });
  $('d-lecture-fermer').addEventListener('click', fermerLecture);
  $('d-cloche').addEventListener('click', () => {
    const s = current || {};
    if (hasUpdateOf(s)) aller('maj');
    else if (s.launcherUpdate) toast('Launcher', `Nouveau launcher ${s.launcherUpdate.version} disponible : le bandeau en haut le télécharge et l’installe, puis le launcher redémarre.`);
    else toast('', 'Aucune notification.');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('d-lecture').hidden) fermerLecture(); });
  document.addEventListener('visibilitychange', majFond);
  addEventListener('focus', majFond);
  addEventListener('blur', majFond);
  reduire.addEventListener('change', majFond);
  // Pas de glisser-déposer de fichiers dans le launcher.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
}

/* horloge de Bruxelles ; « vérifié il y a … » se met à jour sans attendre un nouvel état (pas pendant un
   téléchargement : les états s'y suivent, et la vitesse ne se mesure que sur un état nouveau) */
function horloge() { $('d-heure').textContent = heureFmt.format(Date.now()); }
horloge();
setInterval(horloge, 15000);
setInterval(() => { if (current && current.phase !== 'downloading') dessiner(current); }, 30000);

$('d-bande').replaceChildren(...Array.from({ length: 40 }, (_, i) => { const c = el('i'); c.style.setProperty('--i', String(i)); return c; }));
dessinerCartes();
bind();
aller('accueil');
window.zs.onStatus(render);
window.zs.status().then((s) => {
  render(s);
  // la bulle attend la fin de l'écran d'ouverture, qui la cacherait
  if (s.justUpdated) {
    const bulle = () => toast('', `Launcher mis à jour${NB}: version ${s.justUpdated}`);
    if (ouverture.fini) bulle(); else ouverture.apres.push(bulle);
  }
}).catch((e) => console.error(e));
