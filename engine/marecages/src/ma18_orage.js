/* ================================================================ L'orage ==
   Kit 2.0.7. Demande d'Anthony (31 octobre 2026) : « Concernant l'orage, on doit bien voir les flashs blancs de
   façon irrégulière (chaque phase d'orage doit être différente ; il ne doit jamais y avoir les mêmes) ainsi que
   les sons. […] Les éclairs peuvent parfois tomber sur la map de façon totalement aléatoire. S'ils tombent sur
   l'eau du marécage, crée une animation spectaculaire. Si l'éclair tombe à proximité du joueur, le joueur
   reçoit pas mal de dégâts, et tous les zombies à proximité se font tuer de façon immédiate. » Choisi avec lui :
   jusqu'à 70 PV au point d'impact, de moins en moins jusqu'à 10 m (il ne tue que si l'on est déjà blessé) ;
   un signe une seconde avant un impact tout proche (grésillement, feu de Saint-Elme) ; les zombies foudroyés
   ne rapportent pas de points (ils comptent pour la manche).

   Une phase d'orage (MA_OR.P) : tout est tiré au hasard (durée 1 min 15 à 4 min ; le foyer qui arrive de loin,
   passe plus ou moins près et s'éloigne ; un à trois moments forts, le premier dans le premier tiers, des éclairs
   épars entre deux, et toujours un éclair dans les nuages 3 à 9 s après le début ; le rythme des éclairs dans les nuages et
   au sol ; le nombre d'arcs par éclair ; la part d'éclairs qui « rampent » sous les nuages ; la teinte, la
   force, les rafales). Une phase trop proche d'une précédente (distance de leurs réglages ramenés de 0 à 1) est
   tirée de nouveau : deux phases ne se ressemblent jamais. Chaque éclair a sa forme, ses arcs, son tonnerre.

   Un éclair au sol : son canal (déplacement de points au hasard, de la base des nuages au sol, des branches
   qui s'arrêtent en l'air) ; 1 à 6 arcs en retour (tous les 30 à 140 ms) qui font clignoter la lumière, un
   courant qui se prolonge parfois ; la lumière de la scène vient de lui (ombres comprises), le ciel, la
   brume, la pluie et l'eau s'éclairent. Il tombe au hasard : près du foyer, n'importe où sur la carte, et
   parfois près du joueur (les arbres l'attirent : il frappe alors leur cime). Rien sous un toit.
     · sur l'eau : décharge en étoile à la surface, l'eau qui s'illumine, une colonne d'eau, la vapeur, l'onde
       de choc ; les Noyés à moins de 16 m sont foudroyés, la bête (si elle est là) fuit ;
     · sur la terre, un ponton, un arbre : gerbe de boue ou d'éclats, étincelles, fumée, une brûlure en
       fougère (figure de Lichtenberg) qui reste au sol ;
     · près du joueur (moins de 10 m, 14 m s'il est dans l'eau) : grésillement et étincelles bleues au point
       d'impact pendant 1 à 1,25 s avant ; puis jusqu'à 70 PV (moins en barque : la coque protège), le blanc,
       le coup de tonnerre, les oreilles qui sifflent ; à l'abri d'un toit, rien. Tous les zombies, Noyés et
       Stryges à moins de 10 m de l'impact (16 m sur l'eau) meurent sur le coup, carbonisés.
   Le tonnerre (calculé, voir plus bas) arrive après distance ÷ 343 m/s : le claquement, puis le roulement de
   tout le canal, de 8 à 15 s, au-dessus de la pluie.
   Rendu : un seul maillage pour tous les éclairs (MA_OR_SEG segments, dessinés en gélules à l'écran, mélange
   par maximum) ; le détail suit la distance (0,6 % de la distance de vue). Les zombies foudroyés : kind 'nuke'
   (pas de points), foudre: true (ni éliminations, ni carrière, ni rang : retouche « killZombie foudre » de
   patches.py ; maNoyeKill, maStrygeKill).
   Réglages : MA_ORC. Crochets : maOn('foudre', …), maOn('meteo', { what: 'orage' | 'fin-orage' }).
   ============================================================================================ */
const MA_ORC = {
  dur: [75, 240], d0: [1800, 4200], pass: [0, 1400],
  cloudRate: [6, 22], groundRate: [1.6, 7], nearP: [0.08, 0.22], mapP: [0.35, 0.6],
  strokes: [1.4, 4.2], cc: [0.1, 0.5], spider: [0, 0.45], tint: [0, 1], bright: [0.75, 1.3], boost: [0, 0.3], gust: [0.5, 3.5],
  same: 0.22,                                        // distance minimale entre deux phases (réglages de 0 à 1)
  danger: 10, dangerWater: 14, dmg: 70, kill: 10, killWater: 16, warn: [1.0, 1.25], lead: 0.55,
  base: [380, 650],                                  // m : base visible des nuages (l'éclair en part)
};
const MA_OR = { on: false, plan: null, P: null, t: 0, hist: [], fl: [], strikes: [], jobs: [], nS: 0, nC: 0, nNear: 0, nPhase: 0, kills: 0, last: null, hint: false,
  nextC: 0, nextG: 0, mesh: null, slots: [], seg: 0, dLo: Infinity, dHi: -Infinity, decals: [], decalI: 0, snd: null, ir: null, zap: { i: 0 },
  F: { i: 0, amb: 0, sky: 0, dir: new THREE.Vector3(0, 1, 0), col: new THREE.Color(1, 1, 1) } };
const MA_OR_SLOTS = 8, MA_OR_SEG = 8192;

/* ---------------------------------------------------------------- Les phases --
   Réglages d'une phase (ramenés de 0 à 1 pour la comparaison). */
const MA_OR_KEYS = ['dur', 'pass', 'cloudRate', 'groundRate', 'nearP', 'strokes', 'cc', 'spider', 'tint', 'bright', 'gust', 'mapP'];
function maStormDraw() {
  const C = MA_ORC, u = {};
  for (const k of MA_OR_KEYS) u[k] = Math.random();
  const v = (k) => lerp(C[k][0], C[k][1], u[k]);
  const P = { u, dur: v('dur'), pass: v('pass'), cloudRate: v('cloudRate'), groundRate: v('groundRate'), nearP: v('nearP'), strokes: v('strokes'), cc: v('cc'),
    spider: v('spider'), tint: v('tint'), bright: v('bright'), gust: v('gust'), mapP: v('mapP'), boost: rand(C.boost[0], C.boost[1]) };
  // un à trois moments forts ; le premier tôt (31 octobre : un orage dont le premier moment fort tombait au bout de
  // deux ou trois minutes passait pour absent)
  P.peaks = [];
  for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) P.peaks.push([(i === 0 ? rand(0.1, 0.32) : rand(0.15, 0.85)) * P.dur, rand(0.1, 0.28) * P.dur, rand(0.55, 1)]);
  return P;
}
function maStormDist(a, b) {
  let s = 0;
  for (const k of MA_OR_KEYS) s += (a.u[k] - b.u[k]) ** 2;
  return Math.sqrt(s / MA_OR_KEYS.length);
}
/* Nouvelle phase, jamais semblable aux précédentes de la partie. */
function maStormNew() {
  let P = null;
  for (let tries = 0; tries < 40; tries++) {
    P = maStormDraw();
    if (MA_OR.hist.every((h) => maStormDist(P, h) >= MA_ORC.same)) break;
  }
  MA_OR.hist.push(P);
  return P;
}
/* Le foyer : il arrive de loin (2 à 4 km), passe à pass m de l'endroit où l'on est au début, à mi-parcours
   environ, et s'éloigne. */
function maStormPath(P, cx, cz) {
  const b = rand(0, TAU), ux = Math.cos(b), uz = Math.sin(b), d0 = rand(MA_ORC.d0[0], MA_ORC.d0[1]);
  P.tc = P.dur * rand(0.35, 0.65);
  P.v = Math.max(6, Math.sqrt(Math.max(0, d0 * d0 - P.pass * P.pass)) / P.tc);
  P.cx = cx - uz * P.pass; P.cz = cz + ux * P.pass; P.ux = ux; P.uz = uz;
}
function maStormCell(P, t) { return [P.cx + P.ux * P.v * (t - P.tc), P.cz + P.uz * P.v * (t - P.tc)]; }
function maStormAct(P, t) {
  let a = 0;
  for (const [c, w, h] of P.peaks) a += h * Math.exp(-(((t - c) / w) ** 2));
  // entre deux moments forts, l'orage gronde encore (des éclairs plus rares, au hasard)
  return clamp(Math.max(a, 0.12), 0, 1) * clamp(t / 12, 0, 1) * clamp((P.dur - t) / 18, 0, 1);
}
function maOrListener() { return G.state === 'playing' ? player.pos : (viewCamera || camera).position; }
function maStormProx(P, t) {
  const L = maOrListener(), [x, z] = maStormCell(P, t);
  return 1 - owSmoothstep(700, 4200, Math.hypot(x - L.x, z - L.z));
}
/* Prévue par l'averse (ma17) : la phase commence à l'instant at (temps de l'averse), dure au plus max s. */
function maStormPlan(at, max) { MA_OR.plan = { at, max: Math.max(40, max) }; }
/* Tout de suite (console) ; soon : le premier moment fort dans 8 à 14 s. */
function maStormNow(soon) { if (MA_OR.plan) MA_OR.plan.at = MA_WX.t; else maStormPlan(MA_WX.t, 180); MA_OR.plan.soon = !!soon; }
function maStormStart(max, soon) {
  const O = MA_OR, P = maStormNew(), L = maOrListener();
  P.dur = Math.min(P.dur, max);
  for (const pk of P.peaks) { pk[0] = Math.min(pk[0], P.dur * 0.85); }
  if (soon) { P.peaks.sort((a, b) => a[0] - b[0]); P.peaks[0][0] = rand(8, 14); P.peaks[0][2] = Math.max(P.peaks[0][2], 0.85); P.peaks[0][1] = Math.max(P.peaks[0][1], 18); }
  maStormPath(P, L.x, L.z);
  O.P = P; O.t = 0; O.on = true; O.plan = null; O.nPhase++;
  O.nextC = rand(1.5, 5); O.nextG = soon ? rand(3, 6) : rand(6, 14);
  O.first = rand(3, 9); O.c0 = O.nC;                    // un premier éclair dans les nuages, quoi qu'il arrive : l'orage s'annonce
  maOrBus();                                            // prête avant le premier tonnerre
  if (!O.hint && G.state === 'playing') {
    O.hint = true;
    setTimeout(() => { if (G.state === 'playing' && O.on) HUD.hint('Orage : quand ça grésille et que des étincelles bleues jaillissent près de vous, la foudre va tomber là. Éloignez-vous !', 7); }, 6000);
  }
  maEmit('meteo', { what: 'orage', n: O.nPhase, dur: Math.round(P.dur) });
}
function maStormEnd(now) {
  const O = MA_OR;
  if (O.on) maEmit('meteo', { what: 'fin-orage', n: O.nPhase });
  O.on = false; O.P = null; O.plan = null;
  if (now) {
    // tout s'arrête (nouvelle partie, autre carte) : les éclairs en cours s'éteignent, leurs emplacements se libèrent
    for (const f of O.fl) maBoltFree(f.slot);
    for (const S of O.strikes) { maBoltFree(S.slot); maBoltFree(S.wslot); maBoltFree(S.sslot); }
    O.fl.length = 0; O.strikes.length = 0;
    for (let s = 0; s < MA_OR_SLOTS; s++) maBoltFree(s);
    O.zap.i = 0;
    if (MA.waterU && MA.waterU.uZapK) MA.waterU.uZapK.value = 0;
    maOrTry(maPrecursorStop);
  }
}
function maStormReset() { const O = MA_OR; maStormEnd(true); O.hist.length = 0; O.nS = O.nC = O.nNear = O.kills = 0; O.nPhase = 0; O.last = null; O.hint = false; O.jobs.length = 0; maFlashReset(); }
function maStormRainBoost() { const O = MA_OR; return O.on ? O.P.boost * maStormAct(O.P, O.t) * maStormProx(O.P, O.t) : 0; }
function maStormWind() { const O = MA_OR; return O.on ? O.P.gust * maStormAct(O.P, O.t) * (0.4 + 0.6 * maStormProx(O.P, O.t)) : 0; }
function maStormState() {
  const O = MA_OR;
  if (!O.on) return O.plan ? { prevu: Math.max(0, O.plan.at - MA_WX.t) } : null;
  const L = maOrListener(), [x, z] = maStormCell(O.P, O.t);
  return { phase: O.nPhase, t: O.t, dur: O.P.dur, foyer: Math.round(Math.hypot(x - L.x, z - L.z)), activite: maStormAct(O.P, O.t) };
}

