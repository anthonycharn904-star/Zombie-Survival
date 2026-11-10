'use strict';
/* Direction A · Militaire cinématographique : navigation, rendu des états, scène (lampe, poussière, heure). */
(function () {
  const $ = (id) => document.getElementById(id);
  const D = ZSM.D, fmt = ZSM.fmt;
  const F = $('zsm-fenetre');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let section = 'accueil', actuSel = 0, versionSel = 0;

  /* ---------------------------------------------------------------- navigation et commandes */
  function aller(s) {
    section = s;
    F.querySelectorAll('.a-index > button').forEach((b) => (b.dataset.section === s ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    F.querySelectorAll('.a-page').forEach((p) => { p.hidden = p.dataset.page !== s; });
  }
  F.querySelectorAll('[data-section]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.section)));
  F.querySelectorAll('[data-aller]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.aller)));
  F.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => ZSM.actions[b.dataset.act]()));
  F.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => ZSM.toast(`Simulation : ${b.dataset.sim}.`, 'simulation')));
  F.querySelectorAll('[data-reglage]').forEach((i) => i.addEventListener('change', () => ZSM.actions.reglage(i.dataset.reglage, i.checked)));
  $('a-alerte-btn').addEventListener('click', () => ZSM.actions.installerLauncher());
  $('a-jouer').addEventListener('click', () => { const p = ZSM.principal(); if (p.actif && p.action) p.action(); });

  /* ---------------------------------------------------------------- contenus */
  const actus = D.actus.slice();                          // ordre choisi par l'éditeur (le plus important d'abord)
  const telex = actus[0];
  $('a-telex-date').textContent = fmt.dateCourte(telex.date);
  $('a-telex-titre').textContent = telex.titre;
  $('a-telex-texte').textContent = telex.texte;

  $('a-photos').innerHTML = D.cartes.map((c, i) => `
    <figure class="a-photo-carte" tabindex="0" data-carte="${c.id}">
      <img data-img="${c.image || 'khamsin'}" alt="" style="object-position:${c.id === 'bunker7' ? '78% 62%' : c.id === 'ombre' ? '85% 20%' : '50% 60%'}">
      <figcaption><b>${esc(c.nom)}</b><span>Zone ${i + 1} · ${esc(c.genre.toLowerCase())}</span></figcaption>
    </figure>`).join('');
  F.querySelectorAll('[data-carte]').forEach((f) => f.addEventListener('click', () => {
    const c = D.cartes.find((x) => x.id === f.dataset.carte);
    ZSM.toast(`${c.nom} : ${c.texte} La carte se choisit dans le menu Jouer du jeu.`, 'info');
  }));

  function dessinerActus() {
    $('a-actus-liste').innerHTML = actus.map((a, i) => `
      <li role="option" aria-selected="${i === actuSel}" data-i="${i}"><small>Transmission ${String(actus.length - i).padStart(2, '0')} · ${fmt.dateCourte(a.date)} · ${esc(a.categorie)}</small><b>${esc(a.titre)}</b></li>`).join('');
    const a = actus[actuSel];
    $('a-actus-feuille').innerHTML = `<span class="a-tampon">Exemple</span>
      <p class="a-meta">Transmission ${String(actus.length - actuSel).padStart(2, '0')} · ${fmt.date(a.date)} · ${esc(a.categorie)}</p>
      <h3>${esc(a.titre)}</h3><p>${esc(a.texte)}</p>
      <p class="a-note">Contenu d'exemple. Le vrai launcher affiche les communiqués publiés avec chaque version (titre, texte, date).</p>`;
    $('a-actus-liste').querySelectorAll('li').forEach((li) => li.addEventListener('click', () => { actuSel = +li.dataset.i; dessinerActus(); }));
  }
  function dessinerVersions(e) {
    const inst = e.installe && e.installe.version;
    const liste = ZSM.historique;
    $('a-maj-liste').innerHTML = liste.map((v, i) => `
      <li role="option" aria-selected="${i === versionSel}" data-i="${i}"><b>${v.version}</b><small>${fmt.dateCourte(v.date)}</small>${v.version === inst ? '<em>Installée</em>' : ''}</li>`).join('');
    const v = liste[versionSel];
    $('a-maj-feuille').innerHTML = `<span class="a-tampon">${v.version === inst ? 'Installée' : 'Publiée'}</span>
      <p class="a-meta">Rapport de version · publié le ${fmt.date(v.date)}</p>
      <h3>Jeu ${v.version}</h3>
      <ul>${v.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <p class="a-note">${v.exemple ? 'Résumé d’après le README (exemple) : les notes publiées par Anthony peuvent différer.' : 'Notes publiées avec cette version.'}</p>`;
    $('a-maj-liste').querySelectorAll('li').forEach((li) => li.addEventListener('click', () => { versionSel = +li.dataset.i; dessinerVersions(ZSM.etat); }));
  }
  function dessinerManifeste(e) {
    const i = e.installe;
    const lignes = [
      ['Emplacement', D.dossier],
      ['Version installée', i ? `${i.version}${i.simule ? ' (simulée)' : ''} · construction ${i.construction}` : 'aucune'],
      ['Interface des Mod Tools', String(D.jeu.editeur)],
      ['Taille installée', fmt.taille(D.tailleInstallee)],
      ['Paquet d’une version', `${fmt.taille(D.paquet)} (compressé)`],
      ['Version précédente', `${e.precedente} (gardée pour un retour)`],
      ['Dernière vérification', fmt.depuis(e.verifieA)],
      ['Source', D.source.nom],
    ];
    $('a-manifeste').innerHTML = lignes.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }
  $('a-sceau-cle').textContent = D.source.empreinte;
  $('a-boot-cle').textContent = D.source.empreinte;
  $('a-source').textContent = D.source.url;
  $('a-cle').textContent = D.source.empreinte;
  $('a-bande').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  dessinerActus();

  /* ---------------------------------------------------------------- rendu des états */
  function rendu(e) {
    const st = ZSM.statut(e), pr = ZSM.principal(e);
    const term = $('a-terminal');
    term.dataset.ton = st.ton;
    $('a-st-titre').textContent = st.titre;
    $('a-st-detail').textContent = st.detail; $('a-st-detail').title = st.detail;
    // bande de cartouches : pleine quand le jeu est prêt, vide sans jeu, remplie au téléchargement
    const bande = $('a-bande'), n = bande.children.length;
    let on = e.installe ? n : 0;
    if (e.phase === 'telechargement') on = Math.round(e.progres.pct * n);
    bande.classList.toggle('attente', !!st.indetermine);
    [...bande.children].forEach((c, k) => c.classList.toggle('on', !st.indetermine && k < on));
    $('a-liens').innerHTML = '';
    for (const l of st.liens || []) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = l.libelle; b.addEventListener('click', l.action); $('a-liens').append(b);
    }
    // bouton principal
    const j = $('a-jouer');
    j.dataset.type = pr.type; j.disabled = !pr.actif;
    $('a-jouer-lib').textContent = pr.libelle;
    $('a-jouer-rempli').style.width = pr.type === 'progres' ? `${(pr.pct || 0) * 100}%` : '0';
    const v = e.installe ? e.installe.version : '—';
    $('a-jouer-sous').textContent = pr.type === 'jouer' ? `Déploiement · jeu ${v}`
      : pr.type === 'maj' ? (e.phase === 'absent' ? `${fmt.taille(D.paquet)} à télécharger` : e.phase === 'erreur' ? 'Remise en état' : `Vers la ${e.distant.version}`)
      : pr.type === 'partie' ? 'Partie en cours' : st.titre;
    // plaques, pastille, Mod Tools, bandeau du launcher
    $('a-v-jeu').textContent = e.installe ? e.installe.version : '—';
    $('a-v-jeu-sous').textContent = e.installe ? (e.installe.simule ? 'simulée' : `construction ${e.installe.construction}`) : 'non installé';
    $('a-v-launcher').textContent = e.launcherVersion;
    $('a-ordre-v').textContent = `Jeu ${v}`;
    $('a-pastille-maj').hidden = e.phase !== 'maj';
    $('a-nav-modtools').hidden = !e.auteur;
    $('a-verrou').hidden = e.auteur;
    if (!e.auteur && section === 'modtools') aller('accueil');
    const occupe = ['telechargement', 'signature', 'installation', 'redemarrage', 'partie', 'lancement'].includes(e.phase);
    $('a-alerte').hidden = !(e.launcherMaj && !occupe);
    if (e.launcherMaj) $('a-alerte-v').textContent = e.launcherMaj.version;
    // démarrage et partie
    const boot = $('a-boot');
    if (e.phase === 'demarrage') { boot.hidden = false; boot.classList.remove('fini'); boot.querySelectorAll('p').forEach((p) => { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; }); }
    else boot.classList.add('fini');
    $('a-veille').hidden = e.phase !== 'partie';
    // pages
    $('a-maj-etat').textContent = e.phase === 'maj' ? `Version installée ${v} · la ${e.distant.version}${e.distant.simule ? ' (simulée)' : ''} est disponible`
      : e.installe ? `Version installée ${v} · à jour` : 'Jeu non installé';
    dessinerVersions(e);
    dessinerManifeste(e);
    $('a-precedente').textContent = e.precedente;
    F.querySelectorAll('[data-reglage]').forEach((i) => { i.checked = !!e.reglages[i.dataset.reglage]; });
  }

  /* ---------------------------------------------------------------- scène : lampe et poussière */
  const lampe = { x: 0, y: 0, s: 1 };
  const cv = $('a-poussiere'), cx = cv.getContext('2d');
  let grains = [], anim = true, dernier = 0;
  function hasard(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function placer() {
    const W = F.clientWidth, H = F.clientHeight, iw = 2160, ih = 1320, s = Math.max(W / iw, H / ih);
    lampe.x = (W - iw * s) / 2 + 1107 * s; lampe.y = (H - ih * s) / 2 + 437 * s; lampe.s = s;
    $('a-lampe').style.left = `${lampe.x}px`; $('a-lampe').style.top = `${lampe.y}px`;
    const r = devicePixelRatio || 1;
    cv.width = Math.round(W * r); cv.height = Math.round(H * r); cx.setTransform(r, 0, 0, r, 0, 0);
    const h = hasard(7);
    grains = Array.from({ length: 70 }, () => {
      const t = h(), y = lampe.y + 10 + t * (H * 0.82 - lampe.y), demi = (y - lampe.y) * 0.62;
      return { x: lampe.x + (h() * 2 - 1) * demi, y, vx: (h() - 0.5) * 0.12, vy: (h() - 0.35) * 0.08, r: 0.5 + h() * 1.7, a: 0.12 + h() * 0.45, ph: h() * 6.28 };
    });
    dessiner(0);
  }
  function dessiner(t) {
    const W = F.clientWidth, H = F.clientHeight;
    cx.clearRect(0, 0, W, H);
    // cône de lumière, très léger
    const g = cx.createLinearGradient(0, lampe.y, 0, H * 0.9);
    g.addColorStop(0, 'rgba(255, 220, 160, .10)'); g.addColorStop(1, 'rgba(255, 220, 160, 0)');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(lampe.x - 18 * lampe.s * 2, lampe.y); cx.lineTo(lampe.x + 18 * lampe.s * 2, lampe.y);
    cx.lineTo(lampe.x + (H * 0.9 - lampe.y) * 0.62, H * 0.9); cx.lineTo(lampe.x - (H * 0.9 - lampe.y) * 0.62, H * 0.9); cx.closePath(); cx.fill();
    for (const p of grains) {
      const demi = Math.max(20, (p.y - lampe.y) * 0.62), dx = Math.abs(p.x - lampe.x) / demi;
      const a = p.a * Math.max(0, 1 - dx) * (0.65 + 0.35 * Math.sin(t / 900 + p.ph));
      if (a <= 0.01) continue;
      cx.fillStyle = `rgba(255, 228, 185, ${a.toFixed(3)})`;
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
    }
  }
  function boucle(t) {
    if (!anim) return;
    if (t - dernier > 33) {
      dernier = t;
      const H = F.clientHeight;
      for (const p of grains) {
        p.x += p.vx; p.y += p.vy;
        const demi = (p.y - lampe.y) * 0.62;
        if (p.y > H * 0.86 || p.y < lampe.y + 6 || Math.abs(p.x - lampe.x) > demi * 1.1) { p.y = lampe.y + 20 + Math.random() * (H * 0.6 - lampe.y); p.x = lampe.x + (Math.random() * 2 - 1) * (p.y - lampe.y) * 0.5; }
      }
      dessiner(t);
    }
    requestAnimationFrame(boucle);
  }
  function animations(on) { anim = on; if (on) requestAnimationFrame(boucle); else dessiner(0); }
  addEventListener('resize', placer);
  new ResizeObserver(placer).observe(F);

  /* ---------------------------------------------------------------- heure de Bruxelles */
  const heure = () => { $('a-heure').textContent = fmt.heure(); };
  heure(); setInterval(heure, 15000);

  aller('accueil');
  ZSM.init({ direction: 'A', nom: 'Militaire cinématographique', rendu, aller, animations });
  placer();
})();
