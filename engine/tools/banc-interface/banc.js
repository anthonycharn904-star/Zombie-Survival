'use strict';
/* Banc de l'interface : script de la page de la couche HUD (hud.html, faite par fabrique.py).
   Il remplit le HUD du jeu de valeurs d'exemple, comme HUD.round, HUD.perks, HUD.weapon et HUD.prompt (section 11)
   et ptsHudInit (section 20), puis applique les variantes étudiées. Aucune logique du jeu ici, et rien de cela n'est
   dans le jeu : ce sont des réglages de la page.
     zone     'plein' (actuel) | '21:9' | '16:9' : les éléments ancrés aux côtés se placent dans la zone centrée
     echelle  'actuelle' : le module des points suit la hauteur, le reste a des tailles fixes ;
              'unique'   : tout suit la hauteur, avec la règle du module des points (clamp(52 px, 6,4 vh, 120 px)
                           rapporté à ses 69,12 px en 1080p)
     taille   multiplicateur de l'échelle unique (0,8 à 1,3) : piste d'une option « Taille du HUD »
     tout     l'échelle unique vaut aussi pour l'invite, les bonus, le lieu, la bannière, la mini-carte et la boussole
     cadre    repère de la zone 16:9 ; boss : emplacement réservé de la jauge ; mesures : distances au centre
   La page reçoit ses réglages par appliquer(cfg) ou par message ({ type: 'banc', cfg }) et répond { type: 'banc-info' }. */
const PERKS_BANC = {
  cuirasse: { name: 'Mastodonte', color: '#ca3d21', glow: '#ff6a4d', glyph: 'M' },
  mainleste: { name: 'Rechargement rapide', color: '#513dc2', glow: '#b4a6ff', glyph: 'R' },
  souffle: { name: 'Quick Revive', color: '#209784', glow: '#a8f0e4', glyph: 'Q' },
};
const CFG_BANC = { scene: 'bunker', zone: 'plein', echelle: 'actuelle', taille: 1, tout: false, cadre: false, boss: false, mesures: false, etiquette: '' };
const $ = (id) => document.getElementById(id);
let rempli = null;