/* ---------------------------------------------------------------- Chaque image -- */
function maStormUpdate(dt) {
  const O = MA_OR;
  MA_FLG.dt = Math.min(0.1, dt > 0 ? dt : 1 / 60);            // confort (ma00) : le pas de la garde des flashs
  if (O.plan && MA_WX.ep === 'averse' && MA_WX.t >= O.plan.at) maStormStart(O.plan.max, O.plan.soon);
  if (O.on) {
    const P = O.P;
    O.t += dt;
    if (O.t >= P.dur || MA_WX.ep !== 'averse') maStormEnd(false);
    else {
      const a = maStormAct(P, O.t), pr = maStormProx(P, O.t);
      if (O.first > 0 && O.t >= O.first) { O.first = 0; if (O.nC === O.c0) { maFlashCloud(P); O.nextC = Math.max(O.nextC, rand(2, 6)); } }
      O.nextC -= dt * a * (0.55 + 0.45 * pr);
      O.nextG -= dt * a * (0.3 + 0.7 * pr);
      if (O.nextC <= 0) { O.nextC = -Math.log(1 - Math.random() * 0.95) * 60 / P.cloudRate; maFlashCloud(P); }
      if (O.nextG <= 0) { O.nextG = -Math.log(1 - Math.random() * 0.95) * 60 / P.groundRate; maStrikePlan(maStrikePick(P)); }
    }
  }
  maThunderJobs(dt);
  maStrikesUpdate(dt);
  for (const f of O.fl) f.t += dt;
  maFlashUpdate();
  maBoltFlush();
}

/* ---------------------------------------------------------------- Lumière des éclairs --
   Un éclair : une suite d'impulsions (les arcs en retour : montée immédiate, décroissance 20-40 ms ; un courant
   qui se prolonge parfois ; la lueur du traceur juste avant). Intensité de la scène : force × proximité. */
function maPulsesGround(P) {
  const n = 1 + Math.max(0, Math.round(-Math.log(1 - Math.random() * 0.98) * (P.strokes - 1))), out = [[-rand(0.02, 0.05), 0.07, 0.004, 0.012]];
  let t = 0;
  for (let i = 0; i < Math.min(6, n); i++) {
    const a = i === 0 ? 1 : rand(0.35, 0.92), dec = rand(0.02, 0.04);
    out.push([t, a, 0.0006, dec]);
    if (Math.random() < P.cc && i === n - 1) out.push([t + 0.01, rand(0.22, 0.42), 0.02, rand(0.08, 0.22)]);
    t += rand(0.03, 0.14);
  }
  return out;
}
function maPulsesCloud() {
  const out = [], n = 2 + Math.floor(Math.random() * 8);
  let t = 0;
  for (let i = 0; i < n; i++) { out.push([t, rand(0.3, 1) * (i < 2 ? 1 : 0.8), rand(0.008, 0.025), rand(0.04, 0.16)]); t += rand(0.02, 0.2); }
  return out;
}
function maPulse(L, t) {
  let v = 0;
  for (const [t0, a, r, d] of L) { const x = t - t0; if (x > 0) v += a * (1 - Math.exp(-x / r)) * Math.exp(-x / d); }
  return v;
}
function maFlashColor(P, out) {
  // blanc bleuté ; parfois un peu violet, parfois chaud (vu à travers la pluie)
  const t = P ? P.tint : 0.3;
  return out.setRGB(lerp(0.78, 1.0, t > 0.7 ? (t - 0.7) / 0.3 : 0) * (t < 0.3 ? 0.92 + t * 0.25 : 1), lerp(0.84, 0.88, t), lerp(1.0, 0.86, t > 0.7 ? (t - 0.7) / 0.3 : 0));
}
/* Éclair dans les nuages : le ciel s'allume de ce côté, la brume, un peu la scène ; parfois un éclair qui rampe
   sous les nuages ; le tonnerre roule plus tard. */
function maFlashCloud(P) {
  const O = MA_OR, L = maOrListener(), [cx, cz] = maStormCell(P, O.t);
  const x = cx + rand(-900, 900), z = cz + rand(-900, 900), h = rand(1400, 3800), d = Math.hypot(x - L.x, z - L.z);
  const f = { t: 0, pulses: maPulsesCloud(), dir: new THREE.Vector3(x - L.x, h * 0.55, z - L.z).normalize(), col: maFlashColor(P, new THREE.Color()),
    k: P.bright * 2.4 / (1 + (d / 2200) ** 2), amb: P.bright * 1.3 / (1 + (d / 3000) ** 2), sky: 1, slot: -1, life: 1.8 };
  if (Math.random() < P.spider * (0.4 + 0.6 * maStormProx(P, O.t)) && d < 5000) {
    // l'éclair qui rampe sous les nuages : de longues branches presque horizontales
    const base = rand(MA_ORC.base[0], MA_ORC.base[1]) + 120, a = rand(0, TAU), len = rand(500, 1500);
    const pts = maBoltPath(x, base, z, x + Math.cos(a) * len, base + rand(-60, 60), z + Math.sin(a) * len, 0.42, 9, 0.18);
    const br = [];
    for (let i = 0; i < 6; i++) { const k = (Math.random() * (pts.length / 3 - 2)) | 0, sx = pts[k * 3], sy = pts[k * 3 + 1], sz = pts[k * 3 + 2], b = a + rand(-1.4, 1.4), l = rand(120, 420); br.push(maBoltPath(sx, sy, sz, sx + Math.cos(b) * l, sy - rand(0, 90), sz + Math.sin(b) * l, 0.45, 8, 0.18)); }
    f.slot = maBoltPut([[pts, 1, 0.9, 0], ...br.map((b) => [b, 0.55, 0.6, 0])]);
    f.k *= 1.6; f.amb *= 1.3;
  }
  O.fl.push(f); O.nC++;
  if (d < 9000) maThunderJob(maThunderChannel(x, MA.water, z, { ground: false, Hc: h - 500, branches: 2 + ((Math.random() * 3) | 0), cloudLen: rand(2500, 6000) }, Math.random), OW.t, x, z, d);
}
/* La lumière totale (maApplyLight, ma02) : directe (direction de l'éclair), ambiante, ciel. */
function maFlashUpdate() {
  const O = MA_OR, F = O.F;
  F.i = 0; F.amb = 0; F.sky = 0;
  _orV.set(0, 0, 0); _orC.setRGB(0, 0, 0);
  for (let j = O.fl.length - 1; j >= 0; j--) {
    const f = O.fl[j], v = maFlashV(f, maPulse(f.pulses, f.t));      // confort (ma00) : l'enveloppe de l'éclair
    if (f.slot >= 0) maBoltI(f.slot, Math.min(1.4, v * 1.2 + (v > 0.02 ? 0.06 : 0)));
    if (f.t > f.life) { if (f.slot >= 0) maBoltFree(f.slot); O.fl.splice(j, 1); continue; }
    const i = v * f.k;
    F.i += i; F.amb += v * f.amb; F.sky = Math.max(F.sky, v * f.sky);
    _orV.addScaledVector(f.dir, i + 1e-4); _orC.r += f.col.r * (i + 1e-4); _orC.g += f.col.g * (i + 1e-4); _orC.b += f.col.b * (i + 1e-4);
  }
  if (F.i > 0) { F.dir.copy(_orV).normalize(); const s = _orC.r + _orC.g + _orC.b; F.col.setRGB(_orC.r / s * 3, _orC.g / s * 3, _orC.b / s * 3); }
  maFlashGarde();                                       // confort (ma00) : plafond, trois flashs par seconde au plus
}
const _orV = new THREE.Vector3(), _orC = new THREE.Color();
function maStormFlash() { return MA_OR.F; }
/* Part de rouge de la lumière des éclairs (0 : l'orage, blanc bleuté ; 1 : l'éclair rouge d'une arrivée de
   Stryge, ma19) : la brume et le ciel prennent alors sa couleur. */
function maFlashRed() { const F = MA_OR.F; return F.i > 0 ? clamp((F.col.r - F.col.g) / Math.max(0.01, F.col.r) * 1.15, 0, 1) : 0; }

/* ---------------------------------------------------------------- Formes des éclairs --
   Déplacement de points au milieu (fractale) : chaque segment plus long que min est coupé en deux, son milieu
   poussé au hasard (disp × longueur, moins en hauteur : hv). Vu de loin, inutile de détailler ce que l'œil ne
   distingue pas : avec V (le point de vue), un segment n'est coupé que s'il dépasse aussi 0,6 % de sa distance. */
