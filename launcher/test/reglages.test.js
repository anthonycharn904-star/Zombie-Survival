'use strict';
/* Réglages du launcher (src/main/reglages.js) : valeurs par défaut, contrôle des valeurs envoyées par la page,
   lecture d'un settings.json écrit par une autre version. */
const test = require('node:test');
const assert = require('node:assert/strict');
const reglages = require('../src/main/reglages');

test('réglages : valeurs par défaut (fond des Marécages, animé, éclairs, volume 80 %)', () => {
  assert.deepEqual(reglages.DEFAULTS, {
    autoCheck: true, autoInstall: true, fullscreen: true, keepLauncherOpen: false,
    fond: 'marais', fondAnime: true, fondEclairs: true, volumeSons: 80,
  });
  assert.ok(Object.isFrozen(reglages.DEFAULTS));
  assert.equal(Object.hasOwn(reglages.DEFAULTS, 'fondSons'), false, 'les sons repartent coupés à chaque lancement : pas dans settings.json');
});

test('réglages : chaque valeur envoyée par la page est contrôlée', () => {
  for (const k of ['autoCheck', 'autoInstall', 'fullscreen', 'keepLauncherOpen', 'fondAnime', 'fondEclairs']) {
    assert.ok(reglages.valide(k, true) && reglages.valide(k, false), k);
    assert.ok(!reglages.valide(k, 1) && !reglages.valide(k, 'true') && !reglages.valide(k, null), `${k} : booléen seulement`);
  }
  assert.ok(reglages.valide('fond', 'marais') && reglages.valide('fond', 'bunker'));
  assert.ok(!reglages.valide('fond', 'khamsin') && !reglages.valide('fond', '') && !reglages.valide('fond', true));
  assert.ok(reglages.valide('volumeSons', 0) && reglages.valide('volumeSons', 55) && reglages.valide('volumeSons', 100));
  assert.ok(!reglages.valide('volumeSons', -5) && !reglages.valide('volumeSons', 101) && !reglages.valide('volumeSons', 12.5));
  assert.ok(!reglages.valide('volumeSons', '80') && !reglages.valide('volumeSons', NaN) && !reglages.valide('volumeSons', Infinity));
  assert.ok(!reglages.valide('fondSons', true), 'réglage inconnu refusé');
  assert.ok(!reglages.valide('__proto__', {}) && !reglages.valide('toString', true));
});

test('réglages : settings.json d’une autre version (valeurs fausses remplacées, réglages inconnus gardés)', () => {
  assert.deepEqual(reglages.lire(null), { ...reglages.DEFAULTS });
  assert.deepEqual(reglages.lire([1, 2]), { ...reglages.DEFAULTS });
  // launcher 1.3.3 : les quatre réglages d'alors, les nouveaux prennent leur valeur par défaut
  assert.deepEqual(reglages.lire({ autoCheck: false, autoInstall: true, fullscreen: false, keepLauncherOpen: true }),
    { ...reglages.DEFAULTS, autoCheck: false, fullscreen: false, keepLauncherOpen: true });
  const r = reglages.lire({ fond: 'bunker', volumeSons: 35, fondEclairs: false, fondAnime: 'oui', autoCheck: 0, futur: { a: 1 } });
  assert.equal(r.fond, 'bunker');
  assert.equal(r.volumeSons, 35);
  assert.equal(r.fondEclairs, false);
  assert.equal(r.fondAnime, true, 'valeur fausse : valeur par défaut');
  assert.equal(r.autoCheck, true, 'valeur fausse : valeur par défaut');
  assert.deepEqual(r.futur, { a: 1 }, 'réglage d’une version plus récente gardé');
  const p = reglages.lire(JSON.parse('{"__proto__": {"pollue": true}, "fond": "bunker"}'));
  assert.equal(p.pollue, undefined, 'pas de pollution du prototype');
  assert.equal(Object.getPrototypeOf(p), Object.prototype);
  assert.equal(p.fond, 'bunker');
});

test('réglages : un enregistrement garde dans le fichier les valeurs d’un launcher plus récent', () => {
  const brut = { fond: 'khamsin', volumeSons: 72.5, fondEclairs: true, futur: 1 };
  const r = reglages.lire(brut);
  assert.equal(r.fond, 'marais', 'en mémoire : valeur par défaut');
  r.fondEclairs = false;
  const ecrit = reglages.aEcrire(r, brut, 'fondEclairs');
  assert.equal(ecrit.fond, 'khamsin', 'le fond du launcher plus récent reste dans le fichier');
  assert.equal(ecrit.volumeSons, 72.5);
  assert.equal(ecrit.fondEclairs, false, 'le réglage changé est écrit');
  assert.equal(ecrit.futur, 1);
  r.fond = 'bunker';
  assert.equal(reglages.aEcrire(r, brut, 'fond').fond, 'bunker', 'choisir un fond remplace celui du fichier');
  assert.deepEqual(reglages.aEcrire({ ...reglages.DEFAULTS }, null, 'fond'), { ...reglages.DEFAULTS }, 'sans fichier : les réglages en mémoire');
  assert.equal(Object.getPrototypeOf(reglages.aEcrire(r, JSON.parse('{"__proto__": {"x": 1}}'), 'fond')), Object.prototype);
});
