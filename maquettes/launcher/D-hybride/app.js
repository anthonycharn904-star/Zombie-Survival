'use strict';
/* Direction D · Hybride A+B : la navigation et les pages de B, la scène de Bunker 7 de A (lampe, poussière), les
   actualités en bichromie de C ; fenêtre redimensionnable (poignée, bouton Agrandir, double-clic sur la barre). */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = ZSM.D, fmt = ZSM.fmt;
  const F = $('zsm-fenetre');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NOMS = { accueil: 'Accueil', actus: 'Actualités', maj: 'Mises à jour', installation: 'Installation', modtools: 'Mod Tools', reglages: 'Paramètres' };
  let section = 'accueil', filtre = 'Tout', ouvertes = new Set(), tailleAvant = '1280x720';

  /* ---------------------------------------------------------------- navigation et commandes */
  function aller(s) {
    section = s;
    F.querySelectorAll('.d-nav button').forEach((b) => (b.dataset.section === s ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    F.querySelectorAll('.d-page').forEach((p) => { p.hidden = p.dataset.page !== s; });
    $('d-fil').textContent = NOMS[s];
    $('d-lecture').hidden = true;
    $('d-contenu').scrollTop = 0;
    if (s === 'accueil') requestAnimationFrame(placer);
    majFond();
  }
  F.querySelectorAll('[data-section]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.section)));
  F.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.aller)));
  F.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => ZSM.actions[b.dataset.act]()));
  F.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => ZSM.toast(`Simulation : ${b.dataset.sim}.`, 'simulation')));
  F.querySelectorAll('[data-reglage]').forEach((i) => i.addEventListener('change', () => ZSM.actions.reglage(i.dataset.reglage, i.checked)));
  $('d-jouer').addEventListener('click', () => { const p = ZSM.principal(); if (p.actif && p.action) p.action(); });
  $('d-bandeau-btn').addEventListener('click', () => ZSM.actions.installerLauncher());
  $('d-dl-annuler').addEventListener('click', () => ZSM.actions.annuler());
  $('d-lecture-fermer').addEventListener('click', () => { $('d-lecture').hidden = true; });
  $('d-cloche').addEventListener('click', () => {
    const e = ZSM.etat;
    if (e.phase === 'maj') aller('maj');
    else if (e.launcherMaj) ZSM.toast(`Nouveau launcher ${e.launcherMaj.version} disponible (simulé).`, 'info');
    else ZSM.toast('Aucune notification.', 'info');
  });
  // fenêtre : Agrandir (et double-clic sur la barre du haut) bascule entre la taille choisie et toute la page
  function agrandir() {
    const t = ZSM.taille();
    if (t === 'remplir') ZSM.maquette({ taille: tailleAvant }); else { tailleAvant = t; ZSM.maquette({ taille: 'remplir' }); }
  }
  $('d-agrandir').addEventListener('click', agrandir);
  let reduite = false;
  $('d-reduire').addEventListener('click', () => { reduite = true; $('d-reduite').hidden = false; majFond(); });
  $('d-retablir').addEventListener('click', () => { reduite = false; $('d-reduite').hidden = true; majFond(); });
  document.addEventListener('visibilitychange', () => majFond());
  $('d-fond').addEventListener('change', (e) => ZSM.actions.reglage('fond', e.target.value));
  F.querySelector('.d-haut').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) agrandir(); });

  /* ---------------------------------------------------------------- actualités (bichromie) et lecture sur papier */
  const duo = (k, pos) => `<div class="d-duo"><img data-img="${k}" alt="" style="object-position:${pos}"></div>`;
  const posImage = (k) => (k === 'portrait' ? '50% 64%' : k === 'icone' ? '50% 50%' : k === 'bunker' ? '72% 55%' : '50% 60%');
  const carteActu = (a, i, compacte) => `
    <button type="button" class="d-actu" data-actu="${i}">
      <div class="d-actu-img">${duo(a.image === 'icone' ? 'bunker' : a.image, posImage(a.image))}<p class="d-puces"><span class="d-exemple">Exemple</span><span class="d-cat">${esc(a.categorie)}</span></p></div>
      <div class="d-actu-corps"><b>${esc(a.titre)}</b><small>${fmt.date(a.date)}</small>${compacte ? '' : `<p>${esc(a.texte)}</p>`}</div>
    </button>`;
  function lier(racine) { racine.querySelectorAll('[data-actu]').forEach((b) => b.addEventListener('click', () => lire(+b.dataset.actu))); ZSM.appliquerImages(racine); }
  function lire(i) {
    const a = D.actus[i];
    $('d-lecture-corps').innerHTML = `<span class="d-tampon-papier">Exemple</span>
      <p class="d-meta">Transmission ${String(i + 1).padStart(2, '0')} · ${fmt.date(a.date)} · ${esc(a.categorie)}</p>
      <h2>${esc(a.titre)}</h2>
      <div class="d-photo">${duo(a.image === 'icone' ? 'bunker' : a.image, posImage(a.image))}</div>
      <p>${esc(a.texte)}</p>
      <p class="d-note">Contenu d'exemple. Le vrai launcher reçoit ses communiqués avec chaque version publiée (titre, texte, date) ; l'image est une proposition.</p>`;
    ZSM.appliquerImages($('d-lecture-corps'));
    $('d-lecture').hidden = false;
  }
  $('d-mini-actus').innerHTML = D.actus.slice(0, 3).map((a, i) => carteActu(a, i, true)).join('');
  lier($('d-mini-actus'));
  const categories = ['Tout', ...new Set(D.actus.map((a) => a.categorie))];
  function dessinerActus() {
    $('d-filtres').innerHTML = categories.map((c) => `<button type="button" aria-pressed="${c === filtre}" data-f="${esc(c)}">${esc(c)}</button>`).join('');
    $('d-filtres').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.f; dessinerActus(); }));
    $('d-grille-actus').innerHTML = D.actus.map((a, i) => (filtre === 'Tout' || a.categorie === filtre ? carteActu(a, i, false) : '')).join('');
    lier($('d-grille-actus'));
  }
  dessinerActus();

  /* ---------------------------------------------------------------- cartes (théâtres d'opérations) */
  $('d-zones').innerHTML = D.cartes.map((c, i) => `<li><button type="button" data-carte="${c.id}">
    <img data-img="${c.image || 'khamsin'}" alt="" style="object-position:${c.id === 'bunker7' ? '78% 62%' : c.id === 'ombre' ? '85% 22%' : '50% 60%'}">
    <span><small>Zone ${i + 1} · ${esc(c.lieu)}</small><b>${esc(c.nom)}</b><span>${esc(c.genre)}</span></span></button></li>`).join('');
  F.querySelectorAll('[data-carte]').forEach((b) => b.addEventListener('click', () => {
    const c = D.cartes.find((x) => x.id === b.dataset.carte);
    ZSM.toast(`${c.nom} : ${c.texte} La carte se choisit dans le menu Jouer du jeu.`, 'info');
  }));

  /* ---------------------------------------------------------------- historique */
  function dessinerChrono(e) {
    const inst = e.installe && e.installe.version;
    $('d-chrono').innerHTML = ZSM.historique.map((v, i) => {
      const toutes = ouvertes.has(i), notes = toutes ? v.notes : v.notes.slice(0, 3), reste = v.notes.length - notes.length;
      return `<li class="${v.version === inst ? 'installee' : ''}"><header><b>${v.version}</b><small>${fmt.date(v.date)}</small>
        ${v.version === inst ? '<em class="d-tampon">Installée</em>' : ''}${v.exemple ? '<span class="d-exemple">Exemple</span>' : ''}</header>
        <ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        ${reste > 0 ? `<button type="button" class="d-lien" data-plus="${i}">Voir les ${reste} autres notes</button>` : ''}</li>`;
    }).join('');
    $('d-chrono').querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', () => { ouvertes.add(+b.dataset.plus); dessinerChrono(ZSM.etat); }));
  }

  /* ---------------------------------------------------------------- contenus fixes */
  $('d-chemin').textContent = D.dossier;
  $('d-sceau-cle').textContent = D.source.empreinte;
  $('d-cle').textContent = D.source.empreinte;
  $('d-source').textContent = D.source.url;
  $('d-ouv-cle').textContent = D.source.empreinte;
  $('d-bande').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="--i:${i}"></i>`).join('');

  /* ---------------------------------------------------------------- rendu des états */
  function rendu(e) {
    const st = ZSM.statut(e), pr = ZSM.principal(e);
    const v = e.installe ? `${e.installe.version}${e.installe.simule ? ' (simulée)' : ''}` : '—';
    // bouton Jouer et ligne d'état du bandeau
    const j = $('d-jouer');
    j.dataset.type = pr.type; j.disabled = !pr.actif;
    $('d-jouer-lib').textContent = pr.libelle;
    $('d-jouer-sous').textContent = pr.type === 'maj' ? (e.phase === 'absent' ? `${fmt.taille(D.paquet)} · version ${D.jeu.version}` : e.phase === 'erreur' ? 'Remise en état' : `Vers la ${e.distant.version}`)
      : pr.type === 'progres' ? st.titre : pr.type === 'partie' ? 'Partie en cours' : `Déploiement · jeu ${v}`;
    $('d-jouer-rempli').style.width = pr.type === 'progres' ? `${(pr.pct || 0) * 100}%` : '0';
    $('d-statut').dataset.ton = st.ton;
    $('d-st-titre').textContent = st.titre;
    $('d-st-detail').textContent = st.detail;
    const liens = $('d-st-liens'); liens.innerHTML = '';
    for (const l of st.liens || []) { const b = document.createElement('button'); b.type = 'button'; b.textContent = l.libelle; b.addEventListener('click', l.action); liens.append(b); }
    $('d-mission-v').textContent = `Jeu ${v}`;
    // pied de la barre latérale : état et plaques
    $('d-etat').dataset.ton = st.ton;
    $('d-etat-titre').textContent = st.titre;
    $('d-etat-detail').textContent = e.phase === 'telechargement' ? `${fmt.pct(e.progres.pct)} · ${fmt.vitesse(e.progres.vitesse)}` : e.installe ? `vérifié ${fmt.depuis(e.verifieA)}` : 'jeu non installé';
    $('d-v-jeu').textContent = e.installe ? e.installe.version : '—';
    $('d-v-jeu-sous').textContent = e.installe ? (e.installe.simule ? 'simulée' : `construction ${e.installe.construction}`) : 'non installé';
    $('d-v-launcher').textContent = e.launcherVersion;
    // notifications, Mod Tools, bandeau du launcher
    const notif = (e.phase === 'maj' ? 1 : 0) + (e.launcherMaj ? 1 : 0);
    $('d-cloche-n').hidden = !notif; $('d-cloche-n').textContent = notif;
    $('d-point-maj').hidden = e.phase !== 'maj';
    $('d-nav-modtools').hidden = !e.auteur;
    $('d-verrou').hidden = e.auteur;
    if (!e.auteur && section === 'modtools') aller('accueil');
    const occupe = ['telechargement', 'signature', 'installation', 'redemarrage', 'partie', 'lancement'].includes(e.phase);
    $('d-bandeau').hidden = !(e.launcherMaj && !occupe);
    if (e.launcherMaj) $('d-bandeau-v').textContent = e.launcherMaj.version;
    // gestionnaire de téléchargement : bande de cartouches et courbe de débit
    const dl = ['telechargement', 'signature', 'installation', 'redemarrage'].includes(e.phase);
    $('d-dl').hidden = !dl;
    if (dl) {
      const p = e.progres, att = e.phase !== 'telechargement';
      $('d-dl-titre').textContent = e.phase === 'installation' && e.reparation ? 'Réparation de Zombie Survival'
        : e.cible === 'launcher' || e.phase === 'redemarrage' ? `Launcher ${D.simule.launcher} (simulé)`
          : `Zombie Survival ${e.distant ? e.distant.version : v}${e.distant && e.distant.simule ? ' (simulée)' : ''}`;
      $('d-dl-detail').textContent = st.detail;
      const bande = $('d-bande'), n = bande.children.length, on = att ? 0 : Math.round(p.pct * n);
      bande.classList.toggle('attente', att);
      [...bande.children].forEach((c, k) => c.classList.toggle('on', k < on));
      $('d-dl-pct').textContent = att ? '' : fmt.pct(p.pct);
      $('d-dl-annuler').hidden = e.phase !== 'telechargement';
      const c = (p && p.courbe) || [], max = Math.max(1, ...c);
      $('d-dl-poly').setAttribute('points', c.map((x, i) => `${(i / 39) * 120},${30 - (x / max) * 26}`).join(' '));
      $('d-dl-courbe').style.visibility = att ? 'hidden' : 'visible';
    }
    // pages
    $('d-v-installee').textContent = e.installe ? e.installe.version : '—';
    $('d-v-installee-sous').textContent = e.installe ? `Construction ${e.installe.construction}${e.installe.simule ? ' · simulée' : ''} · vérifiée ${fmt.depuis(e.verifieA)}` : 'Jeu non installé';
    const tampon = $('d-v-tampon');
    tampon.textContent = e.phase === 'maj' ? 'Mise à jour' : e.installe ? 'À jour' : 'Absent';
    tampon.classList.toggle('ok', e.phase !== 'maj' && !!e.installe);
    $('d-v-dispo').hidden = e.phase !== 'maj';
    if (e.phase === 'maj') { $('d-v-distante').textContent = e.distant.version; $('d-v-distante-sous').textContent = `${e.distant.simule ? 'Version simulée · ' : ''}${fmt.taille(e.distant.taille)} à télécharger`; }
    dessinerChrono(e);
    $('d-chiffres').innerHTML = [[fmt.taille(D.tailleInstallee), 'Taille installée'], [fmt.taille(D.paquet), 'Paquet d’une version (compressé)'],
      [String(D.jeu.editeur), 'Interface des Mod Tools'], [e.installe ? `C${e.installe.construction}` : '—', 'Construction']]
      .map(([b, s]) => `<div class="d-chiffre"><b>${b}</b><span>${s}</span></div>`).join('');
    $('d-versions-ligne').textContent = `Installée : ${v} · précédente gardée : ${e.precedente} (retour possible).`;
    $('d-precedente').textContent = e.precedente;
    F.querySelectorAll('[data-reglage]').forEach((i) => { i.checked = !!e.reglages[i.dataset.reglage]; });
    $('d-fond').value = e.reglages.fond || 'marais';
    const vol = $('d-volume'), sonsOn = !!e.reglages.fondSons && !vol.dataset.aucun;
    vol.value = e.reglages.volumeSons ?? 80; $('d-volume-val').textContent = vol.value + ' %'; vol.style.setProperty('--v', vol.value + '%');
    vol.disabled = !sonsOn; vol.closest('label').classList.toggle('d-inactif', !sonsOn);
    majFond();
    // ouverture et veille
    const ouv = $('d-ouverture');
    if (e.phase === 'demarrage') { ouv.classList.remove('fini'); ouv.querySelectorAll('p').forEach((p) => { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; }); }
    else ouv.classList.add('fini');
    $('d-veille').hidden = e.phase !== 'partie';
  }

  /* ---------------------------------------------------------------- scène du bandeau : lampe et poussière (de A) */
  const hero = $('d-hero'), cv = $('d-poussiere'), cx = cv.getContext('2d');
  const lampe = { x: 0, y: 0, s: 1 };
  let grains = [], anim = true, dernier = 0;
  function hasard(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function placer() {
    const W = hero.clientWidth, H = hero.clientHeight;
    if (!W || !H) return;
    const iw = 2160, ih = 1320, s = Math.max(W / iw, H / ih);          // object-fit: cover ; object-position: 62 % 45 %
    lampe.x = (W - iw * s) * 0.62 + 1107 * s; lampe.y = (H - ih * s) * 0.45 + 437 * s; lampe.s = s;
    $('d-lampe').style.left = `${lampe.x}px`; $('d-lampe').style.top = `${lampe.y}px`;
    const r = devicePixelRatio || 1;
    cv.width = Math.round(W * r); cv.height = Math.round(H * r); cx.setTransform(r, 0, 0, r, 0, 0);
    const h = hasard(7);
    grains = Array.from({ length: 55 }, () => {
      const t = h(), y = lampe.y + 10 + t * (H * 0.92 - lampe.y), demi = (y - lampe.y) * 0.6;
      return { x: lampe.x + (h() * 2 - 1) * demi, y, vx: (h() - 0.5) * 0.1, vy: (h() - 0.35) * 0.07, r: 0.5 + h() * 1.5, a: 0.12 + h() * 0.4, ph: h() * 6.28 };
    });
    dessiner(0);
  }
  function dessiner(t) {
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
    if (!anim) return;
    if (t - dernier > 33 && section === 'accueil' && !document.hidden && fondActuel() === 'bunker') {
      dernier = t;
      const H = hero.clientHeight;
      for (const p of grains) {
        p.x += p.vx; p.y += p.vy;
        const demi = (p.y - lampe.y) * 0.6;
        if (p.y > H * 0.95 || p.y < lampe.y + 6 || Math.abs(p.x - lampe.x) > demi * 1.1) { p.y = lampe.y + 20 + Math.random() * (H * 0.7 - lampe.y); p.x = lampe.x + (Math.random() * 2 - 1) * (p.y - lampe.y) * 0.5; }
      }
      dessiner(t);
    }
    requestAnimationFrame(boucle);
  }
  function animations(on) { anim = on; if (on) requestAnimationFrame(boucle); else dessiner(0); majFond(); }
  new ResizeObserver(placer).observe(hero);

  /* ---------------------------------------------------------------- fond animé : Marécages maudits (marais.js) */
  // les sons de l'ambiance (ambiance.js) suivent la scène : l'intensité de sa pluie, ses éclairs
  const sons = window.Ambiance && Ambiance.disponible ? Ambiance : null;
  const ecoute = sons ? { intensite: (i) => sons.intensite(i), eclair: (e) => sons.eclair(e) } : null;
  // la vraie scène capturée dans le jeu du kit (vidéo, et la même sans éclairs) si elle est fournie, sinon la scène 2D
  const video = window.FondVideo && ZSM.IMG.marais_video
    ? FondVideo.create(hero, ZSM.IMG.marais_video, ZSM.IMG.marais_affiche, { sans: ZSM.IMG.marais_video_sans, boucle: window.ZSM_FOND_BOUCLE, ecoute }) : null;
  const scene2d = !video && window.Marais && ZSM.IMG.marais ? Marais.create($('d-scene'), $('d-scene-img'), { ecoute }) : null;
  const scene = video || scene2d;
  if (video) hero.classList.add('avec-video');
  const TEXTES = {
    marais: ['Transmission interceptée · Marécages maudits · en développement', video
      ? 'Marécages maudits · la Mère-Vase se jette sur les Noyés · scène du jeu (kit 2.0.7), sous l’orage'
      : 'Marécages maudits · la Mère-Vase se jette sur un Noyé · capture du kit 2.0.7 (retournée) · pluie et orage d’après le kit'],
    bunker: ['Rapport d’incident · Bunker 7 · nuit du 14 décembre', ''],
  };
  function fondActuel() { return scene && (ZSM.etat.reglages.fond || 'marais') === 'marais' ? 'marais' : 'bunker'; }
  function majFond() {
    const f = fondActuel(), e = ZSM.etat;
    if (hero.dataset.fond !== f) { hero.dataset.fond = f; $('d-sur').textContent = TEXTES[f][0]; $('d-legende').textContent = TEXTES[f][1]; }
    if (!scene) return;
    // la scène ne tourne que si on la voit : accueil, fenêtre ouverte et visible, pas de partie en cours
    const visible = f === 'marais' && section === 'accueil' && !document.hidden && !reduite && e.phase !== 'partie';
    scene.regler({ actif: visible, anim: ZSM.animationsActives() && e.reglages.fondAnime !== false, eclairs: e.reglages.fondEclairs !== false });
    // le son, s'il est allumé, seulement quand la scène est visible ; le tonnerre suit les éclairs (pas d'éclair, pas
    // de tonnerre), la pluie reste sur l'image fixe
    if (sons) sons.regler({ veut: !!e.reglages.fondSons, visible, volume: (e.reglages.volumeSons ?? 80) / 100 });
  }
  window.D_FOND = { scene: () => scene, actuel: fondActuel, video: () => !!video, sons: () => sons };   // pour les essais
  // réglages des sons : sans sons exportés, l'interrupteur reste inactif ; le volume, en direct, sans message à chaque pas
  const volume = $('d-volume');
  if (!sons) {
    const l = F.querySelector('[data-reglage="fondSons"]');
    l.disabled = true; l.closest('label').classList.add('d-inactif');
    l.closest('label').querySelector('small').textContent = 'Sons non exportés (scene-bete/exporter-sons.js) : rien à jouer';
    volume.dataset.aucun = '1';
  }
  volume.addEventListener('input', () => { if (sons) sons.regler({ volume: +volume.value / 100 }); $('d-volume-val').textContent = volume.value + ' %'; volume.style.setProperty('--v', volume.value + '%'); });
  volume.addEventListener('change', () => ZSM.actions.reglage('volumeSons', +volume.value));

  /* ---------------------------------------------------------------- heure de Bruxelles */
  const heure = () => { $('d-heure').textContent = fmt.heure(); };
  heure(); setInterval(heure, 15000);

  ZSM.etat.reglages.fondAnime = true;
  ZSM.etat.reglages.fondEclairs = true;
  ZSM.etat.reglages.fondSons = false;                                 // le launcher démarre en silence
  ZSM.etat.reglages.volumeSons = 80;                                 // le volume général du jeu par défaut (SETTINGS_DEFAULT.master)
  ZSM.etat.reglages.fond = 'marais';
  aller('accueil');
  ZSM.init({ direction: 'D', nom: 'Hybride A+B', rendu, aller, animations, redimensionnable: true });
  placer();
})();
