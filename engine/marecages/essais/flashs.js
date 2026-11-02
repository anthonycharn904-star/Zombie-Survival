// Marécages Maudits : essai de la garde des flashs (ma00_confort.js), sans rendu (1er novembre 2026).
// Rejoue, à 60 images par seconde, des éclairs tirés comme dans ma18 (orage au plus fort de ses réglages) et une nuée
// de Stryges (ma19), avec les vraies fonctions du marais (impulsions de ma18 et ma19, garde de ma00), puis compte les
// flashs comme le critère 2.3.1 des WCAG : une paire de variations opposées (montée puis descente) d'au moins θ de la
// lumière qui éclaire le plus l'écran (y = ambiante + 0,15 × directe + 0,3 × ciel). Trois façons : le kit (sans
// garde), « limités » (réglage par défaut) et « réduits ».
// Usage : node essais/flashs.js [minutes]   (aucune écriture)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
const MIN = Number(process.argv[2]) || 20;

// --- le code du marais, tel quel : ma00 en entier, les impulsions de ma18 (fonctions de premier niveau)
function fonction(txt, nom) {
  const a = txt.indexOf(`\nfunction ${nom}(`);
  if (a < 0) throw new Error(`${nom} introuvable`);
  let i = txt.indexOf('{', a), d = 0;
  for (; i < txt.length; i++) { if (txt[i] === '{') d++; else if (txt[i] === '}' && --d === 0) break; }
  return txt.slice(a + 1, i + 1);
}
const ma18 = fs.readFileSync(path.join(SRC, 'ma18_orage.js'), 'utf8');
const ma19 = fs.readFileSync(path.join(SRC, 'ma19_arrivee.js'), 'utf8');
const code = fs.readFileSync(path.join(SRC, 'ma00_confort.js'), 'utf8') + '\n' +
  ['maPulse', 'maPulsesGround', 'maPulsesCloud'].map((n) => fonction(ma18, n)).join('\n') +
  '\nthis.maFlashV = maFlashV; this.maFlashGarde = maFlashGarde; this.maFlashReset = maFlashReset; this.MA_FLG = MA_FLG;' +
  '\nthis.maPulse = maPulse; this.maPulsesGround = maPulsesGround; this.maPulsesCloud = maPulsesCloud;';
// les quatre arcs de l'éclair rouge d'une Stryge (ma19, maArrStrike), relus dans la source
const arr = ma19.match(/const t1 = rand\(([\d.]+), ([\d.]+)\), t2 = t1 \+ rand\(([\d.]+), ([\d.]+)\), t3 = t2 \+ rand\(([\d.]+), ([\d.]+)\);\n\s*A\.pulses = (\[.*\]);/);
if (!arr) throw new Error('arcs de l\'éclair rouge introuvables dans ma19');

let graine = 1931;
const alea = () => { graine = (graine * 1664525 + 1013904223) >>> 0; return graine / 4294967296; };
function monde(reglage) {
  const ctx = {
    Math: Object.create(Math), settings: { flashes: reglage }, OW: { t: 0 }, FX: { shake: 0 }, HUD: {},
    lerp: (a, b, t) => a + (b - a) * t, clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
    MA_OR: { F: { i: 0, amb: 0, sky: 0, col: { r: 1, g: 1, b: 1, setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; } } } },
  };
  ctx.Math.random = alea;
  ctx.rand = (a, b) => a + (b - a) * alea();
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

// --- le scénario : un orage au plus fort de ses réglages (MA_ORC), plus une nuée de 8 Stryges toutes les 2 minutes
function scenario(g0) {
  graine = g0;
  const ev = [], P = { strokes: 4.2, cc: 0.5 }, R = (a, b) => a + (b - a) * alea();
  const gen = monde('limited');
  for (let t = 0; t < MIN * 60;) {                                   // éclairs dans les nuages : 22 par minute
    t += -Math.log(1 - alea() * 0.95) * 60 / 22;
    const d = R(200, 3000), b = R(0.75, 1.3), sp = alea() < 0.45 ? 1.6 : 1;
    ev.push({ at: t, pulses: gen.maPulsesCloud(), k: b * 2.4 / (1 + (d / 2200) ** 2) * sp, amb: b * 1.3 / (1 + (d / 3000) ** 2) * (sp > 1 ? 1.3 : 1), sky: 1, life: 1.8 });
  }
  for (let t = 0; t < MIN * 60;) {                                   // éclairs au sol : 7 par minute, 22 % tout près
    t += -Math.log(1 - alea() * 0.95) * 60 / 7;
    const d = alea() < 0.22 ? R(5, 30) : R(30, 1500), b = R(0.75, 1.3);
    ev.push({ at: t, pulses: gen.maPulsesGround(P), k: b * 9 / (1 + (d / 200) ** 2), amb: b * 2.6 / (1 + (d / 600) ** 2), sky: 1, life: 1.6 });
  }
  const [, a1, b1, a2, b2, a3, b3, tpl] = arr;
  for (let t0 = 30; t0 < MIN * 60; t0 += 120) {                      // une nuée de 8 Stryges, toutes les 2 minutes
    let t = t0, last = -9;
    for (let i = 0; i < 8; i++) {
      const t1 = R(+a1, +b1), t2 = t1 + R(+a2, +b2), t3 = t2 + R(+a3, +b3), d = R(18, 28), rk = t - last < 1.2 ? 0.65 : 1;
      const pulses = vm.runInNewContext(tpl, { t1, t2, t3, rand: R });
      ev.push({ at: t, pulses, k: rk * 2.8 / (1 + (d / 120) ** 2), amb: rk * 0.95 / (1 + (d / 400) ** 2), sky: 0.55 * rk, life: 1.0 });
      last = t; t += R(0.55, 1.0);
    }
  }
  return ev.sort((x, y) => x.at - y.at);
}

