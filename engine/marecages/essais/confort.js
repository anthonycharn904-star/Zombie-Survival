// Marécages Maudits : essai du confort et du diagnostic, sans rendu (1er novembre 2026).
// Charge les vraies fonctions du marais (ma00 en entier ; de ma11 : maDiagPush, maErr, maDiagDemande, maDiagPermis,
// maDiagInstaller) dans un bac à sable avec des doublures (window, rendu, réglages, HUD), puis vérifie les décisions
// d'Anthony du 1er novembre 2026 : secousses désactivées par défaut et réactivables ; voile blanc atténué ou supprimé ;
// rien d'installé pour un joueur ; F8 seulement dans un diagnostic activé et dans le marais ; Maj+F8 seulement dans
// une partie de test des Mod Tools ; console.error jamais remplacé.
// Usage : node essais/confort.js   (aucune écriture)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
function fonction(txt, nom) {
  const a = txt.indexOf(`\nfunction ${nom}(`);
  if (a < 0) throw new Error(`${nom} introuvable`);
  let i = txt.indexOf('{', a), d = 0;
  for (; i < txt.length; i++) { if (txt[i] === '{') d++; else if (txt[i] === '}' && --d === 0) break; }
  return txt.slice(a + 1, i + 1);
}
const ma00 = fs.readFileSync(path.join(SRC, 'ma00_confort.js'), 'utf8');
const ma11 = fs.readFileSync(path.join(SRC, 'ma11_diag.js'), 'utf8');
const diag = ['maDiagPush', 'maErr', 'maDiagDemande', 'maDiagPermis', 'maDiagInstaller'].map((n) => fonction(ma11, n)).join('\n');

let ok = 0, ko = 0;
const verifie = (c, msg) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', msg); } };

function monde({ reglages = {}, adresse = '', zsDiag = '', editeur = false, marais = true } = {}) {
  const ecoute = [], toile = [];
  const ctx = {
    settings: { ...reglages }, FX: { shake: 0 }, HUD: { flashK: 0, hint() { ctx.indice = (ctx.indice || 0) + 1; } },
    OW: { on: true, worldId: marais ? 'marais' : 'khamsin' }, G: { editorSession: editeur },
    MA_DIAG: { on: false, errs: [], n: 0, lost: 0, back: 0, glHooked: false, installed: false },
    MAB: { on: true }, MAM: { attn: 10 }, maPlayerOnWater: () => true, maDiagToggle() { ctx.bascule = (ctx.bascule || 0) + 1; },
    maDiagFrame() {}, render() {},
    location: { search: adresse }, URLSearchParams, store: { get: (k, d) => (k === 'zs.diag' ? zsDiag || d : d) },
    window: { addEventListener: (type, f, cap) => ecoute.push({ type, f }) },
    renderer: { domElement: { addEventListener: (type, f) => toile.push({ type, f }) } },
    lerp: (a, b, t) => a + (b - a) * t, MA_OR: { F: { i: 0, amb: 0, sky: 0, col: { r: 1, g: 1, b: 1, setRGB() {} } } },
    console: { error: () => { ctx.erreurs = (ctx.erreurs || 0) + 1; }, log: () => {} },
  };
  ctx.consoleErrorAvant = ctx.console.error;
  vm.createContext(ctx);
  vm.runInContext(ma00 + '\n' + diag, ctx);
  ctx.ecoute = ecoute; ctx.toile = toile;
  ctx.F8 = (shift) => { for (const e of ecoute) if (e.type === 'keydown') e.f({ code: 'F8', shiftKey: !!shift, preventDefault() {} }); };
  return ctx;
}