const STYLE_BANC = `
#game { background: radial-gradient(ellipse at 50% 42%, #2c2b27 0%, #161713 55%, #0a0b0a 100%); }
#game::after { content: ''; position: absolute; inset: 0;
  background-image: linear-gradient(rgba(232,223,200,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(232,223,200,.06) 1px, transparent 1px);
  background-size: 100px 100px; background-position: calc(50% + 50px) calc(50% + 50px); }
#banc-cadre { position: fixed; top: 0; bottom: 0; left: 50%; width: min(100vw, calc(100vh * 16 / 9)); transform: translateX(-50%);
  box-shadow: inset 0 0 0 2px rgba(110, 190, 255, .6); pointer-events: none; z-index: 5; display: none; }
#banc-cadre span { position: absolute; left: 10px; top: 46%; font: 600 17px/1 'Barlow Condensed', sans-serif; letter-spacing: .08em; color: rgba(110,190,255,.9); }
body.v-cadre #banc-cadre { display: block; }
#banc-etiquette { position: fixed; left: 50%; top: 36%; transform: translate(-50%, -50%); z-index: 4; text-align: center;
  font: 700 26px/1.25 'Barlow Condensed', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: rgba(232,223,200,.42); white-space: pre; }
#banc-boss { position: absolute; left: 50%; top: var(--boss-top, 24px); transform: translateX(-50%); transform-origin: 0 0; width: min(560px, 70vw);
  text-align: center; pointer-events: none; display: none; font-family: 'Barlow Condensed', sans-serif; }
#banc-boss b { display: block; font-weight: 700; font-size: 15px; letter-spacing: .18em; text-transform: uppercase; color: #f5e6cf; }
#banc-boss i { display: block; height: 10px; margin-top: 5px; background: repeating-linear-gradient(90deg, rgba(245,230,207,.18) 0 12px, transparent 12px 20px);
  box-shadow: 0 0 0 1px rgba(245,230,207,.55); }
#banc-boss em { display: block; margin-top: 4px; font-style: normal; font-size: 13px; letter-spacing: .1em; color: rgba(245,230,207,.7); }
body.v-boss #banc-boss { display: block; }
#banc-mesures { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 6; display: none; }
body.v-mesures #banc-mesures { display: block; }
#banc-mesures line { stroke: rgba(255, 207, 106, .7); stroke-width: 2; stroke-dasharray: 8 6; }
#banc-mesures circle { fill: #ffcf6a; }
#banc-mesures text { font: 700 18px 'Barlow Condensed', sans-serif; fill: #ffcf6a; paint-order: stroke; stroke: #000; stroke-width: 4px; }
/* zone du HUD : marge latérale --zx (largeur de l'écran moins celle de la zone, divisée par deux) */
body.v-zone { --zx: max(0px, calc((100vw - 100vh * var(--zr)) / 2)); }
body.v-zone #bl, body.v-zone #zone-name { left: calc(var(--zx) + 26px + env(safe-area-inset-left, 0px)); }
body.v-zone #br, body.v-zone .ow-drive { right: calc(var(--zx) + 28px + env(safe-area-inset-right, 0px)); }
body.v-zone .ow-minimap { right: calc(var(--zx) + 22px + env(safe-area-inset-right, 0px)); }
body.v-zone .ow-compass { width: min(520px, calc(100vw - 2 * var(--zx) - 2 * clamp(132px, 15vw, 220px) - 80px)); }
/* échelle unique : zoom pour les blocs des coins (leurs ancres restent dans #bl et #br), scale pour les éléments
   placés seuls (leurs marges ne grandissent pas ; origine au point d'ancrage) */
body.v-unique #round, body.v-unique #perks, body.v-unique #weapon, body.v-unique .ow-drive > * { zoom: var(--k); }
body.v-unique #banc-boss { scale: var(--k); }
body.v-unique.v-tout .ow-minimap { scale: var(--k); transform-origin: 100% 0; }
body.v-unique.v-tout .ow-compass, body.v-unique.v-tout .ow-storm, body.v-unique.v-tout #banner, body.v-unique.v-tout #hint,
body.v-unique.v-tout #zone-name, body.v-unique.v-tout #prompt { scale: var(--k); transform-origin: 0 0; }
body.v-unique.v-tout #pu-active { scale: var(--k); transform-origin: 0 100%; }
body.v-unique.v-tout .ow-storm { top: calc(8px + 50px * var(--k) + env(safe-area-inset-top, 0px)); }
`;

/* Échelle unique : la règle du module des points, rapportée à sa taille en 1080p. */
function facteur(cfg) {
  return (Math.min(120, Math.max(52, 0.064 * innerHeight)) / 69.12) * (cfg.echelle === 'unique' ? cfg.taille : 1);
}

function preparer() {
  if (rempli) return;
  const st = document.createElement('style'); st.textContent = STYLE_BANC; document.head.append(st);
  const cadre = document.createElement('div'); cadre.id = 'banc-cadre'; cadre.innerHTML = '<span>zone 16:9</span>';
  const et = document.createElement('div'); et.id = 'banc-etiquette';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'banc-mesures';
  document.body.append(cadre, et, svg);
  const boss = document.createElement('div'); boss.id = 'banc-boss';
  boss.innerHTML = '<b>Jauge du boss</b><i></i><em>emplacement réservé · caractéristiques du boss à venir</em>';
  $('hud').append(boss);
}