function maBoltPath(ax, ay, az, bx, by, bz, disp, min, hv = 0.35, V = null) {
  let P = [ax, ay, az, bx, by, bz];
  for (let it = 0; it < 16; it++) {
    const Q = [P[0], P[1], P[2]];
    let cut = false;
    for (let i = 3; i < P.length; i += 3) {
      const x0 = P[i - 3], y0 = P[i - 2], z0 = P[i - 1], x1 = P[i], y1 = P[i + 1], z1 = P[i + 2], L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const lim = V ? Math.max(min, Math.hypot((x0 + x1) / 2 - V.x, (y0 + y1) / 2 - V.y, (z0 + z1) / 2 - V.z) * 0.006) : min;
      if (L > lim) {
        const k = L * disp;
        Q.push((x0 + x1) / 2 + (Math.random() - 0.5) * k, (y0 + y1) / 2 + (Math.random() - 0.5) * k * hv, (z0 + z1) / 2 + (Math.random() - 0.5) * k);
        cut = true;
      }
      Q.push(x1, y1, z1);
    }
    P = Q;
    if (!cut) break;
  }
  return P;
}
const maOrEye = () => { const L = maOrListener(); return { x: L.x, y: (G.state === 'playing' ? player.gy + 1.6 : L.y), z: L.z }; };
/* Un éclair au sol : canal principal (du nuage au point d'impact), branches qui s'arrêtent en l'air. */
function maBoltGround(x, y, z, P) {
  const H = rand(MA_ORC.base[0], MA_ORC.base[1]), a = rand(0, TAU), off = rand(0.05, 0.35) * H, V = maOrEye();
  const main = maBoltPath(x + Math.cos(a) * off, y + H, z + Math.sin(a) * off, x, y, z, 0.32, 0.45, 0.3, V);
  const parts = [[main, 1, 1, 0]], n = main.length / 3;
  for (let i = 0, nb = 5 + Math.floor(Math.random() * 9); i < nb; i++) {
    const k = Math.floor(n * rand(0.05, 0.75)), sx = main[k * 3], sy = main[k * 3 + 1], sz = main[k * 3 + 2], h = sy - y;
    const b = rand(0, TAU), l = h * rand(0.12, 0.42), dy = l * rand(0.6, 1.1);
    const br = maBoltPath(sx, sy, sz, sx + Math.cos(b) * l * 0.7, sy - dy, sz + Math.sin(b) * l * 0.7, 0.4, 0.6, 0.4, V);
    parts.push([br, rand(0.3, 0.6), 0.6, 0]);
    if (l > 60 && Math.random() < 0.6) {
      const m = Math.floor(br.length / 3 * rand(0.2, 0.7)), qx = br[m * 3], qy = br[m * 3 + 1], qz = br[m * 3 + 2], c = b + rand(-1, 1), l2 = l * rand(0.25, 0.5);
      parts.push([maBoltPath(qx, qy, qz, qx + Math.cos(c) * l2 * 0.7, qy - l2, qz + Math.sin(c) * l2 * 0.7, 0.42, 0.6, 0.45, V), rand(0.18, 0.35), 0.45, 0]);
    }
  }
  return parts;
}
/* La décharge sur l'eau : des arcs en étoile qui courent sur la surface en sautant au-dessus (arceaux de 0,1 à
   0,7 m). D : directions, longueurs, hauteurs (tirées une fois par impact) ; k de 1 à 0 : les arcs raccourcissent
   et se raréfient. Redessinés toutes les 40 à 90 ms : ils changent de forme, pas de place. */
function maBoltWaterDirs(scale = 1) {
  const n = 10 + Math.floor(Math.random() * 8), D = [];
  for (let i = 0; i < n; i++) D.push([(i / n) * TAU + rand(-0.25, 0.25), rand(3, 15) * scale, rand(0.1, 0.7)]);
  return D;
}
function maBoltWater(x, z, D, k = 1) {
  const parts = [], y = MA.water + 0.04;
  const arch = (p, h) => {
    const m = p.length / 3;
    for (let i = 0; i < m; i++) { const f = i / Math.max(1, m - 1); p[i * 3 + 1] = y + Math.sin(Math.PI * f) * h * (0.6 + 0.8 * Math.random()) * (1 - 0.3 * f); }
    return p;
  };
  for (const [a0, l0, h] of D) {
    if (Math.random() > 0.35 + 0.65 * k) continue;
    const a = a0 + rand(-0.12, 0.12), l = l0 * rand(0.7, 1.05) * (0.55 + 0.45 * k);
    const p = arch(maBoltPath(x, y, z, x + Math.cos(a) * l, y, z + Math.sin(a) * l, 0.45, 0.45, 0), h);
    parts.push([p, rand(0.45, 0.85), 0.22, 0.15]);
    if (l > 6) {
      const j = Math.floor(p.length / 3 * rand(0.35, 0.65)), b = a + rand(-0.9, 0.9), l2 = l * rand(0.3, 0.5);
      parts.push([arch(maBoltPath(p[j * 3], y, p[j * 3 + 2], p[j * 3] + Math.cos(b) * l2, y, p[j * 3 + 2] + Math.sin(b) * l2, 0.5, 0.4, 0), h * 0.6), 0.4, 0.16, 0.15]);
    }
  }
  return parts;
}
/* Feu de Saint-Elme : de petites aigrettes violettes qui montent du sol (et des objets) au point d'impact. */
function maBoltStreamers(x, y, z) {
  const parts = [];
  for (let i = 0, n = 5 + Math.floor(Math.random() * 5); i < n; i++) {
    const sx = x + rand(-1, 1), sz = z + rand(-1, 1), l = rand(0.3, 1.3);
    parts.push([maBoltPath(sx, y + 0.05, sz, sx + rand(-0.3, 0.3), y + l, sz + rand(-0.3, 0.3), 0.42, 0.09, 0.6), rand(0.35, 0.7), 0.035, 1]);
  }
  return parts;
}

/* ---------------------------------------------------------------- Le maillage des éclairs --
   Un seul maillage (MA_OR_SEG segments, MA_OR_SLOTS éclairs à la fois) : chaque segment, un ruban face à la
   caméra : un cœur blanc (quelques centimètres de près, jamais moins d'un pixel), un halo bleuté plus large
   (la pluie diffuse la lumière) qui s'éteint avant le bord du ruban. Seule la partie modifiée des tampons
   repart vers la carte graphique (maBoltFlush, une fois par image). */
