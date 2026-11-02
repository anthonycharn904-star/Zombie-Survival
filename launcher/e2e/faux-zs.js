'use strict';
/* Faux window.zs pour contrôler la page du launcher dans un navigateur sans Electron (page-launcher.js).
   Il reproduit le pont du préchargement (src/preload/launcher.js) : mêmes fonctions, promesses, onStatus avec
   désabonnement, objet figé. Il reproduit aussi l'envoi de main.js (setStatus) : chaque correctif est fusionné dans
   l'état, puis l'état entier part en copie (comme le clonage de l'IPC) à chaque abonné.
   Posé avant le chargement de la page (addInitScript). Le lanceur le pilote par window.__fauxZs :
     emettre(patch)        fusionne et envoie, comme setStatus
     etat()                copie de l'état courant
     appels                liste des appels reçus { nom, args, t }
     reponses[nom]         { valeur } renvoyée, ou { rejet: 'message' } (rejet au format d'Electron)
     violations, erreurs   refus de la politique de sécurité, erreurs de la page */
(() => {
  const CANAUX = {
    status: 'launcher:status', check: 'launcher:check', install: 'launcher:install', cancel: 'launcher:cancel', play: 'launcher:play',
    repair: 'launcher:repair', rollback: 'launcher:rollback', updateLauncher: 'launcher:updateLauncher', openPublisher: 'launcher:publisher',
    openModtools: 'launcher:modtools', open: 'launcher:open', setSetting: 'launcher:setting', resetSource: 'launcher:resetSource',
    windowAction: 'launcher:window', openExternal: 'launcher:external',
  };
  // état initial de main.js (objet status) ; le lanceur le complète avant le chargement si besoin (__fauxZsDepart)
  const etat = Object.assign({
    phase: 'starting', launcherVersion: '1.3.3', installed: null, remote: null, launcherUpdate: null, news: [], progress: null,
    error: null, settings: null, source: null, author: false, justUpdated: null,
  }, window.__fauxZsDepart || {});
  const abonnes = new Set();
  const copie = () => JSON.parse(JSON.stringify(etat));
  const F = window.__fauxZs = {
    appels: [], reponses: {}, violations: [], erreurs: [],
    emettre(patch) { Object.assign(etat, patch); const c = copie(); for (const f of [...abonnes]) f(JSON.parse(JSON.stringify(c))); },
    etat: copie,
    abonnes: () => abonnes.size,
  };
  const appel = (nom, ...args) => {
    F.appels.push({ nom, args, t: Math.round(performance.now()) });
    const r = F.reponses[nom];
    if (r && r.rejet) return Promise.reject(new Error(`Error invoking remote method '${CANAUX[nom]}': Error: ${r.rejet}`));
    if (r && 'valeur' in r) return Promise.resolve(JSON.parse(JSON.stringify(r.valeur)));
    if (nom === 'status') return Promise.resolve(copie());
    if (nom === 'setSetting') return Promise.resolve(Object.assign({}, etat.settings));
    return Promise.resolve(true);
  };
  const api = {};
  for (const nom of Object.keys(CANAUX)) api[nom] = (...args) => appel(nom, ...args);
  api.onStatus = (cb) => { abonnes.add(cb); return () => abonnes.delete(cb); };
  Object.defineProperty(window, 'zs', { value: Object.freeze(api), writable: false, configurable: false, enumerable: true });
  document.addEventListener('securitypolicyviolation', (e) => F.violations.push(`${e.violatedDirective} ${e.blockedURI || ''} ${e.sourceFile || ''}:${e.lineNumber || ''}`.trim()));
  window.addEventListener('error', (e) => F.erreurs.push(String(e.message || e)));
})();
