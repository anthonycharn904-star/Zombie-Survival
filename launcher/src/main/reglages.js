'use strict';
/* Réglages du launcher (settings.json) : valeurs par défaut, contrôle de chaque valeur envoyée par la page, lecture
   d'un fichier écrit par une autre version du launcher. Module Node pur, sans Electron, pour pouvoir le tester seul.
   Les sons de l'ambiance n'en font pas partie : ils repartent coupés à chaque lancement (réglage de la page). */

const DEFAULTS = Object.freeze({
  autoCheck: true, autoInstall: true, fullscreen: true, keepLauncherOpen: false,
  // fond de l'accueil (launcher 1.4.0) : Les Marécages Maudits par défaut (choix d'Anthony du 2 novembre 2026) ou
  // Bunker 7 ; animé ou image fixe ; éclairs de l'orage ; volume de l'ambiance en %, 80 comme le volume du jeu
  fond: 'marais', fondAnime: true, fondEclairs: true, volumeSons: 80,
});

// règle de chaque réglage : booléen, une valeur d'une liste, ou un entier borné
const REGLES = Object.freeze({
  autoCheck: 'bool', autoInstall: 'bool', fullscreen: 'bool', keepLauncherOpen: 'bool', fondAnime: 'bool', fondEclairs: 'bool',
  fond: Object.freeze(['marais', 'bunker']),
  volumeSons: Object.freeze({ min: 0, max: 100 }),
});

/* Vrai si la valeur convient au réglage (réglage inconnu : faux). */
function valide(cle, valeur) {
  if (!Object.hasOwn(REGLES, cle)) return false;
  const r = REGLES[cle];
  if (r === 'bool') return typeof valeur === 'boolean';
  if (Array.isArray(r)) return r.includes(valeur);
  return Number.isInteger(valeur) && valeur >= r.min && valeur <= r.max;
}

/* Réglages lus dans settings.json : les valeurs par défaut, puis celles du fichier qui conviennent. Un réglage inconnu
   (écrit par une version plus récente) est gardé tel quel, pour ne pas le perdre au prochain enregistrement ; une
   valeur qu'une version plus récente a écrite pour un réglage connu (un autre fond…) est gardée dans le fichier par
   aEcrire. */
function lire(json) {
  const r = { ...DEFAULTS };
  if (!json || typeof json !== 'object' || Array.isArray(json)) return r;
  for (const [cle, valeur] of Object.entries(json)) {
    if (cle === '__proto__' || cle === 'constructor' || cle === 'prototype') continue;
    if (!Object.hasOwn(REGLES, cle)) r[cle] = valeur;
    else if (valide(cle, valeur)) r[cle] = valeur;
  }
  return r;
}

/* Ce qu'on écrit dans settings.json après le changement du réglage cle : les réglages en mémoire, plus les valeurs du
   fichier que cette version refuse pour un réglage connu (écrites par un launcher plus récent), sauf celle qu'on
   change. Sans fichier lisible, les réglages en mémoire seuls. */
function aEcrire(reglages, brut, cle) {
  const gardees = {};
  if (brut && typeof brut === 'object' && !Array.isArray(brut)) {
    for (const [c, v] of Object.entries(brut)) if (c !== cle && Object.hasOwn(REGLES, c) && !valide(c, v)) gardees[c] = v;
  }
  return { ...reglages, ...gardees };
}

module.exports = { DEFAULTS, REGLES, valide, lire, aEcrire };