function maBoltMesh(root) {
  const N = MA_OR_SEG, nv = N * 4;
  const A = new Float32Array(nv * 3), B = new Float32Array(nv * 3), E = new Float32Array(nv * 4), S = new Float32Array(nv * 2), idx = new Uint16Array(N * 6);
  for (let i = 0; i < N; i++) { const b = i * 4, j = i * 6; idx[j] = b; idx[j + 1] = b + 1; idx[j + 2] = b + 2; idx[j + 3] = b + 1; idx[j + 4] = b + 3; idx[j + 5] = b + 2; }
  for (let v = 0; v < nv; v++) { E[v * 4] = v & 1 ? 1 : -1; E[v * 4 + 1] = (v >> 1) & 1; S[v * 2] = -1; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('aA', new THREE.BufferAttribute(A, 3)); geo.setAttribute('aB', new THREE.BufferAttribute(B, 3));
  geo.setAttribute('aE', new THREE.BufferAttribute(E, 4)); geo.setAttribute('aS', new THREE.BufferAttribute(S, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const U = { uBI: { value: new Array(MA_OR_SLOTS).fill(0) }, uRes: MA_WXU.uRes, uCol: { value: new THREE.Vector3(0.62, 0.7, 1) } };
  // chaque segment : un rectangle construit à l'écran (en pixels), plus long que le segment d'une demi-largeur à
  // chaque bout ; le dessin est une gélule (distance au segment) : les segments se raccordent sans bandes ni
  // coupures ; mélange par maximum (pas d'addition aux raccords)
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: [
      'attribute vec3 aA, aB; attribute vec4 aE; attribute vec2 aS;',
      `uniform float uBI[${MA_OR_SLOTS}]; uniform vec2 uRes;`,
      'varying float vS, vU, vL, vW, vC, vI, vT;',
      'void main() {',
      '  float I = 0.0;',
      `  for (int k = 0; k < ${MA_OR_SLOTS}; k++) if (float(k) == aS.x) I = uBI[k];`,
      '  vec4 a = modelViewMatrix * vec4(aA, 1.0), b = modelViewMatrix * vec4(aB, 1.0);',
      // un segment qui passe derrière la caméra : coupé au plan proche
      '  float za = -a.z, zb = -b.z, zn = 0.15;',
      '  if (za < zn && zb < zn) I = 0.0;',
      '  else if (za < zn) { a = mix(a, b, (zn - za) / (zb - za)); za = zn; }',
      '  else if (zb < zn) { b = mix(b, a, (zn - zb) / (za - zb)); zb = zn; }',
      '  vI = 0.0;',
      '  if (I <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
      '  vec4 ca = projectionMatrix * a, cb = projectionMatrix * b;',
      '  vec2 hr = 0.5 * uRes, pa = ca.xy / ca.w * hr, pb = cb.xy / cb.w * hr, dir = pb - pa;',
      '  float L = length(dir); dir = L > 1e-3 ? dir / L : vec2(1.0, 0.0);',
      '  float f = hr.y * projectionMatrix[1][1];',            // pixels par mètre à 1 m
      '  bool atA = aE.y < 0.5; float z = atA ? za : zb;',
      '  float w = max(aE.z * (0.8 + z * 0.004) * f / z, 6.0);',  // demi-largeur du halo (px)
      '  float c = max((0.05 * aE.z + 0.012) * f / z, 0.85);',   // demi-largeur du cœur (px)
      '  vec2 p = (atA ? pa - dir * w : pb + dir * w) + vec2(-dir.y, dir.x) * w * aE.x;',
      '  vec4 cp = atA ? ca : cb;',
      // position déjà divisée (w = 1) : les variables glissent linéairement à l'écran ; au-delà du plan lointain,
      // l'éclair reste dessiné, tout au fond
      '  gl_Position = vec4(p / hr, min(cp.z / cp.w, 0.99999), 1.0);',
      '  vS = aE.x * w; vU = atA ? -w : L + w; vL = L; vW = w; vC = c;',
      '  vI = I * aE.w * (0.3 + 0.7 * exp(-z / 1100.0)); vT = aS.y;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uCol; varying float vS, vU, vL, vW, vC, vI, vT;',
      'void main() {',
      '  if (vI <= 0.0) discard;',
      '  float u = vU < 0.0 ? -vU : (vU > vL ? vU - vL : 0.0), d = sqrt(vS * vS + u * u), g = d / vW;',
      '  if (g >= 1.0) discard;',
      '  float core = exp(-(d * d) / (vC * vC) * 1.4), glow = exp(-g * 4.0) * (1.0 - smoothstep(0.55, 1.0, g)) * 0.45;',
      // teinte : 0 blanc bleuté (l'orage), 1 violet (feu de Saint-Elme), 2 rouge sang (l'arrivée des Stryges, ma19 : cœur
      // rose, halo plus large)
      '  bool red = vT > 1.5;',
      '  vec3 tint = red ? vec3(1.0, 0.07, 0.1) : mix(uCol, vec3(0.72, 0.42, 1.0), vT);',
      '  vec3 col = mix(tint, red ? vec3(1.0, 0.72, 0.74) : vec3(1.0), core * (red ? 0.6 : 0.85)) * (core * 2.6 + glow * (red ? 1.7 : 1.0)) * vI;',
      '  gl_FragColor = vec4(col, 1.0);',
      '  #include <encodings_fragment>',
      '}',
    ].join('\n'),
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 9; mesh.name = 'éclairs';
  root.add(mesh);
  return { mesh, geo, A, B, E, S, U };
}
/* Écrit un éclair (parts : [[points, éclat, largeur, teinte 0 blanc-bleu / 1 violet / 2 rouge], …]) dans un emplacement
   libre ; renvoie l'emplacement (−1 : plus de place). */
function maBoltPut(parts) {
  const O = MA_OR, M = O.mesh;
  if (!M) return -1;
  let slot = -1;
  for (let s = 0; s < MA_OR_SLOTS; s++) if (!O.slots[s]) { slot = s; break; }
  if (slot < 0) return -1;
  let nseg = 0;
  for (const [p] of parts) nseg += p.length / 3 - 1;
  if (nseg > MA_OR_SEG / 2) return -1;
  // une plage libre (jamais sur les segments d'un éclair encore allumé : tampon circulaire, sinon le premier trou)
  const at = maBoltAlloc(nseg);
  if (at < 0) return -1;
  O.seg = at;
  let s0 = O.seg;
  for (const [p, br, w, tint] of parts) {
    for (let i = 3; i < p.length; i += 3) {
      for (let v = 0; v < 4; v++) {
        const k = (s0 * 4 + v);
        M.A[k * 3] = p[i - 3]; M.A[k * 3 + 1] = p[i - 2]; M.A[k * 3 + 2] = p[i - 1];
        M.B[k * 3] = p[i]; M.B[k * 3 + 1] = p[i + 1]; M.B[k * 3 + 2] = p[i + 2];
        M.E[k * 4 + 2] = w; M.E[k * 4 + 3] = br; M.S[k * 2] = slot; M.S[k * 2 + 1] = tint;
      }
      s0++;
    }
  }
  O.range[slot] = [O.seg, s0];
  maBoltDirty(O.seg, s0);
  O.seg = s0;
  O.slots[slot] = true;
  M.U.uBI.value[slot] = 0;
  return slot;
}
function maBoltI(slot, v) {
  const O = MA_OR;
  if (!O.mesh || slot < 0) return;
  O.mesh.U.uBI.value[slot] = Math.max(0, v);
}
/* Éclair fini : son emplacement se libère, ses segments ne lui appartiennent plus. */
function maBoltFree(slot) {
  const O = MA_OR;
  if (!O.mesh || slot < 0) return;
  O.mesh.U.uBI.value[slot] = 0;
  if (!O.slots[slot]) return;
  O.slots[slot] = false;
  const r = O.range[slot], M = O.mesh;
  if (r) { for (let s = r[0]; s < r[1]; s++) for (let v4 = 0; v4 < 4; v4++) { const k = s * 4 + v4; if (M.S[k * 2] === slot) M.S[k * 2] = -1; } maBoltDirty(r[0], r[1]); O.range[slot] = null; }
}
function maBoltAlloc(n) {
  const O = MA_OR, R = [];
  for (let s = 0; s < MA_OR_SLOTS; s++) if (O.slots[s] && O.range[s]) R.push(O.range[s]);
  const fits = (a) => a >= 0 && a + n <= MA_OR_SEG && R.every((r) => a + n <= r[0] || a >= r[1]);
  const C = [O.seg, 0, ...R.map((r) => r[1])], W = (a) => (a - O.seg + MA_OR_SEG) % MA_OR_SEG;
  C.sort((a, b) => W(a) - W(b));
  for (const c of C) if (fits(c)) return c;
  return -1;
}
/* Segments modifiés depuis l'image d'avant ; envoyés une fois par image (le tampon entier fait 1,5 Mo). */
function maBoltDirty(a, b) { const O = MA_OR; if (a < O.dLo) O.dLo = a; if (b > O.dHi) O.dHi = b; }
function maBoltFlush() {
  const O = MA_OR, M = O.mesh;
  if (!M || !(O.dHi > O.dLo)) return;
  for (const [k, n] of [['aA', 3], ['aB', 3], ['aE', 4], ['aS', 2]]) {
    const A = M.geo.attributes[k];
    A.updateRange.offset = O.dLo * 4 * n; A.updateRange.count = (O.dHi - O.dLo) * 4 * n; A.needsUpdate = true;
  }
  O.dLo = Infinity; O.dHi = -Infinity;
}

/* Couleurs des fumées et vapeurs, données en sRVB, passées en linéaire (les sprites des effets ne le sont pas). */
const maOrLin = (h) => new THREE.Color(h).convertSRGBToLinear().getHex();
const MA_OR_SMOKE = maOrLin(0x2f2d2b), MA_OR_STEAM = maOrLin(0x59636a), MA_OR_MUD = maOrLin(0x3e3428), MA_OR_CHAR = maOrLin(0x3a3632), MA_OR_COL = maOrLin(0x7c8890);
/* ---------------------------------------------------------------- Les impacts --
   Où : près du joueur (3 à 28 m, à ciel ouvert), sinon n'importe où sur la carte (40 à 450 m de lui), sinon
   près du foyer (à 600 m près). Les arbres attirent la foudre (leur cime, à moins de 12 m). */
function maStrikePick(P) {
  const O = MA_OR, L = maOrListener(), pr = maStormProx(P, O.t);
  const near = G.state === 'playing' && Math.random() < P.nearP * (0.35 + 0.65 * pr);
  for (let tries = 0; tries < 24; tries++) {
    let x, z;
    if (near) { const a = rand(0, TAU), r = 3 + 25 * Math.pow(Math.random(), 1.35); x = L.x + Math.cos(a) * r; z = L.z + Math.sin(a) * r; }
    else if (Math.random() < P.mapP) { const a = rand(0, TAU), r = Math.sqrt(rand(40 * 40, 450 * 450)); x = L.x + Math.cos(a) * r; z = L.z + Math.sin(a) * r; }
    else { const [cx, cz] = maStormCell(P, O.t); x = cx + (Math.random() + Math.random() + Math.random() - 1.5) * 800; z = cz + (Math.random() + Math.random() + Math.random() - 1.5) * 800; }
    const s = maWxSurface(x, z);
    if (!s || maRoofOver(x, z)) continue;
    const S = { x, z, y: s[1], surf: s[0], top: s[1], near };
    // un arbre tout près : la foudre frappe sa cime
    if (Math.random() < 0.55) {
      let best = null, bd = 12;
      for (const t of MA.trees || []) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t; } }
      if (best) { S.x = best.x; S.z = best.z; S.y = best.y; S.top = best.y + best.h; S.surf = 3; S.tree = best; S.wet = best.y < MA.water - 0.05; }
    }
    return S;
  }
  return null;
}
/* Un impact prévu : le son se calcule pendant le délai ; tout près du joueur, le grésillement l'annonce. */
function maStrikePlan(S, o = {}) {
  if (!S) return null;
  const O = MA_OR, P = O.P, L = maOrListener();
  const d = Math.hypot(S.x - L.x, S.z - L.z), dangerR = maStrikeDanger(S) + 4;
  S.d = d; S.warn = G.state === 'playing' && d < dangerR;
  S.t = 0; S.at = o.at !== undefined ? o.at : S.warn ? rand(MA_ORC.warn[0], MA_ORC.warn[1]) : MA_ORC.lead;
  S.parts = maBoltGround(S.x, S.top, S.z, P);
  S.pulses = maPulsesGround(P || { strokes: 2.5, cc: 0.3 });
  S.col = maFlashColor(P, new THREE.Color());
  S.k = (P ? P.bright : 1) * 9 / (1 + (d / 200) ** 2); S.amb = (P ? P.bright : 1) * 2.6 / (1 + (d / 600) ** 2);
  S.dir = new THREE.Vector3(S.x - L.x, 120, S.z - L.z).normalize();      // le milieu du canal visible : des ombres longues
  S.slot = -1; S.hit = false; S.wslot = -1; S.sslot = -1;
  if (S.warn) { S.sslot = maBoltPut(maBoltStreamers(S.x, S.top, S.z)); maOrTry(() => maPrecursorStart(S)); }
  O.strikes.push(S); O.nS++;
  if (S.warn) O.nNear++;
  // le tonnerre : le bas du canal est celui qu'on verra ; il continue dans le nuage
  const main = S.parts[0][0], low = [];
  for (let i = main.length - 3; i >= 0; i -= 3) low.push(main[i], main[i + 1], main[i + 2]);
  maThunderJob(maThunderChannel(S.x, S.y, S.z, { ground: true, low, Hc: rand(1300, 2600), slant: 400, branches: 2 + ((Math.random() * 3) | 0), cloudLen: rand(2000, 5000) }, Math.random), OW.t + S.at, S.x, S.z, d, S.warn && d < 30);
  return S;
}
/* Dans l'eau, le courant porte plus loin (la foudre tombe dans l'eau, ou sur un arbre qui a le pied dans l'eau). */
const maStrikeInWater = (S) => S.surf === 0 || !!S.wet;
function maStrikeDanger(S) { return maStrikeInWater(S) && (MA_SWIM.on || (VEH.drive && VEH.drive.T.boat) || maDepth(player.pos.x, player.pos.z) > 0.15) ? MA_ORC.dangerWater : MA_ORC.danger; }
/* Console, quêtes : un impact en (x, z) (o.warn : avec l'avertissement). */
function maStrikeAt(x, z, o = {}) {
  const s = maWxSurface(x, z);
  if (!s) return null;
  const S = maStrikePlan({ x, z, y: s[1], surf: s[0], top: s[1], near: true }, o);
  return S ? { x: S.x, z: S.z, surface: ['eau', 'bois', 'boue', 'arbre'][S.surf], dans: S.at } : null;
}
function maStrikesUpdate(dt) {
  const O = MA_OR;
  let LI = 0, LS = null;
  for (let j = O.strikes.length - 1; j >= 0; j--) {
    const S = O.strikes[j];
    S.t += dt;
    if (S.warn && !S.hit) maPrecursorFx(S, dt);
    if (!S.hit && S.t >= S.at) maStrikeHit(S);
    if (S.hit) {
      const v = maFlashV(S, maPulse(S.pulses, Math.max(S.t - S.at, 0.003)));        // (l'image de l'impact : déjà allumé ; enveloppe : ma00)
      if (S.slot >= 0) maBoltI(S.slot, Math.min(1.5, v * 1.3 + (v > 0.02 ? 0.08 : 0)));
      // les arcs sur l'eau changent de forme toutes les 40 à 90 ms
      if (S.wdirs && S.t - S.at < 0.7) { S.wT -= dt; if (S.wT <= 0) { S.wT = rand(0.04, 0.09); maBoltFree(S.wslot); S.wslot = maBoltPut(maBoltWater(S.x, S.z, S.wdirs, 1 - (S.t - S.at) / 0.7)); } }
      if (S.wslot >= 0) maBoltI(S.wslot, S.t - S.at < 0.7 ? Math.min(1.2, (v * 1.1 + 0.25 * maBat(0, S.t)) * (1 - (S.t - S.at) / 0.7)) : 0);
      if (S.t - S.at < 0.5 && v * 45 > LI) { LI = v * 45; LS = S; }
      if (S.later) for (let k = S.later.length - 1; k >= 0; k--) if (S.t - S.at >= S.later[k][0]) { const f = S.later[k][1]; S.later.splice(k, 1); f(); }
      if (S.t - S.at > 1.6) { maBoltFree(S.slot); maBoltFree(S.wslot); O.strikes.splice(j, 1); }
    }
  }
  // la lumière au point d'impact (la lumière des explosions du moteur : elle s'éteint d'elle-même en partie ;
  // ailleurs, au menu, c'est ici qu'elle s'éteint)
  LI *= MA_FLG.k * (maFlashsReduits() ? 0.5 : 1);              // confort (ma00) : la lumière de l'impact suit la garde des flashs
  const BL = FX.boomLight;
  if (BL) {
    if (LS) { BL.position.set(LS.x, LS.top + 1.2, LS.z); BL.color.setRGB(0.75, 0.82, 1); BL.decay = 2; }
    if (G.state === 'playing') { if (LS) { BL.intensity = Math.max(BL.intensity, LI); FX.boomT = Math.max(FX.boomT || 0, 0.05); } }
    else if (G.state !== 'gameover') BL.intensity = LI;
  }
  // l'eau qui s'illumine (nuanceur de l'eau)
  const Z = O.zap;
  if (Z.i > 0) { Z.i = Math.max(0, Z.i - dt * 1.5); if (MA.waterU && MA.waterU.uZap) MA.waterU.uZapK.value = Z.i * maBat(0.6, OW.t); }   // confort (ma00) : battement lent au lieu d'un scintillement
}
/* L'arc en retour : lumière, forme, effets selon la surface, dégâts, morts. */
function maStrikeHit(S) {
  const O = MA_OR;
  S.hit = true;
  if (S.sslot >= 0) { maBoltFree(S.sslot); S.sslot = -1; }
  maOrTry(maPrecursorStop);
  S.slot = maBoltPut(S.parts);
  maBoltI(S.slot, 1.3);                                 // allumé dès cette image (la lumière l'est déjà)
  O.fl.push({ t: S.t - S.at, pulses: S.pulses, dir: S.dir, col: S.col, k: S.k, amb: S.amb, sky: 1, slot: -1, life: 1.6 });
  const x = S.x, z = S.z, y = S.y, top = S.top;
  // étincelles, fumée
  for (let i = 0; i < 70; i++) { const a = rand(0, TAU), sp = rand(2, 9); FX.sparks.emit(x, top + 0.2, z, Math.cos(a) * sp, rand(1, 7), Math.sin(a) * sp, rand(0.25, 0.9), 0.75, 0.85, 1); }
  if (S.surf === 0) {
    // l'eau : décharge en étoile, colonne, vapeur, onde de choc
    S.wdirs = maBoltWaterDirs(); S.wT = rand(0.04, 0.09);
    S.wslot = maBoltPut(maBoltWater(x, z, S.wdirs));
    // l'éblouissement là où l'éclair entre dans l'eau, la colonne d'eau et de vapeur (8 à 10 m), les gerbes
    spawnPuff(x, MA.water + 0.8, z, 7, 0.3, 0xbcd2ff, 0.95, 0, true, TEX.flare);
    spawnPuff(x, MA.water + 4.2, z, rand(8.5, 10.5), 1.2, MA_OR_COL, 0.6, 1.4, false, MA.splashTex);
    maSplash(x, z, 3.2, { up: 2.2 });
    maSplash(x + rand(-1, 1), z + rand(-1, 1), 2, { up: 1.4 });
    maRipple(x, z, 0.55); maRipple(x + 0.5, z - 0.4, 0.3); maRipple(x - 0.7, z + 0.3, 0.2);
    maBubbles(x, z, 40, 3);
    // la vapeur (sans lumière propre : grise, la nuit), qui monte et traîne
    S.later = [[0.12, () => { for (let i = 0; i < 6; i++) spawnPuff(x + rand(-2.5, 2.5), MA.water + rand(0.5, 2.5), z + rand(-2.5, 2.5), rand(3, 6), rand(3, 6), MA_OR_STEAM, 0.45, rand(0.6, 1.5)); }]];
    maOrTry(() => maArcSnd(S));
    O.zap.i = 1;
    if (MA.waterU && MA.waterU.uZap) MA.waterU.uZap.value.set(x, z, OW.t, 7);
    maOrTry(() => maStrikeSteam(x, z));
  } else if (S.surf === 3) {
    // un arbre : l'écorce éclate, la cime fume
    for (let i = 0; i < 16; i++) spawnDebris(MAT.bark, rand(0.04, 0.12), rand(0.08, 0.3), rand(0.03, 0.08), x + rand(-0.4, 0.4), y + rand(1, S.tree.h * 0.8), z + rand(-0.4, 0.4), rand(-5, 5), rand(1, 6), rand(-5, 5), 3);
    S.later = [[0.15, () => { for (let i = 0; i < 5; i++) spawnPuff(x + rand(-1, 1), top - rand(0, 3), z + rand(-1, 1), rand(2, 4), rand(3, 6), MA_OR_SMOKE, 0.5, rand(0.6, 1.2)); }]];
    for (let i = 0; i < 4; i++) spawnPuff(x, top - rand(0, 2), z, rand(0.8, 1.6), rand(0.4, 0.9), 0xffa040, 0.8, 0.5, true, TEX.flare);
    if (S.wet) {
      // le pied dans l'eau : le courant s'y répand (arcs, l'eau s'illumine, elle bout autour du tronc)
      S.wdirs = maBoltWaterDirs(0.6); S.wT = rand(0.04, 0.09);
      S.wslot = maBoltPut(maBoltWater(x, z, S.wdirs));
      maSplash(x + rand(-0.6, 0.6), z + rand(-0.6, 0.6), 1.4, { up: 1.2 });
      maRipple(x, z, 0.3); maBubbles(x, z, 18, 1.6);
      O.zap.i = 0.75;
      if (MA.waterU && MA.waterU.uZap) MA.waterU.uZap.value.set(x, z, OW.t, 5);
      maOrTry(() => maStrikeSteam(x, z));
      maOrTry(() => maArcSnd(S));
    } else maStrikeScorch(x, y, z, 2.2);
  } else {
    // terre, ponton : gerbe de boue ou d'éclats, fumée, brûlure en fougère
    if (S.surf === 2) { const M = maMudPool(); for (let i = 0; i < 40; i++) M.emit(x + rand(-0.4, 0.4), y + 0.05, z + rand(-0.4, 0.4), rand(-3.5, 3.5), rand(2, 6), rand(-3.5, 3.5), rand(0.6, 1.2)); S.later = [[0.1, () => spawnPuff(x, y + 0.6, z, 2.4, 1.8, MA_OR_MUD, 0.6, 0.5)]]; }
    else for (let i = 0; i < 14; i++) spawnDebris(MAT.crate, rand(0.03, 0.08), rand(0.02, 0.05), rand(0.12, 0.35), x + rand(-0.3, 0.3), y + 0.1, z + rand(-0.3, 0.3), rand(-5, 5), rand(2, 7), rand(-5, 5), 3);
    // la fumée, un instant après (au moment de l'éclair, une fumée qui n'est pas éclairée ferait une tache sombre)
    (S.later = S.later || []).push([0.15, () => { for (let i = 0; i < 4; i++) spawnPuff(x + rand(-0.8, 0.8), y + rand(0.3, 1.2), z + rand(-0.8, 0.8), rand(1.5, 3), rand(2.5, 4.5), MA_OR_SMOKE, 0.55, rand(0.5, 1)); }]);
    maStrikeScorch(x, y, z, rand(2.6, 4.2));
  }
  // dégâts, morts
  const killed = maStrikeKills(S), dmg = maStrikePlayer(S);
  maStrikeBeast(S);
  O.kills += killed;
  O.last = { surf: S.surf, d: Math.round(S.d), tues: killed, dmg: Math.round(dmg), t: OW.t };
  maEmit('foudre', { x: Math.round(x), z: Math.round(z), surface: ['eau', 'bois', 'boue', 'arbre'][S.surf], d: Math.round(S.d), tues: killed, joueur: Math.round(dmg) });
}
/* Morts sur le coup : zombies (à moins de 10 m), Noyés (16 m sur l'eau), Stryges (10 m du point d'impact). */
function maStrikeKills(S) {
  const R = MA_ORC.kill, RW = MA_ORC.killWater;
  let n = 0;
  for (let i = Zombies.list.length - 1; i >= 0; i--) {
    const z = Zombies.list[i];
    if (!z || !z.alive || z.boss || z.removed) continue;
    if (z.noye) {
      const d = Math.hypot(z.hx - S.x, z.hz - S.z);
      if (d < (maStrikeInWater(S) ? RW : R * 0.7) && z.ey > z.wl - 2.5) { maNoyeKill(z, { kind: 'nuke', foudre: true, dx: (z.hx - S.x) / (d || 1), dz: (z.hz - S.z) / (d || 1) }); maFoudreFx(z.hx, z.wl + 0.4, z.hz); n++; }
      continue;
    }
    if (z.stryge) {
      const d = Math.hypot(z.root.x - S.x, (z.root.y - S.y) * 0.6, z.root.z - S.z);
      if (d < R) { maStrygeKill(z, { kind: 'nuke', foudre: true, dx: (z.root.x - S.x) / (d || 1), dz: (z.root.z - S.z) / (d || 1) }); maFoudreFx(z.root.x, z.root.y, z.root.z); n++; }
      continue;
    }
    const d = Math.hypot(z.pos.x - S.x, z.pos.z - S.z);
    if (d > (maStrikeInWater(S) && maDepth(z.pos.x, z.pos.z) > 0.15 ? RW : R) || Math.abs(z.gy - S.y) > 4) continue;
    maFoudreChar(z);
    killZombie(z, { kind: 'nuke', foudre: true, dx: (z.pos.x - S.x) / (d || 1), dz: (z.pos.z - S.z) / (d || 1), force: 2 });
    maFoudreFx(z.pos.x, z.gy + 1.1, z.pos.z);
    n++;
  }
  return n;
}
/* Carbonisé : peau et habits noircis, yeux éteints. */
function maFoudreChar(z) {
  if (!z.look || z.slot === undefined || !z.type) return;
  z.look = Object.assign({}, z.look, { skin: 0x2a231d, cloth: 0x17130f, eyes: 0x050505, helmetColor: 0x1c1a18 });
  try { paintZombieSlot(z.slot, z.look, ZR, z.type.model); } catch (e) { /* modèle sans teintes */ }
}
function maFoudreFx(x, y, z) {
  for (let i = 0; i < 14; i++) FX.sparks.emit(x + rand(-0.2, 0.2), y + rand(-0.4, 0.4), z + rand(-0.2, 0.2), rand(-2.5, 2.5), rand(0.5, 3.5), rand(-2.5, 2.5), rand(0.2, 0.6), 0.7, 0.8, 1);
  spawnPuff(x, y + 0.3, z, 0.9, 2.2, MA_OR_CHAR, 0.45, 0.6);
}
/* Le joueur : jusqu'à 70 PV au point d'impact, rien au-delà de 10 m (14 m dans l'eau quand la foudre tombe sur
   l'eau) ; à l'abri d'un toit, rien. En barque, la coque protège (playerDamage). */
function maStrikePlayer(S) {
  const p = player;
  if (G.state !== 'playing' || p.down) return 0;
  const R = maStrikeDanger(S), d = Math.hypot(p.pos.x - S.x, p.pos.z - S.z), dy = Math.abs(p.gy - S.y);
  const close = d < 32 && dy < 8;
  if (close) {
    // l'éblouissement, la secousse, les oreilles qui sifflent
    if (d < 25) maEblouir();                            // confort (ma00) : voile blanc atténué, aucun en effets réduits
    maSecousse((1 - d / 32) * 0.9);
    if (d < 18) maOrTry(() => maTinnitus(1 - d / 18));
  }
  if (d >= R || dy > 4 || (MA.inside || 0) > 0.5 || maRoofOver(p.pos.x, p.pos.z)) return 0;
  const k = d < 1.5 ? 1 : Math.pow(1 - (d - 1.5) / (R - 1.5), 1.3), dmg = MA_ORC.dmg * k;
  const hp0 = p.hp;
  playerDamage(dmg);
  const dx = p.pos.x - S.x, dz = p.pos.z - S.z, l = Math.hypot(dx, dz) || 1;
  if (p.vel && !VEH.drive) { p.vel.x += dx / l * 4 * k; p.vel.z += dz / l * 4 * k; }
  return Math.max(0, hp0 - p.hp);
}
/* La bête, à moins de 24 m d'un impact sur l'eau, près de la surface : elle crie et s'enfuit (hors combat). */
function maStrikeBeast(S) {
  const B = MAB;
  if (S.surf !== 0 || !B.on || MA_BOSS.on || B.state === 'dormant' || B.state === 'devore' || B.state === 'mort') return;
  if (Math.hypot(B.x - S.x, B.z - S.z) > 24 || B.y < MA.water - 5) return;
  if (B.mv && B.mv.flash) B.mv.flash(1);
  B.hurtT = 0.3;
  if (!(B.painT > 0)) maBeastEvent('douleur');
  MAM.attn = MA_CFG.attn.flee; B.fear = 0;
  maBeastSetState('fuite');
  maEmit('blessure', { amount: 0, part: 'foudre' });
}

/* ---------------------------------------------------------------- Brûlures en fougère --
   La figure de Lichtenberg : des branches qui partent du point d'impact, de plus en plus fines. Trois marques
   réutilisées (la plus ancienne s'en va). */
function maScorchTex() {
  // le motif en blanc sur fond noir opaque : la matière prend sa transparence dans le vert (alphaMap) ; sur un fond
  // transparent, le moindre pixel effleuré valait 255 et la marque devenait un carré sombre
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), R = Math.random;
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.16);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  const branch = (x, y, a, len, w, depth) => {
    if (depth > 6 || w < 0.4 || len < 4) return;
    let px = x, py = y;
    const steps = Math.max(3, (len / 6) | 0);
    for (let i = 0; i < steps; i++) {
      a += (R() - 0.5) * 0.9;
      const nx = px + Math.cos(a) * len / steps, ny = py + Math.sin(a) * len / steps;
      g.lineWidth = w * (1 - i / steps * 0.5); g.globalAlpha = 0.8 - depth * 0.08;
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (R() < 0.35) branch(nx, ny, a + (R() < 0.5 ? -1 : 1) * rand(0.4, 1.1), len * rand(0.35, 0.6), w * 0.6, depth + 1);
      px = nx; py = ny;
    }
    branch(px, py, a + (R() - 0.5) * 0.6, len * 0.55, w * 0.7, depth + 1);
  };
  for (let i = 0, n = 9 + ((R() * 6) | 0); i < n; i++) branch(S / 2, S / 2, (i / n) * TAU + R() * 0.5, S * rand(0.18, 0.32), rand(3, 6), 0);
  const t = toTex(c, { clamp: true });
  return t;
}
function maScorchInit(root) {
  const O = MA_OR;
  O.decals = [];
  const tex = O.scTex || (O.scTex = share(maScorchTex()));
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 1, transparent: true, opacity: 0.9, alphaMap: tex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    _linDone.add(m.material);
    m.visible = false; m.renderOrder = 1; m.name = 'brûlure';
    root.add(m); O.decals.push(m);
  }
}
function maStrikeScorch(x, y, z, size) {
  const O = MA_OR, m = O.decals[O.decalI % O.decals.length];
  if (!m) return;
  O.decalI++;
  const n = owKind(OW.surf, Math.floor(x), Math.floor(z)) === OWK.TERRAIN ? owDecalSlope(x, y, z) : null;
  m.position.set(x, (n ? n.y0 : y) + 0.02, z);
  _orV.set(x + (n ? n.x : 0), (n ? n.y0 : y) + 0.02 + (n ? n.y : 1), z + (n ? n.z : 0));
  m.lookAt(_orV); m.rotateZ(rand(0, TAU));
  m.scale.set(size, size, 1); m.visible = true;
}

