'use strict';
/* Direction B · Launcher AAA moderne : navigation, bandeau défilant, actualités filtrables, historique, gestionnaire
   de téléchargement. */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = ZSM.D, fmt = ZSM.fmt;
  const F = $('zsm-fenetre');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NOMS = { accueil: 'Accueil', actus: 'Actualités', maj: 'Mises à jour', installation: 'Installation', modtools: 'Mod Tools', reglages: 'Paramètres' };
  let section = 'accueil', filtre = 'Tout', ouvertes = new Set();

  /* ---------------------------------------------------------------- navigation et commandes */
  function aller(s) {
    section = s;
    F.querySelectorAll('.b-nav button').forEach((b) => (b.dataset.section === s ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    F.querySelectorAll('.b-page').forEach((p) => { p.hidden = p.dataset.page !== s; });
    $('b-fil').textContent = NOMS[s];
    $('b-lecture').hidden = true;
    $('b-contenu').scrollTop = 0;
  }
  F.querySelectorAll('[data-section]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.section)));
  F.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.aller)));
  F.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => ZSM.actions[b.dataset.act]()));
  F.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => ZSM.toast(`Simulation : ${b.dataset.sim}.`, 'simulation')));
  F.querySelectorAll('[data-reglage]').forEach((i) => i.addEventListener('change', () => ZSM.actions.reglage(i.dataset.reglage, i.checked)));
  $('b-jouer').addEventListener('click', () => { const p = ZSM.principal(); if (p.actif && p.action) p.action(); });
  $('b-bandeau-btn').addEventListener('click', () => ZSM.actions.installerLauncher());
  $('b-dl-annuler').addEventListener('click', () => ZSM.actions.annuler());
  $('b-cloche').addEventListener('click', () => {
    const e = ZSM.etat;
    if (e.phase === 'maj') aller('maj');
    else if (e.launcherMaj) ZSM.toast(`Nouveau launcher ${e.launcherMaj.version} disponible (simulé).`, 'info');
    else ZSM.toast('Aucune notification.', 'info');
  });
  $('b-lecture-fermer').addEventListener('click', () => { $('b-lecture').hidden = true; });

  /* ---------------------------------------------------------------- images d'illustration */
  const fondImage = (k) => (k === 'icone' ? 'background: var(--img-icone) center / 26% auto no-repeat, radial-gradient(circle, #8e1018, #3a080b);'
    : k === 'portrait' ? 'background: var(--img-portrait) 50% 64% / cover no-repeat, #2a1a14;'
      : `background: var(--img-${k}) ${k === 'bunker' ? '72% 55%' : '50% 60%'} / cover no-repeat;`);

  /* ---------------------------------------------------------------- bandeau défilant de l'accueil */
  const DIAPOS = [
    { img: 'bunker', pos: '62% 45%', puce: 'Nouveau · Jeu 2.0.6', date: fmt.date(D.jeu.date), titre: 'Khamsin se resserre, Anthony entre en scène',
      desc: 'Prise des armes refaite, jeep d’archéologie, plateau des pyramides sous tempête permanente, personnage jouable, glissade et nouveau HUD des points.' },
    { img: 'khamsin', pos: '50% 55%', puce: 'Carte · Khamsin', date: 'Monde ouvert · désert égyptien', titre: 'Le plateau des pyramides', desc: D.cartes[1].texte },
    { img: 'lune', pos: '80% 25%', puce: 'Carte · Ombre éternelle', date: 'Monde ouvert · Lune', titre: 'Ombre éternelle', desc: D.cartes[2].texte },
  ];
  let diapo = 0, minuterie = null;
  $('b-points').innerHTML = DIAPOS.map((_, i) => `<button type="button" aria-label="Diapositive ${i + 1}" data-d="${i}"></button>`).join('');
  function montrer(i, instant) {
    diapo = (i + DIAPOS.length) % DIAPOS.length;
    const d = DIAPOS[diapo], img = $('b-hero-img');
    const poser = () => {
      img.style.backgroundImage = `var(--img-${d.img})`; img.style.backgroundPosition = d.pos;
      $('b-hero-puce').textContent = d.puce; $('b-hero-date').textContent = d.date;
      $('b-hero-titre').textContent = d.titre; $('b-hero-desc').textContent = d.desc;
      img.classList.remove('change');
    };
    $('b-points').querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === diapo)));
    if (instant || !ZSM.animationsActives()) poser(); else { img.classList.add('change'); setTimeout(poser, 280); }
  }
  $('b-points').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { montrer(+b.dataset.d); relancer(); }));
  $('b-prec').addEventListener('click', () => { montrer(diapo - 1); relancer(); });
  $('b-suiv').addEventListener('click', () => { montrer(diapo + 1); relancer(); });
  function relancer() { clearInterval(minuterie); if (ZSM.animationsActives()) minuterie = setInterval(() => { if (section === 'accueil' && !document.hidden) montrer(diapo + 1); }, 8000); }
  montrer(0, true);

  /* ---------------------------------------------------------------- actualités */
  const carteActu = (a, i, compacte) => `
    <button type="button" class="b-actu" data-actu="${i}">
      <div class="b-actu-img" style="${fondImage(a.image)}"><p class="b-puces"><span class="b-exemple">Exemple</span><span class="b-puce-rouge">${esc(a.categorie)}</span></p></div>
      <div class="b-actu-corps"><b>${esc(a.titre)}</b><small>${fmt.date(a.date)}</small>${compacte ? '' : `<p>${esc(a.texte)}</p>`}</div>
    </button>`;
  function lier(racine) {
    racine.querySelectorAll('[data-actu]').forEach((b) => b.addEventListener('click', () => lire(+b.dataset.actu)));
  }
  function lire(i) {
    const a = D.actus[i];
    $('b-lecture-corps').innerHTML = `<div class="b-actu-img" style="${fondImage(a.image)}"></div>
      <p class="b-puces"><span class="b-exemple">Exemple</span><span class="b-puce-rouge">${esc(a.categorie)}</span><span>${fmt.date(a.date)}</span></p>
      <h2>${esc(a.titre)}</h2><p>${esc(a.texte)}</p>
      <p class="b-petit">Contenu d'exemple. Le vrai launcher reçoit ses communiqués avec chaque version publiée (titre, texte, date) ; l'image est une proposition.</p>`;
    $('b-lecture').hidden = false;
  }
  $('b-mini-actus').innerHTML = D.actus.slice(0, 2).map((a, i) => carteActu(a, i, true)).join('');
  lier($('b-mini-actus'));
  const categories = ['Tout', ...new Set(D.actus.map((a) => a.categorie))];
  function dessinerActus() {
    $('b-filtres').innerHTML = categories.map((c) => `<button type="button" aria-pressed="${c === filtre}" data-f="${esc(c)}">${esc(c)}</button>`).join('');
    $('b-filtres').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.f; dessinerActus(); }));
    $('b-grille-actus').innerHTML = D.actus.map((a, i) => (filtre === 'Tout' || a.categorie === filtre ? carteActu(a, i, false) : '')).join('');
    lier($('b-grille-actus'));
  }
  dessinerActus();

  /* ---------------------------------------------------------------- historique */
  function dessinerChrono(e) {
    const inst = e.installe && e.installe.version;
    $('b-chrono').innerHTML = ZSM.historique.map((v, i) => {
      const toutes = ouvertes.has(i), notes = toutes ? v.notes : v.notes.slice(0, 3), reste = v.notes.length - notes.length;
      return `<li class="${v.version === inst ? 'installee' : ''}"><header><b>${v.version}</b><small>${fmt.date(v.date)}</small>
        ${v.version === inst ? '<span class="b-pilule">Installée</span>' : ''}${v.exemple ? '<span class="b-exemple">Exemple</span>' : ''}</header>
        <ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        ${reste > 0 ? `<button type="button" class="b-lien b-plus" data-plus="${i}">Voir les ${reste} autres notes</button>` : ''}</li>`;
    }).join('');
    $('b-chrono').querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', () => { ouvertes.add(+b.dataset.plus); dessinerChrono(ZSM.etat); }));
  }

  /* ---------------------------------------------------------------- contenus fixes */
  $('b-chemin').textContent = D.dossier;
  $('b-cle').textContent = D.source.empreinte; $('b-cle-2').textContent = D.source.empreinte;
  $('b-source').textContent = D.source.url;
  $('b-source-nom').textContent = `Source : ${D.source.nom}`;

  /* ---------------------------------------------------------------- rendu des états */
  function rendu(e) {
    const st = ZSM.statut(e), pr = ZSM.principal(e);
    const v = e.installe ? `${e.installe.version}${e.installe.simule ? ' (simulée)' : ''}` : '—';
    // bouton Jouer et ligne d'état
    const j = $('b-jouer');
    j.dataset.type = pr.type; j.disabled = !pr.actif;
    $('b-jouer-lib').textContent = pr.libelle;
    $('b-jouer-sous').textContent = pr.type === 'maj' ? (e.phase === 'absent' ? `${fmt.taille(D.paquet)} · version ${D.jeu.version}` : e.phase === 'erreur' ? 'Remise en état' : `Vers la ${e.distant.version}`)
      : pr.type === 'progres' ? st.titre : pr.type === 'partie' ? 'Partie en cours' : `Jeu ${v}`;
    $('b-jouer-rempli').style.width = pr.type === 'progres' ? `${(pr.pct || 0) * 100}%` : '0';
    $('b-statut').dataset.ton = st.ton;
    $('b-st-titre').textContent = st.titre;
    $('b-st-detail').textContent = st.detail;
    const liens = $('b-st-liens'); liens.innerHTML = '';
    for (const l of st.liens || []) { const b = document.createElement('button'); b.type = 'button'; b.textContent = l.libelle; b.addEventListener('click', l.action); liens.append(b); }
    // carte d'état de la barre latérale, cloche, pastille, Mod Tools
    $('b-etat-jeu').dataset.ton = st.ton;
    $('b-ej-titre').textContent = e.installe ? `Jeu ${v}` : 'Jeu non installé';
    $('b-ej-detail').textContent = e.phase === 'telechargement' ? `${fmt.pct(e.progres.pct)} · ${fmt.vitesse(e.progres.vitesse)}` : st.titre;
    $('b-v-launcher').textContent = `Launcher ${e.launcherVersion}`;
    const notif = (e.phase === 'maj' ? 1 : 0) + (e.launcherMaj ? 1 : 0);
    $('b-cloche-n').hidden = !notif; $('b-cloche-n').textContent = notif;
    $('b-point-maj').hidden = e.phase !== 'maj';
    $('b-nav-modtools').hidden = !e.auteur;
    $('b-verrou').hidden = e.auteur;
    if (!e.auteur && section === 'modtools') aller('accueil');
    const occupe = ['telechargement', 'signature', 'installation', 'redemarrage', 'partie', 'lancement'].includes(e.phase);
    $('b-bandeau').hidden = !(e.launcherMaj && !occupe);
    if (e.launcherMaj) $('b-bandeau-v').textContent = e.launcherMaj.version;
    // gestionnaire de téléchargement
    const dl = ['telechargement', 'signature', 'installation', 'redemarrage'].includes(e.phase);
    $('b-dl').hidden = !dl;
    if (dl) {
      const p = e.progres, cibleL = e.cible === 'launcher';
      $('b-dl-titre').textContent = e.phase === 'installation' && e.reparation ? 'Réparation de Zombie Survival'
        : cibleL || e.phase === 'redemarrage' ? `Launcher ${D.simule.launcher} (simulé)`
          : `Zombie Survival ${e.distant ? e.distant.version : v}${e.distant && e.distant.simule ? ' (simulée)' : ''}`;
      $('b-dl-detail').textContent = st.detail;
      const att = e.phase !== 'telechargement';
      F.querySelector('.b-dl-barre').classList.toggle('attente', att);
      $('b-dl-rempli').style.width = att ? '' : `${p.pct * 100}%`;
      $('b-dl-pct').textContent = att ? '' : fmt.pct(p.pct);
      $('b-dl-annuler').hidden = e.phase !== 'telechargement';
      const c = (p && p.courbe) || [];
      const max = Math.max(1, ...c);
      $('b-dl-poly').setAttribute('points', c.map((x, i) => `${(i / 39) * 120},${30 - (x / max) * 26}`).join(' '));
      $('b-dl-courbe').style.visibility = att ? 'hidden' : 'visible';
    }
    // pages
    $('b-mini-inst').innerHTML = [['Version', v], ['Construction', e.installe ? String(e.installe.construction) : '—'], ['Taille', fmt.taille(D.tailleInstallee)],
      ['Emplacement', '%APPDATA%'], ['Vérifiée', fmt.depuis(e.verifieA)]].map(([k, x]) => `<dt>${k}</dt><dd>${esc(x)}</dd>`).join('');
    $('b-v-installee').textContent = e.installe ? e.installe.version : '—';
    $('b-v-installee-sous').textContent = e.installe ? `Construction ${e.installe.construction}${e.installe.simule ? ' · simulée' : ''} · vérifiée ${fmt.depuis(e.verifieA)}` : 'Jeu non installé';
    $('b-v-pilule').textContent = e.phase === 'maj' ? 'Mise à jour' : e.installe ? 'À jour' : 'Absent';
    $('b-v-pilule').classList.toggle('maj', e.phase === 'maj');
    $('b-v-dispo').hidden = e.phase !== 'maj';
    if (e.phase === 'maj') { $('b-v-distante').textContent = e.distant.version; $('b-v-distante-sous').textContent = `${e.distant.simule ? 'Version simulée · ' : ''}${fmt.taille(e.distant.taille)} à télécharger`; }
    dessinerChrono(e);
    $('b-chiffres').innerHTML = [[fmt.taille(D.tailleInstallee), 'Taille installée'], [fmt.taille(D.paquet), 'Paquet d’une version (compressé)'],
      [String(D.jeu.editeur), 'Interface des Mod Tools'], [e.installe ? `C${e.installe.construction}` : '—', 'Construction']]
      .map(([b, s]) => `<div class="b-chiffre"><b>${b}</b><span>${s}</span></div>`).join('');
    $('b-versions-ligne').textContent = `Installée : ${v} · précédente gardée : ${e.precedente} (retour possible).`;
    $('b-precedente').textContent = e.precedente;
    F.querySelectorAll('[data-reglage]').forEach((i) => { i.checked = !!e.reglages[i.dataset.reglage]; });
    // écran d'ouverture
    $('b-splash').classList.toggle('fini', e.phase !== 'demarrage');
  }

  function animations(on) { relancer(); if (!on) montrer(diapo, true); }
  aller('accueil');
  ZSM.init({ direction: 'B', nom: 'Launcher AAA moderne', rendu, aller, animations });
})();