window.remplir = function (sc) {
  preparer();
  if (rempli) return;
  rempli = sc;
  $('round').innerHTML = '<span class="num">7</span>';
  $('perks').innerHTML = Object.values(PERKS_BANC).map((p) =>
    `<span class="perk" style="--perk:${p.color};--perk-glow:${p.glow}" title="${p.name}">${p.glyph}</span>`).join('');
  $('w-name').textContent = 'STG-44';
  $('w-mag').textContent = '21'; $('w-res').textContent = '180';
  $('w-gren').innerHTML = '<i></i><i></i>';
  $('crosshair').style.setProperty('--gap', '8px');
  // HUD « portrait + points » d'Anthony, créé comme ptsHudInit (dans #bl, 12 px au-dessus du bloc des manches)
  const H = PointsHud.create({ points: 2750, name: 'Anthony', container: $('bl'), left: 0, bottom: 'calc(100% + 12px)' });
  H.setVisible(true);
  document.body.classList.add('zs-pts');
  if (sc === 'bunker') {
    $('prompt').hidden = false;
    $('prompt-text').innerHTML = 'Appuyez sur <kbd>F</kbd> pour acheter la Thompson';
    $('prompt-cost').textContent = 'Coût : 1200';
    $('pu-active').innerHTML = '<div class="pu double"><b>×2</b><span>Double points</span><em>23</em></div>';
  }
  if (sc === 'khamsin') {
    const hud = $('hud');
    const map = document.createElement('canvas'); map.className = 'ow-minimap'; map.width = 220; map.height = 220;
    const comp = document.createElement('canvas'); comp.className = 'ow-compass'; comp.width = 520; comp.height = 46;
    // bandeau de la tempête (owStormHud) : affiché hors de la zone jouable ou pendant une tempête ; ici, le pire cas
    // pour le haut de l'écran (boussole, bandeau, jauge du boss)
    const storm = document.createElement('div'); storm.className = 'ow-storm khamsin'; storm.textContent = 'Tempête mortelle · faites demi-tour';
    hud.append(map, comp, storm);
    // repères visuels seulement (le jeu y dessine le terrain et la boussole) : même taille, même place
    let g = map.getContext('2d');
    g.fillStyle = 'rgba(120, 96, 60, 0.85)'; g.fillRect(0, 0, 220, 220);
    g.strokeStyle = 'rgba(245, 230, 207, 0.7)'; g.lineWidth = 2; g.strokeRect(1, 1, 218, 218);
    g.fillStyle = 'rgba(40, 30, 18, 0.8)'; g.beginPath(); g.moveTo(110, 70); g.lineTo(150, 140); g.lineTo(70, 140); g.closePath(); g.fill();
    g.fillStyle = '#f5e6cf'; g.font = '600 18px "Barlow Condensed"'; g.textAlign = 'center'; g.fillText('mini-carte', 110, 190);
    g = comp.getContext('2d');
    g.fillStyle = 'rgba(0, 0, 0, 0.45)'; g.fillRect(0, 8, 520, 30);
    g.strokeStyle = 'rgba(245, 230, 207, 0.8)'; g.lineWidth = 2;
    for (let x = 10; x < 520; x += 25) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, x % 100 === 60 ? 14 : 22); g.stroke(); }
    g.fillStyle = '#f5e6cf'; g.font = '700 18px "Barlow Condensed"'; g.textAlign = 'center';
    [['NO', 60], ['N', 160], ['NE', 260], ['E', 360], ['SE', 460]].forEach(([t, x]) => g.fillText(t, x, 27));
    $('zone-name').textContent = 'Plateau des pyramides';
    $('zone-name').style.opacity = '0.95';
  }
};