/* ---------------------------------------------------------------- Sons de l'orage --
   Le grésillement (avant un impact tout proche) : crépitements de plus en plus serrés, un bourdonnement
   électrique ; la vapeur après un impact dans l'eau ; les oreilles qui sifflent ; le tonnerre (plus bas). */
/* La réverbération, calculée une fois par fréquence d'échantillonnage (48 kHz dès le chargement). */
function maOrIR(fs) { const O = MA_OR; O.irs = O.irs || {}; return O.irs[fs] || (O.irs[fs] = maThunderIR(fs, maWxRand(77))); }
/* Un son de l'orage qui échoue (navigateur, carte son) ne doit pas arrêter l'impact (dégâts, morts). */
function maOrTry(f) { try { f(); } catch (e) { if (!MA_OR.warned) { MA_OR.warned = true; console.warn('marais : sons de l’orage', e); } } }
function maOrBus() {
  const b = Sound.bus();
  if (!b) return null;
  const O = MA_OR;
  if (O.snd && O.snd.ctx === b.ctx) return O.snd;
  if (O.sndErr === b.ctx) return null;                  // ce navigateur a refusé : l'orage reste muet, le jeu continue
  try {
    // la réverbération doit avoir la fréquence d'échantillonnage du contexte (44,1 ou 48 kHz selon la carte son)
    const ctx = b.ctx, fs = ctx.sampleRate, out = ctx.createGain(); out.gain.value = 1;
    const IR = maOrIR(fs), buf = ctx.createBuffer(2, IR[0].length, fs); buf.copyToChannel(IR[0], 0); buf.copyToChannel(IR[1], 1);
    const verb = ctx.createConvolver(); verb.buffer = buf;
    const wet = ctx.createGain(); wet.gain.value = 0.55; verb.connect(wet); wet.connect(out);
    out.connect(b.sortie);
    O.snd = { ctx, out, verb, pre: null };
    return O.snd;
  } catch (e) { O.sndErr = b.ctx; console.warn('marais : sons de l’orage', e); return null; }
}
function maPrecursorStart(S) {
  const B = maOrBus();
  if (!B || !MA_AMB.noise) return;
  maPrecursorStop();
  const ctx = B.ctx, t = ctx.currentTime + 0.02, dur = S.at, pan = clamp(maPanOf(S.x, S.z), -1, 1), att = 1 / (1 + Math.max(0, S.d - 2) / 8);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null, g = ctx.createGain();
  if (p) { p.pan.value = pan; g.connect(p); p.connect(B.out); } else g.connect(B.out);
  // crépitements : des pics de plus en plus serrés
  const n = 240, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const k = i / n; curve[i] = Math.random() < 0.08 + 0.55 * k * k ? rand(0.3, 1) * (0.25 + 0.75 * k) : 0.02 * k; }
  const s = ctx.createBufferSource(); s.buffer = MA_AMB.noise; s.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
  // (pas d'autre événement dans l'intervalle de la courbe : le navigateur la refuserait)
  const cg = ctx.createGain(); cg.gain.value = 0;
  try { cg.gain.setValueCurveAtTime(curve, t, dur); } catch (e) { cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.6, t + dur); }
  s.connect(hp); hp.connect(cg); cg.connect(g);
  // bourdonnement électrique
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = rand(110, 130);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2.5;
  const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.05, t + dur * 0.8);
  o.connect(bp); bp.connect(og); og.connect(g);
  g.gain.value = 0.55 * att;
  s.start(t, Math.random() * 2); o.start(t);
  MA_OR.snd.pre = { s, o, g, p, end: t + dur };
}
function maPrecursorStop() {
  const B = MA_OR.snd;
  if (!B || !B.pre) return;
  const P = B.pre;
  B.pre = null;
  try { const t = B.ctx.currentTime; P.g.gain.setTargetAtTime(0, t, 0.01); P.s.stop(t + 0.1); P.o.stop(t + 0.1); setTimeout(() => { try { P.g.disconnect(); if (P.p) P.p.disconnect(); } catch (e) { /* */ } }, 400); } catch (e) { /* */ }
}
/* Les étincelles bleues et la lueur au point d'impact, pendant l'avertissement. */
function maPrecursorFx(S, dt) {
  const k = clamp(S.t / S.at, 0, 1);
  if (Math.random() < dt * (12 + 50 * k)) FX.sparks.emit(S.x + rand(-0.8, 0.8), S.top + rand(0, 0.6), S.z + rand(-0.8, 0.8), rand(-0.4, 0.4), rand(0.4, 1.6), rand(-0.4, 0.4), rand(0.15, 0.4), 0.55, 0.5, 1);
  if (S.sslot >= 0) maBoltI(S.sslot, (0.2 + 0.6 * k) * 0.6 * maBat(0.3, S.t));   // confort (ma00) : grésille sans clignoter
  if (FX.boomLight) { FX.boomLight.position.set(S.x, S.top + 0.8, S.z); FX.boomLight.color.setRGB(0.55, 0.45, 1); FX.boomLight.decay = 2; FX.boomLight.intensity = Math.max(FX.boomLight.intensity, (0.6 + 2.4 * k) * rand(0.5, 1)); FX.boomT = Math.max(FX.boomT || 0, 0.05); }
}
/* Les arcs sur l'eau : un crépitement sec de 0,75 s (crêtes serrées puis espacées), selon la distance. */
function maArcSnd(S) {
  const B = maOrBus(), L = maOrListener();
  if (!B || !MA_AMB.noise) return;
  const d = Math.hypot(S.x - L.x, S.z - L.z), att = 1 / (1 + d / 18);
  if (att < 0.04) return;
  const ctx = B.ctx, t = ctx.currentTime + Math.min(0.5, d / 343), dur = 0.75, n = 180, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const k = i / n; curve[i] = Math.random() < 0.6 * (1 - k) + 0.05 ? rand(0.3, 1) * (1 - k * 0.8) : 0; }
  const s = ctx.createBufferSource(); s.buffer = MA_AMB.noise; s.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
  const g = ctx.createGain(); g.gain.value = 0;
  try { g.gain.setValueCurveAtTime(curve, t, dur); } catch (e) { g.gain.setValueAtTime(0.4, t); g.gain.setTargetAtTime(0, t, 0.2); }
  const out = ctx.createGain(); out.gain.value = 0.5 * att;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  s.connect(hp); hp.connect(g); g.connect(out);
  if (p) { p.pan.value = clamp(maPanOf(S.x, S.z), -1, 1); out.connect(p); p.connect(B.out); } else out.connect(B.out);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
  setTimeout(() => { try { out.disconnect(); if (p) p.disconnect(); } catch (e) { /* */ } }, (dur + 1.5) * 1000);
}
function maStrikeSteam(x, z) {
  const B = maOrBus();
  if (!B || !MA_AMB.noise) return;
  const ctx = B.ctx, t = ctx.currentTime + 0.05, L = camera.position, att = 1 / (1 + Math.hypot(x - L.x, z - L.z) / 25);
  if (att < 0.05) return;
  const s = ctx.createBufferSource(); s.buffer = MA_AMB.noise; s.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.7;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * att, t + 0.08); g.gain.setTargetAtTime(0, t + 0.3, 0.8);
  s.connect(bp); bp.connect(g); g.connect(B.out);
  s.start(t, Math.random() * 2); s.stop(t + 4);
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, 4500);
}
function maTinnitus(k) {
  const B = maOrBus();
  if (!B) return;
  const ctx = B.ctx, t = ctx.currentTime;
  // l'assourdissement, puis le son d'avant (sous l'eau, agrippé par un Noyé : leur propre étouffement)
  const base = () => (typeof MA_NOYES !== 'undefined' && MA_NOYES.muffled ? 1100 : MA_SWIM.on ? 2600 : false);
  const b0 = base();
  Sound.setMuffle(Math.min(b0 || 20000, 700 + 1800 * (1 - k)));
  // (toujours rendu, même si la partie s'est finie entre-temps : un son resté étouffé ferait croire à un défaut)
  setTimeout(() => { Sound.setMuffle(G.state === 'playing' || G.state === 'paused' ? base() : false); }, 1400 + 1800 * k);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = rand(3700, 4300);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.028 * k, t + 0.15); g.gain.setTargetAtTime(0, t + 0.6, 1.4);
  o.connect(g); g.connect(B.out); o.start(t); o.stop(t + 6);
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, 6500);
}

