
/* ------------------------------------------------------------- Diagnostic (F8) --
   Kit MM 2.1.1. Pour voir en jeu, sur sa machine, ce que fait la Mère-Vase et pourquoi elle vient ou ne
   vient pas : chargement, menace et ce qui la fait monter, état, distance et profondeur de la bête,
   prochain passage en surface, navigateur et carte graphique, erreurs de la page.
     F8          afficher ou cacher le panneau
     Maj + F8    (panneau ouvert, sur l'eau) l'appeler : menace à 85, pour vérifier tout de suite
   Kit MM 2.1.4 : la fluidité aussi : images par seconde, pire image des 10 dernières secondes, gels (une image
   de plus de 250 ms), shaders compilés en pleine partie (il n'y en a plus après les premières secondes) et
   pertes du contexte WebGL (le pilote graphique qui réinitialise le rendu).
   Intégration dans le moteur (décisions d'Anthony du 1er novembre 2026) : rien ne s'installe au chargement du jeu,
   et rien ne marche hors du marais.
     · F8 (le panneau, en lecture seule) : seulement dans un environnement de diagnostic explicitement activé, sur une
       carte du marais : une partie de test des Mod Tools (G.editorSession), ou « ?diag=marais » dans l'adresse du
       jeu, ou store.set('zs.diag', 'marais') dans la console ;
     · Maj+F8 (appeler la bête : change la partie) : seulement dans une partie de test des Mod Tools ;
     · console.error n'est plus remplacé : le panneau compte les erreurs du marais (maErr) et, une fois le diagnostic
       installé, celles de la page (écouteurs « error » et « unhandledrejection ») ;
     · le message aux joueurs quand le pilote graphique réinitialise le rendu reste, dans le marais seulement. */
const MA_DIAG = { on: false, el: null, errs: [], n: 0, gpu: null, iv: 0,
  fr: { last: 0, fps: 0, n: 0, t0: 0, worst: 0, worstT: 0, freezes: 0, lastFreeze: null }, lost: 0, back: 0, prog0: -1, glHooked: false, installed: false };
const MA_DIAG_ST = {
  dormant: 'endormie au fond', rode: 'rôde', affleure: 'fait surface', traque: 'traque', guet: 'guette (leurres allumés)',
  charge: 'charge', remontee: 'remonte', prepare: 'se prépare à mordre', attaque: 'attaque la barque', mord: 'mord',
  surgit: 'jaillit', plonge: 'plonge', retraite: 's’éloigne', fuite: 'fuit', blesse: 'blessée', devore: 'dévore', mort: 'morte',
  ruee: 'se jette sur vous', chasse: 'vous chasse : nagez vers la rive', festin: 'chasse les Noyés (vous êtes hors de l’eau)',
};
/* Une erreur du marais : dans le panneau, et dans la console comme avant (console.error n'est pas remplacé). */
function maDiagPush(msg) { MA_DIAG.n++; MA_DIAG.errs.push(String(msg).replace(/\s+/g, ' ').slice(0, 150)); if (MA_DIAG.errs.length > 3) MA_DIAG.errs.shift(); }
function maErr(...a) { try { maDiagPush(a.map((x) => (x && x.message) || x).join(' ')); } catch (err) { /* rien */ } console.error(...a); }
/* Diagnostic demandé explicitement : adresse « ?diag=marais », ou store « zs.diag » à « marais ». */
function maDiagDemande() {
  try { if (new URLSearchParams(location.search).get('diag') === 'marais') return true; } catch (e) { /* rien */ }
  return store.get('zs.diag', '') === 'marais';
}
function maDiagPermis() { return OW.on && OW.worldId === 'marais' && (!!G.editorSession || maDiagDemande()); }
/* Au chargement d'une carte du marais (maLoad) : le message des pertes du contexte WebGL (une fois, pour tous) ;
   le reste seulement si le diagnostic est permis (une fois par session). */
