'use strict';
/* Lecteur du fond vidéo « Les Marécages Maudits » de l'accueil : la scène capturée dans le jeu du kit 2.0.7 (la
   Mère-Vase se jette sur les Noyés ; maquettes/launcher/scene-bete), repris de la maquette D (D-hybride/fond-video.js).
   La vidéo boucle sans coupure (fondu cuit dans le fichier par encoder.js) ; muette ; elle ne joue que si on la voit
   (accueil, fenêtre visible et au premier plan, pas de partie) et si l'animation est permise ; sinon, l'image fixe
   (affiche). Fenêtre restée à l'écran mais passée à l'arrière-plan (o.garder) : arrêt sur l'image en cours, sans
   repasser par l'affiche (pas de saut), et reprise de cette image.
   Préchargement : l'en-tête seulement, tant qu'aucune lecture n'est demandée (fond de Bunker 7, fond fixe : aucun
   décodage) ; la vidéo entière dès qu'elle doit jouer.
   - Éclairs coupés : la même scène sans éclairs (o.sans, même passage de jeu).
   - Le tonnerre (o.ecoute, ambiance.js) part sur les éclairs de la boucle (o.boucle.eclairs) : pas d'éclair, pas de
     tonnerre.
   - Sans saut entre l'affiche et la vidéo (demande d'Anthony du 2 novembre 2026) : l'affiche est l'image de l'instant
     fondu / fps de la boucle ; chaque lecture qui part de l'affiche repart de cet instant, et l'affiche ne s'efface qu'à
     la première image présentée.
   - Passage avec ou sans éclairs sans coupure (même demande) : un lecteur par version, superposés, celui qui n'est pas
     montré en retrait (transparent, à l'arrêt). En lecture, le lecteur en retrait se cale sur une image un peu à venir
     (avance apprise selon la durée de sa recherche), puis prend le relais quand le lecteur montré présente l'image juste
     avant. À l'arrêt, l'affiche couvre tout : la bascule est immédiate.
   - Vidéo illisible (fichier absent, décodage refusé) : o.panne() ; le launcher prend alors le fond de Bunker 7. */