/* ---------------------------------------------------------------- Le tonnerre (calculé) --
   Modèle de Ribner et Roy (1982) : le canal de l'éclair est une ligne brisée ; chaque morceau (3 m de près,
   jusqu'à 10 m de loin), chauffé d'un coup, émet une onde de choc en N (une surpression puis une dépression :
   4 ms près du canal, une quinzaine au loin). Elle arrive au joueur après distance ÷ 343 m/s ; elle rayonne
   surtout perpendiculairement au morceau ; un morceau vu en enfilade étale son onde ; l'air absorbe les aigus
   (le front s'adoucit avec la distance) et la turbulence décale un peu les arrivées. Les énergies s'ajoutent
   (amplitude en racine de la longueur). La somme de ces milliers d'ondes fait le tonnerre : de près, le
   claquement déchirant des morceaux voisins, puis le roulement des parties hautes et des branches dans le
   nuage, qui arrivent plus tard et plus sourdes. Le canal est celui de l'éclair qu'on voit (prolongé jusqu'à
   1,3-2,6 km et dans le nuage sur 2 à 6 km) : chaque tonnerre est unique et tombe juste. La réverbération
   (échos du marais, des îles, de la base des nuages) est ajoutée à l'écoute (maOrBus). */
function maThunderChannel(x, y0, z, o, R) {
  const P = [];                                   // polylignes : [x, y, z, …]
  const walk = (sx, sy, sz, tx, ty, tz, step0, step1, sigma, pull) => {
    const out = [sx, sy, sz];
    let px = sx, py = sy, pz = sz, dx = tx - sx, dy = ty - sy, dz = tz - sz;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    for (let k = 0; k < 4000; k++) {
      const rem = Math.hypot(tx - px, ty - py, tz - pz);
      if (rem < step1) { out.push(tx, ty, tz); break; }
      const f = 1 - rem / (l + 1e-6), step = step0 + (step1 - step0) * Math.max(0, Math.min(1, f));
      dx += (R() - 0.5) * 2 * sigma + (tx - px) / rem * pull; dy += (R() - 0.5) * 2 * sigma + (ty - py) / rem * pull; dz += (R() - 0.5) * 2 * sigma + (tz - pz) / rem * pull;
      const n = Math.hypot(dx, dy, dz) || 1; dx /= n; dy /= n; dz /= n;
      px += dx * step; py += dy * step; pz += dz * step;
      out.push(px, py, pz);
    }
    return out;
  };
  if (o.ground) {
    // le bas : le canal qu'on voit (du sol vers le nuage) ; puis jusqu'à 1,3-2,6 km ; puis dans le nuage
    const low = o.low && o.low.length >= 6 ? o.low : null, s = low ? low.slice(-3) : [x, y0, z];
    const tx = x + (R() - 0.5) * 2 * o.slant, tz = z + (R() - 0.5) * 2 * o.slant;
    const up = walk(s[0], s[1], s[2], tx, y0 + o.Hc, tz, low ? 6 : 2.5, 14, 0.42, 0.22);
    if (low) P.push(low);
    P.push(up);
    const top = up.slice(-3);
    for (let b = 0; b < o.branches; b++) {
      const a = R() * Math.PI * 2, L = o.cloudLen * (0.4 + R() * 0.8);
      P.push(walk(top[0], top[1], top[2], top[0] + Math.cos(a) * L, top[1] + (R() - 0.3) * 1500, top[2] + Math.sin(a) * L, 8, 16, 0.38, 0.12));
    }
  } else {
    for (let b = 0; b < o.branches; b++) {
      const a = R() * Math.PI * 2, L = o.cloudLen * (0.5 + R() * 0.8), h = y0 + o.Hc + R() * 2500;
      const sx = x + (R() - 0.5) * 1500, sz = z + (R() - 0.5) * 1500;
      P.push(walk(sx, h, sz, sx + Math.cos(a) * L, h + (R() - 0.5) * 1200, sz + Math.sin(a) * L, 8, 16, 0.38, 0.12));
    }
  }
  return P;
}
/* Le son vu du joueur (lx, ly, lz), par tranches : renvoie { buf (mono, fs), t0 (s : arrivée du premier front
   après l'éclair), peak }. */