function maDiagInstaller() {
  if (!MA_DIAG.glHooked && typeof renderer !== 'undefined' && renderer && renderer.domElement) {
    MA_DIAG.glHooked = true;
    renderer.domElement.addEventListener('webglcontextlost', () => {
      MA_DIAG.lost++; maDiagPush('contexte WebGL perdu (le pilote graphique a réinitialisé le rendu)');
      if (OW.on && OW.worldId === 'marais') { try { HUD.hint('Le pilote graphique a réinitialisé le rendu : reprise en cours…', 6); } catch (e) { /* rien */ } }
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => { MA_DIAG.back++; });
  }
  if (MA_DIAG.installed || !maDiagPermis()) return;
  MA_DIAG.installed = true;
  window.addEventListener('error', (e) => maDiagPush(e.message || (e.error && e.error.message) || 'erreur'));
  window.addEventListener('unhandledrejection', (e) => maDiagPush('promesse : ' + ((e.reason && e.reason.message) || e.reason)));
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F8' || !maDiagPermis()) return;
    e.preventDefault();
    if (e.shiftKey) {
      // la seule commande qui change la partie : dans une partie de test des Mod Tools seulement
      if (G.editorSession && MA_DIAG.on && MAB.on && maPlayerOnWater()) { MAM.attn = Math.max(MAM.attn, 85); HUD.hint('Test : la Mère-Vase est appelée', 2.5); }
      return;
    }
    maDiagToggle();
  }, true);
  if (typeof render === 'function' && !render.__diag) {
    const r0 = render;
    const r1 = function () { maDiagFrame(); return r0.apply(this, arguments); };
    r1.__diag = true;
    render = r1;                                                // la boucle du jeu appelle render() par son nom
  }
}
/* Chaque image rendue (render, quel que soit l'état du jeu ; diagnostic installé) : le temps écoulé depuis la précédente. */
function maDiagFrame() {
  const F = MA_DIAG.fr, now = performance.now();
  if (document.hidden) { F.last = 0; return; }                 // onglet caché : rien ne s'affiche, ce n'est pas un gel
  if (F.last) {
    const d = now - F.last;
    if (d > F.worst || now - F.worstT > 10000) { F.worst = d; F.worstT = now; }
    if (d > 250 && typeof G !== 'undefined' && G.state === 'playing') {
      F.freezes++;
      F.lastFreeze = { ms: Math.round(d), at: Math.round(G.time), st: typeof MAB !== 'undefined' ? MAB.state : '', where: VEH.drive ? 'en barque' : MA_SWIM.on ? 'à la nage' : 'à pied' };
    }
    F.n++;
  }
  if (now - F.t0 >= 1000) { F.fps = (F.n * 1000) / (now - F.t0); F.n = 0; F.t0 = now; }
  F.last = now;
  // les shaders compilés en partie : comptés à partir de la 5e seconde (les toutes premières images
  // compilent l'arme et les ombres du joueur)
  if (typeof G !== 'undefined' && G.state === 'playing' && renderer.info && renderer.info.programs) {
    if (G.time < 5) MA_DIAG.prog0 = -1;
    else if (MA_DIAG.prog0 < 0) MA_DIAG.prog0 = renderer.info.programs.length;
  }
}
function maDiagToggle(on = !MA_DIAG.on) {
  MA_DIAG.on = on;
  if (on && !MA_DIAG.el) {
    const e = document.createElement('pre');
    Object.assign(e.style, { position: 'fixed', left: '12px', top: '96px', zIndex: 60, margin: 0, padding: '8px 10px', maxWidth: 'min(560px, 92vw)', whiteSpace: 'pre-wrap',
      font: '12px/1.45 ui-monospace, Consolas, monospace', color: '#e8f4ec', background: 'rgba(8,14,11,0.72)', border: '1px solid rgba(140,230,190,0.35)', pointerEvents: 'none' });
    document.body.append(e);
    MA_DIAG.el = e;
  }
  if (MA_DIAG.el) MA_DIAG.el.hidden = !on;
  clearInterval(MA_DIAG.iv);
  if (on) { maDiagDraw(); MA_DIAG.iv = setInterval(maDiagDraw, 250); }
}
function maDiagBrowser() {
  const u = navigator.userAgent;
  let m;
  if ((m = u.match(/Firefox\/(\d+)/))) return `Firefox ${m[1]}`;
  if ((m = u.match(/Edg\/(\d+)/))) return `Edge ${m[1]}`;
  if ((m = u.match(/Electron\/(\d+)/))) return `launcher (Electron ${m[1]})`;
  if ((m = u.match(/OPR\/(\d+)/))) return `Opera ${m[1]}`;
  if ((m = u.match(/Chrome\/(\d+)/))) return `Chrome ${m[1]}`;
  if ((m = u.match(/Version\/(\d+).*Safari/))) return `Safari ${m[1]}`;
  return 'navigateur inconnu';
}
function maDiagGpu() {
  if (MA_DIAG.gpu) return MA_DIAG.gpu;
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).replace(/\s+/g, ' ');
    MA_DIAG.gpu = `${renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1'} · ${r.slice(0, 80)}`;
  } catch (e) { MA_DIAG.gpu = 'WebGL ?'; }
  return MA_DIAG.gpu;
}
function maDiagText() {
  const L = [`MÈRE-VASE · diagnostic (F8 : fermer${G.editorSession ? ' · Maj+F8 : l’appeler' : ''})`];
  const f1 = (x) => x.toFixed(1).replace('.', ',');
  if (!(OW.on && OW.worldId === 'marais')) L.push(`carte : ${G.mapId || '?'} (pas de Mère-Vase ici)`);
  else {
    L.push(MAB.mv ? `bête : chargée${MAB.err ? ` (${MAB.err})` : ''}` : `bête : NON CHARGÉE — ${MAB.err || 'carte ouverte dans l’éditeur, ou base sans lieux'}`);
    const lvN = ['calme', 'éveil', 'rôde', 'traque', 'attaque'][MAM.level] || '?';
    L.push(`menace : ${Math.round(MAM.attn)}/100 · palier ${MAM.level} (${lvN}) · paliers à 20, 40, 60, 80 ; morsure à 92`);
    const p = player, V = VEH.drive, onW = maPlayerOnWater(), d = maDepth(p.pos.x, p.pos.z);
    const wading = maPlayerWading();
    const where = MA_SWIM.on ? 'à la nage' : V && V.T.boat ? `en barque (${!V.motor ? 'moteur arrêté' : Math.abs(V.v) < 0.8 ? 'moteur au ralenti' : 'moteur'}, ${f1(Math.abs(V.v))} m/s)` : wading ? 'à pied dans l’eau, près de l’eau profonde' : 'à terre';
    L.push(`vous : ${where} · eau sous vous : ${d > 0.05 ? `${f1(d)} m` : 'aucune'}`);
    const r = MAM.rate || 0;
    if (onW) L.push(`elle vous entend : ${r >= 0 ? '+' : ''}${f1(r)}/s (eau ×${f1(maWaterK(p.pos.x, p.pos.z))}) · sur l’eau depuis ${Math.round(MAM.trip)} s`);
    else if (wading) L.push(`elle vous entend : ${r >= 0 ? '+' : ''}${f1(r)}/s · à pied, la menace s’arrête à ${MA_CFG.attn.wadeCap} (pas d’attaque)`);
    else L.push(`à terre, elle perd la trace : ${r < 0 ? `${f1(r)}/s` : 'menace nulle'}`);
    if (MAB.on) {
      const dB = Math.hypot(MAB.x - p.pos.x, MAB.z - p.pos.z);
      if (MAB.state === 'dormant') L.push('bête : endormie au fond (elle s’éveille à 20)');
      else {
        L.push(`bête : ${MAB.state === 'ruee' && MAB.tgt && MAB.tgt.kind === 'noye' ? 'se jette sur un Noyé' : MA_DIAG_ST[MAB.state] || MAB.state} · à ${Math.round(dB)} m · dos à ${f1(Math.max(0, MA.water - MAB.y))} m sous l’eau${MAB.obj && MAB.obj.visible ? '' : ' · hors de vue'}`);
        const P = MAB.nav;
        if (P) L.push(`trajet : ${P.mode === 'direct' ? 'en ligne droite' : P.mode === 'chemin' ? `contourne (${Math.round(P.path.len)} m par l’eau)` : P.mode === 'au plus près' ? `au plus près (${Math.round(P.path.len)} m) : vous êtes hors de sa portée` : 'aucun chemin'}${MA_NAV.calls ? ` · calcul ${f1(MA_NAV.ms)} ms` : ''}`);
      }
      if (MAB.state === 'rode' && (onW || wading) && MAM.level >= 1) L.push(MAB.showT > 0.5 ? `prochain passage en surface : dans ${Math.round(MAB.showT)} s (si elle est à ${MA_CFG.show.near}-${MA_CFG.show.far} m de vous, à découvert)` : `prochain passage en surface : dès qu’elle sera à ${MA_CFG.show.near}-${MA_CFG.show.far} m de vous, à découvert`);
      if (MAB.state === 'chasse' && MAB.grace) L.push(`naufrage : haut-fond le plus proche à ${MAB.grace.dist} m · elle se jette sur vous dans ${Math.max(0, Math.ceil(MAB.cool))} s si vous nagez encore`);
      else if (MAB.cool > 0 && MAB.state !== 'dormant') L.push(`elle ne peut pas attaquer avant ${Math.ceil(MAB.cool)} s`);
      if (MA_BOSS.on) L.push(`combat : ${Math.round(MA_BOSS.hp)}/${MA_BOSS.maxHp} · phase ${MA_BOSS.phase + 1}`);
    }
    L.push(maNoyeDiag());                                 // kit MM 2.1.6 : les Noyés
    L.push(maStrygeDiag());                               // kit 2.0.7 : les Stryges
    L.push(maWxDiag());                                   // kit 2.0.7 : la pluie
    L.push(maStormDiag());                                // kit 2.0.7 : l'orage
  }
  L.push(`${maDiagBrowser()} · ${maDiagGpu()} · ${typeof settings !== 'undefined' ? `qualité ${settings.quality}` : ''}`);
  {
    const F = MA_DIAG.fr, P = renderer.info && renderer.info.programs ? renderer.info.programs.length : 0;
    const comp = MA_DIAG.prog0 >= 0 ? P - MA_DIAG.prog0 : null;
    L.push(`fluidité : ${Math.round(F.fps)} images/s · pire image (10 s) : ${Math.round(F.worst)} ms · gels (> 250 ms) : ${F.freezes}${F.lastFreeze ? ` (dernier : ${F.lastFreeze.ms} ms à ${F.lastFreeze.at} s, ${F.lastFreeze.where}, bête : ${MA_DIAG_ST[F.lastFreeze.st] || F.lastFreeze.st})` : ''}`);
    L.push(`shaders : ${P}${comp !== null ? ` · compilés en partie : ${comp}` : ''}${MA.prewarm ? ` · précompilés au chargement : ${MA.prewarm.programs} en ${MA.prewarm.ms} ms` : ''} · contexte WebGL perdu : ${MA_DIAG.lost}${MA_DIAG.lost ? ` (rendu ${MA_DIAG.back} fois)` : ''}`);
  }
  L.push(MA_DIAG.n ? `erreurs de la page : ${MA_DIAG.n} — dernière : ${MA_DIAG.errs[MA_DIAG.errs.length - 1]}` : 'erreurs de la page : aucune');
  return L.join('\n');
}
function maDiagDraw() {
  if (!MA_DIAG.on || !MA_DIAG.el) return;
  try { MA_DIAG.el.textContent = maDiagText(); } catch (e) { MA_DIAG.el.textContent = `diagnostic : ${e.message}`; }
}