window.FondVideo = (function () {
  // la distance de l'éclair (chronologie de la capture) → la force que l'ambiance attend (ambiance.js, choisir)
  const force = (d) => (d <= 2500 ? 1.15 : d <= 3200 ? 1 : 0.8);
  function create(hero, src, affiche, o = {}) {
    let enPanne = false;
    const panne = () => { if (!enPanne) { enPanne = true; if (o.panne) o.panne(); } };
    const lecteur = (source) => {
      const x = document.createElement('video');
      x.className = 'd-hero-video'; x.muted = true; x.loop = true; x.playsInline = true; x.preload = 'metadata';
      x.setAttribute('aria-hidden', 'true');
      x.addEventListener('error', panne);
      x.src = source;
      if (affiche) x.poster = affiche;
      return x;
    };
    const L = { avec: lecteur(src) };
    if (o.sans) { L.sans = lecteur(o.sans); L.sans.classList.add('en-retrait'); }
    const img = document.createElement('img');
    img.className = 'd-hero-affiche'; img.alt = ''; img.setAttribute('aria-hidden', 'true');
    if (affiche) img.src = affiche;
    const avant = hero.querySelector('.d-hero-voile');
    for (const k of Object.keys(L)) hero.insertBefore(L[k], avant);
    hero.insertBefore(img, avant);
    let actif = false, garder = false, anim = true, eclairs = true, version = 'avec', prec = -1, tonnerres = 0;
    let v = L.avec;                                     // le lecteur montré
    // l'instant de l'affiche dans la boucle (image M) ; la recherche vise le milieu de l'image, pour tomber sur elle
    const B = o.boucle || {}, fps = B.fps || 30;
    const instantAffiche = B.fps ? (B.fondu || 0) / B.fps : 0, viseAffiche = B.fps ? ((B.fondu || 0) + 0.5) / B.fps : 0;
    let surAffiche = true, premiere = null;   // l'affiche est montrée : la prochaine lecture repart de son instant
    let attente = false;                      // départ en attente de la durée de la vidéo (pas de lecture avant le calage)
    // la bascule en cours (null sans bascule), la dernière faite (pour les essais) et l'avance de la recherche, apprise
    let bascule = null, derniere = null, nBascules = 0, avance = 0.3;

    // montre le lecteur de la version nv ; l'autre passe en retrait et s'arrête
    function montrerLecteur(nv) {
      const ancien = v;
      v = L[nv]; version = nv; prec = -1;
      v.classList.remove('en-retrait');
      if (ancien !== v) { ancien.classList.add('en-retrait'); ancien.pause(); }
    }
    // l'horloge du lecteur montré, déroulée : la boucle repart de 0, on compte les tours
    const derouler = (b, t) => { if (t < b.dernier - (b.duree / 2)) b.tours++; b.dernier = t; return t + b.tours * b.duree; };
    // bascule pendant la lecture : le lecteur en retrait se cale sur l'image K (milieu de l'image), puis prend le relais
    // quand le lecteur montré présente l'image K − 1
    function basculer(nv) {
      const cible = L[nv], duree = v.duration;
      if (!cible || !(duree > 0)) { montrerLecteur(nv); return; }
      cible.preload = 'auto';
      const b = { nv, cible, duree, tours: 0, dernier: v.currentTime, essais: 0, prete: false, demande: performance.now() };
      bascule = b;
      const lancer = () => {
        if (bascule !== b) return;
        b.essais++; b.prete = false;
        const K = Math.ceil((derouler(b, v.currentTime) + avance) * fps);
        b.vise = (K + 0.5) / fps; b.debut = performance.now();
        cible.pause();
        cible.addEventListener('seeked', () => {
          if (bascule !== b) return;
          const recherche = (performance.now() - b.debut) / 1000;
          if (derouler(b, v.currentTime) < b.vise - 1.5 / fps - 0.002) { b.prete = true; return; }
          // trop tard : le lecteur montré a passé l'image K − 1 ; plus d'avance, et on recommence
          avance = Math.min(4, recherche * 1.5 + 0.2);
          if (b.essais < 4) lancer(); else relais(b, v.currentTime);   // en dernier recours, le relais tout de suite
        }, { once: true });
        cible.currentTime = b.vise % b.duree;
      };
      lancer();
    }
    function relais(b, t) {
      const de = t;
      b.cible.play().catch(() => {});
      montrerLecteur(b.nv);
      prec = (b.vise % b.duree) - 1 / fps;               // le tonnerre reprend où la boucle en était
      derniere = { n: ++nBascules, version: b.nv, de, a: +(b.vise % b.duree).toFixed(4), duree: b.duree, essais: b.essais, avance: +avance.toFixed(3),
        delai: +((performance.now() - b.demande) / 1000).toFixed(3) };
      bascule = null;
    }
    function appliquer() {
      const voulue = eclairs || !o.sans ? 'avec' : 'sans';
      const jouer = actif && anim && !enPanne && (eclairs || !!o.sans);
      // à l'écran sans le premier plan : arrêt sur l'image en cours, sans l'affiche ; la reprise repart de cette image
      if (!jouer && garder && !surAffiche && !attente && !bascule && voulue === version) { v.pause(); prec = -1; return; }
      if (bascule && bascule.nv !== voulue) { bascule.cible.pause(); bascule = null; }   // demande changée en route
      if (voulue !== version && !bascule) {
        if (jouer && !surAffiche && !v.paused) basculer(voulue);   // en lecture : relais au même instant
        else {
          montrerLecteur(voulue);                                   // à l'arrêt : l'affiche couvre
          // départ en attente sur l'autre lecteur : il repart sur celui-ci (sinon le fond resterait sur l'affiche)
          if (attente) { attente = false; surAffiche = true; }
        }
      }
      if (jouer) {
        const x = v;
        const lire = () => { x.preload = 'auto'; x.play().catch(() => { if (x === v) { img.hidden = false; surAffiche = true; } }); };  // lecture refusée : l'affiche reste
        if (surAffiche && affiche) {
          surAffiche = false; premiere = null; prec = -1;
          // l'affiche reste jusqu'à la première image présentée en lecture, celle de son instant
          const montrer = (n, m) => {
            if (x !== v || surAffiche) return;
            if (!x.paused) { img.hidden = true; premiere = m ? m.mediaTime : x.currentTime; } else if (x.requestVideoFrameCallback) x.requestVideoFrameCallback(montrer);
          };
          if (x.requestVideoFrameCallback) x.requestVideoFrameCallback(montrer); else x.addEventListener('playing', () => montrer(), { once: true });
          // la lecture part de l'instant de l'affiche : calée avant de jouer, une fois la durée connue (au démarrage, la
          // vidéo n'est pas encore chargée : jouer d'abord ferait passer l'image de 0 s)
          const partir = () => { attente = false; try { x.currentTime = viseAffiche; } catch (e) { /* position refusée : départ à 0 s */ } lire(); };
          if (x.readyState >= 1) partir();
          else {
            attente = true;
            x.addEventListener('loadedmetadata', () => { if (attente && x === v && !surAffiche && actif && anim && !enPanne) partir(); }, { once: true });
          }
          return;
        }
        if (!affiche) img.hidden = true;
        if (!attente) lire();
      } else {
        if (bascule) { const nv = bascule.nv; bascule = null; montrerLecteur(nv); }   // l'affiche couvre : tout de suite
        attente = false;
        v.pause(); prec = -1;
        if (affiche) { img.hidden = false; surAffiche = true; premiere = null; }
      }
    }
    // les éclairs de la boucle passés depuis l'image précédente (la boucle repart de 0 : on fait le tour)
    function suivre(t) {
      const E_ = o.boucle && o.boucle.eclairs;
      if (E_ && E_.length && o.ecoute && version === 'avec' && eclairs && prec >= 0) {
        for (const E of E_) {
          const passe = t >= prec ? E.t > prec && E.t <= t : E.t > prec || E.t <= t;
          if (passe && E.d !== null && E.d !== undefined) { o.ecoute.eclair({ sol: false, force: force(E.d), x: E.x === null || E.x === undefined ? 0.5 : E.x }); tonnerres++; }
        }
      }
      prec = t;
    }
    // chaque image présentée par le lecteur montré : le tonnerre, et le relais d'une bascule quand son image arrive
    function image(x, t) {
      if (x !== v || x.paused) return;
      suivre(t);
      const b = bascule;
      if (b && b.prete && derouler(b, t) >= b.vise - 1.5 / fps - 0.002) relais(b, t);
      else if (b) derouler(b, t);
    }
    for (const x of Object.values(L)) {
      if (x.requestVideoFrameCallback) {
        const suite = (n, m) => { image(x, m.mediaTime); x.requestVideoFrameCallback(suite); };
        x.requestVideoFrameCallback(suite);
      } else x.addEventListener('timeupdate', () => image(x, x.currentTime));
    }
    return {
      regler(r) {
        if (r.actif !== undefined) actif = r.actif;
        if (r.garder !== undefined) garder = r.garder;
        if (r.anim !== undefined) anim = r.anim;
        if (r.eclairs !== undefined) eclairs = r.eclairs;
        appliquer();
      },
      enCours: () => !v.paused && !v.ended,
      enPanne: () => enPanne,
      etat: () => ({ version, joue: !v.paused, affiche: !img.hidden, eclairs: o.boucle && o.boucle.eclairs ? o.boucle.eclairs.length : 0, tonnerres,
        instantAffiche, premiereImage: premiere, enBascule: !!bascule, bascule: derniere, panne: enPanne }),
      /* pour les essais : la lecture juste avant le prochain éclair qui a un tonnerre */
      provoquer() {
        const E_ = (o.boucle && o.boucle.eclairs || []).filter((E) => E.d !== null && E.d !== undefined);
        if (!E_.length) return false;
        const E = E_.find((x) => x.t > v.currentTime + 0.2) || E_[0];
        v.currentTime = Math.max(0, E.t - 0.15); prec = -1;
        return true;
      },
      get video() { return v; },
    };
  }
  return { create };
})();
