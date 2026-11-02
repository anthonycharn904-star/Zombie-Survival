'use strict';
/* Direction C · Nouvelle génération : navigation à volet, cadran Jouer, bâtons de manche, veines génératives,
   actualités en une, frise des versions. */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = ZSM.D, fmt = ZSM.fmt;
  const F = $('zsm-fenetre');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NS = 'http://www.w3.org/2000/svg';
  let section = 'accueil', une = 0, versionSel = 0;
  function hasard(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------------------------------------------------------- navigation et commandes */
  function aller(s) {
    const change = s !== section;
    section = s;
    F.querySelectorAll('.c-nav > button').forEach((b) => (b.dataset.section === s ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    F.querySelectorAll('.c-page').forEach((p) => { p.hidden = p.dataset.page !== s; });
    if (change && ZSM.animationsActives()) { const v = $('c-volet'); v.classList.remove('passe'); void v.offsetWidth; v.classList.add('passe'); }
  }
  F.querySelectorAll('[data-section]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.section)));
  F.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.aller)));
  F.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => ZSM.actions[b.dataset.act]()));
  F.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => ZSM.toast(`Simulation : ${b.dataset.sim}.`, 'simulation')));
  F.querySelectorAll('[data-reglage]').forEach((i) => i.addEventListener('change', () => ZSM.actions.reglage(i.dataset.reglage, i.checked)));
  $('c-jouer').addEventListener('click', () => { const p = ZSM.principal(); if (p.actif && p.action) p.action(); });
  $('c-alerte-btn').addEventListener('click', () => ZSM.actions.installerLauncher());

  /* ---------------------------------------------------------------- cadran (25 segments) et bâtons de manche (5 × 5) */
  const segs = $('c-cad-segments');
  segs.insertAdjacentHTML('beforebegin', '<defs><radialGradient id="c-coeur" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#2a0709"/><stop offset=".7" stop-color="#0c0405"/><stop offset="1" stop-color="#050203"/></radialGradient></defs>');
  for (let i = 0; i < 25; i++) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', '145'); r.setAttribute('y', '4'); r.setAttribute('width', '10'); r.setAttribute('height', '20'); r.setAttribute('rx', '3');
    r.setAttribute('transform', `rotate(${i * 14.4} 150 150)`); r.style.setProperty('--i', i);
    segs.append(r);
  }
  const h = hasard(11), batons = $('c-batons');
  for (let g = 0; g < 5; g++) {
    const x0 = 4 + g * 54;
    for (let k = 0; k < 4; k++) {
      const x = x0 + 6 + k * 9 + (h() - 0.5) * 2;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${x.toFixed(1)} ${(6 + h() * 3).toFixed(1)} L${(x + (h() - 0.5) * 3).toFixed(1)} ${(37 + h() * 3).toFixed(1)}`);
      batons.append(p);
    }
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${x0} ${(31 + h() * 3).toFixed(1)} L${x0 + 44} ${(10 + h() * 3).toFixed(1)}`);
    batons.append(p);
  }

  /* ---------------------------------------------------------------- contenus */
  const duo = (k, pos) => `<div class="c-duo"><img data-img="${k}" alt="" style="object-position:${pos || '50% 50%'}"></div>`;
  $('c-zones').innerHTML = D.cartes.map((c) => `
    <button type="button" class="c-zone" data-carte="${c.id}">${duo(c.image || 'khamsin', c.id === 'bunker7' ? '78% 60%' : c.id === 'ombre' ? '86% 22%' : '50% 62%')}
      <span><b>${esc(c.nom)}</b><small>${esc(c.genre)} · ${esc(c.lieu)}</small></span></button>`).join('');
  F.querySelectorAll('[data-carte]').forEach((b) => b.addEventListener('click', () => {
    const c = D.cartes.find((x) => x.id === b.dataset.carte);
    ZSM.toast(`${c.nom} : ${c.texte} La carte se choisit dans le menu Jouer du jeu.`, 'info');
  }));
  $('c-ticker').textContent = `${D.actus[0].titre} · ${fmt.date(D.actus[0].date)}`;
  function dessinerActus() {
    const a = D.actus[une];
    $('c-une').innerHTML = `${duo(a.image === 'icone' ? 'bunker' : a.image, a.image === 'portrait' ? '50% 40%' : '60% 55%')}
      <div class="c-une-texte"><p class="c-meta"><span class="c-exemple">Exemple</span><span>${esc(a.categorie)} · ${fmt.date(a.date)}</span></p>
      <h3>${esc(a.titre)}</h3><p>${esc(a.texte)}</p>
      <small>Contenu d'exemple : le vrai launcher reçoit ses communiqués avec chaque version publiée (titre, texte, date).</small></div>`;
    $('c-breves').innerHTML = D.actus.map((x, i) => `<li><button type="button" aria-current="${i === une}" data-une="${i}"><i>${String(i + 1).padStart(2, '0')}</i>
      <span><b>${esc(x.titre)}</b><small>${esc(x.categorie)} · ${fmt.date(x.date)}</small></span></button></li>`).join('');
    $('c-breves').querySelectorAll('[data-une]').forEach((b) => b.addEventListener('click', () => { une = +b.dataset.une; dessinerActus(); }));
    ZSM.appliquerImages(F);
  }
  function dessinerVersions(e) {
    const inst = e.installe && e.installe.version, liste = ZSM.historique;
    $('c-frise').innerHTML = liste.map((v, i) => `<li><button type="button" class="${v.version === inst ? 'installee' : ''}" aria-current="${i === versionSel}" data-v="${i}"><b>${v.version}</b><small>${fmt.dateCourte(v.date)}</small></button></li>`).join('');
    $('c-frise').querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { versionSel = +b.dataset.v; dessinerVersions(ZSM.etat); }));
    const v = liste[versionSel];
    const action = e.phase === 'maj' ? `<div class="c-maj-action"><span>La <b>${e.distant.version}</b>${e.distant.simule ? ' (simulée)' : ''} est disponible · ${fmt.taille(e.distant.taille)}</span><button type="button" class="c-btn" id="c-maj-btn">Mettre à jour</button></div>` : '';
    $('c-version').innerHTML = `<div><div class="c-version-num ${v.version === inst ? 'installee' : ''}">${v.version}</div>
        <div class="c-version-tags">${v.version === inst ? '<span class="c-tag-rouge">Installée</span>' : ''}${v.exemple ? '<span class="c-exemple">Exemple</span>' : ''}</div></div>
      <div class="c-version-notes"><h3>Publiée le ${fmt.date(v.date)}</h3><ul>${v.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        <small>${v.exemple ? 'Résumé d’après le README (exemple) : les notes publiées par Anthony peuvent différer.' : 'Notes publiées avec cette version.'}</small>${action}</div>`;
    const mb = $('c-maj-btn'); if (mb) mb.addEventListener('click', () => ZSM.actions.mettreAJour());
  }
  $('c-chemin').textContent = D.dossier;
  $('c-cle').textContent = D.source.empreinte; $('c-cle-2').textContent = D.source.empreinte;
  $('c-source').textContent = D.source.url;
  dessinerActus();

  /* ---------------------------------------------------------------- rendu des états */
  function rendu(e) {
    const st = ZSM.statut(e), pr = ZSM.principal(e);
    const v = e.installe ? `${e.installe.version}${e.installe.simule ? ' (simulée)' : ''}` : '—';
    const cad = $('c-jouer');
    cad.dataset.type = pr.type; cad.disabled = !pr.actif;
    cad.classList.toggle('c-attente', !!st.indetermine);
    $('c-jouer-lib').textContent = pr.libelle;
    $('c-jouer-sous').textContent = pr.type === 'maj' ? (e.phase === 'absent' ? fmt.taille(D.paquet) : e.phase === 'erreur' ? 'Remise en état' : `Vers la ${e.distant.version}`)
      : pr.type === 'progres' ? st.titre : pr.type === 'partie' ? 'Partie en cours' : `Jeu ${v}`;
    // segments et bâtons : pleins quand le jeu est prêt, remplis pendant le téléchargement
    let on = e.installe ? 25 : 0;
    if (e.phase === 'telechargement') on = Math.round(e.progres.pct * 25);
    if (st.indetermine) on = 0;
    [...segs.children].forEach((r, i) => r.classList.toggle('on', i < on));
    const traits = [...batons.children];
    traits.forEach((p, i) => p.classList.toggle('on', i < on));
    $('c-statut').dataset.ton = st.ton;
    $('c-st-titre').textContent = st.titre;
    $('c-st-detail').textContent = st.detail;
    $('c-liens').innerHTML = '';
    for (const l of st.liens || []) { const b = document.createElement('button'); b.type = 'button'; b.textContent = l.libelle; b.addEventListener('click', l.action); $('c-liens').append(b); }
    // barre de titre, navigation, Mod Tools, bandeau du launcher
    $('c-v-jeu').textContent = e.installe ? e.installe.version : '—';
    $('c-v-launcher').textContent = e.launcherVersion;
    $('c-sur').textContent = e.installe ? `Jeu ${v} · construction ${e.installe.construction}${e.installe.simule ? '' : ` · publié le ${fmt.date(D.jeu.date)}`}` : 'Jeu non installé';
    $('c-nav-pied').innerHTML = `<b>${esc(st.titre)}</b><br>${e.installe ? `Jeu ${esc(v)} · ${esc(D.dossier)}` : 'Aucune version installée'}`;
    $('c-nav-maj').hidden = e.phase !== 'maj';
    $('c-nav-modtools').hidden = !e.auteur;
    $('c-verrou').hidden = e.auteur;
    if (!e.auteur && section === 'modtools') aller('accueil');
    const occupe = ['telechargement', 'signature', 'installation', 'redemarrage', 'partie', 'lancement'].includes(e.phase);
    $('c-alerte').hidden = !(e.launcherMaj && !occupe);
    if (e.launcherMaj) $('c-alerte-v').textContent = e.launcherMaj.version;
    // pages
    $('c-maj-etat').textContent = e.phase === 'maj' ? `Installée : ${v} · la ${e.distant.version}${e.distant.simule ? ' (simulée)' : ''} est disponible` : e.installe ? `Installée : ${v} · à jour` : 'Jeu non installé';
    dessinerVersions(e);
    $('c-fiche').innerHTML = [[fmt.taille(D.tailleInstallee), 'Taille installée'], [fmt.taille(D.paquet), 'Paquet d’une version'], [e.installe ? e.installe.version : '—', 'Version installée'],
      [e.installe ? `C${e.installe.construction}` : '—', 'Construction'], [String(D.jeu.editeur), 'Interface Mod Tools']].map(([b, s]) => `<div><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join('');
    $('c-precedente').textContent = e.precedente;
    F.querySelectorAll('[data-reglage]').forEach((i) => { i.checked = !!e.reglages[i.dataset.reglage]; });
    // ouverture et partie
    const boot = $('c-boot');
    if (e.phase === 'demarrage') { boot.classList.remove('fini'); boot.querySelectorAll('path').forEach((p) => { p.style.animation = 'none'; void p.getBoundingClientRect(); p.style.animation = ''; }); }
    else boot.classList.add('fini');
    $('c-partie').hidden = e.phase !== 'partie';
  }

  /* ---------------------------------------------------------------- veines : un champ de courants, traces rouges */
  const cv = $('c-veines'), g = cv.getContext('2d');
  let W = 0, H = 0, parts = [], t = 0, anim = true, dernier = 0;
  const champ = (x, y) => 2.2 * Math.sin(x * 0.0042 + 1.6 * Math.sin(y * 0.0031 + t * 0.07)) + 1.7 * Math.cos(y * 0.0049 - 1.2 * Math.cos(x * 0.0023 - t * 0.05));
  function naitre(p, r) { p.x = W * (0.28 + 0.72 * r()); p.y = r() * H; p.vie = 90 + r() * 240; p.age = 0; p.v = 1.1 + r() * 1.2; }
  function pas(r) {
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0, 0, 0, .03)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.lineWidth = 1.1;
    for (const p of parts) {
      const a = champ(p.x, p.y), nx = p.x + Math.cos(a) * p.v, ny = p.y + Math.sin(a) * p.v;
      const al = 0.3 * Math.sin((Math.PI * p.age) / p.vie);
      g.strokeStyle = `rgba(220, 26, 36, ${al.toFixed(3)})`;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(nx, ny); g.stroke();
      p.x = nx; p.y = ny; p.age++;
      if (p.age > p.vie || nx < 0 || nx > W || ny < 0 || ny > H) naitre(p, r);
    }
    t += 0.016;
  }
  function taille() {
    W = F.clientWidth; H = F.clientHeight;
    const dpr = devicePixelRatio || 1;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = hasard(5);
    parts = Array.from({ length: 150 }, () => { const p = {}; naitre(p, r); p.age = Math.floor(r() * p.vie); return p; });
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) pas(r);            // image de départ (et image fixe sans animations)
  }
  function boucle(ts) {
    if (!anim) return;
    if (ts - dernier > 33) { dernier = ts; pas(Math.random); }
    requestAnimationFrame(boucle);
  }
  function animations(on) { anim = on; if (on) requestAnimationFrame(boucle); }
  new ResizeObserver(taille).observe(F);

  aller('accueil');
  ZSM.init({ direction: 'C', nom: 'Nouvelle génération', rendu, aller, animations });
  taille();
})();