function* maThunderGen(P, lx, ly, lz, fs, R) {
  // (les boucles lourdes sont dans des fonctions ordinaires : certains moteurs JavaScript n'optimisent pas le
  // corps d'un générateur ; Firefox y passait 6 à 7 fois plus de temps)
  const E = { ev: [], tmin: Infinity, tmax: 0 };
  for (const p of P) for (let i = 3; i < p.length; i += 3 * 300) { maThunderEvents(E, p, i, Math.min(p.length, i + 3 * 300), lx, ly, lz, R); yield; }
  if (!E.ev.length) return { buf: new Float32Array(0), t0: 0, peak: 0, n: 0 };
  const N = Math.min(fs * 40, Math.ceil((E.tmax - E.tmin + 0.05) * fs)), buf = maThunderBuf(N, fs);
  for (let s = 0; s < E.ev.length; s += 4 * 1200) { maThunderWrite(E.ev, s, Math.min(E.ev.length, s + 4 * 1200), buf, E.tmin, fs); yield; }
  const hp = { y: 0, x0: 0 };
  for (let i = 0; i < buf.length; i += 262144) { maThunderHP(buf, i, Math.min(buf.length, i + 262144), fs, hp); yield; }
  // la dynamique resserrée (2,2 pour 1 : le roulement remonte vers le claquement, 22 dB au plus) : en vrai, le
  // claquement d'un éclair proche est assourdissant et le roulement, 30 dB plus bas, couvre encore la pluie ; un jeu
  // n'a pas cette marge
  const nb = Math.ceil(buf.length / 1024), e = new Float32Array(nb);
  for (let k = 0; k < nb; k += 256) { maThunderBlocks(buf, e, k, Math.min(nb, k + 256), 1024); yield; }
  const env = maThunderEnv(e);
  yield;
  for (let i = 0; i < buf.length; i += 262144) { maThunderComp(buf, i, Math.min(buf.length, i + 262144), env, 1024); yield; }
  // force perçue : ramenée à la moyenne quadratique des 3 premières secondes ; les crêtes (le claquement du morceau
  // de canal le plus proche, 30 à 40 dB au-dessus du roulement) adoucies à 12 dB au plus : sinon, réglé sur sa
  // crête, le roulement disparaissait sous la pluie
  const rms = maThunderRms(buf, Math.min(buf.length, fs * 3));
  if (!(rms > 0)) return { buf, t0: E.tmin, peak: 0, n: E.ev.length / 4 };
  for (let i = 0; i < buf.length; i += 262144) { maThunderShape(buf, i, Math.min(buf.length, i + 262144), 1 / rms, 4); yield; }
  return { buf, t0: E.tmin, peak: 4, n: E.ev.length / 4 };
}
/* Enveloppe : moyenne quadratique par blocs de B échantillons (blocs k0 à k1) ; puis gain de compression par bloc
   (maximum sur ±6 blocs, lissé sur ±6 blocs : un quart de seconde, le gain ne doit pas battre au rythme des ondes
   graves). */
function maThunderBlocks(buf, e, k0, k1, B) {
  for (let k = k0; k < k1; k++) { let s = 0; const i0 = k * B, i1 = Math.min(buf.length, i0 + B); for (let i = i0; i < i1; i++) s += buf[i] * buf[i]; e[k] = Math.sqrt(s / Math.max(1, i1 - i0)); }
}
function maThunderEnv(e) {
  const nb = e.length, m = new Float32Array(nb), g = new Float32Array(nb);
  let ref = 0;
  for (let k = 0; k < nb; k++) { let v = 0; for (let j = Math.max(0, k - 6); j <= Math.min(nb - 1, k + 6); j++) v = Math.max(v, e[j]); m[k] = v; if (v > ref) ref = v; }
  for (let k = 0; k < nb; k++) m[k] = ref > 0 && m[k] > ref * 1e-4 ? Math.min(12.6, Math.pow(m[k] / ref, -0.55)) : 1;
  for (let k = 0; k < nb; k++) { let s = 0, c = 0; for (let j = Math.max(0, k - 6); j <= Math.min(nb - 1, k + 6); j++) { s += m[j]; c++; } g[k] = s / c; }
  return g;
}
function maThunderComp(buf, i0, i1, g, B) {
  const nb = g.length;
  for (let i = i0; i < i1; i++) { const f = i / B - 0.5, k = Math.max(0, Math.min(nb - 1, Math.floor(f))), k1 = Math.min(nb - 1, k + 1), t = Math.max(0, Math.min(1, f - k)); buf[i] *= g[k] + (g[k1] - g[k]) * t; }
}
/* Un seul tampon de 40 s pour tous les tonnerres (un calcul à la fois ; recopié dans le son dès qu'il est prêt) :
   pas de 8 Mo alloués à chaque éclair (le ramasse-miettes du navigateur gelait l'image). */