window.appliquer = function (cfg) {
  const c = Object.assign(CFG_BANC, cfg || {});
  remplir(c.scene);
  const b = document.body.classList;
  b.toggle('v-zone', c.zone !== 'plein');
  document.body.style.setProperty('--zr', c.zone === '21:9' ? '2.33333' : '1.77778');
  b.toggle('v-unique', c.echelle === 'unique');
  b.toggle('v-tout', !!c.tout);
  b.toggle('v-cadre', !!c.cadre);
  b.toggle('v-boss', !!c.boss);
  b.toggle('v-mesures', !!c.mesures);
  const k = facteur(c);
  document.body.style.setProperty('--k', k.toFixed(4));
  // le module des points suit déjà la hauteur ; seul le multiplicateur de taille lui est ajouté (option size de create)
  const pts = document.querySelector('.zs-points');
  if (pts) {
    if (c.echelle === 'unique' && c.taille !== 1) pts.style.setProperty('--zs-s', `calc(clamp(52px, 6.4vh, 120px) * ${c.taille})`);
    else pts.style.removeProperty('--zs-s');
  }
  // jauge du boss : sous la boussole et la tempête dans le monde ouvert, en haut sinon
  const kb = c.echelle === 'unique' ? k : 1;
  document.body.style.setProperty('--boss-top', `${Math.round(rempli === 'khamsin' ? 8 + 88 * (c.tout ? kb : 1) : 24 * kb)}px`);
  $('banc-etiquette').textContent = c.etiquette || '';
  requestAnimationFrame(() => { tracerMesures(); informer(c, k); });
  return { k, zx: zoneMarge(c) };
};

function zoneMarge(c) {
  if (c.zone === 'plein') return 0;
  return Math.max(0, (innerWidth - innerHeight * (c.zone === '21:9' ? 21 / 9 : 16 / 9)) / 2);
}

function informer(c, k) {
  if (window.parent !== window) window.parent.postMessage({ type: 'banc-info', info: { w: innerWidth, h: innerHeight, k, zx: zoneMarge(c) } }, '*');
}

const SEL_MESURES = { points: '.zs-points__face', manche: '#round', atouts: '#perks', munitions: '#w-ammo', 'mini-carte': '.ow-minimap' };
function tracerMesures() {
  const svg = $('banc-mesures');
  if (!svg || !document.body.classList.contains('v-mesures')) return;
  const W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2;
  let s = `<circle cx="${cx}" cy="${cy}" r="5"/>`, n = 0;
  for (const [nom, sel] of Object.entries(SEL_MESURES)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2, d = Math.hypot(x - cx, y - cy);
    const f = 0.42 + 0.1 * (n++ % 4);                          // étiquettes décalées le long des traits (coins voisins)
    const tx = cx + (x - cx) * f, ty = cy + (y - cy) * f - 8;
    s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`
      + `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle">${nom} : ${Math.round(d)} px · ${Math.round((d / H) * 100)} % de la hauteur</text>`;
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

/* Mesures : boîtes des éléments, distance de leur centre au centre de l'écran. */
window.mesurer = function () {
  const W = innerWidth, Hh = innerHeight, cx = W / 2, cy = Hh / 2;
  const sel = { points: '.zs-points', portrait: '.zs-points__face', manche: '#round', atouts: '#perks', arme: '#w-name', munitions: '#w-ammo',
    grenades: '#w-gren', reticule: '#crosshair', invite: '#prompt', bonus: '#pu-active', minicarte: '.ow-minimap', boussole: '.ow-compass',
    lieu: '#zone-name', boss: '#banc-boss' };
  const out = { ecran: [W, Hh], k: Number(getComputedStyle(document.body).getPropertyValue('--k')) || 1 };
  for (const [k, s] of Object.entries(sel)) {
    const el = document.querySelector(s);
    if (!el || el.hidden || getComputedStyle(el).display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height && k !== 'reticule') continue;
    const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
    out[k] = { x: Math.round(r.left), y: Math.round(r.top), l: Math.round(r.width), h: Math.round(r.height),
      dCentre: Math.round(Math.hypot(ex - cx, ey - cy)), dxCentre: Math.round(ex - cx) };
  }
  return out;
};

addEventListener('message', (e) => { if (e.data && e.data.type === 'banc') appliquer(e.data.cfg); });
addEventListener('resize', () => { if (rempli) appliquer({}); });
