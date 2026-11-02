'use strict';
/* Maquettes du launcher : socle commun aux trois directions.
   - États du vrai launcher (launcher/src/renderer/launcher/launcher.js), simulés : démarrage, vérification, prêt,
     mise à jour, téléchargement, vérification de la signature, installation, redémarrage, partie, hors ligne, erreur,
     jeu absent. Aucun réseau, aucun fichier, aucun jeu lancé.
   - Panneau « Maquette » (touche M) : scénarios, mode auteur, taille de la fenêtre, animations.
   - Cadre de la fenêtre (le launcher n'a pas de bordure Windows : sa barre de titre fait partie du dessin).
   Chaque direction appelle ZSM.init({ direction, nom, rendu, aller, sections }) ; rendu(etat) redessine. */
window.ZSM = (function () {
  const D = window.ZSM_DONNEES;
  const IMG = window.ZSM_IMG || {};
  const NB = ' ';
  const listeners = [];
  let opts = null, timers = [], fenetre = null;

  /* ---------------------------------------------------------------- formats (français de Belgique) */
  const fmt = {
    taille(o) { return o >= 1e6 ? `${(o / 1e6).toLocaleString('fr-BE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}${NB}Mo` : `${Math.round(o / 1e3)}${NB}ko`; },
    vitesse(o) { return `${fmt.taille(o)}/s`; },
    duree(s) { s = Math.max(0, Math.round(s)); return s < 60 ? `${s}${NB}s` : `${Math.floor(s / 60)}${NB}min ${String(s % 60).padStart(2, '0')}${NB}s`; },
    date(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }); },
    dateCourte(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }); },
    heure(d) { return (d || new Date()).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }); },
    depuis(t) {
      const s = (Date.now() - t) / 1000;
      if (s < 45) return 'à l’instant';
      if (s < 3600) return `il y a ${Math.round(s / 60)}${NB}min`;
      return `à ${fmt.heure(new Date(t))}`;
    },
    pct(x) { return `${Math.floor(x * 100)}${NB}%`; },
  };

  /* ---------------------------------------------------------------- état */
  const installeReel = { version: D.jeu.version, construction: D.jeu.construction };
  const etat = {
    phase: 'demarrage', cible: 'jeu', installe: { ...installeReel }, distant: null, precedente: '2.0.4',
    progres: null, erreur: null, launcherMaj: null, launcherVersion: D.launcher, auteur: true,
    verifieA: Date.now(), scenario: 'normal', reglages: { ...D.reglages }, jeuOuvert: false,
  };
  const historique = D.historique.concat((window.ZSM_NOTES_ANCIENNES || []).map((v) => ({ ...v, date: v.date.slice(0, 10) })));

  function changer(p) { Object.assign(etat, p); emettre(); }
  function emettre() { if (opts && opts.rendu) opts.rendu(etat); for (const f of listeners) f(etat); }
  const VITESSE = /[?&]vite/.test(location.search) ? 5 : 1;     // essais automatiques : temps simulé accéléré
  function plus(ms, f) { const t = setTimeout(f, ms / VITESSE); timers.push(t); return t; }
  function arreter() { timers.forEach(clearTimeout); timers = []; }

  /* ---------------------------------------------------------------- scénarios */
  const SCENARIOS = {
    normal: { nom: 'Démarrage normal (à jour)' },
    maj: { nom: 'Mise à jour disponible' },
    premiere: { nom: 'Première installation' },
    'hors-ligne': { nom: 'Hors ligne' },
    erreur: { nom: 'Erreur de téléchargement' },
    launcher: { nom: 'Nouveau launcher' },
  };
  function scenario(nom) {
    arreter();
    etat.scenario = nom;
    Object.assign(etat, { installe: nom === 'premiere' ? null : { ...installeReel }, distant: null, progres: null, erreur: null,
      launcherMaj: null, launcherVersion: D.launcher, jeuOuvert: false });
    changer({ phase: 'demarrage' });
    plus(1300, verifier);
  }
  function verifier() {
    arreter();
    changer({ phase: 'verification', erreur: null });
    plus(1500, () => {
      etat.verifieA = Date.now();
      const s = etat.scenario;
      if (s === 'hors-ligne') return changer({ phase: 'hors-ligne', erreur: { message: 'Serveur de mises à jour injoignable.', contexte: 'check' } });
      const iv = etat.installe && etat.installe.version;
      if (!iv) return changer({ phase: 'absent', distant: { version: D.jeu.version, taille: D.paquet, date: D.jeu.date } });
      // scénarios « mise à jour » et « erreur » : une 2.0.7 fictive est en ligne
      if ((s === 'maj' || s === 'erreur') && iv !== D.simule.jeu) {
        return changer({ phase: 'maj', distant: { version: D.simule.jeu, taille: D.simule.taille, date: '2026-11-15', simule: true } });
      }
      // après un retour à la version précédente : la 2.0.6 réelle est proposée
      if (iv !== D.jeu.version && iv !== D.simule.jeu) {
        return changer({ phase: 'maj', distant: { version: D.jeu.version, taille: D.paquet, date: D.jeu.date } });
      }
      if (s === 'launcher' && etat.launcherVersion === D.launcher) etat.launcherMaj = { version: D.simule.launcher };
      changer({ phase: 'pret', distant: null });
    });
  }
  // téléchargement simulé : vitesse variable (0,6 à 1,6 Mo/s), à 30 images par seconde
  function telecharger(cible) {
    arreter();
    const total = cible === 'launcher' ? 104e6 : (etat.distant ? etat.distant.taille : D.paquet);
    const p = { recu: 0, total, vitesse: 0, eta: 0, pct: 0, courbe: [] };
    changer({ phase: 'telechargement', cible, progres: p, erreur: null });
    let t = 0;
    const pas = () => {
      t += 1 / 30;
      const v = (cible === 'launcher' ? 14e6 : 1.1e6) * (1 + 0.42 * Math.sin(t * 2.3) + 0.18 * Math.sin(t * 7.1));
      p.recu = Math.min(total, p.recu + v / 30);
      p.vitesse = p.vitesse ? p.vitesse * 0.9 + v * 0.1 : v;
      p.eta = (total - p.recu) / p.vitesse; p.pct = p.recu / total;
      if (Math.round(t * 30) % 6 === 0) { p.courbe.push(v); if (p.courbe.length > 40) p.courbe.shift(); }
      if (etat.scenario === 'erreur' && cible === 'jeu' && p.pct > 0.58 && !p.coupe) {
        p.coupe = true;
        return changer({ phase: 'erreur', erreur: { message: 'Téléchargement interrompu : la connexion a été perdue (simulée).', contexte: 'install' } });
      }
      if (p.recu >= total) return cible === 'launcher' ? redemarrer() : verifierSignature();
      emettre();
      plus(1000 / 30, pas);
    };
    plus(1000 / 30, pas);
  }
  function verifierSignature() {
    changer({ phase: 'signature' });
    plus(1100, () => {
      changer({ phase: 'installation' });
      plus(1700, () => {
        const v = etat.distant ? etat.distant.version : D.jeu.version;
        etat.installe = { version: v, construction: 1, simule: v === D.simule.jeu };
        etat.distant = null; etat.progres = null; etat.verifieA = Date.now();
        if (etat.scenario === 'erreur') etat.scenario = 'normal';
        changer({ phase: 'pret' });
        toast(`Version ${v} installée${v === D.simule.jeu ? ' (simulée)' : ''}.`, 'ok');
      });
    });
  }
  function redemarrer() {
    changer({ phase: 'redemarrage', launcherMaj: null });
    plus(1600, () => { etat.launcherVersion = D.simule.launcher; etat.progres = null; changer({ phase: 'demarrage' }); plus(1000, verifier); });
  }

  /* ---------------------------------------------------------------- actions (toutes simulées) */
  const actions = {
    jouer() {
      if (!etat.installe) return;
      arreter();
      changer({ phase: 'lancement' });
      plus(1500, () => {
        changer({ phase: 'partie', jeuOuvert: true });
        toast(`Simulation : la partie n’est pas lancée depuis la maquette. Le vrai launcher ouvre le jeu ${etat.reglages.fullscreen ? 'en plein écran' : 'en fenêtre'}${etat.reglages.keepLauncherOpen ? '' : ' et se réduit'}.`, 'simulation');
      });
    },
    terminerPartie() { etat.jeuOuvert = false; if (etat.reglages.autoCheck) verifier(); else changer({ phase: 'pret' }); },
    mettreAJour() { telecharger('jeu'); },
    installer() { telecharger('jeu'); },
    annuler() { arreter(); changer({ phase: etat.installe ? 'maj' : 'absent', progres: null }); toast('Téléchargement annulé.', 'info'); },
    reessayer() {
      if (etat.erreur && etat.erreur.contexte === 'install') { etat.scenario = 'normal'; return telecharger('jeu'); }
      verifier();
    },
    verifier() { verifier(); },
    reparer() {
      arreter();
      changer({ phase: 'installation', progres: null, reparation: true });
      plus(2000, () => { etat.reparation = false; changer({ phase: 'pret' }); toast('Simulation : jeu vérifié et remis en état (aucun fichier touché).', 'simulation'); });
    },
    revenir() {
      arreter();
      const v = etat.precedente;
      changer({ phase: 'installation', progres: null });
      plus(1600, () => {
        etat.installe = { version: v, construction: 2 };
        toast(`Simulation : retour à la version ${v}.`, 'simulation');
        verifier();
      });
    },
    installerLauncher() { if (etat.launcherMaj) telecharger('launcher'); },
    ouvrirModTools() { toast('Simulation : le vrai launcher ouvre les Mod Tools dans leur propre fenêtre (1 600 × 940).', 'simulation'); },
    ouvrirPublication() { toast('Simulation : le vrai launcher ouvre l’outil de publication (réservé à l’auteur).', 'simulation'); },
    ouvrirDossier() { toast(`Simulation : le vrai launcher ouvre ${D.dossier} dans l’Explorateur.`, 'simulation'); },
    ouvrirJournal() { toast('Simulation : le vrai launcher ouvre son journal (launcher.log).', 'simulation'); },
    lien(url) { toast(`Simulation : lien externe (${url}).`, 'simulation'); },
    reglage(k, v) { etat.reglages[k] = v; emettre(); toast('Réglage enregistré (simulation : rien n’est écrit).', 'simulation'); },
    sourceOfficielle() { toast('Simulation : source officielle rétablie.', 'simulation'); },
  };

  /* Bouton principal : libellé, type et action selon la phase (mêmes règles que le vrai launcher). */
  function principal(e = etat) {
    const p = e.progres;
    switch (e.phase) {
      case 'demarrage': return { libelle: 'Jouer', type: 'jouer', actif: false };
      case 'verification': return { libelle: 'Jouer', type: 'jouer', actif: !!e.installe, action: actions.jouer };
      case 'pret': return { libelle: 'Jouer', type: 'jouer', actif: true, action: actions.jouer };
      case 'maj': return { libelle: 'Mettre à jour', type: 'maj', actif: true, action: actions.mettreAJour };
      case 'absent': return { libelle: 'Installer', type: 'maj', actif: true, action: actions.installer };
      case 'telechargement': return { libelle: fmt.pct(p ? p.pct : 0), type: 'progres', actif: false, pct: p ? p.pct : 0 };
      case 'signature': return { libelle: 'Vérification', type: 'progres', actif: false, pct: 1 };
      case 'installation': return { libelle: 'Installation', type: 'progres', actif: false, pct: 1 };
      case 'redemarrage': return { libelle: 'Redémarrage', type: 'progres', actif: false, pct: 1 };
      case 'lancement': return { libelle: 'Lancement…', type: 'jouer', actif: false };
      case 'partie': return { libelle: 'En jeu', type: 'partie', actif: false };
      case 'hors-ligne': return { libelle: 'Jouer', type: 'jouer', actif: !!e.installe, action: actions.jouer };
      case 'erreur': return e.installe ? { libelle: 'Jouer', type: 'jouer', actif: true, action: actions.jouer } : { libelle: 'Réparer', type: 'maj', actif: true, action: actions.reparer };
      default: return { libelle: 'Jouer', type: 'jouer', actif: false };
    }
  }
  /* Ligne d'état : titre, détail, ton, liens (Annuler, Réessayer, Journal…). */
  function statut(e = etat) {
    const i = e.installe, d = e.distant, p = e.progres;
    const v = i ? `${i.version}${i.simule ? ' (simulée)' : ''}` : '—';
    switch (e.phase) {
      case 'demarrage': return { ton: 'neutre', titre: 'Ouverture du bunker…', detail: '' };
      case 'verification': return { ton: 'occupe', titre: 'Vérification', detail: 'Recherche de mises à jour…', indetermine: true };
      case 'pret': return { ton: 'ok', titre: 'Prêt', detail: `Version ${v} installée · à jour · vérifiée ${fmt.depuis(e.verifieA)}` };
      case 'maj': return { ton: 'maj', titre: 'Mise à jour disponible',
        detail: `Version ${v} → ${d.version}${d.simule ? ' (simulée)' : ''} · ${fmt.taille(d.taille)}`, liens: i ? [{ libelle: `Jouer à la ${i.version}`, action: actions.jouer }] : [] };
      case 'absent': return { ton: 'maj', titre: 'Jeu non installé', detail: `Version ${d ? d.version : D.jeu.version} · téléchargement ${fmt.taille(D.paquet)} · ${fmt.taille(D.tailleInstallee)} une fois installé` };
      case 'telechargement': return { ton: 'occupe', titre: e.cible === 'launcher' ? 'Téléchargement du launcher' : 'Téléchargement',
        detail: `${fmt.taille(p.recu)} sur ${fmt.taille(p.total)} · ${fmt.vitesse(p.vitesse)} · ${fmt.duree(p.eta)} restantes`,
        liens: [{ libelle: 'Annuler', action: actions.annuler }] };
      case 'signature': return { ton: 'occupe', titre: 'Vérification de la signature', detail: `Clé de confiance ${D.source.empreinte}`, indetermine: true };
      case 'installation': return { ton: 'occupe', titre: e.reparation ? 'Réparation' : 'Installation',
        detail: e.reparation ? 'Remise en état du jeu…' : `Version ${d ? d.version : '…'} : vérification et extraction…`, indetermine: true };
      case 'redemarrage': return { ton: 'occupe', titre: 'Redémarrage', detail: 'Installation du nouveau launcher…', indetermine: true };
      case 'lancement': return { ton: 'occupe', titre: 'Lancement', detail: `Zombie Survival ${v}`, indetermine: true };
      case 'partie': return { ton: 'ok', titre: 'Partie en cours', detail: `Version ${v} · simulation`, liens: [{ libelle: 'Terminer la partie (simulation)', action: actions.terminerPartie }] };
      case 'hors-ligne': return { ton: 'neutre', titre: 'Hors ligne', detail: `${e.erreur.message} Version ${v} jouable.`, liens: [{ libelle: 'Réessayer', action: actions.reessayer }] };
      case 'erreur': return { ton: 'erreur', titre: 'Erreur', detail: e.erreur.message,
        liens: [{ libelle: 'Réessayer', action: actions.reessayer }, { libelle: 'Ouvrir le journal', action: actions.ouvrirJournal }] };
      default: return { ton: 'neutre', titre: '', detail: '' };
    }
  }

  /* ---------------------------------------------------------------- notifications */
  function toast(texte, type = 'info') {
    const box = fenetre && (fenetre.querySelector('[data-zsm-toasts]') || fenetre);
    if (!box) return;
    const el = document.createElement('div');
    el.className = `zsm-toast zsm-toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `${type === 'simulation' ? '<b>Simulation</b>' : ''}<span></span>`;
    el.querySelector('span').textContent = texte.replace(/^Simulation : /, '');
    box.append(el);
    requestAnimationFrame(() => el.classList.add('zsm-toast--in'));
    setTimeout(() => { el.classList.remove('zsm-toast--in'); setTimeout(() => el.remove(), 400); }, type === 'simulation' ? 5200 : 3200);
  }

  /* ---------------------------------------------------------------- images (fournies par assembler.py) */
  function svgKhamsin() {
    // illustration de la maquette (pas une image du jeu) : plateau des pyramides sous la tempête
    const s = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360' preserveAspectRatio='xMidYMid slice'>
<defs><linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1a0a07'/><stop offset='.55' stop-color='#6b2410'/><stop offset='1' stop-color='#c2662a'/></linearGradient>
<radialGradient id='s' cx='.68' cy='.42' r='.35'><stop offset='0' stop-color='#ffd9a0' stop-opacity='.85'/><stop offset='.25' stop-color='#ff9a4a' stop-opacity='.35'/><stop offset='1' stop-color='#ff9a4a' stop-opacity='0'/></radialGradient>
<linearGradient id='d' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#7a3a18'/><stop offset='1' stop-color='#2a0f07'/></linearGradient>
<filter id='b'><feGaussianBlur stdDeviation='6'/></filter></defs>
<rect width='640' height='360' fill='url(#c)'/><rect width='640' height='360' fill='url(#s)'/>
<g filter='url(#b)' opacity='.5' fill='none' stroke='#f3c48a'><path d='M-20 120 C 120 90 260 150 420 110 S 640 120 680 90' stroke-width='10'/><path d='M-20 175 C 160 150 300 200 470 160 S 640 170 680 150' stroke-width='6'/></g>
<polygon points='170,262 300,128 430,262' fill='#3a160b'/><polygon points='300,128 430,262 330,262' fill='#5a2410'/>
<polygon points='370,262 470,160 570,262' fill='#30120a'/><polygon points='470,160 570,262 492,262' fill='#4d1f0e'/>
<polygon points='60,262 130,196 200,262' fill='#2a1009'/><polygon points='130,196 200,262 145,262' fill='#43190c'/>
<path d='M0 255 C 120 238 220 262 340 250 S 560 236 640 252 L640 360 L0 360 Z' fill='url(#d)'/>
<g filter='url(#b)' opacity='.55' fill='none' stroke='#e9b27a'><path d='M-20 230 C 140 205 300 250 460 215 S 640 225 680 200' stroke-width='14'/><path d='M-20 300 C 150 280 320 310 500 285 S 640 290 680 280' stroke-width='9'/></g>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  function appliquerImages(racine = document) {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(IMG)) root.style.setProperty(`--img-${k}`, `url("${v}")`);
    racine.querySelectorAll('img[data-img]').forEach((im) => { const v = IMG[im.dataset.img]; if (v && im.src !== v) im.src = v; });
  }
  IMG.khamsin = IMG.khamsin || svgKhamsin();

  /* ---------------------------------------------------------------- panneau « Maquette » et cadre */
  const TAILLES = { '1080x660': '1 080 × 660 (actuelle)', '1280x720': '1 280 × 720 (proposée)', '1600x900': '1 600 × 900', remplir: 'Remplir la page' };
  const maq = { taille: '1280x720', animations: !matchMedia('(prefers-reduced-motion: reduce)').matches };
  function disposer() {
    const bureau = document.querySelector('.zsm-bureau');
    if (!bureau || !fenetre) return;
    bureau.classList.toggle('zsm-remplir', maq.taille === 'remplir');
    if (maq.taille === 'remplir') { bureau.style.paddingRight = ''; fenetre.style.removeProperty('--zsm-w'); fenetre.style.removeProperty('--zsm-h'); fenetre.style.removeProperty('--zsm-s'); return; }
    const [w, h] = maq.taille.split('x').map(Number);
    // le panneau ne doit jamais couvrir le launcher : s'il déborde sur la fenêtre centrée, la fenêtre se décale
    const pan = document.querySelector('.zsm-panneau');
    const panW = pan && !pan.hidden ? pan.offsetWidth + 24 : 0;
    const decale = panW > 0 && (innerWidth - Math.min(w, innerWidth - 32)) / 2 < panW;
    bureau.style.paddingRight = decale ? `${panW}px` : '';
    const s = Math.min(1, (innerWidth - 32 - (decale ? panW : 0)) / w, (innerHeight - 32) / h);
    fenetre.style.setProperty('--zsm-w', `${w}px`); fenetre.style.setProperty('--zsm-h', `${h}px`); fenetre.style.setProperty('--zsm-s', s.toFixed(4));
  }
  function panneau() {
    const p = document.createElement('aside');
    p.className = 'zsm-panneau'; p.setAttribute('aria-label', 'Commandes de la maquette');
    const autres = { A: ['A-militaire.html', 'A · Militaire cinématographique'], B: ['B-aaa-moderne.html', 'B · Launcher AAA moderne'], C: ['C-nouvelle-generation.html', 'C · Nouvelle génération'], D: ['D-hybride.html', 'D · Hybride A+B'] };
    p.innerHTML = `
      <button type="button" class="zsm-p-tete" aria-expanded="true"><b>Maquette</b><span>${opts.direction} · ${opts.nom}</span><i>M</i></button>
      <div class="zsm-p-corps">
        <p class="zsm-p-note">Fonctions simulées : aucun réseau, aucun fichier, aucun jeu lancé. Les contenus d'exemple sont signalés.</p>
        <h4>Scénario</h4>
        <div class="zsm-p-scenarios">${Object.entries(SCENARIOS).map(([k, s]) => `<button type="button" data-scenario="${k}">${s.nom}</button>`).join('')}</div>
        <label class="zsm-p-case"><input type="checkbox" id="zsm-auteur" checked> Mode auteur (clé de publication présente : Mod Tools visibles)</label>
        <h4>Fenêtre</h4>
        <select id="zsm-taille">${Object.entries(TAILLES).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
        <label class="zsm-p-case"><input type="checkbox" id="zsm-anim"> Animations</label>
        <h4>Directions</h4>
        <nav class="zsm-p-liens">${Object.entries(autres).map(([k, [f, n]]) => (k === opts.direction ? `<b>${n}</b>` : `<a href="${f}">${n}</a>`)).join('')}</nav>
      </div>`;
    document.body.append(p);
    const tete = p.querySelector('.zsm-p-tete');
    const basculer = () => { p.classList.toggle('zsm-replie'); tete.setAttribute('aria-expanded', String(!p.classList.contains('zsm-replie'))); disposer(); };
    tete.addEventListener('click', basculer);
    addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && !e.target.closest('input, select, textarea')) basculer(); });
    p.querySelectorAll('[data-scenario]').forEach((b) => b.addEventListener('click', () => scenario(b.dataset.scenario)));
    p.querySelector('#zsm-auteur').addEventListener('change', (e) => changer({ auteur: e.target.checked }));
    const ta = p.querySelector('#zsm-taille'); ta.value = maq.taille;
    ta.addEventListener('change', () => { if (ta.value !== 'perso') { maq.taille = ta.value; disposer(); } });
    const an = p.querySelector('#zsm-anim'); an.checked = maq.animations;
    an.addEventListener('change', () => animations(an.checked));
  }
  /* Fenêtre redimensionnable (direction D) : poignée dans l'angle, de 960 × 600 à la taille de la page. */
  function afficherTaille() {
    const ta = document.getElementById('zsm-taille');
    if (!ta) return;
    let perso = ta.querySelector('option[value="perso"]');
    if (TAILLES[maq.taille]) { ta.value = maq.taille; if (perso) perso.remove(); return; }
    if (!perso) { perso = document.createElement('option'); perso.value = 'perso'; ta.append(perso); }
    perso.textContent = `${maq.taille.replace('x', ' × ')} (personnalisée)`;
    ta.value = 'perso';
  }
  function poignee() {
    const h = document.createElement('div');
    h.className = 'zsm-poignee'; h.title = 'Redimensionner la fenêtre'; h.setAttribute('aria-hidden', 'true');
    fenetre.append(h);
    h.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      h.setPointerCapture(ev.pointerId);
      const s = Number(fenetre.style.getPropertyValue('--zsm-s')) || 1;
      const x0 = ev.clientX, y0 = ev.clientY, w0 = fenetre.offsetWidth, h0 = fenetre.offsetHeight;
      const bouge = (e) => {
        // fenêtre centrée : l'angle suit le pointeur si la taille change du double du déplacement
        const w = Math.round(Math.min(innerWidth - 40, Math.max(960, w0 + (2 * (e.clientX - x0)) / s)));
        const hh = Math.round(Math.min(innerHeight - 40, Math.max(600, h0 + (2 * (e.clientY - y0)) / s)));
        maq.taille = `${w}x${hh}`; disposer(); afficherTaille();
      };
      const fin = () => { h.removeEventListener('pointermove', bouge); h.removeEventListener('pointerup', fin); h.removeEventListener('pointercancel', fin); };
      h.addEventListener('pointermove', bouge); h.addEventListener('pointerup', fin); h.addEventListener('pointercancel', fin);
    });
  }
  function animations(on) {
    maq.animations = on;
    document.documentElement.classList.toggle('zsm-sans-anim', !on);
    if (opts && opts.animations) opts.animations(on);
  }

  function init(o) {
    opts = o;
    fenetre = document.getElementById('zsm-fenetre');
    appliquerImages();
    panneau();
    if (o.redimensionnable) poignee();
    animations(maq.animations);
    disposer();
    addEventListener('resize', disposer);
    const badge = fenetre.querySelector('[data-zsm-badge]');
    if (badge) badge.innerHTML = '<span class="zsm-badge" title="Maquette : les fonctions sont simulées">Maquette · fonctions simulées</span>';
    setInterval(() => { if (etat.phase === 'pret') emettre(); }, 30000);    // « vérifiée il y a … »
    if (!/[?&]capture/.test(location.search)) scenario('normal');
    else { etat.phase = 'pret'; emettre(); }
  }
  /* Pour les captures : poser un état fixe (sans minuterie). */
  function poser(p) {
    arreter();
    const base = { installe: { ...installeReel }, distant: null, progres: null, erreur: null, launcherMaj: null, reparation: false };
    const e = Object.assign(base, p);
    if (e.phase === 'maj' && !e.distant) e.distant = { version: D.simule.jeu, taille: D.simule.taille, date: '2026-11-15', simule: true };
    if (e.phase === 'telechargement' && !e.progres) {
      const tot = D.simule.taille, pct = e.pct || 0.62;
      e.distant = e.distant || { version: D.simule.jeu, taille: tot, date: '2026-11-15', simule: true };
      e.progres = { recu: tot * pct, total: tot, vitesse: 1.18e6, eta: (tot * (1 - pct)) / 1.18e6, pct,
        courbe: Array.from({ length: 40 }, (_, i) => 1.1e6 * (1 + 0.42 * Math.sin(i * 0.46) + 0.18 * Math.sin(i * 1.42))) };
    }
    if (e.phase === 'erreur' && !e.erreur) e.erreur = { message: 'Téléchargement interrompu : la connexion a été perdue (simulée).', contexte: 'install' };
    if (e.phase === 'hors-ligne' && !e.erreur) e.erreur = { message: 'Serveur de mises à jour injoignable.', contexte: 'check' };
    changer(e);
  }
  function maquette(o) {
    // le panneau d'abord : sa place décide du décalage et de l'échelle de la fenêtre (disposer)
    if (o.panneau === false) document.querySelector('.zsm-panneau').hidden = true;
    if (o.animations !== undefined) animations(o.animations);
    if (o.taille) maq.taille = o.taille;
    disposer(); afficherTaille();
  }

  return { D, IMG, etat, historique, fmt, actions, principal, statut, toast, init, poser, maquette, scenario, appliquerImages,
    aller: (s) => opts && opts.aller && opts.aller(s), surEtat: (f) => listeners.push(f), animationsActives: () => maq.animations, taille: () => maq.taille };
})();