function maThunderBuf(N, fs) {
  const O = MA_OR;
  if (!O.tbuf || O.tbuf.length < fs * 40) O.tbuf = new Float32Array(fs * 40);
  const b = O.tbuf.subarray(0, N); b.fill(0);
  return b;
}
function maThunderRms(buf, n) { let s = 0; for (let i = 0; i < n; i++) s += buf[i] * buf[i]; return Math.sqrt(s / Math.max(1, n)); }
function maThunderShape(buf, i0, i1, g, C) { for (let i = i0; i < i1; i++) buf[i] = C * Math.tanh(buf[i] * g / C); }
/* Les ondes d'un morceau de canal (points i0 à i1 de la polyligne p) : instant d'arrivée, durée, front, force. */
function maThunderEvents(E, p, i0, i1, lx, ly, lz, R) {
  const ev = E.ev;
  for (let i = i0; i < i1; i += 3) {
    const ax = p[i - 3], ay = p[i - 2], az = p[i - 1], bx = p[i], by = p[i + 1], bz = p[i + 2];
    let ux = bx - ax, uy = by - ay, uz = bz - az;
    const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    const r0 = Math.hypot((ax + bx) / 2 - lx, (ay + by) / 2 - ly, (az + bz) / 2 - lz);
    const m = Math.max(1, Math.ceil(l / Math.min(10, Math.max(3, r0 / 300)))), ls = l / m;
    for (let q = 0; q < m; q++) {
      const f = (q + 0.5) / m, mx = ax + (bx - ax) * f - lx, my = ay + (by - ay) * f - ly, mz = az + (bz - az) * f - lz, r = Math.hypot(mx, my, mz) || 1;
      const jx = ux + (R() - 0.5) * 0.5, jy = uy + (R() - 0.5) * 0.5, jz = uz + (R() - 0.5) * 0.5, jl = Math.hypot(jx, jy, jz) || 1;
      const c = Math.abs((jx * mx + jy * my + jz * mz) / (jl * r)), dl = ls * c / 343;
      const tau = 0.0035 * Math.pow(1 + r / 40, 0.25) * (0.7 + 0.7 * R());
      const tr = Math.max(1.5e-5 + r * 0.6e-6, dl);
      const A = Math.sqrt(ls) * (0.25 + 0.75 * (1 - c * c)) / Math.max(r, 8) * Math.exp(-r / 9000) * (tau / (tau + dl));
      const t = r / 343 + (R() - 0.5) * 0.004 * Math.sqrt(r / 500);
      ev.push(t, tau, tr, A);
      if (t < E.tmin) E.tmin = t;
      if (t + tau + 2 * tr > E.tmax) E.tmax = t + tau + 2 * tr;
    }
  }
}
/* Les ondes en N (front de montée tr, durée tau) des événements s0 à s1, posées dans le tampon. */
function maThunderWrite(ev, s0, s1, buf, tmin, fs) {
  const N = buf.length;
  for (let s = s0; s < s1; s += 4) {
    const t = ev[s], tau = ev[s + 1], tr = ev[s + 2], A = ev[s + 3];
    const nr = Math.max(1, Math.round(tr * fs)), nb = Math.max(2, Math.round(tau * fs));
    let j = Math.max(0, Math.floor((t - tmin) * fs));
    for (let k = 0; k < nr && j < N; k++, j++) buf[j] += A * (k / nr);
    for (let k = 0; k < nb && j < N; k++, j++) buf[j] += A * (1 - 2 * k / nb);
    for (let k = 0; k < nr && j < N; k++, j++) buf[j] -= A * (1 - k / nr);
  }
}
/* La surpression moyenne ne s'entend pas (passe-haut 22 Hz), par tranches (st : l'état du filtre). */
function maThunderHP(buf, i0, i1, fs, st) {
  const kk = Math.exp(-2 * Math.PI * 22 / fs);
  let y = st.y, x0 = st.x0;
  for (let i = i0; i < i1; i++) { const x = buf[i]; y = kk * (y + x - x0); x0 = x; buf[i] = y; }
  st.y = y; st.x0 = x0;
}
/* Réverbération du tonnerre : queue stéréo de 4,5 s qui s'assombrit en décroissant, quelques échos nets. */
function maThunderIR(fs, R) {
  const n = Math.round(fs * 4.5), B = [new Float32Array(n), new Float32Array(n)], dk = Math.exp(-2.6 / fs), dl = Math.exp(-1.4 / fs), na = Math.round(fs * 0.012);
  for (const c of B) {
    let y = 0, y2 = 0, k = 0.5, l = 0.5;                  // (décroissances par produit : pas d'exponentielle par échantillon)
    for (let i = 0; i < n; i++) {
      const lp = l + 0.02;
      y += lp * ((R() * 2 - 1) - y); y2 += lp * (y - y2);
      c[i] = y2 * k * 2 * (i < na ? i / na : 1);
      k *= dk; l *= dl;
    }
    for (let e = 0; e < 7; e++) { const at = Math.floor(fs * (0.08 + R() * 1.1)); c[at] += (R() < 0.5 ? 1 : -1) * (0.25 + R() * 0.3) * Math.exp(-at / fs); }
  }
  return B;
}

/* ---------------------------------------------------------------- Calcul du tonnerre, par tranches --
   Un calcul par éclair (quelques millisecondes par image) ; prêt, il part à l'instant où le premier front
   arrive (éclair + arrivée) ; s'il est prêt en retard, il part tout de suite, décalé d'autant (le reste
   reste juste). Force selon la distance ; côté selon l'endroit ; réverbération commune. */
function maThunderJob(P, flashT, x, z, d, crack) {
  const L = maOrListener();
  if (MA_OR.jobs.length > 6) MA_OR.jobs.shift();
  MA_OR.jobs.push({ it: maThunderGen(P, L.x, (L.y || 0) + 1.6, L.z, 48000, Math.random), flashT, x, z, d, crack, res: null });
}
function maThunderJobs(dt) {
  const O = MA_OR;
  if (!O.jobs.length) return;
  const t0 = performance.now();
  let budget = 3;
  for (const J of O.jobs) if (!J.res && J.flashT - OW.t < 0.5) budget = 8;      // l'éclair est imminent : il faut le son à temps
  while (O.jobs.length && performance.now() - t0 < budget) {
    const J = O.jobs[0];
    const r = J.it.next();
    if (r.done) { O.jobs.shift(); J.res = r.value; maThunderPlay(J); }
  }
}
function maThunderPlay(J) {
  try { maThunderStart(J); } catch (e) { console.warn('marais : tonnerre', e); }
}
function maThunderStart(J) {
  const B = maOrBus(), R = J.res;
  if (!B || !R || !R.buf.length || !(R.peak > 0)) return;
  if (G.state !== 'playing' && G.state !== 'menu' && G.state !== 'gameover') return;
  const ctx = B.ctx, buf = ctx.createBuffer(1, R.buf.length, 48000);
  buf.copyToChannel(R.buf, 0);
  const s = ctx.createBufferSource(); s.buffer = buf;
  // force selon la distance (moyenne quadratique : 0,25 tout près, 0,16 à 300 m, 0,09 à 1 km, 0,04 à 3 km) ; un peu de
  // médium (le roulement et le craquement s'entendent aussi sur de petits haut-parleurs)
  const dist = J.d, g = ctx.createGain(), lvl = (dist < 60 ? 0.25 : 0.2) / (1 + Math.pow(dist / 900, 1.2));
  g.gain.value = lvl;
  const e1 = ctx.createBiquadFilter(); e1.type = 'peaking'; e1.frequency.value = 200; e1.Q.value = 0.8; e1.gain.value = 5;
  const e2 = ctx.createBiquadFilter(); e2.type = 'peaking'; e2.frequency.value = 1000; e2.Q.value = 0.9; e2.gain.value = dist < 500 ? 4 : 1.5;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  s.connect(e1); e1.connect(e2); e2.connect(g);
  if (p) { p.pan.value = clamp(maPanOf(J.x, J.z), -1, 1) * 0.7; g.connect(p); p.connect(B.out); } else g.connect(B.out);
  const sw = ctx.createGain(); sw.gain.value = dist < 150 ? 0.45 : 0.8; g.connect(sw); sw.connect(B.verb);
  const late = OW.t - (J.flashT + R.t0);
  if (late > 0) s.start(ctx.currentTime, Math.min(late, buf.duration - 0.05)); else s.start(ctx.currentTime - late);
  setTimeout(() => { try { g.disconnect(); sw.disconnect(); e1.disconnect(); e2.disconnect(); if (p) p.disconnect(); } catch (e) { /* */ } }, (buf.duration + 6 - Math.min(0, late)) * 1000);
}

/* ---------------------------------------------------------------- Chargement, F8 -- */
function maStormInit(root) {
  const O = MA_OR;
  O.mesh = maBoltMesh(root);
  O.slots = new Array(MA_OR_SLOTS).fill(false); O.range = new Array(MA_OR_SLOTS).fill(null); O.seg = 0; O.dLo = Infinity; O.dHi = -Infinity;
  maScorchInit(root);
  // un éclair invisible au chargement : son nuanceur est compilé avec le reste (maPrewarm)
  O.mesh.U.uBI.value.fill(0);
  maStormReset();
  maOrIR(48000);                                        // la réverbération du tonnerre, prête (10 ms ici plutôt qu'au premier éclair)
  maOrBus();                                            // (si le son est déjà lancé)
}
function maStormUnload() {
  const O = MA_OR;
  maStormReset();
  if (O.mesh) O.mesh.U.uBI.value.fill(0);
  for (const m of O.decals) m.visible = false;
  if (O.snd) { try { O.snd.out.disconnect(); } catch (e) { /* */ } O.snd = null; }
}
function maStormDiag() {
  const O = MA_OR, S = maStormState(), L = O.last;
  const last = L ? ` · dernier impact : ${['eau', 'bois', 'boue', 'arbre'][L.surf]}, ${L.d} m${L.tues ? `, ${L.tues} foudroyé${L.tues > 1 ? 's' : ''}` : ''}${L.dmg ? `, −${L.dmg} PV` : ''}` : '';
  const head = !S ? 'pas d’orage' : S.prevu !== undefined ? `orage dans ${Math.round(S.prevu)} s` : `orage n° ${S.phase} : ${Math.round(S.t)}/${Math.round(S.dur)} s, foyer à ${fmtNum(S.foyer / 1000, 1)} km, activité ${fmtNum(S.activite, 2)}`;
  return `${head} · éclairs : ${O.nC} dans les nuages, ${O.nS} au sol (${O.nNear} près de vous), ${O.kills} foudroyés · tonnerres en calcul ${O.jobs.length}${last}`;
}
