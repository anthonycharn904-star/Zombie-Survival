'use strict';
/* Sons de l'ambiance du fond « Marécages maudits » : la pluie et le tonnerre du kit 2.0.7, sons calculés par le jeu et
   exportés tels quels (scene-bete/exporter-sons.js, export autorisé par Anthony le 31 octobre 2026), mêlés comme dans
   le jeu :
     · la pluie (maWxAudioStart, maWxAudioUpdate) : les nappes en boucle, chacune à sa force (MA_WXA_K × ce qui entoure
       l'auditeur × l'intensité), MA_WXC.vol 0,55, passe-haut 40 Hz. L'intensité est celle de la pluie qu'on voit
       (marais.js) : on n'entend pas une averse qu'on ne voit pas ;
     · le tonnerre (maOrBus, maThunderStart) : sur chaque éclair de la scène, après l'arrivée du premier front (t0) ;
       médium, force selon la distance, côté selon l'endroit de l'éclair, réverbération commune de l'orage.
   Coupés par défaut : le launcher démarre en silence. Ils ne jouent que quand la scène est visible (accueil, fenêtre
   ouverte, pas de partie) ; ailleurs, le contexte audio est suspendu (aucun calcul). Le contexte n'est créé qu'au
   premier allumage, sur un geste de l'utilisateur.
   Les fichiers (Opus) et leurs réglages viennent de window.ZSM_SONS (assembler.py, depuis ressources/marecages/sons). */
