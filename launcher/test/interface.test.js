'use strict';
/* Page du launcher (src/renderer/launcher) : contrôles statiques. La politique de sécurité, les contrats lus par
   les essais de bout en bout, les identifiants utilisés par le script et les fichiers référencés. Le comportement
   se contrôle dans un navigateur avec e2e/page-launcher.js (faux window.zs), puis par les essais de bout en bout. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'renderer', 'launcher');
const HTML = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const JS = fs.readFileSync(path.join(DIR, 'launcher.js'), 'utf8');
const CSS = fs.readFileSync(path.join(DIR, 'launcher.css'), 'utf8');
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'";

test('interface : politique de sécurité inchangée, ni style ni script en ligne', () => {
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(HTML);
  assert.ok(meta, 'balise de la politique de sécurité');
  assert.equal(meta[1], CSP);
  assert.doesNotMatch(HTML, /\sstyle\s*=/i, 'aucun attribut style (refusé par style-src)');
  assert.doesNotMatch(HTML, /<style[\s>]/i, 'aucune balise style');
  assert.doesNotMatch(HTML, /\son[a-z]+\s*=/i, 'aucun gestionnaire en ligne');
  for (const m of HTML.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.match(m[1], /\ssrc="[^"]+"/, 'script chargé depuis un fichier');
    assert.equal(m[2].trim(), '', 'script sans contenu en ligne');
  }
  assert.ok(!/\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\(|document\.write\(|setAttribute\(\s*['"]style/.test(JS), 'pas de HTML ni de style construits en texte');
  assert.ok(!/(?:url\(\s*['"]?|(?:src|href)=")https?:/i.test(CSS + HTML), 'aucune ressource distante');
  assert.match(JS, /const NB = '\\u00a0';/, 'espace insécable entre un nombre et son unité, écrite en séquence');
});

test('interface : contrats des essais de bout en bout dans le HTML de départ', () => {
  const main = /<button\b[^>]*\bid="btn-main"[^>]*>/.exec(HTML);
  assert.ok(main, '#btn-main est un bouton');
  assert.match(main[0], /\sdisabled[\s>]/, '#btn-main désactivé au départ');
  assert.match(HTML, /<[a-z]+\b[^>]*\bid="status-title"[^>]*>Ouverture du bunker…</, '#status-title vaut « Ouverture du bunker… »');
  const mt = /<button\b[^>]*\bid="btn-modtools"[^>]*>/.exec(HTML);
  assert.ok(mt, '#btn-modtools est un bouton');
  assert.match(mt[0], /\shidden[\s>]/, '#btn-modtools caché au départ');
});

test('interface : chaque identifiant du script existe dans la page, une seule fois', () => {
  const ids = new Map();
  for (const m of HTML.matchAll(/\sid="([^"]+)"/g)) ids.set(m[1], (ids.get(m[1]) || 0) + 1);
  for (const [id, n] of ids) assert.equal(n, 1, `identifiant en double : ${id}`);
  const utilises = new Set([...JS.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  assert.ok(utilises.size > 40, 'le script lit ses éléments par $(…)');
  for (const id of utilises) assert.ok(ids.has(id), `#${id} absent de index.html`);
  // les symboles du sprite utilisés par la page
  for (const m of HTML.matchAll(/<use href="#([^"]+)"/g)) assert.ok(ids.has(m[1]), `symbole #${m[1]} absent`);
  // chaque data-act et data-section a son action ou sa page
  const actions = new Set([...JS.matchAll(/^\s{2}([a-zA-Z]+): /gm)].map((m) => m[1]));
  for (const m of HTML.matchAll(/data-act="([^"]+)"/g)) assert.ok(actions.has(m[1]), `action inconnue : ${m[1]}`);
  const pages = new Set([...HTML.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]));
  for (const m of HTML.matchAll(/data-(?:section|aller)="([^"]+)"/g)) assert.ok(pages.has(m[1]), `page inconnue : ${m[1]}`);
});

test('interface : les fichiers référencés existent', () => {
  const refs = [
    ...[...HTML.matchAll(/\s(?:src|href)="([^"#:][^"]*)"/g)].map((m) => m[1]),
    ...[...CSS.replace(/url\("data:[^"]*"\)/g, '').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
    ...[...JS.matchAll(/'(assets\/[^']+)'/g)].map((m) => m[1]),
  ];
  assert.ok(refs.length >= 6, 'la page référence ses feuilles, son script, ses images');
  for (const r of refs) assert.ok(fs.existsSync(path.join(DIR, r)), `fichier manquant : ${r}`);
});
