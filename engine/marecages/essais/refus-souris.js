'use strict';
/* Marécages Maudits : consigne d'Anthony du 2 novembre 2026 (zs-lourd, règle 5 et son complément) appliquée aux outils
   communs qui lancent le jeu par Playwright (e2e-page.js, puis mains.js), sans les modifier. Chargé par
   NODE_OPTIONS="--require …/refus-souris.js" (les processus enfants le chargent aussi), il ajoute à chaque nouvelle page :
   le refus de la souris verrouillée, avant tout script du jeu (le jeu passe en souris libre, sans pause ; sinon le
   Chromium sans tête noie la page de « souris déplacée » et sa mémoire gonfle jusqu'à 7 ou 18 Go), et le bandeau
   « Souris libre » masqué dès que la page est prête (il apparaîtrait dans les captures). */
const Module = require('module');
const REFUS = "Element.prototype.requestPointerLock = () => Promise.reject(new Error('souris verrouillée refusée (essai sans tête)'));\n"
  + "addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#lockhint{display:none!important}'; document.head.appendChild(st); });";
const requireAvant = Module.prototype.require;
Module.prototype.require = function (id) {
  const m = requireAvant.apply(this, arguments);
  if (/playwright-core$/.test(String(id)) && m && m.chromium && !m.chromium.__refusSouris) {
    const launch = m.chromium.launch.bind(m.chromium);
    m.chromium.launch = async (...a) => {
      const b = await launch(...a);
      for (const k of ['newContext', 'newPage']) {
        const f = b[k].bind(b);
        b[k] = async (...x) => { const o = await f(...x); await o.addInitScript(REFUS); return o; };
      }
      return b;
    };
    m.chromium.__refusSouris = true;
    process.stderr.write('refus-souris : souris verrouillée refusée et bandeau « Souris libre » masqué dans chaque page\n');
  }
  return m;
};