// --- une passe : la lumière y de chaque image
function passe(ev, reglage) {
  const W = reglage ? monde(reglage) : null, dt = 1 / 60, ys = [];
  if (W) { W.MA_FLG.dt = dt; W.maFlashReset(); }
  let j = 0;
  const actifs = [];
  for (let n = 0, t = 0; t < MIN * 60; n++, t = n * dt) {
    while (j < ev.length && ev[j].at <= t) actifs.push({ ...ev[j++], t: 0, env: 0 });
    let i = 0, amb = 0, sky = 0;
    for (let q = actifs.length - 1; q >= 0; q--) {
      const f = actifs[q];
      f.t += dt;
      if (f.t > f.life) { actifs.splice(q, 1); continue; }
      const raw = (W || base).maPulse(f.pulses, f.t), v = W ? W.maFlashV(f, raw) : raw;
      i += v * f.k; amb += v * f.amb; sky = Math.max(sky, v * f.sky);
    }
    if (W) { W.OW.t = t; const F = W.MA_OR.F; F.i = i; F.amb = amb; F.sky = sky; W.maFlashGarde(); i = F.i; amb = F.amb; sky = F.sky; }
    ys.push(amb + 0.15 * i + 0.3 * sky);
  }
  return ys;
}
// --- les flashs : montée d'au moins θ depuis le dernier creux, puis descente d'au moins θ depuis le sommet
function flashs(ys, th) {
  const t = [];
  let bas = ys[0], haut = ys[0], monte = false;
  ys.forEach((y, n) => {
    if (!monte) { bas = Math.min(bas, y); if (y - bas >= th) { monte = true; haut = y; } }
    else { haut = Math.max(haut, y); if (haut - y >= th) { t.push(n / 60); monte = false; bas = y; } }
  });
  return t;
}
function bilan(ys, th) {
  const t = flashs(ys, th);
  let max = 0, a = 0;
  const sec = new Set();
  for (let b = 0; b < t.length; b++) {
    while (t[b] - t[a] >= 1) a++;
    const c = b - a + 1;
    if (c > max) max = c;
    if (c > 3) sec.add(Math.floor(t[b]));
  }
  const trop = sec.size;
  const tri = [...ys].sort((x, y) => x - y);
  return { flashs: t.length, max, trop, pic: tri[tri.length - 1], p999: tri[Math.floor(tri.length * 0.999)] };
}

const base = monde('limited');
const TH = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.7, 1.0, 1.4, 2.0];
let ok = true;
for (const g0 of [1931, 2026, 7]) {
  const ev = scenario(g0), res = {};
  console.log(`\ntirage ${g0} : ${MIN} min d'orage au plus fort (22 éclairs/min dans les nuages, 7/min au sol dont 22 % tout près) et une nuée de 8 Stryges toutes les 2 min : ${ev.length} éclairs`);
  for (const [nom, reg] of [['kit (sans garde)', null], ['limités (défaut)', 'limited'], ['réduits', 'reduced']]) {
    const ys = passe(ev, reg);
    res[nom] = TH.map((th) => bilan(ys, th));
  }
  console.log('| Réglage | Flashs (θ 0,1) | Au plus par seconde, selon θ (' + TH.map((th) => String(th).replace('.', ',')).join(' ; ') + ') | Secondes à plus de 3 (θ 0,1) | Pic de y | y à 99,9 % |');
  console.log('|---|---:|---|---:|---:|---:|');
  for (const [nom, L] of Object.entries(res)) console.log(`| ${nom} | ${L[0].flashs} | ${L.map((a) => a.max).join(' ')} | ${L[0].trop} | ${L[0].pic.toFixed(2)} | ${L[0].p999.toFixed(2)} |`);
  ok = ok && res['limités (défaut)'].every((a) => a.max <= 3) && res['réduits'].every((a) => a.max <= 1);
}
console.log(ok ? '\ngarde des flashs : conforme à chaque seuil et à chaque tirage (au plus 3 flashs par seconde en « limités », 1 en « réduits »)' : '\ngarde des flashs : NON CONFORME');
process.exit(ok ? 0 : 1);