window.Ambiance = (function () {
  const S = window.ZSM_SONS || null;
  // l'auditeur : la caméra au ras de l'eau, près du ponton (dehors) ; parts de ce qui l'entoure (maWxSurround)
  const AUTOUR = { water: 0.75, wood: 0.25, leaves: 0.1 };
  const NAPPES = [['pluie-eau', 'water'], ['pluie-bois', 'wood'], ['pluie-feuillage', 'leaves'], ['pluie-lointain', 'wash']];
  const VOIX_MAX = 3;
  /* pas deux fois le même tonnerre de suite : le voisin en distance (décision d'Anthony du 2 novembre 2026), jamais plus
     près pour un coup au sol (450 m reste réservé aux éclairs au sol les plus forts). Avec la vidéo du launcher, un seul
     éclair dans les nuages à 4,4 km : nuages-3500 puis sol-3000, au lieu de sol-1700 (7,4 dB plus fort, 5,3 s plus tôt) */
  const VOISIN = { 'sol-450': 'sol-900', 'sol-900': 'sol-1700', 'sol-1700': 'nuages-2000', 'nuages-2000': 'sol-1700', 'sol-3000': 'nuages-3500', 'nuages-3500': 'sol-3000' };
  let ctx = null, pret = null, bufs = {}, maitre = null, pluie = null, orage = null, sonde = null;
  let veut = false, visible = false, volume = 0.8, I = 0.72, dernier = '', voix = [], rejoue = 0;   // 0,8 : le volume général du jeu par défaut

  const forces = (i) => ({ water: i * (0.12 + 0.88 * AUTOUR.water), wood: i * AUTOUR.wood, leaves: i * AUTOUR.leaves, wash: Math.pow(i, 0.9) });
  function octets(uri) { const b = atob(uri.slice(uri.indexOf(',') + 1)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
  function creer() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // la fin de la chaîne du jeu (Sound.init) : volume général, puis compresseur (il retient les crêtes du tonnerre)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.22;
    comp.connect(ctx.destination);
    maitre = ctx.createGain(); maitre.gain.value = 0; maitre.connect(comp);
    sonde = ctx.createAnalyser(); sonde.fftSize = 2048; comp.connect(sonde);     // le niveau de sortie, pour les essais
    // la pluie : nappe → gain → force (0,55) → passe-haut 40 Hz
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = 0.7; hp.connect(maitre);
    const out = ctx.createGain(); out.gain.value = 0.55; out.connect(hp);
    pluie = { out, nappes: {} };
    // l'orage : réverbération commune (0,55)
    const tout = ctx.createGain(); tout.connect(maitre);
    const verb = ctx.createConvolver(), wet = ctx.createGain(); wet.gain.value = 0.55; verb.connect(wet); wet.connect(tout);
    orage = { out: tout, verb };
    pret = Promise.all(Object.keys(S.fichiers).map((id) => ctx.decodeAudioData(octets(S.fichiers[id])).then((b) => { bufs[id] = b; })))
      .then(() => {
        verb.buffer = bufs['orage-reverberation'];
        const f = forces(I), t = ctx.currentTime;
        for (const [id, k] of NAPPES) {
          const M = S.meta[id], b = bufs[id];
          if (!b) continue;
          // la boucle se coupe au milieu du son continu (marge de part et d'autre dans le fichier) : pas de couture
          const s = ctx.createBufferSource(), g = ctx.createGain(), a = M.boucle.debut / 48000, L = M.boucle.longueur / 48000;
          s.buffer = b; s.loop = true; s.loopStart = a; s.loopEnd = a + L;
          g.gain.value = f[k] * M.kJeu * M.echelle;
          s.connect(g); g.connect(out); s.start(t, a + Math.random() * L);
          pluie.nappes[k] = { s, g, M };
        }
      });
    return pret;
  }
  function appliquer() {
    const on = veut && visible;
    if (!on) {
      if (!ctx || ctx.state === 'closed') return;
      const t = ctx.currentTime;
      maitre.gain.cancelScheduledValues(t); maitre.gain.setTargetAtTime(0, t, 0.08);
      for (const v of voix) { try { v.s.stop(t + 0.4); } catch (e) { /* déjà arrêtée */ } }
      voix = [];
      clearTimeout(appliquer.t); appliquer.t = setTimeout(() => { if (!(veut && visible) && ctx.state === 'running') ctx.suspend(); }, 450);
      return;
    }
    if (!S) return;
    if (!ctx) creer();
    clearTimeout(appliquer.t);
    const reprendre = () => {
      if (ctx.state !== 'running') return;
      const t = ctx.currentTime;
      maitre.gain.cancelScheduledValues(t); maitre.gain.setValueAtTime(maitre.gain.value, t);
      maitre.gain.linearRampToValueAtTime(volume, t + 1.5);       // jamais d'arrivée brusque
    };
    if (ctx.state === 'running') reprendre(); else ctx.resume().then(reprendre, () => {});
  }
  // le navigateur peut refuser le son avant un geste : il reprend au premier clic ou à la première touche
  const geste = () => { if (veut && visible && ctx && ctx.state === 'suspended') appliquer(); };
  document.addEventListener('pointerdown', geste, true);
  document.addEventListener('keydown', geste, true);

  /* Un éclair de la scène : le tonnerre qui lui correspond, après l'arrivée du son. sol : éclair au sol ; force : de
     0,75 à 1,3 (ORAGE.force) ; x : de 0 (gauche) à 1 (droite) de l'image. Les éclairs les plus forts viennent de plus
     près ; jamais plus près que 450 m (aucun éclair « tout près » : un launcher ne doit pas assourdir). */
  function choisir(e) {
    if (e.sol) return e.force >= 1.15 ? 'sol-450' : e.force >= 0.95 ? 'sol-900' : 'sol-1700';
    return e.force >= 1.1 ? 'nuages-2000' : e.force >= 0.9 ? 'sol-3000' : 'nuages-3500';
  }
  // le tonnerre d'un éclair, après celui qui vient de jouer (avant) : pas deux fois le même de suite
  function tonnerre(e, avant) {
    const id = 'tonnerre-' + choisir(e);
    return id === avant ? 'tonnerre-' + VOISIN[id.slice('tonnerre-'.length)] : id;
  }
  function eclair(e) {
    if (!(veut && visible) || !ctx || ctx.state !== 'running' || !bufs['orage-reverberation']) return null;
    const id = tonnerre(e, dernier);
    voix = voix.filter((v) => v.fin > ctx.currentTime);
    if (voix.length >= VOIX_MAX || !bufs[id]) return null;
    const M = S.meta[id], t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = bufs[id];
    const e1 = ctx.createBiquadFilter(); e1.type = 'peaking'; e1.frequency.value = 200; e1.Q.value = 0.8; e1.gain.value = 5;
    const e2 = ctx.createBiquadFilter(); e2.type = 'peaking'; e2.frequency.value = 1000; e2.Q.value = 0.9; e2.gain.value = M.medium_dB;
    const g = ctx.createGain(); g.gain.value = M.niveauJeu * M.echelle;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (e.x !== undefined ? e.x : 0.5) * 2 - 1)) * 0.7;
    const sw = ctx.createGain(); sw.gain.value = M.envoiReverb;
    s.connect(e1); e1.connect(e2); e2.connect(g); g.connect(p); p.connect(orage.out); g.connect(sw); sw.connect(orage.verb);
    const t0 = t + M.t0;
    s.start(t0);
    const v = { id, s, fin: t0 + s.buffer.duration };
    s.onended = () => { try { g.disconnect(); sw.disconnect(); p.disconnect(); e1.disconnect(); e2.disconnect(); } catch (x) { /* */ } };
    voix.push(v); dernier = id; rejoue++;
    return { id, dans: +M.t0.toFixed(2) };
  }

  return {
    disponible: !!S,
    /* veut : réglage « Sons de l'ambiance » ; visible : la scène joue (accueil, fenêtre ouverte, pas de partie) ;
       volume : de 0 à 1 */
    regler(o) {
      const a = o.veut !== undefined ? !!o.veut : veut, b = o.visible !== undefined ? !!o.visible : visible;
      const v = o.volume !== undefined ? Math.max(0, Math.min(1, o.volume)) : volume;
      if (v !== volume) { volume = v; if (ctx && veut && visible && a && b && ctx.state === 'running') maitre.gain.setTargetAtTime(volume, ctx.currentTime, 0.1); }
      if (a === veut && b === visible) return;
      veut = a; visible = b; appliquer();
    },
    /* l'intensité de la pluie qu'on voit (marais.js), à chaque image */
    intensite(i) {
      I = i;
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      if (t - (pluie.maj || 0) < 0.25) return;                         // quatre fois par seconde : l'intensité varie en 15 à 40 s
      pluie.maj = t;
      const f = forces(i);
      for (const k in pluie.nappes) { const N = pluie.nappes[k]; N.g.gain.setTargetAtTime(f[k] * N.M.kJeu * N.M.echelle, t, 0.35); }
    },
    eclair,
    tonnerre,
    /* pour les essais */
    etat: () => ({ contexte: ctx ? ctx.state : 'aucun', charges: Object.keys(bufs).length, attendus: S ? Object.keys(S.fichiers).length : 0,
      nappes: pluie ? Object.keys(pluie.nappes).length : 0, voix: ctx ? voix.filter((v) => v.fin > ctx.currentTime).length : 0, tonnerres: rejoue,
      volume: maitre ? +maitre.gain.value.toFixed(3) : 0, veut, visible }),
    /* niveau de sortie (dB pleine échelle, moyenne quadratique sur 43 ms) */
    niveau() {
      if (!sonde) return -Infinity;
      const d = new Float32Array(sonde.fftSize); sonde.getFloatTimeDomainData(d);
      let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      return +(10 * Math.log10(s / d.length + 1e-20)).toFixed(1);
    },
    pret: () => pret,
  };
})();
