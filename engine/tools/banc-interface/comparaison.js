'use strict';
/* Banc de l'interface : commandes de la page de comparaison (comparaison-hud.html, faite par fabrique.py).
   La couche HUD (HUD_DOC) est chargée dans un cadre ; en « écran réel », il couvre la fenêtre ; sinon il prend la
   taille de l'écran choisi et il est réduit pour tenir dans la fenêtre. Les réglages lui sont envoyés par message. */
(function () {
  const $ = (id) => document.getElementById(id);
  const cadre = $('hud'), scene = $('scene'), panneau = $('panneau'), rappel = $('rappel');
  const PRESETS = [
    { zone: 'plein', echelle: 'actuelle' },
    { zone: '16:9', echelle: 'actuelle' },
    { zone: 'plein', echelle: 'unique' },
    { zone: '16:9', echelle: 'unique' },
  ];
  const cfg = { scene: 'bunker', zone: 'plein', echelle: 'actuelle', taille: 1, tout: false, cadre: false, mesures: false, boss: false };
  let ecran = 'reel', charge = false, info = null;

  function envoyer() {
    if (charge) cadre.contentWindow.postMessage({ type: 'banc', cfg }, '*');
    PRESETS.forEach((p, i) => {
      const b = document.querySelector(`[data-preset="${i}"]`);
      b.setAttribute('aria-pressed', String(p.zone === cfg.zone && p.echelle === cfg.echelle));
    });
    $('c-zone').value = cfg.zone; $('c-echelle').value = cfg.echelle;
    $('c-taille').disabled = cfg.echelle !== 'unique';
    $('c-tout').disabled = cfg.echelle !== 'unique';
  }

  function charger() {
    charge = false;
    cadre.onload = () => { charge = true; envoyer(); };
    cadre.srcdoc = HUD_DOC;
  }

  function disposer() {
    if (ecran === 'reel') {
      scene.className = 'reel';
      cadre.style.width = cadre.style.height = cadre.style.transform = '';
    } else {
      const [w, h] = ecran.split('x').map(Number);
      const s = Math.min(innerWidth / w, innerHeight / h);
      scene.className = 'simule';
      cadre.style.width = `${w}px`; cadre.style.height = `${h}px`;
      cadre.style.transform = `translate(${((innerWidth - w * s) / 2).toFixed(1)}px, ${((innerHeight - h * s) / 2).toFixed(1)}px) scale(${s.toFixed(5)})`;
    }
  }

  const nombre = (x, n = 0) => x.toLocaleString('fr-BE', { minimumFractionDigits: n, maximumFractionDigits: n });
  function afficherInfo() {
    if (!info) return;
    const prop = info.w / info.h;
    const nomProp = Math.abs(prop - 16 / 9) < 0.02 ? '16:9' : prop > 3 ? '32:9' : prop > 2.2 ? '21:9' : nombre(prop, 2) + ':1';
    const red = ecran === 'reel' ? '' : ` · réduit à ${nombre(Math.min(innerWidth / info.w, innerHeight / info.h) * 100)} %`;
    $('info').textContent = `${nombre(info.w)} × ${nombre(info.h)} (${nomProp})${red} · échelle ×${nombre(info.k, 2)}`
      + (cfg.zone !== 'plein' ? ` · marge de la zone ${nombre(info.zx)} px` : '');
  }

  addEventListener('message', (e) => { if (e.data && e.data.type === 'banc-info') { info = e.data.info; afficherInfo(); } });
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { Object.assign(cfg, PRESETS[+b.dataset.preset]); envoyer(); }));
  $('c-zone').addEventListener('change', (e) => { cfg.zone = e.target.value; envoyer(); });
  $('c-echelle').addEventListener('change', (e) => { cfg.echelle = e.target.value; envoyer(); });
  $('c-taille').addEventListener('input', (e) => { cfg.taille = +e.target.value; $('c-taille-v').textContent = `${Math.round(cfg.taille * 100)} %`; envoyer(); });
  for (const k of ['tout', 'cadre', 'mesures', 'boss']) $(`c-${k}`).addEventListener('change', (e) => { cfg[k] = e.target.checked; envoyer(); });
  $('c-scene').addEventListener('change', (e) => { cfg.scene = e.target.value; charger(); });
  $('c-ecran').addEventListener('change', (e) => { ecran = e.target.value; disposer(); });
  addEventListener('resize', () => { disposer(); afficherInfo(); });
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('select, input') && !/^[1-4hHpP]$/.test(e.key)) return;
    if (/^[1-4]$/.test(e.key)) { Object.assign(cfg, PRESETS[+e.key - 1]); envoyer(); }
    else if (e.key === 'h' || e.key === 'H') { panneau.hidden = !panneau.hidden; rappel.hidden = !panneau.hidden; }
    else if (e.key === 'p' || e.key === 'P') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  disposer();
  charger();
})();