// --- secousses : désactivées par défaut, comme dans le kit une fois réglées
{
  const W = monde();
  vm.runInContext('maSecousse(0.7); maSecousse(1); maSecousse(0.5, 1.2);', W);
  verifie(W.FX.shake === 0, 'par défaut, aucune secousse du marais');
  verifie(vm.runInContext('maBalance()', W) === 0, 'par défaut, aucun balancement de la caméra');
  const S = monde({ reglages: { shake: true } });
  vm.runInContext('maSecousse(0.7)', S); verifie(Math.abs(S.FX.shake - 0.7) < 1e-9, 'réglée, la secousse a la force du kit');
  vm.runInContext('maSecousse(1)', S); verifie(S.FX.shake === 1, 'réglée, FX.shake = 1 comme dans le kit');
  vm.runInContext('maSecousse(0.5, 1.2)', S); verifie(Math.abs(S.FX.shake - 1.2) < 1e-9, 'réglée, le plafond du kit (1,2) est gardé');
  verifie(vm.runInContext('maBalance()', S) === 1, 'réglé, le balancement revient');
}
// --- secousses et à-coups venus du jeu de base (décision du 2 novembre 2026) : coupés dans le marais seulement
{
  const M = monde(); verifie(vm.runInContext('maSecousseVue()', M) === 0, 'jeu de base, dans le marais : secousses et à-coups coupés par défaut');
  const S = monde({ reglages: { shake: true } }); verifie(vm.runInContext('maSecousseVue()', S) === 1, 'jeu de base, dans le marais, secousses réglées : comme ailleurs');
  const K = monde({ marais: false }); verifie(vm.runInContext('maSecousseVue()', K) === 1, 'jeu de base, hors du marais : inchangé');
}
// --- voile blanc et scintillements
{
  const L = monde(); vm.runInContext('maEblouir()', L); verifie(Math.abs(L.HUD.flashK - 0.45) < 1e-9, 'flashs limités : voile blanc à 45 %');
  const R = monde({ reglages: { flashes: 'reduced' } }); vm.runInContext('maEblouir()', R); verifie(R.HUD.flashK === 0, 'effets réduits : aucun voile blanc');
  const b = [0, 0.05, 0.1, 0.2, 0.3].map((t) => vm.runInContext(`maBat(0.5, ${t})`, L));
  verifie(b.every((x) => x >= 0.5 - 1e-9 && x <= 1 + 1e-9), 'battement lent entre 0,5 et 1');
  verifie(vm.runInContext('maBat(0.5, 0.123)', R) === 0.75, 'effets réduits : lueur fixe');
}
// --- diagnostic : un joueur ordinaire, dans le marais
{
  const W = monde();
  vm.runInContext('maDiagInstaller()', W);
  verifie(W.ecoute.length === 0, 'joueur : aucun écouteur de la fenêtre (ni F8, ni erreurs)');
  verifie(W.toile.length === 2, 'joueur : seulement le message de perte du contexte WebGL (et son retour)');
  verifie(W.render.__diag === undefined, 'joueur : render n\'est pas enveloppé');
  verifie(W.console.error === W.consoleErrorAvant, 'console.error n\'est pas remplacé');
  vm.runInContext('maErr("essai")', W); verifie(W.MA_DIAG.n === 1 && W.erreurs === 1, 'maErr : compté pour le panneau et écrit dans la console');
}
// --- diagnostic demandé par l'adresse, dans le marais : F8 oui, Maj+F8 non
{
  const W = monde({ adresse: '?diag=marais' });
  vm.runInContext('maDiagInstaller()', W);
  verifie(W.ecoute.some((e) => e.type === 'keydown') && W.ecoute.some((e) => e.type === 'error'), 'diagnostic activé : F8 et erreurs écoutés');
  W.F8(false); verifie(W.bascule === 1, 'diagnostic activé : F8 ouvre le panneau');
  W.MA_DIAG.on = true; W.F8(true); verifie(W.MAM.attn === 10, 'diagnostic activé hors Mod Tools : Maj+F8 n\'appelle pas la bête');
  W.OW.worldId = 'khamsin'; W.F8(false); verifie(W.bascule === 1, 'hors du marais : F8 ne fait rien');
}
// --- partie de test des Mod Tools, dans le marais : Maj+F8 appelle la bête
{
  const W = monde({ editeur: true });
  vm.runInContext('maDiagInstaller()', W);
  W.MA_DIAG.on = true; W.F8(true); verifie(W.MAM.attn === 85, 'Mod Tools : Maj+F8 appelle la bête (menace 85)');
  W.OW.worldId = 'lune'; W.MAM.attn = 10; W.F8(true); verifie(W.MAM.attn === 10, 'Mod Tools hors du marais : Maj+F8 ne fait rien');
}
// --- store « zs.diag », et une autre valeur
{
  const A = monde({ zsDiag: 'marais' }); vm.runInContext('maDiagInstaller()', A); verifie(A.ecoute.length === 3, 'store zs.diag = marais : diagnostic installé');
  const B = monde({ zsDiag: 'oui', adresse: '?diag=1' }); vm.runInContext('maDiagInstaller()', B); verifie(B.ecoute.length === 0, 'autres valeurs : rien d\'installé');
}
console.log(`${ok} vérifications réussies, ${ko} en échec`);
process.exit(ko ? 1 : 0);
