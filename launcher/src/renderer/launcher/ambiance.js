'use strict';
/* Sons de l'ambiance du fond « Les Marécages Maudits » de l'accueil, repris de la maquette D (D-hybride/ambiance.js) :
   la pluie et le tonnerre calculés par le jeu du kit 2.0.7, exportés tels quels (scene-bete/exporter-sons.js, export
   autorisé par Anthony le 31 octobre 2026), mêlés comme dans le jeu. Réglages validés par Anthony le 31 octobre 2026 :
   tonnerres de 450 m à 3,5 km, aucun éclair tout près ; volume à 80 % par défaut, puis le compresseur du jeu ; sans
   éclair, pas de tonnerre.
   - La pluie (maWxAudioStart, maWxAudioUpdate) : les nappes en boucle, chacune à sa force (part de ce qui entoure
     l'auditeur × l'intensité), 0,55, passe-haut 40 Hz.
   - Le tonnerre (maOrBus, maThunderStart) : sur chaque éclair de la vidéo, après l'arrivée du premier front (t0) ;
     médium, force selon la distance, côté selon l'endroit de l'éclair, réverbération commune de l'orage.
   Coupés à chaque lancement : le launcher démarre en silence. Ils ne jouent que quand le fond est visible ; ailleurs,
   le contexte audio est suspendu (aucun calcul). Le contexte n'est créé, et les sons lus, qu'au premier allumage.
   Fichiers et réglages : window.zs.ambiance() (le processus principal lit assets/marecages/sons ; la page n'a ni fetch
   ni accès aux fichiers). Sons introuvables : o.panne(message), l'interrupteur se désactive. */
window.Ambiance = (function () {
  // l'auditeur : la caméra au ras de l'eau, près du ponton (dehors) ; parts de ce qui l'entoure (maWxSurround)
  const AUTOUR = { water: 0.75, wood: 0.25, leaves: 0.1 };
  const NAPPES = [['pluie-eau', 'water'], ['pluie-bois', 'wood'], ['pluie-feuillage', 'leaves'], ['pluie-lointain', 'wash']];
  const VOIX_MAX = 3;
  const disponible = !!(window.zs && typeof window.zs.ambiance === 'function');
  let S = null, ctx = null, pret = null, bufs = {}, maitre = null, pluie = null, orage = null, sonde = null, erreur = null, surPanne = null;
  let veut = false, visible = false, volume = 0.8, I = 0.72, dernier = '', voix = [], rejoue = 0;   // 0,8 : le volume général du jeu par défaut

  const forces = (i) => ({ water: i * (0.12 + 0.88 * AUTOUR.water), wood: i * AUTOUR.wood, leaves: i * AUTOUR.leaves, wash: Math.pow(i, 0.9) });
  function panne(e) {
    erreur = String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    veut = false;
    if (ctx && ctx.state === 'running') ctx.suspend();
    if (surPanne) surPanne(erreur);
  }
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
    pret = window.zs.ambiance()
      .then((r) => {
        if (!r || !r.meta || !r.fichiers) throw new Error('Sons de l’ambiance introuvables.');
        S = r;
        return Promise.all(Object.keys(S.fichiers).map((id) => ctx.decodeAudioData(S.fichiers[id]).then((b) => { bufs[id] = b; },
          (e) => { console.error('ambiance', id, e); throw new Error('Sons de l’ambiance illisibles sur ce PC.'); })));
      })
      .then(() => {
        if (!bufs['orage-reverberation']) throw new Error('Réverbération de l’orage introuvable.');
        verb.buffer = bufs['orage-reverberation'];
        const f = forces(I), t = ctx.currentTime;
        for (const [id, k] of NAPPES) {
          const M = S.meta[id], b = bufs[id];
          if (!b || !M) continue;
          // la boucle se coupe au milieu du son continu (marge de part et d'autre dans le fichier) : pas de couture
          const s = ctx.createBufferSource(), g = ctx.createGain(), a = M.boucle.debut / 48000, L = M.boucle.longueur / 48000;
          s.buffer = b; s.loop = true; s.loopStart = a; s.loopEnd = a + L;
          g.gain.value = f[k] * M.kJeu * M.echelle;
          s.connect(g); g.connect(out); s.start(t, a + Math.random() * L);
          pluie.nappes[k] = { s, g, M };
        }
      })
      .catch(panne);
    return pret;
  }
  function appliquer() {
    const on = veut && visible && !erreur;
    if (!on) {
      if (!ctx || ctx.state === 'closed') return;
      const t = ctx.currentTime;
      maitre.gain.cancelScheduledValues(t); maitre.gain.setTargetAtTime(0, t, 0.08);
      for (const v of voix) { try { v.s.stop(t + 0.4); } catch (e) { /* déjà arrêtée */ } }
      voix = [];
      clearTimeout(appliquer.t); appliquer.t = setTimeout(() => { if (!(veut && visible) && ctx.state === 'running') ctx.suspend(); }, 450);
      return;
    }
    if (!ctx) creer();
    clearTimeout(appliquer.t);
    const reprendre = () => {
      if (ctx.state !== 'running') return;
      // resume() est asynchrone : une pause (autre page, fenêtre, partie) ou une panne a pu arriver entre-temps
      if (!(veut && visible) || erreur) { ctx.suspend(); return; }
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
  function eclair(e) {
    if (!(veut && visible) || !ctx || ctx.state !== 'running' || !bufs['orage-reverberation']) return null;
    let id = 'tonnerre-' + choisir(e);
    if (id === dernier) id = 'tonnerre-' + choisir({ sol: !e.sol, force: e.force });   // pas deux fois le même de suite
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
    disponible,
    /* veut : interrupteur « Sons de l'ambiance » ; visible : le fond joue (accueil, fenêtre visible et au premier plan,
       pas de partie) ; volume : de 0 à 1 ; panne : appelée une fois si les sons sont introuvables */
    regler(o) {
      if (o.panne) surPanne = o.panne;
      const a = o.veut !== undefined ? !!o.veut && !erreur : veut, b = o.visible !== undefined ? !!o.visible : visible;
      const v = o.volume !== undefined ? Math.max(0, Math.min(1, o.volume)) : volume;
      if (v !== volume) { volume = v; if (ctx && veut && visible && a && b && ctx.state === 'running') maitre.gain.setTargetAtTime(volume, ctx.currentTime, 0.1); }
      if (a === veut && b === visible) return;
      veut = a; visible = b; appliquer();
    },
    /* l'intensité de la pluie (de 0,3 à 1) : fixe avec la vidéo (0,72), gardée pour une scène qui la ferait varier */
    intensite(i) {
      I = i;
      if (!ctx || ctx.state !== 'running' || !pluie) return;
      const t = ctx.currentTime;
      if (t - (pluie.maj || 0) < 0.25) return;
      pluie.maj = t;
      const f = forces(i);
      for (const k in pluie.nappes) { const N = pluie.nappes[k]; N.g.gain.setTargetAtTime(f[k] * N.M.kJeu * N.M.echelle, t, 0.35); }
    },
    eclair,
    erreur: () => erreur,
    /* pour les essais */
    etat: () => ({ contexte: ctx ? ctx.state : 'aucun', charges: Object.keys(bufs).length, attendus: S ? Object.keys(S.fichiers).length : 0,
      nappes: pluie ? Object.keys(pluie.nappes).length : 0, voix: ctx ? voix.filter((v) => v.fin > ctx.currentTime).length : 0, tonnerres: rejoue,
      volume: maitre ? +maitre.gain.value.toFixed(3) : 0, veut, visible, erreur }),
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
